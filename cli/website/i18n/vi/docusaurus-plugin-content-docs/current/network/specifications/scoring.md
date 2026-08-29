---
sidebar_position: 5
title: "Thông số kỹ thuật chấm điểm"
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

# Tài liệu Đặc tả Chấm điểm (Scoring Specification)

> **Tóm tắt tổng quan.** Đây là nguồn chân lý duy nhất cho tất cả các chỉ số đánh giá, chấm điểm tổng hợp, cấp độ chất lượng và phân tích chi phí trong hệ sinh thái đánh giá MT của Champollion. Các chỉ số đánh giá đặc thù theo ngôn ngữ — tính hợp lệ hình thái FST, các lớp tương đương linter và xác thực ngữ nghĩa tất định — được gọi chung là **LYSS** (Linguistically-informed Yield & Structural Scoring). Mọi chỉ số được tính toán bởi harness, mọi trọng số trong công thức tổng hợp và mọi ngưỡng cấp độ đều được định nghĩa tại đây — và chỉ tại đây. Mã nguồn, tài liệu và lược đồ cơ sở dữ liệu đều bắt nguồn từ tài liệu này. Khi có xung đột, tài liệu này có giá trị quyết định.
>
> **Phạm vi.** Tài liệu này định nghĩa *những gì* chúng tôi đo lường và *cách chúng tôi chấm điểm*. Tài liệu này không định nghĩa lược đồ run card (xem BENCHMARK_SPEC §3), giao thức benchmark (BENCHMARK_SPEC §6), hoặc các quy tắc của bảng xếp hạng (xem tài liệu arena). Các tài liệu đó tham chiếu đến tài liệu này để biết các định nghĩa về chỉ số và logic chấm điểm.


---

## 1. Triết lý Chấm điểm

### 1.1 Triết lý Microeval

> *"Nếu chúng ta chỉ tập trung vào những gì có tính khái quát hóa, chúng ta sẽ vô tình quên đi những nơi mà nó không thể áp dụng — và đánh mất các ngôn ngữ này cùng với tất cả tri thức và trí tuệ của chúng."*

Dự án này thực hành **phát triển microeval**: xây dựng các chỉ số đánh giá được thiết kế riêng cho các ngôn ngữ cụ thể bằng cách sử dụng các công cụ ngôn ngữ học tốt nhất hiện có — bộ chuyển đổi trạng thái hữu hạn (finite-state transducers - FST), từ điển song ngữ, bộ phân tích hình thái, các quy tắc tương đương do các nhà ngôn ngữ học tuyển chọn. Điều này trái ngược với mô hình thống trị trong đánh giá dịch máy (MT), vốn tìm kiếm các chỉ số phổ quát hoạt động trên mọi ngôn ngữ. Các chỉ số phổ quát rất có giá trị, nhưng chúng lại yếu nhất ở chính những nơi cần chúng nhất: đối với các ngôn ngữ có hình thái phức tạp, dữ liệu huấn luyện hạn chế và không có đại diện trong các tập huấn luyện chỉ số neural.

Chúng ta chưa đạt được nhiều tiến bộ trong dịch máy cho nhiều ngôn ngữ trên thế giới không chỉ vì thiếu ngữ liệu, mà còn vì **chúng ta thậm chí không biết tiến bộ trông như thế nào** — chúng ta thiếu các công cụ đánh giá tự động để đo lường xem một hệ thống dịch thuật có đang cải thiện hay không. LYSS là nỗ lực của chúng tôi nhằm xây dựng các công cụ đó, theo từng ngôn ngữ, sử dụng bất kỳ tài nguyên ngôn ngữ nào hiện có.

### 1.2 Chỉ số Tự động là các Chỉ số Đại diện (Proxies)

Mọi chỉ số được định nghĩa ở đây đều được tính toán bằng máy. Chúng hữu ích cho việc lặp nhanh, so sánh hệ thống và phát hiện lỗi suy thoái (regressions). Chúng **không thay thế cho đánh giá của con người**. Các phân hạng chất lượng trong §5 là các nhãn heuristic — chỉ có sự đánh giá của con người mới có thể xác nhận khả năng sử dụng thực tế.

### 1.3 Thiết kế Đa Tín hiệu (Multi-Signal)

Không có một chỉ số đơn lẻ nào nắm bắt được toàn bộ chất lượng dịch thuật. Một bản dịch có thể có độ trùng lặp chrF++ hoàn hảo nhưng lại thất bại trong việc xác thực hình thái. Nó có thể vượt qua các kiểm tra FST nhưng lại mang sai nghĩa. Nó có thể chính xác về mặt ngữ nghĩa nhưng lại xa lạ về mặt phong cách đối với ngôn ngữ đích. Điểm số tổng hợp trong §4 tổng hợp nhiều tín hiệu độc lập, mỗi tín hiệu nắm bắt một khía cạnh chất lượng khác nhau.

### 1.4 Tính Mở rộng

Danh mục chỉ số này không khép kín. Các ngôn ngữ mới mang lại các yêu cầu mới: độ chính xác của thanh điệu đối với các ngôn ngữ có thanh điệu, độ chính xác của dấu phụ đối với các chữ viết Semit, tính chính xác của bảng âm tiết đối với tiếng Cree. Kiến trúc (giao thức MetricPlugin, tổng hợp có trọng số với việc chuẩn hóa lại) được thiết kế để các chỉ số có thể được thêm vào mà không làm ảnh hưởng đến các điểm số hiện có. Các chỉ số đặc thù theo ngôn ngữ (ví dụ: linter và bộ xác thực ngữ nghĩa của CRK) được khai báo trên các thẻ ngôn ngữ dưới `evalMetrics` và được tải từ `eval_standards/` — hệ thống kiểm thử chỉ đi kèm với các chỉ số hành vi chung (chuyển mã - code-switching, ảo tưởng - hallucination, thuật ngữ).

### 1.5 Ba Khía cạnh Đánh giá

Mỗi thẻ chạy đo lường ba khía cạnh độc lập:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

Đây là các trục độc lập. Một phương pháp có thể có chất lượng cao nhưng đắt đỏ, nhanh nhưng không chính xác, hoặc bất kỳ sự kết hợp nào. Bảng xếp hạng cho phép sắp xếp theo bất kỳ khía cạnh nào. Điểm số điều chỉnh theo chi phí (§6.3) là chỉ số duy nhất kết hợp các khía cạnh này.

### 1.6 Trạng thái Xác thực (Validation Status)

Mỗi chỉ số trong đặc tả này có một **trạng thái xác thực** khác biệt với trạng thái triển khai của nó (§3). Trạng thái triển khai theo dõi xem mã nguồn đã tồn tại hay chưa. Trạng thái xác thực theo dõi xem chỉ số đó đã được chứng minh là có tương quan với các đánh giá chất lượng của con người hay chưa.

| Cấp độ Xác thực | Ý nghĩa | Các Chỉ số Hiện tại |
|-----------------|---------|---------------------|
| **✅ Đã được xác thực bên ngoài** | Đã có các nghiên cứu tương quan với con người được công bố (WMT, các bài báo học thuật) | `chrf_plus_plus`, `bleu`, `comet_score` *(chỉ dành cho các cặp ngôn ngữ tài nguyên cao)* |
| **⚡ Xác thực đại diện (Proxy-validated)** | Đã được xác thực cho các ngôn ngữ tài nguyên cao; chưa được xác thực cho các ngôn ngữ tài nguyên thấp (LRL) mục tiêu của chúng tôi | `comet_score` *(đối với LRL: được xác thực trên các cặp ngôn ngữ tài nguyên cao/EU, ngoại suy cho ví dụ: CRK — hữu ích về mặt định hướng nhưng chưa được hiệu chuẩn)* |

> **Tại sao `comet_score` xuất hiện ở hai hàng.** Đây là sự phân chia theo mức độ tài nguyên, không phải là một sự mâu thuẫn. COMET được *xác thực bên ngoài* ở những nơi có các nghiên cứu tương quan với con người của WMT — các cặp ngôn ngữ tài nguyên cao, chủ yếu là châu Âu. Đối với các ngôn ngữ tài nguyên thấp mục tiêu của chúng tôi, không có các nghiên cứu như vậy, vì vậy cùng một chỉ số đó chỉ được *xác thực đại diện*: mô hình ngoại suy từ các ngôn ngữ có hệ thống hình thái khác nhau. Đây cũng là lý do tại sao COMET được báo cáo trong một làn neural riêng biệt và không bao giờ được gộp vào điểm tổng hợp (§4.3).
| **🔶 Heuristic kỹ thuật** | Được thiết kế từ các nguyên lý ngôn ngữ học hoặc các dạng lỗi quan sát được; không có dữ liệu tương quan với con người | `fst_acceptance_rate`, `morphological_accuracy` (dẫn xuất từ FST, khớp bổ đề; **hoạt động** trong cấu hình tổng hợp fst-coverage, được bộ xác thực tính toán lại), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Chưa xác thực** | Chưa được thử nghiệm trên bất kỳ dữ liệu nào | `orthographic_accuracy`, `consistency_score` |

> **Điều này có ý nghĩa gì trong thực tế.** Điểm số tổng hợp (§4) gộp các chỉ số ở tất cả các cấp độ xác thực. Đây là một lựa chọn thiết kế rõ ràng: chúng tôi tin rằng một heuristic kỹ thuật có cơ sở cấu trúc (sự chấp nhận của FST) sẽ cung cấp nhiều thông tin hơn cho các ngôn ngữ đa tổng hợp so với một chỉ số neural chỉ được xác thực trên các cặp ngôn ngữ châu Âu (COMET). Nhưng chúng tôi chưa chứng minh được điều này. Điểm số tổng hợp nên được coi là một **ước tính kỹ thuật**, không phải là một phép đo chất lượng đã được xác thực, cho đến khi các nghiên cứu tương quan với con người được hoàn thành cho từng ngôn ngữ mục tiêu.
>
> **Các thử nghiệm xác thực bắt buộc** (xem `mt-evaluation-landscape.md` §6 và `speaker-validation.md`):
> 1. Nghiên cứu tương quan đánh giá của con người: hơn 200 cặp câu được đánh giá bởi ít nhất 3 người nói song ngữ
> 2. Đo lường tỷ lệ từ chối sai của FST trên một ngữ liệu đại diện
> 3. Chuyển cổng sang ngôn ngữ thứ hai (North Sámi) để kiểm tra tính khái quát hóa
> 4. So sánh trực tiếp với COMET trên cùng một dữ liệu


---

## 2. Danh mục Chỉ số {#2-metric-inventory}

Các chỉ số được tổ chức thành sáu danh mục (bề mặt, cấu trúc, ngữ nghĩa, hành vi, tuân thủ và các bộ so sánh được báo cáo). Mỗi chỉ số có một trạng thái triển khai, thang đo và cấp độ (theo từng mục, cấp độ ngữ liệu hoặc cả hai).

### 2.1 Chỉ số Bề mặt (Surface Metrics)

Các chỉ số bề mặt so sánh bản dịch dự đoán với bản dịch tham chiếu ở cấp độ chuỗi ký tự. Chúng không yêu cầu các công cụ ngôn ngữ học — chỉ so sánh chuỗi.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|------------|----------|--------|------------|
| `exact_match_rate` | Khớp Chính xác | ✅ Đã triển khai | 0.0–1.0 | Cả hai | Nhị phân: dự đoán == tham chiếu? Tỷ lệ ngữ liệu = số khớp / tổng số. |
| `equivalent_match_rate` | Khớp Tương đương | ⚡ Một phần | 0.0–1.0 | Cả hai | Đầu ra dự đoán có khớp với bất kỳ biến thể nào được chấp nhận không? Đối với CRK: được triển khai thông qua tiêu chuẩn đánh giá CRK `CrkLinterMetric` (trong `eval_standards/crk/`) sử dụng các quy tắc lớp biến thể tất định (trật tự từ, chính tả, tiểu từ tùy chọn, từ đồng nghĩa bổ đề, tính mơ hồ tiếp diễn). Được tải tự động thông qua khai báo `evalMetrics` của thẻ ngôn ngữ CRK. Triển khai chung liên ngôn ngữ yêu cầu `variants[]` theo từng mục trong ngữ liệu. |
| `chrf_plus_plus` | chrF++ | ✅ Đã triển khai | 0–100 | Cả hai | Điểm F n-gram ký tự (sacrebleu). Kháng lỗi biến đổi hình thái tốt. Chỉ số bề mặt chính cho các ngôn ngữ chắp dính/đa tổng hợp. Theo từng mục sử dụng `sentence_chrf`; ngữ liệu sử dụng `corpus_chrf`. |
| `bleu` | BLEU | ✅ Đã triển khai | 0–100 | Ngữ liệu | Độ chính xác n-gram cấp từ (sacrebleu). **Bị loại trừ khỏi điểm tổng hợp** — việc chấm điểm cấp từ phạt các biến thể hình thái một cách không công bằng. Được tính toán và báo cáo để tương thích với tài liệu MT. |
| `ter` | Tỷ lệ Lỗi Dịch thuật (TER) | ✅ Đã triển khai | 0–∞ (thấp hơn là tốt hơn) | Cả hai | Khoảng cách chỉnh sửa tối thiểu giữa dự đoán và tham chiếu, được chuẩn hóa theo độ dài tham chiếu (sacrebleu `corpus_ter`). Được tính toán cùng với chrF++ và BLEU. Bị loại trừ khỏi điểm tổng hợp — tương quan với chrF++ nên việc bao gồm cả hai sẽ tính trùng lặp độ tương đồng bề mặt. |
| `length_ratio` | Tỷ lệ Độ dài | ✅ Đã triển khai | 0–∞ (1.0 là lý tưởng) | Cả hai | `len(predicted) / len(reference)` theo ký tự. Phát hiện việc cắt ngắn (<0.5) và thổi phồng/ảo tưởng (>2.0). Được trung bình hóa trên các mục ở cấp độ ngữ liệu. |

### 2.2 Chỉ số Cấu trúc (Structural Metrics)

Các chỉ số cấu trúc xác thực tính đúng đắn về mặt ngôn ngữ học của bản dịch. Chúng yêu cầu các công cụ đặc thù theo ngôn ngữ (bộ phân tích FST, bộ phân tích cú pháp hình thái) và là các tín hiệu mạnh nhất cho các ngôn ngữ giàu hình thái.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|------------|----------|--------|------------|
| `fst_acceptance_rate` | Sự Chấp nhận của FST | ✅ Đã triển khai | 0.0–1.0 | Cả hai | Tỷ lệ các từ đầu ra được chấp nhận bởi một bộ chuyển đổi trạng thái hữu hạn (GiellaLT). Một từ là "hợp lệ" nếu FST trả về ít nhất một phân tích hình thái. Khả dụng cho bất kỳ ngôn ngữ nào có bộ phân tích GiellaLT `.hfstol`. |
| `morphological_accuracy` | Độ chính xác Hình thái | ✅ Hoạt động (cấu hình fst-coverage; được bộ xác thực tính toán lại) | 0.0–1.0 | Cả hai | Một từ có thể hợp lệ về mặt FST nhưng lại có biến hình sai (đúng gốc từ, sai hậu tố). **Được tính toán** bởi `plugins/giellalt_fst.py`: đối với mỗi từ dự đoán có thể phân tích được, tìm một từ tham chiếu có chung **bổ đề** (gốc từ) của nó và kiểm tra xem **biến hình** dự đoán (các thẻ đặc trưng FST) có khớp hay không. Việc khớp theo bổ đề — không phải theo vị trí — giúp tránh việc căn chỉnh từ: một lựa chọn từ khác hoặc một cặp không căn chỉnh đơn giản là không được *bao phủ* (không bao giờ bị chấm điểm sai). **Không cần nhãn gold** — phân tích FST của tham chiếu chính là ground truth. Các từ mà FST không thể phân tích, hoặc gốc từ của chúng không có trong tham chiếu, nằm ngoài phạm vi bao phủ; `morph_coverage` (tỷ lệ khớp bổ đề) được tiết lộ, và chỉ số này chỉ đi vào điểm tổng hợp khi độ bao phủ ≥ `MORPH_COVERAGE_FLOOR` (0.25) — dưới mức sàn này nó chỉ mang tính chất tham khảo. Nó **khoan dung dưới tính mơ hồ của FST** (một từ dự đoán có nhiều phân tích là "đúng" nếu *bất kỳ* phân tích nào khớp → một giới hạn trên, được tiết lộ). Nó mang **trọng số 0.15** trong cấu hình fst-coverage và được **bộ xác thực tính toán lại** đối với ngữ liệu chuẩn (`verifier.recompute_corpus_morph`, chạy lại FST được ghim trên thẻ — đóng nếu thiếu FST, cùng giao ước như COMET). Được kích hoạt vào ngày 2026-06-16 (áp dụng migration 029 cho môi trường dev + prod). |
| `orthographic_accuracy` | Độ chính xác Chính tả | 🔲 Đang lên kế hoạch | 0.0–1.0 | Cả hai | Xác thực tính chính xác đặc thù của chữ viết: cách sử dụng macron/circumflex SRO cho tiếng Cree, các dấu phụ cho tiếng Inuktitut, các dấu độ dài nguyên âm cho tiếng Ojibwe. Các bộ quy tắc theo từng ngôn ngữ. |

> **Tại sao các chỉ số cấu trúc lại quan trọng.** OMT-1600 của Meta — hệ thống MT lớn nhất từng được công bố (1.600 ngôn ngữ; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — đánh giá bằng ChrF++, xCOMET, MetricX và BLASER 3. Không có công cụ nào trong số này xác thực tính chính xác về mặt hình thái. ChrF++ đo lường sự trùng lặp n-gram ký tự: nó thưởng cho các chuỗi ký tự *trông có vẻ* giống với ngôn ngữ đích. Đối với các ngôn ngữ đa tổng hợp, điều này có nghĩa là một từ không hợp lệ về mặt hình thái nhưng có nhiều ký tự trùng khớp với bản tham chiếu vẫn đạt điểm cao. Chỉ số chấp nhận FST của chúng tôi là một bài kiểm tra cấu trúc nhị phân: từ đó hoặc là một dạng hợp lệ trong ngôn ngữ, hoặc là không. Không có khung đánh giá MT nào khác cung cấp điều này ở quy mô lớn. ChrF++ cũng có một **mức sàn cơ hội khác không** (nonzero chance floor) khác nhau tùy theo hệ thống chữ viết — văn bản ngẫu nhiên cùng hệ chữ viết có điểm số cao hơn mức không một cách rõ rệt, ở một số hệ thống chữ viết nhiều hơn những hệ thống khác — vì vậy chrF++ thô không thể so sánh trực tiếp giữa các ngôn ngữ; bản đồ mạng khắc phục điều này bằng [chrF++ hiệu chỉnh theo cơ hội (cchrF++)](/docs/network/specifications/connection-strength).

### 2.3 Chỉ số Ngữ nghĩa (Semantic Metrics)

Các chỉ số ngữ nghĩa đo lường sự bảo toàn ý nghĩa bằng cách sử dụng các embedding hoặc các mô hình đã được huấn luyện. Chúng phát hiện các bản dịch khác nhau về bề mặt nhưng tương đương về ý nghĩa, và gắn cờ các bản dịch tương đồng về bề mặt nhưng sai về ngữ nghĩa.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|------------|----------|--------|------------|
| `semantic_score` | Độ tương đồng Ngữ nghĩa | ⚡ Một phần | 0.0–1.0 | Cả hai | CRK: điểm số được tính trọng số theo phán quyết từ tiêu chuẩn đánh giá CRK `CrkSemanticMetric` (trong `eval_standards/crk/`, đại diện). Phổ quát: độ tương đồng cosine của các embedding câu (nguồn + dự đoán so với nguồn + tham chiếu). Mô hình sẽ được xác định sau — phải hỗ trợ các ngôn ngữ tài nguyên thấp, điều này loại trừ hầu hết các mô hình embedding tập trung vào tiếng Anh. |
| `comet_score` | COMET | ✅ Đã triển khai | ~0.0–1.0 | Cả hai | Chỉ số đánh giá MT dựa trên học máy (Unbabel). **Được tính toán và báo cáo RIÊNG BIỆT — không bao giờ nằm trong bất kỳ điểm tổng hợp nào** (điểm tổng hợp là tất định; §4.3). Được bộ xác thực tính toán lại, vì vậy một giá trị được báo cáo phải có khả năng tái lập. Được gắn cờ với cảnh báo hiệu chuẩn tài nguyên thấp cho các ngôn ngữ như Plains Cree. Được tính toán khi `unbabel-comet` được cài đặt. Đối với 35 ngôn ngữ châu Phi, hệ thống kiểm thử tự động chọn AfriCOMET (`masakhane/africomet-mtl`) thông qua `resolve_comet_model()`, vốn có tương quan đánh giá của con người tốt hơn cho các ngôn ngữ đó. |

> **Tại sao COMET được báo cáo riêng biệt, không gộp chung.** COMET được huấn luyện trên dữ liệu đánh giá của con người từ WMT, phần lớn là các cặp ngôn ngữ châu Âu tài nguyên cao. Khi áp dụng cho Plains Cree hoặc các LRL khác, mô hình sẽ ngoại suy từ các ngôn ngữ có hệ thống hình thái khác nhau — hữu ích về mặt định hướng nhưng không được hiệu chuẩn. Thay vì gộp một tín hiệu phụ thuộc vào mô hình, được xác thực không đồng đều vào điểm số tiêu đề, điểm tổng hợp được giữ **tất định** (chỉ gồm các chỉ số có thể tái lập bởi bộ xác thực) và COMET/AfriCOMET được báo cáo trong một **làn neural riêng biệt** (§4.3), được bộ xác thực tính toán lại. Một điểm tổng hợp neural có thể được thêm vào sau, khi đã được xác thực.
>
> **COMET tài nguyên cao được báo cáo, không gộp chung (theo thiết kế).** Đối với các cặp ngôn ngữ thực sự có tài nguyên cao (tiếng Đức, tiếng Pháp, ...), `Unbabel/wmt22-comet-da` mặc định đã được xác thực tốt bởi WMT, và `resolve_comet_model()` sẽ chọn nó. Nhưng COMET **không** được gộp vào bất kỳ điểm tổng hợp nào — nó được tính toán và hiển thị trong làn neural riêng biệt giống như mọi chỉ số neural khác, và được bộ xác thực tính toán lại. Việc giữ cho điểm tổng hợp có tính tất định giúp tránh việc bắt buộc phải sử dụng một chỉ số phụ thuộc vào mô hình nặng 2.3 GB cho khoảng hơn 100 ngôn ngữ mang `metricModelSupport.xlmr.tier: "high"`, và giữ cho điểm số tiêu đề có thể tái lập chỉ từ ngữ liệu.

> **AfriCOMET cho các ngôn ngữ châu Phi.** Mỗi thẻ ngôn ngữ có một trường `metricModelSupport` (xem đặc tả thẻ ngôn ngữ §9) khai báo mô hình COMET chuyên biệt nào được huấn luyện cho ngôn ngữ đó. Đối với 35 ngôn ngữ châu Phi (yor, hau, ibo, amh, swa, v.v.), thẻ khai báo AfriCOMET (`masakhane/africomet-mtl`) — một mô hình COMET được tinh chỉnh trên các đánh giá của con người về dịch máy ngôn ngữ châu Phi bởi cộng đồng Masakhane. Hệ thống kiểm thử tự động chọn mô hình được đề xuất thông qua `resolve_comet_model()` đọc từ các thẻ ngôn ngữ, nhưng điều này có thể được ghi đè bằng `--comet-model`. Việc thêm các ánh xạ ngôn ngữ→mô hình mới được thực hiện bằng cách làm phong phú thẻ ngôn ngữ (không phải chỉnh sửa mã nguồn Python).

### 2.4 Chỉ số Hành vi (Behavioral Metrics)

Các chỉ số hành vi phát hiện các dạng lỗi cụ thể trong đầu ra dịch thuật. Chúng không đo lường trực tiếp chất lượng — chúng phát hiện các vấn đề.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|------------|----------|--------|------------|
| `code_switching_rate` | Tỷ lệ Chuyển mã | ✅ Đã triển khai | 0.0–1.0 (thấp hơn là tốt hơn) | Cả hai | Tỷ lệ các từ đầu ra thuộc ngôn ngữ nguồn (thường là tiếng Anh). Được phát hiện thông qua phân tích chữ viết Unicode và/hoặc danh sách từ ngôn ngữ nguồn. Dạng lỗi rất phổ biến của LLM: mô hình chèn các từ tiếng Anh khi nó không biết từ tương đương trong ngôn ngữ đích. |
| `hallucination_rate` | Tỷ lệ Ảo tưởng | ✅ Đã triển khai | 0.0–1.0 (thấp hơn là tốt hơn) | Cả hai | Tỷ lệ nội dung đầu ra không có nội dung tương ứng trong nguồn. Được phát hiện thông qua căn chỉnh từ hoặc sự trùng lặp embedding liên ngôn ngữ. Phát hiện việc mô hình tạo ra các bản dịch nghe có vẻ hợp lý nhưng là bịa đặt. |
| `terminology_adherence` | Tuân thủ Thuật ngữ | ✅ Đã triển khai | 0.0–1.0 | Cả hai | Đối với các phương pháp có hướng dẫn (coached): tỷ lệ các thuật ngữ được quy định xuất hiện trong đầu ra. Yêu cầu dữ liệu từ điển hướng dẫn. Đo lường xem mô hình có tôn trọng từ vựng do chuyên gia cung cấp hay không. |
| `consistency_score` | Tính Nhất quán Liên mục | 🔲 Đang lên kế hoạch | 0.0–1.0 | Chỉ ngữ liệu | Mô hình có dịch cùng một thuật ngữ nguồn theo cùng một cách trên các mục khác nhau không? Tính nhất quán thấp gợi ý rằng mô hình đang đoán mò thay vì áp dụng các mẫu đã học. Yêu cầu các thuật ngữ lặp lại trên các mục ngữ liệu. |

### 2.5 Chỉ số Tuân thủ (Compliance Metrics)

Các chỉ số tuân thủ xác thực rằng các bản dịch bảo toàn tính toàn vẹn cấu trúc — các trình giữ chỗ (placeholders), định dạng và các quy ước trình bày. Chúng là các kiểm tra cổng chất lượng, không phải là điểm số chất lượng.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|------------|----------|--------|------------|
| `compliance_index` | Tuân thủ Double-Pass | ✅ Đã triển khai | 0.0–1.0 | Cả hai | Điểm tổng hợp có trọng số: 60% tính toàn vẹn của biến (các biến `{placeholder}` có được bảo toàn không?) + 20% tuân thủ dấu ngoặc kép (ký tự ngoặc kép chính xác theo thẻ ngôn ngữ) + 20% tuân thủ viết hoa (không rò rỉ chữ cái Latinh cho các ngôn ngữ không phân biệt chữ hoa chữ thường). Được tính toán trên cả đầu ra thô và đầu ra sau xử lý. Thông qua `DoublePassCompliancePlugin`. |
| `repair_effectiveness` | Hiệu quả Sửa lỗi | ✅ Đã triển khai | 0.0–1.0 | Ngữ liệu | Tỷ lệ các vi phạm tuân thủ đã được tự động sửa chữa bởi các hook sau dịch thuật. Đo lường mức độ cải thiện của cổng chất lượng đối với đầu ra thô. |

> **Tại sao tính tuân thủ không nằm trong điểm tổng hợp.** Các chỉ số tuân thủ đo lường việc bảo toàn cấu trúc (trình giữ chỗ, dấu ngoặc kép), không phải chất lượng dịch thuật. Một bản dịch có thể hoàn hảo về mặt ngôn ngữ học nhưng lại thất bại trong việc tuân thủ vì nó làm mất một biến `{name}`. Đây là các cổng chất lượng — chúng chặn đầu ra xấu không cho xuất bản, nhưng chúng không xếp hạng chất lượng dịch thuật.

### 2.6 Các bộ so sánh được báo cáo (KHÔNG BAO GIỜ nằm trong điểm tổng hợp)

Các chỉ số này chỉ được báo cáo để cung cấp ngữ cảnh/so sánh và không bao giờ đi vào bất kỳ cấu hình tổng hợp nào:

| ID | Chỉ số | Trạng thái | Ghi chú |
|----|--------|------------|---------|
| `spbleu` | spBLEU (bộ phân tách từ FLORES-200) | ✅ Đã triển khai | BLEU trên phân tách từ SentencePiece của FLORES-200 — có thể so sánh giữa các chữ viết/phân đoạn khác nhau (ngôn ngữ chung của NLLB/FLORES). Cần `sentencepiece` (phụ thuộc cốt lõi). |
| `chrf_plain` | chrF thuần túy (`word_order=0`) | ✅ Đã triển khai | Chỉ số chrF mà các bảng FLORES/WMT báo cáo, bên cạnh chrF++ của chúng tôi (`word_order=2`). |
| `fuse_score` | Bộ so sánh kiểu FUSE | ⚡ Tùy chọn (`--fuse`) | Một **triển khai lại CHƯA ĐƯỢC HUẤN LUYỆN** của phương pháp FUSE AmericasNLP-2025 (Raja & Vats): ngữ nghĩa LaBSE + F1 token từ vựng + Soundex ngữ âm + fuzzy difflib, được trộn dưới dạng *trung bình không trọng số* (chúng tôi không có dữ liệu huấn luyện đánh giá của con người để khớp với Ridge/GBM gốc, và đã nêu rõ điều đó). LaBSE/Soundex là phần bổ sung tùy chọn `fuse`; không có LaBSE, `compute_fuse` trả về `None` (được tiết lộ) thay vì giả mạo điểm số. Mỗi thành phần đã chạy được liệt kê trong `fuse_components`; kết quả được gắn cờ `fuse_untrained=true`. Cho phép bảng xếp hạng hiển thị điểm số cấu trúc/gated-FST so với một baseline kiểu FUSE. |

### 2.7 Không gian tên Chỉ số (Metric Namespaces) {#2-7-metric-namespaces}

Một chỉ số đơn lẻ mang tối đa bốn tên phối hợp trên toàn bộ hệ thống:
**id chuẩn** (khóa `scores` trong thẻ chạy, ví dụ: `equivalent_match_rate`),
**tên plugin** Python tính toán nó (ví dụ: `crk_linter`),
**khóa `evalMetrics`** của thẻ ngôn ngữ khai báo nó (ví dụ: `lyss-eq`), và
**cột `run_cards`** đã được phi chuẩn hóa trên bảng xếp hạng (ví dụ: `equivalent_match_rate`). Chúng
được phân biệt một cách có chủ ý — tên plugin nêu rõ *công cụ*, id chỉ số nêu rõ
*phép đo* — nhưng chúng phải luôn đồng bộ với nhau.

Nguồn thông tin xác thực duy nhất cho ánh xạ đó là `shared/metric-registry.json`, được tải
bởi `mt_eval_harness.metric_manifest`. Mỗi mục ghi lại bốn tên cùng với `scale`,
`direction` (cao hơn/thấp hơn/trung tính), `level` (mục/ngữ liệu/cả hai), `in_composite`, và
`verifier_reproducible`. Kiểm tra tính tương đồng `arena/tests/test_metric_registry_ssot.py`
sẽ thất bại nếu các bảng trọng số của `scoring.py` hoặc các khóa `scores` của thẻ chạy được tạo bởi
`publish.py` bị lệch khỏi registry, vì vậy một chỉ số mới không thể được phát hành khi chưa được kết nối hoàn chỉnh.

Hai trường thẻ chạy liên quan giúp làm rõ nguồn gốc chỉ số:

- **`scores.metric_availability`** — một khối `{metric: reason}` giúp phân biệt một
  điểm số `null`: `not_applicable` (ngôn ngữ/lượt chạy không sử dụng nó), `unavailable`
  (thiếu một phụ thuộc tùy chọn), `below_coverage_floor` (có mặt nhưng quá
  thưa thớt để đưa vào điểm tổng hợp), `not_run` (tùy chọn và không được yêu cầu), hoặc
  `not_implemented` (đang lên kế hoạch). Một chỉ số vắng mặt trong khối này đã được tính toán bình thường.
- **`fst_version`** / **`fst_provenance`** — phiên bản bộ chuyển đổi GiellaLT được cài đặt
  và phiên bản `pyhfst` đằng sau bất kỳ chỉ số nào dẫn xuất từ FST, được ghi lại cùng cách
  như chữ ký sacreBLEU để một điểm số cấu trúc có thể được truy nguyên đến một bản build bộ phân tích chính xác.

---

## 3. Các Phân hạng Trạng thái Chỉ số

Mọi chỉ số trong §2 đều rơi vào một trong bốn phân hạng triển khai:

| Phân hạng | Ý nghĩa | Hành vi trên Thẻ Chạy |
|-----------|---------|-----------------------|
| **✅ Đã triển khai** | Mã nguồn đã tồn tại, đã được kiểm thử, đang tạo ra các giá trị trong thẻ chạy hiện nay | Giá trị số trong thẻ chạy |
| **⚡ Một phần** | Chỉ số đại diện đặc thù theo ngôn ngữ đã tồn tại (ví dụ: CRK) nhưng việc triển khai phổ quát vẫn đang chờ xử lý | Giá trị số khi chỉ số đại diện được áp dụng, `null` nếu ngược lại |
| **🔲 Đang lên kế hoạch** | Đã được đặc tả nhưng chưa được triển khai | `null` trong thẻ chạy (trường có mặt, giá trị vắng mặt) |
| **💡 Được đề xuất** | Đang được thảo luận, chưa được đặc tả | Không có trong thẻ chạy |

Một chỉ số chuyển từ Đang lên kế hoạch → Một phần khi:
1. Một triển khai đặc thù theo ngôn ngữ được merge và kiểm thử
2. Nó tạo ra các giá trị cho ít nhất một cặp ngôn ngữ
3. Triển khai phổ quát vẫn đang chờ xử lý (được ghi nhận trong đặc tả này)

Một chỉ số chuyển từ Một phần → Đã triển khai khi:
1. Một triển khai không phụ thuộc vào ngôn ngữ được merge và kiểm thử
2. Nó tạo ra các giá trị cho bất kỳ cặp ngôn ngữ nào mà không cần các plugin đặc thù theo ngôn ngữ
3. Tài liệu này được cập nhật để phản ánh trạng thái ✅

Một chỉ số chuyển từ Đang lên kế hoạch → Đã triển khai khi:
1. Triển khai được merge và kiểm thử
2. Nó đã được xác thực trên ít nhất một lượt chạy benchmark thực tế
3. Tài liệu này được cập nhật với các chi tiết triển khai của nó

Một chỉ số chuyển từ Được đề xuất → Đang lên kế hoạch khi:
1. Định nghĩa, thang đo và phương pháp tính toán của nó được thống nhất
2. Nó được thêm vào tài liệu này với trạng thái `🔲 Planned`
3. Một trình giữ chỗ null được thêm vào lược đồ thẻ chạy

---

## 4. Điểm số Tổng hợp (Composite Score) {#4-composite-score}

> [!CAUTION]
> **Điểm số tổng hợp mang tính THỬ NGHIỆM và CHƯA ĐƯỢC XÁC THỰC.** Đây là một điểm số gộp có trọng số của các chỉ số *mang ý nghĩa khác nhau đối với các ngôn ngữ khác nhau*, với các trọng số là **đánh giá kỹ thuật, không phải được khớp thực nghiệm với các đánh giá chất lượng của con người**. Không có nghiên cứu tương quan với con người nào bảo chứng cho việc tính trọng số cho bất kỳ ngôn ngữ mục tiêu nào. Hãy coi nó như một khóa sắp xếp tiện lợi thô sơ, **không bao giờ** coi nó là một phép đo chất lượng hoặc một tuyên bố rằng hệ thống này "tốt hơn" hệ thống kia. Tín hiệu thực sự là **cấu hình theo từng chỉ số** — mỗi chỉ số được hiển thị với giá trị và phân hạng xác thực của nó (§1.6). Điểm tổng hợp được dán nhãn "thử nghiệm — chưa được xác thực" ở bất kỳ nơi nào nó xuất hiện (bao gồm cả bảng xếp hạng), và nó không bao giờ là tiêu chí cho bất kỳ giải thưởng nào. (Theo thiết kế.)

### 4.1 Công thức

Điểm số tổng hợp là trung bình cộng có trọng số của tất cả các chỉ số *khả dụng*, được chuẩn hóa lại sao cho tổng trọng số của các chỉ số khả dụng bằng 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Một chỉ số được coi là "khả dụng" nếu giá trị của nó trong thẻ chạy là một con số (không phải `null`). Khi một chỉ số không khả dụng — vì ngôn ngữ đó không có FST, hoặc vì một chỉ số chưa được triển khai — trọng số của nó sẽ được phân bổ lại theo tỷ lệ cho các chỉ số còn lại.

**Điều này có nghĩa là điểm tổng hợp luôn có thể so sánh được trong cùng một lượt chạy:** nó sử dụng bất kỳ chỉ số nào khả dụng và chuẩn hóa tương ứng. Việc so sánh giữa các lượt chạy khác nhau là hợp lệ khi các lượt chạy đó sử dụng cùng một tập hợp các chỉ số khả dụng.

> [!WARNING]
> **Khả năng so sánh chéo giữa các lần chạy.** Khi so sánh các lần chạy có sự sẵn sàng của các chỉ số khác nhau (ví dụ: một lần chạy có điểm FST, lần chạy khác thì không), các điểm số tổng hợp **không thể so sánh trực tiếp**. Điểm tổng hợp 0.72 được tính từ 5 chỉ số mang nhiều thông tin hơn điểm tổng hợp 0.72 được tính từ 2 chỉ số. Tập hợp chỉ số chính xác của mỗi lần chạy đều có thể kiểm toán được: run card ghi lại `scores.scoring_profile` và `scores.metric_availability` (§2.7), và một chỉ số không được đo lường sẽ hiển thị là "—" trên bảng xếp hạng, không bao giờ là 0. Để so sánh chặt chẽ, chỉ sử dụng các kiểm định ý nghĩa bootstrap theo cặp (§8.2) trên các chỉ số chung.

### 4.2 Chuẩn hóa Đầu vào

Trước khi đưa vào công thức tổng hợp, tất cả các chỉ số phải được đưa về **thang đo 0.0–1.0** trong đó 1.0 = hoàn hảo:

| Chỉ số | Thang đo Gốc | Chuẩn hóa |
|--------|--------------|-----------|
| `exact_match_rate` | 0.0–1.0 | Không (đã được chuẩn hóa) |
| `equivalent_match_rate` | 0.0–1.0 | Không |
| `fst_acceptance_rate` | 0.0–1.0 | Không |
| `morphological_accuracy` | 0.0–1.0 | Không |
| `chrf_plus_plus` | 0–100 | **Chia cho 100** |
| `semantic_score` | 0.0–1.0 | Không |
| `code_switching_rate` | 0.0–1.0 (thấp hơn = tốt hơn) | **`1.0 - value`** (đảo ngược: 0% chuyển mã = 1.0) |
| `hallucination_rate` | 0.0–1.0 (thấp hơn = tốt hơn) | **`1.0 - value`** (đảo ngược) |
| `terminology_adherence` | 0.0–1.0 | Không |

Các chỉ số không nằm trong bất kỳ cấu hình tổng hợp nào (`bleu`, `ter`, `length_ratio`, `consistency_score`, và các chỉ số neural `comet_score`/`qe_score`) không được chuẩn hóa cho mục đích này. (Các chỉ số neural được báo cáo riêng biệt và không bao giờ đi vào điểm tổng hợp — §4.3.)

### 4.3 Các Bảng Trọng số {#43-weight-tables}

**Registry cấu hình được đặt tên (dựa trên thẻ).** Điểm tổng hợp không còn được chọn bởi một giá trị boolean `has_fst` duy nhất. Mỗi ngôn ngữ sẽ phân giải thành một **cấu hình được đặt tên** thông qua `language_cards.resolve_scoring_profile()`; cấu hình này chỉ định một bảng trọng số, được phản ánh trong `PROFILE_REGISTRY` của `scoring.py`. Một thẻ có thể khai báo `scoringProfile.basis` để ghi đè; khi vắng mặt, giá trị mặc định sẽ tái lập hành vi cũ (`fst-coverage` khi một FST chấm điểm lượt chạy, nếu không thì là `surface-only`). Cấu hình tạo ra mỗi điểm tổng hợp được ghi lại trên thẻ chạy dưới dạng `scores.scoring_profile`, nhờ đó việc tính trọng số có thể được kiểm toán trên từng hàng của bảng xếp hạng.

**Các chỉ số không hoạt động (được bảo lưu).** Một số chỉ số mang một trọng số *được khai báo* bên dưới nhưng chưa hoạt động, vì vậy chúng được liệt kê trong `scoring.INACTIVE_METRICS` và **bị loại trừ khỏi điểm tổng hợp** cho đến khi chúng được tính toán theo từng mục và có thể được chấm điểm lại bởi bộ xác thực (cổng tin cậy). Việc loại trừ một chỉ số vắng mặt không làm thay đổi điểm số nào — nó chỉ làm cho trạng thái "chưa chấm điểm" trở nên rõ ràng thay vì âm thầm bỏ qua. Hiện tại không hoạt động:

- `orthographic_accuracy` — cần các quy tắc chính tả theo từng ngôn ngữ (chưa được xây dựng).

(`morphological_accuracy` đã không hoạt động cho đến P5; **được kích hoạt vào ngày 2026-06-16** dưới cấu hình `fst-coverage` — nó được tính toán (khớp bổ đề; §2.2), đi vào điểm tổng hợp khi `morph_coverage ≥ 0.25` (mang tính tham khảo dưới mức sàn), và được bộ xác thực tính toán lại. **Các chỉ số neural (`comet_score`, `qe_score`) bị loại trừ khỏi mọi điểm tổng hợp** — chúng được tính toán và báo cáo riêng biệt; xem phần "Các chỉ số neural" bên dưới.)

#### `fst-coverage` (Cấu hình A): Các ngôn ngữ CÓ Độ bao phủ FST

Dành cho các ngôn ngữ có sẵn bộ chuyển đổi trạng thái hữu hạn GiellaLT. Các chỉ số cấu trúc chiếm 40% điểm tổng hợp (FST 0.25 + độ chính xác hình thái 0.15), phản ánh tầm quan trọng hàng đầu của tính chính xác hình thái đối với các ngôn ngữ đa tổng hợp/chắp dính.

| Chỉ số | Trọng số Mục tiêu | Lý do |
|--------|-------------------|-------|
| `fst_acceptance_rate` | **0.25** | Trọng số cao nhất. Nếu FST từ chối một từ, đó không phải là một dạng hợp lệ trong ngôn ngữ — bất kể các chỉ số khác nói gì. Mang tính nhị phân, có cơ sở cấu trúc. |
| `morphological_accuracy` | **0.15** | Một từ có thể hợp lệ về mặt FST nhưng sai về mặt hình thái (đúng gốc từ, sai biến hình). Cùng với FST, các chỉ số cấu trúc chiếm 40%. |
| `chrf_plus_plus` | **0.15** | Trùng lặp n-gram ký tự: chỉ số đại diện cấp bề mặt tốt nhất cho các ngôn ngữ đa tổng hợp. Xử lý hình thái chắp dính tốt hơn các chỉ số cấp từ. |
| `semantic_score` | **0.15** | Bảo toàn ý nghĩa khi dạng bề mặt khác nhau. Phát hiện các bản dịch sai ngữ nghĩa nhưng vượt qua các kiểm tra cấu trúc. |
| `equivalent_match_rate` | **0.10** | Thưởng cho các biến thể được chấp nhận, không chỉ một bản dịch tham chiếu duy nhất. Quan trọng cho các ngôn ngữ có trật tự từ linh hoạt. |
| `code_switching_rate` | **0.05** | Phạt việc rò rỉ ngôn ngữ nguồn. Đảo ngược: 0% chuyển mã = 1.0. |
| `terminology_adherence` | **0.05** | Thưởng cho các phương pháp có hướng dẫn tôn trọng từ vựng được quy định. Chỉ hoạt động khi có dữ liệu hướng dẫn. |
| `hallucination_rate` | **0.05** | Phạt nội dung bịa đặt. Đảo ngược: 0% ảo tưởng = 1.0. |
| `exact_match_rate` | **0.05** | Trọng số thấp nhất. Quá nghiêm ngặt đối với các ngôn ngữ đa tổng hợp — tồn tại nhiều bản dịch đúng. Được giữ lại như một kiểm tra giới hạn trần. |

> **Tổng cộng: 1.00.** Khi các chỉ số không khả dụng, trọng số của chúng được phân bổ lại theo tỷ lệ cho các chỉ số khả dụng. `morphological_accuracy` (trọng số 0.15) đang **hoạt động** — nó đi vào điểm tổng hợp khi `morph_coverage ≥ 0.25` và được bộ xác thực tính toán lại; dưới mức sàn nó được phân bổ lại giống như bất kỳ chỉ số không khả dụng nào. Khi nó vắng mặt (không có FST, hoặc độ bao phủ dưới mức sàn), 8 chỉ số còn lại (tổng trọng số 0.85) mỗi chỉ số được nhân với tỷ lệ 1/0.85 ≈ 1.176. Ví dụ:
> - FST: 0.25/0.85 = 0.294
> - chrF++: 0.15/0.85 = 0.176
> - ngữ nghĩa: 0.15/0.85 = 0.176

#### `surface-only` (Cấu hình B): Các ngôn ngữ KHÔNG CÓ Độ bao phủ FST

Dành cho các ngôn ngữ không có công cụ xác thực hình thái. Các chỉ số ngữ nghĩa và bề mặt có trọng số ngang nhau.

| Chỉ số | Trọng số Mục tiêu | Lý do |
|--------|-------------------|-------|
| `semantic_score` | **0.25** | Không có xác thực cấu trúc, bảo toàn ý nghĩa là tín hiệu mạnh nhất hiện có. |
| `chrf_plus_plus` | **0.25** | Không có FST, trùng lặp cấp ký tự trở thành kiểm tra bề mặt chính. |
| `equivalent_match_rate` | **0.15** | Khớp biến thể cung cấp đánh giá chất lượng có cấu trúc mà không yêu cầu các công cụ hình thái. |
| `exact_match_rate` | **0.10** | Không có FST, khớp chính xác mang nhiều trọng số hơn như là chỉ số đại diện xác thực cấu trúc duy nhất. |
| `code_switching_rate` | **0.10** | Rò rỉ ngôn ngữ nguồn quan trọng hơn khi không có FST để phát hiện đầu ra xấu. |
| `terminology_adherence` | **0.05** | Tuân thủ từ vựng có hướng dẫn. |
| `hallucination_rate` | **0.05** | Phát hiện nội dung bịa đặt. |
| `orthographic_accuracy` | **0.05** | Tính chính xác đặc thù của chữ viết lấp đầy một phần khoảng trống do thiếu FST để lại. |

> **Tổng cộng: 1.00.** `orthographic_accuracy` (trọng số 0.05) nằm trong `INACTIVE_METRICS` (đang lên kế hoạch, chưa được tính toán). Khi nó vắng mặt, 7 chỉ số còn lại (tổng trọng số 0.95) được nhân với tỷ lệ 1/0.95 ≈ 1.053 — tác động không đáng kể đến điểm tổng hợp.

#### `no-reference`: Các lượt chạy KHÔNG CÓ tham chiếu gold

Dành cho các lượt chạy mà ngữ liệu của chúng **không có tham chiếu gold** (ví dụ: các ngôn ngữ sàn chỉ có FLORES bị nhiễm bẩn mà chúng tôi từ chối chấm điểm đối chiếu). Các chỉ số dựa trên tham chiếu (`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`) không thể tính toán được, vì vậy điểm tổng hợp tất định sẽ dựa vào các tín hiệu **không cần tham chiếu, có thể tái lập bởi bộ xác thực**.

| Chỉ số | Trọng số Mục tiêu | Lý do |
|--------|-------------------|-------|
| `fst_acceptance_rate` | **0.40** | Tính hợp lệ hình thái không cần tham chiếu; tín hiệu tất định mạnh nhất khi có FST. |
| `code_switching_rate` | **0.25** | Rò rỉ ngôn ngữ nguồn (đảo ngược). |
| `hallucination_rate` | **0.20** | Nội dung bịa đặt (đảo ngược). |
| `terminology_adherence` | **0.15** | Tuân thủ từ vựng có hướng dẫn. |

> **Tổng cộng: 1.00.** Cả bốn chỉ số đều có tính tất định và có thể tái lập bởi bộ xác thực. Khi một lượt chạy không có tham chiếu cũng không có FST, điểm tổng hợp sẽ chuẩn hóa lại chỉ dựa trên các kiểm tra hành vi (một tín hiệu mỏng nhưng trung thực một cách có chủ ý); **điểm số QE không cần tham chiếu dựa trên neural (AfriCOMET-QE) được tính toán và báo cáo riêng biệt** — xem phần "Các chỉ số neural" bên dưới — như là tín hiệu về độ đầy đủ cho các lượt chạy đó.

#### Các chỉ số neural — được tính toán và báo cáo RIÊNG BIỆT (không nằm trong bất kỳ điểm tổng hợp nào)

Điểm tổng hợp có tính **tất định**: mọi chỉ số trong đó đều có thể tái lập bởi bộ xác thực chỉ từ ngữ liệu. **Các chỉ số neural bị loại trừ khỏi mọi điểm tổng hợp** và được hiển thị riêng (quyết định thiết kế — "điểm tổng hợp tất định; neural riêng biệt, có thể được gộp riêng sau này"):

| Chỉ số | Nó là gì | Nơi hiển thị |
|--------|----------|--------------|
| `comet_score` | Độ đầy đủ neural COMET / AfriCOMET (dựa trên tham chiếu) | Cột bảng xếp hạng riêng của nó + `neural_metrics` trên thẻ chạy, với cảnh báo hiệu chuẩn tài nguyên thấp. |
| `qe_score` | QE neural không cần tham chiếu AfriCOMET-QE (nguồn + MT) | Cùng làn neural riêng biệt đó; tín hiệu về độ đầy đủ cho các lượt chạy `no-reference`. |

Cả hai vẫn được **bộ xác thực tính toán lại** (`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), vì vậy một điểm số neural được báo cáo mà không thể tái lập sẽ không thể tin cậy — nhưng chúng không bao giờ làm thay đổi điểm tổng hợp tất định. Tập hợp được đặt tên là `scoring.NEURAL_METRICS`. Một điểm tổng hợp neural có thể được giới thiệu sau; hiện tại các chỉ số neural đứng độc lập.

> **Lưu ý về sự phát triển của trọng số.** Các trọng số này mang tính tạm thời và sẽ được hiệu chuẩn lại khi dữ liệu xác thực của con người được tích lũy. Mục tiêu dài hạn là tìm ra các trọng số bằng thực nghiệm: chỉ số tự động nào dự đoán tốt nhất các đánh giá chất lượng của con người cho từng ngữ hệ?

### 4.4 Thêm một Chỉ số Mới vào Điểm Tổng hợp

Để thêm một chỉ số mới vào điểm tổng hợp:

1. **Định nghĩa nó** trong §2 với trạng thái `🔲 Planned`, bao gồm thang đo, cấp độ và phương pháp tính toán.
2. **Triển khai nó** dưới dạng một MetricPlugin (hoặc trong `tester.py` cho các chỉ số cốt lõi).
3. **Thêm một trình giữ chỗ null** trong khối scores của thẻ chạy.
4. **Gán cho nó một trọng số mục tiêu** trong §4.3 bằng cách điều chỉnh giảm các trọng số hiện có. Tổng các trọng số phải bằng 1.00.
5. **Cập nhật BENCHMARK_SPEC.md** §3 nếu lược đồ thẻ chạy thay đổi.
6. **Cập nhật các bảng trọng số của `scoring.py`** (mã nguồn phải phản ánh chính xác tài liệu này).
7. **Chạy một benchmark xác thực** để xác nhận chỉ số tạo ra các giá trị hợp lý trên dữ liệu thực tế.
8. **Cập nhật tài liệu này** để chuyển trạng thái từ `🔲` sang `✅`.

---

## 5. Phân hạng Chất lượng (Quality Tiers) {#5-quality-tiers}

Các phân hạng này là các nhãn heuristic trên điểm số tổng hợp tự động. Chúng mô tả ý nghĩa thực tế của các điểm số, dựa trên đánh giá của con người đối với đầu ra ở từng cấp độ. **Chúng không phải là các đánh giá chất lượng đã được xác thực** — chỉ có sự đánh giá của con người mới có thể xác nhận khả năng sử dụng thực tế.

> [!IMPORTANT]
> **Các phân hạng tự động mang tính tạm thời.** Các nhãn này là các đề xuất để xem xét, không phải là tuyên bố chất lượng. Một phương pháp đạt đến mức "Có thể triển khai" (Deployable) trên các chỉ số tự động là một ứng viên cho việc đánh giá của cộng đồng — không phải là một sản phẩm để phát hành. Chỉ có sự đánh giá của con người bởi những người nói song ngữ mới có thể xác nhận khả năng sử dụng thực tế (xem [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)). Không phương pháp nào có thể tuyên bố đạt mức Deployable hoặc cao hơn mà không có đánh giá của cộng đồng xác nhận rằng người nói đồng ý đầu ra là có thể sử dụng được. Ranh giới phân hạng có thể khác nhau giữa các ngôn ngữ khi dữ liệu xác thực của con người được tích lũy.

| Phân hạng | Khoảng Điểm Tổng hợp | Những gì Người nói Thường Thấy |
|-----------|----------------------|--------------------------------|
| **Cơ bản (Baseline)** | 0.00–0.30 | Đầu ra LLM thô không có hỗ trợ đặc thù theo ngôn ngữ. Hình thái hầu hết là ảo tưởng. |
| **Mới nổi (Emerging)** | 0.30–0.50 | Một số mẫu đúng xuất hiện. Việc hướng dẫn (coaching) có giúp ích, nhưng đầu ra không đáng tin cậy. |
| **Sử dụng được (Functional)** | 0.50–0.70 | Người nói có thể nhận ra đầu ra. Các danh mục ngữ pháp chính thường đúng. Lỗi hình thái thường xuyên xảy ra. |
| **Có thể triển khai (Deployable)** | 0.70–0.85 | Thích hợp cho bản dịch nháp có sự xem xét của con người. Hầu hết hình thái là chính xác. |
| **Lưu loát (Fluent)** | 0.85–1.00 | Tiếp cận bản dịch chất lượng của con người. Lỗi hiếm gặp và nhỏ. |

Các phân hạng này mang tính tạm thời. Chúng sẽ được hiệu chuẩn lại khi dữ liệu xác thực của con người được tích lũy và chúng tôi biết được ngưỡng "người nói thấy điều này hữu ích" thực sự nằm ở đâu cho từng ngôn ngữ. Không phương pháp nào có thể tuyên bố đạt mức **Có thể triển khai (Deployable)** hoặc cao hơn mà không có đánh giá của cộng đồng xác nhận rằng người nói song ngữ đồng ý đầu ra là có thể sử dụng được.

### 5.1 Ngưỡng Phân hạng (Có thể đọc bằng máy)

Đối với các triển khai mã nguồn, các ngưỡng là (được đánh giá từ trên xuống dưới, khớp đầu tiên sẽ thắng):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Chỉ số Chi phí (Cost Metrics)

Các chỉ số chi phí đo lường hiệu quả tài chính của một phương pháp dịch thuật. Chúng được báo cáo riêng biệt với chất lượng — chi phí không ảnh hưởng đến điểm số tổng hợp (ngoại trừ trong bảng xếp hạng phụ được điều chỉnh theo chi phí).

### 6.1 Chỉ số Token

| ID | Chỉ số | Cách tính |
|----|--------|-----------|
| `prompt_tokens` | Tổng số token đầu vào | Tổng của `usage.prompt_tokens` trên tất cả các lệnh gọi API |
| `completion_tokens` | Tổng số token đầu ra | Tổng của `usage.completion_tokens` |
| `reasoning_tokens` | Token suy nghĩ (Chain-of-thought) | Tổng của `usage.completion_tokens_details.reasoning_tokens` (bằng 0 đối với hầu hết các mô hình) |
| `cached_tokens` | Token được cache bởi nhà cung cấp | Tổng của `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Tổng số token đã tiêu thụ | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Số token trung bình cho mỗi bản dịch | ✅ `total_tokens / entry_count` |

### 6.2 Chỉ số Chi phí

| ID | Chỉ số | Cách tính | Trường hợp Sử dụng |
|----|--------|-----------|--------------------|
| `total_cost_usd` | Tổng chi phí lượt chạy | Giá do nhà cung cấp báo cáo × số lượng token | "Chi phí cho benchmark này là bao nhiêu?" |
| `cost_per_entry_usd` | Chi phí cho mỗi mục ngữ liệu | `total_cost_usd / entry_count` | So sánh các phương pháp trên cùng một ngữ liệu |
| `cost_per_1k_tokens` | Chi phí trên 1.000 token | ✅ `total_cost_usd / total_tokens × 1000` | Hiệu quả LLM phổ quát — có thể so sánh giữa các ngữ liệu |
| `cost_per_source_char` | Chi phí trên mỗi ký tự nguồn | `total_cost_usd / total_source_chars` | Có thể so sánh giữa các ngôn ngữ có cách phân tách từ (tokenization) khác nhau |

> **Tại sao lại có nhiều chỉ số chi phí?** Một "mục" có độ dài khác nhau — một cụm từ 3 từ tốn ít chi phí hơn một đoạn văn. `cost_per_entry_usd` hữu ích để so sánh các phương pháp trên *cùng một* ngữ liệu (cùng các mục = cùng độ dài = so sánh công bằng). `cost_per_1k_tokens` là chỉ số hiệu quả LLM tiêu chuẩn, có thể so sánh *giữa các* ngữ liệu. `cost_per_source_char` chuẩn hóa cho các khác biệt về phân tách từ — cùng một câu có thể được phân tách thành số lượng token khác nhau tùy thuộc vào từ vựng của mô hình.

### 6.3 Điểm số Điều chỉnh theo Chi phí

Đối với các phương pháp sử dụng API trả phí, chúng tôi tính toán một bảng xếp hạng phụ:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Điều này thưởng cho các phương pháp đạt điểm số tốt một cách hiệu quả. Nó sử dụng `cost_per_entry_usd` (không phải trên mỗi token) vì điểm số điều chỉnh theo chi phí luôn được tính toán trong một benchmark duy nhất (cùng một ngữ liệu), giúp việc so sánh theo từng mục trở nên công bằng.

Điểm số điều chỉnh theo chi phí là một **bảng xếp hạng phụ** — bảng xếp hạng chính sắp xếp theo điểm số tổng hợp. Nó trả lời một câu hỏi khác: "với một mức ngân sách nhất định, phương pháp nào mang lại kết quả tốt nhất?"

---

## 7. Chỉ số Tốc độ (Speed Metrics)

Các chỉ số tốc độ đo lường độ trễ và thông lượng của một phương pháp dịch thuật. Giống như chi phí, tốc độ không ảnh hưởng đến điểm số tổng hợp.

| ID | Chỉ số | Cách tính | Cấp độ |
|----|--------|-----------|--------|
| `elapsed_seconds` | Thời gian chạy thực tế (Wall-clock) | `time_end - time_start` | Lượt chạy |
| `avg_latency_seconds` | Độ trễ trung bình cho mỗi mục | `Σ latency_s / n_entries` | Ngữ liệu |
| `median_latency_seconds` | Độ trễ trung vị cho mỗi mục | Phân vị thứ 50 của `latency_s` | Ngữ liệu |
| `p95_latency_seconds` | Độ trễ phân vị thứ 95 | Phân vị thứ 95 của `latency_s` | Ngữ liệu |
| `tokens_per_second` | Thông lượng | `total_tokens / elapsed_seconds` | Lượt chạy |
| `entries_per_minute` | Tốc độ dịch | `entry_count / (elapsed_seconds / 60)` | Lượt chạy |

---

## 8. Độ tin cậy và Ý nghĩa Thống kê

### 8.1 Khoảng Tin cậy Bootstrap

Tất cả các chỉ số chính đều hỗ trợ khoảng tin cậy bootstrap (phương pháp phân vị, n=1000 mẫu lại, α=0.05):

| Chỉ số | Khoảng Tin cậy được Báo cáo |
|--------|-----------------------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (chỉ được tính khi có dữ liệu FST) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (được bootstrap từ các điểm số theo từng mục được cache — không cần suy luận neural dư thừa) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (được tính khi có sẵn chrF++ và exact_match) |
| Khoảng tin cậy theo phân hạng | ✅ `confidence_intervals_by_tier` — khoảng tin cậy chrF++ và exact_match theo từng mức độ khó (Phân hạng 1-5) |

### 8.2 Kiểm tra Ý nghĩa Bootstrap Ghép cặp

Để so sánh hai phương pháp, hệ thống kiểm thử tính toán các kiểm tra lấy mẫu lại bootstrap ghép cặp:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

Nếu p-value < 0.05 và khoảng tin cậy của sự khác biệt không chứa giá trị không, sự khác biệt đó có ý nghĩa thống kê ở mức 95%.

---

## 9. Lược đồ Điểm số Thẻ chạy (Run Card Scores Schema)

Phần này định nghĩa cấu trúc phân cấp của khối `scores` trong một thẻ chạy. Lược đồ này được dẫn xuất từ các chỉ số được định nghĩa trong §2–§7 và phải được giữ đồng bộ.

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

> **Lịch sử lược đồ.** Các bản thảo đặc tả trước đây đã đề xuất các khối `cost`, `speed`, và `tokens` riêng biệt. Chúng đã được gộp tương ứng vào `scores` và `totals` để đơn giản hóa. Các chỉ số tốc độ (`tokens_per_second`, `entries_per_minute`, độ trễ) sống trong `scores`; số lượng token và số liệu chi phí sống trong `totals`.

### 9.1 Ánh xạ Lược đồ–Cơ sở dữ liệu

JSON của thẻ chạy được lưu trữ đầy đủ dưới dạng một cột `jsonb` trong Supabase. Các chỉ số chính cũng được phi chuẩn hóa thành các cột cấp cao nhất để tối ưu hóa hiệu năng sắp xếp/lọc:

| Trường Thẻ chạy | Cột Supabase | Kiểu dữ liệu | Chỉ mục (Index) |
|-----------------|--------------|--------------|-----------------|
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
| *(toàn bộ thẻ)* | `run_card` | `jsonb` | — |

Khi các chỉ số mới được triển khai, cột tương ứng nên được thêm vào thông qua một migration được đánh số trong `arena/migrations/`.

---

## 10. Đồng bộ hóa Mã nguồn–Đặc tả

### 10.1 Nguồn Chuẩn (Canonical Source)

Tài liệu này (`cli/website/docs/network/specifications/scoring.md`) là nguồn chuẩn cho:
- Định nghĩa chỉ số (§2)
- Các bảng trọng số tổng hợp (§4.3)
- Ngưỡng phân hạng chất lượng (§5.1)
- Công thức chỉ số chi phí (§6.2)
- Lược đồ điểm số thẻ chạy (§9)

### 10.2 Bản sao trong Mã nguồn (Code Mirror)

Tệp `arena/mt_eval_harness/scoring.py` sao chép các bảng trọng số và ngưỡng phân hạng từ tài liệu này. Đây là **triển khai mã nguồn** của §4.3 và §5.1. Khi tài liệu này được cập nhật:

1. Cập nhật `scoring.py` để khớp
2. Chạy `pytest tests/test_scoring_ssot.py` để xác thực sự đồng bộ
3. Cập nhật FAQ và tài liệu trang web tóm tắt các trọng số

### 10.3 Các Tài liệu Tham chiếu Đặc tả này

| Tài liệu | Những gì nó Tham chiếu | Cách Giữ Đồng bộ |
|----------|------------------------|------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | Công thức tổng hợp, bảng trọng số, ngưỡng phân hạng | Tham chiếu chéo tài liệu này; không sao chép lại các bảng |
| `website/docs/getting-started/faq.md` | Tóm tắt trọng số đơn giản hóa | Phải khớp với §4.3; liên kết ngược lại tài liệu này |
| `cli/website/docs/network/how-it-works.md` | Ngưỡng có thể triển khai (Deployable) | Phải khớp với §5 |
| `publish.py` thông qua `scoring.py` | Từ điển trọng số + hàm phân hạng | Kiểm thử tự động xác thực sự trùng khớp |

---

## Phụ lục A: Các Chỉ số KHÔNG nằm trong Điểm Tổng hợp (và Lý do)

| Chỉ số | Tại sao bị Loại trừ |
|--------|---------------------|
| **BLEU** | Việc chấm điểm cấp từ phạt các biến thể hình thái trong các ngôn ngữ đa tổng hợp. Một khác biệt nhỏ về biến hình (đúng nghĩa, sai hậu tố một chút) được tính là một lỗi hoàn toàn. chrF++ xử lý điều này tốt hơn ở cấp độ ký tự. |
| **COMET** | Được huấn luyện trên dữ liệu WMT (các cặp ngôn ngữ châu Âu tài nguyên cao). Đối với LRL (ví dụ: tiếng Cree), mô hình sẽ ngoại suy và không được hiệu chuẩn. COMET/AfriCOMET được **tính toán và báo cáo trong một làn neural riêng biệt — không bao giờ nằm trong bất kỳ điểm tổng hợp nào** (điểm tổng hợp mang tính tất định; §4.3) — và được bộ xác thực tính toán lại. |
| **TER** | Khoảng cách chỉnh sửa tương quan với chrF++ đối với hầu hết các trường hợp sử dụng. Việc bao gồm cả hai sẽ tính trùng lặp độ tương đồng bề mặt. TER được báo cáo để tham khảo. |
| **Tỷ lệ Độ dài** | Một chỉ số chẩn đoán, không phải tín hiệu chất lượng. Tỷ lệ 1.02 và tỷ lệ 0.98 đều ổn. Chỉ các giá trị cực đoan mới cho thấy vấn đề. |
| **Điểm Nhất quán** | Chỉ ở cấp độ ngữ liệu — không có giá trị theo từng mục để gộp lại. Ngoài ra, một số sự không nhất quán là hợp lệ (cùng một từ tiếng Anh → các bản dịch ngôn ngữ đích khác nhau tùy thuộc vào ngữ cảnh). |
| **Chỉ số Tuân thủ** | Cổng chất lượng, không phải tín hiệu chất lượng. Đo lường việc bảo toàn cấu trúc (trình giữ chỗ, dấu ngoặc kép), không phải độ chính xác của bản dịch. |

## Phụ lục B: LYSS — Các Triển khai Chỉ số Đặc thù theo Ngôn ngữ

Khung **LYSS** (Linguistically-informed Yield & Structural Scoring) cung cấp các chỉ số đặc thù theo ngôn ngữ vượt ra ngoài việc so sánh chuỗi ký tự cấp bề mặt. LYSS có ba thành phần cốt lõi:

- **LYSS-fst** — Tính hợp lệ hình thái (`fst_acceptance_rate`): Mỗi từ có phải là một dạng hợp lệ trong ngôn ngữ đích không?
- **LYSS-eq** — Tính tương đương ngôn ngữ học (`equivalent_match_rate`): Đầu ra có phải là một biến thể được chấp nhận của tham chiếu không?
- **LYSS-sem** — Xác thực ngữ nghĩa (`semantic_score`): Đầu ra có bảo toàn ý nghĩa nguồn không?

> **Trạng thái xác thực: 🔶 Heuristic kỹ thuật.** Các chỉ số LYSS CHƯA được xác thực đối với các đánh giá chất lượng của con người. Chúng được thiết kế từ các nguyên lý ngôn ngữ học (FST, từ điển, quy tắc ngữ pháp được xây dựng bởi các nhà ngôn ngữ học tại UAlberta ALTLab), nhưng mối tương quan giữa điểm số LYSS và chất lượng dịch thuật thực tế chưa được đo lường. Xem [Giao thức Xác thực bởi Người nói](/docs/network/specifications/speaker-validation) để biết các thử nghiệm xác thực bắt buộc.

| Ngôn ngữ | Plugin | Vị trí | Thành phần LYSS | Khóa Chỉ số | Ghi chú |
|----------|--------|--------|-----------------|-------------|---------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Các quy tắc lớp biến thể tất định: trật tự từ, chính tả, tiểu từ tùy chọn, từ đồng nghĩa bổ đề, tính mơ hồ tiếp diễn, bao gồm/loại trừ. Tạo ra `lint_verdict` theo từng mục (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Tất định: trích xuất bổ đề FST + nghĩa từ điển + trùng lặp từ nội dung spaCy. Tạo ra các phán quyết (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Các ngôn ngữ GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Chung: hoạt động cho CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU — bất kỳ ngôn ngữ nào có bộ phân tích `.hfstol`. Chỉ số này mang tính tổng quát, nhưng **ngữ liệu đánh giá hiện chỉ tồn tại cho Plains Cree (crk)** ngày nay, vì vậy crk là ngôn ngữ duy nhất được chấm điểm FST trong thực tế (xem [Hạn chế Trung thực](/docs/network/honest-limitations)). |

> **Lưu ý về kiến trúc (Tháng 6 năm 2026).** Các chỉ số LYSS đặc thù theo ngôn ngữ hiện được khai báo trên thẻ ngôn ngữ dưới `evalMetrics` và được tải từ `eval_standards/<lang>/` bởi `plugin_discovery.py`. Chúng là **các tiêu chuẩn đánh giá** (trọng tài), không phải các chỉ số plugin phương pháp (thí sinh). Điều này có nghĩa là bất kỳ phương pháp dịch thuật nào nhắm mục tiêu đến CRK đều tự động được chấm điểm bởi LYSS — không cần cấu hình đặc thù theo phương pháp. `CrkFSTMetric` đã bị loại bỏ; chức năng của nó được bao phủ hoàn toàn bởi `GiellaLTFSTMetric` chung.

## Phụ lục C: Các Chỉ số Đang được Xem xét

Đây là các ý tưởng đang được đánh giá nhưng chưa đủ chi tiết để đặc tả trong §2:

| Ý tưởng | Những gì nó sẽ Đo lường | Rào cản |
|---------|------------------------|---------|
| Độ lưu loát (LM perplexity) | Đầu ra có phải là văn xuôi được cấu trúc tốt trong ngôn ngữ đích không? | Yêu cầu một LM ngôn ngữ đích. Không có mô hình tốt nào tồn tại cho hầu hết các LRL. |
| Khớp văn phong (Register match) | Bản dịch có khớp với mức độ trang trọng dự kiến không? | Yêu cầu các bộ phân loại ngôn ngữ học xã hội. Vấn đề nghiên cứu. |
| Tính phù hợp về văn hóa | Các tham chiếu văn hóa có được xử lý chính xác không? | Không thể tự động hóa — vốn dĩ yêu cầu con người xem xét. |
| Tính mạch lạc của diễn ngôn | Các bản dịch liên tiếp có tạo thành một đoạn văn mạch lạc không? | Yêu cầu đánh giá ở cấp độ tài liệu, không phải cấp độ câu. |

---

## Tài liệu Tham khảo

Các bài báo học thuật, công cụ và tài nguyên ngôn ngữ được trích dẫn trong đặc tả này.

### Chỉ số Bề mặt

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Đan Mạch.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Bỉ, Brussels. Triển khai tham chiếu: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Chỉ số Neural

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Trực tuyến.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Trực tuyến.

### Công cụ Hình thái và Ngôn ngữ học

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Phân loại Lỗi và Đánh giá Chẩn đoán

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Công trình liên quan về các chỉ số đánh giá dựa trên đặc trưng, bao gồm cả FUSE.)

### Phát hiện Ảo tưởng

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Trực tuyến.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### Tài nguyên Ngôn ngữ Cree

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Quản trị Dữ liệu

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
