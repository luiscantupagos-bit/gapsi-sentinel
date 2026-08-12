# Catálogo Maestro de Cumplimiento (ARCH-004)

Documento de arquitectura. **No implementa** tablas, migraciones ni UI. Define el
**Master Compliance Catalog** administrado por GAPSI y cómo las organizaciones lo
**adoptan** sin poder modificarlo. Hub: `COMPLIANCE-PLATFORM-ARCHITECTURE.md`.
Modelo sector/framework/capability: `SECTOR-FRAMEWORK-CAPABILITY-MODEL.md`.

## 1. Qué es

El **Catálogo Maestro** es el contenido normativo curado por GAPSI: sectores,
familias, frameworks, versiones, estructura (capítulos/secciones/cláusulas) y
requisitos, con su procedencia y relaciones. Es **global** y **de solo lectura**
para los tenants. Las organizaciones **adoptan** (suscriben) frameworks y generan
sus propios datos de evaluación; **nunca** editan el maestro.

> Regla de oro (ADR §12, decisión 11): **agregar contenido regulatorio o un
> framework nuevo NO debe requerir cambios de React/Core** cuando solo se agrega
> contenido. El catálogo es **dato**, no código.

## 2. Contenido del catálogo

El maestro debe poder contener:

- **sectores** y **familias** de frameworks;
- **frameworks** y sus **versiones**;
- **capítulos · secciones · cláusulas · requisitos · subrequisitos**;
- **capacidades vinculadas** (M:N framework/requisito ↔ capability);
- **jurisdicción · organismo emisor · fuente oficial**;
- **fecha de publicación · fecha de vigencia · estado**;
- **reemplazos · relaciones · equivalencias (crosswalk)**;
- **historial** de cambios del propio catálogo.

## 3. Reutilización del modelo actual (NO duplicar)

El modelo de plantillas/diagnósticos ya aporta la columna vertebral. Se **reutiliza
y extiende**; no se reemplaza.

| Concepto de catálogo             | Tabla actual reutilizable                                        | Evolución propuesta                                                               |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Framework / esquema              | `assessment_frameworks` (`scope` master/organization)            | + `sector_id`, `family`, `framework_type`, `issuer`, `jurisdiction`, `source_url` |
| Versión de framework (congelada) | `template_versions` (`version_number`, `status`, `content_hash`) | + estados de vigencia y fechas (`effective_date`, `transition_end`)               |
| Capítulo / sección               | `template_sections`                                              | sin cambios estructurales                                                         |
| Requisito                        | `template_requirements` (`is_critical`)                          | + `requirement_type`, linaje entre versiones (`requirement_versions`)             |
| Criterio evaluable               | `template_questions` (+ `template_answer_options`)               | sin cambios estructurales                                                         |
| Evaluación histórica inmutable   | `diagnostics` + `diagnostic_answers` + snapshots de auditoría    | intactos; **no** se recalculan                                                    |
| Certificación                    | `organization_certifications`                                    | referencia a la suscripción de framework                                          |

Ya resuelto por el modelo actual: **catálogo maestro vs copia de organización**
(`scope`), **múltiples versiones**, **congelado inmutable** (`content_hash`,
snapshots). No se re-crea nada de esto.

## 4. Versionado de framework (inmutable)

Regla crítica: **NUNCA sobrescribir requisitos publicados.** `Framework A:2015` y
`Framework A:2026` **coexisten**. Una evaluación histórica conserva: versión
utilizada, requisito evaluado, evidencia, resultado y fecha. **No se recalcula el
pasado** al publicar una versión nueva.

El **linaje** de un requisito entre versiones (nuevo/modificado/renumerado/
sustituido…) se documenta en `REGULATORY-INTELLIGENCE.md` (§Requirement change) y se
materializaría en `requirement_versions` + `requirement_changes`.

## 5. Estados de framework/versión

Estados posibles (sin sobreoptimizar el `enum` todavía):

**Borrador · Publicado · Próximo a vigencia · Vigente · En transición · Sustituido
· Retirado.**

Las fechas (`published_at`, `effective_date`, `transition_end`, `superseded_by`)
alimentan la vigilancia normativa y los avisos de transición.

## 6. Catálogo maestro ≠ adopción del cliente

Dos planos distintos que **no** deben confundirse:

| Plano                    | Alcance            | Quién administra  | Ejemplos de objetos                                         |
| ------------------------ | ------------------ | ----------------- | ----------------------------------------------------------- |
| **Catálogo maestro**     | Global             | GAPSI (editorial) | frameworks, versiones, requisitos, crosswalks               |
| **Adopción del cliente** | Tenant (org/sitio) | La organización   | suscripciones, aplicabilidad, evaluaciones, evidencia, CAPA |

## 7. Suscripción de framework (adopción)

`FRAMEWORK SUBSCRIPTION` — cómo una organización/sitio adopta un framework:

- **activar** framework + **versión** adoptada;
- **fecha de adopción**;
- **sitios** cubiertos;
- **estado** (activo/suspendido/retirado);
- **periodo de transición** (al migrar de versión);
- **suspensión** y **retiro**.

No confundir con el catálogo: la suscripción es **tenant-scoped**. Migrar de
`A:2015` a `A:2026` crea/mueve la suscripción sin borrar la historia de la anterior.

## 8. Matriz de aplicabilidad

`APPLICABILITY REGISTER` — por organización/sitio y por requisito:

- **framework · versión · requisito**;
- **estado:** aplicable · no aplicable · pendiente;
- **justificación · responsable · fecha de evaluación · próxima revisión**.

Una misma empresa puede tener **distintos requisitos aplicables en distintos
sitios**. La aplicabilidad es una **decisión controlada** (humana), nunca inferida
(ADR §12, decisión 8).

## 9. Evidencia reutilizable

Una evidencia se relaciona con **varios requisitos** (M:N) sin duplicar el archivo
(`requirement_evidence_links` propuesto). Detalle y ejemplo en
`SECTOR-FRAMEWORK-CAPABILITY-MODEL.md` §11.

## 10. Modelo de datos — PROPUESTA (sin migración)

**ARCH-004 no crea migración ni tablas.** Nombres tentativos; se prioriza reutilizar
lo existente. Entidades conceptuales a evaluar en tareas `REG-*`:

- `compliance_sectors` — sectores configurables.
- `compliance_frameworks` — (evolución de `assessment_frameworks`) + sector,
  familia, tipo, emisor, jurisdicción, fuente.
- `compliance_framework_versions` — (evolución de `template_versions`) + estados y
  fechas de vigencia.
- `compliance_sections` / `compliance_requirements` — (evolución de
  `template_sections` / `template_requirements`) + `requirement_type`.
- `requirement_versions` — linaje de un requisito entre versiones.
- `requirement_relationships` / `requirement_crosswalks` — equivalencias editoriales.
- `compliance_capabilities` + `framework_capabilities` — capacidades y su relación
  M:N con frameworks/requisitos.
- `framework_subscriptions` — adopción por org/sitio.
- `requirement_applicability` — matriz de aplicabilidad por org/sitio.
- `requirement_evidence_links` — evidencia reutilizable M:N.

(Las entidades de cambio/impacto/actualización viven en
`REGULATORY-INTELLIGENCE.md`.) **Ninguna se implementa aquí.**

## 11. Seguridad / multitenancy

- **Catálogo maestro:** objetos con `scope = master` y `organization_id = NULL`;
  **SELECT** para `gapsi_app`, escritura reservada al rol editorial de GAPSI.
- **Adopción/evaluación/impacto:** **tenant-scoped** (RLS por
  `organization_id = fn_current_org()`, como hoy).
- Un tenant **no puede**: modificar el catálogo global; consultar la evaluación,
  aplicabilidad o impacto de otro tenant; modificar la actualización de otro tenant.
- La adopción se materializa en **filas de la organización** (suscripción/copia);
  no se lee el maestro con el contexto de otro tenant. **No se rompe la RLS
  existente.**

## 12. Qué NO hace este documento

No importa textos de normas, no hace scraping, no se conecta al DOF/ISO, no crea
catálogo productivo, tablas, migraciones ni pantallas. Define la estructura y las
reglas del catálogo y su adopción.
