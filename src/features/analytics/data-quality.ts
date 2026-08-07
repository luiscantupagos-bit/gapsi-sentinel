// TASK-011 — Calidad de datos (puro). Detecta y REPORTA problemas; NO corrige
// automáticamente. Sirve para que el usuario mejore la captura: campos faltantes,
// eventos sin clasificar, posibles duplicados, completitud y consistencias
// básicas. Todo determinista y explicable.

import type { UnifiedEvent } from './unified-events';

export type DataQualityIssueType =
  | 'missing_field'
  | 'unclassified'
  | 'potential_duplicate'
  | 'inconsistent';

export interface DataQualitySample {
  key: string;
  href: string;
  title: string;
  detail: string;
}

export interface DataQualityIssueGroup {
  type: DataQualityIssueType;
  field: string | null;
  label: string;
  count: number;
  samples: DataQualitySample[];
}

export interface DataQualityReport {
  totalEvents: number;
  /** % promedio de presencia de campos núcleo (null si no hay eventos). */
  completeness: number | null;
  missingByField: Record<string, number>;
  issues: DataQualityIssueGroup[];
}

const CORE_FIELDS: { field: keyof UnifiedEvent; label: string }[] = [
  { field: 'category', label: 'clasificación' },
  { field: 'severity', label: 'severidad' },
  { field: 'area', label: 'área' },
  { field: 'process', label: 'proceso' },
  { field: 'responsibleUserId', label: 'responsable' },
];

const MAX_SAMPLES = 8;

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface DataQualityOptions {
  /** Fecha de referencia (ISO YYYY-MM-DD) para detectar fechas futuras. */
  asOf?: string;
  /** Solo revisar duplicados entre eventos nativos (captura manual). */
  duplicatesNativeOnly?: boolean;
}

/** Genera el reporte de calidad de datos sobre el dataset unificado. */
export function analyzeDataQuality(
  events: UnifiedEvent[],
  options: DataQualityOptions = {},
): DataQualityReport {
  const total = events.length;
  const nativeOnly = options.duplicatesNativeOnly ?? true;

  // --- Campos faltantes + completitud ---
  const missingByField: Record<string, number> = {};
  const missingSamples = new Map<string, DataQualitySample[]>();
  let presenceSum = 0;
  for (const ev of events) {
    let present = 0;
    for (const { field, label } of CORE_FIELDS) {
      if (isMissing(ev[field])) {
        missingByField[label] = (missingByField[label] ?? 0) + 1;
        const arr = missingSamples.get(label) ?? [];
        if (arr.length < MAX_SAMPLES) {
          arr.push({ key: ev.key, href: ev.href, title: ev.title, detail: `Sin ${label}` });
        }
        missingSamples.set(label, arr);
      } else {
        present += 1;
      }
    }
    presenceSum += present / CORE_FIELDS.length;
  }
  const completeness = total === 0 ? null : Math.round((presenceSum / total) * 1000) / 10;

  const issues: DataQualityIssueGroup[] = [];
  for (const { label } of CORE_FIELDS) {
    const count = missingByField[label] ?? 0;
    if (count > 0) {
      issues.push({
        type: 'missing_field',
        field: label,
        label: `Eventos sin ${label}`,
        count,
        samples: missingSamples.get(label) ?? [],
      });
    }
  }

  // --- Sin clasificar (ni categoría ni severidad) ---
  const unclassified = events.filter((ev) => isMissing(ev.category) && isMissing(ev.severity));
  if (unclassified.length > 0) {
    issues.push({
      type: 'unclassified',
      field: null,
      label: 'Eventos sin clasificación ni severidad',
      count: unclassified.length,
      samples: unclassified.slice(0, MAX_SAMPLES).map((ev) => ({
        key: ev.key,
        href: ev.href,
        title: ev.title,
        detail: 'Sin categoría ni severidad',
      })),
    });
  }

  // --- Posibles duplicados (título + fecha + área) ---
  const dupPool = nativeOnly ? events.filter((ev) => ev.source === 'quality_event') : events;
  const groups = new Map<string, UnifiedEvent[]>();
  for (const ev of dupPool) {
    const k = `${normalizeTitle(ev.title)}¦${ev.eventDate}¦${ev.area ?? ''}`;
    const arr = groups.get(k) ?? [];
    arr.push(ev);
    groups.set(k, arr);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  if (dupGroups.length > 0) {
    const dupCount = dupGroups.reduce((acc, g) => acc + g.length, 0);
    issues.push({
      type: 'potential_duplicate',
      field: null,
      label: 'Posibles duplicados (mismo título, fecha y área)',
      count: dupCount,
      samples: dupGroups.slice(0, MAX_SAMPLES).map((g) => ({
        key: g[0]!.key,
        href: g[0]!.href,
        title: g[0]!.title,
        detail: `${g.length} registros con el mismo título/fecha/área`,
      })),
    });
  }

  // --- Inconsistencias ---
  const inconsistent: DataQualitySample[] = [];
  for (const ev of events) {
    if (ev.status === 'closed' && isMissing(ev.closedAt) && !isMissing(ev.dueDate)) {
      inconsistent.push({
        key: ev.key,
        href: ev.href,
        title: ev.title,
        detail: 'Cerrado sin fecha de cierre',
      });
    } else if (ev.dueDate && ev.eventDate && ev.dueDate < ev.eventDate) {
      inconsistent.push({
        key: ev.key,
        href: ev.href,
        title: ev.title,
        detail: 'Fecha compromiso anterior a la fecha del evento',
      });
    } else if (options.asOf && ev.eventDate > options.asOf) {
      inconsistent.push({
        key: ev.key,
        href: ev.href,
        title: ev.title,
        detail: 'Fecha del evento en el futuro',
      });
    }
  }
  if (inconsistent.length > 0) {
    issues.push({
      type: 'inconsistent',
      field: null,
      label: 'Inconsistencias de fechas/estado',
      count: inconsistent.length,
      samples: inconsistent.slice(0, MAX_SAMPLES),
    });
  }

  return { totalEvents: total, completeness, missingByField, issues };
}
