/**
 * DOC-004 — helpers PUROS de esquema de formulario y validación de datos. §57.
 */
import { describe, expect, it } from 'vitest';
import {
  sanitizeFormSchema,
  validateFormSchema,
  sanitizeRecordData,
  validateRecordData,
  isFieldVisible,
  recordCompleteness,
  schemaHasFields,
  fieldKindLabel,
  FIELD_KINDS,
  type FormSchema,
} from '@/features/records/form-schema';

const schema: FormSchema = sanitizeFormSchema({
  sections: [
    {
      id: 'main',
      title: 'Principal',
      repeatable: false,
      fields: [
        { id: 'proveedor', label: 'Proveedor', kind: 'text', required: true },
        { id: 'cantidad', label: 'Cantidad', kind: 'number', required: true, min: 0, max: 1000 },
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
          label: 'Motivo del rechazo',
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
});

describe('saneo y tipos de campo (§10)', () => {
  it('etiquetas humanas para todos los tipos', () => {
    for (const k of FIELD_KINDS) expect(fieldKindLabel(k)).toBeTruthy();
  });
  it('genera ids estables/únicos y respeta el tipo', () => {
    expect(schema.sections).toHaveLength(2);
    expect(schema.sections[0]!.fields[0]!.id).toBe('proveedor');
    expect(schema.sections[1]!.repeatable).toBe(true);
    expect(schemaHasFields(schema)).toBe(true);
  });
  it('descarta claves desconocidas y fuerza opciones en select', () => {
    const s = sanitizeFormSchema({
      sections: [{ id: 's', title: 'S', fields: [{ id: 'x', label: 'X', kind: 'select' }] }],
    });
    expect(s.sections[0]!.fields[0]!.options).toEqual([]);
  });
});

describe('validación de diseño (§17)', () => {
  it('sin errores para un esquema válido', () => {
    expect(validateFormSchema(schema)).toEqual([]);
  });
  it('exige opciones en select y al menos un campo', () => {
    const bad = sanitizeFormSchema({
      sections: [{ id: 's', title: 'S', fields: [{ id: 'x', label: 'X', kind: 'select' }] }],
    });
    expect(validateFormSchema(bad).some((e) => e.includes('opción'))).toBe(true);
    expect(validateFormSchema(sanitizeFormSchema({ sections: [] }))).toContain(
      'El formulario debe tener al menos un campo.',
    );
  });
});

describe('visibilidad condicional (§15)', () => {
  it('el campo condicional se muestra solo cuando aplica', () => {
    const motivo = schema.sections[0]!.fields[3]!;
    expect(isFieldVisible(motivo, { resultado: 'aceptado' })).toBe(false);
    expect(isFieldVisible(motivo, { resultado: 'rechazado' })).toBe(true);
  });
});

describe('validación de datos (§14/§44)', () => {
  it('exige obligatorios visibles; un campo oculto no es obligatorio', () => {
    const data = sanitizeRecordData(schema, {
      values: { proveedor: 'X', cantidad: 5, resultado: 'aceptado' },
      rows: { muestras: [{ valor: 1 }] },
    });
    // motivo está oculto (resultado=aceptado) → no se exige.
    expect(validateRecordData(schema, data)).toEqual([]);
  });
  it('exige el motivo cuando el resultado es rechazado (condicional obligatorio)', () => {
    const data = sanitizeRecordData(schema, {
      values: { proveedor: 'X', cantidad: 5, resultado: 'rechazado' },
      rows: { muestras: [{ valor: 1 }] },
    });
    expect(validateRecordData(schema, data).some((e) => e.includes('Motivo'))).toBe(true);
  });
  it('valida rango numérico y filas de la tabla', () => {
    const data = sanitizeRecordData(schema, {
      values: { proveedor: 'X', cantidad: 5000, resultado: 'aceptado' },
      rows: { muestras: [{}] }, // fila sin valor obligatorio
    });
    const errors = validateRecordData(schema, data);
    expect(errors.some((e) => e.includes('≤ 1000'))).toBe(true);
    expect(errors.some((e) => e.includes('fila 1'))).toBe(true);
  });
  it('coacciona decimales y descarta filas de más', () => {
    const s = sanitizeFormSchema({
      sections: [
        {
          id: 't',
          title: 'T',
          repeatable: true,
          maxRows: 1,
          fields: [{ id: 'd', label: 'D', kind: 'decimal', decimals: 2 }],
        },
      ],
    });
    const data = sanitizeRecordData(s, { rows: { t: [{ d: '3.14159' }, { d: '2' }] } });
    expect(data.rows.t).toHaveLength(1); // maxRows respetado
    expect(data.rows.t![0]!.d).toBe(3.14);
  });
});

describe('completitud (§25)', () => {
  it('cuenta obligatorios visibles cubiertos', () => {
    const data = sanitizeRecordData(schema, {
      values: { proveedor: 'X', resultado: 'aceptado' },
      rows: {},
    });
    const c = recordCompleteness(schema, data);
    expect(c.required).toBe(3); // proveedor, cantidad, resultado (motivo oculto)
    expect(c.filled).toBe(2);
  });
});
