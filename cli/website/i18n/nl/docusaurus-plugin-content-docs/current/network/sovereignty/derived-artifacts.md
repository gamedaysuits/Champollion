---
sidebar_position: 8
title: "De toezegging inzake afgeleide artefacten"
description: "Wie eigenaar is van de modellen, vertaalgeheugens en evaluatiestandaarden die zijn gebouwd op basis van taalgegevens van de gemeenschap: wij niet. Champollion is infrastructuur voor gemeenschappen om deze zelf te bouwen en in eigendom te hebben."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# De Toezegging inzake Afgeleide Artefacten

Het standpunt inzake [Databeheer](/docs/network/sovereignty/data-sovereignty) behandelt de *invoer*: corpora blijven bij hun beheerders, wij hosten of herdistribueren nooit gemeenschapsdata. Deze pagina behandelt de *uitvoer* — de zaken die **gebouwd worden op basis van** taaldata: getrainde modellen en hun gewichten, vertaalgeheugens, fine-tunes, coaching sets, evaluatiestandaarden en run-artefacten.

De toezegging, in één zin:

> **Wij claimen geen eigendom over enig taalmodel of van taal afgeleid artefact dat is gebouwd op basis van de data van een gemeenschap — en we hebben daar ook geen behoefte aan. Het hele doel van dit project is om de controle over deze technologieën, op het niveau van ontwikkeling en eigendom, in de handen van de sprekers te leggen.**

Champollion is **infrastructuur**. Een weg is geen eigenaar van de goederen die erover worden vervoerd.

## Wat dit concreet betekent

**Modellen behoren toe aan de mensen wier taal zij spreken.** Als een model wordt getraind op de data van een gemeenschap — met onze tools of die van iemand anders — volgen de gewichten, de fine-tunes en elke afgeleide de voorwaarden van de gemeenschap, niet de onze. Wij maken geen kopieën, wij verlenen geen nieuwe licenties en wij beschouwen "wij hebben het trainingsscript geschreven" niet als een eigendomsbelang in wat het heeft geproduceerd. De les is historisch, niet hypothetisch: taalgemeenschappen hebben herhaaldelijk moeten toezien hoe externe organisaties hun taal opnamen, compileerden of erop trainden en vervolgens de resultaten in handen hielden — auteursrechten op opnames van ouderen, modellen getraind op gescrapete spraak — terwijl de sprekers zelf toestemming moesten vragen voor hun eigen stemmen. Dat is het soort falen dat deze toezegging wil uitsluiten.

**Het werk voor Plains Cree (nêhiyawêwin) is de testcase, en het antwoord staat al vast.** Niets dat in dit project voor Cree is gebouwd, is van ons — niet het trainingscorpus (gebruikt met toestemming van de houders en nooit geherdistribueerd), niet de gecoachte pijplijnen, en geen enkel getraind model. Elk Cree-model dat in dit werk wordt geproduceerd, zal **uitsluitend worden vrijgegeven aan een erkende autoriteit binnen de gemeenschap** — een onderwijsautoriteit, een raad van oudsten, of welk orgaan de gemeenschap zelf ook aanwijst — onder de eigen voorwaarden van de gemeenschap, en aan niemand anders. Er is geen enkele versie hiervan waarbij een Cree-model als product wordt uitgebracht. Het evaluatiewerk voor Cree is eveneens **volledig niet-commercieel**: hooguit onderhoudt Champollion de *generieke* evaluatiemethodologie (de LYSS-standaard — het idee van intensionele, morfologie-bewuste, eerlijk-falende scoring). De **Cree-instantiëring** van die standaard — de taalkundige kennis die het codeert en waartegen het valideert — is niet iets dat wij bezitten; commercieel gebruik ervan is voorbehouden in afwachting van overleg met de nêhiyaw-taalgemeenschap, en de voorwaarden van de gemeenschap zijn leidend.

**Scores reizen; artefacten niet.** Het leaderboard publiceert *metingen* — een chrF++-waarde, een validatiepercentage, een betrouwbaarheidsinterval — waarbij de methode en het corpus worden geïdentificeerd. Het publiceert, host of vereist nooit het model zelf, de corpusinhoud of de uitvoer, verder dan wat de voorwaarden van de beheerder toestaan. Als een gemeenschap wil dat de rij van hun taal uit het publieke zicht wordt verwijderd, bestaan de [registratiekanalen](/docs/network/sovereignty/registering-corpora) precies zodat de zichtbaarheid hun knop is om aan te draaien, niet de onze.

## Infrastructuur betekent: uw data, uw build, uw sleutels

Drie concrete vormen van hoe "wij zijn slechts infrastructuur" er in de praktijk uitziet:

1. **Een gemeenschap bouwt haar eigen corpus.** Zij gebruiken de CLI op hun eigen machines; het corpus bevindt zich waar zij het plaatsen. Als zij ervoor kiezen om het te registreren voor benchmarking, slaat het register een *verwijzing en een checksum* op — ophalen bij de bron, onder hun licentie, en op hun verzoek te verwijderen. Het corpus komt nooit in onze repository of onze opslag terecht. Dit wordt afgedwongen door mechanismen die u kunt inspecteren: de openbare repo bevat de quarantainepoorten en database-triggers die het hosten van gemeenschapscontent structureel onmogelijk maken, niet slechts onbeleefd.

2. **Een gemeenschap traint haar eigen model.** De trainingssuite ([nmt-forge](https://github.com/gamedaysuits/Champollion)) draait op hun hardware; checkpoints en gewichten bestaan alleen daar. Het evaluatie-harnas scoort het; het bord registreert de score. Wij bezitten het model nooit. Als zij willen dat het voor altijd privé blijft, dan is dat zo — een scorerij is het enige openbare spoor, en alleen als zij er een publiceren.

3. **Een gemeenschap voert haar eigen benchmark uit.** Met [soevereine competities](/docs/network/sovereignty/run-a-sovereign-contest) blijft de testset verzegeld op door de gemeenschap beheerde infrastructuur; methoden komen *naar* de data toe; alleen geaggregeerde scores verlaten de infrastructuur. De gemeenschap beslist wie mag evalueren, onder welke voorwaarden, en kan op elk moment stoppen.

In elk geval is de reisrichting hetzelfde: capaciteit beweegt zich naar de gemeenschap toe; data en de afgeleiden daarvan bewegen zich er niet van weg.

## De frameworks die wij als voorbeeld zien

Wij zijn **geïnspireerd door, en streven naar,** de frameworks voor inheemse data-governance die gemeenschappen zelf hebben gebouwd. Het is niet aan ons om onszelf als compliant met een van deze te beschouwen — dat oordeel behoort toe aan de gemeenschappen en instellingen die ze hebben opgesteld. Wat we wel kunnen doen, is in hun richting ontwerpen, hen benoemen als de normbepalers, en duidelijk uitspreken dat we de kans om te luisteren naar en samen te werken met deze experts ten zeerste zouden waarderen, om dit systeem in hun geest te verbeteren:

- **First Nations-datasoevereiniteitsprincipes** — eigendom, controle, toegang en bezit, verwoord door First Nations in Canada: precies de vier capaciteiten die deze pagina toezegt in handen van de gemeenschap te houden.
- **De CARE-principes voor Inheemse Data Governance** (Collective Benefit, Authority to Control, Responsibility, Ethics), van de Global Indigenous Data Alliance — de corrigerende lens voor puur "open" data: openheid is geen deugd wanneer het een volk de autoriteit over hun eigen kennis ontneemt.
- **Te Mana Raraunga**, het handvest van het Māori Data Sovereignty Network — data als een levende taonga (schat), met rechten en verantwoordelijkheden die daarmee gepaard gaan.
- **De Kaitiakitanga-licentie** (Te Hiku Media) — voor zover wij weten het duidelijkste werkende voorbeeld van soevereiniteit over afgeleide artefacten in taaltechnologie: Te Hiku bouwde spraakmodellen *vanuit* en *voor* te reo Māori en licentieert toegang onder voorwaarden van beschermheerschap, zodat de modellen ten goede komen aan de Māori en onder Māori-bestuur blijven. Wanneer wij zeggen "modellen behoren toe aan sprekers", is Te Hiku het bewijs dat dit in de praktijk werkt.
- **Het participatieve onderzoeksmodel van Masakhane** — Afrikaanse NLP gebouwd door spreker-onderzoekers als co-auteurs en eigenaren in plaats van als databronnen; de demonstratie dat het *proces* van het bouwen van taaltechnologie op zichzelf de overdracht van capaciteit kan zijn.

Dit zijn verschillende frameworks van verschillende volkeren met verschillende juridische en culturele posities — we benoemen ze naast elkaar in plaats van ze onder één noemer te scharen. Waar ons ontwerp tekortschiet ten opzichte van hun geest, is dat een defect dat verholpen moet worden, en we horen dit liever van de experts dan dat we het ontdekken in een post-mortem. Als u in dit vakgebied werkt en bereid bent ons te vertellen wat we verkeerd hebben gedaan: **dan is dat gesprek de meest waardevolle bijdrage die dit project kan ontvangen.** Bereik ons via [Doe mee](/get-involved).

## Wat wij wel bezitten

Voor de duidelijkheid, de zaken die Champollion *wel* claimt: de infrastructuurcode (CLI, harnas, trainingssuite — elk onder de gepubliceerde licentie), de generieke evaluatiemethodologie en de *afgeleide metingen* van de index (die `champollion-derived`-herkomst dragen, precies zodat ze nooit ten onrechte worden toegeschreven aan een gemeenschap of een upstream-bron). Dat is de gereedschapskist. Wat u ermee bouwt, is van u.
