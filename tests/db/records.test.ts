/**
 * DOC-004 — registros digitales: creación con versión EXACTA, datos JSON, validación de
 * obligatorios/condicionales/tablas, evidencia por file_relations, idempotencia, workflow,
 * inmutabilidad de cerrado, versión histórica preservada, aislamiento y folio atómico. §58.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, newId, seedOrgWithPublishedTemplate } from './_helpers';
import {
  RecordNotFoundError,
  RecordValidationError,
  closeRecord,
  createRecord,
  getRecord,
  getRecords,
  listAvailableForms,
  reviewRecord,
  saveRecordData,
  submitRecord,
} from '@/server/records';

const SCHEMA = {
  schemaVersion: 1,
  sections: [
    {
      id: 'main',
      title: 'Principal',
      repeatable: false,
      fields: [
        { id: 'proveedor', label: 'Proveedor', kind: 'text', required: true },
        {
          id: 'resultado',
          label: 'Resultado',
          kind: 'select',
          required: true,
          options: [
            { value: 'aceptado', label: 'Aceptado' },
            { value: 'rechazado', label: 'Rechazado' },
          ],
        },
        {
          id: 'motivo',
          label: 'Motivo',
          kind: 'textarea',
          required: true,
          visibleWhen: { fieldId: 'resultado', equals: 'rechazado' },
        },
      ],
    },
    {
      id: 'muestras',
      title: 'Muestras',
      repeatable: true,
      fields: [{ id: 'valor', label: 'Valor', kind: 'number', required: true }],
    },
  ],
};

async function createForm(orgId: string, opts: { published?: boolean; code?: string } = {}) {
  const documentId = newId();
  const versionId = newId();
  await db().document.create({
    data: {
      id: documentId,
      organizationId: orgId,
      code: opts.code ?? `FR-X-${newId().slice(0, 4)}`,
      title: 'Formato de prueba',
      documentType: 'form',
      origin: 'internal',
      status: opts.published === false ? 'draft' : 'effective',
    },
  });
  await db().documentVersion.create({
    data: {
      id: versionId,
      organizationId: orgId,
      documentId,
      label: 'v1',
      status: opts.published === false ? 'draft' : 'published',
      isCurrent: true,
      formSchema: SCHEMA,
    },
  });
  return { documentId, versionId };
}

const validData = {
  values: { proveedor: 'Avícola', resultado: 'aceptado' },
  rows: { muestras: [{ valor: 3 }] },
};

describe.skipIf(!hasDb)('DOC-004 — registros digitales', () => {
  it('A/B/P: crea registro ligado a la versión EXACTA, con folio atómico', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id1 = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    const id2 = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    const r1 = (await getRecord(fx.orgId, id1))!;
    const r2 = (await getRecord(fx.orgId, id2))!;
    expect(r1.formVersionLabel).toBe('v1'); // §B versión exacta
    expect(r1.recordNumber).toMatch(/^REG-\d{4}-000001$/); // §P consecutivo
    expect(r2.recordNumber).toMatch(/^REG-\d{4}-000002$/);
    // La FK apunta a la versión creada.
    const row = await db().recordInstance.findFirst({ where: { id: id1 } });
    expect(row?.documentVersionId).toBe(form.versionId);
  });

  it('C: guarda datos JSON (borrador → en proceso)', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    await saveRecordData(fx.orgId, fx.userId, id, validData);
    const r = (await getRecord(fx.orgId, id))!;
    expect(r.status).toBe('in_progress');
    expect(r.data.values.proveedor).toBe('Avícola');
    expect(r.data.rows.muestras).toHaveLength(1);
  });

  it('D: exige obligatorios al enviar', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    await expect(
      submitRecord(fx.orgId, fx.userId, id, { values: {}, rows: {} }),
    ).rejects.toBeInstanceOf(RecordValidationError);
  });

  it('E: obligatorio condicional (rechazado → motivo)', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    await expect(
      submitRecord(fx.orgId, fx.userId, id, {
        values: { proveedor: 'X', resultado: 'rechazado' },
        rows: { muestras: [{ valor: 1 }] },
      }),
    ).rejects.toBeInstanceOf(RecordValidationError);
    // con motivo: pasa
    await submitRecord(fx.orgId, fx.userId, id, {
      values: { proveedor: 'X', resultado: 'rechazado', motivo: 'Empaque dañado' },
      rows: { muestras: [{ valor: 1 }] },
    });
    expect((await getRecord(fx.orgId, id))!.status).toBe('submitted');
  });

  it('F: valida filas de la tabla repetible', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    await expect(
      submitRecord(fx.orgId, fx.userId, id, {
        values: { proveedor: 'X', resultado: 'aceptado' },
        rows: { muestras: [{}] }, // fila sin valor
      }),
    ).rejects.toBeInstanceOf(RecordValidationError);
  });

  it('G: evidencia por file_relations (entity_type=record), sin storage nuevo', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    const fileId = newId();
    await db().storedFile.create({
      data: {
        id: fileId,
        organizationId: fx.orgId,
        storageProvider: 'local',
        bucket: 'evidence',
        storageKey: `k/${fileId}`,
        originalFilename: 'foto.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        sha256: (fileId + newId()).replace(/-/g, '').slice(0, 64),
      },
    });
    await db().fileRelation.create({
      data: {
        organizationId: fx.orgId,
        fileId,
        entityType: 'record',
        entityId: id,
        relationType: 'evidence',
      },
    });
    const rel = await db().fileRelation.findFirst({
      where: { organizationId: fx.orgId, entityType: 'record', entityId: id },
    });
    expect(rel?.relationType).toBe('evidence');
  });

  it('J: idempotencia por client_generated_id (§40)', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const client = newId();
    const a = await createRecord(fx.orgId, fx.userId, {
      documentId: form.documentId,
      clientGeneratedId: client,
    });
    const b = await createRecord(fx.orgId, fx.userId, {
      documentId: form.documentId,
      clientGeneratedId: client,
    });
    expect(a).toBe(b); // no duplica
    const count = await db().recordInstance.count({ where: { organizationId: fx.orgId } });
    expect(count).toBe(1);
  });

  it('K/L/M: enviar → revisar → cerrar; cerrado es inmutable (§36)', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    await submitRecord(fx.orgId, fx.userId, id, validData);
    await reviewRecord(fx.orgId, fx.userId, id);
    await closeRecord(fx.orgId, fx.userId, id);
    expect((await getRecord(fx.orgId, id))!.status).toBe('closed');
    await expect(saveRecordData(fx.orgId, fx.userId, id, validData)).rejects.toBeInstanceOf(
      RecordValidationError,
    );
  });

  it('N: la versión histórica del formato se preserva en el registro', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    // Nueva versión del formato (v2) con esquema distinto.
    await db().documentVersion.update({
      where: { id: form.versionId },
      data: { isCurrent: false, status: 'obsolete' },
    });
    const v2 = newId();
    await db().documentVersion.create({
      data: {
        id: v2,
        organizationId: fx.orgId,
        documentId: form.documentId,
        label: 'v2',
        status: 'published',
        isCurrent: true,
        formSchema: { schemaVersion: 1, sections: [] },
      },
    });
    // El registro sigue apuntando a v1 y conserva su esquema con campos.
    const r = (await getRecord(fx.orgId, id))!;
    expect(r.formVersionLabel).toBe('v1');
    expect(r.schema.sections.length).toBeGreaterThan(0);
    // El nuevo formato vigente (v2) no tiene formulario → no aparece disponible.
    const available = await listAvailableForms(fx.orgId);
    expect(available.find((f) => f.documentId === form.documentId)).toBeUndefined();
  });

  it('H/I/O: aislamiento por organización', async () => {
    const fx = await seedOrgWithPublishedTemplate(db());
    const other = await seedOrgWithPublishedTemplate(db());
    const form = await createForm(fx.orgId);
    const id = await createRecord(fx.orgId, fx.userId, { documentId: form.documentId });
    // Otra organización no ve el registro ni puede crear contra el formato ajeno.
    expect(await getRecord(other.orgId, id)).toBeNull();
    expect(await getRecords(other.orgId, other.userId)).toHaveLength(0);
    await expect(
      createRecord(other.orgId, other.userId, { documentId: form.documentId }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    // §O: política RLS presente.
    const pol = await db().$queryRawUnsafe<{ c: number }[]>(
      "select count(*)::int c from pg_policies where tablename='record_instances' and policyname='record_instances_tenant_isolation'",
    );
    expect(pol[0]!.c).toBe(1);
  });
});
