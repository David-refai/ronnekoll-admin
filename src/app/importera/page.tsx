'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge, Banner, Button, Checkbox, DataTable, EmptyState, Icon, PageHeader, ScanCounters, ScanFeedback, SegmentedButton, Stepper, TextField,
  type Column,
} from '@/ds';
import { ScanInput } from '@/components/Scan';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { buildDevices, serialKey, unique } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { useStore } from '@/lib/store';

/* ---------- model ---------- */

const FIELDS = [
  { key: 'Serienummer', label: 'Serienummer', required: true, guess: /serie|serial|s\/?n\b|sn$/i },
  { key: 'AssetID', label: 'AssetID', guess: /asset|inventarie|tag|etikett/i },
  { key: 'Modell', label: 'Modell', guess: /modell|model|produktnamn|beskrivning/i },
  { key: 'ProduktID', label: 'Produkt (Chromebook/PC/iPad)', guess: /produkt|typ|type|kategori.*enhet/i },
  { key: 'Kategori', label: 'Kategori', guess: /^kategori$/i },
  { key: 'Agandetyp', label: 'Ägandetyp', guess: /ägande|agande|owner/i },
  { key: 'Plats', label: 'Plats', guess: /plats|location|rum/i },
  { key: 'Inköpsdatum', label: 'Inköpsdatum', guess: /inköp|inkop|purchase|datum|date/i },
  { key: 'TillhorKlass', label: 'Klass', guess: /klass|class/i },
  { key: 'Anteckningar', label: 'Anteckningar', guess: /antecknin|note|kommentar|order|leverant|garanti/i },
] as const;
type FieldKey = (typeof FIELDS)[number]['key'];
type Rec = Partial<Record<FieldKey, string>>;

interface ImportRow extends Rec {
  id: number;
  include: boolean;
}

type Level = 'ok' | 'warn' | 'error';
interface Check { level: Level; msg: string }

const STEPS = ['Källa', 'Kolumner', 'Klassificering', 'Validering', 'Importera', 'Resultat'];

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : lines.some((l) => l.includes(',')) ? ',' : null;
  return lines.map((l) => (sep ? l.split(sep) : [l]).map((c) => c.replace(/^"|"$/g, '').trim()));
}

/** True if a row looks like a header row (no value looks like a serial). */
const looksLikeHeader = (row: string[]) => row.some((c) => FIELDS.some((f) => f.guess.test(c))) && !row.some((c) => /^[A-Z0-9]{7,}$/.test(c));

/* ---------- page ---------- */

export default function Importera() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);

  const [step, setStep] = React.useState(0);
  const [source, setSource] = React.useState<'fil' | 'klistra' | 'skanna'>('fil');
  const [table, setTable] = React.useState<string[][]>([]); // raw rows incl. header
  const [hasHeader, setHasHeader] = React.useState(true);
  const [fileName, setFileName] = React.useState('');
  const [paste, setPaste] = React.useState('');
  const [scanned, setScanned] = React.useState<string[]>([]);
  const [scanFb, setScanFb] = React.useState<{ state: 'success' | 'warning' | 'error'; title: string; serial?: string } | null>(null);
  const [scanValue, setScanValue] = React.useState('');
  const [mapping, setMapping] = React.useState<Partial<Record<FieldKey, number>>>({});
  const [extraToNotes, setExtraToNotes] = React.useState(true);
  const [defaults, setDefaults] = React.useState({
    Modell: '', ProduktID: 'Chromebook', Kategori: 'Elev', Agandetyp: 'Tilldelad elev', Plats: 'IT-förråd', Inköpsdatum: new Date().toISOString().slice(0, 10), batch: '',
  });
  const [autoAsset, setAutoAsset] = React.useState(true);
  const [assetPrefix, setAssetPrefix] = React.useState('RÖGR');
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, errors: [] as { serial: string; msg: string }[] });
  const [imported, setImported] = React.useState<ImportRow[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const existing = React.useMemo(() => new Set(devices.map((d) => serialKey(d.serial))), [devices]);
  const existingAssets = React.useMemo(() => new Set(devices.map((d) => serialKey(d.assetId)).filter(Boolean)), [devices]);

  const nextAssetNumber = React.useMemo(() => {
    const re = new RegExp('^' + assetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i');
    let max = 0;
    for (const d of devices) {
      const m = d.assetId.match(re);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
  }, [devices, assetPrefix]);

  /* step 1 → 2 */
  const header = hasHeader && table.length ? table[0] : table[0]?.map((_, i) => `Kolumn ${i + 1}`) ?? [];
  const body = hasHeader ? table.slice(1) : table;

  const autoMap = (hdr: string[], firstRow?: string[]) => {
    const m: Partial<Record<FieldKey, number>> = {};
    FIELDS.forEach((f) => {
      const i = hdr.findIndex((h) => f.guess.test(h));
      if (i >= 0 && !Object.values(m).includes(i)) m[f.key] = i;
    });
    if (m.Serienummer == null && firstRow) {
      const i = firstRow.findIndex((c) => /^[A-Z0-9-]{7,}$/i.test(c));
      m.Serienummer = i >= 0 ? i : 0;
    }
    setMapping(m);
  };

  const onFile = async (f: File) => {
    setFileError(null);
    setFileName(f.name);
    try {
      let data: string[][];
      if (/\.xlsx$/i.test(f.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        const sheet = await readSheet(f);
        data = (sheet as unknown[][]).map((r) => r.map(cellStr)).filter((r) => r.some(Boolean));
      } else {
        data = parseDelimited(await f.text());
      }
      if (!data.length) throw new Error('Filen är tom.');
      const hdr = looksLikeHeader(data[0]);
      setHasHeader(hdr);
      setTable(data);
      autoMap(hdr ? data[0] : data[0].map((_, i) => `Kolumn ${i + 1}`), hdr ? data[1] : data[0]);
    } catch (e) {
      setFileError(`Kunde inte läsa filen: ${e instanceof Error ? e.message : String(e)}. Spara som .xlsx eller .csv och försök igen.`);
      setTable([]);
    }
  };

  const fromPaste = () => {
    const data = parseDelimited(paste);
    const hdr = data.length > 1 && looksLikeHeader(data[0]);
    setHasHeader(hdr);
    setTable(data);
    autoMap(hdr ? data[0] : data[0]?.map((_, i) => `Kolumn ${i + 1}`) ?? [], hdr ? data[1] : data[0]);
  };

  const onScan = (raw: string) => {
    const k = serialKey(raw);
    setScanValue('');
    if (!k) return;
    if (scanned.includes(k)) return setScanFb({ state: 'warning', title: 'Redan skannad', serial: k });
    if (existing.has(k)) return setScanFb({ state: 'error', title: 'Finns redan i Enheter', serial: k });
    setScanned((s) => [...s, k]);
    setScanFb({ state: 'success', title: `Tillagd (${scanned.length + 1})`, serial: k });
  };

  const sourceReady = source === 'skanna' ? scanned.length > 0 : table.length > (hasHeader ? 1 : 0);

  const goFromSource = () => {
    if (source === 'skanna') {
      setTable([['Serienummer'], ...scanned.map((s) => [s])]);
      setHasHeader(true);
      setMapping({ Serienummer: 0 });
      setStep(2); // nothing to map
    } else setStep(1);
  };

  /* step 3 → 4 : build rows */
  const buildRows = () => {
    let n = nextAssetNumber;
    const used = new Set<number>(Object.values(mapping).filter((v): v is number => v != null));
    const out: ImportRow[] = body.map((r, i) => {
      const rec: Rec = {};
      FIELDS.forEach((f) => {
        const idx = mapping[f.key];
        if (idx != null) rec[f.key] = cellStr(r[idx]);
      });
      if (extraToNotes) {
        const extras = header.map((h, j) => (!used.has(j) && r[j] ? `${h}: ${r[j]}` : '')).filter(Boolean);
        if (extras.length) rec.Anteckningar = [rec.Anteckningar, ...extras].filter(Boolean).join(' · ');
      }
      if (defaults.batch) rec.Anteckningar = [rec.Anteckningar, `Leverans: ${defaults.batch}`].filter(Boolean).join(' · ');
      rec.Serienummer = serialKey(rec.Serienummer);
      rec.Modell = rec.Modell || defaults.Modell;
      rec.ProduktID = rec.ProduktID || defaults.ProduktID;
      rec.Kategori = rec.Kategori || defaults.Kategori;
      rec.Agandetyp = rec.Agandetyp || defaults.Agandetyp;
      rec.Plats = rec.Plats || defaults.Plats;
      rec.Inköpsdatum = rec.Inköpsdatum || defaults.Inköpsdatum;
      if (!rec.AssetID && autoAsset && rec.Serienummer) rec.AssetID = `${assetPrefix}${n++}`;
      return { ...rec, id: i + 1, include: true };
    });
    setRows(out);
    setStep(3);
  };

  const checks = React.useMemo(() => {
    const serialCount = new Map<string, number>();
    const assetCount = new Map<string, number>();
    rows.filter((r) => r.include).forEach((r) => {
      if (r.Serienummer) serialCount.set(r.Serienummer, (serialCount.get(r.Serienummer) ?? 0) + 1);
      if (r.AssetID) assetCount.set(serialKey(r.AssetID), (assetCount.get(serialKey(r.AssetID)) ?? 0) + 1);
    });
    const map = new Map<number, Check>();
    for (const r of rows) {
      const s = r.Serienummer ?? '';
      let c: Check = { level: 'ok', msg: 'OK' };
      if (!s) c = { level: 'error', msg: 'Serienummer saknas' };
      else if (existing.has(s)) c = { level: 'error', msg: 'Finns redan i Enheter' };
      else if ((serialCount.get(s) ?? 0) > 1) c = { level: 'error', msg: 'Dubblett i filen' };
      else if (r.AssetID && existingAssets.has(serialKey(r.AssetID))) c = { level: 'error', msg: `AssetID ${r.AssetID} används redan` };
      else if (r.AssetID && (assetCount.get(serialKey(r.AssetID)) ?? 0) > 1) c = { level: 'error', msg: 'AssetID dubblett i filen' };
      else if (!/^[A-Z0-9-]{6,20}$/.test(s)) c = { level: 'warn', msg: 'Ovanligt format — kontrollera' };
      else if (!r.Modell) c = { level: 'warn', msg: 'Modell saknas' };
      map.set(r.id, c);
    }
    return map;
  }, [rows, existing, existingAssets]);

  const importable = rows.filter((r) => r.include && checks.get(r.id)?.level !== 'error');
  const counts = {
    ok: rows.filter((r) => r.include && checks.get(r.id)?.level === 'ok').length,
    warn: rows.filter((r) => r.include && checks.get(r.id)?.level === 'warn').length,
    error: rows.filter((r) => r.include && checks.get(r.id)?.level === 'error').length,
    excluded: rows.filter((r) => !r.include).length,
  };

  const runImport = async () => {
    setStep(4);
    const list = importable;
    const errors: { serial: string; msg: string }[] = [];
    const ok: ImportRow[] = [];
    setProgress({ done: 0, total: list.length, errors });
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      try {
        await store.create('enheter', {
          Title: r.AssetID ?? '', AssetID: r.AssetID ?? '', Serienummer: r.Serienummer, ProduktID: r.ProduktID, Kategori: r.Kategori, Modell: r.Modell,
          Agandetyp: r.Agandetyp, Plats: r.Plats, Inköpsdatum: r['Inköpsdatum'], TillhorKlass: r.TillhorKlass ?? '', Anteckningar: r.Anteckningar ?? '', Status: 'Tillgänglig',
        });
        ok.push(r);
      } catch (e) {
        errors.push({ serial: r.Serienummer ?? '', msg: e instanceof Error ? e.message : String(e) });
      }
      setProgress({ done: i + 1, total: list.length, errors: [...errors] });
    }
    setImported(ok);
    await log(store, { typ: 'Import', detaljer: `${ok.length} enheter importerade${defaults.batch ? ` · "${defaults.batch}"` : ''}${errors.length ? ` · ${errors.length} fel` : ''}${fileName ? ` · ${fileName}` : ''}` });
    setStep(5);
  };

  const reset = () => {
    setStep(0); setTable([]); setPaste(''); setScanned([]); setRows([]); setImported([]); setFileName(''); setScanFb(null); setMapping({});
  };

  const setRow = (id: number, patch: Partial<ImportRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const models = unique(devices.map((d) => d.modell));
  const places = unique(devices.map((d) => d.plats));

  const valColumns: Column<ImportRow>[] = [
    { key: 'include', label: '', sortable: false, render: (r) => <Checkbox label="Ta med" checked={r.include} onChange={(v) => setRow(r.id, { include: v })} /> },
    {
      key: 'check', label: 'Kontroll', sortable: false,
      render: (r) => {
        const c = checks.get(r.id)!;
        if (!r.include) return <Badge tone="gray">Utesluten</Badge>;
        return <Badge tone={c.level === 'ok' ? 'green' : c.level === 'warn' ? 'amber' : 'red'} icon={c.level === 'ok' ? 'check_circle' : c.level === 'warn' ? 'warning' : 'error'}>{c.msg}</Badge>;
      },
    },
    {
      key: 'Serienummer', label: 'Serienummer', sortable: false,
      render: (r) => <input className="select mono" style={{ height: 32, width: 150 }} value={r.Serienummer ?? ''} onChange={(e) => setRow(r.id, { Serienummer: serialKey(e.target.value) })} />,
    },
    { key: 'AssetID', label: 'AssetID', sortable: false, render: (r) => <input className="select mono" style={{ height: 32, width: 110 }} value={r.AssetID ?? ''} onChange={(e) => setRow(r.id, { AssetID: e.target.value.trim() })} /> },
    { key: 'Modell', label: 'Modell', render: (r) => r.Modell || <span className="rk-muted">—</span> },
    { key: 'ProduktID', label: 'Produkt' },
    { key: 'Kategori', label: 'Kategori' },
    { key: 'Plats', label: 'Plats' },
  ];

  return (
    <>
      <PageHeader title="Importera enheter" description="Ta emot en leverans: läs in en Excel-fil, klistra in en lista eller skanna enheterna en i taget." />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 24 }}>
          <Stepper steps={STEPS} current={step} />

          {step === 0 && (
            <section className="rk-card stack" style={{ gap: 20 }}>
              <SegmentedButton label="Källa" value={source} onChange={(v) => setSource(v as typeof source)}
                options={[{ value: 'fil', label: 'Excel / CSV', icon: 'upload_file' }, { value: 'klistra', label: 'Klistra in', icon: 'content_paste' }, { value: 'skanna', label: 'Skanna', icon: 'barcode_scanner' }]} />
              {source === 'fil' && (
                <>
                  <label className="rk-card" style={{ border: '2px dashed var(--outline)', boxShadow: 'none', textAlign: 'center', cursor: 'pointer', padding: 40 }}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
                    <input type="file" accept=".xlsx,.csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                    <Icon name="upload_file" size={40} />
                    <div style={{ fontWeight: 700, marginTop: 8 }}>{fileName || 'Släpp en fil här eller klicka för att välja'}</div>
                    <div className="small muted">.xlsx eller .csv — t.ex. leverantörens följesedel. Första raden får vara rubriker.</div>
                  </label>
                  {fileError && <Banner tone="error" title="Fel i filen">{fileError}</Banner>}
                  {table.length > 0 && <span className="small">{body.length} rader hittades{hasHeader ? ' (första raden är rubriker)' : ''}.</span>}
                </>
              )}
              {source === 'klistra' && (
                <>
                  <TextField label="Serienummer eller tabell från Excel" multiline rows={10} mono value={paste} onChange={(e) => setPaste(e.target.value)}
                    placeholder={'5CD45215V4\n5CD45215VX\n…\n\neller kopiera flera kolumner direkt från Excel'} helper="Ett serienummer per rad, eller kopierade Excel-celler (tabbar blir kolumner)" />
                  <div><Button variant="tonal" icon="table_view" disabled={!paste.trim()} onClick={fromPaste}>Läs in</Button>{table.length > 0 && <span className="small" style={{ marginLeft: 12 }}>{body.length} rader</span>}</div>
                </>
              )}
              {source === 'skanna' && (
                <div className="grid-7-5">
                  <div className="stack">
                    <ScanInput size="lg" scanning autoFocus shortcut={false} placeholder="Skanna nästa enhet" value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)} onScan={onScan} />
                    {scanFb && <ScanFeedback state={scanFb.state} title={scanFb.title} serial={scanFb.serial} />}
                    <ScanCounters items={[{ label: 'Skannade', value: scanned.length, tone: 'green', icon: 'barcode_scanner' }]} />
                  </div>
                  <div className="rk-card" style={{ padding: 8, maxHeight: 360, overflow: 'auto', boxShadow: 'none', background: 'var(--surface-container-low)' }}>
                    {[...scanned].reverse().map((s) => (
                      <div key={s} className="row picker-row" style={{ cursor: 'default' }}>
                        <span className="mono" style={{ flex: 1 }}>{s}</span>
                        <button type="button" className="rk-btn rk-btn--text rk-btn--sm" onClick={() => setScanned((l) => l.filter((x) => x !== s))}><span>Ta bort</span></button>
                      </div>
                    ))}
                    {!scanned.length && <div className="small muted" style={{ padding: 12 }}>Skanna enheterna — de hamnar här.</div>}
                  </div>
                </div>
              )}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button icon="arrow_forward" disabled={!sourceReady} onClick={goFromSource}>Nästa</Button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="rk-card stack" style={{ gap: 16 }}>
              <h2 className="section-title">Vilken kolumn är vad?</h2>
              <Checkbox showLabel label="Första raden är rubriker" checked={hasHeader} onChange={(v) => { setHasHeader(v); }} />
              <div className="form-grid">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="field-label" htmlFor={`map-${f.key}`}>{f.label}{'required' in f && f.required ? ' *' : ''}</label>
                    <select id={`map-${f.key}`} className="select" value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                      <option value="">— Används inte —</option>
                      {header.map((h, i) => <option key={i} value={i}>{h || `Kolumn ${i + 1}`}{body[0]?.[i] ? ` (t.ex. ${body[0][i]})` : ''}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <Checkbox showLabel label="Lägg övriga kolumner (t.ex. ordernummer, garanti) i Anteckningar" checked={extraToNotes} onChange={setExtraToNotes} />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Button variant="text" icon="arrow_back" onClick={() => setStep(0)}>Tillbaka</Button>
                <Button icon="arrow_forward" disabled={mapping.Serienummer == null} onClick={() => setStep(2)}>Nästa</Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rk-card stack" style={{ gap: 16 }}>
              <h2 className="section-title">Klassificera leveransen</h2>
              <p className="small muted" style={{ margin: 0 }}>Gäller alla rader där filen saknar värdet. Nya enheter får status <b>Tillgänglig</b>.</p>
              <div className="form-grid">
                <TextField label="Modell" value={defaults.Modell} list="imp-models" onChange={(e) => setDefaults({ ...defaults, Modell: e.target.value })} placeholder="HP Fortis Flip G1m 11" />
                <datalist id="imp-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
                <div><label className="field-label" htmlFor="d-prod">Produkt</label><select id="d-prod" className="select" value={defaults.ProduktID} onChange={(e) => setDefaults({ ...defaults, ProduktID: e.target.value })}>{['Chromebook', 'PC', 'iPad'].map((x) => <option key={x}>{x}</option>)}</select></div>
                <div><label className="field-label" htmlFor="d-kat">Kategori</label><select id="d-kat" className="select" value={defaults.Kategori} onChange={(e) => setDefaults({ ...defaults, Kategori: e.target.value, Agandetyp: e.target.value === 'Elev' ? 'Tilldelad elev' : e.target.value === 'Lånepool' ? 'Skolans lånepool' : 'Personal' })}>{['Elev', 'Lånepool', 'Personal'].map((x) => <option key={x}>{x}</option>)}</select></div>
                <TextField label="Ägandetyp" value={defaults.Agandetyp} onChange={(e) => setDefaults({ ...defaults, Agandetyp: e.target.value })} />
                <TextField label="Plats" value={defaults.Plats} list="imp-places" onChange={(e) => setDefaults({ ...defaults, Plats: e.target.value })} />
                <datalist id="imp-places">{places.map((m) => <option key={m} value={m} />)}</datalist>
                <TextField label="Inköpsdatum" type="date" value={defaults.Inköpsdatum} onChange={(e) => setDefaults({ ...defaults, Inköpsdatum: e.target.value })} />
                <TextField className="full" label="Leverans / batch (valfritt)" value={defaults.batch} onChange={(e) => setDefaults({ ...defaults, batch: e.target.value })} placeholder="HP höst 2026" helper="Skrivs i Anteckningar så att du kan hitta leveransen senare" />
              </div>
              <div className="rk-card" style={{ boxShadow: 'none', background: 'var(--surface-container-low)' }}>
                <Checkbox showLabel label="Ge enheter utan AssetID ett nytt nummer automatiskt" checked={autoAsset} onChange={setAutoAsset} />
                {autoAsset && (
                  <div className="row" style={{ marginTop: 12 }}>
                    <TextField label="Prefix" mono value={assetPrefix} onChange={(e) => setAssetPrefix(e.target.value.toUpperCase())} />
                    <span className="small">Nästa nummer: <b className="mono">{assetPrefix}{nextAssetNumber}</b></span>
                  </div>
                )}
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Button variant="text" icon="arrow_back" onClick={() => setStep(source === 'skanna' ? 0 : 1)}>Tillbaka</Button>
                <Button icon="arrow_forward" onClick={buildRows}>Validera</Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="stack" style={{ gap: 16 }}>
              <ScanCounters items={[
                { label: 'OK', value: counts.ok, tone: 'green', icon: 'check_circle' },
                { label: 'Varningar', value: counts.warn, tone: 'amber', icon: 'warning' },
                { label: 'Fel (hoppas över)', value: counts.error, tone: 'red', icon: 'error' },
                { label: 'Uteslutna', value: counts.excluded, tone: 'gray', icon: 'block' },
              ]} />
              <p className="small muted" style={{ margin: 0 }}>Rätta serienummer direkt i tabellen eller bocka ur rader. Rader med fel importeras inte.</p>
              <DataTable<ImportRow> columns={valColumns} rows={rows} density="compact" maxHeight={560} />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Button variant="text" icon="arrow_back" onClick={() => setStep(2)}>Tillbaka</Button>
                <Button icon="upload" disabled={!importable.length || store.readOnly} onClick={runImport}>Importera {importable.length} enheter</Button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="rk-card stack" style={{ gap: 16 }}>
              <h2 className="section-title">Importerar…</h2>
              <div className="hbar" style={{ height: 14 }}><div style={{ height: 14, width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, transition: 'width .2s' }} /></div>
              <span className="small">{progress.done} av {progress.total}{progress.errors.length ? ` · ${progress.errors.length} fel` : ''}. Stäng inte fliken.</span>
            </section>
          )}

          {step === 5 && (
            <section className="rk-card stack" style={{ gap: 16 }}>
              {imported.length ? (
                <EmptyState icon="task_alt" tone="green" title={`${imported.length} enheter importerade`}
                  description={`${defaults.batch ? `Leverans "${defaults.batch}". ` : ''}${progress.errors.length ? `${progress.errors.length} rader misslyckades.` : 'Alla rader sparades.'}`} />
              ) : (
                <EmptyState icon="error" tone="red" title="Inga enheter importerades" description="Se felen nedan." />
              )}
              {progress.errors.length > 0 && (
                <Banner tone="error" title="Rader som inte sparades">
                  {progress.errors.slice(0, 8).map((e) => `${e.serial}: ${e.msg}`).join(' · ')}
                </Banner>
              )}
              <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button icon="print" disabled={!imported.length} onClick={() => router.push(`/etiketter?serials=${imported.map((r) => r.Serienummer).join(',')}`)}>Skriv ut etiketter</Button>
                <Button variant="outlined" icon="download" onClick={() => exportXlsx('Importrapport', [
                  { label: 'Serienummer', value: (r: ImportRow) => r.Serienummer }, { label: 'AssetID', value: (r) => r.AssetID }, { label: 'Modell', value: (r) => r.Modell },
                  { label: 'Produkt', value: (r) => r.ProduktID }, { label: 'Kategori', value: (r) => r.Kategori }, { label: 'Plats', value: (r) => r.Plats },
                  { label: 'Resultat', value: (r) => (imported.includes(r) ? 'Importerad' : !r.include ? 'Utesluten' : progress.errors.find((e) => e.serial === r.Serienummer)?.msg ?? checks.get(r.id)?.msg ?? '') },
                ], rows)}>Exportera importrapport</Button>
                <Button variant="outlined" icon="laptop_chromebook" onClick={() => router.push('/enheter')}>Visa i Enheter</Button>
                <Button variant="text" icon="restart_alt" onClick={reset}>Ny import</Button>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
