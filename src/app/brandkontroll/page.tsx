'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, Icon, IconButton, StatusBadge, type Status } from '@/ds';
import { FaultDialog, dueColor } from '@/components/brand';
import { CameraScanner } from '@/components/Scan';
import { PageState, useReady } from '@/components/PageState';
import { buildExtinguishers, byUrgency, checkOk, monthName, type ExtView } from '@/lib/brand';
import { relDate, shortDate } from '@/lib/format';
import { useStore } from '@/lib/store';

/** Mobile-first monthly check: one big "Allt fungerar" button per extinguisher. */
export default function Brandkontroll() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const all = React.useMemo(() => buildExtinguishers(store.data), [store.data]);
  // Not yet checked first (most urgent first), then the done ones.
  const list = React.useMemo(
    () => [...all].sort((a, b) => Number(!!a.checkedThisMonth) - Number(!!b.checkedThisMonth) || byUrgency(a, b)),
    [all],
  );
  const [fault, setFault] = React.useState<ExtView | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [cam, setCam] = React.useState(false);
  const [focus, setFocus] = React.useState<string | null>(null);
  const done = all.filter((e) => e.checkedThisMonth).length;

  const ok = async (e: ExtView) => {
    setBusy(e.id);
    try {
      await checkOk(store, e);
      store.toast({ icon: 'check_circle', message: `${e.nr} kontrollerad` });
    } catch (err) {
      store.toast({ icon: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const onScan = (text: string) => {
    setCam(false);
    const nr = text.trim().toUpperCase();
    const e = all.find((x) => x.nr.toUpperCase() === nr);
    if (!e) return store.toast({ icon: 'error', message: `Hittar ingen brandsläckare ${text}` });
    setFocus(e.id);
    setTimeout(() => document.getElementById(`ext-${e.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  if (!ready) return <PageState />;

  return (
    <div className="ext-check">
      <header className="rk-card stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <IconButton icon="arrow_back" label="Till Brandsläckare" onClick={() => router.push('/brandslackare')} />
          <span className="rk-kpi__icon rk-tone--red" style={{ width: 40, height: 40, borderRadius: 12 }}><Icon name="fire_extinguisher" fill /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Brandkontroll</div>
            <div className="small muted">{monthName().replace(/^./, (c) => c.toUpperCase())} · {store.userName}</div>
          </div>
          <IconButton icon="qr_code_scanner" variant="tonal" label="Skanna QR på släckaren" onClick={() => setCam(true)} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
          <span>{done} av {all.length} kontrollerade</span><span className="muted">{all.length - done} kvar</span>
        </div>
        <div className="hbar" role="progressbar" aria-valuenow={all.length ? Math.round((done / all.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
        </div>
        <div className="row small muted" style={{ gap: 8, alignItems: 'flex-start' }}>
          <Icon name="checklist" size={18} />
          Kontrollera: visaren i grönt · plomb och sprint hela · synlig och fri framför · skylt sitter uppe
        </div>
      </header>

      {!all.length && <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="fire_extinguisher" title="Inga brandsläckare" description="Lägg till dem under Brandsläckare först." /></div>}
      {done === all.length && all.length > 0 && (
        <div className="rk-card" style={{ padding: 0 }}><EmptyState compact icon="task_alt" tone="green" title={`Klart för ${monthName()}!`} description="Alla brandsläckare är kontrollerade." /></div>
      )}

      {list.map((e) => (
        <article key={e.id} id={`ext-${e.id}`} className="rk-card stack" style={{ padding: 16, gap: 12, outline: focus === e.id ? '3px solid var(--primary)' : undefined }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: 8 }}><span className="mono" style={{ fontWeight: 600 }}>{e.nr}</span><span className="small muted">{e.typ}</span></div>
              <div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, marginTop: 2 }}>{[e.plats, e.detalj].filter(Boolean).join(' · ')}</div>
            </div>
            <StatusBadge status={e.status as Status} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: e.status === 'OK' ? 'var(--ink-muted)' : dueColor(e) }}>Giltig till {shortDate(e.giltigTill)}</div>
          {e.checkedThisMonth ? (
            <div className="row" style={{ gap: 8, padding: '12px 14px', borderRadius: 12, background: e.checkedThisMonth.Resultat === 'Fel' ? 'var(--status-orange-container)' : 'var(--status-green-container)', color: e.checkedThisMonth.Resultat === 'Fel' ? 'var(--status-orange)' : 'var(--status-green)', fontWeight: 700 }}>
              <Icon name={e.checkedThisMonth.Resultat === 'Fel' ? 'report' : 'check_circle'} fill />
              {e.checkedThisMonth.Resultat === 'Fel' ? 'Fel registrerat' : 'Kontrollerad'} {relDate(e.checkedThisMonth.Datum || e.checkedThisMonth._created)}
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <Button icon="check_circle" className="ext-big" disabled={busy === e.id || store.readOnly} onClick={() => ok(e)}>Allt fungerar</Button>
              <Button variant="outlined" icon="report" className="ext-big ext-fault" disabled={store.readOnly} onClick={() => setFault(e)}>Fel eller byte</Button>
            </div>
          )}
        </article>
      ))}

      {fault && <FaultDialog ext={fault} onClose={() => setFault(null)} />}
      {cam && <CameraScanner onClose={() => setCam(false)} onResult={onScan} />}
    </div>
  );
}
