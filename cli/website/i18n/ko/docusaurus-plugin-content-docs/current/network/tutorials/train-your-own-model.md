---
sidebar_position: 0
title: "직접 모델을 학습시키고 싶으시다면"
description: "python3 -m pip install부터 champollion CLI에 모델을 서빙하기까지, nmt-forge로 저자원 번역 모델을 훈련하는 에이전트 중심의 엔드투엔드 가이드예요. 코딩 에이전트에게 지시를 내리면 가드레일이 초보적인 실수를 자동으로 잡아줘요."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# 나만의 모델을 훈련하고 싶다면

저자원 언어를 위한 기계 번역 모델을 훈련하는 전체 과정을 다룬 튜토리얼이에요. "이 언어를 구사할 줄 알지만 데이터가 거의 없다"는 상태에서 출발해, 솔직하게 보고서를 작성하고 champollion CLI를 통해 자체 앱에 서빙하며 [Network](/docs/network/)에 제출할 수 있는 모델을 만드는 단계까지 안내해요. 모델 훈련은 더 긴 여정(기존 자원 파악, 대안 측정, 더 나은 모델 구축, 검증, 배포)의 한 단계일 뿐이며, [Build MT for Your Language](/docs/build-mt-for-your-language)에서 전체 개요를 확인할 수 있어요.
이 문서는 초보자를 위해 작성되었으며, 다음과 같은 현대적인 작업 방식을 전제로 해요. **사용자가 코딩 에이전트**(Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity 등)에게 지시를 내리면, 에이전트가 도구를 실행해요.

그래서 아래의 각 단계는 동일한 형태를 가져요:

- 🗣️ **에이전트에게 말하기** — 무엇을 요청할지, 평이한 언어로요.
- 🛠️ **도구가 하는 일** — [nmt-forge](/docs/network/getting-started/training-honestly)가 여러분을 대신해 실행하는 것과, 대가를 치르기 전에 전형적인 실수를 잡아내는 **가드레일**이에요.
- 👀 **결과를 읽는 법** — "좋은" 것은 어떤 모습이고 무엇을 걱정해야 하는지요.

:::info[먼저, 용어부터]
*dev set*, *decoding*, *chrF++*, *leakage*, *round-trip verification* 같은 용어가 아직 익숙하지 않다면, 먼저 [**MT 훈련을 평이한 언어로**](/docs/network/context/mt-training-concepts)를 읽어보세요 — 여기서 사용되는 모든 단어를 실제 예제와 함께 정의해요. 이 페이지는 그 모든 용어에 기대고 있어요.
:::

:::note[정직함은 마찰이 아니라 기능이에요]
이 도구는 의도적으로 고집이 있어요. 그 가드레일은 실제 프로젝트가 저질렀던 실제로 측정된 실수를 기계화한 것이에요 — 그래서 정직한 경로가 기본값이 되고, 부정직한 지름길은 **수정 방법을 명시하는 메시지와 함께 거부돼요**. 이 가이드에서 거부를 보게 된다면, 그것은 도구가 제 역할을 하는 것이에요. 여러분이 원하는 바로 그거죠.
:::

---

## 시작하기 전에 필요한 것

- **코딩 에이전트**: 터미널 및 파일 시스템 접근 권한이 있어야 해요. 전체 작업을 주도하는 드라이버 역할을 해요.
- **해당 언어 쌍의 실제 번역 문장**: 사람이 직접 번역한 문장 쌍이 수백 개만 있어도 시작하기에 충분해요. 이중 언어 교재, 커뮤니티 아카이브, 번역된 공공 기록물, 교육 자료 등을 활용할 수 있어요. 양보다는 질이 중요해요.
- **선택 사항이지만 강력한 자원:** 대상 언어로 된 단일 언어(monolingual) 텍스트, 이중 언어 사전, 출판된 참조 문법서, 형태소 분석기(FST). 시작할 때 이 모든 것이 **반드시** 필요한 것은 아니에요. 도구가 어떤 자원이 준비되어 있고 어떤 기능을 활성화할 수 있는지 정확히 알려줘요.
- **컴퓨팅 자원:** 노트북 한 대면 충분해요. 가드레일, 데이터 분할, 합성, 감사, 점수 매기기 모두 CPU에서 실행되며, 기본 모델(처음부터 훈련하는 소형 트랜스포머) 훈련 역시 CPU에서 돌아가요. GPU는 가장 큰 프리셋(`nllb-600m`)을 선택할 때만 필요해요 — [5단계](#step-5--train)를 참고하세요.

> 🗣️ **에이전트에게 이렇게 지시하세요:** *"`python3 -m pip install 'nmt-forge[hf]'` 옵션을 포함하여 nmt-forge를 설치하고, `nmt-forge` 명령어가 잘 실행되는지 확인해 줘.
> 우리는 이제 솔직하고 엄밀하게 영어 → \<your language\> 번역 모델을 훈련할 거야."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

`[hf]` 엑스트라는 훈련 스택(torch, transformers, accelerate,
tokenizers, sentencepiece, peft)을 포함해요. CPU 전용 휠로도 충분해요. 다른 것은 필요 없으며,
Champollion 리포지토리를 클론할 필요도 없어요. 모든 명령어는 `--json`을 지원해요
(stdout으로 단일 JSON 문서를 출력하며, 거부 시 `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status`를 통해 언제든 다음 명령어를 확인할 수 있어요.

에이전트는 명령어를 작성하기 전에 Champollion MCP 서버의 `get_training_guardrails` 도구(인자 없음, 선택 사항 `topic`)를 호출하여
전체 룰북(10가지 가드레일과 각 가드레일이 방지하는 실수 목록)을
자신의 컨텍스트에 로드할 수 있어요. 에이전트를 직접 이끌고 있다면 먼저 이 작업을 수행하도록 요청하세요.

---

## 1단계 — 언어를 고르고 실제로 무엇이 존재하는지 보기

모든 프로젝트는 인덱스에 그 언어가 *가진* 것을 정직하게 물어보는 것으로 시작해요.

> 🗣️ **에이전트에게 말하기:** *"내 대상 언어의 ISO 639-3 코드로 `nmt-forge discover`을 실행하고 어떤 데이터가 존재하고 무엇이 없는지 요약해줘."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **도구가 하는 일.** 해당 언어의 Champollion **카드**(해당 언어에 대해 알려진 정보의 단일 소스)를 읽고,
여기에 기록된 문자 체계, 형태소 분석기, 사전, 말뭉치, 평가 데이터셋을 보고한 다음,
해당 언어를 **자산 사다리(asset ladder)** 위에 배치해요. (카드는 `--cards-dir`로 지정한 디렉터리,
로컬 체크아웃 또는 `node_modules/champollion`, 혹은 퍼블릭 카드 인덱스에서 가져와요. 캐시되므로
처음 가져온 후에는 오프라인에서도 작동해요. 캐시가 없는 오프라인 상태라면 `champollion network card <code> --json` 명령어로 카드를
디렉터리에 내보낸 뒤 `--cards-dir` 옵션으로 전달하세요.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **결과를 해석하는 방법.** `✓` 표시는 지금 당장 할 수 있는 작업을 나타내고, `?`
표시는 자원을 기다리고 있는 사다리 단계를 나타내요. 중요한 점은 **카드에 없다는 것은 *알려지지 않음(unknown)*을 의미할 뿐, "이 언어에는 아무것도 없다"는 뜻이 결코 아니라는 사실이에요.** 정보가 부족한 카드는 막다른 길이 아니라 여러분이 알고 있는 내용을 추가해 달라는 초대장이에요. 그리고 빈 카드라 하더라도 1단계에서 가드레일이 완비된 훈련 루프를 온전히 진행할 수 있어요. 풍부한 카드(예: Plains Cree)는 상위 단계를 자동으로 연결해 줘요. 평가 데이터셋에는 **절대 이 데이터로 훈련하지 마세요(NEVER TRAIN ON THIS)** 플래그가 붙어 전달되며, 해당 언어 전용 심판(referee)이 즉시 연결 가능한 상태로 준비돼요. 5단계는 해당 심판 패키지가 설치되어 있을 때만 체크돼요. 그렇지 않으면 설치 명령어와 함께 ✗ *UNAVAILABLE*로 표시돼요. 또한 심판은 외부 서비스에서 단어를 조회할 수 있으므로 로컬 전용 또는 봉인된(sealed) 테스트 세트에는 로드되지 않아요.

그런 다음 프로젝트를 스캐폴딩해요:

> 🗣️ **에이전트에게 말하기:** *"이 언어 쌍을 위해 `nmt-forge init`로 프로젝트를 스캐폴딩하고 그것이 생성하는 `NEXT_STEPS.md`을 읽어줘."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ 이 명령은 워크스페이스(모든 가드레일이 참조하는 `.forge/` 디렉터리), **스타터 설정 파일**, 그리고 *사용자와 에이전트*를 위해 작성된 `NEXT_STEPS.md` 브리프를 생성해요. 여기에는 명령어 실행 순서, 해당 언어의 자산 사다리, 필수 준수 사항이 포함되어 있어요. 아래의 모든 작업을 위한 안내도 역할을 해요. 설정 파일의 경로는 상대 경로이므로 프로젝트 디렉터리 내부에서 forge를 실행하세요.

`init`는 훈련할 **모델**(`--model`이며, `config.json`에 명시적인 수치로 기록됨)도 함께 선택해요. 기본값은 `cpu-tiny`이며, `cpu-finetune --base
<hf-id>`, or `nllb-600m`도 가능해요. [5단계](#step-5--train)에서 모델 선택에 대해 설명해요. 해당 언어의 카드가 아직 없더라도 `nmt-forge init <code> --no-card --name "<name>"`는
프로젝트 스캐폴딩을 정상적으로 생성해요. 카드의 모든 정보는 '알려지지 않음(unknown)'으로 기록되며, 임의로 지어내지 않아요.

---

## 2단계 — 분석기와 사전 가리키기 (가지고 있다면)

이 단계는 사다리의 **3~4단**에 관한 것이에요. 여러분의 언어에 분석기가 없다면, [4단계](#step-4--split-your-real-data-safely)로 건너뛰세요 — 실제(그리고 역번역된) 데이터만으로 훈련하게 되는데, 이것은 완전히 정당한 경로예요.

분석기와 사전이 *실제로* 존재한다면, 검증된 훈련 데이터를 *제조*하는 능력을 잠금 해제해요 — 병렬 텍스트가 거의 없는 언어에게 가장 큰 지렛대죠.

> 🗣️ **에이전트에게 말하기:** *"카드에 이 언어를 위한 형태소 분석기와 사전이 나와 있어. 카드의 설치 지침에 따라 그것들을 가져오고, 문서화된 환경 변수를 통해 언어 팩이 그것들을 가리키도록 설정한 다음, 분석기가 몇 개의 알려진 단어를 왕복(round-trip)하는지 확인해줘."*

🛠️ **도구가 하는 일 — 그리고 넘지 않을 경계.** 분석기(FST)와 사전은 **각자의 라이선스 하에 사용자가 직접 가져오는 별도의 도구예요**. 이 스위트는 **결코 그것들을 번들하거나 재배포하지 않아요** — 그것들이 어디서 오고 라이선스가 무엇인지 가리켜주고, 여러분이 가져오는 거예요. 이건 관료주의가 아니에요: 많은 언어 자원은 실제 허가와 주권 제약을 담고 있고, 도구는 설계상 그것들을 존중해요.

그 연결 조직은 **언어 팩**이에요: *여러분의* 분석기, 사전, 정서법 규칙, 그리고 문법이 인용된 문장 템플릿을 엔진에 맞추는 작은 플러그인이죠. 이 스위트는 자체적으로 **어떤** 팩도 제공하지 않아요 — 팩은 각자의 언어와 함께 살아요(예를 들어 Plains Cree 팩은 자체 프로젝트에 살면서 모듈 경로로 연결돼요).

👀 **결과를 읽는 법.** 분석기가 **왕복(round-trip)**하기를 원할 거예요: 어떤 형태를 철자화하고, 그 철자를 다시 넣으면, 같은 문법 태그를 얻는 것이죠. 그렇지 않다면, 팩의 **정규화기(canonicalizer)** — 두 구성 요소가 만나는 어디서든 철자를 정규화하는 그 하나의 함수 — 에 규칙이 필요한 것 같아요. 이것을 제대로 하는 것이 중요해요: 조정되지 않은 단 하나의 문자(`ý` 대 `y`)가 한때 생성 파이프라인에서 몇 주 동안 조용히 1,375개의 동사를 삭제한 적이 있어요. 도구의 **깔때기 감사(funnel audit)**는 각 단계에서 생존자를 세는데, 바로 그런 조용한 누락이 숨을 수 없도록 하기 위함이에요.

---

## 3단계 — 문법 규칙에서 훈련 데이터 합성하기

분석기 + 사전 + 문법이 인용된 템플릿 팩이 있으면, 검증된 쌍을 수십만 개 제조할 수 있어요.

> 🗣️ **에이전트에게 말하기:** *"우리 언어 팩을 사용해서 `nmt-forge synth`로 합성 훈련 데이터를 생성한 다음, 커버리지 리포트를 보여줘."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **도구가 하는 일 — 방출 법칙(emit law).** 출력에 도달하는 모든 행은 어떤 팩도 거부할 수 없는 규칙을 충족해야 해요:

- **왕복 검증됨** — 생성된 모든 단어는 *생성 → 분석 → 같은 분석*을 통과하거나, 그 행은 폐기돼요. 검증되지 않은 형태는 절대 방출되지 않아요.
- **문법 인용됨** — 모든 템플릿 종류는 자신이 옮겨 적은 출판된 문법을 인용해요. 인용되지 않은 템플릿은 존재하지 않아요; 코드가 그것들을 로드하기를 거부해요.
- **커버리지 확인됨** — 템플릿은 필수 문법 현상 체크리스트(명령형, 의문문, 소유, 역형태 등…)에 대비해 회계 처리돼요. *필수* 현상에 예제가 0개라면, 빌드가 실패해요. 이것은 "백만 개의 문장, 전부 같은 몇 가지 형태"라는 함정 — 구조적 구멍을 숨기는 물량 — 에 대한 가드예요.
- **출처 각인됨** — 모든 합성 행은 `synthetic: true`로 표시돼요. 그 각인은 하중을 견뎌요: 레지스트리는 합성 행을 테스트 세트로 등록하기를 **거부**해요. 테스트는 실제 데이터만 써요.

👀 **결과를 읽는 법.** 커버리지 리포트에서 **커버리지 0인 필수 항목**(여러분의 템플릿이 결코 생성하지 못한 문법 현상)과 **종류 분포**를 살펴보세요 — 두 개의 템플릿 형태가 지배적이라면, 샘플러의 종류별 상한(기본값 15%)이 그것들을 재조정해서 어떤 단일 패턴도 모델 경험의 절반이 되지 않도록 해요.

:::tip[분석기가 없나요? 대신 역번역(backtranslation)을 활용하세요]
규칙 기반 합성이 불가능하지만 대상 언어로 된 **단일 언어(monolingual)** 텍스트가 있다면, 에이전트에게 **역번역(backtranslation)** 레인을 사용하도록 요청해 보세요. 제공된 역방향 모델을 사용해 단일 언어 텍스트를 영어로 기계 번역한 뒤, 각 결과를 **실제** 대상 언어 문장과 짝지어 줘요. 이렇게 하면 대상 언어 문장의 자연스러움이 그대로 유지돼요.
이는 CLI 하위 명령어가 아니라 Python 라이브러리 호출(`nmt_forge.training.backtranslation.backtranslate`) 방식이에요. 에이전트가 이를 감싸는 짧은 스크립트를 작성하고 태그가 지정된 출력 파일을 설정 파일의 `data.synthetic` 레인에 추가하면 돼요. 이 호출은 **단일 언어 텍스트의 유출 감사를 먼저 수행**해요. 해당 텍스트에 평가 데이터가 은밀하게 포함되어 있을 수도 있기 때문이에요.
자세한 내용은 [역번역 쿡북](/docs/network/tutorials/back-translation)을 참고하세요.
:::

---

## 4단계 — 실제 데이터를 안전하게 분할하기

이제 **실제** 번역 쌍을 준비하고, 모든 것을 평가하는 기준이 될 문장들을 따로 떼어놓으세요. 저자원 기계 번역에서 결과를 망치는 가장 치명적인 실수가 바로 여기에 숨어 있으며, 가드레일이 제값을 톡톡히 하는 부분이기도 해요.

파일은 `.tsv`(줄당 원문, 탭(TAB), 번역문 순서로 한 쌍씩 작성. `# `로 시작하는 줄은 주석) 또는 `.jsonl`(줄당 `{"source": …,
"target": …}`) 형식이어야 해요.

**이미 테스트 세트가 있는 경우**(교사나 간호사 등 전문가가 검수한 데이터, 비공개 데이터 등)에는 별도의 파일로 보관하고, 등록한 뒤, 이에 맞추어 말뭉치를 필터링하고 학습(train) 및 검증(dev) 데이터만 분할하세요.

> 🗣️ **에이전트에게 이렇게 지시하세요:** *"테스트 세트를 등록하고, 이를 기준으로 말뭉치의 데이터 유출 감사를 수행한 다음, 정제된 말뭉치를 `nmt-forge split` 명령어로 그룹 간 중복 없이(group-disjoint), 고정된 시드(fixed seed)를 사용해 train과 dev로 분할해 줘."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**테스트 세트가 없는 경우**에는 동일한 단계에서 말뭉치로부터 테스트 세트를 함께 분할하세요.

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **도구가 하는 일 — 분할 가드(split-guard).** 이 기능은 **그룹 비신접 분할(group-disjoint splitting)**을 수행해요. 원문 *또는* 번역문을 공유하는 모든 번역 쌍을 하나의 그룹으로 묶고, 각 그룹 전체를 완전히 한쪽 세트에만 배정해요. 그런 다음 **중복이 전혀 없음(zero overlap)을 검증**하고, 중복이 발견되면 작업을 거부해요.

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

이를 통해 **"Feed him" / "Feed her" 데이터 유출**을 원천 차단해요. 교재에서 두 영어 연습 문장이 하나의 대상 언어 단어(`asam`)로 매핑되는 경우가 있어요. 단순 무작위 분할을 적용하면 한 문장은 train에, 동일한 쌍은 test에 들어가 모델이 단순 암기로 테스트를 "통과"하게 돼요. 실제 한 프로젝트에서는 54개 테스트 행 중 17개가 이런 식으로 유출되어 깨끗한 행의 점수(44점)에 비해 83점을 기록했고, 이 점수를 기반으로 한 모든 분석 결과가 무효화되었어요. `--register project`는 dev 세트(및 함께 분할된 test 세트)를 스타터 설정이 이미 가리키고 있는 이름인 `project-dev` / `project-test`로 기록하므로, 이후 실행되는 모든 명령어가 이 파일들을 *절대 학습에 사용해서는 안 되는 평가 세트*로 인식해요. 테스트 세트가 이미 등록되어 있는 경우, `split`는 새로 생성된 train 및 dev 파일을 즉시 테스트 세트와 비교하여 스크리닝해요.

🛠️ **그리고 데이터 유출 감사(leak-audit).** `leak-audit`는 등록된 모든 평가 세트를 기준으로 각 행을 스크리닝하고, 사용자의 말뭉치에서 추출한 예시와 함께 **제외할 항목**을 알려줘요. 여기에는 번역문이 다르더라도 원문이 테스트 프롬프트와 동일한 행, 번역문이 테스트 정답과 동일한 행, 번역문이 테스트 정답의 유사 중복(near-duplicate, 정답을 포함하거나 정답의 일부이거나 악센트를 무시했을 때 90% 이상 일치하는 경우)인 행이 포함돼요. 반면 **의도적으로 유지하는 항목**도 안내해요. 문장 구조는 같지만 단어 하나만 바뀐 *템플릿 형제 문장(template siblings)*(*"I see the dog"* / *"I see the cat"*), 그리고 답변은 다르지만 프롬프트가 유사 중복인 경우가 이에 해당해요. 훈련 데이터에 템플릿 형제 문장이 있는 테스트 행은 목록으로 정리되며, 스타터 설정에서 `eval.near_dupe_corpus`을 훈련 파일로 지정해 두었기 때문에 최종 보고서에서는 형제 문장이 *없는* 테스트 행을 별도의 "(strict)" 점수로 산출해요. 이를 통해 형제 문장으로 인해 부풀려진 낙관적 점수를 명확히 확인할 수 있어요. 대부분의 테스트 행에 형제 문장이 있고 테스트 세트가 고정되어 있는 경우, `--clean-to <file> --drop-test-twins`를 사용해 훈련 데이터에서 이러한 쌍둥이 문장을 제거할 수도 있어요(제거 전후의 strict 하위 세트를 보고하며, 훈련 데이터가 완전히 비워지는 상황은 거부해요). 별도의 파일(`corpus.notwins.jsonl`)을 지정하세요. 이 파일은 전체 데이터 말뭉치와 나란히 존재하는 쌍둥이 제거 모델용 말뭉치가 되며, leak-audit은 설정 파일, 실행(run), 분할(split)에서 이미 읽고 있는 파일을 덮어쓰지 않아요. 결과는 결정론적이며, 테스트 파일 자체의 텍스트는 절대 출력되지 않아요.

👀 **결과를 읽는 법.** **verified: 0 shared** 줄을 보고 싶을 거예요. 대신 `SplitLeakageError`을 얻는다면, 행을 손으로 삭제하지 마세요 — 그건 문제를 재배치할 뿐이에요. 그룹 분리 분할을 다시 실행하세요; 그것이 해결책이고, 오류 메시지가 그렇게 말해줘요.

:::danger[벤치마크로 절대 훈련하지 마세요]
공유 레지스트리에서 평가 데이터셋을 가져온다면(`nmt-forge registry add-harness`), 도구는 그것에 각인을 찍고 훈련에 사용 금지로 취급해요 — **모든** 레지스트리 벤치마크는 *do-not-train*으로 플래그가 붙어요. 정당하게 할 수 있는 것으로는 무엇이든 파인튜닝하세요; 그저 테스트 세트로는 절대 하지 마세요. 이것은 전체 네트워크의 [단 하나의 규칙](/docs/network/leaderboard/rules)이에요.
:::

---

## 5단계 — 훈련

하나의 설정 파일이 전체 실행을 정의하고, 하나의 명령어가 이를 재현 가능하게 실행해요. `nmt-forge init`가 이미 이 파일을 작성해 두었어요.

> 🗣️ **에이전트에게 이렇게 지시하세요:** *"`config.json`를 읽고, 합성 레인을 만들었다면 추가한 뒤 `nmt-forge preflight run --config config.json`를 실행해 줘. 지적된 문제가 있다면 수정하고, `nmt-forge run config.json`를 실행한 다음 스케줄 진단 결과를 모니터링해 줘."*

기본 `cpu-tiny` 모델과 합성 데이터 레인이 추가된 스타터 설정 파일의 일부예요.

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**어떤 모델을 선택해야 할까요?** `init` 실행 시(`--model`) 선택할 수 있으며, 모든 수치는 `config.json`에 기록돼요.

| 프리셋 | 설명 | 요구 사항 | 솔직한 기대 성능 |
|---|---|---|---|
| `cpu-tiny` (기본값) | 처음부터 훈련하는 소형 트랜스포머(약 600만 파라미터). 어휘집은 오직 **학습용(training)** 행에서만 학습해요 | 노트북 CPU, 다운로드 불필요 | 낮음: 1~2천 개 문장 쌍 기준 chrF++ 점수는 대략 5~30 수준(상위 점수는 데이터가 매우 정형화된 템플릿일 때만 해당). 일반적인 번역이 아니라 학습 데이터 내의 구문과 패턴만 처리해요 |
| `cpu-finetune --base <hf-id>` | 직접 지정한 사전 훈련된 소형 Marian/opus-mt 모델을 파인튜닝해요. *관련성 높은* 언어 쌍의 모델을 선택하세요 | CPU, 약 300MB 다운로드 | 관련 언어 쌍이 있는 경우 대개 `cpu-tiny`보다 우수해요. 짐작만 하지 말고 dev 세트에서 직접 측정해 보세요 |
| `nllb-600m` | LoRA를 적용한 NLLB-200 distilled 600M | GPU, 약 2.5GB 다운로드 | 가장 강력한 시작점이에요. CPU 환경에서는 실행 시간 체크에 걸려 몇 분 내에 거부돼요 |

`cpu-tiny`의 의의는 점수 자체가 아니에요. 가드레일, 유출 감사, 사전 등록된 테스트, CLI가 호출할 수 있는 모델에 이르기까지 **전체** 루프를 실제로 동작하게 만드는 데 있어요. 이렇게 해 두면 나중에 더 나은 모델을 동일한 프로젝트에 투입하고 동일한 방식으로 측정할 수 있어요.

`preflight`는 실행 중 거치게 될 모든 관문을 ✓ 또는 ✗로 나열하고, 각 ✗에 대한 해결책을 안내해요. 여기에는 훈련용 엑스트라 패키지 설치 여부(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`)도 포함돼요.

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **도구가 하는 일 — 한 번에 네 개의 가드레일.**

- **훈련 전 데이터 유출 감사.** 골드 데이터, 합성 데이터, 역번역된 텍스트 등 *모든* 레인을 등록된 *모든* 테스트 세트 및 봉인된 세트와 비교하여 스크리닝해요. 정답 유출(동일한 프롬프트나 정답, 정답의 유사 중복) 및 파일 전체 일치는 치명적인 오류로 처리돼요. 템플릿 형제 문장은 유지되고 보고돼요(고정된 테스트 세트의 경우 `--drop-test-twins` 명령어로 제거 가능). 데이터 구성이 깨끗해질 때까지 훈련은 시작되지 않아요.
- **Dev 펜스(Dev-fence).** 훈련은 **등록된 dev 세트 없이는 시작을 거부**하며, 체크포인트 선택 역시 오직 dev 세트만을 기준으로 수행하고 테스트 세트는 절대 사용하지 않아요. (심지어 `cp test.jsonl dev.jsonl` 꼼수를 잡아내기 위해 dev 세트의 내용이 테스트 세트와 겹치는지도 확인해요.) 체크포인트 선택 시 dev **손실(loss)**이나 dev **생성 메트릭(generation metric)**을 사용할 수 있어요. dev 세트를 디코딩하고 실제 출력의 점수를 매기는 방식이 더 솔직한 신호예요(스타터 설정은 디코딩된 dev 출력에 대해 chrF++를 사용해요).
- **스케줄 건전성(Schedule-sanity).** 합성 데이터의 비중이 높다면, 도구는 데이터 구성 크기로부터 중단 하한선을 *도출*하고 **정체기(plateau)** 동안 훈련을 유지해요. 이 정체기는 모델이 쉬운 합성 데이터 학습을 끝마쳤지만 아직 실제 품질로 전이되지 않은 단계를 말해요. 이를 통해 순진한 조기 종료(early stopping)로 계획의 1/20 지점에서 중단되어 버리는 "하프 에포크 사망(half-epoch death)"을 방지해요. dev 세트 평가 주기 또한 실행 규모에 따라 도출되므로 소규모 훈련이라도 정상적으로 평가돼요. 스케줄이 개입할 때마다 dev 손실 추이와 그 이유가 알기 쉬운 언어로 출력돼요.
- **노출 계산 + 태그 지정된 합성 데이터.** 적은 양의 실제 데이터가 묻히지 않도록 골드 데이터에 가중치를 부여(반복)해요. 매니페스트에는 **고유 문장당 유효 노출 수**를 기록하여 A/B 테스트가 공정하게 유지되도록 해요. 합성 데이터 소스에는 태그가 붙지만, 골드 데이터는 태그 없이 유지되어 출력 스타일의 중심을 잡아줘요.

훈련은 유일하게 시간이 다소 걸리는 단계예요. 에이전트는 반복적으로 상태를 폴링하는 대신, 백그라운드에서 로그 파일로 출력을 리다이렉트하여 실행하고 주요 라인(`refused`, `Error`, `wall-clock`, `RUN EXIT`)을 모니터링해야 해요. 손실 곡선과 중지 버튼이 포함된 실시간 패널이 **사용자**를 위해 열려요(해당 포트가 비어 있을 경우 `http://127.0.0.1:8377`에서 확인 가능). 처음 몇 분 동안 forge는 훈련 속도를 측정하고 실제 소요 시간(wall-clock) 예측치를 출력해요. 처음에는 초기 추정치를, 이후에는 안정 상태의 추정치를 보여줘요. `init`는 시간 예산(budget)을 설정하지 않아요. 예산은 도구가 임의로 정하는 것이 아니라 사용자가 결정해야 하는 수치이기 때문이에요. 예상 소요 시간을 확인한 뒤 허용 가능한 시간을 결정하고, `config.json`의 `model` 항목 아래에 `"time_budget_hours": <hours>`를 추가하세요. 그 이후부터 forge는 해당 시간 내에 완료할 수 없는 실행을 거부하므로, 설정이 잘못된 작업을 빠르게 실패(fail-fast)시킬 수 있어요. 직접 설정하기 전까지는 forge의 안전 상한선만 적용돼요. 며칠씩 걸릴 작업은 중지되며, 모든 예측 출력에는 누군가가 선택한 예산이 아니라 "no budget set; … ceiling"으로 표시돼요.

👀 **결과를 해석하는 방법.** 실행이 끝나면 **신뢰구간이 포함된 dev 보고서**가 출력돼요(신뢰구간 없는 단순 점수 출력은 존재하지 않아요). 그 후 다음 명령어가 안내돼요(아래 수치는 예시예요).

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

조기 정지를 지나 훈련을 *유지*했다고 설명하는 `schedule-sanity` 메시지를 본다면, 그것은 정체기 가드가 작동하는 것이에요 — 좋아요. 실행은 또한 **매니페스트**를 작성해요: 설정 해시, 데이터 파일 해시, 시드, 그리고 유도된 스케줄까지요, 그래서 전체 실행이 재현 가능해요.

---

## 6단계 — 정직하게 평가하기

모델을 가지고 있어요. 테스트 세트에서 채점하기 전에, 여러분이 기대하는 것을 *먼저* 적어두세요.

> 🗣️ **에이전트에게 이렇게 지시하세요:** *"테스트 세트 평가를 위한 사전 등록(preregistration)을 작성해 줘. 예측 메트릭, 변화 방향, 마진과 함께 한 줄 이유를 적고, 실행 결과를 export해서 테스트 세트를 딱 한 번 평가하도록 해 줘."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg`는 이 모델을 평가할 사전 등록을 지정해요. 테스트 세트에 대해 사전 등록이 하나만 있는 경우 export가 이를 자동으로 찾아내요. 동일한 테스트 세트에 대해 두 번째 모델과 자체 사전 등록이 있는 경우 export는 임의로 추측하지 않으므로 각각 명시적으로 지정해 주어야 해요.

(사전 등록은 테스트 세트에 대한 첫 점수를 매기기 전이라면 언제든 진행할 수 있어요. `nmt-forge
status`는 훈련 전에 이를 요청해요.)

🛠️ **도구가 하는 일 — 스토리텔링 방지 가드.**

- **사전 등록(Preregistration).** 등록된 **테스트(test)** 세트의 점수를 매기려면 데이터를 처음 확인하기 *전에* 작성된 사전 등록이 반드시 필요해요. 예측 파일은 JSON 배열 형태예요. 각 예측 항목에는 메트릭과 근거가 명시되며, 기준 모델 대비 변화 방향(`nmt-forge prereg check`가 자동 검증)이나 사람이 직접 확인하는 자유 형식의 기대 사항이 포함돼요. 수정되지 않은 기본 템플릿, Markdown, 산문 형식은 지원되는 형식 및 수정 방법 안내와 함께 거부돼요. 사전 등록이 없으면 평가가 단순히 **거부**돼요.

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  이는 사후 확신("구전 설화에서 점수가 오른 건 당연하지")을 사전 예측인 것처럼 포장하는 행위를 막아주는 안전장치예요. *실패한* 추측까지 솔직하게 기록해야만 성공한 결과가 신뢰를 얻을 수 있어요.
- **언제나 신뢰구간 포함.** 모든 점수는 95% 부트스트랩 신뢰구간(CI)과 함께 표시돼요. 신뢰구간 없는 출력은 제공되지 않아요. 신뢰구간이 겹치는 `+0.5` 상승은 개선으로 인정되지 않아요.
- **평가 원장(The eval-ledger).** 평가 세트를 읽을 때마다 모든 내역이 기록돼요(추가 전용, 위변조 방지). 세트가 얼마나 "소모(spent)"되었는지는 `nmt-forge ledger show --set project-test`로 확인할 수 있어요. **봉인된(Sealed)** 세트는 단 한 번만 사용할 수 있어요. 한 번 점수를 매기면 닫혀요(두 번째 `export` 시도는 거부되며, `--no-eval`는 재채점 없이 패키징만 수행해요).

`export`는 dev 기준으로 선택된 체크포인트를 사용해 테스트 세트를 디코딩하고, 점수를 산출한 뒤, 알기 쉬운 언어로 작성된 **진단 및 권장 사항(Diagnosis & Recommendations)** 섹션을 덧붙여요. 또한 그 결과를 **mt-eval 보고서**(`export/evaluation/`)로 작성하여, `mt-eval compare`를 통해 동일한 테스트 세트에서 하네스로 측정한 다른 어떤 방식과도 여러분의 모델을 나란히 비교할 수 있게 해줘요. 그리고 테스트 문장을 일절 포함하지 않는 `export/model/` 디렉터리에 모델 자체를 패키징해요(8단계). `export/evaluation/`에는 테스트 문장이 포함되어 있으므로 모델과 함께 복사해서는 안 되며, 테스트 세트와 함께 안전하게 보관하세요. 패키징 없이 점수만 확인하고 싶을 때는 `nmt-forge evaluate <run-manifest>`를 사용하세요.

👀 **결과를 해석하는 방법.** 수치를 확인할 때는 반드시 **신뢰구간과 레지스터(문체/사용역)별 점수를 함께 확인**하세요. 훈련 데이터가 테스트 세트와 문장 템플릿을 공유한다면 "(strict)" 점수를 살펴보고, 기뻐하기 전에 **어떤 메트릭을 신뢰해야 할지** 점검하세요. 동일한 등록 세트에 대해 다른 시스템의 출력 파일 점수를 더 많은 메트릭으로 평가하려면 다음과 같이 실행하세요.

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover`는 여러분의 언어 계통에 대한 각 지표의 **측정된 신뢰성**을 보여줘요(WMT 메타 평가에서 나온 것). 일부 계통에서는 BLEU 같은 지표가 인간의 판단을 거의 추적하지 못하는 반면 COMET은 추적해요; 많은 저자원 계통에서 정직한 대답은 *측정되지 않음*이에요 — 이 경우 어떤 자동 숫자가 아니라 원어민의 판단이 진짜 신호예요. [지표 신뢰성](/docs/network/specifications/metric-reliability)을 참고하세요.

:::tip[여러분 언어만의 심판]
여러분의 언어에 LYSS 평가 표준(예를 들어, 두 철자가 문서화된 장모음 관례로만 다르다는 것을 아는 린터)이 있다면, `--plugin`로 연결하면 chrF++와 나란히 채점돼요 — 그리고 심지어 체크포인트를 *선택*할 수도 있어서, 승리하는 모델은 그 언어 자신의 심판이 선호하는 모델이 돼요. 모든 플러그인 숫자도 신뢰 구간을 얻어요.
:::

---

## 7단계 — 반복

이제 개선해요 — 그리고 모든 개선은 동일하게 정직한 방식으로 측정돼요.

> 🗣️ **에이전트에게 이렇게 지시하세요:** *"한 가지를 변경해 줘 — 템플릿 종류 추가 / 역번역 데이터 추가 / 다른 모델 프리셋 적용 등 — 그리고 재훈련한 뒤 유의성 검정을 포함해 dev 세트에서 이전 실행과 A/B 테스트를 진행해 줘."*

각 실행은 이미 신뢰구간과 함께 dev 점수를 출력해요. 쌍체 검정(paired test)을 수행하려면 각 실행 결과로 dev 세트를 디코딩하세요 — `nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json`은 `eval.battery`이 `project-dev`로 지정된 설정 파일 사본이에요 — 그런 다음:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **도구가 하는 일.** `compare`은 단순한 뺄셈이 아니라 **쌍 유의성 검정(paired significance test)**을 실행해요, 그래서 "B가 A를 이긴다"는 통계가 뒷받침하는 주장이에요 — 잡음이 아니고요. **dev** 세트에서 반복하세요(그게 그것의 용도예요); **test** 세트는 드물게 하는 사전 등록된 점검을 위해 남겨두세요; **봉인된** 세트는 맨 마지막을 위해 남겨두세요.

👀 **결과를 읽는 법.** 진짜 개선은 신뢰 구간 *그리고* 유의성 검정을 통과해요. 그렇지 않다면, 여러분은 어쨌든 뭔가를 배운 거예요 — 그 지렛대는 여러분이 바랐던 것보다 약하다는 것을요, 알아둘 가치가 있는 거죠. 정체기/커버리지/누출 가드는 여러분이 비교하는 숫자들이 신뢰할 수 있다는 것을 의미하니, 여러분 자신의 반복 루프를 실제로 믿을 수 있어요.

데이터가 부족한 언어에 대한 대략적인 성과 순으로, 흔한 다음 지렛대들:

1. **더 많은 실제 문장 쌍** — 수천 문장 규모에서는 어떤 설정값을 튜닝하는 것보다 실제 문장 쌍을 하나라도 더 추가하는 것이 훨씬 효과적이에요.
2. **합성 데이터의 커버리지 확대** — 커버리지 보고서에서 지적된 누락된 문법 현상을 추가하세요.
3. **역번역(Backtranslation)** — 대상 언어의 단일 언어 텍스트를 더 많은 훈련용 번역 쌍으로 전환하세요.
4. **더 강력한 출발점** — 관련 언어 쌍의 베이스 모델을 사용한 `cpu-finetune`이나 GPU 환경의 `nllb-600m`을 적용해 보고, 동일한 dev 세트에서 `cpu-tiny`과 성능을 비교 측정해 보세요.
5. **커리큘럼(Curriculum)** — 합성 데이터로 사전 훈련을 진행한 후 실제 문장 쌍으로 파인튜닝하세요.

---

## 8단계 — 모델 활용 및 Network에 등록하기

정직하게 훈련된 모델은 지금 바로 활용할 수 있는 가치가 있으며, [Champollion Network](/docs/network/)가 추구하는 결과물이기도 해요.

**직접 활용하기.** `export`는 이미 모델을 패키징해 두었어요. 독립적인 모델 디렉터리, `forge-model.json`(모델 정보 및 측정 방식), champollion 플러그인 매니페스트(`method.json`), 그리고 정확한 명령어가 담긴 `DEPLOY.md`이 포함되어 있어요.

> 🗣️ **에이전트에게 이렇게 지시하세요:** *"export된 모델을 서빙하고 champollion CLI를 사용해 우리 앱의 문자열을 번역해 줘."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve`는 champollion **api 메서드** 규약(`POST /translate`)과 **OpenAI 호환** `/v1/chat/completions`를 지원해요. 후자는 `--method local`가 사용하는 방식이며, `DEPLOY.md`에는 전자를 위한 `champollion.config.json` 코드 조각이 포함되어 있어요. 이 서버는 `127.0.0.1`에서만 리슨해요. 네트워크에 공개하려면 토큰(`--token` 또는 `NMT_FORGE_SERVE_TOKEN`)이 필요해요. NMT 모델은 텍스트를 번역할 뿐 지시문(instruction)은 무시하므로, CLI가 LLM 방식에 전달하는 어조 프롬프트, 코칭 파일, 용어집 등은 영향을 미치지 않아요. 그리고 모델의 번역 결과가 독자에게 전달되기 전에는 해당 언어에 능통한 화자의 검수가 반드시 필요해요.

**Network에 제출하기.**

> 🗣️ **에이전트에게 말하기:** *"이 모델을 하나의 방법(method)으로 패키징하고 우리 언어 쌍의 리더보드에 제출해줘."*

- **[방법 제출하기](/docs/network/getting-started/submit-a-method)**는 여러분의 모델을 네트워크 항목으로 바꿔서, 공개 참조 코퍼스에서 채점되고 여러분에게 귀속돼요.
- 여러분의 평가가 깨끗했기 때문에 — 그룹 분리, dev 펜스, 누출 감사, CI 포함, 사전 등록 — 여러분의 제출은 대부분의 저자원 MT 주장을 침몰시키는 정밀 조사를 견뎌내요. 안티 게이밍 아키텍처(비밀 커뮤니티 소유 테스트 세트, 재현성 점검, 원어민 검증)는 이렇게 구축된 모델에게 장애물이 아니에요; 그것은 신뢰성의 각인이에요.
- 여러분의 언어에 **상금**이 열려 있다면, 정직하게 구축된 상시적이고 기준선보다 나은 방법이 바로 후원 풀이 보상하는 것이에요. 그리고 어떤 방법이 원주민 언어에 효과가 있을 때, **소유권이 커뮤니티로 이전될 수 있어요** — 여러분은 여기서 그것을 구축하고 그들은 자신들의 조건으로 그것을 배포해요. [상금 명세](/docs/network/specifications/prizes)와 [소유권 이전](/docs/network/sovereignty/ownership-transfer)을 참고하세요.

---

## 전체 흐름을, 한 호흡에

1. 해당 언어에 어떤 자원이 있는지 **파악하세요**(`discover`, `init`) — 없다는 것은 알려지지 않았음을 뜻하며, 자원이 없다는 뜻이 아니에요.
2. 형태소 분석기와 사전이 존재한다면 라이선스를 준수하며 이를 **지정하세요**(3~4단계).
3. 검증되고 인용 가능하며 커버리지가 확인된 훈련 데이터를 **합성하세요**(`synth`) — 또는 단일 언어 텍스트를 **역번역**하세요.
4. 실제 데이터를 그룹 간 중복 없이 **분할하고**, 테스트 세트와 비교하여 스크리닝한 후, 평가 세트를 등록하세요(`registry add`, `leak-audit`, `split`).
5. 하나의 설정 파일로 — 기본적으로 CPU에서 — dev 펜스, 유출 감사, 정체기 대응이 적용된 상태로 모델을 **훈련하세요**(`preflight`, `run`).
6. 예측을 먼저 기록하고, 항상 신뢰구간을 포함하며, 올바른 메트릭을 사용해 **평가하세요**(`prereg`, `export`).
7. 유의성이 검정된 A/B 테스트를 통해 지속해서 **개선하세요**(`compare`).
8. CLI를 통해 모델을 **활용하고**(`serve`), 정직하고 엄밀한 연구가 핵심 가치인 Network에 **제출하세요**.

저자원 MT 결과가 잘못되는 열 가지 방식을 외울 필요는 결코 없었어요. 도구가 정직한 경로를 기본값으로 만들고 설명과 함께 지름길을 거부했어요. 그것이 전체 아이디어예요: **가드레일이 아마추어 실수를 잡아내니 여러분은 언어에 집중할 수 있어요.**

## 계속하기

- [**MT 훈련을 평이한 언어로**](/docs/network/context/mt-training-concepts) — 여기의 모든 용어를, 예제와 함께 정의해요.
- [**모델을 정직하게 훈련하기**](/docs/network/getting-started/training-honestly) — 열 개의 가드레일을 한 페이지에, 각각의 측정된 배경 이야기와 함께요.
- [**파인튜닝된 모델**](/docs/network/tutorials/fine-tuned-model)과 [**역번역**](/docs/network/tutorials/back-translation) — 특정 기법에 대한 더 깊은 쿡북.
- [**코퍼스 생성**](/docs/network/tutorials/corpus-creation) — 다른 모든 것이 기대는 실제 데이터를 구축하기.
