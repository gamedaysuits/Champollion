---
id: how-this-site-is-translated
title: "Hoe deze site wordt vertaald"
description: "Elke locale op deze site is machinaal vertaald door Champollion zelf — dezelfde CLI die in deze documentatie wordt beschreven. Wij gebruiken onze eigen tool."
---

# Hoe deze site wordt vertaald

Elke taalversie van deze site met uitzondering van het Engels — die in de onderstaande tabel — is
**automatisch vertaald door Champollion zelf** — dezelfde CLI die deze documentatie
beschrijft (`npx champollion sync`). We dogfooden onze eigen tool.

Op dit moment gebruikt elk talenpaar één enkel model:
**`google/gemini-3.8-flash`** — de eigen standaard van de CLI — bij temperatuur 0,
waarbij wordt vertaald met de hieronder beschreven richtlijnen voor register en
terminologie per taal. (Tot 2026-10-06 gebruikte de site
`google/gemini-3.1-pro-preview`.) We hebben bewust voor één model gekozen als een
eerlijke standaard terwijl we onze op benchmarks gebaseerde modelselectie opnieuw opbouwen (zie
hieronder) — dit is dus een heldere, gedocumenteerde keuze, en geen resultaat dat we mooier
voordoen dan het is.

Twee dingen die u als lezer moet weten:

1. **Deze pagina's zijn machinale vertalingen.** Ze zijn geproduceerd met de
   hieronder beschreven richtlijnen voor register en terminologie, maar er heeft geen menselijke controle
   van elke zin plaatsgevonden. Als iets niet goed leest, is de Engelse versie
   leidend — en we ontvangen graag een correctie.
2. **Het model is vandaag een standaard, morgen gekozen per benchmark.**
   Het ontwerp van Champollion is om het vertaalmodel *voor elk talenpaar*
   te kiezen op basis van een benchmark — scoor elke kandidaat op een ontwikkelingscorpus en
   vertaal die locale met de hoogst scorende methode (statistische gelijke standen
   worden doorbroken op basis van kosten). We voeren die selectie opnieuw uit via onze eigen
   integriteitscontrole voordat we hier de winnaars per paar vastleggen. **Totdat die runs
   zijn gepubliceerd op het [Network leaderboard](/leaderboard), zal deze pagina
   geen benchmarkherkomst claimen die het u niet kan laten zien.**

## Herkomst per locale

| Locale | Taal | Methode | Model | Register | Laatst gesynchroniseerd |
|--------|------|---------|-------|----------|-------------------------|
| fr | Français | llm | `google/gemini-3.8-flash` | formeel *vous* | 2026-10-12 |
| de | Deutsch | llm | `google/gemini-3.8-flash` | Sie-vorm | 2026-10-12 |
| nl | Nederlands | llm | `google/gemini-3.8-flash` | u-vorm | 2026-10-12 |
| fil | Filipino | llm | `google/gemini-3.8-flash` | formeel | 2026-10-12 |
| es | Español | llm | `google/gemini-3.8-flash` | neutraal Latijns-Amerikaans | 2026-10-12 |
| zh | 简体中文 | llm | `google/gemini-3.8-flash` | professioneel technisch | 2026-10-12 |
| ja | 日本語 | llm | `google/gemini-3.8-flash` | です/ます (beleefd) | 2026-10-12 |
| ko | 한국어 | llm | `google/gemini-3.8-flash` | 해요체 (beleefd) | 2026-10-12 |
| pt | Português | llm | `google/gemini-3.8-flash` | professioneel | 2026-10-12 |
| th | ไทย | llm | `google/gemini-3.8-flash` | neutraal professioneel | 2026-10-12 |
| vi | Tiếng Việt | llm | `google/gemini-3.8-flash` | neutrale *bạn*-vorm | 2026-10-12 |
| ar | العربية | llm | `google/gemini-3.8-flash` | MSA, professioneel | 2026-10-12 |

## De benchmarkselectie die we opnieuw opbouwen

De beoogde methode — en hoe de configuratie is gestructureerd om te werken — is
modelselectie per paar, gestuurd door onze eigen evaluatie: beoordeel elk
kandidaatmodel op het ontwikkelingscorpus van het paar, kies het model met de
hoogste chrF++, en wanneer een gepaarde significantietoets geen onderscheid kan maken tussen twee
kandidaten, kies dan het goedkopere model. De volledige cyclus is
gedocumenteerd voor iedereen die deze wil reproduceren.

We publiceren vandaag op deze pagina **geen** scores of een "benchmarkwinnaar" per
taal, omdat de selectiesweep die deze cijfers moet onderbouwen eerst opnieuw
door de integriteitspoort van het testharnas wordt geleid.
Zodra dit beschikbaar is, zullen de runs op het openbare leaderboard staan, zal deze tabel
het winnende model van elk paar met de bijbehorende run bevatten, en zal de siteconfiguratie
de winnaars per paar opnieuw vastzetten. Tot die tijd: één eerlijke standaard.

The Network scoort runs op de standaardmanier: chrF++ op corpusniveau met het bijbehorende
95%-bootstrap-betrouwbaarheidsinterval en de sacreBLEU-handtekening, andere standaardmetrieken
ernaast, en diagnostische gegevens die afzonderlijk worden gerapporteerd
([Hoe runs worden gescoord](/docs/network/specifications/scoring#how-runs-are-scored)).
Scores zijn alleen vergelijkbaar **binnen een taalpaar en evaluatieset**,
nooit tussen paren — verschillen in schrift en corpus maken vergelijkingen tussen
paren betekenisloos.

## Register en toon

Elke taal wordt vertaald met een expliciet register dat is gekozen uit
de taalkaarten van Champollion, zodat de formaliteit op de hele site consistent is:

- **Français** — vouvoiement (formeel *vous*)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — formeel, met standaard technische termen
- **Español** — neutraal Latijns-Amerikaans Spaans
- **简体中文** — professioneel technisch register
- **日本語** — です/ます (beleefde vorm)
- **한국어** — 해요체 (beleefd)
- **Português** — professioneel register
- **ไทย** — neutraal professioneel
- **Tiếng Việt** — neutraal *bạn*-vorm
- **العربية** — Modern Standaard Arabisch, professioneel register

## Wat niet machinaal wordt vertaald

Codeblokken, CLI-commando's, configuratiesleutels, pakketnamen, URL's en
eigennamen worden beschermd tijdens de vertaling en blijven met opzet in het
Engels.

## Een vertaalfout gevonden?

Open een issue of PR — de bron van elke vertaalde pagina is het Engelse
origineel. Correcties op een vertaalde pagina blijven behouden bij toekomstige synchronisaties, zolang
de Engelse bron van die pagina ongewijzigd is (synchronisatie vertaalt een
pagina alleen opnieuw wanneer de Engelse bron verandert).

*Deze pagina is zelf machinaal vertaald via de hierboven beschreven methode — het
beschrijft zijn eigen vertaling.*
