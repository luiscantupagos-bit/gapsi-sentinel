'use client';

/**
 * Editor documental ESTRUCTURADO por tipo (DOC-001 §9/§21/§34).
 *
 * Guiado por el registro de plantillas: renderiza los campos y bloques
 * repetibles del tipo. Los repetibles permiten agregar, eliminar y reordenar
 * (botones accesibles, sin arrastrar). El contenido es la fuente de verdad; se
 * guarda como JSON y el servidor deriva el HTML.
 */
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getTemplateDefinition,
  type StructuredSectionDef,
} from '@/features/documents/template-registry';
import { STRUCTURED_SCHEMA_VERSION } from '@/features/documents/structured-content';
import { saveStructuredContentAction } from '../editor-actions';

type Item = Record<string, string>;

interface Props {
  documentId: string;
  versionId: string;
  editable: boolean;
  documentType: string;
  code: string;
  title: string;
  label: string;
  initialFields: Record<string, string>;
  initialRepeatables: Record<string, Item[]>;
}

export function StructuredEditor(props: Props) {
  const def = getTemplateDefinition(props.documentType);
  const [fields, setFields] = useState<Record<string, string>>(props.initialFields);
  const [repeatables, setRepeatables] = useState<Record<string, Item[]>>(props.initialRepeatables);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const setField = useCallback((key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setMessage(null);
  }, []);

  const mutateList = useCallback((key: string, fn: (list: Item[]) => Item[]) => {
    setRepeatables((r) => ({ ...r, [key]: fn(r[key] ?? []) }));
    setDirty(true);
    setMessage(null);
  }, []);

  const emptyItem = (section: Extract<StructuredSectionDef, { kind: 'repeatable' }>): Item =>
    Object.fromEntries(section.repeatable.fields.map((f) => [f.key, '']));

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    const payload = {
      schemaVersion: STRUCTURED_SCHEMA_VERSION,
      templateType: props.documentType,
      fields,
      repeatables,
    };
    try {
      const res = await saveStructuredContentAction({
        documentId: props.documentId,
        versionId: props.versionId,
        structuredContent: JSON.stringify(payload),
      });
      setMessage({ ok: res.ok, text: res.message });
      if (res.ok) setDirty(false);
    } catch {
      setMessage({ ok: false, text: 'No se pudo guardar. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  }, [fields, repeatables, props.documentId, props.versionId, props.documentType]);

  const sections = useMemo(() => def?.sections ?? [], [def]);

  if (!def) {
    return <p className="empty-state">Este tipo de documento no tiene editor estructurado.</p>;
  }

  return (
    <div className="struct-editor">
      <div className="struct-editor__bar">
        <div>
          <span className="muted">{props.code}</span> · {props.title}{' '}
          <span className="badge">{props.label}</span>
        </div>
        <div className="struct-editor__bar-actions">
          <Link
            className="button button--ghost"
            href={`/dashboard/documents/${props.documentId}/structured/preview`}
          >
            Vista previa
          </Link>
          {props.editable && (
            <button
              type="button"
              className="button button--primary"
              onClick={save}
              disabled={saving || !dirty}
            >
              {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <p role="status" className={`msg ${message.ok ? 'msg--ok' : 'msg--error'}`}>
          {message.text}
        </p>
      )}
      {!props.editable && (
        <p className="empty-state">
          Esta versión no es editable (no es la vigente en borrador). Se muestra en solo lectura.
        </p>
      )}

      {sections.map((section) => (
        <fieldset key={section.key} className="struct-section" disabled={!props.editable}>
          <legend>{section.title}</legend>
          {section.description && <p className="field__help">{section.description}</p>}

          {section.kind === 'fields'
            ? section.fields.map((f) => (
                <div className="field" key={f.key}>
                  <label className="field__label" htmlFor={`f-${f.key}`}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </label>
                  {f.kind === 'textarea' ? (
                    <textarea
                      id={`f-${f.key}`}
                      rows={3}
                      value={fields[f.key] ?? ''}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength ?? 2000}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={`f-${f.key}`}
                      value={fields[f.key] ?? ''}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength ?? 300}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}
                </div>
              ))
            : (() => {
                const rep = section.repeatable;
                const list = repeatables[rep.key] ?? [];
                return (
                  <div className="struct-repeat">
                    {list.length === 0 && (
                      <p className="empty-state">Sin {rep.label.toLowerCase()} aún.</p>
                    )}
                    {list.map((item, index) => (
                      <div className="struct-repeat__item" key={index}>
                        <div className="struct-repeat__item-head">
                          <strong>
                            {rep.autoNumber ? `${index + 1}. ` : ''}
                            {rep.itemLabel} {rep.autoNumber ? '' : index + 1}
                          </strong>
                          <div className="struct-repeat__item-actions">
                            <button
                              type="button"
                              className="button button--ghost"
                              aria-label={`Subir ${rep.itemLabel} ${index + 1}`}
                              disabled={index === 0}
                              onClick={() =>
                                mutateList(rep.key, (l) => {
                                  const n = [...l];
                                  [n[index - 1], n[index]] = [n[index]!, n[index - 1]!];
                                  return n;
                                })
                              }
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="button button--ghost"
                              aria-label={`Bajar ${rep.itemLabel} ${index + 1}`}
                              disabled={index === list.length - 1}
                              onClick={() =>
                                mutateList(rep.key, (l) => {
                                  const n = [...l];
                                  [n[index], n[index + 1]] = [n[index + 1]!, n[index]!];
                                  return n;
                                })
                              }
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="button button--ghost"
                              aria-label={`Eliminar ${rep.itemLabel} ${index + 1}`}
                              onClick={() =>
                                mutateList(rep.key, (l) => l.filter((_, i) => i !== index))
                              }
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                        {rep.fields.map((f) => (
                          <div className="field" key={f.key}>
                            <label
                              className="field__label"
                              htmlFor={`r-${rep.key}-${index}-${f.key}`}
                            >
                              {f.label}
                              {f.required ? ' *' : ''}
                            </label>
                            {f.kind === 'textarea' ? (
                              <textarea
                                id={`r-${rep.key}-${index}-${f.key}`}
                                rows={2}
                                value={item[f.key] ?? ''}
                                placeholder={f.placeholder}
                                maxLength={f.maxLength ?? 2000}
                                onChange={(e) =>
                                  mutateList(rep.key, (l) =>
                                    l.map((it, i) =>
                                      i === index ? { ...it, [f.key]: e.target.value } : it,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              <input
                                id={`r-${rep.key}-${index}-${f.key}`}
                                value={item[f.key] ?? ''}
                                placeholder={f.placeholder}
                                maxLength={f.maxLength ?? 300}
                                onChange={(e) =>
                                  mutateList(rep.key, (l) =>
                                    l.map((it, i) =>
                                      i === index ? { ...it, [f.key]: e.target.value } : it,
                                    ),
                                  )
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {props.editable && (
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => mutateList(rep.key, (l) => [...l, emptyItem(section)])}
                      >
                        + {rep.addLabel}
                      </button>
                    )}
                  </div>
                );
              })()}
        </fieldset>
      ))}

      {props.editable && (
        <div className="form-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios pendientes'}
          </button>
        </div>
      )}
    </div>
  );
}
