---
sidebar_position: 9
title: "Voer een Soevereine Wedstrijd Uit"
slug: /network/sovereignty/run-a-sovereign-contest
description: "Het zelfbedienings-, end-to-end traject voor een gemeenschap of organisatie om een MT-wedstrijd te houden op basis van een eigen afgesloten, achtergehouden corpus — zonder dat Champollion ooit de data of het prijzengeld beheert."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Een Soeverein Wedstrijdprogramma Uitvoeren

> **Samenvatting.** Een gemeenschap of organisatie kan een evaluatiewedstrijd uitvoeren — inclusief een gesponsorde prijs — op basis van een afgeschermd testcorpus dat **de eigen infrastructuur nooit verlaat**. U bouwt het corpus, versleutelt het, host het, en beheert de sleutels; het Netwerk registreert uitsluitend een inhoudsvrije metadatakaart en een cijfertekstdigest. Methoden kwalificeren zich eerst op publieke corpora; elke uitvoering tegen uw verzegelde set vereist toestemming van uw beheerders; alleen **scores** komen naar buiten. Prijsgelden zijn **in beheer van de sponsor** — uw organisatie of een door u aangewezen trust — en **Champollion raakt het geld noch de gegevens aan.** Deze pagina is het volledige, zelfbedienings-runbook.

:::warning[Wat vandaag beschikbaar is versus wat in ontwikkeling is]
Wees eerlijk met uzelf voordat u begint — dit is een evoluerend, niet-commercieel onderzoeksproject, en wij geven er de voorkeur aan dat u ons controleert in plaats van ons op ons woord te geloven:

- ✅ **Live:** corpusregistratie (metadatakaarten, hash-pinning, exposure lanes), het register voor verzegelde sets (digest + beheerdersgroep + kwalificatie, geen inhoud), het wedstrijdmechanisme met de verzegelde lane, de datalaag voor autorisatieverzoeken/-toekenningen/-audits (in afwachting → M-van-N-beslissing → eenmalig geldige tijdgebonden toekenning, append-only gehash-ketend auditlog) en alleen-scores-emissie afgedwongen op de databaselaag.
- ✅ **Live: de scorenode van de organisator.** Eén commando splitst uw corpus in een openbare dev-set (de kwalificatieset waarop deelnemers zichzelf beoordelen) en een verzegelde geheime set waartegen uw node inzendingen uitvoert, en verzegelt de geheime helft in rust op UW machine (`mt-eval contest prepare`). Het registreren van de verzegelde set(s), kwalificatie en wedstrijd verloopt via **selfservice vanaf uw eigen aanmelding** — `contest prepare --self-serve`, of `mt-eval contest register --manifest` voor een wedstrijd die u eerder hebt voorbereid — waarbij elke rij op databaselaag aan identiteit is gebonden; er is geen curator bij betrokken en er is geen bevoorrechte sleutel nodig (zie Stap 4 voor de eerlijke beperkingen).
- ✅ **Live: inzendingen zijn METHODEN, geen vertalingen.** Deelnemen aan een wedstrijd gebeurt door uw node iets te overhandigen dat deze kan UITVOEREN. Een deelnemer berekent zelf de score op de openbare dev-set (`mt-eval contest qualify`) om een ontvangstbewijs te verkrijgen, en dient vervolgens een model of een methode in; uw node voert de score van dat ontvangstbewijs opnieuw uit op zijn eigen kopie van de dev-set voordat een beheerder wordt gevraagd iets goed te keuren, en weigert bij een afwijking. De node kiest de lane op basis van de inzending:
  - **Lane A — declaratief model (voorkeur).** Een standaard neuraal model is DATA: `mt-eval contest submit-model` verstuurt safetensors-gewichten + een declaratieve tokenizer + een configuratie — **geen code, geen Dockerfile.** Uw node valideert dat het codevrij is (safetensors, geen pickle; geen `trust_remote_code`/`auto_map`; uitsluitend databestanden) en voert de gewichten uit in zijn EIGEN vertrouwde engine (`transformers`, `trust_remote_code=False`, offline). De architectuur is standaard permissief (elke architectuur die uw engine standaard laadt); een voorzichtige host kan een allowlist vastleggen. Er wordt niets onvertrouwds uitgevoerd, dus er hoeft niets gesandboxt te worden. Gepubliceerd `declarative-model`, methode-identiteit **door constructie codevrij**.
  - **Lane B — uitvoerbare bundel (sandbox-terugvaloptie).** Voor methoden die WEL code zijn: `mt-eval contest submit-method` verstuurt een Dockerfile + entrypoint. Nadat uw beheerder akkoord geeft, voert UW node deze uit binnen een netwerkgeïsoleerde container (`--network=none` — de netwerkstack bestaat binnenin niet; alleen-lezen root, ingetrokken privileges (dropped capabilities), gesaneerde omgeving), voorafgegaan door geautomatiseerde statische controles en waarbij referenties de container nooit betreden. Gepubliceerd `method-execution` met **uitvoeringsgeverifieerde** identiteit.
  Voor beide lanes geldt: de bundelhash wordt bevroren in het autorisatieverzoek (wat wordt uitgevoerd is bewijsbaar wat was voorgesteld) en scores worden gepubliceerd via hetzelfde pad dat uitsluitend aggregaten bevat. Voor maximale isolatie kan de scoremachine een echte airgap zijn: geautoriseerde verzoeken en Ed25519-ondertekende scores-only bundels worden overgebracht via verwisselbare media (`mt-eval node relay` / `import-bundle` / `export-scores`) — de geheime tekst bereikt zelfs de verbonden machine nooit. Wat deze lanes nog NIET omvatten: hardware-attestatie van de node (identiteit wordt zelf gerapporteerd), een formele geschillenprocedure, en — specifiek voor Lane B — diepere container-hardening buiten de verwijderde netwerkstack (seccomp-profielen, microVM's; dit is een reden om de voorkeur te geven aan Lane A). Zie [Eerlijke beperkingen](/docs/network/honest-limitations).
- ✅ **De beloftelaag is live (2026-09-07).** Inzendingsverklaringen (primair/contrastief, tracks), indieningsfasen, ingehouden resultaten (`hidden_until_close`) en de bevriezing die uw verklaarde beloften onbewerkbaar maakt zodra er inzendingen zijn, worden in de database op het netwerk-gehoste eindpunt afgedwongen. Een gefedereerde host krijgt dezelfde regels door de migratie toe te passen die bij de harness wordt meegeleverd; bij een ouder eindpunt valt de harness terug op de basisset en vermeldt dat expliciet (`declarations_available: false`) in plaats van te doen alsof. Waar in een onderstaande stap staat *de database bevriest / houdt in*, wordt dat letterlijk bedoeld.
- 🔲 **In ontwikkeling: drempelondertekening (threshold signing).** Voor een set verzegeld met `champollion seal-corpus` wordt M-van-N-beheerdersgoedkeuring *vastgelegd* in de autorisatie- en audittabellen, en is de verzegelingssleutel een gelabelde plaatsvervanger met één sleutelpaar (`champollion seal-corpus keygen`). Een set die is verzegeld op de offline node (`mt-eval node seal`) gebruikt de ingebouwde **sleutelceremonie** van de node (`mt-eval node ceremony`): de setsleutel wordt gesplitst volgens M-van-N en alleen in het geheugen opnieuw samengesteld tijdens een door quorum geautoriseerde run. Die ceremonie is nog nooit gebruikt met een echte beheerder, en de aandelen (shares) zijn in v1 gewone bestanden. Geen van beide paden heeft drempel*ondertekening*: de handtekening van de airgap-scorebundel is één enkele nodesleutel (`seal-corpus sign-keygen`).
- ❌ **Bestaat niet, per ontwerp:** Champollion die uw corpus host, uw sleutels bewaart of prijzengelden beheert. De bundel van een deelnemer (diens eigen model of code) passeert onze opslag onderweg naar uw node; uw corpusinhoud doet dat nooit.
- ❌ **Verwijderd in plaats van achtergelaten als valkuil.** `contest submit-hypotheses` (buiten gebruik gesteld op 2026-09-06) uploadde vertalingen van een bron-openbare blinde set; `contest submit` (buiten gebruik gesteld op 2026-09-06) koppelde een score die u zelf had gepubliceerd. Geen van beide is nog een geldig inzendingspad voor wedstrijden. Een bron-openbare blinde ronde bestaat alleen nog als optionele diagnostiek voor organisatoren, en zelfgerapporteerde scores horen nog steeds thuis op het openbare scorebord (leaderboard) — wat een openbaar bord is geïndexeerd op corpus en paarrichting, geen wedstrijd.

Als een onderstaande stap afhankelijk is van iets op de 🔲-lijst, vermeldt de stap dat expliciet.
:::

---

## De structuur van de overeenkomst

| Wie | Beheert | Beheert nooit |
|-----|---------|---------------|
| **U (gemeenschap/organisatie)** | Het corpus, de versleutelingssleutels (via uw beheerders), de prijsgelden, de toekenningsbeslissing | — |
| **Champollion / het Netwerk** | Een metadatakaart, een cijfertekstdigest, het autorisatie- en auditrecord, de gepubliceerde scores | Uw corpusinhoud, uw sleutels, uw geld |
| **Methode-ontwikkelaars** | Hun methode | Uw testgegevens — zij zien scores, nooit zinnen |

Alles hieronder is de mechanische uitwerking van die tabel.

---

## Vereisten voor organisatoren

Weet vóór stap 1 wat het uitvoeren van de node-zijde daadwerkelijk vereist:

- **De harness met de bijbehorende node-extra:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 of nieuwer; gebruik
  `python3 -m pip`, wat werkt in elke omgeving waarin de harness draait —
  een losse `pip` staat niet in elke virtuele omgeving op het `PATH`). De `[node]`-extra
  voegt de `cryptography`-bibliotheek toe die `mt-eval node keygen`, de beheerdersceremonie
  en het ondertekenen van scoremanifesten gebruiken. Een standaard
  `python3 -m pip install mt-eval-harness` mist deze, en die commando's stoppen en wijzen op
  deze installatie.
- **docker of podman** — vereist voor de methode-uitvoeringslane. De node
  detecteert automatisch docker en vervolgens podman (`sandbox.runtime` in `node.json` is standaard
  `null`; geef er daar een op om deze af te dwingen). Als geen van beide op het `PATH` staat,
  weigert `mt-eval node run-method` met één regel die beide noemt voordat er
  iets wordt uitgevoerd, en het verzoek blijft ongewijzigd zodat u het kunt uitvoeren zodra
  er een runtime is geïnstalleerd. Er is **geen terugvaloptie**. Containerisolatie met
  `--network=none` is de dragende garantie, dus er wordt niets uitgevoerd zonder een
  container-runtime.
- **Node.js 20.11+ en de `champollion` npm CLI** — de harness implementeert
  het verzegelingscijfer niet opnieuw. `champollion seal-corpus` (werkwoorden: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) is de enige
  cijferimplementatie (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), en de organisator-node
  roept deze aan.
- **Een node-configuratie op `~/.mt-eval/node.json`.** Elk `mt-eval node`-commando
  weigert te starten zonder deze configuratie. `mt-eval node init` schrijft daar een
  basisconfiguratie weg (`--print` toont deze alleen). Deze bevat uw zelfgerapporteerde `node_id`
  (vastgelegd in elke vingerafdruk van een verzoek) en een `contests`-toewijzing die verwijst naar uw
  dev-set, uw verzegelde set (`secret_set_id` + `secret_artifact`), uw verzegelde
  holdout als u die hebt voorbereid (`holdout_set_id` + `holdout_corpus`; verwijder
  beide sleutels als u dat niet hebt gedaan) en de openbare kwalificatiepoort (qualifier gate) (`qualifier` +
  `dev_corpus`, de drempelwaarde op de kwalificatieschaal van 0–100). Zodra u
  `contest prepare` hebt uitgevoerd (Stap 1), schrijft `mt-eval node init --from-contest ./mytask`
  de basisconfiguratie weg waarbij de waarden van de wedstrijd al zijn ingevuld op basis van
  `./mytask/local/manifest.json`, en geeft een overzicht van wat er voor u overblijft. De toewijzing
  die wordt toegepast (vul eventueel handmatig in):

  | `local/manifest.json` | `node.json` (onder `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (beide verwijderd wanneer er geen holdout is) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (dezelfde namen) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: het exemplaar dat `contest prepare` heeft gelezen (`--test-suite <id>=<path>`, of een gevonden exemplaar), wanneer het op deze machine aanwezig is met de vastgezette bytes; anders stelt u `corpus_path` in |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` voor een set die is verzegeld naar één sleutelpaar (stel vervolgens `secret_privkey` in), `threshold-quorum` voor een ceremonie |
  | `registration.prize_terms` (vastgelegd door `contest prepare` en `contest register`) | `prize_terms_sha256`: de SHA-256 van de voorwaarden, de hash die deelnemers doorgeven aan `--accept-terms` (weggelaten wanneer de wedstrijd geen prijs declareert) |

  Het wedstrijd-id is de `--slug` die u aan `contest prepare` hebt opgegeven (`mytask` in het
  onderstaande voorbeeld). Prepare legt dit vast in het manifest, de registratie maakt
  de wedstrijd daaronder aan, en het is het id dat deelnemers doorgeven aan `contest qualify`
  en `submit-method`; kondig het daarom aan bij de dev-release; `--contest-id`
  overschrijft het. (Een manifest dat is geschreven voordat het id werd vastgelegd, behoudt het id
  dat de registratie heeft afgeleid van de naam, `"My Task 2026"` → `my-task-2026`,
  omdat de wedstrijd, ontvangstbewijzen en node-configuraties dat al gebruiken.) Geen enkel
  manifest kent `node_id`, `cards_dir`, `signing_key` of uw privésleutelbestand,
  dus die blijven staan als `<...>` zodat u ze kunt invullen.
  `mt-eval node ledger verify` controleert dit vervolgens en meldt wat er is gecontroleerd: het
  laadt de configuratie (custody, de gehele kwalificatiepoort, het holdout-paar, de
  lokale kaartenindex), weigert de eerste waarde die nog een `<...>`-placeholder
  is of een gedeclareerd bestand dat zich niet op deze machine bevindt, print de sets
  en bestanden van elke wedstrijd, en speelt pas daarna de hash-keten van het
  autorisatiegrootboek na (nul vermeldingen op een nieuwe node).
- **Een lokale taalkaartenindex die de node bijhoudt.** Scoring benoemt het
  taalpaar van de run, en de node zoekt een taal nooit op via het netwerk.
  Verwijs `cards_dir` in `node.json` naar een map met een kaart voor elke
  taal die uw node beoordeelt (of stel `MT_EVAL_CARDS_DIR` in); een node zonder lokale
  index weigert te starten in plaats van er een op te halen. Geen van beide geïnstalleerde
  pakketten levert een kaartenmap per taal mee, dus maak er een aan op een verbonden
  machine met de `champollion` CLI, één `<code>.json`-bestand per taal van
  uw paar:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Stel `"cards_dir"` vervolgens in op het absolute pad van die map. Voor een
  air-gapped node neemt u deze mee in de offline bundel
  (`mt-eval node bundle --out <dir> --include node-cards`); deze wordt geplaatst op
  `<dir>/artifacts/node-cards`, en `cards_dir` verwijst daarheen op de node.
- **Een aanmelding.** Er is geen aparte stap voor het aanmaken van een account: het eerste commando
  dat een identiteit vereist (bijv. `mt-eval contest prepare --self-serve` of
  `mt-eval publish`) opent een OAuth-aanmelding in de browser via **GitHub of Google**
  (Supabase Auth). Het e-mailadres van dat account is de identiteit waaraan elke registerrij is
  gekoppeld — gebruik een account dat uw organisatie beheert.
- **De instroombeperking (intake throttle).** Inzendingen van deelnemers zijn per
  indiener beperkt tot **standaard 5 per 24 uur** (tegen probing; per wedstrijd in te stellen
  met `--intake-daily-limit` tijdens het voorbereiden, of als standaardwaarde
  voor een shared-task-editie). Houd hier rekening mee in de tijdlijn van uw wedstrijd.

**Eén eerlijke kanttekening over selfservice-registratie.** Op het **standaard
door het netwerk gehoste eindpunt** stopt selfservice-registratie (`contest prepare
--self-serve` / `contest register`) momenteel bij een beveiliging op het productie-eindpunt:
de CLI weigert met een expliciet bericht in plaats van naar het
productieproject te schrijven, in afwachting van een beleidsbeslissing over het openstellen hiervan. Gefedereerde
hosts (uw eigen Supabase-project) worden niet beïnvloed. Als u op de standaardhost
tegen deze beveiliging aanloopt, is dat de huidige status en geen
onjuiste configuratie aan uw kant — [open een issue](https://github.com/gamedaysuits/Champollion/issues)
en we begeleiden de registratie samen met u.

---

## Stap 1 — Bouw uw afgeschermd testcorpus

Ontwerp het corpus waaraan u wilt meten, en houd het vanaf dag één afgeschermd: niets erin mag ooit zijn gepubliceerd, geplaatst of gedeeld met een modelleverancier.

- Volg het [Corpus Design Framework](/docs/network/specifications/corpus-design) voor invoerstructuur, moeilijkheidslagen en registerdekkking, en het [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) voor tooling.
- Laat vermeldingen controleren door vloeiende sprekers vóór verzegeling — het [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) beschrijft een beoordelingsstructuur die u kunt hergebruiken voor corpus-QA, niet alleen voor methodebeoordeling.
- Bepaal nu het **versie**label van het corpus (bijv. `v1`). Autorisatieverleeningen zijn gebonden aan een specifieke versie, dus versiebeheer is onderdeel van het beveiligingsmodel, niet van de administratie.

### Hoe het corpus wordt gesplitst

Eén commando neemt uw hoofdcorpus en produceert elk niveau, deterministisch
op basis van een seed die u kiest en vastlegt:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` is de score die een methode moet behalen op de openbare dev-set
voordat uw node deze zal uitvoeren op de verzegelde set en de verzegelde holdout. Deze
waarde bevindt zich op de **kwalificatieschaal van 0–100**: de kwalificatiescore is **corpus-chrF++**
(sacreBLEU chrF, `word_order=2`) van de dev-uitvoer ten opzichte van de vrijgegeven dev-referenties —
de hoofdstatistiek van de scorestandaard, en hetzelfde getal dat een
`mt-eval run`-kaart als hoofdwaarde toont voor dezelfde uitvoer. Er wordt niets anders in
gemengd; exacte overeenkomst (exact match) wordt daarnaast getoond als diagnostiek en fungeert nooit als poort. Uw
node berekent hetzelfde getal wanneer deze een methode opnieuw uitvoert, zodat het ontvangstbewijs
van een deelnemer en de meting van uw node vergelijkbaar zijn.

Stel de drempelwaarde in op basis van chrF++-scores die u op deze dev-set hebt gemeten (voer
`contest qualify` uit op de dev-uitvoer van een baseline), niet op basis van scores op andere
evaluatiesets: chrF++-niveaus verschillen sterk tussen talen en corpora.
Een kwalificatie die vóór de
[scorestandaard](/docs/network/specifications/scoring#how-runs-are-scored)
is geregistreerd met de inmiddels verouderde composietscore als statistiek, werkt nog steeds: de drempelwaarde wordt gelezen
op de chrF++-schaal, en qualify vermeldt dit elke keer, dus bevestig het getal of
roteer naar een nieuwe kwalificatie.

`--license` is verplicht. Deze vlag specificeert de licentie waaronder de vrijgegeven dev-set wordt
aangeboden, en mt-eval kiest er nooit zelf een voor u. Het vrijgegeven bestand bevat deze als
`dataset.license`, wat wordt gelezen door `mt-eval run`, `contest qualify` en
`publish`, zodat de runs van een deelnemer worden gereguleerd door uw licentie. Gebruik de toekenning van de
rechthebbende zelf als SPDX-id. Met `CC-BY-4.0` mogen deelnemers evalueren met elke modeldienst.
Bij een niet-commerciële licentie zoals `CC-BY-NC-4.0` draaien externe modellen uitsluitend
via kanalen die training uitsluiten. Met uw eigen voorwaarden (`LicenseRef-<name>`) wordt externe
evaluatie geweigerd totdat de toestemming van de rechthebbende is vastgelegd, zodat
deelnemers lokale modellen gebruiken.

De vrijgegeven bestanden vermelden ook de overige voorwaarden van het hoofdcorpus, gelezen van de
eigen kaart van het hoofdcorpus (de corpuskaart die `champollion network register-corpus`
heeft weggeschreven via de `<file>.champollion.json`-sidecar) en de eigen envelop:
`dataset.do_not_train` en, wanneer het hoofdbestand is gemarkeerd als uitsluitend lokaal,
`dataset.transmission: "local-only"` (deelnemers mogen de dev-set dan alleen uitvoeren
met een model op hun eigen machine), waarbij `dataset.terms_from` vermeldt waar
elk element vandaan komt. Wanneer de kaart van het hoofdcorpus geen trainingsvoorwaarde vermeldt, geeft u
`--do-not-train true` of `false` op; de vlag kan de voorwaarde van het hoofdcorpus aanscherpen,
maar nooit versoepelen (`--do-not-train false` op een `doNotTrain: true`-hoofdcorpus wordt
geweigerd). prepare print deze voorwaarden en waarschuwt wanneer de kaart van het hoofdcorpus vermeldt dat
herdistributie verboden is: het vrijgeven van `public/` is herdistributie, dus geef
het pas vrij zodra de rechthebbende akkoord is.

| Split | Wie het ziet | Waar het voor dient |
|-------|--------------|---------------------|
| **Openbare dev-set** (`--dev-size`) | iedereen — bron *en* referenties worden vrijgegeven | de **kwalificatie**: deelnemers scoren hierop eerst zelf voordat ze überhaupt mogen inzenden (Stap 8) |
| **Verzegelde set** (`--secret-size`) | niemand behalve uw node — bron *en* referenties blijven versleuteld | waarop een inzending daadwerkelijk wordt beoordeeld |
| **Verzegelde holdout** (`--sealed-holdout-size`, optioneel) | niemand behalve uw node | een **tweede** verzegelde split, gescoord in dezelfde run, waarvan de scores worden ingehouden totdat u de wedstrijd sluit |
| *Blinde set* (`--blind-size`, standaard 0) | bron vrijgegeven, referenties ingehouden | een optionele eigen diagnostische ronde. Het is **geen** inzendingspad: deelnemen aan een wedstrijd gebeurt door een methode te overhandigen, nooit door vertalingen te uploaden |

De splits zijn disjunct en reproduceerbaar: hetzelfde corpus, dezelfde seed, dezelfde split,
voor altijd. Het recept blijft in een voor de organisator lokaal manifest dat uw machine
nooit verlaat.

**Herhaalde zinnen blijven aan één kant.** De split is groepsdisjunct
(`group-disjoint/1`, vastgelegd in het `split`-blok van het manifest): rijen die een
bron of referentie delen, exact of na normalisatie van hoofdlettergebruik, interpunctie en
spaties, vormen één groep, en een groep komt in zijn geheel in één split terecht. Geen enkele verzegelde
rij herhaalt dus een rij uit de vrijgegeven dev-set. De groepen worden geschud met uw
seed en geplaatst als dev, blind, secret, holdout in die volgorde; een hoofdcorpus zonder
herhaalde zinnen krijgt exact dezelfde split als een rij-voor-rij-shuffling oplevert. Als gehele
groepen de door u gevraagde groottes niet kunnen vullen, weigert prepare, met vermelding van het aantal
herhaalde rijen en de oplossing: verwijder de herhalingen (behoud één rij per groep),
of vraag om een totaal dat onder de omvang van het hoofdbestand ligt, zodat sommige groepen kunnen worden weggelaten.

**`public/` is vrij te geven; runlogs gaan naar `runs/`.** prepare schrijft een markeerbestand,
`.champollion-releasable.json`, in `public/`. Runlogs, rapporten en
vertalingscaches worden daar nooit naartoe geschreven: `mt-eval run` weigert een
`--output-dir` of `--cache-dir` daarbinnen en wijst in plaats daarvan naar `runs/` daarnaast
(`<out>/runs/`), en `run_benchmark` van de MCP-server plaatst een run op
de vrijgegeven dev-set (de baseline die u uitvoert om de drempelwaarde te bepalen) zelfstandig in `runs/`
en meldt dat expliciet. Een wedstrijd die is voorbereid voordat de markering bestond, wordt
herkend aan de indeling (`public/` naast `local/manifest.json`).

**Waarom een holdout.** Op een enkele verzegelde set kan tijdens een lange
wedstrijd nog steeds gefinetuned worden — elke inzending is een sondeeractie (probe), en genoeg probes lekken altijd iets. Een tweede
split die in dezelfde geautoriseerde run wordt gescoord, maar waarvan niemand de getallen ziet
tot aan de sluiting, geeft u aan het einde een zuiver beeld: als de rangorde van een systeem verschuift tussen
de twee, leert u iets over hoeveel daarvan tuning was en hoeveel daadwerkelijke
vertaalkwaliteit. Beide sets vallen onder **één** autorisatie, dus het kost uw
beheerders geen extra ceremonies.

**Testsuites van derden.** `--test-suite` benoemt een openbaar diagnostisch corpus —
van iemand anders, via sha vastgezet en openbaar te downloaden — waarop elke inzending ook
wordt uitgevoerd. Die cijfers worden **gerapporteerd en nooit gerangschikt**: ze zijn bedoeld zodat een
lezer kan zien of een sterke score op de verzegelde set ook standhoudt op een set die niet door uw
wedstrijd is ontworpen. Champollion weigert een suite die in quarantaine staat,
niet is vastgezet (unpinned), niet voor uw taalpaar is bedoeld, of een van uw eigen splits is.

**Een verzegelde rij die al openbaar is, is niet verzegeld.** `contest prepare`
vergelijkt uw verzegelde set en verzegelde holdout met alles wat openbaar is: de dev-set
die wordt vrijgegeven (de hierboven beschreven groepsdisjuncte split houdt dit op nul), de
eventuele vrijgegeven blinde brontekst en elke gedeclareerde testsuite. De vergelijking gebeurt
exact en na normalisatie van hoofdletters, interpunctie en spaties (dezelfde
vergelijking waarop de split groepeert), toont vervolgens elke overlap met een telling (bijvoorbeeld
"30 of 30 rows also appear in test suite …") en legt de tellingen
vast in `local/manifest.json`. Bij een suite van derden volgt een waarschuwing in plaats van een
weigering: de suite is de openbare tekst van iemand anders, en u beslist zelf of u
die rijen uit het hoofdcorpus verwijdert of de suite laat vallen en opnieuw voorbereidt. Om een suite te controleren heeft prepare de
zinnen ervan nodig. Het gebruikt een kopie die al op uw machine staat en downloadt
nooit tijdens de voorbereiding. Geef uw kopie op met `--test-suite <id>=<path>`; de
sha256 hiervan moet overeenkomen met de vastgelegde hash in het register. Als er geen kopie wordt gevonden, meldt de waarschuwing dat
de suite **niet is gecontroleerd**, nooit dat deze schoon was. Het manifest legt
het pad vast van elke kopie die prepare heeft gelezen, zodat `node init --from-contest`
uw node ernaar kan verwijzen.

Uw gedeclareerde holdout en testsuites worden beloften: zodra de eerste inzending binnenkomt,
bevriest de wedstrijd deze, zodat u halverwege de wedstrijd geen testsuite meer kunt toevoegen of verwijderen.

## Stap 2 — Versleutel het en host het op UW infrastructuur

Versleutel het corpus in rust (elk modern AEAD-schema — bijv. `age`/x25519 of AES-256-GCM) en host de **cijfertekst** ergens dat u beheert. Champollion ontvangt nooit de leesbare tekst *noch* de cijfertekst.

Publiceer precies één artefact: de **SHA-256-digest van de cijfertekstblob**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

De digest is openbaar; de gegevens zijn dat niet. Iedereen kan later verifiëren dat de geëvalueerde blob byte-identiek is aan de blob die u heeft verzegeld — integriteit zonder bezit. Dit is dezelfde hash-in-plaats-van-kopie-discipline als bij [gewone corpusregistratie](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Stap 3 — Registreer de metadatakaart

Registreer het corpus via de standaard, fail-private [registratiestrook](/docs/network/sovereignty/registering-corpora): een kaart met `language_pair`, `license`, `attribution` en `do_not_train` — **geen zinnen**. Kies de **privé**-blootstellingsstrook; de verzegelde-setregistratie in de volgende stap maakt het wedstrijdgeschikt.

## Stap 4 — Registreer het als een verzegelde set

Een verzegelde set is een inhoudsvrije registervermelding die drie zaken openbaar vastlegt:

| Veld | Waartoe het u verbindt |
|------|------------------------|
| `ciphertext_digest` | De exacte bytes die gelden als "het corpus" |
| `custodian_group_id` | Een ondoorzichtig id voor de groep die de toegang beheert (nooit een publieke organisatie-/volksnaam vóór toestemming) |
| `current_qualifier_id` | De publieke ronde die een methode moet halen voordat een verzegelde uitvoering zelfs maar kan worden voorgesteld |

Registratie is **zelfbediening, vanuit uw eigen aanmelding** — geen curator in de lus en geen bevoorrechte sleutel:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

Het manifest blijft op uw machine — de registratie verzendt uitsluitend de inhoudsloze
id's, digests en drempelwaarden. U kunt exact nalezen wat er wordt verzonden voordat
er iets weggaat: `contest prepare --no-register` print het registratieplan,
elke rij die `contest register` zal wegschrijven, in volgorde — het id van elke verzegelde set en
de SHA-256 van de bijbehorende cijfertekst (met het aantal rijen dat verzegeld op uw machine blijft),
de beheerdersgroep, het kwalificatie-id en de drempelwaarde, de wedstrijdrij met de
vastgelegde beloften, de beleidskolommen en eventuele holdouts, testsuites en prijsvoorwaarden
samengevoegd in de metadata van de wedstrijd. Het plan wordt opgebouwd door dezelfde code
die de rijen verzendt, waardoor het onmogelijk iets anders kan beschrijven dan wat er daadwerkelijk wordt verzonden.
Elke registerrij is **aan identiteit gebonden**: de
database legt het aangemelde account vast dat de registratie heeft uitgevoerd en bevriest die
koppeling tegen latere bewerkingen, en een kwalificatie mag alleen dienen als poort voor een verzegelde set die door **dezelfde**
identiteit is geregistreerd. Verzegelde sets worden standaard in quarantaine aangemaakt (ze kunnen nooit
dienen als basis voor een reguliere wedstrijd of een positie innemen op het openbare scorebord), kwalificaties worden
aangemaakt in een veilige status en registraties zijn onderhevig aan rate limits — dit alles wordt afgedwongen via
databasetriggers onder elke client, inclusief de onze. Het register zelf is
openbaar leesbaar, zodat u kunt controleren of uw registratie exact vermeldt wat u hebt verzegeld —
en niets meer dan dat.

**Eerlijke beperkingen.** De selfservice-ingang is uitsluitend bedoeld voor registratie (insert-only op
de databaselaag). **Kwalificatierotatie en het buiten gebruik stellen van verzegelde sets blijven
onder toezicht van een curator** — open een issue of neem contact op met het project via
[GitHub](https://github.com/gamedaysuits/Champollion/issues). En het uitvoeren van de scorenode van de organisator
in latere stappen (levenscycluswijzigingen, autorisatietoekenningen, auditbewerkingen)
is een apart traject met service-inloggegevens op uw eigen node —
selfservice stopt bij de openbare registratie.

## Stap 5 — Kies beheerders en de M-van-N-regel

Kies de personen of instellingen die gezamenlijk elke evaluatie van uw corpus moeten goedkeuren, en de drempelwaarde (bijv. **3 van 5**). Beheerders dienen verantwoording af te leggen aan uw gemeenschap, niet aan Champollion — zie [Gegevensbeheer](/docs/network/sovereignty/data-sovereignty) en [Eigendom & Voorwaarden](/docs/network/sovereignty/ownership-transfer) voor de manier waarop per-gemeenschapsvoorwaarden worden vastgesteld.

**Transparantie:** drempel*ondertekening* (een toekenning die letterlijk niet kan worden aangemaakt
zonder M handtekeningen) is **in ontwikkeling**. De sleutelceremonie van de offline node
(`mt-eval node ceremony`, Shamir M-van-N) is gebouwd, maar is nog niet
gebruikt met een echte beheerder. Verder wordt de M-van-N-regel gehandhaafd als een vastgelegd
proces: elk toegangsverzoek
komt in een wachtrij met de status **in behandeling** (pending), beslissingen van beheerders worden geregistreerd, een toekenning wordt uitsluitend
aangemaakt voor een geautoriseerd verzoek, elke toekenning is **eenmalig bruikbaar, tijdgebonden en
gekoppeld aan één specifieke vingerafdruk van (methode, corpusversie, evaluatienode)**,
en elke gebeurtenis — inclusief geblokkeerde pogingen — belandt in een **append-only,
gehash-ketend, openbaar leesbaar auditlog**. De database weigert ongeoorloofde statusovergangen
onder elke client en sleutel. Wat het momenteel nog niet kan tegenhouden, is een
inbreuk op de platformbeheerder zelf — dat is wat drempelondertekening
oplost, en totdat dat beschikbaar is, dient u "Champollion bewaart nul sleutelaandelen"
te beschouwen als het ontwikkeldoel waarnaartoe wordt gewerkt, niet als een eigenschap die u vandaag al kunt verifiëren.

## Stap 6 — Bepaal de prijs en declareer de voorwaarden

Een prijs is optioneel. **Een wedstrijd zonder gedeclareerde prijsvoorwaarden heeft simpelweg geen
prijs** — dat is de standaard, en het maakt de wedstrijd er niet minder om.

Als u wel een prijs aanbiedt, bepaal deze dan en publiceer samen met de wedstrijd:

- **Bedrag en valuta.**
- **Sponsor** — wie het geld beschikbaar stelt.
- **Waar de fondsen worden ondergebracht** — de rekening van uw organisatie of een community trust
  die u aanwijst. **Champollion beheert, bewaart of routeert nooit prijzengelden.**
  Het vooraf publiceren van de identiteit van de beheerder is wat de prijs geloofwaardig maakt;
  zie de [risiconotitie over sponsorwanbetaling](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  in de voorwaardentemplates.
- **Drempelvoorwaarden** — de minimale score die een methode moet behalen, opgesteld
  volgens de [Prijsspecificatie](/docs/network/specifications/prizes): een chrF++-drempelwaarde,
  eventuele gewenste diagnostische poorten (zoals een minimale FST-acceptatie —
  een poort waar een inzending aan moet voldoen, nooit de score zelf), vereisten voor
  sprekervalidatie, reproduceerbaarheid. Zorg dat de toekenningsvoorwaarden
  verifieerbaar zijn aan de hand van de gepubliceerde scores, zodat niemand op uw woord
  (of het onze) hoeft te vertrouwen om te zien of de lat is gehaald.
- **De prijsvoorwaarden** — wat er met de inzending zelf gebeurt.

### De prijsvoorwaarde is aan u om te kiezen

De uitvoering staat vast: in een soevereine wedstrijd overhandigt de deelnemer een model of een
methode en voert uw node deze uit. Wat er *daarna* mee gebeurt, is uw keuze,
en wel één uit drie:

| De voorwaarde | Wat u aan deelnemers communiceert |
|---|---|
| `pass_to_holders` — *overdragen aan beheerders* | De methode gaat over naar u, de soevereine benchmarkhouders. U scoort deze en behoudt deze, ongeacht wie er wint. |
| `retain_ip` — *IP behouden* | De deelnemer behoudt het eigendom. U scoort de inzending en bewaart hoogstens een verzegelde kopie voor auditdoeleinden. |
| `release_open` — *open vrijgeven* | De deelnemer behoudt het eigendom, maar moet de methode onder een open licentie publiceren. Die vrijgave is de voorwaarde voor de prijs. |

De details vloeien voort uit de voorwaarde, er hoeft dus geen matrix te worden ingevuld: wat u
behoudt (`retention`), of er rechten overgaan (`rights`), waarvoor u het mag gebruiken
(`host_use`) en of de deelnemer verplicht is te publiceren (`release`) worden allemaal
**afgeleid** van de door u gekozen optie. Twee van de opties bieden de mogelijkheid om één
veld nader te specificeren:

- onder `retain_ip` vernietigt `--prize-retention delete_after_scoring` het artefact zodra het is gescoord (standaard wordt een verzegelde auditkopie bewaard);
- onder `release_open` verplaatst `--prize-release-timing` de vrijgave naar `required_before_scores` of `required_after_prize` (standaard is `required_before_prize`), en benoemt `--prize-release-license` de licentie in plaats van elke door het OSI goedgekeurde licentie te accepteren (`any_osi`).

De volledige afgeleide tabel, en hoe elke optie wordt geverifieerd vóór uitbetaling, vindt u in
de [Prijsspecificatie §2.1, voorwaarde 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Welke optie u ook kiest, de voorwaarde wordt in duidelijke taal aan u getoond met
een **SHA-256** voordat er iets wordt vastgelegd. Die hash is het acceptatietoken:
een deelnemer geeft `--accept-terms <hash>` door, de acceptatie wordt ingepakt in diens
bundel en gedekt door de bijbehorende content-hash, en uw node weigert een bundel die
iets anders heeft geaccepteerd. De voorwaarde bevriest op het moment dat uw wedstrijd de eerste
inzending ontvangt, zodat niemand kan worden gehouden aan voorwaarden die nooit zijn gelezen.

Financiële middelen maken bewust *geen* deel uit van de voorwaarde: het bedrag, de valuta en de
sponsor vormen wedstrijdinformatie, en een voorwaarde over wie eigenaar is van een methode is een
ander soort verklaring dan een voorwaarde over hoeveel er wordt uitgekeerd.

## Stap 7 — Maak de wedstrijd aan

Wedstrijden over verzegelde sets gebruiken de expliciete **verzegelde strook**. Geschiktheid is fail-closed: de wedstrijd wordt geweigerd tenzij uw verzegelde-setregistratie bestaat en actief is — en het aanmaken van de wedstrijd verleent **niemand** toegang tot het corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Twee van deze vlaggen worden vastgelegd of bevroren door de database, wat u
daarna ook doet, en nog eens drie zijn **beloften**:

- `--use-context` maakt deel uit van de identiteit van de wedstrijd: dit ligt vast zodra
  de wedstrijd is geregistreerd en kan nooit meer worden gewijzigd (maak in plaats daarvan
  een nieuwe wedstrijd aan). De standaardwaarde is `non-commercial`.
- `--primary-metric` (standaard `chrf_plus_plus`), de metriek die de rangschikking gebruikt,
  wordt bevroren zodra de wedstrijd de eerste inzending heeft ontvangen. Een nieuwe wedstrijd die de
  verouderde `composite` vermeldt, wordt geweigerd met opgave van reden; wedstrijden die vóór
  de [scorestandaard](/docs/network/specifications/scoring#how-runs-are-scored) zijn geregistreerd,
  blijven functioneren.
- `--visibility` (standaard `public`), `--description` en of de instroom
  openstaat, worden niet bevroren.

De drie beloften worden bevroren op het moment dat uw wedstrijd de eerste inzending ontvangt:

- `--prize-disposition` / `--prize-terms` — de voorwaarde uit Stap 6. Laat beide weg en
  de wedstrijd heeft geen prijs.
- `--results-visibility hidden_until_close` — elke score die uw node meet,
  wordt **ingehouden** totdat u de wedstrijd sluit, zodat niemand op basis van diens eigen resultaten
  kan finetunen tegen de verzegelde set. Dit is de standaard; in het voorbeeld wordt dit expliciet vermeld
  zodat de belofte zichtbaar is in uw eigen aantekeningen. Geef
  `--results-visibility immediate` op als u in plaats daarvan een live scorebord wilt, waarbij elke
  kaart wordt gepubliceerd zodra uw node deze afrondt.
- `--anonymize-until-close` — deelnemers verschijnen onder stabiele pseudoniemen in uw
  rangschikking zolang de wedstrijd openstaat. (Dit betreft uw weergave van de rangschikking; het
  anonimiseert een kaart niet zodra deze op het openbare scorebord wordt gepubliceerd.)

Dezelfde drie vlaggen zijn beschikbaar op `contest prepare` en `contest register`,
waar de meeste organisatoren ze zullen instellen, omdat die routes de
wedstrijd voor u aanmaken. Met `contest prepare --no-register` worden de registratievlaggen
die u meegeeft (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, de prijsvlaggen, `--visibility`, `--use-context`,
`--closed-intake`) vastgelegd in `local/manifest.json`, en
`contest register --manifest` past deze toe tenzij u eigen vlaggen meegeeft,
waarbij wordt aangegeven wanneer een geregistreerde waarde wordt vervangen. Prepare toont elk van
deze voorwaarden met de bijbehorende waarde — of u deze nu hebt opgegeven of dat het de standaardwaarde is — en
het moment waarop deze niet meer kan worden gewijzigd, voordat er iets wordt geregistreerd. De
`--help` vermeldt elke standaardwaarde.

*(De `--corpus`-waarde is uw geregistreerde `sealed_set_id`. De verzegelde strook wordt **automatisch** geselecteerd op basis van de verzegelde-setregistratie — geen extra vlag; een verzegelde set kan nooit een gewone wedstrijd ondersteunen, en een gewone in quarantaine geplaatste dataset kan nooit een wedstrijd ondersteunen. Beide regels worden afgedwongen in de database, onder elke client. Als u in Stap 4 heeft geregistreerd met `contest register` of `prepare --self-serve`, **bestaat de wedstrijdrij al** — sla deze stap over; `contest create` handmatig is alleen voor het samenstellen van een wedstrijd vanuit een reeds geregistreerde verzegelde set.)*

## Stap 8 — Methoden kwalificeren zich eerst in het openbaar

Ontwikkelaars bouwen en scoren hun methoden op de **openbare dev-set** die u hebt vrijgegeven
in Stap 1. De `current_qualifier_id` van uw verzegelde set specificeert die ronde, en een
methode moet de drempelwaarde halen voordat een verzegelde run überhaupt kan worden aangevraagd. Dit
voorkomt probe-druk op uw corpus: niemand kan zich op de verzegelde set richten
zonder eerst openbaar reële prestaties te hebben aangetoond.

Een deelnemer voert dit zelfstandig offline uit, met één commando:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

Het kwalificatie-id en de drempelwaarde zijn de twee gegevens die de scoreberekening van
u nodig heeft, dus publiceer beide bij de release van de dev-set. Voor een wedstrijd die is aangemaakt met `contest
prepare`, is het kwalificatie-id het eigen id van het dev-corpus (de
`dataset.corpus_id` ervan), en prepare schrijft de drempelwaarde in de beschrijving
van het dev-corpus. Zonder de twee `--offline-…`-vlaggen leest qualify deze gegevens uit de
wedstrijddatabase. Dat werkt pas zodra de wedstrijd is geregistreerd op
het eindpunt waar de deelnemer naar verwijst. Als de wedstrijd daar niet staat, of de database
niet bereikbaar is, stopt qualify en print het bovenstaande offline commando, ingevuld
met de argumenten van de deelnemer zelf.

`--dev` accepteert de vertalingen van de deelnemer voor de dev-set regel voor regel in
corpusvolgorde, als JSON met entry-id als sleutel, of als het runlogbestand dat `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`). Een runlogbestand wordt gelezen op
basis van entry-id en gecontroleerd op uitvoering tegen ditzelfde dev-corpus; een bestand met foutieve
vermeldingen wordt geweigerd, omdat elke regel wordt gescoord. De samenvatting vermeldt vervolgens dat
de uitvoer door de harness is gegenereerd in die run en opnieuw is gescoord vanuit het bijbehorende bestand
(inclusief de kosten van die run), nooit dat deze buiten de harness is gemaakt; alleen
een regulier hypothesebestand wordt op die manier beschreven.

**Slagen is nog geen inzending.** Na het eindoordeel geeft qualify aan wat er
al vastgesteld kan worden over het inzenden. Bij een run van een methode-plugin waarvan de map
op de machine staat, voert het dezelfde statische scan uit als `submit-method` en uw node
(netwerkbibliotheken, shell-netwerkhulpmiddelen, verboden bestandssysteempaden) en
toont alles wat geweigerd zou worden, zoals een plugin die `urllib` importeert
om een modelserver aan te roepen. Bij een run van het eigen LLM-pad van de harness (een model
benaderd via een provider) meldt het dat er in deze vorm geen methode is om in te dienen:
de node voert een inzending uit zonder netwerk, dus het model moet in de bundel worden meegeleverd
(zie *Bundel elk model dat uw methode aanroept* hieronder). Anders vermeldt de slagingsregel
de controles die bij het inzenden nog volgen. Niets hiervan verandert
het oordeel of het ontvangstbewijs.

Het toont de kwalificatiescore (wat als toegangspoort fungeert) en de drempelwaarde naast elkaar,
beide op de chrF++-kwalificatieschaal van 0–100, gevolgd door wat de score inhoudt: corpus-chrF++
met de bijbehorende sacreBLEU-handtekening, de overige standaardmetrieken ernaast
(nooit gemengd), exacte overeenkomst als diagnostiek die nooit als poort dient, en eventuele
score-kanttekeningen. Qualify publiceert niets. Een systeem waarvan de dev-uitvoer
grotendeels bestaat uit kopieën van de brontekst, wordt geweigerd ongeacht de score:
wanneer de helft of meer gelijk is aan de bron (waarbij hoofdletters, accenten en interpunctie
worden genegeerd, en regels waarvan de referentie identiek is aan de bron, zoals
namen, buiten beschouwing worden gelaten), vertaalt de deelnemer niet echt. Dezelfde regel weigert het opnieuw
wanneer uw node de methode herhaalt. Dit schrijft een **kwalificatie-ontvangstbewijs** op de
machine van de deelnemer, waar `submit-model` en `submit-method` niet buiten kunnen om
een inzending samen te stellen. Ontvangstbewijzen worden bewaard per wedstrijd en per systeem (`--system`),
zodat een deelnemer die twee systemen kwalificeert, beide bewaart; het opnieuw kwalificeren van hetzelfde
systeem behoudt het eerdere ontvangstbewijs ernaast. `submit-method` en
`submit-model` gebruiken het ontvangstbewijs voor `--system` (standaard: dat voor `--name`,
anders het enige ontvangstbewijs van de wedstrijd) en weigeren, met vermelding van de lijst, wanneer dit
dubbelzinnig is. Het ontvangstbewijs is
per definitie zelfgerapporteerd — en is dus niet wat de uiteindelijke toegang bepaalt. Voordat er een toekenning
wordt geclaimd, **voert uw node de ingezonden methode opnieuw uit op dezelfde dev-set** en
vergelijkt de eigen meting met de claim; een ontvangstbewijs dat de prestaties van de methode overdrijft,
wordt op dat punt afgewezen, waarbij de geclaimde versus gemeten score in de weigering wordt vermeld.

**Een ontvangstbewijs vermeldt de run waaruit het voortkwam.** Wanneer `--dev` een runlog is (of diens
`_report.json`), legt het ontvangstbewijs de run vast en het model dat werd uitgevoerd: voor
`mt-eval run --method local-model -m <model>` het Hugging Face-id en
de revisie, of de modelmap met een SHA-256 over de bijbehorende bestanden. Een
`local-model`-runlog dat geen model vermeldt, wordt geweigerd — eerdere 0.2.0-builds
gaven `-m` niet door aan die engine, die vervolgens teruggreep op een Engels→Spaans
fallback-model. `submit-model` controleert vervolgens of de gewichten die het inpakt
zich bevinden onder de bestanden die het ontvangstbewijs noemt, en weigert, met vermelding van beide hashes, wanneer
dit niet het geval is. Een ontvangstbewijs dat is gescoord op basis van een regulier hypothesebestand noemt geen model;
de heruitvoering door de node dient hiervoor als controle.

**Een verschil tussen het ontvangstbewijs en de node wordt gesignaleerd.** Beide getallen worden
op dezelfde manier berekend — dezelfde scorer, dezelfde dev-set en voor een model
dezelfde regels voor decodeerlengte — waardoor dezelfde gewichten tot op een fractie van
een punt overeenkomen. Wanneer het getal van de node en dat van het ontvangstbewijs meer dan **2,0
punten** verschillen op de kwalificatieschaal van 0–100, meldt de node dit na de
heruitvoering; een air-gapped node legt het verschil met de controle ook vast in zijn
lokale grootboek en toont dit opnieuw aan de beheerder bij `node approve
--offline`. Dit is een waarschuwingsmarkering, nooit een weigering:
het eigen getal van de node is wat bindend is. (De grens van 2,0 punten is een bewust
conservatieve keuze die snel waarschuwt; het is een beleidswaarde die een organisator
eventueel kan herzien.)

### Deelnemers kunnen alles vooraf repeteren voordat ze inzenden

Niemand zou pas dagen later via een afwijzing moeten ontdekken dat een bundel foutief was
samengesteld. `mt-eval contest validate` voert op de machine van de deelnemer en zonder
netwerk exact uit wat uw node als eerste controleert:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

Het toont een tabel met bevindingen en sluit af met een niet-nul exitcode als er iets geweigerd zou worden
(`--json` voor geautomatiseerde tooling). Wijs deelnemers hierop in uw oproep tot deelname:
het kost hen één commando en bespaart u onnodige afwijzingen.

`validate` schrijft niets weg. Het scoort de dev-uitvoer opnieuw zonder een
ontvangstbewijs weg te schrijven, en controleert vervolgens een ontvangstbewijs:

- **Een ingepakte bundel** (het `.tar.gz`-bestand dat een submit-commando heeft geschreven) bevat het
  ontvangstbewijs waarmee het is verpakt, en dat exemplaar is wat uw node leest. Validate
  controleert de repetitie dus tegen die kopie. Het vindt ook het ontvangstbewijs
  op de machine van de deelnemer waar de kopie vandaan kwam en vermeldt het systeem ervan, ongeacht
  hoe de methode van de bundel heet. Het waarschuwt wanneer `--system` een ander
  ontvangstbewijs noemt, en wanneer de deelnemer dat systeem sinds
  het verpakken opnieuw heeft gekwalificeerd (de bundel bevat dan nog het oudere ontvangstbewijs). Zonder
  `--offline-…`-vlaggen zijn het kwalificatie-id en de drempelwaarde ook afkomstig uit die
  kopie, wat betekent dat het de waarden zijn die de deelnemer aan `contest qualify` heeft meegegeven.
  De bevinding vermeldt dit expliciet.
- **Een bronmap** die voor de controle is ingepakt met `--manifest`: validate
  gebruikt het ontvangstbewijs dat `submit-method` en `submit-model` zullen insluiten, gevonden op
  de manier waarop zij dat doen: `--system`, anders het ontvangstbewijs met dezelfde naam als de
  methode van de bundel, anders het enige ontvangstbewijs van de wedstrijd.

Het waarschuwt wanneer dat ontvangstbewijs betrekking heeft op andere dev-uitvoer, een ander dev-bestand of
een andere kwalificatie. Het waarschuwt ook wanneer er geen ontvangstbewijs aanwezig is. Ontvangstbewijzen zijn
uitsluitend afkomstig van `contest qualify`.

Het is een generale repetitie, en dat wordt ook zo vermeld. Uw node bouwt het image alsnog zonder
netwerk, voert de container uit en herhaalt de kwalificatie zelf. Een geslaagde validatie
betekent dat er *op voorhand niets bekend is* dat fout is — niet dat de run gegarandeerd scoort.

:::note[Deelnemers: op welk eindpunt bevindt uw wedstrijd zich?]
Een **netwerk-gehoste** wedstrijd vereist geen configuratie van een eindpunt — het standaardeindpunt
waarmee de harness wordt geleverd bevat het wedstrijdmechanisme (de kwalificatiepoort,
methodevoorstellen, autorisatie), en `mt-eval contest submit-model` /
`submit-method` communiceren hier rechtstreeks mee. U hebt harness **0.2.0 of nieuwer**
nodig (`mt-eval --version`); eerdere versies missen `qualify`, `validate`, `rank` en
`close`. Netwerk-gehoste wedstrijden openen alleen wanneer een organisator is geregistreerd
via de route die in de bovenstaande kanttekening is beschreven, waardoor de meeste wedstrijden op dit moment
**gefedereerd** zijn.

Een **gefedereerde** contest — de organisator draait de machinerie op zijn eigen Supabase-project, zodat inzendingen nooit via ons worden doorgevoerd — publiceert zijn eindpunt bij de contestmaterialen. Exporteer het vóór het indienen:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Als de harness is gericht op een eindpunt dat de contestmachinerie niet heeft (bijvoorbeeld een gefedereerde host waaraan een migratie ontbreekt), stopt de opdracht met *"de contestrijstrook is nog niet beschikbaar op dit Supabase-eindpunt"* en geeft aan met welk eindpunt er werd gecommuniceerd. (Gefedereerde organisatoren: publiceer deze twee waarden naast uw corpusrelease, `--node-id`, en `--corpus-version`.)
:::

## Stap 9 — Verzegelde uitvoeringen: verzoek, autoriseer, voer uit, scores naar buiten

Voor elke inzending:

1. Er wordt een **verzoek** ingediend voor uw verzegelde set — dit komt binnen in `pending` en
   bevat een onveranderlijke vingerafdruk van (bundelhash, corpus-id, corpusversie,
   `scores-only`, evaluatienode-meting).
2. Uw node voert zijn **eigen statische controles** uit op de bundel. Voor een code-inzending
   (Lane B) controleert deze vervolgens of uitvoering überhaupt mogelijk is: er is een container-runtime
   aanwezig, en het RAM-geheugen, de tijdelijke schijfruimte en de uitvoeringstijd die de bundel declareert,
   passen binnen uw `sandbox`-limieten. Een overschrijding is geen inhoudelijk oordeel over de methode. De
   weigering benoemt elke afwijking ("8 GB RAM requested, this node allows 4 GB
   (sandbox.max_ram_gb)"), er wordt niets uitgevoerd of definitief afgewezen, en het verzoek blijft
   ongewijzigd staan. U kunt de limiet verhogen in `node.json` en
   `mt-eval node run-method <id>` opnieuw uitvoeren zonder dat er opnieuw hoeft te worden ingezonden. Of de deelnemer kan
   de bundel opnieuw inpakken met de vlaggen die de weigering toont (bijvoorbeeld `--ram-gb 4`);
   de vereisten maken deel uit van de bundelhash, dus dat vormt een nieuw verzoek.
   Vervolgens **voert de node de kwalificatieclaim van de deelnemer opnieuw uit** op zijn eigen
   kopie van de openbare dev-set. Diens ontvangstbewijs is een claim; dit is de daadwerkelijke
   meting. Een tekortkoming wordt
   hier geweigerd — voordat een beheerder wordt gevraagd iets goed te keuren, en voordat
   de verzegelde set wordt geopend — en de weigering vermeldt wat er werd geclaimd, wat er werd
   gemeten en waar de lat lag. Een bundel die andere prijsvoorwaarden heeft geaccepteerd
   dan die uw wedstrijd stelt, wordt op ditzelfde punt geweigerd.
3. Uw **beheerders nemen een besluit** (M-van-N). Goedkeuring leidt tot een **toekenning**: voor eenmalig
   gebruik, verlopend en uitsluitend geldig voor die exacte vingerafdruk.
4. De evaluatie draait in de netwerkgeïsoleerde sandbox op **uw** node
   (`mt-eval node run-method`): een container zonder netwerkstack, waarbij referenties
   buiten de container worden gehouden — of, voor maximale isolatie, op een echte airgap-machine
   waarbij ondertekende scores-only bundels via verwisselbare media worden overgebracht (zie het statuskader
   hierboven voor wat wel en niet wordt gedekt). Een dark node uploadt niets: u
   brengt de ondertekende scorebundel naar buiten en publiceert de runkaart vanaf een verbonden
   machine (`mt-eval node relay`). Uw verzegelde holdout en eventuele gedeclareerde
   testsuites van derden draaien binnen **dezelfde** geautoriseerde run, zodat ze
   uw beheerders geen extra ceremonie kosten.
5. **Uitsluitend scores verlaten de omgeving.** De `scores-only`-emissieregel is vastgelegd op
   de databaselaag; tekst per regel uit uw corpus wordt nooit gepubliceerd.
6. Als uw wedstrijd `hidden_until_close` heeft beloofd, wordt de score nog niet
   gepubliceerd: deze wordt **ingehouden** als uitgesteld resultaat dat alleen u kunt zien, en
   `contest close` publiceert elke ingehouden kaart voordat de rangschikking definitief
   wordt bevroren. Een ingehouden resultaat gaat nooit verloren.
7. Elke stap — verzoek, stemmen, toekenning, gebruik en elke geblokkeerde poging — wordt
   toegevoegd aan het openbare, gehash-ketende auditlogboek dat u (en iedereen) kunt naspelen.

## Een methode indienen (voor deelnemers) — twee lanes

De meeste NMT-inzendingen zijn niet exotisch: een standaard gefinetunede transformer met de bijbehorende
gewichten. Hiervoor is er een **preferente, codevrije lane** — en een terugvaloptie naar een
sandbox voor methoden die daadwerkelijk uit code bestaan.

### Lane A — declaratief model (voorkeur voor standaard-NMT)

Als uw methode een standaard neuraal model is, dient u deze in als **data** — de
gewichten, tokenizer en configuratie — en de organisator voert deze uit in diens eigen vertrouwde
inferentie-engine. **Geen Dockerfile, geen code, geen sandbox.** Omdat niets wat u
indient daadwerkelijk uitvoerbare code is, bestaat de veiligheidscontrole van de organisator uit een beslisbare formaatvalidatie
in plaats van het moeten bewijzen dat willekeurige code veilig is — een aanzienlijk sterkere
garantie voor zowel u als voor het corpus.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Een model getraind met NMT Forge.** `nmt-forge export` schrijft de
uitrolbare map `export/model/` weg. Naast de gewichten, configuratie en tokenizer
bevat deze `forge-model.json` (de scores van dat model op uw privé-testset
en lokale paden), `DEPLOY.md` en `champollion-plugin/`, waarvan niets
deel uitmaakt van een inzending. `submit-model` pakt alleen de bestanden in die transformers leest
(gewichten, `config.json`, `generation_config.json`, de tokenizerbestanden) en
geeft alles weer wat is weggelaten, zodat die drie bestanden vanzelf achterblijven.
Sectie 6 van die `DEPLOY.md` somt de bestanden op waaruit de inzending bestaat, de
architectuur uit `config.json` en het aantal parameters afgelezen uit de
header van het gewichtenbestand, inclusief het exacte commando. Om exact de bestanden te verzenden
die u hebt gecontroleerd, kopieert u deze naar een eigen map en geeft u die door als
`--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Welk parameteraantal.** Lane A controleert `--parameter-count` ten opzichte van het
gewichtenbestand. Het telt de tensorgroottes in de `safetensors`-header bij elkaar op en
weigert een opgave die meer dan 1% afwijkt. Dat is wat het bestand opslaat, en dit kan
afwijken van een telling uitgevoerd in torch. Een gekoppeld of gedeeld gewicht wordt eenmaal opgeslagen. Een
tabel die het model opnieuw opbouwt bij het inladen, zoals sinusvormige posities, wordt mogelijk
helemaal niet opgeslagen. De weigering toont het aantal uit het bestand; declareer dat getal.

De regels waaraan uw bundel moet voldoen (lokaal gevalideerd vóór het uploaden, en opnieuw
door de node van de organisator):

- **Gewichten zijn `safetensors`, nooit pickle.** Een PyTorch `.bin`/`.pt`/`.ckpt`
  is een pickle — willekeurige code bij het laden — en wordt geweigerd. Exporteer naar
  `model.safetensors` (`safetensors` / `transformers` doen dit standaard).
- **Een architectuur die de engine van de organisator standaard laadt.** De `architectures`
  van `config.json` kan elke architectuur zijn die de `transformers` van de host implementeert
  (Marian, NLLB/M2M100, mBART, T5, Pegasus en vele andere) — hosts zijn
  **standaard permissief**, omdat bij `trust_remote_code=False` de veiligheid
  voortvloeit uit het codevrije formaat, niet uit de naam van de architectuur (een niet-ondersteunde
  architectuur laadt simpelweg niet en voert niets uit). Een voorzichtige host kan
  een allowlist publiceren. Geen `auto_map`, geen `trust_remote_code` — die smokkelen
  alsnog aangepaste code naar binnen en worden altijd geweigerd.
- **Een declaratieve tokenizer** (`tokenizer.json` of een `sentencepiece` `.model` +
  vocab), en **uitsluitend databestanden** — geen `.py`/scripts/binaire bestanden in de bundel.

**Wat `submit-model` inpakt.** De databestanden in de hoofdmap van `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): de
gewichten, configuratie, tokenizer en generatieconfiguratie. Al het overige — een
`README.md` of `DEPLOY.md`, een submap, een pickle-checkpoint naast de
safetensors — wordt weggelaten, en het commando somt op wat er is weggelaten. De
`model/`-map die `nmt-forge export` schrijft, kan dus ongewijzigd worden ingezonden: de `DEPLOY.md`
en `champollion-plugin/` blijven vanzelf achter. `contest validate` pakt op dezelfde manier in
en meldt de weggelaten bestanden als een INFO-bevinding. De controle van uw node blijft
ongewijzigd: een bundel die een niet-databestand bevat, wordt daar nog steeds geweigerd.

**Hoe lang de uitvoer mag zijn.** Uw node decodeert altijd met een expliciete lengte:
de `max_new_tokens` of `max_length` die het model declareert (diens
`generation_config.json`), anders tot `max(64, 4 × source tokens)` nieuwe tokens
per zin, begrensd op de posities van de decoder. `mt-eval run --method
local-model` decodeert volgens dezelfde regel, zodat het ontvangstbewijs van een deelnemer en de
heruitvoering van uw node overeenkomen. `submit-model` toont de lengte die van toepassing zal zijn
en schrijft deze in het manifest (`model.decodeLength`); de node legt de toegepaste
lengte vast in de uitvoeringsfeiten van de run (`execution.generation`).
Zonder expliciete lengte stopt de transformers-bibliotheek bij ongeveer 20
tokens, waardoor elke inzending op afgekapte uitvoer zou worden beoordeeld.

De organisator voert het uit met `trust_remote_code=False`, offline, en uitsluitend scores
verlaten het systeem — gepubliceerd als `declarative-model`, methode-identiteit **door
constructie codevrij**. (Gewichten van meerdere gigabytes: gebruik `--bundle-out` voor het sneakernet-traject,
op dezelfde manier als hieronder.)

### Lane B — uitvoerbare bundel (de sandbox, voor codemethoden)

Als uw methode daadwerkelijk uit code bestaat — een pipeline, een door een LLM begeleide hybride, een aangepaste
decoder — kan deze niet declaratief worden uitgevoerd en gaat deze via de netwerkgeïsoleerde
sandbox. Dit is een aantoonbaar zwakkere lane (deze bevat niet-vertrouwde code
in plaats van de uitvoering ervan te weigeren), dus gebruik Lane A telkens wanneer uw methode een
standaardmodel is.

**Bundel elk model dat uw methode aanroept.** De node voert uw inzending volledig
zonder netwerk uit, dus een methode die een gehoste model-API aanroept (een LLM-begeleide
hybride die een cloud-LLM raadpleegt, een MT-dienst) krijgt geen antwoord en scoort
niets. Een LLM-begeleide hybride kwalificeert zich alleen met het bijbehorende LLM binnen de bundel:
open gewichten onder `/method`, in-process uitgevoerd of via een lokale server die uw
entrypoint start. Hetzelfde geldt voor elk woordenboek, elke FST of andere gegevens die uw
methode tijdens de runtime leest. (De [methodenspecificatie](/docs/network/specifications/methods#method-validity-and-dependency-classes)
noemt een methode die een gehoste LLM vereist afhankelijkheidsklasse A1; de gateway die
uitvoering hiervan in de sandbox mogelijk zou maken, is nog niet gebouwd.)

**Het contract voor uitvoerbare bundels is stdin/stdout.** Binnen de container voert
de node van de organisator exact het volgende uit:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Bronzinnen komen regel voor regel binnen via stdin; u schrijft één vertaling per
regel naar stdout. De container heeft geen netwerkstack (`--network=none`), een
alleen-lezen root en een beschrijfbare `/tmp`.

**Waar uw bestanden terechtkomen.** Alles in de map die u meegeeft als `--method-dir`
wordt verpakt onder `method/` in de bundel en tijdens runtime **alleen-lezen gekoppeld op `/method`**,
inclusief gewichten, zodat er niets naar de container-image hoeft te worden gekopieerd. Richt het
als volgt in:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` is het pad van het script binnen `--method-dir`. Het bundelpad,
`method/translate.py`, wordt ook geaccepteerd. Als een naam naar twee verschillende
bestanden zou kunnen verwijzen, weigert het commando en noemt het beide; als het bestand ontbreekt, noemt het
elk pad waarin is gezocht.

**Een minimale Hugging Face transformers-wrapper:**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**De Dockerfile moet worden gebouwd zonder netwerk.** De organisator bouwt uw image met `--network=none` — de air-gap-bouwtest *is* de bouw — dus elke afhankelijkheid moet **in de bundel worden meegeleverd** (een `pip install` die PyPI bereikt, laat de bouw mislukken, en de statische pre-flight-scan markeert netwerkaanroepen voordat er iets wordt verzonden). Lever wheels mee in uw methodemap en installeer ze daaruit:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**Wat elke inzending moet bevatten.** Deze zijn verplicht, en het commando
stopt vóór elke netwerkstap als er een ontbreekt:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id` en `--agree`;
- een **goedgekeurd `mt-eval contest qualify`-ontvangstbewijs** voor deze wedstrijd en dit
  systeem (Stap 8; `--system` specificeert dit wanneer u er meer dan één hebt gekwalificeerd);
- twee verklaringen, vastgelegd als uw claims: `--track constrained` of
  `--track unconstrained` (er is geen standaardwaarde), en `--parameter-count`;
- voor een methode met getrainde gewichten (`--parameter-count` groter dan 0): ook
  `--weights-license <SPDX id or LicenseRef-…>` en een van `--weights-public`
  of `--weights-private`;
- voor een methode **zonder getrainde gewichten** (regelgebaseerd, een woordenboek, een FST):
  `--parameter-count 0` en geen gewichten-vlaggen. De inzending registreert de
  licentie en openheid van de gewichten als niet van toepassing, in plaats van een licentie die u
  zelf zou moeten verzinnen;
- voor een methode die **een LLM prompt** (er wordt niets getraind, er worden alleen prompts geschreven):
  het aantal is de som van de parameters van elk model dat de bundel uitvoert, inclusief
  het LLM, ook al hebt u dit niet zelf getraind. Neem dit over van de modelkaart
  van het LLM of de header van de gewichten, en geef de licentie van het LLM door als
  `--weights-license` met `--weights-public` wanneer de gewichten vrij te downloaden
  zijn. `--parameter-count 0` zou een onjuiste voorstelling van het systeem geven: 0 betekent dat de
  methode in het geheel geen model uitvoert. Een methode die een gehost LLM aanroept, kan helemaal niet
  deelnemen aan een verzegelde wedstrijd: de node heeft geen netwerkverbinding en de gateway die
  dergelijke aanroepen zou moeten routeren, is niet gebouwd (zie *Bundel elk model dat uw methode
  aanroept* hierboven). `contest qualify` vermeldt dit al wanneer de uitvoer die het
  scoort via een provider tot stand is gekomen;
- met `--track constrained`: `--training-data-file`, een tekstbestand met een opsomming van de
  gegevens waarop u hebt getraind (een methode die nergens op is getraind, vermeldt dat in het bestand);
- als de wedstrijd prijsvoorwaarden stelt: `--accept-terms <hash>` (voer eenmaal uit
  zonder deze vlag om de voorwaarden te zien met de hash die moet worden geretourneerd); als
  beschrijvingen verplicht zijn: `--description-file`.

**De resources die uw methode declareert.** De bundel specificeert het benodigde RAM-geheugen, de
tijdelijke schijfruimte en de maximale uitvoeringstijd (wall-clock time), en de node van de organisator weigert een bundel
die meer vraagt dan de `sandbox`-limieten toestaan. De standaardwaarden zijn de limieten in de
node-template die `mt-eval node init` schrijft: `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, geen GPU. Een bundel die met de standaardwaarden is verpakt,
draait dus op een node die is geconfigureerd met de standaarden van het sjabloon. Als uw
methode meer nodig heeft, geef dat dan aan met die vlaggen (en `--gpu`), en controleer of de
node van de organisator dit toestaat. Organisatoren die de limieten aanpassen, dienen deze
bij de wedstrijd te publiceren. Als de node weigert, vermeldt de afwijzing elke waarde
en wat de node maximaal toestaat.

Dien het in met:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

De node van de organisator voert uw methode opnieuw uit op zijn eigen kopie van de openbare dev-set
voordat een beheerder wordt gevraagd de run goed te keuren. `--agree` bevestigt
de voorwaarden voor het indienen van methoden.

**Gewichten van meerdere gigabytes, of geen verbinding: gebruik het sneakernet-traject.** Het gehoste
innamepad uploadt uw tarball als een **enkele POST** naar de opslag van de
wedstrijdhost en is dus gebonden aan de uploadlimiet van die host — prima voor code
en kleine modellen, maar ongeschikt voor checkpoints van meerdere gigabytes. Het bundelcontract zelf
staat aanzienlijk grotere artefacten toe (tarballs tot 100 GB, gebouwde images tot
150 GB). `--offline` pakt de bundel in en schrijft een uitwisselingsmap weg
volledig zonder netwerkverbinding. Zonder verbinding is er geen wedstrijdrij om uit te lezen,
dus zijn ook de waarden nodig die de organisator heeft gepubliceerd: `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` en
`--offline-threshold` (de drempelwaarde op de kwalificatieschaal van 0–100). Een regelgebaseerde methode
zonder gewichten, offline verpakt:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

De uitwisselingsmap wordt via verwijderbare media (of een ander kanaal dat u beiden vertrouwt) naar de organisator overgebracht; deze neemt de map in met `mt-eval node import-bundle`. De SHA-256 van de bundel wordt in beide gevallen vastgelegd in het autorisatieverzoek, zodat aantoonbaar wordt uitgevoerd wat u heeft voorgesteld.

**Organisatoren: een offline voorstel wacht op een beheerder, net zoals een online voorstel —
en de node controleert het eerst, in de volgorde van Stap 9.** Het komt binnen als een
verzoek met de status *in behandeling* (pending), en de air-gapped node registreert zowel de eigen controles als
de beslissing van de beheerder zelf, zonder database en zonder servicesleutel:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

De eerste `node run-method --offline` op een voorstel in behandeling opent nog niets
wat verzegeld is. Het voert de kwalificatie van de deelnemer opnieuw uit op de openbare dev-set (het
`qualifier` + `dev_corpus` dat uw `node.json` declareert; `node init
--from-contest` vult beide in), en controleert voor een code-inzending of er een container-runtime
aanwezig is en of het door de bundel gedeclareerde RAM, de tijdelijke schijfruimte en de
looptijd binnen uw `sandbox`-limieten passen. Een voldoende wordt weggeschreven naar het
gehash-ketende lokale grootboek van de node. Een onvoldoende op de kwalificatie wordt daar geweigerd, vastgelegd als
de afwijzing van de node en teruggestuurd als een ondertekende weigering: er wordt geen beheerder geraadpleegd.
Een node die de inzending niet kan uitvoeren (geen runtime, een te lage limiet) weigert dit als
een nodeprobleem en legt niets vast; het verzoek blijft ongewijzigd.

`node approve --offline` weigert totdat die goedgekeurde controle is opgenomen in het grootboek
voor de exacte vingerafdruk en bundel van dit verzoek, en de foutmelding vermeldt het
eerst uit te voeren commando. Vervolgens schrijft het een stem en de autorisatie weg naar
hetzelfde grootboek (het grootboek dat de beheerders-sleutelceremonie gebruikt) en een beslissingsrecord
ondertekend met de `signing_key` van de node, met vermelding van de controle waarop het is gebaseerd. De
tweede `node run-method --offline` controleert alle drie de zaken voordat er iets verzegelds
wordt uitgevoerd (het grootboek verifieert, het toont dat dit verzoek is geautoriseerd onder de
geïmporteerde vingerafdruk, en het ondertekende record verifieert en vermeldt dit
verzoek), zodat een voorstel in behandeling nooit alleen op gezag van een operator draait. Vervolgens
worden de runtimecontrole en de kwalificatie opnieuw uitgevoerd voordat de verzegelde set wordt geopend.
Een weigering wordt op dezelfde manier vastgelegd en gaat terug naar de deelnemer als een ondertekende
afwijzing; een beheerder kan op elk moment weigeren, ongeacht of er al is gecontroleerd.
Verzoeken die al geautoriseerd binnenkomen — een relay-export (geautoriseerd in de
wedstrijddatabase) of `node stage-request` (de staging-organisator vormt de
autorisatie) — vereisen geen tweede beslissing.

**Organisatoren: laad basisimages vooraf op air-gap-machines.** Omdat de imagebouw wordt uitgevoerd met `--network=none`, moet de `FROM`-basisimage van de Dockerfile al aanwezig zijn in de lokale imagestore van de machine. Op een verbonden machine: `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; breng `base.tar` over samen met de bundel; op de air-gap-machine: `docker load -i base.tar` vóór het uitvoeren van `mt-eval node run-method`. Spreek de basisimage(s) af met deelnemers in uw gepubliceerde wedstrijdmaterialen.

## Stap 10 — Rangschikken, sluiten, exporteren

Alleen-scores-resultaten worden net als elke andere run gepubliceerd naar het [leaderboard](/docs/network/leaderboard/rules),
gemarkeerd als evaluaties op een verzegelde set. De eigen rangschikking van de wedstrijd
kunt u zelf samenstellen, bevriezen en publiceren:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

Wat `rank` doet, zodat u dit in uw regels kunt vermelden: inzendingen worden gerangschikt op de
**vastgelegde primaire metriek** van de wedstrijd (`--primary-metric` bij aanmaak; standaard
chrF++), vervolgens chrF++ → BLEU → COMET → vroegste inzending. Dit gebeurt
**standaard uitsluitend op basis van geverifieerde gegevens** — de door de node gepubliceerde runkaarten — en telt
eventuele verborgen zelfgerapporteerde kaarten. Elk aangrenzend paar bevat een gelabeld oordeel
over een eventuele gelijke stand: een gepaarde significantietoets per segment waar rijen per segment bestaan,
anders een **overlap van het 95%-betrouwbaarheidsinterval**, anders puntgelijkheid.
**Een verzegelde wedstrijd publiceert nooit rijen per segment** (uitsluitend aggregaten, per
ontwerp), dus de gepaarde toets draait in plaats daarvan op uw node. Voer vóór het sluiten
`mt-eval node verdicts --contest <id> --out verdicts.json` uit op de node; dit
schrijft uitsluitend ondertekende oordelen weg (per paar: p-waarde, scoreverschil, interval,
aantal segmenten — geen tekst). Sluit vervolgens met `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>`. Zonder oordelen wordt een gelijke stand bepaald op basis van
BI-overlap. In beide gevallen vermeldt de uitvoer het gebruikte bewijs, en systemen met een gelijke stand
delen een positie (`1, 1, 3`).

`close` werkt slechts in één richting. Het rangschikt op de vastgelegde metriek, weigert zolang
inzendingen nog worden gescoord (tenzij u dit forceert), toont u de
tabel, vraagt om bevestiging en bevriest vervolgens de rangschikking in het wedstrijdrecord. `export`
geeft dat bevroren resultaat letterlijk terug, als JSON of CSV, voor uw Findings- of
resultatenpagina. Kaarten die op een andere set zijn gescoord (een volledig geheime T2-set, een verdwaalde
dev-set-kaart) worden apart vermeld en nooit vermengd met de hoofdrangschikking.

### Bepalen wanneer resultaten verschijnen

Twee beloften die u bij het aanmaken doet en daarna niet stilzwijgend kunt aanpassen — de
database bevriest beide op het moment dat uw wedstrijd een inzending heeft:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` is de instelling die daadwerkelijk een
score verbergt.** Hieronder wordt elke kaart die uw node scoort achtergehouden in plaats van
gepubliceerd: de methode is wel uitgevoerd, de autorisatie is verbruikt en de
kaart is samengesteld, gevalideerd en letterlijk opgeslagen — deze staat simpelweg niet op het
bord. `contest close` publiceert elke achtergehouden kaart **eerst**, bouwt en
bevriest daarna pas de rangschikking, zodat er niets verloren gaat en het bevroren resultaat alles rangschikt
wat u bezit. Dat gebeurt ook bij een geforceerde sluiting: forceren heeft betrekking op werk dat
nog in uitvoering is, nooit op het inhouden van een score die uw wedstrijd verschuldigd is. De bevroren
momentopname vermeldt exact welke resultaten bij het sluiten zijn gepubliceerd.

Ingehouden is een **vastgelegde status, geen verloren run**: de ingehouden kaart kan niet worden
bewerkt, en de verwijzing naar waar deze is gepubliceerd wordt eenmalig weggeschreven en
nooit meer verplaatst — beide afgedwongen in de database, onder elke client. Zolang
de wedstrijd openstaat, meldt `rank` hoeveel resultaten er worden ingehouden, zodat
een voorlopige rangschikking nooit ten onrechte als compleet wordt geïnterpreteerd.

**`--anonymize-until-close` doet minder, en het is goed om precies te weten
wat.** Het vervangt namen van deelnemers door deterministische pseudoniemen in *uw*
rangschikkingsartefacten — de `rank`-tabel, de bijbehorende JSON, de CSV — zolang de wedstrijd
openstaat, en `close` onthult ze weer. Het anonimiseert het openbare
leaderboard **niet**: een kaart die is gepubliceerd toont de door de inzending
gedeclareerde auteursvermelding. Als u wilt dat deelnemers elkaars resultaten vóór het
einde niet kunnen zien, dan is daar `--results-visibility hidden_until_close` voor; deze vlag is daar
geen vervanging voor.

Als een methode voldoet aan de drempelvoorwaarden die u in Stap 6 hebt gepubliceerd —
inclusief [sprekervalidatie](/docs/network/specifications/speaker-validation),
wat een controle door uw community is en geen geautomatiseerde — reikt **u** (of uw trust)
de prijs uit, volgens uw eigen gepubliceerde voorwaarden. De rol van Champollion eindigt bij
de meting.

---

## Wat u voor altijd behoudt

- **Het corpus.** Het heeft uw infrastructuur nooit verlaten. Zet de cijfertekst offline en de verzegelde set kan simpelweg niet meer worden uitgevoerd.
- **De sleutels.** Toegang vervalt wanneer uw beheerders stoppen met het verlenen ervan.
- **Het geld.** Het was nooit ergens anders.
- **Het record.** De hoofddigest van het auditlogboek is publiceerbaar, zodat de geschiedenis van wie wat heeft uitgevoerd tegen uw corpus niet stilletjes kan worden herschreven — door wie dan ook, inclusief ons.

Voor voorwaardentaal die u kunt aanpassen — eigendom, scores-only-licentieverlening en een expliciete rondleiding langs de manieren waarop een wedstrijd kan worden aangevallen — zie [Voorwaardentemplates](/docs/network/sovereignty/terms-templates).
