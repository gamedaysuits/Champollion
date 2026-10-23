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
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# 빠른 시작

60초 만에 첫 번째 로캘 파일을 번역해 보세요.

CLI는 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)에 따라 비영리 목적으로 무료로 사용할 수 있어요. 상업적 사용은 이 라이선스에 포함되지 않아요. 학교, 국공립 병원이나 의원, 자선 단체 또는 개인 프로젝트는 포함되지만, 상점 웹사이트는 포함되지 않아요. 자세한 내용은 [누가 사용할 수 있나요](/docs/getting-started/who-may-use-this)에서 확인할 수 있어요.

## 1. 로캘 파일 준비하기

원본 로캘 파일을 만드세요. Champollion은 JSON, TOML, YAML 등을 지원해요. 전체 목록은 [CLI 레퍼런스](/docs/reference/cli)를 참고하세요:

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

제공자를 선택하고 키를 설정하세요:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

[aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 무료 Gemini 키를 받을 수 있어요. OpenRouter 키는 [openrouter.ai](https://openrouter.ai)에서 받으세요. 옵션 C의 경우 프로젝트를 설정할 때 모델 이름을 지정하세요: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (또는 `sync --method local --model llama3.1` 실행).

## 3. 동기화 실행하기

```bash
npx champollion sync
```

:::note[직접 입력하시나요, 아니면 스크립트로 실행하시나요?]
이 페이지의 명령어는 직접 입력하는 형태예요. `npx champollion`은 프로젝트에 설치된 복사본을 실행하거나, npx가 가져오는 버전(처음에는 최신 릴리스, 이후에는 해당 캐시본)을 실행해요. CI, `package.json` 스크립트, git 훅처럼 스크립트가 대신 실행하는 명령어는 버전을 지정해야 해요(`npx --yes champollion@0.6 sync`). 그래야 새 릴리스가 나와도 빌드가 실행하는 버전이 바뀌지 않아요(`--yes`는 npx가 확인을 위해 멈추지 않도록 해 줘요). [CI 가이드](/docs/guides/ci-cd)와 [프레임워크 페이지](/docs/integrations/frameworks)에서도 이 방식으로 버전을 고정하고 있어요.
:::

:::tip[Gemini를 사용하시나요?]
옵션 B(Gemini)를 선택했다면 `--method gemini`를 추가하세요:
```bash
npx champollion sync --method gemini
```
:::

Champollion이 다음 작업을 수행해요:
1. `locales/en.json`를 원본으로 자동 감지
2. 대상 언어 찾기(또는 확인 메시지 표시)
3. 모든 키 번역
4. `locales/fr.json`, `locales/ja.json` 등을 작성
5. 번역된 항목을 추적하기 위해 `.champollion.lock` 생성

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

## 다음에는 어떻게 되나요?

원본 문자열을 변경하면 Champollion이 SHA-256 해시 추적으로 변경 사항을 감지하여 다음 동기화 때 해당 키만 다시 번역해요:

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

변경되지 않은 키(`hero.subtitle`)는 **건너뜁니다**: 번역이 이미 `locales/fr.json`에 있으므로 어디로도 전송되지 않고 조회조차 하지 않아요. API 호출도, 비용도 발생하지 않으며 실행 결과의 "캐시에서 제공됨" 수치에도 포함되지 않아요.

**번역 메모리**(`.champollion/tm.json`, 매 동기화마다 자동 생성됨)는 대기열에 *올라간* 텍스트를 위한 것이에요. 원래대로 되돌린 문자열, 다른 파일에 있는 동일한 문장, 전체 로캘 재작업(`sync --redo all`) 등이 여기에 해당해요. 이러한 항목은 캐시에서 무료로 제공되며, 실행 로그에 그 개수가 표시돼요(`… 0 key(s) sent to the model, 12 served from the cache (free)`). 캐시는 번역 방식, 말투(register), 코칭별로 각각 유지돼요(해당 언어 쌍과 대체 언어 쌍 각각 적용). 번역 방식을 전환하거나(예: `local` → `llm`), 코칭 파일의 텍스트를 변경한 후에는(언어 쌍, 해당 언어 또는 대체 언어에서) 아무것도 재사용되지 않으며 실행 시 그 이유가 표시돼요. 모델만 변경하는 경우에는 이전 번역을 재사용해요. 설정 변경 자체만으로는 아무것도 다시 번역하지 않아요. `sync`로 다시 번역할 항목과 비용을 확인하세요.

## 선택 사항: 설정 파일 만들기

더 세부적으로 제어하려면 설정 파일을 생성하세요:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method`와 `--model`는 번역 방식과 모델을 선택해요(`npx champollion init --help`는 지원하는 방식 목록을 보여줘요). init은 설정에서 어떤 것을 사용하는지 출력해요.

마법사 안내를 따라 각 언어의 **말투 프리셋**(register presets)을 설정할 수 있어요. 언어 체계에 맞게 사전 구축된 어조/격식 지침이에요. 프랑스어에는 T-V 프리셋(vouvoiement vs tutoiement), 한국어에는 높임법 체계(해요체 vs 합쇼체 vs 해체), 일본어에는 경어 옵션(です/ます vs 丁寧語)이 있어요.

또는 프리셋 키를 사용해 설정을 직접 만들 수도 있어요:

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

각 언어별로 사용할 수 있는 프리셋을 둘러보려면 `npx champollion init`를 실행하세요.

## 선택 사항: 감시 모드

원본 파일이 변경될 때 자동으로 번역해요:

```bash
npx champollion watch
```

## 다음 단계

- **[설정](/docs/getting-started/configuration)** — 전체 설정 레퍼런스
- **[번역 방식](/docs/guides/translation-methods)** — 언어 쌍별 적절한 방식 선택
- **[번역 메모리](/docs/concepts/translation-memory)** — 재실행 시 캐시로 비용을 절약하는 방법
- **[전문 번역가와의 협업](/docs/guides/professional-translators)** — 전문가 검토를 위한 XLIFF 내보내기
- **[프레임워크 연동](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — 파이프라인에서 번역 자동화하기
- **[문제 해결](/docs/guides/troubleshooting)** — 자주 묻는 질문과 해결 방법
