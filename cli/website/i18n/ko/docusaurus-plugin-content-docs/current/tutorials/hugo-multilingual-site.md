---
sidebar_position: 3
title: "Hugo 다국어 사이트"
description: "쿡북: champollion이 문자열 파일과 Markdown 콘텐츠 번역을 모두 처리하는 완전한 Hugo 다국어 사이트를 설정해요."
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

# Cookbook: Hugo 다국어 사이트

Hugo의 다국어 시스템을 설정하고, champollion이 JSON 문자열 파일과 Markdown 콘텐츠 번역을 모두 처리하도록 구성해요. 이 가이드는 프로젝트 설정부터 프로덕션 배포까지 전체 워크플로우를 다뤄요.

**무엇을 만들게 되나요:** 영어, 프랑스어, 일본어를 지원하는 Hugo 사이트로, 문자열 번역은 locale 파일을 통해, 콘텐츠 번역은 Markdown 처리를 통해 이루어져요.

---

## 프로젝트 구조

Champollion은 Hugo의 **파일명 기반** 번역 모드를 사용해요. 번역된 파일은 소스 파일과 동일한 디렉터리에 배치되며, 파일명에 언어 접미사가 추가돼요(예: `about.fr.md`):

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

:::note[Hugo i18n 모드]
Hugo는 두 가지 번역 전략을 지원해요: **파일명 기반**(`about.md` 옆에 있는 `about.fr.md`)과 **디렉터리 기반**(별도의 `content/fr/about.md` 트리). Champollion은 `getTargetContentPath()` 함수가 소스 파일명에 언어 접미사를 붙여 대상 경로를 생성하기 때문에 파일명 기반 번역을 사용해요. champollion을 사용할 때는 `hugo.toml`이 파일명 기반 번역으로 구성되어 있는지 확인하세요.
:::

## 1단계: Hugo 구성

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

## 2단계: Champollion 구성

Champollion은 두 가지 항목을 구성해야 해요: locale 파일 경로(JSON 문자열용)와 콘텐츠 디렉터리(Markdown용)예요.

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

## 3단계: 소스 콘텐츠 생성

### 문자열 번역 (i18n/)

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

### Markdown 콘텐츠 (content/en/)

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

## 4단계: 동기화 실행

```bash
npx champollion sync
```

Champollion은 두 가지 유형을 모두 처리해요:

1. **문자열 파일** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **콘텐츠 파일** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### 콘텐츠 번역 세부 사항

Markdown을 번역할 때 champollion은 자동으로 다음을 수행해요:

- 코드 블록, 숏코드(`{{< ... >}}`), 인라인 코드, HTML을 **보호**해요
- front matter 필드(`title`, `description`, `summary`)를 **번역**해요
- 그 외 모든 front matter 필드(`date`, `draft`, `weight`, `tags`)를 **보존**해요
- 번역 후 보호된 블록을 **복원**해요

Hugo 숏코드 `{{< team-grid >}}`는 번역되지 않고 그대로 통과돼요.

## 5단계: 검증

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

`localhost:1313/fr/`와 `localhost:1313/ja/`로 이동하여 번역된 콘텐츠를 확인하세요.

## 6단계: Hugo 언어 전환기

Hugo 레이아웃에 언어 전환기를 추가하세요:

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

## 콘텐츠를 동기화 상태로 유지하기

영어 콘텐츠를 업데이트하면 다시 sync를 실행하세요. Champollion은 변경된 파일만 다시 번역해요:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

lock 파일은 파일별로 콘텐츠 해시를 추적하므로, 변경되지 않은 페이지는 다시 번역되지 않아요.

## 함께 보기

- **[콘텐츠 번역 가이드](/docs/guides/content-translation)** — 보호, front matter, 엣지 케이스에 대한 심층 분석
- **[프레임워크 통합](/docs/guides/framework-integration)** — Next.js 및 React 설정
- **[CI/CD 가이드](/docs/guides/ci-cd)** — `content/en/`에 push할 때 동기화 자동화
- **[번역 방법](/docs/guides/translation-methods)** — LLM, TM, 하이브리드 번역 전략 비교
- **[지원 언어](/docs/reference/supported-languages)** — 지원되는 locale 및 언어 코드 전체 목록
