'use client';

import { Banner } from '@/ds';
import { invColumn } from '@/lib/actions';
import { useStore } from '@/lib/store';

/** Shown when the Enheter list has no "Senast inventerad" column — then nothing can be saved there. */
export function InvColumnBanner() {
  const store = useStore();
  if (store.mode !== 'live' || !store.connection?.lists.enheter || invColumn(store)) return null;
  return (
    <Banner tone="warning" icon="event_busy" title="Kolumnen Senastinventerad saknas i listan Enheter">
      RönneKoll vill spara datumet varje gång en enhet skannas, tilldelas eller återlämnas. Skapa kolumnen <b>Senastinventerad</b> (Date and time) i Enheter och tryck Hämta data igen.
    </Banner>
  );
}
