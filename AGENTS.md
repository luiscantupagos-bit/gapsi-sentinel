# AGENTS.md — GAPSI Sentinel

## 1. Misión

Construir GAPSI Sentinel como un SaaS B2B seguro, mantenible y comercializable para calidad e inocuidad alimentaria.

La prioridad inicial es entregar el **Diagnóstico Digital GAPSI Sentinel**. No construir módulos futuros sin una tarea explícita.

## 2. Reglas obligatorias

- Lee `README.md`, `docs/DEFINITION_OF_DONE.md` y el archivo de tarea antes de modificar código.
- Inspecciona el repositorio y reutiliza patrones existentes.
- No inventes requisitos, campos, normas, precios ni reglas de negocio.
- Si una decisión no está documentada, registra el supuesto y elige la alternativa más simple y reversible.
- No implementes características fuera del alcance de la tarea.
- No elimines archivos, migraciones o datos sin autorización explícita.
- No ejecutes acciones destructivas contra producción.
- Nunca incluyas secretos, tokens, contraseñas o datos personales reales en el repositorio.
- Mantén separación estricta entre organizaciones.
- Todo acceso a datos debe considerar `organization_id`.
- Las reglas sensibles deben validarse en servidor; no confiar solamente en el cliente.
- Los cálculos de cumplimiento deben ser deterministas y estar cubiertos por pruebas.
- Las acciones relevantes deben poder auditarse.
- Evita dependencias innecesarias.
- Prefiere código sencillo, tipado y legible sobre abstracciones prematuras.

## 3. Método de trabajo

Antes de implementar:

1. Resume el objetivo.
2. Enumera archivos que esperas modificar.
3. Señala riesgos o supuestos.
4. Define cómo comprobarás el resultado.

Después de implementar:

1. Ejecuta lint, typecheck, pruebas y build disponibles.
2. Informa exactamente qué cambió.
3. Informa las pruebas ejecutadas y sus resultados.
4. Menciona riesgos, deuda o pasos manuales.
5. No declares éxito si una validación no pudo ejecutarse.

## 4. Arquitectura y dominio

- Sigue `docs/architecture/ARCHITECTURE_DECISIONS.md`.
- Usa el vocabulario de `docs/product/DOMAIN_GLOSSARY.md`.
- Cada requisito evaluable debe conservar trazabilidad entre:
  - marco o esquema;
  - sección;
  - requisito;
  - pregunta;
  - respuesta;
  - evidencia;
  - puntuación;
  - hallazgo o brecha.

## 5. Seguridad mínima

- Autenticación obligatoria para áreas privadas.
- Autorización por organización y rol.
- Validación de entrada en servidor.
- Archivos con acceso privado y URLs temporales cuando aplique.
- Registro de cambios importantes.
- No exponer errores internos al usuario.
- Aplicar principio de mínimo privilegio.

## 6. Calidad

Cada característica debe incluir, según corresponda:

- estados vacíos;
- carga;
- errores;
- validaciones;
- accesibilidad básica;
- diseño responsive;
- pruebas unitarias para reglas;
- pruebas de integración para flujos críticos;
- migración reversible o claramente documentada.

## 7. Git

- Una tarea lógica por rama.
- Commits pequeños y descriptivos.
- No mezclar refactorizaciones no relacionadas.
- No reescribir historia compartida.
- Antes de terminar, mostrar `git diff --stat` y resumir el diff.

## 8. Prohibiciones del MVP

No implementar todavía:

- CAPA completo;
- auditorías internas completas;
- gestión documental completa;
- facturación;
- pagos;
- múltiples normas comerciales finales;
- inteligencia artificial generativa;
- integraciones con ERP;
- aplicación móvil nativa;
- personalización white-label;
- automatizaciones complejas.

Solo pueden agregarse si existe una tarea aprobada.
