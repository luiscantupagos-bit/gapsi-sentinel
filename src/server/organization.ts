/**
 * Configuración general del negocio (DOC-UX-003 §12). Perfil de la organización
 * (datos comerciales, fiscales y logotipo) + sitios + miembros. Todo scoped por
 * organización; escrituras del perfil bajo `withOrgContext` (RLS). No renombra la
 * entidad `organizations`; complementa con `organization_profiles`.
 */
import { getPrisma, withOrgContext } from './db';
import { uploadFile, unlinkAndCleanup, FileValidationError, type StoredFileMeta } from './files';

export interface OrganizationProfile {
  name: string;
  commercialName: string;
  legalName: string;
  taxId: string;
  taxRegime: string;
  taxAddress: string;
  logoUrl: string;
  /** PLATFORM-002B: id del logo como archivo transversal (o null → usa logoUrl/nombre). */
  logoFileId: string | null;
  /** Fuente de logo resuelta para mostrar: ruta autorizada, URL legacy o null (§3). */
  logoSource: string | null;
}

const LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Fuente de logo con prioridad: logo_file_id → logo_url legacy → null (§3). */
export function resolveLogoSource(profile: {
  logoFileId: string | null;
  logoUrl: string;
}): string | null {
  if (profile.logoFileId) return `/api/files/${profile.logoFileId}`;
  if (profile.logoUrl) return profile.logoUrl;
  return null;
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
  const logoFileId = profile?.logoFileId ?? null;
  const logoUrl = profile?.logoUrl ?? '';
  return {
    name: org.name,
    commercialName: profile?.commercialName ?? '',
    legalName: profile?.legalName ?? '',
    taxId: profile?.taxId ?? '',
    taxRegime: profile?.taxRegime ?? '',
    taxAddress: profile?.taxAddress ?? '',
    logoUrl,
    logoFileId,
    logoSource: resolveLogoSource({ logoFileId, logoUrl }),
  };
}

/**
 * Sube (o reemplaza) el logo de la organización usando el almacenamiento transversal
 * (PLATFORM-002B). Solo imágenes (PNG/JPEG/WEBP), máx 5 MB. El logo anterior se
 * desvincula y se borra si queda huérfano. Idempotente por reemplazo.
 */
export async function uploadOrganizationLogo(
  organizationId: string,
  actorId: string,
  input: { filename: string; mimeType: string; data: Buffer },
): Promise<StoredFileMeta> {
  if (!LOGO_MIME.has(input.mimeType)) {
    throw new FileValidationError('El logo debe ser PNG, JPEG o WEBP.');
  }
  if (input.data.byteLength > LOGO_MAX_BYTES) {
    throw new FileValidationError('El logo no debe superar 5 MB.');
  }
  // Sube y relaciona como logo de la organización.
  const meta = await uploadFile(organizationId, actorId, {
    filename: input.filename,
    mimeType: input.mimeType,
    data: input.data,
    relation: { entityType: 'organization', entityId: organizationId, relationType: 'logo' },
  });

  const prisma = getPrisma();
  const prev = await prisma.organizationProfile.findUnique({
    where: { organizationId },
    select: { logoFileId: true },
  });

  await withOrgContext(organizationId, async (tx) => {
    await tx.organizationProfile.upsert({
      where: { organizationId },
      update: { logoFileId: meta.id, updatedBy: actorId },
      create: { organizationId, logoFileId: meta.id, updatedBy: actorId },
    });
  });

  // Limpia el logo anterior (desvincula; borra si queda huérfano). Idempotente.
  if (prev?.logoFileId && prev.logoFileId !== meta.id) {
    await unlinkAndCleanup(organizationId, prev.logoFileId, {
      entityType: 'organization',
      entityId: organizationId,
      relationType: 'logo',
    });
  }
  return meta;
}

/** Quita el logo de la organización (desvincula + borra si queda huérfano). */
export async function removeOrganizationLogo(
  organizationId: string,
  actorId: string,
): Promise<void> {
  const prisma = getPrisma();
  const profile = await prisma.organizationProfile.findUnique({
    where: { organizationId },
    select: { logoFileId: true },
  });
  if (!profile?.logoFileId) return;
  await withOrgContext(organizationId, async (tx) => {
    await tx.organizationProfile.update({
      where: { organizationId },
      data: { logoFileId: null, updatedBy: actorId },
    });
  });
  await unlinkAndCleanup(organizationId, profile.logoFileId, {
    entityType: 'organization',
    entityId: organizationId,
    relationType: 'logo',
  });
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
