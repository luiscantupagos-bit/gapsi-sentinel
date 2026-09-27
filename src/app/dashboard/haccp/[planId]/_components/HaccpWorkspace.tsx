'use client';

/**
 * HACCP-001 / WORKSPACE-REORG — workspace del Plan HACCP organizado según la METODOLOGÍA HACCP:
 * 12 pestañas accesibles (WAI-ARIA) en dos grupos (5 pasos preliminares + 7 principios). El tab
 * activo persiste en `?tab=` sin recargar (history.replaceState) y admite deep links antiguos
 * mediante alias. El «Resumen» vive en el encabezado. Solo el borrador es editable; la versión
 * publicada es inmutable.
 */
import {
  useActionState,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  HACCP_TABS,
  HACCP_TAB_LABEL,
  HACCP_TAB_NUMBER,
  HACCP_TAB_GROUPS,
  HACCP_PLAN_STATUS_LABEL,
  HACCP_VERSION_STATUS_LABEL,
  HACCP_REFERENCE_KIND_LABEL,
  HACCP_PPR_CATEGORIES,
  HACCP_ROLE_SUGGESTIONS,
  type HaccpTab,
  type HaccpPlanStatus,
  type HaccpVersionStatus,
  type HaccpReferenceKind,
} from '@/features/haccp/haccp-state';
import type { getHaccpPlanDetail } from '@/server/haccp';
import type { getPlanFlow } from '@/server/haccp-flow';
import type { getProcessModel } from '@/server/haccp-process';
import type { getHazardAnalysis } from '@/server/haccp-hazards';
import type { getControlMeasures } from '@/server/haccp-control';
import type { getValidations } from '@/server/haccp-validation';
import type { getVerifications } from '@/server/haccp-verification';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { HaccpProcessTab } from './HaccpProcessTab';
import { HaccpHazardsTab } from './HaccpHazardsTab';
import { HaccpControlTab } from './HaccpControlTab';
import {
  HaccpLimitsView,
  HaccpMonitoringView,
  HaccpCorrectiveActionsView,
} from './HaccpControlFacets';
import { HaccpValidationVerificationTab } from './HaccpValidationVerificationTab';
import {
  addSourceAction,
  addTeamMemberAction,
  newVersionAction,
  publishPlanAction,
  removeSourceAction,
  removeTeamMemberAction,
  saveIntendedUseAction,
  updatePlanAction,
  updateSourceToLatestAction,
  type FormState,
} from '../../actions';

type HaccpDetail = Awaited<ReturnType<typeof getHaccpPlanDetail>>;
type FlowData = Awaited<ReturnType<typeof getPlanFlow>>;
type ProcessModelData = Awaited<ReturnType<typeof getProcessModel>>;
type HazardData = Awaited<ReturnType<typeof getHazardAnalysis>>;
type ControlData = Awaited<ReturnType<typeof getControlMeasures>>;
type ValidationData = Awaited<ReturnType<typeof getValidations>>;
type VerificationData = Awaited<ReturnType<typeof getVerifications>>;
type DocPick = { id: string; code: string; title: string; documentType: string; status: string };
type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

interface WorkspaceProps {
  data: HaccpDetail;
  initialTab: HaccpTab;
  documents: DocPick[];
  members: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
  flow: FlowData;
  processModel: ProcessModelData;
  hazards: HazardData;
  control: ControlData;
  validation: ValidationData;
  verification: VerificationData;
}

const EmptyState = ({ children }: { children: ReactNode }) => (
  <p className="empty-state empty-state--compact">{children}</p>
);

/** Formulario de acción de servidor con mensaje de estado. */
function ActionForm({
  action,
  hidden,
  button,
  children,
  variant = 'ghost',
  confirmClass,
}: {
  action: Action;
  hidden: Record<string, string>;
  button: string;
  children?: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  confirmClass?: string;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className={`wf-form ${confirmClass ?? ''}`}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <SubmitButton variant={variant === 'danger' ? 'ghost' : variant} pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && (
        <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}

export function HaccpWorkspace({
  data,
  initialTab,
  documents,
  members,
  sites,
  canEdit,
  isAdmin,
  flow,
  processModel,
  hazards,
  control,
  validation,
  verification,
}: WorkspaceProps) {
  const [active, setActive] = useState<HaccpTab>(initialTab);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = useCallback((tab: HaccpTab) => {
    setActive(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent, index: number) => {
      const map: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: HACCP_TABS.length - 1,
      };
      const next = map[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const tab = HACCP_TABS[(next + HACCP_TABS.length) % HACCP_TABS.length]!;
      select(tab);
      tabRefs.current[tab]?.focus();
    },
    [select],
  );

  return (
    <div className="doc-panel">
      {/* WORKSPACE-REORG: «Resumen del plan» en el encabezado (bloque superior colapsable). */}
      <details className="haccp-plansummary" open>
        <summary>Resumen del plan</summary>
        <PlanSummaryHeader
          data={data}
          flow={flow}
          sites={sites}
          members={members}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />
      </details>

      {/* WORKSPACE-REORG: 12 pestañas en dos grupos (pasos preliminares 1-5 · principios 6-12). */}
      <div className="haccp-tabgroups">
        {HACCP_TAB_GROUPS.map((group) => (
          <div key={group.title} className="haccp-tabgroup">
            <span className="haccp-tabgroup__title">{group.title}</span>
            <div
              className="doc-panel__tablist haccp-tabgroup__tabs"
              role="tablist"
              aria-label={`${group.title} — plan HACCP`}
            >
              {group.tabs.map((tab) => {
                const i = HACCP_TABS.indexOf(tab);
                const selected = tab === active;
                return (
                  <button
                    key={tab}
                    ref={(el) => {
                      tabRefs.current[tab] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`haccp-tab-${tab}`}
                    aria-selected={selected}
                    aria-controls={`haccp-panel-${tab}`}
                    tabIndex={selected ? 0 : -1}
                    className={`doc-panel__tab${selected ? ' is-active' : ''}`}
                    onClick={() => select(tab)}
                    onKeyDown={(e) => onKeyDown(e, i)}
                  >
                    <span className="haccp-tab__num">{HACCP_TAB_NUMBER[tab]}</span>{' '}
                    {HACCP_TAB_LABEL[tab]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {HACCP_TABS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={`haccp-panel-${tab}`}
          aria-labelledby={`haccp-tab-${tab}`}
          tabIndex={0}
          hidden={tab !== active}
          className="doc-panel__panel"
        >
          {tab === active && (
            <TabContent
              tab={tab}
              data={data}
              documents={documents}
              members={members}
              sites={sites}
              canEdit={canEdit}
              isAdmin={isAdmin}
              flow={flow}
              processModel={processModel}
              hazards={hazards}
              control={control}
              validation={validation}
              verification={verification}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function TabContent(props: {
  tab: HaccpTab;
  data: HaccpDetail;
  documents: DocPick[];
  members: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
  flow: FlowData;
  processModel: ProcessModelData;
  hazards: HazardData;
  control: ControlData;
  validation: ValidationData;
  verification: VerificationData;
}) {
  const planId = props.data.plan.id;
  const noVersion = <p className="empty-state empty-state--compact">Sin versión activa.</p>;
  const formDocs = props.documents
    .filter((d) => d.documentType === 'form')
    .map((d) => ({ id: d.id, code: d.code, title: d.title }));
  const allDocs = props.documents.map((d) => ({ id: d.id, code: d.code, title: d.title }));

  switch (props.tab) {
    // --- Pasos preliminares (1-5) ---
    case 'team':
      return <EquipoTab {...props} />;
    case 'product':
      // §2: consolida Producto terminado + Materias primas e insumos.
      return (
        <>
          <h3>Producto terminado</h3>
          <SourceTab {...props} kind="product" />
          <h3>Materias primas e insumos</h3>
          <SourceTab {...props} kind="material" />
        </>
      );
    case 'intended-use':
      return <IntendedUseTab planId={planId} data={props.data} canEdit={props.canEdit} />;
    case 'flow':
      return (
        <HaccpProcessTab
          planId={planId}
          model={props.processModel}
          flow={props.flow}
          members={props.members}
          canEdit={props.canEdit}
        />
      );
    // --- Principios HACCP (6-12) ---
    case 'hazards':
      return props.hazards ? (
        <>
          <HaccpHazardsTab planId={planId} analysis={props.hazards} canEdit={props.canEdit} />
          {/* §PPR: soporte transversal, acceso contextual (no ocupa una pestaña). */}
          <details className="haccp-ppr-context">
            <summary className="button button--ghost">Ver PPR relacionados</summary>
            <SourceTab {...props} kind="prerequisite" />
          </details>
        </>
      ) : (
        noVersion
      );
    case 'ccp':
      return props.control ? (
        <HaccpControlTab planId={planId} data={props.control} canEdit={props.canEdit} />
      ) : (
        noVersion
      );
    case 'limits':
      return props.control ? <HaccpLimitsView planId={planId} data={props.control} /> : noVersion;
    case 'monitoring':
      return props.control ? (
        <HaccpMonitoringView planId={planId} data={props.control} />
      ) : (
        noVersion
      );
    case 'corrective-actions':
      return props.control ? (
        <HaccpCorrectiveActionsView planId={planId} data={props.control} />
      ) : (
        noVersion
      );
    case 'validation-verification':
      return (
        <HaccpValidationVerificationTab
          planId={planId}
          validation={props.validation}
          verification={props.verification}
          members={props.members}
          documents={allDocs}
          formDocuments={formDocs}
          canEdit={props.canEdit}
        />
      );
    case 'records':
      // §12: consolida documentos soporte + acceso a registros digitales (DOC-004).
      return (
        <>
          <h3>Documentos soporte</h3>
          <SourceTab {...props} kind="document" />
          <p className="msg msg--info">
            Los registros digitales (formatos llenados) se gestionan en{' '}
            <Link href="/dashboard/records">Registros</Link>. Los formatos asociados a monitoreo y
            verificación conservan su versión exacta.
          </p>
        </>
      );
    default:
      return null;
  }
}

/**
 * WORKSPACE-REORG paso 3 + HACCP-CORE-DATA-GAPS §D — «Uso previsto». Formulario/lectura REAL con
 * los campos propios del estudio HACCP (version-owned). Publicado = solo lectura.
 */
const INTENDED_USE_FIELDS: {
  name: keyof NonNullable<HaccpDetail['active']> & string;
  label: string;
  area?: boolean;
}[] = [
  { name: 'intendedUse', label: 'Uso previsto del producto', area: true },
  { name: 'intendedConsumer', label: 'Consumidor previsto' },
  { name: 'sensitiveGroups', label: 'Grupos sensibles (si aplica)' },
  { name: 'usageConditions', label: 'Condiciones de uso / preparación', area: true },
  { name: 'distributionConditions', label: 'Condiciones relevantes de distribución' },
  { name: 'preparationOrHandling', label: 'Manipulación esperada (si aplica)' },
  {
    name: 'misuseConsiderations',
    label: 'Uso incorrecto razonablemente previsible (si aplica)',
    area: true,
  },
  { name: 'otherIntendedUseNotes', label: 'Observaciones', area: true },
];

function IntendedUseTab({
  planId,
  data,
  canEdit,
}: {
  planId: string;
  data: HaccpDetail;
  canEdit: boolean;
}) {
  const active = data.active;
  const editable = canEdit && Boolean(active?.editable);
  const value = (name: string) =>
    (active as Record<string, unknown> | null)?.[name] as string | null | undefined;
  const hasAny = INTENDED_USE_FIELDS.some((f) => value(f.name)?.trim());

  return (
    <>
      <p className="muted doc-panel__hint">
        Describe el uso previsto del producto y su consumidor. Esta información pertenece al estudio
        HACCP y se conserva por versión.
      </p>

      {!editable && !hasAny && (
        <p className="empty-state empty-state--compact">Uso previsto aún no documentado.</p>
      )}

      {!editable && hasAny && (
        <div className="haccp-plan-fields">
          {INTENDED_USE_FIELDS.map((f) =>
            value(f.name)?.trim() ? (
              <div key={f.name} className="doc-report__field">
                <span className="doc-report__field-label">{f.label}</span>
                <p>{value(f.name)}</p>
              </div>
            ) : null,
          )}
        </div>
      )}

      {editable && active && (
        <ActionForm
          action={saveIntendedUseAction}
          hidden={{ planId, planVersionId: active.id }}
          button="Guardar uso previsto"
          variant="primary"
        >
          {INTENDED_USE_FIELDS.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.area ? (
                <textarea name={f.name} rows={2} defaultValue={value(f.name) ?? ''} />
              ) : (
                <input name={f.name} defaultValue={value(f.name) ?? ''} />
              )}
            </label>
          ))}
        </ActionForm>
      )}
    </>
  );
}

/**
 * WORKSPACE-REORG — «Resumen» sale de las 12 pestañas y pasa al encabezado del plan (bloque
 * superior colapsable) sin perder funcionalidad: versión, estado, responsable, sitio, próxima
 * revisión y edición de datos del plan.
 */
function PlanSummaryHeader({
  data,
  flow,
  sites,
  members,
  canEdit,
  isAdmin,
}: {
  data: HaccpDetail;
  flow: FlowData;
  sites: { id: string; name: string }[];
  members: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const plan = data.plan;
  const active = data.active;
  // §17 — el diagrama de flujo y la confirmación in situ se evalúan POR SEPARADO (§16), aunque
  // compartan la pestaña «Diagrama de flujo».
  const flowComplete = flow.steps.length > 0;
  const onsiteConfirmed = Boolean(active?.flowVerifiedOnSite);
  return (
    <>
      <dl className="meta-grid haccp-readiness">
        <div>
          <dt>Diagrama de flujo (paso 4)</dt>
          <dd>
            <span className={`badge ${flowComplete ? 'badge--haccp-published' : 'badge--warn'}`}>
              {flowComplete ? 'Completo' : 'Pendiente'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Confirmación in situ (paso 5)</dt>
          <dd>
            <span className={`badge ${onsiteConfirmed ? 'badge--haccp-published' : 'badge--warn'}`}>
              {onsiteConfirmed ? 'Confirmado' : 'Pendiente'}
            </span>
          </dd>
        </div>
      </dl>
      <dl className="meta-grid">
        <div>
          <dt>Código</dt>
          <dd className="mono">{plan.code}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <span className={`badge badge--haccp-${plan.status}`}>
              {HACCP_PLAN_STATUS_LABEL[plan.status as HaccpPlanStatus] ?? plan.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Versión activa</dt>
          <dd>
            {active ? active.versionLabel : '—'}{' '}
            {active && (
              <span className="badge">
                {HACCP_VERSION_STATUS_LABEL[active.status as HaccpVersionStatus] ?? active.status}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{plan.siteName ?? '—'}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{plan.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Próxima revisión</dt>
          <dd>{plan.nextReviewAt ?? '—'}</dd>
        </div>
        <div>
          <dt>Producto / proceso</dt>
          <dd>{active?.productProcess ?? '—'}</dd>
        </div>
        <div>
          <dt>Fuentes actualizables</dt>
          <dd>{data.updatesAvailable > 0 ? `${data.updatesAvailable} con actualización` : '—'}</dd>
        </div>
      </dl>
      {plan.scope && <p className="lead">{plan.scope}</p>}

      <section className="haccp-cards">
        <div className="report-card">
          <h3>Equipo</h3>
          <p className="stat">{data.team.length}</p>
        </div>
        <div className="report-card">
          <h3>Materias primas</h3>
          <p className="stat">
            {data.references.filter((r) => r.referenceKind === 'material').length}
          </p>
        </div>
        <div className="report-card">
          <h3>PPR</h3>
          <p className="stat">
            {data.references.filter((r) => r.referenceKind === 'prerequisite').length}
          </p>
        </div>
        <div className="report-card">
          <h3>Documentos</h3>
          <p className="stat">
            {data.references.filter((r) => r.referenceKind === 'document').length}
          </p>
        </div>
      </section>

      {data.updatesAvailable > 0 && (
        <p className="msg msg--info">
          {data.updatesAvailable} fuente(s) tienen una versión publicada más reciente que la usada.
          Revisa las pestañas de Materias primas / PPR / Documentos para actualizarlas en el
          borrador.
        </p>
      )}

      {canEdit && (
        <>
          <h3>Editar datos del plan</h3>
          <ActionForm
            action={updatePlanAction}
            hidden={{ planId: plan.id }}
            button="Guardar cambios"
            variant="ghost"
          >
            <label>
              Nombre
              <input name="title" defaultValue={plan.title} maxLength={200} />
            </label>
            <label>
              Alcance
              <textarea name="scope" rows={2} defaultValue={plan.scope ?? ''} />
            </label>
            <label>
              Producto / proceso
              <input name="productProcess" defaultValue={active?.productProcess ?? ''} />
            </label>
            <label>
              Sitio
              <select name="siteId" defaultValue={plan.siteId ?? ''}>
                <option value="">— Sin sitio —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsable
              <select name="responsibleUserId" defaultValue={plan.responsibleUserId ?? ''}>
                <option value="">— Sin asignar —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>

          {active && active.editable && (
            <ActionForm
              action={publishPlanAction}
              hidden={{ planId: plan.id }}
              button="Publicar plan"
              variant="primary"
            >
              <span className="muted">
                Valida nombre, alcance, responsable, producto/proceso y equipo con líder. Sella las
                versiones exactas de las fuentes.
              </span>
            </ActionForm>
          )}
        </>
      )}

      {isAdmin && plan.status === 'published' && !active?.editable && (
        <>
          <h3>Nueva versión</h3>
          <ActionForm
            action={newVersionAction}
            hidden={{ planId: plan.id }}
            button="Crear nueva versión"
            variant="ghost"
          >
            <select name="bump" defaultValue="minor">
              <option value="minor">Cambio menor (x.Y)</option>
              <option value="major">Cambio mayor (X.0)</option>
            </select>
            <input name="changeNotes" placeholder="Descripción del cambio" />
          </ActionForm>
        </>
      )}

      <h3>Versiones</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Versión</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Publicada</th>
              <th>Modificación</th>
            </tr>
          </thead>
          <tbody>
            {data.versions.map((v) => (
              <tr key={v.id}>
                <td className="mono">{v.versionLabel}</td>
                <td>
                  <span className={`badge badge--haccpver-${v.status}`}>
                    {HACCP_VERSION_STATUS_LABEL[v.status as HaccpVersionStatus] ?? v.status}
                  </span>
                </td>
                <td>{v.createdAtLabel}</td>
                <td>{v.publishedAtLabel ?? '—'}</td>
                <td>{v.changeNotes ?? (v.versionLabel === 'v1.0' ? 'Versión inicial' : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EquipoTab({
  data,
  members,
  canEdit,
}: {
  data: HaccpDetail;
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const active = data.active;
  return (
    <>
      <p className="muted doc-panel__hint">
        Personas internas (usuarios de la organización) o externas (por nombre). Un solo líder por
        versión.
      </p>
      {data.team.length === 0 ? (
        <EmptyState>Sin integrantes registrados.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Área</th>
                <th>Puesto</th>
                <th>Rol HACCP</th>
                <th>Responsabilidad</th>
                <th>Capacitación</th>
                <th>Líder</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {data.team.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name ?? '—'}
                    {!m.isInternal && <span className="badge">Externa</span>}
                  </td>
                  <td>{m.area ?? '—'}</td>
                  <td>{m.jobTitle ?? '—'}</td>
                  <td>{m.haccpRole ?? '—'}</td>
                  <td>{m.responsibility ?? '—'}</td>
                  <td>{m.trainingSummary ?? '—'}</td>
                  <td>{m.isLeader ? 'Sí' : '—'}</td>
                  {canEdit && (
                    <td>
                      <ActionForm
                        action={removeTeamMemberAction}
                        hidden={{ planId: data.plan.id, memberId: m.id }}
                        button="Quitar"
                        variant="danger"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && active?.editable && (
        <>
          <h3>Agregar integrante</h3>
          <ActionForm
            action={addTeamMemberAction}
            hidden={{ planId: data.plan.id, planVersionId: active.id }}
            button="Agregar"
            variant="ghost"
          >
            <label>
              Persona interna
              <select name="userId" defaultValue="">
                <option value="">— Externa (usar nombre) —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre (si es externa)
              <input name="externalName" />
            </label>
            <label>
              Área
              <input name="area" />
            </label>
            <label>
              Puesto
              <input name="jobTitle" />
            </label>
            <label>
              Rol HACCP
              <input name="haccpRole" list="haccp-roles" />
              <datalist id="haccp-roles">
                {HACCP_ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
            <label>
              Responsabilidad
              <input name="responsibility" />
            </label>
            <label>
              Capacitación
              <input name="trainingSummary" />
            </label>
            <label className="props-check">
              <input type="checkbox" name="isLeader" /> Es líder HACCP
            </label>
          </ActionForm>
        </>
      )}
    </>
  );
}

function SourceTab({
  data,
  documents,
  canEdit,
  kind,
}: {
  data: HaccpDetail;
  documents: DocPick[];
  canEdit: boolean;
  kind: HaccpReferenceKind;
}) {
  const active = data.active;
  const rows = data.references.filter((r) => r.referenceKind === kind);
  const isProduct = kind === 'product';
  const label = HACCP_REFERENCE_KIND_LABEL[kind];

  return (
    <>
      <p className="muted doc-panel__hint">
        {isProduct
          ? 'Ficha/especificación del producto terminado (una por versión). Se guarda la versión exacta usada.'
          : `Referencias a documentos de la organización. Se guarda la versión exacta usada; si hay una versión publicada más reciente, se marca «Actualización disponible».`}
      </p>
      {rows.length === 0 ? (
        <EmptyState>Sin {label.toLowerCase()} registrado.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Versión usada</th>
                <th>Estado</th>
                {kind === 'prerequisite' && <th>Categoría</th>}
                <th>Actualización</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link href={`/dashboard/documents/${r.sourceDocumentId}`}>{r.code ?? '—'}</Link>
                  </td>
                  <td>{r.title ?? '—'}</td>
                  <td>{r.versionLabel ?? '—'}</td>
                  <td>{r.statusLabel ?? '—'}</td>
                  {kind === 'prerequisite' && <td>{r.category ?? '—'}</td>}
                  <td>
                    {r.updateAvailable ? (
                      <span className="badge badge--warn">
                        Disponible {r.latestVersionLabel ?? ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {canEdit && (
                    <td className="doc-panel__row-actions">
                      {r.updateAvailable && active?.editable && (
                        <ActionForm
                          action={updateSourceToLatestAction}
                          hidden={{ planId: data.plan.id, referenceId: r.id }}
                          button="Usar versión más reciente"
                          variant="ghost"
                        />
                      )}
                      <ActionForm
                        action={removeSourceAction}
                        hidden={{ planId: data.plan.id, referenceId: r.id }}
                        button="Quitar"
                        variant="danger"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && active?.editable && !(isProduct && rows.length > 0) && (
        <>
          <h3>Agregar {label.toLowerCase()}</h3>
          <ActionForm
            action={addSourceAction}
            hidden={{
              planId: data.plan.id,
              planVersionId: active.id,
              referenceKind: kind,
            }}
            button="Agregar"
            variant="ghost"
          >
            <label>
              Documento
              <select name="sourceDocumentId" required defaultValue="">
                <option value="" disabled>
                  — Selecciona —
                </option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.title}
                  </option>
                ))}
              </select>
            </label>
            {kind === 'prerequisite' && (
              <label>
                Categoría
                <input name="category" list="ppr-cats" />
                <datalist id="ppr-cats">
                  {HACCP_PPR_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            )}
            <label>
              Notas
              <input name="notes" />
            </label>
          </ActionForm>
        </>
      )}
    </>
  );
}
