/**
 * HACCP-001 — UI (aserciones de fuente, misma convención que doc-output-ui). §59.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { NAV_ITEMS } from '@/app/dashboard/_components/nav-config';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const index = read('../src/app/dashboard/haccp/page.tsx');
const wizard = read('../src/app/dashboard/haccp/new/NewPlanForm.tsx');
const workspace = read('../src/app/dashboard/haccp/[planId]/_components/HaccpWorkspace.tsx');

describe('§1 navegación', () => {
  it('HACCP aparece en el menú de Cumplimiento', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toContain('/dashboard/haccp');
  });
});

describe('§31 índice', () => {
  it('lista planes con CTA «Nuevo Plan HACCP» y columnas clave', () => {
    expect(index).toContain('Nuevo Plan HACCP');
    expect(index).toContain('Versión vigente');
    expect(index).toContain('Estado');
    expect(index).toContain('Responsable');
    expect(index).toContain('HACCP_PLAN_STATUS_LABEL');
  });
});

describe('§32 asistente de creación', () => {
  it('captura nombre (requerido), alcance, producto/proceso, sitio, responsable', () => {
    expect(wizard).toContain('name="title"');
    expect(wizard).toContain('required');
    expect(wizard).toContain('name="scope"');
    expect(wizard).toContain('name="productProcess"');
    expect(wizard).toContain('name="siteId"');
    expect(wizard).toContain('name="responsibleUserId"');
    expect(wizard).toContain('createPlanAction');
  });
});

describe('§33-41 workspace', () => {
  it('6 tabs ARIA + fases futuras «Próximamente»', () => {
    expect(workspace).toContain('role="tablist"');
    expect(workspace).toContain('HACCP_TABS.map');
    expect(workspace).toContain('HACCP_FUTURE_TABS.map');
    expect(workspace).toContain('Próximamente');
  });
  it('§34 solo el borrador es editable (canEdit + active.editable)', () => {
    expect(workspace).toContain('canEdit');
    expect(workspace).toContain('active?.editable');
  });
  it('§29 equipo: interno/externo + líder + agregar/quitar', () => {
    expect(workspace).toContain('addTeamMemberAction');
    expect(workspace).toContain('removeTeamMemberAction');
    expect(workspace).toContain('Es líder HACCP');
    expect(workspace).toContain('Externa');
  });
  it('§31 fuentes: agregar/quitar + «Usar versión más reciente» ante actualización', () => {
    expect(workspace).toContain('addSourceAction');
    expect(workspace).toContain('removeSourceAction');
    expect(workspace).toContain('updateSourceToLatestAction');
    expect(workspace).toContain('Usar versión más reciente');
    expect(workspace).toContain('Actualización');
  });
  it('§35/§37 publicar y nueva versión', () => {
    expect(workspace).toContain('publishPlanAction');
    expect(workspace).toContain('newVersionAction');
  });
  it('§61 referencias clickeables al documento fuente', () => {
    expect(workspace).toContain('href={`/dashboard/documents/${r.sourceDocumentId}`}');
  });
  it('§59 no expone UUID crudo (usa códigos/labels)', () => {
    expect(workspace).toContain('r.code');
    expect(workspace).toContain('HACCP_REFERENCE_KIND_LABEL');
  });
});
