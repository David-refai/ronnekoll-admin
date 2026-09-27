/** Deterministic sample data using the real SharePoint column names. Used in Demoläge. */

import type { Data, Row } from './lists';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Alva', 'Elias', 'Noor', 'Leo', 'Maja', 'Hamza', 'Wilma', 'Omar', 'Ebba', 'Liam', 'Sara', 'Adam', 'Alice', 'Yusuf', 'Ella', 'Hugo', 'Leila', 'Isak', 'Freja', 'Ali', 'Livia', 'Nils', 'Amira', 'Theo', 'Selma', 'Khalid', 'Jana', 'Viktor', 'Nora', 'Rayan'];
const LAST = ['Nilsson', 'Berg', 'Haddad', 'Andersson', 'Lund', 'Ali', 'Ek', 'Hassan', 'Svensson', 'Karlsson', 'Johansson', 'Mohammed', 'Lindqvist', 'Persson', 'Yilmaz', 'Olsson', 'Fosstveit', 'Asenov', 'Al Hussein', 'Sjöberg'];
const CLASSES = ['7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
const MODELS: [string, string, string, number][] = [
  ['HP Fortis Flip G1m 11', 'Chromebook', '2025-08-10', 96],
  ['HP Fortis x360 11 inch G5', 'Chromebook', '2024-08-12', 72],
  ['HP Chromebook 11 G9', 'Chromebook', '2021-08-16', 46],
  ['Lenovo ThinkPad L13', 'PC', '2022-06-01', 22],
  ['iPad 9', 'iPad', '2022-08-20', 12],
];
const TEACHERS = [
  ['Charlotta Woll', 'charlotta.woll@malmo.se', 'Admin', 'ALLA'],
  ['Jacob Mhand Sheik-Khalil', 'mhand.sheik-khalil@malmo.se', 'Lärare', '8B'],
  ['Hanna Hedin', 'hanna.hedin@malmo.se', 'Ansvarig', '7A'],
  ['Sara Ek', 'sara.ek@malmo.se', 'Lärare', '7C'],
  ['Johan Lind', 'johan.lind@malmo.se', 'Lärare', '9B'],
  ['Maria Persson', 'maria.persson@malmo.se', 'Lärare', '8A'],
];

const iso = (d: Date) => d.toISOString();
const day = (base: Date, n: number) => new Date(base.getTime() + n * 86400000);
const pad = (n: number, w = 3) => String(n).padStart(w, '0');

export function makeDemo(now = new Date()): Data {
  const r = rng(20260927);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const row = (id: number, created: Date, fields: Record<string, unknown>): Row => ({
    _id: String(id),
    _created: iso(created),
    _modified: iso(created),
    ...fields,
  });
  const serial = (prefix: string) => prefix + Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(r() * 34)]).join('');

  /* Students */
  const elever: Row[] = [];
  let eid = 100;
  CLASSES.forEach((k) => {
    const n = 23 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      eid++;
      const fn = pick(FIRST), ln = pick(LAST);
      const year = 2010 + (k[0] === '9' ? 1 : k[0] === '8' ? 2 : 3);
      elever.push(row(eid, day(now, -400), {
        Title: `${fn} ${ln}`,
        ElevID: 'ELEV' + pad(eid, 5),
        Fornamn: fn,
        Efternamn: ln,
        Klass: k,
        Personnr: `${String(year).slice(2)}${pad(1 + Math.floor(r() * 12), 2)}${pad(1 + Math.floor(r() * 28), 2)}-${pad(Math.floor(r() * 10000), 4)}`,
        Epost: `utb${(fn.slice(0, 4) + ln.slice(0, 4)).toLowerCase().replace(/[^a-z]/g, '')}${eid % 100}@skola.malmo.se`,
        Tagg: r() > 0.7 ? 'Ja' : '',
        Skåpnummer: String(100 + Math.floor(r() * 300)),
      }));
    }
  });

  /* Devices */
  const enheter: Row[] = [];
  let did = 0, asset = 100;
  MODELS.forEach(([modell, produkt, bought, count]) => {
    for (let i = 0; i < count; i++) {
      did++; asset++;
      const kategori = produkt === 'Chromebook' ? (r() > 0.1 ? 'Elev' : 'Lånepool') : 'Personal';
      enheter.push(row(did, new Date(bought), {
        Title: r() > 0.02 ? 'RÖGR' + asset : '',
        Serienummer: serial(produkt === 'iPad' ? 'DMP' : produkt === 'PC' ? 'PF' : '5CD'),
        ProduktID: produkt,
        Kategori: kategori,
        Modell: modell,
        Status: 'Tillgänglig',
        Plats: kategori === 'Personal' ? 'Personalrum' : 'IT-förråd',
        Inköpsdatum: bought,
        Anteckningar: '',
        TillhorKlass: '',
        Agandetyp: kategori === 'Elev' ? 'Tilldelad elev' : kategori === 'Lånepool' ? 'Skolans lånepool' : 'Personal',
        Senastinventerad: iso(day(now, -Math.floor(r() * 160))).slice(0, 10),
      }));
    }
  });
  // AssetID is the renamed Title column in Enheter
  enheter.forEach((e) => { e.AssetID = e.Title; delete e.Title; });

  /* Assignments: most students get a Chromebook from the Elev pool */
  const tilldelningar: Row[] = [];
  const pool = enheter.filter((e) => e.Kategori === 'Elev');
  let tid = 0;
  elever.forEach((s, i) => {
    if (r() < 0.03 || i >= pool.length) return; // some students without device
    const d = pool[i];
    const when = day(now, -30 - Math.floor(r() * 20));
    tid++;
    const signed = r() > 0.15;
    const teacher = pick(TEACHERS);
    tilldelningar.push(row(tid, when, {
      Title: 'TIL-' + iso(when).replace(/\D/g, '').slice(0, 14),
      EnhetID: d.Serienummer,
      ElevNamn: s.Title,
      ElevID: s.ElevID,
      Klass: s.Klass,
      PersonalID: teacher[1],
      Tilldelningsdatum: iso(when).slice(0, 10),
      Återlämnad: 'Nej',
      PåminnelseSkickad: '',
      SignaturAv: signed ? 'Vårdnadshavare' : '',
      KontraktURL: '',
      SignaturDatum: signed ? iso(day(when, 3)).slice(0, 10) : '',
      Vårdnadshavare: '',
      ContractRequired: r() > 0.3 ? 'Ja' : 'Nej',
      SignaturStatus: signed ? 'Signerad' : 'Väntar signatur',
    }));
    d.Status = 'Tilldelad';
    d.TillhorKlass = s.Klass;
    d.Plats = 'Hos elev';
  });

  /* Some broken / repair / scrapped */
  const assignedDevices = enheter.filter((e) => e.Status === 'Tilldelad');
  for (let i = 0; i < 9; i++) { const d = assignedDevices[Math.floor(r() * assignedDevices.length)]; d.Status = 'Trasig'; d.Plats = 'IT-rummet'; }
  for (let i = 0; i < 6; i++) { const d = pick(enheter.filter((e) => e.Status === 'Tillgänglig')); d.Status = 'Under reparation'; d.Plats = 'Hos leverantör'; }
  for (let i = 0; i < 4; i++) { const d = pick(enheter.filter((e) => e.Status === 'Tillgänglig' && e.ProduktID === 'iPad')); if (d) { d.Status = 'Scrapped'; d.Plats = 'Återvinning'; } }
  const missing = pick(enheter.filter((e) => e.Status === 'Tillgänglig'));
  missing.Status = 'Saknas'; missing.Plats = 'Okänd';

  /* Temporary loans */
  const utlaningar: Row[] = [];
  const loanPool = enheter.filter((e) => e.Kategori === 'Lånepool' && e.Status === 'Tillgänglig');
  for (let i = 0; i < 14; i++) {
    const s = pick(elever), d = loanPool[i % loanPool.length];
    const when = day(now, -Math.floor(r() * 25) - (i < 3 ? 0 : 1));
    const active = i < 3;
    utlaningar.push(row(i + 1, when, {
      Title: s.Title, ElevNamn: s.Title, EnhetID: d.Serienummer, ElevID: s.ElevID, PersonalID: 'david',
      Utlåningsdatum: iso(when).slice(0, 10), Återlämningsdatum: active ? '' : iso(when).slice(0, 10),
      Status: active ? 'Aktiv' : 'Återlämnad', Klass: s.Klass,
    }));
    if (active) d.Status = 'Utlånad';
  }

  /* Faults */
  const typer = ['Skärm', 'Tangentbord', 'Batteri', 'Laddare', 'Mjukvara', 'Fel'];
  const prios = ['Låg', 'Normal', 'Normal', 'Hög', 'Akut'];
  const fstatus = ['Klar', 'Klar', 'Klar', 'Klar', 'Klar', 'Pågående'];
  const felanmalningar: Row[] = [];
  for (let i = 0; i < 42; i++) {
    const d = pick(enheter);
    const when = day(now, -Math.floor(r() * 63));
    const st = i < 9 ? pick(['Ny', 'Pågående', 'Skickad på reparation']) : pick(fstatus);
    felanmalningar.push(row(i + 1, when, {
      AssetID: `${d.Serienummer}-${iso(when).slice(0, 10)}`,
      EnhetID: d.Serienummer,
      Beskrivning: pick(['går inte att ladda', 'spricka i skärmen', 'tangenter saknas', 'startar inte', 'laddaren trasig', 'blå skärm vid start']),
      Prioritet: pick(prios), Status: st, AnmäldAv: pick(TEACHERS)[0],
      Åtgärd: st === 'Klar' ? 'Bytt del' : '', TypAvFel: pick(typer), BildURL: '',
    }));
  }

  /* Activity log */
  const aktivitetslogg: Row[] = [];
  tilldelningar.slice(-25).forEach((t, i) => {
    aktivitetslogg.push(row(i + 1, new Date(t._created), {
      Title: 'Tilldelning', Typ: 'Tilldelning', EnhetID: t.EnhetID, Användare: 'David',
      Tidpunkt: t._created, Detaljer: `Tilldelad till ${t.ElevNamn}`, ElevID: t.ElevID,
    }));
  });

  /* School issues (vaktmästare) */
  const skolarenden: Row[] = [];
  const platser = ['Klassrum', 'Korridor', 'Matsal', 'Idrottshall', 'Annat'];
  for (let i = 0; i < 18; i++) {
    const t = pick(TEACHERS);
    const when = day(now, -Math.floor(r() * 40));
    const done = i > 4 && r() > 0.3;
    skolarenden.push(row(i + 1, when, {
      Title: '', Starttid: iso(when), Slutförandetid: done ? iso(day(when, 2)) : '', 'E-post': t[1], Namn: t[0],
      Beskrivning: pick(['Bläcket är slut så skrivaren 7161 funkar inte.', 'Lampan blinkar i taket.', 'Dörren går inte att låsa.', 'Projektorn visar ingen bild.', 'Kranen läcker.']),
      Plats: pick(platser), Status: done ? 'Klar' : pick(['Ny', 'Pågående']), Annat: pick(['Kopieringsrum andra vån', 'Sal 204', '', 'Plan 1']), TypAvFel: pick(['Övrigt', 'El', 'Lås', 'IT i klassrum', 'VVS']),
    }));
  }

  /* Password requests */
  const losenord: Row[] = [];
  for (let i = 0; i < 12; i++) {
    const s = pick(elever), t = pick(TEACHERS);
    const st = i < 2 ? 'Ny' : i < 3 ? 'Behandlas' : 'Klart';
    losenord.push(row(i + 1, day(now, -i * 3), {
      Title: s.Title, Klass: s.Klass, Status: st, Datum: iso(day(now, -i * 3)).slice(0, 10),
      ÖnskatLosenord: st === 'Klart' ? '' : pick(['Boss1234', 'rtxamd', 'Sommar2026']), Typ: pick(['Eget förslag', 'Slumpat']),
      BegardAv: t[0], ElevEpost: s.Epost,
    }));
  }

  const personal: Row[] = TEACHERS.map((t, i) => row(i + 1, day(now, -300), { Title: t[0], Epost: t[1], Roll: t[2], Aktiv: 'Ja', MinKlass: t[3] }));

  const inventeringar: Row[] = [row(1, day(now, -15), { Title: 'Inventering 8B', Startdatum: iso(day(now, -15)).slice(0, 10), Status: 'Avslutad', UtfördAv: 'David' })];

  return {
    enheter, elever, personal, tilldelningar, aterlamningar: [], utlaningar, felanmalningar,
    inventeringar, inventeringsrader: [], aktivitetslogg, losenord, skolarenden,
  };
}
