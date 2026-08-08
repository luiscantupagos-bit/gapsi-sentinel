// CORE-ALIGN-001 — Versionado semántico automático de documentos.
//
// El usuario ya no escribe la etiqueta: elige "cambio menor" o "cambio mayor" y
// el servidor calcula la siguiente versión. Menor incrementa el dígito menor
// (1.0 → 1.1); mayor incrementa el mayor y reinicia el menor (1.0 → 2.0). La
// versión inicial es 1.0. Formato de salida: `vMAYOR.MENOR`.

export type VersionBump = 'minor' | 'major';

/** Extrae (mayor, menor) de una etiqueta como "v1", "v1.2", "2.3" o "1". */
export function parseVersionLabel(label: string | null | undefined): {
  major: number;
  minor: number;
} {
  if (!label) return { major: 1, minor: 0 };
  const m = label.match(/(\d+)(?:\.(\d+))?/);
  if (!m) return { major: 1, minor: 0 };
  const major = Number(m[1]);
  const minor = m[2] !== undefined ? Number(m[2]) : 0;
  if (!Number.isFinite(major)) return { major: 1, minor: 0 };
  return { major, minor: Number.isFinite(minor) ? minor : 0 };
}

/** Calcula la siguiente etiqueta a partir de la actual y el tipo de cambio. */
export function nextVersionLabel(current: string | null | undefined, bump: VersionBump): string {
  const { major, minor } = parseVersionLabel(current);
  if (bump === 'major') return `v${major + 1}.0`;
  return `v${major}.${minor + 1}`;
}

/** Etiqueta inicial de un documento nuevo. */
export const INITIAL_VERSION_LABEL = 'v1.0';

export const VERSION_BUMP_LABEL: Record<VersionBump, string> = {
  minor: 'Cambio menor',
  major: 'Cambio mayor',
};
