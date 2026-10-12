---
sidebar_position: 3
title: "Train uw eerste model (met uw agent)"
description: "Een stapsgewijze handleiding voor het trainen van een low-resource MT-model door een coding agent aan te sturen — installeren, uw testset beschermen, trainen op een laptop-CPU, eenmaal scoren en het model serveren aan de champollion CLI. Wat u zegt, wat forge doet en hoe een weigering eruitziet."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Uw Eerste Model Trainen (met uw agent)

U hoeft niet te weten hoe u een neuraal machinevertaalmodel traint. U moet in staat zijn om **een codeeragent te vertellen wat u wilt** — Claude, of een Sonnet/Flash-klasse model, of een agent die shell-opdrachten kan uitvoeren. **nmt-forge**
is zo gebouwd dat de agent het *mechanisch* kan aansturen: bij elke stap vertelt het hulpmiddel de agent precies wat er vervolgens gedaan moet worden, en weigert — luidruchtig, met een oplossing — wanneer een stap uw resultaten zou kunnen beschadigen.

Deze pagina beschrijft de volledige cyclus, van `pip install` tot een model dat de Champollion CLI kan aanroepen. Elke stap is geschreven als **wat u uw agent vertelt**, **wat forge doet**, **hoe een weigering eruitziet** (zodat geen van beiden in paniek raakt wanneer er een optreedt — een weigering betekent dat het hulpprogramma werkt) en, aan het eind, **hoe u het rapport leest**. Dit is het forge-gedeelte van stap 2 en 4 van [Build MT for Your Language](/docs/build-mt-for-your-language), waarin wordt behandeld wat eraan voorafgaat (vinden wat er bestaat), wat ertussen zit (de bestaande opties meten) en wat erna komt (publiceren, methoden combineren).

**De volgorde is belangrijk.** Registreer uw testset, controleer uw trainingsdata hierop en noteer uw voorspellingen (stap 1–3) **voordat er iets wordt gescoord op de testset** — inclusief de baselines die stap 3 van de handleiding meet met `mt-eval run`. Een benchmark is een scoring-uitlezing: forge telt deze en weigert een voorspelling die erna is opgesteld. Vervolgens splitst en traint u (stap 4).

:::tip De enige regel voor uw agent
Zeg ertegen: *"Voer altijd eerst `nmt-forge status --json` uit, en na elke stap. Doe wat de `next_command` ervan aangeeft."* Die ene gewoonte maakt van forge een geleide rails. Elk forge-commando accepteert `--json`: exact één JSON-document op stdout, en een weigering wordt geretourneerd als `{"error": {…, "why", "fix"}}` met exitcode 2. Als uw agent verbinding maakt via MCP, is dezelfde cyclus de `forge_status`-tool (`{ "project_dir": "<dir>" }`) — zie de [Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Stap 0 — Installeer en verwijs uw agent naar uw taal

**U zegt:** *"Installeer nmt-forge met de training-extra. Ik wil een Engels→[uw taal]-model trainen. Begin met ontdekken wat forge hierover weet. De ISO 639-3-code is `crk`"* (gebruik de code van uw taal).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

De extra `[hf]` voegt de trainingsbibliotheken toe (torch, transformers, accelerate, tokenizers, sentencepiece, peft). CPU-only wheels volstaan voor het standaardmodel. Alleen `python3 -m pip install nmt-forge` biedt u de guards, splitsingen, audits en scoring zonder training.

**forge doet:** `nmt-forge discover crk` leest de taalkaart — schriften, woordenboeken, morfologische analyzers, bestaande corpora en evaluatiesets (met eventuele `do_not_train`- / quarantaine-vlaggen) en scheidsrechtermetrieken (referee metrics) per taal. U hebt geen kopie van de Champollion-repository nodig: kaarten worden gevonden in een map die u opgeeft (`--cards-dir`), een lokale checkout of `node_modules/champollion`, of de openbare kaartenindex (gecached, zodat deze daarna offline werkt). forge plaatst uw taal vervolgens op de **assetladder**: (1) parallelle tekst → beveiligde training; (2) + eentalig → getagde backtranslation; (3) + woordenboek/grammatica → geciteerde synthetische data; (4) + analyzer → round-trip-geverifieerde synthese; (5) + een scheidsrechtermetriek → de eigen metriek van de taal bij scoring en checkpointselectie.

**Een leeg veld betekent ONBEKEND, nooit nul.** Een schaarse kaart betekent niet "deze taal heeft niets" — het is mogelijk dat de bron nog niet geregistreerd is. U kunt altijd uw eigen parallelle corpus meebrengen.

Vervolgens: *"Scaffold het project."*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Dit schrijft een werkruimte (`.forge/`), een starters-`config.json` en een `NEXT_STEPS.md`-briefing met de exacte commandovolgorde. **Voer elk volgend commando uit vanuit de projectmap** — de paden in de configuratie zijn hier relatief aan.

De startersconfiguratie gebruikt de modelvoorinstelling **`cpu-tiny`**, tenzij u een andere kiest:

| `--model` | Wat het is | Vereisten | Verwachting |
|---|---|---|---|
| `cpu-tiny` (standaard) | een kleine transformer (~6M parameters) die vanaf nul is getraind op uw paren; het vocabulaire wordt uitsluitend geleerd van uw trainingsrijen | een CPU, geen download | zwak: bij 1–2 duizend paren een chrF++ van ongeveer 5–30 (de bovengrens alleen bij sterk gestructureerde data). Het leert de zinnen en patronen van uw data, niet de taal in het algemeen |
| `cpu-finetune --base <hf-id>` | fixtunt een klein vooraf getraind Marian/opus-mt-model dat u opgeeft (kies er een voor een *verwant* talenpaar) | een CPU, ~300 MB download | meestal beter dan `cpu-tiny` wanneer er een verwant paar bestaat — meet het op uw dev-set, ga er niet zomaar van uit |
| `nllb-600m` | NLLB-200 distilled 600M met LoRA | een GPU, ~2,5 GB download | de sterkste start; de wall-clock-controle van forge weigert dit binnen enkele minuten op een CPU |

De voorinstelling is uitgeschreven als expliciete getallen in `config.json` → `model`, zodat niets verborgen blijft en het wijzigen van een getal een nieuwe, afzonderlijk gehashte run oplevert.

**Geen kaart voor uw taal?** `nmt-forge init <code> --no-card --name "<name>"` genereert nog steeds een projectstructuur; alles wat een kaart zou hebben vermeld, wordt geregistreerd als onbekend en er wordt niets verzonnen.

---

## Stap 1 — Houd uw testset apart en registreer deze {#step-1--set-your-test-set-aside-then-split}

**U zegt:** *"Hier is mijn parallelle corpus en, afzonderlijk, de door de docent gecontroleerde testset. Houd de testset buiten de training en registreer deze voordat er iets op gescoord wordt."*

Bestanden kunnen `.tsv` zijn (bron, een TAB, dan de vertaling, één paar per regel; regels die beginnen met `# ` zijn commentaar) of `.jsonl` (`{"source": …, "target": …}` per regel). Als de testset privé is, markeer deze dan als local-only **voordat** iets deze leest — inclusief uw agent:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
forge print de zinnen ervan dan nooit af.

**forge doet — als u een eigen testset hebt** (het gebruikelijke geval voor een school of een kliniek):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

Registratie start het **uitleeslogboek** (`<file>.reads.jsonl`) van het bestand: vanaf nu wordt elke scoring van dit bestand — door forge of door `mt-eval run` / `mt-eval compare` — geteld. Daarom komt registratie op de eerste plaats: een benchmark-run die ervoor is uitgevoerd, wordt bij registratie vermeld, maar niet meegeteld.

**Als u geen afzonderlijke testset hebt**, splits er dan een af uit het corpus — `nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split --register project` registers `project-test` and `project-dev` in één stap (stap 4 legt de splitsing uit) — en ga door naar stap 3.

`nmt-forge status` noemt nu de volgende stap: de voorspellingen (stap 3), vóór welke benchmark dan ook — controleer eerst uw corpus (stap 2).

---

## Stap 2 — Controleer op lekkage

**U zegt:** *"Controleer vóór het trainen het corpus tegen de testset en geef aan wat u zou weglaten en waarom."*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge doet:** het controleert elke rij tegen elke geregistreerde dev-/test-/sealed-set. Hetzelfde corpus en dezelfde geregistreerde sets leveren altijd hetzelfde resultaat op. Het legt uit wat het zou **weglaten**:

- **Identieke prompt** — de bronzin van de rij is gelijk aan de bron van een testrij (waarbij hoofdlettergebruik, interpunctie en spaties worden genegeerd). Wordt weggelaten **zelfs wanneer de vertaling van de rij verschilt**: het model zou immers alsnog geoefend hebben op de exacte testprompt.
- **Identiek antwoord** — het doel van de rij is gelijk aan een testreferentie.
- **Bijna-duplicaat antwoord** — het doel van de rij deelt ten minste 60% van zijn woorden met een testantwoord (accenten samengevouwen, zodat spellingsvarianten meetellen) **en** bevat het volledige antwoord, is er een fragment van of is voor ten minste 90% identiek. Het model zou het merendeel van het antwoord te zien krijgen.

…en wat het **opzettelijk behoudt**, gerapporteerd maar nooit verwijderd:

- **Template-verwanten (template siblings)** — de rij deelt een zinsstructuur met een testantwoord, maar wisselt aan beide kanten een woord uit (*"I see the dog"* / *"I see the cat"*). Het model moet nog steeds het woord produceren dat het nooit in dat zinsframe heeft gezien. Corpora uit lesboeken en scholen met vaste sjablonen zitten hier vol mee. forge somt de testrijen op die een verwant in de training hebben; doordat de startersconfiguratie `eval.near_dupe_corpus` instelt, toont het eindrapport naast de volledige score een **"(strict)"**-score voor de rijen zonder verwant.
- **Vergelijkbare prompt, ander antwoord** — de bron is een bijna-duplicaat (geen identieke kopie) van een testbron, maar de vertaling verschilt: een legitiem minimaal contrast, geen datalek.

Hier is het rapport voor een voorbeeldcorpus van 12 rijen, gecontroleerd tegen een testset van 3 rijen (ingekort; de voorbeeldzinnen zijn Engels met een Frans-achtig doel):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

Regel 3 heeft een *andere* vertaling dan de testrij en wordt alsnog weggelaten: de prompt is immers de testprompt.

Voorbeelden citeren de rijen van **uw corpus** op regelnummer; de eigen tekst van het testbestand wordt nooit afgedrukt, en een rij die overeenkwam met een **sealed** set wordt alleen op regelnummer getoond. (Wanneer een corpusrij identiek is aan een testrij, of deze bevat, toont het citeren van de corpusrij ook die testzin — geef `--no-examples` mee als de uitvoer gedeeld zal worden.)

`--clean-to pairs.clean.jsonl` schrijft de overblijvende rijen weg, plus een inhoudloos auditrecord ernaast (`pairs.clean.audit.json`). Controleer het corpus **voordat** u splitst (stap 4 splitst het opgeschoonde bestand). Controleer niet het hele corpus opnieuw nadat u er een dev-set uit hebt afgesplitst — de dev-rijen zouden met zichzelf overeenkomen en worden weggelaten. Controleer eventuele *aanvullende* data (een web-harvest, eentalige tekst) op dezelfde manier voordat u deze aan de training toevoegt.

**Het controleren verbruikt uw testset niet.** leak-audit leest de testset om rijen te vergelijken, en forge registreert dat als een *audit*-uitlezing, nooit als een scoring-uitlezing: het staat de voorspellingen die u in stap 3 schrijft niet in de weg.

**Lees eerst het oordeel** (de regel `VERDICT:`; met `--json`, de sleutel `verdict`). Als daar staat dat de meeste testrijen een bijna-tweeling (near-twin) in uw corpus hebben, zal een model dat op alle data is getraind eerder het memoriseren van trainingszinnen scoren dan daadwerkelijke vertaling. Bij een vaste testset (gecontroleerd door een docent of verpleegkundige) traint u dan doorgaans **twee modellen**: één op alle data — meestal het nuttigste model om in te zetten — en een tweelingvrij model waarvan de score aangeeft hoe de aanpak omgaat met nieuwe zinnen. Het tweelingvrije corpus is afkomstig van `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Dit verwijdert de trainingsrijen die bijna-tweelingen van testrijen zijn, rapporteert de strikte deelverzameling voor en na, weigert als er niets overblijft om op te trainen — en schrijft de configuratie van het tweelingvrije model naast de uwe, **`config-notwins.json`**: dezelfde configuratie met een eigen `run_name`, en `data.gold` / `eval.near_dupe_corpus` ingesteld op het tweelingvrije bestand (`--companion-config <file>` geeft een ander bestand op; een bestaand bestand wordt nooit overschreven). Het toont het commando om dit te trainen. Totdat de dev-set is geregistreerd (stap 4), geeft het aan deze eerst af te splitsen en deze audit opnieuw uit te voeren, zodat de dev-rijen ook uit het tweelingvrije bestand verdwijnen. `nmt-forge status` houdt het oordeel — en vervolgens het ongetrainde tweelingvrije model — in zijn waarschuwingen totdat u hier actie op onderneemt.

**Hoe een weigering eruitziet:** u hoeft er niet zelf aan te denken om dit uit te voeren — `nmt-forge run` controleert elk trainingsbestand tegen uw test- en sealed-sets en weigert bij een datalek: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT"*. Oplossing: `nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>` en train op het opgeschoonde bestand.

---

## Stap 3 — Voorspel voordat u kijkt

**U zegt:** *"Noteer wat we verwachten dat elk model scoort op de testset — voordat we er iets op meten."*

**forge doet:** één preregistratie per model dat u van plan bent te trainen, vernoemd naar het model:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Een voorspellingenbestand is een JSON-array van voorspellingen. Elke voorspelling noemt een metriek en een onderbouwing van één zin, plus ofwel een richting ten opzichte van een baseline (`"direction": "increase", "baseline_score": 0, "margin": 5`) — die later automatisch wordt gecontroleerd — of een vrije-tekstverwachting (`"expect": "between 10 and 30"`) die handmatig wordt beoordeeld. U (of uw agent, hardop) legt deze vast **voordat** er enige testscore bestaat — **en vóór elke benchmark van een bestaand model op de testset**: de baselines in stap 3 van [Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options) komen *na* deze stap. Wanneer u exporteert, geeft `--prereg <id>` aan welke voorspelling welk model beoordeelt. Of zet nu een voorspelling vast (pin) op de configuratie van het model: `--config-hash <hash>` op `prereg new`, met de volledige hash die `nmt-forge preflight run --config config-notwins.json` weergeeft. Elke latere wijziging van die configuratie (bijvoorbeeld een tijdbudget) verandert de hash en laat de pin vervallen, dus het noemen van de preregistratie bij de export is de eenvoudigste route.

**Hoe een weigering eruitziet:** vier situaties die u hier kunt tegenkomen.

- De onbewerkte template wordt geweigerd: de tijdelijke aanduidingen `REPLACE` voorspellen niets. Schrijf uw eigen verwachting en onderbouwing.
- Een Markdown- of prozabestand wordt geweigerd met vermelding van de indeling en het template-commando. Er is slechts één indeling: de JSON-array.
- Een preregistratie die is geschreven nadat de testset al is gescoord, wordt geweigerd: *"[preregister] eval set 'project-test' was already read for scoring … before this preregistration"*. Een benchmark telt mee. `--allow-after-reads` bestaat uitsluitend voor voorspellingen die daadwerkelijk vóór die uitlezingen zijn genoteerd (bijvoorbeeld op papier); dit wordt geregistreerd, en elk rapport, elke export, `DEPLOY.md` en `nmt-forge status` vermelden vervolgens dat de voorspellingen pas na N scoring-uitlezingen tot stand zijn gekomen.
- Het scoren van een testset zonder preregistratie wordt geweigerd: *"[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories"*. Dit is wat een resultaat onderscheidt van resultaatgedreven verhalen achteraf (results-first storytelling).

:::info Waarom dit aanvoelt als extra werk
Het ís het werk. Elke beveiliging hier is een fout die echte onderzoekers heeft misleid.
Het hulpmiddel maakt het eerlijke pad het gemakkelijke pad en het oneerlijke pad het pad dat
u tegenhoudt.
:::

Meet nu de bestaande opties op de testset — stap 3 van [Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options) — en kom terug om te trainen.

---

## Stap 4 — Splits, controleer de gates en train vervolgens {#step-4--check-the-gates-then-train}

**U zegt:** *"Splits het opgeschoonde corpus in train en dev. Doorstaat de trainingsrun alle controles? Zo ja, start de training."*

**forge doet — de splitsing:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` splitst alleen train en dev af, omdat uw testset al bestaat als een eigen geregistreerd bestand (bij een afgesplitste testset heeft stap 1 de splitsing al uitgevoerd). `--register project` legt `project-dev` vast in de werkruimte — de naam waarnaar de startersconfiguratie al verwijst.

De splitsing is **groepsdisjunct (group-disjoint)**: elk paar zinnen dat een bron *of* een doel deelt, belandt aan **dezelfde** kant. Dit is de meest voorkomende oorzaak van opgeblazen scores bij low-resource talen — een lesboek koppelt vele Engelse oefeningen aan één doelwoord, een naïeve willekeurige splitsing plaatst één exemplaar in train en de tweelingbroer in test, en het model "vertaalt" antwoorden die het simpelweg uit het hoofd heeft geleerd. De uitvoer geeft aan wat er is gebeurd:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Wanneer er al een testset is geregistreerd, controleert `split` de nieuwe train- en dev-bestanden hier direct tegen en waarschuwt als een rij later zou worden geweigerd.

**Corpora met templates (taalgidsen, oefeningen).** `--near-dupe 0.6` houdt ook *bijna*-duplicaten — zinnen gebouwd op hetzelfde frame — aan één kant, zodat een dev- of testrij nooit een template-tweeling in training heeft. Bij een corpus met veel templates kunnen de frames zich aaneenschakelen tot één gigantische groep (*"Does your arm hurt?"* ~ *"Does your leg hurt?"* ~ *"Your leg looks swollen"* …), en een groep kan alleen in zijn geheel naar één kant gaan. Wanneer dat een van de kanten veel meer rijen zou opleveren dan u hebt gevraagd — meer dan **1,5×** het verzoek — of training met minder dan de helft achterlaat van wat het verzoek toekent, weigert `split` en schrijft niets weg: *"[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)"*, gevolgd door de reden (de ketenvorming, met de omvang van de grootste groep) en de mogelijke oplossingen: een hogere drempelwaarde, een limiet op de groepsgrootte (`--near-dupe 0.6 --max-group 51` — bijna-duplicaatverbindingen voorbij de limiet blijven intact, en de splitsing telt ze), het weglaten van tweelingen van een vaste testset met `leak-audit --drop-test-twins`, of dev-/testzinnen die onafhankelijk van het trainingsmateriaal zijn opgesteld. forge controleert de ketenvorming zelf: bij een dergelijk corpus raadt het near-twin-advies (hier, in preflight en in de DEPLOY.md van de export) `--near-dupe 0.6` niet aan.

**Hoe een weigering eruitziet:** als u forge een splitsing aanbiedt die u zelf hebt gemaakt, weigert `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` wanneer de kanten elkaar overlappen — *"[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'"* — met de oplossing: splits opnieuw af met `split`; verwijder de problematische rijen niet handmatig.

**Twee modellen?** Nu de dev-set is geregistreerd, voert u de tweelingvrije audit uit stap 2 opnieuw uit (de dev-rijen verdwijnen dan ook uit het tweelingvrije bestand); het bijbehorende `config-notwins.json` traint hieronder het tweede model.

**forge doet — de gates:** `nmt-forge preflight run --config config.json` somt elke controle (gate) op die de run tegenkomt, met ✓ of ✗, en bij elke ✗ de bijbehorende oplossing — inclusief of de training-extra is geïnstalleerd:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Wanneer alles groen is: `nmt-forge run config.json` (en voor het tweelingvrije model: `nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json`).

Met de standaard `cpu-tiny`-voorinstelling draait dit op een gewone laptop-CPU — geen GPU, geen download. Training is nog steeds de enige stap die **geen** directe toolaanroep is, dus uw agent moet dit op de achtergrond uitvoeren met uitvoer naar een logbestand, en alleen letten op de relevante regels (`refused`, `Error`, `wall-clock`, `RUN EXIT`) in plaats van continu te pollen. Er opent zich een live dashboard met de loss-curves en een stopknop voor **u** (op `http://127.0.0.1:8377` als die poort vrij is) — dit is voor u, niet voor de agent. Vroeg in de run meet forge de snelheid en weigert het — binnen minuten, niet dagen — een run die niet binnen het `model.time_budget_hours` van de configuratie kan worden voltooid.

De `[schedule-sanity]`-regels tonen de early-stopping-**ondergrens (floor)** die forge heeft afgeleid van uw datamix, zodat een run met veel synthetische data niet na een halve epoch stopt wanneer het real-dev-verlies schommelt (een reëel faalpatroon — zie [Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training)).

Wanneer dit is voltooid, heeft forge **een checkpoint geselecteerd op de afgeschermde dev-set** (nooit op de testset), een `run-manifest.json` weggeschreven en de dev-scores afgedrukt — altijd met hun betrouwbaarheidsintervallen van 95% — gevolgd door het volgende commando.

---

## Stap 5 — Scoor het eenmalig en verpak het

**U zegt:** *"Scoor het model op de testset en verpak het zodat we het kunnen gebruiken."*

**forge doet:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Eén commando:

- decodeert uw testset met het checkpoint dat door de run is geselecteerd en scoort deze — geweigerd zonder de preregistratie, vastgelegd in het grootboek van de werkruimte, 95% betrouwbaarheidsintervallen bij elk getal en een in duidelijke taal geschreven sectie **Diagnosis & Recommendations**;
- schrijft het resultaat als een **mt-eval-rapport** in `export/evaluation/`, zodat `mt-eval compare` dit model plaatst naast alles wat u met het testharnas hebt gemeten (bijvoorbeeld de gehoste modellen in stap 3 van [Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options));
- verpakt een **op zichzelf staand model** in `export/model/` (gewichten en tokenizer, geen trainingsstatus), `forge-model.json` (wat het is en hoe het gemeten is), een Champollion-pluginmanifest en `DEPLOY.md` met de exacte commando's. `export/model/` bevat geen enkele testzin; het is de enige map die u implementeert.

**De score** is de belangrijkste uitkomst van het harnas: corpus-chrF++ met het 95% betrouwbaarheidsinterval, overal op dezelfde manier weergegeven waar forge dit toont — bijvoorbeeld `chrF++ 31.2 [28.4, 34.0]` — met de bijbehorende sacreBLEU-handtekening in de volledige records (`forge-model.json`, het exportoverzicht, `DEPLOY.md`). BLEU, spBLEU en TER worden ernaast weergegeven, er nooit mee vermengd; exact match en de andere testbanen dienen als diagnostiek. Geen enkele interface van forge toont een samengestelde score of een kwaliteitslabel: wat de uitvoer waard is, is ter beoordeling aan sprekers van de taal.

**Wat de score nuanceert, reist ermee mee.** Het mt-eval-rapport legt alles vast wat de betekenis van de score beperkt — bijvoorbeeld een *bijna-constante uitvoer* (het model gaf een van een handvol zinnen als antwoord op veel verschillende inputs, waardoor de uitvoer de input niet volgt), uitvoer die veel langer of korter is dan de referenties, of kopieën van de bron. `export` geeft elk van deze punten door in de eigen bewoordingen van het harnas: in het overzicht ervan (`score_caveats`), in `forge-model.json` en in `DEPLOY.md` direct onder de score. `status`, `report`, `compare` en `lint` vermelden hetzelfde. Een score die van een kanttekening is voorzien, wordt nooit zonder die kanttekening gepresenteerd als "het te citeren getal".

Mocht er iets mislukken, dan blijft er geen half weggeschreven export achter. Twee waarschuwingen: `export/evaluation/` bevat uw testzinnen — kopieer dit nooit samen met het model; bewaar het bij de testset. (Wanneer de testset als privé is gemarkeerd, draagt elk bestand daar dezelfde markering.) En een **sealed** testset is eenmalig: exporteren verbruikt deze, en een tweede export weigert tenzij u `--no-eval` meegeeft (het model verpakken zonder opnieuw te scoren).

`nmt-forge evaluate <run-manifest>` is het score-only gedeelte van `export`, voor als u de cijfers wilt zonder het model te verpakken (`--harness-out DIR` schrijft het mt-eval-rapport).

**Twee modellen op één testset** (bijvoorbeeld één getraind op alle data en één met `--drop-test-twins`): zodra de werkruimte een tweede run bevat, noemen de regel `NEXT` en `nmt-forge status` van de run een map per run (`--out export-<run>/`). De volgorde maakt niet uit: welk model ook als tweede wordt geëxporteerd, `DEPLOY.md` van het model met alle data citeert uiteindelijk de score van het tweelingvrije model. Met twee preregistraties op één testset geven `nmt-forge status` en `nmt-forge report` aan welke van toepassing is op welke run (of dat `--prereg <id>` moet beslissen — export the twin-free model with `--prereg notwins`). `nmt-forge compare` vergelijkt (A/B-test) de twee op de testset en vermeldt per model hoeveel testrijen een bijna-tweeling in de trainingsdata hebben: een overwinning op basis van memorisatie wordt ook als zodanig gerapporteerd. Het gebruikt de hypothesen van elk model — `<export>/evaluation/battery-hyps.jsonl`, genoemd als `hypotheses` in het exportoverzicht — en geeft de scorekanttekeningen door die mt-eval voor die export heeft geschreven. De tweelingvrije score is de score die voor nieuwe zinnen moet worden geciteerd, maar uitsluitend samen met eventuele kanttekeningen: als de uitvoer van het tweelingvrije model nagenoeg constant is, vormt de score ervan geen bewijs dat het nieuwe zinnen vertaalt, en `DEPLOY.md` vermeldt dit dan ook naast het cijfer.

**Uitlezingen door het testharnas tellen mee.** Wanneer forge een testset registreert, start het een klein uitleeslogboek naast het bestand (`<file>.reads.jsonl`), en `mt-eval run` / `mt-eval compare` voegen telkens wanneer ze dat bestand scoren één inhoudloze regel toe (run-id, doel, sha256 van het bestand, een tijdstempel). forge leest dit: een preregistratie die na zo'n uitlezing is geschreven, wordt geweigerd als een postdictie (tenzij `--allow-after-reads` wordt gebruikt, wat vervolgens in elk rapport wordt vermeld) — de reden waarom stap 3 vóór de baselines komt — een sealed-set die door `mt-eval` is gelezen, is verbruikt, `status` en `ledger show --set` tellen de uitlezingen, en `DEPLOY.md` geeft aan wanneer de geëxporteerde score geen eerste blik was.

### Het battery-lint-rapport lezen

Het rapport is een tabel met scores **per register** (leerboek, overheid, mondeling verhaal, …) — of een enkele groep, `all`, wanneer uw testrijen geen register benoemen — elk met het bijbehorende betrouwbaarheidsinterval, gevolgd door de diagnose. De diagnose benoemt uw **zwakste registers** en voor elk daarvan de meest waarschijnlijke oorzaak en de volgende **hefboom (lever)** om in te zetten:

| Als de diagnose luidt… | Betekent dit… | De hefboom |
|---|---|---|
| `R1-vocabulary-gap` | het register scoort laag **en** de uitvoer is onvoltooid; het model mist de woorden | **VOCABULARY** — breid het lexicon uit en controleer de trechter (funnel) opnieuw |
| `R2-structure-gap` | de woorden zijn bekend, maar de *zinsstructuren* niet | **STRUCTURE** — voeg de ontbrekende constructies toe (templates/compositor) |
| `R3-mixed-convention` | uitvoer mengt spellingen | **ORTHOGRAPHY** — normaliseer het corpus naar één conventie, train opnieuw |
| `R4-optimism-bound` | de "volledige" score is opgeblazen door bijna-tweeling-testrijen | **MEASUREMENT** — citeer de strikte score voor generalisatie |
| `R5-low-power` | het betrouwbaarheidsinterval is breed | **MEASUREMENT** — onderneem geen actie op verschillen die kleiner zijn dan het betrouwbaarheidsinterval; breid de testset uit |
| `R7-transfer-plateau` | uitstekend op synthetische data, vastgelopen op echte tekst | **REAL-DATA** — vertaal eentalige data terug (backtranslation) of zorg voor echte parallelle zinnen |
| `R9-harness-score-caveat` | het mt-eval-rapport plaatst een kanttekening bij de score (bijvoorbeeld een bijna-constante uitvoer); `high` wanneer mt-eval dit als ernstig (major) aanduidt | **MEASUREMENT** — citeer de score alleen met de kanttekening, en bekijk een aantal outputs voordat u het vertaalkwaliteit noemt |

Elke bevinding bevat het bewijs waarop deze is geactiveerd. Voor de `--json`-bevindingen kan uw agent programmatisch actie ondernemen: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Stap 6 — Serveer het aan de champollion CLI

**U zegt:** *"Serveer het geëxporteerde model en vertaal de strings van onze app ermee."*

**forge doet:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` antwoordt op twee manieren: het Champollion-**api method**-contract (`POST /translate`) en een **OpenAI-compatibele** `/v1/chat/completions`, waarmee `champollion sync --method local` communiceert. `export/model/DEPLOY.md` bevat het `champollion.config.json`-fragment voor de `api`-methode (de aanbevolen methode) en voor het pluginmanifest. De server luistert uitsluitend op `127.0.0.1`; om deze op een netwerk bloot te stellen, moet u een token meegeven (`--token`, of `NMT_FORGE_SERVE_TOKEN`), aangezien iedereen die de poort kan bereiken uw model kan gebruiken. De CLI heeft geen sleutel nodig voor de loopback-server; een server die met een token is gestart, heeft dezelfde waarde nodig in `CHAMPOLLION_API_KEY`.

Bij twee geëxporteerde modellen is de keuze welk model wordt geïmplementeerd aan u: `nmt-forge choose export-<run>/model` legt dit vast, en `nmt-forge status` benoemt vervolgens dat model. Het serveren van een model om het uit te proberen wordt vastgelegd als geserveerd, niet als een definitieve keuze. Om het model in plaats daarvan in te zenden voor een soevereine competitie (sovereign contest), vermeldt `DEPLOY.md` §6 de bestanden die een declaratieve inzending (Lane A) vormen en het exacte `mt-eval contest submit-model`-commando.

Weet wat u implementeert: een NMT-model vertaalt tekst; het volgt **geen** instructies op, dus de tooninstructies, coachingbestanden en glossaria die de CLI naar LLM-methoden stuurt, worden genegeerd. Bovendien vereist machinevertaling van een taal met schaarse middelen (low-resource language) een controle door een vloeiende spreker voordat er iets bij lezers terechtkomt.

---

## Wat u zojuist heeft gedaan

U hebt een model getraind waarvan u de score daadwerkelijk kunt vertrouwen: geen gelekte antwoorden, een checkpoint gekozen zonder naar de testset te spieken, foutmarges bij elk getal, voorspellingen genoteerd vóór de resultaten, een diagnose die de volgende hefboom aanwijst in plaats van u te laten gissen — en een verpakt model dat de CLI kan aanroepen en dat direct te vergelijken is met elke andere methode die u hebt gemeten. Dat is precies de bedoeling — **het eerlijke resultaat is de standaard, en er was geen MT-expertise (of GPU) voor nodig om daar te komen.**

Wanneer de cijfers tegenvallen (en dat doen ze de eerste keer — het standaardmodel is bewust eenvoudig gehouden), ga dan naar [Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training) — deze handleiding vertrekt vanuit de symptomen en is geschreven voor precies dat moment.
