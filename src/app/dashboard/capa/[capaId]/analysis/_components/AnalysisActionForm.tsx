'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../../../documents/_components/SubmitButton';
import type { FormState } from '../analysis-actions';

type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

/** Formulario reutilizable con estado (useActionState) para las herramientas. */
export function AnalysisActionForm({
  action,
  hidden,
  button,
  children,
  variant = 'ghost',
  className = 'wf-form',
  encType,
}: {
  action: Action;
  hidden: Record<string, string>;
  button: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'ghost';
  className?: string;
  encType?: string;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className={className} encType={encType}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <SubmitButton variant={variant} pendingLabel="Procesando…">
        {button}
      </SubmitButton>
      {state && (
        <span role="status" className={state.ok ? 'msg msg--ok' : 'msg msg--error'}>
          {state.message}
          {state.errors && state.errors.length > 0 ? ` — ${state.errors.join(' ')}` : ''}
        </span>
      )}
    </form>
  );
}
