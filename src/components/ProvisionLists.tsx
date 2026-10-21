'use client';

import * as React from 'react';
import { Banner, Button } from '@/ds';
import { provision } from '@/lib/sharepoint';
import { LISTS, PROVISION, type ListKey } from '@/lib/lists';
import { useStore } from '@/lib/store';

/** Creates missing RönneKoll lists in SharePoint (needs Sites.Manage.All in the token). */
export function ProvisionLists({ keys, compact }: { keys: ListKey[]; compact?: boolean }) {
  const store = useStore();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState(false);
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

  const TYPE: Record<string, string> = { text: 'Single line of text', note: 'Multiple lines of text', date: 'Date and time (date only)', choice: 'Choice', number: 'Number' };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Banner tone="warning" icon="playlist_add" title={`${missing.map((k) => LISTS[k]).join(' och ')} finns inte på webbplatsen`}
        action={<div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outlined" icon="view_column" onClick={() => setManual(!manual)}>{manual ? 'Dölj kolumner' : 'Skapa själv'}</Button>
          <Button icon="playlist_add" disabled={busy || store.readOnly} onClick={run}>{busy ? 'Skapar…' : 'Skapa listor'}</Button>
        </div>}>
        {error ?? (compact ? 'Skapas med alla kolumner som RönneKoll behöver.' : 'RönneKoll kan skapa dem åt dig med rätt kolumner (kräver Sites.Manage.All) — eller skapa dem själv i SharePoint.')}
      </Banner>
      {manual && missing.map((k) => (
        <div key={k} className="rk-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700 }}>Lista: <span className="mono">{LISTS[k]}</span></div>
          <div className="small muted" style={{ margin: '4px 0 10px' }}>Skriv namnen exakt så här när du skapar kolumnen. Byt inte namn på Title. Tillåt egna värden på val-kolumner.</div>
          <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr><td className="mono" style={{ padding: '4px 12px 4px 0', fontWeight: 600 }}>Title</td><td className="muted">(finns redan)</td></tr>
              {(PROVISION[k]?.columns ?? []).map((c) => (
                <tr key={c.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="mono" style={{ padding: '4px 12px 4px 0', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td>{TYPE[c.type]}{c.choices ? `: ${c.choices.join(', ')}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
