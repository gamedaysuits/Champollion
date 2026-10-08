---
sidebar_position: 4
title: "Een Trainingsrun Diagnosticeren"
description: "Symptoomgerichte probleemoplossing voor MT-training met beperkte middelen — begin bij wat u ziet, vind de waarschijnlijke oorzaak en de forge-hendel die het probleem verhelpt."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Een trainingsrun diagnosticeren

Uw model is getraind. De cijfers zijn niet wat u had gehoopt. Deze pagina vertrekt vanuit
**wat u ziet** en leidt u naar de waarschijnlijke oorzaak en de forge-tool die
het oplost. De meeste hiervan zijn geautomatiseerd — `nmt-forge export` (en zijn score-only
tegenhanger, `nmt-forge evaluate`) voegt een sectie **Diagnose & aanbevelingen** toe
die de bevinding en de sturingsoptie benoemt; deze handleiding is de versie in duidelijke taal,
plus de weinige zaken waarover forge alleen kan *waarschuwen* (gemarkeerd met ⚠ **let hierop**).

Zeg tegen uw agent: *"Voer `nmt-forge lint <battery-manifest.json> --json` uit en handel naar
de bevinding met de hoogste ernst."* Na een export is het battery-manifest
`export/evaluation/battery-hyps-battery.json`. Vergelijk vervolgens wat het rapporteert met de
onderstaande secties.

---

## "De score van het standaardmodel is laag"

U hebt getraind met de standaard `cpu-tiny`-preset en de testscore ligt ergens
tussen 5 en 30 chrF++.

**Wat er gebeurt:** dat is wat deze preset doet. Het is een kleine transformer
die vanaf nul is getraind op uitsluitend uw paren, dus op 1–2 duizend paren leert hij
de frasen en zinsstructuren van uw data, niet de taal in het algemeen — de
bovengrens van dat bereik wordt alleen behaald wanneer de data sterk op sjablonen is gebaseerd. Zijn taak is om
de volledige cyclus tastbaar te maken (afgeschermde dev-set, gecontroleerde data, vooraf geregistreerde testset, een model
dat de CLI kan aanroepen), niet om het model te zijn dat u uitrolt.

**Oplossing:** verander één ding en meet het op de dev-set, in globale volgorde van
rendement:

1. **Meer echte paren.** Bij deze omvang wint data het van elke instelling.
2. **Een voorgetraind startpunt.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` fine-tunt een klein voorgetraind Marian/opus-mt-model op een CPU — kies
   er een voor een *verwante* talencombinatie en vergelijk deze op dev met `cpu-tiny`
   in plaats van aan te nemen dat dit wint. `--model nllb-600m` is het krachtigste startpunt
   en vereist een GPU.
3. **Meer data uit wat u al hebt** — backtranslation van eentalige tekst, of
   geverifieerde synthese als uw taal over een analyzer beschikt (zie
   [Dus u wilt uw eigen model trainen](/docs/network/tutorials/train-your-own-model)).

⚠ **let hierop:** een hoge score van `cpu-tiny` verdient argwaan vóór
men gaat juichen — zie ["De score lijkt te mooi om waar te zijn"](#the-score-looks-too-good).

---

## "Uitstekend op mijn leerboekvoorbeelden, slecht op echte zinnen"

**De meest voorkomende valkuil bij weinig beschikbare data.** Uw synthetische/sjabloongebaseerde data
scoort prachtig; echte tekst valt uiteen.

**Wat er gebeurt:** een **transferplateau**. Tijdens de training bereikte het verlies op uw
echte dev-set vroeg een minimum en steeg daarna terwijl het trainingsverlies bleef dalen — het model beheerste de synthetische *massa*, maar leerde niet te
vertalen. Meer synthetische data zal **niet** helpen.

**forge-bevinding:** `R7-transfer-plateau` (uit het planningsoverzicht van het run-manifest).
**Hefboom: REAL-DATA.**

**Oplossing:** voeg echte tekst toe. Vertaal monolinguale doeltaaldata terug
(`nmt_forge.training.backtranslation`), of verwerf echte parallelle zinnen.
Het volume van synthetische data is niet de hefboom — de variëteit van *echte* data is dat wel.

⚠ **let hierop:** als uw mix ~99% synthetisch is tegenover een kleine echte dev-set,
loopt u dit risico *voordat* u het in de scores ziet. Er is nog geen pre-flight
lint voor een pathologische verhouding — controleer de gold/synthetische
aantallen in uw mix-manifest.

---

## "Één register presteert veel slechter dan de andere"

Bekijk de tabel per register. Één register (bijvoorbeeld overheid of juridisch) scoort
ver onder de rest.

**Twee verschillende oorzaken — de diagnose onderscheidt ze door te kijken naar *dekking*
en of uitvoer *onafgerond* is:**

- **Het model mist de woorden** (`R1-vocabulary-gap`: lage dekking **en** hoge
  onvolledige rate). **Hefboom: VOCABULARY.** Vergroot het lexicon (woordenboek /
  attestatieharvest), voer vervolgens `nmt-forge` trechteranalyse uit om te bevestigen dat de nieuwe
  vermeldingen daadwerkelijk het corpus bereiken — een orthografische mismatch van één teken heeft
  al eerder stilzwijgend duizenden woorden verwijderd.
- **Het model heeft de woorden maar niet de zinsstructuren** (`R2-structure-gap`:
  dekking in orde, toch onafgerond). **Hefboom: STRUCTURE.** Voer de dekkingskaart
  uit tegen uw grammaticachecklist en voeg de ontbrekende constructies toe
  (imperatieven, wh-vragen, bezit, inversie — wat uw sjablonen nooit
  hebben gevraagd).

---

## "De uitvoer mengt spellingen binnen één zin"

Het model schrijft hetzelfde geluid op twee manieren, soms binnen één zin.

**Wat er gebeurt:** uw trainingsdoelen hebben het geleerd dat conventies
uitwisselbaar zijn — het corpus bevatte dezelfde inhoud in meerdere
orthografieën.

**forge-bevinding:** `R3-mixed-convention`. **Hefboom: ORTHOGRAPHY.**

**Oplossing:** `convention-lint` het corpus, normaliseer naar **één** canonieke conventie
op de datagrens, en train opnieuw. Houd een gemengde-conventieratio in uw testbatterij
zodat u kunt zien hoe deze daalt.

---

## "Model B verslaat model A — maar slechts met een klein verschil"

U vergeleek twee modellen en één loopt voor met een fractie van een punt.

**Wat er gebeurt:** het verschil kan kleiner zijn dan de ruis. Op 80
zinnen is een chrF++-kloof van 0,4 een kwestie van toeval.

**forge-bevinding:** `R5-low-power` (het betrouwbaarheidsinterval is breder dan de
delta). **Hefboom: MEASUREMENT.**

**Oplossing:** handel niet op basis van delta's die kleiner zijn dan het BI. Vergroot de evaluatieset voor dat
register, of gebruik `nmt-forge compare` dat een *gepaarde* significantietest rapporteert
in plaats van twee overlappende intervallen. forge toont nooit een kale score — het
interval is er altijd precies zodat u dit kunt zien.

⚠ **let hierop:** een resultaat van een **enkel seed** heeft geen
variantieband over seeds. Een winst die een nieuwe seed niet overleeft, is niet reëel.
Als een beslissing belangrijk is, voer de run opnieuw uit met 2–3 seeds.

---

## "De score ziet er te goed uit"

Verdacht hoog, vooral vroeg in het proces of bij weinig data. Vertrouw op dat vermoeden.

**Controleer, in volgorde:**

1. **Lekkage.** `nmt-forge leak-audit <corpus>` — is er een testzin in de
   training terechtgekomen? Het verwijdert rijen waarvan de prompt identiek is aan een testprompt (zelfs met
   een andere vertaling), rijen waarvan het antwoord identiek is aan een testantwoord,
   en rijen die een testantwoord bevatten, er een fragment van zijn, of er voor ≥90% identiek aan zijn. `nmt-forge run` weigert trainingsrijen die lekken naar een geregistreerde
   testset of verzegelde set (sealed set), dus dit is vooral van belang voor data of een pipeline buiten
   forge — of een testset die u nooit hebt geregistreerd.
2. **Checkpointselectie.** Is het checkpoint gekozen op een **afgeschermde dev-set**,
   en niet op de testset? forge weigert te trainen zonder een dev-set, juist om dit te voorkomen,
   maar een zelfgebouwde pipeline doet dat niet.
3. **Optimisme door bijna-tweelingen (near-twins).** `R4-optimism-bound`: als de "volledige" battery-score
   enkele punten hoger ligt dan de "strikte" score, is het verschil te wijten aan optimisme door drill-siblings. `leak-audit` *behoudt* sjabloon-siblings opzettelijk (*"Ik zie de
   hond"* in de training, *"Ik zie de kat"* in de testset) en vermeldt de testrijen
   die er een hebben; wanneer `eval.near_dupe_corpus` is ingesteld op uw trainingsbestand (de
   starterconfiguratie doet dit) beoordeelt het rapport de testrijen *zonder*
   sibling afzonderlijk, gemarkeerd als "(strict)". **Citeer het strikte getal** voor elke
   claim over generalisatie. Als *elke* testrij een sibling heeft (`R4-recall-not-translation`:
   de strikte subset is leeg, waardoor de score het reproduceren van trainingsfrasen meet),
   en de testset ligt vast, schrijf dan een tweelingvrij corpus naar een eigen
   bestand met `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` en train daarop een tweede, tweelingvrij model (leak-audit
   overschrijft het bestand waarop het eerste model traint niet) — of zorg voor testzinnen
   die onafhankelijk van de trainingssjablonen zijn geschreven.
4. **De uitvoer volgt de invoer niet.** `R9-harness-score-caveat`: het
   mt-eval-rapport geeft aan dat de score gekwalificeerd is — meestal een **nagenoeg constante
   uitvoer**: veel verschillende testzinnen kregen dezelfde paar uitvoeren (een
   ziekenhuismodel beantwoordde 150 verschillende zinnen met 9 uitvoeren; het scoorde
   alsnog chrF++ 48, omdat een veelvoorkomende frase veel tekens deelt met
   veel referenties). Het tweelingvrije model is de gebruikelijke verdachte: wanneer de
   trainingssjablonen zijn verwijderd, kan een klein model terugvallen op zijn meest
   frequente zinnen. forge geeft het voorbehoud door in de bewoordingen van de harness —
   in de exportsamenvatting, `DEPLOY.md`, `status`, `report`, `compare` en
   `lint` — en noemt een dergelijke score nooit zonder dit voorbehoud "het te citeren getal".
   Lees enkele van de uitvoeren (`<export>/evaluation/battery-hyps.jsonl`, op
   de machine die de testset bevat) voordat u de score rapporteert als
   vertaalkwaliteit; meer echte, gevarieerde trainingsparen vormen de hefboom.

---

## "De training stopte bijna onmiddellijk"

De run eindigde na een paar honderd stappen; het model heeft zijn data nauwelijks gezien.

**Wat er gebeurt:** vroegtijdig stoppen verwarde de verwachte synthetisch-zware dev-schommeling met convergentie.

**forge-gedrag:** dit wordt standaard *voorkomen* — `nmt-forge run` leidt een
stop-**ondergrens** af uit uw mix en onderdrukt vroegtijdige stops daaronder, waarbij de
reden wordt gelogd in de `[schedule-sanity]`-regels. Hoe vaak de dev-set wordt geëvalueerd,
wordt eveneens afgeleid uit de omvang van de run, zodat een kleine run niet ongeëvalueerd blijft. Als
u een onverwachte stop ziet, lees dan die regels; het run-manifest legt
precies vast wat er is gebeurd en waarom. (Een run die simpelweg zijn laatste geplande stap
heeft bereikt, wordt gerapporteerd als voltooid, niet als een vroegtijdige stop.)

---

## "De run werd geweigerd voordat hij echt begon"

**Wat er gebeurt:** er is een gate geactiveerd — wat goedkoper is dan een run die pas na
uren mislukt. De meest voorkomende:

- **De training-extra ontbreekt** — `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` met de oplossing,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **Geen dev-set, of de verkeerde** — de dev-fence weigert een run waarvan
  `data.dev` geen geregistreerde set is met rol `dev`. Splits er een af met
  `nmt-forge split … --register project`.
- **Lekkage** — een trainingsbestand deelt prompts of antwoorden met een geregistreerde
  testset of verzegelde set (sealed set). Maak het schoon met `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` en verwijs in de configuratie naar het opgeschoonde bestand.
- **Kloktijd (wall-clock)** — in de eerste minuten meet forge de trainingssnelheid en
  weigert het een run waarvan de prognose `model.time_budget_hours` overschrijdt. Op een CPU betekent
  dit meestal dat de preset een GPU nodig heeft (`nllb-600m`), of dat de mix veel groter
  is dan uw bedoeling was. Het bericht noemt de sturingsopties: een kleinere mix, kortere
  reeksen, of een groter budget als u de wachttijd daadwerkelijk accepteert.

**Oplossing:** voer `nmt-forge preflight run --config config.json` uit vóór elke run;
het toont elke gate, ✓/✗, met de oplossing voor elke ✗.

---

## "Een metriek die ik wilde ontbreekt gewoon in het rapport"

Het rapport is eerlijk maar leeg op een as (COMET, een FST-geldigheidscontrole).

**forge-bevinding:** `R6-referee-unavailable` — de baan wordt als niet beschikbaar vermeld
met de reden. **Hefboom: REFEREE.**

**Oplossing:** installeer/configureer de genoemde referee en bereken de scores opnieuw. Wanneer de
taalkaart de referee declareert, vermeldt het bericht van forge het installatiecommando
(`mt-eval setup --lang <code>`). De scores die u hebt zijn nog steeds betrouwbaar — ze zijn
alleen blind op die specifieke as totdat de referee aanwezig is.

---

## "Het model geeft `<unk>` of onleesbare tekens weer"

Vooral bij een syllabisch of uitgebreid Latijns schrift.

**Het hangt af van de preset.**

- **`cpu-tiny`** leert zijn eigen vocabulaire op basis van uw trainingsrijen, dus elk
  teken dat in de training voorkomt, wordt gedekt. `<unk>` betekent hier dat de invoer
  een teken bevat dat nooit in de training is voorgekomen — een zeldzame letter of
  diakritisch teken, of een afwijkende Unicode-vorm daarvan (tekst wordt genormaliseerd naar NFC, dus
  samengestelde en ontleedde accenten tellen als hetzelfde). Controleer of uw trainings-
  en testdata dezelfde orthografie hanteren.
- **`cpu-finetune` en `nllb-600m`** gebruiken de tokenizer van het voorgetrainde basismodel.

⚠ **let hierop — nog niet geautomatiseerd (voorgetrainde basismodellen).** De **tokenizer
van het basismodel dekt uw doelschrift mogelijk niet af**. forge controleert de
tokenizerdekking nog niet vóór het trainen. Controleer de tokenizer van uw basismodel aan de hand van
steekproeven van uw doelschrift; geef de voorkeur aan een basismodel waarvan het vocabulaire het schrift dekt
(veel talen met weinig bronnen worden gedekt door basismodellen uit de NLLB-familie) of breid de
tokenizer uit vóór de training.

---

## Wanneer forge weigerde en u niet begrijpt waarom

Een weigering vermeldt altijd **wat** er is gebeurd, **waarom** het de resultaten corrumpeert, en de
**oplossing**. Als het nog onduidelijk is:

- `nmt-forge status` — waar u zich bevindt en het eerstvolgende commando.
- `nmt-forge preflight <command>` — elke gate die dat commando zal tegenkomen, ✓/✗, met
  de oplossing voor elke ✗, zodat u ze allemaal tegelijk kunt oplossen in plaats van één voor één
  (voeg voor `run`, `evaluate` en `export` `--config config.json` toe).
- Voeg `--json` toe aan elk commando wanneer een agent het resultaat leest: een weigering
  wordt dan gerapporteerd als één JSON-object — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — met exitcode 2.

Een weigering is geen fout in uw configuratie — het is het hulpmiddel dat een vergissing onderschept voordat
deze uw resultaten bereikt. Dat is het volledige ontwerp.
