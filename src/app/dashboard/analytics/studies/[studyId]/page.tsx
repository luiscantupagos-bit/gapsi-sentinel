import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  getStudy,
  getLatestDataset,
  getDatasetPage,
  getDatasetQuality,
  listStudyAnalyses,
  STUDY_STATUS_LABEL,
} from '@/server/studies';
import { VARIABLE_TYPE_LABEL, DATASET_LIMITS, type VariableType } from '@/features/studies/dataset';
import { STUDY_METHOD_LABEL, type StudyAnalysisResult } from '@/features/studies/analysis-adapter';
import type { Interpretation } from '@/features/studies/interpretation';
import { DetailHeader, DetailTabs } from '../../../_components/detail';
import { StudyActionForm } from '../_components/StudyActionForm';
import { NewAnalysisForm } from '../_components/NewAnalysisForm';
import {
  importFileAction,
  importPasteAction,
  setVariableTypeAction,
  addDeviationVariableAction,
  deleteAnalysisAction,
  saveConclusionAction,
} from '../actions';

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'datos', label: 'Datos' },
  { key: 'variables', label: 'Variables' },
  { key: 'calidad', label: 'Calidad de datos' },
  { key: 'analisis', label: 'Análisis' },
  { key: 'conclusion', label: 'Conclusión' },
];

const PAGE_SIZE = 50;

function ImportPanel({ studyId }: { studyId: string }) {
  return (
    <div className="two-col">
      <div className="sectioncard">
        <div className="sectioncard__head">
          <h2>Importar archivo</h2>
        </div>
        <div className="sectioncard__body">
          <StudyActionForm
            action={importFileAction}
            hidden={{ studyId }}
            button="Importar"
            variant="primary"
            encType="multipart/form-data"
            className="doc-form"
          >
            <label className="field field--full">
              <span className="field__label">Archivo CSV o XLSX</span>
              <input type="file" name="file" accept=".csv,.xlsx,.txt" required />
            </label>
            <p className="field-hint">
              Máximo {DATASET_LIMITS.maxRows.toLocaleString('es-MX')} filas,{' '}
              {DATASET_LIMITS.maxColumns} columnas, 10 MB. Sin macros (no se admite .xlsm/.xls). La
              primera fila es el encabezado.
            </p>
          </StudyActionForm>
        </div>
      </div>
      <div className="sectioncard">
        <div className="sectioncard__head">
          <h2>Pegar desde Excel</h2>
        </div>
        <div className="sectioncard__body">
          <StudyActionForm
            action={importPasteAction}
            hidden={{ studyId }}
            button="Importar pegado"
            variant="ghost"
            className="doc-form"
          >
            <label className="field field--full">
              <span className="field__label">Pega los datos (con encabezados)</span>
              <textarea
                name="data"
                rows={6}
                placeholder={'fecha\tturno\tmedida\n2026-01-01\tA\t10.2'}
              />
            </label>
          </StudyActionForm>
        </div>
      </div>
    </div>
  );
}

export default async function StudyWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ studyId: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const session = await requireServerSession();
  const { studyId } = await params;
  const sp = await searchParams;
  const study = await getStudy(session.organizationId, studyId);
  if (!study) notFound();

  const dataset = await getLatestDataset(session.organizationId, studyId);
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : 'resumen';
  const status = study.status;

  return (
    <main className="container">
      <DetailHeader
        backHref="/dashboard/analytics/studies"
        backLabel="Volver a estudios"
        title={`${study.folio} · ${study.title}`}
        badge={
          <span className={`badge badge--study-${status}`}>
            {STUDY_STATUS_LABEL[status] ?? status}
          </span>
        }
        meta={[
          { label: 'Objetivo', value: study.objective ?? '—' },
          {
            label: 'Dataset',
            value: dataset
              ? `v${dataset.version} · ${dataset.rowCount} filas · ${dataset.columnCount} col`
              : 'Sin datos',
          },
        ]}
      />

      {!dataset ? (
        <>
          <p className="muted">Importa datos para comenzar el análisis.</p>
          <ImportPanel studyId={studyId} />
        </>
      ) : (
        <>
          <DetailTabs tabs={TABS} current={tab} hrefFor={(k) => `?tab=${k}`} />
          {tab === 'resumen' && (
            <section className="sectioncard">
              <div className="sectioncard__body">
                <dl className="detailhead__meta">
                  <div>
                    <dt>Pregunta</dt>
                    <dd>{study.question ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Filas × columnas</dt>
                    <dd>
                      {dataset.rowCount} × {dataset.columnCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Origen del dataset</dt>
                    <dd>{dataset.sourceKind.toUpperCase()}</dd>
                  </div>
                </dl>
                <p className="muted">
                  Revisa los datos y los tipos de variable, verifica la calidad y crea variables
                  calculadas antes de analizar.
                </p>
              </div>
            </section>
          )}

          {tab === 'datos' && (
            <DataTab
              organizationId={session.organizationId}
              datasetId={dataset.id}
              page={Number(sp.page ?? '1')}
              studyId={studyId}
            />
          )}

          {tab === 'variables' && <VariablesTab dataset={dataset} studyId={studyId} />}

          {tab === 'calidad' && (
            <QualityTab organizationId={session.organizationId} datasetId={dataset.id} />
          )}

          {tab === 'analisis' && (
            <AnalysisTab
              organizationId={session.organizationId}
              studyId={studyId}
              dataset={dataset}
            />
          )}

          {tab === 'conclusion' && (
            <ConclusionTab studyId={studyId} conclusion={study.conclusion} status={status} />
          )}
        </>
      )}
    </main>
  );
}

async function AnalysisTab({
  organizationId,
  studyId,
  dataset,
}: {
  organizationId: string;
  studyId: string;
  dataset: NonNullable<Awaited<ReturnType<typeof getLatestDataset>>>;
}) {
  const analyses = await listStudyAnalyses(organizationId, studyId);
  const variables = dataset.variables.map((v) => ({
    columnKey: v.columnKey,
    label: v.label,
    varType: v.varType,
  }));
  return (
    <>
      <section className="sectioncard">
        <div className="sectioncard__head">
          <h2>Nuevo análisis</h2>
        </div>
        <div className="sectioncard__body">
          <NewAnalysisForm studyId={studyId} datasetId={dataset.id} variables={variables} />
          <p className="field-hint">
            Cada análisis conserva el dataset, la configuración, el resultado y la interpretación;
            reimportar datos o cambiar tipos no altera los análisis ya ejecutados.
          </p>
        </div>
      </section>

      {analyses.length === 0 ? (
        <p className="empty-state">Aún no hay análisis. Ejecuta el primero arriba.</p>
      ) : (
        analyses.map((a) => {
          const result = a.result as StudyAnalysisResult | null;
          const interp = a.interpretation as Interpretation | null;
          const version = (a.config as { datasetVersion?: number } | null)?.datasetVersion;
          return (
            <section key={a.id} className="sectioncard">
              <div className="sectioncard__head">
                <h2>
                  {STUDY_METHOD_LABEL[a.method as keyof typeof STUDY_METHOD_LABEL] ?? a.method}
                  {a.title ? ` · ${a.title}` : ''}
                </h2>
                <div className="page-head__actions">
                  <span className="muted">{version ? `dataset v${version}` : ''}</span>
                  <StudyActionForm
                    action={deleteAnalysisAction}
                    hidden={{ studyId, analysisId: a.id }}
                    button="Eliminar"
                    variant="ghost"
                    className="inline-form"
                  />
                </div>
              </div>
              <div className="sectioncard__body">
                {interp && (
                  <div className="interpretation">
                    <p className="interpretation__principal">{interp.principal}</p>
                    <p className="interpretation__detail">{interp.detail}</p>
                    <p className="interpretation__next">
                      <strong>Siguiente paso:</strong> {interp.nextStep}
                    </p>
                  </div>
                )}
                {result && <ResultView result={result} />}
                <details className="more-actions">
                  <summary>Acciones desde el resultado</summary>
                  <div className="page-head__actions">
                    <Link
                      className="button button--ghost"
                      href={`/dashboard/capa/new?from=study&studyId=${studyId}`}
                    >
                      Crear CAPA
                    </Link>
                    <Link
                      className="button button--ghost"
                      href={`/dashboard/tasks/new?from=study&studyId=${studyId}`}
                    >
                      Crear tarea
                    </Link>
                    <Link
                      className="button button--ghost"
                      href={`/dashboard/projects/new?from=study&studyId=${studyId}`}
                    >
                      Crear proyecto
                    </Link>
                  </div>
                  <p className="field-hint">
                    Sentinel describe asociaciones, diferencias y tendencias; la decisión y la causa
                    las determina el responsable.
                  </p>
                </details>
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

function num(v: number | null): string {
  return v === null ? '—' : String(v);
}

function ResultView({ result }: { result: StudyAnalysisResult }) {
  switch (result.kind) {
    case 'insufficient':
      return <p className="empty-state">{result.message}</p>;
    case 'descriptive-numeric': {
      const s = result.stats;
      const items: [string, number | null][] = [
        ['n', result.n],
        ['Media', s.mean],
        ['Mediana', s.median],
        ['Mín', s.min],
        ['Máx', s.max],
        ['Desv. est.', s.stdDev],
      ];
      return (
        <dl className="detailhead__meta">
          {items.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{num(v)}</dd>
            </div>
          ))}
        </dl>
      );
    }
    case 'descriptive-categorical':
      return (
        <SimpleTable
          head={['Categoría', 'Frecuencia', '%']}
          rows={result.frequencies.slice(0, 15).map((f) => [f.label, String(f.count), `${f.pct}%`])}
        />
      );
    case 'pareto':
      return (
        <SimpleTable
          head={['Categoría', 'Valor', '%', '% acum.', 'Vital']}
          rows={result.result.rows.map((r) => [
            r.category,
            String(r.value),
            `${r.percentage}%`,
            `${r.cumulativePercentage}%`,
            r.vitalFew ? 'Sí' : '—',
          ])}
        />
      );
    case 'trend':
      return (
        <SimpleTable
          head={['Periodo', 'Valor']}
          rows={result.points.map((p) => [p.label, String(p.value)])}
        />
      );
    case 'correlation':
      return (
        <dl className="detailhead__meta">
          <div>
            <dt>Pearson r (n={result.pearson.n})</dt>
            <dd>{num(result.pearson.r)}</dd>
          </div>
          <div>
            <dt>Spearman ρ</dt>
            <dd>{num(result.spearman.r)}</dd>
          </div>
        </dl>
      );
    case 'regression': {
      const r = result.regression;
      return (
        <dl className="detailhead__meta">
          <div>
            <dt>Pendiente</dt>
            <dd>{num(r.slope)}</dd>
          </div>
          <div>
            <dt>Intercepto</dt>
            <dd>{num(r.intercept)}</dd>
          </div>
          <div>
            <dt>R²</dt>
            <dd>{num(r.r2)}</dd>
          </div>
        </dl>
      );
    }
    case 'group_compare':
      return (
        <SimpleTable
          head={['Grupo', 'n', 'Media', 'Mediana', 'Desv. est.']}
          rows={result.groups.map((g) => [
            g.label,
            String(g.stats.count),
            num(g.stats.mean),
            num(g.stats.median),
            num(g.stats.stdDev),
          ])}
        />
      );
    case 'anova':
      return (
        <dl className="detailhead__meta">
          <div>
            <dt>F</dt>
            <dd>{num(result.anova.fStatistic)}</dd>
          </div>
          <div>
            <dt>gl entre / dentro</dt>
            <dd>
              {num(result.anova.dfBetween)} / {num(result.anova.dfWithin)}
            </dd>
          </div>
        </dl>
      );
    case 'chi_square': {
      const c = result.contingency;
      return (
        <>
          <dl className="detailhead__meta">
            <div>
              <dt>χ²</dt>
              <dd>{num(c.chiSquare)}</dd>
            </div>
            <div>
              <dt>gl</dt>
              <dd>{num(c.degreesOfFreedom)}</dd>
            </div>
            <div>
              <dt>n</dt>
              <dd>{c.n}</dd>
            </div>
          </dl>
          {c.observed.length > 0 && (
            <SimpleTable
              head={['', ...c.colLabels]}
              rows={c.observed.map((row, i) => [
                c.rowLabels[i] ?? '',
                ...row.map((n) => String(n)),
              ])}
            />
          )}
        </>
      );
    }
  }
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConclusionTab({
  studyId,
  conclusion,
  status,
}: {
  studyId: string;
  conclusion: string | null;
  status: string;
}) {
  return (
    <section className="sectioncard">
      <div className="sectioncard__head">
        <h2>Conclusión del responsable</h2>
      </div>
      <div className="sectioncard__body">
        <p className="muted">
          Esta conclusión es humana y se guarda por separado de la interpretación automática de
          Sentinel. Redáctala a partir de los análisis y del contexto del proceso.
        </p>
        <StudyActionForm
          action={saveConclusionAction}
          hidden={{ studyId }}
          button="Guardar conclusión"
          variant="primary"
          className="doc-form"
        >
          <label className="field field--full">
            <span className="field__label">Conclusión</span>
            <textarea
              name="conclusion"
              rows={6}
              defaultValue={conclusion ?? ''}
              placeholder="Hallazgos, decisiones y acciones de seguimiento acordadas."
            />
          </label>
          <label className="field field--full checkbox-field">
            <input type="checkbox" name="markConcluded" defaultChecked={status === 'concluded'} />
            <span>Marcar el estudio como concluido</span>
          </label>
        </StudyActionForm>
      </div>
    </section>
  );
}

async function DataTab({
  organizationId,
  datasetId,
  page,
  studyId,
}: {
  organizationId: string;
  datasetId: string;
  page: number;
  studyId: string;
}) {
  const skip = Math.max(0, (page - 1) * PAGE_SIZE);
  const { variables, rows, total } = await getDatasetPage(organizationId, datasetId, {
    skip,
    take: PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <section className="sectioncard">
      <div className="sectioncard__head">
        <h2>
          Datos ({total} filas) — página {page}/{pages}
        </h2>
        <div className="page-head__actions">
          {page > 1 && (
            <Link className="button button--ghost" href={`?tab=datos&page=${page - 1}`}>
              ← Anterior
            </Link>
          )}
          {page < pages && (
            <Link className="button button--ghost" href={`?tab=datos&page=${page + 1}`}>
              Siguiente →
            </Link>
          )}
        </div>
      </div>
      <div className="sectioncard__body">
        <details className="more-actions">
          <summary>Reimportar (crea una nueva versión)</summary>
          <ImportPanel studyId={studyId} />
        </details>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {variables.map((v) => (
                  <th key={v.id}>
                    {v.label}
                    {v.calculated ? ' *' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowIndex} className={r.excluded ? 'muted' : undefined}>
                  <td>{r.rowIndex + 1}</td>
                  {variables.map((v) => (
                    <td key={v.id}>{r.values[v.columnKey] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">* variable calculada.</p>
      </div>
    </section>
  );
}

function VariablesTab({
  dataset,
  studyId,
}: {
  dataset: NonNullable<Awaited<ReturnType<typeof getLatestDataset>>>;
  studyId: string;
}) {
  const numeric = dataset.variables.filter((v) => v.varType === 'numeric' && !v.calculated);
  const types: VariableType[] = ['numeric', 'categorical', 'temporal', 'text'];
  return (
    <section className="sectioncard">
      <div className="sectioncard__head">
        <h2>Variables</h2>
      </div>
      <div className="sectioncard__body">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Columna</th>
                <th>Tipo</th>
                <th>Calculada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dataset.variables.map((v) => (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td>{VARIABLE_TYPE_LABEL[v.varType as VariableType] ?? v.varType}</td>
                  <td>{v.calculated ? 'Sí' : '—'}</td>
                  <td>
                    {!v.calculated && (
                      <StudyActionForm
                        action={setVariableTypeAction}
                        hidden={{ studyId, variableId: v.id }}
                        button="Cambiar tipo"
                        variant="ghost"
                        className="inline-form"
                      >
                        <select name="varType" defaultValue={v.varType}>
                          {types.map((t) => (
                            <option key={t} value={t}>
                              {VARIABLE_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </StudyActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Variable calculada — Desviación %</h3>
        <p className="muted">
          Calcula ((real − nominal) / nominal) × 100. División entre cero → vacío.
        </p>
        {numeric.length < 2 ? (
          <p className="empty-state">Se requieren al menos dos columnas numéricas.</p>
        ) : (
          <StudyActionForm
            action={addDeviationVariableAction}
            hidden={{ studyId, datasetId: dataset.id }}
            button="Crear variable"
            variant="ghost"
            className="filter-bar"
          >
            <label className="field">
              <span className="field__label">Nombre</span>
              <input name="label" defaultValue="Desviación %" />
            </label>
            <label className="field">
              <span className="field__label">Medida real</span>
              <select name="realColumn">
                {numeric.map((v) => (
                  <option key={v.id} value={v.columnKey}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Medida nominal</span>
              <select name="nominalColumn">
                {numeric.map((v) => (
                  <option key={v.id} value={v.columnKey}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </StudyActionForm>
        )}
      </div>
    </section>
  );
}

async function QualityTab({
  organizationId,
  datasetId,
}: {
  organizationId: string;
  datasetId: string;
}) {
  const q = await getDatasetQuality(organizationId, datasetId);
  return (
    <section className="sectioncard">
      <div className="sectioncard__head">
        <h2>Calidad de datos</h2>
      </div>
      <div className="sectioncard__body">
        <div className="statcard-row">
          <div className="statcard">
            <span className="statcard__label">Filas</span>
            <span className="statcard__value">{q.rowCount}</span>
          </div>
          <div className="statcard">
            <span className="statcard__label">Columnas</span>
            <span className="statcard__value">{q.columnCount}</span>
          </div>
          <div className={`statcard${q.duplicateRows > 0 ? ' statcard--warning' : ''}`}>
            <span className="statcard__label">Filas duplicadas</span>
            <span className="statcard__value">{q.duplicateRows}</span>
          </div>
          <div className={`statcard${q.totalMissing > 0 ? ' statcard--warning' : ''}`}>
            <span className="statcard__label">Celdas vacías</span>
            <span className="statcard__value">{q.totalMissing}</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Columna</th>
                <th>Tipo</th>
                <th>Vacíos</th>
                <th>No numéricos</th>
                <th>Distintos</th>
                <th>Mín</th>
                <th>Máx</th>
                <th>Posibles atípicos</th>
              </tr>
            </thead>
            <tbody>
              {q.columns.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td>{VARIABLE_TYPE_LABEL[c.type] ?? c.type}</td>
                  <td>{c.missing}</td>
                  <td>{c.type === 'numeric' ? c.nonNumeric : '—'}</td>
                  <td>{c.distinct}</td>
                  <td>{c.min ?? '—'}</td>
                  <td>{c.max ?? '—'}</td>
                  <td>{c.type === 'numeric' ? c.outliers : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">
          Se reporta sin corregir. Puedes reimportar o ajustar tipos; nada se elimina
          automáticamente.
        </p>
      </div>
    </section>
  );
}
