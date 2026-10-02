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
  brandslackare: 'Brandslackare',
  brandkontroller: 'Brandkontroller',
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

/** A Row with the `id` DataTable needs. */
export type TRow = Row & { id: string };
export const withId = (rows: Row[]): TRow[] => rows.map((r) => ({ ...r, id: r._id }));

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
  brandslackare: [],
  brandkontroller: [],
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

/* ---------- Brandsläckare ---------- */

/** Lists RönneKoll can create itself (Inställningar → Skapa listor). Columns use ASCII internal names. */
export const PROVISION: Partial<Record<ListKey, { description: string; columns: { name: string; type: 'text' | 'note' | 'date' | 'choice' | 'number'; choices?: string[] }[] }>> = {
  brandslackare: {
    description: 'Brandsläckare på skolan (RönneKoll). Title = nummer, t.ex. BS-03.',
    columns: [
      { name: 'Plats', type: 'text' },
      { name: 'PlatsDetalj', type: 'text' },
      { name: 'Typ', type: 'choice', choices: ['Pulver 6 kg', 'Pulver 2 kg', 'Kolsyra 5 kg', 'Kolsyra 2 kg', 'Skum 6 l', 'Skum 9 l', 'Vatten 9 l', 'Brandfilt'] },
      { name: 'GiltigTill', type: 'date' },
      { name: 'SenasteService', type: 'date' },
      { name: 'Serviceforetag', type: 'text' },
      { name: 'Status', type: 'choice', choices: ['OK', 'Fel anmält', 'Byte beställt'] },
      { name: 'Anteckningar', type: 'note' },
    ],
  },
  brandkontroller: {
    description: 'Månadskontroller och händelser för brandsläckare (RönneKoll).',
    columns: [
      { name: 'BrandslackareNr', type: 'text' },
      { name: 'Datum', type: 'date' },
      { name: 'Resultat', type: 'choice', choices: ['OK', 'Fel', 'Service', 'Utbytt', 'Byte beställt'] },
      { name: 'Felorsak', type: 'text' },
      { name: 'Beskrivning', type: 'note' },
      { name: 'UtfordAv', type: 'text' },
    ],
  },
};

export const EXT_STATUSES = ['OK', 'Går ut snart', 'Utgången', 'Fel anmält', 'Byte beställt'] as const;
export type ExtStatus = (typeof EXT_STATUSES)[number];
export const EXT_REASONS = ['Visaren ej i grönt', 'Plomb eller sprint bruten', 'Skadad', 'Saknas', 'Blockerad / svår att nå', 'Skylt saknas', 'Utgången – behöver bytas'];
