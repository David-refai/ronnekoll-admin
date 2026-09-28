'use client';

import * as React from 'react';
import { Button, Dialog } from '@/ds';
import { DevicePicker } from '@/components/Pickers';
import { changeDeviceStatus } from '@/lib/actions';
import type { DeviceView } from '@/lib/derive';
import type { DeviceStatus } from '@/lib/lists';
import { useStore } from '@/lib/store';
import { Portal } from '@/components/Portal';

/** Byt enhet: the student keeps the same assignment but gets another device. */
export function SwapDialog({ device, devices, onClose }: { device: DeviceView; devices: DeviceView[]; onClose(): void }) {
  const store = useStore();
  const [replacement, setReplacement] = React.useState<DeviceView | null>(null);
  const [oldStatus, setOldStatus] = React.useState<DeviceStatus>('Trasig');
  const [busy, setBusy] = React.useState(false);
  const h = device.holder;
  if (!h || h.kind !== 'tilldelning') return null;

  const run = async () => {
    if (!replacement) return;
    setBusy(true);
    try {
      await changeDeviceStatus(store, device, oldStatus, { decision: 'byt', replacement });
      store.toast({ icon: 'swap_horiz', message: `${h.namn} fick ${replacement.assetId || replacement.serial}. ${device.assetId || device.serial} är nu ${oldStatus}.` });
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <Portal>
    <Dialog open onClose={onClose} icon="swap_horiz" title={`Byt enhet för ${h.namn} (${h.klass})`}
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button icon="swap_horiz" disabled={!replacement || busy || store.readOnly} onClick={run}>Byt enhet</Button></>}>
      <span>Nuvarande: <b className="mono">{device.assetId || device.serial}</b> · {device.modell}. Eleven behåller samma tilldelning och avtal.</span>
      <div>
        <label className="field-label">Ny enhet</label>
        <DevicePicker devices={devices} value={replacement} onChange={setReplacement} autoFocus
          allow={(d) => d.status === 'Tillgänglig' && !d.holder && d.id !== device.id}
          reason={(d) => `${d.assetId || d.serial} är ${d.status.toLowerCase()} — välj en tillgänglig enhet.`} />
      </div>
      <div>
        <label className="field-label" htmlFor="swap-old">Vad händer med den gamla enheten?</label>
        <select id="swap-old" className="select" value={oldStatus} onChange={(e) => setOldStatus(e.target.value as DeviceStatus)}>
          {(['Trasig', 'Under reparation', 'Tillgänglig', 'Kasserad', 'Saknas'] as DeviceStatus[]).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <span className="small muted">Loggas som nya händelser. Ingen historik skrivs över.</span>
    </Dialog>
    </Portal>
  );
}
