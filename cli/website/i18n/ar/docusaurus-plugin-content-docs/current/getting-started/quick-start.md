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
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# البدء السريع

ترجم أول ملف لغة لك في 60 ثانية.

أداة CLI مجانية للاستخدام غير التجاري بموجب
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)؛ ولا يغطي هذا الترخيص الاستخدام التجاري. يُغطى استخدام مدرسة، أو مستشفى أو عيادة عامة، أو جمعية خيرية، أو مشروع شخصي؛ بينما لا يُغطى متجر تجاري. توضح صفحة [من يحق له استخدام هذا](/docs/getting-started/who-may-use-this) التفاصيل كاملة.

## 1. إعداد ملفات اللغات

أنشئ ملف لغة مصدرياً. يدعم Champollion صيغ JSON وTOML وYAML وغيرها — راجع [مرجع CLI](/docs/reference/cli) للاطلاع على القائمة الكاملة:

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

## 2. تعيين مفتاح API الخاص بك

اختر مزوداً وعيّن المفتاح:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

احصل على مفتاح Gemini مجاني من [aistudio.google.com/apikey](https://aistudio.google.com/apikey). احصل على مفتاح OpenRouter من [openrouter.ai](https://openrouter.ai). بالنسبة للخيار C، حدد اسم نموذجك عند إعداد المشروع: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (أو شغّل `sync --method local --model llama3.1`).

## 3. تشغيل المزامنة

```bash
npx champollion sync
```

:::note[تكتبه بنفسك، أم يشغّله برنامج نصي؟]
الأوامر الواردة في هذه الصفحة هي أوامر تكتبها أنت: يشغّل `npx champollion` النسخة المثبتة في مشروعك، أو النسخة التي يجلبها npx — أحدث إصدار في المرة الأولى، ثم تلك النسخة المحفوظة مؤقتاً. أما الأمر الذي يشغّله برنامج نصي نيابة عنك — مثل CI، أو برنامج نصي في `package.json`، أو خطاف git — فينبغي أن يحدد إصداره، `npx --yes champollion@0.6 sync`، حتى لا يغيّر أي إصدار جديد ما يشغّله البناء (ويمنع `--yes` أداة npx من التوقف للسؤال). يثبّت [دليل CI](/docs/guides/ci-cd) و[صفحات أطر العمل](/docs/integrations/frameworks) الإصدار بهذه الطريقة.
:::

:::tip[هل تستخدم Gemini؟]
إذا اخترت الخيار B (Gemini)، أضف `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

سوف يقوم Champollion بـ:
1. الاكتشاف التلقائي لـ `locales/en.json` كملف مصدري
2. العثور على اللغات المستهدفة (أو مطالبتك بإدخالها)
3. ترجمة جميع المفاتيح
4. كتابة `locales/fr.json` و`locales/ja.json` وما إلى ذلك
5. إنشاء `.champollion.lock` لتتبع ما تمّت ترجمته

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

عندما تغيّر نصاً مصدرياً، يكتشف Champollion التغيير عبر تتبع تجزئة SHA-256 ويعيد ترجمة ذلك المفتاح فقط في المزامنة التالية:

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

يتم **تخطي** المفتاح الذي لم يتغير (`hero.subtitle`): فترجمته موجودة بالفعل في `locales/fr.json`، لذا لا يُرسل إلى أي مكان ولا يتم البحث عنه حتى — دون أي استدعاء، ودون أي تكلفة، ولا يُحسب ضمن رقم "قُدِّم من التخزين المؤقت" لتلك الدورة.

تُستخدم **ذاكرة الترجمة** (`.champollion/tm.json`، التي تُبنى تلقائياً أثناء كل مزامنة) للنصوص التي *أُدرجت* في قائمة الانتظار: مثل نص أعدته إلى حالته السابقة، أو الجملة نفسها في ملف آخر، أو إعادة ترجمة لغة بأكملها (`sync --redo all`). تُقدَّم هذه النصوص من التخزين المؤقت مجاناً، ويوضح سطر التشغيل عددها (`… 0 key(s) sent to the model, 12 served from the cache (free)`). يُحتفظ بالتخزين المؤقت لكل أسلوب ومستوى لغوي وتوجيه — لكل من الزوج وبديله الاحتياطي. بعد تبديل الأسلوب (مثلاً `local` → `llm`)، أو تغيير نص ملف التوجيه (في الزوج أو لغته أو بديله الاحتياطي)، لا يُعاد استخدام أي شيء ويوضح سطر التشغيل السبب؛ بينما يؤدي تغيير النموذج وحده إلى إعادة استخدام الترجمات السابقة. لا يؤدي أي تغيير بحد ذاته إلى إعادة الترجمة تلقائياً: يحدد `sync` ما ستتم إعادته وتكلفته.

## اختياري: إنشاء ملف تهيئة

لمزيد من التحكم، أنشئ ملف تهيئة:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

يختار `--method` و`--model` أسلوب الترجمة والنموذج (يعرض `npx champollion init --help` قائمة بالأساليب)؛ ويطبع أمر init الأساليب التي تستخدمها التهيئة.

يرشدك المعالج التفاعلي خلال **الإعدادات المسبقة للأسلوب اللغوي** لكل لغة — وهي تعليمات مدمجة للنبرة والرسمية مضبوطة وفق نظامها اللغوي. فالفرنسية مثلاً تحتوي على إعدادات تمييز المخاطب T-V (vouvoiement مقابل tutoiement)، والكورية تحتوي على مستويات الخطاب (해요체 مقابل 합쇼체 مقابل 해체)، واليابانية تحتوي على خيارات keigo (です/ます مقابل 丁寧語).

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

الترجمة التلقائية عند تغير الملف المصدري:

```bash
npx champollion watch
```

## الخطوات التالية

- **[التهيئة](/docs/getting-started/configuration)** — مرجع التهيئة الكامل
- **[أساليب الترجمة](/docs/guides/translation-methods)** — اختر الأسلوب المناسب لكل زوج لغوي
- **[ذاكرة الترجمة](/docs/concepts/translation-memory)** — كيف يوفر لك التخزين المؤقت التكاليف عند إعادة التشغيل
- **[العمل مع مترجمين محترفين](/docs/guides/professional-translators)** — تصدير ملفات XLIFF للمراجعة البشرية
- **[التكامل مع أطر العمل](/docs/integrations/frameworks)** — Hugo وnext-intl وreact-i18next
- **[CI/CD](/docs/guides/ci-cd)** — أتمتة الترجمة في مسار العمل لديك
- **[استكشاف الأخطاء وإصلاحها](/docs/guides/troubleshooting)** — المشاكل الشائعة وحلولها
