---
sidebar_position: 2
title: "Wat telt hier als een taal?"
---

# Wat telt hier als een taal?

> **Samenvatting.** Het Network catalogiseert talen op basis van ISO 639-3, benchmarkt individuele talen (geen macrotaalkoepels), erkent gebarentalen als de natuurlijke talen die ze zijn, neemt door ISO erkende kunsttalen op, sluit programmeertalen uit en geeft taxonomische meningsverschillen weer zonder partij te kiezen. Deze pagina legt elke keuze uit en wat die betekent voor het leaderboard.

Elk project dat vertaling over duizenden talen benchmarkt, moet een oud en verrassend moeilijk vraagstuk beantwoorden: wat telt als een taal? Taalkundigen weten al lang dat de grens tussen "taal" en "dialect" even goed sociaal en politiek van aard is als structureel — de beroemde uitspraak dat *"een taal een dialect is met een leger en een marine"* werd gepopulariseerd door de Jiddische taalkundige Max Weinreich in 1945 (hij schreef die toe aan een toehoorder tijdens een van zijn lezingen). We kunnen de vraag niet ontwijken, dus hier zijn onze antwoorden en onze redenering.

---

## Gebarentalen zijn talen. Punt.

Gebarentalen zijn natuurlijke talen — met volledige grammatica's, natuurlijke verwerving door kinderen en levende taalgemeenschappen. Dit staat vast in de taalkunde sinds William Stokoe in 1960 aantoonde dat American Sign Language dezelfde interne structuur heeft als gesproken talen, en zestig jaar onderzoek sindsdien (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) heeft dat alleen maar verder onderbouwd. ISO 639-3 kent gebarentalen individuele taalcodes toe; Glottolog catalogiseert ze naast gesproken taalfamilies. Onze catalogus bevat er meer dan 160, getagd als `modality: signed`.

Sommige zijn bedreigde inheemse talen: Plains Indian Sign Language (`psd`), van oudsher een belangrijke intertribale lingua franca in Noord-Amerika, is tegenwoordig kritiek bedreigd (Davis 2010, *Hand Talk*). De bedreiging van gebarentalen *is* de bedreiging van inheemse talen, en dat valt binnen de missie van dit project.

**Een eerlijke noot over reikwijdte.** Het Network benchmarkt momenteel *tekstgebaseerde* machinevertaling. Machinevertaling voor gebarentalen — waarbij gewerkt wordt met video, ruimtelijke grammatica en talen zonder een breed geadopteerde geschreven vorm — is een ander en grotendeels onopgelost technisch vraagstuk (zie Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL). We bedienen dit nog niet. Vermeldingen van gebarentalen in onze catalogus zeggen precies dat: **nog niet beschikbaar — nooit "geen taal."**

## Er zijn twee modaliteiten. Schrijven is er geen van.

Talen kennen twee primaire modaliteiten: **gesproken** en **gebaard**. Schrijven is geen derde modaliteit — het is een technologie die bovenop een taal is gelegd, en de meeste talen ter wereld redden het prima zonder een gestandaardiseerde schrijfwijze. Daarom registreren onze taalkaarten schrijven afzonderlijk (welke schriften een taal gebruikt, of dat er helemaal geen gestandaardiseerde orthografie bestaat) en doen dat eerlijk: voor een tekstgebaseerd MT-platform is of een taal geschreven is cruciale informatie, geen voetnoot — en een ongeschreven taal is geen mindere taal.

## Kunsttalen: erin. Programmeertalen: eruit.

We volgen de eigen lijn van ISO 639-3. De standaard neemt een kunsttaal alleen op als het een volledige taal is, ontworpen voor menselijke communicatie, met een literatuur en een gemeenschap die haar heeft doorgegeven aan een tweede generatie gebruikers — en sluit computerprogrammeertalen uitdrukkelijk uit. Esperanto, met zijn moedertaalsprekers, voldoet hieraan; Python niet, omdat niemand Python als eerste taal van zijn ouders verwerft. Onze catalogus bevat de twee dozijn kunsttalen die ISO erkent, als zodanig gekenmerkt, en geen programmeertalen.

## We benchmarken individuele talen, geen koepels

ISO 639-3 maakt onderscheid tussen *individuele talen* en *macrotalen* — koepelcodes zoals `cre` (Cree), `ara` (Arabisch) of `zho` (Chinees) die meerdere nauw verwante individuele talen omvatten. De benchmarkeenheid van het Network is de **individuele taal**, om een operationele reden: vertaalbronnen zijn varieteitspecifiek. Een morfologische analysator gebouwd voor Plains Cree (`crk`) genereert geen Moose Cree (`crm`); een corpus van Egyptisch Arabisch zegt weinig over de kwaliteit van een methode in Marokkaans Arabisch. Een score gekoppeld aan een macrotaalcode zou een bewering zijn over variëteiten die nooit daadwerkelijk zijn geëvalueerd — dus dat doen we niet.

Macrotalen verschijnen nog steeds in de catalogus als **hubpagina's**: navigatie die een koepelidentiteit koppelt aan de individuele leden ervan, in overeenstemming met de eigen observatie van ISO dat beide niveaus van identiteit reëel zijn. Onder de individuele taal tonen we dialect- en afstammingsinformatie uit de languoid-boom van Glottolog (Hammarström & Forkel 2022), die families, talen en dialecten modelleert als één navigeerbare hiërarchie.

**Hoe zit het met corpora die worden aangeleverd met een overkoepelende code?** Veel gegevens uit de praktijk doen dat — datasets die worden gepubliceerd als "Quechua", "Perzisch" of "Chinees (Vereenvoudigd)". We behandelen het bovenliggende label als *op te lossen metadata*, niet als een waarheid om blindelings te volgen of te verwerpen. Mechanische gevallen worden automatisch opgelost aan de hand van de officiële ISO-tabellen: een schrifttag wordt verwijderd (`cmn-Hans` is Mandarijn Chinees, geschreven in Vereenvoudigd Han — het schrift wordt geregistreerd, de taalidentiteit is `cmn`), en een ingetrokken code volgt zijn officiële opvolger. Wanneer de uitgever documenteert welke variëteit hun data daadwerkelijk betreft — FLORES+ codeert zijn Quechua-record bijvoorbeeld als `quy`, Ayacucho Quechua — leggen we die resolutie *met bronvermelding* vast in de registerinvoer van het corpus, en wordt het corpus gebenchmarkt onder de daadwerkelijke individuele taal. En wanneer niemand kan aangeven welke variëteit een verzameling bevat (sommige community-zinnenverzamelingen hanteren bewust een generieke "Arabisch"-bak), doen we geen aannames: het corpus blijft gecatalogiseerd onder zijn eigen label, wordt uitgesloten van de werkwachtrij met een machineleesbare reden die u kunt inzien in de metadata van de wachtrij, en eventuele historische scores erop blijven gekoppeld aan een eerlijk gelabeld overkoepelend knooppunt — nooit stilzwijgend toegeschreven aan een variëteit die nooit is geëvalueerd. Elke resolutie is opnieuw te herleiden: de vastgezette ISO-tabellen, de resolutiestempels per corpus en de citaten worden allemaal meegeleverd in het openbare register.

## Wanneer de autoriteiten het oneens zijn, tonen we beide

ISO 639-3 en Glottolog splitsen of groeperen soms verschillend, en taalgemeenschappen zijn het soms met beide oneens. We treden niet op als scheidsrechter. Taalkaarten bieden een interface-element voor *taxonomienotities* waarin het meningsverschil met bronnen wordt getoond, en de naamgeving volgt de gemeenschap waar deze een voorkeur heeft uitgesproken. Of een variëteit "een taal" is, is uiteindelijk deels een kwestie van identiteit — en identiteitsvraagstukken behoren toe aan de gemeenschappen zelf, een principe dat we overnemen uit kaders voor datagovernance van inheemse volkeren.

## Een onderzoeksrichting: benchmarks als meetinstrument

Een platform als dit levert, bijna als bijproduct, een nieuw soort bewijs op over hoe dicht taalvariëteiten *operationeel* daadwerkelijk bij elkaar liggen. Als één enkele vertaalmethode, constant gehouden, meerdere verwante variëteiten zodanig goed bedient dat de sprekers ervan de uitvoer accepteren, clusteren die variëteiten in de praktijk; als ze afzonderlijke corpora en afzonderlijke methoden vereisen, zijn ze operationeel verschillend — ongeacht wat de naamgevingspolitiek dicteert. Dit vertoont overeenkomsten met oudere empirische tradities, van begrijpelijkheidstests met opgenomen teksten tot geautomatiseerde lexicale afstandsmetingen, maar dan met een op implementatie gerichte insteek.

We bieden dit voorzichtig aan, als onderzoeksrichting en niet als bewering. Resultaten van methodetransfer worden beïnvloed door corpusomvang, domein, orthografie en contaminatie van trainingsdata, en een clustering is altijd relatief ten opzichte van een methode en een kwaliteitsdrempel. Bovenal: dit signaal kan gesprekken over taal en dialect *informeren*, maar overstijgt nooit de manier waarop een gemeenschap haar eigen taal identificeert.

---

## Referenties

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, red. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Waar dit toe leidt op deze site

De telregels hier bepalen elk getal op deze site: de
[dekkingsmethodologie](/docs/network/context/coverage-counting) past
ze toe op MT-diensten, en de
[taalkaarten](/docs/reference/language-card-spec) leggen per taal vast
wat elke bron daadwerkelijk beweert.
