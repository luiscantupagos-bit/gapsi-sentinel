// TASK-011 — Motor de alertas internas (puro, determinista, sin IA).
//
// Evalúa reglas configurables sobre el dataset unificado y los motores de KPI/
// tendencia/calidad. Cada alerta lleva una `dedupeKey` estable para que reejecutar
// la evaluación NO cree duplicados (la BD tiene unique por organización+dedupeKey).
// Las alertas señalan condiciones que ameritan revisión humana; nunca afirman
// causa ni ejecutan acciones automáticas.

import {
  computeKpi,
  applyFilter,
  type EventFilter,
  type KpiConfig,
  type DimensionField,
} from './kpi-engine';
import { computeTrend } from './pareto-trends';
import { analyzeDataQuality } from './data-quality';
import type { UnifiedEvent } from './unified-events';

export type AlertRuleType =
  | 'kpi_off_target'
  | 'kpi_increase'
  | 'category_threshold'
  | 'recurrence'
  | 'missing_data'
  | 'negative_trend';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  kpiId?: string | null;
  /** Configuración específica del tipo de regla. */
  config: AlertRuleConfig;
}

export interface AlertRuleConfig {
  kpiConfig?: KpiConfig;
  kpiName?: string;
  kpiHref?: string;
  dimension?: DimensionField;
  filter?: EventFilter;
  threshold?: number;
  minOccurrences?: number;
  percentIncrease?: number;
  minCompleteness?: number;
  maxUnclassified?: number;
}

export interface GeneratedAlert {
  ruleId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  kpiId: string | null;
  entityRef: string | null;
  href: string | null;
  dedupeKey: string;
}

function dimValue(ev: UnifiedEvent, field: DimensionField): string {
  const v = ev[field];
  return v === null || v === undefined || v === '' ? 'Sin clasificar' : String(v);
}

export interface AlertContext {
  events: UnifiedEvent[];
  asOf?: string;
}

/** Evalúa una regla y devuelve las alertas que dispara (0..n). */
export function evaluateRule(rule: AlertRule, ctx: AlertContext): GeneratedAlert[] {
  switch (rule.ruleType) {
    case 'kpi_off_target':
      return evalKpiOffTarget(rule, ctx);
    case 'kpi_increase':
    case 'negative_trend':
      return evalTrend(rule, ctx);
    case 'category_threshold':
    case 'recurrence':
      return evalDimensionCount(rule, ctx);
    case 'missing_data':
      return evalMissingData(rule, ctx);
    default:
      return [];
  }
}

/** Evalúa todas las reglas activas y concatena sus alertas. */
export function generateAlerts(rules: AlertRule[], ctx: AlertContext): GeneratedAlert[] {
  return rules.flatMap((r) => evaluateRule(r, ctx));
}

function evalKpiOffTarget(rule: AlertRule, ctx: AlertContext): GeneratedAlert[] {
  const cfg = rule.config.kpiConfig;
  if (!cfg) return [];
  const kpi = computeKpi(ctx.events, cfg);
  if (kpi.overall.status !== 'off_target') return [];
  const name = rule.config.kpiName ?? 'KPI';
  return [
    {
      ruleId: rule.id,
      title: `${name} fuera de meta`,
      message: `El indicador "${name}" está fuera de meta (valor ${kpi.overall.value ?? 's/d'}, meta ${cfg.target ?? 's/d'}). Se recomienda revisión.`,
      severity: rule.severity,
      kpiId: rule.kpiId ?? null,
      entityRef: null,
      href: rule.config.kpiHref ?? null,
      dedupeKey: `${rule.id}:overall`,
    },
  ];
}

function evalTrend(rule: AlertRule, ctx: AlertContext): GeneratedAlert[] {
  const cfg = rule.config.kpiConfig;
  if (!cfg) return [];
  const trend = computeTrend(ctx.events, cfg);
  if (trend.direction === 'insufficient' || trend.percentChange === null) return [];
  const name = rule.config.kpiName ?? 'KPI';
  const lastLabel = trend.points[trend.points.length - 1]?.label ?? 'periodo';

  if (rule.ruleType === 'kpi_increase') {
    const threshold = rule.config.percentIncrease ?? 20;
    if (trend.percentChange < threshold) return [];
    return [
      {
        ruleId: rule.id,
        title: `${name}: incremento ${trend.percentChange}%`,
        message: `"${name}" aumentó ${trend.percentChange}% (de ${trend.first} a ${trend.last}). Se recomienda investigar el origen; la tendencia no implica causa.`,
        severity: rule.severity,
        kpiId: rule.kpiId ?? null,
        entityRef: null,
        href: rule.config.kpiHref ?? null,
        dedupeKey: `${rule.id}:${lastLabel}`,
      },
    ];
  }

  // negative_trend: dirección desfavorable según dirección deseada del KPI.
  const dir = cfg.desiredDirection ?? 'lower';
  const unfavorable =
    (dir === 'lower' && trend.direction === 'increasing') ||
    (dir === 'higher' && trend.direction === 'decreasing');
  if (!unfavorable) return [];
  return [
    {
      ruleId: rule.id,
      title: `${name}: tendencia desfavorable`,
      message: `"${name}" muestra una tendencia ${trend.direction === 'increasing' ? 'creciente' : 'decreciente'} desfavorable (${trend.percentChange}%). Se recomienda revisión.`,
      severity: rule.severity,
      kpiId: rule.kpiId ?? null,
      entityRef: null,
      href: rule.config.kpiHref ?? null,
      dedupeKey: `${rule.id}:${lastLabel}`,
    },
  ];
}

function evalDimensionCount(rule: AlertRule, ctx: AlertContext): GeneratedAlert[] {
  const dimension = rule.config.dimension ?? 'process';
  const threshold =
    rule.ruleType === 'recurrence'
      ? (rule.config.minOccurrences ?? 3)
      : (rule.config.threshold ?? 5);
  const events = applyFilter(ctx.events, rule.config.filter);
  const counts = new Map<string, number>();
  for (const ev of events) {
    const k = dimValue(ev, dimension);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const alerts: GeneratedAlert[] = [];
  for (const [value, count] of counts) {
    if (count < threshold) continue;
    const verb = rule.ruleType === 'recurrence' ? 'se repite' : 'supera el umbral';
    alerts.push({
      ruleId: rule.id,
      title: `${rule.name}: ${value} (${count})`,
      message:
        `Los registros asociados a "${value}" presentan mayor frecuencia (${count} eventos; ${verb} de ${threshold}). ` +
        'Se requiere investigación adicional antes de establecer causalidad.',
      severity: rule.severity,
      kpiId: rule.kpiId ?? null,
      entityRef: value,
      href: null,
      dedupeKey: `${rule.id}:${dimension}:${value}`,
    });
  }
  return alerts.sort((a, b) => a.dedupeKey.localeCompare(b.dedupeKey));
}

function evalMissingData(rule: AlertRule, ctx: AlertContext): GeneratedAlert[] {
  const report = analyzeDataQuality(ctx.events, { asOf: ctx.asOf });
  const minCompleteness = rule.config.minCompleteness ?? 70;
  const maxUnclassified = rule.config.maxUnclassified ?? 0;
  const unclassified = report.issues.find((i) => i.type === 'unclassified')?.count ?? 0;
  const alerts: GeneratedAlert[] = [];
  if (report.completeness !== null && report.completeness < minCompleteness) {
    alerts.push({
      ruleId: rule.id,
      title: 'Completitud de datos baja',
      message: `La completitud de los eventos es ${report.completeness}% (mínimo esperado ${minCompleteness}%). Mejore la captura para análisis más confiables.`,
      severity: rule.severity,
      kpiId: null,
      entityRef: null,
      href: '/dashboard/analytics',
      dedupeKey: `${rule.id}:completeness`,
    });
  }
  if (unclassified > maxUnclassified) {
    alerts.push({
      ruleId: rule.id,
      title: `Eventos sin clasificar (${unclassified})`,
      message: `Hay ${unclassified} eventos sin categoría ni severidad. Clasifíquelos para no sesgar los análisis.`,
      severity: rule.severity,
      kpiId: null,
      entityRef: null,
      href: '/dashboard/analytics',
      dedupeKey: `${rule.id}:unclassified`,
    });
  }
  return alerts;
}
