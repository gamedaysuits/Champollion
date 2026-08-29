---
sidebar_position: 2
title: "정직하게 모델 훈련하기 (nmt-forge)"
related:
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

**30초 요약:** 대부분의 저자원 MT "개선"은 재검토 과정에서 무너져요 — 테스트 세트가 훈련 데이터에 유출되었거나, 테스트 세트가 체크포인트를 선택했거나, 그 향상이 오차 막대 없는 노이즈였던 거죠. **nmt-forge**는 그런 실수를 구조적으로 어렵게 만드는 훈련 스위트예요. 일반적인 경로는 올바른 일을 하고, 잘못된 경로는 *무엇이* 일어났는지, *왜* 결과를 오염시키는지, 그리고 정확한 *해결책*을 알려주는 메시지와 함께 거부해요. 이 스위트는 훈련을 하고, [평가 하네스](/docs/network/specifications/harness)가 점수를 매겨요. 이 안의 모든 가드는 우리가 Plains Cree 번역을 구축하면서 실제로 저지르고, 측정하고, 문서화한 실수를 기계화한 거예요.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

그것이 하나의 거부 안에 담긴 이 스위트의 전체 성격이에요.

## 5분짜리 이야기

여기 이 스위트가 태어난 계기가 된 실패 사례가 있어요. Cree 교과서는 여러 영어 연습 문장을 하나의 대상 문장에 매핑해요. *"Feed him"*과 *"Feed her"*는 둘 다 `asam`으로 번역돼요. 표준 무작위 분할은 한 사본을 훈련 데이터에, 그 쌍둥이를 테스트 세트에 넣어버렸어요 — 그래서 모델은 문자 그대로 54개의 "테스트" 정답 중 17개를 이미 본 셈이었고, 그 행들은 깨끗한 행의 44점에 비해 chrF++ 83점을 기록했어요. 하위 단계의 모든 것(그 "챔피언" 모델, 그 위에 세워진 발견들)은 폐기되어야 했죠.

nmt-forge의 분할기는 그것을 **구조적으로** 불가능하게 만들어요. 소스 *또는* 대상을 공유하는 쌍은 그룹화되고, 그룹 전체가 한쪽에 배치되며, 모든 분할 후에 겹침 제로 검증이 실행돼요:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

다른 모든 가드도 같은 형태예요 — 실제 실수를 기계화해서 없애버리는 거죠:

| 가드 | 이것이 없애는 실수 |
|---|---|
| **split-guard** | 공유된 소스/대상을 통해 훈련 데이터에 숨어든 테스트 정답 |
| **dev-fence** | 테스트 세트가 체크포인트를 선택하는 것 (등록된 dev 세트 없이는 훈련이 시작을 거부해요) |
| **leak-audit** | 평가 텍스트로 훈련하기 — 정확히 일치, 재작성됨(Jaccard), 또는 파일 전체 |
| **funnel-audit** | 조용한 파이프라인 손실 (하나의 정서법 문자가 한때 1,375개의 사전 동사를 몇 주 동안 눈에 띄지 않게 삭제한 적이 있어요) |
| **convention-lint** | 혼합된 철자 관례로 훈련하기 (그러면 모델이 문장 중간에 그것들을 뒤섞어요) |
| **coverage-map** | 명령형도, 의문형도, 소유격도 없는 백만 개의 합성 쌍 — 구조적 공백을 숨기는 물량 |
| **sample-strata** | 두 종류의 템플릿이 훈련 신호의 절반을 독차지하는 것 |
| **ci-scoring** | 오차 막대 없는 점수 (모든 수치는 95% 부트스트랩 CI와 함께 렌더링돼요 — 맨 점수 출력은 없어요) |
| **schedule-sanity** | 조기 종료가 합성 데이터가 많은 실행을 절반 에폭 만에 죽이는 것: 97% 합성 데이터와 정직한 *실제* dev 세트가 있으면, dev 손실이 일찍 바닥을 치고 위로 표류해요 — 그건 모델이 합성 물량에 맞춰지는 거지, 수렴하는 게 아니에요. 종료 하한은 당신의 데이터 혼합으로부터 자동으로 도출되고, 모든 개입은 dev 손실 궤적으로 스스로를 설명해요. 이것은 깨끗한 프로토콜*에 의해* 발견되었어요 — 정직한 설정은 실제 버그를 드러내요 |
| **eval-ledger** | 평가 데이터의 보이지 않는 적응적 사용 (모든 읽기가 기록되고, 봉인된 세트는 일회성이에요) |
| **preregister** | 예측으로 위장된 사후 예측 (사전 등록 없음 → 비교 표 없음) |

## 모든 언어, 모든 자산 — 카드에서 시작하기

nmt-forge는 Champollion 인덱스에 있는 약 8,700개의 모든 언어를 위한 단일 도구이며,
해당 언어가 실제로 무엇을 가지고 있는지 인덱스에 확인하는 것부터 시작해요:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

`?` 표시는 도구가 정직함을 보여주는 거예요. 카드에 없다는 것은 **알 수 없음**을 뜻하지, 결코 "이 언어는 아무것도 없다"는 뜻이 아니에요. 모든 언어는 같은 **자산 사다리**를 올라가요 — (1) 병렬 텍스트만으로도 이미 완전한 가드 처리된 훈련 루프를 얻고, (2) 단일 언어 텍스트는 역번역을 추가하며, (3) 사전과 출판된 문법서는 인용된 템플릿 팩을 구축할 가치가 있게 만들고, (4) 형태소 분석기는 검증된 합성을 잠금 해제하며, (5) LYSS 심판은 그 언어 자체의 지표를 채점과 체크포인트 선택에 넣어줘요. 풍부한 카드(Plains Cree)는 4–5 단계를 자동으로 연결해요 — 평가 세트가 `NEVER TRAIN ON THIS`로 표시되어 도착하고, 심판의 플러그인 레인은 붙여넣기 준비가 된 채로 제공돼요.

그런 다음 `nmt-forge init <code>`는 카드로부터 프로젝트를 스캐폴딩해요: 작업 공간, 시작 구성, 그리고 *당신과 당신의 에이전트를* 위해 작성된 `NEXT_STEPS.md` 브리핑 — 테스트할 가치가 있는 무언가가 생기면 [메서드 제출](/docs/network/getting-started/submit-a-method)에서 끝나요.

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

- **용어가 처음이신가요?** [쉬운 언어로 설명하는 MT 훈련](/docs/network/context/mt-training-concepts)은 모든 용어를 정의해요 — 훈련 대 평가 데이터, 손실 대 디코딩, 유출, chrF++, 역번역, 정체기 — 사전 지식이 전혀 없는 분들을 위해 작동하는 예제와 함께 작성되었어요.
- **구축할 준비가 되셨나요?** [나만의 모델을 훈련하고 싶다면](/docs/network/tutorials/train-your-own-model)은 단계별, 에이전트 중심의 안내서예요: 언어 선택 → 데이터 수집 → 합성 → 분할 → 훈련 → 평가 → 반복 → 제출, 각 가드레일이 자신의 실수를 잡아내는 것을 보여주면서요.
- **훈련한 다음, 제출하기:** 정직하게 훈련된 모델은 [메서드 제출](/docs/network/getting-started/submit-a-method)을 통해 Network 엔트리가 돼요.
- **오차 막대:** [통계적 유의성 검정](/docs/network/specifications/significance)은 forge가 기본적으로 적용하는 수학이에요.
- **어떤 지표를 신뢰할지:** 어떤 자동 지표로든 체크포인트를 선택하기 전에 [지표 신뢰도](/docs/network/specifications/metric-reliability)를 확인하세요.
- **전체 설계** — 모든 가드의 측정된 배경 이야기, 팩 인터페이스, 훈련 루프 기본값 — 은 저장소의 코드와 함께 존재해요 (`forge/DESIGN.md`).
