'use client';

import { changeDeviceStatus, log } from './actions';
import { isOpenCase, serialKey, type DeviceView } from './derive';
import { todayIso } from './format';
import { REPAIR_FIXED, REPAIR_NOT_FIXED, REPAIR_OUT, storedDeviceStatus, str, type Data, type Row } from './lists';
import type { useStore } from './store';

type Store = ReturnType<typeof useStore>;

/* ---------- Warranty: inköpsdatum + 3 år ---------- */

export const WARRANTY_YEARS = 3;
export const LATE_DAYS = 14;
const SOON_DAYS = 60;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export type WarrantyState = 'Inom garanti' | 'Garanti går ut' | 'Garanti utgången' | 'Inköpsdatum saknas';
export interface Warranty { state: WarrantyState; text: string; long: string; until?: Date; daysLeft?: number }

export function warranty(inkop: string): Warranty {
  const bought = inkop ? new Date(inkop.slice(0, 10) + 'T00:00:00') : null;
  if (!bought || isNaN(bought.getTime())) return { state: 'Inköpsdatum saknas', text: 'fyll i Inköpsdatum', long: 'Inköpsdatum saknas på enheten' };
  const until = new Date(bought);
  until.setFullYear(until.getFullYear() + WARRANTY_YEARS);
  until.setDate(until.getDate() - 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((until.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return { state: 'Garanti utgången', text: `sedan ${fmt(until)}`, long: `Gick ut ${fmt(until)}`, until, daysLeft };
  const y = Math.floor(daysLeft / 365);
  const rest = daysLeft - y * 365;
  const left = y ? `${y} år ${rest} dagar kvar` : `${daysLeft} dagar kvar`;
  return {
    state: daysLeft <= SOON_DAYS ? 'Garanti går ut' : 'Inom garanti', text: `till ${fmt(until)}`,
    long: `${left} · till ${fmt(until)} (inköpt ${fmt(bought)} + ${WARRANTY_YEARS} år)`, until, daysLeft,
  };
}

/* ---------- Repairs ---------- */

export interface RepairView {
  id: string;
  row: Row;
  serial: string;
  device?: DeviceView;
  fault?: Row;
  kolli: string;
  lev: string;
  arende: string;
  skickad: string;
  mottagen: string;
  status: string;
  atgard: string;
  out: boolean;
  days: number;
  late: boolean;
  warranty: Warranty;
}

const daysBetween = (a: string, b: string) => Math.max(0, Math.round((new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime()) / 86400000));

export function buildRepairs(data: Data, devices: DeviceView[]): RepairView[] {
  const bySerial = new Map(devices.map((d) => [serialKey(d.serial), d]));
  const faults = new Map(data.felanmalningar.map((f) => [f._id, f]));
  const today = todayIso();
  return data.reparationer.map((r) => {
    const serial = str(r.EnhetID);
    const device = bySerial.get(serialKey(serial));
    const skickad = str(r.Skickad).slice(0, 10) || r._created.slice(0, 10);
    const mottagen = str(r.Mottagen).slice(0, 10);
    const status = str(r.Status) || REPAIR_OUT;
    const out = status === REPAIR_OUT;
    const days = daysBetween(skickad, out ? today : mottagen || today);
    return {
      id: r._id, row: r, serial, device, fault: faults.get(str(r.FelanmalanID)),
      kolli: str(r.Kollinummer), lev: str(r.Leverantor), arende: str(r.Arendenummer), skickad, mottagen, status, atgard: str(r.Atgard),
      out, days, late: out && days > LATE_DAYS, warranty: warranty(device?.inkop ?? ''),
    };
  });
}

/** Shown status: "Försenad hos leverantör" is derived, never stored. */
export const repairStatus = (r: RepairView) => (r.late ? 'Försenad hos leverantör' : r.status);

/** The open fault for a device (newest first). */
export function openFault(data: Data, serial: string): Row | undefined {
  const k = serialKey(serial);
  return data.felanmalningar
    .filter((f) => serialKey(f.EnhetID) === k && isOpenCase(f.Status))
    .sort((a, b) => b._created.localeCompare(a._created))[0];
}

/** Best stored value for a fault status, using the list's own choices when they differ (e.g. "Löst" instead of "Klar"). */
function faultChoice(store: Store, wanted: string[], fallback: string) {
  const choices = store.choices('felanmalningar', 'Status', []);
  if (!choices.length) return fallback;
  return wanted.find((w) => choices.some((c) => c.toLowerCase() === w.toLowerCase())) ?? fallback;
}

async function setFault(store: Store, fault: Row, values: Record<string, unknown>, warnings: string[]) {
  try {
    await store.update('felanmalningar', fault._id, values);
  } catch (e) {
    warnings.push(`Felanmälan kunde inte uppdateras: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export interface Shipment { kolli: string; lev: string; arende: string; skickad: string }

export async function sendRepairs(store: Store, items: { device: DeviceView; fault?: Row }[], s: Shipment) {
  const warnings: string[] = [];
  const sentStatus = faultChoice(store, ['Skickad på reparation', 'Väntar på del/leverantör'], 'Skickad på reparation');
  for (const { device, fault } of items) {
    await store.create('reparationer', {
      Title: `${device.assetId || device.serial} · ${s.skickad}`, EnhetID: device.serial, FelanmalanID: fault?._id ?? '',
      Kollinummer: s.kolli, Leverantor: s.lev, Arendenummer: s.arende, Skickad: s.skickad, Status: REPAIR_OUT,
    });
    // The student keeps the assignment while the device is away.
    await store.update('enheter', device.id, { Status: storedDeviceStatus('Under reparation') });
    if (fault) await setFault(store, fault, { Status: sentStatus }, warnings);
    await log(store, {
      typ: 'Reparation', enhetId: device.serial, elevId: device.holder?.elevId,
      detaljer: `Skickad till ${s.lev}${s.arende ? ` (ärende ${s.arende})` : ''} · kolli ${s.kolli}${fault ? ` · ${str(fault.TypAvFel) || str(fault.Beskrivning)}` : ''}`,
    });
  }
  return warnings;
}

export type NextStep = 'skicka' | 'byt' | 'kassera';

export async function receiveRepair(
  store: Store, r: RepairView,
  v: { fixed: true; atgard: string; giveBack: boolean } | { fixed: false; atgard: string; next: NextStep },
) {
  const warnings: string[] = [];
  const d = r.device;
  await store.update('reparationer', r.id, { Status: v.fixed ? REPAIR_FIXED : REPAIR_NOT_FIXED, Mottagen: todayIso(), Atgard: v.atgard });

  if (v.fixed) {
    if (r.fault) await setFault(store, r.fault, { Status: faultChoice(store, ['Klar', 'Löst', 'Åtgärdad', 'Avslutad'], 'Klar'), 'Åtgärd': v.atgard || 'Reparerad av leverantör' }, warnings);
    if (d) {
      const h = d.holder;
      if (h && v.giveBack) await store.update('enheter', d.id, { Status: storedDeviceStatus(h.kind === 'tilldelning' ? 'Tilldelad' : 'Utlånad – tillfälligt') });
      else if (h) await changeDeviceStatus(store, { ...d, status: 'Under reparation' }, 'Tillgänglig', { decision: 'aterlamna' });
      else await store.update('enheter', d.id, { Status: storedDeviceStatus('Tillgänglig') });
    }
  } else {
    if (r.fault) await setFault(store, r.fault, { Status: faultChoice(store, ['Pågående', 'Pågår', 'Ny'], 'Pågående'), 'Åtgärd': `Ej reparerad: ${v.atgard}` }, warnings);
    // Kassera / Byt enhet open their own dialogs afterwards; the device is Trasig until then.
    if (d) await store.update('enheter', d.id, { Status: storedDeviceStatus('Trasig') });
  }
  await log(store, {
    typ: 'Reparation', enhetId: r.serial, elevId: d?.holder?.elevId,
    detaljer: `Mottagen från ${r.lev || 'leverantör'} efter ${r.days} dagar — ${v.fixed ? 'reparerad' : 'ej reparerad'}${v.atgard ? `: ${v.atgard}` : ''}`,
  });
  return warnings;
}
