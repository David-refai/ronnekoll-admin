'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, IconButton, PageHeader, ScanFeedback, SegmentedButton, StatusBadge, Switch, TextField } from '@/ds';
import { ScanInput } from '@/components/Scan';
import { PageState, useReady } from '@/components/PageState';
import { createDevice, log } from '@/lib/actions';
import { buildDevices, serialKey, unique } from '@/lib/derive';
import { DEVICE_STATUSES, deviceStatus, storedDeviceStatus } from '@/lib/lists';
import { useStore } from '@/lib/store';

const PREFIX = 'RÖGR';
const CAT_KEY = 'rk.pnCatalog';
const KATEGORI: Record<string, { agande: string; produkt?: string }> = {
  Elev: { agande: 'Tilldelad elev' }, Lånepool: { agande: 'Skolans lånepool' }, Personal: { agande: 'Personal' },
};

/** Reads a manufacturer label: "S/N: 5CD… P/N: B80KCES#ABN Model: …", or just "5CD… B80KCES". */
function parseLabel(raw: string) {
  const t = raw.trim();
  const lab = (re: RegExp) => t.match(re)?.[1]?.trim() ?? null;
  let sn = lab(/(?:S\/?N#?|Serial(?:\s*No\.?)?|Serienummer)\s*[:#]?\s*([A-Z0-9]{6,16})/i);
  let pn = lab(/(?:P\/?N|Prod\s*[IL1]D|Product(?:\s*No\.?)?|Produkt(?:nummer)?)\s*[:#]?\s*([A-Z0-9]{4,12})(?:#[A-Z0-9]{3})?/i);
  const model = lab(/(?:Model|Modell)\s*[:#]?\s*([^;|\r\n]+)/i);
  // HP Data Matrix: "CND6110J8J,5R1F9ES#UUW,HP Fortis Flip G1m 11 Chromebook"
  const csv = t.split(',').map((x) => x.trim());
  if (!sn && csv.length >= 2 && /^[A-Z0-9]{6,16}$/i.test(csv[0])) {
    return { sn: serialKey(csv[0]), pn: csv[1].split('#')[0].toUpperCase() || null, model: csv.slice(2).join(', ') || model || '' };
  }
  if (!sn) {
    const parts = t.split(/[\s;|,\t]+/).filter(Boolean);
    sn = parts[0] ?? '';
    if (!pn && parts[1]) pn = parts[1].split('#')[0];
  }
  return { sn: serialKey(sn), pn: pn ? pn.toUpperCase() : null, model: model ?? '' };
}
/** A product number alone, e.g. "B80KCES#ABN" scanned from its own barcode. */
const looksLikePn = (raw: string) => /^[A-Z0-9]{5,10}#[A-Z0-9]{2,4}$/i.test(raw.trim());

function loadCatalog(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CAT_KEY) || '{}');
  } catch {
    return {};
  }
}

interface Form { sn: string; pn: string | null; model: string; asset: string; kat: string; plats: string; status: string }
interface Added { id?: string; sn: string; model: string; asset: string }

export default function NyEnhet() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  // Status, Plats and Kategori are choice columns in SharePoint: offer exactly the list's own options.
  const statuses = store.choices('enheter', 'Status', DEVICE_STATUSES.map(storedDeviceStatus));
  const statusDefault = statuses.find((x) => deviceStatus(x) === 'Tillgänglig') ?? statuses[0] ?? 'Tillgänglig';
  const places = unique([...store.choices('enheter', 'Plats', []), ...devices.map((d) => d.plats), 'IT-förråd']);
  const kategorier = store.choices('enheter', 'Kategori', Object.keys(KATEGORI));

  // P/N → modell: learnt from earlier saves (stored as "P/N: …" in Anteckningar, so it follows you to every computer).
  const [localCat, setLocalCat] = React.useState<Record<string, string>>({});
  React.useEffect(() => setLocalCat(loadCatalog()), []);
  const catalog = React.useMemo(() => {
    const c: Record<string, string> = {};
    for (const d of devices) {
      const m = d.anteckningar.match(/P\/N:\s*([A-Z0-9]+)/i);
      if (m && d.modell) c[m[1].toUpperCase()] = d.modell;
    }
    return { ...c, ...localCat };
  }, [devices, localCat]);

  const [raw, setRaw] = React.useState('');
  const [autoSave, setAutoSave] = React.useState(true);
  const [form, setForm] = React.useState<Form>({ sn: '', pn: null, model: '', asset: '', kat: 'Elev', plats: 'IT-förråd', status: '' });
  const [assetEdited, setAssetEdited] = React.useState(false);
  const [added, setAdded] = React.useState<Added[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [fb, setFb] = React.useState<{ state: 'success' | 'warning' | 'error'; title: string; serial?: string; detail?: string; open?: string } | null>(null);

  const serials = React.useMemo(() => new Map(devices.map((d) => [serialKey(d.serial), d.assetId || d.serial])), [devices]);
  const assets = React.useMemo(() => new Set(devices.map((d) => d.assetId.toUpperCase()).filter(Boolean)), [devices]);
  const nextFree = React.useMemo(() => {
    const re = new RegExp(`^${PREFIX}(\\d+)$`, 'i');
    let max = 0;
    for (const a of assets) {
      const m = a.match(re);
      if (m) max = Math.max(max, Number(m[1]));
    }
    let n = max + 1;
    while (assets.has(`${PREFIX}${String(n).padStart(3, '0')}`)) n++;
    return `${PREFIX}${String(n).padStart(3, '0')}`;
  }, [assets]);
  const asset = assetEdited ? form.asset : form.sn ? nextFree : '';

  const check = (f: Form, a: string) => {
    const dup = f.sn ? serials.get(f.sn) : undefined;
    const taken = !!a && assets.has(a.toUpperCase());
    return {
      snError: dup ? `Finns redan som ${dup} — öppna enheten i stället` : '',
      modelError: f.sn && !f.model.trim() ? 'Okänd modell — skriv den en gång, nästa gång fylls den i själv' : '',
      assetError: taken ? `${a} används redan` : '',
      ok: !!f.sn && !!f.model.trim() && !dup && !!a && !taken,
    };
  };
  const c = check(form, asset);

  const save = async (f: Form, a: string) => {
    setBusy(true);
    try {
      const k = KATEGORI[f.kat] ?? { agande: '' };
      const st = f.status || statusDefault;
      await createDevice(store, {
        AssetID: a, Serienummer: f.sn, Modell: f.model.trim(), ProduktID: /ipad/i.test(f.model) ? 'iPad' : /chromebook|fortis/i.test(f.model) ? 'Chromebook' : 'PC',
        Kategori: f.kat, Agandetyp: k.agande, Plats: f.plats || 'IT-förråd', Status: st, Inköpsdatum: '', Anteckningar: f.pn ? `P/N: ${f.pn}` : '',
      });
      if (f.pn && !catalog[f.pn]) {
        const next = { ...localCat, [f.pn]: f.model.trim() };
        setLocalCat(next);
        try { localStorage.setItem(CAT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
      setAdded((l) => [{ sn: f.sn, model: f.model.trim(), asset: a }, ...l]);
      setFb({ state: 'success', title: `Sparad som ${a}`, serial: f.sn, detail: `${f.model.trim()} · ${deviceStatus(st)} · ${f.plats || 'IT-förråd'} · inköpsdatum saknas` });
      setForm({ ...f, sn: '', pn: null, model: '', asset: '' });
      setAssetEdited(false);
    } catch (e) {
      setFb({ state: 'error', title: 'Kunde inte spara', serial: f.sn, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const scan = (text: string) => {
    setRaw('');
    if (!text.trim()) return;
    // Second barcode on the same label (P/N) while a serial waits for its model.
    if (form.sn && !form.model && (looksLikePn(text) || catalog[text.trim().split('#')[0].toUpperCase()])) {
      const pn = text.trim().split('#')[0].toUpperCase();
      const f = { ...form, pn, model: catalog[pn] ?? '' };
      setForm(f);
      if (!f.model) return setFb({ state: 'warning', title: 'Nytt produktnummer', serial: pn, detail: 'Skriv modellen en gång — nästa dator med samma P/N fylls i själv.' });
      const cc = check(f, asset);
      if (autoSave && cc.ok) return void save(f, asset);
      return setFb({ state: 'success', title: 'Läst — kontrollera och spara', serial: f.sn, detail: f.model });
    }
    const p = parseLabel(text);
    if (!p.sn) return;
    const f: Form = { ...form, sn: p.sn, pn: p.pn, model: p.model || (p.pn ? catalog[p.pn] ?? '' : '') };
    const a = assetEdited ? form.asset : nextFree;
    setForm(f);
    const cc = check(f, a);
    if (cc.snError) return setFb({ state: 'error', title: 'Finns redan', serial: p.sn, detail: cc.snError, open: p.sn });
    if (!f.model) return setFb({ state: 'warning', title: 'Modell saknas', serial: p.sn, detail: 'Skanna produktnumret (P/N) på samma etikett, eller skriv modellen och spara.' });
    if (autoSave && cc.ok) return void save(f, a);
    setFb({ state: 'success', title: 'Läst — kontrollera och spara', serial: p.sn, detail: f.model });
  };

  const undo = async (a: Added) => {
    const row = store.data.enheter.find((e) => serialKey(e.Serienummer) === a.sn);
    try {
      if (row) await store.remove('enheter', row._id);
      await log(store, { typ: 'Borttagning', enhetId: a.sn, detaljer: `Ångrade ny enhet ${a.asset}` });
      setAdded((l) => l.filter((x) => x !== a));
      setFb({ state: 'warning', title: 'Ångrad', serial: a.sn, detail: `${a.asset} är ledigt igen` });
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const [ownPlace, setOwnPlace] = React.useState(false);
  const models = unique(devices.map((d) => d.modell));

  return (
    <>
      <PageHeader
        overline={<><a href="#" onClick={(e) => { e.preventDefault(); router.push('/enheter'); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>Enheter</a> › Lägg till</>}
        title="Lägg till enheter"
        description="Skanna streckkoden på datorns originaletikett. Serienummer och modell fylls i, AssetID skapas direkt. Inköpsdatum kan fyllas i senare."
        actions={<Switch label="Spara direkt vid skanning" checked={autoSave} onChange={setAutoSave} />}
      />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 18 }}>
          <ScanInput ocr="label" size="lg" scanning autoFocus shortcut={false} placeholder="Skanna originaletiketten — eller skriv serienumret och tryck Enter"
            value={raw} onChange={(e) => setRaw(e.target.value)} onScan={scan} disabled={busy || store.readOnly} />

          <div className="grid-7-5">
            <section className="rk-card stack" style={{ gap: 16 }}>
              {fb ? (
                <ScanFeedback state={fb.state} title={fb.title} serial={fb.serial} detail={fb.detail}
                  action={fb.open ? <Button variant="outlined" size="sm" onClick={() => router.push(`/enheter?open=${encodeURIComponent(fb.open!)}`)}>Öppna enheten</Button> : undefined} />
              ) : (
                <ScanFeedback state="idle" title="Redo att skanna" detail="Skannern skriver in koden och trycker Enter åt dig. Markören står redan i fältet." />
              )}

              <div className="form-grid">
                <TextField id="f-sn" label="Serienummer *" mono value={form.sn} error={c.snError || undefined} helper="Läst från etiketten"
                  onChange={(e) => setForm({ ...form, sn: serialKey(e.target.value) })} />
                <div>
                  <TextField id="f-model" label="Modell *" value={form.model} list="ny-models" error={c.modelError || undefined}
                    helper={form.pn ? `P/N ${form.pn}${catalog[form.pn] ? ' · ifylld automatiskt' : ' · sparas till nästa gång'}` : 'Fylls i när etiketten har modell eller P/N'}
                    onChange={(e) => setForm({ ...form, model: e.target.value })} />
                  <datalist id="ny-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <TextField id="f-asset" label="AssetID" mono leadingIcon="label" value={asset} error={c.assetError || undefined}
                    helper={assetEdited ? 'Manuellt — kontrolleras mot alla enheter' : 'Nästa lediga · ändra vid behov'}
                    onChange={(e) => { setAssetEdited(true); setForm({ ...form, asset: e.target.value.toUpperCase() }); }} />
                  {assetEdited && <Button variant="text" size="sm" icon="autorenew" onClick={() => setAssetEdited(false)}>Använd nästa lediga ({nextFree})</Button>}
                </div>
                <div>
                  <span className="field-label">Inköpsdatum</span>
                  <div className="row" style={{ gap: 10, minHeight: 48, flexWrap: 'wrap' }}>
                    <StatusBadge status="Inköpsdatum saknas" />
                    <span className="small muted">Fyll i senare — filtret ”Saknar inköpsdatum” i Enheter hittar dem.</span>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="field-label" htmlFor="f-status">Status</label>
                  <select id="f-status" className="select" value={form.status || statusDefault} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {statuses.map((x) => <option key={x} value={x}>{deviceStatus(x) === x ? x : `${deviceStatus(x)} (${x})`}</option>)}
                  </select>
                  {['Tilldelad', 'Utlånad – tillfälligt'].includes(deviceStatus(form.status || statusDefault)) && (
                    <p className="small" style={{ margin: '6px 0 0', color: 'var(--status-amber)' }}>Koppla den till eleven under Tilldelning, annars visas den i Datakvalitet.</p>
                  )}
                </div>
                <div>
                  <label className="field-label" htmlFor="f-plats">Plats</label>
                  {ownPlace ? (
                    <TextField id="f-plats" leadingIcon="location_on" value={form.plats} onChange={(e) => setForm({ ...form, plats: e.target.value })}
                      trailing={<Button variant="text" size="sm" onClick={() => setOwnPlace(false)}>Lista</Button>} />
                  ) : (
                    <select id="f-plats" className="select" value={form.plats} onChange={(e) => (e.target.value === '__own' ? (setOwnPlace(true), setForm({ ...form, plats: '' })) : setForm({ ...form, plats: e.target.value }))}>
                      {places.map((x) => <option key={x} value={x}>{x}</option>)}
                      <option value="__own">Annan plats…</option>
                    </select>
                  )}
                </div>
                <div className="full">
                  <span className="field-label">Kategori</span>
                  <SegmentedButton label="Kategori" value={form.kat} onChange={(v) => setForm({ ...form, kat: v })}
                    options={kategorier.map((k) => ({ value: k, label: k }))} />
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <Button variant="text" onClick={() => { setForm({ ...form, sn: '', pn: null, model: '', asset: '' }); setAssetEdited(false); setFb(null); }}>Rensa</Button>
                <Button icon="add" disabled={!c.ok || busy || store.readOnly} onClick={() => save(form, asset)}>{asset ? `Spara som ${asset}` : 'Spara'}</Button>
              </div>
            </section>

            <section className="rk-card stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>Tillagda nu</h2>
                <span style={{ fontSize: 32, lineHeight: '36px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{added.length}</span>
              </div>
              {!added.length && <div className="small muted" style={{ padding: '24px 8px', textAlign: 'center' }}>Inget sparat än. Varje skanning hamnar här.</div>}
              {added.map((a) => (
                <div key={a.sn} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'var(--surface-container-low)' }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{a.asset}</span>
                  <span style={{ minWidth: 0 }}><span className="mono small">{a.sn}</span><br /><span className="small muted">{a.model}</span></span>
                  <IconButton icon="undo" label={`Ångra ${a.asset}`} disabled={store.readOnly} onClick={() => undo(a)} />
                </div>
              ))}
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 10, flexWrap: 'wrap' }}>
                <Button variant="outlined" size="sm" icon="print" disabled={!added.length}
                  onClick={() => router.push(`/etiketter?serials=${encodeURIComponent(added.map((a) => a.sn).join(','))}`)}>Skriv ut etiketter</Button>
                <Button variant="tonal" size="sm" onClick={() => router.push('/enheter')}>Klar · visa i Enheter</Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

