'use client';

/**
 * Editor especializado de actividades de Programa (DOC-003 §17-31). Reemplaza el
 * repetible genérico: cada actividad tiene «Generar seguimiento» (UI progresiva).
 * `activityId` es estable e invisible (el servidor lo acuña). El periodo del
 * Programa vive arriba; el servidor sigue siendo autoridad de validación.
 */
import { useCallback } from 'react';
import {
  PROGRAM_FREQUENCIES,
  type ProgramBlock,
  type ProgramActivity,
} from '@/features/documents/program-execution';

interface Member {
  id: string;
  name: string;
}
interface Props {
  value: ProgramBlock;
  onChange: (block: ProgramBlock) => void;
  members: Member[];
  editable: boolean;
}

const NOTIFY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Sin aviso anticipado / mismo día' },
  { value: 1, label: '1 día' },
  { value: 3, label: '3 días' },
  { value: 7, label: '7 días' },
  { value: 15, label: '15 días' },
  { value: 30, label: '30 días' },
];

// Tipo de programación visible (§21): combina schedule.type + frequency.
type Kind =
  | 'single'
  | 'range'
  | 'weekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

function kindOf(a: ProgramActivity): Kind {
  if (a.schedule.type === 'single') return 'single';
  if (a.schedule.type === 'range') return 'range';
  return (a.schedule.frequency ?? 'monthly') as Kind;
}

function applyKind(a: ProgramActivity, kind: Kind): ProgramActivity {
  const s = { ...a.schedule };
  if (kind === 'single') {
    return { ...a, schedule: { ...s, type: 'single', frequency: null, interval: null } };
  }
  if (kind === 'range') {
    return { ...a, schedule: { ...s, type: 'range', frequency: null, interval: null } };
  }
  return { ...a, schedule: { ...s, type: 'recurring', frequency: kind, interval: 1 } };
}

function emptyActivity(): ProgramActivity {
  return {
    activityId: '',
    name: '',
    description: '',
    executionEnabled: false,
    responsibleUserId: null,
    schedule: {
      type: 'single',
      startDate: null,
      dueDate: null,
      frequency: null,
      interval: null,
      endDate: null,
    },
    expectedEvidence: '',
    observations: '',
    notifyBeforeDays: 7,
  };
}

export function ProgramActivitiesEditor({ value, onChange, members, editable }: Props) {
  const activities = value.activities;

  const setActivity = useCallback(
    (i: number, next: ProgramActivity) => {
      onChange({ ...value, activities: activities.map((a, j) => (j === i ? next : a)) });
    },
    [value, activities, onChange],
  );
  const move = useCallback(
    (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= activities.length) return;
      const next = [...activities];
      [next[i], next[j]] = [next[j]!, next[i]!];
      onChange({ ...value, activities: next });
    },
    [value, activities, onChange],
  );

  const disabled = !editable;

  return (
    <section className="doc-render__section">
      <h2>Actividades del programa</h2>
      <div className="form-grid-2">
        <div className="field">
          <label className="field__label" htmlFor="prog-start">
            Inicio del programa
          </label>
          <input
            id="prog-start"
            type="date"
            value={value.periodStart ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, periodStart: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="prog-end">
            Fin del programa
          </label>
          <input
            id="prog-end"
            type="date"
            value={value.periodEnd ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, periodEnd: e.target.value || null })}
          />
        </div>
      </div>

      {activities.length === 0 && (
        <p className="empty-state">Sin actividades. Agrega la primera.</p>
      )}

      {activities.map((a, i) => {
        const kind = kindOf(a);
        return (
          <div className="prog-activity" key={i}>
            <div className="prog-activity__head">
              <strong>Actividad {i + 1}</strong>
              {editable && (
                <span className="prog-activity__ctrls">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => move(i, -1)}
                  >
                    Subir
                  </button>
                  <button type="button" className="button button--ghost" onClick={() => move(i, 1)}>
                    Bajar
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() =>
                      onChange({ ...value, activities: activities.filter((_, j) => j !== i) })
                    }
                  >
                    Eliminar
                  </button>
                </span>
              )}
            </div>

            <div className="field">
              <label className="field__label">Actividad</label>
              <input
                value={a.name}
                disabled={disabled}
                onChange={(e) => setActivity(i, { ...a, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label">Descripción</label>
              <textarea
                value={a.description}
                disabled={disabled}
                rows={2}
                onChange={(e) => setActivity(i, { ...a, description: e.target.value })}
              />
            </div>

            <label
              className="field__inline"
              style={{ gap: 'var(--space-2)', alignItems: 'center' }}
            >
              <input
                type="checkbox"
                checked={a.executionEnabled}
                disabled={disabled}
                onChange={(e) => setActivity(i, { ...a, executionEnabled: e.target.checked })}
              />
              <span>Generar seguimiento (crea tareas al publicar)</span>
            </label>

            {a.executionEnabled && (
              <div className="prog-activity__followup">
                <div className="form-grid-2">
                  <div className="field">
                    <label className="field__label">Responsable *</label>
                    <select
                      value={a.responsibleUserId ?? ''}
                      disabled={disabled}
                      onChange={(e) =>
                        setActivity(i, { ...a, responsibleUserId: e.target.value || null })
                      }
                    >
                      <option value="">Selecciona un responsable</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label">Tipo de programación *</label>
                    <select
                      value={kind}
                      disabled={disabled}
                      onChange={(e) => setActivity(i, applyKind(a, e.target.value as Kind))}
                    >
                      <option value="single">Fecha única</option>
                      <option value="range">Rango</option>
                      {PROGRAM_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {kind === 'single' && (
                  <div className="field">
                    <label className="field__label">Fecha de ejecución</label>
                    <input
                      type="date"
                      value={a.schedule.dueDate ?? ''}
                      disabled={disabled}
                      onChange={(e) =>
                        setActivity(i, {
                          ...a,
                          schedule: { ...a.schedule, dueDate: e.target.value || null },
                        })
                      }
                    />
                  </div>
                )}
                {kind === 'range' && (
                  <div className="form-grid-2">
                    <div className="field">
                      <label className="field__label">Fecha de inicio</label>
                      <input
                        type="date"
                        value={a.schedule.startDate ?? ''}
                        disabled={disabled}
                        onChange={(e) =>
                          setActivity(i, {
                            ...a,
                            schedule: { ...a.schedule, startDate: e.target.value || null },
                          })
                        }
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Fecha límite</label>
                      <input
                        type="date"
                        value={a.schedule.dueDate ?? ''}
                        disabled={disabled}
                        onChange={(e) =>
                          setActivity(i, {
                            ...a,
                            schedule: { ...a.schedule, dueDate: e.target.value || null },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                {kind !== 'single' && kind !== 'range' && (
                  <>
                    <div className="form-grid-2">
                      <div className="field">
                        <label className="field__label">Fecha de inicio</label>
                        <input
                          type="date"
                          value={a.schedule.startDate ?? ''}
                          disabled={disabled}
                          onChange={(e) =>
                            setActivity(i, {
                              ...a,
                              schedule: { ...a.schedule, startDate: e.target.value || null },
                            })
                          }
                        />
                      </div>
                      <div className="field">
                        <label className="field__label">Fecha fin (opcional)</label>
                        <input
                          type="date"
                          value={a.schedule.endDate ?? ''}
                          disabled={disabled}
                          onChange={(e) =>
                            setActivity(i, {
                              ...a,
                              schedule: { ...a.schedule, endDate: e.target.value || null },
                            })
                          }
                        />
                      </div>
                    </div>
                    <p className="muted">
                      Se generará una tarea por cada ocurrencia dentro del periodo del Programa (si
                      no hay fecha fin, se usa el fin del programa).
                    </p>
                  </>
                )}

                <div className="form-grid-2">
                  <div className="field">
                    <label className="field__label">Evidencia requerida</label>
                    <input
                      value={a.expectedEvidence}
                      disabled={disabled}
                      placeholder="p. ej. Informe de auditoría"
                      onChange={(e) => setActivity(i, { ...a, expectedEvidence: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label">Avisar antes</label>
                    <select
                      value={a.notifyBeforeDays}
                      disabled={disabled}
                      onChange={(e) =>
                        setActivity(i, { ...a, notifyBeforeDays: Number(e.target.value) })
                      }
                    >
                      {NOTIFY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editable && (
        <button
          type="button"
          className="button button--ghost"
          onClick={() => onChange({ ...value, activities: [...activities, emptyActivity()] })}
        >
          Agregar actividad
        </button>
      )}
    </section>
  );
}
