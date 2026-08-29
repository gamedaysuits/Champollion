---
sidebar_position: 3
title: "Het Onmeetbare Meten"
---

# Het Meten van het Onmeetbare: Het Evaluatieprobleem in Machinevertaling

**Een overzicht van hoe het vakgebied vertaalkwaliteit meet, waar het tekortschiet, en wat LYSS (Linguistically-informed Yield & Structural Scoring) als alternatief biedt**

---

> *"Automatische metrieken zijn een handige leugen. Ze geven ons een getal, en het getal stelt ons in staat een artikel te schrijven, en het artikel stelt ons in staat vooruitgang te claimen. Of er daadwerkelijk vooruitgang is geboekt, is een afzonderlijke vraag."*
> — Aangepast naar een terugkerend sentiment op WMT Metrics Shared Tasks

---

## Inleiding

Machinevertaling heeft een meetprobleem.

Het vakgebied heeft twee decennia besteed aan het bouwen van steeds geavanceerdere systemen — van frasetabellen tot aandachtsmechanismen tot taalmodellen met biljoen parameters — en gedurende die gehele ontwikkeling heeft het geworsteld met een ogenschijnlijk eenvoudige vraag: *hoe weet u of een vertaling goed is?*

Deze vraag is niet academisch. De metriek die u kiest, bepaalt welk systeem "wint." Ze bepaalt wat gefinancierd wordt, wat gepubliceerd wordt, wat ingezet wordt, en — voor de talen die MT het hardst nodig hebben — of de vertalingen van een gemeenschap als mislukkingen worden beoordeeld terwijl ze in feite correct zijn.

De geschiedenis van MT-evaluatie is, in het klein, een geschiedenis van de waarden van het vakgebied. De dominantie van BLEU gedurende bijna twee decennia onthult een voorkeur voor goedkope, snelle, taalonafhankelijke meting boven taalkundig geïnformeerde beoordeling. De opkomst van neurale metrieken zoals COMET weerspiegelt de groeiende verfijning van het vakgebied — en zijn voortdurende afhankelijkheid van Engelstalige trainingsdata. De vrijwel volledige afwezigheid van morfologiebewuste evaluatie weerspiegelt een vakgebied dat tot voor kort gebouwd was door en voor sprekers van analytische Europese talen.

Dit artikel volgt de evolutie van MT-evaluatie van BLEU tot het heden, identificeert waar bestaande benaderingen systematisch tekortschieten voor morfologisch complexe en laagresource-talen, en onderzoekt hoe een taalkundig gefundeerd alternatief eruit zou kunnen zien. Het is een aanvulling op de andere contextdocumenten van het project — [*Van Pāṇini tot Transformers*](./history-of-language-and-computation.md) (dat de intellectuele geschiedenis van taal en berekening beschrijft) en de [*Veldoriëntatie*](./mt-field-briefing.md) (die het huidige MT-landschap in kaart brengt). Waar die documenten vragen "hoe zijn we hier gekomen?" en "wat bestaat er?", vraagt dit document: "hoe weten we of iets ervan werkt?"

---

## Deel 1: Het Tijdperk van Tekenreeksvergelijking (2002–2015)

### BLEU en de Geboorte van Automatische Evaluatie



Het moderne tijdperk van MT-evaluatie begint met één enkel artikel: "BLEU: a Method for Automatic Evaluation of Machine Translation" van Kishore Papineni, Salim Roukos, Todd Ward en Wei-Jing Zhu, gepubliceerd op ACL 2002. BLEU (Bilingual Evaluation Understudy) meet in hoeverre de woordreeksen (n-grammen) van een machinevertaling overlappen met een of meer menselijke referentievertaling. Het bevat een beknoptheidsboete om te voorkomen dat systemen de score manipuleren met korte uitvoer, en het berekent een meetkundig gemiddelde van n-gram-precisies voor orden 1 tot en met 4.

BLEU werd de munteenheid van het vakgebied om een eenvoudige reden: het was snel, goedkoop, reproduceerbaar en taalonafhankelijk. Vóór BLEU vereiste het evalueren van een MT-systeem dure, trage menselijke beoordeling. BLEU bood een getal dat in milliseconden berekend kon worden, vergeleken kon worden tussen artikelen, en gebruikt kon worden om systemen te rangschikken in gedeelde taken. Binnen enkele jaren was het vrijwel verplicht — een artikel zonder BLEU-scores was niet publiceerbaar.

Maar BLEU heeft diepgewortelde, goed gedocumenteerde tekortkomingen waar het vakgebied twee decennia lang omheen heeft geprobeerd te werken:

**Geen semantisch begrip.** BLEU is pure oppervlaktevergelijking. "The cat sat on the mat" scoort nul ten opzichte van een referentie van "the feline rested on the rug." Elk woord is een correct synoniem; de betekenis is identiek; de score is nul.

**Morfologische blindheid.** Voor agglutinerende en polysynthetische talen mislukt strikte woordniveauvergelijking catastrofaal. Een correct vervoegd Cree-werkwoord dat één morfeem verschilt van de referentie scoort nul — zelfs als het verschil een grammaticaal optioneel partikel is of een even geldige woordvolgorde.

**Slechte discriminatie op zinsniveau.** BLEU was ontworpen als een metriek op corpusniveau. Op zinsniveau is het ruis en onbetrouwbaar — toch wordt het routinematig toegepast op afzonderlijke zinnen.

**Enkelvoudige-referentie-bias.** BLEU gaat ervan uit dat er *één* correcte vertaling is (of een kleine set referenties). Voor talen met vrije woordvolgorde, synoniemrijke woordenschatten of systematische ambiguïteiten (zoals het inclusieve/exclusieve "wij" in Cree) kunnen er tientallen even correcte vertalingen zijn, en BLEU bestraft alle vertalingen behalve de ene die toevallig overeenkomt met de referentie.

**Zwakke correlatie met menselijk oordeel.** Meta-analyses — met name Reiter (2018, *Computational Linguistics*) — hebben aangetoond dat de correlatie van BLEU met menselijke kwaliteitsbeoordelingen vaak zwak is, met name voor hoogwaardige systemen en voor talen die ver van het Engels afstaan.

Deze tekortkomingen waren vrijwel vanaf het begin bekend. Toch bleef BLEU bestaan omdat de alternatieven slechter waren — niet in nauwkeurigheid, maar in gemak. Het vakgebied optimaliseerde voor de metriek die het kon berekenen, niet voor de metriek die het nodig had.

### NIST (Doddington, 2002)

De NIST-metriek, in hetzelfde jaar als BLEU gepubliceerd door George Doddington op HLT 2002, wijzigde de BLEU-formule op twee manieren. Ten eerste woog het n-grammen naar hun **informatieinhoud** — zeldzame n-grammen kregen een hogere weging dan gewone, op basis van de intuïtie dat het correct vertalen van een ongebruikelijke zin informatiever is dan het correct vertalen van "of the." Ten tweede gebruikte het een **rekenkundig gemiddelde** in plaats van het meetkundig gemiddelde van BLEU, wat stabielere scores opleverde die niet naar nul zakten wanneer een enkele n-gram-orde geen overeenkomsten had. NIST werd uitgebreid gebruikt in de DARPA TIDES- en NIST OpenMT-evaluatieprogramma's, maar bereikte nooit de dominantie van BLEU in de bredere onderzoeksgemeenschap. Ondanks de verbeteringen deelde het de fundamentele beperking van BLEU: oppervlakkige tekenreeksvergelijking zonder enig begrip van betekenis.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) was een vroege poging om de rigiditeit van BLEU aan te pakken. Waar BLEU exacte woordvergelijking uitvoert, introduceerde METEOR drie innovaties:

1. **Stammen**: Woorden worden teruggebracht tot hun stam vóór vergelijking, waardoor gedeeltelijk krediet wordt gegeven voor morfologische varianten (bijv. "running" komt overeen met "ran" na stammen).
2. **Synoniemvergelijking**: Met behulp van WordNet herkent METEOR dat "car" en "automobile" hetzelfde concept zijn.
3. **Woorduitlijning**: In plaats van n-gram-overlappingen te tellen, lijnt METEOR woorden expliciet uit tussen de hypothese en de referentie, en berekent vervolgens precisie en herinnering met een fragmentatieboete.

METEOR vertoonde consequent een hogere correlatie met menselijke oordelen dan BLEU. Maar het vereiste taalspecifieke hulpbronnen (stemmers, synoniemendatabases) die de toepasbaarheid beperkten, en het was trager te berekenen. Voor het Engels was het beter. Voor laagresource-talen bestonden de stemmers en synoniemendatabases simpelweg niet.

### TER (Snover et al., 2006)

Translation Edit Rate meet het minimale aantal bewerkingen (invoegingen, verwijderingen, vervangingen en *zinsverschuivingen*) dat nodig is om de hypothese om te zetten in de referentie, genormaliseerd naar de referentielengte. De zinsverschuivingsoperatie — het verplaatsen van een aaneengesloten reeks woorden naar een andere positie — was een directe erkenning dat woordvolgorde niet vast is tussen talen. De bewerkingsafstandsbenadering van TER is intuïtief (het meet "hoeveel werk zou een menselijke nabewerker moeten doen?"), maar erft dezelfde fundamentele beperking: het vergelijkt met een enkele referentie en heeft geen begrip van betekenis.

### chrF en chrF++ (Popović, 2015; 2017)

De belangrijkste metriekinnovatie tussen BLEU en het neurale tijdperk kwam van Maja Popović. **chrF** (character F-score) meet overlap op *tekenniveau* in plaats van op woordniveau, waarbij teken-n-gram-precisie en -herinnering worden berekend. **chrF++** voegt woordniveau-unigrammen en -bigrammen terug toe aan de mix.

Waarom dit van belang is voor morfologisch rijke talen: vergelijking op tekenniveau geeft *gedeeltelijk krediet* voor gedeelde morfemen. De Cree-woorden *nikî-nipâw* ("ik sliep") en *kikî-nipâw* ("u sliep") delen de meeste van hun teken-n-grammen ondanks dat het verschillende woorden zijn. chrF zou aanzienlijk gedeeltelijk krediet geven; BLEU zou nul geven.

chrF++ is een standaard secundaire metriek geworden bij WMT-gedeelde taken, geïmplementeerd in **sacreBLEU** (Post, 2018), en wordt algemeen erkend als superieur aan BLEU voor morfologisch rijke talen. Maar het blijft een tekenreeksvergelijkingsmetriek — beter dan BLEU, maar fundamenteel beperkt door dezelfde aanname dat vertaalkwaliteit gemeten kan worden door overlap van oppervlaktevormen.

---

## Deel 2: De Neurale Metriekrevolutie (2018–heden)



### Het Inzicht: Leer te Scoren

De tekenreeksvergelijkingsmetrieken uit Deel 1 delen een fundamentele ontwerpkeuze: het zijn handgemaakte formules. Iemand besloot dat n-gram-precisie, tekenoverloop of bewerkingsafstand een goede benadering was voor vertaalkwaliteit, en vervolgens gebruikte iedereen die formule een decennium lang.

De neurale metriekrevolutie begon met een andere vraag: *wat als we een model trainden om vertaalkwaliteit te voorspellen, op dezelfde manier als we modellen trainen om te vertalen?*

### BERTScore (Zhang et al., 2020)

BERTScore, gepubliceerd op ICLR 2020 door Tianyi Zhang en collega's aan Cornell en MIT, was de eerste breed geadopteerde metriek die evaluatie verplaatste van exacte tekenreeksvergelijking naar semantische gelijkenis. Het mechanisme is elegant: codeer zowel de hypothese als de referentie via een vooraf getraind Transformer-model (BERT, RoBERTa of DeBERTa), bereken de cosinusgelijkenis tussen elk paar tokeninbeddingen, en gebruik vervolgens gretige vergelijking om precisie (de beste overeenkomst van elk hypothesetoken in de referentie), herinnering (de beste overeenkomst van elk referentietoken in de hypothese) en F1 te berekenen.

BERTScore verwerkt synoniemen, parafrasen en woordvolgordevariaties op natuurlijke wijze — "the feline rested on the rug" krijgt een hoge gelijkenis met "the cat sat on the mat" omdat de contextuele inbeddingen semantische equivalentie vastleggen. Met meertalig BERT breidt het zich uit naar elke taal die het model dekt.

Maar BERTScore is niet *getraind* op menselijke kwaliteitsoordelen. Het gebruikt vooraf getrainde inbeddingen zoals ze zijn, wat betekent dat het algemene semantische gelijkenis vastlegt in plaats van specifiek te leren wat een *vertaling* goed maakt. Dit onderscheid is van belang: een zin kan semantisch vergelijkbaar zijn met een referentie terwijl het een slechte vertaling is (verkeerd register, weggelaten negatie, gehallusineerde kwalificatie). BERTScore erft ook welke taalbias dan ook aanwezig is in het onderliggende model — voor talen die ondervertegenwoordigd zijn in de trainingsdata van BERT, leggen de inbeddingen mogelijk geen betekenisvolle onderscheidingen vast.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), gepubliceerd op ACL 2020 door Thibault Sellam, Dipanjan Das en Ankur Parikh bij Google, introduceerde een sleutelinnovatie: **vooraf trainen op synthetische verstoringen** vóór het verfijnen op menselijke oordelen. Het inzicht was dat het direct verfijnen van een taalmodel op de kleine WMT-menselijke-oordeeldatasets een metriek opleverde die broos was — het overfitten op de specifieke patronen in de trainingsdata en faalde bij buiten-distributie-invoer.

De oplossing van BLEURT was een tweefasig trainingsrecept. In fase één werden miljoenen synthetische zinsparen gegenereerd via willekeurige woordverwijderingen, invoegingen, vervangingen en terugvertaling. Het model werd getraind om bestaande automatische metriekscores (BLEU, ROUGE, BERTScore, implicatie) voor deze paren te voorspellen — waarbij algemene begrippen van tekstuele gelijkenis werden geleerd. In fase twee werd het vooraf getrainde model verfijnd op WMT Direct Assessment-beoordelingen. Dit "opwarmen" verbeterde de robuustheid dramatisch.

BLEURT-20 breidde de aanpak uit naar meertalige evaluatie met behulp van Google's RemBERT-encoder. Maar BLEURT blijft alleen-referentie — het gebruikt de brontekst niet, wat betekent dat het hallucinaties die toevallig vloeiend zijn niet kan detecteren, en het volledig afhankelijk is van de kwaliteit van de referentie.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) vertegenwoordigt de huidige stand van de techniek in automatische MT-evaluatie. Ontwikkeld door Ricardo Rei en collega's bij **Unbabel**, gebruikt COMET een taalgrensoverschrijdende encoder (XLM-RoBERTa) om drie invoeren te coderen — de bronzin, de MT-hypothese en de referentievertaling — en voorspelt een kwaliteitsscore getraind op menselijke Direct Assessment-oordelen.

COMET won of eindigde als eerste in WMT Metrics Shared Tasks vanaf 2020. De correlatie met menselijk oordeel is aanzienlijk hoger dan welke tekenreeksvergelijkingsmetriek dan ook. Het herkent parafrasen, legt betekenisbehoud vast en verwerkt synoniemvariatie die BLEU volledig mist.

Maar COMET heeft een kritische beperking voor onze doeleinden: het is getraind op menselijke oordelen van WMT, die overweldigend in Europese talen zijn. De taalgrensoverschrijdende encoder (XLM-R) werd getraind op CommonCrawl-data waar Plains Cree, Noord-Sámi en de meeste inheemse talen vrijwel afwezig zijn. Voor deze talen zijn de interne representaties van COMET onbetrouwbaar — het kan scores produceren, maar die scores zijn niet gegrond in enig werkelijk begrip van de structuur van de taal.

### xCOMET (Guerreiro et al., 2024)

xCOMET, gepubliceerd in TACL 2024 door Nuno Guerreiro, Ricardo Rei en collega's bij Unbabel en Instituto Superior Técnico, breidde COMET uit van een black-box-scorer naar een **diagnostisch hulpmiddel**. De sleutelinnovatie is multitaakleren: naast de kwaliteitsscore op zinsniveau voert xCOMET **subwoord-niveau reeksmarkering** uit om specifieke foutspannen in de vertaling te identificeren en ze te classificeren als klein, groot of kritiek.

Dit overbrugt de kloof tussen automatisch scoren en MQM-stijl menselijke foutanalyse. In plaats van alleen te rapporteren "deze vertaling scoort 0,73," kan xCOMET wijzen op de specifieke woorden die fout zijn en aangeven hoe ernstig. De training maakt gebruik van een curriculum-leeraanpak: eerst trainen op Direct Assessment-data voor regressie op zinsniveau, dan MQM-geannoteerde data met foutspanlabels toevoegen voor gezamenlijke training.

xCOMET bereikte gelijktijdig de stand van de techniek bij evaluatie op zins-, systeem- en spanniveau. Het werkt in zowel referentiegebaseerde als referentievrije modi. Maar het vereist MQM-geannoteerde trainingsdata — die duur is om te maken en overweldigend bestaat voor Europese taalparen.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, gepubliceerd op NAACL 2024 door Jiayi Wang, David Ifeoluwa Adelani en collega's in de Masakhane-gemeenschap, is het belangrijkste bewijs dat neurale metrieken *moeten* worden aangepast voor ondervertegenwoordigde talen — ze generaliseren niet zonder meer.

Het artikel toonde eerst het probleem aan: standaard COMET, getraind op WMT-data van Europese talen, vertoonde aanzienlijk zwakkere correlatie met menselijke oordelen wanneer toegepast op 13 Afrikaanse talen (waaronder Amhaars, Hausa, Igbo, Swahili, Yoruba en Zulu). De oplossing vereiste twee wijzigingen. Ten eerste het vervangen van XLM-R door **AfroXLM-R**, een taalgrensoverschrijdende encoder die specifiek getraind is om Afrikaanse talen beter te representeren. Ten tweede het aanmaken van **AfriMTE**, een nieuwe menselijke evaluatiedataset met vereenvoudigde MQM-richtlijnen ontworpen voor niet-deskundige annotatoren — omdat het vinden van tweetalige professionele vertalers voor deze talen moeilijk is.

AfriCOMET bewees het concept: een taalfamiliespecifieke neurale metriek kan de generieke versie dramatisch overtreffen. Maar het bewees ook de kosten: iemand moest AfroXLM-R bouwen, menselijke oordeeldata voor 13 talen verzamelen en een nieuw model trainen. Voor Plains Cree bestaat er geen equivalente encoder, menselijke oordeeldataset of aangepaste metriek. Het AfriCOMET-pad zou vereisen dat al deze zaken van de grond af worden opgebouwd — een inspanning van meerdere jaren waarbij gemeenschapsgebaseerde menselijke evaluatie en waarschijnlijk een speciale Algonquiaanse-familie-encoder betrokken zijn.

### GEMBA: LLM als Evaluator (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), gepubliceerd op EAMT 2023 door Tom Kocmi en Christian Federmann bij Microsoft, stelde een radicale vraag: wat als u GPT-4 gewoon *vroeg* of een vertaling goed was?

De aanpak is ontwapend eenvoudig. **GEMBA-DA** geeft de LLM de bron en hypothese en vraagt om een kwaliteitsbeoordeling op een schaal van 0–100. **GEMBA-MQM** biedt drie geannoteerde voorbeelden en vraagt de LLM om specifieke foutspannen te identificeren, ze te classificeren op type en ernst, en een MQM-stijlscore te produceren. Er is geen metriekspecifieke training vereist.

De resultaten waren opvallend: op systeemniveau bereikte GEMBA competitieve of state-of-the-art correlatie met menselijke oordelen. De foutannotaties van GEMBA-MQM, hoewel niet zo betrouwbaar als menselijke annotatoren, boden interpreteerbare diagnostische informatie zonder enige gespecialiseerde training.

Maar GEMBA roept ernstige zorgen op. Het is afhankelijk van propriëtaire closed-source modellen waarvan het gedrag verandert tussen API-versies. Resultaten zijn niet reproduceerbaar in strikte zin. Het is duur op schaal (API-kosten voor het evalueren van een volledige WMT-testset). En — cruciaal voor onze doeleinden — de kennis van de LLM over laagresource-talen is onzeker. GPT-4 begrijpt de morfologie van Plains Cree mogelijk wel of niet goed genoeg om vertalingen te evalueren; er is geen manier om dit te weten zonder te testen, en er is geen garantie dat het gedrag consistent zal zijn over modelupdates heen. Kocmi en Federmann zelf adviseerden om GEMBA niet te gebruiken om verbeteringen in academische artikelen te claimen vanwege de black-box-aard van de evaluatie.

### MetricX en de WMT 2024 Metrics Shared Task

**MetricX-24**, ontwikkeld door Juraj Juraska, Daniel Deutsch, Mara Finkelstein en Markus Freitag bij Google, won de WMT 2024 Metrics Shared Task. Gebouwd op **mT5** (Multilingual T5, een encoder-decoder-model in plaats van de encoder-only XLM-R die door COMET wordt gebruikt), neemt MetricX een ander architecturaal pad. Het gebruikt tweefasige verfijning — eerst op Direct Assessment-data, dan op MQM-scores — met uitgebreide **synthetische data-augmentatie** gericht op bekende metriekfaalmodi (ondervertaling, vloeiende-maar-verkeerde vertalingen, hallucinaties).

Het WMT 2024-bevindingsartikel, getiteld **"Are LLMs Breaking MT Metrics?"**, vroeg of door LLM gegenereerde vertalingen het metriekecosysteem hadden gebroken. Het antwoord was een gekwalificeerd nee: verfijnde neurale metrieken (MetricX-24, COMET-varianten) bleven effectief, hoewel LLM-gebaseerde metrieken (GEMBA-varianten) verrassende kracht toonden op systeemniveau. Belangrijkste bevindingen:

- **Bronbewuste metrieken** (die bron + referentie + hypothese gebruiken) presteerden consequent beter dan alleen-referentie-metrieken
- **Hybride modellen** die in zowel referentiegebaseerde als referentievrije modi werken vanuit één architectuur zijn de opkomende richting
- De **laagresource-kloof** blijft bestaan: alle metrieken presteren slechter op ondervertegenwoordigde talen, en de kloof wordt niet kleiner
- **MQM-getrainde metrieken** (die gebruikmaken van fijnmazige foutannotaties) presteren consequent beter dan DA-getrainde metrieken (die scalaire scores gebruiken)

De implicaties voor laagresource-evaluatie zijn duidelijk: het vakgebied convergeert naar grote, getrainde, bronbewuste neurale metrieken als de gouden standaard. Deze metrieken vereisen aanzienlijke trainingsdata, rekenkracht en — cruciaal — menselijke evaluatiedata in de doeltaal. Voor talen zonder enige van deze hulpbronnen is de state-of-the-art metriekpijplijn simpelweg niet van toepassing.

### Het Biasprobleem: Neurale Metrieken en Laagresource-Talen

De neurale metriekrevolutie is overweldigend een hoogresource-fenomeen geweest. Elke getrainde metriek in de voorgaande secties werd getraind op WMT-menselijke-oordeeldata, die ongeveer 20 taalparen dekt — allemaal met Europese talen, Chinees of Japans. De onderliggende encoders (XLM-R, mT5, InfoXLM) werden getraind op CommonCrawl-data waar representatie evenredig is aan webpresentie: Engels domineert, Europese talen zijn goed gedekt, en de overgrote meerderheid van de 7.000+ talen van de wereld is effectief afwezig.

Voor een taal als Plains Cree creëert dit een cascadefout:

1. **Geen trainingsdata**: Er zijn geen WMT-menselijke oordelen voor Cree-vertalingen, dus geen metriek is getraind om ze te evalueren.
2. **Geen encoderdekking**: Het vocabulaire van XLM-R werd gebouwd op CommonCrawl, waar Cree-tekst uiterst zeldzaam is. De tokenizer segmenteert Cree-woorden over in willekeurige bytefragmenten, en de contextuele inbeddingen voor die fragmenten zijn slecht getraind.
3. **Geen validatie**: Niemand heeft gemeten of COMET, BLEURT of MetricX betekenisvolle scores produceert voor Cree. Ze kunnen *getallen* produceren, maar er is geen bewijs dat die getallen correleren met werkelijke vertaalkwaliteit.
4. **Geen pad naar verbetering**: De AfriCOMET-aanpak — bouw een taalfamiliespecifieke encoder, verzamel menselijke evaluatiedata, train een nieuwe metriek — is een inspanning van meerdere jaren en meerdere instellingen. Voor een taalgemeenschap van 20.000 sprekers bestaat de onderzoeksinfrastructuur om dit te ondersteunen momenteel niet.

Het resultaat is een paradox: de talen die MT-evaluatie het dringendst nodig hebben (omdat hun MT-systemen het zwakst zijn en de meest zorgvuldige beoordeling nodig hebben) zijn precies de talen waar de beste evaluatiehulpmiddelen het minst betrouwbaar zijn. De reactie van het vakgebied is geweest om chrF++ aan te bevelen als een "goed genoeg" alternatief — en het is beter dan BLEU — maar chrF++ is nog steeds een tekenreeksvergelijkingsmetriek die geen equivalentie kan detecteren, geen vrije woordvolgorde aankan en geen begrip heeft van morfologische geldigheid.

---

## Deel 3: Voorbij Scoren — Diagnostische en Taalkundige Evaluatie

### De Adequaatheid/Vloeiendheid-Splitsing

Voordat automatische metrieken bestonden, gebruikte menselijke evaluatie van MT een raamwerk met twee dimensies: **adequaatheid** (geeft de vertaling de betekenis van de bron weer?) en **vloeiendheid** (is de vertaling grammaticaal en natuurlijk in de doeltaal?). Dit onderscheid, gecodificeerd in vroege DARPA MT-evaluaties en later bij NIST, erkende iets wat automatische metrieken twee decennia lang zouden proberen terug te winnen: vertaalkwaliteit is niet eendimensionaal.

Het adequaatheid/vloeiendheid-raamwerk raakte uit de gratie toen Direct Assessment (een enkele scalaire score) het verving bij WMT. Maar het onderliggende inzicht blijft cruciaal: een vertaling kan vloeiend maar verkeerd zijn (hallucinatie), of onvloeiend maar correct (morfologische variant). Geen enkele score vangt beide.

### MQM: De Gouden Standaard (Lommel et al., 2014; Freitag et al., 2021)

**Multidimensional Quality Metrics (MQM)** verving Direct Assessment als de primaire menselijke evaluatie van WMT vanaf 2021. MQM gebruikt professionele vertalers die specifieke foutspannen markeren, ze classificeren op type (verkeerde vertaling, weglating, toevoeging, grammatica, terminologie) en ernst (klein = 1 punt, groot = 5 punten, kritiek = 25 punten). Dit levert zowel een kwaliteitsscore als bruikbare diagnostische informatie op.

MQM is het dichtst bij een "correcte" evaluatiemethodologie — het vertelt u niet alleen *hoe slecht* een vertaling is, maar *wat er specifiek mis is gegaan*. Maar het vereist tweetalige professionele vertalers, die voor de meeste laagresource-talen niet in voldoende aantallen bestaan voor statistisch betrouwbare evaluatie.

### MorphEval: Contrastieve Morfologische Evaluatie (Burlot & Yvon, 2017)

MorphEval is de meest directe voorloper voor morfologiebewuste MT-evaluatie. Geïntroduceerd door Franck Burlot en François Yvon op WMT 2017 en uitgebreid in 2018, evalueert MorphEval morfologische *competentie* met behulp van **contrastieve testsuites**.

**Hoe het werkt:** De testsuite bestaat uit zinsparen in de brontaal die precies één morfologisch contrast van elkaar verschillen — bijvoorbeeld enkelvoud versus meervoud, tegenwoordige tijd versus verleden tijd, mannelijk versus vrouwelijk. Het MT-systeem vertaalt beide zinnen. Als het systeem het contrast correct weergeeft in zijn vertalingen (bijv. een meervoudige doeltaal produceert wanneer de bron meervoud is en een enkelvoudige doeltaal wanneer de bron enkelvoud is), wordt het contrast als correct gescoord.

**Gedekte talen:** Engels→Tsjechisch, Engels→Lets (v1, WMT 2017); uitgebreid naar Engels→Frans, Engels→Duits, Engels→Fins, Turks→Engels (v2, WMT 2018).

**Belangrijkste bevindingen:** MorphEval onthulde dat zelfs toppresterende neurale MT-systemen systematische morfologische fouten hadden — ze konden vloeiende uitvoer produceren terwijl ze tijd, getal of naamval verkeerd hadden. Deze fouten waren onzichtbaar voor BLEU en zelfs gedeeltelijk onzichtbaar voor COMET.

**Beschikbaarheid:** Open source op GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Beperkingen:** MorphEval vereist geconstrueerde contrastieve testsuites per doeltaal, ontworpen door taalkundigen die de morfologische contrasten van die taal begrijpen. Er bestaan geen testsuites voor enige polysynthetische taal. De methodologie test op *competentie* (kan het systeem dit contrast verwerken?) in plaats van *geldigheid* (heeft het systeem echte woorden geproduceerd?) of *equivalentie* (zijn deze twee verschillende vertalingen beide correct?).

### CheckList: Gedragstesten voor NLP (Ribeiro et al., ACL 2020)

**CheckList**, gepubliceerd op ACL 2020 door Marco Tulio Ribeiro en collega's (winnaar van Best Paper), importeerde een idee uit software-engineering in NLP-evaluatie: **unit testing**. In plaats van de geaggregeerde prestaties van een model op een benchmark te evalueren, definieert CheckList een matrix van **capaciteiten** (vocabulaire, negatie, benoemde entiteiten, temporeel redeneren, corefeentie) gekruist met **testtypen**:

- **Minimum Functionality Tests (MFT)**: Eenvoudige, gerichte testgevallen die elk competent model zou moeten doorstaan.
- **Invariance Tests (INV)**: Verstoringen van de invoer die de uitvoer *niet* zouden moeten veranderen (bijv. het wijzigen van een naam zou het sentiment niet moeten veranderen).
- **Directional Expectation Tests (DIR)**: Verstoringen die de uitvoer in een voorspelbare richting *zouden moeten* veranderen.

CheckList was oorspronkelijk ontworpen voor sentimentanalyse en NLI, maar het paradigma is direct toepasbaar op MT. Men zou MFT's kunnen maken voor morfologische fenomenen ("produceert het systeem de correcte meervoudsvorm?"), INV-tests voor vrije woordvolgorde ("verandert het herordenen van de Cree-woorden de Engelse vertaling?"), en DIR-tests voor morfologische kenmerken ("verandert het wijzigen van de bron van verleden tijd naar tegenwoordige tijd de doeltijd?").

Het CheckList-paradigma is bijzonder relevant omdat het formaliseert wat MorphEval intuïtief doet: test specifieke capaciteiten in plaats van geaggregeerde scores te meten. De variantklassen van onze linter (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, enz.) zijn in feite invariantieregels — ze definiëren verstoringen die het evaluatieoordeel niet zouden moeten veranderen.

### Challengesets en Gerichte Evaluatie

Het bredere paradigma van **challengesets** — geconstrueerde testsuites gericht op specifieke taalkundige fenomenen — is een gevestigde aanvullende evaluatiemethodologie geworden bij WMT sinds ongeveer 2017.

**Isabelle, Cherry & Foster (2017)**, bij NRC Canada, waren pioniers in de aanpak voor MT met handgemaakte testsets die structurele divergenties tussen talen isoleren — gevallen waarbij letterlijke vertaling waarschijnlijk onjuist is. Hun vervolgwerk (Isabelle & Kuhn, 2018) construeerde 506 Franse zinnen gericht op specifieke vertaaluitdagingen, wat fijnmazige beelden van systeemcapaciteiten opleverde.

**LingEval97** (Sennrich, EACL 2017) creëerde 97.000 contrastieve Engels→Duits-vertaalparen die testen of NMT-modellen een hogere waarschijnlijkheid toekennen aan correcte vertalingen versus paren met geïntroduceerde morfosyntactische fouten. Een belangrijke bevinding: modellen op tekenniveau excelleerden in transliteratie maar presteerden slechter bij morfosyntactische overeenstemming op lange afstand.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) schaalde de challengeset-aanpak dramatisch op: 36.476 voorbeelden verspreid over 146 taalparen die 68 afzonderlijke taalkundige fenomenen testen. ACES werd gebruikt om metrieken die ingediend werden bij de WMT-metriekengedeelde taak meta-te evalueren — testen of *metrieken* de contrasten konden detecteren, niet alleen of *systemen* ze konden produceren. Uitgebreid naar **SPAN-ACES** met foutspanannotaties.

**MT-GenEval** (Currey et al., EMNLP 2022) en **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) richten zich specifiek op geslachtsnauwkeurigheid. WinoMT is opmerkelijk omdat het expliciet **morfologische analyse** op de doeltaal gebruikt om het geslacht van vertaalde beroepen te verifiëren — een van de zeldzame gevallen waarbij een morfologische analysator wordt gebruikt als onderdeel van een MT-evaluatiehulpmiddel.

**Hjerson** (Popović & Ney, 2011) is een open-source hulpmiddel voor automatische MT-foutclassificatie dat **lemma's en POS-tags** gebruikt om fouten te categoriseren in vijf typen: morfologisch, herordening, ontbrekende woorden, extra woorden en lexicale fouten. Dit is misschien wel de dichtstbijzijnde voorloper van onze linter in geest — het gebruikt taalkundige analyse om diagnostische foutcategorieën te bieden in plaats van een enkele score.

De gemeenschappelijke draad: het vakgebied heeft herhaaldelijk erkend dat geaggregeerde scores onvoldoende zijn. Diagnostische evaluatie biedt de granulariteit die nodig is om te begrijpen *waarom* een systeem faalt. Maar diagnostische benaderingen vereisen taalkundige expertise per taal, en die expertise is geconcentreerd in Europese talen.

### AmericasNLP: Evaluatie in de Praktijk

De AmericasNLP-workshopserie (samen met NAACL), gericht op NLP voor inheemse talen van de Amerika's, biedt het meest directe vergelijkingspunt voor onze evaluatie-uitdagingen.

Van 2021 tot en met 2023 gebruikte de gedeelde taak **chrF** als primaire evaluatiemetriek — gekozen vanwege de robuustheid in laagresource-omgevingen en de vergelijking op tekenniveau, die gedeeltelijk krediet geeft voor morfologische overlap. De organisatoren erkenden de beperkingen van chrF maar hadden geen beter alternatief dat kon werken over de diverse typologieën die vertegenwoordigd waren (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri en anderen).

In 2025 introduceerde AmericasNLP een speciale **Gedeelde Taak 3** specifiek voor het ontwikkelen van MT-evaluatiemetrieken voor inheemse talen — de eerste keer dat het vakgebied expliciet erkende dat bestaande metrieken ontoereikend zijn voor deze talen. De winnende inzending, **FUSE** (Feature-Union Scorer), combineerde meertalige zinsinbeddingen (verfijnd LaBSE), lexicale gelijkenis, fonetische gelijkenis en fuzzy tokenvergelijking via Ridge-regressie en Gradient Boosting. FUSE gebruikt geen morfologische analysatoren — de feature-engineering is taalonafhankelijk.

Dit is de kloof die ons werk inneemt. AmericasNLP heeft het probleem geïdentificeerd (standaardmetrieken falen voor inheemse talen) en is begonnen met het ontwikkelen van alternatieven (FUSE). Maar geen van de alternatieven maakt gebruik van de morfologische kennis die FST's bieden. De AmericasNLP-gemeenschap gebruikt chrF++ omdat het de beste beschikbare generieke optie is, terwijl de GiellaLT-gemeenschap geavanceerde morfologische hulpmiddelen bouwt die nooit worden aangesloten op MT-evaluatie. De twee gemeenschappen zijn niet samengekomen.

---

## Deel 4: Referentievrije Evaluatie en Kwaliteitsschatting

Sommige van de belangrijkste evaluatiesignalen in ons harnas vereisen helemaal geen referentievertaling. De FST-geldigheidscontrole ("is dit een echt woord?") heeft alleen de MT-uitvoer nodig. De hallucinatiedetector heeft de bron en hypothese nodig. De code-switching-detector heeft alleen de hypothese en kennis van het schrift van de doeltaal nodig. Begrijpen waar deze passen in het bredere landschap van referentievrije evaluatie is essentieel voor het correct positioneren ervan.

### Het Kwaliteitsschattingsparadigma

**Kwaliteitsschatting (QE)** is het deelgebied van MT-evaluatie dat zich bezighoudt met het voorspellen van vertaalkwaliteit *zonder* referentievertaling. Het is een speciale gedeelde taak bij WMT geweest sinds 2012, gemotiveerd door de praktische behoefte om MT-kwaliteit te beoordelen tijdens inzet — wanneer u nieuwe tekst vertaalt en geen menselijke referentie heeft om mee te vergelijken.

De QE-taak heeft zich ontwikkeld door drie generaties. **Feature-gebaseerde QE** (2012–2016) extraheerde handgemaakte kenmerken uit de bron en hypothese — taalmodelperplexiteit, woordfrequentie, n-gram-overlap met monolinguale data — en trainde classifiers om kwaliteit te voorspellen. **Neurale QE** (2017–2021) verving handgemaakte kenmerken door geleerde representaties, doorgaans met behulp van tweetalige encoders. **Huidige QE** (2022–heden) wordt gedomineerd door COMET-gebaseerde benaderingen, met name **CometKiwi**.

### CometKiwi en Referentievrije COMET

**CometKiwi** (Rei et al., WMT 2022), de referentievrije variant van COMET, gebruikt InfoXLM om de bronzin en MT-hypothese te coderen (zonder referentie) en voorspelt een kwaliteitsscore. Het bereikte state-of-the-art resultaten in de WMT 2022- en 2023-QE-gedeelde taken.

De opmerkelijke bevinding: referentievrije CometKiwi benadert de correlatie met menselijk oordeel die wordt bereikt door referentiegebaseerde COMET. Dit suggereert dat, voor goed gedekte talen, de brontekst bijna evenveel evaluatiesignaal bevat als de referentievertaling. Maar dezelfde kanttekening geldt: de encoder van CometKiwi heeft minimale representatie voor laagresource-talen, dus de referentievrije voorspellingen voor Cree of Sámi zijn onbetrouwbaar.

Dit is waar onze FST-gebaseerde metrieken iets werkelijk anders bieden. De FST-geldigheidscontrole is een **deterministisch, referentievrij kwaliteitssignaal** dat geen getraind model en geen menselijke oordeeldata vereist. Als de FST zegt dat een woord geen geldig Cree-woord is, is dat woord geen geldig Cree-woord — met het voorbehoud van valse afwijzingen voor leenwoorden, neologismen en eigennamen. Dit soort hard, regelgebaseerd kwaliteitssignaal heeft geen equivalent in het neurale QE-ecosysteem.

### Hallucinatiedetectie in MT

Hallucinatie in MT — vloeiende uitvoer die volledig niets te maken heeft met de bron — is een ernstige faalwijze, met name in laagresource-omgevingen waar modellen onvoldoende trainingsdata hebben om betrouwbare bron-doelcorrespondenties te leren.

De academische stand van de techniek in hallucinatiedetectie gebruikt verschillende benaderingen:

- **Inbeddingsgebaseerde detectie**: Het vergelijken van bron- en hypothese-inbeddingen in een gedeelde ruimte (LASER, LaBSE) en het markeren van gevallen waarbij de gelijkenis onder een drempel ligt.
- **Waarschijnlijkheidsgebaseerde detectie**: Het gebruik van de eigen betrouwbaarheidsscores van het MT-model — hallucinaties hebben de neiging een hoge uitvoerwaarschijnlijkheid te hebben maar een lage brongebonden waarschijnlijkheid.
- **Contrastieve verstoring**: Het vergelijken van de MT-uitvoer voor de echte bron met uitvoer voor een verstoorde of niet-gerelateerde bron; als de uitvoer verdacht vergelijkbaar is, negeert het model de bron.
- **LLM als rechter**: Een LLM vragen om te beoordelen of de vertaling trouw is aan de bron.

Ons harnas gebruikt een **heuristisch detectieplugin** dat vier signalen combineert: lengte-inflatie (hypothese veel langer dan verwacht), herhaling (herhaalde zinsdelen), entiteitsmismatch (benoemde entiteiten in de bron ontbreken in de hypothese) en bronecho (hypothese is te vergelijkbaar met de brontekst, wat suggereert dat er niet-vertaald gekopieerd is). Dit is basisniveau vergeleken met academische SOTA — het vangt grove hallucinaties op maar mist subtiele. De waarde ervan ligt in het zijn van een **goedkope, snelle, referentievrije screening** die de ergste fouten kan markeren zonder een GPU of een API-aanroep te vereisen.

### Code-Switching-Detectie

Code-switching in MT-uitvoer — waarbij het systeem woorden in de brontaal produceert in plaats van ze te vertalen — is een afzonderlijke faalwijze van hallucinatie. Het treedt doorgaans op wanneer het model een woord tegenkomt dat het niet kan vertalen en terugvalt op het kopiëren van de bron.

Ons code-switching-detectieplugin gebruikt **Unicode-blokanalyse** (het detecteren van tekens uit het schrift van de brontaal in wat doeltaaluitvoer zou moeten zijn) en **lijsten met veelvoorkomende woorden** (het identificeren van hoogfrequente brontaalwoorden die onvertaald verschijnen). Voor Cree, dat zowel SRO (op Latijn gebaseerd) als syllabics gebruikt, vereist dit enige zorgvuldigheid — Engels en SRO delen het Latijnse schrift, dus Unicode-blokanalyse alleen is onvoldoende.

De academische literatuur over code-switching-detectie in MT is schaars vergeleken met hallucinatiedetectie. Het meeste werk richt zich op code-switching in *invoer*tekst (tweetalige sprekers die talen mengen) in plaats van in *uitvoer*tekst (MT-systemen die niet vertalen). Onze heuristische aanpak loopt, voor zover wij weten, niet significant achter op enige gepubliceerde stand van de techniek voor dit specifieke probleem.

---

## Deel 5: De Morfologische Kloof

### Wat Bestaande Metrieken Niet Kunnen Zien

Dit is het kernargument van dit artikel, en het vereist een concrete demonstratie.

Beschouw het Plains Cree-zinspaar:

| | Tekst |
|--|------|
| **Bron (Engels)** | "I saw the man" |
| **Referentie (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hypothese A** | *nâpêw nikî-wâpamâw* |
| **Hypothese B** | *nikî-wâpamikow nâpêsis* |

**Hypothese A** is een perfecte vertaling — het heeft dezelfde woorden in een andere volgorde, wat grammaticaal is in Cree (vrije woordvolgorde). **Hypothese B** zegt "de jongen werd door mij gezien" — verkeerde richting van handeling (*-ikow* is invers), verkeerde referent (*nâpêsis* = "jongen", niet "man").

| Metriek | Hypothese A (correct) | Hypothese B (verkeerd) | Kan het ze onderscheiden? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Nauwelijks |
| chrF++ | ~65% | ~55% | Enigszins |
| COMET | Onbekend (geen Cree-trainingsdata) | Onbekend | Onbetrouwbaar |
| **FST-acceptatie** | 100% | 100% | Nee (beide zijn geldig Cree) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Ja** |
| **Semantische validator** | VALID | WRONG | **Ja** |

De linter en semantische validator slagen waar BLEU, chrF++ en COMET falen — niet omdat ze "betere metrieken" zijn in een universele zin, maar omdat ze toegang hebben tot *taalkundige kennis* die tekenreeksvergelijkings- en neurale metrieken niet hebben. Ze weten dat Cree vrije woordvolgorde heeft. Ze weten dat *wâpamêw* en *wâpamikow* verschillende lemma's zijn met verschillende argumentstructuren. Ze weten dat *nâpêw* en *nâpêsis* verschillende woorden zijn.

Deze kennis komt van de FST (die de morfologische grammatica codeert), het tweetalige woordenboek (dat Engelse glosses biedt voor elk lemma) en de handmatig gedefinieerde variantklassen (die taalkundig gefundeerde equivalentieregels coderen). Geen van deze kennis is beschikbaar voor een metriek die de vertaling als een tekenreeks behandelt.

### Waarom het Vakgebied Dit Niet Heeft Aangepakt

De morfologische kloof in MT-evaluatie is geen mysterie. Het vakgebied weet dat het bestaat. De redenen waarom het aanhoudt zijn structureel:

1. **Schaalvoorkeur.** De MT-evaluatiegemeenschap optimaliseert voor metrieken die werken over alle WMT-taalparen. FST-gebaseerde metrieken werken voor ~30 talen. COMET werkt voor 100+. chrF++ werkt voor alle talen met een schrijfsysteem. De gemeenschap beloont universaliteit boven precisie.

2. **Gemeenschapssilos.** De mensen die FST's bouwen (computationele taalkundigen aan UiT Tromsø, NRC Canada, Universiteit van Alberta) en de mensen die evaluatiemetrieken bouwen (ML-onderzoekers bij Google, Unbabel, WMT) bezoeken verschillende conferenties, publiceren in verschillende venues en opereren onder verschillende stimulusstructuren. De kruisbestuiving die nodig zou zijn om FST-gebaseerde evaluatiemetrieken te bouwen heeft niet plaatsgevonden — niet omdat het geprobeerd werd en mislukte, maar omdat de gemeenschappen nooit zijn samengekomen.

3. **Dekkingsangst.** FST's hebben bekende valse-afwijzingsproblemen: leenwoorden, neologismen en eigennamen kunnen als ongeldig worden afgewezen, zelfs wanneer ze volkomen acceptabel zijn. Dit maakt onderzoekers nerveus over het gebruik van FST's als metrieken — een valse afwijzing verhoogt het foutenpercentage. De zorg is geldig maar kwantificeerbaar: het meten van het valse-afwijzingspercentage op bekende goede tekst is eenvoudig.

4. **Onvoldoende vraag.** Zeer weinig mensen bouwen MT voor polysynthetische talen, en degenen die dat doen (ALT Lab, NRC, AmericasNLP-deelnemers) gebruiken doorgaans chrF++ omdat dat bestaat. Er is geen gerichte druk geweest vanuit de laagresource-MT-gemeenschap voor morfologiebewuste evaluatie, deels omdat de gemeenschap klein is en deels omdat het bouwen van dergelijke metrieken expertise vereist in zowel NLP-engineering als de morfologie van de specifieke doeltaal.

5. **De neurale metriekaanname.** De heersende aanname sinds 2020 is dat neurale metrieken uiteindelijk het morfologische probleem zullen oplossen via geleerde representaties. Als u COMET traint op voldoende data van morfologisch rijke talen, zo luidt het argument, zal het leren om morfologische variatie impliciet te verwerken. Dit kan waar zijn voor hoogresource morfologisch rijke talen (Fins, Turks, Tsjechisch). Het is waarschijnlijk niet waar voor talen met effectief nul representatie in de trainingsdata.

---

## Deel 6: LYSS — Een Taalkundig Gefundeerd Alternatief

### Wat champollion Bouwde: LYSS (Linguistically-informed Yield & Structural Scoring)

Het evaluatieharnas van het champollion-project implementeert een composiet-scoringsraamwerk genaamd **LYSS** dat standaardmetrieken (chrF++, exacte overeenkomst) combineert met vier categorieën taalkundig geïnformeerde metrieken. De naam weerspiegelt de focus van het raamwerk: het meten van de *opbrengst* (hoeveel betekenis het vertaalproces overleeft) via *structurele scoring* (deterministische, taalkundig gefundeerde controles in plaats van geleerde inbeddingen).

#### 1. Morfologische Geldigheidspoort (GiellaLT FST-Metriek)

De eenvoudigste en meest breed toepasbare metriek: voer elk woord van de MT-uitvoer door de GiellaLT eindige-toestandsmorfologische analysator voor de doeltaal. Als de FST een woord kan parsen (ten minste één analyse retourneert), is het woord morfologisch geldig. Zo niet, dan bestaat het woord niet in de doeltaal — het is ofwel een gehallusineerd woord, een morfologische fout, een spelfout of een leenwoord dat niet in het lexicon staat.

**Uitvoer:** `fst_validity_rate` (0,0–1,0, hoger = beter). Macro-gemiddelde (gemiddelde van percentages per invoer) en micro-gemiddelde (totaal geldige woorden / totaal woorden).

**Afhankelijkheden:** `pyhfst` (Helsinki Finite-State Technology Python-bindingen), een gecompileerd `.hfstol` analysatorbestand voor de doeltaal.

**Uitbreidbaarheid:** Werkt voor elke taal met een GiellaLT FST-analysator — momenteel 30+ talen, voornamelijk Sámi, Uralic en inheemse Arctische talen.

**Relatie tot voorafgaand werk:** MorphEval test of een systeem specifieke contrasten aankan. De FST-metriek test of de uitvoer van het systeem bestaat uit echte woorden. Deze zijn complementair: MorphEval test competentie, de FST-metriek test geldigheid.

#### 2. Taalkundige Equivalentieklassen (CRK-Linter)

De linter pakt aan wat misschien wel de meest verraderlijke faalwijze is van referentiegebaseerde evaluatie: **het bestraffen van correcte vertalingen die afwijken van de referentie**.

De Plains Cree-linter (844 regels) implementeert zes **variantklassen**, elk coderend een taalkundig gefundeerde equivalentieregel:

- **WORD_ORDER**: Cree heeft pragmatisch vrije woordvolgorde (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* en *nâpêw nikî-wâpamâw* betekenen hetzelfde. De linter genereert alle permutaties en controleert of de hypothese overeenkomt met een ervan.
- **ORTHOGRAPHIC**: De Standard Roman Orthography heeft bekende variatiepunten — circumflex versus macron (*â* versus *ā*), koppeltekens van preverbs (*nikî-nipâw* versus *nikî nipâw* versus *nikînipâw*). De linter normaliseert deze.
- **OPTIONAL_PARTICLE**: Bepaalde discourspartikels (*mâka*, *êkwa*, *êwako*) kunnen aanwezig of afwezig zijn zonder de kernpropositie te veranderen. De linter controleert of de hypothese overeenkomt met de referentie na verwijdering van partikels.
- **LEMMA_SYNONYM**: Sommige Cree-lemma's zijn uitwisselbaar in specifieke contexten. Dit gebruikt een gecureerde synoniemenlijst (bijv. dialectale varianten) en, wanneer de FST beschikbaar is, controleert of de hypothese en referentie morfologische analyses delen.
- **PROGRESSIVE_AMBIGUITY**: Engelse progressieve vormen ("is walking") kunnen in Cree worden vertaald met verschillende constructies. De linter herkent deze als equivalent.
- **INCLUSIVE_EXCLUSIVE**: Cree onderscheidt inclusief "wij" (*ki-* prefix) van exclusief "wij" (*ni-* prefix) — een onderscheid dat het Engels samenvoegt in één enkel voornaamwoord. De linter herkent dat beide vormen correct kunnen zijn wanneer de Engelse bron ambigu is.

De linter produceert drie oordelen: **EXACT** (hypothese komt overeen met referentie), **EQUIVALENT** (hypothese verschilt maar wordt geclassificeerd als een geldige variant) of **MISS** (geen overeenkomst gevonden). Op geaggregeerd niveau berekent het een `equivalent_match_rate` — het aandeel vertalingen dat exact of equivalent is.

**Relatie tot voorafgaand werk:** De dichtstbijzijnde parallel is **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), dat exponentieel veel geldige vertalingen codeert als parafrasenetwerken en bewerkingsafstand tot de dichtstbijzijnde geldige vorm meet. Onze linter is conceptueel vergelijkbaar — het definieert een set geldige vertalingen voor elke referentie — maar gebruikt taalkundig gedefinieerde transformatieregels in plaats van parafrasedatabases. HyTER was ontworpen voor het Engels; niemand heeft parafrasenetwerken gebouwd voor Cree. Onze variantklassen zijn in feite een compacte, regelgebaseerde benadering van wat HyTER doet met grafieken.

In het CheckList-raamwerk functioneren onze variantklassen als **invariantietests**: transformaties die het evaluatieoordeel niet zouden moeten veranderen. Het verschil is dat CheckList-tests doorgaans worden toegepast op het *model*; onze variantregels worden toegepast op de *metriek*.

#### 3. Deterministische Semantische Validatie (CRK Semantische Metriek)

De semantische validator (792 regels) probeert iets ambitieuzers: **deterministische betekenisvergelijking** zonder neurale inbeddingen. Het werkt in vier fasen:

1. **Morfologische analyse**: Zowel de hypothese als de referentie worden door de CRK FST-analysator geleid, die het lemma en de morfologische kenmerken voor elk woord retourneert.
2. **Glosresolutie**: Elk lemma wordt opgezocht via de itwêwina dictionary API — die Wolvengrey (2001) aanbiedt naast de Maskwacîs en Alberta Elders' woordenboeken — om Engelse glossen te verkrijgen.
3. **Extractie van inhoudswoorden**: Met behulp van spaCy's Engelse pijplijn (`en_core_web_md`) worden functiewoorden gefilterd uit zowel de Engelse glossen als de brontekst.
4. **Overlapscore**: De overlap van inhoudswoorden tussen de glossen van de hypothese en de glossen van de referentie bepaalt het semantische oordeel.

De validator produceert categorische oordelen: **EXACT_MATCH**, **VALID** (verschillende woorden maar dezelfde betekenis), **GRAMMAR_ISSUES** (correcte lemma's maar grammaticaproblemen op zinsniveau — overeenstemming, animaatheid, werkwoordvorm), **PARTIAL** (enige betekenis behouden), **INCOMPLETE** (betekenis gedeeltelijk ontbrekend), **WRONG** (andere betekenis) of **NO_OUTPUT**.

**Relatie tot voorafgaand werk:** Dit is in feite een **deterministische benadering van de semantische gelijkenisberekening van COMET**. Waar COMET geleerde taalgrensoverschrijdende inbeddingen gebruikt om te beoordelen of twee zinnen hetzelfde betekenen, gebruikt onze validator een keten van deterministische opzoekingen: FST → woordenboek → spaCy. Het voordeel is transparantie (elke stap is inspecteerbaar en deterministisch) en onafhankelijkheid van trainingsdata. Het nadeel is broosheid: de kwaliteit van de beoordeling hangt volledig af van de dekking van de FST en de volledigheid van het woordenboek.

De aanpak is conceptueel verwant aan **MEANT** (Lo & Wu, 2011; Lo, 2017), dat semantische rolmarkering gebruikte om te beoordelen of de "wie deed wat aan wie"-structuur behouden was in de vertaling. Onze aanpak is grover (inhoudswoordoverlap in plaats van semantische rollen) maar werkt op een taal waarvoor geen SRL-hulpmiddelen bestaan.

#### 4. Gedragsdetectieplugins (Hallucinatie, Code-Switching, Terminologie)

Drie aanvullende plugins bieden **gedragskwaliteitssignalen** die de morfologische metrieken aanvullen:

- **Hallucinatiedetectie** (259 regels): Vier heuristische signalen gewogen en gecombineerd — lengte-inflatie (40%), herhaling (30%), entiteitsmismatch (20%), bronecho (10%). Dit zijn goedkope, referentievrije screenings die grove fabricatie opvangen.
- **Code-switching-detectie** (~280 regels): Unicode-blokanalyse plus lijsten met veelvoorkomende woorden om niet-vertaalde brontaaltokens te detecteren. Geeft een `code_switching_rate` (0,0–1,0) terug.
- **Terminologienaleving** (199 regels): Controleert of gespecificeerde glossariumtermen consistent worden vertaald. Retourneert `terminology_adherence` (0,0–1,0) of None als er geen glossarium is geconfigureerd.

Deze plugins worden eerlijk gepositioneerd als **basisheuristische detectoren**, niet als state-of-the-art. Hun waarde ligt in het bieden van goedkope, snelle, interpreteerbare signalen die naast de meer geavanceerde morfologische metrieken kunnen worden berekend. In het composiet-scoringsraamwerk dragen ze lage gewichten (0,05 elk).

### Eerlijke Beperkingen

Deze aanpak heeft significante beperkingen die erkend moeten worden voordat enige claim van nieuwheid of bruikbaarheid wordt gedaan:

1. **FST valse-afwijzingspercentage.** De FST zal geldige woorden afwijzen die niet in zijn lexicon staan — leenwoorden, neologismen, eigennamen, code-gemengde termen. Dit verhoogt het morfologische foutenpercentage. Het valse-afwijzingspercentage is niet formeel gemeten op een representatief corpus van Cree-tekst. Zonder deze meting is de precisie van de FST-geldigheidsmetriek onbekend.

2. **Woordenboekdekking.** De kwaliteit van de semantische validator hangt volledig af van de dekking van het Wolvengrey-woordenboek. Cree-woorden die niet in het woordenboek staan, produceren geen glossen, wat de validator als een betekenishiaat behandelt. Het woordenboek bevat ongeveer 18.000–22.000 lemma's (aantallen variëren per editie en telmethode) — aanzienlijk, maar niet uitputtend.

3. **Volledigheid van variantklassen.** De zes variantklassen van de linter zijn ontworpen op basis van taalkundige literatuur en observatie van MT-uitvoerpatronen. Er kunnen aanvullende equivalentieklassen zijn die niet zijn vastgelegd — dialectale variaties, registerverschillen, discourssynoniemen. Er is geen formeel proces dat volledigheid garandeert.

4. **Geen menselijke correlatiestudie.** De meest kritieke kloof: niemand heeft gemeten of de oordelen van de linter (EXACT/EQUIVALENT/MISS) of de oordelen van de semantische validator correleren met menselijke oordelen over vertaalkwaliteit. Neurale metrieken besteden jaren aan het vaststellen van correlatie met menselijke beoordeling (WMT-gedeelde taken). Onze metrieken hebben geen dergelijke validatie.

5. **Taalspecificiteit.** De variantklassen, synoniemenlijsten en optionele partikelregels zijn specifiek voor Plains Cree. Ze overdragen naar Noord-Sámi, Inuktitut of een andere taal vereist taalkundigen die de morfologie, woordvolgordeflexibiliteit en orthografische variatie van die taal begrijpen. Het *raamwerk* is overdraagbaar; de *regels* zijn dat niet.

6. **Metriekbedradingsgaten.** Op het moment van schrijven hebben vier van de negen metrieken in het composiet-scoringsprofiel (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) onvolledige of onduidelijke pluginbedrading in het arena-harnas. De composietscore wordt effectief berekend uit ongeveer vijf metrieken met herverdeelde gewichten.

### Wat Vereist Zou Zijn om Deze Aanpak te Valideren

Om dit werk publiceerbaar te maken — in welk venue dan ook, op welk niveau van academische ernst dan ook — zouden de volgende experimenten vereist zijn:

1. **Menselijke oordeelcorrelatiestudie.** Verzamel menselijke kwaliteitsbeoordelingen voor een set Engels→Cree-vertalingen (idealiter 200+ zinsparen beoordeeld door 3+ tweetalige sprekers). Bereken correlaties tussen menselijke scores en elk van onze metrieken. Dit is de enkelvoudig belangrijkste validatie. Zonder dit zijn de metrieken technische artefacten, geen evaluatiehulpmiddelen.

2. **Meting van FST valse-afwijzingspercentage.** Voer de FST-analysator uit op een corpus van bekende goede Cree-tekst (bijv. gepubliceerde Cree-teksten, gevalideerde parallelle corpora) en meet welk percentage geldige woorden wordt afgewezen. Dit kwantificeert de precisie van de FST-geldigheidsmetriek.

3. **Validatie voor een tweede taal.** Draag de FST-geldigheidsmetriek over naar een tweede GiellaLT-taal (hoogstwaarschijnlijk Noord-Sámi, dat de meest volwassen FST-analysator heeft in het GiellaLT-ecosysteem). Demonstreer dat de metriek zinvolle resultaten produceert op Sámi MT-uitvoer. Dit valideert de claim van uitbreidbaarheid.

4. **Vergelijking met COMET.** Voer COMET uit op dezelfde Cree-data en vergelijk de scores met onze metrieken en met menselijke oordelen. Als COMET betekenisvolle scores produceert voor Cree (wat wij betwijfelen, maar niet hebben getest), moeten onze metrieken het overtreffen om nuttig te zijn. Als COMET ruis produceert (wat wij verwachten), valideert dit de behoefte aan onze aanpak.

5. **MorphEval diagnostisch complement.** Bouw een kleine (50–100 contrasten) MorphEval-stijl testsuite voor Plains Cree gericht op de meest onderscheidende morfologische kenmerken van de taal (obviatie, invers, conjunct/onafhankelijk, inclusief/exclusief, preverb-ketens). Voer MT-systemen ertegen uit en toon aan dat de diagnostische informatie bruikbaar is.

6. **Bedrading- en integratieaudit.** Los de scoringsprofiel-bedradingsgaten op die zijn geïdentificeerd in de codebase-inventaris. Zorg ervoor dat alle negen composietmetrieken waarden produceren en dat de geaggregeerde score correct wordt berekend.

---

## Deel 7: Positionering en Toekomstig Werk

### Waar LYSS Staat in het Evaluatielandschap

Een taxonomie van MT-evaluatiebenaderingen, eerlijk gepositioneerd:

| Dimensie | Tekenreeksmetrieken (BLEU, chrF++) | Neurale metrieken (COMET, MetricX) | LLM als rechter (GEMBA) | Diagnostisch (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Signaaltype | Oppervlakteoverlap | Geleerde semantische gelijkenis | Open oordeel | Gerichte capaciteitsprobes | Morfologische geldigheid + regelgebaseerde equivalentie |
| Trainingsdata nodig | Geen | Menselijke oordelen (duizenden) | Vooraf getrainde LLM | Door taalkundigen ontworpen testsuites | FST + woordenboek + variantregels |
| LRL-toepasbaarheid | Universeel maar zwak | Beperkt door encoderdekking | Beperkt door LLM-dekking | Beperkt door aanmaak van testsuites | Beperkt door FST-beschikbaarheid (~30 talen) |
| Referentie nodig | Ja | Ja (of alleen-bron-QE) | Optioneel | Ja (contrastief) | Ja (LYSS-eq/LYSS-sem) / Nee (LYSS-fst) |
| Interpreteerbaarheid | Laag (een getal) | Laag (een getal) | Hoog (tekstuele redenering) | Hoog (geslaagd/mislukt per fenomeen) | Hoog (oordelen + variantklassen) |

**LYSS is niet**: een vervanging voor COMET voor goed gedekte talen, een universele metriek of de eerste morfologiebewuste evaluatie.

**LYSS is**: een geïntegreerd raamwerk dat FST-gebaseerde morfologische validatie combineert met standaardmetrieken voor het specifieke geval van talen waar neurale metrieken onvoldoende dekking hebben en regelgebaseerde hulpmiddelen (FST's, woordenboeken) bestaan. Het heeft drie kerncomponenten:
- **LYSS-fst** — Morfologische geldigheid via FST (`fst_acceptance_rate`)
- **LYSS-eq** — Taalkundige equivalentie via de linter (`equivalent_match_rate`)
- **LYSS-sem** — Deterministische semantische validatie (`semantic_score`)

**LYSS breidt uit**: het kernidee van MorphEval (gebruik morfologische hulpmiddelen voor evaluatie) van diagnostisch competentietesten naar continue kwaliteitsscoring.

**LYSS complementeert**: chrF++ (dat gedeeltelijk krediet geeft voor gedeelde morfemen maar geen equivalentie kan detecteren), COMET (dat werkt in semantische ruimte maar trainingsdata mist voor LRL) en FUSE (dat feature-engineering gebruikt maar geen morfologische analysatoren).

**Het dichtstbijzijnde voorafgaande werk is**: Hjerson (taalkundige foutclassificatie) + HyTER (equivalentieklassen via parafrasenetwerken) + Apertium's naïeve dekkingsmetriek (FST-gebaseerde geldigheidscontrole). De bijdrage van LYSS is niet een enkele techniek maar de integratie van deze ideeën — met name FST-gebaseerde geldigheid en regelgebaseerde equivalentie — in een werkend evaluatieharnas voor een polysynthetische taal.

### MorphEval Integreren

De contrastieve testsuitemethodologie van MorphEval en onze continue scoringsbenadering zijn complementair:

- **MorphEval** beantwoordt: "Kan dit systeem tijdsmarkering verwerken? Getalsovereenstemming? Naamvalstoewijzing?"
- **Onze FST-metriek** beantwoordt: "Heeft dit systeem echte woorden geproduceerd?"
- **Onze linter** beantwoordt: "Is deze vertaling equivalent aan de referentie ondanks oppervlakteverschillen?"
- **Onze semantische validator** beantwoordt: "Betekent deze vertaling het juiste?"

MorphEval is open source. Het aanmaken van een Plains Cree-testsuite zou vereisen dat een taalkundige contrastieve paren ontwerpt die Cree-specifieke morfologische contrasten dekt (obviatie, inversmarkering, conjunct/onafhankelijke volgorde, inclusief/exclusief "wij," preverb-ketens). Dit is aanzienlijk maar begrensd werk — weken, niet maanden — en zou diagnostische capaciteit bieden die geen enkel ander evaluatiehulpmiddel biedt voor Cree.

### De Uitbreidbaarheidsvraag

Welke andere talen zouden deze aanpak kunnen adopteren? De primaire beperking is FST-beschikbaarheid. De GiellaLT-infrastructuur biedt morfologische analysatoren voor 30+ talen, voornamelijk in drie families:

- **Sámi-talen** (Noord-Sámi, Lule-Sámi, Zuid-Sámi, Skolt-Sámi, Inari-Sámi): Volwassen FST's met brede dekking. Noord-Sámi is het meest direct overdraagbare doelwit.
- **Uralic talen** (Fins, Ests, Komi, Erzya, Moksha): Goed ontwikkelde analysatoren, hoewel Fins en Ests FST-gebaseerde evaluatie misschien niet zo dringend nodig hebben (ze hebben meer neurale metriekdekking).
- **Inheemse Arctische talen** (Inuktitut via Uqailaut, Groenlands): Analysatoren bestaan maar dekking varieert.
- **Andere GiellaLT-talen**: Faeröers, Iers, Cornisch, Livonisch en anderen met wisselende niveaus van FST-volwassenheid.

Buiten GiellaLT biedt het **Apertium**-platform morfologische analysatoren voor ongeveer 40+ taalparen. Het **HFST**-ecosysteem (Helsinki Finite-State Technology) is de gedeelde infrastructuur die zowel GiellaLT als Apertium gebruiken, wat betekent dat elke Apertium-analysator in principe kan worden aangesloten op dezelfde FST-geldigheidsmetriek.

De praktische beperking is niet FST-beschikbaarheid maar **curatie van variantklassen**. De equivalentieregels van de linter vereisen taalkundige expertise per doeltaal. Voor Noord-Sámi zou dit vereisen dat de woordvolgordeflexibiliteit van Sámi, orthografische conventies en dialectale variatie worden begrepen. Voor Inuktitut zou het vereisen dat polysynthetische morfologie wordt begrepen op een niveau vergelijkbaar met wat voor Cree is gedaan. De FST-geldigheidsmetriek kan echter onmiddellijk worden ingezet voor elke taal met een GiellaLT-analysator — geen aanvullend taalkundig werk vereist.

### Naar een Artikel

Een publicatie gebaseerd op dit werk zou het meest natuurlijk gericht zijn op een van deze venues:

- **WMT Metrics Shared Task** (samen met EMNLP): Het meest directe venue. Zou vereisen dat de metrieken worden geïmplementeerd als een gedeelde-taakinzending en worden geëvalueerd op WMT-testsets — die momenteel geen enkele polysynthetische taal bevatten. Kan worden ingediend als een "bevindingen"-artikel of deelnemen aan de challengesets-subtaak.
- **LREC-COLING** (Language Resources and Evaluation Conference): Natuurlijke keuze voor een hulpbron/hulpmiddel-artikel dat het evaluatieraamwerk en de taalkundige hulpbronnen beschrijft die het gebruikt (FST's, woordenboeken, variantregels).
- **ACL of NAACL** (hoofdconferentie): Zou de menselijke correlatiestudie en ten minste één aanvullende taal vereisen om de lat voor een hoofdconferentieartikel te halen.
- **AmericasNLP-workshop**: Het meest ontvankelijke publiek voor evaluatie van inheemse taal-MT. Lagere publicatielat, maar grote impact binnen de doelgemeenschap.
- **ComputEL** (Computational Approaches to Endangered Languages): Gericht venue voor precies dit type werk.

Elke publicatie zou co-auteurs vereisen met expertise in Cree-taalkunde (om de variantklassen te valideren en resultaten te interpreteren) en idealiter tweetalige Cree-sprekers (om de menselijke kwaliteitsbeoordelingen te bieden voor de correlatiestudie). Dit is niet optioneel — een artikel over Cree MT-evaluatie geschreven volledig door niet-Cree-sprekers zou op zijn best onvolledig zijn, en op zijn slechtst een voortzetting van de extractieve onderzoeksdynamieken die het vakgebied probeert achter zich te laten.

---

## Bijlage A: Metriekvereistenmatrix

| Metriek | Referentie nodig? | Bron nodig? | Getraind model? | Taalspecifieke hulpbronnen? | Werkt voor LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Ja | Nee | Nee | Nee | Slecht |
| chrF++ | Ja | Nee | Nee | Nee | Beter dan BLEU |
| METEOR | Ja | Nee | Nee | Stemmer + WordNet | Alleen als hulpbronnen bestaan |
| TER | Ja | Nee | Nee | Nee | Hetzelfde als BLEU |
| BERTScore | Ja | Nee | Ja (mBERT) | Nee | Afhankelijk van modeldekking |
| BLEURT | Ja | Nee | Ja (getraind) | Nee | Afhankelijk van trainingsdata |
| COMET | Ja | Ja | Ja (XLM-R) | Nee | Afhankelijk van XLM-R-dekking |
| CometKiwi | Nee | Ja | Ja (XLM-R) | Nee | Afhankelijk van XLM-R-dekking |
| GEMBA | Optioneel | Ja | Ja (LLM) | Nee | Afhankelijk van LLM-dekking |
| **FST-acceptatie** | **Nee** | **Nee** | **Nee** | **Ja (FST-analysator)** | **Ja, als FST bestaat** |
| **CRK-Linter** | **Ja** | **Nee** | **Nee** | **Ja (FST + variantregels)** | **Ja, als hulpbronnen bestaan** |
| **CRK Semantisch** | **Ja** | **Optioneel** | **Nee** | **Ja (FST + woordenboek + spaCy)** | **Ja, als hulpbronnen bestaan** |
| Hallucinatiedet. | Nee | Ja | Nee | Nee | Ja |
| Code-switching-det. | Optioneel | Ja | Nee | Minimaal | Ja |
| MorphEval | Ja (contrastief) | Ja | Nee | Ja (testsuite + analysator) | Alleen als testsuite bestaat |

## Bijlage B: Belangrijkste Artikelen

| Citaat | Venue | Relevantie |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | De metriek die het vakgebied definieerde |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Informatiegewogen n-gram-vergelijking |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Stammen, synoniemen, woorduitlijning |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Bewerkingsafstand met zinsverschuivingen |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Hjerson-foutclassificatie |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Equivalentieklassen via parafrasenetwerken |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | MQM-fouttypologie |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Evaluatie op tekenniveau |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Teken- + woord-n-gram-evaluatie |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Contrastieve morfologische testsuites |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | LingEval97 contrastieve paren |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Gerichte structurele divergentietesten |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | sacreBLEU-standaardisatie |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Meta-analyse van de correlatie van BLEU met menselijk oordeel |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | WinoMT-geslachtsevaluatie |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Best Paper) | Capaciteitsgebaseerde unit testing voor NLP |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Inbeddingsgebaseerde semantische gelijkenis |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Vooraf getrainde + verfijnde metriek |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Taalgrensoverschrijdende drietalige evaluatie |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | MQM-gebaseerde meta-evaluatie |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | Meertalige NMT als parafrasescorer |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Contrafeitelijke geslachtsnauwkeurigheid |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 fenomenen, 146 taalparen |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM als evaluator |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Foutspandetectie |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Neurale metrieken voor Afrikaanse talen |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | mT5-gebaseerde winnende metriek |

## Bijlage C: Woordenlijst van Evaluatietermen

| Term | Definitie |
|------|------------|
| **Adequaatheid** | Of een vertaling de betekenis van de bron weergeeft. |
| **Vloeiendheid** | Of een vertaling grammaticaal en natuurlijk is in de doeltaal. |
| **Direct Assessment (DA)** | Menselijke evaluatiemethode waarbij annotatoren vertalingen beoordelen op een schaal van 0–100. |
| **MQM** | Multidimensional Quality Metrics — op foutspannen gebaseerde menselijke evaluatie met getypeerde ernsten. |
| **Kwaliteitsschatting (QE)** | Het voorspellen van vertaalkwaliteit zonder een referentievertaling. |
| **FST** | Finite-State Transducer — een computationeel apparaat dat de morfologische regels van een taal codeert. |
| **GiellaLT** | Infrastructuur voor regelgebaseerde taaltechnologie, voornamelijk voor Sámi en andere Arctische talen. |
| **HFST** | Helsinki Finite-State Technology — het softwareraamwerk dat ten grondslag ligt aan GiellaLT en Apertium. |
| **SRO** | Standard Roman Orthography — het op Latijn gebaseerde schrijfsysteem voor Plains Cree. |
| **Syllabics** | Canadian Aboriginal Syllabics — een abugida-schrijfsysteem dat wordt gebruikt voor Cree en andere Algonquiaanse talen. |
| **Polysynthetisch** | Een taaltype waarbij één enkel woord het equivalent van een volledige Engelse zin kan coderen via uitgebreide affixatie. |
| **Obviatie** | Een grammaticale categorie in Algonquiaanse talen die onderscheid maakt tussen twee derde-persoon-referenten. |
| **Invers** | Een stem-achtige categorie in Algonquiaanse talen die aangeeft dat de patiënt de agent overtreft op de animaathiërarchie. |
| **WMT** | Conference on Machine Translation — het primaire venue voor MT-gedeelde taken en evaluatie. |
| **Contrastieve evaluatie** | Testen of een systeem minimaal verschillende invoeren kan onderscheiden die verschillende uitvoeren vereisen. |
| **Challengeset** | Een geconstrueerde testsuite gericht op specifieke taalkundige fenomenen. |
| **Equivalentieklasse** | Een set van verschillende oppervlaktevormen die dezelfde betekenis vertegenwoordigen en dezelfde evaluatiescore zouden moeten ontvangen. |

## Waar dit toe leidt op deze site

Champollions eigen antwoorden op de hier gecatalogiseerde problemen zijn de
[Scoringsspecificatie](/docs/network/specifications/scoring) (welke metriek
telt, en wanneer), [Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability)
(welke metriek te vertrouwen is per doeltaal), en het
[Raamwerk voor corpusontwerp](/docs/network/specifications/corpus-design)
(hoe een testset het recht verdient om geloofd te worden).
