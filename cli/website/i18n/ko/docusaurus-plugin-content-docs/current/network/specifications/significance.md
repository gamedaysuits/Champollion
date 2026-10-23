---
sidebar_position: 7
title: "통계적 유의성 검정"
slug: '/network/specifications/significance'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The scores these tests protect"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "Where significance gates what ranks"
---

# 통계적 유의성 검정

> **상태**: ✅ 배포 완료. 대응 유의성 검정(기본값은 근사 무작위화, 요청 시 대응 부트스트랩)과 부트스트랩 신뢰구간이 `mt_eval_harness/significance.py` 및 `mt_eval_harness/confidence.py`에 구현되어 패키지에서 export되고, CLI에 노출되며, 유의성 / 신뢰구간 / 점수 산정 테스트 스위트에서 다뤄집니다.
> **코드베이스**: `arena` — `tester.py`(실행별 신뢰구간) 및 `compare.py`(실행 간 유의성)에 연결되어 있어요.
> **목적**: 연구자가 두 평가 실행 간의 차이가 통계적으로 유의미한지, 아니면 단순한 노이즈인지 판단할 수 있도록 도와줘요.

이 페이지는 **출시된 동작**을 문서화한 것이에요 — 이는 설명적인 내용이지, 할 일 목록이 아니에요.

---

## 왜 중요한가요

두 실행을 비교할 때(예시: 92개 항목에서 System A chrF++ 42.96 대 System B chrF++ 41.80), 원시 점수 차이만으로는 그것이 실제인지 노이즈인지에 대해 아무것도 말해주지 못해요. 테스트 항목이 ~92개밖에 없으면, 무작위 변동만으로도 1~2점 차이가 쉽게 발생할 수 있어요. 전문가들은 유의성 검정을 요구하고, 그래서 이 하니스가 이를 계산해요.

**점수 산정 표준(`standard/1`)에 따르면, 한 실행이 다른 실행보다 더 나은지 결정하는 것은 chrF++에 대한 대응 검정이에요.** chrF++는 사전 선언된 기본 지표예요([점수 산정 사양](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER 및 COMET(두 실행 모두 동일한 모델의 세그먼트별 COMET 점수를 포함하는 경우)은 보조 표준 지표로 검정되고 표시되며, 완전 일치(exact match)와 플러그인 비율은 진단용으로 표시돼요. 이 중 어느 것도 단독으로 결정하지 않아요. 이는 수천 건의 인간 평가를 통해 지표 차이와 그 유의성이 인간의 선호도를 예측한다는 것을 밝혀낸 Kocmi 등(2021, "To Ship or Not to Ship")의 연구를 따라요.

---

## 알고리즘: 대응 근사 무작위화(기본값)

`mt-eval compare --significance`는 Riezler & Maxwell (2005)의 **대응 근사 무작위화(paired approximate randomization, AR)** 검정을 사용해요. 이는 시스템을 비교할 때 SacreBLEU에서도 기본으로 사용하는 방식이에요.

### 작동 방식

동일한 N개의 테스트 항목에서 평가된 두 시스템 A와 B가 주어졌을 때:

1. 말뭉치 수준의 관측된 차이를 계산해요: `Δ = metric(A) - metric(B)`.
2. `n_trials`회 반복해요(기본값 1000):
   a. 각 항목마다 ½의 확률로 A와 B의 출력을 맞바꿔요.
   b. 무작위로 섞인 두 묶음에서 말뭉치 지표를 다시 계산해요.
   c. `|Δ_shuffled| ≥ |Δ|` 여부를 기록해요.
3. p-값은 양측 달성 유의수준(two-sided achieved significance level)이에요:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. +1은 관측된 할당을 하나의 유효한 추출로 계산하므로, p는 결코 정확히 0이 되지 않아요.
4. p < α(기본값 0.05)이면 해당 차이는 유의미한 것으로 보고돼요.

Δ에 대한 신뢰구간은 부트스트랩 백분위수 구간이에요(AR은 구간이 아닌 p-값을 생성해요). 이는 AR 추출을 방해하지 않도록 별도의 난수 스트림에서 계산돼요.

### 주요 특성

- **진정한 가설 검정:** 무작위 셔플은 주어진 항목을 어느 시스템이 생성했든 차이가 없다는 귀무가설 하에 추출돼요.
- **대응 검정(Paired):** 두 시스템을 항목별로 비교하므로 항목 수준의 상관관계가 보존돼요.
- **비모수 검정(Non-parametric):** 점수가 어떻게 분포되어 있는지에 대해 아무런 가정을 하지 않아요.

### 대응 부트스트랩 (사용 가능, 기본값 아님)

`paired_bootstrap()`는 Koehn (2004)의 대응 부트스트랩을 구현해요. 항목을 복원 추출하여 재표본추출(resampling)하고 Δ의 부호가 얼마나 자주 뒤집히는지 계산해요. 이는 이전 논문들과의 비교를 위해 제공되지만, 교과서적인 유의수준이 아니라 부호 견고성 휴리스틱에 불과해요. 이 분포는 귀무가설이 아닌 관측된 Δ를 중심으로 하므로 AR에 비해 유의성을 과장할 수 있어요. 명령줄에서 `mt-eval compare <reports…> --significance --method paired_bootstrap` 옵션을 사용하거나 `run_significance_tests`에서 `method="paired_bootstrap"`을 설정하여 선택할 수 있어요.

---

## sacrebleu는 필수 의존성이에요

sacrebleu는 필수 의존성이에요. chrF++나 BLEU를 계산할 수 없는 MT 평가 하니스는 MT 평가 하니스가 아니므로:

1. `sacrebleu>=2.3`는 `pyproject.toml`에서 `[project.dependencies]` 아래에 선언되어 있어요(`[project.optional-dependencies]`가 아님).
2. `tester.py`에서 직접 임포트돼요 — `from sacrebleu.metrics import CHRF, BLEU, TER` — `try/except` 가드 없이요.
3. `significance.py`에서 직접 임포트돼요.

어디에도 `HAS_SACREBLEU` 조건부 경로가 없어요: sacrebleu 없이 실행하는 것은 지원되는 구성이 아니에요.

---

## 구현

### 1. 필수 의존성으로서의 sacrebleu

`pyproject.toml`는 `[project.dependencies]` 아래에 `sacrebleu>=2.3`를 선언하며, `tester.py`이 이를 직접 임포트해요:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

`tester.py`에는 `if HAS_SACREBLEU:` 가드가 없어요 — 조건부 임포트 경로는 제거되었어요.

---

### 2. 모듈: `mt_eval_harness/significance.py`

유의성 검정 구현체(기본값은 근사 무작위화, 요청 시 대응 부트스트랩). 공개 인터페이스:

```python
"""
Statistical significance testing via paired bootstrap resampling.

Standard method used by WMT shared tasks, SacreBLEU, and MT-Lens.
Compares two runs on the same corpus to determine if the performance
difference is statistically significant.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from sacrebleu.metrics import CHRF, BLEU


@dataclass
class SignificanceResult:
    """Result of a paired bootstrap significance test."""
    metric_name: str           # e.g., "corpus_chrf", "exact_match_rate"
    system_a_score: float      # Score for system A
    system_b_score: float      # Score for system B
    delta: float               # A - B
    p_value: float             # Two-sided p-value
    n_bootstrap: int           # Number of bootstrap iterations
    confidence_level: float    # 1 - alpha
    significant: bool          # p_value < alpha
    winner: str | None         # "A", "B", or None if not significant
    ci_lower: float            # Lower bound of 95% CI on the delta
    ci_upper: float            # Upper bound of 95% CI on the delta


def paired_bootstrap(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
) -> SignificanceResult:
    """Run paired bootstrap resampling significance test.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (must be same length, same IDs)
        metric_fn: Function(list[dict]) -> float that computes the corpus-level
                   metric from a list of entry dicts. Must handle the entry format
                   from TestReport.
        n_bootstrap: Number of bootstrap iterations (1000 is standard)
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility (12345 matches SacreBLEU default)
        metric_name: Human-readable name for the metric being tested

    Returns:
        SignificanceResult with all fields populated.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    ...
```

### 3. 내장 지표 함수

```python
def exact_match_rate(entries: list[dict]) -> float:
    """Compute exact match rate from a list of entry dicts."""
    non_error = [e for e in entries if not e.get("error")]
    if not non_error:
        return 0.0
    exact = sum(1 for e in non_error if e.get("exact_match"))
    return exact / len(non_error)


def corpus_chrf(entries: list[dict]) -> float:
    """Compute corpus-level chrF++ from a list of entry dicts."""
    chrf = CHRF(word_order=2)
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return chrf.corpus_score(hyps, [refs]).score


def corpus_bleu(entries: list[dict]) -> float:
    """Compute corpus-level BLEU from a list of entry dicts."""
    bleu = BLEU()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return bleu.corpus_score(hyps, [refs]).score
```

### 4. `compare.py`으로의 통합

`compare.py`는 여러 TestReport를 나란히 비교하고 이들 간의 유의성 검정을 실행해요. `run_significance_tests()`는 두 리포트 간의 검정을 구동하며 `format_significance_table()`는 이를 렌더링해요. 모든 결과에는 `role`가 포함돼요: `primary`(chrF++ — 승패를 결정하는 유일한 검정), `secondary`(기타 표준 지표) 또는 `diagnostic`. 다음 순서로 검정해요:

| 지표 | 역할 | 재표본별 계산 기준 |
|---|---|---|
| `corpus_chrf` | 기본 | 세그먼트당 sacreBLEU 통계량 |
| `corpus_bleu` | 보조 | 세그먼트당 sacreBLEU 통계량 |
| `corpus_spbleu` | 보조 | FLORES-200 SentencePiece 토크나이저 기준 세그먼트당 sacreBLEU 통계량(spBLEU는 해당 토크나이저를 사용한 BLEU이며, FLORES/NLLB 표에서 보고하는 수치예요). 토크나이저를 사용할 수 없는 경우(`sentencepiece`가 없거나, 모델이 아직 다운로드되지 않은 오프라인 상태) 조용히 누락되지 않고 미검정으로 표시돼요 |
| `corpus_ter` | 보조 | 세그먼트당 sacreBLEU 통계량. TER은 편집률이므로 **낮을수록 좋아요**: 음수 Δ는 A에 유리해요 |
| `comet_score` | 보조 | 두 리포트에 이미 포함된 세그먼트별 COMET 점수(이 점수들의 평균이 COMET의 시스템 점수이며, 모델을 다시 실행하지 않아요). 하나의 실행만 COMET으로 점수가 매겨졌거나 두 실행이 서로 다른 COMET 모델을 사용한 경우 이유와 함께 미검정으로 표시돼요 |
| `exact_match_rate` | 진단 | 각 항목의 완전 일치 플래그 |
| 두 리포트의 플러그인 비율(예: `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate`) | 진단 | 대표 수치가 집계된 방식과 동일하게 집계된 플러그인 자체의 항목별 결과 |

**폐기된 복합 점수(composite)는 검정되지 않아요.** 가중 복합 점수와 여기서 검정되던 `segment_composite` 행은 점수 산정 표준에 의해 폐기되었어요([점수 산정 사양 §4](/docs/network/specifications/scoring#4-composite-score)). 표준 제정 이전에 작성된 비교 JSON에는 여전히 아무것도 결정하지 않는 레거시 복합 점수로 라벨이 지정된 `segment_composite`(또는 `composite_score`) 행이 표시돼요. 비교 대상 리포트가 레거시 리포트인 경우, `compare`는 복합 점수가 폐기되었음을 명시하고 이를 비교하지 않아요.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

3개 이상의 리포트를 비교할 때는 모든 쌍에 대해 쌍별 유의성 검정이 실행돼요. 이때 `significance`는 각 쌍당 하나씩의 `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}` 객체 목록이 되며, 각 `tests` 목록은 2개 리포트 비교 시와 같은 형태를 가져요. `letters`는 실행 테이블에 표시된 두 실행의 영문 기호이며, Δ는 첫 번째에서 두 번째를 뺀 값이에요.

비교 JSON에는 `significance` 외에도 `significance_settings`가 포함돼요: `method`, `n_resamples`, `alpha`, `seed`, 각 글자가 어떤 실행인지(`runs`), `ci_lower`/`ci_upper`가 무엇인지, `multiple_testing_correction: "none"`, 쌍당 검정된 지표 수 및 총 비교 쌍 수, 보정되지 않은 p-값에 대한 평이한 설명 메모(아래 참조), 검정 시 발생한 참고 사항(페어링에서 제외된 항목, 미검정 지표).

### 5. CLI 통합

`mt-eval compare`는 `--significance` 플래그를 노출하며, `--method`로 대응 검정을 선택하고(기본값은 `approximate_randomization`, 또는 `paired_bootstrap`) `--n-bootstrap`로 반복 횟수를 설정할 수 있어요:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare`는 `mt-eval run`가 작성한 `*_report.json` 파일(또는 형제 리포트를 사용하는 실행 로그)을 입력받아요. 지표당 한 행, 실행당 한 열로 구성된 실행 테이블을 출력한 다음 유의성 테이블을 출력하고, `-o`로 다른 파일을 지정하지 않는 한 중립적인 위치에 비교 JSON을 작성해요. 리포트들이 폴더를 공유하는 경우 리포트 옆의 `comparison-<hash>.json`에, 그렇지 않은 경우 가장 가까운 공통 폴더의 `comparisons/`에 작성해요(`run_benchmark`의 `mcp-run-<id>/` 폴더와 같이 각 실행 자체의 폴더에 있는 리포트의 경우 그중 한 폴더에 비교 결과가 작성되는 일은 결코 없어요). `<hash>`는 지정된 순서대로 비교된 실행 ID들의 sha256 앞 10자리 16진수 문자이므로, 같은 폴더에 있는 다른 비교 결과가 덮어씌워지지 않아요. 동일한 실행들을 다시 비교하면 해당 파일이 다시 작성돼요. `-o`로 파일명을 지정하면 기존 파일이 교체되며 출력에도 이 내용이 표시돼요. 작성된 경로가 출력돼요. 로컬 전용, 봉인(sealed)되었거나 동의가 필요한 말뭉치에 대한 실행 비교는 해당 문장을 인용하므로, 작성되는 위치 어디에나 `<file>.champollion.json` 사이드카에 해당 말뭉치의 표시를 포함해요.

실행 테이블의 **평균 지연 시간(s/항목)**(Avg latency (s/entry))은 시간을 기록하지 않은 실행에 대해 `—`를 표시하며, 테이블 아래에 그 이유를 설명하는 메모가 표시돼요(모든 항목이 캐시에서 제공되었거나, 출력이 테스트 환경 외부에서 생성되었거나, 메서드가 시간을 보고하지 않은 경우 등). 0.01초 미만의 값은 소수점 넷째 자리까지 표시되며(CPU의 소형 모델은 문장당 몇 밀리초 만에 디코딩해요), 0.00으로 반올림되지 않아요.

### 6. 출력 형식

`format_significance_table()`가 콘솔 뷰를 렌더링해요; 동일한 데이터가 비교 JSON에 추가돼요.

리포트에는 입력된 순서대로 문자가 지정돼요. 첫 번째는 실행 **A**, 두 번째는 **B**, 그 다음은 **C**, **D** 순이며, 위 실행 테이블과 동일한 문자예요. 모든 쌍별 테이블은 해당 문자와 실행 ID로 두 실행의 이름을 지정하며(예: `--- A (baseline) vs C (nllb-ft) ---`), 열과 Δ에도 동일한 문자가 사용돼요(`Δ (A−C)`). Δ는 항상 **첫 번째 − 두 번째**예요. 테이블 설명과 그 아래의 모든 참고 사항은 쌍이 몇 개든 상관없이 **한 번만** 출력돼요. 각 행에는 95% **Δ 신뢰구간**(CI on Δ)도 출력돼요. 이는 부호뿐만 아니라 차이가 얼마나 큰지 타당한 범위를 보여주는 JSON의 `ci_lower`/`ci_upper` 부트스트랩 백분위수 구간이에요. 각 지표에는 지표 레지스트리에 정의된 방향(↑ 높을수록 좋음, ↓ 낮을수록 좋음)이 표시되며, **더 우수함**(Better) 열에는 방향을 고려하여 더 나은 점수를 기록한 실행이 표시되고 차이가 유의미하지 않은 경우에는 `(n.s.)`가 표시돼요. 따라서 TER, 코드 스위칭, 환각과 같이 낮을수록 좋은 비율이 증가한 경우 양수 Δ와 함께 **B**가 더 우수한 실행으로 출력되며, 베이스라인을 63.5 chrF++ 차이로 앞서는 두 번째 전달된 훈련 모델은 Δ −63.52와 함께 **B** 우수로 출력돼요. 레지스트리에 방향이 선언되지 않은 지표는 `?`로 표시돼요. 점수, Δ 및 구간은 소수점 둘째 자리까지 출력되며, 소수점 둘째 자리로 인해 실제 차이가 가려질 수 있는 행에서는 더 많은 자리수(최대 6자리)까지 출력돼요. 예를 들어 0.0673 대비 0.0684의 spBLEU는 **Yes** 옆에 +0.00 [+0.00, +0.00]이 아닌 Δ +0.0011 [+0.0001, +0.0021]로 출력되며, 테이블에는 해당 행에 더 많은 소수점 자리가 표시되었음이 명시돼요. JSON은 소수점 넷째 자리까지 유지하며, 그보다 작은 0이 아닌 값에 대해서는 4자리 유효숫자를 유지하므로 실제 차이가 0으로 저장되는 일이 없어요. 동일한 출력은 Δ가 정확히 0이고 p = 1이 되므로 결코 유의미하지 않아요. p가 α 미만으로 떨어졌지만 Δ의 부트스트랩 구간이 정확히 [0, 0]인 경우(차이를 추정하기에 세그먼트 수가 너무 적음), **Sig?**는 `?†`를 표시하고 **Better**는 `—†`를 표시하며 관련 메모가 함께 표시돼요. 이 경우 어느 실행도 더 우수하다고 판단하지 않아요. 낮을수록 좋은 플러그인 비율의 경우, JSON `winner` 역시 방향을 고려하며(낮은 비율이 승리, `corpus_ter`에서도 항상 그랬듯이), 우수 방향이 없는 플러그인 비율(중립적 비율, 예: `morph_coverage`, 또는 미선언)은 `winner: null`를 가져요. 각 결과에는 `direction`도 포함돼요.

**콘솔 출력** (예시 수치):
```
  Significance Tests (paired approximate randomization, n=1000, α=0.05):
  Each table names its two runs by their letters in the run table above.
  Δ = first run − second run.  ↑ higher is better, ↓ lower is better.
  Better = the run with the better score, by the metric's direction; (n.s.) = not significant.
  95% CI on Δ = bootstrap percentile interval: how large the difference plausibly is.

  --- A (baseline) vs B (coached) ---

  Metric                                          A        B  Δ (A−B)      95% CI on Δ  p-value  Sig?  Better
  ---------------------------------------- -------- -------- -------- ---------------- -------- -----  --------
  ↑ corpus_chrf                               42.96    41.80    +1.16   [-0.85, +3.12]    0.142    No  A (n.s.)
  ↑ corpus_bleu                                6.80     3.81    +2.99   [+0.61, +5.40]    0.018 Yes *  A
  ↑ corpus_spbleu                              9.10     6.42    +2.68   [+0.35, +5.02]    0.027 Yes *  A
  ↓ corpus_ter                                61.20    64.90    -3.70   [-7.05, -0.41]    0.030 Yes *  A
  ↑ exact_match_rate                           0.20     0.19    +0.01   [-0.03, +0.05]    0.381    No  A (n.s.)
  ↓ code_switching.avg_code_switching_rate     0.60     0.08    +0.52   [+0.45, +0.59]    0.001 Yes *  B

  p-values are per metric and uncorrected — no multiple-testing correction is
  applied (deliberately: the MT convention is to report each metric's own
  p-value). 6 metrics were tested, so one "significant" result at p<0.05 can
  turn up by chance alone. And a small Δ can be significant yet not
  meaningful: check the CI on Δ (how large the difference plausibly is) and
  how reliable the metric is for this language before acting on it.
```

이 예시에서 판정은 **유의미한 차이 없음**이에요. 기본 지표인 chrF++가 A와 B를 구분하지 못하므로(p = 0.142), 어느 실행도 더 우수하다고 판단하지 않아요. BLEU, spBLEU, TER은 A에 유리하고 코드 스위칭은 B에 유리하더라도 마찬가지예요. 이러한 행들도 함께 표시되며 독자가 살펴볼 수는 있지만 승패를 결정하지는 않아요. 테이블에는 chrF++가 가장 먼저 나열되고, 그 다음 다른 표준 지표들이 오며, 마지막으로 진단 지표가 나열돼요.

실행이 3개 이상인 경우 단일 헤더 아래에 `--- X (run) vs Y (run) ---` 테이블이 연이어 표시되며, 메모에는 수행된 모든 검정 횟수가 집계돼요(`6 metrics were tested per pair (36 tests over 6 pairs)`).

**JSON 출력** (비교 리포트에 추가됨):
```json
{
  "significance": [
    {
      "metric_name": "corpus_chrf",
      "system_a_score": 42.96,
      "system_b_score": 41.80,
      "delta": 1.16,
      "p_value": 0.142,
      "n_bootstrap": 1000,
      "confidence_level": 0.95,
      "significant": false,
      "winner": null,
      "ci_lower": -0.85,
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
    }
  ]
}
```

### 7. 대시보드 통합(선택적 개선 사항)

비교 JSON에 유의성 데이터가 있을 때, 대시보드는 이를 표시할 수 있어요 — 유의성 표시자(p < 0.05는 `*`, p < 0.01은 `**`)가 있는 비교 테이블 행이에요. 이는 출시된 계산 위에 놓인 프레젠테이션 계층이며, 핵심 기능의 일부는 아니에요.

---

## 엣지 케이스 및 검증

1. **일치하지 않는 항목**: 두 TestReport는 동일한 항목 ID를 가져야 해요. 그렇지 않으면(예: 하나가 부분 집합에서 실행된 경우), 교집합에서만 유의성을 검정해요. 제외된 항목에 대해 경고해요.

2. **항목이 너무 적음**: N < 10이면, 그렇게 적은 항목으로는 유의성 검정이 신뢰할 수 없다고 경고해요. 여전히 실행은 하되, 경고를 출력해요.

3. **동일한 점수**: 두 시스템이 항목별로 동일한 결과를 만들어내면, p_value는 1.0이어야 해요(차이가 전혀 없음).

4. **플러그인 지표**: 두 리포트 모두에 나타나는 플러그인 비율은 리포트가 실제로 보유하고 있는 세그먼트별 값으로만 검정돼요. 이는 항목별 결과에 대한 플러그인 자체의 집계(FST 지표)이거나, `avg_<name>` 집계가 평균을 내는 항목별 값의 평균(동작 지표)을 의미해요. 세그먼트별 값이 없는 플러그인 비율은 미검정으로 나열되며, 결코 0.00 대 0.00으로 표시되지 않아요. `total_words_checked`와 같은 카운트는 검정되지 않아요.

5. **재현성**: RNG 시드가 출력에 기록되어야 결과를 정확히 재현할 수 있어요. 기본값은 12345예요(SacreBLEU 관례와 일치).

---

## 만들지 말아야 할 것

- **검정 중 COMET 재추론 없음**: COMET은 두 리포트에 이미 포함된 세그먼트별 점수를 기반으로 대응 검정돼요. 재표본추출마다 모델을 다시 실행하지 않아요. 서로 다른 COMET 모델로 점수가 매겨진 두 실행은 서로 검정되지 않아요.
- **베이지안 분석 미사용**: 빈도주의 부트스트랩을 고수해요. 이는 기계 번역(MT) 커뮤니티가 기대하고 이해하는 방식이에요.
- **다중 검정 보정 미적용**: 여러 지표를 검정할 때 본페로니(Bonferroni) 등의 보정을 적용하지 않아요. MT 평가 관례는 지표별 원시 p-값을 보고하고 독자가 해석하도록 하는 것이에요. `mt-eval compare`는 출력과 `comparison.json`(평이한 설명 메모가 포함된 `significance_settings.multiple_testing_correction: "none"`)에서 **이를 명시**해요: 여러 지표를 검정할 경우 순전히 우연에 의해 p < 0.05 결과가 하나 나올 수 있고, 미미한 Δ도 중요하지 않으면서 유의미하게 나올 수 있으므로, 단 하나의 "유의미함"에 따라 행동하기 전에 Δ의 CI와 해당 언어에 대한 지표의 신뢰성을 확인해야 해요.

---

## 순위 클러스터 {#ranking-clusters}

> **상태**: ✅ 배포 완료(대회용). 대회 순위는 엄격한 순서가 아닌 **클러스터**의 집합이에요. 유의성 검정을 통해 인접한 항목들을 실제로 구별할 수 있는지 결정해요. 이 섹션에서는 대응 검정보다 증거가 약한 경우를 포함하여 배포된 내용을 설명해요.

### 인접 체이닝, 대회 순위 체계

항목은 먼저 **트랙(track)**별로 분류돼요. `constrained` 시스템은 `unconstrained` 시스템과 절대 함께 순위가 매겨지지 않으며, 각 트랙은 고유한 정렬 순서, 동점 그룹 및 순위 범위를 가져요. 따라서 "1위"는 항상 *트랙 내에서의* 1위를 의미해요.

트랙 내에서 항목들은 대회의 기본 지표(대회에서 다른 지표를 기록하지 않은 한 chrF++) 순으로 먼저 정렬된 후, 나머지 표면 지표 순, 그리고 마지막으로 가장 빠른 제출 순으로 정렬돼요. 이 순서에서 모든 **인접한** 쌍이 검정돼요. 검정으로 구분할 수 없는 쌍은 순위를 공유하며, 공유된 순위는 **체이닝(chaining)**돼요. 즉, A와 B가 동점이고 B와 C가 동점이면, A와 C를 직접 비교하지 않았더라도 세 항목 모두 하나의 동점 그룹으로 묶여요.

순위는 대회 번호 체계(competition numbering)를 사용해요. 상위 3개 항목이 동점이면 `1, 1, 1`가 되고 다음 항목은 `4`가 돼요. 2위가 2개 항목 동점이면 `1, 2, 2, 4`가 돼요.

**체이닝의 솔직한 한계**: 비유의성(non-significance)은 추이적(transitive)이지 않아요. 긴 체인은 직접 검정할 경우 구분*되었을* 두 항목을 하나로 묶을 수 있어요. 이것이 바로 클러스터를 단일 점이 아니라 **범위**로 보고하는 이유예요.

### 순위 범위

모든 항목에는 증거와 부합하는 최선 및 최악의 순위인 `rank_min` 및 `rank_max`가 부여되며, 이는 WMT가 순위 범위에 사용하는 방식과 같아요. 클러스터에 혼자 있는 항목은 `rank_min == rank_max`를 가져요. 2~5위에 걸친 4개 항목 클러스터에 속한 항목은 `rank_min: 2, rank_max: 5`를 가지며, **해당 클러스터 내의 어떤 항목도 다른 항목보다 "앞서" 있지 않아요**. 클러스터에서 단일 숫자 순위만 떼어내는 것은 결과를 잘못 해석하는 것이에요.

### 증거의 사다리

모든 쌍을 동일한 방식으로 검정할 수 없으므로, 각 쌍은 판정이 실제로 도출된 사다리 단계(rung)를 기록해요. 이 라벨은 결과의 일부이며 결코 누락되지 않아요:

| 단계 | 증거 | 사용 가능한 경우 | 강도 |
|---|---|---|---|
| 1 | **세그먼트별 대응 검정** — 기본값은 근사 무작위화, 요청 시 대응 부트스트랩(위에서 설명한 알고리즘) | 두 항목 모두 완전하고 정렬된 세그먼트별 점수 집합을 보유한 경우에만 | 진정한 검정 |
| 2 | 공개된 구간 경계에서의 **95% 부트스트랩 CI 중첩** | 기본 지표가 두 항목 모두에 대해 신뢰구간 경계를 가질 때(chrF++는 포함, BLEU 및 COMET은 구간 열이 없음) | 보수적인 대리 지표 — 겹치는 구간이 동등성을 **증명하지는 않으며**, 비중첩은 대응 검정보다 더 엄격한 기준임 |
| 3 | 지표 표시 반올림 기준의 **값 일치(Point equality)** | 항상 가능 | 가장 약한 단계: 출력된 두 숫자가 동일하다는 것만 나타냄 |

### 봉인된 대회: 1단계는 노드에서 실행됨

1단계는 두 시스템 모두의 세그먼트별 점수가 필요해요. 봉인된 대회에서는 주최자의 평가 노드가 참조 번역을 보유하며 **세그먼트별 출력을 절대 외부로 내보내지 않아요**. 이것이 봉인된 레인(sealed lane)의 핵심 목적이며 완화할 수 있는 설정이 아니에요. 따라서 대응 검정이 데이터가 있는 곳으로 직접 찾아가요.

`mt-eval node verdicts`는 봉인된 참조와 점수가 매겨진 모든 항목 쌍에 대해 노드에서 대회의 자체 대응 검정을 실행하고 **판정만** 기록해요. 각 쌍에 대해 방법, p-값, 점수 차이, 신뢰구간 및 세그먼트 수가 기록돼요. 파일에는 세그먼트, 참조 번역, 번역 결과물이 일절 포함되지 않아요. 노드는 점수 서명 키로 이를 서명해요. 그런 다음 주최자는 `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`로 종료해요. 순위 산정에서는 서명이 검증되고 해당 판정이 이 대회, 봉인된 데이터셋, 지표, 동결된 동점 정책 및 약속된 하네스 버전에 대해 계산된 경우에만 판정을 사용해요. 그렇지 않으면 종료가 거부돼요.

판정이 제공되지 않는 경우, 봉인된 대회의 동점 처리는 지표에 구간이 있는 경우 신뢰구간 중첩에 의존하고, 구간이 없는 경우 수치 일치에 의존해요. 따라서 이 경우의 클러스터는 대응 검정을 거친 경우보다 더 넓어져요. 순위 자체에 어떤 경우가 적용되었는지 명시돼요. `ranking_method.evidence_used`는 실제로 사용된 단계를 명시하고, `ranking_method.node_verdicts`는 판정이 사용된 노드(있는 경우)를 명시해요.

### 순위가 매기지 않는 항목

- **대조군 항목(Contrastive entries)**은 별도 섹션에 보고되며 결코 우승할 수 없어요.
- **실행 시간, 하드웨어 및 비용**은 실행 카드에 기록되어 보고될 뿐, 순위가 매겨지지 않아요. 효율성 트랙은 없어요.
- **인간 평가**는 이 순위에 전혀 포함되지 않아요. 고정된 예산으로 어떤 시스템을 다룰지에 대한 인간 평가 *선정*(클러스터가 반으로 쪼개지지 않도록 동점 그룹 전체를 가져옴)은 종료된 대회에 대해 기록될 수 있지만, 평점 자체는 존재하지 않아요. [MT 평가 규칙](/docs/network/leaderboard/rules#verification-tiers)을 참조하세요.

---

## 모듈 맵

출시된 기능이 위치한 곳:

| 파일 | 역할 |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3`를 필수 종속성(hard dependency)으로 선언 |
| `mt_eval_harness/tester.py` | 직접적인 sacrebleu 임포트(`HAS_SACREBLEU` 가드 없음); 실행별 CI 계산 |
| `mt_eval_harness/significance.py` | 대응 검정(기본값인 `paired_approximate_randomization` 및 `paired_bootstrap`), `SignificanceResult`, 내장 지표 함수(chrF++, BLEU, spBLEU, TER, 캐시된 세그먼트별 점수 기반 COMET, 완전 일치; 폐기된 세그먼트 수준 복합 점수는 이전 비교 파일을 읽기 위한 용도로만 유지됨), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | 부트스트랩 신뢰구간: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` 내보내기(export) |
| `mt_eval_harness/compare.py` | 리포트 비교에 유의성 검정 연결 |
| `mt_eval_harness/cli.py` | `--significance` / `--method` / `--n-bootstrap`(비교) 및 `--no-ci` / `--n-bootstrap-ci`(검정) 플래그 |
| `mt_eval_harness/dashboard.py` | 비교 테이블에 유의성 표시 (선택적 향상 기능) |

---

## 테스트 커버리지

significance / confidence / scoring 스위트는 모두 통과 상태예요. 이들이 커버하는 내용은:

1. **시드로 결정론적**: 동일한 입력 + 동일한 시드 → 매번 동일한 p-값
2. **알려진 정답 검정**: 동일한 두 결과 세트 → p_value = 1.0
3. **알려진 유의성 검정**: 하나가 명백히 더 나은 두 결과 세트(예: 모두 정확히 일치 대 모두 불일치) → p_value ≈ 0.0
4. **일치하지 않는 ID**: `ValueError`를 발생시키거나, 경고하고 교집합에서 계산함
5. **빈 입력**: 우아하게 처리됨(p_value = 1.0 또는 발생)

---

## 신뢰 구간(동반 기능)

> **상태**: ✅ `confidence.py`에 구현됨

신뢰 구간(CI)은 유의성 검정과는 다른 질문에 답해요:

- **유의성 검정**(`significance.py`): "시스템 A와 시스템 B 간의 차이가 실제인가요?"
- **신뢰 구간**(`confidence.py`): "이 시스템의 점수 자체는 얼마나 불확실한가요?"

### 구현: `confidence.py`

유의성 검정과 동일한 백분위수 부트스트랩 리샘플링 방법을 사용해요:

| 매개변수 | 값 | 근거 |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU 기본값, WMT 2024 관례 |
| `seed` | 12345 | 재현성을 위한 SacreBLEU 기본 시드 |
| `alpha` | 0.05 | 표준 95% 신뢰 수준 |
| 방법 | 백분위수 부트스트랩 | Koehn (2004), Efron (1979) |

### 무엇이 CI를 가지나요

하네스에 의해 계산되는 결정론적 말뭉치 수준 지표:
- `corpus_chrf` (chrF++ 점수)
- `corpus_bleu` (BLEU 점수)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (FST 데이터가 있는 경우)


chrF++ 구간은 공개되는 대표 수치(`chrF++ 47.5 [45.9, 49.0]`)의 일부예요. CI는 캐시된 항목별 점수로부터 부트스트랩되어 `comet_score`에 대해서도 **마찬가지로** 계산돼요(중복 신경망 추론 없음). 새로운 실행에 대해서는 복합 점수 CI가 계산되지 않으며, 레거시 카드의 저장된 복합 점수 CI는 해당 카드가 검증될 때만 다시 도출돼요.

### CLI 플래그

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### 작은 표본 경고

N < 30 항목일 때, 모듈은 CI의 커버리지가 좋지 않을 수 있다는 경고를 발생시켜요. 부트스트랩은 표본에 없는 정보를 만들어낼 수 없어요 — 항목이 매우 적으면, 구간이 넓어져서 높은 불확실성을 정확히 반영해요.

### COMET (계산된 경우 chrF++ 옆에 표시되는 표준 지표)

COMET은 계산될 때마다 모델 ID와 함께 **chrF++ 대표 수치 옆에 표시되는 신경망 지표**예요. chrF++와 결코 혼합되지 않으며, 대형 모델이 필요하고 대부분의 저자원 언어에 대해 보정(calibration)되지 않았기 때문에 대표 수치가 아니에요([점수 산정 사양 §2.3](/docs/network/specifications/scoring#2-metric-inventory) 참조). 부트스트랩 CI는 캐시된 항목별 점수를 기반으로 계산돼요:
- 모델: `Unbabel/wmt22-comet-da` (WMT 2022 참조 기반 모델); 지원되는 아프리카 언어의 경우 AfriCOMET이 자동 선택됨
- `unbabel-comet`가 설치된 경우 계산됨
- TestReport 항목에 저장된 항목별 점수; 말뭉치 값에는 저자원 언어 보정 주의사항이 포함됨
- 검증기에 의해 다시 도출됨 — 보고된 COMET 값은 재현되어야 함
- 선택적 종속성: `python3 -m pip install 'mt-eval-harness[comet]'` (또는 `mt-eval setup --comet`)

### Supabase 컬럼

`run_cards` 테이블에는 이에 해당하는 nullable 열이 포함돼요([scoring.md §9.1](/docs/network/specifications/scoring) 참조):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — 대표 수치 및 95% 구간
- `comet_score` (`real`) — 대표 수치 옆에 표시되며 결코 혼합되지 않음
- `corpus_bleu` (`real`)

전체 신뢰구간 세트는 `scores` 실행 카드 JSON 내 `confidence_intervals` 아래에 저장되며(scoring.md §9의 실행 카드 스키마 참조), chrF++ 경계만 열로도 비정규화(denormalize)돼요.
