/**
 * HACCP-001 — servidor del módulo HACCP (fuente de verdad operativa). Planes versionados
 * (major/minor), equipo y fuentes (producto/MP/PPR/documentos) version-owned con SNAPSHOT de
 * la versión exacta usada. Publicar sella los snapshots; una nueva versión clona las
 * referencias EXACTAS (no salta a «latest», §38). Detección de actualización de fuente (solo
 * aviso, §25). Aislamiento por organización (RLS + withOrgContext). Permisos por rol.
 */
import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import {
  INITIAL_VERSION_LABEL,
  nextVersionLabel,
  parseVersionLabel,
  type VersionBump,
} from '@/features/documents/versioning';
import {
  hasSourceUpdate,
  isVersionEditable,
  validateHaccpPublish,
  type HaccpReferenceKind,
} from '@/features/haccp/haccp-state';

export type Tx = Prisma.TransactionClient;

export class HaccpNotFoundError extends Error {
  constructor() {
    super('Plan HACCP no encontrado.');
  }
}
export class HaccpPermissionError extends Error {}
export class HaccpValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '));
  }
}

async function memberRole(organizationId: string, userId: string): Promise<string> {
  const m = await getPrisma().membership.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!m) throw new HaccpPermissionError('No perteneces a esta organización.');
  return m.role;
}
const isAdmin = (role: string) => role === 'owner' || role === 'admin';

export async function requireAdmin(organizationId: string, userId: string): Promise<void> {
  const role = await memberRole(organizationId, userId);
  if (!isAdmin(role)) throw new HaccpPermissionError('Solo owner/admin puede editar planes HACCP.');
}

export async function memberDirectory(organizationId: string): Promise<Map<string, string>> {
  const members = await getPrisma().membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  const users = await getPrisma().user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.displayName ?? u.email]));
}

/** Reserva atómica del consecutivo `PL-HACCP-###` por organización. */
async function nextPlanCode(tx: Tx, organizationId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO haccp_plan_code_counters ("organization_id", "last_seq")
    VALUES (${organizationId}::uuid, 1)
    ON CONFLICT ("organization_id")
    DO UPDATE SET "last_seq" = haccp_plan_code_counters."last_seq" + 1
    RETURNING "last_seq"`;
  const seq = rows[0]?.last_seq ?? 1;
  return `PL-HACCP-${String(seq).padStart(3, '0')}`;
}

/** Versión publicada vigente de un documento fuente (para snapshot y detección). */
async function currentPublishedVersion(
  organizationId: string,
  documentId: string,
): Promise<{ id: string; label: string; status: string; publishedAt: Date | null } | null> {
  const v = await getPrisma().documentVersion.findFirst({
    where: { organizationId, documentId, status: 'published', isCurrent: true },
    select: { id: true, label: true, status: true, publishedAt: true },
  });
  return v;
}

async function loadPlan(organizationId: string, planId: string) {
  const plan = await getPrisma().haccpPlan.findFirst({ where: { id: planId, organizationId } });
  if (!plan) throw new HaccpNotFoundError();
  return plan;
}

/** Versión activa (editable) del plan: el borrador/en-revisión más reciente, o la vigente. */
export async function activeVersion(organizationId: string, planId: string) {
  const draft = await getPrisma().haccpPlanVersion.findFirst({
    where: { organizationId, planId, status: { in: ['draft', 'in_review'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (draft) return draft;
  return getPrisma().haccpPlanVersion.findFirst({
    where: { organizationId, planId },
    orderBy: [{ isCurrent: 'desc' }, { createdAt: 'desc' }],
  });
}

// ===========================================================================
// Lectura
// ===========================================================================

export async function listHaccpPlans(organizationId: string) {
  const plans = await getPrisma().haccpPlan.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
  });
  const [names, sites, versions] = await Promise.all([
    memberDirectory(organizationId),
    getPrisma().site.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    getPrisma().haccpPlanVersion.findMany({
      where: { organizationId, planId: { in: plans.map((p) => p.id) } },
      select: { id: true, planId: true, versionLabel: true, status: true, isCurrent: true },
    }),
  ]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const currentByPlan = new Map(
    versions.filter((v) => v.isCurrent).map((v) => [v.planId, v.versionLabel]),
  );
  return plans.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    productProcess: null as string | null,
    siteName: p.siteId ? (siteName.get(p.siteId) ?? null) : null,
    currentVersionLabel: currentByPlan.get(p.id) ?? null,
    status: p.status,
    responsibleName: p.responsibleUserId ? (names.get(p.responsibleUserId) ?? null) : null,
    nextReviewAt: p.nextReviewAt ? p.nextReviewAt.toISOString().slice(0, 10) : null,
  }));
}

export async function getHaccpPlanDetail(organizationId: string, planId: string) {
  const plan = await loadPlan(organizationId, planId);
  const [versions, names, sites] = await Promise.all([
    getPrisma().haccpPlanVersion.findMany({
      where: { organizationId, planId },
      orderBy: { createdAt: 'desc' },
    }),
    memberDirectory(organizationId),
    getPrisma().site.findMany({ where: { organizationId }, select: { id: true, name: true } }),
  ]);
  const active = await activeVersion(organizationId, planId);
  const [team, references] = active
    ? await Promise.all([
        getPrisma().haccpTeamMember.findMany({
          where: { organizationId, planVersionId: active.id },
          orderBy: [{ isLeader: 'desc' }, { sortOrder: 'asc' }],
        }),
        getPrisma().haccpSourceReference.findMany({
          where: { organizationId, planVersionId: active.id },
          orderBy: { sortOrder: 'asc' },
        }),
      ])
    : [[], []];

  // Detección de actualización de fuente: compara la versión usada vs. la publicada vigente.
  const docIds = [...new Set(references.map((r) => r.sourceDocumentId))];
  const latestByDoc = new Map<string, { id: string; label: string } | null>();
  await Promise.all(
    docIds.map(async (docId) => {
      const v = await currentPublishedVersion(organizationId, docId);
      latestByDoc.set(docId, v ? { id: v.id, label: v.label } : null);
    }),
  );

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);
  const editable = active ? isVersionEditable(active.status) : false;

  // Estado de la versión fuente (snapshot) en español (§11: sin enums en inglés).
  const sourceStatusLabel = (s: string | null): string | null =>
    s ? ({ published: 'Publicada', obsolete: 'Obsoleta', draft: 'Borrador' }[s] ?? s) : null;

  const refView = references.map((r) => {
    const latest = latestByDoc.get(r.sourceDocumentId) ?? null;
    return {
      id: r.id,
      referenceKind: r.referenceKind as HaccpReferenceKind,
      sourceType: r.sourceType,
      sourceDocumentId: r.sourceDocumentId,
      sourceVersionId: r.sourceVersionId,
      category: r.category,
      notes: r.notes,
      code: r.sourceCodeSnapshot,
      title: r.sourceTitleSnapshot,
      versionLabel: r.sourceVersionLabelSnapshot,
      statusLabel: sourceStatusLabel(r.sourceStatusSnapshot),
      updateAvailable: hasSourceUpdate({
        usedVersionId: r.sourceVersionId,
        latestPublishedVersionId: latest?.id ?? null,
      }),
      latestVersionLabel: latest?.label ?? null,
    };
  });

  return {
    plan: {
      id: plan.id,
      code: plan.code,
      title: plan.title,
      description: plan.description,
      scope: plan.scope,
      status: plan.status,
      siteId: plan.siteId,
      siteName: plan.siteId ? (siteName.get(plan.siteId) ?? null) : null,
      responsibleUserId: plan.responsibleUserId,
      responsibleName: nameOf(plan.responsibleUserId),
      nextReviewAt: plan.nextReviewAt ? plan.nextReviewAt.toISOString().slice(0, 10) : null,
    },
    versions: versions.map((v) => ({
      id: v.id,
      versionLabel: v.versionLabel,
      status: v.status,
      isCurrent: v.isCurrent,
      changeNotes: v.changeNotes,
      productProcess: v.productProcess,
      scope: v.scope,
      createdAtLabel: v.createdAt.toISOString().slice(0, 10),
      publishedAtLabel: v.publishedAt ? v.publishedAt.toISOString().slice(0, 10) : null,
    })),
    active: active
      ? {
          id: active.id,
          versionLabel: active.versionLabel,
          status: active.status,
          scope: active.scope,
          productProcess: active.productProcess,
          editable,
          flowVerifiedOnSite: active.flowVerifiedOnSite,
          flowVerifiedAtLabel: active.flowVerifiedAt
            ? active.flowVerifiedAt.toISOString().slice(0, 10)
            : null,
          flowVerifiedByName: nameOf(active.flowVerifiedBy),
        }
      : null,
    team: team.map((t) => ({
      id: t.id,
      userId: t.userId,
      name: t.userId ? nameOf(t.userId) : t.externalName,
      isInternal: Boolean(t.userId),
      area: t.area,
      jobTitle: t.jobTitle,
      haccpRole: t.haccpRole,
      responsibility: t.responsibility,
      trainingSummary: t.trainingSummary,
      isLeader: t.isLeader,
    })),
    references: refView,
    members: [...names].map(([id, name]) => ({ id, name })),
    editable,
    updatesAvailable: refView.filter((r) => r.updateAvailable).length,
  };
}

// ===========================================================================
// Escritura — plan y versión
// ===========================================================================

export interface CreateHaccpPlanInput {
  title: string;
  description?: string | null;
  scope?: string | null;
  productProcess?: string | null;
  siteId?: string | null;
  responsibleUserId?: string | null;
}

export async function createHaccpPlan(
  organizationId: string,
  userId: string,
  input: CreateHaccpPlanInput,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  if (!input.title?.trim()) throw new HaccpValidationError(['El nombre del plan es obligatorio.']);
  return withOrgContext(organizationId, async (tx) => {
    const code = await nextPlanCode(tx, organizationId);
    const plan = await tx.haccpPlan.create({
      data: {
        organizationId,
        code,
        title: input.title.trim(),
        description: input.description ?? null,
        scope: input.scope ?? null,
        status: 'draft',
        siteId: input.siteId ?? null,
        responsibleUserId: input.responsibleUserId ?? null,
        createdBy: userId,
      },
    });
    const { major, minor } = parseVersionLabel(INITIAL_VERSION_LABEL);
    await tx.haccpPlanVersion.create({
      data: {
        organizationId,
        planId: plan.id,
        major,
        minor,
        versionLabel: INITIAL_VERSION_LABEL,
        status: 'draft',
        scope: input.scope ?? null,
        productProcess: input.productProcess ?? null,
        createdBy: userId,
      },
    });
    return plan.id;
  });
}

export async function updateHaccpPlan(
  organizationId: string,
  userId: string,
  planId: string,
  input: Partial<CreateHaccpPlanInput>,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const plan = await loadPlan(organizationId, planId);
  if (plan.status === 'obsolete')
    throw new HaccpValidationError(['Un plan obsoleto no puede editarse.']);
  const active = await activeVersion(organizationId, planId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpPlan.update({
      where: { id: planId },
      data: {
        title: input.title?.trim() ?? plan.title,
        description: input.description ?? plan.description,
        scope: input.scope ?? plan.scope,
        siteId: input.siteId === undefined ? plan.siteId : input.siteId,
        responsibleUserId:
          input.responsibleUserId === undefined ? plan.responsibleUserId : input.responsibleUserId,
      },
    });
    // Alcance / producto-proceso viven en la versión editable.
    if (active && isVersionEditable(active.status)) {
      await tx.haccpPlanVersion.update({
        where: { id: active.id },
        data: {
          scope: input.scope ?? active.scope,
          productProcess: input.productProcess ?? active.productProcess,
        },
      });
    }
  });
}

/** Publica la versión activa (draft): valida, sella snapshots y la hace vigente (§35/§36). */
export async function publishHaccpVersion(
  organizationId: string,
  userId: string,
  planId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const plan = await loadPlan(organizationId, planId);
  const active = await activeVersion(organizationId, planId);
  if (!active || !isVersionEditable(active.status))
    throw new HaccpValidationError(['No hay una versión en borrador para publicar.']);

  const [team, leader] = await Promise.all([
    getPrisma().haccpTeamMember.count({ where: { organizationId, planVersionId: active.id } }),
    getPrisma().haccpTeamMember.findFirst({
      where: { organizationId, planVersionId: active.id, isLeader: true },
    }),
  ]);
  const errors = validateHaccpPublish({
    title: plan.title,
    scope: active.scope,
    responsibleUserId: plan.responsibleUserId,
    productProcess: active.productProcess,
    hasTeam: team > 0,
    hasLeader: Boolean(leader),
  });
  if (errors.length) throw new HaccpValidationError(errors);

  await withOrgContext(organizationId, async (tx) => {
    // Sella snapshots de las referencias que aún no tengan versión fija (§21).
    const refs = await tx.haccpSourceReference.findMany({
      where: { organizationId, planVersionId: active.id, sourceVersionId: null },
    });
    for (const r of refs) {
      const v = await currentPublishedVersion(organizationId, r.sourceDocumentId);
      if (v) {
        await tx.haccpSourceReference.update({
          where: { id: r.id },
          data: {
            sourceVersionId: v.id,
            sourceVersionLabelSnapshot: v.label,
            sourceStatusSnapshot: v.status,
            sourcePublishedAtSnapshot: v.publishedAt,
          },
        });
      }
    }
    // Obsoleta la versión vigente anterior.
    await tx.haccpPlanVersion.updateMany({
      where: { organizationId, planId, status: 'published' },
      data: { status: 'obsolete', isCurrent: false },
    });
    await tx.haccpPlanVersion.update({
      where: { id: active.id },
      data: { status: 'published', isCurrent: true, publishedAt: new Date() },
    });
    await tx.haccpPlan.update({
      where: { id: planId },
      data: { status: 'published', currentVersionId: active.id, scope: active.scope },
    });
  });
}

/**
 * Nueva versión (draft) desde la vigente: clona equipo y referencias con las MISMAS versiones
 * exactas (no salta a latest, §37/§38). No comparte filas hijas.
 */
export async function createHaccpVersion(
  organizationId: string,
  userId: string,
  planId: string,
  bump: VersionBump,
  changeNotes?: string | null,
): Promise<string> {
  await requireAdmin(organizationId, userId);
  await loadPlan(organizationId, planId); // valida existencia + tenant
  // Un solo borrador en curso.
  const existingDraft = await getPrisma().haccpPlanVersion.findFirst({
    where: { organizationId, planId, status: { in: ['draft', 'in_review'] } },
  });
  if (existingDraft)
    throw new HaccpValidationError(['Ya existe un borrador en curso para este plan.']);
  const current = await getPrisma().haccpPlanVersion.findFirst({
    where: { organizationId, planId, isCurrent: true },
  });
  if (!current)
    throw new HaccpValidationError(['No hay una versión vigente desde la cual crear una nueva.']);

  const label = nextVersionLabel(current.versionLabel, bump);
  const { major, minor } = parseVersionLabel(label);

  return withOrgContext(organizationId, async (tx) => {
    const created = await tx.haccpPlanVersion.create({
      data: {
        organizationId,
        planId,
        major,
        minor,
        versionLabel: label,
        status: 'draft',
        scope: current.scope,
        productProcess: current.productProcess,
        changeNotes: changeNotes ?? null,
        createdBy: userId,
      },
    });
    const [team, refs] = await Promise.all([
      tx.haccpTeamMember.findMany({ where: { organizationId, planVersionId: current.id } }),
      tx.haccpSourceReference.findMany({ where: { organizationId, planVersionId: current.id } }),
    ]);
    for (const t of team) {
      await tx.haccpTeamMember.create({
        data: {
          organizationId,
          planVersionId: created.id,
          userId: t.userId,
          externalName: t.externalName,
          area: t.area,
          jobTitle: t.jobTitle,
          haccpRole: t.haccpRole,
          responsibility: t.responsibility,
          trainingSummary: t.trainingSummary,
          isLeader: t.isLeader,
          sortOrder: t.sortOrder,
        },
      });
    }
    for (const r of refs) {
      await tx.haccpSourceReference.create({
        data: {
          organizationId,
          planVersionId: created.id,
          referenceKind: r.referenceKind,
          sourceType: r.sourceType,
          sourceDocumentId: r.sourceDocumentId,
          sourceVersionId: r.sourceVersionId, // versión EXACTA anterior (no latest).
          category: r.category,
          sortOrder: r.sortOrder,
          notes: r.notes,
          sourceCodeSnapshot: r.sourceCodeSnapshot,
          sourceTitleSnapshot: r.sourceTitleSnapshot,
          sourceVersionLabelSnapshot: r.sourceVersionLabelSnapshot,
          sourceStatusSnapshot: r.sourceStatusSnapshot,
          sourcePublishedAtSnapshot: r.sourcePublishedAtSnapshot,
        },
      });
    }
    // §E22: clona etapas y conexiones preservando la identidad LÓGICA (process_step_id);
    // las filas son nuevas. Las conexiones referencian process_step_id → no se remapean.
    const [steps, connections] = await Promise.all([
      tx.haccpProcessStep.findMany({ where: { organizationId, planVersionId: current.id } }),
      tx.haccpProcessConnection.findMany({ where: { organizationId, planVersionId: current.id } }),
    ]);
    for (const s of steps) {
      await tx.haccpProcessStep.create({
        data: {
          organizationId,
          planVersionId: created.id,
          processStepId: s.processStepId,
          stepType: s.stepType,
          name: s.name,
          description: s.description,
          sequence: s.sequence,
          area: s.area,
          responsibleUserId: s.responsibleUserId,
          responsibleRole: s.responsibleRole,
          equipment: s.equipment,
          inputs: s.inputs,
          outputs: s.outputs,
          parameters: s.parameters,
          notes: s.notes,
        },
      });
    }
    for (const c of connections) {
      await tx.haccpProcessConnection.create({
        data: {
          organizationId,
          planVersionId: created.id,
          fromStepId: c.fromStepId,
          toStepId: c.toStepId,
          connectionType: c.connectionType,
          label: c.label,
          sequence: c.sequence,
        },
      });
    }
    // HACCP-PROCESS-EXPANSION §Q: clona entradas, salidas y destinos preservando su identidad
    // LÓGICA (input_logical_id / output_logical_id / destination_logical_id) y las refs lógicas
    // de etapa (process_step_id, no se remapean). El source_reference_id de las entradas se
    // remapea a la referencia clonada equivalente.
    const [procInputs, procOutputs, procDestinations] = await Promise.all([
      tx.haccpProcessInput.findMany({ where: { organizationId, planVersionId: current.id } }),
      tx.haccpProcessOutput.findMany({ where: { organizationId, planVersionId: current.id } }),
      tx.haccpProcessOutputDestination.findMany({
        where: { organizationId, planVersionId: current.id },
      }),
    ]);
    // Mapa general de referencias antigua→nueva (por tipo+documento+orden), para las entradas.
    const oldRefs = await tx.haccpSourceReference.findMany({
      where: { organizationId, planVersionId: current.id },
    });
    const newRefs = await tx.haccpSourceReference.findMany({
      where: { organizationId, planVersionId: created.id },
    });
    const refKeyOf = (r: { referenceKind: string; sourceDocumentId: string; sortOrder: number }) =>
      `${r.referenceKind}|${r.sourceDocumentId}|${r.sortOrder}`;
    const newRefByKey = new Map(newRefs.map((r) => [refKeyOf(r), r.id]));
    const oldRefKeyById = new Map(oldRefs.map((r) => [r.id, refKeyOf(r)]));
    const remapRef = (id: string | null) =>
      id ? (newRefByKey.get(oldRefKeyById.get(id) ?? '') ?? null) : null;

    for (const i of procInputs) {
      await tx.haccpProcessInput.create({
        data: {
          organizationId,
          planVersionId: created.id,
          processStepId: i.processStepId,
          inputLogicalId: i.inputLogicalId, // identidad lógica estable (§Q1)
          name: i.name,
          inputType: i.inputType,
          sourceType: i.sourceType,
          sourceProcessStepId: i.sourceProcessStepId,
          sourceReferenceId: remapRef(i.sourceReferenceId),
          supplierName: i.supplierName,
          externalSource: i.externalSource,
          description: i.description,
          notes: i.notes,
          sortOrder: i.sortOrder,
        },
      });
    }
    for (const o of procOutputs) {
      await tx.haccpProcessOutput.create({
        data: {
          organizationId,
          planVersionId: created.id,
          processStepId: o.processStepId,
          outputLogicalId: o.outputLogicalId, // identidad lógica estable (§Q2)
          name: o.name,
          outputType: o.outputType,
          conditionStatus: o.conditionStatus,
          description: o.description,
          notes: o.notes,
          sortOrder: o.sortOrder,
        },
      });
    }
    for (const d of procDestinations) {
      await tx.haccpProcessOutputDestination.create({
        data: {
          organizationId,
          planVersionId: created.id,
          outputLogicalId: d.outputLogicalId, // FK a la salida clonada (misma versión)
          destinationLogicalId: d.destinationLogicalId,
          destinationType: d.destinationType,
          destinationProcessStepId: d.destinationProcessStepId,
          destinationExternalText: d.destinationExternalText,
          destinationSourceReferenceId: remapRef(d.destinationSourceReferenceId),
          label: d.label,
          sortOrder: d.sortOrder,
        },
      });
    }
    // §HACCP-003 §38: clona la matriz de riesgo (snapshot de metodología) y los peligros,
    // preservando hazard_logical_id y las referencias lógicas (process_step_id / material).
    const matrix = await tx.haccpRiskMatrixConfig.findFirst({
      where: { organizationId, planVersionId: current.id },
    });
    if (matrix) {
      await tx.haccpRiskMatrixConfig.create({
        data: {
          organizationId,
          planVersionId: created.id,
          probabilityScale: matrix.probabilityScale as object,
          severityScale: matrix.severityScale as object,
          scoreFormula: matrix.scoreFormula,
          significanceThreshold: matrix.significanceThreshold,
        },
      });
    }
    // Mapa de referencias de MP anterior → nueva (por sortOrder, ya clonadas arriba).
    const newMaterials = await tx.haccpSourceReference.findMany({
      where: { organizationId, planVersionId: created.id, referenceKind: 'material' },
    });
    const newMatByLogical = new Map(
      newMaterials.map((m) => [`${m.sourceDocumentId}|${m.sortOrder}`, m.id]),
    );
    const oldMaterials = await tx.haccpSourceReference.findMany({
      where: { organizationId, planVersionId: current.id, referenceKind: 'material' },
    });
    const oldMatKey = new Map(
      oldMaterials.map((m) => [m.id, `${m.sourceDocumentId}|${m.sortOrder}`]),
    );
    const hazards = await tx.haccpHazard.findMany({
      where: { organizationId, planVersionId: current.id },
    });
    for (const h of hazards) {
      const newSourceRef = h.sourceReferenceId
        ? (newMatByLogical.get(oldMatKey.get(h.sourceReferenceId) ?? '') ?? null)
        : null;
      await tx.haccpHazard.create({
        data: {
          organizationId,
          planVersionId: created.id,
          hazardLogicalId: h.hazardLogicalId, // identidad lógica estable (§38)
          sourceType: h.sourceType,
          sourceReferenceId: newSourceRef,
          processStepId: h.processStepId, // identidad lógica de la etapa (no se remapea)
          // HACCP-PROCESS-EXPANSION: preserva el contexto y las refs lógicas de entrada/salida.
          contextType: h.contextType,
          inputLogicalId: h.inputLogicalId,
          outputLogicalId: h.outputLogicalId,
          hazardType: h.hazardType,
          name: h.name,
          description: h.description,
          originOrCause: h.originOrCause,
          probability: h.probability,
          severity: h.severity,
          riskScore: h.riskScore,
          isSignificant: h.isSignificant,
          significanceSource: h.significanceSource,
          significanceReason: h.significanceReason,
          existingControlMeasure: h.existingControlMeasure,
          status: h.status,
          createdBy: h.createdBy,
        },
      });
    }
    // §HACCP-004 §30: clona evaluaciones de medidas de control y planes de control,
    // preservando control_measure_logical_id / hazard_logical_id. La MP se remapea.
    const [assessments, controlPlans] = await Promise.all([
      tx.haccpControlAssessment.findMany({ where: { organizationId, planVersionId: current.id } }),
      tx.haccpControlPlan.findMany({ where: { organizationId, planVersionId: current.id } }),
    ]);
    for (const a of assessments) {
      await tx.haccpControlAssessment.create({
        data: {
          organizationId,
          planVersionId: created.id,
          controlMeasureLogicalId: a.controlMeasureLogicalId,
          hazardLogicalId: a.hazardLogicalId,
          methodKey: a.methodKey,
          methodVersion: a.methodVersion,
          classification: a.classification,
          classificationSource: a.classificationSource,
          justification: a.justification,
          overrideReason: a.overrideReason,
          answers: a.answers as object,
          status: a.status,
          createdBy: a.createdBy,
        },
      });
    }
    for (const p of controlPlans) {
      const newSourceRef = p.sourceReferenceId
        ? (newMatByLogical.get(oldMatKey.get(p.sourceReferenceId) ?? '') ?? null)
        : null;
      await tx.haccpControlPlan.create({
        data: {
          organizationId,
          planVersionId: created.id,
          controlMeasureLogicalId: p.controlMeasureLogicalId,
          hazardLogicalId: p.hazardLogicalId,
          classification: p.classification,
          processStepId: p.processStepId,
          sourceReferenceId: newSourceRef,
          controlMeasure: p.controlMeasure,
          justification: p.justification,
          criticalLimit: p.criticalLimit,
          actionCriterion: p.actionCriterion,
          monitoringWhat: p.monitoringWhat,
          monitoringHow: p.monitoringHow,
          monitoringWho: p.monitoringWho,
          monitoringWhen: p.monitoringWhen,
          correction: p.correction,
          correctiveAction: p.correctiveAction,
          recordReference: p.recordReference,
          createdBy: p.createdBy,
        },
      });
    }
    // §HACCP-005 §20: clona las validaciones como antecedente preservando validation_logical_id.
    const validations = await tx.haccpControlValidation.findMany({
      where: { organizationId, planVersionId: current.id },
    });
    for (const v of validations) {
      await tx.haccpControlValidation.create({
        data: {
          organizationId,
          planVersionId: created.id,
          validationLogicalId: v.validationLogicalId,
          controlMeasureLogicalId: v.controlMeasureLogicalId,
          hazardLogicalId: v.hazardLogicalId,
          status: v.status,
          result: v.result,
          objective: v.objective,
          scope: v.scope,
          methodType: v.methodType,
          methodDescription: v.methodDescription,
          evidenceSummary: v.evidenceSummary,
          technicalBasis: v.technicalBasis,
          acceptanceCriteria: v.acceptanceCriteria,
          conclusion: v.conclusion,
          evidenceDocumentId: v.evidenceDocumentId,
          evidenceDocumentVersionId: v.evidenceDocumentVersionId,
          performedAt: v.performedAt,
          performedByUserId: v.performedByUserId,
          performedByExternalName: v.performedByExternalName,
          reviewedByUserId: v.reviewedByUserId,
          reviewedAt: v.reviewedAt,
          nextValidationAt: v.nextValidationAt,
          createdBy: v.createdBy,
        },
      });
    }
    await tx.haccpPlan.update({ where: { id: planId }, data: { status: 'draft' } });
    return created.id;
  });
}

// ===========================================================================
// Escritura — equipo
// ===========================================================================

export async function requireEditableVersion(organizationId: string, planVersionId: string) {
  const v = await getPrisma().haccpPlanVersion.findFirst({
    where: { id: planVersionId, organizationId },
  });
  if (!v) throw new HaccpNotFoundError();
  if (!isVersionEditable(v.status))
    throw new HaccpValidationError(['Solo un borrador puede editarse.']);
  return v;
}

export interface TeamMemberInput {
  userId?: string | null;
  externalName?: string | null;
  area?: string | null;
  jobTitle?: string | null;
  haccpRole?: string | null;
  responsibility?: string | null;
  trainingSummary?: string | null;
  isLeader?: boolean;
}

export async function addTeamMember(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: TeamMemberInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  if (!input.userId && !input.externalName?.trim())
    throw new HaccpValidationError(['Indica una persona interna o el nombre de una externa.']);
  await withOrgContext(organizationId, async (tx) => {
    if (input.isLeader) await demoteLeaders(tx, organizationId, planVersionId);
    const max = await tx.haccpTeamMember.aggregate({
      where: { organizationId, planVersionId },
      _max: { sortOrder: true },
    });
    await tx.haccpTeamMember.create({
      data: {
        organizationId,
        planVersionId,
        userId: input.userId ?? null,
        externalName: input.userId ? null : (input.externalName?.trim() ?? null),
        area: input.area ?? null,
        jobTitle: input.jobTitle ?? null,
        haccpRole: input.haccpRole ?? null,
        responsibility: input.responsibility ?? null,
        trainingSummary: input.trainingSummary ?? null,
        isLeader: Boolean(input.isLeader),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
}

/** §11: baja el líder actual antes de asignar otro (máximo 1 por versión). */
async function demoteLeaders(tx: Tx, organizationId: string, planVersionId: string): Promise<void> {
  await tx.haccpTeamMember.updateMany({
    where: { organizationId, planVersionId, isLeader: true },
    data: { isLeader: false },
  });
}

export async function removeTeamMember(
  organizationId: string,
  userId: string,
  memberId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const m = await getPrisma().haccpTeamMember.findFirst({
    where: { id: memberId, organizationId },
  });
  if (!m) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, m.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpTeamMember.delete({ where: { id: memberId } });
  });
}

// ===========================================================================
// Escritura — fuentes (producto / MP / PPR / documentos)
// ===========================================================================

export interface SourceReferenceInput {
  referenceKind: HaccpReferenceKind;
  sourceDocumentId: string;
  sourceType?: 'document' | 'program';
  category?: string | null;
  notes?: string | null;
}

export async function addSourceReference(
  organizationId: string,
  userId: string,
  planVersionId: string,
  input: SourceReferenceInput,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  await requireEditableVersion(organizationId, planVersionId);
  const doc = await getPrisma().document.findFirst({
    where: { id: input.sourceDocumentId, organizationId },
    select: { id: true, code: true, title: true, documentType: true },
  });
  if (!doc) throw new HaccpValidationError(['El documento fuente no existe en la organización.']);
  // Producto ≤1 por versión (§12): reemplaza si ya existe.
  if (input.referenceKind === 'product') {
    await withOrgContext(organizationId, async (tx) => {
      await tx.haccpSourceReference.deleteMany({
        where: { organizationId, planVersionId, referenceKind: 'product' },
      });
    });
  }
  const version = await currentPublishedVersion(organizationId, doc.id);
  await withOrgContext(organizationId, async (tx) => {
    const max = await tx.haccpSourceReference.aggregate({
      where: { organizationId, planVersionId },
      _max: { sortOrder: true },
    });
    await tx.haccpSourceReference.create({
      data: {
        organizationId,
        planVersionId,
        referenceKind: input.referenceKind,
        sourceType: input.sourceType ?? (doc.documentType === 'program' ? 'program' : 'document'),
        sourceDocumentId: doc.id,
        sourceVersionId: version?.id ?? null,
        category: input.category ?? null,
        notes: input.notes ?? null,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        sourceCodeSnapshot: doc.code,
        sourceTitleSnapshot: doc.title,
        sourceVersionLabelSnapshot: version?.label ?? null,
        sourceStatusSnapshot: version?.status ?? null,
        sourcePublishedAtSnapshot: version?.publishedAt ?? null,
      },
    });
  });
}

export async function removeSourceReference(
  organizationId: string,
  userId: string,
  referenceId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const r = await getPrisma().haccpSourceReference.findFirst({
    where: { id: referenceId, organizationId },
  });
  if (!r) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, r.planVersionId);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpSourceReference.delete({ where: { id: referenceId } });
  });
}

/** §39: en un borrador, actualiza una referencia a la versión publicada más reciente. */
export async function updateSourceToLatest(
  organizationId: string,
  userId: string,
  referenceId: string,
): Promise<void> {
  await requireAdmin(organizationId, userId);
  const r = await getPrisma().haccpSourceReference.findFirst({
    where: { id: referenceId, organizationId },
  });
  if (!r) throw new HaccpNotFoundError();
  await requireEditableVersion(organizationId, r.planVersionId);
  const v = await currentPublishedVersion(organizationId, r.sourceDocumentId);
  if (!v)
    throw new HaccpValidationError(['La fuente no tiene una versión publicada más reciente.']);
  await withOrgContext(organizationId, async (tx) => {
    await tx.haccpSourceReference.update({
      where: { id: referenceId },
      data: {
        sourceVersionId: v.id,
        sourceVersionLabelSnapshot: v.label,
        sourceStatusSnapshot: v.status,
        sourcePublishedAtSnapshot: v.publishedAt,
      },
    });
  });
}
