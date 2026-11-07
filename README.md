# VBHA Beheer

Webapp voor de ledenadministratie, het lidgeld, de boekhouding, het puntensysteem, de kalenders, de sponsors en de mails van de **Vriendenkring Brandweer Hoofdpost Aalst**.

- **Website**: statische pagina in `public/` (geen build-stap nodig)
- **Login en database**: Supabase (e-mail + wachtwoord, alleen op uitnodiging)
- **Hosting en serverfuncties**: Vercel (`api/`)
- **Bankkoppeling**: Enable Banking (PSD2), dagelijkse synchronisatie via Vercel Cron

```
public/          index.html, app.js, favicon.png  → de app zelf
                 inschrijven.html, banket.html, kinderfeest.html, kaart.html (+ kaart.json) → openbare pagina's
api/inschrijving.js, api/banket.js, api/kinderfeest.js, api/ronde.js → openbare formulieren en de live kaart
api/betaling.js, api/bancontact/callback.js → online betalen met Bancontact Pay
api/config.js    geeft de publieke Supabase-gegevens aan de browser
api/bank/*       koppeling met Enable Banking (start, callback, status, sync, unlink, aspsps)
api/_lib/*       gedeelde code: Supabase, Enable Banking (JWT), categorieregels
supabase/schema.sql  tabellen, beveiliging (RLS) en realtime
supabase/update-banket-kinderfeest-ronde.sql  extra tabellen voor een bestaande installatie
supabase/logboek.sql logboek van alle wijzigingen
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
6. Noteer bij **Project Settings › API Keys › Legacy API keys**: de *anon public key* en de *service_role key* (geheim!). Beide beginnen met `eyJ`. Gebruik **niet** de nieuwe sleutels die met `sb_publishable_` of `sb_secret_` beginnen. De *Project URL* staat bij **Project Settings › Data API**.

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

Alle leden, boekingen (2025–2026), het archief 2015–2024, punten, kalenders, de kalenderronde, het banket, sponsors, sjablonen, regels en instellingen komen mee. Terugzetten overschrijft records met dezelfde sleutel en laat andere staan, dus je kunt het veilig herhalen.

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

## Inschrijfformulier voor nieuwe leden

Op `https://jouw-site.vercel.app/inschrijven` staat een openbaar formulier. Iedereen kan het invullen, zonder aan te melden. Het vervangt het Google-formulier.

- Een inschrijving komt meteen in de ledenlijst, met het label **nieuw**.
- Op het dashboard verschijnt een melding met de nieuwe leden. Klik op een naam om het lid na te kijken. Klik op **Alles gezien** om de melding weg te halen.
- Bestaat er al een lid met dezelfde naam, dan wordt de inschrijving toch bewaard, met het label **mogelijk al lid**. Kijk ze na en verwijder wat dubbel is.
- Na het inschrijven ziet de persoon het bedrag, het rekeningnummer en de mededeling (`Naam Voornaam Lidgeld JAAR`). Met die mededeling wordt de betaling automatisch herkend.
- Rekeningnummer en lidgeld komen uit Instellingen (vul daar het rekeningnummer in).
- Er is een eenvoudige bescherming tegen spam: een verborgen veld, een minimale invultijd en maximaal 30 inschrijvingen per uur.

De link staat ook bij Instellingen, met een knop om ze te kopiëren.

### Online betalen met Mollie

Staat de sleutel ingesteld, dan krijgt wie zich inschrijft (lidgeld of banket) de knop **Betaal met Bancontact**. Die opent de beveiligde betaalpagina van Mollie; op de gsm gaat dat meteen naar de Bancontact- of bankapp, op een computer staat er een QR-code. Zodra de betaling gelukt is, staat het lidgeld of de banketinschrijving automatisch op **betaald** en ziet de persoon dat ook meteen op het scherm.

1. Maak een account op [mollie.com](https://www.mollie.com) (als vereniging/vzw) en activeer de betaalmethode **Bancontact**.
2. Kopieer in het Mollie-dashboard › **Ontwikkelaars** › **API-sleutels** de **Live API-sleutel** (`live_…`). Om eerst te testen kan je de **Test API-sleutel** (`test_…`) gebruiken: dan wordt er niets echt betaald.
3. Zet in Vercel › **Settings** › **Environment Variables**: `MOLLIE_API_KEY` = die sleutel, en `SITE_URL` = het adres van je site (bv. `https://vbha-beheer.vercel.app`).
4. Doe een **Redeploy**.

Optioneel: `MOLLIE_METHODS=bancontact,kbc,belfius` laat ook andere betaalmethodes toe die je in Mollie geactiveerd hebt.

Zonder sleutel blijft alles werken met de betaal-QR en de overschrijvingsgegevens. (De oude koppeling met Bancontact Pay via `BANCONTACT_API_KEY` werkt nog steeds als je Mollie niet invult.)

Boekhouding: Mollie stort de betalingen gebundeld door op de rekening. Die doorstorting komt via de bankimport binnen; zet ze op de juiste categorie (Lidgeld of Banket). De leden en inschrijvingen zelf staan al op betaald.

## Openbare pagina's: banket, kinderfeest en kalenderkaart

Deze pagina's zijn voor iedereen bereikbaar met de link, zonder aan te melden. Alles wat leden invullen komt meteen in de app terecht. Er is geen Google-formulier meer nodig en je hoeft niets in te laden.

| Pagina | Wat het doet |
|---|---|
| `/inschrijven` | Nieuw lid: komt in de ledenlijst en betaalt het lidgeld |
| `/banket` | Inschrijving banket (alleen of met partner, menu's). Het lid betaalt meteen met Bancontact of met een overschrijving. Een online betaling staat in **Banket** meteen op **Betaald**. |
| `/steun` | Vrije steun: iedereen kiest zelf een bedrag en mededeling en betaalt meteen met Bancontact (zelfde online betaalprovider). Er wordt niets bewaard in de app; de betaling komt binnen via de doorstorting/bankimport. Voorinvullen kan met `/steun?b=20&m=Kalender%202027` (met `&go=1` start de betaling meteen). Hier linkt vbha.be naar. |
| `/kinderfeest` | Inschrijving kinderen voor het kinderfeest. Datum, uur, plaats en maximumleeftijd komen uit de instellingen van het kinderfeest in de app. |
| `/kaart` | Kalenderronde: de kaart met de bedeelde en gereserveerde straten, met naam en datum. Ze ververst zichzelf elke 30 seconden. |

Nieuwe inschrijvingen voor het banket en het kinderfeest verschijnen als gele melding op het dashboard. Met het kruisje sluit je de melding.

Heb je de site al eerder geïnstalleerd? Voer dan eenmalig `supabase/update-banket-kinderfeest-ronde.sql` uit in de **SQL Editor**. Voer daarna `supabase/logboek.sql` opnieuw uit, zodat ook de nieuwe tabellen in het logboek komen.

## Logboek

Bij Instellingen › **Logboek** zie je elke wijziging aan de ledenlijst, de punten en kalenders, en de transacties en betalingen: wanneer, wie (e-mailadres) en wat er veranderde. Je kan zoeken en filteren op soort en persoon.

Eenmalig instellen: open in Supabase de **SQL Editor**, plak de inhoud van `supabase/logboek.sql` en klik **Run**. De database houdt het logboek dan zelf bij. Niemand kan het vanuit de app aanpassen of wissen. Inschrijvingen via het formulier en betalingen via Bancontact staan erin als "Automatisch (formulier of bank)".

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
