---
sidebar_position: 4
title: "مواصفات Run Card"
---

# مواصفات بطاقة التشغيل

> **ملخص تنفيذي.** تعد بطاقة التشغيل الوحدة الأساسية لقياس الأداء — وهي عبارة عن مستند JSON يسجل التكوين الكامل، والنتائج لكل إدخال، والدرجات الإجمالية لعملية تقييم واحدة. توثق هذه الصفحة المخطط، والحقول، وآلية البصمة، وهيكل الدرجات. راجع [مواصفات قياس الأداء](/docs/network/specifications/benchmark) للحصول على التعريفات الأساسية.

تعد بطاقة التشغيل السجل الكامل لعملية تقييم واحدة. فهي تحتوي على كل ما يلزم لفهم التجربة وإعادة إنتاجها والتحقق منها: التكوين، والدرجات، والنتائج الفردية، واستخدام الرموز (tokens)، والبيانات الوصفية للبيئة.

**إصدار المخطط:** 2.0

:::info[المخطط المعتمد]
تعد [مواصفات قياس الأداء](/docs/network/specifications/benchmark) المصدر الوحيد المعتمد لمخطط بطاقة التشغيل. للحصول على تعريفات المقاييس، والأوزان المركبة، ومستويات الجودة، راجع [مواصفات تسجيل الدرجات](/docs/network/specifications/scoring). توثق هذه الصفحة التنفيذ الحالي.
:::

---

## حقول المستوى الأعلى

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `run_id` | `string` | معرّف فريد عالميًا (UUID v4) يتم إنشاؤه عند بدء التشغيل |
| `harness_version` | `string` | الإصدار الدلالي (Semantic version) لأداة الاختبار (harness) التي أنتجت هذه البطاقة (مثل `2.0`) |
| `model_slug` | `string` | الاسم اللطيف للنموذج (Model slug) المستخدم في التشغيل (مثل `google/gemini-3.1-pro`) |
| `model_id` | `string` | معرّف النموذج الذي تم حله والمُرجع بواسطة واجهة برمجة التطبيقات (API) (مثل `gemini-3.1-pro-001`) |
| `condition` | `string` | تسمية التجربة (مثل `baseline`، `coached-v3`، `few-shot`) |
| `timestamp` | `string` | طابع زمني بتنسيق ISO 8601 بالتوقيت العالمي المنسق (UTC) لوقت بدء التشغيل |
| `elapsed_seconds` | `number` | المدة الزمنية الفعلية (Wall-clock duration) لعملية التشغيل بأكملها |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

يحدد مجموعة بيانات التقييم ويربطها بإصدار محتوى محدد عبر خوارزمية SHA-256.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `id` | `string` | معرّف مجموعة البيانات (مثل `edtekla-dev-v1`) |
| `version` | `string` | سلسلة نصية لإصدار مجموعة البيانات |
| `language_pair` | `string` | تسمية العرض (مثل `EN→CRK`) |
| `sha256` | `string` | تجزئة SHA-256 لمحتويات ملف مجموعة البيانات. تضمن استخدام البيانات الدقيقة |
| `entry_count` | `number` | عدد الإدخالات في مجموعة البيانات |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

تكوين واجهة برمجة التطبيقات (API) والمعالجة المجمعة (batching) المستخدم في هذا التشغيل.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `api_provider` | `string` | اسم مزود واجهة برمجة التطبيقات (مثل `openrouter`) |
| `temperature` | `number` | درجة حرارة أخذ العينات (Sampling temperature) |
| `max_tokens` | `number` | الحد الأقصى للرموز (tokens) لكل إكمال |
| `batch_size` | `number` | الإدخالات لكل دفعة متزامنة |
| `concurrency` | `number` | الحد الأقصى لطلبات واجهة برمجة التطبيقات المتوازية |
| `coaching_file` | `string` | مسار ملف التوجيه الإرشادي (coaching prompt)، إن وُجد |
| `method_path` | `string` | مسار دليل المكون الإضافي للطريقة (method plugin)، إن وُجد |
| `fst_retries` | `number` | عدد محاولات إعادة المحاولة لمحلل FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[بطاقات التشغيل المنشورة تتضمن `method_config`]
عند نشر بطاقة تشغيل عبر `mt-eval publish`، تقوم `publish.py` بحقن كتلة `method_config` تحتوي على تكوين MethodConfig الأساسي المكون من 8 حقول. يتيح ذلك تثبيت لوحة الصدارة (leaderboard) بسلاسة تامة — حيث يمكن لأي شخص إعادة إنتاج الطريقة مباشرة من البطاقة المنشورة.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

تستخدم جميع الحقول تنسيق **camelCase** وتتبع مخطط MethodConfig الأساسي (راجع [بناء طريقة](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | تجزئة SHA-256 لموجه النظام (system prompt). مُضمنة في البصمة |
| `system_prompt_used` | `string` | النص الكامل لموجه النظام المُرسل إلى النموذج |

تعد تجزئة الموجه جزءًا من [البصمة](#fingerprint) — سيكون لعمليتي تشغيل بموجهات مختلفة بصمات مختلفة حتى لو تطابقت جميع الإعدادات الأخرى.

---

## `fingerprint`

معرّف قابلية إعادة الإنتاج. عمليتا التشغيل اللتان لهما بصمات متطابقة استخدمتا نفس الإعداد التجريبي.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `hash` | `string` | تجزئة SHA-256 للمكونات المصنفة |
| `components` | `object` | قيم الإدخال التي تم تجزئتها |

### مكونات البصمة

| المكون | الوصف |
|-----------|-------------|
| `dataset_sha256` | تجزئة ملف مجموعة البيانات |
| `model_slug` | النموذج المستخدم |
| `condition` | تسمية حالة التجربة |
| `system_prompt_sha256` | تجزئة موجه النظام |
| `temperature` | درجة حرارة أخذ العينات |
| `harness_version` | إصدار أداة الاختبار (Harness) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[البصمة ≠ تجزئة بطاقة التشغيل]
تحدد البصمة *تكوين التجربة*. بينما تتحقق `run_card_hash` من *سلامة ملف النتائج*. راجع [البصمة مقابل تجزئة بطاقة التشغيل](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) للحصول على التفاصيل.
:::

---

## `scores`

المقاييس الإجمالية لعملية التشغيل بأكملها.

### درجات المستوى الأعلى

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `total` | `number` | إجمالي الإدخالات التي تم تقييمها |
| `exact_matches` | `number` | الإدخالات التي تطابق فيها المخرجات تمامًا مع المعيار الذهبي (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | الإدخالات التي قَبِل فيها محلل FST المخرجات |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). `null` إذا لم يتم استخدام محلل FST |
| `chrf_plus_plus` | `number` | درجة chrF++ على مستوى المجموعة (0–100) |
| `errors` | `number` | الإدخالات التي فشلت (خطأ في واجهة برمجة التطبيقات، انتهاء المهلة، إلخ) |
| `avg_latency_seconds` | `number` | متوسط وقت الاستجابة عبر جميع الإدخالات |
| `median_latency_seconds` | `number` | وسيط وقت الاستجابة |
| `p95_latency_seconds` | `number` | النسبة المئوية 95 لوقت الاستجابة |

### `by_difficulty`

الدرجات مقسمة حسب مستوى الصعوبة. يحتوي كل مفتاح (عدد صحيح 1–5) على نفس حقول المقاييس الموجودة في درجات المستوى الأعلى.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

الدرجات مقسمة حسب مصدر الإدخال. يحتوي كل مفتاح (مثل `gold_standard`، `textbook`) على نفس حقول المقاييس.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

تتبع استخدام الرموز (tokens) والتكلفة لعملية التشغيل بأكملها.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `prompt_tokens` | `number` | إجمالي رموز الإدخال عبر جميع استدعاءات واجهة برمجة التطبيقات |
| `completion_tokens` | `number` | إجمالي رموز الإخراج |
| `reasoning_tokens` | `number` | الرموز المستخدمة في التفكير المتسلسل (chain-of-thought) (يعتمد على النموذج، 0 لمعظم النماذج) |
| `cached_tokens` | `number` | الرموز المقدمة من ذاكرة التخزين المؤقت للموجه الخاصة بالمزود |
| `total_cost_usd` | `number` | التكلفة الإجمالية بالدولار الأمريكي (كما تم الإبلاغ عنها بواسطة واجهة برمجة التطبيقات) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

البيانات الوصفية لبيئة وقت التشغيل من أجل قابلية إعادة الإنتاج.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `harness_version` | `string` | إصدار أداة الاختبار (يعكس `harness_version` في المستوى الأعلى) |
| `harness_git_commit` | `string` | تجزئة التزام Git (Git commit SHA) لأداة الاختبار في وقت التشغيل |
| `python_version` | `string` | إصدار مفسر بايثون (Python interpreter) |
| `sacrebleu_version` | `string` | إصدار مكتبة sacrebleu (المستخدمة لتسجيل درجات chrF++) |
| `os` | `string` | معرّف نظام التشغيل |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

مصفوفة النتائج لكل إدخال. كائن واحد لكل إدخال في مجموعة البيانات، بترتيب الفهرس.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `entry_id` | `integer` | معرّف هذا الإدخال في المجموعة (يطابق `entries[].id`) |
| `source` | `string` | النص المصدر الذي تمت ترجمته |
| `reference` | `string` | المرجع المعياري الذهبي من المجموعة |
| `predicted` | `string` | المخرجات الفعلية للطريقة |
| `exact_match` | `boolean` | ما إذا كان `predicted` يطابق تمامًا `reference` بعد التسوية (normalization) |
| `entry_chrf` | `number` | درجة chrF++ على مستوى الجملة لهذا الإدخال (0–100) |
| `fst_accepted` | `boolean \| null` | ما إذا كان محلل FST قد قَبِل المخرجات. `null` إذا لم يتم تكوين أي محلل |
| `fst_analysis` | `string[]` | سلاسل تحليل FST للمخرجات (مصفوفة فارغة إذا لم يتم تحليلها أو تم رفضها) |
| `difficulty` | `integer` | مستوى الصعوبة من المجموعة (1–5) |
| `provenance` | `string` | علامة المصدر (Provenance tag) من المجموعة |
| `latency_seconds` | `number` | وقت الاستجابة لهذا الإدخال الفردي |
| `usage` | `object` | استخدام الرموز لكل إدخال: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | رسالة الخطأ إذا فشل هذا الإدخال. `null` عند النجاح |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `run_card_hash` | `string` | تجزئة SHA-256 لملف JSON الخاص ببطاقة التشغيل بأكملها، مع تعيين الحقل `run_card_hash` نفسه إلى `""` أثناء التجزئة |

هذا هو ختم اكتشاف التلاعب. تعيد لوحة الصدارة حساب هذه التجزئة عند الإرسال وترفض البطاقات التي لا تتطابق فيها.

**حساب التجزئة:**

1. تسلسل (Serialize) بطاقة التشغيل إلى JSON مع تعيين `run_card_hash` إلى `""`
2. حساب SHA-256 للسلسلة المتسلسلة
3. تعيين `run_card_hash` إلى الملخص السداسي العشري (hex digest) الناتج

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[التحليل التفصيلي لكل إدخال]
تقوم بطاقات التشغيل المنشورة أيضًا بملء جدول Supabase `run_card_entries`، والذي يخزن النتائج لكل إدخال للتحليل التفصيلي (drill-down analysis) على لوحة الصدارة. يتم ملء هذا الجدول تلقائيًا أثناء `mt-eval publish`.
:::

---

## انظر أيضًا

- [تقييم الترجمة الآلية (MT Evaluation)](/docs/network/leaderboard/rules) — نظرة عامة، وقيمة لوحة الصدارة، وإرشادات الطريقة الجيدة/السيئة
- [أداة التقييم (Eval Harness)](/docs/network/specifications/harness) — كيفية تشغيل التقييمات وإنشاء بطاقات التشغيل
- [مجموعات بيانات التقييم](/docs/network/leaderboard/datasets) — تنسيق مجموعة البيانات، EDTeKLA، FLORES+
- [بناء طريقة](/docs/network/specifications/methods) — واجهة الطريقة ومواصفات بطاقة الطريقة
- [لوحة صدارة الطرق](https://champollion.dev/leaderboard) — درجات قياس الأداء المباشرة
- [مواصفات قياس الأداء](/docs/network/specifications/benchmark) — بروتوكول التقييم، وتنسيق المجموعة، ومخطط بطاقة التشغيل
- [مواصفات تسجيل الدرجات](/docs/network/specifications/scoring) — المصدر الوحيد المعتمد (SSOT) للمقاييس، والأوزان المركبة، ومستويات الجودة
