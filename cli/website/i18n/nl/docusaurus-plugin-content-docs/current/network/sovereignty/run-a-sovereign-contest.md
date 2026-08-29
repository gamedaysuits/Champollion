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

- ✅ **Live:** corpusregistratie (metadatakaarten, hash-pinning, exposure
  lanes), het register voor verzegelde sets (digest + beheerdersgroep + kwalificatie, geen
  inhoud), het wedstrijdmechanisme met de verzegelde lane, de autorisatie-
  verzoek/toekenning/audit-gegevenslaag (in afwachting → M-van-N beslissing → eenmalige
  tijdgebonden toekenning, append-only hash-gekoppeld auditlogboek), en scores-only
  emissie afgedwongen op de databaselaag.
- ✅ **Live: de scoring node van de organisator + hypotheses lane.** Eén
  commando splitst uw corpus in een openbare dev set (de kwalificatie), een blinde
  test set (bron vrijgegeven, referenties in rust verzegeld op UW machine), en
  optioneel een volledig geheime set (`mt-eval contest prepare`). Het registreren van de
  verzegelde set(s), kwalificatie en wedstrijd is **self-service vanuit uw eigen
  login** — `contest prepare --self-serve`, of `mt-eval contest register
  --manifest` voor een wedstrijd die u eerder heeft voorbereid — waarbij elke rij
  identiteitsgebonden is op de databaselaag; geen curator in de loop en geen
  geprivilegieerde sleutel (zie Stap 4 voor de eerlijke beperkingen). Deelnemers
  dienen hun vertalingen in met `mt-eval contest submit-hypotheses` (de CLI
  scoort de dev set lokaal en weigert uploads onder uw drempelwaarde);
  UW zelf-gehoste node (`mt-eval node serve`) herscoort het dev-bewijs
  zelf, filtert op de kwalificatie, autoriseert volgens het model van uw wedstrijd
  (`per-submission` — een beheerder keurt elke scoring goed — of `blanket` /
  `open`), scoort de blinde set tegen referenties die uw machine nooit verlaten,
  en publiceert **aggregates-only** runkaarten. Wat deze lane NIET
  bewijst: dat de genoemde methode de hypotheses heeft geproduceerd (methode-identiteit wordt
  door de deelnemer geclaimd en als zodanig gelabeld op elke runkaart), en het kan
  een vastberaden tegenstander niet stoppen om referentiesignalen te extraheren uit vele afzonderlijke
  inzendingen — rate limits, byte-identieke dedup en de auditketen vertragen
  dit; de method-execution lane hieronder is het echte antwoord.
- ✅ **Live: twee secret-set method lanes.** Deelnemers met een gepubliceerd
  hypotheses-lane record kunnen hun methode voorstellen tegen uw geheime set. De
  node kiest de lane op basis van de inzending:
  - **Lane A — declaratief model (voorkeur).** Een standaard neuraal model is
    DATA: `mt-eval contest submit-model` verzendt safetensors-gewichten + een
    declaratieve tokenizer + een configuratie — **geen code, geen Dockerfile.** Uw node
    valideert dat het code-vrij is (safetensors, geen pickle; geen
    `trust_remote_code`/`auto_map`; alleen databestanden) en draait de gewichten in
    zijn EIGEN vertrouwde engine (`transformers`, `trust_remote_code=False`, offline).
    Architectuur is standaard permissief (alles wat uw engine native laadt); een
    voorzichtige host kan een allowlist vastzetten. Er wordt niets onvertrouwds uitgevoerd, dus er
    is niets om te sandboxen. Gepubliceerd `declarative-model`, methode-identiteit
    **code-vrij door constructie**.
  - **Lane B — uitvoerbare bundel (sandbox fallback).** Voor methoden die WEL code zijn:
    `mt-eval contest submit-method` verzendt een Dockerfile + entrypoint. Nadat uw
    beheerder goedkeurt, voert UW node het uit in een netwerk-geïsoleerde
    container (`--network=none` — de netwerkstack bestaat hierbinnen niet;
    read-only root, dropped capabilities, geschoonde omgeving), met
    eerst geautomatiseerde statische controles en referenties die de container nooit binnenkomen.
    Gepubliceerd `method-execution` met **uitvoerings-geverifieerde** identiteit.
  Voor beide lanes geldt: de bundel-hash wordt bevroren in het autorisatieverzoek (wat
  draait is aantoonbaar wat werd voorgesteld), en scores worden gepubliceerd via hetzelfde
  aggregates-only pad. Voor maximale isolatie kan de scoring machine een echte
  airgap zijn: geautoriseerde verzoeken en Ed25519-ondertekende scores-only bundels worden overgedragen via
  verwijderbare media (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  de geheime tekst bereikt zelfs de verbonden machine nooit. Wat deze lanes nog
  NIET bevatten: hardware-attestatie van de node (identiteit is zelf-gerapporteerd),
  formeel geschillenmechanisme, en — specifiek voor Lane B — diepere container-
  hardening voorbij de verwijderde netwerkstack (seccomp-profielen, microVM's; dit
  is een reden om de voorkeur te geven aan Lane A). Zie
  [Eerlijke beperkingen](/docs/network/honest-limitations).
- 🔲 **In ontwikkeling: threshold signing.** M-van-N beheerdersgoedkeuring wordt
  vandaag *vastgelegd* in de autorisatie- en audittabellen; de cryptografische
  threshold-key tooling die een toekenning onmogelijk maakt zonder M aandelen is nog
  niet gebouwd — de huidige verzegelingssleutel is een gelabelde single-keypair stand-in
  (`champollion seal-corpus keygen`), en de airgap score-bundel handtekening
  is een enkele node-sleutel (`seal-corpus sign-keygen`), geen steward-ceremonie.
- ❌ **Niet aan de orde, by design:** Champollion die uw corpus host, uw
  sleutels beheert, of prijzengeld vasthoudt. Hypotheses van deelnemers (hun eigen vertalingen)
  passeren onze opslag; uw corpusinhoud doet dat nooit.

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

- **docker of podman** — vereist voor de methode-uitvoeringsstrook. De node detecteert automatisch docker, vervolgens podman; als geen van beide aanwezig is, weigert hij dit nadrukkelijk. Er is **geen terugvaloptie** — container-isolatie met `--network=none` is de dragende garantie, dus niets wordt uitgevoerd zonder een container-runtime.
- **Node.js 20.11+ en de `champollion` npm CLI** — het harnas implementeert het verzegelde cijfer niet opnieuw. `champollion seal-corpus` (werkwoorden: `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`) is de enige cijferimplementatie (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), en de organisatornode roept deze aan via een shell.
- **Een node-configuratie op `~/.mt-eval/node.json`.** Elk `mt-eval node`-commando weigert te starten zonder een dergelijke configuratie — voer een van de commando's eenmaal uit en het foutbericht vermeldt het configuratiepad en de locatie van de sjabloon (deze wordt meegeleverd in de harnasbron, in `mt_eval_harness/contest_node.py`). De configuratie bevat uw zelf-gerapporteerde `node_id` (opgenomen in elke aanvraagvingerafdruk) en een `contests`-map die verwijst naar uw ontwikkelingsreferenties en verzegelde artefacten.
- **Een aanmelding.** Er is geen afzonderlijke stap voor het aanmaken van een account: het eerste commando dat een identiteit vereist (bijv. `mt-eval contest prepare --self-serve` of `mt-eval publish`) opent een OAuth-aanmelding via de browser met **GitHub of Google** (Supabase Auth). Het e-mailadres van dat account is de identiteit waaraan elke registerrij is gekoppeld — gebruik een adres dat uw organisatie beheert.
- **De innamebegrenzing.** Inzendingen van deelnemers zijn per inzender beperkt tot **standaard 5 per 24 uur** (ter voorkoming van probing; stel dit per wedstrijd in met `--intake-daily-limit` bij het voorbereiden, of als standaard voor een gedeelde-taakeditie). Stem uw wedstrijdplanning hierop af.

**Een eerlijk voorbehoud bij zelfbediende registratie.** Op het **standaard netwerk-gehoste eindpunt** stopt zelfbediende registratie (`contest prepare --self-serve` / `contest register`) momenteel bij een productie-eindpuntbeveiliging: de CLI weigert met een expliciete melding in plaats van naar het productieproject te schrijven, in afwachting van een beleidsbeslissing over het openstellen hiervan. Gefedereerde hosts (uw eigen Supabase-project) worden hier niet door beïnvloed. Als u de beveiliging op de standaardhost tegenkomt, is dat de huidige situatie en geen foutconfiguratie aan uw kant — [open een issue](https://github.com/gamedaysuits) en wij begeleiden de registratie verder.

---

## Stap 1 — Bouw uw afgeschermd testcorpus

Ontwerp het corpus waaraan u wilt meten, en houd het vanaf dag één afgeschermd: niets erin mag ooit zijn gepubliceerd, geplaatst of gedeeld met een modelleverancier.

- Volg het [Corpus Design Framework](/docs/network/specifications/corpus-design) voor invoerstructuur, moeilijkheidslagen en registerdekkking, en het [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) voor tooling.
- Laat vermeldingen controleren door vloeiende sprekers vóór verzegeling — het [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) beschrijft een beoordelingsstructuur die u kunt hergebruiken voor corpus-QA, niet alleen voor methodebeoordeling.
- Bepaal nu het **versie**label van het corpus (bijv. `v1`). Autorisatieverleeningen zijn gebonden aan een specifieke versie, dus versiebeheer is onderdeel van het beveiligingsmodel, niet van de administratie.

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

Het manifest blijft op uw machine — registratie verstuurt alleen de inhoudsvrije id's, digests en drempelwaarden. Elke registerrij is **identiteitsgebonden**: de database legt het aangemelde account vast dat de registratie heeft uitgevoerd en bevriest die binding tegen latere bewerkingen, en een kwalificatie mag alleen een verzegelde set bewaken die door **dezelfde** identiteit is geregistreerd. Verzegelde sets worden in quarantaine geboren (ze kunnen nooit een gewone wedstrijd ondersteunen of op het publieke klassement verschijnen), kwalificaties worden in een veilige toestand geboren, en registratie is snelheidsbeperkt — alles afgedwongen door databasetriggers onder elke client, inclusief de onze. Het register zelf is openbaar leesbaar, zodat u kunt verifiëren dat uw vermelding precies zegt wat u heeft verzegeld — en niets meer.

**Eerlijke beperkingen.** De zelfbedieningsdeur is uitsluitend voor registratie (insert-only op de databaselaag). **Kwalificatierotatie en verzegelde-setpensionering blijven curator-gemedieerd** — open een issue of neem contact op met het project via [GitHub](https://github.com/gamedaysuits). En het uitvoeren van het scoringsknooppunt voor organisatoren in de latere stappen (levenscyclusvoortgang, autorisatieverleeningen, auditoperaties) is een afzonderlijke, service-gecredentialiseerde strook op uw eigen knooppunt — zelfbediening stopt bij het publieke register.

## Stap 5 — Kies beheerders en de M-van-N-regel

Kies de personen of instellingen die gezamenlijk elke evaluatie van uw corpus moeten goedkeuren, en de drempelwaarde (bijv. **3 van 5**). Beheerders dienen verantwoording af te leggen aan uw gemeenschap, niet aan Champollion — zie [Gegevensbeheer](/docs/network/sovereignty/data-sovereignty) en [Eigendom & Voorwaarden](/docs/network/sovereignty/ownership-transfer) voor de manier waarop per-gemeenschapsvoorwaarden worden vastgesteld.

**Eerlijkheidsbox:** de drempel-*cryptografie*-tooling (sleutelaandelen zodanig dat een verlening letterlijk niet kan worden aangemaakt zonder M handtekeningen) is **in ontwikkeling**. Vandaag wordt de M-van-N-regel afgedwongen als vastgelegd proces: elk toegangsverzoek komt in een **wachtende** wachtrij terecht, beheerdersbeslissingen worden vastgelegd, een verlening wordt alleen aangemaakt voor een geautoriseerd verzoek, elke verlening is **eenmalig, tijdgebonden en gebonden aan één specifieke (methode, corpusversie, evaluatieknooppunt)-vingerafdruk**, en elke gebeurtenis — inclusief geblokkeerde pogingen — wordt opgeslagen in een **append-only, hash-geketend, openbaar leesbaar auditlogboek**. De database weigert illegale toestandsovergangen onder elke client en sleutel. Wat het nog niet kan weigeren is een compromittering van de platformoperator zelf — dat is wat drempelondertekening sluit, en totdat het beschikbaar is, dient u "Champollion beheert nul sleutelaandelen" te beschouwen als het ontwerpdoel waaraan wordt gewerkt, niet als een eigenschap die u vandaag kunt verifiëren.

## Stap 6 — Stel de prijs vast

Bepaal en publiceer bij de wedstrijd:

- **Bedrag en valuta.**
- **Sponsor** — wie het geld inlegt.
- **Waar de middelen staan** — de rekening van uw organisatie, of een door u aangewezen gemeenschapstrust. **Champollion beheert, escrowt of routeert prijsgelden nooit.** Het vooraf publiceren van de identiteit van de houder is wat de prijs geloofwaardig maakt; zie de [notitie over sponsor-wanbetalingsrisico](/docs/network/sovereignty/terms-templates#trojan-horse-risks) in de voorwaardentemplates.
- **Drempelvoorwaarden** — de scoredrempel die een methode moet halen, opgesteld conform de [Prijsspecificatie](/docs/network/specifications/prizes): metrische drempelwaarden, vereisten voor sprekervalidatie, reproduceerbaarheid. Maak de toekenningsvoorwaarden verifieerbaar op basis van de gepubliceerde scores, zodat niemand uw woord (of het onze) hoeft te vertrouwen over de vraag of de drempel is gehaald.

## Stap 7 — Maak de wedstrijd aan

Wedstrijden over verzegelde sets gebruiken de expliciete **verzegelde strook**. Geschiktheid is fail-closed: de wedstrijd wordt geweigerd tenzij uw verzegelde-setregistratie bestaat en actief is — en het aanmaken van de wedstrijd verleent **niemand** toegang tot het corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(De `--corpus`-waarde is uw geregistreerde `sealed_set_id`. De verzegelde strook wordt **automatisch** geselecteerd op basis van de verzegelde-setregistratie — geen extra vlag; een verzegelde set kan nooit een gewone wedstrijd ondersteunen, en een gewone in quarantaine geplaatste dataset kan nooit een wedstrijd ondersteunen. Beide regels worden afgedwongen in de database, onder elke client. Als u in Stap 4 heeft geregistreerd met `contest register` of `prepare --self-serve`, **bestaat de wedstrijdrij al** — sla deze stap over; `contest create` handmatig is alleen voor het samenstellen van een wedstrijd vanuit een reeds geregistreerde verzegelde set.)*

## Stap 8 — Methoden kwalificeren zich eerst in het openbaar

Ontwikkelaars bouwen en scoren hun methoden op **publieke** corpora voor uw taalpaar — het normale [methode-indienen](/docs/network/getting-started/submit-a-method)-pad. De `current_qualifier_id` van uw verzegelde set benoemt de publieke ronde die een methode moet halen voordat een verzegelde uitvoering zelfs maar kan worden aangevraagd. Dit houdt de sondeerdruk van uw corpus af: niemand mag op de verzegelde set mikken totdat hij echte prestaties in het openbaar heeft aangetoond.

:::note[Deelnemers: op welk eindpunt staat uw wedstrijd?]
Een **netwerk-gehoste** wedstrijd vereist geen installatie — het standaardeindpunt dat met het harnas wordt meegeleverd bevat de wedstrijdmachinerie (hypothese-inname, de kwalificatiepoort, methodevoorstellen), en `mt-eval contest submit-hypotheses` / `submit-method` werken direct na installatie.

Een **gefedereerde** contest — de organisator draait de machinerie op zijn eigen Supabase-project, zodat inzendingen nooit via ons worden doorgevoerd — publiceert zijn eindpunt bij de contestmaterialen. Exporteer het vóór het indienen:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Als de harness is gericht op een eindpunt dat de contestmachinerie niet heeft (bijvoorbeeld een gefedereerde host waaraan een migratie ontbreekt), stopt de opdracht met *"de contestrijstrook is nog niet beschikbaar op dit Supabase-eindpunt"* en geeft aan met welk eindpunt er werd gecommuniceerd. (Gefedereerde organisatoren: publiceer deze twee waarden naast uw corpusrelease, `--node-id`, en `--corpus-version`.)
:::

## Stap 9 — Verzegelde uitvoeringen: verzoek, autoriseer, voer uit, scores naar buiten

Voor elke kwalificerende methode:

1. Een **verzoek** wordt ingediend tegen uw verzegelde set — het komt in `pending` terecht en bevat een onveranderlijke vingerafdruk van (methode-tarball-hash, corpus-id, corpusversie, `scores-only`, evaluatieknooppuntmeting).
2. Uw **beheerders beslissen** (M-van-N). Goedkeuring maakt een **verlening** aan: eenmalig, vervallend, uitsluitend geldig voor die exacte vingerafdruk.
3. De evaluatie wordt uitgevoerd in de netwerk-geïsoleerde sandbox op **uw** knooppunt (`mt-eval node run-method`): geautomatiseerde statische controles, een container zonder netwerkstack, referenties buiten de container gehouden — of, voor maximale isolatie, op een echte-airgap-machine met ondertekende scores-only-bundels die via verwijderbare media worden uitgewisseld (zie het statusvak hierboven voor wat wel en niet is gedekt).
4. **Alleen scores verlaten de omgeving.** De `scores-only`-emissieregel is vastgelegd op de databaselaag; per-vermelding tekst uit uw corpus wordt nooit gepubliceerd.
5. Elke stap — verzoek, stemmen, verlening, gebruik en eventuele geblokkeerde pogingen — wordt toegevoegd aan het publieke, hash-geketende auditlogboek dat u (en iedereen) opnieuw kan afspelen.

## Een methode indienen (voor deelnemers) — twee lanes

De meeste NMT-inzendingen zijn niet exotisch: een standaard fine-tuned transformer en zijn gewichten. Daarvoor is er een **voorkeurs, code-vrije lane** — en een sandbox fallback voor methoden die daadwerkelijk code zijn.

### Lane A — declaratief model (voorkeur voor standaard NMT)

Als uw methode een standaard neuraal model is, dient u deze in als **data** — de gewichten, tokenizer en configuratie — en de organisator draait deze in zijn eigen vertrouwde inference engine. **Geen Dockerfile, geen code, geen sandbox.** Omdat niets van wat u indient wordt uitgevoerd, is de veiligheidscontrole van de organisator een beslisbare formaatvalidatie in plaats van te proberen te bewijzen dat willekeurige code veilig is — een strikt sterkere garantie voor u en voor het corpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

De regels waaraan uw bundel moet voldoen (lokaal gevalideerd vóór het uploaden, en opnieuw door de node van de organisator):

- **Gewichten zijn `safetensors`, nooit pickle.** Een PyTorch `.bin`/`.pt`/`.ckpt`
  is een pickle — willekeurige code bij het laden — en wordt geweigerd. Exporteer naar
  `model.safetensors` (`safetensors` / `transformers` doen dit native).
- **Een architectuur die de engine van de organisator native laadt.** `architectures` van `config.json`
  kan elke architectuur zijn die de `transformers` van de host implementeert
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, en vele andere) — hosts zijn
  **standaard permissief**, omdat met `trust_remote_code=False` de veiligheid
  voortkomt uit het code-vrije formaat, niet uit de naam van de architectuur (een niet-ondersteunde
  architectuur laadt simpelweg niet, waardoor er niets wordt uitgevoerd). Een voorzichtige host kan
  een allowlist publiceren. Geen `auto_map`, geen `trust_remote_code` — deze smokkelen
  aangepaste code terug naar binnen en worden altijd geweigerd.
- **Een declaratieve tokenizer** (`tokenizer.json` of een `sentencepiece` `.model` +
  vocab), en **alleen databestanden** — geen `.py`/scripts/binaries in de bundel.

De organisator draait het met `trust_remote_code=False`, offline, en alleen scores verlaten het systeem — gepubliceerd als `declarative-model`, methode-identiteit **code-vrij door constructie**. (Multi-GB gewichten: gebruik `--bundle-out` voor de sneakernet lane, net als hieronder.)

### Lane B — uitvoerbare bundel (de sandbox, voor code-methoden)

Als uw methode daadwerkelijk code is — een pijplijn, een LLM-gecoachte hybride, een aangepaste decoder — kan deze niet declaratief worden uitgevoerd, dus gaat deze in plaats daarvan door de netwerk-geïsoleerde sandbox. Dit is de eerlijk gezegd zwakkere lane (het bevat onvertrouwde code in plaats van te weigeren deze uit te voeren), dus gebruik Lane A wanneer uw methode een standaard model is.

**Het contract voor uitvoerbare bundels is stdin/stdout.** Uw bundel declareert een ingangspunt (bijv. `method/translate.py`). Binnen de container voert de node van de organisator precies het volgende uit:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Bronzinnen worden één per regel aangeboden via stdin; u schrijft één vertaling per regel naar stdout. Alles wat u als `--method-dir` hebt doorgegeven, wordt opgeslagen onder `method/` in de bundel en **alleen-lezen gemonteerd op `/method`** tijdens uitvoering — inclusief gewichten, zonder dat deze in de image hoeven te worden gekopieerd. De container heeft geen netwerkstack (`--network=none`), een alleen-lezen root en een beschrijfbare `/tmp`.

**Een minimale Hugging Face transformers-wrapper:**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Dien het in met:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(U heeft eerst een gepubliceerde hypothesestrookrecord voor de wedstrijd nodig — de T1-poort van stap 9 — en `--agree` bevestigt de voorwaarden voor methode-inzending.)

**Gewichten van meerdere GB: gebruik de sneakernet-strook.** Het gehoste innamepunt uploadt uw tarball als één **enkele POST** naar de opslag van de contesthost, dus dit is begrensd door de uploadlimiet van die host — geschikt voor code en kleine modellen, maar niet voor checkpoints van meerdere GB. De bundelcontract zelf staat veel grotere artefacten toe (tarballs tot 100 GB, gebouwde images tot 150 GB). Sla voor grote gewichten de gehoste upload over:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

De uitwisselingsmap wordt via verwijderbare media (of een ander kanaal dat u beiden vertrouwt) naar de organisator overgebracht; deze neemt de map in met `mt-eval node import-bundle`. De SHA-256 van de bundel wordt in beide gevallen vastgelegd in het autorisatieverzoek, zodat aantoonbaar wordt uitgevoerd wat u heeft voorgesteld.

**Organisatoren: laad basisimages vooraf op air-gap-machines.** Omdat de imagebouw wordt uitgevoerd met `--network=none`, moet de `FROM`-basisimage van de Dockerfile al aanwezig zijn in de lokale imagestore van de machine. Op een verbonden machine: `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; breng `base.tar` over samen met de bundel; op de air-gap-machine: `docker load -i base.tar` vóór het uitvoeren van `mt-eval node run-method`. Spreek de basisimage(s) af met deelnemers in uw gepubliceerde wedstrijdmaterialen.

## Stap 10 — Publiceer scores, ken toe conform uw gepubliceerde drempelwaarde

Scores-only-resultaten worden gepubliceerd op het [klassement](/docs/network/leaderboard/rules) zoals elke andere uitvoering, gemarkeerd als verzegelde-setevaluaties. Als een methode de drempelvoorwaarden haalt die u in Stap 6 heeft gepubliceerd — inclusief [sprekervalidatie](/docs/network/specifications/speaker-validation), wat de poort van uw gemeenschap is, niet een geautomatiseerde — kent **u** (of uw trust) de prijs toe, conform uw eigen gepubliceerde voorwaarden. De rol van Champollion eindigt bij de meting.

---

## Wat u voor altijd behoudt

- **Het corpus.** Het heeft uw infrastructuur nooit verlaten. Zet de cijfertekst offline en de verzegelde set kan simpelweg niet meer worden uitgevoerd.
- **De sleutels.** Toegang vervalt wanneer uw beheerders stoppen met het verlenen ervan.
- **Het geld.** Het was nooit ergens anders.
- **Het record.** De hoofddigest van het auditlogboek is publiceerbaar, zodat de geschiedenis van wie wat heeft uitgevoerd tegen uw corpus niet stilletjes kan worden herschreven — door wie dan ook, inclusief ons.

Voor voorwaardentaal die u kunt aanpassen — eigendom, scores-only-licentieverlening en een expliciete rondleiding langs de manieren waarop een wedstrijd kan worden aangevallen — zie [Voorwaardentemplates](/docs/network/sovereignty/terms-templates).
