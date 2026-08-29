---
sidebar_position: 9
title: "에이전트 가이드: champollion 사용하기"
description: "AI 에이전트가 champollion을 설치하고 구성하여 로케일 파일을 번역하는 방법이에요."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 에이전트 가이드: champollion 사용하기

champollion은 명령어 하나로 앱의 로케일 파일을 번역하는 CLI 도구예요. 이 가이드는 빠르게 번역된 로케일 파일을 만들고 싶은 AI 에이전트(또는 AI 에이전트와 함께 작업하는 개발자)를 위한 것이에요.

:::tip[이미 익숙하신가요?]
명령어만 필요하시다면 [CLI Reference](/docs/reference/cli)로 바로 이동하세요. 번역 방식을 구축하고 벤치마킹하고 싶으시다면 [Network Agent Guide](/docs/network/getting-started/agent-guide)를 참고하세요.
:::

---

## 환경 설정

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**요구 사항:**
- Node.js 20.11+ (native ESM)
- 번역 제공자의 API 키

**API 키 설정** — champollion은 사용하는 방법에 따라 최소한 하나의 키가 필요해요:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion은 `.env.local`와 `.env`를 자동으로 읽어요 (우선순위: `process.env` → `.env.local` → `.env`). OpenRouter 키는 [openrouter.ai/keys](https://openrouter.ai/keys)에서 받으실 수 있어요.

---

## 첫 번째 동기화

Champollion은 로케일 파일과 그 형식(JSON, TOML, YAML), 그리고 대상 언어를 자동으로 감지해요:

```bash
npx champollion sync
```

**동작 과정:**
1. `champollion.config.json`을 로드해요 (또는 설정을 자동 감지해요)
2. 소스 로케일 파일을 스캔하고 중첩된 키를 평탄화해요
3. `.champollion.lock`(이전에 번역된 값의 SHA-256 해시)과 비교해요
4. 캐시된 번역을 위해 `.champollion/tm.json`을 확인해요 (Translation Memory)
5. 구성된 방법을 통해 **변경되거나, 누락되거나, 오래된 키**만 번역해요
6. 모든 번역에 대해 품질 게이트(5가지 검사)를 실행해요
7. 통과한 번역을 대상 로케일 파일에 작성해요
8. lock 파일과 TM 캐시를 업데이트해요

키 하나를 변경한 후의 일반적인 재실행에서는, 4단계에서 142개의 키가 캐시에서 제공되고 5단계에서 1개의 키가 번역돼요. 이것이 이후의 동기화가 빠르고 저렴한 이유예요.

---

## 구성

프로젝트 루트에 `champollion.config.json`을 생성하세요:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

페어 키는 하이픈이 아니라 **콜론**(`en:fr`)을 사용해요 — 하이픈은 `es-MX` 같은 지역 로케일 코드용으로 예약되어 있어요.

주요 필드:

| 필드 | 용도 | 기본값 |
|-------|---------|---------|
| `inputLocale` | 원본 언어 | `en` |
| `languages` | 대상 언어 (배열 또는 객체) | `[]` |
| `pairs` | 메서드 구성이 포함된 페어별 재정의 (`"src:tgt"` 키) | 선택 사항 |
| `localesDir` | 로케일 파일이 위치하는 곳 | `./locales` |
| `model` | `llm`/`llm-coached` 메서드용 LLM 모델 | `google/gemini-3.5-flash` |
| `batchSize` | API 호출당 키 개수 | 80 (LLM); Google Translate는 요청당 128 세그먼트로 제한됨 |
| `jsonConcurrency` | JSON 키에 대한 병렬 로케일 번역 | 50 |
| `contentConcurrency` | 콘텐츠 번역을 위한 병렬 API 호출 | 48 (Docusaurus 문서), 12 (Hugo `contentDir`) |

전체 참조: [Configuration](/docs/getting-started/configuration)

---

## 번역 메서드

| 방법 | 사용 시기 | 비용 | 필요한 API 키 |
|--------|------------|------|---------------|
| **`llm`** | 범용, 자원이 풍부한 언어에 적합 | 토큰당 (모델 의존적) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | 대상 언어의 문법 규칙/사전이 있을 때 | 토큰당 + 코칭 컨텍스트 | `OPENROUTER_API_KEY` |
| **`google-translate`** | GT가 잘 작동하는 고자원 언어 | 백만 자당 $20 | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | HTTP 엔드포인트 뒤에 호스팅된 커스텀 파이프라인 | 서버 결정 | 없음 (엔드포인트가 인증 처리) |
| **`plugin`** | 로컬에 설치된 사전 패키지된 방법 | 다양함 | 다양함 |

세부 정보: [Translation Methods](/docs/guides/translation-methods)

---

## 코칭 데이터

`llm-coached` 페어의 경우, 코칭 데이터는 명시적인 언어학적 지식으로 LLM을 안내해요. 코칭 파일을 생성하세요:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

페어 구성에서 참조하세요:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

품질 게이트는 사전 용어가 실제로 출력에 나타나는지 검증해요 — 위반 사항은 `[TERM]` 경고로 기록돼요.

세부 정보: [Coaching Data](/docs/concepts/coaching-data)

---

## 품질 게이트

모든 번역은 디스크에 작성되기 전에 다섯 가지 자동 검사를 통과해요:

| 검사 | 잡아내는 것 | 예시 |
|-------|----------------|---------|
| **빈 값/공백** | 모델이 아무것도 반환하지 않음 | `""` |
| **소스 에코** | 모델이 영어 입력을 변경 없이 반환함 | 일본어에 대한 `"Welcome"` |
| **환각 루프** | 반복되는 트라이그램 | `"Qo' Qo' Qo' Qo'"` |
| **길이 팽창** | 출력이 소스보다 4배 이상 길어짐 | 10자 소스 → 50자 출력 |
| **스크립트 준수** | 로케일에 맞지 않는 스크립트 | 아랍어 로케일에 대한 라틴 텍스트 |

실패는 `[GATE]` 접두사와 함께 기록돼요. 조용한 폴백은 없어요 — 번역이 실패하면, 조용히 받아들여지는 것이 아니라 보고돼요.

세부 정보: [Quality Gate](/docs/concepts/quality-gate)

---

## Translation Memory

Champollion은 소스 텍스트 + 로케일 + 방법을 키로 하여 `.champollion/tm.json`에 번역을 캐시해요. 이후의 동기화에서는 변경되지 않은 키가 캐시에서 제공돼요 — API 호출도, 비용도 없어요.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

한 번의 실행에 대해 캐시를 우회하려면: `npx champollion sync --no-tm`

세부 정보: [Translation Memory](/docs/concepts/translation-memory)

---

## 생성된 파일

Champollion은 프로젝트에 여러 파일을 생성해요. 실수로 잘못된 파일을 삭제하거나 커밋하지 않도록 그것들이 무엇인지 알아두세요:

| 파일 | 용도 | Git? |
|------|---------|------|
| `.champollion.lock` | 번역된 원본 값의 SHA-256 해시 (변경 감지) | **예** — 커밋하세요 |
| `.champollion-content.lock` | 동일하지만 Markdown/MDX 콘텐츠 파일용 | **예** — 커밋하세요 |
| `.champollion/` | 내부 상태 디렉터리 (`tm.json` 캐시, XLIFF 내보내기, 백업) | **아니요** — gitignore에 추가하세요; `tm.json`은 로컬 캐시예요 ([Configuration](/docs/getting-started/configuration) 참고) |
| 직접 작성하는 코칭 파일 (예: `coaching/fr.json`) | 언어적 지식 | **예** — 커밋하세요 |
| `champollion.config.json` | 프로젝트 구성 | **예** — 커밋하세요 |

---

## 일반적인 패턴

**구성된 모든 페어 번역:**
```bash
npx champollion sync
```
Champollion은 모든 로케일을 병렬로 번역해요. TM 캐싱을 사용하면 변경된 키만 API를 호출해요(변경되지 않은 페어는 캐시에서 제공되므로 전체 동기화 비용이 저렴해요).

**특정 페어만 번역:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair`은(는) 실행을 지정된 페어로만 제한해요. 준비 상태 확인과 비용 지출은 해당 페어에만 적용돼요. 구성된 페어 그래프에 없는 페어를 지정하면 구성된 페어 목록과 함께 명시적인 오류가 발생하며, 아무런 알림 없이 무시(silent no-op)되는 일은 절대 없어요.

**콘텐츠 모드 (Docusaurus, Hugo 등을 위한 Markdown/MDX):**
```bash
npx champollion sync --content-dir ./content
```
로케일 JSON과 함께 문서, 블로그 게시물, 콘텐츠 파일을 번역해요. 콘텐츠 번역은 병렬로 실행되며, `--content-concurrency`로 조정할 수 있어요.

**드라이 런 (작성 없이 미리 보기):**
```bash
npx champollion sync --dry-run
```

**특정 키 강제 재번역:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**모든 콘텐츠 파일 강제 재번역:**
```bash
npx champollion sync --force-content
```

**번역 상태 확인:**
```bash
npx champollion status
```
각 페어에 대한 커버리지, 품질 등급, 플러그인 정보를 보여줘요.

**번역되지 않은 폴백 감사:**
```bash
npx champollion audit
```
번역이 필요한 모든 `[EN]` 폴백 값을 나열해요.

---

## 문제 해결

| 문제 | 해결 방법 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | 키를 내보내거나 프로젝트 루트의 `.env`에 추가하세요 |
| `No locale files found` | 구성에서 `localesDir`을 설정하거나, 로케일 파일이 표준 명명(`en.json`, `fr.json`)과 일치하는지 확인하세요 |
| `[GATE] Script compliance failed` | 대상 로케일이 예상된 스크립트 대신 라틴 텍스트를 받았어요 — 다른 모델을 시도하거나 코칭 데이터를 추가하세요 |
| `[GATE] Source echo` | 모델이 영어를 변경 없이 반환했어요 — 보통 코칭 데이터나 다른 모델로 해결돼요 |
| 모든 번역이 캐시됨 | 캐시를 우회하려면 `--no-tm`로 실행하거나, 특정 키의 경우 `--force-keys`으로 실행하세요 |
| Lock 파일 충돌 | `.champollion.lock`은 SHA-256 해시를 사용해요 — 병합 충돌은 어느 버전을 유지하든 안전하게 해결한 후 동기화를 다시 실행하면 돼요 |

---

## 다음 단계

- [Quick Start](/docs/getting-started/quick-start) — 전체 시작 안내
- [CLI Reference](/docs/reference/cli) — 모든 명령어와 플래그
- [How It Works](/docs/how-it-works) — 동기화 파이프라인 설명
- [The Eval Harness Bridge](/docs/guides/bridge) — champollion이 Network에 연결되는 방식
- **자신만의 번역 방법을 만들고 싶으신가요?** [Network Agent Guide](/docs/network/getting-started/agent-guide)를 참고하세요 — 방법을 만들고, 공개 리더보드에서 작동함을 입증하고, 상금이 열려 있다면 그것을 위해 경쟁하세요 (상금은 계획된 메커니즘이에요 — [Honest Limitations](/docs/network/honest-limitations)를 참고하세요).
