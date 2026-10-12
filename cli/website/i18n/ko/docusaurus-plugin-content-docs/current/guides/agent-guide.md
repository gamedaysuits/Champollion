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
| `inputLocale` | 소스 언어 | `en` |
| `languages` | 타깃 언어(배열 또는 객체) | `[]` |
| `pairs` | 메서드 설정이 포함된 언어 쌍별 재정의(`"src:tgt"` 키) | 선택 사항 |
| `localesDir` | 로캘 파일이 위치한 경로 | `./locales` |
| `model` | `llm`/`llm-coached` 메서드에 사용할 LLM 모델 | `google/gemini-3.8-flash` |
| `batchSize` | API 호출당 키 수 | 80(LLM); Google Translate는 요청당 최대 128개 세그먼트로 제한 |
| `jsonConcurrency` | JSON 키에 대한 병렬 로캘 번역 수 | 50 |
| `contentConcurrency` | 콘텐츠 번역을 위한 병렬 API 호출 수 | 48(Docusaurus 문서), 12(`contentDir`) |

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

| 검사항목 | 감지 대상 | 예시 |
|-------|----------------|---------|
| **비어 있음/공백** | 모델이 아무것도 반환하지 않음 | `""` |
| **소스 그대로 반환(Source echo)** | 모델이 영어 입력을 변경 없이 그대로 반환함 | 일본어에 대한 `"Welcome"` |
| **환각 루프(Hallucination loop)** | 반복되는 트라이그램 | `"Qo' Qo' Qo' Qo'"` |
| **길이 과도 팽창(Length inflation)** | 출력이 소스 길이의 4배를 초과함(정확히 4배는 통과) | 10자 소스 → 50자 출력 |
| **문자 체계 준수(Script compliance)** | 로캘에 맞지 않는 문자 체계 | 아랍어 로캘에 라틴 문자 사용 |

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

| 파일 | 용도 | Git 관리 여부? |
|------|---------|------|
| `.champollion.lock` | 번역된 소스 값의 SHA-256 해시(변경 감지용), 그리고 로캘별 정보: 동기화(sync)가 작성한 내용, redo 실행 후 대기 상태로 남은 키, 거부 후 보류된 키 | **예** — 커밋하세요 |
| `.champollion-replaced-edits.jsonl` | 동기화로 교체된 직접 편집 번역본 및 해당 문구(해당 상황 발생 시에만 작성됨) | **예** — 커밋하세요 |
| `.champollion-content.lock` | 동일하지만 Markdown/MDX 콘텐츠 파일 대상 | **예** — 커밋하세요 |
| `.champollion/` | 내부 상태 디렉터리(`tm.json` 캐시, XLIFF 내보내기, 백업) | **아니요** — .gitignore에 추가하세요. `tm.json`는 로컬 캐시입니다([설정](/docs/getting-started/configuration) 참조) |
| 직접 작성하는 코칭 파일(예: `coaching/fr.json`) | 언어적 지식 | **예** — 커밋하세요 |
| `champollion.config.json` | 프로젝트 설정 | **예** — 커밋하세요 |

---

## 일반적인 패턴

**설정된 모든 언어 쌍 번역:**
```bash
npx champollion sync
```
Champollion은 모든 로캘을 병렬로 번역해요. TM 캐싱을 통해 변경된 키만 API를 호출해요(변경되지 않은 쌍은 캐시에서 제공되므로 전체 동기화 비용이 매우 저렴해요).

**특정 언어 쌍만 번역:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair`는 실행 대상을 지정한 언어 쌍으로 제한해요. 준비 상태 검사 및 비용 지출도 해당 쌍에만 적용돼요. 설정된 언어 쌍 그래프에 없는 쌍을 지정하면 설정된 언어 쌍 목록과 함께 오류가 명확하게 발생하며, 조용히 아무 작업도 하지 않고 넘어가는 일은 절대 없어요.

**언어 쌍을 표기하는 방법.** 프로젝트 언어 쌍은 `champollion.config.json`에서 키로 지정하는 방식인 `en:fr` 형식으로 작성해요. `sync`, `verify`, `serve`는 `en>fr` 및 `en-fr`도 읽으며, `en-pt-BR`는 사용자가 설정한 언어 쌍과 대조돼요. 네트워크 명령어(`network register-corpus`, `leaderboard`, `recommend`, `submit`)는 리더보드에 저장되는 형식인 `eng>crk`로 언어 쌍을 기록하며, `eng-crk`와 `eng:crk`도 동일한 방식으로 읽어요. 여기서는 하이픈만 있는 언어 쌍의 경우 2글자 또는 3글자 코드 두 개(`eng-crk`)여야 해요. 코드 자체에 하이픈이 포함되어 있다면 `>`가 필요해요: `--pair "eng>pt-BR"`. `eng-pt-BR`는 `eng-pt` 및 `BR`를 의미할 수도 있으므로 임의로 추측하지 않고 거부돼요. 쉘에서는 `>` 형식을 따옴표로 감싸세요: `--pair "eng>crk"`. 따옴표로 감싸지 않으면 쉘이 출력을 `crk`라는 이름의 파일로 리디렉션해요.

**콘텐츠 모드(Markdown/MDX 폴더: Hugo `content/` 또는 임의의 폴더; Docusaurus 문서는 이 옵션 없이도 감지됨):**
```bash
npx champollion sync --content-dir ./content
```
로캘 JSON과 함께 문서, 블로그 게시물, 콘텐츠 파일을 번역해요. 각 번역본은 소스 파일 옆에 `<name>.<locale>.md`로 작성돼요. 검토자가 번역본을 수정한 경우 소스의 다른 부분이 변경되더라도 해당 수정 사항이 유지돼요([콘텐츠 번역](/docs/guides/content-translation#reviewing-and-editing-translations)). 콘텐츠 번역은 병렬로 실행되며, `--content-concurrency`로 조절할 수 있어요.

**드라이 런 (작성 없이 미리 보기):**
```bash
npx champollion sync --dry-run
```

**특정 키 강제 재번역:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**모든 콘텐츠 파일 재처리(캐시된 텍스트가 재사용되므로 변경되지 않은 텍스트는 무료):**
```bash
npx champollion sync --force-content
```

**특정 콘텐츠 파일을 새로 번역(비용 발생)하거나 일부 파일로 실행 제한:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**기계 판독 가능한 실행:** `--json`는 한 줄에 하나의 JSON 객체(NDJSON)를 작성하며, 각 객체에는 `level`가 포함돼요. 표준 출력(stdout)에는 `info` 및 `ok` 메시지, `event` 레코드(`--max-cost` 게이트 전의 예상 견적인 `"event": "cost"`, 그리고 콘텐츠 파일 및 로캘당 하나의 `"event": "file"`), 그리고 마지막으로 마무리 `{"level": "summary", "command": "sync", …}`가 출력돼요. 표준 오류(stderr)에는 `warn` 및 `error` 라인이 마찬가지로 JSON으로 출력돼요. 줄 위치만으로 요약을 선택하지 말고 레벨을 통해 선택하세요: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. 종료 코드 `2`는 부분 완료(일부 작업은 수행되었으나 일부가 실패함)를 의미해요.

예상 견적(`cost` 이벤트 및 요약의 `costEstimate`)에서 가격을 알 수 없는 항목이 일부라도 있으면 `totalEstimatedCost`는 `null`가 돼요. 부분 합계나 알 수 없는 항목에 대해 `0`를 사용하는 일은 없어요. `knownEstimatedCost`에는 가격이 책정된 부분이 담기고, `unknownCost.reason`에는 가격이 없는 언어 쌍이 나열되며, `unknownCost.notes`에는 어떤 항목의 가격이 없고 그 이유가 무엇인지(예: OpenRouter 목록에 없는 모델 이름(가장 유사한 목록 이름과 함께 표시되는 오타 가능성), 토큰당 가격이 없는 목록의 모델, 또는 읽을 수 없는 가격표 등) `{ subject, pairs, note }`에 표시돼요. 이 머신에 있는 로컬 모델(`localhost`/`127.0.0.1`/`::1`의 `local` 또는 `api` 엔드포인트)은 `"local": true`와 함께 `0`로 가격이 책정돼요. 요약의 `sentToModel`는 이번 실행에서 메서드로 전송된 키의 수를 집계해요(`tmHits`: 캐시에서 제공됨). 드라이 런의 요약에는 `preflight: { ready, failures }`가 포함돼요. 드라이 런 자체는 `0`로 종료되지만([종료 코드](/docs/reference/cli#sync-exit-codes)), `ready: false`는 실제 실행 시 중단되어 `1`로 종료됨(누락된 키 또는 실행에 필요한 모델 서버의 무응답)을 의미해요. `--max-cost`를 사용하면 `maxCost: { cap, estimatedCost, wouldStop }`도 포함돼요. `wouldStop: true`(`exitCode: 2` 및 `reason` 포함)는 실제 실행 시 API 호출 전에 한도에 도달하여 중단됨을 의미해요. `realRun: { exitCode, wouldStop, reasons }`는 미리보기가 판단할 수 있는 한 실제 실행이 끝날 종료 코드예요. 즉 사전 점검(preflight) 및 한도 제한 외에도 부분 완료 상태를 유발할 요소들, 즉 보류된 키, 다시 요청하지 않을 언어의 형태가 누락된 디스크 상의 복수형 메시지(드라이 런의 `totalPluralGaps`에서 집계됨) 등이 포함돼요. 드라이 런은 아무것도 검증하지 않아요(`verify: { "ran": false }`). 드라이 런을 실행할 때는 실제 실행의 `--method`/`--model`를 함께 사용하세요. 이 옵션들이 없으면 설정에 명시된 메서드를 검사해요.

**번역 상태 확인:**
```bash
npx champollion status
```
각 언어 쌍의 메서드, 모델, 커버리지 및 플러그인 정보를 표시해요(`qualityTier`는 설정에 지정된 경우에만 표시되며, 측정값이 아니라 레이블이에요).

**번역되지 않은 폴백 감사:**
```bash
npx champollion audit
```
번역이 필요한 모든 `[EN]` 폴백 값을 나열해요.

---

## 문제 해결

| 문제 | 해결 방법 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | 키를 환경 변수로 내보내거나(export) 프로젝트 루트의 `.env`에 추가하세요 |
| `No locale files found` | 설정에서 `localesDir`을(를) 지정하거나, 로캘 파일이 표준 명명 규칙(`en.json`, `fr.json`)과 일치하는지 확인하세요 |
| `[GATE] Script compliance failed` | 타깃 로캘에 예상 문자 체계 대신 라틴 문자가 생성되었습니다. 다른 모델을 시도하거나 코칭 데이터를 추가해 보세요 |
| `[GATE] Source echo` | 모델이 영어를 변경 없이 그대로 반환했습니다. 코칭 데이터를 추가하거나 다른 모델을 사용하면 대개 해결돼요 |
| All translations cached | 캐시를 건너뛰려면 `--no-tm`(으)로 실행하거나, 특정 키에 대해 `--force-keys`을(를) 사용하세요 |
| Lock file conflicts | `.champollion.lock`는 해시를 보관해요. 병합 충돌 시 어느 쪽 버전을 유지해도 안전하며, 그 후 동기화를 다시 실행하면 돼요. 상대편의 로캘별 기록을 유지할 경우 일부 값이 직접 편집된 것으로 인식될 수 있어요(이 경우 일괄 redo 시 해당 값이 유지되고 명명돼요. `--redo keys:`는 하나를 교체해요). 그 반대는 절대 발생하지 않아요 |
| Keys "held back" | 품질 게이트가 이전에 해당 모델의 답변을 거부했어요. 일반 동기화는 이를 다시 전송하지 않아요(동일한 답변에 대해 요금이 청구되기 때문이에요). `champollion sync --redo keys:<key>`을(를) 사용하여 다시 요청하거나, `fallback`을(를) 추가하거나, `noTranslate`에 나열하거나, 직접 수동으로 작성하세요 |

---

## 다음 단계

- [Quick Start](/docs/getting-started/quick-start) — 전체 시작 안내
- [CLI Reference](/docs/reference/cli) — 모든 명령어와 플래그
- [How It Works](/docs/how-it-works) — 동기화 파이프라인 설명
- [The Eval Harness Bridge](/docs/guides/bridge) — champollion이 Network에 연결되는 방식
- **자신만의 번역 방법을 만들고 싶으신가요?** [Network Agent Guide](/docs/network/getting-started/agent-guide)를 참고하세요 — 방법을 만들고, 공개 리더보드에서 작동함을 입증하고, 상금이 열려 있다면 그것을 위해 경쟁하세요 (상금은 계획된 메커니즘이에요 — [Honest Limitations](/docs/network/honest-limitations)를 참고하세요).
