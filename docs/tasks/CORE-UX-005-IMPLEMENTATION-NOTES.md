# CORE-UX-005 — Semáforo global de cumplimiento · notas de implementación

Fase 1: persistencia tenant-scoped + configuración + resolver central + migración de
componentes de cumplimiento. Base puesta en PLATFORM-001 (`compliance-band.ts`).

## Modelo

- **Migración** `20260916000000_compliance_policy` (aditiva, **0 DROP**):
  `organization_compliance_policies` (`organization_id` PK/FK, `green_min`/`yellow_min`/
  `orange_min` DECIMAL(5,2), `green_color`/`yellow_color`/`orange_color`/`red_color`,
  `updated_by`, timestamps). **CHECK** `ocp_thresholds_check`
  (`green_min <= 100 AND orange_min >= 0 AND green_min > yellow_min > orange_min`).
  FK org `ON DELETE RESTRICT`; **RLS** `_tenant_isolation` (`fn_current_org`); grants
  SELECT/INSERT/UPDATE a `gapsi_app`.
- **Defaults 90/80/70**: sin fila → `DEFAULT_RESOLVED_POLICY` (fallback en servidor,
  §20). Compatible con tenants existentes (no requiere backfill).

## Resolver central (puro)

`src/features/compliance/compliance-band.ts`:

- `getComplianceBand(value, policy, styles?)` — límites 90/80/70 con decimales.
- `ResolvedCompliancePolicy` (umbrales + colores) + `resolveComplianceBand(value, resolved)`
  — punto único que consumen los componentes (no repetir `if value >= 90`).
- `validateCompliancePolicy` / `validateComplianceColors` (HEX, reutiliza `isHexColor`) /
  `validateResolvedPolicy`.
- Semántica (§10/§37): `MetricDirection` (`higher_is_better` | `lower_is_better`) +
  `usesComplianceBand`. El semáforo aplica **solo** a «mayor = mejor».

## Servicio server-side

`src/server/compliance.ts`:

- `getOrganizationCompliancePolicy(org)` → política resuelta con fallback default.
- `updateOrganizationCompliancePolicy(org, actor, input)` → valida (autoridad servidor)
  y upsert en `withOrgContext` (RLS). `CompliancePolicyError` con mensajes.
- La organización proviene SIEMPRE del contexto de servidor (nunca del cliente).

## Configuración (UI)

`Administración → Configuración → Semáforo de cumplimiento`
(`_components/ComplianceThresholdsForm.tsx` + `saveCompliancePolicyAction`):

- Verde/Amarillo/Naranja «Desde (%)» (decimales) + color; Rojo derivado.
- **Preview reactivo** (95/85/75/65) que se recolorea con la configuración actual.
- Aclaración (§12): se aplica a indicadores de cumplimiento, **no** a riesgo/errores/
  vencimientos/almacenamiento.
- Al guardar revalida `/dashboard`, `/dashboard/settings`, `/dashboard/diagnostics` (§21).

## Componentes migrados

- **Dashboard Ejecutivo · Estado del sistema** (`exec.tsx · SystemStatusCard` + `Gauge`):
  el color del gauge (% de cumplimiento) usa `resolveComplianceBand`. La etiqueta
  **Riesgo** conserva su color (métrica «mayor = peor», §27, sin cambios).
- **Cumplimiento por esquema** (`exec.tsx · SchemeBars`): color de barra por banda.
- **Ejecución de Programas** (`execution/page.tsx`): la barra de progreso (completadas/
  total, «mayor = mejor») usa la banda.

## Exclusiones (§10/§19)

No se aplicó el semáforo a riesgo, alertas, vencimientos, almacenamiento ni a KPIs sin
metadata de dirección. Indicadores: follow-up — si un KPI declara dirección
`higher_is_better` podrá adoptar la política; no se inventó semáforo para todos.

## Accesibilidad (§14)

Cada banda expone porcentaje (texto) + etiqueta + color; el color nunca es el único
canal (el % siempre se muestra como texto).

## Gauge (§28)

Se migró el **color** del gauge a la política central; la **geometría SVG no se tocó**.
El bug visual del arco (UI-FIX) permanece como tarea separada; no se pudo confirmar/
descartar visualmente con la semilla actual (diagnóstico «en progreso» → arco atenuado).

## Follow-ups

- **UI-FIX** — gauge «Estado del sistema» (geometría).
- Migrar KPIs/Indicadores con dirección declarada; Proyectos (PROJECT-002) cuando exista
  un % de avance/cumplimiento declarado `higher_is_better`.
- Etiquetas de nivel configurables por organización (hoy globales, por decisión §3).
