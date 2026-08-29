---
sidebar_position: 3
title: "قياس ما لا يمكن قياسه"
---

# Measuring the Immeasurable: The Evaluation Problem in Machine Translation
# قياس ما لا يمكن قياسه: مشكلة التقييم في الترجمة الآلية

**A survey of how the field measures translation quality, where it fails, and what LYSS (Linguistically-informed Yield & Structural Scoring) offers as an alternative**
**دراسة استقصائية لكيفية قياس المجال لجودة الترجمة، وأين يفشل، وما يقدمه LYSS (Linguistically-informed Yield & Structural Scoring) كبديل**

---

> *"Automatic metrics are a convenient lie. They give us a number, and the number lets us write a paper, and the paper lets us claim progress. Whether progress actually happened is a separate question."*
> — Adapted from a recurring sentiment at WMT Metrics Shared Tasks
> *"المقاييس الآلية هي كذبة مريحة. إنها تعطينا رقماً، وهذا الرقم يتيح لنا كتابة ورقة بحثية، والورقة البحثية تتيح لنا ادعاء إحراز تقدم. أما ما إذا كان التقدم قد حدث بالفعل، فهذا سؤال منفصل."*
> — مقتبس من شعور متكرر في مهام WMT Metrics المشتركة

---

## Introduction
## مقدمة

Machine translation has a measurement problem.
تعاني الترجمة الآلية من مشكلة في القياس.

The field has spent two decades building increasingly sophisticated systems — from phrase tables to attention mechanisms to trillion-parameter language models — and throughout that entire arc, it has struggled with a deceptively simple question: *how do you know if a translation is good?*
لقد أمضى هذا المجال عقدين من الزمن في بناء أنظمة متطورة بشكل متزايد — من جداول العبارات إلى آليات الانتباه إلى النماذج اللغوية ذات التريليون معلمة — وطوال هذا المسار بأكمله، كان يكافح مع سؤال بسيط بشكل مخادع: *كيف تعرف ما إذا كانت الترجمة جيدة؟*

This question is not academic. The metric you choose determines which system "wins." It determines what gets funded, what gets published, what gets deployed, and — for the languages that need MT most — whether a community's translations are judged as failures when they are, in fact, correct.
هذا السؤال ليس أكاديمياً. فالمقياس الذي تختاره يحدد النظام الذي "يفوز". وهو يحدد ما يتم تمويله، وما يتم نشره، وما يتم نشره للاستخدام، و— بالنسبة للغات التي هي في أمس الحاجة إلى الترجمة الآلية (MT) — ما إذا كان يُحكم على ترجمات مجتمع ما بأنها فاشلة بينما هي في الواقع صحيحة.

The history of MT evaluation is, in miniature, a history of the field's values. The dominance of BLEU for nearly two decades reveals a preference for cheap, fast, language-agnostic measurement over linguistically informed assessment. The rise of neural metrics like COMET reflects the field's growing sophistication — and its continued dependence on English-centric training data. The near-total absence of morphology-aware evaluation reflects a field that has, until recently, been built by and for speakers of analytic European languages.
إن تاريخ تقييم الترجمة الآلية هو، في صورة مصغرة، تاريخ لقيم هذا المجال. تكشف هيمنة BLEU لما يقرب من عقدين من الزمن عن تفضيل للقياس الرخيص والسريع والمستقل عن اللغة على التقييم المستنير لغوياً. ويعكس صعود المقاييس العصبية مثل COMET التطور المتزايد للمجال — واعتماده المستمر على بيانات التدريب التي تتمحور حول اللغة الإنجليزية. ويعكس الغياب شبه التام للتقييم المدرك للصرف مجالاً تم بناؤه، حتى وقت قريب، بواسطة ومن أجل المتحدثين باللغات الأوروبية التحليلية.

This paper traces the evolution of MT evaluation from BLEU to the present day, identifies where existing approaches systematically fail for morphologically complex and low-resource languages, and examines what a linguistically-grounded alternative might look like. It is a companion to the project's other context documents — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (which traces the intellectual history of language and computation) and the [*Field Briefing*](./mt-field-briefing.md) (which surveys the current MT landscape). Where those documents ask "how did we get here?" and "what exists?", this one asks: "how do we know if any of it works?"
تتتبع هذه الورقة تطور تقييم الترجمة الآلية من BLEU إلى يومنا هذا، وتحدد أين تفشل المناهج الحالية بشكل منهجي مع اللغات المعقدة صرفياً وذات الموارد المنخفضة، وتفحص كيف يمكن أن يبدو البديل القائم على أسس لغوية. إنها وثيقة مصاحبة لوثائق السياق الأخرى للمشروع — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (والتي تتتبع التاريخ الفكري للغة والحوسبة) و [*Field Briefing*](./mt-field-briefing.md) (والتي تستعرض المشهد الحالي للترجمة الآلية). وحيثما تطرح تلك الوثائق سؤال "كيف وصلنا إلى هنا؟" و"ما هو الموجود؟"، فإن هذه الوثيقة تطرح سؤال: "كيف نعرف ما إذا كان أي من هذا ينجح؟"

---

## Part 1: The String-Matching Era (2002–2015)
## الجزء الأول: عصر مطابقة السلاسل النصية (2002–2015)

### BLEU and the Birth of Automatic Evaluation
### BLEU وولادة التقييم الآلي



The modern era of MT evaluation begins with a single paper: Kishore Papineni, Salim Roukos, Todd Ward, and Wei-Jing Zhu's "BLEU: a Method for Automatic Evaluation of Machine Translation," published at ACL 2002. BLEU (Bilingual Evaluation Understudy) measures how much a machine translation's word sequences (n-grams) overlap with one or more human reference translations. It includes a brevity penalty to prevent systems from gaming the score with short outputs, and it computes a geometric mean of n-gram precisions at orders 1 through 4.
يبدأ العصر الحديث لتقييم الترجمة الآلية بورقة بحثية واحدة: "BLEU: a Method for Automatic Evaluation of Machine Translation" للباحثين Kishore Papineni و Salim Roukos و Todd Ward و Wei-Jing Zhu، والتي نُشرت في مؤتمر ACL عام 2002. يقيس BLEU (Bilingual Evaluation Understudy) مدى تداخل تسلسلات الكلمات (n-grams) في الترجمة الآلية مع ترجمة مرجعية بشرية واحدة أو أكثر. ويتضمن عقوبة الإيجاز لمنع الأنظمة من التلاعب بالنتيجة من خلال المخرجات القصيرة، ويحسب المتوسط الهندسي لدقة n-gram في الرتب من 1 إلى 4.

BLEU became the field's currency for a simple reason: it was fast, cheap, reproducible, and language-independent. Before BLEU, evaluating an MT system required expensive, slow human assessment. BLEU offered a number that could be computed in milliseconds, compared across papers, and used to rank systems in shared tasks. Within a few years, it was essentially mandatory — a paper without BLEU scores was unpublishable.
أصبح BLEU العملة المتداولة في هذا المجال لسبب بسيط: لقد كان سريعاً ورخيصاً وقابلاً للتكرار ومستقلاً عن اللغة. قبل BLEU، كان تقييم نظام الترجمة الآلية يتطلب تقييماً بشرياً مكلفاً وبطيئاً. قدم BLEU رقماً يمكن حسابه في أجزاء من الألف من الثانية، ومقارنته عبر الأوراق البحثية، واستخدامه لترتيب الأنظمة في المهام المشتركة. وفي غضون سنوات قليلة، أصبح إلزامياً بشكل أساسي — فالورقة البحثية التي لا تحتوي على درجات BLEU كانت غير قابلة للنشر.

But BLEU has deep, well-documented flaws that the field has spent two decades trying to work around:
لكن BLEU يعاني من عيوب عميقة وموثقة جيداً أمضى المجال عقدين من الزمن في محاولة التغلب عليها:

**No semantic understanding.** BLEU is pure surface matching. "The cat sat on the mat" scores zero against a reference of "the feline rested on the rug." Every word is a correct synonym; the meaning is identical; the score is zero.
**انعدام الفهم الدلالي.** BLEU هو مطابقة سطحية بحتة. جملة "The cat sat on the mat" تسجل صفراً مقابل مرجع "the feline rested on the rug". كل كلمة هي مرادف صحيح؛ والمعنى متطابق؛ لكن النتيجة هي صفر.

**Morphological blindness.** For agglutinative and polysynthetic languages, strict word-level matching fails catastrophically. A correctly conjugated Cree verb that differs by one morpheme from the reference scores zero — even if the difference is a grammatically optional particle or an equally valid word order.
**العمى الصرفي.** بالنسبة للغات الإلصاقية ومتعددة التركيب، تفشل المطابقة الصارمة على مستوى الكلمة بشكل كارثي. فالفعل المصرف بشكل صحيح في لغة Cree والذي يختلف بمورفيم واحد عن المرجع يسجل صفراً — حتى لو كان الاختلاف عبارة عن أداة اختيارية نحوياً أو ترتيب كلمات صحيح بنفس القدر.

**Poor sentence-level discrimination.** BLEU was designed as a corpus-level metric. At the sentence level, it is noisy and unreliable — yet it is routinely applied to individual sentences.
**ضعف التمييز على مستوى الجملة.** تم تصميم BLEU كمقياس على مستوى المتن اللغوي (corpus). أما على مستوى الجملة، فهو مزعج وغير موثوق — ومع ذلك يتم تطبيقه بشكل روتيني على الجمل الفردية.

**Single-reference bias.** BLEU assumes there is *one* correct translation (or a small set of references). For languages with free word order, synonym-rich vocabularies, or systematic ambiguities (like Cree's inclusive/exclusive "we"), there may be dozens of equally correct translations, and BLEU penalises all but the one that happens to match the reference.
**التحيز للمرجع الواحد.** يفترض BLEU وجود ترجمة صحيحة *واحدة* (أو مجموعة صغيرة من المراجع). بالنسبة للغات ذات الترتيب الحر للكلمات، أو المفردات الغنية بالمرادفات، أو الغموض المنهجي (مثل ضمير "نحن" الشامل/الحصري في لغة Cree)، قد يكون هناك العشرات من الترجمات الصحيحة بنفس القدر، ويعاقب BLEU جميع الترجمات باستثناء تلك التي تتطابق مع المرجع.

**Weak correlation with human judgment.** Meta-analyses — notably Reiter (2018, *Computational Linguistics*) — have shown that BLEU's correlation with human quality assessments is often weak, particularly for high-quality systems and for languages distant from English.
**ضعف الارتباط مع التقييم البشري.** أظهرت التحليلات التلوية — ولا سيما Reiter (2018، *Computational Linguistics*) — أن ارتباط BLEU بتقييمات الجودة البشرية غالباً ما يكون ضعيفاً، خاصة بالنسبة للأنظمة عالية الجودة وللغات البعيدة عن اللغة الإنجليزية.

These flaws were known almost from the beginning. Yet BLEU persisted because the alternatives were worse — not in accuracy, but in convenience. The field optimised for the metric it could compute, not the metric it needed.
كانت هذه العيوب معروفة منذ البداية تقريباً. ومع ذلك استمر BLEU لأن البدائل كانت أسوأ — ليس في الدقة، ولكن في الملاءمة. لقد قام المجال بالتحسين من أجل المقياس الذي يمكنه حسابه، وليس المقياس الذي يحتاجه.

### NIST (Doddington, 2002)
### NIST (Doddington, 2002)

The NIST metric, published in the same year as BLEU by George Doddington at HLT 2002, modified the BLEU formula in two ways. First, it weighted n-grams by their **information content** — rare n-grams received higher weight than common ones, on the intuition that correctly translating an unusual phrase is more informative than correctly translating "of the." Second, it used an **arithmetic mean** instead of BLEU's geometric mean, producing more stable scores that didn't collapse to zero when any single n-gram order had no matches. NIST was used extensively in the DARPA TIDES and NIST OpenMT evaluation programmes but never achieved BLEU's dominance in the broader research community. Despite its improvements, it shared BLEU's fundamental limitation: surface-level string matching with no concept of meaning.
قام مقياس NIST، الذي نُشر في نفس العام الذي نُشر فيه BLEU بواسطة George Doddington في مؤتمر HLT 2002، بتعديل صيغة BLEU بطريقتين. أولاً، قام بوزن n-grams بناءً على **محتواها المعلوماتي** — حيث حصلت n-grams النادرة على وزن أعلى من الشائعة، بناءً على الحدس بأن الترجمة الصحيحة لعبارة غير عادية هي أكثر إفادة من الترجمة الصحيحة لـ "of the". ثانياً، استخدم **المتوسط الحسابي** بدلاً من المتوسط الهندسي في BLEU، مما أدى إلى إنتاج درجات أكثر استقراراً لا تنهار إلى الصفر عندما لا يكون لأي رتبة n-gram مفردة أي تطابقات. تم استخدام NIST على نطاق واسع في برامج تقييم DARPA TIDES و NIST OpenMT ولكنه لم يحقق أبداً هيمنة BLEU في مجتمع البحث الأوسع. وعلى الرغم من تحسيناته، فقد شارك BLEU في قيده الأساسي: مطابقة السلاسل النصية على المستوى السطحي دون أي مفهوم للمعنى.

### METEOR (Banerjee & Lavie, 2005)
### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) was an early attempt to address BLEU's rigidity. Where BLEU performs exact word matching, METEOR introduced three innovations:
كان METEOR (Metric for Evaluation of Translation with Explicit ORdering) محاولة مبكرة لمعالجة جمود BLEU. حيث يقوم BLEU بمطابقة دقيقة للكلمات، قدم METEOR ثلاثة ابتكارات:

1. **Stemming**: Words are reduced to their stems before comparison, giving partial credit for morphological variants (e.g., "running" matches "ran" after stemming).
2. **Synonym matching**: Using WordNet, METEOR recognises that "car" and "automobile" are the same concept.
3. **Word alignment**: Rather than counting n-gram overlaps, METEOR explicitly aligns words between the hypothesis and reference, then computes precision and recall with a fragmentation penalty.
1. **الاسترداد إلى الجذر (Stemming)**: يتم إرجاع الكلمات إلى جذورها قبل المقارنة، مما يعطي رصيداً جزئياً للمتغيرات الصرفية (على سبيل المثال، تتطابق "running" مع "ran" بعد الاسترداد إلى الجذر).
2. **مطابقة المرادفات**: باستخدام WordNet، يدرك METEOR أن "car" و "automobile" هما نفس المفهوم.
3. **محاذاة الكلمات**: بدلاً من حساب تداخلات n-gram، يقوم METEOR بمحاذاة الكلمات صراحةً بين الفرضية والمرجع، ثم يحسب الدقة والاستدعاء مع عقوبة التجزئة.

METEOR consistently showed higher correlation with human judgments than BLEU. But it required language-specific resources (stemmers, synonym databases) that limited its applicability, and it was slower to compute. For English, it was better. For low-resource languages, the stemmers and synonym databases simply didn't exist.
أظهر METEOR باستمرار ارتباطاً أعلى بالتقييمات البشرية مقارنة بـ BLEU. ولكنه تطلب موارد خاصة باللغة (أدوات الاسترداد إلى الجذر، قواعد بيانات المرادفات) مما حد من إمكانية تطبيقه، وكان أبطأ في الحساب. بالنسبة للغة الإنجليزية، كان أفضل. أما بالنسبة للغات ذات الموارد المنخفضة، فإن أدوات الاسترداد إلى الجذر وقواعد بيانات المرادفات لم تكن موجودة ببساطة.

### TER (Snover et al., 2006)
### TER (Snover et al., 2006)

Translation Edit Rate measures the minimum number of edits (insertions, deletions, substitutions, and *phrase shifts*) needed to transform the hypothesis into the reference, normalised by reference length. The phrase-shift operation — moving a contiguous sequence of words to a different position — was a direct acknowledgment that word order is not fixed across languages. TER's edit-distance approach is intuitive (it measures "how much work would a human post-editor need to do?") but inherits the same fundamental limitation: it compares against a single reference and has no concept of meaning.
يقيس معدل تحرير الترجمة (Translation Edit Rate) الحد الأدنى لعدد التعديلات (الإدراج، الحذف، الاستبدال، و*إزاحة العبارات*) اللازمة لتحويل الفرضية إلى المرجع، مع تسويتها بطول المرجع. كانت عملية إزاحة العبارة — نقل تسلسل متصل من الكلمات إلى موضع مختلف — اعترافاً مباشراً بأن ترتيب الكلمات ليس ثابتاً عبر اللغات. إن نهج مسافة التحرير الخاص بـ TER بديهي (فهو يقيس "مقدار العمل الذي سيحتاج المحرر البشري اللاحق للقيام به؟") ولكنه يرث نفس القيد الأساسي: فهو يقارن بمرجع واحد وليس لديه أي مفهوم للمعنى.

### chrF and chrF++ (Popović, 2015; 2017)
### chrF و chrF++ (Popović, 2015; 2017)

The most important metric innovation between BLEU and the neural era came from Maja Popović. **chrF** (character F-score) measures overlap at the *character* level rather than the word level, computing character n-gram precision and recall. **chrF++** adds word-level unigrams and bigrams back into the mix.
جاء أهم ابتكار في المقاييس بين BLEU والعصر العصبي من Maja Popović. يقيس **chrF** (character F-score) التداخل على مستوى *الحرف* بدلاً من مستوى الكلمة، ويحسب دقة واستدعاء n-gram للحروف. يضيف **chrF++** الكلمات الأحادية والثنائية (unigrams and bigrams) على مستوى الكلمة مرة أخرى إلى المزيج.

Why this matters for morphologically rich languages: character-level matching gives *partial credit* for shared morphemes. The Cree words *nikî-nipâw* ("I slept") and *kikî-nipâw* ("you slept") share most of their character n-grams despite being different words. chrF would give substantial partial credit; BLEU would give zero.
لماذا يهم هذا بالنسبة للغات الغنية صرفياً: تمنح المطابقة على مستوى الحرف *رصيداً جزئياً* للمورفيمات المشتركة. تشترك كلمتا Cree *nikî-nipâw* ("نمت") و *kikî-nipâw* ("نمتَ") في معظم n-grams الحروف الخاصة بهما على الرغم من كونهما كلمتين مختلفتين. سيعطي chrF رصيداً جزئياً كبيراً؛ بينما سيعطي BLEU صفراً.

chrF++ has become a standard secondary metric at WMT shared tasks, implemented in **sacreBLEU** (Post, 2018), and is widely acknowledged as superior to BLEU for morphologically rich languages. But it remains a string-matching metric — better than BLEU, but fundamentally limited by the same assumption that translation quality can be measured by surface-form overlap.
أصبح chrF++ مقياساً ثانوياً قياسياً في مهام WMT المشتركة، وتم تنفيذه في **sacreBLEU** (Post, 2018)، ويُعترف به على نطاق واسع على أنه متفوق على BLEU بالنسبة للغات الغنية صرفياً. ولكنه يظل مقياساً لمطابقة السلاسل النصية — أفضل من BLEU، ولكنه محدود بشكل أساسي بنفس الافتراض القائل بأنه يمكن قياس جودة الترجمة من خلال تداخل الشكل السطحي.

---

## Part 2: The Neural Metric Revolution (2018–Present)
## الجزء الثاني: ثورة المقاييس العصبية (2018–الحاضر)



### The Insight: Learn to Score
### الرؤية: تعلم كيفية التقييم

The string-matching metrics of Part 1 share a fundamental design choice: they are hand-crafted formulas. Someone decided that n-gram precision, character overlap, or edit distance was a good proxy for translation quality, and then everyone used that formula for a decade.
تشترك مقاييس مطابقة السلاسل النصية في الجزء الأول في خيار تصميم أساسي: إنها صيغ مصممة يدوياً. قرر شخص ما أن دقة n-gram، أو تداخل الحروف، أو مسافة التحرير كانت وكيلاً جيداً لجودة الترجمة، ثم استخدم الجميع تلك الصيغة لمدة عقد من الزمن.

The neural metric revolution began with a different question: *what if we trained a model to predict translation quality, the same way we train models to translate?*
بدأت ثورة المقاييس العصبية بسؤال مختلف: *ماذا لو قمنا بتدريب نموذج للتنبؤ بجودة الترجمة، بنفس الطريقة التي ندرب بها النماذج على الترجمة؟*

### BERTScore (Zhang et al., 2020)
### BERTScore (Zhang et al., 2020)

BERTScore, published at ICLR 2020 by Tianyi Zhang and colleagues at Cornell and MIT, was the first widely-adopted metric to move evaluation from exact string matching to semantic similarity. The mechanism is elegant: encode both the hypothesis and reference through a pre-trained Transformer model (BERT, RoBERTa, or DeBERTa), compute the cosine similarity between every pair of token embeddings, and then use greedy matching to compute precision (each hypothesis token's best match in the reference), recall (each reference token's best match in the hypothesis), and F1.
كان BERTScore، الذي نُشر في مؤتمر ICLR 2020 بواسطة Tianyi Zhang وزملائه في جامعتي كورنيل ومعهد ماساتشوستس للتكنولوجيا (MIT)، أول مقياس معتمد على نطاق واسع لنقل التقييم من المطابقة الدقيقة للسلاسل النصية إلى التشابه الدلالي. الآلية أنيقة: تشفير كل من الفرضية والمرجع من خلال نموذج Transformer مدرب مسبقاً (BERT أو RoBERTa أو DeBERTa)، وحساب تشابه جيب التمام (cosine similarity) بين كل زوج من تضمينات الرموز (token embeddings)، ثم استخدام المطابقة الجشعة (greedy matching) لحساب الدقة (أفضل تطابق لكل رمز فرضية في المرجع)، والاستدعاء (أفضل تطابق لكل رمز مرجعي في الفرضية)، و F1.

BERTScore handles synonyms, paraphrases, and word-order variations naturally — "the feline rested on the rug" gets high similarity to "the cat sat on the mat" because the contextual embeddings capture semantic equivalence. With multilingual BERT, it extends to any language the model covers.
يتعامل BERTScore مع المرادفات وإعادة الصياغة واختلافات ترتيب الكلمات بشكل طبيعي — تحصل جملة "the feline rested on the rug" على تشابه كبير مع "the cat sat on the mat" لأن التضمينات السياقية تلتقط التكافؤ الدلالي. ومع نموذج BERT متعدد اللغات، يمتد ليشمل أي لغة يغطيها النموذج.

But BERTScore is not *trained* on human quality judgments. It uses pre-trained embeddings as-is, which means it captures general semantic similarity rather than specifically learning what makes a *translation* good. This distinction matters: a sentence can be semantically similar to a reference while being a poor translation (wrong register, omitted negation, hallucinated qualifier). BERTScore also inherits whatever language biases exist in the underlying model — for languages underrepresented in BERT's training data, the embeddings may not capture meaningful distinctions.
لكن BERTScore غير *مدرب* على تقييمات الجودة البشرية. فهو يستخدم التضمينات المدربة مسبقاً كما هي، مما يعني أنه يلتقط التشابه الدلالي العام بدلاً من تعلم ما يجعل *الترجمة* جيدة على وجه التحديد. هذا التمييز مهم: يمكن أن تكون الجملة مشابهة دلالياً لمرجع بينما تكون ترجمة سيئة (سجل لغوي خاطئ، نفي محذوف، مُقيِّد مهلوس). يرث BERTScore أيضاً أي تحيزات لغوية موجودة في النموذج الأساسي — بالنسبة للغات غير الممثلة بشكل كافٍ في بيانات تدريب BERT، قد لا تلتقط التضمينات تمييزات ذات مغزى.

### BLEURT (Sellam et al., 2020)
### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), published at ACL 2020 by Thibault Sellam, Dipanjan Das, and Ankur Parikh at Google, introduced a key innovation: **pre-training on synthetic perturbations** before fine-tuning on human judgments. The insight was that fine-tuning a language model directly on the small WMT human judgment datasets produced a metric that was brittle — it overfit to the specific patterns in the training data and failed on out-of-distribution inputs.
قدم BLEURT (Bilingual Evaluation Understudy with Representations from Transformers)، الذي نُشر في مؤتمر ACL 2020 بواسطة Thibault Sellam و Dipanjan Das و Ankur Parikh في Google، ابتكاراً رئيسياً: **التدريب المسبق على الاضطرابات الاصطناعية** قبل الضبط الدقيق على التقييمات البشرية. كانت الرؤية هي أن الضبط الدقيق لنموذج لغوي مباشرة على مجموعات بيانات التقييم البشري الصغيرة الخاصة بـ WMT أنتج مقياساً هشاً — فقد أفرط في التكيف (overfit) مع الأنماط المحددة في بيانات التدريب وفشل في المدخلات خارج التوزيع.

BLEURT's solution was a two-phase training recipe. In phase one, millions of synthetic sentence pairs were generated through random word drops, insertions, substitutions, and backtranslation. The model was trained to predict existing automatic metric scores (BLEU, ROUGE, BERTScore, entailment) for these pairs — learning general notions of textual similarity. In phase two, the pre-trained model was fine-tuned on WMT Direct Assessment ratings. This "warming up" dramatically improved robustness.
كان حل BLEURT عبارة عن وصفة تدريب من مرحلتين. في المرحلة الأولى، تم إنشاء ملايين من أزواج الجمل الاصطناعية من خلال إسقاط الكلمات العشوائية، والإدراج، والاستبدال، والترجمة العكسية. تم تدريب النموذج للتنبؤ بدرجات المقاييس الآلية الحالية (BLEU، ROUGE، BERTScore، الاستلزام) لهذه الأزواج — لتعلم المفاهيم العامة للتشابه النصي. في المرحلة الثانية، تم ضبط النموذج المدرب مسبقاً بدقة على تقييمات التقييم المباشر (Direct Assessment) الخاصة بـ WMT. أدى هذا "الإحماء" إلى تحسين المتانة بشكل كبير.

BLEURT-20 extended the approach to multilingual evaluation using Google's RemBERT encoder. But BLEURT remains reference-only — it doesn't use the source text, which means it cannot detect hallucinations that happen to be fluent, and it depends entirely on the reference's quality.
قام BLEURT-20 بتوسيع النهج ليشمل التقييم متعدد اللغات باستخدام مشفر RemBERT من Google. لكن BLEURT يظل معتمداً على المرجع فقط — فهو لا يستخدم النص المصدر، مما يعني أنه لا يمكنه اكتشاف الهلوسات التي تصادف أن تكون طليقة، ويعتمد كلياً على جودة المرجع.

### COMET (Rei et al., 2020)
### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) represents the current state of the art in automatic MT evaluation. Developed by Ricardo Rei and colleagues at **Unbabel**, COMET uses a cross-lingual encoder (XLM-RoBERTa) to embed three inputs — the source sentence, the MT hypothesis, and the reference translation — and predicts a quality score trained on human Direct Assessment judgments.
يمثل COMET (Crosslingual Optimized Metric for Evaluation of Translation) أحدث ما توصلت إليه التكنولوجيا الحالية في التقييم الآلي للترجمة الآلية. تم تطوير COMET بواسطة Ricardo Rei وزملائه في **Unbabel**، ويستخدم مشفراً عبر اللغات (XLM-RoBERTa) لتضمين ثلاثة مدخلات — الجملة المصدر، وفرضية الترجمة الآلية، والترجمة المرجعية — ويتنبأ بدرجة جودة مدربة على تقييمات التقييم المباشر البشرية.

COMET won or placed first in WMT Metrics Shared Tasks from 2020 onward. Its correlation with human judgment is substantially higher than any string-matching metric. It recognises paraphrases, captures meaning preservation, and handles synonym variation that BLEU misses entirely.
فاز COMET أو احتل المركز الأول في مهام WMT Metrics المشتركة من عام 2020 فصاعداً. ارتباطه بالتقييم البشري أعلى بكثير من أي مقياس لمطابقة السلاسل النصية. فهو يتعرف على إعادة الصياغة، ويلتقط الحفاظ على المعنى، ويتعامل مع تنوع المرادفات الذي يفتقده BLEU تماماً.

But COMET has a critical limitation for our purposes: it is trained on human judgments from WMT, which are overwhelmingly in European languages. Its cross-lingual encoder (XLM-R) was trained on CommonCrawl data where Plains Cree, North Sámi, and most indigenous languages are essentially absent. For these languages, COMET's internal representations are unreliable — it may produce scores, but those scores are not grounded in any real understanding of the language's structure.
لكن COMET لديه قيد حاسم لأغراضنا: فهو مدرب على التقييمات البشرية من WMT، والتي تكون بأغلبية ساحقة باللغات الأوروبية. تم تدريب مشفره عبر اللغات (XLM-R) على بيانات CommonCrawl حيث تغيب لغات Plains Cree و North Sámi ومعظم لغات السكان الأصليين بشكل أساسي. بالنسبة لهذه اللغات، فإن التمثيلات الداخلية لـ COMET غير موثوقة — فقد ينتج درجات، لكن هذه الدرجات لا تستند إلى أي فهم حقيقي لبنية اللغة.

### xCOMET (Guerreiro et al., 2024)
### xCOMET (Guerreiro et al., 2024)

xCOMET, published in TACL 2024 by Nuno Guerreiro, Ricardo Rei, and colleagues at Unbabel and Instituto Superior Técnico, extended COMET from a black-box scorer to a **diagnostic tool**. The key innovation is multi-task learning: alongside the sentence-level quality score, xCOMET performs **subword-level sequence tagging** to identify specific error spans in the translation and classify them as minor, major, or critical.
قام xCOMET، الذي نُشر في مجلة TACL عام 2024 بواسطة Nuno Guerreiro و Ricardo Rei وزملائهم في Unbabel و Instituto Superior Técnico، بتوسيع COMET من مقيِّم صندوق أسود إلى **أداة تشخيصية**. الابتكار الرئيسي هو التعلم متعدد المهام: إلى جانب درجة الجودة على مستوى الجملة، يقوم xCOMET بإجراء **وسم تسلسلي على مستوى الكلمة الفرعية** لتحديد نطاقات أخطاء محددة في الترجمة وتصنيفها على أنها طفيفة أو رئيسية أو حرجة.

This bridges the gap between automatic scoring and MQM-style human error analysis. Instead of just reporting "this translation scores 0.73," xCOMET can point to the specific words that are wrong and indicate how severely. The training uses a curriculum learning approach: first train on Direct Assessment data for sentence-level regression, then add MQM-annotated data with error span labels for joint training.
يسد هذا الفجوة بين التقييم الآلي وتحليل الأخطاء البشري بأسلوب MQM. فبدلاً من مجرد الإبلاغ عن "هذه الترجمة تسجل 0.73"، يمكن لـ xCOMET الإشارة إلى الكلمات المحددة الخاطئة والإشارة إلى مدى خطورتها. يستخدم التدريب نهج التعلم المنهجي (curriculum learning): التدريب أولاً على بيانات التقييم المباشر للانحدار على مستوى الجملة، ثم إضافة بيانات مشروحة بـ MQM مع تسميات نطاق الخطأ للتدريب المشترك.

xCOMET achieved state-of-the-art performance at sentence-level, system-level, and span-level evaluation simultaneously. It works in both reference-based and reference-free modes. But it requires MQM-annotated training data — which is expensive to create and exists overwhelmingly for European language pairs.
حقق xCOMET أداءً متطوراً في التقييم على مستوى الجملة، ومستوى النظام، ومستوى النطاق في وقت واحد. وهو يعمل في كلا الوضعين القائم على المرجع والخالي من المرجع. ولكنه يتطلب بيانات تدريب مشروحة بـ MQM — والتي يعد إنشاؤها مكلفاً وتوجد بأغلبية ساحقة لأزواج اللغات الأوروبية.

### AfriCOMET (Wang & Adelani, NAACL 2024)
### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, published at NAACL 2024 by Jiayi Wang, David Ifeoluwa Adelani, and colleagues in the Masakhane community, is the most important proof that neural metrics *must* be adapted for underserved languages — they do not generalise out of the box.
يعد AfriCOMET، الذي نُشر في مؤتمر NAACL 2024 بواسطة Jiayi Wang و David Ifeoluwa Adelani وزملائهم في مجتمع Masakhane، أهم دليل على أنه *يجب* تكييف المقاييس العصبية للغات المحرومة من الخدمات — فهي لا تُعمم بشكل جاهز.

The paper first demonstrated the problem: standard COMET, trained on WMT data from European languages, showed significantly weaker correlation with human judgments when applied to 13 African languages (including Amharic, Hausa, Igbo, Swahili, Yoruba, and Zulu). The fix required two changes. First, replacing XLM-R with **AfroXLM-R**, a cross-lingual encoder specifically trained to better represent African languages. Second, creating **AfriMTE**, a new human evaluation dataset with simplified MQM guidelines designed for non-expert annotators — because finding bilingual professional translators for these languages is difficult.
أوضحت الورقة البحثية المشكلة أولاً: أظهر COMET القياسي، المدرب على بيانات WMT من اللغات الأوروبية، ارتباطاً أضعف بكثير بالتقييمات البشرية عند تطبيقه على 13 لغة أفريقية (بما في ذلك الأمهرية، والهوسا، والإيغبو، والسواحيلية، واليوروبا، والزولو). تطلب الإصلاح تغييرين. أولاً، استبدال XLM-R بـ **AfroXLM-R**، وهو مشفر عبر اللغات تم تدريبه خصيصاً لتمثيل اللغات الأفريقية بشكل أفضل. ثانياً، إنشاء **AfriMTE**، وهي مجموعة بيانات تقييم بشري جديدة مع إرشادات MQM مبسطة مصممة للمشرحين غير الخبراء — لأن العثور على مترجمين محترفين ثنائيي اللغة لهذه اللغات أمر صعب.

AfriCOMET proved the concept: a language-family-specific neural metric can dramatically outperform the generic version. But it also proved the cost: someone had to build AfroXLM-R, collect human judgment data for 13 languages, and train a new model. For Plains Cree, no equivalent encoder, human judgment dataset, or adapted metric exists. The AfriCOMET path would require creating all of these from scratch — a multi-year effort involving community-based human evaluation and probably a dedicated Algonquian-family encoder.
أثبت AfriCOMET المفهوم: يمكن لمقياس عصبي خاص بعائلة لغوية أن يتفوق بشكل كبير على الإصدار العام. ولكنه أثبت أيضاً التكلفة: كان على شخص ما بناء AfroXLM-R، وجمع بيانات التقييم البشري لـ 13 لغة، وتدريب نموذج جديد. بالنسبة للغة Plains Cree، لا يوجد مشفر مكافئ، أو مجموعة بيانات تقييم بشري، أو مقياس مكيف. سيتطلب مسار AfriCOMET إنشاء كل هذه الأشياء من الصفر — وهو جهد يستغرق عدة سنوات يتضمن تقييماً بشرياً مجتمعياً وربما مشفراً مخصصاً لعائلة اللغات الألغونكوية (Algonquian).

### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)
### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), published at EAMT 2023 by Tom Kocmi and Christian Federmann at Microsoft, asked a radical question: what if you just *asked* GPT-4 whether a translation was good?
طرح GEMBA (GPT Estimation Metric Based Assessment)، الذي نُشر في مؤتمر EAMT 2023 بواسطة Tom Kocmi و Christian Federmann في Microsoft، سؤالاً جذرياً: ماذا لو *سألت* GPT-4 ببساطة عما إذا كانت الترجمة جيدة؟

The approach is disarmingly simple. **GEMBA-DA** prompts the LLM with the source and hypothesis and asks for a quality rating on a 0–100 scale. **GEMBA-MQM** provides three annotated examples and asks the LLM to identify specific error spans, classify them by type and severity, and produce an MQM-style score. No metric-specific training is required.
النهج بسيط بشكل مذهل. يطالب **GEMBA-DA** النموذج اللغوي الكبير (LLM) بالمصدر والفرضية ويطلب تقييماً للجودة على مقياس من 0 إلى 100. يوفر **GEMBA-MQM** ثلاثة أمثلة مشروحة ويطلب من النموذج اللغوي الكبير تحديد نطاقات أخطاء محددة، وتصنيفها حسب النوع والخطورة، وإنتاج درجة بأسلوب MQM. لا يلزم أي تدريب خاص بالمقياس.

The results were striking: at the system level, GEMBA achieved competitive or state-of-the-art correlation with human judgments. GEMBA-MQM's error annotations, while not as reliable as human annotators, provided interpretable diagnostic information without any specialised training.
كانت النتائج مذهلة: على مستوى النظام، حقق GEMBA ارتباطاً تنافسياً أو متطوراً مع التقييمات البشرية. قدمت شروح أخطاء GEMBA-MQM، على الرغم من أنها ليست موثوقة مثل المشرحين البشريين، معلومات تشخيصية قابلة للتفسير دون أي تدريب متخصص.

But GEMBA raises serious concerns. It depends on proprietary closed-source models whose behaviour changes between API versions. Results are not reproducible in the strict sense. It is expensive at scale (API costs for evaluating a full WMT test set). And — critically for our purposes — the LLM's knowledge of low-resource languages is uncertain. GPT-4 may or may not understand Plains Cree morphology well enough to evaluate translations; there is no way to know without testing, and no guarantee the behaviour will be consistent across model updates. Kocmi and Federmann themselves advised against using GEMBA to claim improvements in academic papers due to the black-box nature of the evaluation.
لكن GEMBA يثير مخاوف جدية. فهو يعتمد على نماذج مغلقة المصدر ومملوكة لشركات يتغير سلوكها بين إصدارات واجهة برمجة التطبيقات (API). النتائج غير قابلة للتكرار بالمعنى الدقيق للكلمة. وهو مكلف على نطاق واسع (تكاليف واجهة برمجة التطبيقات لتقييم مجموعة اختبار WMT كاملة). و— بشكل حاسم لأغراضنا — فإن معرفة النموذج اللغوي الكبير باللغات ذات الموارد المنخفضة غير مؤكدة. قد يفهم GPT-4 أو لا يفهم صرف لغة Plains Cree جيداً بما يكفي لتقييم الترجمات؛ لا توجد طريقة لمعرفة ذلك دون اختبار، ولا يوجد ضمان بأن السلوك سيكون متسقاً عبر تحديثات النموذج. نصح Kocmi و Federmann أنفسهم بعدم استخدام GEMBA لادعاء تحسينات في الأوراق الأكاديمية بسبب طبيعة الصندوق الأسود للتقييم.

### MetricX and the WMT 2024 Metrics Shared Task
### MetricX ومهمة WMT 2024 Metrics المشتركة

**MetricX-24**, developed by Juraj Juraska, Daniel Deutsch, Mara Finkelstein, and Markus Freitag at Google, won the WMT 2024 Metrics Shared Task. Built on **mT5** (Multilingual T5, an encoder-decoder model rather than the encoder-only XLM-R used by COMET), MetricX takes a different architectural path. It uses two-stage fine-tuning — first on Direct Assessment data, then on MQM scores — with extensive **synthetic data augmentation** targeting known metric failure modes (undertranslation, fluent-but-wrong translations, hallucinations).
فاز **MetricX-24**، الذي طوره Juraj Juraska و Daniel Deutsch و Mara Finkelstein و Markus Freitag في Google، بمهمة WMT 2024 Metrics المشتركة. مبنياً على **mT5** (Multilingual T5، وهو نموذج مشفر-مفكك تشفير بدلاً من XLM-R الذي يعتمد على المشفر فقط والمستخدم بواسطة COMET)، يتخذ MetricX مساراً معمارياً مختلفاً. فهو يستخدم ضبطاً دقيقاً على مرحلتين — أولاً على بيانات التقييم المباشر، ثم على درجات MQM — مع **زيادة بيانات اصطناعية** مكثفة تستهدف أوضاع فشل المقاييس المعروفة (الترجمة الناقصة، الترجمات الطليقة ولكن الخاطئة، الهلوسات).

The WMT 2024 findings paper, titled **"Are LLMs Breaking MT Metrics?"**, asked whether LLM-generated translations had broken the metric ecosystem. The answer was a qualified no: fine-tuned neural metrics (MetricX-24, COMET variants) remained effective, though LLM-based metrics (GEMBA variants) showed surprising strength at the system level. Key findings:
طرحت ورقة نتائج WMT 2024، بعنوان **"Are LLMs Breaking MT Metrics?"**، سؤالاً عما إذا كانت الترجمات التي تم إنشاؤها بواسطة النماذج اللغوية الكبيرة قد كسرت النظام البيئي للمقاييس. كانت الإجابة لا مشروطة: ظلت المقاييس العصبية المضبوطة بدقة (MetricX-24، ومتغيرات COMET) فعالة، على الرغم من أن المقاييس القائمة على النماذج اللغوية الكبيرة (متغيرات GEMBA) أظهرت قوة مفاجئة على مستوى النظام. النتائج الرئيسية:

- **Source-aware metrics** (using source + reference + hypothesis) consistently outperformed reference-only metrics
- **Hybrid models** that operate in both reference-based and reference-free modes from a single architecture are the emerging direction
- The **low-resource gap** persists: all metrics perform worse on underrepresented languages, and the gap is not narrowing
- **MQM-trained metrics** (using fine-grained error annotations) consistently outperform DA-trained metrics (using scalar scores)
- **المقاييس المدركة للمصدر** (باستخدام المصدر + المرجع + الفرضية) تفوقت باستمرار على المقاييس المعتمدة على المرجع فقط
- **النماذج الهجينة** التي تعمل في كلا الوضعين القائم على المرجع والخالي من المرجع من بنية واحدة هي الاتجاه الناشئ
- **فجوة الموارد المنخفضة** مستمرة: أداء جميع المقاييس أسوأ في اللغات غير الممثلة بشكل كافٍ، والفجوة لا تضيق
- **المقاييس المدربة على MQM** (باستخدام شروح أخطاء دقيقة) تتفوق باستمرار على المقاييس المدربة على التقييم المباشر (باستخدام درجات عددية)

The implications for low-resource evaluation are clear: the field is converging on large, trained, source-aware neural metrics as the gold standard. These metrics require substantial training data, compute, and — critically — human evaluation data in the target language. For languages without any of these resources, the state-of-the-art metric pipeline simply does not apply.
الآثار المترتبة على تقييم الموارد المنخفضة واضحة: يتقارب المجال نحو مقاييس عصبية كبيرة ومدربة ومدركة للمصدر كمعيار ذهبي. تتطلب هذه المقاييس بيانات تدريب كبيرة، وقدرة حاسوبية، و— بشكل حاسم — بيانات تقييم بشري في اللغة الهدف. بالنسبة للغات التي لا تمتلك أياً من هذه الموارد، فإن مسار المقاييس المتطور لا ينطبق ببساطة.

### The Bias Problem: Neural Metrics and Low-Resource Languages
### مشكلة التحيز: المقاييس العصبية واللغات ذات الموارد المنخفضة

The neural metric revolution has been, overwhelmingly, a high-resource phenomenon. Every trained metric in the preceding sections was trained on WMT human judgment data, which covers approximately 20 language pairs — all of them involving European languages, Chinese, or Japanese. The underlying encoders (XLM-R, mT5, InfoXLM) were trained on CommonCrawl data where representation is proportional to web presence: English dominates, European languages are well-covered, and the vast majority of the world's 7,000+ languages are effectively absent.
كانت ثورة المقاييس العصبية، بأغلبية ساحقة، ظاهرة ذات موارد عالية. تم تدريب كل مقياس مدرب في الأقسام السابقة على بيانات التقييم البشري الخاصة بـ WMT، والتي تغطي ما يقرب من 20 زوجاً لغوياً — جميعها تتضمن لغات أوروبية أو صينية أو يابانية. تم تدريب المشفرات الأساسية (XLM-R، mT5، InfoXLM) على بيانات CommonCrawl حيث يتناسب التمثيل مع التواجد على الويب: تهيمن اللغة الإنجليزية، واللغات الأوروبية مغطاة جيداً، والغالبية العظمى من لغات العالم التي يزيد عددها عن 7000 لغة غائبة فعلياً.

For a language like Plains Cree, this creates a cascading failure:
بالنسبة للغة مثل Plains Cree، يؤدي هذا إلى فشل متسلسل:

1. **No training data**: There are no WMT human judgments for Cree translations, so no metric has been trained to evaluate them.
2. **No encoder coverage**: XLM-R's vocabulary was built on CommonCrawl, where Cree text is vanishingly rare. The tokeniser over-segments Cree words into arbitrary byte fragments, and the contextual embeddings for those fragments are poorly trained.
3. **No validation**: Nobody has measured whether COMET, BLEURT, or MetricX produces meaningful scores for Cree. They may produce *numbers*, but there is no evidence those numbers correlate with actual translation quality.
4. **No path to improvement**: The AfriCOMET approach — build a language-family-specific encoder, collect human evaluation data, train a new metric — is a multi-year, multi-institution effort. For a language community of 20,000 speakers, the research infrastructure to support this does not currently exist.
1. **لا توجد بيانات تدريب**: لا توجد تقييمات بشرية من WMT لترجمات Cree، لذلك لم يتم تدريب أي مقياس لتقييمها.
2. **لا توجد تغطية للمشفر**: تم بناء مفردات XLM-R على CommonCrawl، حيث نصوص Cree نادرة جداً. يقوم المجزئ (tokeniser) بتقسيم كلمات Cree بشكل مفرط إلى أجزاء بايت عشوائية، والتضمينات السياقية لتلك الأجزاء مدربة بشكل سيئ.
3. **لا يوجد تحقق**: لم يقم أحد بقياس ما إذا كان COMET أو BLEURT أو MetricX ينتج درجات ذات مغزى للغة Cree. قد تنتج *أرقاماً*، ولكن لا يوجد دليل على أن هذه الأرقام ترتبط بجودة الترجمة الفعلية.
4. **لا يوجد مسار للتحسين**: نهج AfriCOMET — بناء مشفر خاص بعائلة لغوية، وجمع بيانات التقييم البشري، وتدريب مقياس جديد — هو جهد يستغرق عدة سنوات ومتعدد المؤسسات. بالنسبة لمجتمع لغوي يضم 20,000 متحدث، فإن البنية التحتية البحثية لدعم هذا غير موجودة حالياً.

The result is a paradox: the languages that need MT evaluation most urgently (because their MT systems are weakest and need the most careful assessment) are precisely the languages where the best evaluation tools are least reliable. The field's response has been to recommend chrF++ as a "good enough" alternative — and it is better than BLEU — but chrF++ is still a string-matching metric that cannot detect equivalence, cannot handle free word order, and has no concept of morphological validity.
والنتيجة هي مفارقة: اللغات التي تحتاج إلى تقييم الترجمة الآلية بشكل أكثر إلحاحاً (لأن أنظمة الترجمة الآلية الخاصة بها هي الأضعف وتحتاج إلى التقييم الأكثر دقة) هي بالضبط اللغات التي تكون فيها أفضل أدوات التقييم أقل موثوقية. كانت استجابة المجال هي التوصية بـ chrF++ كبديل "جيد بما فيه الكفاية" — وهو أفضل من BLEU — لكن chrF++ لا يزال مقياساً لمطابقة السلاسل النصية لا يمكنه اكتشاف التكافؤ، ولا يمكنه التعامل مع الترتيب الحر للكلمات، وليس لديه أي مفهوم للصلاحية الصرفية.

---

## Part 3: Beyond Scoring — Diagnostic and Linguistic Evaluation
## الجزء الثالث: ما وراء التقييم — التقييم التشخيصي واللغوي

### The Adequacy/Fluency Split
### انقسام الكفاية/الطلاقة

Before automatic metrics existed, human evaluation of MT used a framework with two dimensions: **adequacy** (does the translation convey the meaning of the source?) and **fluency** (is the translation grammatical and natural in the target language?). This distinction, codified in early DARPA MT evaluations and later at NIST, acknowledged something that automatic metrics would spend two decades trying to recapture: translation quality is not one-dimensional.
قبل وجود المقاييس الآلية، استخدم التقييم البشري للترجمة الآلية إطار عمل ببعدين: **الكفاية** (هل تنقل الترجمة معنى المصدر؟) و **الطلاقة** (هل الترجمة صحيحة نحوياً وطبيعية في اللغة الهدف؟). هذا التمييز، الذي تم تدوينه في تقييمات DARPA المبكرة للترجمة الآلية ولاحقاً في NIST، أقر بشيء ستقضي المقاييس الآلية عقدين من الزمن في محاولة استعادته: جودة الترجمة ليست أحادية البعد.

The adequacy/fluency framework fell out of favor when Direct Assessment (a single scalar score) replaced it at WMT. But the underlying insight remains critical: a translation can be fluent but wrong (hallucination), or disfluent but correct (morphological variant). No single score captures both.
فقد إطار عمل الكفاية/الطلاقة حظوته عندما حل محله التقييم المباشر (درجة عددية واحدة) في WMT. لكن الرؤية الأساسية تظل حاسمة: يمكن أن تكون الترجمة طليقة ولكنها خاطئة (هلوسة)، أو غير طليقة ولكنها صحيحة (متغير صرفي). لا توجد درجة واحدة تلتقط كليهما.

### MQM: The Gold Standard (Lommel et al., 2014; Freitag et al., 2021)
### MQM: المعيار الذهبي (Lommel et al., 2014; Freitag et al., 2021)

**Multidimensional Quality Metrics (MQM)** replaced Direct Assessment as WMT's primary human evaluation from 2021 onward. MQM uses professional translators who mark specific error spans, classify them by type (mistranslation, omission, addition, grammar, terminology) and severity (minor = 1 point, major = 5 points, critical = 25 points). This produces both a quality score and actionable diagnostic information.
حلت **مقاييس الجودة متعددة الأبعاد (MQM)** محل التقييم المباشر كتقييم بشري أساسي في WMT من عام 2021 فصاعداً. يستخدم MQM مترجمين محترفين يحددون نطاقات أخطاء محددة، ويصنفونها حسب النوع (خطأ في الترجمة، حذف، إضافة، قواعد، مصطلحات) والخطورة (طفيف = نقطة واحدة، رئيسي = 5 نقاط، حرج = 25 نقطة). ينتج عن هذا درجة جودة ومعلومات تشخيصية قابلة للتنفيذ.

MQM is the closest thing to a "correct" evaluation methodology — it tells you not just *how bad* a translation is, but *what specifically went wrong*. But it requires bilingual professional translators, which for most low-resource languages do not exist in sufficient numbers for statistically reliable evaluation.
يعد MQM أقرب شيء إلى منهجية تقييم "صحيحة" — فهو لا يخبرك فقط *بمدى سوء* الترجمة، بل *ما الخطأ الذي حدث تحديداً*. ولكنه يتطلب مترجمين محترفين ثنائيي اللغة، والذين لا يتوفرون بأعداد كافية لمعظم اللغات ذات الموارد المنخفضة لإجراء تقييم موثوق إحصائياً.

### MorphEval: Contrastive Morphological Evaluation (Burlot & Yvon, 2017)
### MorphEval: التقييم الصرفي التقابلي (Burlot & Yvon, 2017)

MorphEval is the most direct prior art for morphology-aware MT evaluation. Introduced by Franck Burlot and François Yvon at WMT 2017 and extended in 2018, MorphEval evaluates morphological *competence* using **contrastive test suites**.
يعد MorphEval الفن السابق الأكثر مباشرة لتقييم الترجمة الآلية المدرك للصرف. تم تقديم MorphEval بواسطة Franck Burlot و François Yvon في WMT 2017 وتم توسيعه في 2018، وهو يقيم *الكفاءة* الصرفية باستخدام **مجموعات اختبار تقابلية**.

**How it works:** The test suite consists of sentence pairs in the source language that differ by exactly one morphological contrast — for example, singular vs. plural, present vs. past, masculine vs. feminine. The MT system translates both sentences. If the system correctly conveys the contrast in its translations (e.g., producing a plural target when the source is plural and a singular target when the source is singular), the contrast is scored as correct.
**كيف يعمل:** تتكون مجموعة الاختبار من أزواج جمل في اللغة المصدر تختلف بتباين صرفي واحد بالضبط — على سبيل المثال، المفرد مقابل الجمع، الحاضر مقابل الماضي، المذكر مقابل المؤنث. يقوم نظام الترجمة الآلية بترجمة كلتا الجملتين. إذا نقل النظام التباين بشكل صحيح في ترجماته (على سبيل المثال، إنتاج هدف جمع عندما يكون المصدر جمعاً وهدف مفرد عندما يكون المصدر مفرداً)، يتم تسجيل التباين على أنه صحيح.

**Languages covered:** English→Czech, English→Latvian (v1, WMT 2017); extended to English→French, English→German, English→Finnish, Turkish→English (v2, WMT 2018).
**اللغات المغطاة:** الإنجليزية→التشيكية، الإنجليزية→اللاتفية (الإصدار 1، WMT 2017)؛ تم توسيعه ليشمل الإنجليزية→الفرنسية، الإنجليزية→الألمانية، الإنجليزية→الفنلندية، التركية→الإنجليزية (الإصدار 2، WMT 2018).

**Key findings:** MorphEval revealed that even top-performing neural MT systems had systematic morphological failures — they could produce fluent output while getting tense, number, or case wrong. These errors were invisible to BLEU and even partially invisible to COMET.
**النتائج الرئيسية:** كشف MorphEval أنه حتى أنظمة الترجمة الآلية العصبية الأفضل أداءً كانت تعاني من إخفاقات صرفية منهجية — فقد كانت قادرة على إنتاج مخرجات طليقة مع الخطأ في الزمن أو العدد أو الحالة. كانت هذه الأخطاء غير مرئية لـ BLEU وحتى غير مرئية جزئياً لـ COMET.

**Availability:** Open source on GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).
**التوفر:** مفتوح المصدر على GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval)، [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limitations:** MorphEval requires crafted contrastive test suites per target language, designed by linguists who understand the morphological contrasts of that language. No test suites exist for any polysynthetic language. The methodology tests for *competence* (can the system handle this contrast?) rather than *validity* (did the system produce real words?) or *equivalence* (are these two different translations both correct?).
**القيود:** يتطلب MorphEval مجموعات اختبار تقابلية مصممة لكل لغة هدف، ومصممة من قبل لغويين يفهمون التباينات الصرفية لتلك اللغة. لا توجد مجموعات اختبار لأي لغة متعددة التركيب. تختبر المنهجية *الكفاءة* (هل يمكن للنظام التعامل مع هذا التباين؟) بدلاً من *الصلاحية* (هل أنتج النظام كلمات حقيقية؟) أو *التكافؤ* (هل هاتان الترجمتان المختلفتان صحيحتان؟).

### CheckList: Behavioral Testing for NLP (Ribeiro et al., ACL 2020)
### CheckList: الاختبار السلوكي لمعالجة اللغات الطبيعية (Ribeiro et al., ACL 2020)

**CheckList**, published at ACL 2020 by Marco Tulio Ribeiro and colleagues (winning Best Paper), imported an idea from software engineering into NLP evaluation: **unit testing**. Rather than evaluating a model's aggregate performance on a benchmark, CheckList defines a matrix of **capabilities** (vocabulary, negation, named entities, temporal reasoning, coreference) crossed with **test types**:
استورد **CheckList**، الذي نُشر في مؤتمر ACL 2020 بواسطة Marco Tulio Ribeiro وزملائه (والذي فاز بجائزة أفضل ورقة بحثية)، فكرة من هندسة البرمجيات إلى تقييم معالجة اللغات الطبيعية (NLP): **اختبار الوحدة (unit testing)**. بدلاً من تقييم الأداء الإجمالي للنموذج على معيار قياسي، يحدد CheckList مصفوفة من **القدرات** (المفردات، النفي، الكيانات المسماة، الاستدلال الزمني، الإحالة المشتركة) متقاطعة مع **أنواع الاختبارات**:

- **Minimum Functionality Tests (MFT)**: Simple, targeted test cases that any competent model should pass.
- **Invariance Tests (INV)**: Perturbations to the input that should *not* change the output (e.g., changing a name shouldn't change sentiment).
- **Directional Expectation Tests (DIR)**: Perturbations that *should* change the output in a predictable direction.
- **اختبارات الحد الأدنى من الوظائف (MFT)**: حالات اختبار بسيطة ومستهدفة يجب أن يجتازها أي نموذج كفء.
- **اختبارات الثبات (INV)**: اضطرابات في المدخلات *لا ينبغي* أن تغير المخرجات (على سبيل المثال، تغيير الاسم لا ينبغي أن يغير المشاعر).
- **اختبارات التوقع الاتجاهي (DIR)**: اضطرابات *ينبغي* أن تغير المخرجات في اتجاه يمكن التنبؤ به.

Checklist was originally designed for sentiment analysis and NLI, but the paradigm is directly applicable to MT. One could create MFTs for morphological phenomena ("does the system produce the correct plural form?"), INV tests for free word order ("does reordering the Cree words change the English translation?"), and DIR tests for morphological features ("does changing the source from past to present tense change the target tense?").
تم تصميم Checklist في الأصل لتحليل المشاعر واستدلال اللغة الطبيعية (NLI)، ولكن النموذج قابل للتطبيق مباشرة على الترجمة الآلية. يمكن للمرء إنشاء اختبارات MFT للظواهر الصرفية ("هل ينتج النظام صيغة الجمع الصحيحة؟")، واختبارات INV للترتيب الحر للكلمات ("هل تؤدي إعادة ترتيب كلمات Cree إلى تغيير الترجمة الإنجليزية؟")، واختبارات DIR للسمات الصرفية ("هل يؤدي تغيير المصدر من الماضي إلى الحاضر إلى تغيير الزمن الهدف؟").

The CheckList paradigm is particularly relevant because it formalises what MorphEval does intuitively: test specific capabilities rather than measuring aggregate scores. Our linter's variant classes (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, etc.) are, in effect, invariance rules — they define perturbations that should not change the evaluation verdict.
يعد نموذج CheckList ذا صلة خاصة لأنه يضفي طابعاً رسمياً على ما يفعله MorphEval بشكل بديهي: اختبار قدرات محددة بدلاً من قياس الدرجات الإجمالية. إن فئات المتغيرات الخاصة بأداة الفحص (linter) لدينا (WORD_ORDER، ORTHOGRAPHIC، OPTIONAL_PARTICLE، إلخ) هي، في الواقع، قواعد ثبات — فهي تحدد الاضطرابات التي لا ينبغي أن تغير حكم التقييم.

### Challenge Sets and Targeted Evaluation
### مجموعات التحدي والتقييم المستهدف

The broader paradigm of **challenge sets** — crafted test suites targeting specific linguistic phenomena — has become an established complementary evaluation methodology at WMT since approximately 2017.
أصبح النموذج الأوسع لـ **مجموعات التحدي** — مجموعات اختبار مصممة تستهدف ظواهر لغوية محددة — منهجية تقييم تكميلية راسخة في WMT منذ عام 2017 تقريباً.

**Isabelle, Cherry & Foster (2017)**, at NRC Canada, pioneered the approach for MT with hand-crafted test sets isolating structural divergences between languages — cases where literal translation is likely incorrect. Their follow-up work (Isabelle & Kuhn, 2018) constructed 506 French sentences targeting specific translation challenges, providing fine-grained pictures of system capabilities.
كان **Isabelle, Cherry & Foster (2017)**، في المجلس الوطني للبحوث في كندا (NRC Canada)، رواداً في هذا النهج للترجمة الآلية من خلال مجموعات اختبار مصممة يدوياً تعزل الاختلافات الهيكلية بين اللغات — وهي الحالات التي من المحتمل أن تكون فيها الترجمة الحرفية غير صحيحة. قام عملهم اللاحق (Isabelle & Kuhn, 2018) ببناء 506 جملة فرنسية تستهدف تحديات ترجمة محددة، مما يوفر صوراً دقيقة لقدرات النظام.

**LingEval97** (Sennrich, EACL 2017) created 97,000 contrastive English→German translation pairs testing whether NMT models assign higher probability to correct translations versus pairs with introduced morphosyntactic errors. A key finding: character-level models excelled at transliteration but performed worse at long-distance morphosyntactic agreement.
أنشأ **LingEval97** (Sennrich, EACL 2017) 97,000 زوج ترجمة تقابلي من الإنجليزية→الألمانية لاختبار ما إذا كانت نماذج الترجمة الآلية العصبية (NMT) تعين احتمالاً أعلى للترجمات الصحيحة مقابل الأزواج التي تم إدخال أخطاء صرفية-نحوية فيها. نتيجة رئيسية: تفوقت النماذج على مستوى الحرف في النقحرة (transliteration) ولكن أداؤها كان أسوأ في التوافق الصرفي-النحوي بعيد المدى.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) scaled the challenge set approach dramatically: 36,476 examples spanning 146 language pairs testing 68 distinct linguistic phenomena. ACES was used to meta-evaluate metrics submitted to the WMT metrics shared task — testing whether *metrics* could detect the contrasts, not just whether *systems* could produce them. Extended to **SPAN-ACES** with error span annotations.
قام **ACES** (Amrhein, Moghe & Guillou, 2022–2023) بتوسيع نطاق نهج مجموعة التحدي بشكل كبير: 36,476 مثالاً يمتد عبر 146 زوجاً لغوياً لاختبار 68 ظاهرة لغوية متميزة. تم استخدام ACES للتقييم التلوي للمقاييس المقدمة إلى مهمة WMT metrics المشتركة — لاختبار ما إذا كانت *المقاييس* قادرة على اكتشاف التباينات، وليس فقط ما إذا كانت *الأنظمة* قادرة على إنتاجها. تم توسيعه إلى **SPAN-ACES** مع شروح نطاق الخطأ.

**MT-GenEval** (Currey et al., EMNLP 2022) and **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) target gender accuracy specifically. WinoMT is notable because it explicitly uses **morphological analysis** on the target language to verify the gender of translated occupations — one of the few cases where a morphological analyser is used as part of an MT evaluation tool.
يستهدف **MT-GenEval** (Currey et al., EMNLP 2022) و **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) دقة الجنس (gender accuracy) على وجه التحديد. يعد WinoMT جديراً بالملاحظة لأنه يستخدم صراحة **التحليل الصرفي** على اللغة الهدف للتحقق من جنس المهن المترجمة — وهي واحدة من الحالات القليلة التي يتم فيها استخدام محلل صرفي كجزء من أداة تقييم الترجمة الآلية.

**Hjerson** (Popović & Ney, 2011) is an open-source tool for automatic MT error classification that uses **lemmas and POS tags** to categorise errors into five types: morphological, reordering, missing words, extra words, and lexical errors. This is perhaps the closest prior art to our linter in spirit — it uses linguistic analysis to provide diagnostic error categories rather than a single score.
**Hjerson** (Popović & Ney, 2011) هي أداة مفتوحة المصدر للتصنيف الآلي لأخطاء الترجمة الآلية تستخدم **الكلمات الأساسية (lemmas) وعلامات أجزاء الكلام (POS tags)** لتصنيف الأخطاء إلى خمسة أنواع: صرفية، إعادة ترتيب، كلمات مفقودة، كلمات إضافية، وأخطاء معجمية. ربما يكون هذا هو الفن السابق الأقرب إلى أداة الفحص (linter) الخاصة بنا في الروح — فهو يستخدم التحليل اللغوي لتوفير فئات أخطاء تشخيصية بدلاً من درجة واحدة.

The common thread: the field has acknowledged, repeatedly, that aggregate scores are insufficient. Diagnostic evaluation provides the granularity needed to understand *why* a system fails. But diagnostic approaches require linguistic expertise per language, and that expertise is concentrated in European languages.
القاسم المشترك: لقد أقر المجال، مراراً وتكراراً، بأن الدرجات الإجمالية غير كافية. يوفر التقييم التشخيصي الدقة اللازمة لفهم *سبب* فشل النظام. لكن المناهج التشخيصية تتطلب خبرة لغوية لكل لغة، وتتركز هذه الخبرة في اللغات الأوروبية.

### AmericasNLP: Evaluation in the Trenches
### AmericasNLP: التقييم في الخنادق

The AmericasNLP workshop series (co-located with NAACL), focused on NLP for Indigenous languages of the Americas, provides the most direct comparison point for our evaluation challenges.
توفر سلسلة ورش عمل AmericasNLP (التي تقام بالتزامن مع NAACL)، والتي تركز على معالجة اللغات الطبيعية للغات السكان الأصليين في الأمريكتين، نقطة المقارنة الأكثر مباشرة لتحديات التقييم لدينا.

From 2021 through 2023, the shared task used **chrF** as its primary evaluation metric — chosen for its robustness in low-resource settings and its character-level matching, which provides partial credit for morphological overlap. The organisers acknowledged chrF's limitations but had no better alternative that could work across the diverse typologies represented (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri, and others).
من عام 2021 حتى عام 2023، استخدمت المهمة المشتركة **chrF** كمقياس تقييم أساسي لها — تم اختياره لمتانته في إعدادات الموارد المنخفضة ومطابقته على مستوى الحرف، مما يوفر رصيداً جزئياً للتداخل الصرفي. أقر المنظمون بقيود chrF ولكن لم يكن لديهم بديل أفضل يمكن أن يعمل عبر الأنماط المتنوعة الممثلة (الكتشوا، الغواراني، الأيمارا، الناواتل، الراراموري، وغيرها).

In 2025, AmericasNLP introduced a dedicated **Shared Task 3** specifically for developing MT evaluation metrics for Indigenous languages — the first time the field explicitly acknowledged that existing metrics are inadequate for these languages. The winning submission, **FUSE** (Feature-Union Scorer), combined multilingual sentence embeddings (fine-tuned LaBSE), lexical similarity, phonetic similarity, and fuzzy token matching via Ridge regression and Gradient Boosting. FUSE does not use morphological analysers — the feature engineering is language-agnostic.
في عام 2025، قدمت AmericasNLP **مهمة مشتركة 3 (Shared Task 3)** مخصصة لتطوير مقاييس تقييم الترجمة الآلية للغات السكان الأصليين — وهي المرة الأولى التي يقر فيها المجال صراحة بأن المقاييس الحالية غير كافية لهذه اللغات. جمع التقديم الفائز، **FUSE** (Feature-Union Scorer)، بين تضمينات الجمل متعددة اللغات (LaBSE المضبوط بدقة)، والتشابه المعجمي، والتشابه الصوتي، والمطابقة الضبابية للرموز عبر انحدار Ridge و Gradient Boosting. لا يستخدم FUSE المحللات الصرفية — فهندسة الميزات مستقلة عن اللغة.

This is the gap our work occupies. AmericasNLP has identified the problem (standard metrics fail for Indigenous languages) and begun developing alternatives (FUSE). But none of the alternatives use the morphological knowledge that FSTs provide. The AmericasNLP community uses chrF++ because it is the best available generic option, while the GiellaLT community builds sophisticated morphological tools that never get plugged into MT evaluation. The two communities have not converged.
هذه هي الفجوة التي يشغلها عملنا. حددت AmericasNLP المشكلة (فشل المقاييس القياسية مع لغات السكان الأصليين) وبدأت في تطوير بدائل (FUSE). لكن أياً من البدائل لا يستخدم المعرفة الصرفية التي توفرها FSTs. يستخدم مجتمع AmericasNLP مقياس chrF++ لأنه أفضل خيار عام متاح، بينما يبني مجتمع GiellaLT أدوات صرفية متطورة لا يتم توصيلها أبداً بتقييم الترجمة الآلية. لم يتقارب المجتمعان.

---

## Part 4: Reference-Free Evaluation and Quality Estimation
## الجزء الرابع: التقييم الخالي من المرجع وتقدير الجودة

Some of the most important evaluation signals in our harness do not require reference translations at all. The FST validity check ("is this a real word?") needs only the MT output. The hallucination detector needs the source and hypothesis. The code-switching detector needs only the hypothesis and knowledge of the target language's script. Understanding where these fit in the broader landscape of reference-free evaluation is essential for positioning them correctly.
بعض أهم إشارات التقييم في نظامنا لا تتطلب ترجمات مرجعية على الإطلاق. يحتاج فحص صلاحية FST ("هل هذه كلمة حقيقية؟") فقط إلى مخرجات الترجمة الآلية. يحتاج كاشف الهلوسة إلى المصدر والفرضية. يحتاج كاشف التبديل اللغوي (code-switching) فقط إلى الفرضية ومعرفة النص المكتوب للغة الهدف. إن فهم أين تتناسب هذه الإشارات في المشهد الأوسع للتقييم الخالي من المرجع أمر ضروري لوضعها بشكل صحيح.

### The Quality Estimation Paradigm
### نموذج تقدير الجودة

**Quality Estimation (QE)** is the subfield of MT evaluation concerned with predicting translation quality *without* reference translations. It has been a dedicated shared task at WMT since 2012, motivated by the practical need to assess MT quality at deployment time — when you are translating new text and have no human reference to compare against.
**تقدير الجودة (QE)** هو الحقل الفرعي لتقييم الترجمة الآلية المعني بالتنبؤ بجودة الترجمة *بدون* ترجمات مرجعية. لقد كانت مهمة مشتركة مخصصة في WMT منذ عام 2012، بدافع الحاجة العملية لتقييم جودة الترجمة الآلية في وقت النشر — عندما تقوم بترجمة نص جديد وليس لديك مرجع بشري للمقارنة به.

The QE task has evolved through three generations. **Feature-based QE** (2012–2016) extracted hand-crafted features from the source and hypothesis — language model perplexity, word frequency, n-gram overlap with monolingual data — and trained classifiers to predict quality. **Neural QE** (2017–2021) replaced hand-crafted features with learned representations, typically using bilingual encoders. **Current QE** (2022–present) is dominated by COMET-based approaches, particularly **CometKiwi**.
تطورت مهمة تقدير الجودة (QE) عبر ثلاثة أجيال. استخرج **تقدير الجودة القائم على الميزات** (2012–2016) ميزات مصممة يدوياً من المصدر والفرضية — حيرة النموذج اللغوي (perplexity)، وتكرار الكلمات، وتداخل n-gram مع البيانات أحادية اللغة — ودرب مصنفات للتنبؤ بالجودة. استبدل **تقدير الجودة العصبي** (2017–2021) الميزات المصممة يدوياً بتمثيلات مكتسبة، عادةً باستخدام مشفرات ثنائية اللغة. يهيمن على **تقدير الجودة الحالي** (2022–الحاضر) المناهج القائمة على COMET، وخاصة **CometKiwi**.

### CometKiwi and Reference-Free COMET
### CometKiwi و COMET الخالي من المرجع

**CometKiwi** (Rei et al., WMT 2022), the reference-free variant of COMET, uses InfoXLM to encode the source sentence and MT hypothesis (without a reference) and predicts a quality score. It achieved state-of-the-art results in the WMT 2022 and 2023 QE shared tasks.
يستخدم **CometKiwi** (Rei et al., WMT 2022)، وهو متغير COMET الخالي من المرجع، InfoXLM لتشفير الجملة المصدر وفرضية الترجمة الآلية (بدون مرجع) ويتنبأ بدرجة الجودة. لقد حقق نتائج متطورة في مهام تقدير الجودة المشتركة لـ WMT لعامي 2022 و 2023.

The remarkable finding: reference-free CometKiwi approaches the correlation with human judgment achieved by reference-based COMET. This suggests that, for well-resourced languages, the source text contains nearly as much evaluation signal as the reference translation. But the same caveat applies: CometKiwi's encoder has minimal representation for low-resource languages, so its reference-free predictions for Cree or Sámi are unreliable.
النتيجة الرائعة: يقترب CometKiwi الخالي من المرجع من الارتباط بالتقييم البشري الذي حققه COMET القائم على المرجع. يشير هذا إلى أنه بالنسبة للغات ذات الموارد الجيدة، يحتوي النص المصدر على إشارة تقييم تقارب تقريباً الترجمة المرجعية. لكن نفس التحذير ينطبق: يحتوي مشفر CometKiwi على تمثيل ضئيل للغات ذات الموارد المنخفضة، لذا فإن تنبؤاته الخالية من المرجع للغة Cree أو Sámi غير موثوقة.

This is where our FST-based metrics offer something genuinely different. The FST validity check is a **deterministic, reference-free quality signal** that requires no trained model and no human judgment data. If the FST says a word is not a valid Cree word, that word is not a valid Cree word — with the caveat of false rejections for loanwords, neologisms, and proper nouns. This kind of hard, rule-based quality signal has no equivalent in the neural QE ecosystem.
هنا تقدم مقاييسنا القائمة على FST شيئاً مختلفاً حقاً. فحص صلاحية FST هو **إشارة جودة حتمية وخالية من المرجع** لا تتطلب أي نموذج مدرب ولا بيانات تقييم بشري. إذا قال FST أن الكلمة ليست كلمة Cree صالحة، فإن تلك الكلمة ليست كلمة Cree صالحة — مع التحذير من الرفض الخاطئ للكلمات المستعارة، والكلمات المحدثة، والأسماء العلم. هذا النوع من إشارات الجودة الصارمة والقائمة على القواعد ليس له مكافئ في النظام البيئي لتقدير الجودة العصبي.

### Hallucination Detection in MT
### اكتشاف الهلوسة في الترجمة الآلية

Hallucination in MT — fluent output that is completely unrelated to the source — is a serious failure mode, particularly in low-resource settings where models have insufficient training data to learn reliable source-target correspondences.
تعد الهلوسة في الترجمة الآلية — المخرجات الطليقة التي لا علاقة لها تماماً بالمصدر — وضع فشل خطير، لا سيما في إعدادات الموارد المنخفضة حيث لا تمتلك النماذج بيانات تدريب كافية لتعلم مراسلات موثوقة بين المصدر والهدف.

The academic state of the art in hallucination detection uses several approaches:
تستخدم أحدث التقنيات الأكاديمية في اكتشاف الهلوسة عدة مناهج:

- **Embedding-based detection**: Comparing source and hypothesis embeddings in a shared space (LASER, LaBSE) and flagging cases where similarity is below a threshold.
- **Probability-based detection**: Using the MT model's own confidence scores — hallucinations tend to have high output probability but low source-conditioned probability.
- **Contrastive perturbation**: Comparing the MT output for the real source against output for a perturbed or unrelated source; if the outputs are suspiciously similar, the model is ignoring the source.
- **LLM-as-judge**: Prompting an LLM to assess whether the translation is faithful to the source.
- **الاكتشاف القائم على التضمين**: مقارنة تضمينات المصدر والفرضية في مساحة مشتركة (LASER، LaBSE) والإبلاغ عن الحالات التي يكون فيها التشابه أقل من حد معين.
- **الاكتشاف القائم على الاحتمالية**: استخدام درجات الثقة الخاصة بنموذج الترجمة الآلية — تميل الهلوسات إلى أن يكون لها احتمال مخرجات مرتفع ولكن احتمال مشروط بالمصدر منخفض.
- **الاضطراب التقابلي**: مقارنة مخرجات الترجمة الآلية للمصدر الحقيقي مقابل المخرجات لمصدر مضطرب أو غير ذي صلة؛ إذا كانت المخرجات متشابهة بشكل مريب، فإن النموذج يتجاهل المصدر.
- **النموذج اللغوي الكبير كقاضٍ (LLM-as-judge)**: مطالبة نموذج لغوي كبير بتقييم ما إذا كانت الترجمة وفية للمصدر.

Our harness uses a **heuristic detection plugin** that combines four signals: length inflation (hypothesis much longer than expected), repetition (repeated phrases), entity mismatch (named entities in the source missing from the hypothesis), and source echo (hypothesis is too similar to the source text, suggesting untranslated copying). This is baseline-level compared to academic SOTA — it catches gross hallucinations but will miss subtle ones. Its value is as a **cheap, fast, reference-free screen** that can flag the worst failures without requiring a GPU or an API call.
يستخدم نظامنا **مكوناً إضافياً للاكتشاف الإرشادي (heuristic detection plugin)** يجمع بين أربع إشارات: تضخم الطول (الفرضية أطول بكثير من المتوقع)، والتكرار (العبارات المتكررة)، وعدم تطابق الكيانات (الكيانات المسماة في المصدر مفقودة من الفرضية)، وصدى المصدر (الفرضية مشابهة جداً للنص المصدر، مما يشير إلى نسخ غير مترجم). هذا على مستوى خط الأساس مقارنة بأحدث التقنيات الأكاديمية (SOTA) — فهو يكتشف الهلوسات الجسيمة ولكنه سيفوت الهلوسات الدقيقة. تكمن قيمته في كونه **شاشة رخيصة وسريعة وخالية من المرجع** يمكنها الإبلاغ عن أسوأ حالات الفشل دون الحاجة إلى وحدة معالجة رسومات (GPU) أو استدعاء واجهة برمجة تطبيقات (API).

### Code-Switching Detection
### اكتشاف التبديل اللغوي (Code-Switching)

Code-switching in MT output — where the system produces words in the source language rather than translating them — is a distinct failure mode from hallucination. It typically occurs when the model encounters a word it cannot translate and falls back to copying the source.
يعد التبديل اللغوي في مخرجات الترجمة الآلية — حيث ينتج النظام كلمات باللغة المصدر بدلاً من ترجمتها — وضع فشل متميز عن الهلوسة. يحدث هذا عادةً عندما يواجه النموذج كلمة لا يمكنه ترجمتها ويتراجع إلى نسخ المصدر.

Our code-switching detection plugin uses **Unicode block analysis** (detecting characters from the source language's script in what should be target-language output) and **common-word lists** (identifying high-frequency source-language words that appear untranslated). For Cree, which uses both SRO (Latin-based) and syllabics, this requires some care — English and SRO share the Latin script, so Unicode block analysis alone is insufficient.
يستخدم المكون الإضافي لاكتشاف التبديل اللغوي لدينا **تحليل كتلة Unicode** (اكتشاف أحرف من النص المكتوب للغة المصدر فيما يجب أن يكون مخرجات اللغة الهدف) و **قوائم الكلمات الشائعة** (تحديد كلمات اللغة المصدر عالية التردد التي تظهر غير مترجمة). بالنسبة للغة Cree، التي تستخدم كلاً من SRO (القائم على اللاتينية) والمقاطع (syllabics)، يتطلب هذا بعض العناية — تشترك الإنجليزية و SRO في النص اللاتيني، لذا فإن تحليل كتلة Unicode وحده غير كافٍ.

The academic literature on code-switching detection in MT is sparse compared to hallucination detection. Most work focuses on code-switching in *input* text (bilingual speakers mixing languages) rather than in *output* text (MT systems failing to translate). Our heuristic approach is, to our knowledge, not significantly behind any published state of the art for this specific problem.
الأدبيات الأكاديمية حول اكتشاف التبديل اللغوي في الترجمة الآلية متفرقة مقارنة باكتشاف الهلوسة. يركز معظم العمل على التبديل اللغوي في نص *المدخلات* (المتحدثون ثنائيو اللغة الذين يخلطون اللغات) بدلاً من نص *المخرجات* (أنظمة الترجمة الآلية التي تفشل في الترجمة). إن نهجنا الإرشادي، على حد علمنا، لا يتخلف بشكل كبير عن أي تقنية متطورة منشورة لهذه المشكلة المحددة.

---

## Part 5: The Morphological Gap
## الجزء الخامس: الفجوة الصرفية

### What Existing Metrics Cannot See
### ما لا تستطيع المقاييس الحالية رؤيته

This is the core argument of this paper, and it requires a concrete demonstration.
هذه هي الحجة الأساسية لهذه الورقة، وتتطلب عرضاً ملموساً.

Consider the Plains Cree sentence pair:
تأمل زوج الجمل في لغة Plains Cree:

| | Text |
|--|------|
| **Source (English)** | "I saw the man" |
| **Reference (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hypothesis A** | *nâpêw nikî-wâpamâw* |
| **Hypothesis B** | *nikî-wâpamikow nâpêsis* |
| | النص |
|--|------|
| **المصدر (الإنجليزية)** | "I saw the man" |
| **المرجع (Cree)** | *nikî-wâpamâw nâpêw* |
| **الفرضية أ** | *nâpêw nikî-wâpamâw* |
| **الفرضية ب** | *nikî-wâpamikow nâpêsis* |

**Hypothesis A** is a perfect translation — it has the same words in a different order, which is grammatical in Cree (free word order). **Hypothesis B** says "the boy was seen by me" — wrong direction of action (*-ikow* is inverse), wrong referent (*nâpêsis* = "boy", not "man").
**الفرضية أ** هي ترجمة مثالية — فهي تحتوي على نفس الكلمات بترتيب مختلف، وهو أمر صحيح نحوياً في لغة Cree (ترتيب حر للكلمات). **الفرضية ب** تقول "the boy was seen by me" — اتجاه فعل خاطئ (*-ikow* هو عكسي)، مرجع خاطئ (*nâpêsis* = "boy"، وليس "man").

| Metric | Hypothesis A (correct) | Hypothesis B (wrong) | Can it tell them apart? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Barely |
| chrF++ | ~65% | ~55% | Somewhat |
| COMET | Unknown (no Cree training data) | Unknown | Unreliable |
| **FST acceptance** | 100% | 100% | No (both are valid Cree) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Yes** |
| **Semantic validator** | VALID | WRONG | **Yes** |
| المقياس | الفرضية أ (صحيحة) | الفرضية ب (خاطئة) | هل يمكنه التمييز بينهما؟ |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | بالكاد |
| chrF++ | ~65% | ~55% | إلى حد ما |
| COMET | غير معروف (لا توجد بيانات تدريب لـ Cree) | غير معروف | غير موثوق |
| **قبول FST** | 100% | 100% | لا (كلاهما صالح في Cree) |
| **أداة الفحص (Linter)** | EQUIVALENT (WORD_ORDER) | MISS | **نعم** |
| **المدقق الدلالي** | VALID | WRONG | **نعم** |

The linter and semantic validator succeed where BLEU, chrF++, and COMET fail — not because they are "better metrics" in some universal sense, but because they have access to *linguistic knowledge* that string-matching and neural metrics do not. They know that Cree has free word order. They know that *wâpamêw* and *wâpamikow* are different lemmas with different argument structures. They know that *nâpêw* and *nâpêsis* are different words.
تنجح أداة الفحص والمدقق الدلالي حيث تفشل BLEU و chrF++ و COMET — ليس لأنها "مقاييس أفضل" بالمعنى العالمي، ولكن لأن لديها إمكانية الوصول إلى *المعرفة اللغوية* التي لا تمتلكها مقاييس مطابقة السلاسل النصية والمقاييس العصبية. إنها تعرف أن لغة Cree لديها ترتيب حر للكلمات. إنها تعرف أن *wâpamêw* و *wâpamikow* هما كلمتان أساسيتان مختلفتان بهياكل وسائط مختلفة. إنها تعرف أن *nâpêw* و *nâpêsis* هما كلمتان مختلفتان.

This knowledge comes from the FST (which encodes the morphological grammar), the bilingual dictionary (which provides English glosses for each lemma), and the manually-defined variant classes (which encode linguistically-grounded equivalence rules). None of this knowledge is available to a metric that treats the translation as a string.
تأتي هذه المعرفة من FST (الذي يشفر القواعد الصرفية)، والقاموس ثنائي اللغة (الذي يوفر شروحاً باللغة الإنجليزية لكل كلمة أساسية)، وفئات المتغيرات المحددة يدوياً (والتي تشفر قواعد التكافؤ القائمة على أسس لغوية). لا تتوفر أي من هذه المعرفة لمقياس يعامل الترجمة كسلسلة نصية.

### Why the Field Has Not Addressed This
### لماذا لم يعالج المجال هذا الأمر

The morphological gap in MT evaluation is not a mystery. The field knows it exists. The reasons it persists are structural:
الفجوة الصرفية في تقييم الترجمة الآلية ليست لغزاً. المجال يعرف بوجودها. أسباب استمرارها هيكلية:

1. **Scale bias.** The MT evaluation community optimises for metrics that work across all WMT language pairs. FST-based metrics work for ~30 languages. COMET works for 100+. chrF++ works for all languages with a writing system. The community rewards universality over precision.
1. **التحيز للحجم.** يعمل مجتمع تقييم الترجمة الآلية على التحسين من أجل المقاييس التي تعمل عبر جميع أزواج لغات WMT. تعمل المقاييس القائمة على FST لحوالي 30 لغة. يعمل COMET لأكثر من 100 لغة. يعمل chrF++ لجميع اللغات التي تحتوي على نظام كتابة. يكافئ المجتمع العالمية على الدقة.

2. **Community silos.** The people who build FSTs (computational linguists at UiT Tromsø, NRC Canada, University of Alberta) and the people who build evaluation metrics (ML researchers at Google, Unbabel, WMT) attend different conferences, publish in different venues, and operate under different incentive structures. The cross-pollination that would be required to build FST-based evaluation metrics has not happened — not because it was tried and failed, but because the communities never converged.
2. **صوامع المجتمع.** الأشخاص الذين يبنون FSTs (اللغويون الحاسوبيون في UiT Tromsø، و NRC Canada، وجامعة ألبرتا) والأشخاص الذين يبنون مقاييس التقييم (باحثو التعلم الآلي في Google، و Unbabel، و WMT) يحضرون مؤتمرات مختلفة، وينشرون في أماكن مختلفة، ويعملون في ظل هياكل حوافز مختلفة. التلقيح المتبادل الذي سيكون مطلوباً لبناء مقاييس تقييم قائمة على FST لم يحدث — ليس لأنه تمت تجربته وفشل، ولكن لأن المجتمعات لم تتقارب أبداً.

3. **Coverage anxiety.** FSTs have known false-rejection problems: loanwords, neologisms, and proper nouns may be rejected as invalid even when they are perfectly acceptable. This makes researchers nervous about using FSTs as metrics — a false rejection inflates the error rate. The concern is valid but quantifiable: measuring the false rejection rate on known-good text is straightforward.
3. **القلق بشأن التغطية.** تعاني FSTs من مشاكل رفض خاطئ معروفة: قد يتم رفض الكلمات المستعارة، والكلمات المحدثة، والأسماء العلم على أنها غير صالحة حتى عندما تكون مقبولة تماماً. هذا يجعل الباحثين متوترين بشأن استخدام FSTs كمقاييس — فالرفض الخاطئ يضخم معدل الخطأ. القلق صحيح ولكنه قابل للقياس: قياس معدل الرفض الخاطئ على نص معروف بأنه جيد هو أمر مباشر.

4. **Insufficient demand.** Very few people are building MT for polysynthetic languages, and the ones who are (ALT Lab, NRC, AmericasNLP participants) are typically using chrF++ because that is what exists. There has been no concerted push from the low-resource MT community for morphology-aware evaluation, partly because the community is small and partly because building such metrics requires expertise in both NLP engineering and the specific target language's morphology.
4. **الطلب غير الكافي.** عدد قليل جداً من الأشخاص يبنون ترجمة آلية للغات متعددة التركيب، وأولئك الذين يفعلون ذلك (ALT Lab، NRC، المشاركون في AmericasNLP) يستخدمون عادةً chrF++ لأن هذا هو الموجود. لم يكن هناك دفع منسق من مجتمع الترجمة الآلية ذات الموارد المنخفضة للتقييم المدرك للصرف، ويرجع ذلك جزئياً إلى أن المجتمع صغير وجزئياً لأن بناء مثل هذه المقاييس يتطلب خبرة في كل من هندسة معالجة اللغات الطبيعية (NLP) وصرف اللغة الهدف المحددة.

5. **The neural metric assumption.** The prevailing assumption since 2020 has been that neural metrics will eventually solve the morphological problem through learned representations. If you train COMET on enough data from morphologically rich languages, the argument goes, it will learn to handle morphological variation implicitly. This may be true for high-resource morphologically rich languages (Finnish, Turkish, Czech). It is unlikely to be true for languages with effectively zero representation in the training data.
5. **افتراض المقياس العصبي.** كان الافتراض السائد منذ عام 2020 هو أن المقاييس العصبية ستحل في النهاية المشكلة الصرفية من خلال التمثيلات المكتسبة. إذا قمت بتدريب COMET على بيانات كافية من لغات غنية صرفياً، كما تقول الحجة، فسوف يتعلم التعامل مع التباين الصرفي ضمنياً. قد يكون هذا صحيحاً بالنسبة للغات الغنية صرفياً ذات الموارد العالية (الفنلندية، التركية، التشيكية). ومن غير المرجح أن يكون صحيحاً بالنسبة للغات التي ليس لها تمثيل فعلي في بيانات التدريب.

---

## Part 6: LYSS — A Linguistically-Grounded Alternative
## الجزء السادس: LYSS — بديل قائم على أسس لغوية

### What champollion Built: LYSS (Linguistically-informed Yield & Structural Scoring)
### ما بناه Champollion: LYSS (Linguistically-informed Yield & Structural Scoring)

The champollion project's evaluation harness implements a composite scoring framework called **LYSS** that combines standard metrics (chrF++, exact match) with four categories of linguistically-informed metrics. The name reflects the framework's focus: measuring the *yield* (how much meaning survives the translation process) through *structural scoring* (deterministic, linguistically-grounded checks rather than learned embeddings).
ينفذ نظام التقييم الخاص بمشروع Champollion إطار عمل تقييم مركب يسمى **LYSS** يجمع بين المقاييس القياسية (chrF++، المطابقة التامة) مع أربع فئات من المقاييس المستنيرة لغوياً. يعكس الاسم تركيز إطار العمل: قياس *العائد (yield)* (مقدار المعنى الذي ينجو من عملية الترجمة) من خلال *التقييم الهيكلي (structural scoring)* (فحوصات حتمية قائمة على أسس لغوية بدلاً من التضمينات المكتسبة).

#### 1. Morphological Validity Gate (GiellaLT FST Metric)
#### 1. بوابة الصلاحية الصرفية (مقياس GiellaLT FST)

The simplest and most broadly applicable metric: feed every word of the MT output through the GiellaLT finite-state morphological analyser for the target language. If the FST can parse a word (returns at least one analysis), the word is morphologically valid. If not, the word does not exist in the target language — it is either a hallucinated word, a morphological error, a misspelling, or a loanword not in the lexicon.
المقياس الأبسط والأكثر قابلية للتطبيق على نطاق واسع: تمرير كل كلمة من مخرجات الترجمة الآلية عبر المحلل الصرفي ذي الحالة المحدودة GiellaLT للغة الهدف. إذا تمكن FST من تحليل كلمة (أرجع تحليلاً واحداً على الأقل)، فإن الكلمة صالحة صرفياً. إذا لم يكن الأمر كذلك، فإن الكلمة غير موجودة في اللغة الهدف — فهي إما كلمة مهلوسة، أو خطأ صرفي، أو خطأ إملائي، أو كلمة مستعارة غير موجودة في المعجم.

**Output:** `fst_validity_rate` (0.0–1.0, higher = better). Macro-average (mean of per-entry rates) and micro-average (total valid words / total words).
**المخرجات:** `fst_validity_rate` (0.0–1.0، أعلى = أفضل). المتوسط الكلي (متوسط المعدلات لكل إدخال) والمتوسط الجزئي (إجمالي الكلمات الصالحة / إجمالي الكلمات).

**Dependencies:** `pyhfst` (Helsinki Finite-State Technology Python bindings), a compiled `.hfstol` analyser file for the target language.
**التبعيات:** `pyhfst` (روابط Python لتقنية الحالة المحدودة في هلسنكي)، ملف محلل `.hfstol` مجمع للغة الهدف.

**Extensibility:** Works for any language with a GiellaLT FST analyser — currently ~30+ languages, primarily Sámi, Uralic, and indigenous Arctic languages.
**قابلية التوسعة:** يعمل مع أي لغة تحتوي على محلل GiellaLT FST — حالياً أكثر من 30 لغة، في المقام الأول لغات Sámi، واللغات الأورالية، ولغات السكان الأصليين في القطب الشمالي.

**Relation to prior art:** MorphEval tests whether a system can handle specific contrasts. The FST metric tests whether the system's output consists of real words. These are complementary: MorphEval tests competence, the FST metric tests validity.
**العلاقة بالفن السابق:** يختبر MorphEval ما إذا كان النظام يمكنه التعامل مع تباينات محددة. يختبر مقياس FST ما إذا كانت مخرجات النظام تتكون من كلمات حقيقية. هذان المقياسان متكاملان: يختبر MorphEval الكفاءة، ويختبر مقياس FST الصلاحية.

#### 2. Linguistic Equivalence Classes (CRK Linter)
#### 2. فئات التكافؤ اللغوي (CRK Linter)

The linter addresses what may be the most insidious failure mode of reference-based evaluation: **penalising correct translations that differ from the reference**.
تعالج أداة الفحص (linter) ما قد يكون وضع الفشل الأكثر غدراً للتقييم القائم على المرجع: **معاقبة الترجمات الصحيحة التي تختلف عن المرجع**.

The Plains Cree linter (844 lines) implements six **variant classes**, each encoding a linguistically-grounded equivalence rule:
تنفذ أداة فحص Plains Cree (844 سطراً) ست **فئات متغيرات**، تشفر كل منها قاعدة تكافؤ قائمة على أسس لغوية:

- **WORD_ORDER**: Cree has pragmatically free word order (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* and *nâpêw nikî-wâpamâw* mean the same thing. The linter generates all permutations and checks if the hypothesis matches any.
- **ORTHOGRAPHIC**: The Standard Roman Orthography has known variation points — circumflex vs. macron (*â* vs. *ā*), hyphenation of preverbs (*nikî-nipâw* vs. *nikî nipâw* vs. *nikînipâw*). The linter normalises these.
- **OPTIONAL_PARTICLE**: Certain discourse particles (*mâka*, *êkwa*, *êwako*) can be present or absent without changing the core proposition. The linter checks if the hypothesis matches the reference after particle removal.
- **LEMMA_SYNONYM**: Some Cree lemmas are interchangeable in specific contexts. This uses a curated synonym list (e.g., dialectal variants) and, when the FST is available, checks whether the hypothesis and reference share morphological analyses.
- **PROGRESSIVE_AMBIGUITY**: English progressive forms ("is walking") can be translated into Cree using different constructions. The linter recognises these as equivalent.
- **INCLUSIVE_EXCLUSIVE**: Cree distinguishes inclusive "we" (*ki-* prefix) from exclusive "we" (*ni-* prefix) — a distinction that English collapses into a single pronoun. The linter recognises that either form may be correct when the English source is ambiguous.
- **WORD_ORDER**: تتمتع لغة Cree بترتيب كلمات حر تداولياً (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* و *nâpêw nikî-wâpamâw* تعنيان نفس الشيء. تقوم أداة الفحص بإنشاء جميع التباديل وتتحقق مما إذا كانت الفرضية تتطابق مع أي منها.
- **ORTHOGRAPHIC**: يحتوي نظام الكتابة الروماني القياسي (Standard Roman Orthography) على نقاط تباين معروفة — علامة المد المنعطفة مقابل علامة المد المستقيمة (*â* مقابل *ā*)، ووصل الأفعال السابقة (*nikî-nipâw* مقابل *nikî nipâw* مقابل *nikînipâw*). تقوم أداة الفحص بتسوية هذه الاختلافات.
- **OPTIONAL_PARTICLE**: يمكن أن تكون بعض أدوات الخطاب (*mâka*، *êkwa*، *êwako*) موجودة أو غائبة دون تغيير الاقتراح الأساسي. تتحقق أداة الفحص مما إذا كانت الفرضية تتطابق مع المرجع بعد إزالة الأداة.
- **LEMMA_SYNONYM**: بعض الكلمات الأساسية في Cree قابلة للتبديل في سياقات محددة. يستخدم هذا قائمة مرادفات منسقة (على سبيل المثال، المتغيرات اللهجية) و، عندما يكون FST متاحاً، يتحقق مما إذا كانت الفرضية والمرجع يشتركان في التحليلات الصرفية.
- **PROGRESSIVE_AMBIGUITY**: يمكن ترجمة صيغ الاستمرار الإنجليزية ("is walking") إلى Cree باستخدام تراكيب مختلفة. تدرك أداة الفحص أن هذه التراكيب متكافئة.
- **INCLUSIVE_EXCLUSIVE**: تميز لغة Cree بين "نحن" الشاملة (سابقة *ki-*) و "نحن" الحصرية (سابقة *ni-*) — وهو تمييز تدمجه اللغة الإنجليزية في ضمير واحد. تدرك أداة الفحص أن أياً من الصيغتين قد تكون صحيحة عندما يكون المصدر الإنجليزي غامضاً.

The linter produces three verdicts: **EXACT** (hypothesis matches reference), **EQUIVALENT** (hypothesis differs but is classified as a valid variant), or **MISS** (no match found). At the aggregate level, it computes an `equivalent_match_rate` — the proportion of translations that are exact or equivalent.
تنتج أداة الفحص ثلاثة أحكام: **EXACT** (الفرضية تتطابق مع المرجع)، **EQUIVALENT** (الفرضية تختلف ولكنها مصنفة كمتغير صالح)، أو **MISS** (لم يتم العثور على تطابق). على المستوى الإجمالي، تحسب `equivalent_match_rate` — نسبة الترجمات الدقيقة أو المتكافئة.

**Relation to prior art:** The closest parallel is **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), which encodes exponentially many valid translations as paraphrase networks and measures edit distance to the nearest valid form. Our linter is conceptually similar — it defines a set of valid translations for each reference — but uses linguistically-defined transformation rules rather than paraphrase databases. HyTER was designed for English; no one has built paraphrase networks for Cree. Our variant classes are, in effect, a compact, rule-based approximation of what HyTER does with graphs.
**العلاقة بالفن السابق:** أقرب موازٍ هو **HyTER** (Dreyer & Marcu, NAACL-HLT 2012)، والذي يشفر عدداً هائلاً من الترجمات الصالحة كشبكات إعادة صياغة ويقيس مسافة التحرير إلى أقرب صيغة صالحة. أداة الفحص لدينا مشابهة من الناحية المفاهيمية — فهي تحدد مجموعة من الترجمات الصالحة لكل مرجع — ولكنها تستخدم قواعد تحويل محددة لغوياً بدلاً من قواعد بيانات إعادة الصياغة. تم تصميم HyTER للغة الإنجليزية؛ لم يقم أحد ببناء شبكات إعادة صياغة للغة Cree. إن فئات المتغيرات لدينا هي، في الواقع، تقريب مدمج وقائم على القواعد لما يفعله HyTER بالرسوم البيانية.

In the CheckList framework, our variant classes function as **invariance tests**: transformations that should not change the evaluation verdict. The difference is that CheckList tests are typically applied to the *model*; our variant rules are applied to the *metric*.
في إطار عمل CheckList، تعمل فئات المتغيرات لدينا كـ **اختبارات ثبات**: تحويلات لا ينبغي أن تغير حكم التقييم. الفرق هو أن اختبارات CheckList يتم تطبيقها عادةً على *النموذج*؛ بينما يتم تطبيق قواعد المتغيرات لدينا على *المقياس*.

#### 3. Deterministic Semantic Validation (CRK Semantic Metric)
#### 3. التحقق الدلالي الحتمي (مقياس CRK الدلالي)

The semantic validator (792 lines) attempts something more ambitious: **deterministic meaning comparison** without neural embeddings. It operates in four stages:
يحاول المدقق الدلالي (792 سطراً) شيئاً أكثر طموحاً: **مقارنة المعنى الحتمية** بدون تضمينات عصبية. وهو يعمل في أربع مراحل:

1. **Morphological analysis**: Both the hypothesis and reference are passed through the CRK FST analyser, which returns the lemma and morphological features for each word.
2. **Gloss resolution**: Each lemma is looked up via the itwêwina dictionary API — which serves Wolvengrey (2001) alongside the Maskwacîs and Alberta Elders' dictionaries — to obtain English glosses.
3. **Content-word extraction**: Using spaCy's English pipeline (`en_core_web_md`), function words are filtered from both the English glosses and the source text.
4. **Overlap scoring**: The content-word overlap between the hypothesis's glosses and the reference's glosses determines the semantic verdict.
1. **التحليل الصرفي**: يتم تمرير كل من الفرضية والمرجع عبر محلل CRK FST، والذي يُرجع الكلمة الأساسية والسمات الصرفية لكل كلمة.
2. **تحليل الشروح**: يتم البحث عن كل كلمة أساسية عبر واجهة برمجة تطبيقات قاموس itwêwina — والتي تخدم Wolvengrey (2001) إلى جانب قواميس Maskwacîs و Alberta Elders — للحصول على شروح باللغة الإنجليزية.
3. **استخراج كلمات المحتوى**: باستخدام مسار اللغة الإنجليزية الخاص بـ spaCy (`en_core_web_md`)، تتم تصفية الكلمات الوظيفية من كل من الشروح الإنجليزية والنص المصدر.
4. **تسجيل التداخل**: يحدد تداخل كلمات المحتوى بين شروح الفرضية وشروح المرجع الحكم الدلالي.

The validator produces categorical verdicts: **EXACT_MATCH**, **VALID** (different words but same meaning), **GRAMMAR_ISSUES** (correct lemmas but sentence-level grammar problems — agreement, animacy, verb form), **PARTIAL** (some meaning preserved), **INCOMPLETE** (meaning partially missing), **WRONG** (different meaning), or **NO_OUTPUT**.
ينتج المدقق أحكاماً فئوية: **EXACT_MATCH**، **VALID** (كلمات مختلفة ولكن نفس المعنى)، **GRAMMAR_ISSUES** (كلمات أساسية صحيحة ولكن مشاكل نحوية على مستوى الجملة — التوافق، الحيوية، صيغة الفعل)، **PARTIAL** (تم الحفاظ على بعض المعنى)، **INCOMPLETE** (المعنى مفقود جزئياً)، **WRONG** (معنى مختلف)، أو **NO_OUTPUT**.

**Relation to prior art:** This is, in effect, a **deterministic approximation of COMET's semantic similarity computation**. Where COMET uses learned cross-lingual embeddings to assess whether two sentences mean the same thing, our validator uses a chain of deterministic lookups: FST → dictionary → spaCy. The advantage is transparency (every step is inspectable and deterministic) and independence from training data. The disadvantage is brittleness: the quality of the assessment depends entirely on the FST's coverage and the dictionary's completeness.
**العلاقة بالفن السابق:** هذا، في الواقع، **تقريب حتمي لحساب التشابه الدلالي الخاص بـ COMET**. حيث يستخدم COMET تضمينات مكتسبة عبر اللغات لتقييم ما إذا كانت جملتان تعنيان نفس الشيء، يستخدم المدقق الخاص بنا سلسلة من عمليات البحث الحتمية: FST ← القاموس ← spaCy. الميزة هي الشفافية (كل خطوة قابلة للفحص وحتمية) والاستقلال عن بيانات التدريب. العيب هو الهشاشة: تعتمد جودة التقييم كلياً على تغطية FST واكتمال القاموس.

The approach is conceptually related to **MEANT** (Lo & Wu, 2011; Lo, 2017), which used semantic role labelling to assess whether the "who did what to whom" structure was preserved in translation. Our approach is more coarse-grained (content-word overlap rather than semantic roles) but operates on a language where no SRL tools exist.
يرتبط النهج من الناحية المفاهيمية بـ **MEANT** (Lo & Wu, 2011; Lo, 2017)، والذي استخدم تصنيف الأدوار الدلالية لتقييم ما إذا كان هيكل "من فعل ماذا لمن" قد تم الحفاظ عليه في الترجمة. نهجنا أكثر خشونة (تداخل كلمات المحتوى بدلاً من الأدوار الدلالية) ولكنه يعمل على لغة لا توجد فيها أدوات تصنيف الأدوار الدلالية (SRL).

#### 4. Behavioral Detection Plugins (Hallucination, Code-Switching, Terminology)
#### 4. المكونات الإضافية للاكتشاف السلوكي (الهلوسة، التبديل اللغوي، المصطلحات)

Three additional plugins provide **behavioral quality signals** that complement the morphological metrics:
توفر ثلاثة مكونات إضافية **إشارات جودة سلوكية** تكمل المقاييس الصرفية:

- **Hallucination detection** (259 lines): Four heuristic signals weighted and combined — length inflation (40%), repetition (30%), entity mismatch (20%), source echo (10%). These are cheap, reference-free screens that catch gross fabrication.
- **Code-switching detection** (~280 lines): Unicode block analysis plus common-word lists to detect untranslated source-language tokens. Outputs a `code_switching_rate` (0.0–1.0).
- **Terminology adherence** (199 lines): Checks whether specified glossary terms are translated consistently. Returns `terminology_adherence` (0.0–1.0) or None if no glossary is configured.
- **اكتشاف الهلوسة** (259 سطراً): أربع إشارات إرشادية موزونة ومجمعة — تضخم الطول (40%)، التكرار (30%)، عدم تطابق الكيانات (20%)، صدى المصدر (10%). هذه شاشات رخيصة وخالية من المرجع تكتشف التلفيق الجسيم.
- **اكتشاف التبديل اللغوي** (~280 سطراً): تحليل كتلة Unicode بالإضافة إلى قوائم الكلمات الشائعة لاكتشاف رموز اللغة المصدر غير المترجمة. يخرج `code_switching_rate` (0.0–1.0).
- **الالتزام بالمصطلحات** (199 سطراً): يتحقق مما إذا كانت مصطلحات المسرد المحددة مترجمة بشكل متسق. يُرجع `terminology_adherence` (0.0–1.0) أو None إذا لم يتم تكوين مسرد.

These plugins are honestly positioned as **baseline heuristic detectors**, not state-of-the-art. Their value is in providing cheap, fast, interpretable signals that can be computed alongside the more sophisticated morphological metrics. In the composite scoring framework, they carry low weights (0.05 each).
يتم وضع هذه المكونات الإضافية بصدق كـ **كواشف إرشادية أساسية**، وليست أحدث ما توصلت إليه التكنولوجيا. تكمن قيمتها في توفير إشارات رخيصة وسريعة وقابلة للتفسير يمكن حسابها جنباً إلى جنب مع المقاييس الصرفية الأكثر تطوراً. في إطار عمل التقييم المركب، تحمل أوزاناً منخفضة (0.05 لكل منها).

### Honest Limitations
### قيود صادقة

This approach has significant limitations that must be acknowledged before any claim of novelty or utility:
يحتوي هذا النهج على قيود كبيرة يجب الاعتراف بها قبل أي ادعاء بالجدة أو الفائدة:

1. **FST false rejection rate.** The FST will reject valid words that are not in its lexicon — loanwords, neologisms, proper nouns, code-mixed terms. This inflates the morphological error rate. The false rejection rate has not been formally measured on a representative corpus of Cree text. Without this measurement, the FST validity metric's precision is unknown.
1. **معدل الرفض الخاطئ لـ FST.** سيرفض FST الكلمات الصالحة غير الموجودة في معجمه — الكلمات المستعارة، والكلمات المحدثة، والأسماء العلم، والمصطلحات المختلطة لغوياً. هذا يضخم معدل الخطأ الصرفي. لم يتم قياس معدل الرفض الخاطئ رسمياً على متن لغوي تمثيلي لنص Cree. بدون هذا القياس، فإن دقة مقياس صلاحية FST غير معروفة.

2. **Dictionary coverage.** The semantic validator's quality depends entirely on the Wolvengrey dictionary's coverage. Cree words not in the dictionary produce no glosses, which the validator treats as a meaning gap. The dictionary contains roughly 18,000–22,000 entries (counts vary by edition and counting method) — substantial, but not exhaustive.
2. **تغطية القاموس.** تعتمد جودة المدقق الدلالي كلياً على تغطية قاموس Wolvengrey. كلمات Cree غير الموجودة في القاموس لا تنتج أي شروح، والتي يعاملها المدقق كفجوة في المعنى. يحتوي القاموس على ما يقرب من 18,000–22,000 إدخال (تختلف الأعداد حسب الإصدار وطريقة العد) — وهو عدد كبير، ولكنه ليس شاملاً.

3. **Variant class completeness.** The linter's six variant classes were designed based on

4. **عدم وجود دراسة ارتباط بشري.** الفجوة الأكثر أهمية: لم يقم أحد بقياس ما إذا كانت أحكام أداة الفحص (EXACT/EQUIVALENT/MISS) أو أحكام المدقق الدلالي ترتبط بالتقييمات البشرية لجودة الترجمة. تقضي المقاييس العصبية سنوات في إثبات الارتباط مع التقييم البشري (المهام المشتركة في WMT). مقاييسنا لا تملك مثل هذا التحقق.

5. **خصوصية اللغة.** فئات المتغيرات، وقوائم المرادفات، وقواعد الجسيمات الاختيارية خاصة بلغة Plains Cree. يتطلب نقلها إلى لغة North Sámi أو Inuktitut أو أي لغة أخرى لغويين يفهمون الصرف الخاص بتلك اللغة، ومرونة ترتيب الكلمات، والتباين الإملائي. *الإطار* قابل للنقل؛ أما *القواعد* فليست كذلك.

6. **فجوات ربط المقاييس.** حتى وقت كتابة هذا التقرير، هناك أربعة من أصل تسعة مقاييس في ملف التقييم المركب (semantic_score، morphological_accuracy، equivalent_match_rate، orthographic_accuracy) تعاني من ربط إضافات غير مكتمل أو غير واضح في بيئة الاختبار (arena harness). يتم حساب الدرجة المركبة فعليًا من حوالي خمسة مقاييس بأوزان مُعاد توزيعها.

### ما المطلوب للتحقق من صحة هذا النهج

لجعل هذا العمل قابلاً للنشر — في أي مكان، وبأي مستوى من الجدية الأكاديمية — ستكون التجارب التالية مطلوبة:

1. **دراسة ارتباط التقييم البشري.** جمع تقييمات الجودة البشرية لمجموعة من الترجمات من الإنجليزية إلى Cree (من الناحية المثالية أكثر من 200 زوج من الجمل يتم تقييمها بواسطة 3 متحدثين ثنائيي اللغة أو أكثر). حساب الارتباطات بين الدرجات البشرية وكل مقياس من مقاييسنا. هذا هو التحقق الأهم على الإطلاق. وبدونه، تُعد المقاييس مجرد قطع هندسية، وليست أدوات تقييم.

2. **قياس معدل الرفض الخاطئ لـ FST.** تشغيل محلل FST على مجموعة نصوص Cree معروفة بجودتها (مثل نصوص Cree المنشورة، والمجموعات النصية المتوازية المعتمدة) وقياس النسبة المئوية للكلمات الصحيحة التي يتم رفضها. يحدد هذا دقة مقياس صلاحية FST.

3. **التحقق من لغة ثانية.** نقل مقياس صلاحية FST إلى لغة ثانية من لغات GiellaLT (على الأرجح North Sámi، والتي تمتلك محلل FST الأكثر نضجًا في نظام GiellaLT البيئي). إثبات أن المقياس ينتج نتائج منطقية على مخرجات الترجمة الآلية (MT) للغة Sámi. هذا يؤكد صحة ادعاء قابلية التوسعة.

4. **المقارنة مع COMET.** تشغيل COMET على نفس بيانات Cree ومقارنة درجاته مع مقاييسنا ومع التقييمات البشرية. إذا أنتج COMET درجات ذات مغزى للغة Cree (وهو ما نشك فيه، ولكن لم نختبره)، فيجب أن تتفوق مقاييسنا عليه لتكون مفيدة. أما إذا أنتج COMET ضوضاء (وهو ما نتوقعه)، فهذا يؤكد الحاجة إلى نهجنا.

5. **المكمل التشخيصي لـ MorphEval.** بناء مجموعة اختبار صغيرة (50-100 تباين) بأسلوب MorphEval للغة Plains Cree تستهدف السمات الصرفية الأكثر تميزًا في اللغة (obviative، inverse، conjunct/independent، inclusive/exclusive). تشغيل أنظمة الترجمة الآلية (MT) عليها وإظهار أن المعلومات التشخيصية قابلة للتنفيذ.

6. **تدقيق الربط والتكامل.** إصلاح فجوات ربط ملف التقييم المحددة في جرد قاعدة التعليمات البرمجية. التأكد من أن جميع المقاييس المركبة التسعة تنتج قيمًا وأن الدرجة الإجمالية تُحسب بشكل صحيح.

---

## الجزء 7: التموضع والعمل المستقبلي

### موقع LYSS في مشهد التقييم

تصنيف لأساليب تقييم الترجمة الآلية (MT)، بتموضع موضوعي:

| البعد | مقاييس السلاسل النصية (BLEU، chrF++) | المقاييس العصبية (COMET، MetricX) | النماذج اللغوية الكبيرة كحكم (GEMBA) | التشخيص (MorphEval، CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| نوع الإشارة | التداخل السطحي | التشابه الدلالي المُتعلَّم | حكم مفتوح النهاية | مجسات القدرات المستهدفة | الصلاحية الصرفية + التكافؤ القائم على القواعد |
| بيانات التدريب المطلوبة | لا يوجد | تقييمات بشرية (بالآلاف) | نموذج لغوي كبير (LLM) مُدرب مسبقًا | مجموعات اختبار مصممة من قبل لغويين | FST + قاموس + قواعد المتغيرات |
| قابلية التطبيق على اللغات منخفضة الموارد (LRL) | عالمية ولكنها ضعيفة | محدودة بتغطية المشفر (encoder) | محدودة بتغطية النموذج اللغوي الكبير (LLM) | محدودة بإنشاء مجموعات الاختبار | محدودة بتوفر FST (حوالي 30 لغة) |
| الحاجة إلى مرجع | نعم | نعم (أو تقدير الجودة QE للمصدر فقط) | اختياري | نعم (تباينية) | نعم (LYSS-eq/LYSS-sem) / لا (LYSS-fst) |
| قابلية التفسير | منخفضة (رقم) | منخفضة (رقم) | عالية (مبرر نصي) | عالية (نجاح/فشل لكل ظاهرة) | عالية (أحكام + فئات المتغيرات) |

**LYSS ليس**: بديلاً عن COMET للغات جيدة الموارد، أو مقياسًا عالميًا، أو أول تقييم يراعي الصرف.

**LYSS هو**: إطار عمل متكامل يجمع بين التحقق الصرفي القائم على FST والمقاييس القياسية للحالة الخاصة باللغات التي تفتقر فيها المقاييس العصبية إلى التغطية وتتوفر فيها الأدوات القائمة على القواعد (FSTs، القواميس). يتكون من ثلاثة مكونات أساسية:
- **LYSS-fst** — الصلاحية الصرفية عبر FST (`fst_acceptance_rate`)
- **LYSS-eq** — التكافؤ اللغوي عبر أداة الفحص (`equivalent_match_rate`)
- **LYSS-sem** — التحقق الدلالي الحتمي (`semantic_score`)

**LYSS يوسع**: الرؤية الأساسية لـ MorphEval (استخدام الأدوات الصرفية للتقييم) من اختبار الكفاءة التشخيصية إلى التقييم المستمر للجودة.

**LYSS يكمل**: chrF++ (الذي يعطي رصيدًا جزئيًا للمقاطع الصرفية المشتركة ولكنه لا يستطيع اكتشاف التكافؤ)، و COMET (الذي يعمل في الفضاء الدلالي ولكنه يفتقر إلى بيانات التدريب للغات منخفضة الموارد LRL)، و FUSE (الذي يستخدم هندسة الميزات ولكن ليس المحللات الصرفية).

**أقرب الأعمال السابقة هي**: Hjerson (تصنيف الأخطاء اللغوية) + HyTER (فئات التكافؤ عبر شبكات إعادة الصياغة) + مقياس التغطية البسيط لـ Apertium (التحقق من الصلاحية القائم على FST). لا تتمثل مساهمة LYSS في أي تقنية فردية بل في دمج هذه الأفكار — لا سيما الصلاحية القائمة على FST والتكافؤ القائم على القواعد — في بيئة تقييم عملية للغة متعددة التركيب (polysynthetic).

### دمج MorphEval

تُعد منهجية مجموعة الاختبار التباينية لـ MorphEval ونهج التقييم المستمر الخاص بنا متكاملين:

- **MorphEval** يجيب على: "هل يمكن لهذا النظام التعامل مع علامات الزمن؟ التوافق العددي؟ تعيين الحالة؟"
- **مقياس FST الخاص بنا** يجيب على: "هل أنتج هذا النظام كلمات حقيقية؟"
- **أداة الفحص الخاصة بنا** تجيب على: "هل هذه الترجمة مكافئة للمرجع على الرغم من الاختلافات السطحية؟"
- **المدقق الدلالي الخاص بنا** يجيب على: "هل تعني هذه الترجمة الشيء الصحيح؟"

MorphEval مفتوح المصدر. يتطلب إنشاء مجموعة اختبار للغة Plains Cree لغويًا لتصميم أزواج تباينية تغطي التباينات الصرفية الخاصة بلغة Cree (obviation، inverse marking، conjunct/independent order، inclusive/exclusive "we"، preverb chains). هذا عمل كبير ولكنه محدود — يستغرق أسابيع وليس أشهرًا — وسيوفر قدرة تشخيصية لا تقدمها أي أداة تقييم أخرى للغة Cree.

### مسألة قابلية التوسعة

ما هي اللغات الأخرى التي يمكنها تبني هذا النهج؟ القيد الأساسي هو توفر FST. توفر البنية التحتية لـ GiellaLT محللات صرفية لأكثر من 30 لغة، بشكل أساسي في ثلاث عائلات:

- **لغات Sámi** (North Sámi، Lule Sámi، South Sámi، Skolt Sámi، Inari Sámi): تمتلك FSTs ناضجة بتغطية واسعة. تُعد لغة North Sámi الهدف الأكثر قابلية للنقل الفوري.
- **اللغات الأورالية** (Finnish، Estonian، Komi، Erzya، Moksha): محللات متطورة جيدًا، على الرغم من أن اللغتين الفنلندية والإستونية قد لا تحتاجان إلى تقييم قائم على FST بشكل ملح (لديهما تغطية أكبر للمقاييس العصبية).
- **لغات القطب الشمالي الأصلية** (Inuktitut عبر Uqailaut، Greenlandic): توجد محللات ولكن التغطية تختلف.
- **لغات GiellaLT الأخرى**: Faroese، Irish، Cornish، Livonian، وغيرها بمستويات متفاوتة من نضج FST.

بعيدًا عن GiellaLT، توفر منصة **Apertium** محللات صرفية لما يقرب من 40+ زوجًا لغويًا. يُعد نظام **HFST** البيئي (Helsinki Finite-State Technology) البنية التحتية المشتركة التي يستخدمها كل من GiellaLT و Apertium، مما يعني أنه يمكن من حيث المبدأ توصيل أي محلل Apertium بنفس مقياس صلاحية FST.

القيد العملي ليس توفر FST بل **تنظيم فئات المتغيرات**. تتطلب قواعد التكافؤ الخاصة بأداة الفحص خبرة لغوية لكل لغة مستهدفة. بالنسبة للغة North Sámi، سيتطلب ذلك فهم مرونة ترتيب الكلمات في لغة Sámi، والاصطلاحات الإملائية، والتباين اللهجي. أما بالنسبة للغة Inuktitut، فسيتطلب ذلك فهم الصرف متعدد التركيب (polysynthetic) بمستوى مماثل لما تم إنجازه للغة Cree. ومع ذلك، يمكن نشر مقياس صلاحية FST على الفور لأي لغة تمتلك محلل GiellaLT — دون الحاجة إلى عمل لغوي إضافي.

### نحو ورقة بحثية

من الطبيعي أن يستهدف أي منشور يعتمد على هذا العمل أحد هذه الأماكن:

- **WMT Metrics Shared Task** (بالتزامن مع EMNLP): المكان الأكثر مباشرة. سيتطلب تنفيذ المقاييس كتقديم لمهمة مشتركة والتقييم على مجموعات اختبار WMT — والتي لا تتضمن حاليًا أي لغة متعددة التركيب. يمكن التقديم كورقة "نتائج" أو المشاركة في المهمة الفرعية لمجموعات التحدي.
- **LREC-COLING** (مؤتمر الموارد اللغوية والتقييم): مناسب تمامًا لورقة بحثية حول الموارد/الأدوات تصف إطار التقييم والموارد اللغوية التي يستخدمها (FSTs، القواميس، قواعد المتغيرات).
- **ACL أو NAACL** (المؤتمر الرئيسي): سيتطلب دراسة الارتباط البشري ولغة إضافية واحدة على الأقل لتلبية معايير ورقة المؤتمر الرئيسي.
- **ورشة عمل AmericasNLP**: الجمهور الأكثر تقبلاً لتقييم الترجمة الآلية (MT) للغات الأصلية. معايير نشر أقل، ولكن بتأثير عالٍ داخل المجتمع المستهدف.
- **ComputEL** (الأساليب الحسابية للغات المهددة بالانقراض): مكان مخصص لهذا النوع من العمل بالتحديد.

سيتطلب أي منشور مؤلفين مشاركين ذوي خبرة في لغويات Cree (للتحقق من فئات المتغيرات وتفسير النتائج) ومن الناحية المثالية متحدثين ثنائيي اللغة للغة Cree (لتقديم تقييمات الجودة البشرية لدراسة الارتباط). هذا ليس اختياريًا — فورقة بحثية حول تقييم الترجمة الآلية (MT) للغة Cree مكتوبة بالكامل من قبل غير الناطقين بها ستكون، في أحسن الأحوال، غير مكتملة، وفي أسوأ الأحوال، استمرارًا لديناميكيات البحث الاستخراجية التي يحاول المجال تجاوزها.

---

## الملحق أ: مصفوفة متطلبات المقاييس

| المقياس | هل يحتاج إلى مرجع؟ | هل يحتاج إلى مصدر؟ | نموذج مُدرب؟ | موارد خاصة باللغة؟ | هل يعمل مع اللغات منخفضة الموارد (LRL)؟ |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | نعم | لا | لا | لا | بشكل ضعيف |
| chrF++ | نعم | لا | لا | لا | أفضل من BLEU |
| METEOR | نعم | لا | لا | مجذع (Stemmer) + WordNet | فقط إذا توفرت الموارد |
| TER | نعم | لا | لا | لا | مثل BLEU |
| BERTScore | نعم | لا | نعم (mBERT) | لا | يعتمد على تغطية النموذج |
| BLEURT | نعم | لا | نعم (مُدرب) | لا | يعتمد على بيانات التدريب |
| COMET | نعم | نعم | نعم (XLM-R) | لا | يعتمد على تغطية XLM-R |
| CometKiwi | لا | نعم | نعم (XLM-R) | لا | يعتمد على تغطية XLM-R |
| GEMBA | اختياري | نعم | نعم (LLM) | لا | يعتمد على تغطية LLM |
| **قبول FST** | **لا** | **لا** | **لا** | **نعم (محلل FST)** | **نعم، إذا توفر FST** |
| **أداة فحص CRK** | **نعم** | **لا** | **لا** | **نعم (FST + قواعد المتغيرات)** | **نعم، إذا توفرت الموارد** |
| **دلالات CRK** | **نعم** | **اختياري** | **لا** | **نعم (FST + قاموس + spaCy)** | **نعم، إذا توفرت الموارد** |
| اكتشاف الهلوسة | لا | نعم | لا | لا | نعم |
| اكتشاف التبديل اللغوي | اختياري | نعم | لا | الحد الأدنى | نعم |
| MorphEval | نعم (تباينية) | نعم | لا | نعم (مجموعة اختبار + محلل) | فقط إذا توفرت مجموعة الاختبار |

## الملحق ب: الأوراق البحثية الرئيسية

| الاقتباس | المكان | الصلة |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | المقياس الذي حدد المجال |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | مطابقة n-gram الموزونة بالمعلومات |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ورشة عمل ACL 2005 | التجذيع، المرادفات، محاذاة الكلمات |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | مسافة التحرير مع إزاحات العبارات |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | تصنيف أخطاء Hjerson |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | فئات التكافؤ عبر شبكات إعادة الصياغة |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | تصنيف أخطاء MQM |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | التقييم على مستوى الحرف |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | تقييم n-gram للحروف + الكلمات |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | مجموعات الاختبار الصرفية التباينية |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | الأزواج التباينية لـ LingEval97 |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | اختبار التباعد الهيكلي المستهدف |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | توحيد sacreBLEU |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | التحليل التلوي لارتباط BLEU بالتقييم البشري |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | تقييم الجنس لـ WinoMT |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (أفضل ورقة بحثية) | اختبار الوحدة القائم على القدرات لمعالجة اللغات الطبيعية (NLP) |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | التشابه الدلالي القائم على التضمين (Embedding) |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | مقياس مُدرب مسبقًا + مُحسن (fine-tuned) |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | التقييم ثلاثي اللغات عبر اللغات |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | التقييم التلوي القائم على MQM |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | الترجمة الآلية العصبية (NMT) متعددة اللغات كمُقيّم لإعادة الصياغة |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | دقة الجنس المخالفة للواقع |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 ظاهرة، 146 زوجًا لغويًا |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | النموذج اللغوي الكبير (LLM) كمُقيّم |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | اكتشاف نطاق الخطأ |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | المقاييس العصبية للغات الأفريقية |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | المقياس الفائز القائم على mT5 |

## الملحق ج: مسرد مصطلحات التقييم

| المصطلح | التعريف |
|------|------------|
| **الكفاية (Adequacy)** | ما إذا كانت الترجمة تنقل معنى المصدر. |
| **الطلاقة (Fluency)** | ما إذا كانت الترجمة صحيحة نحويًا وطبيعية في اللغة المستهدفة. |
| **التقييم المباشر (DA)** | طريقة تقييم بشري حيث يقوم المقيّمون بتصنيف الترجمات على مقياس من 0 إلى 100. |
| **MQM** | مقاييس الجودة متعددة الأبعاد — تقييم بشري قائم على نطاق الخطأ مع تحديد مستويات الخطورة. |
| **تقدير الجودة (QE)** | التنبؤ بجودة الترجمة دون وجود ترجمة مرجعية. |
| **FST** | محول الحالة المحدودة (Finite-State Transducer) — جهاز حسابي يرمز القواعد الصرفية للغة. |
| **GiellaLT** | بنية تحتية لتكنولوجيا اللغة القائمة على القواعد، بشكل أساسي للغة Sámi ولغات القطب الشمالي الأخرى. |
| **HFST** | تكنولوجيا الحالة المحدودة في هلسنكي (Helsinki Finite-State Technology) — إطار عمل برمجي يرتكز عليه GiellaLT و Apertium. |
| **SRO** | قواعد الإملاء الرومانية القياسية (Standard Roman Orthography) — نظام الكتابة القائم على اللاتينية للغة Plains Cree. |
| **المقاطع (Syllabics)** | المقاطع الكندية الأصلية (Canadian Aboriginal Syllabics) — نظام كتابة أبوجيدا يُستخدم للغة Cree واللغات الألغونكوية الأخرى. |
| **متعدد التركيب (Polysynthetic)** | نوع لغة حيث يمكن لكلمة واحدة أن ترمز إلى ما يعادل جملة إنجليزية كاملة من خلال الإلصاق المكثف. |
| **التحييد (Obviation)** | فئة نحوية في اللغات الألغونكوية تميز بين مرجعين بضمير الغائب. |
| **المعكوس (Inverse)** | فئة تشبه المبني للمجهول في اللغات الألغونكوية تشير إلى أن المفعول به يتفوق على الفاعل في التسلسل الهرمي للحيوية. |
| **WMT** | مؤتمر الترجمة الآلية — المكان الرئيسي للمهام المشتركة وتقييم الترجمة الآلية (MT). |
| **التقييم التبايني (Contrastive evaluation)** | اختبار ما إذا كان النظام يمكنه التمييز بين المدخلات المختلفة بشكل طفيف والتي تتطلب مخرجات مختلفة. |
| **مجموعة التحدي (Challenge set)** | مجموعة اختبار مصممة بعناية تستهدف ظواهر لغوية محددة. |
| **فئة التكافؤ (Equivalence class)** | مجموعة من الأشكال السطحية المختلفة التي تمثل نفس المعنى ويجب أن تحصل على نفس درجة التقييم. |

## إلى أين يقود هذا في هذا الموقع

إجابات Champollion الخاصة على المشكلات المفهرسة هنا هي
[مواصفات التقييم](/docs/network/specifications/scoring) (أي مقياس
يُحتسب، ومتى)، و [موثوقية المقياس](/docs/network/specifications/metric-reliability)
(أي مقياس يمكن الوثوق به لكل لغة مستهدفة)، و
[إطار تصميم المجموعة النصية](/docs/network/specifications/corpus-design)
(كيف تكتسب مجموعة الاختبار الحق في أن تكون موثوقة).
