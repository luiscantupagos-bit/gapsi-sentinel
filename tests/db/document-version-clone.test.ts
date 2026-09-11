/**
 * BUG — nueva versión estructurada se abría vacía (PART E). Al crear una versión
 * nueva de un documento estructurado, el contenido (structured_content, modo,
 * templateKey) debe HEREDARSE de la versión fuente; v1.0 permanece inmutable.
 * Requiere `DATABASE_URL`. Organizaciones desechables.
 */
import { describe, expect, it } from 'vitest';
import { db, hasDb, seedOrgWithPublishedTemplate } from './_helpers';
import { createStructuredDocument, createVersion, saveStructuredContent } from '@/server/documents';

const ACT = '55555555-5555-4555-8555-555555555555';

async function versions(orgId: string, documentId: string) {
  return db().documentVersion.findMany({
    where: { organizationId: orgId, documentId },
    orderBy: { createdAt: 'asc' },
  });
}

describe.skipIf(!hasDb)('clonado de contenido al crear nueva versión (BUG PART E)', () => {
  it('A/C/J. Procedimiento: v1.1 hereda structured_content idéntico y sigue estructurado', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const content = {
      fields: {
        objetivo: 'Controlar el producto no conforme.',
        alcance: 'Recepción, proceso y producto terminado.',
      },
      repeatables: {
        responsibilities: [
          { responsable: 'Jefe de Calidad', responsabilidad: 'Autoriza disposición.' },
        ],
        activities: [{ nombre: 'Identificación', descripcion: 'Detectar y etiquetar.' }],
      },
    };
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Control de producto no conforme',
      areaCode: 'CA',
      structuredContent: content,
    } as never);

    await createVersion(org.orgId, org.userId, id, {
      bump: 'minor',
      changeNotes: 'Segunda versión.',
    });
    const vs = await versions(org.orgId, id);
    expect(vs).toHaveLength(2);
    const [v1, v2] = vs;
    // v1.1 hereda el structured_content (estructurado, no vacío ni rich_text).
    expect(v2?.structuredContent).not.toBeNull();
    expect(v2?.structuredContent).toEqual(v1?.structuredContent);
    expect(v2?.templateKey).toBe(v1?.templateKey);
    expect(v2?.contentSchemaVersion).toBe(v1?.contentSchemaVersion);
    // G. la nueva es borrador.
    expect(v2?.status).toBe('draft');
    expect(v2?.label).toBe('v1.1');
  });

  it('B. editar v1.1 no altera v1.0 (inmutabilidad)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Doc',
      areaCode: 'CA',
      structuredContent: { fields: { objetivo: 'Original' }, repeatables: {} },
    } as never);
    const v1 = (await versions(org.orgId, id))[0]!;
    await createVersion(org.orgId, org.userId, id, { bump: 'minor', changeNotes: 'v2' });
    const v2 = (await versions(org.orgId, id)).find((v) => v.label === 'v1.1')!;

    await saveStructuredContent(org.orgId, org.userId, id, v2.id, {
      structuredContent: { fields: { objetivo: 'Modificado en v1.1' }, repeatables: {} },
    });

    const v1After = await db().documentVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After.structuredContent).toEqual(v1.structuredContent); // v1.0 intacta
    const v2After = await db().documentVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect((v2After.structuredContent as { fields: { objetivo: string } }).fields.objetivo).toBe(
      'Modificado en v1.1',
    );
  });

  it('F. Programa: v1.1 conserva el activityId (no remint, para reconciliación DOC-003)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'program',
      title: 'Programa',
      areaCode: 'CA',
      structuredContent: {
        fields: { objetivo: 'O', alcance: 'A' },
        program: {
          periodStart: '2026-01-01',
          periodEnd: '2026-12-31',
          activities: [
            {
              activityId: ACT,
              name: 'Auditoría',
              description: 'd',
              executionEnabled: true,
              responsibleUserId: org.userId,
              schedule: {
                type: 'single',
                startDate: null,
                dueDate: '2026-06-01',
                frequency: null,
                interval: null,
                endDate: null,
              },
              expectedEvidence: 'Informe',
              observations: '',
              notifyBeforeDays: 7,
            },
          ],
        },
      },
    } as never);
    await createVersion(org.orgId, org.userId, id, { bump: 'minor', changeNotes: 'v2' });
    const v2 = (await versions(org.orgId, id)).find((v) => v.label === 'v1.1')!;
    const program = (v2.structuredContent as { program: { activities: { activityId: string }[] } })
      .program;
    expect(program.activities[0]?.activityId).toBe(ACT);
  });

  it('deep-copy: mutar el contenido de v1.1 no afecta v1.0 (sin referencia compartida)', async () => {
    const org = await seedOrgWithPublishedTemplate(db());
    const id = await createStructuredDocument(org.orgId, org.userId, {
      documentType: 'procedure',
      title: 'Doc',
      areaCode: 'CA',
      structuredContent: { fields: { objetivo: 'A' }, repeatables: {} },
    } as never);
    await createVersion(org.orgId, org.userId, id, { bump: 'minor', changeNotes: 'v2' });
    const vs = await versions(org.orgId, id);
    // Filas distintas → objetos JSONB independientes.
    expect(vs[0]?.id).not.toBe(vs[1]?.id);
    expect(vs[1]?.structuredContent).toEqual(vs[0]?.structuredContent);
  });
});
