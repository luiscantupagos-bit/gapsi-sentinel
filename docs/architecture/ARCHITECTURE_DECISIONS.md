# Decisiones de arquitectura iniciales

Estas decisiones son una propuesta inicial y deben confirmarse durante TASK-001.

## Stack propuesto

- Aplicación web full-stack: Next.js con TypeScript.
- UI: React y componentes accesibles.
- Base de datos: PostgreSQL.
- ORM: Prisma o alternativa equivalente bien soportada.
- Autenticación: proveedor compatible con organizaciones o implementación segura sobre el backend elegido.
- Validación: esquemas compartidos y validación obligatoria en servidor.
- Pruebas:
  - unitarias para cálculo y reglas;
  - integración para acceso y persistencia;
  - end-to-end para flujos críticos.
- Despliegue: plataforma administrada con ambientes separados.

## Forma del repositorio

Comenzar como monolito modular. No usar microservicios en el MVP.

Propuesta:

```text
src/
  app/
  components/
  features/
    auth/
    organizations/
    diagnostics/
    templates/
    evidence/
    reporting/
  lib/
  server/
  styles/
tests/
docs/
```

## Multi-tenancy

Modelo compartido con `organization_id` en tablas de negocio.

Requisitos:

- filtros obligatorios por organización;
- índices compuestos donde corresponda;
- autorización centralizada;
- pruebas negativas entre organizaciones;
- evitar recibir `organization_id` confiando ciegamente en el cliente.

## Puntuación

La puntuación debe implementarse como módulo de dominio puro, sin depender de UI ni base de datos.

Debe recibir una versión congelada de la plantilla y sus respuestas, y devolver:

- numerador;
- denominador;
- porcentaje;
- resultados por sección;
- preguntas excluidas;
- críticos incumplidos;
- nivel de riesgo;
- brechas priorizadas.

## Reportes

Primero generar una vista web imprimible. Posponer generación compleja de PDF hasta validar el contenido.

## Auditoría

Registrar como mínimo:

- creación y cambio de estado del diagnóstico;
- modificación de respuestas;
- carga o eliminación de evidencias;
- envío y revisión;
- cambios de roles.

## Decisiones aún abiertas

- proveedor de autenticación;
- proveedor de almacenamiento;
- hosting;
- ORM final;
- librería UI;
- estrategia exacta de PDF;
- correo transaccional.

Codex debe documentar comparaciones, pero no contratar ni configurar servicios de pago sin autorización.
