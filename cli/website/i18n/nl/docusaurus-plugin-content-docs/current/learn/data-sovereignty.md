---
title: "Wat datasoevereiniteit betekent wanneer u deze in software implementeert"
sidebar_label: "Datasoevereiniteit"
description: "Inheemse datasoevereiniteit is een reeks principes over wie data in eigendom heeft, controleert, er toegang toe heeft en deze bezit. Dit is hoe deze principes eruitzien wanneer iemand ze in werkende software probeert in te bouwen — en wat die poging niet kan claimen."
---

# Wat datasoevereiniteit betekent wanneer u het in software inbouwt

:::info[Voor wie dit is]
Iedereen. Er wordt geen achtergrond in recht, machine learning of inheemse bestuursvormen
verondersteld. Als u zich ooit heeft afgevraagd wat er daadwerkelijk nodig is voor een gemeenschap
om de controle over haar eigen taalgegevens te behouden zodra computers erbij betrokken raken, dan is deze pagina
het uitgebreide antwoord.
:::

De meeste discussies over data en toestemming stoppen bij permissie: heeft iemand ja gezegd.
Datasoevereiniteit stelt een moeilijkere reeks vragen. Wie is de **eigenaar** hiervan? Wie bepaalt
wat ermee gebeurt? Wie heeft er toegang toe? Waar bevindt het zich fysiek?

Die vragen zijn niet uit het niets ontstaan. Ze werden het eerst en het krachtigst geformuleerd door Inheemse volkeren.

---

## 1. De vragen — en wie ze het eerst stelden

First Nations in Canada hebben datasoevereiniteitsprincipes van
**eigendom, controle, toegang en bezit** geformuleerd als een claim van
jurisdictie over hun eigen informatie — voortkomend uit een gedocumenteerde
geschiedenis van onderzoek dat *op* gemeenschappen werd uitgevoerd in plaats
van *met* hen, en waarbij de resulterende data nooit terugkwam.

Die oorsprong is geen triviaal detail. Dit is geen algemene ethische checklist
die iedereen zomaar kan gebruiken; het zijn claims van jurisdictie, gemaakt
door specifieke volkeren in specifieke juridische en culturele contexten, en ze
behoren toe aan de gemeenschappen die ze hebben gemaakt.

De vier vragen in het kort:

| | De vraag die het beantwoordt |
|---|---|
| **Ownership** | Wie is de eigenaar van deze informatie? Een gemeenschap is collectief eigenaar van haar culturele kennis en data — op de manier waarop een persoon eigenaar is van zijn eigen persoonsgegevens. |
| **Control** | Wie bepaalt wat ermee gebeurt? Gemeenschappen hebben de controle over elke fase van alles wat hen aangaat: wat er wordt verzameld, hoe, door wie, waarvoor, en wat er daarna mee wordt gedaan. |
| **Access** | Wie heeft er toegang toe? Gemeenschappen moeten toegang kunnen krijgen tot informatie over henzelf, waar deze ook wordt bewaard en wie deze ook bewaart. |
| **Possession** | Waar bevindt het zich fysiek? Dit is niet hetzelfde als eigendom — bezit is het concrete feit van bewaring, en het is het mechanisme dat de andere drie afdwingbaar maakt in plaats van slechts een belofte. |

Er bestaan verschillende raamwerken en deze zijn niet inwisselbaar met
elkaar: **CARE** (Collective Benefit, Authority to Control, Responsibility,
Ethics) voor inheemse datagovernance in brede zin, en **Te Mana Raraunga** voor
Māori-datasoevereiniteit. Elk is ontstaan in zijn eigen juridische en culturele context. Het gebruik van
de naam van het ene raamwerk voor de principes van het andere is een eigen vorm van uitwissing.

---

## 2. Waarom software dit op scherp zet

Een principe kan op papier overleven als een goede intentie. Software dwingt de
vraag af, omdat een computer niet handelt op basis van intenties — hij handelt op basis van wat er is
gebouwd.

Neem de gebruikelijke manier waarop een vertaalsysteem wordt geëvalueerd. Om erachter te komen
of een systeem uw taal goed vertaalt, heeft iemand een **testset** nodig:
zinnen in uw taal, gekoppeld aan hun betekenis. Bijna elk evaluatieplatform
vraagt u om die testset te **uploaden** zodat het systeem hierop beoordeeld kan worden.

Lees dat nog eens met de vier vragen in de hand. Uploaden draagt
bezit over. Het draagt meestal ook de praktische controle over — zodra er een kopie bestaat op
de machine van iemand anders, is uw vermogen om "stop" te zeggen een verzoek, geen
feitelijke mogelijkheid. Toegang wordt iets dat u wordt verleend in plaats van iets dat u
heeft. Eigendom overleeft op papier en verliest in de praktijk grotendeels zijn betekenis.

Voor een gemeenschap waarvan de taalgegevens al eerder zijn geëxtraheerd, is "upload het en vertrouw
ons" geen neutraal verzoek. Het heeft dezelfde vorm als datgene wat al
eerder is gebeurd.

---

## 3. Wat de mechanismen daadwerkelijk inhouden

Het standpunt van dit project is dat als soevereiniteit echt is, het een eigenschap moet zijn
van de software, niet een paragraaf in een beleid. Hier is hoe dat er concreet
uitziet. Deze worden beschreven zodat u ze kunt evalueren en erover in discussie kunt gaan.

**Registratie zonder overdracht.** Een testset wordt geregistreerd door te beschrijven
*waar deze zich bevindt* en een cryptografische hash van de exacte inhoud vast te leggen — niet door
de zinnen te uploaden. Tijdens de evaluatie haalt het systeem de data op bij de bron,
controleert of de hash overeenkomt, en voert de beoordeling uit. Er wordt niets opgeslagen. Als de houder de
bron offline haalt, kan het corpus simpelweg niet meer worden geëvalueerd. De controle blijft waar deze
begon, omdat het bezit nooit is verplaatst.

**Versleuteling voor vertrek, voor het hoogste niveau.** Waar een corpus bruikbaar moet zijn
zonder ooit leesbaar te zijn, wordt het versleuteld **op het eigen apparaat van de houder**
voordat er iets wordt verzonden. Wat dit project ontvangt, is ciphertext en een
beschrijving die geen inhoud bevat.

**Geen enkele partij kan alleen ontsleutelen.** De sleutel wordt verdeeld onder een groep bewaarders, zodat
een bepaald aantal van hen — bijvoorbeeld drie van de vijf — samen moet handelen om iets te
autoriseren. Geen enkele individuele bewaarder kan alleen handelen, en dit project evenmin:
het gekozen model is dat **Champollion nul delen bezit**, waardoor het niet kan
ontsleutelen, met of zonder iemands medewerking. Een run vindt plaats omdat een quorum van
bewaarders heeft besloten dat dit moet gebeuren.

> **Waar dit momenteel staat.** Het mechanisme is gebouwd en testbaar. De
> *bewaarders zijn niet bevestigd* — de samenstelling behoort toe aan de betrokken
> gemeenschappen, en nog geen enkele groep heeft ermee ingestemd om delen te beheren. Totdat zij dit doen,
> is er geen actieve groep bewaarders, en dit project zal geen kandidaten
> publiekelijk noemen. Lees de bovenstaande paragraaf dus als een werkend mechanisme dat wacht op de
> relaties die het in werking zouden stellen, niet als iets dat vandaag al draait.

**Resultaten zonder blootstelling.** Wat terugkomt van een verzegelde evaluatie zijn
scores, geen zinnen. Er kan worden bewezen dat een methode werkt op een corpus dat de
auteur van de methode, en dit project, nooit hebben gelezen.

**Toestemming voor verzending.** Het verzenden van tekst naar een externe model-API is op zichzelf
een openbaarmaking. Corpora onder gemeenschaps-, maatwerk- of onvermelde licenties **weigeren**
evaluatie op afstand totdat de rechthebbende hier expliciet toestemming voor heeft vastgelegd.
Die weigering wordt afgedwongen in code, en geen enkel geautomatiseerd proces kan de
toestemming namens een gemeenschap verlenen.

**Omkeerbaarheid in slechts één richting.** Blootstelling kan worden versoepeld door een
bewuste beslissing van de houder. Het wordt nooit standaard, per ongeluk of
voor het gemak van iemand anders versoepeld.

---

## 4. Wat dit niet is

**Dit project is niet gevalideerd, gecertificeerd of goedgekeurd volgens enig Inheems datasoevereiniteitskader. Er heeft geen beoordeling
plaatsgevonden, er is er geen in afwachting, en er wordt er geen geïmpliceerd.**

Wat er wel is, is een **poging om datasoevereiniteit in code te implementeren** — om principes
die door Inheemse volkeren zijn geformuleerd, uit te drukken als werkende mechanismen in plaats van
beloften. Die poging is van ons. Of deze slaagt, is niet aan ons om te bepalen.
Het vaststellen van naleving behoort toe aan de betrokken gemeenschappen, en een project dat zijn
eigen naleving claimt, zou in het klein precies de houding reproduceren die deze principes proberen
te corrigeren: de buitenstaander die bepaalt wat geldt als een adequate behandeling van de
informatie van een gemeenschap.

Evenmin is dit alles een garantie van onmogelijkheid. Software heeft defecten. Beheerders
maken fouten. Een vastberaden partij die genoeg van de juiste rollen bekleedt, is een
restrisico dat door geen enkele architectuur wordt weggenomen. De claim is beperkter en, naar wij denken,
nuttiger: **de makkelijke paden zijn afgesloten, en de moeilijke paden laten sporen achter.**

Er zijn ook hiaten tussen de principes en de mechanismen, en we benoemen
ze liever zelf dan dat we u ze laten ontdekken. Possession is het principe dat deze
mechanismen het best dienen — de code is oprecht goed in het niet vasthouden van dingen.
Ownership en Control reiken verder dan software op zichzelf kan gaan, tot in voorwaarden,
bestuur en relaties die door geen enkele hoeveelheid cryptografie worden opgelost. En elk
bovenstaand mechanisme gaat uit van een gemeenschap die al de capaciteit en
infrastructuur heeft om haar eigen data te beheren, wat geen neutrale aanname is.

---

## 5. Ga hier alstublieft over in discussie

De poging staat open voor kritiek, en de uitnodiging is geen decoratie.

Als u werkt aan inheemse datagovernance, CARE, Te Mana Raraunga, of
inheemse taaltechnologie — of als u een lid of vertegenwoordiger bent van een
gemeenschap wier taal in deze index staat — willen we horen waar dit fout is.
In het bijzonder:

- waar een mechanisme niet doet wat het principe vereist;
- waar de formulering de principes van een gemeenschap verkeerd weergeeft, of hun autoriteit leent;
- waar iets als beschermend wordt beschreven dat u niet zou beschermen;
- waar een gemeenschap iets nodig zou hebben dat we niet hebben gebouwd;
- waar het vocabulaire zelf niet klopt.

Bezwaren en correcties kunnen worden ingediend via de
[contact- en takedown-route](/docs/network/community/contact-objections-takedown),
die ook betrekking heeft op het aanvragen van de verwijdering van alles over een taal die u
vertegenwoordigt. Er is geen vereiste om hier diplomatiek over te zijn.

Dat dit werk niet is beoordeeld, is een feit, geen verdediging ervan. Een poging die
uitnodigt tot beoordeling is eerlijk; een poging die dat niet doet, is een claim.

> Deze pagina is een beschrijving van één poging om te bouwen naar principes waarvan de gemeenschappen zelf de auteurs zijn — raadpleeg die principes zoals hun auteurs ze formuleren; deze poging wordt niet onderschreven door de organisaties die ze beheren.

---

## Volgende stappen

- [Databeheer](/docs/network/sovereignty/data-sovereignty) — het operationele standpunt, meer in de diepte.
- [Corpora Registreren](/docs/network/sovereignty/registering-corpora) — de vier blootstellingsniveaus, en wat uw machine verlaat bij elk niveau.
- [Een Soevereine Contest Uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) — de bewaardersceremonie, van begin tot eind.
- [Eerlijke Beperkingen](/docs/network/honest-limitations) — wat dit project niet claimt.
- [Voor Taalgemeenschappen](/docs/network/community/for-language-communities) — het praktische startpunt.
