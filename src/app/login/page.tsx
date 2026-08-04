import { devSignIn } from '@/features/auth/dev-actions';
import { getServerSession } from '@/server/session';
import { redirect } from 'next/navigation';

/**
 * Pantalla de acceso. En TASK-001 usa el adaptador de desarrollo: un botón que
 * crea una sesión simulada. Se reemplazará por un proveedor real más adelante.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getServerSession();
  const { from } = await searchParams;
  const target = from && from.startsWith('/') ? from : '/dashboard';

  if (session) {
    redirect(target);
  }

  return (
    <main className="container">
      <section className="card" style={{ maxWidth: '28rem', margin: '4rem auto' }}>
        <h1>Iniciar sesión</h1>
        <p className="muted">
          Autenticación de desarrollo. No es un proveedor real; crea una sesión de demostración para
          probar el acceso protegido.
        </p>
        <form action={devSignIn}>
          <input type="hidden" name="from" value={target} />
          <button className="button" type="submit">
            Entrar como usuario de demostración
          </button>
        </form>
      </section>
    </main>
  );
}
