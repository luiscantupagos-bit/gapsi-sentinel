/**
 * HACCP-006 — UI de verificación (aserciones de fuente). §53.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HACCP_TABS, HACCP_FUTURE_TABS, HACCP_TAB_LABEL } from '@/features/haccp/haccp-state';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');
const base = 'src/app/dashboard/haccp/[planId]/_components';
const tab = read(`${base}/HaccpVerificationTab.tsx`);
const view = read(`${base}/HaccpVerificationView.tsx`);

describe('§24 tab habilitado', () => {
  it('la verificación vive en la pestaña «validation-verification» (subtab), sin «Próximamente»', () => {
    expect(HACCP_TABS).toContain('validation-verification');
    expect(HACCP_TAB_LABEL['validation-verification']).toBe('Validación y verificación');
    expect(HACCP_FUTURE_TABS).toHaveLength(0);
  });
});

describe('§24/§25 sub-vistas y resumen', () => {
  it('Programa / Próximas / Vencidas / Completadas / Resultados + cards', () => {
    expect(tab).toContain('Programa');
    expect(tab).toContain('Próximas');
    expect(tab).toContain('Vencidas');
    expect(tab).toContain('Completadas');
    expect(tab).toContain('Resultados');
    expect(tab).toContain('No conformes');
  });
});

describe('§26 crear/editar definición', () => {
  it('formulario con frecuencia, responsable, estrategia de versión y formato', () => {
    expect(tab).toContain('saveVerificationDefinitionAction');
    expect(tab).toContain('frequencyType');
    expect(tab).toContain('recordStrategy');
    expect(tab).toContain('requiredDocumentId');
    expect(tab).toContain('responsibleUserId');
    expect(tab).toContain('materializeVerificationAction'); // generar programa
  });
  it('§27 contexto de control read-only al elegir PCC/PPRO', () => {
    expect(tab).toContain('controlContext');
    expect(tab).toContain('criticalLimit');
    expect(tab).toContain('Control en revisión'); // §30 needs_review
  });
});

describe('§14/§15/§16 ejecución', () => {
  it('ver tarea, crear/abrir registro y registrar resultado', () => {
    expect(tab).toContain('/dashboard/tasks/');
    expect(tab).toContain('/dashboard/records/');
    expect(tab).toContain('createVerificationRecordAction');
    expect(tab).toContain('recordVerificationResultAction');
    expect(tab).toContain('resultRequiresConclusion'); // §17 conclusión obligatoria
  });
});

describe('§31/§48 Gantt y vista reutilizable', () => {
  it('usa el Gantt reutilizable', () => {
    expect(tab).toContain('GanttChart');
    expect(tab).toContain('ganttRows');
  });
  it('HaccpVerificationView read-only distingue validación de verificación', () => {
    expect(view).toContain('badge--vdef-');
    expect(tab).toContain('SE EJECUTA conforme');
  });
});
