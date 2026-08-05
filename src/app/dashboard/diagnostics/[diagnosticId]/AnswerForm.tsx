'use client';

import { useActionState } from 'react';
import type { DiagnosticDetail, QuestionView } from '@/server/diagnostics';
import { saveAnswersAction, submitDiagnosticAction, type ActionState } from './actions';

function QuestionField({ q }: { q: QuestionView }) {
  const name = `answer_${q.id}`;
  return (
    <fieldset className="question">
      <legend>
        <span className="muted">{q.code}</span> {q.prompt}{' '}
        {q.isCritical && <span className="badge badge--critical">Crítica</span>}
        {!q.isScored && <span className="badge">No puntúa</span>}
      </legend>

      {q.questionType === 'text' ? (
        <textarea
          name={`text_${q.id}`}
          rows={2}
          defaultValue={q.answer?.valueText ?? ''}
          aria-label={`Respuesta de ${q.code}`}
          placeholder="Observación (opcional)"
        />
      ) : (
        <div className="options">
          {q.options.map((o) => (
            <label key={o.id} className="option">
              <input
                type="radio"
                name={name}
                value={`opt:${o.id}`}
                defaultChecked={
                  q.answer?.status === 'answered' && q.answer.selectedOptionId === o.id
                }
              />
              {o.label}
            </label>
          ))}
          {q.allowsNotApplicable && (
            <label className="option">
              <input
                type="radio"
                name={name}
                value="na"
                defaultChecked={q.answer?.status === 'not_applicable'}
              />
              No aplica
            </label>
          )}
          {q.allowsNotApplicable && (
            <input
              type="text"
              name={`na_${q.id}`}
              className="na-justification"
              defaultValue={q.answer?.naJustification ?? ''}
              placeholder="Justificación de 'No aplica'"
              aria-label={`Justificación de No aplica para ${q.code}`}
            />
          )}
        </div>
      )}
    </fieldset>
  );
}

function ReadOnlyQuestion({ q }: { q: QuestionView }) {
  let value = 'Sin responder';
  if (q.answer?.status === 'not_applicable')
    value = `No aplica — ${q.answer.naJustification ?? ''}`;
  else if (q.answer?.status === 'answered') {
    if (q.questionType === 'text') value = q.answer.valueText || '(sin observación)';
    else value = q.options.find((o) => o.id === q.answer?.selectedOptionId)?.label ?? 'Respondida';
  }
  return (
    <p className="question question--readonly">
      <span className="muted">{q.code}</span> {q.prompt}{' '}
      {q.isCritical && <span className="badge badge--critical">Crítica</span>}
      <br />
      <strong>{value}</strong>
    </p>
  );
}

export function AnswerForm({ detail }: { detail: DiagnosticDetail }) {
  const [saveState, saveAction, savePending] = useActionState<ActionState | null, FormData>(
    saveAnswersAction,
    null,
  );
  const [submitState, submitAction, submitPending] = useActionState<ActionState | null, FormData>(
    submitDiagnosticAction,
    null,
  );

  const sections = detail.sections.map((section) => (
    <section key={section.id} className="qsection">
      <h3>
        {section.code} · {section.title}
      </h3>
      {section.requirements.map((req) => (
        <div key={req.id} className="card requirement">
          <p className="requirement__title">
            {req.code} · {req.title}{' '}
            {req.isCritical && <span className="badge badge--critical">Requisito crítico</span>}
          </p>
          {req.questions.map((q) =>
            detail.editable ? (
              <QuestionField key={q.id} q={q} />
            ) : (
              <ReadOnlyQuestion key={q.id} q={q} />
            ),
          )}
        </div>
      ))}
    </section>
  ));

  if (!detail.editable) {
    return (
      <div>
        <p className="msg msg--info" role="status">
          Diagnóstico <strong>{detail.status}</strong>: las respuestas ya no pueden editarse.
        </p>
        {sections}
      </div>
    );
  }

  return (
    <>
      <form action={saveAction}>
        <input type="hidden" name="diagnosticId" value={detail.id} />
        {sections}
        <div className="form-actions">
          <button className="button" type="submit" disabled={savePending}>
            {savePending ? 'Guardando…' : 'Guardar avance'}
          </button>
          {saveState && (
            <span role="status" className={saveState.ok ? 'msg msg--ok' : 'msg msg--error'}>
              {saveState.message}
            </span>
          )}
        </div>
      </form>

      <form action={submitAction} className="submit-form">
        <input type="hidden" name="diagnosticId" value={detail.id} />
        <button className="button button--primary" type="submit" disabled={submitPending}>
          {submitPending ? 'Enviando…' : 'Enviar diagnóstico'}
        </button>
        {submitState && !submitState.ok && (
          <div role="alert" className="msg msg--error">
            <p>{submitState.message}</p>
            {submitState.errors && submitState.errors.length > 0 && (
              <ul>
                {submitState.errors.map((code) => (
                  <li key={code}>Falta responder: {code}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </>
  );
}
