/**
 * Semáforo GLOBAL de cumplimiento (PLATFORM-001 §36-42, base de CORE-UX-005).
 *
 * Motor PURO y determinista: dada una métrica donde **mayor = mejor** (cumplimiento,
 * conformidad, avance, efectividad…), resuelve la banda del semáforo según una
 * política configurable por organización. NO persiste ni consulta BD; la persistencia
 * tenant-scoped, la configuración y la migración de componentes son de CORE-UX-005.
 *
 * Importante (§37): este resolver aplica SOLO a métricas «mayor es mejor». Métricas
 * como riesgo, almacenamiento utilizado, % de errores o vencimientos tienen semántica
 * propia y NO deben usar este helper directamente.
 */

import { isHexColor } from '../documents/document-theme';

/** Nivel semántico del semáforo (no depende solo del color, §40). */
export type ComplianceLevel = 'green' | 'yellow' | 'orange' | 'red';

/** Política de umbrales (configurable por organización; el servidor es autoridad, §39). */
export interface CompliancePolicy {
  /** Mínimo para VERDE (incluido). */
  greenMin: number;
  /** Mínimo para AMARILLO (incluido). */
  yellowMin: number;
  /** Mínimo para NARANJA (incluido). Por debajo = ROJO. */
  orangeMin: number;
}

/** Presentación de un nivel: color, etiqueta y texto accesible (§40). */
export interface ComplianceLevelStyle {
  level: ComplianceLevel;
  label: string;
  /** Color por defecto (ajustable por organización en CORE-UX-005). */
  color: string;
  /** Descripción accesible del estado (para lectores de pantalla / aria-label). */
  accessibleText: string;
}

/** Resultado de resolver una métrica contra la política. */
export interface ComplianceBand {
  level: ComplianceLevel;
  label: string;
  color: string;
  accessibleText: string;
  /** Límite inferior de la banda (incluido). */
  min: number;
  /** Límite superior de la banda (excluido, salvo verde que llega a 100 incluido). */
  max: number;
}

/** Umbrales por defecto (§36): 90 / 80 / 70. */
export const DEFAULT_COMPLIANCE_POLICY: CompliancePolicy = {
  greenMin: 90,
  yellowMin: 80,
  orangeMin: 70,
};

/** Estilos por defecto por nivel (§40). Colores y etiquetas ajustables en CORE-UX-005. */
export const DEFAULT_LEVEL_STYLES: Record<ComplianceLevel, ComplianceLevelStyle> = {
  green: {
    level: 'green',
    label: 'Cumplimiento alto',
    color: '#1f9d55',
    accessibleText: 'Cumplimiento alto',
  },
  yellow: {
    level: 'yellow',
    label: 'Cumplimiento aceptable',
    color: '#c9a227',
    accessibleText: 'Cumplimiento aceptable',
  },
  orange: {
    level: 'orange',
    label: 'Cumplimiento bajo',
    color: '#d97706',
    accessibleText: 'Cumplimiento bajo',
  },
  red: {
    level: 'red',
    label: 'Cumplimiento crítico',
    color: '#c0392b',
    accessibleText: 'Cumplimiento crítico',
  },
};

/**
 * Valida una política de umbrales (§39): `100 >= greenMin > yellowMin > orangeMin >= 0`.
 * Devuelve mensajes en español (vacío = válida). El servidor debe llamar esto antes
 * de persistir una política de organización.
 */
export function validateCompliancePolicy(policy: CompliancePolicy): string[] {
  const errors: string[] = [];
  const { greenMin, yellowMin, orangeMin } = policy;
  const finite = [greenMin, yellowMin, orangeMin].every((n) => Number.isFinite(n));
  if (!finite) {
    return ['Los umbrales deben ser números.'];
  }
  if (greenMin > 100) errors.push('El mínimo verde no puede ser mayor que 100.');
  if (orangeMin < 0) errors.push('El mínimo naranja no puede ser menor que 0.');
  if (!(greenMin > yellowMin)) errors.push('El mínimo verde debe ser mayor que el amarillo.');
  if (!(yellowMin > orangeMin)) errors.push('El mínimo amarillo debe ser mayor que el naranja.');
  return errors;
}

/** Acota un valor al rango [0, 100] (defensivo ante entradas fuera de rango). */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Resuelve la banda del semáforo para una métrica «mayor es mejor» (§36/§41).
 * Trabaja con decimales: `value >= greenMin` → verde; `>= yellowMin` → amarillo;
 * `>= orangeMin` → naranja; en otro caso rojo. Política inválida → cae a la default.
 */
export function getComplianceBand(
  value: number,
  policy: CompliancePolicy = DEFAULT_COMPLIANCE_POLICY,
  styles: Record<ComplianceLevel, ComplianceLevelStyle> = DEFAULT_LEVEL_STYLES,
): ComplianceBand {
  const safePolicy = validateCompliancePolicy(policy).length ? DEFAULT_COMPLIANCE_POLICY : policy;
  const v = clampPercent(value);
  let level: ComplianceLevel;
  let min: number;
  let max: number;
  if (v >= safePolicy.greenMin) {
    level = 'green';
    min = safePolicy.greenMin;
    max = 100;
  } else if (v >= safePolicy.yellowMin) {
    level = 'yellow';
    min = safePolicy.yellowMin;
    max = safePolicy.greenMin;
  } else if (v >= safePolicy.orangeMin) {
    level = 'orange';
    min = safePolicy.orangeMin;
    max = safePolicy.yellowMin;
  } else {
    level = 'red';
    min = 0;
    max = safePolicy.orangeMin;
  }
  const style = styles[level];
  return {
    level,
    label: style.label,
    color: style.color,
    accessibleText: style.accessibleText,
    min,
    max,
  };
}

// --- Colores por organización + política resuelta (CORE-UX-005) ---------------

/** Colores por nivel (configurables por organización, §40). Solo HEX seguro. */
export interface ComplianceColors {
  green: string;
  yellow: string;
  orange: string;
  red: string;
}

export const DEFAULT_COMPLIANCE_COLORS: ComplianceColors = {
  green: DEFAULT_LEVEL_STYLES.green.color,
  yellow: DEFAULT_LEVEL_STYLES.yellow.color,
  orange: DEFAULT_LEVEL_STYLES.orange.color,
  red: DEFAULT_LEVEL_STYLES.red.color,
};

/** Política completa por organización: umbrales + colores. */
export interface ResolvedCompliancePolicy extends CompliancePolicy, ComplianceColors {}

export const DEFAULT_RESOLVED_POLICY: ResolvedCompliancePolicy = {
  ...DEFAULT_COMPLIANCE_POLICY,
  ...DEFAULT_COMPLIANCE_COLORS,
};

/** Construye los estilos (label global + color de la organización) desde colores. */
export function stylesFromColors(
  colors: ComplianceColors,
): Record<ComplianceLevel, ComplianceLevelStyle> {
  return {
    green: { ...DEFAULT_LEVEL_STYLES.green, color: colors.green },
    yellow: { ...DEFAULT_LEVEL_STYLES.yellow, color: colors.yellow },
    orange: { ...DEFAULT_LEVEL_STYLES.orange, color: colors.orange },
    red: { ...DEFAULT_LEVEL_STYLES.red, color: colors.red },
  };
}

/** Separa una política resuelta en umbrales y colores. */
export function splitResolvedPolicy(p: ResolvedCompliancePolicy): {
  policy: CompliancePolicy;
  colors: ComplianceColors;
} {
  return {
    policy: { greenMin: p.greenMin, yellowMin: p.yellowMin, orangeMin: p.orangeMin },
    colors: { green: p.green, yellow: p.yellow, orange: p.orange, red: p.red },
  };
}

/**
 * Resuelve la banda usando una política COMPLETA de organización (umbrales + colores).
 * Punto único que consumen los componentes de UI (no repetir `if value >= 90`).
 */
export function resolveComplianceBand(
  value: number,
  resolved: ResolvedCompliancePolicy = DEFAULT_RESOLVED_POLICY,
): ComplianceBand {
  const { policy, colors } = splitResolvedPolicy(resolved);
  return getComplianceBand(value, policy, stylesFromColors(colors));
}

/** Valida los colores (solo HEX seguro, §6/§23). Devuelve mensajes en español. */
export function validateComplianceColors(colors: ComplianceColors): string[] {
  const errors: string[] = [];
  const labels: Record<keyof ComplianceColors, string> = {
    green: 'verde',
    yellow: 'amarillo',
    orange: 'naranja',
    red: 'rojo',
  };
  (Object.keys(labels) as (keyof ComplianceColors)[]).forEach((k) => {
    if (!isHexColor(colors[k])) {
      errors.push(`El color ${labels[k]} debe ser un HEX válido (p. ej. #1f9d55).`);
    }
  });
  return errors;
}

/** Valida una política completa (umbrales + colores). */
export function validateResolvedPolicy(resolved: ResolvedCompliancePolicy): string[] {
  const { policy, colors } = splitResolvedPolicy(resolved);
  return [...validateCompliancePolicy(policy), ...validateComplianceColors(colors)];
}

// --- Semántica de métrica (§10/§37) ------------------------------------------

/**
 * Dirección semántica de una métrica. El semáforo global aplica AUTOMÁTICAMENTE solo
 * a `higher_is_better`. Las métricas `lower_is_better` (riesgo, storage utilizado,
 * % de errores, vencimientos, incidencias, utilización) tienen semántica propia y
 * NO deben colorearse con este resolver.
 */
export type MetricDirection = 'higher_is_better' | 'lower_is_better';

/** Ejemplos de métricas «mayor = mejor» (documentativo). */
export const HIGHER_IS_BETTER_METRICS = [
  'cumplimiento',
  'conformidad',
  'efectividad',
  'implementacion',
  'avance',
] as const;

/** Ejemplos de métricas «mayor = peor» — NO usar el semáforo (documentativo). */
export const INVERSE_METRICS = [
  'riesgo',
  'storage_utilizado',
  'errores',
  'vencimientos',
  'incidencias',
  'utilizacion',
] as const;

/** ¿Debe una métrica usar el semáforo global de cumplimiento? */
export function usesComplianceBand(direction: MetricDirection): boolean {
  return direction === 'higher_is_better';
}
