# VBHA Beheer

Webapp voor de ledenadministratie, het lidgeld, de boekhouding, het puntensysteem, de kalenders, de sponsors en de mails van de **Vriendenkring Brandweer Hoofdpost Aalst**.

- **Website**: statische pagina in `public/` (geen build-stap nodig)
- **Login en database**: Supabase (e-mail + wachtwoord, alleen op uitnodiging)
- **Hosting en serverfuncties**: Vercel (`api/`)
- **Bankkoppeling**: Enable Banking (PSD2), dagelijkse synchronisatie via Vercel Cron

```
public/          index.html, app.js, favicon.png  → de app zelf
api/config.js    geeft de publieke Supabase-gegevens aan de browser
api/bank/*       koppeling met Enable Banking (start, callback, status, sync, unlink, aspsps)
api/_lib/*       gedeelde code: Supabase, Enable Banking (JWT), categorieregels
supabase/schema.sql  tabellen, beveiliging (RLS) en realtime
vercel.json      instellingen en de dagelijkse synchronisatie (06:00/07:00 Belgische tijd)
```

---

## Stap 1 — Supabase

1. Maak een project op [supabase.com](https://supabase.com). Kies als regio **Central EU (Frankfurt)**.
2. Open **SQL Editor › New query**, plak de volledige inhoud van `supabase/schema.sql` en klik **Run**.
3. **Authentication › Sign In / Providers › Email**: laat *Email* aan, zet **Allow new users to sign up** uit. Zo kan alleen wie je uitnodigt binnen.
4. **Authentication › URL Configuration**:
   - *Site URL*: het adres van je site, bv. `https://vbha-beheer.vercel.app` (pas aan na stap 3 als je het adres nog niet kent)
   - *Redirect URLs*: voeg `https://vbha-beheer.vercel.app/**` toe
5. **E-mails**: de ingebouwde mailserver van Supabase verstuurt maar een paar mails per uur en (bij nieuwe projecten) enkel naar leden van je Supabase-team. Stel voor echt gebruik een eigen SMTP-server in via **Authentication › Emails › SMTP Settings** (bv. Brevo, Resend of het mailadres van de vriendenkring).
6. Noteer bij **Project Settings › API**: de *Project URL*, de *anon public key* en de *service_role key* (geheim!).

## Stap 2 — GitHub

Maak een nieuwe **private** repository (bv. `vbha-beheer`) en zet deze bestanden erin:

```bash
cd vbha-beheer
git init
git add .
git commit -m "VBHA Beheer"
git branch -M main
git remote add origin https://github.com/<jouw-account>/vbha-beheer.git
git push -u origin main
```

Of sleep de bestanden in GitHub via **Add file › Upload files**.

## Stap 3 — Vercel

1. **Add New › Project** en importeer de GitHub-repository.
2. *Framework Preset*: **Other**. Build- en output-instellingen niet aanpassen (`vercel.json` regelt het).
3. Vul bij **Environment Variables** in (zie ook `.env.example`):

| Naam | Waarde |
|---|---|
| `SUPABASE_URL` | Project URL uit Supabase |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (blijft op de server) |
| `SITE_URL` | het adres van de site, zonder `/` op het einde |
| `CRON_SECRET` | een lange willekeurige tekst |
| `ENABLE_BANKING_APP_ID` | (stap 6) |
| `ENABLE_BANKING_PRIVATE_KEY` | (stap 6) |

4. **Deploy**. Kreeg je een ander adres dan verwacht, pas dan `SITE_URL` in Vercel en de *Site URL / Redirect URLs* in Supabase aan en klik **Redeploy**.

## Stap 4 — Eerste gebruiker

1. Supabase › **Authentication › Users › Invite user** › je eigen e-mailadres.
2. Klik op de link in de mail. De site vraagt je een wachtwoord te kiezen.
3. Iedereen die je uitnodigt, wordt automatisch bestuurslid met de rol **bewerker**. Voor alleen-lezen: open **Table Editor › bestuur** en zet `rol` op `lezer`.

## Stap 5 — Gegevens overzetten uit de Claude-versie

1. Open de huidige app in Claude › **Instellingen** › **Volledige back-up (.json)**.
2. Open de nieuwe site › **Instellingen** (tandwiel) › **Back-up terugzetten (.json)** › kies het bestand.

Alle leden, boekingen (2025–2026), het archief 2015–2024, punten, kalenders, sponsors, sjablonen, regels en instellingen komen mee. Terugzetten overschrijft records met dezelfde sleutel en laat andere staan, dus je kunt het veilig herhalen.

## Stap 6 — Bankkoppeling met Enable Banking

1. Meld je aan op [enablebanking.com](https://enablebanking.com/sign-in/) en open **API applications**.
2. Registreer een applicatie:
   - *Environment*: **Production** (voor je eigen rekeningen kan dat met beperkte toegang via *linked accounts*, zie [de documentatie](https://enablebanking.com/docs/api/linked-accounts/)). Test eventueel eerst met **Sandbox**.
   - *Redirect URL*: `https://<jouw-site>/api/bank/callback`
   - Je browser downloadt een bestand `<application-id>.pem`.
3. In Vercel:
   - `ENABLE_BANKING_APP_ID` = de naam van het bestand zonder `.pem`
   - `ENABLE_BANKING_PRIVATE_KEY` = de volledige inhoud van het `.pem`-bestand (inclusief `-----BEGIN PRIVATE KEY-----`)
   - **Redeploy**
4. In de app: **Boekhouding › Bankimport › Rekening koppelen** › kies **Argenta** en *Zakelijk (vzw)* › geef toestemming bij Argenta.

Daarna:
- Elke ochtend haalt Vercel automatisch de nieuwe verrichtingen op (`/api/bank/sync`).
- Met **Nu ophalen** doe je het meteen.
- Elke verrichting krijgt de categorie van de eerste passende regel (**Boekhouding › Regels**). Lidgelden worden aan het lid gekoppeld. Zonder passende regel komt de verrichting bij **Te verwerken**.
- Dubbele boekingen worden uitgesloten via de bankreferentie (unieke index in de database) en via datum + bedrag + tegenpartij.
- De eerste keer begint de synchronisatie na de laatste bestaande rekeningboeking van dit jaar, zodat wat al via Excel is ingelezen niet dubbel komt. Wil je een vaste startdatum, zet dan `SYNC_VANAF=2026-11-01` in Vercel.
- De bank vraagt periodiek (meestal na 180 dagen) om de toestemming te vernieuwen. De app toont dat vooraf; koppel dan opnieuw.

## Beveiliging

- Alle tabellen staan achter **Row Level Security**: alleen aangemelde gebruikers die in `bestuur` staan, kunnen lezen; alleen de rol `bewerker` kan schrijven.
- De bankgegevens (`bank_koppelingen`, `bank_auth`) zijn enkel bereikbaar voor de server met de service_role key.
- De service_role key en de Enable Banking-sleutel staan alleen in Vercel, nooit in de browser of in GitHub.
- De site vraagt zoekmachines om niet te indexeren (`noindex`).

## Lokaal testen (optioneel)

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```
