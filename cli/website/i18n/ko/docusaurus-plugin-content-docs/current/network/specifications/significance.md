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

> **상태**: ✅ 출시됨. 페어드 부트스트랩 유의성 검정과 부트스트랩 신뢰 구간이 `mt_eval_harness/significance.py` 및 `mt_eval_harness/confidence.py`에 구현되어 있으며, 패키지에서 내보내지고, CLI에 노출되며, significance / confidence / scoring 테스트 스위트로 커버되고 있어요.
> **코드베이스**: `arena` — `tester.py`(실행별 신뢰 구간)과 `compare.py`(실행 간 유의성)에 연결되어 있어요.
> **목적**: 연구자가 두 평가 실행 간의 차이가 통계적으로 유의한지 아니면 단순한 노이즈인지 판단할 수 있게 해줘요.

이 페이지는 **출시된 동작**을 문서화한 것이에요 — 이는 설명적인 내용이지, 할 일 목록이 아니에요.

---

## 왜 중요한가요

두 실행을 비교할 때(예시: 92개 항목에서 System A chrF++ 42.96 대 System B chrF++ 41.80), 원시 점수 차이만으로는 그것이 실제인지 노이즈인지에 대해 아무것도 말해주지 못해요. 테스트 항목이 ~92개밖에 없으면, 무작위 변동만으로도 1~2점 차이가 쉽게 발생할 수 있어요. 전문가들은 유의성 검정을 요구하고, 그래서 이 하니스가 이를 계산해요.

---

## 알고리즘: 페어드 부트스트랩 리샘플링

이는 SacreBLEU, MT-Lens, WMT 공유 작업에서 사용하는 표준 방법이에요. MT 연구자들에게 잘 이해되고 있으며, 그들이 신뢰하는 결과를 만들어내요.

### 작동 방식

동일한 N개의 테스트 항목에서 평가된 두 시스템 A와 B가 주어졌을 때:

1. 실제 지표 차이를 계산해요: `Δ = metric(A) - metric(B)`
2. `n_bootstrap`번 반복해요(기본값 1000):
   a. 공유 테스트 세트에서 **복원 추출**로 N개의 항목을 샘플링해요
   b. 이 부트스트랩 샘플에서 A와 B 모두에 대한 지표를 계산해요
   c. 부트스트랩 차이를 계산해요: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. p-값 = `Δ_boot`가 `Δ`와 반대 부호를 갖는 부트스트랩 샘플의 비율
4. p-값 < α(기본값 0.05)이면, 그 차이는 통계적으로 유의해요

### 주요 특성

- **페어드**: 두 시스템 모두 동일한 부트스트랩 샘플에서 평가되어, 항목 수준의 상관관계를 보존해요
- **비모수적**: 점수의 분포에 대한 가정이 없어요
- **표준**: 이는 `sacrebleu --paired-bs`가 내부적으로 수행하는 것과 정확히 일치해요

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

핵심 페어드 부트스트랩 구현이에요. 그 공개 인터페이스는:

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

`compare.py`는 여러 TestReport의 나란한 비교를 수행하고 그들 사이의 유의성 검정을 실행해요. `significance.py`는 또한 `fst_acceptance_rate()`와 `composite_score()`(FST 및 복합 차이를 유의성 검정할 수 있도록), `run_significance_tests()`(두 보고서에 걸쳐 모든 지표를 구동), `format_significance_table()`(콘솔 렌더링)도 제공해요.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

2개 이상의 보고서를 비교할 때, `"(run_a_id, run_b_id)"`로 키가 지정된 모든 쌍에 대해 쌍별 유의성 검정이 실행돼요.

### 5. CLI 통합

`mt-eval compare`는 `--significance` 플래그를 노출하며, 반복 횟수를 설정하는 `--n-bootstrap`를 제공해요:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. 출력 형식

`format_significance_table()`가 콘솔 뷰를 렌더링해요; 동일한 데이터가 비교 JSON에 추가돼요.

**콘솔 출력:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON 출력**(비교 보고서에 추가됨):
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
      "ci_upper": 3.12
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

4. **플러그인 지표**: 유의성 모듈은 두 보고서 모두에 나타나는 모든 플러그인 지표도 검정해야 해요. 일반적인 접근 방식을 사용해요: 두 보고서 모두 `plugin_metrics.crk_fst_validity.avg_fst_validity`를 가지고 있으면, 그것을 검정해요.

5. **재현성**: RNG 시드가 출력에 기록되어야 결과를 정확히 재현할 수 있어요. 기본값은 12345예요(SacreBLEU 관례와 일치).

---

## 만들지 말아야 할 것

- **별도의 COMET 유의성 없음**: COMET은 **별도의 신경망 레인**에서 계산되고 보고돼요 — 이는 **어떤 복합 지표에도 절대 포함되지 않아요**(복합 지표는 결정론적이에요; [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) 및 §2 참조). 부트스트랩 CI는 그 캐시된 항목별 점수에 대해 *계산될 수 있지만*, 하니스는 COMET에 대한 내장 페어드 유의성 검정을 실행하지 않아요. 두 시스템 간의 쌍별 COMET 유의성을 위해서는 Unbabel의 `comet-compare`을 사용하세요.
- **베이지안 분석 없음**: 빈도주의 부트스트랩을 고수해요. 이것이 MT 커뮤니티가 기대하고 이해하는 방식이에요.
- **다중 검정 보정 없음**: 여러 지표를 검정할 때, Bonferroni나 유사한 보정을 적용하지 않아요. MT 평가에서의 관례는 지표별로 원시 p-값을 보고하고 독자가 해석하도록 하는 것이에요.

---

## 모듈 맵

출시된 기능이 위치한 곳:

| 파일 | 역할 |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3`가 필수 의존성으로 선언됨 |
| `mt_eval_harness/tester.py` | 직접 sacrebleu 임포트(`HAS_SACREBLEU` 가드 없음); 실행별 CI 계산 |
| `mt_eval_harness/significance.py` | 페어드 부트스트랩 코어: `paired_bootstrap`, `SignificanceResult`, 내장 지표 함수, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | 부트스트랩 신뢰 구간: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` 내보냄 |
| `mt_eval_harness/compare.py` | 보고서 비교에 연결된 유의성 검정 |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap`(compare) 및 `--no-ci` / `--n-bootstrap-ci`(test) 플래그 |
| `mt_eval_harness/dashboard.py` | 비교 테이블에서 유의성을 표시함(선택적 개선 사항) |
| `tests/test_significance.py`, `tests/test_confidence.py` | 단위 테스트(통과 스위트의 일부) |

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

하니스가 계산하는 결정론적 코퍼스 수준 지표:
- `corpus_chrf` (chrF++ 점수)
- `corpus_bleu` (BLEU 점수)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (FST 데이터가 있을 때)
- `composite` (chrF++와 정확 일치가 사용 가능할 때)

CI는 신경망 `comet_score`에 대해서도 **역시** 계산되며, 그 캐시된 항목별 점수로부터 부트스트랩돼요(중복 신경망 추론 없음). CI를 갖는다고 해서 COMET이 복합 지표가 되는 것은 아니에요: 이는 **별도의 신경망 레인**에서 보고되며 복합 지표에 절대 포함되지 않아요([scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) 참조).

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

### COMET(별도로 보고되며, 절대 복합되지 않음)

COMET은 **독립적으로 보고되는 신경망 지표**예요 — 이는 **어떤 복합 지표에도 결코 포함되지 않아요** (복합 지표는 결정론적으로 유지돼요. [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) 및 §2를 참고하세요). 부트스트랩 신뢰 구간(CI)은 캐시된 항목별 점수를 기반으로 계산*되지만*, "일급(first-class)" 복합 지표는 아니에요:
- 모델: `Unbabel/wmt22-comet-da` (WMT 2022 참조 기반 모델); 지원되는 아프리카 언어의 경우 AfriCOMET이 자동 선택돼요
- `unbabel-comet`가 설치되어 있을 때 계산돼요
- 항목별 점수는 TestReport 항목에 저장돼요. 말뭉치(corpus) 값에는 저자원(low-resource) 보정 주의 사항이 포함돼요
- 검증자(verifier)에 의해 다시 도출돼요 — 보고된 COMET 값은 반드시 재현되어야 해요
- 선택적 의존성: `pip install mt-eval-harness[comet]`

### Supabase 컬럼

`run_cards` 테이블은 해당하는 nullable 컬럼을 담고 있어요([scoring.md §9.1](/docs/network/specifications/scoring) 참조):
- `comet_score` (`real`) — 별도로 보고되는 신경망 점수, 절대 복합되지 않음
- `corpus_bleu` (`real`)

신뢰 구간 경계는 run-card `scores` JSON 내 `confidence_intervals` 아래에 저장돼요(scoring.md §9의 run-card 스키마에 따름), 비정규화된 최상위 컬럼으로는 저장되지 않아요.
