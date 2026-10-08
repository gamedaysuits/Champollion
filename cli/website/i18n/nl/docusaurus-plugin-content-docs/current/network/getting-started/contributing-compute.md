---
sidebar_position: 4
title: "Rekenkracht bijdragen"
description: "Voer de wachtrij uit: voer open benchmark-sweeps uit vanuit de publieke wachtrij met uw eigen API-sleutel en publiceer de resultaten."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Rekenkracht bijdragen

> **Het idee:** het scorebord bevat lege vlakken — combinaties van (taalpaar, methode, conditie) die nog door niemand zijn gemeten. We beheren hiervan een openbare wachtrij. U voert items uit met uw eigen API-sleutel, publiceert de rapporten en de kaart wordt ingevuld. Het bijdragen van rekenkracht is een reële, citeerbare bijdrage aan de evaluatie van machinevertaling voor schaars bewaarde talen (low-resource MT).

De wachtrij bevat twee soorten taken. **LLM-items** testen een chatmodel op een
taalpaar, onder een `naive`- of `coached`-promptconditie. **Engine-items**
(conditie `engine`) testen een klassieke MT-dienst — DeepL, Google
Translate, Microsoft Translator, LibreTranslate, Tilde — op paren binnen
de door die dienst zelf gepubliceerde dekking; dit vormt de gemeten ruggengraat van
de dekkingskaart, en tot 2026-08 waren deze vrijwel volledig blanco. Beide
soorten worden uitgevoerd via dezelfde testomgeving (harness) en gepubliceerd naar hetzelfde scorebord.

## De wachtrij

De actuele wachtrij wordt aangeboden vanuit de database (de harness leest deze standaard uit); een compacte momentopname is gepubliceerd op [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), en het volledige bestand is te vinden op [queue.json](https://champollion.dev/queue.json) (tientallen MB's — de preview is de aangewezen eerste download). U kunt op [de live kaart op champollion.dev](https://champollion.dev) volgen wat uw runs opleveren — de dekkingskaart van wie wat kan vertalen. Er is ook een terminalviewer zonder installatie:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

De viewer *toont* alleen open items en hun exacte `mt-eval run`-opdrachten — hij voert nooit iets uit en verbruikt geen tokens. Elk item bevat:

- `run_command` — direct te kopiëren en plakken (haalt het corpus op, voert de harness uit)
- `est_cost_usd` en `est_basis` — hetzij de **waargenomen** kosten van onze eigen baselinerun van hetzelfde (corpus, model), hetzij een **extrapolatie** op basis van de gemiddelde kosten per invoer van dat model over de hele sweep × het aantal items in het corpus. De grondslag wordt per item vermeld; uw werkelijke kosten zijn afhankelijk van de tarieven van de provider op het moment van uitvoering.
- `priority` — de gepubliceerde rangschikking (verkenningsmodus: eerste metingen over
  paren, talen en taalfamilies per dollar). De preview bevat tevens
  **budgetniveaus** — wat u aan de top van de rangschikking krijgt voor
  $ 1 / $ 10 / $ 100 / $ 1000 (bereikte items, paren, modellen) — zodat u een bijdrage
  kunt afwegen voordat u iets uitgeeft. Het onderliggende waardemodel is **verwachte
  ketenwaarde** (expected chain value): hoeveel deze ene run naar verwachting het gehele taalnetwerk versterkt, per geschatte dollar. Elk item bevat een volledige uitsplitsing van de formule (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`), zodat elke positie handmatig kan worden nagerekend — de formule en de standaardwaarden zijn gepubliceerd in de [Queue Construction Specification](/docs/network/specifications/queue-construction), en de onderbouwing ervan in [Why the Queue Is Built This Way](/docs/network/perspectives/why-the-queue).

**Geen claimvergrendeling — kies elk open item.** Twee personen die hetzelfde item uitvoeren is by design onschadelijk: elke run-kaart heeft een vingerafdruk (SHA-256 over dataset-hash + model + conditie + systeemprompt, [Benchmark Spec §3.8](/docs/network/specifications/benchmark)), zodat identieke runs bij publicatie worden gededupliceerd, en onafhankelijke herhalingen van dezelfde configuratie zijn nuttig bewijs, geen verspilling.

Corpora in de wachtrij zijn dev-splits, CC-BY-familie (afgeleid van Tatoeba), en gemarkeerd als `do_not_train` — het zijn evaluatiesets, geen trainingsdata. Corpora met niet-commerciële licenties en in quarantaine geplaatste corpora zijn uitgesloten van de open wachtrij.

## Instelling (eenmalig)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Welke providersleutel?

De harness accepteert vier providersleutels, geselecteerd met `--provider` op `mt-eval run` en `mt-eval queue` — of automatisch gedetecteerd op basis van de sleutel die is ingesteld in uw omgeving of `.env`:

| `--provider` | Sleutel | Bereikt |
|---|---|---|
| `openrouter` (standaard) | `OPENROUTER_API_KEY` | elk model in de wachtrij-lineup |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Claude-modellen |
| `openai` | `OPENAI_API_KEY` | OpenAI GPT-modellen |
| `gemini` | `GOOGLE_API_KEY` | Google Gemini-modellen |

Eén [OpenRouter](https://openrouter.ai/keys)-sleutel bereikt elk model in de lineup, en de kostenbewaking en prijsopnames van de harness zijn afkomstig van dezelfde OpenRouter-metadata, zodat de gerapporteerde runkosten overeenkomen met wat uw sleutel in rekening is gebracht — dat is waarom het de standaard is. Als uw credits rechtstreeks bij Anthropic, OpenAI of Google staan, stel dan de sleutel van die leverancier in en roept de harness de API van de leverancier aan zonder proxy. Een directe sleutel bereikt alleen de eigen modellen van die leverancier (handig voor een batch van één leverancier), en de kostencijfers zijn afkomstig van de gepubliceerde leveranciersprijzen in plaats van gefactureerde metadata — beschouw ze als benaderende schattingen. Als zowel een OpenRouter-sleutel als een directe sleutel zijn ingesteld, kiest automatische detectie voor OpenRouter; de wachtrij-worker meldt dit en legt uit hoe u dit kunt overschrijven met `--provider`. Elke run-kaart registreert via welk kanaal de run is uitgevoerd in het veld `api_provider`.

(`mt-eval run` accepteert ook `--provider local` voor zelf-gehoste OpenAI-compatibele endpoints — Ollama, vLLM, LM Studio — via `--base-url`. Dit is een expliciete opt-in en wordt nooit automatisch gedetecteerd.)

### Geen API-sleutel: voer een lokaal gehost model uit

U hebt helemaal geen cloudsleutel nodig. De methode `local-model` voert een open neuraal MT-model uit op uw eigen hardware — de modellen die niet door clouddiensten worden aangeboden, precies waar de dekking voor schaars bewaarde talen zich bevindt: **NLLB-200**, **OPUS-MT** (Helsinki-NLP) en **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
python3 -m pip install 'mt-eval-harness[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Twee gebruikelijke manieren om een model te laden, automatisch geselecteerd — niets te configureren:**

- **transformers** (standaard): `--model` is een Hugging Face-hub-id (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) of een lokale `from_pretrained()`-map. Vereist `python3 -m pip install 'mt-eval-harness[local-models]'`.
- **CTranslate2** (snelle CPU/GPU-inferentie): `--model` is een naar CTranslate2 geconverteerde modelmap (gegenereerd door `ct2-transformers-converter`, met daarin een `model.bin`). Vereist `python3 -m pip install 'mt-eval-harness[ctranslate2]'`. De tokenizer wordt uit de geconverteerde map gelezen of gespecificeerd met `LOCAL_TOKENIZER_ID`.

De backend wordt gedetecteerd aan de hand van het modelpad (een CTranslate2-map bevat een `model.bin`); forceer deze indien nodig met `LOCAL_MODEL_BACKEND=transformers|ctranslate2`.

**`-m` / `--model` is vereist.** `local-model` heeft geen standaardmodel: een run zonder model wordt geweigerd, en de runkaart registreert het model dat daadwerkelijk is geladen (een hub-id met bijbehorende revisie, of een map met een SHA-256-hash over de bestanden). Bij een Hugging Face-id worden de gewichten bij de eerste run gedownload naar de Hugging Face-cache (verplaats deze met `HF_HOME`).

**Een paarspecifiek model bepaalt zijn eigen paar.** Een OPUS-MT-model (`Helsinki-NLP/opus-mt-<src>-<tgt>`) vertaalt uitsluitend het paar in de modelnaam. Een run waarvan het corpus een ander paar betreft, wordt geweigerd, tenzij u `--allow-model-pair-mismatch` meegeeft — bedoeld voor een doelbewuste baseline met verwante talen (bijvoorbeeld `opus-mt-en-fi` op een Engels→Noord-Samische dataset); de runkaart registreert de mismatch.

**Taalcodes zijn afkomstig van de taalkaart, niet van een aanname.** Voor een meertalig model zoals NLLB leest de harness de FLORES-200-code rechtstreeks van de kaart van de doeltaal (dezelfde bron van waarheid die elke methode hanteert). Een taal die het model daadwerkelijk niet ondersteunt — NLLB-200 bevat bijvoorbeeld geen Plains Cree (`crk`) — **faalt op integere wijze** ("out of scope for this model") in plaats van een ongeldige code en een aannemelijke maar foutieve vertaling te produceren. OPUS-MT-modellen zijn paarspecifiek, dus het paar *is* het model.

Een run met een lokaal model wordt op exact dezelfde wijze beoordeeld en gepubliceerd als elke andere run — dezelfde meetwaarden, dezelfde runkaart, hetzelfde scorebord. (Het is een harness-methode; het CLI-vertaalprogramma maakt hier later verbinding mee via een subprocess-bridge, waardoor Node nooit een Python ML-stack nodig heeft.)

### Het snelle agentpad

Als u werkt met Claude Code of een andere codeeragent, is de volledige bijdrage één prompt:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — Één opdracht

De snelste manier om bij te dragen is de harness de bovenkant van de
wachtrij voor u te laten verwerken:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

De harness sorteert nooit opnieuw — de wachtrij-volgorde *is* het [prioriteitsmodel](/docs/network/specifications/queue-construction) — en toont het volledige plan met geschatte uitgaven en vraagt om bevestiging voordat er iets wordt uitgevoerd. Begeleide items worden overgeslagen tenzij u uw eigen coachingbestand meebrengt
(`--include-coached --coaching-file my-coaching.txt`).

**De wachtrij-worker publiceert namens u — geen account vereist.** In tegenstelling tot een enkele
`mt-eval run` (die nooit automatisch publiceert), bepaalt `mt-eval queue` een
publicatie-identiteit *voordat* er tokens worden verbruikt en **publiceert elke
succesvolle run automatisch** naar het leaderboard zodra deze is voltooid — geen afzonderlijke publicatiestap. Meld u aan (GitHub/Google) alleen als u uw naam op het bord wilt; anders gaat u anoniem verder en worden resultaten geplaatst als indiener `anonymous`
(`--anonymous` dwingt dit af, en niet-interactieve `curl | bash`-runs zonder gecachte aanmelding gebruiken dit standaard en melden dit expliciet). Geef `--no-publish` door om
resultaten lokaal te bewaren (u kunt ze later publiceren met `mt-eval
publish`). Volg vervolgens wat uw runs hebben opgebouwd op
[de live kaart op champollion.dev](https://champollion.dev).

## Tier 1 — Een benchmark uitvoeren

De `run_command` van elk wachtrij-item is op zichzelf staand. Een typisch voorbeeld:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

U geeft het **registry-id** door, niet een bestand — de harness haalt de referentie op uit de upstream-bron op het moment van uitvoering en scoort op basis van de vers opgehaalde data (corpusinhoud wordt hier nooit gehost of bijgehouden).

De run drukt de totale kosten af en schrijft een runlog plus een gescoord rapport naar `eval/logs/`. Publiceer vervolgens:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**Geen account vereist.** Bij publicatie wordt een OAuth-aanmelding aangeboden (GitHub/Google) zodat uw naam de leaderboard-attributie wordt — maar dit is optioneel: `mt-eval publish <report> --anonymous` publiceert zonder account, en de rij wordt weergegeven zoals elk ander zelf-gebenchmarkt resultaat met indiener `anonymous`. De anonieme intake is snelheidsbeperkt (een paar kaarten per uur per verbinding; aanmelden is het onbeperkte pad) en doorloopt dezelfde database-integriteitsprocedures als elke andere inzending — quarantaine, scorebereiken, corpus-sha-binding en de corpus-inhoudsbeveiliging zijn allemaal identiek van toepassing. Anoniem of toegeschreven, community-inzendingen komen terecht op het **zelf-gebenchmarkt** vertrouwensniveau — duidelijk gelabeld als "ingediend door de persoon die het heeft uitgevoerd." Dat is geen degradatie; het is het vertrouwensmodel dat werkt. De run-kaart bevat alles wat nodig is om uw exacte configuratie opnieuw uit te voeren: dataset-hash, model, conditie, de volledige systeemprompt en kosten. Hogere niveaus (verificatie, community-validatie) worden toegekend na beoordeling — zie [Leaderboard-regels](/docs/network/leaderboard/rules).

:::note[Moderatie]
Anonieme rijen worden gemodereerd zoals al het andere: inzendingen zijn onveranderlijk voor de publieke API, en elke curatorverwijdering of -correctie verloopt via het service-role-kanaal, waarbij het auditspoor van de database de vorige rij bewaart — zodat een verwijdering wordt geregistreerd en omkeerbaar is, nooit stilzwijgend.
:::

## Tier 2 — Begeleide prompts opstellen

De harness heeft eersteklas ondersteuning voor **coaching**: vervang de naïeve systeemprompt door een prompt die echte taalkundige kennis bevat. Geef `--coaching-file` door (of `--coaching "inline text"` voor korte prompts) en de harness gebruikt uw tekst als systeemprompt, registreert de **volledige tekst plus de SHA-256** ervan in het provenanceblok van het runlog, en labelt de conditie van de run als **`coached`** (tenzij u `--prompt` expliciet instelt) — zodat promptontwerp een reproduceerbaar, toeschrijfbaar experiment is, twee verschillende coachingbestanden nooit met elkaar verward kunnen worden, en begeleide runs nooit worden aangezien voor naïeve basislijnen op het leaderboard.

Een uitgewerkt voorbeeld voor het Faeröers, met typologische feiten en woordenlijstvermeldingen van de [publieke taalkaart](https://champollion.dev/languages) van de taal:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Schrijf uw eigen coachinginhoud — de bovenstaande feiten illustreren de *vorm*: een paar grammaticaregels met grote impact, een kleine woordenlijst van termen die het model fout doet, een registerinstructie. Taalkaarten op [champollion.dev/languages](https://champollion.dev/languages) verwijzen naar typologiebronnen waaruit u kunt putten.)

Vergelijk met de naïeve basislijn met `mt-eval compare <naive_log> <coached_log>`, itereer, en publiceer uw beste run. De run wordt automatisch gepubliceerd met conditie `coached`; als u wilt dat het leaderboard een benoemde methode toont in plaats van het generieke label, voeg dan een methodekaart toe bij publicatie (de publicatiestroom biedt een wizard). De naïeve basislijn verslaan op een taalpaar met weinig middelen met niets anders dan prompt-engineering is een echte, publiceerbare bevinding — zie het volledige [Kookboek voor begeleide LLM-prompting](/docs/network/tutorials/coached-llm-prompting) voor ontwerprichtlijnen.

## Tier 3 — Een methode bouwen

De meest ambitieuze bijdrage: implementeer het `TranslationMethod`-protocol (`translate(entries, config)`) en benchmark een daadwerkelijk systeem, niet een prompt. De harness voert het uit via `--method <plugin-dir>` en sluit uw methodekaart in de run-kaart in. Patronen met uitgewerkte kookboeken:

- **[FST-gestuurde pipelines](/docs/network/tutorials/fst-gated-pipeline)** — elk kandidaatwoord wordt gecontroleerd door een morfologische analysator; de LLM genereert opnieuw totdat de poort doorkomt. Semi-deterministisch, morfologisch gegarandeerde uitvoer.
- **[Woordenboek-aangevulde generatie](/docs/network/tutorials/dictionary-augmented-llm)** — zoek bronterm op in een tweetalig lexicon op het moment van vertaling en beperk de uitvoer.
- [Geketende modellen](/docs/network/tutorials/chained-models), [few-shot retrieval](/docs/network/tutorials/few-shot-prompting), [terugvertaling](/docs/network/tutorials/back-translation), [regelgebaseerde hybriden](/docs/network/tutorials/rule-based-hybrid)…

Methoden declareren een **afhankelijkheidsklasse** (S/O/A1/A2/X — zie [de methodespecificatie](/docs/network/specifications/methods#method-validity-and-dependency-classes)) die beschrijft wat ze nodig hebben om te draaien en over te dragen: een op zichzelf staande pipeline is Klasse S; een pipeline die tijdens uitvoering een gelicentieerde woordenboek-API aanroept is A2. Declareer eerlijk — de klasse bepaalt waar uw methode kan meedingen, en manifesten worden geauditeerd.

## Waarom dit verder reikt dan het leaderboard

Elke gepubliceerde run is onafhankelijk bewijs over de kwaliteit van machinevertaling voor een taalpaar dat commerciële providers niet meten. De wachtrij fungeert ook als een publiek register van *vraag*: welke paren de community het waard acht om te meten, wat dekking kost tegen huidige API-prijzen, en hoe ver bijgedragen rekenkracht reikt. Wanneer we financieringsinstanties vragen om systematische sweeps te bekostigen, zijn deze wachtrij en de mate waarin deze wordt gevuld het bewijs van die vraag.
