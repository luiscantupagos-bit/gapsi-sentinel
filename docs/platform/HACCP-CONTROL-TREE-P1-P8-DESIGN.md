# HACCP-CONTROL-TREE-P1-P8 — Árbol de decisión real P1–P8

## Objetivo

Reemplazar el árbol de decisión provisional de 3 preguntas por el árbol **P1–P8**
transcrito fielmente del plan HACCP real (hoja «Seleccion Medidas Control» del
Excel `PLHACCP.001`). El propósito es dejar **evidencia auditable del cómo se tomó
la decisión** de clasificar cada medida de control (PCC / PPRO / PPR / Controlado
en otra etapa), guardando junto a cada respuesta el **texto** de la pregunta como
snapshot inmutable.

No se inventan preguntas ni criterios: el texto de P1–P8 proviene del documento del
usuario. Las especificaciones estructuradas de materias primas / producto terminado
se cubren por las fichas técnicas del sistema y **no** forman parte de esta tarea.

## Alcance

- **Modelo de decisión** (`src/features/haccp/haccp-control.ts`): nueva definición
  `DEFAULT_DECISION_TREE` con `key: 'iso22000-p1p8'`, `version: '1'`, `start: 'P1'`
  y 8 preguntas. El resolver genérico `resolveClassification` **no cambia**.
- **Nuevo desenlace** `controlled_elsewhere` («Controlado en otra etapa») para los
  casos P3/P4/P5 = Sí (el peligro se controla en una etapa posterior).
- **Snapshot del texto**: `ResolveResult.path` pasa de `AnswerRecord[]` a
  `PathRecord[]` (`{ questionId, questionText, answer }`). El servidor guarda el
  texto de la pregunta con cada respuesta; al leer, prefiere el texto snapshot y
  cae al árbol vigente sólo para evaluaciones antiguas sin snapshot.
- **Migración aditiva**: se amplía la CHECK de `classification` para admitir
  `controlled_elsewhere` (DROP CONSTRAINT + ADD CONSTRAINT; 0 DROP TABLE / 0 DROP
  COLUMN).
- **UI**: opción de override «Controlado en otra etapa»; badge neutro; el wizard
  camina las 8 preguntas sin cambios de lógica (usa el mismo resolver puro).

## El árbol P1–P8

| Id  | Pregunta (texto real)                                                                                                                           | Sí                           | No                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| P1  | ¿El grado de control aplicado a esta medida es suficientemente riguroso?                                                                        | P2                           | **Revisión requerida** (modificar grado de control/medida/proceso/producto y reevaluar) |
| P2  | ¿Ha sido la medida de control diseñada específicamente para eliminar o reducir a un nivel aceptable la presencia del peligro?                   | P6                           | P3                                                                                      |
| P3  | ¿Existe alguna etapa de proceso o medida de control subsecuente que elimine o reduzca a niveles aceptables el peligro identificado?             | **Controlado en otra etapa** | P4                                                                                      |
| P4  | ¿Hay efectos de sinergia con otras medidas de control o etapas de proceso que eliminen o reduzcan a niveles aceptables el peligro identificado? | **Controlado en otra etapa** | P5                                                                                      |
| P5  | ¿El uso esperado por el consumidor elimina o reduce a niveles aceptables el peligro identificado?                                               | **Controlado en otra etapa** | P7                                                                                      |
| P6  | ¿Se garantiza la inocuidad aún cuando la medida de control falle?                                                                               | **PPR**                      | P7                                                                                      |
| P7  | Para esta medida de control, ¿se pueden establecer límites críticos?                                                                            | P8                           | **PPRO**                                                                                |
| P8  | ¿Se pueden realizar correcciones de manera inmediata cuando falla la medida de control?                                                         | **PCC**                      | **PPRO**                                                                                |

> El texto exacto de cada pregunta vive en `DEFAULT_DECISION_TREE.questions[].text`
> y se transcribió literalmente del Excel del usuario. Esta tabla es un resumen.

### Desenlaces

- **PCC** — Punto Crítico de Control (requiere límite crítico + monitoreo + acción correctiva).
- **PPRO** — Programa de Prerrequisitos Operativo (requiere criterio de acción + monitoreo).
- **PPR** — Programa de Prerrequisitos (medida o registro relacionado).
- **Controlado en otra etapa** — el peligro se gestiona en una etapa distinta; no genera plan aquí.
- **Revisión requerida** — P1 = No: el grado de control no es suficientemente riguroso; se modifica el grado de control / la medida / el proceso / el producto y se reevalúa.

## Validación contra el plan real (Salmonella)

Camino del plan real: **P1 Sí → P2 Sí → P6 No → P7 Sí → P8 No = PPRO** (coincide con
«PPRO#1» del documento). Este camino es el que carga el seed de demostración y una
prueba unitaria y una de integración lo verifican.

## Snapshot de metodología (evidencia)

Cada `haccp_control_assessment` guarda:

- `methodKey = 'iso22000-p1p8'`, `methodVersion = '1'` — qué árbol se usó.
- `answers` (JSON) = arreglo de `PathRecord` con `{ questionId, questionText, answer }`
  — el camino recorrido **con el texto de la pregunta vigente al momento de decidir**.

Así, si el árbol cambia de versión en el futuro, las evaluaciones ya guardadas
siguen mostrando la pregunta tal como se respondió (evidencia autocontenida e
inmutable, coherente con «publicado = inmutable»).

## Migración

`prisma/migrations/20261003000000_haccp_control_tree_p1p8/migration.sql`

```sql
ALTER TABLE "haccp_control_assessments" DROP CONSTRAINT IF EXISTS "haccp_control_assessments_classification_check";
ALTER TABLE "haccp_control_assessments" ADD CONSTRAINT "haccp_control_assessments_classification_check"
  CHECK ("classification" IN ('ppr','ppro','pcc','other','review_required','controlled_elsewhere'));
```

Aditiva: **0 DROP TABLE, 0 DROP COLUMN**. DROP CONSTRAINT sobre una CHECK se considera
aditivo (amplía el dominio permitido; no destruye datos).

## Pruebas

- **Unitarias** (`tests/haccp-control.test.ts`): resolver del árbol P1–P8 (Salmonella→PPRO,
  →PCC, PPR, controlled_elsewhere vía P3/P4/P5, review_required, incompleto→nextQuestionId,
  snapshot de texto en `path`).
- **Integración** (`tests/db/haccp-control.test.ts`): snapshot `methodKey='iso22000-p1p8'`,
  camino con texto, clon conserva el camino, override, inmutabilidad, aislamiento.
- **UI** (`tests/haccp-control-ui.test.ts`): sin cambios de contrato.

## No incluido

- Especificaciones estructuradas de MP/PT (cubiertas por fichas técnicas).
- Cambios al resolver genérico (se reutiliza tal cual).
- Cualquier push / PR / merge (pendiente de autorización explícita).
