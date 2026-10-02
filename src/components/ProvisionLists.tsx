'use client';

import * as React from 'react';
import { Banner, Button } from '@/ds';
import { provision } from '@/lib/sharepoint';
import { LISTS, type ListKey } from '@/lib/lists';
import { useStore } from '@/lib/store';

/** Creates missing RönneKoll lists in SharePoint (needs Sites.Manage.All in the token). */
export function ProvisionLists({ keys, compact }: { keys: ListKey[]; compact?: boolean }) {
  const store = useStore();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const conn = store.connection;
  if (store.mode !== 'live' || !conn) return null;
  const missing = keys.filter((k) => !conn.lists[k]);
  if (!missing.length) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const k of missing) await provision(conn.siteId, k);
      store.toast({ icon: 'check_circle', message: `Skapade ${missing.map((k) => LISTS[k]).join(' och ')}` });
      store.resetConnection();
      await store.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/403|denied|Forbidden/i.test(msg) ? 'Token saknar behörighet att skapa listor. Lägg till Sites.Manage.All i Graph Explorer och hämta en ny token.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Banner tone="warning" icon="playlist_add" title={`${missing.map((k) => LISTS[k]).join(' och ')} finns inte på webbplatsen`}
      action={<Button icon="playlist_add" disabled={busy || store.readOnly} onClick={run}>{busy ? 'Skapar…' : 'Skapa listor'}</Button>}>
      {error ?? (compact ? 'Skapas med alla kolumner som RönneKoll behöver.' : 'RönneKoll kan skapa dem åt dig med rätt kolumner. Kräver behörigheten Sites.Manage.All i token.')}
    </Banner>
  );
}
