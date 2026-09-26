/**
 * DOC-004 — estados PUROS del registro y folio. §57.
 */
import { describe, expect, it } from 'vitest';
import {
  RECORD_STATUSES,
  RECORD_STATUS_LABEL,
  recordStatusLabel,
  isRecordEditable,
  isRecordClosed,
  canTransition,
  recordSourceLabel,
  formatRecordNumber,
} from '@/features/records/record-state';

describe('estados y etiquetas (§8)', () => {
  it('etiqueta humana para cada estado', () => {
    for (const s of RECORD_STATUSES) expect(RECORD_STATUS_LABEL[s]).toBeTruthy();
    expect(recordStatusLabel('submitted')).toBe('Enviado');
  });
  it('editable solo en borrador/en proceso; cerrado/cancelado son finales', () => {
    expect(isRecordEditable('draft')).toBe(true);
    expect(isRecordEditable('in_progress')).toBe(true);
    expect(isRecordEditable('submitted')).toBe(false);
    expect(isRecordClosed('closed')).toBe(true);
    expect(isRecordClosed('cancelled')).toBe(true);
    expect(isRecordClosed('draft')).toBe(false);
  });
});

describe('transiciones del workflow', () => {
  it('permite el flujo de captura y bloquea desde un estado final (§36)', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'reviewed')).toBe(true);
    expect(canTransition('reviewed', 'closed')).toBe(true);
    expect(canTransition('submitted', 'in_progress')).toBe(true); // devolver a proceso
    expect(canTransition('closed', 'in_progress')).toBe(false); // inmutable
    expect(canTransition('cancelled', 'submitted')).toBe(false);
  });
});

describe('origen y folio (§7/§32)', () => {
  it('etiqueta el origen (default manual)', () => {
    expect(recordSourceLabel('haccp_control_plan')).toBe('Plan de control HACCP');
    expect(recordSourceLabel(null)).toBe('Manual');
    expect(recordSourceLabel('desconocido')).toBe('Manual');
  });
  it('formatea el folio REG-AAAA-###### con padding', () => {
    expect(formatRecordNumber(2026, 1)).toBe('REG-2026-000001');
    expect(formatRecordNumber(2026, 123456)).toBe('REG-2026-123456');
  });
});
