---
sidebar_position: 2
title: "ترجمة 30 لغة"
description: "دليل عملي: توسيع نطاق مشروع من 3 لغات إلى 30 لغة باستخدام دمج الطرق لكل زوج لغوي، والمعالجة المجمعة، والتكامل مع CI."
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

# دليل عملي: ترجمة 30 لغة

توسيع نطاق مشروع من عدد قليل من اللغات المحلية إلى تغطية عالمية. يستعرض هذا الدليل العملي اختيار الطريقة، وتحسين التكلفة، والتكامل المستمر (CI) لنشر حقيقي متعدد اللغات.

**السيناريو:** لديك تطبيق برمجيات كخدمة (SaaS) باللغات `en`، `fr`، `es`. وتحتاج إلى إضافة 27 لغة أخرى عبر ثلاثة مستويات من متطلبات الجودة.

---

## الخطوة 1: تصنيف لغاتك

لا تحتاج جميع اللغات الثلاثين إلى نفس النهج. قم بتجميعها حسب جودة الطريقة المتاحة:

| المستوى | اللغات | الطريقة | السبب |
|------|-----------|--------|-----|
| **المستوى 1 — متميز** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | أسواق عالية القيمة، قواعد نحوية دقيقة |
| **المستوى 2 — قياسي** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | حجم كبير، مدعومة جيدًا من Google |
| **المستوى 3 — موجه** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + إضافات (plugins) | موارد منخفضة، تتطلب فرض المصطلحات |

## الخطوة 2: التكوين لكل زوج لغوي

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
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
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**ملاحظة:** اللغات غير المدرجة في `pairs` ترث `defaultMethod: "google-translate"`. لست بحاجة إلى إدراج جميع اللغات الثلاثين.

:::info
دعم `crk` قيد التطوير — راجع [دعم لغة قليلة الموارد](/docs/network/community/low-resource-languages) لمعرفة الحالة وإرشادات المساهمة.
:::

## الخطوة 3: إعداد مفاتيح واجهة برمجة التطبيقات (API Keys)

ستحتاج إلى كلا مفتاحي واجهة برمجة التطبيقات (API) لهذا التكوين:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## الخطوة 4: إجراء تشغيل تجريبي أولاً

قم دائمًا بالمعاينة قبل ترجمة 30 لغة:

```bash
npx champollion sync --dry
```

راجع المخرجات. ستعرض ما يلي:
- أي الأزواج اللغوية تستخدم أي طريقة
- عدد المفاتيح الجديدة/المعدلة لكل لغة محلية
- استدعاءات واجهة برمجة التطبيقات (API) المقدرة لكل مستوى

## الخطوة 5: تشغيل المزامنة

```bash
npx champollion sync
```

يعالج Champollion كل زوج لغوي بشكل مستقل. ستكون أزواج المستوى 2 التي تستخدم Google Translate سريعة. بينما ستكون أزواج المستوى 1 التي تستخدم النماذج اللغوية الكبيرة (LLM) أبطأ ولكن بجودة أعلى. وتستخدم أزواج المستوى 3 الموجهة بيانات التوجيه الخاصة بالإضافة (plugin).

### التحديثات التزايدية

بعد المزامنة الأولية، تقوم عمليات التشغيل اللاحقة بترجمة المفاتيح **المعدلة أو الجديدة** فقط:

```bash
# Only keys that changed since last sync
npx champollion sync
```

يتتبع ملف القفل (`.champollion.lock`) ما تمت ترجمته، لذلك لن تقوم أبدًا بإعادة ترجمة المحتوى المستقر.

## الخطوة 6: تدقيق الجودة

تحقق من حالة جميع الأزواج اللغوية:

```bash
npx champollion status
```

يُخرج هذا جدولاً يوضح طريقة كل زوج لغوي، والنموذج، ومستوى الجودة، وما إذا كانت بيانات التوجيه أو درجات التقييم المعياري متاحة.

### هل احترمت المخرجات مستويات السجل اللغوي (registers) الخاصة بك؟

في الخطوة 2، قمت بتعريف [سجل لغوي (register)](/glossary#term-register) لكل لغة — `"Polite/formal"` للغة اليابانية، و`"Formal (Sie)"` للغة الألمانية. (هل المصطلح جديد عليك؟ يشرحه المسرد بلغة مبسطة). تدخل هذه التعليمات في موجه الترجمة (prompt)، ولكن الموجه هو طلب وليس ضمانًا.

يمكن لأداة [Network harness](/docs/network/specifications/harness) — وهي نفس الأداة التي تشغل لوحة الصدارة العامة — قياس مدى الالتزام بالسجل اللغوي والأسلوب على عينة من ترجماتك. تتحقق مقاييس أسلوب الكتابة الخاصة بها من كل مخرج مقابل السجل اللغوي المتوقع (علامات الرسمية/غير الرسمية، ضمائر المخاطب T-V، الاختصارات، انحراف طول الجملة) وتبلغ عن `style_consistency_rate` عبر عملية التشغيل. يمكنك أيضًا توجيهها إلى ملف تعريف مخصص لصوت العلامة التجارية باستخدام `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

تحذيران صريحان: هذه المقاييس **إعلامية** (لا تدخل أبدًا في النتيجة المركبة للوحة الصدارة)، واكتشاف الرسمية يعتمد على العلامات — فهو كاشف للانحراف، وليس حكمًا بشريًا. التفاصيل وتعريفات المقاييس: [مقاييس أسلوب الكتابة والسجل اللغوي](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## الخطوة 7: تكامل CI (التكامل المستمر)

أضفه إلى سير عمل GitHub Actions الخاص بك لتبقى الترجمات محدثة مع كل عملية دفع (push):

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
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
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

لمشروع يحتوي على 500 مفتاح مصدر عبر 30 لغة:

| المستوى | اللغات | الطريقة | التكلفة التقريبية |
|------|-----------|--------|-----------------|
| المستوى 1 (5 لغات) | ja, ko, zh, de, pt | GPT-4o | ~$2.50/مزامنة كاملة |
| المستوى 2 (18 لغة) | it, nl, pl, إلخ. | Google Translate | ~$0.90/مزامنة كاملة |
| المستوى 3 (4 لغات) | crk, oj, mi, haw | GPT-4o-mini موجه | ~$0.40/مزامنة كاملة |
| **الإجمالي** | **30 لغة** | **مختلط** | **~$3.80/مزامنة كاملة** |

تكلف عمليات المزامنة التزايدية (5-20 مفتاحًا معدلاً) جزءًا بسيطًا من تكلفة المزامنة الكاملة.

## انظر أيضًا

- [طرق الترجمة](/docs/guides/translation-methods) — كيف تعمل كل طريقة ترجمة ومتى يجب استخدامها
- [مواصفات الإضافة (Plugin)](/docs/reference/plugin-spec) — إنشاء بيانات توجيه لأي من لغات المستوى 3 الخاصة بك
- [دليل CI/CD](/docs/guides/ci-cd) — أنماط التكامل المستمر (CI) المتقدمة بما في ذلك إنشاءات معاينة طلبات السحب (PR)
- [بوابة الجودة](/docs/concepts/quality-gate) — كيف يتحقق Champollion من صحة كل ترجمة قبل كتابتها
- [اللغات المدعومة](/docs/reference/supported-languages) — قائمة كاملة برموز اللغات وتوافق الطرق
- [مقاييس أسلوب الكتابة والسجل اللغوي](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — قياس الالتزام بالسجل اللغوي/الأسلوب باستخدام أداة التقييم (مقاييس إعلامية)
- [المسرد: السجل اللغوي (register)](/glossary#term-register) — ماذا يعني "السجل اللغوي"، بلغة مبسطة
- [دعم لغة قليلة الموارد](/docs/network/community/low-resource-languages) — إضافة بيانات توجيه للغات التي لا تحظى بتغطية واسعة في الترجمة الآلية (MT)
