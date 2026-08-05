'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  pendingLabel = 'Procesando…',
  variant = 'primary',
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`button ${variant === 'primary' ? 'button--primary' : 'button--ghost'}`}
      type="submit"
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
