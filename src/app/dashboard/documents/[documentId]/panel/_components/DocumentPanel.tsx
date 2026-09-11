'use client';

/**
 * DOC-UX-PANEL-001 — Panel del documento reorganizado por TABS (administración /
 * gobierno / trazabilidad / ciclo de vida), en lugar de una página vertical infinita.
 * La «vista del documento» (contenido/lectura/edición/salida) vive en otras rutas.
 *
 * Tabs accesibles (WAI-ARIA): role tablist/tab/tabpanel, roving tabindex, navegación
 * por flechas/Home/End y activación automática. El tab activo persiste en `?tab=` sin
 * recargar datos (history.replaceState); los datos se resuelven server-side una vez.
 */
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { PANEL_TABS, PANEL_TAB_LABEL, type PanelTab } from '@/features/documents/panel-view';
import { DocumentActions } from '../../DocumentActions';
import { WorkflowPanel } from '../../WorkflowPanel';
import { recoverCopyForm } from '../../../workflow-actions';

// --- Formas serializables que arma la página server ---------------------------
export interface PanelVersionRow {
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  isCurrent: boolean;
  /** Texto de la columna «Modificación» (change_notes o «Documento nuevo» para v1.0). */
  modification: string;
  createdAtLabel: string;
  authorName: string | null;
  fileCount: number;
}
export interface PanelStepRow {
  id: string;
  roleLabel: string;
  userName: string;
  sequence: number;
  statusLabel: string;
  dueLabel: string;
}
export interface PanelApprovalRow {
  id: string;
  dateLabel: string;
  stageLabel: string;
  decisionLabel: string;
  actorName: string;
  comment: string | null;
}
export interface PanelReadRow {
  id: string;
  userName: string;
  dateLabel: string;
}
export interface PanelDistributionRow {
  id: string;
  targetLabel: string;
  userName: string | null;
  roleLabel: string | null;
  readRequired: boolean;
  statusLabel: string;
  dateLabel: string;
}
export interface PanelCopyRow {
  id: string;
  copyNumber: number;
  recipient: string;
  formatLabel: string;
  statusKey: string;
  statusLabel: string;
  canRecover: boolean;
}
export interface PanelCopyOutputRow {
  id: string;
  folio: string;
  typeLabel: string;
  versionLabel: string | null;
  destination: string | null;
  issuedByName: string | null;
  issuedAt: string | null;
}
export interface PanelRelationRow {
  relatedDocumentId: string;
  code: string;
  title: string;
  versionLabel: string | null;
  statusLabel: string;
  obsolete: boolean;
  available: boolean;
}
export interface PanelFileRow {
  id: string;
  kindLabel: string;
  originalName: string;
  sizeKB: number;
}
export interface PanelTimelineRow {
  id: string;
  dateLabel: string;
  text: string;
}

export interface DocumentPanelData {
  documentId: string;
  code: string;
  title: string;
  editable: boolean;
  isExternal: boolean;
  // Resumen
  statusKey: string;
  statusLabel: string;
  typeLabel: string;
  originLabel: string;
  confidentialityLabel: string;
  responsibleName: string | null;
  ownerArea: string | null;
  siteName: string | null;
  issuedAt: string | null;
  nextReviewAt: string | null;
  description: string | null;
  vigenteLabel: string | null;
  enCurso: { label: string; statusLabel: string } | null;
  latestVersionLabel: string;
  existingDraft: { label: string; href: string } | null;
  // Flujo
  editor: {
    versionId: string;
    label: string;
    versionStatus: string;
    versionStatusLabel: string;
    editable: boolean;
    checksum: string | null;
  };
  ctx: {
    isAdmin: boolean;
    isAuthor: boolean;
    isAssignedReviewer: boolean;
    isAssignedApprover: boolean;
    hasPendingRead: boolean;
  };
  members: { id: string; name: string }[];
  steps: PanelStepRow[];
  approvals: PanelApprovalRow[];
  reads: PanelReadRow[];
  // Versiones
  versions: PanelVersionRow[];
  // Distribución
  distributions: PanelDistributionRow[];
  // Copias
  copies: PanelCopyRow[];
  copyOutputs: PanelCopyOutputRow[];
  // Relaciones
  issuedFrom: PanelRelationRow[];
  references: PanelRelationRow[];
  issuedForms: PanelRelationRow[];
  // Archivos
  currentFiles: PanelFileRow[];
  // Historial
  timeline: PanelTimelineRow[];
}

const EmptyState = ({ children }: { children: ReactNode }) => (
  <p className="empty-state empty-state--compact">{children}</p>
);

const docHref = (documentId: string) => `/dashboard/documents/${documentId}`;
const previewVersionHref = (documentId: string, versionId: string) =>
  `${docHref(documentId)}/preview?version=${versionId}`;
const editVersionHref = (documentId: string, versionId: string) =>
  `${docHref(documentId)}/editor?version=${versionId}`;

export function DocumentPanel({
  data,
  initialTab,
}: {
  data: DocumentPanelData;
  initialTab: PanelTab;
}) {
  // El tab inicial lo resuelve el servidor (desde `?tab=`) y se pasa como prop, de
  // modo que el HTML del servidor y la hidratación del cliente coincidan. Los cambios
  // posteriores actualizan la URL con history.replaceState (sin recargar datos).
  const [active, setActive] = useState<PanelTab>(initialTab);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = useCallback((tab: PanelTab) => {
    setActive(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent, index: number) => {
      const keys: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: PANEL_TABS.length - 1,
      };
      const next = keys[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const wrapped = (next + PANEL_TABS.length) % PANEL_TABS.length;
      const tab = PANEL_TABS[wrapped]!;
      select(tab);
      tabRefs.current[tab]?.focus();
    },
    [select],
  );

  return (
    <div className="doc-panel">
      <div className="doc-panel__tablist" role="tablist" aria-label="Secciones del panel">
        {PANEL_TABS.map((tab, i) => {
          const selected = tab === active;
          return (
            <button
              key={tab}
              ref={(el) => {
                tabRefs.current[tab] = el;
              }}
              type="button"
              role="tab"
              id={`doc-tab-${tab}`}
              aria-selected={selected}
              aria-controls={`doc-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              className={`doc-panel__tab${selected ? ' is-active' : ''}`}
              onClick={() => select(tab)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {PANEL_TAB_LABEL[tab]}
            </button>
          );
        })}
      </div>

      {PANEL_TABS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={`doc-panel-${tab}`}
          aria-labelledby={`doc-tab-${tab}`}
          tabIndex={0}
          hidden={tab !== active}
          className="doc-panel__panel"
        >
          {tab === active && <TabContent tab={tab} data={data} />}
        </div>
      ))}
    </div>
  );
}

function TabContent({ tab, data }: { tab: PanelTab; data: DocumentPanelData }) {
  switch (tab) {
    case 'resumen':
      return <ResumenTab data={data} />;
    case 'flujo':
      return <FlujoTab data={data} />;
    case 'versiones':
      return <VersionesTab data={data} />;
    case 'distribucion':
      return <DistribucionTab data={data} />;
    case 'copias':
      return <CopiasTab data={data} />;
    case 'relaciones':
      return <RelacionesTab data={data} />;
    case 'archivos':
      return <ArchivosTab data={data} />;
    case 'historial':
      return <HistorialTab data={data} />;
    default:
      return null;
  }
}

function ResumenTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      {data.enCurso ? (
        <div className="doc-panel__lifecycle">
          <span className="doc-panel__lifecycle-item">
            Vigente <strong>{data.vigenteLabel ?? 'sin versión vigente'}</strong>
          </span>
          <span className="doc-panel__lifecycle-item doc-panel__lifecycle-item--draft">
            Borrador <strong>{data.enCurso.label}</strong> en preparación (
            {data.enCurso.statusLabel})
          </span>
        </div>
      ) : (
        <div className="doc-panel__lifecycle">
          <span className="doc-panel__lifecycle-item">
            Vigente <strong>{data.vigenteLabel ?? 'sin versión vigente'}</strong>
          </span>
        </div>
      )}

      {data.isExternal && (
        <div className="external-doc-card">
          <p>
            <strong>Documento externo registrado.</strong> C3 Sentinel conserva el archivo y sus
            metadatos; su contenido no se transcribe.
          </p>
        </div>
      )}

      <dl className="meta-grid">
        <div>
          <dt>Estado</dt>
          <dd>
            <span className={`badge badge--doc-${data.statusKey}`}>{data.statusLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{data.typeLabel}</dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>{data.originLabel}</dd>
        </div>
        <div>
          <dt>Versión vigente</dt>
          <dd>{data.vigenteLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Borrador en curso</dt>
          <dd>{data.enCurso ? data.enCurso.label : '—'}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{data.responsibleName ?? '—'}</dd>
        </div>
        <div>
          <dt>Área</dt>
          <dd>{data.ownerArea ?? '—'}</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>{data.siteName ?? '—'}</dd>
        </div>
        <div>
          <dt>Confidencialidad</dt>
          <dd>{data.confidentialityLabel}</dd>
        </div>
        <div>
          <dt>Emisión</dt>
          <dd>{data.issuedAt ?? '—'}</dd>
        </div>
        <div>
          <dt>Próxima revisión</dt>
          <dd>{data.nextReviewAt ?? '—'}</dd>
        </div>
      </dl>

      {data.description && <p className="lead">{data.description}</p>}

      <h3>Acciones</h3>
      <DocumentActions
        documentId={data.documentId}
        editable={data.editable}
        latestVersionLabel={data.latestVersionLabel}
        existingDraft={data.existingDraft}
      />
    </>
  );
}

function FlujoTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      <p>
        Versión activa <strong>{data.editor.label}</strong>:{' '}
        <span className="badge">{data.editor.versionStatusLabel}</span>
      </p>
      <WorkflowPanel
        documentId={data.documentId}
        versionId={data.editor.versionId}
        status={data.editor.versionStatus}
        editable={data.editor.editable}
        checksum={data.editor.checksum}
        ctx={data.ctx}
        members={data.members}
      />

      <h3>Asignaciones</h3>
      {data.steps.length === 0 ? (
        <EmptyState>Sin revisores ni aprobadores asignados.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Usuario</th>
                <th>Orden</th>
                <th>Estado</th>
                <th>Límite</th>
              </tr>
            </thead>
            <tbody>
              {data.steps.map((st) => (
                <tr key={st.id}>
                  <td>{st.roleLabel}</td>
                  <td>{st.userName}</td>
                  <td>{st.sequence}</td>
                  <td>{st.statusLabel}</td>
                  <td>{st.dueLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Aprobaciones</h3>
      {data.approvals.length === 0 ? (
        <EmptyState>Sin decisiones registradas.</EmptyState>
      ) : (
        <ul className="history">
          {data.approvals.map((a) => (
            <li key={a.id}>
              <span className="muted">{a.dateLabel}</span> · {a.stageLabel} · {a.decisionLabel} ·{' '}
              {a.actorName}
              {a.comment ? ` — “${a.comment}”` : ''}
            </li>
          ))}
        </ul>
      )}

      <h3>Lecturas</h3>
      {data.reads.length === 0 ? (
        <EmptyState>Sin acuses de lectura.</EmptyState>
      ) : (
        <ul className="history">
          {data.reads.map((r) => (
            <li key={r.id}>
              {r.userName} · <span className="muted">{r.dateLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function VersionesTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      <p className="muted doc-panel__hint">
        La versión <strong>vigente</strong> es la última publicada; el <strong>borrador</strong> en
        curso aún no es vigente; las <strong>históricas</strong> están obsoletas.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Versión</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Modificación</th>
              <th>Realizado por</th>
              <th>Vigente</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.versions.map((v) => (
              <tr key={v.id}>
                <td className="mono">
                  <Link href={previewVersionHref(data.documentId, v.id)}>{v.label}</Link>
                </td>
                <td>
                  <span className={`badge badge--ver-${v.status}`}>{v.statusLabel}</span>
                </td>
                <td>{v.createdAtLabel}</td>
                <td>{v.modification}</td>
                <td>{v.authorName ?? '—'}</td>
                <td>{v.status === 'published' ? 'Sí' : '—'}</td>
                <td className="doc-panel__row-actions">
                  <Link href={previewVersionHref(data.documentId, v.id)}>Ver</Link>
                  {(v.status === 'draft' || v.status === 'changes_requested') && data.editable && (
                    <Link href={editVersionHref(data.documentId, v.id)}>Editar</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted doc-panel__hint">
        Comparar versiones lado a lado es un follow-up documental (no incluido en esta vista).
      </p>
    </>
  );
}

function DistribucionTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      <p className="muted doc-panel__hint">
        La <strong>distribución</strong> reparte el documento vigente a áreas y puestos; es distinta
        de una <strong>copia controlada</strong> (ver pestaña Copias).
      </p>
      {data.distributions.length === 0 ? (
        <EmptyState>Sin distribuciones registradas.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Destino</th>
                <th>Responsable</th>
                <th>Lectura</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.distributions.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.targetLabel}
                    {d.roleLabel ? ` · ${d.roleLabel}` : ''}
                  </td>
                  <td>{d.userName ?? '—'}</td>
                  <td>{d.readRequired ? 'Requerida' : 'Informativa'}</td>
                  <td>{d.statusLabel}</td>
                  <td>{d.dateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CopiasTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      <h3>Copias controladas (registro)</h3>
      <p className="muted doc-panel__hint">Quién resguarda una copia controlada del documento.</p>
      {data.copies.length === 0 ? (
        <EmptyState>Sin copias registradas.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N.º</th>
                <th>Destinatario</th>
                <th>Formato</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.copies.map((c) => (
                <tr key={c.id}>
                  <td>{c.copyNumber}</td>
                  <td>{c.recipient}</td>
                  <td>{c.formatLabel}</td>
                  <td>
                    <span className={`badge badge--copy-${c.statusKey}`}>{c.statusLabel}</span>
                  </td>
                  <td>
                    {c.canRecover && (
                      <form action={recoverCopyForm} className="wf-form">
                        <input type="hidden" name="documentId" value={data.documentId} />
                        <input type="hidden" name="copyId" value={c.id} />
                        <input type="hidden" name="status" value="recovered" />
                        <button className="button button--ghost" type="submit">
                          Registrar recuperación
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Copias generadas (salidas)</h3>
      <p className="muted doc-panel__hint">
        Registro de auditoría de cada impresión o PDF de copia controlada emitido.
      </p>
      {data.copyOutputs.length === 0 ? (
        <EmptyState>Sin copias de impresión ni PDF generadas.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Destino</th>
                <th>Generada por</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.copyOutputs.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.folio}</td>
                  <td>{c.typeLabel}</td>
                  <td>{c.versionLabel ?? '—'}</td>
                  <td>{c.destination ?? '—'}</td>
                  <td>{c.issuedByName ?? '—'}</td>
                  <td>{c.issuedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RelacionesTab({ data }: { data: DocumentPanelData }) {
  const table = (title: string, rows: PanelRelationRow[], colName: string) =>
    rows.length > 0 && (
      <div>
        <h3>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>{colName}</th>
                <th>Versión</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                r.available ? (
                  <tr key={r.relatedDocumentId}>
                    <td className="mono">
                      <Link href={docHref(r.relatedDocumentId)}>{r.code}</Link>
                    </td>
                    <td>
                      <Link href={docHref(r.relatedDocumentId)}>{r.title}</Link>
                    </td>
                    <td>{r.versionLabel ?? '—'}</td>
                    <td>
                      {r.statusLabel}
                      {r.obsolete ? ' · Obsoleto' : ''}
                    </td>
                  </tr>
                ) : (
                  <tr key={r.relatedDocumentId}>
                    <td colSpan={4} className="muted">
                      Referencia no disponible
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    );

  const empty =
    data.issuedFrom.length === 0 && data.references.length === 0 && data.issuedForms.length === 0;

  return (
    <>
      {empty ? (
        <EmptyState>Sin relaciones documentales.</EmptyState>
      ) : (
        <div className="doc-relations">
          {table('Emitido desde', data.issuedFrom, 'Documento')}
          {table('Documentos referenciados', data.references, 'Documento')}
          {table('Formatos y registros relacionados', data.issuedForms, 'Formato')}
        </div>
      )}
    </>
  );
}

function ArchivosTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      <h3>Archivos de la versión vigente</h3>
      {data.currentFiles.length === 0 ? (
        <EmptyState>Sin archivos adjuntos.</EmptyState>
      ) : (
        <ul className="file-list">
          {data.currentFiles.map((f) => (
            <li key={f.id}>
              <span className="badge">{f.kindLabel}</span> {f.originalName}{' '}
              <span className="muted">({f.sizeKB} KB)</span>{' '}
              <a href={`${docHref(data.documentId)}/files/${f.id}`}>Descargar</a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function HistorialTab({ data }: { data: DocumentPanelData }) {
  return (
    <>
      {data.timeline.length === 0 ? (
        <EmptyState>Sin eventos.</EmptyState>
      ) : (
        <ul className="history history--compact">
          {data.timeline.map((h) => (
            <li key={h.id}>
              <span className="muted">{h.dateLabel}</span> — {h.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
