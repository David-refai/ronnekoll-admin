'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button, Chip, DataTable, Dialog, EmptyState, FaultCard, KanbanBoard, PageHeader, SegmentedButton, SideSheet, StatusBadge, TextField,
  type Column, type Status,
} from '@/ds';
import { DevicePicker } from '@/components/Pickers';
import { PageState, useReady } from '@/components/PageState';
import { createFault, log } from '@/lib/actions';
import { buildDevices, isOpenCase, serialKey, type DeviceView } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { daysSince, relDate } from '@/lib/format';
import { str, withId, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

const STATUS_FALLBACK = ['Ny', 'Pågående', 'Väntar på del/leverantör', 'Skickad på reparation', 'Klar', 'Avvisad'];
const PRIO_FALLBACK = ['Låg', 'Normal', 'Hög', 'Akut'];
const TYPE_FALLBACK = ['Skärm', 'Tangentbord', 'Batteri', 'Laddare', 'Mjukvara', 'Stöld/förlust', 'Fel', 'Annat'];

function FelInner() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const baseStatuses = store.choices('felanmalningar', 'Status', STATUS_FALLBACK);
  const statuses = React.useMemo(() => {
    const extra = store.data.felanmalningar.map((r) => str(r.Status)).filter((s) => s && !baseStatuses.includes(s));
    return [...baseStatuses, ...Array.from(new Set(extra))];
  }, [baseStatuses, store.data.felanmalningar]);
  const [view, setView] = React.useState<'kanban' | 'lista'>('kanban');
  const [showClosed, setShowClosed] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState<string | null>(params.get('enhet'));

  const rows = withId(store.data.felanmalningar).sort((a, b) => b._created.localeCompare(a._created));
  const visible = showClosed ? rows : rows.filter((r) => isOpenCase(r.Status));
  const devOf = (r: TRow) => devices.find((d) => serialKey(d.serial) === serialKey(r.EnhetID));
  const open = openId ? rows.find((r) => r._id === openId) : undefined;

  const fault = (r: TRow) => {
    const d = devOf(r);
    return {
      prioritet: (str(r.Prioritet) || 'Normal') as 'Normal', datum: relDate(r._created, false), typ: str(r.TypAvFel) || 'Fel',
      beskrivning: str(r.Beskrivning), bild: !!r.BildURL, enhet: d?.assetId || str(r.EnhetID), elev: d?.holder?.namn, klass: d?.holder?.klass,
      _id: r._id,
    };
  };

  const columns: Column<TRow>[] = [
    { key: 'EnhetID', label: 'Enhet', mono: true, render: (r) => devOf(r)?.assetId || str(r.EnhetID) },
    { key: 'TypAvFel', label: 'Typ', render: (r) => str(r.TypAvFel) || '—' },
    { key: 'Beskrivning', label: 'Beskrivning', render: (r) => str(r.Beskrivning) },
    { key: 'Prioritet', label: 'Prioritet', render: (r) => (r.Prioritet ? <StatusBadge status={str(r.Prioritet) as Status} /> : '—') },
    { key: 'Status', label: 'Status', render: (r) => <StatusBadge status={(str(r.Status) || 'Ny') as Status} /> },
    { key: 'AnmäldAv', label: 'Anmäld av', render: (r) => str(r['AnmäldAv']) || '—' },
    { key: '_created', label: 'Datum', render: (r) => <span className={isOpenCase(r.Status) && daysSince(r._created) > 7 ? 'rk-text--amber' : undefined}>{relDate(r._created, false)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Felanmälningar"
        description="Fel på elevernas enheter. Stäng ett ärende genom att fylla i Åtgärd."
        actions={
          <>
            <Button variant="outlined" icon="download" onClick={() => exportXlsx('Felanmalningar', [
              { label: 'Enhet', value: (r: TRow) => str(r.EnhetID) }, { label: 'Typ', value: (r) => str(r.TypAvFel) }, { label: 'Beskrivning', value: (r) => str(r.Beskrivning) },
              { label: 'Prioritet', value: (r) => str(r.Prioritet) }, { label: 'Status', value: (r) => str(r.Status) }, { label: 'Anmäld av', value: (r) => str(r['AnmäldAv']) },
              { label: 'Åtgärd', value: (r) => str(r['Åtgärd']) }, { label: 'Datum', value: (r) => r._created.slice(0, 10) },
            ], visible)}>Exportera</Button>
            <Button icon="add" disabled={store.readOnly} onClick={() => setCreating('')}>Ny felanmälan</Button>
          </>
        }
      />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              <Chip label="Visa stängda" selected={showClosed} onClick={() => setShowClosed(!showClosed)} count={rows.length - rows.filter((r) => isOpenCase(r.Status)).length} />
            </div>
            <div className="rk-filterbar__trailing">
              <SegmentedButton label="Vy" value={view} onChange={(v) => setView(v as 'kanban' | 'lista')}
                options={[{ value: 'kanban', label: 'Tavla', icon: 'view_kanban' }, { value: 'lista', label: 'Lista', icon: 'table_rows' }]} />
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="task_alt" tone="green" title="Inga öppna felanmälningar" description="Allt är åtgärdat." /></div>
          ) : view === 'kanban' ? (
            <KanbanBoard
              columns={statuses.filter((s) => showClosed || isOpenCase(s)).map((s) => ({ status: s as 'Ny', items: visible.filter((r) => (str(r.Status) || statuses[0]) === s).map(fault) }))}
              renderCard={(f) => <FaultCard key={(f as { _id: string })._id} fault={f} onClick={() => setOpenId((f as { _id: string })._id)} />}
            />
          ) : (
            <DataTable<TRow> columns={columns} rows={visible} onRowClick={(r) => setOpenId(r._id)} />
          )}
        </div>
      )}
      {open && <FaultSheet row={open} device={devOf(open)} statuses={statuses} onClose={() => setOpenId(null)} onOpenDevice={(s) => router.push(`/enheter?open=${encodeURIComponent(s)}`)} />}
      {creating != null && <NewFault devices={devices} initial={creating} onClose={() => { setCreating(null); if (params.get('enhet')) router.replace('/felanmalningar'); }} />}
    </>
  );
}

function FaultSheet({ row, device, statuses, onClose, onOpenDevice }: { row: TRow; device?: DeviceView; statuses: string[]; onClose(): void; onOpenDevice(serial: string): void }) {
  const store = useStore();
  const [status, setStatus] = React.useState(str(row.Status) || statuses[0]);
  const [atgard, setAtgard] = React.useState(str(row['Åtgärd']));
  const [busy, setBusy] = React.useState(false);
  const closing = !isOpenCase(status);
  const save = async () => {
    if (closing && !atgard.trim()) return store.toast({ icon: 'error', message: 'Fyll i Åtgärd innan du stänger ärendet.' });
    setBusy(true);
    try {
      await store.update('felanmalningar', row._id, { Status: status, Åtgärd: atgard });
      await log(store, { typ: 'Felanmälan', enhetId: str(row.EnhetID), detaljer: `Status: ${str(row.Status) || 'Ny'} → ${status}${atgard ? '. Åtgärd: ' + atgard : ''}` });
      store.toast({ icon: 'check_circle', message: 'Felanmälan uppdaterad' });
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };
  return (
    <SideSheet open onClose={onClose} overline="Felanmälan" title={str(row.TypAvFel) || 'Fel'}
      subtitle={<div className="row" style={{ gap: 8, marginTop: 6 }}><StatusBadge status={(str(row.Status) || 'Ny') as Status} /><span className="small muted">{relDate(row._created)} · {str(row['AnmäldAv'])}</span></div>}
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button icon="check" disabled={busy || store.readOnly} onClick={save}>Spara</Button></>}>
      <p style={{ marginTop: 0 }}>{str(row.Beskrivning)}</p>
      {!!row.BildURL && <a href={str(row.BildURL)} target="_blank" rel="noreferrer"><img src={str(row.BildURL)} alt="Bild på felet" style={{ maxWidth: '100%', borderRadius: 12 }} /></a>}
      <dl className="kv" style={{ margin: '16px 0' }}>
        <dt>Enhet</dt><dd>{device ? <Button variant="text" size="sm" trailingIcon="open_in_new" onClick={() => onOpenDevice(device.serial)}>{device.assetId || device.serial}</Button> : <span className="mono">{str(row.EnhetID)}</span>}</dd>
        <dt>Modell</dt><dd>{device?.modell || '—'}</dd>
        <dt>Elev</dt><dd>{device?.holder ? `${device.holder.namn} (${device.holder.klass})` : '—'}</dd>
        <dt>Prioritet</dt><dd>{str(row.Prioritet) || '—'}</dd>
      </dl>
      <div className="stack">
        <div>
          <label className="field-label" htmlFor="f-status">Status</label>
          <select id="f-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <TextField label="Åtgärd" multiline rows={3} value={atgard} onChange={(e) => setAtgard(e.target.value)}
          error={closing && !atgard.trim() ? 'Krävs för att stänga ärendet' : undefined} placeholder="Bytt skärm, skickad till HP…" />
        {device?.holder && closing && <span className="small muted">Tips: ändra enhetens status till Tillgänglig eller Tilldelad under Enheter när den är lagad.</span>}
      </div>
    </SideSheet>
  );
}

function NewFault({ devices, initial, onClose }: { devices: DeviceView[]; initial: string; onClose(): void }) {
  const store = useStore();
  const [device, setDevice] = React.useState<DeviceView | null>(initial ? devices.find((d) => serialKey(d.serial) === serialKey(initial)) ?? null : null);
  const types = store.choices('felanmalningar', 'TypAvFel', TYPE_FALLBACK);
  const prios = store.choices('felanmalningar', 'Prioritet', PRIO_FALLBACK);
  const [typ, setTyp] = React.useState(types[0]);
  const [prio, setPrio] = React.useState(prios.includes('Normal') ? 'Normal' : prios[0]);
  const [text, setText] = React.useState('');
  const [markBroken, setMarkBroken] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    if (!device) return;
    setBusy(true);
    try {
      await createFault(store, { EnhetID: device.serial, TypAvFel: typ, Prioritet: prio, Beskrivning: text });
      if (markBroken && !device.holder) await store.update('enheter', device.id, { Status: 'Trasig' });
      store.toast({ icon: 'report', message: `Felanmälan skapad för ${device.assetId || device.serial}` });
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} icon="report" title="Ny felanmälan"
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button disabled={!device || !text.trim() || busy || store.readOnly} onClick={save}>Skapa</Button></>}>
      <DevicePicker devices={devices} value={device} onChange={setDevice} autoFocus={!device} suggestions={false} />
      <div className="form-grid">
        <div><label className="field-label" htmlFor="nf-typ">Typ av fel</label><select id="nf-typ" className="select" value={typ} onChange={(e) => setTyp(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="field-label" htmlFor="nf-prio">Prioritet</label><select id="nf-prio" className="select" value={prio} onChange={(e) => setPrio(e.target.value)}>{prios.map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      <TextField label="Beskrivning" multiline rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Vad är fel?" />
      {device && !device.holder && device.status === 'Tillgänglig' && (
        <label className="row small"><input type="checkbox" checked={markBroken} onChange={(e) => setMarkBroken(e.target.checked)} /> Markera enheten som Trasig</label>
      )}
    </Dialog>
  );
}

export default function FelanmalningarPage() {
  return (
    <React.Suspense fallback={null}>
      <FelInner />
    </React.Suspense>
  );
}
