import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listEventCategories, EVENT_TYPES, EVENT_TYPE_LABEL } from '@/server/quality-events';
import { PageHeader } from '../../_components/ui';
import { AnalyticsActionForm } from '../../analytics/_components/AnalyticsActionForm';
import { createQualityEventAction } from '../../analytics/actions';

export default async function NewQualityEventPage() {
  const session = await requireServerSession();
  const categories = await listEventCategories(session.organizationId);

  return (
    <main className="container container--narrow">
      <p>
        <Link href="/dashboard/quality-events">← Volver a eventos</Link>
      </p>
      <PageHeader
        title="Registrar evento de calidad"
        subtitle="Captura el dato una sola vez; se reutiliza en KPI, Pareto, tendencias y estadística."
      />

      <AnalyticsActionForm
        action={createQualityEventAction}
        button="Registrar evento"
        variant="primary"
        className="doc-form"
      >
        <label className="field field--full">
          <span className="field__label">Título</span>
          <input name="title" required placeholder="Describe el evento" />
        </label>
        <label className="field field--full">
          <span className="field__label">Descripción</span>
          <textarea name="description" rows={3} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Tipo</span>
            <select name="eventType" defaultValue="deviation">
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Fecha del evento</span>
            <input name="eventDate" type="date" />
          </label>
          <label className="field">
            <span className="field__label">Severidad</span>
            <select name="severity" defaultValue="medium">
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Categoría</span>
            <select name="categoryId" defaultValue="">
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="fieldset">
          <legend>Dimensiones (provisionales)</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Área</span>
              <input name="area" placeholder="p. ej. Producción" />
            </label>
            <label className="field">
              <span className="field__label">Proceso</span>
              <input name="process" placeholder="p. ej. Llenado" />
            </label>
            <label className="field">
              <span className="field__label">Producto</span>
              <input name="productText" />
            </label>
            <label className="field">
              <span className="field__label">Máquina</span>
              <input name="machineText" />
            </label>
            <label className="field">
              <span className="field__label">Turno</span>
              <input name="shiftText" />
            </label>
            <label className="field">
              <span className="field__label">Proveedor</span>
              <input name="supplierText" />
            </label>
            <label className="field">
              <span className="field__label">Lote</span>
              <input name="lotText" />
            </label>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Métricas (opcionales)</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Cantidad afectada</span>
              <input name="quantityAffected" type="number" step="any" min="0" />
            </label>
            <label className="field">
              <span className="field__label">Unidades producidas</span>
              <input name="unitsProduced" type="number" step="any" min="0" />
            </label>
            <label className="field">
              <span className="field__label">Costo</span>
              <input name="cost" type="number" step="any" min="0" />
            </label>
            <label className="field">
              <span className="field__label">Duración (h)</span>
              <input name="durationHours" type="number" step="any" min="0" />
            </label>
          </div>
        </fieldset>
      </AnalyticsActionForm>
    </main>
  );
}
