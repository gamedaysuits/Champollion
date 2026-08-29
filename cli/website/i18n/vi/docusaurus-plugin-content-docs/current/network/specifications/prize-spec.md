---
sidebar_position: 8
title: "Thông số giải thưởng"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Đặc tả Giải thưởng (Prize Specification)

Giải thưởng là một nửa phần khích lệ của thỏa thuận ưu tiên đánh giá (eval-first bargain). Một cộng đồng hoặc nhóm nghiên cứu tuyển chọn một tập dữ liệu đánh giá nhỏ, được niêm phong — vài trăm cặp, mỗi cặp đều được kiểm tra ([Corpus Partnership](/docs/network/specifications/corpus-partnership) chính là quy trình đó). Một nhà tài trợ công bố một giải thưởng dựa trên điểm số mục tiêu trên tập dữ liệu đó. Kể từ thời điểm đó, ngôn ngữ này trở thành một thử thách thường trực: bất kỳ người xây dựng phương pháp nào trên thế giới cũng có thể nhắm tới nó, bảng xếp hạng đo lường mọi nỗ lực một cách công khai, và tiêu chuẩn được quyết định bởi chính bộ đáp án của cộng đồng thay vì bởi bất kỳ ai lớn tiếng nhất. Tài liệu này quy định cách thức hoạt động của một giải thưởng như vậy — các điều kiện ngưỡng, quy trình nhận giải, các lớp phụ thuộc, và các quy tắc — để tiêu chuẩn trở nên rõ ràng và không phụ thuộc vào phương pháp khi một giải thưởng được mở ra.

Các giải thưởng được **tài trợ và nắm giữ bởi nhà tài trợ**: tiền thưởng nằm ở tổ chức tài trợ, hoặc ở một quỹ tín thác cộng đồng do nhà tài trợ chỉ định — **Champollion không bao giờ nắm giữ, ký quỹ hoặc luân chuyển tiền thưởng.** Bất kỳ cộng đồng hoặc tổ chức nào cũng có thể tự tổ chức một giải thưởng theo hướng dẫn tự phục vụ trong [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest), tự nắm giữ ngữ liệu và tiền thưởng của riêng mình.

> **Trạng thái: ĐỀ XUẤT — chưa có giải thưởng nào được mở, và chưa có gì ở đây có thể nhận được.**
> Điều kiện để *mở* một giải thưởng nằm ở khía cạnh đo lường: một ngữ liệu tiêu chuẩn vàng được cộng đồng đồng thuận, môi trường đánh giá độc lập (air-gapped evaluation sandbox) (đã được đặc tả, chưa được xây dựng), và cổng đánh giá của người bản ngữ. Chưa có điểm số nào trên trang web này vượt qua được tiêu chuẩn của giải thưởng. Xem [Honest Limitations](/docs/network/honest-limitations). Tham chiếu các chỉ số: [Scoring Spec](/docs/network/specifications/scoring); giao thức: [Benchmark Spec](/docs/network/specifications/benchmark).

---

## Bạn muốn giúp đưa một ngôn ngữ vào mạng lưới?

Bạn không cần phải đợi một giải thưởng. Những việc có sức ảnh hưởng lớn nhất bạn có thể làm hôm nay:

- **Tài trợ một giải thưởng thành tựu dịch máy (MT).** Tài trợ cho một ngưỡng mục tiêu — ví dụ, một phương pháp dịch tiếng Anh → tiếng Plains Cree đáng tin cậy. Champollion điều phối việc đo lường; tiền tài trợ vẫn ở chỗ **bạn** (tổ chức của bạn hoặc một quỹ tín thác cộng đồng do bạn chỉ định) và được trao theo các điều khoản của cộng đồng (xem
  [Chủ quyền Dữ liệu](/docs/network/sovereignty/data-sovereignty)
  và [Mô hình Kinh tế](/docs/network/sovereignty/economic-model)). Lộ trình tự phục vụ từ đầu đến cuối được tài liệu hóa trong
  [Chạy một Cuộc thi Chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest);
  việc đưa một cặp ngôn ngữ mới vào bắt đầu bằng một
  [quan hệ đối tác ngữ liệu](/docs/network/specifications/corpus-partnership).
- **Điều phối một khoản quyên góp tài nguyên tính toán.** Gom các khoản tín dụng API / token để hàng đợi công cộng có thể bản đồ hóa nhiều cặp ngôn ngữ hơn và chỉ ra nơi mà bản dịch đã — và chưa — đáng tin cậy.
- **Hỗ trợ các sáng kiến mã nguồn mở mà chúng tôi xây dựng trên đó — *trực tiếp*.** Champollion là hệ thống đường ống kết nối các công trình mở của những người khác; hỗ trợ *họ* chính là hỗ trợ bản đồ này (chúng tôi muốn hướng bạn đến thượng nguồn hơn là nhận công trạng cho công việc của họ):
  - [Tatoeba](https://tatoeba.org) — các câu song ngữ do cộng đồng đóng góp
  - [Endangered Languages Catalog (ELCat)](https://www.endangeredlanguages.com) — dữ liệu về các ngôn ngữ bị đe dọa
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — danh mục ngôn ngữ & loại hình học
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — các bộ chuyển đổi hình thái (FST)
  - [Masakhane](https://www.masakhane.io) — cộng đồng dịch máy cho các ngôn ngữ châu Phi
  - [OPUS](https://opus.nlpl.eu) — các kho ngữ liệu song ngữ mở

> Để tài trợ cho một giải thưởng, tổ chức quyên góp tài nguyên tính toán hoặc thảo luận về quan hệ đối tác, hãy liên hệ với dự án qua [GitHub](https://github.com/gamedaysuits). Các bên giám hộ khóa của cộng đồng đang trong quá trình xác nhận; không có quốc gia hay tổ chức nào được nêu tên là đối tác trước khi họ đồng ý.

---

## 1. Triết lý

> **Thỏa thuận tóm tắt trong một dòng: giải mã một ngôn ngữ, giành chiến thắng, và trao trả lại.** Champollion là một hoạt động đo chuẩn ML có mục đích — cạnh tranh là cách các cặp ngôn ngữ khó được giải quyết. Chúng tôi mời các nhà nghiên cứu ML và bất kỳ nhà phát triển có năng lực nào xây dựng phương pháp tốt nhất cho một cặp ngôn ngữ khó cụ thể, giành giải thưởng, **và** bàn giao phương pháp thu được cho tổ chức quản trị sở hữu ngôn ngữ đó (§1.3). Năng lượng cạnh tranh là có thật, và nó hướng vào sứ mệnh — giúp mọi ngôn ngữ được dịch thuật, theo các điều khoản mà người dân của ngôn ngữ đó thiết lập — chứ không phải để leo lên bảng xếp hạng vì lợi ích cá nhân.

### 1.1 Giải thưởng Phần thưởng cho Sự bứt phá, Không phải Sự tham gia

Tiền giải thưởng chỉ được giải ngân khi một phương pháp chứng minh được rằng nó đạt được ngưỡng năng lực đã xác định. Không có giải thưởng tham gia, giải khuyến khích hoặc khoản thanh toán an ủi. Nếu không ai vượt qua ngưỡng, không ai được trả tiền. Đây là thiết kế có chủ ý — điều đó có nghĩa là các nhà tài trợ chỉ trả tiền cho những kết quả thực sự hoạt động hiệu quả.

### 1.2 Xác thực từ Cộng đồng là Không thể Thương lượng

Các chỉ số tự động chỉ là các đại diện (SCORING_SPEC §1.1). Một phương pháp có thể đạt điểm cao trên chrF++ và mức độ chấp nhận của FST trong khi tạo ra đầu ra mà không người bản xứ nào chấp nhận được. **Mọi yêu cầu nhận giải thưởng đều yêu cầu xác thực từ cộng đồng** — những người nói song ngữ phải xác nhận đầu ra có thể sử dụng được. Đây là cổng xác thực con người (BENCHMARK_SPEC §7).

### 1.3 Chuyển giao Quyền sở hữu là Một phần của Thỏa thuận

Các phương pháp yêu cầu nhận giải thưởng phải tuân theo điều khoản chuyển giao quyền sở hữu (BENCHMARK_SPEC §8.3). Nhà phát triển giữ quyền ghi nhận tác giả và quyền công bố. Tổ chức quản trị có quyền sử dụng, sửa đổi, phân phối và thương mại hóa phương pháp cho ngôn ngữ của họ. Đây không phải là một hình phạt — đó là mục đích của giải thưởng. Tiền giải thưởng tài trợ cho việc tạo ra công nghệ thuộc về cộng đồng ngôn ngữ đó.

### 1.4 Chống Gian lận

Các ngưỡng giải thưởng được xác định dựa trên **đánh giá chuẩn vàng** (tập kiểm thử bí mật, được chạy bởi tổ chức quản trị trong hộp cát). Nhà phát triển không bao giờ được xem dữ liệu kiểm thử. Điều này được thực thi bằng kiến trúc — không phải là một chính sách dựa trên danh dự. Xem BENCHMARK_SPEC §8.2.

### 1.5 Cấp phép Ngữ liệu: Ngữ liệu Phi thương mại Không được tham gia Tuyến Giải thưởng

Một số ngữ liệu được sử dụng trong quá trình phát triển phương pháp có giấy phép phi thương mại — ví dụ, ngữ liệu EdTeKLA Cree Language Textbook mang giấy phép **CC BY-NC-SA sửa đổi của EdTeKLA** (phạm vi chủ quyền, phi thương mại; sách giáo khoa gốc là CC BY-NC-ND 4.0). Các ngữ liệu này **chỉ dành cho luồng nghiên cứu/phát triển**:

1. **Các ngữ liệu chuẩn vàng của giải thưởng không được chứa nội dung ngữ liệu được cấp phép NC (phi thương mại).** Các phân đoạn kiểm thử chuẩn vàng là các tác phẩm gốc do cộng đồng ủy quyền (xem Chiến lược Đối tác Ngữ liệu) — do con người viết cho giải thưởng, với các quyền được làm rõ cho việc đánh giá và triển khai thương mại ngay từ đầu.
2. **Một phương pháp yêu cầu nhận giải thưởng không được chứa nội dung ngữ liệu được cấp phép NC** (ví dụ: làm dữ liệu hướng dẫn, ví dụ nhúng hoặc bảng tra cứu). Phương pháp được chuyển giao phải có khả năng triển khai bởi tổ chức quản trị theo bất kỳ điều khoản nào họ chọn — bao gồm cả mục đích thương mại, nếu cộng đồng quyết định như vậy (BENCHMARK_SPEC §8.3); nội dung được cấp phép NC bên trong nó sẽ làm mất đi sự tự do đó.
3. **Nhà phát triển có thể tự do sử dụng ngữ liệu được cấp phép NC để phát triển và tự đánh giá** — đó là mục đích của tuyến phát triển. Hạn chế này áp dụng cho những gì được gửi và những gì được triển khai, chứ không áp dụng cho cách nhà phát triển học hỏi.

### 1.6 Các Nhóm Phụ thuộc Giới hạn Đủ điều kiện Nhận Giải

Mọi hoạt động đánh giá giải thưởng đều diễn ra trong một hộp cát (§1.4), và các phương pháp giành giải thưởng sẽ được chuyển giao cho tổ chức quản trị (§1.3). Cả hai thực tế này đều áp đặt cùng một ràng buộc: **mọi thứ mà một phương pháp phụ thuộc vào phải là thứ mà nhà phát triển có quyền đưa vào hộp cát và chuyển giao cho cộng đồng.** Mỗi bài nộp đều phải khai báo một nhóm phụ thuộc — được định nghĩa trong [đặc tả Giao diện Phương pháp](/docs/network/specifications/methods#method-validity-and-dependency-classes) — và tính đủ điều kiện sẽ tuân theo nhóm đó:

| Nhóm phụ thuộc | Đủ điều kiện nhận giải? | Điều kiện |
|------------------|----------------|------------|
| **S** — tự chứa (self-contained) | ✅ Có | Không có điều kiện nào khác ngoài các điều kiện ngưỡng ở §2 |
| **O** — mở bên ngoài (ví dụ: AGPL FST được sao chép khi nộp) | ✅ Có | Các tạo tác được ghim và tích hợp sẵn vào bài nộp; giấy phép cho phép chuyển giao cho cộng đồng; các điều khoản copyleft được bảo toàn (cộng đồng nhận được các quyền tương tự như giấy phép cấp cho mọi người) |
| **A1** — suy luận LLM có thể thay thế | ⚠️ Có điều kiện | Mô hình được khai báo, ghim và có thể thay thế (phải chạy trên một mô hình trọng số mở do cộng đồng lưu trữ); đánh giá được định tuyến qua cổng LLM của hộp cát (🔲 đã lên kế hoạch — các phương pháp A1 không thể tạo ra điểm chuẩn vàng cho đến khi cổng này hoạt động); việc chuyển giao truyền tải toàn bộ công thức (prompt, dữ liệu hướng dẫn, mã nguồn), chứ không phải mô hình |
| **A2** — API dịch vụ/dữ liệu bên ngoài không thể thay thế | ❌ Chưa được | Không đủ điều kiện cho đến khi bên giữ quyền cấp phép đưa vào hộp cát và cho phép chuyển giao. Được phép trên bảng xếp hạng mở với nhãn "phụ thuộc bên ngoài" hiển thị rõ ràng |
| **X** — nội dung đi kèm không có bản quyền | ❌ Không bao giờ | Không được chấp nhận trong mọi tuyến |

Nhóm của một phương pháp là nhóm hạn chế nhất trong số các phụ thuộc được khai báo của nó. Các phụ thuộc không được khai báo thuộc bất kỳ nhóm nào đều dẫn đến việc bị loại (§5).

---

## 2. Các Quỹ Giải thưởng Đề xuất (chưa có giải nào mở)

### 2.1 Giải thưởng của Nhà sáng lập — EN→Plains Cree (nêhiyawêwin)

| Trường | Giá trị |
|-------|-------|
| **Quỹ giải thưởng** | **$10,000 CAD** (đề xuất) |
| **Cặp ngôn ngữ** | Tiếng Anh → Tiếng Plains Cree (EN→CRK) |
| **Nhà tài trợ dự kiến** | Nhà sáng lập dự án Champollion — một cam kết dự kiến, **chưa có tiền quỹ nào được nắm giữ ở bất kỳ đâu.** Khi được cam kết, tiền quỹ sẽ nằm ở chỗ nhà tài trợ hoặc một quỹ tín thác cộng đồng được chỉ định — không bao giờ ở Champollion. |
| **Trạng thái** | **ĐỀ XUẤT — chưa mở.** Không tiếp nhận bài nộp. |
| **Mở giải** | Chỉ khi kho ngữ liệu chuẩn vàng, hộp cát đánh giá và cổng kiểm duyệt của người bản xứ đều tồn tại (hiện chưa có cái nào), và tiền quỹ của nhà tài trợ được xác minh là đang được nắm giữ theo §4.2. |
| **Hết hạn** | Không hết hạn sau khi đã mở. |

#### Các Điều kiện Ngưỡng

Một phương pháp nhận Giải thưởng của Nhà sáng lập bằng cách đáp ứng đồng thời **TẤT CẢ** các điều kiện sau:

| # | Điều kiện | Chỉ số | Ngưỡng | Lý do |
|---|-----------|--------|-----------|-----------|
| 1 | **Điểm tổng hợp** | `composite` (SCORING_SPEC §4) | **≥ 0.80** | Nằm giữa mức Có thể triển khai (0.70) và Trôi chảy (0.85). Yêu cầu chất lượng cao trên tất cả các khía cạnh chỉ số — không chỉ là tính hợp lệ về mặt hình thái. |
| 2 | **Mức độ chấp nhận của FST** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Hầu như tất cả các từ đầu ra phải là các dạng hợp lệ về mặt hình thái được công nhận bởi GiellaLT FST. Mức dung sai 1% dành cho các trường hợp đặc biệt (danh từ riêng, từ mới, từ mượn) mà FST có thể không bao quát một cách hợp lý. Đây là cổng chất lượng quyết định đối với dịch máy đa tổng hợp — nếu FST từ chối hơn 1% số từ, phương pháp đó đang tạo ra các dạng từ không tồn tại trong ngôn ngữ. Toàn bộ mục đích của giải thưởng này là mua một hệ thống không làm biến dạng ngôn ngữ. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55.0** | Mức độ trùng lặp n-gram ký tự phải vượt quá 55 trên thang điểm 0–100. Đảm bảo sự tương đồng ở mức bề mặt với các bản dịch tham chiếu, không chỉ là tính hợp lệ về mặt hình thái. |
| 4 | **Xác thực từ cộng đồng** | Đánh giá của con người (BENCHMARK_SPEC §7) | **≥ 70% "chấp nhận được" hoặc "xuất sắc"** | Một mẫu đầu ra được phân tầng (≥30 mục trên các mức độ khó từ 2–5) được đánh giá bởi ≥2 người nói song ngữ CRK. Ít nhất 70% các mục được đánh giá phải nhận được xếp hạng "chấp nhận được" hoặc "xuất sắc". |
| 5 | **Đánh giá chuẩn vàng** | Thực thi trong hộp cát (BENCHMARK_SPEC §8.2) | **Bắt buộc** | Tất cả các chỉ số tự động phải được tính toán dựa trên phân đoạn ngữ liệu `gold_standard`, được chạy bởi tổ chức quản trị trong môi trường hộp cát. Điểm số trên tập phát triển không được tính. |
| 6 | **Khả năng tái lập** | Khớp dấu vân tay (BENCHMARK_SPEC §3.8) | **±2%** | Tổ chức quản trị phải có thể chạy lại phương pháp và đạt được điểm số trong phạm vi ±2% so với thẻ chạy (run card) đã nộp. |

> **Tại sao lại là FST 99%+?** Vấn đề trung tâm trong dịch máy cho các ngôn ngữ đa tổng hợp là sự ảo tưởng (hallucination) — các mô hình LLM tạo ra các chuỗi ký tự trông *có vẻ* giống ngôn ngữ đích nhưng lại không hợp lệ về mặt hình thái. Một phương pháp tạo ra 95% đầu ra hợp lệ vẫn có 5% từ bị bịa đặt — tiếng ồn không thể chấp nhận được đối với bất kỳ mục đích sử dụng thực tế nào. Ngưỡng 99%+ yêu cầu mức độ ảo tưởng gần như bằng không trong khi vẫn cho phép các trường hợp ngoại lệ hiếm hoi (danh từ riêng mà FST không biết, từ mới hợp lệ). Nếu một phương pháp không thể đạt được mức độ chấp nhận FST 99%+, nó vẫn chưa giải quyết được vấn đề.
>
> **Tại sao lại là điểm tổng hợp 0.80?** Mức này nằm giữa Có thể triển khai (0.70) và Trôi chảy (0.85). Một phương pháp đạt 0.80 với mức chấp nhận FST 99%+ sẽ tạo ra đầu ra mà hầu như mọi từ đều là từ tiếng Cree có thật *và* chất lượng dịch thuật tổng thể là cao trên các khía cạnh bề mặt, cấu trúc và ngữ nghĩa. Cổng xác thực từ cộng đồng (điều kiện số 4) đảm bảo đây không chỉ là việc gian lận chỉ số — người bản xứ phải xác nhận đầu ra thực sự có thể sử dụng được.

#### Ý nghĩa Thực tế của Ngưỡng này

Tại mức điểm tổng hợp ≥ 0.80 với FST ≥ 0.99 và chrF++ ≥ 55, một người nói song ngữ thông thường sẽ thấy:

- **Hầu như mọi** từ đầu ra đều là từ tiếng Cree có thật (FST xác thực 99%+ — gần như không có các dạng từ ảo tưởng)
- Các danh mục ngữ pháp chính (ngôi, số, thì) đều chính xác trong hầu hết các mục
- Trật tự từ nhìn chung là tự nhiên
- Ý nghĩa được bảo toàn một cách đáng tin cậy
- Các lỗi còn lại là lỗi ngôn ngữ thực tế (chia từ sai, lỗi khách quan hóa/obviation không chính xác, không khớp về tính động/bất động) — chứ không phải là các từ bịa đặt
- Một người nói trôi chảy có thể sử dụng đầu ra như một bản nháp chất lượng cao và sửa đổi nó nhanh hơn đáng kể so với việc dịch từ đầu

Đây là một hệ thống **không làm biến dạng ngôn ngữ.** Nó có thể không hoàn hảo, nhưng mọi từ nó tạo ra đều là từ có thật. Đó là tiêu chuẩn tối thiểu cho việc dịch máy tôn trọng một ngôn ngữ đa tổng hợp.

---

## 3. Quy trình Nhận Giải thưởng

### 3.1 Nộp bài

1. Nhà phát triển nộp phương pháp hoàn chỉnh, có thể chạy được cho tổ chức quản trị:
   - Toàn bộ mã nguồn
   - Tất cả các phụ thuộc (dữ liệu hướng dẫn, từ điển, cấu hình FST, prompt)
   - Hướng dẫn cài đặt và thực thi
   - File README mô tả cách tiếp cận của phương pháp
   - Một thẻ chạy trên tập phát triển hiển thị điểm số xấp xỉ (để sàng lọc trước)

2. Nhà phát triển ký các điều khoản tham gia, bao gồm:
   - Điều khoản chuyển giao quyền sở hữu (BENCHMARK_SPEC §8.3)
   - Tuyên bố không huấn luyện trên dữ liệu đánh giá
   - Cam kết về khả năng tái lập

### 3.2 Đánh giá

1. Tổ chức quản trị cài đặt và chạy phương pháp trong một khung hộp cát đối với ngữ liệu `gold_standard`
2. Các chỉ số tự động được tính toán (tổng hợp, FST, chrF++, v.v.)
3. Nếu đạt được các ngưỡng tự động (điều kiện 1–3), tổ chức quản trị sẽ tiến hành đánh giá cộng đồng
4. Nếu KHÔNG đạt được các ngưỡng tự động, nhà phát triển sẽ nhận được điểm số và phản hồi. Không có hoạt động đánh giá cộng đồng nào được kích hoạt.

### 3.3 Đánh giá từ Cộng đồng

1. Một mẫu đầu ra được phân tầng (≥30 mục, bao gồm các mức độ khó từ 2–5) được trình bày cho những người nói song ngữ
2. Ít nhất 2 người đánh giá độc lập sẽ xếp hạng cho mỗi mục
3. Thang điểm đánh giá: **loại bỏ (reject)** / **hiểu ý chính (gist)** / **chấp nhận được (acceptable)** / **xuất sắc (excellent)**
4. Nếu ≥70% số mục nhận được đánh giá "chấp nhận được" hoặc "xuất sắc" từ cả hai người đánh giá, bước xác thực cộng đồng sẽ được thông qua

### 3.4 Giải ngân

1. Tất cả 6 điều kiện đều được đáp ứng
2. Tổ chức quản trị xác nhận kết quả
3. Giải thưởng được thanh toán trong vòng 30 ngày kể từ ngày xác nhận
4. Quyền sở hữu phương pháp được chuyển giao theo BENCHMARK_SPEC §8.3
5. Kết quả được công bố trên bảng xếp hạng với cấp độ xác minh "Đã được Cộng đồng Xác thực"

### 3.5 Nộp bài Nhiều lần

- Cùng một nhà phát triển/nhóm có thể nộp bài nhiều lần
- Mỗi bài nộp được đánh giá độc lập
- Nếu một phương pháp được cải tiến và nộp lại, chỉ có thẻ chạy mới nhất được tính
- Giải thưởng được trao cho phương pháp **đầu tiên** vượt qua tất cả các ngưỡng — giải thưởng không được chia nhỏ

### 3.6 Bài nộp theo Nhóm

- Các nhóm và các cặp Người cao tuổi - Thanh niên đều đủ điều kiện tham gia
- Việc phân chia giải thưởng trong nhóm là trách nhiệm của chính nhóm đó
- Tất cả các thành viên trong nhóm phải ký vào các điều khoản tham gia
- Phần ghi nhận tác giả trên bảng xếp hạng sẽ liệt kê tất cả các thành viên trong nhóm

---

## 4. Các Quỹ Giải thưởng Tương lai {#4-future-prize-pools}

Giải thưởng của Nhà sáng lập là hạt giống. Các quỹ giải thưởng bổ sung sẽ được tài trợ bởi các nhà tài trợ. Mỗi quỹ giải thưởng mới sẽ được tài liệu hóa thành một phần phụ mới của §2 với các thông tin riêng:

- Số tiền giải thưởng và đơn vị tiền tệ
- Cặp ngôn ngữ
- Ghi nhận nhà tài trợ
- Các điều kiện ngưỡng (có thể khác với Giải thưởng của Nhà sáng lập)
- Ngày hết hạn (nếu có)
- Bất kỳ điều kiện đặc biệt nào

### 4.1 Biểu mẫu Giải thưởng của Nhà tài trợ

Các nhà tài trợ tài trợ cho các quỹ giải thưởng với bất kỳ số tiền nào. Các cấp độ gợi ý:

| Cấp độ | Số tiền | Ngưỡng Gợi ý |
|------|--------|---------------------|
| **Hạt giống** | $5,000–$15,000 | Có thể triển khai (điểm tổng hợp ≥ 0.70) + xác thực từ cộng đồng |
| **Bứt phá** | $25,000–$50,000 | Trôi chảy (điểm tổng hợp ≥ 0.85) + xác thực từ cộng đồng |
| **Giải Đặc biệt** | $100,000+ | Trôi chảy + bao phủ đa phong cách ngôn ngữ + tích hợp triển khai |

Các nhà tài trợ cũng có thể tài trợ cho:
- **Phần thưởng cải tiến** — khoản thanh toán cố định cho mỗi 5 điểm cải tiến trong chrF++ so với kết quả tốt nhất hiện tại
- **Giải thưởng phong cách ngôn ngữ** — các giải thưởng riêng biệt cho các phong cách ngôn ngữ cụ thể (trang trọng, nghi lễ, giáo dục)
- **Giải thưởng tốc độ** — điểm số điều chỉnh theo chi phí tốt nhất (SCORING_SPEC §6.3)

### 4.2 Nơi Nắm giữ Tiền Quỹ Giải thưởng

Tiền quỹ giải thưởng được **nắm giữ bởi nhà tài trợ**: chúng nằm ở tổ chức tài trợ hoặc ở một quỹ tín thác cộng đồng do nhà tài trợ chỉ định — **không bao giờ ở Champollion**, bên chỉ điều phối việc đo lường và không chạm vào tiền. Một giải thưởng uy tín sẽ công bố trước khi mở giải: **ai là người nắm giữ tiền quỹ**, theo thỏa thuận nào (tài khoản tổ chức, quỹ tín thác hoặc ký quỹ bên thứ ba do nhà tài trợ chọn) và ngưỡng trao giải — để việc vượt qua ngưỡng có thể được xác minh từ điểm số được công bố cộng với phán quyết xác thực từ người bản xứ của cộng đồng, và việc quỵt thanh toán sẽ bị công khai rõ ràng. Hiện tại không có quỹ giải thưởng nào được nắm giữ ở bất kỳ đâu. Nếu một giải thưởng hết hạn mà không có người nhận, tiền quỹ vẫn ở nguyên nơi cũ — với nhà tài trợ — để được chuyển hướng hoặc rút về theo quyết định của nhà tài trợ. Cơ chế tự phục vụ, bao gồm rủi ro quỵt tiền của nhà tài trợ và các biện pháp giảm thiểu, được tài liệu hóa trong [Chạy một Cuộc thi Chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) và [Mẫu Điều khoản](/docs/network/sovereignty/terms-templates).

---

## 5. Bị loại

Một bài nộp sẽ bị loại nếu:

1. **Huấn luyện trên dữ liệu đánh giá.** Phương pháp đã được tiếp xúc với các mục ngữ liệu `gold_standard` hoặc `held_out`. (Điều này được ngăn chặn bằng kiến trúc thông qua việc thực thi trong hộp cát — nhưng nếu tìm thấy bằng chứng về sự ô nhiễm dữ liệu, kết quả sẽ bị hủy bỏ.)
2. **Không thể tái lập.** Tổ chức quản trị không thể tái lập điểm số trong phạm vi ±2%.
3. **Phụ thuộc không được khai báo hoặc không đủ điều kiện.** Phương pháp yêu cầu quyền truy cập thời gian chạy vào các dịch vụ bên ngoài vượt quá những gì tệp khai báo phụ thuộc của nó nêu rõ, hoặc nhóm phụ thuộc thực tế của nó là A2 hoặc X (§1.6). Việc suy luận LLM Nhóm A1 được khai báo định tuyến qua cổng đánh giá được cho phép; bất kỳ phụ thuộc mạng thời gian chạy nào khác — và bất kỳ phụ thuộc không được khai báo nào thuộc bất kỳ nhóm nào — đều dẫn đến việc bị loại.
4. **Chưa ký các điều khoản tham gia.** Tất cả các thành viên trong nhóm phải đồng ý chuyển giao quyền sở hữu.
5. **Phát hiện gian lận.** Đầu ra được tối ưu hóa cho chỉ số thay vì chất lượng dịch thuật (bị phát hiện bởi đánh giá cộng đồng và/hoặc các kiểm tra chống gian lận theo BENCHMARK_SPEC §9.3).

---

## 6. Mối quan hệ với các Đặc tả khác

| Tài liệu này | Tham chiếu đến | Dành cho |
|--------------|-----------|-----|
| §2 điều kiện ngưỡng | SCORING_SPEC §4 (tổng hợp), §2.1–2.2 (chỉ số), §5 (cấp độ) | Định nghĩa chỉ số và thang đo |
| §2 xác thực cộng đồng | BENCHMARK_SPEC §7 | Giao thức đánh giá của con người |
| §3 thực thi trong hộp cát | BENCHMARK_SPEC §8.2 | Cơ chế chủ quyền |
| §3 chuyển giao quyền sở hữu | BENCHMARK_SPEC §8.3 | Các điều khoản chuyển giao IP |
| §1.6 nhóm phụ thuộc | Đặc tả Giao diện Phương pháp; BENCHMARK_SPEC §8.6 | Định nghĩa nhóm, điều khoản chấp nhận, chính sách mạng hộp cát |
| §4 giải thưởng điều chỉnh theo chi phí | SCORING_SPEC §6.3 | Công thức điều chỉnh theo chi phí |

---

## 7. Đồng bộ hóa Mã nguồn – Đặc tả

### 7.1 Nguồn Chuẩn (Canonical Source)

Tài liệu này (`cli/website/docs/network/specifications/prize-spec.md`) là nguồn chuẩn cho:
- Định nghĩa quỹ giải thưởng (§2)
- Các điều kiện ngưỡng (§2.x)
- Quy trình nhận giải (§3)
- Quy tắc bị loại (§5)

### 7.2 Yêu cầu Triển khai

Khi một quỹ giải thưởng được kích hoạt:
1. Giao diện người dùng của bảng xếp hạng phải hiển thị các giải thưởng đang hoạt động và các điều kiện ngưỡng của chúng
2. Các thẻ chạy đáp ứng các ngưỡng tự động (điều kiện 1–3) phải được gắn cờ để đánh giá cộng đồng
3. Trường `quality_tier` trong schema của thẻ chạy đã ghi lại cấp độ ("deployable", "fluent")
4. Không cần thay đổi mã nguồn mới nào cho khung chạy — đặc tả giải thưởng là một lớp chính sách nằm trên hệ thống tính điểm hiện có

---

*Cấu trúc giải thưởng phải tương thích với các điều khoản chuyển giao quyền sở hữu. Người chiến thắng có thể nhận giải thưởng, nhưng phương pháp đó sẽ trở thành tài sản của tổ chức quản trị nếu nó đạt đến cấp độ Có thể triển khai (Deployable). Đây là thiết kế có chủ ý — giải thưởng tài trợ cho việc tạo ra công nghệ thuộc về cộng đồng ngôn ngữ.*
