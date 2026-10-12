---
sidebar_position: 2
title: "ترجمة 30 لغة"
description: "دليل عملي: توسيع نطاق مشروع من 3 لغات إلى 30 لغة باستخدام الجمع بين الأساليب لكل زوج لغوي، والمعالجة بالدفعات، والتكامل مع CI."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# دليل تطبيقي: ترجمة 30 لغة

ترقية مشروعك من مجرد بضع لغات إلى تغطية عالمية شاملة. يستعرض هذا الدليل التطبيقي خطوات اختيار أساليب الترجمة، وتحسين التكلفة، والتكامل مع CI لعملية نشر حقيقية متعددة اللغات.

**السيناريو:** لديك تطبيق SaaS يحتوي على `en`، و`fr`، و`es`. وتحتاج إلى إضافة 27 لغة أخرى موزعة على ثلاثة مستويات من متطلبات الجودة.

---

## الخطوة 1: تصنيف لغاتك

لا تحتاج جميع اللغات الثلاثين إلى النهج نفسه. قسّمها إلى مجموعات وفقًا لجودة الأسلوب المتاح:

| المستوى | اللغات | الأسلوب | السبب |
|------|-----------|--------|-----|
| **المستوى 1 — المتميز (Premium)** | `ja`، `ko`، `zh`، `de`، `pt` | `llm` (GPT-4o) | أسواق عالية القيمة، قواعد لغوية دقيقة |
| **المستوى 2 — القياسي (Standard)** | `it`، `nl`، `pl`، `sv`، `da`، `fi`، `no`، `cs`، `ro`، `hu`، `el`، `tr`، `id`، `ms`، `th`، `vi`، `uk`، `bg` | `google-translate` | حجم كبير، مدعومة جيدًا من Google |
| **المستوى 3 — الموجَّه (Coached)** | `crk`، `oj`، `mi`، `haw` | `llm-coached` + الملحقات | موارد منخفضة، تتطلب فرض المصطلحات بدقة |

## الخطوة 2: الإعداد لكل زوج لغوي

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.8-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

**ملاحظة:** ترث اللغات غير المدرجة في `pairs` الإعداد `defaultMethod: "google-translate"`. لست بحاجة إلى إدراج اللغات الثلاثين جميعها.

:::info
دعم `crk` قيد التطوير حاليًا — راجع [دعم اللغات منخفضة الموارد](/docs/network/community/low-resource-languages) للاطلاع على الحالة وإرشادات المساهمة.
:::

## الخطوة 3: إعداد مفاتيح API

ستحتاج إلى كلا مفتاحي API لهذا الإعداد:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## الخطوة 4: إجراء تشغيل تجريبي أولاً

عاين التغييرات دائمًا قبل ترجمة 30 لغة:

```bash
npx champollion sync --dry
```

راجع المخرجات. ستوضح لك:
- الأسلوب المستخدم لكل زوج لغوي
- عدد المفاتيح الجديدة أو المعدلة لكل لغة (locale)
- تقدير لعدد استدعاءات API لكل مستوى

## الخطوة 5: تشغيل المزامنة

```bash
npx champollion sync
```

يعالج Champollion كل زوج لغوي بشكل مستقل. ستكون أزواج المستوى 2 التي تستخدم Google Translate سريعة. أما أزواج المستوى 1 التي تعتمد على نماذج LLM فستكون أبطأ ولكن بجودة أعلى. وتستخدم أزواج المستوى 3 الموجهة بيانات التوجيه الخاصة بالملحق.

### التحديثات المتزايدة

بعد المزامنة الأولية، لا تترجم عمليات التشغيل اللاحقة سوى المفاتيح **المعدلة أو الجديدة**:

```bash
# Only keys that changed since last sync
npx champollion sync
```

يتتبع ملف القفل (`.champollion.lock`) ما تم ترجمته، وبذلك لن تعيد ترجمة المحتوى الثابت أبدًا.

## الخطوة 6: تدقيق الجودة

تحقق من حالة جميع الأزواج اللغوية:

```bash
npx champollion status
```

يسرد هذا أسلوب كل زوج، والنموذج، والأسلوب اللغوي (register)، والتوجيه الخاص به، ونتائج اختبارات الأداء للملحق عند نشرها (بالإضافة إلى تسمية `qualityTier`، إذا تم تعيينها في ملف الإعدادات).

### هل التزمت المخرجات بالأساليب اللغوية (registers) المحددة؟

في الخطوة 2، حددت [أسلوبًا لغويًا (register)](/glossary#term-register) لكل لغة — `"Polite/formal"` لليابانية، و`"Formal (Sie)"` للألمانية. (هل المصطلح جديد عليك؟ يشرح المسرد معناه بلغة مبسطة.) تُضمَّن هذه التعليمات في مطالبة الترجمة، ولكن المطالبة مجرد طلب وليست ضمانًا.

يمكن لأداة [Network harness](/docs/network/specifications/harness) — وهي الأداة نفسها التي تشغّل لوحة المتصدرين العامة — قياس مدى الالتزام بالأسلوب اللغوي (register) ونمط الكتابة على عينة من ترجماتك. تفحص مقاييس نمط الكتابة الخاصة بها كل مخرج مقابل الأسلوب اللغوي المتوقع (علامات الرسمية/غير الرسمية، ضمائر المخاطب الرسمية وغير الرسمية T–V، الاختصارات، وانحراف طول الجملة) وتقدم تقريرًا بنتيجة `style_consistency_rate` عبر عملية التشغيل بأكملها. يمكنك أيضًا توجيهها نحو ملف مخصص لصوت العلامة التجارية باستخدام `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

تنبيهان بكل شفافية: هذه المقاييس هي مقاييس **إعلامية استرشادية** (أدوات تشخيصية لا تدخل أبدًا في نتيجة chrF++ الرئيسية للوحة المتصدرين أو تصنيفها)، كما أن الكشف عن درجة الرسمية يعتمد على العلامات اللغوية — فهو أداة لرصد الانحراف وليس حكمًا بشريًا. التفاصيل وتعريفات المقاييس: [مقاييس نمط الكتابة والأسلوب اللغوي](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## الخطوة 7: التكامل مع CI

أضفها إلى سير عمل GitHub Actions لتبقى الترجمات محدثة مع كل عملية دفع (push):

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      # Pinned to the 0.5 line: a new release never changes what this job
      # runs. The CI guide has the complete workflow (the translation cache,
      # partial runs, a dry-run check and verify --strict).
      - name: Sync translations
        run: npx --yes champollion@0.5 sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## تقدير التكلفة

لمشروع يحتوي على 500 مفتاح مصدري عبر 30 لغة:

| المستوى | اللغات | الأسلوب | التكلفة التقديرية |
|------|-----------|--------|-----------------|
| المستوى 1 (5 لغات) | ja, ko, zh, de, pt | GPT-4o | ~2.50$/مزامنة كاملة |
| المستوى 2 (18 لغة) | it, nl, pl، إلخ | Google Translate | ~0.90$/مزامنة كاملة |
| المستوى 3 (4 لغات) | crk, oj, mi, haw | GPT-4o-mini موجه | ~0.40$/مزامنة كاملة |
| **الإجمالي** | **30 لغة** | **مختلط** | **~3.80$/مزامنة كاملة** |

تكلف عمليات المزامنة المتزايدة (5–20 مفتاحًا معدلًا) جزءًا بسيطًا من تكلفة المزامنة الكاملة.

## انظر أيضًا

- [أساليب الترجمة](/docs/guides/translation-methods) — كيفية عمل كل أسلوب ترجمة ومتى يجب استخدامه
- [مواصفات الملحقات البرمجية](/docs/reference/plugin-spec) — إنشاء بيانات توجيه لأي من لغات المستوى 3 لديك
- [دليل CI/CD](/docs/guides/ci-cd) — أنماط متقدمة للتكامل المستمر بما في ذلك إصدارات معاينة طلبات السحب (PR)
- [بوابة الجودة](/docs/concepts/quality-gate) — كيف يتحقق Champollion من كل ترجمة للتأكد من خلوها من المخرجات المعطوبة قبل كتابتها
- [اللغات المدعومة](/docs/reference/supported-languages) — القائمة الكاملة لرموز اللغات وتوافقها مع الأساليب
- [مقاييس نمط الكتابة والأسلوب اللغوي](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — قياس مدى الالتزام بالأسلوب اللغوي/النمط باستخدام أداة التقييم (مقاييس إعلامية)
- [المسرد: الأسلوب اللغوي](/glossary#term-register) — ماذا يعني "الأسلوب اللغوي" (register)، بلغة مبسطة
- [دعم اللغات منخفضة الموارد](/docs/network/community/low-resource-languages) — إضافة بيانات توجيه للغات التي تفتقر إلى تغطية واسعة في الترجمة الآلية
