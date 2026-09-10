/**
 * Geometría del gauge semicircular «Estado del sistema» (UI-FIX). PURO y
 * determinista: dado un porcentaje, produce el path del arco de fondo (semicírculo
 * superior completo) y el del progreso. El `viewBox` es fijo, de modo que el render
 * no depende del ancho en píxeles.
 *
 * Nota clave del bug corregido: el arco de progreso de un semicírculo (gauge) nunca
 * supera 180°, por lo que el `large-arc-flag` es **siempre 0**. Usar `1` para
 * porcentajes > 50 hacía que el arco tomara el camino largo (por debajo del centro),
 * saliéndose del semicírculo y quedando recortado por el `viewBox`.
 */
export const GAUGE = {
  cx: 90,
  cy: 90,
  r: 72,
  strokeWidth: 14,
  /** viewBox estable: semicírculo superior (alto = r + strokeWidth/2 + margen). */
  viewBox: '0 0 180 108',
} as const;

/** Acota el porcentaje a [0, 100]; NaN/Infinity → 0 (fallback seguro, §6). */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Punto sobre el círculo para un ángulo en grados (0° = derecha, 180° = izquierda). */
function polar(deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [GAUGE.cx + GAUGE.r * Math.cos(a), GAUGE.cy - GAUGE.r * Math.sin(a)];
}

export interface GaugeArc {
  /** Porcentaje ya acotado (0..100). */
  clamped: number;
  /** Path del arco de fondo (semicírculo superior completo). */
  track: string;
  /** Path del arco de progreso, o `null` cuando es 0% (evita un punto suelto). */
  progress: string | null;
}

/**
 * Calcula los paths del gauge para `value`. `large-arc-flag = 0` siempre (el arco
 * es ≤ 180°); `sweep-flag = 1` traza el semicírculo SUPERIOR de izquierda a derecha.
 */
export function gaugeArc(value: number): GaugeArc {
  const v = clampPercent(value);
  const [sx, sy] = polar(180); // inicio: izquierda
  const [ex, ey] = polar(0); // fin: derecha
  const [vx, vy] = polar(180 - (v / 100) * 180); // fin del progreso
  const track = `M ${sx} ${sy} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${ex} ${ey}`;
  const progress = v > 0 ? `M ${sx} ${sy} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${vx} ${vy}` : null;
  return { clamped: v, track, progress };
}
