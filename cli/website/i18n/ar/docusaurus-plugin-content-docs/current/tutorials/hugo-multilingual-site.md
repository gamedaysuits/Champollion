---
sidebar_position: 3
title: "موقع Hugo متعدد اللغات"
description: "دليل عملي: إعداد موقع Hugo كامل متعدد اللغات بحيث يتولى champollion ترجمة كل من ملفات السلاسل النصية ومحتوى Markdown."
related:
  - label: "Content Translation"
    to: /docs/guides/content-translation
    kind: guide
    note: "Markdown and long-form content, not just strings"
  - label: "Framework Integration"
    to: /docs/guides/framework-integration
    kind: guide
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale the same setup to thirty locales"
---

# كتاب الوصفات: موقع Hugo متعدد اللغات

إعداد نظام Hugo متعدد اللغات مع تولي champollion معالجة كل من ملفات السلاسل النصية بصيغة JSON وترجمة محتوى Markdown. يغطي هذا سير العمل بالكامل بدءاً من إعداد المشروع وحتى النشر في بيئة الإنتاج.

**ما ستقوم ببنائه:** موقع Hugo باللغات الإنجليزية والفرنسية واليابانية — ترجمة السلاسل النصية عبر ملفات الترجمة (locale files)، وترجمة المحتوى عبر معالجة Markdown.

---

## هيكل المشروع

يستخدم Champollion وضع الترجمة **المعتمد على اسم الملف** (filename-based) الخاص بـ Hugo. توضع الملفات المترجمة في نفس الدليل الخاص بالملف المصدر، مع إضافة لاحقة اللغة إلى اسم الملف (مثل `about.fr.md`):

```
my-hugo-site/
├── content/
│   └── en/
│       ├── _index.md
│       ├── _index.fr.md           ← champollion generates
│       ├── _index.ja.md           ← champollion generates
│       ├── about.md
│       ├── about.fr.md            ← champollion generates
│       ├── about.ja.md            ← champollion generates
│       └── blog/
│           ├── first-post.md
│           ├── first-post.fr.md   ← champollion generates
│           └── first-post.ja.md   ← champollion generates
├── i18n/
│   ├── en.json
│   ├── fr.json                    ← champollion generates
│   └── ja.json                    ← champollion generates
└── hugo.toml
```

:::note[أوضاع التدويل (i18n) في Hugo]
يدعم Hugo استراتيجيتين للترجمة: **المعتمدة على اسم الملف** (`about.fr.md` بجوار `about.md`) و**المعتمدة على الدليل** (أشجار `content/fr/about.md` منفصلة). يستخدم Champollion الترجمة المعتمدة على اسم الملف لأن دالة `getTargetContentPath()` الخاصة به تُنشئ مسارات الهدف عن طريق إلحاق لاحقة اللغة باسم الملف المصدر. تأكد من تكوين `hugo.toml` الخاص بك للترجمة المعتمدة على اسم الملف عند استخدام champollion.
:::

## الخطوة 1: تكوين Hugo

```toml title="hugo.toml"
defaultContentLanguage = 'en'

[languages]
  [languages.en]
    languageName = 'English'
    weight = 1
  [languages.fr]
    languageName = 'Français'
    weight = 2
  [languages.ja]
    languageName = '日本語'
    weight = 3
```

## الخطوة 2: تكوين Champollion

يحتاج Champollion إلى تكوين شيئين: مسار ملف الترجمة (للسلاسل النصية بصيغة JSON) ودليل المحتوى (لـ Markdown).

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "method": "llm" },
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" }
  },
  "languages": {
    "fr": { "name": "French", "register": "Formal (vous-form)" },
    "ja": { "name": "Japanese", "register": "Polite/formal" }
  }
}
```

## الخطوة 3: إنشاء المحتوى المصدر

### ترجمات السلاسل النصية (i18n/)

```json title="i18n/en.json"
{
  "nav": {
    "home": "Home",
    "about": "About",
    "blog": "Blog",
    "contact": "Contact"
  },
  "footer": {
    "copyright": "© 2026 My Company. All rights reserved.",
    "privacy": "Privacy Policy"
  }
}
```

### محتوى Markdown (content/en/)

```markdown title="content/en/about.md"
---
title: "About Us"
description: "Learn more about our team and mission"
date: 2026-01-15
---

We build software that helps businesses communicate across languages.

Our platform supports **real-time translation** for over 30 languages,
with specialized support for low-resource languages.

## Our Mission

Language should never be a barrier to understanding.

## The Team

{{< team-grid >}}
```

## الخطوة 4: تشغيل المزامنة

```bash
npx champollion sync
```

يعالج Champollion كلا النوعين:

1. **ملفات السلاسل النصية** (`i18n/en.json` → `i18n/fr.json`، `i18n/ja.json`)
2. **ملفات المحتوى** (`content/en/about.md` → `content/en/about.fr.md`، `content/en/about.ja.md`)

### تفاصيل ترجمة المحتوى

عند ترجمة Markdown، يقوم champollion تلقائياً بما يلي:

- **حماية** (Shields) كتل التعليمات البرمجية، والرموز القصيرة (shortcodes) (`{{< ... >}}`)، والتعليمات البرمجية المضمنة، وHTML
- **ترجمة** حقول الترويسة (front matter) (`title`، `description`، `summary`)
- **الاحتفاظ** بجميع حقول الترويسة الأخرى (`date`، `draft`، `weight`، `tags`)
- **استعادة** الكتل المحمية بعد الترجمة

يمر الرمز القصير (shortcode) الخاص بـ Hugo `{{< team-grid >}}` دون ترجمة.

## الخطوة 5: التحقق

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

انتقل إلى `localhost:1313/fr/` و `localhost:1313/ja/` لمراجعة المحتوى المترجم.

## الخطوة 6: مبدل اللغات في Hugo

أضف مبدل لغات إلى تخطيط (layout) Hugo الخاص بك:

```html title="layouts/partials/language-switcher.html"
<nav class="language-switcher">
  {{ range $.Site.Home.AllTranslations }}
    <a href="{{ .Permalink }}"
       {{ if eq .Lang $.Site.Language.Lang }}class="active"{{ end }}>
      {{ .Language.LanguageName }}
    </a>
  {{ end }}
</nav>
```

## الحفاظ على مزامنة المحتوى

عند تحديث المحتوى الإنجليزي، قم بتشغيل المزامنة مرة أخرى. يعيد Champollion ترجمة الملفات التي تغيرت فقط:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

يتتبع ملف القفل (lock file) تجزئات المحتوى (hashes) لكل ملف، لذلك لا تتم إعادة ترجمة الصفحات المستقرة.

## انظر أيضًا

- **[دليل ترجمة المحتوى](/docs/guides/content-translation)** — تعمق في الحماية (shielding)، والترويسة (front matter)، والحالات الاستثنائية
- **[تكامل أطر العمل](/docs/guides/framework-integration)** — إعدادات Next.js و React
- **[دليل CI/CD](/docs/guides/ci-cd)** — أتمتة عمليات المزامنة عند الدفع (push) إلى `content/en/`
- **[طرق الترجمة](/docs/guides/translation-methods)** — مقارنة بين استراتيجيات الترجمة باستخدام النماذج اللغوية الكبيرة (LLM)، وذاكرة الترجمة (TM)، والترجمة الهجينة
- **[اللغات المدعومة](/docs/reference/supported-languages)** — قائمة كاملة باللغات ورموز اللغات المدعومة
