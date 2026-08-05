'use client';

import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

/** Añade el atributo `fontSize` a la marca textStyle (tamaños controlados). */
export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size:${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

/** Salto de página visual. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'hr.page-break' }];
  },
  renderHTML() {
    return ['hr', { class: 'page-break', 'data-page-break': 'true' }];
  },
});

export function buildExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false }),
    Underline,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    PageBreak,
  ];
}
