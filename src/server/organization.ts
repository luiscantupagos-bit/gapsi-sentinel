/**
 * Configuración general del negocio (DOC-UX-003 §12). Perfil de la organización
 * (datos comerciales, fiscales y logotipo) + sitios + miembros. Todo scoped por
 * organización; escrituras del perfil bajo `withOrgContext` (RLS). No renombra la
 * entidad `organizations`; complementa con `organization_profiles`.
 */
import { getPrisma, withOrgContext } from './db';

export interface OrganizationProfile {
  name: string;
  commercialName: string;
  legalName: string;
  taxId: string;
  taxRegime: string;
  taxAddress: string;
  logoUrl: string;
}

const FIELD_MAX = 300;
const ADDRESS_MAX = 500;

function clean(value: FormDataEntryValue | null | undefined, max = FIELD_MAX): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

/** Perfil del negocio de la organización (nombre + datos comerciales/fiscales/logo). */
export async function getOrganizationProfile(organizationId: string): Promise<OrganizationProfile> {
  const prisma = getPrisma();
  const [org, profile] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.organizationProfile.findUnique({ where: { organizationId } }),
  ]);
  return {
    name: org.name,
    commercialName: profile?.commercialName ?? '',
    legalName: profile?.legalName ?? '',
    taxId: profile?.taxId ?? '',
    taxRegime: profile?.taxRegime ?? '',
    taxAddress: profile?.taxAddress ?? '',
    logoUrl: profile?.logoUrl ?? '',
  };
}

export interface OrganizationProfileInput {
  commercialName: string;
  legalName: string;
  taxId: string;
  taxRegime: string;
  taxAddress: string;
  logoUrl: string;
}

/** Guarda el perfil del negocio (upsert por organización). */
export async function setOrganizationProfile(
  organizationId: string,
  userId: string,
  input: OrganizationProfileInput,
): Promise<void> {
  const data = {
    commercialName: input.commercialName.slice(0, FIELD_MAX) || null,
    legalName: input.legalName.slice(0, FIELD_MAX) || null,
    taxId: input.taxId.slice(0, FIELD_MAX) || null,
    taxRegime: input.taxRegime.slice(0, FIELD_MAX) || null,
    taxAddress: input.taxAddress.slice(0, ADDRESS_MAX) || null,
    logoUrl: input.logoUrl.slice(0, FIELD_MAX) || null,
  };
  await withOrgContext(organizationId, async (tx) => {
    await tx.organizationProfile.upsert({
      where: { organizationId },
      update: { ...data, updatedBy: userId },
      create: { organizationId, ...data, updatedBy: userId },
    });
  });
}

/** Sitios de la organización (con dirección y coordenadas, DOC-UX-003). */
export async function listOrganizationSites(organizationId: string) {
  return getPrisma().site.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      location: true,
      address: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { name: 'asc' },
  });
}

/** Miembros de la organización (para la sección de usuarios). */
export async function listOrganizationMembers(organizationId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { organizationId },
    select: { role: true, user: { select: { id: true, displayName: true, email: true } } },
    orderBy: { role: 'asc' },
  });
  return memberships.map((m) => ({
    id: m.user.id,
    name: m.user.displayName ?? m.user.email,
    email: m.user.email,
    role: m.role,
  }));
}

/** Helper para leer el perfil desde un FormData. */
export function profileFromForm(formData: FormData): OrganizationProfileInput {
  return {
    commercialName: clean(formData.get('commercialName')),
    legalName: clean(formData.get('legalName')),
    taxId: clean(formData.get('taxId')),
    taxRegime: clean(formData.get('taxRegime')),
    taxAddress: clean(formData.get('taxAddress'), ADDRESS_MAX),
    logoUrl: clean(formData.get('logoUrl')),
  };
}
