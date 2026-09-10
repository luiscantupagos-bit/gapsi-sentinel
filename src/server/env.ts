/**
 * Catálogo y validación de variables de entorno (PLATFORM-001 §31).
 *
 * NO cambia el comportamiento actual: los módulos existentes siguen leyendo
 * `process.env` como hoy. Este módulo aporta un CATÁLOGO tipado (qué variables
 * existen, cuáles son secretos, cuáles serán requeridas en producción) y utilidades
 * de diagnóstico que reportan **presencia** (nunca valores) para health checks y
 * validación de arranque en fases posteriores.
 */

export type EnvScope = 'local' | 'staging' | 'production';

export interface EnvVarSpec {
  name: string;
  /** Descripción corta del propósito. */
  description: string;
  /** ¿Es secreto? (no debe registrarse ni exponerse). */
  secret: boolean;
  /** Entornos donde será REQUERIDA (producción normalmente). */
  requiredIn: EnvScope[];
  /** ¿Ya se usa hoy en el código? (vs. reservada para fases futuras). */
  usedToday: boolean;
}

/**
 * Catálogo declarativo. Las variables `usedToday:false` están reservadas para
 * PLATFORM-002/003/006 (storage, auth, observability); se documentan aquí para que
 * `.env.example` y los diagnósticos las conozcan sin cablearlas todavía.
 */
export const ENV_CATALOG: EnvVarSpec[] = [
  // --- Aplicación / entorno ---
  {
    name: 'NEXT_PUBLIC_APP_NAME',
    description: 'Nombre visible de la app.',
    secret: false,
    requiredIn: [],
    usedToday: true,
  },
  {
    name: 'APP_URL',
    description: 'URL pública de la app (p. ej. https://app.c3sentinel.com.mx).',
    secret: false,
    requiredIn: ['staging', 'production'],
    usedToday: false,
  },
  {
    name: 'APP_ENV',
    description: 'Entorno lógico: local | staging | production.',
    secret: false,
    requiredIn: ['staging', 'production'],
    usedToday: false,
  },
  // --- Base de datos ---
  {
    name: 'DATABASE_URL',
    description: 'Conexión Prisma (rol de app con RLS en prod).',
    secret: true,
    requiredIn: ['local', 'staging', 'production'],
    usedToday: true,
  },
  {
    name: 'DIRECT_URL',
    description: 'Conexión directa (migraciones) cuando se usa pooling.',
    secret: true,
    requiredIn: ['staging', 'production'],
    usedToday: false,
  },
  // --- Autenticación (PLATFORM-003) ---
  {
    name: 'AUTH_PROVIDER',
    description: 'Proveedor de auth activo (dev en local).',
    secret: false,
    requiredIn: [],
    usedToday: true,
  },
  {
    name: 'AUTH_SESSION_COOKIE',
    description: 'Nombre de la cookie de sesión.',
    secret: false,
    requiredIn: [],
    usedToday: true,
  },
  {
    name: 'AUTH_SECRET',
    description: 'Secreto de firma de sesión/tokens (prod).',
    secret: true,
    requiredIn: ['staging', 'production'],
    usedToday: false,
  },
  // --- Object Storage (PLATFORM-002) ---
  {
    name: 'STORAGE_ENDPOINT',
    description: 'Endpoint S3-compatible (R2/S3/…).',
    secret: false,
    requiredIn: ['production'],
    usedToday: false,
  },
  {
    name: 'STORAGE_BUCKET',
    description: 'Bucket por defecto de binarios.',
    secret: false,
    requiredIn: ['production'],
    usedToday: false,
  },
  {
    name: 'STORAGE_ACCESS_KEY',
    description: 'Access key del storage.',
    secret: true,
    requiredIn: ['production'],
    usedToday: false,
  },
  {
    name: 'STORAGE_SECRET_KEY',
    description: 'Secret key del storage.',
    secret: true,
    requiredIn: ['production'],
    usedToday: false,
  },
  // --- Jobs / scheduler (PLATFORM-006) ---
  {
    name: 'CRON_SECRET',
    description: 'Secreto para autenticar el disparador del scheduler.',
    secret: true,
    requiredIn: ['production'],
    usedToday: false,
  },
  // --- Observabilidad / email (futuro) ---
  {
    name: 'SENTRY_DSN',
    description: 'DSN de monitoreo de errores.',
    secret: true,
    requiredIn: [],
    usedToday: false,
  },
  {
    name: 'EMAIL_API_KEY',
    description: 'API key del proveedor de correo transaccional.',
    secret: true,
    requiredIn: [],
    usedToday: false,
  },
  // --- Almacenamiento local (dev, TASK-004) ---
  {
    name: 'DOCUMENTS_STORAGE_DIR',
    description: 'Carpeta local de archivos (dev).',
    secret: false,
    requiredIn: [],
    usedToday: true,
  },
  {
    name: 'DOCUMENTS_MAX_UPLOAD_BYTES',
    description: 'Tamaño máximo de subida (bytes).',
    secret: false,
    requiredIn: [],
    usedToday: true,
  },
];

/** Presencia de una variable (sin exponer su valor). */
export function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() !== '';
}

export interface EnvReportEntry {
  name: string;
  present: boolean;
  secret: boolean;
  requiredHere: boolean;
  usedToday: boolean;
}

export interface EnvReport {
  scope: EnvScope;
  ok: boolean;
  /** Variables requeridas en este entorno que faltan. */
  missingRequired: string[];
  entries: EnvReportEntry[];
}

/** Resuelve el entorno lógico actual (APP_ENV, si no NODE_ENV). */
export function resolveEnvScope(): EnvScope {
  const raw = (process.env.APP_ENV ?? '').toLowerCase();
  if (raw === 'staging') return 'staging';
  if (raw === 'production') return 'production';
  if ((process.env.NODE_ENV ?? '') === 'production') return 'production';
  return 'local';
}

/**
 * Reporte de configuración por entorno, SIN valores (solo presencia). Útil para el
 * health check y para una futura validación de arranque. No lanza.
 */
export function envReport(scope: EnvScope = resolveEnvScope()): EnvReport {
  const entries: EnvReportEntry[] = ENV_CATALOG.map((spec) => ({
    name: spec.name,
    present: hasEnv(spec.name),
    secret: spec.secret,
    requiredHere: spec.requiredIn.includes(scope),
    usedToday: spec.usedToday,
  }));
  const missingRequired = entries.filter((e) => e.requiredHere && !e.present).map((e) => e.name);
  return { scope, ok: missingRequired.length === 0, missingRequired, entries };
}
