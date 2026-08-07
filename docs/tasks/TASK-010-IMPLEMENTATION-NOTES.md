# TASK-010 — Auditorías, programas y preparación (notas de implementación)

## Arquitectura

Módulo formal de auditorías y preparación para cumplimiento. Sentinel **prepara,
revisa, documenta y da seguimiento**; **no certifica** — la decisión es del
auditor/responsable autorizado. Entidades separadas (no una tabla gigante):
**programa → auditoría → requisito (snapshot) → evidencia → resultado humano →
hallazgo → CAPA → tarea → seguimiento**, más certificaciones.

## Reutilización de la norma (snapshot inmutable)

El contenido normativo **sigue siendo `template_versions`** (fuente de verdad). Al
generar el checklist, cada auditoría **congela** los requisitos seleccionados en
`audit_requirement_snapshots` (framework/versión/sección/código/texto/preguntas/
criterio + puntero al requisito original). Las auditorías cerradas **no cambian**
si la plantilla se actualiza después. La evaluación humana (resultado, evidencia,
comentarios) vive en `audit_checklist_items` (separada del snapshot). No se
duplica el catálogo maestro ni se crea una segunda biblioteca de normas.

Diseño para IA futura (sin implementarla): trazabilidad
`requisito original → snapshot evaluado → evidencia → resultado humano → hallazgo
→ CAPA → tarea → seguimiento`.

## Modelo de datos y migración

Migración nueva `prisma/migrations/20260806000000_audits` (23 tablas): programas
(`audit_programs`, `audit_program_folio_counters`, `audit_program_items`,
`audit_program_files`, `audit_program_status_history`), auditoría (`audits`,
`audit_folio_counters`, `audit_team_members`, `audit_agenda_items`,
`audit_scope_items`, `audit_requirement_snapshots`, `audit_checklist_items`,
`audit_evidences`, `audit_interviews`, `audit_files`, `audit_comments`,
`audit_status_history`, `audit_requirement_history`), hallazgos (`audit_findings`,
`audit_finding_folio_counters`, `audit_finding_relations`, `audit_follow_ups`) y
`organization_certifications`.

**FK compuestas anti-cruce** intra-módulo y a sitio; punteros genéricos
(framework/versión/requisito/documento/CAPA/tarea) validados en servidor + RLS.
CHECK de enums, RLS por organización, **append-only** en historiales, no-borrado
físico, grants a `gapsi_app`, JSONB solo para snapshot/metadata.

**La migración se generó con `prisma migrate diff --from-schema-datamodel
<antes> --to-schema-datamodel <después>` (datamodel↔datamodel): 0 sentencias
DROP**, para no repetir el defecto de reproducibilidad de TASK-009. No modifica
migraciones anteriores.

## Folios, estados y permisos

- Folios atómicos por organización/año: `PA-AAAA-####`, `AUD-AAAA-####`,
  `HAL-AAAA-####`.
- **Auditoría:** `draft·planned·ready·in_progress·report_drafting·under_review·
completed·follow_up·closed·cancelled`. No ejecuta sin alcance/criterios/líder;
  no cierra con hallazgos abiertos que requieren seguimiento salvo justificación;
  cancelar exige motivo; cerrada = solo lectura; reapertura owner/admin.
- **Programa:** `draft·approved·active·completed·cancelled`.
- **Hallazgo:** `open·correction_in_progress·capa_open·pending_verification·
effective·not_effective·closed`; clasificación (mayor/menor/observación/mejora/
  fortaleza/evidencia insuficiente); severidad.
- **Resultado por requisito:** conforme·parcial·no_conforme·no_aplica·no_evaluado·
  evidencia_insuficiente·verificacion_campo (se conservan los dos últimos para
  evitar conclusiones forzadas).
- **Permisos:** owner/admin gestión total; evaluator actúa como auditor cuando
  está asignado (ejecuta checklist, evidencia, hallazgos, informe, verificación);
  viewer solo lectura. Validado en servidor. **Independencia:** al agregar un
  auditor que también es auditado se marca “posible conflicto de independencia” y
  se pide justificación (sin decisiones automáticas).

## Plan, agenda, checklist y ejecución

Plan con objetivo/alcance/criterios/equipo/agenda/alcance. Checklist por snapshot;
**modo ejecución** enfocado (`/dashboard/audits/[id]/execute`) con navegación,
filtros pendiente/evaluado, resultado por requisito, evidencia, entrevista y
progreso `N/M requisitos evaluados`. Cambios de resultado en historial append-only.

## Evidencia y entrevistas

Evidencia objetiva tipada (documento/registro/entrevista/observación/foto/
medición/sistema/muestra) con documento/versión/archivo; archivos con metadatos y
checksum (binarios fuera de PostgreSQL, reusa `document-storage`). Entrevistas sin
datos personales innecesarios.

## Hallazgos, CAPA y tareas

Hallazgo con estructura **Requisito → Evidencia objetiva → Brecha →
Clasificación**. Conversión a **CAPA** (`sourceType = audit_nc`) con precarga
controlada y vínculo bidireccional (sin duplicar el workflow CAPA; el seguimiento
consulta la CAPA existente) y a **tarea global** (TASK-009, `source_type =
audit_finding`). Relaciones clickeables al origen.

## Preparación

`/dashboard/audits/preparation`: matriz requisito–evidencia y **índice OPERATIVO**
de preparación (no certificación). Fórmula documentada: `índice = Σ peso(estado) /
requisitos aplicables` (excluye “No aplica”); preparado=1, parcial/requiere
revisión=0.5, evidencia vencida=0.25, sin evidencia=0. Brechas: sin evidencia,
requiere revisión, hallazgos abiertos, críticos no preparados.

## Informe y seguimiento

Informe imprimible (`/report`, CSS de impresión) con portada, objetivo/alcance/
criterios, resumen de resultados, requisitos evaluados, hallazgos y conclusión —
con la nota de que la decisión es del auditor. Seguimiento por hallazgo (estado,
verificación, eficacia) consultando la CAPA cuando aplica.

## Dashboard

Sección “Auditorías” con métricas reales (programadas, en seguimiento, vencidas,
hallazgos abiertos/mayores, próxima auditoría) en tarjetas clickeables y alertas
de hallazgos abiertos. No inventa Sentinel Score, IA ni certificaciones.

## RLS, seed y pruebas

RLS en las 23 tablas + grants; historiales append-only. Seed idempotente
`seedAudits()`: 2 programas, 4 auditorías (en ejecución/planeada/seguimiento/
cerrada), checklist con snapshot y resultados variados, 3 hallazgos (mayor/menor
con CAPA/observación cerrada), 2 certificaciones, contadores de folio. Sin datos
personales reales.

Pruebas: dominio (`tests/audit-state.test.ts`), BD
(`tests/db/audits-access.test.ts`: folios, estados, snapshot inmutable, hallazgos→
CAPA/tarea, preparación, RLS, aislamiento, FK compuesta) y `schema-integrity`
ampliada con FK anti-cruce, triggers append-only, RLS, políticas y grants de
auditoría.

## Reconstrucción desde cero

`docker compose down -v` → `db:up` → `db:generate` → `db:migrate` → `db:seed` ×2 →
`test:db`, **sin SQL manual** (ver `docs/operations/DATABASE-REBUILD.md` y
`docs/audits/AUDIT-WORKFLOW.md`).

## Limitaciones y pendientes (IA futura)

Sin IA, sin dictamen de certificación, sin contenido normativo externo. El modelo
queda preparado para que una IA futura asocie por requisito evidencia esperada/
encontrada, documento/versión, resultado humano, confianza y fuentes — **sin
campos de IA añadidos ahora**. Pendientes: perfiles de clasificación por esquema,
generación PDF avanzada, agenda con reordenamiento drag-and-drop.
