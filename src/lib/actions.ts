'use client';

import type { DeviceView } from './derive';
import { stamp, todayIso } from './format';
import { storedDeviceStatus, type DeviceStatus } from './lists';
import type { useStore } from './store';

type Store = ReturnType<typeof useStore>;

export async function log(
  store: Store,
  e: { typ: string; enhetId?: string; elevId?: string; detaljer: string },
) {
  try {
    await store.create('aktivitetslogg', {
      Title: e.typ,
      Typ: e.typ,
      EnhetID: e.enhetId ?? '',
      ElevID: e.elevId ?? '',
      Användare: store.userName,
      Tidpunkt: new Date().toISOString(),
      Detaljer: e.detaljer,
    });
  } catch {
    // Logging must never block the real operation.
  }
}

export type Decision = 'byt' | 'aterlamna';

export async function changeDeviceStatus(
  store: Store,
  device: DeviceView,
  next: DeviceStatus,
  opts: { decision?: Decision; replacement?: DeviceView } = {},
) {
  const prev = device.status;
  const h = device.holder;

  if (h && opts.decision === 'byt' && opts.replacement && h.kind === 'tilldelning') {
    const r = opts.replacement;
    await store.update('tilldelningar', h.row._id, { EnhetID: r.serial });
    await store.update('enheter', r.id, { Status: storedDeviceStatus('Tilldelad'), TillhorKlass: h.klass, Plats: 'Hos elev' });
    await store.update('enheter', device.id, { Status: storedDeviceStatus(next), TillhorKlass: '' });
    await log(store, { typ: 'Statusändring', enhetId: device.serial, elevId: h.elevId, detaljer: `Status: ${prev} → ${next}. Ersatt av ${r.serial}.` });
    await log(store, { typ: 'Byte', enhetId: r.serial, elevId: h.elevId, detaljer: `${h.namn} fick ${r.serial} i stället för ${device.serial}` });
    return;
  }

  if (h && opts.decision === 'aterlamna') {
    if (h.kind === 'tilldelning') {
      await store.update('tilldelningar', h.row._id, { Återlämnad: 'Ja' });
      await store.create('aterlamningar', {
        Title: stamp('RET'),
        EnhetID: device.serial,
        Modell: device.modell,
        ElevNamn: h.namn,
        ElevID: h.elevId,
        Klass: h.klass,
        Återlämningsdatum: todayIso(),
        MottagenAv: store.userName,
        Skadebeskrivning: `Återlämnad vid statusändring till ${next}`,
      });
    } else {
      await store.update('utlaningar', h.row._id, { Status: 'Återlämnad', Återlämningsdatum: todayIso() });
    }
    await store.update('enheter', device.id, { Status: storedDeviceStatus(next), TillhorKlass: '' });
    await log(store, { typ: 'Återlämning', enhetId: device.serial, elevId: h.elevId, detaljer: `Återlämnad av ${h.namn}. Status: ${prev} → ${next}.` });
    return;
  }

  await store.update('enheter', device.id, { Status: storedDeviceStatus(next) });
  await log(store, { typ: 'Statusändring', enhetId: device.serial, detaljer: `Status: ${prev} → ${next}` });
}

export interface DeviceInput {
  AssetID: string;
  Serienummer: string;
  ProduktID: string;
  Kategori: string;
  Modell: string;
  Plats: string;
  Inköpsdatum: string;
  Agandetyp: string;
  Anteckningar: string;
}

export async function createDevice(store: Store, v: DeviceInput) {
  await store.create('enheter', { ...v, Title: v.AssetID, Status: 'Tillgänglig', TillhorKlass: '' });
  await log(store, { typ: 'Ny enhet', enhetId: v.Serienummer, detaljer: `${v.Modell} lades till (${v.AssetID || 'utan AssetID'})` });
}

export async function editDevice(store: Store, device: DeviceView, v: Partial<DeviceInput>) {
  await store.update('enheter', device.id, { ...v, ...(v.AssetID != null ? { Title: v.AssetID } : {}) });
  await log(store, { typ: 'Ändring', enhetId: device.serial, detaljer: `Uppgifter ändrade: ${Object.keys(v).join(', ')}` });
}
