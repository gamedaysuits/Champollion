---
sidebar_position: 9
title: "Soevereine Evaluatie Node — Hardware & Air-Gap Operaties"
description: "Referentiehardware, air-gap-discipline en sleutelbeheeroperaties voor het draaien van een door de gemeenschap beheerde evaluatie node: de geheime testset verlaat uw machine nooit; methoden komen naar de data."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Soevereine Eval Node — Hardware & Air-Gap Operaties

Een soevereine eval node is een machine die **u** beheert, die een geheime testset bevat en vertaalmethoden hiertegen evalueert. Methoden reizen naar de gegevens; de gegevens reizen helemaal niet. Scores — en uitsluitend scores — komen eruit.

Deze pagina is de praktische specificatie: welke hardware u moet kopen (of hergebruiken), hoe u deze instelt, en de operationele discipline die ervoor zorgt dat "de testset de machine nooit heeft verlaten" een feit is dat u kunt verdedigen in plaats van een belofte die u moet vertrouwen.

:::info[Wat vandaag beschikbaar is vs. wat gemarkeerd is als in uitvoering]
De software voor de organizer-node **is vandaag beschikbaar** in `mt-eval` — zie de
[handleiding voor soevereine competities](/docs/network/sovereignty/run-a-sovereign-contest):
voorbereiding en verzegeling van de competitie, de publieke kwalificatiegate die **door
de node zelf opnieuw wordt uitgevoerd voor elke inzending voordat een custodian wordt
gevraagd iets goed te keuren**, drempelwaarde-gestuurde scoring en de netwerk-geïsoleerde
methode-executor met zijn importscan. Wat een node accepteert, is een **model of een methode** — een
artefact dat deze kan uitvoeren. Het uploaden van vertalingen van een bron-publieke blind set is
op 2026-09-06 uitgefaseerd als inzendingsroute voor competities en het bijbehorende commando is verwijderd; een
bron-publieke ronde blijft alleen bestaan als optionele diagnose voor de organizer, en
zelfgerapporteerde scores horen thuis op het open leaderboard, wat een openbaar bord is
geïndexeerd op corpus en taalpaarrichting in plaats van een competitie.
De **threshold-sleutelceremonie en de sealed-at-rest-workflow uit §4 zijn vandaag
ook beschikbaar**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, quorumaandelen aangeboden tijdens runtime
(`node run-method --offline --share …`), een lokaal autorisatiegrootboek met hash-keten
(`node ledger verify|head`), ondertekende scoremanifesten
(`node sign-manifest` / `node verify-manifest`) en de air-gap-tools
uit §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Scorebundels
worden **op de node, in Python** ondertekend — de offline bundel heeft geen
Node.js-runtime nodig — en hetzelfde formaat voor losgekoppelde handtekeningen verifieert met
beide implementaties. Aan organizer-zijde **is request staging ook beschikbaar**:
`mt-eval node stage-request` schrijft exact het uitwisselingsverzoek dat een online
relay zou sturen, vanuit een bundelbestand en geheel zonder database (voor een
generale repetitie of een implementatie die nooit verbinding maakt), vooraf gevalideerd zoals import
het zou valideren en gekoppeld aan de ID van de node; de scores die terugkomen zijn
verifieerbaar via het manifest, maar worden niet via de relay gepubliceerd, omdat er geen
autorisatierecord bestaat om ze tegen te publiceren. De
plaatsvervanger met één enkel sleutelpaar blijft alleen behouden voor competities waarin de organizer
de referenties rechtstreeks bezit — elk oppervlak vermeldt welk traject in
gebruik is. Eerlijk gezegd, wat v1 **niet** bevat: hardwarematige remote
attestatie (TEE) wordt niet geclaimd (§5), en threshold-*ondertekening* aan platformzijde
(goedkeuringen via de telefoon door custodians tegen gehoste infrastructuur) is
toekomstig werk — op een soevereine node wordt het beheer uitgeoefend door fysiek
M van N aandelen bij de machine aan te bieden (§4). En om precies te zijn over de
cryptografie: dit betreft Shamir M-van-N secret sharing waarbij de sleutel
**tijdens een geautoriseerde run in het vergrendelde geheugen van de node wordt gereconstrueerd**
(en vervolgens gewist) — het is *geen* multi-party computation, en de sleutel bestaat
kortstondig samengesteld op uw offline machine. Tot slot: totdat de gate voor
toestemming van de gemeenschap opent, draait het traject **uitsluitend op
synthetische gegevens**; echte corpora wachten op die toestemming.
:::

## 1. Referentiehardware

De uitvoerder draait op zichzelf staande methoden: lokale NMT-decodering, FST/morfologie-validatie en metrische berekeningen. Er vinden geen cloudaanroepen plaats binnen de air-gap (LLM-API-methoden zijn precies de klasse die een air-gapped node weigert — zie de methodeklassen van de [benchmarkspecificatie](/docs/network/specifications/benchmark)).

| Niveau | Specificatie | Geschikt voor | Geschatte kosten (2026) |
|---|---|---|---|
| **Minimum** (werkt) | 4-core x86_64 of Apple/ARM, 16 GB RAM, 500 GB SSD | Metriek + FST-evaluatie, CPU-decodering van kleine NMT-modellen (traag maar correct) | US$0 (een reserve-laptop) – $400 tweedehands |
| **Aanbevolen** | 8-core, 32 GB RAM, 1 TB NVMe, NVIDIA GPU ≥ 12 GB VRAM (bijv. RTX 4070-klasse) | Comfortabele NMT-decodering voor volledige testbatterijen; parallelle methode-evaluatie | ~US$900–1.600 (klein formaat werkstation) |
| **Institutioneel** | 16-core, 64–128 GB RAM, 2 TB NVMe, 24 GB+ VRAM | Wedstrijden met veel methoden, grote batterijen, gearchiveerde opslag van cijfertekst | ~US$2.500–4.000 |

Harde eisen op elk niveau:

- **Geen radio's, of radio's waarvan u kunt bewijzen dat ze uit staan.** Het beste: een desktop zonder wifi/bluetooth-kaart. Acceptabel: een laptop waarvan de draadloze netwerkkaart fysiek is verwijderd of is uitgeschakeld in de firmware. "Vliegtuigmodus" is geen air-gap.
- **Een bekabelde netwerkkaart (NIC) die u losgekoppeld kunt laten.** De afwezigheid van de kabel is de meest controleerbare netwerkbeveiliging die er is.
- **Twee toegewijde USB-schijven** (gelabeld IN en OUT — zie §3) en, idealiter, een machine waarvan u de overige poorten in de firmware uitschakelt.
- **Volledige schijfversleuteling** (LUKS op Linux) zodat een gestolen node onbruikbaar is, en een UPS als uw stroomvoorziening onbetrouwbaar is — een evaluatie die halverwege de batterij wordt onderbroken is herstelbaar, maar waarom zou u het risico nemen.

## 2. Software-installatie (eenmalig, ~een uur)

1. Installeer een actuele Linux LTS (Ubuntu/Debian) vanaf een USB-installatiemedium **terwijl
   de netwerkkabel is losgekoppeld**; schakel volledige schijfversleuteling in tijdens de installatie.
2. Bouw de offline bundel op een afzonderlijke, online machine waarop de harness is geïnstalleerd
   (`python3 -m pip install mt-eval-harness`, 0.2.0 of nieuwer).
   `mt-eval node bundle --out <dir>` doet vier dingen:
   - bouwt wheels van de geïnstalleerde harness en diens afhankelijkheden (of een specifieke wheel,
     met `--wheel <file>`);
   - haalt de cryptografiebibliotheken op aan de hand van de hash-pinned lijst die
     in de harness wordt meegeleverd;
   - kopieert eventuele `--include`-artefacten;
   - schrijft een sha256-manifest over elk bestand.

   Voeg de **taalkaarten** toe voor elke taal die de node zal scoren
   (`--include <cards-dir>`): de node ontleent het taalpaar van een run aan een
   lokale kaartenindex en haalt er nooit een over het netwerk op. Geen van beide geïnstalleerde pakketten levert
   een kaartenmap per taal mee, dus schrijf deze hier met de `champollion`-CLI,
   één `<code>.json` per taal (`champollion network card eng --json >
   node-cards/eng.json`, en doe daarna hetzelfde voor uw andere taal), en geef
   `--include node-cards` mee. Op de node bevindt deze zich op
   `<dir>/artifacts/node-cards`; verwijs `cards_dir` daarnaartoe. Alles wat de node nodig heeft, gaat
   eenmalig over via de IN-schijf. Bouw op dezelfde Python-versie als die waarop de node draait
   (3.11 of 3.12); de lijst met vastgezette hashes weigert elke andere versie.
3. Breng de bundel over via de IN-schijf; verifieer de sha256 van elk artefact
   tegen het manifest **op de node** alvorens te installeren
   (`mt-eval node bundle --verify <dir>`). Installeer vervolgens uitsluitend
   vanaf de meegeleverde wheels:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   De `[node]`-extra is de `cryptography`-bibliotheek die `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness`-installatie
   ontbeert.
4. Maak het ondertekeningssleutelpaar van de node aan (`mt-eval node keygen`) en leg
   het publieke deel ervan vast — u publiceert dit zodat iedereen uw
   scoremanifesten kan verifiëren (§5).
   De node heeft ook **Docker** (of Podman) nodig, waarmee elke ingezonden
   methode wordt uitgevoerd in een container zonder netwerk; als geen van beide op de `PATH` staat,
   weigert `mt-eval node run-method` in één regel waarin beide worden genoemd, en blijft
   het verzoek uitvoerbaar. Er is ook een node-configuratie nodig op
   `~/.mt-eval/node.json`. Dat bestand benoemt de node, de bijbehorende kaartenmap
   (`cards_dir` of `MT_EVAL_CARDS_DIR`) en de competities die deze bedient.
   `mt-eval node init` schrijft een beginconfiguratie met elke sleutel die een scoring-node
   uitleest, inclusief de publieke kwalificatiegate (`qualifier` + `dev_corpus`,
   waartegen de node elke methode opnieuw uitvoert voordat deze een verzegelde set opent)
   en de slots van de verzegelde holdout (`holdout_set_id` + `holdout_corpus`;
   verwijder deze voor een competitie zonder holdout).
   `mt-eval node init --from-contest <out>` vult de waarden van de competitie in vanuit
   het manifest dat `contest prepare` heeft geschreven (de toewijzing staat in de
   [handleiding voor soevereine competities](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Het `sandbox`-blok is het resourcebeleid van de node (4 GB RAM, 4 GB scratch,
   30 minuten per run, geen GPU), en `contest submit-method` declareert standaard
   exact deze waarden; publiceer uw limieten dus bij de competitie als u
   deze wijzigt.
   Een node-configuratie die slechts de helft van die gate declareert, wordt bij het opstarten geweigerd.
   `mt-eval node ledger verify` controleert het ingevulde bestand: het weigert de
   eerste achtergebleven `<...>`-waarde of een gedeclareerd bestand dat zich niet op de node bevindt,
   toont wat er is gecontroleerd en speelt vervolgens de hash-keten van het lokale grootboek opnieuw af. De
   verbonden machine die verzoeken doorstuurt naar de node heeft ook de
   **service-role key** van de database nodig (`MT_EVAL_SUPABASE_SERVICE_KEY`). Die sleutel
   is nooit nodig op de air-gapped node zelf.
5. Vanaf dat moment maakt de machine nooit verbinding met een netwerk — en er kan worden geëist
   dat een verzegelde run dit eerst aantoont: `mt-eval node egress-check` (ook automatisch
   afgedwongen met `assert_airgap` in de node-configuratie) weigert wanneer een
   route, een probe of DNS enige uitweg aantoont. OS-updates zijn een doelbewuste,
   gebundelde, via hashes geverifieerde gebeurtenis — geen achtergronddienst.

## 3. Overdrachtsdiscipline (elke wedstrijd, beide richtingen)

De air-gap is een *procedure*, geen product. De procedure:

- **IN-schijf** bevat: ingezonden methode- of modelbundels en hun
  manifest. Voordat er iets wordt uitgevoerd, verifieert de node de hash van elk
  pakket tegen het manifest en wordt de importscan uitgevoerd (deze weigert methoden
  die netwerkbibliotheken importeren — dit is vandaag al beschikbaar).
- **OUT-schijf** bevat: het ondertekende scoremanifest — geaggregeerde scores, de
  methode-/configuratie-hashes waarbij ze horen, de kop van het auditlogboek — en *niets
  anders*. Uitvoer per segment blijft op de node onder controle van de
  organizer; het publiceren daarvan is een afzonderlijke, weloverwogen beslissing van de gemeenschap.
- Slechts één richting per schijf, altijd. Een schijf die in aanraking is geweest met de node wordt
  nooit automatisch gekoppeld op een online machine — koppel deze aan met `noexec,nodev` en kopieer het
  manifest handmatig.
- `mt-eval node manifest write <drive> --direction in|out` hasht elk
  bestand op de schijf vóór een overdracht; `mt-eval node manifest verify`
  aan de ontvangende zijde weigert alles wat is toegevoegd, gewijzigd of ontbreekt.
- Leg elke overdracht (datum, schijf, manifesthash) vast in het papieren logboek of
  het logboek op de node. Saai is precies de bedoeling: het logboek is wat u in staat stelt om de vraag "heeft er
  ooit iets anders de node verlaten?" met bewijs te beantwoorden.

## 4. Sleutelbeheer (M-van-N, in handen van de gemeenschap)

De verzegelde testset is in rust versleuteld; ontsleuteling vereist een quorum van
sleutelaandelen die in het bezit zijn van custodians die **de gemeenschap kiest** — een raad van
Ouderen, een taalautoriteit, een onderwijsinstantie. Het ontwerp geeft het
platform nul aandelen, zodat Champollion een verzegelde set niet kan ontsleutelen, en
geen enkele individuele custodian dat alleen kan. De onderstaande ceremonie is nog niet
uitgevoerd met echte custodians.

De ceremonie (één offline zitting; de meegeleverde tooling automatiseert dit):
`mt-eval node ceremony init` genereert de setsleutel op de node, splitst deze
in N aandelen (elke M reconstrueren; minder onthullen niets — de verdeling is
informatietheoretisch), en wist de sleutel in dezelfde adem; `ceremony
share` geeft het aandeel van elke beheerder uit als een bestand voor een token plus een
afdrukbare papieren back-up; `ceremony verify` bewijst dat de gedistribueerde kopieën
reconstrueren — zonder iets op te slaan; `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` versleutelt het corpus naar de publieke sleutel van de ceremonie: de node slaat
cijfertekst en een inhoudsvrije metadatakaart op, niets anders. Vanaf dat moment betekent het
uitvoeren van een evaluatie dat beheerders fysiek M van N aandelen presenteren
(`node run-method --offline --share …`): de sleutel wordt **uitsluitend in het
vergrendelde geheugen van de uitvoerder** opnieuw opgebouwd, gebruikt voor die ene aan een toekenning gebonden uitvoering,
en gewist — hij raakt nooit meer de schijf. Elk verzoek, elke stem, toekenning en elk gebruik
wordt toegevoegd aan een lokaal grootboek met hash-keten (`node ledger verify`), en een
poging zonder quorum wordt geweigerd *en* geregistreerd.

Eén eerlijke zin over het mechanisme: dit is Shamir secret sharing
met reconstructie in het geheugen van de offline machine die in handen is van de gemeenschap —
geen multi-party computation. Tijdens een geautoriseerde uitvoering bestaat de sleutel kortstondig,
in samengestelde vorm, op hardware die de gemeenschap fysiek beheert; de
eigenschappen die het verdedigt zijn *geen permanente sleutel op de schijf*, *geen uitvoering zonder
aanwezigheid van een quorum*, en *elk gebruik gekoppeld in het inspecteerbare grootboek*.
Drempel-ondertekening aan de platformzijde, waarbij de sleutel nergens wordt samengesteld,
blijft toekomstig werk en wordt als zodanig gemarkeerd waar het ook wordt vermeld.

Bij rotatie en vervanging van beheerders wordt de ceremonie opnieuw uitgevoerd; verlies van meer dan
N−M aandelen betekent dat de set opnieuw wordt verzegeld vanuit de bronkopie van de gemeenschap —
de gemeenschap behoudt altijd haar eigen origineel in platte tekst, omdat
[bezit](/docs/network/sovereignty/data-sovereignty) nooit aan ons was om te behouden.

## 5. Wat "geattesteerd" hier betekent — en wat niet

Elke evaluatie produceert een **ondertekend scoremanifest**: de handtekening van de node
over de scores, de hashes van het methodepakket, de checksum van het corpus en de
kop van het append-only auditlogboek. Iedereen die in het bezit is van de gepubliceerde
publieke sleutel van de node kan verifiëren — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` — dat *deze node* *deze scores* heeft geproduceerd
voor *exact deze invoer*, en het logboek met hash-keten maakt stille bewerkingen in de geschiedenis detecteerbaar.

Dat is **software-attestatie** — het bewijst de integriteit van de registratie, en
het is wat v1 biedt. Het bewijst **niet** welk silicium de uitvoering heeft verwerkt:
hardware remote attestation (TEE's) is toekomstig werk en wordt opzettelijk
niet geclaimd. De eerlijke beveiligingsverklaring voor v1: de discipline van de organisator
(§3) plus ondertekende manifesten plus het fysieke beheer van de machine door de gemeenschap
vormen het vertrouwensanker — wat precies is waar een sovereignty-first
ontwerp het vertrouwen sowieso wil hebben.

## 6. De operationele cyclus

1. Kondig de competitie aan; publiceer de publieke sleutel van de node + de drempelwaarde voor de dev-set.
2. Ontvang online inzendingen (op een gewone machine), stel het IN-manifest samen
   (`mt-eval node manifest write <drive> --direction in`).
3. Breng de IN-schijf naar de node; verifieer de hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   het voorstel komt binnen met de status *pending*. De node controleert dit eerst (`node run-method
   <id> --offline` voert de kwalificatie van de inzender opnieuw uit op de publieke dev-set
   en controleert een container-runtime voor een code-inzending, opent niets wat verzegeld is en
   legt een goedkeuring vast in het lokale grootboek). Vervolgens legt een custodian het besluit
   vast op de node (`node approve <id> --offline --actor <custodian>`, geweigerd
   totdat die controle is geslaagd, of `node deny … --offline --reason …`: een stem
   + autorisatie in het lokale grootboek en een met de node-sleutel ondertekend record;
   `node list --offline` toont wat er in afwachting staat). De verzegelde run (opnieuw `node run-method
   --offline`) weigert een voorstel met de status pending totdat die goedkeuring is
   vastgelegd en geverifieerd kan worden.
4. Custodians autoriseren de run door een quorum van aandelen te presenteren (§4 —
   `node run-method <id> --offline --share … --share …`); de verzegelde set
   wordt uitsluitend binnen de executor ontsleuteld. Geen quorum, geen run — en de poging
   wordt vastgelegd in het grootboek.
5. Uitvoeren; scores worden berekend; uitvoer per segment blijft bewaard aan de node-zijde.
6. Teardown: werkende platte tekst gewist; auditlogboek aangevuld; manifest ondertekend.
7. Breng de OUT-schijf terug; publiceer scores + manifest; iedereen kan verifiëren
   (`node verify-manifest`).
8. Log de overdracht; schijven blijven specifiek toegewezen; de node blijft dark.
