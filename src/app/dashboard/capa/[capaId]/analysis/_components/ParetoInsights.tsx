import type { ParetoInsights as Insights } from '@/features/capa/analysis-state';

/**
 * Tarjeta de interpretación rápida del Pareto. Solo muestra datos YA calculados
 * (`paretoInsights`); no inventa métricas. La página omite esta tarjeta si no hay
 * datos (insights === null).
 */
export function ParetoInsights({ insights }: { insights: Insights }) {
  return (
    <div className="report-card pareto-insights">
      <h2>Interpretación rápida</h2>
      <div className="pareto-insights__grid">
        <div>
          <span className="pareto-insights__val">{insights.total}</span>
          <span className="pareto-insights__lbl">Eventos totales</span>
        </div>
        <div>
          <span className="pareto-insights__val">
            {insights.vitalCount}
            <small> / {insights.categories}</small>
          </span>
          <span className="pareto-insights__lbl">Categorías vitales</span>
        </div>
        <div>
          <span className="pareto-insights__val">{insights.vitalCumulative}%</span>
          <span className="pareto-insights__lbl">Acumulado del grupo vital</span>
        </div>
        <div>
          <span className="pareto-insights__val pareto-insights__val--text">
            {insights.topCategory ?? '—'}
          </span>
          <span className="pareto-insights__lbl">
            Categoría principal ({insights.topPercentage}%)
          </span>
        </div>
      </div>
      <p className="muted">
        {insights.cutoffPosition
          ? `El ${insights.cutoff}% acumulado se alcanza en la categoría #${insights.cutoffPosition}: concentra tus acciones en el grupo vital.`
          : `Aún no se alcanza el ${insights.cutoff}% acumulado.`}
      </p>
    </div>
  );
}
