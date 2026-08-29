---
sidebar_position: 9
title: "دليل الوكيل: استخدام champollion"
description: "كيف يمكن لوكلاء الذكاء الاصطناعي تثبيت وإعداد وتشغيل champollion لترجمة ملفات locale."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# دليل الوكيل: استخدام champollion

champollion هي أداة واجهة سطر أوامر (CLI) تترجم ملفات الترجمة (locale files) الخاصة بتطبيقك بأمر واحد. هذا الدليل مخصص لوكلاء الذكاء الاصطناعي (أو المطورين الذين يعملون مع وكلاء الذكاء الاصطناعي) الذين يرغبون في الانتقال من الصفر إلى ملفات ترجمة جاهزة بسرعة.

:::tip[هل أنت على دراية مسبقة؟]
إذا كنت تحتاج فقط إلى الأوامر، فانتقل إلى [مرجع واجهة سطر الأوامر (CLI Reference)](/docs/reference/cli). وإذا كنت ترغب في بناء طريقة ترجمة وقياس أدائها، فراجع [دليل وكيل الشبكة (Network Agent Guide)](/docs/network/getting-started/agent-guide).
:::

---

## إعداد البيئة

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**المتطلبات:**
- Node.js 20.11+ (ESM أصلي)
- مفتاح واجهة برمجة التطبيقات (API key) لمزود الترجمة الخاص بك

**إعداد مفتاح واجهة برمجة التطبيقات (API key)** — تحتاج أداة champollion إلى مفتاح واحد على الأقل بناءً على الطرق التي تستخدمها:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

تقرأ Champollion `.env.local` و `.env` تلقائيًا (الأولوية: `process.env` → `.env.local` → `.env`). احصل على مفتاح OpenRouter من [openrouter.ai/keys](https://openrouter.ai/keys).

---

## المزامنة الأولى

تكتشف Champollion تلقائيًا ملفات الترجمة (locale files) الخاصة بك، وتنسيقها (JSON أو TOML أو YAML)، واللغات المستهدفة:

```bash
npx champollion sync
```

**ماذا يحدث:**
1. يتم تحميل `champollion.config.json` (أو اكتشاف الإعدادات تلقائيًا)
2. يتم فحص ملف الترجمة المصدر، وتسطيح المفاتيح المتداخلة (flattens nested keys)
3. تتم المقارنة مع `.champollion.lock` (تجزئات SHA-256 للقيم المترجمة سابقًا)
4. يتم التحقق من `.champollion/tm.json` بحثًا عن الترجمات المخزنة مؤقتًا (ذاكرة الترجمة)
5. تتم ترجمة **المفاتيح المتغيرة أو المفقودة أو القديمة** فقط عبر الطريقة المكونة
6. يتم تشغيل بوابة الجودة (5 فحوصات) على كل ترجمة
7. تُكتب الترجمات الناجحة في ملف الترجمة المستهدف
8. يتم تحديث ملف القفل (lock file) وذاكرة التخزين المؤقت لذاكرة الترجمة (TM cache)

في عملية إعادة التشغيل النموذجية بعد تغيير مفتاح واحد، تقدم الخطوة 4 عدد 142 مفتاحًا من ذاكرة التخزين المؤقت وتترجم الخطوة 5 مفتاحًا واحدًا. ولهذا السبب تكون عمليات المزامنة اللاحقة سريعة وغير مكلفة.

---

## التكوين (Configuration)

قم بإنشاء `champollion.config.json` في جذر مشروعك:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

تستخدم مفاتيح الأزواج (Pair keys) **نقطتين رأسيتين** (`en:fr`)، وليس واصلة — الواصلات محجوزة لرموز اللغات الإقليمية مثل `es-MX`.

الحقول الرئيسية:

| الحقل | الغرض | الافتراضي |
|-------|---------|---------|
| `inputLocale` | اللغة المصدر | `en` |
| `languages` | اللغات المستهدفة (مصفوفة أو كائن) | `[]` |
| `pairs` | تجاوزات لكل زوج (مفاتيح `"src:tgt"`) مع تكوين الطريقة | اختياري (optional) |
| `localesDir` | مكان وجود ملفات الترجمة | `./locales` |
| `model` | نموذج LLM لطرق `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | عدد المفاتيح لكل استدعاء API | 80 (LLM)؛ يضع Google Translate حدًا أقصى يبلغ 128 مقطعًا/طلب |
| `jsonConcurrency` | ترجمات اللغات المتوازية لمفاتيح JSON | 50 |
| `contentConcurrency` | استدعاءات API المتوازية لترجمة المحتوى | 48 (مستندات Docusaurus)، 12 (Hugo `contentDir`) |

المرجع الكامل: [التكوين (Configuration)](/docs/getting-started/configuration)

---

## طرق الترجمة

| الطريقة | متى تستخدمها | التكلفة | مفتاح API المطلوب |
|--------|------------|------|---------------|
| **`llm`** | للأغراض العامة، جيدة للغات ذات الموارد الوفيرة | لكل رمز (حسب النموذج) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | عندما يكون لديك قواعد نحوية/قاموس للغة المستهدفة | لكل رمز + سياق التوجيه (coaching context) | `OPENROUTER_API_KEY` |
| **`google-translate`** | اللغات ذات الموارد الوفيرة حيث تعمل ترجمة جوجل (GT) بشكل جيد | 20 دولارًا/مليون حرف | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | مسار مخصص (Custom pipeline) مستضاف خلف نقطة نهاية HTTP | يحدده الخادم | لا يوجد (تتولى نقطة النهاية المصادقة) |
| **`plugin`** | طريقة مجهزة مسبقًا ومثبتة محليًا | متفاوتة | متفاوت |

التفاصيل: [طرق الترجمة](/docs/guides/translation-methods)

---

## بيانات التوجيه (Coaching Data)

بالنسبة لأزواج `llm-coached`، تقوم بيانات التوجيه بتوجيه نموذج LLM بمعرفة لغوية صريحة. قم بإنشاء ملف توجيه:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

قم بالإشارة إليه في تكوين الزوج الخاص بك:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

تتحقق بوابة الجودة من ظهور مصطلحات القاموس فعليًا في المخرجات — تُسجل الانتهاكات كتحذيرات `[TERM]`.

التفاصيل: [بيانات التوجيه](/docs/concepts/coaching-data)

---

## بوابة الجودة (Quality Gate)

تمر كل ترجمة عبر خمسة فحوصات آلية قبل كتابتها على القرص:

| الفحص | ما يكتشفه | مثال |
|-------|----------------|---------|
| **فارغ/خالٍ (Empty/blank)** | لم يُرجع النموذج أي شيء | `""` |
| **صدى المصدر (Source echo)** | أرجع النموذج الإدخال الإنجليزي دون تغيير | `"Welcome"` للغة اليابانية |
| **حلقة الهلوسة (Hallucination loop)** | تكرار الثلاثيات (trigrams) | `"Qo' Qo' Qo' Qo'"` |
| **تضخم الطول (Length inflation)** | المخرجات أطول بـ 4 أضعاف أو أكثر من المصدر | مصدر من 10 أحرف → مخرجات من 50 حرفًا |
| **الامتثال للنص (Script compliance)** | نص خاطئ للغة | نص لاتيني للغة العربية |

تُسجل الإخفاقات ببادئة `[GATE]`. لا توجد إجراءات احتياطية صامتة (silent fallbacks) — إذا فشلت الترجمة، يتم الإبلاغ عنها، ولا تُقبل بصمت.

التفاصيل: [بوابة الجودة](/docs/concepts/quality-gate)

---

## ذاكرة الترجمة (Translation Memory)

تُخزن Champollion الترجمات مؤقتًا في `.champollion/tm.json`، مفهرسة بواسطة النص المصدر + اللغة + الطريقة. في عمليات المزامنة اللاحقة، يتم تقديم المفاتيح غير المتغيرة من ذاكرة التخزين المؤقت — بدون استدعاء API، وبدون تكلفة.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

لتجاوز ذاكرة التخزين المؤقت لتشغيل واحد: `npx champollion sync --no-tm`

التفاصيل: [ذاكرة الترجمة](/docs/concepts/translation-memory)

---

## الملفات المُنشأة

تُنشئ Champollion عدة ملفات في مشروعك. تعرف على ماهيتها حتى لا تحذفها أو تودعها (commit) بالخطأ:

| الملف | الغرض | Git؟ |
|------|---------|------|
| `.champollion.lock` | تجزئات SHA-256 لقيم المصدر المترجمة (اكتشاف التغييرات) | **نعم** — قم بإيداع هذا (commit) |
| `.champollion-content.lock` | نفس الشيء، ولكن لملفات محتوى Markdown/MDX | **نعم** — قم بإيداع هذا |
| `.champollion/` | دليل الحالة الداخلية (ذاكرة التخزين المؤقت `tm.json`، صادرات XLIFF، النسخ الاحتياطية) | **لا** — أضفه إلى gitignore؛ `tm.json` هي ذاكرة تخزين مؤقت محلية (راجع [التكوين](/docs/getting-started/configuration)) |
| ملفات التوجيه التي تؤلفها (مثل `coaching/fr.json`) | معرفتك اللغوية | **نعم** — قم بإيداع هذه الملفات |
| `champollion.config.json` | تكوين المشروع | **نعم** — قم بإيداع هذا |

---

## الأنماط الشائعة

**ترجمة جميع الأزواج المكونة:**
```bash
npx champollion sync
```
تترجم Champollion جميع اللغات بالتوازي. بفضل التخزين المؤقت لذاكرة الترجمة (TM caching)، تصل المفاتيح المتغيرة فقط إلى واجهة برمجة التطبيقات (يتم تقديم الأزواج غير المتغيرة من ذاكرة التخزين المؤقت، لذا فإن المزامنة الكاملة غير مكلفة).

**ترجمة أزواج محددة فقط:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
يُقيد `--pair` التشغيل على الزوج (أو الأزواج) المسماة؛ تنطبق فحوصات الجاهزية والإنفاق على تلك الأزواج فقط. تسمية زوج غير موجود في مخطط الأزواج المكون لديك يؤدي إلى فشل صريح مع عرض قائمة الأزواج المكونة — ولا يمر أبدًا كعملية صامتة بلا تأثير (silent no-op).

**وضع المحتوى (Markdown/MDX لـ Docusaurus و Hugo وما إلى ذلك):**
```bash
npx champollion sync --content-dir ./content
```
يترجم المستندات ومنشورات المدونة وملفات المحتوى جنبًا إلى جنب مع ملفات JSON للغات. تعمل ترجمة المحتوى بالتوازي؛ يمكنك ضبطها باستخدام `--content-concurrency`.

**التشغيل التجريبي (معاينة بدون كتابة):**
```bash
npx champollion sync --dry-run
```

**فرض إعادة ترجمة مفاتيح محددة:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**فرض إعادة ترجمة جميع ملفات المحتوى:**
```bash
npx champollion sync --force-content
```

**التحقق من حالة الترجمة:**
```bash
npx champollion status
```
يعرض التغطية ومستويات الجودة ومعلومات المكون الإضافي لكل زوج.

**التدقيق بحثًا عن القيم الاحتياطية غير المترجمة:**
```bash
npx champollion audit
```
يسرد جميع القيم الاحتياطية `[EN]` التي تحتاج إلى ترجمة.

---

## استكشاف الأخطاء وإصلاحها

| المشكلة | الحل |
|---------|-----|
| `OPENROUTER_API_KEY not set` | قم بتصدير المفتاح أو إضافته إلى `.env` في جذر مشروعك |
| `No locale files found` | قم بتعيين `localesDir` في التكوين، أو تأكد من أن ملفات الترجمة الخاصة بك تتطابق مع التسمية القياسية (`en.json`، `fr.json`) |
| `[GATE] Script compliance failed` | حصلت لغتك المستهدفة على نص لاتيني بدلاً من النص المتوقع — جرب نموذجًا مختلفًا أو أضف بيانات توجيه |
| `[GATE] Source echo` | أرجع النموذج اللغة الإنجليزية دون تغيير — عادةً ما تؤدي بيانات التوجيه أو استخدام نموذج مختلف إلى إصلاح ذلك |
| جميع الترجمات مخزنة مؤقتًا | قم بالتشغيل باستخدام `--no-tm` لتجاوز ذاكرة التخزين المؤقت، أو `--force-keys` لمفاتيح محددة |
| تعارضات ملف القفل (Lock file conflicts) | يستخدم `.champollion.lock` تجزئات SHA-256 — من الآمن حل تعارضات الدمج (merge conflicts) عن طريق الاحتفاظ بأي من الإصدارين، ثم إعادة تشغيل المزامنة |

---

## الخطوات التالية

- [البداية السريعة (Quick Start)](/docs/getting-started/quick-start) — جولة إرشادية كاملة للبدء
- [مرجع واجهة سطر الأوامر (CLI Reference)](/docs/reference/cli) — كل أمر وعلامة (flag)
- [كيف تعمل (How It Works)](/docs/how-it-works) — شرح مسار المزامنة
- [جسر أداة التقييم (The Eval Harness Bridge)](/docs/guides/bridge) — كيف تتصل champollion بالشبكة
- **هل ترغب في بناء طريقة الترجمة الخاصة بك؟** راجع [دليل وكيل الشبكة (Network Agent Guide)](/docs/network/getting-started/agent-guide) — قم ببناء طريقة، وأثبت أنها تعمل على لوحة الصدارة العامة، وتنافس على جائزة إذا/عندما تكون متاحة (الجوائز هي آلية مخطط لها — راجع [القيود الصريحة (Honest Limitations)](/docs/network/honest-limitations)).
