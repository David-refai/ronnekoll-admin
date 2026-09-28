'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Badge, Button, Chip, DataTable, DeviceCard, Dialog, EmptyState, IconButton, PageHeader, SegmentedButton, StatusBadge, type Column,
} from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { DeviceForm } from '@/components/enheter/DeviceForm';
import { DeviceSheet } from '@/components/enheter/DeviceSheet';
import { StatusDialog } from '@/components/enheter/StatusDialog';
import { SwapDialog } from '@/components/enheter/SwapDialog';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { changeDeviceStatus, deleteRow, log } from '@/lib/actions';
import { buildDevices, serialKey, unique, type DeviceView } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { daysSince, shortDate } from '@/lib/format';
import { DEVICE_STATUSES, DISCONNECTING, type DeviceStatus } from '@/lib/lists';
import { useStore } from '@/lib/store';

const PAGE = 50;

type SortKey = 'assetId' | 'serial' | 'modell' | 'kategori' | 'status' | 'elev' | 'klass' | 'agande' | 'plats' | 'senastInv';

const sortVal = (d: DeviceView, k: SortKey) =>
  k === 'elev' ? d.holder?.namn ?? '' : k === 'status' ? String(DEVICE_STATUSES.indexOf(d.status)).padStart(2, '0') : String(d[k] ?? '');

function EnheterInner() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const params = useSearchParams();

  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);

  const [q, setQ] = React.useState(params.get('q') ?? '');
  const [status, setStatus] = React.useState<string | null>(params.get('status'));
  const [klass, setKlass] = React.useState<string | null>(params.get('klass'));
  const [modell, setModell] = React.useState<string | null>(null);
  const [kategori, setKategori] = React.useState<string | null>(null);
  const [plats, setPlats] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState(false);
  const [noLabel, setNoLabel] = React.useState(false);
  const [view, setView] = React.useState<'tabell' | 'kort'>('tabell');
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'assetId', dir: 'asc' });
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<(string | number)[]>([]);
  const [openSerial, setOpenSerial] = React.useState<string | null>(params.get('open'));
  const [statusFor, setStatusFor] = React.useState<DeviceView | null>(null);
  const [editFor, setEditFor] = React.useState<DeviceView | 'new' | null>(null);
  const [bulk, setBulk] = React.useState<null | 'status' | 'plats' | 'kassera'>(null);
  const [swapFor, setSwapFor] = React.useState<DeviceView | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<DeviceView | null>(null);

  // Follow URL changes (global scan/search)
  React.useEffect(() => {
    setQ(params.get('q') ?? '');
    if (params.get('status')) setStatus(params.get('status'));
    if (params.get('klass')) setKlass(params.get('klass'));
    setOpenSerial(params.get('open'));
  }, [params]);

  React.useEffect(() => setPage(0), [q, status, klass, modell, kategori, plats, stale, noLabel]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = devices.filter((d) => {
      if (status && d.status !== status) return false;
      if (klass && d.klass !== klass) return false;
      if (modell && d.modell !== modell) return false;
      if (kategori && d.kategori !== kategori) return false;
      if (plats && d.plats !== plats) return false;
      if (stale && d.senastInv && daysSince(d.senastInv) < 90) return false;
      if (noLabel && d.assetId) return false;
      if (needle) {
        const hay = [d.assetId, d.serial, d.modell, d.holder?.namn, d.klass, d.plats].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => sortVal(a, sort.key).localeCompare(sortVal(b, sort.key), 'sv', { numeric: true }) * dir);
  }, [devices, q, status, klass, modell, kategori, plats, stale, noLabel, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const open = openSerial ? devices.find((d) => serialKey(d.serial) === serialKey(openSerial)) : undefined;
  const selectedDevices = devices.filter((d) => selected.includes(d.id));

  const countBy = (f: (d: DeviceView) => string) => {
    const m = new Map<string, number>();
    devices.forEach((d) => { const k = f(d); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return m;
  };
  const opt = (f: (d: DeviceView) => string) => {
    const m = countBy(f);
    return unique([...m.keys()]).map((v) => ({ value: v, count: m.get(v) }));
  };
  const staleCount = devices.filter((d) => !d.senastInv || daysSince(d.senastInv) >= 90).length;
  const noLabelCount = devices.filter((d) => !d.assetId).length;
  const anyFilter = !!(q || status || klass || modell || kategori || plats || stale || noLabel);

  const clearFilters = () => {
    setQ(''); setStatus(null); setKlass(null); setModell(null); setKategori(null); setPlats(null); setStale(false); setNoLabel(false);
    router.replace('/enheter');
  };

  const closeSheet = () => {
    setOpenSerial(null);
    if (params.get('open')) router.replace('/enheter');
  };

  const doExport = (list: DeviceView[]) =>
    exportXlsx('Enheter', [
      { label: 'AssetID', value: (d) => d.assetId },
      { label: 'Serienummer', value: (d) => d.serial },
      { label: 'Produkt', value: (d) => d.produkt },
      { label: 'Modell', value: (d) => d.modell },
      { label: 'Kategori', value: (d) => d.kategori },
      { label: 'Status', value: (d) => d.status },
      { label: 'Tilldelad till', value: (d) => d.holder?.namn ?? '' },
      { label: 'Klass', value: (d) => d.klass },
      { label: 'Ägandetyp', value: (d) => d.agande },
      { label: 'Plats', value: (d) => d.plats },
      { label: 'Inköpsdatum', value: (d) => d.inkop },
      { label: 'Senast inventerad', value: (d) => d.senastInv },
    ], list);

  const columns: Column<DeviceView>[] = [
    { key: 'assetId', label: 'AssetID', mono: true, render: (r) => (r.assetId ? r.assetId : <Badge tone="amber" icon="label_off">Saknar etikett</Badge>) },
    { key: 'serial', label: 'Serienummer', mono: true },
    {
      key: 'modell', label: 'Modell',
      render: (r) => (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>
          <span style={{ fontWeight: 600 }}>{r.modell || '—'}</span>
          <span className="rk-muted rk-small">{r.produkt}</span>
        </span>
      ),
    },
    { key: 'kategori', label: 'Kategori', render: (r) => (r.kategori ? <Badge tone={r.kategori === 'Elev' ? 'primary' : 'gray'}>{r.kategori}</Badge> : '—') },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'elev', label: 'Tilldelad till', render: (r) => r.holder?.namn ?? <span className="rk-muted">—</span> },
    { key: 'klass', label: 'Klass', render: (r) => r.klass || '—' },
    { key: 'agande', label: 'Ägandetyp', render: (r) => (r.agande ? <Badge>{r.agande}</Badge> : '—') },
    { key: 'plats', label: 'Plats', render: (r) => r.plats || '—' },
    {
      key: 'senastInv', label: 'Senast inventerad',
      render: (r) => (!r.senastInv ? <span className="rk-text--amber" style={{ fontWeight: 600 }}>Aldrig</span> : daysSince(r.senastInv) >= 90 ? <span className="rk-text--amber" style={{ fontWeight: 600 }}>{shortDate(r.senastInv)}</span> : shortDate(r.senastInv)),
    },
  ];

  return (
    <>
      <PageHeader
        title="Enheter"
        description="Alla elev-, lånepool- och personalenheter. Skanna ett serienummer för att öppna enheten direkt."
        actions={
          <>
            <Button variant="outlined" icon="upload_file" onClick={() => router.push('/importera')} disabled={store.readOnly}>Importera</Button>
            <Button icon="add" onClick={() => setEditFor('new')} disabled={store.readOnly}>Ny enhet</Button>
          </>
        }
      />

      {!ready ? (
        <PageState rows={10} />
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              {q && <Chip variant="input" label={`Sök: ${q}`} onRemove={() => { setQ(''); router.replace('/enheter'); }} />}
              <FilterMenu label="Status" value={status} onChange={setStatus} options={DEVICE_STATUSES.map((s) => ({ value: s, count: countBy((d) => d.status).get(s) ?? 0 }))} />
              <FilterMenu label="Klass" value={klass} onChange={setKlass} options={opt((d) => d.klass)} />
              <FilterMenu label="Modell" value={modell} onChange={setModell} options={opt((d) => d.modell)} />
              <FilterMenu label="Kategori" value={kategori} onChange={setKategori} options={opt((d) => d.kategori)} />
              <FilterMenu label="Plats" value={plats} onChange={setPlats} options={opt((d) => d.plats)} />
              <Chip label="Ej inventerad 90 d" count={staleCount} selected={stale} onClick={() => setStale(!stale)} />
              <Chip label="Utan etikett" count={noLabelCount} selected={noLabel} onClick={() => setNoLabel(!noLabel)} />
              {anyFilter && <Button variant="text" size="sm" onClick={clearFilters}>Rensa filter</Button>}
            </div>
            <div className="rk-filterbar__trailing">
              <SegmentedButton label="Vy" value={view} onChange={(v) => setView(v as 'tabell' | 'kort')}
                options={[{ value: 'tabell', label: 'Tabell', icon: 'table_rows' }, { value: 'kort', label: 'Kort', icon: 'grid_view' }]} />
              <IconButton icon={density === 'compact' ? 'density_small' : 'density_medium'} label="Radtäthet" onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} />
              <Button variant="outlined" size="sm" icon="download" onClick={() => doExport(filtered)}>Exportera</Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rk-card" style={{ padding: 0 }}>
              <EmptyState icon="search_off" title="Inga enheter matchar filtret"
                description={devices.length ? 'Prova att ta bort något filter eller sök bredare.' : 'Det finns inga enheter ännu. Importera en lista eller lägg till en enhet.'}
                action={devices.length ? <Button variant="tonal" icon="filter_alt_off" onClick={clearFilters}>Rensa filter</Button> : <Button variant="tonal" icon="upload_file" onClick={() => router.push('/importera')}>Importera enheter</Button>} />
            </div>
          ) : view === 'tabell' ? (
            <DataTable<DeviceView>
              columns={columns}
              rows={rows}
              density={density}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              sort={sort}
              onSort={(k) => setSort((s) => ({ key: k as SortKey, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
              onRowClick={(r) => setOpenSerial(r.serial)}
              bulkActions={[
                { label: 'Ändra status', icon: 'swap_horiz', onClick: () => setBulk('status') },
                { label: 'Skriv ut etiketter', icon: 'print', onClick: () => router.push(`/etiketter?serials=${selectedDevices.map((d) => d.serial).join(',')}`) },
                { label: 'Exportera', icon: 'download', onClick: () => doExport(selectedDevices) },
                { label: 'Flytta plats', icon: 'move_location', onClick: () => setBulk('plats') },
                { label: 'Kassera', icon: 'delete', danger: true, onClick: () => setBulk('kassera') },
              ]}
              footer={
                <>
                  <span>Visar {page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} av {filtered.length}{filtered.length !== devices.length ? ` (totalt ${devices.length})` : ''}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <IconButton icon="chevron_left" label="Föregående sida" disabled={page === 0} onClick={() => setPage(page - 1)} />
                    {page + 1} / {pages}
                    <IconButton icon="chevron_right" label="Nästa sida" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} />
                  </span>
                </>
              }
            />
          ) : (
            <>
              <div className="grid-4">
                {rows.map((d) => (
                  <DeviceCard key={d.id} onClick={() => setOpenSerial(d.serial)}
                    device={{ modell: d.modell, produkt: d.produkt as 'Chromebook', serienummer: d.serial, assetId: d.assetId, status: d.status, elev: d.holder?.namn, klass: d.holder?.klass, plats: d.plats }} />
                ))}
              </div>
              <div className="row small muted" style={{ justifyContent: 'center' }}>
                <IconButton icon="chevron_left" label="Föregående sida" disabled={page === 0} onClick={() => setPage(page - 1)} />
                Sida {page + 1} / {pages} · {filtered.length} enheter
                <IconButton icon="chevron_right" label="Nästa sida" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} />
              </div>
            </>
          )}
        </div>
      )}

      {open && !statusFor && !editFor && !swapFor && !deleteFor && (
        <DeviceSheet device={open} onClose={closeSheet} onChangeStatus={() => setStatusFor(open)} onEdit={() => setEditFor(open)}
          onSwap={() => setSwapFor(open)} onDelete={() => setDeleteFor(open)} />
      )}
      {swapFor && <SwapDialog device={devices.find((d) => d.id === swapFor.id) ?? swapFor} devices={devices} onClose={() => setSwapFor(null)} />}
      {deleteFor && (
        <ConfirmDelete
          title={`Ta bort ${deleteFor.assetId || deleteFor.serial}?`}
          blocked={deleteFor.holder ? `Enheten är ${deleteFor.holder.kind === 'utlaning' ? 'utlånad till' : 'tilldelad'} ${deleteFor.holder.namn}. Återlämna den först.` : null}
          onClose={() => setDeleteFor(null)}
          onConfirm={async () => {
            await deleteRow(store, 'enheter', deleteFor.id, `${deleteFor.assetId || '—'} ${deleteFor.serial} ${deleteFor.modell}`, deleteFor.serial);
            store.toast({ icon: 'delete', message: `${deleteFor.assetId || deleteFor.serial} borttagen` });
            closeSheet();
          }}
        >
          <span>Använd bara Ta bort för felregistrerade enheter (t.ex. dubbletter från en import). En enhet som slutat användas ska få status <b>Kasserad</b> så att historiken finns kvar.</span>
        </ConfirmDelete>
      )}
      {statusFor && <StatusDialog device={devices.find((d) => d.id === statusFor.id) ?? statusFor} devices={devices} onClose={() => setStatusFor(null)} />}
      {editFor && <DeviceForm device={editFor === 'new' ? undefined : editFor} devices={devices} onClose={() => setEditFor(null)} />}
      {bulk && (
        <BulkDialog kind={bulk} devices={selectedDevices} onClose={(done) => { setBulk(null); if (done) setSelected([]); }} />
      )}
    </>
  );
}

function BulkDialog({ kind, devices, onClose }: { kind: 'status' | 'plats' | 'kassera'; devices: DeviceView[]; onClose(done: boolean): void }) {
  const store = useStore();
  const [status, setStatus] = React.useState<DeviceStatus>('Tillgänglig');
  const [plats, setPlats] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const target: DeviceStatus = kind === 'kassera' ? 'Kasserad' : status;
  // Assigned devices would need a per-device decision — skip them in bulk.
  const blocked = kind !== 'plats' ? devices.filter((d) => d.holder && DISCONNECTING.includes(target)) : [];
  const ok = devices.filter((d) => !blocked.includes(d));

  const run = async () => {
    setBusy(true);
    try {
      for (const d of ok) {
        if (kind === 'plats') {
          await store.update('enheter', d.id, { Plats: plats });
          await log(store, { typ: 'Ändring', enhetId: d.serial, detaljer: `Plats: ${d.plats || '—'} → ${plats}` });
        } else if (d.status !== target) {
          await changeDeviceStatus(store, d, target);
        }
      }
      store.toast({ icon: 'check_circle', message: `${ok.length} enheter uppdaterades${blocked.length ? `, ${blocked.length} hoppades över` : ''}` });
      onClose(true);
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      tone={kind === 'kassera' ? 'danger' : 'default'}
      icon={kind === 'kassera' ? 'delete' : kind === 'plats' ? 'move_location' : 'swap_horiz'}
      title={kind === 'kassera' ? `Kassera ${devices.length} enheter?` : kind === 'plats' ? `Flytta ${devices.length} enheter` : `Ändra status för ${devices.length} enheter`}
      actions={
        <>
          <Button variant="text" onClick={() => onClose(false)}>Avbryt</Button>
          <Button variant={kind === 'kassera' ? 'danger' : 'filled'} disabled={busy || store.readOnly || !ok.length || (kind === 'plats' && !plats.trim())} onClick={run}>
            {kind === 'kassera' ? 'Kassera' : 'Spara'}
          </Button>
        </>
      }
    >
      {kind === 'status' && (
        <div>
          <label className="field-label" htmlFor="bulk-status">Ny status</label>
          <select id="bulk-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as DeviceStatus)}>
            {DEVICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      )}
      {kind === 'plats' && (
        <div>
          <label className="field-label" htmlFor="bulk-plats">Ny plats</label>
          <input id="bulk-plats" className="select" value={plats} onChange={(e) => setPlats(e.target.value)} placeholder="IT-förråd" autoFocus />
        </div>
      )}
      {kind === 'kassera' && <span>Enheterna får status Kasserad. Historiken finns kvar och kan ångras genom att ändra status igen.</span>}
      {blocked.length > 0 && (
        <span className="small" style={{ color: 'var(--status-amber)', fontWeight: 600 }}>
          {blocked.length} av enheterna är tilldelade eller utlånade och hoppas över — öppna dem en i taget för att välja Byt enhet eller Återlämna.
        </span>
      )}
    </Dialog>
  );
}

export default function EnheterPage() {
  return (
    <React.Suspense fallback={null}>
      <EnheterInner />
    </React.Suspense>
  );
}
