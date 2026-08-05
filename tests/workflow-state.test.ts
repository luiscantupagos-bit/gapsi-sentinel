import { describe, expect, it } from 'vitest';
import {
  assertVersionTransition,
  canTransitionVersion,
  InvalidVersionTransitionError,
  isEditableStatus,
  VERSION_STATUSES,
} from '@/features/documents/workflow-state';

describe('máquina de estados de versión documental', () => {
  it('define los estados del ciclo', () => {
    expect([...VERSION_STATUSES]).toEqual([
      'draft',
      'in_review',
      'changes_requested',
      'in_approval',
      'approved',
      'published',
      'obsolete',
      'archived',
    ]);
  });

  it('permite el flujo secuencial válido', () => {
    expect(canTransitionVersion('draft', 'in_review')).toBe(true);
    expect(canTransitionVersion('in_review', 'in_approval')).toBe(true);
    expect(canTransitionVersion('in_approval', 'approved')).toBe(true);
    expect(canTransitionVersion('approved', 'published')).toBe(true);
    expect(canTransitionVersion('published', 'obsolete')).toBe(true);
  });

  it('permite volver a edición al solicitar cambios', () => {
    expect(canTransitionVersion('in_review', 'changes_requested')).toBe(true);
    expect(canTransitionVersion('in_approval', 'changes_requested')).toBe(true);
    expect(canTransitionVersion('changes_requested', 'in_review')).toBe(true);
  });

  it('rechaza saltos arbitrarios', () => {
    expect(canTransitionVersion('draft', 'published')).toBe(false);
    expect(canTransitionVersion('draft', 'approved')).toBe(false);
    expect(canTransitionVersion('in_review', 'published')).toBe(false);
    expect(canTransitionVersion('published', 'draft')).toBe(false);
    expect(() => assertVersionTransition('draft', 'published')).toThrow(
      InvalidVersionTransitionError,
    );
  });

  it('solo borrador y cambios solicitados son editables', () => {
    expect(isEditableStatus('draft')).toBe(true);
    expect(isEditableStatus('changes_requested')).toBe(true);
    expect(isEditableStatus('in_review')).toBe(false);
    expect(isEditableStatus('approved')).toBe(false);
    expect(isEditableStatus('published')).toBe(false);
  });
});
