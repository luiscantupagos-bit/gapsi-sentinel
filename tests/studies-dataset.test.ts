import { describe, expect, it } from 'vitest';
import {
  classifyColumn,
  detectDelimiter,
  parseCsv,
  parseDelimited,
  parseTsv,
  toDateISO,
  toDataset,
  toNumber,
} from '@/features/studies/dataset';
import {
  deviationPercentFormula,
  evalFormula,
  validateFormula,
  binaryFormula,
} from '@/features/studies/formula';
import { analyzeDatasetQuality } from '@/features/studies/data-quality';

describe('parseDelimited', () => {
  it('parsea CSV con comillas, comas internas y comillas escapadas', () => {
    const text = 'a,b,c\n1,"x,y",3\n2,"di ""hola""",4';
    const m = parseDelimited(text, ',');
    expect(m).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x,y', '3'],
      ['2', 'di "hola"', '4'],
    ]);
  });
  it('ignora filas vacías', () => {
    expect(parseDelimited('a,b\n\n1,2\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('detectDelimiter', () => {
  it('detecta ; y tab', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('a,b,c')).toBe(',');
  });
});

describe('toDataset / parseCsv / parseTsv', () => {
  it('primera fila como encabezado y normaliza ancho', () => {
    const ds = toDataset([['x', 'y'], ['1', '2', 'extra'], ['3']]);
    expect(ds.headers).toEqual(['x', 'y']);
    expect(ds.rows).toEqual([
      ['1', '2'],
      ['3', ''],
    ]);
  });
  it('parseCsv autodetecta y parseTsv usa tab', () => {
    expect(parseCsv('a;b\n1;2').headers).toEqual(['a', 'b']);
    expect(parseTsv('a\tb\n1\t2').rows).toEqual([['1', '2']]);
  });
});

describe('coerción', () => {
  it('toNumber', () => {
    expect(toNumber('3.5')).toBe(3.5);
    expect(toNumber('1,200')).toBe(1200);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('')).toBeNull();
  });
  it('toDateISO', () => {
    expect(toDateISO('2026-03-10')).toBe('2026-03-10');
    expect(toDateISO('15/03/2026')).toBe('2026-03-15');
    expect(toDateISO('no')).toBeNull();
  });
});

describe('classifyColumn', () => {
  it('numérica / categórica / temporal / texto', () => {
    expect(classifyColumn(['1', '2', '3', '4'])).toBe('numeric');
    expect(classifyColumn(['A', 'B', 'A', 'B', 'A'])).toBe('categorical');
    expect(classifyColumn(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe('temporal');
    expect(
      classifyColumn(['comentario largo uno', 'otro distinto', 'texto libre', 'más texto']),
    ).toBe('text');
  });
});

describe('formula (variables calculadas)', () => {
  it('Desviación % = ((real - nominal)/nominal)*100', () => {
    const f = deviationPercentFormula('real', 'nominal');
    expect(evalFormula(f, { real: 11, nominal: 10 }).value).toBeCloseTo(10, 5);
    expect(evalFormula(f, { real: 9, nominal: 10 }).value).toBeCloseTo(-10, 5);
  });
  it('división entre cero → null + marca', () => {
    const f = deviationPercentFormula('real', 'nominal');
    const r = evalFormula(f, { real: 5, nominal: 0 });
    expect(r.value).toBeNull();
    expect(r.divisionByZero).toBe(true);
  });
  it('operando nulo propaga null', () => {
    const f = binaryFormula('+', { column: 'a' }, { column: 'b' });
    expect(evalFormula(f, { a: 1, b: null }).value).toBeNull();
  });
  it('validateFormula detecta columnas desconocidas', () => {
    const f = binaryFormula('-', { column: 'x' }, { column: 'y' });
    expect(validateFormula(f, new Set(['x']))).toHaveLength(1);
    expect(validateFormula(f, new Set(['x', 'y']))).toHaveLength(0);
  });
});

describe('analyzeDatasetQuality', () => {
  it('reporta faltantes, duplicados, no numéricos y atípicos', () => {
    const report = analyzeDatasetQuality({
      columns: [
        { key: 'turno', label: 'Turno', type: 'categorical' },
        { key: 'medida', label: 'Medida', type: 'numeric' },
      ],
      rows: [
        ['A', '10'],
        ['A', '10'], // duplicado
        ['B', ''], // faltante
        ['B', 'abc'], // no numérico
        ['A', '11'],
        ['A', '9'],
        ['A', '10'],
        ['A', '500'], // atípico
      ],
    });
    expect(report.rowCount).toBe(8);
    expect(report.duplicateRows).toBe(2); // "A,10" aparece 3 veces (filas 0,1,6)
    const medida = report.columns.find((c) => c.key === 'medida')!;
    expect(medida.missing).toBe(1);
    expect(medida.nonNumeric).toBe(1);
    expect(medida.outliers).toBeGreaterThanOrEqual(1);
  });
});
