---
sidebar_position: 4
title: "مواصفات بطاقة التشغيل"
---

# مواصفات بطاقة التشغيل

> **ملخص تنفيذي.** بطاقة التشغيل هي الوحدة الأساسية للتقييم المعياري — وهي مستند JSON يسجل التهيئة الكاملة، والنتائج الخاصة بكل مدخلة، والدرجات الإجمالية لجولة تقييم واحدة. توثق هذه الصفحة المخطط (schema)، والحقول، وآلية إنشاء البصمة (fingerprinting)، وبنية الدرجات. راجع [مواصفات التقييم المعياري](/docs/network/specifications/benchmark) للاطلاع على التعريفات المرجعية المعتمدة.

تُعد بطاقة التشغيل السجل الكامل لجولة تقييم فردية. وهي تحتوي على كل ما يلزم لفهم التجربة وإعادة إنتاجها والتحقق منها: التهيئة، والدرجات، والنتائج الفردية، واستخدام الرموز (tokens)، والبيانات الوصفية للبيئة.

**إصدار المخطط:** 2.0

:::info[المخطط المعتمد]
تُعد [مواصفات التقييم المعياري](/docs/network/specifications/benchmark) المصدر الموثوق الوحيد (single source of truth) لمخطط بطاقة التشغيل. للاطلاع على تعريفات المقاييس وكيفية احتساب درجات جولات التشغيل (النتيجة الرئيسية لمقياس chrF++، والمقاييس القياسية المصاحبة له، والتشخيصات)، راجع [مواصفات احتساب الدرجات](/docs/network/specifications/scoring). توثق هذه الصفحة التنفيذ الحالي.
:::

---

## الحقول ذات المستوى الأعلى

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 يتم إنشاؤه عند بدء جولة التشغيل |
| `harness_version` | `string` | الإصدار الدلالي (semantic version) لبيئة التقييم (harness) التي أنشأت هذه البطاقة (مثال: `2.0`) |
| `model_slug` | `string` | المعرف المختصر للنموذج (slug) المستخدم في جولة التشغيل (مثال: `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | معرّف النموذج المحلول الذي ترجعه واجهة برمجة التطبيقات (API) (مثال: `gemini-3.1-pro-001`) |
| `condition` | `string` | تسمية التجربة: ما تكتبه بيئة التقييم هو `naive` (المطالبة المضمنة)، أو `coached` (ملف توجيه استبدلها)، أو فئة الطريقة لملحق الطريقة (method plugin)؛ وهو نص حر، لذا قد تشير البطاقة المبنية يدويًا إلى `coached-v3` أو `few-shot`. هذه ليست تسمية جودة (تم إلغاء مستويات الجودة؛ `scores.quality_tier` فارغ (null) في كل بطاقة جديدة) |
| `timestamp` | `string` | طابع زمني بتنسيق ISO 8601 UTC عند بدء جولة التشغيل |
| `elapsed_seconds` | `number` | المدة الزمنية الفعلية (wall-clock) لجولة التشغيل بأكملها |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

يحدد مجموعة بيانات التقييم ويثبتها على إصدار محتوى محدد عبر SHA-256.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `id` | `string` | معرّف مجموعة البيانات (مثال: `edtekla-dev-v1`) |
| `version` | `string` | سلسلة نصية لإصدار مجموعة البيانات |
| `language_pair` | `string` | تسمية العرض (مثال: `EN→CRK`) |
| `sha256` | `string` | تجزئة SHA-256 لمحتويات ملف مجموعة البيانات. تضمن استخدام البيانات ذاتها بدقة |
| `entry_count` | `number` | عدد المدخلات في مجموعة البيانات |

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

تهيئة واجهة برمجة التطبيقات (API) والدفعات (batching) المستخدمة لجولة التشغيل هذه.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `api_provider` | `string` | ما نقل النص: موفر واجهة برمجة التطبيقات (API provider) لمسار LLM الخاص ببيئة التقييم نفسها (`openrouter`، `openai`، `anthropic`، `gemini`، `local`)؛ معرّف المحرك لمحرك ترجمة آلية (MT) (مثال: `google-translate`)؛ ولملحق طريقة (method plugin)، `local` عندما يقر مشغله باستخدام نقل محلي بالكامل (`--attest-local-transport`)، وإلا فـ `method-plugin` |
| `temperature` | `number` | درجة حرارة أخذ العينات (Sampling temperature) |
| `max_tokens` | `number` | الحد الأقصى للرموز (tokens) لكل إكمال |
| `batch_size` | `number` | عدد المدخلات لكل دفعة متزامنة |
| `concurrency` | `number` | الحد الأقصى لطلبات واجهة برمجة التطبيقات المتوازية |
| `coaching_file` | `string` | المسار إلى ملف مطالبة التوجيه (coaching prompt)، إذا تم استخدامه (السجل الخاص بسجل التشغيل؛ البطاقة المنشورة تذكر التوجيه باسم الملف، أو `inline coaching` لنص `--coaching` — وليس مسارًا محليًا أبدًا) |
| `method_path` | `string` | المسار إلى دليل ملحق الطريقة (method plugin)، إذا تم استخدامه |
| `fst_retries` | `number` | عدد محاولات إعادة FST |

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

:::info[تتضمن بطاقات التشغيل المنشورة `method_config`]
عند نشر بطاقة تشغيل عبر `mt-eval publish`، يقوم `publish.py` بحقن كتلة `method_config` تحتوي على تهيئة MethodConfig القياسية المكونة من 8 حقول. يتيح ذلك التثبيت المباشر من لوحة الصدارة دون أي عناء — حيث يمكن لأي شخص إعادة إنتاج الطريقة مباشرة من البطاقة المنشورة.

```json
{
  "method_config": {
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

يكون `qualityTier` دائمًا `null` في أي بطاقة جديدة: فقد تم إلغاء مستويات الجودة. تستخدم جميع الحقول أسلوب **camelCase** وتتبع المخطط المعتمد لـ MethodConfig (راجع [بناء طريقة](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | تجزئة SHA-256 لمطالبة النظام (system prompt). مدرجة في البصمة |
| `system_prompt_used` | `string` | النص الكامل لمطالبة النظام المرسلة إلى النموذج |

تعد تجزئة المطالبة جزءًا من [البصمة](#fingerprint) — وسيكون لجولتي تشغيل بمطالبات مختلفة بصمات مختلفة حتى لو تطابقت جميع الإعدادات الأخرى.

---

## `fingerprint`

معرّف لإعادة الإنتاجية. إذا تطابقت البصمة لجولتي تشغيل، فهذا يعني أنهما استخدمتا الإعداد التجريبي نفسه.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `hash` | `string` | تجزئة SHA-256 للمكونات المرتبة |
| `components` | `object` | قيم المدخلات التي تم حساب تجزئتها |

### مكونات البصمة

القائمة المعتمدة موجودة في [مواصفات التقييم المعياري §3.8](/docs/network/specifications/benchmark#38-fingerprint). باختصار:

| المكون | الوصف |
|-----------|-------------|
| `dataset_sha256` | تجزئة ملف مجموعة البيانات |
| `model_slug` | النموذج المستخدم (لمحرك MT أو ملحق طريقة، معرّف المحرك أو الطريقة) |
| `condition` | تسمية حالة التجربة |
| `system_prompt_sha256` | تجزئة مطالبة النظام |
| `temperature` | درجة حرارة أخذ العينات |
| `batch_size`، `tools_enabled` | الدفعات واستخدام الأدوات |
| `harness_version` | إصدار بيئة التقييم (harness) |
| `api_provider`، `endpoint_host_sha256`، `max_tokens`، `method_version`، `method_sha256` | الإصدار 2 (بيئة التقييم 0.2.0 والإصدارات الأحدث): القناة، ومضيف نقطة النهاية (مجزأ)، وحد الرموز، وإصدار الطريقة وتجزئة الكود الخاص بها |
| `method_model`، `method_dependencies_sha256` | الإصدار 2، جولات ملحقات الطرق فقط: النموذج الذي تم تمريره إلى الملحق (`-m`) وتجزئة `dependencies` المصرح بها الخاصة به |
| `method_model`، `method_model_sha256` | الإصدار 2، جولات `--method local-model` فقط: النموذج الذي تم تحميله (معرّف Hugging Face أو اسم الدليل) وتجزئة محتواه (لدليل) أو المراجعة (revision) (لمعرّف Hugging Face) |

يوضح `fingerprint.version` القائمة التي تم حساب تجزئة البطاقة بموجبها.

### `engine_model`

تحمل جولة تشغيل محرك MT الذي يشغّل نموذجًا محددًا يُعطى له (`--method local-model -m <model>`) النموذج الذي تم تحميله:

| الحقل | الوصف |
|-------|-------------|
| `given` | ما حدده `-m` |
| `kind` | `directory` أو `hub` (معرّف Hugging Face) |
| `id` | معرّف Hugging Face، أو اسم الدليل (ليس مساره المحلي أبدًا) |
| `sha256` | لدليل فقط: تجزئة SHA-256 على قائمة ملفاته بأسلوب `sha256sum` |
| `revision` | لمعرّف Hugging Face فقط: المراجعة (revision) التي تم تحميلها |
| `family`، `backend` | `opus`، `nllb` أو `madlad`؛ `transformers` أو `ctranslate2` |
| `decode` | الحد الأقصى لطول المخرجات: الطول الذي يحدده النموذج، أو قاعدة بيئة التقييم (`max(64, 4 × source tokens)` من الرموز الجديدة، بحد أقصى لمواضع وحدة فك التشفير decoder) |
| `pair_mismatch` | متوفر فقط عند تشغيل نموذج زوجي OPUS-MT لزوج لغوي آخر عمدًا (`--allow-model-pair-mismatch`) |

يسمي `method_config.model` النموذج نفسه (`<id>@<revision>`، أو `<directory name>@sha256:<hash>`). وسجل تشغيل `local-model` الذي لم يسجل أي نموذج لا ينشر شيئًا: حيث تفيد البطاقة `engine_model_unrecorded` ويرفضها `mt-eval publish`.

### `method_plugin`

تحمل أيضًا جولة تشغيل ملحق الطريقة (`--method <plugin dir>`) ما يحدد هوية الملحق، وفق ما سجله المشغّل:

| الحقل | الوصف |
|-------|-------------|
| `version` | الإصدار الذي يصرح به `method.json` (`null` عند عدم التصريح بأي إصدار) |
| `code_sha256` | تجزئة SHA-256 لملفات الملحق (`method.json` وملفات `.py` الخاصة به، بيان بأسلوب `sha256sum`) |
| `model_given` | النموذج الذي تم تمريره إلى الملحق باستخدام `-m/--model`، أو `null` |
| `models_called`، `models_basis` | النموذج (أو النماذج) التي أبلغ الملحق عن استدعائها، وما إذا كان ذلك قد لوحظ في نتائجه أم تم التصريح به |
| `dependency_class` | فئة الاعتمادية التي يصرح بها `method.json` |
| `dependencies` | قائمة `dependencies` التي يصرح بها `method.json`، دون `notes` النصي الحر |
| `dependencies_sha256` | تجزئة SHA-256 للقائمة المصرح بها بالكامل (مكون البصمة) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[البصمة ≠ تجزئة بطاقة التشغيل]
تحدد البصمة *تهيئة التجربة*. بينما يتحقق `run_card_hash` من *سلامة ملف النتائج*. راجع [البصمة مقابل تجزئة بطاقة التشغيل](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) للاطلاع على التفاصيل.
:::

---

## `scores`

المقاييس الإجمالية لجولة التشغيل بأكملها.

### الدرجات ذات المستوى الأعلى

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `total` | `number` | إجمالي المدخلات التي تم تقييمها |
| `exact_matches` | `number` | المدخلات التي تطابقت مخرجاتها تمامًا مع المعيار الذهبي (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | **الكلمات** المخرجة التي قبلها محلل FST، محسوبة كمجموع عبر جميع المدخلات (وليس عدد المدخلات). `null` إذا لم يُستخدم محلل FST |
| `fst_acceptance_rate` | `number` | متوسط معدلات القبول لكل مدخلة (الكلمات المقبولة لكل مدخلة ÷ كلماتها؛ يعتبر الناتج الفارغ 0)، من 0.0 إلى 1.0. وهي **ليست** `fst_accepted` ÷ جميع الكلمات — فهذا المعدل المجمع للكلمات هو `corpus_validity_rate` الخاص بالتقرير، ويظهر على بطاقة التشغيل باسم "Words accepted". `null` إذا لم يُستخدم محلل FST |
| `chrf_plus_plus` | `number` | **المقياس الرئيسي ومقياس الترتيب:** مقياس chrF++ على مستوى المدونة (sacreBLEU chrF، `word_order=2`)، من 0 إلى 100. فترة ثقة bootstrap بنسبة 95% هي `confidence_intervals.corpus_chrf` وبصمته `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` في كل بطاقة جديدة. تم احتساب درجات البطاقة التي لا تحوي هذا الحقل بموجب المقياس المركب الملغى (`legacy-composite`) ويتم التحقق منها بتلك الطريقة |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`، `ter` | `number` | المقاييس القياسية المعروضة بجانب chrF++، ولا يتم دمجها أبدًا (BLEU هو `corpus_bleu` ذو المستوى الأعلى للبطاقة؛ COMET هو `comet_score` مع `comet_model`، عند حسابه) |
| `sacrebleu_signatures` | `object` | بصمة sacreBLEU لكل مقياس sacreBLEU تم حسابه: `chrf` (النتيجة الرئيسية)، `chrf_plain`، `bleu`، `spbleu`، `ter` |
| `confidence_intervals` | `object` | فترات bootstrap بنسبة ثقة 95%؛ `corpus_chrf` هو الخاص بالنتيجة الرئيسية |
| `composite`، `quality_tier`، `cost_adjusted` | `null` | **ملغى.** دائمًا `null` في أي بطاقة جديدة. تحتفظ البطاقة القديمة بقيمها المخزنة؛ والواجهة التي لا تزال تعرض مقياسها المركب تصنفه كـ "مركب قديم (ملغى)" |
| `errors` | `number` | المدخلات التي فشلت (خطأ في واجهة برمجة التطبيقات، انتهاء المهلة، إلخ) |
| `avg_latency_seconds` | `number` | متوسط وقت الاستجابة عبر جميع المدخلات |
| `median_latency_seconds` | `number` | الوسيط لوقت الاستجابة |
| `p95_latency_seconds` | `number` | الشريحة المئوية 95 لوقت الاستجابة |

### `by_difficulty`

الدرجات مفصلة حسب مستوى الصعوبة، مفهرسة بالمستوى (`"1"`–`"5"`، و`"0"` لغير المصنف). الحقول **ليست** الحقول ذات المستوى الأعلى: فـ `avg_chrf` و`avg_bleu` هما **متوسط كل جملة** لمقياسي chrF++ وBLEU عبر مدخلات ذلك المستوى، بينما `chrf_plus_plus` وBLEU في المستوى الأعلى هما **على مستوى المدونة بالكامل** (تُحسب عبر جميع المقاطع معًا). المقياسان إحصائيتان مختلفتان: فمقياس BLEU على مستوى المدونة تحديدًا يقل عادةً كثيرًا عن متوسط BLEU للجمل، لذا فإن وجود نتيجة رئيسية تبلغ 0.5 بجانب قيمة مستوى تبلغ 10.2 لا يمثل تناقضًا. قارن المستويات ببعضها البعض، وليس بالنتيجة الرئيسية أبدًا.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

الدرجات مفصلة حسب مصدر المدخلة (provenance). يحتوي كل مفتاح (مثل `gold_standard`، `textbook`) على حقول المقاييس نفسها.

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

## `score_caveats`

موجود فقط عندما يكون هناك ما يحد من دلالة الدرجات. فقد يتم حساب الدرجة
بشكل صحيح ومع ذلك لا تقيس ما تشير إليه تسميتها، ولذلك يقترن هذا
التحفظ بالرقم: حيث تطبعه أدوات `mt-eval test` و`mt-eval card` و`mt-eval compare`
ولوحة المعلومات ومعاينة `mt-eval publish` بجانب النتيجة الرئيسية،
ويخزنه `publish` هنا لتعرضه لوحة الصدارة.
ولا يؤدي هذا أبدًا إلى تغيير أي درجة: إذ يتم حساب النتيجة الرئيسية لـ chrF++ كالمعتاد،
ويوضح التنبيه ما يقيدها أو يقيد أحد التشخيصات المصاحبة لها.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin` أو `length_inflation` أو `length_deflation` أو `source_copy` أو `near_constant_output` |
| `source` | `string` | الجهة التي قاسته: `nmt-forge` أو `mt-eval-harness` |
| `severity` | `string` | `major` (تُفسر النتيجة الرئيسية من خلاله) أو `minor` |
| `message` | `string` | جملة واحدة، بحد أقصى 480 حرفًا |

**`train_test_near_twin`**، مكتوب بواسطة nmt-forge. عندما يقوم `nmt-forge export` (أو
`evaluate`) بتقييم نموذج، فإنه يفحص كل صف اختبار بحثًا عن نظير شبه متطابق
في بيانات التدريب ويسجل النتيجة في ملفات mt-eval التي يكتبها.
وتنسخ بيئة التقييم تلك القراءة إلى البطاقة: حيث يكون لـ `near_twin_rows` من أصل `n` من صفوف
الاختبار نظير متطابق (`near_twin_share`)، بينما لا يوجد نظير لـ `strict_n` صفًا. وعندما
يتوفر عدد كافٍ منها، يقدم `strict_corpus_chrf` و`strict_corpus_chrf_ci`
نتيجة chrF++ عليها وحدها، وهو ما يمثل مقياس التعميم (generalization number).
ويكون `recall_not_translation` بقيمة `true` عندما يمتلك نصف الصفوف على الأقل نظيرًا.
وحينئذٍ، فإن نتيجة chrF++ البالغة 100 لا تقيس سوى مدى استرجاع النموذج
للعبارات التدريبية، وليس جودة ترجمته. وإذا لم يتم تشغيل فحص forge،
فسيكون التنبيه `minor` ويوضح ذلك. والفحص الذي لا يجد أي نظير لا يضيف أي تنبيه.

**`length_inflation`**، يقاس بواسطة بيئة التقييم. يُضاف عندما يتجاوز متوسط
طول المخرجات ضعفي (2×) طول المرجع المقابل لها (حد التضخم في
[`length_ratio`](/docs/network/specifications/scoring))، أو عندما ينطبق ذلك على
ربع المدخلات المقيمة على الأقل. تؤدي أمثلة few-shot المسربة أو الملاحظات أو النصوص
المتكررة إلى تضخيم المخرجات، ومن ثم تقيس الدرجات المستندة إلى المرجع ذلك الخلل.
والحقول هي `mean_length_ratio`، و`inflated_entries` من `scored_entries`،
و`ratio_bound` و`share_bound`.

**`length_deflation`**، يقاس بواسطة بيئة التقييم. وهو النقيض المقابل لـ
`length_inflation`: مخرجات **أقصر** بكثير من مراجعها، مما يعني إسقاط بعض الكلمات.
يُضاف عندما يقل متوسط طول المخرجات عن نصف (0.5×) طول مرجعها
(حد الاقتطاع في
[`length_ratio`](/docs/network/specifications/scoring))، أو عندما ينطبق ذلك على
ربع المدخلات المقيمة على الأقل. تحكم بعض التشخيصات فقط على الكلمات التي
يحتويها الناتج: مثل قبول FST والتبديل اللغوي (code-switching). والنظام الذي يسقط ما لا
يستطيع ترجمته يحصل على درجات أعلى في هذه المقاييس. وعندما تتضمن جولة التشغيل أيًا منها، يكون التنبيه
`major` ويوصي بعدم اعتبارها دليلاً على الجودة عند مقارنتها بجولات تشغيل تترجم
كل شيء. تعطي النتيجة الرئيسية لـ chrF++ وزنًا للاستدعاء (recall)، وبالتالي تحتسب الكلمات المفقودة. وفي حالة
عدم وجود أي من المقياسين (chrF++ والتطابق التام فقط)، تكون مجرد ملاحظة `minor`. والحقول
هي `mean_length_ratio`، و`short_entries` من `scored_entries`، و`ratio_bound`،
و`share_bound` و`emitted_only_metrics`.

**`source_copy`**، يقاس بواسطة بيئة التقييم. يُضاف عندما يكون نصف المخرجات
المقيمة على الأقل نسخًا من مصدرها (مع تجاهل حالة الأحرف والتشكيل وعلامات الترقيم).
وتُستثنى الأسطر التي يكون مرجعها هو المصدر نفسه، مثل الأسماء.
ولا يزال بإمكان المقاييس التي لا تقارن بالمرجع أن تحتسب درجات للكلمات
المنسوخة. والحقول هي `copies` من `considered_entries`، و`copy_share` و`share_bound`.

**`near_constant_output`**، يقاس بواسطة بيئة التقييم. تم تقديم ناتج واحد
لعدة مدخلات *مختلفة*. تتم مقارنة المخرجات والمصادر مع تجاهل حالة الأحرف
وعلامات الترقيم والمسافات؛ بينما يُعتد بالحركات التشكيلية لأنها تميز
بين الكلمات في المخرجات. يُعد الناتج تكرارًا عبر المصادر عندما
تحصل عليه 3 مصادر مميزة على الأقل (أو 5 مصادر عندما يتكون من كلمة أو كلمتين،
نظراً لتكرار الإجابات القصيرة بشكل طبيعي). والناتج الذي يطابق مرجعه الخاص
يُعد إجابة صحيحة ولا يُحتسب. يُضاف التنبيه عندما يغطي التكرار
ربع المصادر المميزة على الأقل، وبما لا يقل عن 5 منها. ويكون دائمًا
`major`. عندما تتضمن جولة التشغيل مقياسًا يقيم الناتج
دون مرجعه (قبول FST، التبديل اللغوي)، فإن الرسالة تحدد
اسمه: فمثل هذا المقياس يمنح نقاطًا للجملة الصحيحة في كل مرة تظهر فيها. والحقول
هي `repeated_sources` من `considered_sources`، و`repeat_share`،
و`repeated_outputs`، و`top_output_sources` و`top_output_words` (الناتج الأكثر
تكرارًا: عدد المصادر التي حصلت عليه، وطوله)، و`share_bound`،
و`min_repeats`، و`min_sources`، و`min_sources_short` و`emitted_only_metrics`.
وهي مجرد أعداد فقط: فالتنبيه لا يتضمن أبدًا نص الناتج الفعلي.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

يوجد الحقل داخل ملف JSON لبطاقة التشغيل المخزنة، لذا فهو لا يحتاج إلى
عمود في قاعدة البيانات. وهو ليس جزءًا من [البصمة](#fingerprint): فهو يصف
النتيجة وليس التجربة.

---

## `totals`

تتبع استخدام الرموز (tokens) والتكلفة لجولة التشغيل بأكملها.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `prompt_tokens` | `number` | إجمالي رموز الإدخال عبر جميع استدعاءات واجهة برمجة التطبيقات |
| `completion_tokens` | `number` | إجمالي رموز الإخراج |
| `reasoning_tokens` | `number` | الرموز المستخدمة للاستدلال المتسلسل (chain-of-thought) (تعتمد على النموذج، 0 لمعظم النماذج) |
| `cached_tokens` | `number` | الرموز التي تم توفيرها من التخزين المؤقت للمطالبات (prompt cache) لدى الموفر |
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

البيانات الوصفية لبيئة التشغيل لضمان إمكانية إعادة الإنتاج.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `harness_version` | `string` | إصدار بيئة التقييم (يطابق `harness_version` في المستوى الأعلى) |
| `harness_git_commit` | `string` | معرّف Git commit SHA لبيئة التقييم في وقت التشغيل |
| `python_version` | `string` | إصدار مفسر Python |
| `sacrebleu_version` | `string` | إصدار مكتبة sacrebleu (المستخدمة لحساب درجات chrF++) |
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

مصفوفة النتائج لكل مدخلة. كائن واحد لكل مدخلة في مجموعة البيانات، حسب ترتيب الفهرس.

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `entry_id` | `integer` | معرّف هذه المدخلة في المدونة (يطابق `entries[].id`) |
| `source` | `string` | النص المصدر الذي تمت ترجمته |
| `reference` | `string` | مرجع المعيار الذهبي من المدونة |
| `predicted` | `string` | المخرجات الفعلية للطريقة |
| `exact_match` | `boolean` | ما إذا كان `predicted` يطابق `reference` تمامًا بعد التسوية (normalization) |
| `entry_chrf` | `number` | درجة chrF++ على مستوى الجملة لهذه المدخلة (0–100) |
| `fst_accepted` | `boolean \| null` | ما إذا كان محلل FST قد قبل الناتج. `null` إذا لم يتم تكوين محلل |
| `fst_analysis` | `string[]` | سلاسل تحليل FST للناتج (مصفوفة فارغة إذا لم يتم تحليله أو تم رفضه) |
| `difficulty` | `integer` | مستوى الصعوبة من المدونة (1–5) |
| `provenance` | `string` | وسم المصدر (provenance tag) من المدونة |
| `latency_seconds` | `number` | وقت الاستجابة لهذه المدخلة الفردية |
| `usage` | `object` | استخدام الرموز لكل مدخلة: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | رسالة الخطأ إذا فشلت هذه المدخلة. `null` عند النجاح |

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
| `run_card_hash` | `string` | تجزئة SHA-256 لملف JSON الخاص ببطاقة التشغيل بالكامل، مع تعيين حقل `run_card_hash` نفسه على `""` أثناء التجزئة |

هذا هو ختم كشف التلاعب. حيث تعيد لوحة الصدارة حساب هذه التجزئة عند الإرسال وترفض البطاقات التي لا تتطابق فيها.

**حساب التجزئة:**

1. تسلسل (Serialize) بطاقة التشغيل إلى JSON مع ضبط `run_card_hash` على `""`
2. حساب تجزئة SHA-256 للسلسلة النصية المتسلسلة
3. ضبط `run_card_hash` على الناتج الست عشري الناتج (hex digest)

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[التحليل التفصيلي لكل مدخلة]
تملأ بطاقات التشغيل المنشورة أيضًا جدول `run_card_entries` في Supabase، والذي يخزن نتائج كل مدخلة للتحليل التفصيلي (drill-down) في لوحة الصدارة. يُملأ هذا الجدول تلقائيًا أثناء `mt-eval publish`.
:::

---

## انظر أيضًا

- [تقييم الترجمة الآلية (MT)](/docs/network/leaderboard/rules) — نظرة عامة، وقيمة لوحة الصدارة، وإرشادات الطرق الجيدة/السيئة
- [بيئة التقييم (Eval Harness)](/docs/network/specifications/harness) — كيفية تشغيل التقييمات وتوليد بطاقات التشغيل
- [مجموعات بيانات التقييم](/docs/network/leaderboard/datasets) — تنسيق مجموعات البيانات، وEDTeKLA، وFLORES+
- [بناء طريقة](/docs/network/specifications/methods) — واجهة الطريقة ومواصفات بطاقة الطريقة
- [لوحة صدارة الطرق](https://champollion.dev/leaderboard) — درجات التقييم المعياري المباشرة
- [مواصفات التقييم المعياري](/docs/network/specifications/benchmark) — بروتوكول التقييم، وتنسيق المدونة، ومخطط بطاقة التشغيل
- [مواصفات احتساب الدرجات](/docs/network/specifications/scoring) — المصدر الموثوق الوحيد للمقاييس وكيفية تسجيل جولات التشغيل
