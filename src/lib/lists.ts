/**
 * The SharePoint lists RönneKoll uses, keyed by an internal id.
 * Rows are normalised to objects keyed by the column *display name*
 * (e.g. "Serienummer", "Återlämnad"), so code never depends on SharePoint
 * internal names like field_2 or _x00c5_terl_x00e4_mnad.
 */

export const LISTS = {
  enheter: 'Enheter',
  elever: 'Elever',
  personal: 'Personal',
  tilldelningar: 'Tilldelningar',
  aterlamningar: 'Återlämningar',
  utlaningar: 'Utlåningar',
  felanmalningar: 'Felanmälningar',
  inventeringar: 'Inventeringar',
  inventeringsrader: 'InventeringsRader',
  aktivitetslogg: 'Aktivitetslogg',
  losenord: 'Losenordsbegaran',
  skolarenden: 'List av felanmälan vaktmästare',
} as const;

export type ListKey = keyof typeof LISTS;

export interface Row {
  _id: string;
  _created: string;
  _modified: string;
  // Column values keyed by display name
  [column: string]: unknown;
}

export type Data = Record<ListKey, Row[]>;

export const EMPTY_DATA: Data = {
  enheter: [],
  elever: [],
  personal: [],
  tilldelningar: [],
  aterlamningar: [],
  utlaningar: [],
  felanmalningar: [],
  inventeringar: [],
  inventeringsrader: [],
  aktivitetslogg: [],
  losenord: [],
  skolarenden: [],
};

/* ---------- Device status ---------- */

export const DEVICE_STATUSES = [
  'Tillgänglig',
  'Tilldelad',
  'Utlånad – tillfälligt',
  'Trasig',
  'Under reparation',
  'Kasserad',
  'Saknas',
] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

/** Values stored in SharePoint that differ from the UI label (kept for compatibility with the teacher app). */
const STORED_TO_UI: Record<string, DeviceStatus> = {
  Scrapped: 'Kasserad',
  Utlånad: 'Utlånad – tillfälligt',
  'Utlånad - tillfälligt': 'Utlånad – tillfälligt',
};
const UI_TO_STORED: Partial<Record<DeviceStatus, string>> = {
  Kasserad: 'Scrapped',
  'Utlånad – tillfälligt': 'Utlånad',
};

export function deviceStatus(raw: unknown): DeviceStatus {
  const s = String(raw ?? '').trim();
  if ((DEVICE_STATUSES as readonly string[]).includes(s)) return s as DeviceStatus;
  return STORED_TO_UI[s] ?? 'Tillgänglig';
}

export function storedDeviceStatus(s: DeviceStatus): string {
  return UI_TO_STORED[s] ?? s;
}

/** Statuses that disconnect a device from its student. */
export const DISCONNECTING: DeviceStatus[] = ['Trasig', 'Under reparation', 'Kasserad'];

/* ---------- Helpers ---------- */

export const str = (v: unknown) => (v == null ? '' : String(v));

/** Yes/No stored as Choice ("Ja"/"Nej") or boolean. */
export const yes = (v: unknown) => v === true || str(v).toLowerCase() === 'ja' || str(v).toLowerCase() === 'yes';
