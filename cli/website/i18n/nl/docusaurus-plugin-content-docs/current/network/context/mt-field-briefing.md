# Machinevertalingen: Een Veldoverzicht (2013–2026)

*Een narratieve geschiedenis voor iedereen die het MT-landschap betreedt*

---

## Inhoudsopgave

- [Deel 1: De Neurale Revolutie (2013–2017)](#part-1-the-neural-revolution-20132017)
- [Deel 2: De Meertalige Wending (2018–2022)](#part-2-the-multilingual-turn-20182022)
- [Deel 3: Het LLM-tijdperk (2022–2026)](#part-3-the-llm-era-20222026)
- [Deel 4: Het Probleem van Taalarmede](#part-4-the-low-resource-problem)
- [Deel 5: Eindige-Toestandstransducers en Regelgebaseerde Systemen](#part-5-finite-state-transducers-and-rule-based-systems)
- [Deel 6: Kwaliteit Meten — Het Evaluatieprobleem](#part-6-measuring-quality--the-evaluation-problem)
- [Deel 7: Het Institutionele Landschap](#part-7-the-institutional-landscape)
- [Deel 8: Open Grenzen](#part-8-open-frontiers)
- [Bijlage A: Sleutelpublicaties](#appendix-a-key-papers)
- [Bijlage B: Conferenties en Gemeenschappen](#appendix-b-conferences-and-communities)
- [Bijlage C: Tools, Datasets en Praktische Bronnen](#appendix-c-tools-datasets-and-practical-resources)
- [Bijlage D: Woordenlijst](#appendix-d-glossary)

---

## Deel 1: De Neurale Revolutie (2013–2017) {#part-1-the-neural-revolution-20132017}

### Het Oude Regime: Statistische Machinevertaling

Om de revolutie te begrijpen die machinevertalingen in het midden van de jaren 2010 heeft hervormd, moet u eerst begrijpen wat eraan voorafging — en waarom het bezweek.

Van ruwweg 2003 tot 2015 was het dominante paradigma in MT **Statistische Machinevertaling (SMT)**, meer bepaald **zinsdeel-gebaseerde SMT**. Het kernidee was bedrieglijk eenvoudig: in plaats van regels op te stellen over hoe taal werkt, verzamelt u enorme hoeveelheden parallelle tekst — documenten die door mensen in twee talen zijn vertaald — en laat u statistische algoritmen de overeenkomsten leren. Het systeem ontleedde een bronzin in overlappende zinsdelen (geen taalkundige zinsdelen, maar willekeurige n-gram-fragmenten), zocht statistisch waarschijnlijke vertalingen voor elk fragment, en stelde vervolgens een doelzin samen met behulp van een **taalmodel** dat de vloeiendheid van de uitvoer waarborgde.

Het werkpaard van dit tijdperk was **Moses**, een open-source SMT-toolkit die voornamelijk werd ontwikkeld aan de Universiteit van Edinburgh onder Philipp Koehn en in 2006 werd uitgebracht. Moses werd de Linux van MT-onderzoek — vrijwel elk academisch MT-laboratorium ter wereld gebruikte het. Het bijbehorende programma **cdec** (ontwikkeld door Chris Dyer aan Carnegie Mellon) bood vergelijkbare mogelijkheden met een ander formalisme. Samen definieerden deze tools een decennium van MT-onderzoek.

Zinsdeel-gebaseerde SMT werkte verrassend goed voor taalparen met overvloedige parallelle data en vergelijkbare woordvolgorde — Engels–Frans, Engels–Spaans, Engels–Duits. Maar het kende diepe structurele beperkingen. Het systeem had geen begrip van betekenis. Het was patroonherkenning over oppervlaktestrings, waarbij vertalingen werden samengesteld uit gememoriseerde fragmenten. Het had moeite met verwijzingen over lange afstanden (een voornaamwoord dat verwijst naar een zelfstandig naamwoord meerdere bijzinnen eerder), met herordening tussen typologisch verschillende talen (Engels–Japans, bijvoorbeeld, waar werkwoorden op tegengestelde posities staan), en met elk verschijnsel dat echte abstractie over taalstructuur vereiste. Elke verbetering vereiste steeds ingewikkelder technische ingrepen: handmatig opgestelde herorderingsregels, schaarse kenmerken, enorme taalmodellen. De architectuur naderde haar plafond.

### De Doorbraak: Sequentie-naar-Sequentie met Aandacht

De eerste barst in het SMT-paradigma kwam niet vanuit de MT-gemeenschap, maar van onderzoekers op het gebied van diep leren die werkten aan problemen met sequentiemodellering.

In september 2014 publiceerden **Dzmitry Bahdanau, Kyunghyun Cho en Yoshua Bengio** aan de Université de Montréal een artikel dat transformatief zou blijken: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (gepresenteerd op ICLR 2015). De sleutelinnovatie was het **aandachtsmechanisme**.

Om te begrijpen waarom dit van belang was, heeft u de voorafgaande context nodig. Slechts enkele maanden eerder hadden Ilya Sutskever, Oriol Vinyals en Quoc V. Le bij Google ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) gepubliceerd (NIPS 2014), waarin werd aangetoond dat een neuraal netwerk met een **encoder–decoder**-architectuur zinnen kon vertalen. De encoder leest de bronzin woord voor woord en comprimeert deze tot één vector met vaste lengte — een numerieke samenvatting van de volledige invoer. De decoder genereert vervolgens de doelzin woord voor woord vanuit die vector.

Dit was elegant, maar had een kritieke tekortkoming: de enkele vector was een **knelpunt**. Alle informatie in een bronzin van dertig woorden moest worden samengeperst in één vector van, zeg, 1.000 getallen. Korte zinnen werden redelijk goed vertaald; lange zinnen verslechterden sterk, omdat het model eerdere woorden vergat tegen de tijd dat het klaar was met het coderen van latere woorden.

Bahdanau's aandachtsmechanisme loste dit op. In plaats van de volledige bron in één vector te comprimeren, mocht de decoder **terugkijken** naar alle verborgen toestanden van de encoder — de tussenliggende representaties op elke bronpositie — en dynamisch wegen welke posities het meest relevant waren voor het genereren van elk doelwoord. Bij het produceren van het Engelse woord "cat" kon het model het sterkst aandacht besteden aan het Franse woord "chat" in de bron, zelfs als ze ver uit elkaar stonden in de zin. Het model leerde bronwoorden en doelwoorden te *uitlijnen* als onderdeel van het vertaalproces, in plaats van te vertrouwen op één gecomprimeerde samenvatting.

Dit was de fundamentele innovatie. Aandacht verbeterde niet alleen MT; het werd het centrale mechanisme van vrijwel alle daaropvolgende vooruitgang in de verwerking van natuurlijke taal.

### Google Gaat Neuraal

De academische resultaten van 2014–2015 waren indrukwekkend, maar nog niet gereed voor productie. Dat veranderde eind 2016.

In september 2016 publiceerde een groot team bij Google onder leiding van **Yonghui Wu** ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). Het systeem, bekend als **GNMT** (Google Neural Machine Translation), was een encoder–decoder-architectuur op industriële schaal met aandacht, getraind op Google's uitgebreide parallelle databronnen. Het artikel deed een opvallende bewering: voor bepaalde taalparen reduceerde GNMT vertaalfouten met 55–85% vergeleken met Google's bestaande zinsdeel-gebaseerde SMT-systeem.

In november 2016 begon Google stilzwijgend Google Translate over te schakelen van zinsdeel-gebaseerde SMT naar GNMT voor de belangrijkste taalparen. De overgang was in wezen voltooid voor taalparen met veel data in 2017. Voor gebruikers was de verandering dramatisch. Vertalingen die eerder stijf, gefragmenteerd en soms onzinnig klonken, werden aanzienlijk vloeiender — soms verrassend zo. Het tijdperk van "Google Translate-wartaal" als grap liep ten einde.

De concurrentiereactie was snel. In augustus 2017 lanceerde **DeepL**, opgericht door **Gereon Frahling** in Keulen, Duitsland, zijn vertaaldienst. DeepL was voortgekomen uit het tweetalige concordantieproject Linguee en onderscheidde zich door de waargenomen vertaalkwaliteit — in het bijzonder voor Europese talenparen, waar het onder professionele vertalers al snel een reputatie opbouwde voor het produceren van natuurlijkere, idiomatischere output dan Google. Het bedrijfsmodel van DeepL (freemium met een betaalde API) en de focus op kwaliteit boven kwantiteit zouden de marktpositie voor de toekomst bepalen. DeepL ondersteunt ongeveer 33 talen — veel minder dan de 194 op de Cloud Translation-lijst van Google — maar met een positionering waarbij kwaliteit voorop staat.

### De Transformer

Als Bahdanau's aandachtsmechanisme het fundament was, dan was de **Transformer** het gebouw dat erop werd opgetrokken — en het gebouw was een wolkenkrabber.

In juni 2017 publiceerden een team van acht onderzoekers bij Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser en Illia Polosukhin** — ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) op NIPS 2017. De titel was geen overdrijving; het was een precieze architecturale bewering. Waar eerdere modellen recurrente neurale netwerken (RNN's) als ruggengraat gebruikten — woorden sequentieel verwerken, één voor één, zoals een zin van links naar rechts lezen — deed de Transformer recurrentie volledig af en vertrouwde uitsluitend op aandacht.

De sleutelinnovaties waren:

1. **Zelf-aandacht**: Elk woord in een zin besteedt aandacht aan elk ander woord in dezelfde zin, waarbij relaties parallel worden berekend in plaats van sequentieel. Dit legt verwijzingen over lange afstanden vast zonder het informatieknelpunt van RNN's, en — cruciaal — het paralleliseert op moderne hardware (GPU's en TPU's), waardoor training dramatisch sneller verloopt.

2. **Multi-hoofd-aandacht**: In plaats van één aandachtspatroon te berekenen, berekent het model meerdere aandachtspatronen tegelijkertijd ("hoofden"), elk mogelijk verschillende soorten taalkundige relaties vastleggend — syntactisch, semantisch, positioneel.

3. **Positionele codering**: Omdat zelf-aandacht alle woorden tegelijkertijd verwerkt (in tegenstelling tot RNN's, die sequentieel verwerken), heeft het model geen inherent begrip van woordvolgorde. Positionele coderingen — wiskundige functies die in de invoer worden geïnjecteerd — verstrekken deze informatie.

De Transformer overtrof RNN-gebaseerde modellen op vertaalbenchmarks niet alleen. Het trainde **ordes van grootte sneller** vanwege zijn parallellisme. Dit was aantoonbaar even belangrijk als de kwaliteitsverbetering: onderzoekers konden nu sneller itereren, op meer data trainen en opschalen naar grotere modellen. De deugdzame cyclus van schaal was begonnen.

Binnen twee jaar was de Transformer-architectuur het substraat geworden voor vrijwel al het state-of-the-art werk in NLP — niet alleen MT, maar ook taalmodellering, tekstclassificatie, vraagbeantwoording, samenvatting, en uiteindelijk de grote taalmodellen (GPT, BERT, LLaMA) die het bredere AI-landschap zouden hervormen. Elk systeem dat in de rest van dit overzicht wordt besproken, is gebouwd op de Transformer.

### Het WMT 2016-keerpunt

De **Conference on Machine Translation** (WMT), jaarlijks gehouden als workshop naast grote NLP-conferenties, organiseert competitieve **gedeelde taken** waarbij onderzoeksteams MT-systemen indienen en worden gerangschikt op gestandaardiseerde testsets. WMT is het dichtst bij een publiek scorebord dat het MT-veld kent.

Op **WMT 2016** overtroffen neurale MT-systemen zinsdeel-gebaseerde SMT-systemen beslissend voor vrijwel alle taalparen in de gedeelde taak. Dit was het moment waarop het zwaartepunt van het veld verschoof. Onderzoekers die carrières hadden opgebouwd met het bouwen van zinsdeel-gebaseerde systemen begonnen zich om te scholen voor het neurale paradigma. Binnen twee jaar waren nieuwe publicaties die zinsdeel-gebaseerde SMT gebruikten voor iets anders dan historische vergelijking vrijwel opgehouden. Moses, de tool die een decennium had gedefinieerd, werd functioneel buiten gebruik gesteld.

De overgang verliep opmerkelijk snel naar de maatstaven van academische paradigmaverschuivingen — misschien drie tot vier jaar van Bahdanau's artikel uit 2014 tot de bijna volledige dominantie van neurale MT in 2018. Voor een onderzoeker die het veld vandaag betreedt, is zinsdeel-gebaseerde SMT historische context, geen actieve onderzoeksrichting. Maar het is essentiële context, omdat de aannames, benchmarks en evaluatiegewoonten van het SMT-tijdperk nog steeds door het veld weerklinken.

---

## Deel 2: De Meertalige Wending (2018–2022) {#part-2-the-multilingual-turn-20182022}

### Één Model, Vele Talen

De eerste generatie neurale MT-systemen waren **tweetalig**: één model per taalpaar. Engels–Frans vereiste één model; Frans–Engels vereiste een apart model. Dit aanpak opschalen naar N talen vereiste theoretisch N×(N−1) modellen — een technisch en data-knelpunt dat neurale MT effectief beperkte tot een handvol goed-bedeelde taalparen.

De vraag die 2018–2022 definieerde was: *kan één neuraal model leren om tegelijkertijd tussen vele talen te vertalen?* Het antwoord bleek ja, met diepgaande en gecompliceerde gevolgen.

### Taaloverkoepelende Representaties: mBERT en XLM-R

Voordat meertalige vertaalmodellen arriveerden, legde een onverwachte ontdekking in taal*begrip*smodellen de basis.

Eind 2018 bracht Google **Multilingual BERT (mBERT)** uit — een enkel Transformer-model getraind op Wikipedia-tekst uit 104 talen. BERT (Bidirectional Encoder Representations from Transformers) was geen vertaalmodel; het was een algemeen taalcoderingssysteem, getraind om gemaskeerde woorden in tekst te voorspellen. Wat onderzoekers verbaasde was een emergente eigenschap: mBERT ontwikkelde **taaloverkoepelende representaties** zonder ooit expliciet te zijn geleerd dat talen verwant waren. Als u mBERT fijn-afstemde op een Engelse sentimentclassificatietaak en het vervolgens toepaste op Franse tekst — zonder enige Franse trainingsdata — presteerde het opmerkelijk goed. Dit verschijnsel, **zero-shot taaloverkoepelende overdracht** genoemd, suggereerde dat meertalige modellen een soort gedeelde representatieruimte over talen heen leerden.

In 2020 duwde **Alexis Conneau** en collega's bij Facebook AI Research (nu Meta) dit verder met **XLM-R** (Cross-lingual Language Model – RoBERTa). Getraind op 2,5 terabyte gefilterde CommonCrawl-data in 100 talen, overtrof XLM-R mBERT aanzienlijk op taaloverkoepelende benchmarks. Het toonde aan dat met voldoende data en modelcapaciteit één encoder robuuste meertalige representaties kon opbouwen.

Deze modellen waren zelf geen vertalers, maar ze boden de conceptuele en technische basis voor meertalige MT. Als een model gedeelde representaties kon leren over 100 talen, dan zou een vertaalmodel er in principe tussen moeten kunnen vertalen.

### Veel-naar-Veel Vertaling: M2M-100

Traditionele meertalige MT-systemen hadden een verborgen geheim: ze routeerden de meeste vertalingen **via het Engels**. Vertalen van Portugees naar Japans betekende eerst Portugees naar Engels vertalen, dan Engels naar Japans. Deze "Engels-centrische" aanpak was pragmatisch — de meeste parallelle data heeft Engels aan één kant — maar introduceerde cumulatieve fouten en legde Engelstalige structuur op aan elke vertaling.

In oktober 2020 publiceerde Facebook AI **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): een veel-naar-veel vertaalmodel dat **100 talen en 2.200 vertaalrichtingen** dekt zonder via het Engels te routeren. Dit was een conceptuele doorbraak. Het model kon rechtstreeks vertalen tussen, zeg, Bengaals en Swahili, met behulp van parallelle data die van het web was gewonnen voor niet-Engelse taalparen.

M2M-100 bewees dat Engels als tussentaal geen noodzakelijke beperking was van meertalige MT. Maar het onthulde ook de grenzen van de aanpak: de kwaliteit was sterk ongelijk over taalparen heen, waarbij sommige richtingen nauwelijks bruikbaar waren. De kloof tussen "dit model *dekt* 2.200 richtingen" en "dit model *werkt goed* in 2.200 richtingen" zou een centraal thema worden.

### NLLB-200: No Language Left Behind

Meta's meest ambitieuze meertalige MT-inspanning arriveerde in juli 2022 met **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), gepubliceerd als een Meta AI-onderzoekspaper met meer dan 200 co-auteurs). Het doel was expliciet in de naam: bouw één model dat 200 talen ondersteunt, met bijzondere aandacht voor taalarmede talen die eerder door commerciële MT werden genegeerd.

De technische bijdragen van NLLB-200 waren aanzienlijk:

- **Architectuur**: Een dichte Transformer en een **Mixture-of-Experts (MoE)**-variant, waarbij verschillende deelverzamelingen van de parameters van het model activeren voor verschillende taalparen. De grootste variant, NLLB-200-MoE-54B, had 54 miljard parameters. Een gedestilleerde versie van 600M parameters maakte implementatie haalbaar.

- **Data-mining**: Het team ontwikkelde geautomatiseerde tools om parallelle zinnen te winnen uit webcrawls, waaronder een taalidentificatiemodel (voor 200+ talen) en een filter voor parallelle zinnen. Deze pijplijn was cruciaal voor het verzamelen van trainingsdata voor talen met minimale webpresentie.

- **FLORES-200**: Een gestandaardiseerde evaluatiebenchmark die alle 200 talen dekt met professioneel vertaalde zinnen. FLORES-200 werd een essentieel instrument voor het veld — eerder bestond er voor de meeste van deze talen geen benchmark.

- **Open publicatie**: Zowel het model als FLORES-200 werden openlijk gepubliceerd, waardoor onderzoekers wereldwijd op het werk konden voortbouwen.

NLLB-200 was een mijlpaal, maar de beperkingen ervan zijn even belangrijk om te begrijpen. De kwaliteit varieerde enorm over talen heen. Voor goed-bedeelde taalparen (Engels–Frans, Engels–Chinees) was het model competent maar niet state-of-the-art vergeleken met gespecialiseerde systemen. Voor taalarmede talen varieerde de uitvoerkwaliteit van bruikbaar tot vrijwel niet-functioneel, afhankelijk van hoeveel trainingsdata was gewonnen. Het model vertoonde ook de **vloek van meertaligheid**: het toevoegen van meer talen aan een model met vaste capaciteit verdunt de representatiekwaliteit voor elke taal. Taalarmede talen profiteren van overdrachtsgeleren (gedeelde structuur met verwante talen), maar taalrijke talen kunnen er daadwerkelijk *slechter* op worden naarmate het model te veel meesters probeert te dienen. Dit is niet louter een schaalprobleem — het weerspiegelt een fundamentele spanning in het ontwerp van meertalige modellen.

### De Seamless-suite

Meta bleef doorwerken aan meertalige MT met de **Seamless**-familie van modellen in 2023–2024. **SeamlessM4T** ("Massively Multilingual and Multimodal Machine Translation," augustus 2023) was één model dat **spraak-naar-spraak, spraak-naar-tekst, tekst-naar-spraak en tekst-naar-tekst-vertaling** verwerkte in ongeveer 100 talen (met wisselende dekking over modaliteiten). Dit vertegenwoordigde een convergentie van eerder afzonderlijke onderzoekslijnen — automatische spraakherkenning (ASR), tekstvertaling en tekst-naar-spraak (TTS) — in één verenigd meertalig systeem.

De daaropvolgende **Seamless Communication**-suite voegde streamingmogelijkheden toe (bijna-realtime vertaling) en expressieve spraakvertaling (het bewaren van vocale kenmerken zoals emotie en spreekstijl over talen heen). Deze systemen blijven onderzoeksprototypes in plaats van productieklare tools, maar ze geven de richting van het veld aan: multimodaal, meertalig en realtime.

### Wat "Massief Meertalig" in de Praktijk Betekent

Voor een onderzoeker die dit veld betreedt, is het cruciaal onderscheid te maken tussen de **taaldekking** van een model en de **taalkwaliteit** ervan. Een model dat "200 talen ondersteunt" kan uitstekende vertalingen bieden voor 20 ervan, bruikbare uitvoer voor 50, en voor de rest vrijwel willekeurige tekst. Het kopcijfer is misleidend zonder kwaliteitsbeoordeling per taal.

De **vloek van meertaligheid** is de technische term voor het capaciteitsverdunningsprobleem: een model met eindige parameters kan niet alle talen even goed vertegenwoordigen. Het toevoegen van meer talen baat de taalarmste talen (door taaloverkoepelende overdracht van verwante talen), maar schaadt de taalrijkste (door capaciteit te verbruiken die aan hen had kunnen worden gewijd). Dit creëert een ontwerpsspanning: bouwt u één universeel model, of vele gespecialiseerde? Het veld heeft deze vraag nog niet opgelost.

---

## Deel 3: Het LLM-tijdperk (2022–2026) {#part-3-the-llm-era-20222026}

### Toen Algemene AI Leerde Vertalen

De komst van grote taalmodellen (LLM's) — GPT-3.5/4, Gemini, Claude, LLaMA — creëerde een merkwaardige situatie in het MT-veld. Deze modellen waren niet specifiek getraind voor vertaling. Ze waren getraind om het volgende token te voorspellen in enorme tekstcorpora, voornamelijk Engels maar steeds meer meertalig. Toch produceerden ze, wanneer ze werden aangestuurd met instructies als "Vertaal de volgende Franse zin naar het Engels," vertalingen die voor taalparen met veel data verrassend goed waren.

Dit confronteerde het veld met een identiteitsvraag: als algemene AI even goed kan vertalen als doelgerichte vertaalsystemen, blijft "machinevertaling" dan een afzonderlijk onderzoeksgebied? Het antwoord is, vanaf 2026, een gekwalificeerd ja — maar de relatie tussen MT-onderzoek en de ontwikkeling van algemene LLM's is diep verweven geraakt.

### De Eerste Benchmarks: LLM's versus Toegewijde MT

De systematische evaluatie van LLM's voor vertaling begon begin 2023, kort na de release van ChatGPT (november 2022) en GPT-4 (maart 2023).

**Jiao et al. (2023)**, in ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745), gaven een vroege beoordeling. Hun bevindingen vestigden een patroon dat opmerkelijk stabiel is gebleven: LLM's zijn **zeer competitief voor Europese taalparen met veel data** (Engels–Duits, Engels–Frans, Engels–Chinees) en **aanzienlijk zwakker voor taalarmede en typologisch verre taalparen**. Ze introduceerden ook **pivot-prompting** — het model instrueren om via een tussentaal te vertalen — wat de prestaties op moeilijke taalparen verbeterde.

**Hendy et al. (2023)** bij Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) voerden een uitgebreidere evaluatie uit over 18 vertaalrichtingen. Hun conclusie: GPT-modellen evenaarden state-of-the-art commerciële MT voor taalparen met veel data, maar hadden "beperkte capaciteit" voor taalarmede talen.

Tegen 2024–2025 was het beeld scherper geworden. Voor **taalparen met veel data** evenaarden of overtroffen de beste LLM's (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) toegewijde MT-systemen, met name voor taken die contextueel begrip, idiomatische uitdrukking en coherentie op documentniveau vereisen — gebieden waar traditionele neurale MT, die zinnen afzonderlijk verwerkt, altijd moeite mee heeft gehad. Voor **taalarmede taalparen** presteren toegewijde meertalige modellen zoals NLLB-200 en Google Translate's doelgerichte systemen nog steeds beter dan LLM's, vaak aanzienlijk.

### BLOOM: Het Open Meertalige Moment

In juli 2022 bracht het **BigScience**-collectief — een jaar lang vrijwilligersinspanning gecoördineerd door Hugging Face met honderden onderzoekers wereldwijd — **BLOOM** uit: een open-access meertalig taalmodel met 176 miljard parameters dat **46 natuurlijke talen en 13 programmeertalen** dekt. Getraind op het ROOTS-corpus met behulp van de Jean Zay-supercomputer in Frankrijk, was BLOOM het eerste werkelijk massieve open-access meertalige LLM.

BLOOM was geen toegewijde vertaler, maar zijn betekenis voor MT was aanzienlijk. Het toonde aan dat open-source modellen tientallen talen op schaal konden ondersteunen, en bood een basis voor meertalig onderzoek buiten bedrijfslaboratoria. De instructie-afgestemde variant, **BLOOMZ**, toonde taaloverkoepelende generalisatiemogelijkheden — fijn-afgestemd op taken in één taal, kon het deze in andere talen uitvoeren.

### LLaMA en de Explosie van Fijn-Afstemming

Meta's **LLaMA**-serie (Large Language Model Meta AI), beginnend in februari 2023, nam een andere weg. LLaMA 1 was voornamelijk Engels-gericht, met beperkte meertalige capaciteit. LLaMA 2 (juli 2023) verbeterde marginaal maar classificeerde niet-Engels gebruik nog steeds als "buiten bereik." Het kantelpunt kwam met **LLaMA 3** (april 2024), dat de trainingsdata zevenvoudig uitbreidde en een vocabulaire van 128.000 tokens introduceerde — wat de codering van niet-Engelse tekst dramatisch verbeterde. LLaMA 3 ondersteunde officieel acht talen (Engels, Duits, Frans, Italiaans, Portugees, Hindi, Spaans, Thai) met wisselende kwaliteit voor vele andere.

Het belang van LLaMA voor MT ligt minder in zijn directe vertaalcapaciteit en meer in zijn rol als **basismodel voor fijn-afstemming**. Beide gespecialiseerde vertaal-LLM's die hieronder worden besproken — Tower en ALMA — zijn gebouwd op LLaMA. De open gewichten creëerden een bloeiend ecosysteem van gespecialiseerde afgeleiden.

### Doelgerichte Vertaal-LLM's: Tower en ALMA

De meest significante ontwikkeling van 2023–2024 was de opkomst van LLM's die specifiek zijn fijn-afgestemd voor vertaling — hybride systemen die de contextuele verfijning van algemene LLM's erven maar zijn geoptimaliseerd voor vertaalkwaliteit.

**ALMA** (Advanced Language Model-based trAnslator), ontwikkeld door **Haoran Xu** en collega's aan de Johns Hopkins University, demonstreerde een sleutelinzicht: u heeft geen massieve parallelle corpora nodig om een uitstekende vertaler te bouwen. ALMA gebruikte een **tweefasige fijn-afstemming** op LLaMA-2: eerst voortgezette pre-training op niet-Engelse monolinguale data om meertalige kennis uit te breiden; vervolgens fijn-afstemming op een kleine, hoogwaardige parallelle dataset. Het vervolg, **ALMA-R** (januari 2024), introduceerde **Contrastive Preference Optimisation (CPO)** — het model trainen op voorkeursdata (betere versus slechtere vertalingen) in plaats van alleen parallelle tekst. Het resultaat: modellen van 7B en 13B parameters die GPT-4 evenaarden of overtroffen op vertaalbenchmarks. Het artikel werd gepubliceerd op ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Een latere versie, **X-ALMA**, breidde de dekking uit naar 50 talen met taalspecifieke plug-and-play-modules.

**Tower**, ontwikkeld door **Unbabel** (een Portugees AI-vertaalbedrijf) in samenwerking met SARDINE Lab en MICS Lab, nam een bredere kijk. In plaats van uitsluitend voor vertaling te optimaliseren, dekte Tower de **volledige vertaalpijplijn**: broncorrectie, herkenning van benoemde entiteiten, post-editing, vertaalrangschikking en foutdetectie. De initiële Tower-modellen (7B en 13B, gebaseerd op LLaMA-2) overtroffen NLLB-200-54B. **Tower v2** (70B, gepresenteerd op WMT 2024) overtrof GPT-4o, Claude 3.5 Sonnet en DeepL. Het nieuwste **Tower+** (2025) breidde uit naar 22–27 talen en pakte "catastrofaal vergeten" aan — de neiging van fijn-afgestemde modellen om algemene capaciteiten te verliezen — via voorkeursoptimalisatie en versterkend leren.

### Prompting versus Fijn-Afstemming: Het Voortdurende Debat

Een aanhoudende vraag in de LLM-MT-ruimte is of het beter is een algemeen LLM te **prompten** voor vertaling (zero-shot of few-shot) of een model specifiek voor vertaling te **fijn-afstemmen**. Het bewijs suggereert dat het antwoord taakafhankelijk is:

- **Prompting** behoudt de algemene capaciteiten van het LLM — formaliteitssturing, stijlcontrole, coherentie op documentniveau — en vereist geen aanvullende training. Het is ideaal voor snelle iteratie en creatieve of contextuele vertaling.
- **Fijn-afstemming** produceert hogere nauwkeurigheid voor specifieke taalparen en domeinen, maar riskeert het degraderen van andere capaciteiten ("catastrofaal vergeten"). Het vereist parallelle data en rekenkracht.
- **Hybride benaderingen** domineren in de praktijk steeds meer: fijn-afgestemde modellen voor initiële vertaling, met LLM-gebaseerde post-editing of zelf-verfijningspassen.

### De Huidige Stand van Zaken (2025–2026)

Het eerlijke antwoord op "wat is het beste MT-systeem?" is: **het hangt ervan af**.

| Gebruiksscenario | Beste Aanpak | Waarom |
|---|---|---|
| Veel data, hoog volume | Commerciële NMT (Google, DeepL) | Snelheid, kosten, consistentie |
| Veel data, hoge kwaliteit | LLM's (GPT-4o, Gemini 2.5 Pro) of Tower+ | Contextueel begrip, idioomverwerking |
| Weinig data, brede dekking | Meta OMT, NLLB-200, Google Translate | Doelgerichte meertalige dekking |
| Weinig data, specifiek taalpaar | Fijn-afgestemde NLLB of LLM op domeindata | Gerichte kwaliteitsverbetering |
| Open-source onderzoek | Tower+, ALMA-R, X-ALMA | Open gewichten, reproduceerbaar, competitief |

In maart 2026 bracht Meta **OMT (Omnilingual Machine Translation)** uit — de opvolger van NLLB-200, die de dekking uitbreidde van 200 naar **1.600+ talen**. OMT pakt aan wat Meta het "generatieknelpunt" noemt: grote taalmodellen kunnen veel talen begrijpen maar hebben moeite met het genereren van vloeiende tekst erin. OMT is beschikbaar in twee architecturen — OMT-LLaMA (alleen-decoder, 1B–8B parameters) en OMT-NLLB (encoder-decoder) — en introduceert nieuwe evaluatietools waaronder BOUQuET en BLASER 3 (een referentievrije kwaliteitsschattingsmetriek). Vroege rapporten geven aan dat de 1B–8B-parametermodellen 70B LLM-basislijnen evenaren of overtreffen op vertaaltaken. Of OMT uiteindelijk Plains Cree of andere Algonquiaanse talen zal omvatten, valt nog te bezien.

Het WMT 2024-bevindingenpaper was treffend getiteld **"The LLM Era Is Here but MT Is Not Solved Yet."** LLM's hebben het plafond voor vertaling met veel data verhoogd, maar hebben de fundamentele uitdagingen van taalarmede MT, evaluatietoereikendheid of morfologische complexiteit niet opgelost.

---

## Deel 4: Het Probleem van Taalarmede {#part-4-the-low-resource-problem}

### Waarom de Meeste Talen Achterblijven

Van de ongeveer 7.000 levende talen in de wereld dekken geïmplementeerde commerciële MT-diensten er ruwweg 200, en elke vorm van automatische vertaling gecombineerd bereikt er slechts ongeveer 550 ([hoe we tellen](/docs/network/context/coverage-counting)). De overgrote meerderheid van de talen heeft **helemaal geen automatische vertaling**. Om te begrijpen waarom, moet u begrijpen wat MT-systemen nodig hebben en wat de meeste talen missen.

Neurale MT vereist **parallelle data**: grote verzamelingen zinnen die door mensen tussen twee talen zijn vertaald. Voor Engels–Frans bestaat deze data in overvloed — EU-parlementaire verslagen (Europarl), VN-documenten, nieuwsarchieven en commerciële vertaalgeheugens bieden honderden miljoenen parallelle zinnen. Voor een taal als Plains Cree (*nêhiyawêwin*), gesproken door ongeveer 20.000 mensen voornamelijk in het westen van Canada, bestaat dergelijke data vrijwel niet. Er zijn geen VN-verslagen in Plains Cree. Er zijn geen tweetalige nieuwscorpora. De totale beschikbare parallelle tekst kan worden gemeten in duizenden zinnen in plaats van miljoenen.

Het veld gebruikt ruwe resourceniveaus om talen te categoriseren:

| Niveau | Beschikbare Parallelle Data | Voorbeelden |
|---|---|---|
| Veel data | >10 miljoen zinsparen | Engels, Frans, Duits, Chinees, Spaans |
| Gemiddeld data | 1–10 miljoen paren | Turks, Vietnamees, Swahili |
| Weinig data | 100K–1 miljoen paren | Yoruba, Guaraní, Maltees |
| Extreem weinig data | <100K paren | Plains Cree, Quechua, de meeste Inheemse talen |
| Vrijwel nul | <10K paren | Duizenden talen wereldwijd |

### Het Tokenisatieprobleem

Voordat een neuraal model tekst kan verwerken, moet het tekens omzetten in numerieke tokens — een proces dat **tokenisatie** wordt genoemd. Het dominante tokenisatie-algoritme is **Byte Pair Encoding (BPE)**, gepopulariseerd door Sennrich et al. (2016) en geïmplementeerd in tools zoals **SentencePiece** (Kudo & Richardson, 2018). BPE werkt door de meest voorkomende tekenreeksen in een trainingskorpus te leren en een vocabulaire van subwoordeenheden op te bouwen. In het Engels worden veelgebruikte woorden zoals "the" één token; zeldzame woorden worden opgesplitst in subwoordstukken ("unforgivable" → "un" + "forgiv" + "able").

Het probleem is dat BPE-vocabulaires voornamelijk worden getraind op talen met veel data, waarbij het Engels doorgaans domineert. Voor taalarmede talen, met name die met complexe morfologie of niet-Latijnse schriften, zijn de gevolgen ernstig:

- **Over-segmentatie**: Één woord in een polysynthetische taal zoals Plains Cree kan een volledige bijzin coderen. Het woord *nikî-nipâw* ("ik sliep") zou worden opgesplitst in talrijke fragmenten — mogelijk afzonderlijke bytes — omdat het BPE-algoritme deze tekenreeksen nooit eerder heeft gezien. Wat voor een spreker één betekenisvolle eenheid is, wordt voor het model een dozijn betekenisloze fragmenten.

- **Het vruchtbaarheidsprobleem**: Één woord in een morfologisch complexe taal kan 5–15 tokens vereisen, terwijl de Engelse vertaling ervan 1–3 gebruikt. Dit creëert een enorme asymmetrie in reekslengte die de aandachtsuitlijning en vertaalkwaliteit verslechtert.

- **Schriftstraffen**: Talen die niet-Latijnse schriften gebruiken (Cree-syllabics, Ethiopisch, Devanagari) worden nog minder efficiënt getokeniseerd, soms terugvallend op afzonderlijke bytes. Dit betekent dat het effectieve contextvenster van het model dramatisch kleiner is voor deze talen.

Dit is niet louter een technisch ongemak. Het vocabulaire van de tokenisator codeert effectief een voorkeur voor goed-bedeelde talen op het meest fundamentele niveau van het systeem. Een model dat 15 tokens besteedt aan het coderen van één Cree-woord heeft veel minder capaciteit over voor het begrijpen van de rest van de zin vergeleken met een model dat Engels verwerkt, waar dezelfde informatie misschien 3 tokens in beslag neemt.

### Het Datakwaliteitsprobleem

De beperkte parallelle data die wel bestaat voor taalarmede talen komt vaak uit **smalle domeinen**. De twee grootste bronnen van meertalige parallelle tekst voor talen met weinig middelen zijn:

1. **Bijbelvertalingen**: De Bijbel is in meer dan 700 talen vertaald, en gedeelten in meer dan 3.000. Dit maakt religieuze tekst de meest beschikbare parallelle bron voor veel talen — maar een model dat voornamelijk op bijbelse tekst is getraind, leert een specifiek register, vocabulaire en domein. Het kan "gij zult niet" produceren, maar kan "boek alstublieft een vlucht" niet vertalen.

2. **JW300**: Een dataset gewonnen uit publicaties van Jehovah's Getuigen, die ongeveer 300 talen dekt. Hoewel groot en meertalig, roept JW300 zowel domeinscheefheidsproblemen (religieuze inhoud) als ethische bezwaren op met betrekking tot de herkomst en toestemming van de onderliggende vertalingen.

**Benchmarkcontaminatie** is een andere ernstige zorg. Wanneer parallelle data schaars is, kan dezelfde tekst terechtkomen in zowel trainings- als evaluatiesets — een datalek dat kwaliteitsmetrieken opblaast. Hoe kleiner de datapool, hoe moeilijker dit te voorkomen en te detecteren is.

### Data-augmentatie: Meer Halen uit Minder

Onderzoekers hebben technieken ontwikkeld om beperkte data te rekken:

- **Terugvertaling** (Sennrich et al., 2016): Train een initieel model op beschikbare parallelle data, gebruik het vervolgens om **monolinguale** doeltaaltekst terug te vertalen naar de brontaal. Dit creëert synthetische parallelle data die ruis bevat maar de modelkwaliteit aanzienlijk kan verbeteren. Terugvertaling is een standaardtechniek geworden over het hele resourcespectrum.

- **LLM-gegenereerde synthetische data**: Grote taalmodellen gebruiken om trainingsdata te genereren voor taalarmede taalparen. Dit is veelbelovend maar introduceert risico's — de gegenereerde tekst kan "translationese" vertonen (onnatuurlijk letterlijke of bronbeïnvloede patronen) en kan de vooroordelen in het LLM versterken.

- **Taaloverkoepelende overdracht**: Trainen op parallelle data van een verwante taal met meer middelen (bijv. Spaans–Engelse data gebruiken om Guaraní–Engelse MT op te starten) en hopen dat de gedeelde structurele kenmerken worden overgedragen. Dit werkt beter voor nauw verwante talen dan voor typologisch verre talen.

- **Morfologische segmentatie**: Tekst voorverwerken om woorden op te splitsen in morfemen (kleinste betekenisvolle eenheden) voordat ze aan het model worden aangeboden. Voor agglutinerende en polysynthetische talen kan dit de tokenisatie-efficiëntie en vertaalkwaliteit dramatisch verbeteren. Deze aanpak sluit direct aan bij de regelgebaseerde tools die in het volgende deel worden besproken.

---

## Deel 5: Eindige-Toestandstransducers en Regelgebaseerde Systemen {#part-5-finite-state-transducers-and-rule-based-systems}

### Waarom Regels Nog Steeds Belangrijk Zijn

Het verhaal tot nu toe is er één van neurale dominantie: statistische systemen vervangen door neurale netwerken, neurale netwerken vervangen door Transformers, Transformers opgeschaald naar LLM's. Maar er is een parallelle traditie in de computationele taalkunde die nooit is verdwenen — en voor bepaalde talen blijft ze onmisbaar.

**Regelgebaseerde systemen** coderen expliciete taalkundige kennis: morfologische regels, lexicons, syntactische overdrachtspatronen. Ze leren niet van data; ze worden gebouwd door taalkundigen die de betrokken talen begrijpen. Voor goed-bedeelde talen werd deze aanpak al lang geleden overtroffen door datagestuurde methoden. Maar voor talen met complexe morfologie en minimale data bieden regelgebaseerde systemen vaak de enige betrouwbare analyse die beschikbaar is.

### Eindige-Toestandstransducers: Een Inleiding

Een **Eindige-Toestandstransducer (FST)** is een computationeel apparaat dat mapt tussen twee representatieniveaus — doorgaans tussen een oppervlaktevorm (wat u in tekst ziet) en een onderliggende analyse (wat het taalkundig betekent). Beschouw het als een machine met toestanden en overgangen: het leest invoersymbolen, beweegt tussen toestanden en produceert uitvoersymbolen.

Neem als concreet voorbeeld het Plains Cree-woord *nikî-nipâw*. Een FST-gebaseerde morfologische analysator kan deze oppervlaktevorm nemen en produceren:

> nipâw + Werkwoord + AI + Onafhankelijk + Verleden + 1e Persoon Enkelvoud

Dit vertelt u dat het woord het werkwoord *nipâw* ("slapen") is in de onafhankelijke orde, verleden tijd, eerste persoon enkelvoud — "ik sliep." De transducer codeert de regels van de Cree-morfologie: welke prefixen persoon aangeven, welke tijd markeren, welke werkwoordvormen welke verbuigingspatronen aannemen. Cruciaal is dat dit **bidirectioneel** werkt: gegeven een analyse kan de FST de correcte oppervlaktevorm genereren.

De technische infrastructuur voor het bouwen van FST's omvat:

- **HFST** (Helsinki Finite-State Transducer Technology): Een open-source toolkit onderhouden aan de Universiteit van Helsinki, die het computationele kader biedt voor het bouwen en uitvoeren van transducers. HFST implementeert de formalismen die oorspronkelijk door Xerox zijn ontwikkeld (lexc, twolc, xfst) en is compatibel met **foma**, een andere open-source FST-toolkit.

- **lexc**: Een formalisme voor het specificeren van het **lexicon** — de inventaris van morfemen (wortels, prefixen, achtervoegsels) en de woordvormingspatronen die ze combineren.

- **twolc**: Een formalisme voor het specificeren van **morfologisch-fonologische regels** — de klankverschuivingen die optreden wanneer morfemen worden gecombineerd (bijv. klinkerharmonie, medeklinkerverandering).

### GiellaLT: Arctische Infrastructuur

**GiellaLT** (van het Noord-Samisch woord *giella*, "taal") is een taaltechnologie-infrastructuur gevestigd aan **UiT — De Arctische Universiteit van Noorwegen** in Tromsø. Het vertegenwoordigt de meest uitgebreide inspanning wereldwijd om FST-gebaseerde tools te bouwen voor Inheemse en minderheidstalen.

Oorspronkelijk bekend als **Giellatekno** (onderzoek) en **Divvun** (taalhulpmiddelen), heeft het project — geleid door taalkundigen **Trond Trosterud** en **Sjur Nørstebø Moshagen** — morfologische analysatoren, spellingcontroles en andere taalhulpmiddelen ontwikkeld voor meer dan **100 talen**, met een focus op Samische talen (Noord-Samisch, Lule-Samisch, Zuid-Samisch en andere), Oeraalse talen en andere Arctische en inheemse talen.

GiellaLT gebruikt HFST als computationele backend en heeft een geavanceerde gedeelde infrastructuur ontwikkeld: een gemeenschappelijk bouwsysteem, gedeelde testframeworks en herbruikbare taalkundige componenten. Alle code is open-source, gehost op [GitHub](https://github.com/giellalt), met honderden repositories waaronder kerninfrastructuur en taalspecifieke repo's (bijv. `lang-sme` voor Noord-Samisch, `lang-crk` voor Plains Cree). De projectdocumentatie bevindt zich op [giellalt.github.io](https://giellalt.github.io/). Het publiekgerichte portaal, **[Borealium.org](https://borealium.org)** — gefinancierd door de Noordse Ministerraad — biedt gratis toegang tot proofingtools, toetsenborden, woordenboeken, taalleertools (Oahpa) en spraaksynthese voor Samische talen, Kvens, Faeröers, Groenlands en andere.

De relatie tussen GiellaLT en nationaal taalbeleid is opmerkelijk. Een groot deel van de financiering van het project komt van het **Noorse Samisch Parlement** en Noordse overheidstaalprogramma's, wat een politieke inzet voor Inheemse taaltechnologie weerspiegelt die ongebruikelijk is in omvang en duur.

### Apertium: Open-Source Regelgebaseerde MT

**[Apertium](https://www.apertium.org/)** is een open-source regelgebaseerd machinevertaalplatform, oorspronkelijk ontwikkeld aan de Universitat d'Alacant (Spanje) met financiering van de Spaanse en Catalaanse overheden. Het begon in 2004 met een focus op verwante taalparen (Spaans–Catalaans, Spaans–Portugees) waarbij ondiepe overdrachtsregels — woord voor woord vertalen met morfologische aanpassingen — verrassend goede resultaten opleveren. Belangrijke bijdragers zijn onder meer **Francis M. Tyers**, die centraal heeft gestaan in zowel de ontwikkeling van Apertium als de adoptie ervan voor talen met weinig middelen.

De architectuur van Apertium is een klassieke **pijplijn**:

1. **Morfologische analyse** (FST-gebaseerd): Identificeer het lemma en de morfologische kenmerken van elk woord
2. **Woordsoortdisambiguatie**: Kies de juiste analyse wanneer woorden ambigu zijn
3. **Lexicale overdracht**: Wijs brontaallemmata toe aan doeltaallemmata
4. **Structurele overdracht**: Pas regels toe voor woordvolgordeveranderingen, congruentie en andere syntactische verschillen
5. **Morfologische generatie** (FST-gebaseerd): Produceer de correct verbuigde doeltaaloppervlaktevorm

Vanaf 2025 ondersteunt Apertium honderden taalparen op wisselende kwaliteitsniveaus, allemaal gehost op [GitHub](https://github.com/apertium). Het wordt actief ontwikkeld door een internationale gemeenschap en is bijzonder nuttig voor nauw verwante taalparen waar de regelgebaseerde aanpak redelijke kwaliteit kan bereiken zonder trainingsdata.

### Hybride Benaderingen: FST + Neuraal

De meest veelbelovende grens voor taalarmede MT kan **hybride architecturen** zijn die regelgebaseerde morfologische analyse combineren met neurale vertaling. Het idee is eenvoudig: gebruik een FST om woorden op te splitsen in morfemen (het tokenisatieprobleem beschreven in Deel 4 oplossend), en voer de gesegmenteerde tekst vervolgens aan een neuraal MT-systeem.

Voor een polysynthetische taal zoals Plains Cree betekent dit dat het neurale model een reeks betekenisvolle eenheden ontvangt in plaats van willekeurige bytefragmenten. Het **Alberta Language Technology Lab (ALT Lab)** aan de Universiteit van Alberta, geleid door **Antti Arppe**, heeft uitgebreide FST-gebaseerde morfologische analysatoren en gemeenschapsgerichte woordenboektools gebouwd voor Plains Cree met behulp van de GiellaLT-infrastructuur. Hun meest recente gepubliceerde werk (Arppe 2025, AmericasNLP) demonstreert FST-gebaseerde mapping tussen verbuigde Cree-woordvormen en Engelse zinsdelen — in wezen "beperkte vertaling" via eindige-toestandsmethoden, werkend op woord-/zinsdelniveau in plaats van volledige zinnen. Opmerkelijk is dat ALT Lab **geen** hybride FST+neuraal MT-systeem heeft gepubliceerd; hun werk is taalkundig gefundeerd, regelgebaseerd en geeft prioriteit aan betrouwbaarheid en gemeenschapsnut boven experimentele neurale benaderingen. Ondertussen demonstreerden Nguyen, Hammerly en Silfverberg (2025, AmericasNLP) een hybride LLM+FST-pijplijn voor Ojibwe-werkwoorden aan UBC, met sterke resultaten (chrF 0,82) — het dichtstbijzijnde gepubliceerde analogon van een hybride aanpak voor een Algonquiaanse taal.

Deze hybride strategie vertegenwoordigt een convergentie van de twee tradities die door de geschiedenis van MT hebben gelopen: de expliciete kennis van de taalkundige en het statistische leren van de ingenieur. Voor de talen die MT het meest nodig hebben, is geen van beide tradities alleen voldoende.

---

## Deel 6: Kwaliteit Meten — Het Evaluatieprobleem {#part-6-measuring-quality--the-evaluation-problem}

### Hoe Weet U of een Vertaling Goed Is?

Deze vraag klinkt eenvoudig. Het is in feite een van de moeilijkste onopgeloste problemen in het veld, en hoe u het beantwoordt, bepaalt welke systemen lijken te "werken" en welke niet.

### BLEU: De Onvolmaakte Standaard

Meer dan twee decennia lang was de dominante automatische metriek in MT **BLEU** (Bilingual Evaluation Understudy), geïntroduceerd door Papineni et al. bij IBM in 2002. BLEU meet hoeveel de woordreeksen (n-grammen) van de machinevertaling overlappen met één of meer menselijke referentievertalingen. Het bevat een beknoptheidsboete om te voorkomen dat systemen de score manipuleren met korte uitvoer.

BLEU werd de valuta van het veld omdat het snel, goedkoop, taalagnostisch en reproduceerbaar is. Vrijwel elk MT-artikel gepubliceerd tussen 2002 en 2020 rapporteerde BLEU-scores. WMT-gedeelde taken gebruikten het jarenlang als primaire metriek.

Maar BLEU heeft diepe gebreken die steeds duidelijker zijn geworden:

- **Geen semantisch begrip**: BLEU is pure oppervlakteovereenkomst. Als een vertaling een perfect synoniem gebruikt dat toevallig niet in de referentie voorkomt, straft BLEU het. De zin "the cat sat on the mat" scoort nul tegenover een referentie van "the feline rested on the rug."
- **Slechte discriminatie op zinsniveau**: BLEU was ontworpen als een metriek op corpusniveau. Op zinsniveau is het onbetrouwbaar en ruis-gevoelig.
- **Morfologische blindheid**: Voor agglutinerende talen (Turks, Fins, Swahili), waarbij één lemma tientallen verbuigde vormen kan hebben, faalt strikte woordniveauovereenkomst catastrofaal. Een correct verbuigd werkwoord dat één achtervoegsel verschilt van de referentie scoort nul.
- **Zwakke correlatie met menselijk oordeel**: Meta-analyses, met name Reiter (2018), hebben aangetoond dat de correlatie van BLEU met menselijke kwaliteitsbeoordelingen vaak zwak is, met name voor hoogwaardige systemen en voor talen die ver van het Engels afstaan.

### chrF en chrF++

**chrF** (character F-score), geïntroduceerd door Maja Popović in 2015, pakt de morfologische blindheid van BLEU aan door overlap te meten op **tekenniveau** in plaats van woordniveau. Dit geeft gedeeltelijk krediet voor gedeelde stammen en wortels, zelfs wanneer verbuigingen verschillen — cruciaal voor morfologisch rijke talen. **chrF++** (Popović, 2017) voegt woordniveau-n-grammen terug toe, waardoor een betere correlatie met menselijk oordeel wordt bereikt dan met alleen-teken- of alleen-woordmetrieken. Beide zijn geïmplementeerd in **sacreBLEU**, de standaard evaluatietoolkit, en zijn standaard secundaire metrieken geworden in WMT-gedeelde taken.

### COMET en xCOMET: Neurale Evaluatie

De meest significante vooruitgang in MT-evaluatie is de overgang naar **neurale metrieken** — evaluatiemodellen die zelf Transformers zijn, getraind om menselijke kwaliteitsoordelen te voorspellen.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), ontwikkeld door Ricardo Rei en collega's bij **Unbabel** (2020), gebruikt een taaloverkoepelende encoder (XLM-RoBERTa) om de bronzin, de vertaling en de referentie in te bedden, en voorspelt vervolgens een kwaliteitsscore. In tegenstelling tot BLEU werkt COMET in semantische ruimte — het herkent parafrasen, legt betekenisbehoud vast en heeft consequent een veel hogere correlatie met menselijk oordeel aangetoond dan oppervlaktemetrieken. COMET won of eindigde eerste in WMT Metrics Shared Tasks vanaf 2020.

**xCOMET** (Guerreiro et al., 2024, gepubliceerd in TACL) gaat verder: naast een kwaliteitsscore produceert het **fijnmazige foutspandetectie** — het identificeren van specifieke fouten in de vertaling, het classificeren ervan op type (nauwkeurigheid, vloeiendheid, terminologie) en ernst (klein, groot, kritiek). Dit overbrugt de kloof tussen automatische scoring en menselijke taalkundige analyse.

### AfriCOMET: Evaluatie voor de Onderbedeelden

Standaard COMET, voornamelijk getraind op menselijke oordelen in Europese talen, generaliseert mogelijk niet goed naar typologisch verschillende talen. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) pakt dit aan door fijn-afstemming op menselijke evaluatiedata van **13 Afrikaanse talen** en het gebruik van **AfroXLM-R** — een meertalige encoder die specifiek is getraind om Afrikaanse talen beter te vertegenwoordigen. Dit werk, geproduceerd door de Masakhane-gemeenschap (zie Deel 7), toont aan dat evaluatiemetrieken zelf moeten worden aangepast voor taalkundige diversiteit.

### Menselijke Evaluatie: MQM en Directe Beoordeling

Automatische metrieken zijn benaderingen. De grondwaarheid blijft **menselijke evaluatie**, die twee primaire vormen aanneemt:

**Directe Beoordeling (DA)** vraagt menselijke beoordelaars om vertalingen te scoren op een schaal van 0–100. Het is relatief snel en goedkoop (uitbestede beoordelaars kunnen worden gebruikt) en was de primaire menselijke evaluatiemethode bij WMT van 2017 tot 2020. De zwakte: naarmate de MT-kwaliteit verbeterde, konden niet-deskundige beoordelaars geen onderscheid meer maken tussen systemen die bijna-professionele uitvoer produceerden. DA werd onbetrouwbaar aan de top van het kwaliteitsspectrum.

**Multidimensionele Kwaliteitsmetrieken (MQM)** vervingen DA als de primaire menselijke evaluatiemethode van WMT vanaf 2021. MQM gebruikt **professionele vertalers** die specifieke foutspannen in de vertaling markeren, fouten classificeren op type (verkeerde vertaling, weglating, grammatica, terminologie) en ernst (klein = 1 punt, groot = 5 punten, kritiek = 25 punten). Dit produceert zowel een kwaliteitsscore als bruikbare diagnostische informatie — u weet niet alleen *hoe slecht* een vertaling is, maar *wat er specifiek mis is gegaan*.

| Kenmerk | DA | MQM |
|---|---|---|
| Beoordelaars | Uitbestede medewerkers | Professionele vertalers |
| Methode | Holistische score 0–100 | Foutspanannotatie |
| Diagnostiek | Geen | Gedetailleerde foutcategorisering |
| Kosten | Lager | Hoger |
| Betrouwbaarheid | Zwakker voor hoogwaardige MT | Gouden standaard |
| WMT primair gebruik | 2017–2020 | 2021–heden |

### De Evaluatiecrisis voor Taalarmede Talen

Voor taalarmede talen wordt het evaluatieprobleem verergerd door verschillende factoren:

- **Geen gekwalificeerde beoordelaars**: MQM vereist tweetalige professionele vertalers. Voor veel taalarmede talen is het vinden van dergelijke beoordelaars uiterst moeilijk.
- **Geen referentievertalingen**: Zowel COMET als BLEU vereisen referentievertalingen voor vergelijking. Voor veel domeinen en talen bestaan deze niet.
- **Metriekbias**: Zowel oppervlaktemetrieken als neurale metrieken zijn ontwikkeld en gevalideerd op Europese taaldata. Hun gedrag voor typologisch verre talen is onzeker.
- **Hallucinatierisico**: In taalarmede omgevingen kunnen MT-modellen vloeiende uitvoer produceren die volledig niets te maken heeft met de bron — een verschijnsel dat **hallucinatie** wordt genoemd. Oppervlaktemetrieken kunnen niet-nul scores toekennen aan gehallucineerde uitvoer als deze toevallig n-grammen deelt met de referentie.

Het bouwen van **aangepaste evaluatiesets** — zelfs kleine van 200–500 zorgvuldig samengestelde zinsparen in het doeldomein — is essentieel voor elke serieuze taalarmede MT-inspanning. Uitsluitend vertrouwen op FLORES-200 of BLEU-scores zonder domeinspecifieke evaluatie is een recept voor vals vertrouwen.

---

## Deel 7: Het Institutionele Landschap {#part-7-the-institutional-landscape}

### Bedrijfsactoren

Het MT-veld wordt gevormd door een handvol grote bedrijfsactoren, elk met afzonderlijke strategieën:

**Google Translate** blijft wereldwijd het meest gebruikte MT-systeem; de Cloud Translation API vermeldt **194 talen** ([de gepubliceerde lijst van Google](https://docs.cloud.google.com/translate/docs/languages) — het consumentenproduct adverteert er meer, maar Google publiceert hiervoor geen statische first-party lijst). Het **1000 Languages Initiative** van Google (aangekondigd in 2022) is gericht op het bouwen van AI-modellen die de 1.000 meest gesproken talen ter wereld dekken. De Cloud Translation API biedt twee niveaus: Basic (verouderde NMT) en Advanced (nieuwste modellen). Google heeft zijn Gemini LLM-mogelijkheden in toenemende mate geïntegreerd in Translate, waarbij contextbewuste, idiomatische vertaalfuncties in 2025 verschijnen.

**Meta** heeft zichzelf gepositioneerd als de primaire drijvende kracht achter open-source meertalige MT via NLLB-200, M2M-100, FLORES-200 en de Seamless-suite. Meta's filosofie van open modelrelease is transformatief geweest voor academisch onderzoek, en biedt basislijnen en tools die anders onbetaalbare rekenkracht zouden vereisen.

**DeepL** bezet een kwaliteitsgerichte niche, met ondersteuning voor ongeveer **33 talen** — allemaal relatief goed-bedeeeld — met een reputatie voor natuurlijke, idiomatische uitvoer die de voorkeur geniet van professionele vertalers. DeepL's bedrijfsmodel (freemium consument + betaalde API voor ondernemingen) en zijn formaliteitsparameter (die formeel versus informeel register regelt) weerspiegelen een focus op professionele vertaalworkflows in plaats van brede taaldekking.

**Microsoft Translator** (onderdeel van Azure AI Services) biedt vertalingen in **135 talen** met enterprise-integratie via Microsoft 365 en Teams. De Custom Translator-functie stelt organisaties in staat om modellen te verfijnen op basis van domeinspecifieke gegevens.

**Unbabel** combineert MT met menselijke post-editing in een "human-in-the-loop"-workflow, naast zijn onderzoeksbijdragen (COMET, xCOMET, Tower). Het vertegenwoordigt de commerciële toepassing van het "MT + menselijke beoordeling"-paradigma.

**LibreTranslate**, gebouwd op de **Argos Translate**-engine, biedt een volledig open-source, zelf-hostbaar MT-alternatief zonder bedrijfsafhankelijkheid — belangrijk voor organisaties met vereisten op het gebied van datasoevereiniteit.

### Basisgemeenschappen

Sommige van de belangrijkste werkzaamheden in MT — met name voor onderbedeelde talen — vinden plaats in gemeenschapsgestuurde onderzoeksorganisaties:

**[Masakhane](https://www.masakhane.io/)** (van het isiZulu voor "we bouwen samen") is een basisonderzoeksgemeenschap gericht op NLP voor Afrikaanse talen, opgericht in 2019. Met honderden leden op het continent en in de diaspora heeft Masakhane fundamentele datasets (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), evaluatiemetrieken (AfriCOMET) en onderzoek geproduceerd dat de Afrikaanse-taal-NLP aanzienlijk heeft bevorderd. Sleutelfiguren zijn onder meer **David Ifeoluwa Adelani** (Mila / UCL). Code en data zijn gehost op [GitHub](https://github.com/masakhane-io); de primaire communicatiehub is hun Slack-werkruimte (deelnemen via masakhane.io), met wekelijkse gemeenschapsvergaderingen. Masakhane werkt op principes van Afrikaans eigenaarschap van Afrikaanse taaltechnologie — een bewuste tegenhanger van extractieve onderzoekspatronen waarbij externe instellingen data verzamelen van taalgemeenschappen zonder zinvolle samenwerking. Ze ontmoedigen expliciet "parachute-onderzoek" waarbij buitenstaanders taalkundige data extraheren zonder zinvol gemeenschapspartnerschap.

**AmericasNLP** is een workshopserie (naast NAACL) gericht op NLP voor Inheemse talen van de Amerika's. Georganiseerd door onderzoekers waaronder **Manuel Mager**, **Arturo Oncevay** en **Luis Chiruzzo**, organiseert het gedeelde taken over MT voor talen zoals Quechua, Guaraní, Aymara, Nahuatl, Rarámuri en andere. De workshop brengt onderzoeksuitdagingen naar voren die uniek zijn voor de Amerika's — polysynthetische morfologie, tonale systemen, extreme dataschaarsheid en de politieke dimensies van taaltechnologie voor gekoloniseerde volkeren.

**[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) aan de Universiteit van Alberta, geleid door **Antti Arppe**, richt zich specifiek op computationele tools voor Plains Cree en andere Inheemse talen van het westen van Canada. ALT Lab bouwt FST-gebaseerde morfologische analysatoren en gemeenschapsgerichte taaltools (met behulp van de GiellaLT-infrastructuur), en werkt in nauwe samenwerking met Cree-sprekende gemeenschappen — een model voor gemeenschapsgerichte taaltechnologieontwikkeling. Hun publiekgerichte project **[21st Century Tools for Indigenous Languages](https://21c.tools)** biedt online woordenboeken en morfologische tools gebouwd op deze infrastructuur.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (Nationale Onderzoeksraad Canada), geleid door **Patrick Littell**, onderhoudt een actief programma ter ondersteuning van 25+ Inheemse talen in heel Canada, waaronder meerdere Cree-dialecten, Algonquin, Innu en Michif. NRC ILT heeft MT-onderzoek gepubliceerd voor Engels–Inuktitut (met behulp van het Nunavut Hansard-corpus) en ontwikkelt open-source tools waaronder **kiyânaw Transcribe** (Cree- en Ojibwe-transcriptie), morfologische analysatoren en **ReadAlong Studio** (audio-tekstuitlijning). Alle code is open-source en NRC claimt expliciet geen auteursrecht op gemeenschappelijke taalkundige data.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) is een open-science meertalig LLM-initiatief met 3.000+ bijdragers uit 119+ landen. Hoewel geen toegewijd MT-systeem, zijn Aya-modellen (Aya-101 voor 101 talen, Aya 23 voor 23 talen met grote impact, Tiny Aya voor 70 talen bij 3,35B parameters) zeer effectief voor vertaaltaken. De **Aya Collection** — 513M instructiestijl trainingsinstanties — is de grootste open meertalige instructiedataset. Het gemeenschapsbestuursmodel is het bestuderen waard.

**[GhanaNLP / Khaya](https://ghananlp.org)** is een gemeenschapsgestuurd NLP-initiatief dat het **Khaya**-vertaalplatform heeft geproduceerd — een van de weinige gemeenschapsbestuurde MT-systemen die daadwerkelijk voor dagelijks gebruik is ingezet. Khaya biedt neurale machinevertaling, ASR en TTS voor ~12 Ghanese talen (Twi, Ewe, Ga, Fante, Kusaal en andere) via web, mobiele apps en ontwikkelaars-API. Hun aanpak — 40.000+ parallelle zinsparen gebouwd via samenwerking met taalkundigen en gemeenschapsfeedback — toont aan dat gemeenschapsbestuurde MT operationeel kan zijn, niet alleen aspirationeel.

### Financiering en Beleid

MT-onderzoek voor taalarmede talen is afhankelijk van financieringsstromen die heel anders zijn dan het risicokapitaal en de advertentie-inkomsten die commerciële MT ondersteunen:

- **Lacuna Fund**: Een samenwerkend datafonds ondersteund door de Rockefeller Foundation, Google.org, Canada's IDRC en Duitsland's GIZ. Lacuna financiert specifiek de creatie van **gelabelde datasets** voor ondervertegenwoordigde talen — de dataleemte opvullend die de grondoorzaak is van MT-kwaliteitskloven.

- **AI4D** (Artificial Intelligence for Development): Een programma dat AI-onderzoeksbeurzen ondersteunt voor Afrikaanse taaltechnologie, uitgevoerd via IDRC en het Zweedse International Development Cooperation Agency.

- **UNESCO Internationaal Decennium van Inheemse Talen (2022–2032)**: Een politiek kader dat het profiel van Inheemse taaltechnologie wereldwijd heeft verhoogd, hoewel concreet onderzoeksfinanciering bescheiden is gebleven.

- **Inter-Amerikaanse Ontwikkelingsbank**: Financierde het **GuaranIA**-project voor Guaraní–Spaans MT in Paraguay, een voorbeeld van ontwikkelingsfinanciering ter ondersteuning van taaltechnologie.

- **Nationale onderzoeksraden**: Veel taalarmede MT-werk wordt gefinancierd via standaard academische kanalen (NSF, NSERC, EU Horizon-programma's), vaak als onderdelen van bredere AI- of taalkundebeurzen.

---

## Deel 8: Open Grenzen {#part-8-open-frontiers}

### Wat Onopgelost Blijft

Het MT-veld in 2026 is tegelijkertijd capabeler en eerlijker over zijn beperkingen dan op enig eerder punt. Verschillende grensoverschrijdende problemen definiëren het huidige onderzoekslandschap:

**Vertaling op documentniveau** blijft grotendeels onopgelost. De meeste MT-systemen — inclusief veel LLM's — vertalen zin voor zin, waarbij discoursecoherentie, voornaamwoordresolutie over zinsgrenzen heen en stilistische consistentie verloren gaan. Een menselijke vertaler leest het volledige document voordat hij vertaalt; de meeste MT-systemen verwerken zinnen afzonderlijk. Onderzoek naar MT op documentniveau is actief, maar heeft nog geen systemen opgeleverd die betrouwbaar coherentie over lange teksten handhaven.

**Discourse en pragmatiek** — de kloof tussen letterlijke betekenis en communicatieve intentie — blijft MT uitdagen. Ironie, understatement, culturele allusies en registergevoeligheid (formeel versus informeel, respectvol versus casual) worden gedeeltelijk vastgelegd door de beste LLM's, maar inconsistent. Een vertaler die werkt tussen Japans en Engels moet een uitgebreid honoratief systeem navigeren; huidige MT-systemen verwerken dit op zijn best ongelijkmatig.

**Multimodale vertaling** — vertalen in context met afbeeldingen, video of audio — is een opkomend onderzoeksgebied. Een menu-item beschreven als "vliegende viseitjes" is volkomen begrijpelijk met een bijbehorende afbeelding; zonder die afbeelding kan MT iets vreemds produceren. De Seamless-suite en multimodale LLM's (Gemini, GPT-4o) zijn hiermee begonnen, maar robuuste multimodale MT blijft een grensgebied.

**Realtime spraak-naar-spraak-vertaling** met natuurlijke latentie (minder dan 3 seconden vertraging), behoud van sprekeridentiteit en overdracht van emotionele toon nadert productiegereedheid voor taalparen met veel data. Google, Meta en verschillende startups demonstreerden prototypesystemen in 2025. Voor taalarmede talen blijft realtime spraakvertaling ver weg.

**De "laatste mijl" voor taalarmede talen** is misschien het belangrijkste onopgeloste probleem van het veld. De kloof tussen een FLORES-200-benchmarkscore en werkelijk nut voor een taalgemeenschap is enorm. Een model dat 15 BLEU scoort op Plains Cree–Engels-vertaling is voor geen enkel praktisch doel bruikbaar. Het dichten van deze kloof vereist niet alleen betere modellen, maar ook betere data, betere evaluatie, betere tokenisatie en — cruciaal — echte samenwerking met taalgemeenschappen in plaats van extractie van taalkundige bronnen voor academische publicaties.

**Post-editing en mens-AI-samenwerking** wordt het dominante paradigma voor professionele vertaling. In plaats van menselijke vertalers te vervangen, wordt MT steeds meer gepositioneerd als een eerste-conceptgenerator die menselijke vertalers vervolgens verfijnen. Het begrijpen van de cognitieve wetenschap van post-editing, het meten van post-editinginspanning en het ontwerpen van interfaces die mens-AI-samenwerking ondersteunen, zijn actieve onderzoeksgebieden met directe commerciële implicaties.

### De Politieke Dimensies

MT is niet politiek neutraal. De keuze van welke talen te ondersteunen, welke data te verzamelen, wie de modellen beheert en wiens kwaliteitsnormen van toepassing zijn, zijn allemaal beslissingen met significante gevolgen voor taalgemeenschappen.

De dominantie van het Engels als tussentaal codeert een bepaalde opvatting van vertaling als iets dat via het Engels stroomt. Het gebruik van Bijbel- en missionaristeksten als trainingsdata voor Inheemse talen roept vragen op over toestemming en culturele gepastheid. De concentratie van MT-capaciteit in een handvol Silicon Valley-bedrijven creëert afhankelijkheidsrelaties die sommige taalgemeenschappen expliciet weerstaan.

**Datasoevereiniteit** is een centraal aandachtspunt. In Canada stellen de **First Nations-datasoevereiniteitsprincipes** dat inheemse gemeenschappen eigenaar zijn van hun gegevens, bepalen hoe deze worden verzameld en gebruikt, er toegang toe hebben en deze fysiek bezitten. Voor MT betekent dit dat trainingsgegevens die zijn afgeleid van teksten in inheemse talen, evaluatiecorpora die zijn opgebouwd uit gemeenschapskennis, en vertaalmodellen die zijn getraind op bronnen in het bezit van de gemeenschap, allemaal onder het beheer van de gemeenschap vallen — niet onder het beheer van de onderzoeksinstelling of het technologiebedrijf dat het model heeft gebouwd.

Dit heeft directe technische implicaties. Een MT-systeem dat is gebouwd met gemeenschapsgegevens kan niet zomaar in de conventionele zin open-source worden gemaakt als de gemeenschap daar niet mee heeft ingestemd. Evaluatiebenchmarks kunnen niet worden gepubliceerd als de testgegevens cultureel gevoelig materiaal bevatten. Een "community-owned model" is geen contradictie — het is een ontwerpvereiste. Elke serieuze inspanning op het gebied van low-resource MT voor inheemse talen moet standaard soevereiniteits-aspirant zijn — ontworpen voor eigenaarschap en zeggenschap van de gemeenschap over taaldata — niet als een bijgedachte.

Dit zijn niet louter ethische voetnoten — ze vormen onderzoeksprioriteiten, financieringsbeslissingen en technische architecturen. "Betere MT bouwen" is onlosmakelijk verbonden met vragen over wie er baat bij heeft, wie beslist en wiens taalkundige kennis wordt gewaardeerd.

---

## Bijlage A: Sleutelpublicaties {#appendix-a-key-papers}

Een chronologische leeslijst van de artikelen die de koers van het veld hebben bepaald. Elke vermelding bevat een korte noot over waarom het van belang is.

| Jaar | Artikel | Auteurs | Betekenis |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Vestigde de dominante MT-evaluatiemetriek voor twee decennia |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Demonstreerde neurale encoder-decoder-vertaling |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Introduceerde het aandachtsmechanisme |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Bracht neurale MT naar productieschaal |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Introduceerde BPE-tokenisatie voor MT |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Introduceerde terugvertaling voor data-augmentatie |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Introduceerde de Transformer-architectuur |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: taaloverkoepelende representaties voor 100 talen |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: veel-naar-veel zonder Engels als tussentaal |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Neurale evaluatiemetriek met hoge menselijke correlatie |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | NLLB Team (Meta) | 200-talig MT-model + FLORES-200-benchmark |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | LLM-fijn-afstemming voor state-of-the-art vertaling met weinig data |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Volledige vertaalpijplijn in één LLM |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Fijnmazige foutdetectie in MT-evaluatie |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | MT-evaluatie aangepast voor Afrikaanse talen |

---

## Bijlage B: Conferenties en Gemeenschappen {#appendix-b-conferences-and-communities}

### Grote Conferenties

Het ecosysteem van NLP/MT-conferenties volgt een jaarlijks ritme. De onderstaande tabel vermeldt de belangrijkste locaties, gevolgd door de data van recente edities.

| Conferentie | Volledige Naam | Frequentie | Opmerkingen |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Jaarlijks | De primaire competitieve venue van het veld; gedeelde taken definiëren benchmarks |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Jaarlijks | De vlaggenschip-NLP-conferentie |
| **EMNLP** | Empirical Methods in NLP | Jaarlijks | Tweede-rang vlaggenschip; organiseert doorgaans WMT |
| **NAACL** | North American Chapter of the ACL | Jaarlijks (roteert met ACL) | Grote regionale conferentie |
| **EACL** | European Chapter of the ACL | Tweejaarlijks | Europese regionale conferentie |
| **COLING** | Intl. Conf. on Computational Linguistics | Tweejaarlijks | Was samengevoegd met LREC voor 2024; nu weer afzonderlijk |
| **LREC** | Language Resources & Evaluation Conference | Tweejaarlijks | Focus op data, bronnen en evaluatie |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Jaarlijks | Focus op spraakvertaling |

#### Recente edities

*Alleen data — opzettelijk. Een "status"-kolom met de vermelding **Aankomend** is onjuist op de
dag dat het evenement begint, en deze pagina kan de datum van vandaag niet weten. Vergelijk de onderstaande data
zelf met de kalender; de verslagen van elk evenement dat al heeft plaatsgevonden, staan
in de [ACL Anthology](https://aclanthology.org).*

| Evenement | Data | Locatie |
|---|---|---|
| **COLING 2025** | 19–24 jan 2025 | Abu Dhabi, VAE |
| **EACL 2026** | 24–29 mrt 2026 | Rabat, Marokko |
| **LREC 2026** | 11–16 mei 2026 | Palma de Mallorca, Spanje |
| **ACL 2026** | 2–7 jul 2026 | San Diego, VS |
| **AmericasNLP 2026** | 3–4 jul 2026 (samen met ACL) | San Diego, VS |

*ACL 2025 (Wenen), EMNLP 2025 (Suzhou), WMT 2025 (Suzhou), IWSLT 2025 (Wenen) en PACLIC 39 (Hanoi) vonden allemaal plaats in 2025. Hun verslagen zijn beschikbaar op de [ACL Anthology](https://aclanthology.org).*

#### WMT 2025 Gedeelde Taken

WMT-gedeelde taken zijn het dichtst bij een publieke competitie dat het MT-veld kent. De editie van 2025 omvat:

- **Algemene Machinevertaling** — de vlaggenschiptaak
- **Geautomatiseerde Vertaalevaluatiesystemen** — uniforme metrieken en kwaliteitsschatting
- **Vertaling van Indische Talen met Weinig Data**
- **Vertaling van Creooltalen**
- **Terminologiegerichte Taak**
- **Modelcompressie** — MT-modellen kleiner en sneller maken
- **Open Taaldata** — verbetering van open trainingsdata
- **Meertalige Instructiegerichte Taak (MIST)**
- **Slavische LLM's met Beperkte Middelen**

### Gespecialiseerde Workshops

| Workshop | Focus | Meest recente bekende editie | Samen met |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Inheemse talen van de Amerika's | 3–4 jul 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP voor Afrikaanse talen | 31 jul 2025 (ACL 2025, Wenen) | ACL / ICLR |
| **LoResMT** | Low-resource MT | Meestal jaarlijks op *ACL-conferenties | Diversen |
| **SIGTYP** | ACL SIG over linguïstische typologie | Jaarlijkse workshop | ACL |

### Belangrijke Gemeenschapsbronnen

- **[machinetranslate.org](https://machinetranslate.org)** — Gemeenschapsgestuurd, open-source kennisbank over MT-technologie. Beheerd door de Machine Translate Foundation (non-profit, Zug, Zwitserland, opgericht 2021). Dekt benaderingen, API's, modellen, taalondersteuning en branchenieuws. Gelicentieerd onder CC BY-SA 4.0. Een uitstekend startpunt voor elk onderwerp in dit overzicht.

- **[ACL Anthology](https://aclanthology.org)** — Het definitieve open-access archief van NLP/CL-onderzoeksartikelen. Elk artikel op ACL, EMNLP, NAACL, EACL, WMT en verwante venues is hier vrij beschikbaar.

---

## Bijlage C: Tools, Datasets en Praktische Bronnen {#appendix-c-tools-datasets-and-practical-resources}

Deze bijlage behandelt de concrete tools en databronnen die er vandaag toe doen in MT-werk. Ze is geschreven voor mensen die hun weg kennen in een terminal, maar het MT-ecosysteem mogelijk niet kennen.

### Trainingsframeworks

Dit zijn de softwarepakketten die worden gebruikt om neurale MT-modellen *te trainen* vanaf nul (of bestaande modellen fijn af te stemmen). U zou deze gebruiken als u uw eigen vertaalmodel bouwt in plaats van een bestaand model via een API te gebruiken.

| Framework | Ontwikkelaar | Taal | Opmerkingen |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Edinburgh | C++ | De snelste open-source NMT-trainer — kan een model 3–5× sneller trainen dan op PyTorch gebaseerde alternatieven. Geschreven in puur C++ met minimale afhankelijkheden. Drijft Microsoft Translator aan. Elk OpusMT-model (zie hieronder) is ermee getraind. Vernoemd naar Marian Rejewski, de Poolse wiskundige die hielp Enigma te kraken. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | Meta's werkpaard-onderzoekstoolkit — gebruikt om M2M-100, NLLB-200 en het meeste gepubliceerde MT-werk van Meta te bouwen. Zeer modulair: u kunt architecturen, verliesfuncties en dataverwerking verwisselen. De standaardkeuze voor onderzoekers die Meta's werk reproduceren of uitbreiden. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | Het meest toegankelijke startpunt voor het trainen van aangepaste MT-modellen. Ontstaan als een Harvard-onderzoeksproject, nu onderhouden door SYSTRAN (een commercieel MT-bedrijf). Bevat CTranslate2 voor implementatie (zie hieronder). Goede documentatie voor beginners. |

**Wanneer zou u deze gebruiken?** Als u parallelle data heeft (zelfs een paar duizend zinsparen) en een toegewijd vertaalmodel wilt trainen of fijn-afstemmen voor een specifiek taalpaar. U zou deze NIET gebruiken voor LLM-gebaseerde vertaling (GPT/Claude/Gemini prompten), waarvoor geen training nodig is — alleen API-aanroepen.

### Inferentie en Implementatie

Deze tools voeren *reeds getrainde* modellen uit om vertalingen te produceren. Beschouw de bovenstaande trainingsframeworks als "de werkplaats waar de auto wordt gebouwd" en deze als "de contactsleutel die de auto start."

| Tool | Wat Het Doet | Wanneer Te Gebruiken |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Een C++-engine die Transformer-modellen met hoge snelheid en laag geheugengebruik uitvoert. Ondersteunt INT8/INT4-kwantisatie (modellen verkleinen tot 1/4 van hun grootte met minimaal kwaliteitsverlies). Draait op CPU of GPU zonder PyTorch geïnstalleerd te hebben. Ondersteunt NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Wanneer u een vertaalmodel zelf wilt hosten op een server of laptop zonder een GPU-cluster. De standaardkeuze voor productie-implementatie van open-source MT-modellen. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Python-bibliotheek die modellen laadt en uitvoert met een paar regels code: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Biedt ~1.500 vooraf getrainde OpusMT tweetalige modellen plus NLLB-200, mBART, mT5 en M2M-100. | Wanneer u de snelste weg wilt van "ik wil iets vertalen" naar werkende code. Twee regels Python en u vertaalt al. Lagere doorvoer dan CTranslate2, maar veel eenvoudiger in te stellen. |

### Vooraf Getrainde Modelfamilies

Dit zijn *reeds getrainde* vertaalmodellen die u direct kunt downloaden en gebruiken. Geen training vereist — gewoon laden en vertalen.

| Modelfamilie | Talen | Ontwikkelaar | Wat Het Is | Waar Te Vinden |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1.000+ paren | Universiteit van Helsinki (Jörg Tiedemann) | De grootste verzameling open-source tweetalige vertaalmodellen. Elk model verwerkt één taalpaar (bijv. `opus-mt-en-fr` voor Engels→Frans). Getraind op OPUS-data met Marian NMT, omgezet naar PyTorch-formaat voor Hugging Face. Kwaliteit varieert — uitstekend voor goed-bedeelde taalparen, marginaal voor taalarmede. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 talen | Meta | Een enkel meertalig model dat vertaalt tussen elk van 200 talen. Beschikbaar in varianten van 600M, 1,3B en 3,3B parameters. De 600M-versie draait op een laptop; de 3,3B-versie heeft een fatsoenlijke GPU nodig. Kwaliteit varieert enorm — sterk voor gemiddeld-bedeelde talen, vaak slecht voor werkelijk taalarmede talen. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 talen | Meta | De voorganger van NLLB-200 — eerste model dat rechtstreeks vertaalt tussen niet-Engelse taalparen (bijv. Bengaals↔Swahili) zonder via het Engels te routeren. Historisch belangrijk; grotendeels vervangen door NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 talen | Unbabel | Niet alleen een vertaler — verwerkt de volledige vertaalpijplijn (correctie, NER, post-editing, kwaliteitsschatting) in één LLM. Fijn-afgestemd vanuit LLaMA. Vanaf 2025 overtreft Tower v2 (70B) GPT-4o en DeepL op verschillende benchmarks. | Hugging Face |
| **ALMA / X-ALMA** | 50 talen | Johns Hopkins University | Op LLaMA gebaseerde modellen die specifiek zijn fijn-afgestemd voor vertaling met behulp van voorkeursoptimalisatie (het model leren welke vertalingen mensen prefereren). De 7B- en 13B-versies evenaren GPT-4-kwaliteit voor goed-bedeelde taalparen. X-ALMA breidt uit naar 50 talen met taalspecifieke adaptermodules. | Hugging Face |

### Parallelle Databronnen

Parallelle data is de brandstof voor het trainen van MT-modellen: verzamelingen zinnen in twee talen die vertalingen van elkaar zijn, regel voor regel uitgelijnd. Zonder parallelle data kunt u geen conventioneel MT-model trainen. (LLM-gebaseerde vertaling omzeilt dit — u kunt GPT prompten om te vertalen zonder enige parallelle data — maar toegewijde modellen hebben het nog steeds nodig.)

| Dataset | Omvang | Wat Het Is | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ zinsparen, 1.000+ talen | De meest belangrijke bron voor MT-data. Een meta-verzameling die tientallen sub-corpora (zie hieronder) samenvoegt in één doorzoekbaar portaal. Gemaakt en onderhouden door Jörg Tiedemann aan de Universiteit van Helsinki. Als u op zoek bent naar parallelle data in welke taal dan ook, is OPUS waar u begint. Toegankelijk via webportaal, Python `opustools`-pakket en Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M woorden/taal, 21 EU-talen | Verslagen van het Europees Parlement — toespraken van politici vertaald in alle officiële EU-talen. Gemaakt door Philipp Koehn. Historisch fundamenteel (de dataset die SMT-onderzoek mogelijk maakte), maar beperkt tot EU-talen en parlementair register. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Miljarden paren, 29+ taalparen | EU-gefinancierd project dat het web crawlt om van nature voorkomende parallelle tekst te vinden (tweetalige websites, vertaalde pagina's). Veel ruwer dan samengestelde corpora, maar enorm groter. Publiceerde de **Bitextor** open-source crawlingpijplijn, die iedereen kan gebruiken om zijn eigen parallelle data van het web te winnen. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M URL-paren, 137 Engels-gekoppelde richtingen | Webgewonnen parallelle documenten van Common Crawl (Meta/JHU). Bijzonder nuttig voor talen met weinig tot gemiddeld data die niet voorkomen in samengestelde corpora. Kwaliteit is lager dan Europarl, maar dekking is veel breder. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M parallelle zinnen, 1.620 paren | Parallelle zinnen automatisch gewonnen uit Wikipedia met behulp van LASER meertalige inbeddingen (Meta). Nuttig omdat Wikipedia in veel talen bestaat — maar de uitlijning is automatisch (niet door mensen geverifieerd), dus sommige paren zijn ruis-gevoelig of onjuist. | GitHub (LASER-repo) |
| **[Tatoeba](https://tatoeba.org)** | 500+ talen | Een door de gemeenschap onderhouden verzameling voorbeeldzinnen en hun vertalingen, bijgedragen door vrijwilligers wereldwijd. Afzonderlijke zinnen, geen documenten. De bijbehorende **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** (Helsinki-NLP) biedt schone train/test-splitsingen voor duizenden taalparen — gebruikt om de OpusMT-modellen te trainen. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 talen | Een gestandaardiseerde evaluatiebenchmark (GEEN trainingsdata). Professioneel vertaalde zinnen die worden gebruikt om systemen op gelijke voet te vergelijken. Gemaakt door Meta naast NLLB-200. Als u uw systeem wilt vergelijken met gepubliceerde basislijnen, is dit de testset die u moet gebruiken. | Hugging Face |

### Belangrijke Sub-Corpora binnen OPUS

OPUS aggregeert veel onafhankelijke parallelle corpora. Bij het zoeken naar data in een specifieke taal zijn deze sub-verzamelingen het bekijken waard:

- **OpenSubtitles** — Film- en tv-ondertitels. Enorm volume maar ruis-gevoelig — ondertitels zijn vaak vereenvoudigd, informeel en kunnen transcriptiefouten bevatten.
- **JW300** — Publicaties van Jehovah's Getuigen, voor ~300 talen. De breedste taaldekking van welke afzonderlijke corpus dan ook, maar sterk domeinschef naar religieuze inhoud en ethisch omstreden (zie Deel 4).
- **Bijbel** — Bijbelvertalingen in 700+ talen. Het smalste domein van allemaal (oude religieuze tekst), maar voor veel talen de enige parallelle tekst die überhaupt bestaat.
- **Tanzil** — Koranvertalingen. Nuttig voor Arabisch-gekoppelde data.
- **GNOME / KDE** — Softwarelokalisatiestrings ("Bestand → Opslaan", "Weet u zeker dat u wilt verwijderen?"). Nuttig voor technisch/UI-domein, maar zeer formulaïsch.
- **EMEA** — Documenten van het Europees Geneesmiddelenbureau. Nuttig voor biomedische domeinvertaling.

---

## Bijlage D: Woordenlijst {#appendix-d-glossary}

**Aandachtsmechanisme**: Een neuraal netwerkelement dat het model in staat stelt dynamisch te focussen op verschillende delen van de invoer bij het produceren van elk deel van de uitvoer. Geïntroduceerd door Bahdanau et al. (2014) voor MT; gegeneraliseerd in de Transformer (2017).

**Terugvertaling**: Een data-augmentatietechniek waarbij monolinguale doeltaaltekst wordt terugvertaald naar de brontaal door een voorlopig MT-systeem, waardoor synthetische parallelle data voor training wordt gecreëerd.

**BLEU**: Bilingual Evaluation Understudy. Een automatische MT-evaluatiemetriek gebaseerd op n-gram precisie-overlap met referentievertalingen.

**BPE (Byte Pair Encoding)**: Een subwoordtokenisatie-algoritme dat iteratief de meest frequente tekenparen samenvoegt om een vocabulaire op te bouwen. Gebruikt in vrijwel alle moderne NMT- en LLM-systemen.

**COMET**: Een neurale MT-evaluatiemetriek die taaloverkoepelende inbeddingen gebruikt om menselijke kwaliteitsoordelen te voorspellen, werkend op bron + hypothese + referentie.

**Vloek van meertaligheid**: Het verschijnsel waarbij het toevoegen van meer talen aan een meertalig model de kwaliteit per taal verdunt vanwege vaste modelcapaciteit.

**Encoder–decoder**: Een neurale architectuur waarbij een encoder de invoerreeks verwerkt tot representaties, en een decoder de uitvoerreeks genereert vanuit die representaties.

**FLORES-200**: Een gestandaardiseerde MT-evaluatiebenchmark die 200 talen dekt, gemaakt door Meta naast NLLB-200.

**FST (Eindige-Toestandstransducer)**: Een computationeel apparaat dat mapt tussen invoer- en uitvoersymbolreeksen met behulp van toestanden en overgangen. Gebruikt in computationele morfologie om woordvormen te analyseren en te genereren.

**Hallucinatie**: In MT, de productie van vloeiende uitvoer die niets te maken heeft met of ontrouw is aan de brontekst. Bijzonder gebruikelijk in taalarmede omgevingen.

**Taalrijke taal**: Een taal met overvloedige digitale tekst en parallelle vertaaldata (doorgaans >10M zinsparen met het Engels). Voorbeelden: Frans, Duits, Chinees, Spaans.

**LLM (Groot Taalmodel)**: Een neuraal taalmodel met miljarden parameters, getraind op enorme tekstcorpora om het volgende token te voorspellen. Voorbeelden: GPT-4, Gemini, LLaMA, Claude.

**Taalarmede taal (LRL)**: Een taal met beperkte digitale tekst en parallelle data (<1M zinsparen). De overgrote meerderheid van de talen ter wereld valt in deze categorie.

**MQM (Multidimensionele Kwaliteitsmetrieken)**: Een menselijk evaluatiekader waarbij professionele vertalers specifieke foutspannen in vertalingen annoteren, geclassificeerd op type en ernst.

**NMT (Neurale Machinevertaling)**: MT met behulp van neurale netwerken, in tegenstelling tot statistische (SMT) of regelgebaseerde (RBMT) benaderingen.

**Parallelle data / parallel corpus**: Een verzameling teksten in twee talen die vertalingen van elkaar zijn, uitgelijnd op zinsniveau. De primaire trainingsresource voor MT.

**Polysynthetische taal**: Een taal waarbij woorden zijn samengesteld uit vele morfemen, vaak informatie coderenddie in analytische talen zoals het Engels een volledige bijzin zou vereisen. Voorbeelden: Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Een taalonafhankelijke subwoordtokenisator en -detokenisator die BPE en unigramtaalmodelsegmentatie implementeert. Veel gebruikt in meertalige NLP.

**Transformer**: De dominante neurale architectuur voor NLP sinds 2017, volledig gebaseerd op zelf-aandachtsmechanismen. Geïntroduceerd in "Attention Is All You Need" (Vaswani et al., 2017).

**Zero-shot taaloverkoepelende overdracht**: Het toepassen van een model getraind op één taal (doorgaans Engels) op een andere taal zonder enige doeltaaltrainingsdata, vertrouwend op gedeelde meertalige representaties.

---

*Dit overzicht is samengesteld in juni 2026. Het MT-veld beweegt snel; specifieke modelcapaciteiten en benchmarkresultaten dienen te worden geverifieerd aan de hand van actuele bronnen. Voor de laatste ontwikkelingen raadpleegt u [machinetranslate.org](https://machinetranslate.org), de [ACL Anthology](https://aclanthology.org) en de verslagen van de meest recente WMT-gedeelde taak.*


---


## Waar dit toe leidt op deze site

De kloof die deze briefing beschrijft — honderden talen met helemaal geen gemeten
vertaling — is wat de rest van deze site probeert te dichten. Het
argument voor hoe ([Wat Champollion is](/docs/what-is-champollion)), de
economie van het bouwen van een evaluatieset in plaats van een trainingscorpus
([Wie profiteert — onderzoekers](/docs/network/who-benefits#researchers)), en
de staat van wat er tot nu toe daadwerkelijk is gemeten
([Eerlijke beperkingen](/docs/network/honest-limitations)) zijn de drie
logische volgende artikelen om te lezen.
