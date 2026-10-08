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

이 CLI는 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)에 따라 비상업적 용도로 무료로 사용할 수 있어요. 상업적 사용은 해당 라이선스의 적용 대상이 아니에요. 학교, 공립 병원이나 클리닉, 자선 단체, 개인 프로젝트는 포함되지만, 상점의 쇼핑몰 웹사이트(storefront)는 포함되지 않아요. 자세한 내용은 [이 도구를 사용할 수 있는 대상](/docs/getting-started/who-may-use-this)에서 전체 내용을 확인할 수 있어요.

## 1. 로케일 파일 설정하기

소스 로케일 파일을 만들어 보세요. Champollion은 JSON, TOML, YAML 등을 지원해요. 전체 목록은 [CLI 레퍼런스](/docs/reference/cli)를 참고해 주세요:

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

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

[aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 무료 Gemini 키를 발급받으세요. [openrouter.ai](https://openrouter.ai)에서 OpenRouter 키를 발급받으세요. 옵션 C의 경우 프로젝트를 설정할 때 모델을 지정해 주세요: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (또는 `sync --method local --model llama3.1` 실행).

## 3. Sync 실행하기

```bash
npx champollion sync
```

:::note[직접 입력하는 명령어인가요, 스크립트로 실행하는 명령어인가요?]
이 페이지에 나오는 명령어는 사용자가 직접 입력하는 명령어예요. `npx champollion`은 프로젝트에 설치된 복사본을 실행하거나, 설치되어 있지 않다면 npx가 가져온 복사본을 실행해요(최초 실행 시에는 최신 릴리스, 이후에는 캐시된 복사본). 스크립트가 대신 실행하는 명령어(CI, `package.json` 스크립트, git 훅 등)는 새 릴리스로 인해 빌드에서 실행되는 내용이 바뀌지 않도록 `npx --yes champollion@0.5 sync`처럼 버전을 명시해야 해요(그리고 `--yes`을 사용하면 npx가 확인을 위해 멈추지 않아요). [CI 가이드](/docs/guides/ci-cd)와 [프레임워크 페이지](/docs/integrations/frameworks)에서도 이런 방식으로 버전을 고정하고 있어요.
:::

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

변경되지 않은 키(`hero.subtitle`)는 **건너뛰어요**: 번역이 이미 `locales/fr.json`에 있으므로 어디로도 전송되지 않으며 조회조차 하지 않아요. 즉, 호출도 없고 비용도 들지 않으며, 실행 시 "캐시에서 제공됨(served from the cache)" 수치에도 포함되지 않아요.

**번역 메모리**(Translation Memory, `.champollion/tm.json`, 동기화할 때마다 자동으로 빌드됨)는 대기열에 *올라간* 텍스트를 위한 것이에요. 이전 내용으로 다시 되돌린 문자열, 다른 파일에 있는 동일한 문장, 로케일 전체 재실행(`sync --redo all`) 등이 여기에 해당해요. 이러한 항목은 캐시에서 무료로 제공되며, 실행 결과 라인에 그 개수가 표시돼요(`… 0 key(s) sent to the model, 12 served from the cache (free)`). 캐시는 번역 방식, 레지스터, 코칭별로 언어 쌍과 그 폴백 각각에 대해 유지돼요. 방식을 전환하거나(예: `local` → `llm`), 코칭 파일의 텍스트(언어 쌍, 해당 언어, 폴백)를 변경한 후에는 아무것도 재사용되지 않으며 실행 시 그 이유가 표시돼요. 모델만 변경하는 경우에는 이전 번역을 재사용해요. 변경 사항이 있다고 해서 저절로 다시 번역되지는 않아요. `sync`에서 재실행 대상과 비용을 안내해 줘요.

## 선택 사항: 설정 파일 생성하기

더 세밀한 제어를 원한다면 설정 파일을 생성하세요:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` 및 `--model`는 번역 방식과 모델을 선택해요(`npx champollion init --help`에 방식 목록이 나와 있어요). init을 실행하면 설정에서 어떤 것을 사용하는지 출력해 줘요.

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
  "model": "google/gemini-3.8-flash"
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
