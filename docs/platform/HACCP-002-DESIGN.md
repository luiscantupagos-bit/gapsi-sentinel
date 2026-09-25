# HACCP-002 — Diagrama de flujo · diseño e implementación

Rama `feat/haccp-002-process-flow` (desde `main` tras integrar HACCP-001 = f88a2ce). Construye
el constructor de diagrama de flujo nativo: cada etapa es una ENTIDAD estructurada con
identidad LÓGICA estable; el diagrama es una representación de esas entidades (no una imagen).

## Modelo

- **`haccp_process_steps`** (version-owned): `id` (fila) vs `process_step_id` (identidad LÓGICA
  estable entre versiones, como `activityId` en Programas). Campos: `step_type`, `name`,
  `description`, `sequence`, `area`, `responsible_user_id`, `responsible_role`, `equipment`,
  `inputs`, `outputs`, `parameters`, `notes`.
- **`haccp_process_connections`** (version-owned): `from_step_id` / `to_step_id` referencian la
  identidad LÓGICA (`process_step_id`) → sobreviven al clon sin remapear. `connection_type`
  (`sequence | conditional | rework | reject`), `label`, `sequence`.
- **Verificación in situ** (§E18): columnas en `haccp_plan_versions`
  (`flow_verified_on_site`, `flow_verified_at`, `flow_verified_by`, `flow_verification_notes`),
  por VERSIÓN completa (no por etapa).

Tipos de etapa (§E16): Proceso, Inspección, Almacenamiento, Transporte, Decisión, Retrabajo,
Salida/Rechazo. Conexiones explícitas desde HACCP-002 (§E7) → soporta ramas
(Recepción → Inspección → conforme/no conforme).

## Reglas

- **Identidad estable** (§E4/§E22/§E23): al crear versión nueva se clonan etapas y conexiones
  con nuevas filas pero **mismo `process_step_id`**; una etapa nueva recibe un `process_step_id`
  nuevo. Una etapa eliminada en un draft posterior no borra el histórico de la versión previa
  (§E24).
- **Verificación** (§E18-E20): marcar verificado sella actor/fecha; cualquier edición del flujo
  en un borrador (agregar/editar/eliminar etapa o conexión) **reinicia** `flow_verified_on_site`.
- **Inmutabilidad** (§E21): la versión publicada es read-only; para modificar se crea nueva
  versión.
- **`flowChanged`** (§E25): helper puro que compara dos snapshots (por identidad lógica +
  conexiones) — base para el impact assessment / reevaluación futuros. No ejecuta automatismos.

## UI

- Tab **«Diagrama de flujo»** habilitado en el workspace (ya no «Próximamente»).
- Render reutilizable `HaccpProcessFlowView` (vertical top-down, print-safe, `break-inside`),
  usable en workspace/read-only y en la futura salida documental (HACCP-007).
- Editor accesible (`HaccpFlowTab`): agregar/editar/eliminar etapas, **reordenar con
  «↑/↓»** (sin depender de drag&drop), conectar/desconectar por formulario, verificación in
  situ. Nodo muestra número + nombre + tipo; el detalle (área, responsable, equipo, entradas,
  salidas, parámetros, observaciones) se edita en el formulario de la etapa.
- Responsive y sin dependencia de hover.

## Tenant / migración

- `20260925000000_haccp_process_flow` (aditiva; 0 DROP): ALTER `haccp_plan_versions` (+4
  columnas de verificación), 2 tablas nuevas con RLS + políticas tenant + grants a `gapsi_app`
  - FKs tenant-safe. Cross-tenant DENY.

## Seed

`PL-HACCP-001` (huevo fresco) con flujo demo de 9 etapas y **rama de producto no conforme**:
Recepción → Almacenamiento temporal → Selección/inspección → (Conforme → Clasificación · No
conforme → Separación PNC) → Empaque → Loteado → Almacenamiento PT → Despacho.

## Fuera de alcance

HACCP-003 (análisis de peligros: biológico/químico/físico/alérgeno) — solo se preparan las
etapas (§E28). DOC-004 (Records) para monitoreos/PCC/PPRO/verificación operativa. La salida
documental del flujo (con descripción, no screenshot) corresponde a HACCP-007 (§E29). TRACE
(entradas/salidas como inventario) es futuro (§E9).
