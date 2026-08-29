---
sidebar_position: 3
title: "الإعدادات"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# الإعدادات

يعمل Champollion بدون إعدادات مسبقة (zero-config) — حيث يكتشف تلقائيًا ملفات اللغات، والتنسيق، واللغات المستهدفة من مشروعك. لمزيد من التحكم، قم بإنشاء `champollion.config.json` في الجذر الخاص بمشروعك، أو قم بتشغيل:

```bash
npx champollion init
```

## مرجع الإعدادات الكامل

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[لم يتم تنفيذ typegen بعد]
يتعرف محمل الإعدادات على كتلة الإعدادات `typegen` ويحتفظ بها، ولكن لم يتم تنفيذ إنشاء أنواع TypeScript بعد. هذا عنصر نائب لميزة مخطط لها. تعيين هذه القيم ليس له أي تأثير.
:::


### الحقول

| الحقل | النوع | الافتراضي | الوصف |
|-------|------|---------|-------------|
| `version` | `number` | `3` | إصدار مخطط الإعدادات. دائمًا `3`. |
| `inputLocale` | `string` | `"en"` | رمز اللغة المصدر (BCP 47). |
| `localesDir` | `string` | `"./locales"` | مسار ملفات اللغات. يقوم Champollion بفحص هذا الدليل. |
| `contentDir` | `string` | `null` | دليل محتوى Hugo. يُفعل ترجمة نص Markdown. |
| `translatableFields` | `string[]` | `null` | تجاوز حقول frontmatter القابلة للترجمة الافتراضية لترجمة المحتوى. يستخدم `null` الإعدادات الافتراضية المدمجة (`title`، `description`، `summary`). |
| `format` | `string` | `"auto"` | تنسيق الملف: `json`، `toml`، `yaml`، أو `auto` (يُكتشف من الامتداد). |
| `model` | `string` | `"google/gemini-3.5-flash"` | النموذج الافتراضي لطرق LLM. يقبل أسماء OpenRouter الكاملة (`provider/model`) أو الأسماء المستعارة القصيرة من `shared/model-aliases.json` (مثل، `gemini-flash`). يستخدم المزودون المباشرون الأسماء المجردة (مثل، `gpt-4o`). |
| `temperature` | `number` | `0.3` | درجة حرارة LLM (0.0–2.0). أقل = أكثر حتمية. |
| `defaultMethod` | `string` | `"llm"` | طريقة الترجمة الافتراضية: `llm`، `llm-coached`، `google-translate`، `deepl`، `microsoft-translator`، `libretranslate`، `openai`، `anthropic`، `gemini`، `api`. يتم تجاوزها بواسطة علامة CLI `--method`. |
| `batchSize` | `number` | `80` | عدد المفاتيح لكل دفعة ترجمة. أعلى = استدعاءات API أقل، ولكن مطالبات (prompts) أكبر. |
| `coachingFile` | `string` | `null` | مسار إلى ملف مطالبة توجيهية (coaching prompt) بنص حر (نسبيًا إلى جذر المشروع). تُقرأ المحتويات عند بدء التشغيل وتُحقن في مطالبة النظام ككتلة `Coaching guidance:`. |
| `promptContext` | `string` | `null` | سلسلة سياق التطبيق المحقونة في مطالبة النظام (مثل، "أوصاف منتجات التجارة الإلكترونية"). تساعد النموذج على تكييف الترجمات مع مجالك. |
| `jsonConcurrency` | `number` | `200` | الحد الأقصى للترجمات المتوازية للغات لمزامنة مفاتيح JSON. يتم تجاوزها بواسطة علامة CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | الحد الأقصى لاستدعاءات API المتوازية لترجمة المحتوى (Markdown/MDX). يتم تجاوزها بواسطة علامة CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | بادئة العلامة المستخدمة بواسطة `audit` و `verify` لاكتشاف القيم القديمة غير المترجمة من عمليات التشغيل السابقة. لا يكتب Champollion هذه البادئة — بل يقرأها فقط للاكتشاف. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | اسم متغير البيئة لمفتاح API. تجاوزه لأسماء متغيرات البيئة المخصصة. |
| `minContentRetention` | `number` | `0.35` | نسبة الحروف/الأرقام في المصدر التي يجب أن يحتفظ بها المخرج قبل أن يستشير [فحص حذف المحتوى](/docs/concepts/quality-gate) إشارته الثانية. يمكن تعيينها أيضًا لكل زوج ولكل لغة. |
| `noTranslate` | `string[]` | `[]` | مفاتيح المسار النقطي (dot-path) وأنماط glob التي تُنسخ قيمتها إلى كل لغة حرفيًا. راجع [مفاتيح عدم الترجمة](#no-translate). تُقبل أيضًا كـ `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | التعامل مع قيم المصدر التي لا تحتوي إلا على عنوان URL `scheme://` كقيم غير قابلة للترجمة. قم بتعيين `false` لإرسال المفاتيح ذات قيم URL إلى الواجهة الخلفية للترجمة. |
| `baseUrl` | `string` | `""` | عنوان URL الأساسي لإنشاء عناصر SEO (hreflang، خرائط الموقع، JSON-LD). |
| `pairs` | `object` | `{}` | تجاوزات الطريقة، والنموذج، والجودة لكل زوج. راجع [إعدادات الزوج](#pair-configuration). |
| `languages` | `object` | `{}` | تجاوزات لكل لغة. راجع [إعدادات اللغة](#language-configuration). |
| `lint.srcDir` | `string` | `null` | الدليل المصدر لفحص التحليل البرمجي (lint). `null` = اكتشاف تلقائي من إطار العمل. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | أنماط glob لاستبعادها من التحليل البرمجي (lint). |
| `lint.minLength` | `number` | `2` | الحد الأدنى لطول السلسلة ليتم وضع علامة عليها كقيمة مضمنة (hardcoded). |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | قالب نمط URL لإنشاء علامة hreflang. |
| `seo.pages` | `string[]` | `null` | قائمة صفحات صريحة لـ SEO. `null` = اكتشاف تلقائي من مفاتيح اللغات. |
| `typegen.output` | `string` | `null` | مسار الإخراج لأنواع TypeScript المُنشأة. `null` = معطل. |
| `typegen.autoGenerate` | `boolean` | `false` | إعادة إنشاء الأنواع تلقائيًا بعد كل مزامنة. |

## مفاتيح عدم الترجمة {#no-translate}

بعض القيم لها عرض صحيح واحد فقط في كل لغة: عنوان URL، مسار
مستودع، اسم حزمة، مُعرّف منتج. الترجمة الصحيحة لـ
`https://example.org/paper` هي `https://example.org/paper`.

ترفض [بوابة الجودة](/docs/concepts/quality-gate) الخاصة بـ Champollion
صدى المصدر (source-echo) — وهي ترجمة مطابقة لمصدرها — لأن ذلك عادةً ما يكون
بسبب رفض النموذج للقيام بالعمل. بالنسبة لهذه المفاتيح، يجعل ذلك الإجابة الصحيحة
هي المرفوضة، ولا يوجد مخرج يمكن للنموذج إنتاجه ليمر. 
تتعلم النماذج الأضعف هزيمة البوابة عن طريق تغيير القيمة بما يكفي (مثل
`#fragment` مُختلق، أو شرطة مائلة زائدة، أو مسافة غير مرئية بعرض صفر)،
مما يؤدي إلى شحن روابط معطلة. تُرجع النماذج الأقوى القيمة دون تغيير وتفشل
في البوابة، لذلك يخرج `sync` بقيمة غير صفرية في كل تشغيل.

قم بالتصريح عن تلك المفاتيح بدلاً من ذلك:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

يتم **نسخ المفتاح المطابق من لغة المصدر حرفيًا** — ولا يُرسل أبدًا إلى
الواجهة الخلفية للترجمة، ولا يخضع أبدًا لبوابة الجودة، ولا يُحسب أبدًا كفشل، ولا
تُفرض عليه رسوم أبدًا. ويُستثنى من تقدير التكلفة قبل التشغيل لنفس السبب.

### بناء جملة النمط

الأنماط عبارة عن مسارات نقطية (dot-paths) عبر مساحة المفاتيح المسطحة، مع حرفي بدل (wildcards):

| النمط | يطابق | لا يطابق |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (مسار دقيق) | `nav.brandName` |
| `**.url` | `url`، `pages.a.b.url` (ورقة `url` في أي عمق) | `pages.urlLabel`، `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`، `meta.ogTitle` | `meta.twitterImage`، `meta.og.image` |

يطابق `*` داخل مقطع واحد؛ يطابق `**` صفرًا أو أكثر من المقاطع الكاملة.
النمط الذي لا يحتوي على حرف بدل هو مسار مفتاح دقيق.

### يتم التعامل مع عناوين URL افتراضيًا

نظرًا لأن المفتاح الذي قيمته عنوان URL ليس له نتيجة صحيحة تحت البوابة،
فإن `noTranslateUrls` يكون `true` بشكل افتراضي: أي قيمة مصدر لا تحتوي إلا على
عنوان URL مطلق `scheme://` تُعامل كقيمة غير قابلة للترجمة بدون إعدادات.

الاكتشاف ضيق عمدًا — يجب أن تكون القيمة الكاملة المقتطعة (trimmed) هي عنوان URL.
النثر الذي يحتوي مجرد رابط (`"Read the paper at https://…"`) لا يزال
يُترجم بشكل طبيعي.

قم بإيقاف تشغيله باستخدام `"noTranslateUrls": false` إذا كانت عناوين URL الخاصة بك حقًا
خاصة باللغة (مضيفو الوثائق لكل لغة، على سبيل المثال) — ثم صرّح عن
تلك التي ليست كذلك باستخدام `noTranslate`.

### الإصلاح والفرض

بالنسبة لمفتاح عدم الترجمة، هناك قيمة هدف صحيحة واحدة فقط، لذا فإن أي
اختلاف يُعد عيبًا. يفرض Champollion ذلك في كلا الاتجاهين:

- **يقوم `sync` بإصلاحه.** مفتاح عدم الترجمة الذي يكون هدفه مفقودًا،
  أو مسبوقًا بـ `[EN] `، أو مُعدلًا، يُعاد كتابته من المصدر. لا يكلف ذلك أي استدعاء
  لواجهة برمجة التطبيقات (API)، وهو متساوي القوة (idempotent): بمجرد تطابق القيم، تتخطى عمليات المزامنة اللاحقة المفتاح
  بالكامل.
- **يفشل `verify` و `integrity` بسببه.** يُبلغ عن مفتاح عدم الترجمة المنحرف
  كـ `NO-TRANSLATE DRIFT` مع القيم المتوقعة والفعلية —
  مع تخطي الأحرف غير المرئية كـ `\uXXXX`، نظرًا لأن هذه الفئة من الفساد
  يستحيل رؤيتها في فرق (diff) بخلاف ذلك. يخرج `champollion integrity` بـ `1`، لذلك فإن
  البناء المرتبط به يكتشف عنوان URL التالف قبل شحنه.

إذا فشل `integrity` بهذه الطريقة في مشروع قمت بإعداده للتو، فإنه
يُبلغ عن تلف كان موجودًا بالفعل في ملفات اللغات الخاصة بك. قم بتشغيل `champollion sync`
مرة واحدة لإصلاحه.

## تحويل النص {#script-conversion}

بعض اللغات التي يترجمها Champollion يمكن *كتابتها* بأكثر من طريقة. يعمل النموذج دائمًا في **النص العامل** (working script) للغة (الكتابة اللاتينية بالحروف اللاتينية — SRO لـ Plains Cree، وكتابة Okrand بالحروف اللاتينية لـ Klingon)، ويمكن لمحول حتمي بعد ذلك إعادة كتابة المخرجات إلى نص عرض (display script). ما إذا كان ينبغي القيام بذلك هو قرار تتخذه الإعدادات — **وليس افتراضيًا أبدًا**:

| اللغة | النص العامل | قابل للتحويل إلى | النوع |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (مقاطع لفظية) | Unicode حقيقي — **اختيار مطلوب** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (سيريلية) | Unicode حقيقي — **اختيار مطلوب** |
| `tlh` (Klingon) | `Latn` (كتابة بالحروف اللاتينية) | `Piqd` (pIqaD) | PUA — اشتراك (opt-in) |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — اشتراك (opt-in) |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — اشتراك عبر `"script": "x-kryptonian"` |

**تتطلب أزواج Unicode الحقيقية (crk، sr) الاختيار.** المقاطع اللفظية لـ Cree والسيريلية هي Unicode عادي — يتم عرضها في كل مكان — وكلا نظامي الكتابة قيد الاستخدام الفعلي. لن يختار Champollion نظام كتابة مجتمع نيابة عن مشروع: يسأل `init` عند تحديد اللغة، ويرفض `sync` التشغيل حتى تحدد الإعدادات أيهما:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**نصوص PUA (tlh، x-elvish-s، x-kryptonian) تُعين افتراضيًا إلى الكتابة بالحروف اللاتينية.** pIqaD و Tengwar و Kryptonian *ليست في Unicode* — تُصدر المحولات نقاط ترميز منطقة الاستخدام الخاص (Private Use Area) التي لا تُعرض كأي شيء ما لم تقم بشحن خط معين لتلك النقاط. الكتابة بالحروف اللاتينية هي المخرج الوحيد الذي يُعرض في كل مكان، لذلك فهي الافتراضية. لإصدار نص العرض بدلاً من ذلك:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…وقم بتشغيل `champollion fonts install` ليكون لموقعك خط يمكنه رسمه. إذا كانت خطوطك مرتبطة بالنقحرة اللاتينية (كما هو الحال في العديد من خطوط اللغات المصطنعة)، فاحتفظ بالافتراضي.

يأخذ `script` رمز ISO 15924، بأي حالة أحرف (`"cans"` و `"Cans"` و `"CANS"` هي نفسها). يمكن أيضًا تعيينه لكل زوج، وهو ما يتغلب على مستوى اللغة. القيمة غير الصالحة، أو النص الذي لا يمكن للغة إنتاجه، يفشل عند بدء التشغيل — قبل أي استدعاء لواجهة برمجة التطبيقات (API).

### الحروف غير المعينة و `scriptFallback` {#script-fallback}

تترجم المحولات ما يحدده نظام الكتابة الخاص بها ولا شيء غير ذلك. لا تحتوي الكتابة بالحروف اللاتينية لـ Klingon على `d` أو `c` أو `f` أو `g` أو `i` أو `k` أو `s` أو `x` أو `z` — لذلك لا يمكن تحويل مخرجات النموذج التي تحتوي على اسم علم مثل "GitHub" بالكامل. **لا يكتب Champollion أبدًا قيمة نصف محولة**: إذا كان أي حرف غير قابل للتعيين، تظل القيمة بأكملها في النص العامل، ويسمي التحذير الحروف بالإضافة إلى سطر الإعدادات الذي سيعينها.

هذه التعيينات متروكة لك للتصريح عنها:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

تستبدل كل قاعدة تسلسل النص العامل بتسلسل *يمكن* للمحول تعيينه، قبل تشغيل التحويل. يتم التحقق من صحة القواعد عند بدء التشغيل — ويُرفض الاستبدال الذي يكون هو نفسه غير قابل للتعيين.

لا يشحن Champollion **أي قواعد احتياطية خاصة به**: إن اختراع التعديلات الإملائية، خاصة لنظام كتابة لغة حقيقية، ليس قرارًا يتخذه الفهرس. لدى المجتمعات والقواعد الجماهيرية اصطلاحات — اعتمدها عمدًا، لكل مشروع.

### إصلاح التحويل غير المرغوب فيه {#repair-script}

قبل الإصدار 0.3.0، كان التحويل غير مشروط — حصلت المشاريع التي تستهدف لغات PUA على مخرجات غير قابلة للعرض سواء أرادوا ذلك أم لا. أداتان تغلقان الحلقة:

- **`champollion repair-script`** يفحص اللغات التي تشير إعداداتها إلى أن التحويل *متوقف* لنقاط ترميز PUA ويستعيد الكتابة بالحروف اللاتينية باستخدام الجدول العكسي الخاص بالمحول (`--dry` للمعاينة). ينعكس pIqaD تمامًا؛ تفقد انعكاسات Tengwar و Kryptonian حالة الأحرف الكبيرة وتوضح ذلك.
- **`champollion integrity`** يفشل (خروج 1) عند العثور على PUA حيث يكون التحويل متوقفًا — لذلك تكتشف بوابة البناء النص غير القابل للعرض قبل شحنه، ويسمي التقرير الإصلاح.

لا تحتاج ذاكرة الترجمة (Translation Memory) أبدًا إلى إصلاح: فهي تخزن قيم ما قبل التحويل، لذا فإن تشغيل `script:` أو إيقاف تشغيله لاحقًا لا يتطلب أي عمل في ذاكرة التخزين المؤقت.

ينطبق تحويل النص على سلاسل واجهة المستخدم (ملفات المفتاح-القيمة و Docusaurus JSON). لا يتم تحويل نصوص Markdown أبدًا — فمحول الأحرف الجشع ليس لديه طريقة آمنة عبر نطاقات التعليمات البرمجية، وعناوين URL، و front matter.

## إعدادات الزوج {#pair-configuration}

يمكن تكوين كل زوج مصدر←هدف بشكل مستقل:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### حقول الزوج

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `method` | `string` | طريقة الترجمة: `llm`، `llm-coached`، `google-translate`، `deepl`، `microsoft-translator`، `libretranslate`، `openai`، `anthropic`، `gemini`، `api` |
| `methodPlugin` | `string` | اسم مكون إضافي مثبت (من `.champollion/methods/`) |
| `model` | `string` | تجاوز النموذج الافتراضي لهذا الزوج |
| `temperature` | `number` | تجاوز درجة الحرارة الافتراضية لهذا الزوج |
| `batchSize` | `number` | تجاوز حجم الدفعة الافتراضي لهذا الزوج |
| `register` | `string` | تجاوز السجل/النبرة (مفتاح محدد مسبقًا أو نص حر) |
| `endpoint` | `string` | عنوان URL لنقطة نهاية API البعيدة. مطلوب عندما يكون `method` هو `api`. |
| `coachingFile` | `string` | مسار إلى ملف مطالبة توجيهية (coaching prompt) لهذا الزوج |
| `promptContext` | `string` | سياق التطبيق لهذا الزوج |
| `qualityTier` | `string` | مستوى العرض: `standard`، `high`، `research`، `verified` |

## إعدادات اللغة {#language-configuration}

تقبل اللغات ثلاثة تنسيقات:

### مصفوفة من الرموز (الأبسط)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

تحصل كل لغة على سجلها الافتراضي من جدول السجلات المدمج. اللغات التي ليس لها افتراضي تحصل على `"Professional register."`.

### كائن مع سلاسل السجل

يمكن أن تكون القيمة **مفتاحًا محددًا مسبقًا** من بطاقة اللغة، أو نص سجل مخصص:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

يتحقق Champollion مما إذا كانت السلسلة تطابق مفتاحًا محددًا مسبقًا في بطاقة اللغة. إذا كان الأمر كذلك، يتم استخدام مطالبة السجل الكاملة من البطاقة. إذا لم يكن كذلك، يتم استخدام السلسلة كما هي. راجع [اللغات المدعومة](/docs/reference/supported-languages#language-cards) للحصول على الإعدادات المسبقة المتاحة.

### كائن مع إعدادات كاملة

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

يمكنك مزج الاختصارات والكائنات الكاملة في نفس الكتلة.


### حقول اللغة

| الحقل | النوع | الوصف |
|-------|------|-------------|
| `register` | `string` | تعليمات الأسلوب/النبرة. يمكن أن تكون **مفتاحًا محددًا مسبقًا** (مثل، `casual-tu`، `formal-hapsyo`) أو نصًا مخصصًا. راجع [بطاقات اللغة](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | اسم لغة يمكن قراءته بواسطة الإنسان (لعرض الحالة) |
| `model` | `string` | تجاوز النموذج الافتراضي |
| `temperature` | `number` | تجاوز درجة الحرارة الافتراضية |
| `batchSize` | `number` | تجاوز حجم الدفعة الافتراضي |
| `coachingFile` | `string` | مسار إلى ملف مطالبة توجيهية (coaching prompt) لهذه اللغة |
| `promptContext` | `string` | سياق التطبيق لهذه اللغة |
| `maxRetries` | `number` | الحد الأقصى لميزانية إعادة المحاولة للدفعات الفاشلة (الافتراضي: 3) |
| `script` | `string` | رمز ISO 15924 لنظام الكتابة الذي يكتبه Champollion (مثل `"Cans"`، `"Piqd"`). راجع [تحويل النص](#script-conversion). |
| `scriptFallback` | `object` | قواعد النقحرة للحروف التي لا يمكن لمحول النص تعيينها. راجع [تحويل النص](#script-conversion). |

:::info[سلسلة الوراثة]
تُحل الإعدادات بهذا الترتيب (الأول يفوز):

**مستوى الزوج** → **مستوى اللغة** → **الإعدادات العامة** → **الافتراضيات**

على سبيل المثال، إذا قام `pairs["en:fr"]` بتعيين `model`، فإنه يتجاوز قيم `model` على مستوى اللغة والمستوى العام.
:::

## مصدر غير إنجليزي

إذا كانت لغتك المصدر ليست الإنجليزية:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## ملف القفل (Lock File)

ينشئ Champollion `.champollion.lock` لتتبع تجزئات SHA-256 لقيم المصدر المترجمة. **قم بإيداع (Commit) هذا الملف** حتى يشارك جميع المطورين نفس خط الأساس للترجمة.

عندما تتغير قيمة المصدر، لم تعد التجزئة متطابقة، ويعيد champollion ترجمة ذلك المفتاح في المزامنة التالية.

## `.champollionignore`

قم بإنشاء `.champollionignore` في جذر مشروعك لاستبعاد الملفات من فحص `lint`. يستخدم أنماط glob، مثل `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## دليل `.champollion/`

ينشئ Champollion دليل `.champollion/` في جذر مشروعك للحالة الداخلية. يجب عليك عمومًا **إضافة هذا إلى `.gitignore`** — فهو تحسين محلي، وليس مصدرًا للمشروع:

```gitignore
.champollion/
```

| الملف | الغرض | إيداع (Commit)؟ |
|------|---------|--------|
| `tm.json` | ذاكرة التخزين المؤقت لذاكرة الترجمة — تخزن الترجمات السابقة مفهرسة بنص المصدر + اللغة + الطريقة | لا (ذاكرة تخزين مؤقت محلية) |
| `xliff/*.xliff` | ملفات تصدير XLIFF لمراجعة المترجمين المحترفين | لا (مؤقت) |
| `methods/` | بيانات المكونات الإضافية للطرق المثبتة | نعم (إعدادات مشتركة) |
| `backups/` | نسخ احتياطية قبل الالتفاف (تم إنشاؤها بواسطة `wrap --undo`) | لا (شبكة أمان) |

راجع [ذاكرة الترجمة](/docs/concepts/translation-memory) للحصول على تفاصيل حول `tm.json` وكيف يوفر تكاليف API.

---

## واجهة برمجة التطبيقات البرمجية (Programmatic API)

بالنسبة لبرامج البناء النصية (build scripts) والتكاملات المخصصة، قم بالاستيراد مباشرة من الحزمة:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### الصادرات المتاحة

| التصدير | ماذا يفعل |
|--------|-------------|
| `TranslationMethod` | الفئة الأساسية لجميع الطرق |
| `LLMMethod` | الفئة الأساسية لطرق LLM (OpenRouter) |
| `DirectLLMMethod` | الفئة الأساسية لمزودي LLM المباشرين (OpenAI، Anthropic، Gemini) |
| `OpenAIMethod`، `AnthropicMethod`، `GeminiMethod` | فئات مزودي LLM المباشرين |
| `DeepLMethod`، `MicrosoftTranslatorMethod`، `LibreTranslateMethod`، `TildeMethod`، `TranslatedMethod` | فئات الترجمة الآلية (MT) التقليدية |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM موجه (OpenRouter + بيانات التوجيه) |
| `APIMethod` | عميل API عن بُعد |
| `runSync`، `runContentSync` | خط أنابيب المزامنة الكامل |
| `resolveConfig`، `resolvePairs` | حل الإعدادات |
| `validateTranslations` | بوابة الجودة |
| `loadCoachingData`، `findDictionaryMatches` | أدوات التوجيه المساعدة |

### امتداد مزود مخصص

قم بتوسيع `DirectLLMMethod` لإضافة مزود LLM جديد في حوالي 40 سطرًا:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

ستحصل على الترجمة، والتوجيه، وحلقات إعادة المحاولة، والتحقق من صحة النموذج، ومستويات الجودة، والمساعدة في الإعداد مجانًا. شكل طلب HTTP فقط هو الخاص بالمزود. بالنسبة للمحولات غير التابعة لـ LLM التي تستخدم `fetch()` الخام، استخدم المساعد المشترك `fetchWithRetry()` من `lib/methods/fetch-with-retry.js` بدلاً من كتابة حلقة إعادة المحاولة الخاصة بك.

---

## انظر أيضًا

- [مرجع CLI](/docs/reference/cli) — جميع الأوامر والعلامات
- [طرق الترجمة](/docs/guides/translation-methods) — اختيار وخلط الطرق
- [ذاكرة الترجمة](/docs/concepts/translation-memory) — التخزين المؤقت وتوفير التكاليف
- [العمل مع المترجمين المحترفين](/docs/guides/professional-translators) — سير عمل XLIFF
- [مواصفات المكون الإضافي](/docs/reference/plugin-spec) — تنسيق بيان المكون الإضافي للطريقة
- [البنية](/docs/concepts/architecture) — كيف تتصل الأجزاء ببعضها
- [اللغات المدعومة](/docs/reference/supported-languages) — دعم اللغات المدمج
- [كيف تعمل المزامنة](/docs/concepts/how-sync-works) — خط أنابيب الترجمة
