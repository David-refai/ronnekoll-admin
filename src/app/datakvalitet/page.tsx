'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from '@/ds';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { buildDevices, indexStudents, serialKey, type DeviceView } from '@/lib/derive';
import { daysSince } from '@/lib/format';
import { storedDeviceStatus, str, yes, type Data, type Row } from '@/lib/lists';
import { useStore } from '@/lib/store';

interface Item { key: string; label: string; sub?: string; href?: string; fix?: () => Promise<void> }
interface Check {
  id: string;
  title: string;
  desc: string;
  tone: 'red' | 'amber' | 'blue';
  items: Item[];
  fixLabel?: string;
}

type Store = ReturnType<typeof useStore>;

function buildChecks(data: Data, devices: DeviceView[], store: Store): Check[] {
  const students = indexStudents(data);
  const activeTil = data.tilldelningar.filter((t) => !yes(t['Återlämnad']));
  const devHref = (s: unknown) => `/enheter?open=${encodeURIComponent(str(s))}`;
  const elevOf = (t: Row) => students.get(str(t.ElevID).toLowerCase());

  const dupes = (rows: Row[], key: (r: Row) => string) => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => { const k = key(r); if (k) m.set(k, [...(m.get(k) ?? []), r]); });
    return [...m.entries()].filter(([, v]) => v.length > 1);
  };

  const perSerial = new Map<string, Row[]>();
  activeTil.forEach((t) => { const k = serialKey(t.EnhetID); if (k) perSerial.set(k, [...(perSerial.get(k) ?? []), t]); });

  const perStudent = new Map<string, Row[]>();
  activeTil.forEach((t) => { const k = str(t.ElevID).toLowerCase(); if (k) perStudent.set(k, [...(perStudent.get(k) ?? []), t]); });

  return [
    {
      id: 'til-utan-elev', title: 'Tilldelningar utan elev', desc: 'Aktiva tilldelningar där ElevID är tomt.', tone: 'red',
      items: activeTil.filter((t) => !str(t.ElevID)).map((t) => ({ key: t._id, label: `${str(t.Title)} · ${str(t.EnhetID)}`, sub: str(t.ElevNamn) || 'Inget namn', href: devHref(t.EnhetID) })),
    },
    {
      id: 'til-okand-elev', title: 'Tilldelning till elev som inte finns', desc: 'ElevID matchar ingen elev i Elever (varken ElevID eller e-post).', tone: 'red',
      items: activeTil.filter((t) => str(t.ElevID) && !elevOf(t)).map((t) => ({ key: t._id, label: `${str(t.ElevNamn) || str(t.ElevID)} · ${str(t.EnhetID)}`, sub: `ElevID: ${str(t.ElevID)}`, href: devHref(t.EnhetID) })),
    },
    {
      id: 'enhet-tva-elever', title: 'Enhet tilldelad flera elever', desc: 'Samma serienummer har flera aktiva tilldelningar. Den senaste räknas.', tone: 'red',
      items: [...perSerial.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ key: k, label: k, sub: v.map((t) => str(t.ElevNamn)).join(', '), href: devHref(k) })),
    },
    {
      id: 'status-utan-til', title: 'Status Tilldelad men ingen aktiv tilldelning', desc: 'Enheten ser ut att vara hos en elev men ingen tilldelning finns. Åtgärd: sätt Tillgänglig.', tone: 'amber', fixLabel: 'Sätt Tillgänglig',
      items: devices.filter((d) => d.status === 'Tilldelad' && !d.holder).map((d) => ({
        key: d.id, label: d.assetId || d.serial, sub: d.modell, href: devHref(d.serial),
        fix: async () => { await store.update('enheter', d.id, { Status: storedDeviceStatus('Tillgänglig') }); await log(store, { typ: 'Datakvalitet', enhetId: d.serial, detaljer: 'Status: Tilldelad → Tillgänglig (ingen aktiv tilldelning)' }); },
      })),
    },
    {
      id: 'til-fel-status', title: 'Aktiv tilldelning men fel status', desc: 'Enheten har en aktiv tilldelning men status är Tillgänglig. Åtgärd: sätt Tilldelad.', tone: 'amber', fixLabel: 'Sätt Tilldelad',
      items: devices.filter((d) => d.holder?.kind === 'tilldelning' && d.status === 'Tillgänglig').map((d) => ({
        key: d.id, label: d.assetId || d.serial, sub: d.holder!.namn, href: devHref(d.serial),
        fix: async () => { await store.update('enheter', d.id, { Status: storedDeviceStatus('Tilldelad') }); await log(store, { typ: 'Datakvalitet', enhetId: d.serial, detaljer: 'Status: Tillgänglig → Tilldelad (aktiv tilldelning finns)' }); },
      })),
    },
    {
      id: 'elev-flera', title: 'Elev med flera aktiva enheter', desc: 'Eleven har mer än en aktiv tilldelning.', tone: 'amber',
      items: [...perStudent.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ key: k, label: str(v[0].ElevNamn) || k, sub: v.map((t) => str(t.EnhetID)).join(', ') })),
    },
    {
      id: 'klass-avviker', title: 'Klass i tilldelning stämmer inte', desc: 'Klassen i Tilldelningar skiljer sig från elevens nuvarande klass. Åtgärd: uppdatera tilldelningen.', tone: 'blue', fixLabel: 'Uppdatera klass',
      items: activeTil.filter((t) => { const s = elevOf(t); return s && str(s.Klass) && str(t.Klass) !== str(s.Klass); }).map((t) => {
        const s = elevOf(t)!;
        return {
          key: t._id, label: str(t.ElevNamn) || str(s.Title), sub: `Tilldelning: ${str(t.Klass) || '—'} · Elev: ${str(s.Klass)}`, href: devHref(t.EnhetID),
          fix: async () => {
            await store.update('tilldelningar', t._id, { Klass: str(s.Klass) });
            const d = devices.find((x) => serialKey(x.serial) === serialKey(t.EnhetID));
            if (d) await store.update('enheter', d.id, { TillhorKlass: str(s.Klass) });
          },
        };
      }),
    },
    {
      id: 'dubbel-elev', title: 'Dubbletter av elever', desc: 'Flera elever med samma e-post.', tone: 'amber',
      items: dupes(data.elever, (r) => str(r.Epost).toLowerCase()).map(([k, v]) => ({ key: k, label: k, sub: v.map((r) => `${str(r.Title)} (${str(r.Klass)})`).join(', '), href: `/elever?q=${encodeURIComponent(k)}` })),
    },
    {
      id: 'dubbel-enhet', title: 'Dubbletter av enheter', desc: 'Flera enheter med samma serienummer.', tone: 'red',
      items: dupes(data.enheter, (r) => serialKey(r.Serienummer)).map(([k, v]) => ({ key: k, label: k, sub: `${v.length} rader: ${v.map((r) => str(r.AssetID ?? r.Title) || '—').join(', ')}`, href: `/enheter?q=${encodeURIComponent(k)}` })),
    },
    {
      id: 'kontrakt', title: 'Kontrakt krävs men är inte signerat', desc: 'Aktiva tilldelningar med ContractRequired = Ja och SignaturStatus ≠ Signerad.', tone: 'blue',
      items: activeTil.filter((t) => yes(t.ContractRequired) && str(t.SignaturStatus) !== 'Signerad').map((t) => ({ key: t._id, label: str(t.ElevNamn), sub: `${str(t.Klass)} · ${str(t.EnhetID)} · sedan ${daysSince(t.Tilldelningsdatum || t._created)} d`, href: devHref(t.EnhetID) })),
    },
    {
      id: 'forsenade', title: 'Tillfälliga lån ej återlämnade', desc: 'Aktiva lån från tidigare dagar.', tone: 'amber',
      items: data.utlaningar.filter((l) => str(l.Status) === 'Aktiv' && daysSince(l['Utlåningsdatum'] || l._created) >= 1).map((l) => ({ key: l._id, label: `${str(l.ElevNamn)} (${str(l.Klass)})`, sub: `${str(l.EnhetID)} · ${daysSince(l['Utlåningsdatum'] || l._created)} dagar`, href: '/utlaning' })),
    },
    {
      id: 'utan-modell', title: 'Enheter utan modell eller AssetID', desc: 'Saknar Modell eller AssetID (etikett).', tone: 'blue',
      items: devices.filter((d) => d.status !== 'Kasserad' && (!d.modell || !d.assetId)).map((d) => ({ key: d.id, label: d.assetId || d.serial, sub: [!d.modell && 'saknar modell', !d.assetId && 'saknar AssetID'].filter(Boolean).join(', '), href: devHref(d.serial) })),
    },
    {
      id: 'logg-utan-tid', title: 'Aktivitetslogg utan Tidpunkt', desc: 'Loggrader där Tidpunkt är tom (skapad-datum används i stället).', tone: 'blue',
      items: data.aktivitetslogg.filter((l) => !str(l.Tidpunkt)).map((l) => ({ key: l._id, label: `${str(l.Typ)} · ${str(l.EnhetID) || '—'}`, sub: str(l.Detaljer).slice(0, 80) })),
    },
    {
      id: 'ret-utan-elev', title: 'Återlämningar utan ElevID', desc: 'Återlämningar där eleven inte kan kopplas.', tone: 'blue',
      items: data.aterlamningar.filter((r) => !str(r.ElevID)).map((r) => ({ key: r._id, label: `${str(r.Title)} · ${str(r.EnhetID)}`, sub: str(r.ElevNamn) || 'Inget namn' })),
    },
  ].map((c) => ({ ...c, items: c.items.filter(Boolean) })) as Check[];
}

export default function Datakvalitet() {
  const store = useStore();
  const ready = useReady();
  const router = useRouter();
  const devices = React.useMemo(() => buildDevices(store.data), [store.data]);
  const checks = React.useMemo(() => buildChecks(store.data, devices, store), [store, devices]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const problems = checks.filter((c) => c.items.length);

  const fixAll = async (c: Check) => {
    setBusy(c.id);
    try {
      for (const it of c.items) if (it.fix) await it.fix();
      store.toast({ icon: 'check_circle', message: `${c.items.length} rättade: ${c.title}` });
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Datakvalitet" description="Automatiska kontroller av listorna. Rätta det som går direkt härifrån — resten öppnar rätt enhet eller elev." />
      {!ready ? <PageState /> : problems.length === 0 ? (
        <div className="rk-card" style={{ padding: 0 }}><EmptyState icon="verified" tone="green" title="Allt ser bra ut" description={`${checks.length} kontroller utan anmärkning.`} /></div>
      ) : (
        <div className="stack">
          <span className="small muted">{problems.length} av {checks.length} kontroller har anmärkningar · {checks.length - problems.length} OK</span>
          {[...checks].sort((a, b) => Number(b.items.length > 0) - Number(a.items.length > 0)).map((c) => (
            <Card key={c.id} padding="sm">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className={`rk-attn__count rk-badge--${c.items.length ? c.tone : 'green'}`}>{c.items.length || <Icon name="check" size={20} />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div className="small muted">{c.desc}</div>
                </div>
                {c.items.length > 0 && (
                  <div className="row" style={{ gap: 8 }}>
                    {c.fixLabel && c.items.some((i) => i.fix) && (
                      <Button size="sm" variant="tonal" icon="auto_fix_high" disabled={store.readOnly || busy === c.id} onClick={() => fixAll(c)}>{c.fixLabel} ({c.items.length})</Button>
                    )}
                    <Button size="sm" variant="text" trailingIcon={open === c.id ? 'expand_less' : 'expand_more'} onClick={() => setOpen(open === c.id ? null : c.id)}>Visa</Button>
                  </div>
                )}
              </div>
              {open === c.id && (
                <div className="stack" style={{ gap: 4, marginTop: 12, maxHeight: 360, overflow: 'auto' }}>
                  {c.items.map((it) => (
                    <div key={it.key} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mono small" style={{ fontWeight: 600 }}>{it.label}</div>
                        {it.sub && <div className="small muted">{it.sub}</div>}
                      </div>
                      {it.fix && <Button size="sm" variant="outlined" disabled={store.readOnly} onClick={async () => { await it.fix!(); store.toast({ icon: 'check_circle', message: `Rättat: ${it.label}` }); }}>{c.fixLabel}</Button>}
                      {it.href && <Button size="sm" variant="text" trailingIcon="open_in_new" onClick={() => router.push(it.href!)}>Öppna</Button>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
          <Badge tone="gray" icon="info">Kontrollerna körs på den data som hämtades senast.</Badge>
        </div>
      )}
    </>
  );
}
