---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **핵심 요약.** 이 페이지에서는 MT 평가 하네스의 설치, 구성, 사용법을 다뤄요 — 표준화된 코퍼스에 대해 번역 방식을 벤치마킹하고 채점된 run card를 생성하는 도구예요. 지표, 스키마, 평가 프로토콜의 표준 정의는 [Benchmark Specification](/docs/network/specifications/benchmark)을 참고하세요.

이 하네스는 번역 실험을 실행하고 run card를 생성해요. 프롬프트 구성, API 호출, 채점, 결과 직렬화를 처리하며 — 데이터셋과 모델은 여러분이 제공해요.

## 설치

**요구 사항:** Python 3.10+

```bash
pip install mt-eval-harness
```

이 명령은 `mt-eval` 명령을 설치해요.

## 사용법

```bash
mt-eval run --corpus path/to/dataset.json
```

이 명령은 코퍼스의 모든 항목을 구성된 모델(또는 method 플러그인)에 통과시켜 출력을 채점하고, run card JSON 파일을 출력 디렉터리에 작성해요.

## CLI 플래그

### `mt-eval run`

| 플래그 | 필수 | 기본값 | 설명 |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | 코퍼스 파일 경로 (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | 병렬 텍스트 파일 (FLORES+, WMT 형식) |
| `-m, --model` | — | `gemini-pro` | 모델 슬러그 (짧은 이름 또는 전체 OpenRouter ID). `shared/model-aliases.json`을 통해 해석돼요. 다중 모델 실행 시 쉼표로 구분 |
| `-d, --dataset` | — | `all` | 데이터셋 필터: `all`, 세그먼트 이름, 또는 ID 범위 |
| `--ids` | — | — | 평가할 항목 ID를 쉼표로 구분 |
| `--source-lang` | — | `English` | 원본 언어 이름 |
| `--target-lang` | — | — | 대상 언어 이름 |
| `-p, --prompt` | — | `naive` | 프롬프트 버전 (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | 코칭 프롬프트 텍스트 파일 경로 |
| `--coaching` | — | — | 인라인 코칭 텍스트 (따옴표로 묶은 문자열) |
| `--method` | — | — | method 플러그인 디렉터리 경로 (`method.json` + Python 모듈 포함) |
| `--method-card` | — | — | 리더보드 메타데이터를 위한 method card JSON 경로 |
| `--fst-retries` | — | `0` | FST 재시도 횟수 (기본 LLM method 전용) |
| `--skip-fst` | — | `false` | FST 품질 게이트를 완전히 건너뛰기 |
| `--tools` | — | `false` | tool-calling 모드 활성화 |
| `--tools-list` | — | — | 도구 이름을 쉼표로 구분 |
| `--max-tool-rounds` | — | `8` | 항목당 최대 tool-calling 라운드 수 |
| `--hooks` | — | — | 번역 후 훅 이름 |
| `--style-profile` | — | — | 스타일 프로필 JSON 경로. 작문 스타일 일관성 지표를 활성화해요 (정보용 — 절대 복합 점수에 포함되지 않음; [§ 작문 스타일 및 register 지표](#writing-style-and-register-metrics-informational) 참고) |
| `-b, --batch-size` | — | `25` | API 호출당 항목 수 |
| `-c, --concurrency` | — | `8` | 병렬 API 호출 |
| `--max-tokens` | — | `32768` | API 호출당 최대 토큰 수 |
| `--temperature` | — | `0.0` | 샘플링 temperature (0.0 = 결정적) |
| `--no-cache` | — | `false` | 응답 캐싱 비활성화 |
| `--cache-dir` | — | `eval/cache/harness` | 캐시 디렉터리 경로 |
| `-o, --output-dir` | — | `eval/logs/harness` | run card 및 로그의 출력 디렉터리 |
| `-n, --name` | — | — | 사람이 읽을 수 있는 실행 이름 |
| `--dry-run` | — | `false` | API 호출 없이 구성 검증 |
| `--champollion-config` | — | — | `champollion.config.json` 경로 |
| `--champollion-cards-dir` | — | — | 언어 카드 디렉터리 |
| `--target-lang-code` | — | — | BCP-47 언어 코드 |

### 모든 하위 명령어

2026년 8월 1일에 `mt_eval_harness/cli.py`을(를) 기준으로 생성된 18개의 모든 최상위 하위 명령어예요.
그 전까지 이 섹션에는 7개만 나열되어 있었고, 주권적 주최자 채점 노드인
`node`을(를) 포함한 6개는 문서화되지 않았어요.
**이곳이나 harness 가이드 어디에도 말이죠**.

**실행 및 채점**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval run` | 번역 실행을 수행해요 (위의 플래그 참조) |
| `mt-eval test <log>` | 완료된 실행 로그를 분석해요 |
| `mt-eval compare <logs…>` | 여러 실행 로그를 비교해요 |
| `mt-eval dashboard <logs…>` | 대화형 HTML 대시보드를 생성해요 |
| `mt-eval card <run-card>` | 사람이 읽기 쉬운 실행 카드를 보기 좋게 출력해요 |

**메서드 찾기**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval recommend <src> <tgt>` | 언어 쌍에 대한 메서드 가이드예요. 단순한 순위가 아닌 가용성과 **인용된 근거**를 제공해요 |
| `mt-eval corpora --source X --target Y` | 특정 언어 쌍에 사용 가능한 평가 말뭉치(eval corpora) 목록을 표시해요 |
| `mt-eval list models\|prompts\|datasets` | 사용 가능한 리소스 목록을 표시해요 |

**기여하기**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval publish <report>` | 리더보드에 TestReport를 제출해요 |
| `mt-eval queue` | 본인의 키를 사용하여 커뮤니티 컴퓨팅 대기열의 최상위 작업을 실행해요 — [컴퓨팅 기여하기](/docs/network/getting-started/contributing-compute)를 참조하세요 |
| `mt-eval export` | TestReport를 champollion 메서드 플러그인으로 패키징해요 |
| `mt-eval generate-plugin` | `export`의 별칭(Alias)이에요 |
| `mt-eval export-config` | TestReport에서 `champollion.config.json` 스니펫을 생성해요 |

**콘테스트 및 직접 개최하기**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval contest` | 평가 콘테스트를 관리해요 — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | 다중 언어 쌍 공유 작업 에디션의 포괄적 관리(umbrella) 기능이에요. 하나의 행이 AmericasNLP 스타일 에디션의 언어 쌍별 N개 콘테스트를 그룹화하고 기본 정책을 전달해요. **그룹화 및 기본값 설정만 수행하며, 모든 게이트는 콘테스트별로 유지돼요** |
| `mt-eval node` | **주최자 채점 노드예요.** 접수 내역을 폴링하고, 공개 예선(public qualifier)에서 게이트를 통과시키며, 콘테스트 정책에 따라 승인하고, **주최자가 보유한 비밀 참조(secret references)**를 바탕으로 채점한 뒤 점수만 게시해요. 이 명령어는 [주권적 콘테스트 개최하기](/docs/network/sovereignty/run-a-sovereign-contest) 및 [주권적 평가 노드](/docs/network/sovereignty/sovereign-eval-node)의 기반이 되며, 말뭉치는 주최자의 머신 외부로 절대 유출되지 않아요 |

`mt-eval node`에는 에어갭 레인(airgap lane)
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) 및
M-of-N 보관 세리머니 (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`)를 포함하여 17개의 자체 하위 명령어가 있어요. `mt-eval node --help`을(를) 실행해 보세요. 주권
메커니즘은 위에 링크된 두 페이지에 설명되어 있어요.

**설정**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval setup` | 선택적 종속성(COMET 신경망 지표, FST 런타임)을 설치해요 |
| `mt-eval logout` | 저장된 인증 자격 증명을 제거해요 |

### 예시

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Run Card 스키마

모든 실험은 **run card**를 생성해요 — 자체 완결형 JSON 문서예요. 최상위 구조는 다음과 같아요:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

모든 필드가 문서화된 전체 스키마는 [Run Card Specification](/docs/network/specifications/run-card)을 참고하세요.

:::info[Authoritative Schema]
[Benchmark Specification](/docs/network/specifications/benchmark)은 run card 스키마에 대한 단일 진실 공급원이에요. 메트릭 정의, 복합 가중치, 품질 등급에 대해서는 [Scoring Specification](/docs/network/specifications/scoring)을 참조하세요. 이 페이지는 harness 사용 방법을 설명하며, 스펙은 출력이 무엇을 의미하는지 정의해요.
:::

### 주요 블록

**`dataset`** — 결과가 특정 버전에 연결되도록 콘텐츠 해시를 포함해 어떤 데이터셋이 사용되었는지 식별해요:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — 실행에 대한 집계 지표:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — 토큰 사용량 및 비용 추적:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## 작문 스타일 및 register 지표 (정보용) {#writing-style-and-register-metrics-informational}

하네스는 `WritingStyleConsistency` 지표 플러그인(`mt_eval_harness/plugins/writing_style.py`)을 통해 번역이 대상 **register**와 **작문 스타일**에 부합하는지 평가할 수 있어요. 번역이 언어학적으로 정확하더라도 잘못된 register일 수 있는데 — 법률 문서의 비격식 표현, 마케팅 문구의 격식적 상용구 등 — 문자열 지표로는 이를 감지하지 못해요. 이 지표들은 감지해요.

**측정 대상 (항목당):**

| 지표 | 척도 | 의미 |
|--------|-------|---------|
| `style_register_match` | 불리언 | 출력이 예상 register와 일치하나요? 대상은 코퍼스 항목의 `register` 필드([Benchmark Spec §2.6](/docs/network/specifications/benchmark) 참고) 또는 스타일 프로필에서 가져와요 |
| `style_sentence_length_ratio` | 부동소수점 | 예측 대비 참조 평균 문장 길이 (1.0 = 일치; 편차 = 스타일 드리프트) |
| `style_formality_score` | 0.0–1.0 | 언어별 마커 리소스를 사용한 격식/비격식 마커(T–V 대명사, 축약형 등)의 존재 여부 |

**집계:** `style_consistency_rate` — register 불일치가 감지되지 않은 항목의 비율이에요.

`--style-profile path/to/profile.json`로 사용자 정의 대상을 활성화하세요 (예: 브랜드 보이스 프로필); 지정하지 않으면 플러그인은 각 코퍼스 항목의 `register` 메타데이터가 있을 경우 이를 대체로 사용해요.

:::caution[정직한 범위 설정]
이 메트릭은 **정보 제공용일 뿐이에요** — 복합 점수의 일부가 되는 경우는 절대 없으며, 격식 감지는 학습된 판단이 아니라 마커 기반(휴리스틱)이에요. 스타일 품질에 대한 판정이 아니라 register 준수에 대한 드리프트 감지기로 다뤄주세요.
:::

---

## Fingerprint 대 Run Card 해시 {#fingerprint-vs-run-card-hash}

하네스는 두 개의 서로 다른 해시를 생성해요. 이들은 서로 다른 목적을 수행해요:

### Fingerprint

**fingerprint**는 다음에 답해요: *"이 실행을 재현할 수 있나요?"*

이는 출력이 아니라 — 실험 구성을 정의하는 입력의 조합을 해시해요:

- 데이터셋 SHA-256
- 모델 슬러그
- Condition 레이블
- 시스템 프롬프트 SHA-256
- Temperature
- 하네스 버전

동일한 fingerprint를 가진 두 실행은 동일한 설정을 사용한 거예요. 그 결과는 (API 비결정성을 제외하면) 비교 가능해야 해요.

### Run Card 해시

**run card 해시**는 다음에 답해요: *"이 특정 결과 파일이 변조되었나요?"*

이는 전체 run card JSON(`run_card_hash` 필드 자체는 제외)의 SHA-256이에요. 점수, 타임스탬프, 단일 출력 등 어떤 필드라도 변경되면 해시가 깨져요.

:::info[언제 무엇을 사용할지]
비교 가능한 실행들(같은 실험, 다른 실행)을 그룹화하려면 **fingerprint**를 사용하세요. 특정 결과 파일의 무결성을 검증하려면 **run card hash**를 사용하세요.
:::

---

## 리더보드에 게시하기

실행을 완료한 후 `mt-eval publish`을 사용해 run card를 제출하세요:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

실행 중 `--method-card`이 제공되지 않았다면, `mt-eval publish`은 대화형 마법사(`method_card_wizard.py`)를 실행해 method를 설명하는 과정(이름, 클래스, 사용된 도구 등)을 안내해요. 마법사 출력은 제출 전 run card에 포함돼요.

### 수동 검사

Run card는 출력 디렉터리(기본값 `eval/logs/harness/`)에 JSON 파일로 저장돼요 — 게시하기 전에 거기서 검사하세요. `mt-eval publish`이 제출 경로이며, PR 기반 run-card 접수는 없어요.

:::note[제출 API와 웹 업로드는 아직 활성화되지 않았어요]
`POST https://champollion.dev/api/leaderboard/submit` 엔드포인트와 Leaderboard 업로드 UI가 계획되어 있지만 **아직 구현되지 않았어요**. 출시되기 전까지 유일하게 작동하는 제출 경로는 `mt-eval publish`이에요.
:::

:::warning[Leaderboard 검증]
leaderboard는 제출된 run card를 데이터셋 레지스트리와 대조하여 검증해요. 알 수 없는 데이터셋을 참조하거나 손상된 `run_card_hash`을 가진 제출은 거부돼요.
:::

:::danger[평가 데이터로 학습하지 마세요]
개발 과정에서 여러분의 방법이 평가 데이터셋을 본 적이 있다면 — 학습 데이터, few-shot 예제, 사전 항목, 또는 프롬프트 엔지니어링 자료로서 — 여러분의 제출은 **실격 처리**돼요. 좋은 방법과 나쁜 방법을 구분하는 기준에 대해서는 [MT Evaluation](/docs/network/leaderboard/rules)을 참조하세요.
:::

---

## 참고 항목

- [MT Evaluation](/docs/network/leaderboard/rules) — 개요, 리더보드 가치 제안, 좋은/나쁜 method 지침
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — 데이터셋 형식, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — 전체 JSON 스키마
- [Building a Method](/docs/network/specifications/methods) — 평가 가능한 method를 만들기 위한 method 인터페이스
- [Method Leaderboard](https://champollion.dev/leaderboard) — 실시간 벤치마크 점수
- [Benchmark Specification](/docs/network/specifications/benchmark) — 평가 프로토콜, 코퍼스 형식, run card 스키마
- [Scoring Specification](/docs/network/specifications/scoring) — 지표, 복합 가중치, 품질 등급의 SSOT
