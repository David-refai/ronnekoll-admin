'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Banner, Button, Icon, IconButton, PageHeader, ScanFeedback, SegmentedButton, StatusBadge, TextField } from '@/ds';
import { CameraScanner, ScanInput } from '@/components/Scan';
import { PageState, useReady } from '@/components/PageState';
import { ProvisionLists } from '@/components/ProvisionLists';
import { buildDevices, isOpenCase, serialKey, type DeviceView } from '@/lib/derive';
import { todayIso } from '@/lib/format';
import { REPAIR_OUT, SUPPLIERS, str, type Row } from '@/lib/lists';
import { openFault, sendRepairs, warranty } from '@/lib/repair';
import { useStore } from '@/lib/store';

const dot = (n: number) => <span className="rk-step__dot" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>{n}</span>;

function SkickaInner() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const find = (q: string) => {
    const k = serialKey(q);
    return devices.find((d) => serialKey(d.serial) === k || serialKey(d.assetId) === k);
  };

  const [picked, setPicked] = React.useState<string[]>([]); // serials
  const [scanValue, setScanValue] = React.useState('');
  const [fb, setFb] = React.useState<{ state: 'success' | 'warning' | 'error'; title: string; serial?: string } | null>(null);
  const [kolli, setKolli] = React.useState('');
  const [kolliCam, setKolliCam] = React.useState(false);
  const [lev, setLev] = React.useState(SUPPLIERS[0]);
  const [annan, setAnnan] = React.useState('');
  const [skickad, setSkickad] = React.useState(todayIso());
  const [arende, setArende] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  // ?enhet=… from the device sheet
  const pre = params.get('enhet');
  React.useEffect(() => {
    if (pre && devices.length && !picked.length) {
      const d = find(pre);
      if (d) setPicked([d.serial]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pre, devices.length]);

  const outSerials = React.useMemo(
    () => new Set(store.data.reparationer.filter((r) => (str(r.Status) || REPAIR_OUT) === REPAIR_OUT).map((r) => serialKey(r.EnhetID))),
    [store.data.reparationer],
  );

  const inBox = picked.map((s) => devices.find((d) => d.serial === s)).filter((d): d is DeviceView => !!d);
  const faults = React.useMemo(() => {
    const seen = new Set<string>();
    return store.data.felanmalningar
      .filter((f) => isOpenCase(f.Status))
      .sort((a, b) => b._created.localeCompare(a._created))
      .map((f) => ({ f, d: find(str(f.EnhetID)) }))
      .filter((x): x is { f: Row; d: DeviceView } => !!x.d && !outSerials.has(serialKey(x.d.serial)) && !seen.has(x.d.serial) && !!seen.add(x.d.serial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.data.felanmalningar, devices, outSerials]);

  const toggle = (d: DeviceView, on: boolean) => setPicked((p) => (on ? (p.includes(d.serial) ? p : [...p, d.serial]) : p.filter((s) => s !== d.serial)));

  const onScan = (raw: string) => {
    setScanValue('');
    const q = raw.trim();
    if (!q) return;
    const d = find(q);
    if (!d) return setFb({ state: 'error', title: 'Hittades inte i Enheter', serial: q });
    if (picked.includes(d.serial)) return setFb({ state: 'warning', title: 'Redan i paketet', serial: d.assetId || d.serial });
    if (outSerials.has(serialKey(d.serial))) return setFb({ state: 'error', title: 'Är redan ute på reparation', serial: d.assetId || d.serial });
    if (d.status === 'Kasserad') return setFb({ state: 'error', title: 'Enheten är kasserad', serial: d.assetId || d.serial });
    toggle(d, true);
    setFb({ state: 'success', title: `Tillagd (${picked.length + 1})`, serial: d.assetId || d.serial });
  };

  const supplier = lev === 'Annan' ? annan.trim() || 'Annan' : lev;
  const run = async () => {
    setBusy(true);
    try {
      const w = await sendRepairs(store, inBox.map((d) => ({ device: d, fault: openFault(store.data, d.serial) })), { kolli: kolli.trim(), lev: supplier, arende: arende.trim(), skickad });
      store.toast({ icon: 'local_shipping', message: `${inBox.length} ${inBox.length === 1 ? 'enhet' : 'enheter'} skickade till ${supplier}` });
      if (w.length) {
        setWarnings(w);
        setBusy(false);
      } else router.push('/reparationer');
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  const missing = store.mode === 'live' && store.connection && !store.connection.lists.reparationer;

  return (
    <>
      <PageHeader overline={<><a href="#" onClick={(e) => { e.preventDefault(); router.push('/reparationer'); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>Reparationer</a> › Nytt utskick</>}
        title="Skicka på reparation" description="Skanna enheterna som ska i paketet, sedan kollinumret på fraktsedeln." />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <ProvisionLists keys={['reparationer']} />
          {warnings.length > 0 && (
            <Banner tone="warning" title="Utskicket är registrerat, men felanmälan uppdaterades inte"
              action={<Button variant="outlined" size="sm" onClick={() => router.push('/reparationer')}>Till Reparationer</Button>}>
              {warnings[0]}. Ändra status på felanmälan själv.
            </Banner>
          )}
          <div className="grid-7-5">
            <section className="rk-card stack" style={{ gap: 16 }}>
              <div className="row" style={{ gap: 10 }}>
                {dot(1)}
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>Enheter i paketet</h2>
                <Badge tone="primary">{inBox.length} st</Badge>
              </div>
              <ScanInput size="lg" scanning autoFocus shortcut={false} placeholder="Skanna enhet (serienummer eller AssetID)…"
                value={scanValue} onChange={(e) => setScanValue(e.target.value)} onScan={onScan} />
              {fb && <ScanFeedback state={fb.state} title={fb.title} serial={fb.serial} />}

              {inBox.map((d) => {
                const f = openFault(store.data, d.serial);
                const w = warranty(d.inkop);
                return (
                  <div key={d.serial} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 14, alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-container-low)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650 }}><span className="mono">{d.assetId || d.serial}</span> · {d.modell}</div>
                      <div className="small muted">{f ? str(f.TypAvFel) || str(f.Beskrivning) : 'Ingen öppen felanmälan'} · {d.holder ? `${d.holder.namn} · ${d.holder.klass}` : 'ingen elev'}</div>
                    </div>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <StatusBadge status={w.state} />
                      <span className="small muted">{w.text}</span>
                    </span>
                    <IconButton icon="close" label="Ta bort ur paketet" onClick={() => toggle(d, false)} />
                  </div>
                );
              })}
              {!inBox.length && <div className="small muted" style={{ padding: '4px 2px' }}>Skanna enheterna eller bocka i dem nedan.</div>}

              {faults.length > 0 && (
                <div className="stack" style={{ gap: 4, marginTop: 4 }}>
                  <div className="small" style={{ fontWeight: 600, color: 'var(--ink-muted)' }}>Eller välj från öppna felanmälningar</div>
                  {faults.map(({ f, d }) => (
                    <label key={d.serial} className="row" style={{ gap: 12, minHeight: 44, padding: '0 12px', borderRadius: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={picked.includes(d.serial)} onChange={(e) => toggle(d, e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                      <span className="mono" style={{ width: 90 }}>{d.assetId || d.serial}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{str(f.TypAvFel) || str(f.Beskrivning)} <span className="muted">· {d.holder ? `${d.holder.namn} · ${d.holder.klass}` : d.modell}</span></span>
                      <StatusBadge status={warranty(d.inkop).state} />
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="rk-card stack" style={{ gap: 16 }}>
              <div className="row" style={{ gap: 10 }}>
                {dot(2)}
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Försändelse</h2>
              </div>
              <div data-scan><TextField label="Kollinummer *" mono leadingIcon="barcode_scanner" value={kolli} onChange={(e) => setKolli(e.target.value)}
                helper="Skanna streckkoden på fraktsedeln"
                trailing={<IconButton icon="photo_camera" label="Skanna med kameran" onClick={() => setKolliCam(true)} />} /></div>
              {kolliCam && <CameraScanner onClose={() => setKolliCam(false)} onResult={(t) => { setKolliCam(false); setKolli(t.trim()); }} />}
              <div>
                <span className="field-label">Leverantör</span>
                <SegmentedButton label="Leverantör" value={lev} onChange={setLev} options={SUPPLIERS.map((s) => ({ value: s, label: s }))} />
              </div>
              {lev === 'Annan' && <TextField label="Vilken leverantör?" value={annan} onChange={(e) => setAnnan(e.target.value)} placeholder="t.ex. Lenovo, Dustin" />}
              <div className="form-grid">
                <TextField label="Skickad" type="date" value={skickad} onChange={(e) => setSkickad(e.target.value)} />
                <TextField label="Ärendenummer (valfritt)" mono value={arende} onChange={(e) => setArende(e.target.value)} placeholder="Leverantörens ärende" />
              </div>
              <div className="row" style={{ gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-container-low)', fontSize: 13, lineHeight: '18px', alignItems: 'flex-start' }}>
                <Icon name="info" />
                <span>Enheterna får status <b>Under reparation</b> och felanmälningarna flyttas till <b>Skickad på reparation</b>. Eleverna behåller sin tilldelning.</span>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 'auto' }}>
                <Button variant="text" onClick={() => router.push('/reparationer')}>Avbryt</Button>
                <Button icon="local_shipping" disabled={!inBox.length || !kolli.trim() || busy || store.readOnly || !!missing} onClick={run}>
                  {busy ? 'Registrerar…' : `Registrera utskick · ${inBox.length} ${inBox.length === 1 ? 'enhet' : 'enheter'}`}
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export default function SkickaPage() {
  return (
    <React.Suspense fallback={null}>
      <SkickaInner />
    </React.Suspense>
  );
}
