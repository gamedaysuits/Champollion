---
sidebar_position: 2
title: "정직하게 모델 훈련하기 (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# 모델을 정직하게 훈련하기 (nmt-forge)

**30초 요약:** 대부분의 저자원 MT(기계 번역) "개선 사항"은 재검토 시 무용지물이 되곤 해요. 테스트 세트가 학습 데이터로 유출되었거나, 테스트 세트가 체크포인트를 선택했거나, 오차 범위(error bar)가 없는 노이즈에 불과한 향상이었기 때문이죠. **nmt-forge**는 이러한 실수를 구조적으로 방지하는 학습 도구 모음이에요. 정상적인 경로는 올바른 작업을 수행하고, 잘못된 경로는 *무슨 일*이 일어났는지, *왜* 결과가 오염되는지, 정확한 *해결책*이 무엇인지 알려주는 메시지와 함께 실행을 거부해요. forge가 학습을 담당하고, [평가 하네스](/docs/network/specifications/harness)가 점수를 매겨요. 여기에 포함된 모든 보호 장치는 Plains Cree 번역을 구축하면서 실제로 겪고, 측정하고, 문서화한 실수를 기계적으로 방지하도록 만들어졌어요. `python3 -m pip install 'nmt-forge[hf]'` 명령어로 설치할 수 있으며, 기본 모델은 노트북 CPU에서도 학습할 수 있어요.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

그것이 하나의 거부 안에 담긴 이 스위트의 전체 성격이에요.

## 5분짜리 이야기

여기 이 스위트가 태어난 계기가 된 실패 사례가 있어요. Cree 교과서는 여러 영어 연습 문장을 하나의 대상 문장에 매핑해요. *"Feed him"*과 *"Feed her"*는 둘 다 `asam`으로 번역돼요. 표준 무작위 분할은 한 사본을 훈련 데이터에, 그 쌍둥이를 테스트 세트에 넣어버렸어요 — 그래서 모델은 문자 그대로 54개의 "테스트" 정답 중 17개를 이미 본 셈이었고, 그 행들은 깨끗한 행의 44점에 비해 chrF++ 83점을 기록했어요. 하위 단계의 모든 것(그 "챔피언" 모델, 그 위에 세워진 발견들)은 폐기되어야 했죠.

nmt-forge의 분할기는 그것을 **구조적으로** 불가능하게 만들어요. 소스 *또는* 대상을 공유하는 쌍은 그룹화되고, 그룹 전체가 한쪽에 배치되며, 모든 분할 후에 겹침 제로 검증이 실행돼요:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(테스트 세트가 이미 교사의 검수를 거쳐 비공개로 유지되는 별도의 등록된 파일인 경우, `--test 0` 명령은 train과 dev만 분할해요.)

다른 모든 보호 장치도 동일한 형태예요. 실제 발생했던 실수를 기계적으로 제거하는 것이죠. 이 장치들을 통틀어 **학습 가드레일**이라고 불러요. 데이터를 분할하기 전에 꼭 읽어보세요(해당 단계에서 `nmt-forge init`와 `nmt-forge status`가 이곳을 안내하며, 에이전트도 MCP 도구인 `get_training_guardrails`를 통해 각 장치 뒤에 숨은 실측된 실수와 함께 동일한 규칙을 받게 돼요).

| 보호 장치 | 방지하는 실수 |
|---|---|
| **split-guard** | 공유된 원문/번역문을 통해 테스트 정답이 학습 데이터에 숨어드는 문제 |
| **dev-fence** | 테스트 세트가 체크포인트를 선택하는 문제(등록된 dev 세트가 없으면 학습 시작이 거부돼요) |
| **leak-audit** | 평가 텍스트로 학습하는 문제 — (번역이 다르더라도) 동일한 프롬프트, 동일하거나 거의 중복되는 정답, 또는 파일 전체가 해당돼요. 또한 의도적으로 *유지*하는 대상과 그 이유도 알려줘요. 단어 하나만 바꾼 템플릿 유사 문장(*"I see the dog"* / *"I see the cat"*)은 정답이 아니라 연습 문제에 해당하므로 삭제되지 않고 보고만 돼요. 단, 모든 테스트 행에 해당 문장이 있는 경우는 예외이며, 이 때는 `--clean-to … --drop-test-twins`이 고정된 테스트 세트의 학습 쌍둥이 문장을 제거해요. 결정론적이므로 동일한 말뭉치에서는 동일한 결과가 나와요 |
| **funnel-audit** | 파이프라인에서의 은밀한 데이터 유실(표기법 문자 하나 때문에 사전의 동사 1,375개가 몇 주 동안 눈에 띄지 않게 삭제된 적이 있어요) |
| **convention-lint** | 혼합된 맞춤법 규칙으로 학습하는 문제(이 경우 모델이 문장 중간에 표기법을 혼용하게 돼요) |
| **coverage-map** | 명령문, 의문문, 소유격이 전혀 없는 100만 개의 합성 문장 쌍 — 방대한 데이터 양이 구조적 결함을 숨기는 문제 |
| **sample-strata** | 두 가지 종류의 템플릿이 학습 신호의 절반을 독점하는 문제 |
| **ci-scoring** | 오차 범위 없는 점수(모든 수치는 95% 부트스트랩 신뢰구간과 함께 표시되며, 신뢰구간 없는 단순 점수 출력은 제공되지 않아요) |
| **schedule-sanity** | 조기 종료(early stopping)가 합성 데이터 비중이 높은 작업을 0.5 에포크 만에 중단시키는 문제: 97%의 합성 데이터와 정직한 *실제* dev 세트를 사용할 경우 dev 손실이 일찍 최저점을 찍고 다시 상승하는데, 이는 수렴이 아니라 모델이 대량의 합성 데이터에 과적합되는 현상이에요. 조기 종료 하한선은 데이터 구성 비율에서 자동으로 도출되며, 모든 개입은 dev 손실 궤적과 함께 설명돼요. 이는 정직하고 깔끔한 프로토콜 덕분에 발견된 문제로, 정직한 환경 구축이 진짜 버그를 드러내 줘요 |
| **eval-ledger** | 평가 데이터의 은밀한 적응적 사용(모든 읽기 작업이 기록되며, 밀봉된 세트는 단 한 번만 사용할 수 있어요) |
| **preregister** | 예측으로 둔갑한 사후 예측(postdiction)(사전 등록이 없으면 테스트 점수와 비교표가 생성되지 않아요. 예측 형식은 JSON 배열 하나뿐이며, `nmt-forge prereg template`가 편집 가능한 템플릿을 생성해요) |
| **score caveats** | 평가 하네스가 단서(주의사항)를 단 점수를 그대로 인용하는 문제 — *거의 고정된 출력*(서로 다른 수많은 입력에 대해 소수의 문장만 반복 출력되어 출력이 입력을 따르지 않는 현상), 참조 번역보다 지나치게 길거나 짧은 출력, 원문 복사 등이 여기에 해당해요. forge는 이를 직접 계산하지 않고, 하네스가 작성한 모든 주의사항을 하네스의 표현 그대로 점수 옆에 전달해요(내보내기 요약, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare`, `lint`에서 확인 가능). 그리고 주의사항이 붙은 점수를 주의사항 없이 "인용할 수 있는 점수"로 제공하지 않아요 |

## 모든 언어, 모든 자산 — 카드에서 시작하기

nmt-forge는 Champollion 색인에 등록된 약 8,700개 언어 전체를 지원하는 단일 도구이며, 해당 언어에 실제로 어떤 자원이 있는지 색인에 조회하는 것부터 시작해요:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

`?` 표시는 도구가 정직함을 보여주는 거예요. 카드에 없다는 것은 **알 수 없음**을 뜻하지, 결코 "이 언어는 아무것도 없다"는 뜻이 아니에요. 모든 언어는 같은 **자산 사다리**를 올라가요 — (1) 병렬 텍스트만으로도 이미 완전한 가드 처리된 훈련 루프를 얻고, (2) 단일 언어 텍스트는 역번역을 추가하며, (3) 사전과 출판된 문법서는 인용된 템플릿 팩을 구축할 가치가 있게 만들고, (4) 형태소 분석기는 검증된 합성을 잠금 해제하며, (5) LYSS 심판은 그 언어 자체의 지표를 채점과 체크포인트 선택에 넣어줘요. 풍부한 카드(Plains Cree)는 4–5 단계를 자동으로 연결해요 — 평가 세트가 `NEVER TRAIN ON THIS`로 표시되어 도착하고, 심판의 플러그인 레인은 붙여넣기 준비가 된 채로 제공돼요.

그런 다음 `nmt-forge init <code>`는 카드로부터 프로젝트 구조를 생성해요. 작업 공간, 기본 설정 파일, 그리고 정확한 명령어 순서와 함께 사용자와 *에이전트*를 위해 작성된 `NEXT_STEPS.md` 요약 문서가 포함돼요. 일반적인 `pip install`에서도 동작해요. 카드는 지정한 디렉터리, 로컬 체크아웃, 또는 공개 카드 색인(오프라인 사용을 위해 캐시됨)에서 읽어오며, 아직 카드가 없는 언어도 프로젝트 생성이 가능해요(`--no-card --name "<name>"`). 이 경우 임의로 지어내는 대신 모든 카드 정보가 알 수 없음(unknown)으로 기록돼요.

## 노트북에서 서빙 모델까지

정직한 학습 루프에 GPU는 필수가 아니에요. `init`는 설정 파일에 세 가지 모델 프리셋 중 하나를 명시적인 숫자로 작성해요:

| 프리셋 | 요구 사양 | 기대치 |
|---|---|---|
| `cpu-tiny` (기본값) — 처음부터 학습하는 소형 트랜스포머, 어휘집은 학습용 행에서만 학습 | 노트북 CPU, 다운로드 없음 | 의도적으로 약하게 설계됨: 1,000~2,000개 문장 쌍 기준 chrF++ 약 5~30 수준 — 범용 번역이 아닌 학습 데이터의 구문 및 패턴 학습 |
| `cpu-finetune --base <hf-id>` — 관련 언어 쌍에 대해 직접 지정하는 소형 사전 학습 Marian/opus-mt 모델 | CPU, 약 300MB 다운로드 | 관련 언어 쌍이 있는 경우 보통 `cpu-tiny`보다 우수함 — 직접 측정해 보세요 |
| `nllb-600m` — LoRA를 적용한 NLLB-200 distilled 600M | GPU | 가장 강력한 시작점 |

`cpu-tiny`는 첫날부터 울타리(fence), 감사(audit), 사전 등록된 테스트, CLI가 호출할 수 있는 모델 등 *전체* 루프를 실제로 동작하게 만들기 위해 존재해요. 이렇게 하면 나중에 더 나은 모델을 동일한 프로젝트에 투입하고 동일한 방식으로 측정할 수 있어요. 학습이 끝나면 두 개의 명령어로 작업을 완료해요:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export`는 테스트 세트를 한 번 채점하고(사전 등록 필수, 95% 신뢰구간; `--prereg <id>`는 `nmt-forge prereg new <id>`로 이 모델을 위해 작성된 사전 등록을 지정해요. 하나의 테스트 세트에 두 모델이 있는 경우 각각의 사전 등록에 따라 평가되며, export 명령은 임의로 추측하지 않아요), `mt-eval compare`가 읽을 수 있는 mt-eval 리포트로 결과를 저장하며, champollion 플러그인 매니페스트 및 `DEPLOY.md`가 포함된 독립형 모델 패키지를 생성해요. `serve`는 champollion api-method 규약과 OpenAI 호환 엔드포인트를 지원하므로 `champollion sync --method local`로 번역을 수행할 수 있어요. 토큰을 지정하지 않는 한 localhost에서만 수신 대기해요. 모든 명령어는 에이전트를 위해 `--json` 플래그를 지원해요(stdout으로 단일 JSON 문서 출력, 거부 시 `{"error": {…, "why", "fix"}}` 및 종료 코드 2). 전체 튜토리얼은 [첫 번째 모델 학습하기](/docs/network/getting-started/train-your-first-model)를 참고하세요. 테스트할 만한 결과물이 나오면 [방법 제출하기](/docs/network/getting-started/submit-a-method)를 통해 Network 항목으로 등록할 수 있어요.

## 방어할 수 있는 합성 데이터

형태소 분석기(FST)가 있는 언어의 경우, forge는 **언어 팩**을 통해 훈련 데이터를 제조하고 — 어떤 팩도 빠져나갈 수 없는 *배출 법칙*을 강제해요: 생성된 모든 단어는 분석기를 통해 왕복해야 하고(생성 → 분석 → 동일한 분석), 모든 템플릿은 자신이 옮겨 쓴 출판된 문법서를 인용하며, 모든 타당성 필터는 이름이 붙고 집계되고, 모든 행은 `synthetic: true`로 도장이 찍혀요. 그 도장은 핵심적이에요. 레지스트리는 **테스트 세트에 합성 행을 거부해요**. 테스트는 오직 실제 데이터뿐이에요.

forge 자체는 언어 팩을 제공하지 않아요 — 범용 도구예요. 팩은 각자의 언어와 함께 존재하며 모듈 경로나 진입점으로 플러그인돼요 (Plains Cree 팩은 crk-translate 프로젝트에 있어요):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

분석기와 사전은 각자의 라이선스 하에 사용자가 직접 가져오는 별도의 도구로 유지돼요 — 결코 번들되거나 재배포되지 않아요.

## 루프 안에 있는, 당신 언어 자체의 심판

LYSS 평가 표준(예를 들어 두 개의 Cree 철자가 문서화된 장모음 관례로만 다르다는 것을 아는, 언어별 린터)은 모든 채점 표면에 — 그리고 체크포인트 선택에도 — 플러그인돼요. 그래서 이기는 모델은 단지 chrF++가 아니라 *그 언어의 심판*이 선호하는 모델이에요:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

모든 플러그인 수치는 신뢰 구간을 받아요. 전제 조건이 누락된 심판은 조작된 점수 대신 *사용 불가*로 보고해요.

**전체 하네스 지표 스택**도 마찬가지예요 — nmt-forge는 신경 지표(COMET, COMET-QE, MetricX)를 포함해 [평가 하네스](/docs/network/specifications/harness)가 말하는 모든 것을 말하고, 추론은 한 번 실행되며 신뢰 구간은 캐시된 항목별 점수로부터 부트스트랩돼요. 어떤 자동 지표로든 체크포인트를 선택하기 전에, `discover`는 당신의 언어 계통에 대한 각 지표의 [측정된 신뢰도](/docs/network/specifications/metric-reliability)를 보여줘요 — Inuktitut의 경우 BLEU는 인간 판단을 거의 추적하지 못하는 반면(r=0.16) COMET은 추적하고(r=0.86), 대부분의 저자원 계통에서 정직한 답은 *측정되지 않음*이에요. 이 도구는 당신이 어떤 수치를 향해 최적화하기 전에 어떤 수치를 믿어야 하는지 알려줘요.

## 더 깊이 파고들 곳

- **용어가 생소하신가요?** [쉬운 말로 풀이한 MT 학습](/docs/network/context/mt-training-concepts)에서 사전 지식이 없는 분들을 위해 학습 데이터와 평가 데이터의 차이, 손실(loss) 대 디코딩, 누출(leakage), chrF++, 역번역(backtranslation), 정체기(plateau) 등 모든 용어를 실전 예제와 함께 정의해 드려요.
- **구축할 준비가 되셨나요?** [직접 모델을 학습하고 싶으신가요?](/docs/network/tutorials/train-your-own-model)는 에이전트 친화적인 단계별 가이드예요: 언어 선택 → 데이터 수집 → 합성 → 분할 → 학습 → 평가 → 반복 → 서빙 및 제출 순서로 진행되며, 각 가드레일이 실수를 잡아내는 모습을 보여줘요. [내 언어를 위한 MT 구축하기](/docs/build-mt-for-your-language)에서는 기존 자원 탐색부터 옵션 측정, 배포에 이르기까지 전체 여정의 맥락 속에서 학습을 다뤄요.
- **학습 후 제출:** 정직하게 학습된 모델은 [방법 제출하기](/docs/network/getting-started/submit-a-method)를 통해 Network 항목으로 등록돼요.
- **오차 범위:** [통계적 유의성 검정](/docs/network/specifications/significance)에서는 forge가 기본적으로 적용하는 수학적 원리를 설명해요.
- **신뢰할 수 있는 지표:** 자동 평가 지표를 기준으로 체크포인트를 선택하기 전에 [지표 신뢰성](/docs/network/specifications/metric-reliability)을 확인해 보세요.
- **모든 명령어 및 플래그:** 도구 자체에서 생성된 [forge 명령어 레퍼런스](/docs/network/getting-started/forge-command-reference)를 확인하세요.
- **실패 분류 체계(failure taxonomy)** — 각 실수, 구체적인 예시, 이를 방지하는 보호 장치가 nmt-forge 소스 코드에 함께 제공돼요. 에이전트 역시 MCP 서버의 `get_training_guardrails` 도구(선택 사항인 `topic`)를 통해 동일한 규칙 세트를 전달받으며, 모든 실행 거부 메시지에는 무슨 일인지/이유/해결책(what/why/fix)이 포함돼요.
