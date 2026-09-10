/**
 * Entitlements comerciales por organización (DOC-UX-002 §83-90). PURO.
 *
 * Arquitectura desacoplada del billing (que aún no existe): un descriptor de
 * suscripción (plan + modalidad) se traduce en capacidades booleanas. La regla
 * comercial es PROVISIONAL (nombres/precios de planes pueden cambiar), por eso
 * se centraliza aquí y **nunca** se dispersa como `if (plan === 'industrial')`
 * por las páginas. La autorización siempre se resuelve en servidor.
 */

/** Planes comerciales (provisionales). Orden ascendente de nivel. */
export const SUBSCRIPTION_PLANS = ['entrepreneur', 'basic', 'intermediate', 'industrial'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const BILLING_CADENCES = ['monthly', 'annual'] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];

/** Planes que, por nivel, pueden ocultar la atribución incluso en modalidad mensual. */
const TOP_TIER_PLANS: ReadonlySet<SubscriptionPlan> = new Set(['intermediate', 'industrial']);

export interface SubscriptionDescriptor {
  plan: SubscriptionPlan;
  cadence: BillingCadence;
}

/** Capacidades derivadas de la suscripción. */
export interface SubscriptionEntitlements {
  /** Puede ocultar la atribución comercial de C3 en el documento. */
  canHideC3Attribution: boolean;
}

/** Entitlements por defecto (organización sin suscripción definida): nada habilitado. */
export const DEFAULT_ENTITLEMENTS: SubscriptionEntitlements = {
  canHideC3Attribution: false,
};

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return typeof value === 'string' && (SUBSCRIPTION_PLANS as readonly string[]).includes(value);
}

export function isBillingCadence(value: unknown): value is BillingCadence {
  return typeof value === 'string' && (BILLING_CADENCES as readonly string[]).includes(value);
}

/**
 * Regla comercial (§85): puede ocultar la atribución de C3 si cumple AL MENOS UNA:
 *   A. la modalidad es ANUAL, o
 *   B. el plan es uno de los superiores (Intermedio / Industrial).
 * Sin suscripción → sin capacidad.
 */
export function computeEntitlements(
  subscription: SubscriptionDescriptor | null | undefined,
): SubscriptionEntitlements {
  if (!subscription) return DEFAULT_ENTITLEMENTS;
  const annual = subscription.cadence === 'annual';
  const topTier = TOP_TIER_PLANS.has(subscription.plan);
  return { canHideC3Attribution: annual || topTier };
}

/**
 * Resuelve la atribución C3 EFECTIVA con guard de servidor (§84/§110): la
 * preferencia del cliente solo puede ocultarla si el entitlement lo permite; de
 * lo contrario, siempre visible.
 */
export function resolveShowC3Attribution(
  storedPreference: boolean,
  entitlements: SubscriptionEntitlements,
): boolean {
  if (!entitlements.canHideC3Attribution) return true;
  return storedPreference;
}
