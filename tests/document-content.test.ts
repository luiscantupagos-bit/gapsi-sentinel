import { describe, expect, it } from 'vitest';
import {
  contentByteSize,
  contentChecksum,
  renderContentHtml,
  sanitizeContent,
  type DocNode,
} from '@/features/documents/content-schema';
import { getTemplate, sanitizePageConfig } from '@/features/documents/templates';

const wrap = (content: DocNode[]): DocNode => ({ type: 'doc', content });

describe('sanitizeContent', () => {
  it('descarta nodos y marcas desconocidos', () => {
    const dirty = wrap([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'hola', marks: [{ type: 'bold' }, { type: 'evil' }] }],
      },
      { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] } as DocNode,
      { type: 'iframe' } as DocNode,
    ]);
    const clean = sanitizeContent(dirty);
    expect(clean.content).toHaveLength(1);
    expect(clean.content?.[0]?.type).toBe('paragraph');
    expect(clean.content?.[0]?.content?.[0]?.marks).toEqual([{ type: 'bold' }]);
  });

  it('rechaza enlaces javascript: y conserva https', () => {
    const clean = sanitizeContent(
      wrap([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            {
              type: 'text',
              text: 'y',
              marks: [{ type: 'link', attrs: { href: 'https://ok.test' } }],
            },
          ],
        },
      ]),
    );
    const marks = clean.content?.[0]?.content?.map((n) => n.marks);
    expect(marks?.[0]).toEqual([]); // javascript: eliminado
    expect(marks?.[1]?.[0]?.type).toBe('link');
  });

  it('rechaza imágenes externas y acepta rutas internas', () => {
    const external = sanitizeContent(
      wrap([{ type: 'image', attrs: { src: 'http://evil.test/x.png' } }]),
    );
    expect(JSON.stringify(external)).not.toContain('image');
    const internal = sanitizeContent(
      wrap([
        {
          type: 'image',
          attrs: { src: '/dashboard/documents/abc/files/def', alt: 'foto', width: 50 },
        },
      ]),
    );
    expect(internal.content?.[0]?.type).toBe('image');
    expect(internal.content?.[0]?.attrs?.src).toBe('/dashboard/documents/abc/files/def');
  });

  it('sanea textStyle: descarta fuente/color no permitidos', () => {
    const clean = sanitizeContent(
      wrap([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [
                {
                  type: 'textStyle',
                  attrs: { fontFamily: 'EvilFont', color: 'red; url(x)', fontSize: '99pt' },
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(clean.content?.[0]?.content?.[0]?.marks).toEqual([]);
  });
});

describe('renderContentHtml', () => {
  it('escapa texto y no produce <script>', () => {
    const html = renderContentHtml(
      sanitizeContent(
        wrap([
          { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
        ]),
      ),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('aplica marcas seguras y rel=noopener en enlaces', () => {
    const html = renderContentHtml(
      sanitizeContent(
        wrap([
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
              {
                type: 'text',
                text: 'b',
                marks: [{ type: 'link', attrs: { href: 'https://ok.test' } }],
              },
            ],
          },
        ]),
      ),
    );
    expect(html).toContain('<strong>a</strong>');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe('tamaño y checksum', () => {
  it('checksum determinista y tamaño positivo', () => {
    const doc = sanitizeContent(
      wrap([{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }]),
    );
    expect(contentByteSize(doc)).toBeGreaterThan(0);
    expect(contentChecksum(doc)).toBe(contentChecksum(doc));
    expect(contentChecksum(doc)).toHaveLength(64);
  });
});

describe('plantillas y page config', () => {
  it('la plantilla de procedimiento genera secciones editables', () => {
    const doc = sanitizeContent(getTemplate('procedure')!.build());
    const text = JSON.stringify(doc);
    expect(text).toContain('Objetivo');
    expect(text).toContain('Control de cambios');
    expect(doc.content!.length).toBeGreaterThan(3);
  });

  it('sanitizePageConfig normaliza valores inválidos', () => {
    const cfg = sanitizePageConfig({ header: { style: 'loco' }, margins: { top: 999, left: -5 } });
    expect(cfg.header.style).toBe('simple');
    expect(cfg.margins.top).toBe(60);
    expect(cfg.margins.left).toBe(5);
  });
});
