---
sidebar_position: 6
title: "Dekkingsaantallen: hoe we ze tellen"
description: "Hoe Champollion “talen met machinevertaling” telt — de twee niveaus (elke engine vs. deployed service), de SSOT waaruit elk weergegeven getal wordt gelezen, en het updatebeleid. Correcties zijn welkom."
---

# Dekkingsaantallen: Hoe we ze tellen

> **Samenvatting.** Wanneer de site stelt dat **552 levende talen enige vorm van machinevertaling hebben** en **196 worden bediend door een geïmplementeerde dienst**, dan zijn dat twee verschillende, opzettelijk gescheiden tellingen. Deze pagina definieert beide niveaus, benoemt de 'single source of truth' waaruit elk getal tijdens de build wordt gelezen, en beschrijft hoe de lijsten worden vernieuwd. Dekking is een *claim van bestaan*, nooit een claim van kwaliteit.

## De twee niveaus

**Niveau 1 — elke specifieke MT-engine ("gedekt").** Een levende taal telt als gedekt als deze voorkomt op de gepubliceerde lijst van ondersteunde talen van *een willekeurige* gevolgde specifieke MT-engine — geïmplementeerde consumenten-/API-diensten (Google Translate, Microsoft Translator, DeepL, LibreTranslate, …) **of** open onderzoeksmodellen (NLLB-200, OPUS-MT, M2M-100, MADLAD-400, …). Dit is de unie die een stip groen laat oplichten op de netwerkkaart.

**Niveau 2 — geïmplementeerde dienst ("bediend").** De strengere selectie: de taal staat op de lijst van een engine die iedereen daadwerkelijk *vandaag kan gebruiken* als consumenten- of API-dienst. Een open onderzoeks-checkpoint dat u zelf zou moeten downloaden, hosten en serveren, telt hier niet mee. Dit is het getal dat antwoord geeft op de vraag: "zou een spreker op dit moment een webpagina kunnen vertalen, zonder engineering-werk?"

De twee niveaus bestaan omdat ze verschillende vragen beantwoorden, en het samenvoegen ervan de wereldwijde dekking zou overdrijven. Beide worden uitsluitend geteld over **individuele levende talen volgens ISO 639-3** (`isoType: 'L'`).

## Waar de getallen vandaan komen (niets is handmatig getypt)

Elke weergegeven telling is een **build-time uitlezing** van machinale SSOT's — geen enkel cijfer op de site is in de tekst getypt om vervolgens te verouderen:

1. **De lijsten per engine** bevinden zich in `cli/shared/catalogue/method-coverage.json` —
   één vermelding per engine, *uitsluitend als citaat* geïmporteerd uit de eigen gepubliceerde
   lijst van ondersteunde talen van die provider, met de bijbehorende `source_url` en een `asOf`-datum. Champollion
   controleert of reproduceert deze lijsten niet; het zijn de eigen claims van de providers.
2. **De build bepaalt de doorsnede van** deze lijsten met de index van levende talen en genereert de
   niveau-aantallen in de build-statistieken van de site (`stats.coverage.dedicatedLiving` voor
   niveau 1, `stats.coverage.serviceLiving` voor niveau 2, over `stats.livingTotal`
   levende talen).
3. **Pagina's renderen de statistieken**, en een pre-push pariteitscontrole laat de build falen als de tekst
   en statistieken ooit uit de pas lopen.

## "194 talen" en "187 talen" kunnen beide waar zijn

De lijst van een provider en een telling van *talen* zijn niet hetzelfde object, dus elke vermelding in de SSOT verklaart welk van de twee het getal vertegenwoordigt:

- **`publisher-list-rows`** — de lengte van de eigen gepubliceerde lijst van de provider,
  precies zoals zij deze publiceren. De Cloud Translation-pagina van Google vermeldt **194** rijen
  voor hun NMT-model; dat is het cijfer dat deze site op naam aan Google toeschrijft.
- **`champollion-derived-enumeration`** — *onze* samenvoeging van die lijst naar afzonderlijke
  ISO 639-3 basistalen. Diezelfde 194 rijen van Google zijn **187** talen,
  omdat `zh-CN` en `zh-TW` één taal in twee schriften zijn, net als `pt-PT`
  en `pt-BR`, enzovoort. Dit getal is van ons, nooit van de provider.
- **`publisher-stated-headline`** — een totaal dat de provider opgeeft zonder dat er een lijst
  achter is gepubliceerd. Hier mag niets uit worden afgeleid.

Het verschil tussen de eerste twee is rekenkundig, geen onenigheid, en dit geldt voor elke provider: Microsoft 135 rijen → 128 talen, LibreTranslate 49 → 47, de 200 FLORES-varianten van NLLB-200 → 196. De kaart en de niveau-aantallen lezen de *opgesomde lijst*, nooit de koptekst. Een pre-push controle laat de build falen als de opgegeven basis van een vermelding en de bijbehorende lijst elkaar ooit tegenspreken.

Merk ook op dat een provider meerdere lijsten kan publiceren. De pagina van Google bevat een aparte tabel voor hun Translation LLM-niveau (127 rijen per 2026-08-16) en vermeldt helemaal geen gecombineerd totaal — dus "hoeveel talen ondersteunt Google?" heeft geen enkel gepubliceerd antwoord, en deze site verzint er ook geen.

## Geclaimde dekking is geen kwaliteit — en niet altijd implementeerbaar

Een taal op de lijst van een provider betekent dat de provider *ondersteuning claimt*, niets meer. Twee eerlijkheidsopmerkingen die de site overal toepast waar deze tellingen verschijnen:

- **Dekking ≠ kwaliteit.** Of de vertalingen goed zijn, is een afzonderlijke,
  gemeten vraag — dat is het hele doel van het benchmarknetwerk. Kwaliteitsclaims
  staan op het scorebord, ingedeeld op (methode, dataset, metriek); dekkingsclaims
  staan hier.
- **Geclaimd ≠ implementeerbaar.** Onderzoeksmodellen gericht op breedte kunnen zeer grote aantallen
  talen claimen, terwijl hun eigen documentatie een bruikbare kwaliteit meldt voor een veel kleinere
  subset. Waar een provider een dergelijke zelfevaluatie publiceert, toont de site het
  geclaimde aantal *en* het eigen implementeerbaarheids-/kwaliteitscijfer van de provider, elk met een bronvermelding naar
  het materiaal van de provider.

## De vernieuwingsdiscipline

Lijsten van providers veranderen; de tellingen moeten mechanisch volgen:

- Elke vermelding in `method-coverage.json` heeft zijn eigen `asOf`-datum, en het bestand
  bevat een `asOf` op het hoogste niveau — de datum van de laatste sweep. Onderdelen die
  dekkingsaantallen tonen, geven deze datum weer of linken ernaar.
- Een **SOTA-sweep** (het opnieuw controleren van de gepubliceerde lijst van elke provider, het toevoegen van nieuw
  gevolgde engines) is een periodieke onderhoudstaak; de sweep werkt de SSOT bij, en
  elke telling op de site volgt bij de volgende build. Er hoeft niets te worden "onthouden"
  in de paginatekst.
- Tussen de sweeps door zijn de tellingen precies zo actueel als hun `asOf`-datums — wat de reden is
  waarom die datums deel uitmaken van de gegevens, en geen voetnootconventie zijn.

## Correcties en discussie welkom

Als de lijst van een provider is gewijzigd, een taal verkeerd is geclassificeerd, of u denkt dat een niveaugrens verkeerd is getrokken, laat het ons dan weten — open een issue op
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
of stuur een e-mail naar [info@champollion.dev](mailto:info@champollion.dev).

---

## Bronnen

- **Lijsten per engine** — `cli/shared/catalogue/method-coverage.json`: de eigen gepubliceerde
  lijst van ondersteunde talen van elke engine (uitsluitend als citaat; `source_url` + `asOf` per vermelding).
- **Set van levende talen** — individuele levende talen volgens ISO 639-3 (`isoType: 'L'`)
  in de taalindex die is opgebouwd uit de geciteerde taalkaarten.
- **Niveau-aantallen** — door de build gegenereerde `stats.coverage.dedicatedLiving` (niveau 1),
  `stats.coverage.serviceLiving` (niveau 2), `stats.livingTotal`. Afgeleid door Champollion.
- **De populatieschatting gebaseerd op deze tellingen** — zie
  [De dekkingskloof: Hoe we deze schatten](/docs/network/context/coverage-gap-estimate).
