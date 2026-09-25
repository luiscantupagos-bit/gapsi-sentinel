/**
 * DOC-OUTPUT §A/§B/§C — UI de recuperación de copias y de publicación con excepción.
 * Aserciones de fuente (misma convención que doc-output-ui): comprueban que los
 * componentes y las server actions contienen los elementos y validaciones exigidos.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const base = '../src/app/dashboard/documents';
const recoverDialog = read(`${base}/[documentId]/_components/RecoverCopyDialog.tsx`);
const publishControl = read(`${base}/[documentId]/_components/PublishControl.tsx`);
const actions = read(`${base}/workflow-actions.ts`);
const panel = read(`${base}/[documentId]/panel/_components/DocumentPanel.tsx`);
const panelPage = read(`${base}/[documentId]/panel/page.tsx`);
const workflow = read('../src/server/document-workflow.ts');
const css = read('../src/app/globals.css');

describe('§A — modal de recuperación de copias', () => {
  it('expone el botón y un diálogo accesible', () => {
    expect(recoverDialog).toContain('Registrar recuperación');
    expect(recoverDialog).toContain('<dialog');
    expect(recoverDialog).toContain('showModal()');
  });
  it('muestra folio/versión/destino en solo lectura (§A4)', () => {
    expect(recoverDialog).toContain('Folio');
    expect(recoverDialog).toContain('Versión');
    expect(recoverDialog).toContain('Destino');
    expect(recoverDialog).toContain('doc-dialog__meta');
  });
  it('la disposición es obligatoria y ofrece las 4 opciones (§A2/§A4)', () => {
    expect(recoverDialog).toContain('name="disposition"');
    expect(recoverDialog).toContain('required');
    expect(recoverDialog).toContain('COPY_DISPOSITION_OPTIONS');
  });
  it('captura recuperada por / confirmada por / observaciones', () => {
    expect(recoverDialog).toContain('name="recoveredBy"');
    expect(recoverDialog).toContain('name="confirmedBy"');
    expect(recoverDialog).toContain('name="recoveryNotes"');
  });
  it('muestra el selector de copia sustituta solo si disposición = Reemplazada (§A4)', () => {
    expect(recoverDialog).toContain("disposition === 'replaced'");
    expect(recoverDialog).toContain('name="replacedByCopyId"');
  });
});

describe('§A5 — validación server-side de la recuperación', () => {
  it('exige disposición válida en el servidor, no solo en el frontend', () => {
    expect(actions).toContain('DISPOSITIONS');
    expect(actions).toContain('La disposición es obligatoria.');
  });
  it('registra recuperada por / confirmada por / reemplazo / notas', () => {
    expect(actions).toContain('recoveredBy');
    expect(actions).toContain('confirmedBy');
    expect(actions).toContain('replacedByCopyId');
    expect(actions).toContain('recoveryNotes');
  });
  it('el backend respeta recoveredBy y por defecto usa el actor', () => {
    expect(workflow).toContain('recoveredBy: details?.recoveredBy ?? actorId');
  });
});

describe('§A6/§A7 — panel de copias tras recuperar', () => {
  it('separa ESTADO y DISPOSICIÓN como columnas distintas (§A2)', () => {
    expect(panel).toContain('<th>Estado</th>');
    expect(panel).toContain('<th>Disposición</th>');
  });
  it('muestra la trazabilidad de reemplazo CC → Reemplazada por → CC (§A7)', () => {
    expect(panel).toContain('Reemplazada por');
    expect(panel).toContain('replacedByFolio');
  });
  it('la página resuelve labels en español sin UUID (versión, área, nombres)', () => {
    expect(panelPage).toContain('versionLabelOf');
    expect(panelPage).toContain('areaNameOf');
    expect(panelPage).toContain('COPY_DISPOSITION_LABEL');
  });
});

describe('§B — bloqueo de publicación en UI', () => {
  it('lista las copias pendientes con mensaje (no error técnico)', () => {
    expect(publishControl).toContain('No es posible hacer vigente esta versión');
    expect(publishControl).toContain('pendingPhysicalCopies');
  });
  it('muestra folio/destino/versión/fecha/estado de cada pendiente (§B2)', () => {
    expect(publishControl).toContain('<th>Folio</th>');
    expect(publishControl).toContain('<th>Destino</th>');
    expect(publishControl).toContain('<th>Estado</th>');
  });
  it('ofrece registrar recuperación y volver (§B3)', () => {
    expect(publishControl).toContain('RecoverCopyDialog');
    expect(publishControl).toContain('Volver');
  });
  it('sin pendientes publica normal (fecha de vigencia)', () => {
    expect(publishControl).toContain('!hasPending');
    expect(publishControl).toContain('name="effectiveAt"');
  });
});

describe('§C — publicar con excepción', () => {
  it('la acción de excepción solo es visible para el propietario (§C1)', () => {
    expect(publishControl).toContain('isOwner &&');
    expect(publishControl).toContain('Publicar con excepción');
  });
  it('exige una justificación obligatoria (§C3)', () => {
    expect(publishControl).toContain('name="exceptionReason"');
    expect(publishControl).toContain('required');
  });
  it('la server action publica con excepción cuando hay justificación', () => {
    expect(actions).toContain('exceptionReason');
    expect(actions).toContain('reason ? { reason } : null');
  });
  it('el backend exige owner + justificación y registra el evento auditado', () => {
    expect(workflow).toContain('Solo el propietario puede publicar con excepción');
    expect(workflow).toContain('documentPublishException');
    expect(workflow).toContain('version.published_with_exception');
  });
});

describe('estilos de diálogo', () => {
  it('define el diálogo y el botón de excepción', () => {
    expect(css).toContain('.doc-dialog');
    expect(css).toContain('.doc-dialog__exception');
    expect(css).toContain('.button--danger');
  });
});
