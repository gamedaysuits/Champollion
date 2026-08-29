---
sidebar_position: 2
title: "빠른 시작"
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

# 빠른 시작

60초 안에 첫 번째 로케일 파일을 번역해 보세요.

## 1. 로케일 파일 설정하기

소스 로케일 파일을 생성해 주세요. Champollion은 JSON, TOML, YAML 등을 지원해요 — 전체 목록은 [CLI 레퍼런스](/docs/reference/cli)를 확인해 주세요:

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

## 2. API 키 설정하기

제공업체를 선택하고 키를 설정하세요:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

[aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 무료 Gemini 키를 받을 수 있어요. OpenRouter 키는 [openrouter.ai](https://openrouter.ai)에서 받을 수 있어요.

## 3. Sync 실행하기

```bash
npx champollion sync
```

:::tip[Gemini를 사용하시나요?]
옵션 B(Gemini)를 선택하셨다면 `--method gemini`을 추가하세요:
```bash
npx champollion sync --method gemini
```
:::

Champollion은 다음을 수행해요:
1. `locales/en.json`를 소스로 자동 감지
2. 대상 언어를 찾기(또는 입력 요청)
3. 모든 키 번역
4. `locales/fr.json`, `locales/ja.json` 등을 작성
5. 번역된 내용을 추적하기 위한 `.champollion.lock` 생성

## 4. 결과 확인하기

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

## 그다음에는 어떻게 되나요?

소스 문자열을 변경하면 champollion이 SHA-256 해시 추적을 통해 변경 사항을 감지하고, 다음 sync에서 해당 키만 다시 번역해요:

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

변경되지 않은 키(`hero.subtitle`)는 champollion의 **Translation Memory** 캐시에서 제공돼요 — API 호출도, 비용도 없어요. 이 캐시는 모든 sync 중에 자동으로 생성되며 `.champollion/tm.json`에 저장돼요.

## 선택 사항: 설정 파일 생성하기

더 세밀한 제어를 원한다면 설정 파일을 생성하세요:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

가이드 마법사는 각 언어의 **register presets**를 단계별로 안내해요 — 해당 언어의 언어 체계에 맞춰 사전 구축된 어조/격식 지침이에요. 프랑스어에는 T-V 프리셋(vouvoiement vs tutoiement)이, 한국어에는 화계(해요체 vs 합쇼체 vs 해체)가, 일본어에는 경어(です/ます vs 丁寧語) 옵션이 있어요.

또는 프리셋 키를 사용해 설정을 수동으로 생성할 수도 있어요:

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

각 언어에 사용 가능한 프리셋을 둘러보려면 `npx champollion init`를 실행하세요.

## 선택 사항: Watch 모드

소스 파일이 변경되면 자동으로 번역해요:

```bash
npx champollion watch
```

## 다음 단계

- **[Configuration](/docs/getting-started/configuration)** — 전체 설정 레퍼런스
- **[Translation Methods](/docs/guides/translation-methods)** — 언어 쌍별로 적절한 방법 선택하기
- **[Translation Memory](/docs/concepts/translation-memory)** — 캐싱이 재실행 비용을 절약하는 방식
- **[Working with Professional Translators](/docs/guides/professional-translators)** — 사람의 검토를 위한 XLIFF 내보내기
- **[Framework Integration](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — 파이프라인에서 번역 자동화하기
- **[Troubleshooting](/docs/guides/troubleshooting)** — 자주 발생하는 문제와 해결 방법
