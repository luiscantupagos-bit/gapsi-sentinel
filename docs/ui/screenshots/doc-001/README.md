# Capturas DOC-001

Capturas de pantalla del motor documental estructurado. Iniciar el entorno
(`npm run dev`), iniciar sesión de demostración y capturar cada pantalla en
`docs/ui/screenshots/doc-001/` con el nombre indicado.

| Archivo                        | Pantalla                             | Ruta                                                          |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------- |
| `01_selector_tipo.png`         | Paso 1 — selección de tipo           | `/dashboard/documents/new/editor`                             |
| `02_identificacion.png`        | Paso 2 — identificación + código     | `/dashboard/documents/new/editor` (tras elegir Procedimiento) |
| `03_editor_procedimiento.png`  | Editor estructurado (procedimiento)  | `/dashboard/documents/{id}/structured`                        |
| `04_preview_procedimiento.png` | Vista previa (procedimiento)         | `/dashboard/documents/{id}/structured/preview`                |
| `05_editor_programa.png`       | Editor estructurado (programa)       | `/dashboard/documents/{id}/structured`                        |
| `06_preview_programa.png`      | Vista previa (programa)              | `/dashboard/documents/{id}/structured/preview`                |
| `07_documento_libre.png`       | Documento libre (editor enriquecido) | `/dashboard/documents/{id}/editor`                            |
| `08_documento_externo.png`     | Documento externo registrado         | `/dashboard/documents/{id}` (origin externo)                  |

Datos de demostración disponibles tras el seed: `PR-CA-001` (procedimiento,
vigente), `PG-CA-001` (programa), `PL-CA-001` (plan), `PO-DG-001` (política),
`EXT-01` (externo).

> Nota: en el entorno de agente el navegador integrado no puede escribir PNG al
> repositorio; estas capturas se generan manualmente. Las pantallas quedaron
> verificadas en vivo durante la implementación (ver
> `docs/tasks/DOC-001-IMPLEMENTATION-NOTES.md`).
