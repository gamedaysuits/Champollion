---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **ملخص تنفيذي.** تغطي هذه الصفحة تثبيت وتكوين واستخدام أداة تقييم الترجمة الآلية (MT evaluation harness) — وهي الأداة التي تقيس أداء طرق الترجمة مقارنة بالمدونات اللغوية الموحدة وتنتج بطاقات تشغيل (run cards) مسجلة. للحصول على التعريفات المعتمدة للمقاييس والمخططات وبروتوكول التقييم، راجع [مواصفات المعيار المرجعي](/docs/network/specifications/benchmark).

تُشغّل أداة التقييم تجارب الترجمة وتنتج بطاقات التشغيل. وتتولى بناء التلقينات (prompts)، واستدعاءات واجهة برمجة التطبيقات (API)، وحساب الدرجات، وتسلسل النتائج — بينما تقوم أنت بتوفير مجموعة البيانات والنموذج.

## التثبيت

**المتطلبات:** Python 3.10+

```bash
pip install mt-eval-harness
```

يؤدي هذا إلى تثبيت الأمر `mt-eval`.

## الاستخدام

```bash
mt-eval run --corpus path/to/dataset.json
```

يؤدي هذا إلى تمرير كل مُدخل في المدونة اللغوية عبر النموذج المُكوّن (أو المكون الإضافي للطريقة)، ويحسب درجات المخرجات، ويكتب ملف JSON لبطاقة التشغيل في دليل المخرجات.

## علامات واجهة سطر الأوامر (CLI Flags)

### `mt-eval run`

| العلامة | مطلوب | الافتراضي | الوصف |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | مسار ملف المدونة اللغوية (`.json`، `.jsonl`، `.tsv`) |
| `--source-file` / `--reference-file` | — | — | ملفات نصية متوازية (تنسيق FLORES+، WMT) |
| `-m, --model` | — | `gemini-pro` | الاسم المختصر للنموذج (slug) (الاسم القصير أو معرّف OpenRouter الكامل). يتم حله عبر `shared/model-aliases.json`. مفصول بفواصل لعمليات التشغيل متعددة النماذج |
| `-d, --dataset` | — | `all` | عامل تصفية مجموعة البيانات: `all`، أو اسم المقطع، أو نطاق المعرّفات |
| `--ids` | — | — | معرّفات المُدخلات مفصولة بفواصل لتقييمها |
| `--source-lang` | — | `English` | اسم اللغة المصدر |
| `--target-lang` | — | — | اسم اللغة الهدف |
| `-p, --prompt` | — | `naive` | إصدار التلقين (`naive`، `custom`، `champollion`) |
| `--coaching-file` | — | — | مسار ملف النص الخاص بتلقين التوجيه (coaching prompt) |
| `--coaching` | — | — | نص التوجيه المضمن (سلسلة نصية مقتبسة) |
| `--method` | — | — | مسار دليل المكون الإضافي للطريقة (يحتوي على `method.json` + وحدة Python) |
| `--method-card` | — | — | مسار ملف JSON لبطاقة الطريقة الخاص بالبيانات الوصفية للوحة الصدارة |
| `--fst-retries` | — | `0` | عدد محاولات إعادة المحاولة لـ FST (طريقة LLM الافتراضية فقط) |
| `--skip-fst` | — | `false` | تخطي بوابة جودة FST بالكامل |
| `--tools` | — | `false` | تمكين وضع استدعاء الأدوات (tool-calling) |
| `--tools-list` | — | — | أسماء الأدوات مفصولة بفواصل |
| `--max-tool-rounds` | — | `8` | الحد الأقصى لجولات استدعاء الأدوات لكل مُدخل |
| `--hooks` | — | — | أسماء خطافات (hooks) ما بعد الترجمة |
| `--style-profile` | — | — | مسار ملف JSON لملف تعريف النمط. يمكّن مقاييس اتساق أسلوب الكتابة (للعلم فقط — لا تكون أبدًا جزءًا من الدرجة المركبة؛ راجع [§ مقاييس أسلوب الكتابة والمستوى اللغوي](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | المُدخلات لكل استدعاء لواجهة برمجة التطبيقات (API) |
| `-c, --concurrency` | — | `8` | استدعاءات واجهة برمجة التطبيقات (API) المتوازية |
| `--max-tokens` | — | `32768` | الحد الأقصى للرموز (tokens) لكل استدعاء لواجهة برمجة التطبيقات |
| `--temperature` | — | `0.0` | درجة حرارة أخذ العينات (0.0 = حتمي) |
| `--no-cache` | — | `false` | تعطيل التخزين المؤقت للاستجابات |
| `--cache-dir` | — | `eval/cache/harness` | مسار دليل التخزين المؤقت |
| `-o, --output-dir` | — | `eval/logs/harness` | دليل المخرجات لبطاقات التشغيل والسجلات |
| `-n, --name` | — | — | اسم تشغيل مقروء بشريًا |
| `--dry-run` | — | `false` | التحقق من صحة التكوين دون إجراء استدعاءات لواجهة برمجة التطبيقات |
| `--champollion-config` | — | — | مسار إلى `champollion.config.json` |
| `--champollion-cards-dir` | — | — | دليل بطاقات اللغات |
| `--target-lang-code` | — | — | رمز لغة BCP-47 |

### كل أمر فرعي

جميع الأوامر الفرعية الثمانية عشر ذات المستوى الأعلى، تم إنشاؤها مقابل `mt_eval_harness/cli.py`
في 2026-08-01. حتى ذلك الحين، كان هذا القسم يسرد سبعة منها، وستة —
بما في ذلك `node`، عقدة تسجيل المنظم السيادي — لم تكن موثقة
**لا هنا ولا في دليل أداة التقييم**.

**التشغيل وحساب الدرجات**

| الأمر الفرعي | وظيفته |
|---|---|
| `mt-eval run` | تنفيذ عملية تشغيل ترجمة (العلامات المذكورة أعلاه) |
| `mt-eval test <log>` | تحليل سجل تشغيل مكتمل |
| `mt-eval compare <logs…>` | مقارنة سجلات تشغيل متعددة |
| `mt-eval dashboard <logs…>` | إنشاء لوحة تحكم HTML تفاعلية |
| `mt-eval card <run-card>` | طباعة بطاقة تشغيل منسقة ومقروءة بشريًا |

**إيجاد طريقك إلى طريقة ما**

| الأمر الفرعي | وظيفته |
|---|---|
| `mt-eval recommend <src> <tgt>` | إرشادات الطريقة لزوج لغوي — التوفر بالإضافة إلى **الأدلة المستشهد بها**، وليس مجرد تصنيف مجرد |
| `mt-eval corpora --source X --target Y` | سرد مدونات التقييم اللغوية المتاحة لزوج لغوي |
| `mt-eval list models\|prompts\|datasets` | سرد الموارد المتاحة |

**المساهمة**

| الأمر الفرعي | وظيفته |
|---|---|
| `mt-eval publish <report>` | إرسال TestReport إلى لوحة الصدارة |
| `mt-eval queue` | تشغيل أعلى قائمة انتظار الحوسبة المجتمعية باستخدام مفتاحك الخاص — راجع [المساهمة في الحوسبة](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | حزم TestReport كمكون إضافي لطريقة champollion |
| `mt-eval generate-plugin` | اسم مستعار لـ `export` |
| `mt-eval export-config` | إنشاء مقتطف `champollion.config.json` من TestReport |

**المسابقات، وإدارة واحدة بنفسك**

| الأمر الفرعي | وظيفته |
|---|---|
| `mt-eval contest` | إدارة مسابقات التقييم — `prepare`، `register`، `create`، `submit`، `submit-hypotheses`، `status`، `list` |
| `mt-eval shared-task` | مظلة إصدار المهام المشتركة متعددة الأزواج: يجمع صف واحد مسابقات N لكل زوج من إصدار بأسلوب AmericasNLP ويحمل الإعدادات الافتراضية لسياسته. **التجميع والإعدادات الافتراضية فقط — تظل كل بوابة خاصة بكل مسابقة** |
| `mt-eval node` | **عقدة تسجيل المنظم.** استيعاب الاستطلاعات، والبوابة على المؤهل العام، وتفويض سياسة كل مسابقة، وحساب الدرجات مقابل **المراجع السرية التي يحتفظ بها المنظم**، ونشر الدرجات فقط. هذا هو الأمر الذي يقف وراء [إدارة مسابقة سيادية](/docs/network/sovereignty/run-a-sovereign-contest) و [عقدة التقييم السيادية](/docs/network/sovereignty/sovereign-eval-node) — لا تغادر المدونة اللغوية جهاز المنظم أبدًا |

يحتوي `mt-eval node` على سبعة عشر أمرًا فرعيًا خاصًا به، بما في ذلك مسار العزل المادي (airgap lane)
(`import-bundle`، `export-scores`، `relay`، `egress-check`، `manifest`) و
مراسم الحفظ M-of-N (`ceremony`، `seal`، `keygen`، `sign-manifest`،
`verify-manifest`، `ledger`). قم بتشغيل `mt-eval node --help`؛ آليات السيادة
موضحة في الصفحتين المرتبطتين أعلاه.

**الإعداد**

| الأمر الفرعي | وظيفته |
|---|---|
| `mt-eval setup` | تثبيت التبعيات الاختيارية (المقياس العصبي COMET، وقت تشغيل FST) |
| `mt-eval logout` | إزالة بيانات اعتماد المصادقة المخزنة |

### أمثلة

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## مخطط بطاقة التشغيل (Run Card Schema)

تنتج كل تجربة **بطاقة تشغيل (run card)** — وهي مستند JSON مستقل بذاته. الهيكل ذو المستوى الأعلى:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

راجع [مواصفات بطاقة التشغيل](/docs/network/specifications/run-card) للحصول على المخطط الكامل مع توثيق كل حقل.

:::info[المخطط المعتمد]
تُعد [مواصفات المعيار المرجعي](/docs/network/specifications/benchmark) المصدر الوحيد للحقيقة لمخطط بطاقة التشغيل. للحصول على تعريفات المقاييس، والأوزان المركبة، ومستويات الجودة، راجع [مواصفات حساب الدرجات](/docs/network/specifications/scoring). توثق هذه الصفحة كيفية استخدام أداة التقييم؛ بينما تحدد المواصفات معنى المخرجات.
:::

### الكتل الرئيسية

**`dataset`** — يحدد مجموعة البيانات التي تم استخدامها، بما في ذلك تجزئة محتواها (content hash) بحيث ترتبط النتائج بإصدار معين:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — المقاييس المجمعة لعملية التشغيل:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — استخدام الرموز (tokens) وتتبع التكلفة:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## مقاييس أسلوب الكتابة والمستوى اللغوي (للعلم فقط) {#writing-style-and-register-metrics-informational}

يمكن لأداة التقييم تقييم ما إذا كانت الترجمات تتطابق مع **المستوى اللغوي (register)** و **أسلوب الكتابة** المستهدفين، عبر المكون الإضافي للمقياس `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). يمكن أن تكون الترجمة صحيحة لغويًا ولكن في مستوى لغوي خاطئ — صياغة غير رسمية في مستند قانوني، أو نصوص رسمية جاهزة في نسخة تسويقية — ولن تلاحظ مقاييس السلاسل النصية ذلك. بينما تلاحظ هذه المقاييس ذلك.

**ما يتم قياسه (لكل مُدخل):**

| المقياس | المقياس المتدرج | المعنى |
|--------|-------|---------|
| `style_register_match` | منطقي (boolean) | هل تتطابق المخرجات مع المستوى اللغوي المتوقع؟ يأتي الهدف من حقل `register` الخاص بمُدخل المدونة اللغوية (راجع [مواصفات المعيار المرجعي §2.6](/docs/network/specifications/benchmark)) أو من ملف تعريف النمط |
| `style_sentence_length_ratio` | عدد عشري (float) | متوسط طول الجملة المتوقع مقابل المرجعي (1.0 = تطابق؛ التباعد = انحراف الأسلوب) |
| `style_formality_score` | 0.0–1.0 | وجود علامات رسمية/غير رسمية (ضمائر T–V، الاختصارات، ...) باستخدام موارد العلامات الخاصة بكل لغة |

**المُجمّع:** `style_consistency_rate` — نسبة المُدخلات التي لم يُكتشف فيها عدم تطابق في المستوى اللغوي.

قم بتمكين هدف مخصص باستخدام `--style-profile path/to/profile.json` (على سبيل المثال، ملف تعريف صوت العلامة التجارية)؛ وبدونه، يتراجع المكون الإضافي إلى البيانات الوصفية `register` الخاصة بكل مُدخل في المدونة اللغوية حيثما وجدت.

:::caution[تحديد النطاق بصدق]
هذه المقاييس **للعلم فقط** — ولا تكون أبدًا جزءًا من الدرجة المركبة، كما أن اكتشاف الرسمية يعتمد على العلامات (طريقة استدلالية)، وليس حكمًا مكتسبًا بالتعلم. تعامل معها ككاشف انحراف للالتزام بالمستوى اللغوي، وليس كحكم نهائي على جودة الأسلوب.
:::

---

## البصمة مقابل تجزئة بطاقة التشغيل {#fingerprint-vs-run-card-hash}

تنتج أداة التقييم تجزئتين (hashes) مختلفتين. وتخدمان أغراضًا مختلفة:

### البصمة (Fingerprint)

تجيب **البصمة** على سؤال: *"هل يمكن إعادة إنتاج عملية التشغيل هذه؟"*

تقوم بتجزئة مجموعة المدخلات التي تحدد تكوين التجربة — وليس المخرجات:

- SHA-256 لمجموعة البيانات
- الاسم المختصر للنموذج (Model slug)
- تسمية الشرط (Condition label)
- SHA-256 لتلقين النظام
- درجة الحرارة (Temperature)
- إصدار أداة التقييم

عمليتا تشغيل ببصمات متطابقة استخدمتا نفس الإعداد. يجب أن تكون نتائجهما قابلة للمقارنة (باستثناء عدم الحتمية في واجهة برمجة التطبيقات).

### تجزئة بطاقة التشغيل (Run Card Hash)

تجيب **تجزئة بطاقة التشغيل** على سؤال: *"هل تم العبث بملف النتائج المحدد هذا؟"*

إنها تجزئة SHA-256 لملف JSON الخاص ببطاقة التشغيل بالكامل (باستثناء حقل `run_card_hash` نفسه). إذا تغير أي حقل — درجة، أو طابع زمني، أو مُخرج واحد — تنكسر التجزئة.

:::info[متى تستخدم أيهما]
استخدم **البصمة** لتجميع عمليات التشغيل القابلة للمقارنة (نفس التجربة، عمليات تنفيذ مختلفة). استخدم **تجزئة بطاقة التشغيل** للتحقق من سلامة ملف نتائج معين.
:::

---

## النشر على لوحة الصدارة (Leaderboard)

بعد إكمال عملية التشغيل، استخدم `mt-eval publish` لإرسال بطاقة التشغيل:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

إذا لم يتم توفير `--method-card` أثناء التشغيل، يقوم `mt-eval publish` بتشغيل معالج تفاعلي (`method_card_wizard.py`) يرشدك خلال وصف طريقتك (الاسم، الفئة، الأدوات المستخدمة، إلخ). يتم تضمين مخرجات المعالج في بطاقة التشغيل قبل الإرسال.

### الفحص اليدوي

يتم حفظ بطاقات التشغيل كملفات JSON في دليل المخرجات (`eval/logs/harness/` افتراضيًا) — افحصها هناك قبل النشر. `mt-eval publish` هو مسار الإرسال؛ ولا يوجد استيعاب لبطاقات التشغيل قائم على طلبات السحب (PR).

:::note[واجهة برمجة تطبيقات الإرسال والتحميل عبر الويب ليسا متاحين بعد]
من المخطط توفير نقطة نهاية `POST https://champollion.dev/api/leaderboard/submit` وواجهة مستخدم لتحميل لوحة الصدارة ولكن **لم يتم تنفيذهما بعد**. حتى يتم إصدارهما، فإن مسار الإرسال الوحيد الذي يعمل هو `mt-eval publish`.
:::

:::warning[التحقق من صحة لوحة الصدارة]
تتحقق لوحة الصدارة من صحة بطاقات التشغيل المرسلة مقابل سجل مجموعة البيانات. يتم رفض عمليات الإرسال التي تشير إلى مجموعات بيانات غير معروفة، أو التي تحتوي على `run_card_hash` مكسور.
:::

:::danger[لا تتدرب على بيانات التقييم]
إذا كانت طريقتك قد اطلعت على مجموعة بيانات التقييم أثناء التطوير — كبيانات تدريب، أو أمثلة قليلة اللقطات (few-shot)، أو مُدخلات قاموس، أو مواد هندسة التلقين — فسيتم **استبعاد** إرسالك. راجع [تقييم الترجمة الآلية](/docs/network/leaderboard/rules) لمعرفة ما الذي يجعل الطريقة جيدة مقابل سيئة.
:::

---

## انظر أيضًا

- [تقييم الترجمة الآلية](/docs/network/leaderboard/rules) — نظرة عامة، وعرض القيمة للوحة الصدارة، وإرشادات الطريقة الجيدة/السيئة
- [مجموعات بيانات التقييم](/docs/network/leaderboard/datasets) — تنسيق مجموعة البيانات، EDTeKLA، FLORES+
- [مواصفات بطاقة التشغيل](/docs/network/specifications/run-card) — مخطط JSON الكامل
- [بناء طريقة](/docs/network/specifications/methods) — واجهة الطريقة لإنشاء طرق قابلة للتقييم
- [لوحة صدارة الطرق](https://champollion.dev/leaderboard) — درجات المعيار المرجعي المباشرة
- [مواصفات المعيار المرجعي](/docs/network/specifications/benchmark) — بروتوكول التقييم، وتنسيق المدونة اللغوية، ومخطط بطاقة التشغيل
- [مواصفات حساب الدرجات](/docs/network/specifications/scoring) — المصدر الوحيد للحقيقة (SSOT) للمقاييس، والأوزان المركبة، ومستويات الجودة
