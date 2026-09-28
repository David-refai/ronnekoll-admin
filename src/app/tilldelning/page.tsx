'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Avatar, Badge, Banner, Button, EmptyState, Icon, PageHeader, ScanCounters, ScanFeedback, SearchBar, SegmentedButton, SignaturePad, Switch, TextField,
} from '@/ds';
import { DevicePicker, StudentPicker } from '@/components/Pickers';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { assignDevice } from '@/lib/actions';
import { buildDevices, buildStudents, serialKey, unique, type DeviceView, type StudentView } from '@/lib/derive';
import { useStore } from '@/lib/store';

const free = (d: DeviceView) => d.status === 'Tillgänglig' && !d.holder;

function TilldelningInner() {
  const store = useStore();
  const ready = useReady();
  const params = useSearchParams();
  const [mode, setMode] = React.useState<'en' | 'klass'>('en');
  return (
    <>
      <PageHeader
        title="Tilldelning"
        description="Dela ut en enhet till en elev — eller en hel klass i taget."
        actions={<SegmentedButton label="Läge" value={mode} onChange={(v) => setMode(v as 'en' | 'klass')}
          options={[{ value: 'en', label: 'En elev', icon: 'person' }, { value: 'klass', label: 'Klassutdelning', icon: 'groups' }]} />}
      />
      {!ready ? <PageState /> : mode === 'en' ? <Single params={params} /> : <ClassStation />}
      {store.readOnly && <Banner tone="error" title="Token saknas eller har gått ut">Du kan inte spara tilldelningar just nu.</Banner>}
    </>
  );
}

function Single({ params }: { params: URLSearchParams }) {
  const store = useStore();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);
  const [student, setStudent] = React.useState<StudentView | null>(null);
  const [device, setDevice] = React.useState<DeviceView | null>(null);
  const [contract, setContract] = React.useState(true);
  const [signNow, setSignNow] = React.useState(false);
  const [signed, setSigned] = React.useState(false);
  const [signer, setSigner] = React.useState('');
  const [guardian, setGuardian] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const e = params.get('elev')?.toLowerCase();
    if (e && !student) setStudent(students.find((s) => s.elevId.toLowerCase() === e || s.epost.toLowerCase() === e) ?? null);
    const d = params.get('enhet');
    if (d && !device) setDevice(devices.find((x) => serialKey(x.serial) === serialKey(d)) ?? null);
  }, [params, students, devices, student, device]);

  const cur = student ? students.find((s) => s.id === student.id) ?? student : null;

  const reset = () => { setStudent(null); setDevice(null); setSigned(false); setSigner(''); setGuardian(''); setSignNow(false); };

  const submit = async () => {
    if (!cur || !device) return;
    setBusy(true);
    try {
      await assignDevice(store, cur, device, { contractRequired: contract, signed: contract && signNow && signed, signer: signer || guardian, guardian });
      store.toast({ icon: 'check_circle', message: `${device.assetId || device.serial} tilldelad ${cur.namn}${contract && !(signNow && signed) ? ' · avtal väntar signatur' : ''}` });
      reset();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = cur && device && (!contract || !signNow || (signed && (signer || guardian)));

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="two-col">
        <section className="rk-card">
          <h2 className="step-title"><span className="step-num">1</span>Välj elev</h2>
          <StudentPicker students={students} value={cur} onChange={setStudent} autoFocus />
          {cur?.device && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="warning" title={`${cur.namn} har redan en enhet`}>
                {cur.device.assetId || cur.device.serial} ({cur.device.status}). Återlämna den först, eller fortsätt om eleven ska ha två.
              </Banner>
            </div>
          )}
        </section>
        <section className="rk-card">
          <h2 className="step-title"><span className="step-num">2</span>Skanna enhet</h2>
          <DevicePicker devices={devices} value={device} onChange={setDevice} allow={free}
            reason={(d) => `${d.assetId || d.serial} är ${d.status.toLowerCase()}${d.holder ? ' hos ' + d.holder.namn : ''} — välj en tillgänglig enhet.`} />
        </section>
      </div>

      <section className="rk-card stack" style={{ gap: 16 }}>
        <h2 className="step-title" style={{ margin: 0 }}><span className="step-num">3</span>Kontrakt</h2>
        <Switch checked={contract} onChange={setContract} label={<span><b>Kontrakt krävs</b> — vårdnadshavare ska signera låneavtalet</span>} />
        {contract && (
          <>
            <Switch checked={signNow} onChange={setSignNow} label="Signera nu på skärmen (annars: Väntar signatur, slutför senare)" />
            {signNow && (
              <div className="two-col">
                <div className="stack">
                  <TextField label="Vårdnadshavare" value={guardian} onChange={(e) => setGuardian(e.target.value)} placeholder="Namn på vårdnadshavare" />
                  <TextField label="Signerat av" value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Vårdnadshavare eller elev" />
                </div>
                <SignaturePad label="Signatur" signer={signer || guardian} onSign={() => setSigned(true)} onClear={() => setSigned(false)} />
              </div>
            )}
          </>
        )}
      </section>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={reset}>Rensa</Button>
        <Button icon="assignment_ind" disabled={!canSubmit || busy || store.readOnly} onClick={submit}>
          {cur && device ? `Tilldela ${device.assetId || device.serial} till ${cur.namn.split(' ')[0]}` : 'Tilldela'}
        </Button>
      </div>
    </div>
  );
}

/** Klassutdelning: pick a class, pick the next student, scan — repeat. */
function ClassStation() {
  const store = useStore();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);
  const classes = unique(students.map((s) => s.klass));
  const [klass, setKlass] = React.useState<string | null>(null);
  const [selId, setSelId] = React.useState<string | null>(null);
  const [scan, setScan] = React.useState('');
  const [fb, setFb] = React.useState<{ state: 'success' | 'warning' | 'error'; title: string; serial?: string; detail?: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const list = klass ? students.filter((s) => s.klass === klass).sort((a, b) => a.namn.localeCompare(b.namn, 'sv')) : [];
  const doneCount = list.filter((s) => s.device).length;
  const nextStudent = list.find((s) => !s.device);
  const sel = list.find((s) => s.id === selId) ?? nextStudent ?? null;

  const onScan = async (raw: string) => {
    const k = serialKey(raw);
    setScan('');
    if (!sel) return;
    const d = devices.find((x) => serialKey(x.serial) === k || (x.assetId && serialKey(x.assetId) === k));
    if (!d) return setFb({ state: 'error', title: 'Okänd enhet', serial: raw, detail: 'Finns inte i Enheter. Importera den först.' });
    if (!free(d)) return setFb({ state: 'warning', title: `Enheten är ${d.status.toLowerCase()}`, serial: d.assetId || d.serial, detail: d.holder ? `Hos ${d.holder.namn} (${d.holder.klass})` : undefined });
    setBusy(true);
    try {
      await assignDevice(store, sel, d, { contractRequired: true, signed: false, signer: '', guardian: '' });
      setFb({ state: 'success', title: `Tilldelad ${sel.namn}`, serial: d.assetId || d.serial, detail: 'Avtal väntar signatur' });
      setSelId(null);
    } catch (e) {
      setFb({ state: 'error', title: 'Kunde inte spara', detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <FilterMenu label="Klass" value={klass} onChange={(k) => { setKlass(k); setSelId(null); setFb(null); }} options={classes.map((k) => ({ value: k, count: students.filter((s) => s.klass === k).length }))} />
        {klass && <ScanCounters items={[
          { label: 'Klara', value: doneCount, total: list.length, tone: 'green', icon: 'check_circle' },
          { label: 'Kvar', value: list.length - doneCount, tone: 'amber', icon: 'pending' },
          { label: 'Lediga enheter', value: devices.filter(free).length, tone: 'gray', icon: 'inventory_2' },
        ]} />}
      </div>
      {!klass ? (
        <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="groups" title="Välj en klass" description="Välj klass, sedan skannar du en enhet per elev. Eleverna utan enhet kommer i tur och ordning." /></div>
      ) : (
        <div className="grid-7-5">
          <section className="rk-card stack" style={{ gap: 16 }}>
            {sel ? (
              <>
                <div className="row">
                  <Avatar name={sel.namn} size="lg" />
                  <div><div className="small muted">Nästa elev</div><b style={{ fontSize: 20 }}>{sel.namn}</b><div className="small muted">{sel.epost}{sel.skap ? ` · skåp ${sel.skap}` : ''}</div></div>
                </div>
                <SearchBar size="lg" scanning autoFocus shortcut={false} placeholder="Skanna enhetens streckkod" value={scan} disabled={busy}
                  onChange={(e) => setScan(e.target.value)} onSubmit={onScan} />
              </>
            ) : (
              <EmptyState compact icon="task_alt" tone="green" title={`Alla i ${klass} har en enhet`} description="Välj en annan klass för att fortsätta." />
            )}
            {fb && <ScanFeedback state={fb.state} title={fb.title} serial={fb.serial} detail={fb.detail} />}
          </section>
          <section className="rk-card" style={{ padding: 8, maxHeight: 640, overflow: 'auto' }}>
            {list.map((s) => (
              <button key={s.id} type="button" className="picker-row" onClick={() => !s.device && setSelId(s.id)} style={sel?.id === s.id ? { background: 'var(--primary-container)', color: 'var(--on-primary-container)' } : undefined}>
                <Icon name={s.device ? 'check_circle' : 'radio_button_unchecked'} size={20} fill={!!s.device} className={s.device ? 'rk-text--green' : undefined} />
                <span style={{ flex: 1, textAlign: 'left' }}>{s.namn}</span>
                {s.device ? <Badge tone="blue">{s.device.assetId || s.device.serial}</Badge> : null}
              </button>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

export default function TilldelningPage() {
  return (
    <React.Suspense fallback={null}>
      <TilldelningInner />
    </React.Suspense>
  );
}
