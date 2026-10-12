---
sidebar_position: 1
title: "Inzendingsregels"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# MT-evaluatie

> **Samenvatting.** Deze pagina definieert de indieningscriteria voor het leaderboard, de scorebepaling (chrF++ als hoofdmetriek, met daarnaast de standaardmetrieken en diagnostische gegevens), het anti-manipulatiebeleid, de verificatieniveaus en de indieningsworkflow. Methoden die zijn blootgesteld aan evaluatiedata worden gediskwalificeerd.

champollion bevat een raamwerk voor de evaluatie van machinale vertaling, ontworpen voor **reproduceerbare benchmarking** van vertaalmethoden — met name voor talen met weinig middelen en inheemse talen waarvoor standaard MT-benchmarks niet bestaan en kwaliteitsclaims moeilijk te verifiëren zijn.

---

## Het klassement

Het middelpunt is het **[Method Leaderboard](https://champollion.dev/leaderboard)** — een openbaar scorebord, live en **open voor inzendingen**, waar onderzoekers en communityleden vertaalmethoden kunnen indienen en vergelijken via van een vingerafdruk voorziene, reproduceerbare evaluaties.

Elke inzending bevat:

- **Pipeline met vingerafdruk** — gekoppeld aan een specifieke Git-commit en configuratiehash, zodat resultaten herleidbaar zijn naar de exacte code waarmee ze zijn gegenereerd
- **Geversioneerde dataset** — content-gehasht en geversioneerd; scores zijn alleen vergelijkbaar binnen dezelfde datasetversie
- **Gestandaardiseerde metrieken** — alle scores worden berekend door het gedeelde evaluatiekader (evaluation harness), waardoor implementatieverschillen worden uitgesloten
- **Vertrouwensniveaus** — zelf-gebenchmarkt (self-benchmarked), Champollion Verified of Community Validated
- **Kostenregistratie** — API-kosten per inzending, zodat afwegingen tussen kosten en kwaliteit transparant zijn

Het leaderboard rangschikt runs op dezelfde manier als waarop WMT, FLORES-200 en de AmericasNLP shared tasks MT-evaluaties rapporteren: op basis van **één standaardmetriek, chrF++**, weergegeven met het bijbehorende 95%-betrouwbaarheidsinterval en de sacreBLEU-handtekening — bijvoorbeeld `chrF++ 47.5 [45.9, 49.0]`. Alle overige gegevens worden daarnaast getoond en er nooit mee vermengd:

| Metriek | Rol | Wat het meet |
|--------|------|------------------|
| **chrF++** | **Hoofd- en rangschikkingsmetriek** | Teken-n-gram F-score ten opzichte van de referentie (sacreBLEU, `word_order=2`). Kan beter omgaan met rijke morfologie dan metrieken op woordniveau |
| **BLEU, spBLEU, TER, COMET** | Standaardmetrieken, naast de hoofdmetriek | De overige metrieken die in MT-papers worden gerapporteerd; COMET indien berekend, inclusief het model-ID |
| **Exact Match** | Diagnostisch | Hoe vaak de vertaling exact overeenkomt met de referentie |
| **FST Acceptance** | Diagnostisch | Voor talen met een finite-state transducer: welk aandeel van de gegenereerde woorden geldige vormen zijn. Vergelijkt niet met de bron of referentie en is daarom nooit een score |
| **Equivalent Match** | Diagnostisch | Fractie die overeenkomt met de referentie of een acceptabele variant (woordvolgorde, spellingsconventie). Momenteel CRK; wordt gegeneraliseerd. |
| **Semantic Score** | Diagnostisch | Behoud van betekenis, getoetst door een deterministische validator. Momenteel CRK; wordt gegeneraliseerd. |
| **Voorbehouden bij scores** | Weergegeven naast de hoofdmetriek | Wanneer de uitvoer de brontekst kopieert, veel korter of langer is dan de referenties, dezelfde uitvoer herhaalt voor meerdere invoeren, of wanneer testrijen dubbelgangers hebben in de trainingsdata |

Of de ene run beter is dan de andere, wordt bepaald door een gepaarde significantietoets op chrF++, niet door de volgorde van twee getallen — overlappende intervallen zijn een waarschuwing dat het verschil op toeval kan berusten ([Statistische significantietoetsing](/docs/network/specifications/significance)); ranglijsten van wedstrijden gebruiken de toets om rangclusters te vormen. chrF++ rangschikt systemen uitsluitend binnen dezelfde dataset, nooit over talen heen. Geen enkele automatische score draagt een kwaliteitslabel — alleen menselijke beoordeling door sprekers certificeert kwaliteit. De gewogen samengestelde score en de kwaliteitsniveaus die voorheen werden gebruikt, zijn uitgefaseerd; de samengestelde score van een oude kaart wordt, indien al getoond, aangeduid als "legacy composite (retired)".

:::info[Volledige metriekenset]
De [Scorespecificatie](/docs/network/specifications/scoring#how-runs-are-scored) definieert hoe runs worden gescoord en bevat de volledige inventaris van metrieken (zes categorieën: oppervlakkig, structureel, semantisch, gedragsmatig, naleving en gerapporteerde vergelijkingsmetrieken).
:::

**[→ Bekijk het klassement](https://champollion.dev/leaderboard)**

---

## Beschikbare datasets

Waarop een run kan worden beoordeeld, wordt aangegeven door de tools; deze pagina houdt daarom zelf geen lijst bij:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

De pagina [Evaluatiedatasets](/docs/network/leaderboard/datasets) beschrijft
de catalogus, het corpusformaat, de moeilijkheidsniveaus, de licentietrajecten
en hoe u uw eigen dataset aanmaakt. Drie regels uit die catalogus bepalen wat kan
worden opgenomen in de rangschikking:

- **Een corpus in quarantaine wordt nooit gerangschikt.** Het is gecatalogiseerd maar nooit uitvoerbaar,
  en de database weigert scores die hiertegen worden ingediend. De
  Engels→Plains Cree-corpora van EdTeKLA (`eval-eng-crk-edtekla-dev-v1` en
  `eval-eng-crk-edtekla-textbook`) staan in quarantaine. Ze bevatten een aangepaste,
  op soevereiniteit afgestemde CC BY-NC-SA
  (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) en zijn uitgesloten van elk
  leaderboard, prijstraject en commercieel traject.
- **Een gecontamineerd corpus rangschikt uitsluitend relatief.** FLORES+, en elk corpus
  met de kwalificatie `HIGH` of `MEDIUM` voor contaminatie of zonder kwalificatie, krijgt
  op de runkaart het stempel uitsluitend-relatieve-vergelijking (relative-comparison-only). Het vergelijkt methoden die
  op dat corpus zijn uitgevoerd en wordt nooit gerapporteerd als absolute kwaliteit. Alleen een corpus
  met de kwalificatie `LOW` wordt gerangschikt op absolute kwaliteit.
- **Licentietrajecten blijven gehandhaafd.** Een niet-commercieel corpus blijft buiten commerciële en
  prijstrajecten. Een corpus onder een gewijzigde, op maat gemaakte of niet nader gespecificeerde licentie weigert
  evaluaties via externe model-API's totdat de toestemming van de rechthebbende is
  vastgelegd op het bijbehorende item.

**Wedstrijden worden uitgevoerd op afgeschermde sets die de beheerder bewaart.** Een wedstrijd wordt op
geen van deze openbare corpora gescoord. De host (een community of organisatie) beheert
een verzegelde, achtergehouden testset op de eigen infrastructuur. Deelnemers kwalificeren zich op
de openbare dev-set die de host vrijgeeft, en dragen vervolgens een model of
methode over aan de node van de host om uit te voeren. De beheerders van de host autoriseren elke run, en er
komen uitsluitend scores naar buiten. Zie [Een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[GEBRUIK evaluatiedata NIET voor training]

**Deze datasets zijn uitsluitend bedoeld voor evaluatie.** Methoden die zijn getraind, fijnafgesteld, few-shot-geprompt of anderszins blootgesteld aan evaluatiedata produceren kunstmatig opgeblazen scores en worden **gediskwalificeerd van het klassement.**

Dit is geen aanbeveling — het is de belangrijkste regel voor de integriteit van de evaluatie. Gebruik afzonderlijke corpora voor training. Evaluatiesets mogen tijdens de ontwikkeling niet door uw model zijn gezien.

Als u coachingdata of few-shot-voorbeelden gebruikt, moeten deze afkomstig zijn uit **volledig afzonderlijke bronnen**. Twijfelt u? Neem het dan niet op.
:::

:::warning[Niet-determinisme van LLM's]

LLM-uitvoer is niet-deterministisch. Scores vertegenwoordigen metingen op een bepaald moment onder specifieke modelversies en API-configuraties. Modelaanbieders kunnen op elk moment gewichten, decoderingsstrategieën of veiligheidsfilters bijwerken, wat scoreverschuivingen tussen runs kan veroorzaken. Het klassement registreert de exacte model-slug en tijdstempel voor elke inzending.
:::

---

## Wat een goede methode kenmerkt

Niet alle methoden zijn gelijkwaardig. Dit is wat rigoureus werk onderscheidt van opgeblazen scores.

### Kenmerken van een sterke methode

- **Strikte scheiding van trainings- en evaluatiedata** — uw methode heeft de evaluatieset nooit gezien tijdens ontwikkeling, afstemming, prompt-engineering of selectie van few-shot-voorbeelden
- **Reproduceerbaar** — iemand anders kan uw repository klonen, het raamwerk uitvoeren en dezelfde scores behalen (binnen de grenzen van LLM-niet-determinisme)
- **Gedocumenteerd** — uw [methodekaart](/docs/network/specifications/methods) beschrijft wat uw methode doet, welke hulpmiddelen zij gebruikt en wat haar beperkingen zijn
- **Eerlijk over reikwijdte** — als uw methode alleen werkt voor één taalpaar, vermeld dat dan; als zij verslechtert bij bepaalde morfologische patronen, documenteer dat dan
- **Gemeenschapsbewust** — voor inheemse talen respecteert uw methode de datasouvereiniteit. U heeft overleg gepleegd met taalgemeenschappen of uitsluitend openlijk gelicentieerde data gebruikt

### Waarschuwingssignalen (wat wordt gediskwalificeerd)

| Waarschuwingssignaal | Waarom het een probleem is |
|----------|--------------------|
| Trainen op evaluatiedata | Ondermijnt het doel van evaluatie volledig. Opgeblazen scores misleiden iedereen. |
| Resultaten selectief kiezen | 10 keer uitvoeren en de beste run indienen zonder de andere te vermelden |
| Niet-gedocumenteerde naverwerking | Uitvoer handmatig corrigeren vóór scoring |
| Gecontamineerde coachingdata | Evaluatiesetvoorbeelden gebruiken als few-shot-prompts of woordenboekitems |
| Commerciële gereedheid claimen zonder herkomst | Als uw methode CC BY-NC-SA-data gebruikt, is zij niet commercieel gereed |

### Verificatieniveaus

Verificatieniveaus beschrijven **wie het resultaat heeft gevalideerd**. Het zijn geen kwaliteitslabels (de oude automatische kwaliteitsniveaus zijn [uitgefaseerd](/docs/network/specifications/scoring#5-quality-tiers)).

| Niveau | Betekenis | Hoe u dit verkrijgt |
|------|---------|--------------|
| **Self-benchmarked** | U hebt het testkader zelf uitgevoerd en de resultaten ingediend | Publiceer uw runkaart met `mt-eval publish` |
| **Champollion Verified** | Het project heeft uw ingediende uitvoer onafhankelijk opnieuw gescoord op basis van het sha-gepinde referentiecorpus en uw score gereproduceerd | De re-scorer is een tool voor beheerders die handmatig in batches wordt uitgevoerd. Er is geen automatische planning, dus geen enkele inzending wordt direct bij binnenkomst opnieuw gescoord (zie hieronder) |
| **Community Validated** | Tweetalige sprekers van de doeltaal, gekwalificeerd volgens het eigen protocol van de community, hebben een gestratificeerde steekproef van de uitvoer beoordeeld (≥30 items, ≥2 beoordelaars) en ≥70% voldeed aan de norm van de community. Wordt uitsluitend toegekend via tests van de community zelf; degradatie door steekproefsgewijze controles verloopt symmetrisch | Dien de methodecode in bij de governance-organisatie — zij voeren deze uit op de goudstandaard-set en leggen de uitvoer voor aan de community ter beoordeling |

**Door de community gevalideerde beoordeling is een apart traject, en er bestaan momenteel nog geen scores van menselijke evaluatie:** het testkader kan selecteren welke systemen binnen een vast budget voor menselijke beoordeling vallen vanuit de bevroren rangschikking van een gesloten wedstrijd (uitsluitend volledige groepen met gelijke stand — een cluster wordt nooit doormidden gesplitst), maar registreert geen waarderingen, en op dit moment bevat niets op het leaderboard een menselijk oordeel.

**Posities zijn clusters, geen strikte volgorde.** Aangrenzende inzendingen die de significantietoets niet kan scheiden, delen een positie en krijgen een *bereik* toegekend; in een afgeschermde wedstrijd, waar de uitvoer per segment de machine van de organisator nooit verlaat, draait de gepaarde toets op die machine en komen alleen de ondertekende oordelen naar buiten; zonder deze oordelen steunen gelijke standen op bewijs uit betrouwbaarheidsintervallen of puntgelijkheid. Hoe dat werkt, en hoe zwak elke trede van de bewijsladder is, staat beschreven in [Statistische significantietoetsing → Rangschikkingsclusters](/docs/network/specifications/significance#ranking-clusters).

### Hoe verificatie schaalt: op reputatie gewogen audits

**Wij claimen geen herkomst.** Een rij op het leaderboard wordt geproduceerd door een bijdrager
die het *open-source* testkader op de *eigen* machine uitvoert. "Deze run is daadwerkelijk afkomstig
van het testkader" is niet iets wat een server kan verifiëren voor zelf-gehoste
rekenkracht — de ondertekeningssleutel van het testkader is immers in handen van de bijdrager, waardoor een
handtekening een *machine authenticeert, geen eerlijkheid*. In plaats van anders voor te spiegelen,
**is geldigheid hier verdiend en zelfcorrigerend**: een rij is betrouwbaar
omdat de score **reproduceerbaar** is en omdat de bijdrager erachter
**een reputatie op het spel heeft gezet die bij betrapte fabricage vernietigd zou worden.** Verificatie
wordt uitgevoerd in vier lagen, zodat deze grondig is waar nodig en goedkoop waar mogelijk
— het project hoeft nooit ieders werk opnieuw uit te voeren.

- **L0 — alles opnieuw scoren (gratis, ~100%).** De re-scorer leidt uw
  score opnieuw af uit *uw eigen ingediende uitvoer* ten opzichte van het **sha-gepinde referentiecorpus**
  (niet uw opgeslagen kopie ervan), met dezelfde metriek die het testkader gebruikt.
  Als de score niet reproduceerbaar is op basis van de uitvoer, of als een opgeslagen referentie is
  aangepast, wordt de run **gediskwalificeerd** — dit alleen al voorkomt handmatig ingevoerde of bewerkte
  scores. Een run die reproduceert, wordt gepromoveerd naar **Champollion Verified** — het
  niveau dat een wedstrijdranglijst standaard gebruikt en het enige niveau dat in aanmerking komt voor een
  prijs. Dit is geïmplementeerd en goedkoop, maar het is een **beheerderscommando dat handmatig
  wordt uitgevoerd**: niets voert dit automatisch uit bij indiening, en niets plant dit in. Totdat dit
  verandert, arriveert — en blijft — elke rij self-benchmarked.
- **L1 — een reputatieladder voor bijdragers.** Elke bijdrager (geïdentificeerd aan de hand van diens
  inloggegevens) bouwt *uitsluitend* reputatie op door de diepere controles hieronder te doorstaan — nooit
  op basis van volume alleen, dus het aanmaken van nieuwe identiteiten levert niets op. Reputatie is
  **openbaar** en bepaalt hoe vaak de kostbare controle wordt uitgevoerd.
- **L2 — een *steekproef* opnieuw uitvoeren (de kostbare controle; uitsluitend beleid, nog geen re-runner
  beschikbaar).** Bij een *openbare* ontwikkelingsset kan L0 een bijdrager niet betrappen die
  eenvoudigweg de referentie kopieert als diens "vertaling". Om dat te ontdekken moet
  het model daadwerkelijk opnieuw worden uitgevoerd — reële rekenkracht — dus zouden we dat doen op basis van een
  **steekproef**, niet bij iedereen. Het **steekproefbeleid** is gebouwd en getest: een
  run wordt geselecteerd met een waarschijnlijkheid die toeneemt naarmate de **belangen** groter zijn (een run die
  de eerste brug slaat naar een hele taalfamilie wordt *altijd* geselecteerd),
  toeneemt bij een **anomalie** (een sprong ten opzichte van de vorige beste die te mooi is om waar te zijn, wordt
  *altijd* geselecteerd), en afneemt met de **reputatie** (een bijdrager die
  vele audits heeft doorstaan, wordt zelden steekproefsgewijs gecontroleerd; een nieuwkomer of anonieme indiener
  wordt bij elke run gecontroleerd totdat vertrouwen is opgebouwd). Het doorstaan van een L2-audit
  verhoogt de reputatie. **De re-runner die dit beleid zou aansturen bestaat nog niet**,
  waardoor er nog nooit een L2-audit is uitgevoerd: een geselecteerde run wordt geregistreerd als *L2-pending*.
- **L3 — corroboratie (gratis verificatie).** Wanneer twee *onafhankelijke* bijdragers
  hetzelfde model op hetzelfde corpus uitvoeren en hun opnieuw gescoorde uitvoer **overeenkomt**,
  geldt die overeenstemming *als* verificatie — en verhoogt dit de reputatie van beiden. Een
  werkelijke **discrepantie** markeert beide runs voor een L2-audit. Replicatie wordt
  beloond in plaats van als overbodig beschouwd.

**Eén betrapte fabricage is catastrofaal — vergelijkbaar met een intrekking (retraction).** Een bewezen
fabricage zet de reputatie van de bijdrager op nul, **onderwerpt diens volledige
geverifieerde geschiedenis opnieuw aan een audit** (elk van diens geverifieerde runs moet opnieuw door
de verificatie), en wordt **openbaar** geregistreerd in het auditlogboek. Dat is wat
een lichte steekproef veilig maakt: frauderen met een openbare dev-set glipt er bij één run wellicht doorheen, maar
de verwachte kosten — al het opgebouwde vertrouwen verliezen en uw gehele geschiedenis
opnieuw laten doorlichten — maken het een slechte gok. Deze regels gelden symmetrisch
voor de eigen runs van de beheerders.

**Waarom bijdragen nog steeds de moeite waard is.** U betaalt altijd het kostbare deel
(het uitvoeren van uw methode); het project betaalt slechts de gratis L0-herscoring voor iedereen
plus een L2-heruitvoering op een *krimpende steekproef* — hoog voor nieuwkomers en runs met
hoge belangen, laag voor bewezen bijdragers. De verificatiekosten worden *geamortiseerd door reputatie
en gedeeld door corroboratie*, en hoeven niet telkens volledig opnieuw te worden betaald.

---

## Hoe in te dienen

1. **Bouw uw methode** — zie [Een methode bouwen](/docs/network/specifications/methods) voor de methode-interface
2. **Voer het testkader uit** — zie [Eval-harness](/docs/network/specifications/harness) voor configuratie en gebruik
3. **Genereer een runkaart** — het testkader produceert een JSON-runkaart met uw scores, vingerafdruk en metagegevens
4. **Publiceer** — `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` uploadt de runkaart naar het leaderboard (bekijk een voorbeeld met `--dry-run`)
5. **Verschijn op het leaderboard** — uw run wordt vermeld als *self-benchmarked (unverified)*. Het [Method Leaderboard](https://champollion.dev/leaderboard) toont en rangschikt elke rij die niet `disqualified` is, inclusief runs met het label self-benchmarked; filter op *Champollion Verified* om uitsluitend opnieuw gescoorde resultaten te zien. De L0-herscoring die een run naar dat niveau promoveert, is een batchopdracht van beheerders die niet automatisch wordt ingepland; daarom is op dit moment elke rij op het bord een zelf-gerapporteerde claim. Uitsluitend geverifieerd is de standaard voor een rangschikking binnen een **wedstrijd**, en dit is het enige niveau dat in aanmerking komt voor een prijs

---

## Integriteitsbeleid: intrekkingen, heruitvoeringen, schrappingen, geschillen

Vooraf opgesteld zodat handhaving een procedure is en geen drama. Deze regels
gelden symmetrisch voor iedereen — inclusief de eigen runs van de beheerders.

**Geen intrekkingen.** Een gepubliceerde run is een permanent gegeven. Er bestaat
voor niemand een mechanisme om een score te verwijderen omdat deze gênant is.
Elke run-rij bevat een door de server vastgelegde `submitted_at`-tijdstempel en een
onveranderlijk audittrail; moderatieacties zelf worden eveneens gelogd.

**Heruitvoeringen worden toegevoegd, nooit vervangen.** Als u uw methode verbetert, publiceert u een nieuwe
run. De oude run blijft behouden. Selectieve openbaarmaking — privé vele varianten
testen en alleen de winnaar publiceren — maakte andere leaderboards
gevoelig voor manipulatie; een register waaraan alleen gegevens kunnen worden toegevoegd (append-only) is het structurele antwoord. Deduplicatie
op basis van vingerafdrukken stopt spam van byte-identieke herinzendingen; de geschiedenis wordt nooit herschreven.

**Schrapping is de uitvoering van een regel, waarbij de regel expliciet wordt benoemd.** Een run wordt alleen geschrapt
(zichtbaar gemarkeerd als `disqualified` — niet geruisloos verwijderd) op basis van genoemde
redenen: een dataset die in quarantaine staat of een ongeldige deelverzameling is (afgedwongen door een databasetrigger
onder elke client), een niet-overeenkomende corpus-checksum, gefabriceerde of
buiten het bereik vallende scores, schendingen van content-guards, of de intrekking van de
registratie van de onderliggende data door een beheerder. Bij de schrapping worden de regel en het
bewijs vermeld. Nieuwe redenen worden hier toegevoegd via een gedateerde bewerking voordat ze ooit
worden toegepast; ze worden nooit met terugwerkende kracht voor een enkel geval bedacht.

### Een resultaat markeren

*Toegevoegd op 2026-09-07.*

:::caution[Markeringen worden nog niet geaccepteerd]

Het meldingssysteem is gebouwd en de database is er per 2026-09-07 klaar voor — maar het
formulier waarmee een melding wordt ingediend, is nog niet opnieuw geïmplementeerd met deze ondersteuning, waardoor *Flag this
result* nog niet kan worden verzonden. Het mislukt liever dan dat het een melding geruisloos accepteert.
Stuur in de tussentijd een e-mail naar `info@champollion.dev`. Deze mededeling verdwijnt zodra
het formulier beschikbaar is.

:::

**Iedereen kan een resultaat markeren.** Vouw de bijbehorende rij op het leaderboard uit en gebruik *Flag
this result*: dit opent een berichtenformulier dat al is gekoppeld aan de ID van die run, waarin u aangeeft wat er volgens u niet klopt en hoe u dat weet — een gecontamineerd corpus, een
metriek die niet overeenkomt met het label, een onjuist toegeschreven methode, of iets anders. Een
melding moet een reden bevatten. Een melding zonder reden is een downvote, en dit scorebord kent
geen downvotes.

**Een melding is een privébericht, geen stem.** Het bereikt de beheerders als een
ticket en gaat nergens anders heen. Er wordt nooit een aantal meldingen weergegeven — niet op de
rij, niet op de runkaart, nergens — omdat een zichtbare telling op zichzelf al
gemanipuleerd zou kunnen worden, en de status van een resultaat moet berusten op bewijs in plaats van op
het aantal mensen dat bezwaar heeft gemaakt. Het indienen van een melding verandert op zichzelf niets aan de
rij.

**Een gegrond verklaarde melding is op precies één manier zichtbaar:** het resultaat wordt gemarkeerd
als `disqualified`, om een reden die al op deze pagina wordt genoemd. Net als bij elke andere
schrapping wordt een nieuwe reden hier toegevoegd **via een gedateerde bewerking voordat deze op
wie dan ook wordt toegepast** — een melding kan dus nooit leiden tot een geheime regel of een regel met terugwerkende kracht. Wordt een
melding niet gegrond verklaard, dan blijft de rij ongewijzigd, en als u een adres hebt achtergelaten, ontvangt u in beide gevallen bericht.

**Vertrouwensniveaus zijn labels, geen aanpassingen.** `self-benchmarked`-rijen zijn beweringen;
`Champollion Verified`-rijen zijn onafhankelijk opnieuw gescoord op basis van de uitvoer van de
indiener ten opzichte van het sha-gepinde corpus; `Community Validated` wordt
uitsluitend toegekend door tests van de community zelf. Verificatie wijzigt het niveau
van een rij — het wijzigt nooit de scores van de rij.

**Reputatie is openbaar en zelfcorrigerend.** De reputatie van een bijdrager en het
auditlogboek waarin elke herscoring, steekproefsgewijze heruitvoering, corroboratie en
afstraffing wegens fabricage worden vastgelegd, zijn openbaar. Reputatie is geen scorevermenigvuldiger en heeft
nooit invloed op de getallen van een run — het bepaalt uitsluitend hoe vaak de runs van een bijdrager
opnieuw worden gecontroleerd (zie *op reputatie gewogen audits* hierboven). Een bewezen fabricage wordt
net zo openbaar vastgelegd als een intrekking en leidt tot een heraudit van de volledige
geverifieerde geschiedenis van de bijdrager; dezelfde regels zijn van toepassing op de eigen runs van de beheerders.

**Geschillen.** Open een issue met het run-ID en de specifieke claim (verkeerde
score, verkeerde dataset, onjuist toegepaste regel). De beheerders voeren de
deterministische controles openbaar opnieuw uit; de uitkomst en het bijbehorende bewijs worden op de
issue geplaatst. Als het geschil betrekking heeft op gegevens of validatie van een community, beslist
de eigen autoriteit van de community en voert het bord diens besluit uit.
Voor prijswedstrijden gelden dezelfde regels, aangevuld met de vooraf gepubliceerde
kwalificatie- en auditstappen van de wedstrijd — winnaars worden **vóór** uitbetaling gecontroleerd, en bij een
diskwalificatie wordt de regel geciteerd, precies zoals bij elke andere schrapping.

## Toekomstige richtingen

- **Uitgebreide modelvergelij­kingsruns** — systematische evaluatie van frontier-modellen (GPT-4o, Claude, Gemini, enz.) voor champollion-talen met behulp van aangepaste evaluatiecorpora (geen openbare benchmarks)
- **Meer taalparen** — Quechua, Inuktitut en andere talen met weinig middelen naarmate door de gemeenschap geverifieerde datasets beschikbaar komen
- **Dataset-import** — hulpmiddelen om externe evaluatiedatasets (WMT, Tatoeba, enz.) te converteren naar het champollion-evaluatieformaat
- **Geautomatiseerde heruitvoeringen** — detectie van modelversiewijzigingen en heruitvoering van benchmarks om scoreverschuivingen bij te houden

---

## Zie ook

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — live scores en inzendingen
- **[Eval-harness](/docs/network/specifications/harness)** — hoe u evaluaties uitvoert
- **[Evaluatiedatasets](/docs/network/leaderboard/datasets)** — datasetformaat en beschikbare datasets
- **[Een methode bouwen](/docs/network/specifications/methods)** — de specificatie van de methode-interface
- **[Runkaart-specificatie](/docs/network/specifications/run-card)** — het JSON-schema voor runkaarten
- **[Benchmarkspecificatie](/docs/network/specifications/benchmark)** — evaluatieprotocol, corpusformaat, soevereiniteit
- **[Scorespecificatie](/docs/network/specifications/scoring)** — SSOT voor metrieken en hoe runs worden gescoord
