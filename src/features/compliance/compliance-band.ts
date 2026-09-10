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
