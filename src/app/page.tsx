import Link from 'next/link';

/**
 * Página pública de inicio. Carga sin autenticación (criterio de aceptación de
 * TASK-001).
 */
export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <p className="muted">GAPSI Sentinel</p>
        <h1>Diagnóstico Digital de calidad e inocuidad alimentaria</h1>
        <p className="lead">
          Convierte un cuestionario estructurado y sus evidencias en una evaluación clara de
          cumplimiento, riesgo y prioridades de acción. Esta es la fundación técnica del MVP; los
          módulos del diagnóstico se construirán en tareas posteriores.
        </p>
        <div>
          <Link className="button" href="/dashboard">
            Entrar al panel
          </Link>
        </div>
      </section>
    </main>
  );
}
