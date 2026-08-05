import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import { listAnalyses } from '@/server/quality-analysis';
import {
  ANALYSIS_STATUSES,
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPES,
  ANALYSIS_TYPE_HELP,
  ANALYSIS_TYPE_LABEL,
  type AnalysisStatus,
  type AnalysisType,
} from '@/features/capa/analysis-state';

const ICON: Record<AnalysisType, string> = {
  ishikawa: '🐟',
  cause_tree: '🌳',
  pareto: '📊',
  fmea: '🧮',
  recurrence: '🔁',
  comparative: '🔀',
  freeform: '📝',
};

interface SP {
  q?: string;
  type?: string;
  status?: string;
}

export default async function AnalysisListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireServerSession();
  const sp = await searchParams;
  const rows = await listAnalyses(session.organizationId, {
    search: sp.q,
    type: sp.type,
    status: sp.status,
  });

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>Análisis</h1>
          <p className="muted">Herramientas de análisis e investigación para CAPA.</p>
        </div>
      </div>

      <div className="tool-grid tool-grid--compact">
        {ANALYSIS_TYPES.map((t) => (
          <Link
            key={t}
            className={`tool-card${sp.type === t ? ' is-active' : ''}`}
            href={`/dashboard/capa/analysis?type=${t}`}
          >
            <span className="tool-card__icon" aria-hidden>
              {ICON[t]}
            </span>
            <span className="tool-card__title">{ANALYSIS_TYPE_LABEL[t]}</span>
            <span className="tool-card__help">{ANALYSIS_TYPE_HELP[t]}</span>
          </Link>
        ))}
      </div>

      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Buscar análisis…" defaultValue={sp.q ?? ''} />
        <select name="type" defaultValue={sp.type ?? ''}>
          <option value="">Todos los tipos</option>
          {ANALYSIS_TYPES.map((t) => (
            <option key={t} value={t}>
              {ANALYSIS_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ''}>
          <option value="">Todos los estados</option>
          {ANALYSIS_STATUSES.map((st) => (
            <option key={st} value={st}>
              {ANALYSIS_STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <button className="button button--ghost" type="submit">
          Aplicar
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="empty-state">No hay análisis. Créalos desde una CAPA.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Análisis</th>
                <th>CAPA</th>
                <th>Tipo</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Versión</th>
                <th>Responsable</th>
                <th>Actualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.id.slice(0, 8)}</td>
                  <td>
                    <Link href={`/dashboard/capa/${a.capaId}`}>{a.capaFolio}</Link>
                  </td>
                  <td>{ANALYSIS_TYPE_LABEL[a.type as AnalysisType] ?? a.type}</td>
                  <td>{a.title}</td>
                  <td>
                    <span className={`badge badge--analysis-${a.status}`}>
                      {ANALYSIS_STATUS_LABEL[a.status as AnalysisStatus] ?? a.status}
                    </span>
                  </td>
                  <td>v{a.version}</td>
                  <td>{a.responsibleName ?? '—'}</td>
                  <td>{a.updatedAt}</td>
                  <td>
                    <Link
                      className="button button--ghost"
                      href={`/dashboard/capa/${a.capaId}/analysis/${a.id}`}
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
