import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { KPI_SOURCES, KPI_MEASURES, KPI_PERIODS } from '@/server/kpis';
import { EVENT_TYPES, EVENT_TYPE_LABEL } from '@/server/quality-events';
import {
  MEASURE_LABEL,
  PERIOD_LABEL,
  SOURCE_LABEL,
  DIRECTION_LABEL,
} from '@/features/analytics/labels';
import { PageHeader } from '../../_components/ui';
import { AnalyticsActionForm } from '../../analytics/_components/AnalyticsActionForm';
import { createKpiAction } from '../../analytics/actions';

const METRIC_FIELDS = [
  { field: 'cost', label: 'Costo' },
  { field: 'quantityAffected', label: 'Cantidad afectada' },
  { field: 'unitsProduced', label: 'Unidades producidas' },
  { field: 'durationHours', label: 'Duración (h)' },
  { field: 'npr', label: 'NPR (AMEF)' },
];

export default async function NewKpiPage() {
  await requireServerSession();
  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/kpis">← Volver a KPI</Link>
      </p>
      <PageHeader
        title="Nuevo KPI"
        subtitle="Define fuente, medida, filtros, periodicidad y meta. El resultado se calcula al guardar."
      />

      <AnalyticsActionForm
        action={createKpiAction}
        button="Crear y calcular"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Nombre</span>
          <input name="name" required placeholder="p. ej. No conformidades por mes" />
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción</span>
          <textarea name="description" rows={2} />
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Fuente</span>
            <select name="source" defaultValue="quality_events">
              {KPI_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Medida</span>
            <select name="measure" defaultValue="count">
              {KPI_MEASURES.map((m) => (
                <option key={m} value={m}>
                  {MEASURE_LABEL[m] ?? m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Campo métrico (suma/promedio/mediana)</span>
            <select name="measureField" defaultValue="">
              <option value="">— No aplica —</option>
              {METRIC_FIELDS.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Periodicidad</span>
            <select name="period" defaultValue="monthly">
              {KPI_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p] ?? p}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Filtrar por tipo de evento (opcional)</span>
            <select name="filterEventType" defaultValue="">
              <option value="">Todos</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Unidad</span>
            <input name="unit" placeholder="p. ej. %" />
          </label>
        </div>

        <fieldset className="fieldset">
          <legend>Meta y umbrales</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Dirección deseada</span>
              <select name="desiredDirection" defaultValue="lower">
                {Object.entries(DIRECTION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Meta</span>
              <input name="target" type="number" step="any" />
            </label>
            <label className="field">
              <span className="field__label">Umbral de alerta</span>
              <input name="warningThreshold" type="number" step="any" />
            </label>
            <label className="field">
              <span className="field__label">Umbral crítico</span>
              <input name="criticalThreshold" type="number" step="any" />
            </label>
          </div>
        </fieldset>
      </AnalyticsActionForm>
    </main>
  );
}
