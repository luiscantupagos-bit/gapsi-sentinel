'use client';

/**
 * Editor documental ESTRUCTURADO por tipo (DOC-001 §9/§21/§34, DOC-002).
 *
 * Guiado por el registro de plantillas: renderiza los campos y bloques repetibles
 * del tipo. Los campos `textarea` usan el editor con REFERENCIAS (`@`/`//`); los
 * `text` son texto plano. El contenido es la fuente de verdad; se guarda como
 * JSON y el servidor deriva el HTML y sincroniza las relaciones.
 */
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getTemplateDefinition,
  type StructuredSectionDef,
} from '@/features/documents/template-registry';
import { STRUCTURED_SCHEMA_VERSION } from '@/features/documents/structured-content';
import { richPlainText, type RichValue } from '@/features/documents/references';
import { type ProgramBlock } from '@/features/documents/program-execution';
import { saveStructuredContentAction } from '../editor-actions';
import { ReferenceTextEditor, type ResolvedSnapshot } from './ReferenceTextEditor';
import { IssuedFormDialog } from './IssuedFormDialog';
import { ProgramActivitiesEditor } from './ProgramActivitiesEditor';

type Item = Record<string, RichValue>;

interface Props {
  documentId: string;
  versionId: string;
  editable: boolean;
  documentType: string;
  code: string;
  title: string;
  label: string;
  ownerArea: string | null;
  initialFields: Record<string, RichValue>;
  initialRepeatables: Record<string, Item[]>;
  resolvedReferences: Record<string, ResolvedSnapshot>;
  // DOC-003: bloque ejecutable + miembros (solo Programa).
  initialProgram?: ProgramBlock | null;
  members?: { id: string; name: string }[];
}

const EMPTY_PROGRAM: ProgramBlock = { periodStart: null, periodEnd: null, activities: [] };

const asText = (v: RichValue | undefined): string =>
  v === undefined ? '' : typeof v === 'string' ? v : richPlainText(v);

export function StructuredEditor(props: Props) {
  const def = getTemplateDefinition(props.documentType);
  const [fields, setFields] = useState<Record<string, RichValue>>(props.initialFields);
  const [repeatables, setRepeatables] = useState<Record<string, Item[]>>(props.initialRepeatables);
  const [program, setProgram] = useState<ProgramBlock>(props.initialProgram ?? EMPTY_PROGRAM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Diálogo de emisión de formato (//): guarda el callback que inserta el chip.
  const [issueCb, setIssueCb] = useState<
    ((form: { documentId: string; code: string; title: string }) => void) | null
  >(null);

  const requestIssueForm = useCallback(
    (onCreated: (form: { documentId: string; code: string; title: string }) => void) => {
      setIssueCb(() => onCreated);
    },
    [],
  );

  const setFieldValue = useCallback((key: string, value: RichValue) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setMessage(null);
  }, []);

  const mutateList = useCallback((key: string, fn: (list: Item[]) => Item[]) => {
    setRepeatables((r) => ({ ...r, [key]: fn(r[key] ?? []) }));
    setDirty(true);
    setMessage(null);
  }, []);

  const setItemValue = useCallback(
    (repKey: string, index: number, fieldKey: string, value: RichValue) => {
      mutateList(repKey, (l) =>
        l.map((it, i) => (i === index ? { ...it, [fieldKey]: value } : it)),
      );
    },
    [mutateList],
  );

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
      ...(props.documentType === 'program' ? { program } : {}),
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
  }, [fields, repeatables, program, props.documentId, props.versionId, props.documentType]);

  const sections = useMemo(() => def?.sections ?? [], [def]);

  if (!def) {
    return <p className="empty-state">Este tipo de documento no tiene editor estructurado.</p>;
  }

  const renderField = (
    fieldKey: string,
    kind: string,
    value: RichValue,
    onChange: (v: RichValue) => void,
    domId: string,
    placeholder?: string,
    maxLength?: number,
    rows = 3,
  ) =>
    kind === 'textarea' ? (
      <ReferenceTextEditor
        id={domId}
        value={value}
        editable={props.editable}
        documentId={props.documentId}
        placeholder={placeholder}
        rows={rows}
        resolved={props.resolvedReferences}
        onChange={onChange}
        onRequestIssueForm={requestIssueForm}
      />
    ) : (
      <input
        id={domId}
        value={asText(value)}
        placeholder={placeholder}
        maxLength={maxLength ?? 300}
        onChange={(e) => onChange(e.target.value)}
        disabled={!props.editable}
      />
    );

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
      {props.editable && (
        <p className="field__help">
          Escribe <strong>@</strong> para vincular un documento existente o <strong>{'//'}</strong>{' '}
          para emitir un formato.
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
                  {renderField(
                    f.key,
                    f.kind,
                    fields[f.key] ?? '',
                    (v) => setFieldValue(f.key, v),
                    `f-${f.key}`,
                    f.placeholder,
                    f.maxLength,
                    3,
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
                            {renderField(
                              f.key,
                              f.kind,
                              item[f.key] ?? '',
                              (v) => setItemValue(rep.key, index, f.key, v),
                              `r-${rep.key}-${index}-${f.key}`,
                              f.placeholder,
                              f.maxLength,
                              2,
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

      {props.documentType === 'program' && (
        <ProgramActivitiesEditor
          value={program}
          onChange={(b) => {
            setProgram(b);
            setDirty(true);
            setMessage(null);
          }}
          members={props.members ?? []}
          editable={props.editable}
        />
      )}

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

      <IssuedFormDialog
        open={issueCb !== null}
        sourceDocumentId={props.documentId}
        sourceVersionId={props.versionId}
        sourceCode={props.code}
        sourceTitle={props.title}
        defaultAreaName={props.ownerArea}
        onClose={() => setIssueCb(null)}
        onCreated={(form) => {
          issueCb?.(form);
          setDirty(true);
        }}
      />
    </div>
  );
}
