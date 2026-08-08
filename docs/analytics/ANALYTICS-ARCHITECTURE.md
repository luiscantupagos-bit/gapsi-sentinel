# Arquitectura analítica (TASK-011)

Capa transversal de datos de calidad. **Un dato capturado una sola vez alimenta
todos los análisis.** Determinista, auditable, **sin IA/ML/predicción/causalidad
automática**.

## Flujo

```
Fuentes (fuente de verdad)                Capa común              Análisis (servidor)
──────────────────────────                ──────────              ───────────────────
quality_events (nativos) ───┐
CAPA / acciones           ──┤
hallazgos de auditoría    ──┤  loadUnifiedEvents  ┌─ KPI (kpi-engine)
tareas / proyectos        ──┼─►  + dedup + href  ─┼─ Pareto/tendencias (pareto-trends)
AMEF (renglones)          ──┤   → UnifiedEvent[]  ├─ Estadística (statistics/bivariate)
análisis de causa         ──┘                     ├─ Calidad de datos (data-quality)
                                                  └─ Alertas internas (alerts)
```

Los módulos **no se copian**: se agregan **en vivo** desde su fuente original. Un
registro agregado abierto desde Analítica navega a su módulo (campo `href`).

## `UnifiedEvent`

Registro analítico común: origen (`native`/`aggregated`/`converted`), fuente,
folio, `href`, tipo, categoría, estado normalizado
(`open/in_progress/closed/cancelled`), severidad, dimensiones textuales
(área/proceso/producto/máquina/turno/proveedor), métricas
(cantidad/unidades/costo/duración/NPR) y fechas ISO en UTC.

**Normalización de estado:** cada vocabulario de módulo se mapea al ciclo común
(`STATUS_MAP`). **Dedup:** un nativo con `source_type`/`source_id` reclama la
clave `${fuente}:${id}` y suprime el agregado equivalente.

## Deduplicación (para no contar dos veces)

| Situación                                   | Resultado                                                    |
| ------------------------------------------- | ------------------------------------------------------------ |
| Evento nativo manual                        | cuenta como `native`                                         |
| Evento nativo con `source_type`/`source_id` | cuenta como `converted`; **suprime** el agregado equivalente |
| Registro de módulo sin evento nativo        | cuenta como `aggregated`                                     |

## Precisión

Redondeo half-up; división entre cero → `null`; nulos ignorados en agregaciones;
muestra insuficiente marcada; fechas agrupadas en UTC. Ver
`docs/tasks/TASK-011-IMPLEMENTATION-NOTES.md`.

## Estadística

num↔num → Pearson + Spearman + regresión lineal; cat↔cat → contingencia + chi²;
cat↔num → ANOVA. Valores críticos **α=0.05 tabulados** (no se inventan valores-p).
Interpretación siempre prudente: **correlación no implica causalidad**.

## Privacidad

Dimensiones por defecto: turno/área/proceso/categoría — **no nombres
individuales**; sin rankings personales.

## Reglas de alerta (deterministas)

`kpi_off_target`, `kpi_increase`, `negative_trend`, `category_threshold`,
`recurrence`, `missing_data`. Cada alerta lleva `dedupeKey` estable → reejecutar
no crea duplicados. Mensajes prudentes ("mayor frecuencia… se requiere
investigación adicional antes de establecer causalidad").

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
