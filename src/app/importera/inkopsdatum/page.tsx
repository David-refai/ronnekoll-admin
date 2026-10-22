'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Banner, Button, Checkbox, DataTable, EmptyState, PageHeader, SegmentedButton, type Column } from '@/ds';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { buildDevices, serialKey } from '@/lib/derive';
import { useStore } from '@/lib/store';

/*
 * Uppdatera Inköpsdatum för befintliga enheter från en fil.
 * Matchar på Serienummer och skriver ENDAST fältet Inköpsdatum — inga andra fält, inga nya rader.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, mars: 3, apr: 4, april: 4,
  may: 5, maj: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, juli: 7, aug: 8, august: 8, augusti: 8,
  sep: 9, sept: 9, september: 9, oct: 10, okt: 10, october: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
function valid(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return y > 1990 && y < 2100 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
/** Accepts 2024-12-27, 2024/12/27, "December 27, 2024", "27 dec 2024", Excel serials. Returns YYYY-MM-DD or null. */
function parseDate(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/ ](\d{1,2})[-/ ](\d{1,2})(?:[ t].*)?$/))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  if ((m = s.match(/^([a-zåäö]+) (\d{1,2}) (\d{4})$/)) && MONTHS[m[1]]) {
    const [y, mo, d] = [+m[3], MONTHS[m[1]], +m[2]];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  if ((m = s.match(/^(\d{1,2}) ([a-zåäö]+) (\d{4})$/)) && MONTHS[m[2]]) {
    const [y, mo, d] = [+m[3], MONTHS[m[2]], +m[1]];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/** RFC-4180-ish CSV/TSV/semicolon parser that respects quotes (values like ",HP ChromeBook" stay intact). */
function parseTable(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

interface Pair { serial: string; raw: string }

/** Turns a file's text into serial/date pairs. Supports CSV/TSV with headers and our JSON exports. */
function pairsFromText(text: string): Pair[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const j = JSON.parse(trimmed);
    const list: unknown[] = Array.isArray(j) ? j : Array.isArray(j.devices) ? j.devices : Object.entries(j).map(([serial, v]) => ({ serial, v }));
    return list.map((x) => {
      const o = x as Record<string, unknown>;
      const v = o.v as Record<string, unknown> | string | undefined;
      const date = o.inkopsdatum ?? o['Inköpsdatum'] ?? (typeof v === 'string' ? v : v?.inkopsdatum) ?? '';
      return { serial: String(o.serial ?? o.Serienummer ?? ''), raw: String(date ?? '') };
    });
  }
  return pairsFromRows(parseTable(text));
}

function pairsFromRows(rows: string[][]): Pair[] {
  if (!rows.length) return [];
  const hdr = rows[0].map((h) => h.toLowerCase());
  const si = hdr.findIndex((h) => /serie|serial/.test(h));
  const di = hdr.findIndex((h) => /inköp|inkop|purchase|startdatum/.test(h));
  if (si < 0 || di < 0) throw new Error('Hittade inte kolumnerna Serienummer och Inköpsdatum i första raden.');
  return rows.slice(1).map((r) => ({ serial: r[si] ?? '', raw: r[di] ?? '' }));
}

type Kind = 'andras' | 'samma' | 'saknas' | 'ogiltigt';
interface Row {
  id: string;
  kind: Kind;
  serial: string;
  asset: string;
  modell: string;
  current: string;
  next: string;
  deviceId?: string;
}

const KIND_LABEL: Record<Kind, string> = { andras: 'Ändras', samma: 'Oförändrat', saknas: 'Finns inte i Enheter', ogiltigt: 'Ogiltigt datum' };
const KIND_TONE: Record<Kind, 'blue' | 'gray' | 'amber' | 'red'> = { andras: 'blue', samma: 'gray', saknas: 'amber', ogiltigt: 'red' };

export default function UppdateraInkopsdatum() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);

  const [fileName, setFileName] = React.useState('');
  const [pairs, setPairs] = React.useState<Pair[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'andras' | 'alla' | 'problem'>('andras');
  const [overwrite, setOverwrite] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, errors: [] as { serial: string; msg: string }[] });
  const [finished, setFinished] = React.useState(false);

  const bySerial = React.useMemo(() => new Map(devices.map((d) => [serialKey(d.serial), d])), [devices]);

  const rows: Row[] = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    pairs.forEach((p, i) => {
      const key = serialKey(p.serial);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const d = bySerial.get(key);
      const next = parseDate(p.raw);
      const current = d?.inkop ?? '';
      const kind: Kind = !d ? 'saknas' : !next ? 'ogiltigt' : current === next ? 'samma' : 'andras';
      out.push({ id: `${i}-${key}`, kind, serial: d?.serial ?? key, asset: d?.assetId ?? '', modell: d?.modell ?? '', current, next: next ?? p.raw, deviceId: d?.id });
    });
    return out;
  }, [pairs, bySerial]);

  const toWrite = rows.filter((r) => r.kind === 'andras' && (overwrite || !r.current));
  const counts = React.useMemo(() => {
    const c: Record<Kind, number> = { andras: 0, samma: 0, saknas: 0, ogiltigt: 0 };
    rows.forEach((r) => c[r.kind]++);
    return c;
  }, [rows]);

  const shown = rows.filter((r) => (filter === 'alla' ? true : filter === 'andras' ? r.kind === 'andras' : r.kind === 'saknas' || r.kind === 'ogiltigt'));

  const onFile = async (f: File) => {
    setFileError(null);
    setFinished(false);
    setFileName(f.name);
    try {
      let p: Pair[];
      if (/\.xlsx$/i.test(f.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        const sheet = (await readSheet(f)) as unknown[][];
        p = pairsFromRows(sheet.map((r) => r.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).trim()))));
      } else {
        p = pairsFromText(await f.text());
      }
      if (!p.length) throw new Error('Inga rader hittades.');
      setPairs(p);
    } catch (e) {
      setPairs([]);
      setFileError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    setRunning(true);
    const errors: { serial: string; msg: string }[] = [];
    setProgress({ done: 0, total: toWrite.length, errors });
    let ok = 0;
    for (let i = 0; i < toWrite.length; i++) {
      const r = toWrite[i];
      try {
        // Only this one field is sent — nothing else on the item is touched.
        await store.update('enheter', r.deviceId!, { Inköpsdatum: r.next });
        ok++;
      } catch (e) {
        errors.push({ serial: r.serial, msg: e instanceof Error ? e.message : String(e) });
        if (/401|403|token/i.test(String(e))) break; // token expired: stop instead of failing every row
      }
      setProgress({ done: i + 1, total: toWrite.length, errors: [...errors] });
    }
    await log(store, { typ: 'Ändring', detaljer: `Inköpsdatum uppdaterat för ${ok} enheter från ${fileName || 'fil'}` });
    setRunning(false);
    setFinished(true);
    store.toast({ icon: errors.length ? 'error' : 'check_circle', message: `${ok} enheter uppdaterade${errors.length ? ` · ${errors.length} misslyckades` : ''}` });
  };

  const columns: Column<Row>[] = [
    { key: 'kind', label: 'Resultat', render: (r) => <Badge tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge> },
    { key: 'asset', label: 'Nummer', mono: true },
    { key: 'serial', label: 'Serienummer', mono: true },
    { key: 'modell', label: 'Modell' },
    { key: 'current', label: 'Nuvarande', mono: true, render: (r) => r.current || '—' },
    { key: 'next', label: 'Nytt', mono: true, render: (r) => (r.kind === 'ogiltigt' ? <span style={{ color: 'var(--rk-error, #b3261e)' }}>{r.next || '(tomt)'}</span> : r.next) },
  ];

  return (
    <>
      <PageHeader
        overline="Importera"
        title="Uppdatera inköpsdatum"
        description="Läs in en fil med Serienummer och Inköpsdatum. Enheterna matchas på serienummer och bara Inköpsdatum ändras — inga andra fält, inga nya enheter."
        actions={<Button variant="text" icon="arrow_back" onClick={() => router.push('/importera')}>Importera enheter</Button>}
      />
      {!ready ? <PageState /> : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="rk-card" style={{ display: 'grid', gap: 12 }}>
            <label htmlFor="inkop-file" style={{ fontWeight: 600 }}>Fil (.csv, .xlsx eller .json)</label>
            <input id="inkop-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <div style={{ color: 'var(--rk-on-surface-variant, inherit)', fontSize: 13 }}>
              Första raden ska innehålla kolumnerna <b>Serienummer</b> och <b>Inköpsdatum</b>. Datum som 2024-12-27, December 27, 2024 och 27 dec 2024 fungerar.
            </div>
            {fileError && <Banner tone="error" title="Kunde inte läsa filen">{fileError}</Banner>}
          </div>

          {!rows.length ? (
            <div className="rk-card" style={{ padding: 0 }}>
              <EmptyState icon="event" title="Ingen fil inläst" description="Välj filen med inköpsdatum ovan för att se vad som kommer att ändras innan något sparas." />
            </div>
          ) : (
            <>
              <div className="rk-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Badge tone="blue">{counts.andras} ändras</Badge>
                  <Badge tone="gray">{counts.samma} oförändrade</Badge>
                  {counts.saknas > 0 && <Badge tone="amber">{counts.saknas} finns inte i Enheter</Badge>}
                  {counts.ogiltigt > 0 && <Badge tone="red">{counts.ogiltigt} ogiltiga datum</Badge>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <Checkbox checked={overwrite} onChange={setOverwrite} label="Skriv över befintliga datum" showLabel />
                  <Button icon="event_available" disabled={!toWrite.length || running || store.readOnly || finished} onClick={run}>
                    {running ? `Sparar ${progress.done}/${progress.total}…` : `Uppdatera ${toWrite.length} enheter`}
                  </Button>
                </div>
              </div>

              {store.readOnly && <Banner tone="warning" title="Skrivskyddat">Token saknas eller har gått ut. Klistra in en ny token för att kunna spara.</Banner>}
              {finished && (
                <Banner tone={progress.errors.length ? 'warning' : 'success'} title={`${progress.done - progress.errors.length} av ${progress.total} enheter uppdaterade`}>
                  {progress.errors.length ? progress.errors.map((e) => `${e.serial}: ${e.msg}`).join(' · ') : 'Klart. Bara Inköpsdatum ändrades.'}
                </Banner>
              )}

              <DataTable
                columns={columns}
                rows={shown}
                density="compact"
                maxHeight="60vh"
                toolbar={<SegmentedButton value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[
                  { value: 'andras', label: `Ändras (${counts.andras})` },
                  { value: 'problem', label: `Problem (${counts.saknas + counts.ogiltigt})` },
                  { value: 'alla', label: `Alla (${rows.length})` },
                ]} />}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
