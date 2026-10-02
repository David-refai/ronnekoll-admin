'use client';

import * as React from 'react';
import QRCode from 'qrcode';
import { Banner, Button, Chip, Dialog, Icon, SideSheet, StatusBadge, TextField, type Status } from '@/ds';
import { Portal } from '@/components/Portal';
import { log } from '@/lib/actions';
import { leftText, markReplaced, orderReplacement, reportFault, type ExtView } from '@/lib/brand';
import { relDate, shortDate } from '@/lib/format';
import { EXT_REASONS, str } from '@/lib/lists';
import { useStore } from '@/lib/store';

const TYPES = ['Pulver 6 kg', 'Pulver 2 kg', 'Kolsyra 5 kg', 'Kolsyra 2 kg', 'Skum 6 l', 'Skum 9 l', 'Vatten 9 l', 'Brandfilt'];

const err = (store: ReturnType<typeof useStore>, e: unknown) => store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });

export const dueColor = (e: ExtView) =>
  e.status === 'Utgången' ? 'var(--status-red)' : e.status === 'Går ut snart' ? 'var(--status-amber)' : 'var(--ink)';

/* ---------- Fault ---------- */

export function FaultDialog({ ext, onClose }: { ext: ExtView; onClose(): void }) {
  const store = useStore();
  const [reason, setReason] = React.useState(EXT_REASONS[0]);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await reportFault(store, ext, reason, text);
      store.toast({ icon: 'report', message: `${ext.nr}: fel registrerat` });
      onClose();
    } catch (e) { err(store, e); setBusy(false); }
  };
  return (
    <Portal>
      <Dialog open onClose={onClose} tone="warning" icon="report" title={`Fel på ${ext.nr}`}
        actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button icon="report" disabled={busy || store.readOnly} onClick={run}>Registrera fel</Button></>}>
        <span className="small muted">{ext.plats}{ext.detalj ? ` · ${ext.detalj}` : ''} · {ext.typ}</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {EXT_REASONS.map((r) => <Chip key={r} label={r} selected={reason === r} onClick={() => setReason(r)} />)}
        </div>
        <TextField label="Beskrivning (valfritt)" multiline rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Visaren står strax under grönt…" />
        <span className="small muted">Brandsläckaren får status <b>Fel anmält</b> tills du markerar den som utbytt eller servad.</span>
      </Dialog>
    </Portal>
  );
}

/* ---------- Replace / service ---------- */

export function ReplaceDialog({ ext, onClose }: { ext: ExtView; onClose(): void }) {
  const store = useStore();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const [kind, setKind] = React.useState<'Utbytt' | 'Service'>('Utbytt');
  const [date, setDate] = React.useState(nextYear.toISOString().slice(0, 10));
  const [typ, setTyp] = React.useState(ext.typ || TYPES[0]);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await markReplaced(store, ext, { giltigTill: date, typ, kind, note });
      store.toast({ icon: 'published_with_changes', message: `${ext.nr} ${kind === 'Utbytt' ? 'utbytt' : 'servad'} — giltig till ${shortDate(date)}` });
      onClose();
    } catch (e) { err(store, e); setBusy(false); }
  };
  return (
    <Portal>
      <Dialog open onClose={onClose} icon="published_with_changes" title={`${ext.nr}: utbytt eller servad`}
        actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button icon="check" disabled={!date || busy || store.readOnly} onClick={run}>Spara</Button></>}>
        <div className="row" style={{ gap: 6 }}>
          <Chip label="Utbytt mot ny" selected={kind === 'Utbytt'} onClick={() => setKind('Utbytt')} />
          <Chip label="Service / kontroll av firma" selected={kind === 'Service'} onClick={() => setKind('Service')} />
        </div>
        <div className="form-grid">
          <TextField label="Ny giltig till" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div>
            <label className="field-label" htmlFor="rp-typ">Typ</label>
            <select id="rp-typ" className="select" value={typ} onChange={(e) => setTyp(e.target.value)}>{Array.from(new Set([typ, ...TYPES])).map((t) => <option key={t}>{t}</option>)}</select>
          </div>
        </div>
        <TextField label="Anteckning (valfritt)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ordernummer, serviceprotokoll…" />
        <span className="small muted">Status blir OK och senaste service sätts till i dag.</span>
      </Dialog>
    </Portal>
  );
}

export function OrderDialog({ ext, onClose }: { ext: ExtView; onClose(): void }) {
  const store = useStore();
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await orderReplacement(store, ext, note);
      store.toast({ icon: 'local_shipping', message: `Byte beställt för ${ext.nr}` });
      onClose();
    } catch (e) { err(store, e); setBusy(false); }
  };
  return (
    <Portal>
      <Dialog open onClose={onClose} icon="local_shipping" title={`Beställ byte av ${ext.nr}`}
        actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button icon="local_shipping" disabled={busy || store.readOnly} onClick={run}>Markera beställt</Button></>}>
        <TextField label="Anteckning" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nytt aggregat kommer v41, order 12345" />
      </Dialog>
    </Portal>
  );
}

/* ---------- Add / edit ---------- */

export function ExtForm({ ext, all, onClose }: { ext?: ExtView; all: ExtView[]; onClose(): void }) {
  const store = useStore();
  const nextNr = () => {
    const max = Math.max(0, ...all.map((e) => Number(e.nr.match(/(\d+)\s*$/)?.[1] ?? 0)));
    return `BS-${String(max + 1).padStart(2, '0')}`;
  };
  const [v, setV] = React.useState({
    nr: ext?.nr ?? nextNr(), plats: ext?.plats ?? '', detalj: ext?.detalj ?? '', typ: ext?.typ ?? TYPES[0],
    giltigTill: ext?.giltigTill ?? '', senasteService: ext?.senasteService ?? '', serviceforetag: ext?.serviceforetag ?? '', anteckningar: ext?.anteckningar ?? '',
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const dup = all.some((e) => e.id !== ext?.id && e.nr.toUpperCase() === v.nr.trim().toUpperCase());
  const places = Array.from(new Set(all.map((e) => e.plats).filter(Boolean))).sort();

  const save = async () => {
    setBusy(true);
    const values = {
      Title: v.nr.trim().toUpperCase(), Plats: v.plats.trim(), PlatsDetalj: v.detalj.trim(), Typ: v.typ, GiltigTill: v.giltigTill,
      SenasteService: v.senasteService, Serviceforetag: v.serviceforetag.trim(), Anteckningar: v.anteckningar,
    };
    try {
      if (ext) await store.update('brandslackare', ext.id, values);
      else await store.create('brandslackare', { ...values, Status: 'OK' });
      await log(store, { typ: 'Brandsläckare', enhetId: values.Title, detaljer: `${ext ? 'Ändrad' : 'Ny'}: ${values.Title} · ${values.Plats} ${values.PlatsDetalj} · giltig till ${values.GiltigTill || '—'}` });
      store.toast({ icon: 'check_circle', message: `${values.Title} sparad` });
      onClose();
    } catch (e) { err(store, e); setBusy(false); }
  };

  return (
    <SideSheet open onClose={onClose} overline={ext ? 'Redigera' : 'Ny brandsläckare'} title={ext ? ext.nr : 'Lägg till brandsläckare'}
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button icon="check" disabled={!v.nr.trim() || !v.plats.trim() || dup || busy || store.readOnly} onClick={save}>Spara</Button></>}>
      <div className="form-grid">
        <TextField label="Nummer" mono value={v.nr} onChange={set('nr')} error={dup ? 'Numret finns redan' : undefined} />
        <div>
          <label className="field-label" htmlFor="ex-typ">Typ</label>
          <select id="ex-typ" className="select" value={v.typ} onChange={set('typ')}>{Array.from(new Set([v.typ, ...TYPES])).map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <TextField label="Plats (byggnad/rum)" value={v.plats} onChange={set('plats')} list="ex-places" placeholder="A-huset plan 1" />
        <datalist id="ex-places">{places.map((p) => <option key={p} value={p} />)}</datalist>
        <TextField label="Exakt placering" value={v.detalj} onChange={set('detalj')} placeholder="Korridor vid A-104" />
        <TextField label="Giltig till" type="date" value={v.giltigTill} onChange={set('giltigTill')} />
        <TextField label="Senaste service" type="date" value={v.senasteService} onChange={set('senasteService')} />
        <TextField className="full" label="Serviceföretag" value={v.serviceforetag} onChange={set('serviceforetag')} />
        <TextField className="full" label="Anteckningar" multiline rows={3} value={v.anteckningar} onChange={set('anteckningar')} />
      </div>
    </SideSheet>
  );
}

/* ---------- Details ---------- */

const RESULT_ICON: Record<string, [string, string, string]> = {
  OK: ['check_circle', 'green', 'Månadskontroll: allt fungerar'],
  Fel: ['report', 'orange', 'Fel'],
  Service: ['build', 'blue', 'Service utförd'],
  Utbytt: ['published_with_changes', 'blue', 'Utbytt'],
  'Byte beställt': ['local_shipping', 'violet', 'Byte beställt'],
};

export function ExtSheet({ ext, onClose, onEdit, onDelete }: { ext: ExtView; onClose(): void; onEdit(): void; onDelete(): void }) {
  const store = useStore();
  const [dlg, setDlg] = React.useState<null | 'fault' | 'replace' | 'order'>(null);
  return (
    <SideSheet open onClose={onClose} overline={ext.nr} title={[ext.plats, ext.detalj].filter(Boolean).join(' · ') || ext.nr}
      subtitle={<div style={{ marginTop: 6 }}><StatusBadge status={ext.status as Status} size="lg" /></div>}
      actions={<>
        <Button variant="danger-text" icon="delete" disabled={store.readOnly} onClick={onDelete}>Ta bort</Button>
        <Button variant="text" icon="edit" disabled={store.readOnly} onClick={onEdit}>Redigera</Button>
        {ext.status !== 'Byte beställt' && <Button variant="tonal" icon="local_shipping" disabled={store.readOnly} onClick={() => setDlg('order')}>Beställ byte</Button>}
        <Button icon="published_with_changes" disabled={store.readOnly} onClick={() => setDlg('replace')}>Markera utbytt</Button>
      </>}>
      {ext.status === 'Utgången' && <Banner tone="error" title={`Gick ut ${shortDate(ext.giltigTill)}`}>Byt ut den eller låt serviceföretaget kontrollera den.</Banner>}
      {ext.status === 'Går ut snart' && <Banner tone="warning" title={`Går ut ${shortDate(ext.giltigTill)}`}>{leftText(ext)} — boka service eller byte.</Banner>}
      {ext.status === 'Fel anmält' && <Banner tone="warning" title="Fel registrerat">{str(ext.checks.find((c) => str(c.Resultat) === 'Fel')?.Felorsak) || 'Se historiken.'}</Banner>}
      <dl className="kv" style={{ margin: '16px 0' }}>
        <dt>Nummer</dt><dd className="mono">{ext.nr}</dd>
        <dt>Typ</dt><dd>{ext.typ || '—'}</dd>
        <dt>Giltig till</dt><dd style={{ color: dueColor(ext) }}>{shortDate(ext.giltigTill)} <span className="muted small">({leftText(ext)})</span></dd>
        <dt>Senaste service</dt><dd>{shortDate(ext.senasteService)}</dd>
        <dt>Serviceföretag</dt><dd>{ext.serviceforetag || '—'}</dd>
        <dt>Månadskontroll</dt><dd>{ext.checkedThisMonth ? `Gjord ${relDate(ext.checkedThisMonth.Datum || ext.checkedThisMonth._created)}` : <span style={{ color: 'var(--status-amber)' }}>Ej gjord i {new Date().toLocaleDateString('sv-SE', { month: 'long' })}</span>}</dd>
        {ext.anteckningar && <><dt>Anteckningar</dt><dd style={{ fontWeight: 400 }}>{ext.anteckningar}</dd></>}
      </dl>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <Button variant="outlined" size="sm" icon="report" disabled={store.readOnly} onClick={() => setDlg('fault')}>Registrera fel</Button>
      </div>
      <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>Historik</h3>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ext.checks.map((c) => {
          const [icon, tone, title] = RESULT_ICON[str(c.Resultat)] ?? ['history', 'gray', str(c.Resultat)];
          return (
            <li key={c._id} className="row" style={{ alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span className={`rk-kpi__icon rk-tone--${tone}`} style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}><Icon name={icon} size={18} fill /></span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{title}{c.Felorsak ? `: ${str(c.Felorsak)}` : ''}</div>
                {c.Beskrivning ? <div className="small">{str(c.Beskrivning)}</div> : null}
                <div className="small muted">{relDate(c.Datum || c._created)}{c.UtfordAv ? ` · ${str(c.UtfordAv)}` : ''}</div>
              </div>
            </li>
          );
        })}
        {!ext.checks.length && <li className="small muted">Inga kontroller registrerade ännu.</li>}
      </ol>
      {dlg === 'fault' && <FaultDialog ext={ext} onClose={() => setDlg(null)} />}
      {dlg === 'replace' && <ReplaceDialog ext={ext} onClose={() => setDlg(null)} />}
      {dlg === 'order' && <OrderDialog ext={ext} onClose={() => setDlg(null)} />}
    </SideSheet>
  );
}

/* ---------- QR labels ---------- */

export function ExtQrLabel({ ext }: { ext: ExtView }) {
  const [src, setSrc] = React.useState('');
  React.useEffect(() => {
    QRCode.toDataURL(ext.nr, { margin: 0, width: 256, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''));
  }, [ext.nr]);
  return (
    <div className="label" style={{ width: '70mm', height: '36mm' }}>
      {src && <img src={src} alt="" style={{ width: '28mm', height: '28mm', flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '2.4mm', fontWeight: 700, letterSpacing: '0.05em' }}>BRANDSLÄCKARE</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '7mm', lineHeight: 1.1 }}>{ext.nr}</div>
        <div style={{ fontSize: '2.6mm', lineHeight: 1.25 }}>{ext.plats}</div>
        <div style={{ fontSize: '2.4mm', lineHeight: 1.25 }}>{ext.detalj}</div>
        <div style={{ fontSize: '2mm', marginTop: '1mm' }}>Rönnenskolan – Malmö stad</div>
      </div>
    </div>
  );
}
