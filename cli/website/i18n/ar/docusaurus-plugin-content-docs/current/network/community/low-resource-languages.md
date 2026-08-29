---
sidebar_position: 5
title: "دعم لغة قليلة الموارد"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# دعم لغة منخفضة الموارد

> **الملخص التنفيذي.** دليل شامل لبناء الترجمة الآلية للغات منخفضة الموارد واللغات متعددة التركيب (polysynthetic). يغطي أسباب صعوبة هذه اللغات (التعقيد الصرفي، ندرة البيانات، الهلوسة)، والموارد الحوسبية الحالية (ALTLab FST، GiellaLT، Apertium، UniMorph، EdTeKLA)، وأكثر من 10 استراتيجيات للنهج، ونظام التوجيه (coaching) في champollion، وحلقة التقييم. ابدأ من هنا إذا كنت ترغب في المساهمة بطريقة للغة غير مخدومة بشكل كافٍ.

:::info[الحالة: قيد التطوير النشط]
دعم لغة Plains Cree (nêhiyawêwin) قيد التطوير حاليًا. الأدوات، وبيئة التقييم (evaluation harness)، ولوحة المتصدرين (leaderboard) الموضحة هنا حقيقية وقابلة للاستخدام اليوم، ولكن لم يتم إصدار مسار ترجمة لغة Cree بعد. وعند إصداره، سيكون بمثابة مخطط أساسي للغات الأخرى متعددة التركيب ومنخفضة الموارد التي تمتلك بنية FST التحتية.
:::

## المشكلة غير المحلولة

تُدرج خدمة Cloud Translation من Google عدد 194 لغة ([قائمة Google المنشورة](https://docs.cloud.google.com/translate/docs/languages)). ويدعي نظام OMT-1600 من Meta (مارس 2026) تغطية 1,600 لغة — وهو أكبر نظام ترجمة آلية (MT) تم نشره على الإطلاق. ولكن بالنسبة لحوالي 1,200 لغة في ذيله الطويل — بحسب حساباتنا: الـ 1,600 لغة التي يغطيها ناقص أكثر من 400 لغة أفاد مؤلفوها أن النماذج "تفهمها بشكل كافٍ" — فإن الجودة أقل من الحدود القابلة للاستخدام، وبيانات التدريب يهيمن عليها نصوص الكتاب المقدس، وأوزان النموذج غير متاحة للتنزيل، ولا يوجد تقييم مستقل أو إطار حوكمة مجتمعي. أما بالنسبة للغات المتبقية البالغ عددها حوالي 5,400 لغة، فلا يوجد أي نموذج مدرب مسبقًا ينتج أي مخرجات على الإطلاق.

لقد تغير المشهد بشكل كبير — تستثمر شركات التكنولوجيا الكبرى (Big Tech) الآن في تغطية اللغات منخفضة الموارد (LRL). لكن التغطية لا تعني الجودة، والجودة بدون تحقق مستقل لا تعني الثقة. تحتاج اللغات منخفضة الموارد إلى أكثر من مجرد نموذج يدعي تغطيتها — فهي تحتاج إلى تقييم مستقل مع تحقق صرفي، ومجاميع لغوية (corpora) منسقة من قبل المجتمع، وحوكمة تحترم السيادة.

**تم بناء champollion لتغيير ذلك.**

تُعد [لوحة متصدري الطرق (Method Leaderboard)](https://champollion.dev/leaderboard) تحديًا مفتوحًا: قم ببناء أفضل طريقة ترجمة للغة غير مخدومة بشكل كافٍ، وأثبت ذلك من خلال تقييم قابل لإعادة الإنتاج، واحصل على أعلى درجة. يمكن لأي شخص في العالم المساهمة — اللغويون، وباحثو تعلم الآلة (ML)، والعاملون في لغات المجتمع، والطلاب، والهواة. المشكلة لم تُحل بعد. البنية التحتية موجودة هنا. ولوحة المتصدرين في الانتظار.

---

## لماذا يُعد هذا صعبًا: الصرف متعدد التركيب (Polysynthetic Morphology)

تم تصميم معظم أنظمة الترجمة الآلية (MT) التجارية للغات مثل الإنجليزية والفرنسية والصينية — وهي لغات تكون فيها الكلمات قصيرة نسبيًا وتُبنى الجمل من رموز (tokens) منفصلة. لكن العديد من لغات السكان الأصليين، بما في ذلك Plains Cree، هي لغات **متعددة التركيب (polysynthetic)**: يمكن لكلمة واحدة أن تشفر ما تعبر عنه اللغة الإنجليزية في جملة كاملة.

### مثال لغة Cree

تأمل كلمة Plains Cree التالية:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"عندما ذهبت إلى المدرسة"*

هذه **كلمة واحدة**. إنها تشفر الزمن (الماضي)، والاتجاه (الذهاب إلى)، والجذر (التعلم)، والصيغة (المبني للمجهول/المنعكس)، والشخص (المتكلم المفرد). إن النماذج اللغوية الكبيرة (LLM) المدربة في الغالب على اللغة الإنجليزية ليس لديها أي حدس لهذا النوع من الكثافة الصرفية.

تتضاعف التحديات:

| التحدي | ماذا يعني |
|-----------|--------------|
| **التعقيد الصرفي (Morphological complexity)** | يمكن لجذر فعل واحد أن يولد آلاف الأشكال المُصَرَّفة الصالحة من خلال إضافة السوابق (prefixation)، واللواحق (suffixation)، والمحيطات (circumfixation) |
| **التمييز بين العاقل/غير العاقل (Animate/inanimate distinction)** | الأسماء تكون نحويًا عاقلة أو غير عاقلة — وهذا يؤثر على تصريف الأفعال، وأسماء الإشارة، والجمع. لا يتبع التصنيف دائمًا العقلانية البيولوجية (*askiy* "الأرض" عاقل؛ و *maskisin* "الحذاء" عاقل أيضًا) |
| **التنحية (Obviation)** | يتم تصنيف إشارات الشخص الثالث حسب القرب/البروز. التمييز بين "القريب (proximate)" و"المنحى (obviative)" ليس له ما يعادله في اللغة الإنجليزية |
| **ندرة بيانات التدريب (Sparse training data)** | رأت النماذج اللغوية الكبيرة (LLMs) القليل جدًا من نصوص Plains Cree. وما رأته قد يخلط بين اللهجات (لهجة Y، لهجة TH) أو أنظمة الكتابة (SRO مقابل المقاطع الصوتية syllabics) |
| **خط أساس تجاري ضعيف (Weak commercial baseline)** | يتضمن OMT-1600 لغة CRK في مستوى R1 (موارد منخفضة جدًا) مع تدريب في مجال الكتاب المقدس وتقسيم BPE القياسي. لا تدعم خدمة Google Translate لغة Cree. التقييم المستقل باستخدام المقاييس الصرفية هو ما يجعل خطوط الأساس هذه ذات مغزى. |

تظل ترجمة اللغات متعددة التركيب **مشكلة بحثية مفتوحة** — يتضمن OMT-1600 لغات متعددة التركيب ولكنه يستخدم تقسيم BPE القياسي (مفردات بحجم 256 ألف) دون أي وعي صرفي، مما يعني أنه يمزق الكلمات المركبة إلى أجزاء بايت لا معنى لها.

---

## الأعمال السابقة: كيف تعامل الناس مع هذا الأمر

### ALTLab FST

أهم مورد حوسبي للغة Plains Cree هو **محول الحالة المحدودة (FST)** الذي طوره [مختبر تكنولوجيا اللغة في ألبرتا (ALTLab)](https://altlab.ualberta.ca/) في جامعة ألبرتا، بالتعاون مع [Giellatekno](https://giellatekno.uit.no/) في جامعة القطب الشمالي في النرويج (UiT).

يُعد ALTLab FST **محللًا ومولدًا صرفيًا**: عند إعطائه كلمة Cree مُصَرَّفة، يمكنه تحليلها إلى جذرها وعلاماتها النحوية، وعند إعطائه جذرًا بالإضافة إلى العلامات، يمكنه إنشاء الشكل المُصَرَّف الصحيح. هذا أمر حتمي (deterministic) — لا توجد شبكة عصبية، ولا هلوسة، ولا احتمالات. إذا قَبِل FST كلمة ما، فإن تلك الكلمة صالحة صرفيًا.

لهذا السبب تتتبع لوحة متصدري champollion **معدل قبول FST (FST Acceptance Rate)** كمقياس. إن طريقة الترجمة التي تنتج كلمات يرفضها FST تنتج لغة Cree غير صالحة صرفيًا — بغض النظر عما تقوله نتيجة chrF++.

**موارد ALTLab الرئيسية:**
- [itwêwina](https://itwewina.altlab.app/) — قاموس ذكي للغة Plains Cree–الإنجليزية مدعوم بواسطة FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — منصة قاموس مفتوحة المصدر ومدركة للصرف
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — قاعدة بيانات معجمية للغة Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — سياق المشروع الأوسع

### سجلات FST والصرف العالمية

لغة Plains Cree ليست اللغة الوحيدة التي تمتلك بنية FST تحتية عالية الجودة. إذا كنت ترغب في تطوير مسارات ترجمة للغات أخرى منخفضة الموارد أو معقدة صرفيًا، يمكنك الاستفادة من هذه المراكز العالمية الراسخة:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (جامعة القطب الشمالي في النرويج UiT):** أكبر مستودع مفتوح المصدر لمحللات ومولدات FST الصرفية، يغطي أكثر من 100 لغة. تشمل مجالات التركيز لغات Sámi (`sme`، `smj`، `sma`، إلخ)، واللغات الأورالية (Komi، Erzya، Udmurt، إلخ)، ولغات الأقليات/السكان الأصليين الأخرى. يستضيفون مجاميع نصوص معالجة عامة (`corpus-xxx`) في [منظمة GitHub](https://github.com/giellalt/) الخاصة بهم.
* **[The Apertium Project](https://www.apertium.org/):** منصة ترجمة آلية مفتوحة المصدر قائمة على القواعد. تحتفظ Apertium بمحللات FST صرفية محسنة للغاية (باستخدام `lttoolbox` و `hfst`) وقواميس ثنائية اللغة لعشرات اللغات، بما في ذلك مجموعة كبيرة من اللغات التركية (الكازاخستانية، التتارية، القيرغيزية، إلخ) ولغات الأقليات الأوروبية. جميع الموارد عامة على [GitHub الخاص بـ Apertium](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** مشروع تعاوني يوفر نماذج صرفية موحدة لأكثر من 150 لغة. تتم استضافة مجموعة البيانات على Hugging Face في [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). إذا لم يكن الملف الثنائي المجمع لـ FST متاحًا للغة ما، فيمكن استخدام جداول UniMorph كبوابة بحث في قاعدة بيانات ثابتة.
* **[المجلس الوطني للبحوث في كندا (NRC)](https://nrc-digital-repository.canada.ca/):** يقدم أدوات للغات السكان الأصليين الكندية، بما في ذلك محلل FST الصرفي للغة Inuktitut المسمى **Uqailaut** و **Nunavut Hansard Parallel Corpus** الضخم (1.3 مليون زوج من الجمل الإنجليزية-الإنكتيتوتية المحاذاة).

### مجموعة EdTeKLA (EdTeKLA Corpus)

قامت [مجموعة أبحاث EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) (أيضًا في جامعة ألبرتا) بتجميع مجموعة لغوية للغة Plains Cree من المواد التعليمية، والنسخ الصوتية، ومصادر المجتمع. مجموعة بيانات التقييم الخاصة بـ champollion المسماة [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) مستمدة من هذا العمل، ومنشورة بموجب [ترخيص CC BY-NC-SA المعدل من EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (شروط غير تجارية، ومحددة النطاق بالسيادة).

### نُهج أخرى جربها الناس أو يمكنهم تجربتها

لوحة المتصدرين لا تعتمد على طريقة معينة (method-agnostic). إليك الاستراتيجيات التي تم استكشافها أو اقتراحها للترجمة الآلية (MT) منخفضة الموارد، والتي يمكن تقديم أي منها:

| النهج | كيف يعمل | الإيجابيات | السلبيات |
|----------|-------------|------|------|
| **[توجيه LLM المدرب (Coached LLM prompting)](/docs/network/tutorials/coached-llm-prompting)** | حقن القواعد النحوية، والقواميس، وأزواج الأمثلة في موجه النظام (system prompt) | سريع التكرار، لا يحتاج إلى تدريب | سقف الجودة محدود بالمعرفة الأساسية لـ LLM |
| **[التوجيه بلقطات قليلة (Few-shot prompting)](/docs/network/tutorials/few-shot-prompting)** | تضمين ترجمات تم التحقق منها كأمثلة داخل السياق | جيد لأسلوب متسق | نافذة سياق صغيرة؛ يجب ألا تأتي الأمثلة من بيانات التقييم |
| **[مسار محكوم بـ FST (FST-gated pipeline)](/docs/network/tutorials/fst-gated-pipeline)** | LLM يولد → FST يتحقق → يرفض ويعيد المحاولة للصرف غير الصالح | يضمن الصلاحية الصرفية | يتطلب بنية FST تحتية؛ حلقات إعادة المحاولة تضيف زمن انتقال وتكلفة |
| **[البحث في القاموس + LLM (Dictionary lookup + LLM)](/docs/network/tutorials/dictionary-augmented-llm)** | فرض مصطلحات معروفة من قاموس ثنائي اللغة، وترك LLM يتعامل مع الباقي | يقلل من الهلوسة للمصطلحات المعروفة | تغطية القاموس دائمًا غير مكتملة |
| **[نموذج مضبوط بدقة (Fine-tuned model)](/docs/network/tutorials/fine-tuned-model)** | ضبط دقيق لنموذج مفتوح (Llama، Mistral) على نص متوازي — فقط ليس على بيانات التقييم | يحتمل أن يكون الأعلى جودة | يتطلب مجموعة نصوص متوازية (نادرة)؛ مكلف؛ خطر فرط التخصيص (overfitting) |
| **[النماذج المتسلسلة (Chained models)](/docs/network/tutorials/chained-models)** | النموذج A يولد ترجمة أولية → النموذج B يحرر لاحقًا → النموذج C يسجل | يمكن أن يجمع بين نقاط قوة المتخصصين | معقد؛ بطيء؛ مكلف |
| **[هجين قائم على القواعد + LLM (Rule-based + LLM hybrid)](/docs/network/tutorials/rule-based-hybrid)** | استخدام القواعد اللغوية للأنماط المعروفة، و LLM لكل شيء آخر | دقيق حيثما تنطبق القواعد | يتطلب خبرة لغوية عميقة |
| **[تعزيز الترجمة العكسية (Back-translation augmentation)](/docs/network/tutorials/back-translation)** | توليد بيانات متوازية اصطناعية عن طريق ترجمة Cree→الإنجليزية، ثم التدريب على العكس | يوسع بيانات التدريب بتكلفة زهيدة | يضخم أخطاء النموذج الحالية |
| **[النهج التطوري (Evolutionary approach)](/docs/network/tutorials/evolutionary-approach)** | توليد ترجمات مرشحة، وتسجيلها، وإحداث طفرة في أفضل الأداء، والتكرار | يمكنه اكتشاف حلول جديدة؛ قابل للتوازي | مكلف حاسوبيًا؛ يحتاج إلى دالة ملاءمة (fitness function) جيدة |
| **[الترجمة الجزئية (Partial translation)](/docs/network/tutorials/partial-translation)** | ترجمة عينة تمثيلية يدويًا، وإثبات أن طريقتك تتطابق مع أسلوبك عليها، ثم الترجمة التلقائية للجزء المتبقي | يجمع بين الجودة البشرية ونطاق الآلة | يتطلب جهدًا بشريًا أوليًا |
| **تصحيح JSON اليدوي / الامتحانات (Manual JSON / exam grading)** | صياغة ملف JSON لمجموعة بيانات يدويًا لاختبار إجابات الطلاب في امتحان لغة، أو تصحيح دفعة من الترجمات البشرية مقابل معيار ذهبي | لا يتطلب تعلم آلة (ML)؛ يعمل للتعليم وضمان الجودة (QA) | لا يتوسع لتلبية احتياجات الترجمة المستمرة |

### إنه مجرد JSON

تأخذ بيئة التقييم (harness) مدخلات JSON وتخرج نتائج JSON. إن [تنسيق مجموعة البيانات](/docs/network/leaderboard/datasets) بسيط:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

يمكنك بناء هذا يدويًا. يمكنك تصديره من جدول بيانات. يمكنك إنشاؤه من مجموعة نصوص (corpus). يمكن لمدرس لغة استخدامه لتسجيل ترجمات الطلاب. يمكن لوكالة ترجمة استخدامه لتقييم المستقلين. يمكن لمختبر أبحاث استخدامه لمقارنة بنيات النماذج. لا تهتم بيئة التقييم (harness) بمصدر JSON — إنها تقوم بتسجيله فقط.

ولأن إطار عمل النشر في بيئة الإنتاج يأخذ نفس واجهة الإضافة (plugin interface)، فإن الطريقة التي تسجل نتيجة جيدة في بيئة التقييم يتم نشرها على موقع الويب الخاص بك بتغيير واحد في التكوين (config). **أثبت ذلك واستخدمه.**

الاحتمالات لا حصر لها حقًا. **إذا كانت لديك فكرة، فقم ببنائها، وشغّل بيئة التقييم (harness)، وأرسل درجاتك.**

---

## كيف يتناسب champollion مع ذلك

يوفر champollion طبقة البنية التحتية — وأنت تجلب الطريقة.

### نظام التوجيه (The coaching system)

تتيح لك طريقة `llm-coached` في champollion حقن المعرفة اللغوية مباشرة في موجه LLM:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

يتم حقن بيانات التوجيه (coaching data) في كل موجه LLM للزوج `en:crk`، مما يمنح النموذج سياقًا لغويًا منظمًا لم يكن ليحصل عليه لولا ذلك. راجع [بيانات التوجيه (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data) للحصول على المواصفات الكاملة.

### السجلات (Registers)

السجل (register) هو جزء من موجه النظام (system prompt) الذي يوجه النبرة، والشكليات، واصطلاحات الكتابة. يأتي champollion مزودًا بسجل واحد للغة Plains Cree:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

يمكنك تجاوز هذا في التكوين (config) الخاص بك لتجربة استراتيجيات توجيه مختلفة:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

تنتج السجلات المختلفة أساليب ترجمة مختلفة — ودرجات مختلفة على لوحة المتصدرين. يسجل كل إرسال السجل الدقيق وموجه النظام المستخدم (كتجزئة SHA-256 في [بطاقة التشغيل (run card)](/docs/network/specifications/run-card))، بحيث تكون التجارب قابلة لإعادة الإنتاج.

### تحويل النص (Script conversion)

تُكتب لغة Plains Cree بنصين: **الكتابة الرومانية القياسية (SRO)** و **المقاطع الصوتية للسكان الأصليين الكنديين (Canadian Aboriginal Syllabics)**. مسار champollion:

1. يترجم LLM إلى SRO (قائم على اللاتينية، والذي تتعامل معه LLMs بشكل أفضل)
2. تتحقق بوابة الجودة من صحة مخرجات SRO
3. يقوم محول حتمي (deterministic converter) بتحويل SRO ← المقاطع الصوتية (Syllabics)
4. تتم كتابة النص المحول إلى القرص

يتعامل المحول مع جميع علامات التشكيل في SRO (ê، î، ô، â لحروف العلة الطويلة) ويعينها إلى الأحرف المقطعية الصحيحة. راجع [محولات النص (Script Converters)](https://champollion.dev/docs/concepts/script-converters) للحصول على التفاصيل الفنية.

### حلقة التقييم (The evaluation loop)

تقوم [بيئة التقييم (eval harness)](/docs/network/specifications/harness) بتشغيل طريقتك مقابل مجموعة بيانات التقييم وتنتج [بطاقة تشغيل (run card)](/docs/network/specifications/run-card) مسجلة:

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

العلامة `--name` هي تسمية تختارها. تظهر على لوحة المتصدرين حتى يتمكن الأشخاص من رؤية استراتيجية التوجيه التي استخدمتها. تسجل بيئة التقييم (harness) موجه النظام الكامل في بطاقة التشغيل، بحيث يكون نهجك الدقيق قابلاً لإعادة الإنتاج.

:::tip[جرب بحرية، وأرسل أفضل ما لديك]
تم تصميم بيئة التقييم (harness) للتكرار السريع. قم بتشغيل عشرات التجارب بنماذج، وبيانات توجيه، وسجلات، وظروف مختلفة. لا ترسل إلى لوحة المتصدرين إلا عندما يكون لديك شيء تفخر به.
:::

---

## مبادئ سيادة البيانات {#data-sovereignty-principles}

تم تصميم champollion لدعم سيادة بيانات السكان الأصليين. توجه ملكية المجتمع للبيانات اللغوية وسيطرته عليها ووصوله إليها وحيازته لها كيفية تعاملنا مع تكنولوجيا اللغة لمجتمعات السكان الأصليين:

| المبدأ | كيف يدعمه champollion |
|-----------|------------------------|
| **الملكية (Ownership)** | تمتلك المجتمعات اللغوية بياناتها اللغوية. لا يقوم champollion أبدًا بالاتصال بالخارج أو نقل البيانات إلى خوادمنا |
| **السيطرة (Control)** | تتيح [طريقة API](https://champollion.dev/docs/guides/serving-a-method) للمجتمعات استضافة مسار الترجمة الخاص بها — نحن نوفر الواجهة، وهم يتحكمون في التنفيذ |
| **الوصول (Access)** | تقرر المجتمعات من يمكنه استخدام طريقتها. يمكن تقييد واجهة برمجة التطبيقات (API) خلف المصادقة |
| **الحيازة (Possession)** | تبقى جميع بيانات الترجمة في نظام ملفات مشروعك. يتتبع [نظام المصدر (provenance system)](https://champollion.dev/docs/concepts/security) من أين جاءت كل ترجمة |

تعني بنية الإضافات (plugin architecture) أنه يمكن للمجتمع بناء طريقة تدمج المعرفة المقدسة أو المقيدة داخليًا، وكشف واجهة برمجة تطبيقات (API) الترجمة فقط، والحفاظ على السيطرة الكاملة على مواردهم اللغوية.

---

## الرؤية: ما سيأتي بعد ذلك

لغة Plains Cree هي الهدف الأول. بمجرد التحقق من صحة المسار ورضا المجتمع عن الجودة، تمتد نفس البنية إلى لغات أخرى متعددة التركيب تمتلك بنية FST التحتية:

- **لغات ألغونكويان الأخرى (Algonquian languages)**: Woods Cree، Swampy Cree، Ojibwe، Blackfoot
- **لغات الإنويت (Inuit languages)**: Inuktitut، Inuinnaqtun (والتي تستخدم أيضًا نصوصًا مقطعية)
- **عائلات لغوية أخرى**: يمكن لأي لغة تحتوي على محلل FST استخدام المسار المحكوم بـ FST

لوحة المتصدرين محددة النطاق بزوج اللغات. ومع مساهمة المجتمعات اللغوية بمجموعات بيانات تقييم جديدة، تُفتح مسارات جديدة في لوحة المتصدرين تلقائيًا.

**هذه دعوة مفتوحة.** إذا كنت تعمل مع لغة منخفضة الموارد — كباحث، أو عضو في المجتمع، أو طالب، أو مجرد شخص مهتم — فإن champollion يمنحك الأدوات لبناء شيء حقيقي، وقياسه بصدق، ومشاركته مع العالم. [لوحة متصدري الطرق (Method Leaderboard)](https://champollion.dev/leaderboard) في انتظار إرسالك.

---

## انظر أيضًا

- **[لوحة متصدري الطرق (Method Leaderboard)](https://champollion.dev/leaderboard)** — أرسل درجاتك وشاهد كيف تقارن الطرق
- **[تقييم الترجمة الآلية (MT Evaluation)](/docs/network/leaderboard/rules)** — ما الذي يجعل الطريقة جيدة، وما الذي يتم استبعاده
- **[بيئة التقييم (Eval Harness)](/docs/network/specifications/harness)** — كيفية تشغيل التجارب
- **[مجموعات بيانات التقييم (Evaluation Datasets)](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 و FLORES+
- **[بيانات التوجيه (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data)** — كيفية هيكلة المعرفة اللغوية لـ LLM
- **[محولات النص (Script Converters)](https://champollion.dev/docs/concepts/script-converters)** — مسار SRO←المقاطع الصوتية (Syllabics)
- **[تقديم طريقة عبر API (Serving a Method via API)](https://champollion.dev/docs/guides/serving-a-method)** — استضافة ترجمة يتحكم فيها المجتمع
- **[ALTLab](https://altlab.ualberta.ca/)** — مختبر تكنولوجيا اللغة في ألبرتا
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — مجموعة أبحاث التكنولوجيا التعليمية والمعرفة واللغة
- **[قاموس itwêwina](https://itwewina.altlab.app/)** — قاموس Plains Cree–إنجليزي مدعوم بواسطة FST

