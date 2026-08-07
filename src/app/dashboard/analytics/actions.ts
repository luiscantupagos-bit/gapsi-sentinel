'use server';

/**
 * Server Actions de la capa analítica (TASK-011): alta de eventos de calidad,
 * alta de KPI, recálculo de resultados, evaluación y resolución de alertas.
 * Organización y usuario desde la sesión; permisos validados en la capa de datos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireServerSession } from '@/server/session';
import {
  QualityEventPermissionError,
  QualityEventValidationError,
  createQualityEvent,
} from '@/server/quality-events';
import {
  KpiPermissionError,
  KpiValidationError,
  createKpiDefinition,
  recomputeKpiResults,
} from '@/server/kpis';
import { evaluateAndPersistAlerts, resolveAlert } from '@/server/quality-alerts';

export interface FormState {
  ok: boolean;
  message: string;
  errors?: string[];
}

function toState(error: unknown): FormState {
  if (error instanceof QualityEventValidationError || error instanceof KpiValidationError)
    return { ok: false, message: 'Revisa los datos.', errors: error.errors };
  if (error instanceof QualityEventPermissionError || error instanceof KpiPermissionError)
    return { ok: false, message: error.message };
  return { ok: false, message: 'Ocurrió un error al procesar la solicitud.' };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === '' ? null : v;
};
const num = (fd: FormData, k: string): number | null => {
  const v = s(fd, k);
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function revalidateAnalytics(extra?: string) {
  revalidatePath('/dashboard/analytics');
  revalidatePath('/dashboard/quality-events');
  revalidatePath('/dashboard/kpis');
  revalidatePath('/dashboard');
  if (extra) revalidatePath(extra);
}

export async function createQualityEventAction(
  _p: FormState | null,
  fd: FormData,
): Promise<FormState> {
  const session = await requireServerSession();
  let id: string;
  try {
    id = await createQualityEvent(session.organizationId, session.userId, {
      title: s(fd, 'title'),
      description: opt(fd, 'description'),
      eventType: s(fd, 'eventType') || undefined,
      eventDate: opt(fd, 'eventDate') ?? undefined,
      severity: s(fd, 'severity') || undefined,
      categoryId: opt(fd, 'categoryId'),
      area: opt(fd, 'area'),
      process: opt(fd, 'process'),
      productText: opt(fd, 'productText'),
      machineText: opt(fd, 'machineText'),
      shiftText: opt(fd, 'shiftText'),
      supplierText: opt(fd, 'supplierText'),
      lotText: opt(fd, 'lotText'),
      quantityAffected: num(fd, 'quantityAffected'),
      unitsProduced: num(fd, 'unitsProduced'),
      cost: num(fd, 'cost'),
      durationHours: num(fd, 'durationHours'),
    });
  } catch (error) {
    return toState(error);
  }
  revalidateAnalytics(`/dashboard/quality-events/${id}`);
  redirect('/dashboard/quality-events');
}

export async function createKpiAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const eventType = s(fd, 'filterEventType');
  let id: string;
  try {
    id = await createKpiDefinition(session.organizationId, session.userId, {
      name: s(fd, 'name'),
      description: opt(fd, 'description'),
      source: s(fd, 'source'),
      measure: s(fd, 'measure'),
      measureField: opt(fd, 'measureField'),
      period: s(fd, 'period'),
      unit: opt(fd, 'unit'),
      target: num(fd, 'target'),
      warningThreshold: num(fd, 'warningThreshold'),
      criticalThreshold: num(fd, 'criticalThreshold'),
      desiredDirection: s(fd, 'desiredDirection') || 'lower',
      filters: eventType ? { eventType: [eventType] } : null,
    });
  } catch (error) {
    return toState(error);
  }
  await recomputeKpiResults(session.organizationId, id).catch(() => 0);
  revalidateAnalytics(`/dashboard/kpis/${id}`);
  redirect(`/dashboard/kpis/${id}`);
}

export async function recomputeKpiAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  const kpiId = opt(fd, 'kpiId') ?? undefined;
  try {
    const n = await recomputeKpiResults(session.organizationId, kpiId);
    revalidateAnalytics(kpiId ? `/dashboard/kpis/${kpiId}` : undefined);
    return { ok: true, message: `Resultados recalculados (${n} periodos).` };
  } catch (error) {
    return toState(error);
  }
}

export async function evaluateAlertsAction(_p: FormState | null): Promise<FormState> {
  const session = await requireServerSession();
  try {
    const n = await evaluateAndPersistAlerts(session.organizationId);
    revalidateAnalytics();
    return { ok: true, message: n > 0 ? `${n} alertas nuevas.` : 'Sin alertas nuevas.' };
  } catch (error) {
    return toState(error);
  }
}

export async function resolveAlertAction(_p: FormState | null, fd: FormData): Promise<FormState> {
  const session = await requireServerSession();
  try {
    await resolveAlert(session.organizationId, session.userId, s(fd, 'alertId'));
    revalidateAnalytics();
    return { ok: true, message: 'Alerta resuelta.' };
  } catch (error) {
    return toState(error);
  }
}
