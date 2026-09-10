'use client';

/**
 * Configuración del **semáforo global de cumplimiento** (CORE-UX-005 §11-14).
 * Umbrales (con decimales) + colores por organización, con preview reactivo. El
 * servidor es la autoridad de validación; aquí solo se guía al usuario.
 */
import { useState } from 'react';
import { useActionState } from 'react';
import { saveCompliancePolicyAction, type CompliancePolicyState } from '../actions';
import { SubmitButton } from '../../documents/_components/SubmitButton';
import {
  resolveComplianceBand,
  validateResolvedPolicy,
  type ResolvedCompliancePolicy,
} from '@/features/compliance/compliance-band';

interface Props {
  initial: ResolvedCompliancePolicy;
}

// Valores de ejemplo del preview (§13): se recolorean con la configuración actual.
const PREVIEW_VALUES = [95, 85, 75, 65];

export function ComplianceThresholdsForm({ initial }: Props) {
  const [state, action] = useActionState<CompliancePolicyState | null, FormData>(
    saveCompliancePolicyAction,
    null,
  );
  const [policy, setPolicy] = useState<ResolvedCompliancePolicy>(initial);

  const set = (patch: Partial<ResolvedCompliancePolicy>) => setPolicy((p) => ({ ...p, ...patch }));
  const clientErrors = validateResolvedPolicy(policy);

  const rows: {
    key: keyof Pick<ResolvedCompliancePolicy, 'greenMin' | 'yellowMin' | 'orangeMin'>;
    colorKey: keyof Pick<ResolvedCompliancePolicy, 'green' | 'yellow' | 'orange'>;
    name: string;
    colorName: string;
    label: string;
    hint: string;
  }[] = [
    {
      key: 'greenMin',
      colorKey: 'green',
      name: 'greenMin',
      colorName: 'greenColor',
      label: 'Verde',
      hint: 'Desde',
    },
    {
      key: 'yellowMin',
      colorKey: 'yellow',
      name: 'yellowMin',
      colorName: 'yellowColor',
      label: 'Amarillo',
      hint: 'Desde',
    },
    {
      key: 'orangeMin',
      colorKey: 'orange',
      name: 'orangeMin',
      colorName: 'orangeColor',
      label: 'Naranja',
      hint: 'Desde',
    },
  ];

  return (
    <form action={action} className="doc-form" style={{ maxWidth: '42rem' }}>
      {state && (
        <p role="status" className={`msg ${state.ok ? 'msg--ok' : 'msg--error'}`}>
          {state.message}
        </p>
      )}

      <p className="muted">
        Estos rangos se aplican a los <strong>indicadores de cumplimiento</strong> de C3 Sentinel
        (cumplimiento, conformidad, avance, efectividad). <strong>No</strong> se aplican
        automáticamente a métricas de riesgo, errores, vencimientos o almacenamiento.
      </p>

      {rows.map((r) => (
        <div className="form-grid-2" key={r.name}>
          <div className="field">
            <label className="field__label" htmlFor={r.name}>
              {r.label} · {r.hint} (%)
            </label>
            <input
              id={r.name}
              name={r.name}
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={String(policy[r.key])}
              onChange={(e) =>
                set({ [r.key]: Number(e.target.value) } as Partial<ResolvedCompliancePolicy>)
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={r.colorName}>
              Color {r.label.toLowerCase()}
            </label>
            <input
              id={r.colorName}
              name={r.colorName}
              type="color"
              value={policy[r.colorKey]}
              onChange={(e) =>
                set({ [r.colorKey]: e.target.value } as Partial<ResolvedCompliancePolicy>)
              }
            />
          </div>
        </div>
      ))}

      <div className="form-grid-2">
        <div className="field">
          <label className="field__label">Rojo · Menor a {policy.orangeMin}%</label>
          <p className="muted">Se deriva automáticamente por debajo del mínimo naranja.</p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="redColor">
            Color rojo
          </label>
          <input
            id="redColor"
            name="redColor"
            type="color"
            value={policy.red}
            onChange={(e) => set({ red: e.target.value })}
          />
        </div>
      </div>

      {clientErrors.length > 0 && (
        <ul className="msg msg--error" style={{ listStyle: 'disc', paddingLeft: '1.25rem' }}>
          {clientErrors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <h3>Vista previa</h3>
      <ul className="compliance-preview">
        {PREVIEW_VALUES.map((v) => {
          const band = resolveComplianceBand(v, policy);
          return (
            <li key={v} className="compliance-preview__row">
              <span
                className="compliance-preview__dot"
                style={{ background: band.color }}
                aria-hidden
              />
              <span className="compliance-preview__pct">{v}%</span>
              <span className="compliance-preview__label">{band.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="form-actions">
        <SubmitButton pendingLabel="Guardando…">Guardar semáforo de cumplimiento</SubmitButton>
      </div>
    </form>
  );
}
