/**
 * Integridad del esquema tras una reconstrucción limpia (solo migraciones).
 *
 * Detecta el defecto de reproducibilidad corregido por la migración
 * `20260805130000_repair_legacy_constraints`: verifica que, aplicando únicamente
 * las migraciones del repositorio (sin SQL manual), existan las FK compuestas
 * anti-cruce de documentos y CAPA, los triggers append-only, la RLS activada,
 * las políticas por organización y los grants al rol de aplicación.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { db, hasDb } from './_helpers';

afterAll(async () => {
  if (hasDb) await db().$disconnect();
});

async function count(sql: string): Promise<number> {
  const rows = await db().$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(rows[0]?.n ?? 0);
}
async function bool(sql: string): Promise<boolean> {
  const rows = await db().$queryRawUnsafe<{ b: boolean }[]>(sql);
  return Boolean(rows[0]?.b);
}

describe.skipIf(!hasDb)('Integridad del esquema (reconstrucción reproducible)', () => {
  it('existen las FK compuestas anti-cruce de CAPA', async () => {
    // capa_site_fkey y cac_capa_fkey son SQL crudo (no declaradas en schema.prisma).
    expect(await count(`SELECT count(*) n FROM pg_constraint WHERE conname='capa_site_fkey'`)).toBe(
      1,
    );
    expect(await count(`SELECT count(*) n FROM pg_constraint WHERE conname='cac_capa_fkey'`)).toBe(
      1,
    );
    // Referencian el par compuesto (id, organization_id).
    expect(
      await count(`
      SELECT count(*) n FROM pg_constraint
      WHERE conname='capa_site_fkey' AND contype='f'
        AND confrelid='sites'::regclass AND cardinality(conkey)=2`),
    ).toBe(1);
  });

  it('existen las FK compuestas anti-cruce de documentos', async () => {
    expect(
      await count(`
      SELECT count(*) n FROM pg_constraint
      WHERE conname='documents_site_id_organization_id_fkey' AND contype='f'
        AND confrelid='sites'::regclass AND cardinality(conkey)=2`),
    ).toBe(1);
    // El índice único requerido por las FK compuestas hacia frameworks.
    expect(
      await count(
        `SELECT count(*) n FROM pg_indexes WHERE indexname='assessment_frameworks_id_organization_id_key'`,
      ),
    ).toBe(1);
  });

  it('existen los triggers append-only de historiales', async () => {
    for (const tg of ['trg_csh_append', 'trg_dsh_append', 'trg_tsh_append', 'trg_psh_append']) {
      expect(await count(`SELECT count(*) n FROM pg_trigger WHERE tgname='${tg}'`)).toBe(1);
    }
  });

  it('RLS está activada en las tablas de negocio clave', async () => {
    for (const t of ['capas', 'documents', 'tasks', 'projects', 'capa_actions']) {
      expect(await bool(`SELECT relrowsecurity b FROM pg_class WHERE relname='${t}'`)).toBe(true);
    }
  });

  it('existen políticas por organización', async () => {
    for (const t of ['capas', 'documents', 'tasks', 'projects']) {
      expect(
        await count(`SELECT count(*) n FROM pg_policies WHERE tablename='${t}'`),
      ).toBeGreaterThan(0);
    }
  });

  it('el rol de aplicación gapsi_app tiene los grants necesarios', async () => {
    for (const t of ['capas', 'documents', 'tasks', 'projects']) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE']) {
        expect(await bool(`SELECT has_table_privilege('gapsi_app','${t}','${priv}') b`)).toBe(true);
      }
    }
  });

  it('todas las tablas de negocio conservan sus FK (no quedaron sin restricciones)', async () => {
    // Regresión directa del defecto: estas tablas deben tener FK > 0.
    for (const t of [
      'capas',
      'capa_actions',
      'documents',
      'document_versions',
      'quality_analyses',
    ]) {
      expect(
        await count(
          `SELECT count(*) n FROM pg_constraint WHERE conrelid='${t}'::regclass AND contype='f'`,
        ),
      ).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!hasDb)('Integridad del esquema — auditorías (TASK-010)', () => {
  it('FK compuesta anti-cruce de sitio en auditorías', async () => {
    expect(
      await count(`
      SELECT count(*) n FROM pg_constraint
      WHERE conname='aud_site_fkey' AND contype='f'
        AND confrelid='sites'::regclass AND cardinality(conkey)=2`),
    ).toBe(1);
  });

  it('triggers append-only de historiales de auditoría', async () => {
    for (const tg of ['trg_ash_append', 'trg_arh_append', 'trg_apsh_append']) {
      expect(await count(`SELECT count(*) n FROM pg_trigger WHERE tgname='${tg}'`)).toBe(1);
    }
  });

  it('RLS, políticas y grants en tablas de auditoría', async () => {
    for (const t of [
      'audits',
      'audit_findings',
      'audit_checklist_items',
      'audit_requirement_snapshots',
    ]) {
      expect(await bool(`SELECT relrowsecurity b FROM pg_class WHERE relname='${t}'`)).toBe(true);
      expect(
        await count(`SELECT count(*) n FROM pg_policies WHERE tablename='${t}'`),
      ).toBeGreaterThan(0);
      expect(await bool(`SELECT has_table_privilege('gapsi_app','${t}','INSERT') b`)).toBe(true);
    }
  });

  it('las tablas de auditoría conservan FK', async () => {
    for (const t of ['audits', 'audit_findings', 'audit_program_items', 'audit_checklist_items']) {
      expect(
        await count(
          `SELECT count(*) n FROM pg_constraint WHERE conrelid='${t}'::regclass AND contype='f'`,
        ),
      ).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!hasDb)('Integridad del esquema — eventos/KPI (TASK-011)', () => {
  it('FK compuesta anti-cruce de sitio y categoría en eventos', async () => {
    expect(
      await count(`
      SELECT count(*) n FROM pg_constraint
      WHERE conname='qev_site_fkey' AND contype='f'
        AND confrelid='sites'::regclass AND cardinality(conkey)=2`),
    ).toBe(1);
    expect(
      await count(`
      SELECT count(*) n FROM pg_constraint
      WHERE conrelid='quality_events'::regclass AND contype='f'
        AND confrelid='quality_event_categories'::regclass AND cardinality(conkey)=2`),
    ).toBe(1);
  });

  it('CHECK de enums en eventos y KPI', async () => {
    for (const c of ['qev_type_check', 'qev_status_check', 'kpd_measure_check', 'qer_type_check']) {
      expect(await count(`SELECT count(*) n FROM pg_constraint WHERE conname='${c}'`)).toBe(1);
    }
  });

  it('historial de eventos es append-only', async () => {
    expect(await count(`SELECT count(*) n FROM pg_trigger WHERE tgname='trg_qeh_append'`)).toBe(1);
  });

  it('no-borrado físico en eventos y KPI', async () => {
    for (const tg of ['trg_qev_nodel', 'trg_kpd_nodel', 'trg_qalert_nodel']) {
      expect(await count(`SELECT count(*) n FROM pg_trigger WHERE tgname='${tg}'`)).toBe(1);
    }
  });

  it('RLS, políticas y grants en tablas de analítica', async () => {
    for (const t of [
      'quality_events',
      'quality_event_categories',
      'kpi_definitions',
      'kpi_results',
      'quality_alerts',
      'analytics_saved_views',
    ]) {
      expect(await bool(`SELECT relrowsecurity b FROM pg_class WHERE relname='${t}'`)).toBe(true);
      expect(
        await count(`SELECT count(*) n FROM pg_policies WHERE tablename='${t}'`),
      ).toBeGreaterThan(0);
      expect(await bool(`SELECT has_table_privilege('gapsi_app','${t}','INSERT') b`)).toBe(true);
    }
  });

  it('grant de secuencia BIGSERIAL del historial de eventos', async () => {
    expect(
      await bool(
        `SELECT has_sequence_privilege('gapsi_app','quality_event_history_id_seq','USAGE') b`,
      ),
    ).toBe(true);
  });
});
