'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, DataTable, EmptyState, IconButton, KpiCard, PageHeader, SegmentedButton, StatusBadge, type Column, type Status } from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { ProvisionLists } from '@/components/ProvisionLists';
import { buildDevices, unique } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { shortDate } from '@/lib/format';
import { LATE_DAYS, WARRANTY_YEARS, buildRepairs, repairStatus, type RepairView } from '@/lib/repair';
import { str } from '@/lib/lists';
import { useStore } from '@/lib/store';

type RRow = RepairView & { id: string };

const two = (a: React.ReactNode, b: React.ReactNode, mono = false) => (
  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>
    <span className={mono ? 'mono' : undefined} style={{ fontWeight: 600 }}>{a}</span>
    <span className="rk-muted rk-small">{b}</span>
  </span>
);

export default function Reparationer() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const all = React.useMemo(() => buildRepairs(store.data, devices).sort((a, b) => b.skickad.localeCompare(a.skickad)), [store.data, devices]);
  const [tab, setTab] = React.useState('ute');
  const [lev, setLev] = React.useState<string | null>(null);
  const [gar, setGar] = React.useState<string | null>(null);

  const missing = store.mode === 'live' && store.connection && !store.connection.lists.reparationer;
  const out = all.filter((r) => r.out);
  const back = all.filter((r) => !r.out);
  const recent = back.filter((r) => Date.now() - new Date(r.mottagen || r.skickad).getTime() < 90 * 86400000);
  const avg = recent.length ? Math.round(recent.reduce((s, r) => s + r.days, 0) / recent.length) : null;
  const back30 = back.filter((r) => Date.now() - new Date(r.mottagen || r.skickad).getTime() < 30 * 86400000).length;

  const base = tab === 'ute' ? out : tab === 'tillbaka' ? back : all;
  const rows = base.filter((r) => (!lev || r.lev === lev) && (!gar || r.warranty.state === gar));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      store.toast({ icon: 'content_copy', message: `Kollinummer ${text} kopierat` });
    } catch {
      store.toast({ icon: 'error', message: 'Kunde inte kopiera' });
    }
  };

  const cols: Column<RRow>[] = [
    { key: 'enhet', label: 'Enhet', render: (r) => two(`${r.device?.assetId || '—'} · ${r.serial}`, r.device?.modell || 'Okänd enhet', true) },
    {
      key: 'fel', label: 'Felanmälan',
      render: (r) => two(str(r.fault?.TypAvFel) || str(r.fault?.Beskrivning) || '—', r.device?.holder ? `${r.device.holder.namn} · ${r.device.holder.klass}` : r.device?.kategori === 'Personal' ? 'Personal' : 'Ingen elev'),
    },
    {
      key: 'kolli', label: 'Kollinummer', sortable: false,
      render: (r) => r.kolli ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <span className="mono" style={{ fontSize: 13 }}>{r.kolli}</span>
          <IconButton icon="content_copy" label="Kopiera kollinummer" onClick={() => copy(r.kolli)} />
        </span>
      ) : <span className="rk-muted">—</span>,
    },
    { key: 'lev', label: 'Leverantör', render: (r) => two(r.lev || '—', r.arende ? `Ärende ${r.arende}` : '—') },
    {
      key: 'skickad', label: 'Skickad',
      render: (r) => two(shortDate(r.skickad), r.out ? <span className={r.late ? 'rk-text--red' : undefined} style={r.late ? { color: 'var(--status-red)', fontWeight: 600 } : undefined}>{r.days} dagar borta</span> : `tillbaka ${shortDate(r.mottagen)} · ${r.days} d`),
    },
    {
      key: 'garanti', label: 'Garanti',
      render: (r) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <StatusBadge status={r.warranty.state} />
          <span className="rk-muted rk-small">{r.warranty.text}</span>
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={repairStatus(r) as Status} /> },
  ];
  // Out: the parcel number matters, the status is always "skickad". Back: show the outcome instead.
  const shown = cols.filter((c) => (tab === 'ute' ? c.key !== 'status' : c.key !== 'kolli'));

  return (
    <>
      <PageHeader
        title="Reparationer"
        description="Enheter som skickats till leverantör. Skanna kollinumret när du skickar och enheten när den kommer tillbaka."
        actions={<>
          <Button variant="outlined" icon="move_to_inbox" disabled={!out.length} onClick={() => router.push('/reparationer/ta-emot')}>Ta emot</Button>
          <Button icon="local_shipping" disabled={store.readOnly || !!missing} onClick={() => router.push('/reparationer/skicka')}>Skicka på reparation</Button>
        </>}
      />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <ProvisionLists keys={['reparationer']} />
          <div className="grid-4">
            <KpiCard label="Ute på reparation" value={out.length} icon="local_shipping" tone="orange" onClick={() => setTab('ute')} />
            <KpiCard label={`Borta mer än ${LATE_DAYS} dagar`} value={out.filter((r) => r.late).length} icon="schedule" tone="red" onClick={() => setTab('ute')} />
            <KpiCard label="Inom garanti" value={out.filter((r) => r.warranty.state !== 'Garanti utgången' && r.warranty.state !== 'Inköpsdatum saknas').length} icon="verified_user" tone="green" delta={`av ${out.length} ute`} />
            <KpiCard label="Snitt tid hos leverantör" value={avg == null ? '—' : `${avg} d`} icon="timer" tone="gray" delta="senaste 90 dagarna" />
          </div>

          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              <SegmentedButton label="Visa" value={tab} onChange={setTab}
                options={[{ value: 'ute', label: `Ute (${out.length})` }, { value: 'tillbaka', label: 'Tillbaka' }, { value: 'alla', label: 'Alla' }]} />
              <FilterMenu label="Leverantör" value={lev} onChange={setLev} options={unique(all.map((r) => r.lev)).map((v) => ({ value: v, count: base.filter((r) => r.lev === v).length }))} />
              <FilterMenu label="Garanti" value={gar} onChange={setGar} options={unique(all.map((r) => r.warranty.state)).map((v) => ({ value: v, count: base.filter((r) => r.warranty.state === v).length }))} />
            </div>
            <div className="rk-filterbar__trailing">
              <Button variant="outlined" size="sm" icon="download" disabled={!rows.length} onClick={() => exportXlsx('Reparationer', [
                { label: 'AssetID', value: (r: RRow) => r.device?.assetId ?? '' }, { label: 'Serienummer', value: (r) => r.serial }, { label: 'Modell', value: (r) => r.device?.modell ?? '' },
                { label: 'Fel', value: (r) => str(r.fault?.TypAvFel) || str(r.fault?.Beskrivning) }, { label: 'Elev', value: (r) => r.device?.holder?.namn ?? '' },
                { label: 'Kollinummer', value: (r) => r.kolli }, { label: 'Leverantör', value: (r) => r.lev }, { label: 'Ärendenummer', value: (r) => r.arende },
                { label: 'Skickad', value: (r) => r.skickad }, { label: 'Mottagen', value: (r) => r.mottagen }, { label: 'Dagar', value: (r) => String(r.days) },
                { label: 'Garanti', value: (r) => `${r.warranty.state} ${r.warranty.text}` }, { label: 'Status', value: (r) => repairStatus(r) }, { label: 'Åtgärd', value: (r) => r.atgard },
              ], rows)}>Exportera</Button>
            </div>
          </div>

          {rows.length ? (
            <DataTable<RRow> columns={shown} rows={rows} density="compact"
              onRowClick={(r) => (r.out ? router.push(`/reparationer/ta-emot?enhet=${encodeURIComponent(r.serial)}`) : r.device && router.push(`/enheter?open=${encodeURIComponent(r.device.serial)}`))}
              footer={<><span>Garanti räknas från inköpsdatum + {WARRANTY_YEARS} år</span><span>{out.length} ute · {back30} tillbaka senaste 30 dagarna</span></>} />
          ) : (
            <div className="rk-card" style={{ padding: 0 }}>
              <EmptyState icon={tab === 'ute' ? 'task_alt' : 'home_repair_service'} tone={tab === 'ute' ? 'green' : undefined}
                title={tab === 'ute' ? 'Inga enheter ute på reparation' : 'Inga reparationer'}
                description={tab === 'ute' ? 'Allt är hemma.' : 'Skicka en enhet från en felanmälan eller skanna den direkt.'}
                action={!missing ? <Button variant="tonal" icon="local_shipping" onClick={() => router.push('/reparationer/skicka')}>Skicka på reparation</Button> : undefined} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
