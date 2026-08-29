---
sidebar_position: 5
title: "채점 명세"
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# 채점 명세

> **핵심 요약.** 이 문서는 Champollion MT 평가 생태계의 모든 평가 지표, 종합 점수 산정, 품질 등급 및 비용 분석에 대한 단일 진실 공급원(single source of truth)이에요. 언어별 평가 지표(FST 형태론적 타당성, 린터 동치 클래스, 결정론적 의미 검증)는 총칭하여 **LYSS**(Linguistically-informed Yield & Structural Scoring)라고 불러요. 테스트 하네스가 계산하는 모든 지표, 종합 공식의 모든 가중치, 모든 등급 임계값은 오직 이 문서에서만 정의돼요. 코드, 문서 및 데이터베이스 스키마는 이 문서를 바탕으로 파생돼요. 내용이 충돌할 경우, 이 문서가 우선적인 권위를 가져요.
>
> **범위.** 이 문서는 우리가 *무엇을* 측정하고 *어떻게 점수를 매기는지* 정의해요. 실행 카드(run card) 스키마(BENCHMARK_SPEC §3 참조), 벤치마크 프로토콜(BENCHMARK_SPEC §6 참조) 또는 리더보드 규칙(arena 문서 참조)은 정의하지 않아요. 해당 문서들은 지표 정의 및 점수 산정 로직을 위해 이 문서를 참조해요.


---

## 1. 채점 철학

### 1.1 마이크로평가 철학

> *"일반화되는 것에만 집중한다면, 우리는 필연적으로 일반화되지 않는 곳을 잊게 될 것이며 — 이러한 언어들과 그들의 모든 지식과 지혜를 잃게 될 것입니다."*

이 프로젝트는 **마이크로평가(microeval) 개발**을 실천합니다. 즉, 사용 가능한 최고의 언어학 도구 — 유한 상태 변환기, 이중언어 사전, 형태소 분석기, 언어학자가 큐레이션한 동치 규칙 — 를 사용하여 특정 언어에 맞춘 평가 지표를 구축합니다. 이는 모든 언어에서 작동하는 보편적 지표를 추구하는, MT 평가의 지배적 패러다임과는 정반대입니다. 보편적 지표는 가치가 있지만, 정확히 가장 필요한 곳 — 복잡한 형태론, 제한된 학습 데이터, 신경망 지표 학습 세트에서의 대표성 부재를 가진 언어들 — 에서 가장 취약합니다.

세계의 많은 언어에 대해 우리가 기계 번역에서 진전을 이루지 못하는 이유는 단지 코퍼스가 부족해서만이 아니라, **진전이 무엇인지조차 알지 못하기** 때문입니다 — 번역 시스템이 개선되고 있는지 측정할 자동 평가 도구가 없기 때문입니다. LYSS는 존재하는 어떤 언어학 자원이든 사용하여, 언어 하나하나마다 이러한 도구를 구축하려는 우리의 시도입니다.

### 1.2 자동 지표는 대리 지표입니다

여기에 정의된 모든 지표는 기계가 계산합니다. 이들은 빠른 반복, 체계적인 비교, 회귀 감지에 유용합니다. 이들은 **인간 판단을 대체하지 않습니다**. §5의 품질 등급은 휴리스틱 레이블입니다 — 오직 인간의 검토만이 실제 사용 가능성을 확인할 수 있습니다.

### 1.3 다중 신호 설계

단일 지표만으로는 번역 품질을 포착할 수 없습니다. 번역이 완벽한 chrF++ 중첩을 가지고 있더라도 형태론적 검증에 실패할 수 있습니다. FST 검사를 통과하더라도 잘못된 의미를 전달할 수 있습니다. 의미적으로 정확하더라도 대상 언어에서 스타일상 이질적일 수 있습니다. §4의 종합 점수는 각각 품질의 다른 차원을 포착하는 여러 개의 독립적인 신호를 집계합니다.

### 1.4 확장성

이 지표 목록은 닫혀 있지 않습니다. 새로운 언어는 새로운 요구사항을 가져옵니다: 성조 언어를 위한 성조 정확도, 셈어계 문자를 위한 발음 구별 부호 정밀도, 크리어를 위한 음절 문자 정확도. 아키텍처(MetricPlugin 프로토콜, 재정규화를 사용한 가중 종합)는 기존 점수를 손상시키지 않고 지표를 추가할 수 있도록 설계되었습니다. 언어별 지표(예: CRK의 린터 및 의미 검증기)는 언어 카드에서 `evalMetrics` 아래에 선언되며 `eval_standards/`에서 로드됩니다 — 하네스는 일반적인 동작 지표(코드 스위칭, 환각, 용어)만 함께 제공됩니다.

### 1.5 평가의 세 가지 차원

모든 런 카드는 세 가지 독립적인 차원을 측정합니다:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

이들은 독립적인 축입니다. 방법이 고품질이지만 비용이 많이 들 수도, 빠르지만 부정확할 수도, 또는 그 어떤 조합일 수도 있습니다. 리더보드는 어떤 차원으로든 정렬할 수 있게 합니다. 비용 조정 점수(§6.3)는 차원을 결합하는 유일한 지표입니다.

### 1.6 검증 상태

이 명세의 모든 지표는 구현 상태(§3)와는 구별되는 **검증 상태**를 가집니다. 구현 상태는 코드가 존재하는지 추적합니다. 검증 상태는 지표가 인간의 품질 판단과 상관관계가 있는 것으로 나타났는지 추적합니다.

| 검증 수준 | 의미 | 현재 지표 |
|------------------|---------|----------------|
| **✅ 외부 검증됨** | 발표된 인간 상관관계 연구가 존재함(WMT, 학술 논문) | `chrf_plus_plus`, `bleu`, `comet_score` *(고자원 쌍에 한함)* |
| **⚡ 대리 검증됨** | 고자원 언어에 대해 검증됨; 우리의 대상 LRL에 대해서는 미검증 | `comet_score` *(LRL의 경우: 고자원/EU 쌍에서 검증되었으며, 예를 들어 CRK로 외삽됨 — 방향적으로는 유용하나 보정되지 않음)* |

> **`comet_score`가 두 행에 나타나는 이유.** 이는 자원 수준에 따른 분할이지, 모순이 아닙니다. COMET은 WMT 인간 상관관계 연구가 존재하는 곳 — 고자원, 대부분 유럽어 쌍 — 에서 *외부 검증됨*입니다. 우리의 대상 저자원 언어에는 그러한 연구가 없으므로, 동일한 지표가 *대리 검증됨*에 그칩니다: 모델이 다른 형태론적 체계를 가진 언어들로부터 외삽하는 것입니다. 이것이 COMET이 별도의 신경망 레인에서 보고되며 종합에 절대 포함되지 않는 이유이기도 합니다(§4.3).
| **🔶 엔지니어링 휴리스틱** | 언어학적 원칙이나 관찰된 실패 모드로부터 설계됨; 인간 상관관계 데이터 없음 | `fst_acceptance_rate`, `morphological_accuracy` (FST 파생, 표제어 매칭; fst-coverage 종합에서 **활성**, 검증기 재도출됨), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 미검증** | 어떤 데이터로도 아직 테스트되지 않음 | `orthographic_accuracy`, `consistency_score` |

> **실무적으로 이것이 의미하는 바.** 종합 점수(§4)는 모든 검증 수준의 지표를 집계합니다. 이는 명시적인 설계 선택입니다: 우리는 구조적으로 근거 있는 엔지니어링 휴리스틱(FST 수용)이 유럽어 쌍에서만 검증된 신경망 지표(COMET)보다 다종합성 언어에 대해 더 유익하다고 믿습니다. 그러나 우리는 이것을 증명하지 못했습니다. 종합 점수는 각 대상 언어에 대한 인간 상관관계 연구가 완료되기 전까지는 검증된 품질 측정이 아니라 **엔지니어링 추정치**로 취급되어야 합니다.
>
> **필요한 검증 실험**(`mt-evaluation-landscape.md` §6 및 `speaker-validation.md` 참조):
> 1. 인간 판단 상관관계 연구: 3명 이상의 이중언어 화자가 평가한 200개 이상의 문장 쌍
> 2. 대표 코퍼스에 대한 FST 오탈락률 측정
> 3. 일반화 테스트를 위한 제2언어 이식(북부 사미어)
> 4. 동일한 데이터에서 COMET과의 직접 비교


---

## 2. 지표 목록 {#2-metric-inventory}

지표는 여섯 개의 범주(표면, 구조, 의미, 동작, 준수, 보고된 비교기)로 구성됩니다. 각 지표는 구현 상태, 척도, 수준(항목별, 코퍼스 수준, 또는 둘 다)을 가집니다.

### 2.1 표면 지표

표면 지표는 예측된 번역을 참조 번역과 문자열 수준에서 비교합니다. 이들은 언어학 도구가 필요 없습니다 — 단지 문자열 비교만 필요합니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | 정확 일치 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | 이진: predicted == reference 인가? 코퍼스 비율 = 일치 / 총계. |
| `equivalent_match_rate` | 동치 일치 | ⚡ 부분적 | 0.0–1.0 | 둘 다 | 예측된 출력이 허용된 변형 중 하나와 일치하는가? CRK의 경우: 결정론적 변형-클래스 규칙(어순, 정서법, 선택적 조사, 표제어 동의어, 진행형 모호성)을 사용하여 CRK 평가 표준의 `CrkLinterMetric`(`eval_standards/crk/`에 포함)을 통해 구현됨. CRK 언어 카드의 `evalMetrics` 선언을 통해 자동으로 로드됨. 일반적인 교차 언어 구현에는 코퍼스에 항목별 `variants[]`가 필요함. |
| `chrf_plus_plus` | chrF++ | ✅ 구현됨 | 0–100 | 둘 다 | 문자 n-gram F-점수(sacrebleu). 형태론적 변형에 강건함. 교착어/다종합성 언어를 위한 주요 표면 지표. 항목별은 `sentence_chrf`를 사용하고, 코퍼스는 `corpus_chrf`를 사용함. |
| `bleu` | BLEU | ✅ 구현됨 | 0–100 | 코퍼스 | 단어 수준 n-gram 정밀도(sacrebleu). **종합에서 제외됨** — 단어 수준 채점은 형태론적 변형에 불공정하게 벌점을 부과함. MT 문헌과의 호환성을 위해 계산 및 보고됨. |
| `ter` | 번역 편집률 | ✅ 구현됨 | 0–∞ (낮을수록 좋음) | 둘 다 | 참조 길이로 정규화된 예측과 참조 간의 최소 편집 거리(sacrebleu `corpus_ter`). chrF++ 및 BLEU와 함께 계산됨. 종합에서 제외됨 — chrF++와 상관관계가 있어 둘 다 포함하면 표면 유사성을 이중 계산하게 됨. |
| `length_ratio` | 길이 비율 | ✅ 구현됨 | 0–∞ (1.0이 이상적) | 둘 다 | 문자 단위의 `len(predicted) / len(reference)`. 절단(<0.5) 및 팽창/환각(>2.0)을 감지함. 코퍼스 수준에서 항목 전반에 걸쳐 평균화됨. |

### 2.2 구조 지표

구조 지표는 번역의 언어학적 적격성을 검증합니다. 이들은 언어별 도구(FST 분석기, 형태소 파서)가 필요하며 형태론적으로 풍부한 언어에 대한 가장 강력한 신호입니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST 수용 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | 유한 상태 변환기(GiellaLT)에 의해 수용된 출력 단어의 비율. FST가 최소한 하나의 형태론적 분석을 반환하면 단어는 "유효"함. GiellaLT `.hfstol` 분석기가 있는 모든 언어에서 사용 가능. |
| `morphological_accuracy` | 형태론적 정확도 | ✅ 활성(fst-coverage 프로필; 검증기 재도출됨) | 0.0–1.0 | 둘 다 | 단어가 FST-유효하더라도 잘못된 굴절을 가질 수 있음(올바른 어근, 잘못된 접미사). `plugins/giellalt_fst.py`에 의해 **계산됨**: 분석 가능한 각 예측 단어에 대해, 그 **표제어**(어근)를 공유하는 참조 단어를 찾고 예측된 **굴절**(FST 특성 태그)이 일치하는지 확인함. 위치가 아니라 표제어로 매칭함으로써 단어 정렬을 우회함: 다른 단어 선택이나 잘못 정렬된 쌍은 단순히 *포함되지 않음*(절대 잘못 채점되지 않음). **금 어노테이션이 필요 없음** — 참조의 FST 분석이 *바로* 기준 진실임. FST가 분석할 수 없거나 그 어근이 참조에 없는 단어는 커버리지 밖임; `morph_coverage`(표제어 매칭된 비율)이 공개되며, 지표는 커버리지 ≥ `MORPH_COVERAGE_FLOOR`(0.25)일 때만 종합에 진입함 — 하한 미만에서는 참고용으로 유지됨. FST 모호성 하에서 **관대함**(여러 분석을 가진 예측 단어는 *어느 하나라도* 일치하면 "정답" → 상한, 공개됨). fst-coverage 프로필에서 **0.15 가중치**를 가지며 표준 코퍼스에 대해 **검증기에 의해 재도출됨**(`verifier.recompute_corpus_morph`, 카드에 고정된 FST를 재실행함 — FST가 없으면 실패 폐쇄, COMET과 동일한 계약). 2026-06-16 활성화됨(마이그레이션 029가 dev + prod에 적용됨). |
| `orthographic_accuracy` | 정서법 정확도 | 🔲 계획됨 | 0.0–1.0 | 둘 다 | 문자별 정확성을 검증함: 크리어의 SRO 마크론/곡절 부호 사용, 이누크티투트어의 발음 구별 부호, 오지브웨어의 모음 길이 표시. 언어별 규칙 세트. |

> **구조적 지표가 중요한 이유.** Meta의 OMT-1600 — 지금까지 발표된 가장 큰 MT 시스템(1,600개 언어; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — 은 ChrF++, xCOMET, MetricX, BLASER 3로 평가해요. 이들 중 어느 것도 형태론적 정확성을 검증하지는 못해요. ChrF++는 문자 n-gram 중첩을 측정해요. 즉, 대상 언어처럼 *보이는* 문자열에 점수를 줘요. 포합어(polysynthetic language)의 경우, 이는 참조와 많은 문자를 공유하는 형태론적으로 무효한 단어가 높은 점수를 받는다는 것을 의미해요. 우리의 FST 수용(acceptance) 지표는 이진 구조적 테스트예요. 단어가 해당 언어에서 유효한 형태이거나, 그렇지 않거나 둘 중 하나예요. 다른 어떤 MT 평가 프레임워크도 이를 대규모로 제공하지 않아요. ChrF++는 또한 정서법에 따라 달라지는 **0이 아닌 우연 하한값(nonzero chance floor)** 을 가지고 있어요 — 같은 문자 체계의 무작위 텍스트가 0보다 측정 가능할 정도로 높은 점수를 받으며, 이는 일부 문자 체계에서 더 크게 나타나요 — 따라서 원시(raw) chrF++는 언어 간에 비교할 수 없어요. 네트워크 맵은 [우연 보정 chrF++ (cchrF++)](/docs/network/specifications/connection-strength)로 이를 보정해요.

### 2.3 의미 지표

의미 지표는 임베딩이나 학습된 모델을 사용하여 의미 보존을 측정합니다. 표면상 다르지만 의미가 동등한 번역을 포착하고, 표면상 유사하지만 의미상 잘못된 번역을 표시합니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | 의미 유사도 | ⚡ 부분적 | 0.0–1.0 | 둘 다 | CRK: CRK 평가 표준의 `CrkSemanticMetric`(`eval_standards/crk/`에 포함, 대리)로부터의 판정-가중 점수. 보편: 문장 임베딩의 코사인 유사도(원본 + 예측 대 원본 + 참조). 모델 미정 — 저자원 언어를 지원해야 하며, 이는 대부분의 영어 중심 임베딩 모델을 배제함. |
| `comet_score` | COMET | ✅ 구현됨 | ~0.0–1.0 | 둘 다 | 학습된 MT 평가 지표(Unbabel). **별도로 계산 및 보고됨 — 어떤 종합에도 절대 포함되지 않음**(종합은 결정론적임; §4.3). 검증기에 의해 재도출되므로 보고된 값은 재현 가능해야 함. 평원 크리어와 같은 언어의 경우 저자원 보정 주의사항과 함께 표시됨. `unbabel-comet`가 설치되었을 때 계산됨. 35개 아프리카 언어의 경우, 하네스는 `resolve_comet_model()`를 통해 AfriCOMET(`masakhane/africomet-mtl`)을 자동 선택하며, 이는 해당 언어에 대해 더 나은 인간 판단 상관관계를 가짐. |

> **COMET이 종합되지 않고 별도로 보고되는 이유.** COMET은 WMT 인간 평가 데이터로 학습되었으며, 압도적으로 고자원 유럽어 쌍입니다. 평원 크리어나 기타 LRL에 적용하면 모델이 다른 형태론적 체계를 가진 언어들로부터 외삽합니다 — 방향적으로는 유용하나 보정되지 않았습니다. 모델 의존적이고 불균등하게 검증된 신호를 대표 점수에 포함시키기보다, 종합은 **결정론적**(검증기 재현 가능한 지표만)으로 유지되며 COMET/AfriCOMET은 **별도의 신경망 레인**(§4.3)에서 보고되고 검증기에 의해 재도출됩니다. 신경망 종합은 검증이 완료되면 나중에 추가될 수 있습니다.
>
> **고자원 COMET은 종합되지 않고 보고됩니다(설계상).** 진정한 고자원 쌍(독일어, 프랑스어 등)의 경우 기본 `Unbabel/wmt22-comet-da`는 WMT에 의해 잘 검증되었으며, `resolve_comet_model()`가 이를 선택합니다. 그러나 COMET은 어떤 종합에도 **포함되지 않습니다** — 다른 모든 신경망 지표처럼 별도의 신경망 레인에서 계산되고 표시되며, 검증기에 의해 재도출됩니다. 종합을 결정론적으로 유지하면 `metricModelSupport.xlmr.tier: "high"`를 가진 ~100개 이상의 언어에 대해 2.3GB 모델 의존적 지표를 필수로 만드는 것을 피할 수 있으며, 대표 점수를 코퍼스만으로 재현 가능하게 유지합니다.

> **아프리카 언어를 위한 AfriCOMET.** 각 언어 카드에는 해당 언어에 대해 어떤 특화된 COMET 모델이 학습되었는지 선언하는 `metricModelSupport` 필드(언어 카드 명세 §9 참조)가 있습니다. 35개 아프리카 언어(yor, hau, ibo, amh, swa 등)의 경우, 카드는 AfriCOMET(`masakhane/africomet-mtl`)을 선언합니다 — Masakhane 커뮤니티가 아프리카 언어 MT 인간 판단으로 미세 조정한 COMET 모델입니다. 하네스는 언어 카드에서 읽어 `resolve_comet_model()`를 통해 권장 모델을 자동 선택하지만, 이는 `--comet-model`로 재정의할 수 있습니다. 새로운 언어→모델 매핑 추가는 (Python 코드를 편집하는 것이 아니라) 언어 카드를 보강하여 수행됩니다.

### 2.4 동작 지표

동작 지표는 번역 출력에서 특정 실패 모드를 감지합니다. 이들은 품질을 직접 측정하지 않습니다 — 문제를 감지합니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | 코드 스위칭 비율 | ✅ 구현됨 | 0.0–1.0 (낮을수록 좋음) | 둘 다 | 원본 언어(일반적으로 영어)로 된 출력 단어의 비율. 유니코드 문자 분석 및/또는 원본 언어 단어 목록을 통해 감지함. 매우 흔한 LLM 실패 모드: 모델이 대상 언어 대응어를 모를 때 영어 단어를 삽입함. |
| `hallucination_rate` | 환각 비율 | ✅ 구현됨 | 0.0–1.0 (낮을수록 좋음) | 둘 다 | 대응하는 원본 내용이 없는 출력 내용의 비율. 단어 정렬이나 교차 언어 임베딩 중첩을 통해 감지함. 그럴듯하게 들리지만 조작된 번역을 생성하는 모델을 포착함. |
| `terminology_adherence` | 용어 준수 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | 코칭된 방법의 경우: 출력에 나타나는 규정된 용어의 비율. 코칭 사전 데이터가 필요함. 모델이 전문가가 제공한 어휘를 존중하는지 측정함. |
| `consistency_score` | 항목 간 일관성 | 🔲 계획됨 | 0.0–1.0 | 코퍼스 전용 | 모델이 동일한 원본 용어를 항목 전반에 걸쳐 동일하게 번역하는가? 낮은 일관성은 모델이 학습된 패턴을 적용하기보다 추측하고 있음을 시사함. 코퍼스 항목 전반에 걸쳐 반복되는 용어가 필요함. |

### 2.5 준수 지표

준수 지표는 번역이 구조적 무결성 — 플레이스홀더, 서식, 조판 관례 — 을 보존하는지 검증합니다. 이들은 품질 점수가 아니라 품질 게이트 검사입니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | 이중 통과 준수 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | 가중 종합: 60% 변수 무결성(`{placeholder}` 변수가 보존되었는가?) + 20% 인용부호 준수(언어 카드별 올바른 인용부호 문자) + 20% 대소문자 준수(대소문자 없는 언어에 대한 라틴 문자 누출 없음). 원시 및 후처리 출력 모두에서 계산됨. `DoublePassCompliancePlugin`를 통해. |
| `repair_effectiveness` | 수리 효과성 | ✅ 구현됨 | 0.0–1.0 | 코퍼스 | 번역 후 훅에 의해 자동으로 수리된 준수 위반의 비율. 품질 게이트가 원시 출력을 얼마나 개선했는지 측정함. |

> **준수가 종합에 포함되지 않는 이유.** 준수 지표는 번역 품질이 아니라 구조적 보존(플레이스홀더, 인용부호)을 측정합니다. 번역이 언어학적으로 완벽하더라도 `{name}` 변수를 누락하여 준수에 실패할 수 있습니다. 이들은 품질 게이트입니다 — 나쁜 출력이 배포되는 것을 차단하지만 번역 품질을 순위 매기지는 않습니다.

### 2.6 보고된 비교기(종합에 절대 포함되지 않음)

이들은 맥락/비교 목적으로만 보고되며 어떤 종합 프로필에도 진입하지 않습니다:

| ID | 지표 | 상태 | 비고 |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200 토크나이저) | ✅ 구현됨 | FLORES-200 SentencePiece 토큰화에 대한 BLEU — 문자/분할 전반에 걸쳐 비교 가능(NLLB/FLORES 공용어). `sentencepiece`(핵심 의존성) 필요. |
| `chrf_plain` | 순수 chrF (`word_order=0`) | ✅ 구현됨 | FLORES/WMT 표가 보고하는 chrF 수치로, 우리의 chrF++(`word_order=2`)와 함께 제공됨. |
| `fuse_score` | FUSE 스타일 비교기 | ⚡ 옵트인(`--fuse`) | AmericasNLP-2025 FUSE 접근법(Raja & Vats)의 **미학습 재구현**: LaBSE 의미 + 어휘 토큰-F1 + 음성 Soundex + 퍼지 difflib를 *비가중 평균*으로 혼합함(원래의 Ridge/GBM을 맞출 인간 판단 학습 데이터가 없으며, 이를 명시함). LaBSE/Soundex는 선택적 `fuse` 엑스트라임; LaBSE 없이는 `compute_fuse`가 점수를 조작하는 대신 `None`를 반환함(공개됨). 실행된 각 구성 요소가 `fuse_components`에 나열됨; 결과는 `fuse_untrained=true`로 표시됨. 리더보드가 FST-게이트/구조적 채점을 FUSE 스타일 기준선과 대조하여 표시할 수 있게 함. |

### 2.7 지표 네임스페이스 {#2-7-metric-namespaces}

단일 지표는 스택 전반에 걸쳐 최대 네 개의 조정된 이름을 가집니다:
**표준 id**(런 카드의 `scores` 키, 예: `equivalent_match_rate`),
그것을 계산하는 Python **플러그인 이름**(예: `crk_linter`), 그것을 선언하는 언어 카드
**`evalMetrics` 키**(예: `lyss-eq`), 그리고 리더보드의 비정규화된
**`run_cards` 열**(예: `equivalent_match_rate`). 이들은
의도적으로 구별됩니다 — 플러그인 이름은 *도구*를 명시하고, 지표 id는
*측정*을 명시합니다 — 그러나 반드시 서로 보조를 맞춰야 합니다.

그 매핑의 단일 진실 공급원은 `mt_eval_harness.metric_manifest`에 의해 로드되는 `shared/metric-registry.json`입니다.
각 항목은 네 개의 이름과 `scale`,
`direction`(높음/낮음/중립), `level`(항목/코퍼스/둘 다), `in_composite`,
`verifier_reproducible`를 기록합니다. 패리티 테스트 `arena/tests/test_metric_registry_ssot.py`는
`publish.py`에 의해 발행된 `scoring.py`의 가중치 표나 런 카드 `scores` 키가
레지스트리에서 벗어나면 실패하므로, 새 지표가 절반만 연결된 채로 출하될 수 없습니다.

두 개의 관련 런 카드 필드가 지표 출처를 명시적으로 만듭니다:

- **`scores.metric_availability`** — `null` 점수를 명확히 하는 `{metric: reason}` 블록:
  `not_applicable`(언어/런이 그것을 사용하지 않음), `unavailable`
  (선택적 의존성이 누락됨), `below_coverage_floor`(존재하지만 종합에 진입하기에
  너무 희소함), `not_run`(옵트인이며 요청되지 않음), 또는
  `not_implemented`(계획됨). 블록에서 없는 지표는 정상적으로 계산됨.
- **`fst_version`** / **`fst_provenance`** — 모든 FST 파생 지표 뒤에 있는
  설치된 GiellaLT 변환기 릴리스 및 `pyhfst` 버전으로, sacreBLEU 서명과 동일한 방식으로
  캡처되어 구조적 점수가 정확한 분석기 빌드로 추적될 수 있게 함.

---

## 3. 지표 상태 등급

§2의 모든 지표는 네 개의 구현 등급 중 하나에 속합니다:

| 등급 | 의미 | 런 카드 동작 |
|------|---------|-------------------|
| **✅ 구현됨** | 코드가 존재하고 테스트되며 오늘날 런 카드에서 값을 생성함 | 런 카드의 숫자 값 |
| **⚡ 부분적** | 언어별 대리(예: CRK)는 존재하나 보편적 구현은 보류 중 | 대리가 적용될 때 숫자 값, 그렇지 않으면 `null` |
| **🔲 계획됨** | 명세되었으나 아직 구현되지 않음 | 런 카드의 `null`(필드 존재, 값 부재) |
| **💡 제안됨** | 논의 중이며 아직 명세되지 않음 | 런 카드에 없음 |

지표가 계획됨 → 부분적으로 이동하는 경우:
1. 언어별 구현이 병합되고 테스트됨
2. 최소한 하나의 언어 쌍에 대해 값을 생성함
3. 보편적 구현이 보류 중으로 남아 있음(이 명세에 문서화됨)

지표가 부분적 → 구현됨으로 이동하는 경우:
1. 언어 독립적 구현이 병합되고 테스트됨
2. 언어별 플러그인 없이 어떤 언어 쌍에 대해서든 값을 생성함
3. 이 문서가 ✅ 상태를 반영하도록 업데이트됨

지표가 계획됨 → 구현됨으로 이동하는 경우:
1. 구현이 병합되고 테스트됨
2. 최소한 하나의 실제 평가 런에서 검증됨
3. 이 문서가 구현 세부사항으로 업데이트됨

지표가 제안됨 → 계획됨으로 이동하는 경우:
1. 그 정의, 척도, 계산 방법이 합의됨
2. `🔲 Planned` 상태로 이 문서에 추가됨
3. null 플레이스홀더가 런 카드 스키마에 추가됨

---

## 4. 종합 점수 {#4-composite-score}

> [!CAUTION]
> **종합은 실험적이며 검증되지 않았습니다.** 이것은 *언어마다 다른 것을 의미하는* 지표들의 가중 집계이며, 그 가중치는 **인간의 품질 판단에 경험적으로 맞춰진 것이 아니라 엔지니어링 판단**입니다. 어떤 대상 언어에 대해서도 이 가중치를 뒷받침하는 인간 상관관계 연구가 없습니다. 이것을 대략적인 편의성 정렬 키로 취급하되, **절대로** 품질 측정이나 한 시스템이 "더 낫다"는 주장으로 취급하지 마십시오. 진짜 신호는 **지표별 프로필**입니다 — 각 지표는 그 값과 검증 등급(§1.6)과 함께 표시됩니다. 종합은 나타나는 모든 곳에서(리더보드 포함) "실험적 — 미검증"으로 표시되며, 어떤 상이나 어워드의 기준도 절대 되지 않습니다. (설계상.)

### 4.1 공식

종합 점수는 *사용 가능한* 모든 지표의 가중 평균이며, 사용 가능한 지표의 가중치가 1.0이 되도록 재정규화됩니다:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

지표는 런 카드의 그 값이 (`null`가 아닌) 숫자일 경우 "사용 가능"합니다. 지표가 사용 불가능할 때 — 언어에 FST가 없거나 지표가 아직 구현되지 않았기 때문에 — 그 가중치는 나머지 지표에 비례적으로 재분배됩니다.

**이는 종합이 런 내에서 항상 비교 가능함을 의미합니다:** 사용 가능한 지표는 무엇이든 사용하고 그에 따라 정규화합니다. 런 간 비교는 런들이 동일한 사용 가능 지표 집합을 사용할 때 유효합니다.

> [!WARNING]
> **실행 간 비교 가능성.** 사용 가능한 지표가 다른 실행(run)들을 비교할 때(예: 한 실행에는 FST 점수가 있고 다른 실행에는 없는 경우), 종합 점수는 **직접적으로 비교할 수 없어요**. 5개의 지표로 계산된 종합 점수 0.72는 2개의 지표로 계산된 종합 점수 0.72보다 더 많은 정보를 담고 있어요. 각 실행의 정확한 지표 세트는 감사(audit)가 가능해요. 실행 카드는 `scores.scoring_profile` 및 `scores.metric_availability`(§2.7)를 기록하며, 측정되지 않은 지표는 리더보드에서 절대 0이 아닌 "—"로 표시돼요. 엄밀한 비교를 위해서는 공통으로 측정된 지표에 대해서만 쌍체 부트스트랩 유의성 검정(paired bootstrap significance tests, §8.2)을 사용하세요.

### 4.2 입력 정규화

종합 공식에 진입하기 전에, 모든 지표는 1.0 = 완벽인 **0.0–1.0 척도**에 있어야 합니다:

| 지표 | 원래 척도 | 정규화 |
|--------|-------------|--------------|
| `exact_match_rate` | 0.0–1.0 | 없음(이미 정규화됨) |
| `equivalent_match_rate` | 0.0–1.0 | 없음 |
| `fst_acceptance_rate` | 0.0–1.0 | 없음 |
| `morphological_accuracy` | 0.0–1.0 | 없음 |
| `chrf_plus_plus` | 0–100 | **100으로 나눔** |
| `semantic_score` | 0.0–1.0 | 없음 |
| `code_switching_rate` | 0.0–1.0 (낮을수록 좋음) | **`1.0 - value`** (반전: 0% 코드 스위칭 = 1.0) |
| `hallucination_rate` | 0.0–1.0 (낮을수록 좋음) | **`1.0 - value`** (반전) |
| `terminology_adherence` | 0.0–1.0 | 없음 |

어떤 종합 프로필에도 없는 지표(`bleu`, `ter`, `length_ratio`, `consistency_score`, 그리고 신경망 `comet_score`/`qe_score`)는 이 목적으로 정규화되지 않습니다. (신경망 지표는 별도로 보고되며 어떤 종합에도 진입하지 않음 — §4.3.)

### 4.3 가중치 표 {#43-weight-tables}

**명명된 프로필 레지스트리(카드 기반).** 종합은 더 이상 단일 `has_fst` 불리언으로 선택되지 않습니다. 각 언어는 `language_cards.resolve_scoring_profile()`를 통해 **명명된 프로필**로 해석됩니다; 프로필은 `scoring.py`의 `PROFILE_REGISTRY`에 반영된 가중치 표를 명명합니다. 카드는 재정의하기 위해 `scoringProfile.basis`를 선언할 수 있습니다; 없을 경우 기본값은 레거시 동작을 재현합니다(FST가 런을 채점했을 때 `fst-coverage`, 그렇지 않으면 `surface-only`). 각 종합을 생성한 프로필은 런 카드에 `scores.scoring_profile`로 기록되므로, 가중치가 리더보드 행별로 감사 가능합니다.

**비활성(예약된) 지표.** 일부 지표는 아래에 *선언된* 가중치를 가지고 있지만 아직 활성화되지 않았으므로, `scoring.INACTIVE_METRICS`에 나열되며 항목별로 계산되고 검증기에 의해 재채점될 수 있을 때까지(신뢰 게이트) **종합에서 제외됩니다**. 부재한 지표를 제외해도 어떤 점수도 변하지 않습니다 — 단지 "아직 채점 안 됨"을 조용히가 아니라 명시적으로 만들 뿐입니다. 현재 비활성:

- `orthographic_accuracy` — 언어별 정서법 규칙이 필요함(구축되지 않음).

(`morphological_accuracy`은 P5까지 비활성이었음; **2026-06-16 `fst-coverage` 프로필 하에서 활성화됨** — 계산됨(표제어 매칭됨; §2.2), `morph_coverage ≥ 0.25`일 때 종합에 진입하며(하한 미만에서는 참고용), 검증기에 의해 재도출됨. **신경망 지표(`comet_score`, `qe_score`)는 모든 종합에서 제외됨** — 별도로 계산 및 보고됨; 아래 "신경망 지표" 참조.)

#### `fst-coverage` (프로필 A): FST 커버리지가 있는 언어

GiellaLT 유한 상태 변환기를 사용할 수 있는 언어를 위한 것. 구조 지표는 종합의 40%를 차지하며(FST 0.25 + 형태론적 정확도 0.15), 이는 다종합성/교착어에 대한 형태론적 정확성의 우선성을 반영합니다.

| 지표 | 목표 가중치 | 근거 |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.25** | 최고 가중치. FST가 단어를 거부하면 — 다른 지표가 무엇을 말하든 — 그것은 그 언어에서 유효한 형태가 아님. 이진, 구조적으로 근거 있음. |
| `morphological_accuracy` | **0.15** | 단어가 FST-유효하지만 형태론적으로 잘못될 수 있음(올바른 어근, 잘못된 굴절). FST와 함께 구조 지표는 40%를 차지함. |
| `chrf_plus_plus` | **0.15** | 문자 n-gram 중첩: 다종합성 언어를 위한 최고의 표면 수준 대리. 단어 수준 지표보다 교착 형태론을 더 잘 처리함. |
| `semantic_score` | **0.15** | 표면 형태가 갈라질 때의 의미 보존. 구조 검사를 통과하는 의미상 잘못된 번역을 포착함. |
| `equivalent_match_rate` | **0.10** | 하나의 참조 번역뿐만 아니라 허용 가능한 변형에 보상함. 유연한 어순을 가진 언어에 중요함. |
| `code_switching_rate` | **0.05** | 원본 언어 누출에 벌점 부과. 반전됨: 0% 코드 스위칭 = 1.0. |
| `terminology_adherence` | **0.05** | 규정된 어휘를 존중하는 코칭된 방법에 보상함. 코칭 데이터가 존재할 때만 활성. |
| `hallucination_rate` | **0.05** | 조작된 내용에 벌점 부과. 반전됨: 0% 환각 = 1.0. |
| `exact_match_rate` | **0.05** | 최저 가중치. 다종합성 언어에는 너무 엄격함 — 여러 올바른 번역이 존재함. 상한 검사로 유지됨. |

> **총계: 1.00.** 지표가 사용 불가능할 때, 그 가중치는 사용 가능한 지표에 비례적으로 재분배됩니다. `morphological_accuracy`(0.15 가중치)은 **활성**입니다 — `morph_coverage ≥ 0.25`일 때 종합에 진입하며 검증기에 의해 재도출됩니다; 하한 미만에서는 다른 사용 불가능 지표처럼 재분배됩니다. 그것이 *부재할* 때(FST 없음, 또는 하한 미만 커버리지), 나머지 8개 지표(총 가중치 0.85)는 각각 1/0.85 ≈ 1.176으로 스케일됩니다. 예를 들어:
> - FST: 0.25/0.85 = 0.294
> - chrF++: 0.15/0.85 = 0.176
> - semantic: 0.15/0.85 = 0.176

#### `surface-only` (프로필 B): FST 커버리지가 없는 언어

형태론적 검증 도구가 없는 언어를 위한 것. 의미 및 표면 지표가 동일한 가중치를 가집니다.

| 지표 | 목표 가중치 | 근거 |
|--------|--------------|-----------|
| `semantic_score` | **0.25** | 구조적 검증이 없으면, 의미 보존이 사용 가능한 가장 강력한 신호임. |
| `chrf_plus_plus` | **0.25** | FST가 없으면, 문자 수준 중첩이 주요 표면 검사가 됨. |
| `equivalent_match_rate` | **0.15** | 변형 매칭은 형태론적 도구를 요구하지 않고 구조화된 품질 평가를 제공함. |
| `exact_match_rate` | **0.10** | FST가 없으면, 정확 일치가 유일한 구조적 검증 대리로서 더 많은 가중치를 가짐. |
| `code_switching_rate` | **0.10** | 나쁜 출력을 포착할 FST가 없을 때 원본 언어 누출이 더 중요함. |
| `terminology_adherence` | **0.05** | 코칭된 어휘 준수. |
| `hallucination_rate` | **0.05** | 조작된 내용 감지. |
| `orthographic_accuracy` | **0.05** | 문자별 정확성이 부재한 FST가 남긴 공백의 일부를 채움. |

> **총계: 1.00.** `orthographic_accuracy`(0.05 가중치)은 `INACTIVE_METRICS`에 있음(계획됨, 아직 계산되지 않음). 그것이 부재할 경우, 나머지 7개 지표(총 가중치 0.95)는 1/0.95 ≈ 1.053으로 스케일됨 — 종합에 미미한 영향.

#### `no-reference`: 금 참조가 없는 런

코퍼스에 **금 참조가 없는** 런의 경우(예: 우리가 그에 대해 채점하기를 거부하는 오염된 FLORES만 있는 최하위 언어). 참조 기반 지표(`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`)는 계산할 수 없으므로, 결정론적 종합은 **참조 불필요, 검증기 재현 가능** 신호에 의존합니다.

| 지표 | 목표 가중치 | 근거 |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | 형태론적 유효성은 참조가 필요 없음; FST가 존재할 때 가장 강력한 결정론적 신호. |
| `code_switching_rate` | **0.25** | 원본 언어 누출(반전됨). |
| `hallucination_rate` | **0.20** | 조작된 내용(반전됨). |
| `terminology_adherence` | **0.15** | 코칭된 어휘 준수. |

> **총계: 1.00.** 네 가지 모두 결정론적이며 검증기 재현 가능합니다. 참조 없는 런에 FST가 없을 때, 종합은 동작 검사만으로 재정규화합니다(의도적으로 얇고 정직한 신호); **신경망 참조 불필요 QE 점수(AfriCOMET-QE)는 별도로 계산 및 보고됩니다** — 아래 "신경망 지표" 참조 — 그러한 런의 적정성 신호로서.

#### 신경망 지표 — 별도로 계산 및 보고됨(어떤 종합에도 없음)

종합은 **결정론적**입니다: 그 안의 모든 지표는 코퍼스만으로 검증기에 의해 재현 가능합니다. **신경망 지표는 모든 종합에서 제외되며** 독자적으로 표시됩니다(설계 결정 — "결정론적 종합; 신경망은 별도, 아마도 나중에 별도로 종합될 수 있음"):

| 지표 | 그것이 무엇인지 | 어디에 표시되는지 |
|--------|-----------|----------------|
| `comet_score` | COMET / AfriCOMET 신경망 적정성(참조 기반) | 자체 리더보드 열 + 런 카드 `neural_metrics`, 저자원 보정 주의사항과 함께. |
| `qe_score` | AfriCOMET-QE 참조 불필요 신경망 QE(원본 + MT) | 동일한 별도 신경망 레인; `no-reference` 런에 대한 적정성 신호. |

둘 다 여전히 **검증기에 의해 재도출됩니다**(`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), 그래서 재현되지 않는 보고된 신경망 점수는 신뢰할 수 없지만 — 결정론적 종합을 절대 움직이지 않습니다. 명명된 집합은 `scoring.NEURAL_METRICS`입니다. 신경망 종합은 나중에 도입될 수 있습니다; 지금으로서는 신경망 지표가 독립적으로 존재합니다.

> **가중치 진화에 대한 참고.** 이 가중치는 잠정적이며 인간 검증 데이터가 축적됨에 따라 재보정될 것입니다. 장기적 목표는 가중치를 경험적으로 도출하는 것입니다: 어떤 자동 지표가 각 어족에 대해 인간의 품질 판단을 가장 잘 예측하는가?

### 4.4 종합에 새 지표 추가하기

종합에 새 지표를 추가하려면:

1. §2에서 척도, 수준, 계산 방법을 포함하여 `🔲 Planned` 상태로 **정의합니다**.
2. MetricPlugin으로(또는 핵심 지표의 경우 `tester.py`에서) **구현합니다**.
3. 런 카드 점수 블록에 **null 플레이스홀더를 추가합니다**.
4. 기존 가중치를 하향 조정하여 §4.3에서 **목표 가중치를 할당합니다**. 가중치는 합이 1.00이 되어야 합니다.
5. 런 카드 스키마가 변경되면 **BENCHMARK_SPEC.md** §3을 **업데이트합니다**.
6. **`scoring.py`** 가중치 표를 **업데이트합니다**(코드는 이 문서를 반영해야 함).
7. 지표가 실제 데이터에서 합리적인 값을 생성하는지 확인하기 위해 **검증 벤치마크를 실행합니다**.
8. 상태를 `🔲`에서 `✅`로 변경하도록 **이 문서를 업데이트합니다**.

---

## 5. 품질 등급 {#5-quality-tiers}

이 등급들은 자동 종합 점수에 대한 휴리스틱 레이블입니다. 각 수준에서의 출력에 대한 인간 검토에 기반하여, 점수가 실무적으로 무엇을 의미하는 경향이 있는지 설명합니다. **이들은 검증된 품질 판단이 아닙니다** — 오직 인간 검토만이 실제 사용 가능성을 확인할 수 있습니다.

> [!IMPORTANT]
> **자동 등급은 잠정적입니다.** 이 레이블들은 검토를 위한 지명이지, 품질 선언이 아닙니다. 자동 지표에서 "배포 가능"에 도달한 방법은 커뮤니티 평가의 후보입니다 — 출하할 제품이 아닙니다. 오직 이중언어 화자에 의한 인간 검토만이 실제 사용 가능성을 확인할 수 있습니다([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation) 참조). 어떤 방법도 화자들이 출력이 사용 가능하다는 데 동의함을 커뮤니티 검토가 확인하지 않고서는 배포 가능 이상을 주장할 수 없습니다. 등급 경계는 인간 검증 데이터가 축적됨에 따라 언어마다 다를 수 있습니다.

| 등급 | 종합 범위 | 화자가 일반적으로 보는 것 |
|------|----------------|-------------------------------|
| **기준선** | 0.00–0.30 | 언어별 지원이 없는 원시 LLM 출력. 형태론은 대부분 환각됨. |
| **초기** | 0.30–0.50 | 일부 올바른 패턴이 나타남. 코칭이 도움이 되고 있으나 출력은 신뢰할 수 없음. |
| **기능적** | 0.50–0.70 | 출력이 화자에게 인식 가능함. 주요 문법 범주가 대개 올바름. 빈번한 형태론적 오류. |
| **배포 가능** | 0.70–0.85 | 인간 검토를 동반한 초안 번역에 적합함. 대부분의 형태론이 올바름. |
| **유창** | 0.85–1.00 | 유능한 인간 번역에 근접함. 오류가 드물고 경미함. |

이 등급들은 잠정적입니다. 인간 검증 데이터가 축적되고 각 언어에 대해 "화자가 이것을 유용하다고 여기는" 임계값이 실제로 어디에 있는지 알게 됨에 따라 재보정될 것입니다. 어떤 방법도 이중언어 화자들이 출력이 사용 가능하다는 데 동의함을 커뮤니티 검토가 확인하지 않고서는 **배포 가능** 이상을 주장할 수 없습니다.

### 5.1 등급 임계값(기계 판독 가능)

코드 구현의 경우, 임계값은 다음과 같습니다(위에서 아래로 평가, 첫 번째 일치가 우선):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. 비용 지표

비용 지표는 번역 방법의 재정적 효율성을 측정합니다. 이들은 품질과 별도로 보고됩니다 — 비용은 종합 점수에 영향을 미치지 않습니다(비용 조정 이차 순위를 제외하고).

### 6.1 토큰 지표

| ID | 지표 | 계산 |
|----|--------|-------------|
| `prompt_tokens` | 총 입력 토큰 | 모든 API 호출에 걸친 `usage.prompt_tokens`의 합 |
| `completion_tokens` | 총 출력 토큰 | `usage.completion_tokens`의 합 |
| `reasoning_tokens` | 사고 연쇄 토큰 | `usage.completion_tokens_details.reasoning_tokens`의 합(대부분의 모델에서 0) |
| `cached_tokens` | 제공자 캐시된 토큰 | `usage.prompt_tokens_details.cached_tokens`의 합 |
| `total_tokens` | 소비된 총 토큰 | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | 번역당 평균 토큰 | ✅ `total_tokens / entry_count` |

### 6.2 비용 지표

| ID | 지표 | 계산 | 사용 사례 |
|----|--------|-------------|----------|
| `total_cost_usd` | 총 런 비용 | 제공자 보고 가격 × 토큰 수 | "이 벤치마크 비용은 얼마였는가?" |
| `cost_per_entry_usd` | 코퍼스 항목당 비용 | `total_cost_usd / entry_count` | 동일한 코퍼스에서 방법 비교 |
| `cost_per_1k_tokens` | 1,000 토큰당 비용 | ✅ `total_cost_usd / total_tokens × 1000` | 보편적 LLM 효율성 — 코퍼스 전반에 걸쳐 비교 가능 |
| `cost_per_source_char` | 원본 문자당 비용 | `total_cost_usd / total_source_chars` | 다른 토큰화를 가진 언어 전반에 걸쳐 비교 가능 |

> **여러 비용 지표를 사용하는 이유는?** "항목"은 길이가 다양합니다 — 3단어 구절은 문단보다 비용이 적게 듭니다. `cost_per_entry_usd`는 *동일한* 코퍼스에서 방법을 비교하는 데 유용합니다(동일한 항목 = 동일한 길이 = 공정한 비교). `cost_per_1k_tokens`는 표준 LLM 효율성 지표로, 코퍼스 *전반에 걸쳐* 비교 가능합니다. `cost_per_source_char`은 토큰화 차이를 정규화합니다 — 동일한 문장이 모델의 어휘에 따라 다른 수의 토큰으로 토큰화될 수 있습니다.

### 6.3 비용 조정 점수

유료 API를 사용하는 방법의 경우, 우리는 이차 순위를 계산합니다:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

이는 좋은 점수를 효율적으로 달성하는 방법에 보상합니다. 비용 조정 점수는 항상 단일 벤치마크(동일한 코퍼스) 내에서 계산되므로 항목별 비교가 공정하기 때문에 `cost_per_entry_usd`(토큰별이 아님)를 사용합니다.

비용 조정 점수는 **이차 순위**입니다 — 주요 리더보드는 종합 점수로 순위를 매깁니다. 이는 다른 질문에 답합니다: "주어진 예산에서, 어떤 방법이 최고의 결과를 주는가?"

---

## 7. 속도 지표

속도 지표는 번역 방법의 지연 시간과 처리량을 측정합니다. 비용과 마찬가지로, 속도는 종합 점수에 영향을 미치지 않습니다.

| ID | 지표 | 계산 | 수준 |
|----|--------|-------------|-------|
| `elapsed_seconds` | 벽시계 런 지속 시간 | `time_end - time_start` | 런 |
| `avg_latency_seconds` | 항목별 평균 지연 시간 | `Σ latency_s / n_entries` | 코퍼스 |
| `median_latency_seconds` | 항목별 중앙값 지연 시간 | `latency_s`의 50번째 백분위수 | 코퍼스 |
| `p95_latency_seconds` | 95번째 백분위수 지연 시간 | `latency_s`의 95번째 백분위수 | 코퍼스 |
| `tokens_per_second` | 처리량 | `total_tokens / elapsed_seconds` | 런 |
| `entries_per_minute` | 번역률 | `entry_count / (elapsed_seconds / 60)` | 런 |

---

## 8. 신뢰도와 유의성

### 8.1 부트스트랩 신뢰 구간

모든 주요 지표는 부트스트랩 신뢰 구간(백분위수 방법, n=1000 재표본, α=0.05)을 지원합니다:

| 지표 | 보고된 CI |
|--------|------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (FST 데이터가 존재할 때만 계산됨) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (캐시된 항목별 점수로부터 부트스트랩됨 — 중복 신경망 추론 없음) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (chrF++와 exact_match가 사용 가능할 때 계산됨) |
| 등급별 CI | ✅ `confidence_intervals_by_tier` — 난이도 수준별(등급 1-5) chrF++ 및 exact_match CI |

### 8.2 쌍체 부트스트랩 유의성 검정

두 방법을 비교하기 위해, 하네스는 쌍체 부트스트랩 재표본 검정을 계산합니다:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

p-값 < 0.05이고 차이의 신뢰 구간이 0을 배제하면, 그 차이는 95% 수준에서 통계적으로 유의합니다.

---

## 9. 런 카드 점수 스키마

이 절은 런 카드의 `scores` 블록의 계층적 구조를 정의합니다. 이 스키마는 §2–§7에 정의된 지표에서 파생되며 동기화된 상태로 유지되어야 합니다.

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

> **스키마 이력.** 이전 명세 초안은 별도의 `cost`, `speed`, `tokens` 블록을 제안했습니다. 이들은 단순성을 위해 각각 `scores`와 `totals`으로 병합되었습니다. 속도 지표(`tokens_per_second`, `entries_per_minute`, 지연 시간)는 `scores`에 있고; 토큰 수와 비용 수치는 `totals`에 있습니다.

### 9.1 스키마–데이터베이스 매핑

런 카드 JSON은 Supabase에서 `jsonb` 열로 전체가 저장됩니다. 주요 지표는 정렬/필터 성능을 위해 최상위 열로도 비정규화됩니다:

| 런 카드 필드 | Supabase 열 | 유형 | 인덱스 |
|---------------|----------------|------|-------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(전체 카드)* | `run_card` | `jsonb` | — |

새 지표가 구현될 때, 해당 열은 `arena/migrations/`의 번호가 매겨진 마이그레이션을 통해 추가되어야 합니다.

---

## 10. 코드–명세 동기화

### 10.1 표준 소스

이 문서(`cli/website/docs/network/specifications/scoring.md`)는 다음의 표준 소스입니다:
- 지표 정의 (§2)
- 종합 가중치 표 (§4.3)
- 품질 등급 임계값 (§5.1)
- 비용 지표 공식 (§6.2)
- 런 카드 점수 스키마 (§9)

### 10.2 코드 미러

파일 `arena/mt_eval_harness/scoring.py`는 이 문서의 가중치 표와 등급 임계값을 미러링합니다. 이는 §4.3과 §5.1의 **코드 구현**입니다. 이 문서가 업데이트될 때:

1. 일치하도록 `scoring.py`를 업데이트합니다
2. 정렬을 검증하기 위해 `pytest tests/test_scoring_ssot.py`을 실행합니다
3. 가중치를 요약하는 FAQ 및 웹사이트 문서를 업데이트합니다

### 10.3 이 명세를 참조하는 문서

| 문서 | 그것이 참조하는 것 | 동기화 유지 방법 |
|----------|-------------------|---------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | 종합 공식, 가중치 표, 등급 임계값 | 이 문서를 교차 참조; 표를 복제하지 마십시오 |
| `website/docs/getting-started/faq.md` | 단순화된 가중치 요약 | §4.3과 일치해야 함; 이 문서로 다시 링크 |
| `cli/website/docs/network/how-it-works.md` | 배포 가능 임계값 | §5와 일치해야 함 |
| `scoring.py`를 통한 `publish.py` | 가중치 딕트 + 등급 함수 | 자동 테스트가 일치를 검증함 |

---

## 부록 A: 종합에 없는 지표(및 이유)

| 지표 | 제외 이유 |
|--------|-------------|
| **BLEU** | 단어 수준 채점은 다종합성 언어에서 형태론적 변형에 벌점을 부과함. 사소한 굴절 차이(올바른 의미, 약간 다른 접미사)가 완전한 실패로 간주됨. chrF++는 문자 수준에서 이를 더 잘 처리함. |
| **COMET** | WMT 데이터(고자원 유럽어 쌍)로 학습됨. LRL(예: 크리어)의 경우 모델이 외삽하며 보정되지 않음. COMET/AfriCOMET은 **별도의 신경망 레인에서 계산 및 보고됨 — 어떤 종합에도 절대 없음**(종합은 결정론적임; §4.3) — 그리고 검증기에 의해 재도출됨. |
| **TER** | 편집 거리는 대부분의 사용 사례에서 chrF++와 상관관계가 있음. 둘 다 포함하면 표면 유사성을 이중 계산하게 됨. TER은 참조용으로 보고됨. |
| **길이 비율** | 품질 신호가 아니라 진단임. 1.02 비율과 0.98 비율은 둘 다 괜찮음. 극단적인 값만이 문제를 나타냄. |
| **일관성 점수** | 코퍼스 수준 전용 — 집계할 항목별 값 없음. 또한, 일부 비일관성은 정당함(동일한 영어 단어 → 맥락에 따라 다른 대상 언어 번역). |
| **준수 지수** | 품질 신호가 아니라 품질 게이트. 번역 정확도가 아니라 구조적 보존(플레이스홀더, 인용부호)을 측정함. |

## 부록 B: LYSS — 언어별 지표 구현

**LYSS** 프레임워크(Linguistically-informed Yield & Structural Scoring)는 표면 수준 문자열 비교를 넘어서는 언어별 지표를 제공합니다. LYSS에는 세 개의 핵심 구성 요소가 있습니다:

- **LYSS-fst** — 형태론적 유효성(`fst_acceptance_rate`): 각 단어가 대상 언어에서 유효한 형태인가?
- **LYSS-eq** — 언어학적 동치(`equivalent_match_rate`): 출력이 참조의 허용 가능한 변형인가?
- **LYSS-sem** — 의미 검증(`semantic_score`): 출력이 원본 의미를 보존하는가?

> **검증 상태: 🔶 엔지니어링 휴리스틱.** LYSS 지표는 인간의 품질 판단에 대해 검증되지 않았습니다. 이들은 언어학적 원칙(UAlberta ALTLab의 언어학자들이 구축한 FST, 사전, 문법 규칙)으로부터 설계되었지만, LYSS 점수와 실제 번역 품질 간의 상관관계는 측정되지 않았습니다. 필요한 검증 실험은 [화자 검증 프로토콜](/docs/network/specifications/speaker-validation)을 참조하십시오.

| 언어 | 플러그인 | 위치 | LYSS 구성 요소 | 지표 키 | 비고 |
|----------|--------|----------|----------------|------------|-------|
| CRK (평원 크리어) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | 결정론적 변형-클래스 규칙: 어순, 정서법, 선택적 조사, 표제어 동의어, 진행형 모호성, 포함/배제. 항목별 `lint_verdict`(EXACT/EQUIVALENT/MISS/NO_OUTPUT)를 생성함. |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | 결정론적: FST 표제어 추출 + 사전 어의 + spaCy 내용어 중첩. 판정(EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT)을 생성함. |
| GiellaLT 언어 | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | 일반: CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU에 대해 작동함 — `.hfstol` 분석기가 있는 모든 언어. 지표는 일반적이지만, **평가 코퍼스는 오늘날 평원 크리어(crk)에 대해서만 존재하므로**, crk가 실무적으로 FST 채점되는 유일한 언어임([정직한 한계](/docs/network/honest-limitations) 참조). |

> **아키텍처 참고(2026년 6월).** 언어별 LYSS 지표는 이제 언어 카드에서 `evalMetrics` 아래에 선언되며 `plugin_discovery.py`에 의해 `eval_standards/<lang>/`에서 로드됩니다. 이들은 방법 플러그인 지표(참가자)가 아니라 **평가 표준**(심판)입니다. 이는 CRK를 대상으로 하는 모든 번역 방법이 자동으로 LYSS에 의해 채점됨을 의미합니다 — 방법별 구성이 필요 없습니다. `CrkFSTMetric`는 제거되었습니다; 그 기능은 일반 `GiellaLTFSTMetric`에 의해 완전히 커버됩니다.

## 부록 C: 고려 중인 지표

이들은 평가 중이지만 §2에 넣기에는 아직 충분히 명세되지 않은 아이디어입니다:

| 아이디어 | 그것이 측정할 것 | 장애물 |
|------|----------------------|----------|
| 유창성 (LM 퍼플렉시티) | 출력이 대상 언어에서 잘 형성된 산문인가? | 대상 언어 LM이 필요함. 대부분의 LRL에 좋은 모델이 존재하지 않음. |
| 레지스터 일치 | 번역이 예상되는 격식 수준과 일치하는가? | 사회언어학적 분류기가 필요함. 연구 문제. |
| 문화적 적절성 | 문화적 참조가 올바르게 처리되는가? | 자동화될 수 없음 — 본질적으로 인간 검토가 필요함. |
| 담화 일관성 | 연속적인 번역이 일관된 구절을 형성하는가? | 문장 수준이 아니라 문서 수준 평가가 필요함. |

---

## 참고문헌

이 명세 전반에 걸쳐 인용된 학술 논문, 도구, 언어 자원.

### 표면 지표

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Denmark.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### 신경망 지표

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### 형태론적 및 언어학적 도구

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### 오류 분류 및 진단 평가

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Related work on feature-based evaluation metrics, including FUSE.)

### 환각 감지

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### 크리어 언어 자원

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### 데이터 거버넌스

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
