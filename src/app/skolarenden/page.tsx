'use client';

import * as React from 'react';
import { Avatar, Button, Chip, EmptyState, Icon, PageHeader, SideSheet, StatusBadge, TextField, type Status } from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { isOpenCase, unique } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { daysSince, relDate } from '@/lib/format';
import { str, withId, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

const STATUS_FALLBACK = ['Ny', 'Pågående', 'Klar'];

const place = (r: TRow) => [str(r.Plats), str(r.Annat)].filter((x) => x && x !== 'Annat').join(' · ') || str(r.Plats) || '—';
const opened = (r: TRow) => str(r.Starttid) || r._created;

function duration(r: TRow) {
  const from = new Date(opened(r)).getTime();
  const to = r['Slutförandetid'] ? new Date(str(r['Slutförandetid'])).getTime() : Date.now();
  const days = Math.floor((to - from) / 86400000);
  const hours = Math.floor((to - from) / 3600000);
  return days >= 1 ? `${days} d` : `${Math.max(0, hours)} h`;
}

export default function Skolarenden() {
  const store = useStore();
  const ready = useReady();
  const base = store.choices('skolarenden', 'Status', STATUS_FALLBACK);
  const rows = withId(store.data.skolarenden).sort((a, b) => opened(b).localeCompare(opened(a)));
  const statuses = [...base, ...unique(rows.map((r) => str(r.Status)).filter((s) => s && !base.includes(s)))];
  const [showClosed, setShowClosed] = React.useState(false);
  const [typ, setTyp] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const visible = rows.filter((r) => (showClosed || isOpenCase(r.Status)) && (!typ || str(r.TypAvFel) === typ));
  const open = openId ? rows.find((r) => r._id === openId) : undefined;

  const setStatus = async (r: TRow, s: string) => {
    try {
      const done = !isOpenCase(s);
      await store.update('skolarenden', r._id, { Status: s, Slutförandetid: done ? new Date().toISOString() : '' });
      await log(store, { typ: 'Skolärende', detaljer: `${str(r.Beskrivning).slice(0, 60)} — ${str(r.Status) || 'Ny'} → ${s}` });
      store.toast({ icon: 'check_circle', message: `Ärendet är nu ${s}` });
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const nextStatus = (r: TRow) => {
    const i = statuses.indexOf(str(r.Status));
    return statuses.slice(i + 1).find((s) => s) ?? null;
  };

  return (
    <>
      <PageHeader
        title="Skolärenden"
        description="Felanmälningar till vaktmästaren från personalen — lokaler, lås, el, skrivare."
        actions={<Button variant="outlined" icon="download" onClick={() => exportXlsx('Skolarenden', [
          { label: 'Anmält', value: (r: TRow) => opened(r).slice(0, 16).replace('T', ' ') }, { label: 'Namn', value: (r) => str(r.Namn) }, { label: 'E-post', value: (r) => str(r['E-post']) },
          { label: 'Beskrivning', value: (r) => str(r.Beskrivning) }, { label: 'Plats', value: (r) => place(r) }, { label: 'Typ', value: (r) => str(r.TypAvFel) },
          { label: 'Status', value: (r) => str(r.Status) }, { label: 'Slutfört', value: (r) => str(r['Slutförandetid']).slice(0, 16).replace('T', ' ') },
        ], visible)}>Exportera</Button>}
      />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              <FilterMenu label="Typ av fel" value={typ} onChange={setTyp} options={unique(rows.map((r) => str(r.TypAvFel))).map((t) => ({ value: t, count: rows.filter((r) => str(r.TypAvFel) === t).length }))} />
              <Chip label="Visa klara" selected={showClosed} onClick={() => setShowClosed(!showClosed)} count={rows.filter((r) => !isOpenCase(r.Status)).length} />
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="task_alt" tone="green" title="Inga öppna skolärenden" description="Vaktmästaren är ikapp." /></div>
          ) : (
            <div className="stack">
              {visible.map((r) => {
                const nx = nextStatus(r);
                const old = isOpenCase(r.Status) && daysSince(opened(r)) > 7;
                return (
                  <div key={r._id} className="rk-card rk-card--interactive row" style={{ padding: 20, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setOpenId(r._id)}>
                    <span className="rk-kpi__icon rk-tone--gray"><Icon name="handyman" size={22} fill /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{str(r.Beskrivning) || '—'}</div>
                      <div className="small muted" style={{ marginTop: 4 }}>
                        <Icon name="location_on" size={14} /> {place(r)} · {str(r.TypAvFel) || 'Övrigt'} · {str(r.Namn) || str(r['E-post'])} · {relDate(opened(r))}
                      </div>
                    </div>
                    <div className="stack" style={{ alignItems: 'flex-end', gap: 8 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className={`small ${old ? 'rk-text--amber' : 'muted'}`} style={{ fontWeight: 600 }}>{duration(r)}</span>
                        <StatusBadge status={(str(r.Status) || 'Ny') as Status} />
                      </div>
                      {nx && isOpenCase(r.Status) && (
                        <Button size="sm" variant="tonal" disabled={store.readOnly} onClick={(e) => { e.stopPropagation(); setStatus(r, nx); }}>
                          {`Markera ${nx}`}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {open && <IssueSheet row={open} statuses={statuses} onClose={() => setOpenId(null)} onStatus={(s) => setStatus(open, s)} />}
    </>
  );
}

function IssueSheet({ row, statuses, onClose, onStatus }: { row: TRow; statuses: string[]; onClose(): void; onStatus(s: string): Promise<void> }) {
  const store = useStore();
  const [status, setS] = React.useState(str(row.Status) || statuses[0]);
  return (
    <SideSheet open onClose={onClose} overline="Skolärende" title={str(row.TypAvFel) || 'Ärende'}
      subtitle={<div className="row" style={{ gap: 8, marginTop: 6 }}><StatusBadge status={(str(row.Status) || 'Ny') as Status} /><span className="small muted">öppet {duration(row)}</span></div>}
      actions={<><Button variant="text" onClick={onClose}>Stäng</Button><Button icon="check" disabled={store.readOnly || status === str(row.Status)} onClick={async () => { await onStatus(status); onClose(); }}>Spara</Button></>}>
      <p style={{ marginTop: 0, fontSize: 16 }}>{str(row.Beskrivning)}</p>
      <dl className="kv" style={{ margin: '16px 0' }}>
        <dt>Plats</dt><dd>{place(row)}</dd>
        <dt>Anmält av</dt><dd className="row" style={{ gap: 8 }}><Avatar name={str(row.Namn) || '?'} />{str(row.Namn)} <span className="muted small">{str(row['E-post'])}</span></dd>
        <dt>Anmält</dt><dd>{relDate(opened(row))}</dd>
        <dt>Slutfört</dt><dd>{row['Slutförandetid'] ? relDate(row['Slutförandetid']) : '—'}</dd>
      </dl>
      <label className="field-label" htmlFor="sa-status">Status</label>
      <select id="sa-status" className="select" value={status} onChange={(e) => setS(e.target.value)}>
        {statuses.map((s) => <option key={s}>{s}</option>)}
      </select>
      {!isOpenCase(status) && <p className="small muted">Slutförandetid sätts automatiskt när du sparar.</p>}
      {row['E-post'] ? (
        <div style={{ marginTop: 16 }}>
          <TextField label="Svara anmälaren" readOnly value={str(row['E-post'])} trailing={<a className="rk-btn rk-btn--text rk-btn--sm" href={`mailto:${str(row['E-post'])}?subject=${encodeURIComponent('Ditt ärende: ' + str(row.Beskrivning).slice(0, 50))}`}><span>Mejla</span></a>} />
        </div>
      ) : null}
    </SideSheet>
  );
}
