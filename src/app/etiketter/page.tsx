'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Badge, Button, Checkbox, Chip, DataTable, EmptyState, IconButton, PageHeader, SegmentedButton, TextField, type Column } from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { ScanInput } from '@/components/Scan';
import { log } from '@/lib/actions';
import { buildDevices, serialKey, unique, type DeviceView } from '@/lib/derive';
import { useStore } from '@/lib/store';

type LRow = DeviceView & { id: string };
type Template = '62x29' | '54x17' | 'a4-3x8';
const TEMPLATES: Record<Template, { label: string; w: number; h: number; page: string }> = {
  '62x29': { label: 'Etikettskrivare 62 × 29 mm', w: 62, h: 29, page: '62mm 29mm' },
  '54x17': { label: 'Etikettskrivare 54 × 17 mm', w: 54, h: 17, page: '54mm 17mm' },
  'a4-3x8': { label: 'A4-ark 3 × 8 (70 × 37 mm)', w: 70, h: 37, page: 'A4' },
};

interface Fields { qr: boolean; barcode: boolean; assetId: boolean; modell: boolean; skola: boolean; elev: boolean }

function Barcode({ value, height }: { value: string; height: number }) {
  const ref = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.4, background: '#ffffff', lineColor: '#000000' });
      ref.current.setAttribute('preserveAspectRatio', 'none');
    } catch { /* invalid value */ }
  }, [value]);
  return <svg ref={ref} style={{ width: '100%', height: `${height}mm`, display: 'block' }} />;
}

function Qr({ value, size }: { value: string; size: number }) {
  const [src, setSrc] = React.useState('');
  React.useEffect(() => {
    QRCode.toDataURL(value, { margin: 0, errorCorrectionLevel: 'M', width: 256 }).then(setSrc).catch(() => setSrc(''));
  }, [value]);
  return src ? <img src={src} alt="" style={{ width: `${size}mm`, height: `${size}mm`, flexShrink: 0 }} /> : null;
}

/** One physical label, sized in millimetres. Black on white in every theme. */
function Label({ d, t, f }: { d: DeviceView; t: Template; f: Fields }) {
  const T = TEMPLATES[t];
  const small = t === '54x17';
  const qrSize = T.h - 6;
  return (
    <div className="label" style={{ width: `${T.w}mm`, height: `${T.h}mm` }}>
      {f.qr && !small && <Qr value={d.serial} size={qrSize} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
        <div>
          {f.assetId && <div style={{ fontWeight: 800, fontSize: small ? '3.2mm' : '4.4mm', lineHeight: 1.05 }}>{d.assetId || d.serial}</div>}
          {f.modell && !small && <div style={{ fontSize: '2.4mm', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.modell}</div>}
          {f.elev && d.holder && !small && <div style={{ fontSize: '2.4mm', lineHeight: 1.2 }}>{d.holder.namn} · {d.holder.klass}</div>}
        </div>
        <div>
          {f.barcode && <Barcode value={d.serial} height={small ? 6 : 7} />}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: small ? '2.2mm' : '2.5mm', letterSpacing: '0.04em' }}>{d.serial}</div>
          {f.skola && !small && <div style={{ fontSize: '2mm', lineHeight: 1.2 }}>Rönnenskolan – Malmö stad</div>}
        </div>
      </div>
    </div>
  );
}

function EtiketterInner() {
  const store = useStore();
  const ready = useReady();
  const params = useSearchParams();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [template, setTemplate] = React.useState<Template>('62x29');
  const [fields, setFields] = React.useState<Fields>({ qr: true, barcode: true, assetId: true, modell: true, skola: true, elev: false });
  const [copies, setCopies] = React.useState(1);
  const [scan, setScan] = React.useState('');
  const [klass, setKlass] = React.useState<string | null>(null);
  const [modell, setModell] = React.useState<string | null>(null);
  const [noAsset, setNoAsset] = React.useState(false);
  const classes = React.useMemo(() => unique(devices.map((d) => d.klass)).filter((k) => !/^avgått/i.test(k)), [devices]);
  const needle = scan.trim().toLowerCase();
  const visible: LRow[] = React.useMemo(
    () =>
      devices
        .filter((d) => d.status !== 'Kasserad')
        .filter((d) => (!klass || d.klass === klass) && (!modell || d.modell === modell) && (!noAsset || !d.assetId))
        .filter((d) => !needle || [d.assetId, d.serial, d.modell, d.holder?.namn, d.klass].join(' ').toLowerCase().includes(needle))
        .sort((a, b) => `${a.klass} ${a.assetId}`.localeCompare(`${b.klass} ${b.assetId}`, 'sv', { numeric: true }))
        .map((d) => ({ ...d, id: serialKey(d.serial) })),
    [devices, klass, modell, noAsset, needle],
  );
  const pickCols: Column<LRow>[] = [
    { key: 'assetId', label: 'AssetID', mono: true, render: (d) => d.assetId || <Badge tone="amber">Saknas</Badge> },
    { key: 'serial', label: 'Serienummer', mono: true },
    { key: 'klass', label: 'Klass', render: (d) => d.klass || '—' },
    { key: 'elev', label: 'Elev', render: (d) => d.holder?.namn ?? '—' },
    { key: 'modell', label: 'Modell' },
  ];

  React.useEffect(() => {
    const s = params.get('serials');
    if (s) setSelected(s.split(',').map(serialKey).filter(Boolean));
  }, [params]);

  const chosen = selected.map((k) => devices.find((d) => serialKey(d.serial) === k)).filter((d): d is DeviceView => !!d);
  const add = (list: DeviceView[]) => setSelected((s) => Array.from(new Set([...s, ...list.map((d) => serialKey(d.serial))])));
  /** Enter/scan: an exact serial or AssetID is added directly; otherwise all matches are added. */
  const onScan = (raw: string) => {
    const k = serialKey(raw);
    const d = devices.find((x) => serialKey(x.serial) === k || (x.assetId && serialKey(x.assetId) === k));
    if (d) {
      add([d]);
      setScan('');
    } else if (visible.length) {
      add(visible);
      store.toast({ icon: 'add', message: `${visible.length} enheter lades till` });
    } else store.toast({ icon: 'error', message: `Hittar ingen enhet som matchar ${raw}` });
  };

  const print = async () => {
    const T = TEMPLATES[template];
    const style = document.createElement('style');
    style.id = 'rk-print-page';
    style.textContent = `@page { size: ${T.page}; margin: ${template === 'a4-3x8' ? '4mm 0 0 0' : '0'}; }`;
    document.getElementById('rk-print-page')?.remove();
    document.head.appendChild(style);
    window.print();
    await log(store, { typ: 'Etikett', detaljer: `${chosen.length * copies} etiketter utskrivna (${T.label}): ${chosen.slice(0, 10).map((d) => d.assetId || d.serial).join(', ')}${chosen.length > 10 ? '…' : ''}` });
  };

  const labels = chosen.flatMap((d) => Array.from({ length: copies }, (_, i) => ({ d, key: `${d.id}-${i}` })));
  const set = (k: keyof Fields) => (v: boolean) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="no-print">
        <PageHeader title="Etiketter" description="Skriv ut etiketter med QR-kod och streckkod (Code128) för serienumret — skannas direkt i RönneKoll."
          actions={<Button icon="print" disabled={!chosen.length} onClick={print}>Skriv ut {labels.length || ''}</Button>} />
      </div>
      {!ready ? <PageState /> : (
        <div className="grid-7-5 no-print">
          <div className="stack" style={{ gap: 20 }}>
            <section className="rk-card stack">
              <h2 className="section-title" style={{ fontSize: 16 }}>Välj enheter</h2>
              <div>
                <div className="field-label">Hela klassen</div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {classes.map((k) => {
                    const inClass = devices.filter((d) => d.klass === k && d.status !== 'Kasserad');
                    const all = inClass.length > 0 && inClass.every((d) => selected.includes(serialKey(d.serial)));
                    return (
                      <Chip key={k} label={k} count={inClass.length} selected={all}
                        onClick={() => (all ? setSelected((s) => s.filter((x) => !inClass.some((d) => serialKey(d.serial) === x))) : add(inClass))} />
                    );
                  })}
                </div>
              </div>
              <ScanInput shortcut={false} placeholder="Sök AssetID, serienummer, elev eller modell — eller skanna" value={scan}
                onChange={(e) => setScan(e.target.value)} onScan={onScan} />
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <FilterMenu label="Klass" value={klass} onChange={setKlass} options={classes.map((v) => ({ value: v }))} />
                <FilterMenu label="Modell" value={modell} onChange={setModell} options={unique(devices.map((d) => d.modell)).map((v) => ({ value: v }))} />
                <Chip label="Utan AssetID" selected={noAsset} count={devices.filter((d) => !d.assetId).length} onClick={() => setNoAsset(!noAsset)} />
                <span className="small muted" style={{ marginLeft: 'auto' }}>{visible.length} visas · <b>{chosen.length} valda</b></span>
                {chosen.length > 0 && <Button variant="text" size="sm" onClick={() => setSelected([])}>Rensa val</Button>}
              </div>
              <DataTable<LRow>
                columns={pickCols}
                rows={visible}
                density="compact"
                selectable
                maxHeight={420}
                selected={visible.filter((d) => selected.includes(d.id)).map((d) => d.id)}
                onSelectionChange={(ids) => {
                  const shown = new Set(visible.map((d) => d.id));
                  setSelected((s) => [...s.filter((x) => !shown.has(x)), ...(ids as string[])]);
                }}
                onRowClick={(d) => setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))}
              />
            </section>
            <section className="rk-card">
              <h2 className="section-title" style={{ fontSize: 16, marginBottom: 12 }}>Förhandsvisning</h2>
              {chosen.length ? (
                <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
                  {labels.slice(0, 12).map(({ d, key }) => <Label key={key} d={d} t={template} f={fields} />)}
                  {labels.length > 12 && <Badge>+{labels.length - 12} till</Badge>}
                </div>
              ) : <EmptyState compact icon="label" title="Välj enheter" description="Klicka på en klass, bocka i rader eller skanna." />}
            </section>
          </div>
          <section className="rk-card stack" style={{ gap: 16 }}>
            <h2 className="section-title" style={{ fontSize: 16 }}>Mall</h2>
            <SegmentedButton label="Mall" value={template} onChange={(v) => setTemplate(v as Template)}
              options={[{ value: '62x29', label: '62×29' }, { value: '54x17', label: '54×17' }, { value: 'a4-3x8', label: 'A4 3×8' }]} />
            <span className="small muted">{TEMPLATES[template].label}</span>
            <div className="stack" style={{ gap: 8 }}>
              <Checkbox showLabel label="QR-kod" checked={fields.qr} onChange={set('qr')} />
              <Checkbox showLabel label="Streckkod (Code128)" checked={fields.barcode} onChange={set('barcode')} />
              <Checkbox showLabel label="AssetID" checked={fields.assetId} onChange={set('assetId')} />
              <Checkbox showLabel label="Modell" checked={fields.modell} onChange={set('modell')} />
              <Checkbox showLabel label="Elev och klass" checked={fields.elev} onChange={set('elev')} />
              <Checkbox showLabel label="Rönnenskolan – Malmö stad" checked={fields.skola} onChange={set('skola')} />
            </div>
            <div className="row">
              <span className="small">Kopior per enhet</span>
              <IconButton icon="remove" label="Färre" disabled={copies <= 1} onClick={() => setCopies(copies - 1)} />
              <b>{copies}</b>
              <IconButton icon="add" label="Fler" disabled={copies >= 5} onClick={() => setCopies(copies + 1)} />
            </div>
            <TextField label="Tips" readOnly value="Välj rätt pappersstorlek i utskriftsdialogen och marginal: Ingen." />
          </section>
        </div>
      )}
      <div className={`print-area print-${template}`} aria-hidden>
        {labels.map(({ d, key }) => <Label key={key} d={d} t={template} f={fields} />)}
      </div>
    </>
  );
}

export default function EtiketterPage() {
  return (
    <React.Suspense fallback={null}>
      <EtiketterInner />
    </React.Suspense>
  );
}
