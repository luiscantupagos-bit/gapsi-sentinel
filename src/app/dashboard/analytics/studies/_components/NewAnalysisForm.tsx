'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '../../../documents/_components/SubmitButton';
import { runAnalysisAction, type FormState } from '../actions';
import { STUDY_METHOD_LABEL, type StudyMethod } from '@/features/studies/analysis-adapter';

export interface VarOption {
  columnKey: string;
  label: string;
  varType: string;
}

const METHOD_HELP: Record<StudyMethod, string> = {
  descriptive: 'Resumen (media, mediana, dispersión) o frecuencias de una variable.',
  pareto: 'Concentración: qué categorías acumulan la mayor parte (regla 80/20).',
  trend: 'Comportamiento de una medida o conteo a lo largo del tiempo.',
  correlation: 'Asociación lineal entre dos variables numéricas (no implica causa).',
  regression: 'Recta que describe la relación entre dos variables numéricas.',
  group_compare: 'Compara los descriptivos de una medida entre grupos.',
  anova: 'Evalúa si las medias difieren entre varios grupos.',
  chi_square: 'Asociación entre dos variables categóricas.',
};

const METHODS = Object.keys(STUDY_METHOD_LABEL) as StudyMethod[];

/** Formulario para ejecutar un análisis; muestra los campos según el método. */
export function NewAnalysisForm({
  studyId,
  datasetId,
  variables,
}: {
  studyId: string;
  datasetId: string;
  variables: VarOption[];
}) {
  const [method, setMethod] = useState<StudyMethod>('descriptive');
  const [state, formAction] = useActionState<FormState | null, FormData>(runAnalysisAction, null);

  const numeric = variables.filter((v) => v.varType === 'numeric');
  const categorical = variables.filter((v) => v.varType === 'categorical' || v.varType === 'text');
  const temporal = variables.filter((v) => v.varType === 'temporal');

  const Select = ({
    name,
    label,
    options,
    allowCount,
  }: {
    name: string;
    label: string;
    options: VarOption[];
    allowCount?: boolean;
  }) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <select name={name} defaultValue={allowCount ? '__count__' : options[0]?.columnKey}>
        {allowCount && <option value="__count__">Conteo de filas</option>}
        {options.map((v) => (
          <option key={v.columnKey} value={v.columnKey}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form action={formAction} className="filter-bar">
      <input type="hidden" name="studyId" value={studyId} />
      <input type="hidden" name="datasetId" value={datasetId} />

      <label className="field">
        <span className="field__label">Método</span>
        <select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as StudyMethod)}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {STUDY_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>

      {method === 'descriptive' && <Select name="variable" label="Variable" options={variables} />}

      {method === 'pareto' && (
        <>
          <Select
            name="category"
            label="Categoría"
            options={categorical.length ? categorical : variables}
          />
          <Select name="weight" label="Peso" options={numeric} allowCount />
        </>
      )}

      {method === 'trend' && (
        <>
          <Select name="date" label="Fecha" options={temporal.length ? temporal : variables} />
          <Select name="value" label="Medida" options={numeric} allowCount />
          <label className="field">
            <span className="field__label">Periodo</span>
            <select name="period" defaultValue="monthly">
              <option value="daily">Diario</option>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </label>
        </>
      )}

      {(method === 'correlation' || method === 'regression') && (
        <>
          <Select name="x" label="Variable X" options={numeric} />
          <Select name="y" label="Variable Y" options={numeric} />
        </>
      )}

      {(method === 'group_compare' || method === 'anova') && (
        <>
          <Select
            name="category"
            label="Grupo"
            options={categorical.length ? categorical : variables}
          />
          <Select name="value" label="Medida" options={numeric} />
        </>
      )}

      {method === 'chi_square' && (
        <>
          <Select
            name="x"
            label="Variable A"
            options={categorical.length ? categorical : variables}
          />
          <Select
            name="y"
            label="Variable B"
            options={categorical.length ? categorical : variables}
          />
        </>
      )}

      <label className="field">
        <span className="field__label">Título (opcional)</span>
        <input name="title" placeholder="p. ej. Defectos por turno" />
      </label>

      <SubmitButton variant="primary" pendingLabel="Ejecutando…">
        Ejecutar análisis
      </SubmitButton>
      <p className="field-hint">{METHOD_HELP[method]}</p>
      {state && (
        <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors && state.errors.length > 0 ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}
