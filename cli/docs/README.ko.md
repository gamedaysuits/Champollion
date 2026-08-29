# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


단 하나의 명령어로 로케일 파일을 번역해 보세요:

```bash
npx champollion sync
```

Champollion은 로케일 파일, 파일 형식, 대상 언어를 자동으로 감지해요. 누락된 키를 번역하고, 이미 번역된 항목은 건너뛴 다음 결과를 저장합니다. 이게 전부예요.

> **Champollion의 일부** — 모든 언어에 걸쳐 신뢰할 수 있는 기계 번역을 위한 오픈소스 인프라입니다. 이 CLI는 테스트 세트를 구축하고, 누가 무엇을 번역할 수 있는지, 각 텍스트 종류에 대해 각 방법이 얼마나 우수한지, 그리고 여전히 부족한 부분이 어디인지 보여주는 지도를 만드는 더 큰 프로젝트의 배포 엔드포인트예요. 이 프로젝트는 두 가지 종류의 벤치마크에서 실행됩니다. 오픈 데이터 기반의 공개 벤치마크(광범위하고 저렴하며 모든 방법을 환영함)와 주권 벤치마크(커뮤니티가 생성, 소유, 통제하며 우리가 절대 볼 수 없는 비밀 테스트 세트)입니다. 인프라는 오픈소스이며 단일 주체에 의해 관리되지만, 커뮤니티 언어를 위한 테스트 세트와 방법론은 해당 커뮤니티의 소유입니다. 커뮤니티에서 무단으로 수집하지 않고 커뮤니티와 함께 구축하며, 그들이 주도권을 가집니다. 인간 번역이든 기계 번역이든 모든 방법을 환영해요. [champollion.dev/docs/network](https://champollion.dev/docs/network/)에서 네트워크를 탐색해 보세요.

## 직접 스크립트를 작성하지 않는 이유가 뭔가요?

영어 키를 반복하며 Google Translate를 호출하는 간단한 스크립트를 작성할 수도 있어요. 대부분의 개발자가 그렇게 하며, 약 30줄이면 충분합니다. 하지만 이 방식이 실패하는 이유는 다음과 같아요:

- **변경 사항 감지 불가.** 영어 문자열을 업데이트해도 번역은 영원히 과거 상태로 남게 됩니다. Champollion은 SHA-256 해시로 모든 원본 값을 추적하여 변경된 내용만 다시 번역해요.
- **일괄 처리(Batching) 부재.** 키 하나당 한 번의 API 호출을 하면 200개의 키는 200번의 왕복 요청을 의미해요. Champollion은 지능적으로 일괄 처리합니다(설정 가능, 기본값은 LLM의 경우 배치당 80개 키, Google의 경우 128개).
- **품질 검증(Quality gate) 부재.** 기계 번역은 환각(hallucination)을 일으키거나, 원문을 그대로 반환하거나, 잘못된 문자로 출력할 수 있어요. Champollion은 번역을 저장하기 전에 모든 번역을 검증하여 잘못된 문자, 길이 팽창, 원문 반복을 잡아내고 거부합니다.
- **형식 인식 불가.** JSON으로 하드코딩되어 있나요? Champollion은 JSON, TOML, YAML, Hugo Markdown(프런트매터 + 본문)을 자동 감지하여 처리해요.
- **안전성 부재.** Champollion은 프로토타입 오염, 조작된 로케일 코드를 통한 경로 탐색(path traversal), Markdown 번역 중 코드 블록 손상을 방지해요.

Champollion은 바로 그 스크립트의 프로덕션 버전이에요.

> [!NOTE]
> **Champollion이 번역하는 대상.** Champollion은 JSON 키-값 쌍, TOML/YAML 구성, Hugo Markdown 페이지, XLIFF 교환 문서 등 **로케일 파일과 구조화된 콘텐츠**를 대상으로 해요. UI 문자열, 문서, 공식 커뮤니케이션, 교육 자료와 같은 공식적인 서면 텍스트에 최적화되어 있습니다. 챗봇이나 실시간 음성 번역기, 범용 대화형 AI가 아니에요. 상용 API(Google Translate, DeepL)부터 [MT Eval Arena](https://champollion.dev/arena)를 통해 벤치마킹된 커뮤니티 개발 플러그인까지, 각 언어 쌍에 대해 번역 방법을 설정할 수 있어요.

## 빠른 시작

```bash
npm install --save-dev champollion
```

### API 키 발급받기

Champollion에는 번역 백엔드가 필요해요. 하나를 선택해 주세요:

| 제공자(Provider) | 키(Key) | 추천 대상 |
|----------|-----|----------|
| **OpenRouter** (권장) | `OPENROUTER_API_KEY` | 콘텐츠가 많은 프로젝트, Markdown, 200개 이상의 모델 |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o 직접 액세스 |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 직접 액세스 |
| **Gemini** | `GEMINI_API_KEY` | 무료 티어 사용 가능 |
| **DeepL** | `DEEPL_API_KEY` | 유럽어, 용어집(glossary) 지원 |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130개 이상의 언어, 대용량 처리 |

**가장 빠른 시작** (무료): [aistudio.google.com](https://aistudio.google.com/apikey)에서 가입하고 무료 Gemini 키를 받으세요:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200개 이상의 모델): [openrouter.ai](https://openrouter.ai)에서 가입한 후 다음을 실행하세요:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate** 대안 (키-값 쌍 전용 — Markdown 인식 불가):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **참고**: `GOOGLE_TRANSLATE_API_KEY`만 설정된 경우, champollion은 자동으로 Google Translate로 전환해요. 설정 변경은 필요하지 않습니다. SDK나 서비스 계정, `pip install` 없이 REST API를 직접 사용해요. 키만 있으면 됩니다.

이게 전부예요. 더 세밀하게 제어하려면 설정 파일을 생성하세요:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

각 언어에는 해당 언어 체계에 맞게 조정된 사전 구축된 어조/격식 지침인 **레지스터 프리셋(register presets)**이 제공돼요(프랑스어의 vouvoiement, 독일어의 Siezen, 일본어의 です/ます, 한국어의 해요체 등). 초기화 마법사를 통해 프리셋을 찾아보고 선택하거나, `--yes`를 전달하여 기본값을 수락할 수 있어요.

### 영어가 아닌 원본 언어

원본 언어가 영어가 아닌 경우:

```bash
champollion sync --source fr                      # CLI flag
```

또는 설정 파일에 영구적으로 지정할 수 있어요:

```json
{ "inputLocale": "fr" }
```

## 주요 기능

i18n 프레임워크(next-intl, i18next, Hugo)는 여러분이 관리하세요. 번역 파일은 Champollion이 처리할게요.

- **다중 형식 지원** — JSON, TOML, YAML, Hugo Markdown(프런트매터 + 본문), XLIFF 1.2
- **증분 번역** — 변경된 내용만 번역해요(SHA-256 해시 추적)
- **캐싱** — 번역 메모리(Translation Memory)에 이전 결과를 저장하여, 변경되지 않은 키에 대해 동기화를 다시 실행할 때는 비용이 발생하지 않아요
- **품질 검증** — 모든 번역을 검증하여 환각, 잘못된 문자 출력, 원문 반복, 길이 팽창을 잡아냅니다
- **콘텐츠 인식** — LLM 방식은 Markdown 번역 중 코드 블록, 숏코드, 링크, 보간(interpolation) 변수를 보호해요
- **파이프라인 도구** — CI 게이트를 위한 `lint`, `audit`, `integrity`, `seo`
- **XLIFF 상호 운용성** — CAT 도구(memoQ, SDL Trados, Phrase)에서 전문적인 검토를 위해 번역을 내보내고 다시 가져올 수 있어요
- **최소한의 종속성** — 런타임 종속성이 두 개뿐이에요(번들 언어 데이터베이스를 위한 better-sqlite3, CLDR 로케일 이름). 제공자 SDK는 없습니다. Node 20 이상이 필요해요

## Google Translate 그 이상

빠른 시작을 통해 LLM이나 Google Translate로 실행할 수 있어요. 하지만 Google Translate는 약 130개의 언어만 지원합니다. 세상에는 7,000개가 넘는 언어가 있어요.

**Champollion의 핵심 아이디어: 언어 쌍마다 번역 방법을 설정할 수 있다는 점이에요.** 프랑스어에는 Google Translate를, 평원 크리어(Plains Cree)에는 형태론적 코칭이 적용된 LLM을, 케추아어(Quechua)에는 커뮤니티 호스팅 API를 사용해 보세요. 이 모든 것을 동일한 프로젝트에서, 동일한 CLI로 처리할 수 있습니다.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

프롬프트 엔지니어링, 커뮤니티 사전, FST 파이프라인, 미세 조정된 모델 등을 통해 특정 언어 쌍을 번역하는 방법을 알아낼 수 있다면, champollion을 사용해 해당 방법을 플러그인으로 패키징하고 다른 모든 것과 함께 배포할 수 있어요.

> 기성 API가 존재하지 않는 평원 크리어(Plains Cree)로 프로덕션 웹사이트를 번역하는 과정에서 탄생했어요. 언어 쌍별 아키텍처는 이론적인 것이 아닙니다. 한 프로젝트에서 프랑스어를 위한 Google Translate와 원주민 언어를 위한 코칭된 FST 파이프라인이 동일한 동기화 명령어 내에서 나란히 실행되어야 했기 때문에 만들어졌어요.

함께 제공되는 [MT Eval Harness](https://github.com/gamedaysuits/Champollion)를 사용하면 번역 접근 방식을 벤치마킹하고 비교한 다음, 작동하는 방법을 champollion 플러그인으로 내보낼 수 있어요. 두 언어를 모두 구사하는 사람이라면 누구나 독점 플랫폼 없이도 번역 방법을 개발, 테스트, 공유할 수 있습니다.

### 방법 선택하기

Champollion은 10가지 번역 방법을 지원해요. 각 언어 쌍마다 다른 방법을 사용할 수 있습니다.

**LLM 제공자** — 품질이 가장 우수하며, Markdown을 인식하고 코칭과 호환돼요:

| 방법(Method) | 키(Key) | 기능 |
|--------|-----|-------------|
| `llm` (기본값) | `OPENROUTER_API_KEY` | OpenRouter를 통한 LLM — 200개 이상의 모델, 자동 라우팅 |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + 문법 규칙, 사전, 스타일 노트 |
| `openai` | `OPENAI_API_KEY` | OpenAI API 직접 호출 (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic API 직접 호출 (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini API 직접 호출 (Flash, Pro) — 무료 티어 사용 가능 |

**전통적인 기계 번역(MT)** — 속도, 비용, 대용량 키-값 쌍 처리에 가장 적합해요:

| 방법(Method) | 키(Key) | 기능 |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130개 이상의 언어) |
| `deepl` | `DEEPL_API_KEY` | 용어집을 지원하는 DeepL API (30개 이상의 언어) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100개 이상의 언어) |
| `libretranslate` | *(셀프 호스팅)* | 셀프 호스팅 LibreTranslate (AGPL, 무료) |

**인프라** — 맞춤형 또는 커뮤니티 호스팅 엔드포인트용:

| 방법(Method) | 키(Key) | 기능 |
|--------|-----|-------------|
| `api` | *(제공자별)* | 모든 REST 엔드포인트를 위한 경량 HTTP 클라이언트 |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **참고**: 전통적인 기계 번역 방식(Google Translate, DeepL, Microsoft Translator, LibreTranslate)은 키-값 쌍을 잘 처리하지만 Markdown 콘텐츠를 안전하게 번역할 수는 없어요. 콘텐츠가 많은 프로젝트의 경우 코드 블록, 숏코드, 보간 변수를 명시적으로 보호하는 LLM 방식을 권장합니다.

## 플러그인

플러그인은 특정 언어 쌍을 위해 미리 패키징된 번역 레시피예요. 코드가 아닌 JSON 매니페스트로, champollion에게 어떤 방법을 어떤 설정으로 사용할지, 그리고 어떤 품질로 벤치마킹되었는지 알려줍니다.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

매니페스트 형식은 [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md)를 참조하세요.

## 명령어

| 명령어(Command) | 목적(Purpose) |
|---------|---------|
| `init` | 대화형 설정 마법사 (빠른 기본값 설정을 원하면 `--yes`) |
| `sync` | 모든 로케일 파일 번역 및 동기화 |
| `watch` | 파일 변경 시 자동 동기화 |
| `audit` | 불완전한 로케일 플래그 지정 (CI 게이트) |
| `card` | 언어 카드 예쁘게 출력 (원시 데이터는 `card <code>`, `--json`) |
| `register-corpus` | 평가 말뭉치 등록: 라이선스 + 노출 계층(로컬 전용/비공개/공개/봉인) 선택 |
| `submit` | 인덱스 항목 제안 (검토 필요) — 미리 채워진 GitHub 이슈 출력 |
| `lint` | 소스 코드에서 하드코딩된 문자열 찾기 |
| `status` | 쌍 구성, 방법, 레지스터, 품질 계층 표시 |
| `provenance` | 번역 리소스 라이선스 감사 |
| `wrap` | 하드코딩된 문자열을 `t()` 호출로 자동 래핑 (실행 취소 지원) |
| `seo` | hreflang, sitemap.xml 또는 JSON-LD 스키마 생성 |
| `integrity` | 자리 표시자 손상, 인코딩, ICU 복수형 완전성 확인 |
| `plugin` | 방법 플러그인 설치, 제거 또는 목록 표시 |
| `fonts` | PUA 스크립트 변환기용 웹 폰트 다운로드 |
| `tm` | 번역 메모리 캐시 관리 (통계, 지우기, 로케일별) |
| `xliff` | 전문 번역가 검토를 위한 XLIFF 1.2 내보내기/가져오기 |
| `models` | 제공자의 사용 가능한 모델 목록 표시 (`--method gemini`) |
| `verify` | 작성된 로케일 파일을 다시 읽고 번역이 존재하며 올바른지 확인 (CI 게이트) |
| `leaderboard` | 기계 번역(MT) 리더보드 표시 (`--pair`, `--sort`, `--install N`) |
| `doctor` | 시스템 상태 확인: 카드, 구성, 방법, 변환기 |

명령어에 대한 자세한 도움말을 보려면 `champollion <command> --help`를 실행하세요.

전체 참조: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Pre-commit 게이트

`champollion lint`는 커밋 게이트로 만들어졌어요. 사용자에게 노출되는 하드코딩된 문자열을 발견하면 `1`으로 종료하고, 깨끗한 상태면 `0`로 종료합니다(`--warn-only`는 차단하지 않고 보고만 해요). 프로젝트의 추적되는 훅(hooks) 디렉터리에 연결해 보세요:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

또는 소스 파일이 스테이징될 때만 실행되도록 [lint-staged](https://github.com/lint-staged/lint-staged)에서 트리거할 수도 있어요:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

`champollion sync`는 pre-commit에 포함하지 마세요. 네트워크 API 호출을 하기 때문에 기껏해야 속도가 느려지고, 최악의 경우 오프라인 상태에서 커밋을 차단할 수 있어요. 대신 CI나 pre-push 훅에서 실행하고, `champollion audit` / `champollion verify`를 게이트로 사용하세요.

## 구성(Configuration)

`champollion.config.json` 파일을 생성하거나 `champollion init`를 실행하세요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| 옵션(Option) | 기본값(Default) | 설명(Description) |
|--------|---------|-------------|
| `inputLocale` | `"en"` | 원본 언어 코드 |
| `localesDir` | `"./locales"` | 로케일 파일 경로 |
| `contentDir` | `null` | Hugo 콘텐츠 디렉터리 (Markdown 번역 활성화) |
| `format` | `"auto"` | 파일 형식: `json`, `toml`, `yaml` 또는 `auto` |
| `model` | `"google/gemini-3.5-flash"` | 기본 모델 (OpenRouter 슬러그). 직접 제공자는 런타임에 자체 기본값을 확인해요. 사용 가능한 모델을 찾으려면 `champollion models --method gemini`를 실행하세요. |
| `defaultMethod` | `"llm"` | 기본 번역 방법 (`--method` 플래그로 재정의 가능) |
| `batchSize` | `80` | 번역 배치당 키 개수 |
| `pairs` | `{}` | 쌍별 방법, 모델, 품질 재정의 |

**언어별 재정의**: 각 언어에는 [언어 카드(Language Card)](../website/docs/reference/language-card-spec.md)가 있어요. 레지스터 프리셋, 격식 체계, 타이포그래피 규칙, 방법 지원 플래그가 포함된 50개의 엄선된 카드 중 하나입니다. 카드는 대규모 성능을 위해 [2계층 아키텍처](../website/docs/concepts/architecture.md)(런타임 + 참조)를 사용해요. `node scripts/generate-language-card.mjs <code>`를 사용하여 새 카드의 스캐폴딩을 생성할 수 있습니다. 프리셋 키를 약어로 사용하거나 사용자 지정 레지스터 텍스트를 작성해 보세요:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**무설정(Zero-config) 모드**: 설정 파일이 없나요? Champollion이 프로젝트에서 로케일 파일, 형식, 대상 언어를 자동으로 감지해요.

언어 값은 프리셋 키(예: `"casual-tu"`), 사용자 지정 레지스터 텍스트 또는 객체(전체 제어)가 될 수 있어요. `pairs`의 쌍 수준 재정의가 언어 수준 설정보다 우선합니다. 각 언어에 사용 가능한 프리셋을 찾아보려면 `npx champollion init`를 실행하세요.

프레임워크별 설정 세부 정보는 [CLI 참조](../website/docs/reference/cli.md)를 확인하세요.

## CLI 출력

`sync`를 실행하면 champollion이 진행 상황을 정확히 보여줘요:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

각 배치가 완료될 때마다 진행률 표시줄이 제자리에서 업데이트돼요(업데이트당 약 80개 키). 프레임워크 감지는 `contentDir`가 설정된 경우 `Hugo`를 표시합니다. 형식 감지는 형식이 어떻게 확인되었는지 명확히 하기 위해 `(auto)`와 `(config)`를 구분해요.

**출력 모드**: `--quiet`는 정보성 출력을 억제해요(오류 및 경고만 표시). `--json`는 CI/CD 파이프라인을 위해 기계가 읽을 수 있는 NDJSON을 출력합니다.

## 보안 및 안정성 강화(Hardening)

- **지수 백오프(Exponential backoff)** — 429/5xx 오류 발생 시 지터(jitter)와 함께 3회 재시도해요
- **30초 요청 시간 초과** — AbortController가 무한 대기를 방지합니다
- **응답 검증** — 번역을 위해 전송된 키만 수락해요
- **품질 검증(Quality gate)** — 환각 루프, 잘못된 문자 출력, 길이 팽창, 원문 반복을 잡아냅니다
- **재시도 캐스케이드(Retry cascade)** — JSON 파싱 실패 시 배치 → 절반 배치 → 개별 키 순으로 재시도해요(`maxRetries`를 통해 예산 제한)
- **번역 메모리(Translation Memory)** — `.champollion/tm.json`는 원문 + 로케일 + 방법을 키로 사용하여 번역을 캐시해요. 변경되지 않은 키는 후속 동기화 시 캐시에서 제공되어 불필요한 API 호출을 없앱니다
- **프롬프트 캐싱** — 시스템/사용자 메시지 분리를 통해 제공자 수준의 캐싱을 활성화하여 배치 전반에 걸쳐 토큰 비용을 줄여요
- **용어 적용(Terminology enforcement)** — LLM이 응답한 후 코칭된 번역이 사전 용어와 일치하는지 확인합니다
- **프로토타입 오염 방지** — `__proto__`, `constructor`, `prototype`를 차단해요
- **경로 격리(Path containment)** — 파일 쓰기가 구성된 디렉터리 내에 머물도록 검증합니다
- **블록 보호** — 콘텐츠 번역 중 코드 블록, 숏코드, HTML을 보호해요
- **Fail-loud 아키텍처** — 번역 실패 시 조치 가능한 오류 메시지와 함께 항상 예외를 발생시키며, 절대 쓰레기 값을 조용히 저장하지 않아요
- **동기화 후 검증** — `verify` 명령어는 작성된 파일을 다시 읽고 번역이 존재하며, 올바른 문자이고, 자리 표시자가 손상되지 않았는지 확인합니다
- **부분 성공** — 하나의 배치가 실패해도 나머지 배치는 차단되지 않아요

## 테스트

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**최소한의 종속성** — 위 내용을 참조하세요.

## 라이선스

Apache-2.0. Champollion CLI는 오픈소스이며, [Apache License, Version 2.0](../LICENSE)의 조건에 따라 무료로 설치, 사용, 수정 및 재배포할 수 있어요. 게시된 `champollion` npm 패키지는 Apache-2.0을 따르며, 배포된 패키지의 공식 라이선스는 `cli/LICENSE`입니다. 함께 제공되는 MT Eval Harness 및 사양 역시 오픈소스이며, 공개 [harness 저장소](https://github.com/gamedaysuits/Champollion)에서 §7 eval-standard-plugin 예외가 포함된 AGPL-3.0-or-later 라이선스로 제공됩니다.
