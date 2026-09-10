import Link from 'next/link';
import { requireServerSession } from '@/server/session';
import {
  getOrganizationProfile,
  listOrganizationSites,
  listOrganizationMembers,
} from '@/server/organization';
import { getOrganizationCompliancePolicy } from '@/server/compliance';
import { OrganizationProfileForm } from './_components/OrganizationProfileForm';
import { ComplianceThresholdsForm } from './_components/ComplianceThresholdsForm';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  evaluator: 'Evaluador',
  member: 'Miembro',
};

/**
 * Configuración general del negocio (DOC-UX-003 §12). Punto único para capturar
 * los datos de la organización usados por el sistema y la documentación.
 */
export default async function GeneralSettingsPage() {
  const session = await requireServerSession();
  const [profile, sites, members, compliancePolicy] = await Promise.all([
    getOrganizationProfile(session.organizationId),
    listOrganizationSites(session.organizationId),
    listOrganizationMembers(session.organizationId),
    getOrganizationCompliancePolicy(session.organizationId),
  ]);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>Configuración general</h1>
          <p className="muted page-head__sub">
            Datos del negocio, sitios, información fiscal, logotipo y usuarios de{' '}
            <strong>{profile.name}</strong>.
          </p>
        </div>
        <Link className="button button--ghost" href="/dashboard/documents/settings">
          Configuración documental
        </Link>
      </div>

      <OrganizationProfileForm
        initial={{
          commercialName: profile.commercialName,
          legalName: profile.legalName,
          taxId: profile.taxId,
          taxRegime: profile.taxRegime,
          taxAddress: profile.taxAddress,
          logoUrl: profile.logoUrl,
        }}
      />

      <h2>Semáforo de cumplimiento</h2>
      <ComplianceThresholdsForm initial={compliancePolicy} />

      <h2>Sitios</h2>
      {sites.length === 0 ? (
        <p className="empty-state">No hay sitios registrados.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sitio</th>
                <th>Ubicación</th>
                <th>Dirección</th>
                <th>Coordenadas</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.location ?? '—'}</td>
                  <td>{s.address ?? '—'}</td>
                  <td>
                    {s.latitude != null && s.longitude != null
                      ? `${s.latitude}, ${s.longitude}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        La edición de sitios (dirección y coordenadas) se administra desde el módulo de sitios; la
        estructura de datos ya está preparada.
      </p>

      <h2>Usuarios</h2>
      {members.length === 0 ? (
        <p className="empty-state">Sin usuarios.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{ROLE_LABEL[m.role] ?? m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        La gestión completa de altas/bajas y permisos se habilitará con el módulo de usuarios
        (autenticación productiva pendiente).
      </p>
    </main>
  );
}
