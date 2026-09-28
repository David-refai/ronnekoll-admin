'use client';

import type { DeviceView, StudentView } from './derive';
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

/* ---------- Students & loans ---------- */


export async function moveStudents(store: Store, students: StudentView[], klass: string) {
  for (const s of students) {
    if (s.klass === klass) continue;
    await store.update('elever', s.id, { Klass: klass });
    await log(store, { typ: 'Ändring', elevId: s.elevId, detaljer: `${s.namn} flyttad ${s.klass || '—'} → ${klass}` });
  }
}

export async function lendDevice(store: Store, s: StudentView, d: DeviceView) {
  await store.create('utlaningar', {
    Title: s.namn, ElevNamn: s.namn, EnhetID: d.serial, ElevID: s.elevId, PersonalID: store.userName,
    Utlåningsdatum: new Date().toISOString(), Status: 'Aktiv', Klass: s.klass,
  });
  await store.update('enheter', d.id, { Status: storedDeviceStatus('Utlånad – tillfälligt') });
  await log(store, { typ: 'Utlåning', enhetId: d.serial, elevId: s.elevId, detaljer: `Tillfälligt utlånad till ${s.namn} (${s.klass})` });
}

export async function returnLoan(store: Store, loan: { _id: string; [k: string]: unknown }, device?: DeviceView) {
  await store.update('utlaningar', loan._id, { Status: 'Återlämnad', Återlämningsdatum: new Date().toISOString() });
  if (device) await store.update('enheter', device.id, { Status: storedDeviceStatus('Tillgänglig') });
  await log(store, { typ: 'Återlämning', enhetId: String(loan.EnhetID ?? ''), elevId: String(loan.ElevID ?? ''), detaljer: `Lån återlämnat av ${String(loan.ElevNamn ?? '')}` });
}

export interface ReturnChecklist {
  LaddareMed: boolean | null;
  VaskaMed: boolean | null;
  SkarmSkadad: boolean | null;
  AndraSkador: boolean | null;
  Tagg: boolean | null;
  Skadebeskrivning: string;
}

const jn = (v: boolean | null) => (v == null ? '' : v ? 'Ja' : 'Nej');

/** Returns an assigned device: closes the assignment, writes Återlämningar, sets new status; creates a felanmälan when damaged. */
export async function returnAssignment(store: Store, d: DeviceView, c: ReturnChecklist, next: DeviceStatus) {
  const h = d.holder;
  if (h?.kind === 'tilldelning') await store.update('tilldelningar', h.row._id, { Återlämnad: 'Ja' });
  if (h?.kind === 'utlaning') await store.update('utlaningar', h.row._id, { Status: 'Återlämnad', Återlämningsdatum: new Date().toISOString() });
  await store.create('aterlamningar', {
    Title: stamp('RET'), EnhetID: d.serial, Modell: d.modell, ElevNamn: h?.namn ?? '', ElevID: h?.elevId ?? '', Klass: h?.klass ?? '',
    Återlämningsdatum: new Date().toISOString(), LaddareMed: jn(c.LaddareMed), VaskaMed: jn(c.VaskaMed), SkarmSkadad: jn(c.SkarmSkadad),
    AndraSkador: jn(c.AndraSkador), Tagg: jn(c.Tagg), Skadebeskrivning: c.Skadebeskrivning, MottagenAv: store.userName,
  });
  await store.update('enheter', d.id, { Status: storedDeviceStatus(next), TillhorKlass: '', Plats: next === 'Tillgänglig' ? 'IT-förråd' : 'IT-rummet' });
  if (c.SkarmSkadad || c.AndraSkador) {
    await createFault(store, {
      EnhetID: d.serial, TypAvFel: c.SkarmSkadad ? 'Skärm' : 'Fel', Prioritet: 'Normal',
      Beskrivning: c.Skadebeskrivning || (c.SkarmSkadad ? 'Skärmen skadad vid återlämning' : 'Skada vid återlämning'),
    });
  }
  await log(store, { typ: 'Återlämning', enhetId: d.serial, elevId: h?.elevId, detaljer: `Återlämnad${h ? ' av ' + h.namn : ''}. Status: ${d.status} → ${next}.` });
}

export async function assignDevice(store: Store, s: StudentView, d: DeviceView, opts: { contractRequired: boolean; signed: boolean; signer: string; guardian: string }) {
  await store.create('tilldelningar', {
    Title: stamp('TIL'), EnhetID: d.serial, ElevNamn: s.namn, ElevID: s.elevId, Klass: s.klass, PersonalID: store.userName,
    Tilldelningsdatum: new Date().toISOString(), Återlämnad: 'Nej', ContractRequired: opts.contractRequired ? 'Ja' : 'Nej',
    SignaturStatus: opts.contractRequired ? (opts.signed ? 'Signerad' : 'Väntar signatur') : '',
    SignaturAv: opts.signed ? opts.signer : '', SignaturDatum: opts.signed ? new Date().toISOString() : null, Vårdnadshavare: opts.guardian,
  });
  await store.update('enheter', d.id, { Status: storedDeviceStatus('Tilldelad'), TillhorKlass: s.klass, Plats: 'Hos elev' });
  await log(store, { typ: 'Tilldelning', enhetId: d.serial, elevId: s.elevId, detaljer: `Tilldelad till ${s.namn}${opts.contractRequired && !opts.signed ? ' (avtal väntar signatur)' : ''}` });
}

/* ---------- Cases ---------- */

export async function createFault(store: Store, v: { EnhetID: string; TypAvFel: string; Prioritet: string; Beskrivning: string }) {
  const today = new Date().toISOString().slice(0, 10);
  await store.create('felanmalningar', { ...v, AssetID: `${v.EnhetID}-${today}`, Title: `${v.EnhetID}-${today}`, Status: 'Ny', AnmäldAv: store.userName });
  await log(store, { typ: 'Felanmälan', enhetId: v.EnhetID, detaljer: `${v.TypAvFel}: ${v.Beskrivning}` });
}
