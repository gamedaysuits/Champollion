---
sidebar_position: 3
title: "موقع Hugo متعدد اللغات"
description: "دليل إرشادي: إعداد موقع Hugo متعدد اللغات بالكامل مع تولي champollion ترجمة كل من ملفات السلاسل النصية ومحتوى Markdown."
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

# دليل عملي: موقع Hugo متعدد اللغات

إعداد نظام Hugo لتعدد اللغات مع تولي Champollion ترجمة كلٍّ من ملفات نصوص JSON ومحتوى Markdown. يغطي هذا الدليل سير العمل بأكمله، بدءًا من إعداد المشروع وحتى النشر في بيئة الإنتاج.

**ما ستنشئه:** موقع Hugo باللغات الإنجليزية والفرنسية واليابانية — ترجمات النصوص عبر ملفات اللغات (locale files)، وترجمات المحتوى عبر معالجة Markdown.

---

## بنية المشروع

يستخدم Champollion نمط الترجمة **المستند إلى اسم الملف (filename-based)** في Hugo. يتم وضع الملفات المترجمة في الدليل نفسه الموجود فيه الملف المصدري، مع إضافة لاحقة اللغة إلى اسم الملف (مثل `about.fr.md`):

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

:::note[أنماط التدويل في Hugo]
يدعم Hugo استراتيجيتين للترجمة: **المستندة إلى اسم الملف (filename-based)** (`about.fr.md` بجوار `about.md`) و**المستندة إلى الدليل (directory-based)** (أشجار `content/fr/about.md` منفصلة). يستخدم Champollion الترجمة المستندة إلى اسم الملف لأن دالة `getTargetContentPath()` الخاصة به تولّد مسارات الهدف عن طريق إلحاق لاحقة اللغة باسم الملف المصدري. تأكد من تهيئة `hugo.toml` الخاص بك للترجمة المستندة إلى اسم الملف عند استخدام Champollion.
:::

## الخطوة 1: تهيئة Hugo

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

## الخطوة 2: تهيئة Champollion

يحتاج Champollion إلى تهيئة أمرين: مسار ملف اللغات (لنصوص JSON) ودليل المحتوى (لمحتوى Markdown).

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "model": "google/gemini-3.8-flash",
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

## الخطوة 3: إنشاء المحتوى المصدري

### ترجمات النصوص (i18n/)

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

1. **ملفات النصوص** (`i18n/en.json` → `i18n/fr.json`، `i18n/ja.json`)
2. **ملفات المحتوى** (`content/en/about.md` → `content/en/about.fr.md`، `content/en/about.ja.md`)

### تفاصيل ترجمة المحتوى

عند ترجمة Markdown، يقوم Champollion تلقائيًا بما يلي:

- **حماية** كتل الأكواد البرمجية، والرموز القصيرة (`{{< ... >}}`)، والأكواد المضمنة، وHTML
- **ترجمة** حقول front matter (`title`، و`description`، و`summary`)
- **الحفاظ على** جميع حقول front matter الأخرى (`date`، و`draft`، و`weight`، و`tags`)
- **استعادة** الكتل المحمية بعد الترجمة

يمر الرمز القصير `{{< team-grid >}}` الخاص بـ Hugo دون ترجمة.

## الخطوة 5: التحقق

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

انتقل إلى `localhost:1313/fr/` و`localhost:1313/ja/` لمراجعة المحتوى المترجم.

## الخطوة 6: أداة تبديل اللغة في Hugo

أضف أداة تبديل اللغة إلى قالب (layout) Hugo الخاص بك:

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

عند تحديث المحتوى الإنجليزي، شغّل المزامنة مرة أخرى. لا يعيد Champollion ترجمة سوى الملفات التي طرأت عليها تغييرات:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

يتتبع ملف القفل (lock file) قيم تجزئة المحتوى (hashes) لكل ملف، وبذلك لا تتم إعادة ترجمة الصفحات الثابتة.

## انظر أيضًا

- **[دليل ترجمة المحتوى](/docs/guides/content-translation)** — تعمّق في آليات الحماية وحقول front matter والحالات الخاصة
- **[التكامل مع أطر العمل](/docs/guides/framework-integration)** — إعدادات Next.js وReact
- **[دليل CI/CD](/docs/guides/ci-cd)** — أتمتة المزامنة عند الدفع (push) إلى `content/en/`
- **[طرق الترجمة](/docs/guides/translation-methods)** — المقارنة بين استراتيجيات الترجمة باستخدام نماذج اللغة الكبيرة (LLM)، وذاكرة الترجمة (TM)، والنهج الهجين
- **[اللغات المدعومة](/docs/reference/supported-languages)** — القائمة الكاملة لإعدادات اللغة والرموز المدعومة
