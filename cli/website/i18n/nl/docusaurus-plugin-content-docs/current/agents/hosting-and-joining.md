---
title: "Een verzegelde test hosten en deelnemen aan een project"
slug: /agents/hosting-and-joining
description: "Twee manieren om in te stappen naast zelf bouwen: host een verzegelde test met mt-eval contest en mt-eval node (het werkt, het staat nog niet op de rails en de door de organisator gekozen bewaarders beheren de sleuteldelen), en neem deel aan een geregistreerd project met mt-eval project — elk commando, wat het waarheen verzendt en wat het nooit toont."
---

# Een verzegelde test hosten en deelnemen aan een project

Twee sporen naast de bouwrails. Beide zijn eenvoudige `mt-eval`-commando's; geen van beide
is een stap die `champollion next` noemt.

## Een verzegelde test hosten

**Eerlijke status.**

- Het werkt: het voorbereiden van een verzegelde set, een sleutelceremonie, het uitvoeren van inzendingen op een
  air-gapped knooppunt, oordelen en rangschikking zijn allemaal commando's met tests.
- **Het bevindt zich nog niet op de rails.** `champollion new --kind task` wordt geweigerd;
  het enige traject is het taaltraject. Houd rekening met een langere handmatige procedure en
  volg het [draaiboek voor wedstrijden](/docs/network/sovereignty/run-a-sovereign-contest).
- **De sleuteldelen worden bewaard door beheerders die de organisator aanwijst.** Niets in
  de code benoemt of toetst hen. Er zijn voor geen enkele test sleutelbeheerders uit de
  gemeenschap aangewezen.
- **Champollion bezit geen sleuteldeel en geen privésleutel.** De ceremonie draait op
  de machine van de organisator, en de registratie verzendt alleen identificaties, digests
  en de kwalificatiedrempel — nooit een sleutel, een deel of de zinnen.

**Opmerking.** Hosten bepaalt wat er met de zinnen van mensen gebeurt en wie ze kan
ontgrendelen. Elke onderstaande stap is een beslissing van de organisator; voer deze pas uit
wanneer die daarom vraagt.

### Wat er wordt aangemaakt

`mt-eval contest prepare` splitst het corpus van de organisator:

| Vlag | Set | Wie het ziet |
|---|---|---|
| `--dev-size` (vereist) | De kwalificatieset: bron en referenties | Openbaar, vrijgegeven vanuit `<out>/public/` |
| `--secret-size` | De verzegelde test waartegen de wedstrijd is geregistreerd | Niemand: verzegeld in `<out>/local/` |
| `--sealed-holdout-size` (vereist `--secret-size`) | Een tweede verzegelde splitsing, beoordeeld maar ingehouden tot sluiting | Niemand |

`--seed`, `--qualifier-threshold` (groter dan 0) en `--license` zijn vereist — er wordt
geen licentie aangenomen. `--custodian-group` en `--threshold-pubkey` zijn vereist
(de sleutel waarmee de verzegelde sets zijn versleuteld). De platte tekst van elke verzegelde set
wordt na verzegeling verwijderd; `<out>/local/manifest.json` bevat het recept en
verlaat de machine nooit. Verzegelen voert `champollion network seal-corpus seal` uit, dus de
`champollion`-CLI moet geïnstalleerd zijn.

### Beheer

**Drempelbeheer (M-van-N).** Op het air-gapped knooppunt:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` genereert de sleutel, splitst deze met Shamir's schema en wist deze in één
aanroep; het schrijft `ceremony.json` (het openbare verslag) en één deelsleutelbestand per
beheerder. `--set` moet de id van de geheime set zijn en `--group` de
`--custodian-group` die prepare zal gebruiken — prepare controleert deze niet, en een
verschil wordt pas ontdekt wanneer een uitvoering wordt geweigerd. Geef prepare het verslag
van de ceremonie: `--threshold-pubkey <ceremony>/ceremony.json`.

**Vergrendeling.** Een verzegelde set wordt uitsluitend ontsleuteld met `mt-eval node run-method <id>
--offline --share … --share …` met minimaal M deelsleutels van verschillende
beheerders van wie de id's overeenkomen met de set. Drempelbeheer werkt alleen op dit
offline spoor.

**Enkele sleutel.** `champollion network seal-corpus keygen --out <dir>` maakt één
sleutelpaar aan; wie het sleutelbestand bezit, kan zelfstandig ontsleutelen. Dit is wat het
spoor voor verbonden knooppunten gebruikt.

### Het stappenplan voor de organisator (drempelbeheer)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` stelt drempelbeheer in wanneer de set is verzegeld met
een ceremoniesleutel. Deelnemers kwalificeren zich op de openbare dev-set (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, beide met een `--offline --bundle-out`-pad).
De [handleiding voor knooppunten](/docs/network/sovereignty/sovereign-eval-node) bevat elk
knooppuntcommando.

### Wat een verbinding vereist, en van wie

| Werkt offline | Vereist aanmelding | Vereist de servicesleutel van de database |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (met `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, elke `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, online `submit-*`, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` zonder `--no-register` of `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, online `node run-method`, `node relay`, en `contest close` wanneer resultaten werden ingehouden |

De servicesleutel is eigendom van degene die de database beheert. Een externe organisator
voert deze uit tegen een eigen database (`MT_EVAL_SUPABASE_URL` en bijbehorende
sleutels), of blijft op het offline spoor — waarvan de scores verifieerbaar zijn aan de hand van hun
ondertekende manifesten, maar geen vermelding op het openbare scorebord krijgen. **Opmerking.** Stel
`MT_EVAL_ALLOW_PROD` nooit in: hiermee wordt de weigering van de tools om naar de standaard
productiedatabase te schrijven opgeheven, en dat is geen beslissing voor een agent.

## Deelnemen aan een project

Een **geregistreerd project** is een taalproject dat door de eigenaar is vermeld zodat anderen
kunnen helpen, met bestanden: zinnen, woordenlijsten of methoden (beoordelingstijd en
rekenkracht worden nog niet aangeboden). De onderstaande `mt-eval
project`-commando's communiceren met de projectdatabase
(`MT_EVAL_SUPABASE_URL`). Elk subcommando met uitzondering van `list` (anoniem) en
`review` (van de beheerder) meldt zich aan (een gecachte
sessie, `MT_EVAL_REFRESH_TOKEN`, of een interactieve aanmelding via GitHub of Google);
het account is het e-mailadres van de aanmelding.

**De regels.**

- **Beoordeeld vóór vermelding.** Een nieuw project begint `pending_review`; het wordt
  pas na beoordeling vermeld. Een eigenaar kan een project sluiten, nooit vermelden.
- **De eigenaar wordt genoemd zoals deze zelf kiest** (`--owner-name`). De projectrij
  bevat geen e-mailadres; het account van de eigenaar wordt apart gehouden en is alleen door henzelf leesbaar.
- **Geen e-mailadres in een vermelding.** `project list` is anoniem en toont namen en
  aantallen; `project offers` drukt helpers af met de naam die zij hebben opgegeven (`--as`).
  Het account van de eigenaar kan nog steeds het account-e-mailadres van een helper lezen in het dossier
  van het aanbod, en de toestemmingsnotitie legt beide accounts vast.
- **Aanbiedingen worden door beide partijen bewaard.** Accepteren schrijft een toestemmingsnotitie waarin staat wie
  het heeft ingediend en wie het heeft geautoriseerd.
- **Er wordt niets uit een bestand afgedrukt.** Alleen namen, aantallen en statussen.

### Eigenaar

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` leest het paar uit `champollion.project.json` (en het doel,
  tenzij `--purpose`); optioneel `--slug`, `--domain`, `--register`, `--about`.
  Maximaal 5 registraties per account per 24 uur.
- `ask` `--kind` is `sentences`, `word-list` of `method`; vragen worden alleen getoond zolang
  het project vermeld staat.
- `accept` downloadt het bestand, **verifieert de sha256 ervan** (geweigerd bij een
  afwijking), schrijft `inbox/offer-<offer id>-<file name>` en
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), en markeert het
  aanbod vervolgens als geaccepteerd. Het bestand komt dan binnen zoals elk ander —
  `champollion data add inbox/<file>` — en de voorwaarden van de rechthebbenden worden gevraagd.
- **Opmerking.** De `--terms` van de helper staan in de toestemmingsnotitie. De antwoorden die u
  vastlegt met `champollion data mark` mogen deze niet versoepelen.

### Helper

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` uploadt één niet-leeg bestand van maximaal 50 MB naar de privéopslag
  van het project, met de sha256 ervan, uitsluitend naar een vermeld project. Maximaal 24
  aanbiedingen per helper per 24 uur.
- Een aanbod verandert één keer van status: `offered` → `accepted`, `declined` of `withdrawn`.
- **Opmerking.** Intrekken of afwijzen wijzigt de status van het aanbod; het verwijdert
  het geüploade bestand niet uit de opslag. Meld dit voordat een helper
  iets aanbiedt dat die mogelijk terug wil.
- **Vergrendeling.** `offer` leest de sidecar van het bestand voordat er iets wordt geüpload. Het
  weigert een `local-only`-bestand, een `sealed`-set en een bestand waarvan
  `speakers_agreed` `not-yet` of `some-said-no` is; een onleesbare sidecar
  stopt het aanbod. Er is geen overschrijving mogelijk: de markering is aan de rechthebbenden om te wijzigen.
  Er wordt een `training: not-allowed`-voorwaarde toegevoegd aan de voorwaarden van het aanbod, zodat de eigenaar
  deze ziet.
- **Opmerking.** Een aanbod verstuurt het bestand van de computer van de helper naar de opslag
  van de projectdatabase. Vraag het aan de helper en bied nooit een bestand namens hen aan.

`mt-eval project review` is voor de databasebeheerder (het gebruikt de servicesleutel).
Het is geen commando voor een agent.

## Verdieping

- [Een verzegelde test hosten](/docs/host-a-sealed-test) en
  [Deelnemen aan een project](/docs/join-a-project) — de publieksversies.
- [Een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest)
  en [het soevereine evaluatieknooppunt](/docs/network/sovereignty/sovereign-eval-node).
- [Eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer) en
  [voorwaardensjablonen](/docs/network/sovereignty/terms-templates).
- [Gegevens- en overdrachtsregels](/docs/agents/data-rules) — verzegelde sets en
  uitsluitend lokale bestanden.
- [`mt-eval`-referentie](/docs/reference/mt-eval).
