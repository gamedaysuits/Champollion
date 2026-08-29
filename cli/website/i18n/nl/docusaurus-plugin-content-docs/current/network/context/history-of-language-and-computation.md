---
sidebar_position: 1
title: "Van Pāṇini tot Transformers"
---

# Van Pāṇini tot Transformers: Taal, Berekening en het Onvoltooide Werk van Vertaling

**Een Geschiedenis van de Ideeën achter champollion**

---

> *"Wanneer ik een artikel in het Russisch bekijk, zeg ik: 'Dit is eigenlijk in het Engels geschreven, maar het is gecodeerd in vreemde symbolen. Ik zal het nu decoderen.'"*
> — Warren Weaver, 1949

---

## Inleiding

De droom van een machine die tussen menselijke talen kan vertalen is ouder dan de computer zelf. Het is, in zekere zin, *het* oorspronkelijke probleem van de kunstmatige intelligentie — ouder dan schaakprogramma's, ouder dan expertsystemen, ouder dan neurale netwerken. Dit verlangen wordt vaak geframed via Europese parabels zoals de Toren van Babel, die taalkundige diversiteit positioneert als een straf of een op te lossen probleem, waarbij de realiteit wordt omzeild dat pre-contact Inheemse samenlevingen al lang een verbazingwekkende taalkundige diversiteit hebben genavigeerd via geavanceerde handelstalen (zoals Chinook Jargon) en gebarensystemen (zoals Plains Indian Sign Language), zonder te streven naar universele homogenisering.

Maar de geschiedenis die leidt tot dit moment — naar een wereld waarin grote taalmodellen aanvaardbaar Frans kunnen vertalen maar onzin hallucineren in het Cree — is geen rechte lijn. Het is een vlecht van ten minste vier afzonderlijke draden: de formele studie van taal, de wiskundige theorie van berekening, de statistische revolutie in machine learning, en een duistere geschiedenis die verklaart *waarom* de talen die technologie het hardst nodig hebben, precies de talen zijn waarvoor die technologie niet bestaat. Die vierde draad is de geschiedenis van koloniale taalonderdrukking en culturele genocide — de doelbewuste, systematische vernietiging van Inheemse talen op elk continent waar Europese machten dominantie vestigden. Zonder begrip van die geschiedenis ziet het technische probleem eruit als een toevalligheid van dataschaarsheid. Het is geen toeval.

Dit artikel traceert alle vier de draden van hun oorsprong tot hun convergentie in het heden. Het is, toegegeven, enigszins Whiggistisch — het vertelt het verhaal alsof het er altijd naartoe leidde. De geschiedenis wist natuurlijk niet waar ze naartoe ging. Maar de draden zijn reëel, de verbanden zijn authentiek, en ze begrijpen is essentieel om te begrijpen waarom projecten als champollion bestaan, waarom ze zijn gebouwd zoals ze zijn gebouwd, en waarom ze er nu toe doen.

---

## I. De Grammatica van Alles: Van Pāṇini tot Chomsky

### De Eerste Formele Grammatica (ca. 4e eeuw v.Chr.)

Het verhaal begint niet in een Europese universiteit, maar in het oude India, bij een geleerde genaamd Pāṇini. Rond de 4e eeuw v.Chr. stelde Pāṇini de *Aṣṭādhyāyī* samen — een grammatica van het Sanskriet bestaande uit ongeveer 4.000 regels. Dit was geen grammatica in de losse, pedagogische zin. Het was een *generatieve* grammatica: een eindige verzameling regels die in principe elke geldige uiting in de taal kon produceren.

Pāṇini's systeem gebruikte wat wij nu zouden herkennen als formele herschrijfregels, met variabelen, recursie en geordende toepassing. De taalkundige Paul Kiparsky heeft betoogd dat de *Aṣṭādhyāyī* "de meest volledige generatieve grammatica is van enige taal die ooit is geschreven" (Kiparsky, 1993). De informaticus Gerard Huet heeft aangetoond dat Pāṇini's regels gemodelleerd kunnen worden als een eindige-toestandstransducer — hetzelfde computationele formalisme dat, vijfentwintig eeuwen later, centraal zou komen te staan in de morfologische analyse van polysynthetische talen.

Pāṇini wist niet dat hij informatica bedreef. Maar dat deed hij wel.

### De Steen van Rosetta en de Geboorte van de Vergelijkende Taalkunde (1799)

Gedurende het grootste deel van de opgetekende geschiedenis was de studie van taal primair de studie van *de eigen* taal — of, op zijn best, de studie van een heilige of klassieke taal voor liturgische doeleinden. De intellectuele revolutie die de moderne taalkunde schiep, begon met een steen.

De Steen van Rosetta, ontdekt door Napoleons soldaten in 1799, droeg hetzelfde decreet in drie schriften: Egyptische hiërogliefen, Demotisch schrift en Oud-Grieks. Jean-François Champollion's ontcijfering van de hiërogliefen in 1822 was meer dan een archeologische triomf. Het demonstreerde een principe dat fundamenteel zou worden: dat talen *door elkaar* begrepen konden worden. Vertaling was niet louter een praktische vaardigheid; het was een methode van wetenschappelijk onderzoek.

### William Jones en de Indo-Europese Hypothese (1786)

Zelfs vóór Champollion had de Britse filoloog Sir William Jones in 1786 zijn beroemde lezing gehouden voor de Asiatic Society of Bengal, waarin hij opmerkte dat het Sanskriet met het Grieks en Latijn "een sterkere verwantschap vertoont, zowel in de wortels van werkwoorden als in de vormen van de grammatica, dan mogelijk door toeval kan zijn ontstaan." Jones stelde voor dat alle drie afstamden van een gemeenschappelijke voorouder "die misschien niet meer bestaat."

Dit was de geboorte van de historische en vergelijkende taalkunde. Het stelde vast dat talen geen geïsoleerde, statische entiteiten waren, maar leden van families — verwant door afstamming, gevormd door de tijd, onderworpen aan regelmatige wetten van verandering. Het was, op zijn manier, een evolutietheorie decennia vóór Darwin.

### August Schleichers Taalstambomen (1861)

Het was August Schleicher, een Duitse taalkundige, die de Darwinistische verbinding expliciet maakte. In 1861 — slechts twee jaar na *On the Origin of Species* — publiceerde Schleicher zijn *Stammbaum*-model (stamboom) van de Indo-Europese talen. Zijn diagrammen zien er bijna niet te onderscheiden uit van fylogenetische bomen in de biologie. Talen, net als soorten, vertakten zich, divergeerden en gingen soms uit.

Schleichers bomen waren een vereenvoudiging (talen *convergeren* ook door contact, ontlening en creolisering), maar het model bleek enorm productief. Het vestigde het principe dat taalkundige diversiteit geen willekeurige ruis was, maar gestructureerde data, vatbaar voor systematische analyse. En het stelde, impliciet, een vraag die centraal blijft in ons project: wat gebeurt er met de takken die aan het sterven zijn?

### Ferdinand de Saussure en de Architectuur van Taal (1916)

De volgende revolutie kwam van Ferdinand de Saussure, wiens *Cours de linguistique générale* (postuum gepubliceerd in 1916 op basis van aantekeningen van studenten) de structurele taalkunde vestigde. Saussure maakte een scherp onderscheid tussen *langue* (het abstracte systeem van een taal) en *parole* (het feitelijke spreken). Hij betoogde dat taaltekens *arbitrair* waren — het woord "boom" heeft geen inherente verbinding met bomen — en dat betekenis voortkwam uit *verschillen* binnen een systeem, niet uit enige positieve inhoud.

Saussures sleuteldiagram — het ovaal verdeeld tussen *signifié* (het betekende, het concept) en *signifiant* (het betekenende, het klankbeeld), verbonden door pijlen die hun onscheidbare relatie tonen — werd een van de meest gereproduceerde afbeeldingen in de geesteswetenschappen. Het vestigde het principe dat een taal een *systeem van systemen* is, waarbij elk element zijn waarde ontleent aan zijn relaties met alle andere.

Dit had diepgaande implicaties voor vertaling. Als betekenis relationeel en systemisch is, dan is vertaling geen kwestie van woorden omwisselen. Het vereist begrip van de gehele architectuur van een taal. Twee talen kunnen de wereld op fundamenteel verschillende manieren indelen — een inzicht dat later zou worden uitgewerkt (en soms overdreven) door Edward Sapir en Benjamin Lee Whorf.

### Sapir, Bloomfield en de Studie van Inheemse Talen

In Noord-Amerika bracht het begin van de 20e eeuw een andere traditie van taalkundig veldwerk. Edward Sapir en Leonard Bloomfield werkten uitgebreid met Inheemse talen — Sapir met Navajo, Nootka en vele andere; Bloomfield met Menomini en andere Algonquiaanse talen. Ze kwamen taalkundige structuren tegen die radicaal verschilden van alles in de Indo-Europese familie.

Sapir ontwikkelde in het bijzonder een typologisch kader dat talen langs meerdere assen classificeerde, waaronder het cruciale onderscheid tussen *analytische* talen (zoals het Engels, waar woorden de neiging hebben kort te zijn en betekenis wordt gedragen door woordvolgorde) en *polysynthetische* talen (zoals het Cree, waar één enkel woord kan uitdrukken wat het Engels als een volledige zin zou formuleren). Één enkele Cree-werkwoordsvorm kan het onderwerp, het object, de tijd, het aspect, de evidentialiteit en verschillende modificerende elementen in één morfologisch complex woord opnemen.

Dit werk vestigde twee feiten die centraal blijven in ons project. Ten eerste: de talen van de wereld zijn structureel veel diverser dan welk Eurocentrisch model ook zou suggereren. Ten tweede: veel van deze talen waren al bedreigd. Vroege structurele taalkundigen documenteerden deze complexiteit echter terwijl ze vaak deelnamen aan "salvage anthropology" — een extractief academisch model dat Inheemse mensen louter behandelde als "informanten" om westerse academische carrières op te bouwen. Deze aanpak sneed talen los van hun epistemologische wortels en baande de weg voor het behandelen van taal als belichaamloos, extraheerbaar gegeven in plaats van als levende, relationele systemen.

### De Chomsky-Revolutie (1957)

In 1957 publiceerde een 28-jarige MIT-taalkundige genaamd Noam Chomsky *Syntactic Structures*, een dun boek dat als een bom insloeg in het vakgebied. Chomsky betoogde dat het doel van de taalkunde moest zijn de *generatieve grammatica* van een taal te ontdekken — een eindige verzameling regels die alle en alleen de grammaticale zinnen van die taal kon produceren.

Provocatiever nog stelde Chomsky de *Chomsky-hiërarchie* voor: een classificatie van formele grammatica's naar hun computationele kracht. De hiërarchie heeft vier niveaus:

- **Type 3 (Regulier)**: Herkend door eindige automaten. Eenvoudige patronen.
- **Type 2 (Contextvrij)**: Herkend door pushdown-automaten. Recursieve structuren zoals geneste haakjes.
- **Type 1 (Contextgevoelig)**: Herkend door lineair begrensde automaten. Complexere afhankelijkheden.
- **Type 0 (Recursief opsombaar)**: Herkend door Turing-machines. Alles wat berekenbaar is.

Chomsky betoogde dat natuurlijke talen ten minste contextvrije grammatica's vereisten, en mogelijk meer. Dit was een directe brug tussen taalkunde en de wiskundige theorie van berekening. Dezelfde formele hulpmiddelen die Alan Turing had ontwikkeld om te redeneren over de grenzen van berekening, konden nu worden toegepast op menselijke taal.

Chomsky stelde ook het idee van *Universele Grammatica* voor — dat het vermogen tot taal aangeboren is, dat alle menselijke talen diepe structurele eigenschappen delen, en dat de diversiteit van oppervlaktevormen een onderliggende eenheid maskeert. Dit blijft controversieel (veel typologen en functionalisten zijn het er niet mee eens), maar de formele hulpmiddelen die Chomsky introduceerde — frasesstructuurregels, transformationele grammatica's, de hiërarchie zelf — werden de basis van de computationele taalkunde.

---

## II. De Droom van Universele Vertaling

### Ramon Llulls Denkende Machine (1305)

De droom van het mechaniseren van het denken — en daarmee de droom van mechanische vertaling — is opmerkelijk oud. Ramon Llull, een 13e-eeuwse Catalaanse mysticus, ontwierp de *Ars Magna*: een systeem van roterende concentrische schijven beschreven met fundamentele concepten, waarvan de combinaties bedoeld waren om alle mogelijke waarheden te genereren. Llulls wielen waren, in zekere zin, de eerste combinatorische logicamachine. Leibniz noemde Llull later als inspiratiebron.

### Athanasius Kircher en de Polygraphia Nova (1663)

Athanasius Kircher, de grote jezuïtische polymath, publiceerde *Polygraphia Nova et Universalis* in 1663 — een systeem van "universeel schrift" bedoeld om communicatie over taalbarrières heen mogelijk te maken. Kirchers systeem kende nummers toe aan concepten, die vervolgens in elke taal konden worden gedecodeerd met de juiste tabel. Het was, in wezen, een interlingua — een taaalonafhankelijke representatie van betekenis.

Het systeem werkte niet erg goed. Maar het *idee* bleef bestaan: dat er tussen twee talen een gemeenschappelijke conceptuele ruimte bestaat, en dat vertaling een kwestie is van daardoorheen te mappen. Deze interlingua-hypothese was niet slechts een gebrekkig wetenschappelijk experiment; het was een epistemologische uitbreiding van koloniale controle, onbekwaam om divergente ontologieën te mappen. De filosoof W.V.O. Quine zou dit falen later formaliseren met zijn concept van de *onbepaaldheid van vertaling* (1960), waarbij hij betoogde dat radicale vertaling inherent onbepaald is. Universele, contextvrije mapping tussen fundamenteel divergente taalsystemen is een filosofische onmogelijkheid, niet louter een technische hindernis.

### John Wilkins en de Filosofische Taal (1668)

Slechts vijf jaar na Kircher publiceerde de Engelse natuurfilosoof John Wilkins *An Essay towards a Real Character, and a Philosophical Language* — een poging om een taal te creëren waarvan de structuur *de structuur van de werkelijkheid perfect weerspiegelde*. Elk concept zou worden geclassificeerd in een grote taxonomie, en zijn naam zou zijn positie in die taxonomie coderen.

Wilkins' project mislukte (de werkelijkheid bleek bestand tegen nette classificatie), maar het anticipeerde op iets belangrijks: het idee dat taal *ontworpen* kon worden, dat de relatie tussen woorden en betekenissen systematisch en expliciet gemaakt kon worden. Dit is, in diepere zin, wat computationele taalkundigen doen wanneer ze ontologieën en kennisgrafen bouwen.

### Leibniz en de Characteristica Universalis

Gottfried Wilhelm Leibniz, die onafhankelijk de calculus uitvond en een mechanische rekenmachine ontwierp, droomde van een *characteristica universalis* — een universele formele taal waarin alle menselijke kennis uitgedrukt kon worden — en een *calculus ratiocinator* — een machine die in die taal kon redeneren. "Als er controverses zouden ontstaan," schreef Leibniz, "zou er geen behoefte meer zijn aan dispuut tussen twee filosofen dan tussen twee boekhouders. Want het zou voldoende zijn hun pennen ter hand te nemen, aan hun leien te gaan zitten en tegen elkaar te zeggen: Laten wij berekenen."

Leibniz vond ook de binaire rekenkunde uit — het getallenstelsel dat eeuwen later de taal van digitale computers zou worden. Zijn paper uit 1703 *Explication de l'Arithmétique Binaire* toonde aan dat elk getal weergegeven kon worden met alleen 0 en 1. Hij zag dit als een weerspiegeling van de goddelijke schepping (iets uit niets), maar het zou de basis blijken van alle digitale berekening.

### Warren Weavers Memorandum (1949)

Het moderne tijdperk van machinevertaling begint met een memorandum. In juli 1949 schreef de Amerikaanse wiskundige en wetenschapsbestuurder Warren Weaver aan Norbert Wiener, met het voorstel dat de nieuwe elektronische computers toegepast zouden kunnen worden op vertaling. Zijn memorandum bevatte de opmerkelijke passage die aan het begin van dit artikel wordt geciteerd: het idee dat een Russische tekst "eigenlijk in het Engels is geschreven, maar... gecodeerd in vreemde symbolen."

Weavers metafoor was ontleend aan de cryptanalyse uit de oorlogstijd — het idee dat vertaling fundamenteel een *decoderingsproobleem* was. Dit was niet louter een analogie. Dezelfde statistische en informatietheorische hulpmiddelen die waren ontwikkeld om vijandelijke codes te kraken, zouden, zo suggereerde Weaver, toepasbaar kunnen zijn op het vertaalprobleem.

Het memorandum was buitensporig optimistisch, maar het lanceerde een onderzoeksprogramma. Binnen vijf jaar zou de eerste demonstratie van machinevertaling plaatsvinden.

---

## III. De Machinerie van het Denken: Berekening en Informatie

### George Boole en de Algebra van de Logica (1854)

In 1854 publiceerde George Boole *An Investigation of the Laws of Thought* — een werk dat logisch redeneren reduceerde tot algebraïsche bewerkingen. Boole toonde aan dat de proposities van de logica gemanipuleerd konden worden met dezelfde regels als de algebra, waarbij EN overeenkomt met vermenigvuldiging, OF met optelling en NIET met complement.

Booleaanse algebra leek destijds een wiskundige curiositeit. Het zou het werkingsprincipe worden van elk digitaal circuit dat ooit is gebouwd.

### Charles Babbage en Ada Lovelace (1837–1843)

Charles Babbage ontwierp (maar voltooide nooit) de Analytical Engine — een mechanische, stoomgedreven, algemeen inzetbare computer. In tegenstelling tot zijn eerdere Difference Engine (een gespecialiseerde rekenmachine) had de Analytical Engine een geheugen ("the Store"), een verwerkingseenheid ("the Mill"), conditionele vertakking en lussen. Het was, in principe, Turing-compleet.

Ada Lovelace schreef, werkend vanuit een beschrijving van de Engine, een reeks gedetailleerde aantekeningen die wat algemeen wordt beschouwd als het eerste gepubliceerde computerprogramma bevatten: een algoritme voor het berekenen van Bernoulli-getallen (Noot G, 1843). Maar Lovelaces meest diepgaande bijdrage was conceptueel. Ze zag dat de Engine *symbolen* kon manipuleren, niet alleen getallen. "The Analytical Engine weaves algebraical patterns," schreef ze, "just as the Jacquard loom weaves flowers and leaves." De implicatie — dat berekening toegepast kon worden op elk domein met een formele structuur, inclusief taal — was vooruitziend.

### Alan Turing en de Universele Machine (1936)

In 1936 publiceerde Alan Turing "On Computable Numbers, with an Application to the Entscheidungsproblem" — een artikel dat tegelijkertijd berekening definieerde, de grenzen ervan bewees en de moderne computer uitvond (in abstracte vorm).

Turings sleutelinzicht was de *universele machine*: één enkele machine die, gegeven de juiste instructies gecodeerd op zijn tape, *elke andere* machine kon simuleren. Dit stelde vast dat er geen essentieel verschil was tussen hardware en software, tussen de machine en het programma. Één enkel apparaat, correct geprogrammeerd, kon alles berekenen wat überhaupt berekenbaar was.

Turings werk vestigde ook de grenzen van berekening (het haltprobleem) en legde de basis voor zijn latere verkenning van machine-intelligentie. Zijn paper uit 1950 "Computing Machinery and Intelligence," waarin de beroemde Turing-test werd voorgesteld, formuleerde de vraag naar machine-intelligentie expliciet in termen van *taal*: een machine is intelligent als ze, door middel van conversatie, niet te onderscheiden is van een mens.

### Claude Shannon en de Informatietheorie (1948)

In 1948 publiceerde Claude Shannon "A Mathematical Theory of Communication" in het *Bell System Technical Journal* — een artikel dat het vakgebied van de informatietheorie stichtte. Shannon toonde aan dat communicatie gemodelleerd kon worden als een systeem: een *informatiebron* genereert een *bericht*, dat een *zender* codeert in een *signaal*, dat door een *kanaal* gaat (onderhevig aan *ruis*), dat een *ontvanger* terugdecodeerd tot een bericht voor een *bestemming*.

Shannons sleutelbijdrage was het concept van *entropie* — een maatstaf voor de onzekerheid of informatieinhoud van een bericht. Hij bewees dat er voor elk kanaal met een gegeven ruisniveau een maximale snelheid bestaat waarmee informatie betrouwbaar kan worden verzonden (de kanaalcapaciteit), en dat deze snelheid bereikt kan worden met voldoende slimme codering.

De verbinding met vertaling is diepgaand. Shannon zelf gebruikte in een paper uit 1951 de informatietheorie om de statistische structuur van het Engels te analyseren. Hij toonde aan dat Engelse tekst sterk redundant is — dat een moedertaalspreker, gegeven een reeks letters, de volgende letter met grote nauwkeurigheid kan voorspellen. Deze redundantie maakt communicatie robuust tegen ruis, maar het betekent ook dat de *informatieinhoud* van taal veel lager is dan het ruwe symboolaantal zou suggereren.

Warren Weaver zag de verbinding onmiddellijk: als vertaling decodering is, en als de statistische structuur van taal gemodelleerd kan worden, dan is vertaling een informatietheorisch probleem. Dit inzicht zou decennia nodig hebben om vruchten af te werpen, maar toen het dat deed, transformeerde het het vakgebied.

### Von Neumann en de Stored-Program Computer (1945)

John von Neumanns rapport uit 1945 over de EDVAC (Electronic Discrete Variable Automatic Computer) beschreef wat we nu de *von Neumann-architectuur* noemen: een computer met één enkel geheugen voor zowel data als instructies, een centrale verwerkingseenheid en invoer-/uitvoermechanismen. Deze architectuur — data en programma's die hetzelfde geheugen delen, sequentieel verwerkt door een CPU — blijft het fundamentele ontwerp van vrijwel elke computer die vandaag de dag in gebruik is.

De von Neumann-architectuur maakte software praktisch. Programma's konden worden opgeslagen, gewijzigd en zelfs gegenereerd door andere programma's. Dit was de technologische voorwaarde voor alles wat volgde: compilers, besturingssystemen en uiteindelijk de neurale netwerkframeworks die moderne machinevertaling aandrijven.

---

## IV. Machinevertaling: Het Eerste AI-Probleem

### Het Georgetown-IBM-Experiment en de Koude Oorlog (1954)

Op 7 januari 1954 demonstreerden onderzoekers van Georgetown University en IBM het eerste publieke machinevertaalsysteem. Het systeem vertaalde 60 Russische zinnen naar het Engels met een woordenschat van 250 woorden en zes grammaticaregels. De zinnen waren zorgvuldig geselecteerd om binnen de mogelijkheden van het systeem te vallen, maar de demonstratie wekte enorme opwinding.

De *New York Times* berichtte dat het experiment een toekomst voorspelde waarin een "drukknop elektronische vertaler" alle wetenschappelijke literatuur ter wereld onmiddellijk toegankelijk zou maken. Dit publieke optimisme maskeerde echter de materiële realiteit van de financiering en het doel van het project. Het Georgetown-IBM-experiment — en het vroege machinevertaalveld in het algemeen — werd niet gedreven door een utopisch verlangen naar universele communicatie. Het werd gefinancierd door het Amerikaanse militaire en inlichtingenapparaat (waaronder de CIA en DARPA) als een dringende imperatief van de Koude Oorlog om Sovjet-wetenschappelijke en militaire teksten te bewaken en te onderscheppen.

De opvatting van taal als een "te kraken code" (zoals Weaver het formuleerde) was intrinsiek verbonden met gemilitariseerde surveillance. Onderzoekers voorspelden dat machinevertaling binnen vijf jaar een opgelost probleem zou zijn. Ze hadden het mis met meer dan een halve eeuw.

### Het ALPAC-Rapport en de Eerste AI-Winter (1966)

In 1966 bracht het Automatic Language Processing Advisory Committee (ALPAC), bijeengeroepen door de Amerikaanse overheid, een vernietigend rapport uit. Na een decennium van MT-onderzoek te hebben beoordeeld, concludeerde ALPAC dat machinevertaling langzamer, minder nauwkeurig en duurder was dan menselijke vertaling, en beval aan dat financiering zou worden omgeleid naar fundamenteel onderzoek in computationele taalkunde.

Het ALPAC-rapport doodde effectief de MT-onderzoeksfinanciering in de Verenigde Staten voor meer dan een decennium. Het was de eerste "AI-winter" — een patroon dat zich zou herhalen: buitensporige beloften, bescheiden resultaten, desillusie, instorting van financiering.

Maar het rapport bevatte ook een dieper inzicht. Machinevertaling had deels gefaald omdat taal moeilijker was dan iemand had verwacht. De regelgebaseerde aanpak — het schrijven van expliciete grammaticaregels om zinnen te ontleden en te genereren — werkte voor eenvoudige gevallen maar brak catastrofaal af op echte tekst. Taal was te ambigu, te contextafhankelijk, te *levend* voor broze regels om te vatten.

### Regelgebaseerde en Transfergebaseerde MT (jaren 1970–1980)

Het onderzoek ging door, stiller, gedurende de jaren 1970 en 1980. Systemen zoals SYSTRAN (dat de vroege vertaaldiensten van de Europese Commissie aandreef) gebruikten grote handgemaakte woordenboeken en transferregels om tussen taalparen te mappen. Deze systemen konden nuttige ruwe vertalingen produceren voor beperkte domeinen, maar ze vereisten enorme technische inspanning voor elk taalpaar, en ze gingen zelden elegant om met onbeperkte tekst.

Het fundamentele probleem was duidelijk: taal is geen cijfer. U kunt niet vertalen door woorden op te zoeken in een woordenboek en ze te herschikken volgens grammaticaregels, omdat betekenis afhangt van context, van wereldkennis, van de intentie van de spreker, van de gehele geschiedenis van een gesprek. De interlingua-aanpak — vertalen via een abstracte, taaalonafhankelijke representatie — was theoretisch elegant maar praktisch onmogelijk. Niemand kon de interlingua definiëren.

### De Statistische Revolutie (jaren 1990)

De doorbraak kwam niet van betere regels, maar van betere data. In de late jaren 1980 en vroege jaren 1990 ontwikkelden onderzoekers bij IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra en Robert Mercer) een reeks statistische modellen voor machinevertaling — de beroemde IBM-modellen 1 tot en met 5.

Het sleutelinzicht was Weavers oude idee, eindelijk rigoureus gemaakt: vertaling als decodering. Gegeven een buitenlandse zin *f*, vind de Engelse zin *e* die P(e|f) maximaliseert. Volgens de stelling van Bayes is dit equivalent aan het maximaliseren van P(f|e) × P(e) — een *vertaalmodel* (hoe waarschijnlijk is deze buitenlandse zin gegeven deze Engelse?) maal een *taalmodel* (hoe waarschijnlijk is deze Engelse zin op zichzelf?).

De IBM-modellen leerden deze kansen van grote *parallelle corpora* — verzamelingen teksten die in beide talen bestonden (zoals de Canadese parlementaire Hansards, die in zowel het Engels als het Frans werden gepubliceerd). Er waren geen handgemaakte regels vereist. Het systeem leerde vertalen door miljoenen voorbeelden van menselijke vertaling te observeren.

Statistische MT werkte dramatisch beter dan regelgebaseerde MT voor talen met overvloedige parallelle data. Het introduceerde ook een cruciaal stuk infrastructuur: de **BLEU-score** (Papineni et al., 2002), een maatstaf voor het automatisch evalueren van vertaalkwaliteit door machine-uitvoer te vergelijken met menselijke referentievertalingen. BLEU maakte het mogelijk om kwantitatief vooruitgang te meten en grootschalige experimenten uit te voeren.

Maar statistische MT had een fatale aanname ingebakken: het vereiste *parallelle corpora*. Voor de grote taalparen ter wereld — Engels-Frans, Engels-Chinees, Engels-Spaans — was parallelle data overvloedig aanwezig. Voor de overgrote meerderheid van de 7.000 talen ter wereld bestond die simpelweg niet.

### De Neurale Revolutie: Seq2Seq, Aandacht, Transformers (2014–2017)

De volgende transformatie kwam met deep learning. In 2014 demonstreerden Ilya Sutskever, Oriol Vinyals en Quoc Le *sequence-to-sequence* (seq2seq) modellen voor MT: neurale netwerken die een volledige zin in één taal konden lezen en een vertaling in een andere konden genereren, zonder expliciete uitlijning of frastabellen.

In 2015 introduceerden Dzmitry Bahdanau, Kyunghyun Cho en Yoshua Bengio het *aandachtsmechanisme* — waardoor de decoder "terug kon kijken" naar verschillende delen van de bronzin terwijl elk woord van de vertaling werd gegenereerd. Dit verbeterde de prestaties op lange zinnen dramatisch.

En in 2017 publiceerden Vaswani et al. bij Google "Attention Is All You Need," waarmee de *Transformer*-architectuur werd geïntroduceerd. De Transformer deed volledig afstand van recurrentie en verwerkte volledige reeksen parallel met behulp van zelfaandacht. Het was sneller te trainen, gemakkelijker te schalen en produceerde betere vertalingen dan alles wat er daarvoor was geweest.

Transformers leidden rechtstreeks tot de grote taalmodellen (LLM's) van de jaren 2020: GPT, BERT, PaLM, LLaMA en hun nakomelingen. Deze modellen, getraind op enorme hoeveelheden tekst van het internet, kunnen tussen honderden taalparen vertalen met opmerkelijke vloeiendheid.

Maar "opmerkelijke vloeiendheid" is niet hetzelfde als "betrouwbare nauwkeurigheid." En voor de laagresource-talen van de wereld is de situatie veel slechter dan het lijkt.

---

## V. De Andere Geschiedenis: Taal, Macht en Culturele Genocide

De voorgaande vier secties vertellen het verhaal van ideeën — van grammatici, wiskundigen en ingenieurs die toewerken naar machinevertaling. Maar er is een andere geschiedenis, die parallel loopt, die verklaart *waarom* de talen die vertaaltechnologie het hardst nodig hebben, precies de talen zijn waarvoor die niet bestaat. Dit is geen verhaal over dataschaarsheid als een neutraal feit. Het is een verhaal over doelbewuste vernietiging.

De reden dat Plains Cree geen ondersteuning voor machinevertaling heeft, is niet primair omdat Cree een moeilijke taal is voor computers (hoewel dat zo is). Het is omdat de regeringen van Canada en de Verenigde Staten gedurende meer dan een eeuw systematische programma's uitvoerden om Inheemse talen uit de monden van kinderen uit te roeien. De "dataschaarsheid" die laagresource-MT zo moeilijk maakt, is grotendeels de *stroomafwaartse consequentie van culturele genocide*. Elke eerlijke beschrijving van waarom deze talen technologie nodig hebben, moet rekenschap geven van waarom ze in de eerste plaats tot aan de rand van uitsterven zijn gebracht.

### Vóór Contact: Een Continent van Talen

De taalkundige diversiteit van de pre-contact Amerika's was verbijsterend. Ten tijde van het Europese contact was Noord-Amerika alleen al de thuisbasis van een geschat 300 tot 600 afzonderlijke talen, georganiseerd in tientallen niet-verwante taalfamilies — meer genetische diversiteit dan in heel Europa. Zuid-Amerika had er mogelijk 1.500 of meer (Campbell, 1997). Australië had meer dan 250 talen. De Pacifische eilanden, sub-Saharaans Afrika en het vasteland van Zuidoost-Azië waren evenzo divers.

Dit waren geen "primitieve" of "eenvoudige" talen. Veel van de structureel meest complexe talen die ooit zijn gedocumenteerd, zijn Inheems. De polysynthetische morfologie van Algonquiaanse talen (waaronder Cree, Ojibwe en Blackfoot), de tonale systemen van Navajo, de uitgebreide evidentialiteitsmarkering van Quechua, de klikmedeklinkers van de Khoisan-talen — deze vertegenwoordigen het volledige spectrum van wat menselijke taal kan zijn. Ze coderen geavanceerde kennissystemen over verwantschap, ecologie, recht, spiritualiteit en geschiedenis. Elke taal is een bibliotheek — een onvervangbaar verslag van de manier waarop één gemeenschap de wereld begrijpt en organiseert.

Edward Sapir erkende dit duidelijk. In 1921 schreef hij dat "als het gaat om taalkundige vorm, Plato wandelt met de Macedonische zwijnenhoeder, Confucius met de koppensneller van Assam." De talen van Inheemse volkeren waren niet minderwaardig. Ze waren anders — en hun verschillen bevatten kennis die geen enkele andere taal bezat.

### De Mechanismen van Taaldood

Talen sterven niet aan natuurlijke oorzaken. Ze sterven wanneer de voorwaarden voor hun overdracht worden verstoord — wanneer kinderen ophouden ze te leren, wanneer sprekers worden gestraft voor het gebruik ervan, wanneer de sociale en economische prikkels zodanig verschuiven dat het spreken van de dominante taal een overlevingsvoorwaarde wordt.

Deze verstoring kan geleidelijk plaatsvinden, door economische en demografische druk. Maar in de koloniale wereld was het overweldigend *opzettelijk*. De onderdrukking van Inheemse talen was geen bijwerking van kolonisatie. Het was een uitgesproken beleidsdoelstelling.

### Canada: Het Residentiële Schoolsysteem (1831–1996)

In Canada functioneerde het Indian Residential School-systeem gedurende meer dan 160 jaar, met als expliciet doel het elimineren van Inheemse talen en culturen. Naar schatting 150.000 First Nations-, Métis- en Inuit-kinderen werden uit hun families en gemeenschappen verwijderd en geplaatst in door de overheid gefinancierde, door kerken beheerde internaten.

Het centrale beleid werd met ijzingwekkende helderheid verwoord door Duncan Campbell Scott, de Deputy Superintendent General of Indian Affairs, in 1920: "Ik wil af van het Indiaanse probleem... Ons doel is door te gaan totdat er niet één Indiaan in Canada is die niet is opgenomen in het politieke lichaam en er geen Indiaans vraagstuk en geen Indiaans departement is."

Het mechanisme was taal. Kinderen werd verboden hun moedertalen te spreken. Straffen voor het spreken van een Inheemse taal varieerden van slagen tot eenzame opsluiting tot het door de tong steken van naalden. Kinderen kwamen aan terwijl ze Cree, Ojibwe, Inuktitut, Dene, Haida of een van tientallen andere talen spraken. Ze werden gestraft totdat ze ophielden.

De Truth and Reconciliation Commission of Canada (2015) documenteerde de systematische aard van deze aanval. Haar eindrapport concludeerde dat het residentiële schoolsysteem *culturele genocide* vormde — de vernietiging van de structuren en praktijken die een groep in staat stellen als groep te blijven bestaan. Taal was het primaire doelwit. Zonder taal wordt ceremonie verstoord, wordt mondelinge geschiedenis verbroken, worden verwantschapssystemen onbegrijpelijk en stopt de intergenerationele overdracht van kennis.

De laatste door de federale overheid beheerde residentiële school in Canada sloot in 1996. Veel van de Elders die vandaag de dag de laatste vloeiende sprekers van hun talen zijn, zijn overlevenden van residentiële scholen. Hun vloeiendheid is niet louter een taalkundige hulpbron. Het is een daad van verzet.

### De Verenigde Staten: Indiaanse Internaten (jaren 1860–1960)

De Verenigde Staten beheerden een parallel systeem. Kapitein Richard Henry Pratt, oprichter van de Carlisle Indian Industrial School in 1879, bedacht de zin die het tijdperk definieerde: "Kill the Indian, save the man." Meer dan 350 door de overheid gefinancierde internaten functioneerden in de Verenigde Staten, met beleid dat vrijwel identiek was aan dat in Canada. Inheemse kinderen werd verboden hun talen te spreken, ze werden gedwongen Engelse namen aan te nemen en werden onderworpen aan systematische culturele uitwissing.

Een rapport uit 2022 van het Amerikaanse Ministerie van Binnenlandse Zaken identificeerde meer dan 400 federale Indiaanse internaten in 37 staten en documenteerde de dood van ten minste 500 kinderen in het systeem — een aantal waarvan het rapport erkende dat het vrijwel zeker een significante onderschatting was. Het onderzoek stelde vast dat het systeem was ontworpen niet alleen om te onderwijzen, maar om "Indiaanse kinderen cultureel te assimileren door hen gedwongen te verwijderen van hun families en gemeenschappen."

De taalkundige gevolgen waren catastrofaal. Van de ongeveer 300 Inheemse talen die werden gesproken op het grondgebied dat de Verenigde Staten werd, zijn meer dan de helft nu uitgestorven. Van degenen die overleven, hebben de meeste minder dan 1.000 vloeiende sprekers, en velen hebben er minder dan 10. Het Endangered Languages Project classificeert de meerderheid van de overlevende inheems-Amerikaanse talen als "ernstig" of "kritiek" bedreigd.

### Australië: De Gestolen Generaties (1910–1970)

In Australië verwijderden overheidsbeleid tussen 1910 en 1970 gedwongen Aboriginals en Torres Strait Islander-kinderen uit hun families. Deze kinderen — bekend als de Gestolen Generaties — werden geplaatst in missies, reservaten en blanke pleeggezinnen. Het expliciete doel was assimilatie: om de Aboriginalidentiteit binnen een paar generaties weg te fokken.

Aboriginaltalen werden onderdrukt in missies en overheidsinstellingen. Kinderen die hun talen spraken, werden gestraft. Het Bringing Them Home-rapport (1997), opgesteld door de Australian Human Rights Commission, documenteerde de systematische aard van deze verwijderingen en hun verwoestende effecten op taal, cultuur en gezin.

Van de geschatte 250 Australische Aboriginaltalen die werden gesproken ten tijde van het Europese contact, worden er vandaag de dag minder dan 20 aan kinderen doorgegeven (Marmion et al., 2014). Meer dan 100 zijn volledig uitgestorven. De resterende talen overleven grotendeels dankzij de inspanningen van oudere sprekers die samenwerken met taalkundigen en gemeenschapsorganisaties in een race tegen de tijd.

### Scandinavië: De Sámi-Talen

De onderdrukking van Inheemse talen was niet beperkt tot settler-koloniale staten op het zuidelijk halfrond. In Noorwegen, Zweden en Finland werden Sámi-kinderen onderworpen aan internaten (*internatskoler*) van het midden van de 19e eeuw tot de jaren 1960. Sámi-talen werden verboden op scholen; kinderen werden gestraft voor het spreken ervan. Noorwegens "Noorwegianisering" (*fornorskingspolitikk*) beleid was er expliciet op gericht de Sámi-taal te elimineren en te vervangen door het Noors.

Van de negen overlevende Sámi-talen hebben er meerdere minder dan 500 sprekers. Ume Sámi heeft er ongeveer 20. Pite Sámi heeft er minder dan 30. De talen overleven deels dankzij revitaliseringsprogramma's die begonnen in de jaren 1970, waaronder de oprichting van Sámi-talige scholen en media — programma's die voor sommige dialecten net op tijd kwamen en voor andere te laat.

### Aotearoa Nieuw-Zeeland: Te Reo Māori

De Māori-taal (te reo Māori) was de meerderheidstaal van Aotearoa tot het midden van de 20e eeuw. Brits koloniaal onderwijsbeleid, beginnend in de jaren 1860, marginaliseerde te reo progressief op scholen. Tegen de jaren 1970 waren minder dan 20% van de Māori vloeiende sprekers, en de taal liep het risico binnen een generatie uit te sterven.

De Māori-reactie was een van de vroegste en meest succesvolle taalrevitaliseringsbewegingen ter wereld. Kōhanga reo (taalnesten) voor kleuters, opgericht in 1982, dompelden zuigelingen en peuters van bij de geboorte onder in te reo. Kura kaupapa Māori (Māori-medium scholen) volgden. Deze programma's, samen met de Māori Language Act van 1987 (die te reo een officiële taal maakte), hebben de taal gestabiliseerd — hoewel vloeiende sprekers nog steeds een minderheid van de Māori-bevolking vormen.

Nieuw-Zeeland produceerde ook een van de belangrijkste kaders voor Inheems databeheer: *Te Mana Raraunga*, het Māori Data Sovereignty Network. Dit kader stelt dat Māori-data — inclusief taalkundige data — een taonga (schat) is die onderworpen is aan de rechten en verantwoordelijkheden van kaitiakitanga (rentmeesterschap). Het informeerde rechtstreeks de ontwikkeling van de CARE-principes voor Inheems databeheer en is een fundamentele referentie voor de datasouvereiniteitmechanismen in champollion.

### Het Patroon: Taal als Doelwit van Koloniale Macht

De geografische en culturele bijzonderheden verschillen, maar het patroon is opmerkelijk consistent. In Canada, de Verenigde Staten, Australië, Scandinavië en Nieuw-Zeeland — en op vele andere plaatsen, van Taiwan tot Siberië tot de Andeshooglanden — identificeerden koloniale en postkoloniale staten Inheemse talen als obstakels voor assimilatie en richtten ze zich op hun eliminatie. De instrumenten waren overal vergelijkbaar: verwijder kinderen uit hun families, verbied het gebruik van Inheemse talen, bestraf overtredingen en beloon de adoptie van de koloniale taal.

Dit was geen historische voetnoot. De laatste residentiële school in Canada sloot in *1996*. Het laatste Indiaanse internaat in de Verenigde Staten sloot in de *jaren 1960*. Veel van de mensen die deze systemen overleefden, leven nog. Het trauma is intergenerationeel. En de taalkundige schade duurt voort: talen die een generatie sprekers verloren in het internaatstijdperk, verliezen nu hun laatste vloeiende Elders.

### Van Culturele Genocide naar "Dataschaarsheid"

Deze geschiedenis is direct relevant voor het technische probleem van machinevertaling. Wanneer informatici een taal beschrijven als "laagresource," bedoelen ze doorgaans: er zijn weinig digitale teksten, weinig parallelle corpora, weinig woordenboeken en weinig geannoteerde datasets. De framing is neutraal, alsof dataschaarsheid een daad van de natuur is, zoals een woestijn met weinig regen.

Dat is het niet. De "dataschaarsheid" van Inheemse talen is de *stroomafwaartse consequentie* van taalonderdrukkingsbeleid. Talen die verboden waren op scholen, produceerden minder geschreven teksten. Talen waarvan de sprekers werden gestraft voor het spreken ervan, ontwikkelden minder institutioneel gebruik. Talen die een generatie overdracht verloren, produceerden minder tweetalige sprekers die parallelle corpora konden creëren.

De pijplijn van culturele genocide naar dataschaarsheid is direct:

1. **Onderdrukking** → Kinderen gestraft voor het spreken van de taal
2. **Verstoorde overdracht** → Minder kinderen leren de taal
3. **Verminderde sprekersbase** → Minder volwassenen gebruiken het in het dagelijks leven
4. **Verminderd institutioneel gebruik** → Minder geschreven documenten, minder digitale teksten
5. **Dataschaarsheid** → ML-modellen hebben niets om op te trainen
6. **Geen MT-ondersteuning** → De taal is onzichtbaar voor technologie
7. **Versnelde achteruitgang** → Technologie versterkt de marginalisering die beleid begon

Deze pijplijn betekent dat elk technologieproject dat werkt met Inheemse talen een politieke en morele context erft, of het dat nu erkent of niet. Een machinevertaalsysteem dat Cree-taaldata behandelt als ruwe grondstof om door modellen te worden opgenomen, zet, hoe onbedoeld ook, de extractieve dynamiek voort die begon met residentiële scholen. De data werd schaars gemaakt door geweld. De sprekers die de bestaande data creëerden, deden dat tegen enorme kansen in. Elk systeem dat die data gebruikt zonder zinvolle controle van de gemeenschap, vergroot de oorspronkelijke schade.

### De Medeplichtigheid van de Wetenschappen en de Westerse Ideologie

Het is cruciaal te erkennen dat wetenschap en technologie geen onschuldige toeschouwers waren bij dit koloniale project; ze waren actieve deelnemers. De "Verlichtings"-ideologie die de wereld probeerde te categoriseren, kwantificeren en standaardiseren, behandelde Inheemse volkeren en hun talen vaak louter als onderzoekssubjecten of curiositeiten voor een "salvage anthropology." Deze extractieve praktijk vergrendelde kennis in westerse universiteiten terwijl ze weinig deed om de politieke machinerie te stoppen die die gemeenschappen vernietigde.

Dit project staat in schril contrast met methodologieën zoals de Tuskegee-syfilisstudies of extractieve taalkundige antropologie, die BIPOC-mensen behandelen als proefpersonen of passieve leveranciers van ruwe data. We zijn hier niet om te experimenteren op Inheemse mensen, hun kennis te extraheren of een westers cultureel monolithische ideologie op hen op te leggen. Ons doel is hun *eigen* manieren van kennen en hun *eigen* normen van waarde te faciliteren. Wij bieden de infrastructuur; de taalgemeenschappen bouwen de testsets, definiëren de maatstaven en behouden de betrokkenheid. Zonder hun betrokkenheid werkt niets hiervan.

### Waarom Deze Geschiedenis Ons Ontwerp Vormgeeft

Dit is waarom het governancemodel van champollion geen functie is — het is de basis. Elke grote ontwerpbeslissing in het project is een *directe reactie* op de hierboven beschreven geschiedenis. Het doel is datasouvereiniteit: gemeenschappen ondersteunen bij het in stand houden, revitaliseren en besturen van hun levende talen volledig op hun eigen voorwaarden.

**Waarom de testdata versleuteld is en wordt bewaard door gemeenschapstrusts.** Omdat Inheemse taalkundige data al meer dan een eeuw zonder toestemming wordt geëxtraheerd, gepubliceerd en geëxploiteerd. Missionaristaalkundige inspanningen, zoals die van het Summer Institute of Linguistics (SIL), monopoliseerden historisch gezien Inheemse parallelle corpora binnen een extractief, assimilationistisch kader. Bovendien gebruiken we, in tegenstelling tot veel moderne NLP-projecten die sterk leunen op vertaalde Bijbels als hun primaire parallelle corpus voor laagresource-talen, expliciet geen vertaalde Bijbels als corpora. De versleutelde testset, met sleutels die alleen worden bewaard door de governanceorganisatie van de gemeenschap, is een technisch mechanisme dat het *architecturaal onmogelijk* maakt extractieve patronen te herhalen.

**Waarom we sandboxed uitvoering gebruiken in plaats van open testsets.** Omdat zodra taalkundige data openlijk wordt gepubliceerd, de gemeenschap er permanent de controle over verliest. Conventionele ML-benchmarks publiceren hun testsets — iedereen kan ze downloaden, erop trainen of ze voor elk doel gebruiken. Dit moderne AI-datascraping vertegenwoordigt een nieuwe vorm van "datakolonialisme" en "digitale omheining." Voor gemeenschappen waarvan de talen bijna met geweld werden uitgeroeid, is het verliezen van controle over hun resterende taalkundige hulpbronnen geen kleine ongemak. Het is een directe voortzetting van historische territoriale onteigening. Sandboxed uitvoering zorgt ervoor dat de data van de gemeenschap hun infrastructuur nooit verlaat.

**Waarom methode-eigendom overdraagt aan de gemeenschap.** Omdat de geschiedenis van "helpen" van Inheemse gemeenschappen overweldigend een geschiedenis is van buitenstaanders die dingen bouwen *over* Inheemse mensen in plaats van *voor* of *met* hen. Academische papers worden gepubliceerd, subsidies worden geïnd, carrières worden bevorderd — en de gemeenschap blijft met niets achter. Het eigendomsoverdrachtmechanisme zorgt ervoor dat wanneer een ML-ingenieur een werkende vertaalmethode voor Plains Cree bouwt, de Plains Cree-gemeenschap die methode *bezit*. De ingenieur behoudt krediet en naamsvermelding. De gemeenschap behoudt het actief.

**Waarom alles wat een gemeenschapseigen methode verdient volledig toebehoort aan de gemeenschap.** Omdat taalrevitalisering duur is, en de gemeenschappen die het zwaarste werk doen — de Elders die lesgeven, de ouders die kinderen naar onderdompelingsscholen sturen, de activisten die taalnesten runnen — chronisch ondergefinancierd zijn. Bovendien eist de AI-infrastructuur die we gebruiken (bijv. datacenters, mijnbouw van mineralen, watergebruik) een onevenredige materiële tol op Inheemse landen wereldwijd. Champollion is een niet-commercieel project en maakt geen aanspraak op enig deel ervan: als een Cree-vertaalmethode ooit waarde genereert, moet die waarde Cree-taalprogramma's financieren. Technologie moet een instrument zijn dat gemeenschappen dient, niet een mechanisme dat waarde uit hen extraheert.

**Waarom wij "soevereiniteits-aspirant" zeggen in plaats van naleving te claimen.** Inheemse kaders voor datasoevereiniteit zijn ontwikkeld door specifieke volkeren voor specifieke contexten — de First Nations-datasoevereiniteitsprincipes in Canada, CARE (Collectief voordeel, Autoriteit om te controleren, Verantwoordelijkheid, Ethiek), Te Mana Raraunga (Māori-datasoevereiniteit) en de FAIR-principes behandelen deze kwesties elk vanuit verschillende culturele en juridische posities. Wij beweren niet dat we er één volledig implementeren; die bepaling is aan de gemeenschappen die ze hebben opgesteld. Wij zeggen dat ons ontwerp *soevereiniteits-aspirant* is — zo gebouwd dat gemeenschappen eigendom, controle, toegang en bezit *kunnen* uitoefenen over hun gegevens en de technologieën die daaruit zijn afgeleid. De architectuur streeft naar soevereiniteit; of het soevereiniteit bereikt, is aan de gemeenschappen om te beslissen. Wij beschouwen dit als onvoltooid werk, verwelkomen bezwaren en zullen ernaar handelen.

**Waarom het platform *methoden* benchmarkt, niet *modellen*.** Omdat Inheemse taalgemeenschappen niet afhankelijk mogen zijn van het model van één enkele onderneming. De open architectuur van een "methode" betekent dat de oplossing niet eens een kostbaar, materiaalintensief LLM hoeft te zijn. Het kan een zeer efficiënt, door de gemeenschap gehost regelgebaseerd systeem zijn dat draait op traditionele computerhardware. Als de beste vertaalmethode voor Cree vandaag Google's Gemini gebruikt, moet de gemeenschap morgen kunnen overstappen op een open-source of deterministische alternatief zonder alles opnieuw te hoeven bouwen. Benchmarking op methodeniveau zorgt ervoor dat het actief van de gemeenschap een *recept* is, geen afhankelijkheid.

**Waarom de gemeenschap deze infrastructuur nu moet bouwen.** De paradox van het benutten van AI terwijl men de materiële extractie ervan bekritiseert, wordt opgelost door een harde strategische realiteit: als dit probleem niet wordt opgelost door de gemeenschap op hun eigen soevereine voorwaarden, zal het onvermijdelijk worden "opgelost" door anderen op extractieve voorwaarden. Zelfs als een grote onderneming uiteindelijk een vertaalmodel bouwt voor een bepaalde Inheemse taal, heeft de gemeenschap haar eigen onafhankelijke, sandboxed benchmarkinginfrastructuur nodig om te verifiëren *wanneer* en *of* ze daadwerkelijk zijn geslaagd volgens gemeenschapsnormen — en om ervoor te zorgen dat de gemeenschap de waarde van dat succes vastlegt.

Dit is geen politiek dat aan technologie is vastgeplakt. Het is technologie ontworpen door mensen die de geschiedenis begrijpen.

---

## VI. Het Huidige Moment: 6.800 Talen Achtergelaten

### De Omvang van het Probleem

Van de ongeveer 7.000 levende talen die vandaag de dag op aarde worden gesproken, hebben er slechts ongeveer 550 enige vorm van automatische vertaling — en amper 200 worden bediend door een geïmplementeerde commerciële dienst ([hoe wij tellen](/docs/network/context/coverage-counting)). De rest is onzichtbaar voor de technologie — niet omdat ze minder waardig zijn, maar omdat de statistische en neurale benaderingen die moderne automatische vertaling (MT) domineren, fundamenteel *datahongerig* zijn. Ze vereisen miljoenen parallelle zinnen om van te leren. Voor de meeste talen ter wereld bestaan die zinnen niet.

De meest getroffen talen zijn precies de meest bedreigde: Inheemse talen, minderheidstalen, mondelinge tradities met beperkte schriftelijke verslagen. Dit zijn talen waarvan de sprekers vaak oud zijn, waarvan de gemeenschappen klein zijn, waarvan de politieke macht minimaal is. Het zijn de talen die technologische ondersteuning voor behoud en revitalisering het hardst nodig hebben — en het zijn de talen waarvoor bestaande technologie het minst nuttig is.

### De Polysynthetische Uitdaging

Het probleem is niet louter een kwestie van dataschaarsheid. Veel van de meest bedreigde talen ter wereld zijn *polysynthetisch* — ze hebben morfologische systemen van buitengewone complexiteit die de aannames van standaard NLP fundamenteel doorbreken.

Beschouw Plains Cree (nêhiyawêwin), een Algonquiaanse taal die wordt gesproken op de Canadese prairies. Één enkel Cree-werkwoord kan informatie coderen die het Engels over een volledige bijzin zou verspreiden: het onderwerp, het object, de tijd, het aspect, de evidentialiteit, de modaliteit en verschillende andere grammaticale categorieën, allemaal verpakt in één enkel woord door een systeem van voor- en achtervoegsels en interne modificaties.

Dit creëert verschillende problemen voor standaard MT-benaderingen:

1. **Tokenisatiefout.** Subwoordtokenizers zoals BPE (Byte Pair Encoding), ontworpen voor analytische talen zoals het Engels, verbrijzelen polysynthetische woorden in betekenisloze fragmenten. De morfologische structuur wordt vernietigd voordat het model die ooit ziet. BPE is niet neutraal; het vertegenwoordigt een puur empiristische, oppervlaktegebaseerde epistemologie die fundamenteel botst met de diepe, regelgebaseerde morfologische hiërarchieën die inherent zijn aan polysynthetische talen. Het is een architecturele bias die structurele morfologie actief ontmantelt.

2. **Combinatorische explosie.** Een polysynthetische taal kan miljoenen mogelijke woordvormen hebben voor één enkele werkwoordswortel. Geen enkel trainingskorpus, hoe groot ook, kan meer dan een klein deel ervan bevatten. Neurale modellen hebben geen manier om te *generaliseren* naar ongeziene vormen.

3. **Hallucinatie.** Grote taalmodellen genereren, wanneer gevraagd te vertalen naar polysynthetische talen, vaak morfologisch ongeldige vormen — woorden die geen moedertaalspreker ooit zou produceren. Het model heeft statistische patronen geleerd van beperkte data, maar heeft geen begrip van de morfologische regels van de taal.

### Eindige-Toestandstransducers: De Brug

Er is echter een technologie die morfologische complexiteit *wel* goed aankan: de **Eindige-Toestandstransducer** (FST). Een FST is een formeel computationeel apparaat dat via een reeks toestandsovergangen mapt tussen een invoerreeks en een uitvoerreeks. Voor morfologische analyse kan een FST een oppervlaktewoordvorm mappen naar zijn onderliggende morfologische structuur (en vice versa), waarbij de volledige combinatorische complexiteit van de morfologie van de taal wordt afgehandeld.

FST's zijn de directe nakomelingen van Pāṇini's herschrijfregels. Het zijn Chomsky's Type 3 (reguliere) grammatica's in computationele vorm. Ze zijn de levende belichaming van de verbinding tussen formele taalkunde en berekening.

Bij het koppelen van FST's aan LLM's voert `champollion` een cruciale filosofische synthese uit: het verzoent de *rationalistische* structurele traditie (regels) met het *empiristische* statistische paradigma (kansen) om de datahongerige, majoritaire biases van moderne AI tegen te gaan.

Voor polysynthetische talen kunnen FST's iets bieden wat neurale modellen niet kunnen: *deterministische verificatie*. Gegeven een woordvorm kan een FST definitief zeggen of het een geldige vorm in de taal is — niet probabilistisch, niet "dit ziet er goed uit," maar *ja* of *nee*. Dit is het antwoord op de kernvraag die neurale MT voor laagresource-talen achtervolgt: *Hoe verifieert u dat een gegenereerd woord echt is zonder een mens in de lus?*

Het technische antwoord is: u gebruikt de formele grammatica. U gebruikt de zeer instrumenten die Pāṇini vijfentwintig eeuwen geleden uitvond, gecodeerd in het computationele formalisme dat Turing en Chomsky rigoureus maakten.

We moeten echter erkennen dat deze deterministische kracht zijn eigen risico's met zich meebrengt. Het opleggen van een "ja" of "nee" validatie aan een mondelinge, vloeiende taal riskeert een rigide Standaardtaalideologie op te leggen. Wanneer een FST dicteert wat "correct" is, kan het onbedoeld de koloniale normativiteit recapituleren die het was ontworpen te omzeilen — dialectale variatie afvlakkend, code-switching bestraffend en een enkelvoudige, genormaliseerde grammatica opleggen aan een diverse gemeenschap. Omdat FST's slechts één maatstaf van formele correctheid vertegenwoordigen, moet hun rigide empirisme worden getemperd. Dit is precies waarom de gemeenschap de pen moet vasthouden. De gemeenschap stelt de norm, bouwt de regels en definieert wat de machine als geldig accepteert, waarbij FST's worden ontworpen die ruimte creëren voor mondelinge vloeibaarheid en regionale dialecten. De formele grammatica is geen universele waarheid die door informatici wordt overgedragen; het is een infrastructuur die wordt beheerd door de sprekers zelf.

### champollion: Waar de Draden Convergeren

Dit is waar het champollion-project het verhaal betreedt. Het bevindt zich op het exacte convergentiepunt van alle draden die we hebben getraceerd:

- **Van Pāṇini**: Het principe dat taal beschreven kan worden door formele, generatieve regels.
- **Van Schleicher en Sapir**: Het begrip dat de talen van de wereld divers, gestructureerd en vaak bedreigd zijn.
- **Van de residentiële scholen en hun nasleep**: Het begrip dat "dataschaarsheid" geen neutraal technisch feit is, maar de consequentie van doelbewuste taalonderdrukking — en dat elke technologie die deze talen aanraakt, moet worden gebouwd met soevereiniteit als fundament.
- **Van Chomsky**: De formele hiërarchie van grammatica's die taalkunde verbindt met berekening.
- **Van Shannon**: Het wiskundige kader voor het begrijpen van communicatie, ruis en signaal.
- **Van Turing en von Neumann**: De universele machines die elke berekenbare functie kunnen uitvoeren.
- **Van Weaver en de IBM-modellen**: Het inzicht dat vertaling behandeld kan worden als een statistisch probleem.
- **Van de Transformer-revolutie**: De krachtige neurale modellen die kunnen vertalen — maar alleen wanneer ze genoeg data hebben.
- **Van de FST-traditie**: De formele instrumenten die morfologische complexiteit kunnen afhandelen waar neurale modellen falen.
- **Van de First Nations-datasoevereiniteitsprincipes, CARE en Te Mana Raraunga**: De governancekaders die ervoor zorgen dat technologie gemeenschappen dient in plaats van van hen te extraheren.

champollion is een platform ontworpen om de competitieve energie van de machine learning-gemeenschap te richten op talen die de markt heeft verlaten. Het biedt een benchmarkinginfrastructuur waar iedereen een vertaalmethode kan indienen — neuraal, regelgebaseerd, hybride of nieuw — en deze kan laten evalueren aan de hand van rigoureuze normen. Cruciaal is dat het FST-gebaseerde validatie gebruikt om ervoor te zorgen dat gegenereerde vormen morfologisch geldig zijn, en het vertrouwt op verificatie door moedertaalsprekers als de ultieme grondwaarheid.

Het platform belichaamt verschillende principes die deze geschiedenis duidelijk maakt:

**Geen enkele aanpak is voldoende.** De geschiedenis van MT is een geschiedenis van paradigmaverschuivingen — van regels naar statistieken naar neurale netwerken. Elk nieuw paradigma loste problemen op die het vorige niet kon, maar elk had ook blinde vlekken. Voor laagresource polysynthetische talen is het antwoord vrijwel zeker *hybride*: neurale vloeiendheid beperkt door formele correctheid.

**Datasoevereiniteit is niet optioneel — het is een structurele reactie op historische schade.** Zoals Sectie V in detail documenteert, zijn inheemse talen niet zomaar per ongeluk "data-schaars". Ze zijn schaars gemaakt door doelbewust beleid. Het soevereiniteits-aspirant ontwerp van het project — dat ervoor zorgt dat taalgegevens onder de controle van inheemse gemeenschappen blijven, dat decryptiesleutels in het beheer zijn van gemeenschapstrusts, dat het eigendom van algoritmen overgaat op de sprekers — is geen bijgedachte. Het is een directe reactie op eeuwenlange extractieve praktijken, van documentatie door buitenstaanders uit het tijdperk van de 'residential schools' tot het hedendaagse schrapen van datasets.

Een eerdere versie van deze alinea stelde dat de architectuur het herhalen van die patronen *technisch onmogelijk* maakt. Dat was een overdreven bewering en deze is ingetrokken. De mechanismen zijn reëel en specifiek — een corpus wordt versleuteld op het eigen apparaat van de houder voordat er iets wordt verzonden, voor ontsleuteling moeten meerdere beheerders samenwerken in plaats van één enkele partij, en de inhoud van het corpus wordt opgehaald bij de bron in plaats van hier te worden gehost — maar "onmogelijk" is geen eigenschap die een van hen kan dragen. Software bevat bugs, operators maken fouten, en een vastberaden partij met voldoende van de juiste rollen vormt een restrisico dat door geen enkel ontwerp wordt weggenomen. De eerlijke bewering is dat de makkelijke wegen zijn afgesloten en de moeilijke wegen sporen achterlaten. Wat dit project kan beloven is mechanisme en openbaarmaking, geen onmogelijkheid.

**Het lange spel is revitalisering.** Vertaling is het *bewijs*, maar de echte prijs is taalrevitalisering door onderwijs. De formele grammatica's en morfologische modellen die zijn gebouwd voor machinevertaling zijn precies de technische fundamenten die nodig zijn voor machinaal ondersteund taalleren. Als we een FST kunnen bouwen die Cree-werkwoordsvormen valideert voor een vertaalsysteem, kunnen we die FST ook gebruiken om een student te helpen Cree-werkwoorden te vervoegen.

### Waarom Dit Moment

We leven in een uniek moment in de geschiedenis van taaltechnologie. Verschillende factoren zijn geconvergeerd:

1. **Open-source tools zijn volwassen.** De FST-toolkits (zoals HFST en Foma), de neurale MT-frameworks (zoals OpenNMT en Fairseq) en de evaluatie-infrastructuur kunnen nu door een klein team worden samengesteld tegen minimale kosten.

2. **Gemeenschapsorganisatie versnelt.** Inheemse taalgemeenschappen zijn steeds geavanceerder in hun gebruik van technologie en hun bevestiging van datasouvereiniteit. Organisaties zoals het First Voices-initiatief, het Canadian Indigenous Languages Technology Project en talrijke door de gemeenschap geleide inspanningen bouwen de menselijke infrastructuur die technologie alleen niet kan bieden.

3. **AI-mogelijkheden hebben een drempel bereikt.** Grote taalmodellen, hoewel op zichzelf onvoldoende voor laagresource-MT, kunnen dienen als krachtige componenten in hybride systemen — kandidaatvertalingen genereren die vervolgens worden geverifieerd en beperkt door formele methoden.

4. **De kosten zijn ingestort.** Wat in 1954 een overheidslaboratorium of in 2000 een grote onderneming zou hebben vereist, kan nu worden gedaan met cloud computing-credits en open-source software. De bottleneck is niet langer technologie of geld. Het is *wil*.

De vraag is niet of de technologie gebouwd kan worden. Dat kan. De vraag is of het *correct* zal worden gebouwd — met de juiste governance, de juiste prikkels en het juiste respect voor de gemeenschappen die het bedoeld is te dienen.

Dat is de vraag waarvoor dit project bestaat om te beantwoorden.

---

## Referenties

- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.

---

*Dit document maakt deel uit van de champollion-projectdocumentatie. Het wordt uitgebracht onder dezelfde licentie als het project zelf.*

---


## Waar dit toe leidt op deze site

De geschiedenis eindigt waar dit project begint: de meeste levende talen vallen nog steeds
buiten de technologie. [Wat Champollion is](/docs/what-is-champollion)
beschrijft het plan in vijf minuten, en
[hoe de dekking wordt geteld](/docs/network/context/coverage-counting) laat
precies zien waar de grens vandaag de dag ligt.
