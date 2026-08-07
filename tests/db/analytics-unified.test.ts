/**
 * TASK-011 — Integración del dataset unificado (híbrido en vivo).
 *
 * Verifica sobre los datos sembrados que `loadUnifiedEvents`:
 *  - devuelve los eventos nativos + registros agregados en vivo (CAPA, etc.),
 *  - deduplica: un evento nativo enlazado a una acción CAPA suprime el agregado,
 *  - respeta RLS (no filtra eventos de otra organización).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb } from './_helpers';
import { loadUnifiedEvents } from '@/server/analytics';

const ORG_A = '00000000-0000-4000-8000-0000000000a0';
const ORG_B = '00000000-0000-4000-8000-0000000000b0';
const LINKED_ACTION = '00000000-0000-4000-8000-00000ca10003';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

describe.skipIf(!hasDb)('dataset unificado (loadUnifiedEvents)', () => {
  it('incluye eventos nativos sembrados', async () => {
    const events = await loadUnifiedEvents(ORG_A);
    const native = events.filter((e) => e.source === 'quality_event');
    expect(native.length).toBeGreaterThanOrEqual(12);
    expect(native.some((e) => e.folio === 'EVT-2026-0001')).toBe(true);
  });

  it('agrega en vivo registros de otros módulos (CAPA)', async () => {
    const events = await loadUnifiedEvents(ORG_A);
    expect(events.some((e) => e.source === 'capa')).toBe(true);
  });

  it('deduplica: el evento nativo enlazado suprime la acción CAPA agregada', async () => {
    const events = await loadUnifiedEvents(ORG_A);
    // El agregado equivalente NO debe aparecer.
    expect(events.some((e) => e.key === `capa_action:${LINKED_ACTION}`)).toBe(false);
    // El evento nativo enlazado sí, marcado como convertido (referencia la acción).
    const linked = events.find((e) => e.folio === 'EVT-2026-0012');
    expect(linked?.origin).toBe('converted');
  });

  it('respeta RLS: la otra organización no ve los eventos de A', async () => {
    const events = await loadUnifiedEvents(ORG_B);
    expect(events.some((e) => e.folio === 'EVT-2026-0001')).toBe(false);
  });
});
