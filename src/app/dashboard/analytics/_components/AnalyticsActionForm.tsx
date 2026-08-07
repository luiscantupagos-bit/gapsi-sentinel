'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import type { FormState } from '../actions';

type Action = (prev: FormState | null, fd: FormData) => Promise<FormState>;

/** Envoltorio de formulario para las server actions de analítica. */
export function AnalyticsActionForm({
  action,
  hidden,
  button,
  variant = 'ghost',
  className,
  children,
}: {
  action: Action;
  hidden?: Record<string, string>;
  button: string;
  variant?: 'primary' | 'ghost';
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(action, null);
  return (
    <form action={formAction} className={className ?? 'wf-form'}>
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
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
