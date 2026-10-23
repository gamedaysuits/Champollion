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
    to: https://champollion.dev/docs/getting-started/configuration
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **핵심 요약.** 이 페이지에서는 MT 평가 하네스의 설치, 구성, 사용법을 다뤄요 — 표준화된 코퍼스에 대해 번역 방식을 벤치마킹하고 채점된 run card를 생성하는 도구예요. 지표, 스키마, 평가 프로토콜의 표준 정의는 [Benchmark Specification](/docs/network/specifications/benchmark)을 참고하세요.

이 하네스는 번역 실험을 실행하고 run card를 생성해요. 프롬프트 구성, API 호출, 채점, 결과 직렬화를 처리하며 — 데이터셋과 모델은 여러분이 제공해요.

## 설치

**요구 사항:** Python 3.11+

```bash
python3 -m pip install mt-eval-harness
```

이 명령은 `mt-eval` 명령을 설치해요.

## 사용법

```bash
mt-eval run --corpus path/to/dataset.json
```

이 명령은 코퍼스의 모든 항목을 구성된 모델(또는 method 플러그인)에 통과시켜 출력을 채점하고, run card JSON 파일을 출력 디렉터리에 작성해요.

## CLI 플래그

### `mt-eval run`

| 플래그 | 필수 여부 | 기본값 | 설명 |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | 말뭉치 파일 경로 (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | 병렬 텍스트 파일 (FLORES+, WMT 형식) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | 정확한 모델 슬러그: 전체 OpenRouter id 또는 직접 제공자의 정확한 자체 이름. 별칭이나 유동적 id(`~vendor/…`, `…-latest`)는 허용되지 않아요. `gemini-pro` 같은 짧은 이름은 거부되며, 거부 메시지에 입력해야 할 슬러그가 안내돼요. 다중 모델 실행 시 쉼표로 구분해요. `--method local-model`의 경우 실행할 모델(Hugging Face id 또는 모델 디렉터리)이며 필수예요. 해당 엔진에는 기본 모델이 없어요. 메서드 플러그인의 경우 플러그인에 `config.method_model`(으)로 전달돼요. 다른 MT 엔진은 자체 모델로 번역하며 실행 시 `-m`은 사용되지 않았다고 표시돼요 |
| `-d, --dataset` | — | `all` | 데이터셋 필터: `all`, 세그먼트 이름 또는 ID 범위 |
| `--ids` | — | — | 평가할 항목 ID(쉼표로 구분) |
| `--source-lang` | — | `English` | 출발어 언어 이름 |
| `--target-lang` | — | — | 프롬프트에 표시되는 도착어 언어 이름. 여기에 입력된 코드(`sme`)는 해당 언어 카드에 지정된 이름("Northern Sami")으로 지정되며 실행 헤더에 그렇게 표시돼요. 어떤 카드에도 지정되지 않은 코드(개인용 `qaa`)는 프롬프트에 그대로 전달된다는 경고와 함께 코드로 유지돼요 |
| `-p, --prompt` | — | `naive` | 프롬프트 버전 (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | 코칭 프롬프트 텍스트 파일 경로. 내장 프롬프트를 **대체**해요. 모델은 내장된 "Translate the given … text to …; output only the translation" 지시 대신 파일에 작성된 내용(및 `--target-script` 줄)을 그대로 전달받아요. 시험 실행과 실행 헤더에서 이를 하나의 판정으로 알려줘요. 파일에 도착어 언어가 명시되어 있으면(어떤 이름이나 코드인지와 함께) ✓, 언어나 코드 모두 명시되어 있지 않으면 ⚠, 이름이나 코드를 알 수 없으면 확인 안 됨으로 표시돼요 |
| `--glossary` | — | — | 용어 일관성을 위한 평가용 용어집(JSON). 점수 계산에만 사용되며 모델에는 절대 전송되지 않아요 |
| `--coaching` | — | — | 인라인 코칭 텍스트(따옴표로 묶은 문자열) |
| `--method` | — | — | 메서드 플러그인 디렉터리 경로(`method.json` + Python 모듈 포함) 또는 등록된 MT 엔진(`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | `--method local-model` 사용 시: id가 말뭉치와 다른 언어 쌍을 가리키는 OPUS-MT 쌍 모델을 실행해요(관련 언어 기준선으로 `eng>sme` 말뭉치에서 `opus-mt-en-fi` 실행). 이 플래그가 없으면 거부되며, 실행 카드에 기록돼요 |
| `--method-card` | — | — | 리더보드 메타데이터용 메서드 카드 JSON 경로 |
| `--skip-fst` | — | `false` | 언어에 FST가 있더라도 FST 수용도를 계산하지 않고 점수를 매기며, 추가 안내를 표시하지 않아요. 실행 카드에는 계산되지 않음으로 표시돼요. 이 플래그가 없더라도 FST(분석기 또는 pyhfst 런타임)가 누락되어도 실행이 중단되지 않아요. 실행은 계속되고 실행 카드에 FST 수용도 및 형태론이 계산되지 않음으로 표시되며 안내 메시지에 `mt-eval setup --lang <code>`이(가) 명시돼요. 설치 후에는 `mt-eval test <run log>`을(를) 통해 다시 번역하지 않고도 완료된 실행에 FST 점수를 추가할 수 있어요. 자동으로 다운로드되는 것은 없어요 |
| `--skip-eval-standard` | — | `false` | 언어 카드의 평가 표준 지표(외부 패키지) 없이 점수를 매겨요. 실행 카드에는 계산되지 않음으로 표시돼요. 이 플래그가 없으면 설치된 패키지의 지표가 계산돼요. 설치되지 않은 패키지는 선택적 추가 항목으로 취급되어, 해당 지표 없이(계산되지 않음으로 표시) 실행이 계속되고 카드에 선언된 `python3 -m pip install`이(가) 안내돼요. 실행 시 아무것도 자동 설치되지 않아요 |
| `--tools` | — | `false` | 도구 호출 모드 활성화 |
| `--tools-list` | — | — | 쉼표로 구분된 도구 이름 목록 |
| `--max-tool-rounds` | — | `8` | 항목당 최대 도구 호출 횟수 |
| `--style-profile` | — | — | 스타일 프로필 JSON 경로. 문체 일관성 지표를 활성화해요(진단용이며 대표 점수에는 포함되지 않아요. [§ 문체 및 레지스터 지표](#writing-style-and-register-metrics-informational) 참조) |
| `-b, --batch-size` | — | `25` | API 호출당 항목 수 |
| `-c, --concurrency` | — | `8` | 병렬 API 호출 수 |
| `--max-tokens` | — | `32768` | API 호출당 최대 토큰 수 |
| `--temperature` | — | `0.0` | 샘플링 온도(0.0 = 결정론적) |
| `--no-cache` | — | `false` | 응답 캐싱 비활성화 |
| `--cache-dir` | — | `eval/cache/harness` | 캐시 디렉터리 경로 ([번역 캐시](#the-translation-cache) 참조) |
| `--metricx` | — | `false` | 낮을수록 좋은 신경망 오류 점수(0–25)인 MetricX-24(Google, Apache-2.0)도 함께 계산해요. chrF++ 대표 점수 옆에 보고되며 결코 합산되지 않아요. `metricx` 엑스트라와 Google의 모델 코드가 필요해요([선택적 신경망 지표](#opt-in-neural-metrics) 참조) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | `--metricx` 사용 시: 다른 MetricX 체크포인트(xl/xxl 체크포인트 또는 `google/metricx-25-*` 체크포인트) 지정 |
| `--fuse` | — | `false` | AmericasNLP 2025 FUSE 접근 방식의 미학습 재구현체인 FUSE 스타일 비교기도 함께 계산해요. 진단용 비교기로 보고되며 대표 점수에는 포함되지 않아요. `fuse` 엑스트라가 필요해요([선택적 신경망 지표](#opt-in-neural-metrics) 참조) |
| `-o, --output-dir` | — | `eval/logs/harness` | 실행 카드 및 로그 출력 디렉터리 |
| `-n, --name` | — | — | 사람이 읽을 수 있는 실행 이름 |
| `--dry-run` | — | `false` | API를 호출하지 않고 설정과 말뭉치를 검증해요. 실행에서 사용할 코칭 파일과 용어집(또는 `none`)을 명시하고, 프롬프트(내장 프롬프트는 전문, 코칭 파일은 첫 줄과 sha256 및 내장 프롬프트를 대체한다는 사실)를 보여주며, 번역 캐시 위치를 알려주고, 실제 실행에서 수행하는 것과 동일한 eval-pack 검사를 오류 없이 실행하여 `EVAL PACK:`(`ready (…)`, `missing — <pieces>; …` 또는 `none needed for <language>`)(으)로 시작하는 줄에 보고해요. 두 번째 줄에는 실제 실행이 중단될지 여부가 표시돼요. FST 누락은 실행을 중단시키지 않지만, 다른 구성 요소가 누락되면 중단돼요. `--json` 아래 요약에는 `coaching_file`, `prompt`(종류, sha256 및 길이, 내장 프롬프트 텍스트), `glossary_file`, `eval_pack`(`status`, `missing`, `setup_command`, `blocks_run`, `advisory`)가 포함돼요 |
| `--target-lang-code` | — | — | BCP-47 언어 코드 |
| `--target-script` | — | — | 번역문이 작성되어야 하는 ISO 15924 문자 체계(`Latn`, `Cans`, …). 대상 언어 카드에 나열된 것이어야 해요. 하네스 프롬프트에서 이를 요청하며(코칭 파일 텍스트 끝에도 추가됨), 따라서 프롬프트의 sha256 일부가 돼요. Plains Cree처럼 둘 이상의 문자 체계로 표기되는 언어의 경우, 참조문이 작성된 문자 체계를 사용해 주세요. 지정하지 않으면 하네스가 참조문의 글자 수를 문자 체계별로 집계하고(문장은 표시되지 않으므로 로컬 전용 말뭉치에도 동일하게 적용됨) 90% 이상을 차지하는 문자 체계를 요청하며, 실행 헤더에 이를 표시하고("references are 100% Latn → prompting for Latn") 실행 로그에 기록해요(`config.target_script_source`). 여러 문자 체계가 섞인 참조문에는 문자 체계가 지정되지 않고 비율과 함께 경고가 표시되며, 다른 문자 체계로 작성된 참조문은 점수가 0에 가깝게 나와요. 프롬프트를 받지 않는 MT 엔진이나 메서드 플러그인에서는 거부돼요 |

`--champollion-config` 및 `--prompt champollion`은 0.2.0에서 폐기되었으며 사유와 함께 거부돼요. `--champollion-cards-dir`도 마찬가지예요. 하네스가 다른 카드 디렉터리를 가리키도록 하려면 `MT_EVAL_CARDS_DIR`을 설정하세요. 이들은 CLI의 프롬프트를 Python으로 재구축했으나, 해당 사본이 CLI와 차이가 발생했어요. CLI 메서드를 평가하려면 메서드 플러그인(`--method`)을 사용하고, 결과를 다시 CLI 프로젝트로 가져오려면 `mt-eval export-config`을 사용하세요.

### 선택형 신경망 메트릭

COMET은 `unbabel-comet`이 설치되어 있을 때마다 계산돼요(`mt-eval setup --comet`: 설치 시 약 300MB, 최초 사용 시 약 2.3GB의 모델). 다른 두 가지 메트릭은 각각 대형 모델을 로드하기 때문에 실행 시 요청하지 않는 한 꺼져 있어요. COMET과 마찬가지로 이 로컬 머신에서 실행되며(API 비용 없음, 텍스트가 외부로 전송되지 않음), chrF++ 대표 점수 옆에 보고되고 결코 합산되지 않아요. 요청하지 않은 경우 실행 카드에는 전달할 플래그와 함께 "not run"으로 표시돼요.

| 메트릭 | 플래그 | 필요한 항목 | 소요 리소스 |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, 낮을수록 좋음, 0–25) | `--metricx` (체크포인트: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) 및 PyPI에 없는 Google의 모델 코드: `python3 -m pip install git+https://github.com/google-research/metricx` | 기본 `google/metricx-24-hybrid-large-v2p6` 체크포인트와 mT5-XL 토크나이저는 최초 사용 시 Hugging Face에서 수 GB를 다운로드해요. CPU에서는 채점 속도가 느려요. 참조 번역이 없으면 무참조(QE) 모드로 채점해요 |
| FUSE 스타일 비교기 (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE는 최초 사용 시 약 1.8GB를 다운로드해요. LaBSE가 없으면 점수가 계산되지 않으며 보고서에 그렇게 표시돼요. 사전 학습되지 않았으며(각 구성 요소의 가중치 없는 평균), 결과에는 `fuse_untrained` 플래그가 지정돼요 |

MCP(전체 프로필, `--profile full`)를 통할 때, `run_benchmark`은(는) `metricx`(`metricx_model` 포함) 및 `fuse`을(를) 사용하며, `comet: true`은(는) COMET을 필요로 해요. 플랜에는 각 항목의 설치 여부가 표시되며, 하네스가 계산할 수 없는 항목을 요청하는 확정 실행은 거부돼요.

각 메트릭이 측정하는 대상과 특정 언어에서 어느 정도까지 신뢰할 수 있는지는 [채점](/docs/network/specifications/scoring) 및 [메트릭 신뢰도](/docs/network/specifications/metric-reliability)에서 확인할 수 있어요.

### 번역 캐시

모든 실행은 각 원문 문장에 대한 모델 출력을 캐시(`--cache-dir`, 기본값은 실행이 시작된 디렉터리 아래의 `eval/cache/harness`)에 보관하므로, 동일한 설정으로 다시 실행할 때 무료로 재사용할 수 있어요. 캐시 키에는 모델, 전송된 프롬프트(해당 SHA-256), 출력을 변경하는 설정 및 하네스 버전이 포함되므로, 이들 중 어느 하나라도 변경되면 이전 출력이 반환되지 않아요. 캐시에는 코퍼스 문장의 사본이 보관돼요:

- 실행 헤더와 드라이런에 캐시의 위치와 포함된 엔트리 수가 출력돼요.
- 폴더에 `.gitignore`이 포함되어 있어 Git이 이를 무시해요.
- 공개 가능(releasable)으로 표시된 폴더 `mt-eval contest prepare`(해당 `public/`)에는 절대 기록되지 않아요. `mt-eval run`은 이러한 `--cache-dir` 또는 `--output-dir`을 거부하고 대신 콘테스트의 `runs/` 폴더를 지정해요([주권 콘테스트 운영하기](/docs/network/sovereignty/run-a-sovereign-contest) 참조).
- 로컬 전용, 봉인형(sealed) 또는 동의 필수(consent-required) 코퍼스는 실행 설정, 코퍼스의 SHA-256 및 이용 조건에 따라 키가 지정된 자체 `protected/<namespace>/` 폴더를 생성하며, 그곳의 모든 파일은 `<file>.champollion.json` 사이드카에 코퍼스 표식을 유지해요([코퍼스 등록](/docs/network/sovereignty/registering-corpora) 참조).
- 사본을 삭제하려면 폴더를 삭제하거나 `--no-cache`을 전달하여 아무것도 보관하지 마세요.

MCP 서버의 `run_benchmark`(전체 프로필)은 플랜과 결과에 캐시를 명시해요. 보유 중인 파일의 경우 실행 결과 옆에 캐시를 저장하고(`<corpus folder>/results/cache/`), 등록된 말뭉치 id의 경우 자체 폴더에 저장해요(`~/.champollion-mcp/cache/harness/`). 이전 실행으로 인해 서버 작업 디렉터리의 `eval/cache/harness`에 이미 존재하는 캐시는 계속 사용되므로, 동일한 출력에 대해 중복 비용이 청구되지 않아요. 캐시 항목은 폴더 위치에 종속되지 않으므로 이동할 수 있어요.

### 모든 서브커맨드

스무 개의 최상위 하위 명령어 전체 목록이에요. 모든 하위 명령어의 각 플래그는 생성된 [`mt-eval` 명령어 레퍼런스](/docs/reference/mt-eval)에 수록되어 있으며, 이 섹션에서는 각 명령어의 용도를 설명해요.

**실행 및 채점**

| 서브커맨드 | 기능 |
|---|---|
| `mt-eval run` | 번역 실행(위의 플래그 참조) |
| `mt-eval test <log>` | 완료된 실행 로그를 분석해요. `-o <path>`은 `<log>_report.json`이 아닌 다른 위치에 보고서를 작성하며, 실행 로그에 해당 경로가 기록되어 `card` 및 `compare`이 이를 찾을 수 있어요. `--glossary <file>`은 해당 용어집을 기준으로 용어 일관성을 채점해요. 보고서에 이름과 SHA-256이 기록되며, 카드와 `compare` 및 게시 미리보기에 용어 일관성(진단용) 채점 시 사용된 용어집이 표시돼요 |
| `mt-eval compare <reports…>` | 둘 이상의 실행(`*_report.json` 또는 실행 로그)을 비교해요. 메트릭(chrF++, BLEU, spBLEU, TER, …)당 1개 행, A, B, C…로 표시된 실행당 1개 열로 구성되며 낮을수록 좋은 메트릭은 표시가 추가돼요. `--significance`은 모든 쌍에 대해 대응 검정(paired test)을 추가하며(각 표는 실행 문자로 명명되고 Δ에 대한 95% 신뢰구간 포함), p-값은 메트릭별 비보정 값임을 명시해요. `--method paired_bootstrap`은 기본 근사 무작위화 검정 대신 켄 부트스트랩(Koehn bootstrap)으로 전환해요([유의성](/docs/network/specifications/significance) 참조). 폴더를 공유하는 경우 보고서 옆에 `comparison-<hash>.json`(비교된 실행 ID들의 해시이므로 다른 비교로 덮어쓰지 않음)을 작성하고, 그렇지 않은 경우 가장 가까운 공통 폴더의 `comparisons/`에 작성해요(개별 실행 자체 폴더에는 절대 작성하지 않음). 단, `-o`에 파일명이 지정된 경우는 예외예요. 어떤 실행이 더 우수한지는 chrF++ 검정만으로 결정하며, 다른 행은 참고용으로만 표시되고 결정에 사용되지 않아요. 레거시 보고서의 종합 점수는 폐기된 것으로 간주되어 비교되지 않아요 |
| `mt-eval dashboard <logs…>` | 대화형 HTML 대시보드를 생성해요 |
| `mt-eval card <run log>` | 사람이 읽을 수 있는 형식으로 실행 카드를 깔끔하게 출력해요. 점수는 실행 보고서(로그 옆, `mt-eval test -o`이 기록한 위치 또는 `--report <path>`)에서 가져와요. 보고서를 찾을 수 없는 실행은 0점 대신 검색한 위치와 함께 NOT SCORED로 표시돼요. 보고서 파일을 직접 전달할 수도 있으며, 기록된 실행 로그와 함께 읽혀요 |

**메서드 실행하기** (점수는 계산되지 않음)

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval translate` | 메서드를 사용하여 출발어 전용 입력을 번역해요. 점수 계산 과정이 없는 실행 파이프라인이에요. 입력된 용어를 set/1 사이드카로 포함하여 `.jsonl` 또는 `.tsv`을(를) 작성해요. 출력이 로컬 전용인 메서드는 `--holders-agreed-by`에 데이터 보유자 중 동의한 사람이 명시되지 않는 한 프로젝트 내부에만 작성해요 |
| `mt-eval serve` | 이 머신에서 실행되는 메서드(`lexicon`, `local-model` 또는 종속성 클래스 S나 O의 플러그인)를 champollion `/translate` 규약에 따라 deployment/1 파일이나 플래그로부터 서비스해요. 선택적으로 gate-chain/1 파일을 통해 모든 응답을 제어할 수 있어요. 기본적으로 127.0.0.1에 바인딩되며, 다른 호스트를 사용하려면 `$MT_EVAL_SERVE_TOKEN`이(가) 필요해요 |

**적합한 메서드 찾기**

| 서브커맨드 | 기능 |
|---|---|
| `mt-eval recommend <src> <tgt>` | 단순 순위가 아니라 가용성과 **인용된 근거**를 바탕으로 한 언어 쌍별 메서드 가이드를 제공해요. 언어 쌍은 `corpora`이 취하는 형식인 `--source <src> --target <tgt>` 형식으로도 지정할 수 있어요 |
| `mt-eval corpora --source X --target Y` | 특정 언어 쌍에 사용 가능한 평가 코퍼스를 나열해요. 두 플래그 모두 단독으로 작동해요. `--target Y`은 Y로 향하는 모든 코퍼스를 나열하고, `--source X`은 X에서 출발하는 모든 코퍼스를 나열해요 |
| `mt-eval corpora --with-fst` | 하네스가 고정(pin)하고 있는 FST가 대상 언어에 존재하여 FST 수용도를 채점할 수 있는 코퍼스만 나열해요. 각 대상 언어에 대해 FST가 이 로컬 머신에 설치되어 있는지 여부와 설치 방법(`mt-eval setup --lang <code>` 또는 일부 형식의 경우 수동 설치)이 함께 나열돼요. `--source`/`--target`와 결합하거나 모든 언어 쌍에 대해 단독으로 사용할 수 있어요. 아무것도 다운로드되지 않아요 |
| `mt-eval list models\|prompts\|datasets` | 사용 가능한 리소스를 나열해요 |

**기여하기**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval publish <report>` | 리더보드에 TestReport 제출 |
| `mt-eval queue` | 자체 키를 사용하여 커뮤니티 컴퓨팅 대기열의 최상위 작업 실행 — [컴퓨팅 기여하기](/docs/network/getting-started/contributing-compute) 참조 |
| `mt-eval export` | TestReport를 champollion 메서드 플러그인(method/1 `method.json`)으로 패키징 |
| `mt-eval generate-plugin` | `export`의 별칭 |
| `mt-eval export-config` | TestReport에서 `champollion.config.json` 스니펫 생성 |

**콘테스트 및 직접 운영하기**

| 하위 명령어 | 기능 |
|---|---|
| `mt-eval contest` | **주권 콘테스트**를 운영하거나 참가해요. 주최자용: `prepare`, `register`, `create`, `rank`, `close`, `export`, 참가자용: `qualify`(입장 영수증을 위해 공개 dev 세트 자체 채점, 예선 기준은 0–100 척도의 chrF++), `validate`(노드 검사를 오프라인에서 사전 연습), `submit-model` / `submit-method`(모델 또는 메서드 전달), `status`, `list`. 콘테스트 참가는 주최자 노드가 '실행'할 수 있는 대상을 제공하는 방식으로 이루어져요. 번역문 업로드 및 자체 보고 카드 링크 방식은 2026-09-06부로 폐지되었어요 |
| `mt-eval shared-task` | 다중 언어 쌍 공유 과제 에디션 총괄: 하나의 행이 다중 언어 쌍 공유 과제 에디션의 N개 언어 쌍별 콘테스트를 그룹화하고 정책 기본값을 전달해요. **그룹화 및 기본값 설정 전용이며, 모든 게이트 검사는 콘테스트별로 유지돼요** |
| `mt-eval node` | **주최자 채점 노드.** 접수 항목을 폴링하고, 공개 예선 기준에 따라 게이팅하며, 콘테스트 정책에 따라 승인하고, **주최자가 보유한 비밀 참조문**을 기준으로 채점하여 점수만 공개해요. [주권 콘테스트 운영하기](/docs/network/sovereignty/run-a-sovereign-contest) 및 [주권 평가 노드](/docs/network/sovereignty/sovereign-eval-node)의 기반이 되는 명령어예요. 말뭉치는 주최자의 머신 외부로 절대 유출되지 않아요 |

`mt-eval node`에는 에어갭 레인(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`)과
M-of-N 보관 세레모니(`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`)를 포함하여 자체 서브커맨드가 18개 있어요.
`mt-eval node --help`을 실행해 보세요. 주권 메커니즘은 위에 링크된 두 페이지에 설명되어 있어요.

**설정**

| 서브커맨드 | 기능 |
|---|---|
| `mt-eval setup` | 선택적 종속성 설치 (COMET 신경망 메트릭, FST 런타임) |
| `mt-eval logout` | 저장된 인증 자격 증명 제거 |

### 예시

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline
```

하네스는 FST가 거부한 번역을 절대로 재시도하거나 필터링하지 않아요. FST 수용도는 해당 언어의 eval pack에 FST가 포함되어 있을 때 채점되는 지표예요. FST 기반 재시도를 원하는 메서드는 `fst-gated-pipeline` 튜토리얼에서 보여주는 것처럼 자체 플러그인 내부에서 이를 수행해요. (`--fst-retries` 및 `--hooks`은(는) 커맨드 라인의 어떤 요소에도 연결된 적이 없으며, 둘 다 해당 사유로 거부돼요.)

---

## Run Card 스키마

모든 실험은 **run card**를 생성해요 — 자체 완결형 JSON 문서예요. 최상위 구조는 다음과 같아요:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

:::info[공식 스키마]
실행 카드 스키마의 단일 진실 공급원(SSOT)은 [벤치마크 사양](/docs/network/specifications/benchmark)이에요. 메트릭 정의와 실행 채점 방식은 [채점 사양](/docs/network/specifications/scoring)을 참조하세요. 이 페이지에서는 하네스 사용법을 다루며, 출력 결과의 구체적인 의미는 각 사양에 정의되어 있어요.
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

:::caution[적용 범위 안내]
이 메트릭들은 **진단용**이에요. 대표 점수에는 결코 포함되지 않으며, 격식성 감지는 학습된 판단이 아닌 표식 기반(휴리스틱) 방식이에요. 스타일 품질에 대한 최종 판정이 아니라 사용역 준수 여부를 감지하는 드리프트 탐지기로 활용해 주세요.
:::

---

## Fingerprint 대 Run Card 해시 {#fingerprint-vs-run-card-hash}

하네스는 두 개의 서로 다른 해시를 생성해요. 이들은 서로 다른 목적을 수행해요:

### Fingerprint

**fingerprint**는 다음에 답해요: *"이 실행을 재현할 수 있나요?"*

이는 출력이 아니라 — 실험 구성을 정의하는 입력의 조합을 해시해요:

- 데이터셋 SHA-256
- 모델 슬러그
- 조건 라벨
- 시스템 프롬프트 SHA-256
- 온도(Temperature)
- 배치 크기
- 도구 활성화 여부
- 하네스 버전

총 8개의 구성 요소로 이루어져요. 배치 크기와 도구 호출은 출력 결과를 실질적으로 변경하므로 실험의 고유 식별 정보의 일부가 돼요. 따라서 서로 다른 배치 크기로 실행된 두 실행은 지문을 공유하지 **않아요**.
자세한 내용은 [벤치마크 사양 §3.8](/docs/network/specifications/benchmark#38-fingerprint)을 참조하세요.

동일한 fingerprint를 가진 두 실행은 동일한 설정을 사용한 거예요. 그 결과는 (API 비결정성을 제외하면) 비교 가능해야 해요.

### Run Card 해시

**run card 해시**는 다음에 답해요: *"이 특정 결과 파일이 변조되었나요?"*

이는 전체 run card JSON(`run_card_hash` 필드 자체는 제외)의 SHA-256이에요. 점수, 타임스탬프, 단일 출력 등 어떤 필드라도 변경되면 해시가 깨져요.

:::info[언제 무엇을 사용할지]
비교 가능한 실행들(같은 실험, 다른 실행)을 그룹화하려면 **fingerprint**를 사용하세요. 특정 결과 파일의 무결성을 검증하려면 **run card hash**를 사용하세요.
:::

---

## 리더보드에 게시하기

실행을 완료한 후, 실행 결과의 `<run-id>_report.json`에 대해 `mt-eval publish`을 사용하세요. 라이브 리더보드에 기록하려면 명시적인 `--prod`(또는 `MT_EVAL_ALLOW_PROD=1`)이 필요해요. `mt-eval run --publish --prod`을 사용하면 두 단계를 한 번에 수행할 수 있어요:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [기계 번역 평가](/docs/network/leaderboard/rules) — 개요, 리더보드의 가치 제안 및 올바른/잘못된 메서드 가이드
- [평가 데이터셋](/docs/network/leaderboard/datasets) — 데이터셋 형식, EDTeKLA, FLORES+
- [실행 카드 사양](/docs/network/specifications/run-card) — 전체 JSON 스키마
- [메서드 구축](/docs/network/specifications/methods) — 평가 가능한 메서드 생성을 위한 메서드 인터페이스
- [메서드 리더보드](https://champollion.dev/leaderboard) — 실시간 벤치마크 점수
- [벤치마크 사양](/docs/network/specifications/benchmark) — 평가 프로토콜, 코퍼스 형식, 실행 카드 스키마
- [채점 사양](/docs/network/specifications/scoring) — 메트릭 및 실행 채점 방식의 단일 진실 공급원(SSOT)
