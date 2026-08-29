---
sidebar_position: 3
title: "Pagsukat sa Hindi Masusukat"
---

# Pagsukat sa Hindi Masukat: Ang Suliranin ng Ebalwasyon sa Machine Translation

**Isang survey kung paano sinusukat ng larangan ang kalidad ng pagsasalin, kung saan ito nabibigo, at kung ano ang iniaalok ng LYSS (Linguistically-informed Yield & Structural Scoring) bilang alternatibo**

---

> *"Ang mga automatic metric ay isang maginhawang kasinungalingan. Binibigyan tayo ng mga ito ng numero, at pinahihintulutan tayo ng numerong iyon na magsulat ng papel, at pinahihintulutan tayo ng papel na mag-angkin ng pag-unlad. Kung tunay ngang nagkaroon ng pag-unlad ay ibang tanong."*
> — Hinango mula sa paulit-ulit na sentimyento sa WMT Metrics Shared Tasks

---

## Panimula

May suliranin sa pagsukat ang machine translation.

Dalawang dekada nang gumagawa ang larangan ng lalo pang mas sopistikadong mga sistema — mula sa phrase tables hanggang sa attention mechanisms hanggang sa trillion-parameter language models — at sa buong panahong iyon, nakipagbuno ito sa isang tanong na tila simple ngunit mapanlinlang: *paano ninyo malalaman kung mahusay ang isang pagsasalin?*

Hindi akademiko lamang ang tanong na ito. Ang metric na pipiliin ninyo ang nagtatakda kung aling sistema ang "mananalo." Itinatakda nito kung ano ang mapopondohan, ano ang mailalathala, ano ang maide-deploy, at — para sa mga wikang pinakanangangailangan ng MT — kung huhusgahan bang bigo ang mga pagsasalin ng isang komunidad kahit, sa katunayan, tama ang mga iyon.

Ang kasaysayan ng ebalwasyon ng MT, sa maliit na anyo, ay kasaysayan ng mga pinahahalagahan ng larangan. Ipinapakita ng dominasyon ng BLEU sa halos dalawang dekada ang pagkiling sa mura, mabilis, at language-agnostic na pagsukat kaysa sa pagsusuring may batayang lingguwistiko. Ipinapakita ng pag-usbong ng mga neural metric tulad ng COMET ang lumalaking kasopistikaduhan ng larangan — at ang patuloy nitong pagdepende sa English-centric na training data. Ipinapakita ng halos ganap na kawalan ng morphology-aware na ebalwasyon ang isang larangang, hanggang kamakailan, itinayo ng at para sa mga nagsasalita ng analytic European languages.

Tinatalunton ng papel na ito ang ebolusyon ng ebalwasyon ng MT mula BLEU hanggang sa kasalukuyan, tinutukoy kung saan sistematikong nabibigo ang mga umiiral na paraan para sa mga wikang morphologically complex at low-resource, at sinusuri kung ano ang maaaring itsura ng isang alternatibong may batayang lingguwistiko. Katuwang ito ng iba pang context documents ng proyekto — [*Mula kay Pāṇini hanggang sa Transformers*](./history-of-language-and-computation.md) (na tumatalunton sa intelektuwal na kasaysayan ng wika at computation) at ang [*Field Briefing*](./mt-field-briefing.md) (na sumusurvey sa kasalukuyang MT landscape). Kung ang mga dokumentong iyon ay nagtatanong ng "paano tayo nakarating dito?" at "ano ang umiiral?", ito naman ay nagtatanong: "paano natin malalaman kung gumagana ang alinman dito?"

---

## Bahagi 1: Ang Panahon ng String-Matching (2002–2015)

### BLEU at ang Pagsilang ng Automatic Evaluation



Nagsisimula ang modernong panahon ng ebalwasyon ng MT sa iisang papel: "BLEU: a Method for Automatic Evaluation of Machine Translation" nina Kishore Papineni, Salim Roukos, Todd Ward, at Wei-Jing Zhu, na inilathala sa ACL 2002. Sinusukat ng BLEU (Bilingual Evaluation Understudy) kung gaano kalaki ang overlap ng mga word sequence (n-grams) ng machine translation sa isa o higit pang human reference translations. May kasama itong brevity penalty upang pigilan ang mga sistemang dayain ang score sa pamamagitan ng maiikling output, at kinukuwenta nito ang geometric mean ng n-gram precisions sa mga order 1 hanggang 4.

Naging salapi ng larangan ang BLEU sa simpleng dahilan: mabilis, mura, reproducible, at language-independent ito. Bago ang BLEU, nangangailangan ang ebalwasyon ng isang MT system ng mahal at mabagal na human assessment. Nag-alok ang BLEU ng numerong makukuwenta sa loob ng milliseconds, maihahambing sa iba't ibang papel, at magagamit upang i-rank ang mga sistema sa shared tasks. Sa loob ng ilang taon, halos mandatory na ito — ang papel na walang BLEU scores ay hindi mailathala.

Ngunit may malalalim at mahusay na naitalang kahinaan ang BLEU na dalawang dekada nang sinusubukang solusyunan ng larangan:

**Walang semantic understanding.** Purong surface matching ang BLEU. Ang "The cat sat on the mat" ay makakakuha ng zero laban sa reference na "the feline rested on the rug." Bawat salita ay tamang synonym; magkapareho ang kahulugan; zero ang score.

**Bulag sa morphology.** Para sa agglutinative at polysynthetic na mga wika, bigong-bigo ang mahigpit na word-level matching. Ang wastong conjugated na Cree verb na naiiba ng isang morpheme sa reference ay makakakuha ng zero — kahit ang pagkakaiba ay isang grammatically optional particle o isang pantay na valid na word order.

**Mahina ang sentence-level discrimination.** Dinisenyo ang BLEU bilang corpus-level metric. Sa sentence level, maingay at hindi maaasahan ito — ngunit regular itong ginagamit sa mga indibidwal na pangungusap.

**Single-reference bias.** Ipinapalagay ng BLEU na may *isang* tamang salin (o maliit na set ng references). Para sa mga wikang may malayang word order, mayamang synonym vocabularies, o sistematikong ambiguities (tulad ng inclusive/exclusive "we" sa Cree), maaaring may dose-dosenang pantay na tamang pagsasalin, at pinaparusahan ng BLEU ang lahat maliban sa nagkataong tumugma sa reference.

**Mahinang correlation sa human judgment.** Ipinakita ng mga meta-analysis — lalo na ni Reiter (2018, *Computational Linguistics*) — na madalas mahina ang correlation ng BLEU sa human quality assessments, partikular para sa high-quality systems at para sa mga wikang malayo sa English.

Alam na ang mga kahinaang ito halos mula pa sa simula. Ngunit nanatili ang BLEU dahil mas masama ang mga alternatibo — hindi sa accuracy, kundi sa convenience. Nag-optimize ang larangan para sa metric na kaya nitong kuwentahin, hindi para sa metric na kailangan nito.

### NIST (Doddington, 2002)

Ang NIST metric, na inilathala sa parehong taon ng BLEU ni George Doddington sa HLT 2002, ay nagbago sa BLEU formula sa dalawang paraan. Una, binigyan nito ng timbang ang n-grams ayon sa kanilang **information content** — mas mataas ang timbang ng bihirang n-grams kaysa karaniwan, batay sa intuwisyon na mas informative ang wastong pagsasalin ng hindi pangkaraniwang parirala kaysa wastong pagsasalin ng "of the." Ikalawa, gumamit ito ng **arithmetic mean** sa halip na geometric mean ng BLEU, na nagbunga ng mas stable na scores na hindi bumabagsak sa zero kapag walang matches ang alinmang solong n-gram order. Malawakang ginamit ang NIST sa DARPA TIDES at NIST OpenMT evaluation programmes ngunit hindi nito nakamit ang dominasyon ng BLEU sa mas malawak na research community. Sa kabila ng mga pagpapabuti nito, kabahagi nito ang pangunahing limitasyon ng BLEU: surface-level string matching na walang konsepto ng kahulugan.

### METEOR (Banerjee & Lavie, 2005)

Ang METEOR (Metric for Evaluation of Translation with Explicit ORdering) ay maagang pagtatangkang tugunan ang rigidity ng BLEU. Kung exact word matching ang ginagawa ng BLEU, nagpakilala ang METEOR ng tatlong inobasyon:

1. **Stemming**: Ibinababa ang mga salita sa kanilang stems bago ihambing, na nagbibigay ng partial credit para sa morphological variants (hal., tumutugma ang "running" sa "ran" pagkatapos ng stemming).
2. **Synonym matching**: Gamit ang WordNet, kinikilala ng METEOR na iisang konsepto ang "car" at "automobile."
3. **Word alignment**: Sa halip na magbilang ng n-gram overlaps, tahasang ina-align ng METEOR ang mga salita sa pagitan ng hypothesis at reference, pagkatapos ay kinukuwenta ang precision at recall na may fragmentation penalty.

Palaging nagpakita ang METEOR ng mas mataas na correlation sa human judgments kaysa BLEU. Ngunit nangangailangan ito ng language-specific resources (stemmers, synonym databases) na naglimita sa applicability nito, at mas mabagal itong kuwentahin. Para sa English, mas mahusay ito. Para sa low-resource languages, wala lang ang stemmers at synonym databases.

### TER (Snover et al., 2006)

Sinusukat ng Translation Edit Rate ang minimum na bilang ng edits (insertions, deletions, substitutions, at *phrase shifts*) na kailangan upang gawing reference ang hypothesis, na normalised ayon sa reference length. Ang phrase-shift operation — paglilipat ng contiguous sequence ng mga salita sa ibang posisyon — ay direktang pagkilala na hindi nakapirmi ang word order sa iba't ibang wika. Intuitive ang edit-distance approach ng TER (sinusukat nito ang "gaano karaming trabaho ang kailangang gawin ng isang human post-editor?") ngunit minamana nito ang parehong pangunahing limitasyon: naghahambing ito laban sa iisang reference at walang konsepto ng kahulugan.

### chrF at chrF++ (Popović, 2015; 2017)

Ang pinakamahalagang metric innovation sa pagitan ng BLEU at ng neural era ay nagmula kay Maja Popović. Sinusukat ng **chrF** (character F-score) ang overlap sa *character* level sa halip na word level, kinukuwenta ang character n-gram precision at recall. Idinadagdag muli ng **chrF++** ang word-level unigrams at bigrams sa halo.

Kung bakit mahalaga ito para sa morphologically rich languages: nagbibigay ang character-level matching ng *partial credit* para sa magkakaparehong morphemes. Ang mga salitang Cree na *nikî-nipâw* ("I slept") at *kikî-nipâw* ("you slept") ay nagbabahagi ng karamihan sa kanilang character n-grams kahit magkaibang salita ang mga ito. Magbibigay ang chrF ng malaking partial credit; zero ang ibibigay ng BLEU.

Naging standard secondary metric ang chrF++ sa WMT shared tasks, na implemented sa **sacreBLEU** (Post, 2018), at malawakang kinikilala bilang mas mahusay kaysa BLEU para sa morphologically rich languages. Ngunit nananatili itong string-matching metric — mas mahusay kaysa BLEU, ngunit pundamental na limitado ng parehong palagay na masusukat ang kalidad ng pagsasalin sa pamamagitan ng surface-form overlap.

---

## Bahagi 2: Ang Neural Metric Revolution (2018–Kasalukuyan)



### Ang Insight: Matutong Mag-score

May iisang pangunahing design choice ang string-matching metrics ng Bahagi 1: hand-crafted formulas ang mga ito. May nagpasya na ang n-gram precision, character overlap, o edit distance ay magandang proxy para sa translation quality, at pagkatapos ginamit ng lahat ang formula na iyon sa loob ng isang dekada.

Nagsimula ang neural metric revolution sa ibang tanong: *paano kung magsanay tayo ng model upang hulaan ang translation quality, sa parehong paraan na nagsasanay tayo ng models upang magsalin?*

### BERTScore (Zhang et al., 2020)

Ang BERTScore, na inilathala sa ICLR 2020 ni Tianyi Zhang at mga kasamahan sa Cornell at MIT, ang unang malawakang adopted na metric na naglipat ng ebalwasyon mula sa exact string matching tungo sa semantic similarity. Elegante ang mekanismo: i-encode ang hypothesis at reference sa pamamagitan ng pre-trained Transformer model (BERT, RoBERTa, o DeBERTa), kuwentahin ang cosine similarity sa pagitan ng bawat pares ng token embeddings, at pagkatapos gumamit ng greedy matching upang kuwentahin ang precision (pinakamahusay na match ng bawat hypothesis token sa reference), recall (pinakamahusay na match ng bawat reference token sa hypothesis), at F1.

Natural na hinahawakan ng BERTScore ang synonyms, paraphrases, at word-order variations — nakakakuha ng mataas na similarity ang "the feline rested on the rug" sa "the cat sat on the mat" dahil kinukuha ng contextual embeddings ang semantic equivalence. Gamit ang multilingual BERT, umaabot ito sa alinmang wikang sakop ng model.

Ngunit hindi *trained* ang BERTScore sa human quality judgments. Ginagamit nito ang pre-trained embeddings as-is, ibig sabihin kinukuha nito ang general semantic similarity sa halip na partikular na matutunan kung ano ang gumagawa sa isang *translation* na mahusay. Mahalaga ang pagkakaibang ito: maaaring semantically similar ang isang pangungusap sa reference habang masama pa rin itong salin (maling register, inalis na negation, hallucinated qualifier). Minamana rin ng BERTScore ang anumang language biases sa underlying model — para sa mga wikang underrepresented sa training data ng BERT, maaaring hindi makuha ng embeddings ang mahahalagang distinction.

### BLEURT (Sellam et al., 2020)

Ang BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), na inilathala sa ACL 2020 nina Thibault Sellam, Dipanjan Das, at Ankur Parikh sa Google, ay nagpakilala ng mahalagang inobasyon: **pre-training on synthetic perturbations** bago mag-fine-tune sa human judgments. Ang insight ay ang direktang fine-tuning ng language model sa maliliit na WMT human judgment datasets ay nagbubunga ng metric na brittle — nag-o-overfit ito sa partikular na patterns sa training data at nabibigo sa out-of-distribution inputs.

Solusyon ng BLEURT ang two-phase training recipe. Sa phase one, milyun-milyong synthetic sentence pairs ang nilikha sa pamamagitan ng random word drops, insertions, substitutions, at backtranslation. Sinanay ang model na hulaan ang umiiral na automatic metric scores (BLEU, ROUGE, BERTScore, entailment) para sa mga pares na ito — natututo ng pangkalahatang notions ng textual similarity. Sa phase two, ang pre-trained model ay fine-tuned sa WMT Direct Assessment ratings. Malaki ang naitulong ng "warming up" na ito sa robustness.

Pinalawak ng BLEURT-20 ang approach sa multilingual evaluation gamit ang RemBERT encoder ng Google. Ngunit nananatiling reference-only ang BLEURT — hindi nito ginagamit ang source text, ibig sabihin hindi nito matutukoy ang hallucinations na nagkataong fluent, at lubos itong nakadepende sa kalidad ng reference.

### COMET (Rei et al., 2020)

Kinakatawan ng COMET (Crosslingual Optimized Metric for Evaluation of Translation) ang kasalukuyang state of the art sa automatic MT evaluation. Binuo ni Ricardo Rei at mga kasamahan sa **Unbabel**, gumagamit ang COMET ng cross-lingual encoder (XLM-RoBERTa) upang i-embed ang tatlong input — ang source sentence, ang MT hypothesis, at ang reference translation — at humuhula ng quality score na trained sa human Direct Assessment judgments.

Nanalo o nanguna ang COMET sa WMT Metrics Shared Tasks mula 2020 pasulong. Mas mataas nang malaki ang correlation nito sa human judgment kaysa alinmang string-matching metric. Kinikilala nito ang paraphrases, nakukuha ang meaning preservation, at hinahawakan ang synonym variation na ganap na namimiss ng BLEU.

Ngunit may kritikal na limitasyon ang COMET para sa ating layunin: trained ito sa human judgments mula WMT, na labis na nakatuon sa European languages. Ang cross-lingual encoder nito (XLM-R) ay trained sa CommonCrawl data kung saan halos wala ang Plains Cree, North Sámi, at karamihan ng indigenous languages. Para sa mga wikang ito, hindi maaasahan ang internal representations ng COMET — maaari itong maglabas ng scores, ngunit hindi nakabatay ang scores na iyon sa tunay na pag-unawa sa estruktura ng wika.

### xCOMET (Guerreiro et al., 2024)

Ang xCOMET, na inilathala sa TACL 2024 nina Nuno Guerreiro, Ricardo Rei, at mga kasamahan sa Unbabel at Instituto Superior Técnico, ay nagpalawak sa COMET mula black-box scorer tungo sa **diagnostic tool**. Ang pangunahing inobasyon ay multi-task learning: kasabay ng sentence-level quality score, nagsasagawa ang xCOMET ng **subword-level sequence tagging** upang tukuyin ang partikular na error spans sa pagsasalin at i-classify ang mga ito bilang minor, major, o critical.

Tinutulay nito ang puwang sa pagitan ng automatic scoring at MQM-style human error analysis. Sa halip na iulat lamang na "ang pagsasaling ito ay may score na 0.73," maituturo ng xCOMET ang partikular na salitang mali at maipahihiwatig kung gaano kalala. Gumagamit ang training ng curriculum learning approach: unang mag-train sa Direct Assessment data para sa sentence-level regression, pagkatapos magdagdag ng MQM-annotated data na may error span labels para sa joint training.

Nakamit ng xCOMET ang state-of-the-art performance sa sentence-level, system-level, at span-level evaluation nang sabay-sabay. Gumagana ito sa parehong reference-based at reference-free modes. Ngunit nangangailangan ito ng MQM-annotated training data — na mahal gawin at umiiral nang labis para sa European language pairs.

### AfriCOMET (Wang & Adelani, NAACL 2024)

Ang AfriCOMET, na inilathala sa NAACL 2024 nina Jiayi Wang, David Ifeoluwa Adelani, at mga kasamahan sa Masakhane community, ang pinakamahalagang patunay na ang neural metrics ay *kailangang* i-adapt para sa underserved languages — hindi sila nagge-generalize out of the box.

Unang ipinakita ng papel ang problema: ang standard COMET, na trained sa WMT data mula sa European languages, ay nagpakita ng makabuluhang mas mahinang correlation sa human judgments nang ilapat sa 13 African languages (kabilang ang Amharic, Hausa, Igbo, Swahili, Yoruba, at Zulu). Nangailangan ang ayos ng dalawang pagbabago. Una, pagpapalit sa XLM-R ng **AfroXLM-R**, isang cross-lingual encoder na partikular na trained upang mas mahusay na kumatawan sa African languages. Ikalawa, paglikha ng **AfriMTE**, isang bagong human evaluation dataset na may pinasimpleng MQM guidelines na dinisenyo para sa non-expert annotators — dahil mahirap makahanap ng bilingual professional translators para sa mga wikang ito.

Pinatunayan ng AfriCOMET ang konsepto: ang isang language-family-specific neural metric ay maaaring higit na lumampas sa generic version. Ngunit pinatunayan din nito ang gastos: kailangang may bumuo ng AfroXLM-R, mangolekta ng human judgment data para sa 13 wika, at magsanay ng bagong model. Para sa Plains Cree, walang katumbas na encoder, human judgment dataset, o adapted metric. Mangangailangan ang landas ng AfriCOMET ng paggawa ng lahat ng ito mula sa simula — isang multi-year effort na kinasasangkutan ng community-based human evaluation at marahil isang dedicated Algonquian-family encoder.

### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)

Ang GEMBA (GPT Estimation Metric Based Assessment), na inilathala sa EAMT 2023 nina Tom Kocmi at Christian Federmann sa Microsoft, ay nagtanong ng radikal na tanong: paano kung *tanungin* ninyo lang ang GPT-4 kung mahusay ang isang pagsasalin?

Nakakagulat sa pagiging simple ang approach. Ipinaprompt ng **GEMBA-DA** ang LLM gamit ang source at hypothesis at humihingi ng quality rating sa 0–100 scale. Nagbibigay ang **GEMBA-MQM** ng tatlong annotated examples at hinihiling sa LLM na tukuyin ang partikular na error spans, i-classify ang mga ito ayon sa uri at severity, at gumawa ng MQM-style score. Walang metric-specific training na kailangan.

Kapansin-pansin ang mga resulta: sa system level, nakamit ng GEMBA ang competitive o state-of-the-art correlation sa human judgments. Ang error annotations ng GEMBA-MQM, bagaman hindi kasing maaasahan ng human annotators, ay nagbigay ng interpretable diagnostic information nang walang anumang specialized training.

Ngunit nagbubukas ang GEMBA ng seryosong alalahanin. Nakadepende ito sa proprietary closed-source models na nagbabago ang behaviour sa pagitan ng API versions. Hindi reproducible ang mga resulta sa mahigpit na kahulugan. Mahal ito sa scale (API costs para sa ebalwasyon ng buong WMT test set). At — kritikal para sa ating layunin — hindi tiyak ang kaalaman ng LLM sa low-resource languages. Maaaring nauunawaan o hindi ng GPT-4 ang morphology ng Plains Cree nang sapat upang mag-evaluate ng translations; walang paraan upang malaman nang walang testing, at walang garantiya na magiging consistent ang behaviour sa iba't ibang model updates. Mismong sina Kocmi at Federmann ang nagpayong huwag gamitin ang GEMBA upang mag-angkin ng improvements sa academic papers dahil sa black-box nature ng ebalwasyon.

### MetricX at ang WMT 2024 Metrics Shared Task

Ang **MetricX-24**, na binuo nina Juraj Juraska, Daniel Deutsch, Mara Finkelstein, at Markus Freitag sa Google, ay nanalo sa WMT 2024 Metrics Shared Task. Built on **mT5** (Multilingual T5, isang encoder-decoder model sa halip na encoder-only XLM-R na ginagamit ng COMET), ibang architectural path ang tinatahak ng MetricX. Gumagamit ito ng two-stage fine-tuning — una sa Direct Assessment data, pagkatapos sa MQM scores — na may malawakang **synthetic data augmentation** na naka-target sa kilalang metric failure modes (undertranslation, fluent-but-wrong translations, hallucinations).

Ang WMT 2024 findings paper, na pinamagatang **"Are LLMs Breaking MT Metrics?"**, ay nagtanong kung nasira na ba ng LLM-generated translations ang metric ecosystem. Qualified no ang sagot: nanatiling epektibo ang fine-tuned neural metrics (MetricX-24, COMET variants), bagaman nagpakita ng nakakagulat na lakas ang LLM-based metrics (GEMBA variants) sa system level. Mga pangunahing findings:

- Ang **source-aware metrics** (gumagamit ng source + reference + hypothesis) ay consistent na mas mahusay kaysa reference-only metrics
- Ang **hybrid models** na gumagana sa parehong reference-based at reference-free modes mula sa iisang architecture ang umuusbong na direksyon
- Nananatili ang **low-resource gap**: mas mahina ang performance ng lahat ng metrics sa underrepresented languages, at hindi lumiliit ang gap
- Ang **MQM-trained metrics** (gumagamit ng fine-grained error annotations) ay consistent na mas mahusay kaysa DA-trained metrics (gumagamit ng scalar scores)

Malinaw ang implikasyon para sa low-resource evaluation: nagko-converge ang larangan sa malalaki, trained, source-aware neural metrics bilang gold standard. Nangangailangan ang mga metric na ito ng malaking training data, compute, at — kritikal — human evaluation data sa target language. Para sa mga wikang walang alinman sa mga resource na ito, hindi lang naaangkop ang state-of-the-art metric pipeline.

### Ang Bias Problem: Neural Metrics at Low-Resource Languages

Ang neural metric revolution ay, higit sa lahat, high-resource phenomenon. Bawat trained metric sa mga naunang seksyon ay trained sa WMT human judgment data, na sumasaklaw sa humigit-kumulang 20 language pairs — lahat ay kinasasangkutan ng European languages, Chinese, o Japanese. Ang underlying encoders (XLM-R, mT5, InfoXLM) ay trained sa CommonCrawl data kung saan proporsyonal sa web presence ang representasyon: nangingibabaw ang English, mahusay ang coverage ng European languages, at halos wala ang napakalaking mayorya ng 7,000+ wika sa mundo.

Para sa wikang tulad ng Plains Cree, lumilikha ito ng cascading failure:

1. **Walang training data**: Walang WMT human judgments para sa Cree translations, kaya walang metric na trained upang mag-evaluate ng mga ito.
2. **Walang encoder coverage**: Itinayo ang vocabulary ng XLM-R sa CommonCrawl, kung saan napakabihira ng Cree text. Sobra-sobrang hinahati ng tokeniser ang Cree words sa arbitrary byte fragments, at mahina ang training ng contextual embeddings para sa mga fragment na iyon.
3. **Walang validation**: Walang nakapagsukat kung gumagawa ba ang COMET, BLEURT, o MetricX ng makabuluhang scores para sa Cree. Maaari silang gumawa ng *numbers*, ngunit walang ebidensiya na nagko-correlate ang mga numerong iyon sa aktuwal na translation quality.
4. **Walang landas tungo sa pagpapabuti**: Ang approach ng AfriCOMET — bumuo ng language-family-specific encoder, mangolekta ng human evaluation data, magsanay ng bagong metric — ay multi-year, multi-institution effort. Para sa isang language community na may 20,000 speakers, wala sa kasalukuyan ang research infrastructure upang suportahan ito.

Ang resulta ay isang paradox: ang mga wikang pinakanangangailangan ng MT evaluation (dahil pinakamahina ang kanilang MT systems at nangangailangan ng pinakamaingat na assessment) ay mismong mga wikang hindi gaanong maaasahan ang pinakamahuhusay na evaluation tools. Ang tugon ng larangan ay irekomenda ang chrF++ bilang "good enough" na alternatibo — at mas mahusay ito kaysa BLEU — ngunit string-matching metric pa rin ang chrF++ na hindi makadetect ng equivalence, hindi makahandle ng free word order, at walang konsepto ng morphological validity.

---

## Bahagi 3: Higit pa sa Scoring — Diagnostic at Linguistic Evaluation

### Ang Adequacy/Fluency Split

Bago umiral ang automatic metrics, gumamit ang human evaluation ng MT ng framework na may dalawang dimension: **adequacy** (naipapahayag ba ng pagsasalin ang kahulugan ng source?) at **fluency** (grammatical at natural ba ang pagsasalin sa target language?). Ang distinction na ito, na na-codify sa early DARPA MT evaluations at kalaunan sa NIST, ay kumilala sa isang bagay na dalawang dekada susubukang bawiin ng automatic metrics: hindi one-dimensional ang translation quality.

Nawala sa pabor ang adequacy/fluency framework nang palitan ito ng Direct Assessment (isang single scalar score) sa WMT. Ngunit nananatiling kritikal ang underlying insight: maaaring fluent ngunit mali ang isang pagsasalin (hallucination), o disfluent ngunit tama (morphological variant). Walang single score na nakakakuha sa dalawa.

### MQM: Ang Gold Standard (Lommel et al., 2014; Freitag et al., 2021)

Pinalitan ng **Multidimensional Quality Metrics (MQM)** ang Direct Assessment bilang pangunahing human evaluation ng WMT mula 2021 pasulong. Gumagamit ang MQM ng professional translators na nagmamarka ng partikular na error spans, nagka-classify ng mga ito ayon sa uri (mistranslation, omission, addition, grammar, terminology) at severity (minor = 1 point, major = 5 points, critical = 25 points). Nagbubunga ito ng parehong quality score at actionable diagnostic information.

Ang MQM ang pinakamalapit sa isang "correct" evaluation methodology — sinasabi nito hindi lamang kung *gaano kasama* ang isang pagsasalin, kundi kung *ano mismo ang nagkamali*. Ngunit nangangailangan ito ng bilingual professional translators, na para sa karamihan ng low-resource languages ay wala sa sapat na bilang para sa statistically reliable evaluation.

### MorphEval: Contrastive Morphological Evaluation (Burlot & Yvon, 2017)

Ang MorphEval ang pinakadirektang prior art para sa morphology-aware MT evaluation. Ipinakilala nina Franck Burlot at François Yvon sa WMT 2017 at pinalawak noong 2018, ine-evaluate ng MorphEval ang morphological *competence* gamit ang **contrastive test suites**.

**Paano ito gumagana:** Binubuo ang test suite ng sentence pairs sa source language na naiiba sa eksaktong isang morphological contrast — halimbawa, singular vs. plural, present vs. past, masculine vs. feminine. Isinasalin ng MT system ang dalawang pangungusap. Kung wastong naipapahayag ng system ang contrast sa mga salin nito (hal., gumagawa ng plural target kapag plural ang source at singular target kapag singular ang source), kinokorek ang contrast bilang tama.

**Mga wikang sakop:** English→Czech, English→Latvian (v1, WMT 2017); pinalawak sa English→French, English→German, English→Finnish, Turkish→English (v2, WMT 2018).

**Pangunahing findings:** Ipinakita ng MorphEval na kahit top-performing neural MT systems ay may sistematikong morphological failures — maaari silang gumawa ng fluent output habang mali ang tense, number, o case. Hindi nakikita ng BLEU ang mga error na ito at kahit ng COMET ay bahagya lamang.

**Availability:** Open source sa GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limitations:** Nangangailangan ang MorphEval ng crafted contrastive test suites kada target language, na dinisenyo ng linguists na nakauunawa sa morphological contrasts ng wikang iyon. Walang test suites para sa alinmang polysynthetic language. Tinetest ng methodology ang *competence* (kaya bang hawakan ng system ang contrast na ito?) sa halip na *validity* (gumawa ba ang system ng tunay na salita?) o *equivalence* (pareho bang tama ang dalawang magkaibang pagsasalin?).

### CheckList: Behavioral Testing for NLP (Ribeiro et al., ACL 2020)

Ang **CheckList**, na inilathala sa ACL 2020 ni Marco Tulio Ribeiro at mga kasamahan (nanalo ng Best Paper), ay nagpasok ng ideya mula software engineering papunta sa NLP evaluation: **unit testing**. Sa halip na i-evaluate ang aggregate performance ng model sa isang benchmark, nagde-define ang CheckList ng matrix ng **capabilities** (vocabulary, negation, named entities, temporal reasoning, coreference) na naka-cross sa **test types**:

- **Minimum Functionality Tests (MFT)**: Simple, targeted test cases na dapat maipasa ng alinmang competent model.
- **Invariance Tests (INV)**: Perturbations sa input na *hindi dapat* magbago sa output (hal., hindi dapat magbago ang sentiment kapag pinalitan ang pangalan).
- **Directional Expectation Tests (DIR)**: Perturbations na *dapat* magbago sa output sa predictable na direksyon.

Orihinal na dinisenyo ang Checklist para sa sentiment analysis at NLI, ngunit direktang naaangkop ang paradigm sa MT. Maaaring gumawa ng MFTs para sa morphological phenomena ("gumagawa ba ang system ng tamang plural form?"), INV tests para sa free word order ("nagbabago ba ang English translation kapag nireorder ang Cree words?"), at DIR tests para sa morphological features ("nagbabago ba ang target tense kapag binago ang source mula past tungong present tense?").

Partikular na relevant ang CheckList paradigm dahil formalised nito ang ginagawa ng MorphEval nang intuitively: subukan ang partikular na capabilities sa halip na sukatin ang aggregate scores. Ang variant classes ng aming linter (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, atbp.) ay, sa katunayan, invariance rules — dine-define nila ang perturbations na hindi dapat magbago sa evaluation verdict.

### Challenge Sets at Targeted Evaluation

Ang mas malawak na paradigm ng **challenge sets** — crafted test suites na naka-target sa partikular na linguistic phenomena — ay naging established complementary evaluation methodology sa WMT mula humigit-kumulang 2017.

Pinasimulan nina **Isabelle, Cherry & Foster (2017)**, sa NRC Canada, ang approach para sa MT gamit ang hand-crafted test sets na nag-iisolate ng structural divergences sa pagitan ng mga wika — mga kaso kung saan malamang mali ang literal translation. Ang kanilang follow-up work (Isabelle & Kuhn, 2018) ay bumuo ng 506 French sentences na naka-target sa partikular na translation challenges, nagbibigay ng fine-grained pictures ng system capabilities.

Lumikha ang **LingEval97** (Sennrich, EACL 2017) ng 97,000 contrastive English→German translation pairs na tinetest kung nag-aassign ang NMT models ng mas mataas na probability sa correct translations kumpara sa pairs na may ipinakilalang morphosyntactic errors. Isang pangunahing finding: mahusay ang character-level models sa transliteration ngunit mas mahina sa long-distance morphosyntactic agreement.

Dramatikong pinalawak ng **ACES** (Amrhein, Moghe & Guillou, 2022–2023) ang challenge set approach: 36,476 examples na sumasaklaw sa 146 language pairs na sumusubok sa 68 distinct linguistic phenomena. Ginamit ang ACES upang i-meta-evaluate ang metrics na isinumite sa WMT metrics shared task — sinusubok kung kaya bang makita ng *metrics* ang contrasts, hindi lamang kung kaya bang gawin ng *systems* ang mga ito. Pinalawak sa **SPAN-ACES** na may error span annotations.

Partikular na tina-target ng **MT-GenEval** (Currey et al., EMNLP 2022) at **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) ang gender accuracy. Kapansin-pansin ang WinoMT dahil tahasan nitong ginagamit ang **morphological analysis** sa target language upang i-verify ang gender ng translated occupations — isa sa iilang kaso kung saan ginagamit ang morphological analyser bilang bahagi ng MT evaluation tool.

Ang **Hjerson** (Popović & Ney, 2011) ay open-source tool para sa automatic MT error classification na gumagamit ng **lemmas and POS tags** upang ikategorya ang errors sa limang uri: morphological, reordering, missing words, extra words, at lexical errors. Marahil ito ang pinakamalapit na prior art sa aming linter sa espiritu — gumagamit ito ng linguistic analysis upang magbigay ng diagnostic error categories sa halip na iisang score.

Ang common thread: paulit-ulit na kinilala ng larangan na hindi sapat ang aggregate scores. Nagbibigay ang diagnostic evaluation ng granularity na kailangan upang maunawaan *bakit* nabibigo ang isang system. Ngunit nangangailangan ang diagnostic approaches ng linguistic expertise kada wika, at nakasentro ang expertise na iyon sa European languages.

### AmericasNLP: Ebalwasyon sa Trenches

Ang AmericasNLP workshop series (co-located with NAACL), na nakatuon sa NLP para sa Indigenous languages of the Americas, ang nagbibigay ng pinakadirektang comparison point para sa aming evaluation challenges.

Mula 2021 hanggang 2023, ginamit ng shared task ang **chrF** bilang pangunahing evaluation metric nito — pinili dahil sa robustness nito sa low-resource settings at character-level matching nito, na nagbibigay ng partial credit para sa morphological overlap. Kinilala ng organisers ang limitations ng chrF ngunit wala silang mas mahusay na alternatibo na gagana sa magkakaibang typologies na kinakatawan (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri, at iba pa).

Noong 2025, ipinakilala ng AmericasNLP ang isang dedicated **Shared Task 3** partikular para sa pagbuo ng MT evaluation metrics para sa Indigenous languages — ang unang pagkakataon na tahasang kinilala ng larangan na hindi sapat ang umiiral na metrics para sa mga wikang ito. Ang nanalong submission, **FUSE** (Feature-Union Scorer), ay nagkombina ng multilingual sentence embeddings (fine-tuned LaBSE), lexical similarity, phonetic similarity, at fuzzy token matching gamit ang Ridge regression at Gradient Boosting. Hindi gumagamit ang FUSE ng morphological analysers — language-agnostic ang feature engineering.

Ito ang puwang na tinutugunan ng aming gawain. Natukoy na ng AmericasNLP ang problema (nabibigo ang standard metrics para sa Indigenous languages) at nagsimula nang bumuo ng alternatives (FUSE). Ngunit wala sa alternatives ang gumagamit ng morphological knowledge na ibinibigay ng FSTs. Ginagamit ng AmericasNLP community ang chrF++ dahil ito ang pinakamahusay na generic option na available, habang gumagawa ang GiellaLT community ng sophisticated morphological tools na hindi kailanman naikakabit sa MT evaluation. Hindi pa nagtatagpo ang dalawang community.

---

## Bahagi 4: Reference-Free Evaluation at Quality Estimation

Ang ilan sa pinakamahahalagang evaluation signals sa aming harness ay hindi nangangailangan ng reference translations. Kailangan lamang ng FST validity check ("tunay bang salita ito?") ang MT output. Kailangan ng hallucination detector ang source at hypothesis. Kailangan lamang ng code-switching detector ang hypothesis at kaalaman sa script ng target language. Mahalaga ang pag-unawa kung saan nakapuwesto ang mga ito sa mas malawak na landscape ng reference-free evaluation upang tama silang maiposisyon.

### Ang Quality Estimation Paradigm

Ang **Quality Estimation (QE)** ay subfield ng MT evaluation na nakatuon sa paghula ng translation quality *nang walang* reference translations. Ito ay dedicated shared task sa WMT mula 2012, na minotivate ng praktikal na pangangailangang tasahin ang MT quality sa deployment time — kapag nagsasalin kayo ng bagong text at walang human reference na maihahambing.

Umunlad ang QE task sa tatlong henerasyon. Ang **Feature-based QE** (2012–2016) ay kumuha ng hand-crafted features mula sa source at hypothesis — language model perplexity, word frequency, n-gram overlap with monolingual data — at nagsanay ng classifiers upang hulaan ang quality. Pinalitan ng **Neural QE** (2017–2021) ang hand-crafted features ng learned representations, karaniwang gamit ang bilingual encoders. Pinangungunahan ng COMET-based approaches ang **Current QE** (2022–present), lalo na ang **CometKiwi**.

### CometKiwi at Reference-Free COMET

Ang **CometKiwi** (Rei et al., WMT 2022), ang reference-free variant ng COMET, ay gumagamit ng InfoXLM upang i-encode ang source sentence at MT hypothesis (nang walang reference) at humuhula ng quality score. Nakamit nito ang state-of-the-art results sa WMT 2022 at 2023 QE shared tasks.

Ang kahanga-hangang finding: lumalapit ang reference-free CometKiwi sa correlation sa human judgment na nakamit ng reference-based COMET. Ipinahihiwatig nito na, para sa well-resourced languages, halos kasing dami ng evaluation signal ang source text kumpara sa reference translation. Ngunit naaangkop ang parehong caveat: minimal ang representasyon ng encoder ng CometKiwi para sa low-resource languages, kaya hindi maaasahan ang reference-free predictions nito para sa Cree o Sámi.

Dito nag-aalok ang aming FST-based metrics ng tunay na kakaiba. Ang FST validity check ay isang **deterministic, reference-free quality signal** na hindi nangangailangan ng trained model at walang human judgment data. Kung sinasabi ng FST na hindi valid Cree word ang isang salita, hindi valid Cree word ang salitang iyon — na may caveat ng false rejections para sa loanwords, neologisms, at proper nouns. Walang katumbas sa neural QE ecosystem ang ganitong hard, rule-based quality signal.

### Hallucination Detection sa MT

Ang hallucination sa MT — fluent output na ganap na walang kaugnayan sa source — ay seryosong failure mode, partikular sa low-resource settings kung saan kulang ang training data ng models upang matutunan ang reliable source-target correspondences.

Gumagamit ang academic state of the art sa hallucination detection ng ilang approaches:

- **Embedding-based detection**: Paghahambing ng source at hypothesis embeddings sa shared space (LASER, LaBSE) at pag-flag ng cases kung saan mas mababa sa threshold ang similarity.
- **Probability-based detection**: Paggamit ng sariling confidence scores ng MT model — karaniwang mataas ang output probability ng hallucinations ngunit mababa ang source-conditioned probability.
- **Contrastive perturbation**: Paghahambing ng MT output para sa totoong source laban sa output para sa perturbed o unrelated source; kung kahina-hinalang magkapareho ang outputs, ini-ignore ng model ang source.
- **LLM-as-judge**: Pag-prompt sa LLM upang tasahin kung faithful ang translation sa source.

Gumagamit ang aming harness ng **heuristic detection plugin** na nagko-combine ng apat na signal: length inflation (mas mahaba nang malaki ang hypothesis kaysa inaasahan), repetition (paulit-ulit na phrases), entity mismatch (named entities sa source na nawawala sa hypothesis), at source echo (masyadong similar ang hypothesis sa source text, na nagpapahiwatig ng untranslated copying). Baseline-level ito kumpara sa academic SOTA — nahuhuli nito ang gross hallucinations ngunit mamimiss ang subtle ones. Ang halaga nito ay bilang **cheap, fast, reference-free screen** na makakapag-flag ng pinakamasasamang failures nang hindi nangangailangan ng GPU o API call.

### Code-Switching Detection

Ang code-switching sa MT output — kung saan gumagawa ang system ng mga salita sa source language sa halip na isalin ang mga ito — ay distinct failure mode mula sa hallucination. Karaniwan itong nangyayari kapag nakatagpo ang model ng salitang hindi nito maisalin at bumabalik sa pagkopya ng source.

Gumagamit ang aming code-switching detection plugin ng **Unicode block analysis** (pagtukoy ng characters mula sa script ng source language sa dapat ay target-language output) at **common-word lists** (pagtukoy ng high-frequency source-language words na lumilitaw na hindi naisalin). Para sa Cree, na gumagamit ng parehong SRO (Latin-based) at syllabics, nangangailangan ito ng kaunting pag-iingat — magkabahagi ang English at SRO ng Latin script, kaya hindi sapat ang Unicode block analysis lamang.

Kaunti ang academic literature sa code-switching detection sa MT kumpara sa hallucination detection. Karamihan ng gawain ay nakatuon sa code-switching sa *input* text (bilingual speakers na naghahalo ng mga wika) kaysa sa *output* text (MT systems na nabibigong magsalin). Sa aming kaalaman, hindi gaanong nasa likod ng alinmang published state of the art ang aming heuristic approach para sa partikular na problemang ito.

---

## Bahagi 5: Ang Morphological Gap

### Ang Hindi Nakikita ng Umiiral na Metrics

Ito ang pangunahing argumento ng papel na ito, at nangangailangan ito ng konkretong demonstrasyon.

Isaalang-alang ang Plains Cree sentence pair:

| | Text |
|--|------|
| **Source (English)** | "I saw the man" |
| **Reference (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hypothesis A** | *nâpêw nikî-wâpamâw* |
| **Hypothesis B** | *nikî-wâpamikow nâpêsis* |

Ang **Hypothesis A** ay perpektong pagsasalin — mayroon itong parehong mga salita sa ibang order, na grammatical sa Cree (free word order). Ang **Hypothesis B** ay nagsasabing "the boy was seen by me" — maling direksyon ng action (*-ikow* ay inverse), maling referent (*nâpêsis* = "boy", hindi "man").

| Metric | Hypothesis A (tama) | Hypothesis B (mali) | Kaya ba nitong paghiwalayin sila? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Bahagya |
| chrF++ | ~65% | ~55% | Medyo |
| COMET | Unknown (walang Cree training data) | Unknown | Hindi maaasahan |
| **FST acceptance** | 100% | 100% | Hindi (parehong valid Cree) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Oo** |
| **Semantic validator** | VALID | WRONG | **Oo** |

Nagtagumpay ang linter at semantic validator kung saan nabibigo ang BLEU, chrF++, at COMET — hindi dahil "mas mahusay na metrics" sila sa universal na kahulugan, kundi dahil may access sila sa *linguistic knowledge* na wala sa string-matching at neural metrics. Alam nila na may free word order ang Cree. Alam nila na magkaibang lemmas na may magkaibang argument structures ang *wâpamêw* at *wâpamikow*. Alam nila na magkaibang salita ang *nâpêw* at *nâpêsis*.

Nagmumula ang kaalamang ito sa FST (na nag-e-encode ng morphological grammar), sa bilingual dictionary (na nagbibigay ng English glosses para sa bawat lemma), at sa manually-defined variant classes (na nag-e-encode ng linguistically-grounded equivalence rules). Wala sa kaalamang ito ang available sa metric na itinuturing ang translation bilang string.

### Bakit Hindi Pa Ito Natutugunan ng Larangan

Hindi misteryo ang morphological gap sa MT evaluation. Alam ng larangan na umiiral ito. Structural ang mga dahilan kung bakit nagpapatuloy ito:

1. **Scale bias.** Nag-o-optimize ang MT evaluation community para sa metrics na gumagana sa lahat ng WMT language pairs. Gumagana ang FST-based metrics para sa ~30 wika. Gumagana ang COMET para sa 100+. Gumagana ang chrF++ para sa lahat ng wikang may writing system. Ginagantimpalaan ng community ang universality kaysa precision.

2. **Community silos.** Ang mga taong gumagawa ng FSTs (computational linguists sa UiT Tromsø, NRC Canada, University of Alberta) at ang mga taong gumagawa ng evaluation metrics (ML researchers sa Google, Unbabel, WMT) ay dumadalo sa magkakaibang conferences, naglalathala sa magkakaibang venues, at gumagana sa ilalim ng magkakaibang incentive structures. Hindi pa nangyayari ang cross-pollination na kailangan upang makabuo ng FST-based evaluation metrics — hindi dahil sinubukan ito at nabigo, kundi dahil hindi kailanman nagtagpo ang communities.

3. **Coverage anxiety.** May kilalang false-rejection problems ang FSTs: maaaring i-reject bilang invalid ang loanwords, neologisms, at proper nouns kahit ganap na katanggap-tanggap ang mga ito. Dahil dito kinakabahan ang researchers na gamitin ang FSTs bilang metrics — pinapataas ng false rejection ang error rate. Valid ang concern ngunit quantifiable: straightforward ang pagsukat ng false rejection rate sa known-good text.

4. **Hindi sapat na demand.** Napakakaunti ng gumagawa ng MT para sa polysynthetic languages, at ang mga gumagawa nito (ALT Lab, NRC, AmericasNLP participants) ay karaniwang gumagamit ng chrF++ dahil iyon ang umiiral. Wala pang concerted push mula sa low-resource MT community para sa morphology-aware evaluation, bahagya dahil maliit ang community at bahagya dahil nangangailangan ang paggawa ng gayong metrics ng expertise sa parehong NLP engineering at morphology ng partikular na target language.

5. **Ang neural metric assumption.** Ang nangingibabaw na palagay mula 2020 ay malulutas din ng neural metrics ang morphological problem sa pamamagitan ng learned representations. Kung magsasanay kayo ng COMET sa sapat na data mula sa morphologically rich languages, ayon sa argumento, matututo itong humawak ng morphological variation nang implicit. Maaaring totoo ito para sa high-resource morphologically rich languages (Finnish, Turkish, Czech). Malamang hindi ito totoo para sa mga wikang halos zero ang representasyon sa training data.

---

## Bahagi 6: LYSS — Isang Alternatibong May Batayang Lingguwistiko

### Ang Itinayo ng champollion: LYSS (Linguistically-informed Yield & Structural Scoring)

Ang evaluation harness ng champollion project ay nag-iimplement ng composite scoring framework na tinatawag na **LYSS** na nagko-combine ng standard metrics (chrF++, exact match) sa apat na kategorya ng linguistically-informed metrics. Sinasalamin ng pangalan ang focus ng framework: pagsukat sa *yield* (gaano karaming kahulugan ang nakaliligtas sa translation process) sa pamamagitan ng *structural scoring* (deterministic, linguistically-grounded checks sa halip na learned embeddings).

#### 1. Morphological Validity Gate (GiellaLT FST Metric)

Ang pinakasimple at pinakamalawak na naaangkop na metric: ipasa ang bawat salita ng MT output sa GiellaLT finite-state morphological analyser para sa target language. Kung kaya ng FST na i-parse ang isang salita (nagbabalik ng hindi bababa sa isang analysis), morphologically valid ang salita. Kung hindi, hindi umiiral ang salita sa target language — ito ay hallucinated word, morphological error, misspelling, o loanword na wala sa lexicon.

**Output:** `fst_validity_rate` (0.0–1.0, mas mataas = mas mahusay). Macro-average (mean ng per-entry rates) at micro-average (kabuuang valid words / kabuuang words).

**Dependencies:** `pyhfst` (Helsinki Finite-State Technology Python bindings), isang compiled `.hfstol` analyser file para sa target language.

**Extensibility:** Gumagana para sa alinmang wikang may GiellaLT FST analyser — kasalukuyang ~30+ wika, pangunahing Sámi, Uralic, at indigenous Arctic languages.

**Relation to prior art:** Tinetest ng MorphEval kung kaya ng system na humawak ng partikular na contrasts. Tinetest ng FST metric kung binubuo ng tunay na mga salita ang output ng system. Complementary ang mga ito: competence ang tinetest ng MorphEval, validity ang tinetest ng FST metric.

#### 2. Linguistic Equivalence Classes (CRK Linter)

Tinutugunan ng linter ang maaaring pinaka-mapaminsalang failure mode ng reference-based evaluation: **pagpaparusa sa tamang translations na naiiba sa reference**.

Ang Plains Cree linter (844 lines) ay nag-iimplement ng anim na **variant classes**, bawat isa ay nag-e-encode ng linguistically-grounded equivalence rule:

- **WORD_ORDER**: May pragmatically free word order ang Cree (Wolfart, 1973 §3.2). Magkapareho ang ibig sabihin ng *nikî-wâpamâw nâpêw* at *nâpêw nikî-wâpamâw*. Gine-generate ng linter ang lahat ng permutations at chine-check kung tumutugma ang hypothesis sa alinman.
- **ORTHOGRAPHIC**: May kilalang variation points ang Standard Roman Orthography — circumflex vs. macron (*â* vs. *ā*), hyphenation ng preverbs (*nikî-nipâw* vs. *nikî nipâw* vs. *nikînipâw*). Nino-normalize ng linter ang mga ito.
- **OPTIONAL_PARTICLE**: Maaaring naroon o wala ang ilang discourse particles (*mâka*, *êkwa*, *êwako*) nang hindi binabago ang core proposition. Chine-check ng linter kung tumutugma ang hypothesis sa reference pagkatapos alisin ang particles.
- **LEMMA_SYNONYM**: Mapagpapalit ang ilang Cree lemmas sa partikular na contexts. Gumagamit ito ng curated synonym list (hal., dialectal variants) at, kapag available ang FST, chine-check kung nagbabahagi ang hypothesis at reference ng morphological analyses.
- **PROGRESSIVE_AMBIGUITY**: Maaaring isalin ang English progressive forms ("is walking") sa Cree gamit ang iba't ibang constructions. Kinikilala ng linter ang mga ito bilang equivalent.
- **INCLUSIVE_EXCLUSIVE**: Tinutukoy ng Cree ang inclusive "we" (*ki-* prefix) mula sa exclusive "we" (*ni-* prefix) — distinction na pinagsasama ng English sa iisang pronoun. Kinikilala ng linter na maaaring tama ang alinmang form kapag ambiguous ang English source.

Gumagawa ang linter ng tatlong verdicts: **EXACT** (tumutugma ang hypothesis sa reference), **EQUIVALENT** (naiiba ang hypothesis ngunit classified bilang valid variant), o **MISS** (walang match na nahanap). Sa aggregate level, kinukuwenta nito ang `equivalent_match_rate` — ang proporsyon ng translations na exact o equivalent.

**Relation to prior art:** Ang pinakamalapit na parallel ay **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), na nag-e-encode ng exponentially many valid translations bilang paraphrase networks at sumusukat ng edit distance sa pinakamalapit na valid form. Conceptually similar ang aming linter — nagde-define ito ng set ng valid translations para sa bawat reference — ngunit gumagamit ng linguistically-defined transformation rules sa halip na paraphrase databases. Dinisenyo ang HyTER para sa English; walang nakagawa ng paraphrase networks para sa Cree. Ang aming variant classes ay, sa katunayan, compact, rule-based approximation ng ginagawa ng HyTER gamit ang graphs.

Sa CheckList framework, gumaganap ang aming variant classes bilang **invariance tests**: transformations na hindi dapat magbago sa evaluation verdict. Ang kaibahan ay karaniwang inilalapat ang CheckList tests sa *model*; inilalapat ang aming variant rules sa *metric*.

#### 3. Deterministic Semantic Validation (CRK Semantic Metric)

Mas ambisyoso ang sinusubukan ng semantic validator (792 lines): **deterministic meaning comparison** nang walang neural embeddings. Gumagana ito sa apat na stage:

1. **Pagsusuring morpolohikal**: Ang parehong hypothesis at reference ay ipinapasa po sa CRK FST analyser, na nagbabalik ng lemma at mga morpolohikal na katangian para sa bawat salita.
2. **Paglutas ng gloss**: Ang bawat lemma ay hinahanap po gamit ang itwêwina dictionary API — na naghahatid sa Wolvengrey (2001) kasama ang mga diksiyonaryo ng Maskwacîs at Alberta Elders — upang makakuha ng mga English gloss.
3. **Pagkuha ng content-word**: Gamit po ang English pipeline ng spaCy (`en_core_web_md`), ang mga function word ay sinasala mula sa parehong mga English gloss at sa pinagmulang teksto.
4. **Pagmamarka ng overlap**: Ang overlap ng content-word sa pagitan ng mga gloss ng hypothesis at mga gloss ng reference ang nagtatakda po ng semantikong hatol.

Gumagawa ang validator ng categorical verdicts: **EXACT_MATCH**, **VALID** (magkaibang salita ngunit parehong kahulugan), **GRAMMAR_ISSUES** (tamang lemmas ngunit may sentence-level grammar problems — agreement, animacy, verb form), **PARTIAL** (may ilang kahulugang napanatili), **INCOMPLETE** (bahagyang nawawala ang kahulugan), **WRONG** (ibang kahulugan), o **NO_OUTPUT**.

**Relation to prior art:** Sa katunayan, ito ay isang **deterministic approximation ng semantic similarity computation ng COMET**. Kung gumagamit ang COMET ng learned cross-lingual embeddings upang tasahin kung pareho ang kahulugan ng dalawang pangungusap, gumagamit ang aming validator ng chain ng deterministic lookups: FST → dictionary → spaCy. Ang bentahe ay transparency (inspectable at deterministic ang bawat hakbang) at independence mula sa training data. Ang disbentahe ay brittleness: lubos na nakadepende ang kalidad ng assessment sa coverage ng FST at completeness ng dictionary.

Conceptually related ang approach sa **MEANT** (Lo & Wu, 2011; Lo, 2017), na gumamit ng semantic role labelling upang tasahin kung napanatili ang "who did what to whom" structure sa pagsasalin. Mas coarse-grained ang aming approach (content-word overlap sa halip na semantic roles) ngunit gumagana sa wikang walang SRL tools.

#### 4. Behavioral Detection Plugins (Hallucination, Code-Switching, Terminology)

Nagbibigay ang tatlong karagdagang plugins ng **behavioral quality signals** na complement sa morphological metrics:

- **Hallucination detection** (259 lines): Apat na heuristic signals na weighted at combined — length inflation (40%), repetition (30%), entity mismatch (20%), source echo (10%). Cheap, reference-free screens ang mga ito na nakakahuli ng gross fabrication.
- **Code-switching detection** (~280 lines): Unicode block analysis plus common-word lists upang tukuyin ang untranslated source-language tokens. Naglalabas ng `code_switching_rate` (0.0–1.0).
- **Terminology adherence** (199 lines): Chine-check kung consistent na naisalin ang specified glossary terms. Nagbabalik ng `terminology_adherence` (0.0–1.0) o None kung walang glossary na naka-configure.

Tapat na ipinoposisyon ang mga plugin na ito bilang **baseline heuristic detectors**, hindi state-of-the-art. Ang halaga ng mga ito ay pagbibigay ng cheap, fast, interpretable signals na makukuwenta kasabay ng mas sopistikadong morphological metrics. Sa composite scoring framework, mababa ang weights nila (0.05 bawat isa).

### Tapat na Limitations

May malalaking limitasyon ang approach na ito na kailangang kilalanin bago ang anumang claim ng novelty o utility:

1. **FST false rejection rate.** Ire-reject ng FST ang valid words na wala sa lexicon nito — loanwords, neologisms, proper nouns, code-mixed terms. Pinapataas nito ang morphological error rate. Hindi pa pormal na nasusukat ang false rejection rate sa representative corpus ng Cree text. Kung wala ang sukat na ito, hindi alam ang precision ng FST validity metric.

2. **Saklaw ng diksiyonaryo.** Ang kalidad po ng semantic validator ay ganap na nakasalalay sa saklaw ng diksiyonaryo ng Wolvengrey. Ang mga salitang Cree na wala sa diksiyonaryo ay hindi po nagkakaroon ng mga gloss, na itinuturing ng validator bilang isang puwang sa kahulugan. Ang diksiyonaryo ay naglalaman po ng humigit-kumulang 18,000–22,000 na entry (nag-iiba ang bilang batay sa edisyon at paraan ng pagbibilang) — malaki, ngunit hindi kumpleto.

3. **Variant class completeness.** Dinisenyo ang anim na variant classes ng linter batay sa linguistic literature at obserbasyon ng MT output patterns. Maaaring may karagdagang equivalence classes na hindi nakuha — dialectal variations, register differences, discourse-level synonyms. Walang formal process na nagsisiguro ng completeness.

4. **Walang human correlation study.** Ang pinakamahalagang gap: walang nakapagsukat kung ang verdicts ng linter (EXACT/EQUIVALENT/MISS) o verdicts ng semantic validator ay nagko-correlate sa human judgments ng translation quality. Gumugugol ng mga taon ang neural metrics sa pagtatatag ng correlation sa human assessment (WMT shared tasks). Walang gayong validation ang aming metrics.

5. **Language specificity.** Specific sa Plains Cree ang variant classes, synonym lists, at optional particle rules. Ang pag-port ng mga ito sa North Sámi, Inuktitut, o alinmang ibang wika ay nangangailangan ng linguists na nakauunawa sa morphology, word order flexibility, at orthographic variation ng wikang iyon. Portable ang *framework*; hindi ang *rules*.

6. **Metric wiring gaps.** Sa pagsulat na ito, apat sa siyam na metrics sa composite scoring profile (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) ang may incomplete o unclear plugin wiring sa arena harness. Ang composite score ay epektibong kinukuwenta mula sa humigit-kumulang limang metrics na may redistributed weights.

### Ano ang Kailangan Upang Ma-validate ang Approach na Ito

Upang maging publishable ang gawaing ito — sa alinmang venue, sa alinmang antas ng academic seriousness — kailangan ang mga sumusunod na eksperimento:

1. **Human judgment correlation study.** Mangolekta ng human quality assessments para sa set ng English→Cree translations (ideally 200+ sentence pairs na tinasa ng 3+ bilingual speakers). Kuwentahin ang correlations sa pagitan ng human scores at bawat isa sa aming metrics. Ito ang nag-iisang pinakamahalagang validation. Kung wala ito, engineering artifacts ang metrics, hindi evaluation tools.

2. **FST false rejection rate measurement.** Patakbuhin ang FST analyser sa corpus ng known-good Cree text (hal., published Cree texts, validated parallel corpora) at sukatin kung ilang porsiyento ng valid words ang nire-reject. Kinukuwantipika nito ang precision ng FST validity metric.

3. **Second-language validation.** I-port ang FST validity metric sa ikalawang GiellaLT language (pinakamalamang North Sámi, na may pinakamaunlad na FST analyser sa GiellaLT ecosystem). Ipakita na gumagawa ang metric ng sensible results sa Sámi MT output. Vine-validate nito ang claim ng extensibility.

4. **Comparison with COMET.** Patakbuhin ang COMET sa parehong Cree data at ihambing ang scores nito sa aming metrics at human judgments. Kung gumagawa ang COMET ng makabuluhang scores para sa Cree (na pinagdududahan namin, ngunit hindi pa natetest), kailangang talunin ito ng aming metrics upang maging kapaki-pakinabang. Kung gumagawa ang COMET ng noise (na inaasahan namin), vine-validate nito ang pangangailangan para sa aming approach.

5. **MorphEval diagnostic complement.** Bumuo ng maliit (50–100 contrasts) na MorphEval-style test suite para sa Plains Cree na naka-target sa pinakanatatanging morphological features ng wika (obviative, inverse, conjunct/independent, inclusive/exclusive). Patakbuhin ang MT systems laban dito at ipakita na actionable ang diagnostic information.

6. **Wiring and integration audit.** Ayusin ang scoring profile wiring gaps na natukoy sa codebase inventory. Tiyaking lahat ng siyam na composite metrics ay gumagawa ng values at wastong kinukuwenta ang aggregate score.

---

## Bahagi 7: Positioning at Future Work

### Kung Saan Nakapuwesto ang LYSS sa Evaluation Landscape

Isang taxonomy ng MT evaluation approaches, tapat na nakaposisyon:

| Dimension | String metrics (BLEU, chrF++) | Neural metrics (COMET, MetricX) | LLM-as-judge (GEMBA) | Diagnostic (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Signal type | Surface overlap | Learned semantic similarity | Open-ended judgment | Targeted capability probes | Morphological validity + rule-based equivalence |
| Training data needed | Wala | Human judgments (thousands) | Pre-trained LLM | Linguist-designed test suites | FST + dictionary + variant rules |
| LRL applicability | Universal ngunit mahina | Limitado ng encoder coverage | Limitado ng LLM coverage | Limitado ng paggawa ng test suite | Limitado ng FST availability (~30 wika) |
| Reference needed | Oo | Oo (o source-only QE) | Optional | Oo (contrastive) | Oo (LYSS-eq/LYSS-sem) / Hindi (LYSS-fst) |
| Interpretability | Mababa (isang numero) | Mababa (isang numero) | Mataas (text rationale) | Mataas (pass/fail kada phenomenon) | Mataas (verdicts + variant classes) |

**Ang LYSS ay hindi**: kapalit ng COMET sa well-resourced languages, universal metric, o ang unang morphology-aware evaluation.

**Ang LYSS ay**: integrated framework na nagko-combine ng FST-based morphological validation sa standard metrics para sa partikular na kaso ng mga wikang kulang ang coverage ng neural metrics at may umiiral na rule-based tools (FSTs, dictionaries). Mayroon itong tatlong core components:
- **LYSS-fst** — Morphological validity via FST (`fst_acceptance_rate`)
- **LYSS-eq** — Linguistic equivalence via the linter (`equivalent_match_rate`)
- **LYSS-sem** — Deterministic semantic validation (`semantic_score`)

**Pinalalawak ng LYSS**: ang core insight ng MorphEval (gumamit ng morphological tools para sa evaluation) mula sa diagnostic competence testing tungo sa continuous quality scoring.

**Kinumplemento ng LYSS**: chrF++ (na nagbibigay ng partial credit para sa shared morphemes ngunit hindi makadetect ng equivalence), COMET (na gumagana sa semantic space ngunit kulang ang training data para sa LRL), at FUSE (na gumagamit ng feature engineering ngunit hindi morphological analysers).

**Ang pinakamalapit na prior art ay**: Hjerson (linguistic error classification) + HyTER (equivalence classes via paraphrase networks) + naïve coverage metric ng Apertium (FST-based validity checking). Hindi iisang technique ang ambag ng LYSS kundi ang integration ng mga ideyang ito — partikular ang FST-based validity at rule-based equivalence — sa isang gumaganang evaluation harness para sa isang polysynthetic language.

### Integrating MorphEval

Complementary ang contrastive test suite methodology ng MorphEval at ang aming continuous scoring approach:

- **MorphEval** sumasagot: "Kaya ba ng system na ito ang tense marking? Number agreement? Case assignment?"
- **Ang aming FST metric** sumasagot: "Gumawa ba ang system na ito ng tunay na mga salita?"
- **Ang aming linter** sumasagot: "Equivalent ba ang pagsasaling ito sa reference sa kabila ng surface differences?"
- **Ang aming semantic validator** sumasagot: "Tama ba ang kahulugan ng pagsasaling ito?"

Open source ang MorphEval. Ang paggawa ng Plains Cree test suite ay mangangailangan ng linguist upang magdisenyo ng contrastive pairs na sumasaklaw sa Cree-specific morphological contrasts (obviation, inverse marking, conjunct/independent order, inclusive/exclusive "we," preverb chains). Substantial ngunit bounded work ito — weeks, hindi months — at magbibigay ng diagnostic capability na wala sa alinmang ibang evaluation tool para sa Cree.

### Ang Extensibility Question

Aling iba pang wika ang maaaring gumamit ng approach na ito? Ang pangunahing constraint ay FST availability. Nagbibigay ang GiellaLT infrastructure ng morphological analysers para sa 30+ wika, pangunahin sa tatlong families:

- **Sámi languages** (North Sámi, Lule Sámi, South Sámi, Skolt Sámi, Inari Sámi): Mature FSTs na may malawak na coverage. North Sámi ang pinakaagad na portable target.
- **Uralic languages** (Finnish, Estonian, Komi, Erzya, Moksha): Well-developed analysers, bagaman maaaring hindi gaanong agarang kailanganin ng Finnish at Estonian ang FST-based evaluation (mayroon silang mas maraming neural metric coverage).
- **Indigenous Arctic languages** (Inuktitut via Uqailaut, Greenlandic): May analysers ngunit nag-iiba ang coverage.
- **Other GiellaLT languages**: Faroese, Irish, Cornish, Livonian, at iba pa na may iba't ibang antas ng FST maturity.

Sa labas ng GiellaLT, nagbibigay ang **Apertium** platform ng morphological analysers para sa humigit-kumulang 40+ language pairs. Ang **HFST** ecosystem (Helsinki Finite-State Technology) ang shared infrastructure na parehong ginagamit ng GiellaLT at Apertium, ibig sabihin maaaring sa prinsipyo ikabit ang alinmang Apertium analyser sa parehong FST validity metric.

Ang praktikal na constraint ay hindi FST availability kundi **variant class curation**. Nangangailangan ng linguistic expertise kada target language ang equivalence rules ng linter. Para sa North Sámi, mangangailangan ito ng pag-unawa sa Sámi word order flexibility, orthographic conventions, at dialectal variation. Para sa Inuktitut, mangangailangan ito ng pag-unawa sa polysynthetic morphology sa antas na maihahambing sa ginawa para sa Cree. Gayunman, maaaring i-deploy agad ang FST validity metric para sa alinmang wikang may GiellaLT analyser — walang karagdagang linguistic work na kailangan.

### Tungo sa Isang Papel

Ang publication batay sa gawaing ito ay pinaka-natural na ita-target ang isa sa mga venue na ito:

- **WMT Metrics Shared Task** (co-located with EMNLP): Ang pinakadirektang venue. Mangangailangan ng pag-implement ng metrics bilang shared-task submission at ebalwasyon sa WMT test sets — na kasalukuyang walang kasamang polysynthetic language. Maaaring magsumite bilang "findings" paper o lumahok sa challenge sets subtask.
- **LREC-COLING** (Language Resources and Evaluation Conference): Natural fit para sa resource/tool paper na naglalarawan ng evaluation framework at linguistic resources na ginagamit nito (FSTs, dictionaries, variant rules).
- **ACL or NAACL** (main conference): Mangangailangan ng human correlation study at hindi bababa sa isang karagdagang wika upang maabot ang bar para sa main conference paper.
- **AmericasNLP workshop**: Ang pinaka-receptive na audience para sa Indigenous language MT evaluation. Mas mababa ang publication bar, ngunit mataas ang impact sa target community.
- **ComputEL** (Computational Approaches to Endangered Languages): Focused venue para mismo sa ganitong uri ng gawain.

Ang anumang publication ay mangangailangan ng co-authors na may expertise sa Cree linguistics (upang i-validate ang variant classes at i-interpret ang results) at ideally bilingual Cree speakers (upang magbigay ng human quality assessments para sa correlation study). Hindi ito optional — ang papel tungkol sa Cree MT evaluation na isinulat nang buo ng non-Cree-speakers ay, sa pinakamabuti, incomplete, at sa pinakamasama, pagpapatuloy ng extractive research dynamics na sinusubukang lampasan ng larangan.

---

## Appendix A: Metric Requirements Matrix

| Metric | Reference needed? | Source needed? | Trained model? | Language-specific resources? | Works for LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Oo | Hindi | Hindi | Hindi | Mahina |
| chrF++ | Oo | Hindi | Hindi | Hindi | Mas mahusay kaysa BLEU |
| METEOR | Oo | Hindi | Hindi | Stemmer + WordNet | Kung may resources lamang |
| TER | Oo | Hindi | Hindi | Hindi | Katulad ng BLEU |
| BERTScore | Oo | Hindi | Oo (mBERT) | Hindi | Depende sa model coverage |
| BLEURT | Oo | Hindi | Oo (trained) | Hindi | Depende sa training data |
| COMET | Oo | Oo | Oo (XLM-R) | Hindi | Depende sa XLM-R coverage |
| CometKiwi | Hindi | Oo | Oo (XLM-R) | Hindi | Depende sa XLM-R coverage |
| GEMBA | Optional | Oo | Oo (LLM) | Hindi | Depende sa LLM coverage |
| **FST acceptance** | **Hindi** | **Hindi** | **Hindi** | **Oo (FST analyser)** | **Oo, kung may FST** |
| **CRK Linter** | **Oo** | **Hindi** | **Hindi** | **Oo (FST + variant rules)** | **Oo, kung may resources** |
| **CRK Semantic** | **Oo** | **Optional** | **Hindi** | **Oo (FST + dictionary + spaCy)** | **Oo, kung may resources** |
| Hallucination det. | Hindi | Oo | Hindi | Hindi | Oo |
| Code-switching det. | Optional | Oo | Hindi | Minimal | Oo |
| MorphEval | Oo (contrastive) | Oo | Hindi | Oo (test suite + analyser) | Kung may test suite lamang |

## Appendix B: Key Papers

| Citation | Venue | Relevance |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | Ang metric na nagtakda sa larangan |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Information-weighted n-gram matching |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Stemming, synonyms, word alignment |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Edit distance na may phrase shifts |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Hjerson error classification |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Equivalence classes via paraphrase networks |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | MQM error typology |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Character-level evaluation |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Character + word n-gram evaluation |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Contrastive morphological test suites |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | LingEval97 contrastive pairs |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Targeted structural divergence testing |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | sacreBLEU standardisation |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Meta-analysis ng correlation ng BLEU sa human judgment |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | WinoMT gender evaluation |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Best Paper) | Capability-based unit testing para sa NLP |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Embedding-based semantic similarity |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Pre-trained + fine-tuned metric |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Cross-lingual trilingual evaluation |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | MQM-based meta-evaluation |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | Multilingual NMT bilang paraphrase scorer |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Counterfactual gender accuracy |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 phenomena, 146 language pairs |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM-as-evaluator |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Error span detection |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Neural metrics para sa African languages |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | mT5-based winning metric |

## Appendix C: Glossary of Evaluation Terms

| Term | Definition |
|------|------------|
| **Adequacy** | Kung naipapahayag ng translation ang kahulugan ng source. |
| **Fluency** | Kung grammatical at natural ang translation sa target language. |
| **Direct Assessment (DA)** | Human evaluation method kung saan nire-rate ng annotators ang translations sa 0–100 scale. |
| **MQM** | Multidimensional Quality Metrics — error-span-based human evaluation na may typed severities. |
| **Quality Estimation (QE)** | Paghula ng translation quality nang walang reference translation. |
| **FST** | Finite-State Transducer — computational device na nag-e-encode ng morphological rules ng isang wika. |
| **GiellaLT** | Infrastructure para sa rule-based language technology, pangunahing para sa Sámi at iba pang Arctic languages. |
| **HFST** | Helsinki Finite-State Technology — ang software framework na pinagbabatayan ng GiellaLT at Apertium. |
| **SRO** | Standard Roman Orthography — ang Latin-based writing system para sa Plains Cree. |
| **Syllabics** | Canadian Aboriginal Syllabics — isang abugida writing system na ginagamit para sa Cree at iba pang Algonquian languages. |
| **Polysynthetic** | Uri ng wika kung saan maaaring i-encode ng iisang salita ang katumbas ng buong English sentence sa pamamagitan ng malawak na affixation. |
| **Obviation** | Grammatical category sa Algonquian languages na nagtatangi sa pagitan ng dalawang third-person referents. |
| **Inverse** | Voice-like category sa Algonquian languages na nagmamarka na ang patient ay mas mataas kaysa agent sa animacy hierarchy. |
| **WMT** | Conference on Machine Translation — ang pangunahing venue para sa MT shared tasks at evaluation. |
| **Contrastive evaluation** | Pagsubok kung kaya ng system na pag-ibahin ang minimally-different inputs na nangangailangan ng magkaibang outputs. |
| **Challenge set** | Crafted test suite na naka-target sa partikular na linguistic phenomena. |
| **Equivalence class** | Set ng magkakaibang surface forms na kumakatawan sa parehong kahulugan at dapat makatanggap ng parehong evaluation score. |

## Saan ito patungo sa site na ito

Ang sariling mga kasagutan po ng Champollion sa mga problemang nakatala rito ay ang
[Scoring Specification](/docs/network/specifications/scoring) (kung aling metric
ang mahalaga, at kailan), [Metric Reliability](/docs/network/specifications/metric-reliability)
(kung aling metric ang dapat pagkatiwalaan bawat target na wika), at ang
[Corpus Design Framework](/docs/network/specifications/corpus-design)
(kung paano nakakamit ng isang test set ang karapatang paniwalaan).
