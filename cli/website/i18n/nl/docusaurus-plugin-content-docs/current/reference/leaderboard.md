---
title: "Ranglijst en publiceren"
slug: /reference/leaderboard
description: "Wat de openbare ranglijst is, de twee soorten benchmarks (openbaar en verzegeld), wat deze wel en niet omvat, en wat een gepubliceerde run precies bevat."
---

# Scorebord en publiceren

Het [scorebord](/leaderboard) is een openbaar register van beoordeelde vertaalruns.
Iedereen kan eraan bijdragen: u voert het evaluatieharnas (`mt-eval`) uit op uw eigen
machine, tegen een geregistreerde dataset, en publiceert het resultaat als een **runkaart**.
Het bord bewaart de kaart; het voert uw methode niet voor u uit. Het
bevat alleen tekst per zin voor open gelicentieerde, herdistribueerbare datasets —
nooit voor niet-commerciële, beperkte, verzegelde, in quarantaine geplaatste of uitsluitend lokale datasets,
en nooit wanneer u publiceert met `--scores-only`.

Het is een register van metingen, geen oordeel over welke vertaler dan ook. Een positie
hierop geeft aan hoe een methode scoorde op één dataset volgens één metriek. Het zegt niet
dat de vertaling goed is, en het geeft niemand toestemming om een methode te gebruiken voor de
taal van een gemeenschap.

## Drie zaken, gescheiden gehouden

| | Wat het is | Waar het draait |
|---|---|---|
| **Het harnas** ([`mt-eval`](/docs/network/specifications/harness)) | De beoordelaar. Op basis van een methode en een testset levert het een score en een runkaart op | Uw machine |
| **Het scorebord** | De toegang voor inzendingen en het register van runkaarten, geïndexeerd op dataset en taalpaarrichting | champollion.dev |
| **De netwerkkaart** | Waartoe de gepubliceerde runs optellen: welke paren zijn gemeten en welke niet | Een weergave van het register, geen component |

Niets komt op de kaart behalve via het bord, en niets komt op het bord
behalve als een gescoorde run met vingerafdruk. Een meting zonder herkomst kan
er geen deel van uitmaken.

## Twee soorten benchmarks

**Openbare benchmarks** gebruiken open datasets. Elke dataset is geregistreerd als een
metadatakaart met een ophaalverwijzing naar de bron: het harnas downloadt de
referenties tijdens runtime van upstream, controleert ze tegen een vastgezette SHA-256
en scoort tegen wat het heeft opgehaald. Openbare gegevens kunnen al aanwezig zijn in de
trainingsdata van een model, dus datasets dragen een contaminatiegraad. Een set met de graad `HIGH`
of `MEDIUM` (FLORES+ is `HIGH`), of helemaal geen graad, is **alleen relatief**:
bruikbaar om methoden die erop zijn uitgevoerd te vergelijken, nooit gerapporteerd als absolute kwaliteit.
Alleen een set met de graad `LOW` rangschikt op absolute kwaliteit. Een dataset in quarantaine
rangschikt nooit: de database weigert een score die hiervoor wordt ingediend.
De geregistreerde datasets en hun licentiestroken worden vermeld in
[Evaluatiedatasets](/docs/network/leaderboard/datasets).

**Verzegelde benchmarks** zijn achtergehouden testsets die hun beheerder op diens eigen
machine bewaart. Deelnemers krijgen ze nooit te zien. Een inzending is een model of een methode die het
eigen beoordelingsknooppunt van de beheerder uitvoert tegen de verzegelde set; er komen alleen scores uit, en
elke verzegelde run vereist de autorisatie van de beheerder. De sleutels van de sets zijn
momenteel in handen van de organisator. Sleutelbewaarders uit de gemeenschap — er zijn er nog geen benoemd;
Champollion bezit geen sleutelaandelen. Prijzen bestaan alleen bij verzegelde wedstrijden, onder
voorwaarden die de beheerder bekendmaakt voordat iemand deelneemt. Hoe u er een organiseert:
[Een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest).

## Reikwijdte

- **Geschreven tekst.** Het bord meet de vertaling van geschreven tekst: documenten,
  educatief en officieel materiaal, UI-tekenreeksen. Het meet geen spraak,
  realtime tolken of open chatgesprekken.
- **Op tekst gebaseerde talen.** Automatische vertaling van gebarentaal is een ander
  probleem; vermeldingen voor gebarentaal in de index vermelden "nog niet ondersteund"
  ([Wat telt als een taal](/docs/network/context/what-counts-as-a-language)).
- **Eén dataset tegelijk.** Een score is alleen vergelijkbaar met scores op
  dezelfde datasetversie. Posities overschrijden nooit datasets of talen.
- **Methoden, geen zinnen.** Een score beschrijft een methode op een benchmark. Er wordt
  voor geen enkele vertaling een betrouwbaarheidsscore per zin gepubliceerd
  ([Technische beperkingen](/docs/network/honest-limitations#system-vs-output)).

## Wat een gepubliceerde run bevat

Elke nieuwe kaart wordt beoordeeld volgens **beoordelingsstandaard/1**
([Beoordelingsspecificatie](/docs/network/specifications/scoring)):

- **De hoofdscore:** chrF++ op corpusniveau (0–100) met het bijbehorende 95%-bootstrap-betrouwbaarheidsinterval
  en de bijbehorende sacreBLEU-handtekening, zodat iedereen deze opnieuw kan berekenen.
- **Daarnaast:** BLEU, spBLEU en TER, en COMET wanneer deze is berekend. Ze worden
  getoond, nooit vermengd met de hoofdscore.
- **Apart:** diagnostische gegevens zoals FST-acceptatie en exacte overeenkomst, waar de
  hulpmiddelen daarvoor bestaan. Ze komen nooit in de hoofdscore terecht en bepalen nooit de rangorde van een run.
- **Vervallen velden:** `composite`, `quality_tier` en `cost_adjusted` zijn
  `null` op elke nieuwe kaart. Een oude kaart behoudt de opgeslagen samengestelde score, getoond als
  "legacy composite (retired)". Geen enkele automatische score draagt een kwaliteitslabel.
- **Herkomst:** de dataset-id en de bijbehorende SHA-256, de exacte model-slug, de
  conditie, wat het model is opgedragen (de SHA-256 van de prompt, en de tekst ervan
  tenzij u deze maskeert), de kosten, de harnasversie en een vingerafdruk over
  de configuratie. Identieke runs worden bij publicatie ontdubbeld, en een onafhankelijke
  replicatie geldt als bewijs.
- **Betrouwbaarheidsniveau:** elke rij arriveert als *zelf geëvalueerd*. *Champollion Verified*
  betekent dat de score opnieuw is afgeleid van uw ingediende uitvoer tegen de
  vastgezette referenties; dat herbeoordelingsprogramma is een onderhouderopdracht die handmatig wordt uitgevoerd,
  dus momenteel wordt geen enkele rij bij binnenkomst gepromoveerd. *Community Validated* wordt uitsluitend
  toegekend door een beoordeling door de gemeenschap zelf ([verificatieniveaus](/docs/network/leaderboard/rules#verification-tiers)).

Het volledige schema is de [Runkaart-specificatie](/docs/network/specifications/run-card).

## Publiceren

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- `--prod` (of `MT_EVAL_ALLOW_PROD=1`) is vereist voor schrijftoegang tot het live
  scorebord; zonder deze weigert het harnas.
- `--anonymous` publiceert zonder in te loggen; het bord toont "anonymous".
- `--scores-only` publiceert geaggregeerde scores en de hash en grootte van de dataset,
  nooit de bron- of referentietekst — voor uw eigen of een privécorpus.
- `--redact-coaching` vervangt de prompttekst door een markering en behoudt de
  hash. De begeleide prompt van een uitsluitend lokaal corpus wordt standaard gemaskeerd.

Het stappenplan is [Een methode indienen](/docs/network/getting-started/submit-a-method).

## De regels die overal gelden

- **Train nooit op evaluatiedata.** Een methode die is blootgesteld aan een benchmarkset — als
  trainingsdata, few-shot-voorbeelden, woordenboekitems of promptmateriaal — wordt
  gediskwalificeerd ([Inzendingsregels](/docs/network/leaderboard/rules)).
- **Beter wordt bepaald door een toets, niet door twee getallen.** Of de ene run de
  andere verslaat, is een gepaarde significantietoets op chrF++; buren die de toets niet
  kan scheiden, delen een positie ([Significantie](/docs/network/specifications/significance)).
- **Corpora worden hier niet gehost.** Registratie betreft metadata; corpora worden
  opgehaald bij hun bron. Een gepubliceerde run van een open gelicentieerde set mag
  de bijbehorende tekst per zin bevatten (zie hierboven).
- **Licentiestroken zijn structureel.** Niet-commerciële corpora worden buiten
  elk prijs-, API- en commercieel traject gehouden. Een corpus onder een gewijzigde, op maat gemaakte of
  niet-gespecificeerde licentie (`LicenseRef-*`) weigert evaluatie via externe model-API's totdat
  de toestemming van de rechthebbende op de kaart is vastgelegd; standaard niet-commerciële
  licenties gaan alleen via kanalen zonder training naar externe modellen; verzegelde segmenten
  gaan nooit extern. De EdTeKLA Plains Cree-sets zijn gecatalogiseerd als in quarantaine geplaatste
  labels, en de database weigert elke score die hiervoor wordt ingediend.

## Wat er momenteel actief is

- Het scorebord is live, openbaar en open voor inzendingen. De inhoud ervan bestaat uit actuele
  gegevens, dus deze pagina beschrijft ze niet — [bekijk het scorebord](/leaderboard).
- Elke rij is momenteel zelf geëvalueerd (zie de betrouwbaarheidsniveaus hierboven).
- Er staat geen prijs open en geen enkele score heeft een prijsdrempel gehaald
  ([Prijsspecificatie](/docs/network/specifications/prizes)).
- Er heeft nog geen beoordeling door sprekers uit de gemeenschap plaatsgevonden
  ([Sprekersvalidatie](/docs/network/specifications/speaker-validation)).
- Er is geen enkele methode overgedragen aan een gemeenschap onder de voorwaarden van een wedstrijd.

[Technische beperkingen](/docs/network/honest-limitations) is de volledige lijst van wat
niet wordt beweerd; waar deze pagina en die pagina verschillen, heeft die pagina voorrang.

## Zie ook

- [Inzendingsregels](/docs/network/leaderboard/rules) — wat wordt geaccepteerd,
  diskwalificatie, verificatie en reputatie.
- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — het register en
  de bijbehorende licentiestroken.
- [Een methode indienen](/docs/network/getting-started/submit-a-method) en de
  [Veelgestelde vragen](/docs/network/getting-started/faq).
- [Beoordeling](/docs/network/specifications/scoring),
  [Significantie](/docs/network/specifications/significance) en de
  [Runkaart](/docs/network/specifications/run-card).
- [Rekenkracht bijdragen](/docs/network/getting-started/contributing-compute) —
  voer items uit de openbare wachtrij uit met uw eigen sleutel.
