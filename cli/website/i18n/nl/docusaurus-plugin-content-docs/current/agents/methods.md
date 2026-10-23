---
title: "Methoden en gates"
slug: /agents/methods
description: "method/1 en gate-chain/1 zoals elke Champollion-tool ze leest, een FST-validatiegate als uitgewerkt voorbeeld, en de methoderecepten naast het standaard getrainde model — gecoacht LLM, few-shot, aangevuld met woordenboek, regelgebaseerde hybride, geketend, gedeeltelijke vertaling, gefinetuned — elk met wat het waarheen stuurt."
---

# Methoden en poorten

Een **methode** is alles wat vertaalt: een getraind model, een ge-prompte LLM, een
opzoeking in een woordenboek, een regelengine, een service, mensen. Een **poort** is een controle
tussen de uitvoer van een methode en wat daadwerkelijk wordt geleverd. De standaardmethode van het framework is een
model dat getraind is met nmt-forge ([training](/docs/agents/training)); deze pagina beschrijft
het formaat waarin beide zijn geschreven en de overige recepten.

Elk onderstaand recept voldoet aan de [overdrachtsregels](/docs/agents/data-rules):
**een methode die een modelprovider aanroept, stuurt tekst naar die provider**, en een
lokaal-alleen, verzegeld of toestemming-vereist bestand weigert dit.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Vereist: `id`
(kleine letters gescheiden door koppeltekens), `name`, `kind` — plus de ene instelling
die dat type nodig heeft, gecontroleerd door de lezers met dezelfde meldingen in beide
runtimes.

| `kind` | Vereiste instelling | Draait in | Stuurt tekst naar |
|---|---|---|---|
| `llm` | `model` (een exacte id, nooit een alias); optioneel `provider` | CLI; testomgeving via `-m` en `--provider` | De provider |
| `llm-coached` | `model`; de coaching staat in `coaching` (`file`, `prompt` of `dir`) | CLI; testomgeving via `-m` en `--coaching-file` | De provider: de zinnen en de coaching |
| `mt-api` | `engine` (uit `shared/method-registry.json`) | CLI; testomgeving | De service van de engine |
| `local-model` | `model` (een Hugging Face-id of een lokale map) | Testomgeving, in-process | Nergens heen |
| `nmt-checkpoint` | `model_dir` | Via de bijbehorende service (`nmt-forge serve`) | De server van deze computer |
| `lexicon` | `dictionary` | Testomgeving, in-process | Nergens heen |
| `python` | `entry_point` (`module:Class`) | Testomgeving (`mt-eval run --method <folder>`) | Waar de plug-in het ook heen stuurt (`dependency_class`) |
| `service` | `service.endpoint` | CLI (`api`-methode) | Dat eindpunt |
| `human` | — | Mensen; beoordeel hun uitvoer met `mt-eval test` | — |

Optioneel: `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (wat het
scorebord toont), `dependency_class` (`S` zelfstandig, `O` open extern,
`A1`/`A2` API-afhankelijk, `X` gesloten), `evidence` (gemeten runs: `dataset`,
`metric`, `score`, `ci`, `n` — alleen getallen), `runtimes` (`cli`, `engine`).

**Waar een method.json vandaan komt:** `methods/<id>/method.json` in een project;
`nmt-forge export` (type `nmt-checkpoint`); `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Oudere structuren (het CLI-plug-inmanifest met
`type`, het testomgeving-plug-inmanifest met `entry_point`) worden nog steeds gelezen, als
method/0, met een waarschuwing. Een document dat `$schema` bevat, wordt gelezen als
method/1 en moet valideren.

**Welke runtime welk type accepteert.** De CLI weigert `python`, `lexicon`,
`local-model` en `human` (*"draait in de evaluatie-engine (mt-eval run --method),
niet in de champollion-CLI — of serveer het en gebruik het via het bijbehorende eindpunt"*).
De `--method <folder>` van de testomgeving laadt alleen `python`; voor elk ander type
geeft het de vlaggen aan waarmee u het in plaats daarvan uitvoert.

**Decodering.** De standaardtemperatuur is **0** (`shared/model-defaults.json`):
één waarde voor zowel de vertaaltemperatuur van een app als de evaluatietemperatuur van de testomgeving, zodat
wat gemeten wordt overeenkomt met wat wordt geleverd — `mt-eval run --temperature` gebruikt dit standaard.
Een taalpaar, een configuratie of een run kan een eigen waarde instellen.
Model-id's zijn exacte slugs, nooit aliassen.

## Poortketens

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, één bestand in
`gates/`. Vereist: `id`, `gates` (een of meer). Optioneel: `description`,
`fallback`.

Elke poort: `id`, `kind` (`metric-threshold`, het enige type), `metric` (de
naam van een metriek-plug-in), `field` (een sleutel in het resultaat per segment van die plug-in — een
getal, of true/false gelezen als 1/0), `min` en/of `max`, `on_refuse`.

**De regels** (`arena/mt_eval_harness/gates.py`):

- Poorten draaien op volgorde; de **eerste** poort die een segment weigert, bepaalt wat
  er wordt geleverd:

  | `on_refuse` | Levert | Geteld als |
  |---|---|---|
  | `drop` | niets | geweigerd |
  | `keep-source` | de brontekst | geweigerd |
  | `flag` | de uitvoer, gemarkeerd | gemarkeerd, niet geweigerd |
  | `fallback` | de vertaling van de fallback, mits dezelfde poorten deze accepteren; bij herhaalde weigering niets | geweigerd |

- **Vergrendeling.** Een segment dat de plug-in niet kan beoordelen, wordt geweigerd (`no_value`, of
  `plugin_error:<type>`) — en nooit geleverd alsof het goedgekeurd is.
- **Vergrendeling.** Een poort waarvan de plug-in niet is geladen, of hier niet kan beoordelen, stopt de
  run voordat er iets vertaald wordt: *"een poort die niet kan oordelen, wordt nooit
  als geslaagd behandeld"*.
- **Vergrendeling.** De fallback moet in dit proces draaien (`lexicon`, `local-model`,
  of een plug-in die `dependency_class` `S` of `O` declareert), zodat een geweigerd segment
  nergens naartoe lekt.
- **Vergrendeling.** `mt-eval run` en `mt-eval test` weigeren een keten met een `fallback`-poort:
  *"een fallback is bedoeld voor serving en vertaling, nooit voor een meting:
  de score zou deels van deze methode en deels van de fallback zijn, onder één
  naam"*. Meet de fallback als een opzichzelfstaande methode.
- **Waar poorten van toepassing zijn:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates` en de `gates` van een implementatie.
- Bij een meting scoort de hoofdscore wat er daadwerkelijk geleverd wordt; de ongepoorte chrF++ en het
  weigeringspercentage staan ernaast, en de vingerafdruk van de keten (sha256 van de
  canonieke JSON) reist mee met het rapport ([meting](/docs/agents/measurement#gated-measurement)).
  Bij `keep-source` beoordeelt de hoofdscore de brontekst waar deze is geleverd.
- **Vergrendeling.** Elke poort vereist `min` en/of `max`, poort-id's zijn uniek, en een
  `fallback`-poort vereist de `fallback` van de keten — `champollion validate` en
  de testomgeving geven hetzelfde eindoordeel. Het opnieuw proberen van een geweigerd segment met de
  reden van de poort is niet ingebouwd.

## Uitgewerkt voorbeeld: een FST-validatiepoort

Een eindige-toestandsanalysator (FST) bepaalt of een woord een goedgevormd woord van de
taal is. De metriek-plug-in `giellalt_fst_validity` van de testomgeving rapporteert per
segment `fst_total_words`, `fst_valid_words`, `fst_invalid_words` en
`fst_validity_rate` (0–1). Woorden worden gesplitst op witruimte waarbij leestekens aan de randen
worden verwijderd; een woord met een hoofdletter wordt opnieuw geprobeerd in kleine letters.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- De analysator is **niet meegeleverd**: de testomgeving levert alleen pins (een bestandsnaam
  en sha256 per taal), en `setup --lang` haalt de analysator op bij de
  bronlocatie naar `~/.mt-eval/fsts/<code>/`, onder de voorwaarden van die bronlocatie. Het wordt
  uitgevoerd als een afzonderlijk hulpprogramma en nooit gekoppeld aan de `champollion`-CLI.
- Een ontbrekende analysator resulteert nooit in een nul: als metriek wordt deze als niet
  berekend gemarkeerd; als poort stopt deze de run.
- Een lege uitvoer krijgt de score 0 en wordt geweigerd onder `min`.
- Om hiermee te serveren, gebruikt u `on_refuse: "fallback"` en een `fallback` zoals
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — uitsluitend voor
  `translate` en `serve`.
- **Opmerking.** FST-acceptatie betekent dat een woord bestaat, niet dat de zin
  de juiste betekenis heeft. Het is een diagnostisch hulpmiddel: het telt nooit mee in de chrF++-hoofdscore.

## De recepten

### Ge-coachte LLM (`llm-coached`)

Een algemeen model dat wordt aangestuurd met instructies van de taalgemeenschap: grammaticale opmerkingen, stijl,
termen.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **In de testomgeving** *is* de tekst van het coachingbestand de volledige systeemprompt;
  deze moet dus specificeren wat er vertaald moet worden en dat alleen de vertaling uitgevoerd mag worden.
  `--glossary` is een invoer voor de scoring (naleving van terminologie) en wordt nooit verzonden.
- **Vergrendeling.** Een run in de testomgeving heeft één coaching: `--coaching-file`, `--coaching`
  (inline tekst) of het oudere `--custom-prompt` — geef er één op. Twee tegelijk worden
  geweigerd: *"--coaching-file and --coaching each give the run its coaching —
  give one (put inline text in the file, or drop the file)"*.
- **In de CLI** stuurt `llm-coached` zijn eigen prompt met de coaching als een
  "Coaching guidance"-blok, plus `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Opmerking.** Dit zijn twee verschillende prompts: een ge-coachte score gemeten in de
  testomgeving is niet exact dezelfde prompt als die de CLI levert. Vermeld dit wanneer u de een
  als bewijs voor de ander aandraagt.
- **Verzendt:** elke bronzin en de volledige coaching naar de provider. Een
  coachingbestand met een lokaal-alleen sidecar draait alleen op een loopback-eindpunt
  (`champollion data mark coaching.md --local-only` markeert dit).

### Few-shot

Voorbeelden van goede vertalingen binnen de coaching. Dit is een ge-coachte LLM: dezelfde
commando's, hetzelfde transport — de voorbeelden reizen in de systeemprompt mee naar de
provider.

- **Opmerking.** Neem nooit voorbeelden uit de testset en nooit uit een
  lokaal-alleen bestand voor een externe provider. Niets controleert few-shot-voorbeelden
  automatisch tegen testreferenties.

### Woordenboek-verrijkte LLM

- **CLI:** de `dictionary` in `.champollion/coaching/<locale>.json` wordt naar
  elke LLM-methode verzonden als "REQUIRED TERMINOLOGY" voor de termen die in elke
  batch worden aangetroffen (hoofdletterongevoelige substring-match). DeepL ontvangt dit als een verklarende woordenlijst.
  Overtredingen leveren een waarschuwing op na de vertaling; er is geen nieuwe poging.
- **Testomgeving:** een woordenboek bereikt het model uitsluitend als tekst in het coachingbestand.
- **Woordenboek alleen:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — langste frase eerst, onbekende woorden behouden, in-process.
  `nmt-forge floor` is dit, toegepast op de dev-set
  ([meting](/docs/agents/measurement#the-dictionary-floor)).
- **Verzendt:** de overeenkomende items uit het woordenboek, samen met de zinnen, naar de
  provider. Een lokaal-alleen woordenboek mag niet naar een externe provider worden gestuurd.

### Regelgebaseerde hybride

Er is geen regelengine ingebouwd. Wat wel bestaat: `lexicon` (deterministisch, in-process);
`mt-eval run --method apertium` (een regelgebaseerde engine — deze stuurt tekst
naar `apertium.org` tenzij `APERTIUM_API_URL` naar uw eigen server verwijst); en
`python`-plug-ins voor uw eigen regels, eventueel in combinatie met een LLM. Een plug-in-klasse
vereist `async def translate(self, entries, config)`; voer deze uit met `mt-eval run
--method <folder>`. Valideer de uitvoer met een poortketen.

- **Verzendt:** wat de plug-in ook aanroept. Een plug-in is een externe methode: bij een
  toestemming-vereist of verzegeld corpus (inclusief lokaal-alleen) weigert de testomgeving
  deze, tenzij `--attest-local-transport` — wat u uitsluitend meegeeft nadat u hebt geverifieerd
  dat alles wat de plug-in aanroept zich op deze machine bevindt.

### Gekoppelde methoden

Er zijn twee ketens ingebouwd:

1. **De fallback van een poortketen:** methode → poorten → in-process fallback → dezelfde
   poorten. Uitsluitend voor `translate` en `serve`.
2. **De taalpaar-fallback van de CLI** (`"fallback": {"method": …}` op het taalpaar van een app):
   primaire methode → de kwaliteitscontrole van de CLI → een nieuwe poging met de feedback van de poort
   (LLM-methoden, of een `api`-eindpunt dat `acceptsInstructions` declareert) →
   eenmalig de fallback, door dezelfde poort.

Alles wat uitgebreider is (genereren, bewerken, valideren over meerdere modellen heen) is een `python`-plug-in
of een `service`.

- **Verzendt:** elke schakel verzendt wat zijn type verzendt. Een keten is net zo privacygevoelig als zijn
  minst private schakel.

### Gedeeltelijke vertaling (mensen en machines)

Het model stelt een concept op; een spreker controleert en corrigeert. Binnen het raamwerk is dit de
verbeteringsronde: `champollion improve sheet` stelt concepten op, de spreker markeert `Y`/`N`/`?`,
`champollion improve marks` zet correcties en bevestigde concepten om in trainingsparen
en oefenregels in dev-zinnen ([coaching](/docs/agents/coaching)).
Om vertalingen van mensen zelf als methode te beoordelen (`kind` `human`), voert u
`mt-eval test` uit op hun uitvoer. Een poort met `on_refuse: "flag"` markeert uitvoer
voor beoordeling.

- **Opmerking.** Een zin die wordt gebruikt om een methode te coachen of te trainen, mag nooit een zin zijn
  waarop deze wordt beoordeeld.
- **Verzendt:** niets buiten de eigen regels van het conceptmodel; de werkbladen blijven in
  de projectmap.

### Fijn-afgesteld model

- **Binnen het framework:** `nmt-forge` (`nmt-checkpoint`; voorinstellingen `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), geëxporteerd,
  geserveerd en verbonden —
  [training](/docs/agents/training), [serving](/docs/agents/serving).
- **Een open model dat u al heeft:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — in-process; er verlaat niets de machine.
- **Een LLM die u zelf host** (Ollama, vLLM, alles wat compatibel is met OpenAI):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. Dit telt alleen als lokaal wanneer het eindpunt een loopback-adres is.
- **Verzendt:** niets buiten de machine, wanneer het eindpunt daadwerkelijk lokaal is.

## Meer verdieping

- [De methodespecificatie](/docs/network/specifications/methods) en het
  [plug-inmanifest](/docs/reference/plugin-spec) (de oudere structuur).
- [Serving en implementatie](/docs/agents/serving) — deployment/1 en
  service-api/1.
- [Meetregels](/docs/agents/measurement) — gepoorte scores.
- [Gegevens- en overdrachtsregels](/docs/agents/data-rules) — wat verzonden mag worden.
- [Vertaalmethoden voor apps en websites](/docs/guides/translation-methods).
