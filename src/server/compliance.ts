/**
 * Semáforo global de cumplimiento (CORE-UX-005) — servicio server-side.
 *
 * Lee/escribe la política tenant-scoped (`organization_compliance_policies`) con
 * fallback a los defaults 90/80/70 cuando la organización no tiene fila. La
 * organización proviene SIEMPRE del contexto de servidor (nunca del cliente).
 * Escrituras bajo `withOrgContext` (RLS). El resolver puro vive en
 * `@/features/compliance/compliance-band`.
 */
import { getPrisma, withOrgContext } from './db';
import {
  DEFAULT_RESOLVED_POLICY,
  validateResolvedPolicy,
  type ResolvedCompliancePolicy,
} from '@/features/compliance/compliance-band';

export class CompliancePolicyError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '));
    this.name = 'CompliancePolicyError';
  }
}

/** Convierte un `Decimal` de Prisma (o número) a `number` con decimales. */
function toNumber(value: unknown): number {
  if (value && typeof value === 'object' && 'toNumber' in (value as Record<string, unknown>)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Política de cumplimiento vigente de la organización (umbrales + colores). Sin fila
 * → defaults. Nunca lanza por ausencia de fila (§20 fallback seguro).
 */
export async function getOrganizationCompliancePolicy(
  organizationId: string,
): Promise<ResolvedCompliancePolicy> {
  const row = await getPrisma().organizationCompliancePolicy.findUnique({
    where: { organizationId },
  });
  if (!row) return DEFAULT_RESOLVED_POLICY;
  return {
    greenMin: toNumber(row.greenMin),
    yellowMin: toNumber(row.yellowMin),
    orangeMin: toNumber(row.orangeMin),
    green: row.greenColor,
    yellow: row.yellowColor,
    orange: row.orangeColor,
    red: row.redColor,
  };
}

export interface CompliancePolicyInput {
  greenMin: number;
  yellowMin: number;
  orangeMin: number;
  green: string;
  yellow: string;
  orange: string;
  red: string;
}

/**
 * Persiste la política de la organización. Valida en servidor (autoridad, §5/§39):
 * `100 >= greenMin > yellowMin > orangeMin >= 0` y colores HEX. Upsert idempotente.
 */
export async function updateOrganizationCompliancePolicy(
  organizationId: string,
  actorId: string,
  input: CompliancePolicyInput,
): Promise<void> {
  const resolved: ResolvedCompliancePolicy = {
    greenMin: input.greenMin,
    yellowMin: input.yellowMin,
    orangeMin: input.orangeMin,
    green: input.green,
    yellow: input.yellow,
    orange: input.orange,
    red: input.red,
  };
  const errors = validateResolvedPolicy(resolved);
  if (errors.length) throw new CompliancePolicyError(errors);

  const data = {
    greenMin: resolved.greenMin,
    yellowMin: resolved.yellowMin,
    orangeMin: resolved.orangeMin,
    greenColor: resolved.green,
    yellowColor: resolved.yellow,
    orangeColor: resolved.orange,
    redColor: resolved.red,
  };
  await withOrgContext(organizationId, async (tx) => {
    await tx.organizationCompliancePolicy.upsert({
      where: { organizationId },
      update: { ...data, updatedBy: actorId },
      create: { organizationId, ...data, updatedBy: actorId },
    });
  });
}
