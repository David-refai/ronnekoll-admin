'use client';

import { Banner } from '@/ds';
import { LISTS, PROVISION, isInvColumn, type ListKey } from '@/lib/lists';
import { useStore } from '@/lib/store';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f\s_]/g, '').toLowerCase();

/** Warns when a RönneKoll list exists but lacks columns the app writes to (those values would be lost). */
export function ListColumnsCheck({ list }: { list: ListKey }) {
  const store = useStore();
  const meta = store.connection?.lists[list];
  const def = PROVISION[list];
  if (store.mode !== 'live' || !meta || !def) return null;
  const have = Object.keys(meta.toInternal).map(norm).concat(Object.values(meta.toInternal).map(norm));
  const missing = def.columns.filter((c) => !have.includes(norm(c.name)) && !(isInvColumn(c.name) && have.some(isInvColumn)));
  if (!missing.length) return null;
  return (
    <Banner tone="warning" icon="view_column" title={`Listan ${LISTS[list]} saknar ${missing.length === 1 ? 'kolumnen' : 'kolumnerna'} ${missing.map((c) => c.name).join(', ')}`}>
      Det RönneKoll skriver dit sparas inte. Skapa {missing.length === 1 ? 'kolumnen' : 'dem'} i SharePoint med exakt det namnet och tryck Hämta data igen under Inställningar.
    </Banner>
  );
}
