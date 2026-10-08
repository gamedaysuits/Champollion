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

> **Trạng thái**: ✅ Đã phát hành. Kiểm định ý nghĩa thống kê theo cặp (ngẫu nhiên hóa xấp xỉ theo mặc định; bootstrap theo cặp khi có yêu cầu) và các khoảng tin cậy bootstrap đã được triển khai trong `mt_eval_harness/significance.py` và `mt_eval_harness/confidence.py`, được export từ package, hiển thị trên CLI và được kiểm thử toàn diện bởi các bộ test suite về significance / confidence / scoring.
> **Codebase**: `arena` — được tích hợp vào `tester.py` (khoảng tin cậy theo từng lần chạy) và `compare.py` (ý nghĩa thống kê giữa các lần chạy).
> **Mục đích**: Giúp các nhà nghiên cứu xác định xem sự khác biệt giữa hai lần chạy đánh giá có ý nghĩa thống kê hay chỉ là nhiễu ngẫu nhiên.

Trang này tài liệu hóa **hành vi đã phát hành** — đây là phần mô tả, không phải là danh sách việc cần làm.

---

## Tại sao điều này lại quan trọng

Khi so sánh hai lượt chạy (ví dụ minh họa: Hệ thống A chrF++ 42.96 so với Hệ thống B chrF++ 41.80 trên 92 mục), bản thân sự khác biệt về điểm số thô không nói lên điều gì về việc đó là thực tế hay chỉ là nhiễu. Chỉ với khoảng 92 mục kiểm thử, sự biến động ngẫu nhiên có thể dễ dàng tạo ra những dao động từ 1–2 điểm. Các chuyên gia yêu cầu kiểm định ý nghĩa thống kê — vì vậy bộ khung kiểm thử (harness) sẽ tính toán chúng.

**Theo tiêu chuẩn chấm điểm (`standard/1`), kiểm định theo cặp trên chrF++ là yếu tố quyết định xem một lần chạy có tốt hơn lần chạy khác hay không.** chrF++ là chỉ số chính được khai báo trước ([Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER và COMET (khi cả hai lần chạy đều có điểm COMET theo từng phân đoạn từ cùng một mô hình) được kiểm định và hiển thị dưới dạng các chỉ số tiêu chuẩn phụ, còn khớp chính xác (exact match) và tỷ lệ plugin đóng vai trò là chẩn đoán; không chỉ số nào trong số đó mang tính quyết định. Quy định này tuân theo nghiên cứu của Kocmi et al. (2021, "To Ship or Not to Ship"), phát hiện qua hàng nghìn đánh giá của con người rằng sự khác biệt về chỉ số đi kèm với mức ý nghĩa thống kê chính là yếu tố dự đoán mức độ ưa thích của con người.

---

## Thuật toán: Ngẫu nhiên hóa xấp xỉ theo cặp (mặc định)

`mt-eval compare --significance` sử dụng kiểm định **ngẫu nhiên hóa xấp xỉ theo cặp (paired approximate randomization - AR)** của Riezler & Maxwell (2005). Đây cũng là mặc định của SacreBLEU khi so sánh các hệ thống.

### Nguyên lý hoạt động

Cho hai hệ thống A và B được đánh giá trên cùng N mục kiểm thử:

1. Tính toán mức chênh lệch quan sát được ở cấp độ ngữ liệu (corpus): `Δ = metric(A) - metric(B)`.
2. Lặp lại `n_trials` lần (mặc định 1000):
   a. Với mỗi mục (entry), hoán đổi kết quả đầu ra của A và B với xác suất ½.
   b. Tính lại chỉ số ngữ liệu trên hai nhóm đã xáo trộn.
   c. Ghi nhận xem `|Δ_shuffled| ≥ |Δ|` có thỏa mãn hay không.
3. Giá trị p-value là mức ý nghĩa thống kê hai phía đạt được:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. Số +1 tính việc gán quan sát ban đầu như một lần rút hợp lệ, do đó p không bao giờ bằng 0 tuyệt đối.
4. Nếu p < α (mặc định 0.05), sự khác biệt được báo cáo là có ý nghĩa thống kê.

Khoảng tin cậy cho Δ là khoảng phân vị bootstrap (AR cho ra giá trị p-value chứ không cho ra khoảng tin cậy). Nó được tính trên một luồng ngẫu nhiên riêng biệt để không làm ảnh hưởng đến các lần rút của AR.

### Các đặc tính chính

- **Một kiểm định giả thuyết thực sự:** các lần xáo trộn được rút ra theo giả thuyết vô hiệu (null hypothesis) rằng hệ thống nào tạo ra một mục nhất định không tạo ra bất kỳ sự khác biệt nào.
- **Theo cặp (Paired):** cả hai hệ thống được so sánh theo từng mục, giúp bảo toàn tương quan ở cấp độ mục.
- **Phi tham số (Non-parametric):** không đưa ra bất kỳ giả định nào về phân phối của điểm số.

### Bootstrap theo cặp (có sẵn, không phải mặc định)

`paired_bootstrap()` triển khai phương pháp bootstrap theo cặp của Koehn (2004): phương pháp này lấy mẫu lại các mục có hoàn lại (resamples with replacement) và đếm tần suất đổi dấu của Δ. Phương pháp này được cung cấp nhằm phục vụ mục đích so sánh với các bài báo khoa học cũ hơn, nhưng đây chỉ là một phương pháp phỏng đoán độ ổn định của dấu (sign-robustness heuristic), không phải mức ý nghĩa thống kê chuẩn trong sách giáo khoa. Phân phối của nó tập trung quanh giá trị Δ quan sát được chứ không tập trung vào giả thuyết vô hiệu, do đó nó có thể phóng đại mức ý nghĩa thống kê so với AR. Bạn có thể chọn phương pháp này trên dòng lệnh bằng
`mt-eval compare <reports…> --significance --method paired_bootstrap`, hoặc với
`method="paired_bootstrap"` trong `run_significance_tests`.

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

Phần triển khai kiểm định ý nghĩa thống kê (ngẫu nhiên hóa xấp xỉ theo mặc định, bootstrap theo cặp khi có yêu cầu). Giao diện công khai (public surface) của nó:

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

`compare.py` thực hiện so sánh song song nhiều TestReport và chạy kiểm định ý nghĩa thống kê giữa chúng. `run_significance_tests()` điều phối các kiểm định trên hai báo cáo và `format_significance_table()` kết xuất kết quả. Mỗi kết quả đều mang `role` của nó: `primary` (chrF++ — kiểm định duy nhất mang tính quyết định), `secondary` (các chỉ số tiêu chuẩn khác) hoặc `diagnostic`. Thứ tự kiểm định như sau:

| Chỉ số | Vai trò | Được tính trên mỗi lần lấy mẫu lại từ |
|---|---|---|
| `corpus_chrf` | chính | thống kê sacreBLEU trên từng phân đoạn |
| `corpus_bleu` | phụ | thống kê sacreBLEU trên từng phân đoạn |
| `corpus_spbleu` | phụ | thống kê sacreBLEU trên từng phân đoạn, trên bộ tokenizer SentencePiece FLORES-200 (spBLEU là BLEU đi cùng tokenizer đó, là con số mà các bảng FLORES/NLLB báo cáo). Khi tokenizer không khả dụng (không có `sentencepiece`, hoặc đang ngoại tuyến khi chưa tải mô hình về), chỉ số sẽ được liệt kê là chưa kiểm định, không bao giờ bị bỏ qua trong im lặng |
| `corpus_ter` | phụ | thống kê sacreBLEU trên từng phân đoạn. TER là tỷ lệ chỉnh sửa, vì vậy **càng thấp càng tốt**: Δ âm biểu thị ưu thế nghiêng về A |
| `comet_score` | phụ | điểm COMET trên từng phân đoạn mà cả hai báo cáo đã có sẵn (giá trị trung bình của chúng là điểm hệ thống của COMET; mô hình không bao giờ bị chạy lại). Được liệt kê là chưa kiểm định kèm lý do khi chỉ có một lần chạy được tính điểm bằng COMET hoặc hai lần chạy dùng các mô hình COMET khác nhau |
| `exact_match_rate` | chẩn đoán | cờ khớp chính xác (exact-match) của từng mục |
| Tỷ lệ plugin trong cả hai báo cáo, ví dụ `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | chẩn đoán | kết quả trên từng mục của chính plugin đó, được tổng hợp theo cách chỉ số tiêu đề được tính |

**Điểm tổng hợp đã ngừng sử dụng không được kiểm định.** Điểm tổng hợp có trọng số và hàng `segment_composite` từng được kiểm định ở đây đã bị loại bỏ theo tiêu chuẩn chấm điểm ([Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score)). Tệp JSON so sánh được tạo trước khi có tiêu chuẩn vẫn hiển thị các hàng `segment_composite` (hoặc `composite_score`) của nó, được gắn nhãn là điểm tổng hợp kế thừa (legacy) không quyết định điều gì. Khi một báo cáo được so sánh là báo cáo cũ, `compare` sẽ thông báo rằng điểm tổng hợp của nó đã ngừng sử dụng và không tiến hành so sánh.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Khi so sánh nhiều hơn 2 báo cáo, các kiểm định ý nghĩa thống kê theo cặp sẽ chạy cho tất cả các cặp: `significance` khi đó là danh sách các đối tượng `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}`, mỗi cặp một đối tượng, mỗi danh sách `tests` có cấu trúc tương tự trường hợp hai báo cáo. `letters` là các chữ cái đại diện cho hai lần chạy trong bảng lần chạy, và Δ là kết quả của lần chạy thứ nhất trừ đi lần chạy thứ hai.

Bên cạnh `significance`, JSON so sánh còn chứa `significance_settings`: gồm `method`, `n_resamples`, `alpha`, `seed`, mỗi chữ cái đại diện cho lần chạy nào (`runs`), `ci_lower`/`ci_upper` là gì, `multiple_testing_correction: "none"`, có bao nhiêu chỉ số được kiểm định trên mỗi cặp và trên bao nhiêu cặp, ghi chú diễn giải dễ hiểu về p-value chưa hiệu chỉnh (bên dưới), cùng mọi ghi chú phát sinh trong quá trình kiểm định (các mục bị loại trừ khỏi phép ghép cặp, các chỉ số không được kiểm định).

### 5. Tích hợp CLI

`mt-eval compare` hiển thị cờ `--significance`, cùng với `--method` để chọn phép kiểm định theo cặp (`approximate_randomization`, mặc định, hoặc `paired_bootstrap`) và `--n-bootstrap` để đặt số lần lặp:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` nhận các tệp `*_report.json` mà `mt-eval run` ghi lại (hoặc log lần chạy, sử dụng báo cáo cùng thư mục của nó). Lệnh này in bảng các lần chạy với một hàng cho mỗi chỉ số và một cột cho mỗi lần chạy, sau đó là bảng mức ý nghĩa thống kê, và ghi tệp JSON so sánh vào một vị trí trung lập trừ khi `-o` chỉ định một tệp khác: `comparison-<hash>.json` bên cạnh các báo cáo nếu chúng nằm chung thư mục, nếu không thì đặt trong `comparisons/` tại thư mục chung gần nhất của chúng (các báo cáo trong thư mục riêng của từng lần chạy, chẳng hạn như thư mục `mcp-run-<id>/` của `run_benchmark`, không bao giờ bị ghi tệp so sánh vào đó). `<hash>` là mười ký tự hex đầu tiên của mã băm sha256 trên các id lần chạy được so sánh theo đúng thứ tự cung cấp, nhờ đó một phép so sánh khác trong cùng thư mục sẽ không bao giờ ghi đè lên tệp này; việc so sánh lại chính các lần chạy đó sẽ ghi đè vào tệp của chúng. Việc chỉ định tên tệp bằng `-o` sẽ thay thế bất kỳ tệp nào hiện có ở đó và đầu ra sẽ thông báo điều này. Lệnh sẽ in đường dẫn tệp đã ghi. Một phép so sánh giữa các lần chạy trên ngữ liệu chỉ cục bộ (local-only), niêm phong (sealed) hoặc yêu cầu đồng thuận (consent-required) sẽ trích dẫn các câu từ ngữ liệu đó, do đó nó sẽ mang dấu chỉ của ngữ liệu đó trong tệp phụ `<file>.champollion.json` bất kể được ghi ở đâu.

Cột **Avg latency (s/entry)** trong bảng lần chạy sẽ hiển thị `—` đối với lần chạy không ghi nhận thời gian, kèm ghi chú dưới bảng giải thích lý do: mọi mục đều lấy từ bộ nhớ đệm (cache), kết quả đầu ra được tạo bên ngoài harness, hoặc phương thức không báo cáo thời gian. Giá trị dưới 0.01 giây được hiển thị với bốn chữ số thập phân (một mô hình nhỏ trên CPU giải mã một câu chỉ trong vài mili-giây), không bao giờ bị làm tròn thành 0.00.

### 6. Định dạng đầu ra

`format_significance_table()` kết xuất giao diện console; dữ liệu tương tự cũng được thêm vào JSON so sánh.

Các báo cáo được gán chữ cái theo thứ tự được cung cấp: báo cáo đầu tiên là lần chạy **A**, thứ hai là **B**, tiếp theo là **C**, **D**, v.v., tương ứng với các chữ cái trong bảng lần chạy ở trên. Mỗi bảng so sánh theo cặp gọi tên hai lần chạy bằng các chữ cái này cùng id lần chạy của chúng, ví dụ `--- A (baseline) vs C (nllb-ft) ---`, và các cột cùng giá trị Δ cũng sử dụng các chữ cái tương ứng (`Δ (A−C)`). Δ luôn là **lần chạy thứ nhất − lần chạy thứ hai**. Lời giải thích về bảng và mọi ghi chú bên dưới chỉ được in **một lần**, bất kể có bao nhiêu cặp. Mỗi hàng cũng in mức **CI on Δ** 95%: khoảng phân vị bootstrap trong `ci_lower`/`ci_upper` của JSON, cho biết độ lớn hợp lý của chênh lệch chứ không chỉ dấu của nó. Mỗi chỉ số được đánh dấu hướng tối ưu từ registry chỉ số (↑ càng cao càng tốt, ↓ càng thấp càng tốt), và cột **Better** nêu tên lần chạy có điểm tốt hơn theo đúng hướng đó, với `(n.s.)` khi chênh lệch không có ý nghĩa thống kê. Do đó, một tỷ lệ thuộc loại càng thấp càng tốt như TER, chuyển mã (code switching) hay ảo giác (hallucination) tăng lên sẽ in Δ dương với **B** là lần chạy tốt hơn; và một mô hình đã huấn luyện được truyền vào ở vị trí thứ hai đánh bại mô hình cơ sở (baseline) 63.5 điểm chrF++ sẽ in Δ −63.52 với **B** tốt hơn. Một chỉ số mà registry không khai báo hướng tối ưu sẽ được hiển thị với `?`. Điểm số, Δ và khoảng tin cậy được in với hai chữ số thập phân, và nhiều hơn (tối đa sáu chữ số) trên hàng mà việc làm tròn sẽ che khuất chênh lệch thực tế: spBLEU là 0.0684 so với 0.0673 sẽ in Δ +0.0011 [+0.0001, +0.0021], không bao giờ là +0.00 [+0.00, +0.00] cạnh chữ **Yes**, và bảng sẽ cho biết các hàng đó có nhiều chữ số thập phân hơn. Tệp JSON lưu bốn chữ số thập phân và bốn chữ số có nghĩa cho giá trị khác 0 nhỏ hơn ngưỡng đó, để chênh lệch thực tế không bao giờ bị lưu thành 0. Đầu ra giống hệt nhau sẽ cho Δ chính xác bằng 0 và p = 1, nên chúng không bao giờ có ý nghĩa thống kê. Nếu p giảm xuống dưới α trong khi khoảng bootstrap của Δ chính xác là [0, 0] (quá ít phân đoạn khác biệt để ước tính chênh lệch), **Sig?** sẽ hiển thị `?†` và **Better** hiển thị `—†`, kèm theo ghi chú: không có lần chạy nào được coi là tốt hơn ở chỉ số đó. Đối với tỷ lệ plugin thuộc loại càng thấp càng tốt, `winner` trong JSON cũng nhận biết được hướng tối ưu (tỷ lệ thấp hơn sẽ thắng), tương tự như với `corpus_ter`; một tỷ lệ plugin không có hướng tối ưu (trung tính, chẳng hạn như `morph_coverage`, hoặc chưa khai báo) sẽ có `winner: null`. Mỗi kết quả cũng mang theo `direction` của nó.

**Đầu ra console** (các con số mang tính minh họa):
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

Trong ví dụ này, kết luận là **không có sự khác biệt có ý nghĩa thống kê**: chrF++, chỉ số chính, không phân biệt được A và B (p = 0.142), do đó không có lần chạy nào được coi là tốt hơn — ngay cả khi BLEU, spBLEU và TER nghiêng về A và chuyển mã (code-switching) nghiêng về B. Các hàng đó vẫn được hiển thị và bạn có thể muốn xem xét chúng, nhưng chúng không mang tính quyết định. Bảng liệt kê chrF++ đầu tiên, tiếp theo là các chỉ số tiêu chuẩn khác, sau đó là các chỉ số chẩn đoán.

Khi có nhiều hơn hai lần chạy, các bảng `--- X (run) vs Y (run) ---` sẽ lần lượt xuất hiện bên dưới một tiêu đề chung duy nhất, và ghi chú sẽ đếm mọi kiểm định đã thực hiện (`6 metrics were tested per pair (36 tests over 6 pairs)`).

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
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
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

4. **Chỉ số plugin**: Tỷ lệ plugin xuất hiện trong CẢ HAI báo cáo chỉ được kiểm định từ các giá trị theo từng phân đoạn mà báo cáo thực sự chứa. Điều đó có nghĩa là phép tổng hợp riêng của plugin trên các kết quả theo từng mục của nó (chỉ số FST), hoặc giá trị trung bình của giá trị theo từng mục mà một tập hợp `avg_<name>` tính trung bình (các chỉ số hành vi). Một tỷ lệ plugin không có giá trị theo từng phân đoạn sẽ được liệt kê là chưa kiểm định, không bao giờ hiển thị dưới dạng 0.00 vs 0.00. Các số đếm như `total_words_checked` không được kiểm định.

5. **Khả năng tái lập (Reproducibility)**: Seed của bộ tạo số ngẫu nhiên (RNG seed) phải được ghi lại trong đầu ra để kết quả có thể được tái lập chính xác. Mặc định là 12345 (khớp với quy ước của SacreBLEU).

---

## Những gì KHÔNG cần xây dựng

- **Không suy luận lại COMET trong kiểm định**: COMET được kiểm định theo cặp từ điểm số trên từng phân đoạn mà cả hai báo cáo đã có sẵn; mô hình không bao giờ bị chạy lại trên mỗi lần lấy mẫu lại. Hai lần chạy được tính điểm bằng các mô hình COMET khác nhau sẽ không được kiểm định đối đầu với nhau.
- **Không phân tích Bayes**: Trung thành với phương pháp bootstrap theo trường phái tần suất (frequentist). Đó là những gì cộng đồng MT mong đợi và am hiểu.
- **Không hiệu chỉnh đa kiểm định (multi-test correction)**: Khi kiểm định nhiều chỉ số, không áp dụng hiệu chỉnh Bonferroni hoặc các phương pháp tương tự. Quy ước trong đánh giá MT là báo cáo các giá trị p-value thô cho từng chỉ số và để người đọc tự diễn giải. `mt-eval compare` **nêu rõ điều này** trong đầu ra của nó và trong `comparison.json` (`significance_settings.multiple_testing_correction: "none"` kèm theo một ghi chú diễn giải dễ hiểu): khi kiểm định nhiều chỉ số, một kết quả đạt p < 0.05 hoàn toàn có thể xuất hiện do ngẫu nhiên, và một giá trị Δ nhỏ có thể có ý nghĩa thống kê mà không thực sự mang lại khác biệt quan trọng, vì vậy hãy đọc kỹ CI on Δ cùng độ tin cậy của chỉ số đối với ngôn ngữ đó trước khi đưa ra quyết định dựa trên một kết quả "có ý nghĩa thống kê" đơn lẻ.

---

## Các cụm xếp hạng {#ranking-clusters}

> **Trạng thái**: ✅ Đã phát hành, dành cho các cuộc thi. Bảng xếp hạng cuộc thi là một tập hợp các **cụm (cluster)**, không phải là thứ tự tuyệt đối — kiểm định ý nghĩa thống kê quyết định những bài nộp lân cận nào thực sự phân biệt được với nhau. Phần này mô tả những gì đã phát hành, bao gồm cả những trường hợp bằng chứng yếu hơn kiểm định theo cặp.

### Chuỗi liên kết liền kề, đánh số xếp hạng cuộc thi

Các bài nộp được phân vùng theo **track** trước tiên — một hệ thống `constrained` không bao giờ được xếp hạng chung với hệ thống `unconstrained`, và mỗi track có thứ tự, nhóm hòa điểm (tie group) cùng phạm vi thứ hạng riêng, do đó "hạng 1" luôn có nghĩa là hạng 1 *trong phạm vi một track*.

Trong một track, các bài nộp được sắp xếp theo chỉ số chính của cuộc thi (chrF++ trừ khi cuộc thi quy định chỉ số khác), tiếp theo là các chỉ số bề mặt còn lại và cuối cùng là thời điểm nộp bài sớm nhất. Mọi cặp **liền kề** theo thứ tự đó đều được kiểm định. Cặp bài nộp mà kiểm định không thể phân biệt sẽ có cùng thứ hạng, và các thứ hạng dùng chung sẽ **tạo thành chuỗi**: nếu A hòa B và B hòa C, cả ba sẽ thuộc cùng một nhóm hòa điểm ngay cả khi A và C chưa từng được so sánh trực tiếp với nhau.

Thứ hạng áp dụng cách đánh số kiểu cuộc thi — trường hợp hòa ba bài ở vị trí đầu là `1, 1, 1` và bài nộp kế tiếp là `4`; trường hợp hòa hai bài ở vị trí thứ hai là `1, 2, 2, 4`.

**Giới hạn thực tế của việc tạo chuỗi**: tính không có ý nghĩa thống kê không có tính chất bắc cầu. Một chuỗi dài có thể kết nối hai bài nộp mà một kiểm định trực tiếp *sẽ* phân biệt được. Đó là lý do tại sao một cụm được báo cáo dưới dạng một **khoảng (range)**, thay vì một điểm số đơn lẻ.

### Phạm vi thứ hạng

Mỗi bài nộp đều mang `rank_min` và `rank_max` — vị trí tốt nhất và xấu nhất phù hợp với bằng chứng thu được, theo phong cách WMT sử dụng cho các phạm vi thứ hạng của mình. Một bài nộp đứng một mình trong cụm của nó sẽ có `rank_min == rank_max`. Một bài nộp nằm trong một cụm bốn bài trải từ vị trí 2–5 sẽ mang `rank_min: 2, rank_max: 5`, và **không có bài nộp nào trong cụm đó được xem là "xếp trước" bài nộp khác**. Việc trích dẫn một con số thứ hạng duy nhất tách rời khỏi cụm là cách hiểu sai kết quả.

### Bậc thang bằng chứng

Không phải mọi cặp đều có thể được kiểm định theo cùng một cách, do đó mỗi cặp đều ghi lại bậc thang mà kết luận thực sự dựa vào. Nhãn này là một phần của kết quả và không bao giờ bị lược bỏ:

| Bậc | Bằng chứng | Khi nào khả dụng | Độ tin cậy |
|---|---|---|---|
| 1 | **Kiểm định theo cặp trên từng phân đoạn** — ngẫu nhiên hóa xấp xỉ theo mặc định, bootstrap theo cặp khi có yêu cầu (thuật toán được mô tả ở trên) | Chỉ khi CẢ HAI bài nộp đều có tập hợp điểm theo từng phân đoạn đầy đủ và đồng bộ | Kiểm định thực sự |
| 2 | **Chồng lấn khoảng tin cậy 95% bootstrap (CI overlap)** trên các giới hạn khoảng đã công bố | Khi chỉ số chính có giới hạn khoảng tin cậy trên cả hai bài nộp (chrF++ có; BLEU và COMET không có các cột khoảng tin cậy) | Một đại diện thận trọng — các khoảng chồng lấn **không** chứng minh sự tương đương, và việc không chồng lấn là một tiêu chuẩn khắt khe hơn so với kiểm định theo cặp |
| 3 | **Bằng nhau về điểm số** theo quy tắc làm tròn hiển thị của chỉ số | Luôn luôn | Bậc yếu nhất: nó chỉ cho thấy hai con số được in ra là giống hệt nhau |

### Cuộc thi niêm phong: bậc 1 chạy trên node

Bậc 1 cần điểm số theo từng phân đoạn từ cả hai hệ thống. Trong một cuộc thi niêm phong (sealed contest), node đánh giá của ban tổ chức giữ các bản dịch tham chiếu và **không bao giờ xuất đầu ra theo từng phân đoạn**. Đó là mục đích cốt lõi của nhánh niêm phong (sealed lane), và đây không phải là thiết lập có thể nới lỏng. Do đó, thay vì xuất dữ liệu, kiểm định theo cặp sẽ được chuyển đến trực tiếp nơi lưu trữ dữ liệu.

`mt-eval node verdicts` chạy kiểm định theo cặp của chính cuộc thi ngay trên node, dựa trên các bản tham chiếu niêm phong và mọi cặp bài nộp mà nó đã chấm điểm, rồi chỉ ghi lại **các kết luận**: đối với mỗi cặp gồm phương pháp, p-value, chênh lệch điểm số, khoảng tin cậy của nó và số lượng phân đoạn. Không có phân đoạn, bản tham chiếu hay bản dịch nào nằm trong tệp này. Node sẽ ký tệp bằng khóa score-sign của nó. Ban tổ chức sau đó đóng cuộc thi bằng `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. Bảng xếp hạng chỉ sử dụng các kết luận nếu chữ ký được xác thực và chúng được tính toán cho đúng cuộc thi này, tập dữ liệu niêm phong của nó, chỉ số của nó, chính sách hòa điểm cố định và phiên bản harness đã cam kết. Nếu không, lệnh đóng sẽ từ chối.

Khi không có kết luận nào được cung cấp, các trường hợp hòa điểm của một cuộc thi niêm phong sẽ dựa vào sự chồng lấn khoảng tin cậy đối với các chỉ số có khoảng tin cậy, và dựa vào sự bằng nhau về điểm số đối với các chỉ số không có. Khi đó, các cụm của nó sẽ rộng hơn so với cụm từ kiểm định theo cặp. Bản thân bảng xếp hạng sẽ nêu rõ trường hợp nào được áp dụng: `ranking_method.evidence_used` nêu tên các bậc thực tế được sử dụng, và `ranking_method.node_verdicts` nêu tên node có các kết luận được sử dụng (nếu có).

### Những gì bảng xếp hạng không xếp thứ hạng

- **Các bài nộp đối chiếu (contrastive entries)** được báo cáo trong phần riêng và không bao giờ giành chiến thắng.
- **Thời gian chạy, phần cứng và chi phí** được gắn kèm trên thẻ lần chạy (run card) và chỉ được báo cáo chứ không bao giờ xếp hạng. Không có track dành cho hiệu năng.
- **Đánh giá của con người (Human judgment)** hoàn toàn không nằm trong các bảng xếp hạng này. Một quy trình *lựa chọn* đánh giá của con người — hệ thống nào sẽ được một mức ngân sách cố định chi trả, lấy toàn bộ các nhóm hòa điểm để một cụm không bao giờ bị cắt đôi — có thể được ghi nhận cho một cuộc thi đã đóng, nhưng không tồn tại điểm xếp hạng nào; xem [MT Evaluation Rules](/docs/network/leaderboard/rules#verification-tiers).

---

## Sơ đồ Module

Nơi lưu trữ tính năng đã phát hành:

| Tệp | Vai trò |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` được khai báo là phụ thuộc bắt buộc (hard dependency) |
| `mt_eval_harness/tester.py` | Import sacrebleu trực tiếp (không có bộ bảo vệ `HAS_SACREBLEU`); tính toán các CI theo từng lần chạy |
| `mt_eval_harness/significance.py` | Các kiểm định theo cặp (`paired_approximate_randomization`, mặc định, và `paired_bootstrap`), `SignificanceResult`, các hàm chỉ số tích hợp sẵn (chrF++, BLEU, spBLEU, TER, COMET từ điểm theo từng phân đoạn đã lưu trong cache, khớp chính xác; điểm tổng hợp cấp phân đoạn đã ngừng dùng chỉ được giữ lại để đọc các tệp so sánh cũ), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Khoảng tin cậy bootstrap: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Export `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Các kiểm định ý nghĩa thống kê được tích hợp vào tính năng so sánh báo cáo |
| `mt_eval_harness/cli.py` | Các cờ `--significance` / `--method` / `--n-bootstrap` (so sánh) và `--no-ci` / `--n-bootstrap-ci` (kiểm thử) |
| `mt_eval_harness/dashboard.py` | Hiển thị mức ý nghĩa thống kê trong bảng so sánh (tiện ích mở rộng tùy chọn) |

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

Các chỉ số cấp ngữ liệu có tính tất định (deterministic) được tính toán bởi harness:
- `corpus_chrf` (điểm chrF++)
- `corpus_bleu` (điểm BLEU)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (khi có dữ liệu FST)


Khoảng tin cậy chrF++ là một phần của chỉ số tiêu đề (headline) được công bố (`chrF++ 47.5 [45.9, 49.0]`). Các CI **cũng** được tính cho `comet_score`, được bootstrap từ điểm theo từng mục đã lưu trong bộ nhớ đệm (không cần suy luận mạng neural thừa thãi). Không có CI tổng hợp nào được tính cho các lần chạy mới; CI tổng hợp đã lưu của thẻ cũ chỉ được tính lại khi thẻ đó được xác minh.

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

### COMET (chỉ số tiêu chuẩn khi được tính toán, bên cạnh chrF++)

COMET là một **chỉ số neural hiển thị bên cạnh tiêu đề chrF++** bất cứ khi nào nó được tính toán, cùng với model id của nó. Nó không bao giờ được trộn lẫn với chrF++, và không phải là chỉ số tiêu đề vì nó cần một mô hình lớn và chưa được hiệu chuẩn cho hầu hết các ngôn ngữ ít tài nguyên (xem [Scoring Specification §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Các CI bootstrap được tính toán trên điểm số theo từng mục đã lưu trong bộ nhớ đệm:
- Mô hình: `Unbabel/wmt22-comet-da` (mô hình dựa trên tham chiếu của WMT 2022); AfriCOMET được tự động chọn cho các ngôn ngữ châu Phi được hỗ trợ
- Được tính khi `unbabel-comet` đã được cài đặt
- Điểm theo từng mục được lưu trữ trong các mục TestReport; giá trị cấp ngữ liệu có kèm cảnh báo hiệu chuẩn cho ngôn ngữ ít tài nguyên
- Được verifier tính toán lại — giá trị COMET được báo cáo phải có khả năng tái tạo
- Phụ thuộc tùy chọn: `python3 -m pip install 'mt-eval-harness[comet]'` (hoặc `mt-eval setup --comet`)

### Các cột Supabase

Bảng `run_cards` chứa các cột nullable tương ứng (xem [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — chỉ số tiêu đề và khoảng tin cậy 95% của nó
- `comet_score` (`real`) — hiển thị bên cạnh chỉ số tiêu đề, không bao giờ trộn lẫn
- `corpus_bleu` (`real`)

Tập hợp đầy đủ các khoảng tin cậy được lưu trữ bên trong JSON `scores` của run-card dưới khóa `confidence_intervals` (theo schema của run-card trong scoring.md §9); chỉ có các giới hạn của chrF++ là được phi chuẩn hóa (denormalized) thành các cột riêng.
