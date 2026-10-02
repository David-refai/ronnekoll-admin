'use client';

import { log } from './actions';
import { str, type Data, type ExtStatus, type Row } from './lists';
import type { useStore } from './store';

type Store = ReturnType<typeof useStore>;

export interface ExtView {
  id: string;
  row: Row;
  nr: string;
  plats: string;
  detalj: string;
  typ: string;
  giltigTill: string;
  senasteService: string;
  serviceforetag: string;
  anteckningar: string;
  /** Stored workflow status: OK / Fel anmält / Byte beställt */
  stored: string;
  /** Shown status — date-based states are computed, never stored */
  status: ExtStatus;
  daysLeft: number | null;
  checkedThisMonth?: Row;
  lastCheck?: Row;
  checks: Row[];
}

export const SOON_DAYS = 30;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const thisMonth = () => monthKey(new Date());
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const monthName = (d = new Date()) => MONTHS[d.getMonth()];

export function daysUntil(date: string): number | null {
  if (!date) return null;
  const t = new Date(date.slice(0, 10) + 'T00:00:00');
  if (isNaN(t.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

export function buildExtinguishers(data: Data): ExtView[] {
  const byNr = new Map<string, Row[]>();
  for (const c of data.brandkontroller) {
    const k = str(c.BrandslackareNr).trim().toUpperCase();
    byNr.set(k, [...(byNr.get(k) ?? []), c]);
  }
  const m = thisMonth();
  const when = (c: Row) => str(c.Datum) || c._created;
  return data.brandslackare.map((r) => {
    const nr = str(r.Title);
    const checks = (byNr.get(nr.toUpperCase()) ?? []).sort((a, b) => when(b).localeCompare(when(a)));
    const giltigTill = str(r.GiltigTill).slice(0, 10);
    const daysLeft = daysUntil(giltigTill);
    const stored = str(r.Status) || 'OK';
    let status: ExtStatus = 'OK';
    if (stored === 'Fel anmält' || stored === 'Byte beställt') status = stored;
    else if (daysLeft != null && daysLeft < 0) status = 'Utgången';
    else if (daysLeft != null && daysLeft <= SOON_DAYS) status = 'Går ut snart';
    const monthly = checks.filter((c) => ['OK', 'Fel'].includes(str(c.Resultat)));
    return {
      id: r._id, row: r, nr, plats: str(r.Plats), detalj: str(r.PlatsDetalj), typ: str(r.Typ), giltigTill,
      senasteService: str(r.SenasteService).slice(0, 10), serviceforetag: str(r.Serviceforetag), anteckningar: str(r.Anteckningar),
      stored, status, daysLeft, checks,
      lastCheck: monthly[0],
      checkedThisMonth: monthly.find((c) => when(c).slice(0, 7) === m),
    };
  });
}

/** Most urgent first: expired, faults, soon, ordered, then OK. */
const RANK: Record<ExtStatus, number> = { 'Utgången': 0, 'Fel anmält': 1, 'Går ut snart': 2, 'Byte beställt': 3, OK: 4 };
export const byUrgency = (a: ExtView, b: ExtView) =>
  RANK[a.status] - RANK[b.status] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || a.nr.localeCompare(b.nr, 'sv', { numeric: true });

export const needsAction = (e: ExtView) => e.status !== 'OK';

export function leftText(e: ExtView) {
  if (e.daysLeft == null) return 'Inget datum';
  if (e.daysLeft < 0) return `gick ut för ${-e.daysLeft} dagar sedan`;
  if (e.daysLeft === 0) return 'går ut i dag';
  if (e.daysLeft <= 60) return `om ${e.daysLeft} dagar`;
  return `om ${Math.round(e.daysLeft / 30)} mån`;
}

/* ---------- actions ---------- */

async function addCheck(store: Store, e: ExtView, v: { Resultat: string; Felorsak?: string; Beskrivning?: string }) {
  const now = new Date().toISOString();
  await store.create('brandkontroller', {
    Title: `${e.nr}-${now.slice(0, 10)}`, BrandslackareNr: e.nr, Datum: now, UtfordAv: store.userName, ...v,
  });
}

export async function checkOk(store: Store, e: ExtView) {
  await addCheck(store, e, { Resultat: 'OK' });
  await log(store, { typ: 'Brandkontroll', enhetId: e.nr, detaljer: `${e.nr} (${e.plats}): allt fungerar` });
}

export async function reportFault(store: Store, e: ExtView, reason: string, text: string) {
  await addCheck(store, e, { Resultat: 'Fel', Felorsak: reason, Beskrivning: text });
  await store.update('brandslackare', e.id, { Status: 'Fel anmält' });
  await log(store, { typ: 'Brandkontroll', enhetId: e.nr, detaljer: `${e.nr} (${e.plats}): fel — ${reason}${text ? '. ' + text : ''}` });
}

export async function orderReplacement(store: Store, e: ExtView, note: string) {
  await addCheck(store, e, { Resultat: 'Byte beställt', Beskrivning: note });
  await store.update('brandslackare', e.id, { Status: 'Byte beställt' });
  await log(store, { typ: 'Brandsläckare', enhetId: e.nr, detaljer: `Byte beställt för ${e.nr}${note ? ': ' + note : ''}` });
}

/** Replaced or serviced: new expiry date, status back to OK. */
export async function markReplaced(store: Store, e: ExtView, v: { giltigTill: string; typ: string; kind: 'Utbytt' | 'Service'; note: string }) {
  await addCheck(store, e, { Resultat: v.kind, Beskrivning: `Giltig till ${v.giltigTill}${v.note ? '. ' + v.note : ''}` });
  await store.update('brandslackare', e.id, { Status: 'OK', GiltigTill: v.giltigTill, SenasteService: new Date().toISOString(), Typ: v.typ });
  await log(store, { typ: 'Brandsläckare', enhetId: e.nr, detaljer: `${e.nr} ${v.kind === 'Utbytt' ? 'utbytt' : 'servad'}, giltig till ${v.giltigTill}` });
}
