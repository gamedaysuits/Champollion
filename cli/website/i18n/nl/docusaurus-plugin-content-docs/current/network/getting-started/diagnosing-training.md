---
sidebar_position: 4
title: "Een Trainingsrun Diagnosticeren"
description: "Symptoomgerichte probleemoplossing voor MT-training met beperkte middelen — begin bij wat u ziet, vind de waarschijnlijke oorzaak en de forge-hendel die het probleem verhelpt."
related:
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

Uw model is getraind. De cijfers zijn niet wat u had gehoopt. Deze pagina begint bij
**wat u ziet** en leidt u naar de waarschijnlijke oorzaak en het forge-hulpmiddel dat
het probleem oplost. De meeste hiervan zijn geautomatiseerd — `nmt-forge evaluate` voegt een
sectie **Diagnose & Aanbevelingen** toe die de bevinding en de hefboom benoemt;
deze gids is de versie in gewone taal, plus de weinige zaken die forge alleen
*kan waarschuwen* (gemarkeerd met ⚠ **let hierop**).

Vertel uw agent: *"Voer `nmt-forge lint <battery-manifest.json> --json` uit en handel naar aanleiding van
de bevinding met de hoogste ernst."* Vergelijk vervolgens wat het rapporteert met de secties
hieronder.

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

1. **Lekkage.** `nmt-forge leak-audit <corpus>` — is een testantwoord in de
   training terechtgekomen? Treffers aan de doelzijde zijn om een goede reden fataal.
2. **Checkpointselectie.** Is het checkpoint gekozen op basis van een **afgeschermde dev-set**,
   niet de testset? forge weigert te trainen zonder een dev-set precies om dit te voorkomen,
   maar een handmatig samengestelde pipeline doet dat niet.
3. **Optimisme door bijna-duplicaten.** `R4-optimism-bound`: als de "volledige" batterijscore
   meerdere punten boven de "strikte" (bijna-duplicaten uitgesloten) score ligt, is het verschil
   optimisme door oefenbroertjes. **Citeer het strikte getal** voor elke generalisatieclaim.

---

## "De training stopte bijna onmiddellijk"

De run eindigde na een paar honderd stappen; het model heeft zijn data nauwelijks gezien.

**Wat er gebeurt:** vroegtijdig stoppen verwarde de verwachte synthetisch-zware dev-schommeling met convergentie.

**forge-gedrag:** dit wordt standaard *voorkomen* — `nmt-forge run` leidt een
stopdrempel **floor** af uit uw mix en onderdrukt vroegtijdige stops daaronder, met logging van de
reden in de `[schedule-sanity]`-regels. Als u een onverwachte stop ziet,
lees die regels; het run-manifest registreert precies wat er is gebeurd en waarom.

---

## "Een metriek die ik wilde ontbreekt gewoon in het rapport"

Het rapport is eerlijk maar leeg op een as (COMET, een FST-geldigheidscontrole).

**forge-bevinding:** `R6-referee-unavailable` — de baan wordt als niet beschikbaar vermeld
met de reden. **Hefboom: REFEREE.**

**Oplossing:** installeer/configureer de genoemde referee en score opnieuw. De scores die u heeft
zijn nog steeds eerlijk — ze zijn alleen blind op die ene as totdat de referee
aanwezig is.

---

## "Het model geeft `<unk>` of onleesbare tekens weer"

Vooral bij een syllabisch of uitgebreid Latijns schrift.

⚠ **let hierop — nog niet geautomatiseerd.** De **tokenizer van het basismodel vertegenwoordigt mogelijk niet uw doelschrift**. forge controleert de tokenizerdekking nog niet vóór de training (het staat bovenaan onze lijst van hiaten). Controleer de tokenizer van uw basismodel aan de hand van voorbeelden van uw doelschrift; geef de voorkeur aan een basis waarvan het vocabulaire het schrift dekt (veel talen met weinig beschikbare data worden gedekt door NLLB-familie-bases) of breid de tokenizer uit vóór de training.

---

## Wanneer forge weigerde en u niet begrijpt waarom

Een weigering vermeldt altijd **wat** er is gebeurd, **waarom** het de resultaten corrumpeert, en de
**oplossing**. Als het nog onduidelijk is:

- `nmt-forge status` — waar u zich bevindt en de eerstvolgende opdracht.
- `nmt-forge preflight <command>` — elke poort die die opdracht zal raken, ✓/✗, met
  de oplossing voor elke ✗, zodat u ze allemaal tegelijk oplost in plaats van één voor één.

Een weigering is geen fout in uw configuratie — het is het hulpmiddel dat een vergissing onderschept voordat
deze uw resultaten bereikt. Dat is het volledige ontwerp.
