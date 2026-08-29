---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD 통합

빌드 파이프라인에서 번역을 자동화하세요.

## GitHub Actions: Push 시 동기화

기존 빌드 파이프라인에 번역 동기화를 추가하세요:

```yaml title=".github/workflows/deploy.yml"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - run: npm run build
```

## GitHub Actions: 예약 동기화

번역을 예약 실행하고 자동으로 커밋하세요:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          git add i18n/ content/ locales/ messages/
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git push
```

## Google Translate 방식

OpenRouter 대신 내장된 Google Translate 방식을 사용하는 경우:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## 직접 LLM 제공자

`openai`, `anthropic`, 또는 `gemini` 방식을 직접 사용하는 경우:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx champollion sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx champollion sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx champollion sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx champollion sync --method deepl
```

## 원격 번역 API

원격 번역 엔드포인트(예: 호스팅된 번역 서비스)를 사용하는 경우:

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## 3계층 CI 파이프라인

최대 i18n 커버리지를 위해 세 가지 도구 모두로 파이프라인을 게이트하세요:

```yaml
jobs:
  i18n:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # 1. Catch hardcoded strings before they ship
      - run: npx champollion lint

      # 2. Translate missing keys
      - run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      # 3. Fail if any locale is incomplete
      - run: npx champollion audit
```

| 계층 | 명령어 | 시점 | 목적 |
|-------|---------|------|---------|
| **Lint** | `lint` | 커밋 전 | 하드코딩된 문자열이 포함된 커밋 차단 |
| **Sync** | `sync` | 커밋 후 / CI | 누락되거나 변경된 키 번역 |
| **Audit** | `audit` | 빌드 단계 | 로케일이 불완전하면 배포 실패 처리 |

:::tip[CI에서의 Translation Memory]
CI 러너에 영구 워크스페이스가 있거나 `.champollion/`를 캐싱하는 경우, Translation Memory가 자동으로 작동해요 — 이후 동기화에서는 소스 텍스트가 실제로 변경된 키만 번역해요. 일시적인 러너의 경우, 실행 간에 `.champollion/tm.json`를 캐싱하는 것을 고려해 보세요:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## 함께 보기

- [CLI 레퍼런스](/docs/reference/cli) — 전체 명령어 레퍼런스
- [동기화 작동 방식](/docs/concepts/how-sync-works) — 증분 동기화 이해하기
- [Translation Memory](/docs/concepts/translation-memory) — 캐싱 및 비용 절감
- [번역 방식](/docs/guides/translation-methods) — 쌍별 방식 선택
- [품질 게이트](/docs/concepts/quality-gate) — 번역 실패 시 발생하는 일
- [구성](/docs/getting-started/configuration) — 구성 레퍼런스
