---
sidebar_position: 2
title: "تدريب نموذج بأمانة (nmt-forge)"
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# تدريب نموذج بنزاهة (nmt-forge)

**نسخة الـ 30 ثانية:** معظم "التحسينات" في الترجمة الآلية (MT) للغات ذات الموارد المحدودة تتلاشى عند
إعادة الفحص — إما بسبب تسرب مجموعة الاختبار إلى بيانات التدريب، أو لأن مجموعة الاختبار هي التي اختارت
نقطة الحفظ (checkpoint)، أو لأن المكسب كان مجرد ضوضاء بدون أشرطة خطأ (error bars). **nmt-forge** عبارة عن
حزمة تدريب تجعل ارتكاب هذه الأخطاء صعباً من الناحية الهيكلية: فمساراتها العادية
تفعل الشيء الصحيح، والمسارات الخاطئة ترفض التنفيذ مع رسالة توضح
*ماذا* حدث، و*لماذا* يفسد النتائج، و*الإصلاح* الدقيق. إنها تتولى التدريب؛
بينما تتولى [أداة التقييم (eval harness)](/docs/network/specifications/harness) حساب النتائج. كل آلية حماية
فيها تمثل أتمتة لخطأ ارتكبناه بالفعل، وقسناه، ووثقناه أثناء
بناء نظام ترجمة لغة Plains Cree.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

هذه هي شخصية الحزمة بأكملها تتجلى في رفض واحد.

## قصة الخمس دقائق

إليك الفشل الذي ولدت منه هذه الحزمة. يربط كتاب مدرسي للغة Cree العديد من
التدريبات الإنجليزية بهدف واحد: *"Feed him"* و *"Feed her"* كلاهما يترجم
إلى `asam`. أدى التقسيم العشوائي القياسي إلى وضع نسخة واحدة في بيانات التدريب وتوأمها في
مجموعة الاختبار — وبالتالي فإن النموذج قد رأى حرفياً 17 من أصل 54 إجابة "اختبار"، و
سجلت تلك الصفوف 83 نقطة في مقياس chrF++ مقابل 44 للصفوف النظيفة. كل شيء نتج عن ذلك
(النموذج "البطل"، والنتائج المبنية عليه) كان لا بد من التخلص منه.

أداة التقسيم في nmt-forge تجعل ذلك مستحيلاً **من حيث البنية**: الأزواج التي تشترك
في مصدر *أو* هدف يتم تجميعها، وتهبط المجموعات بأكملها في جانب واحد، ويتم
تشغيل تحقق من عدم وجود أي تداخل (zero-overlap) بعد كل عملية تقسيم:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

كل آلية حماية أخرى لها نفس الشكل — خطأ حقيقي، تمت أتمتة منعه:

| آلية الحماية (guard) | الخطأ الذي تقضي عليه |
|---|---|
| **split-guard** | إجابات الاختبار التي تختبئ في بيانات التدريب عبر المصادر/الأهداف المشتركة |
| **dev-fence** | مجموعة الاختبار التي تختار نقطة الحفظ (checkpoint) الخاصة بك (يرفض التدريب البدء بدون مجموعة تطوير (dev set) مسجلة) |
| **leak-audit** | التدريب على نصوص التقييم — سواء كانت متطابقة، أو معاد صياغتها (Jaccard)، أو الملف بأكمله |
| **funnel-audit** | الاستنزاف الصامت في مسار المعالجة (حرف إملائي واحد أدى ذات مرة إلى حذف 1,375 فعلاً من القاموس، بشكل غير مرئي، لأسابيع) |
| **convention-lint** | التدريب على اصطلاحات إملائية مختلطة (يقوم النموذج بعد ذلك بخلطها في منتصف الجملة) |
| **coverage-map** | مليون زوج اصطناعي بدون صيغ أمر، أو أسئلة، أو ملكية — حجم بيانات يخفي فجوات هيكلية |
| **sample-strata** | نوعان من القوالب يستحوذان على نصف إشارة التدريب |
| **ci-scoring** | نتائج بدون أشرطة خطأ (كل رقم يُعرض مع فترة ثقة (CI) بنسبة 95% بطريقة التمهيد (bootstrap) — لا يوجد مخرجات لنتائج مجردة) |
| **schedule-sanity** | التوقف المبكر (early stopping) الذي يقتل عملية تدريب تعتمد بكثافة على بيانات اصطناعية عند نصف حقبة (epoch): مع 97% من البيانات الاصطناعية ومجموعة تطوير *حقيقية* ونزيهة، يصل فقدان التطوير (dev loss) إلى أدنى مستوى له مبكراً ثم يرتفع — هذا يعني أن النموذج يتكيف مع الكتلة الاصطناعية، وليس تقارباً (convergence). يتم اشتقاق الحد الأدنى للتوقف من مزيج البيانات الخاص بك تلقائياً، وكل تدخل يشرح نفسه من خلال مسار فقدان التطوير. تم اكتشاف هذا الخطأ *بواسطة* بروتوكول نظيف — الإعدادات النزيهة تكشف عن أخطاء حقيقية |
| **eval-ledger** | الاستخدام التكيفي غير المرئي لبيانات التقييم (يتم تسجيل كل عملية قراءة؛ المجموعات المختومة تُستخدم لمرة واحدة فقط) |
| **preregister** | التنبؤات البعدية (postdictions) المتنكرة في صورة تنبؤات (لا يوجد تسجيل مسبق → لا يوجد جدول مقارنة) |

## أي لغة، أي أصول — ابدأ من البطاقة

nmt-forge هي أداة واحدة لجميع اللغات البالغ عددها حوالي 8,700 لغة في فهرس Champollion، و
تبدأ بسؤال الفهرس عما تمتلكه اللغة بالفعل:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

علامات `?` تمثل نزاهة الأداة: الغياب في البطاقة يعني **غير معروف**،
وليس أبداً "هذه اللغة لا تملك شيئاً". تتسلق كل لغة نفس
**سلم الأصول** — (1) النص الموازي وحده يحصل بالفعل على حلقة التدريب
المحمية بالكامل؛ (2) النص أحادي اللغة يضيف الترجمة العكسية (backtranslation)؛ (3) قاموس
بالإضافة إلى قواعد نحوية منشورة يجعل بناء حزمة قوالب موثقة أمراً يستحق العناء؛ (4) محلل
صرفي يفتح المجال للتوليد الاصطناعي الموثق؛ (5) حكم LYSS يضع
المقياس الخاص باللغة في عملية التقييم واختيار نقطة الحفظ. تقوم البطاقة الغنية
(Plains Cree) بربط الدرجتين 4-5 تلقائياً — تصل مجموعات التقييم بعلامة
`NEVER TRAIN ON THIS`، وتأتي مسارات المكون الإضافي للحكم جاهزة للصق.

يقوم `nmt-forge init <code>` بعد ذلك بتأسيس مشروع من البطاقة: مساحة عمل،
وتكوين مبدئي، وملخص `NEXT_STEPS.md` مكتوب لك *ولوكيلك (agent)* —
ينتهي عند [إرسال طريقة (Submit a Method)](/docs/network/getting-started/submit-a-method) بمجرد أن يكون لديك
شيء يستحق الاختبار.

## بيانات اصطناعية يمكنك الدفاع عنها

بالنسبة للغات التي تحتوي على محللات صرفية (FSTs)، تقوم forge بتصنيع
بيانات التدريب من خلال **حزم اللغات (language packs)** — وتفرض *قانون إصدار (emit law)* لا يمكن لأي حزمة
التهرب منه: يجب أن تمر كل كلمة مُولدة برحلة ذهاب وإياب عبر المحلل
(توليد → تحليل → نفس التحليل)، وكل قالب يستشهد بالقواعد النحوية المنشورة التي ينسخها، وكل
مرشح معقولية (plausibility filter) يتم تسميته وعده، و
كل صف يُختم بـ `synthetic: true`. هذا الختم ذو أهمية قصوى: السجل
**يرفض الصفوف الاصطناعية في مجموعات الاختبار**. الاختبارات تتكون من بيانات حقيقية فقط.

لا توفر forge نفسها أي حزم لغات — إنها أداة عامة الأغراض. تعيش الحزم
مع لغاتها ويتم توصيلها عبر مسار الوحدة (module path) أو نقطة الإدخال (توجد
حزمة Plains Cree في مشروع crk-translate):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

تظل المحللات والقواميس أدوات منفصلة يجلبها المستخدم بموجب تراخيصها
الخاصة — ولا يتم تجميعها أو إعادة توزيعها أبداً.

## حكم لغتك الخاص، ضمن الحلقة

معايير تقييم LYSS (أدوات فحص (linters) خاصة بكل لغة تعرف، على سبيل المثال، أن تهجئتين
في لغة Cree تختلفان فقط بسبب اصطلاح موثق لحرف علة طويل) تتصل بـ
كل واجهة تقييم — وبعملية اختيار نقطة الحفظ، بحيث يكون النموذج
الفائز هو النموذج الذي يفضله *حكم اللغة*، وليس فقط مقياس chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

يحصل كل رقم من المكون الإضافي على فترة ثقة (confidence interval)؛ والحكم الذي
تفتقر متطلباته الأساسية يُبلغ عن حالة *غير متوفر (unavailable)* بدلاً من تقديم
نتيجة ملفقة.

ينطبق الشيء نفسه على **حزمة مقاييس أداة التقييم الكاملة** — تتحدث nmt-forge
بكل ما تتحدث به [أداة التقييم (eval harness)](/docs/network/specifications/harness)،
بما في ذلك المقاييس العصبية (COMET، و COMET-QE، و MetricX)، مع تشغيل الاستدلال (inference)
لمرة واحدة واستخراج فترات الثقة (confidence intervals) بطريقة التمهيد (bootstrapped) من النتائج المخبأة لكل إدخال.
قبل أن تختار نقاط الحفظ بناءً على أي مقياس تلقائي، يعرض `discover`
[الموثوقية
المقاسة](/docs/network/specifications/metric-reliability) لكل
مقياس لعائلة لغتك — بالنسبة للغة Inuktitut، بالكاد يتتبع مقياس BLEU التقييم
البشري (r=0.16) بينما يفعل COMET ذلك (r=0.86)؛ بالنسبة لمعظم العائلات ذات الموارد المحدودة
فإن الإجابة الصادقة هي *غير مقاسة (unmeasured)*. تخبرك الأداة بالرقم الذي يجب أن
تصدقه قبل أن تقوم بالتحسين بناءً عليه.

## للتعمق أكثر

- **هل المصطلحات جديدة عليك؟** [تدريب الترجمة الآلية بلغة
  بسيطة](/docs/network/context/mt-training-concepts) يُعرّف كل مصطلح —
  بيانات التدريب مقابل بيانات التقييم، الفقد (loss) مقابل فك التشفير (decoding)، التسرب (leakage)، chrF++، الترجمة العكسية (backtranslation)،
  الهضبة (the plateau) — مع مثال عملي، مكتوب لمن ليس لديهم خلفية مسبقة.
- **هل أنت مستعد للبناء؟** [إذن أنت تريد تدريب نموذجك
  الخاص](/docs/network/tutorials/train-your-own-model) هو دليل تفصيلي خطوة بخطوة،
  موجه للوكلاء (agent-forward): اختر لغة ← اجمع البيانات ← ولّد بيانات اصطناعية ← قسّم
  ← درّب ← قيّم ← كرر ← أرسل، مع عرض كل آلية حماية وهي تلتقط
  الخطأ الخاص بها.
- **درّب، ثم أرسل:** يصبح النموذج المُدرب بنزاهة إدخالاً في الشبكة
  عبر [إرسال طريقة (Submit a Method)](/docs/network/getting-started/submit-a-method).
- **أشرطة الخطأ:** [اختبار الدلالة
  الإحصائية](/docs/network/specifications/significance) هو الرياضيات التي تطبقها forge
  بشكل افتراضي.
- **أي مقياس تثق به:** تحقق من [موثوقية
  المقياس](/docs/network/specifications/metric-reliability) قبل
  اختيار نقاط الحفظ بناءً على أي مقياس تلقائي.
- **التصميم الكامل** — القصة الخلفية المقاسة لكل آلية حماية، وواجهة
  الحزمة، والافتراضيات الخاصة بحلقة التدريب — موجودة مع الكود في
  المستودع (`forge/DESIGN.md`).
