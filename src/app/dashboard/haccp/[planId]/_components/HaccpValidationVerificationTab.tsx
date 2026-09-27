'use client';

/**
 * WORKSPACE-REORG paso 11 — «Validación y verificación». Consolida ambos conceptos en una
 * pestaña principal manteniendo la separación semántica INTERNA en dos subtabs: Validación
 * (HACCP-005: la medida ES CAPAZ) y Verificación (HACCP-006: el sistema SE EJECUTA). No se
 * mezclan en una misma tabla. Reutiliza los componentes existentes; sin cambios de datos.
 */
import { useState } from 'react';
import type { getValidations } from '@/server/haccp-validation';
import type { getVerifications } from '@/server/haccp-verification';
import { HaccpValidationTab } from './HaccpValidationTab';
import { HaccpVerificationTab } from './HaccpVerificationTab';

type ValidationData = NonNullable<Awaited<ReturnType<typeof getValidations>>>;
type VerificationData = NonNullable<Awaited<ReturnType<typeof getVerifications>>>;
type Sub = 'validacion' | 'verificacion';

export function HaccpValidationVerificationTab({
  planId,
  validation,
  verification,
  members,
  documents,
  formDocuments,
  canEdit,
}: {
  planId: string;
  validation: ValidationData | null;
  verification: VerificationData | null;
  members: { id: string; name: string }[];
  documents: { id: string; code: string; title: string }[];
  formDocuments: { id: string; code: string; title: string }[];
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<Sub>('validacion');
  return (
    <>
      <div className="doc-panel__tablist" role="tablist" aria-label="Validación y verificación">
        {(
          [
            ['validacion', 'Validación'],
            ['verificacion', 'Verificación'],
          ] as [Sub, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={sub === key}
            className={`doc-panel__tab${sub === key ? ' is-active' : ''}`}
            onClick={() => setSub(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'validacion' &&
        (validation ? (
          <HaccpValidationTab
            planId={planId}
            data={validation}
            members={members}
            documents={documents}
            canEdit={canEdit}
          />
        ) : (
          <p className="empty-state empty-state--compact">Sin versión activa.</p>
        ))}

      {sub === 'verificacion' &&
        (verification ? (
          <HaccpVerificationTab
            planId={planId}
            data={verification}
            members={members}
            documents={formDocuments}
            canEdit={canEdit}
          />
        ) : (
          <p className="empty-state empty-state--compact">Sin versión activa.</p>
        ))}
    </>
  );
}
