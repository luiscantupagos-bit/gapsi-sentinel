import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const page = read('../src/app/dashboard/page.tsx');
const exec = read('../src/app/dashboard/_components/exec.tsx');

describe('Dashboard Ejecutivo (CORE-ALIGN-002)', () => {
  it('no reintroduce elementos obsoletos ni ficticios', () => {
    for (const banned of [
      'Sentinel Score',
      'IA Insights',
      'Próximamente',
      'En configuración',
      'Hace un momento',
    ]) {
      expect(page.includes(banned)).toBe(false);
    }
  });

  it('no menciona TASK-009/010/011 en la UI', () => {
    expect(/TASK-0\d\d/.test(page)).toBe(false);
  });

  it('usa datos reales de actividad (no hardcodea el último movimiento)', () => {
    expect(page).toContain('getLastActivity');
    expect(page).toContain('relTime(');
  });

  it('los seis KPI apuntan a rutas reales', () => {
    const hrefs = [
      '/dashboard/diagnostics?status=in_progress',
      '/dashboard/tasks?tab=overdue',
      '/dashboard/capa',
      '/dashboard/audits',
      '/dashboard/documents',
      '/dashboard/audits?status=follow_up',
    ];
    for (const h of hrefs) expect(page).toContain(h);
    expect((page.match(/<KpiTile/g) ?? []).length).toBe(6);
  });

  it('conecta contexto, cumplimiento, mini-gantt y tendencia', () => {
    for (const fn of [
      'getActiveSchemes',
      'getNextAudit',
      'getSchemeCompliance',
      'getGanttRows',
      'getQualityTrend',
      'getSystemStatus',
    ]) {
      expect(page).toContain(fn);
    }
  });

  it('el estado del sistema no presenta un veredicto de riesgo final si la evaluación no es vigente', () => {
    expect(exec).toContain('Evaluación en progreso');
  });
});
