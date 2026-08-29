---
sidebar_position: 4
title: "컴퓨팅 자원 기여하기"
description: "큐 실행하기: 공개 큐의 열린 벤치마크 스윕을 본인의 API 키로 실행하고 결과를 게시하세요."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# 컴퓨팅 자원 기여하기

> **아이디어:** 리더보드에는 아무도 측정하지 않은 (언어 쌍, 메서드, 조건) 조합인 빈칸이 있어요. 저희는 이 빈칸들의 공개 대기열(queue)을 유지 관리해요. 여러분이 자신의 API 키로 항목을 실행하고 보고서를 게시하면 지도가 채워집니다. 컴퓨팅 리소스를 기여하는 것은 자원이 부족한 기계 번역(MT) 평가에 대한 실질적이고 인용 가능한 기여가 돼요.

대기열에는 두 가지 종류의 작업이 있어요. **LLM 항목**은 `naive` 또는 `coached` 프롬프트 조건에서 언어 쌍에 대해 채팅 모델을 테스트해요. **엔진 항목**(조건 `engine`)은 DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde와 같은 기존 MT 서비스를 해당 서비스가 자체적으로 게시한 지원 범위 내의 언어 쌍에 대해 테스트해요. 이는 커버리지 맵의 측정된 중추이며, 2026-08까지는 거의 완전히 비어 있었어요. 두 종류 모두 동일한 하네스(harness)를 통해 실행되고 동일한 보드에 게시돼요.

## 대기열

라이브 대기열은 데이터베이스에서 제공돼요(하네스가 기본적으로 이를 읽어요). 압축된 스냅샷은 [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json)에 게시되며, 전체 파일은 [queue.json](https://champollion.dev/queue.json)에 있어요(수십 MB 크기이므로 미리보기를 먼저 가져오는 것이 좋아요). 여러분의 실행 결과가 무엇을 구축하는지 [champollion.dev의 라이브 맵](https://champollion.dev)에서 확인할 수 있어요. 이는 누가 무엇을 번역할 수 있는지 보여주는 커버리지 맵이에요. 설치가 필요 없는 터미널 뷰어도 있어요.

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

이 뷰어는 열려 있는 항목과 그에 대한 정확한 `mt-eval run` 명령을 *표시*만 해요 — 아무것도 실행하거나 토큰을 소비하지 않아요. 각 항목에는 다음이 포함돼요:

- `run_command` — 복사 및 붙여넣기 준비 완료 (말뭉치를 가져오고 하네스를 실행해요)
- `est_cost_usd` 및 `est_basis` — 동일한 (말뭉치, 모델)에 대한 자체 베이스라인 실행의 **관측된(observed)** 비용이거나, 해당 모델의 항목당 평균 스윕 비용 × 말뭉치 항목 수에서 **외삽(extrapolation)**한 비용이에요. 기준은 항목별로 명시되어 있으며, 실제 비용은 실행 시점의 제공업체 가격에 따라 달라져요.
- `priority` — 게시된 순위 (조사 모드: 달러당 언어 쌍, 언어 및 어족 전반에 걸친 최초 관측(first light)). 미리보기는 또한 **예산 계층(budget tiers)**을 게시하여 $1 / $10 / $100 / $1000로 순위 상위권에서 무엇을 얻을 수 있는지(도달한 항목, 언어 쌍, 모델) 보여주므로, 비용을 지출하기 전에 기여 규모를 가늠할 수 있어요. 기본 가치 모델은 **예상 체인 가치(expected chain value)**예요. 즉, 이 한 번의 실행이 예상 달러당 전체 언어망을 얼마나 강화할 것으로 예측되는지를 나타내요. 모든 항목에는 전체 공식 분석(`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`)이 포함되어 있어 어떤 순위든 수동으로 다시 도출할 수 있어요. 공식과 기본값은 [대기열 구성 사양](/docs/network/specifications/queue-construction)에 게시되어 있으며, 그 이면의 논리는 [대기열이 이렇게 구축된 이유](/docs/network/perspectives/why-the-queue)에서 확인할 수 있어요.

**클레임 잠금 없음 — 열려 있는 항목 아무거나 고르세요.** 두 사람이 같은 항목을 실행하는 것은 설계상 무해해요: 모든 실행 카드는 지문이 찍혀 있어서(데이터셋 해시 + 모델 + 조건 + 시스템 프롬프트에 대한 SHA-256, [벤치마크 명세 §3.8](/docs/network/specifications/benchmark)), 동일한 실행은 게시 시 중복 제거되고, 같은 구성의 독립적인 복제는 낭비가 아니라 유용한 증거예요.

대기열에 있는 코퍼스는 dev-split이며, CC-BY 계열(Tatoeba 기반)이고 `do_not_train`로 표시돼 있어요 — 이것들은 평가 세트이지 학습 데이터가 아니에요. 비상업 라이선스 및 격리된 코퍼스는 공개 대기열에서 제외돼요.

## 설정 (한 번만)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### 어떤 제공자 키를 쓰나요?

하니스는 네 가지 제공자 키를 받으며, `mt-eval run`와 `mt-eval queue`에서 `--provider`로 선택하거나, 환경 또는 `.env`에 설정된 키로부터 자동 감지돼요:

| `--provider` | 키 | 도달 범위 |
|---|---|---|
| `openrouter` (기본값) | `OPENROUTER_API_KEY` | 대기열 라인업의 모든 모델 |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Claude 모델 |
| `openai` | `OPENAI_API_KEY` | OpenAI GPT 모델 |
| `gemini` | `GOOGLE_API_KEY` | Google Gemini 모델 |

하나의 [OpenRouter](https://openrouter.ai/keys) 키로 라인업의 모든 모델에 도달할 수 있고, 하니스의 비용 추적 및 가격 스냅샷도 동일한 OpenRouter 메타데이터에서 나오기 때문에, 보고된 실행 비용이 여러분의 키에 청구된 금액과 일치해요 — 그래서 이것이 기본값이에요. 크레딧이 Anthropic, OpenAI, 또는 Google에 직접 있다면 해당 벤더의 키를 설정하면 하니스가 프록시 없이 벤더의 API를 호출해요. 직접 키는 해당 벤더 자체 모델에만 도달하며(단일 벤더 배치에 적합), 비용 수치는 청구된 메타데이터가 아니라 게시된 벤더 가격에서 나오므로 — 근사 추정치로 취급하세요. OpenRouter 키와 직접 키가 모두 설정된 경우, 자동 감지는 OpenRouter를 선택해요; 대기열 워커가 이를 알려주고 `--provider`로 재정의하는 방법도 안내해요. 모든 실행 카드는 어느 레인을 통해 실행됐는지 `api_provider` 필드에 기록해요.

(`mt-eval run`은 `--base-url`을 통해 자체 호스팅된 OpenAI 호환 엔드포인트 — Ollama, vLLM, LM Studio — 를 위한 `--provider local`도 받아요. 이것은 명시적 옵트인이며, 절대 자동 감지되지 않아요.)

### API 키 없음: 자체 호스팅 모델 실행

클라우드 키가 전혀 필요하지 않아요. `local-model` 메서드는 여러분의 자체 하드웨어에서 개방형 신경망 기계 번역(neural-MT) 모델을 실행해요. 이는 클라우드 엔진이 제공하지 않는 모델들이며, 자원이 부족한 언어의 커버리지가 존재하는 바로 그 영역이에요. **NLLB-200**, **OPUS-MT**(Helsinki-NLP), **MADLAD-400**이 여기에 해당해요.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**모델을 로드하는 두 가지 "일반적인 방법"이 자동 선택되며, 구성할 필요가 없어요:**

- **transformers** (기본값): `--model`는 Hugging Face 허브 ID(`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) 또는 로컬 `from_pretrained()` 디렉터리예요. `pip install 'mt-eval[local-models]'`가 필요해요.
- **CTranslate2** (빠른 CPU/GPU 추론): `--model`은 CTranslate2로 변환된 모델 디렉터리(`ct2-transformers-converter`로 생성되었으며 `model.bin`를 포함함)예요. `pip install 'mt-eval[ctranslate2]'`이 필요해요. 토크나이저는 변환된 디렉터리에서 읽거나 `LOCAL_TOKENIZER_ID`로 지정해요.

백엔드는 모델 경로에서 감지돼요(CTranslate2 디렉터리에는 `model.bin`가 있어요). 필요한 경우 `LOCAL_MODEL_BACKEND=transformers|ctranslate2`을 사용하여 강제할 수 있어요.

**언어 코드는 추측이 아닌 언어 카드에서 가져와요.** NLLB와 같은 다국어 모델의 경우, 하네스는 대상 언어의 카드(모든 메서드가 사용하는 동일한 진실 공급원(source of truth))에서 직접 FLORES-200 코드를 읽어요. 모델이 실제로 지원하지 않는 언어(예를 들어 NLLB-200에는 평원 크리어(Plains Cree, `crk`)가 없음)는 가짜 코드를 내보내고 그럴듯하지만 잘못된 번역을 생성하는 대신 **정직하게 실패**("이 모델의 범위를 벗어남")해요. OPUS-MT 모델은 언어 쌍에 따라 다르므로 언어 쌍 *자체가* 모델이에요.

로컬 모델 실행은 다른 실행과 정확히 동일하게 점수를 매기고 게시돼요. 동일한 지표, 동일한 실행 카드, 동일한 리더보드를 사용해요. (이는 하네스 메서드이며, CLI 번역 도구는 나중에 하위 프로세스 브리지를 통해 이에 도달하므로 Node에는 Python ML 스택이 전혀 필요하지 않아요.)

### 에이전트 빠른 경로

Claude Code나 다른 코딩 에이전트를 사용한다면, 전체 기여 과정이 프롬프트 하나예요:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — 명령 하나

가장 빠르게 기여하는 방법은 하니스가 여러분을 위해 대기열의 맨 위 항목을 가져가도록 하는 거예요:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

이것은 절대 재정렬하지 않아요 — 대기열 순서 그 자체가 [우선순위
모델](/docs/network/specifications/queue-construction)이에요 — 그리고 추정 지출이 포함된
전체 계획을 보여준 뒤 무언가를 실행하기 전에 물어봐요. 코칭된
항목은 여러분이 자신의 코칭 파일을 가져오지 않는 한 건너뛰어져요
(`--include-coached --coaching-file my-coaching.txt`).

**대기열 워커가 여러분을 위해 게시해요 — 계정 불필요.** 단일
`mt-eval run`(절대 자동 게시하지 않음)와 달리, `mt-eval queue`은 토큰을 소비하기 *전에*
게시 신원을 확인하고, 각 성공한 실행이 완료되는 대로 **자동으로 리더보드에
게시해요** — 별도의 게시 단계가 없어요. 이름을 보드에 올리고 싶을 때만
로그인하세요(GitHub/Google); 그렇지 않으면 익명으로 계속하면 결과가 제출자 `anonymous`로
게시돼요
(`--anonymous`가 이를 강제하고, 캐시된 로그인이 없는 비대화형 `curl | bash` 실행은
기본적으로 이것을 사용하며, 그렇게 한다고 명시적으로 알려줘요). 결과를 로컬에 유지하려면
대신 `--no-publish`를 전달하세요(나중에 `mt-eval
publish`로 게시할 수 있어요). 그런 다음
[champollion.dev의 실시간 지도](https://champollion.dev)에서 여러분의 실행이 무엇을 만들어냈는지 확인하세요.

## Tier 1 — 벤치마크 실행하기

모든 대기열 항목의 `run_command`는 자체 완결적이에요. 전형적인 예시:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

파일이 아니라 **레지스트리 id**를 전달해요 — 하니스가 실행 시점에 업스트림 소스에서
레퍼런스를 가져오고 새로 가져온 데이터에 대해 채점해요
(코퍼스 콘텐츠는 여기서 절대 호스팅하거나 추적하지 않아요).

실행은 총 비용을 출력하고, 실행 로그와 채점된 리포트를 `eval/logs/`에 기록해요. 그런 다음 게시하세요:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**계정 불필요.** 게시 시 OAuth 로그인(GitHub/Google)을 제공해서 여러분의 이름이 리더보드 귀속 정보가 되지만 — 이는 선택 사항이에요: `mt-eval publish <report> --anonymous`는 계정 없이 게시하고, 해당 행은 제출자 `anonymous`로 다른 자가 벤치마크 결과와 정확히 동일하게 표시돼요. 익명 접수는 속도 제한이 있고(연결당 시간당 몇 개의 카드; 로그인이 무제한 경로예요) 다른 모든 제출과 동일한 데이터베이스 무결성 게이트를 통과해요 — 격리, 점수 범위, corpus-sha 바인딩, corpus-content 가드가 모두 동일하게 적용돼요. 익명이든 귀속이든, 커뮤니티 제출은 **자가 벤치마크** 신뢰 등급에 도달해요 — "실행한 사람이 제출함"이라고 명확히 라벨링돼요. 이는 강등이 아니라 신뢰 모델이 작동하는 방식이에요. 실행 카드에는 누구나 여러분의 정확한 구성을 재실행하는 데 필요한 모든 것이 담겨 있어요: 데이터셋 해시, 모델, 조건, 전체 시스템 프롬프트, 그리고 비용이요. 상위 등급(검증, 커뮤니티 검증)은 심사를 통해 부여돼요 — [리더보드 규칙](/docs/network/leaderboard/rules)을 참조하세요.

:::note[중재]
익명 행은 다른 모든 것과 마찬가지로 중재돼요: 제출물은 공개 API에 대해 불변이며, 큐레이터의 삭제나 정정은 모두 service-role 레인을 거쳐요. 여기서 데이터베이스의 감사 기록이 이전 행을 보존해요 — 따라서 삭제는 기록되고 되돌릴 수 있으며, 절대 조용히 일어나지 않아요.
:::

## Tier 2 — 코칭된 프롬프트 만들기

하니스는 **코칭**을 최우선으로 지원해요: 단순한 시스템 프롬프트를 실제 언어학 지식을 담은 것으로 교체하세요. `--coaching-file`(또는 짧은 프롬프트의 경우 `--coaching "inline text"`)를 전달하면 하니스가 여러분의 텍스트를 시스템 프롬프트로 사용하고, **전체 텍스트와 그 SHA-256**을 실행 로그의 프로버넌스 블록에 기록하며, 실행 조건에 **`coached`** 라벨을 붙여요(`--prompt`을 명시적으로 설정하지 않은 경우) — 그래서 프롬프트 제작은 재현 가능하고 귀속 가능한 실험이 되고, 서로 다른 두 코칭 파일이 혼동될 수 없으며, 코칭된 실행이 리더보드에서 단순 베이스라인으로 오인되지 않아요.

페로어(Faroese)에 대한 실제 예시로, 해당 언어의 [공개 언어 카드](https://champollion.dev/languages)에서 가져온 유형론 사실과 용어집 항목을 사용해요:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(여러분만의 코칭 콘텐츠를 작성하세요 — 위의 사실들은 그 *형태*를 보여줘요: 몇 가지 영향력 큰 문법 규칙, 모델이 틀리는 용어의 작은 용어집, 하나의 레지스터 지시문이요. [champollion.dev/languages](https://champollion.dev/languages)의 언어 카드는 여러분이 참고할 수 있는 유형론 출처를 인용하고 있어요.)

`mt-eval compare <naive_log> <coached_log>`로 단순 베이스라인과 비교하고, 반복 개선한 뒤, 최고의 실행을 게시하세요. 실행은 자동으로 `coached` 조건으로 게시돼요; 리더보드에 일반적인 라벨 대신 이름이 붙은 방법을 표시하고 싶다면, 게시할 때 방법 카드를 첨부하세요(게시 흐름이 위저드를 제공해요). 프롬프트 엔지니어링만으로 저자원 쌍에서 단순 베이스라인을 이기는 것은 진정한, 게시할 만한 발견이에요 — 설계 지침에 대해서는 전체 [코칭된 LLM 프롬프팅 쿡북](/docs/network/tutorials/coached-llm-prompting)을 참조하세요.

## Tier 3 — 방법 구축하기

가장 야심찬 기여: `TranslationMethod` 프로토콜(`translate(entries, config)`)을 구현하고 프롬프트가 아닌 실제 시스템을 벤치마크하는 거예요. 하니스는 `--method <plugin-dir>`을 통해 이를 실행하고 여러분의 방법 카드를 실행 카드에 임베드해요. 실제 쿡북이 있는 패턴:

- **[FST 게이트 파이프라인](/docs/network/tutorials/fst-gated-pipeline)** — 모든 후보 단어를 형태소 분석기가 검사하고, 게이트를 통과할 때까지 LLM이 재생성해요. 준결정적이고 형태론이 보장된 출력이에요.
- **[사전 증강 생성](/docs/network/tutorials/dictionary-augmented-llm)** — 번역 시점에 이중언어 어휘집에서 소스 용어를 조회하고 출력을 제약해요.
- [연쇄 모델](/docs/network/tutorials/chained-models), [퓨샷 검색](/docs/network/tutorials/few-shot-prompting), [역번역](/docs/network/tutorials/back-translation), [규칙 기반 하이브리드](/docs/network/tutorials/rule-based-hybrid)…

방법은 실행 및 이전에 무엇이 필요한지 설명하는 **의존성 클래스**(S/O/A1/A2/X — [방법 명세](/docs/network/specifications/methods#method-validity-and-dependency-classes) 참조)를 선언해요: 자체 완결적 파이프라인은 Class S이고, 실행 시점에 라이선스 사전 API를 호출하는 것은 A2예요. 정직하게 선언하세요 — 클래스가 여러분의 방법이 어디서 경쟁할 수 있는지를 결정하고, 매니페스트는 감사돼요.

## 리더보드를 넘어서 이것이 중요한 이유

게시된 모든 실행은 상업 제공자가 측정하지 않는 언어 쌍의 MT 품질에 대한 독립적인 증거예요. 대기열은 *수요*의 공개 기록 역할도 해요: 커뮤니티가 측정할 가치가 있다고 여기는 쌍이 무엇인지, 현재 API 가격에서 커버리지 비용이 얼마인지, 기여된 컴퓨팅 자원이 얼마나 멀리 미치는지를 보여줘요. 저희가 자금 지원 기관에 체계적인 스윕을 지원해 달라고 요청할 때, 이 대기열과 그 충족률이 바로 수요의 증거예요.
