---
sidebar_position: 7
title: "Kiểm định ý nghĩa thống kê"
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

# Kiểm định ý nghĩa thống kê

> **Trạng thái**: ✅ Đã phát hành. Kiểm định ý nghĩa bootstrap theo cặp (paired bootstrap significance testing) và khoảng tin cậy bootstrap đã được triển khai trong `mt_eval_harness/significance.py` và `mt_eval_harness/confidence.py`, được xuất (export) từ package, hiển thị trên CLI, và được bao phủ bởi các bộ kiểm thử ý nghĩa / độ tin cậy / chấm điểm.
> **Codebase**: `arena` — được tích hợp vào `tester.py` (khoảng tin cậy theo từng lượt chạy) và `compare.py` (ý nghĩa thống kê giữa các lượt chạy).
> **Mục đích**: Giúp các nhà nghiên cứu xác định xem sự khác biệt giữa hai lượt đánh giá là có ý nghĩa thống kê hay chỉ là nhiễu.

Trang này tài liệu hóa **hành vi đã phát hành** — đây là phần mô tả, không phải là danh sách việc cần làm.

---

## Tại sao điều này lại quan trọng

Khi so sánh hai lượt chạy (ví dụ minh họa: Hệ thống A chrF++ 42.96 so với Hệ thống B chrF++ 41.80 trên 92 mục), bản thân sự khác biệt về điểm số thô không nói lên điều gì về việc đó là thực tế hay chỉ là nhiễu. Chỉ với khoảng 92 mục kiểm thử, sự biến động ngẫu nhiên có thể dễ dàng tạo ra những dao động từ 1–2 điểm. Các chuyên gia yêu cầu kiểm định ý nghĩa thống kê — vì vậy bộ khung kiểm thử (harness) sẽ tính toán chúng.

---

## Thuật toán: Lấy mẫu lại Bootstrap theo cặp (Paired Bootstrap Resampling)

Đây là phương pháp tiêu chuẩn được sử dụng bởi SacreBLEU, MT-Lens và các tác vụ chung của WMT. Phương pháp này đã được các nhà nghiên cứu dịch máy (MT) hiểu rõ và mang lại kết quả mà họ tin cậy.

### Cách thức hoạt động

Cho hai hệ thống A và B được đánh giá trên cùng N mục kiểm thử:

1. Tính toán sự khác biệt thực tế của chỉ số: `Δ = metric(A) - metric(B)`
2. Lặp lại `n_bootstrap` lần (mặc định là 1000):
   a. Lấy mẫu N mục **có hoàn lại** (with replacement) từ tập kiểm thử chung
   b. Tính toán chỉ số cho cả A và B trên mẫu bootstrap này
   c. Tính toán sự khác biệt bootstrap: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. Giá trị p-value = tỷ lệ các mẫu bootstrap mà tại đó `Δ_boot` có dấu ngược lại với `Δ`
4. Nếu p-value < α (mặc định là 0.05), sự khác biệt là có ý nghĩa thống kê

### Các đặc tính chính

- **Theo cặp (Paired)**: Cả hai hệ thống đều được đánh giá trên cùng một mẫu bootstrap, giúp bảo toàn mối tương quan ở cấp độ từng mục
- **Phi tham số (Non-parametric)**: Không có giả định nào về phân phối của điểm số
- **Tiêu chuẩn**: Đây chính xác là những gì `sacrebleu --paired-bs` thực hiện bên dưới

---

## sacrebleu là một Dependency bắt buộc (Hard Dependency)

sacrebleu là một dependency bắt buộc. Một bộ khung đánh giá dịch máy (MT eval harness) không thể tính toán chrF++ hoặc BLEU thì không phải là một bộ khung đánh giá dịch máy thực thụ, vì vậy:

1. `sacrebleu>=2.3` được khai báo dưới `[project.dependencies]` trong `pyproject.toml` (không phải `[project.optional-dependencies]`).
2. Nó được import trực tiếp trong `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — mà không có cơ chế bảo vệ `try/except`.
3. Nó được import trực tiếp trong `significance.py`.

Không có bất kỳ đường dẫn điều kiện `HAS_SACREBLEU` nào: chạy mà không có sacrebleu không phải là một cấu hình được hỗ trợ.

---

## Triển khai

### 1. sacrebleu dưới dạng một dependency bắt buộc

`pyproject.toml` khai báo `sacrebleu>=2.3` dưới `[project.dependencies]`, và `tester.py` import trực tiếp nó:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Không có cơ chế bảo vệ `if HAS_SACREBLEU:` nào trong `tester.py` — các đường dẫn import có điều kiện đã bị loại bỏ.

---

### 2. Module: `mt_eval_harness/significance.py`

Phần triển khai cốt lõi của paired-bootstrap. Giao diện công khai (public surface) của nó:

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

### 3. Các hàm chỉ số tích hợp sẵn (Built-in metric functions)

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

### 4. Tích hợp vào `compare.py`

`compare.py` thực hiện so sánh song song nhiều TestReports và chạy kiểm định ý nghĩa thống kê giữa chúng. `significance.py` cũng đi kèm với `fst_acceptance_rate()` và `composite_score()` (để các khác biệt về FST và composite có thể được kiểm định ý nghĩa), `run_significance_tests()` (điều phối tất cả các chỉ số trên hai báo cáo), và `format_significance_table()` (kết xuất ra console).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Khi so sánh nhiều hơn 2 báo cáo, các kiểm định ý nghĩa theo cặp sẽ chạy cho tất cả các cặp, được định danh bằng `"(run_a_id, run_b_id)"`.

### 5. Tích hợp CLI

`mt-eval compare` cung cấp một flag `--significance`, cùng với `--n-bootstrap` để thiết lập số lượng vòng lặp:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Định dạng đầu ra

`format_significance_table()` kết xuất giao diện console; dữ liệu tương tự cũng được thêm vào JSON so sánh.

**Đầu ra console:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**Đầu ra JSON** (được thêm vào báo cáo so sánh):
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

### 7. Tích hợp Dashboard (cải tiến tùy chọn)

Khi dữ liệu ý nghĩa thống kê có sẵn trong JSON so sánh, dashboard có thể hiển thị nó — một hàng trong bảng so sánh với các chỉ báo ý nghĩa (`*` cho p < 0.05, `**` cho p < 0.01). Đây là một lớp hiển thị (presentation layer) phía trên phần tính toán đã phát hành, không phải là một phần của tính năng cốt lõi.

---

## Các trường hợp đặc biệt và Xác thực

1. **Các mục không khớp (Mismatched entries)**: Hai TestReports phải có cùng ID mục. Nếu không khớp (ví dụ: một báo cáo chạy trên một tập con), chỉ kiểm định ý nghĩa trên phần giao nhau. Đưa ra cảnh báo về các mục bị loại trừ.

2. **Quá ít mục**: Nếu N < 10, cảnh báo rằng các kiểm định ý nghĩa thống kê không đáng tin cậy với số lượng mục ít như vậy. Vẫn chạy kiểm định, nhưng in ra cảnh báo.

3. **Điểm số giống hệt nhau**: Nếu cả hai hệ thống tạo ra kết quả giống hệt nhau cho từng mục, p_value phải là 1.0 (hoàn toàn không có sự khác biệt).

4. **Các chỉ số plugin (Plugin metrics)**: Module ý nghĩa thống kê cũng nên kiểm định bất kỳ chỉ số plugin nào xuất hiện trong CẢ HAI báo cáo. Sử dụng một cách tiếp cận chung: nếu cả hai báo cáo đều có `plugin_metrics.crk_fst_validity.avg_fst_validity`, hãy kiểm định nó.

5. **Khả năng tái lập (Reproducibility)**: Seed của bộ tạo số ngẫu nhiên (RNG seed) phải được ghi lại trong đầu ra để kết quả có thể được tái lập chính xác. Mặc định là 12345 (khớp với quy ước của SacreBLEU).

---

## Những gì KHÔNG cần xây dựng

- **Không kiểm định ý nghĩa COMET riêng biệt**: COMET được tính toán và báo cáo trong một **luồng neural riêng biệt (separate neural lane)** — nó **không bao giờ được gộp vào bất kỳ chỉ số tổng hợp (composite) nào** (chỉ số tổng hợp mang tính tất định; xem [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) và §2). Khoảng tin cậy (CI) Bootstrap *có thể* được tính toán dựa trên điểm số từng mục đã lưu trong cache của nó, nhưng bộ khung kiểm thử không chạy kiểm định ý nghĩa theo cặp tích hợp sẵn cho COMET. Để kiểm định ý nghĩa COMET theo cặp giữa hai hệ thống, hãy sử dụng `comet-compare` từ Unbabel.
- **Không phân tích Bayes**: Hãy trung thành với phương pháp bootstrap tần suất (frequentist bootstrap). Đây là những gì cộng đồng dịch máy (MT) mong đợi và hiểu rõ.
- **Không hiệu chỉnh đa kiểm định (multi-test correction)**: Khi kiểm định nhiều chỉ số, không áp dụng hiệu chỉnh Bonferroni hoặc các hiệu chỉnh tương tự. Quy ước trong đánh giá dịch máy là báo cáo các giá trị p-value thô cho từng chỉ số và để người đọc tự diễn giải.

---

## Sơ đồ Module

Nơi lưu trữ tính năng đã phát hành:

| File | Vai trò |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` được khai báo là một dependency bắt buộc |
| `mt_eval_harness/tester.py` | Import trực tiếp sacrebleu (không có cơ chế bảo vệ `HAS_SACREBLEU`); tính toán CI theo từng lượt chạy |
| `mt_eval_harness/significance.py` | Cốt lõi của paired-bootstrap: `paired_bootstrap`, `SignificanceResult`, các hàm chỉ số tích hợp sẵn, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Khoảng tin cậy Bootstrap: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Xuất (Export) `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Các kiểm định ý nghĩa thống kê được tích hợp vào phần so sánh báo cáo |
| `mt_eval_harness/cli.py` | Các flag `--significance` / `--n-bootstrap` (so sánh) và `--no-ci` / `--n-bootstrap-ci` (kiểm thử) |
| `mt_eval_harness/dashboard.py` | Hiển thị ý nghĩa thống kê trong bảng so sánh (cải tiến tùy chọn) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Unit test (một phần của bộ kiểm thử đã pass) |

---

## Độ bao phủ kiểm thử (Test Coverage)

Các bộ kiểm thử ý nghĩa / độ tin cậy / chấm điểm đều có màu xanh (đã pass). Chúng bao phủ:

1. **Tính tất định với seed (Deterministic with seed)**: cùng đầu vào + cùng seed → cùng giá trị p-value, trong mọi lần chạy
2. **Kiểm thử với kết quả đã biết (Known-answer test)**: hai tập kết quả giống hệt nhau → p_value = 1.0
3. **Kiểm thử ý nghĩa đã biết (Known-significant test)**: hai tập kết quả mà một tập rõ ràng tốt hơn (ví dụ: tất cả đều khớp chính xác so với tất cả đều trượt) → p_value ≈ 0.0
4. **ID không khớp (Mismatched IDs)**: ném ra lỗi `ValueError`, hoặc cảnh báo và tính toán trên phần giao nhau
5. **Đầu vào trống (Empty inputs)**: được xử lý mượt mà (p_value = 1.0 hoặc ném ra lỗi)

---

## Khoảng tin cậy (Tính năng đi kèm)

> **Trạng thái**: ✅ ĐÃ TRIỂN KHAI trong `confidence.py`

Khoảng tin cậy (CI) trả lời một câu hỏi khác với kiểm định ý nghĩa thống kê:

- **Kiểm định ý nghĩa thống kê** (`significance.py`): "Sự khác biệt giữa hệ thống A và hệ thống B có thực sự tồn tại không?"
- **Khoảng tin cậy** (`confidence.py`): "Bản thân điểm số của hệ thống này có mức độ không chắc chắn như thế nào?"

### Triển khai: `confidence.py`

Sử dụng cùng một phương pháp lấy mẫu lại bootstrap phân vị (percentile bootstrap resampling) như kiểm định ý nghĩa thống kê:

| Tham số | Giá trị | Lý do |
|---|---|---|
| `n_bootstrap` | 1000 | Mặc định của SacreBLEU, quy ước của WMT 2024 |
| `seed` | 12345 | Seed mặc định của SacreBLEU để đảm bảo khả năng tái lập |
| `alpha` | 0.05 | Mức tin cậy 95% tiêu chuẩn |
| Phương pháp | Percentile bootstrap | Koehn (2004), Efron (1979) |

### Những gì được tính CI

Các chỉ số cấp độ ngữ liệu (corpus-level) mang tính tất định được tính toán bởi bộ khung kiểm thử:
- `corpus_chrf` (điểm chrF++)
- `corpus_bleu` (điểm BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (khi có dữ liệu FST)
- `composite` (khi có sẵn chrF++ và khớp chính xác)

CI **cũng** được tính toán cho chỉ số neural `comet_score`, được bootstrap từ các điểm số từng mục đã lưu trong cache của nó (không cần suy luận neural dư thừa). Việc có CI không biến COMET thành một chỉ số tổng hợp (composite metric): nó được báo cáo trong một **luồng neural riêng biệt** và không bao giờ được gộp vào chỉ số tổng hợp (xem [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### Các CLI Flag

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Cảnh báo mẫu nhỏ

Khi N < 30 mục, module sẽ phát ra cảnh báo rằng các CI có thể có độ bao phủ kém. Phương pháp bootstrap không thể tạo ra thông tin không có sẵn trong mẫu — với rất ít mục, các khoảng tin cậy sẽ rộng, phản ánh chính xác mức độ không chắc chắn cao.

### COMET (được báo cáo riêng biệt, không bao giờ được tổng hợp)

COMET là một **chỉ số neural được báo cáo trong luồng riêng của nó** — nó **không bao giờ được gộp vào bất kỳ chỉ số tổng hợp nào** (chỉ số tổng hợp được giữ ở dạng tất định; xem [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) và §2). Các CI Bootstrap *được* tính toán dựa trên điểm số từng mục đã lưu trong cache của nó, nhưng nó không phải là một chỉ số tổng hợp "hạng nhất" (first-class):
- Mô hình: `Unbabel/wmt22-comet-da` (mô hình dựa trên tham chiếu WMT 2022); AfriCOMET được tự động chọn cho các ngôn ngữ châu Phi được hỗ trợ
- Được tính toán khi `unbabel-comet` được cài đặt
- Điểm số từng mục được lưu trữ trong các mục TestReport; giá trị ngữ liệu đi kèm với một lưu ý hiệu chuẩn tài nguyên thấp (low-resource calibration caveat)
- Được lấy lại bởi trình xác minh (verifier) — giá trị COMET được báo cáo phải có khả năng tái lập
- Dependency tùy chọn: `pip install mt-eval-harness[comet]`

COMET là một **chỉ số neural được báo cáo ở một luồng riêng** — nó **không bao giờ được gộp vào bất kỳ chỉ số tổng hợp nào** (chỉ số tổng hợp được giữ ở mức tất định; xem [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) và §2). Các Bootstrap CI *được* tính toán dựa trên các điểm số của từng mục nhập đã được lưu trong bộ nhớ đệm của nó, nhưng nó không phải là một chỉ số tổng hợp "hạng nhất":
- Mô hình: `Unbabel/wmt22-comet-da` (mô hình dựa trên tham chiếu WMT 2022); AfriCOMET được tự động chọn cho các ngôn ngữ châu Phi được hỗ trợ
- Được tính toán khi `unbabel-comet` được cài đặt
- Điểm số của từng mục nhập được lưu trữ trong các mục nhập TestReport; giá trị kho ngữ liệu đi kèm với một lưu ý về hiệu chuẩn cho tài nguyên thấp
- Được tính toán lại bởi trình xác minh — giá trị COMET được báo cáo phải có thể tái tạo được
- Phụ thuộc tùy chọn: `pip install mt-eval-harness[comet]`

Bảng `run_cards` chứa các cột nullable tương ứng (xem [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — điểm số neural được báo cáo riêng biệt, không bao giờ được tổng hợp
- `corpus_bleu` (`real`)

Các ranh giới khoảng tin cậy (confidence-interval bounds) được lưu trữ bên trong JSON `scores` của run-card dưới mục `confidence_intervals` (theo schema của run-card trong scoring.md §9), chứ không phải dưới dạng các cột cấp cao nhất được phi chuẩn hóa (denormalized top-level columns).

Các giới hạn khoảng tin cậy được lưu trữ bên trong JSON `scores` của run-card dưới `confidence_intervals` (theo schema của run-card trong scoring.md §9), chứ không phải dưới dạng các cột cấp cao nhất đã được phi chuẩn hóa.
