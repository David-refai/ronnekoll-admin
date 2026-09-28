'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Avatar, Badge, Button, Checkbox, Chip, DataTable, Dialog, EmptyState, IconButton, PageHeader, SegmentedButton, SideSheet,
  StatusBadge, StudentCard, Timeline, type Column, type TimelineEvent,
} from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { deleteStudent, moveStudents } from '@/lib/actions';
import { SwapDialog } from '@/components/enheter/SwapDialog';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { buildDevices, buildStudents, maskPersonnr, searchStudents, unique, type StudentView } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { relDate } from '@/lib/format';
import { str } from '@/lib/lists';
import { useStore } from '@/lib/store';

const PAGE = 50;

function EleverInner() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const params = useSearchParams();

  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);

  const [q, setQ] = React.useState(params.get('q') ?? '');
  const [klass, setKlass] = React.useState<string | null>(params.get('klass'));
  const [utan, setUtan] = React.useState(params.get('utan') === '1');
  const [lan, setLan] = React.useState(false);
  const [view, setView] = React.useState<'tabell' | 'kort'>('tabell');
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'klass', dir: 'asc' });
  const [selected, setSelected] = React.useState<(string | number)[]>([]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [moving, setMoving] = React.useState(false);

  React.useEffect(() => setPage(0), [q, klass, utan, lan]);

  const filtered = React.useMemo(() => {
    let list = searchStudents(students, q);
    if (klass) list = list.filter((s) => s.klass === klass);
    if (utan) list = list.filter((s) => !s.device);
    if (lan) list = list.filter((s) => s.loans.length > 0);
    const val = (s: StudentView) =>
      sort.key === 'enhet' ? s.device?.assetId || s.device?.serial || '' : sort.key === 'klass' ? `${s.klass} ${s.namn}` : String((s as unknown as Record<string, unknown>)[sort.key] ?? '');
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => val(a).localeCompare(val(b), 'sv', { numeric: true }) * dir);
  }, [students, q, klass, utan, lan, sort]);

  const classes = unique(students.map((s) => s.klass));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const open = openId ? students.find((s) => s.id === openId) : undefined;
  const selectedStudents = students.filter((s) => selected.includes(s.id));
  const withoutCount = students.filter((s) => !s.device).length;
  const loanCount = students.filter((s) => s.loans.length).length;

  const doExport = (list: StudentView[]) =>
    exportXlsx('Elever', [
      { label: 'Namn', value: (s) => s.namn },
      { label: 'ElevID', value: (s) => s.elevId },
      { label: 'E-post', value: (s) => s.epost },
      { label: 'Klass', value: (s) => s.klass },
      { label: 'Skåpnummer', value: (s) => s.skap },
      { label: 'Enhet (AssetID)', value: (s) => s.device?.assetId ?? '' },
      { label: 'Serienummer', value: (s) => s.device?.serial ?? '' },
      { label: 'Enhetsstatus', value: (s) => s.device?.status ?? 'Ingen enhet' },
      { label: 'Aktiva lån', value: (s) => s.loans.length },
    ], list);

  const columns: Column<StudentView>[] = [
    {
      key: 'namn', label: 'Namn',
      render: (s) => (
        <span className="row" style={{ gap: 10 }}>
          <Avatar name={s.namn} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>
            <span style={{ fontWeight: 600 }}>{s.namn}</span>
            <span className="rk-muted rk-small">{s.epost}</span>
          </span>
        </span>
      ),
    },
    { key: 'elevId', label: 'ElevID', mono: true },
    { key: 'klass', label: 'Klass' },
    { key: 'skap', label: 'Skåp', render: (s) => s.skap || '—' },
    {
      key: 'enhet', label: 'Enhet',
      render: (s) => (s.device ? <span className="row" style={{ gap: 8 }}><span className="rk-mono">{s.device.assetId || s.device.serial}</span><StatusBadge status={s.device.status} noIcon /></span> : <span className="rk-muted">Ingen enhet</span>),
    },
    { key: 'lan', label: 'Aktiva lån', sortable: false, render: (s) => (s.loans.length ? <StatusBadge status="Aktiv" label={`${s.loans.length} lån`} /> : '—') },
  ];

  return (
    <>
      <PageHeader
        title="Elever"
        description={`${students.length} elever. Klicka på en elev för enhet, historik och lån.`}
        actions={<Button icon="download" variant="outlined" onClick={() => doExport(filtered)}>Exportera</Button>}
      />
      {!ready ? (
        <PageState rows={10} />
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="rk-filterbar">
            <div className="rk-filterbar__chips">
              <input className="select" style={{ width: 260, borderRadius: 9999 }} placeholder="Filtrera på namn, e-post, ElevID…" value={q} onChange={(e) => setQ(e.target.value)} />
              <FilterMenu label="Klass" value={klass} onChange={setKlass} options={classes.map((k) => ({ value: k, count: students.filter((s) => s.klass === k).length }))} />
              <Chip label="Utan enhet" count={withoutCount} selected={utan} onClick={() => setUtan(!utan)} />
              <Chip label="Har aktivt lån" count={loanCount} selected={lan} onClick={() => setLan(!lan)} />
              {(q || klass || utan || lan) && <Button variant="text" size="sm" onClick={() => { setQ(''); setKlass(null); setUtan(false); setLan(false); router.replace('/elever'); }}>Rensa filter</Button>}
            </div>
            <div className="rk-filterbar__trailing">
              <SegmentedButton label="Vy" value={view} onChange={(v) => setView(v as 'tabell' | 'kort')}
                options={[{ value: 'tabell', label: 'Tabell', icon: 'table_rows' }, { value: 'kort', label: 'Kort', icon: 'grid_view' }]} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rk-card" style={{ padding: 0 }}>
              <EmptyState icon="search_off" title="Inga elever matchar filtret" description="Ta bort något filter eller sök bredare." />
            </div>
          ) : view === 'tabell' ? (
            <DataTable<StudentView>
              columns={columns}
              rows={rows}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              sort={sort}
              onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
              onRowClick={(s) => setOpenId(s.id)}
              bulkActions={[
                { label: 'Flytta till klass', icon: 'drive_file_move', onClick: () => setMoving(true) },
                { label: 'Exportera', icon: 'download', onClick: () => doExport(selectedStudents) },
              ]}
              footer={
                <>
                  <span>Visar {page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} av {filtered.length}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <IconButton icon="chevron_left" label="Föregående sida" disabled={page === 0} onClick={() => setPage(page - 1)} />
                    {page + 1} / {pages}
                    <IconButton icon="chevron_right" label="Nästa sida" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} />
                  </span>
                </>
              }
            />
          ) : (
            <div className="grid-4">
              {rows.map((s) => (
                <StudentCard key={s.id} onClick={() => setOpenId(s.id)}
                  student={{ namn: s.namn, epost: s.epost, klass: s.klass, skap: s.skap || undefined, tagg: !!s.tagg && s.tagg !== 'Nej', enhet: s.device ? s.device.assetId || s.device.serial : undefined, lan: s.loans.length }} />
              ))}
            </div>
          )}
        </div>
      )}

      {open && <StudentSheet student={open} onClose={() => setOpenId(null)} />}
      {moving && <MoveDialog students={selectedStudents} classes={classes} onClose={(done) => { setMoving(false); if (done) setSelected([]); }} />}
    </>
  );
}

function StudentSheet({ student: s, onClose }: { student: StudentView; onClose(): void }) {
  const store = useStore();
  const router = useRouter();
  const [reveal, setReveal] = React.useState(false);
  const [swap, setSwap] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const keys = [s.elevId, s.epost].filter(Boolean).map((k) => k.toLowerCase());
  const mine = (r: Record<string, unknown>) => keys.includes(str(r.ElevID).toLowerCase()) || keys.includes(str(r.ElevEpost).toLowerCase());

  const events: (TimelineEvent & { t: string })[] = [
    ...store.data.tilldelningar.filter(mine).map((r) => ({ t: str(r.Tilldelningsdatum) || r._created, type: 'tilldelning' as const, title: `Tilldelad ${str(r.EnhetID)}${str(r.SignaturStatus) ? ' · ' + str(r.SignaturStatus) : ''}`, time: relDate(r.Tilldelningsdatum || r._created) })),
    ...store.data.aterlamningar.filter(mine).map((r) => ({ t: str(r['Återlämningsdatum']) || r._created, type: 'aterlamning' as const, title: `Återlämnade ${str(r.EnhetID)}${r.Skadebeskrivning ? ' · ' + str(r.Skadebeskrivning) : ''}`, time: relDate(r['Återlämningsdatum'] || r._created) })),
    ...store.data.utlaningar.filter(mine).map((r) => ({ t: str(r['Utlåningsdatum']) || r._created, type: 'utlaning' as const, title: `Lånade ${str(r.EnhetID)} · ${str(r.Status)}`, time: relDate(r['Utlåningsdatum'] || r._created) })),
  ].sort((a, b) => b.t.localeCompare(a.t));
  const pw = store.data.losenord.filter((p) => keys.includes(str(p.ElevEpost).toLowerCase()) || str(p.Title) === s.namn);

  return (
    <SideSheet
      open
      onClose={onClose}
      overline={`Elev · ${s.klass}`}
      title={s.namn}
      subtitle={<span className="small muted">{s.epost}</span>}
      actions={
        s.device ? (
          <>
            <Button variant="danger-text" icon="delete" disabled={store.readOnly} onClick={() => setDel(true)}>Ta bort</Button>
            <Button variant="outlined" icon="swap_horiz" disabled={store.readOnly} onClick={() => setSwap(true)}>Byt enhet</Button>
            <Button variant="outlined" icon="schedule" onClick={() => router.push(`/utlaning?elev=${encodeURIComponent(s.elevId || s.epost)}`)}>Låna ut</Button>
            <Button icon="assignment_return" onClick={() => router.push(`/aterlamning?enhet=${encodeURIComponent(s.device!.serial)}`)}>Återlämna</Button>
          </>
        ) : (
          <>
            <Button variant="danger-text" icon="delete" disabled={store.readOnly} onClick={() => setDel(true)}>Ta bort</Button>
            <Button variant="outlined" icon="schedule" onClick={() => router.push(`/utlaning?elev=${encodeURIComponent(s.elevId || s.epost)}`)}>Låna ut</Button>
            <Button icon="assignment_ind" onClick={() => router.push(`/tilldelning?elev=${encodeURIComponent(s.elevId || s.epost)}`)}>Tilldela enhet</Button>
          </>
        )
      }
    >
      <div className="rk-card" style={{ boxShadow: 'none', background: 'var(--surface-container-low)', marginBottom: 16 }}>
        {s.device ? (
          <button type="button" className="picker-row" style={{ padding: 0 }} onClick={() => router.push(`/enheter?open=${encodeURIComponent(s.device!.serial)}`)}>
            <span className="rk-kpi__icon rk-tone--blue"><span className="rk-icon" style={{ fontSize: 22 }}>laptop_chromebook</span></span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <b>{s.device.modell}</b>
              <span className="small mono" style={{ display: 'block' }}>{s.device.serial}{s.device.assetId ? ` · ${s.device.assetId}` : ''}</span>
            </span>
            <StatusBadge status={s.device.status} />
          </button>
        ) : (
          <span className="muted">Ingen tilldelad enhet.</span>
        )}
      </div>
      <dl className="kv">
        <dt>ElevID</dt><dd className="mono">{s.elevId || '—'}</dd>
        <dt>Klass</dt><dd>{s.klass || '—'}</dd>
        <dt>Personnr</dt>
        <dd className="row" style={{ gap: 8 }}>
          <span className="mono">{reveal ? s.personnr || '—' : maskPersonnr(s.personnr)}</span>
          {s.personnr && <Button variant="text" size="sm" icon={reveal ? 'visibility_off' : 'visibility'} onClick={() => setReveal(!reveal)}>{reveal ? 'Dölj' : 'Visa'}</Button>}
        </dd>
        <dt>Skåpnummer</dt><dd>{s.skap || '—'}</dd>
        <dt>Tagg</dt><dd>{s.tagg || '—'}</dd>
        <dt>Aktiva lån</dt><dd>{s.loans.length ? s.loans.map((l) => str(l.EnhetID)).join(', ') : '—'}</dd>
        <dt>Lösenordsbegäran</dt><dd>{pw.length ? pw.map((p) => `${str(p.Status)} (${relDate(p.Datum || p._created, false)})`).join(', ') : '—'}</dd>
      </dl>
      <h3 className="section-title" style={{ fontSize: 16, margin: '24px 0 12px' }}>Historik</h3>
      {events.length ? <Timeline events={events} /> : <p className="small muted">Ingen historik.</p>}
      {swap && s.device && <SwapDialog device={s.device} devices={devices} onClose={() => setSwap(false)} />}
      {del && (
        <ConfirmDelete
          title={`Ta bort ${s.namn}?`}
          blocked={s.device ? `${s.namn} har ${s.device.assetId || s.device.serial}. Återlämna enheten först.` : s.loans.length ? `${s.namn} har ett aktivt lån. Återlämna det först.` : null}
          onClose={() => setDel(false)}
          onConfirm={async () => {
            await deleteStudent(store, s);
            store.toast({ icon: 'delete', message: `${s.namn} borttagen` });
            onClose();
          }}
        >
          <span>{s.namn} ({s.klass}, {s.epost || s.elevId}) tas bort från Elever. Historiken i Tilldelningar, Återlämningar och Aktivitetslogg finns kvar.</span>
        </ConfirmDelete>
      )}
    </SideSheet>
  );
}

function MoveDialog({ students, classes, onClose }: { students: StudentView[]; classes: string[]; onClose(done: boolean): void }) {
  const store = useStore();
  const [klass, setKlass] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [alsoDevice, setAlsoDevice] = React.useState(true);
  const run = async () => {
    setBusy(true);
    try {
      await moveStudents(store, students, klass);
      if (alsoDevice) {
        for (const s of students) if (s.device) await store.update('enheter', s.device.id, { TillhorKlass: klass });
      }
      store.toast({ icon: 'check_circle', message: `${students.length} elever flyttade till ${klass}` });
      onClose(true);
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={() => onClose(false)} icon="drive_file_move" title={`Flytta ${students.length} elever`}
      actions={<><Button variant="text" onClick={() => onClose(false)}>Avbryt</Button><Button disabled={!klass.trim() || busy || store.readOnly} onClick={run}>Flytta</Button></>}>
      <div>
        <label className="field-label" htmlFor="mv-klass">Till klass</label>
        <input id="mv-klass" className="select" list="mv-classes" value={klass} onChange={(e) => setKlass(e.target.value.toUpperCase())} placeholder="8A" autoFocus />
        <datalist id="mv-classes">{classes.map((k) => <option key={k} value={k} />)}</datalist>
      </div>
      <Checkbox showLabel label="Uppdatera även enhetens klass (TillhorKlass)" checked={alsoDevice} onChange={setAlsoDevice} />
      <span className="small muted">{students.slice(0, 6).map((s) => s.namn).join(', ')}{students.length > 6 ? ` och ${students.length - 6} till` : ''}</span>
    </Dialog>
  );
}

export default function EleverPage() {
  return (
    <React.Suspense fallback={null}>
      <EleverInner />
    </React.Suspense>
  );
}
