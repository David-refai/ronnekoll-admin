'use client';

import * as React from 'react';
import { Badge, Banner, Button, Dialog, Icon, TextField } from '@/ds';
import { Portal } from '@/components/Portal';
import { log } from '@/lib/actions';
import type { ExtView } from '@/lib/brand';
import { exportXlsx } from '@/lib/export';
import { useStore } from '@/lib/store';

/** Column in the list ← header names accepted in the file (case and å/ä/ö insensitive). */
const COLS: { key: string; label: string; names: string[] }[] = [
  { key: 'Title', label: 'Title', names: ['nummer', 'nr', 'title', 'objektsnummer', 'utrustningsnummer'] },
  { key: 'Plats', label: 'Plats', names: ['plats', 'rum'] },
  { key: 'PlatsDetalj', label: 'PlatsDetalj', names: ['platsdetalj', 'placering', 'detalj'] },
  { key: 'Typ', label: 'Typ', names: ['typ'] },
  { key: 'GiltigTill', label: 'GiltigTill', names: ['giltigtill', 'giltig till', 'nasta service', 'utgar'] },
  { key: 'SenasteService', label: 'SenasteService', names: ['senasteservice', 'senaste service', 'underhall utfort'] },
  { key: 'Serviceforetag', label: 'Serviceforetag', names: ['serviceforetag', 'service'] },
  { key: 'Status', label: 'Status', names: ['status'] },
  { key: 'Anteckningar', label: 'Anteckningar', names: ['anteckningar', 'anteckning', 'kommentar'] },
];
const DATE_KEYS = ['GiltigTill', 'SenasteService'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();
const nrKey = (s: string) => s.trim().toUpperCase().replace(/\s*\/\s*/g, '-').replace(/\s+/g, '');

function cell(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** 2027-08-31, 2027-08, 31/8/2027 or 2027 → ISO date (end of period when only month/year). */
function toDate(v: string): string {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
    return `${m[1]}-${m[2].padStart(2, '0')}-${last}`;
  }
  if (/^\d{4}$/.test(s)) return `${s}-12-31`;
  return s;
}

function parseText(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : ',';
  return lines.map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
}

type Rec = Record<string, string>;

export function ExtImport({ all, onClose }: { all: ExtView[]; onClose(): void }) {
  const store = useStore();
  const [paste, setPaste] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [table, setTable] = React.useState<string[][]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ created: number; updated: number; errors: string[] } | null>(null);

  const existing = React.useMemo(() => new Map(all.map((e) => [nrKey(e.nr), e])), [all]);

  const recs: Rec[] = React.useMemo(() => {
    if (table.length < 2) return [];
    const idx = new Map<string, number>();
    table[0].forEach((h, i) => {
      const n = norm(h);
      const c = COLS.find((c) => c.names.includes(n) || norm(c.key) === n);
      if (c && !idx.has(c.key)) idx.set(c.key, i);
    });
    if (!idx.has('Title')) return [];
    return table.slice(1).map((r) => {
      const rec: Rec = {};
      idx.forEach((i, k) => {
        const v = cell(r[i]);
        if (v) rec[k] = DATE_KEYS.includes(k) ? toDate(v) : k === 'Title' ? nrKey(v) : v;
      });
      return rec;
    }).filter((r) => r.Title);
  }, [table]);

  const onFile = async (f: File) => {
    setError(null);
    setFileName(f.name);
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        const rows = (await readSheet(f)) as unknown[][];
        setTable(rows.map((r) => r.map(cell)).filter((r) => r.some(Boolean)));
      } else setTable(parseText(await f.text()));
    } catch (e) {
      setError(`Kunde inte läsa filen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const headerOk = table.length > 0 && recs.length > 0;
  const fresh = recs.filter((r) => !existing.has(r.Title));
  const known = recs.filter((r) => existing.has(r.Title));

  const run = async () => {
    setBusy(true);
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    for (const r of recs) {
      try {
        const ex = existing.get(r.Title);
        if (ex) {
          const { Title: _t, ...patch } = r;
          await store.update('brandslackare', ex.id, patch);
          updated++;
        } else {
          await store.create('brandslackare', { Status: 'OK', ...r });
          created++;
        }
      } catch (e) {
        errors.push(`${r.Title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await log(store, { typ: 'Import', detaljer: `Brandsläckare: ${created} nya, ${updated} uppdaterade${errors.length ? `, ${errors.length} fel` : ''}${fileName ? ` · ${fileName}` : ''}` });
    setDone({ created, updated, errors });
    setBusy(false);
  };

  const template = () => exportXlsx('Brandslackare-mall', COLS.map((c) => ({ label: c.label, value: (r: Rec) => r[c.key] ?? '' })), [
    { Title: '1509-160', Plats: 'Rum 213', PlatsDetalj: 'Personaltoalett', Typ: 'Pulver 6 kg', GiltigTill: '2036-08-31', SenasteService: '2026-08-01', Serviceforetag: 'Malmö stad', Status: 'OK', Anteckningar: 'Tillverkad 2026 · omladdning 2036' },
  ]);

  return (
    <Portal>
      <Dialog open onClose={onClose} icon="upload_file" title="Importera brandsläckare"
        actions={done ? <Button onClick={onClose}>Klar</Button> : <>
          <Button variant="text" onClick={onClose}>Avbryt</Button>
          <Button icon="upload" disabled={!headerOk || busy || store.readOnly} onClick={run}>{busy ? 'Importerar…' : `Importera ${recs.length}`}</Button>
        </>}>
        {done ? (
          <div className="stack">
            <Banner tone={done.errors.length ? 'warning' : 'success'} title={`${done.created} nya, ${done.updated} uppdaterade`}>
              {done.errors.length ? done.errors.join(' · ') : 'Allt sparades i SharePoint.'}
            </Banner>
          </div>
        ) : (
          <div className="stack">
            <label className="rk-card" style={{ border: '2px dashed var(--outline)', boxShadow: 'none', textAlign: 'center', cursor: 'pointer', padding: 24 }}>
              <input type="file" accept=".xlsx,.csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              <Icon name="upload_file" size={32} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>{fileName || 'Välj en Excel-fil (.xlsx)'}</div>
              <div className="small muted">Första raden: samma kolumner som listan — Title, Plats, PlatsDetalj, Typ, GiltigTill, SenasteService, Serviceforetag, Status, Anteckningar</div>
            </label>
            <TextField label="…eller klistra in celler från Excel" multiline rows={4} mono value={paste}
              onChange={(e) => { setPaste(e.target.value); setFileName(''); setTable(parseText(e.target.value)); }} />
            {error && <Banner tone="error" title="Fel i filen">{error}</Banner>}
            {table.length > 0 && !headerOk && <Banner tone="warning" title="Hittar ingen kolumn Title">Första raden måste vara rubriker och en av dem heta Title (eller Nummer).</Banner>}
            {headerOk && (
              <div className="rk-card" style={{ boxShadow: 'none', background: 'var(--surface-container-low)', padding: 12, maxHeight: 240, overflow: 'auto' }}>
                <div className="row small" style={{ gap: 8, marginBottom: 8 }}>
                  <Badge tone="green">{fresh.length} nya</Badge>
                  {known.length > 0 && <Badge tone="amber">{known.length} finns redan — uppdateras</Badge>}
                </div>
                {recs.map((r) => (
                  <div key={r.Title} className="row small" style={{ gap: 8, padding: '4px 0', borderTop: '1px solid var(--outline-variant)' }}>
                    <b className="mono" style={{ minWidth: 76 }}>{r.Title}</b>
                    <span style={{ flex: 1 }}>{[r.Plats, r.PlatsDetalj].filter(Boolean).join(' · ')}</span>
                    <span className="muted">{r.Typ}</span>
                    <span className="muted mono">{r.GiltigTill}</span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="rk-btn rk-btn--text rk-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={template}>
              <span className="rk-icon" aria-hidden>download</span><span>Ladda ner mall</span>
            </button>
          </div>
        )}
      </Dialog>
    </Portal>
  );
}
