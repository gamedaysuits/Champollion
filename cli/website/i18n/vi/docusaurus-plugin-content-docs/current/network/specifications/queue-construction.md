---
sidebar_position: 8
title: "Đặc tả xây dựng hàng đợi"
slug: '/network/specifications/queue-construction'
description: "Công thức minh bạch đằng sau hàng đợi tính toán cộng đồng: xếp hạng theo giá trị chuỗi kỳ vọng, mọi thành phần đều được công bố, mọi thứ hạng đều có thể được tính toán lại bằng tay."
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Đặc tả xây dựng hàng đợi

**Phiên bản công thức: `ecv-v3` (giá trị chuỗi kỳ vọng với độ tin cậy của cầu nối).** Tài liệu này là định nghĩa chuẩn tắc về cách sắp xếp [champollion.dev/queue.json](https://champollion.dev/queue.json). Bản triển khai (`arena/scripts/generate_sweep_queue.py` trong kho lưu trữ harness công khai) phản ánh chính xác từng phần của trang này; siêu dữ liệu (metadata) của hàng đợi lặp lại chính xác các giá trị tham số được sử dụng tại thời điểm tạo, và **mỗi mục đều mang bảng phân tích công thức đầy đủ**, vì vậy bất kỳ thứ hạng nào cũng có thể được tính toán lại bằng tay chỉ từ tệp JSON đã công bố. Nếu trang này và hàng đợi không khớp nhau, đó là một lỗi — vui lòng báo cáo.

**Hàng đợi hôm nay, tóm tắt trong một đoạn văn.** Hàng đợi công khai
chứa cả các mục LLM (điều kiện prompt naive và coached) lẫn các mục
engine dịch vụ MT trên cùng một bảng, được xếp hạng theo thứ tự khảo sát
(`map`, §2.2): ánh sáng đầu tiên trên các cặp, ngôn ngữ và
ngữ hệ trên mỗi đô la, kèm theo mức tăng điểm cho lần đọc đầu tiên đối
với các ngôn ngữ chưa từng được đo lường (§2.2), các bậc ngân sách được
công bố trong bản xem trước (§2.1.1), và thứ hạng hoàn chỉnh được cung
cấp từ cơ sở dữ liệu (tệp tĩnh sẽ chỉ chứa lát cắt trên cùng khi toàn bộ
thứ hạng vượt quá giới hạn kích thước, và sẽ ghi rõ điều đó). Các phần
dưới đây là định nghĩa quy chuẩn, được lưu trữ cùng lịch sử quyết định
theo ngày — siêu dữ liệu trên bất kỳ hàng đợi nào được phục vụ đều nêu rõ
các tham số chính xác đã xếp hạng nó.

> **v3 (13-06-2026).** Mỗi cạnh giờ đây là một *cầu nối* với hai chỉ số — chất lượng và độ tin cậy — và ma trận chuỗi hoạt động dựa trên tích của chúng (§1.5). 62 mục từ vựng đơn từ chạy một lần không còn có thể trông giống như một đường dẫn; các lượt chạy lặp lại (replication), ngữ liệu lớn hơn, ngữ liệu phong phú hơn và khoảng tin cậy hẹp hơn đều mang lại giá trị được định giá rõ ràng. Các hàng đợi v2 (chỉ tính chất lượng) vẫn có thể được diễn giải thông qua siêu dữ liệu riêng của chúng.

## 1. Mục tiêu: một mạng lưới trọng số chất lượng

Mục tiêu là *bản dịch giữa các ngôn ngữ, được xây dựng từ các chuỗi cặp
riêng lẻ đã đo lường*. Bản dịch giữa hai ngôn ngữ chưa có benchmark trực
tiếp sẽ được cung cấp bằng cách **ghép chuỗi** các cặp đã benchmark
(X→pivot→Y), vì vậy giá trị của benchmark không nằm ở số lượng ngữ liệu
mà ở **dung lượng chuỗi của đồ thị của nó**.

**Định nghĩa.** Giả sử *đồ thị điểm chuẩn* có một nút cho mỗi ngôn ngữ và đối với mỗi cặp ngôn ngữ có ít nhất một lượt chạy được công bố và không bị loại, ta có **độ mạnh của cạnh**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

chrF++ ở cấp độ ngữ liệu là con số công bố chuẩn tắc (xem [Đặc tả tính điểm](/docs/network/specifications/scoring)); chọn *tốt nhất* vì một chuỗi sẽ định tuyến qua hệ thống tốt nhất được chứng minh trên mỗi bước nhảy (hop). Các cặp không có lượt chạy nào được công bố sẽ có s(e) = 0.

**Độ mạnh chuỗi ước tính** của một đường dẫn P giữa hai ngôn ngữ là

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— chất lượng các cạnh được kết hợp theo phép nhân, và mỗi *giao lộ* (mỗi ngôn ngữ trung gian - pivot) sẽ tốn thêm một hệ số độ trung thực **λ < 1**. Cả hai lựa chọn này đều dựa trên các tài liệu nghiên cứu về dịch thuật qua ngôn ngữ trung gian: dịch qua một ngôn ngữ trung gian chắc chắn sẽ làm giảm chất lượng so với dịch trực tiếp, vượt ra ngoài những gì phép kết hợp đơn giản gợi ý (Utiyama & Isahara 2007; Wu & Wang 2007), mức độ tổn thất phụ thuộc vào ngôn ngữ trung gian được chọn (Paul et al. 2009), và việc xây dựng các cặp *trực tiếp* không lấy tiếng Anh làm trung tâm mang lại hiệu quả vượt trội rõ rệt so với việc dịch trung gian qua tiếng Anh ở quy mô lớn — khoảng ~10 BLEU trong thiết lập nhiều-sang-nhiều của M2M-100 (Fan et al. 2021). λ là lời nhắc nhở thường trực của công thức rằng một chuỗi ước tính không phải là một phép đo lường: chỉ có lượt chạy trực tiếp mới loại bỏ được mức chiết khấu này.

Khi đó, **ma trận chuỗi tốt nhất** và **mục tiêu mạng lưới** là

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q được tính toán chính xác như một bài toán tìm đường đi ngắn nhất dưới phép biến đổi log chuẩn (trọng số cạnh −ln(λ·s(e)) ≥ 0, Dijkstra, sau đó Q = exp(−d)/λ). Φ là cấu trúc *hiệu suất toàn cầu* của [Latora & Marchiori (2001)](https://arxiv.org/abs/cond-mat/0101396) với hạt nhân 1/khoảng_cách được thay thế bằng độ trung thực chuỗi nhân tính — hạt nhân tự nhiên khi các cạnh mang tỷ lệ duy trì chất lượng trên mỗi bước nhảy thay vì độ dài đơn vị. (Hàng đợi v1 được xếp hạng theo mức tăng hiệu suất toàn cầu không trọng số — trường hợp đặc biệt của họ này khi tất cả những gì bạn biết về một cạnh chỉ là liệu nó có tồn tại hay không.)

### 1.5 Độ tin cậy: một cầu nối là (q, r)

Một hào nhoáng trên một ngữ liệu nhỏ, mỏng, chưa từng được chạy lặp lại không phải là một cầu nối. Do đó, v3 chia mỗi cạnh được đo lường thành:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Yếu tố | Định nghĩa | Đạt điểm tối đa tại | Điểm neo |
|---|---|---|---|
| `f_size` | min(1, n/100), n = số mục được đánh giá của lượt chạy tốt nhất | 100 mục | ngưỡng ý nghĩa của [thiết kế ngữ liệu](/docs/network/specifications/corpus-design); Koehn (2004) xác nhận thử nghiệm bootstrap trên các tập dữ liệu khoảng ~300 câu — ngay cả 300 vẫn là "nhỏ", vì vậy kích thước làm giảm độ tin cậy thay vì chỉ đơn thuần là điều kiện hiển thị |
| `f_rich` | min(1, L̄/5), L̄ = độ dài nguồn *hiệu dụng* trung bình | 5 từ hiệu dụng | AmericasNLP (Mager et al. 2021) đã áp dụng chrF vì các đơn vị cấp từ bị lỗi trên các ngôn ngữ có hình thái phong phú; Mager et al. (2022) tài liệu hóa rằng các token khoảng trắng là đơn vị không chính xác |
| `f_conf` | min(1, 5/h), h = nửa chiều rộng khoảng tin cậy (CI) 95% chrF của lượt chạy tốt nhất (ủy nhiệm `50/√n` khi chưa công bố) | CI ≤ ±5 chrF | ngưỡng nhiễu mà dưới đó các mức chênh lệch (delta) không thể phân biệt được trên các ngữ liệu nhỏ; Kocmi et al. (2021) chỉ ra rằng các mức chênh lệch nằm trong khoảng tin cậy thường mâu thuẫn với sở thích của con người |
| `f_repl` | min(1, runs/2) | 2 lượt chạy được công bố | Marie, Fujita & Rubino (2021), đánh giá tổng hợp 769 bài báo: các so sánh đơn lẻ không được lặp lại là sự thất bại về uy tín đã được ghi nhận của lĩnh vực này |

**Độ dài hiệu dụng** được đo bằng các đơn vị nội dung, không phải các từ phân tách bằng khoảng trắng: `L̄ = mean source chars / c(L)`, trong đó *mức tiết kiệm ký tự* (character economy) `c(L)` là số ký tự trung vị ở phía ngôn ngữ L trên mỗi từ tiếng Anh ở phía liên kết tương ứng, được đo lường từ chính các ngữ liệu song song của dự án này (hơn 7.400 mục liên kết tại thời điểm phát hành v3: cmn 1.6, jpn 2.3, kor 2.6; eng cơ sở 5.0; deu 6.0; crk 4.7 — các từ đa tổng hợp được định giá theo nội dung mà chúng mang lại). Không sử dụng bảng tra cứu loại hình học; ước tính sẽ sắc bén hơn khi ngữ liệu phát triển; các ngôn ngữ không có dữ liệu ghép cặp với tiếng Anh (eng) sẽ sử dụng mức tiết kiệm mặc định. Được đóng dấu trên mỗi ngữ liệu trong sổ đăng ký (khối `richness`).

**Các cấp bậc cầu nối** (từ vựng hiển thị): **established** (đã thiết lập) — n ≥ 100, L̄ ≥ 5, h ≤ 5, runs ≥ 2; **provisional** (tạm thời) — đã được đo lường nhưng không đạt bất kỳ điều kiện nào; **registered** (đã đăng ký) — chưa có lượt chạy nào được công bố. Một tuyên bố chuỗi ("bạn có thể đi từ X sang Y") chỉ mạnh bằng cấp bậc của bước nhảy yếu nhất trong chuỗi đó, và hình ảnh trực quan hóa mạng lưới hiển thị độ tin cậy dưới dạng độ mờ của cạnh.

**Các kiểm tra thực tế** (từ kịch bản xác minh đã được lưu trữ, chạy trước khi phát hành v3): *62 mục từ vựng đơn từ, một lượt chạy* → r ≈ **0.04** (không phải là một đường dẫn); *200 câu, ±3 CI, 3 lượt chạy* → r = **1.00**; một ngữ liệu tiếng Nhật gồm 101 mục có số lượng từ đơn giản là 1.0 (do lỗi kịch bản) được khôi phục thành 6.5 từ hiệu dụng và đạt điểm tối đa `f_rich`. Các giới hạn biên và tính đơn điệu của từng yếu tố đều được kiểm thử thuộc tính (property-tested).

**Giá trị của một lượt chạy dưới phiên bản v3.** Một lượt chạy có thể cải thiện cầu nối theo hai cách, và ΔΦ sẽ lấy giá trị tốt hơn trong hai cách: **(a)** nó trở thành lượt chạy tốt nhất của cạnh — `ŝ_eff = predicted quality × r(its corpus's n, richness, CI proxy, runs+1)`; hoặc **(b)** nó chỉ đơn thuần là lặp lại — lượt chạy tốt nhất hiện tại được giữ nguyên, `f_repl` tăng lên. Do đó, việc lặp lại trên một cạnh chỉ có một lượt chạy mang lại giá trị thực tế, được định giá rõ ràng, và một ngữ liệu lớn hơn hoặc phong phú hơn trên một cặp đã được đo lường sẽ có thứ hạng cao hơn việc chạy lại ngữ liệu nhỏ. Các mục hiển thị `edge_quality`, `edge_reliability`, `edge_tier`, `effective_strength`, `post_run_reliability`, và `predicted_effective` bên cạnh các trường dự đoán của v2.

**Những gì Φ không đại diện.** Φ là đơn vị ưu tiên nội bộ của hàng đợi, không phải là một tuyên bố về năng lực. Các đầu vào của nó là điểm số của tập phát triển (development-set) với tất cả các cảnh báo của [Khung thiết kế ngữ liệu](/docs/network/specifications/corpus-design): khả năng rò rỉ dữ liệu huấn luyện khiến mỗi điểm số chỉ là một giới hạn trên, các giá trị chrF++ không thể so sánh trực tiếp một cách tuyệt đối giữa các ngôn ngữ, và các ngữ liệu nhỏ sẽ đi kèm khoảng tin cậy rộng. Công thức chỉ cần Φ để *sắp xếp các lượt chạy theo mức độ hữu ích*; nó không bao giờ được công bố như một sự đảm bảo về chất lượng.

## 2. Bài toán ra quyết định

Các mục đang mở của hàng đợi là mọi tổ hợp (ngữ liệu, mô hình, điều kiện)
hợp lệ (tập phân tách phát triển, giấy phép cho phép phân phối lại, không
bị cách ly, đủ điều kiện truyền và **có thể phân giải benchmark** — xem
cổng định danh ngôn ngữ ở §2.2) và chưa có trên bảng xếp hạng. Việc chạy lại
y hệt các tổ hợp đã bao phủ sẽ bị loại trừ — dấu vân tay của thẻ chạy (run-card)
sẽ khử trùng lặp khi xuất bản — nhưng các mô hình hoặc điều kiện mới trên một
cặp đã được đo lường vẫn là các mục mở.

Tài nguyên tính toán đóng góp là một nguồn ngân sách có hạn. Việc chọn mục đang mở nào để chạy tiếp theo nhằm cải thiện mạng lưới nhanh nhất là một bài toán tối đa hóa kiểu bao phủ có ngân sách (budgeted coverage-style maximization), và cách tiếp cận chuẩn tắc là lựa chọn tham lam theo **giá trị biên trên mỗi đơn vị chi phí**: đối với các mục tiêu cận lồi đơn điệu (monotone submodular), quy tắc tham lam mang lại sự đảm bảo (1 − 1/e) cổ điển (Nemhauser, Wolsey & Fisher 1978), và dạng tỷ lệ lợi ích/chi phí của nó là thuật toán tiêu chuẩn dưới các điều kiện ngân sách (Khuller, Moss & Naor 1999). Chúng tôi sử dụng quy tắc tỷ lệ làm nguyên tắc xếp hạng của mình. (Lưu ý trung thực: mục tiêu của chúng tôi có hiệu suất giảm dần kiểu bao phủ trong phần cốt lõi tất định của nó, nhưng lớp dự đoán ngẫu nhiên có nghĩa là chúng tôi trích dẫn sự đảm bảo tham lam như một *động lực*, chứ không phải là một định lý về hệ thống chính xác này.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Các mục được xếp hạng theo ECV giảm dần. Các trường hợp bằng điểm sẽ được giải quyết theo thứ tự: naive (thô) trước coached (được hướng dẫn), rẻ hơn trước, sau đó đến id của mục.

### 2.1 Biện pháp điều chỉnh xếp hạng — 2026-07-12

Bốn điều chỉnh được áp dụng xếp chồng lên quy tắc ECV tham lam (greedy ECV rule), mỗi điều chỉnh đều được phản ánh trong
metadata của hàng đợi (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Hệ số nhân mức độ nhiễm bẩn (Contamination multiplier).** ECV của mỗi mục được nhân với một
   hệ số từ phân cấp mức độ nhiễm bẩn của ngữ liệu (corpus) đó: **LOW 1.0 / MEDIUM
   0.4 / HIGH 0.1**, trong đó phân cấp không xác định hoặc bị thiếu sẽ được xử lý như
   MEDIUM (không bao giờ giả định là sạch). Cơ sở lý luận: đồ thị chuỗi sạch (clean chain graph) chỉ
   chấp nhận các cạnh có mức độ nhiễm bẩn THẤP (LOW), vì vậy một lượt chạy không phải LOW không thể đi vào đồ thị đó
   và không được xếp hạng cao hơn công việc lưới sạch (clean-mesh) khi có cùng chi phí. Các mục không phải LOW
   vẫn nằm trong hàng đợi — việc so sánh làn tương đối (relative-lane) là giá trị thực — chúng chỉ
   xếp sau công việc sạch.
2. **Xen kẽ mô hình tiên phong (Frontier interleave).** Sau khi sắp xếp tham lam, mỗi vị trí ưu tiên thứ 5
   sẽ chứa mục có thứ hạng cao nhất chưa được xếp chỗ từ
   tập hợp mô hình tiên phong (frontier-model set) (được duy trì dưới dạng dữ liệu trong trình tạo và được phản ánh
   trong metadata), nhờ đó bằng chứng tiên phong sẽ tiếp cận các phân phối tiên nghiệm dự đoán (prediction
   priors) sớm hơn thay vì chỉ sau khi các tầng giá rẻ đã bão hòa. Đây thuần túy là việc
   sắp xếp lại thứ tự: không có gì bị bỏ hoặc trùng lặp, một mục tiên phong
   đã đạt được vị trí tự nhiên sẽ giữ nguyên vị trí đó, và các mức độ ưu tiên được đánh số từ
   thứ tự đan xen — xếp hạng được công bố là kết quả thực tế.
3. **Giới hạn nguồn tập trung trong bản xem trước (Preview source-hub cap).** Bản xem trước công khai top 25 hiển thị tối
   đa **6** mục có cùng một ngôn ngữ nguồn, để một
   nguồn tập trung (hub) dồi dào tài nguyên duy nhất không thể độc chiếm cửa sổ hiển thị. Các mục
   vượt quá giới hạn vẫn giữ nguyên mức độ ưu tiên thực tế của chúng trong hàng đợi đầy đủ; bản xem trước
   chỉ đơn giản là lấy mục đủ điều kiện tiếp theo theo thứ tự xếp hạng.
4. **Loại trừ ngôn ngữ nhân tạo trong bản xem trước (Preview constructed-language exclusion).** Các mục có nguồn hoặc
   đích là một ngôn ngữ nhân tạo (constructed language) sẽ bị bỏ qua trong bản xem trước. Việc
   xác định này dựa trên họ thẻ (card-family-driven) (nhóm Ngôn ngữ Nhân tạo - Artificial Language của Glottolog,
   được đọc từ các thẻ ngôn ngữ — không bao giờ là một tập hợp ngôn ngữ được mã hóa cứng), và danh sách mã phái sinh
   được công bố trong `metadata.preview_policy` để các lượt làm mới phía máy chủ áp dụng cùng một
   lựa chọn.

(3) và (4) **chỉ là chính sách hiển thị**: toàn bộ `queue.json`,
thứ hạng và các mức độ ưu tiên của nó không bị ảnh hưởng.

### 2.1.1 Các bậc ngân sách — "$X mua được những gì?" (2026-08-24)

`queue-preview.json` chứa một mảng `budget_tiers` tóm tắt, cho các mức
ngân sách **$1 / $10 / $100 / $1000**, tiền tố tham lam khả chi của
bảng xếp hạng đã công bố: duyệt qua các mục theo thứ tự ưu tiên, lấy từng
mục có chi phí ước tính vẫn nằm trong ngân sách, bỏ qua các mục không vừa,
và tiếp tục lấp đầy bằng các mục rẻ hơn phía sau. Mỗi bậc báo cáo số lượng
mục mà ngân sách đó mua được, tổng chi phí ước tính, số lượng cặp ngôn ngữ
và mô hình riêng biệt mà chúng chạm tới, cùng mức độ đi sâu vào bảng xếp
hạng của ngân sách (`max_priority`).

Bởi vì bảng xếp hạng vốn đã tính theo giá trị biên trên chi phí (§2), tiền
tố tham lam khả chi **chính là** mức phân bổ mà mô hình này khuyến nghị
cho khoản chi đó — một người đóng góp nhỏ và một người đóng góp lớn đều nhận
được câu trả lời cụ thể, tối ưu từ cùng một bảng xếp hạng đã công bố, thay
vì một danh sách ngầm định không vừa vặn với ai. Các bậc chỉ là phần tóm tắt:
bản thân việc phân bổ chỉ đơn giản là duyệt bảng xếp hạng theo thứ tự dựa trên
ngân sách của riêng bạn. Việc làm mới phía máy chủ sẽ tính toán lại các bậc
trên những mục còn lại bằng cùng một lượt duyệt (bộ tạo và hàm làm mới triển
khai nó như một cặp song sinh, được kiểm thử ở cả hai phía).

### 2.2 Các làn và chế độ xếp hạng — 2026-07-19

Hàng đợi được phân phối sẽ khai báo, trong siêu dữ liệu của chính nó,
**làn** nào nó đang mang và **chế độ xếp hạng** nào đã sắp xếp nó.
Siêu dữ liệu mang tính thẩm quyền; phần này định nghĩa các thuật ngữ.

**Làn** (`metadata.lane`, `metadata.lane_policy`). Kể từ 2026-08-27,
hàng đợi công khai mang làn **both**: các mục LLM (mô hình ×
điều kiện prompt) **và** các mục dịch vụ MT (điều kiện `engine` —
DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde;
mỗi dịch vụ chỉ xếp hàng cho các cặp nằm trong danh sách độ bao phủ đã
công bố của chính nó). Làn **llm** ngày 2026-07-19 — chỉ gồm các mục LLM,
giới hạn ở các cặp có ít nhất một phía nằm ngoài phạm vi bao phủ đã công
bố của mọi dịch vụ MT — đã dành riêng việc benchmark dịch vụ cho các
chiến dịch do ban tổ chức thực hiện nhưng chưa bao giờ chạy, điều này
khiến hầu hết danh mục bị đình trệ; việc đo lường các dịch vụ *chính là*
xương sống của bản đồ bao phủ, vì vậy cả hai loại công việc giờ đây cùng
nằm trên một bảng. Hợp của phạm vi bao phủ (được gán bí danh macrolanguage
thông qua các thẻ ngôn ngữ) vẫn được phản ánh dưới dạng `service_coverage_methods` và
`service_covered_languages`, và hàng đợi làn llm vẫn báo cáo các cặp bị loại trừ của nó
dưới dạng `pairs_dropped_fully_covered`.

**Giới hạn kích thước blob** (2026-08-27). Tệp `queue.json` được phân phối
là một tệp tĩnh có trần lưu trữ cứng, vì vậy khi toàn bộ thứ hạng vượt quá
kích thước đó, tệp sẽ mang **lát cắt trên cùng** của thứ hạng và nêu rõ điều
đó trong `metadata.blob_truncated {kept, total}` — không bao giờ âm thầm giới hạn. Hàng đợi cơ sở
dữ liệu (`queue_top()` / `queue_pairs()`) luôn phục vụ thứ hạng **hoàn chỉnh**
và là danh sách công việc có thẩm quyền; việc tổng hợp cặp và các bậc ngân
sách của bản xem trước sẽ mô tả cấu phần đi kèm với chúng.

**Cổng định danh ngôn ngữ** (2026-07-19). Các mục trong hàng đợi chỉ nhắm
đến **các mã ISO 639-3 riêng lẻ đang hoạt động** — điểm số đối với một
macrolanguage ("tiếng Ả Rập") hoặc mã ngữ hệ tập thể ("các ngôn ngữ Berber")
sẽ là một tuyên bố không thể kiểm chứng về các biến thể chưa từng được đánh
giá (cùng lập luận mà FLORES-200/NLLB tuân theo bằng cách mã hóa dữ liệu
thành `arb`/`quy`/`zsm`). Các nhãn ngữ liệu
thượng nguồn được *phân giải*, không bao giờ tuân theo hay loại bỏ một cách
mù quáng: các thẻ chữ viết (script) được bóc tách cơ học (ngữ liệu `eng→cmn-Hans`
sẽ xếp hàng cho `eng→cmn`, chữ viết được giữ lại làm siêu dữ liệu hiển thị
của mục `source_script`/`target_script`); các mã ngừng hoạt động hoàn toàn sẽ đi theo
mã kế nhiệm ISO chính thức của chúng; và một ngữ liệu mang nhãn bao quát (macro)
chỉ được xếp hàng khi có một **phân giải biến thể** đã ghi nhận và trích dẫn
trong mục đăng ký của nó (ví dụ: FLORES+ ghi nhận tiếng Quechua của mình là
`quy`). Các ngữ liệu không phân giải được theo cả hai cách đều bị loại
trừ với các lý do máy có thể đọc được, công bố trong `metadata.doctrine_exclusions` (tổng số,
số lượng theo từng lý do, lý do cho từng ngữ liệu) và được tính trong sổ cái
sa mạc (`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) — loại trừ rõ ràng, không bao giờ âm thầm loại bỏ. Các
kết quả lịch sử trên các ngữ liệu mang nhãn bao quát giữ nguyên nút lưới
được đặt tên trung thực của riêng chúng (nút `scope`: `macrolanguage` /
`collective` / `retired`), không bao giờ được sáp nhập vào một biến thể
thành viên. Tất cả các dữ liệu đầu vào cho việc phân giải đều được công bố:
các dấu `language_resolution` theo từng mục của sổ đăng ký mang các mã đã phân giải,
phạm vi và các trích dẫn ghim.

**Chế độ xếp hạng** (`metadata.rank_mode`, được mô tả trong
`metadata.priority_model`). Hai cách sắp xếp cho cùng các mục:

- **ecv** — quy tắc giá trị chuỗi kỳ vọng tham lam của §2–§3: cải thiện
  mạng lưới trên mỗi đô la ước tính. Thứ tự khai thác; phù hợp khi bảng
  đủ dày đặc để các dự đoán và ΔΦ mang lại tín hiệu.
- **map** (map-value v2) — thứ tự khảo sát:
  `MapValue = novelty × uncertainty × promise × connectivity ×
  corpus-quality × contamination ÷ cost`, được tập hợp bằng một vết
  tham lam chính xác. *Novelty* (tính mới) là điểm ghi nhận vị trí ánh
  sáng đầu tiên giảm dần khi các mục đã xếp chiếm cùng một cặp có hướng
  (1/(1+n)), ngôn ngữ đích, ngữ hệ đích, ô phương pháp × ngữ hệ đích,
  và ô đích × miền (mỗi ô 1/√(1+n); ngữ hệ lấy từ thẻ ngôn ngữ, miền lấy
  từ phân loại học của sổ đăng ký ngữ liệu — độ bao phủ sớm của một đích
  nên trải rộng qua các phong cách ngôn ngữ, không lặp lại miền đầu tiên
  được đo lường). *Uncertainty* (độ không chắc chắn) là độ sâu lùi bước
  của dự đoán ở §3.1 (cặp 0.25 · ngôn ngữ đích 0.55 · ngôn ngữ nguồn 0.75 ·
  toàn cục 1.0) × 1/(1+các lần chạy đã công bố trên cạnh). *Promise*
  (độ hứa hẹn) là độ mạnh dự đoán ở §3.1 với mức sàn là 0.25 — những yếu tố
  chưa biết nhưng có khả năng hoạt động tốt sẽ dẫn đầu, và việc lập bản đồ
  cho một vùng sa mạc tiềm năng vẫn mang lại giá trị. *Connectivity* (tính
  kết nối) tăng hạng các cặp **liên kết mạng lưới đã đo lường với một ngôn
  ngữ mà nó chưa thể tiếp cận**: một điểm cuối được coi là *đã xác lập* khi
  nó nằm trên một cạnh lưới đã đo lường (`mesh.json`, trạng thái `measured`)
  hoặc bên trong danh sách độ bao phủ đã công bố của bất kỳ dịch vụ MT nào
  (được gán bí danh macrolanguage, cùng kiểu bí danh như cổng làn ở trên);
  **cầu nối** (chính xác một điểm cuối đã xác lập) và **ốc đảo** (cả hai đều chưa)
  đều đạt điểm 1.0 — kể từ 2026-08-27, ánh sáng đầu tiên của một vùng sa mạc biệt
  lập được tính trọn vẹn (ốc đảo từng đạt 0.5 theo kích thước phát triển-từ-mạng-lưới
  ngày 2026-07-19, vốn làm hạ bậc phần đuôi sâu nhất về mặt cấu trúc) — trong khi
  việc làm dày **bên trong** (cả hai đã xác lập) đạt điểm 0.5: củng cố giữa các
  điểm đã biết là công việc của chế độ ecv. Mức **tăng điểm cho lần đọc đầu tiên**
  (×2.0) nhân thêm vào giá trị khảo sát của bất kỳ mục nào có ngôn ngữ nguồn
  hoặc ngôn ngữ đích KHÔNG có phép đo lường nào được công bố ở bất kỳ đâu — nguyên
  tắc thứ chín, được nêu rõ ràng: **lần đọc đầu tiên của một ngôn ngữ quan trọng
  hơn việc tinh chỉnh**. Bản thân yếu tố không chắc chắn không thể diễn đạt điều
  này (nó chấm điểm một cặp chưa đo lường giữa hai ngôn ngữ đã đo lường kỹ lưỡng
  y hệt như một ngôn ngữ chưa từng được đo lường); mức tăng điểm giúp ánh sáng
  đầu tiên của phần đuôi dài trở thành một mục tiêu được công bố thay vì một sự
  tình cờ ngẫu nhiên. Cả hai yếu tố đều đi cùng `metadata.map_value_parameters` và áp dụng
  giống hệt nhau bên trong thành phần khảo sát của edv (§2.3).

  Nửa còn lại của nguyên tắc thứ chín nằm BÊN NGOÀI bảng xếp hạng: không
  có thứ tự nào của các mục hiện có có thể chạm tới một ngôn ngữ hoàn toàn
  không có ngữ liệu (~7.500 ngôn ngữ có mã riêng lẻ còn tồn tại ngày nay).
  **Danh sách ngữ liệu mong muốn** (`/corpus-wishlist.json`, được tái tạo bên cạnh
  hàng đợi) công bố ranh giới thu nhận đó: mọi ngôn ngữ có mã riêng lẻ, còn
  tồn tại, chưa có ngữ liệu được xếp hạng theo số lượng người nói được trích
  dẫn tốt nhất — số lượng người nói đóng vai trò đại diện cho tính khả thi
  của một cộng đồng thực sự có thể xây dựng một ngữ liệu — mỗi số lượng đều
  được ghi nhận nguồn và không bao giờ bị can thiệp phán quyết.
  *Corpus-quality* (chất lượng ngữ liệu) là tiềm năng độ tin cậy nội tại
  của ngữ liệu `f_size × f_rich` từ §1.5 — khảo sát nên hướng tới các ngữ liệu
  có thể chịu tải, do đó một danh sách từ vựng từ đơn gồm 62 mục không còn
  chiếm vị trí nổi bật chỉ vì nó rẻ; việc thiếu phép đo độ phong phú vẫn giữ
  tính trung lập (không có phép đo không phải là bằng chứng của sự nghèo nàn).
  Kỷ luật về chi phí và nhiễm bẩn giống hệt như ecv. Việc xen kẽ ranh giới
  và xử lý hòa điểm (§2.1) được áp dụng không đổi. Phù hợp cho giai đoạn
  khảo sát: nó tối đa hóa những gì *bản đồ học được* trên mỗi đô la — các
  phép đo đầu tiên trên khắp các cặp, ngôn ngữ, ngữ hệ, ô phương pháp và miền,
  phát triển từ mạng lưới đã đo lường thay vì phân tán — với cái giá có chủ
  đích là sự tăng trưởng độ mạnh của mạng lưới chậm hơn.

> **map-value v2 (2026-07-19).** Hai bổ sung do người sáng lập chỉ đạo
> cho thứ tự khảo sát: các cặp *bắc cầu vào mạng lưới đã đo lường* giờ đây
> xếp trước các phép thăm dò biệt lập và việc làm dày bên trong, và chất
> lượng ngữ liệu (sàn kích thước × độ phong phú hiệu dụng, §1.5) cùng với
> sự trải rộng miền trên mỗi đích sẽ tạo trọng số cho bảng xếp hạng — tài
> nguyên tính toán của người đóng góp nên liên kết các đường đi đã xác lập
> với các đường đi mới, trên các ngữ liệu đủ tốt để chịu tải. Giấy phép vẫn
> là một **cổng kiểm soát, không phải là trọng số**: các quy tắc cấp phép
> và kênh truyền quyết định những gì có thể được đưa vào hàng đợi (§2, và
> `transmission_note` của hàng đợi); giữa các ngữ liệu đủ điều kiện, bảng xếp
> hạng không phân biệt giấy phép, do đó các tập nghiên cứu bị hạn chế nhưng
> đã ghim — thường là ngữ liệu duy nhất của một cặp — không bao giờ bị bỏ đói
> một cách có hệ thống. Các hàng đợi v1 (chỉ gồm novelty × uncertainty ×
> promise) vẫn có thể diễn giải được thông qua siêu dữ liệu của chính chúng.

Các giá trị hệ số chính xác được sử dụng khi tạo sẽ nằm trong
`metadata.map_value_parameters`; các đầu vào về tính kết nối và chất lượng có thể
suy diễn lại từ `mesh.json` đã công bố (các cạnh đã đo lường),
hợp bao phủ dịch vụ được phản ánh trong siêu dữ liệu, và `registry.json`
(số lượng mục + độ phong phú). Mỗi mục ngoài ra vẫn giữ lại toàn bộ các
trường chẩn đoán ecv-v3 bất kể chế độ nào, do đó cả hai thứ tự đều có
thể được suy diễn lại từ cùng các cấu phần.

### 2.3 Chế độ xếp hạng `edv` — giá trị quyết định kỳ vọng (2026-08-27)

*Trạng thái: đã triển khai, mặc định tắt trong khi chờ so sánh được đo lường
ở §2.3.6. Giá trị mặc định được công bố vẫn là `map` cho đến lúc đó.*

Hàng đợi mua chính xác hai sản phẩm: **bản đồ năng lực** (phương pháp nào
tốt ở điểm nào, với độ không chắc chắn trung thực) và **lưới định tuyến**
(các cặp đã đo lường ghép thành các tuyến đường). `edv` định giá
từng mục ứng viên theo mức độ nó thúc đẩy cả hai, dưới dạng một danh mục
được tính trọng số:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

với các giá trị mặc định `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`
(người sáng lập có thể điều chỉnh; mỗi lần tạo đều phản ánh các trọng số
thực tế được sử dụng trong `metadata.edv_parameters`). Hệ số nhiễm bẩn (§2.1 biện pháp 1)
được áp dụng chính xác một lần, dưới dạng hệ số nhân ngoài cùng. Cấp phép và
truyền dữ liệu vẫn là **các cổng kiểm soát, không phải là trọng số** — tính hợp
lệ được quyết định trước khi tính toán bất kỳ giá trị nào, và bảng xếp hạng
không phân biệt giấy phép giữa các ngữ liệu đủ điều kiện.

#### 2.3.1 Ĵ — giá trị phán quyết phương pháp

Định giá mức độ mà lượt chạy thúc đẩy việc **giải quyết các so sánh phương
pháp trên cùng ngữ liệu** — tuyên bố liên phương pháp duy nhất mà nghiên cứu
đo lường của chính dự án này cho phép. (Nghiên cứu chuyển giao độ khó W2 đã
bác bỏ việc liên kết năng lực giữa các ngôn ngữ; kết quả tích cực được cấp
phép của nó — hiệu chỉnh cộng gộp phương pháp × ngữ liệu trong cùng ngôn ngữ —
chính xác là những gì thành phần này sử dụng. Điểm số chỉ được sử dụng để xếp
thứ tự và phân tách, không bao giờ được chuyển đổi thành xác suất chấp nhận,
theo thử nghiệm hiệu chuẩn.)

Đối với một ứng viên (ngữ liệu C, phương pháp M, điều kiện): **các đối tác
đối chiếu** là các phương pháp M′ đã có một lượt chạy được công bố trên
(C, cùng điều kiện). Với mỗi đối tác, với `sep` là độ phân tách
điểm theo điểm chrF trên nửa độ rộng CI gộp (các CI đã ghi nhận; đại diện `50/√n`
khi chưa công bố), và `sep_pred` tương tự được tính dựa trên điểm dự
đoán ở §3.1:

| trạng thái đối chiếu của {M, M′} trên cặp | điểm ghi nhận |
|---|---|
| **chưa gặp** — chưa có ngữ liệu chung | `JUDGE_FIRST = 1.0` |
| **đang tranh chấp** — có các ngữ liệu chung, tất cả `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **đã ngã ngũ** — một số `sep ≥ Z_DEC`, n_dec ngữ liệu quyết định điều đó | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

mỗi giá trị được nhân với `w_top = 1/√(rank(M)·rank(M′))` — việc phân định
vị trí thứ nhất với thứ hai có giá trị hơn vị trí thứ bảy với thứ tám. Bảng
xếp hạng phương pháp theo từng cặp sử dụng khớp cộng gộp phương pháp × ngữ
liệu được cấp phép (bình phương tối thiểu luân phiên trên các ô quan sát được)
khi cặp có ≥2 phương pháp × ≥2 ngữ liệu được đo lường, nếu không thì lấy điểm
tốt nhất theo từng phương pháp; việc khớp **hoàn toàn theo từng cặp, không bao
giờ gộp chung giữa các ngôn ngữ**. `Z_DEC = 1.96`.

Một đối chiếu giữa coached và naive trên cùng (C, M) sẽ cộng thêm
`JUDGE_COND = 0.5 / (1 + n_cond)`. Các đối chiếu của một mục được tính tổng với hiệu
suất giảm dần (`JUDGE_GAMMA = 0.7` cho mỗi đối chiếu bổ sung,
được sắp xếp giảm dần), cộng với một **hạng tử hạt giống**
`JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = các phương pháp khác trong danh sách có mục
hàng đợi trên C) để một bảng trống vẫn ưu tiên các ngữ liệu nơi các
so sánh tương lai có thể được phán quyết — giá trị của địa điểm, không
bao giờ là điểm số mượn tạm. Trong quá trình tập hợp, thành phần phán quyết
suy giảm `1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ và Ŝ

`M̂` là mức tăng mạng lưới kỳ vọng (ΔΦ) của §3, không đổi, với ma trận
chuỗi được đóng băng tại thời điểm tạo. `Ŝ` là phần cốt lõi của map-value
v2 ở §2.2 — `uncertainty × promise × connectivity × corpus-quality` với sự suy giảm tính mới theo vị trí — không đổi.
*Mức* điểm dự đoán (độ hứa hẹn) chỉ nằm trong Ŝ; Ĵ chỉ sử dụng *độ phân tách*
điểm — hai thành phần này không thể tính trùng cùng một sự lạc quan.

#### 2.3.3 Chuẩn hóa

Ba thành phần nằm trên các thang đo không thể so sánh trực tiếp, do đó mỗi
thành phần tĩnh được chia cho phân vị thứ 95 của nó trên tập ứng viên
(giới hạn ở mức `EDV_NORM_CAP = 4.0`); ba hệ số chuẩn hóa được cung cấp trong
`metadata.edv_parameters.normalizers`, giúp mọi giá trị EDV đã công bố có thể được suy diễn lại
từ các cấu phần của chính nó.

#### 2.3.4 Tập hợp

Thứ tự chính là vết tham lam lười (lazy-greedy trace) giống hệt như chế độ map:
mọi hệ số nhân phụ thuộc vào thứ tự (tính mới khảo sát, độ suy giảm xếp đặt
phán quyết) đều đơn điệu không tăng khi các mục được xếp, do đó một mục heap
cũ chỉ có thể ước tính quá cao — bất biến tham lam lười được giữ vững và vết
này tương đương với thuật toán tham lam vét cạn. Việc xen kẽ ranh giới, chính
sách xem trước và các bậc ngân sách được áp dụng không đổi.

#### 2.3.5 Khả năng giải thích

Mỗi mục giữ lại trong phần chẩn đoán của nó: danh sách đối chiếu mà nó được
tính điểm (đối tác, trạng thái, độ phân tách dự đoán, trọng số thứ hạng),
các hạng tử hạt giống và suy giảm, tất cả các trường ở §2.2 và §3, các trọng
số và hệ số chuẩn hóa — giá trị EDV đã công bố có thể tính toán lại chính xác
từ hàng đó. Câu hỏi "Làm thế nào mục này có được thứ hạng này?" có thể trả
lời được mà không cần bất kỳ trạng thái bên ngoài nào.

#### 2.3.6 Tiêu chí áp dụng

`edv` chỉ trở thành mặc định được công bố sau khi có một so sánh
được đo lường với `map` và `ecv` trên cùng một bảng: trong vòng 10%
so với map trên mọi chỉ số khảo sát (phân vị độ sâu ánh sáng đầu tiên, các
cặp/ngôn ngữ/ngữ hệ riêng biệt ở độ sâu, tỷ lệ cặp mới biên), vượt trội rõ
rệt trên cả hai chỉ số phán quyết (các đối chiếu tranh chấp được giải quyết
trên mỗi $1k mô phỏng; khả năng khôi phục thứ hạng phương pháp ở mức chi tiêu
cố định), và mức tăng trưởng mạng lưới trên mỗi đô la không kém hơn map. Báo
cáo so sánh sẽ được công bố cùng thời điểm chuyển đổi.

## 3. Giá trị của một lượt chạy

### 3.1 Dự đoán điểm số trước khi chạy

Điểm số kỳ vọng của một tổ hợp chưa chạy (cặp, mô hình, điều kiện) là một tổng đơn giản có chủ đích, hoàn toàn có thể kiểm tra được — một dự đoán ảnh hưởng chính hai chiều cộng với sự lạc quan có cấu trúc, với mọi số hạng đều được công bố trên mục đó:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — lùi bước phân cấp (hierarchical back-off) dựa trên các độ mạnh đã công bố: trung bình trên cặp này → trung bình trên ngôn ngữ đích này → trung bình trên ngôn ngữ nguồn này → trung bình toàn cầu → `S0_FALLBACK`. Cấp độ được sử dụng được công bố dưới dạng `prior_basis`.
- **`model_offset`** — hiệu suất của mô hình này so với các mô hình *khác* trên cùng một cặp, được tính trung bình trên tất cả các cặp có tồn tại sự so sánh. Bằng không đối với các mô hình chưa từng thấy.
- **`condition_offset`** — mức chênh lệch (delta) giữa coached và naive được quan sát trên cùng một cặp (lùi về cùng một ngôn ngữ đích), và **bằng không trong các trường hợp khác**: hiệu quả từ việc hướng dẫn (coaching) là có thật ở những nơi được đo lường nhưng không được giả định là sẽ chuyển dịch qua các ngôn ngữ khác, vì vậy trên các cặp không có bằng chứng, quy ước ưu tiên baseline (cơ sở) vẫn được áp dụng.
- **`exploration_bonus`** — sự lạc quan khi đối mặt với sự không chắc chắn, với lịch trình UCB1 (Auer, Cesa-Bianchi & Fischer 2002): `κ·sqrt(2·ln(1+N)/(1+n))`, trong đó N là tổng số lượt chạy có điểm đã công bố và n là số lượt chạy trên tổ hợp (cặp, mô hình) này. Các ô chưa bao giờ được thử nghiệm sẽ nhận được điểm thưởng lớn nhất; các ô đã được đo lường kỹ lưỡng sẽ giảm dần về không. Chúng tôi mượn lịch trình này — hình dạng giúp các nhánh chưa được khám phá nhiều nổi lên lại với tốc độ phù hợp — chứ không phải định lý hối tiếc (regret theorem), vốn giả định một bandit tĩnh mà hệ thống này không phải.

### 3.2 Mức tăng mạng lưới, dưới dạng đóng

Một lượt chạy chỉ có thể cải thiện mạng lưới bằng cách nâng cạnh của cặp đó lên `s' = max(s(e), ŝ)`. Đối với thay đổi trên một cạnh duy nhất, chuỗi tốt nhất mới giữa hai ngôn ngữ bất kỳ sẽ bỏ qua cạnh mới hoặc sử dụng nó chính xác một lần, vì vậy ma trận được nâng cấp — và do đó là ΔΦ — có dạng một dòng chính xác (không cần giải lại toàn bộ đồ thị):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E là "chuỗi tốt nhất đến điểm cuối của cạnh mới, trả phí giao lộ để ghép nối vào đó"; hai số hạng là hai hướng đi qua cạnh đó. Điều này được kiểm thử trong bộ công cụ harness so với việc tính toán lại Φ bằng vét cạn (brute-force).

Một dự đoán không thể vượt qua độ mạnh hiện tại của cạnh sẽ mang lại ΔΦ = 0: công thức sẽ chi tiêu tiền của nhà tài trợ để xác nhận những điều chưa biết, chứ không phải đo lường lại những gì đã được chứng minh. (Điểm thưởng khám phá giúp các ô yếu hoặc chưa được lấy mẫu nhiều không bị bỏ đói mãi mãi.)

### 3.3 Những gì được tính là bằng chứng so với những gì có thể đưa vào hàng đợi

Hai cổng khác nhau, được thiết kế bất đối xứng một cách có chủ ý:

- **Bằng chứng** đến từ *mọi* lượt chạy được công bố và không bị loại — bao gồm cả các lượt chạy trên các ngữ liệu không thể đưa vào hàng đợi công khai (ví dụ: các tập dữ liệu có giấy phép phi thương mại). Một phép đo lường được công bố của một cặp là tri thức, bất kể bạn có thể chạy lại nó hay không.
- **Hành động** (các mục hàng đợi) chỉ đến từ các ngữ liệu có thể chạy công khai: phân tách phát triển, giấy phép thuộc họ CC-BY, bất kỳ ai cũng có thể tải về.

Các ngôn ngữ chỉ có thể tiếp cận thông qua các ngữ liệu không thể đưa vào hàng đợi vẫn nằm trong đồ thị: việc cải thiện các cạnh *xung quanh* chúng sẽ thay đổi giá trị chuỗi của chúng, và công thức sẽ tính đến điều đó.

## 4. Tham số

| Tham số | Mặc định | Ý nghĩa và lý do căn cứ |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0.9** | Tỷ lệ duy trì độ trung thực trên mỗi giao lộ của một chuỗi *ước tính*. Mã hóa nguyên lý "đo lường trực tiếp vượt trội hơn chuỗi hóa tích tương đương" (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). Mức giảm ~10% là một lựa chọn hiệu chuẩn, sẽ được xem xét lại khi các tam giác chuỗi được đo lường tích lũy thêm (§6). |
| `κ` (`kappa_exploration_scale`) | **0.05** | Quy mô điểm thưởng khám phá, tính theo đơn vị độ mạnh. 0.05 ≡ 5 điểm chrF++ — ngưỡng nhiễu mà dưới đó sự khác biệt về điểm số không thể phân biệt được trên các ngữ liệu dưới 100 mục ([Thiết kế ngữ liệu §6.3](/docs/network/specifications/corpus-design)). Sự lạc quan được giới hạn ở độ phân giải của công cụ đo. |
| `S_CAP` | **0.95** | Trần dự đoán — không cạnh ước tính nào có thể tuyên bố độ trung thực gần như hoàn hảo nếu nó chưa chứng minh được điều đó. |
| `S0_FALLBACK` | **0.5** | Xác suất tiên nghiệm (prior) của cặp ngôn ngữ như giải pháp cuối cùng, chỉ được sử dụng khi hoàn toàn không có kết quả công bố nào (giá trị trung bình toàn cầu quan sát được — ≈ 0.54 qua 429 lượt chạy đầu tiên — được ưu tiên bất cứ khi nào có bất kỳ kết quả nào tồn tại). |
| `COST_FLOOR` | **$0.01** | Ngưỡng dưới cho mẫu số ECV, để các lượt chạy gần như miễn phí không thể tuyên bố giá trị vô hạn trên mỗi đô la. |
| `N_FULL` | **100** | Số mục được đánh giá để đạt điểm tối đa về kích thước (§1.5). |
| `L_HEALTHY` | **5.0** | Số từ hiệu dụng để đạt điểm tối đa về độ phong phú (§1.5). |
| `H_NOISE` | **±5 chrF** | Nửa chiều rộng khoảng tin cậy (CI) để đạt điểm tối đa về độ tin cậy; các CI bị thiếu sẽ được ủy nhiệm bằng 50/√n (neo ở mức ±5 tại n=100). |
| `RUNS_FULL` | **2** | Số lượt chạy được công bố để đạt điểm tối đa về tính lặp lại. |

**Quản lý phiên bản.** Các thay đổi về tham số hoặc công thức sẽ làm tăng `formula_version` (siêu dữ liệu) và dòng phiên bản của trang này. Hàng đợi luôn lặp lại chính xác các giá trị được sử dụng dưới `metadata.priority_parameters`, including the current Φ, so historical queues remain interpretable. Các lượt chạy phân tích độ nhạy (sensitivity runs) chỉ cách một cờ lệnh: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Ví dụ thực tế (các giá trị trực tiếp, 12-06-2026)

Tạo đối với 424 lượt chạy có điểm, 59 cạnh được đo lường, 60 ngôn ngữ; **Φ = 0.272**. Mục hàng đầu:

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Diễn giải lại: Tiếng Faroe chỉ được kết nối với mạng lưới thông qua tiếng Đan Mạch, vì vậy một cạnh eng→fao được đo lường sẽ đi tắt qua một họ chuỗi khổng lồ (ΔΦ lớn); mô hình được dự đoán ở mức trung bình trên một cặp như thế này (prior + offset), chưa có ai từng thử nghiệm ô này (điểm thưởng lớn), và lượt chạy chỉ tốn một xu. Không có mục nào khác trong hàng đợi mang lại nhiều giá trị mạng lưới hơn trên mỗi đô la. Cùng một phép toán đó, với mọi đầu vào được công bố, sẽ tạo ra mọi thứ hạng khác.

## 6. Các hạn chế đã biết (và giải pháp khắc phục)

1. **chrF++ không thể so sánh trực tiếp giữa các ngôn ngữ.** Hình thái học làm thay đổi thang đo; một cạnh 0.5 vào tiếng Basque không phải là cùng một thành tựu như vào tiếng Hà Lan. Giảm thiểu: các mức ưu tiên bị chi phối bởi *cấu trúc* (các chuyển đổi s = 0 → s > 0) nơi các hiệu ứng thang đo chỉ là thứ yếu. Giải pháp khắc phục: chuẩn hóa điểm số theo từng ngôn ngữ, hoặc các chỉ số có hiệu chuẩn liên ngôn ngữ tốt hơn khi chúng khả dụng cho các ngôn ngữ này.
2. **Mô hình chuỗi tích-λ là một giả định tiên nghiệm, không phải là một phép đo lường.** Nó được hỗ trợ về mặt định hướng bởi các tài liệu nghiên cứu về ngôn ngữ trung gian nhưng chưa được hiệu chuẩn cho dịch thuật bằng LLM. Giải pháp khắc phục (dự kiến): mạng lưới hiện chứa các tam giác được đo lường (ví dụ: deu→fra trực tiếp bên cạnh deu→eng→fra), vì vậy đầu ra dạng chuỗi có thể được tính điểm trực tiếp và λ được khớp với dữ liệu thay vì được chọn trước.
3. **Sự rò rỉ dữ liệu (contamination) và trạng thái tập phát triển (dev-set).** Độ mạnh của cạnh thừa hưởng mọi cảnh báo của các tập phát triển công khai — hãy coi Φ như một tín hiệu lập kế hoạch giới hạn trên, không bao giờ là một tuyên bố về năng lực ([Thiết kế ngữ liệu](/docs/network/specifications/corpus-design)).
4. **Sự mù quáng về miền dữ liệu (domain blindness).** Một cạnh được đo lường trên văn bản hội thoại được xử lý như một con số duy nhất; các chuỗi đi qua các miền dữ liệu khác nhau sẽ bị suy giảm nhiều hơn so với dự đoán của λ.
5. **Tính định hướng.** Các cạnh hiện tại là vô hướng (bằng chứng X→Y kích hoạt X↔Y). Khi việc kết hợp chuỗi trở nên nhạy cảm với hướng trong thực tế, độ mạnh sẽ được chia theo hướng — công thức không thay đổi, đồ thị chỉ nhân đôi.

## 7. Tài liệu tham khảo

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of Small-World Networks.* Physical Review Letters 87, 198701. [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time Analysis of the Multiarmed Bandit Problem.* Machine Learning 47, 235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of Approximations for Maximizing Submodular Set Functions—I.* Mathematical Programming 14, 265–294. [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum Coverage Problem.* Information Processing Letters 70(1), 39–45. [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007, 484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based Statistical Machine Translation.* ACL 2007; phiên bản tạp chí Machine Translation 21(3), 165–181. [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the Importance of Pivot Language Selection for Statistical Machine Translation.* NAACL-HLT 2009 Short Papers, 221–224. [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009, 415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine Translation.* Journal of Machine Learning Research 22(107), 1–48. [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
