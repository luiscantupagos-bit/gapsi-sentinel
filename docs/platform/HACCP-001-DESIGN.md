# HACCP-001 — Fundación del módulo HACCP · diseño

Rama `feat/haccp-001-foundation` (desde `main` tras integrar DOC-OUTPUT/CAPA). El módulo
HACCP es la **fuente de verdad operativa**; el Plan HACCP formal será una **salida
documental generada** (HACCP-007, futuro). HACCP-001 construye solo la estructura sobre la
que operarán HACCP-002..007.

## Auditoría de convenciones reutilizadas (§3)

- **Tenant/RLS**: `withOrgContext(orgId, tx => …)` fija `app.current_org`; políticas RLS
  `<tabla>_tenant_isolation` con `organization_id = fn_current_org()` (USING + WITH CHECK)
  vía DO-loop en SQL complementario; grants a `gapsi_app`.
- **FK tenant-safe**: par `@@unique([id, organization_id])` en el padre + FK compuesta
  `references: [id, organization_id]`. Referencias a otros módulos (documents, versions,
  users) se declaran como FK compuestas hacia `[id, organization_id]` (o simple a `users`)
  escritas a mano en SQL, sin `@relation` de Prisma (mismo patrón que DOC-OUTPUT).
- **Roles/permisos**: `Membership.role` (owner|admin|evaluator|viewer); `isAdmin = owner|admin`.
  No hay sistema de capacidades paralelo; HACCP reutiliza estos roles (§42).
- **Códigos/consecutivos**: contador atómico por organización con
  `INSERT … ON CONFLICT DO UPDATE SET last_seq = tabla.last_seq + 1 RETURNING last_seq`.
- **Versionado**: `versioning.ts` (`parseVersionLabel`, `nextVersionLabel`,
  `INITIAL_VERSION_LABEL='v1.0'`) — major/minor, **sin float** (§6). Se reutiliza tal cual.
- **Fuentes documentales**: un «Programa» es un `Document` con `document_type='program'`; las
  fichas de Producto Terminado / Materia Prima son `Document` con `document_type` de
  especificación. Por tanto TODA fuente HACCP apunta a `documents` + `document_versions`.

## Decisión de código (§8)

Namespace **independiente** `PL-HACCP-###` con su propio contador
(`haccp_plan_code_counters`, por organización). **No** se reutiliza el contador del tipo
documental genérico «Plan» para evitar colisiones/confusión. El usuario puede editar el
código propuesto antes de publicar (mismas reglas de forma que documentos).

## Simplificación de tablas (§46/§47)

En lugar de 8 tablas, **5** (referencias unificadas). Producto, materias primas, PPR y
documentos soporte comparten estructura (documento + versión exacta + snapshot); se modelan
en UNA tabla version-owned discriminada por `reference_kind`, con el snapshot **inline** (el
`source_version_id` es la referencia real; los labels snapshot dan trazabilidad, §22). Esto
elimina `haccp_product_references` + `haccp_material_references` +
`haccp_prerequisite_references` + `haccp_document_references` + `haccp_source_snapshots` →
`haccp_source_references`.

| Tabla                      | Alcance           | Rol                                                    |
| -------------------------- | ----------------- | ------------------------------------------------------ |
| `haccp_plans`              | identidad estable | plan + display actual + puntero a versión vigente      |
| `haccp_plan_versions`      | version-owned     | major/minor/label/status/scope/change_notes/is_current |
| `haccp_team_members`       | version-owned     | equipo (interno/externo, líder ≤1)                     |
| `haccp_source_references`  | version-owned     | producto/MP/PPR/documentos + snapshot inline           |
| `haccp_plan_code_counters` | contador          | consecutivo `PL-HACCP-###` por organización            |

Los datos que cambian entre versiones pertenecen a `plan_version` (§47). Al crear versión
nueva se hace **deep clone** de team + source_references (no se comparten filas, §37).

## Esquema (campos)

### haccp_plans

`id, organization_id, site_id?, code, title, description?, scope?, status, current_version_id?,
responsible_user_id?, next_review_at?, created_by?, created_at, updated_at`.
`status`: `draft | in_review | published | reevaluation_required | obsolete`.
Únicos: `(organization_id, code)`, `(id, organization_id)`.

### haccp_plan_versions

`id, organization_id, plan_id, major, minor, version_label, status, scope?, product_process?,
change_notes?, is_current, created_by?, created_at, published_at?`.
`status`: `draft | in_review | published | obsolete`. Único: `(plan_id, version_label)`,
`(id, organization_id)`.

### haccp_team_members

`id, organization_id, plan_version_id, user_id?, external_name?, area?, job_title?,
haccp_role?, responsibility?, training_summary?, is_leader, sort_order, created_at`.
Persona interna → `user_id` (no se duplica el nombre, §10). Persona externa → `external_name`.
**Líder ≤1 por versión**: índice único parcial `(plan_version_id) WHERE is_leader` (§11).

### haccp_source_references

`id, organization_id, plan_version_id, reference_kind, source_type, source_document_id,
source_version_id?, category?, sort_order, notes?, source_code_snapshot?,
source_title_snapshot?, source_version_label_snapshot?, source_status_snapshot?,
source_published_at_snapshot?, created_at`.
`reference_kind`: `product | material | prerequisite | document`.
`source_type`: `document | program`.
**Producto ≤1 por versión**: índice único parcial `(plan_version_id) WHERE reference_kind='product'` (§12).

### haccp_plan_code_counters

`organization_id (PK), last_seq`.

## Snapshots e impact awareness (§21-27)

- Al **publicar**, cada `source_reference` sella `source_version_id` + labels snapshot
  (code/title/version_label/status/published_at). El plan publicado NO depende dinámicamente
  del «latest» de la fuente (§21).
- **Actualización disponible** (§24/§25): se compara `source_version_id` con la versión
  **publicada más reciente** del `source_document_id`. Si difieren → badge «Actualización
  disponible». HACCP-001 **solo detecta y muestra**; NO transiciona automáticamente a
  `reevaluation_required` (§27) ni implementa el workflow de impacto (§26, documentado como
  futuro: sin impacto / actualizar referencia / requiere reanálisis / revalidación / nueva
  versión HACCP).
- Nueva versión (draft) desde publicada: clona referencias **exactas** anteriores (no salta a
  latest, §38); en draft el usuario puede «Usar versión más reciente» por fuente (§39, acción
  explícita).

## RLS / grants / integridad (§43)

Todas las tablas llevan `organization_id`, RLS `<tabla>_tenant_isolation`, grants
`SELECT, INSERT, UPDATE, DELETE` a `gapsi_app` (el contador solo `SELECT, INSERT, UPDATE`).
FKs tenant-safe hacia `documents(id, organization_id)` / `document_versions(id, organization_id)`
→ referencias cross-tenant DENEGADAS. `site_id` opcional (§44): un plan puede pertenecer a un
sitio, pero las fuentes pueden ser documentos **corporativos** (compartidos en la organización)
→ no se fuerza el mismo sitio; la validez es a nivel organización.

## Permisos (§42)

- ver HACCP: cualquier miembro.
- crear / editar borrador / publicar: `isAdmin` (owner|admin).
- Solo `draft` (y `in_review` según workflow futuro) es editable; `published`/`obsolete`/
  `reevaluation_required` → la versión publicada es **inmutable** (§34).

## Migración (§45)

Una migración **aditiva** (`0 DROP TABLE / 0 DROP COLUMN`), RLS + grants + FK tenant-safe,
preautorizada por seguir esta arquitectura. Si se detectara necesidad de modificar/destruir
schema existente → DETENERSE (no aplica: es puramente aditiva).

## Fuera de alcance (documentado)

HACCP-002 (flujo/nodos), 003 (peligros/riesgo), 004 (PCC/PPRO/árbol), 005 (validación), 006
(tareas/Gantt/recurrencia), 007 (documento formal generado). DOC-004 (Records) necesario para
monitoreos/verificación operativa. Interfaces futuras se documentan, no se implementan.

## Estado: IMPLEMENTADO (HACCP-001)

Rama `feat/haccp-001-foundation` (desde `main` = 7dfa36e). Entregado:

- **Migración** `20260924000000_haccp_foundation` (aditiva; 0 DROP; 5 tablas, RLS + políticas
  tenant, grants a gapsi_app, FKs tenant-safe, índices únicos parciales líder≤1 y producto≤1).
- **Server** `src/server/haccp.ts`: crear plan (código PL-HACCP-### atómico) + v1.0, editar
  borrador, equipo (líder único), fuentes producto/MP/PPR/documento con snapshot de la versión
  exacta, publicar (valida + sella snapshots + vigente), nueva versión (deep clone con versiones
  exactas, no latest), detección de actualización de fuente (solo aviso), actualizar fuente en
  borrador.
- **Feature** `src/features/haccp/haccp-state.ts`: estados/labels/tabs/validación/detección puras.
- **UI**: nav «Cumplimiento → HACCP»; índice `/dashboard/haccp`; asistente `/dashboard/haccp/new`;
  workspace `/dashboard/haccp/[planId]` con 6 tabs (Resumen/Equipo/Producto/Materias/PPR/Documentos)
  - 6 fases futuras «Próximamente»; solo el borrador editable; publicado inmutable; nueva versión
    para admin; referencias clickeables; estados en español.
- **Seed** demo `PL-HACCP-001` (huevo fresco) vigente con equipo (líder) + PPR/documento reales;
  producto y materias primas quedan PENDIENTES (no hay fichas de especificación; §55, no se
  inventan).
- **Tests**: `haccp-state` (unit), `db/haccp` (aislamiento, líder, snapshot, publicación,
  detección, clon, inmutabilidad, cross-tenant), `haccp-ui` (fuente). Gates verdes; seed 3x.

### Follow-up de FASE 2 registrado: DOC-OUTPUT-VISUAL-SMOKE

La validación visual de la salida documental (copia controlada / borrador / obsoleto) y del
reporte CAPA 8D se hizo por mediciones del DOM (el Browser pane del entorno no captura píxeles).
Pendiente de smoke de píxeles/PDF con revisión manual; no bloqueante.
