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

:::info[Wat vandaag wordt geleverd vs. wat als in ontwikkeling is gemarkeerd]
De software voor de organisator-node (voorbereiding van de wedstrijd, aanname van hypothesen, drempelgestuurde scoreberekening, de netwerkgeïsoleerde methode-uitvoerder met zijn import scan) **ships today** in `mt-eval` — see the
[soevereine wedstrijdgids](/docs/network/sovereignty/run-a-sovereign-contest).
De **drempelsleutelceremonie (threshold key ceremony) en de sealed-at-rest workflow van §4 worden vandaag ook geleverd**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, quorum-aandelen die tijdens de uitvoering worden gepresenteerd
(`node run-method --offline --share …`), een lokaal autorisatiegrootboek met hash-keten (`node ledger verify|head`), ondertekende scoremanifesten
(`node sign-manifest` / `node verify-manifest`), en de §2–§3 air-gap
tooling (`node bundle`, `node manifest`, `node egress-check`). De
stand-in met een enkel sleutelpaar blijft alleen bestaan voor wedstrijden waarbij de organisator
de referenties volledig in handen heeft — elk oppervlak geeft aan welk traject in
gebruik is. Kort gezegd, wat v1 **niet** bevat: hardware remote
attestation (TEE) wordt niet geclaimd (§5), en drempel-*ondertekening* aan de platformzijde
(goedkeuringen via de telefoon van de beheerder tegen gehoste infrastructuur) is
toekomstig werk — op een soevereine node wordt het beheer uitgeoefend door fysiek
M van N aandelen bij de machine te presenteren (§4). En om precies te zijn over de
cryptografie: dit is Shamir M-van-N secret sharing waarbij de sleutel
**wordt gereconstrueerd in het vergrendelde geheugen van de node tijdens een geautoriseerde uitvoering**
(en daarna wordt gewist) — het is *geen* multi-party computation, en de sleutel
bestaat kortstondig in samengestelde vorm op uw offline machine. Tot slot, totdat de
toestemmingspoort van de gemeenschap opent, draait het traject **uitsluitend tegen synthetische
gegevens**; echte corpora wachten op die toestemming.
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

1. Installeer een actuele Linux LTS (Ubuntu/Debian) vanaf een USB-installatiemedium **met de netwerkkabel losgekoppeld**; schakel volledige schijfversleuteling in tijdens de installatie.
2. Bouw op een afzonderlijke, online machine de offline bundel —
   `mt-eval node bundle --out <dir>` wheels `mt-eval[node]` en de
   bijbehorende afhankelijkheden, kopieert eventuele `--include` artefacten, en schrijft een sha256-manifest
   over elk bestand. Alles wat de node nodig heeft, gaat eenmalig over via de IN-schijf.
3. Zet de bundel over op de IN-schijf; verifieer de sha256 van elk artefact
   tegen het manifest **op de node** voorafgaand aan de installatie
   (`mt-eval node bundle --verify <dir>`).
4. Maak het ondertekeningssleutelpaar van de node aan (`mt-eval node keygen`) en noteer
   de publieke helft ervan — u zult deze publiceren zodat iedereen uw scoremanifesten
   kan verifiëren (§5).
5. Vanaf dat moment ziet de machine nooit meer een netwerk — en er kan eerst een verzegelde uitvoering (sealed run)
   worden gedaan om dit te bewijzen: `mt-eval node egress-check` (ook automatisch afgedwongen
   met `assert_airgap` in de node-configuratie) weigert wanneer een
   route, een probe of DNS enige uitweg toont. OS-updates zijn een bewuste,
   gebundelde, hash-geverifieerde gebeurtenis — geen achtergrondservice.

## 3. Overdrachtsdiscipline (elke wedstrijd, beide richtingen)

De air-gap is een *procedure*, geen product. De procedure:

- **IN-schijf** bevat: ingediende methodepakketten, hypothesebestanden en
  hun manifest. Voordat er iets wordt uitgevoerd, verifieert de node de hash van elk pakket
  tegen het manifest en wordt de importscan uitgevoerd (deze weigert methoden
  die netwerkbibliotheken importeren — dit wordt vandaag geleverd).
- **OUT-schijf** bevat: het ondertekende scoremanifest — geaggregeerde scores, de
  methode/configuratie-hashes waartoe ze behoren, de kop van het auditlogboek — en *niets
  anders*. Uitvoer per segment blijft op de node onder controle van de organisator;
  het publiceren hiervan is een afzonderlijke, weloverwogen beslissing van de gemeenschap.
- Eén richting per schijf, altijd. Een schijf die de node heeft aangeraakt, wordt nooit
  automatisch gekoppeld (auto-mount) op een online machine — koppel deze `noexec,nodev` en kopieer
  het manifest er handmatig af.
- `mt-eval node manifest write <drive> --direction in|out` hasht elk
  bestand op de schijf vóór een overdracht; `mt-eval node manifest verify`
  aan de ontvangende kant weigert alles wat is toegevoegd, gewijzigd of ontbreekt.
- Registreer elke overdracht (datum, schijf, manifest-hash) in het papieren of
  on-node logboek van de node. Saai is juist de bedoeling: het logboek stelt u in staat om de vraag "is
  er ooit iets anders naar buiten gegaan?" met bewijs te beantwoorden.

## 4. Sleutelbeheer (M-van-N, in handen van de gemeenschap)

De verzegelde testset is in rust versleuteld; ontsleuteling vereist een quorum van
sleutelaandelen in het bezit van beheerders **die de gemeenschap kiest** — een raad van oudsten,
een taalautoriteit, een onderwijsinstantie. Het platform bezit nul
aandelen; Champollion kan een verzegelde set niet ontsleutelen, en geen enkele individuele
beheerder kan dat alleen.

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

1. Kondig de wedstrijd aan; publiceer de publieke sleutel van de node + de drempelwaarde van de dev-set.
2. Ontvang inzendingen online (gewone machine), stel het IN-manifest samen
   (`mt-eval node manifest write <drive> --direction in`).
3. Breng de IN-schijf naar de node; verifieer hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods.
4. Beheerders autoriseren de uitvoering door een quorum van aandelen te presenteren (§4 —
   `node run-method <id> --offline --share … --share …`); de verzegelde set
   wordt uitsluitend in de uitvoerder ontsleuteld. Geen quorum, geen uitvoering — en de poging
   staat in het grootboek.
5. Uitvoeren; scores berekend; uitvoer per segment behouden aan de kant van de node.
6. Afbouw: werkende platte tekst gewist; auditlogboek aangevuld; manifest ondertekend.
7. Breng de OUT-schijf terug; publiceer scores + manifest; iedereen kan verifiëren
   (`node verify-manifest`).
8. Registreer de overdracht; schijven blijven toegewijd; node blijft offline (dark).
