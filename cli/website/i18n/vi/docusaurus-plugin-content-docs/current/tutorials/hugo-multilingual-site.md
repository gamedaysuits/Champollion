---
sidebar_position: 3
title: "Trang web đa ngôn ngữ Hugo"
description: "Cookbook: thiết lập một trang web đa ngôn ngữ Hugo hoàn chỉnh với Champollion xử lý cả việc dịch tệp chuỗi và nội dung Markdown."
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

# Cookbook: Trang web đa ngôn ngữ Hugo

Thiết lập hệ thống đa ngôn ngữ của Hugo với Champollion xử lý cả tệp chuỗi JSON và dịch thuật nội dung Markdown. Hướng dẫn này bao gồm toàn bộ quy trình từ thiết lập dự án đến triển khai thực tế.

**Sản phẩm bạn sẽ xây dựng:** Một trang web Hugo với tiếng Anh, tiếng Pháp và tiếng Nhật — dịch thuật chuỗi qua các tệp ngôn ngữ (locale), dịch thuật nội dung qua xử lý Markdown.

---

## Cấu trúc dự án

Champollion sử dụng chế độ dịch thuật **dựa trên tên tệp** (filename-based) của Hugo. Các tệp đã dịch được đặt trong cùng thư mục với tệp nguồn, với hậu tố ngôn ngữ được thêm vào tên tệp (ví dụ: `about.fr.md`):

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

:::note[Các chế độ i18n của Hugo]
Hugo hỗ trợ hai chiến lược dịch thuật: **dựa trên tên tệp** (`about.fr.md` cạnh `about.md`) và **dựa trên thư mục** (các cây `content/fr/about.md` riêng biệt). Champollion sử dụng dịch thuật dựa trên tên tệp vì hàm `getTargetContentPath()` của nó tạo ra các đường dẫn đích bằng cách thêm hậu tố ngôn ngữ vào tên tệp nguồn. Hãy đảm bảo rằng `hugo.toml` của bạn được cấu hình cho dịch thuật dựa trên tên tệp khi sử dụng champollion.
:::

## Bước 1: Cấu hình Hugo

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

## Bước 2: Cấu hình Champollion

Champollion cần cấu hình hai thứ: đường dẫn tệp ngôn ngữ (cho các chuỗi JSON) và thư mục nội dung (cho Markdown).

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

## Bước 3: Tạo nội dung nguồn

### Dịch thuật chuỗi (i18n/)

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

### Nội dung Markdown (content/en/)

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

## Bước 4: Chạy đồng bộ hóa

```bash
npx champollion sync
```

Champollion xử lý cả hai loại:

1. **Các tệp chuỗi** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Các tệp nội dung** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Chi tiết dịch thuật nội dung

Khi dịch Markdown, Champollion tự động:

- **Bảo vệ (Shield)** các khối mã (code block), shortcode (`{{< ... >}}`), mã nội dòng (inline code) và HTML
- **Dịch** các trường front matter (`title`, `description`, `summary`)
- **Giữ nguyên** tất cả các trường front matter khác (`date`, `draft`, `weight`, `tags`)
- **Khôi phục** các khối đã được bảo vệ sau khi dịch

Shortcode Hugo `{{< team-grid >}}` được giữ nguyên không dịch.

## Bước 5: Xác minh

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Truy cập `localhost:1313/fr/` và `localhost:1313/ja/` để xem lại nội dung đã dịch.

## Bước 6: Trình chuyển đổi ngôn ngữ Hugo

Thêm trình chuyển đổi ngôn ngữ vào bố cục (layout) Hugo của bạn:

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

## Giữ nội dung luôn đồng bộ

Khi bạn cập nhật nội dung tiếng Anh, hãy chạy đồng bộ hóa lại. Champollion chỉ dịch lại các tệp đã thay đổi:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

Tệp khóa (lock file) theo dõi mã băm (hash) nội dung của từng tệp, vì vậy các trang không thay đổi sẽ không bị dịch lại.

## Xem thêm

- **[Hướng dẫn dịch thuật nội dung](/docs/guides/content-translation)** — Tìm hiểu sâu về tính năng bảo vệ (shielding), front matter và các trường hợp đặc biệt
- **[Tích hợp Framework](/docs/guides/framework-integration)** — Thiết lập cho Next.js và React
- **[Hướng dẫn CI/CD](/docs/guides/ci-cd)** — Tự động hóa đồng bộ hóa khi push lên `content/en/`
- **[Phương thức dịch thuật](/docs/guides/translation-methods)** — So sánh các chiến lược dịch thuật bằng LLM, TM và lai (hybrid)
- **[Ngôn ngữ được hỗ trợ](/docs/reference/supported-languages)** — Danh sách đầy đủ các mã ngôn ngữ và locale được hỗ trợ
