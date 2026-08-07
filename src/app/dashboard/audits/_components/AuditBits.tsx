/**
 * Presentación compartida de auditorías (server-safe): badges y utilidades.
 */
import {
  AUDIT_STATUS_LABEL,
  AUDIT_TYPE_LABEL,
  type AuditStatus,
  type AuditType,
} from '@/features/audits/audit-state';
import { PROGRAM_STATUS_LABEL, type ProgramStatus } from '@/features/audits/program-state';
import {
  FINDING_CLASSIFICATION_LABEL,
  FINDING_SEVERITY_LABEL,
  FINDING_STATUS_LABEL,
  type FindingClassification,
  type FindingSeverity,
  type FindingStatus,
} from '@/features/audits/finding-state';
import { CHECKLIST_RESULT_LABEL, type ChecklistResult } from '@/features/audits/checklist';
import { PREPARATION_STATE_LABEL, type PreparationState } from '@/features/audits/preparation';

export function AuditStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--aud-${status}`}>
      {AUDIT_STATUS_LABEL[status as AuditStatus] ?? status}
    </span>
  );
}
export function auditTypeLabel(t: string): string {
  return AUDIT_TYPE_LABEL[t as AuditType] ?? t;
}
export function ProgramStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--prog-${status}`}>
      {PROGRAM_STATUS_LABEL[status as ProgramStatus] ?? status}
    </span>
  );
}
export function FindingClassBadge({ classification }: { classification: string }) {
  return (
    <span className={`badge badge--fcl-${classification}`}>
      {FINDING_CLASSIFICATION_LABEL[classification as FindingClassification] ?? classification}
    </span>
  );
}
export function FindingStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--fst-${status}`}>
      {FINDING_STATUS_LABEL[status as FindingStatus] ?? status}
    </span>
  );
}
export function severityLabel(s: string): string {
  return FINDING_SEVERITY_LABEL[s as FindingSeverity] ?? s;
}
export function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`badge badge--res-${result}`}>
      {CHECKLIST_RESULT_LABEL[result as ChecklistResult] ?? result}
    </span>
  );
}
export function PrepStateBadge({ state }: { state: string }) {
  return (
    <span className={`badge badge--prep-${state}`}>
      {PREPARATION_STATE_LABEL[state as PreparationState] ?? state}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <span className="tprogress" title={`${value}%`}>
      <span className="tprogress__track">
        <span
          className="tprogress__fill"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
      <span className="tprogress__num">{value}%</span>
    </span>
  );
}
