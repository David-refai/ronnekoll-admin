'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Banner, Button, DataTable, EmptyState, PageHeader, StatusBadge, type Column } from '@/ds';
import { DevicePicker, StudentPicker } from '@/components/Pickers';
import { PageState, useReady } from '@/components/PageState';
import { lendDevice, returnLoan } from '@/lib/actions';
import { buildDevices, buildStudents, serialKey, type DeviceView, type StudentView } from '@/lib/derive';
import { relDate, todayIso } from '@/lib/format';
import { str, withId, type Row, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

function UtlaningInner() {
  const store = useStore();
  const ready = useReady();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);

  const [student, setStudent] = React.useState<StudentView | null>(null);
  const [device, setDevice] = React.useState<DeviceView | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const id = params.get('elev')?.toLowerCase();
    if (id && !student) setStudent(students.find((s) => s.elevId.toLowerCase() === id || s.epost.toLowerCase() === id) ?? null);
  }, [params, students, student]);

  const free = (d: DeviceView) => d.status === 'Tillgänglig' && !d.holder;
  // Prefer the loan pool, but any free device can be lent.
  const sortedDevices = React.useMemo(
    () => [...devices].sort((a, b) => Number(b.kategori === 'Lånepool') - Number(a.kategori === 'Lånepool')),
    [devices],
  );

  const today = todayIso();
  const active = store.data.utlaningar
    .filter((l) => str(l.Status) === 'Aktiv')
    .sort((a, b) => str(a['Utlåningsdatum'] || a._created).localeCompare(str(b['Utlåningsdatum'] || b._created)));
  const overdue = (l: Row) => str(l['Utlåningsdatum'] || l._created).slice(0, 10) < today;
  const current = student ? students.find((s) => s.id === student.id) ?? student : null;

  const lend = async () => {
    if (!current || !device) return;
    setBusy(true);
    try {
      await lendDevice(store, current, device);
      store.toast({ icon: 'check_circle', message: `${device.assetId || device.serial} utlånad till ${current.namn}` });
      setStudent(null);
      setDevice(null);
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const giveBack = async (l: Row) => {
    const d = devices.find((x) => serialKey(x.serial) === serialKey(l.EnhetID));
    try {
      await returnLoan(store, l, d);
      store.toast({ icon: 'assignment_return', message: `${str(l.ElevNamn)} lämnade tillbaka ${d?.assetId || str(l.EnhetID)}` });
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const columns: Column<TRow>[] = [
    { key: 'ElevNamn', label: 'Elev', render: (l) => <b>{str(l.ElevNamn) || str(l.Title)}</b> },
    { key: 'Klass', label: 'Klass', render: (l) => str(l.Klass) || '—' },
    { key: 'EnhetID', label: 'Enhet', mono: true, render: (l) => { const d = devices.find((x) => serialKey(x.serial) === serialKey(l.EnhetID)); return d?.assetId || str(l.EnhetID); } },
    { key: 'Utlåningsdatum', label: 'Utlånad', render: (l) => relDate(l['Utlåningsdatum'] || l._created) },
    { key: 'Status', label: 'Status', render: (l) => <StatusBadge status={overdue(l) ? 'Försenad' : 'Aktiv'} /> },
    { key: 'x', label: '', align: 'right', render: (l) => <Button size="sm" variant="tonal" icon="assignment_return" disabled={store.readOnly} onClick={(e) => { e.stopPropagation(); giveBack(l); }}>Återlämna</Button> },
  ];

  return (
    <>
      <PageHeader title="Tillfällig utlåning" description="För elever som glömt sin dator. Välj elev och en ledig enhet — lånet ska tillbaka samma dag." />
      {!ready ? <PageState /> : (
        <>
          <div className="two-col">
            <section className="rk-card">
              <h2 className="step-title"><span className="step-num">1</span>Välj elev</h2>
              <StudentPicker students={students} value={current} onChange={setStudent} autoFocus />
              {current && current.loans.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Banner tone="warning" title={`${current.namn} har redan ${current.loans.length} aktivt lån`}>
                    {current.loans.map((l) => `${str(l.EnhetID)} sedan ${relDate(l['Utlåningsdatum'] || l._created)}`).join(', ')}. Återlämna det först om möjligt.
                  </Banner>
                </div>
              )}
            </section>
            <section className="rk-card">
              <h2 className="step-title"><span className="step-num">2</span>Välj ledig enhet</h2>
              <DevicePicker devices={sortedDevices} value={device} onChange={setDevice} allow={free}
                reason={(d) => `${d.assetId || d.serial} är ${d.status.toLowerCase()}${d.holder ? ' (' + d.holder.namn + ')' : ''}.`} />
            </section>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button icon="schedule" disabled={!current || !device || busy || store.readOnly} onClick={lend}>
              {current && device ? `Låna ut ${device.assetId || device.serial} till ${current.namn.split(' ')[0]}` : 'Låna ut'}
            </Button>
          </div>

          <section className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="section-title">Aktiva lån</h2>
              <span className="small muted">{active.length} aktiva · {active.filter(overdue).length} försenade</span>
            </div>
            {active.length ? (
              <DataTable<TRow> columns={columns} rows={withId(active)} />
            ) : (
              <div className="rk-card" style={{ padding: 0 }}><EmptyState compact icon="task_alt" tone="green" title="Inga aktiva lån" description="Alla tillfälliga lån är återlämnade." /></div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default function UtlaningPage() {
  return (
    <React.Suspense fallback={null}>
      <UtlaningInner />
    </React.Suspense>
  );
}
