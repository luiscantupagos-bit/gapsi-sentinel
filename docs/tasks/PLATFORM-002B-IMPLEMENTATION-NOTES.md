# PLATFORM-002B — Logo + adjuntos + renderer · notas de implementación

Hace **visible y usable** el almacenamiento transversal de PLATFORM-002 en dos puntos
(logo de organización y adjuntos de tarea), cablea el logo al renderer documental y
deja un patrón UI reusable para DOC-004. Incluye una **demo de KPIs** para validar la
semántica del semáforo (positivos vs. negativos). No migra legacy; no instala AWS SDK.

## Migración

`20260918000000_org_logo_file` (aditiva, **0 DROP**): `organization_profiles.logo_file_id`
(nullable) + **FK compuesta** `(logo_file_id, organization_id)` → `stored_files(id,
organization_id)` (`ON DELETE RESTRICT`): el logo pertenece a la misma organización
(integridad de tenant §26). `logo_url` legacy se conserva.

## Logo de organización

- **Resolución (§3)**: `resolveLogoSource(profile)` → `logo_file_id` (`/api/files/<id>`)
  → `logo_url` legacy → `null` (fallback al nombre en UI). Nunca muestra el logo de C3
  como si fuera del cliente.
- **Servicio** (`src/server/organization.ts`): `uploadOrganizationLogo` (solo PNG/JPEG/
  WEBP, ≤ 5 MB; sube vía `uploadFile` con relación `organization`/`logo`; setea
  `logo_file_id`; **reemplazo**: desvincula y limpia el anterior si queda huérfano),
  `removeOrganizationLogo`. `getOrganizationProfile` expone `logoFileId` + `logoSource`.
- **UI** (`settings/_components/LogoSettings.tsx`): preview actual (o nombre), subir/
  reemplazar/eliminar. Acciones en `settings/actions.ts` (revalidan settings + documentos).
- **Renderer (§7/§8)**: `getDocumentDetail`/copias controladas/cache al guardar resuelven
  `organizationLogoSource(org)` y lo pasan a `buildRenderIdentity` →
  `identity.organizationLogoUrl` → `<img class="doc-render__org-logo">` en el encabezado.
  Funciona en vista canónica, impresión y PDF (la ruta `/api/files/[id]` usa la sesión del
  navegador; no se guarda una signed URL caducable en BD). Fallback: nombre de la
  organización. El branding C3 del pie no se altera.

## Adjuntos reutilizables

- **Componente** `_components/FileAttachments.tsx` (MVP §9): subir / listar / descargar /
  quitar. Muestra nombre, tipo, tamaño, fecha, subido por; **nunca** provider/bucket/
  storageKey/UUID. Responsive (tarjetas con `data-label` en móvil §20). Contrato pensado
  para que **DOC-004** lo reutilice tal cual (§21).
- **Primera integración (§10)**: detalle de **Tarea** (`entity_type='task'`,
  `relation_type` attachment | evidence). Acciones en `tasks/[taskId]/file-actions.ts`
  validan sesión, tenant y que la Tarea exista (§14). No cambia el workflow de Task.
- **Attachment vs Evidence (§11)**: distinción por `relation_type`; el selector permite
  ambos (evidence = demuestra ejecución).
- **Borrado seguro (§15/§16)**: `unlinkAndCleanup` desvincula y solo hace **soft delete**
  si el archivo no tiene otras relaciones (`activeRelationCount`); un archivo compartido
  no se destruye.

## Legacy (§13)

Las 9 tablas de archivo legacy se conservan intactas; los **nuevos** uploads usan
`stored_files`. En Tarea, la tarjeta «Evidencia» legacy (task_files) y la nueva «Adjuntos»
(stored_files) son sistemas separados → sin doble listado del mismo archivo. Migración de
históricos: follow-up (PLATFORM-STORAGE-LEGACY).

## Demo de KPIs con semáforo (validación semántica)

Sección **Ejemplos de indicadores** en `Configuración → Semáforo de cumplimiento`:

| KPI                            | Dirección        | Valor | Resultado                   |
| ------------------------------ | ---------------- | ----- | --------------------------- |
| Cumplimiento de auditorías     | higher_is_better | 95%   | Verde · Cumplimiento alto   |
| Avance de acciones correctivas | higher_is_better | 76%   | Naranja · Cumplimiento bajo |
| Producto no conforme           | lower_is_better  | 3%    | Verde · Nivel favorable     |
| Tareas vencidas                | lower_is_better  | 18%   | Rojo · Nivel crítico        |

- **Positivos** reaccionan a la política editada en vivo (`resolveComplianceBand`).
- **Negativos** usan `resolveInverseBand`/`resolveMetricBand(value,'lower_is_better')` con
  umbrales **inversos demo** (0-5 verde, 5-10 amarillo, 10-15 naranja, >15 rojo). **No**
  reutilizan 90/80/70 (3% no es rojo). Estos umbrales inversos son solo demo; **no** son
  todavía una política tenant configurable. `resolveComplianceBand` sigue siendo la
  autoridad de cumplimiento positivo.
- Accesibilidad (§12): cada KPI muestra porcentaje + etiqueta textual + color (no solo color).

## Seguridad / permisos

Servidor valida sesión, tenant, acceso a Task/Settings y pertenencia del archivo. No se
confía en entityId/fileId/relationType del cliente sin validar. RLS + FK compuesta impiden
Org A → stored_file de Org B. Errores en español sin exponer detalles del proveedor.

## Tests

- Unit: KPIs demo (higher/lower_is_better, reacción a policy, inversa no usa 90/80/70),
  `resolveInverseBand`/`resolveMetricBand`.
- DB (`db/file-ui`): logo (subida, perfil→file_id, relación, aislamiento, reemplazo,
  fallback url/nombre, quitar, rechazo no-imagen), adjuntos de tarea (subir/listar/uso,
  unlink de última relación borra, compartido no se borra).

## DOC-004 readiness (§21)

DOC-004 (Registros) reutilizará: `uploadFile`/`listFilesForEntity`/`unlinkAndCleanup`,
`FileAttachments`, el modelo `file_relations` (record → evidence → stored_file), la
distinción attachment/evidence y la UI móvil. No se implementa Registros aquí.

## Pendiente / follow-ups

- Migración de uploads legacy (PLATFORM-STORAGE-LEGACY).
- Política tenant para métricas inversas (si se formaliza) — hoy demo.
- R2 real en staging (PLATFORM-STAGING-R2); malware scanning; offline/chunking.
