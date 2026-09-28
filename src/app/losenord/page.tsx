'use client';

import * as React from 'react';
import { Button, Chip, DataTable, EmptyState, IconButton, PageHeader, StatusBadge, type Column, type Status } from '@/ds';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { relDate } from '@/lib/format';
import { str, withId, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

/** The wished password is never shown in clear text by default, never exported, and cleared when the request is Klart. */
function Secret({ value }: { value: string }) {
  const store = useStore();
  const [show, setShow] = React.useState(false);
  if (!value) return <span className="muted small">Rensat</span>;
  return (
    <span className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
      <span className="secret">{show ? value : '••••••'}</span>
      <IconButton icon={show ? 'visibility_off' : 'visibility'} label={show ? 'Dölj' : 'Visa'} onClick={() => setShow(!show)} />
      <IconButton icon="content_copy" label="Kopiera" onClick={async () => { try { await navigator.clipboard.writeText(value); store.toast({ icon: 'content_copy', message: 'Kopierat' }); } catch { /* ignore */ } }} />
    </span>
  );
}

export default function Losenord() {
  const store = useStore();
  const ready = useReady();
  const [showDone, setShowDone] = React.useState(false);
  const rows = withId(store.data.losenord).sort((a, b) => str(b.Datum || b._created).localeCompare(str(a.Datum || a._created)));
  const visible = rows.filter((r) => showDone || str(r.Status) !== 'Klart');

  const setStatus = async (r: TRow, s: 'Behandlas' | 'Klart') => {
    try {
      await store.update('losenord', r._id, { Status: s, ...(s === 'Klart' ? { ÖnskatLosenord: '' } : {}) });
      await log(store, { typ: 'Lösenord', detaljer: `Lösenordsbegäran för ${str(r.Title)} (${str(r.Klass)}): ${str(r.Status) || 'Ny'} → ${s}` });
      store.toast({ icon: 'check_circle', message: s === 'Klart' ? `Klart — önskat lösenord för ${str(r.Title)} rensat` : `${str(r.Title)}: Behandlas` });
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const columns: Column<TRow>[] = [
    { key: 'Title', label: 'Elev', render: (r) => <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}><b>{str(r.Title)}</b><span className="rk-muted rk-small">{str(r.ElevEpost)}</span></span> },
    { key: 'Klass', label: 'Klass', render: (r) => str(r.Klass) || '—' },
    { key: 'Datum', label: 'Datum', render: (r) => <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>{relDate(r.Datum || r._created, false)}{r.Typ ? <span className="rk-muted rk-small">{str(r.Typ)}</span> : null}</span> },
    { key: 'ÖnskatLosenord', label: 'Önskat lösenord', sortable: false, render: (r) => (str(r.Typ) && !/eget/i.test(str(r.Typ)) && !r['ÖnskatLosenord'] ? <span className="muted small">—</span> : <Secret value={str(r['ÖnskatLosenord'])} />) },
    { key: 'BegardAv', label: 'Begärd av', render: (r) => str(r.BegardAv) || str(r.BegardAvId) || '—' },
    { key: 'Status', label: 'Status', render: (r) => <StatusBadge status={(str(r.Status) || 'Ny') as Status} /> },
    {
      key: 'x', label: '', align: 'right', sortable: false,
      render: (r) => {
        const s = str(r.Status) || 'Ny';
        if (s === 'Klart') return null;
        return (
          <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            {s !== 'Behandlas' && <IconButton icon="pending" variant="outlined" label="Markera Behandlas" disabled={store.readOnly} onClick={() => setStatus(r, 'Behandlas')} />}
            <IconButton icon="check" variant="tonal" label="Markera Klart" disabled={store.readOnly} onClick={() => setStatus(r, 'Klart')} />
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Lösenordsbegäran" description="Lärare begär nytt lösenord åt elever. Markera Behandlas när du bytt lösenordet — flödet mejlar då det nya lösenordet till läraren. Klart rensar det önskade lösenordet." />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              <Chip label="Visa klara" selected={showDone} onClick={() => setShowDone(!showDone)} count={rows.filter((r) => str(r.Status) === 'Klart').length} />
            </div>
          </div>
          {visible.length ? (
            <DataTable<TRow> columns={columns} rows={visible} />
          ) : (
            <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="task_alt" tone="green" title="Inga väntande begäran" description="Alla lösenordsbegäran är klara." /></div>
          )}
          {rows.some((r) => str(r.Status) === 'Klart' && r['ÖnskatLosenord']) && (
            <div className="rk-card row" style={{ justifyContent: 'space-between' }}>
              <span className="small">Det finns klara begäran där önskat lösenord fortfarande ligger kvar i listan.</span>
              <Button size="sm" variant="danger-text" icon="delete_sweep" disabled={store.readOnly}
                onClick={async () => {
                  for (const r of rows.filter((x) => str(x.Status) === 'Klart' && x['ÖnskatLosenord'])) await store.update('losenord', r._id, { ÖnskatLosenord: '' });
                  store.toast({ icon: 'delete_sweep', message: 'Gamla lösenord rensade' });
                }}>Rensa alla</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
