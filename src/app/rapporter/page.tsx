'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, DataTable, EmptyState, Icon, PageHeader, type Column } from '@/ds';
import { FilterMenu } from '@/components/FilterMenu';
import { PageState, useReady } from '@/components/PageState';
import { buildDevices, buildStudents, isOpenCase, serialKey, unique, type DeviceView, type StudentView } from '@/lib/derive';
import { exportXlsx } from '@/lib/export';
import { daysSince, shortDate, todayIso } from '@/lib/format';
import { str, yes, type Data } from '@/lib/lists';
import { useStore } from '@/lib/store';

type Cell = string | number;
interface Ctx { data: Data; devices: DeviceView[]; students: StudentView[] }
interface Report {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** Optional date used by the period filter */
  date?: (r: Record<string, Cell>) => string;
  klass?: boolean;
  cols: string[];
  rows(c: Ctx): Record<string, Cell>[];
}

const devRow = (d: DeviceView): Record<string, Cell> => ({
  AssetID: d.assetId, Serienummer: d.serial, Modell: d.modell, Status: d.status, Elev: d.holder?.namn ?? '', Klass: d.klass, Plats: d.plats,
});

const countBy = (items: string[]) => {
  const m = new Map<string, number>();
  items.forEach((k) => m.set(k || '—', (m.get(k || '—') ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const REPORTS: Report[] = [
  {
    id: 'utdelade', title: 'Utdelade enheter per klass', desc: 'Vem har vilken enhet, sorterat på klass.', icon: 'assignment_ind', klass: true,
    cols: ['Klass', 'Elev', 'AssetID', 'Serienummer', 'Modell', 'Sedan', 'Kontrakt'],
    rows: ({ devices }) => devices.filter((d) => d.holder?.kind === 'tilldelning').sort((a, b) => `${a.klass}${a.holder!.namn}`.localeCompare(`${b.klass}${b.holder!.namn}`, 'sv'))
      .map((d) => ({ Klass: d.klass, Elev: d.holder!.namn, AssetID: d.assetId, Serienummer: d.serial, Modell: d.modell, Sedan: str(d.holder!.since).slice(0, 10), Kontrakt: str(d.holder!.row.SignaturStatus) || (yes(d.holder!.row.ContractRequired) ? 'Väntar signatur' : '—') })),
  },
  {
    id: 'ej-aterlamnade', title: 'Ej återlämnade enheter', desc: 'Alla enheter som fortfarande är hos elever — använd vid läsårsslut.', icon: 'assignment_late', klass: true,
    cols: ['Klass', 'Elev', 'Skåp', 'AssetID', 'Serienummer', 'Typ', 'Sedan'],
    rows: ({ devices, students }) => devices.filter((d) => d.holder).map((d) => {
      const s = students.find((x) => x.elevId && x.elevId === d.holder!.elevId);
      return { Klass: d.klass || d.holder!.klass, Elev: d.holder!.namn, Skåp: s?.skap ?? '', AssetID: d.assetId, Serienummer: d.serial, Typ: d.holder!.kind === 'utlaning' ? 'Tillfälligt lån' : 'Tilldelad', Sedan: str(d.holder!.since).slice(0, 10) };
    }).sort((a, b) => `${a.Klass}${a.Elev}`.localeCompare(`${b.Klass}${b.Elev}`, 'sv')),
  },
  {
    id: 'lediga', title: 'Lediga enheter', desc: 'Tillgängliga enheter som kan delas ut, per modell.', icon: 'inventory_2',
    cols: ['AssetID', 'Serienummer', 'Modell', 'Kategori', 'Plats'],
    rows: ({ devices }) => devices.filter((d) => d.status === 'Tillgänglig' && !d.holder).map((d) => ({ AssetID: d.assetId, Serienummer: d.serial, Modell: d.modell, Kategori: d.kategori, Plats: d.plats })),
  },
  {
    id: 'trasiga', title: 'Trasiga och under reparation', desc: 'Enheter som inte går att använda just nu.', icon: 'build',
    cols: ['AssetID', 'Serienummer', 'Modell', 'Status', 'Elev', 'Klass', 'Plats'],
    rows: ({ devices }) => devices.filter((d) => d.status === 'Trasig' || d.status === 'Under reparation').map(devRow),
  },
  {
    id: 'utan-enhet', title: 'Elever utan enhet', desc: 'Elever som inte har någon tilldelad enhet.', icon: 'person_off', klass: true,
    cols: ['Klass', 'Elev', 'E-post', 'ElevID'],
    rows: ({ students }) => students.filter((s) => !s.device).sort((a, b) => `${a.klass}${a.namn}`.localeCompare(`${b.klass}${b.namn}`, 'sv'))
      .map((s) => ({ Klass: s.klass, Elev: s.namn, 'E-post': s.epost, ElevID: s.elevId })),
  },
  {
    id: 'kontrakt', title: 'Kontrakt saknas', desc: 'Tilldelningar där kontrakt krävs men inte är signerat.', icon: 'draw', klass: true,
    cols: ['Klass', 'Elev', 'Enhet', 'Tilldelad', 'Påminnelse skickad', 'Status'],
    rows: ({ data }) => data.tilldelningar.filter((t) => !yes(t['Återlämnad']) && yes(t.ContractRequired) && str(t.SignaturStatus) !== 'Signerad')
      .map((t) => ({ Klass: str(t.Klass), Elev: str(t.ElevNamn), Enhet: str(t.EnhetID), Tilldelad: str(t.Tilldelningsdatum).slice(0, 10), 'Påminnelse skickad': str(t['PåminnelseSkickad']).slice(0, 10), Status: str(t.SignaturStatus) || 'Väntar signatur' })),
  },
  {
    id: 'felanmalningar', title: 'Felanmälningar', desc: 'Per period, feltyp och modell.', icon: 'report', date: (r) => String(r.Datum),
    cols: ['Datum', 'Enhet', 'Modell', 'Typ', 'Beskrivning', 'Prioritet', 'Status', 'Åtgärd'],
    rows: ({ data, devices }) => data.felanmalningar.map((f) => ({
      Datum: f._created.slice(0, 10), Enhet: str(f.EnhetID), Modell: devices.find((d) => serialKey(d.serial) === serialKey(f.EnhetID))?.modell ?? '',
      Typ: str(f.TypAvFel), Beskrivning: str(f.Beskrivning), Prioritet: str(f.Prioritet), Status: str(f.Status), Åtgärd: str(f['Åtgärd']),
    })).sort((a, b) => b.Datum.localeCompare(a.Datum)),
  },
  {
    id: 'lan', title: 'Tillfälliga lån', desc: 'Alla tillfälliga lån under perioden — per klass, inte för att peka ut elever.', icon: 'schedule', klass: true, date: (r) => String(r.Utlånad),
    cols: ['Utlånad', 'Återlämnad', 'Elev', 'Klass', 'Enhet', 'Status'],
    rows: ({ data }) => data.utlaningar.map((l) => ({
      Utlånad: str(l['Utlåningsdatum'] || l._created).slice(0, 10), Återlämnad: str(l['Återlämningsdatum']).slice(0, 10), Elev: str(l.ElevNamn), Klass: str(l.Klass), Enhet: str(l.EnhetID), Status: str(l.Status),
    })).sort((a, b) => b.Utlånad.localeCompare(a.Utlånad)),
  },
  {
    id: 'skador', title: 'Återlämningar med skador', desc: 'Återlämnade enheter med skärmskada, andra skador eller saknad laddare.', icon: 'heart_broken', klass: true, date: (r) => String(r.Datum),
    cols: ['Datum', 'Elev', 'Klass', 'Enhet', 'Laddare', 'Skärm skadad', 'Andra skador', 'Beskrivning'],
    rows: ({ data }) => data.aterlamningar.filter((r) => yes(r.SkarmSkadad) || yes(r.AndraSkador) || str(r.LaddareMed).toLowerCase() === 'nej' || r.LaddareMed === false)
      .map((r) => ({ Datum: str(r['Återlämningsdatum'] || r._created).slice(0, 10), Elev: str(r.ElevNamn), Klass: str(r.Klass), Enhet: str(r.EnhetID), Laddare: yes(r.LaddareMed) ? 'Ja' : 'Nej', 'Skärm skadad': yes(r.SkarmSkadad) ? 'Ja' : 'Nej', 'Andra skador': yes(r.AndraSkador) ? 'Ja' : 'Nej', Beskrivning: str(r.Skadebeskrivning) })),
  },
  {
    id: 'modeller', title: 'Enheter per modell och status', desc: 'Antal per modell uppdelat på status och inköpsår.', icon: 'devices',
    cols: ['Modell', 'Inköpsår', 'Totalt', 'Tilldelade', 'Lediga', 'Trasiga', 'Reparation', 'Kasserade'],
    rows: ({ devices }) => unique(devices.map((d) => d.modell || '—')).map((m) => {
      const list = devices.filter((d) => (d.modell || '—') === m);
      const c = (s: string) => list.filter((d) => d.status === s).length;
      return { Modell: m, Inköpsår: unique(list.map((d) => d.inkop.slice(0, 4))).join(', '), Totalt: list.length, Tilldelade: c('Tilldelad'), Lediga: c('Tillgänglig'), Trasiga: c('Trasig'), Reparation: c('Under reparation'), Kasserade: c('Kasserad') };
    }).sort((a, b) => b.Totalt - a.Totalt),
  },
  {
    id: 'skolarenden', title: 'Skolärenden', desc: 'Vaktmästarärenden per typ och status.', icon: 'handyman', date: (r) => String(r.Anmält),
    cols: ['Anmält', 'Typ', 'Plats', 'Beskrivning', 'Anmält av', 'Status', 'Slutfört', 'Dagar'],
    rows: ({ data }) => data.skolarenden.map((r) => {
      const start = str(r.Starttid) || r._created;
      return { Anmält: start.slice(0, 10), Typ: str(r.TypAvFel), Plats: [str(r.Plats), str(r.Annat)].filter(Boolean).join(' · '), Beskrivning: str(r.Beskrivning), 'Anmält av': str(r.Namn), Status: str(r.Status), Slutfört: str(r['Slutförandetid']).slice(0, 10), Dagar: isOpenCase(r.Status) ? daysSince(start) : r['Slutförandetid'] ? Math.max(0, Math.round((new Date(str(r['Slutförandetid'])).getTime() - new Date(start).getTime()) / 86400000)) : '' };
    }).sort((a, b) => b.Anmält.localeCompare(a.Anmält)),
  },
  {
    id: 'aktivitet', title: 'Aktivitet per användare', desc: 'Antal loggade händelser per användare och typ.', icon: 'monitoring', date: undefined,
    cols: ['Användare', 'Typ', 'Antal'],
    rows: ({ data }) => countBy(data.aktivitetslogg.map((l) => `${str(l['Användare'])}|${str(l.Typ)}`)).map(([k, n]) => ({ Användare: k.split('|')[0], Typ: k.split('|')[1] ?? '', Antal: n })),
  },
];

function RapporterInner() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('r');
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const students = React.useMemo(() => buildStudents(store.data, devices), [store.data, devices]);
  const ctx: Ctx = { data: store.data, devices, students };

  const report = REPORTS.find((r) => r.id === id);
  if (!ready) return <><PageHeader title="Rapporter" /><PageState /></>;
  if (report) return <ReportView report={report} ctx={ctx} onBack={() => router.push('/rapporter')} />;

  return (
    <>
      <PageHeader title="Rapporter" description="Välj en rapport, filtrera och exportera till Excel eller skriv ut." />
      <div className="grid-4">
        {REPORTS.map((r) => (
          <Card key={r.id} interactive onClick={() => router.push(`/rapporter?r=${r.id}`)} className="stack" style={{ gap: 10 }}>
            <span className="rk-kpi__icon rk-tone--primary"><Icon name={r.icon} size={22} fill /></span>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.title}</div>
            <div className="small muted">{r.desc}</div>
            <div className="small" style={{ fontWeight: 700 }}>{r.rows(ctx).length} rader</div>
          </Card>
        ))}
      </div>
    </>
  );
}

function ReportView({ report, ctx, onBack }: { report: Report; ctx: Ctx; onBack(): void }) {
  const all = React.useMemo(() => report.rows(ctx), [report, ctx]);
  const [klass, setKlass] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const rows = all.filter((r) => {
    if (klass && String(r.Klass) !== klass) return false;
    if (report.date) {
      const d = report.date(r);
      if (from && d < from) return false;
      if (to && d > to) return false;
    }
    return true;
  });
  const columns: Column<Record<string, Cell> & { id: number }>[] = report.cols.map((c) => ({ key: c, label: c, mono: /Serienummer|AssetID|Enhet$|ElevID/.test(c), render: (r) => String(r[c] ?? '') || '—' }));
  const withIds = rows.map((r, i) => ({ ...r, id: i }));

  return (
    <>
      <div className="no-print">
        <PageHeader overline="Rapport" title={report.title} description={report.desc}
          actions={<>
            <Button variant="text" icon="arrow_back" onClick={onBack}>Alla rapporter</Button>
            <Button variant="outlined" icon="print" onClick={() => window.print()}>Skriv ut</Button>
            <Button icon="download" onClick={() => exportXlsx(report.title.replace(/\s+/g, '_'), report.cols.map((c) => ({ label: c, value: (r: Record<string, Cell>) => r[c] })), rows)}>Exportera Excel</Button>
          </>} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {report.klass && <FilterMenu label="Klass" value={klass} onChange={setKlass} options={unique(all.map((r) => String(r.Klass ?? ''))).map((v) => ({ value: v, count: all.filter((r) => String(r.Klass) === v).length }))} />}
          {report.date && (
            <>
              <label className="row small" style={{ gap: 6 }}>Från <input type="date" className="select" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="row small" style={{ gap: 6 }}>Till <input type="date" className="select" style={{ width: 160 }} value={to} max={todayIso()} onChange={(e) => setTo(e.target.value)} /></label>
            </>
          )}
          <span className="small muted">{rows.length} rader · {shortDate(new Date().toISOString())}</span>
        </div>
      </div>
      <h1 className="print-only">{report.title} — {rows.length} rader · {shortDate(new Date().toISOString())}{klass ? ` · ${klass}` : ''}</h1>
      {rows.length ? <DataTable columns={columns} rows={withIds} density="compact" /> : <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="inbox" title="Inga rader" description="Inget matchar filtret." /></div>}
    </>
  );
}

export default function RapporterPage() {
  return (
    <React.Suspense fallback={null}>
      <RapporterInner />
    </React.Suspense>
  );
}

