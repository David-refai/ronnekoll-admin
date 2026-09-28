'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, Banner, Button, PageHeader, ScanFeedback, TextField, YesNo } from '@/ds';
import { DevicePicker } from '@/components/Pickers';
import { PageState, useReady } from '@/components/PageState';
import { returnAssignment, type ReturnChecklist } from '@/lib/actions';
import { buildDevices, serialKey, type DeviceView } from '@/lib/derive';
import { relDate, shortDate } from '@/lib/format';
import type { DeviceStatus } from '@/lib/lists';
import { useStore } from '@/lib/store';

const EMPTY: ReturnChecklist = { LaddareMed: null, VaskaMed: null, SkarmSkadad: null, AndraSkador: null, Tagg: null, Skadebeskrivning: '' };

function AterlamningInner() {
  const store = useStore();
  const ready = useReady();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const [device, setDevice] = React.useState<DeviceView | null>(null);
  const [c, setC] = React.useState<ReturnChecklist>(EMPTY);
  const [next, setNext] = React.useState<DeviceStatus>('Tillgänglig');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ serial: string; namn: string; status: DeviceStatus } | null>(null);

  React.useEffect(() => {
    const s = params.get('enhet');
    if (s && !device) setDevice(devices.find((d) => serialKey(d.serial) === serialKey(s)) ?? null);
  }, [params, devices, device]);

  const damaged = !!(c.SkarmSkadad || c.AndraSkador);
  React.useEffect(() => setNext(damaged ? 'Trasig' : 'Tillgänglig'), [damaged]);

  const set = (k: keyof ReturnChecklist) => (v: boolean) => setC((x) => ({ ...x, [k]: v }));
  const complete = c.LaddareMed != null && c.SkarmSkadad != null && c.AndraSkador != null;

  const submit = async () => {
    if (!device) return;
    setBusy(true);
    try {
      await returnAssignment(store, device, c, next);
      setDone({ serial: device.assetId || device.serial, namn: device.holder?.namn ?? '', status: next });
      store.toast({ icon: 'assignment_return', message: `${device.assetId || device.serial} återlämnad${damaged ? ' · felanmälan skapad' : ''}` });
      setDevice(null);
      setC(EMPTY);
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const recent = [...store.data.aterlamningar].sort((a, b) => String(b['Återlämningsdatum'] || b._created).localeCompare(String(a['Återlämningsdatum'] || a._created))).slice(0, 6);

  return (
    <>
      <PageHeader title="Återlämning" description="Skanna enheten, gå igenom skicket och välj ny status. Skador skapar en felanmälan automatiskt." />
      {!ready ? <PageState /> : (
        <div className="grid-7-5">
          <div className="stack" style={{ gap: 24 }}>
            <section className="rk-card">
              <h2 className="step-title"><span className="step-num">1</span>Skanna enhet</h2>
              <DevicePicker devices={devices} value={device} onChange={(d) => { setDevice(d); setDone(null); setC(EMPTY); }} autoFocus suggestions={false}
                allow={(d) => !!d.holder || d.status !== 'Tillgänglig'} reason={(d) => `${d.assetId || d.serial} är redan tillgänglig och inte tilldelad någon.`} />
              {done && !device && (
                <div style={{ marginTop: 16 }}>
                  <ScanFeedback state="success" title="Återlämnad" serial={done.serial} detail={`${done.namn ? done.namn + ' · ' : ''}ny status: ${done.status}. Skanna nästa enhet.`} />
                </div>
              )}
              {device && (
                <div className="row" style={{ marginTop: 16 }}>
                  {device.holder ? (
                    <>
                      <Avatar name={device.holder.namn} size="lg" />
                      <div>
                        <b>{device.holder.namn}</b>
                        <div className="small muted">{device.holder.klass} · {device.holder.kind === 'utlaning' ? 'tillfälligt lån' : 'tilldelad'} sedan {shortDate(device.holder.since)}</div>
                      </div>
                    </>
                  ) : (
                    <Banner tone="info" title="Ingen aktiv tilldelning">Enheten är inte kopplad till någon elev. Du kan ändå registrera skicket och ny status.</Banner>
                  )}
                </div>
              )}
            </section>

            {device && (
              <section className="rk-card stack" style={{ gap: 16 }}>
                <h2 className="step-title" style={{ margin: 0 }}><span className="step-num">2</span>Skick</h2>
                <div className="check-grid">
                  <YesNo label="Laddare med" value={c.LaddareMed} onChange={set('LaddareMed')} />
                  <YesNo label="Väska med" value={c.VaskaMed} onChange={set('VaskaMed')} />
                  <YesNo label="Skärm skadad" danger value={c.SkarmSkadad} onChange={set('SkarmSkadad')} />
                  <YesNo label="Andra skador" danger value={c.AndraSkador} onChange={set('AndraSkador')} />
                  <YesNo label="Tagg med" value={c.Tagg} onChange={set('Tagg')} />
                </div>
                {damaged && (
                  <TextField label="Skadebeskrivning" multiline rows={3} value={c.Skadebeskrivning} placeholder="Spricka i nedre vänstra hörnet…"
                    onChange={(e) => setC((x) => ({ ...x, Skadebeskrivning: e.target.value }))} helper="Skapar en felanmälan automatiskt" />
                )}
                <div>
                  <label className="field-label" htmlFor="ret-status">Ny status</label>
                  <select id="ret-status" className="select" value={next} onChange={(e) => setNext(e.target.value as DeviceStatus)}>
                    {(['Tillgänglig', 'Trasig', 'Under reparation', 'Kasserad'] as DeviceStatus[]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button variant="text" onClick={() => { setDevice(null); setC(EMPTY); }}>Avbryt</Button>
                  <Button icon="assignment_return" disabled={!complete || busy || store.readOnly} onClick={submit}>Registrera återlämning</Button>
                </div>
                {!complete && <span className="small muted" style={{ textAlign: 'right' }}>Svara på Laddare med, Skärm skadad och Andra skador.</span>}
              </section>
            )}
          </div>

          <section className="rk-card stack" style={{ gap: 12 }}>
            <h2 className="section-title">Senaste återlämningar</h2>
            {recent.map((r) => (
              <div key={r._id} className="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                <Avatar name={String(r.ElevNamn || '?')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{String(r.ElevNamn || '—')}</b> <span className="muted small">{String(r.Klass || '')}</span>
                  <div className="small muted"><span className="mono">{String(r.EnhetID)}</span> · {relDate(r['Återlämningsdatum'] || r._created)}{r.MottagenAv ? ` · ${String(r.MottagenAv)}` : ''}</div>
                </div>
              </div>
            ))}
            {!recent.length && <span className="small muted">Inga återlämningar ännu.</span>}
          </section>
        </div>
      )}
    </>
  );
}

export default function AterlamningPage() {
  return (
    <React.Suspense fallback={null}>
      <AterlamningInner />
    </React.Suspense>
  );
}
