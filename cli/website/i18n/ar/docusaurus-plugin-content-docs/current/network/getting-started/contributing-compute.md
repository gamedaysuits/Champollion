---
sidebar_position: 4
title: "المساهمة بالموارد الحسابية"
description: "تشغيل قائمة الانتظار: قم بتشغيل عمليات مسح المعايير المفتوحة من قائمة الانتظار العامة باستخدام مفتاح API الخاص بك وانشر النتائج."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# المساهمة بالموارد الحوسبية

> **الفكرة:** تحتوي لوحة الصدارة على مربعات فارغة — وهي تركيبات من (زوج اللغات، الطريقة، الحالة) لم يقم أحد بقياسها. نحن نحتفظ بقائمة انتظار عامة لها. تقوم أنت بتشغيل العناصر باستخدام مفتاح واجهة برمجة التطبيقات (API) الخاص بك، وتنشر التقارير، وبذلك تكتمل الخريطة. تُعد المساهمة بالحوسبة مساهمة حقيقية وقابلة للاستشهاد بها في تقييم الترجمة الآلية (MT) للغات ذات الموارد المحدودة.

تحمل قائمة الانتظار نوعين من العمل. تختبر **عناصر النماذج اللغوية الكبيرة (LLM)** نموذج دردشة على زوج لغوي، في حالة توجيه `naive` أو `coached`. بينما تختبر **عناصر المحركات** (الحالة `engine`) خدمة ترجمة آلية (MT) كلاسيكية — مثل DeepL، أو Google Translate، أو Microsoft Translator، أو LibreTranslate، أو Tilde — على أزواج لغوية ضمن التغطية المنشورة الخاصة بتلك الخدمة؛ وتُعد هذه العناصر بمثابة العمود الفقري المُقاس لخريطة التغطية، وحتى شهر 08-2026 كانت فارغة بالكامل تقريبًا. يعمل كلا النوعين من خلال نفس بيئة الاختبار (harness) ويُنشران في نفس اللوحة.

## قائمة الانتظار

تُقدم قائمة الانتظار المباشرة من قاعدة البيانات (تقرأها بيئة الاختبار افتراضيًا)؛ وتُنشر لقطة مصغرة منها على [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json)، بينما يتوفر الملف الكامل على [queue.json](https://champollion.dev/queue.json) (بحجم عشرات الميجابايت — لذا تُعد المعاينة هي الخيار الأنسب للجلب الأولي). يمكنك مشاهدة ما تبنيه عمليات التشغيل الخاصة بك على [الخريطة المباشرة في champollion.dev](https://champollion.dev) — وهي خريطة التغطية التي توضح من يمكنه ترجمة ماذا. يتوفر أيضًا عارض طرفية (terminal viewer) لا يتطلب التثبيت:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

يقوم العارض فقط *بعرض* العناصر المفتوحة وأوامر `mt-eval run` الدقيقة الخاصة بها — ولا ينفذ أي شيء أبدًا أو يستهلك الرموز (tokens) الخاصة بك. يحمل كل عنصر ما يلي:

- `run_command` — جاهز للنسخ واللصق (يجلب المتن اللغوي، ويشغل بيئة الاختبار)
- `est_cost_usd` و `est_basis` — إما التكلفة **المرصودة** لعملية التشغيل الأساسية الخاصة بنا لنفس (المتن اللغوي، النموذج)، أو **استقراء** من متوسط تكلفة المسح لذلك النموذج لكل مُدخل × عدد مُدخلات المتن اللغوي. يُذكر الأساس لكل عنصر؛ وتعتمد تكلفتك الفعلية على تسعير المزود في وقت التشغيل.
- `priority` — التصنيف المنشور (وضع الاستطلاع: أول ضوء عبر الأزواج، واللغات، والعائلات اللغوية مقابل كل دولار). تنشر المعاينة أيضًا **فئات الميزانية** — ما يمكن شراؤه بمبلغ 1 دولار / 10 دولارات / 100 دولار / 1000 دولار من أعلى التصنيف (العناصر، والأزواج، والنماذج التي تم الوصول إليها) — حتى تتمكن من تحديد حجم المساهمة قبل إنفاق أي شيء. نموذج القيمة الأساسي هو **القيمة المتوقعة للسلسلة**: مقدار ما يُتوقع أن تعززه عملية التشغيل هذه للشبكة اللغوية بأكملها، مقابل كل دولار مُقدر. يحمل كل عنصر تفصيل معادلته بالكامل (`edge_strength`، `pair_prior`، `model_offset`، `exploration_bonus`، `predicted_strength`، `expected_mesh_gain`، `ecv_per_usd`) بحيث يمكن إعادة اشتقاق أي تصنيف يدويًا — تُنشر المعادلة وقيمها الافتراضية في [مواصفات بناء قائمة الانتظار](/docs/network/specifications/queue-construction)، والمنطق الكامن وراءها في [لماذا تُبنى قائمة الانتظار بهذه الطريقة](/docs/network/perspectives/why-the-queue).

**لا يوجد قفل للمطالبات — اختر أي عنصر مفتوح.** تشغيل شخصين لنفس العنصر غير ضار حسب التصميم: كل بطاقة تشغيل لها بصمة فريدة (SHA-256 على تجزئة مجموعة البيانات + النموذج + الحالة + موجه النظام، [مواصفات المعيار §3.8](/docs/network/specifications/benchmark))، لذا فإن عمليات التشغيل المتطابقة تُزال تكراراتها عند النشر، وتُعد النسخ المستقلة لنفس التكوين دليلًا مفيدًا، وليست هدرًا.

المتون اللغوية المدرجة في قائمة الانتظار مقسمة للتطوير (dev-split)، وتنتمي لعائلة تراخيص CC-BY (مستمدة من Tatoeba)، ومميزة بعلامة `do_not_train` — فهي مجموعات تقييم، وليست بيانات تدريب. تُستبعد المتون اللغوية غير المرخصة تجاريًا والمعزولة (quarantined) من قائمة الانتظار المفتوحة.

## الإعداد (لمرة واحدة)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### أي مفتاح مزود؟

تقبل بيئة الاختبار أربعة مفاتيح للمزودين، يتم تحديدها باستخدام `--provider` في `mt-eval run` و `mt-eval queue` — أو تُكتشف تلقائيًا من أي مفتاح تم تعيينه في بيئتك أو في `.env`:

| `--provider` | المفتاح | يصل إلى |
|---|---|---|
| `openrouter` (الافتراضي) | `OPENROUTER_API_KEY` | كل نموذج في تشكيلة قائمة الانتظار |
| `anthropic` | `ANTHROPIC_API_KEY` | نماذج Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | نماذج OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | نماذج Google Gemini |

يصل مفتاح [OpenRouter](https://openrouter.ai/keys) واحد إلى كل نموذج في التشكيلة، وتأتي لقطات تتبع التكلفة والتسعير الخاصة ببيئة الاختبار من نفس البيانات الوصفية لـ OpenRouter، لذا فإن تكلفة التشغيل المُبلغ عنها تتطابق مع ما تمت فوترته على مفتاحك — ولهذا السبب هو الخيار الافتراضي. إذا كانت أرصدتك موجودة لدى Anthropic أو OpenAI أو Google مباشرةً، فقم بتعيين مفتاح ذلك المورد وستستدعي بيئة الاختبار واجهة برمجة التطبيقات (API) الخاصة بالمورد بدون وكيل (proxy). يصل المفتاح المباشر فقط إلى النماذج الخاصة بذلك المورد (وهو أمر جيد لدفعة من مورد واحد)، وتأتي أرقام التكلفة الخاصة به من تسعير المورد المنشور بدلاً من البيانات الوصفية المفوترة — تعامل معها كتقديرات قريبة. إذا تم تعيين كل من مفتاح OpenRouter ومفتاح مباشر، فإن الاكتشاف التلقائي يختار OpenRouter؛ ويخبرك عامل قائمة الانتظار (queue worker) بذلك وبكيفية تجاوزه باستخدام `--provider`. تسجل كل بطاقة تشغيل المسار الذي تم التشغيل من خلاله في حقل `api_provider` الخاص بها.

(يأخذ `mt-eval run` أيضًا `--provider local` لنقاط النهاية المتوافقة مع OpenAI والمستضافة ذاتيًا — مثل Ollama، و vLLM، و LM Studio — عبر `--base-url`. وهو خيار اشتراك صريح، ولا يُكتشف تلقائيًا أبدًا.)

### بدون مفتاح API: تشغيل نموذج مستضاف ذاتيًا

أنت لا تحتاج إلى مفتاح سحابي على الإطلاق. تقوم طريقة `local-model` بتشغيل نموذج ترجمة آلية عصبية (neural-MT) مفتوح على أجهزتك الخاصة — وهي النماذج التي لا توفرها المحركات السحابية، وهو بالضبط المكان الذي تتواجد فيه تغطية الموارد المحدودة: **NLLB-200**، و **OPUS-MT** (Helsinki-NLP)، و **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**توجد "طريقتان معتادتان" لتحميل نموذج، يتم تحديدهما تلقائيًا — لا يوجد شيء لتكوينه:**

- **transformers** (الافتراضي): `--model` هو مُعرّف مركز Hugging Face (مثل `facebook/nllb-200-distilled-600M`، `Helsinki-NLP/opus-mt-en-es`، `google/madlad400-3b-mt`) أو دليل `from_pretrained()` محلي. يتطلب `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (استدلال سريع على وحدة المعالجة المركزية/وحدة معالجة الرسومات): `--model` هو دليل نموذج مُحوّل إلى CTranslate2 (تم إنتاجه بواسطة `ct2-transformers-converter`، ويحتوي على `model.bin`). يتطلب `pip install 'mt-eval[ctranslate2]'`. تتم قراءة المُجزئ (tokenizer) من الدليل المُحوّل، أو يُسمى باستخدام `LOCAL_TOKENIZER_ID`.

يتم اكتشاف الواجهة الخلفية (backend) من مسار النموذج (يحتوي دليل CTranslate2 على `model.bin`)؛ يمكنك فرضه باستخدام `LOCAL_MODEL_BACKEND=transformers|ctranslate2` إذا احتجت لذلك.

**تأتي رموز اللغات من بطاقة اللغة، وليست تخمينًا.** بالنسبة لنموذج متعدد اللغات مثل NLLB، تقرأ بيئة الاختبار رمز FLORES-200 مباشرة من بطاقة اللغة المستهدفة (نفس مصدر الحقيقة الذي تستخدمه كل طريقة). اللغة التي لا يخدمها النموذج فعليًا — على سبيل المثال، لا يحتوي NLLB-200 على لغة Plains Cree (`crk`) — **تفشل بصدق** ("خارج نطاق هذا النموذج") بدلاً من إصدار رمز زائف وترجمة تبدو معقولة ولكنها خاطئة. نماذج OPUS-MT خاصة بأزواج لغوية، لذا فإن الزوج *هو* النموذج.

يتم تسجيل ونشر عملية تشغيل النموذج المحلي تمامًا مثل أي عملية تشغيل أخرى — نفس المقاييس، ونفس بطاقة التشغيل، ونفس لوحة الصدارة. (إنها طريقة بيئة اختبار؛ تصل إليها أداة الترجمة CLI لاحقًا عبر جسر عملية فرعية (subprocess bridge)، لذا لا تحتاج Node أبدًا إلى حزمة تعلم آلي (ML) بلغة Python.)

### المسار السريع للوكيل (Agent)

إذا كنت تعمل مع Claude Code أو وكيل برمجة آخر، فإن المساهمة بأكملها عبارة عن موجه (prompt) واحد:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## المستوى 0 — أمر واحد

أسرع طريقة للمساهمة هي السماح لبيئة الاختبار بأخذ أعلى قائمة الانتظار نيابة عنك:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

إنها لا تعيد الفرز أبدًا — ترتيب قائمة الانتظار *هو* [نموذج الأولوية](/docs/network/specifications/queue-construction) — وتعرض الخطة الكاملة مع الإنفاق المُقدر وتطلب الإذن قبل تنفيذ أي شيء. يتم تخطي العناصر الموجهة (coached items) ما لم تُحضر ملف التوجيه الخاص بك (`--include-coached --coaching-file my-coaching.txt`).

**ينشر عامل قائمة الانتظار نيابة عنك — لا حاجة لحساب.** على عكس `mt-eval run` الفردي (الذي لا ينشر تلقائيًا أبدًا)، يحل `mt-eval queue` هوية النشر *قبل* إنفاق أي رموز (tokens) و**ينشر تلقائيًا كل عملية تشغيل ناجحة** إلى لوحة الصدارة بمجرد اكتمالها — لا توجد خطوة نشر منفصلة. قم بتسجيل الدخول (GitHub/Google) فقط إذا كنت تريد ظهور اسمك على اللوحة؛ وإلا استمر كمجهول وستُنشر النتائج باسم المُرسل `anonymous` (يفرضه `--anonymous`، وعمليات التشغيل غير التفاعلية `curl | bash` التي لا تحتوي على تسجيل دخول مخزن مؤقتًا تعتمده افتراضيًا، وتعلن عن ذلك صراحةً). مرر `--no-publish` للاحتفاظ بالنتائج محليًا بدلاً من ذلك (يمكنك نشرها لاحقًا باستخدام `mt-eval publish`). ثم شاهد ما بنته عمليات التشغيل الخاصة بك على [الخريطة المباشرة في champollion.dev](https://champollion.dev).

## المستوى 1 — تشغيل معيار (Benchmark)

كل `run_command` لعنصر في قائمة الانتظار يكون مكتفيًا ذاتيًا. مثال نموذجي:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

أنت تمرر **مُعرّف السجل (registry id)**، وليس ملفًا — تجلب بيئة الاختبار المرجع من مصدره الأساسي (upstream) في وقت التشغيل وتقوم بالتسجيل مقابل البيانات التي تم جلبها حديثًا (لا يتم استضافة محتوى المتن اللغوي أو تتبعه هنا أبدًا).

تطبع عملية التشغيل تكلفتها الإجمالية وتكتب سجل تشغيل بالإضافة إلى تقرير مُسجل إلى `eval/logs/`. ثم انشر:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**لا حاجة لحساب.** يوفر النشر تسجيل دخول عبر OAuth (GitHub/Google) بحيث يصبح اسمك هو المنسوب إليه في لوحة الصدارة — ولكنه اختياري: ينشر `mt-eval publish <report> --anonymous` بدون حساب، ويُعرض الصف تمامًا مثل أي نتيجة أخرى ذاتية القياس (self-benchmarked) مع المُرسل `anonymous`. الاستقبال المجهول مقيد بمعدل (بضع بطاقات في الساعة لكل اتصال؛ تسجيل الدخول هو المسار غير المحدود) ويمر عبر نفس بوابات سلامة قاعدة البيانات مثل أي إرسال آخر — العزل (quarantine)، ونطاقات الدرجات، وربط corpus-sha، وحارس محتوى المتن اللغوي، كلها تُطبق بشكل متطابق. سواء كانت مجهولة أو منسوبة، تهبط إرسالات المجتمع في مستوى الثقة **ذاتي القياس (self-benchmarked)** — والمُسمى بوضوح "مُرسل من قبل الشخص الذي قام بتشغيله". هذا ليس تخفيضًا للمستوى؛ بل هو نموذج الثقة قيد العمل. تحمل بطاقة التشغيل كل ما يلزم لأي شخص لإعادة تشغيل التكوين الدقيق الخاص بك: تجزئة مجموعة البيانات، والنموذج، والحالة، وموجه النظام الكامل، والتكلفة. تُمنح المستويات المرتفعة (التحقق، والتحقق المجتمعي) من خلال المراجعة — راجع [قواعد لوحة الصدارة](/docs/network/leaderboard/rules).

:::note[الإشراف]
تخضع الصفوف المجهولة للإشراف مثل أي شيء آخر: الإرسالات غير قابلة للتغيير بالنسبة لواجهة برمجة التطبيقات (API) العامة، وأي إزالة أو تصحيح من قبل المنسق يمر عبر مسار دور الخدمة (service-role)، حيث يحفظ مسار التدقيق الخاص بقاعدة البيانات الصف السابق — لذا فإن أي عملية مسح تُسجل وتكون قابلة للعكس، ولا تتم بصمت أبدًا.
:::

## المستوى 2 — صياغة موجهات موجهة (Coached Prompts)

تتمتع بيئة الاختبار بدعم من الدرجة الأولى لـ **التوجيه (coaching)**: استبدل موجه النظام البسيط (naive) بآخر يحمل معرفة لغوية حقيقية. مرر `--coaching-file` (أو `--coaching "inline text"` للموجهات القصيرة) وستستخدم بيئة الاختبار النص الخاص بك كموجه للنظام، وتسجل **النص الكامل بالإضافة إلى SHA-256 الخاص به** في كتلة المصدر (provenance block) الخاصة بسجل التشغيل، وتُصنف حالة التشغيل كـ **`coached`** (ما لم تقم بتعيين `--prompt` صراحةً) — لذا فإن صياغة الموجهات هي تجربة قابلة للتكرار والإسناد، ولا يمكن أبدًا الخلط بين ملفي توجيه مختلفين، ولا يُخطأ أبدًا في اعتبار عمليات التشغيل الموجهة كخطوط أساس بسيطة (naive baselines) على لوحة الصدارة.

مثال عملي للغة الفاروية (Faroese)، باستخدام حقائق التصنيف اللغوي (typology) وإدخالات المسرد من [بطاقة اللغة العامة](https://champollion.dev/languages) الخاصة باللغة:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(اكتب محتوى التوجيه الخاص بك — توضح الحقائق أعلاه *الشكل*: بعض القواعد النحوية عالية التأثير، ومسرد صغير للمصطلحات التي يخطئ فيها النموذج، وتعليمات حول مستوى اللغة (register). تستشهد بطاقات اللغات في [champollion.dev/languages](https://champollion.dev/languages) بمصادر التصنيف اللغوي التي يمكنك الاستعانة بها.)

قارن مع خط الأساس البسيط (naive baseline) باستخدام `mt-eval compare <naive_log> <coached_log>`، وكرر العملية، وانشر أفضل عملية تشغيل لديك. تُنشر عملية التشغيل بالحالة `coached` تلقائيًا؛ إذا كنت تريد أن تعرض لوحة الصدارة طريقة مسماة بدلاً من التسمية العامة، فأرفق بطاقة طريقة (method card) عند النشر (يوفر مسار النشر معالجًا لذلك). إن التغلب على خط الأساس البسيط في زوج لغوي ذي موارد محدودة باستخدام هندسة الموجهات (prompt engineering) فقط هو اكتشاف حقيقي وقابل للنشر — راجع [دليل توجيه النماذج اللغوية الكبيرة (Coached LLM Prompting)](/docs/network/tutorials/coached-llm-prompting) الكامل للحصول على إرشادات التصميم.

## المستوى 3 — بناء طريقة (Method)

المساهمة الأكثر طموحًا: تنفيذ بروتوكول `TranslationMethod` (`translate(entries, config)`) وقياس أداء نظام فعلي، وليس موجهًا. تقوم بيئة الاختبار بتشغيله عبر `--method <plugin-dir>` وتضمين بطاقة الطريقة الخاصة بك في بطاقة التشغيل. الأنماط التي تحتوي على أدلة عملية (cookbooks):

- **[مسارات عمل مقيدة بـ FST](/docs/network/tutorials/fst-gated-pipeline)** — يتم فحص كل كلمة مرشحة بواسطة محلل صرفي؛ ويقوم النموذج اللغوي الكبير (LLM) بإعادة التوليد حتى يتم اجتياز القيد. مخرجات شبه حتمية ومضمونة صرفيًا.
- **[التوليد المعزز بالقاموس](/docs/network/tutorials/dictionary-augmented-llm)** — البحث عن المصطلحات المصدر في معجم ثنائي اللغة في وقت الترجمة وتقييد المخرجات.
- [النماذج المتسلسلة (Chained models)](/docs/network/tutorials/chained-models)، [الاسترجاع بلقطات قليلة (few-shot retrieval)](/docs/network/tutorials/few-shot-prompting)، [الترجمة العكسية (back-translation)](/docs/network/tutorials/back-translation)، [الهجائن القائمة على القواعد (rule-based hybrids)](/docs/network/tutorials/rule-based-hybrid)…

تُعلن الطرق عن **فئة التبعية (dependency class)** (S/O/A1/A2/X — راجع [مواصفات الطرق](/docs/network/specifications/methods#method-validity-and-dependency-classes)) التي تصف ما تحتاجه للتشغيل والنقل: مسار العمل المكتفي ذاتيًا هو الفئة S؛ والمسار الذي يستدعي واجهة برمجة تطبيقات (API) لقاموس مرخص في وقت التشغيل هو A2. أعلن بصدق — فالفئة تحدد أين يمكن لطريقتك المنافسة، وتخضع البيانات (manifests) للتدقيق.

## لماذا يهم هذا الأمر أبعد من لوحة الصدارة

تُعد كل عملية تشغيل منشورة دليلاً مستقلاً حول جودة الترجمة الآلية (MT) لزوج لغوي لا يقيسه المزودون التجاريون. تعمل قائمة الانتظار أيضًا كسجل عام لـ *الطلب*: أي الأزواج يعتبرها المجتمع جديرة بالقياس، وما هي تكلفة التغطية بأسعار واجهة برمجة التطبيقات (API) الحالية، وإلى أي مدى تمتد الحوسبة المُساهم بها. عندما نطلب من وكالات التمويل ضمان عمليات مسح منهجية، فإن قائمة الانتظار هذه ومعدل امتلائها هما الدليل على الطلب.
