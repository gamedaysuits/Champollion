---
sidebar_position: 1
title: "Indieningsregels"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
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

> **Samenvatting.** Deze pagina definieert de criteria voor inzending op het klassement, scoringsmetrieken (chrF++, FST-acceptatie, exacte overeenkomst, equivalente overeenkomst, semantische score), anti-manipulatiebeleid, verificatieniveaus en de inzendingsworkflow. Methoden die zijn blootgesteld aan evaluatiedata worden gediskwalificeerd.

champollion bevat een raamwerk voor de evaluatie van machinale vertaling, ontworpen voor **reproduceerbare benchmarking** van vertaalmethoden — met name voor talen met weinig middelen en inheemse talen waarvoor standaard MT-benchmarks niet bestaan en kwaliteitsclaims moeilijk te verifiëren zijn.

---

## Het klassement

Het middelpunt is het **[Method Leaderboard](https://champollion.dev/leaderboard)** — een openbaar scorebord, live en **open voor inzendingen**, waar onderzoekers en communityleden vertaalmethoden indienen en vergelijken met behulp van gevingerafdrukte, reproduceerbare evaluaties.

Elke inzending bevat:

- **Gevingerafdrukte pipeline** — gekoppeld aan een specifieke Git-commit en config-hash, zodat resultaten te herleiden zijn naar de exacte code die ze heeft geproduceerd
- **Geversioneerde dataset** — voorzien van een content-hash en geversioneerd; scores zijn alleen vergelijkbaar binnen dezelfde datasetversie
- **Gestandaardiseerde metrics** — alle scores worden berekend door de gedeelde evaluation harness, waardoor implementatieverschillen worden geëlimineerd
- **Trust tiers** — self-benchmarked, Champollion Verified, of Community Validated
- **Cost tracking** — API-kosten per inzending, zodat de afweging tussen kosten en kwaliteit transparant is

Het klassement scoort vijf metrieken. Drie werken voor elke taal; twee zijn beschikbaar voor Plains Cree en worden gegeneraliseerd naarmate we uitbreiden:

| Metriek | Type | Wat het meet |
|--------|------|------------------|
| **chrF++** | Karakter-n-gram F-score | Primaire kwaliteitsmetriek — correleert goed met menselijk oordeel, met name voor morfologisch rijke talen |
| **Exacte overeenkomst** | Aandeel perfecte overeenkomsten | Strikte nauwkeurigheid — hoe vaak is de vertaling exact gelijk aan de gouden standaard? |
| **FST-acceptatie** | Morfologische doorlaatpercentage | Voor methoden met verificatie via eindige-toestandstransducer — welk aandeel van de uitvoer is morfologisch geldig? |
| **Equivalente overeenkomst** | Acceptabele variantpercentage | Fractie die overeenkomt met de referentie of een acceptabele variant (woordvolgorde, orthografische conventie). Momenteel CRK; wordt gegeneraliseerd. |
| **Semantische score** | Semantische getrouwheid | Betekenisbehoud — geeft de vertaling de beoogde betekenis weer, ongeacht de oppervlaktevorm? Momenteel CRK; wordt gegeneraliseerd. |

:::info[Volledige Metriekenset]
De [Scoringsspecificatie](/docs/network/specifications/scoring) definieert de volledige metriekenlijst (zes categorieën: oppervlak, structuur, semantiek, gedrag, naleving en gerapporteerde vergelijkingen), de formule voor de samengestelde score, gewichtstabellen en kwaliteitsdrempelwaarden.
:::

**[→ Bekijk het klassement](https://champollion.dev/leaderboard)**

---

## Beschikbare datasets

### EDTeKLA Development Set v1

De eerste evaluatiedataset, opgebouwd voor Engels→Plains Cree (SRO)-vertaling. Samengesteld door de [EdTeKLA-onderzoeksgroep](https://spaces.facsci.ualberta.ca/edtekla/) aan de University of Alberta.

| Eigenschap | Waarde |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Taalpaar** | EN → CRK (Plains Cree, SRO-spelling) |
| **Aantal entries** | 436-entry dev split (`textbook_dev.json`); de volledige uitsplitsing wordt eenmalig vermeld op de [pagina Evaluation Datasets](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **Licentie** | [EdTeKLA's modified CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, sovereignty-scoped) — niet-commercieel; uitgesloten van het leaderboard, prijzen en commerciële/API-trajecten |
| **Herkomst** | `gold_standard` (geverifieerd door sprekers), `textbook` (gepubliceerd educatief materiaal) |

### FLORES+ Devtest — Alleen voor ontwikkelingsgebruik

> [!WARNING]
> **FLORES+ is beschikbaar voor ontwikkeling en foutopsporing, maar wordt NIET gebruikt voor officiële klassementsevaluatie.** FLORES+ (oorspronkelijk Meta FLORES-200) is een breed openbaar beschikbare benchmarkdataset waarop frontier-LLM's vrijwel zeker zijn getraind. Scores op basis van FLORES+ weerspiegelen de werkelijke vertaalkwaliteit voor op LLM gebaseerde methoden niet betrouwbaar. Niet-LLM-methoden (FST, regelgebaseerd, fijnafgesteld NMT) worden minder beïnvloed, maar FLORES+-scores worden nog steeds niet gepubliceerd op het klassement.

FLORES+-fixtures blijven beschikbaar in `test/benchmark/fixtures/` voor pipeline-rooktests, taaloverschrijdende validatie en ontwikkelingsgebruik. Officiële evaluatie maakt gebruik van aangepaste corpora opgebouwd uit door mensen geschreven tekst die niet openbaar beschikbaar is in parallelle vorm.

Zie [Evaluatiedatasets](/docs/network/leaderboard/datasets) voor het volledige datasetschema, moeilijkheidsgraden en hoe u uw eigen dataset kunt aanmaken.

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

Verificatieniveaus beschrijven **wie het resultaat heeft gevalideerd** — los van de kwaliteitsniveaus (Baseline → Vloeiend) die zijn gedefinieerd in de [Scoringsspecificatie, §5](/docs/network/specifications/scoring#5-quality-tiers), die beschrijven wat de geautomatiseerde samengestelde score betekent.

| Tier | Betekenis | Hoe te verkrijgen |
|------|---------|--------------|
| **Self-benchmarked** | U heeft de harness zelf uitgevoerd en de resultaten ingediend | Publiceer uw run card met `mt-eval publish` |
| **Champollion Verified** | De server heeft uw ingediende outputs onafhankelijk opnieuw gescoord tegen het sha-pinned referentiecorpus en uw score gereproduceerd | Automatisch — elke inzending wordt opnieuw gescoord (zie hieronder) |
| **Community Validated** | Tweetalige sprekers van de doeltaal, gekwalificeerd volgens het eigen protocol van de community, hebben een gestratificeerde steekproef van de output beoordeeld (≥30 entries, ≥2 beoordelaars) en ≥70% voldeed aan de norm van de community. Wordt uitsluitend toegekend door de eigen tests van de community; degradatie door een spot-audit is symmetrisch | Dien de methodecode in bij de governance-organisatie — zij voeren deze uit tegen de gold-standard set en leggen de output voor aan de community voor beoordeling |

### Hoe verificatie schaalt: op reputatie gewogen auditing

**Wij claimen geen herkomst.** Een rij op het leaderboard wordt geproduceerd door een bijdrager die de *open-source* harness op zijn *eigen* machine uitvoert. "Deze run is echt via de harness verlopen" is niet iets wat een server kan verifiëren voor self-hosted compute — de signing key van de harness is in handen van de bijdrager, dus een handtekening authenticeert een *machine, geen eerlijkheid*. In plaats van te doen alsof dit wel zo is, **wordt geldigheid hier verdiend en is deze zelfcorrigerend**: een rij is betrouwbaar omdat de score **reproduceerbaar** is en omdat de bijdrager erachter **een reputatie op het spel heeft gezet die door een ontdekte vervalsing zou worden verwoest.** Verificatie wordt uitgevoerd in vier lagen, zodat het grondig is waar het moet en goedkoop waar het kan — het project hoeft nooit het werk van iedereen opnieuw uit te voeren.

- **L0 — alles opnieuw scoren (gratis, 100%).** De server leidt uw score opnieuw af van *uw eigen ingediende outputs* tegen het **sha-pinned referentiecorpus** (niet uw opgeslagen kopie daarvan), met dezelfde metric die de harness gebruikt. Als de score niet reproduceert vanuit de outputs, of als een opgeslagen referentie is gewijzigd, wordt de run **gediskwalificeerd** — dit alleen al elimineert een ingetypte of bewerkte score. Een run die reproduceert, wordt gepromoveerd naar **Champollion Verified**, de enige tier die op het leaderboard wordt gerangschikt. Dit wordt uitgevoerd bij elke inzending en duurt milliseconden.
- **L1 — een reputatieladder voor bijdragers.** Elke bijdrager (geïdentificeerd door hun login) verdient *alleen* reputatie door de diepere controles hieronder te doorstaan — nooit door volume alleen, dus het aanmaken van nieuwe identiteiten levert niets op. Reputatie is **openbaar** en bepaalt hoe vaak de dure controle wordt geactiveerd.
- **L2 — een *steekproef* opnieuw uitvoeren (de dure controle).** Voor een *openbare* development set kan L0 een bijdrager die simpelweg de referentie kopieert als zijn "vertaling" niet betrappen. Om dat te betrappen, moet het model daadwerkelijk opnieuw worden uitgevoerd — echte compute — dus doen we dit op een **steekproef**, niet bij iedereen. Een run wordt geselecteerd voor een L2 re-run met een waarschijnlijkheid die stijgt met de **belangen** (een run die de eerste brug slaat naar een hele taalfamilie wordt *altijd* opnieuw uitgevoerd), stijgt met **anomalie** (een te-mooi-om-waar-te-zijn sprong over de vorige beste wordt *altijd* opnieuw uitgevoerd), en daalt met **reputatie** (een bijdrager die veel audits heeft doorstaan, wordt zelden gecontroleerd; een nieuwkomer of anonieme inzender wordt bij elke run gecontroleerd totdat ze vertrouwen hebben verdiend). Het doorstaan van een L2-audit verhoogt de reputatie.
- **L3 — bevestiging (gratis verificatie).** Wanneer twee *onafhankelijke* bijdragers hetzelfde model op hetzelfde corpus uitvoeren en hun opnieuw gescoorde outputs **overeenkomen**, *is* die overeenkomst verificatie — en het verhoogt de reputatie van beiden. Een oprechte **onenigheid** markeert beide runs voor een L2-audit. Replicatie wordt beloond in plaats van als overbodig te worden beschouwd.

**Eén ontdekte vervalsing is catastrofaal — net als een intrekking.** Een bewezen vervalsing reduceert de reputatie van de bijdrager tot nul, **onderwerpt hun volledige geverifieerde geschiedenis aan een re-audit** (elk van hun geverifieerde runs wordt opnieuw door de verificatie gestuurd), en wordt **openbaar** vastgelegd in het auditlogboek. Dat is wat lichte steekproeven veilig maakt: valsspelen met een openbare dev set kan bij één run onopgemerkt blijven, maar de verwachte kosten — het verlies van al het verdiende vertrouwen en het opnieuw onder de loep nemen van uw volledige dossier — maken het een slechte gok. Deze regels binden de eigen runs van de maintainers op symmetrische wijze.

**Waarom bijdragen nog steeds de moeite waard is.** U betaalt altijd het dure gedeelte (het uitvoeren van uw methode); het project betaalt alleen de gratis L0 re-score voor iedereen plus een L2 re-run op een *krimpende steekproef* — hoog voor nieuwkomers en runs met grote belangen, laag voor bewezen bijdragers. Verificatiekosten worden *geamortiseerd door reputatie en gedeeld door bevestiging*, en niet elke keer volledig opnieuw betaald.

---

## Hoe in te dienen

1. **Bouw uw methode** — zie [Building a Method](/docs/network/specifications/methods) voor de methode-interface
2. **Voer de harness uit** — zie [Eval Harness](/docs/network/specifications/harness) voor installatie en gebruik
3. **Genereer een run card** — de harness produceert een JSON run card met uw scores, vingerafdruk en metadata
4. **Publiceer** — `mt-eval publish eval/logs/harness/<your-run-card>.json` uploadt de run card naar het leaderboard
5. **Verschijn op het leaderboard** — uw run wordt klaargezet als *self-benchmarked (unverified)*, waarna de server uw outputs automatisch opnieuw scoort tegen het sha-pinned corpus (L0); wanneer dit reproduceert, promoveert de run naar *Champollion Verified* — de enige tier die het [Method Leaderboard](https://champollion.dev/leaderboard) rangschikt. Diepere, op reputatie gewogen auditing volgt de bovenstaande trust tiers

---

## Integriteitsbeleid: Intrekkingen, Re-runs, Delisting, Geschillen

Vooraf opgesteld zodat handhaving een procedure is, geen drama. Deze regels binden iedereen op symmetrische wijze — inclusief de eigen runs van de maintainers.

**Geen intrekkingen.** Een gepubliceerde run is een permanente registratie. Er is geen mechanisme — voor niemand — om een score te verwijderen omdat deze gênant is. Elke run-rij bevat een door de server gestempelde `submitted_at` timestamp en een onveranderlijke audit trail; moderatieacties zelf worden gelogd.

**Re-runs voegen toe, vervangen nooit.** Als u uw methode verbetert, publiceer dan een nieuwe run. De oude run blijft staan. Selectieve openbaarmaking — het privé testen van vele varianten en alleen de winnaar publiceren — is wat andere leaderboards manipuleerbaar maakte; een append-only registratie is het structurele antwoord. Vingerafdruk-deduplicatie stopt byte-identieke herinzendingsspam; het herschrijft nooit de geschiedenis.

**Delisting is de uitvoering van een regel, waarbij de regel wordt benoemd.** Een run wordt gedelist (gemarkeerd als `disqualified`, zichtbaar — niet stilzwijgend verwijderd) uitsluitend om vermelde redenen: een in quarantaine geplaatste of improper-subset dataset (afgedwongen door een database-trigger onder elke client), een mismatch in de corpus-checksum, gefabriceerde of out-of-range scores, schendingen van de content-guard, of de intrekking van de registratie van de onderliggende gegevens door een steward. De delisting benoemt de regel en het bewijs. Nieuwe oorzaken worden hier toegevoegd via een gedateerde bewerking voordat ze ooit worden toegepast, en worden nooit met terugwerkende kracht verzonnen voor één specifiek geval.

**Trust tiers zijn labels, geen bewerkingen.** `self-benchmarked`-rijen zijn claims; `Champollion Verified`-rijen zijn onafhankelijk opnieuw gescoord op basis van de outputs van de inzender tegen het sha-pinned corpus; `Community Validated` wordt uitsluitend toegekend door de eigen tests van de community. Verificatie verandert de tier van een rij — het verandert nooit de scores van de rij.

**Reputatie is openbaar en zelfcorrigerend.** De reputatie van de bijdrager en het auditlogboek dat elke re-score, steekproefsgewijze re-run, bevestiging en fabrication burn registreert, zijn openbaar. Reputatie is geen scorevermenigvuldiger en raakt nooit de cijfers van een run — het bepaalt alleen hoe vaak de runs van een bijdrager opnieuw worden ge-audit (zie *op reputatie gewogen auditing* hierboven). Een bewezen vervalsing wordt net zo openbaar geregistreerd als een intrekking en onderwerpt de volledige geverifieerde geschiedenis van de bijdrager aan een re-audit; dezelfde regels zijn van toepassing op de eigen runs van de maintainers.

**Geschillen.** Open een issue met het run-id en de specifieke claim (verkeerde score, verkeerde dataset, regel verkeerd toegepast). De maintainers voeren de deterministische controles openbaar opnieuw uit; de uitkomst en het bijbehorende bewijs worden in de issue geplaatst. Als het geschil gaat over de gegevens of validatie van een community, beslist de eigen autoriteit van de community en implementeert het leaderboard hun beslissing. Voor prijswedstrijden gelden dezelfde regels, plus de vooraf gepubliceerde kwalificatie- en auditstappen van de wedstrijd — winnaars worden ge-audit **voordat** er wordt uitbetaald, en een diskwalificatie citeert de regel precies zoals bij elke andere delisting.

## Toekomstige richtingen

- **Uitgebreide modelvergelij­kingsruns** — systematische evaluatie van frontier-modellen (GPT-4o, Claude, Gemini, enz.) voor champollion-talen met behulp van aangepaste evaluatiecorpora (geen openbare benchmarks)
- **Meer taalparen** — Quechua, Inuktitut en andere talen met weinig middelen naarmate door de gemeenschap geverifieerde datasets beschikbaar komen
- **Dataset-import** — hulpmiddelen om externe evaluatiedatasets (WMT, Tatoeba, enz.) te converteren naar het champollion-evaluatieformaat
- **Geautomatiseerde heruitvoeringen** — detectie van modelversiewijzigingen en heruitvoering van benchmarks om scoreverschuivingen bij te houden

---

## Zie ook

- **[Methodeklassement](https://champollion.dev/leaderboard)** — live scores en inzendingen
- **[Eval Harness](/docs/network/specifications/harness)** — hoe evaluaties uit te voeren
- **[Evaluatiedatasets](/docs/network/leaderboard/datasets)** — datasetformaat en beschikbare datasets
- **[Een methode bouwen](/docs/network/specifications/methods)** — de specificatie van de methode-interface
- **[Run-kaartspecificatie](/docs/network/specifications/run-card)** — het JSON-schema van de run-kaart
- **[Benchmarkspecificatie](/docs/network/specifications/benchmark)** — evaluatieprotocol, corpusformaat, souvereiniteit
- **[Scoringsspecificatie](/docs/network/specifications/scoring)** — SSOT voor metrieken, samengestelde gewichten en kwaliteitsniveaus
