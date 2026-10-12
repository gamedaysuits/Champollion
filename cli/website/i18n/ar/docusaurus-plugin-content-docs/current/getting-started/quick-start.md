---
sidebar_position: 2
title: "البدء السريع"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# البدء السريع

ترجم أول ملف لغة (locale) لك في غضون 60 ثانية.

أداة CLI مجانية للاستخدام غير التجاري بموجب
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)؛ ولا يغطي هذا الترخيص الاستخدام التجاري. يشمل ذلك المدارس، والمستشفيات العامة أو العيادات، والجمعيات الخيرية، أو المشاريع الشخصية؛ لكنه لا يشمل واجهات المتاجر التجارية. وتفصّل صفحة [من يحق له استخدام هذا](/docs/getting-started/who-may-use-this) الأمر بالكامل.

## 1. إعداد ملفات اللغة

أنشئ ملف لغة مصدرياً. يدعم Champollion كلاً من JSON وTOML وYAML وغيرها — راجع [مرجع CLI](/docs/reference/cli) للاطلاع على القائمة الكاملة:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. تعيين مفتاح API

اختر مزود خدمة وعيّن المفتاح:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

احصل على مفتاح Gemini مجاني من [aistudio.google.com/apikey](https://aistudio.google.com/apikey). واحصل على مفتاح OpenRouter من [openrouter.ai](https://openrouter.ai). بالنسبة للخيار C، حدد نموذجك عند إعداد المشروع: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (أو شغّل `sync --method local --model llama3.1`).

## 3. تشغيل المزامنة

```bash
npx champollion sync
```

:::note[هل تكتب الأمر بنفسك، أم يُشغّله برنامج نصي؟]
الأوامر الواردة في هذه الصفحة هي أوامر تكتبها بنفسك: `npx champollion` يُشغّل النسخة المثبتة في مشروعك، أو النسخة التي يجلبها npx — أحدث إصدار في المرة الأولى، ثم تلك النسخة المخزنة مؤقتاً. أما الأوامر التي يُشغّلها برنامج نصي نيابةً عنك — مثل التكامل المستمر (CI)، أو برنامج نصي في `package.json`، أو خطاف git hook — فينبغي أن تُحدد رقم إصدارها، `npx --yes champollion@0.5 sync`، حتى لا يغير أي إصدار جديد ما يُشغّله مسار البناء (و`--yes` يمنع npx من التوقف لطلب التأكيد). يثبت [دليل CI](/docs/guides/ci-cd) و[صفحات أطر العمل](/docs/integrations/frameworks) الإصدار بهذه الطريقة.
:::

:::tip[هل تستخدم Gemini؟]
إذا اخترت الخيار B (Gemini)، فأضف `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

سيقوم Champollion بما يلي:
1. الاكتشاف التلقائي لـ `locales/en.json` بوصفه المصدر
2. العثور على اللغات المستهدفة (أو مطالبتك بتحديدها)
3. ترجمة جميع المفاتيح
4. كتابة `locales/fr.json`، و`locales/ja.json`، إلخ.
5. إنشاء `.champollion.lock` لتتبع ما تمت ترجمته

## 4. التحقق من النتائج

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## ماذا يحدث بعد ذلك؟

عندما تُعدّل نصاً مصدرياً، يكتشف champollion التغيير عبر تتبع تجزئة SHA-256 ويُعيد ترجمة هذا المفتاح فقط في المزامنة التالية:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

يتم **تخطي** المفتاح الذي لم يتغير (`hero.subtitle`): فترجمته موجودة بالفعل في `locales/fr.json`، لذا لا يُرسل إلى أي مكان ولا يُبحث عنه حتى — فلا يوجد أي استدعاء، ولا تكلفة، ولا يُحسب ضمن رقم "المُخدَّم من التخزين المؤقت" الخاص بالتشغيل.

تُستخدم **ذاكرة الترجمة** (`.champollion/tm.json`، التي تُبنى تلقائياً أثناء كل عملية مزامنة) للنصوص التي *تكون* في قائمة الانتظار: مثل نص تعيد تغييره إلى ما كان عليه، أو نفس الجملة في ملف آخر، أو إعادة ترجمة لغة كاملة (`sync --redo all`). يتم توفير هذه النصوص من التخزين المؤقت مجاناً، ويشير سطر التشغيل إلى عددها (`… 0 key(s) sent to the model, 12 served from the cache (free)`). يُحفظ التخزين المؤقت لكل طريقة وأسلوب خطاب وتوجيه — لكل من الزوج اللغوي وبديله الاحتياطي على حدة. بعد تبديل الطريقة (على سبيل المثال `local` ← `llm`)، أو تغيير نص ملف توجيه (على الزوج أو لغته أو بديله الاحتياطي)، لا يُعاد استخدام أي شيء ويوضح التشغيل سبب ذلك؛ بينما يؤدي تغيير النموذج وحده إلى إعادة استخدام الترجمات السابقة. لا يؤدي أي تغيير بمفرده إلى إعادة الترجمة تلقائياً: بل يحدد `sync` إعادة الترجمة وتكلفتها.

## اختياري: إنشاء ملف تهيئة

لمزيد من التحكم، أنشئ ملف تهيئة:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

يحدد `--method` و`--model` طريقة الترجمة ونموذجها (يعرض `npx champollion init --help` قائمة بالطرق)؛ ويطبع أمر init الطرق التي يستخدمها ملف التهيئة.

يرشدك المعالج التفاعلي خلال **الإعدادات المسبقة لأسلوب الخطاب** — وهي تعليمات مسبقة للنبرة والرسمية مصممة وفقاً لنظام كل لغة. فاللغة الفرنسية تحتوي على إعدادات T-V المسبقة (vouvoiement مقابل tutoiement)، واللغة الكورية تحتوي على مستويات التخاطب (해요체 مقابل 합쇼체 مقابل 해체)، واللغة اليابانية تحتوي على خيارات keigo‏ (です/ます مقابل 丁寧語).

أو أنشئ ملف تهيئة يدوياً باستخدام مفاتيح الإعدادات المسبقة:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

شغّل `npx champollion init` لاستعراض الإعدادات المسبقة المتاحة لكل لغة.

## اختياري: وضع المراقبة

ترجمة تلقائية عند تعديل ملفك المصدري:

```bash
npx champollion watch
```

## الخطوات التالية

- **[التهيئة](/docs/getting-started/configuration)** — مرجع التهيئة الكامل
- **[طرق الترجمة](/docs/guides/translation-methods)** — اختر الطريقة المناسبة لكل زوج لغوي
- **[ذاكرة الترجمة](/docs/concepts/translation-memory)** — كيف يوفر لك التخزين المؤقت التكاليف عند إعادة التشغيل
- **[التعامل مع مترجمين محترفين](/docs/guides/professional-translators)** — تصدير بصيغة XLIFF للمراجعة البشرية
- **[التكامل مع أطر العمل](/docs/guides/framework-integration)** — Hugo وnext-intl وreact-i18next
- **[التكامل والنشر المستمر (CI/CD)](/docs/guides/ci-cd)** — أتمتة الترجمات في مسار عملك
- **[استكشاف الأخطاء وإصلاحها](/docs/guides/troubleshooting)** — المشاكل الشائعة وحلولها
