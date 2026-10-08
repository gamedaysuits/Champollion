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

> **요약.** 이 문서는 Champollion 기계 번역(MT) 평가 생태계에서 실행(run)을 채점하는 방식에 대한 단일 정보원(SSOT)이에요. 하나의 대표 지표, 그와 함께 보고되는 기타 표준 지표, 별도로 보고되는 진단 지표, 비용 및 속도를 다뤄요. 실행은 학계 및 업계에서 사용하는 표준 방식 그대로 채점돼요. 바로 **sacreBLEU 시그니처 및 95% 부트스트랩 신뢰구간이 포함된 말뭉치 수준 chrF++**를 중심으로, BLEU, spBLEU, TER, COMET을 함께 보고하며, 한 시스템이 다른 시스템보다 우수한지 판단하기 위한 쌍체 유의성 검정을 진행해요. 언어별 진단 지표(FST 형태소 유효성, 린터 동치 클래스, 결정론적 의미 검증)는 총칭하여 **LYSS**(Linguistically-informed Yield & Structural Scoring)로 명명돼요. 이전에 사용되던 가중치 기반 종합 점수와 품질 티어 레이블은 **폐기되었으며**(§4, §5), 해당 표들은 기존 카드를 계속 검증할 수 있도록 이곳에 보존되어 있을 뿐이에요. 코드, 문서 및 데이터베이스 스키마는 이 문서를 바탕으로 파생돼요. 내용이 충돌할 경우 이 문서가 우선해요.
>
> **범위.** 이 문서는 우리가 *무엇*을 측정하고 *어떻게 채점하는지*를 정의해요. 런 카드 스키마(BENCHMARK_SPEC §3 참조), 벤치마크 프로토콜(BENCHMARK_SPEC §6), 리더보드 규칙(arena 문서 참조)은 정의하지 않아요. 해당 문서들은 지표 정의와 채점 로직을 파악하기 위해 본 문서를 참조해요.


---

## 실행 채점 방식 {#how-runs-are-scored}

모든 새로운 실행은 **채점 표준 `standard/1`**에 따라 채점돼요. 런 카드에도 명시되어 있어요. `scores.scoring_standard`은 `"standard/1"`이며, `scores.primary_metric`는 `"chrf_plus_plus"`이에요.

| 역할 | 항목 | 표시 위치 |
|------|------|-----------|
| **대표 및 순위 지표** | 말뭉치 수준 **chrF++**(`word_order=2`가 적용된 sacreBLEU chrF), 0–100 범위, 95% 부트스트랩 신뢰구간 및 sacreBLEU 시그니처 포함 | `chrF++ 47.5 [45.9, 49.0]` 뒤에 시그니처가 붙는 형식으로 표기돼요. 런 카드: `scores.chrf_plus_plus`, 신뢰구간은 `scores.confidence_intervals.corpus_chrf`, 시그니처는 `scores.sacrebleu_signatures.chrf`. 데이터베이스: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **기타 표준 지표** | BLEU, spBLEU(FLORES-200 SentencePiece), TER, 그리고 계산된 경우 COMET | chrF++ 옆에 표시되며, 각각의 시그니처 또는 COMET 모델 ID가 함께 제공돼요. chrF++나 다른 지표와 절대로 혼합되지 않아요. |
| **진단 지표** | 완전 일치(Exact match), FST 수용률, 형태소 정확도, 코드 스위칭, 환각, 용어 준수율, 문체, 그리고 모든 점수 주의사항(§2.8) | 별도로 보고되며 진단 지표로 레이블이 지정돼요. 대표 수치에 포함되지 않으며 실행 순위를 매기는 데에도 사용되지 않아요. 주의사항은 대표 지표 옆에 눈에 띄게 유지돼요. |
| **비용 및 속도** | 토큰 수, 비용(달러), 지연 시간(§6, §7) | 점수 옆에 함께 보고되며, 점수와 절대 결합되지 않아요. |

**"우수함" 판정.** 동일한 평가 세트에 대한 두 실행은 chrF++에 대한 쌍체 유의성 검정을 통해 비교돼요(기본값은 근사 무작위화 검정, 선택 옵션으로 쌍체 부트스트랩 리샘플링 제공, §8.2). 기타 표준 지표도 함께 검정되고 표시돼요. 두 수치가 얼마이든 간에 유의하지 않은 차이는 유의하지 않다고 보고돼요.

**품질 레이블 미제공.** 자동 채점 결과는 품질에 대한 최종 판정이 아니에요. 새 카드에는 티어나 "기능적(functional)", "배포 가능(deployable)"과 같은 레이블이 부여되지 않아요. 해당 언어 사용자의 인간 평가만이 품질을 공식 검증할 수 있어요([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**폐기된 항목.** 새 카드는 `composite: null`, `quality_tier: null`, `cost_adjusted: null`을 게시해요(비용 조정 점수는 종합 점수를 비용 계수로 나눈 값이었으며, 비용 자체는 여전히 보고돼요). 새로운 출력에는 종합 점수나 티어가 출력되지 않아요. 표준 도입 이전에 발행된 카드는 저장된 종합 점수를 유지하며 계속 검증할 수 있어요. 검증 도구는 `scoring_standard`가 없는 카드는 레거시 계산 방식(§4)으로, `standard/1` 카드는 chrF++를 다시 도출하여 재검증해요. 이전 카드의 종합 점수가 표시되는 곳에는 항상 **레거시 종합 점수(폐기됨)**라는 레이블이 붙어요.

**이것이 표준인 이유.** 학계와 업계에서 기계 번역 평가를 보고하는 표준적인 방식이기 때문이에요:

- **WMT**는 공유 태스크(shared-task) 시스템 순위를 인간 평가로 매기며, 수치를 재현할 수 있도록 sacreBLEU 시그니처와 함께 자동 지표를 보고해요(Post 2018; Kocmi et al. 2024).
- **FLORES-200**(NLLB Team 2022)은 대부분이 저자원 언어인 200개 언어에 대해 chrF++와 spBLEU를 보고해요.
- 아메리카 대륙 토착어로의 번역을 다룬 **AmericasNLP** 공유 태스크는 시스템 순위를 chrF로 매겨요(Mager et al. 2021; Ebrahimi et al. 2023). 문자 단위 n-gram이 단어 단위 BLEU보다 풍부한 형태론적 특성을 더 잘 처리하기 때문이에요(Popović 2015, 2017).
- 수천 개의 인간 평가 데이터와 자동 지표를 비교한 Kocmi et al. (2021)에 따르면, 지표 간 차이의 크기와 통계적 유의성 여부가 인간 선호도를 예측하는 핵심 요소예요. 이것이 바로 단순 수치 나열이 아니라 쌍체 유의성 검정(Koehn 2004; Riezler & Maxwell 2005)을 통해 비교를 수행하는 이유예요.

**콘테스트.** 콘테스트의 자격 기준은 0–100 범위의 chrF++ 단독 지표이며, 콘테스트의 `primary_metric` 기본값은 `chrf_plus_plus`이에요. 평가 지표로 `composite`를 요구하는 새 콘테스트는 사유와 함께 거부돼요. 표준 제정 이전에 생성된 콘테스트는 계속 정상 작동해요. 주최자는 제출물이 통과해야 하는 관문(gate)으로서 상금 조건에 진단 지표 기준(예: 최소 FST 수용률)을 설정할 수 있지만, 이를 최종 점수로 삼을 수는 없어요([상금 사양](/docs/network/specifications/prizes)).

**표준 변경.** 대표 지표는 새로운 표준 버전(`standard/2`)이 나와야만 변경돼요. 모든 카드는 채점 기준이 된 표준명을 명시하며 해당 표준에 따라 검증돼요.

---

## 1. 채점 철학

### 1.1 마이크로평가 철학

> *"일반화되는 것에만 집중한다면, 우리는 필연적으로 일반화되지 않는 곳을 잊게 될 것이며 — 이러한 언어들과 그들의 모든 지식과 지혜를 잃게 될 것입니다."*

이 프로젝트는 **마이크로평가(microeval) 개발**을 실천합니다. 즉, 사용 가능한 최고의 언어학 도구 — 유한 상태 변환기, 이중언어 사전, 형태소 분석기, 언어학자가 큐레이션한 동치 규칙 — 를 사용하여 특정 언어에 맞춘 평가 지표를 구축합니다. 이는 모든 언어에서 작동하는 보편적 지표를 추구하는, MT 평가의 지배적 패러다임과는 정반대입니다. 보편적 지표는 가치가 있지만, 정확히 가장 필요한 곳 — 복잡한 형태론, 제한된 학습 데이터, 신경망 지표 학습 세트에서의 대표성 부재를 가진 언어들 — 에서 가장 취약합니다.

세계의 많은 언어에 대해 우리가 기계 번역에서 진전을 이루지 못하는 이유는 단지 코퍼스가 부족해서만이 아니라, **진전이 무엇인지조차 알지 못하기** 때문입니다 — 번역 시스템이 개선되고 있는지 측정할 자동 평가 도구가 없기 때문입니다. LYSS는 존재하는 어떤 언어학 자원이든 사용하여, 언어 하나하나마다 이러한 도구를 구축하려는 우리의 시도입니다.

### 1.2 자동 지표는 대리 지표입니다

여기에 정의된 모든 지표는 기계적으로 계산돼요. 빠른 반복 실험, 체계적인 비교, 성능 저하 감지에 유용해요. 하지만 **인간의 판단을 대체할 수는 없어요**. 어떤 자동 점수에도 품질 레이블을 붙이지 않는 이유가 바로 이 때문이며, 실제 사용 가능 여부는 오직 인간의 검토를 통해서만 확인할 수 있어요.

### 1.3 하나의 대표 지표, 여러 가지 신호

어떤 단일 지표도 번역 품질을 온전히 담아내지 못해요. 번역 결과가 높은 chrF++ 중복도를 가지면서도 형태론적 검증에 실패할 수 있어요. FST 검사는 통과하지만 엉뚱한 의미를 담고 있을 수도 있죠. 의미적으로는 정확하지만 대상 언어의 문체와 전혀 맞지 않을 수도 있어요. 따라서 모든 실행은 다양한 신호를 보고해요. 하지만 대표 및 순위 지표는 오직 chrF++ 하나뿐이며, 다른 지표들은 나란히 표시될 뿐 결코 대표 지표와 섞이지 않아요. 언어마다 서로 다른 의미를 지니는 신호들을 뒤섞으면 값싼 신호에서 점수를 잘 얻는 시스템이 평가를 왜곡할 수 있으며(폐기된 종합 점수의 사례는 §4 참조), 사용자는 뒤섞인 수치만 보고 어떤 신호가 변했는지 알 수 없어요.

### 1.4 확장성

이 지표 목록은 고정된 것이 아니에요. 새로운 언어가 추가되면 새로운 요구사항이 생겨요. 성조 언어의 성조 정확도, 셈어파 문자의 발음 구별 부호 정확도, 크리어의 음절 문자 정확도 등이 대표적이에요. 아키텍처(MetricPlugin 프로토콜)를 통해 대표 점수를 건드리지 않고도 진단 지표를 추가할 수 있어요. 특정 언어 전용 지표(예: CRK의 린터 및 의미 검증기)는 언어 카드의 `evalMetrics` 아래에 선언되며 `eval_standards/`에서 로드돼요. 평가 하네스는 범용적인 동작 지표(코드 스위칭, 환각, 용어 준수)만 기본 제공해요.

### 1.5 평가의 세 가지 차원

모든 런 카드는 세 가지 독립적인 차원을 측정합니다:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

이들은 서로 독립적인 축이에요. 어떤 방식은 점수는 높지만 비용이 많이 들 수도 있고, 속도는 빠르지만 정확도가 떨어질 수도 있으며, 이들이 복합적으로 나타날 수도 있어요. 리더보드에서는 원하는 차원별로 정렬할 수 있어요. 공개되는 수치 중 이들을 결합한 값은 없어요(이를 결합했던 비용 조정 점수, §6.3은 폐기되었어요).

### 1.6 검증 상태

이 명세의 모든 지표는 구현 상태(§3)와는 구별되는 **검증 상태**를 가집니다. 구현 상태는 코드가 존재하는지 추적합니다. 검증 상태는 지표가 인간의 품질 판단과 상관관계가 있는 것으로 나타났는지 추적합니다.

| 검증 수준 | 의미 | 현재 지표 |
|------------------|---------|----------------|
| **✅ 외부 검증됨** | 발표된 인간 상관관계 연구가 존재함(WMT, 학술 논문) | `chrf_plus_plus`, `bleu`, `comet_score` *(고자원 쌍에 한함)* |
| **⚡ 대리 검증됨** | 고자원 언어에 대해 검증됨; 우리의 대상 LRL에 대해서는 미검증 | `comet_score` *(LRL의 경우: 고자원/EU 쌍에서 검증되었으며, 예를 들어 CRK로 외삽됨 — 방향적으로는 유용하나 보정되지 않음)* |

| **🔶 엔지니어링 휴리스틱** | 언어학적 원리나 관찰된 오류 패턴을 바탕으로 설계됨, 인간 상관관계 데이터 없음 | `fst_acceptance_rate`, `morphological_accuracy`(FST 파생, 표제어 매칭, 검증 도구 재도출), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 미검증** | 어떤 데이터에서도 아직 테스트되지 않음 | `orthographic_accuracy`, `consistency_score` |

> **`comet_score`이 두 행에 모두 나타나는 이유.** 이는 모순이 아니라 자원 수준에 따른 구분이에요. COMET은 WMT 인간 상관관계 연구가 존재하는 고자원(주로 유럽 언어 쌍) 환경에서는 *외부 검증된* 지표예요. 반면 본 프로젝트의 대상인 저자원 언어에 대해서는 그러한 연구가 없으므로 동일한 지표가 *대리 검증* 수준에 머물러요. 모델이 형태론적 체계가 완전히 다른 언어들로부터 외삽하기 때문이에요. 따라서 모델 ID 및 캘리브레이션 주의사항과 함께 chrF++ 옆에 나란히 표시될 뿐 결코 혼합되지 않아요.

> **실제 적용 의미.** 대표 지표(chrF++)는 업계 표준 방식으로 활용되는 외부 검증 지표예요. 위의 모든 엔지니어링 휴리스틱은 **진단 지표**예요. 특정 실행이 왜 그런 점수를 받았는지(단어가 유효한 형태가 아니라거나, 결과물이 영어로 바뀌었다거나 하는 등) 설명할 수는 있지만, 최종 점수가 될 수 없으며 순위를 매기지도 않아요. 폐기된 종합 점수(§4)는 모든 검증 수준의 휴리스틱을 대표 점수에 포함시켰기 때문에, 시스템이 번역을 전혀 하지 않고도 대부분의 점수를 얻을 수 있었어요(§4).
>
> **필수 검증 실험**(`mt-evaluation-landscape.md` §6 및 `speaker-validation.md` 참조):
> 1. 인간 판단 상관관계 연구: 3명 이상의 이중언어 사용자가 평가한 200개 이상의 문장 쌍
> 2. 대표 말뭉치에 대한 FST 오거부율(false rejection rate) 측정
> 3. 일반화 검증을 위한 두 번째 언어(북부 사미어) 이식
> 4. 동일한 데이터에서 COMET과의 직접 비교


---

## 2. 지표 목록 {#2-metric-inventory}

지표는 6개 범주(표면, 구조, 의미, 동작, 규정 준수, 보고용 비교 지표)로 구성돼요. 각 지표는 구현 상태, 척도, 수준(항목별, 말뭉치 수준, 또는 둘 다)을 가지며, 표준 하에서 **대표**(chrF++ 전용), **표준**(BLEU, spBLEU, TER, COMET — 대표 지표 옆에 표시), **진단**(기타 모든 항목 — 별도 보고) 중 하나의 역할을 맡아요.

### 2.1 표면 지표

표면 지표는 예측된 번역을 참조 번역과 문자열 수준에서 비교합니다. 이들은 언어학 도구가 필요 없습니다 — 단지 문자열 비교만 필요합니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 내용 |
|----|------|------|------|------|-----------|
| `exact_match_rate` | 완전 일치 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | **진단 지표.** 이진 평가: 예측 결과 == 참조 번역 여부. 말뭉치 비율 = 일치 건수 / 전체 건수. |
| `equivalent_match_rate` | 동치 일치 | ⚡ 일부 구현 | 0.0–1.0 | 둘 다 | **진단 지표.** 예측 결과가 허용된 변형 중 하나와 일치하는지 여부. CRK의 경우: 결정론적 변형 클래스 규칙(어순, 정서법, 선택적 불변화사, 표제어 유의어, 진행형 모호성)을 사용하는 CRK 평가 표준의 `CrkLinterMetric`(`eval_standards/crk/` 내)을 통해 구현됨. CRK 언어 카드의 `evalMetrics` 선언을 통해 자동 로드됨. 범용적인 다국어 구현에는 말뭉치 내 항목별 `variants[]`가 필요함. |
| `chrf_plus_plus` | chrF++ | ✅ 구현됨 | 0–100 | 둘 다 | **대표 및 순위 지표.** 단어 유니그램 및 바이그램이 결합된 문자 n-gram F-점수(sacreBLEU chrF, `word_order=2`; Popović 2017). 형태론적 변형에 강건함. 게시되는 값은 95% 부트스트랩 CI와 sacreBLEU 시그니처가 포함된 말뭉치 수준(`corpus_chrf`) 값이며, 항목별 값(`sentence_chrf`)은 유의성 검정에 사용됨. |
| `bleu` | BLEU | ✅ 구현됨 | 0–100 | 말뭉치 | **chrF++ 옆에 표시되는 표준 지표**(런 카드 및 데이터베이스 `corpus_bleu`, sacreBLEU 시그니처 포함). 단어 수준 n-gram 정밀도(Papineni et al. 2002). 단어 수준 매칭은 접미사만 다른 올바른 단어를 완전한 오답으로 처리하여 형태론적으로 풍부한 언어에 불리하므로 대표 지표로 사용하지 않음. |
| `ter` | 번역 편집률 (TER) | ✅ 구현됨 | 0–∞ (낮을수록 좋음) | 둘 다 | **chrF++ 옆에 표시되는 표준 지표**(`scores.ter`, sacreBLEU 시그니처 포함). 참조 번역 길이에 맞춰 정규화된 예측 결과와 참조 번역 간 최소 편집 거리(sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | 길이 비율 | ✅ 구현됨 | 0–∞ (1.0이 이상적) | 둘 다 | **진단 지표.** 문자 수 기준 `len(predicted) / len(reference)`. 지나친 축약(<0.5) 및 과도한 팽창/환각(>2.0)을 감지함. 말뭉치 수준에서 항목 간 평균을 냄. |

### 2.2 구조 지표

구조 지표는 번역의 언어학적 적격성을 검증합니다. 이들은 언어별 도구(FST 분석기, 형태소 파서)가 필요하며 형태론적으로 풍부한 언어에 대한 가장 강력한 신호입니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 내용 |
|----|------|------|------|------|-----------|
| `fst_acceptance_rate` | FST 수용률 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | **진단 지표.** 유한 상태 변환기(GiellaLT)에 의한 출력 단어 수용 여부. FST가 하나 이상의 형태 분석 결과를 반환하면 "유효한" 단어로 간주됨. **집계:** 게시되는 말뭉치 값은 **항목별 비율의 평균**이에요. 즉, 각 항목의 수용된 단어 수 ÷ 해당 항목의 총 단어 수를 FST가 분석한 항목 전체에 걸쳐 평균 낸 값이며, 빈 출력은 0으로 처리돼요(플러그인의 `avg_fst_validity`). 풀링된 전체 단어 비율(전체 수용 단어 수 ÷ 전체 단어 수, `corpus_validity_rate`)은 실행 보고서 및 런 카드에 함께 보고되지만 공식 게시 값은 아니에요. 항목별 길이가 다르면 두 값이 달라져요. GiellaLT `.hfstol` 분석기가 있는 모든 언어에서 사용할 수 있어요. **대소문자 처리:** 단어는 작성된 그대로 조회돼요. FST가 거부하고 첫 글자가 대문자인 경우 첫 글자를 소문자로 바꿔 다시 조회(`Mun` → `mun`)하며, 전체 대문자 단어는 Titlecase로 바꾼 후 다시 소문자로 조회해요(`OSLO` → `Oslo`, `GIITU` → `giitu`). 그 반대로는 절대 처리하지 않아요. 소문자로 작성된 고유명사(`oslo`)는 그대로 거부돼요. GiellaLT의 맞춤법 검사기 수용자(북부 사미어, 암하라어, 바스크어) 및 ALTLab의 엄격한 플레인스 크리어 분석기는 대부분의 단어를 소문자로만 등재하고 대소문자 처리를 주변 프로그램에 맡기기 때문에, 이 처리가 없으면 문장 시작의 올바른 대문자가 유효하지 않은 단어로 처리돼요. 이는 계산 버전 `case-fallback/1`로, 보고서(`fst_acceptance_method`, `total_case_folded_words` 및 각 항목의 `fst_case_folded_words` 포함)와 런 카드(`fst_provenance.acceptance_method`)에 명시돼요. 이 버전이 없는 보고서는 대소문자를 구분하여 채점되었으므로 대문자가 포함된 텍스트의 점수가 더 낮게 나와요. `mt-eval compare`는 두 버전을 비교할 때 이를 명시하며, `mt-eval test <run log>`는 이전 실행을 다시 채점해요. 검증 도구는 카드가 명시한 방식에 따라 게시된 카드의 FST 파생 수치를 다시 계산하며, 방식이 명시되지 않은 카드는 대소문자를 구분하여 계산하므로, 카드는 항상 게시 당시의 계산 방식에 따라 검증돼요. |
| `morphological_accuracy` | 형태소 정확도 | ✅ 구현됨 (검증 도구 재도출) | 0.0–1.0 | 둘 다 | **진단 지표.** 단어가 FST 유효성을 만족하더라도 잘못된 굴절형(어근은 맞지만 접미사가 틀림)일 수 있어요. `plugins/giellalt_fst.py`에 의해 **계산**돼요. 분석 가능한 각 예측 단어에 대해 동일한 **표제어**(어근)를 공유하는 참조 단어를 찾고, 예측된 **굴절**(FST 특성 태그)이 일치하는지 확인해요. 위치가 아닌 표제어로 매칭하므로 단어 정렬 문제를 우회할 수 있어요. 다른 어휘 선택이나 정렬되지 않은 쌍은 단순히 *포함 범위 제외*(오채점되지 않음)로 처리돼요. **골드 주석이 필요 없음** — 참조 번역에 대한 FST 분석 결과 자체가 정답(ground truth) 역할을 해요. FST가 분석할 수 없거나 어근이 참조 번역에 없는 단어는 평가 범위에서 제외돼요. `morph_coverage`(표제어 매칭 비율)이 공개되며, `MORPH_COVERAGE_FLOOR`(0.25) 미만일 경우 해당 값은 참고용(advisory)으로 표시돼요. **FST 모호성에 대해 관대함**(여러 분석 결과를 가진 예측 단어는 *하나라도* 일치하면 "정답"으로 간주 → 상한선으로 공개됨). **분석기**가 필요해요. 맞춤법 검사기 **수용자(acceptor)** 역할만 하는 FST(북부 사미어, 암하라어, 바스크어용으로 설치된 Divvun 맞춤법 패키지)는 단어의 존재 여부만 알려줄 뿐 표제어나 태그를 제공하지 않아요. 이러한 언어들의 경우 `morphological_accuracy` 및 `morph_coverage`은 null이 되며 `metric_availability`에 그 이유가 명시돼요. FST 수용률은 여전히 보고돼요. FST 핀에서 이를 선언하며(`kind: "acceptor"`), 지표 역시 태그를 전혀 반환하지 않는 변환기를 자체 감지해요. 표준 말뭉치에 대해 **검증 도구에 의해 다시 도출**돼요(카드에 고정된 FST를 다시 실행하는 `verifier.recompute_corpus_morph` — FST가 없으면 실패로 처리되며, COMET과 동일한 계약을 따름). 폐기된 종합 점수에서는 fst-coverage 프로필에서 0.15의 가중치를 가졌어요(§4.3). |
| `orthographic_accuracy` | 정서법 정확도 | 🔲 계획됨 | 0.0–1.0 | 둘 다 | **진단 지표 (계획됨).** 문체별 정확성을 검증해요. 크리어의 SRO 장음 부호(마크론/곡절부호) 사용, 이누크티투트어의 발음 구별 부호, 오지브웨어의 모음 길이 표시 등을 다뤄요. 언어별 규칙 세트가 적용돼요. |

> **구조적 지표가 더해주는 가치와 이것이 진단 지표인 이유.** 지금까지 발표된 가장 큰 MT 시스템인 Meta의 OMT-1600(1,600개 언어 지원, Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026)은 ChrF++, xCOMET, MetricX, BLASER 3을 사용해 평가를 진행해요. 이 중 형태론적 정확성을 검증하는 지표는 하나도 없어요. chrF++는 문자 n-gram 중복도를 측정하므로 참조 번역과 *비슷해 보이는* 문자열에 점수를 주며, 따라서 참조 번역과 많은 문자를 공유하는 형태론적으로 잘못된 단어라도 점수를 얻게 돼요. FST 수용률은 다른 질문을 던져요. "각 단어가 해당 언어에서 유효한 형태인가?" 이 점 때문에 포합어(polysynthetic languages) 평가에서 유용한 진단 도구가 돼요. 다만 이는 번역 점수는 아니에요. 원문이나 참조 번역을 전혀 보지 않기 때문에, 모든 입력에 대해 유효한 문장 하나만을 반복 출력하는 시스템도 이 검사를 완벽히 통과해요(실제 측정 사례는 §4 참조). 또한 chrF++는 표기 체계에 따라 달라지는 **0이 아닌 우연 점수 바닥값(chance floor)**을 가지고 있어요. 즉, 동일한 문자로 된 무작위 텍스트도 0점보다 눈에 띄게 높은 점수를 받으며, 표기 체계에 따라 그 정도가 달라져요. 따라서 원본 chrF++ 점수는 서로 다른 언어 간에 직접 비교할 수 없으며, 동일한 평가 세트 내에서 시스템 순위를 매길 때만 유효해요. 그러므로 네트워크 맵은 언어 간의 강도를 전혀 **순위 매기지 않아요**. 연결선(arc)은 해당 언어 쌍이 측정되었음을 의미할 뿐 그 이상은 아니에요. 이를 위해 우리가 개발한 우연 바닥값 보정(cchrF++)은 연구로 발표되었으며 공개 인터페이스에는 연결되어 있지 않아요. 이것이 무엇을 입증하고 무엇을 입증하지 못하는지는 [연결 강도](/docs/network/specifications/connection-strength)에 설명되어 있어요.

### 2.3 의미 지표

의미 지표는 임베딩이나 학습된 모델을 사용하여 의미 보존을 측정합니다. 표면상 다르지만 의미가 동등한 번역을 포착하고, 표면상 유사하지만 의미상 잘못된 번역을 표시합니다.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 내용 |
|----|------|------|------|------|-----------|
| `semantic_score` | 의미 유사도 | ⚡ 일부 구현 | 0.0–1.0 | 둘 다 | **진단 지표.** CRK: CRK 평가 표준의 `CrkSemanticMetric`(`eval_standards/crk/` 내, 대리 지표)에서 도출된 판정 가중 점수. 범용: 문장 임베딩의 코사인 유사도(원문 + 예측값 대 원문 + 참조값). 모델 미정 — 저자원 언어를 지원해야 하므로 영어 중심의 대부분 임베딩 모델은 제외됨. |
| `comet_score` | COMET | ✅ 구현됨 | ~0.0–1.0 | 둘 다 | **계산된 경우 모델 ID와 함께 chrF++ 옆에 표시되는 표준 지표**(`comet_model`). 학습 기반 MT 평가 지표(Rei et al. 2020). chrF++와 절대 혼합되지 않음. 검증 도구에 의해 다시 도출되므로 보고된 값은 재현 가능해야 함. 플레인스 크리어와 같은 언어의 경우 저자원 캘리브레이션 주의사항이 플래그로 표시됨. `unbabel-comet`가 설치되어 있을 때 계산됨. 35개 아프리카 언어의 경우 하네스가 `resolve_comet_model()`을 통해 AfriCOMET(`masakhane/africomet-mtl`)을 자동 선택하며, 해당 언어들에 대해 더 나은 인간 판단 상관관계를 보임. |

> **COMET이 대표 지표가 아니라 대표 지표 옆에 표시되는 이유.** COMET은 압도적으로 고자원 유럽 언어 쌍 위주인 WMT 인간 평가 데이터로 훈련되었어요. 진정한 고자원 언어 쌍(독일어, 프랑스어 등)의 경우 기본 `Unbabel/wmt22-comet-da`이 WMT를 통해 잘 검증되어 있으며, `resolve_comet_model()`이 이를 선택해요. 하지만 플레인스 크리어나 기타 저자원 언어에 적용할 경우 모델은 형태론적 체계가 완전히 다른 언어들로부터 외삽하게 되므로, 방향성 측면에서는 유용할지라도 보정(calibration)되지는 않으며 카드에도 이러한 사실이 명시돼요. 또한 2.3GB 크기의 모델이 필요하므로 모든 실행마다 계산할 수는 없어요. chrF++는 모든 언어에 대해 말뭉치만으로 재현할 수 있기 때문에 대표 지표로 사용되며, COMET은 계산되었을 때마다 그 옆에 나란히 보고돼요.

> **아프리카 언어를 위한 AfriCOMET.** 각 언어 카드에는 해당 언어에 대해 어떤 특화된 COMET 모델이 학습되었는지 선언하는 `metricModelSupport` 필드(언어 카드 명세 §9 참조)가 있습니다. 35개 아프리카 언어(yor, hau, ibo, amh, swa 등)의 경우, 카드는 AfriCOMET(`masakhane/africomet-mtl`)을 선언합니다 — Masakhane 커뮤니티가 아프리카 언어 MT 인간 판단으로 미세 조정한 COMET 모델입니다. 하네스는 언어 카드에서 읽어 `resolve_comet_model()`를 통해 권장 모델을 자동 선택하지만, 이는 `--comet-model`로 재정의할 수 있습니다. 새로운 언어→모델 매핑 추가는 (Python 코드를 편집하는 것이 아니라) 언어 카드를 보강하여 수행됩니다.

### 2.4 동작 지표

동작 지표는 번역 결과물에서 나타나는 특정한 실패 패턴을 감지해요. 품질을 직접 측정하는 것이 아니라 문제를 감지하는 역할을 해요. 이들은 모두 **진단 지표**예요.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 내용 |
|----|------|------|------|------|-----------|
| `code_switching_rate` | 코드 스위칭 비율 | ✅ 구현됨 | 0.0–1.0 (낮을수록 좋음) | 둘 다 | 출력 단어 중 출발어(주로 영어)로 유지된 단어의 비율. 유니코드 문자 분석 및/또는 출발어 단어 목록을 통해 감지됨. 매우 흔한 LLM의 실패 패턴으로, 대상 언어의 해당 표현을 모를 때 모델이 영어 단어를 그대로 삽입함. |
| `hallucination_rate` | 환각 비율 | ✅ 구현됨 | 0.0–1.0 (낮을수록 좋음) | 둘 다 | 출발어 내용과 대응되지 않는 출력 내용의 비율. 단어 정렬이나 교차 언어 임베딩 중복도를 통해 감지됨. 모델이 그럴듯하게 들리지만 지어낸 번역을 생성하는 현상을 잡아냄. |
| `terminology_adherence` | 용어 준수율 | ✅ 구현됨 | 0.0–1.0 | 둘 다 | 코칭된 방식 대상: 지정된 용어집 단어가 결과물에 포함된 비율. 용어집(`{"source term": "translation"}` 또는 용어별 허용 번역 목록)이 필요함. 소스는 모델에 절대 전달되지 않고 비교되는 모든 실행에 동일하게 주어지는 평가 입력인 `--glossary <file.json>`임. 그렇지 않은 경우 JSON `--coaching-file`의 `dictionary` 객체가 사용되며, 이 경우 실행은 자체 코칭 내용에 대해 채점되고 실행 결과물에 해당 사실이 명시됨. 둘 다 없는 경우 이 지표는 비활성화(null)됨. 모델이 전문가가 제공한 어휘를 준수하는지 측정함. |
| `consistency_score` | 항목 간 일관성 | 🔲 계획됨 | 0.0–1.0 | 말뭉치 전용 | 모델이 동일한 출발어 용어를 여러 항목에 걸쳐 동일하게 번역하는지 여부. 낮은 일관성은 모델이 학습된 패턴을 적용하기보다 임의로 추측하고 있음을 시사함. 말뭉치 항목 전반에 걸친 반복 용어가 필요함. |

### 2.5 준수 지표

규정 준수 지표는 번역물이 플레이스홀더, 서식, 타이포그래피 규칙 등의 구조적 무결성을 유지하는지 검증해요. 이는 품질 점수가 아니라 품질 게이트 검사이며, 표준에 따라 진단 지표로 분류돼요.

| ID | 지표 | 상태 | 척도 | 수준 | 구현 내용 |
|----|------|------|------|------|-----------|
| `compliance_index` | 2단계 준수율 | 🔲 계획됨 | 0.0–1.0 | 둘 다 | 가중 종합 점수: 변수 무결성 60%(`{placeholder}` 변수가 보존되었는가?) + 따옴표 준수율 20%(대상 언어의 따옴표 문자 사용) + 대소문자 준수율 20%(대소문자 구분이 없는 언어에서 라틴 문자 유출 방지). 원본 출력과 후처리 출력 모두에서 계산됨. `DoublePassCompliancePlugin` 클래스는 존재하지만 로드하는 평가 실행이 없으며, 언어별 따옴표 및 대소문자 규칙에 대해 인용된 출처가 아직 없음. 언어 카드에도 해당 내용이 없음. 출처가 없으면 변수 무결성 항목만 측정됨. |
| `repair_effectiveness` | 복구 효과성 | 🔲 계획됨 | 0.0–1.0 | 말뭉치 | 번역 후 훅(post-translation hook)에 의해 자동 복구된 규정 위반의 비율. 품질 게이트가 원본 출력을 얼마나 개선했는지 측정함. `compliance_index`과 동일한 이유로 계획 상태임. |

> **규정 준수가 점수가 아니라 게이트인 이유.** 규정 준수 지표는 번역 품질이 아니라 구조적 보존(플레이스홀더, 따옴표)을 측정해요. 번역이 언어학적으로 완벽하더라도 `{name}` 변수를 누락하면 규정 준수에 실패할 수 있어요. 이는 번역 품질 순위를 매기기 위한 것이 아니라, 잘못된 출력이 배포되는 것을 막기 위한 품질 게이트로 설계되었어요.

### 2.6 보고용 비교 지표

spBLEU는 chrF++ 옆에 나란히 표시되는 표준 지표 중 하나예요. 일반 chrF 및 FUSE 스타일 비교 지표는 이미 발표된 다른 표들과의 비교를 위해 보고돼요. 어느 것도 다른 항목과 혼합되지 않아요:

| ID | 지표 | 상태 | 참고 사항 |
|----|------|------|-----------|
| `spbleu` | spBLEU (FLORES-200 토크나이저) | ✅ 구현됨 | **chrF++ 옆에 표시되는 표준 지표**(`scores.spbleu`, sacreBLEU 시그니처 포함). FLORES-200 SentencePiece 토큰화(Goyal et al. 2022)를 기반으로 한 BLEU — 표기 체계/분절 방식이 달라도 비교 가능(NLLB/FLORES 공통 표준). `sentencepiece` 필요(핵심 의존성). |
| `chrf_plain` | 일반 chrF (`word_order=0`) | ✅ 구현됨 | 대표 지표인 chrF++(`word_order=2`)와 함께 AmericasNLP 및 다수의 WMT 표에서 보고하는 chrF 수치. 시그니처는 `sacrebleu_signatures.chrf_plain`임. |
| `fuse_score` | FUSE 스타일 비교 지표 | ⚡ 옵트인 (`--fuse`) | AmericasNLP-2025 FUSE 접근 방식(Raja & Vats)의 **미학습 재구현** 버전: LaBSE 의미 점수 + 어휘 토큰-F1 + 음성 Soundex + 퍼지 difflib를 *가중치 없는 평균*으로 결합함(기존 Ridge/GBM을 피팅할 인간 평가 학습 데이터가 없으며 이를 명시함). LaBSE/Soundex는 선택적 `fuse` 추가 기능임. LaBSE가 없으면 점수를 조작하는 대신 `compute_fuse`가 `None`을 반환함(공개됨). 실행된 각 구성 요소는 `fuse_components`에 나열되며, 결과에는 `fuse_untrained=true` 플래그가 지정됨. 진단 비교용으로만 사용됨. |

### 2.7 지표 네임스페이스 {#2-7-metric-namespaces}

단일 지표는 스택 전반에 걸쳐 최대 네 개의 조정된 이름을 가집니다:
**표준 id**(런 카드의 `scores` 키, 예: `equivalent_match_rate`),
그것을 계산하는 Python **플러그인 이름**(예: `crk_linter`), 그것을 선언하는 언어 카드
**`evalMetrics` 키**(예: `lyss-eq`), 그리고 리더보드의 비정규화된
**`run_cards` 열**(예: `equivalent_match_rate`). 이들은
의도적으로 구별됩니다 — 플러그인 이름은 *도구*를 명시하고, 지표 id는
*측정*을 명시합니다 — 그러나 반드시 서로 보조를 맞춰야 합니다.

해당 매핑의 단일 정보원(SSOT)은 `shared/metric-registry.json`이며, `mt_eval_harness.metric_manifest`에 의해 로드돼요. 각 항목에는 네 가지 명칭과 함께 `scale`, `direction`(높음/낮음/중립), `level`(항목/말뭉치/둘 다), `in_composite`(폐기된 종합 점수에 포함되었는지 여부, 기존 카드 검증을 위해 유지됨), `verifier_reproducible`이 기록돼요. `scoring.py`의 표나 `publish.py`에 의해 생성된 런 카드 `scores` 키가 레지스트리와 달라지면 패리티 테스트가 실패하므로, 새로운 지표가 불완전하게 연결된 상태로 배포될 수 없어요.

두 개의 관련 런 카드 필드가 지표 출처를 명시적으로 만듭니다:

- **`scores.metric_availability`** — `null` 점수의 사유를 명확히 하는 `{metric: reason}` 블록: `not_applicable`(해당 언어/실행에서 사용하지 않음), `unavailable`(선택적 의존성이 누락됨), `below_coverage_floor`(존재하지만 너무 희소하여 참고용에 불과함), `not_run`(옵트인 항목이며 요청되지 않음), 또는 `not_implemented`(계획됨). 블록에 없는 지표는 정상적으로 계산된 것이에요.
- **`fst_version`** / **`fst_provenance`** — FST 파생 지표의 기반이 되는 설치된 GiellaLT 변환기 릴리스 및 `pyhfst` 버전이에요. 구조적 점수를 정확한 분석기 빌드로 추적할 수 있도록 sacreBLEU 시그니처와 동일한 방식으로 캡처돼요. `fst_provenance.acceptance_method`은 변환기의 응답으로부터 수용률이 어떻게 계산되었는지를 나타내요(`case-fallback/1`, §1). 이 정보가 없는 카드는 대소문자를 구분하여 채점된 카드예요.
- **`scores.sacrebleu_signatures`** — 실행에서 계산된 모든 sacreBLEU 지표의 sacreBLEU 시그니처예요: `chrf`(chrF++ 대표 지표, `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. 두 chrF++ 수치는 시그니처가 일치할 때만 서로 비교할 수 있어요(Post 2018).

### 2.8 점수 주의사항 {#2-8-score-caveats}

점수가 정상적으로 계산되었더라도 레이블이 의미하는 바를 제대로 나타내지 못할 수 있어요. 하네스는 이러한 현상이 발생하는 알려진 패턴들을 모든 실행에 대해 검사해요. 조건이 감지되면 테스트 요약의 대표 지표 옆, `mt-eval compare`, 발행 미리보기 및 대시보드에 이를 출력하며, 발행된 카드에는 `score_caveats`로 포함되어 리더보드에도 표시돼요. 주의사항은 점수를 변경하지 않으며 점수의 한계를 설명할 뿐이에요. 각 주의사항은 `severity`(`major` 또는 `minor`)와 출력물 자체가 아닌 건수를 명시하는 한 문장의 메시지로 이루어진 진단 정보예요.

| 주의사항 | 발생 조건 |
|----------|-----------|
| `source_copy` | 채점된 출력물의 절반 이상이 원문과 동일한 경우(대소문자, 악센트, 구두점 무시). 참조 번역 자체가 원문과 동일한 항목(이름, 숫자 등)은 제외돼요. |
| `length_deflation` | 출력물의 길이가 참조 번역 길이의 평균 0.5배 미만이거나 1/4 이상의 항목이 이에 해당하는 경우 — 단어가 누락되었음을 의미해요. FST 수용률과 코드 스위칭은 존재하는 단어만을 기준으로 평가하므로, 단어를 생략하면 점수가 올라가요. |
| `length_inflation` | 출력물의 길이가 참조 번역 길이의 평균 2배를 초과하거나 1/4 이상의 항목이 이에 해당하는 경우(예: 퓨샷 예제가 모든 출력에 유출되는 경우). |
| `near_constant_output` | 서로 다른 수많은 입력에 대해 하나의 출력이 반복되는 경우: 반복된 출력이 고유 출발어의 최소 1/4 이상을 차지하고 최소 5개 이상이어야 해요. 3개의 원문이 동일한 출력을 받았거나(3단어 이상 출력의 경우) 5개의 원문이 동일한 출력을 받은 경우("Yes."와 같은 짧은 답변은 자연스럽게 반복될 수 있으므로 1~2단어 출력의 경우) 반복으로 간주돼요. 자체 참조 번역과 동일한 출력은 정답이지 반복이 아니에요. 이러한 기준을 정하기 전에 WMT 2019–2025 지표 태스크의 2,161개 실제 시스템 출력과 참조 번역을 대상으로 규칙을 실행해 보았으며, 플래그가 지정된 5개 사례는 모두 결함이 있는 출력물이었어요. |
| `train_test_near_twin` | nmt-forge에 의해 기록됨: 테스트 데이터의 모든(또는 거의 모든) 행이 학습 데이터에 거의 동일한 쌍둥이 데이터를 가지고 있어, 점수가 번역 능력이 아닌 학습 문구의 암기력을 측정하게 되는 경우예요. |

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

## 4. 폐기됨: 종합 점수 (레거시) {#4-composite-score}

> [!CAUTION]
> **새로운 실행은 종합 점수로 채점되지 않아요.** 채점 표준 `standard/1`에 따라 폐기되었어요([실행 채점 방식](#how-runs-are-scored) 참조). 새 카드는 `composite: null`를 게시해요. 이 섹션은 표준 이전에 발행된 카드를 계속 읽고 검증할 수 있도록 **하기 위해서만** 유지돼요. 검증 도구는 `scores.scoring_standard`가 없는 카드의 저장된 종합 점수를 아래의 정확한 공식과 표를 사용해 다시 도출해요. 이전 카드의 종합 점수가 표시되는 곳에는 항상 **레거시 종합 점수(폐기됨)**라는 레이블이 붙으며, chrF++나 새 카드와 절대 비교되지 않아요.

### 폐기된 이유 {#why-the-composite-was-retired}

종합 점수는 chrF++/100, 완전 일치, FST 수용률(가중치 0.25), 형태소 정확도, 의미 점수, 코드 스위칭, 환각, 용어 준수율의 가중 결합이었으며, 가중치는 엔지니어링 판단에 따라 설정되었을 뿐 인간의 판단에 맞춰 피팅된 적이 없었어요. 구성 요소 중 일부는 출력물을 원문이나 참조 번역과 전혀 비교하지 않기 때문에, 시스템이 번역을 전혀 수행하지 않고도 대부분의 점수를 얻을 수 있었어요:

- **모든 입력에 한 문장만 출력.** 모든 입력에 대해 유효한 북부 사미어 문장 하나만을 반복하는 학습되지 않은 영어→북부 사미어 모델이 종합 점수 **0.6244**("기능적" 레이블)를 기록했으며, 이때 **chrF++는 5.5**였어요. 반복된 단어들이 유효한 사미어였기 때문에 FST 수용률이 100%였고, FST가 맞춤법 검사기 수용자인 언어의 경우 누락된 지표 가중치가 재분배되면서 FST 수용률이 종합 점수의 약 45%를 차지했기 때문이에요.
- **번역할 수 없는 내용 생략.** 알지 못하는 모든 단어를 생략하는 조잡한 용어집 모델이 **0.6612**를 기록했어요. FST 수용률과 코드 스위칭은 출력물에 포함된 단어만을 평가하기 때문이에요.
- **원문 복사.** 북부 사미어 출력으로 영어를 그대로 복사한 경우에도 FST 점수를 얻을 수 있었어요. 맞춤법 검사기가 대문자로 시작하는 단어나 일부 영어 단어를 수용하기 때문이에요.

어떤 표준적인 평가에서도 이러한 시스템을 실제 번역보다 높게 평가하지 않으며, 모든 출력을 참조 번역과 비교하는 chrF++ 역시 그렇지 않아요. 하네스의 주의사항(§2.8)도 이러한 패턴들을 포착하여 chrF++ 대표 지표 옆에 눈에 띄게 표시해요.

### 4.1 공식 (레거시)

종합 점수는 *사용 가능한* 모든 지표의 가중 평균이었으며, 사용 가능한 지표들의 가중치 합이 1.0이 되도록 재정규화되었어요:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

런 카드에서의 값이 숫자(`null`가 아님)인 경우 지표가 "사용 가능"한 것으로 간주돼요. 해당 언어에 FST가 없거나 지표가 아직 구현되지 않아 지표를 사용할 수 없는 경우, 그 가중치는 나머지 지표들에 비례하여 재분배되었어요. 서로 다른 지표 세트로 계산된 종합 점수는 결코 비교할 수 없었어요. 각 레거시 카드는 검증 도구가 어떤 세트를 사용해야 하는지 알 수 있도록 `scores.scoring_profile` 및 `scores.metric_availability`을 기록해요(§2.7).

### 4.2 입력 정규화 (레거시)

종합 공식에 들어가기 전에 모든 지표는 1.0 = 완벽함을 나타내는 **0.0–1.0 척도**로 변환되었어요:

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

### 4.3 가중치 표 (레거시) {#43-weight-tables}

각 언어는 `language_cards.resolve_scoring_profile()`을 통해 **명명된 프로필**로 확인되었어요(언어 카드가 `scoringProfile.basis`을 선언하지 않는 한, FST가 실행을 채점한 경우 `fst-coverage`, 그렇지 않은 경우 `surface-only`). 이 프로필은 `scoring.py`의 `PROFILE_REGISTRY`에 반영되며 각 레거시 카드에 `scores.scoring_profile`으로 기록돼요. `orthographic_accuracy`은 `scoring.INACTIVE_METRICS`에 나열되어 있지만 계산된 적이 없으므로 가중치가 항상 재분배되었어요. `morphological_accuracy`은 `morph_coverage ≥ 0.25`인 경우에만 포함되었어요. 신경망 지표(`comet_score`, `qe_score`, `scoring.NEURAL_METRICS`)는 어떤 종합 점수에도 포함되지 않았어요.

#### `fst-coverage` (프로필 A): FST 커버리지가 있는 언어

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

> **합계: 1.00.** `morphological_accuracy`가 없는 경우(FST 분석기 부재, 수용자 전용 FST, 또는 포함 범위 0.25 미만), 나머지 8개 지표(합계 0.85)는 각각 1/0.85 ≈ 1.176배로 조정되었어요. 평가 표준과 용어집이 없는 수용자 전용 FST 언어(북부 사미어, 암하라어, 바스크어)의 경우 FST 수용률 0.25, chrF++ 0.15, 코드 스위칭, 환각, 완전 일치(각각 0.05)만 남아 총 0.55가 되었고, 이에 따라 FST 수용률이 종합 점수의 **0.25/0.55 ≈ 45%**를 차지하게 되었어요. 앞서 언급한 예시들이 악용한 것이 바로 이 가중치 구조였어요.

#### `surface-only` (프로필 B): FST 커버리지가 없는 언어

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

> **합계: 1.00.** `orthographic_accuracy`은 한 번도 계산되지 않았으므로 나머지 7개 지표(합계 0.95)가 1/0.95 ≈ 1.053배로 조정되었어요.

#### `no-reference`: 금 참조가 없는 런

| 지표 | 목표 가중치 | 근거 |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | 형태론적 유효성은 참조가 필요 없음; FST가 존재할 때 가장 강력한 결정론적 신호. |
| `code_switching_rate` | **0.25** | 원본 언어 누출(반전됨). |
| `hallucination_rate` | **0.20** | 조작된 내용(반전됨). |
| `terminology_adherence` | **0.15** | 코칭된 어휘 준수. |

> **합계: 1.00.** 말뭉치에 골드 참조 번역이 없는 실행에 적용되었어요. 이러한 실행에 FST가 없는 경우 종합 점수는 동작 검사 항목들만을 대상으로 재정규화되었어요.

### 4.4 새 지표 추가

새로운 지표는 **진단 지표**로 추가돼요. 대표 지표를 절대 변경하지 않아요:

1. §2에 척도, 수준, 방향 및 계산 방식을 포함하여 `🔲 Planned` 상태로 **정의해요**.
2. MetricPlugin으로(또는 핵심 지표의 경우 `tester.py` 내에) **구현해요**.
3. `shared/metric-registry.json`에 **등록하고** 런 카드의 scores 블록에 null 플레이스홀더를 추가해요.
4. 런 카드 스키마가 변경되는 경우 **BENCHMARK_SPEC.md §3을 업데이트해요**.
5. 실제 데이터에서 지표가 합리적인 값을 생성하는지 확인하기 위해 **검증 벤치마크를 실행해요**.
6. 상태를 `🔲`에서 `✅`로 변경하도록 **이 문서를 업데이트해요**.

대표 지표나 순위 지표를 변경하는 것은 "지표 추가"가 아니에요. 새로운 채점 표준 버전이 필요해요([실행 채점 방식](#how-runs-are-scored) 참조).

---

## 5. 폐기됨: 품질 티어 (레거시) {#5-quality-tiers}

> [!CAUTION]
> **새 카드에는 품질 티어가 부여되지 않아요.** 새 카드는 `quality_tier: null`를 게시하며, 새로운 출력물에는 티어나 "기능적(functional)", "배포 가능(deployable)"과 같은 레이블이 표시되지 않아요. 자동 채점 점수는 품질에 대한 최종 판정이 아니에요. 동일한 수치라도 언어와 평가 세트에 따라 의미가 다르며, 폐기된 티어는 모든 입력에 한 문장만을 반복한 시스템에 "기능적"이라는 레이블을 부여하기도 했어요(§4). 오직 해당 언어 사용자의 인간 평가만이 품질을 증명할 수 있어요([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

티어는 레거시 종합 점수로부터 판독된 레이블이었어요. 레거시 카드에는 여전히 저장되어 있으며, 이전 카드를 읽을 수 있도록 이곳에 보존되어 있을 뿐 품질을 보증하는 주장이 아니에요.

| 레거시 티어 | 레거시 종합 점수 범위 |
|-------------|-----------------------|
| Baseline | 0.00–0.30 |
| Emerging | 0.30–0.50 |
| Functional | 0.50–0.70 |
| Deployable | 0.70–0.85 |
| Fluent | 0.85–1.00 |

### 5.1 티어 임계값 (기계 판독용, 레거시)

레거시 임계값이에요(하향식으로 평가되며, 첫 번째 일치 항목이 적용됨):

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

비용 지표는 번역 방식의 재정적 효율성을 측정해요. 점수 옆에 함께 보고되며 점수와 절대 결합되지 않아요.

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

### 6.3 비용 조정 점수 (폐기됨)

레거시 카드는 폐기된 종합 점수로부터 계산된 비용 조정 점수를 포함해요:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

종합 점수와 함께 폐기되었어요. 새 카드는 `cost_adjusted: null`를 게시해요. 비용 대비 품질을 가늠하려면 chrF++(신뢰구간 포함)와 `cost_per_entry_usd`를 나란히 확인하세요. 리더보드에서 두 항목 중 원하는 기준으로 정렬할 수 있어요.

---

## 7. 속도 지표

속도 지표는 번역 방식의 지연 시간과 처리량을 측정해요. 비용과 마찬가지로 속도도 점수 옆에 함께 보고되며 점수와 절대 결합되지 않아요.

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

신뢰구간은 평가 세트의 세그먼트에 대한 백분위수 부트스트랩 구간이에요(리샘플링 수 n=1000, α=0.05; Koehn 2004). chrF++ 구간은 대표 지표의 일부예요: `chrF++ 47.5 [45.9, 49.0]`. 작은 평가 세트에서는 구간이 넓어지며, 부분집합이 너무 작아 유의미한 구간을 얻을 수 없는 경우 하네스가 경고를 표시해요.

| 지표 | 신뢰구간 보고 여부 |
|------|-------------------|
| `chrf_plus_plus` (대표) | ✅ 런 카드 `confidence_intervals.corpus_chrf`; 데이터베이스 `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (FST 데이터가 존재하는 경우에만 계산됨) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (캐시된 항목별 점수로부터 부트스트랩됨 — 불필요한 신경망 추론 없음) |
| `composite` | 레거시 카드 전용(`composite_ci_lower`, `composite_ci_upper`); 새 실행에 대해서는 계산되지 않음 |
| 티어별 신뢰구간 | ✅ `confidence_intervals_by_tier` — 난이도 수준별(Tier 1-5) chrF++ 및 exact_match 신뢰구간 |

### 8.2 쌍체 유의성 검정 {#82-paired-significance-tests}

한 실행이 다른 실행보다 우수한지 여부는 두 실행이 모두 번역한 세그먼트에 대한 chrF++ 쌍체 유의성 검정으로 결정되며, 결코 두 수치를 단순 비교하여 결정하지 않아요. `mt-eval compare --significance`는 다음을 실행해요:

- **근사 무작위화**(기본값; Riezler & Maxwell 2005, sacreBLEU의 기본값이기도 함): 두 시스템의 출력을 세그먼트 단위로 무작위 교환하는 작업을 1,000회 반복하여, 최소 그만큼의 차이가 우연히 발생할 확률을 확인해요.
- **쌍체 부트스트랩 리샘플링**(`--method paired_bootstrap`; Koehn 2004): 복원 추출로 세그먼트를 리샘플링하고 각 표본에서 차이를 다시 계산해요. 더 보수적인 추정치이며 기존 논문들과의 비교를 위해 제공돼요.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

각 차이는 95% 신뢰구간과 함께 제공되며 p < 0.05일 때 유의한 것으로 보고돼요. BLEU, spBLEU, TER 및 두 실행 모두에 존재하는 진단 지표도 함께 검정되고 표시되지만(p-값은 지표별로 산출되며 다중 검정에 대해 보정되지 않음), "우수함"에 대한 최종 판정은 chrF++ 검정이에요. 두 chrF++ 수치는 sacreBLEU 시그니처가 일치할 때만 서로 비교할 수 있어요. 비교 대상 보고서 중 하나가 레거시 보고서인 경우, 비교 도구는 해당 종합 점수가 폐기되었음을 알리고 비교를 수행하지 않아요. 전체 방법: [통계적 유의성 검정](/docs/network/specifications/significance).

---

## 9. 런 카드 점수 스키마

이 절은 런 카드의 `scores` 블록의 계층적 구조를 정의합니다. 이 스키마는 §2–§7에 정의된 지표에서 파생되며 동기화된 상태로 유지되어야 합니다.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
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

점수 주의사항(§2.8)은 카드의 최상위 수준에 `{kind, source, severity, message, …}` 객체 목록인 `score_caveats`로 위치하며, BLEU는 최상위에 `corpus_bleu`로 위치해요.

> **스키마 이력.** 이전 명세 초안은 별도의 `cost`, `speed`, `tokens` 블록을 제안했습니다. 이들은 단순성을 위해 각각 `scores`와 `totals`으로 병합되었습니다. 속도 지표(`tokens_per_second`, `entries_per_minute`, 지연 시간)는 `scores`에 있고; 토큰 수와 비용 수치는 `totals`에 있습니다.

### 9.1 스키마–데이터베이스 매핑

런 카드 JSON은 Supabase에서 `jsonb` 열로 전체가 저장됩니다. 주요 지표는 정렬/필터 성능을 위해 최상위 열로도 비정규화됩니다:

| 런 카드 필드 | Supabase 열 | 유형 | 인덱스 |
|--------------|-------------|------|--------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — 레거시 카드 전용; `standard/1`의 경우 null |
| `scores.quality_tier` | `quality_tier` | `text` | — 레거시 카드 전용; `standard/1`의 경우 null |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
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

이 문서는 다음 사항에 대한 표준 출처(canonical source)예요:
- 채점 표준: 대표 지표, 나란히 표시되는 표준 지표, 진단 지표([실행 채점 방식](#how-runs-are-scored))
- 지표 정의(§2) 및 점수 주의사항(§2.8)
- 기존 카드 검증을 위해 보존된 레거시 종합 점수 가중치 표(§4.3) 및 티어 임계값(§5.1)
- 비용 지표 공식(§6.2)
- 런 카드 점수 스키마(§9)

### 10.2 코드 미러

`arena/mt_eval_harness/scoring.py` 파일은 이 문서를 코드로 구현한 것이에요. 표준의 지표 역할(`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`)과, 그 아래에 이전 카드 검증 전용으로 사용되는 레거시 종합 표 및 티어 임계값이 정의되어 있어요. 다른 모듈에서는 이를 정의하지 않으며, 하네스의 테스트가 양쪽을 고정(pin)해요. 이 문서가 업데이트되면 `scoring.py`도 일치하도록 업데이트하고 하네스 테스트를 다시 실행하세요.

### 10.3 이 명세를 참조하는 문서

| 문서 | 참조하는 내용 | 동기화 유지 방법 |
|------|---------------|------------------|
| [벤치마크 사양](/docs/network/specifications/benchmark) §4–§5 | 대표 지표, 순위 지정, 레거시 종합 점수 | 본 문서를 상호 참조하며, 표를 중복 작성하지 않음 |
| [통계적 유의성 검정](/docs/network/specifications/significance) | "우수함" 판정 방식 | §8.2와 반드시 일치해야 함 |
| [FAQ](/docs/network/getting-started/faq) 및 [작동 원리](/docs/network/how-it-works) | 표준에 대한 쉬운 언어 요약 | 본 문서로 링크 연결 |
| `scoring.py`를 통한 `publish.py` | `standard_score_fields()` 및 레거시 종합 점수 | 하네스 테스트를 통해 일치 여부 검증 |

---

## 부록 A: chrF++가 대표 지표인 이유 (그리고 다른 지표들은 아닌 이유)

| 지표 | 역할 | 이유 |
|------|------|------|
| **chrF++** | 대표 지표 | 문자 단위 n-gram은 올바른 어근에 다른 접미사가 붙은 단어에 부분 점수를 부여하므로, 단어 수준 지표보다 풍부한 형태론적 특성을 더 잘 처리해요(Popović 2015, 2017). 모든 언어 및 표기 체계에 대해 말뭉치만으로 재현 가능하며, FLORES-200 및 AmericasNLP 공유 태스크에서 보고하는 표준 지표예요. |
| **BLEU** | 표준 지표, 병기 | 단어 수준 매칭은 사소한 굴절형 차이도 완전한 오답으로 처리하여 포합어에 불리해요. MT 연구 문헌과의 비교를 위해 보고돼요. |
| **spBLEU** | 표준 지표, 병기 | 공유된 SentencePiece 토큰화를 기반으로 한 BLEU로, 표기 체계가 달라도 비교 가능해요. FLORES-200에서 보고해요. |
| **TER** | 표준 지표, 병기 | 편집 거리 지표로, 대부분의 사용 사례에서 chrF++와 상관관계를 보여요. |
| **COMET** | 표준 지표, 병기 (계산된 경우) | WMT 데이터(고자원 유럽 언어 쌍)로 훈련되었어요. 저자원 언어(예: 크리어)의 경우 모델이 외삽을 수행하므로 보정되지 않으며, 대형 모델이 필요하므로 모든 실행이 가질 수 있는 단일 지표가 될 수 없어요. 검증 도구에 의해 다시 도출돼요. |
| **길이 비율** | 진단 지표 | 1.02의 비율이나 0.98의 비율 모두 정상이에요. 극단적인 값만이 문제를 나타내요(§2.8). |
| **FST 수용률, 형태소 정확도, LYSS** | 진단 지표 | 인간 상관관계 데이터가 없는 엔지니어링 휴리스틱이에요. FST 수용률은 원문이나 참조 번역을 전혀 보지 않아요(§4). |
| **일관성 점수** | 진단 지표 (계획됨) | 어느 정도의 불일치는 자연스러운 현상이에요(문맥에 따라 동일한 영어 단어가 다른 대상 언어 번역어로 변환됨). |
| **규정 준수 지수** | 게이트 (계획됨) | 번역 정확도가 아니라 구조적 보존(플레이스홀더, 따옴표)을 측정해요. |

## 부록 B: LYSS — 언어별 지표 구현

**LYSS** 프레임워크(Linguistically-informed Yield & Structural Scoring)는 표면 수준 문자열 비교를 넘어서는 언어별 지표를 제공합니다. LYSS에는 세 개의 핵심 구성 요소가 있습니다:

- **LYSS-fst** — 형태론적 유효성(`fst_acceptance_rate`): 각 단어가 대상 언어에서 유효한 형태인가?
- **LYSS-eq** — 언어학적 동치(`equivalent_match_rate`): 출력이 참조의 허용 가능한 변형인가?
- **LYSS-sem** — 의미 검증(`semantic_score`): 출력이 원본 의미를 보존하는가?

세 지표 모두 채점 표준에 따른 **진단 지표**예요. chrF++ 대표 지표 옆에 나란히 보고되며, 대표 지표에 절대 포함되지 않아요.

> **검증 상태: 🔶 엔지니어링 휴리스틱.** LYSS 지표는 인간의 품질 판단에 대해 검증되지 않았습니다. 이들은 언어학적 원칙(UAlberta ALTLab의 언어학자들이 구축한 FST, 사전, 문법 규칙)으로부터 설계되었지만, LYSS 점수와 실제 번역 품질 간의 상관관계는 측정되지 않았습니다. 필요한 검증 실험은 [화자 검증 프로토콜](/docs/network/specifications/speaker-validation)을 참조하십시오.

| 언어 | 플러그인 | 위치 | LYSS 구성 요소 | 지표 키 | 참고 사항 |
|------|----------|------|----------------|---------|-----------|
| CRK (플레인스 크리어) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | 결정론적 변형 클래스 규칙: 어순, 정서법, 선택적 불변화사, 표제어 유의어, 진행형 모호성, 포괄형/배제형. 항목별 `lint_verdict`(EXACT/EQUIVALENT/MISS/NO_OUTPUT)를 생성해요. |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | 결정론적 방식: FST 표제어 추출 + 사전 의미 주석 + spaCy 내용어 중복도. 판정 결과(EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT)를 생성해요. |
| GiellaLT 지원 언어 | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | 범용: 하네스에 FST가 고정된 모든 언어(`mt_eval_harness/data/fst-pins.json`). 분석기 FST는 `morphological_accuracy`도 생성하며, 수용자 전용 맞춤법 검사기(북부 사미어, 암하라어, 바스크어용으로 고정된 Divvun 패키지)는 수용률만 보고해요. 실제로 FST로 채점되려면 해당 언어 쌍에 대해 순위를 매길 수 있는 평가 세트도 필요해요. 플레인스 크리어의 두 세트(EdTeKLA)는 데이터베이스가 점수 부여를 거부하는 격리된 레이블 세트인 반면, 다른 여러 FST 언어는 오픈 세트(Tatoeba, WMT, WMT24++)를 보유하고 있어요. [데이터 세트 페이지](/docs/network/leaderboard/datasets)에 카탈로그가 정리되어 있으며, `mt-eval corpora --source eng --target <code>`는 특정 언어 쌍에 대해 실행 가능한 항목을 나열해요([솔직한 한계점](/docs/network/honest-limitations) 참조). |

> **아키텍처 참고 사항 (2026년 6월).** 언어별 LYSS 지표는 이제 언어 카드의 `evalMetrics` 아래에 선언되며 `plugin_discovery.py`에 의해 `eval_standards/<lang>/`에서 로드돼요. 이들은 방식 플러그인 지표(참가자)가 아니라 **평가 표준**(심판)이에요. 즉, CRK를 대상으로 하는 모든 번역 방식은 별도의 방식별 설정 없이도 LYSS 진단 검사를 자동으로 거치게 돼요. `CrkFSTMetric`는 제거되었으며, 해당 기능은 범용 `GiellaLTFSTMetric`에 의해 온전히 지원돼요.

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

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. 포르투갈 리스본.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### 평가 관행 및 유의성 검정

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spain.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; reports chrF++ and spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

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
