# C3 Sentinel — Estrategia PWA y offline (PLATFORM-001 §19-25)

> Diseño. **No se implementa PWA ni offline en esta fase.** PWA = PLATFORM-004;
> offline/sync = PLATFORM-005 (habilita DOC-004 en piso).

## 1. PWA-ready (§19)

La arquitectura debe soportar, sin implementarlos aún: `manifest`, íconos,
`display: standalone`, instalación, **service worker**, estrategia de caché, shell
offline y estrategia de actualización. `next.config.mjs` y layout se prepararán en
PLATFORM-004.

## 2. Offline PARCIAL (§20)

Decisión obligatoria: el offline será **parcial**. Primer objetivo: **capturar
nuevos registros en piso sin conexión**.

```
PWA → IndexedDB → cola de operaciones local → API de sync → PostgreSQL / Object Storage
```

## 3. Funciones offline (§21)

**Sí** (fase inicial): abrir formatos previamente sincronizados; crear registro;
guardar borrador; texto, números, checks, fechas, horas; catálogos cacheados; fotos
si el dispositivo lo permite.

**No** (fase inicial): publicar documentos; modificar usuarios; cambiar permisos;
modificar configuración crítica; aprobaciones críticas; administración general.

## 4. IDs offline e idempotencia (§22)

DOC-004 usará `clientGeneratedId` (UUID) generado **antes** de llegar al backend. El
sync es **idempotente**: el mismo `clientGeneratedId` **no** crea dos registros
(unicidad `(organizationId, clientGeneratedId)` en el destino).

## 5. Conflictos (§23)

- Crear registros nuevos offline: **sí**.
- Editar registros **cerrados** offline: **no**.
- Editar drafts existentes: usar `revision` + `updatedAt` + `deviceId` +
  `clientGeneratedId`.
- **Nunca** last-write-wins silencioso para datos críticos; conflicto → resolución
  explícita.

## 6. Fotos offline (§24)

Pipeline futuro: `Camera → Blob → IndexedDB → Upload Queue → Object Storage →
stored_files → file_relations → record`. Ver
[STORAGE-ARCHITECTURE](STORAGE-ARCHITECTURE.md).

## 7. QR / código de barras (§25)

DOC-004 se preparará para vincular registros a `site`, `area`, `equipment`,
`product`, `lot`, `material`, `process` mediante QR/barcode futuro. **No** se
construye el módulo QR ahora.

## 8. Dependencias (§62)

`PLATFORM-001 → arquitectura DOC-004`; `PLATFORM-002 → archivos/evidencias DOC-004`;
`DOC-004 → records estructurados`; `PLATFORM-004 → instalación tablet/PWA`;
`PLATFORM-005 → offline/sync`. DOC-004 no debe diseñarse ignorando estas dependencias.
