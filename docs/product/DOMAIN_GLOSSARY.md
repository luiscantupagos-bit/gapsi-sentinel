# Glosario del dominio

- **Organización:** empresa cliente que utiliza GAPSI Sentinel.
- **Sitio:** planta, almacén, sucursal o instalación evaluada.
- **Marco de evaluación:** conjunto estructurado de criterios, por ejemplo un diagnóstico interno basado en HACCP.
- **Versión de plantilla:** copia inmutable del cuestionario usada por un diagnóstico.
- **Sección:** agrupación de requisitos.
- **Requisito:** condición que debe evaluarse.
- **Pregunta:** mecanismo mediante el cual se obtiene una respuesta.
- **Respuesta:** dato proporcionado por el evaluador.
- **Evidencia:** archivo, referencia, nota o registro que respalda una respuesta.
- **Puntuación:** valor calculado según una regla documentada.
- **Brecha:** diferencia entre el estado observado y el esperado.
- **Hallazgo crítico:** incumplimiento que eleva el riesgo sin depender únicamente del promedio.
- **No aplica:** respuesta justificada que debe excluirse del denominador cuando la plantilla lo permita.
- **Diagnóstico:** evaluación ejecutada para una organización y sitio en una fecha determinada.
- **Reporte ejecutivo:** resumen de cumplimiento, riesgo, brechas y prioridades.

## Gestor de tareas y proyectos (TASK-009)

- **Tarea (global):** unidad de trabajo con responsable, fechas, prioridad,
  estado y avance. Puede ser **nativa** (manual/de proyecto/convertida, fuente de
  verdad en `tasks`) o **agregada** (leída en vivo de otro módulo — CAPA,
  documental, AMEF — sin copiarse).
- **Proyecto:** iniciativa transversal (mejora continua, cumplimiento,
  certificación, etc.) con responsable, hitos, tareas y avance.
- **Hito:** punto de control de un proyecto con fecha objetivo y estado
  (pendiente, en riesgo, alcanzado, vencido, cancelado).
- **Dependencia:** relación finish-to-start entre tareas (obligatoria o
  informativa); una dependencia obligatoria no completada bloquea el inicio.
- **Origen / trazabilidad:** módulo del que proviene una tarea agregada o
  convertida (`source_type`/`source_id`); siempre abre su detalle real.
