---
sidebar_position: 3
title: "Hugo Multilingual Site"
description: "Cookbook: ตั้งค่าเว็บไซต์ Hugo แบบหลายภาษาแบบครบวงจร โดยใช้ champollion จัดการทั้งการแปลไฟล์ string และเนื้อหา Markdown"
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

# Cookbook: Hugo Multilingual Site

ตั้งค่าระบบหลายภาษาของ Hugo โดยให้ champollion จัดการทั้งไฟล์ JSON string และการแปลเนื้อหา Markdown ครอบคลุมขั้นตอนการทำงานทั้งหมดตั้งแต่การตั้งค่าโปรเจกต์จนถึงการ deploy ใช้งานจริง

**สิ่งที่คุณจะสร้าง:** เว็บไซต์ Hugo ที่รองรับภาษาอังกฤษ ฝรั่งเศส และญี่ปุ่น — แปล string ผ่านไฟล์ locale และแปลเนื้อหาผ่านการประมวลผล Markdown

---

## โครงสร้างโปรเจกต์

Champollion ใช้โหมดการแปลแบบ **filename-based** ของ Hugo ไฟล์ที่แปลแล้วจะถูกวางไว้ในไดเรกทอรีเดียวกับไฟล์ต้นฉบับ โดยเพิ่ม language suffix ต่อท้ายชื่อไฟล์ (เช่น `about.fr.md`):

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

:::note[โหมด i18n ของ Hugo]
Hugo รองรับสองกลยุทธ์การแปล: **แบบอิงชื่อไฟล์** (`about.fr.md` ควบคู่กับ `about.md`) และ **แบบอิงไดเรกทอรี** (แยกโครงสร้าง `content/fr/about.md`) Champollion ใช้การแปลแบบอิงชื่อไฟล์ เนื่องจากฟังก์ชัน `getTargetContentPath()` จะสร้างพาธปลายทางโดยการต่อท้ายชื่อไฟล์ต้นฉบับด้วยส่วนต่อท้ายของภาษา โปรดตรวจสอบให้แน่ใจว่า `hugo.toml` ของคุณได้รับการกำหนดค่าสำหรับการแปลแบบอิงชื่อไฟล์เมื่อใช้งาน champollion
:::

## ขั้นตอนที่ 1: กำหนดค่า Hugo

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

## ขั้นตอนที่ 2: กำหนดค่า Champollion

Champollion ต้องการการกำหนดค่าสองอย่าง ได้แก่ path ของไฟล์ locale (สำหรับ JSON string) และไดเรกทอรีเนื้อหา (สำหรับ Markdown)

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

## ขั้นตอนที่ 3: สร้างเนื้อหาต้นฉบับ

### การแปล String (i18n/)

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

### เนื้อหา Markdown (content/en/)

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

## ขั้นตอนที่ 4: รันการ Sync

```bash
npx champollion sync
```

Champollion ประมวลผลทั้งสองประเภท:

1. **ไฟล์ String** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **ไฟล์เนื้อหา** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### รายละเอียดการแปลเนื้อหา

เมื่อแปล Markdown champollion จะดำเนินการโดยอัตโนมัติดังนี้:

- **ป้องกัน** code block, shortcode (`{{< ... >}}`), inline code และ HTML
- **แปล** ฟิลด์ front matter (`title`, `description`, `summary`)
- **คงไว้** ซึ่งฟิลด์ front matter อื่นๆ ทั้งหมด (`date`, `draft`, `weight`, `tags`)
- **คืนค่า** บล็อกที่ถูกป้องกันไว้หลังการแปล

Hugo shortcode `{{< team-grid >}}` จะผ่านไปโดยไม่ถูกแปล

## ขั้นตอนที่ 5: ตรวจสอบ

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

ไปที่ `localhost:1313/fr/` และ `localhost:1313/ja/` เพื่อตรวจสอบเนื้อหาที่แปลแล้ว

## ขั้นตอนที่ 6: Hugo Language Switcher

เพิ่ม language switcher ใน Hugo layout ของคุณ:

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

## การรักษาเนื้อหาให้ซิงค์กัน

เมื่อคุณอัปเดตเนื้อหาภาษาอังกฤษ ให้รัน sync อีกครั้ง Champollion จะแปลใหม่เฉพาะไฟล์ที่มีการเปลี่ยนแปลงเท่านั้น:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

lock file จะติดตาม content hash ของแต่ละไฟล์ ดังนั้นหน้าที่ไม่มีการเปลี่ยนแปลงจะไม่ถูกแปลซ้ำ

## ดูเพิ่มเติม

- **[คู่มือการแปลเนื้อหา](/docs/guides/content-translation)** — เจาะลึกเรื่อง shielding, front matter และกรณีพิเศษต่างๆ
- **[การผสานรวมกับ Framework](/docs/guides/framework-integration)** — การตั้งค่าสำหรับ Next.js และ React
- **[คู่มือ CI/CD](/docs/guides/ci-cd)** — ทำให้การ sync เป็นอัตโนมัติเมื่อ push ไปยัง `content/en/`
- **[วิธีการแปล](/docs/guides/translation-methods)** — เปรียบเทียบกลยุทธ์การแปลแบบ LLM, TM และ hybrid
- **[ภาษาที่รองรับ](/docs/reference/supported-languages)** — รายการ locale และ language code ที่รองรับทั้งหมด
