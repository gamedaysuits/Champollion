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

> **Tóm tắt điều hành.** Đây là nguồn thông tin chuẩn xác duy nhất (single source of truth) về cách chấm điểm các lượt chạy trong hệ sinh thái đánh giá dịch máy (MT) của Champollion: một chỉ số tiêu đề duy nhất, các chỉ số chuẩn khác được báo cáo bên cạnh, các chỉ số chẩn đoán được báo cáo riêng biệt, cùng chi phí và tốc độ. Các lượt chạy được chấm điểm theo cách mà lĩnh vực này thực hiện: **chrF++ cấp ngữ liệu cùng chữ ký sacreBLEU và khoảng tin cậy bootstrap 95%**, kèm theo BLEU, spBLEU, TER và COMET bên cạnh, cùng các kiểm định ý nghĩa thống kê theo cặp để xác định xem hệ thống này có tốt hơn hệ thống khác hay không. Các chẩn đoán đặc thù theo ngôn ngữ (tính hợp lệ hình thái học FST, các lớp tương đương của linter, xác thực ngữ nghĩa tất định) được gọi chung là **LYSS** (Linguistically-informed Yield & Structural Scoring). Điểm tổng hợp có trọng số và các nhãn phân tầng chất lượng được sử dụng trước đây đã **ngừng sử dụng** (§4, §5); các bảng của chúng vẫn được giữ lại ở đây chỉ để các thẻ cũ vẫn có thể được xác minh. Mã nguồn, tài liệu và lược đồ cơ sở dữ liệu đều bắt nguồn từ tài liệu này. Khi có xung đột, tài liệu này có thẩm quyền cao nhất.
>
> **Phạm vi.** Tài liệu này xác định *những gì* chúng tôi đo lường và *cách chúng tôi chấm điểm*. Nó không định nghĩa lược đồ run card (xem BENCHMARK_SPEC §3), giao thức đánh giá chuẩn (BENCHMARK_SPEC §6) hay các quy tắc bảng xếp hạng (xem tài liệu về arena). Các tài liệu đó tham chiếu đến tài liệu này để lấy định nghĩa chỉ số và logic chấm điểm.


---

## Cách chấm điểm các lượt chạy {#how-runs-are-scored}

Mỗi lượt chạy mới đều được chấm điểm theo **tiêu chuẩn chấm điểm `standard/1`**. Run card ghi rõ: `scores.scoring_standard` là `"standard/1"` và `scores.primary_metric` là `"chrf_plus_plus"`.

| Vai trò | Chỉ số | Nơi hiển thị |
|------|------|------------------|
| **Chỉ số tiêu đề và xếp hạng** | **chrF++** cấp ngữ liệu (sacreBLEU chrF với `word_order=2`), 0–100, cùng với khoảng tin cậy bootstrap 95% và chữ ký sacreBLEU | Được ghi dưới dạng `chrF++ 47.5 [45.9, 49.0]`, theo sau là chữ ký. Run card: `scores.chrf_plus_plus`, CI trong `scores.confidence_intervals.corpus_chrf`, chữ ký trong `scores.sacrebleu_signatures.chrf`. Cơ sở dữ liệu: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Các chỉ số chuẩn khác** | BLEU, spBLEU (SentencePiece của FLORES-200), TER và COMET khi được tính toán | Hiển thị bên cạnh chrF++, mỗi chỉ số đi kèm chữ ký hoặc model id COMET tương ứng. Không bao giờ gộp chung với chrF++ hay với nhau. |
| **Chẩn đoán** | Khớp chính xác (exact match), chấp nhận FST, độ chính xác hình thái học, chuyển mã (code-switching), ảo giác (hallucination), tuân thủ thuật ngữ, phong cách viết và mọi cảnh báo điểm số (§2.8) | Được báo cáo riêng và được dán nhãn là chẩn đoán. Chúng không bao giờ được tính vào con số tiêu đề và không bao giờ dùng để xếp hạng lượt chạy. Các cảnh báo luôn hiển thị nổi bật bên cạnh tiêu đề. |
| **Chi phí và tốc độ** | Token, đô la, độ trễ (§6, §7) | Được báo cáo bên cạnh điểm số, không bao giờ kết hợp với điểm số. |

**Xác định "tốt hơn".** Hai lượt chạy trên cùng một tập đánh giá được so sánh bằng một kiểm định ý nghĩa thống kê theo cặp trên chrF++ (mặc định là ngẫu nhiên hóa xấp xỉ, lấy mẫu lại bootstrap theo cặp là tùy chọn; §8.2). Các chỉ số chuẩn khác cũng được kiểm định và hiển thị. Một sự khác biệt không có ý nghĩa thống kê sẽ được báo cáo là không có ý nghĩa thống kê, bất kể hai con số là bao nhiêu.

**Không có nhãn chất lượng.** Điểm số tự động không phải là phán quyết về chất lượng. Thẻ mới không mang phân tầng nào và không có nhãn như "functional" (hoạt động được) hoặc "deployable" (có thể triển khai); chỉ có đánh giá từ con người bởi những người bản ngữ mới chứng nhận chất lượng ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**Những gì đã ngừng sử dụng.** Các thẻ mới công bố `composite: null`, `quality_tier: null` và `cost_adjusted: null` (điểm điều chỉnh theo chi phí trước đây là điểm tổng hợp chia cho hệ số chi phí; bản thân chi phí vẫn được báo cáo). Không có đầu ra mới nào in ra điểm tổng hợp hoặc phân tầng. Các thẻ được công bố trước tiêu chuẩn vẫn giữ điểm tổng hợp đã lưu và vẫn có thể kiểm chứng: trình xác minh sẽ tính lại thẻ không có `scoring_standard` bằng phép tính cũ (§4), và thẻ `standard/1` bằng cách tính lại chrF++. Bất cứ nơi nào điểm tổng hợp của thẻ cũ vẫn được hiển thị, nó sẽ được dán nhãn **legacy composite (retired)** (điểm tổng hợp cũ (đã ngừng dùng)).

**Tại sao đây lại là tiêu chuẩn.** Đây là cách giới nghiên cứu báo cáo việc đánh giá dịch máy (MT):

- **WMT** xếp hạng các hệ thống trong nhiệm vụ chung (shared-task) bằng đánh giá của con người và báo cáo các chỉ số tự động bên cạnh với chữ ký sacreBLEU để các con số có thể tái lập được (Post 2018; Kocmi et al. 2024).
- **FLORES-200** (NLLB Team 2022) báo cáo chrF++ và spBLEU cho 200 ngôn ngữ, hầu hết trong số đó là ngôn ngữ ít tài nguyên.
- Các nhiệm vụ chung **AmericasNLP** về dịch sang các ngôn ngữ Bản địa châu Mỹ xếp hạng các hệ thống theo chrF (Mager et al. 2021; Ebrahimi et al. 2023), vì n-gram cấp ký tự xử lý hình thái học phong phú tốt hơn BLEU cấp từ (Popović 2015, 2017).
- Kocmi et al. (2021), khi so sánh các chỉ số tự động với hàng nghìn đánh giá của con người, đã phát hiện ra rằng độ lớn của chênh lệch chỉ số và việc nó có ý nghĩa thống kê hay không chính là những yếu tố dự đoán mức độ ưa thích của con người; đó là lý do tại sao các so sánh ở đây là các kiểm định ý nghĩa thống kê theo cặp (Koehn 2004; Riezler & Maxwell 2005), chứ không chỉ là hai con số đặt cạnh nhau.

**Các cuộc thi.** Tiêu chí xét tuyển của một cuộc thi chỉ là chrF++, theo thang điểm 0–100, và `primary_metric` của cuộc thi mặc định là `chrf_plus_plus`. Một cuộc thi mới yêu cầu chỉ số `composite` sẽ bị từ chối kèm theo lý do; các cuộc thi được tạo trước tiêu chuẩn vẫn tiếp tục hoạt động. Đơn vị tổ chức vẫn có thể đặt ra các cổng chẩn đoán trong điều khoản giải thưởng (ví dụ: tỷ lệ chấp nhận FST tối thiểu), dưới dạng các điều kiện mà bài nộp phải vượt qua, chứ không bao giờ dùng làm điểm số ([Đặc tả giải thưởng](/docs/network/specifications/prizes)).

**Thay đổi tiêu chuẩn.** Chỉ số tiêu đề chỉ thay đổi khi có phiên bản tiêu chuẩn mới (`standard/2`). Mỗi thẻ đều nêu rõ tiêu chuẩn mà nó được chấm điểm và được xác minh theo tiêu chuẩn đó.

---

## 1. Triết lý Chấm điểm

### 1.1 Triết lý Microeval

> *"Nếu chúng ta chỉ tập trung vào những gì có tính khái quát hóa, chúng ta sẽ vô tình quên đi những nơi mà nó không thể áp dụng — và đánh mất các ngôn ngữ này cùng với tất cả tri thức và trí tuệ của chúng."*

Dự án này thực hành **phát triển microeval**: xây dựng các chỉ số đánh giá được thiết kế riêng cho các ngôn ngữ cụ thể bằng cách sử dụng các công cụ ngôn ngữ học tốt nhất hiện có — bộ chuyển đổi trạng thái hữu hạn (finite-state transducers - FST), từ điển song ngữ, bộ phân tích hình thái, các quy tắc tương đương do các nhà ngôn ngữ học tuyển chọn. Điều này trái ngược với mô hình thống trị trong đánh giá dịch máy (MT), vốn tìm kiếm các chỉ số phổ quát hoạt động trên mọi ngôn ngữ. Các chỉ số phổ quát rất có giá trị, nhưng chúng lại yếu nhất ở chính những nơi cần chúng nhất: đối với các ngôn ngữ có hình thái phức tạp, dữ liệu huấn luyện hạn chế và không có đại diện trong các tập huấn luyện chỉ số neural.

Chúng ta chưa đạt được nhiều tiến bộ trong dịch máy cho nhiều ngôn ngữ trên thế giới không chỉ vì thiếu ngữ liệu, mà còn vì **chúng ta thậm chí không biết tiến bộ trông như thế nào** — chúng ta thiếu các công cụ đánh giá tự động để đo lường xem một hệ thống dịch thuật có đang cải thiện hay không. LYSS là nỗ lực của chúng tôi nhằm xây dựng các công cụ đó, theo từng ngôn ngữ, sử dụng bất kỳ tài nguyên ngôn ngữ nào hiện có.

### 1.2 Chỉ số Tự động là các Chỉ số Đại diện (Proxies)

Mọi chỉ số được định nghĩa ở đây đều được máy tính toán. Chúng hữu ích cho việc lặp nhanh, so sánh có hệ thống và phát hiện hồi quy. Chúng **không thể thay thế cho đánh giá của con người**, đó là lý do tại sao không có điểm số tự động nào mang nhãn chất lượng — chỉ có đánh giá của con người mới có thể xác nhận khả năng sử dụng thực tế.

### 1.3 Một tiêu đề, nhiều tín hiệu

Không một chỉ số đơn lẻ nào có thể phản ánh trọn vẹn chất lượng dịch thuật. Bản dịch có thể có độ trùng lặp chrF++ cao nhưng lại thất bại khi xác thực hình thái học. Nó có thể vượt qua các bước kiểm tra FST nhưng lại mang sai nghĩa. Nó có thể chính xác về mặt ngữ nghĩa nhưng xa lạ về mặt phong cách đối với ngôn ngữ đích. Vì vậy, mỗi lượt chạy đều báo cáo nhiều tín hiệu — nhưng chỉ có một trong số đó, chrF++, là chỉ số tiêu đề và chỉ số xếp hạng, còn các chỉ số khác được hiển thị bên cạnh, không bao giờ được gộp chung vào đó. Sự pha trộn các tín hiệu mang ý nghĩa khác nhau đối với từng ngôn ngữ có thể bị lợi dụng bởi một hệ thống thể hiện tốt ở các tín hiệu ít tốn kém (§4 ghi lại cách mà điểm tổng hợp đã ngừng sử dụng từng bị như vậy), và người đọc không thể biết được từ một con số gộp xem tín hiệu nào đã thay đổi.

### 1.4 Tính Mở rộng

Danh mục chỉ số này không cố định. Các ngôn ngữ mới mang lại những yêu cầu mới: độ chính xác về thanh điệu cho các ngôn ngữ có thanh điệu, độ chuẩn xác về dấu phụ cho chữ viết Semit, độ chính xác của bảng ký tự âm tiết cho tiếng Cree. Kiến trúc (giao thức MetricPlugin) cho phép bổ sung các chỉ số chẩn đoán mà không làm thay đổi bất kỳ điểm số tiêu đề nào. Các chỉ số dành riêng cho từng ngôn ngữ (ví dụ: linter và bộ xác thực ngữ nghĩa của CRK) được khai báo trên thẻ ngôn ngữ dưới mục `evalMetrics` và được tải từ `eval_standards/` — bộ khung kiểm thử chỉ đi kèm các chỉ số hành vi chung (chuyển mã, ảo giác, thuật ngữ).

### 1.5 Ba Khía cạnh Đánh giá

Mỗi thẻ chạy đo lường ba khía cạnh độc lập:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Đây là các trục độc lập. Một phương pháp có thể đạt điểm cao nhưng tốn kém, có thể nhanh nhưng không chính xác, hoặc bất kỳ sự kết hợp nào. Bảng xếp hạng cho phép sắp xếp theo bất kỳ chiều đo nào. Không có con số công bố nào kết hợp chúng lại với nhau (điểm điều chỉnh theo chi phí từng làm điều đó, §6.3, nay đã ngừng sử dụng).

### 1.6 Trạng thái Xác thực (Validation Status)

Mỗi chỉ số trong đặc tả này có một **trạng thái xác thực** khác biệt với trạng thái triển khai của nó (§3). Trạng thái triển khai theo dõi xem mã nguồn đã tồn tại hay chưa. Trạng thái xác thực theo dõi xem chỉ số đó đã được chứng minh là có tương quan với các đánh giá chất lượng của con người hay chưa.

| Cấp độ Xác thực | Ý nghĩa | Các Chỉ số Hiện tại |
|-----------------|---------|---------------------|
| **✅ Đã được xác thực bên ngoài** | Đã có các nghiên cứu tương quan với con người được công bố (WMT, các bài báo học thuật) | `chrf_plus_plus`, `bleu`, `comet_score` *(chỉ dành cho các cặp ngôn ngữ tài nguyên cao)* |
| **⚡ Xác thực đại diện (Proxy-validated)** | Đã được xác thực cho các ngôn ngữ tài nguyên cao; chưa được xác thực cho các ngôn ngữ tài nguyên thấp (LRL) mục tiêu của chúng tôi | `comet_score` *(đối với LRL: được xác thực trên các cặp ngôn ngữ tài nguyên cao/EU, ngoại suy cho ví dụ: CRK — hữu ích về mặt định hướng nhưng chưa được hiệu chuẩn)* |

| **🔶 Heuristic kỹ thuật** | Được thiết kế từ các nguyên lý ngôn ngữ học hoặc các dạng lỗi quan sát được; không có dữ liệu tương quan với con người | `fst_acceptance_rate`, `morphological_accuracy` (bắt nguồn từ FST, khớp theo bổ đề, được trình xác minh tính lại), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Chưa được xác thực** | Chưa được kiểm thử trên bất kỳ dữ liệu nào | `orthographic_accuracy`, `consistency_score` |

> **Tại sao `comet_score` xuất hiện ở hai hàng.** Đây là sự phân chia theo mức độ tài nguyên, không phải là mâu thuẫn. COMET được *xác thực bên ngoài* ở những nơi có các nghiên cứu tương quan với con người của WMT — các cặp ngôn ngữ nhiều tài nguyên, chủ yếu là châu Âu. Đối với các ngôn ngữ ít tài nguyên mục tiêu của chúng tôi, không có các nghiên cứu như vậy, do đó cùng một chỉ số chỉ được *xác thực ủy nhiệm*: mô hình ngoại suy từ các ngôn ngữ có hệ thống hình thái học khác biệt. Nó được hiển thị bên cạnh chrF++ cùng với model id và cảnh báo hiệu chỉnh, không bao giờ được gộp chung.

> **Ý nghĩa thực tế của điều này.** Chỉ số tiêu đề (chrF++) là chỉ số đã được xác thực bên ngoài, được sử dụng theo đúng cách mà giới chuyên môn áp dụng. Mỗi heuristic kỹ thuật ở trên là một **chẩn đoán**: nó có thể giải thích *lý do tại sao* một lượt chạy lại đạt điểm như vậy (các từ không phải là dạng hợp lệ, đầu ra chuyển sang tiếng Anh), nhưng nó không bao giờ là điểm số chính và không bao giờ dùng để xếp hạng lượt chạy. Điểm tổng hợp đã ngừng sử dụng (§4) từng đưa các heuristic ở mọi mức độ xác thực vào chỉ số tiêu đề, khiến một hệ thống có thể nhận phần lớn số điểm mà không cần dịch (§4).
>
> **Các thử nghiệm xác thực bắt buộc** (xem `mt-evaluation-landscape.md` §6 và `speaker-validation.md`):
> 1. Nghiên cứu tương quan đánh giá của con người: hơn 200 cặp câu được xếp hạng bởi từ 3 người nói song ngữ trở lên
> 2. Đo lường tỷ lệ từ chối sai của FST trên một ngữ liệu đại diện
> 3. Chuyển ngữ sang ngôn ngữ thứ hai (tiếng Bắc Sámi) để kiểm tra khả năng tổng quát hóa
> 4. So sánh trực tiếp với COMET trên cùng một tập dữ liệu


---

## 2. Danh mục Chỉ số {#2-metric-inventory}

Các chỉ số được tổ chức thành sáu danh mục (bề mặt, cấu trúc, ngữ nghĩa, hành vi, tuân thủ và các chỉ số so sánh được báo cáo). Mỗi chỉ số đều có trạng thái triển khai, thang đo và cấp độ (từng mục, cấp ngữ liệu, hoặc cả hai), cùng một trong ba vai trò theo tiêu chuẩn: **tiêu đề** (chỉ riêng chrF++), **chuẩn** (BLEU, spBLEU, TER, COMET — hiển thị bên cạnh tiêu đề), hoặc **chẩn đoán** (tất cả các chỉ số còn lại — được báo cáo riêng).

### 2.1 Chỉ số Bề mặt (Surface Metrics)

Các chỉ số bề mặt so sánh bản dịch dự đoán với bản dịch tham chiếu ở cấp độ chuỗi ký tự. Chúng không yêu cầu các công cụ ngôn ngữ học — chỉ so sánh chuỗi.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Khớp chính xác | ✅ Đã triển khai | 0.0–1.0 | Cả hai | **Chẩn đoán.** Nhị phân: predicted == reference? Tỷ lệ ngữ liệu = số kết quả khớp / tổng số. |
| `equivalent_match_rate` | Khớp tương đương | ⚡ Một phần | 0.0–1.0 | Cả hai | **Chẩn đoán.** Đầu ra dự đoán có khớp với bất kỳ biến thể nào được chấp nhận không? Đối với CRK: được triển khai thông qua `CrkLinterMetric` của tiêu chuẩn đánh giá CRK (trong `eval_standards/crk/`) sử dụng các quy tắc lớp biến thể tất định (trật tự từ, chính tả, tiểu từ tùy chọn, từ đồng nghĩa theo bổ đề, tính nhập nhằng của thể tiếp diễn). Được tải tự động qua khai báo `evalMetrics` trên thẻ ngôn ngữ CRK. Triển khai đa ngôn ngữ chung đòi hỏi `variants[]` cho từng mục trong ngữ liệu. |
| `chrf_plus_plus` | chrF++ | ✅ Đã triển khai | 0–100 | Cả hai | **Chỉ số tiêu đề và xếp hạng.** Điểm F của n-gram ký tự cùng unigram và bigram từ (sacreBLEU chrF, `word_order=2`; Popović 2017). Bền vững trước biến thể hình thái học. Giá trị được công bố là ở cấp ngữ liệu (`corpus_chrf`), kèm theo khoảng tin cậy bootstrap 95% và chữ ký sacreBLEU; các giá trị từng mục (`sentence_chrf`) được đưa vào các kiểm định ý nghĩa thống kê. |
| `bleu` | BLEU | ✅ Đã triển khai | 0–100 | Ngữ liệu | **Chỉ số chuẩn, hiển thị bên cạnh chrF++** (run card và cơ sở dữ liệu `corpus_bleu`, kèm theo chữ ký sacreBLEU). Độ chính xác n-gram cấp từ (Papineni et al. 2002). Không phải là chỉ số tiêu đề vì việc đối sánh cấp từ coi một từ đúng nhưng khác hậu tố là hoàn toàn trật, điều này gây bất lợi cho các ngôn ngữ giàu hình thái. |
| `ter` | Translation Edit Rate | ✅ Đã triển khai | 0–∞ (càng thấp càng tốt) | Cả hai | **Chỉ số chuẩn, hiển thị bên cạnh chrF++** (`scores.ter`, kèm theo chữ ký sacreBLEU). Khoảng cách chỉnh sửa tối thiểu giữa dự đoán và chuỗi tham chiếu, được chuẩn hóa theo độ dài chuỗi tham chiếu (sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | Tỷ lệ độ dài | ✅ Đã triển khai | 0–∞ (1.0 là lý tưởng) | Cả hai | **Chẩn đoán.** `len(predicted) / len(reference)` theo ký tự. Phát hiện việc cắt ngắn (<0.5) và thổi phồng/ảo giác (>2.0). Được tính trung bình trên các mục ở cấp ngữ liệu. |

### 2.2 Chỉ số Cấu trúc (Structural Metrics)

Các chỉ số cấu trúc xác thực tính đúng đắn về mặt ngôn ngữ học của bản dịch. Chúng yêu cầu các công cụ đặc thù theo ngôn ngữ (bộ phân tích FST, bộ phân tích cú pháp hình thái) và là các tín hiệu mạnh nhất cho các ngôn ngữ giàu hình thái.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | Chấp nhận FST | ✅ Đã triển khai | 0.0–1.0 | Cả hai | **Chẩn đoán.** Tỷ lệ chấp nhận các từ đầu ra bởi một bộ chuyển đổi trạng thái hữu hạn (GiellaLT). Một từ là "hợp lệ" nếu FST trả về ít nhất một phân tích hình thái. **Tổng hợp:** giá trị ngữ liệu được công bố là **trung bình của các tỷ lệ theo từng mục** — số từ được chấp nhận của mỗi mục ÷ số từ của mục đó, tính trung bình trên các mục mà FST đã phân tích, đầu ra trống được tính là 0 (`avg_fst_validity` của plugin). Tỷ lệ từ gộp chung (tổng số từ được chấp nhận ÷ tổng số từ, `corpus_validity_rate`) được báo cáo bên cạnh trong báo cáo lượt chạy và trên run card nhưng không phải là giá trị được công bố; hai giá trị này khác nhau khi các mục có độ dài khác nhau. Khả dụng cho bất kỳ ngôn ngữ nào có bộ phân tích GiellaLT `.hfstol`. **Chữ hoa/thường:** một từ được tra cứu nguyên dạng như đã viết; nếu FST từ chối và từ đó bắt đầu bằng chữ hoa, nó sẽ được tra cứu lại với chữ cái đầu viết thường (`Mun` → `mun`), và từ VIẾT HOA TOÀN BỘ sẽ được tra cứu theo dạng Titlecase rồi đến dạng chữ thường (`OSLO` → `Oslo`, `GIITU` → `giitu`). Không bao giờ làm ngược lại: một danh từ riêng viết bằng chữ thường (`oslo`) vẫn bị từ chối. Các bộ chấp nhận kiểm tra chính tả của GiellaLT (tiếng Bắc Sámi, Amharic, Basque) và bộ phân tích tiếng Plains Cree nghiêm ngặt của ALTLab chỉ liệt kê hầu hết các từ ở dạng chữ thường và giao việc xử lý chữ hoa/thường cho chương trình bao quanh, vì vậy nếu không có xử lý này, một chữ cái viết hoa đầu câu đúng sẽ bị tính là từ không hợp lệ. Đây là phiên bản tính toán `case-fallback/1`, được nêu tên trong báo cáo (`fst_acceptance_method`, cùng với `total_case_folded_words` và `fst_case_folded_words` của từng mục) và trên run card (`fst_provenance.acceptance_method`). Báo cáo không có thông tin này đã được chấm điểm có phân biệt chữ hoa/thường và có kết quả thấp hơn đối với văn bản viết hoa; `mt-eval compare` sẽ thông báo điều đó khi so sánh cả hai, và `mt-eval test <run log>` sẽ chấm điểm lại lượt chạy cũ. Trình xác minh sẽ tính lại các con số bắt nguồn từ FST của thẻ đã công bố theo phương pháp mà thẻ đó chỉ định, và thẻ không có chỉ định sẽ được tính theo phương pháp phân biệt chữ hoa/thường, để thẻ luôn được kiểm tra theo đúng phép tính mà nó đã được công bố cùng. |
| `morphological_accuracy` | Độ chính xác hình thái học | ✅ Đã triển khai (được trình xác minh tính lại) | 0.0–1.0 | Cả hai | **Chẩn đoán.** Một từ có thể hợp lệ theo FST nhưng lại sai biến tố (đúng từ gốc, sai hậu tố). **Được tính toán** bởi `plugins/giellalt_fst.py`: đối với mỗi từ dự đoán có thể phân tích được, tìm một từ tham chiếu có cùng **bổ đề** (từ gốc) và kiểm tra xem **biến tố** dự đoán (các thẻ đặc trưng FST) có khớp hay không. Khớp theo bổ đề — thay vì vị trí — giúp tránh được việc căn chỉnh từ: một từ được chọn khác đi hoặc một cặp không khớp nhau đơn giản là không nằm trong diện *bao phủ* (không bao giờ bị chấm điểm sai). **Không cần chú thích vàng (gold annotations)** — phân tích FST của chuỗi tham chiếu *chính là* ground truth. Các từ mà FST không thể phân tích được, hoặc có từ gốc không có trong chuỗi tham chiếu, sẽ nằm ngoài diện bao phủ; `morph_coverage` (tỷ lệ khớp theo bổ đề) được công khai, và nếu dưới `MORPH_COVERAGE_FLOOR` (0.25) giá trị này sẽ được đánh dấu là mang tính tham khảo. Nó **khoan dung trước tính nhập nhằng của FST** (một từ dự đoán có nhiều phân tích sẽ được coi là "đúng" nếu *bất kỳ* phân tích nào khớp → một cận trên, được công khai). Nó cần một **bộ phân tích (analyzer)**: một FST chỉ là **bộ chấp nhận (acceptor)** kiểm tra chính tả (các gói kiểm tra chính tả Divvun được cài đặt cho tiếng Bắc Sámi, Amharic và Basque) chỉ cho biết một từ có tồn tại hay không chứ không cung cấp bổ đề hay thẻ. Đối với những trường hợp đó, `morphological_accuracy` và `morph_coverage` là null và `metric_availability` sẽ giải thích lý do; tỷ lệ chấp nhận FST vẫn được báo cáo. Ghim FST khai báo điều này (`kind: "acceptor"`), và chỉ số này cũng phát hiện bộ chuyển đổi không bao giờ trả về thẻ. Nó **được trình xác minh tính lại** đối chiếu với ngữ liệu chuẩn (`verifier.recompute_corpus_morph`, chạy lại FST đã ghim trên thẻ — chuyển sang trạng thái đóng/fail-closed nếu thiếu FST, cùng cơ chế như COMET). Theo điểm tổng hợp đã ngừng sử dụng, nó mang trọng số 0.15 trong hồ sơ fst-coverage (§4.3). |
| `orthographic_accuracy` | Độ chính xác chính tả | 🔲 Đã lên kế hoạch | 0.0–1.0 | Cả hai | **Chẩn đoán (đã lên kế hoạch).** Xác thực tính chuẩn xác theo chữ viết: cách sử dụng dấu vạch ngang/dấu mũ SRO cho tiếng Cree, các dấu phụ cho tiếng Inuktitut, các dấu độ dài nguyên âm cho tiếng Ojibwe. Tập hợp quy tắc riêng cho từng ngôn ngữ. |

> **Những gì các chỉ số cấu trúc bổ sung, và tại sao chúng là các chẩn đoán.** Hệ thống OMT-1600 của Meta — hệ thống dịch máy lớn nhất từng được công bố (1.600 ngôn ngữ; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — đánh giá bằng ChrF++, xCOMET, MetricX và BLASER 3. Không có chỉ số nào trong số này xác thực tính đúng đắn về hình thái học: chrF++ đo lường độ trùng lặp n-gram ký tự và cộng điểm cho các chuỗi *trông giống* với chuỗi tham chiếu, do đó một từ không hợp lệ về mặt hình thái nhưng chia sẻ nhiều ký tự với chuỗi tham chiếu vẫn nhận được điểm. Chấp nhận FST trả lời cho một câu hỏi khác: mỗi từ có phải là một dạng hợp lệ trong ngôn ngữ đó không? Điều đó làm cho nó trở thành một chẩn đoán hữu ích cho các ngôn ngữ đa tổng hợp (polysynthetic). Nó không phải là điểm số dịch thuật: nó không bao giờ nhìn vào văn bản nguồn hay chuỗi tham chiếu, do đó một hệ thống in ra một câu hợp lệ duy nhất cho mọi đầu vào vẫn vượt qua nó hoàn toàn (§4 đưa ra trường hợp đã đo lường). ChrF++ cũng có một **mức sàn ngẫu nhiên khác 0** thay đổi tùy theo hệ thống chữ viết — văn bản ngẫu nhiên có cùng chữ viết đạt điểm cao hơn 0 một cách rõ rệt, ở một số hệ thống chữ viết còn cao hơn những hệ thống khác — do đó chrF++ thô không thể so sánh được giữa các ngôn ngữ; nó chỉ xếp hạng các hệ thống trên cùng một tập đánh giá. Bản đồ mạng do đó **không** xếp hạng độ mạnh giữa các ngôn ngữ — một đường nối chỉ biểu thị cặp ngôn ngữ đó đã được đo lường, không có gì hơn. Phép hiệu chỉnh mức sàn ngẫu nhiên mà chúng tôi xây dựng cho mục đích này (cchrF++) là nghiên cứu đã công bố và không được gắn vào bất kỳ bề mặt công khai nào; [Độ mạnh kết nối](/docs/network/specifications/connection-strength) giải thích những gì nó xác lập và những gì không.

### 2.3 Chỉ số Ngữ nghĩa (Semantic Metrics)

Các chỉ số ngữ nghĩa đo lường sự bảo toàn ý nghĩa bằng cách sử dụng các embedding hoặc các mô hình đã được huấn luyện. Chúng phát hiện các bản dịch khác nhau về bề mặt nhưng tương đương về ý nghĩa, và gắn cờ các bản dịch tương đồng về bề mặt nhưng sai về ngữ nghĩa.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Độ tương đồng ngữ nghĩa | ⚡ Một phần | 0.0–1.0 | Cả hai | **Chẩn đoán.** CRK: điểm số tính theo trọng số phán quyết từ `CrkSemanticMetric` của tiêu chuẩn đánh giá CRK (trong `eval_standards/crk/`, ủy nhiệm). Toàn cầu: độ tương đồng cosine của embedding câu (nguồn + dự đoán so với nguồn + tham chiếu). Mô hình sẽ quyết định sau — phải hỗ trợ các ngôn ngữ ít tài nguyên, điều này loại trừ hầu hết các mô hình embedding tập trung vào tiếng Anh. |
| `comet_score` | COMET | ✅ Đã triển khai | ~0.0–1.0 | Cả hai | **Chỉ số chuẩn khi được tính toán, hiển thị bên cạnh chrF++ cùng với model id** (`comet_model`). Chỉ số đánh giá MT học sâu (Rei et al. 2020). Không bao giờ gộp chung với chrF++. Được trình xác minh tính lại, do đó giá trị được báo cáo phải tái lập được. Được gắn cờ cảnh báo hiệu chỉnh cho ngôn ngữ ít tài nguyên như tiếng Plains Cree. Được tính toán khi `unbabel-comet` được cài đặt. Đối với 35 ngôn ngữ châu Phi, bộ khung kiểm thử sẽ tự động chọn AfriCOMET (`masakhane/africomet-mtl`) thông qua `resolve_comet_model()`, vốn có mức tương quan đánh giá của con người tốt hơn cho các ngôn ngữ đó. |

> **Tại sao COMET nằm bên cạnh chỉ số tiêu đề chứ không phải là chỉ số tiêu đề.** COMET được huấn luyện trên dữ liệu đánh giá của con người từ WMT, chủ yếu là các cặp ngôn ngữ châu Âu nhiều tài nguyên. Đối với các cặp ngôn ngữ thực sự nhiều tài nguyên (tiếng Đức, tiếng Pháp, …) thì `Unbabel/wmt22-comet-da` mặc định đã được WMT xác thực kỹ lưỡng, và `resolve_comet_model()` sẽ chọn nó. Khi áp dụng cho tiếng Plains Cree hoặc các ngôn ngữ ít tài nguyên khác, mô hình sẽ ngoại suy từ các ngôn ngữ có hệ thống hình thái học khác biệt — có ích về mặt định hướng nhưng chưa được hiệu chỉnh, và thẻ ghi rõ điều đó. Nó cũng cần một mô hình nặng 2,3 GB, nên không được tính toán cho mọi lượt chạy. chrF++ có thể tái lập từ ngữ liệu đơn thuần cho mọi ngôn ngữ, đó là lý do tại sao nó là chỉ số tiêu đề và COMET được báo cáo bên cạnh bất cứ khi nào được tính toán.

> **AfriCOMET cho các ngôn ngữ châu Phi.** Mỗi thẻ ngôn ngữ có một trường `metricModelSupport` (xem đặc tả thẻ ngôn ngữ §9) khai báo mô hình COMET chuyên biệt nào được huấn luyện cho ngôn ngữ đó. Đối với 35 ngôn ngữ châu Phi (yor, hau, ibo, amh, swa, v.v.), thẻ khai báo AfriCOMET (`masakhane/africomet-mtl`) — một mô hình COMET được tinh chỉnh trên các đánh giá của con người về dịch máy ngôn ngữ châu Phi bởi cộng đồng Masakhane. Hệ thống kiểm thử tự động chọn mô hình được đề xuất thông qua `resolve_comet_model()` đọc từ các thẻ ngôn ngữ, nhưng điều này có thể được ghi đè bằng `--comet-model`. Việc thêm các ánh xạ ngôn ngữ→mô hình mới được thực hiện bằng cách làm phong phú thẻ ngôn ngữ (không phải chỉnh sửa mã nguồn Python).

### 2.4 Chỉ số Hành vi (Behavioral Metrics)

Các chỉ số hành vi giúp phát hiện các dạng lỗi cụ thể trong kết quả dịch. Chúng không đo lường trực tiếp chất lượng — chúng phát hiện các vấn đề. Tất cả chúng đều là các **chỉ số chẩn đoán**.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Tỷ lệ chuyển mã | ✅ Đã triển khai | 0.0–1.0 (càng thấp càng tốt) | Cả hai | Tỷ lệ các từ đầu ra thuộc ngôn ngữ nguồn (thường là tiếng Anh). Được phát hiện thông qua phân tích chữ viết Unicode và/hoặc danh sách từ của ngôn ngữ nguồn. Dạng lỗi rất phổ biến của LLM: mô hình chèn các từ tiếng Anh khi không biết từ tương đương trong ngôn ngữ đích. |
| `hallucination_rate` | Tỷ lệ ảo giác | ✅ Đã triển khai | 0.0–1.0 (càng thấp càng tốt) | Cả hai | Tỷ lệ nội dung đầu ra không có nội dung nguồn tương ứng. Được phát hiện thông qua căn chỉnh từ hoặc độ trùng lặp embedding đa ngôn ngữ. Bắt lỗi mô hình tạo ra các bản dịch nghe có vẻ hợp lý nhưng là bịa đặt. |
| `terminology_adherence` | Tuân thủ thuật ngữ | ✅ Đã triển khai | 0.0–1.0 | Cả hai | Dành cho các phương pháp có huấn thị (coached methods): tỷ lệ các thuật ngữ quy định xuất hiện trong đầu ra. Yêu cầu một bảng thuật ngữ (`{"source term": "translation"}`, hoặc danh sách các bản dịch được chấp nhận cho mỗi thuật ngữ). Nguồn là `--glossary <file.json>`, một đầu vào đánh giá không bao giờ được gửi tới mô hình và được cung cấp cho mọi lượt chạy đem ra so sánh. Nếu không, nó là đối tượng `dictionary` của một JSON `--coaching-file`: lượt chạy sau đó được chấm điểm dựa trên huấn thị của chính nó, và đầu ra lượt chạy ghi rõ điều đó. Nếu không có cả hai, chỉ số này không hoạt động (null). Đo lường xem mô hình có tôn trọng từ vựng do chuyên gia cung cấp hay không. |
| `consistency_score` | Nhất quán giữa các mục | 🔲 Đã lên kế hoạch | 0.0–1.0 | Chỉ ở cấp ngữ liệu | Mô hình có dịch cùng một thuật ngữ nguồn theo cùng một cách trên các mục khác nhau không? Độ nhất quán thấp cho thấy mô hình đang đoán mò thay vì áp dụng các mẫu đã học. Đòi hỏi các thuật ngữ lặp lại trên các mục trong ngữ liệu. |

### 2.5 Chỉ số Tuân thủ (Compliance Metrics)

Các chỉ số tuân thủ xác thực việc bản dịch có giữ nguyên tính toàn vẹn về cấu trúc hay không — phần giữ chỗ (placeholder), định dạng và các quy ước in ấn. Chúng là các bước kiểm tra cổng chất lượng chứ không phải điểm chất lượng, và là các chỉ số chẩn đoán theo tiêu chuẩn.

| ID | Chỉ số | Trạng thái | Thang đo | Cấp độ | Triển khai |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Tuân thủ Double-Pass | 🔲 Đã lên kế hoạch | 0.0–1.0 | Cả hai | Điểm tổng hợp có trọng số: 60% tính toàn vẹn biến (các biến `{placeholder}` có được giữ nguyên không?) + 20% tuân thủ dấu ngoặc kép (ký tự ngoặc kép của ngôn ngữ đích) + 20% tuân thủ chữ hoa/thường (không bị rò rỉ chữ cái Latinh cho các ngôn ngữ không phân biệt hoa thường). Được tính toán trên cả đầu ra thô và đầu ra sau xử lý. Một lớp `DoublePassCompliancePlugin` đã tồn tại, nhưng không có lượt chạy đánh giá nào tải nó, và chưa có nguồn trích dẫn nào cho các quy ước ngoặc kép và chữ hoa/thường theo từng ngôn ngữ. Các thẻ ngôn ngữ không mang các thông tin này. Nếu không có nguồn đó, chỉ có số hạng về tính toàn vẹn biến là đo lường được kết quả. |
| `repair_effectiveness` | Hiệu quả sửa lỗi | 🔲 Đã lên kế hoạch | 0.0–1.0 | Ngữ liệu | Tỷ lệ các vi phạm tuân thủ được tự động sửa chữa bởi các hook sau dịch thuật. Đo lường mức độ cổng chất lượng cải thiện đầu ra thô. Được lên kế hoạch vì lý do tương tự như `compliance_index`. |

> **Tại sao tuân thủ là một cổng chứ không phải là điểm số.** Các chỉ số tuân thủ đo lường việc bảo toàn cấu trúc (placeholder, dấu ngoặc kép), chứ không phải chất lượng dịch thuật. Một bản dịch có thể hoàn hảo về mặt ngôn ngữ nhưng lại thất bại trong việc tuân thủ vì đã làm mất một biến `{name}`. Chúng được thiết kế như những cổng chất lượng để ngăn chặn đầu ra kém được phát hành, chứ không phải để xếp hạng chất lượng dịch.

### 2.6 Các chỉ số so sánh được báo cáo

spBLEU là một trong những chỉ số chuẩn được hiển thị bên cạnh chrF++; chrF thuần túy và chỉ số so sánh kiểu FUSE được báo cáo để đối chiếu với các bảng đã công bố khác. Không có chỉ số nào trong số chúng được gộp chung với bất kỳ thứ gì khác:

| ID | Chỉ số | Trạng thái | Ghi chú |
|----|--------|--------|-------|
| `spbleu` | spBLEU (bộ phân tách từ FLORES-200) | ✅ Đã triển khai | **Chỉ số chuẩn, hiển thị bên cạnh chrF++** (`scores.spbleu`, kèm theo chữ ký sacreBLEU). BLEU trên phân đoạn SentencePiece của FLORES-200 (Goyal et al. 2022) — có thể so sánh giữa các hệ chữ viết/cách phân đoạn (ngôn ngữ chung của NLLB/FLORES). Cần `sentencepiece` (phụ thuộc cốt lõi). |
| `chrf_plain` | chrF thuần túy (`word_order=0`) | ✅ Đã triển khai | Con số chrF mà AmericasNLP và nhiều bảng WMT báo cáo, song hành cùng chỉ số tiêu đề chrF++ của chúng tôi (`word_order=2`). Chữ ký của nó là `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | Chỉ số so sánh kiểu FUSE | ⚡ Tùy chọn (`--fuse`) | Một **bản triển khai lại CHƯA QUA HUẤN LUYỆN** của phương pháp FUSE AmericasNLP-2025 (Raja & Vats): ngữ nghĩa LaBSE + F1 token từ vựng + Soundex ngữ âm + difflib mờ, được gộp lại dưới dạng *trung bình không trọng số* (chúng tôi không có dữ liệu huấn luyện đánh giá từ con người để khớp với Ridge/GBM gốc, và chúng tôi nêu rõ điều đó). LaBSE/Soundex là phần mở rộng `fuse` tùy chọn; nếu không có LaBSE, `compute_fuse` sẽ trả về `None` (được công khai) thay vì làm giả điểm số. Mỗi thành phần đã chạy được liệt kê trong `fuse_components`; kết quả được gắn cờ `fuse_untrained=true`. Chỉ đóng vai trò là chỉ số so sánh chẩn đoán. |

### 2.7 Không gian tên Chỉ số (Metric Namespaces) {#2-7-metric-namespaces}

Một chỉ số đơn lẻ mang tối đa bốn tên phối hợp trên toàn bộ hệ thống:
**id chuẩn** (khóa `scores` trong thẻ chạy, ví dụ: `equivalent_match_rate`),
**tên plugin** Python tính toán nó (ví dụ: `crk_linter`),
**khóa `evalMetrics`** của thẻ ngôn ngữ khai báo nó (ví dụ: `lyss-eq`), và
**cột `run_cards`** đã được phi chuẩn hóa trên bảng xếp hạng (ví dụ: `equivalent_match_rate`). Chúng
được phân biệt một cách có chủ ý — tên plugin nêu rõ *công cụ*, id chỉ số nêu rõ
*phép đo* — nhưng chúng phải luôn đồng bộ với nhau.

Nguồn thông tin chuẩn xác duy nhất cho ánh xạ đó là `shared/metric-registry.json`, được tải
bởi `mt_eval_harness.metric_manifest`. Mỗi mục ghi lại bốn tên cộng với `scale`,
`direction` (cao hơn/thấp hơn/trung tính), `level` (từng mục/ngữ liệu/cả hai), `in_composite`
(liệu nó có nằm trong điểm tổng hợp đã ngừng sử dụng hay không; được giữ lại để xác minh các thẻ cũ), và
`verifier_reproducible`. Kiểm thử tính tương đồng sẽ thất bại nếu các bảng của `scoring.py` hoặc
các khóa `scores` của run-card do `publish.py` tạo ra bị lệch khỏi sổ đăng ký (registry), do đó một
chỉ số mới không thể xuất xưởng khi mới chỉ được kết nối một nửa.

Hai trường thẻ chạy liên quan giúp làm rõ nguồn gốc chỉ số:

- **`scores.metric_availability`** — một khối `{metric: reason}` giúp phân định rõ ràng điểm số
  `null`: `not_applicable` (ngôn ngữ/lượt chạy không sử dụng nó), `unavailable`
  (thiếu một phụ thuộc tùy chọn), `below_coverage_floor` (có xuất hiện nhưng quá
  thưa thớt nên chỉ mang tính tham khảo), `not_run` (tính năng tự chọn và không được yêu cầu), hoặc
  `not_implemented` (đã lên kế hoạch). Một chỉ số không có trong khối này được hiểu là đã được tính toán bình thường.
- **`fst_version`** / **`fst_provenance`** — bản phát hành bộ chuyển đổi GiellaLT đã cài đặt
  và phiên bản `pyhfst` đằng sau bất kỳ chỉ số nào bắt nguồn từ FST, được ghi lại cùng cách
  với các chữ ký sacreBLEU để điểm cấu trúc có thể được truy nguyên về bản dựng bộ phân tích
  chính xác. `fst_provenance.acceptance_method` nêu rõ cách thức tính toán tỷ lệ chấp nhận
  từ các câu trả lời của bộ chuyển đổi (`case-fallback/1`, §1); thẻ không có
  mục này đã được chấm điểm có phân biệt chữ hoa/thường.
- **`scores.sacrebleu_signatures`** — chữ ký sacreBLEU của mọi
  chỉ số sacreBLEU mà lượt chạy đã tính toán: `chrf` (tiêu đề chrF++,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Hai con số chrF++ chỉ có thể
  so sánh được khi chữ ký của chúng khớp nhau (Post 2018).

### 2.8 Các cảnh báo điểm số {#2-8-score-caveats}

Một điểm số có thể được tính toán chính xác nhưng vẫn không phản ánh đúng ý nghĩa mà nhãn của nó thể hiện.
Bộ khung kiểm thử sẽ kiểm tra mọi lượt chạy để tìm các trường hợp đã biết dẫn đến điều đó và khi phát hiện,
nó sẽ in cảnh báo bên cạnh tiêu đề trong phần tóm tắt kiểm thử, `mt-eval compare`,
bản xem trước khi xuất bản và trang tổng quan, đồng thời thẻ đã xuất bản sẽ mang thông tin đó dưới dạng
`score_caveats` để bảng xếp hạng cũng hiển thị nó. Một cảnh báo không bao giờ làm thay đổi điểm số;
nó cho biết điều gì đang hạn chế điểm số đó. Mỗi cảnh báo là một chẩn đoán có `severity` (`major` hoặc
`minor`) và một thông điệp gồm một câu nêu rõ số lượng, tuyệt đối không trích dẫn chính các kết quả đầu ra.

| Cảnh báo | Kích hoạt khi |
|--------|-----------|
| `source_copy` | Ít nhất một nửa số đầu ra được chấm điểm trùng khớp với nguồn của chúng (bỏ qua chữ hoa/thường, dấu trọng âm và dấu câu). Một mục có chuỗi tham chiếu chính là nguồn (tên riêng, số) sẽ được loại trừ. |
| `length_deflation` | Các đầu ra có độ dài trung bình dưới 0,5× độ dài tham chiếu, hoặc có từ 1/4 số đầu ra trở lên rơi vào tình trạng này — các từ đã bị bỏ sót. Tỷ lệ chấp nhận FST và chuyển mã chỉ đánh giá các từ xuất hiện, vì vậy việc bỏ bớt từ sẽ làm tăng các chỉ số này. |
| `length_inflation` | Các đầu ra có độ dài trung bình trên 2× độ dài tham chiếu, hoặc có từ 1/4 số đầu ra trở lên rơi vào tình trạng này (ví dụ: các ví dụ few-shot bị rò rỉ vào mọi đầu ra). |
| `near_constant_output` | Một đầu ra duy nhất được đưa ra cho nhiều đầu vào khác nhau: các trường hợp lặp lại chiếm ít nhất 1/4 số nguồn phân biệt và tối thiểu là 5 nguồn. Một đầu ra được tính là lặp lại khi có 3 nguồn nhận cùng một kết quả (đầu ra từ ba từ trở lên) hoặc 5 nguồn (đầu ra một hoặc hai từ, vì các câu trả lời ngắn như "Yes." có thể tái diễn một cách hợp lệ); đầu ra trùng với chuỗi tham chiếu của chính nó là câu trả lời đúng, không phải là lặp lại. Trước khi chọn các mốc giới hạn đó, quy tắc này đã được chạy thử nghiệm trên 2.161 đầu ra hệ thống thực tế và chuỗi tham chiếu từ các nhiệm vụ chỉ số WMT 2019–2025; năm trường hợp mà nó gắn cờ đều là đầu ra bị lỗi. |
| `train_test_near_twin` | Được ghi nhận bởi nmt-forge: mọi (hoặc gần như mọi) hàng kiểm thử đều có một hàng gần như giống hệt trong dữ liệu huấn luyện, vì vậy điểm số đo lường khả năng nhớ lại các cụm từ huấn luyện chứ không phải khả năng dịch. |

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

## 4. Đã ngừng sử dụng: Điểm tổng hợp (cũ) {#4-composite-score}

> [!CAUTION]
> **Không có lượt chạy mới nào được chấm điểm bằng điểm tổng hợp.** Nó đã bị ngừng sử dụng bởi tiêu chuẩn chấm điểm `standard/1` ([Cách chấm điểm các lượt chạy](#how-runs-are-scored)). Các thẻ mới công bố `composite: null`. Phần này **chỉ** được giữ lại để các thẻ được công bố trước tiêu chuẩn vẫn có thể đọc và xác minh được: trình xác minh sẽ tính lại điểm tổng hợp đã lưu của bất kỳ thẻ nào không mang `scores.scoring_standard`, với chính xác công thức và các bảng bên dưới. Bất cứ nơi nào điểm tổng hợp của thẻ cũ vẫn được hiển thị, nó sẽ được dán nhãn **legacy composite (retired)**, và không bao giờ được so sánh với chrF++ hoặc với một thẻ mới.

### Lý do ngừng sử dụng {#why-the-composite-was-retired}

Điểm tổng hợp từng là sự kết hợp có trọng số của chrF++/100, khớp chính xác, tỷ lệ chấp nhận FST (trọng số 0.25), độ chính xác hình thái học, điểm ngữ nghĩa, chuyển mã, ảo giác và thuật ngữ, với các trọng số được đặt theo đánh giá kỹ thuật và chưa bao giờ được khớp với các đánh giá của con người. Vì một số đầu vào của nó không bao giờ so sánh đầu ra với nguồn hoặc chuỗi tham chiếu, một hệ thống có thể nhận được phần lớn số điểm mà không thực sự dịch:

- **Một câu duy nhất cho mọi đầu vào.** Một mô hình tiếng Anh→Bắc Sámi chưa qua huấn luyện lặp lại đúng một câu tiếng Bắc Sámi hợp lệ cho mọi đầu vào đã đạt điểm tổng hợp là **0.6244** — được dán nhãn "functional" — với **chrF++ là 5.5**. Các từ lặp lại là tiếng Sámi hợp lệ, vì vậy tỷ lệ chấp nhận FST là 100%, và đối với một ngôn ngữ có FST là bộ chấp nhận kiểm tra chính tả, tỷ lệ chấp nhận FST chiếm khoảng 45% điểm tổng hợp sau khi các chỉ số vắng mặt được phân bổ lại trọng số.
- **Bỏ qua những gì không dịch được.** Một bảng thuật ngữ thử nghiệm bỏ qua mọi từ mà nó không biết đã đạt điểm **0.6612**, vì tỷ lệ chấp nhận FST và chuyển mã chỉ đánh giá các từ mà một đầu ra chứa.
- **Sao chép văn bản nguồn.** Tiếng Anh được sao chép nguyên vẹn sang đầu ra "tiếng Bắc Sámi" vẫn nhận được điểm FST, vì bộ kiểm tra chính tả chấp nhận các từ viết hoa và một số từ tiếng Anh.

Không có đánh giá chuẩn mực nào lại xếp các hệ thống này cao hơn một bản dịch thực sự, và chrF++ cũng không làm vậy: nó so sánh mọi đầu ra với chuỗi tham chiếu tương ứng. Các cảnh báo của bộ khung kiểm thử (§2.8) cũng bắt được các mẫu này và luôn hiển thị nổi bật bên cạnh tiêu đề chrF++.

### 4.1 Công thức (cũ)

Điểm tổng hợp từng là giá trị trung bình có trọng số của tất cả các chỉ số *khả dụng*, được chuẩn hóa lại để tổng trọng số của các chỉ số khả dụng bằng 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Một chỉ số được coi là "khả dụng" nếu giá trị của nó trong run card là một con số (không phải `null`). Khi một chỉ số không khả dụng — do ngôn ngữ không có FST, hoặc do chỉ số đó chưa được triển khai — trọng số của nó sẽ được phân phối lại theo tỷ lệ cho các chỉ số còn lại. Điểm tổng hợp được tính từ các tập chỉ số khác nhau không bao giờ có thể so sánh được với nhau; mỗi thẻ cũ đều ghi lại `scores.scoring_profile` và `scores.metric_availability` của nó (§2.7), để trình xác minh biết cần sử dụng tập chỉ số nào.

### 4.2 Chuẩn hóa đầu vào (cũ)

Trước khi đưa vào công thức tính điểm tổng hợp, mỗi chỉ số đều được đưa về **thang điểm 0.0–1.0** với 1.0 = hoàn hảo:

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

### 4.3 Các bảng trọng số (cũ) {#43-weight-tables}

Mỗi ngôn ngữ được phân giải thành một **hồ sơ có tên** thông qua `language_cards.resolve_scoring_profile()` (`fst-coverage` khi FST chấm điểm lượt chạy, nếu không thì là `surface-only`, trừ khi thẻ ngôn ngữ khai báo `scoringProfile.basis`); hồ sơ này được phản ánh trong `PROFILE_REGISTRY` của `scoring.py` và được ghi lại trên mỗi thẻ cũ dưới dạng `scores.scoring_profile`. `orthographic_accuracy` được liệt kê trong `scoring.INACTIVE_METRICS` và chưa bao giờ được tính toán, vì vậy trọng số của nó luôn được phân phối lại. `morphological_accuracy` chỉ được tính vào khi `morph_coverage ≥ 0.25`. Các chỉ số nơ-ron (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) chưa từng nằm trong bất kỳ điểm tổng hợp nào.

#### `fst-coverage` (Cấu hình A): Các ngôn ngữ CÓ Độ bao phủ FST

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

> **Tổng cộng: 1.00.** Khi vắng mặt `morphological_accuracy` (không có bộ phân tích FST, FST chỉ là bộ chấp nhận, hoặc độ bao phủ dưới 0.25), 8 chỉ số còn lại (tổng 0.85) được nhân theo tỷ lệ 1/0.85 ≈ 1.176. Đối với một ngôn ngữ chỉ có FST là bộ chấp nhận (tiếng Bắc Sámi, Amharic, Basque) không có tiêu chuẩn đánh giá và không có bảng thuật ngữ, chỉ còn lại chấp nhận FST 0.25, chrF++ 0.15, chuyển mã, ảo giác và khớp chính xác (mỗi loại 0.05) — tổng cộng 0.55 — do đó việc chấp nhận FST chiếm **0.25/0.55 ≈ 45%** điểm tổng hợp. Đó chính là tỷ trọng mà các ví dụ nêu trên đã lợi dụng.

#### `surface-only` (Cấu hình B): Các ngôn ngữ KHÔNG CÓ Độ bao phủ FST

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

> **Tổng cộng: 1.00.** `orthographic_accuracy` chưa bao giờ được tính toán, vì vậy 7 chỉ số còn lại (tổng cộng 0.95) đã được nhân theo tỷ lệ 1/0.95 ≈ 1.053.

#### `no-reference`: Các lượt chạy KHÔNG CÓ tham chiếu gold

| Chỉ số | Trọng số Mục tiêu | Lý do |
|--------|-------------------|-------|
| `fst_acceptance_rate` | **0.40** | Tính hợp lệ hình thái không cần tham chiếu; tín hiệu tất định mạnh nhất khi có FST. |
| `code_switching_rate` | **0.25** | Rò rỉ ngôn ngữ nguồn (đảo ngược). |
| `hallucination_rate` | **0.20** | Nội dung bịa đặt (đảo ngược). |
| `terminology_adherence` | **0.15** | Tuân thủ từ vựng có hướng dẫn. |

> **Tổng cộng: 1.00.** Dành cho các lượt chạy mà ngữ liệu không có chuỗi tham chiếu vàng. Khi một lượt chạy như vậy không có FST, điểm tổng hợp sẽ được chuẩn hóa lại chỉ dựa trên các kiểm tra hành vi.

### 4.4 Thêm chỉ số mới

Một chỉ số mới được thêm vào dưới dạng **chẩn đoán**; nó không bao giờ thay đổi chỉ số tiêu đề:

1. **Định nghĩa chỉ số** trong §2 với trạng thái `🔲 Planned`, bao gồm thang đo, cấp độ, chiều hướng và phương pháp tính toán.
2. **Triển khai chỉ số** dưới dạng MetricPlugin (hoặc trong `tester.py` cho các chỉ số cốt lõi).
3. **Đăng ký chỉ số** trong `shared/metric-registry.json` và thêm một phần giữ chỗ null trong khối điểm số của run card.
4. **Cập nhật BENCHMARK_SPEC.md** §3 nếu lược đồ run card thay đổi.
5. **Chạy benchmark xác thực** để xác nhận chỉ số tạo ra các giá trị hợp lý trên dữ liệu thực tế.
6. **Cập nhật tài liệu này** để chuyển trạng thái từ `🔲` sang `✅`.

Việc thay đổi chỉ số tiêu đề hoặc xếp hạng không phải là "thêm chỉ số": việc này cần một phiên bản tiêu chuẩn chấm điểm mới ([Cách chấm điểm các lượt chạy](#how-runs-are-scored)).

---

## 5. Đã ngừng sử dụng: Phân tầng chất lượng (cũ) {#5-quality-tiers}

> [!CAUTION]
> **Không có thẻ mới nào mang phân tầng chất lượng.** Thẻ mới công bố `quality_tier: null`, và không có đầu ra mới nào in ra phân tầng hay nhãn như "functional" hoặc "deployable". Điểm số tự động không phải là phán quyết về chất lượng: cùng một con số mang ý nghĩa khác nhau đối với các ngôn ngữ và tập đánh giá khác nhau, và các phân tầng đã ngừng sử dụng từng gắn nhãn cho một hệ thống lặp lại một câu duy nhất cho mọi đầu vào là "functional" (§4). Chỉ có đánh giá từ con người bởi những người bản ngữ mới chứng nhận chất lượng ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

Các phân tầng từng là các nhãn được đọc ra từ điểm tổng hợp cũ. Các thẻ cũ vẫn lưu trữ chúng; chúng được giữ lại ở đây chỉ để có thể đọc hiểu thẻ cũ, và không phải là các khẳng định về chất lượng.

| Phân tầng cũ | Khoảng điểm tổng hợp cũ |
|------|----------------|
| Baseline | 0.00–0.30 |
| Emerging | 0.30–0.50 |
| Functional | 0.50–0.70 |
| Deployable | 0.70–0.85 |
| Fluent | 0.85–1.00 |

### 5.1 Ngưỡng phân tầng (Dành cho máy đọc, cũ)

Các ngưỡng cũ (được đánh giá từ trên xuống dưới, điều kiện khớp đầu tiên sẽ áp dụng):

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

Các chỉ số chi phí đo lường hiệu quả tài chính của một phương pháp dịch. Chúng được báo cáo bên cạnh điểm số và không bao giờ kết hợp với điểm số.

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

### 6.3 Điểm điều chỉnh theo chi phí (đã ngừng sử dụng)

Các thẻ cũ mang điểm điều chỉnh theo chi phí, được tính từ điểm tổng hợp đã ngừng sử dụng:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Chỉ số này đã ngừng sử dụng cùng với điểm tổng hợp: các thẻ mới công bố `cost_adjusted: null`. Để cân nhắc giữa chi phí và chất lượng, hãy đọc song song chrF++ (cùng với CI của nó) và `cost_per_entry_usd`; bảng xếp hạng có thể sắp xếp theo bất kỳ tiêu chí nào trong hai tiêu chí này.

---

## 7. Chỉ số Tốc độ (Speed Metrics)

Các chỉ số tốc độ đo lường độ trễ và thông lượng của một phương pháp dịch. Giống như chi phí, tốc độ được báo cáo bên cạnh điểm số và không bao giờ kết hợp với điểm số.

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

Các khoảng tin cậy là các khoảng bootstrap phân vị trên các phân đoạn của tập đánh giá (n=1000 lần lấy mẫu lại, α=0.05; Koehn 2004). Khoảng tin cậy của chrF++ là một phần của tiêu đề: `chrF++ 47.5 [45.9, 49.0]`. Với một tập đánh giá nhỏ, khoảng tin cậy sẽ rộng, và bộ khung kiểm thử sẽ cảnh báo khi một tập con quá nhỏ để có thể tạo ra một khoảng tin cậy có ý nghĩa.

| Chỉ số | CI được báo cáo |
|--------|------------|
| `chrf_plus_plus` (tiêu đề) | ✅ run card `confidence_intervals.corpus_chrf`; cơ sở dữ liệu `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (chỉ được tính khi có dữ liệu FST) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (được bootstrap từ điểm số từng mục được lưu trong bộ nhớ đệm — không suy luận nơ-ron dư thừa) |
| `composite` | Chỉ trên thẻ cũ (`composite_ci_lower`, `composite_ci_upper`); không được tính cho các lượt chạy mới |
| CI theo phân tầng | ✅ `confidence_intervals_by_tier` — CI của chrF++ và exact_match theo từng mức độ khó (Phân tầng 1-5) |

### 8.2 Kiểm định ý nghĩa thống kê theo cặp {#82-paired-significance-tests}

Việc một lượt chạy có tốt hơn một lượt chạy khác hay không được quyết định bởi kiểm định ý nghĩa thống kê theo cặp trên chrF++ đối với các phân đoạn mà cả hai lượt chạy đều đã dịch, không bao giờ bằng cách so sánh hai con số đơn thuần. Lệnh `mt-eval compare --significance` chạy:

- **Ngẫu nhiên hóa xấp xỉ** (mặc định; Riezler & Maxwell 2005, cũng là mặc định của sacreBLEU): đầu ra của hai hệ thống được hoán đổi ngẫu nhiên theo từng phân đoạn, 1.000 lần, để xem tần suất xuất hiện một sự khác biệt lớn ít nhất như vậy do ngẫu nhiên.
- **Lấy mẫu lại bootstrap theo cặp** (`--method paired_bootstrap`; Koehn 2004): các phân đoạn được lấy mẫu lại có hoàn lại và sự khác biệt được tính lại trên mỗi mẫu. Đây là ước tính thận trọng hơn, được cung cấp để so sánh với các bài báo cũ hơn.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Mỗi sự khác biệt đều đi kèm với khoảng tin cậy 95% và được báo cáo là có ý nghĩa thống kê khi p < 0.05. BLEU, spBLEU, TER và các chẩn đoán có mặt trong cả hai lượt chạy cũng được kiểm định và hiển thị (các giá trị p là theo từng chỉ số và không được điều chỉnh cho nhiều phép kiểm định), nhưng phán quyết về việc hệ thống nào "tốt hơn" là dựa trên kiểm định chrF++. Hai con số chrF++ chỉ có thể so sánh được khi chữ ký sacreBLEU của chúng khớp nhau. Nếu một trong các báo cáo được so sánh là báo cáo cũ, lệnh so sánh sẽ thông báo rằng điểm tổng hợp của nó đã ngừng sử dụng và không thực hiện so sánh. Phương pháp đầy đủ: [Kiểm định ý nghĩa thống kê](/docs/network/specifications/significance).

---

## 9. Lược đồ Điểm số Thẻ chạy (Run Card Scores Schema)

Phần này định nghĩa cấu trúc phân cấp của khối `scores` trong một thẻ chạy. Lược đồ này được dẫn xuất từ các chỉ số được định nghĩa trong §2–§7 và phải được giữ đồng bộ.

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

Các cảnh báo điểm số (§2.8) nằm ở cấp cao nhất của thẻ dưới dạng `score_caveats`, một danh sách các đối tượng `{kind, source, severity, message, …}`; BLEU nằm ở đó dưới dạng `corpus_bleu`.

> **Lịch sử lược đồ.** Các bản thảo đặc tả trước đây đã đề xuất các khối `cost`, `speed`, và `tokens` riêng biệt. Chúng đã được gộp tương ứng vào `scores` và `totals` để đơn giản hóa. Các chỉ số tốc độ (`tokens_per_second`, `entries_per_minute`, độ trễ) sống trong `scores`; số lượng token và số liệu chi phí sống trong `totals`.

### 9.1 Ánh xạ Lược đồ–Cơ sở dữ liệu

JSON của thẻ chạy được lưu trữ đầy đủ dưới dạng một cột `jsonb` trong Supabase. Các chỉ số chính cũng được phi chuẩn hóa thành các cột cấp cao nhất để tối ưu hóa hiệu năng sắp xếp/lọc:

| Trường trong Run Card | Cột trong Supabase | Loại dữ liệu | Chỉ mục |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — chỉ dành cho thẻ cũ; null đối với `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — chỉ dành cho thẻ cũ; null đối với `standard/1` |
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
| *(toàn bộ thẻ)* | `run_card` | `jsonb` | — |

Khi các chỉ số mới được triển khai, cột tương ứng nên được thêm vào thông qua một migration được đánh số trong `arena/migrations/`.

---

## 10. Đồng bộ hóa Mã nguồn–Đặc tả

### 10.1 Nguồn Chuẩn (Canonical Source)

Tài liệu này là nguồn chuẩn xác cho:
- Tiêu chuẩn chấm điểm: chỉ số tiêu đề, các chỉ số chuẩn bên cạnh và các chẩn đoán ([Cách chấm điểm các lượt chạy](#how-runs-are-scored))
- Định nghĩa các chỉ số (§2) và cảnh báo điểm số (§2.8)
- Các bảng trọng số của điểm tổng hợp cũ (§4.3) và các ngưỡng phân tầng (§5.1), được giữ lại để xác minh các thẻ cũ
- Công thức tính các chỉ số chi phí (§6.2)
- Lược đồ điểm số trong run card (§9)

### 10.2 Bản sao trong Mã nguồn (Code Mirror)

Tệp `arena/mt_eval_harness/scoring.py` là bản triển khai mã nguồn của tài liệu này: các vai trò chỉ số của tiêu chuẩn (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) và phía dưới chúng là các bảng điểm tổng hợp cũ cùng các ngưỡng phân tầng chỉ dùng để xác minh các thẻ cũ. Không có mô-đun nào khác định nghĩa chúng; các bài kiểm thử của bộ khung kiểm thử ghim cố định cả hai. Khi tài liệu này được cập nhật, hãy cập nhật `scoring.py` cho khớp và chạy lại các bài kiểm thử của bộ khung kiểm thử.

### 10.3 Các Tài liệu Tham chiếu Đặc tả này

| Tài liệu | Nội dung tham chiếu | Cách duy trì đồng bộ |
|----------|-------------------|---------------------|
| [Đặc tả Benchmark](/docs/network/specifications/benchmark) §4–§5 | Chỉ số tiêu đề, xếp hạng, điểm tổng hợp cũ | Tham chiếu chéo tới tài liệu này; không sao chép trùng lặp các bảng |
| [Kiểm định ý nghĩa thống kê](/docs/network/specifications/significance) | Cách xác định hệ thống "tốt hơn" | Phải khớp với §8.2 |
| [FAQ](/docs/network/getting-started/faq) và [Cách thức hoạt động](/docs/network/how-it-works) | Tóm tắt dễ hiểu về tiêu chuẩn | Liên kết ngược về tài liệu này |
| `publish.py` qua `scoring.py` | `standard_score_fields()` và điểm tổng hợp cũ | Các kiểm thử của bộ khung kiểm thử sẽ xác thực tính trùng khớp |

---

## Phụ lục A: Tại sao chrF++ là chỉ số tiêu đề (và các chỉ số khác thì không)

| Chỉ số | Vai trò | Lý do |
|--------|------|-----|
| **chrF++** | Tiêu đề | N-gram ký tự cho phép tính điểm một phần cho một từ có đúng từ gốc nhưng khác hậu tố, vì vậy nó xử lý hình thái học phong phú tốt hơn các chỉ số cấp từ (Popović 2015, 2017). Nó có thể tái lập từ ngữ liệu đơn thuần cho mọi ngôn ngữ và hệ chữ viết, và là chỉ số mà FLORES-200 cùng các nhiệm vụ chung AmericasNLP báo cáo. |
| **BLEU** | Chuẩn, bên cạnh | Đối sánh cấp từ coi một khác biệt nhỏ về biến tố là hoàn toàn trật, điều này gây bất lợi cho các ngôn ngữ đa tổng hợp. Được báo cáo để đối chiếu với các tài liệu nghiên cứu MT. |
| **spBLEU** | Chuẩn, bên cạnh | BLEU trên cùng một phân đoạn SentencePiece dùng chung, có thể so sánh giữa các hệ chữ viết; được báo cáo bởi FLORES-200. |
| **TER** | Chuẩn, bên cạnh | Khoảng cách chỉnh sửa; có tương quan với chrF++ trong hầu hết các trường hợp sử dụng. |
| **COMET** | Chuẩn, bên cạnh (khi được tính toán) | Được huấn luyện trên dữ liệu WMT (các cặp ngôn ngữ châu Âu nhiều tài nguyên). Đối với các ngôn ngữ ít tài nguyên (ví dụ: tiếng Cree), mô hình ngoại suy và chưa được hiệu chỉnh, đồng thời nó cần một mô hình lớn nên không thể là con số duy nhất mà mọi lượt chạy đều có. Được trình xác minh tính lại. |
| **Tỷ lệ độ dài** | Chẩn đoán | Tỷ lệ 1.02 và 0.98 đều ổn. Chỉ các giá trị cực đoan mới chỉ ra vấn đề (§2.8). |
| **Chấp nhận FST, độ chính xác hình thái học, LYSS** | Chẩn đoán | Các heuristic kỹ thuật không có dữ liệu tương quan với con người; việc chấp nhận FST không bao giờ nhìn vào nguồn hoặc tham chiếu (§4). |
| **Điểm nhất quán** | Chẩn đoán (đã lên kế hoạch) | Một mức độ không nhất quán nhất định là hợp lệ (cùng một từ tiếng Anh → các bản dịch khác nhau trong ngôn ngữ đích tùy thuộc vào ngữ cảnh). |
| **Chỉ số tuân thủ** | Cổng (đã lên kế hoạch) | Đo lường việc bảo toàn cấu trúc (placeholder, dấu ngoặc kép), không phải độ chính xác của bản dịch. |

## Phụ lục B: LYSS — Các Triển khai Chỉ số Đặc thù theo Ngôn ngữ

Khung **LYSS** (Linguistically-informed Yield & Structural Scoring) cung cấp các chỉ số đặc thù theo ngôn ngữ vượt ra ngoài việc so sánh chuỗi ký tự cấp bề mặt. LYSS có ba thành phần cốt lõi:

- **LYSS-fst** — Tính hợp lệ hình thái (`fst_acceptance_rate`): Mỗi từ có phải là một dạng hợp lệ trong ngôn ngữ đích không?
- **LYSS-eq** — Tính tương đương ngôn ngữ học (`equivalent_match_rate`): Đầu ra có phải là một biến thể được chấp nhận của tham chiếu không?
- **LYSS-sem** — Xác thực ngữ nghĩa (`semantic_score`): Đầu ra có bảo toàn ý nghĩa nguồn không?

Cả ba đều là **chẩn đoán** theo tiêu chuẩn chấm điểm: được báo cáo bên cạnh tiêu đề chrF++, không bao giờ nằm trong đó.

> **Trạng thái xác thực: 🔶 Heuristic kỹ thuật.** Các chỉ số LYSS CHƯA được xác thực đối với các đánh giá chất lượng của con người. Chúng được thiết kế từ các nguyên lý ngôn ngữ học (FST, từ điển, quy tắc ngữ pháp được xây dựng bởi các nhà ngôn ngữ học tại UAlberta ALTLab), nhưng mối tương quan giữa điểm số LYSS và chất lượng dịch thuật thực tế chưa được đo lường. Xem [Giao thức Xác thực bởi Người nói](/docs/network/specifications/speaker-validation) để biết các thử nghiệm xác thực bắt buộc.

| Ngôn ngữ | Plugin | Vị trí | Thành phần LYSS | Khóa chỉ số | Ghi chú |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Các quy tắc lớp biến thể tất định: trật tự từ, chính tả, tiểu từ tùy chọn, từ đồng nghĩa theo bổ đề, tính nhập nhằng của thể tiếp diễn, bao gồm/loại trừ. Tạo ra `lint_verdict` cho từng mục (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Tất định: trích xuất bổ đề FST + giải nghĩa từ điển + độ trùng lặp từ nội dung spaCy. Đưa ra phán quyết (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Các ngôn ngữ GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Chung: bất kỳ ngôn ngữ nào có FST được ghim trong bộ khung kiểm thử (`mt_eval_harness/data/fst-pins.json`). Một FST phân tích cũng mang lại `morphological_accuracy`; một bộ kiểm tra chính tả chỉ chấp nhận (các gói Divvun được ghim cho tiếng Bắc Sámi, Amharic và Basque) chỉ báo cáo tỷ lệ chấp nhận. Để được chấm điểm FST trên thực tế cũng cần một tập đánh giá cho cặp ngôn ngữ có khả năng xếp hạng: hai tập của tiếng Plains Cree (EdTeKLA) là các nhãn bị cách ly mà cơ sở dữ liệu từ chối chấm điểm, trong khi một số ngôn ngữ FST khác có các tập mở (Tatoeba, WMT, WMT24++). [Trang tập dữ liệu](/docs/network/leaderboard/datasets) liệt kê danh mục, và `mt-eval corpora --source eng --target <code>` liệt kê những gì có thể chạy cho một cặp ngôn ngữ (xem [Hạn chế trung thực](/docs/network/honest-limitations)). |

> **Ghi chú kiến trúc (Tháng 6 năm 2026).** Các chỉ số LYSS đặc thù theo ngôn ngữ hiện được khai báo trên thẻ ngôn ngữ dưới mục `evalMetrics` và được tải từ `eval_standards/<lang>/` bởi `plugin_discovery.py`. Chúng là **tiêu chuẩn đánh giá** (trọng tài), không phải chỉ số plugin của phương pháp (thí sinh). Điều này có nghĩa là bất kỳ phương pháp dịch thuật nào nhắm vào CRK đều được tự động kiểm tra bởi các chẩn đoán LYSS — không cần cấu hình riêng cho từng phương pháp. `CrkFSTMetric` đã bị loại bỏ; chức năng của nó được bao hàm đầy đủ bởi `GiellaLTFSTMetric` tổng quát.

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

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisbon, Bồ Đào Nha.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Bỉ, Brussels. Triển khai tham chiếu: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Thực hành đánh giá và kiểm định ý nghĩa thống kê

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spain.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; báo cáo chrF++ và spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

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

### Quản trị dữ liệu

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
