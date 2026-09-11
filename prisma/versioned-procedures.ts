/**
 * SEED / DEMO documental — datos PUROS de 3 procedimientos completos con versionado
 * formal real (1.0 / 2.0 / 3.0). Sin dependencias de Prisma: el seed (`seed.ts`) los
 * persiste y las pruebas (`tests/versioned-procedures.test.ts`) validan sus invariantes
 * (herencia entre versiones mayores, inmutabilidad del histórico, etiquetas, etc.).
 *
 * Regla de versión demostrada por los datos:
 * - MENOR (x.y): no cambia objetivo, alcance sustancial, responsabilidades críticas ni
 *   el proceso. Ejemplos: redacción, formato, referencia, ortografía.
 * - MAYOR (x.0): cambio sustancial del proceso/alcance/responsabilidades, etapa nueva,
 *   criterios de aceptación/rechazo, cambio regulatorio, rediseño de flujo.
 * Cada versión mayor HEREDA el contenido de la anterior (spread) y agrega secciones.
 */

export type ProcResp = { responsable: string; responsabilidad: string };
export type ProcAct = { nombre: string; descripcion: string; responsable?: string };
export interface ProcContent {
  fields: { objetivo: string; alcance: string };
  repeatables: { responsibilities: ProcResp[]; activities: ProcAct[] };
}
export interface ProcVersionSeed {
  label: string;
  status: 'published' | 'obsolete';
  changeNotes: string;
  issuedAt: string; // yyyy-mm-dd
  content: ProcContent;
}
export interface VersionedProcSeed {
  n: number;
  code: string;
  title: string;
  areaCode: string;
  areaName: string;
  versions: ProcVersionSeed[]; // orden viejo→nuevo; la última es la vigente
}

/** Suma un año a una fecha ISO `yyyy-mm-dd` conservando mes y día. */
export const addYear = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${Number(y) + 1}-${m}-${d}`;
};
/** Secuencia numérica final de un código `PR-CA-004` → 4. */
export const seqFromCode = (code: string): number => Number(code.slice(-3)) || 0;

// === A. Procedimiento para elaboración de documentos (solo v1.0, vigente) ======
const ELAB_V1: ProcContent = {
  fields: {
    objetivo:
      'Establecer el método para elaborar, codificar, revisar, aprobar, publicar, modificar y controlar los documentos del sistema de gestión, asegurando que en cada actividad se utilice únicamente la versión vigente y que el histórico de versiones se conserve de forma íntegra e inmutable.',
    alcance:
      'Aplica a todos los documentos controlados del sistema de gestión de la organización: procedimientos, políticas, manuales, instructivos, programas, planes y formatos, tanto de origen interno como externo, en todas las áreas y sitios.',
  },
  repeatables: {
    responsibilities: [
      {
        responsable: 'Dirección General',
        responsabilidad:
          'Aprobar la política de control documental y los documentos de primer nivel del sistema de gestión.',
      },
      {
        responsable: 'Responsable de Calidad',
        responsabilidad:
          'Administrar el control documental: codificación, publicación, distribución, copias controladas e histórico de versiones.',
      },
      {
        responsable: 'Autor del documento',
        responsabilidad: 'Elaborar y mantener actualizado el contenido técnico del documento.',
      },
      {
        responsable: 'Revisor',
        responsabilidad:
          'Revisar la exactitud técnica y la claridad del documento antes de su aprobación.',
      },
      {
        responsable: 'Aprobador',
        responsabilidad: 'Aprobar el documento para su publicación y puesta en vigor.',
      },
      {
        responsable: 'Usuarios',
        responsabilidad:
          'Utilizar únicamente la versión vigente y resguardar adecuadamente las copias controladas recibidas.',
      },
    ],
    activities: [
      {
        nombre: 'Creación',
        descripcion:
          'Elaborar el documento utilizando la plantilla estructurada que corresponde a su tipo (procedimiento, política, manual, instructivo, programa, plan o formato).',
        responsable: 'Autor del documento',
      },
      {
        nombre: 'Codificación',
        descripcion:
          'Asignar el código con la estructura [TIPO]-[ÁREA]-[###] de forma consecutiva y única dentro de la organización.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Revisión',
        descripcion:
          'Revisar el contenido técnico y su claridad; devolver al autor si se requieren cambios.',
        responsable: 'Revisor',
      },
      {
        nombre: 'Aprobación',
        descripcion:
          'Aprobar el documento por el responsable facultado, dejando registro de la aprobación.',
        responsable: 'Aprobador',
      },
      {
        nombre: 'Publicación',
        descripcion:
          'Publicar la versión aprobada como vigente y marcar como obsoleta la versión anterior para evitar su uso.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Distribución',
        descripcion:
          'Distribuir el documento vigente a las áreas y puestos que lo requieren para operar.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Copias controladas',
        descripcion:
          'Emitir copias controladas identificadas con folio y área destino, y recuperar o inutilizar las copias obsoletas.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Documentos externos',
        descripcion:
          'Identificar y controlar los documentos de origen externo (normas, reglamentos, fichas técnicas) que impactan al sistema.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Modificación',
        descripcion:
          'Modificar el documento generando una nueva versión; nunca se altera ni se sobrescribe una versión ya publicada.',
        responsable: 'Autor del documento',
      },
      {
        nombre: 'Control de cambios',
        descripcion:
          'Registrar en el control de cambios una línea por cada versión formal publicada, no por cada guardado de borrador; la versión inicial se registra como "Documento nuevo".',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Regla de versión menor (x.y)',
        descripcion:
          'Aplicar un cambio MENOR (por ejemplo 1.0 → 1.1 → 1.2) cuando el cambio NO modifica el objetivo, ni el alcance de forma sustancial, ni las responsabilidades críticas, ni la lógica del proceso, ni los requisitos regulatorios principales, ni introduce un flujo operativo nuevo. Ejemplos: corrección de redacción, mejora de claridad, cambio de formato, cambio menor de responsable o de contacto, ajuste de un paso sin cambiar la lógica, actualización de una referencia o corrección ortográfica.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Ejemplo de cambio menor',
        descripcion:
          '"Se aclara el criterio de identificación de documentos obsoletos." Resultado: v1.0 → v1.1 (no cambia el proceso ni el alcance).',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Regla de versión mayor (x.0)',
        descripcion:
          'Aplicar un cambio MAYOR (por ejemplo 1.0 → 2.0 → 3.0) cuando existe un cambio sustancial del proceso, del alcance o de las responsabilidades principales; la incorporación de una etapa nueva; un cambio en los criterios de aceptación o rechazo; un cambio regulatorio relevante; un rediseño del flujo; una nueva metodología; o un cambio importante de controles que pueda afectar el entrenamiento o el cumplimiento.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Ejemplo de cambio mayor',
        descripcion:
          '"Se incorpora una nueva etapa de revisión y aprobación electrónica y se modifica el flujo de control documental." Resultado: v1.0 → v2.0.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Tabla comparativa de versionado',
        descripcion:
          'Corrección ortográfica · Menor · 1.0 → 1.1. Aclaración de instrucción · Menor · 1.1 → 1.2. Cambio de responsable sin cambiar el proceso · Menor · 1.2 → 1.3. Nueva etapa en el proceso · Mayor · 1.3 → 2.0. Cambio de alcance · Mayor · 2.0 → 3.0. Cambio regulatorio que modifica el proceso · Mayor · 3.0 → 4.0.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Obsolescencia',
        descripcion:
          'Identificar, retirar y marcar como obsoletos los documentos que dejan de estar vigentes, evitando su uso no intencional.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Conservación',
        descripcion: 'Conservar el histórico completo de versiones de forma íntegra e inmutable.',
        responsable: 'Responsable de Calidad',
      },
      {
        nombre: 'Revisión periódica',
        descripcion:
          'Revisar los documentos en la periodicidad definida (por defecto 12 meses) y actualizarlos cuando proceda.',
        responsable: 'Responsable de Calidad',
      },
    ],
  },
};

// === B. Aceptación o rechazo de materias primas (v1.0 obsoleta, v2.0 vigente) ==
const MP_V1: ProcContent = {
  fields: {
    objetivo:
      'Establecer el método para recibir, inspeccionar y dictaminar la aceptación o el rechazo de las materias primas, evitando el uso o la liberación de materia prima que no cumple las especificaciones.',
    alcance:
      'Aplica a todas las materias primas e insumos que ingresan a la organización, desde su recepción hasta su liberación, rechazo o devolución.',
  },
  repeatables: {
    responsibilities: [
      {
        responsable: 'Almacén / Recepción',
        responsabilidad:
          'Recibir la materia prima, verificar la documentación de entrega y resguardar los lotes.',
      },
      {
        responsable: 'Inspector de Calidad',
        responsabilidad:
          'Realizar la inspección visual, el muestreo y la comparación contra especificaciones.',
      },
      {
        responsable: 'Jefe de Calidad',
        responsabilidad: 'Autorizar la liberación o el rechazo de la materia prima.',
      },
      {
        responsable: 'Supervisor de Producción',
        responsabilidad: 'No utilizar materia prima en cuarentena o rechazada.',
      },
      {
        responsable: 'Compras',
        responsabilidad:
          'Gestionar la devolución al proveedor y la reposición del material rechazado.',
      },
    ],
    activities: [
      {
        nombre: 'Recepción',
        descripcion:
          'Recibir la materia prima e identificar proveedor, producto y cantidad contra la orden de compra.',
        responsable: 'Almacén / Recepción',
      },
      {
        nombre: 'Documentación requerida',
        descripcion:
          'Verificar factura, remisión y el certificado del proveedor cuando aplique al tipo de insumo.',
        responsable: 'Almacén / Recepción',
      },
      {
        nombre: 'Identificación de lote',
        descripcion:
          'Registrar número de lote, fecha de caducidad y proveedor en la bitácora de recepción.',
        responsable: 'Almacén / Recepción',
      },
      {
        nombre: 'Revisión visual',
        descripcion:
          'Inspeccionar color, olor, presencia de materia extraña y estado general del material.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Integridad del empaque',
        descripcion: 'Verificar que el empaque esté íntegro, limpio y correctamente etiquetado.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Condiciones de transporte',
        descripcion:
          'Verificar la limpieza del transporte y, cuando aplique, la temperatura de llegada del producto.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Muestreo',
        descripcion: 'Tomar una muestra representativa del lote conforme al plan de muestreo.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Inspección',
        descripcion:
          'Comparar los resultados del muestreo contra las especificaciones de la materia prima.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Criterios de aceptación',
        descripcion:
          'Aceptar el lote cuando cumple especificaciones, integridad de empaque y documentación completa.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Criterios de rechazo',
        descripcion:
          'Rechazar el lote ante desviación de especificación, empaque dañado o documentación faltante.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Cuarentena',
        descripcion:
          'Mantener en área identificada el lote pendiente de dictamen y prohibir su uso hasta la resolución.',
        responsable: 'Almacén / Recepción',
      },
      {
        nombre: 'Liberación, rechazo y devolución',
        descripcion:
          'Liberar el lote aceptado, o identificar y gestionar la devolución del lote rechazado.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Registro y trazabilidad',
        descripcion:
          'Registrar el dictamen y conservar la trazabilidad por lote de la materia prima.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Producto no conforme',
        descripcion: 'Tratar el lote rechazado conforme al control de producto no conforme.',
        responsable: 'Jefe de Calidad',
      },
    ],
  },
};
const MP_V2: ProcContent = {
  fields: {
    objetivo: MP_V1.fields.objetivo,
    alcance:
      MP_V1.fields.alcance +
      ' Incorpora criterios diferenciados por criticidad de la materia prima y la liberación formal por Calidad.',
  },
  repeatables: {
    responsibilities: [
      ...MP_V1.repeatables.responsibilities,
      {
        responsable: 'Calidad (Liberación)',
        responsabilidad:
          'Emitir la liberación documentada por Calidad antes del uso de la materia prima.',
      },
    ],
    activities: [
      ...MP_V1.repeatables.activities,
      {
        nombre: 'Clasificación del proveedor',
        descripcion:
          'Confirmar si el proveedor del lote es aprobado, en prueba o condicionado antes de aceptar el material.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Evaluación por criticidad',
        descripcion:
          'Aplicar criterios de aceptación diferenciados según la criticidad de la materia prima (crítica o no crítica).',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Revisión de COA',
        descripcion:
          'Revisar el certificado de análisis (COA) del lote y contrastarlo con la especificación aplicable.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Lote retenido',
        descripcion:
          'Identificar como retenido el lote que requiere análisis adicional y controlar su liberación posterior.',
        responsable: 'Almacén / Recepción',
      },
      {
        nombre: 'Decisión de dictamen',
        descripcion:
          'Emitir el dictamen del lote: Aceptado, Aceptado condicional o Rechazado, con su justificación.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Análisis externo',
        descripcion:
          'Enviar el lote a laboratorio externo cuando el análisis interno no sea concluyente.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Liberación por Calidad',
        descripcion:
          'Registrar la liberación formal por Calidad como paso obligatorio previo al uso del lote.',
        responsable: 'Calidad (Liberación)',
      },
      {
        nombre: 'Trazabilidad reforzada por lote',
        descripcion:
          'Vincular lote, proveedor, COA y dictamen para asegurar la trazabilidad completa de la materia prima.',
        responsable: 'Inspector de Calidad',
      },
    ],
  },
};

// === C. Selección y evaluación de proveedores (v1.0/v2.0 obsoletas, v3.0 vigente)
const PROV_V1: ProcContent = {
  fields: {
    objetivo:
      'Establecer el método para dar de alta, seleccionar, evaluar y reevaluar a los proveedores, asegurando que la organización trabaje con proveedores capaces de cumplir los requisitos de calidad, servicio y entrega.',
    alcance:
      'Aplica a los proveedores de materias primas, insumos y servicios que impactan la calidad e inocuidad del producto.',
  },
  repeatables: {
    responsibilities: [
      {
        responsable: 'Compras',
        responsabilidad: 'Dar de alta y gestionar la relación comercial con el proveedor.',
      },
      {
        responsable: 'Jefe de Calidad',
        responsabilidad: 'Aprobar, condicionar o rechazar al proveedor con base en su evaluación.',
      },
      {
        responsable: 'Almacén / Recepción',
        responsabilidad: 'Reportar las incidencias de recepción asociadas al proveedor.',
      },
      {
        responsable: 'Dirección',
        responsabilidad: 'Autorizar excepciones y decisiones sobre proveedores críticos.',
      },
    ],
    activities: [
      {
        nombre: 'Alta de proveedor',
        descripcion: 'Registrar los datos del proveedor y el tipo de suministro que provee.',
        responsable: 'Compras',
      },
      {
        nombre: 'Clasificación',
        descripcion: 'Clasificar al proveedor como aprobado, en prueba, condicionado o rechazado.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Documentación',
        descripcion: 'Solicitar y verificar la documentación legal y de calidad del proveedor.',
        responsable: 'Compras',
      },
      {
        nombre: 'Evaluación inicial',
        descripcion: 'Evaluar al proveedor antes de la primera compra para autorizar su alta.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Criterio: calidad',
        descripcion: 'Evaluar la calidad del producto y el cumplimiento de la especificación.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Criterio: precio',
        descripcion: 'Evaluar la competitividad del precio del proveedor.',
        responsable: 'Compras',
      },
      {
        nombre: 'Criterio: servicio',
        descripcion:
          'Evaluar la atención, la comunicación y la capacidad de respuesta del proveedor.',
        responsable: 'Compras',
      },
      {
        nombre: 'Criterio: tiempo de entrega',
        descripcion: 'Evaluar el cumplimiento de los tiempos de entrega comprometidos.',
        responsable: 'Almacén / Recepción',
      },
      {
        nombre: 'Criterio: cumplimiento documental',
        descripcion:
          'Evaluar la entrega oportuna de COA, fichas técnicas y documentación requerida.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Desempeño y no conformidades',
        descripcion: 'Registrar los rechazos y las no conformidades atribuibles al proveedor.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Reevaluación',
        descripcion:
          'Reevaluar periódicamente a los proveedores aprobados para confirmar su desempeño.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Suspensión',
        descripcion: 'Suspender al proveedor cuyo desempeño sea deficiente o reincidente.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Reactivación',
        descripcion:
          'Reactivar al proveedor una vez que evidencia las acciones correctivas comprometidas.',
        responsable: 'Jefe de Calidad',
      },
    ],
  },
};
const PROV_V2: ProcContent = {
  fields: {
    objetivo: PROV_V1.fields.objetivo,
    alcance:
      PROV_V1.fields.alcance +
      ' Incorpora una evaluación ponderada por scoring y la clasificación por criticidad del insumo.',
  },
  repeatables: {
    responsibilities: [
      ...PROV_V1.repeatables.responsibilities,
      {
        responsable: 'Calidad',
        responsabilidad:
          'Dar seguimiento a las acciones correctivas del proveedor (CAPA de proveedor).',
      },
    ],
    activities: [
      ...PROV_V1.repeatables.activities,
      {
        nombre: 'Scoring ponderado',
        descripcion:
          'Calcular la calificación del proveedor ponderando calidad, servicio, precio y tiempo de entrega.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Clasificación por criticidad',
        descripcion: 'Clasificar al proveedor según la criticidad del insumo que suministra.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Criterios mínimos de aprobación',
        descripcion: 'Definir el puntaje mínimo requerido para aprobar y mantener a un proveedor.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Evaluación periódica',
        descripcion:
          'Ejecutar la evaluación de desempeño del proveedor en una frecuencia definida.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Criterios de suspensión',
        descripcion:
          'Suspender al proveedor que no alcanza el puntaje mínimo o que reincide en rechazos.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Vínculo con rechazos de MP',
        descripcion: 'Relacionar los rechazos de materia prima con el desempeño del proveedor.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Seguimiento CAPA proveedor',
        descripcion: 'Dar seguimiento a las acciones correctivas comprometidas por el proveedor.',
        responsable: 'Calidad',
      },
    ],
  },
};
const PROV_V3: ProcContent = {
  fields: {
    objetivo: PROV_V2.fields.objetivo,
    alcance:
      PROV_V2.fields.alcance +
      ' Incorpora evaluación por riesgo, auditorías a proveedores críticos e indicadores de desempeño.',
  },
  repeatables: {
    responsibilities: [
      ...PROV_V2.repeatables.responsibilities,
      {
        responsable: 'Dirección',
        responsabilidad: 'Autorizar las auditorías a proveedores críticos y los escalamientos.',
      },
    ],
    activities: [
      ...PROV_V2.repeatables.activities,
      {
        nombre: 'Evaluación de riesgo',
        descripcion:
          'Evaluar el riesgo del proveedor por impacto y probabilidad de falla del suministro.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Auditoría a proveedores críticos',
        descripcion:
          'Auditar a los proveedores clasificados como críticos según su nivel de riesgo.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Indicadores de desempeño',
        descripcion: 'Medir indicadores de calidad, entrega y servicio por proveedor.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Tendencia de desempeño',
        descripcion: 'Analizar la tendencia del desempeño del proveedor a lo largo del tiempo.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Niveles de proveedor',
        descripcion:
          'Clasificar al proveedor en Preferente, Aprobado, Condicionado, En prueba, Suspendido o Rechazado.',
        responsable: 'Jefe de Calidad',
      },
      {
        nombre: 'Historial de incumplimientos',
        descripcion: 'Mantener el historial de incumplimientos y no conformidades del proveedor.',
        responsable: 'Inspector de Calidad',
      },
      {
        nombre: 'Reactivación y escalamiento',
        descripcion:
          'Definir la reactivación tras acciones correctivas efectivas y el escalamiento a Dirección cuando proceda.',
        responsable: 'Dirección',
      },
      {
        nombre: 'Integración con trazabilidad',
        descripcion: 'Prever la integración futura con las recepciones y la trazabilidad de lotes.',
        responsable: 'Jefe de Calidad',
      },
    ],
  },
};

export const VERSIONED_PROCEDURES: VersionedProcSeed[] = [
  {
    n: 1,
    code: 'PR-CA-002',
    title: 'Procedimiento para elaboración de documentos',
    areaCode: 'CA',
    areaName: 'Calidad',
    versions: [
      {
        label: 'v1.0',
        status: 'published',
        changeNotes: 'Documento nuevo.',
        issuedAt: '2026-01-15',
        content: ELAB_V1,
      },
    ],
  },
  {
    n: 2,
    code: 'PR-CA-003',
    title: 'Procedimiento de aceptación o rechazo de materias primas',
    areaCode: 'CA',
    areaName: 'Calidad',
    versions: [
      {
        label: 'v1.0',
        status: 'obsolete',
        changeNotes: 'Documento nuevo.',
        issuedAt: '2025-03-01',
        content: MP_V1,
      },
      {
        label: 'v2.0',
        status: 'published',
        changeNotes:
          'Se incorpora evaluación por criticidad, revisión de COA, liberación por Calidad y flujo reforzado de cuarentena/rechazo.',
        issuedAt: '2026-04-01',
        content: MP_V2,
      },
    ],
  },
  {
    n: 3,
    code: 'PR-CA-004',
    title: 'Procedimiento para selección y evaluación de proveedores',
    areaCode: 'CA',
    areaName: 'Calidad',
    versions: [
      {
        label: 'v1.0',
        status: 'obsolete',
        changeNotes: 'Documento nuevo.',
        issuedAt: '2025-02-01',
        content: PROV_V1,
      },
      {
        label: 'v2.0',
        status: 'obsolete',
        changeNotes:
          'Se incorpora evaluación ponderada, clasificación por criticidad y criterios de suspensión.',
        issuedAt: '2025-09-01',
        content: PROV_V2,
      },
      {
        label: 'v3.0',
        status: 'published',
        changeNotes:
          'Se incorpora evaluación por riesgo, auditorías a proveedores críticos, indicadores de desempeño y criterios de reactivación/escalamiento.',
        issuedAt: '2026-05-01',
        content: PROV_V3,
      },
    ],
  },
];
