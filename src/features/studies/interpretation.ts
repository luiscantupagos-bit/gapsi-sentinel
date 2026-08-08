// CORE-ALIGN-003 — Interpretación DETERMINISTA de resultados (puro, sin IA).
//
// Cada resultado analítico produce tres niveles: resultado principal (frase muy
// corta), interpretación (explicación sencilla) y siguiente paso (recomendación
// operativa prudente). Nunca afirma causalidad ni inventa significancia/valores-p;
// usa "asociación", "diferencia", "tendencia", "concentración", "requiere
// investigación". No sustituye la conclusión del responsable.

import type { StudyAnalysisResult } from './analysis-adapter';
import { correlationStrength } from '@/features/analytics/statistics';

export interface Interpretation {
  principal: string;
  detail: string;
  nextStep: string;
}

export function interpret(result: StudyAnalysisResult): Interpretation | null {
  switch (result.kind) {
    case 'insufficient':
      return {
        principal: 'Datos insuficientes.',
        detail: result.message,
        nextStep: 'Ajusta la selección o importa más datos.',
      };

    case 'descriptive-numeric': {
      const s = result.stats;
      if (s.mean === null)
        return {
          principal: 'Sin valores numéricos.',
          detail: 'No hay datos suficientes.',
          nextStep: 'Revisa la variable seleccionada.',
        };
      const skew = s.median !== null && Math.abs(s.mean - s.median) > (s.stdDev ?? 0) * 0.5;
      return {
        principal: `Se analizaron ${result.n} mediciones; media ${s.mean}, mediana ${s.median}.`,
        detail: skew
          ? 'La diferencia entre media y mediana sugiere que algunos valores extremos están afectando el promedio.'
          : `Los valores van de ${s.min} a ${s.max}${s.stdDev !== null ? `, con desviación estándar ${s.stdDev}` : ''}.`,
        nextStep: 'Revisa la distribución y los posibles atípicos antes de concluir.',
      };
    }

    case 'descriptive-categorical': {
      const top = result.frequencies[0];
      return {
        principal: `${result.frequencies.length} categorías en ${result.n} registros.`,
        detail: top ? `"${top.label}" es la más frecuente (${top.pct}%).` : 'Sin categorías.',
        nextStep: 'Usa Pareto para priorizar las categorías con mayor peso.',
      };
    }

    case 'pareto': {
      const vital = result.result.rows.filter((r) => r.vitalFew);
      const cum = vital[vital.length - 1]?.cumulativePercentage ?? 0;
      const top = result.result.rows[0];
      return {
        principal: `${vital.length} categoría(s) concentran el ${cum}% (por ${result.weightLabel}).`,
        detail: top
          ? `"${top.category}" representa el ${top.percentage}% del total.`
          : 'Sin datos.',
        nextStep:
          'Prioriza estas categorías para investigación. El Pareto no demuestra la causa raíz.',
      };
    }

    case 'trend': {
      if (result.changePct === null)
        return {
          principal: 'Tendencia sin cambio calculable.',
          detail: 'El primer periodo es cero o falta.',
          nextStep: 'Segmenta por otra variable.',
        };
      const dir =
        result.changePct > 0 ? 'aumentó' : result.changePct < 0 ? 'disminuyó' : 'se mantuvo';
      return {
        principal: `La variable ${dir} ${Math.abs(result.changePct)}% entre el primer y el último periodo.`,
        detail:
          'Los periodos recientes difieren de los iniciales, aunque el comportamiento no es necesariamente constante.',
        nextStep:
          'Segmenta por máquina, turno u otra variable para investigar qué explica el cambio. La tendencia no implica causa.',
      };
    }

    case 'correlation': {
      const p = result.pearson;
      if (!p.ok || p.r === null)
        return {
          principal: 'Sin relación lineal calculable.',
          detail: p.interpretation,
          nextStep: 'Verifica que ambas variables tengan variación y suficientes pares.',
        };
      const dir =
        p.r > 0.05
          ? 'tienden a aumentar juntas'
          : p.r < -0.05
            ? 'una tiende a disminuir cuando la otra aumenta'
            : 'no muestran una relación lineal apreciable';
      return {
        principal: `Correlación ${p.strength ?? correlationStrength(p.r)} (r=${p.r}, n=${p.n}).`,
        detail: `Las variables ${dir}. La correlación describe asociación, no causa.`,
        nextStep:
          'Considera una regresión para cuantificar la relación. Correlación no implica causalidad.',
      };
    }

    case 'regression': {
      const r = result.regression;
      if (!r.ok || r.r2 === null)
        return {
          principal: 'Regresión no calculable.',
          detail: r.interpretation,
          nextStep: 'Revisa que X tenga variación y haya suficientes puntos.',
        };
      const lowFit = r.r2 < 0.3;
      return {
        principal: `y = ${r.intercept} + ${r.slope}·x (R²=${r.r2}, n=${r.n}).`,
        detail: lowFit
          ? `El modelo explica solo ${Math.round(r.r2 * 100)}% de la variación; gran parte no está explicada por X.`
          : `Dentro de estos datos, el modelo explica ${Math.round(r.r2 * 100)}% de la variación.`,
        nextStep: 'Úsalo como descripción, no como prueba de que X provoca Y.',
      };
    }

    case 'group_compare': {
      const withMean = result.groups.filter((g) => g.stats.mean !== null);
      const sorted = [...withMean].sort((a, b) => (b.stats.mean ?? 0) - (a.stats.mean ?? 0));
      const hi = sorted[0];
      const lo = sorted[sorted.length - 1];
      return {
        principal: `${result.groups.length} grupos comparados.`,
        detail:
          hi && lo && hi !== lo
            ? `"${hi.label}" tiene la media más alta (${hi.stats.mean}) y "${lo.label}" la más baja (${lo.stats.mean}).`
            : 'Se muestran los descriptivos por grupo.',
        nextStep:
          'Usa ANOVA para evaluar si las diferencias entre grupos son notables; revisa también las distribuciones.',
      };
    }

    case 'anova': {
      const a = result.anova;
      if (!a.ok || a.fStatistic === null)
        return {
          principal: 'ANOVA no válida.',
          detail: a.interpretation,
          nextStep: 'Se requieren ≥2 grupos con ≥2 observaciones; revisa los descriptivos.',
        };
      return {
        principal: `F = ${a.fStatistic} (gl ${a.dfBetween}, ${a.dfWithin}).`,
        detail:
          'ANOVA compara las medias entre grupos; no identifica automáticamente qué par difiere.',
        nextStep:
          'Compara F contra una tabla F (α=0.05) y revisa descriptivos/distribuciones. Una diferencia no implica causa.',
      };
    }

    case 'chi_square': {
      const c = result.contingency;
      if (!c.ok || c.chiSquare === null)
        return {
          principal: 'Chi-cuadrada no calculable.',
          detail: c.interpretation,
          nextStep: 'Se requieren ≥2 categorías por variable y muestra suficiente.',
        };
      const assoc = c.lowExpectedWarning
        ? 'la prueba pierde validez (frecuencias esperadas < 5)'
        : c.significantAt005
          ? 'existe una asociación notable (α=0.05)'
          : 'no se detecta una asociación notable (α=0.05)';
      return {
        principal: `χ² = ${c.chiSquare}, gl = ${c.degreesOfFreedom}, n = ${c.n}.`,
        detail: `Entre las dos variables ${assoc}. La asociación no implica causalidad.`,
        nextStep: 'Revisa la tabla de contingencia para ver qué categorías contribuyen más.',
      };
    }
  }
}
