import { deviceStatus, str, yes, type Data, type DeviceStatus, type Row } from './lists';

export interface Holder {
  kind: 'tilldelning' | 'utlaning';
  namn: string;
  klass: string;
  elevId: string;
  since: string;
  row: Row;
}

export interface DeviceView {
  id: string;
  row: Row;
  assetId: string;
  serial: string;
  modell: string;
  produkt: string;
  kategori: string;
  status: DeviceStatus;
  plats: string;
  klass: string;
  agande: string;
  inkop: string;
  senastInv: string;
  anteckningar: string;
  holder?: Holder;
}

const time = (r: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = str(r[k]);
    if (v) return new Date(v).getTime() || 0;
  }
  return new Date(r._created).getTime() || 0;
};

export const serialKey = (s: unknown) => str(s).trim().toUpperCase();

export function indexStudents(data: Data) {
  const map = new Map<string, Row>();
  for (const s of data.elever) {
    if (s.ElevID) map.set(str(s.ElevID).toLowerCase(), s);
    if (s.Epost) map.set(str(s.Epost).toLowerCase(), s);
  }
  return map;
}

/** Latest active (not returned) assignment per device serial. */
export function activeAssignments(data: Data) {
  const map = new Map<string, Row>();
  const sorted = [...data.tilldelningar].sort((a, b) => time(a, 'Tilldelningsdatum') - time(b, 'Tilldelningsdatum'));
  for (const t of sorted) {
    const k = serialKey(t.EnhetID);
    if (!k) continue;
    if (yes(t['Återlämnad'])) map.delete(k);
    else map.set(k, t);
  }
  return map;
}

export function activeLoans(data: Data) {
  const map = new Map<string, Row>();
  for (const l of data.utlaningar) if (str(l.Status) === 'Aktiv') map.set(serialKey(l.EnhetID), l);
  return map;
}

export function studentName(row: Row, students: Map<string, Row>) {
  const s = students.get(str(row.ElevID).toLowerCase());
  return {
    namn: str(row.ElevNamn) || str(s?.Title) || str(row.ElevID),
    klass: str(s?.Klass) || str(row.Klass),
    elevId: str(s?.ElevID) || str(row.ElevID),
  };
}

export function buildDevices(data: Data): DeviceView[] {
  const students = indexStudents(data);
  const assigned = activeAssignments(data);
  const loans = activeLoans(data);
  return data.enheter.map((e) => {
    const serial = str(e.Serienummer);
    const a = assigned.get(serialKey(serial));
    const l = loans.get(serialKey(serial));
    let holder: Holder | undefined;
    if (l) holder = { kind: 'utlaning', ...studentName(l, students), since: str(l['Utlåningsdatum']), row: l };
    else if (a) holder = { kind: 'tilldelning', ...studentName(a, students), since: str(a.Tilldelningsdatum), row: a };
    return {
      id: e._id,
      row: e,
      assetId: str(e.AssetID ?? e.Title),
      serial,
      modell: str(e.Modell),
      produkt: str(e.ProduktID),
      kategori: str(e.Kategori),
      status: deviceStatus(e.Status),
      plats: str(e.Plats),
      klass: str(e.TillhorKlass) || holder?.klass || '',
      agande: str(e.Agandetyp),
      inkop: str(e['Inköpsdatum']).slice(0, 10),
      senastInv: str(e.Senastinventerad).slice(0, 10),
      anteckningar: str(e.Anteckningar),
      holder,
    };
  });
}

export const isOpenCase = (s: unknown) => !['Klar', 'Klart', 'Avvisad', 'Stängd'].includes(str(s));

export function overview(data: Data, devices: DeviceView[]) {
  const count = (s: DeviceStatus) => devices.filter((d) => d.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  const activeLoansRows = data.utlaningar.filter((l) => str(l.Status) === 'Aktiv');
  const overdue = activeLoansRows.filter((l) => str(l['Utlåningsdatum']).slice(0, 10) < today);
  const openFaults = data.felanmalningar.filter((f) => isOpenCase(f.Status));
  const oldFaults = openFaults.filter((f) => Date.now() - new Date(f._created).getTime() > 7 * 86400000);
  const openIssues = data.skolarenden.filter((f) => isOpenCase(f.Status));
  const pwWaiting = data.losenord.filter((p) => str(p.Status) !== 'Klart');

  const withDevice = new Set<string>();
  for (const d of devices) if (d.holder?.kind === 'tilldelning' && d.holder.elevId) withDevice.add(d.holder.elevId.toLowerCase());
  const studentsWithout = data.elever.filter((s) => !withDevice.has(str(s.ElevID).toLowerCase()));

  const mismatch = devices.filter(
    (d) => (d.status === 'Tilldelad' && d.holder?.kind !== 'tilldelning') || (d.status === 'Tillgänglig' && d.holder),
  );

  return {
    total: devices.length,
    tilldelade: count('Tilldelad'),
    tillgangliga: count('Tillgänglig'),
    utlanade: count('Utlånad – tillfälligt'),
    trasiga: count('Trasig'),
    reparation: count('Under reparation'),
    kasserade: count('Kasserad'),
    saknas: count('Saknas'),
    openFaults,
    oldFaults,
    openIssues,
    pwWaiting,
    activeLoans: activeLoansRows,
    overdue,
    studentsWithout,
    mismatch,
  };
}

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'));
}
