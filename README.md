# GAPSI Sentinel

SaaS B2B para diagnóstico, seguimiento y mejora de sistemas de calidad e inocuidad alimentaria.

## Estado actual

El proyecto inicia con un producto mínimo comercial:

**Diagnóstico Digital GAPSI Sentinel**

La primera versión NO intenta construir toda la plataforma. Su objetivo es permitir:

1. Registrar una organización.
2. Crear un diagnóstico.
3. Responder un cuestionario.
4. Adjuntar o referenciar evidencias.
5. Calcular cumplimiento y riesgo.
6. Mostrar resultados por requisito.
7. Generar un reporte ejecutivo.
8. Registrar oportunidades de seguimiento comercial.

## Principio rector

Cada incremento debe poder demostrarse, probarse y potencialmente venderse.

## Documentación

- `AGENTS.md`: reglas obligatorias para cualquier agente.
- `docs/product/PRODUCT_BRIEF.md`: alcance y reglas del producto.
- `docs/product/DOMAIN_GLOSSARY.md`: términos del dominio.
- `docs/architecture/ARCHITECTURE_DECISIONS.md`: decisiones técnicas iniciales.
- `docs/tasks/TASK-001.md`: primera tarea ejecutable.
- `docs/DEFINITION_OF_DONE.md`: criterio obligatorio de terminación.

## Flujo de trabajo

1. Leer `AGENTS.md`.
2. Leer el documento de tarea correspondiente.
3. Inspeccionar el repositorio antes de modificarlo.
4. Proponer un plan breve.
5. Implementar solamente el alcance autorizado.
6. Ejecutar validaciones y pruebas.
7. Resumir cambios, riesgos y pendientes.

## Desarrollo local (TASK-001)

Esta es la **fundación técnica** del MVP. Aún no incluye cuestionario, motor de
puntuación ni producción (ver `docs/tasks/TASK-001.md`).

### Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

### Instalación

```bash
npm install
cp .env.example .env.local   # en Windows PowerShell: Copy-Item .env.example .env.local
```

El archivo `.env.example` no contiene secretos reales.

### Comandos

| Acción     | Comando             | Descripción                                |
| ---------- | ------------------- | ------------------------------------------ |
| Desarrollo | `npm run dev`       | Levanta la app en `http://localhost:3000`. |
| Lint       | `npm run lint`      | ESLint (config de Next) + Prettier.        |
| Typecheck  | `npm run typecheck` | `tsc --noEmit` con TypeScript estricto.    |
| Pruebas    | `npm test`          | Vitest (unitarias e integración).          |
| Build      | `npm run build`     | Compilación de producción de Next.js.      |
| Formato    | `npm run format`    | Aplica Prettier al repositorio.            |

### Rutas

- `/` — pública, carga sin autenticación.
- `/login` — inicia una sesión **de desarrollo** (simulada, no es un proveedor real).
- `/dashboard` — privada; un usuario anónimo es redirigido a `/login`.

### Autenticación

La autenticación está desacoplada tras la interfaz `AuthProvider`
(`src/features/auth`). En TASK-001 solo existe el adaptador `dev`, que simula una
sesión mediante una cookie firmada en base64 para demostrar el acceso protegido.
El proveedor real se añadirá en una tarea futura sin tocar el dominio.

### Estructura

```text
src/
  app/            # rutas (pública, login, dashboard)
  features/
    auth/         # adaptador de autenticación desacoplado
    organizations/# tipos y scoping por organización (multi-tenant)
  server/         # acceso a sesión en servidor
  middleware.ts   # guard de rutas privadas (en servidor)
tests/            # pruebas unitarias e integración
```

### Integración continua

`.github/workflows/ci.yml` ejecuta lint, typecheck, pruebas y build en cada
push a `main` y en cada pull request.
