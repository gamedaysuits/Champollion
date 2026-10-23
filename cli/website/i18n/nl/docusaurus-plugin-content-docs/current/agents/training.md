---
title: "Trainen met nmt-forge"
slug: /agents/training
description: "Hoe nmt-forge een model op de rails traint en test: de modelpresets en wat --model auto kiest op basis van geheugen, de bewaakte lus commando voor commando, decoderings- en lengtelimieten, achtergrondtaken en de wachtrij van één training tegelijk, schijfruimte (bewaarde checkpoints, de schijfcontrole, tidy), exporteren en serveren, de verbeteringsrondes (het oordeel over de ronde, het oordeel van de spreker) en het aanbod voor een sterker model, synthetische data, een geverifieerde tabel voor symptoom → oorzaak → oplossing, en de foutentaxonomie."
---

# Trainen met nmt-forge

`nmt-forge` traint een model op de paren van de gemeenschap, binnen vangrails: het
weigert wat een resultaat zou corrumperen, en elke weigering vermeldt wat, waarom en de
oplossing. Het implementeert geen eigen metriek — elke score is afkomstig van de
evaluatie-engine (`mt-eval`), dezelfde code die al het andere scoort.

Op de rails typt u deze commando's zelden: `champollion next` noemt ze,
en vanaf de stap `forge` geeft het de eigen adviseur van forge
door (`nmt-forge status`). Deze pagina beschrijft wat die stappen doen.

## Modellen

`nmt-forge init --model <preset>` schrijft een voorinstelling naar `config.json` als
expliciete getallen (gehasht in de identiteit van elke run: een latere release van forge
wijzigt de runs van een bestaand project nooit). `nmt-forge use-model <preset>`
schakelt een project om.

| Voorinstelling | Wat het is | Vereist | Wat forge aangeeft te verwachten |
|---|---|---|---|
| `cpu-tiny` | Een kleine transformer, vanaf nul getraind op de paren, met een woordenschat van 4.000 elementen geleerd uit de trainingsrijen | Alleen CPU · geen download | "op ~1–2k paren: chrF++ ongeveer 5–30 (de bovenkant alleen voor sterk sjabloongebaseerde data) — uit het hoofd geleerde frasen en sjablonen uit uw data, geen algemene vertaling" |
| `byt5-small` | Google's ByT5-small (300M parameters, leest bytes — geen vocabulaire om aan te passen), gefinetuned | ~1,2 GB download · Apple silicon of een CUDA-GPU aanbevolen | "in de eigen tests van forge leerde het veel meer van dezelfde paren dan cpu-tiny — meet het nog steeds af tegen uw model in gebruik op uw dev-set" |
| `byt5-small-lowmem` | Hetzelfde model, dezelfde leersnelheid en lengtelimieten, ingesteld voor een computer met 8–15 GB geheugen: Adafactor, gradient checkpointing en batches van 4 paren 4 keer geaccumuleerd (dezelfde 16 paren per stap) — minder geheugen per stap, meer tijd. Nog niet gemeten op een 8 GB-computer | als `byt5-small` | als `byt5-small` |
| `cpu-finetune` | Een klein voorgetraind Marian/opus-mt-model, gefinetuned op CPU. U geeft de basis op (`--base`); deze wordt nooit geraden | Alleen CPU · ~300 MB download | "hangt af van hoe verwant de doeltaal van de basis is — meet het af tegen cpu-tiny op uw dev-set" |
| `nllb-600m` | NLLB-200 distilled 600M met LoRA | een CUDA-GPU (8 GB+) · ~2,5 GB download | "de sterkste van de drie wanneer NLLB een verwante taal dekt; meet het nog steeds — ga er nooit zomaar van uit" |

Elke voorinstelling traint met de training-extra van forge (`nmt-forge[hf]`), met seed 42.
Geen enkele voorinstelling stelt een tijdsbudget in: dat getal is aan de gemeenschap.

- **Zonder `--model`** schrijft `init` `cpu-tiny`.
- **`--model auto`** (wat de rails doorgeven) leest het geheugen van de GPU waarop forge
  kan trainen — op een Mac met Apple silicon het geheugen van de computer (gedeeld
  met de GPU); met `nvidia-smi` op `PATH` dat van de grootste NVIDIA-kaart:
  16 GB of meer (of geheugen dat het niet kan lezen) → `byt5-small`; 8–15 GB →
  `byt5-small-lowmem`; onder 8 GB → `cpu-tiny`. Met geen van beide GPU's `cpu-tiny`.
  De reden, met het gevonden geheugen, wordt afgedrukt (`chosen: …`) en geretourneerd
  als `model_choice` in `--json`. Het test niet of de GPU werkt.
  `NMT_FORGE_AUTO_PRESET` overschrijft dit (het moet een voorinstelling noemen).
- **Het sterkere model dat de rondes aanbieden** gaat alleen naar een project waarvan het
  model in gebruik `cpu-tiny` is: `byt5-small-lowmem` waar `--model auto` dit zou kiezen,
  anders `byt5-small` — ook op een computer waar `auto`
  `cpu-tiny` zou kiezen; de `why` van het aanbod vermeldt wat het nodig heeft.

**Opmerking.** Beschrijf de verwachting van een voorinstelling nooit als een belofte. Meet op de
dev-set.

## De bewaakte lus

Elk commando accepteert `--json`; `--workspace <dir>` (standaard `.forge`) staat
vóór het subcommando. Forge weigert afgekorte vlaggen.

| Stap | Opdracht | Wat het doet | Wat het weigert |
|---|---|---|---|
| Werkplaats | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Schrijft `.forge/`, `config.json`, `NEXT_STEPS.md` | Een onleesbare `--pair`; `cpu-finetune` zonder `--base` |
| Testset | `nmt-forge registry add project-test <file> --role test` | Zet de sha256 van het bestand vast; start het leeslogboek | Synthetische rijen in een test- of verzegelde set; een naam die al geregistreerd is met andere inhoud (tenzij `--allow-rotate`) |
| Screenen | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Controleert elk paar tegen elke geregistreerde dev-, test- en verzegelde set; schrijft een schone kopie | Het overschrijven van een bestand in gebruik (tenzij `--overwrite`); een resultaat zonder overgebleven trainingsdata |
| Voorspellen | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Schrijft de voorspelling van de gemeenschap vóór enige score | Een bestaand id; schrijven na een scorende lezing van de set, door forge of `mt-eval` (tenzij `--allow-after-reads`, geschreven naar het grootboek) |
| Devset | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Een groep-disjuncte dev-afsplitsing, geregistreerd als `project-dev`. De rails-voorwaarde `<n>`: één op de tien van de gescreende paren, minimaal 50, maximaal 500 — een kwart ervan onder 200 paren ([shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` houdt bijna-kopieën (woordoverlap ≥ 0,6) aan één kant, de drempel die de screening van elke latere ronde toepast; de rails stellen `--max-group` in op de helft van de dev-grootte plus één, zodat een bestand geschreven vanuit sjablonen toch splitst | Een kant die meer dan 1,5× het verzoek beslaat, of training die minder dan de helft van de rijen behoudt |
| Bodem | `nmt-forge floor <word lists>` | Vertaalt de devset woord voor woord vanuit het woordenboek en scoort deze op dezelfde manier als de dev-score van een run | Geen devset geregistreerd |
| Controle | `nmt-forge preflight run --config config.json` | Voert elke poort uit die de run zal tegenkomen, inclusief oplossingen; exitcode 2 als er één faalt | — |
| Trainen | `nmt-forge run config.json --detach` | Traint, kiest het controlepunt op de devset, verwijdert de overige controlepunten van de run ([schijfruimte](#disk-space)), schrijft `.forge/runs/<run name>-<8 hex>/` met `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Een run die al bestaat (dezelfde configuratie, trainingsbestanden en devset); een schijf zonder voldoende ruimte (`disk-room`, voordat er iets wordt geschreven; `--skip-disk-check` overschrijft dit); een run die al bezig is; trainingsrijen die lekken naar een test- of verzegelde set; dev-rijen in de training; data gemarkeerd als niet-trainen of in quarantaine; `terms.training: not-allowed`; synthetische data boven het limiet; een decodeerlimiet die te kort is voor de referenties; onbekende configuratiesleutels |
| Testscore | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Scoort de testset eenmalig ten opzichte van de voorspelling; verpakt het model, met `input-words.json` naast de map — de woorden waarop het getraind is, zodat een server de woorden kan benoemen die hij nooit heeft gezien ([serveren](/docs/agents/serving#what-an-export-holds)) | Geen voorafgaande registratie, of meerdere zonder `--prereg`; een verbruikte verzegelde set; een niet-lege `--out` zonder `--force` |
| Kiezen | `nmt-forge choose <export>/model` | Legt de modelkeuze van de gemeenschap vast | Een map die geen geregistreerde export met een model is |
| Serveren | `nmt-forge serve <export>/model --detach` | Serveert het op deze computer ([serveren](/docs/agents/serving#nmt-forge-serve)) | Buiten loopback zonder token, of een lokaal model zonder `--holders-agreed-by` |

Alles wat van belang is, wordt weggeschreven naar het met hashes gekoppelde grootboek
(`.forge/ledger.jsonl`): registraties, leesacties met hun doel, voorspellingen,
scores, verbruiken van verzegelde sets, overschrijvingen, auditoordelen, de ondergrens, exports,
keuzes, serveringen en starts en afrondingen van taken. Het run-manifest is het verslag van een
run.

**Preflight-poorten:** configuratie (drukt de volledige configuratiehash af), werkruimte-overeenkomst, geen
lopende run, dev-afrastering, trainingsdata, backend geïnstalleerd, selectieplugins,
bijna-tweelingen in test en bijna-tweelingen in dev (waarschuwingen), lekaudit, trainingsmix,
generatiespeelruimte, sanity-check van de planning.

**Decoderen.** De definitieve dev-decodering, de testuitlezing (`export`), een model in gebruik
dat de dev-set opnieuw vertaalt, en het geserveerde model gebruiken beam search met
`decode.num_beams` (4 tenzij `config.json` anders aangeeft); checkpoint-selectie,
waarbij veel checkpoints worden gerangschikt, decodeert greedy. Een export
legt `beams_applied` vast, en `nmt-forge serve` decodeert op de manier waarop het model is
gemeten: een oudere export zonder dit wordt greedy geserveerd.

**Lengtelimieten.** Een model leert van maximaal `model.max_src` tokens van een
bronzin en `model.max_tgt` van de vertaling ervan, leest maximaal
`model.max_src` wanneer het vertaalt, en schrijft maximaal
`decode.max_new_tokens` (`byt5-small`: elk 320 bytes — ongeveer 320 letters in
een Latijns schrift, ongeveer 100 in syllabics; `cpu-tiny`: 256 deeltjes in, 384 uit).
Niets wordt stilzwijgend afgekapt: het trainen telt de paren voorbij een van beide limieten voordat
het ze afkapt, en de uiteindelijke dev-decodering telt zinnen die bij invoer zijn afgekapt en
vertalingen die bij het maximum zijn gestopt. Beide komen in het run-manifest
(`length_limits`), en `status` waarschuwt, met de oplossing: splits lange zinnen, of
verhoog `model.max_src` en `model.max_tgt` (en `decode.max_new_tokens`) in
`config.json` — de training duurt dan langer.

**Opmerking.** `nmt-forge run` zelf vereist geen voorspelling; de rails vragen
er eerst om. Train niet voordat de stap voor voorspellen is voltooid.

**Opmerking.** `export` is de stap die de testset leest. Het uitvoeren ervan is een
mijlpaal, waarbij de voorspelling van de gemeenschap al is vastgelegd — nooit een routineuze
controle.

## Achtergrondtaken

`run --detach` en `serve --detach` starten een taak onder toezicht en keren direct terug.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- Statussen: `running`, `finished`, `refused`, `crashed`, `stalled`,
  `deadline`, `interrupted`, `lost`. `lost` is een taak waarvan de supervisor is geëindigd
  zonder registratie — inclusief na een herstart, wanneer het procesnummer inmiddels
  toebehoort aan een ander proces.
- **Eén training tegelijk op deze computer.** Trainingstaken staan in de wachtrij voor de
  gehele machine, wie het eerst komt, wie het eerst maalt (`~/.nmt-forge/machine/train-queue`),
  over alle projecten heen. Een taak in de wachtrij blijft `running`, met `queued_behind`
  (de taak waarop deze wacht) in `nmt-forge jobs --json`; `status` is `training`
  en geeft aan achter wie deze wacht, en de taak start vanzelf. Een stopbevel tijdens het
  wachten beëindigt de taak ongestart (`interrupted`); een wachttijd van 24 uur beëindigt deze
  (`deadline`).
- **Grenzen** (trainingstaken): geen teken van leven gedurende 15 minuten bij het opstarten
  (`--startup-minutes`); geen voortgang gedurende het langste van 10 minuten en 30 maal
  de mediane staptijd (`--stall-minutes`); een deadline van `--deadline-hours`,
  anders het tijdsbudget van de configuratie × 1,25, anders 24 uur. Een taak die een grens overschrijdt,
  wordt gestopt en geregistreerd.
- **Stoppen**: de run pauzeert bij de volgende stap; de supervisor escaleert na 60 s naar
  beëindigen ('terminate') en 10 s later naar geforceerd stoppen ('kill').
- **De kloktijd-poort** (Hugging Face-backends): na de opwarming timet forge
  de stappen, projecteert de run en weigert een run die niet binnen het budget past
  (`wall-clock budget exceeded: …`). Zonder ingesteld budget is de limiet een plafond
  van 24 uur.
- Zolang een trainingstaak actief is, is `status` `training` en is de stap op de rails
  `wait`. Een taak die is mislukt, verschijnt als waarschuwing bij elke latere status.
- **Hervatten.** Wanneer de laatste trainingstaak eindigde als `lost`, `crashed`, `stalled`
  of `deadline` na het opslaan van een checkpoint, noemt `status` `nmt-forge preflight
  run --config config.json && nmt-forge run config.json --resume --detach`:
  een nieuwe run die start vanaf het laatste checkpoint van de onderbroken run (de gewichten,
  een verse optimizer, de resterende epochs), en waarvan het manifest vermeldt
  waar deze vanaf hervat is (`resumed_from`). Dit wordt nooit aangeboden na een handmatige
  stop.
- Losgekoppelde taken (detached) zijn uitsluitend POSIX (macOS, Linux).

## Schijfruimte

Het trainen schrijft controlepunten: tot `model.save_total_limit` tegelijk
(4 tenzij `config.json` anders aangeeft), ongeveer 1,4 GB per stuk voor ByT5-small.
Vóór deze regels behield elke verbeteringsronde van een ByT5-small-project ongeveer
5,6 GB, werd het model van een eerdere ronde nooit verwijderd, en zorgde een volle
schijf ervoor dat een run crashte tijdens het opslaan. De GB van Forge is 1024³ bytes.

- **Een voltooide run behoudt alleen zijn geselecteerde checkpoint.** Elke andere
  `checkpoint-*`-map van de run verdwijnt zodra het checkpoint is gekozen:
  niets leest ze ooit nog (`export` kopieert het geselecteerde checkpoint; de volgende ronde
  start vanaf het model dat in gebruik is). Het manifest registreert `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` in het
  `model`-blok van `config.json` behoudt ze allemaal. Elke andere waarde wordt geweigerd wanneer de configuratie
  wordt gelezen, vóór enige training (`ConfigError`; hier voor de waarde `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Vergrendeling.** Een run waarvoor de schijf onvoldoende ruimte heeft, wordt geweigerd voordat er iets wordt geschreven
  (guard `disk-room`); een losgekoppelde run wordt meteen geweigerd, voordat de taak
  begint. De schatting: de omvang van één checkpoint — het bewaarde checkpoint van een
  eerdere run van dezelfde basis in deze werkruimte, anders de eigen gewichtenbestanden van de basis
  (een lokale map of de Hugging Face-cache) — vermenigvuldigd met
  `model.save_total_limit`, plus 1 GB om te voltooien; nooit minder dan 2 GB. De
  weigering luidt
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  — of, wanneer er geen omvang bekend is, *"(er moet ten minste zoveel vrij blijven,
  ongeacht het model)"* — vervolgens
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  en een `fix` die aangeeft wat `nmt-forge tidy` hier kan vrijmaken (wanneer het
  iets kan vrijmaken), het verplaatsen van andere bestanden van de schijf, en `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (met of zonder `--detach`) start
  hoe dan ook. `disk_room` van het manifest registreert de controle — `free_bytes`,
  `checkpoint_bytes` (`null` wanneer onbekend), `checkpoints_at_once`,
  `need_bytes` — of `{"skipped": "--skip-disk-check"}`. **Opmerking.** De
  schatting kan onjuist zijn; het is aan de gebruiker om te bepalen of de controle wordt overgeslagen.
- **`nmt-forge tidy`** toont de modelgewichten van eerdere rondes die door niets
  worden gebruikt — elke run met zijn omvang, het totaal, de vrije ruimte — en verwijdert
  niets. `nmt-forge tidy --yes` verwijdert ze. Het verwijdert nooit het model dat in
  gebruik is, de nieuwste run of het model dat door het huidige model is vervangen (het blinde
  beoordelingsblad stelt hiermee concepten op); de regel `Kept:` van de uitvoer noemt elk model, met de reden. Een opgeschoonde run behoudt zijn gegevens — manifest, dev-vertalingen, rapport —
  en het manifest ervan krijgt `model_removed` (`at`, `by`, `bytes`, `why`); het
  grootboek krijgt een `tidy`-vermelding (`runs`, `bytes`). Een opgeschoonde run die wordt gevraagd om te
  vertalen (`compare-runs` die de dev-set hiermee opnieuw vertaalt), wordt geweigerd:
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Opmerking.** `--yes` verwijdert bestanden: toon de gebruiker de lijst en voer dit alleen
  uit na diens akkoord.
- **`status` waarschuwt** — een regel in `warnings`, doorgegeven door de rails — wanneer de
  schijf waarop de werkruimte staat minder dan 10 GB vrij heeft, of wanneer opschonen 5 GB
  of meer zou kunnen vrijmaken: *"deze computer heeft X GB vrij; de modellen van N eerdere ronde(s)
  die door niets worden gebruikt nemen Y GB in — `nmt-forge tidy` toont ze,
  `nmt-forge tidy --yes` maakt de ruimte vrij (het model dat in gebruik is, het nieuwste en
  het model dat het verving worden behouden)"* (het deel na de puntkomma alleen wanneer
  opschonen iets zou vrijmaken).

## De verbeteringsrondes

Zodra een model in gebruik is, traint elke ronde een nieuwe run op meer data met
dezelfde dev-set.

**Hoe een ronde traint.** `champollion improve prepare` voert `nmt-forge
round-plan --config config.json`, which rewrites `config.json` op een van twee
manieren uit en schrijft het plan naar het grootboek (`round-plan`):

- **Verder vanaf het model in gebruik** (`init_from` de bijbehorende modelmap): 4 doorgangen
  (epochs) over alle zinnen tot nu toe — de oude zinnen voorkomen dat het
  vergeet — tegen de halve leersnelheid. Veel korter dan trainen vanaf het
  begin. De volledige instellingen wachten in `config.json` onder `model_full`.
- **Vanaf het begin**, waarbij de volledige instellingen zijn hersteld, wanneer er nog geen model
  in gebruik is; wanneer het model is gewijzigd (`use-model`, wat ook
  `model_full` verwijdert); voor `cpu-tiny`, waarvan de woordenschat afkomstig is uit de trainingszinnen
  (het traint in enkele minuten); voor een adaptermodel (LoRA); en elke
  4e ronde, zodat vele korte voortzettingen niet wegdrijven.

`prepare` drukt het plan en de reden af, en legt `training` (`mode`,
`epochs`) vast in `improve/round-<k>/prepared.json`. In beide gevallen wordt de nieuwe run
beoordeeld ten opzichte van het model in gebruik op dezelfde dev-zinnen. Vervolgens (1, 3 en
4 zijn statussen die de adviseur van forge aangeeft; 2 wordt vastgelegd door de rails):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — de twee modellen, zin
   voor zin gekoppeld op de dev-set. Bij minder dan 50 dev-zinnen is het
   oordeel **too-few**, ongeacht de scores: *"te weinig dev-zinnen om te
   kunnen oordelen: onder de 50 is een verschil niet betrouwbaar van toeval te onderscheiden, ongeacht
   de grootte ervan"*. Vanaf 50: uitsluitend **better** wanneer de p van de gepaarde toets < 0,05
   **en** het 95%-interval van het verschil boven nul ligt; **worse** wanneer
   p < 0,05 en het onder nul ligt; anders **no-change**. Elk oordeel vermeldt
   het kleinste verschil dat de dev-set betrouwbaar kan aantonen. De testset wordt nooit
   gelezen. Geweigerd (`improve-loop`) bij runs op verschillende dev-sets, een run
   zonder opgeslagen dev-vertalingen, of een dev-set die is gewijzigd sinds de nieuwe run.
2. **Het oordeel van de spreker**, wanneer de dev-set geen uitsluitsel kon geven. Het model van
   een ronde dat niet in gebruik is genomen, stelt de helft van de opgestelde rijen van het volgende
   beoordelingsblad blind op (`draft-newer`, hieronder), en `champollion improve
   marks` registreert de tellingen van de spreker met forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge onderneemt hierop alleen actie na een **too-few**- of **no-change**-oordeel. Een
   samengevoegde toets voor twee proporties, tweezijdig op 5% (|z| > 1,96), levert `clear` op:
   `newer`, `in-use` of `neither`; de vermelding `improve-speaker` in het grootboek bewaart
   de twee run-namen, de vier tellingen, `z` en `clear` — uitsluitend tellingen. Het
   weigert tellingen onder de 0, meer goed dan beoordeeld, en een model zonder
   beoordeeld concept. De tekst luidt: *"Bij een blinde beoordeling tijdens hetzelfde bezoek
   beoordeelde de spreker het nieuwere model als correct bij A van de B nieuwe zinnen (P%) en het model
   in gebruik bij C van de D (Q%)"*, vervolgens *"het nieuwere model is duidelijk beter op
   deze zinnen — forge biedt aan het in gebruik te nemen"*, *"het model in gebruik is
   duidelijk beter op deze zinnen — het blijft behouden"* of *"geen duidelijk verschil
   op deze zinnen — het model in gebruik blijft behouden"*.
3. **`improve-promote`** (`confirm`), bij **better** — of bij **too-few** of
   **no-change** wanneer de nieuwste `speaker-verdict` voor die run
   `clear: newer` aangeeft (nooit bij **worse**). Het is een voorstel: een oordeel alleen neemt
   niets in gebruik. Bij akkoord van de gemeenschap exporteert het de nieuwe run zonder de
   testset te lezen (`--no-eval`), legt het vast als gekozen (`choose`), stopt de
   actieve server en serveert het nieuwe model op dezelfde poort. Alleen die
   `export` en `choose` tellen als het in gebruik nemen van een model: tot die tijd luidt
   het ronderapport *"meetbaar beter: niet in gebruik genomen — de gemeenschap heeft er
   niet voor gekozen"*, en laten de voortgang, projectie en overfit-controle het
   model buiten beschouwing. Bij beoordelingen van de spreker voegt diens `why` de tellingen toe en *"een
   duidelijk verschil: het nieuwere model is beter op de zinnen die de familie
   nodig heeft"*. Op het volgende blad is de helft van de conceptrijen afkomstig van het model dat het
   heeft vervangen, zodat de spreker de promotie blind controleert (hieronder).
4. Anders blijft het model in gebruik behouden en begint de volgende ronde — tenzij de
   laatste twee ronde-oordelen sinds de laatste modelwijziging beide
   **no-change** of **worse** zijn, met `cpu-tiny` in gebruik. De laatste modelwijziging
   is de nieuwste vermelding `model-change` (een wisseling van preset of een `not-now`) of
   `choose` in het grootboek — elk model dat de gemeenschap in gebruik heeft genomen, inclusief
   een promotie op basis van de beoordelingen van de spreker. Een **too-few**-ronde is geen
   beoordeelde ronde: wanneer een van de laatste twee te weinig zinnen had, is er geen voorstel.
   Dan **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (of
   `not-now`), de preset `byt5-small` of `byt5-small-lowmem`
   ([modellen](#models)). Het antwoordveld is `try_it`. `yes` herschrijft het
   model in de configuratie (waarbij het tijdsbudget van de gemeenschap behouden blijft) en de volgende stap traint
   het; `not-now` verandert niets. Beide worden naar het grootboek geschreven
   (`model-change`), en het voorstel keert pas terug na nog eens twee van dergelijke rondes.
   Via MCP is "not now" hier het antwoord `try_it: "not-now"`;
   `declined: true` wordt bij deze stap geweigerd
   ([MCP](/docs/agents/mcp#not-now)). Het `why` ervan meldt nooit dat meer zinnen
   niet helpen: wanneer de dev-set te klein is om de winst van een ronde te zien, *"kunnen
   kleine verbeteringen verborgen blijven"*; anders brachten de rondes *"geen verandering die de dev-zinnen
   kunnen waarnemen (ongeveer X chrF++-punten of meer): de rondes voegen mogelijk minder toe dan dat,
   of niets"* — nabij de top van de curve voegt een ronde ongeveer een half chrF++-punt toe,
   minder dan wat 200 dev-zinnen aantonen.
   **Opmerking.** `--answer` staat standaard op `yes`: geef het antwoord van de gemeenschap
   altijd expliciet door.

De rails sturen de rest van een ronde aan (`champollion improve …`): `nmt-forge
wishlist` stelt het formulier op met wat het meest zou helpen (standaard 40 prompts,
waarvan minstens een kwart open blijft; voor woorden die het model nog nooit heeft gezien,
wordt gevraagd om twee of drie zinnen per woord, elk met een andere betekenis — een woord dat slechts één keer in
de training voorkomt, wordt zelden geleerd
([meting](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` splitst dev-chrF++ uit per type
zin, en `nmt-forge grow-dev` voegt de oefenzinnen van de spreker toe aan
de devset onder dezelfde naam — nooit een rij die al in de devset staat, nooit een rij
waarvan de bronzin in een test- of verzegelde set voorkomt. Een type zin stuurt de
verlanglijst alleen aan wanneer de score duidelijk achterblijft bij de rest
([meting](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (uitgevoerd door `champollion improve sheet`) stelt voor een willekeurige
helft van de rijen op het volgende beoordelingsformulier concepten op met het andere model, ongemarkeerd, zodat de
spreker beide modellen blind beoordeelt
([meting](/docs/agents/measurement#the-speakers-marks)): het nieuwst
getrainde model wanneer dit niet het model in gebruik is (de ronde werd niet in
gebruik genomen), of, na een promotie, het model dat door het huidige model werd vervangen. Het veld `--json`
geeft aan welk model dit is (`relation`: `newer` of `replaced`, `null` wanneer er geen ander
model is en elke rij afkomstig is van het model in gebruik), met `other`, `in_use`, de
trainingsparen achter elk model (`other_pairs`, `in_use_pairs`) en `n`; de
invoer `draft-newer` in het grootboek registreert hetzelfde. Hoe u een ronde overbrengt:
[begeleiding](/docs/agents/coaching).

## Synthetische data en terugvertaling

- `nmt-forge synth <pack> --out <file>` voert de generator van een taalpakket uit.
  Forge levert geen pakketten mee. Elke rij wordt geverifieerd en van het stempel `synthetic: true` voorzien.
- Een synthetisch bestand traint als een gelabelde baan in `config.json`
  (`data.synthetic`, `{"path", "tag": "<synth>"}`). Boven 15% van één soort wordt de run
  geweigerd, tenzij de configuratie `mix.synthetic_sample` vermeldt;
  `nmt-forge sample --cap 0.15 --key kind` trekt een begrensde steekproef.
- **Terugvertaling heeft geen commando.** Het is een bibliotheekfunctie
  (`nmt_forge.training.backtranslation.backtranslate`): u levert het
  omgekeerde model aan; het screent de eentalige tekst eerst tegen elke geregistreerde set
  en labelt de uitvoer als `<bt>`; de uitvoer traint vervolgens als een synthetische
  baan. Er draait geen kwaliteitsfilter op. `config.data.monolingual` wordt geweigerd.
- **Opmerking.** Eentalige tekst is data van de gemeenschap, net als alle andere: de sidecar-voorwaarden
  zijn van toepassing, en een omgekeerd model dat een gehost LLM is, stuurt deze naar een provider
  ([dataregels](/docs/agents/data-rules)).

## Symptoom → oorzaak → oplossing

| Symptoom | Waarschijnlijke oorzaak | Oplossing |
|---|---|---|
| `cpu-tiny` scoort tussen 5 en 30 chrF++ op de devset | Het is bewust eenvoudig gehouden: een fraseboek voor zinnen die lijken op de trainingsdata | Meer echte paren; op Apple Silicon of een GPU, `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem` waar de GPU 8–15 GB heeft) |
| "Goed op sjablonen, slecht op echte tekst" | Regel R7 (transferplateau): het dev-verlies bereikte vóór het laatste controlepunt een dieptepunt en steeg met 5% of meer. Dit gebeurt bij elke dergelijke stijging, ongeacht wat de dev-chrF++ deed — lees dit samen met de dev-scores | Meer echte paren. Zichtbaar via `nmt-forge lint <run-manifest.json>`, niet via export |
| De score lijkt te goed | Testkopieën of bijna-kopieën in de training; of de meeste testrijen hebben een trainingstweeling (R4-recall-not-translation, bij de helft of meer) | `leak-audit --drop-test-twins` voor een bestand zonder tweelingen; rapporteer scores met en zonder de tweelingen |
| Een klein verschil tussen twee modellen | Het interval is breed (R5-low-power, interval breder dan 8 punten) | `nmt-forge compare` (gepaarde toets); voor rondes, `compare-runs`. Breid de devset uit |
| Een ronde geeft aan "too few dev sentences to tell" (`too-few`) | De devset bevat minder dan 50 zinnen: geen enkele vergelijking biedt hier uitsluitsel | Niets om op te lossen: het volgende formulier combineert blind de concepten van beide modellen en de beoordelingen van de spreker geven de doorslag; één op de twee rijen op het formulier is een oefenrij totdat de devset 50 zinnen bevat |
| Een ronde geeft aan "no measurable change" | De devset is te klein om de winst van een ronde waar te nemen | Breid deze uit met behulp van de oefenzinnen van de spreker (`grow-dev`, aangestuurd door `champollion improve prepare`) |
| Training geweigerd: `[disk-room] this computer has … free` | De schijf kan de controlepunten van de run niet kwijt | `nmt-forge tidy` toont wat de modellen van eerdere rondes zouden vrijmaken; `nmt-forge tidy --yes` na toestemming van de gebruiker; of maak elders ruimte vrij. `--skip-disk-check` alleen wanneer de gebruiker oordeelt dat de schatting niet klopt |
| Een run verslaat de woordenboekbodem niet | De training heeft niets geleerd wat de woordenlijst niet al biedt | Meer paren; controleer de dekking van de bodem; meld dit aan de gemeenschap |
| De devset is verzadigd | De ondergrens van het interval ligt op 99% van het plafond | Een moeilijkere devset; de score kan niet verder stijgen |
| Geweigerd vóór de training | Zie de rij "Trainen" hierboven; `preflight run` noemt elke falende controlepoort en de bijbehorende oplossing | Volg de oplossing. Een ontbrekende trainings-extra: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (of `pip` binnen de eigen Python van forge) |
| Gestopt door de kloktijd | De verwachte runduur overschrijdt het budget (standaard 24 uur) | Een kleiner model of minder epochs, of een budget dat door de gemeenschap is ingesteld (`model.time_budget_hours`) |
| Een achtergrondtaak is mislukt | `nmt-forge jobs` toont `crashed`, `stalled`, `deadline`, `lost` of `refused` | Lees het veld `stderr.log` in `.forge/jobs/<name>/` en los het probleem op; train vervolgens opnieuw, of hervat vanaf het laatste controlepunt wanneer `status` verwijst naar `--resume` |
| Training wacht en start niet | Er is al een andere training actief op deze computer; deze staat erachter in de wachtrij (`queued_behind`) | Wacht rustig af: de training start vanzelf. Start geen nieuwe run |
| Lange zinnen worden afgekapt | De lengtelimieten: `status` waarschuwt met tellingen (ingekorte paren tijdens training, dev-zinnen die vooraf zijn ingekort, vertalingen die zijn gestopt bij de limiet) | Splits lange zinnen; of verhoog `model.max_src`, `model.max_tgt` en `decode.max_new_tokens` (langere trainingsduur) |
| Woorden komen tevoorschijn als onbekende delen (`cpu-tiny`) | De woordenschat wordt uitsluitend geleerd uit de trainingsrijen | Meer paren die deze woorden gebruiken; of `byt5-small`, dat bytes leest |

## De taxonomie van fouten

Forge is gebouwd op basis van een catalogus van manieren waarop een trainingsproject zichzelf voor de gek houdt.
Kort samengevat — 'afgedwongen' betekent dat de tools het weigeren:

| Familie | Fouten | In code |
|---|---|---|
| Lekkage | Het antwoord in de trainingsset; bijna-kopieën; parafrases over de splitsing heen; aaneengeschakelde sjablonen | Afgedwongen (lekaudit, split guard). Sjabloon-siblings worden bewaard en geteld |
| Dev/test-besmetting | Checkpoints kiezen op de testset; een verzegelde set tweemaal verbruiken; een testscore zonder voorspelling; voorspellen na het lezen | Afgedwongen (dev-afrastering, evaluatiegrootboek, preregistratie) |
| Tokenizer en orthografie | Een tokenizer die het schrift niet kan schrijven; gemengde spellingsconventies | Niet gecontroleerd voor tokenizers; gemengde conventies vormen een lint, alleen wanneer de configuratie ze vermeldt |
| Synthetische data | Het synthetische mengsel beheersen; 'early stopping' die een zwaar synthetische run afbreekt; ineenstorting; terugvertaling die zichzelf voedt met eigen fouten | De ondergrens voor early stopping is afgedwongen; de rest zijn lints of tags |
| Dekking | Ontbrekende woorden voor het register | Een lint, wanneer een plugin dekking rapporteert |
| Meting | Een delta die kleiner is dan het interval; één ondoorzichtig getal; metriekberekeningen buiten de engine | Afgedwongen: elke score bevat zijn interval en is afkomstig van de engine |
| Decodering | Afgekapte uitvoer; checkpoints gekozen op basis van loss in plaats van uitvoer | Afgedwongen: decodeerspeelruimte, selectie op basis van generatiemetrieken; lengte-afkappingen geteld en gewaarschuwd |
| Proces | Onbekende configuratiesleutels; do-not-train-data; op hol geslagen runs | Afgedwongen |

Bekende hiaten, waarvoor nog geen code bestaat: tokenizer-dekking, kwaliteit van terugvertaling,
afkapping per register, de verhouding tussen goud en synthetisch, variantie over seeds.

## Uitvoer voor programma's

`--json` plaatst precies één JSON-document op stdout. Een weigering is
`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}`
en exitcode 2 (`details` wordt toegevoegd bij weigeringen voor splitsing en dev-afrastering). Exitcode 1 is een
onverwachte crash. `nmt-forge run` eindigt met `RUN EXIT <code>` (0, 1, 2 of
130); `run --detach` retourneert 0 met het taakdocument. `nmt-forge status
--json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready",
"blockers", "warnings", "answers"}}`.

## Meer informatie

- [De commandoreferentie voor `nmt-forge`](/docs/network/getting-started/forge-command-reference)
  — elk subcommando en elke vlag.
- [Meetregels](/docs/agents/measurement) — wat de scores betekenen.
- [Uw eerste vertaler](/docs/your-first-translator) en
  [Maak het beter](/docs/make-it-better) — de versies voor de gemeenschap.
- [Serveren en uitrollen](/docs/agents/serving) — wat een export bevat.
