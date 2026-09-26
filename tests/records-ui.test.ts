/**
 * DOC-004 — UI de registros y diseñador (aserciones de fuente). §59.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { NAV_ITEMS } from '@/app/dashboard/_components/nav-config';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8');

const designer = read('src/app/dashboard/documents/[documentId]/form/_components/FormDesigner.tsx');
const index = read('src/app/dashboard/records/_components/RecordsIndex.tsx');
const form = read('src/app/dashboard/records/[recordId]/_components/RecordForm.tsx');
const view = read('src/app/dashboard/records/_components/RecordReadOnlyView.tsx');
const detail = read('src/app/dashboard/records/[recordId]/page.tsx');
const docPage = read('src/app/dashboard/documents/[documentId]/page.tsx');

describe('§21 navegación', () => {
  it('Registros está en el menú principal', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toContain('/dashboard/records');
  });
});

describe('§17/§18/§19 diseñador de formularios', () => {
  it('agregar/eliminar/reordenar/duplicar secciones y campos + vista previa', () => {
    expect(designer).toContain('Agregar sección');
    expect(designer).toContain('Agregar campo');
    expect(designer).toContain('Duplicar');
    expect(designer).toContain('Eliminar sección');
    expect(designer).toContain('Vista previa');
    expect(designer).toContain('Subir campo'); // reordenar
    expect(designer).toContain('Tabla repetible');
    expect(designer).toContain('saveFormSchemaAction');
  });
  it('propiedades condicionales y por tipo', () => {
    expect(designer).toContain('Visible si');
    expect(designer).toContain('Opciones (una por línea)');
  });
  it('se habilita desde el documento tipo Formato', () => {
    expect(docPage).toContain("doc.documentType === 'form'");
    expect(docPage).toContain('Diseñar formulario');
  });
});

describe('§22/§23 índice y alta', () => {
  it('crea registro, filtros y columnas (folio/formato/versión/estado/origen/sitio)', () => {
    expect(index).toContain('createRecordAction');
    expect(index).toContain('Mis registros');
    expect(index).toContain('recordNumber'); // folio humano
    expect(index).toContain('recordSourceLabel'); // origen
    expect(index).toContain('badge--recstatus-');
  });
  it('idempotencia: envía clientGeneratedId', () => {
    expect(index).toContain('clientGeneratedId');
    expect(index).toContain('randomUUID');
  });
});

describe('§24-§27 captura, autosave, submit, workflow', () => {
  it('guarda borrador, envía y opera el workflow', () => {
    expect(form).toContain('saveRecordDataAction');
    expect(form).toContain('submitRecordAction');
    expect(form).toContain('reviewRecordAction');
    expect(form).toContain('closeRecordAction');
    expect(form).toContain('cancelRecordAction');
  });
  it('§15 visibilidad condicional y §11 tablas repetibles', () => {
    expect(form).toContain('isFieldVisible');
    expect(form).toContain('Agregar fila');
    expect(form).toContain('Duplicar fila');
  });
  it('§29 captura de foto compatible con cámara de tablet', () => {
    expect(form).toContain('capture');
    expect(form).toContain("accept={field.kind === 'photo' ? 'image/*' : undefined}");
  });
  it('§36 read-only cuando no es editable', () => {
    expect(form).toContain('editable ?');
    expect(form).toContain('readOnlySlot');
  });
});

describe('§38/§43 read-only y sin UUID', () => {
  it('la vista reutilizable rinde tablas y estado', () => {
    expect(view).toContain('badge--recstatus-');
    expect(view).toContain('record-view__table');
  });
  it('el detalle muestra el folio en el encabezado (no el UUID)', () => {
    expect(detail).toContain('<h1>{record.recordNumber}</h1>');
    // El id solo se usa como prop/ruta, nunca como texto visible.
    expect(detail).not.toContain('>{record.id}<');
  });
});
