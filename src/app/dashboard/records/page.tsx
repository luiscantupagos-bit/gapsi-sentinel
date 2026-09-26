import { requireServerSession } from '@/server/session';
import { getRecords, listAvailableForms } from '@/server/records';
import { RecordsIndex } from './_components/RecordsIndex';

/**
 * DOC-004 — índice de Registros. Lista los registros de la organización con filtros y permite
 * crear uno nuevo a partir de un formato vigente (§21/§22/§23).
 */
export default async function RecordsIndexPage() {
  const session = await requireServerSession();
  const [records, forms] = await Promise.all([
    getRecords(session.organizationId, session.userId),
    listAvailableForms(session.organizationId),
  ]);

  return <RecordsIndex records={records} forms={forms} />;
}
