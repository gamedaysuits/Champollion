---
sidebar_position: 4
title: "Run Card 명세"
---

# Run Card 명세

> **핵심 요약.** Run card는 벤치마킹의 최소 단위로, 하나의 평가 실행에 대한 전체 구성, 항목별 결과, 집계 점수를 기록하는 JSON 문서예요. 이 페이지에서는 스키마, 필드, 핑거프린팅 메커니즘, 점수 구조를 설명해요. 표준 정의는 [Benchmark 명세](/docs/network/specifications/benchmark)를 참고하세요.

Run card는 단일 평가 실행의 완전한 기록이에요. 실험을 이해하고, 재현하고, 검증하는 데 필요한 모든 것(구성, 점수, 개별 결과, 토큰 사용량, 환경 메타데이터)을 담고 있어요.

**스키마 버전:** 2.0

:::info[공식 스키마]
[Benchmark Specification](/docs/network/specifications/benchmark)은 run card 스키마의 유일한 신뢰 출처예요. 메트릭 정의, 복합 가중치, 품질 등급에 대해서는 [Scoring Specification](/docs/network/specifications/scoring)을 참조하세요. 이 페이지는 현재 구현을 문서화한 거예요.
:::

---

## 최상위 필드

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | `string` | 실행 시작 시 생성되는 UUID v4 |
| `harness_version` | `string` | 이 card를 생성한 harness의 시맨틱 버전(예: `2.0`) |
| `model_slug` | `string` | 실행에 사용된 모델 슬러그(예: `google/gemini-3.1-pro`) |
| `model_id` | `string` | API가 반환한 확정된 모델 식별자(예: `gemini-3.1-pro-001`) |
| `condition` | `string` | 실험 레이블(예: `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | 실행이 시작된 ISO 8601 UTC 타임스탬프 |
| `elapsed_seconds` | `number` | 전체 실행의 실제 경과 시간 |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

평가 데이터셋을 식별하고 SHA-256을 통해 특정 콘텐츠 버전에 고정해요.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | 데이터셋 식별자(예: `edtekla-dev-v1`) |
| `version` | `string` | 데이터셋 버전 문자열 |
| `language_pair` | `string` | 표시 레이블(예: `EN→CRK`) |
| `sha256` | `string` | 데이터셋 파일 내용의 SHA-256 해시. 사용된 정확한 데이터를 보장해요 |
| `entry_count` | `number` | 데이터셋의 항목 수 |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

이 실행에 사용된 API 및 배치 구성이에요.

| Field | Type | Description |
|-------|------|-------------|
| `api_provider` | `string` | API 공급자 이름(예: `openrouter`) |
| `temperature` | `number` | 샘플링 temperature |
| `max_tokens` | `number` | completion당 최대 토큰 수 |
| `batch_size` | `number` | 동시 배치당 항목 수 |
| `concurrency` | `number` | 최대 병렬 API 요청 수 |
| `coaching_file` | `string` | coaching 프롬프트 파일 경로(사용된 경우) |
| `method_path` | `string` | method 플러그인 디렉터리 경로(사용된 경우) |
| `fst_retries` | `number` | FST 재시도 횟수 |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[게시된 Run Card에는 `method_config`가 포함돼요]
run card가 `mt-eval publish`를 통해 게시되면, `publish.py`가 표준 8필드 MethodConfig를 담은 `method_config` 블록을 주입해요. 이를 통해 마찰 없는 리더보드 설치가 가능해요 — 누구나 게시된 카드에서 바로 그 방법을 재현할 수 있어요.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

모든 필드는 **camelCase**를 사용하며 표준 MethodConfig 스키마를 따라요([Method 구축하기](/docs/network/specifications/methods) 참고).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Field | Type | Description |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | 시스템 프롬프트의 SHA-256 해시. 핑거프린트에 포함돼요 |
| `system_prompt_used` | `string` | 모델에 전송된 전체 시스템 프롬프트 텍스트 |

프롬프트 해시는 [핑거프린트](#fingerprint)의 일부예요. 다른 모든 설정이 일치하더라도 프롬프트가 다른 두 실행은 서로 다른 핑거프린트를 갖게 돼요.

---

## `fingerprint`

재현성 식별자예요. 핑거프린트가 동일한 두 실행은 같은 실험 설정을 사용한 거예요.

| Field | Type | Description |
|-------|------|-------------|
| `hash` | `string` | 정렬된 구성 요소들의 SHA-256 해시 |
| `components` | `object` | 해시된 입력 값들 |

### 핑거프린트 구성 요소

| Component | Description |
|-----------|-------------|
| `dataset_sha256` | 데이터셋 파일의 해시 |
| `model_slug` | 사용된 모델 |
| `condition` | 실험 조건 레이블 |
| `system_prompt_sha256` | 시스템 프롬프트의 해시 |
| `temperature` | 샘플링 temperature |
| `harness_version` | harness 버전 |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Run Card Hash]
fingerprint는 *실험 구성*을 식별해요. `run_card_hash`는 *결과 파일 무결성*을 검증해요. 자세한 내용은 [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash)를 참조하세요.
:::

---

## `scores`

전체 실행에 대한 집계 메트릭이에요.

### 최상위 점수

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | 평가된 총 항목 수 |
| `exact_matches` | `number` | 출력이 gold standard와 정확히 일치한 항목 수 |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | FST 분석기가 출력을 수용한 항목 수 |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). FST 분석기를 사용하지 않은 경우 `null` |
| `chrf_plus_plus` | `number` | 코퍼스 수준의 chrF++ 점수 (0–100) |
| `errors` | `number` | 실패한 항목 수(API 오류, 타임아웃 등) |
| `avg_latency_seconds` | `number` | 전체 항목의 평균 응답 시간 |
| `median_latency_seconds` | `number` | 중앙값 응답 시간 |
| `p95_latency_seconds` | `number` | 95번째 백분위수 응답 시간 |

### `by_difficulty`

난이도 등급별로 세분화된 점수예요. 각 키(정수 1–5)는 최상위 점수와 동일한 메트릭 필드를 담고 있어요.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

항목 출처별로 세분화된 점수예요. 각 키(예: `gold_standard`, `textbook`)는 동일한 메트릭 필드를 담고 있어요.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

전체 실행에 대한 토큰 사용량 및 비용 추적이에요.

| Field | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | `number` | 전체 API 호출의 총 입력 토큰 수 |
| `completion_tokens` | `number` | 총 출력 토큰 수 |
| `reasoning_tokens` | `number` | chain-of-thought 추론에 사용된 토큰 수(모델에 따라 다르며, 대부분의 모델에서는 0) |
| `cached_tokens` | `number` | 공급자의 프롬프트 캐시에서 제공된 토큰 수 |
| `total_cost_usd` | `number` | USD 기준 총 비용(API가 보고한 값) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

재현성을 위한 런타임 환경 메타데이터예요.

| Field | Type | Description |
|-------|------|-------------|
| `harness_version` | `string` | harness 버전(최상위 `harness_version`와 동일) |
| `harness_git_commit` | `string` | 실행 시점의 harness Git 커밋 SHA |
| `python_version` | `string` | Python 인터프리터 버전 |
| `sacrebleu_version` | `string` | sacrebleu 라이브러리 버전(chrF++ 채점에 사용) |
| `os` | `string` | 운영체제 식별자 |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

항목별 결과 배열이에요. 데이터셋 항목당 하나의 객체가 인덱스 순서로 들어 있어요.

| Field | Type | Description |
|-------|------|-------------|
| `entry_id` | `integer` | 코퍼스에서 이 항목의 ID(`entries[].id`와 일치) |
| `source` | `string` | 번역된 원본 텍스트 |
| `reference` | `string` | 코퍼스의 gold-standard 참조 |
| `predicted` | `string` | method의 실제 출력 |
| `exact_match` | `boolean` | 정규화 후 `predicted`이 `reference`와 정확히 일치하는지 여부 |
| `entry_chrf` | `number` | 이 항목의 문장 수준 chrF++ 점수 (0–100) |
| `fst_accepted` | `boolean \| null` | FST 분석기가 출력을 수용했는지 여부. 분석기가 구성되지 않은 경우 `null` |
| `fst_analysis` | `string[]` | 출력에 대한 FST 분석 문자열(분석되지 않았거나 거부된 경우 빈 배열) |
| `difficulty` | `integer` | 코퍼스의 난이도 등급 (1–5) |
| `provenance` | `string` | 코퍼스의 출처 태그 |
| `latency_seconds` | `number` | 이 개별 항목의 응답 시간 |
| `usage` | `object` | 항목별 토큰 사용량: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | 이 항목이 실패한 경우의 오류 메시지. 성공 시 `null` |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Field | Type | Description |
|-------|------|-------------|
| `run_card_hash` | `string` | 전체 run card JSON의 SHA-256 해시. 해싱 중에는 `run_card_hash` 필드 자체를 `""`로 설정해요 |

이것은 변조 탐지 봉인이에요. 리더보드는 제출 시 이 해시를 다시 계산하며, 일치하지 않는 card는 거부해요.

**해시 계산 방법:**

1. `run_card_hash`을 `""`로 설정한 상태로 run card를 JSON으로 직렬화해요
2. 직렬화된 문자열의 SHA-256을 계산해요
3. `run_card_hash`을 결과로 나온 16진수 다이제스트로 설정해요

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[항목별 상세 분석]
게시된 run card는 `run_card_entries` Supabase 테이블도 채우는데, 이 테이블은 리더보드에서 상세 분석을 위한 항목별 결과를 저장해요. 이 테이블은 `mt-eval publish` 중에 자동으로 채워져요.
:::

---

## 함께 보기

- [MT 평가](/docs/network/leaderboard/rules) — 개요, 리더보드 가치, 좋은/나쁜 method 가이드
- [Eval Harness](/docs/network/specifications/harness) — 평가를 실행하고 run card를 생성하는 방법
- [평가 데이터셋](/docs/network/leaderboard/datasets) — 데이터셋 형식, EDTeKLA, FLORES+
- [Method 구축하기](/docs/network/specifications/methods) — method 인터페이스와 method card 명세
- [Method 리더보드](https://champollion.dev/leaderboard) — 실시간 벤치마크 점수
- [Benchmark 명세](/docs/network/specifications/benchmark) — 평가 프로토콜, 코퍼스 형식, run card 스키마
- [Scoring 명세](/docs/network/specifications/scoring) — 메트릭, composite 가중치, 품질 등급에 대한 SSOT
