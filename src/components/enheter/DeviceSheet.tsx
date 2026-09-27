'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, Icon, SideSheet, StatusBadge, Tabs, Timeline, type Status, type TimelineEvent } from '@/ds';
import { serialKey, type DeviceView } from '@/lib/derive';
import { relDate, shortDate } from '@/lib/format';
import { str, yes, type Row } from '@/lib/lists';
import { useStore } from '@/lib/store';

const LOG_TYPE: Record<string, TimelineEvent['type']> = {
  tilldelning: 'tilldelning', återlämning: 'aterlamning', utlåning: 'utlaning', statusändring: 'status', byte: 'status',
  felanmälan: 'felanmalan', inventering: 'inventering', import: 'import', 'ny enhet': 'import', kontrakt: 'kontrakt', etikett: 'etikett',
};

export function DeviceSheet({
  device,
  onClose,
  onChangeStatus,
  onEdit,
}: {
  device: DeviceView;
  onClose(): void;
  onChangeStatus(): void;
  onEdit(): void;
}) {
  const store = useStore();
  const router = useRouter();
  const [tab, setTab] = React.useState('historik');
  const key = serialKey(device.serial);
  const d = store.data;

  const history = React.useMemo(() => {
    type E = TimelineEvent & { t: string };
    const out: E[] = [];
    const by = (rows: Row[]) => rows.filter((r) => serialKey(r.EnhetID) === key);
    for (const r of by(d.tilldelningar)) {
      out.push({ t: str(r.Tilldelningsdatum) || r._created, type: 'tilldelning', title: `Tilldelad ${str(r.ElevNamn)} (${str(r.Klass)})`, time: relDate(r.Tilldelningsdatum || r._created), user: str(r.PersonalID) || undefined });
      if (str(r.SignaturStatus) === 'Signerad') out.push({ t: str(r.SignaturDatum) || r._created, type: 'kontrakt', title: `Kontrakt signerat${r.SignaturAv ? ' av ' + str(r.SignaturAv) : ''}`, time: relDate(r.SignaturDatum) });
    }
    for (const r of by(d.aterlamningar)) out.push({ t: str(r['Återlämningsdatum']) || r._created, type: 'aterlamning', title: `Återlämnad av ${str(r.ElevNamn)}${r.Skadebeskrivning ? ' · ' + str(r.Skadebeskrivning) : ''}`, time: relDate(r['Återlämningsdatum'] || r._created), user: str(r.MottagenAv) || undefined });
    for (const r of by(d.utlaningar)) out.push({ t: str(r['Utlåningsdatum']) || r._created, type: 'utlaning', title: `Tillfälligt utlånad till ${str(r.ElevNamn)} (${str(r.Klass)})${str(r.Status) === 'Återlämnad' ? ' · återlämnad' : ''}`, time: relDate(r['Utlåningsdatum'] || r._created) });
    for (const r of by(d.felanmalningar)) out.push({ t: r._created, type: 'felanmalan', title: `Felanmälan: ${str(r.TypAvFel)} — ${str(r.Beskrivning)}`, time: relDate(r._created), user: str(r['AnmäldAv']) || undefined });
    for (const r of by(d.aktivitetslogg)) {
      const typ = str(r.Typ).toLowerCase();
      if (typ === 'tilldelning' || typ === 'återlämning') continue; // already shown from source lists
      const m = str(r.Detaljer).match(/Status: (.+?) → (.+?)(\.|$)/);
      out.push({
        t: str(r.Tidpunkt) || r._created, type: LOG_TYPE[typ] ?? 'status', title: str(r.Detaljer) || str(r.Typ),
        time: relDate(r.Tidpunkt || r._created), user: str(r['Användare']) || undefined,
        ...(m ? { before: m[1] as Status, after: m[2] as Status, title: str(r.Typ) } : {}),
      });
    }
    return out.sort((a, b) => b.t.localeCompare(a.t));
  }, [d, key]);

  const faults = d.felanmalningar.filter((r) => serialKey(r.EnhetID) === key);
  const h = device.holder;
  const contract = h?.kind === 'tilldelning' ? h.row : undefined;

  return (
    <SideSheet
      open
      onClose={onClose}
      overline={device.produkt || 'Enhet'}
      title={device.assetId || device.serial}
      subtitle={<div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}><StatusBadge status={device.status} size="lg" /><span className="mono muted">{device.serial}</span></div>}
      actions={
        <>
          <Button variant="outlined" icon="edit" onClick={onEdit} disabled={store.readOnly}>Redigera</Button>
          <Button icon="swap_horiz" onClick={onChangeStatus} disabled={store.readOnly}>Ändra status</Button>
        </>
      }
    >
      <div className="rk-card" style={{ boxShadow: 'none', background: 'var(--surface-container-low)' }}>
        {h ? (
          <div className="row">
            <Avatar name={h.namn} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{h.namn}</div>
              <div className="small muted">
                {h.klass} · {h.kind === 'utlaning' ? 'tillfälligt lån' : 'tilldelad'} sedan {shortDate(h.since)}
              </div>
            </div>
            {contract && (
              <Badge tone={str(contract.SignaturStatus) === 'Signerad' ? 'green' : yes(contract.ContractRequired) ? 'amber' : 'gray'} icon="draw">
                {str(contract.SignaturStatus) || (yes(contract.ContractRequired) ? 'Väntar signatur' : 'Inget kontrakt')}
              </Badge>
            )}
          </div>
        ) : (
          <div className="row muted"><Icon name="inventory_2" size={22} /> Ledig · {device.plats || 'IT-förråd'}</div>
        )}
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 8, margin: '16px 0' }}>
        <Button variant="tonal" size="sm" icon="report" onClick={() => router.push(`/felanmalningar?enhet=${encodeURIComponent(device.serial)}`)}>Skapa felanmälan</Button>
        <Button variant="tonal" size="sm" icon="print" onClick={() => router.push(`/etiketter?serials=${encodeURIComponent(device.serial)}`)}>Skriv ut etikett</Button>
        {!h && device.status === 'Tillgänglig' && (
          <Button variant="tonal" size="sm" icon="assignment_ind" onClick={() => router.push(`/tilldelning?enhet=${encodeURIComponent(device.serial)}`)}>Tilldela</Button>
        )}
      </div>

      <dl className="kv">
        <dt>Modell</dt><dd>{device.modell || '—'}</dd>
        <dt>Kategori</dt><dd>{device.kategori || '—'}</dd>
        <dt>Ägandetyp</dt><dd>{device.agande || '—'}</dd>
        <dt>Tillhör klass</dt><dd>{device.klass || '—'}</dd>
        <dt>Plats</dt><dd>{device.plats || '—'}</dd>
        <dt>Inköpsdatum</dt><dd>{shortDate(device.inkop)}</dd>
        <dt>Senast inventerad</dt><dd>{shortDate(device.senastInv)}</dd>
      </dl>

      <div style={{ margin: '20px 0 12px' }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'historik', label: 'Historik', count: history.length },
            { id: 'fel', label: 'Felanmälningar', count: faults.length },
            { id: 'noter', label: 'Anteckningar' },
          ]}
        />
      </div>
      {tab === 'historik' && (history.length ? <Timeline events={history} /> : <p className="small muted">Ingen historik ännu.</p>)}
      {tab === 'fel' && (
        <div className="stack">
          {faults.map((f) => (
            <div key={f._id} className="rk-card" style={{ padding: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{str(f.TypAvFel) || 'Fel'}</b>
                <StatusBadge status={(str(f.Status) || 'Ny') as Status} />
              </div>
              <div className="small">{str(f.Beskrivning)}</div>
              <div className="small muted">{relDate(f._created)} · {str(f['AnmäldAv'])}{f['Åtgärd'] ? ` · Åtgärd: ${str(f['Åtgärd'])}` : ''}</div>
            </div>
          ))}
          {!faults.length && <p className="small muted">Inga felanmälningar.</p>}
        </div>
      )}
      {tab === 'noter' && <p style={{ whiteSpace: 'pre-wrap' }}>{device.anteckningar || <span className="muted small">Inga anteckningar. Lägg till via Redigera.</span>}</p>}
    </SideSheet>
  );
}
