# GAPSI Regulatory Intelligence (ARCH-004)

Documento de arquitectura. **No implementa** módulos, migraciones, UI,
notificaciones reales, scraping ni IA. Define la **vigilancia normativa** de GAPSI
Sentinel: cómo se detecta, cura, publica, aplica y da seguimiento a un cambio
normativo sin reescribir el pasado ni declarar incumplimientos automáticos.

Hub: `COMPLIANCE-PLATFORM-ARCHITECTURE.md`. Catálogo: `MASTER-COMPLIANCE-CATALOG.md`.

## 1. Componentes

**GAPSI Regulatory Intelligence** =

catálogo maestro · versionado · **detección de cambios** · **revisión editorial** ·
**publicación** · **aplicabilidad** · **impact assessment** · **notificaciones** ·
**seguimiento de implementación**.

No implica IA obligatoriamente (ADR §12, decisión 15). La IA, si se añade, es un
asistente con **revisión humana obligatoria** (§11).

## 2. Regulatory Change (cambio normativo)

Entidad conceptual `REGULATORY CHANGE` (curada por GAPSI, global):

- **framework · versión anterior · versión nueva**;
- **fecha de detección · fecha de publicación · fecha de entrada en vigor**;
- **fuente** (oficial);
- **resumen**;
- **estado editorial GAPSI** (§4);
- **relevancia**.

ARCH-004 **no** implementa scraping ni conexión a fuentes oficiales: la detección es
un insumo editorial.

## 3. Requirement Change (cambio de requisito)

Cada `REGULATORY CHANGE` se descompone en ítems `REQUIREMENT CHANGE`. Tipos:

**Nuevo · Modificado · Eliminado · Renumerado · Sustituido · Aclaración · Editorial
· Cambio de alcance.**

Se relaciona `old_requirement ↔ new_requirement` cuando corresponde (linaje;
`requirement_versions` en `MASTER-COMPLIANCE-CATALOG.md`).

## 4. Flujo editorial GAPSI

```
Detectado → En revisión → Validado → Publicado
```

Roles futuros: **Editor · Revisor · Aprobador.** Un cambio **no** se notifica como
oficial sin validación. La publicación editorial actualiza el **catálogo maestro**
(no la adopción de ningún cliente).

## 5. Organization Regulatory Update (seguimiento por cliente)

Cuando una actualización publicada afecta a un cliente (por suscripción), se crea
una **instancia de seguimiento** `ORGANIZATION REGULATORY UPDATE`
(**tenant-scoped**). Estados:

**Nueva · Pendiente de revisión · En evaluación · Impacto evaluado · Acciones
asignadas · En implementación · Verificada · Cerrada · No aplicable.**

**No** modifica evidencias ni evaluaciones históricas del cliente.

## 6. Impact Assessment (evaluación de impacto)

```
Cambio → requisitos afectados → organizaciones/sitios suscritos → aplicabilidad
       → objetos vinculados → impacto → acciones
```

Los **objetos vinculados** (relaciones futuras) pueden ser: documentos, evidencias,
diagnósticos, riesgos, auditorías, hallazgos, CAPA, capacitación, proveedores,
activos, proyectos y controles. Vista futura de impacto (ilustrativa):

```
Actualización NOM-XXXX → Planta Monterrey
  4 documentos · 2 procedimientos · 1 riesgo · 3 controles · 1 auditoría · 12 evidencias
```

## 7. No declarar incumplimiento automático

Una actualización normativa genera **«Revisión requerida»**, **nunca**
«Incumplimiento». La conformidad se determina **solo por evaluación**, con estados:

**Conforme · Parcial · No conforme · No aplicable · No evaluado.**

Esto es coherente con el principio de CORE-ALIGN-003: el sistema describe y sugiere;
la conformidad y la causa las decide una persona.

## 8. Vigilancia normativa (ruta futura, sin UI ahora)

- **Ruta futura:** `/dashboard/compliance/updates` · **Nombre visible:** «Vigilancia
  normativa». **No se implementa UI en ARCH-004.**
- **Vistas:** Nuevas · Pendientes de revisión · En implementación · Cerradas · No
  aplicables.
- **Filtros:** sector · framework · versión · sitio · autoridad · jurisdicción ·
  relevancia · estado.

## 9. Notificaciones (integración futura)

Se integrará con el Core de notificaciones (aún futuro). No se crean canales nuevos.
Ejemplo conceptual:

```
Actualización normativa — NOM-XXXX
  2 requisitos nuevos · 3 modificados · 1 renumerado
  Aplica potencialmente a: Planta Monterrey
  [Revisar actualización]
```

Canales futuros: Inbox Sentinel · Email · Push · otros. Una notificación **no**
declara conformidad; enlaza a la instancia de seguimiento (§5).

## 10. Periodicidad, jurisdicción, fuente e historial

- **Periodicidad** (por requisito): continuo · mensual · trimestral · semestral ·
  anual · por evento · por renovación · sin frecuencia fija. Alimenta (futuro)
  tareas, alertas, vencimientos y dashboards.
- **Jurisdicción** (requisitos legales): país · estado/provincia ·
  municipio/localidad · autoridad · jurisdicción adicional. **México primero**, sin
  hardcodearlo.
- **Fuente/trazabilidad:** título oficial · identificador · organismo emisor ·
  URL/fuente · documento fuente · fechas de publicación/vigencia · versión. Origen
  **auditable**.
- **Historial inmutable:** nunca se reescribe un diagnóstico, auditoría, evidencia,
  hallazgo, decisión o evaluación histórica. El catálogo maestro y la adopción del
  cliente evolucionan **hacia adelante**, conservando lo anterior.

## 11. IA futura (no ahora)

Preparado para que, más adelante, la IA pueda: comparar versiones, resumir cambios,
sugerir relaciones/crosswalks, sugerir impacto, buscar evidencia y explicar
requisitos. La IA **no** decide por sí sola: aplicabilidad legal, cumplimiento,
cierre de requisito, causa raíz ni conformidad regulatoria. **Revisión humana
obligatoria.** ARCH-004 no implementa IA.

## 12. Entidades conceptuales (propuesta, sin migración)

`regulatory_changes` · `regulatory_change_items` (= requirement changes) ·
`organization_regulatory_updates` · `regulatory_impact_assessments` ·
`regulatory_update_actions`. Nombres tentativos; se prioriza reutilizar el modelo
existente. **Ninguna se implementa en ARCH-004.**

## 13. Ejemplo extremo a extremo

Framework versión **A** activa en «Planta Monterrey»; GAPSI publica versión **B**:

1. GAPSI registra el `regulatory_change` (A→B) y sus `requirement_changes`.
2. Tras validación editorial, se **publica** al catálogo maestro.
3. Se crea una `organization_regulatory_update` para cada tenant suscrito.
4. Sentinel **notifica** y muestra las **diferencias**.
5. Identifica los **objetos relacionados** (documentos, controles, auditorías…).
6. El responsable **evalúa aplicabilidad** (no automática).
7. Crea **acciones** (tareas/proyecto/CAPA) según corresponda.
8. **Implementa** y **verifica**.
9. **Cierra** la instancia de seguimiento.
10. **Conserva** intacta la historia de la versión A (evaluaciones, evidencia).

## 14. Qué NO hace este documento

No importa textos de normas, no hace scraping, no se conecta al DOF/ISO, no crea IA,
no crea catálogo/notificaciones productivas, tablas, migraciones ni dashboards. Fija
la arquitectura de la vigilancia normativa.
