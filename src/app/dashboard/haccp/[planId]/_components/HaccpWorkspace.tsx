'use client';

/**
 * HACCP-001 — workspace del Plan HACCP por TABS accesibles (WAI-ARIA). El tab activo
 * persiste en `?tab=` sin recargar (history.replaceState). Solo el borrador es editable; la
 * versión publicada es inmutable. Las fases futuras se muestran como «Próximamente».
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
  HACCP_FUTURE_TABS,
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
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { HaccpFlowTab } from './HaccpFlowTab';
import {
  addSourceAction,
  addTeamMemberAction,
  newVersionAction,
  publishPlanAction,
  removeSourceAction,
  removeTeamMemberAction,
  updatePlanAction,
  updateSourceToLatestAction,
  type FormState,
} from '../../actions';

type HaccpDetail = Awaited<ReturnType<typeof getHaccpPlanDetail>>;
type FlowData = Awaited<ReturnType<typeof getPlanFlow>>;
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
      <div className="doc-panel__tablist" role="tablist" aria-label="Secciones del plan HACCP">
        {HACCP_TABS.map((tab, i) => {
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
              {HACCP_TAB_LABEL[tab]}
            </button>
          );
        })}
        {HACCP_FUTURE_TABS.map((label) => (
          <button
            key={label}
            type="button"
            className="doc-panel__tab is-disabled"
            disabled
            title="Próximamente"
          >
            {label} · Próximamente
          </button>
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
}) {
  switch (props.tab) {
    case 'resumen':
      return <ResumenTab {...props} />;
    case 'equipo':
      return <EquipoTab {...props} />;
    case 'producto':
      return <SourceTab {...props} kind="product" />;
    case 'materias':
      return <SourceTab {...props} kind="material" />;
    case 'ppr':
      return <SourceTab {...props} kind="prerequisite" />;
    case 'documentos':
      return <SourceTab {...props} kind="document" />;
    case 'flujo':
      return (
        <HaccpFlowTab
          planId={props.data.plan.id}
          flow={props.flow}
          members={props.members}
          canEdit={props.canEdit}
        />
      );
    default:
      return null;
  }
}

function ResumenTab({
  data,
  sites,
  members,
  canEdit,
  isAdmin,
}: {
  data: HaccpDetail;
  sites: { id: string; name: string }[];
  members: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const plan = data.plan;
  const active = data.active;
  return (
    <>
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
