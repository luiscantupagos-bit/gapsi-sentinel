/**
 * WORKSPACE-REORG pasos 8/9/10 — presentaciones enfocadas del Plan de Control (mismos datos de
 * HACCP-004; sin cambios de modelo). La EDICIÓN del plan vive en el paso 7 «Determinación de PCC»;
 * aquí se presentan las facetas por principio HACCP: límites críticos, monitoreo y acciones
 * correctivas. El criterio de acción de un PPRO NO se llama «límite crítico».
 */
import Link from 'next/link';
import { classificationLabel } from '@/features/haccp/haccp-control';
import type { getControlMeasures } from '@/server/haccp-control';

type ControlData = NonNullable<Awaited<ReturnType<typeof getControlMeasures>>>;
type Assessment = ControlData['assessments'][number];

const editHint = (planId: string) => (
  <p className="muted doc-panel__hint">
    La edición del plan de control se realiza en el paso 7 «Determinación de PCC».{' '}
    <Link href={`/dashboard/haccp/${planId}?tab=ccp`}>Ir a Determinación de PCC</Link>.
  </p>
);

function ControlHeader({ a }: { a: Assessment }) {
  return (
    <header className="haccp-control-card__head">
      <strong>{a.hazardName}</strong>
      <span className={`badge badge--class-${a.classification}`}>
        {classificationLabel(a.classification)}
      </span>
      {a.needsReview && <span className="badge badge--warn">Revisión requerida</span>}
    </header>
  );
}

const field = (label: string, value: string | null | undefined) =>
  value && value.trim() ? (
    <div className="doc-report__field">
      <span className="doc-report__field-label">{label}</span>
      <p>{value}</p>
    </div>
  ) : (
    <div className="doc-report__field">
      <span className="doc-report__field-label">{label}</span>
      <p className="muted">Pendiente</p>
    </div>
  );

/** §8 — Límites críticos (PCC) y, por separado, Criterio de acción (PPRO). */
export function HaccpLimitsView({ planId, data }: { planId: string; data: ControlData }) {
  const pcc = data.pcc ?? [];
  const ppro = data.ppro ?? [];
  return (
    <>
      {editHint(planId)}
      <h3>Límites críticos (PCC)</h3>
      {pcc.length === 0 ? (
        <p className="empty-state empty-state--compact">No hay PCC determinados.</p>
      ) : (
        pcc.map((a) => (
          <section key={a.id} className="haccp-control-card">
            <ControlHeader a={a} />
            <div className="haccp-plan-fields">
              {field('Medida de control', a.plan?.controlMeasure)}
              {field('Límite crítico', a.plan?.criticalLimit)}
              {field('Registro asociado', a.plan?.recordReference)}
            </div>
          </section>
        ))
      )}

      <h3>Criterio de acción (PPRO)</h3>
      <p className="muted">El criterio de acción de un PPRO no es un límite crítico.</p>
      {ppro.length === 0 ? (
        <p className="empty-state empty-state--compact">No hay PPRO determinados.</p>
      ) : (
        ppro.map((a) => (
          <section key={a.id} className="haccp-control-card">
            <ControlHeader a={a} />
            <div className="haccp-plan-fields">
              {field('Medida de control', a.plan?.controlMeasure)}
              {field('Criterio de acción', a.plan?.actionCriterion)}
            </div>
          </section>
        ))
      )}
    </>
  );
}

/** §9 — Monitoreo (PCC y PPRO): qué, cómo, quién, cuándo, registro asociado. */
export function HaccpMonitoringView({ planId, data }: { planId: string; data: ControlData }) {
  const controls = [...(data.pcc ?? []), ...(data.ppro ?? [])];
  return (
    <>
      {editHint(planId)}
      {controls.length === 0 ? (
        <p className="empty-state empty-state--compact">No hay PCC/PPRO para monitorear.</p>
      ) : (
        controls.map((a) => (
          <section key={a.id} className="haccp-control-card">
            <ControlHeader a={a} />
            <div className="haccp-plan-fields">
              {field('Qué', a.plan?.monitoringWhat)}
              {field('Cómo', a.plan?.monitoringHow)}
              {field('Quién', a.plan?.monitoringWho)}
              {field('Cuándo / frecuencia', a.plan?.monitoringWhen)}
              {field('Registro de monitoreo', a.plan?.recordReference)}
            </div>
            {!a.plan?.recordReference && (
              <p className="muted">
                Registro de monitoreo: sin configurar (los formatos digitales se gestionan en
                DOC-004).
              </p>
            )}
          </section>
        ))
      )}
    </>
  );
}

/** §10 — Acciones correctivas: corrección, acción correctiva y registro asociado. */
export function HaccpCorrectiveActionsView({
  planId,
  data,
}: {
  planId: string;
  data: ControlData;
}) {
  const controls = [...(data.pcc ?? []), ...(data.ppro ?? [])];
  return (
    <>
      {editHint(planId)}
      {controls.length === 0 ? (
        <p className="empty-state empty-state--compact">
          No hay PCC/PPRO con acciones correctivas.
        </p>
      ) : (
        controls.map((a) => (
          <section key={a.id} className="haccp-control-card">
            <ControlHeader a={a} />
            <div className="haccp-plan-fields">
              {field('Corrección inmediata', a.plan?.correction)}
              {field('Disposición del producto/material', a.plan?.disposition)}
              {field('Acción correctiva', a.plan?.correctiveAction)}
              {field('Registro asociado', a.plan?.recordReference)}
            </div>
          </section>
        ))
      )}
      <p className="muted doc-panel__hint">
        Corrección = acción inmediata sobre la desviación · Disposición = qué se hace con el
        producto/material afectado · Acción correctiva = elimina la causa y previene la recurrencia.
        El escalamiento a Hallazgo / CAPA se conectará como seguimiento; no se crea un flujo
        paralelo.
      </p>
    </>
  );
}
