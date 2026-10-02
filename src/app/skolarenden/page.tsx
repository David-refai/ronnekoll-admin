'use client';

import * as React from 'react';
import { Avatar, Button, Chip, EmptyState, Icon, PageHeader, SideSheet, StatusBadge, Switch, TextField, type Status } from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import * as graph from '@/lib/graph';
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
  const [note, setNote] = React.useState(str(row.Anteckningar));
  const email = str(row['E-post']);
  const [notify, setNotify] = React.useState(!!email);
  const [busy, setBusy] = React.useState(false);
  const hasNoteColumn = store.mode === 'demo' || !!store.connection?.lists.skolarenden?.toInternal['Anteckningar'];
  const changed = status !== str(row.Status) || note !== str(row.Anteckningar);

  const firstName = str(row.Namn).split(' ')[0];
  const subject = `Ditt ärende: ${str(row.Beskrivning).slice(0, 60)}`;
  /** The note is the e-mail text; without a note the status is sent. */
  const body = note.trim()
    ? `Hej${firstName ? ' ' + firstName : ''},\n\n${note.trim()}\n\nStatus: ${status}\nÄrende: ${str(row.Beskrivning)}\n\nHälsningar\n${store.userName}`
    : `Hej${firstName ? ' ' + firstName : ''},\n\nDitt ärende "${str(row.Beskrivning)}" har nu status: ${status}.\n\nHälsningar\n${store.userName}`;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const sendMail = async () => {
    if (store.mode === 'demo') {
      store.toast({ icon: 'mail', message: `Demoläge — e-post till ${email} skickas inte` });
      return;
    }
    try {
      await graph.sendMail(email, subject, body);
      store.toast({ icon: 'mail', message: `E-post skickad till ${email}` });
    } catch {
      // Token without Mail.Send: open the mail program with the text filled in instead.
      window.location.href = mailto;
      store.toast({ icon: 'mail', message: 'Öppnade e-postprogrammet — tryck Skicka där' });
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (note !== str(row.Anteckningar) && hasNoteColumn) await store.update('skolarenden', row._id, { Anteckningar: note });
      if (status !== str(row.Status)) await onStatus(status);
      if (notify && email) await sendMail();
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <SideSheet open onClose={onClose} overline="Skolärende" title={str(row.TypAvFel) || 'Ärende'}
      subtitle={<div className="row" style={{ gap: 8, marginTop: 6 }}><StatusBadge status={(str(row.Status) || 'Ny') as Status} /><span className="small muted">öppet {duration(row)}</span></div>}
      actions={<><Button variant="text" onClick={onClose}>Stäng</Button><Button icon={notify && email ? 'send' : 'check'} disabled={store.readOnly || busy || (!changed && !notify)} onClick={save}>{notify && email ? 'Spara och mejla' : 'Spara'}</Button></>}>
      <p style={{ marginTop: 0, fontSize: 16 }}>{str(row.Beskrivning)}</p>
      <dl className="kv" style={{ margin: '16px 0' }}>
        <dt>Plats</dt><dd>{place(row)}</dd>
        <dt>Anmält av</dt><dd className="row" style={{ gap: 8 }}><Avatar name={str(row.Namn) || '?'} />{str(row.Namn)} <span className="muted small">{email}</span></dd>
        <dt>Anmält</dt><dd>{relDate(opened(row))}</dd>
        <dt>Slutfört</dt><dd>{row['Slutförandetid'] ? relDate(row['Slutförandetid']) : '—'}</dd>
      </dl>
      <div className="stack">
        <div>
          <label className="field-label" htmlFor="sa-status">Status</label>
          <select id="sa-status" className="select" value={status} onChange={(e) => setS(e.target.value)}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          {!isOpenCase(status) && <p className="small muted" style={{ margin: '6px 0 0' }}>Slutförandetid sätts automatiskt när du sparar.</p>}
        </div>
        <TextField label="Anteckning" multiline rows={4} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Bytt toner i skrivaren, fungerar nu."
          helper={hasNoteColumn ? 'Sparas i kolumnen Anteckningar och blir texten i e-posten' : 'Kolumnen Anteckningar finns inte i listan än — texten skickas bara i e-posten'} />
        {email ? (
          <>
            <Switch checked={notify} onChange={setNotify} label={<span>Mejla <b>{str(row.Namn) || email}</b> när jag sparar</span>} />
            {notify && (
              <div className="rk-card" style={{ boxShadow: 'none', background: 'var(--surface-container-low)', padding: 16 }}>
                <div className="small muted" style={{ marginBottom: 6 }}>Till: {email} · Ämne: {subject}</div>
                <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{body}</div>
              </div>
            )}
            <span className="small muted">Skickas direkt om token har behörigheten Mail.Send, annars öppnas ditt e-postprogram med texten ifylld.</span>
          </>
        ) : (
          <span className="small muted">Anmälaren har ingen e-postadress i listan.</span>
        )}
      </div>
    </SideSheet>
  );
}
