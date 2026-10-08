---
sidebar_position: 4
title: "Run Card 명세"
---

# Run Card 명세

> **핵심 요약.** Run card는 벤치마킹의 최소 단위로, 하나의 평가 실행에 대한 전체 구성, 항목별 결과, 집계 점수를 기록하는 JSON 문서예요. 이 페이지에서는 스키마, 필드, 핑거프린팅 메커니즘, 점수 구조를 설명해요. 표준 정의는 [Benchmark 명세](/docs/network/specifications/benchmark)를 참고하세요.

Run card는 단일 평가 실행의 완전한 기록이에요. 실험을 이해하고, 재현하고, 검증하는 데 필요한 모든 것(구성, 점수, 개별 결과, 토큰 사용량, 환경 메타데이터)을 담고 있어요.

**스키마 버전:** 2.0

:::info[공식 스키마]
[벤치마크 사양](/docs/network/specifications/benchmark)은 실행 카드 스키마의 단일 진실 공급원(SSOT)이에요. 지표 정의 및 실행 점수 산정 방식(chrF++ 헤드라인, 함께 표시되는 표준 지표, 진단 지표)에 대해서는 [점수 산정 사양](/docs/network/specifications/scoring)을 참조하세요. 이 페이지에서는 현재 구현 방식을 다뤄요.
:::

---

## 최상위 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `run_id` | `string` | 실행 시작 시 생성된 UUID v4 |
| `harness_version` | `string` | 이 카드를 생성한 하네스의 시맨틱 버전 (예: `2.0`) |
| `model_slug` | `string` | 실행에 사용된 모델 슬러그 (예: `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | API가 반환한 확인된(resolved) 모델 식별자 (예: `gemini-3.1-pro-001`) |
| `condition` | `string` | 실험 레이블: 하네스가 기록하는 값은 `naive`(기본 내장 프롬프트), `coached`(코칭 파일로 대체됨) 또는 메서드 플러그인의 경우 메서드 클래스예요. 자유 형식 텍스트이므로 직접 작성한 카드에는 `coached-v3`나 `few-shot`가 적혀 있을 수도 있어요. 품질 레이블이 아니에요(품질 티어는 폐지되었으며, 모든 새 카드에서 `scores.quality_tier`는 null이에요). |
| `timestamp` | `string` | 실행이 시작된 ISO 8601 UTC 타임스탬프 |
| `elapsed_seconds` | `number` | 전체 실행의 경과 시간(Wall-clock duration) |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `api_provider` | `string` | 텍스트를 전달한 주체: 하네스 자체 LLM 경로의 API 제공업체(`openrouter`, `openai`, `anthropic`, `gemini`, `local`), MT 엔진의 엔진 ID(예: `google-translate`), 메서드 플러그인의 경우 운영자가 완전한 로컬 전송을 인증했을 때(`--attest-local-transport`)는 `local`, 그렇지 않으면 `method-plugin` |
| `temperature` | `number` | 샘플링 온도 |
| `max_tokens` | `number` | 완성(completion)당 최대 토큰 수 |
| `batch_size` | `number` | 동시 배치당 항목 수 |
| `concurrency` | `number` | 최대 병렬 API 요청 수 |
| `coaching_file` | `string` | 사용된 경우 코칭 프롬프트 파일 경로 (실행 로그 자체의 기록이며, 게시된 카드는 코칭을 파일 이름으로 명시하거나 `--coaching` 텍스트의 경우 `inline coaching`로 표기해요 — 로컬 경로는 절대 포함되지 않아요) |
| `method_path` | `string` | 사용된 경우 메서드 플러그인 디렉터리 경로 |
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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

새 카드에서 `qualityTier`는 항상 `null`이에요. 품질 티어는 폐지되었어요. 모든 필드는 **camelCase**를 사용하며 표준 MethodConfig 스키마를 따라요([메서드 구축하기](/docs/network/specifications/methods) 참조).
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

표준 목록은 [벤치마크 사양 §3.8](/docs/network/specifications/benchmark#38-fingerprint)에 나와 있어요. 요약하자면 다음과 같아요:

| 구성 요소 | 설명 |
|-----------|-------------|
| `dataset_sha256` | 데이터셋 파일의 해시 |
| `model_slug` | 사용된 모델 (MT 엔진 또는 메서드 플러그인의 경우 엔진 또는 메서드 ID) |
| `condition` | 실험 조건 레이블 |
| `system_prompt_sha256` | 시스템 프롬프트의 해시 |
| `temperature` | 샘플링 온도 |
| `batch_size`, `tools_enabled` | 배치 처리 및 도구 사용 |
| `harness_version` | 하네스 버전 |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | 버전 2(하네스 0.2.0 이상): 채널, 엔드포인트 호스트(해시됨), 토큰 제한, 메서드의 버전 및 코드 해시 |
| `method_model`, `method_dependencies_sha256` | 버전 2, 메서드 플러그인 실행 전용: 플러그인에 전달된 모델(`-m`) 및 선언된 `dependencies`의 해시 |
| `method_model`, `method_model_sha256` | 버전 2, `--method local-model` 실행 전용: 로드된 모델(Hugging Face ID 또는 디렉터리 이름) 및 해당 콘텐츠 해시(디렉터리인 경우) 또는 리비전(Hugging Face ID인 경우) |

`fingerprint.version`는 카드가 어떤 목록을 기준으로 해시되었는지를 나타내요.

### `engine_model`

전달받은 모델을 실행하는 MT 엔진의 실행(`--method local-model -m <model>`)에는 로드된 모델 정보가 포함돼요:

| 필드 | 설명 |
|-------|-------------|
| `given` | `-m`에 지정된 내용 |
| `kind` | `directory` 또는 `hub` (Hugging Face ID) |
| `id` | Hugging Face ID 또는 디렉터리 이름 (로컬 경로는 절대 포함되지 않음) |
| `sha256` | 디렉터리에만 해당: 파일들의 `sha256sum` 스타일 목록에 대한 SHA-256 |
| `revision` | Hugging Face ID에만 해당: 로드된 리비전 |
| `family`, `backend` | `opus`, `nllb` 또는 `madlad`, 그리고 `transformers` 또는 `ctranslate2` |
| `decode` | 출력이 가질 수 있는 최대 길이: 모델이 선언한 길이 또는 하네스 규칙(디코더 포지션 수로 제한되는 `max(64, 4 × source tokens)` 새 토큰) |
| `pair_mismatch` | 다른 언어 쌍용 OPUS-MT 페어 모델을 의도적으로 실행했을 때만 존재함(`--allow-model-pair-mismatch`) |

`method_config.model`는 동일한 모델을 지정해요(`<id>@<revision>` 또는 `<directory name>@sha256:<hash>`). 모델이 기록되지 않은 `local-model` 실행 로그는 아무것도 게시하지 않아요. 즉, 카드에 `engine_model_unrecorded`로 표시되며 `mt-eval publish`가 이를 거부해요.

### `method_plugin`

메서드 플러그인 실행(`--method <plugin dir>`)에는 러너가 기록한 플러그인 식별 정보도 포함돼요:

| 필드 | 설명 |
|-------|-------------|
| `version` | `method.json`가 선언하는 버전 (선언하지 않은 경우 `null`) |
| `code_sha256` | 플러그인 파일들에 대한 SHA-256 (`method.json` 및 해당 `.py` 파일, `sha256sum` 스타일 매니페스트) |
| `model_given` | `-m/--model` 옵션으로 플러그인에 전달된 모델 또는 `null` |
| `models_called`, `models_basis` | 플러그인이 호출했다고 보고한 모델 및 이것이 결과에서 관찰되었는지 아니면 선언되었는지 여부 |
| `dependency_class` | `method.json`가 선언하는 종속성 클래스 |
| `dependencies` | 자유 텍스트 `notes`를 제외하고 `method.json`가 선언하는 `dependencies` 목록 |
| `dependencies_sha256` | 선언된 전체 목록의 SHA-256 (지문 구성 요소) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `total` | `number` | 평가된 총 항목 수 |
| `exact_matches` | `number` | 출력이 기준 정답(gold standard)과 정확히 일치한 항목 수 |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | 모든 항목에 걸쳐 합산된 FST 분석기가 수락한 출력 **단어 수**(항목 수가 아님). FST 분석기를 사용하지 않은 경우 `null` |
| `fst_acceptance_rate` | `number` | 항목별 수락률의 평균(각 항목의 수락 단어 ÷ 해당 항목의 전체 단어, 빈 출력은 0으로 계산), 0.0–1.0. `fst_accepted` ÷ 전체 단어가 **아닙니다**. 그 풀링된 단어 비율은 보고서의 `corpus_validity_rate`이며, 실행 카드에는 "Words accepted"로 표시돼요. FST 분석기를 사용하지 않은 경우 `null` |
| `chrf_plus_plus` | `number` | **헤드라인 및 순위 산정 지표:** 코퍼스 수준의 chrF++(sacreBLEU chrF, `word_order=2`), 0–100. 95% 부트스트랩 신뢰구간은 `confidence_intervals.corpus_chrf`이고 시그니처는 `sacrebleu_signatures.chrf`이에요 |
| `scoring_standard` | `string` | 모든 새 카드에서 `"standard/1"`. 이것이 없는 카드는 폐지된 복합 점수(`legacy-composite`)로 채점되었으며 해당 방식으로 검증돼요 |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | chrF++ 옆에 나란히 표시되는 표준 지표로, 결코 혼합되지 않음(BLEU는 카드의 최상위 `corpus_bleu`, COMET은 계산된 경우 `comet_model`를 포함한 `comet_score`) |
| `sacrebleu_signatures` | `object` | 계산된 각 sacreBLEU 지표의 sacreBLEU 시그니처: `chrf`(헤드라인), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | 95% 부트스트랩 구간. `corpus_chrf`는 헤드라인의 구간임 |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **폐지됨.** 새 카드에서는 항상 `null`. 레거시 카드는 저장된 값을 유지하며, 여전히 복합 점수를 표시하는 영역에서는 "레거시 복합 지표 (폐지됨)"으로 레이블을 지정함 |
| `errors` | `number` | 실패한 항목 수 (API 오류, 타임아웃 등) |
| `avg_latency_seconds` | `number` | 모든 항목에 대한 평균 응답 시간 |
| `median_latency_seconds` | `number` | 응답 시간 중앙값 |
| `p95_latency_seconds` | `number` | 응답 시간 95백분위수 |

### `by_difficulty`

난이도 티어별로 세분화된 점수이며 티어별로 키가 지정돼요(`"1"`–`"5"`, 미분류는 `"0"`). 이 필드들은 최상위 필드와 **다릅니다**. `avg_chrf`와 `avg_bleu`는 해당 티어 항목들에 대한 chrF++ 및 BLEU의 **문장별 평균**인 반면, 최상위 `chrf_plus_plus`와 BLEU는 **코퍼스 수준**(모든 세그먼트에 대해 한 번에 계산됨)이에요. 두 수치는 서로 다른 통계량이에요. 특히 코퍼스 BLEU는 대개 문장 BLEU 평균보다 훨씬 낮으므로, 10.2라는 티어 값 옆에 0.5 헤드라인이 표시되어도 모순이 아니에요. 티어끼리만 비교하고, 헤드라인과 비교해서는 안 돼요.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

점수의 의미가 제한될 때만 표시돼요. 점수가 올바르게 계산되었더라도 해당 레이블이 나타내는 바를 제대로 측정하지 못할 수 있으므로, 단서 조항(qualification)이 수치와 함께 전달돼요. `mt-eval test`, `mt-eval card`, `mt-eval compare`, 대시보드 및 `mt-eval publish` 미리보기에서는 이를 헤드라인 옆에 출력하고, 리더보드에 표시될 수 있도록 `publish`가 여기에 저장해요.
점수 자체는 절대 변경되지 않아요. chrF++ 헤드라인은 평소대로 계산되며, 주의사항(caveat)은 헤드라인이나 그 옆의 진단 지표를 제한하는 요소가 무엇인지를 명시해요.

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` 또는 `near_constant_output` |
| `source` | `string` | 측정한 주체: `nmt-forge` 또는 `mt-eval-harness` |
| `severity` | `string` | `major` (이를 감안하여 헤드라인 해석) 또는 `minor` |
| `message` | `string` | 한 문장, 최대 480자 |

**`train_test_near_twin`**: nmt-forge가 작성해요. `nmt-forge export`(또는 `evaluate`)가 모델을 채점할 때, 모든 테스트 행에 대해 학습 데이터 내 거의 동일한 쌍둥이(twin) 데이터가 있는지 확인하고 그 결과를 작성하는 mt-eval 파일에 기록해요.
하네스는 해당 측정값을 카드에 복사해요. 즉, `n`개 테스트 행 중 `near_twin_rows`개에 쌍둥이가 존재하고(`near_twin_share`), `strict_n`개 행에는 없어요.
해당 행이 충분히 많다면, `strict_corpus_chrf`와 `strict_corpus_chrf_ci`는 이들만을 대상으로 한 chrF++를 제공하며 이것이 바로 일반화 수치예요.
테스트 행의 절반 이상에 쌍둥이가 있으면 `recall_not_translation`는 `true`가 돼요.
이 경우 chrF++가 100이라 해도 이는 모델이 번역을 얼마나 잘하는지가 아니라 학습 구문을 얼마나 잘 기억해 내는지를 측정한 것에 불과해요. forge의 검사가 실행되지 않은 경우 caveat은 `minor`가 되며 해당 내용이 명시돼요. 쌍둥이가 발견되지 않은 검사에서는 주의사항이 추가되지 않아요.

**`length_inflation`**: 하네스가 측정해요. 출력이 참조 번역 길이의 평균 2배를 초과하거나([`length_ratio`](/docs/network/specifications/scoring)의 팽창 한계), 채점된 항목 중 최소 4분의 1이 이 한계를 초과할 때 추가돼요. 유출된 퓨샷(few-shot) 예시, 메모 또는 반복된 텍스트는 출력을 부풀리며, 참조 기반 점수는 결국 이를 측정하게 돼요.
필드는 `mean_length_ratio`, `scored_entries` 중 `inflated_entries`, `ratio_bound`, `share_bound`이에요.

**`length_deflation`**: 하네스가 측정해요. 이는 `length_inflation`의 반대 현상이에요. 즉, 출력이 참조 번역보다 훨씬 **짧아서** 단어가 누락된 경우예요. 출력이 참조 번역 길이의 평균 0.5배 미만이거나([`length_ratio`](/docs/network/specifications/scoring)의 잘림 한계), 채점된 항목 중 최소 4분의 1이 이 한계에 해당할 때 추가돼요.
FST 수락률 및 코드 스위칭과 같은 일부 진단 지표는 출판물에 포함된 단어만을 판별해요. 번역할 수 없는 부분을 누락시키는 시스템은 이러한 수치를 높이게 돼요. 해당 실행에 이러한 지표 중 하나가 포함되어 있다면 caveat은 `major`가 되며, 모든 것을 번역하는 실행과 비교하여 이를 품질 지표로 해석해서는 안 된다고 안내해요. chrF++ 헤드라인은 재현율에 가중치를 두므로 누락된 단어를 반영해요. 두 지표가 모두 없는 경우(chrF++ 및 완전 일치만 있는 경우), 이는 `minor` 참고 사항이 돼요. 필드는 `mean_length_ratio`, `scored_entries` 중 `short_entries`, `ratio_bound`, `share_bound`, `emitted_only_metrics`예요.

**`source_copy`**: 하네스가 측정해요. 채점된 출력의 절반 이상이 원문의 복사본일 때(대소문자, 악센트, 문장 부호 무시) 추가돼요. 인명처럼 참조 번역 자체가 원문인 행은 제외돼요. 참조 번역과 비교하지 않는 지표는 복사된 단어에도 점수를 부여할 수 있어요. 필드는 `considered_entries` 중 `copies`, `copy_share`, `share_bound`이에요.

**`near_constant_output`**: 하네스가 측정해요. 서로 *다른* 여러 입력에 대해 동일한 단일 출력이 생성된 경우예요. 대소문자, 문장 부호, 공백을 무시하고 출력과 원문을 비교해요. 발음 구별 부호(diacritics)는 두 출력 간에 단어를 구분해주므로 계산에 포함돼요. 최소 3개의 서로 다른 원문이 해당 출력을 생성한 경우 교차 원문 반복(cross-source repeat)으로 간주해요(단어 수가 1~2개인 경우 짧은 응답이 자연스럽게 반복될 수 있으므로 5개 기준). 참조 번역과 동일한 출력은 정답이므로 계산되지 않아요. 반복이 고유 원문의 4분의 1 이상을 차지하고 최소 5개 이상일 때 주의사항이 추가돼요. 이는 항상 `major`예요. 실행에 참조 번역 없이 출력을 평가하는 지표(FST 수락률, 코드 스위칭)가 포함된 경우 메시지에 해당 지표가 명시돼요. 이러한 지표는 올바른 문장이 나타날 때마다 점수를 부여하기 때문이에요. 필드는 `considered_sources` 중 `repeated_sources`, `repeat_share`, `repeated_outputs`, `top_output_sources`, `top_output_words`(가장 많이 반복된 출력: 얼마나 많은 원문이 이를 받았는지 및 해당 길이), `share_bound`, `min_repeats`, `min_sources`, `min_sources_short`, `emitted_only_metrics`이에요.
이 값들은 개수일 뿐이며 주의사항에는 출력 텍스트가 절대 포함되지 않아요.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

이 필드는 저장된 실행 카드 JSON 내에 위치하므로 데이터베이스 컬럼이 필요하지 않아요. [지문](#fingerprint)의 일부가 아니에요. 실험이 아니라 결과를 설명하기 때문이에요.

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

## 참고 항목

- [기계 번역 평가](/docs/network/leaderboard/rules) — 개요, 리더보드 가치, 올바른/부적절한 메서드 가이드
- [평가 하네스](/docs/network/specifications/harness) — 평가 실행 및 실행 카드 생성 방법
- [평가 데이터셋](/docs/network/leaderboard/datasets) — 데이터셋 형식, EDTeKLA, FLORES+
- [메서드 구축하기](/docs/network/specifications/methods) — 메서드 인터페이스 및 메서드 카드 사양
- [메서드 리더보드](https://champollion.dev/leaderboard) — 실시간 벤치마크 점수
- [벤치마크 사양](/docs/network/specifications/benchmark) — 평가 프로토콜, 코퍼스 형식, 실행 카드 스키마
- [점수 산정 사양](/docs/network/specifications/scoring) — 지표 및 실행 점수 산정 방식에 대한 SSOT
