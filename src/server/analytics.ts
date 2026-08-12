// TASK-011 — Data layer de analítica (servidor).
//
// Consulta EN VIVO las fuentes de eventos (nativos + módulos) bajo el contexto de
// organización (RLS) y arma el dataset unificado con `buildUnifiedDataset`. No
// materializa ni copia datos: cada consulta lee la fuente de verdad original.
// Todo el cálculo estadístico y de KPI ocurre en servidor sobre este dataset.

import type { Prisma } from '@prisma/client';
import { withOrgContext } from './db';
import {
  buildUnifiedDataset,
  type AnalysisRow,
  type CapaActionRow,
  type CapaRow,
  type FindingRow,
  type FmeaRowRow,
  type NativeEventRow,
  type ProjectRow,
  type TaskRow,
  type UnifiedEvent,
} from '@/features/analytics/unified-events';

/** Consulta todas las fuentes bajo una transacción RLS y devuelve el dataset. */
export async function loadUnifiedEvents(organizationId: string): Promise<UnifiedEvent[]> {
  return withOrgContext(organizationId, (tx) => loadUnifiedEventsTx(tx, organizationId));
}

/**
 * Variante para reutilizar una transacción existente (p. ej. en pruebas). Filtra
 * por `organizationId` de forma EXPLÍCITA además de la RLS (defensa en
 * profundidad: correcto aun si la conexión omite RLS, como el rol propietario).
 */
export async function loadUnifiedEventsTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<UnifiedEvent[]> {
  const [
    nativeRows,
    capaRows,
    capaActionRows,
    findingRows,
    taskRows,
    projectRows,
    fmeaRows,
    analysisRows,
  ] = await Promise.all([
    tx.qualityEvent.findMany({
      where: { organizationId },
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
      },
    }),
    tx.capa.findMany({ where: { organizationId, deletedAt: null } }),
    tx.capaAction.findMany({ where: { organizationId } }),
    tx.auditFinding.findMany({ where: { organizationId } }),
    tx.task.findMany({ where: { organizationId } }),
    tx.project.findMany({ where: { organizationId } }),
    tx.fmeaRow.findMany({ where: { organizationId } }),
    tx.qualityAnalysis.findMany({ where: { organizationId, deletedAt: null } }),
  ]);

  // Mapa analysisId -> capaId para localizar el CAPA de cada renglón AMEF.
  // Solo análisis vinculados a una CAPA (los independientes no son eventos CAPA).
  const analysisToCapa = new Map<string, string>();
  for (const a of analysisRows) if (a.capaId) analysisToCapa.set(a.id, a.capaId);

  const native: NativeEventRow[] = nativeRows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    eventDate: r.eventDate,
    eventType: r.eventType,
    categoryName: r.category?.name ?? null,
    subcategoryName: r.subcategory?.name ?? null,
    title: r.title,
    status: r.status,
    severity: r.severity,
    area: r.area,
    process: r.process,
    productText: r.productText,
    machineText: r.machineText,
    shiftText: r.shiftText,
    supplierText: r.supplierText,
    responsibleUserId: r.responsibleUserId,
    quantityAffected: r.quantityAffected,
    unitsProduced: r.unitsProduced,
    cost: r.cost,
    durationHours: r.durationHours,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    detectedAt: null,
    createdAt: r.createdAt,
  }));

  const capas: CapaRow[] = capaRows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    title: r.title,
    status: r.status,
    severity: r.severity,
    sourceType: r.sourceType,
    area: r.area,
    process: r.process,
    product: r.product,
    responsibleUserId: r.responsibleUserId,
    detectedAt: r.detectedAt,
    targetDate: r.targetDate,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  }));

  const capaActions: CapaActionRow[] = capaActionRows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    capaId: r.capaId,
    description: r.description,
    status: r.status,
    priority: r.priority,
    responsibleUserId: r.responsibleUserId,
    startDate: r.startDate,
    dueDate: r.dueDate,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  }));

  const findings: FindingRow[] = findingRows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    auditId: r.auditId,
    folio: r.folio,
    title: r.title,
    process: r.process,
    classification: r.classification,
    severity: r.severity,
    status: r.status,
    responsibleUserId: r.responsibleUserId,
    detectedAt: r.detectedAt,
    committedDate: r.committedDate,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  }));

  const tasks: TaskRow[] = taskRows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    title: r.title,
    taskType: r.taskType,
    status: r.status,
    priority: r.priority,
    responsibleUserId: r.responsibleUserId,
    startDate: r.startDate,
    targetDate: r.targetDate,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  }));

  const projects: ProjectRow[] = projectRows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    folio: r.folio,
    name: r.name,
    status: r.status,
    priority: r.priority,
    responsibleUserId: r.responsibleUserId,
    actualCost: r.actualCost,
    startDate: r.startDate,
    targetDate: r.targetDate,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  }));

  const fmea: FmeaRowRow[] = fmeaRows
    .filter((r) => analysisToCapa.has(r.analysisId))
    .map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      analysisId: r.analysisId,
      capaId: analysisToCapa.get(r.analysisId)!,
      requirement: r.requirement,
      effect: r.effect,
      status: r.status,
      actionPriority: r.actionPriority,
      npr: r.npr,
      responsibleUserId: r.responsibleUserId,
      dueDate: r.dueDate,
      createdAt: r.createdAt,
    }));

  const analyses: AnalysisRow[] = analysisRows
    .filter((r): r is typeof r & { capaId: string } => r.capaId !== null)
    .map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      capaId: r.capaId,
      type: r.type,
      title: r.title,
      status: r.status,
      responsibleUserId: r.responsibleUserId,
      startedAt: r.startedAt,
      approvedAt: r.approvedAt,
      createdAt: r.createdAt,
    }));

  return buildUnifiedDataset({
    native,
    capas,
    capaActions,
    findings,
    tasks,
    projects,
    fmeaRows: fmea,
    analyses,
  });
}
