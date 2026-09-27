'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AttentionCard, Button, Donut, KpiCard, PageHeader, Timeline, type TimelineEvent } from '@/ds';

type Tone = 'green' | 'blue' | 'violet' | 'amber' | 'orange' | 'red' | 'gray' | 'crimson';
import { PageState, useReady } from '@/components/PageState';
import { useStore } from '@/lib/store';
import { buildDevices, overview, unique } from '@/lib/derive';
import { relDate } from '@/lib/format';
import { str } from '@/lib/lists';

const WEEKDAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

function week(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

function greeting(d: Date) {
  const h = d.getHours();
  return h < 10 ? 'God morgon' : h < 17 ? 'Hej' : 'God kväll';
}

const LOG_TYPE: Record<string, TimelineEvent['type']> = {
  tilldelning: 'tilldelning',
  återlämning: 'aterlamning',
  utlåning: 'utlaning',
  statusändring: 'status',
  byte: 'status',
  felanmälan: 'felanmalan',
  inventering: 'inventering',
  import: 'import',
  'ny enhet': 'import',
  kontrakt: 'kontrakt',
  etikett: 'etikett',
};

export default function Oversikt() {
  const store = useStore();
  const router = useRouter();
  const ready = useReady();
  const now = new Date();

  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const o = React.useMemo(() => overview(store.data, devices), [store.data, devices]);

  const events: TimelineEvent[] = React.useMemo(
    () =>
      [...store.data.aktivitetslogg]
        .sort((a, b) => str(b.Tidpunkt || b._created).localeCompare(str(a.Tidpunkt || a._created)))
        .slice(0, 8)
        .map((l) => ({
          type: LOG_TYPE[str(l.Typ).toLowerCase()] ?? 'status',
          title: [str(l.EnhetID), str(l.Detaljer)].filter(Boolean).join(' · '),
          time: relDate(l.Tidpunkt || l._created),
          user: str(l['Användare']) || undefined,
        })),
    [store.data.aktivitetslogg],
  );

  const classes = React.useMemo(() => {
    const ks = unique(devices.map((d) => d.klass).filter((k) => /^\d[A-Z]$/i.test(k)));
    const rows = ks.map((k) => {
      const t = devices.filter((d) => d.klass === k && d.holder?.kind === 'tilldelning').length;
      const l = devices.filter((d) => d.klass === k && d.status === 'Tillgänglig').length;
      return { k, t, l };
    });
    const max = Math.max(1, ...rows.map((r) => r.t + r.l));
    return { rows, max };
  }, [devices]);

  const weeks = React.useMemo(() => {
    const out: { label: string; v: number }[] = [];
    for (let i = 8; i >= 0; i--) {
      const start = new Date(now.getTime() - (i * 7 + ((now.getDay() + 6) % 7)) * 86400000);
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + 7 * 86400000;
      const v = store.data.felanmalningar.filter((f) => {
        const t = new Date(f._created).getTime();
        return t >= start.getTime() && t < end;
      }).length;
      out.push({ label: 'v' + week(start), v });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.data.felanmalningar]);

  const models = React.useMemo(() => {
    const m = new Map<string, { n: number; year: string }>();
    for (const d of devices) {
      const cur = m.get(d.modell) ?? { n: 0, year: d.inkop.slice(0, 4) };
      cur.n++;
      m.set(d.modell, cur);
    }
    const arr = [...m.entries()].map(([name, v]) => ({ name: name || 'Okänd modell', ...v })).sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...arr.map((a) => a.n));
    return { arr, max };
  }, [devices]);

  const go = (href: string) => () => router.push(href);

  if (!ready) {
    return (
      <>
        <PageHeader title="Översikt" description="Hämtar data…" />
        <PageState />
      </>
    );
  }

  const maxW = Math.max(1, ...weeks.map((w) => w.v));
  const pts = weeks.map((w, i) => ({ x: 56 + i * 60, y: 170 - (w.v / maxW) * 120, ...w }));
  const oldest = [...o.overdue].sort((a, b) => str(a['Utlåningsdatum']).localeCompare(str(b['Utlåningsdatum'])))[0];

  return (
    <>
      <PageHeader
        overline={`${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} · vecka ${week(now)}`}
        title={`${greeting(now)}, ${store.userName.split(' ')[0]}`}
        description={`${o.total} enheter i drift. ${o.openFaults.length} öppna felanmälningar och ${o.overdue.length} tillfälliga lån som inte kommit tillbaka.`}
        actions={
          <>
            <Button variant="outlined" icon="report" onClick={go('/felanmalningar')}>Ny felanmälan</Button>
            <Button icon="barcode_scanner" onClick={() => document.querySelector<HTMLInputElement>('.rk-search__input')?.focus()}>Skanna</Button>
          </>
        }
      />

      <div className="grid-4">
        <KpiCard label="Totalt antal enheter" value={o.total} icon="laptop_chromebook" onClick={go('/enheter')} />
        <KpiCard label="Tilldelade" value={o.tilldelade} icon="person" tone="blue" delta={o.total ? `${Math.round((o.tilldelade / o.total) * 100)} %` : undefined} onClick={go('/enheter?status=Tilldelad')} />
        <KpiCard label="Tillgängliga (lediga)" value={o.tillgangliga} icon="check_circle" tone="green" onClick={go('/enheter?status=Tillg%C3%A4nglig')} />
        <KpiCard label="Utlånade idag" value={o.utlanade} icon="schedule" tone="violet" delta={o.overdue.length ? `${o.overdue.length} försenade` : undefined} deltaTone="red" onClick={go('/utlaning')} />
        <KpiCard label="Trasiga" value={o.trasiga} icon="broken_image" tone="red" onClick={go('/enheter?status=Trasig')} />
        <KpiCard label="Under reparation" value={o.reparation} icon="build" tone="amber" onClick={go('/enheter?status=Under%20reparation')} />
        <KpiCard label="Öppna felanmälningar" value={o.openFaults.length} icon="report" tone="orange" delta={o.oldFaults.length ? `${o.oldFaults.length} äldre än 7 d` : undefined} deltaTone="amber" onClick={go('/felanmalningar')} />
        <KpiCard label="Öppna skolärenden" value={o.openIssues.length} icon="handyman" tone="gray" onClick={go('/skolarenden')} />
      </div>

      <div className="grid-7-5">
        <section className="stack">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="section-title">Att åtgärda</h2>
            <span className="small muted">Varje kort öppnar en filtrerad lista</span>
          </div>
          {o.overdue.length > 0 && (
            <AttentionCard count={o.overdue.length} tone="red" title="Tillfälliga lån ej återlämnade"
              description={oldest ? `Äldst: ${str(oldest.ElevNamn)}, ${str(oldest.Klass)} — utlånad ${relDate(oldest['Utlåningsdatum'], false)}` : undefined}
              onClick={go('/utlaning')} />
          )}
          {o.saknas > 0 && (
            <AttentionCard count={o.saknas} tone="red" title="Enheter som saknas" description="Markerade som Saknas efter inventering" onClick={go('/enheter?status=Saknas')} />
          )}
          {o.oldFaults.length > 0 && (
            <AttentionCard count={o.oldFaults.length} tone="amber" title="Felanmälningar äldre än 7 dagar" onClick={go('/felanmalningar')} />
          )}
          {o.pwWaiting.length > 0 && (
            <AttentionCard count={o.pwWaiting.length} tone="amber" title="Lösenordsbegäran väntar"
              description={`Begärda av ${unique(o.pwWaiting.map((p) => str(p.BegardAv))).slice(0, 2).join(' och ') || '—'}`}
              onClick={go('/losenord')} />
          )}
          {o.studentsWithout.length > 0 && (
            <AttentionCard count={o.studentsWithout.length} tone="blue" title="Elever utan enhet" onClick={go('/elever?utan=1')} />
          )}
          {o.mismatch.length > 0 && (
            <AttentionCard count={o.mismatch.length} tone="blue" title="Status och tilldelning stämmer inte" description="Se Datakvalitet" onClick={go('/datakvalitet')} />
          )}
          {o.overdue.length + o.saknas + o.oldFaults.length + o.pwWaiting.length + o.studentsWithout.length + o.mismatch.length === 0 && (
            <div className="rk-card small muted">Inget att åtgärda just nu.</div>
          )}
        </section>
        <section className="rk-card stack" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title">Senaste aktivitet</h2>
            <Button variant="text" size="sm" trailingIcon="arrow_forward" onClick={go('/logg')}>Aktivitetslogg</Button>
          </div>
          {events.length ? <Timeline events={events} /> : <span className="small muted">Ingen aktivitet loggad ännu.</span>}
        </section>
      </div>

      <div className="grid-2">
        <section className="rk-card stack" style={{ gap: 16 }}>
          <div>
            <div className="rk-chartcard__title">Statusfördelning</div>
            <div className="small muted">{o.total} enheter · uppdaterad {store.loadedAt ? relDate(store.loadedAt.toISOString()) : '—'}</div>
          </div>
          <Donut
            size={168}
            data={([
              { label: 'Tilldelad', value: o.tilldelade, tone: 'blue' },
              { label: 'Tillgänglig', value: o.tillgangliga, tone: 'green' },
              { label: 'Trasig', value: o.trasiga, tone: 'red' },
              { label: 'Under reparation', value: o.reparation, tone: 'amber' },
              { label: 'Utlånad – tillfälligt', value: o.utlanade, tone: 'violet' },
              { label: 'Kasserad', value: o.kasserade, tone: 'gray' },
              { label: 'Saknas', value: o.saknas, tone: 'crimson' },
            ] as { label: string; value: number; tone: Tone }[]).filter((x) => x.value > 0)}
          />
        </section>

        <section className="rk-card stack" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="rk-chartcard__title">Enheter per klass</div>
              <div className="small muted">Tilldelade och lediga som tillhör klassen</div>
            </div>
            <div className="row small muted" style={{ gap: 16, fontWeight: 600 }}>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--status-blue)' }} />Tilldelade</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--status-green)' }} />Lediga</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {classes.rows.map((c) => (
              <button key={c.k} type="button" className="bar-row" style={{ border: 0, background: 'none', padding: 0, color: 'inherit', cursor: 'pointer', font: 'inherit' }} onClick={go(`/enheter?klass=${c.k}`)}>
                <span style={{ fontWeight: 700, textAlign: 'left' }}>{c.k}</span>
                <span className="bar-track">
                  <span style={{ height: 16, borderRadius: '4px 0 0 4px', background: 'var(--status-blue)', width: `${(c.t / classes.max) * 100}%` }} />
                  <span style={{ height: 16, borderRadius: '0 4px 4px 0', background: 'var(--status-green)', width: `${(c.l / classes.max) * 100}%` }} />
                </span>
                <span className="muted" style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{c.t} + {c.l}</span>
              </button>
            ))}
            {classes.rows.length === 0 && <span className="small muted">Inga enheter kopplade till klasser.</span>}
          </div>
        </section>

        <section className="rk-card stack" style={{ gap: 16 }}>
          <div>
            <div className="rk-chartcard__title">Felanmälningar per vecka</div>
            <div className="small muted">Senaste 9 veckorna · {weeks.reduce((s, w) => s + w.v, 0)} totalt</div>
          </div>
          <svg viewBox="0 0 580 200" width="100%" height="200" role="img" aria-label="Felanmälningar per vecka">
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1="32" y1={170 - f * 120} x2="572" y2={170 - f * 120} stroke="var(--line)" strokeWidth="1" />
                <text x="24" y={174 - f * 120} textAnchor="end" fontSize="11" fill="var(--ink-muted)">{Math.round(maxW * f)}</text>
              </g>
            ))}
            <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p) => (
              <g key={p.label}>
                <circle cx={p.x} cy={p.y} r="4" fill="var(--surface-raised)" stroke="var(--primary)" strokeWidth="2">
                  <title>{`${p.label}: ${p.v}`}</title>
                </circle>
                <text x={p.x} y="192" textAnchor="middle" fontSize="11" fill="var(--ink-muted)">{p.label}</text>
              </g>
            ))}
          </svg>
        </section>

        <section className="rk-card stack" style={{ gap: 16 }}>
          <div>
            <div className="rk-chartcard__title">Enheter per modell och ålder</div>
            <div className="small muted">Inköpsår inom parentes</div>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            {models.arr.slice(0, 6).map((m) => (
              <div key={m.name} className="stack" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{m.name} {m.year && <span className="muted" style={{ fontWeight: 500 }}>({m.year})</span>}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{m.n}</span>
                </div>
                <div className="hbar"><div style={{ width: `${(m.n / models.max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
