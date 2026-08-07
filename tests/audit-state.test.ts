import { describe, expect, it } from 'vitest';
import {
  AUDIT_STATUS_LABEL,
  InvalidAuditTransitionError,
  assertAuditTransition,
  canTransitionAudit,
  isAuditReopen,
  isExecutionStarted,
  isTerminalAudit,
  validateAuditTransition,
} from '@/features/audits/audit-state';
import {
  PROGRAM_STATUS_LABEL,
  canTransitionProgram,
  validateProgramTransition,
} from '@/features/audits/program-state';
import {
  FINDING_CLASSIFICATION_LABEL,
  canTransitionFinding,
  isFindingOpen,
  requiresFollowUp,
} from '@/features/audits/finding-state';
import { CHECKLIST_RESULT_LABEL, summarizeChecklist } from '@/features/audits/checklist';
import { preparationIndex } from '@/features/audits/preparation';

describe('audit-state', () => {
  it('flujo normal draft→planned→ready→in_progress→report→review→completed→closed', () => {
    expect(canTransitionAudit('draft', 'planned')).toBe(true);
    expect(canTransitionAudit('planned', 'ready')).toBe(true);
    expect(canTransitionAudit('ready', 'in_progress')).toBe(true);
    expect(canTransitionAudit('in_progress', 'report_drafting')).toBe(true);
    expect(canTransitionAudit('report_drafting', 'under_review')).toBe(true);
    expect(canTransitionAudit('under_review', 'completed')).toBe(true);
    expect(canTransitionAudit('completed', 'closed')).toBe(true);
  });

  it('rechaza saltos inválidos', () => {
    expect(canTransitionAudit('draft', 'in_progress')).toBe(false);
    expect(() => assertAuditTransition('planned', 'completed')).toThrow(
      InvalidAuditTransitionError,
    );
  });

  it('ejecutar exige alcance, criterios y líder', () => {
    expect(validateAuditTransition({ to: 'in_progress' }).length).toBe(3);
    expect(
      validateAuditTransition({
        to: 'in_progress',
        hasScope: true,
        hasCriteria: true,
        hasLead: true,
      }),
    ).toHaveLength(0);
  });

  it('cerrar con hallazgos abiertos exige justificación; cancelar exige motivo', () => {
    expect(validateAuditTransition({ to: 'closed', openFollowUpFindings: 2 })).toHaveLength(1);
    expect(
      validateAuditTransition({ to: 'closed', openFollowUpFindings: 2, justification: 'ok' }),
    ).toHaveLength(0);
    expect(validateAuditTransition({ to: 'cancelled' })).toHaveLength(1);
  });

  it('reapertura y terminales', () => {
    expect(isTerminalAudit('closed')).toBe(true);
    expect(canTransitionAudit('closed', 'follow_up')).toBe(false);
    expect(canTransitionAudit('closed', 'follow_up', { reopen: true })).toBe(true);
    expect(isAuditReopen('closed', 'follow_up')).toBe(true);
    expect(isExecutionStarted('in_progress')).toBe(true);
    expect(isExecutionStarted('planned')).toBe(false);
    expect(AUDIT_STATUS_LABEL.in_progress).toBe('En ejecución');
  });
});

describe('program-state', () => {
  it('draft→approved→active→completed', () => {
    expect(canTransitionProgram('draft', 'approved')).toBe(true);
    expect(canTransitionProgram('approved', 'active')).toBe(true);
    expect(canTransitionProgram('active', 'completed')).toBe(true);
    expect(canTransitionProgram('draft', 'active')).toBe(false);
  });
  it('cancelar exige motivo; etiquetas en español', () => {
    expect(validateProgramTransition({ to: 'cancelled' })).toHaveLength(1);
    expect(PROGRAM_STATUS_LABEL.active).toBe('Activo');
  });
});

describe('finding-state', () => {
  it('transiciones y apertura', () => {
    expect(canTransitionFinding('open', 'capa_open')).toBe(true);
    expect(canTransitionFinding('pending_verification', 'effective')).toBe(true);
    expect(canTransitionFinding('open', 'effective')).toBe(false);
    expect(isFindingOpen('open')).toBe(true);
    expect(isFindingOpen('closed')).toBe(false);
    expect(requiresFollowUp('major_nc')).toBe(true);
    expect(requiresFollowUp('strength')).toBe(false);
    expect(FINDING_CLASSIFICATION_LABEL.major_nc).toBe('No conformidad mayor');
  });
});

describe('checklist', () => {
  it('resumen y progreso', () => {
    const s = summarizeChecklist([
      'conforme',
      'parcial',
      'no_conforme',
      'no_evaluado',
      'no_evaluado',
    ]);
    expect(s.total).toBe(5);
    expect(s.evaluated).toBe(3);
    expect(s.pending).toBe(2);
    expect(s.progressPct).toBe(60);
    expect(s.byResult.conforme).toBe(1);
    expect(CHECKLIST_RESULT_LABEL.verificacion_campo).toBe('Requiere verificación en campo');
  });
});

describe('preparation', () => {
  it('índice operativo excluye no_aplica y pondera estados', () => {
    const idx = preparationIndex([
      { state: 'preparado' }, // 1
      { state: 'parcial' }, // 0.5
      { state: 'sin_evidencia' }, // 0
      { state: 'no_aplica' }, // excluido
    ]);
    expect(idx.applicable).toBe(3);
    expect(idx.score).toBe(1.5);
    expect(idx.indexPct).toBe(50); // 1.5/3
    expect(idx.byState.no_aplica).toBe(1);
  });
});
