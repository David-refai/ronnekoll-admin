'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Badge, Banner, Button, Chip, DataTable, Dialog, EmptyState, PageHeader, ScanCounters, ScanFeedback, StatusBadge, TextField, type Column,
} from '@/ds';
import { ScanInput } from '@/components/Scan';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { changeDeviceStatus, log } from '@/lib/actions';
import { buildDevices, serialKey, unique, type DeviceView } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { relDate, todayIso } from '@/lib/format';
import { str, withId, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

type Scope = { kind: 'alla' } | { kind: 'klass' | 'plats' | 'kategori'; value: string };

function scopeLabel(s: Scope) {
  return s.kind === 'alla' ? 'Alla enheter' : `${s.kind === 'klass' ? 'Klass' : s.kind === 'plats' ? 'Plats' : 'Kategori'} ${s.value}`;
}
function inScope(d: DeviceView, s: Scope) {
  if (d.status === 'Kasserad') return false;
  if (s.kind === 'alla') return true;
  if (s.kind === 'klass') return d.klass === s.value;
  if (s.kind === 'plats') return d.plats === s.value;
  return d.kategori === s.value;
}
/** The scope is stored in the inventory's Title: "Inventering · Klass 8B · 2026-09-28". */
function parseScope(title: string): Scope {
  const m = title.match(/· (Klass|Plats|Kategori) (.+?) ·/);
  if (!m) return { kind: 'alla' };
  return { kind: m[1].toLowerCase() as 'klass', value: m[2] };
}
const isOpen = (inv: TRow) => !/avslut|klar|stängd/i.test(str(inv.Status));

function InventeringInner() {
  const store = useStore();
  const ready = useReady();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const inventories = withId(store.data.inventeringar).sort((a, b) => str(b.Startdatum || b._created).localeCompare(str(a.Startdatum || a._created)));
  const [activeId, setActiveId] = React.useState<string | null>(params.get('id'));
  const [creating, setCreating] = React.useState(false);
  const active = activeId ? inventories.find((i) => i._id === activeId) : undefined;

  const rowsFor = (inv: TRow) => store.data.inventeringsrader.filter((r) => str(r.InventeringID) === inv._id || str(r.InventeringID) === str(inv.Title));

  if (active) return <Session inv={active} devices={devices} rows={withId(rowsFor(active))} onBack={() => setActiveId(null)} />;

  const columns: Column<TRow>[] = [
    { key: 'Title', label: 'Inventering', render: (r) => <b>{str(r.Title)}</b> },
    { key: 'Startdatum', label: 'Start', render: (r) => relDate(r.Startdatum || r._created, false) },
    { key: 'UtfördAv', label: 'Utförd av', render: (r) => str(r['UtfördAv']) || '—' },
    { key: 'n', label: 'Skannade', sortable: false, render: (r) => rowsFor(r).length },
    { key: 'Status', label: 'Status', render: (r) => <Badge tone={isOpen(r) ? 'violet' : 'green'} icon={isOpen(r) ? 'pending' : 'check_circle'}>{str(r.Status) || 'Pågår'}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Inventering" description="Skanna alla enheter i en klass, ett rum eller hela skolan — appen visar vad som saknas och vad som ligger på fel plats."
        actions={<Button icon="add" disabled={store.readOnly} onClick={() => setCreating(true)}>Ny inventering</Button>} />
      {!ready ? <PageState /> : inventories.length ? (
        <DataTable<TRow> columns={columns} rows={inventories} onRowClick={(r) => setActiveId(r._id)} />
      ) : (
        <div className="rk-card" style={{ padding: 0 }}>
          <EmptyState icon="inventory" title="Ingen inventering ännu" description="Starta en inventering och skanna enheterna." action={<Button variant="tonal" icon="add" onClick={() => setCreating(true)}>Ny inventering</Button>} />
        </div>
      )}
      {creating && <NewInventory devices={devices} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setActiveId(id); }} />}
    </>
  );
}

function NewInventory({ devices, onClose, onCreated }: { devices: DeviceView[]; onClose(): void; onCreated(id: string): void }) {
  const store = useStore();
  const [kind, setKind] = React.useState<Scope['kind']>('klass');
  const [value, setValue] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const options = kind === 'alla' ? [] : unique(devices.map((d) => (kind === 'klass' ? d.klass : kind === 'plats' ? d.plats : d.kategori)));
  const scope: Scope = kind === 'alla' ? { kind } : { kind, value: value ?? '' };
  const expected = devices.filter((d) => inScope(d, scope)).length;
  const statuses = store.choices('inventeringar', 'Status', ['Pågår', 'Avslutad']);

  const start = async () => {
    setBusy(true);
    try {
      const row = await store.create('inventeringar', {
        Title: `Inventering · ${scopeLabel(scope)} · ${todayIso()}`, Startdatum: new Date().toISOString(), Status: statuses[0], UtfördAv: store.userName,
      });
      await log(store, { typ: 'Inventering', detaljer: `Startade inventering: ${scopeLabel(scope)} (${expected} förväntade)` });
      onCreated(row._id);
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} icon="inventory" title="Ny inventering"
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button disabled={busy || (kind !== 'alla' && !value) || store.readOnly} onClick={start}>Starta</Button></>}>
      <div>
        <label className="field-label" htmlFor="inv-kind">Omfattning</label>
        <select id="inv-kind" className="select" value={kind} onChange={(e) => { setKind(e.target.value as Scope['kind']); setValue(null); }}>
          <option value="klass">En klass</option><option value="plats">En plats</option><option value="kategori">En kategori</option><option value="alla">Alla enheter</option>
        </select>
      </div>
      {kind !== 'alla' && <FilterMenu label="Välj" value={value} onChange={setValue} options={options.map((o) => ({ value: o }))} />}
      {(kind === 'alla' || value) && <span className="small">{expected} enheter förväntas (kasserade räknas inte).</span>}
    </Dialog>
  );
}

function Session({ inv, devices, rows, onBack }: { inv: TRow; devices: DeviceView[]; rows: TRow[]; onBack(): void }) {
  const store = useStore();
  const scope = parseScope(str(inv.Title));
  const open = isOpen(inv);
  const [plats, setPlats] = React.useState(scope.kind === 'plats' ? scope.value : scope.kind === 'klass' ? `Klassrum ${scope.value}` : '');
  const [scan, setScan] = React.useState('');
  const [fb, setFb] = React.useState<{ state: 'success' | 'warning' | 'error'; title: string; serial?: string; detail?: string } | null>(null);
  const [tab, setTab] = React.useState<'saknas' | 'hittade' | 'ovantade'>('saknas');
  const [confirmMissing, setConfirmMissing] = React.useState(false);

  const expected = devices.filter((d) => inScope(d, scope));
  const scannedKeys = new Set(rows.map((r) => serialKey(r.EnhetID)));
  const found = expected.filter((d) => scannedKeys.has(serialKey(d.serial)));
  const missing = expected.filter((d) => !scannedKeys.has(serialKey(d.serial)));
  const expectedKeys = new Set(expected.map((d) => serialKey(d.serial)));
  const unexpected = rows.filter((r) => !expectedKeys.has(serialKey(r.EnhetID)));

  const onScan = async (raw: string) => {
    setScan('');
    const k = serialKey(raw);
    if (!k) return;
    const d = devices.find((x) => serialKey(x.serial) === k || (x.assetId && serialKey(x.assetId) === k));
    const key = d ? serialKey(d.serial) : k;
    if (scannedKeys.has(key)) return setFb({ state: 'warning', title: 'Redan skannad', serial: d?.assetId || k });
    try {
      await store.create('inventeringsrader', { Title: d?.serial ?? k, InventeringID: inv._id, EnhetID: d?.serial ?? k, Skannad: new Date().toISOString(), PlatsVidSkanning: plats });
      if (!d) return setFb({ state: 'error', title: 'Okänd enhet', serial: k, detail: 'Finns inte i Enheter — importera den.' });
      await store.update('enheter', d.id, { Senastinventerad: new Date().toISOString(), ...(d.status === 'Saknas' ? { Status: d.holder ? (d.holder.kind === 'utlaning' ? 'Utlånad' : 'Tilldelad') : 'Tillgänglig' } : {}) });
      if (!inScope(d, scope)) setFb({ state: 'warning', title: 'Fel plats', serial: d.assetId || d.serial, detail: `Tillhör ${d.klass || d.plats || '—'}${d.holder ? ' · ' + d.holder.namn : ''}` });
      else setFb({ state: 'success', title: 'Hittad', serial: d.assetId || d.serial, detail: d.holder ? `${d.holder.namn} (${d.holder.klass})` : d.modell });
    } catch (e) {
      setFb({ state: 'error', title: 'Kunde inte spara', detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const close = async () => {
    const statuses = store.choices('inventeringar', 'Status', ['Pågår', 'Avslutad']);
    await store.update('inventeringar', inv._id, { Status: statuses[statuses.length - 1] });
    await log(store, { typ: 'Inventering', detaljer: `Avslutade ${str(inv.Title)}: ${found.length} hittade, ${missing.length} saknas, ${unexpected.length} oväntade` });
    store.toast({ icon: 'check_circle', message: 'Inventeringen är avslutad' });
  };

  const markMissing = async () => {
    for (const d of missing) if (d.status !== 'Saknas') await changeDeviceStatus(store, d, 'Saknas');
    setConfirmMissing(false);
    store.toast({ icon: 'help', message: `${missing.length} enheter markerade som Saknas` });
  };

  const devCols: Column<DeviceView>[] = [
    { key: 'assetId', label: 'AssetID', mono: true, render: (d) => d.assetId || '—' },
    { key: 'serial', label: 'Serienummer', mono: true },
    { key: 'modell', label: 'Modell' },
    { key: 'status', label: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    { key: 'holder', label: 'Elev', render: (d) => d.holder?.namn ?? '—' },
    { key: 'plats', label: 'Plats' },
  ];
  const rowCols: Column<TRow>[] = [
    { key: 'EnhetID', label: 'Enhet', mono: true, render: (r) => { const d = devices.find((x) => serialKey(x.serial) === serialKey(r.EnhetID)); return d?.assetId || str(r.EnhetID); } },
    { key: 'info', label: 'Tillhör', render: (r) => { const d = devices.find((x) => serialKey(x.serial) === serialKey(r.EnhetID)); return d ? `${d.klass || d.plats || '—'}${d.holder ? ' · ' + d.holder.namn : ''}` : <Badge tone="red">Okänd enhet</Badge>; } },
    { key: 'PlatsVidSkanning', label: 'Skannad på', render: (r) => str(r.PlatsVidSkanning) || '—' },
    { key: 'Skannad', label: 'Tid', render: (r) => relDate(r.Skannad || r._created) },
  ];

  return (
    <>
      <PageHeader overline={open ? 'Pågår' : 'Avslutad'} title={scopeLabel(scope)} description={`${str(inv.Title)} · startad av ${str(inv['UtfördAv']) || '—'}`}
        actions={<>
          <Button variant="text" icon="arrow_back" onClick={onBack}>Alla inventeringar</Button>
          <Button variant="outlined" icon="download" onClick={() => exportXlsx('Inventeringsrapport', [
            { label: 'Resultat', value: (d: DeviceView & { res: string }) => d.res }, { label: 'AssetID', value: (d) => d.assetId }, { label: 'Serienummer', value: (d) => d.serial },
            { label: 'Modell', value: (d) => d.modell }, { label: 'Status', value: (d) => d.status }, { label: 'Elev', value: (d) => d.holder?.namn ?? '' }, { label: 'Klass', value: (d) => d.klass }, { label: 'Plats', value: (d) => d.plats },
          ], [...missing.map((d) => ({ ...d, res: 'Saknas' })), ...found.map((d) => ({ ...d, res: 'Hittad' }))])}>Rapport</Button>
          {open && <Button icon="done_all" disabled={store.readOnly} onClick={close}>Avsluta</Button>}
        </>} />

      <ScanCounters items={[
        { label: 'Förväntade', value: expected.length, tone: 'gray', icon: 'inventory_2' },
        { label: 'Hittade', value: found.length, total: expected.length, tone: 'green', icon: 'check_circle' },
        { label: 'Saknas', value: missing.length, tone: 'red', icon: 'help' },
        { label: 'Oväntade', value: unexpected.length, tone: 'amber', icon: 'wrong_location' },
      ]} />

      {open && (
        <section className="rk-card grid-7-5">
          <div className="stack">
            <ScanInput size="lg" scanning autoFocus shortcut={false} placeholder="Skanna enhet" value={scan} disabled={store.readOnly}
              onChange={(e) => setScan(e.target.value)} onScan={onScan} />
            <TextField label="Plats vid skanning" value={plats} onChange={(e) => setPlats(e.target.value)} helper="Sparas på varje skannad rad" />
          </div>
          <div>{fb ? <ScanFeedback state={fb.state} title={fb.title} serial={fb.serial} detail={fb.detail} /> : <ScanFeedback state="idle" title="Redo att skanna" />}</div>
        </section>
      )}

      <div className="row" style={{ gap: 8 }}>
        <Chip label="Saknas" count={missing.length} selected={tab === 'saknas'} onClick={() => setTab('saknas')} />
        <Chip label="Hittade" count={found.length} selected={tab === 'hittade'} onClick={() => setTab('hittade')} />
        <Chip label="Oväntade" count={unexpected.length} selected={tab === 'ovantade'} onClick={() => setTab('ovantade')} />
        {tab === 'saknas' && missing.length > 0 && !open && (
          <Button variant="danger-text" size="sm" icon="help" disabled={store.readOnly} onClick={() => setConfirmMissing(true)}>Markera alla som Saknas</Button>
        )}
      </div>
      {tab === 'saknas' && (missing.length ? <DataTable<DeviceView> columns={devCols} rows={missing} density="compact" /> : <Banner tone="success" title="Inget saknas">Alla förväntade enheter är skannade.</Banner>)}
      {tab === 'hittade' && <DataTable<DeviceView> columns={devCols} rows={found} density="compact" />}
      {tab === 'ovantade' && (unexpected.length ? <DataTable<TRow> columns={rowCols} rows={unexpected} density="compact" /> : <span className="small muted">Inga oväntade enheter.</span>)}
      {open && missing.length > 0 && <span className="small muted">Avsluta inventeringen för att kunna markera de som saknas.</span>}

      {confirmMissing && (
        <Dialog open onClose={() => setConfirmMissing(false)} tone="danger" icon="help" title={`Markera ${missing.length} enheter som Saknas?`}
          actions={<><Button variant="text" onClick={() => setConfirmMissing(false)}>Avbryt</Button><Button variant="danger" onClick={markMissing}>Markera</Button></>}>
          <span>De får status Saknas. Hittas en enhet senare räcker det att skanna den i en ny inventering — då blir den Tillgänglig igen.</span>
        </Dialog>
      )}
    </>
  );
}

export default function InventeringPage() {
  return (
    <React.Suspense fallback={null}>
      <InventeringInner />
    </React.Suspense>
  );
}
