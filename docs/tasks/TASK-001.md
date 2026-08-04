# TASK-001 — Fundación técnica del MVP

## Objetivo

Crear la base ejecutable y verificable de GAPSI Sentinel sin implementar todavía el diagnóstico completo.

## Resultado esperado

Una aplicación local que:

1. arranca correctamente;
2. muestra una pantalla pública de inicio;
3. muestra una pantalla privada de dashboard protegida;
4. incluye estructura modular inicial;
5. contiene configuración de calidad y pruebas;
6. documenta cómo instalar, ejecutar y validar el proyecto.

## Alcance

- Inicializar el proyecto si el repositorio está vacío.
- TypeScript estricto.
- Formateo y lint.
- Variables de entorno mediante archivo de ejemplo.
- Página pública básica.
- Layout privado básico.
- Adaptador de autenticación desacoplado.
- Base para organizaciones sin implementar administración completa.
- Una prueba unitaria.
- Una prueba de integración o e2e del acceso protegido.
- CI para lint, typecheck, pruebas y build.
- Actualizar README con comandos reales.

## No incluido

- Cuestionario.
- Motor de puntuación.
- Base final de requisitos normativos.
- CAPA.
- Gestión documental.
- Pagos.
- Producción.
- Datos reales.
- Diseño visual final.

## Criterios de aceptación

- `npm install` o el gestor elegido funciona desde cero.
- Existe un comando documentado para desarrollo.
- Existe un comando documentado para lint.
- Existe un comando documentado para typecheck.
- Existe un comando documentado para pruebas.
- Existe un comando documentado para build.
- La ruta pública carga sin autenticación.
- La ruta privada redirige o bloquea al usuario anónimo.
- La arquitectura evita acoplar el dominio a un proveedor concreto.
- `.env.example` no contiene secretos reales.
- CI ejecuta las validaciones.
- Todas las validaciones disponibles terminan correctamente.

## Instrucción para Codex

Antes de modificar archivos:

1. Lee `AGENTS.md` y toda la documentación enlazada.
2. Inspecciona el entorno disponible.
3. Presenta un plan y las decisiones abiertas.
4. Elige opciones conservadoras y gratuitas para desarrollo local.
5. No configures producción ni servicios de pago.
6. Implementa.
7. Ejecuta todas las validaciones.
8. Entrega resumen, resultados y riesgos.
