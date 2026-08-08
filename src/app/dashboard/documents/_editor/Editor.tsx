'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EditorContent, useEditor } from '@tiptap/react';
import { buildExtensions } from './extensions';
import { EDITOR_FONTS, EDITOR_FONT_SIZES, EDITOR_COLORS } from '@/features/documents/editor-config';
import type { PageConfig } from '@/features/documents/templates';
import { createEditorVersionAction, saveContentAction, uploadImageAction } from '../editor-actions';

interface EditorProps {
  documentId: string;
  documentCode: string;
  documentTitle: string;
  versionId: string;
  label: string;
  editable: boolean;
  content: unknown;
  pageConfig: PageConfig;
  versions: { id: string; label: string; status: string; isCurrent: boolean }[];
}

const AUTOSAVE_MS = 4000;

export function DocumentEditor(props: EditorProps) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageConfig, setPageConfig] = useState<PageConfig>(props.pageConfig);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: buildExtensions(),
    content: props.content as object,
    editable: props.editable,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
  });

  const doSave = useCallback(
    async (recordHistory: boolean) => {
      if (!editor) return;
      setSaving(true);
      setMessage(null);
      const result = await saveContentAction({
        documentId: props.documentId,
        versionId: props.versionId,
        contentJson: JSON.stringify(editor.getJSON()),
        pageConfig: JSON.stringify(pageConfig),
        recordHistory,
      });
      setSaving(false);
      if (result.ok) {
        setDirty(false);
        setSavedAt(result.savedAt ?? new Date().toISOString());
      } else {
        setMessage(result.message);
      }
    },
    [editor, pageConfig, props.documentId, props.versionId],
  );

  // Autoguardado con retardo.
  useEffect(() => {
    if (!dirty || !props.editable) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(false), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, doSave, props.editable]);

  // Prevención de pérdida al salir.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const onPickImage = () => fileRef.current?.click();
  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    const fd = new FormData();
    fd.set('documentId', props.documentId);
    fd.set('versionId', props.versionId);
    fd.set('image', file);
    const result = await uploadImageAction(fd);
    if (result.ok && result.url) {
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
      setDirty(true);
    } else {
      setMessage(result.message);
    }
  };

  const onCreateVersion = async () => {
    const major = window.confirm(
      '¿Es un CAMBIO MAYOR? Aceptar = mayor (p. ej. 1.0 → 2.0). Cancelar = menor (1.0 → 1.1).',
    );
    const reason = window.prompt('Motivo del cambio:');
    if (!reason) return;
    if (dirty) await doSave(true);
    const result = await createEditorVersionAction({
      documentId: props.documentId,
      bump: major ? 'major' : 'minor',
      changeNotes: reason,
    });
    if (result.ok && result.versionId) {
      window.location.href = `/dashboard/documents/${props.documentId}/editor?version=${result.versionId}`;
    } else {
      setMessage(result.message);
    }
  };

  if (!editor) return <p className="muted">Cargando editor…</p>;

  const setFontSize = (size: string) => {
    if (size) editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
  };

  const btn = (active: boolean, onClick: () => void, label: string, title?: string) => (
    <button
      type="button"
      className={`tb-btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title ?? label}
      aria-pressed={active}
    >
      {label}
    </button>
  );

  return (
    <div className="editor">
      <div className="editor__bar">
        <Link href={`/dashboard/documents/${props.documentId}`} className="button button--ghost">
          ← Volver al documento
        </Link>
        <span className="editor__meta">
          <strong>{props.documentCode}</strong> · {props.documentTitle} · {props.label}
        </span>
        <span className="editor__status" role="status">
          {saving
            ? 'Guardando…'
            : dirty
              ? 'Cambios sin guardar'
              : savedAt
                ? `Guardado ${new Date(savedAt).toLocaleTimeString('es-MX')}`
                : 'Sin cambios'}
        </span>
        {props.editable && (
          <>
            <button type="button" className="button button--primary" onClick={() => doSave(true)}>
              Guardar
            </button>
            <button type="button" className="button button--ghost" onClick={onCreateVersion}>
              Crear nueva versión
            </button>
          </>
        )}
        <Link
          href={`/dashboard/documents/${props.documentId}/preview?version=${props.versionId}`}
          className="button button--ghost"
        >
          Vista previa
        </Link>
      </div>

      {message && (
        <p role="alert" className="msg msg--error">
          {message}
        </p>
      )}

      {!props.editable && (
        <p className="msg msg--info" role="status">
          Esta versión no es editable (solo lectura). Crea una nueva versión borrador para editar.
        </p>
      )}

      {props.editable && (
        <div className="toolbar" role="toolbar" aria-label="Formato">
          {btn(
            editor.isActive('bold'),
            () => editor.chain().focus().toggleBold().run(),
            'N',
            'Negrita',
          )}
          {btn(
            editor.isActive('italic'),
            () => editor.chain().focus().toggleItalic().run(),
            'C',
            'Cursiva',
          )}
          {btn(
            editor.isActive('underline'),
            () => editor.chain().focus().toggleUnderline().run(),
            'S',
            'Subrayado',
          )}
          {btn(
            editor.isActive('strike'),
            () => editor.chain().focus().toggleStrike().run(),
            'T',
            'Tachado',
          )}
          <span className="tb-sep" />
          {btn(
            editor.isActive('heading', { level: 1 }),
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            'H1',
          )}
          {btn(
            editor.isActive('heading', { level: 2 }),
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            'H2',
          )}
          {btn(
            editor.isActive('heading', { level: 3 }),
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            'H3',
          )}
          {btn(
            editor.isActive('paragraph'),
            () => editor.chain().focus().setParagraph().run(),
            '¶',
            'Texto normal',
          )}
          <span className="tb-sep" />
          <select
            aria-label="Fuente"
            className="tb-select"
            onChange={(e) =>
              e.target.value && editor.chain().focus().setFontFamily(e.target.value).run()
            }
            defaultValue=""
          >
            <option value="">Fuente</option>
            {EDITOR_FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Tamaño"
            className="tb-select"
            onChange={(e) => setFontSize(e.target.value)}
            defaultValue=""
          >
            <option value="">Tamaño</option>
            {EDITOR_FONT_SIZES.map((s) => (
              <option key={s} value={`${s}pt`}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="color"
            aria-label="Color de texto"
            className="tb-color"
            list="editor-colors"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
          <datalist id="editor-colors">
            {EDITOR_COLORS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {btn(
            editor.isActive('highlight'),
            () => editor.chain().focus().toggleHighlight({ color: '#fff3b0' }).run(),
            'R',
            'Resaltar',
          )}
          <span className="tb-sep" />
          {btn(
            editor.isActive({ textAlign: 'left' }),
            () => editor.chain().focus().setTextAlign('left').run(),
            '⯇',
            'Izquierda',
          )}
          {btn(
            editor.isActive({ textAlign: 'center' }),
            () => editor.chain().focus().setTextAlign('center').run(),
            '≡',
            'Centro',
          )}
          {btn(
            editor.isActive({ textAlign: 'right' }),
            () => editor.chain().focus().setTextAlign('right').run(),
            '⯈',
            'Derecha',
          )}
          {btn(
            editor.isActive({ textAlign: 'justify' }),
            () => editor.chain().focus().setTextAlign('justify').run(),
            '☰',
            'Justificar',
          )}
          <span className="tb-sep" />
          {btn(
            editor.isActive('bulletList'),
            () => editor.chain().focus().toggleBulletList().run(),
            '•',
            'Viñetas',
          )}
          {btn(
            editor.isActive('orderedList'),
            () => editor.chain().focus().toggleOrderedList().run(),
            '1.',
            'Numerada',
          )}
          {btn(
            false,
            () => editor.chain().focus().sinkListItem('listItem').run(),
            '→',
            'Aumentar sangría',
          )}
          {btn(
            false,
            () => editor.chain().focus().liftListItem('listItem').run(),
            '←',
            'Reducir sangría',
          )}
          <span className="tb-sep" />
          {btn(
            editor.isActive('blockquote'),
            () => editor.chain().focus().toggleBlockquote().run(),
            '“”',
            'Cita',
          )}
          {btn(
            false,
            () => {
              const url = window.prompt('URL del enlace (https://…):');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            },
            '🔗',
            'Enlace',
          )}
          {btn(false, () => editor.chain().focus().unsetLink().run(), '⛔🔗', 'Quitar enlace')}
          {btn(false, () => editor.chain().focus().setHorizontalRule().run(), '―', 'Separador')}
          {btn(
            false,
            () => editor.chain().focus().insertContent({ type: 'pageBreak' }).run(),
            '⤓',
            'Salto de página',
          )}
          <span className="tb-sep" />
          {btn(
            false,
            () =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            '▦',
            'Insertar tabla',
          )}
          {btn(false, () => editor.chain().focus().addRowAfter().run(), '+F', 'Agregar fila')}
          {btn(false, () => editor.chain().focus().deleteRow().run(), '-F', 'Eliminar fila')}
          {btn(false, () => editor.chain().focus().addColumnAfter().run(), '+C', 'Agregar columna')}
          {btn(false, () => editor.chain().focus().deleteColumn().run(), '-C', 'Eliminar columna')}
          {btn(
            false,
            () => editor.chain().focus().mergeOrSplit().run(),
            '⊞',
            'Combinar/dividir celda',
          )}
          {btn(false, () => editor.chain().focus().deleteTable().run(), '⌫▦', 'Eliminar tabla')}
          <span className="tb-sep" />
          {btn(false, onPickImage, '🖼', 'Insertar imagen')}
          {btn(
            false,
            () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
            '✗',
            'Limpiar formato',
          )}
          {btn(false, () => editor.chain().focus().undo().run(), '↶', 'Deshacer')}
          {btn(false, () => editor.chain().focus().redo().run(), '↷', 'Rehacer')}
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg"
            hidden
            onChange={onImageChosen}
          />
        </div>
      )}

      {props.editable && (
        <details className="props-panel">
          <summary>Propiedades de página (encabezado, pie, portada)</summary>
          <div className="props-grid">
            <label>
              Encabezado
              <select
                value={pageConfig.header.style}
                onChange={(e) => {
                  setPageConfig({
                    ...pageConfig,
                    header: {
                      ...pageConfig.header,
                      style: e.target.value as PageConfig['header']['style'],
                    },
                  });
                  setDirty(true);
                }}
              >
                <option value="simple">Simple</option>
                <option value="tabular">Tabular</option>
                <option value="none">Sin encabezado</option>
              </select>
            </label>
            <label>
              Nombre de la empresa
              <input
                value={pageConfig.header.companyName}
                onChange={(e) => {
                  setPageConfig({
                    ...pageConfig,
                    header: { ...pageConfig.header, companyName: e.target.value },
                  });
                  setDirty(true);
                }}
              />
            </label>
            <label className="props-check">
              <input
                type="checkbox"
                checked={pageConfig.cover.enabled}
                onChange={(e) => {
                  setPageConfig({ ...pageConfig, cover: { enabled: e.target.checked } });
                  setDirty(true);
                }}
              />
              Portada
            </label>
            <label>
              Leyenda de confidencialidad (pie)
              <input
                value={pageConfig.footer.confidentiality}
                onChange={(e) => {
                  setPageConfig({
                    ...pageConfig,
                    footer: { ...pageConfig.footer, confidentiality: e.target.value },
                  });
                  setDirty(true);
                }}
              />
            </label>
          </div>
        </details>
      )}

      <div className="sheet">
        <EditorContent editor={editor} className="sheet__content" />
      </div>
    </div>
  );
}
