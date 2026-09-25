'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import { createPlanAction, type FormState } from '../actions';

export function NewPlanForm({
  members,
  sites,
}: {
  members: { id: string; name: string }[];
  sites: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<FormState | null, FormData>(createPlanAction, null);
  return (
    <form action={formAction} className="stack-form">
      <label>
        Nombre del plan *
        <input name="title" required maxLength={200} placeholder="Plan HACCP para…" />
      </label>
      <label>
        Alcance
        <textarea name="scope" rows={2} placeholder="Productos, líneas, procesos cubiertos" />
      </label>
      <label>
        Producto / proceso
        <input name="productProcess" maxLength={200} />
      </label>
      <label>
        Descripción
        <textarea name="description" rows={2} />
      </label>
      <label>
        Sitio
        <select name="siteId" defaultValue="">
          <option value="">— Sin sitio específico —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Responsable
        <select name="responsibleUserId" defaultValue="">
          <option value="">— Sin asignar —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <SubmitButton variant="primary" pendingLabel="Creando…">
          Crear plan
        </SubmitButton>
        {state && !state.ok && (
          <span role="status" className="msg msg--error">
            {state.message}
            {state.errors?.length ? ` — ${state.errors.join(' ')}` : ''}
          </span>
        )}
      </div>
    </form>
  );
}
