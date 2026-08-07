// TASK-011 — Servidor de alertas internas.
//
// Deriva reglas automáticas de los KPI activos (fuera de meta y tendencia
// desfavorable) más una regla de calidad de datos, evalúa reglas persistidas y
// GUARDA las alertas deduplicadas por (organización, dedupe_key). Reejecutar no
// crea duplicados. Sin IA ni acciones automáticas: solo señala para revisión.

import type { Prisma } from '@prisma/client';
import { getPrisma, withOrgContext } from './db';
import { loadUnifiedEventsTx } from './analytics';
import { buildKpiConfig } from './kpis';
import { generateAlerts, type AlertRule, type AlertSeverity } from '@/features/analytics/alerts';

export class AlertError extends Error {}

function toAlertRulesFromKpis(
  defs: Prisma.KpiDefinitionGetPayload<Record<string, never>>[],
): AlertRule[] {
  const rules: AlertRule[] = [];
  for (const def of defs) {
    if (def.target === null) continue; // sin meta no se puede evaluar desviación
    const kpiConfig = buildKpiConfig(def);
    const common = { kpiName: def.name, kpiHref: `/dashboard/kpis/${def.id}`, kpiConfig };
    rules.push({
      id: `kpi-offtarget-${def.id}`,
      name: `${def.name} fuera de meta`,
      ruleType: 'kpi_off_target',
      severity: 'warning',
      kpiId: def.id,
      config: common,
    });
    rules.push({
      id: `kpi-trend-${def.id}`,
      name: `${def.name} tendencia`,
      ruleType: 'negative_trend',
      severity: 'info',
      kpiId: def.id,
      config: common,
    });
  }
  return rules;
}

function toAlertRuleFromRow(
  row: Prisma.QualityAlertRuleGetPayload<Record<string, never>>,
): AlertRule | null {
  const cfg = row.config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return null;
  return {
    id: row.id,
    name: row.name,
    ruleType: row.ruleType as AlertRule['ruleType'],
    severity: row.severity as AlertSeverity,
    kpiId: row.kpiId,
    config: cfg as AlertRule['config'],
  };
}

/** Evalúa reglas (derivadas + persistidas) y guarda las alertas deduplicadas. */
export async function evaluateAndPersistAlerts(organizationId: string): Promise<number> {
  return withOrgContext(organizationId, async (tx) => {
    const events = await loadUnifiedEventsTx(tx);
    const [kpiDefs, ruleRows] = await Promise.all([
      tx.kpiDefinition.findMany({ where: { organizationId, status: 'active' } }),
      tx.qualityAlertRule.findMany({ where: { organizationId, active: true } }),
    ]);
    const rules: AlertRule[] = [
      ...toAlertRulesFromKpis(kpiDefs),
      ...ruleRows.map(toAlertRuleFromRow).filter((r): r is AlertRule => r !== null),
    ];
    const alerts = generateAlerts(rules, { events });

    let persisted = 0;
    for (const a of alerts) {
      const existing = await tx.qualityAlert.findFirst({
        where: { organizationId, dedupeKey: a.dedupeKey },
        select: { id: true },
      });
      if (existing) {
        // Actualiza contenido pero conserva el estado (no reabrir lo resuelto).
        await tx.qualityAlert.update({
          where: { id: existing.id },
          data: {
            title: a.title,
            message: a.message,
            severity: a.severity,
            detectedAt: new Date(),
          },
        });
      } else {
        await tx.qualityAlert.create({
          data: {
            organizationId,
            ruleId: ruleRows.some((r) => r.id === a.ruleId) ? a.ruleId : null,
            title: a.title,
            message: a.message,
            severity: a.severity,
            status: 'open',
            kpiId: a.kpiId,
            entityRef: a.entityRef,
            href: a.href,
            dedupeKey: a.dedupeKey,
          },
        });
        persisted += 1;
      }
    }
    return persisted;
  });
}

export async function listAlerts(organizationId: string, status?: string) {
  return getPrisma().qualityAlert.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { detectedAt: 'desc' }],
    take: 200,
  });
}

export async function getOpenAlertSummary(organizationId: string) {
  const rows = await getPrisma().qualityAlert.groupBy({
    by: ['severity'],
    where: { organizationId, status: 'open' },
    _count: { _all: true },
  });
  const bySeverity: Record<string, number> = { info: 0, warning: 0, critical: 0 };
  let total = 0;
  for (const r of rows) {
    bySeverity[r.severity] = r._count._all;
    total += r._count._all;
  }
  return { total, bySeverity };
}

export async function resolveAlert(
  organizationId: string,
  actorId: string,
  alertId: string,
): Promise<void> {
  await withOrgContext(organizationId, async (tx) => {
    await tx.qualityAlert.updateMany({
      where: { id: alertId, organizationId },
      data: { status: 'resolved', resolvedBy: actorId, resolvedAt: new Date() },
    });
  });
}
