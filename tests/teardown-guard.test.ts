import { describe, expect, it } from 'vitest';
import { isSafeTestDatabase } from './db-teardown-guard';

// Contexto de test permitido (una de las dos señales basta).
const TEST = { VITEST: 'true' } as const;
const url = (host: string) => `postgresql://gapsi:pw@${host}:5432/gapsi_sentinel_dev?schema=public`;

describe('isSafeTestDatabase (guarda fail-closed del cleanup de BD)', () => {
  it('A. localhost + contexto test → permitido', () => {
    expect(isSafeTestDatabase(url('localhost'), TEST)).toBe(true);
  });
  it('B. 127.0.0.1 + contexto test → permitido', () => {
    expect(isSafeTestDatabase(url('127.0.0.1'), TEST)).toBe(true);
  });
  it('C. [::1] (IPv6) + contexto test → permitido', () => {
    expect(isSafeTestDatabase(url('[::1]'), TEST)).toBe(true);
  });
  it('C.bis GAPSI_TEST_DB también habilita el contexto de test', () => {
    expect(isSafeTestDatabase(url('localhost'), { GAPSI_TEST_DB: 'true' })).toBe(true);
  });
  it('D. host remoto (db.example.com) → bloqueado', () => {
    expect(isSafeTestDatabase(url('db.example.com'), TEST)).toBe(false);
  });
  it('E. IP remota (10.0.0.5) → bloqueado', () => {
    expect(isSafeTestDatabase(url('10.0.0.5'), TEST)).toBe(false);
  });
  it('F. URL inválida → bloqueado', () => {
    expect(isSafeTestDatabase('no-es-una-url', TEST)).toBe(false);
    expect(isSafeTestDatabase(undefined, TEST)).toBe(false);
    expect(isSafeTestDatabase('mysql://root@localhost/db', TEST)).toBe(false); // protocolo no Postgres
  });
  it('G. host local pero SIN contexto de test → bloqueado', () => {
    expect(isSafeTestDatabase(url('localhost'), {})).toBe(false);
    expect(isSafeTestDatabase(url('127.0.0.1'), { VITEST: 'false' })).toBe(false);
  });
  it('H. contexto de test pero host remoto → bloqueado', () => {
    expect(isSafeTestDatabase(url('db.example.com'), TEST)).toBe(false);
    expect(isSafeTestDatabase(url('192.168.1.20'), { GAPSI_TEST_DB: 'true' })).toBe(false);
  });
});
