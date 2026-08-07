/**
 * Preparación para auditoría (TASK-010). Matriz requisito-evidencia + índice
 * OPERATIVO (no certificación). Usa datos reales del checklist de una auditoría
 * (snapshots + evaluación + evidencia + hallazgos). Scoping por organización.
 */
import { getPrisma } from './db';
import { AuditNotFoundError } from './audits';
import { preparationIndex, type PreparationState } from '@/features/audits/preparation';

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Mapea el resultado humano del checklist a un estado de preparación. */
function resultToPreparation(result: string): PreparationState {
  switch (result) {
    case 'conforme':
      return 'preparado';
    case 'parcial':
      return 'parcial';
    case 'verificacion_campo':
    case 'evidencia_insuficiente':
    case 'no_evaluado':
      return 'requiere_revision';
    case 'no_conforme':
      return 'sin_evidencia';
    case 'no_aplica':
      return 'no_aplica';
    default:
      return 'requiere_revision';
  }
}

export async function getPreparationMatrix(organizationId: string, auditId: string) {
  const prisma = getPrisma();
  const audit = await prisma.audit.findFirst({ where: { id: auditId, organizationId } });
  if (!audit) throw new AuditNotFoundError();

  const snapshots = await prisma.auditRequirementSnapshot.findMany({
    where: { auditId, organizationId },
    orderBy: { sequence: 'asc' },
  });
  const items = await prisma.auditChecklistItem.findMany({ where: { auditId, organizationId } });
  const itemBySnapshot = new Map(items.map((i) => [i.snapshotId, i]));
  const evidences = await prisma.auditEvidence.findMany({
    where: { auditId, organizationId },
    select: { checklistItemId: true, documentId: true },
  });
  const evByItem = new Map<string, { total: number; docs: number }>();
  for (const e of evidences) {
    if (!e.checklistItemId) continue;
    const cur = evByItem.get(e.checklistItemId) ?? { total: 0, docs: 0 };
    cur.total += 1;
    if (e.documentId) cur.docs += 1;
    evByItem.set(e.checklistItemId, cur);
  }
  const findings = await prisma.auditFinding.findMany({
    where: { auditId, organizationId, status: { notIn: ['closed', 'effective'] } },
    select: { snapshotId: true },
  });
  const openFindingBySnapshot = new Map<string, number>();
  for (const f of findings) {
    if (f.snapshotId)
      openFindingBySnapshot.set(f.snapshotId, (openFindingBySnapshot.get(f.snapshotId) ?? 0) + 1);
  }

  const rows = snapshots.map((s) => {
    const item = itemBySnapshot.get(s.id);
    const result = item?.result ?? 'no_evaluado';
    const state = resultToPreparation(result);
    const ev = item ? (evByItem.get(item.id) ?? { total: 0, docs: 0 }) : { total: 0, docs: 0 };
    return {
      snapshotId: s.id,
      sectionCode: s.sectionCode,
      requirementCode: s.requirementCode,
      requirementTitle: s.requirementTitle,
      isCritical: s.isCritical,
      expectedEvidence: item?.expectedEvidence ?? null,
      evidenceCount: ev.total,
      documentCount: ev.docs,
      result,
      openFindings: openFindingBySnapshot.get(s.id) ?? 0,
      state,
    };
  });
  const index = preparationIndex(rows.map((r) => ({ state: r.state })));

  return {
    audit: {
      id: audit.id,
      folio: audit.folio,
      title: audit.title,
      normVersionLabel: audit.normVersionLabel,
    },
    rows,
    index,
    gaps: {
      withoutEvidence: rows.filter((r) => r.state === 'sin_evidencia').length,
      needsReview: rows.filter((r) => r.state === 'requiere_revision').length,
      openFindings: rows.reduce((n, r) => n + r.openFindings, 0),
      critical: rows.filter(
        (r) => r.isCritical && r.state !== 'preparado' && r.state !== 'no_aplica',
      ).length,
    },
  };
}

/** Auditorías de preparación con checklist (para la vista de preparación). */
export async function listPreparableAudits(organizationId: string) {
  const prisma = getPrisma();
  const audits = await prisma.audit.findMany({
    where: { organizationId, snapshots: { some: {} } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      folio: true,
      title: true,
      normVersionLabel: true,
      status: true,
      plannedDate: true,
    },
  });
  return audits.map((a) => ({
    id: a.id,
    folio: a.folio,
    title: a.title,
    normVersionLabel: a.normVersionLabel,
    status: a.status,
    plannedDate: isoDate(a.plannedDate),
  }));
}
