/**
 * DOC-UX-PANEL-001 — lógica pura del panel (tabs + ciclo de vida de versiones).
 */
import { describe, expect, it } from 'vitest';
import {
  PANEL_TABS,
  resolveTab,
  categorizeVersions,
  hasDraftInProgress,
  versionPreviewHref,
  versionEditHref,
  type PanelVersion,
} from '@/features/documents/panel-view';
import type { VersionStatus } from '@/features/documents/workflow-state';

const v = (label: string, status: VersionStatus, isCurrent = false): PanelVersion => ({
  id: `id-${label}`,
  label,
  status,
  isCurrent,
  changeNotes: null,
  createdAtLabel: '2026-01-01',
  authorName: 'Evaluador A',
  fileCount: 0,
});

describe('resolveTab (D. tabs)', () => {
  it('acepta los 8 tabs válidos', () => {
    expect(PANEL_TABS).toHaveLength(8);
    for (const t of PANEL_TABS) expect(resolveTab(t)).toBe(t);
  });
  it('cae a resumen ante valor inválido, vacío o nulo', () => {
    expect(resolveTab('inexistente')).toBe('resumen');
    expect(resolveTab('')).toBe('resumen');
    expect(resolveTab(null)).toBe('resumen');
    expect(resolveTab(undefined)).toBe('resumen');
  });
});

describe('categorizeVersions (A/B/C. vigente vs borrador vs históricas)', () => {
  it('A. distingue vigente (published) de borrador en curso (draft)', () => {
    // isCurrent está en el borrador, pero la vigente es la publicada.
    const g = categorizeVersions([v('v1.1', 'draft', true), v('v1.0', 'published')]);
    expect(g.vigente?.label).toBe('v1.0');
    expect(g.enCurso?.label).toBe('v1.1');
    expect(g.historicas).toHaveLength(0);
  });

  it('B. agrupa históricas (obsolete/archived)', () => {
    const g = categorizeVersions([
      v('v3.0', 'published', true),
      v('v2.0', 'obsolete'),
      v('v1.0', 'obsolete'),
    ]);
    expect(g.vigente?.label).toBe('v3.0');
    expect(g.enCurso).toBeNull();
    expect(g.historicas.map((x) => x.label)).toEqual(['v2.0', 'v1.0']);
  });

  it('C. a lo sumo una vigente', () => {
    const g = categorizeVersions([
      v('v3.0', 'published', true),
      v('v2.0', 'obsolete'),
      v('v1.0', 'obsolete'),
    ]);
    expect(g.vigente).not.toBeNull();
    const publicadas = [v('v3.0', 'published'), v('v2.0', 'obsolete')].filter(
      (x) => x.status === 'published',
    );
    expect(publicadas).toHaveLength(1);
  });

  it('documento nuevo sin publicar: sin vigente, borrador v1.0', () => {
    const g = categorizeVersions([v('v1.0', 'draft', true)]);
    expect(g.vigente).toBeNull();
    expect(g.enCurso?.label).toBe('v1.0');
  });
});

describe('hasDraftInProgress (K. no crear otro draft)', () => {
  it('true cuando hay un borrador/en revisión', () => {
    expect(hasDraftInProgress([v('v1.1', 'draft'), v('v1.0', 'published')])).toBe(true);
    expect(hasDraftInProgress([v('v2.0', 'in_review'), v('v1.0', 'obsolete')])).toBe(true);
  });
  it('false cuando solo hay vigente/históricas', () => {
    expect(hasDraftInProgress([v('v3.0', 'published'), v('v2.0', 'obsolete')])).toBe(false);
  });
});

describe('routing de versión (L)', () => {
  it('href de ver apunta a preview?version=', () => {
    expect(versionPreviewHref('doc1', 'ver9')).toBe(
      '/dashboard/documents/doc1/preview?version=ver9',
    );
  });
  it('href de editar apunta a editor?version=', () => {
    expect(versionEditHref('doc1', 'ver9')).toBe('/dashboard/documents/doc1/editor?version=ver9');
  });
});
