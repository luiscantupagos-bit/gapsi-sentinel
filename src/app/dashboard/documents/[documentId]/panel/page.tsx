import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  DocumentNotFoundError,
  getDocumentDetail,
  getDocumentRelations,
  getEditorContent,
  getIssuedFromSources,
  listResponsibles,
  getControlledCopyHistory,
} from '@/server/documents';
import { getDocumentControl, getUserVersionContext } from '@/server/document-workflow';
import {
  VERSION_STATUS_LABEL,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_ROLE_LABEL,
  APPROVAL_DECISION_LABEL,
  DISTRIBUTION_TARGET_LABEL,
  DISTRIBUTION_STATUS_LABEL,
  COPY_STATUS_LABEL,
  type VersionStatus,
} from '@/features/documents/workflow-state';
import { categorizeVersions, resolveTab, type PanelVersion } from '@/features/documents/panel-view';
import {
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_ORIGINS,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  labelOf,
} from '@/features/documents/catalog';
import { DocumentPanel, type DocumentPanelData } from './_components/DocumentPanel';

const vLabel = (s: string) => VERSION_STATUS_LABEL[s as VersionStatus] ?? s;
const dt = (d: Date | string) => new Date(d).toLocaleString('es-MX');
const dd = (d: Date | string) => new Date(d).toLocaleDateString('es-MX');

const HISTORY_LABEL: Record<string, string> = {
  'document.created': 'Documento creado',
  'document.metadata_updated': 'Metadatos modificados',
  'file.uploaded': 'Archivo cargado',
  'version.created': 'Versión creada',
  'content.updated': 'Contenido actualizado',
  'document.archived': 'Documento archivado',
};
const COPY_TYPE_LABEL: Record<string, string> = { print: 'Impresión', pdf: 'PDF' };

/**
 * Panel del documento (DOC-UX-PANEL-001): administración / gobierno / trazabilidad /
 * ciclo de vida, organizado por TABS. La vista canónica del documento (contenido /
 * lectura / edición / salida) vive en las rutas hermanas (../, /preview, /editor…).
 */
export default async function DocumentPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireServerSession();
  const { documentId } = await params;
  const initialTab = resolveTab((await searchParams).tab);

  let doc;
  try {
    doc = await getDocumentDetail(session.organizationId, documentId);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) notFound();
    throw error;
  }

  const [editor, control, members, copyHistory] = await Promise.all([
    getEditorContent(session.organizationId, documentId),
    getDocumentControl(session.organizationId, documentId),
    listResponsibles(session.organizationId),
    getControlledCopyHistory(session.organizationId, documentId),
  ]);
  const ctx = await getUserVersionContext(session.organizationId, session.userId, editor.versionId);

  const [relations, issuedFrom] = await Promise.all([
    getDocumentRelations(session.organizationId, documentId),
    doc.documentType === 'form'
      ? getIssuedFromSources(session.organizationId, documentId)
      : Promise.resolve([]),
  ]);

  const panelVersions: PanelVersion[] = doc.versions.map((v) => ({
    id: v.id,
    label: v.label,
    status: v.status as VersionStatus,
    isCurrent: v.isCurrent,
    changeNotes: v.changeNotes,
    createdAtLabel: v.createdAtLabel,
    authorName: v.authorName,
    fileCount: v.files.length,
  }));
  const groups = categorizeVersions(panelVersions);

  const relRows = (
    rows: {
      relatedDocumentId: string;
      code: string;
      title: string;
      versionLabel: string | null;
      statusLabel: string;
      obsolete: boolean;
      available: boolean;
    }[],
  ) => rows.map((r) => ({ ...r }));

  // Historial unificado: eventos del documento + transiciones de estado, cronológico.
  const timeline = [
    ...doc.history.map((h) => ({
      id: `h-${h.id}`,
      at: new Date(h.createdAt).getTime(),
      dateLabel: dt(h.createdAt),
      text: HISTORY_LABEL[h.action] ?? h.action,
    })),
    ...control.statusHistory.map((h) => ({
      id: `s-${h.id.toString()}`,
      at: new Date(h.createdAt).getTime(),
      dateLabel: dt(h.createdAt),
      text:
        (h.fromStatus ? `${vLabel(h.fromStatus)} → ` : '') +
        vLabel(h.toStatus) +
        (h.comment ? ` — ${h.comment}` : ''),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .map(({ id, dateLabel, text }) => ({ id, dateLabel, text }));

  const data: DocumentPanelData = {
    documentId: doc.id,
    code: doc.code,
    title: doc.title,
    editable: doc.editable,
    isExternal: doc.contentMode === 'external',
    statusKey: doc.status,
    statusLabel: labelOf(DOCUMENT_STATUSES, doc.status),
    typeLabel: labelOf(DOCUMENT_TYPES, doc.documentType),
    originLabel: labelOf(DOCUMENT_ORIGINS, doc.origin),
    confidentialityLabel: labelOf(CONFIDENTIALITY_LEVELS, doc.confidentiality),
    responsibleName: doc.responsibleName,
    ownerArea: doc.ownerArea,
    siteName: doc.siteName,
    issuedAt: doc.issuedAt,
    nextReviewAt: doc.nextReviewAt,
    description: doc.description,
    vigenteLabel: groups.vigente?.label ?? null,
    enCurso: groups.enCurso
      ? { label: groups.enCurso.label, statusLabel: vLabel(groups.enCurso.status) }
      : null,
    editor: {
      versionId: editor.versionId,
      label: editor.label,
      versionStatus: editor.versionStatus,
      versionStatusLabel: vLabel(editor.versionStatus),
      editable: editor.editable,
      checksum: editor.contentChecksum,
    },
    ctx: ctx
      ? {
          isAdmin: ctx.isAdmin,
          isAuthor: ctx.isAuthor,
          isAssignedReviewer: ctx.isAssignedReviewer,
          isAssignedApprover: ctx.isAssignedApprover,
          hasPendingRead: ctx.hasPendingRead,
        }
      : {
          isAdmin: false,
          isAuthor: false,
          isAssignedReviewer: false,
          isAssignedApprover: false,
          hasPendingRead: false,
        },
    members,
    steps: control.steps.map((st) => ({
      id: st.id,
      roleLabel: ASSIGNMENT_ROLE_LABEL[st.role] ?? st.role,
      userName: control.uName.get(st.userId) ?? '—',
      sequence: st.sequence,
      statusLabel: ASSIGNMENT_STATUS_LABEL[st.status] ?? st.status,
      dueLabel: st.dueAt ? dd(st.dueAt) : '—',
    })),
    approvals: control.approvals.map((a) => ({
      id: a.id,
      dateLabel: dt(a.createdAt),
      stageLabel: a.stage === 'review' ? 'Revisión' : 'Aprobación',
      decisionLabel: APPROVAL_DECISION_LABEL[a.decision] ?? a.decision,
      actorName: control.uName.get(a.actorUserId) ?? '—',
      comment: a.comment ?? null,
    })),
    reads: control.reads.map((r) => ({
      id: r.id,
      userName: control.uName.get(r.userId) ?? r.userId,
      dateLabel: dt(r.acknowledgedAt),
    })),
    versions: panelVersions.map((v) => ({
      id: v.id,
      label: v.label,
      status: v.status,
      statusLabel: vLabel(v.status),
      isCurrent: v.isCurrent,
      changeNotes: v.changeNotes,
      createdAtLabel: v.createdAtLabel,
      authorName: v.authorName,
      fileCount: v.fileCount,
    })),
    distributions: control.distributions.map((d) => ({
      id: d.id,
      targetLabel: DISTRIBUTION_TARGET_LABEL[d.targetType] ?? d.targetType,
      userName: d.userId ? (control.uName.get(d.userId) ?? d.userId) : null,
      roleLabel: d.role ? `rol ${d.role}` : null,
      readRequired: d.readRequired,
      statusLabel: DISTRIBUTION_STATUS_LABEL[d.status] ?? d.status,
      dateLabel: dd(d.distributedAt),
    })),
    copies: control.copies.map((c) => ({
      id: c.id,
      copyNumber: c.copyNumber,
      recipient: c.recipient,
      formatLabel: c.format === 'printed' ? 'Impresa' : 'Digital',
      statusKey: c.status,
      statusLabel: COPY_STATUS_LABEL[c.status] ?? c.status,
      canRecover:
        Boolean(ctx?.isAdmin) && (c.status === 'active' || c.status === 'pending_recovery'),
    })),
    copyOutputs: copyHistory.map((c) => ({
      id: c.id,
      folio: c.folio,
      typeLabel: COPY_TYPE_LABEL[c.copyType] ?? c.copyType,
      versionLabel: c.versionLabel,
      destination: [c.destinationLabel, c.reason].filter(Boolean).join(' · ') || null,
      issuedByName: c.issuedByName,
      issuedAt: c.issuedAt,
    })),
    issuedFrom: relRows(issuedFrom),
    references: relRows(relations.references),
    issuedForms: relRows(relations.issuedForms),
    currentFiles: doc.currentFiles.map((f) => ({
      id: f.id,
      kindLabel: f.kind === 'main' ? 'Principal' : 'Anexo',
      originalName: f.originalName,
      sizeKB: Math.round(f.sizeBytes / 1024),
    })),
    timeline,
  };

  return (
    <main className="container">
      <nav className="doc-lib__crumb" aria-label="Ruta de navegación">
        <Link href="/dashboard/documents">Documentos</Link>
        {' › '}
        <Link href={`/dashboard/documents/${doc.id}`}>{doc.code}</Link>
        {' › '}
        <span aria-current="page">Panel</span>
      </nav>

      <div className="page-head">
        <h1>
          <span className="muted">{doc.code}</span> {doc.title} · Panel
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link className="button button--primary" href={`/dashboard/documents/${doc.id}`}>
            Ver documento
          </Link>
          {doc.editable && (
            <Link className="button button--ghost" href={`/dashboard/documents/${doc.id}/edit`}>
              Editar metadatos
            </Link>
          )}
        </div>
      </div>

      <DocumentPanel data={data} initialTab={initialTab} />
    </main>
  );
}
