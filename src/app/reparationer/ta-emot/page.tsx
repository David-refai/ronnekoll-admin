'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Chip, Dialog, EmptyState, Icon, PageHeader, ScanFeedback, StatusBadge, Switch, TextField } from '@/ds';
import { ScanInput } from '@/components/Scan';
import { PageState, useReady } from '@/components/PageState';
import { StatusDialog } from '@/components/enheter/StatusDialog';
import { SwapDialog } from '@/components/enheter/SwapDialog';
import { buildDevices, serialKey } from '@/lib/derive';
import { shortDate } from '@/lib/format';
import { str } from '@/lib/lists';
import { buildRepairs, receiveRepair, type NextStep, type RepairView } from '@/lib/repair';
import { useStore } from '@/lib/store';

const kv = (label: string, value: React.ReactNode, span = false, mono = false) => (
  <div style={span ? { gridColumn: 'span 2' } : undefined}>
    <dt style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)' }}>{label}</dt>
    <dd className={mono ? 'mono' : undefined} style={{ margin: '2px 0 0', fontWeight: mono ? 400 : 600, fontSize: mono ? 13 : 14 }}>{value}</dd>
  </div>
);

function TaEmotInner() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const repairs = React.useMemo(() => buildRepairs(store.data, devices), [store.data, devices]);
  const out = repairs.filter((r) => r.out);

  const [scanValue, setScanValue] = React.useState('');
  const [miss, setMiss] = React.useState<string | null>(null);
  const [matches, setMatches] = React.useState<string[]>([]); // repair ids for a kolli with several devices
  const [selId, setSelId] = React.useState<string | null>(null);
  const [fixed, setFixed] = React.useState(true);
  const [atgard, setAtgard] = React.useState('');
  const [giveBack, setGiveBack] = React.useState(true);
  const [next, setNext] = React.useState<NextStep>('byt');
  const [busy, setBusy] = React.useState(false);
  const [follow, setFollow] = React.useState<{ kind: 'byt' | 'kassera'; serial: string } | null>(null);

  const sel = selId ? repairs.find((r) => r.id === selId) : undefined;

  const pick = (r: RepairView) => {
    setSelId(r.id);
    setMatches([]);
    setMiss(null);
    setFixed(true);
    setAtgard('');
    setGiveBack(true);
    setNext(r.device?.holder?.kind === 'tilldelning' ? 'byt' : 'skicka');
  };

  const onScan = (raw: string) => {
    setScanValue('');
    const k = serialKey(raw);
    if (!k) return;
    const byDevice = out.filter((r) => serialKey(r.serial) === k || (r.device && serialKey(r.device.assetId) === k));
    const byKolli = out.filter((r) => serialKey(r.kolli) === k);
    const hits = byDevice.length ? byDevice : byKolli;
    if (!hits.length) {
      setSelId(null);
      setMatches([]);
      const done = repairs.find((r) => serialKey(r.serial) === k || serialKey(r.kolli) === k);
      setMiss(done ? `${raw.trim()} är redan mottagen (${shortDate(done.mottagen)})` : `${raw.trim()} har inget öppet utskick`);
      return;
    }
    if (hits.length === 1) pick(hits[0]);
    else {
      setSelId(null);
      setMiss(null);
      setMatches(hits.map((r) => r.id));
    }
  };

  const pre = params.get('enhet');
  React.useEffect(() => {
    if (pre && repairs.length && !selId) onScan(pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pre, repairs.length]);

  const confirm = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const w = fixed
        ? await receiveRepair(store, sel, { fixed: true, atgard: atgard.trim(), giveBack })
        : await receiveRepair(store, sel, { fixed: false, atgard: atgard.trim(), next });
      const name = sel.device?.assetId || sel.serial;
      store.toast({ icon: fixed ? 'task_alt' : 'build_circle', message: w.length ? `${name} mottagen. ${w[0]}` : `${name} mottagen${fixed ? ' – reparerad' : ' – ej reparerad'}` });
      setSelId(null);
      setBusy(false);
      if (!fixed) {
        if (next === 'skicka') router.push(`/reparationer/skicka?enhet=${encodeURIComponent(sel.serial)}`);
        else setFollow({ kind: next, serial: sel.serial });
      }
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  const followDevice = follow ? devices.find((d) => d.serial === follow.serial) : undefined;
  const h = sel?.device?.holder;
  const tone = sel?.warranty.state === 'Inom garanti' ? 'green' : sel?.warranty.state === 'Garanti går ut' ? 'amber' : 'gray';

  return (
    <>
      <PageHeader overline={<><a href="#" onClick={(e) => { e.preventDefault(); router.push('/reparationer'); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>Reparationer</a> › Ta emot</>}
        title="Ta emot från reparation" description="Skanna enheten — RönneKoll hittar själv det öppna utskicket." />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <ScanInput size="lg" scanning autoFocus shortcut={false} placeholder="Skanna enhet eller kollinummer…"
            value={scanValue} onChange={(e) => setScanValue(e.target.value)} onScan={onScan} />
          {miss && <ScanFeedback state="warning" title={miss} />}

          {matches.length > 0 && (
            <section className="rk-card stack" style={{ gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Kollit innehåller {matches.length} enheter — välj den du håller i</div>
              {matches.map((id) => {
                const r = repairs.find((x) => x.id === id)!;
                return (
                  <button key={id} type="button" className="row picker-row" style={{ gap: 12, textAlign: 'left' }} onClick={() => pick(r)}>
                    <span className="mono" style={{ width: 90 }}>{r.device?.assetId || r.serial}</span>
                    <span style={{ flex: 1 }}>{r.device?.modell} <span className="muted">· {str(r.fault?.TypAvFel) || str(r.fault?.Beskrivning)}</span></span>
                    <Icon name="chevron_right" />
                  </button>
                );
              })}
            </section>
          )}

          {!sel && !matches.length && (
            out.length ? (
              <section className="rk-card stack" style={{ gap: 6 }}>
                <div className="small" style={{ fontWeight: 600, color: 'var(--ink-muted)' }}>Ute just nu ({out.length}) — skanna eller välj</div>
                {out.sort((a, b) => b.days - a.days).map((r) => (
                  <button key={r.id} type="button" className="row picker-row" style={{ gap: 12, textAlign: 'left' }} onClick={() => pick(r)}>
                    <span className="mono" style={{ width: 90 }}>{r.device?.assetId || r.serial}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{r.device?.modell} <span className="muted">· {r.lev} · {r.days} dagar</span></span>
                    {r.late && <StatusBadge status="Försenad hos leverantör" />}
                    <Icon name="chevron_right" />
                  </button>
                ))}
              </section>
            ) : (
              <div className="rk-card" style={{ padding: 0 }}>
                <EmptyState icon="task_alt" tone="green" title="Inget är ute på reparation" description="Alla utskick är mottagna." />
              </div>
            )
          )}

          {sel && (
            <div className="grid-7-5" style={{ gridTemplateColumns: 'minmax(0,5fr) minmax(0,6fr)' }}>
              <section className="rk-card stack" style={{ gap: 16 }}>
                <div className="row" style={{ gap: 12 }}>
                  <span className="rk-kpi__icon rk-tone--green" style={{ width: 44, height: 44, borderRadius: '50%' }}><Icon name="check_circle" fill /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 700, color: 'var(--status-green)' }}>Hittad · öppet utskick</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{sel.device?.modell || 'Okänd enhet'}</div>
                    <div className="mono small muted">{sel.serial}{sel.device?.assetId ? ` · ${sel.device.assetId}` : ''}</div>
                  </div>
                  <StatusBadge status="Under reparation" />
                </div>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px 20px' }}>
                  {kv('Skickad', `${shortDate(sel.skickad)} · ${sel.days} dagar sedan`)}
                  {kv('Leverantör', `${sel.lev || '—'}${sel.arende ? ` · ${sel.arende}` : ''}`)}
                  {kv('Kollinummer', sel.kolli || '—', false, true)}
                  {kv('Felanmälan', str(sel.fault?.TypAvFel) || str(sel.fault?.Beskrivning) || '—')}
                  {kv(h?.kind === 'utlaning' ? 'Utlånad' : 'Tilldelad', h ? `${h.namn} · ${h.klass}` : 'Ingen — enheten är ledig', true)}
                </dl>
                <div className="row" style={{ gap: 14, padding: '14px 16px', borderRadius: 12, background: `var(--status-${tone}-container)`, color: `var(--status-${tone})` }}>
                  <Icon name={tone === 'gray' ? 'gpp_bad' : 'verified_user'} size={28} fill />
                  <div>
                    <div style={{ fontWeight: 800 }}>{sel.warranty.state}</div>
                    <div className="small" style={{ fontWeight: 500 }}>{sel.warranty.long}</div>
                  </div>
                </div>
              </section>

              <section className="rk-card stack" style={{ gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Hur kom den tillbaka?</h2>
                <Dialog.Option icon="task_alt" title="Mottagen – reparerad"
                  description={`Felanmälan stängs som Klar.${h ? ` Enheten går tillbaka till ${h.namn.split(' ')[0]} (${h.kind === 'tilldelning' ? 'Tilldelad' : 'Utlånad'}).` : ' Enheten blir Tillgänglig.'}`}
                  selected={fixed} onClick={() => setFixed(true)} />
                <Dialog.Option icon="build_circle" title="Mottagen – ej reparerad" description="Enheten blir Trasig och felanmälan står kvar öppen." selected={!fixed} onClick={() => setFixed(false)} />

                {fixed ? (
                  <>
                    <TextField label="Åtgärd (från leverantörens rapport)" multiline rows={2} value={atgard} onChange={(e) => setAtgard(e.target.value)} placeholder="Bytt laddport och moderkort. Testad OK." />
                    {h && (
                      <>
                        <Switch checked={giveBack} onChange={setGiveBack} label={`Ge tillbaka till ${h.namn} direkt`} />
                        {!giveBack && <span className="small muted">Tilldelningen avslutas och enheten blir Tillgänglig i förrådet.</span>}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <TextField label="Orsak *" multiline rows={2} value={atgard} onChange={(e) => setAtgard(e.target.value)} placeholder="t.ex. Vätskeskada täcks inte av garantin" />
                    <div>
                      <span className="field-label">Nästa steg</span>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <Chip label="Skicka igen" icon="local_shipping" selected={next === 'skicka'} onClick={() => setNext('skicka')} />
                        {h?.kind === 'tilldelning' && <Chip label="Byt enhet för eleven" icon="swap_horiz" selected={next === 'byt'} onClick={() => setNext('byt')} />}
                        <Chip label="Kassera" icon="delete" selected={next === 'kassera'} onClick={() => setNext('kassera')} />
                      </div>
                    </div>
                  </>
                )}

                <div className="row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
                  <Button variant="text" onClick={() => setSelId(null)}>Avbryt</Button>
                  <Button icon="move_to_inbox" disabled={busy || store.readOnly || (!fixed && !atgard.trim())} onClick={confirm}>
                    {busy ? 'Sparar…' : fixed ? 'Bekräfta mottagen – reparerad' : 'Bekräfta mottagen – ej reparerad'}
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {follow?.kind === 'byt' && followDevice && <SwapDialog device={followDevice} devices={devices} onClose={() => setFollow(null)} />}
      {follow?.kind === 'kassera' && followDevice && <StatusDialog device={followDevice} devices={devices} initial="Kasserad" onClose={() => setFollow(null)} />}
    </>
  );
}

export default function TaEmotPage() {
  return (
    <React.Suspense fallback={null}>
      <TaEmotInner />
    </React.Suspense>
  );
}
