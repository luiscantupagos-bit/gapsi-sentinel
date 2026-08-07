# Flujo de auditoría (TASK-010)

Del programa al cierre. Sentinel **prepara, revisa, documenta y da seguimiento**;
la decisión y cualquier dictamen de certificación corresponden al auditor o
responsable autorizado.

## 1. Programa

`/dashboard/audits/programs` — plan anual (`PA-AAAA-####`). Estados:
`Borrador → Aprobado → Activo → Completado` (o `Cancelado` con motivo). Contiene
auditorías planeadas (calendario del programa) y las auditorías reales derivadas.

## 2. Auditoría

`AUD-AAAA-####`. Ciclo de estados:

```
Borrador → Planeada → Lista → En ejecución → Elaborando informe →
En revisión → Completada → En seguimiento → Cerrada
```

Reglas: no se ejecuta sin **alcance, criterios y auditor líder**; no se cierra con
hallazgos abiertos que requieren seguimiento salvo justificación; cancelar exige
motivo; **cerrada = solo lectura**; reapertura solo owner/admin.

## 3. Plan

Objetivo, alcance, criterios, equipo (con aviso de **posible conflicto de
independencia** si un auditor audita un proceso del que es responsable), agenda y
elementos de alcance (sitios/procesos/esquemas).

## 4. Checklist (snapshot inmutable)

Se genera desde una **versión de plantilla publicada** (`template_versions`).
Cada requisito se **congela** en `audit_requirement_snapshots` (framework/versión/
sección/código/texto/preguntas/criterio + puntero al requisito original). Aunque
la plantilla cambie después, la auditoría histórica no se altera.

## 5. Ejecución

`/dashboard/audits/[id]/execute` — modo enfocado: navegación por requisito,
filtros pendiente/evaluado, resultado (`Conforme · Parcial · No conforme · No
aplica · No evaluado · Evidencia insuficiente · Requiere verificación en campo`),
evidencia objetiva, entrevistas y observaciones en campo. Progreso `N/M`. Los
cambios de resultado se registran en historial append-only.

## 6. Hallazgos

`HAL-AAAA-####`. Estructura **Requisito → Evidencia objetiva → Brecha →
Clasificación** (mayor/menor/observación/mejora/fortaleza/evidencia insuficiente).
Desde un hallazgo se puede **crear/enlazar una CAPA** (origen `audit_nc`, vínculo
bidireccional) y **crear una tarea global** de seguimiento (TASK-009). El
seguimiento consulta la CAPA existente (no duplica su flujo).

## 7. Preparación

`/dashboard/audits/preparation` — matriz requisito–evidencia e **índice OPERATIVO**
(no certificación):

```
índice = round( 100 · Σ peso(estado) / requisitos aplicables )
peso: preparado=1 · parcial=0.5 · requiere_revisión=0.5 ·
      evidencia_vencida=0.25 · sin_evidencia=0 · no_aplica=excluido
```

Muestra brechas: sin evidencia, requiere revisión, hallazgos abiertos, críticos no
preparados. **No** afirma cumplimiento certificado.

## 8. Informe y cierre

Informe imprimible (`/report`) con portada, objetivo/alcance/criterios, resumen de
resultados, requisitos evaluados, hallazgos y conclusión del auditor. Cierre
cuando el seguimiento está resuelto (o con justificación autorizada).

## Reconstrucción desde base vacía

```bash
docker compose down -v
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed && npm run db:seed   # idempotente
npm run test:db                      # incluye schema-integrity
```

Sin SQL manual. Ver `docs/operations/DATABASE-REBUILD.md`.
