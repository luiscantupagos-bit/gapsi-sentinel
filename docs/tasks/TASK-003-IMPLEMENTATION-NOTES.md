# TASK-003 — Notas de implementación (demo vertical del diagnóstico)

Demostración visible y navegable del diagnóstico sobre los datos del seed. No es
el producto final; el motor de puntuación definitivo (D13) sigue pendiente.

## Flujo implementado

Dashboard → abrir el diagnóstico de ejemplo → responder (sí/no, selección única,
texto, "No aplica" cuando la pregunta lo permite) → **Guardar avance** (persiste
en PostgreSQL) → progreso de captura → **Enviar diagnóstico** (`in_progress →
submitted`, bloquea edición) → **Resultado preliminar de demostración**.

## Rutas

- `/dashboard` — panel con organización activa, sitios, y tabla de diagnósticos
  (estado + avance) con acción "Abrir".
- `/dashboard/diagnostics/[diagnosticId]` — detalle + formulario de captura.
- `/dashboard/diagnostics/[diagnosticId]/results` — resultado preliminar.

## Reglas provisionales de cálculo

Aisladas en el módulo puro `src/features/diagnostics/scoring-preview.ts`
(`computePreview`), con pruebas (`tests/scoring-preview.test.ts`). **Provisional,
no D13**:

- sí/no y selección única usan la fracción de la opción (0..1);
- texto no puntúa; "No aplica" se excluye del denominador;
- conforme = fracción 1; no conforme = fracción < 1;
- cualquier crítico incumplido eleva el riesgo a `high` como mínimo;
- umbrales preliminares 90/75/50 (§12 de TASK-002-DATA-MODEL-PROPOSAL).

El resultado **se calcula al consultar** (determinista); no se persiste, para no
cerrar decisiones pendientes.

## Seguridad multi-tenant

Capa de datos con scoping en `src/server/diagnostics.ts`:

- la `organizationId` proviene siempre de la sesión de servidor;
- toda lectura/escritura se filtra por organización (recurso ajeno = "no
  encontrado");
- se rechaza asociar una pregunta que no pertenece a la plantilla del
  diagnóstico;
- un diagnóstico enviado no admite edición;
- las escrituras usan `withOrgContext` (fija `app.current_org` para RLS).

Pruebas de acceso/aislamiento en `tests/db/diagnostic-access.test.ts`.

## Datos del seed utilizados

Se amplió el seed a 2 secciones / 4 requisitos / 9 preguntas (2 críticas, 1
admite "No aplica") y un diagnóstico de ejemplo con respuestas parciales. La
sesión de desarrollo apunta a la organización del seed (ORG_A / Alimentos Demo A).

## Autenticación temporal

Sigue siendo el stub `dev` (cookie base64 sin firmar, solo desarrollo). Se ajustó
`DEMO_SESSION` para apuntar a ORG_A/USER_A y ver datos reales. No apto para
producción (`selectProvider()` impide `dev` en producción).

## Pasos de prueba manual

1. `npm run db:up && npm run db:migrate && npm run db:seed`.
2. `npm run dev` y abrir `http://localhost:3000`.
3. En `/login`, "Entrar como usuario de demostración".
4. En el panel, "Abrir" el diagnóstico de ejemplo.
5. Responder preguntas y "Guardar avance" (el progreso cambia).
6. "Enviar diagnóstico" (queda en modo solo lectura).
7. "Ver resultado preliminar".

## Limitaciones / pendientes

- Resultado preliminar, no el motor definitivo (D13).
- No hay creación libre de diagnósticos ni reapertura desde la interfaz.
- La app conecta como owner (RLS se prueba con `SET ROLE gapsi_app` en las
  pruebas); un despliegue real debe conectar como `gapsi_app`.
