---
sidebar_position: 3
title: "구성"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 구성

Champollion은 별도의 구성 없이 작동해요 — 프로젝트에서 로케일 파일, 형식, 대상 언어를 자동으로 감지해요. 더 세밀하게 제어하려면 프로젝트 루트에 `champollion.config.json`을 생성하거나 다음을 실행하세요:

```bash
npx champollion init
```

## 전체 구성 레퍼런스

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen은 아직 구현되지 않았어요]
`typegen` 구성 블록은 구성 로더가 인식하고 보존하지만, TypeScript 타입 생성은 아직 구현되지 않았어요. 이는 계획된 기능을 위한 자리 표시자예요. 이 값들을 설정해도 아무런 효과가 없어요.
:::


### 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `version` | `number` | `3` | 설정 스키마 버전입니다. 항상 `3`입니다. |
| `inputLocale` | `string` | `"en"` | 원본 언어 코드입니다(BCP 47). |
| `localesDir` | `string` | `"./locales"` | 로케일 파일 경로입니다. Champollion이 이 디렉터리를 스캔합니다. |
| `contentDir` | `string` | `null` | Hugo 콘텐츠 디렉터리입니다. 마크다운 본문 번역을 활성화합니다. |
| `translatableFields` | `string[]` | `null` | 콘텐츠 번역 시 번역 가능한 기본 프런트매터 필드를 재정의합니다. `null`는 내장된 기본값(`title`, `description`, `summary`)을 사용합니다. |
| `format` | `string` | `"auto"` | 파일 형식입니다: `json`, `toml`, `yaml` 또는 `auto` (확장자에서 감지). |
| `model` | `string` | `"google/gemini-3.5-flash"` | LLM 방식의 기본 모델입니다. 전체 OpenRouter 슬러그(`provider/model`) 또는 `shared/model-aliases.json`의 짧은 별칭(예: `gemini-flash`)을 허용합니다. 직접 제공자는 기본 이름(예: `gpt-4o`)을 사용합니다. |
| `temperature` | `number` | `0.3` | LLM temperature 값입니다(0.0–2.0). 낮을수록 더 결정론적입니다. |
| `defaultMethod` | `string` | `"llm"` | 기본 번역 방식입니다: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. `--method` CLI 플래그로 재정의할 수 있습니다. |
| `batchSize` | `number` | `80` | 번역 배치당 키 개수입니다. 높을수록 API 호출 횟수는 줄어들지만 프롬프트 크기는 커집니다. |
| `coachingFile` | `string` | `null` | 자유 텍스트 코칭 프롬프트 파일의 경로입니다(프로젝트 루트 기준 상대 경로). 시작 시 내용을 읽어 시스템 프롬프트에 `Coaching guidance:` 블록으로 주입합니다. |
| `promptContext` | `string` | `null` | 시스템 프롬프트에 주입되는 애플리케이션 컨텍스트 문자열입니다(예: "이커머스 제품 설명"). 모델이 도메인에 맞게 번역을 조정하는 데 도움을 줍니다. |
| `jsonConcurrency` | `number` | `200` | JSON 키 동기화를 위한 최대 병렬 로케일 번역 수입니다. `--json-concurrency` CLI 플래그로 재정의할 수 있습니다. |
| `contentConcurrency` | `number` | `48` | 콘텐츠(마크다운/MDX) 번역을 위한 최대 병렬 API 호출 수입니다. `--content-concurrency` CLI 플래그로 재정의할 수 있습니다. |
| `fallbackPrefix` | `string` | `"[EN] "` | 이전 실행에서 번역되지 않은 레거시 값을 감지하기 위해 `audit` 및 `verify`에서 사용하는 마커 접두사입니다. Champollion은 이 접두사를 쓰지 않으며, 감지를 위해서만 읽습니다. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | API 키의 환경 변수 이름입니다. 사용자 지정 환경 변수 이름을 위해 재정의합니다. |
| `minContentRetention` | `number` | `0.35` | [콘텐츠 삭제 검사](/docs/concepts/quality-gate)가 두 번째 신호를 참조하기 전에 출력 결과가 유지해야 하는 원본 문자/숫자의 비율입니다. 쌍(pair) 및 언어별로도 설정할 수 있습니다. |
| `noTranslate` | `string[]` | `[]` | 값을 모든 로케일에 그대로 복사할 점(dot) 경로 키 및 글로브(glob) 패턴입니다. [번역 제외 키](#no-translate)를 참조하세요. `skipKeys`로도 허용됩니다. |
| `noTranslateUrls` | `boolean` | `true` | `scheme://` URL로만 구성된 원본 값을 번역 제외로 처리합니다. URL 값 키를 번역 백엔드로 보내려면 `false`을 설정하세요. |
| `baseUrl` | `string` | `""` | SEO 아티팩트 생성(hreflang, 사이트맵, JSON-LD)을 위한 기본 URL입니다. |
| `pairs` | `object` | `{}` | 쌍(pair)별 방식, 모델 및 품질 재정의입니다. [쌍 설정](#pair-configuration)을 참조하세요. |
| `languages` | `object` | `{}` | 언어별 재정의입니다. [언어 설정](#language-configuration)을 참조하세요. |
| `lint.srcDir` | `string` | `null` | 린트(lint) 스캔을 위한 소스 디렉터리입니다. `null` = 프레임워크에서 자동 감지합니다. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | 린트에서 제외할 글로브(glob) 패턴입니다. |
| `lint.minLength` | `number` | `2` | 하드코딩된 것으로 표시할 최소 문자열 길이입니다. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | hreflang 태그 생성을 위한 URL 패턴 템플릿입니다. |
| `seo.pages` | `string[]` | `null` | SEO를 위한 명시적 페이지 목록입니다. `null` = 로케일 키에서 자동 감지합니다. |
| `typegen.output` | `string` | `null` | 생성된 TypeScript 타입의 출력 경로입니다. `null` = 비활성화. |
| `typegen.autoGenerate` | `boolean` | `false` | 각 동기화 후 타입을 자동 재생성합니다. |

## 번역 제외 키 {#no-translate}

URL, 리포지토리 경로, 패키지 이름, 제품 식별자 등 일부 값은 모든 언어에서 정확히 동일하게 렌더링되어야 합니다. `https://example.org/paper`의 올바른 번역은 `https://example.org/paper`입니다.

Champollion의 [품질 게이트](/docs/concepts/quality-gate)는 원본 에코(원본과 동일한 번역)를 거부합니다. 이는 일반적으로 모델이 작업을 거부하는 것을 의미하기 때문입니다. 이러한 키의 경우 정답이 거부 대상이 되며, 모델이 통과할 수 있는 출력 결과를 생성할 수 없습니다. 성능이 낮은 모델은 값을 아주 약간 변경하여(조작된 `#fragment`, 불필요한 후행 슬래시, 보이지 않는 폭 없는 공백 등) 게이트를 통과하는 방법을 학습하게 되고, 이로 인해 깨진 링크가 배포됩니다. 성능이 뛰어난 모델은 값을 변경하지 않고 반환하여 게이트를 통과하지 못하므로, 매 실행마다 `sync`이 0이 아닌 값으로 종료됩니다.

대신 이러한 키를 선언하세요:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

일치하는 키는 **원본 로케일에서 그대로 복사**됩니다. 번역 백엔드로 전송되지 않고, 품질 게이트를 거치지 않으며, 실패로 간주되지 않고, 비용이 청구되지 않습니다. 같은 이유로 실행 전 예상 비용에서도 제외됩니다.

### 패턴 구문

패턴은 평탄화된 키 공간에 대한 점(dot) 경로이며, 두 가지 와일드카드를 사용합니다:

| 패턴 | 일치함 | 일치하지 않음 |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (정확한 경로) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (모든 깊이의 `url` 리프) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*`은 단일 세그먼트 내에서 일치하며, `**`는 0개 이상의 전체 세그먼트와 일치합니다. 와일드카드가 없는 패턴은 정확한 키 경로입니다.

### URL은 기본적으로 처리됩니다

URL 값 키는 게이트에서 올바른 결과를 얻을 수 없으므로, `noTranslateUrls`은 기본적으로 `true`로 설정되어 있습니다. 절대 `scheme://` URL로만 구성된 모든 원본 값은 별도의 설정 없이 번역 제외로 처리됩니다.

감지 범위는 의도적으로 좁게 설정되어 있습니다. 공백을 제거한 전체 값이 URL이어야 합니다. 단순히 링크를 포함하는 문장(`"Read the paper at https://…"`)은 여전히 정상적으로 번역됩니다.

URL이 실제로 로케일별로 다른 경우(예: 언어별 문서 호스트) `"noTranslateUrls": false`을 사용하여 이 기능을 끄세요. 그런 다음 그렇지 않은 URL은 `noTranslate`로 선언하세요.

### 복구 및 강제 적용

번역 제외 키의 경우 올바른 대상 값이 정확히 하나만 존재하므로, 어떠한 차이도 결함으로 간주됩니다. Champollion은 이를 양방향으로 강제 적용합니다:

- **`sync`는 이를 복구합니다.** 대상이 누락되었거나, `[EN] ` 접두사가 붙었거나, 변경된 번역 제외 키는 원본에서 다시 작성됩니다. 이 작업은 API 호출 비용이 발생하지 않으며 멱등성을 가집니다. 값이 일치하게 되면 이후 동기화에서는 해당 키를 완전히 건너뜁니다.
- **`verify` 및 `integrity`는 실패 처리합니다.** 변형된 번역 제외 키는 예상 값과 실제 값과 함께 `NO-TRANSLATE DRIFT`로 보고됩니다. 이러한 유형의 손상은 diff에서 확인하기 불가능하므로 보이지 않는 문자는 `\uXXXX`로 이스케이프 처리됩니다. `champollion integrity`는 `1`으로 종료되므로, 여기에 연결된 빌드는 배포 전에 손상된 URL을 잡아냅니다.

방금 설정한 프로젝트에서 `integrity`이 이런 식으로 실패한다면, 이는 로케일 파일에 이미 존재하던 손상을 보고하는 것입니다. `champollion sync`을 한 번 실행하여 복구하세요.

## 문자 변환 {#script-conversion}

Champollion이 번역하는 일부 언어는 두 가지 이상의 방식으로 *표기*될 수 있습니다. 모델은 항상 해당 언어의 **작업 문자(working script)**(라틴 로마자 표기법 — 평원 크리어의 경우 SRO, 클링온어의 경우 오크란드 로마자 표기법)로 작동하며, 결정론적 변환기가 출력 결과를 표시 문자(display script)로 다시 작성할 수 있습니다. 변환 여부는 설정에서 결정하며, **절대 기본값으로 적용되지 않습니다**:

| 로케일 | 작업 문자 | 변환 가능 문자 | 종류 |
|--------|---------------|----------------|------|
| `crk` (평원 크리어) | `Latn` (SRO) | `Cans` (음절 문자) | 실제 유니코드 — **선택 필수** |
| `sr` / `srp` (세르비아어) | `Latn` | `Cyrl` (키릴 문자) | 실제 유니코드 — **선택 필수** |
| `tlh` (클링온어) | `Latn` (로마자 표기법) | `Piqd` (pIqaD) | PUA — 선택 사항 |
| `x-elvish-s` (신다린어) | `Latn` | `Teng` (텡과르) | PUA — 선택 사항 |
| `x-kryptonian` | `Latn` | 크립톤어 | PUA — `"script": "x-kryptonian"`를 통한 선택 사항 |

**실제 유니코드 쌍(crk, sr)은 선택이 필수입니다.** 크리어 음절 문자와 키릴 문자는 일반적인 유니코드이므로 어디서나 렌더링되며, 두 정서법 모두 실제로 사용됩니다. Champollion은 프로젝트를 대신하여 커뮤니티의 표기 체계를 임의로 선택하지 않습니다. 언어를 선택할 때 `init`가 질문하며, 설정에서 어떤 것을 사용할지 지정할 때까지 `sync`은 실행을 거부합니다:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA 문자(tlh, x-elvish-s, x-kryptonian)는 로마자 표기법이 기본값입니다.** pIqaD, 텡과르, 크립톤어는 *유니코드에 포함되어 있지 않습니다*. 변환기는 사용자 정의 영역(Private Use Area) 코드 포인트를 내보내며, 해당 코드 포인트에 매핑된 폰트를 제공하지 않으면 아무것도 렌더링되지 않습니다. 로마자 표기법만이 어디서나 렌더링되는 유일한 출력이므로 기본값으로 설정됩니다. 대신 표시 문자를 내보내려면 다음과 같이 설정하세요:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…그리고 사이트에서 이를 그릴 수 있는 폰트를 갖추도록 `champollion fonts install`을 실행하세요. 폰트가 라틴어 음역에 맞춰져 있다면(많은 인공어 폰트가 그렇습니다) 기본값을 유지하세요.

`script`은 대소문자 구분 없이 ISO 15924 코드를 사용합니다(`"cans"`, `"Cans"`, `"CANS"`은 모두 동일합니다). 쌍(pair)별로도 설정할 수 있으며, 이 경우 언어 수준의 설정보다 우선합니다. 잘못된 값이나 로케일에서 생성할 수 없는 문자는 API 호출 전인 시작 단계에서 실패 처리됩니다.

### 매핑되지 않은 문자와 `scriptFallback` {#script-fallback}

변환기는 해당 정서법이 정의하는 내용만 번역하며 그 외에는 번역하지 않습니다. 클링온어 로마자 표기법에는 `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` 또는 `z`이 없습니다. 따라서 "GitHub"와 같은 고유 명사가 포함된 모델 출력은 완전히 변환될 수 없습니다. Champollion은 **절대 절반만 변환된 값을 쓰지 않습니다**. 매핑할 수 없는 문자가 하나라도 있으면 전체 값이 작업 문자로 유지되며, 경고 메시지에 해당 문자와 이를 매핑할 수 있는 설정 줄이 표시됩니다.

이러한 매핑은 직접 선언해야 합니다:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

각 규칙은 변환이 실행되기 전에 작업 문자 시퀀스를 변환기가 매핑*할 수 있는* 시퀀스로 대체합니다. 규칙은 시작 시 검증되며, 대체할 문자 자체가 매핑 불가능한 경우 거부됩니다.

Champollion은 **자체적인 대체(fallback) 규칙을 제공하지 않습니다**. 특히 실제 언어의 표기 체계에 대한 정서법적 변형을 만들어내는 것은 인덱스가 결정할 문제가 아닙니다. 커뮤니티와 팬덤에는 고유한 관습이 있으므로, 프로젝트별로 이를 신중하게 채택하세요.

### 원치 않는 변환 복구 {#repair-script}

0.3.0 버전 이전에는 변환이 무조건적으로 이루어졌습니다. PUA 로케일을 대상으로 하는 프로젝트는 원하든 원하지 않든 렌더링할 수 없는 출력 결과를 얻었습니다. 두 가지 도구가 이 문제를 해결합니다:

- **`champollion repair-script`**는 설정에서 변환이 *꺼져 있는* 로케일의 PUA 코드 포인트를 스캔하고, 변환기 자체의 역방향 테이블을 사용하여 로마자 표기법을 복원합니다(미리 보려면 `--dry` 사용). pIqaD는 정확하게 역변환되지만, 텡과르와 크립톤어 역변환은 대소문자 구분을 잃으며 이에 대한 알림을 표시합니다.
- **`champollion integrity`**는 변환이 꺼져 있는 곳에서 PUA가 발견되면 실패(종료 코드 1) 처리합니다. 따라서 빌드 게이트가 배포 전에 렌더링할 수 없는 텍스트를 잡아내며, 보고서에 복구 방법이 명시됩니다.

번역 메모리(Translation Memory)는 복구할 필요가 없습니다. 변환 전의 값을 저장하므로 나중에 `script:`를 켜거나 꺼도 캐시 작업이 필요하지 않습니다.

문자 변환은 UI 문자열(키-값 파일 및 Docusaurus JSON)에 적용됩니다. 마크다운 본문은 절대 변환되지 않습니다. 탐욕적(greedy) 문자 변환기는 코드 스팬, URL 및 프런트매터를 안전하게 통과할 방법이 없기 때문입니다.

## 페어 구성 {#pair-configuration}

각 소스→대상 페어는 독립적으로 구성할 수 있어요:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### 페어 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `method` | `string` | 번역 방식: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | 설치된 플러그인의 이름 (`.champollion/methods/`에서) |
| `model` | `string` | 이 페어의 기본 모델 재정의 |
| `temperature` | `number` | 이 페어의 기본 temperature 재정의 |
| `batchSize` | `number` | 이 페어의 기본 배치 크기 재정의 |
| `register` | `string` | 레지스터/톤 재정의 (프리셋 키 또는 자유 형식 텍스트) |
| `endpoint` | `string` | 원격 API 엔드포인트 URL. `method`이 `api`일 때 필수예요. |
| `coachingFile` | `string` | 이 페어의 코칭 프롬프트 파일 경로 |
| `promptContext` | `string` | 이 페어의 애플리케이션 컨텍스트 |
| `qualityTier` | `string` | 표시 등급: `standard`, `high`, `research`, `verified` |

## 언어 구성 {#language-configuration}

언어는 세 가지 형식을 허용해요:

### 코드 배열 (가장 간단)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

각 언어는 내장 레지스터 테이블에서 기본 레지스터를 받아요. 기본값이 없는 언어는 `"Professional register."`을 받아요.

### 레지스터 문자열이 있는 객체

값은 언어 카드의 **프리셋 키**이거나 사용자 지정 레지스터 텍스트일 수 있어요:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion은 문자열이 언어 카드의 프리셋 키와 일치하는지 확인해요. 일치하면 카드의 전체 레지스터 프롬프트가 사용돼요. 그렇지 않으면 문자열이 그대로 사용돼요. 사용 가능한 프리셋은 [지원 언어](/docs/reference/supported-languages#language-cards)를 참조하세요.

### 전체 구성이 있는 객체

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

같은 블록에서 축약형과 전체 객체를 혼합할 수 있어요.


### 언어 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `register` | `string` | 스타일/어조 지침입니다. **사전 설정 키**(예: `casual-tu`, `formal-hapsyo`) 또는 사용자 지정 텍스트일 수 있습니다. [언어 카드](/docs/reference/supported-languages#language-cards)를 참조하세요. |
| `name` | `string` | 사람이 읽을 수 있는 언어 이름입니다(상태 표시용). |
| `model` | `string` | 기본 모델을 재정의합니다. |
| `temperature` | `number` | 기본 temperature 값을 재정의합니다. |
| `batchSize` | `number` | 기본 배치 크기를 재정의합니다. |
| `coachingFile` | `string` | 이 언어에 대한 코칭 프롬프트 파일의 경로입니다. |
| `promptContext` | `string` | 이 언어에 대한 애플리케이션 컨텍스트입니다. |
| `maxRetries` | `number` | 실패한 배치에 대한 최대 재시도 횟수입니다(기본값: 3). |
| `script` | `string` | Champollion이 작성하는 정서법의 ISO 15924 코드입니다(예: `"Cans"`, `"Piqd"`). [문자 변환](#script-conversion)을 참조하세요. |
| `scriptFallback` | `object` | 문자 변환기가 매핑할 수 없는 문자에 대한 음역 규칙입니다. [문자 변환](#script-conversion)을 참조하세요. |

:::info[상속 체인]
설정은 다음 순서로 해석돼요 (먼저 오는 것이 우선):

**페어 수준** → **언어 수준** → **전역 구성** → **기본값**

예를 들어, `pairs["en:fr"]`이 `model`을 설정하면, 언어 수준과 전역 `model` 값을 모두 재정의해요.
:::

## 영어가 아닌 소스

소스 언어가 영어가 아닌 경우:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## 잠금 파일

Champollion은 번역된 소스 값의 SHA-256 해시를 추적하기 위해 `.champollion.lock`을 생성해요. 모든 개발자가 동일한 번역 기준선을 공유하도록 **이 파일을 커밋하세요**.

소스 값이 변경되면 해시가 더 이상 일치하지 않으며, champollion은 다음 동기화 시 해당 키를 다시 번역해요.

## `.champollionignore`

`lint` 스캔에서 파일을 제외하려면 프로젝트 루트에 `.champollionignore`을 생성하세요. `.gitignore`처럼 glob 패턴을 사용해요:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` 디렉터리

Champollion은 내부 상태를 위해 프로젝트 루트에 `.champollion/` 디렉터리를 생성해요. 일반적으로 이것을 **`.gitignore`에 추가해야 해요** — 이는 프로젝트 소스가 아니라 로컬 최적화예요:

```gitignore
.champollion/
```

| 파일 | 목적 | 커밋? |
|------|---------|--------|
| `tm.json` | 번역 메모리 캐시 — 소스 텍스트 + 로케일 + 방식을 키로 이전 번역을 저장 | 아니요 (로컬 캐시) |
| `xliff/*.xliff` | 전문 번역가 검토를 위한 XLIFF 내보내기 파일 | 아니요 (임시) |
| `methods/` | 설치된 방식 플러그인 매니페스트 | 예 (공유 구성) |
| `backups/` | 랩 이전 백업 (`wrap --undo`이 생성) | 아니요 (안전망) |

`tm.json`과 그것이 API 비용을 절감하는 방법에 대한 자세한 내용은 [번역 메모리](/docs/concepts/translation-memory)를 참조하세요.

---

## 프로그래밍 방식 API

빌드 스크립트 및 사용자 지정 통합을 위해 패키지에서 직접 임포트하세요:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### 사용 가능한 익스포트

| 익스포트 | 기능 |
|--------|-------------|
| `TranslationMethod` | 모든 방식의 기본 클래스 |
| `LLMMethod` | LLM 방식의 기본 클래스 (OpenRouter) |
| `DirectLLMMethod` | 직접 LLM 제공자의 기본 클래스 (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | 직접 LLM 제공자 클래스 |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | 전통적인 MT 클래스 |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | 코칭된 LLM (OpenRouter + 코칭 데이터) |
| `APIMethod` | 원격 API 클라이언트 |
| `runSync`, `runContentSync` | 전체 동기화 파이프라인 |
| `resolveConfig`, `resolvePairs` | 구성 해석 |
| `validateTranslations` | 품질 게이트 |
| `loadCoachingData`, `findDictionaryMatches` | 코칭 유틸리티 |

### 사용자 지정 제공자 확장

`DirectLLMMethod`을 확장하여 약 40줄로 새로운 LLM 제공자를 추가하세요:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

translate, 코칭, 재시도 루프, 모델 검증, 품질 등급, 설정 도움말을 무료로 얻을 수 있어요. 제공자별로 다른 것은 HTTP 요청 형태뿐이에요. 원시 `fetch()`을 사용하는 비-LLM 어댑터의 경우, 직접 재시도 루프를 작성하는 대신 `lib/methods/fetch-with-retry.js`의 공유 `fetchWithRetry()` 헬퍼를 사용하세요.

---

## 참고 항목

- [CLI 레퍼런스](/docs/reference/cli) — 모든 명령과 플래그
- [번역 방식](/docs/guides/translation-methods) — 방식 선택 및 혼합
- [번역 메모리](/docs/concepts/translation-memory) — 캐싱 및 비용 절감
- [전문 번역가와 작업하기](/docs/guides/professional-translators) — XLIFF 워크플로
- [플러그인 사양](/docs/reference/plugin-spec) — 방식 플러그인 매니페스트 형식
- [아키텍처](/docs/concepts/architecture) — 각 부분이 어떻게 연결되는지
- [지원 언어](/docs/reference/supported-languages) — 내장 언어 지원
- [동기화 작동 방식](/docs/concepts/how-sync-works) — 번역 파이프라인
