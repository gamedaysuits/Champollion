---
title: "Gegevens- en overdrachtsregels"
slug: /agents/data-rules
description: "De regels die elk Champollion-hulpprogramma toepast op de gegevens van de mensen: de set/1-sidecar veld voor veld, local-only en de voorlopige standaardwaarde ervan, training niet toegestaan, sprekers en houders die hebben ingestemd, wat elk hulpprogramma afdrukt en nooit afdrukt, de vier overdrachtsmodi, de registratieniveaus en modeluitvoer als afgeleiden."
---

# Data- en overdrachtsregels

De mensen die taaldata beheren, beslissen hoe deze wordt gebruikt. De rails leggen hun
beslissingen vast naast elk bestand, en elk hulpmiddel volgt wat er geschreven staat — met
gemeenschapseigenaarschap en controle over taaldata als ontwerpprincipe, niet als
instelling. Deze pagina beschrijft exact de regelset: wat elk veld doet, wat de
hulpmiddelen weigeren en de onderdelen die alleen u kunt behouden.

## De sidecar (set/1)

Naast elk databestand, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Onbekende sleutels worden geweigerd; notities
staan onder `x-`. Een sidecar die vóór set/1 is geschreven (geen `$schema`) wordt gelezen als set/0
en blijft geldig (`champollion upgrade` herschrijft deze).

| Veld | Waarden | Effect |
|---|---|---|
| `transmission` | `local-only` (de enige waarde) | Alleen een model op deze computer mag de tekst zien; elk hulpmiddel weigert deze ergens heen te sturen (inclusief `mt-eval project offer`) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | Waar het bestand voor dient. Op `test` en `sealed` wordt nooit getraind |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | Wat het bevat |
| `pair` | `{source, target}` | De richting van de kolommen, in de codes van de kaarten |
| `fields` | `{source, target}` | Welke kolom of welk JSON-veld welke kant bevat |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: er mag geen model op worden getraind |
| `terms.owner` | tekst | Wie het beheert, in de woorden van de beheerder |
| `terms.speakers` | tekst | Wiens woorden het bevat, in de woorden van de beheerder |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Of de mensen van wie de woorden zijn hiermee hebben ingestemd |
| `terms.consent_record` | pad | De toestemmingsnotitie, relatief ten opzichte van de map van het bestand |
| `holders_agreed` | `{by, date}` | Wie van de beheerders heeft ingestemd dat een local-only-uitvoer mag blijven staan waar deze staat (verruimt niets) |
| `derived_from` | pad | Het beschermde bestand waaruit dit is gemaakt; de markeringen ervan zijn hiernaartoe overgenomen |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Geschreven door `champollion network register-corpus`; een gewijzigd bestand (een andere sha256) krijgt niet langer het id van de kaart |
| `written_by` | tekst | De opdracht die dit heeft geschreven |

**Vergrendeling.** Een sidecar maakt een bestand alleen strenger: deze versoepelt nooit wat een corpus-envelope
of een registry-vermelding voorschrijft.

## Local-only en de voorlopige standaardwaarde

`champollion data add` markeert het bestand dat het schrijft als local-only wanneer `defaults.transmission`
van het project `local-only` is (wat `champollion new` schrijft), en
altijd voor `--into test`. Die markering is de bescherming van het hulpmiddel totdat de beheerders
antwoorden, aangeduid met `"x-transmission-default": true`.

- Het eerste antwoord van de beheerders geeft de doorslag. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` maakt het van hen (de
  vlag wordt verwijderd).
- **Opmerking.** Het hulpmiddel kan niet zien wie de opdracht heeft uitgevoerd. Hef een voorlopige markering
  alleen op met het eigen antwoord van de beheerders.
- **Vergrendeling.** Een door de beheerders aangebrachte local-only-markering kan door geen enkele
  opdracht worden opgeheven: *"dit bestand is gemarkeerd als local-only, en een sidecar wordt alleen maar
  strenger. Of het deze computer mag verlaten, is de beslissing van de beheerders — als
  zij akkoord gaan, bewerk de sidecar dan handmatig."*
- **Vergrendeling.** `data mark` op een bestand dat nog niet local-only is, vereist `--local-only` of
  `--may-leave`: *"of de tekst van dit bestand ooit naar een externe AI-dienst mag worden verzonden,
  is de beslissing van de beheerders en wordt daarom nooit verondersteld"*.

Wat local-only betekent in elk hulpmiddel:

| Waar | Wat er gebeurt |
|---|---|
| Elke evaluatie (`mt-eval run`, forge-scoring) | Het beleid wordt vastgesteld op `sealed` (niveau `local-only`): alleen een loopback-eindpunt, de eigen in-process adapter van het harness (`local-model`) of een externe methode die met `--attest-local-transport` wordt uitgevoerd, mag de tekst zien |
| Terminal- en `--json`-uitvoer | De zinnen worden achtergehouden; in plaats daarvan worden regelnummers, id's, aantallen en scores afgedrukt, met één regel die uitlegt waarom |
| Bestanden die eruit zijn afgeleid | Splitsingen, opgeschoonde kopieën, hypotheses en uitvoeringslogboeken behouden de tekst (ze staan in de mappen van de gebruiker) en dragen de markering in hun eigen sidecar |
| Een model dat erop is getraind | De uitvoer ervan is ook local-only (`forge-model.json` `trained_on.terms`; niet-geregistreerd geldt als local-only): `try_translation` retourneert alleen de pagina van het model, `champollion connect`, `mt-eval serve` buiten loopback en `mt-eval translate` buiten het project vereisen `--holders-agreed-by`, en `sync` houdt antwoorden achter, zowel via de `api`- als de `local`-methode ([serving](/docs/agents/serving)) |
| Een coachingbestand of woordenboek | Een coachingbestand met een sidecar draagt zijn beleid over naar de prompt; de uitvoer van een lexicon-run wordt achtergehouden wanneer het woordenboek local-only is |

**Opmerking.** `--attest-local-transport` verklaart het eindpunt van een methode als lokaal. Geef
dit alleen op wanneer u hebt gecontroleerd dat het eindpunt zich op deze machine bevindt: een loopback-adres
kan een proxy zijn die naar elke willekeurige locatie doorstuurt.

## Training

- **Vergrendeling.** nmt-forge weigert te trainen op een bestand waarvan de sidecar
  `terms.training: not-allowed` aangeeft; een onleesbare sidecar geldt als een
  beperking, nooit als geen.
- **Vergrendeling.** `champollion data combine` voegt nooit een bestand samen dat niet is toegestaan: het verplaatst
  dit, samen met de sidecar, naar `data/not-for-training/`. Het weigert een bestand waarvan de
  beheerders nog niet hebben geantwoord — geen `terms.training` of geen
  `terms.speakers_agreed` (*"niemand heeft nog gezegd of iedereen wiens woorden
  erin staan heeft ingestemd — champollion vraagt het eerst aan de mensen; voeg daarna pas samen"*) —
  en het samengevoegde bestand neemt de strengste voorwaarden van de bestanden over (local-only als
  één dat is, niet-toegestaan als één dat is, elke eigenaar met naam genoemd).
- **Vergrendeling.** De voorwaardenstap van de journey telt een bestand in `data/parallel/`,
  `data/lexicon/`, `data/grammar/` of `data/monolingual/` pas als beantwoord wanneer
  de sidecar zowel `terms.training` als `terms.speakers_agreed` bevat (en het
  antwoord op training dat van de beheerders is, niet de voorzorgsmaatregel van het hulpmiddel hieronder); tot dan
  vraagt het opnieuw, en gaan de rails niet verder.
- **Opmerking.** nmt-forge leest `terms.training`, niet `speakers_agreed`. Bij één
  parenbestand vindt er geen samenvoeging plaats, dus wacht alleen de voorwaardenstap op dat
  antwoord: train nooit op een bestand waarvan het antwoord van de sprekers ontbreekt.
- **Vergrendeling.** Op een `test`- of `sealed`-bestand wordt nooit getraind: `--training
  allowed` wordt hiervoor geweigerd, en het toekennen van een andere rol wordt geweigerd.
- **Vergrendeling.** `not-allowed` kan niet via een opdracht veranderen in `allowed` (*"Als de beheerders
  instemmen met training, bewerk de sidecar dan handmatig"*) — met één uitzondering hieronder.
- Schriftteksten (USFM) komen binnen met `terms.training: not-allowed` gemarkeerd uit
  voorzorg door het hulpmiddel (`"x-training-default": true`); het antwoord van de beheerders vervangt
  dit.

## Wiens woorden, en wie heeft ingestemd

`--speakers` legt vast wiens woorden het bestand bevat; `--speakers-agreed` of
zij hebben ingestemd.

| `speakers_agreed` | Effect |
|---|---|
| `yes` | Training zoals de beheerders hebben aangegeven |
| `not-yet` | Training wordt geforceerd op `not-allowed` totdat ze allemaal instemmen; het bestand verschijnt in `waiting_for_agreement` |
| `some-said-no` | Geen enkel model mag ooit leren van het bestand: *"haal hun woorden eruit en zet ze in een ander bestand, en markeer de rest"* |
| (geen antwoord) | De voorwaardenstap blijft het vragen, en `data combine` weigert het bestand (hierboven) |

**De enige versoepeling die een opdracht toestaat:** `not-yet` → `yes` samen met
`--training allowed`. Een bestand dat `combine` apart had gezet, keert dan terug naar
`data/parallel/` voor de volgende samenvoeging.

**Opmerking.** Stel de `waiting_for_agreement`-vraag eenmaal per sessie, op vriendelijke toon, en
beantwoord deze alleen met de bevestiging van de persoon dat iedereen heeft ingestemd.

**`--holders-agreed-by "<who>"`** noemt een persoon onder de beheerders van de data die
ermee heeft ingestemd dat een local-only-uitvoer naar een specifieke plek mag gaan: naar de taalbestanden
van een app (`champollion connect`, vastgelegd als `holdersAgreed` van het paar), naar
een adres dat andere machines kunnen bereiken (`mt-eval serve`, `nmt-forge serve`, gerapporteerd
op `/health`) of naar een bestand buiten het project (`mt-eval translate`,
vastgelegd als `holders_agreed` van de sidecar). Het versoepelt verder niets: de
uitvoer blijft local-only voor elk hulpmiddel. **Opmerking.** Geef alleen de naam door die de persoon
u heeft gegeven.

## Wat hulpmiddelen afdrukken en nooit afdrukken

| Hulpmiddel | Drukt af | Drukt nooit af |
|---|---|---|
| `champollion data add` | Aantallen, kolommen (letter, vullingsgraad, gemiddelde lengte, aandeel Latijnse letters), een kopcel alleen wanneer deze een van de talen van het paar noemt, ELAN-tiers op nummer, en de rijnummers die de rijcontrole noemt | Een zin; elke andere kopcel (in plaats daarvan de lengte ervan); het id van een ELAN-tier |
| `champollion data mark`, `combine`, `next`, `validate` | Velden, aantallen, statussen | De tekst van een databestand — ze openen dit nooit |
| `champollion improve …` | Aantallen en percentages | De zinnen van de spreadsheets |
| `champollion sync` (de `local`- en `api`-methoden) | De sleutels waarvan de tekst woorden bevat die een forge-model nooit tijdens de training heeft gezien, uit de `meta.unseen_words` van de server | De tekst of de woorden zelf |
| `nmt-forge`, `mt-eval` | Voor een local-only, verzegeld of toestemming-vereist corpus: id's, regelnummers, aantallen, scores; `[sentence withheld]` in foutmeldingen | De zinnen ervan, in menselijke of `--json`-uitvoer |
| MCP-railshulpmiddelen | Wat de CLI afdrukt, ingekort | Zinnen; de uitvoer van een local-only-model |

**Opmerking.** `--show-text` (nmt-forge; `mt-eval compare`) drukt achtergehouden
zinnen af. Dit is bedoeld voor een persoon aan diens eigen terminal, nooit voor een agent —
wat u leest, gaat naar uw modelprovider.

**Opmerking.** Geen enkel hulpmiddel kan u beletten een bestand te openen. Open, print,
vat nooit samen en plak nooit de databestanden, testzinnen, woordenlijsten of
spreadsheets van de mensen — noch de `input-words.json` van een export: deze vermeldt de woorden van hun
trainingszinnen en blijft naast de modelmap staan, nooit erin
([serving](/docs/agents/serving#what-an-export-holds)).

**De rijcontrole.** Wanneer het een bestand binnenhaalt (paren, een testset of een woordenlijst),
controleert `data add` de rijen ervan aan de hand van de twee kolommen van het bestand zelf — geen
woordenboek, niets weggelaten. Het telt en vermeldt op rijnummer:

- kopieën: de vertaling is identiek aan de bronzin (een naam of een leenwoord
  is prima; anders ontbreekt de vertaling);
- herhalingen van een eerder paar;
- vertalingen die veel langer of korter zijn dan de gebruikelijke verhouding van het bestand (afgekapt,
  of twee zinnen in één cel);
- rijen die omgewisseld lijken: de bron leest als de vertalingen van het bestand en
  andersom;
- reeksen van rijen die één rij verschoven lijken: hun vertalingen passen beter bij de volgende of
  vorige rij — getallen, vraagtekens en lengtes komen één rij verderop overeen, en dat geldt ook voor de woorden:
  hoe goed de bronwoorden van een rij overeenkomsten vinden tussen de woorden van een vertaling,
  op basis van hoe vaak de twee samen voorkomen in de rest van hetzelfde bestand (zeldzamere woorden wegen zwaarder;
  de rij zelf blijft buiten beschouwing). Dit detecteert een verschuiving in een bestand met sjabloonzinnen waarvan
  de lengtes allemaal op elkaar lijken; het voegt niets toe wanneer de woorden van het bestand te weinig informatie bieden.

Het drukt tot 12 rijnummers per categorie af (tot 6 reeksen voor rijen die één positie verschoven zijn) — voor een
spreadsheet de rij in het eigen bestand van de persoon, inclusief de kopregel — en legt
de aantallen vast in `x-import.quality` van de sidecar. De controles op lengte, verwisseling en verschuiving
vereisen minstens 20 paren; een woordenlijst (`--into lexicon`) krijgt alleen controles op kopieën en
herhalingen. **Opmerking.** Geef de rijnummers door: de mensen bekijken die rijen in
hun eigen bestand en beslissen zelf. Open het bestand nooit om zelf te kijken.

**ELAN-bestanden.** Wanneer `data add` niet kan bepalen welke tier welke is (een kant die door
geen enkele vlag wordt aangeduid, waarbij niet precies één tier in die taal is vastgelegd), weigert het
en somt het de tiers op nummer op, in de volgorde van het bestand: `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` voor een tier
die naar een andere verwijst. Geef de nummers door als `--source-col` en `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`);
de sidecar legt de nummers vast (`x-import.elan_tiers`). Een nummer of id dat
geen tier aanduidt, wordt geweigerd (`no such tier — … Name a tier by its number`), en
dat geldt ook voor een tier waarvan de vastgelegde taal niet die van die kant is. Twee tiers worden alleen
aan elkaar gekoppeld wanneer de ene naar de andere verwijst of wanneer ze tijdslots delen — nooit op basis van
giswerk. **Opmerking.** Het id van een tier is wat de maker van het bestand heeft ingevoerd en is
vaak de naam van een persoon, dus `data add` drukt dit nooit af. De persoon kan zelf een
exact id invoeren; u geeft het nummer door.
LIFT-bestanden worden gematcht op basis van hun taalcodes, Toolbox-bestanden op basis van hun MDF-markeringen
(`\ge` en `\xe` zijn volgens de standaard Engels).

## Transmissiemodi

Elke evaluatie stelt haar corpus vast op één modus voordat er iets wordt verzonden
(`arena/mt_eval_harness/transmission_policy.py`), en legt dit vast in het
uitvoeringslogboek:

| Modus | Wanneer | Externe modellen |
|---|---|---|
| `cleared` | Een licentie die is vrijgegeven voor herdistributie | Toegestaan |
| `no-train` | Een standaard Creative Commons-licentie voor niet-commercieel gebruik of geen afgeleide werken; of een niet-geregistreerd corpus dat geen licentie declareert | Alleen via kanalen die niet trainen op invoer: OpenRouter vastgezet op `data_collection: deny`, API's van leveranciers zelf, of lokaal. Een garantie tegen training, geen garantie tegen bewaring |
| `consent-required` | Een gewijzigde, maatwerk- of niet-vermelde licentie (`LicenseRef-*`) | Geweigerd totdat de vermelding van de dataset een `transmission_consent`-toekenning vastlegt (`granted_by`, `date`, `scope`, `evidence`); lokaal werkt nog steeds |
| `sealed` | Een apart gehouden segment of gouden standaard, een set in quarantaine, of een local-only-markering van een beheerder | Geweigerd, zonder uitzondering mogelijk |

- **Vergrendeling.** Tekst van een `consent-required`- of `sealed`-corpus wordt ook
  achtergehouden voor de terminal.
- Bij een externe methode (een plug-in) op een `no-train`-corpus wordt gewaarschuwd, niet
  geweigerd: het harness kan het kanaal van de plug-in niet zien. Op `consent-required`-
  en `sealed`-corpora wordt het geweigerd tenzij `--attest-local-transport`.
- **Vergrendeling.** De lokale provider geldt alleen als lokaal wanneer het eindpunt een
  loopback-adres is (`localhost`, `127.0.0.1`, `::1`, een unix-socket) — nooit
  op basis van de naam.
- **Opmerking.** Leg nooit een `transmission_consent`-toekenning vast en interpreteer nooit een
  licentie namens de rechthebbende. Een toekenning wordt vastgelegd door de beheerder
  van de dataset zodra de rechthebbende deze verleent.
- **Opmerking.** `--allow-data-collection` heft de no-train-vastzetting alleen op voor een
  niet-geregistreerd corpus dat geen licentie declareert; het bevestigt dat de aanroeper over
  de rechten beschikt. Geef dit alleen door wanneer de persoon aangeeft over de rechten te beschikken.

## Registratieniveaus

Het registreren van een corpus is optioneel: de rails hebben dit nooit nodig. Er wordt een
metadatakaart geschreven zodat het corpus benoemd, vergeleken en, als de beheerders dat verkiezen,
weergegeven kan worden. `champollion network register-corpus` is interactief via een terminal
en kan via scripts met vlaggen worden aangestuurd (`--tier`, `--data`, `--license`, `--name`, …).
**Opmerking.** Het niveau is, net als elke voorwaarde, de beslissing van de beheerders.

| Niveau | De kaart | De tekst | Wat het weigert |
|---|---|---|---|
| `local-only` (standaard) | Geschreven naast het `--data`-bestand (of `--out`, of hier), nooit in de gedeelde kaartenmap | Verlaat deze computer nooit; de sidecar krijgt `transmission: local-only` | — |
| `private` | Metadata met `quarantine: true`; vanuit een npm-installatie blijft het lokaal, en het weergeven ervan is een afzonderlijk verzoek (`champollion network submit --type dataset`) | Wordt nooit geüpload; geen overdrachtsmarkering — de licentie bepaalt de modus | — |
| `public` | Metadata plus een fetch-from-source-verwijzing (`--repo-url`, `--builder`) | Wordt nooit gehost: opgehaald bij de bron | Een niet-commerciële, geen-afgeleide-werken-, beperkte of onbevestigde licentie (*"Registreer in plaats daarvan privé of local-only."*); `--data` |
| `sealed` | Metadata met `quarantine: true` en een verzegeld blok (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Er bestaat alleen cijfertekst, geschreven naar `<id>.sealed.json` of `--seal-out` | Een bestand dat een bytekopie is van een openbaar corpus; `--data` |

In elk niveau wordt er bij de registratie niets geüpload (`--json` meldt
`uploadedContent: false`). De enige netwerkaanroep, vanuit een npm-installatie, vergelijkt
de sha256 van het bestand met die van de openbare catalogus op deze computer (de hash verlaat
de computer nooit); met `CHAMPOLLION_OFFLINE=1` vermeldt de kaart dat de vergelijking niet is
uitgevoerd. Met `--data` legt de sidecar `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` en `registeredAt` vast. **Vergrendeling.** Een geregistreerd id wordt
nooit opnieuw afgeleid: het opnieuw registreren van het bestand onder een ander id wordt geweigerd, en
een gewijzigd bestand (een andere sha256) krijgt niet langer het id of de beoordeling van de kaart.

## Uitvoer is een afgeleid werk

De uitvoer van een model over beperkte zinnen is hiervan een afgeleid werk, en een
evaluatie genereert dergelijke uitvoer op grote schaal. De hulpmiddelen behandelen uitvoer op dezelfde manier
als hun invoer:

- Voor elk corpus dat niet `cleared` is, legt de run een mededeling vast en drukt deze af:
  de voorspellingen ervan zijn machinaal afgeleide werken van beperkte zinnen en mogen niet worden
  verspreid.
- Waar de tekst wordt achtergehouden (local-only, verzegeld, toestemming vereist), krijgt elk
  bestand dat eruit is gemaakt — uitvoeringslogboeken, rapporten, vergelijkingen, cachevermeldingen,
  `mt-eval translate`-uitvoer, de gesplitste kanten van forge, opgeschoonde corpora en
  hypotheses — een set/1-sidecar met de markering (`derived_from`,
  `written_by`). Een `no-train`-corpus krijgt de mededeling, maar geen sidecar.
- Een model dat is getraind op local-only-tekst schrijft local-only-uitvoer (hierboven).
- `mt-eval publish` uploadt nooit de zinnen van een local-only-corpus, zelfs niet met
  `--publish-entries`, en publiceert voor zo'n corpus een gecoachte prompt standaard
  alleen als hash. Voor andere corpora wordt de prompt gepubliceerd tenzij
  `--redact-coaching`.

**Opmerking.** Publiceren is de beslissing van de mensen, genomen in hun eigen woorden, waarbij het
voorbeeld (`--dry-run`) eerst aan hen wordt getoond. Publiceer, plak of verstuur de uitvoer van een run
nooit namens hen.

## Meer informatie

- [Het operationele contract](/docs/agents/contract) §1 en §3.
- [Uw woorden, uw regels](/docs/your-words-your-rules) — de versie voor de mensen.
- [Corpora registreren](/docs/network/sovereignty/registering-corpora) — de
  niveaus, met elke vlag.
- [Serving en implementatie](/docs/agents/serving) — local-only-uitvoer in
  de praktijk.
- [Datasoevereiniteit in begrijpelijke taal](/docs/learn/data-sovereignty).
