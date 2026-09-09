'use client';

/**
 * Editor de texto con REFERENCIAS inteligentes (DOC-002 §8/§10/§33/§34/§35).
 *
 * `contenteditable` que mezcla texto y "chips" de referencia (no editables). Al
 * escribir `@` abre un autocompletado de documentos; al escribir `//` solicita al
 * padre emitir un formato. La fuente de verdad del chip es `targetDocumentId`;
 * `code`/`title` son solo snapshot visual. El valor emitido es un `RichValue`.
 *
 * Accesible: el listado de `@` es un `listbox` navegable por teclado
 * (Arriba/Abajo/Enter/Escape) con `aria-activedescendant`.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { RichValue, Segment, RefSegment } from '@/features/documents/references';
import { detectMentionQuery, detectFormCommand } from '@/features/documents/reference-commands';
import { searchMentionsAction } from '../reference-actions';
import type { MentionResult } from '@/server/documents';

export interface ResolvedSnapshot {
  code?: string;
  title?: string;
  available?: boolean;
  obsolete?: boolean;
}

interface Props {
  id?: string;
  value: RichValue;
  editable: boolean;
  documentId: string;
  placeholder?: string;
  rows?: number;
  resolved: Record<string, ResolvedSnapshot>;
  onChange: (value: RichValue) => void;
  /** Solicita al padre abrir el diálogo de emisión de formato. */
  onRequestIssueForm: (
    onCreated: (form: { documentId: string; code: string; title: string }) => void,
  ) => void;
}

// --- DOM ⇄ segmentos ---------------------------------------------------------

function chipLabel(seg: RefSegment, resolved: Record<string, ResolvedSnapshot>): string {
  const r = resolved[seg.targetDocumentId];
  const code = r?.code || seg.code || 'Documento';
  const title = r?.title || seg.title || '';
  return title ? `${code} — ${title}` : code;
}

function makeChip(
  doc: HTMLDocument,
  seg: RefSegment,
  resolved: Record<string, ResolvedSnapshot>,
): HTMLSpanElement {
  const span = doc.createElement('span');
  span.className = 'ref-chip' + (seg.relationType === 'issued_form' ? ' ref-chip--form' : '');
  span.setAttribute('contenteditable', 'false');
  span.dataset.target = seg.targetDocumentId;
  span.dataset.reltype = seg.relationType;
  if (seg.code) span.dataset.code = seg.code;
  if (seg.title) span.dataset.title = seg.title;
  span.textContent = (seg.relationType === 'issued_form' ? '// ' : '@ ') + chipLabel(seg, resolved);
  return span;
}

/** Construye el HTML inicial del editor desde un RichValue. */
function renderInitial(
  el: HTMLElement,
  value: RichValue,
  resolved: Record<string, ResolvedSnapshot>,
): void {
  el.textContent = '';
  const segments: Segment[] =
    typeof value === 'string' ? [{ type: 'text', text: value }] : value.segments;
  for (const seg of segments) {
    if (seg.type === 'text') {
      // Divide por saltos de línea insertando <br>.
      const parts = seg.text.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) el.appendChild(el.ownerDocument.createElement('br'));
        if (part) el.appendChild(el.ownerDocument.createTextNode(part));
      });
    } else {
      el.appendChild(makeChip(el.ownerDocument, seg, resolved));
      el.appendChild(el.ownerDocument.createTextNode(' '));
    }
  }
}

/** Serializa el contenido del editor a un RichValue normalizado. */
function serialize(el: HTMLElement): RichValue {
  const segs: Segment[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = segs[segs.length - 1];
    if (last && last.type === 'text') last.text += t;
    else segs.push({ type: 'text', text: t });
  };
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        pushText((child.textContent ?? '').replace(/ /g, ' '));
      } else if (child instanceof HTMLElement) {
        if (child.classList.contains('ref-chip')) {
          const target = child.dataset.target;
          const reltype = child.dataset.reltype;
          if (target && (reltype === 'reference' || reltype === 'issued_form')) {
            const seg: RefSegment = {
              type: 'ref',
              relationType: reltype,
              targetDocumentId: target,
            };
            if (child.dataset.code) seg.code = child.dataset.code;
            if (child.dataset.title) seg.title = child.dataset.title;
            segs.push(seg);
          }
        } else if (child.tagName === 'BR') {
          pushText('\n');
        } else {
          // Bloque inesperado (p. ej. <div> por Enter): salto + contenido.
          pushText('\n');
          walk(child);
        }
      }
    });
  };
  walk(el);
  // Normaliza: sin referencias → string plano.
  const merged = segs.filter((s) => s.type !== 'text' || s.text !== '');
  if (!merged.some((s) => s.type === 'ref')) {
    return merged.map((s) => (s as { text: string }).text).join('');
  }
  return { segments: merged };
}

// --- Componente --------------------------------------------------------------

interface MentionState {
  query: string;
  results: MentionResult[];
  active: number;
  loading: boolean;
}

export function ReferenceTextEditor(props: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [mention, setMention] = useState<MentionState | null>(null);
  const resolvedRef = useRef(props.resolved);
  resolvedRef.current = props.resolved;
  const searchSeq = useRef(0);
  // Caret guardado al escribir `//` para restaurarlo tras cerrar el diálogo.
  const savedRange = useRef<Range | null>(null);
  const insertChipRef = useRef<(seg: RefSegment, range?: Range | null) => void>(() => {});

  // Render inicial una sola vez (no controlado: preserva el caret).
  useEffect(() => {
    if (ref.current) renderInitial(ref.current, props.value, props.resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    if (ref.current) props.onChange(serialize(ref.current));
  }, [props]);

  const closeMention = useCallback(() => setMention(null), []);

  const runSearch = useCallback(
    async (query: string) => {
      const seq = ++searchSeq.current;
      setMention((m) => ({ query, results: m?.results ?? [], active: 0, loading: true }));
      try {
        const results = await searchMentionsAction({ query, excludeDocumentId: props.documentId });
        if (seq === searchSeq.current) {
          setMention({ query, results, active: 0, loading: false });
        }
      } catch {
        if (seq === searchSeq.current)
          setMention({ query, results: [], active: 0, loading: false });
      }
    },
    [props.documentId],
  );

  /** Detecta `@`/`//` inmediatamente antes del caret. */
  const detectTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !ref.current.contains(node)) {
      closeMention();
      return;
    }
    const before = (node.textContent ?? '').slice(0, range.startOffset);

    // // → emitir formato (evita URLs `://`).
    if (detectFormCommand(before)) {
      // Elimina los dos últimos caracteres `//`.
      const textNode = node as Text;
      textNode.deleteData(range.startOffset - 2, 2);
      closeMention();
      emit();
      // Guarda el caret; el chip se inserta al confirmar el diálogo.
      const saved = window.getSelection();
      savedRange.current = saved && saved.rangeCount > 0 ? saved.getRangeAt(0).cloneRange() : null;
      props.onRequestIssueForm((form) =>
        insertChipRef.current(
          {
            type: 'ref',
            relationType: 'issued_form',
            targetDocumentId: form.documentId,
            code: form.code,
            title: form.title,
          },
          savedRange.current,
        ),
      );
      return;
    }

    // @query → autocompletar (solo tras inicio o separador; evita emails).
    const query = detectMentionQuery(before);
    if (query !== null) {
      void runSearch(query);
    } else {
      closeMention();
    }
  }, [closeMention, emit, props, runSearch]);

  /** Inserta un chip reemplazando el disparador `@query` (o en el caret para //). */
  const insertChip = useCallback(
    (seg: RefSegment, restore?: Range | null) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (restore) {
        sel.removeAllRanges();
        sel.addRange(restore);
      }
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE && el.contains(node)) {
        const textNode = node as Text;
        const before = (textNode.textContent ?? '').slice(0, range.startOffset);
        const at = before.match(/@[\p{L}\p{N}._/\-]{0,40}$/u);
        if (at) textNode.deleteData(range.startOffset - at[0].length, at[0].length);
      }
      const chip = makeChip(el.ownerDocument as HTMLDocument, seg, resolvedRef.current);
      const space = el.ownerDocument.createTextNode(' ');
      range.insertNode(space);
      range.insertNode(chip);
      // Caret después del espacio.
      const after = el.ownerDocument.createRange();
      after.setStartAfter(space);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      closeMention();
      emit();
    },
    [closeMention, emit],
  );
  insertChipRef.current = insertChip;

  const chooseMention = useCallback(
    (r: MentionResult) => {
      insertChip({
        type: 'ref',
        relationType: 'reference',
        targetDocumentId: r.id,
        code: r.code,
        title: r.title,
      });
    },
    [insertChip],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mention) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMention((m) => (m ? { ...m, active: Math.min(m.active + 1, m.results.length - 1) } : m));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMention((m) => (m ? { ...m, active: Math.max(m.active - 1, 0) } : m));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (mention.results.length > 0) {
          e.preventDefault();
          chooseMention(mention.results[mention.active] ?? mention.results[0]!);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }
    // Enter inserta salto de línea explícito (evita <div> del navegador).
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const br = ref.current!.ownerDocument.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        emit();
      }
    }
  };

  const activeId =
    mention && mention.results.length > 0 ? `${listId}-${mention.active}` : undefined;

  return (
    <div className="ref-editor">
      <div
        id={props.id}
        ref={ref}
        className="ref-editor__input"
        contentEditable={props.editable}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={props.placeholder}
        aria-autocomplete="list"
        aria-controls={mention ? listId : undefined}
        aria-activedescendant={activeId}
        data-placeholder={props.placeholder}
        style={{ minHeight: `${(props.rows ?? 3) * 1.6}em` }}
        onInput={() => {
          emit();
          detectTrigger();
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(closeMention, 150)}
      />
      {mention && (
        <ul className="ref-autocomplete" role="listbox" id={listId} aria-label="Documentos">
          {mention.loading && mention.results.length === 0 && (
            <li className="ref-autocomplete__empty">Buscando…</li>
          )}
          {!mention.loading && mention.results.length === 0 && (
            <li className="ref-autocomplete__empty">Sin resultados</li>
          )}
          {mention.results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === mention.active}
              className={`ref-autocomplete__item${i === mention.active ? ' is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseMention(r);
              }}
            >
              <span className="ref-autocomplete__code">{r.code}</span>
              <span className="ref-autocomplete__title">{r.title}</span>
              <span className="ref-autocomplete__meta">
                {r.typeLabel}
                {r.area ? ` · ${r.area}` : ''}
                {r.version ? ` · ${r.version}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
