'use client';

import * as React from 'react';
import { Button, DataTable, EmptyState, IconButton, PageHeader, StatusBadge, type Column, type Status } from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { unique } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { relDate } from '@/lib/format';
import { str, withId, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

const PAGE = 50;
const when = (r: TRow) => str(r.Tidpunkt) || r._created;

export default function Aktivitetslogg() {
  const store = useStore();
  const ready = useReady();
  const [q, setQ] = React.useState('');
  const [typ, setTyp] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState('');
  const [page, setPage] = React.useState(0);
  React.useEffect(() => setPage(0), [q, typ, user, from]);

  const rows = React.useMemo(() => withId(store.data.aktivitetslogg).sort((a, b) => when(b).localeCompare(when(a))), [store.data.aktivitetslogg]);
  const filtered = rows.filter((r) => {
    if (typ && str(r.Typ) !== typ) return false;
    if (user && str(r['Användare']) !== user) return false;
    if (from && when(r).slice(0, 10) < from) return false;
    if (q) {
      const n = q.toLowerCase();
      if (![str(r.EnhetID), str(r.ElevID), str(r.Detaljer), str(r['Användare'])].join(' ').toLowerCase().includes(n)) return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const columns: Column<TRow>[] = [
    { key: 'Tidpunkt', label: 'Tidpunkt', render: (r) => relDate(when(r)) },
    { key: 'Typ', label: 'Typ', render: (r) => str(r.Typ) || str(r.Title) },
    { key: 'EnhetID', label: 'Enhet', mono: true, render: (r) => str(r.EnhetID) || '—' },
    { key: 'ElevID', label: 'Elev', mono: true, render: (r) => str(r.ElevID) || '—' },
    {
      key: 'Detaljer', label: 'Detaljer',
      render: (r) => {
        const m = str(r.Detaljer).match(/Status: (.+?) → (.+?)(\.|$)/);
        return m ? <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}><StatusBadge status={m[1] as Status} noIcon /> → <StatusBadge status={m[2] as Status} noIcon /></span> : str(r.Detaljer);
      },
    },
    { key: 'Användare', label: 'Användare', render: (r) => str(r['Användare']) || '—' },
  ];

  return (
    <>
      <PageHeader title="Aktivitetslogg" description="Allt som händer loggas här. Loggen skrivs bara till — inget ändras eller tas bort."
        actions={<Button variant="outlined" icon="download" onClick={() => exportXlsx('Aktivitetslogg', [
          { label: 'Tidpunkt', value: (r: TRow) => when(r).slice(0, 16).replace('T', ' ') }, { label: 'Typ', value: (r) => str(r.Typ) }, { label: 'Enhet', value: (r) => str(r.EnhetID) },
          { label: 'ElevID', value: (r) => str(r.ElevID) }, { label: 'Detaljer', value: (r) => str(r.Detaljer) }, { label: 'Användare', value: (r) => str(r['Användare']) },
        ], filtered)}>Exportera</Button>} />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              <input className="select" style={{ width: 240, borderRadius: 9999 }} placeholder="Sök enhet, elev, text…" value={q} onChange={(e) => setQ(e.target.value)} />
              <FilterMenu label="Typ" value={typ} onChange={setTyp} options={unique(rows.map((r) => str(r.Typ))).map((t) => ({ value: t, count: rows.filter((r) => str(r.Typ) === t).length }))} />
              <FilterMenu label="Användare" value={user} onChange={setUser} options={unique(rows.map((r) => str(r['Användare']))).map((t) => ({ value: t }))} />
              <label className="row small" style={{ gap: 6 }}>Från <input type="date" className="select" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            </div>
          </div>
          {filtered.length ? (
            <DataTable<TRow> columns={columns} rows={filtered.slice(page * PAGE, (page + 1) * PAGE)} density="compact"
              footer={<><span>{filtered.length} händelser</span><span className="row" style={{ gap: 4 }}>
                <IconButton icon="chevron_left" label="Föregående" disabled={page === 0} onClick={() => setPage(page - 1)} />{page + 1} / {pages}
                <IconButton icon="chevron_right" label="Nästa" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} /></span></>} />
          ) : (
            <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="history" title="Inga händelser" description="Inget matchar filtret." /></div>
          )}
        </div>
      )}
    </>
  );
}
