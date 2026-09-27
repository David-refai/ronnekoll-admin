RönneKoll Admin is the IT admin web app for Rönnenskolan (Malmö stad): ~250 student laptops across classes 7A–9C, one user (the IT admin), desktop-first with a USB barcode scanner. The look is **Material 3 components with Airbnb's warmth**: white space, soft shadows instead of borders, pill shapes, big friendly type and one confident accent.

## Content fundamentals

- **All UI copy is Swedish.** Labels, buttons, statuses, empty states, errors. Field names on detail pages use the SharePoint column names from the data model (Serienummer, AssetID, TillhorKlass, SignaturStatus…); present them in plain Swedish where a label is friendlier ("Tillhör klass").
- **Verb first, sentence case, no all-caps** except the 11px `overline` nav-group labels: "Tilldela enhet", "Skriv ut etiketter", "Klistra in ny token".
- **Talk to "du"** (the admin): "Du ändrar status till Trasig. Vad ska hända med tilldelningen?" Never "användaren".
- **Name the exact object** in every confirmation: "Kassera enhet SN 5CD1234XYZ?" — then the consequence in one sentence.
- **Errors say what to do**: "Serienumret finns redan — öppna enheten", not "Ogiltigt värde".
- **Statuses are the exact list values** (Tillgänglig, Tilldelad, Utlånad – tillfälligt, Trasig, Under reparation, Kasserad, Saknas; Ny, Pågår, Väntar på del/leverantör, Skickad på reparation, Klar, Avvisad; Behandlas, Klart; Låg, Normal, Hög, Akut). Never paraphrase them.
- **Dates**: relative within a week ("i dag 09:12", "i går"), then "14 aug 2026". Files: `Enheter_2026-09-27.xlsx`.
- **No emoji.** Friendliness comes from type, space and icons, not exclamation marks.
- Analytics about forgotten laptops aggregate **per class**, never shame individuals.

## Visual foundations

### Colour

- Surfaces are neutral and tonal (Material 3 surface-container levels): `surface` for page and cards, `surface-container-low` for the nav drawer, filter row, table header and kanban columns, `surface-container` for input and chip fills, `surface-container-high` for pressed/selected states. `surface-raised` for dialogs and sheets (one step lighter in dark mode). Dark mode is a tonal dark grey (`#141517`), never pure black.
- Text: `ink` for primary text, `ink-muted` for secondary text and placeholders — both pass 4.5:1 on every surface level in every theme. `ink-disabled` only for disabled labels.
- **One accent, used sparingly**: `primary` for the filled button, FAB, active states, links and focus; `primary-container` / `on-primary-container` for the active nav pill, tonal buttons, selected chips and selected rows. Text on a `primary` fill is always `on-primary`, never literal white.
- **Deep teal is the only accent**, in a `light` and a `dark` theme (Malmö-friendly, and clearly apart from the red used for Trasig, Akut and destructive actions). Dark mode follows the Material 3 tonal palette with a lighter teal.
- **Status colours carry meaning, never decoration** — always with a word and an icon (StatusBadge). Tones: `status-green` Tillgänglig/Klar · `status-blue` Tilldelad/Ny · `status-violet` Utlånad/Pågår/Behandlas · `status-amber` Under reparation/Väntar/Hög · `status-orange` Skickad på reparation · `status-red` Trasig/Akut/destructive · `status-gray` Kasserad/Avvisad/Låg · `status-crimson` (solid fill) Saknas. Each tone's text sits on its own `status-*-container` or on any surface at ≥4.5:1. Green and red are near-equal in lightness, so they are never told apart by colour alone.
- Charts use status tokens for status series and `primary` for single series. No other chart palette.
- Paper stays paper: contract pages (PdfPreview) and labels (LabelPreview) are white with black ink in every theme.

### Type

- **Plus Jakarta Sans** (Google Fonts, 400–800) for everything; **JetBrains Mono** for Serienummer, AssetID, ElevID and Title IDs (`serial` 14px, `scan` 22px) — scanned values must be unambiguous (0/O, 1/I).
- Big and friendly: `page-title` 36/44 800 once per page; `headline` 26/34 for dialogs and drawers; `title-lg` 20/28 card titles; `title` 16/24 item titles; `body` 15/22 default; `body-lg` 16/24 descriptions; `label` 14/20 600 buttons, chips, tabs, nav; `label-sm` 12/16 badges and table headers; `kpi` 36/40 with tabular numerals.
- Never below 12px. Numbers in KPIs, counters and table totals use `font-variant-numeric: tabular-nums`.

### Space, shape, elevation

- 4px base: `space-4` table cell padding and phone gutter, `space-6` card padding and grid gap, `space-8` page side padding and large cards, `space-10` header-to-content, `space-12` between sections. Generous — never cram.
- Shapes: `radius-md` 12px cards and tables, `radius-lg` 16px FAB, panels and side sheets, `radius-xl` 28px dialogs and bottom sheets, `radius-sm` 8px text fields, `radius-full` for every button, chip, badge, search bar, nav indicator and token pill. No sharp corners.
- **Shadows, not borders**: `shadow-card` at rest, `shadow-card-hover` + 2px lift on interactive cards, `shadow-search` on the pill search, `shadow-fab` on FAB and bulk bar, `shadow-overlay` on dialogs, sheets and the command palette. `line` hairlines only divide content *inside* a card; `outline` is for control edges (outlined buttons, chips, checkboxes) at ≥3:1.
- **Focus**: 2px solid `focus-ring` (alias of `primary`) with a 2px offset, on every interactive element.

### Motion

- Material 3 emphasized easing `ease-emphasized` for enters and moves, `ease-emphasized-accel` for exits. `duration-short` 150ms state layers and toggles, `duration-medium` 250ms dialogs, card lift and nav indicator, `duration-long` 300ms sheets.
- Dialogs scale 0.92→1 + fade over a blurred `scrim`; side sheets slide from the right; bottom sheets slide up; scan feedback "pops". Hover/press = a `currentColor` state layer at 8% / 12%. Respect `prefers-reduced-motion`.

### Layout

- Shell: NavDrawer (280px, collapses to an 88px rail) · TopBar (72px: pill scan/search, token pill, bell, theme toggle, avatar) · content with PageHeader (title, one-line description, primary action top-right), then FilterBar, then content.
- Desktop-first at 1440px; tablet 1024px (rail, 16px padding); phone (modal drawer, dialogs become bottom sheets, side sheets go full-screen, lists become cards).
- Long forms and detail views open in a **SideSheet**, never stacked popups. Wizards (Importera, Tilldelning, Läsårsbyte) use the Stepper.
- Every list offers **Tabell / Kort** (SegmentedButton), multi-select with the sticky BulkBar, and **Exportera** (.xlsx of current filter + visible columns, Swedish headers).

### Every screen has four states

1. **Loading** — Skeletons in the shape of the content; real headers and filters stay.
2. **Empty** — EmptyState with one helpful action ("Inga enheter matchar filtret" + "Rensa filter").
3. **Error** — EmptyState `tone="red"`, icon `cloud_off`, "Försök igen".
4. **Token expired** — `error` Banner "Token har gått ut" with "Klistra in ny token" above the content, TokenStatus pill red, mutating actions disabled.

### Behaviour rules the UI must show

- **Scanner-first**: the TopBar SearchBar always accepts a scan (serial + Enter) and jumps to the result; `Ctrl K` opens the CommandPalette. Scan screens use the `lg` SearchBar with `scanning`, keep focus, and answer every scan with ScanFeedback (green found · amber wrong place · red unknown) plus ScanCounters.
- **History is append-only**: assignments, returns, loans and status changes are new events on a Timeline — never edit buttons on history rows. Current holder/status is derived from the latest event.
- **Safe destructive actions**: confirmation Dialog naming the object, `danger` confirm button, then a Snackbar with **Ångra** where a compensating event is possible.
- **Status-change rule**: an assigned device set to Trasig / Under reparation / Kasserad opens the decision Dialog (Byt enhet / Återlämna / Avbryt).
- **Privacy**: Personnr is masked everywhere (`130503-••••`) with reveal-on-click, never on cards, and excluded from exports unless "Inkludera personnummer i export" is checked.
- **Önskat lösenord** (Lösenordsbegäran) is always masked `••••••` with reveal and copy buttons, never exported, and cleared the moment the request is set to Klart — show "Rensat" in its place.
- **Token**: kept in memory and sessionStorage only, so it is gone when the tab closes. Say so wherever the token is pasted.

## Iconography

- **Material Symbols Rounded** (Google Fonts variable font), loaded with `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block`. Use the `Icon` component (ligature names).
- Outlined at rest; **filled** for the active nav item, KPI icons, status badges and scan feedback. Sizes: 24 nav/FAB/dialog, 20 default, 18 in buttons and chips, 14 in small badges.
- Device types: `laptop_chromebook` (Chromebook), `laptop_windows` (PC), `tablet_mac` (iPad). Key actions: `barcode_scanner` Skanna, `assignment_ind` Tilldela, `assignment_return` Återlämna, `schedule` Tillfällig utlåning, `report` Felanmälan, `handyman` Skolärende, `password` Lösenord, `inventory` Inventering, `label` Etiketter, `rule` Datakvalitet.
- No logo exists: the nav shows the name "RönneKoll" set in Plus Jakarta Sans 800 with a monogram "R" in a `primary` rounded square. Do not invent a mark or use Malmö stad's logo.

## Using the components

`components/bundle.js` defines `window.RonneKoll` (React 18 on the page, `React.createElement` style, no build step). Load `tokens.css`, the two Google Fonts stylesheets above plus `family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600`, then `components/bundle.css`, then the bundle. Set `data-theme` on `<html>` (or any wrapper) to `light` or `dark`. In the Next.js app, port the components to TypeScript/Tailwind keeping the class contract and tokens; charts are Recharts coloured with the status tokens.
