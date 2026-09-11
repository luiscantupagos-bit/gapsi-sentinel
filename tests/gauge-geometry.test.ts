/**
 * Geometría del gauge «Estado del sistema» (UI-FIX). Motor puro y determinista.
 */
import { describe, expect, it } from 'vitest';
import { clampPercent, gaugeArc, GAUGE } from '@/features/dashboard/gauge-geometry';

describe('clampPercent (§6)', () => {
  it('acota a [0, 100] y trata NaN/Infinity como 0', () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(69.99)).toBe(69.99);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('gaugeArc (§4/§5/§14)', () => {
  it('el arco de progreso NUNCA usa large-arc-flag = 1 (bug corregido)', () => {
    for (const v of [0, 25, 50, 69.99, 70, 79.99, 80, 89.99, 90, 100]) {
      const { progress } = gaugeArc(v);
      if (progress) {
        // El flag de arco (5º parámetro tras el radio) debe ser 0.
        expect(progress).toMatch(/A 72 72 0 0 1 /);
        expect(progress).not.toMatch(/A 72 72 0 1 1 /);
      }
    }
  });

  it('0% no dibuja arco de progreso (evita punto suelto)', () => {
    expect(gaugeArc(0).progress).toBeNull();
    expect(gaugeArc(0).clamped).toBe(0);
  });

  it('50% termina en el centro superior (90, 18)', () => {
    // polar(90°) = (cx, cy - r) = (90, 18).
    expect(gaugeArc(50).progress).toContain(' 90 18');
  });

  it('100% recorre el semicírculo completo hasta la derecha (162, 90)', () => {
    // polar(0°) = (cx + r, cy) = (162, 90).
    const { track, progress } = gaugeArc(100);
    expect(progress).toContain(' 162 90');
    expect(track).toContain(' 162 90');
  });

  it('acota valores fuera de rango antes de calcular', () => {
    expect(gaugeArc(150).clamped).toBe(100);
    expect(gaugeArc(-5).clamped).toBe(0);
    expect(gaugeArc(Number.NaN).progress).toBeNull();
  });

  it('es determinista (mismo valor → mismo path)', () => {
    expect(gaugeArc(62.5)).toEqual(gaugeArc(62.5));
  });

  it('viewBox estable', () => {
    expect(GAUGE.viewBox).toBe('0 0 180 108');
  });
});
