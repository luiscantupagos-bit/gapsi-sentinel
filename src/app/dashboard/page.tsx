import { requireServerSession } from '@/server/session';

/**
 * Panel privado. Solo accesible con sesión válida. En TASK-001 muestra un
 * estado vacío: los módulos de diagnóstico llegarán en tareas posteriores.
 */
export default async function DashboardPage() {
  const session = await requireServerSession();

  return (
    <main className="container">
      <h1>Panel</h1>
      <p className="lead">
        Bienvenido. Esta es la base del área privada de GAPSI Sentinel para la organización{' '}
        <strong>{session.organizationId}</strong>.
      </p>

      <div className="empty-state" role="status">
        <p>Aún no hay diagnósticos.</p>
        <p className="muted">
          La creación de diagnósticos y el cuestionario se implementarán en tareas posteriores
          (fuera del alcance de TASK-001).
        </p>
      </div>
    </main>
  );
}
