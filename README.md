# RönneKoll Admin

IT-adminverktyg för Rönnenskolan (Malmö stad): enheter, elever, tilldelning, återlämning, tillfälliga lån, felanmälningar, skolärenden, inventering, etiketter och rapporter.

Byggt med **Next.js 15 (App Router) + React 19 + TypeScript**. Data ligger i **SharePoint-listor** och läses/skrivs via **Microsoft Graph**.

## Kom igång

```bash
npm install
npm run dev        # http://localhost:3000
```

Appen startar i **Demoläge** med exempeldata. För riktig data:

1. Öppna **Inställningar**.
2. Stäng av Demoläge och ange SharePoint-värd (t.ex. `malmostad.sharepoint.com`) och webbplatsens sökväg (t.ex. `/sites/Ronnenskolan-IT`) — eller klistra in hela adressen.
3. Klistra in en Microsoft Graph-token med `Sites.ReadWrite.All` (t.ex. från Graph Explorer) och tryck **Testa anslutning**.

Ingen inloggning: token sparas bara i minnet och i flikens `sessionStorage` och försvinner när fliken stängs.

## Struktur

| Sökväg | Innehåll |
|---|---|
| `src/ds/` | Designsystemet: tokens (`tokens.css`), komponent-CSS och React-komponenter |
| `src/lib/graph.ts` | Microsoft Graph-klient |
| `src/lib/sharepoint.ts` | Hittar listor på namn och kolumner på visningsnamn (interna namn som `field_2` spelar ingen roll) |
| `src/lib/lists.ts` | Listnamn, statusvärden och mappning mellan lagrade värden och UI (`Scrapped` ↔ `Kasserad`) |
| `src/lib/derive.ts` | Härledd data: vem har enheten, översiktssiffror, avvikelser |
| `src/lib/actions.ts` | Skrivoperationer — varje ändring loggas i Aktivitetslogg |
| `src/lib/demo.ts` | Exempeldata för Demoläge |
| `src/app/` | Sidorna |
| `docs/` | Designbrief och designsystemets riktlinjer |

## Principer

- All text i UI:t är på svenska.
- Historik skrivs aldrig över — ändringar blir nya händelser i Aktivitetslogg.
- Personnr maskeras och exporteras inte som standard. Önskat lösenord visas aldrig i klartext och rensas när begäran är Klart.

## Status

| Klart | Nästa |
|---|---|
| Översikt, Enheter, Elever, Tilldelning + Klassutdelning, Återlämning, Tillfällig utlåning, Felanmälningar, Skolärenden, Lösenordsbegäran, Aktivitetslogg, Personal, Inställningar | Importera, Inventering, Etiketter, Rapporter, Analys, Datakvalitet, Läsårsbyte |

© David Refai
