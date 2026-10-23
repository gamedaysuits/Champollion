---
title: "메서드와 게이트"
slug: /agents/methods
description: "모든 Champollion 도구가 읽는 method/1 및 gate-chain/1의 규격, 실습 예제로 살펴보는 FST 유효성 게이트, 그리고 기본 훈련 모델을 넘어선 메서드 레시피(코칭형 LLM, 퓨샷, 사전 보강, 규칙 기반 하이브리드, 체인형, 부분 번역, 파인 튜닝)와 각각이 무엇을 어디로 보내는지 설명해요."
---

# 방법과 게이트

**방법**은 번역을 수행하는 모든 것을 뜻해요. 훈련된 모델, 프롬프트가 적용된 LLM, 사전 검색, 규칙 엔진, 서비스, 사람이 여기에 해당돼요. **게이트**는 방법의 출력과 실제 배포되는 결과물 사이의 검사 단계예요. 레일의 기본 방법은 nmt-forge로 훈련된 모델이에요([훈련](/docs/agents/training)). 이 페이지에서는 둘 다 작성하는 데 쓰이는 형식과 다른 레시피들을 다뤄요.

아래의 모든 레시피는 [전송 규칙](/docs/agents/data-rules)을 따라요. **모델 제공업체를 호출하는 방법은 해당 제공업체로 텍스트를 전송하며**, 로컬 전용, 봉인됨(sealed) 또는 동의 필수 파일은 이를 거부해요.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. 필수 항목: `id`(하이픈으로 연결된 소문자 단어), `name`, `kind` — 여기에 해당 종류에 필요한 설정 하나가 추가되며, 두 런타임 모두에서 판독기가 동일한 메시지로 이를 확인해요.

| `kind` | 필수 설정 | 실행 환경 | 텍스트 전송 대상 |
|---|---|---|---|
| `llm` | `model`(별칭이 아닌 정확한 ID); 선택 사항 `provider` | CLI; `-m` 및 `--provider`를 통한 하네스 | 해당 제공업체 |
| `llm-coached` | `model`; 코칭은 `coaching`(`file`, `prompt` 또는 `dir`)에 들어감 | CLI; `-m` 및 `--coaching-file`를 통한 하네스 | 해당 제공업체: 문장과 코칭 |
| `mt-api` | `engine`(`shared/method-registry.json`에서 가져옴) | CLI; 하네스 | 엔진의 서비스 |
| `local-model` | `model`(Hugging Face ID 또는 로컬 폴더) | 하네스, 프로세스 내 | 어디에도 전송 안 함 |
| `nmt-checkpoint` | `model_dir` | 자체 서비스(`nmt-forge serve`)를 통해 | 이 컴퓨터의 서버 |
| `lexicon` | `dictionary` | 하네스, 프로세스 내 | 어디에도 전송 안 함 |
| `python` | `entry_point`(`module:Class`) | 하네스(`mt-eval run --method <folder>`) | 플러그인이 전송하는 곳 어디든(`dependency_class`) |
| `service` | `service.endpoint` | CLI(`api` 방법) | 해당 엔드포인트 |
| `human` | — | 사람; `mt-eval test`로 결과물을 평가 | — |

선택 사항: `version`, `description`, `author`, `pairs`(`{source?, target}`),
`decode`(`temperature` 0–2, `batch_size`, `max_tokens`), `card`(리더보드에 표시되는 내용), `dependency_class`(`S` 자체 포함, `O` 공개 외부,
`A1`/`A2` API 종속, `X` 폐쇄형), `evidence`(측정된 실행: `dataset`,
`metric`, `score`, `ci`, `n` — 숫자만 해당), `runtimes`(`cli`, `engine`).

**method.json이 생성되는 곳:** 프로젝트 내의 `methods/<id>/method.json`, `nmt-forge export`(종류 `nmt-checkpoint`), `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). 이전 형식(`type`가 포함된 CLI 플러그인 매니페스트, `entry_point`가 포함된 하네스 플러그인 매니페스트)도 경고와 함께 method/0으로 계속 읽혀요. `$schema`가 포함된 문서는 method/1로 읽히며 유효성 검사를 통과해야 해요.

**어떤 런타임이 어떤 종류를 지원하는지.** CLI는 `python`, `lexicon`,
`local-model`, `human`를 거부해요(*"champollion CLI가 아닌 평가 엔진(mt-eval run --method)에서 실행하세요. 또는 이를 서빙하여 엔드포인트를 통해 사용하세요"*).
하네스의 `--method <folder>`는 `python`만 로드해요. 다른 모든 종류에 대해서는 대신 실행할 수 있는 플래그를 안내해요.

**디코딩.** 기본 temperature는 **0**이에요(`shared/model-defaults.json`).
앱이 번역할 때와 하네스가 평가할 때 동일한 값을 사용하여, 측정된 결과가 곧 배포되는 결과물이 되도록 해요. `mt-eval run --temperature`도 기본적으로 이 값을 사용해요.
언어 쌍, 설정 또는 개별 실행마다 자체 값을 지정할 수 있어요.
모델 ID는 별칭이 아닌 정확한 슬러그여야 해요.

## 게이트 체인

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, `gates/` 내의 단일 파일이에요. 필수 항목: `id`, `gates`(하나 이상). 선택 사항: `description`,
`fallback`.

각 게이트: `id`, `kind`(유일한 종류인 `metric-threshold`), `metric`(메트릭 플러그인의 이름), `field`(해당 플러그인의 세그먼트별 결과 키 — 숫자 또는 1/0으로 읽히는 true/false), `min` 및/또는 `max`, `on_refuse`.

**규칙** (`arena/mt_eval_harness/gates.py`):

- 게이트는 순서대로 실행돼요. 세그먼트를 거부하는 **첫 번째** 게이트가 무엇을 배포할지 결정해요:

  | `on_refuse` | 배포 내용 | 집계 결과 |
  |---|---|---|
  | `drop` | 없음 | 거부됨 |
  | `keep-source` | 원문 텍스트 | 거부됨 |
  | `flag` | 표시(플래그)가 지정된 출력 | 플래그 지정됨(거부되지 않음) |
  | `fallback` | 동일한 게이트가 통과시키는 경우 대체 수단의 번역, 다시 거부되면 없음 | 거부됨 |

- **잠금(Lock).** 플러그인이 점수를 매길 수 없는 세그먼트는 거부돼요(`no_value` 또는 `plugin_error:<type>`). 통과한 것처럼 배포되는 일은 절대 없어요.
- **잠금.** 플러그인이 로드되지 않았거나 여기에서 점수를 매길 수 없는 게이트는 번역이 진행되기 전에 실행을 중단해요: *"판단할 수 없는 게이트는 결코 통과된 것으로 처리되지 않음"*.
- **잠금.** 대체 수단(fallback)은 이 프로세스 내에서 실행되어야 하므로(`lexicon`, `local-model` 또는 `dependency_class` `S`나 `O`를 선언하는 플러그인), 거부된 세그먼트가 외부로 유출되지 않아요.
- **잠금.** `mt-eval run` 및 `mt-eval test`는 `fallback` 게이트가 있는 체인을 거부해요: *"대체 수단은 서빙 및 번역용이며 측정용이 아님. 하나의 이름 아래 점수의 일부는 이 방법의 것이고 일부는 대체 수단의 것이 됨"*. 대체 수단은 별도의 방법으로 측정하세요.
- **게이트가 적용되는 곳:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates`, 그리고 배포의 `gates`.
- 측정 시 대표 점수(headline)는 배포되는 대상을 평가해요. 게이트가 적용되지 않은 chrF++와 거부율이 그 옆에 함께 표시되며, 체인의 핑거프린트(정규화된 JSON의 sha256)가 보고서와 함께 전달돼요([측정](/docs/agents/measurement#gated-measurement)).
  `keep-source`의 경우 대표 점수는 원문 텍스트가 배포된 곳에서 원문 텍스트를 평가해요.
- **잠금.** 모든 게이트에는 `min` 및/또는 `max`가 필요하고, 게이트 ID는 고유해야 하며, `fallback` 게이트에는 체인의 `fallback`가 필요해요 — `champollion validate`와 하네스는 동일한 판정을 내려요. 게이트의 사유를 바탕으로 거부된 세그먼트를 재시도하는 기능은 내장되어 있지 않아요.

## 단계별 예시: FST 유효성 게이트

유한 상태 분석기(FST)는 단어가 해당 언어의 올바른 형태의 단어인지 알려줘요. 하네스의 메트릭 플러그인 `giellalt_fst_validity`는 세그먼트별로 `fst_total_words`, `fst_valid_words`, `fst_invalid_words`, `fst_validity_rate`(0–1)를 보고해요. 단어는 공백을 기준으로 분리되고 가장자리 문장 부호는 제거되며, 대문자로 시작하는 단어는 소문자로 재시도돼요.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- 분석기는 **기본 번들로 제공되지 않아요**. 하네스는 핀(언어별 파일 이름 및 sha256)만 제공하며, `setup --lang`가 업스트림의 약관에 따라 업스트림에서 `~/.mt-eval/fsts/<code>/`로 분석기를 가져와요. 분석기는 별도의 도구로 실행되며, `champollion` CLI에 링크되지 않아요.
- 분석기가 없다고 해서 점수가 0이 되지 않아요. 메트릭으로는 '계산되지 않음'으로 표시되고, 게이트로는 실행을 중단해요.
- 빈 출력은 점수가 0이며 `min` 미만으로 거부돼요.
- 이를 사용하여 서빙하려면 `on_refuse: "fallback"`와 `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` 같은 `fallback`를 사용하세요 — `translate` 및 `serve`에만 해당돼요.
- **참고.** FST 승인은 단어가 존재한다는 것을 의미할 뿐, 문장이 올바른 의미를 지닌다는 뜻은 아니에요. 이는 진단 도구이며, chrF++ 대표 점수에는 결코 포함되지 않아요.

## 레시피

### 코칭된 LLM (`llm-coached`)

사람들의 지침(문법 참고사항, 문체, 용어)이 프롬프트로 제공되는 범용 모델이에요.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **하네스에서는** 코칭 파일의 텍스트가 전체 시스템 프롬프트가 *되므로*, 번역할 내용과 번역문만 출력하도록 안내해야 해요. `--glossary`는 평가 입력값(용어 준수도)이며, 절대 전송되지 않아요.
- **잠금.** 하네스 실행에는 하나의 코칭만 허용돼요: `--coaching-file`, `--coaching`(인라인 텍스트), 또는 이전의 `--custom-prompt` 중 하나만 지정하세요. 두 개를 함께 사용하면 거부돼요: *"--coaching-file과 --coaching은 각각 실행에 코칭을 제공합니다. 둘 중 하나만 지정하세요(인라인 텍스트를 파일에 넣거나 파일을 제외하세요)"*.
- **CLI에서는** `llm-coached`가 코칭을 "Coaching guidance" 블록으로 담은 자체 프롬프트와 `.champollion/coaching/<locale>.json`(`grammar_rules`, `style_notes`, `dictionary`)를 전송해요.
- **참고.** 이 둘은 서로 다른 프롬프트예요. 하네스에서 측정된 코칭 점수는 CLI가 실제로 배포하는 정확한 프롬프트와 달라요. 한쪽을 다른 쪽의 근거로 전달할 때는 이 점을 밝혀주세요.
- **전송 대상:** 모든 원문 문장과 전체 코칭이 제공업체로 전송돼요. 로컬 전용 사이드카가 포함된 코칭 파일은 루프백 엔드포인트에서만 실행돼요(`champollion data mark coaching.md --local-only`가 이를 표시함).

### 퓨샷(Few-shot)

코칭 내에 좋은 번역 예시를 포함하는 방식이에요. 이는 코칭된 LLM과 동일해요. 명령어와 전송 방식이 같으며, 예시는 시스템 프롬프트에 담겨 제공업체로 전송돼요.

- **참고.** 테스트 세트에서 예시를 가져오지 마세요. 원격 제공업체의 경우 로컬 전용 파일에서도 가져오지 마세요. 퓨샷 예시를 테스트 참조본과 자동으로 대조해 주는 기능은 없어요.

### 사전 증강 LLM

- **CLI:** 각 배치에서 발견된 용어에 대해(대소문자 구분 없는 부분 문자열 일치), `.champollion/coaching/<locale>.json`의 `dictionary`가 모든 LLM 방법에 "REQUIRED TERMINOLOGY"로 전송돼요. DeepL은 이를 용어집(glossary)으로 수신해요. 위반 사항은 번역 후 경고로 표시되며, 재시도는 없어요.
- **하네스:** 사전은 코칭 파일의 텍스트 형태로만 모델에 전달돼요.
- **사전 단독:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — 가장 긴 구문 우선, 미등록어 유지, 프로세스 내 실행. 개발 세트에서의 `nmt-forge floor`가 이에 해당해요([측정](/docs/agents/measurement#the-dictionary-floor)).
- **전송 대상:** 일치하는 사전 항목이 문장과 함께 제공업체로 전송돼요. 로컬 전용 사전은 원격 제공업체로 전송되어서는 안 돼요.

### 규칙 기반 하이브리드

규칙 엔진은 내장되어 있지 않아요. 사용 가능한 항목은 다음과 같아요: `lexicon`(결정론적, 프로세스 내 실행), `mt-eval run --method apertium`(규칙 기반 엔진 — `APERTIUM_API_URL`가 자체 서버를 가리키지 않는 한 텍스트를 `apertium.org`로 전송), 그리고 자체 규칙을 위한 `python` 플러그인(선택적으로 LLM과 함께 사용 가능). 플러그인 클래스에는 `async def translate(self, entries, config)`가 필요해요. `mt-eval run
--method <folder>`로 실행하세요. 게이트 체인으로 출력의 유효성을 검사하세요.

- **전송 대상:** 플러그인이 호출하는 모든 대상이에요. 플러그인은 외부 방법이에요. 동의 필수 또는 봉인된 코퍼스(로컬 전용 포함)에서 하네스는 `--attest-local-transport`가 전달되지 않는 한 이를 거부해요. `--attest-local-transport`는 플러그인이 호출하는 모든 항목이 이 컴퓨터 내에 있음을 확인한 후에만 전달해야 해요.

### 연쇄된 방법

두 가지 체인이 기본 내장되어 있어요:

1. **게이트 체인의 대체 수단(fallback):** 방법 → 게이트 → 프로세스 내 대체 수단 → 동일한 게이트. `translate` 및 `serve`에만 적용돼요.
2. **CLI의 언어 쌍 대체 수단** (앱의 언어 쌍에 지정된 `"fallback": {"method": …}`):
   기본 방법 → CLI의 품질 게이트 → 게이트의 피드백을 반영한 재시도(LLM 방법 또는 `acceptsInstructions`를 선언하는 `api` 엔드포인트) → 동일한 게이트를 통과하는 1회의 대체 수단.

이보다 더 긴 과정(모델 간 생성, 편집, 유효성 검사)은 `python` 플러그인 또는 `service`에 해당해요.

- **전송 대상:** 각 연결 고리는 해당 종류가 전송하는 내용을 전송해요. 체인의 프라이버시 수준은 체인에서 가장 프라이버시가 취약한 연결 고리에 의해 결정돼요.

### 부분 번역(사람과 기계)

모델이 초안을 작성하고 화자가 검토하여 수정해요. 레일에서 이는 개선 라운드(improve round)에 해당해요. `champollion improve sheet`가 초안을 작성하고, 화자가 `Y`/`N`/`?`로 표시하며, `champollion improve marks`가 수정본과 확인된 초안을 훈련 쌍으로, 연습 행을 개발 문장으로 변환해요([코칭](/docs/agents/coaching)).
사람이 직접 한 번역을 하나의 방법으로 평가하려면(`kind` `human`), 그 결과물에 대해 `mt-eval test`를 실행하세요. `on_refuse: "flag"`가 있는 게이트는 결과물을 검토용으로 표시해요.

- **참고.** 방법을 코칭하거나 훈련하는 데 사용된 문장은 해당 방법의 평가 대상이 되어서는 절대 안 돼요.
- **전송 대상:** 초안 작성 모델 자체의 규칙 외에는 아무것도 전송되지 않으며, 시트는 프로젝트 폴더에 유지돼요.

### 미세 조정된 모델

- **레일 상에서:** `nmt-forge`(`nmt-checkpoint`, 프리셋 `cpu-tiny`, `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), 내보내고 서빙하여 연결 — [훈련](/docs/agents/training), [서빙](/docs/agents/serving).
- **이미 보유한 공개 모델:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — 프로세스 내 실행, 머신 외부로 아무것도 유출되지 않아요.
- **직접 서빙하는 LLM** (Ollama, vLLM, OpenAI 호환 서비스 등):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. 엔드포인트가 루프백 주소일 때만 로컬로 간주돼요.
- **전송 대상:** 엔드포인트가 진정한 로컬인 경우 머신 외부로 아무것도 전송되지 않아요.

## 더 알아보기

- [방법 사양](/docs/network/specifications/methods) 및 [플러그인 매니페스트](/docs/reference/plugin-spec)(이전 형식).
- [서빙 및 배포](/docs/agents/serving) — deployment/1 및 service-api/1.
- [측정 규칙](/docs/agents/measurement) — 게이트 적용 점수.
- [데이터 및 전송 규칙](/docs/agents/data-rules) — 전송 가능한 항목.
- [앱과 사이트를 위한 번역 방법](/docs/guides/translation-methods).
