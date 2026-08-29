# Machine Translation: Isang Field Briefing (2013–2026)

*Isang naratibong kasaysayan para sa sinumang pumapasok sa larangan ng MT*

---

## Talaan ng Nilalaman

- [Bahagi 1: Ang Neural Revolution (2013–2017)](#part-1-the-neural-revolution-20132017)
- [Bahagi 2: Ang Multilingual Turn (2018–2022)](#part-2-the-multilingual-turn-20182022)
- [Bahagi 3: Ang Panahon ng LLM (2022–2026)](#part-3-the-llm-era-20222026)
- [Bahagi 4: Ang Suliranin ng Low-Resource](#part-4-the-low-resource-problem)
- [Bahagi 5: Finite-State Transducers at Rule-Based Systems](#part-5-finite-state-transducers-and-rule-based-systems)
- [Bahagi 6: Pagsukat ng Kalidad — Ang Suliranin ng Evaluation](#part-6-measuring-quality--the-evaluation-problem)
- [Bahagi 7: Ang Institutional Landscape](#part-7-the-institutional-landscape)
- [Bahagi 8: Mga Bukas na Hangganan](#part-8-open-frontiers)
- [Apendise A: Mahahalagang Papel](#appendix-a-key-papers)
- [Apendise B: Mga Kumperensiya at Komunidad](#appendix-b-conferences-and-communities)
- [Apendise C: Mga Tool, Dataset, at Praktikal na Resource](#appendix-c-tools-datasets-and-practical-resources)
- [Apendise D: Glossary](#appendix-d-glossary)

---

## Bahagi 1: Ang Neural Revolution (2013–2017) {#part-1-the-neural-revolution-20132017}

### Ang Lumang Rehimen: Statistical Machine Translation

Upang maunawaan ang rebolusyong muling humubog sa machine translation noong kalagitnaan ng dekada 2010, kailangan muna ninyong maunawaan kung ano ang nauna rito — at kung bakit ito nabigo.

Mula humigit-kumulang 2003 hanggang 2015, ang nangingibabaw na paradigma sa MT ay **Statistical Machine Translation (SMT)**, partikular ang **phrase-based SMT**. Mapandayang simple ang pangunahing ideya: sa halip na magsulat ng mga patakaran tungkol sa kung paano gumagana ang wika, mangolekta kayo ng napakalaking dami ng parallel text — mga dokumentong isinalin ng mga tao sa dalawang wika — at hayaan ang statistical algorithms na matutunan ang mga pagtutugma. Hahatiin ng sistema ang source sentence sa magkakapatong na phrase (hindi linguistic phrases, kundi arbitraryong n-gram chunks), hahanapin ang statistically likely na salin para sa bawat chunk, at pagkatapos ay bubuuin ang target sentence gamit ang isang **language model** na nagsisiguro na matatas ang output.

Ang pangunahing kasangkapan ng panahong ito ay **Moses**, isang open-source SMT toolkit na pangunahing binuo sa University of Edinburgh sa ilalim ni Philipp Koehn, at inilabas noong 2006. Naging Linux ng MT research ang Moses — halos bawat akademikong MT lab sa mundo ay gumamit nito. Ang katuwang nito, **cdec** (binuo ni Chris Dyer sa Carnegie Mellon), ay nag-alok ng katulad na kakayahan gamit ang ibang formalism. Magkasama, tinukoy ng mga tool na ito ang isang dekada ng MT research.

Nakakagulat na mahusay ang phrase-based SMT para sa mga language pair na may masaganang parallel data at magkatulad na word order — English–French, English–Spanish, English–German. Ngunit mayroon itong malalalim na structural limitations. Walang konsepto ng kahulugan ang sistema. Pattern-matching ito sa ibabaw ng mga surface string, na bumubuo ng mga salin mula sa mga naisaulong fragment. Nahihirapan ito sa long-range dependencies (isang pronoun na tumutukoy sa noun ilang clause pabalik), sa reordering sa pagitan ng typologically different languages (English–Japanese, halimbawa, kung saan lumilitaw ang mga pandiwa sa magkasalungat na posisyon), at sa anumang phenomenon na nangangailangan ng tunay na abstraction sa istruktura ng wika. Bawat pagpapabuti ay nangangailangan ng lalong baroque na engineering: hand-crafted reordering rules, sparse features, malalaking language model. Papalapit na sa kisame nito ang architecture.

### Ang Breakthrough: Sequence-to-Sequence na may Attention

Ang unang bitak sa paradigma ng SMT ay hindi nagmula sa MT community, kundi sa mga deep learning researcher na nagtatrabaho sa mga problema ng sequence modelling.

Noong Setyembre 2014, inilathala nina **Dzmitry Bahdanau, Kyunghyun Cho, at Yoshua Bengio** sa Université de Montréal ang isang papel na magiging transformative: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (iprinisenta sa ICLR 2015). Ang pangunahing inobasyon ay ang **attention mechanism**.

Upang maunawaan kung bakit ito mahalaga, kailangan ninyong malaman ang naunang konteksto. Ilang buwan lamang bago nito, inilathala nina Ilya Sutskever, Oriol Vinyals, at Quoc V. Le sa Google ang ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) (NIPS 2014), na nagpakitang kayang magsalin ng mga pangungusap ang isang neural network na may **encoder–decoder** architecture. Binabasa ng encoder ang source sentence nang salita-sa-salita at ini-compress ito sa isang fixed-length vector — isang numerical summary ng buong input. Pagkatapos, binubuo ng decoder ang target sentence nang salita-sa-salita mula sa vector na iyon.

Elegant ito ngunit may kritikal na kapintasan: ang iisang vector ay isang **bottleneck**. Lahat ng impormasyon sa isang source sentence na may tatlumpung salita ay kailangang isiksik sa isang vector na, halimbawa, may 1,000 numero. Medyo maayos ang salin ng maiikling pangungusap; malubhang bumababa ang kalidad ng mahahabang pangungusap, dahil nalilimutan ng model ang naunang mga salita sa oras na matapos nitong i-encode ang mga nahuling salita.

Nilutas ito ng attention mechanism ni Bahdanau. Sa halip na i-compress ang buong source sa isang vector, pinayagan ang decoder na **tumingin pabalik** sa lahat ng hidden state ng encoder — ang intermediate representations sa bawat source position — at dynamic na timbangin kung aling mga posisyon ang pinaka-kaugnay para sa pagbuo ng bawat target word. Kapag binubuo ang English word na "cat," maaaring mag-attend nang pinakamalakas ang model sa French word na "chat" sa source, kahit magkalayo ang mga ito sa pangungusap. Natutunan ng model na *i-align* ang source at target words bilang bahagi ng proseso ng pagsasalin, sa halip na umasa sa iisang compressed summary.

Ito ang foundational innovation. Hindi lamang pinahusay ng attention ang MT; naging sentral itong mekanismo ng halos lahat ng sumunod na progreso sa natural language processing.

### Naging Neural ang Google

Kahanga-hanga ang mga akademikong resulta noong 2014–2015 ngunit hindi pa production-ready. Nagbago iyon noong huling bahagi ng 2016.

Noong Setyembre 2016, isang malaking team sa Google na pinamunuan ni **Yonghui Wu** ang naglathala ng ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). Ang sistema, na kilala bilang **GNMT** (Google Neural Machine Translation), ay isang industrial-scale encoder–decoder architecture na may attention, na sinanay sa napakalawak na parallel data resources ng Google. Gumawa ang papel ng kapansin-pansing pahayag: sa ilang language pair, nabawasan ng GNMT ang translation errors ng 55–85% kumpara sa umiiral na phrase-based SMT system ng Google.

Noong Nobyembre 2016, tahimik na sinimulan ng Google na ilipat ang Google Translate mula phrase-based SMT patungong GNMT para sa mga pangunahing language pair. Halos kumpleto na ang transisyon para sa high-resource pairs pagsapit ng 2017. Para sa mga user, dramatiko ang pagbabago. Ang mga saling dati ay tila matigas, putol-putol, at paminsan-minsang walang saysay ay naging lubhang mas matatas — minsan ay nakakagulat ang husay. Nagtatapos na ang panahon ng "Google Translate gibberish" bilang biro.

Mabilis po ang naging tugon ng kumpetisyon. Noong Agosto 2017, inilunsad ng **DeepL**, na itinatag ni **Gereon Frahling** sa Cologne, Germany, ang kanilang translation service. Ang DeepL ay nagmula sa Linguee bilingual concordance project at ibinukod ang sarili nito sa pamamagitan ng nakikitang kalidad ng pagsasalin — partikular para sa mga pares ng wikang Europeo, kung saan mabilis itong nakabuo ng reputasyon sa mga propesyonal na tagasalin para sa paggawa ng mas natural at idyomatikong output kaysa sa Google. Ang business model ng DeepL (freemium na may bayad na API) at ang pagtuon nito sa kalidad kaysa sa dami ang magtatakda ng posisyon nito sa merkado sa hinaharap. Sinusuportahan ng DeepL ang humigit-kumulang 33 wika — mas kaunti kaysa sa 194 na nasa listahan ng Cloud Translation ng Google — ngunit may pagpoposisyon na inuuna ang kalidad.

### Ang Transformer

Kung ang attention mechanism ni Bahdanau ang pundasyon, ang **Transformer** naman ang gusaling itinayo sa ibabaw nito — at skyscraper ang gusaling iyon.

Noong Hunyo 2017, isang team ng walong researcher sa Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, at Illia Polosukhin** — ang naglathala ng ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) sa NIPS 2017. Hindi hyperbole ang pamagat; ito ay eksaktong architectural claim. Kung saan gumamit ang naunang mga model ng recurrent neural networks (RNNs) bilang backbone — pagproseso ng mga salita nang sunod-sunod, isa-isa, tulad ng pagbabasa ng pangungusap mula kaliwa pakanan — ganap na tinanggal ng Transformer ang recurrence at umasa lamang sa attention.

Ang mga pangunahing inobasyon ay:

1. **Self-attention**: Bawat salita sa pangungusap ay nag-a-attend sa bawat ibang salita sa parehong pangungusap, kinakalkula ang mga relasyon nang parallel sa halip na sequential. Nakukuha nito ang long-range dependencies nang walang information bottleneck ng RNNs, at — mahalaga — parallel ito sa modernong hardware (GPUs at TPUs), kaya napakalaking bilis ang nadagdag sa training.

2. **Multi-head attention**: Sa halip na kalkulahin ang iisang attention pattern, kinakalkula ng model ang maraming attention pattern nang sabay-sabay ("heads"), kung saan bawat isa ay maaaring kumukuha ng ibang uri ng linguistic relationships — syntactic, semantic, positional.

3. **Positional encoding**: Dahil sabay-sabay na pinoproseso ng self-attention ang lahat ng salita (di tulad ng RNNs, na sequential ang proseso), walang likas na konsepto ng word order ang model. Ang positional encodings — mga mathematical function na inilalagay sa input — ang nagbibigay ng impormasyong ito.

Hindi lamang dinaig ng Transformer ang RNN-based models sa translation benchmarks. Nagsanay ito nang **orders of magnitude faster** dahil sa parallelism nito. Masasabing kasinghalaga ito ng pagpapabuti sa kalidad: maaari na ngayong umulit nang mas mabilis ang mga researcher, magsanay sa mas maraming data, at mag-scale sa mas malalaking model. Nagsimula na ang virtuous cycle of scale.

Sa loob ng dalawang taon, ang Transformer architecture ay naging substrate para sa halos lahat ng state-of-the-art na gawain sa NLP — hindi lamang MT, kundi language modelling, text classification, question answering, summarisation, at kalaunan ang large language models (GPT, BERT, LLaMA) na muling humubog sa mas malawak na AI landscape. Bawat sistemang tatalakayin sa nalalabing bahagi ng briefing na ito ay nakabatay sa Transformer.

### Ang WMT 2016 Watershed

Ang **Conference on Machine Translation** (WMT), na ginaganap taun-taon bilang workshop na co-located sa malalaking NLP conference, ay nagpapatakbo ng competitive **shared tasks** kung saan nagsusumite ang mga research team ng MT systems at niraranggo laban sa isa't isa sa standardized test sets. Ang WMT ang pinakamalapit na katumbas ng public leaderboard sa larangan ng MT.

Sa **WMT 2016**, malinaw na dinaig ng neural MT systems ang phrase-based SMT systems sa halos lahat ng language pair sa shared task. Ito ang sandaling lumipat ang sentro ng bigat ng larangan. Ang mga researcher na gumugol ng karera sa pagbuo ng phrase-based systems ay nagsimulang mag-retool para sa neural paradigm. Sa loob ng dalawang taon, halos tumigil na ang mga bagong publikasyong gumagamit ng phrase-based SMT para sa anumang layunin maliban sa historical comparison. Ang Moses, ang tool na tumukoy sa isang dekada, ay functionally retired na.

Napakabilis ng transisyon ayon sa pamantayan ng academic paradigm shifts — marahil tatlo hanggang apat na taon mula sa papel ni Bahdanau noong 2014 hanggang sa halos ganap na dominasyon ng neural MT pagsapit ng 2018. Para sa researcher na pumapasok sa larangan ngayon, historical context ang phrase-based SMT, hindi aktibong direksiyong pananaliksik. Ngunit mahalagang konteksto ito, dahil umaalingawngaw pa rin sa larangan ang assumptions, benchmarks, at evaluation habits ng panahon ng SMT.

---

## Bahagi 2: Ang Multilingual Turn (2018–2022) {#part-2-the-multilingual-turn-20182022}

### Isang Model, Maraming Wika

Ang unang henerasyon ng neural MT systems ay **bilingual**: isang model kada language pair. Kailangan ng English–French ng isang model; kailangan ng French–English ng hiwalay na model. Ang pag-scale ng ganitong lapit sa N na wika ay teoretikal na nangangailangan ng N×(N−1) models — isang engineering at data bottleneck na epektibong naglimita sa neural MT sa iilang well-resourced pairs.

Ang tanong na tumukoy sa 2018–2022 ay: *maaari bang matutong magsalin ang iisang neural model sa pagitan ng maraming wika nang sabay-sabay?* Lumabas na oo ang sagot, na may malalim at komplikadong mga bunga.

### Cross-Lingual Representations: mBERT at XLM-R

Bago dumating ang multilingual translation models, isang hindi inaasahang tuklas sa language *understanding* models ang naghanda ng entablado.

Noong huling bahagi ng 2018, inilabas ng Google ang **Multilingual BERT (mBERT)** — isang Transformer model na sinanay sa Wikipedia text mula sa 104 na wika. Ang BERT (Bidirectional Encoder Representations from Transformers) ay hindi translation model; isa itong general-purpose language encoder, na sinanay upang hulaan ang masked words sa text. Ang ikinagulat ng mga researcher ay isang emergent property: nakabuo ang mBERT ng **cross-lingual representations** nang hindi kailanman tahasang tinuruan na magkakaugnay ang mga wika. Kung i-fine-tune ninyo ang mBERT sa isang English sentiment classification task at pagkatapos ay ilapat ito sa French text — nang walang French training data — kapansin-pansing mahusay ang performance nito. Ipinahiwatig ng phenomenon na ito, na tinatawag na **zero-shot cross-lingual transfer**, na natututo ang multilingual models ng isang uri ng shared representational space sa pagitan ng mga wika.

Noong 2020, itinulak pa ito ni **Alexis Conneau** at mga kasamahan sa Facebook AI Research (ngayon ay Meta) gamit ang **XLM-R** (Cross-lingual Language Model – RoBERTa). Sinanay sa 2.5 terabytes ng filtered CommonCrawl data sa 100 wika, lubhang dinaig ng XLM-R ang mBERT sa cross-lingual benchmarks. Ipinakita nito na sa sapat na data at model capacity, maaaring bumuo ang iisang encoder ng matatag na multilingual representations.

Hindi mismo mga translator ang mga model na ito, ngunit nagbigay sila ng conceptual at technical foundation para sa multilingual MT. Kung kayang matuto ng isang model ng shared representations sa 100 wika, dapat kayang magsalin ng translation model sa pagitan ng mga ito — kahit sa prinsipyo man lamang.

### Many-to-Many Translation: M2M-100

May maruming sikreto ang traditional multilingual MT systems: niruruta nila ang karamihan ng salin **sa pamamagitan ng English**. Ang pagsasalin mula Portuguese patungong Japanese ay nangangahulugang isasalin muna ang Portuguese sa English, pagkatapos ang English sa Japanese. Pragmatic ang "English-centric" na lapit na ito — karamihan ng parallel data ay may English sa isang panig — ngunit nagdadagdag ito ng compounding errors at ipinapataw ang English-language structure sa bawat salin.

Noong Oktubre 2020, inilathala ng Facebook AI ang **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): isang many-to-many translation model na sumasaklaw sa **100 wika at 2,200 translation directions** nang hindi niruruta sa English. Isa itong conceptual breakthrough. Maaaring magsalin nang direkta ang model sa pagitan, halimbawa, ng Bengali at Swahili, gamit ang parallel data na na-mine mula sa web para sa non-English pairs.

Pinatunayan ng M2M-100 na hindi kinakailangang constraint ng multilingual MT ang English pivoting. Ngunit ipinakita rin nito ang mga limitasyon ng lapit: napaka-uneven ng kalidad sa iba't ibang language pair, kung saan halos hindi magamit ang ilang direksyon. Ang agwat sa pagitan ng "ang model na ito ay *sumasaklaw* sa 2,200 direksyon" at "ang model na ito ay *gumagana nang maayos* sa 2,200 direksyon" ay magiging sentral na tema.

### NLLB-200: No Language Left Behind

Dumating ang pinaka-ambisyosong multilingual MT effort ng Meta noong Hulyo 2022 gamit ang **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), inilathala bilang Meta AI research paper na may mahigit 200 co-authors). Tahasan ang layunin sa pangalan: bumuo ng iisang model na sumusuporta sa 200 wika, na may partikular na pagtutok sa low-resource languages na dati ay hindi pinapansin ng commercial MT.

Malalaki ang technical contributions ng NLLB-200:

- **Architecture**: Isang dense Transformer at isang **Mixture-of-Experts (MoE)** variant, kung saan iba't ibang subset ng parameters ng model ang nag-a-activate para sa iba't ibang language pair. Ang pinakamalaking variant, NLLB-200-MoE-54B, ay may 54 bilyong parameter. Ginawang feasible ng distilled 600M-parameter version ang deployment.

- **Data mining**: Bumuo ang team ng automated tools upang mag-mine ng parallel sentences mula sa web crawls, kabilang ang language identification model (sumasaklaw sa 200+ wika) at parallel sentence filter. Kritikal ang pipeline na ito para sa pangangalap ng training data para sa mga wikang may minimal na presensya sa web.

- **FLORES-200**: Isang standardized evaluation benchmark na sumasaklaw sa lahat ng 200 wika na may professionally translated sentences. Naging mahalagang tool para sa larangan ang FLORES-200 — dati, walang benchmark para sa karamihan ng mga wikang ito.

- **Open release**: Parehong inilabas nang bukas ang model at FLORES-200, na nagbigay-daan sa mga researcher sa buong mundo na bumuo sa ibabaw ng gawain.

Landmark ang NLLB-200, ngunit mahalaga ring maunawaan ang mga limitasyon nito. Napakalaki ng pagkakaiba ng kalidad sa iba't ibang wika. Para sa well-resourced pairs (English–French, English–Chinese), competent ang model ngunit hindi state-of-the-art kumpara sa specialized systems. Para sa low-resource languages, mula useful hanggang halos nonfunctional ang output quality, depende sa dami ng training data na na-mine. Ipinakita rin ng model ang **curse of multilinguality**: ang pagdaragdag ng mas maraming wika sa fixed-capacity model ay nagpapalabnaw sa representation quality para sa bawat wika. Nakikinabang ang low-resource languages sa transfer learning (shared structure sa related languages), ngunit maaaring *lumala* pa ang high-resource languages habang sinusubukan ng model na pagsilbihan ang napakaraming master. Hindi lamang ito scaling problem — sumasalamin ito sa fundamental tension sa multilingual model design.

### Ang Seamless Suite

Ipinagpatuloy ng Meta ang pagtulak sa multilingual MT gamit ang **Seamless** family of models noong 2023–2024. Ang **SeamlessM4T** ("Massively Multilingual and Multimodal Machine Translation," Agosto 2023) ay iisang model na humahawak ng **speech-to-speech, speech-to-text, text-to-speech, at text-to-text translation** sa humigit-kumulang 100 wika (na may magkakaibang coverage sa bawat modality). Kinatawan nito ang pag-uugnay ng dating magkakahiwalay na research threads — automatic speech recognition (ASR), text translation, at text-to-speech (TTS) — sa isang unified multilingual system.

Nagdagdag ang sumunod na **Seamless Communication** suite ng streaming capabilities (near-real-time translation) at expressive speech translation (pagpapanatili ng vocal characteristics tulad ng emotion at speaking style sa pagitan ng mga wika). Nananatiling research prototypes ang mga sistemang ito sa halip na production-ready tools, ngunit ipinapahiwatig nila ang direksiyon ng larangan: multimodal, multilingual, at real-time.

### Ano ang Kahulugan ng "Massively Multilingual" sa Praktika

Para sa researcher na pumapasok sa larangang ito, mahalagang pag-ibahin ang **language coverage** ng model at ang **language quality** nito. Ang model na "sumusuporta sa 200 wika" ay maaaring magbigay ng napakahusay na salin para sa 20 sa mga ito, katanggap-tanggap na output para sa 50, at halos random na text para sa natitira. Nakaliligaw ang headline number nang walang per-language quality assessment.

Ang **curse of multilinguality** ang technical term para sa capacity dilution problem: hindi kayang katawanin ng model na may finite parameters ang lahat ng wika nang pantay-pantay ang husay. Nakikinabang ang pinakamababang-resource na mga wika sa pagdaragdag ng mas maraming wika (sa pamamagitan ng cross-lingual transfer mula sa related languages), ngunit napipinsala ang pinakamataas-resource na mga wika (dahil sa capacity na nagagamit sana para sa kanila). Lumilikha ito ng design tension: gagawa ba kayo ng isang universal model, o maraming specialized ones? Hindi pa nareresolba ng larangan ang tanong na ito.

---

## Bahagi 3: Ang Panahon ng LLM (2022–2026) {#part-3-the-llm-era-20222026}

### Nang Matutong Magsalin ang General-Purpose AI

Ang pagdating ng large language models (LLMs) — GPT-3.5/4, Gemini, Claude, LLaMA — ay lumikha ng kakaibang sitwasyon sa larangan ng MT. Hindi partikular na sinanay para sa translation ang mga model na ito. Sinanay ang mga ito upang hulaan ang susunod na token sa napakalalaking corpus ng text, pangunahing English ngunit lalong multilingual. Gayunpaman, kapag pinrompt ng mga tagubiling tulad ng "Translate the following French sentence into English," nakagagawa sila ng mga salin na, para sa high-resource language pairs, nakakagulat ang husay.

Nagdulot ito ng identity question para sa larangan: kung ang general-purpose AI ay nakapagsasalin nang kasinghusay ng purpose-built translation systems, nananatili bang hiwalay na research area ang "machine translation"? Ang sagot, noong 2026, ay qualified yes — ngunit naging malalim ang pagkakasalikop ng MT research at general-purpose LLM development.

### Ang Unang Benchmarks: LLMs vs. Dedicated MT

Nagsimula ang systematic evaluation ng LLMs para sa translation noong unang bahagi ng 2023, ilang sandali matapos ilabas ang ChatGPT (Nobyembre 2022) at GPT-4 (Marso 2023).

Nagbigay ng maagang assessment ang **Jiao et al. (2023)**, sa ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745). Nagtatag ang kanilang findings ng pattern na nanatiling kapansin-pansing stable: ang LLMs ay **lubhang competitive para sa high-resource European language pairs** (English–German, English–French, English–Chinese) at **malinaw na mas mahina para sa low-resource at typologically distant pairs**. Ipinakilala rin nila ang **pivot prompting** — pagtuturo sa model na magsalin sa pamamagitan ng intermediate language — na nagpahusay ng performance sa mahihirap na pair.

Nagsagawa ang **Hendy et al. (2023)** sa Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) ng mas komprehensibong evaluation sa 18 translation directions. Ang kanilang konklusyon: ang GPT models ay nakipagsabayan sa state-of-the-art commercial MT para sa high-resource pairs ngunit may "limited capability" sa low-resource languages.

Pagsapit ng 2024–2025, mas luminaw ang larawan. Para sa **high-resource pairs**, ang pinakamahuhusay na LLMs (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) ay pumantay o lumampas sa dedicated MT systems, partikular sa mga task na nangangailangan ng contextual understanding, idiomatic expression, at document-level coherence — mga larangang palaging naging hamon sa traditional neural MT, na nagpoproseso ng mga pangungusap nang magkakahiwalay. Para sa **low-resource pairs**, mas mahusay pa rin ang dedicated multilingual models tulad ng NLLB-200 at purpose-built systems ng Google Translate, kadalasan nang malaki ang agwat.

### BLOOM: Ang Open Multilingual Moment

Noong Hulyo 2022, inilabas ng **BigScience** collaborative — isang year-long volunteer effort na coordinated ng Hugging Face at kinabibilangan ng daan-daang researcher sa buong mundo — ang **BLOOM**: isang 176-billion-parameter open-access multilingual language model na sumasaklaw sa **46 natural languages at 13 programming languages**. Sinanay sa ROOTS corpus gamit ang Jean Zay supercomputer sa France, ang BLOOM ang unang tunay na napakalaking open-access multilingual LLM.

Hindi dedicated translator ang BLOOM, ngunit malaki ang kahalagahan nito para sa MT. Ipinakita nito na kayang suportahan ng open-source models ang dose-dosenang wika sa scale, na nagbibigay ng pundasyon para sa multilingual research sa labas ng corporate labs. Ipinakita ng instruction-tuned variant nito, **BLOOMZ**, ang cross-lingual generalisation capabilities — fine-tuned sa mga task sa isang wika, nagagawa nitong isagawa ang mga ito sa iba.

### LLaMA at ang Fine-Tuning Explosion

Ibang landas ang tinahak ng **LLaMA** (Large Language Model Meta AI) series ng Meta, simula noong Pebrero 2023. Pangunahing English-centric ang LLaMA 1, na may limitadong multilingual capability. Bahagyang umunlad ang LLaMA 2 (Hulyo 2023) ngunit itinuturing pa rin ang non-English use bilang "out-of-scope." Dumating ang inflection point sa **LLaMA 3** (Abril 2024), na nagpalawak ng training data nang pitong ulit at nagpakilala ng 128,000-token vocabulary — na lubhang nagpahusay sa encoding ng non-English text. Opisyal na sinuportahan ng LLaMA 3 ang walong wika (English, German, French, Italian, Portuguese, Hindi, Spanish, Thai) na may magkakaibang kalidad para sa marami pang iba.

Ang kahalagahan ng LLaMA para sa MT ay mas nakasalalay sa papel nito bilang **foundation model for fine-tuning** kaysa sa direktang translation capability nito. Parehong nakabatay sa LLaMA ang dalawang specialized translation LLM na tatalakayin sa ibaba — Tower at ALMA. Lumikha ang open weights ng masiglang ecosystem ng specialized derivatives.

### Purpose-Built Translation LLMs: Tower at ALMA

Ang pinakamahalagang development ng 2023–2024 ay ang paglitaw ng mga LLM na partikular na fine-tuned para sa translation — hybrid systems na nagmamana ng contextual sophistication ng general-purpose LLMs ngunit optimized para sa translation quality.

Ipinakita ng **ALMA** (Advanced Language Model-based trAnslator), na binuo ni **Haoran Xu** at mga kasamahan sa Johns Hopkins University, ang isang mahalagang insight: hindi ninyo kailangan ng napakalaking parallel corpora upang bumuo ng mahusay na translator. Gumamit ang ALMA ng **two-stage fine-tuning** approach sa LLaMA-2: una, continued pre-training sa non-English monolingual data upang palawakin ang multilingual knowledge; pagkatapos, fine-tuning sa maliit ngunit high-quality parallel dataset. Ang follow-up na **ALMA-R** (Enero 2024) ay nagpakilala ng **Contrastive Preference Optimisation (CPO)** — pagsasanay sa model sa preference data (mas mahusay vs. mas mahinang salin) sa halip na parallel text lamang. Ang resulta: 7B at 13B parameter models na pumantay o lumampas sa GPT-4 sa translation benchmarks. Inilathala ang papel sa ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Ang mas bagong bersyon, **X-ALMA**, ay nagpalawak ng coverage sa 50 wika gamit ang language-specific plug-and-play modules.

Mas malawak ang pananaw ng **Tower**, na binuo ng **Unbabel** (isang Portuguese AI translation company) sa pakikipagtulungan sa SARDINE Lab at MICS Lab. Sa halip na mag-optimize para sa translation lamang, saklaw ng Tower ang **buong translation pipeline**: source correction, named entity recognition, post-editing, translation ranking, at error detection. Dinaig ng initial Tower models (7B at 13B, batay sa LLaMA-2) ang NLLB-200-54B. Dinaig ng **Tower v2** (70B, ipinrisenta sa WMT 2024) ang GPT-4o, Claude 3.5 Sonnet, at DeepL. Pinalawak ng pinakabagong **Tower+** (2025) ang saklaw sa 22–27 wika at tinugunan ang "catastrophic forgetting" — ang tendensiya ng fine-tuned models na mawalan ng general capabilities — sa pamamagitan ng preference optimisation at reinforcement learning.

### Prompting vs. Fine-Tuning: Ang Nagpapatuloy na Debate

Isang paulit-ulit na tanong sa LLM-MT space ay kung mas mabuti bang **i-prompt** ang general-purpose LLM para sa translation (zero-shot o few-shot) o **i-fine-tune** ang model partikular para sa translation. Ipinahihiwatig ng ebidensiya na nakadepende sa task ang sagot:

- Pinapanatili ng **Prompting** ang general capabilities ng LLM — formality steering, style control, document-level coherence — at hindi nangangailangan ng karagdagang training. Ideal ito para sa rapid iteration at creative o contextual translation.
- Nagbibigay ang **Fine-tuning** ng mas mataas na accuracy sa partikular na language pairs at domains ngunit may panganib na pababain ang iba pang capabilities ("catastrophic forgetting"). Nangangailangan ito ng parallel data at compute.
- Lalong nangingibabaw sa praktika ang **Hybrid approaches**: fine-tuned models para sa initial translation, na may LLM-based post-editing o self-refinement passes.

### Ang Kasalukuyang State of the Art (2025–2026)

Ang tapat na sagot sa "ano ang pinakamahusay na MT system?" ay: **depende ito**.

| Use Case | Pinakamahusay na Approach | Bakit |
|---|---|---|
| High-resource, high-volume | Commercial NMT (Google, DeepL) | Bilis, gastos, consistency |
| High-resource, high-quality | LLMs (GPT-4o, Gemini 2.5 Pro) o Tower+ | Contextual understanding, paghawak ng idiom |
| Low-resource, broad coverage | Meta OMT, NLLB-200, Google Translate | Purpose-built multilingual coverage |
| Low-resource, specific pair | Fine-tuned NLLB o LLM sa domain data | Targeted quality improvement |
| Open-source research | Tower+, ALMA-R, X-ALMA | Open weights, reproducible, competitive |

Noong Marso 2026, inilabas ng Meta ang **OMT (Omnilingual Machine Translation)** — ang successor ng NLLB-200, na nagpapalawak ng coverage mula 200 tungong **1,600+ wika**. Tinutugunan ng OMT ang tinatawag ng Meta na "generation bottleneck": kayang umunawa ng large language models ng maraming wika ngunit nahihirapang bumuo ng matatas na text sa mga ito. May dalawang architecture ang OMT — OMT-LLaMA (decoder-only, 1B–8B parameters) at OMT-NLLB (encoder-decoder) — at nagpapakilala ng mga bagong evaluation tool kabilang ang BOUQuET at BLASER 3 (isang reference-free quality estimation metric). Ipinapahiwatig ng mga maagang ulat na pumapantay o lumalampas ang 1B–8B parameter models sa 70B LLM baselines sa translation tasks. Hindi pa malinaw kung isasama kalaunan ng OMT ang Plains Cree o iba pang Algonquian languages.

Ang findings paper ng WMT 2024 shared task ay angkop na pinamagatang **"The LLM Era Is Here but MT Is Not Solved Yet."** Itinaas ng LLMs ang ceiling para sa high-resource translation ngunit hindi pa nalulutas ang fundamental challenges ng low-resource MT, evaluation adequacy, o morphological complexity.

---

## Bahagi 4: Ang Suliranin ng Low-Resource {#part-4-the-low-resource-problem}

### Bakit Naiiwan ang Karamihan ng mga Wika

Mula sa humigit-kumulang 7,000 buhay na wika sa mundo, ang mga naka-deploy na commercial MT services ay sumasaklaw lamang sa humigit-kumulang 200, at ang bawat anyo ng machine translation kapag pinagsama-sama ay umaabot lamang sa humigit-kumulang 550 ([kung paano kami nagbibilang](/docs/network/context/coverage-counting)). Ang malaking mayorya ng mga wika ay **walang machine translation kahit ano pa man**. Upang maunawaan kung bakit, kinakailangan pong maunawaan kung ano ang kailangan ng mga MT system at kung ano ang kulang sa karamihan ng mga wika.

Nangangailangan ang neural MT ng **parallel data**: malalaking koleksiyon ng mga pangungusap na isinalin ng mga tao sa pagitan ng dalawang wika. Para sa English–French, sagana ang ganitong data — EU parliamentary proceedings (Europarl), UN documents, news archives, at commercial translation memories ay nagbibigay ng daan-daang milyong parallel sentences. Para sa wikang tulad ng Plains Cree (*nêhiyawêwin*), na sinasalita ng humigit-kumulang 20,000 tao pangunahin sa kanlurang Canada, halos walang ganoong data. Walang UN proceedings sa Plains Cree. Walang bilingual news corpora. Ang kabuuang parallel text na available ay maaaring sukatin sa libu-libong pangungusap sa halip na milyon-milyon.

Gumagamit ang larangan ng rough resource tiers upang ikategorya ang mga wika:

| Tier | Available na Parallel Data | Mga Halimbawa |
|---|---|---|
| High-resource | >10 milyong sentence pairs | English, French, German, Chinese, Spanish |
| Medium-resource | 1–10 milyong pairs | Turkish, Vietnamese, Swahili |
| Low-resource | 100K–1 milyong pairs | Yoruba, Guaraní, Maltese |
| Extremely low-resource | <100K pairs | Plains Cree, Quechua, karamihan ng Indigenous languages |
| Essentially zero | <10K pairs | Libu-libong wika sa buong mundo |

### Ang Tokenizer Problem

Bago maproseso ng neural model ang text, kailangan nitong i-convert ang mga character sa numerical tokens — isang prosesong tinatawag na **tokenisation**. Ang nangingibabaw na tokenisation algorithm ay **Byte Pair Encoding (BPE)**, na pinasikat nina Sennrich et al. (2016) at ipinatupad sa mga tool tulad ng **SentencePiece** (Kudo & Richardson, 2018). Gumagana ang BPE sa pamamagitan ng pagkatuto sa pinakakaraniwang character sequences sa training corpus at pagbuo ng vocabulary ng subword units. Sa English, ang karaniwang salita tulad ng "the" ay nagiging isang token; ang rare words ay hinahati sa subword pieces ("unforgivable" → "un" + "forgiv" + "able").

Ang problema ay ang BPE vocabularies ay pangunahing sinasanay sa high-resource languages, kung saan kadalasang nangingibabaw ang English. Para sa low-resource languages, lalo na yaong may complex morphology o non-Latin scripts, malubha ang mga kahihinatnan:

- **Over-segmentation**: Ang isang salita sa polysynthetic language tulad ng Plains Cree ay maaaring mag-encode ng buong clause. Ang salitang *nikî-nipâw* ("I slept") ay hahatiin sa maraming fragment — posibleng individual bytes — dahil hindi pa nakita ng BPE algorithm ang mga character sequence na ito dati. Ang isang meaningful unit para sa speaker ay nagiging dose-dosenang meaningless fragments para sa model.

- **The fertility problem**: Ang isang salita sa morphologically complex language ay maaaring mangailangan ng 5–15 tokens, habang ang English translation nito ay gumagamit ng 1–3. Lumilikha ito ng napakalaking asymmetry sa sequence length na nagpapababa sa attention alignment at translation quality.

- **Script penalties**: Ang mga wikang gumagamit ng non-Latin scripts (Cree syllabics, Ethiopic, Devanagari) ay mas hindi mahusay na na-tokenize, minsan bumabagsak sa individual bytes. Nangangahulugan ito na dramatikong mas maliit ang effective context window ng model para sa mga wikang ito.

Hindi lamang ito technical inconvenience. Epektibong ini-encode ng tokenizer vocabulary ang bias pabor sa well-resourced languages sa pinakapundamental na antas ng sistema. Ang model na gumugugol ng 15 tokens upang i-encode ang isang Cree word ay may mas kaunting natitirang capacity upang maunawaan ang natitirang pangungusap kumpara sa model na nagpoproseso ng English, kung saan maaaring umokupa ng 3 tokens ang parehong impormasyon.

### Ang Data Quality Problem

Ang limitadong parallel data na umiiral para sa low-resource languages ay kadalasang nagmumula sa **narrow domains**. Ang dalawang pinakamalaking source ng multilingual parallel text para sa under-resourced languages ay:

1. **Biblical translations**: Naisalin ang Bible sa mahigit 700 wika, at mga bahagi nito sa mahigit 3,000. Ginagawa nitong ang religious text ang single most available parallel resource para sa maraming wika — ngunit ang model na pangunahing sinanay sa biblical text ay natututo ng partikular na register, vocabulary, at domain. Kaya nitong gumawa ng "thou shalt not" ngunit hindi maisalin ang "please book a flight."

2. **JW300**: Isang dataset na hinango mula sa Jehovah's Witnesses publications, na sumasaklaw sa humigit-kumulang 300 wika. Bagama't malaki at multilingual, nagbubukas ang JW300 ng parehong domain skew issues (religious content) at ethical concerns tungkol sa provenance at consent ng underlying translations.

Isa pang seryosong alalahanin ang **Benchmark contamination**. Kapag kakaunti ang parallel data, maaaring mapunta ang parehong text sa training at evaluation sets — isang data leak na nagpapalaki ng quality metrics. Habang mas maliit ang data pool, mas mahirap itong pigilan at tuklasin.

### Data Augmentation: Paggawa ng Higit mula sa Kaunti

Nakabuo ang mga researcher ng mga technique upang pahabain ang limitadong data:

- **Backtranslation** (Sennrich et al., 2016): Sanayin ang initial model sa available parallel data, pagkatapos gamitin ito upang isalin ang **monolingual** target-language text pabalik sa source language. Lumilikha ito ng synthetic parallel data na maingay ngunit maaaring lubhang magpahusay ng model quality. Naging standard technique ang backtranslation sa buong resource spectrum.

- **LLM-generated synthetic data**: Paggamit ng large language models upang bumuo ng training data para sa low-resource pairs. Promising ito ngunit nagpapakilala ng panganib — maaaring magpakita ang generated text ng "translationese" (hindi natural na literal o source-influenced patterns) at maaaring palakasin ang anumang biases na nasa LLM.

- **Cross-lingual transfer**: Pagsasanay sa parallel data mula sa related higher-resource language (hal., paggamit ng Spanish–English data upang i-bootstrap ang Guaraní–English MT) at pag-asa na lilipat ang shared structural features. Mas mahusay itong gumagana para sa closely related languages kaysa typologically distant ones.

- **Morphological segmentation**: Pre-processing ng text upang hatiin ang mga salita sa morphemes (pinakamaliit na meaningful units) bago ipasok sa model. Para sa agglutinative at polysynthetic languages, maaari nitong dramatikong mapahusay ang tokenisation efficiency at translation quality. Direktang konektado ang lapit na ito sa rule-based tools na tatalakayin sa susunod na seksiyon.

---

## Bahagi 5: Finite-State Transducers at Rule-Based Systems {#part-5-finite-state-transducers-and-rule-based-systems}

### Bakit Mahalaga Pa Rin ang Rules

Hanggang dito, ang naratibo ay tungkol sa neural dominance: statistical systems na pinalitan ng neural networks, neural networks na pinalitan ng Transformers, Transformers na pinalaki tungo sa LLMs. Ngunit may parallel tradition sa computational linguistics na hindi kailanman nawala — at para sa ilang wika, nananatili itong indispensable.

Ini-encode ng **Rule-based systems** ang explicit linguistic knowledge: morphological rules, lexicons, syntactic transfer patterns. Hindi sila natututo mula sa data; binubuo sila ng mga linguist na nakauunawa sa mga wikang sangkot. Para sa well-resourced languages, matagal nang nalampasan ng data-driven methods ang ganitong lapit. Ngunit para sa mga wikang may complex morphology at minimal data, kadalasang nagbibigay ang rule-based systems ng tanging reliable analysis na available.

### Finite-State Transducers: Isang Primer

Ang **Finite-State Transducer (FST)** ay isang computational device na nagma-map sa pagitan ng dalawang antas ng representation — karaniwang sa pagitan ng surface form (ang nakikita ninyo sa text) at underlying analysis (ang kahulugang linguistic nito). Isipin ito bilang makina na may states at transitions: nagbabasa ito ng input symbols, lumilipat sa pagitan ng states, at naglalabas ng output symbols.

Para sa kongkretong halimbawa, isaalang-alang ang Plains Cree word na *nikî-nipâw*. Maaaring kunin ng FST-based morphological analyser ang surface form na ito at gumawa ng:

> nipâw + Verb + AI + Independent + Past + 1st Person Singular

Sinasabi nito sa inyo na ang salita ay verb na *nipâw* ("to sleep") sa independent order, past tense, first person singular — "I slept." Ini-encode ng transducer ang mga patakaran ng Cree morphology: aling prefixes ang nagpapahiwatig ng person, alin ang nagmamarka ng tense, aling verb forms ang kumukuha ng aling inflectional patterns. Mahalaga, gumagana ito nang **bidirectionally**: kapag binigyan ng analysis, maaaring bumuo ang FST ng tamang surface form.

Kabilang sa technical infrastructure para sa pagbuo ng FSTs ang:

- **HFST** (Helsinki Finite-State Transducer Technology): Isang open-source toolkit na pinananatili sa University of Helsinki, na nagbibigay ng computational framework para sa pagbuo at pagpapatakbo ng transducers. Ipinapatupad ng HFST ang mga formalism na orihinal na binuo ng Xerox (lexc, twolc, xfst) at compatible ito sa **foma**, isa pang open-source FST toolkit.

- **lexc**: Isang formalism para tukuyin ang **lexicon** — ang imbentaryo ng morphemes (roots, prefixes, suffixes) at ang word-formation patterns na nagkokombina sa mga ito.

- **twolc**: Isang formalism para tukuyin ang **morphophonological rules** — ang sound changes na nangyayari kapag nagkokombina ang morphemes (hal., vowel harmony, consonant mutation).

### GiellaLT: Arctic Infrastructure

Ang **GiellaLT** (mula sa Northern Sámi word na *giella*, "language") ay isang language technology infrastructure na nakabase sa **UiT — The Arctic University of Norway** sa Tromsø. Kinakatawan nito ang pinakamalawak na pagsisikap sa buong mundo na bumuo ng FST-based tools para sa Indigenous at minority languages.

Orihinal na kilala bilang **Giellatekno** (pananaliksik) at **Divvun** (mga tool sa wika), ang proyekto — na pinamumunuan ng mga lingguwistang sina **Trond Trosterud** at **Sjur Nørstebø Moshagen** — ay nakabuo ng mga morphological analyser, spell-checker, at iba pang mga tool sa wika para sa higit sa **100 wika**, na may pagtuon sa mga wikang Sámi (Northern Sámi, Lule Sámi, South Sámi, at iba pa), mga wikang Uralic, at iba pang mga wika sa Arctic at mga Katutubong wika.

Ginagamit ng GiellaLT ang HFST bilang computational backend nito at nakabuo ito ng sophisticated shared infrastructure: common build system, shared testing frameworks, at reusable linguistic components. Open-source ang lahat ng code, hosted sa [GitHub](https://github.com/giellalt), na may daan-daang repository kabilang ang core infrastructure at language-specific repos (hal., `lang-sme` para sa Northern Sámi, `lang-crk` para sa Plains Cree). Nasa [giellalt.github.io](https://giellalt.github.io/) ang dokumentasyon ng proyekto. Ang public-facing portal, **[Borealium.org](https://borealium.org)** — pinondohan ng Nordic Council of Ministers — ay nagbibigay ng libreng access sa proofing tools, keyboards, dictionaries, language-learning tools (Oahpa), at speech synthesis para sa Sámi languages, Kven, Faroese, Greenlandic, at iba pa.

Kapansin-pansin ang relasyon sa pagitan ng GiellaLT at national language policy. Malaking bahagi ng funding ng proyekto ay nagmumula sa **Norwegian Sámi Parliament** at Nordic government language programmes, na sumasalamin sa political commitment sa Indigenous language technology na hindi pangkaraniwan ang lawak at tagal.

### Apertium: Open-Source Rule-Based MT

Ang **[Apertium](https://www.apertium.org/)** ay isang open-source rule-based machine translation platform, na orihinal na binuo sa Universitat d'Alacant (Spain) gamit ang funding mula sa Spanish at Catalan governments. Nagsimula ito noong 2004 na may pagtutok sa related language pairs (Spanish–Catalan, Spanish–Portuguese) kung saan ang shallow transfer rules — pagsasalin salita-sa-salita na may morphological adjustments — ay nagbubunga ng nakakagulat na mahusay na resulta. Kabilang sa mahahalagang contributor si **Francis M. Tyers**, na naging sentral sa development ng Apertium at sa adoption nito para sa under-resourced languages.

Classic **pipeline** ang architecture ng Apertium:

1. **Morphological analysis** (FST-based): Tukuyin ang lemma at morphological features ng bawat salita
2. **Part-of-speech disambiguation**: Piliin ang tamang analysis kapag ambiguous ang mga salita
3. **Lexical transfer**: I-map ang source-language lemmas sa target-language lemmas
4. **Structural transfer**: Mag-apply ng rules upang hawakan ang word-order changes, agreement, at iba pang syntactic differences
5. **Morphological generation** (FST-based): Gawin ang tamang inflected target-language surface form

Noong 2025, sinusuportahan ng Apertium ang daan-daang language pairs sa magkakaibang quality levels, lahat ay hosted sa [GitHub](https://github.com/apertium). Patuloy itong aktibong dine-develop ng international community at partikular na kapaki-pakinabang para sa closely related language pairs kung saan maaaring makamit ng rule-based approach nito ang katanggap-tanggap na kalidad nang walang training data.

### Hybrid Approaches: FST + Neural

Ang pinaka-promising frontier para sa low-resource MT ay maaaring **hybrid architectures** na pinagsasama ang rule-based morphological analysis at neural translation. Diretso ang ideya: gumamit ng FST upang hatiin ang mga salita sa morphemes (nilulutas ang tokenization problem na inilarawan sa Bahagi 4), pagkatapos ipasok ang segmented text sa neural MT system.

Para sa polysynthetic language tulad ng Plains Cree, nangangahulugan ito na tumatanggap ang neural model ng sequence ng meaningful units sa halip na arbitrary byte fragments. Ang **Alberta Language Technology Lab (ALT Lab)** sa University of Alberta, na pinamumunuan ni **Antti Arppe**, ay bumuo ng comprehensive FST-based morphological analysers at community-facing dictionary tools para sa Plains Cree gamit ang GiellaLT infrastructure. Ipinapakita ng pinakabagong published work nila (Arppe 2025, AmericasNLP) ang FST-based mapping sa pagitan ng inflected Cree word-forms at English phrases — mahalagang "restricted translation" sa pamamagitan ng finite-state methods, na gumagana sa word/phrase level sa halip na full sentences. Kapansin-pansin, **hindi** pa naglathala ang ALT Lab ng hybrid FST+neural MT system; linguistically grounded at rule-based ang kanilang gawain, at inuuna ang reliability at community utility kaysa experimental neural approaches. Samantala, ipinakita nina Nguyen, Hammerly, at Silfverberg (2025, AmericasNLP) ang hybrid LLM+FST pipeline para sa Ojibwe verbs sa UBC, na nakamit ang matitibay na resulta (chrF 0.82) — ang pinakamalapit na published analog sa hybrid approach para sa isang Algonquian language.

Kinakatawan ng hybrid strategy na ito ang pagtagpo ng dalawang tradisyong dumaloy sa kasaysayan ng MT: explicit knowledge ng linguist at statistical learning ng engineer. Para sa mga wikang pinaka-nangangailangan ng MT, hindi sapat ang alinmang tradisyon kung nag-iisa lamang.

---

## Bahagi 6: Pagsukat ng Kalidad — Ang Suliranin ng Evaluation {#part-6-measuring-quality--the-evaluation-problem}

### Paano Ninyo Malalaman Kung Mahusay ang Isang Salin?

Mukhang simple ang tanong na ito. Sa katunayan, isa ito sa pinakamahirap na hindi pa nalulutas na problema sa larangan, at ang paraan ng pagsagot ninyo rito ang tumutukoy kung aling systems ang tila "gumagana" at alin ang hindi.

### BLEU: Ang Hindi Perpektong Standard

Sa loob ng mahigit dalawang dekada, ang nangingibabaw na automatic metric sa MT ay **BLEU** (Bilingual Evaluation Understudy), na ipinakilala nina Papineni et al. sa IBM noong 2002. Sinusukat ng BLEU kung gaano kalaki ang overlap ng word sequences (n-grams) ng machine translation sa isa o higit pang human reference translations. May kasama itong brevity penalty upang pigilan ang systems na dayain ang score gamit ang maiikling output.

Naging currency ng larangan ang BLEU dahil mabilis, mura, language-independent, at reproducible ito. Halos bawat MT paper na inilathala sa pagitan ng 2002 at 2020 ay nag-ulat ng BLEU scores. Ginamit ito ng WMT shared tasks bilang primary metric sa loob ng maraming taon.

Ngunit may malalalim na kapintasan ang BLEU na lalong naging malinaw:

- **Walang semantic understanding**: Pure surface matching ang BLEU. Kung gumagamit ang salin ng perpektong synonym na nagkataong wala sa reference, pinaparusahan ito ng BLEU. Ang pangungusap na "the cat sat on the mat" ay makakakuha ng zero laban sa reference na "the feline rested on the rug."
- **Mahinang sentence-level discrimination**: Dinisenyo ang BLEU bilang corpus-level metric. Sa sentence level, unreliable at noisy ito.
- **Morphological blindness**: Para sa agglutinative languages (Turkish, Finnish, Swahili), kung saan maaaring magkaroon ang isang lemma ng dose-dosenang inflected forms, catastrophic ang pagbagsak ng strict word-level matching. Ang correctly inflected verb na naiiba sa reference dahil sa isang suffix ay makakakuha ng zero.
- **Mahinang correlation sa human judgment**: Ipinakita ng meta-analyses, partikular ni Reiter (2018), na kadalasang mahina ang correlation ng BLEU sa human quality assessments, lalo na para sa high-quality systems at para sa mga wikang malayo sa English.

### chrF at chrF++

Tinutugunan ng **chrF** (character F-score), na ipinakilala ni Maja Popović noong 2015, ang morphological blindness ng BLEU sa pamamagitan ng pagsukat ng overlap sa **character level** sa halip na word level. Nagbibigay ito ng partial credit para sa shared stems at roots kahit magkaiba ang inflections — mahalaga para sa morphologically rich languages. Idinadagdag pabalik ng **chrF++** (Popović, 2017) ang word-level n-grams, na nakakamit ang mas mahusay na correlation sa human judgment kaysa character-only o word-only metrics. Pareho itong ipinatupad sa **sacreBLEU**, ang standard evaluation toolkit, at naging standard secondary metrics sa WMT shared tasks.

### COMET at xCOMET: Neural Evaluation

Ang pinakamahalagang pagsulong sa MT evaluation ay ang paglipat sa **neural metrics** — evaluation models na mismong Transformers, na sinanay upang hulaan ang human quality judgments.

Ang **COMET** (Crosslingual Optimized Metric for Evaluation of Translation), na binuo ni Ricardo Rei at mga kasamahan sa **Unbabel** (2020), ay gumagamit ng cross-lingual encoder (XLM-RoBERTa) upang i-embed ang source sentence, ang translation, at ang reference, pagkatapos ay hulaan ang quality score. Hindi tulad ng BLEU, gumagana ang COMET sa semantic space — kinikilala nito ang paraphrases, kinukuha ang meaning preservation, at palagi itong nagpapakita ng mas mataas na correlation sa human judgment kaysa surface-level metrics. Nanalo o nanguna ang COMET sa WMT Metrics Shared Tasks mula 2020 onward.

Mas lumalayo pa ang **xCOMET** (Guerreiro et al., 2024, inilathala sa TACL): bukod sa quality score, gumagawa ito ng **fine-grained error span detection** — tinutukoy ang partikular na errors sa translation, kiniklasipika ang mga ito ayon sa type (accuracy, fluency, terminology) at severity (minor, major, critical). Tinutulay nito ang agwat sa pagitan ng automatic scoring at human linguistic analysis.

### AfriCOMET: Evaluation para sa Underserved

Maaaring hindi mag-generalise nang mahusay ang standard COMET, na pangunahing sinanay sa European-language human judgments, sa typologically different languages. Tinutugunan ito ng **AfriCOMET** (Wang, Adelani et al., NAACL 2024) sa pamamagitan ng fine-tuning sa human evaluation data mula sa **13 African languages** at paggamit ng **AfroXLM-R** — isang multilingual encoder na partikular na sinanay upang mas mahusay na katawanin ang African languages. Ipinapakita ng gawaing ito, na ginawa ng Masakhane community (tingnan ang Bahagi 7), na ang evaluation metrics mismo ay kailangang iangkop para sa linguistic diversity.

### Human Evaluation: MQM at Direct Assessment

Proxies ang automatic metrics. Nananatiling **human evaluation** ang ground truth, na may dalawang pangunahing anyo:

Ang **Direct Assessment (DA)** ay humihiling sa human raters na bigyan ng score ang translations sa 0–100 scale. Medyo mabilis at mura ito (maaaring gumamit ng crowd-sourced raters) at ito ang primary human evaluation method sa WMT mula 2017 hanggang 2020. Kahinaan nito: habang bumuti ang MT quality, hindi na nakapag-iba ang non-expert raters sa pagitan ng systems na gumagawa ng near-professional output. Naging unreliable ang DA sa tuktok ng quality spectrum.

Pinalitan ng **Multidimensional Quality Metrics (MQM)** ang DA bilang primary human evaluation method ng WMT mula 2021 onward. Gumagamit ang MQM ng **professional translators** na nagmamarka ng specific error spans sa translation, nagki-classify ng errors ayon sa type (mistranslation, omission, grammar, terminology) at severity (minor = 1 point, major = 5 points, critical = 25 points). Nagbubunga ito ng parehong quality score at actionable diagnostic information — hindi lamang ninyo alam kung *gaano kasama* ang translation, kundi *ano mismo ang naging mali*.

| Feature | DA | MQM |
|---|---|---|
| Raters | Crowd-workers | Professional translators |
| Method | Holistic 0–100 score | Error span annotation |
| Diagnostics | Wala | Detalyadong error categorisation |
| Cost | Mas mababa | Mas mataas |
| Reliability | Mas mahina para sa high-quality MT | Gold standard |
| Pangunahing gamit sa WMT | 2017–2020 | 2021–kasalukuyan |

### Ang Evaluation Crisis para sa Low-Resource Languages

Para sa low-resource languages, pinapalala ng ilang salik ang evaluation problem:

- **Walang qualified evaluators**: Nangangailangan ang MQM ng bilingual professional translators. Para sa maraming LRLs, napakahirap makahanap ng ganitong evaluators.
- **Walang reference translations**: Parehong nangangailangan ang COMET at BLEU ng reference translations para sa paghahambing. Para sa maraming domain at wika, wala ang mga ito.
- **Metric bias**: Parehong binuo at na-validate sa European language data ang surface metrics at neural metrics. Hindi tiyak ang pag-uugali ng mga ito sa typologically distant languages.
- **Hallucination risk**: Sa low-resource settings, maaaring gumawa ang MT models ng fluent output na ganap na walang kaugnayan sa source — isang phenomenon na tinatawag na **hallucination**. Maaaring magbigay ng non-zero scores ang surface metrics sa hallucinated output kung aksidenteng may shared n-grams ito sa reference.

Mahalaga ang pagbuo ng **custom evaluation sets** — kahit maliliit na 200–500 maingat na curated sentence pairs sa target domain — para sa anumang seryosong low-resource MT effort. Ang pag-asa lamang sa FLORES-200 o BLEU scores nang walang domain-specific evaluation ay recipe para sa maling kumpiyansa.

---

## Bahagi 7: Ang Institutional Landscape {#part-7-the-institutional-landscape}

### Corporate Players

Hinihubog ng ilang malalaking corporate actor ang larangan ng MT, bawat isa ay may natatanging strategy:

Ang **Google Translate** ay nananatiling pinakamalawak na ginagamit na MT system sa buong mundo; ang Cloud Translation API nito ay naglilista ng **194 na wika** ([inilathalang listahan ng Google](https://docs.cloud.google.com/translate/docs/languages) — ang consumer product ay nag-a-advertise ng higit pa, ngunit walang inilalathalang static na first-party na listahan ang Google para rito). Ang **1000 Languages Initiative** ng Google (inilunsad noong 2022) ay naglalayong bumuo ng mga AI model na sumasaklaw sa 1,000 pinakaginagamit na wika sa mundo. Ang Cloud Translation API ay nag-aalok ng dalawang tier: Basic (legacy NMT) at Advanced (mga pinakabagong model). Lalo pang isinama ng Google ang mga kakayahan ng Gemini LLM nito sa Translate, kung saan ang mga context-aware at idyomatikong feature sa pagsasalin ay lumabas noong 2025.

Pinuwesto ng **Meta** ang sarili nito bilang pangunahing driver ng open-source multilingual MT sa pamamagitan ng NLLB-200, M2M-100, FLORES-200, at Seamless suite. Naging transformative para sa akademikong research ang pilosopiya ng Meta sa open model release, na nagbibigay ng baselines at tools na kung hindi ay mangangailangan ng napakamahal na compute resources.

May quality-focused niche ang **DeepL**, na sumusuporta sa humigit-kumulang **33 wika** — lahat ay medyo well-resourced — na may reputasyon sa natural at idiomatic output na mas pinipili ng professional translators. Sinasalamin ng business model ng DeepL (freemium consumer + paid API para sa enterprise) at formality parameter nito (pagkontrol sa formal vs. informal register) ang pagtutok sa professional translation workflows kaysa malawak na language coverage.

Ang **Microsoft Translator** (bahagi ng Azure AI Services) ay nagbibigay ng pagsasalin sa **135 wika** na may enterprise integration sa pamamagitan ng Microsoft 365 at Teams. Ang Custom Translator feature nito ay nagpapahintulot sa mga organisasyon na i-fine-tune ang mga model sa mga domain-specific na data.

Pinagsasama ng **Unbabel** ang MT at human post-editing sa isang "human-in-the-loop" workflow, kasabay ng research contributions nito (COMET, xCOMET, Tower). Kinakatawan nito ang commercial application ng "MT + human review" paradigm.

Ang **LibreTranslate**, na binuo sa **Argos Translate** engine, ay nagbibigay ng fully open-source, self-hostable MT alternative na walang corporate dependency — mahalaga para sa organisations na may data sovereignty requirements.

### Grassroots Communities

Ang ilan sa pinakamahalagang gawain sa MT — partikular para sa underserved languages — ay nangyayari sa community-driven research organisations:

Ang **[Masakhane](https://www.masakhane.io/)** (mula sa isiZulu para sa "we build together") ay isang grassroots research community na nakatuon sa NLP para sa African languages, na itinatag noong 2019. May daan-daang miyembro sa buong kontinente at diaspora, at nakagawa ang Masakhane ng foundational datasets (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), evaluation metrics (AfriCOMET), at research na lubhang nagpaunlad sa African-language NLP. Kabilang sa mahahalagang tao si **David Ifeoluwa Adelani** (Mila / UCL). Hosted ang code at data sa [GitHub](https://github.com/masakhane-io); ang pangunahing communication hub ay ang kanilang Slack workspace (sumali sa pamamagitan ng masakhane.io), na may lingguhang community meetings. Gumagana ang Masakhane sa mga prinsipyo ng African ownership ng African language technology — isang sadyang kontra sa extractive research patterns kung saan nangongolekta ang outside institutions ng data mula sa language communities nang walang meaningful collaboration. Tahasan nilang dini-discourage ang "parachute research" kung saan kumukuha ang outsiders ng linguistic data nang walang meaningful community partnership.

Ang **AmericasNLP** ay isang workshop series (co-located with NAACL) na nakatuon sa NLP para sa Indigenous languages of the Americas. Inoorganisa ng mga researcher kabilang sina **Manuel Mager**, **Arturo Oncevay**, at **Luis Chiruzzo**, nagpapatakbo ito ng shared tasks sa MT para sa mga wikang tulad ng Quechua, Guaraní, Aymara, Nahuatl, Rarámuri, at iba pa. Inililitaw ng workshop ang research challenges na natatangi sa Americas — polysynthetic morphology, tonal systems, extreme data scarcity, at political dimensions ng language technology para sa colonised peoples.

Ang **[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) sa University of Alberta, na pinamumunuan ni **Antti Arppe**, ay partikular na nakatuon sa computational tools para sa Plains Cree at iba pang Indigenous languages ng western Canada. Gumagawa ang ALT Lab ng FST-based morphological analysers at community-facing language tools (gamit ang GiellaLT infrastructure), at malapit na nakikipagtulungan sa Cree-speaking communities — isang model para sa community-centred language technology development. Ang kanilang public-facing project na **[21st Century Tools for Indigenous Languages](https://21c.tools)** ay nagbibigay ng online dictionaries at morphological tools na binuo sa infrastructure na ito.

Ang **[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (National Research Council Canada), na pinamumunuan ni **Patrick Littell**, ay nagpapanatili ng aktibong programme na sumusuporta sa 25+ Indigenous languages sa buong Canada, kabilang ang maraming Cree dialects, Algonquin, Innu, at Michif. Naglathala ang NRC ILT ng MT research para sa English–Inuktitut (gamit ang Nunavut Hansard corpus) at bumubuo ng open-source tools kabilang ang **kiyânaw Transcribe** (Cree at Ojibwe transcription), morphological analysers, at **ReadAlong Studio** (audio-text alignment). Open-source ang lahat ng code at tahasang hindi inaangkin ng NRC ang copyright sa community linguistic data.

Ang **[Aya](https://cohere.com/research/aya)** (Cohere For AI) ay isang open-science multilingual LLM initiative na may 3,000+ contributors mula sa 119+ bansa. Bagama't hindi dedicated MT system, highly effective ang Aya models (Aya-101 na sumasaklaw sa 101 wika, Aya 23 na sumasaklaw sa 23 high-impact languages, Tiny Aya na sumasaklaw sa 70 wika sa 3.35B parameters) para sa translation tasks. Ang **Aya Collection** — 513M instruction-style training instances — ang pinakamalaking open multilingual instruction dataset. Karapat-dapat pag-aralan ang community governance model.

Ang **[GhanaNLP / Khaya](https://ghananlp.org)** ay isang community-driven NLP initiative na gumawa ng **Khaya** translation platform — isa sa iilang community-governed MT systems na aktuwal na deployed para sa pang-araw-araw na gamit. Nagbibigay ang Khaya ng neural machine translation, ASR, at TTS para sa ~12 Ghanaian languages (Twi, Ewe, Ga, Fante, Kusaal, at iba pa) sa pamamagitan ng web, mobile apps, at developer API. Ipinapakita ng kanilang approach — 40,000+ parallel sentence pairs na binuo sa pamamagitan ng linguist collaboration at community feedback — na maaaring maging operational ang community-governed MT, hindi lamang aspirational.

### Funding at Policy

Ang MT research para sa low-resource languages ay nakadepende sa funding streams na lubhang naiiba sa venture capital at advertising revenue na sumusuporta sa commercial MT:

- **Lacuna Fund**: Isang collaborative data fund na sinusuportahan ng Rockefeller Foundation, Google.org, Canada's IDRC, at Germany's GIZ. Partikular na pinopondohan ng Lacuna ang paglikha ng **labelled datasets** para sa underrepresented languages — pinupunan ang data gap na ugat ng MT quality gaps.

- **AI4D** (Artificial Intelligence for Development): Isang programme na sumusuporta sa AI research fellowships para sa African language technology, na pinapatakbo sa pamamagitan ng IDRC at Swedish International Development Cooperation Agency.

- **UNESCO International Decade of Indigenous Languages (2022–2032)**: Isang political framework na nagtaas ng profile ng Indigenous language technology sa buong mundo, bagama't modest pa rin ang concrete research funding.

- **Inter-American Development Bank**: Pinondohan ang **GuaranIA** project para sa Guaraní–Spanish MT sa Paraguay, isang halimbawa ng development finance na sumusuporta sa language technology.

- **National research councils**: Maraming low-resource MT work ang pinopondohan sa pamamagitan ng standard academic channels (NSF, NSERC, EU Horizon programmes), kadalasan bilang mga component ng mas malawak na AI o linguistics grants.

---

## Bahagi 8: Mga Bukas na Hangganan {#part-8-open-frontiers}

### Ano ang Nananatiling Hindi Nalulutas

Ang larangan ng MT noong 2026 ay sabay na mas capable at mas tapat tungkol sa mga limitasyon nito kaysa anumang naunang panahon. Ilang frontier problems ang tumutukoy sa kasalukuyang research landscape:

Nananatiling halos hindi nalulutas ang **Document-level translation**. Karamihan ng MT systems — kabilang ang maraming LLMs — ay nagsasalin pangungusap-sa-pangungusap, nawawala ang discourse coherence, pronoun resolution sa pagitan ng sentence boundaries, at stylistic consistency. Binabasa ng human translator ang buong dokumento bago magsalin; karamihan ng MT systems ay nagpoproseso ng mga pangungusap nang hiwalay. Aktibo ang research sa document-level MT ngunit hindi pa nakakagawa ng systems na mapagkakatiwalaang nagpapanatili ng coherence sa mahahabang text.

Patuloy na hinahamon ng **Discourse and pragmatics** — ang agwat sa pagitan ng literal meaning at communicative intent — ang MT. Ang irony, understatement, cultural allusions, at register sensitivity (formal vs. informal, respectful vs. casual) ay bahagyang nakukuha ng pinakamahuhusay na LLMs ngunit hindi consistent. Kailangang mag-navigate ng translator na nagtatrabaho sa pagitan ng Japanese at English ng elaboradong honorific system; hindi pantay ang paghawak dito ng kasalukuyang MT systems sa pinakamainam na kaso.

Ang **Multimodal translation** — pagsasalin sa konteksto ng images, video, o audio — ay umuusbong na research area. Ang menu item na inilarawan bilang "flying fish roe" ay ganap na may saysay kapag may kasamang image; kung wala ito, maaaring makagawa ang MT ng kakaiba. Sinimulan na itong tugunan ng Seamless suite at multimodal LLMs (Gemini, GPT-4o), ngunit nananatiling frontier ang robust multimodal MT.

Papalapit sa production readiness ang **Real-time speech-to-speech translation** na may natural latency (sub-3-second delay), speaker identity preservation, at emotional tone transfer para sa high-resource pairs. Nagpakita ang Google, Meta, at ilang startups ng prototype systems noong 2025. Para sa low-resource languages, malayo pa rin ang real-time speech translation.

Ang **"last mile" para sa low-resource languages** marahil ang pinakamahalagang hindi nalulutas na problema ng larangan. Napakalaki ng agwat sa pagitan ng FLORES-200 benchmark score at aktuwal na utility para sa language community. Ang model na nakakakuha ng 15 BLEU sa Plains Cree–English translation ay hindi kapaki-pakinabang para sa anumang praktikal na layunin. Ang pagsasara ng gap na ito ay nangangailangan hindi lamang ng mas mahusay na models kundi mas mahusay na data, mas mahusay na evaluation, mas mahusay na tokenisation, at — mahalaga — tunay na collaboration sa language communities sa halip na extraction ng linguistic resources para sa academic publications.

Nagiging dominant paradigm para sa professional translation ang **Post-editing and human-AI collaboration**. Sa halip na palitan ang human translators, lalong ipinupuwesto ang MT bilang first-draft generator na saka nirerefine ng human translators. Aktibong research areas na may direktang commercial implications ang pag-unawa sa cognitive science ng post-editing, pagsukat ng post-editing effort, at pagdisenyo ng interfaces na sumusuporta sa human-AI collaboration.

### Ang Political Dimensions

Hindi politically neutral ang MT. Ang pagpili kung aling mga wika ang susuportahan, aling data ang kokolektahin, sino ang kumokontrol sa models, at kaninong quality standards ang gagamitin ay pawang mga desisyong may malalaking kahihinatnan para sa language communities.

Ini-encode ng dominasyon ng English bilang pivot language ang partikular na pananaw sa translation bilang bagay na dumadaloy sa pamamagitan ng English. Ang paggamit ng Bible at missionary texts bilang training data para sa Indigenous languages ay nagbubukas ng mga tanong tungkol sa consent at cultural appropriateness. Ang konsentrasyon ng MT capability sa iilang Silicon Valley companies ay lumilikha ng dependency relationships na tahasang tinututulan ng ilang language communities.

Ang **Data sovereignty** (soberanya sa datos) ay isang pangunahing alalahanin. Sa Canada, ang **mga prinsipyo ng data sovereignty ng First Nations** ay nagpapahayag na ang mga Katutubong komunidad ang nagmamay-ari ng kanilang data, kumokontrol kung paano ito kinokolekta at ginagamit, may access dito, at pisikal na nagmamay-ari nito. Para sa MT, nangangahulugan po ito na ang training data na nagmula sa mga teksto ng Katutubong wika, mga evaluation corpora na binuo mula sa kaalaman ng komunidad, at mga translation model na sinanay sa mga mapagkukunang hawak ng komunidad ay lahat napapailalim sa pamamahala ng komunidad — hindi sa pamamahala ng anumang institusyon ng pananaliksik o tech company na bumuo ng model.

Mayroon po itong direktang teknikal na implikasyon. Ang isang MT system na binuo gamit ang data ng komunidad ay hindi maaaring basta-basta maging open-source sa nakasanayang paraan kung hindi pumayag ang komunidad dito. Ang mga evaluation benchmark ay hindi maaaring ilathala kung ang test data ay naglalaman ng mga materyal na sensitibo sa kultura. Ang isang "community-owned model" ay hindi isang kontradiksyon — ito po ay isang kinakailangan sa disenyo (design requirement). Anumang seryosong pagsisikap sa low-resource MT para sa mga Katutubong wika ay dapat na sovereignty-aspirant bilang default — idinisenyo para sa pagmamay-ari at kontrol ng komunidad sa data ng wika, at hindi bilang isang nahuling pag-iisip (afterthought).

Hindi lamang ethical footnotes ang mga ito — hinuhubog nila ang research priorities, funding decisions, at technical architectures. Hindi maihihiwalay ang "building better MT" sa mga tanong kung sino ang nakikinabang, sino ang nagpapasya, at kaninong linguistic knowledge ang pinahahalagahan.

---

## Apendise A: Mahahalagang Papel {#appendix-a-key-papers}

Isang chronological reading list ng mga papel na tumukoy sa trajectory ng larangan. May kasamang maikling tala ang bawat entry kung bakit ito mahalaga.

| Taon | Papel | Mga May-akda | Kahalagahan |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Itinatag ang dominant MT evaluation metric sa loob ng dalawang dekada |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Ipinakita ang neural encoder-decoder translation |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Ipinakilala ang attention mechanism |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Dinala ang neural MT sa production scale |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Ipinakilala ang BPE tokenisation para sa MT |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Ipinakilala ang backtranslation para sa data augmentation |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Ipinakilala ang Transformer architecture |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: cross-lingual representations para sa 100 wika |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: many-to-many nang walang English pivoting |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Neural evaluation metric na may mataas na human correlation |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | NLLB Team (Meta) | 200-language MT model + FLORES-200 benchmark |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | LLM fine-tuning para sa SOTA translation gamit ang maliit na data |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Buong translation pipeline sa iisang LLM |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Fine-grained error detection sa MT evaluation |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | MT evaluation na inangkop para sa African languages |

---

## Apendise B: Mga Kumperensiya at Komunidad {#appendix-b-conferences-and-communities}

### Mga Pangunahing Kumperensiya

Ang ecosystem ng NLP/MT conference ay sumusunod sa isang taunang ritmo. Inililista po ng talahanayan sa ibaba ang mga pangunahing venue, na sinusundan ng mga petsa ng mga kamakailang edisyon.

| Kumperensiya | Buong Pangalan | Dalas | Mga Tala |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Taunan | Pangunahing competitive venue ng larangan; shared tasks ang tumutukoy sa benchmarks |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Taunan | Ang flagship NLP conference |
| **EMNLP** | Empirical Methods in NLP | Taunan | Second-tier flagship; karaniwang nagho-host ng WMT |
| **NAACL** | North American Chapter of the ACL | Taunan (umiikot kasama ng ACL) | Pangunahing regional conference |
| **EACL** | European Chapter of the ACL | Biennial | European regional conference |
| **COLING** | Intl. Conf. on Computational Linguistics | Biennial | Pinagsama sa LREC para sa 2024; hiwalay na muli ngayon |
| **LREC** | Language Resources & Evaluation Conference | Biennial | Nakatuon sa data, resources, at evaluation |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Taunan | Nakatuon sa speech translation |

#### Mga Kamakailang Edisyon

*Mga petsa lamang — sinadya po ito. Ang isang column ng "status" na nagsasabing **Upcoming** (Paparating) ay mali na sa
araw na magsimula ang kaganapan, at hindi maaaring malaman ng pahinang ito ang petsa ngayon. Ihambing po ninyo mismo ang mga petsa
sa ibaba laban sa kalendaryo; ang mga proceedings para sa anumang kaganapan na naisagawa na ay
nasa [ACL Anthology](https://aclanthology.org).*

| Kaganapan | Mga Petsa | Lokasyon |
|---|---|---|
| **COLING 2025** | Ene 19–24, 2025 | Abu Dhabi, UAE |
| **EACL 2026** | Mar 24–29, 2026 | Rabat, Morocco |
| **LREC 2026** | May 11–16, 2026 | Palma de Mallorca, Spain |
| **ACL 2026** | Hul 2–7, 2026 | San Diego, USA |
| **AmericasNLP 2026** | Hul 3–4, 2026 (co-located sa ACL) | San Diego, USA |

*Naganap lahat noong 2025 ang ACL 2025 (Vienna), EMNLP 2025 (Suzhou), WMT 2025 (Suzhou), IWSLT 2025 (Vienna), at PACLIC 39 (Hanoi). Available ang kanilang proceedings sa [ACL Anthology](https://aclanthology.org).*

#### WMT 2025 Shared Tasks

Ang WMT shared tasks ang pinakamalapit na katumbas ng public competition sa larangan ng MT. Kabilang sa 2025 edition ang:

- **General Machine Translation** — ang flagship task
- **Automated Translation Evaluation Systems** — unified metrics at quality estimation
- **Low-Resource Indic Language Translation**
- **Creole Language Translation**
- **Terminology Shared Task**
- **Model Compression** — paggawa ng mas maliliit at mas mabilis na MT models
- **Open Language Data** — pagpapahusay ng open training data
- **Multilingual Instruction Shared Task (MIST)**
- **Limited Resources Slavic LLMs**

### Specialised Workshops

| Workshop | Pokus | Pinakabagong Kilalang Edisyon | Co-located Sa |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Mga Katutubong wika ng Americas | Hul 3–4, 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP ng wikang Aprikano | Hul 31, 2025 (ACL 2025, Vienna) | ACL / ICLR |
| **LoResMT** | Low-resource MT | Karaniwang taunan sa mga *ACL conference | Iba-iba |
| **SIGTYP** | ACL SIG sa Linguistic Typology | Taunang workshop | ACL |

### Mahahalagang Community Resources

- **[machinetranslate.org](https://machinetranslate.org)** — Community-driven, open-source knowledge base tungkol sa MT technology. Pinapatakbo ng Machine Translate Foundation (non-profit, Zug, Switzerland, itinatag noong 2021). Sumasaklaw sa approaches, APIs, models, language support, at industry news. Licensed CC BY-SA 4.0. Napakahusay na starting point para sa anumang topic sa briefing na ito.

- **[ACL Anthology](https://aclanthology.org)** — Ang definitive open-access archive ng NLP/CL research papers. Malayang available dito ang bawat papel sa ACL, EMNLP, NAACL, EACL, WMT, at kaugnay na venues.

---

## Apendise C: Mga Tool, Dataset, at Praktikal na Resource {#appendix-c-tools-datasets-and-practical-resources}

Saklaw ng apendiseng ito ang konkretong tools at data sources na mahalaga sa MT work ngayon. Isinulat ito para sa mga taong sanay gumamit ng terminal ngunit maaaring hindi pamilyar sa MT ecosystem.

### Training Frameworks

Ito ang software packages na ginagamit upang *sanayin* ang neural MT models mula sa simula (o i-fine-tune ang umiiral na models). Gagamitin ninyo ang mga ito kung bumubuo kayo ng sarili ninyong translation model sa halip na gumamit ng umiiral na model sa pamamagitan ng API.

| Framework | Developer | Wika | Mga Tala |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Edinburgh | C++ | Ang pinakamabilis na open-source NMT trainer — kayang magsanay ng model nang 3–5× mas mabilis kaysa PyTorch-based alternatives. Isinulat sa pure C++ na may minimal dependencies. Pinapagana ang Microsoft Translator. Sinanay dito ang bawat OpusMT model (tingnan sa ibaba). Ipinangalan kay Marian Rejewski, ang Polish mathematician na tumulong mag-crack ng Enigma. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | Workhorse research toolkit ng Meta — ginamit upang buuin ang M2M-100, NLLB-200, at karamihan ng published MT work ng Meta. Highly modular: maaari ninyong palitan ang architectures, loss functions, at data processing. Ang standard choice para sa researchers na nagre-reproduce o nagpapalawak ng gawa ng Meta. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | Ang pinaka-accessible na entry point para sa training ng custom MT models. Nagsimula bilang Harvard research project, ngayon ay pinananatili ng SYSTRAN (isang commercial MT company). Kabilang ang CTranslate2 para sa deployment (tingnan sa ibaba). Maganda ang documentation para sa beginners. |

**Kailan ninyo gagamitin ang mga ito?** Kung mayroon kayong parallel data (kahit ilang libong sentence pairs) at nais ninyong magsanay o mag-fine-tune ng dedicated translation model para sa specific language pair. HINDI ninyo gagamitin ang mga ito para sa LLM-based translation (prompting GPT/Claude/Gemini), na hindi nangangailangan ng training — API calls lamang.

### Inference at Deployment

Pinapatakbo ng mga tool na ito ang *already-trained* models upang gumawa ng translations. Isipin ang training frameworks sa itaas bilang "workshop kung saan binuo ang kotse" at ang mga ito bilang "ignition key na nagpapaandar sa kotse."

| Tool | Ano ang Ginagawa Nito | Kailan Ito Gagamitin |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Isang C++ engine na nagpapatakbo ng Transformer models sa mataas na bilis na may mababang memory. Sumusuporta sa INT8/INT4 quantisation (pagpapaliit ng models sa 1/4 ng laki nito na may minimal quality loss). Tumatakbo sa CPU o GPU nang hindi kailangang naka-install ang PyTorch. Sumusuporta sa NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Kapag nais ninyong mag-self-host ng translation model sa server o laptop nang walang GPU cluster. Ang go-to para sa production deployment ng open-source MT models. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Python library na naglo-load at nagpapatakbo ng models gamit ang ilang linya ng code: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Nagbibigay ng ~1,500 pre-trained OpusMT bilingual models pati NLLB-200, mBART, mT5, at M2M-100. | Kapag nais ninyo ang pinakamabilis na landas mula "may gusto akong isalin" tungo sa gumaganang code. Dalawang linya ng Python at nagsasalin na kayo. Mas mababa ang throughput kaysa CTranslate2 ngunit mas madaling i-set up. |

### Pre-Trained Model Families

Ito ang mga *already-trained* translation models na maaari ninyong i-download at gamitin agad. Walang training na kailangan — load at translate lamang.

| Model Family | Mga Wika | Developer | Ano Ito | Saan Makikita |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1,000+ pairs | University of Helsinki (Jörg Tiedemann) | Ang pinakamalaking koleksiyon ng open-source bilingual translation models. Bawat model ay humahawak ng isang language pair (hal., `opus-mt-en-fr` para sa English→French). Sinanay sa OPUS data gamit ang Marian NMT, converted sa PyTorch format para sa Hugging Face. Iba-iba ang kalidad — mahusay para sa well-resourced pairs, marginal para sa low-resource. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 wika | Meta | Isang multilingual model na nagsasalin sa pagitan ng alinman sa 200 wika. Available sa 600M, 1.3B, at 3.3B parameter variants. Tumatakbo sa laptop ang 600M version; kailangan ng disenteng GPU ang 3.3B version. Napakalaki ng pagkakaiba sa kalidad — malakas para sa mid-resource, kadalasang mahina para sa truly low-resource. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 wika | Meta | Ang predecessor ng NLLB-200 — unang model na direktang nagsasalin sa pagitan ng non-English pairs (hal., Bengali↔Swahili) nang hindi dumaraan sa English. Mahalaga sa kasaysayan; malaking bahagi ay napalitan na ng NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 wika | Unbabel | Hindi lamang translator — hinahawakan ang buong translation pipeline (correction, NER, post-editing, quality estimation) sa iisang LLM. Fine-tuned mula sa LLaMA. Noong 2025, dinaig ng Tower v2 (70B) ang GPT-4o at DeepL sa ilang benchmarks. | Hugging Face |
| **ALMA / X-ALMA** | 50 wika | Johns Hopkins University | LLaMA-based models na fine-tuned partikular para sa translation gamit ang preference optimisation (pagtuturo sa model kung aling translations ang mas pinipili ng tao). Pumapantay ang 7B at 13B versions sa kalidad ng GPT-4 sa high-resource pairs. Pinalalawak ng X-ALMA sa 50 wika gamit ang language-specific adapter modules. | Hugging Face |

### Parallel Data Sources

Parallel data ang fuel para sa training ng MT models: mga koleksiyon ng pangungusap sa dalawang wika na salin ng isa't isa, aligned line by line. Kung walang parallel data, hindi kayo makapagsanay ng conventional MT model. (Nilalampasan ito ng LLM-based translation — maaari ninyong i-prompt ang GPT na magsalin nang walang parallel data — ngunit kailangan pa rin ito ng dedicated models.)

| Dataset | Scale | Ano Ito | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ sentence pairs, 1,000+ wika | Ang single most important resource para sa MT data. Isang meta-collection na nag-a-aggregate ng dose-dosenang sub-corpora (tingnan sa ibaba) sa isang searchable portal. Nilikha at pinananatili ni Jörg Tiedemann sa University of Helsinki. Kung naghahanap kayo ng parallel data sa anumang wika, OPUS ang simula. Accessible sa pamamagitan ng web portal, Python `opustools` package, at Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M words/language, 21 EU languages | European Parliament proceedings — mga talumpati ng politiko na isinalin sa lahat ng EU official languages. Nilikha ni Philipp Koehn. Historically foundational (ang dataset na nagbigay-daan sa SMT research), ngunit limitado sa EU languages at parliamentary register. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Bilyun-bilyong pairs, 29+ language pairs | EU-funded project na nagka-crawl ng web upang hanapin ang naturally occurring parallel text (bilingual websites, translated pages). Mas maingay kaysa curated corpora ngunit napakalaki. Inilabas ang **Bitextor** open-source crawling pipeline, na magagamit ng sinuman upang mag-mine ng sarili nilang parallel data mula sa web. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M URL pairs, 137 English-paired directions | Web-mined parallel documents mula sa Common Crawl (Meta/JHU). Partikular na kapaki-pakinabang para sa low-to-medium resource languages na wala sa curated corpora. Mas mababa ang kalidad kaysa Europarl ngunit mas malawak ang coverage. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M parallel sentences, 1,620 pairs | Parallel sentences na awtomatikong na-mine mula sa Wikipedia gamit ang LASER multilingual embeddings (Meta). Kapaki-pakinabang dahil umiiral ang Wikipedia sa maraming wika — ngunit automatic ang alignment (hindi human-verified), kaya maingay o mali ang ilang pairs. | GitHub (LASER repo) |
| **[Tatoeba](https://tatoeba.org)** | 500+ wika | Isang community-maintained collection ng example sentences at kanilang translations, na contributed ng volunteers sa buong mundo. Individual sentences, hindi documents. Ang kaugnay na **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** (Helsinki-NLP) ay nagbibigay ng clean train/test splits para sa libu-libong language pairs — ginamit upang sanayin ang OpusMT models. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 wika | Isang standardized evaluation benchmark (HINDI training data). Professionally translated sentences na ginagamit upang ihambing ang systems sa level playing field. Nilikha ng Meta kasabay ng NLLB-200. Kung nais ninyong ihambing ang inyong system sa published baselines, ito ang test set na gagamitin. | Hugging Face |

### Mahahalagang Sub-Corpora sa loob ng OPUS

Nag-a-aggregate ang OPUS ng maraming independent parallel corpora. Kapag naghahanap ng data sa specific language, karapat-dapat suriin ang mga sub-collection na ito:

- **OpenSubtitles** — Movie at TV subtitles. Napakalaki ng volume ngunit maingay — kadalasang simplified, informal ang subtitles, at maaaring may transcription errors.
- **JW300** — Jehovah's Witnesses publications, na sumasaklaw sa ~300 wika. Pinakamalawak ang language coverage sa anumang single corpus, ngunit heavily domain-skewed patungo sa religious content at ethically contested (tingnan ang Bahagi 4).
- **Bible** — Bible translations sa 700+ wika. Pinakamakipot ang domain sa lahat (ancient religious text), ngunit para sa maraming wika, ito lamang ang parallel text na umiiral.
- **Tanzil** — Quran translations. Kapaki-pakinabang para sa Arabic-paired data.
- **GNOME / KDE** — Software localisation strings ("File → Save", "Are you sure you want to delete?"). Kapaki-pakinabang para sa technical/UI domain ngunit napaka-formulaic.
- **EMEA** — European Medicines Agency documents. Kapaki-pakinabang para sa biomedical domain translation.

---

## Apendise D: Glossary {#appendix-d-glossary}

**Attention mechanism**: Isang neural network component na nagpapahintulot sa model na dynamic na mag-focus sa iba't ibang bahagi ng input kapag gumagawa ng bawat bahagi ng output. Ipinakilala nina Bahdanau et al. (2014) para sa MT; na-generalise sa Transformer (2017).

**Backtranslation**: Isang data augmentation technique kung saan isinasalin pabalik sa source language ng preliminary MT system ang monolingual target-language text, na lumilikha ng synthetic parallel data para sa training.

**BLEU**: Bilingual Evaluation Understudy. Isang automatic MT evaluation metric batay sa n-gram precision overlap sa reference translations.

**BPE (Byte Pair Encoding)**: Isang subword tokenisation algorithm na paulit-ulit na nagme-merge ng pinakamadalas na character pairs upang bumuo ng vocabulary. Ginagamit sa halos lahat ng modernong NMT at LLM systems.

**COMET**: Isang neural MT evaluation metric na gumagamit ng cross-lingual embeddings upang hulaan ang human quality judgments, na gumagana sa source + hypothesis + reference.

**Curse of multilinguality**: Ang phenomenon kung saan ang pagdaragdag ng mas maraming wika sa multilingual model ay nagpapalabnaw sa per-language quality dahil sa fixed model capacity.

**Encoder–decoder**: Isang neural architecture kung saan pinoproseso ng encoder ang input sequence tungo sa representations, at binubuo ng decoder ang output sequence mula sa mga representation na iyon.

**FLORES-200**: Isang standardized MT evaluation benchmark na sumasaklaw sa 200 wika, na nilikha ng Meta kasabay ng NLLB-200.

**FST (Finite-State Transducer)**: Isang computational device na nagma-map sa pagitan ng input at output symbol sequences gamit ang states at transitions. Ginagamit sa computational morphology upang i-analyse at bumuo ng word forms.

**Hallucination**: Sa MT, ang paggawa ng fluent output na walang kaugnayan o hindi tapat sa source text. Partikular na karaniwan sa low-resource settings.

**High-resource language**: Isang wikang may masaganang digital text at parallel translation data (karaniwang >10M sentence pairs with English). Mga halimbawa: French, German, Chinese, Spanish.

**LLM (Large Language Model)**: Isang neural language model na may bilyun-bilyong parameter, sinanay sa napakalawak na text corpora upang hulaan ang susunod na token. Mga halimbawa: GPT-4, Gemini, LLaMA, Claude.

**Low-resource language (LRL)**: Isang wikang may limitadong digital text at parallel data (<1M sentence pairs). Kabilang sa kategoryang ito ang napakalaking mayorya ng mga wika sa mundo.

**MQM (Multidimensional Quality Metrics)**: Isang human evaluation framework kung saan nag-a-annotate ang professional translators ng specific error spans sa translations, na classified ayon sa type at severity.

**NMT (Neural Machine Translation)**: MT na gumagamit ng neural networks, taliwas sa statistical (SMT) o rule-based (RBMT) approaches.

**Parallel data / parallel corpus**: Isang koleksiyon ng texts sa dalawang wika na salin ng isa't isa, aligned sa sentence level. Ang pangunahing training resource para sa MT.

**Polysynthetic language**: Isang wika kung saan ang mga salita ay binubuo ng maraming morphemes, kadalasang nag-e-encode ng impormasyong mangangailangan ng buong clause sa analytic languages tulad ng English. Mga halimbawa: Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Isang language-independent subword tokeniser at detokeniser na nagpapatupad ng BPE at unigram language model segmentation. Malawakang ginagamit sa multilingual NLP.

**Transformer**: Ang dominant neural architecture para sa NLP mula 2017, ganap na nakabatay sa self-attention mechanisms. Ipinakilala sa "Attention Is All You Need" (Vaswani et al., 2017).

**Zero-shot cross-lingual transfer**: Paglalapat ng model na sinanay sa isang wika (karaniwang English) sa ibang wika nang walang anumang target-language training data, umaasa sa shared multilingual representations.

---

*Pinagsama-sama ang briefing na ito noong Hunyo 2026. Mabilis gumalaw ang larangan ng MT; dapat beripikahin ang specific model capabilities at benchmark results laban sa kasalukuyang sources. Para sa pinakabagong developments, kumonsulta sa [machinetranslate.org](https://machinetranslate.org), sa [ACL Anthology](https://aclanthology.org), at sa proceedings ng pinakahuling WMT shared task.*



## Saan ito patungo sa site na ito

Ang puwang na inilalarawan ng briefing na ito — daan-daang wika na walang nasusukat na
pagsasalin kahit ano pa man — ay ang layuning isara ng natitirang bahagi ng site na ito. Ang
argumento kung paano ([Ano ang Champollion](/docs/what-is-champollion)), ang
ekonomiks ng pagbuo ng isang evaluation set sa halip na isang training corpus
([Sino ang Nakikinabang — mga mananaliksik](/docs/network/who-benefits#researchers)), at
ang estado ng kung ano ang aktwal na nasukat sa ngayon
([Mga Tapat na Limitasyon](/docs/network/honest-limitations)) ay ang tatlong
natural na susunod na babasahin.
