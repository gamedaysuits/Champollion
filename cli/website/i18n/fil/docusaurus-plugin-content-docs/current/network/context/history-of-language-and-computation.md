---
sidebar_position: 1
title: "Mula kay Pāṇini hanggang sa Transformers"
---

# Mula kay Pāṇini hanggang sa Transformers: Wika, Computation, at ang Hindi Pa Tapos na Gawain ng Pagsasalin

**Isang Kasaysayan ng mga Ideyang Nasa Likod ng champollion**

---

> *"Kapag tumitingin ako sa isang artikulo sa Russian, sinasabi ko: 'Ito ay talagang nakasulat sa English, ngunit naka-code ito sa ilang kakaibang simbolo. Ngayon ay sisimulan ko itong i-decode.'"*
> — Warren Weaver, 1949

---

## Panimula

Ang pangarap ng isang makinang makapagsasalin sa pagitan ng mga wika ng tao ay mas matanda pa kaysa sa computer mismo. Sa isang diwa, ito ang *orihinal* na suliranin ng artificial intelligence—mas matanda kaysa sa mga chess-playing program, mas matanda kaysa sa expert systems, mas matanda kaysa sa neural networks. Madalas na inilalarawan ang pagnanais na ito sa pamamagitan ng mga talinghagang Europeo tulad ng Tower of Babel, na naglalagay sa pagkakaiba-iba ng wika bilang parusa o problemang dapat lutasin, habang nilalampasan ang katotohanang matagal nang pinangangasiwaan ng mga pre-contact Indigenous society ang napakalaking linguistic diversity sa pamamagitan ng sopistikadong trade languages (tulad ng Chinook Jargon) at sign systems (tulad ng Plains Indian Sign Language) nang hindi hinahangad ang unibersal na homogenization.

Ngunit ang kasaysayang humahantong sa sandaling ito—sa isang mundong kayang magsalin ng malalaking language model ng katanggap-tanggap na French ngunit nagha-hallucinate ng walang saysay sa Cree—ay hindi tuwid na linya. Isa itong habi ng hindi bababa sa apat na magkakaibang hibla: ang pormal na pag-aaral ng wika, ang mathematical theory of computation, ang statistical revolution sa machine learning, at isang mas madilim na kasaysayan na nagpapaliwanag kung *bakit* ang mga wikang higit na nangangailangan ng teknolohiya ang mismong mga wikang wala nito. Ang ikaapat na hiblang iyon ay ang kasaysayan ng colonial language suppression at cultural genocide—ang sinadya at sistematikong pagwasak sa mga Indigenous language sa bawat kontinente kung saan nagtatag ng kapangyarihan ang mga Europeong imperyo. Kung hindi mauunawaan ang kasaysayang iyon, ang teknikal na problema ay magmumukhang aksidente lamang ng kakulangan sa datos. Hindi ito aksidente.

Sinusundan ng papel na ito ang lahat ng apat na hibla mula sa kanilang pinagmulan hanggang sa kanilang pagtatagpo sa kasalukuyan. Inaamin, medyo Whiggish ito—ikinukuwento nito ang kasaysayan na para bang lagi itong patungo rito. Siyempre, hindi alam ng kasaysayan kung saan ito papunta. Ngunit tunay ang mga hibla, tunay ang mga ugnayan, at mahalaga ang pag-unawa sa mga ito upang maunawaan kung bakit umiiral ang mga proyektong tulad ng champollion, kung bakit ganito ang pagkakagawa sa mga ito, at kung bakit mahalaga ang mga ito ngayon.

---

## I. Ang Grammar ng Lahat: Mula kay Pāṇini hanggang kay Chomsky

### Ang Unang Formal Grammar (c. 4th Century BCE)

Nagsisimula ang kuwento hindi sa isang unibersidad sa Europe kundi sa sinaunang India, sa isang iskolar na nagngangalang Pāṇini. Bandang ika-4 na siglo BCE, binuo ni Pāṇini ang *Aṣṭādhyāyī*—isang grammar ng Sanskrit na binubuo ng humigit-kumulang 4,000 tuntunin. Hindi ito grammar sa maluwag at pedagogical na kahulugan. Isa itong *generative* grammar: isang may hangganang hanay ng mga tuntunin na, sa prinsipyo, kayang lumikha ng bawat wastong pahayag sa wika.

Gumamit ang sistema ni Pāṇini ng makikilala natin ngayon bilang formal rewriting rules, na may variables, recursion, at ordered application. Ipinahayag ng linguist na si Paul Kiparsky na ang *Aṣṭādhyāyī* ay "ang pinakakumpletong generative grammar ng anumang wikang naisulat pa" (Kiparsky, 1993). Ipinakita ng computer scientist na si Gerard Huet na maaaring i-model ang mga tuntunin ni Pāṇini bilang finite-state transducer—ang parehong computational formalism na, makalipas ang dalawampu't limang siglo, magiging sentro sa morphological analysis ng polysynthetic languages.

Hindi alam ni Pāṇini na gumagawa siya ng computer science. Ngunit iyon mismo ang ginagawa niya.

### Ang Rosetta Stone at ang Pagsilang ng Comparative Linguistics (1799)

Sa halos buong naitalang kasaysayan, ang pag-aaral ng wika ay pangunahin nang pag-aaral ng *sariling* wika—o, sa pinakamalawak, pag-aaral ng isang sagrado o klasikal na wika para sa liturgical na layunin. Nagsimula sa isang bato ang intelektuwal na rebolusyong lumikha ng modernong linguistics.

Ang Rosetta Stone, na natuklasan ng mga sundalo ni Napoleon noong 1799, ay naglalaman ng iisang decree sa tatlong script: Egyptian hieroglyphics, Demotic script, at Ancient Greek. Ang pag-dechiper ni Jean-François Champollion sa hieroglyphics noong 1822 ay higit pa sa isang tagumpay sa arkeolohiya. Ipinakita nito ang isang prinsipyong magiging pundasyonal: na maaaring maunawaan ang mga wika *sa pamamagitan ng isa't isa*. Ang pagsasalin ay hindi lamang praktikal na kasanayan; ito ay isang paraan ng siyentipikong pagsisiyasat.

### William Jones at ang Indo-European Hypothesis (1786)

Bago pa man si Champollion, naibigay na ng British philologist na si Sir William Jones ang kanyang tanyag na lecture sa Asiatic Society of Bengal noong 1786, kung saan napansin niyang ang Sanskrit ay may "mas malakas na affinity, kapwa sa mga ugat ng pandiwa at sa mga anyo ng grammar," sa Greek at Latin kaysa maaaring likhain ng aksidente. Iminungkahi ni Jones na ang tatlo ay nagmula sa isang karaniwang ninuno "na, marahil, ay hindi na umiiral."

Ito ang pagsilang ng historical at comparative linguistics. Itinatag nito na ang mga wika ay hindi hiwalay at static na entidad kundi mga kasapi ng mga pamilya—magkakaugnay sa pinagmulan, hinubog ng panahon, at napapailalim sa regular na mga batas ng pagbabago. Sa sarili nitong paraan, isa itong evolutionary theory ilang dekada bago si Darwin.

### Ang Language Trees ni August Schleicher (1861)

Si August Schleicher, isang German linguist, ang tahasang nag-ugnay nito kay Darwin. Noong 1861—dalawang taon lamang matapos ang *On the Origin of Species*—inilathala ni Schleicher ang kanyang *Stammbaum* (family tree) model ng mga Indo-European language. Ang kanyang mga diagram ay halos hindi maipagkaiba sa phylogenetic trees sa biology. Ang mga wika, tulad ng species, ay nagsanga, naghiwalay, at paminsan-minsa'y nalipol.

Ang mga puno ni Schleicher ay isang pagpapasimple (ang mga wika ay *nagtatagpo* rin sa pamamagitan ng contact, borrowing, at creolization), ngunit lubhang naging produktibo ang modelo. Itinatag nito ang prinsipyong ang linguistic diversity ay hindi random noise kundi structured data, na maaaring sumailalim sa sistematikong analysis. At implicit nitong ibinangon ang isang tanong na nananatiling sentral sa aming proyekto: ano ang nangyayari sa mga sangang namamatay?

### Ferdinand de Saussure at ang Arkitektura ng Wika (1916)

Ang sumunod na rebolusyon ay nagmula kay Ferdinand de Saussure, na ang *Cours de linguistique générale* (inilathala posthumously noong 1916 mula sa notes ng mga estudyante) ang nagtatag ng structural linguistics. Gumuhit si Saussure ng malinaw na pagkakaiba sa pagitan ng *langue* (ang abstraktong sistema ng isang wika) at *parole* (aktuwal na pagsasalita). Ipinahayag niyang ang linguistic signs ay *arbitrary*—ang salitang "tree" ay walang likas na koneksyon sa mga puno—at ang kahulugan ay nagmumula sa *differences* sa loob ng isang sistema, hindi sa anumang positibong content.

Ang pangunahing diagram ni Saussure—ang oval na hinati sa *signifié* (signified, ang konsepto) at *signifiant* (signifier, ang sound-image), na pinagdurugtong ng mga arrow na nagpapakita ng kanilang hindi mapaghihiwalay na relasyon—ay naging isa sa mga pinakamaraming nire-reproduce na larawan sa humanities. Itinatag nito ang prinsipyong ang isang wika ay isang *system of systems*, kung saan nakukuha ng bawat elemento ang halaga nito mula sa mga relasyon nito sa lahat ng iba pa.

Malalim ang implikasyon nito para sa pagsasalin. Kung ang kahulugan ay relational at systemic, kung gayon ang pagsasalin ay hindi simpleng pagpapalit ng mga salita. Kinakailangan nitong maunawaan ang buong arkitektura ng isang wika. Maaaring hatiin ng dalawang wika ang mundo sa lubhang magkaibang paraan—isang pananaw na kalaunang pauunlarin (at kung minsan ay sosobrahan) nina Edward Sapir at Benjamin Lee Whorf.

### Sapir, Bloomfield, at ang Pag-aaral ng Indigenous Languages

Sa North America, ang unang bahagi ng ika-20 siglo ay nagdala ng ibang tradisyon ng linguistic fieldwork. Malawak na nakipagtrabaho sina Edward Sapir at Leonard Bloomfield sa Indigenous languages—si Sapir sa Navajo, Nootka, at marami pang iba; si Bloomfield sa Menomini at iba pang Algonquian languages. Nakasalamuha nila ang mga linguistic structure na radikal na naiiba sa anumang nasa Indo-European family.

Partikular na bumuo si Sapir ng typological framework na nag-uuri ng mga wika ayon sa ilang axis, kabilang ang kritikal na pagkakaiba sa pagitan ng *analytic* languages (tulad ng English, kung saan karaniwang maiikli ang mga salita at dinadala ng word order ang kahulugan) at *polysynthetic* languages (tulad ng Cree, kung saan maaaring i-encode ng iisang salita ang ipahahayag ng English bilang buong pangungusap). Maaaring isama ng isang Cree verb form ang subject, object, tense, aspect, evidentiality, at ilang modifying element sa isang morphologically complex na salita.

Itinatag ng gawaing ito ang dalawang katotohanang nananatiling sentral sa aming proyekto. Una: ang mga wika ng mundo ay higit na structurally diverse kaysa sa iminumungkahi ng anumang European-centric model. Ikalawa: marami sa mga wikang ito ay nanganganib na noon pa. Gayunman, bagama't idinokumento ng mga unang structural linguist ang komplikasyong ito, madalas silang lumahok sa "salvage anthropology"—isang extractive academic model na tumuring sa Indigenous people bilang mga "informants" lamang upang bumuo ng Western academic careers. Pinutol ng lapit na ito ang mga wika mula sa kanilang epistemological roots, at naglatag ng daan sa pagtrato sa wika bilang disembodied at extractable data sa halip na mga buhay at relational na sistema.

### Ang Rebolusyon ni Chomsky (1957)

Noong 1957, inilathala ng 28-taong-gulang na MIT linguist na si Noam Chomsky ang *Syntactic Structures*, isang manipis na aklat na sumabog na parang bomba sa larangan. Ipinahayag ni Chomsky na dapat tuklasin ng linguistics ang *generative grammar* ng isang wika—isang may hangganang hanay ng mga tuntunin na makalilikha ng lahat at tanging ang grammatical sentences ng wikang iyon.

Mas provocatively, iminungkahi ni Chomsky ang *Chomsky hierarchy*: isang classification ng formal grammars ayon sa kanilang computational power. May apat na antas ang hierarchy:

- **Type 3 (Regular)**: Kinikilala ng finite automata. Simpleng patterns.
- **Type 2 (Context-Free)**: Kinikilala ng pushdown automata. Recursive structures tulad ng nested parentheses.
- **Type 1 (Context-Sensitive)**: Kinikilala ng linear bounded automata. Mas komplikadong dependencies.
- **Type 0 (Recursively Enumerable)**: Kinikilala ng Turing machines. Anumang computable.

Ipinahayag ni Chomsky na ang natural languages ay nangangailangan ng hindi bababa sa context-free grammars, at posibleng higit pa. Isa itong direktang tulay sa pagitan ng linguistics at mathematical theory of computation. Ang parehong formal tools na binuo ni Alan Turing upang mangatwiran tungkol sa mga limitasyon ng computing ay maaari nang ilapat sa wika ng tao.

Iminungkahi rin ni Chomsky ang ideya ng *Universal Grammar*—na innate ang kapasidad para sa wika, na lahat ng wika ng tao ay may shared deep structural properties, at na tinatakpan ng diversity ng surface forms ang isang underlying unity. Nananatili itong kontrobersyal (maraming typologist at functionalist ang hindi sumasang-ayon), ngunit ang formal tools na ipinakilala ni Chomsky—phrase structure rules, transformational grammars, at ang hierarchy mismo—ang naging pundasyon ng computational linguistics.

---

## II. Ang Pangarap ng Universal Translation

### Ang Thinking Machine ni Ramon Llull (1305)

Ang pangarap na gawing mekanikal ang pag-iisip—at kasama nito, ang pangarap ng mechanical translation—ay kapansin-pansing matanda. Dinisenyo ni Ramon Llull, isang Catalan mystic noong ika-13 siglo, ang *Ars Magna*: isang sistema ng umiikot na concentric discs na may nakasulat na fundamental concepts, na ang mga kombinasyon ay nilalayong lumikha ng lahat ng posibleng katotohanan. Sa isang diwa, ang mga gulong ni Llull ang unang combinatorial logic machine. Kalaunan ay binanggit ni Leibniz si Llull bilang inspirasyon.

### Athanasius Kircher at ang Polygraphia Nova (1663)

Inilathala ni Athanasius Kircher, ang dakilang Jesuit polymath, ang *Polygraphia Nova et Universalis* noong 1663—isang sistema ng "universal writing" na nilalayong magpahintulot ng komunikasyon sa kabila ng language barriers. Nagtalaga ang sistema ni Kircher ng mga numero sa mga konsepto, na maaari namang i-decode sa anumang wika gamit ang naaangkop na table. Sa esensya, isa itong interlingua—isang language-independent representation ng kahulugan.

Hindi masyadong gumana ang sistema. Ngunit nagpatuloy ang *ideya*: na sa pagitan ng alinmang dalawang wika ay may umiiral na common conceptual space, at ang pagsasalin ay usapin ng pagma-map sa pamamagitan nito. Ang interlingua hypothesis na ito ay hindi lamang isang flawed scientific experiment; isa itong epistemological extension ng colonial control, na hindi kayang i-map ang magkakaibang ontologies. Kalaunan, ipo-formalize ng pilosopong si W.V.O. Quine ang kabiguang ito sa kanyang konsepto ng *indeterminacy of translation* (1960), na nagsasabing ang radical translation ay likas na indeterminate. Ang unibersal at context-free na mapping sa pagitan ng pundamental na magkakaibang linguistic systems ay isang philosophical impossibility, hindi lamang engineering hurdle.

### John Wilkins at ang Philosophical Language (1668)

Limang taon lamang matapos si Kircher, inilathala ng English natural philosopher na si John Wilkins ang *An Essay towards a Real Character, and a Philosophical Language*—isang pagtatangkang lumikha ng wikang ang istruktura ay *perpektong sumasalamin sa istruktura ng reality*. Uuriin ang bawat konsepto sa isang malaking taxonomy, at ie-encode ng pangalan nito ang posisyon nito sa taxonomy na iyon.

Nabigo ang proyekto ni Wilkins (tumanggi ang reality sa malinis na classification), ngunit nauna nitong ipinahiwatig ang isang mahalagang bagay: ang ideya na maaaring *i-engineer* ang wika, na maaaring gawing sistematiko at explicit ang relasyon sa pagitan ng mga salita at kahulugan. Sa malalim na diwa, ito ang ginagawa ng computational linguists kapag bumubuo sila ng ontologies at knowledge graphs.

### Leibniz at ang Characteristica Universalis

Si Gottfried Wilhelm Leibniz, na hiwalay na nakaimbento ng calculus at nagdisenyo ng mechanical calculator, ay nangarap ng isang *characteristica universalis*—isang unibersal na formal language kung saan maipapahayag ang lahat ng kaalaman ng tao—at isang *calculus ratiocinator*—isang makinang maaaring mangatwiran sa wikang iyon. "Kung may mga kontrobersyang lilitaw," isinulat ni Leibniz, "hindi na kakailanganin ang pagtatalo sa pagitan ng dalawang pilosopo kaysa sa pagitan ng dalawang accountant. Sapat nang kunin nila ang kanilang mga lapis, umupo sa kanilang mga slate, at sabihin sa isa't isa: Magkalkula tayo."

Inimbento rin ni Leibniz ang binary arithmetic—ang number system na, makalipas ang mga siglo, magiging wika ng digital computers. Ipinakita ng kanyang 1703 paper na *Explication de l'Arithmétique Binaire* na maaaring irepresenta ang anumang numero gamit lamang ang 0 at 1. Nakita niya ito bilang repleksyon ng divine creation (isang bagay mula sa wala), ngunit mapatutunayan itong pundasyon ng lahat ng digital computation.

### Ang Memo ni Warren Weaver (1949)

Nagsisimula ang modernong panahon ng machine translation sa isang memorandum. Noong Hulyo 1949, sumulat ang American mathematician at science administrator na si Warren Weaver kay Norbert Wiener, na nagmumungkahing maaaring ilapat ang mga bagong electronic computer sa pagsasalin. Nilalaman ng kanyang memo ang kapansin-pansing sipi na binanggit sa simula ng papel na ito: ang ideya na ang isang Russian text ay "talagang nakasulat sa English, ngunit... naka-code sa ilang kakaibang simbolo."

Ang metaphor ni Weaver ay hinango mula sa wartime cryptanalysis—ang ideya na ang pagsasalin ay pundamental na isang *decoding* problem. Hindi ito simpleng analogy. Iminungkahi ni Weaver na ang parehong statistical at information-theoretic tools na binuo upang basagin ang mga cipher ng kaaway ay maaaring mailapat sa problema ng pagsasalin.

Lubhang optimistic ang memo, ngunit naglunsad ito ng research program. Sa loob ng limang taon, magaganap ang unang machine translation demonstration.

---

## III. Ang Makinarya ng Pag-iisip: Computation at Information

### George Boole at ang Algebra of Logic (1854)

Noong 1854, inilathala ni George Boole ang *An Investigation of the Laws of Thought*—isang akdang nagbawas ng logical reasoning sa algebraic operations. Ipinakita ni Boole na maaaring manipulahin ang propositions ng logic gamit ang parehong rules gaya ng algebra, kung saan ang AND ay tumutugma sa multiplication, ang OR sa addition, at ang NOT sa complement.

Mukhang mathematical curiosity lamang ang Boolean algebra noong panahong iyon. Magiging operating principle ito ng bawat digital circuit na kailanman ay nabuo.

### Charles Babbage at Ada Lovelace (1837–1843)

Dinisenyo ni Charles Babbage (ngunit hindi kailanman natapos) ang Analytical Engine—isang mechanical, steam-powered, general-purpose computer. Hindi tulad ng nauna niyang Difference Engine (isang specialized calculator), may memory ang Analytical Engine ("the Store"), processing unit ("the Mill"), conditional branching, at looping. Sa prinsipyo, ito ay Turing-complete.

Si Ada Lovelace, na gumagawa mula sa isang paglalarawan ng Engine, ay nagsulat ng detalyadong notes na naglalaman ng malawakang itinuturing na unang published computer program: isang algorithm para sa pagkukuwenta ng Bernoulli numbers (Note G, 1843). Ngunit conceptual ang pinakamalalim na ambag ni Lovelace. Nakita niyang maaaring magmanipula ang Engine ng *symbols*, hindi lamang numbers. "The Analytical Engine weaves algebraical patterns," isinulat niya, "just as the Jacquard loom weaves flowers and leaves." Prescient ang implikasyon—na maaaring ilapat ang computation sa anumang domain na may formal structure, kabilang ang wika.

### Alan Turing at ang Universal Machine (1936)

Noong 1936, inilathala ni Alan Turing ang "On Computable Numbers, with an Application to the Entscheidungsproblem"—isang paper na sabay na nagdefine ng computation, nagpatunay ng mga limitasyon nito, at nag-imbento ng modern computer (sa abstract form).

Ang pangunahing insight ni Turing ay ang *universal machine*: isang solong machine na, kapag binigyan ng tamang instructions na naka-encode sa tape nito, ay maaaring magsimulate ng *anumang ibang* machine. Itinatag nito na walang essential difference sa pagitan ng hardware at software, sa pagitan ng machine at program. Ang isang device, kapag wastong na-program, ay maaaring magcompute ng anumang computable.

Itinatag din ng gawa ni Turing ang mga limitasyon ng computation (ang halting problem) at inilatag ang batayan para sa kanyang kalaunang eksplorasyon ng machine intelligence. Ang kanyang 1950 paper na "Computing Machinery and Intelligence," na nagmungkahi ng tanyag na Turing Test, ay tahasang nag-frame ng tanong ng machine intelligence sa mga termino ng *wika*: intelligent ang isang machine kung, sa pamamagitan ng pag-uusap, hindi ito makikilala mula sa tao.

### Claude Shannon at Information Theory (1948)

Noong 1948, inilathala ni Claude Shannon ang "A Mathematical Theory of Communication" sa *Bell System Technical Journal*—isang paper na nagtatag sa larangan ng information theory. Ipinakita ni Shannon na maaaring i-model ang komunikasyon bilang isang sistema: ang *information source* ay lumilikha ng *message*, na ine-encode ng *transmitter* bilang *signal*, na dumaraan sa *channel* (na napapailalim sa *noise*), na dine-decode ng *receiver* pabalik sa message para sa *destination*.

Ang pangunahing ambag ni Shannon ay ang konsepto ng *entropy*—isang sukat ng uncertainty o information content ng isang message. Pinatunayan niyang para sa anumang channel na may tiyak na noise level, may umiiral na maximum rate kung saan maaaring maipadala ang information nang reliably (ang channel capacity), at maaabot ang rate na ito sa pamamagitan ng sapat na matalinong encoding.

Malalim ang koneksyon sa pagsasalin. Si Shannon mismo, sa isang paper noong 1951, ay gumamit ng information theory upang suriin ang statistical structure ng English. Ipinakita niya na ang English text ay lubhang redundant—na ang native speaker, kapag binigyan ng sequence ng letters, ay makapaghuhula ng susunod na letter nang may mataas na accuracy. Ang redundancy na ito ang nagpapakatatag sa communication laban sa noise, ngunit nangangahulugan din ito na ang *information content* ng wika ay mas mababa kaysa sa ipahihiwatig ng raw symbol count nito.

Agad nakita ni Warren Weaver ang koneksyon: kung ang pagsasalin ay decoding, at kung maaaring i-model ang statistical structure ng wika, kung gayon ang pagsasalin ay isang information-theoretic problem. Aabutin ng ilang dekada bago magbunga ang insight na ito, ngunit nang magbunga ito, binago nito ang larangan.

### Von Neumann at ang Stored-Program Computer (1945)

Inilarawan ng 1945 report ni John von Neumann tungkol sa EDVAC (Electronic Discrete Variable Automatic Computer) ang tinatawag natin ngayon na *von Neumann architecture*: isang computer na may iisang memory store para sa parehong data at instructions, isang central processing unit, at input/output mechanisms. Ang arkitekturang ito—data at programs na nagsasalo sa iisang memory, na sequentially processed ng CPU—ay nananatiling fundamental design ng halos bawat computer na ginagamit ngayon.

Ginawang praktikal ng von Neumann architecture ang software. Maaaring i-store, baguhin, at kahit likhain ng ibang programs ang programs. Ito ang technological precondition para sa lahat ng sumunod: compilers, operating systems, at kalaunan ang neural network frameworks na nagpapagana sa modern machine translation.

---

## IV. Machine Translation: Ang Unang Problema ng AI

### Ang Georgetown-IBM Experiment at ang Cold War (1954)

Noong Enero 7, 1954, ipinakita ng mga researcher sa Georgetown University at IBM ang unang pampublikong machine translation system. Isinalin ng system ang 60 Russian sentences sa English gamit ang vocabulary na 250 words at anim na grammar rules. Maingat na pinili ang mga pangungusap upang pasok sa kakayahan ng system, ngunit lumikha ang demonstration ng napakalaking excitement.

Iniulat ng *New York Times* na ang experiment ay nagpapahiwatig ng hinaharap kung saan gagawing agad na accessible ng "push-button electronic translator" ang lahat ng scientific literature sa mundo. Gayunman, itinago ng pampublikong optimism na ito ang material reality ng funding at layunin ng proyekto. Ang Georgetown-IBM experiment—at ang maagang machine translation field sa pangkalahatan—ay hindi hinimok ng utopian na hangarin para sa universal communication. Pinondohan ito ng militar at intelligence apparatus ng United States (kabilang ang CIA at DARPA) bilang kagyat na Cold War imperative upang subaybayan at harangin ang Soviet scientific at military texts. 

Ang pagtingin sa wika bilang "code to be cracked" (gaya ng sinabi ni Weaver) ay likas na nakatali sa militarized surveillance. Hinulaan ng mga researcher na malulutas ang machine translation sa loob ng limang taon. Nagkamali sila nang mahigit kalahating siglo.

### Ang ALPAC Report at ang Unang AI Winter (1966)

Noong 1966, naglabas ng mapaminsalang report ang Automatic Language Processing Advisory Committee (ALPAC), na binuo ng U.S. government. Matapos repasuhin ang isang dekada ng MT research, ipinasiya ng ALPAC na mas mabagal, mas hindi accurate, at mas mahal ang machine translation kaysa human translation, at nirekomendang ilipat ang funding sa basic research sa computational linguistics.

Epektibong pinatay ng ALPAC report ang funding para sa MT research sa United States nang mahigit isang dekada. Ito ang unang "AI winter"—isang pattern na mauulit: extravagant promises, modest results, disillusionment, funding collapse.

Ngunit naglalaman din ang report ng mas malalim na insight. Nabigo ang machine translation, sa bahagi, dahil mas mahirap ang wika kaysa inaasahan ng sinuman. Ang rule-based approach—pagsulat ng explicit grammar rules upang i-parse at lumikha ng sentences—ay gumana sa simpleng kaso ngunit catastrophically bumagsak sa totoong text. Masyadong ambiguous, masyadong context-dependent, masyadong *buhay* ang wika para mahuli ng brittle rules.

### Rule-Based at Transfer-Based MT (1970s–1980s)

Nagpatuloy ang research, nang mas tahimik, sa buong 1970s at 1980s. Gumamit ang mga system tulad ng SYSTRAN (na nagpagana sa maagang translation services ng European Commission) ng malalaking hand-crafted dictionaries at transfer rules upang mag-map sa pagitan ng language pairs. Nakalilikha ang mga system na ito ng kapaki-pakinabang na rough translations para sa restricted domains, ngunit nangangailangan sila ng napakalaking engineering effort para sa bawat language pair, at bihira nilang nahahawakan nang maayos ang unrestricted text.

Malinaw ang fundamental problem: hindi cipher ang wika. Hindi kayo makapagsasalin sa pamamagitan ng paghahanap ng mga salita sa dictionary at muling pagsasaayos ng mga ito ayon sa grammatical rules, dahil nakadepende ang kahulugan sa context, sa world knowledge, sa intent ng speaker, sa buong kasaysayan ng pag-uusap. Ang interlingua approach—pagsasalin sa pamamagitan ng abstract, language-independent representation—ay theoretically elegant ngunit practically impossible. Walang makapagdefine ng interlingua.

### Ang Statistical Revolution (1990s)

Ang breakthrough ay hindi nagmula sa mas mahusay na rules kundi sa mas mahusay na data. Sa huling bahagi ng 1980s at unang bahagi ng 1990s, bumuo ang mga researcher sa IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra, at Robert Mercer) ng serye ng statistical models para sa machine translation—ang tanyag na IBM Models 1 hanggang 5.

Ang pangunahing insight ay ang lumang ideya ni Weaver, na sa wakas ay ginawang rigorous: translation as decoding. Given ang foreign sentence *f*, hanapin ang English sentence *e* na nagma-maximize ng P(e|f). Sa Bayes' theorem, katumbas ito ng pagma-maximize ng P(f|e) × P(e)—isang *translation model* (gaano kalamang ang foreign sentence na ito given ang English na ito?) na minumultiply sa *language model* (gaano kalamang ang English sentence na ito sa sarili nito?).

Natutuhan ng IBM models ang mga probability na ito mula sa malalaking *parallel corpora*—mga koleksyon ng texts na umiiral sa parehong wika (tulad ng Canadian parliamentary Hansards, na inilathala sa parehong English at French). Walang kailangang hand-crafted rules. Natutong magsalin ang system sa pamamagitan ng pag-obserba sa milyun-milyong halimbawa ng human translation.

Mas kapansin-pansing gumana ang statistical MT kaysa rule-based MT para sa mga wikang may masaganang parallel data. Ipinakilala rin nito ang isang kritikal na piraso ng infrastructure: ang **BLEU score** (Papineni et al., 2002), isang metric para sa awtomatikong evaluation ng translation quality sa pamamagitan ng paghahambing ng machine output sa human reference translations. Ginawang posible ng BLEU na sukatin ang progress nang quantitatively at magpatakbo ng large-scale experiments.

Ngunit may fatal assumption na nakapaloob sa statistical MT: nangangailangan ito ng *parallel corpora*. Para sa mga pangunahing language pair sa mundo—English-French, English-Chinese, English-Spanish—masagana ang parallel data. Para sa napakalaking mayorya ng 7,000 wika sa mundo, wala lamang ito.

### Ang Neural Revolution: Seq2Seq, Attention, Transformers (2014–2017)

Ang sumunod na transformation ay dumating kasama ng deep learning. Noong 2014, ipinakita nina Ilya Sutskever, Oriol Vinyals, at Quoc Le ang *sequence-to-sequence* (seq2seq) models para sa MT: neural networks na makababasa ng buong sentence sa isang wika at makalilikha ng translation sa isa pa, nang walang explicit alignment o phrase tables.

Noong 2015, ipinakilala nina Dzmitry Bahdanau, Kyunghyun Cho, at Yoshua Bengio ang *attention mechanism*—na nagpapahintulot sa decoder na "tumingin pabalik" sa iba't ibang bahagi ng source sentence habang nililikha ang bawat salita ng translation. Lubos nitong pinahusay ang performance sa mahahabang sentence.

At noong 2017, inilathala ni Vaswani et al. sa Google ang "Attention Is All You Need," na nagpakilala ng *Transformer* architecture. Tuluyang tinanggal ng Transformer ang recurrence, at pinroseso ang buong sequences nang parallel gamit ang self-attention. Mas mabilis itong i-train, mas madaling i-scale, at nakalilikha ng mas mahusay na translations kaysa anumang nauna rito.

Direktang humantong ang Transformers sa large language models (LLMs) ng 2020s: GPT, BERT, PaLM, LLaMA, at ang kanilang mga descendant. Ang mga model na ito, na trained sa napakaraming text mula sa internet, ay makapagsasalin sa pagitan ng daan-daang language pairs nang may kapansin-pansing fluency.

Ngunit ang "remarkable fluency" ay hindi kapareho ng "reliable accuracy." At para sa low-resource languages ng mundo, mas malala ang sitwasyon kaysa sa anyo nito.

---

## V. Ang Ibang Kasaysayan: Wika, Kapangyarihan, at Cultural Genocide

Ikinukuwento ng naunang apat na seksyon ang kasaysayan ng mga ideya—ng grammarians, mathematicians, at engineers na bumubuo patungo sa machine translation. Ngunit may isa pang kasaysayan, na tumatakbo nang parallel, na nagpapaliwanag kung *bakit* ang mga wikang higit na nangangailangan ng translation technology ang mismong mga wikang wala nito. Hindi ito kuwento tungkol sa data scarcity bilang neutral na katotohanan. Kuwento ito tungkol sa sinadyang pagwasak.

Ang dahilan kung bakit walang machine translation support ang Plains Cree ay hindi pangunahing dahil mahirap ang Cree para sa computers (bagama't mahirap ito). Ito ay dahil, sa loob ng mahigit isang siglo, nagpatakbo ang mga pamahalaan ng Canada at United States ng sistematikong programa upang burahin ang Indigenous languages mula sa bibig ng mga bata. Ang "data scarcity" na nagpapahirap sa low-resource MT ay, sa malaking bahagi, ang *downstream consequence ng cultural genocide*. Dapat harapin ng anumang tapat na account kung bakit kailangan ng mga wikang ito ang teknolohiya ang dahilan kung bakit sila dinala sa bingit ng pagkalipol sa unang lugar.

### Bago ang Contact: Isang Kontinente ng mga Wika

Nakagugulat ang linguistic diversity ng pre-contact Americas. Sa panahon ng European contact, ang North America lamang ay tahanan ng tinatayang 300 hanggang 600 distinct languages, na nakaayos sa dose-dosenang unrelated language families—mas maraming genetic diversity kaysa sa buong Europe. Maaaring may 1,500 o higit pa ang South America (Campbell, 1997). May mahigit 250 wika ang Australia. Gayundin ang diversity sa Pacific Islands, sub-Saharan Africa, at mainland Southeast Asia.

Hindi "primitive" o "simple" ang mga wikang ito. Marami sa pinakacomplex na wika sa istruktura na naidokumento kailanman ay Indigenous. Ang polysynthetic morphology ng Algonquian languages (kabilang ang Cree, Ojibwe, at Blackfoot), ang tonal systems ng Navajo, ang elaborate evidentiality marking ng Quechua, ang click consonants ng Khoisan languages—kinakatawan ng mga ito ang buong saklaw ng kayang maging wika ng tao. Ine-encode nila ang sopistikadong systems of knowledge tungkol sa kinship, ecology, law, spirituality, at history. Ang bawat wika ay isang library—isang hindi mapapalitang tala ng paraan ng isang komunidad sa pag-unawa at pag-oorganisa ng mundo.

Malinaw itong kinilala ni Edward Sapir. Sa pagsulat noong 1921, napansin niya na "when it comes to linguistic form, Plato walks with the Macedonian swineherd, Confucius with the head-hunting savage of Assam." Hindi mas mababa ang mga wika ng Indigenous peoples. Iba ang mga ito—at ang kanilang mga pagkakaiba ay naglalaman ng kaalamang wala sa ibang wika.

### Ang Mechanics ng Language Death

Hindi namamatay ang mga wika sa natural causes. Namamatay ang mga ito kapag naputol ang mga kondisyon para sa kanilang transmission—kapag tumitigil ang mga batang matuto nito, kapag pinarurusahan ang mga speaker sa paggamit nito, kapag nagbabago ang social at economic incentives upang ang pagsasalita ng dominant language ay maging kondisyon ng survival.

Maaaring mangyari ang disruption na ito nang dahan-dahan, sa pamamagitan ng economic at demographic pressure. Ngunit sa buong colonial world, ito ay overwhelmingly *deliberate*. Ang suppression ng Indigenous languages ay hindi side effect ng colonization. Isa itong ipinahayag na policy goal.

### Canada: Ang Residential School System (1831–1996)

Sa Canada, gumana ang Indian Residential School system nang mahigit 160 taon, na may explicit goal na alisin ang Indigenous languages at cultures. Tinatayang 150,000 First Nations, Métis, at Inuit children ang inalis sa kanilang mga pamilya at komunidad at inilagay sa government-funded, church-operated boarding schools.

Ipinahayag ang sentral na policy nang may nakakikilabot na linaw ni Duncan Campbell Scott, ang Deputy Superintendent General of Indian Affairs, noong 1920: "I want to get rid of the Indian problem... Our objective is to continue until there is not a single Indian in Canada that has not been absorbed into the body politic and there is no Indian question and no Indian Department."

Ang mechanism ay wika. Pinagbawalan ang mga bata na magsalita ng kanilang mother tongues. Ang mga parusa sa pagsasalita ng Indigenous language ay mula sa pambubugbog hanggang solitary confinement hanggang sa pagtusok ng karayom sa kanilang dila. Dumating ang mga bata na nagsasalita ng Cree, Ojibwe, Inuktitut, Dene, Haida, o alinman sa dose-dosenang iba pang wika. Pinarusahan sila hanggang tumigil sila.

Idinokumento ng Truth and Reconciliation Commission of Canada (2015) ang systematic nature ng pag-atakeng ito. Nagkonklud ang final report nito na ang residential school system ay bumuo ng *cultural genocide*—ang pagwasak sa structures at practices na nagpapahintulot sa isang grupo na magpatuloy bilang grupo. Wika ang pangunahing target. Kung walang wika, napuputol ang ceremony, nababasag ang oral history, nagiging hindi maintindihan ang kinship systems, at tumitigil ang intergenerational transmission ng kaalaman.

Nagsara ang huling federally operated residential school sa Canada noong 1996. Marami sa Elders na siyang huling fluent speakers ng kanilang mga wika ngayon ay residential school survivors. Ang kanilang fluency ay hindi lamang linguistic resource. Isa itong act of resistance.

### Ang United States: Indian Boarding Schools (1860s–1960s)

Nagpatakbo ang United States ng parallel system. Si Captain Richard Henry Pratt, tagapagtatag ng Carlisle Indian Industrial School noong 1879, ang lumikha ng pariralang nagdefine sa panahon: "Kill the Indian, save the man." Mahigit 350 government-funded boarding schools ang gumana sa buong United States, na may policies na halos kapareho ng sa Canada. Pinagbawalan ang Indigenous children na magsalita ng kanilang mga wika, pinilit silang gumamit ng English names, at isinailalim sila sa systematic cultural erasure.

Tinukoy ng 2022 report ng U.S. Department of the Interior ang mahigit 400 federal Indian boarding schools sa 37 states, na nagdodokumento ng pagkamatay ng hindi bababa sa 500 bata sa system—isang numerong inamin ng report na halos tiyak na malaking undercount. Natuklasan ng imbestigasyon na ang system ay dinisenyo hindi lamang upang mag-educate kundi upang "culturally assimilate Indian children by forcibly relocating them from their families and communities."

Catastrophic ang linguistic consequences. Sa humigit-kumulang 300 Indigenous languages na sinasalita sa teritoryong naging United States, mahigit kalahati ang extinct na ngayon. Sa mga nakaligtas, karamihan ay may mas kaunti sa 1,000 fluent speakers, at marami ang may mas kaunti sa 10. Inuuri ng Endangered Languages Project ang mayorya ng natitirang Native American languages bilang "severely" o "critically" endangered.

### Australia: Ang Stolen Generations (1910–1970)

Sa Australia, sapilitang inalis ng government policies sa pagitan ng 1910 at 1970 ang Aboriginal at Torres Strait Islander children mula sa kanilang mga pamilya. Ang mga batang ito—kilala bilang Stolen Generations—ay inilagay sa missions, reserves, at white foster families. Ang explicit aim ay assimilation: alisin ang Aboriginal identity sa loob ng ilang henerasyon.

Sinupil ang Aboriginal languages sa missions at government institutions. Pinarusahan ang mga batang nagsasalita ng kanilang mga wika. Idinokumento ng Bringing Them Home report (1997), na ginawa ng Australian Human Rights Commission, ang systematic nature ng mga removal na ito at ang mapaminsalang epekto nito sa language, culture, at family.

Sa tinatayang 250 Aboriginal Australian languages na sinasalita sa panahon ng European contact, wala pang 20 ang naipapasa sa mga bata ngayon (Marmion et al., 2014). Mahigit 100 ang ganap nang extinct. Ang natitirang mga wika ay nabubuhay pangunahin sa pamamagitan ng pagsisikap ng matatandang speakers na nakikipagtulungan sa linguists at community organizations sa isang karera laban sa oras.

### Scandinavia: Ang Sámi Languages

Hindi limitado sa settler-colonial states sa southern hemisphere ang suppression ng Indigenous languages. Sa Norway, Sweden, at Finland, isinailalim ang Sámi children sa boarding school systems (*internatskoler*) mula kalagitnaan ng ika-19 na siglo hanggang 1960s. Ipinagbawal ang Sámi languages sa mga paaralan; pinarusahan ang mga bata sa pagsasalita nito. Ang "Norwegianization" (*fornorskingspolitikk*) policy ng Norway ay tahasang naglayong alisin ang Sámi language at palitan ito ng Norwegian.

Sa siyam na natitirang Sámi languages, ilan ang may mas kaunti sa 500 speakers. May humigit-kumulang 20 ang Ume Sámi. Mas kaunti sa 30 ang Pite Sámi. Nabubuhay ang mga wika sa bahagi dahil sa revitalization programs na nagsimula noong 1970s, kabilang ang pagtatatag ng Sámi-language schools at media—mga programang dumating sa tamang oras para sa ilang dialect at huli na para sa iba.

### Aotearoa New Zealand: Te Reo Māori

Ang Māori language (te reo Māori) ang majority language ng Aotearoa hanggang kalagitnaan ng ika-20 siglo. Ang British colonial education policies, simula noong 1860s, ay unti-unting nag-marginalize sa te reo sa mga paaralan. Pagsapit ng 1970s, wala pang 20% ng Māori ang fluent speakers, at nasa panganib na ma-extinct ang wika sa loob ng isang henerasyon.

Ang tugon ng Māori ay isa sa pinakamaaga at pinakamatagumpay na language revitalization movements sa mundo. Ang Kōhanga reo (language nests) para sa preschool children, na itinatag noong 1982, ay nag-immerse ng infants at toddlers sa te reo mula kapanganakan. Sumunod ang Kura kaupapa Māori (Māori-medium schools). Ang mga programang ito, kasama ng Māori Language Act of 1987 (na ginawang official language ang te reo), ay nagstabilize sa wika—bagama't minority pa rin ng Māori population ang fluent speakers.

Nakalikha rin ang New Zealand ng isa sa pinakamahalagang frameworks para sa Indigenous data governance: *Te Mana Raraunga*, ang Māori Data Sovereignty Network. Iginiit ng framework na ito na ang Māori data—kabilang ang linguistic data—ay isang taonga (treasure) na napapailalim sa rights at responsibilities ng kaitiakitanga (guardianship). Direkta nitong inimpluwensyahan ang development ng CARE principles para sa Indigenous data governance at isa itong foundational reference para sa data sovereignty mechanisms sa champollion.

### Ang Pattern: Wika bilang Target ng Colonial Power

Nagkakaiba ang geographic at cultural specifics, ngunit kapansin-pansing consistent ang pattern. Sa Canada, United States, Australia, Scandinavia, at New Zealand—at sa marami pang ibang lugar, mula Taiwan hanggang Siberia hanggang Andean highlands—tinukoy ng colonial at post-colonial states ang Indigenous languages bilang hadlang sa assimilation at tinarget ang mga ito para alisin. Magkakatulad ang tools saanman: alisin ang mga bata sa kanilang pamilya, ipagbawal ang paggamit ng Indigenous languages, parusahan ang paglabag, at gantimpalaan ang paggamit ng colonial language.

Hindi ito historical footnote. Nagsara ang huling residential school sa Canada noong *1996*. Nagsara ang huling Indian boarding school sa United States noong *1960s*. Marami sa mga taong nakaligtas sa mga system na ito ay buhay pa. Intergenerational ang trauma. At nagpapatuloy ang linguistic damage: ang mga wikang nawalan ng isang henerasyon ng speakers sa boarding school era ay nawawalan na ngayon ng kanilang huling fluent Elders.

### Mula Cultural Genocide tungo sa "Data Scarcity"

Direktang may kaugnayan ang kasaysayang ito sa teknikal na problema ng machine translation. Kapag inilalarawan ng computer scientists ang isang wika bilang "low-resource," karaniwan nilang ibig sabihin: kakaunti ang digital texts, kakaunti ang parallel corpora, kakaunti ang dictionaries, at kakaunti ang annotated datasets. Neutral ang framing, na para bang ang data scarcity ay gawa ng kalikasan, tulad ng disyertong kaunti ang ulan.

Hindi ito ganoon. Ang "data scarcity" ng Indigenous languages ay ang *downstream consequence* ng language suppression policies. Ang mga wikang ipinagbawal sa mga paaralan ay nakalikha ng mas kaunting written texts. Ang mga wikang pinarusahan ang speakers sa pagsasalita nito ay nagkaroon ng mas kaunting institutional uses. Ang mga wikang nawalan ng isang henerasyon ng transmission ay nagkaroon ng mas kaunting bilingual speakers na makalilikha ng parallel corpora.

Direkta ang pipeline mula cultural genocide hanggang data scarcity:

1. **Suppression** → Pinarurusahan ang mga bata sa pagsasalita ng wika
2. **Disrupted transmission** → Mas kaunting bata ang natututo ng wika
3. **Reduced speaker base** → Mas kaunting adult ang gumagamit nito sa araw-araw
4. **Reduced institutional use** → Mas kaunting written documents, mas kaunting digital texts
5. **Data scarcity** → Walang ma-train-an ang ML models
6. **No MT support** → Invisible ang wika sa teknolohiya
7. **Accelerated decline** → Pinatitindi ng teknolohiya ang marginalization na sinimulan ng policy

Ibig sabihin ng pipeline na ito na ang anumang technology project na nagtatrabaho sa Indigenous languages ay nagmamana ng political at moral context, kilalanin man nito o hindi. Ang machine translation system na tumuturing sa Cree language data bilang raw material na kakainin ng models ay, kahit hindi sinasadya, nagpapatuloy sa extractive dynamic na nagsimula sa residential schools. Ginawang scarce ang data sa pamamagitan ng karahasan. Ang mga speaker na lumikha ng umiiral na data ay ginawa iyon laban sa napakalaking pagsubok. Anumang system na gumagamit ng data na iyon nang walang meaningful control ng komunidad ay nagpapalubha sa orihinal na pinsala.

### Ang Complicity ng Sciences at Western Ideology

Kritikal na kilalanin na ang science at technology ay hindi inosenteng tagamasid sa colonial project na ito; aktibo silang kalahok. Ang "Enlightenment" ideology na naghangad i-categorize, i-quantify, at i-standardize ang mundo ay madalas tumuring sa Indigenous peoples at kanilang mga wika bilang subjects lamang ng research o curiosities para sa "salvage anthropology." Ikinulong ng extractive practice na ito ang kaalaman sa Western universities habang kakaunti ang ginawa upang pigilan ang political machinery na sumisira sa mga komunidad na iyon. 

Ang proyektong ito ay nasa matinding kaibahan sa methodologies tulad ng Tuskegee syphilis study o extractive linguistic anthropology, na tumuturing sa BIPOC people bilang experimental subjects o passive providers ng raw data. Wala kami rito upang mag-eksperimento sa Indigenous people, kunin ang kanilang kaalaman, o ipilit sa kanila ang Western culturally monolithic ideology. Layunin naming padaliin ang kanilang *sariling* ways of knowing at kanilang *sariling* standards of value. Ibinibigay namin ang infrastructure; ang language communities ang bumubuo ng test sets, nagde-define ng metrics, at nagpapanatili ng buy-in. Kung wala ang kanilang buy-in, hindi gagana ang alinman dito.

### Bakit Hinuhubog ng Kasaysayang Ito ang Aming Design

Ito ang dahilan kung bakit ang governance model ng champollion ay hindi feature—ito ang pundasyon. Ang bawat major design decision sa proyekto ay isang *direktang tugon* sa kasaysayang inilarawan sa itaas. Ang layunin ay data sovereignty: suportahan ang mga komunidad sa pagpapanatili, revitalization, at pamamahala ng kanilang buhay na mga wika ganap sa sarili nilang terms.

**Bakit encrypted ang test data at hawak ng community trusts.** Dahil mahigit isang siglo nang kinukuha, inilalathala, at pinagsasamantalahan ang Indigenous linguistic data nang walang consent. Ang missionary linguistics, tulad ng mga pagsisikap ng Summer Institute of Linguistics (SIL), ay historikal na nagmonopolize sa Indigenous parallel corpora sa ilalim ng extractive at assimilationist framework. Bukod pa rito, hindi tulad ng maraming modernong NLP projects na lubhang umaasa sa translated Bibles bilang pangunahing parallel corpus para sa low-resource languages, tahasan naming hindi ginagamit ang translated Bibles bilang corpuses. Ang encrypted test set, na ang keys ay hawak lamang ng governance organization ng komunidad, ay isang technical mechanism na ginagawang *architecturally impossible* na ulitin ang extractive patterns.

**Bakit gumagamit kami ng sandboxed execution sa halip na open test sets.** Dahil kapag nailathala nang bukas ang linguistic data, permanenteng nawawala sa komunidad ang kontrol dito. Inilalathala ng conventional ML benchmarks ang kanilang test sets—maaaring i-download ng sinuman, i-train dito, o gamitin para sa anumang layunin. Ang modern AI data scraping na ito ay kumakatawan sa bagong anyo ng "data colonialism" at "digital enclosure." Para sa mga komunidad na ang mga wika ay halos binura sa puwersa, ang pagkawala ng kontrol sa natitira nilang linguistic resources ay hindi maliit na abala. Direktang pagpapatuloy ito ng historical territorial dispossession. Tinitiyak ng sandboxed execution na hindi kailanman aalis sa infrastructure ng komunidad ang kanilang data.

**Bakit inililipat sa komunidad ang method ownership.** Dahil ang kasaysayan ng "pagtulong" sa Indigenous communities ay, sa napakalaking bahagi, kasaysayan ng outsiders na bumubuo ng mga bagay *tungkol* sa Indigenous people sa halip na *para* o *kasama* nila. Nailalathala ang academic papers, nakokolekta ang grants, umuusad ang careers—at naiiwan ang komunidad na walang anumang hawak. Tinitiyak ng ownership transfer mechanism na kapag ang isang ML engineer ay bumuo ng gumaganang translation method para sa Plains Cree, ang Plains Cree community ang *may-ari ng method na iyon*. Pinananatili ng engineer ang credit at attribution. Pinananatili ng komunidad ang asset.

**Bakit anumang kitain ng community-owned method ay ganap na pag-aari ng komunidad.** Dahil mahal ang language revitalization, at ang mga komunidad na gumagawa ng pinakamahirap na trabaho—ang Elders na nagtuturo, ang mga magulang na nagpapadala ng mga bata sa immersion schools, ang activists na nagpapatakbo ng language nests—ay chronically underfunded. Bukod pa rito, ang mismong AI infrastructure na ginagamit natin (e.g., data centers, mineral mining, water use) ay may disproportionate material toll sa Indigenous lands sa buong mundo. Ang Champollion ay non-commercial project at walang claim sa alinman dito: kung sakaling lumikha ng value ang Cree translation method, dapat pondohan ng value na iyon ang Cree language programs. Dapat maging tool ang teknolohiya na naglilingkod sa mga komunidad, hindi mechanism na kumukuha ng value mula sa kanila.

**Bakit po namin sinasabing "sovereignty-aspirant" sa halip na mag-angkin ng pagsunod (compliance).** Ang mga balangkas ng data sovereignty ng mga Katutubo ay binuo ng mga partikular na mamamayan para sa mga partikular na konteksto — ang mga prinsipyo ng data sovereignty ng First Nations sa Canada, CARE (Collective Benefit, Authority to Control, Responsibility, Ethics), Te Mana Raraunga (Māori Data Sovereignty), at ang mga prinsipyo ng FAIR — bawat isa ay tumutugon sa mga alalahaning ito mula sa iba't ibang kultural at legal na posisyon. Hindi po namin inaangkin na ipinapatupad namin ang alinman sa mga ito nang buo; ang pagpapasyang iyon ay nabibilang sa mga komunidad na may-akda ng mga ito. Sinasabi po namin na ang aming disenyo ay *sovereignty-aspirant* — binuo po ito upang *maaaring* gamitin ng mga komunidad ang pagmamay-ari, kontrol, pag-access, at pag-aari ng kanilang datos at ng mga teknolohiyang nagmula rito. Ang arkitektura ay umaabot patungo sa soberanya; kung makakamit nito ang soberanya ay nasa mga komunidad na po ang pagpapasya. Itinuturing po namin itong hindi pa tapos na gawain, tinatanggap po namin ang mga pagtutol, at aaksyunan po namin ang mga ito.

**Bakit *methods* ang bina-benchmark ng platform, hindi *models*.** Dahil hindi dapat maging dependent ang Indigenous language communities sa model ng iisang corporation. Ang open architecture ng isang "method" ay nangangahulugang hindi kailangang maging mahal at material-heavy LLM ang solution. Maaari itong maging highly efficient, community-hosted rule-based system na tumatakbo sa traditional computing hardware. Kung gumagamit ngayon ng Google's Gemini ang pinakamahusay na translation method para sa Cree, dapat makalipat ang komunidad sa open-source o deterministic alternative bukas nang hindi muling binubuo ang lahat. Tinitiyak ng method-level benchmarking na ang asset ng komunidad ay isang *recipe*, hindi dependency.

**Bakit kailangang buuin ng komunidad ang infrastructure na ito ngayon.** Nalulutas ang paradox ng paggamit ng AI habang pinupuna ang material extraction nito sa pamamagitan ng mabagsik na strategic reality: kung hindi malulutas ng komunidad ang problemang ito sa sarili nilang sovereign terms, tiyak na "lulutasin" ito ng iba sa extractive terms. Kahit pa bumuo kalaunan ang isang malaking corporation ng translation model para sa isang Indigenous language, kailangan ng komunidad ang sarili nitong independent, sandboxed benchmarking infrastructure upang ma-verify *kailan* at *kung* tunay silang nagtagumpay ayon sa community standards—at upang matiyak na makukuha ng komunidad ang value ng tagumpay na iyon.

Hindi ito politics na ikinabit lamang sa technology. Ito ay technology na dinisenyo ng mga taong nauunawaan ang kasaysayan.

---

## VI. Ang Kasalukuyang Sandali: 6,800 Wika ang Naiiwan

### Ang Sukat ng Problema

Mula sa humigit-kumulang 7,000 buhay na wika na sinasalita sa Daigdig ngayon, nasa 550 lamang ang may anumang uri ng machine translation — at halos 200 lamang ang pinaglilingkuran ng isang nakadeploy na komersyal na serbisyo ([kung paano po kami nagbibilang](/docs/network/context/coverage-counting)). Ang natitira ay hindi nakikita ng teknolohiya—hindi dahil hindi sila gaanong karapat-dapat, kundi dahil ang mga statistical at neural na pamamaraan na nangingibabaw sa modernong MT ay sadyang *data-hungry*. Nangangailangan po ang mga ito ng milyun-milyong magkakatumbas na pangungusap (parallel sentences) upang matuto. Para sa karamihan ng mga wika sa mundo, hindi po umiiral ang mga pangungusap na iyon.

Ang mga wikang pinakanaaapektuhan ay tiyak na ang mga pinakananganganib: Indigenous languages, minority languages, oral traditions na may limitadong written records. Ito ang mga wikang ang speakers ay madalas matatanda na, ang komunidad ay maliit, at ang political power ay minimal. Ito ang mga wikang higit na nangangailangan ng technological support para sa preservation at revitalization—at ito ang mga wikang pinakakaunti ang silbi ng kasalukuyang teknolohiya.

### Ang Polysynthetic Challenge

Hindi lamang data scarcity ang problema. Marami sa pinakananganganib na wika sa mundo ay *polysynthetic*—mayroon silang morphological systems na may pambihirang complexity na pundamental na sumisira sa assumptions ng standard NLP.

Isaalang-alang ang Plains Cree (nêhiyawêwin), isang Algonquian language na sinasalita sa Canadian prairies. Maaaring i-encode ng iisang Cree verb ang impormasyong ikakalat ng English sa buong clause: ang subject, object, tense, aspect, evidentiality, modality, at iba't ibang iba pang grammatical categories, lahat ay nakapaloob sa isang salita sa pamamagitan ng sistema ng prefixes, suffixes, at internal modifications.

Lumilikha ito ng ilang problema para sa standard MT approaches:

1. **Tokenization failure.** Ang subword tokenizers tulad ng BPE (Byte Pair Encoding), na dinisenyo para sa analytic languages tulad ng English, ay dinudurog ang polysynthetic words sa walang-kahulugang fragments. Nawawasak ang morphological structure bago pa man ito makita ng model. Hindi neutral ang BPE; kumakatawan ito sa purong empiricist, surface-level epistemology na pundamental na sumasalungat sa malalim, rule-based morphological hierarchies na likas sa polysynthetic languages. Isa itong architectural bias na aktibong nagwawasak ng structural morphology.

2. **Combinatorial explosion.** Maaaring magkaroon ang isang polysynthetic language ng milyun-milyong posibleng word forms para sa isang verb root. Walang training corpus, gaano man kalaki, ang maaaring maglaman ng higit sa napakaliit na bahagi ng mga ito. Walang paraan ang neural models upang *mag-generalize* sa unseen forms.

3. **Hallucination.** Ang large language models, kapag hinilingang magsalin sa polysynthetic languages, ay madalas lumikha ng morphologically invalid forms—mga salitang hindi kailanman gagamitin ng native speaker. Natutuhan ng model ang statistical patterns mula sa limitadong data ngunit wala itong pag-unawa sa morphological rules ng wika.

### Finite State Transducers: Ang Tulay

Gayunman, may teknolohiyang *nakakahawak* nang mahusay sa morphological complexity: ang **Finite State Transducer** (FST). Ang FST ay isang formal computational device na nagma-map sa pagitan ng input string at output string sa pamamagitan ng serye ng state transitions. Para sa morphological analysis, maaaring i-map ng FST ang isang surface word form sa underlying morphological structure nito (at vice versa), habang hinahawakan ang buong combinatorial complexity ng morphology ng wika.

Ang FSTs ay direktang descendants ng rewriting rules ni Pāṇini. Ang mga ito ay Chomsky's Type 3 (regular) grammars sa computational form. Ang mga ito ang buhay na embodiment ng koneksyon sa pagitan ng formal linguistics at computation. 

Sa pagpapares ng FSTs sa LLMs, `champollion` ay nagsasagawa ng mahalagang philosophical synthesis: pinagkakasundo nito ang *rationalist* structural tradition (rules) sa *empiricist* statistical paradigm (probability) upang kontrahin ang data-hungry at majoritarian biases ng modern AI.

Para sa polysynthetic languages, nakapagbibigay ang FSTs ng bagay na hindi kaya ng neural models: *deterministic verification*. Given ang isang word form, tiyak na masasabi ng FST kung valid form ito sa wika—hindi probabilistically, hindi "mukhang tama," kundi *oo* o *hindi*. Ito ang sagot sa core query na bumabagabag sa neural MT para sa low-resource languages: *Paano ninyo mave-verify na totoo ang isang generated word nang walang human in the loop?*

Ang technical answer ay: gamitin ninyo ang formal grammar. Gamitin ninyo ang mismong tools na inimbento ni Pāṇini dalawampu't limang siglo na ang nakararaan, na naka-encode sa computational formalism na ginawang rigorous nina Turing at Chomsky.

Gayunman, dapat nating kilalanin na may sariling risks ang deterministic power na ito. Ang pagpapatupad ng "yes" o "no" validation sa isang oral at fluid language ay may panganib na magpataw ng rigid Standard Language Ideology. Kapag idinidikta ng FST kung ano ang "correct," maaari nitong hindi sinasadyang ulitin ang mismong colonial normativity na idinisenyo nitong iwasan—pag-flatten sa dialectal variation, pagpaparusa sa code-switching, at pagpapatupad ng singular, normalized grammar sa isang diverse community. Dahil kumakatawan ang FSTs sa isang metric lamang ng formal correctness, kailangang palambutin ang kanilang rigid empiricism. Ito mismo ang dahilan kung bakit dapat hawak ng komunidad ang panulat. Ang komunidad ang nagtatakda ng standard, bumubuo ng rules, at nagde-define kung ano ang tatanggapin ng machine bilang valid, na nag-e-engineer ng FSTs na naglalaan ng puwang para sa oral fluidity at regional dialects. Ang formal grammar ay hindi universal truth na ibinababa ng computer scientists; ito ay infrastructure na pinatatakbo ng mismong speakers.

### champollion: Kung Saan Nagtatagpo ang mga Hibla

Dito pumapasok sa kuwento ang champollion project. Nasa eksaktong convergence point ito ng lahat ng hiblang sinundan natin:

- **Mula kay Pāṇini**: Ang prinsipyong maaaring ilarawan ang wika sa pamamagitan ng formal, generative rules.
- **Mula kina Schleicher at Sapir**: Ang pag-unawang diverse, structured, at madalas endangered ang mga wika ng mundo.
- **Mula sa residential schools at ang aftermath nito**: Ang pag-unawang ang "data scarcity" ay hindi neutral na technical fact kundi bunga ng sinadyang language suppression—at ang anumang teknolohiyang humahawak sa mga wikang ito ay kailangang itayo na may sovereignty bilang pundasyon.
- **Mula kay Chomsky**: Ang formal hierarchy ng grammars na nag-uugnay sa linguistics at computation.
- **Mula kay Shannon**: Ang mathematical framework para sa pag-unawa sa communication, noise, at signal.
- **Mula kina Turing at von Neumann**: Ang universal machines na makapagpapatakbo ng anumang computable function.
- **Mula kay Weaver at sa IBM Models**: Ang insight na maaaring ituring ang translation bilang statistical problem.
- **Mula sa Transformer revolution**: Ang makapangyarihang neural models na makapagsasalin—ngunit kapag mayroon lamang silang sapat na data.
- **Mula sa FST tradition**: Ang formal tools na makahawak sa morphological complexity kung saan nabibigo ang neural models.
- **Mula sa mga prinsipyo ng Indigenous data sovereignty, CARE, at Te Mana Raraunga**: Ang governance frameworks na tumitiyak na naglilingkod ang teknolohiya sa mga komunidad sa halip na kumukuha mula sa kanila.

Ang champollion ay isang platform na dinisenyong ituon ang competitive energy ng machine learning community sa mga wikang iniwan ng market. Nagbibigay ito ng benchmarking infrastructure kung saan maaaring magsumite ang sinuman ng translation method—neural, rule-based, hybrid, o novel—at ma-evaluate ito laban sa rigorous standards. Kritikal, gumagamit ito ng FST-based validation upang matiyak na morphologically valid ang generated forms, at umaasa ito sa native speaker verification bilang ultimate ground truth.

Kinakatawan ng platform ang ilang prinsipyong nililinaw ng kasaysayang ito:

**Walang iisang approach ang sapat.** Ang kasaysayan ng MT ay kasaysayan ng paradigm shifts—mula rules patungong statistics patungong neural networks. Nalutas ng bawat bagong paradigm ang mga problemang hindi kayang lutasin ng nauna, ngunit bawat isa ay may blind spots din. Para sa low-resource polysynthetic languages, halos tiyak na *hybrid* ang sagot: neural fluency na kinokontrol ng formal correctness.

**Ang soberanya ng datos ay hindi opsyonal—ito po ay isang istruktural na tugon sa makasaysayang pinsala.** Tulad ng detalyadong nakadokumento sa Seksyon V, ang mga katutubong wika ay hindi lamang "data-scarce" nang hindi sinasadya. Ginawa po silang kulang sa pamamagitan ng sinadyang patakaran. Ang sovereignty-aspirant na disenyo ng proyekto—na tumitiyak na ang datos ng wika ay nananatili sa ilalim ng kontrol ng mga katutubong komunidad, na ang mga decryption key ay hawak ng mga community trust, na ang pagmamay-ari ng algorithm ay inililipat sa mga nagsasalita—ay hindi po isang nahuling isipan (afterthought). Ito po ay isang direktang tugon sa mga siglo ng mapagsamantalang kasanayan, mula sa dokumentasyon ng mga tagalabas noong panahon ng residential school hanggang sa modernong pag-scrape ng dataset.

Ang isang naunang bersyon ng talatang ito ay nagsabi na ang arkitektura ay ginagawang *technically impossible* ang pag-uulit ng mga pattern na iyon. Iyon po ay isang labis na pag-angkin at binawi na po ito. Ang mga mekanismo ay totoo at tiyak — ang isang corpus ay naka-encrypt sa sariling device ng may hawak bago may anumang umalis dito, ang pag-decrypt ay nangangailangan ng ilang tagapag-ingat (custodians) na kumikilos nang magkakasama sa halip na sinumang iisang partido, at ang nilalaman ng corpus ay kinukuha mula sa pinagmulan nito sa halip na i-host dito — ngunit ang "imposible" ay hindi isang katangian na maaaring taglayin ng alinman sa mga ito. Ang software ay may mga bug, ang mga operator ay nagkakamali, at ang isang determinadong partido na may sapat na mga tamang tungkulin ay isang natitirang panganib na hindi naaalis ng anumang disenyo. Ang tapat na pag-angkin po ay ang mga madaling landas ay sarado na at ang mga mahihirap ay nag-iiwan ng ebidensya. Ang maipapangako po ng proyektong ito ay mekanismo at pagsisiwalat, hindi imposibilidad.

**Ang long game ay revitalization.** Ang pagsasalin ang *proving ground*, ngunit ang tunay na gantimpala ay language revitalization sa pamamagitan ng pagtuturo. Ang formal grammars at morphological models na binuo para sa machine translation ay mismong technical foundations na kailangan para sa machine-assisted language learning. Kung makabubuo tayo ng FST na nagva-validate ng Cree verb forms para sa translation system, magagamit din natin ang FST na iyon upang tulungan ang isang estudyante na matutong mag-conjugate ng Cree verbs.

### Bakit ang Sandaling Ito

Nabubuhay tayo sa isang natatanging sandali sa kasaysayan ng language technology. Ilang salik ang nagsama-sama:

1. **Mature na ang open-source tools.** Ang FST toolkits (tulad ng HFST at Foma), ang neural MT frameworks (tulad ng OpenNMT at Fairseq), at ang evaluation infrastructure ay maaari nang pagsama-samahin ng isang maliit na team sa minimal cost.

2. **Bumibilis ang community organizing.** Ang Indigenous language communities ay lalong nagiging sopistikado sa paggamit ng technology at sa paggigiit ng data sovereignty. Ang mga organisasyon tulad ng First Voices initiative, Canadian Indigenous Languages Technology Project, at napakaraming community-led efforts ay bumubuo ng human infrastructure na hindi kayang ibigay ng technology lamang.

3. **Umabot na sa threshold ang AI capabilities.** Ang large language models, bagama't hindi sapat sa sarili nila para sa low-resource MT, ay maaaring magsilbing makapangyarihang components sa hybrid systems—lumilikha ng candidate translations na pagkatapos ay vine-verify at kinokontrol ng formal methods.

4. **Bumagsak na ang gastos.** Ang mangangailangan sana ng government laboratory noong 1954 o major corporation noong 2000 ay magagawa na ngayon gamit ang cloud computing credits at open-source software. Hindi na technology o pera ang bottleneck. Ito ay *will*.

Ang tanong ay hindi kung maaaring buuin ang teknolohiya. Maaari. Ang tanong ay kung itatayo ito nang *wasto*—may tamang governance, tamang incentives, at tamang paggalang sa mga komunidad na nilalayong paglingkuran nito.

Iyan ang tanong na umiiral ang proyektong ito upang sagutin.

---

## References

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

*Ang dokumentong ito ay bahagi ng documentation ng champollion project. Inilalabas ito sa ilalim ng parehong license tulad ng mismong proyekto.*


## Saan ito patungo sa site na ito

Nagtatapos po ang kasaysayan kung saan nagsisimula ang proyektong ito: karamihan sa mga buhay na wika ay nasa labas pa rin
ng teknolohiya. Ang [Kung Ano ang Champollion](/docs/what-is-champollion)
ay nagsasaad ng plano sa loob ng limang minuto, at
ang [kung paano po binibilang ang saklaw](/docs/network/context/coverage-counting) ay nagpapakita
kung saan eksaktong nakapwesto ang linya ngayon.
