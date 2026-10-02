'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Banner, Button, Chip, DataTable, EmptyState, KpiCard, PageHeader, StatusBadge, type Column, type Status } from '@/ds';
import { ExtForm, ExtQrLabel, ExtSheet, dueColor } from '@/components/brand';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { ProvisionLists } from '@/components/ProvisionLists';
import { log } from '@/lib/actions';
import { buildExtinguishers, byUrgency, leftText, monthName, needsAction, type ExtView } from '@/lib/brand';
import { unique } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { relDate, shortDate } from '@/lib/format';
import { str } from '@/lib/lists';
import { useStore } from '@/lib/store';

type ERow = ExtView & { id: string };
const PER_SHEET = 24;

export default function Brandslackare() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const all = React.useMemo(() => buildExtinguishers(store.data).sort(byUrgency), [store.data]);
  const [onlyAction, setOnlyAction] = React.useState(false);
  const [notChecked, setNotChecked] = React.useState(false);
  const [plats, setPlats] = React.useState<string | null>(null);
  const [typ, setTyp] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState<ExtView | 'new' | null>(null);
  const [del, setDel] = React.useState<ExtView | null>(null);
  const [printing, setPrinting] = React.useState(false);
  // Same printer calibration as Etiketter (saved on this computer).
  const margins = React.useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('rk.labels') || '{}');
      return { top: typeof p.marginTop === 'number' ? p.marginTop : 4.5, left: typeof p.marginLeft === 'number' ? p.marginLeft : 0 };
    } catch {
      return { top: 4.5, left: 0 };
    }
  }, [printing]);

  const missingList = store.mode === 'live' && store.connection && !store.connection.lists.brandslackare;
  const rows = all.filter((e) => (!onlyAction || needsAction(e)) && (!notChecked || !e.checkedThisMonth) && (!plats || e.plats === plats) && (!typ || e.typ === typ));
  const open = openId ? all.find((e) => e.id === openId) : undefined;
  const c = (s: string) => all.filter((e) => e.status === s).length;
  const checked = all.filter((e) => e.checkedThisMonth).length;
  const urgent = all.filter((e) => e.status === 'Utgången' || e.status === 'Går ut snart' || e.status === 'Fel anmält');
  const month = monthName();

  const printQr = async () => {
    const style = document.createElement('style');
    style.id = 'rk-print-page';
    style.textContent = '@page { size: A4; margin: 0; }';
    document.getElementById('rk-print-page')?.remove();
    document.head.appendChild(style);
    setPrinting(true);
    await new Promise((r) => setTimeout(r, 300)); // let QR images render
    window.print();
    setPrinting(false);
  };

  const two = (a: React.ReactNode, b: React.ReactNode) => (
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}><span style={{ fontWeight: 600 }}>{a}</span><span className="rk-muted rk-small">{b}</span></span>
  );
  const cols: Column<ERow>[] = [
    { key: 'nr', label: 'Nummer', mono: true },
    { key: 'plats', label: 'Plats', render: (e) => two(e.plats || '—', e.detalj) },
    { key: 'typ', label: 'Typ', render: (e) => e.typ || '—' },
    { key: 'giltig', label: 'Giltig till', render: (e) => two(<span style={{ color: dueColor(e) }}>{shortDate(e.giltigTill)}</span>, leftText(e)) },
    { key: 'status', label: 'Status', render: (e) => <StatusBadge status={e.status as Status} /> },
    { key: 'kontroll', label: 'Senast kontrollerad', render: (e) => (e.lastCheck ? two(relDate(e.lastCheck.Datum || e.lastCheck._created), str(e.lastCheck.UtfordAv)) : <span className="rk-muted">Aldrig</span>) },
  ];

  const sheets: ExtView[][] = [];
  for (let i = 0; i < rows.length; i += PER_SHEET) sheets.push(rows.slice(i, i + PER_SHEET));

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Brandsläckare"
          description={`${all.length} brandsläckare på skolan. Gör månadskontrollen på mobilen och registrera fel eller byte direkt.`}
          actions={<>
            <Button variant="outlined" icon="qr_code_2" disabled={!rows.length} onClick={printQr}>Skriv ut QR-etiketter</Button>
            <Button variant="outlined" icon="download" disabled={!rows.length} onClick={() => exportXlsx('Brandslackare', [
              { label: 'Nummer', value: (e: ExtView) => e.nr }, { label: 'Plats', value: (e) => e.plats }, { label: 'Placering', value: (e) => e.detalj },
              { label: 'Typ', value: (e) => e.typ }, { label: 'Giltig till', value: (e) => e.giltigTill }, { label: 'Status', value: (e) => e.status },
              { label: 'Senaste service', value: (e) => e.senasteService }, { label: 'Kontrollerad i ' + month, value: (e) => (e.checkedThisMonth ? 'Ja' : 'Nej') },
            ], rows)}>Exportera</Button>
            <Button icon="add" disabled={store.readOnly || !!missingList} onClick={() => setEdit('new')}>Ny brandsläckare</Button>
          </>}
        />
      </div>

      {!ready ? <PageState /> : (
        <div className="stack no-print" style={{ gap: 20 }}>
          <ProvisionLists keys={['brandslackare', 'brandkontroller']} />
          {urgent.length > 0 && (
            <Banner tone={c('Utgången') ? 'error' : 'warning'} title={`${urgent.length} brandsläckare behöver åtgärd`}
              action={<Button variant="outlined" size="sm" onClick={() => setOnlyAction(true)}>Visa {urgent.length === 1 ? 'den' : `de ${urgent.length}`}</Button>}>
              {urgent.slice(0, 3).map((e) => `${e.nr} (${e.plats}) ${e.status === 'Fel anmält' ? 'fel anmält' : leftText(e)}`).join(' · ')}{urgent.length > 3 ? ' …' : ''}
            </Banner>
          )}
          <div className="grid-4">
            <KpiCard label="OK" value={c('OK')} icon="check_circle" tone="green" delta={`av ${all.length}`} onClick={() => setOnlyAction(false)} />
            <KpiCard label="Går ut inom 30 dagar" value={c('Går ut snart')} icon="schedule" tone="amber" onClick={() => setOnlyAction(true)} />
            <KpiCard label="Utgångna" value={c('Utgången')} icon="event_busy" tone="red" onClick={() => setOnlyAction(true)} />
            <KpiCard label="Fel anmält / byte beställt" value={c('Fel anmält') + c('Byte beställt')} icon="report" tone="orange" onClick={() => setOnlyAction(true)} />
          </div>

          <div className="ext-layout">
            <div className="stack" style={{ minWidth: 0 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Behöver åtgärd" count={all.filter(needsAction).length} selected={onlyAction} onClick={() => setOnlyAction(!onlyAction)} />
                <FilterMenu label="Plats" value={plats} onChange={setPlats} options={unique(all.map((e) => e.plats)).map((v) => ({ value: v, count: all.filter((e) => e.plats === v).length }))} />
                <FilterMenu label="Typ" value={typ} onChange={setTyp} options={unique(all.map((e) => e.typ)).map((v) => ({ value: v }))} />
                <Chip label={`Ej kontrollerad i ${month}`} count={all.length - checked} selected={notChecked} onClick={() => setNotChecked(!notChecked)} />
              </div>
              {rows.length ? (
                <DataTable<ERow> columns={cols} rows={rows} density="compact" onRowClick={(e) => setOpenId(e.id)}
                  footer={<><span>Sorterat på brådska · {rows.length} av {all.length}</span><span /></>} />
              ) : (
                <div className="rk-card" style={{ padding: 0 }}>
                  <EmptyState icon="fire_extinguisher" title={all.length ? 'Inget matchar filtret' : 'Inga brandsläckare ännu'}
                    description={all.length ? 'Ta bort ett filter.' : 'Lägg till skolans brandsläckare med nummer, plats och giltighetsdatum.'}
                    action={!all.length && !missingList ? <Button variant="tonal" icon="add" onClick={() => setEdit('new')}>Ny brandsläckare</Button> : undefined} />
                </div>
              )}
            </div>
            <aside className="stack" style={{ gap: 16 }}>
              <section className="rk-card stack" style={{ padding: 20, gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Månadskontroll {month}</div>
                <div className="row" style={{ gap: 6, alignItems: 'baseline' }}><span style={{ fontSize: 36, lineHeight: '40px', fontWeight: 700 }}>{checked}</span><span className="muted" style={{ fontWeight: 600 }}>av {all.length} kontrollerade</span></div>
                <div className="hbar" role="progressbar" aria-valuenow={all.length ? Math.round((checked / all.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
                  <div style={{ width: `${all.length ? (checked / all.length) * 100 : 0}%` }} />
                </div>
                {(() => {
                  const last = all.flatMap((e) => (e.checkedThisMonth ? [{ e, c: e.checkedThisMonth }] : [])).sort((a, b) => str(b.c.Datum).localeCompare(str(a.c.Datum)))[0];
                  return last ? <div className="small muted">Senast: {last.e.nr} {relDate(last.c.Datum || last.c._created)}</div> : null;
                })()}
                <Button icon="checklist" disabled={!all.length} onClick={() => router.push('/brandkontroll')}>Starta kontroll</Button>
              </section>
              <section className="rk-card stack" style={{ padding: 20, gap: 8 }}>
                <div className="row" style={{ gap: 8, fontWeight: 700 }}><span className="rk-icon" aria-hidden style={{ fontSize: 20 }}>notifications_active</span>Påminnelser</div>
                <span className="small">Visas i RönneKoll: på Översikt, under klockan och här — 30 dagar före utgång och när månadskontrollen inte är gjord.</span>
                <span className="small muted">E-post kräver ett Power Automate-flöde, eftersom RönneKoll bara körs när sidan är öppen.</span>
              </section>
            </aside>
          </div>
        </div>
      )}

      {open && !edit && !del && <ExtSheet ext={open} onClose={() => setOpenId(null)} onEdit={() => setEdit(open)} onDelete={() => setDel(open)} />}
      {edit && <ExtForm ext={edit === 'new' ? undefined : edit} all={all} onClose={() => setEdit(null)} />}
      {del && (
        <ConfirmDelete title={`Ta bort ${del.nr}?`} onClose={() => setDel(null)}
          onConfirm={async () => {
            await store.remove('brandslackare', del.id);
            await log(store, { typ: 'Borttagning', enhetId: del.nr, detaljer: `Brandsläckare borttagen: ${del.nr} (${del.plats})` });
            store.toast({ icon: 'delete', message: `${del.nr} borttagen` });
            setOpenId(null);
          }}>
          <span>{del.nr} på {del.plats} tas bort från listan. Kontrollhistoriken finns kvar i Brandkontroller.</span>
        </ConfirmDelete>
      )}

      {printing && (
        <div className="print-area" aria-hidden>
          {sheets.map((sheet, i) => (
            <div key={i} className="a4-page" style={{ padding: `${margins.top}mm 0 0 ${margins.left}mm` }}>
              {sheet.map((e) => <ExtQrLabel key={e.id} ext={e} />)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
