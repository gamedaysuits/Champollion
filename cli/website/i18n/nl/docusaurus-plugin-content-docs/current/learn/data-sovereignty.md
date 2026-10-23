---
title: "Wat datasoevereiniteit betekent wanneer u deze in software implementeert"
sidebar_label: "Datasoevereiniteit"
description: "Inheemse datasoevereiniteit draait om eigenaarschap en zeggenschap van de gemeenschap over data. Zo zien die principes eruit wanneer iemand ze probeert in te bouwen in werkende software — en waar die poging geen aanspraak op kan maken."
---

# Wat datasoevereiniteit betekent wanneer u het in software inbouwt

:::info[Voor wie dit is]
Iedereen. Er wordt geen achtergrond in recht, machine learning of inheemse bestuursvormen
verondersteld. Als u zich ooit heeft afgevraagd wat er daadwerkelijk nodig is voor een gemeenschap
om de controle over haar eigen taalgegevens te behouden zodra computers erbij betrokken raken, dan is deze pagina
het uitgebreide antwoord.
:::

De meeste discussies over data en toestemming houden op bij toestemming: heeft iemand 'ja' gezegd.
Datasoevereiniteit stelt een moeilijkere vraag: wie **bezit** dit, en wie **beslist**
wat ermee gebeurt — niet eenmalig, maar zolang het bestaat?

Die vraag kwam niet uit het niets. Ze werd als eerste en
het krachtigst geformuleerd door inheemse volkeren.

---

## 1. De vragen — en wie ze het eerst stelde

First Nations in Canada formuleerden principes voor datasoevereiniteit — gemeenschappelijk
eigendom en zeggenschap over de eigen informatie — als het opeisen van
jurisdictie, voortkomend uit een gedocumenteerde geschiedenis van onderzoek dat *naar*
gemeenschappen werd gedaan in plaats van *met* hen, waarbij de resulterende gegevens
nooit meer terugkeerden.

Die herkomst is geen bijzaak. Dit is geen algemene ethische checklist
die iedereen zomaar kan overnemen; het zijn uitingen van jurisdictie, gedaan door specifieke
volkeren in specifieke juridische en culturele contexten, en ze behoren toe aan de
gemeenschappen die ze hebben opgesteld. Deze pagina herhaalt de principes van geen enkel raamwerk
namens de auteurs ervan: lees ze zoals de auteurs ze zelf verwoorden.

Eenvoudig gezegd bezit een gemeenschap haar culturele kennis en data collectief,
zoals een persoon zijn eigen persoonsgegevens bezit, en beslist zij over elke fase
van alles wat ermee te maken heeft: wat er wordt verzameld, hoe, door wie, waarvoor, en wat ermee
gebeurt na afloop.

Er bestaan verschillende kaders die onderling niet uitwisselbaar zijn:
**CARE** (Collective Benefit, Authority to Control, Responsibility, Ethics)
voor inheems databeheer in brede zin, en **Te Mana Raraunga** voor Māori
datasoevereiniteit, onder andere. Elk kader is ontstaan binnen een eigen juridische en culturele
context. De naam van het ene kader gebruiken voor de principes van het andere is een eigen vorm
van uitwissing.

---

## 2. Waarom software dit op scherp zet

Een principe kan op papier overleven als een goede intentie. Software dwingt de
vraag af, omdat een computer niet handelt op basis van intenties — hij handelt op basis van wat er is
gebouwd.

Neem de gebruikelijke manier waarop een vertaalsysteem wordt geëvalueerd. Om erachter te komen
of een systeem uw taal goed vertaalt, heeft iemand een **testset** nodig:
zinnen in uw taal, gekoppeld aan hun betekenis. Bijna elk evaluatieplatform
vraagt u om die testset te **uploaden** zodat het systeem hierop beoordeeld kan worden.

Lees dat nog eens met eigendom en controle in gedachten. Uploaden draagt de
bewaring over: er bestaat nu een kopie op de machine van iemand anders. Meestal draagt het
ook de praktische controle over — uw vermogen om 'stop' te zeggen wordt een verzoek, geen
rechtstreekse mogelijkheid. Eigendom blijft op papier bestaan, maar verliest zijn betekenis grotendeels.

Voor een gemeenschap waarvan de taalgegevens al eerder zijn geëxtraheerd, is "upload het en vertrouw
ons" geen neutraal verzoek. Het heeft dezelfde vorm als datgene wat al
eerder is gebeurd.

---

## 3. Wat de mechanismen daadwerkelijk inhouden

Het standpunt van dit project is dat als soevereiniteit echt is, het een eigenschap moet zijn
van de software, niet een paragraaf in een beleid. Hier is hoe dat er concreet
uitziet. Deze worden beschreven zodat u ze kunt evalueren en erover in discussie kunt gaan.

**Registratie zonder overgave.** Een testset wordt geregistreerd door te beschrijven
*waar deze zich bevindt* en een cryptografische hash van de exacte inhoud vast te leggen — niet door
de zinnen te uploaden. Tijdens de evaluatie haalt het systeem de data op bij de bron,
controleert of de hash overeenkomt en berekent de score. Er wordt niets opgeslagen. Als de houder de
bron offline haalt, kan het corpus simpelweg niet meer worden geëvalueerd. De controle blijft waar ze
begon, omdat de data nooit is verplaatst.

**Versleuteling voor vertrek, voor het hoogste beveiligingsniveau.** Waar een corpus
bruikbaar moet zijn zonder ooit leesbaar te zijn, wordt het versleuteld **op het apparaat
van de houder zelf**, en de cijfertekst blijft bij de houder. Wat dit project ontvangt,
is een beschrijving die geen inhoud bevat.

**Geen enkele partij kan alleen ontcijferen.** De sleutel is ontworpen om te worden verdeeld over een groep
bewaarders, zodat een bepaald aantal van hen — bijvoorbeeld drie van de vijf — moet
samenwerken om iets te autoriseren. Geen enkele individuele bewaarder kan alleen handelen, en
dit project evenmin: **Champollion bezit geen sleuteldelen**, dus het kan niet
ontcijferen met of zonder iemands medewerking. Een run vindt plaats omdat een
quorum van bewaarders heeft besloten dat dit moet gebeuren.

> **De huidige stand van zaken.** Vandaag de dag zijn de sleutels van een verzegelde set in handen van de organisator:
> degene die deze heeft verzegeld, heeft ze in bezit. Het bewaardersmechanisme is gebouwd en testbaar,
> maar het is nog niet uitgevoerd met daadwerkelijke bewaarders. Sleutelbewaarders vanuit de gemeenschap —
> er zijn er nog geen benoemd: de samenstelling is aan de betrokken gemeenschappen, en geen enkele
> groep heeft ermee ingestemd om sleuteldelen te beheren. Totdat dat wel zo is, is er geen actieve bewaardersgroep,
> en dit project zal geen kandidaten publiekelijk noemen. Lees de bovenstaande
> alinea dus als een werkend mechanisme dat wacht op de relaties die het
> in werking zouden stellen, niet als iets dat momenteel operationeel is.

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

**Dit project is niet gevalideerd, gecertificeerd of goedgekeurd volgens enig inheems
kader voor datasoevereiniteit. Er heeft geen beoordeling plaatsgevonden, er is er geen in behandeling,
en dit wordt op geen enkele wijze gesuggereerd.**

Wat bestaat is een **poging om datasoevereiniteit in code om te zetten** — om principes
die door inheemse volkeren zijn geformuleerd te nemen en ze uit te drukken als werkende
mechanismen in plaats van intentieverklaringen. Die poging is van ons. Of deze slaagt,
is niet aan ons om te bepalen. Beoordelingen van naleving behoren toe aan de betrokken
gemeenschappen, en een project dat zijn eigen conformiteit opeist, zou in het klein
exact de houding reproduceren die deze principes beogen te corrigeren: de buitenstaander
die beslist wat geldt als een adequate behandeling van de informatie van een gemeenschap.

Evenmin is dit alles een garantie van onmogelijkheid. Software heeft defecten. Beheerders
maken fouten. Een vastberaden partij die genoeg van de juiste rollen bekleedt, is een
restrisico dat door geen enkele architectuur wordt weggenomen. De claim is beperkter en, naar wij denken,
nuttiger: **de makkelijke paden zijn afgesloten, en de moeilijke paden laten sporen achter.**

Er zitten ook kloven tussen de principes en de mechanismen, en we benoemen ze liever
dan dat we u ze zelf laten ontdekken. Bewaring is waar deze mechanismen het best
in slagen — de code is er oprecht goed in om niets vast te houden. Eigendom en zeggenschap
reiken verder dan software op eigen kracht kan gaan: tot voorwaarden, bestuur en
relaties die met geen enkele hoeveelheid cryptografie kunnen worden beslecht. En elk
bovenstaand mechanisme gaat uit van een gemeenschap die al over de capaciteit en
infrastructuur beschikt om haar eigen data te beheren, wat geen neutrale aanname is.

---

## 5. Ga hier alstublieft over in discussie

De poging staat open voor kritiek, en de uitnodiging is geen decoratie.

Als u werkzaam bent op het gebied van inheems databeheer, CARE, Te Mana Raraunga of
inheemse taaltechnologie — of als u lid of vertegenwoordiger bent van een
gemeenschap waarvan de taal in deze index is opgenomen — dan horen we graag waar dit tekortschiet.
In het bijzonder:

- waar een mechanisme niet doet wat het principe vereist;
- waar de formulering de principes van een gemeenschap verkeerd weergeeft, of hun autoriteit toe-eigent;
- waar iets wordt omschreven als beschermend dat u in werkelijkheid niet zou beschermen;
- waar een gemeenschap iets nodig heeft wat we niet hebben gebouwd;
- waar het vocabulaire zelf niet klopt.

Bezwaren en correcties kunnen worden ingediend via de
[contact- en verwijderingsprocedure](/docs/your-words-your-rules),
die ook geldt voor het verzoeken om verwijdering van alles wat een taal betreft die u
vertegenwoordigt. U hoeft zich daarbij niet diplomatiek op te stellen.

Dat dit werk niet is beoordeeld, is een feit, geen verdediging ervan. Een poging die
uitnodigt tot beoordeling is eerlijk; een poging die dat niet doet, is een claim.

> Deze pagina is een beschrijving van een poging om te bouwen volgens principes waarvan de gemeenschappen zelf de auteurs zijn — raadpleeg deze principes zoals hun auteurs ze hebben verwoord; deze poging wordt door geen van de organisaties die deze principes beheren onderschreven.

---

## Hoe nu verder

- [Uw woorden, uw regels](/docs/your-words-your-rules) — het operationele standpunt, nader uitgediept.
- [Corpora registreren](/docs/network/sovereignty/registering-corpora) — de vier blootstellingsniveaus, en wat er bij elk niveau van uw machine weggaat.
- [Een soevereine wedstrijd uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) — de bewaardersceremonie, van begin tot eind.
- [Eerlijke beperkingen](/docs/network/honest-limitations) — wat dit project niet claimt.
- [Uw woorden, uw regels](/docs/your-words-your-rules) — het praktische startpunt.
