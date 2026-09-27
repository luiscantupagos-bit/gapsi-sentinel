/**
 * WORKSPACE-REORG — reorganización del workspace HACCP en 12 pasos (aserciones de fuente).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');
const base = 'src/app/dashboard/haccp/[planId]/_components';
const workspace = read(`${base}/HaccpWorkspace.tsx`);
const flowTab = read(`${base}/HaccpFlowTab.tsx`);
const onsite = read(`${base}/HaccpOnsiteConfirmationTab.tsx`);
const facets = read(`${base}/HaccpControlFacets.tsx`);
const valver = read(`${base}/HaccpValidationVerificationTab.tsx`);

describe('composición del workspace', () => {
  it('renderiza los grupos numerados y el resumen en el encabezado', () => {
    expect(workspace).toContain('HACCP_TAB_GROUPS');
    expect(workspace).toContain('HACCP_TAB_NUMBER');
    expect(workspace).toContain('haccp-plansummary'); // resumen movido al encabezado
    expect(workspace).toContain('Resumen del plan');
  });
  it('consolida Producto + Materias primas en el paso 2', () => {
    expect(workspace).toContain("case 'product':");
    expect(workspace).toContain('Producto terminado');
    expect(workspace).toContain('Materias primas e insumos');
  });
  it('FLOW-SIMPLIFICATION: Diagrama de flujo top-level (#4); confirmación in situ ya no es tab', () => {
    expect(workspace).toContain("case 'flow':");
    expect(workspace).not.toContain("case 'onsite-confirmation':");
    // La confirmación in situ vive ahora DENTRO del diagrama de flujo (HaccpProcessTab).
    expect(workspace).not.toContain('HaccpOnsiteConfirmationTab');
  });
  it('PPR es contextual dentro de Análisis de peligros (no top-level)', () => {
    expect(workspace).toContain('Ver PPR relacionados');
    expect(workspace).toContain('kind="prerequisite"');
  });
  it('límites/monitoreo/acciones correctivas como facetas del plan de control', () => {
    expect(workspace).toContain('HaccpLimitsView');
    expect(workspace).toContain('HaccpMonitoringView');
    expect(workspace).toContain('HaccpCorrectiveActionsView');
  });
  it('Validación y verificación consolidado (#11) y Registros (#12)', () => {
    expect(workspace).toContain('HaccpValidationVerificationTab');
    expect(workspace).toContain("case 'records':");
    expect(workspace).toContain('/dashboard/records');
  });
});

describe('confirmación in situ extraída del diagrama', () => {
  it('la verificación in situ ya no vive dentro del flujo', () => {
    expect(flowTab).not.toContain('verifyFlowAction');
    expect(flowTab).not.toContain('Verificación in situ');
  });
  it('la opera el paso 5 con estado y CTA', () => {
    expect(onsite).toContain('verifyFlowAction');
    expect(onsite).toContain('Confirmar diagrama en planta');
    expect(onsite).toContain('Confirmado en planta');
  });
});

describe('facetas de control y consolidación validación/verificación', () => {
  it('límites separa PCC (límite crítico) de PPRO (criterio de acción)', () => {
    expect(facets).toContain('Límite crítico');
    expect(facets).toContain('Criterio de acción');
    expect(facets).toContain('no es un límite crítico');
  });
  it('subtabs internos Validación y Verificación sin mezclar', () => {
    expect(valver).toContain('HaccpValidationTab');
    expect(valver).toContain('HaccpVerificationTab');
    expect(valver).toContain('Validación');
    expect(valver).toContain('Verificación');
  });
});
