---
sidebar_position: 5
title: "코칭 데이터"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Coaching Data

Coaching data는 champollion이 학습되지 않은 언어에 대해 LLM을 교육하는 메커니즘이에요. 각 번역 요청과 함께 문법 규칙, 사전, 스타일 노트를 제공함으로써, 범용 LLM을 어떤 언어에도 대응하는 컨텍스트 인식 번역기로 바꿀 수 있어요 — 기존 MT 지원이 전혀 없는 언어까지 포함해서요.

## 작동 방식

페어의 method를 `llm-coached`로 설정하면, champollion은 `.champollion/coaching/<locale>.json`에서 coaching 파일을 불러와 그 내용을 모든 LLM 프롬프트의 시스템 메시지 일부로 주입해요. LLM은 번역 요청과 함께 여러분의 언어학적 규칙을 보게 되고, 추측 대신 여러분의 문법과 용어를 따르는 결과물을 생성해요.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Coaching 콘텐츠에는 두 가지 유형이 있어요:

1. **구조화된 coaching data** (`llm-coached` method) — JSON 형식의 문법 규칙, 사전, 스타일 노트예요. `.champollion/coaching/<locale>.json` 또는 플러그인의 `coaching/` 디렉터리에서 불러와요.
2. **자유 텍스트 coaching 프롬프트** (`coachingFile` config 필드) — 시스템 프롬프트에 주입되는 추가 지침이 담긴 일반 텍스트 파일이에요. `llm-coached`뿐만 아니라 모든 LLM method와 함께 작동해요. config의 `coachingFile` 또는 CLI의 `--coaching-file`를 통해 설정해요.

두 가지를 함께 사용할 수 있어요. eval harness는 정확히 동일한 프롬프트 구조를 사용하므로, 벤치마크 점수가 실제 프로덕션 프롬프트를 반영해요.

coaching data가 시스템 메시지의 일부이기 때문에 **프롬프트 캐싱**의 이점을 누려요 — Anthropic이나 Google 같은 제공자는 반복되는 시스템 프리픽스를 캐시하므로, 배치마다가 아니라 세션당 한 번만 coaching 컨텍스트 비용을 지불하면 돼요.

## Coaching 파일 형식

`.champollion/coaching/`에 로케일당 하나의 JSON 파일을 생성하세요:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | 아니요 | 시스템 프롬프트에 주입되는 문법 규칙의 배열이에요. 각 규칙은 LLM이 따를 수 있는 간결하고 실행 가능한 지침이어야 해요. |
| `dictionary` | `object` | 아니요 | 영어 용어 → 대상 언어 용어의 키-값 맵이에요. LLM이 알 수 없는 도메인 특화 어휘에 사용돼요. |
| `style_notes` | `string` | 아니요 | 자유 형식의 스타일 지침이에요(격식, 어조, 격식 규범). |

모든 필드는 선택 사항이에요 — 사전만으로 시작하고 다듬어 나가면서 문법 규칙을 추가할 수 있어요.

## Fallback 동작

페어가 `llm-coached`로 구성되어 있지만 해당 로케일에 대한 coaching 파일이 없는 경우, champollion은 콘솔 경고와 함께 **표준 `llm` method로 fallback해요**:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

즉, `"defaultMethod": "llm-coached"`를 전역적으로 안전하게 설정할 수 있어요 — coaching data가 있는 언어는 그것을 사용하고, 나머지는 오류 없이 표준 LLM 번역을 받게 돼요.

## Coaching을 언제 사용할까요

| 시나리오 | 권장 Method |
|----------|-------------------|
| Tier 1 언어 (프랑스어, 스페인어, 독일어) | `llm` 또는 `google-translate` — LLM이 이미 잘 알고 있어요 |
| Tier 2 언어 (한국어, 터키어, 태국어) | 격식을 지정한 `llm` — LLM이 스타일 지침만으로 적절히 처리해요 |
| Tier 3 언어 (Plains Cree, 요루바어, 케추아어) | `llm-coached` — LLM에 문법 규칙과 사전이 필요해요 |
| 인공어 (클링온어, 신다린어, 크립톤어) | `llm-coached` — LLM에 일부 학습 데이터가 있지만 수정이 필요해요 |

## 좋은 Coaching Data 만들기

### 문법 규칙

규칙을 설명이 아니라 **지침**으로 작성하세요. LLM은 언어학 이론을 해석하는 것보다 지침을 따르는 것을 더 잘해요.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### 사전

LLM이 틀리거나 지어낼 **도메인 특화 용어**에 집중하세요. LLM이 이미 잘 처리하는 일반 단어에는 신경 쓰지 마세요 — 여러분 애플리케이션 UI에 특정한 용어에 집중하세요.

### 스타일 노트

격식, 정중함, 규범에 대해 구체적으로 명시하세요:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Coaching된 번역 테스트하기

[MT Eval Harness](https://github.com/gamedaysuits/Champollion)를 사용해 coaching된 번역을 참조 코퍼스와 비교하여 벤치마크하세요:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

이를 통해 chrF++, BLEU, exact match 점수를 얻을 수 있어요. 여러 coaching 파일 버전을 만들어 비교해 보세요 — 객관적인 지표가 주관적인 검토보다 나아요.

---

## 함께 보기

- [Translation Methods](/docs/guides/translation-methods) — llm-coached method
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — 실제 coaching 사례
- [Plugin Specification](/docs/reference/plugin-spec) — 플러그인에 coaching data 패키징하기
- [Quality Gate](/docs/concepts/quality-gate) — coaching된 번역이 검증되는 방식
- [Configuration](/docs/getting-started/configuration) — 페어별 coaching config
