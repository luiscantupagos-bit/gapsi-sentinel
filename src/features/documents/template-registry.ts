/**
 * Registro central de plantillas documentales (DOC-001 §4/§5).
 *
 * Fuente única de la definición POR TIPO de documento: prefijo de código,
 * periodo de revisión por defecto, y el ESQUEMA estructurado de secciones
 * (campos y bloques repetibles). El editor, el renderer, el validador y el
 * generador de código consumen este registro para NO duplicar la lógica en
 * cada página (un solo motor guiado por datos).
 *
 * Puro y determinista: sin BD ni E/S. Usado por cliente, servidor y seed.
 *
 * Los tipos con `supportsStructuredEditor` capturan datos estructurados (la
 * fuente de verdad); "Documento libre" conserva el editor enriquecido
 * (`supportsRichText`). La IDENTIFICACIÓN (tipo, área, código, versión, nombre,
 * fechas) NO se define aquí como campos del cuerpo: vive en la entidad
 * `Document`/`DocumentVersion` y el renderer la toma de ahí (evita doble fuente
 * de verdad). Las secciones de aquí describen solo el CUERPO del documento.
 */
import type { DocumentType } from './catalog';

/** Tipo de campo simple dentro de una sección o de un ítem repetible. */
export type FieldKind = 'text' | 'textarea';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Límite de longitud (caracteres). Por defecto 2000 para textarea, 300 para text. */
  maxLength?: number;
}

/** Bloque repetible: lista de ítems con los mismos subcampos (§9). */
export interface RepeatableDef {
  key: string;
  /** Título de la sección repetible (p. ej. "Responsabilidades"). */
  label: string;
  /** Etiqueta singular de un ítem (p. ej. "Responsabilidad", "Actividad"). */
  itemLabel: string;
  /** Texto del botón de alta (p. ej. "Agregar responsabilidad"). */
  addLabel: string;
  /** Si es true, cada ítem muestra un número consecutivo automático (§9 actividades). */
  autoNumber?: boolean;
  fields: FieldDef[];
}

export type StructuredSectionDef =
  | { key: string; title: string; kind: 'fields'; fields: FieldDef[]; description?: string }
  | {
      key: string;
      title: string;
      kind: 'repeatable';
      repeatable: RepeatableDef;
      description?: string;
    };

export interface DocumentTemplateDefinition {
  type: DocumentType;
  label: string;
  description: string;
  /** Nombre de icono compartido (ver `_components/icons.tsx`). */
  icon: string;
  /** Prefijo del código automático `[TIPO]-[ÁREA]-[###]` (§5). */
  codePrefix: string;
  /** Periodo de revisión por defecto en meses (§8). `null` = sin fecha fija. */
  defaultReviewMonths: number | null;
  /** Portada por defecto en la configuración de página. */
  cover: boolean;
  supportsStructuredEditor: boolean;
  supportsRichText: boolean;
  /** Secciones del cuerpo (vacío para tipos solo-enriquecido). */
  sections: StructuredSectionDef[];
}

// --- Helpers de construcción (compactos y legibles) --------------------------

const text = (key: string, label: string, o: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  kind: 'text',
  ...o,
});
const area = (key: string, label: string, o: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  kind: 'textarea',
  ...o,
});
const fieldsSection = (
  key: string,
  title: string,
  fields: FieldDef[],
  description?: string,
): StructuredSectionDef => ({ key, title, kind: 'fields', fields, description });
const repeatableSection = (
  key: string,
  title: string,
  repeatable: Omit<RepeatableDef, 'key'>,
  description?: string,
): StructuredSectionDef => ({
  key,
  title,
  kind: 'repeatable',
  repeatable: { key, ...repeatable },
  description,
});

// --- Definiciones por tipo ----------------------------------------------------

/**
 * Procedimiento (§9) — plantilla estructurada de referencia (P0 completo):
 * CONTENIDO (objetivo, alcance) · RESPONSABILIDADES (repetible) ·
 * PROCEDIMIENTO/ACTIVIDADES (repetible con número automático).
 */
const PROCEDURE: DocumentTemplateDefinition = {
  type: 'procedure',
  label: 'Procedimiento',
  description: 'Cómo se realiza una actividad: objetivo, alcance, responsables y pasos.',
  icon: 'documents',
  codePrefix: 'PR',
  defaultReviewMonths: 12,
  cover: true,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('objetivo', 'Objetivo', {
        required: true,
        placeholder: 'Propósito del procedimiento.',
      }),
      area('alcance', 'Alcance', {
        required: true,
        placeholder: 'A qué áreas, procesos o productos aplica.',
      }),
    ]),
    repeatableSection(
      'responsibilities',
      'Responsabilidades',
      {
        label: 'Responsabilidades',
        itemLabel: 'Responsabilidad',
        addLabel: 'Agregar responsabilidad',
        fields: [
          text('responsable', 'Responsable (área o rol)', {
            required: true,
            placeholder: 'p. ej. Jefe de Calidad',
          }),
          area('responsabilidad', 'Responsabilidad', { required: true }),
        ],
      },
      'Quién es responsable de qué dentro del procedimiento.',
    ),
    repeatableSection(
      'activities',
      'Procedimiento / Actividades',
      {
        label: 'Actividades',
        itemLabel: 'Actividad',
        addLabel: 'Agregar actividad',
        autoNumber: true,
        // DOC-UX-001 §6: se retiran las columnas Evidencia y Observaciones del
        // Procedimiento formal. La evidencia/documentos se gestionan con @ y // (y
        // aparecen en las secciones de referencias/formatos); las observaciones se
        // integran en la Descripción. Los datos legacy se conservan a nivel de dato
        // hasta que el documento se vuelve a guardar (sin migración destructiva).
        fields: [
          text('nombre', 'Nombre de la actividad', { required: true }),
          area('descripcion', 'Descripción', { required: true }),
          text('responsable', 'Responsable', { placeholder: 'Opcional' }),
        ],
      },
      'Secuencia de actividades con número automático.',
    ),
  ],
};

const POLICY: DocumentTemplateDefinition = {
  type: 'policy',
  label: 'Política',
  description: 'Declaración de intención y compromisos de la dirección.',
  icon: 'documents',
  codePrefix: 'PO',
  defaultReviewMonths: 12,
  cover: true,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('declaracion', 'Declaración', {
        required: true,
        placeholder: 'Declaración de la política.',
      }),
      area('alcance', 'Alcance', { placeholder: 'A quién y a qué aplica.' }),
    ]),
    repeatableSection('commitments', 'Compromisos', {
      label: 'Compromisos',
      itemLabel: 'Compromiso',
      addLabel: 'Agregar compromiso',
      fields: [area('enunciado', 'Compromiso', { required: true })],
    }),
  ],
};

const MANUAL: DocumentTemplateDefinition = {
  type: 'manual',
  label: 'Manual',
  description: 'Documento marco que describe un sistema o proceso completo.',
  icon: 'documents',
  codePrefix: 'MA',
  defaultReviewMonths: 24,
  cover: true,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('introduccion', 'Introducción', { required: true }),
      area('alcance', 'Alcance', { required: true }),
      area('contenido', 'Descripción del contenido', {
        placeholder: 'Estructura y desarrollo del manual.',
      }),
      area('referencias', 'Referencias', { placeholder: 'Documentos o normas de referencia.' }),
    ]),
  ],
};

const INSTRUCTION: DocumentTemplateDefinition = {
  type: 'instruction',
  label: 'Instructivo',
  description: 'Instrucciones detalladas paso a paso para una tarea concreta.',
  icon: 'documents',
  codePrefix: 'IN',
  defaultReviewMonths: 12,
  cover: false,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('objetivo', 'Objetivo', { required: true }),
      area('materiales', 'Materiales y equipo', { placeholder: 'Opcional' }),
    ]),
    repeatableSection('steps', 'Pasos', {
      label: 'Pasos',
      itemLabel: 'Paso',
      addLabel: 'Agregar paso',
      autoNumber: true,
      fields: [
        text('titulo', 'Título del paso', { required: true }),
        area('detalle', 'Detalle', { required: true }),
      ],
    }),
    fieldsSection('safety', 'Precauciones', [
      area('precauciones', 'Precauciones', { placeholder: 'Riesgos y cuidados.' }),
    ]),
  ],
};

const PROGRAM: DocumentTemplateDefinition = {
  type: 'program',
  label: 'Programa',
  description: 'Conjunto planificado de actividades en el tiempo (p. ej. auditorías anuales).',
  icon: 'documents',
  codePrefix: 'PG',
  defaultReviewMonths: 12,
  cover: false,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('objetivo', 'Objetivo', { required: true }),
      area('alcance', 'Alcance', { required: true }),
    ]),
    repeatableSection(
      'activities',
      'Actividades del programa',
      {
        label: 'Actividades',
        itemLabel: 'Actividad',
        addLabel: 'Agregar actividad',
        autoNumber: true,
        fields: [
          text('actividad', 'Actividad', { required: true }),
          text('responsable', 'Responsable', { placeholder: 'Opcional' }),
          text('periodo', 'Periodo / fecha', { placeholder: 'p. ej. 1er trimestre' }),
          text('recursos', 'Recursos', { placeholder: 'Opcional' }),
        ],
      },
      'Actividades planificadas con su periodo.',
    ),
  ],
};

const PLAN: DocumentTemplateDefinition = {
  type: 'plan',
  label: 'Plan',
  description: 'Estrategia con etapas, recursos y seguimiento para lograr un objetivo.',
  icon: 'documents',
  codePrefix: 'PL',
  defaultReviewMonths: 12,
  cover: false,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('objetivo', 'Objetivo', { required: true }),
      area('alcance', 'Alcance', { required: true }),
      area('estrategia', 'Estrategia', { placeholder: 'Enfoque general del plan.' }),
    ]),
    repeatableSection('stages', 'Etapas', {
      label: 'Etapas',
      itemLabel: 'Etapa',
      addLabel: 'Agregar etapa',
      autoNumber: true,
      fields: [
        text('etapa', 'Etapa', { required: true }),
        text('responsable', 'Responsable', { placeholder: 'Opcional' }),
        text('periodo', 'Periodo / fecha', { placeholder: 'Opcional' }),
      ],
    }),
    fieldsSection('followup', 'Recursos y seguimiento', [
      area('recursos', 'Recursos', { placeholder: 'Opcional' }),
      area('seguimiento', 'Seguimiento', { placeholder: 'Cómo se dará seguimiento.' }),
    ]),
  ],
};

const FORM: DocumentTemplateDefinition = {
  type: 'form',
  label: 'Formato',
  description: 'Plantilla de captura de datos. El diseñador de campos llega en DOC-004.',
  icon: 'documents',
  codePrefix: 'FO',
  defaultReviewMonths: 24,
  cover: false,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('proposito', 'Propósito', { required: true, placeholder: 'Para qué sirve el formato.' }),
    ]),
    repeatableSection(
      'fields',
      'Campos del formato',
      {
        label: 'Campos',
        itemLabel: 'Campo',
        addLabel: 'Agregar campo',
        fields: [
          text('campo', 'Nombre del campo', { required: true }),
          text('tipo', 'Tipo de dato', { placeholder: 'p. ej. texto, fecha, número' }),
          text('obligatorio', 'Obligatorio', { placeholder: 'Sí / No' }),
        ],
      },
      'Definición ligera de los campos a capturar.',
    ),
  ],
};

const SPECIFICATION: DocumentTemplateDefinition = {
  type: 'specification',
  label: 'Especificación',
  description: 'Requisitos y criterios de aceptación de un producto o material.',
  icon: 'documents',
  codePrefix: 'ES',
  defaultReviewMonths: 12,
  cover: false,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [
      area('objeto', 'Objeto', { required: true, placeholder: 'Qué se especifica.' }),
    ]),
    repeatableSection('parameters', 'Parámetros', {
      label: 'Parámetros',
      itemLabel: 'Parámetro',
      addLabel: 'Agregar parámetro',
      fields: [
        text('parametro', 'Parámetro', { required: true }),
        text('especificacion', 'Especificación', { required: true }),
        text('metodo', 'Método de verificación', { placeholder: 'Opcional' }),
        text('criterio', 'Criterio de aceptación', { placeholder: 'Opcional' }),
      ],
    }),
    fieldsSection('references', 'Referencias', [
      area('referencias', 'Referencias', { placeholder: 'Normas o documentos aplicables.' }),
    ]),
  ],
};

const MATRIX: DocumentTemplateDefinition = {
  type: 'matrix',
  label: 'Matriz',
  description: 'Relación estructurada de elementos y criterios (p. ej. de riesgos).',
  icon: 'documents',
  codePrefix: 'MX',
  defaultReviewMonths: 12,
  cover: false,
  supportsStructuredEditor: true,
  supportsRichText: false,
  sections: [
    fieldsSection('content', 'Contenido', [area('proposito', 'Propósito', { required: true })]),
    repeatableSection('rows', 'Elementos', {
      label: 'Elementos',
      itemLabel: 'Elemento',
      addLabel: 'Agregar elemento',
      autoNumber: true,
      fields: [
        text('elemento', 'Elemento', { required: true }),
        text('criterio', 'Criterio', { required: true }),
        text('valoracion', 'Valoración', { placeholder: 'Opcional' }),
      ],
    }),
  ],
};

/** Documento libre (§19): conserva el editor enriquecido; sin secciones estructuradas. */
const FREE: DocumentTemplateDefinition = {
  type: 'other',
  label: 'Documento libre',
  description: 'Editor enriquecido sin estructura fija. Para documentos que no encajan en un tipo.',
  icon: 'documents',
  codePrefix: 'DO',
  defaultReviewMonths: null,
  cover: false,
  supportsStructuredEditor: false,
  supportsRichText: true,
  sections: [],
};

/** Registro ordenado (el orden se usa en el selector PASO 1). */
export const TEMPLATE_DEFINITIONS: DocumentTemplateDefinition[] = [
  PROCEDURE,
  POLICY,
  MANUAL,
  INSTRUCTION,
  PROGRAM,
  PLAN,
  FORM,
  SPECIFICATION,
  MATRIX,
  FREE,
];

const BY_TYPE = new Map<string, DocumentTemplateDefinition>(
  TEMPLATE_DEFINITIONS.map((t) => [t.type, t]),
);

/** Definición por tipo documental, o `null` si no hay plantilla registrada. */
export function getTemplateDefinition(type: string): DocumentTemplateDefinition | null {
  return BY_TYPE.get(type) ?? null;
}

/** ¿El tipo captura datos estructurados (editor por tipo)? */
export function isStructuredType(type: string): boolean {
  return getTemplateDefinition(type)?.supportsStructuredEditor ?? false;
}

/** Prefijo de código para un tipo (p. ej. `procedure` → `PR`). `DO` por defecto. */
export function codePrefixFor(type: string): string {
  return getTemplateDefinition(type)?.codePrefix ?? 'DO';
}

/** Periodo de revisión por defecto (meses) del tipo, o `null` si no fija fecha. */
export function defaultReviewMonthsFor(type: string): number | null {
  const def = getTemplateDefinition(type);
  return def ? def.defaultReviewMonths : 12;
}

/** Todos los prefijos registrados (para validación/documentación). */
export const CODE_PREFIXES: string[] = TEMPLATE_DEFINITIONS.map((t) => t.codePrefix);
