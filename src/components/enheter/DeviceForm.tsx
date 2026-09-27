'use client';

import * as React from 'react';
import { Button, SideSheet, TextField } from '@/ds';
import { createDevice, editDevice, type DeviceInput } from '@/lib/actions';
import { serialKey, unique, type DeviceView } from '@/lib/derive';
import { useStore } from '@/lib/store';

const EMPTY: DeviceInput = {
  AssetID: '', Serienummer: '', ProduktID: 'Chromebook', Kategori: 'Elev', Modell: '', Plats: 'IT-förråd',
  Inköpsdatum: '', Agandetyp: 'Tilldelad elev', Anteckningar: '',
};

export function DeviceForm({ device, devices, onClose }: { device?: DeviceView; devices: DeviceView[]; onClose(): void }) {
  const store = useStore();
  const [v, setV] = React.useState<DeviceInput>(
    device
      ? {
          AssetID: device.assetId, Serienummer: device.serial, ProduktID: device.produkt, Kategori: device.kategori,
          Modell: device.modell, Plats: device.plats, Inköpsdatum: device.inkop, Agandetyp: device.agande, Anteckningar: device.anteckningar,
        }
      : EMPTY,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof DeviceInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  const dupSerial = v.Serienummer && devices.some((d) => d.id !== device?.id && serialKey(d.serial) === serialKey(v.Serienummer));
  const dupAsset = v.AssetID && devices.some((d) => d.id !== device?.id && serialKey(d.assetId) === serialKey(v.AssetID));
  const models = unique(devices.map((d) => d.modell));
  const places = unique(devices.map((d) => d.plats));

  const save = async () => {
    setError(null);
    if (!v.Serienummer.trim()) return setError('Serienummer krävs.');
    if (dupSerial) return setError('Serienumret finns redan — öppna den enheten i stället.');
    setBusy(true);
    try {
      const clean = { ...v, Serienummer: v.Serienummer.trim().toUpperCase(), AssetID: v.AssetID.trim() };
      if (device) {
        const changed = Object.fromEntries(
          Object.entries(clean).filter(([k, val]) => {
            const before: Record<string, string> = {
              AssetID: device.assetId, Serienummer: device.serial, ProduktID: device.produkt, Kategori: device.kategori, Modell: device.modell,
              Plats: device.plats, Inköpsdatum: device.inkop, Agandetyp: device.agande, Anteckningar: device.anteckningar,
            };
            return before[k] !== val;
          }),
        );
        if (Object.keys(changed).length) await editDevice(store, device, changed);
        store.toast({ icon: 'check_circle', message: 'Enheten sparades' });
      } else {
        await createDevice(store, clean);
        store.toast({ icon: 'check_circle', message: `${clean.AssetID || clean.Serienummer} lades till` });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SideSheet
      open
      onClose={onClose}
      overline={device ? 'Redigera enhet' : 'Ny enhet'}
      title={device ? device.assetId || device.serial : 'Lägg till enhet'}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Avbryt</Button>
          <Button icon="check" disabled={busy || store.readOnly} onClick={save}>{device ? 'Spara' : 'Lägg till'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <TextField className="full" label="Serienummer" mono leadingIcon="barcode_scanner" value={v.Serienummer} onChange={set('Serienummer')} autoFocus={!device}
          error={dupSerial ? 'Serienumret finns redan' : undefined} helper="Skanna streckkoden på enheten" />
        <TextField label="AssetID" mono value={v.AssetID} onChange={set('AssetID')} error={dupAsset ? 'AssetID används redan' : undefined} placeholder="RÖGR123" />
        <div>
          <label className="field-label" htmlFor="f-prod">Produkt</label>
          <select id="f-prod" className="select" value={v.ProduktID} onChange={set('ProduktID')}>
            {['Chromebook', 'PC', 'iPad'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <TextField className="full" label="Modell" value={v.Modell} onChange={set('Modell')} list="rk-models" placeholder="HP Fortis Flip G1m 11" />
        <datalist id="rk-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        <div>
          <label className="field-label" htmlFor="f-kat">Kategori</label>
          <select id="f-kat" className="select" value={v.Kategori} onChange={set('Kategori')}>
            {['Elev', 'Lånepool', 'Personal'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="f-ag">Ägandetyp</label>
          <select id="f-ag" className="select" value={v.Agandetyp} onChange={set('Agandetyp')}>
            {unique(['Tilldelad elev', 'Skolans lånepool', 'Personal', v.Agandetyp]).map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <TextField label="Plats" value={v.Plats} onChange={set('Plats')} list="rk-places" />
        <datalist id="rk-places">{places.map((m) => <option key={m} value={m} />)}</datalist>
        <TextField label="Inköpsdatum" type="date" value={v.Inköpsdatum} onChange={set('Inköpsdatum')} />
        <TextField className="full" label="Anteckningar" multiline rows={3} value={v.Anteckningar} onChange={set("Anteckningar")} />
      </div>
      {error && <p className="small" style={{ color: 'var(--status-red)', fontWeight: 600 }}>{error}</p>}
    </SideSheet>
  );
}
