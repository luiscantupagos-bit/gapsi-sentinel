import { describe, expect, it } from 'vitest';
import {
  createSimulatedEvidenceStorage,
  EVIDENCE_STORAGE_BACKENDS,
} from '@/features/evidence/storage';

describe('almacenamiento de evidencias (simulado)', () => {
  it('expone los backends aprobados', () => {
    expect([...EVIDENCE_STORAGE_BACKENDS]).toEqual(['local', 'simulated', 'private']);
  });

  it('deriva una clave determinista sin E/S real ni URL firmada', async () => {
    const storage = createSimulatedEvidenceStorage();
    const ref = await storage.put({
      organizationId: 'org-1',
      diagnosticId: 'diag-1',
      answerId: 'ans-1',
      filename: 'informe final.pdf',
    });

    expect(storage.backend).toBe('simulated');
    expect(ref.backend).toBe('simulated');
    expect(ref.objectKey).toBe('org-1/diag-1/ans-1/informe_final.pdf');
    expect(ref.referenceUrl).toBe('simulated://org-1/diag-1/ans-1/informe_final.pdf');
  });

  it('es determinista para las mismas entradas', async () => {
    const storage = createSimulatedEvidenceStorage();
    const input = {
      organizationId: 'org-1',
      diagnosticId: 'diag-1',
      answerId: 'ans-1',
      filename: 'a.pdf',
    };
    const first = await storage.put(input);
    const second = await storage.put(input);
    expect(first).toEqual(second);
  });
});
