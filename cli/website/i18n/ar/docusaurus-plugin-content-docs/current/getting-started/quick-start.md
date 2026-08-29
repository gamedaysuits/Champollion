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

ترجم ملف الترجمة الأول الخاص بك في 60 ثانية.

## 1. إعداد ملفات الترجمة الخاصة بك

أنشئ ملف ترجمة مصدري. يدعم Champollion تنسيقات JSON و TOML و YAML وغيرها — راجع [مرجع واجهة سطر الأوامر (CLI)](/docs/reference/cli) للحصول على القائمة الكاملة:

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

## 2. تعيين مفتاح واجهة برمجة التطبيقات (API Key)

اختر مزوداً وقم بتعيين المفتاح:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

احصل على مفتاح Gemini مجاني من [aistudio.google.com/apikey](https://aistudio.google.com/apikey). احصل على مفتاح OpenRouter من [openrouter.ai](https://openrouter.ai).

## 3. تشغيل المزامنة (Sync)

```bash
npx champollion sync
```

:::tip[هل تستخدم Gemini؟]
إذا اخترت الخيار ب (Gemini)، أضف `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

سيقوم Champollion بما يلي:
1. الاكتشاف التلقائي لـ `locales/en.json` كملف مصدري
2. العثور على اللغات المستهدفة (أو المطالبة بإدخالها)
3. ترجمة جميع المفاتيح
4. كتابة `locales/fr.json`، `locales/ja.json`، إلخ.
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

عند تغيير سلسلة نصية مصدرية، يكتشف champollion التغيير عبر تتبع تجزئة SHA-256 ويعيد ترجمة ذلك المفتاح فقط في المزامنة التالية:

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

يتم تقديم المفتاح غير المتغير (`hero.subtitle`) من ذاكرة التخزين المؤقت لـ **ذاكرة الترجمة (Translation Memory)** الخاصة بـ champollion — دون إجراء أي استدعاء لواجهة برمجة التطبيقات (API)، وبدون أي تكلفة. يتم بناء ذاكرة التخزين المؤقت تلقائياً أثناء كل عملية مزامنة وتُخزن في `.champollion/tm.json`.

## اختياري: إنشاء ملف تكوين (Config File)

لمزيد من التحكم، قم بإنشاء ملف تكوين:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

يرشدك المعالج الموجه عبر **الإعدادات المسبقة لمستوى اللغة (register presets)** لكل لغة — وهي تعليمات مبنية مسبقاً للنبرة/الرسمية ومضبوطة وفقاً لنظامها اللغوي. تحتوي اللغة الفرنسية على إعدادات T-V المسبقة (vouvoiement مقابل tutoiement)، وتحتوي الكورية على مستويات التحدث (해요체 مقابل 합쇼체 مقابل 해체)، وتحتوي اليابانية على خيارات keigo (です/ます مقابل 丁寧語).

أو قم بإنشاء ملف تكوين يدوياً باستخدام مفاتيح الإعدادات المسبقة:

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
  "model": "google/gemini-2.5-flash"
}
```

قم بتشغيل `npx champollion init` لتصفح الإعدادات المسبقة المتاحة لكل لغة.

## اختياري: وضع المراقبة (Watch Mode)

الترجمة التلقائية عند تغيير الملف المصدري:

```bash
npx champollion watch
```

## الخطوات التالية

- **[التكوين (Configuration)](/docs/getting-started/configuration)** — مرجع التكوين الكامل
- **[طرق الترجمة (Translation Methods)](/docs/guides/translation-methods)** — اختيار الطريقة الصحيحة لكل زوج لغوي
- **[ذاكرة الترجمة (Translation Memory)](/docs/concepts/translation-memory)** — كيف يوفر لك التخزين المؤقت المال عند إعادة التشغيل
- **[العمل مع المترجمين المحترفين](/docs/guides/professional-translators)** — تصدير XLIFF للمراجعة البشرية
- **[تكامل أطر العمل (Framework Integration)](/docs/guides/framework-integration)** — Hugo، next-intl، react-i18next
- **[التكامل المستمر/النشر المستمر (CI/CD)](/docs/guides/ci-cd)** — أتمتة الترجمات في مسار عملك
- **[استكشاف الأخطاء وإصلاحها (Troubleshooting)](/docs/guides/troubleshooting)** — المشكلات الشائعة وحلولها
