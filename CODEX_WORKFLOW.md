# Flujo recomendado en Codex

## Inicio

1. Crea un repositorio privado llamado `gapsi-sentinel`.
2. Copia todo este paquete en la raíz.
3. Haz el primer commit documental.
4. Abre la carpeta en Codex.
5. Inicia una tarea nueva usando `FIRST_PROMPT_FOR_CODEX.md`.

## Regla operativa

Nunca escribas “construye Sentinel completo”.

Cada tarea debe incluir:

- un objetivo;
- alcance;
- exclusiones;
- criterios de aceptación;
- validaciones;
- entrega esperada.

## Revisiones obligatorias

Después de cada tarea, solicita otro hilo o agente con este prompt:

> Revisa el diff de la tarea actual como revisor senior. No implementes funciones nuevas. Busca fallos de seguridad, aislamiento multi-tenant, pérdida de datos, requisitos incumplidos, código innecesario y pruebas faltantes. Clasifica hallazgos por severidad y propone correcciones mínimas.

## Secuencia inicial

1. TASK-001 — Fundación.
2. Revisión independiente de TASK-001.
3. Correcciones.
4. Diseño de TASK-002.
5. Aprobación humana del modelo.
6. Implementación de TASK-002.
7. Motor de puntuación.
8. Flujo de captura.
9. Resultados.
10. Reporte ejecutivo.
11. Piloto comercial.

## Uso de paralelismo

No usar varios agentes modificando la misma área al inicio.

El paralelismo se habilita cuando:

- existe una base estable;
- las tareas no comparten archivos;
- cada tarea tiene rama o worktree;
- hay pruebas que detecten integración rota.

## Seguridad

Antes de cualquier despliegue:

- respaldo;
- variables separadas;
- ambiente de staging;
- revisión de permisos;
- pruebas entre dos organizaciones;
- revisión de subida de archivos;
- revisión de logs;
- rollback documentado.
