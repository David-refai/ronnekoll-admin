'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, SegmentedButton, SideSheet, StatusBadge, TextField, type Status } from '@/ds';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { shortDate } from '@/lib/format';
import { SUPPLIERS, str } from '@/lib/lists';
import { deleteRepair, editRepair, repairStatus, type RepairView } from '@/lib/repair';
import { useStore } from '@/lib/store';

/** One shipment: details, edit (typos), delete (registered by mistake), receive. */
export function RepairSheet({ r, onClose }: { r: RepairView; onClose(): void }) {
  const store = useStore();
  const router = useRouter();
  const known = SUPPLIERS.includes(r.lev);
  const [kolli, setKolli] = React.useState(r.kolli);
  const [lev, setLev] = React.useState(known ? r.lev : 'Annan');
  const [annan, setAnnan] = React.useState(known ? '' : r.lev);
  const [arende, setArende] = React.useState(r.arende);
  const [skickad, setSkickad] = React.useState(r.skickad);
  const [busy, setBusy] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const supplier = lev === 'Annan' ? annan.trim() || 'Annan' : lev;
  const changed = kolli !== r.kolli || supplier !== r.lev || arende !== r.arende || skickad !== r.skickad;

  const save = async () => {
    setBusy(true);
    try {
      await editRepair(store, r, { kolli, lev: supplier, arende: arende.trim(), skickad });
      store.toast({ icon: 'check_circle', message: 'Utskicket sparades' });
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  const name = r.device?.assetId || r.serial || 'Okänd enhet';
  return (
    <>
      <SideSheet open onClose={onClose} overline="Reparation" title={name}
        subtitle={<div className="row" style={{ gap: 8, marginTop: 6 }}><StatusBadge status={repairStatus(r) as Status} /><span className="small muted">{r.out ? `${r.days} dagar borta` : `tillbaka ${shortDate(r.mottagen)}`}</span></div>}
        actions={<>
          <Button variant="text" icon="delete" disabled={store.readOnly} onClick={() => setDel(true)}>Ta bort</Button>
          <span style={{ flex: 1 }} />
          {r.out && <Button variant="outlined" icon="move_to_inbox" onClick={() => router.push(`/reparationer/ta-emot?enhet=${encodeURIComponent(r.serial)}`)}>Ta emot</Button>}
          <Button icon="check" disabled={!changed || busy || store.readOnly} onClick={save}>Spara</Button>
        </>}>
        <dl className="kv" style={{ margin: '0 0 16px' }}>
          <dt>Enhet</dt><dd>{r.device ? `${r.device.modell} · ${r.device.serial}` : r.serial || '—'}</dd>
          <dt>Felanmälan</dt><dd>{str(r.fault?.TypAvFel) || str(r.fault?.Beskrivning) || '—'}</dd>
          <dt>Elev</dt><dd>{r.device?.holder ? `${r.device.holder.namn} · ${r.device.holder.klass}` : '—'}</dd>
          <dt>Garanti</dt><dd className="row" style={{ gap: 8 }}><StatusBadge status={r.warranty.state} /><span className="small muted">{r.warranty.text}</span></dd>
          {r.atgard && <><dt>Åtgärd</dt><dd>{r.atgard}</dd></>}
        </dl>
        <div className="stack" style={{ gap: 14 }}>
          <TextField label="Kollinummer" mono value={kolli} onChange={(e) => setKolli(e.target.value)} />
          <div>
            <span className="field-label">Leverantör</span>
            <SegmentedButton label="Leverantör" value={lev} onChange={setLev} options={SUPPLIERS.map((s) => ({ value: s, label: s }))} />
          </div>
          {lev === 'Annan' && <TextField label="Vilken leverantör?" value={annan} onChange={(e) => setAnnan(e.target.value)} />}
          <div className="form-grid">
            <TextField label="Skickad" type="date" value={skickad} onChange={(e) => setSkickad(e.target.value)} />
            <TextField label="Leverantörens ärendenummer" mono value={arende} onChange={(e) => setArende(e.target.value)} />
          </div>
        </div>
      </SideSheet>
      {del && (
        <ConfirmDelete title={`Ta bort utskicket för ${name}?`} onClose={() => setDel(false)}
          onConfirm={async () => {
            await deleteRepair(store, r);
            store.toast({ icon: 'delete', message: `Utskicket för ${name} togs bort` });
            onClose();
          }}>
          <span>{r.out ? 'Använd det när utskicket registrerades av misstag. Enheten och felanmälan får tillbaka sin status från före utskicket.' : 'Raden tas bort ur historiken. Enheten ändras inte.'}</span>
        </ConfirmDelete>
      )}
    </>
  );
}
