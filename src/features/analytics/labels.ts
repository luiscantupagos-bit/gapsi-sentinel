// TASK-011 — Etiquetas en español para la UI de analítica (presentación).

export const MEASURE_LABEL: Record<string, string> = {
  count: 'Conteo',
  sum: 'Suma',
  average: 'Promedio',
  median: 'Mediana',
  percentage: 'Porcentaje',
  rate: 'Tasa',
  proportion: 'Proporción',
  avg_duration: 'Duración promedio',
  compliance: 'Cumplimiento',
  recurrence: 'Recurrencia',
};

export const PERIOD_LABEL: Record<string, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export const SOURCE_LABEL: Record<string, string> = {
  quality_events: 'Eventos de calidad',
  capa: 'CAPA',
  audits: 'Auditorías',
  findings: 'Hallazgos',
  tasks: 'Tareas',
  projects: 'Proyectos',
  documents: 'Documentos',
};

export const KPI_STATUS_LABEL: Record<string, string> = {
  on_target: 'En meta',
  warning: 'Alerta',
  off_target: 'Fuera de meta',
  no_data: 'Sin dato',
};

export const KPI_STATUS_TONE: Record<string, 'default' | 'danger' | 'warning' | 'success'> = {
  on_target: 'success',
  warning: 'warning',
  off_target: 'danger',
  no_data: 'default',
};

export const DIRECTION_LABEL: Record<string, string> = {
  higher: 'Mayor es mejor',
  lower: 'Menor es mejor',
  target: 'Cercano al objetivo',
};

export const TREND_LABEL: Record<string, string> = {
  increasing: 'Creciente ↑',
  decreasing: 'Decreciente ↓',
  stable: 'Estable →',
  insufficient: 'Datos insuficientes',
};

export const UNIFIED_SOURCE_LABEL: Record<string, string> = {
  quality_event: 'Evento nativo',
  capa: 'CAPA',
  capa_action: 'Acción CAPA',
  audit_finding: 'Hallazgo',
  task: 'Tarea',
  project: 'Proyecto',
  fmea_row: 'AMEF',
  analysis: 'Análisis',
};
