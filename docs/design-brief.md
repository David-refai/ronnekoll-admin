# RönneKoll Admin — Design Brief (Next.js + React)

## 1. What this is
An IT admin web app for **Rönnenskolan (Malmö stad)** that manages ~200+ student laptops (Chromebooks/PCs) across classes. It replaces an existing Power Apps admin panel and must keep **every function** it had, plus the additions below.

- **Stack (for context):** Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui-style components, Recharts for charts, SheetJS for Excel export.
- **UI language:** Swedish (all labels, buttons, statuses in Swedish).
- **Data source:** SharePoint lists via Microsoft Graph now; SQL later. Design must not depend on the backend.
- **No login screen.** Access works with a **manually pasted access token** (see Inställningar). The UI shows token status (valid / expires in X min / expired) in the top bar, and every screen has a clear "token expired" state with a "Klistra in ny token" action.
- **User of the app:** only me, the IT admin (desktop, sometimes with a USB barcode scanner).

## 2. User — single user
This app has **exactly one user: me (the IT admin)**. No roles, no role-gated navigation, no "access denied" screen, no read-only variants. Every screen and action is always available.
(Roles like Lärare / Ansvarig / Admin exist only as **data** — staff I manage in *Personal & behörigheter* for the separate teacher app.)

## 3. Design principles
1. **Modern, friendly, desktop-first** (1440px primary), usable on tablet (1024px) and phone. Visual language: **Google Material 3 components + Airbnb's warmth and polish** (see section 3b). Efficient for daily admin work, but never feeling like an old enterprise tool.
2. **Scanner-first:** a barcode scanner types the serial number + Enter. A **global scan/search field** in the top bar accepts a serial, student name, email or class and jumps to the result. `Ctrl+K` opens a command palette (search + actions like "Tilldela enhet", "Ny felanmälan").
3. **Bulk everything:** every table supports multi-select with a sticky bulk-action bar.
4. **History is append-only:** assignments, returns, loans and status changes are never edited — they are new events. Every device and student has a **timeline**. Current state is derived from the latest event.
5. **Everything is logged** to Aktivitetslogg (who, what, when, before → after).
6. **Safe destructive actions:** confirmation modal naming the exact object ("Kassera enhet SN 5CD12345?"); toasts with **Ångra** where possible.
7. **Every screen has 4 states designed:** loading (skeletons), empty (with a helpful action), error, token expired.
8. Light + dark mode.

## 3b. Visual style — Material 3 × Airbnb (important)
The look should feel like a modern Google product (Material 3 / Material You) with Airbnb's clean, warm, generous feel.

**From Material 3 (components & behaviour):**
- Material 3 component shapes and behaviour: filled / tonal / outlined / text buttons, **FAB** (e.g. "Skanna" or "Ny enhet"), **filter chips & input chips**, segmented buttons, navigation rail/drawer with a pill-shaped active indicator, search bar, snackbars (with Ångra), bottom sheets on mobile, tonal surfaces (surface-container levels) instead of heavy borders.
- Rounded shapes: 12px cards, 16–28px dialogs/sheets, fully rounded pills for chips, badges and search.
- **Modals/dialogs:** modern Material 3 style — large radius (28px), soft scrim with backdrop blur, icon + headline + supporting text, actions right-aligned; smooth scale/fade enter animation. On mobile they become bottom sheets. Long forms use **side sheets** (drawer from the right) rather than stacked popups.
- Motion: Material emphasized easing, 200–300ms, subtle state layers on hover/press, ripple feedback.

**From Airbnb (feel & polish):**
- Lots of white space, clean white/very light gray backgrounds, generous padding (24–32px in cards).
- **Soft shadows** instead of borders on cards; cards lift slightly on hover.
- Large, friendly typography with clear hierarchy — big bold page titles, readable 15–16px body. Font: **Inter** or **Plus Jakarta Sans** (or Google Sans–like: "Google Sans"/"Roboto Flex" if available).
- Airbnb-style **pill search bar** at the top (the global scan/search field) with a round accent icon button.
- Rich **cards** for devices and students (device model image/icon, big status, key info) as an alternative to tables — toggle *Tabell / Kort* view.
- Rounded, friendly empty states with simple illustrations/icons and one clear action.
- One confident accent color used sparingly (suggestion: a warm coral/rose like Airbnb, or Malmö-friendly deep teal — show both options), everything else neutral.

**Avoid:** dense grey enterprise tables with hard borders, SharePoint/Power Apps look, sharp corners, heavy gradients, tiny text.

**Dark mode:** Material 3 dark tonal palette (not pure black), same accents.

## 4. Status system (semantic colors — used everywhere as badges)
**Enhetsstatus:** Tillgänglig (green) · Tilldelad (blue) · Utlånad – tillfälligt (violet) · Trasig (red) · Under reparation (amber) · Kasserad/Scrapped (gray) · Saknas (dark red, from inventory).
**Ärendestatus (felanmälan / skolärende):** Ny · Pågår · Väntar på del/leverantör · Skickad på reparation · Klar · Avvisad.
**Lösenordsbegäran:** Ny · Behandlas · Klart.
**Prioritet:** Låg · Normal · Hög · Akut.

## 5. Layout shell
- **Left sidebar** (collapsible, icons + labels), grouped:
  - *Översikt*: Översikt, Analys
  - *Enheter*: Enheter, Importera, Inventering, Etiketter
  - *Elever & utdelning*: Elever, Tilldelning, Återlämning, Tillfällig utlåning
  - *Ärenden*: Felanmälningar (enheter), Skolärenden (vaktmästare), Lösenordsbegäran
  - *Rapporter*: Rapporter, Aktivitetslogg
  - *System*: Personal & behörigheter, Datakvalitet, Inställningar
- **Top bar:** global scan/search · notification bell (new felanmälningar / skolärenden / lösenordsbegäran, with counts) · token status pill · theme toggle · my name/avatar.
- Content area: page title, short description, primary action top-right, filters row, content.

## 6. Screens (full scope)

### 6.1 Översikt (dashboard)
- **KPI cards:** Totalt antal enheter · Tilldelade · Tillgängliga (lediga) · Utlånade idag · Trasiga · Under reparation · Öppna felanmälningar · Öppna skolärenden.
- **Att åtgärda** cards (clickable, each opens a filtered list): tillfälliga lån ej återlämnade, felanmälningar äldre än X dagar, lösenordsbegäran som väntar, elever utan enhet, enheter med status/tilldelning som inte stämmer, inventeringsavvikelser.
- **Senaste aktivitet** feed (last 20 events, icon per event type).
- **Charts:** statusfördelning (donut) · enheter per klass (stacked bar: tilldelade/lediga) · felanmälningar per vecka (line) · enheter per modell/ålder (bar).

### 6.2 Analys
Deeper analytics with a date-range + class filter: fault rate per model, average repair time, most-reported fault types, utdelning/återlämning progress per class at start/end of läsår, device age & warranty expiry timeline, loans per week (who forgets their laptop most — per class, not shaming individuals).

### 6.3 Enheter (device list)
- Table: AssetID (e.g. RÖGR105), Serienummer, ProduktID (Chromebook…), Kategori badge (Elev…), Modell, Status badge, Tilldelad till (elev, derived), TillhorKlass, Ägandetyp badge (e.g. Tilldelad elev), Plats, Inköpsdatum, Senast inventerad.
- Filters: status, kategori, ägandetyp, modell, klass, plats, "ej inventerad på X dagar", "utan AssetID/etikett". Saved filter views.
- Column chooser, sort, pagination/virtual scroll, row density toggle.
- **Bulk actions:** Ändra status · Skriv ut etiketter · Exportera till Excel · Flytta plats · Kassera.
- Primary action: **Ny enhet** (form) and **Importera**.

### 6.4 Enhetsdetaljer (side drawer or full page)
- Header: serial, model, big status badge, QR/barcode preview.
- Card: current holder (student + class + since date) or "Ledig".
- Actions: Tilldela · Återlämna · Byt enhet · Låna ut tillfälligt · Ändra status · Skapa felanmälan · Skriv ut etikett · Redigera · Kassera.
- Tabs: **Historik** (timeline of all events) · Felanmälningar · Kontrakt (PDFs) · Anteckningar.
- **Status-change rule:** if the device is assigned and the new status disconnects it (Trasig / Under reparation / Kasserad), open a **decision modal**: *Byt enhet* (pick an available device → reassigns within the same assignment) / *Återlämna* / *Avbryt*.

### 6.5 Importera enheter (wizard) — important
For receiving large batches of new devices.
1. **Källa:** upload Excel/CSV · paste a list of serials · **scan mode** (scan devices one by one, live list with counter and sound/visual feedback per scan).
2. **Kolumnmappning:** map file columns → fields (Serienummer, Modell, Tillverkare, Inköpsdatum, Garanti till, Leverantör, Ordernummer, Plats).
3. **Klassificering:** apply to all rows at once: modell, batch/leverans-namn, plats, initial status (default Tillgänglig), läsår.
4. **Validering:** flag duplicates within the file, serials that already exist, empty required fields, suspicious serial formats. Rows: OK / Varning / Fel, with fix inline or exclude.
5. **Förhandsgranska & importera:** summary (X nya, Y hoppas över), progress bar.
6. **Resultat:** summary + buttons *Skriv ut etiketter för importerade* · *Exportera importrapport* · *Visa i Enheter*.

### 6.6 Elever
- Table: Namn, E-post, Klass, Enhet (serial or "Ingen"), Status, Aktiva lån.
- Filters by class; **multi-select + bulk "Flytta till klass"**; import student list (Excel) with same validation idea (duplicates by e-post).
- **Elevdetaljer:** current device, full history, temporary loans, contracts (PDF), password requests, notes. Actions: Tilldela enhet, Återlämna, Låna ut, Begär lösenord.

### 6.7 Tilldelning (utdelning) — step flow
1. Välj elev (search or scan student card / pick from class).
2. Skanna/välj enhet (only Tillgänglig shown; warn if student already has a device).
3. Kontrollera (device condition checklist, charger included).
4. **Kontrakt:** toggle *Kontrakt krävs* (ContractRequired). If yes: generated PDF preview + **signature pad**, Signatur av, Vårdnadshavare. Can also be finished later → SignaturStatus "Väntar signatur", with a **Skicka påminnelse** action (tracks påminnelse skickad) and a list of assignments waiting for signature.
5. Bekräfta → event logged, device → Tilldelad, contract saved, optional email to guardian/teacher.
- **Klassutdelning mode:** pick a class → station view: student list on the left with progress (12/28 klara), scan device → auto-assign to the selected student → next. Built for handing out to a whole class fast.

### 6.8 Återlämning
- Scan device → shows who has it → condition checklist matching the list: **Laddare med · Väska med · Skärm skadad · Andra skador · Tagg** (Ja/Nej toggles) + **Skadebeskrivning** (shown when any damage = Ja) + Mottagen av (auto) → resulting status (Tillgänglig / Trasig → auto-creates felanmälan / Under reparation) → kvitto.
- **Klassåterlämning mode (end of läsår):** pick class → progress of returned vs missing, list of missing students, export "Ej återlämnade".

### 6.9 Tillfällig utlåning (forgot my laptop)
- One screen, two columns: **Välj elev** | **Välj ledig enhet** → Låna ut.
- Warning if the student already has an active temporary loan.
- Below: **Aktiva lån** list with "Återlämna" button per row; loans not returned by end of day highlighted as försenade.

### 6.10 Inventering
- Data: **Inventeringar** (Title, Startdatum, Status, UtfördAv) and **InventeringsRader** (Title, InventeringID, EnhetID, Skannad, PlatsVidSkanning) — one row per scanned device, storing where it was found.
- **Ny inventering:** scope (alla / klass / plats / status), name, date, utförd av.
- **Skanningsläge:** big scan field, live counters: Förväntade · Hittade · Saknas · Oväntade (scanned but not in scope / wrong class). Every scan gives instant feedback (green found / yellow wrong place / red unknown).
- Close session → **Inventeringsrapport** with discrepancies and bulk actions (mark Saknas, update plats). History of past inventories.

### 6.11 Etiketter (label printing)
- Select devices (from Enheter selection, import result, or search).
- Templates: label printer sizes (e.g. 62×29 mm, 54×17 mm) and A4 sheets (e.g. 3×8). Template editor: toggle fields — QR code, Code128 barcode (serial), inventarienummer, modell, "Rönnenskolan – Malmö stad", klass/elev name (optional).
- Live print preview, copies per device, print via browser print dialog. Mark devices as "etikett utskriven".

### 6.12 Felanmälningar (device faults)
- Views: **Kanban** by status and **list**.
- Card: EnhetID + model, elev (derived via active Tilldelning), AnmäldAv, TypAvFel, Beskrivning, BildURL thumbnail, Prioritet, datum. Closing requires filling **Åtgärd** (what was done).
- Detail: comments/timeline, link to device, actions: ändra status, skicka på reparation (supplier, ärendenummer, datum), byt enhet för eleven, avsluta.

### 6.13 Skolärenden (vaktmästare) — separate queue
Facility issues from staff, not tied to devices. Backed by the existing list **"List av felanmälan vaktmästare"** (filled from a form).
- Existing fields: **Starttid** (reported at), **Slutförandetid** (completed at), **E-post** + **Namn** (reporter), **Beskrivning**, **Plats** (choice, e.g. Annat), **Annat** (free-text location detail, e.g. "Kopieringsrum andra vån"), **Status** (e.g. Pågående), **TypAvFel** (choice, e.g. Övrigt).
- Show location as "Plats · Annat" together. Show time open (Starttid → now, or → Slutförandetid when done). Setting status to Klar fills Slutförandetid automatically.
- Nice-to-have fields (design them as optional): prioritet, tilldelad vaktmästare, comments, photo.
- View: kanban + list + filters + report of open/closed per TypAvFel. Also a compact mobile-friendly list (for when I walk around the school with my phone): sorted by age, big buttons to change status.

### 6.14 Lösenordsbegäran
Queue (Ny / Behandlas / Klart): elev (Title), Klass, ElevEpost, BegardAv (lärare), Datum, Typ (Eget förslag / other), ÖnskatLosenord — **always masked (••••••) with a reveal + copy button**, and cleared automatically once status is Klart. Actions: mark Behandlas, Klart. Show that the new password is sent automatically to the teacher by flow (status indicator).

### 6.15 Personal & behörigheter
- Staff table: namn, e-post, roll, ansvarig för klasser, aktiv.
- Add staff, set their role in the teacher app (Lärare / Ansvarig / Admin), assign classes (multi-select).
- Permission toggles per person (e.g. kan låna ut, kan tilldela, kan se rapporter, kan skapa felanmälan, kan begära lösenord).

### 6.16 Rapporter
- **Report catalog** (cards). Each report: filters (datum, klass, status, modell) → preview table + small chart → **Exportera Excel** / PDF / Skriv ut.
- Reports:
  - Utdelade enheter per klass (vem har vad)
  - Ej återlämnade enheter
  - Lediga enheter (antal + lista, per modell)
  - Trasiga & under reparation
  - Elever utan enhet
  - Felanmälningar per period / feltyp / modell
  - Tillfälliga lån per period
  - Inventeringsavvikelser
  - Enheter per ålder & garanti
  - Skolärenden per kategori / status
  - Aktivitet per användare
  - Kontrakt saknas (tilldelade utan signerat kontrakt)

### 6.17 Export (everywhere)
Every table has **Exportera** → .xlsx of current filter + visible columns, Swedish headers, filename with date (e.g. `Enheter_2026-09-27.xlsx`).

### 6.18 Aktivitetslogg
Filterable append-only timeline: datum, användare, händelsetyp, objekt (enhet/elev), före → efter. Filters by type, user, date, object. Export.

### 6.19 Datakvalitet (new — health checks)
Automated checks with a count + "Visa" + "Åtgärda" each:
- Tilldelningar utan elev (tomt ElevID)
- Dubbletter av elever (samma e-post) / enheter (samma serienummer)
- Enhet status Tilldelad men ingen aktiv tilldelning — or the reverse
- Elev med flera aktiva enheter
- Tilldelning till elev som inte längre finns
- Enheter utan modell / utan AssetID
- Rader i Återlämningar / Aktivitetslogg utan ElevID
- Aktivitetslogg-rader utan Tidpunkt
- Klass i Tilldelningar/Utlåningar som inte matchar elevens nuvarande klass
- Enheter med Status "Tilldelad" men Ägandetyp som säger annat
- Tilldelningar där kontrakt krävs men SignaturStatus inte är Signerad

### 6.20 Inställningar
- **Token:** paste field, decoded info (user, expires at), countdown, test connection button.
- SharePoint site & list mapping, status list, fault types, school-issue categories, label templates, email templates, contract template text.
- **Läsårsbyte (wizard):** promote classes (7A→8A), archive leaving classes, list devices to collect from leaving students.

## 7. Data model (current SharePoint lists)
Enheter · Elever · Personal · Tilldelningar (append-only, links device by **Serienummer**, student by **e-post**) · Återlämningar · Utlåningar (Status: Aktiv/Återlämnad) · Felanmälningar · Inventeringar · InventeringsRader · Aktivitetslogg · Losenordsbegaran · List av felanmälan vaktmästare (Skolärenden).
Design each entity's detail page around these relations: Enhet ↔ Tilldelningar ↔ Elev ↔ Klass, Enhet ↔ Felanmälningar, Inventering ↔ Rader.

## 8. Components to design (design system)
Navigation rail/drawer (Material 3), Airbnb-style pill search/scan bar, FAB, card view for devices and students, bottom sheet (mobile), side sheet, command palette, KPI card, status badge set, data table (sticky header, selection, bulk bar, column chooser, density), filter bar with chips, side drawer, step wizard, decision modal, confirmation modal, toast with undo, timeline, kanban board & card, scan-feedback panel (big success/warn/error states), signature pad, PDF preview, label preview, chart cards, empty states, skeletons, token-expired banner.

## 9. What I want from you (Claude Design)
Please design, in this priority order:
1. Layout shell + design tokens (colors light/dark, type scale, spacing, status colors).
2. Översikt.
3. Enheter list + Enhetsdetaljer drawer + status-change decision modal.
4. Importera enheter wizard (all steps, including validation step).
5. Tilldelning flow + Klassutdelning station view.
6. Återlämning + Inventering scan mode.
7. Felanmälningar kanban + Skolärenden (desktop + mobile list).
8. Rapporter catalog + one report detail.
9. Etiketter template + print preview.
10. Datakvalitet, Personal & behörigheter, Inställningar (token).

Use realistic Swedish sample data (classes 7A–9C, Chromebook/HP/Lenovo models, serials like 5CD1234XYZ).

## 10. Appendix — exact SharePoint columns (use these field names on detail pages, forms and tables)
| Lista | Kolumner |
|---|---|
| **Enheter** | AssetID, Serienummer, ProduktID, Kategori (choice), Modell, Status, Plats, Inköpsdatum, Anteckningar, TillhorKlass, Agandetyp (choice), Senastinventerad |
| **Elever** | Title (fullt namn), ElevID (ELEV00173), Fornamn, Efternamn, Klass, Personnr, Epost, Tagg, Skåpnummer |
| **Personal** | Title (namn), Epost, Roll (choice), Aktiv (Ja/Nej), MinKlass (klass eller ALLA) |
| **Tilldelningar** | Title (TIL-yyyyMMddHHmmss), EnhetID (= Serienummer), ElevNamn, ElevID, Klass, PersonalID (lärarens e-post), Tilldelningsdatum, Återlämnad (Ja/Nej), PåminnelseSkickad, SignaturAv, KontraktURL, SignaturDatum, Vårdnadshavare, ContractRequired (Ja/Nej), SignaturStatus |
| **Återlämningar** | Title (RET-yyyyMMddHHmmss), EnhetID, Modell, ElevNamn, ElevID, Klass, Återlämningsdatum, LaddareMed, VaskaMed, SkarmSkadad, AndraSkador, Tagg, Skadebeskrivning, MottagenAv |
| **Utlåningar** | Title, ElevNamn, EnhetID, ElevID, PersonalID, Utlåningsdatum, Återlämningsdatum, Status (Aktiv/Återlämnad), Klass |
| **Felanmälningar** | AssetID (Serienummer-datum), EnhetID, Beskrivning, Prioritet, Status, AnmäldAv, Åtgärd, TypAvFel (choice), BildURL |
| **Aktivitetslogg** | Title, Typ, EnhetID, Användare, Tidpunkt, Detaljer, ElevID |
| **Inventeringar** | Title, Startdatum, Status, UtfördAv |
| **InventeringsRader** | Title, InventeringID, EnhetID, Skannad, PlatsVidSkanning |
| **List av felanmälan vaktmästare** | Starttid, Slutförandetid, E-post, Namn, Beskrivning, Plats (choice), Annat, Status, TypAvFel (choice) |
| **Losenordsbegaran** | Title (elevens namn), Klass, Status (Ny/Behandlas/Klart), Datum, ÖnskatLosenord, Typ (choice, e.g. Eget förslag), BegardAv (person), ElevEpost |

**Privacy:** Personnr is sensitive — mask it by default in all tables (`130503-••••`), reveal on click, and never include it in exports unless explicitly checked.
**UI extras from the data:** show **Skåpnummer** on student cards (useful when collecting devices), **Tagg** as a small chip, **BildURL** as a photo thumbnail on fault cards, **Åtgärd** as a "what was done" field when closing a felanmälan, **MinKlass = ALLA** shown as "Alla klasser".
