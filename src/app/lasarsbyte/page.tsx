'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Banner, Button, Checkbox, DataTable, EmptyState, PageHeader, StatusBadge, Stepper, type Column } from '@/ds';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { buildDevices, buildStudents, unique, type StudentView } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { useStore } from '@/lib/store';

const STEPS = ['Flytta upp klasser', 'Avgående elever', 'Enheter att samla in', 'Bekräfta'];
const LEAVE = '— Avgår —';

/** 7A → 8A, 8C → 9C, 9x → leaves. Other names stay as they are. */
function suggest(k: string) {
  const m = k.match(/^(\d)(.*)$/);
  if (!m) return k;
  const y = Number(m[1]);
  return y >= 9 ? LEAVE : `${y + 1}${m[2]}`;
}

export default function Lasarsbyte() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);
  const classes = React.useMemo(() => unique(students.map((s) => s.klass)), [students]);
  const year = new Date().getFullYear();

  const [step, setStep] = React.useState(0);
  const [map, setMap] = React.useState<Record<string, string>>({});
  const [staying, setStaying] = React.useState<string[]>([]); // leaving-class students who stay
  const [leftLabel, setLeftLabel] = React.useState(`Avgått ${year}`);
  const [backup, setBackup] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [finished, setFinished] = React.useState(false);

  React.useEffect(() => {
    setMap((m) => (Object.keys(m).length ? m : Object.fromEntries(classes.filter((k) => !/^Avgått/i.test(k)).map((k) => [k, suggest(k)]))));
  }, [classes]);

  const leavingClasses = Object.entries(map).filter(([, v]) => v === LEAVE).map(([k]) => k);
  const leavingAll = students.filter((s) => leavingClasses.includes(s.klass));
  const leaving = leavingAll.filter((s) => !staying.includes(s.id));
  const moving = students.filter((s) => map[s.klass] && map[s.klass] !== LEAVE && map[s.klass] !== s.klass);
  const toCollect = leaving.filter((s) => s.device);

  const doBackup = async () => {
    await exportXlsx(`Elever_backup_fore_lasarsbyte`, [
      { label: 'Namn', value: (s: StudentView) => s.namn }, { label: 'ElevID', value: (s) => s.elevId }, { label: 'E-post', value: (s) => s.epost },
      { label: 'Klass', value: (s) => s.klass }, { label: 'Skåpnummer', value: (s) => s.skap }, { label: 'Enhet', value: (s) => s.device?.serial ?? '' },
    ], students);
    setBackup(true);
  };

  const run = async () => {
    setBusy(true);
    const jobs: (() => Promise<void>)[] = [];
    for (const s of moving) {
      const to = map[s.klass];
      jobs.push(async () => {
        await store.update('elever', s.id, { Klass: to });
        if (s.device) await store.update('enheter', s.device.id, { TillhorKlass: to });
      });
    }
    // Students who stay one more year keep their class as-is.
    for (const s of leaving) jobs.push(() => store.update('elever', s.id, { Klass: leftLabel }));
    setProgress({ done: 0, total: jobs.length });
    try {
      for (let i = 0; i < jobs.length; i++) {
        await jobs[i]();
        setProgress({ done: i + 1, total: jobs.length });
      }
      await log(store, {
        typ: 'Läsårsbyte',
        detaljer: `${moving.length} elever flyttade upp, ${leaving.length} markerade "${leftLabel}", ${toCollect.length} enheter att samla in. ${Object.entries(map).map(([a, b]) => `${a}→${b === LEAVE ? 'avgår' : b}`).join(', ')}`,
      });
      setFinished(true);
    } catch (e) {
      store.toast({ icon: 'error', message: `Stoppade efter ${progress.done} av ${jobs.length}: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const collectCols: Column<StudentView>[] = [
    { key: 'klass', label: 'Klass' },
    { key: 'namn', label: 'Elev', render: (s) => <b>{s.namn}</b> },
    { key: 'skap', label: 'Skåp', render: (s) => s.skap || '—' },
    { key: 'enhet', label: 'Enhet', mono: true, render: (s) => s.device?.assetId || s.device?.serial || '—' },
    { key: 'status', label: 'Status', render: (s) => (s.device ? <StatusBadge status={s.device.status} /> : '—') },
  ];

  if (!ready) return <><PageHeader title="Läsårsbyte" /><PageState /></>;

  if (finished) {
    return (
      <>
        <PageHeader title="Läsårsbyte" />
        <div className="rk-card" style={{ padding: 0 }}>
          <EmptyState icon="celebration" tone="green" title="Läsårsbytet är klart"
            description={`${moving.length} elever flyttades upp och ${leaving.length} markerades "${leftLabel}". Samla in ${toCollect.length} enheter från avgående elever.`}
            action={<div className="row" style={{ justifyContent: 'center' }}>
              <Button icon="assignment_return" onClick={() => router.push('/aterlamning')}>Till Återlämning</Button>
              <Button variant="outlined" icon="summarize" onClick={() => router.push('/rapporter?r=ej-aterlamnade')}>Rapport: ej återlämnade</Button>
            </div>} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Läsårsbyte" description="Inför nytt läsår: flytta upp klasserna, hantera avgående 9:or och se vilka enheter som ska samlas in. Inget tas bort." />
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <section className="rk-card stack" style={{ gap: 12 }}>
          <p className="small muted" style={{ margin: 0 }}>Förslaget flyttar varje klass upp ett år. Ändra där det behövs — t.ex. om klasser slås ihop.</p>
          {Object.keys(map).map((k) => (
            <div key={k} className="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              <b style={{ width: 80 }}>{k}</b>
              <span className="muted small" style={{ width: 90 }}>{students.filter((s) => s.klass === k).length} elever</span>
              <span className="rk-icon" aria-hidden>arrow_forward</span>
              <input className="select" style={{ width: 200 }} list="lb-classes" value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value.toUpperCase() === 'AVGÅR' ? LEAVE : e.target.value })} />
              <Button size="sm" variant={map[k] === LEAVE ? 'tonal' : 'text'} onClick={() => setMap({ ...map, [k]: map[k] === LEAVE ? suggest(k).replace(LEAVE, k) : LEAVE })}>{map[k] === LEAVE ? 'Avgår' : 'Markera avgår'}</Button>
            </div>
          ))}
          <datalist id="lb-classes">{[LEAVE, ...classes].map((k) => <option key={k} value={k} />)}</datalist>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button icon="arrow_forward" onClick={() => setStep(1)}>Nästa</Button></div>
        </section>
      )}

      {step === 1 && (
        <section className="rk-card stack" style={{ gap: 12 }}>
          <p className="small" style={{ margin: 0 }}>{leavingAll.length} elever i {leavingClasses.join(', ') || '—'} slutar. Bocka ur elever som går om och stannar kvar.</p>
          <div className="form-grid">
            {leavingAll.map((s) => (
              <Checkbox key={s.id} showLabel label={`${s.namn} (${s.klass})${s.device ? ' · har enhet' : ''}`} checked={!staying.includes(s.id)}
                onChange={(v) => setStaying((st) => (v ? st.filter((x) => x !== s.id) : [...st, s.id]))} />
            ))}
          </div>
          <div>
            <label className="field-label" htmlFor="lb-left">Avgående elever får klassen</label>
            <input id="lb-left" className="select" style={{ maxWidth: 260 }} value={leftLabel} onChange={(e) => setLeftLabel(e.target.value)} />
            <p className="small muted">Eleverna tas inte bort — de får den här klassen så att historiken finns kvar. Du kan ta bort dem senare under Elever.</p>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button variant="text" icon="arrow_back" onClick={() => setStep(0)}>Tillbaka</Button>
            <Button icon="arrow_forward" disabled={!leftLabel.trim()} onClick={() => setStep(2)}>Nästa</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{toCollect.length} avgående elever har en enhet som ska samlas in.</span>
            <Button variant="outlined" size="sm" icon="download" onClick={() => exportXlsx('Enheter_att_samla_in', [
              { label: 'Klass', value: (s: StudentView) => s.klass }, { label: 'Elev', value: (s) => s.namn }, { label: 'Skåp', value: (s) => s.skap },
              { label: 'AssetID', value: (s) => s.device?.assetId ?? '' }, { label: 'Serienummer', value: (s) => s.device?.serial ?? '' },
            ], toCollect)}>Exportera lista</Button>
          </div>
          {toCollect.length ? <DataTable<StudentView> columns={collectCols} rows={toCollect} density="compact" /> : <Banner tone="success" title="Inget att samla in">Ingen avgående elev har en enhet.</Banner>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button variant="text" icon="arrow_back" onClick={() => setStep(1)}>Tillbaka</Button>
            <Button icon="arrow_forward" onClick={() => setStep(3)}>Nästa</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rk-card stack" style={{ gap: 16 }}>
          <dl className="kv">
            <dt>Flyttas upp</dt><dd>{moving.length} elever</dd>
            <dt>Avgår</dt><dd>{leaving.length} elever → “{leftLabel}”</dd>
            <dt>Stannar kvar</dt><dd>{staying.length} elever</dd>
            <dt>Enheter att samla in</dt><dd>{toCollect.length}</dd>
          </dl>
          <Banner tone="warning" title="Ta en säkerhetskopia först">Exportera elevlistan innan du kör — då kan du återställa klasserna om något blir fel.</Banner>
          <div className="row">
            <Button variant="outlined" icon="download" onClick={doBackup}>{backup ? 'Säkerhetskopia sparad ✓' : 'Exportera säkerhetskopia'}</Button>
          </div>
          {busy && (
            <>
              <div className="hbar" style={{ height: 12 }}><div style={{ height: 12, width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
              <span className="small">{progress.done} av {progress.total} — stäng inte fliken.</span>
            </>
          )}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button variant="text" icon="arrow_back" disabled={busy} onClick={() => setStep(2)}>Tillbaka</Button>
            <Button icon="school" disabled={!backup || busy || store.readOnly || (moving.length + leaving.length === 0)} onClick={run}>Genomför läsårsbyte</Button>
          </div>
        </section>
      )}
    </>
  );
}

