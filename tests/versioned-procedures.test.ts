/**
 * SEED / DEMO documental — invariantes de los 3 procedimientos versionados
 * (PR-CA-002/003/004) y su versionado formal 1.0/2.0/3.0. Prueba PURA de los datos
 * semilla (`prisma/versioned-procedures.ts`): no requiere base de datos. La herencia
 * y la inmutabilidad a nivel de fila `documentVersion` en BD las cubre además
 * `tests/db/document-version-clone.test.ts` (motor `createVersion`).
 */
import { describe, expect, it } from 'vitest';
import {
  VERSIONED_PROCEDURES,
  addYear,
  seqFromCode,
  type VersionedProcSeed,
  type ProcContent,
} from '../prisma/versioned-procedures';

const byCode = (code: string): VersionedProcSeed => {
  const d = VERSIONED_PROCEDURES.find((x) => x.code === code);
  if (!d) throw new Error(`Falta el procedimiento ${code}`);
  return d;
};
const labels = (d: VersionedProcSeed): string[] => d.versions.map((v) => v.label);
const actNames = (c: ProcContent): string[] => c.repeatables.activities.map((a) => a.nombre);
const respNames = (c: ProcContent): string[] =>
  c.repeatables.responsibilities.map((r) => r.responsable);

const ELAB = 'PR-CA-002';
const MP = 'PR-CA-003';
const PROV = 'PR-CA-004';

describe('SEED procedimientos versionados — invariantes', () => {
  it('A. crea exactamente 3 procedimientos con códigos únicos y consecutivos', () => {
    expect(VERSIONED_PROCEDURES).toHaveLength(3);
    const codes = VERSIONED_PROCEDURES.map((d) => d.code);
    expect(codes).toEqual([ELAB, MP, PROV]);
    expect(new Set(codes).size).toBe(3);
  });

  it('B/K. todos son estructurados y ninguna versión está vacía', () => {
    for (const d of VERSIONED_PROCEDURES) {
      for (const v of d.versions) {
        expect(v.content.fields.objetivo.trim().length).toBeGreaterThan(20);
        expect(v.content.fields.alcance.trim().length).toBeGreaterThan(20);
        expect(v.content.repeatables.responsibilities.length).toBeGreaterThanOrEqual(4);
        expect(v.content.repeatables.activities.length).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('C. cada documento tiene una v1.0 como primera versión', () => {
    for (const d of VERSIONED_PROCEDURES) {
      expect(d.versions[0]?.label).toBe('v1.0');
      expect(d.versions[0]?.changeNotes).toBe('Documento nuevo.');
    }
  });

  it('D. Materias primas tiene v2.0 y es la vigente', () => {
    const d = byCode(MP);
    expect(labels(d)).toEqual(['v1.0', 'v2.0']);
    const vigente = d.versions.at(-1)!;
    expect(vigente.label).toBe('v2.0');
    expect(vigente.status).toBe('published');
    expect(d.versions[0]?.status).toBe('obsolete');
  });

  it('E. Proveedores tiene v1.0/v2.0/v3.0 y v3.0 es la vigente', () => {
    const d = byCode(PROV);
    expect(labels(d)).toEqual(['v1.0', 'v2.0', 'v3.0']);
    expect(d.versions.at(-1)!.label).toBe('v3.0');
    expect(d.versions.at(-1)!.status).toBe('published');
    expect(d.versions.slice(0, -1).every((v) => v.status === 'obsolete')).toBe(true);
  });

  it('F/L. el histórico es ordenado y anterior; una sola versión vigente por documento', () => {
    for (const d of VERSIONED_PROCEDURES) {
      // exactamente una vigente (published + última).
      const published = d.versions.filter((v) => v.status === 'published');
      expect(published).toHaveLength(1);
      expect(published[0]).toBe(d.versions.at(-1));
      // fechas ascendentes (histórico ordenado).
      const dates = d.versions.map((v) => Date.parse(v.issuedAt));
      const sorted = [...dates].sort((a, b) => a - b);
      expect(dates).toEqual(sorted);
    }
  });

  it('G. control de cambios: v1.0 «Documento nuevo»; versiones mayores con nota real', () => {
    for (const d of VERSIONED_PROCEDURES) {
      for (const v of d.versions) {
        expect(v.changeNotes.trim().length).toBeGreaterThan(0);
        if (v.label !== 'v1.0') {
          expect(v.changeNotes).not.toBe('Documento nuevo.');
          expect(v.changeNotes.length).toBeGreaterThan(20);
        }
      }
    }
  });

  it('H/I. etiquetas válidas, únicas y de tipo mayor (x.0) ascendentes', () => {
    for (const d of VERSIONED_PROCEDURES) {
      const ls = labels(d);
      expect(new Set(ls).size).toBe(ls.length); // únicas
      const majors = ls.map((l) => {
        expect(l).toMatch(/^v\d+\.0$/); // I. cambio mayor => x.0
        return Number(l.slice(1, -2));
      });
      for (let i = 1; i < majors.length; i += 1) {
        expect(majors[i]).toBe(majors[i - 1]! + 1); // 1 → 2 → 3
      }
    }
  });

  it('J. contenido heredado: cada versión mayor contiene todo lo de la anterior y agrega', () => {
    for (const d of VERSIONED_PROCEDURES) {
      for (let i = 1; i < d.versions.length; i += 1) {
        const prev = d.versions[i - 1]!.content;
        const curr = d.versions[i]!.content;
        // objetivo heredado; alcance conserva el texto anterior (append-only).
        expect(curr.fields.objetivo).toContain(prev.fields.objetivo);
        expect(curr.fields.alcance.startsWith(prev.fields.alcance)).toBe(true);
        // actividades y responsabilidades: superconjunto estricto (no se pierde nada).
        expect(actNames(curr)).toEqual(expect.arrayContaining(actNames(prev)));
        expect(respNames(curr)).toEqual(expect.arrayContaining(respNames(prev)));
        expect(curr.repeatables.activities.length).toBeGreaterThan(
          prev.repeatables.activities.length,
        );
      }
    }
  });

  it('Elaboración de documentos: explica menor (x.y) vs. mayor (x.0) con tabla comparativa', () => {
    const d = byCode(ELAB);
    expect(labels(d)).toEqual(['v1.0']);
    const names = actNames(d.versions[0]!.content).join(' | ');
    expect(names).toContain('Regla de versión menor');
    expect(names).toContain('Regla de versión mayor');
    expect(names).toContain('Tabla comparativa de versionado');
    const tabla = d.versions[0]!.content.repeatables.activities.find(
      (a) => a.nombre === 'Tabla comparativa de versionado',
    )!;
    expect(tabla.descripcion).toContain('1.0 → 1.1');
    expect(tabla.descripcion).toContain('1.3 → 2.0');
    expect(tabla.descripcion).toContain('3.0 → 4.0');
  });

  it('helpers: addYear y seqFromCode', () => {
    expect(addYear('2026-05-01')).toBe('2027-05-01');
    expect(seqFromCode('PR-CA-004')).toBe(4);
    expect(seqFromCode('PR-CA-002')).toBe(2);
  });
});
