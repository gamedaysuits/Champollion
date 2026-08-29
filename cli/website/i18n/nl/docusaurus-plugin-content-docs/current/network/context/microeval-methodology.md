---
sidebar_position: 4
title: "Microeval: Taalspecifieke Evaluatie voor Machinevertaling"
slug: '/network/context/microeval-methodology'
---

# Microeval: Taalspecifieke Evaluatiemetrieken voor Machinevertaling

***Een methodologie voor het bouwen van evaluatiemetrieken op maat van afzonderlijke talen met behulp van FST's, woordenboeken en door taalkundigen samengestelde equivalentieregels — en waarom het vakgebied dit nodig heeft***

---

> *"De grenzen van mijn taal betekenen de grenzen van mijn wereld."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Inleiding

De gemeenschap voor evaluatie van machinevertaling heeft twee decennia gezocht naar universele metrieken — maatstaven voor vertaalkwaliteit die werken voor alle talen, alle domeinen en alle typologieën. Deze zoektocht heeft opmerkelijke instrumenten opgeleverd: BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). Voor de ~20 talen die de WMT shared tasks domineren, werken deze instrumenten.

Voor de overige ~7.000 talen werken ze niet.

Dit artikel betoogt dat **de zoektocht naar universele metrieken, wanneer toegepast op talen met weinig middelen en morfologisch complexe talen, niet alleen onvolledig is — het is het verkeerde paradigma**. Wij stellen **microeval** voor: een methodologie voor het bouwen van evaluatiemetrieken op maat van afzonderlijke talen, gebruikmakend van de beste beschikbare taalkundige instrumenten — eindige-toestandstransducers, tweetalige woordenboeken, morfologische analysatoren en door taalkundigen samengestelde equivalentieregels.

Microeval is geen metriek. Het is een *praktijk* — een systematisch proces voor het opbouwen van evaluatie-infrastructuur die taalspecifieke kennis codeert. De praktijk produceert metrieken, die wij verzamelen onder de frameworknaam **LYSS** (Linguistically-informed Yield & Structural Scoring). Maar de bijdrage is de methodologie, niet een specifieke metriek die deze voortbrengt.

Dit document is een aanvulling op:
- [Measuring the Immeasurable](/docs/network/context/mt-evaluation-landscape) — het overzicht van het evaluatielandschap, dat LYSS positioneert tussen bestaande metrieken
- [The Scoring Specification](/docs/network/specifications/scoring) — de technische specificatie voor metriekdefinities, gewichten en samengestelde scores
- [The Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) — de praktische werkwijze voor het opzetten van evaluatiecorpora

Die documenten beschrijven *wat* LYSS is en *waar* het past. Dit document behandelt de diepere vragen: *Waarom* is taalspecifieke evaluatie noodzakelijk? *Hoe* bouwt u dit voor een nieuwe taal? En *wie* bepaalt wat als "correct" geldt?

---

## Deel 1: Waarom Universele Metrieken Falen bij Talen met Weinig Middelen

### 1.1 De Universaliteitsaanname

Elke grote MT-evaluatiemetriek sinds BLEU berust op een impliciete aanname: dat de *mechanismen* van vertaalkwaliteit taalagnostisch zijn, ook al verschillen de *parameters*. BLEU telt n-gram-overlap. chrF++ telt karakter-n-gram-overlap. COMET traint een regressiemodel op menselijke oordelen. Alle aannames veronderstellen dat de signaalstructuur — wat een vertaling "goed" maakt — kan worden vastgelegd door een taalagnostisch algoritme, mogelijk verfijnd op taalspecifieke gegevens.

Voor Europese taalparen met veel middelen houdt deze aanname goed stand. WMT-metrieken shared tasks tonen een hoge correlatie met menselijke oordelen voor Engels↔Duits, Engels↔Tsjechisch, Engels↔Chinees. De metrieken zijn het oneens over randgevallen, maar zijn het eens over de verdeling van kwaliteit.

Voor polysynthetische talen zoals Plains Cree (nêhiyawêwin) valt de aanname op meerdere niveaus uiteen:

**Morfologische ondoorzichtigheid.** Eén enkel Cree-werkwoord kan evenveel informatie bevatten als een volledige Engelse bijzin. Het woord *nikî-wîcihâw* ("ik hielp hem/haar") codeert persoon, getal, animaatheid, richting en tijd in één vervoegde vorm. Een n-gram-metriek ziet één token; een morfologische analysator ziet zes morfemen. Oppervlaktemetrieken kunnen geen onderscheid maken tussen een correct vervoegd werkwoord en een aannemelijk ogende hallucinatie die animaatheidscongruentie schendt — beide zijn enkelvoudige tokens van vergelijkbare tekenlengte.

**Vrije woordvolgorde.** Cree heeft pragmatisch vrije woordvolgorde (Wolfart, 1973, §3.2). De zinnen *atim niwâpamâw* en *niwâpamâw atim* ("ik zie de hond") zijn beide grammaticaal correct — de keuze is pragmatisch, niet syntactisch. Elke metriek die afwijkingen van de woordvolgorde ten opzichte van een referentievertaling bestraft, zal voor elk dergelijk paar valse negatieven genereren.

**Morfologische equivalentie.** Cree heeft meerdere geldige orthografische representaties van hetzelfde woord (SRO-varianten, progressieve/klinkerlengte-alternaties). De vertalingen *nikî-atoskân* en *nikî-atoskên* kunnen dialectaal equivalent zijn. Een tekenreeksvergelijkingsmetriek ziet twee verschillende tekenreeksen; een taalkundige ziet hetzelfde woord.

**Afwezigheid van trainingsgegevens.** Neurale metrieken zoals COMET vereisen trainingsgegevens — menselijke kwaliteitsoordelen over vertaalparen — om te leren wat "goed" betekent. Voor Cree bestaan deze gegevens niet. COMET kan nog steeds scores produceren (het valt terug op zijn meertalige encoder), maar die scores zijn niet gevalideerd aan de hand van de kwaliteitsoordelen van een Cree-sprekende mens. Het zijn extrapolaties van Europese taalpatronen, toegepast op een taal met een fundamenteel andere structuur.

### 1.2 De Paradox van Evaluatie bij Talen met Weinig Middelen

Dit leidt tot een paradox:

> De talen die machinevertaling het dringendst nodig hebben, zijn precies de talen waarvoor de beste evaluatie-instrumenten het minst betrouwbaar zijn.

Als we de vertaalkwaliteit voor deze talen niet kunnen meten, kunnen we niet:
- Vertaalmethoden objectief vergelijken
- Detecteren wanneer een model aannemelijk ogende onzin hallucineert
- Bijhouden of het vakgebied vooruitgang boekt
- Aanbieders van MT-systemen verantwoordelijk houden voor kwaliteitsclaims

Het resultaat is een **cascerend falen**: geen trainingsgegevens → geen encoderdekking → geen gevalideerde evaluatie → geen meetbare vooruitgang → geen stimulans om te investeren → geen trainingsgegevens.

Het doorbreken van deze cyclus vereist evaluatiemethoden die niet afhankelijk zijn van de middelen die we niet hebben (trainingsgegevens, menselijke oordelen op schaal, verfijnde neurale encoders). Het vereist methoden die gebruikmaken van de middelen die we *wel* hebben.

### 1.3 Wat We Wel Hebben

Voor veel talen met weinig middelen hebben decennia van taalkundig veldwerk instrumenten en middelen opgeleverd die de MT-evaluatiegemeenschap grotendeels heeft genegeerd:

| Bron | Wat het biedt | Dekking |
|----------|-----------------|----------|
| **Finite-State Transducers (FST's)** | Volledige morfologische analyse — elke geldige woordvorm in de taal | ~100+ talen via GiellaLT, Apertium, NRC |
| **Tweetalige woordenboeken** | Lemma-naar-glos-mappings | Honderden talen (Wolvengrey 2001 voor Cree: ongeveer 18.000–22.000 trefwoorden, afhankelijk van de editie en telmethode) |
| **Morfologische analyzers** | Part-of-speech tagging, lemmatisering, generatie van buigingsparadigma's | Tientallen talen met variërende dekking |
| **Beschrijvende grammatica's** | Regels met betrekking tot congruentie, woordvolgorde, animaciteit, obviatie | Beschikbaar voor de meeste gedocumenteerde talen |
| **Taalkundige expertise** | Gemeenschapsleden die correcte versus incorrecte vertalingen kunnen identificeren | Bestaat per definitie voor elke levende taal |

Deze middelen zijn door computationele taalkundigen, veldtaalkundigen en taalgemeenschappen over decennia opgebouwd — vaak zonder enige verbinding met de MT-evaluatiegemeenschap. De FST voor Plains Cree werd gebouwd aan de Universiteit van Alberta door Antti Arppe en collega's als een taaldocumentatie-instrument, niet als een evaluatiemetriek. De GiellaLT-infrastructuur bij UiT werd gebouwd voor minderheidstaaltechnologie, niet voor WMT shared tasks.

**Microeval is de praktijk van het omzetten van deze bestaande middelen in evaluatiemetrieken.**

---

## Deel 2: De Microeval-Methodologie

### 2.1 Definitie

**Microeval** is een systematische methodologie voor het bouwen van evaluatiemetrieken voor machinevertaling op maat van een specifieke taal, gebruikmakend van taalspecifieke taalkundige instrumenten en middelen. Een microeval-suite:

1. **Codeert taalspecifieke kennis** die niet kan worden vastgelegd door taalagnostische metrieken
2. **Maakt gebruik van bestaande taalkundige infrastructuur** (FST's, woordenboeken, grammatica's) in plaats van nieuwe trainingsgegevens te vereisen
3. **Produceert deterministische, interpreteerbare scores** — elke score is herleidbaar tot een specifiek taalkundig oordeel
4. **Is ontworpen door taalkundigen**, niet alleen door ingenieurs — de variantklassen, equivalentieregels en validatielogica weerspiegelen taalkundige expertise
5. **Complementeert in plaats van vervangt** universele metrieken — microeval vult de lacunes op, niet de gehele ruimte

### 2.2 De Drielaagse Architectuur

Een volledige microeval-suite werkt op drie analyseniveaus, van oppervlak naar semantiek:

| Laag | Beantwoorde vraag | Gebruikt instrument | LYSS-component |
|------|------------------|--------------------|--------------------|
| **Morfologische geldigheid** | "Is elk woord een geldige vorm in deze taal?" | Eindige-toestandstransducer (FST) | LYSS-fst |
| **Taalkundige equivalentie** | "Is deze vertaling een aanvaardbare variant van de referentie?" | Deterministische linter met door taalkundigen samengestelde variantklassen | LYSS-eq |
| **Semantische getrouwheid** | "Behoudt deze vertaling de betekenis van de bron?" | FST-lemmatisering + woordenboekglossen + overlap van inhoudswoorden | LYSS-sem |

Deze lagen zijn **cumulatief, niet alternatief**. Een vertaling moet alle drie doorstaan om als volledig correct te worden beschouwd. Een gehallucineeerd woord faalt op Laag 1. Een dialectale variant die correct is maar afwijkt van de referentie, wordt opgevangen op Laag 2. Een vertaling die geldige woorden in een geldige volgorde gebruikt maar iets anders betekent, wordt opgevangen op Laag 3.

### 2.3 Hoe u een Microeval-Suite Bouwt voor een Nieuwe Taal

In dit gedeelte wordt het stapsgewijze proces beschreven. Wij gebruiken Plains Cree (CRK) als uitgewerkt voorbeeld en generaliseren waar mogelijk.

#### Stap 1: Beschikbare Middelen Inventariseren

Voordat u iets bouwt, inventariseert u wat er bestaat:

| Middel | Vereist voor | Hoe te vinden | Minimale kwaliteit |
|--------|-------------|---------------|-------------------|
| FST | Laag 1 (LYSS-fst) | Raadpleeg GiellaLT-, Apertium- en NRC-catalogi | Moet >90% van de geldige woordvormen in een testcorpus accepteren |
| Tweetalig woordenboek | Laag 3 (LYSS-sem) | Raadpleeg taaldocumentatieprojecten, Wiktionary, gemeenschapsmiddelen | >5.000 vermeldingen met lemma-naar-gloss-koppelingen |
| Beschrijvende grammatica | Laag 2 (LYSS-eq) | Gepubliceerde grammatica's, scripties, door de gemeenschap geschreven naslagwerken | Moet de kernmorfologische paradigma's documenteren |
| Tweetalige sprekers | Alle lagen (validatie) | Gemeenschapscontacten, universitaire taalprogramma's | Minimaal 3 sprekers voor validatie-experimenten |

**Als er geen FST bestaat:** Sla Laag 1 over. De suite werkt alleen op Lagen 2–3, of valt terug op universele metrieken (Profiel B in LYSS-scoring). Dit is niet ideaal, maar beter dan niets.

**Als er geen woordenboek bestaat:** Sla Laag 3 over of gebruik een beperkte versie met de beschikbare woordenschat. Een woordenboek met 500 vermeldingen is minder nuttig dan een met 18.000 vermeldingen, maar biedt nog steeds een signaal.

#### Stap 2: De Morfologische Geldigheidspoort Configureren (LYSS-fst)

Als er een FST beschikbaar is:

1. **Installeer de FST** met behulp van het analysatorbinaire bestand van de taal (HFST `.hfstol`-formaat voor GiellaLT)
2. **Voer een dekkingstest uit** op een representatief corpus: welk percentage van de tokens herkent de FST?
3. **Bouw een acceptatielijst** voor verwachte FST-lacunes: leenwoorden, eigennamen, neologismen, afkortingen
4. **Bereken de basiswaarde voor het valse-afwijzingspercentage** — het percentage geldige woorden dat de FST ten onrechte afwijst
5. **Stel de scoredrempel in** — onder welk FST-acceptatiepercentage markeren we een vertaling als morfologisch verdacht?

De sleutelmetriek is `fst_acceptance_rate`: het aandeel uitvoerwoorden dat de FST herkent. Een percentage van 0,85 betekent dat 85% van de woorden geldige Cree-morfologie heeft; 15% is ofwel ongeldig, een leenwoord, of valt buiten de FST-dekking.

**Kritische ontwerpbeslissing:** Het valse-afwijzingsprobleem. Een FST getraind op formeel literair Cree zal geldige spreektaalvormen afwijzen. Een FST met onvolledige paradigmadekking zal geldige maar zeldzame verbuigingen afwijzen. De acceptatielijst beperkt dit, maar kan het niet elimineren. *Dit is waarom LYSS-fst alleen niet voldoende is* — het moet worden gecombineerd met Lagen 2 en 3.

#### Stap 3: De Variantklassen Ontwerpen (LYSS-eq)

Dit is de meest taalkundig veeleisende stap en kan niet worden geautomatiseerd. Een taalkundige met expertise in de doeltaal moet identificeren:

**Welke soorten verschillen tussen een kandidaatvertaling en een referentievertaling als "aanvaardbaar" moeten worden beschouwd?**

Voor Plains Cree hebben wij zes variantklassen geïdentificeerd:

| Variantklasse | Taalkundige basis | Voorbeeld |
|--------------|------------------|---------|
| `WORD_ORDER` | Pragmatisch vrije woordvolgorde (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | SRO-spellingvarianten, klinkerlengte-alternatie | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Grammaticaal optionele discourspartikels | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | In het woordenboek geattesteerde synoniemen | *wâpamêw* ≡ *kanawâpamêw* (voor "ziet") |
| `PROGRESSIVE_AMBIGUITY` | Meerdere geldige progressieve vormen | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | Eerste-persoon meervoud onderscheid niet aanwezig in het Engels | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Deze klassen zijn taalspecifiek.** Een andere taal zou andere klassen hebben — het Turks zou klassen kunnen hebben voor klinkerharmonievarianten, het Japans voor honorifieke registeralternatie, het Inuktitut voor dialectale suffixvariatie.

**Het ontwerpproces:**
1. Verzamel 100+ vertaalparen (bron + referentie + kandidaat)
2. Identificeer alle gevallen waarin de kandidaat verschilt van de referentie, maar een tweetalige spreker deze als correct zou beschouwen
3. Categoriseer de verschillen — zoek naar patronen die in meerdere paren terugkeren
4. Formaliseer elk patroon als een deterministische regel (reguliere expressie, verzamelingsoperatie of FST-transductie)
5. Valideer met 3+ tweetalige sprekers: zijn zij het erover eens dat elke variantklasse aanvaardbaar is?
6. Itereer: sommige klassen zullen verfijning nodig hebben, andere zullen moeten worden gesplitst of samengevoegd

#### Stap 4: De Semantische Validator Bouwen (LYSS-sem)

De semantische validator beantwoordt de vraag: "Betekent deze vertaling hetzelfde als de referentie?" De validator werkt in vier fasen:

1. **Lemmatiseer beide vertalingen** met behulp van de FST (extraheer grondvormen, verwijder verbuiging)
2. **Koppel lemma's aan glossen** met behulp van het tweetalige woordenboek (Cree-lemma → Engelse gloss)
3. **Vergelijk de glossenverzamelingen** — overlappen de glossen van de kandidaat met die van de referentie?
4. **Controleer structurele beperkingen** — schendt de kandidaat bekende grammaticaregels (animaatheidscongruentie, werkwoordvorm, persoonmarkering)?

De validator produceert oordelen: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Elk oordeel is deterministisch en herleidbaar — u kunt uitleggen *waarom* een vertaling een bepaald oordeel heeft ontvangen door te onderzoeken welke fase het heeft gemarkeerd.

**Minimaal levensvatbare versie:** Als u een FST en een woordenboek heeft, kunt u een vereenvoudigde semantische validator bouwen die alleen lemma-gloss-overlap uitvoert (fasen 1–3). Fase 4 (grammaticacontrole) vereist meer taalkundige engineering, maar voegt aanzienlijke waarde toe voor morfologisch complexe talen.

#### Stap 5: Integreren met het Evaluatieraamwerk

De microeval-suite wordt verpakt als een set metriekplug-ins die aansluiten op het evaluatieraamwerk:

1. Elke metriek implementeert het `MetricPlugin`-protocol: `compute(entry) → dict`, `aggregate(results) → dict`
2. Het plug-in-detectiesysteem detecteert automatisch taalspecifieke plug-ins op basis van de doeltaalcode
3. Scores worden doorgegeven aan de samengestelde scorefunctie, die microeval-metrieken combineert met universele metrieken via taalspecifieke gewichtsprofielen

### 2.4 Minimaal Levensvatbare Microeval

Niet elke taal heeft onmiddellijk alle drie de lagen nodig. Hieronder vindt u de minimaal nuttige configuratie op elk niveau:

| Configuratie | Wat u nodig heeft | Wat u krijgt | Bouwtijd |
|-------------|------------------|-------------|----------|
| **Alleen LYSS-fst** | FST + acceptatielijst | Morfologische geldigheidspoort — vangt gehallucineeerde woordvormen op | 1–2 weken |
| **LYSS-fst + LYSS-eq** | FST + 3–6 variantklassen + taalkundige tijd | Geldigheidspoort + equivalentiedetectie — vermindert valse negatieven | 4–8 weken |
| **Volledige LYSS** | FST + variantklassen + woordenboek + semantische validator | Volledige taalspecifieke evaluatie | 8–16 weken |

De aanbeveling is om te beginnen met LYSS-fst (snel, grote impact, vereist alleen een FST die waarschijnlijk al bestaat) en lagen incrementeel toe te voegen.

---

## Deel 3: Het Valse-Afwijzingsprobleem

### 3.1 Wat het Is

Elke microeval-metriek heeft een valse-afwijzingspercentage: de kans dat een correcte vertaling als incorrect wordt gescoord.

Voor LYSS-fst treedt valse afwijzing op wanneer:
- De FST een geldige woordvorm niet dekt (onvolledige paradigmatafels)
- De vertaling een leenwoord bevat dat de FST niet herkent
- De vertaling een neologisme of merknaam gebruikt
- De vertaling een dialectale vorm gebruikt die niet in het lexicon van de FST staat
- De vertaling een eigennaam bevat die niet op de acceptatielijst staat

Voor LYSS-eq treedt valse afwijzing op wanneer:
- De vertaling een aanvaardbare variant gebruikt die niet door een variantklasse wordt gedekt
- Een nieuwe variantklasse nodig is maar nog niet is geïdentificeerd

Voor LYSS-sem treedt valse afwijzing op wanneer:
- Een lemma niet in het woordenboek staat
- Een geldige vertaling een parafrasestrategie gebruikt die niet overeenkomt met de lemmaset van de referentie

### 3.2 Waarom het Ernstiger is dan Valse Acceptatie

Bij evaluatie is valse afwijzing erger dan valse acceptatie. Een valse afwijzing betekent dat een *correcte* vertaling als *fout* wordt gescoord — dit ontmoedigt bouwers die goed werk leveren, en het ondermijnt het vertrouwen in de metriek. Een valse acceptatie betekent dat een *foute* vertaling als *correct* wordt gescoord — dit is slecht, maar wordt opgevangen door andere metrieken in de samengestelde score.

Valse afwijzing accumuleert: als LYSS-fst een valse-afwijzingspercentage van 10% per woord heeft, en een zin heeft 5 woorden, dan is de kans dat ten minste één woord vals wordt afgewezen ~41%. Dit betekent dat bijna de helft van alle zinnen een verlaagd FST-acceptatiepercentage zal hebben voor ten minste één woord — niet omdat de vertaling fout is, maar omdat de FST onvolledig is.

### 3.3 Mitigatiestrategieën

| Strategie | Mechanisme | Effectiviteit |
|----------|----------|---------------|
| **Acceptatielijsten** | Bekende leenwoorden, eigennamen en afkortingen op de witte lijst plaatsen | Hoog voor bekende lacunes, nul voor onbekende lacunes |
| **Fuzzy matching** | Woorden accepteren binnen een bewerkingsafstand van 1 van een bekende vorm | Vangt typefouten en kleine orthografische varianten op |
| **Betrouwbaarheidsscoring** | FST-resultaten wegen naar volledigheid van het paradigma | Vereist metagegevens over paradigmadekking |
| **Categoriespecifieke drempelwaarden** | Verschillende drempelwaarden voor verschillende domeinen (medisch kan meer leenwoorden bevatten) | Vereist domeingelabelde corpora |
| **Door de gemeenschap onderhouden acceptatielijsten** | Sprekers dienen woorden in die de FST zou moeten accepteren | Meest duurzaam op lange termijn; vereist infrastructuur voor gemeenschapsbetrokkenheid |

### 3.4 Het Percentage Meten

Het valse-afwijzingspercentage moet empirisch worden gemeten op een representatief corpus:

1. Neem een corpus van 500+ bekende geldige Cree-zinnen (leerboeken, beoordeelde vertalingen)
2. Voer elk woord door de FST
3. Laat voor elk woord dat de FST afwijst een tweetalige spreker het classificeren: geldig woord dat de FST heeft gemist, of werkelijk ongeldig?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Deze meting is een van de vereiste validatie-experimenten (Scoring Spec §1.6).

---

## Deel 4: Wie Bepaalt wat "Correct" Is?

### 4.1 De Politieke Dimensie van Evaluatie

Evaluatiemetrieken zijn geen neutrale instrumenten. Elke metriek bevat een theorie over wat "correcte vertaling" betekent, en die theorie heeft consequenties:

- Een FST gebouwd op literair Cree zal spreektaal-Cree bestraffen. Dit is een *politieke* keuze over welk register van de taal wordt gewaardeerd.
- Een variantklasse die één dialectale vorm accepteert maar een andere niet, standaardiseert de taal impliciet. Standaardisering is een politieke daad met een lange koloniale geschiedenis.
- Een semantische validator die exacte lemma-overlap vereist, bestraft creatieve parafrase — een belangrijke vertaalstrategie die bekwame vertalers bewust toepassen.

Microeval maakt deze keuzes *expliciet*. Elke variantklasse, elke acceptatielijstvermelding, elke semantische equivalentieregel is een discrete, gedocumenteerde, controleerbare beslissing. Dit is een voordeel, geen nadeel: het betekent dat de gemeenschap de regels die bepalen hoe hun taal wordt geëvalueerd, kan inspecteren, betwisten en aanpassen.

### 4.2 Gemeenschapsbestuur van Evaluatieregels

Voor inheemse talen in het bijzonder moeten evaluatiebeslissingen worden bestuurd door de taalgemeenschap, niet door externe onderzoekers of ingenieurs. Dit is niet alleen een ethisch principe (hoewel het dat ook is) — het is een correctheidsvereiste. Alleen vloeiende sprekers kunnen bepalen of een variant aanvaardbaar is.

Het bestuursmodel:

1. **Onderzoekers stellen** variantklassen, acceptatielijstvermeldingen en semantische regels voor op basis van taalkundige analyse
2. **Sprekers beoordelen** elk voorstel en keuren het goed, wijzen het af of passen het aan
3. **Goedgekeurde regels** worden vastgelegd in de codebase met vermelding van de spreker
4. **Betwiste regels** worden gemarkeerd voor gemeenschapsdiscussie — ze worden uitgesloten van scoring totdat ze zijn opgelost
5. **De gemeenschap kan** elke regel op elk moment intrekken door deze uit de goedgekeurde set te verwijderen

Dit model vereist infrastructuur (het evaluatieraamwerk, versiebeheer, het sprekervalidatieprotocol) en relaties (vertrouwen tussen onderzoekers en gemeenschapsleden). Het opbouwen van deze infrastructuur maakt deel uit van de microeval-methodologie.

### 4.3 Dialectale Variatie

De moeilijkste bestuursvraag: wanneer twee dialecten van een taal het oneens zijn over een vorm, welke is dan "correct"?

Het antwoord van microeval: **beide zijn correct.** Dialectale varianten worden weergegeven als aanvullende variantklassen met dialectlabels. De samengestelde score kan per dialect of over dialecten heen worden berekend, afhankelijk van wat de evaluatie probeert te meten.

Dit vereist dat het corpus dialectgelabeld is en dat de variantklassen dialectbewust zijn. Het vereist ook dat sprekers uit meerdere dialecten deelnemen aan validatie. Het document over de Corpus Partnership Strategy behandelt deze vereisten.

---

## Deel 5: Relatie tot Eerder Werk

### 5.1 Wat Microeval NIET Is

| Claim die wij NIET maken | Waarom niet |
|------------------------|---------|
| "Universele metrieken zijn nutteloos" | Ze bieden essentiële basislijnen en vergelijkbaarheid tussen talen. Microeval vult aan, vervangt niet. |
| "Neurale metrieken kunnen niet werken voor talen met weinig middelen" | Dat kunnen ze — met verfijning op taalspecifieke gegevens. Maar die gegevens bestaan zelden. Microeval werkt *nu*. |
| "FST-gebaseerde evaluatie is nieuw" | FST's worden al decennia gebruikt in NLP. De nieuwigheid zit in het systematisch inzetten ervan als MT-evaluatiemetrieken. |
| "LYSS is beter dan COMET" | Dat weten we niet — de vereiste studie naar correlatie met menselijke oordelen is niet uitgevoerd. Wij geloven dat LYSS *informatiever* is voor polysynthetische talen, maar we kunnen niet beweren dat het *nauwkeuriger* is totdat we bewijs hebben. |

### 5.2 Nauwst Verwant Eerder Werk

| Werk | Relatie tot Microeval |
|------|--------------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Contrastieve tests voor morfologische verschijnselen — complementair. MorphEval test of systemen morfologie *kunnen* produceren; LYSS test of ze dat *hebben gedaan*. |
| **CheckList** (Ribeiro et al., 2020) | Gedragstestmethodologie voor NLP — analoog paradigma. CheckList is een methodologie; microeval is ook een methodologie, toegepast op evaluatie in plaats van testen. |
| **HyTER** (Dreyer & Marcu, 2012) | Betekenisequivalente roosters — nauwste conceptuele parallel met LYSS-eq. HyTER somt parafrases op; LYSS-eq somt morfologische varianten op. HyTER vereist handmatige roosterbouw per zin; LYSS-eq-regels gelden voor het gehele corpus. |
| **Apertium-dekking** | Gebruikt FST-dekking als proxy voor MT-uitvoerkwaliteit — anticipeert direct op LYSS-fst. Niet geformaliseerd als metriek of geïntegreerd in een scoreraamwerk. |
| **FUSE** (AmericasNLP 2025) | Op kenmerken gebaseerde evaluatie voor inheemse Amerikaanse talen — meest verwant in geest. FUSE stelt taalkundige kenmerken voor als evaluatiedimensies; LYSS implementeert specifieke kenmerken voor specifieke talen. Een directe vergelijking is nodig. |
| **AfriCOMET** (Wang & Adelani, 2024) | Verfijnde COMET voor Afrikaanse talen — toont aan dat neurale metrieken *kunnen* worden aangepast. Microeval is het regelgebaseerde complement voor talen waarvoor verfijningsgegevens niet bestaan. |

### 5.3 Het Belangrijkste Onderscheid

Al het eerdere werk op het gebied van morfologiebewuste evaluatie:
1. **Stelt een algemeen raamwerk voor** zonder het voor specifieke talen te implementeren (FUSE, CheckList)
2. **Implementeert voor talen met veel middelen** waarvoor trainingsgegevens bestaan (MorphEval richt zich op Europese taalparen)
3. **Verfijnt neurale metrieken** waarvoor de gegevens die wij niet hebben vereist zijn (AfriCOMET)

Microeval is specifiek ontworpen voor het geval waarbij:
- Taalkundige instrumenten (FST's, woordenboeken) bestaan
- Trainingsgegevens voor verfijning van neurale metrieken niet bestaan
- De morfologische complexiteit van de taal oppervlaktemetrieken versloeg
- De evaluatie *nu* operationeel moet zijn, niet na een gegevensverzamelingscampagne

---

## Deel 6: Open Vragen en Eerlijke Beperkingen

### 6.1 Onopgeloste Vragen

1. **Correleren LYSS-metrieken met menselijke kwaliteitsoordelen?** Dat weten we niet. De vereiste studie naar correlatie met menselijke oordelen (200+ zinsparen, 3+ tweetalige sprekers) is niet uitgevoerd. Totdat dit is gedaan, zijn LYSS-scores technische schattingen, geen gevalideerde kwaliteitsmetingen.

2. **Hoe gedragen LYSS-metrieken zich naarmate talen veranderen?** Levende talen evolueren — nieuwe leenwoorden, verschuivende dialecten, opkomende neologismen. FST's en variantklassen moeten worden onderhouden. Wat is de onderhoudsbelasting? Dat weten we niet.

3. **Wat is de minimale FST-kwaliteit voor nuttige LYSS-fst?** Als een FST slechts 60% van het lexicon dekt, is LYSS-fst dan nog steeds nuttig, of overstemt het ruis het signaal? We hebben empirisch bewijs nodig.

4. **Kan microeval werken voor niet-morfologische uitdagingen?** Talen met tonale onderscheidingen, klikmedeklinkers of logografische schriften brengen evaluatie-uitdagingen met zich mee die FST's niet aanpakken. Microeval is mogelijk niet van toepassing — of het vereist andere instrumenten.

5. **Hoe gaan we om met het koude-startprobleem?** Het bouwen van een microeval-suite vereist taalkundige expertise. Voor talen zonder actieve computationele taalkunde-gemeenschap: wie doet het werk?

### 6.2 Eerlijke Beperkingen van LYSS

| Beperking | Ernst | Mitigatie |
|-----------|-------|-----------|
| Geen correlatiegegevens met menselijke oordelen | 🔴 Kritiek | Vereist validatie-experiment #1 |
| Valse-afwijzingspercentage FST niet gemeten | 🔴 Kritiek | Vereist validatie-experiment #2 |
| Alleen geïmplementeerd voor één taal (CRK) | 🟡 Significant | Poort naar tweede taal (Noord-Sámi) gepland |
| Variantklassen kunnen onvolledig zijn | 🟡 Significant | Gemeenschapsreview + doorlopende toevoeging |
| Semantische validator vereist spaCy | 🟡 Significant | Optionele afhankelijkheid; elegante degradatie |
| Woordenboekdekking beïnvloedt kwaliteit LYSS-sem | 🟡 Significant | Minimale woordenboekgroottevereisten gedocumenteerd |
| Kan vloeiendheid of natuurlijkheid niet detecteren | 🟡 Significant | Vereist menselijke evaluatie of neurale metrieken |
| Vereist taalkundige expertise om uit te breiden | 🟡 Significant | Methodologiedocumentatie (dit artikel) verlaagt de drempel |

### 6.3 De Weg Vooruit

> *"Als we ons alleen richten op wat generaliseert, zullen we onvermijdelijk vergeten waar dat niet het geval is — en deze talen en al hun kennis en wijsheid verliezen."*

Microeval is geen oplossing voor het evaluatieprobleem. Het is een praktijk — een discipline van aandacht besteden aan wat elke taal uniek maakt, en die aandacht coderen in werkende code. De praktijk is arbeidsintensief, taalspecifiek en nooit af. Maar het produceert iets wat het universele-metriekenparadigma niet kan: evaluatie die de taal spreekt die het evalueert.

---

## Bijlage A: Sleutelpublicaties {#appendix-a-key-papers}

| Publicatie | Jaar | Bijdrage | Relevantie |
|-------|------|-------------|-----------|
| Papineni et al., "BLEU" | 2002 | Fundamentele n-gram-metriek | Universele basismetriek |
| Popović, "chrF++" | 2017 | Karakter-n-gram-metriek | Beste oppervlaktemetriek voor morfologisch rijke talen |
| Rei et al., "COMET" | 2020 | Neuraal evaluatieraamwerk | Universele neurale metriek |
| Dreyer & Marcu, "HyTER" | 2012 | Betekenisequivalente semantiek | Conceptuele voorganger van LYSS-eq |
| Burlot & Yvon, "MorphEval" | 2017 | Morfologische evaluatie | Contrastief morfologisch testen |
| Ribeiro et al., "CheckList" | 2020 | Gedragstesten voor NLP | Methodologisch paradigma |
| Sánchez-Cartagena & Toral, "MorphEval" | 2024 | Evaluatie van morfologische mogelijkheden | Nauwste diagnostisch complement |
| Wang & Adelani, "AfriCOMET" | 2024 | Aangepaste neurale metriek voor Afrikaanse talen | Toont de behoefte aan taalspecifieke evaluatie aan |
| Lindén et al., "HFST" | 2011 | Eindige-toestandsmorfologieraamwerk | Infrastructuur voor LYSS-fst |
| Wolfart, "Plains Cree" | 1973 | Definitieve Cree-grammatica | Taalkundige autoriteit voor CRK-microeval |
| Wolvengrey, "Cree: Words" | 2001 | Plains Cree-woordenboek | Middel ten grondslag aan LYSS-sem |
| Carroll et al., "CARE Principles" | 2020 | Bestuur van inheemse gegevens | Bestuurskader voor microeval |

## Bijlage B: Overzicht van LYSS-componenten

| Component | Metrieknaam | Wat het meet | Vereiste middelen | Implementatiestatus |
|-----------|------------|------------------|-------------------|-----------------------|
| LYSS-fst | `fst_acceptance_rate` | Morfologische geldigheid van uitvoerwoorden | GiellaLT FST | ✅ Operationeel (CRK) |
| LYSS-eq | `equivalent_match_rate` | Detectie van aanvaardbare varianten | Door taalkundigen samengestelde variantklassen | ✅ Operationeel (CRK, 6 klassen) |
| LYSS-sem | `semantic_score` | Betekenisbehoud via lemma-gloss-overlap | FST + tweetalig woordenboek + spaCy | ✅ Operationeel (CRK, vereist spaCy) |

## Bijlage C: Talen met GiellaLT FST-dekking

De volgende talen hebben FST's beschikbaar via GiellaLT en zijn kandidaten voor LYSS-fst-integratie:

<!-- Deze lijst moet worden aangevuld met actuele GiellaLT-dekkingsgegevens. -->
<!-- Zie: https://github.com/giellalt -->

| Taal | ISO 639-3 | FST-volwassenheid | LYSS-fst-haalbaarheid |
|----------|-----------|-------------|---------------------|
| Plains Cree | crk | Productie | ✅ Operationeel |
| Noord-Sámi | sme | Productie | 🟡 Gepland (eerste poort) |
| Zuid-Sámi | sma | Productie | 🟡 Kandidaat |
| Lule-Sámi | smj | Productie | 🟡 Kandidaat |
| Inari-Sámi | smn | Productie | 🟡 Kandidaat |
| Skolt-Sámi | sms | Productie | 🟡 Kandidaat |
| Fins | fin | Productie | 🟡 Kandidaat |
| Inuktitut | iku | Beta | 🟡 Beoordeling vereist |
| Baskisch | eus | Beta | 🟡 Beoordeling vereist |
| Welsh | cym | Beta | 🟡 Beoordeling vereist |
