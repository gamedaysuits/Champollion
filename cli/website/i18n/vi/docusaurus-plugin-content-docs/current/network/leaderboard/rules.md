---
sidebar_position: 1
title: "Quy định gửi"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# Đánh giá MT

> **Tóm tắt điều hành.** Trang này xác định các tiêu chí gửi lên bảng xếp hạng, các chỉ số chấm điểm (chrF++, chấp nhận FST, khớp chính xác, khớp tương đương, điểm ngữ nghĩa), chính sách chống gian lận, các cấp độ xác minh và quy trình gửi. Các phương pháp đã bị lộ dữ liệu đánh giá sẽ bị loại.

champollion bao gồm một khung đánh giá dịch máy được thiết kế để **đo điểm chuẩn có thể tái lập** của các phương pháp dịch — đặc biệt là đối với các ngôn ngữ ít tài nguyên và ngôn ngữ bản địa, nơi không tồn tại các điểm chuẩn MT tiêu chuẩn và các tuyên bố về chất lượng rất khó xác minh.

---

## Bảng xếp hạng

Điểm nhấn chính là **[Method Leaderboard](https://champollion.dev/leaderboard)** — một bảng điểm công khai, cập nhật trực tiếp và **đang mở nhận bài nộp**, nơi các nhà nghiên cứu và thành viên cộng đồng gửi và so sánh các phương pháp dịch thuật thông qua quy trình đánh giá có thể tái tạo và được gắn dấu vân tay.

Mỗi lượt gửi bao gồm:

- **Quy trình được gắn dấu vân tay (Fingerprinted pipeline)** — gắn với một Git commit và config hash cụ thể, để kết quả có thể truy xuất ngược lại mã chính xác đã tạo ra chúng
- **Tập dữ liệu được đánh phiên bản (Versioned dataset)** — được băm nội dung và đánh phiên bản; điểm số chỉ có thể so sánh trong cùng một phiên bản tập dữ liệu
- **Các chỉ số được chuẩn hóa (Standardised metrics)** — tất cả việc chấm điểm được tính toán bởi harness đánh giá chung, loại bỏ sự khác biệt trong quá trình triển khai
- **Các cấp độ tin cậy (Trust tiers)** — Tự đánh giá (Self-benchmarked), Đã xác minh bởi Champollion (Champollion Verified), hoặc Đã kiểm chứng bởi cộng đồng (Community Validated)
- **Theo dõi chi phí (Cost tracking)** — Chi phí API cho mỗi lượt gửi, để sự đánh đổi giữa chi phí và chất lượng được minh bạch

Bảng xếp hạng chấm điểm dựa trên năm chỉ số. Ba chỉ số hoạt động với mọi ngôn ngữ; hai chỉ số khả dụng cho tiếng Plains Cree và sẽ được tổng quát hóa khi chúng tôi mở rộng:

| Chỉ số | Loại | Đo lường điều gì |
|--------|------|------------------|
| **chrF++** | Điểm F-score n-gram ký tự | Chỉ số chất lượng chính — tương quan tốt với đánh giá của con người, đặc biệt là đối với các ngôn ngữ giàu hình thái |
| **Khớp chính xác** | Tỷ lệ khớp hoàn hảo | Độ chính xác nghiêm ngặt — tần suất bản dịch khớp chính xác với tiêu chuẩn vàng là bao nhiêu? |
| **Chấp nhận FST** | Tỷ lệ vượt qua cổng hình thái | Đối với các phương pháp có xác minh bộ chuyển đổi trạng thái hữu hạn (FST) — tỷ lệ đầu ra hợp lệ về mặt hình thái là bao nhiêu? |
| **Khớp tương đương** | Tỷ lệ biến thể chấp nhận được | Tỷ lệ khớp với tham chiếu hoặc một biến thể chấp nhận được (trật tự từ, quy ước chính tả). Hiện tại là CRK; đang tổng quát hóa. |
| **Điểm ngữ nghĩa** | Độ trung thực ngữ nghĩa | Khả năng bảo toàn ý nghĩa — bản dịch có nắm bắt được ý nghĩa dự định bất kể hình thức bề mặt hay không? Hiện tại là CRK; đang tổng quát hóa. |

:::info[Bộ chỉ số đầy đủ]
[Tài liệu đặc tả chấm điểm](/docs/network/specifications/scoring) định nghĩa danh mục chỉ số hoàn chỉnh (sáu danh mục: bề mặt, cấu trúc, ngữ nghĩa, hành vi, tính tuân thủ và các bộ so sánh được báo cáo), công thức điểm tổng hợp, bảng trọng số và các ngưỡng phân bậc chất lượng.
:::

**[→ Xem bảng xếp hạng](https://champollion.dev/leaderboard)**

---

## Các tập dữ liệu hiện có

### Tập phát triển EDTeKLA v1

Tập dữ liệu đánh giá đầu tiên, được xây dựng cho bản dịch tiếng Anh → Plains Cree (SRO). Được tạo bởi [nhóm nghiên cứu EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) tại Đại học Alberta.

| Thuộc tính | Giá trị |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Cặp ngôn ngữ** | EN → CRK (Tiếng Cree Đồng bằng, chính tả SRO) |
| **Số lượng mục** | Tập dev gồm 436 mục (`textbook_dev.json`); chi tiết đầy đủ được nêu một lần trên [trang Evaluation Datasets](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **Giấy phép** | [CC BY-NC-SA sửa đổi của EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, phạm vi chủ quyền) — phi thương mại; tách biệt khỏi bảng xếp hạng, giải thưởng và các luồng thương mại/API |
| **Nguồn gốc** | `gold_standard` (được xác minh bởi người bản ngữ), `textbook` (tài liệu giáo dục đã xuất bản) |

### FLORES+ Devtest — Chỉ dùng cho mục đích phát triển

> [!WARNING]
> **FLORES+ khả dụng cho việc phát triển và gỡ lỗi nhưng KHÔNG được sử dụng cho đánh giá bảng xếp hạng chính thức.** FLORES+ (ban đầu là Meta FLORES-200) là một tập dữ liệu điểm chuẩn công khai rộng rãi mà các LLM tiên phong gần như chắc chắn đã được huấn luyện trên đó. Điểm số đối với FLORES+ không phản ánh đáng tin cậy chất lượng dịch thuật thực tế cho các phương pháp dựa trên LLM. Các phương pháp không dùng LLM (FST, dựa trên luật, NMT được tinh chỉnh) ít bị ảnh hưởng hơn nhưng điểm FLORES+ vẫn không được công bố lên bảng xếp hạng.

Các fixture FLORES+ vẫn khả dụng trong `test/benchmark/fixtures/` để kiểm thử nhanh pipeline (smoke testing), xác thực chéo ngôn ngữ và sử dụng trong phát triển. Đánh giá chính thức sử dụng các kho ngữ liệu tùy chỉnh được xây dựng từ văn bản do con người viết, không có sẵn công khai dưới dạng song ngữ.

Xem [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) để biết lược đồ tập dữ liệu đầy đủ, các cấp độ khó và cách tạo tập dữ liệu của riêng bạn.

:::danger[KHÔNG HUẤN LUYỆN trên dữ liệu đánh giá]

**Các tập dữ liệu này chỉ dành cho mục đích đánh giá.** Các phương pháp được huấn luyện, tinh chỉnh, gợi ý vài lượt (few-shot-prompted) hoặc bằng cách khác bị lộ dữ liệu đánh giá sẽ tạo ra điểm số cao một cách nhân tạo và sẽ bị **loại khỏi bảng xếp hạng.**

Đây không phải là một gợi ý — đó là quy tắc quan trọng nhất để đảm bảo tính toàn vẹn của việc đánh giá. Hãy sử dụng các kho ngữ liệu riêng biệt để huấn luyện. Các tập đánh giá phải là dữ liệu chưa từng được mô hình của bạn nhìn thấy trong quá trình phát triển.

Nếu bạn đang sử dụng dữ liệu hướng dẫn (coaching data) hoặc các ví dụ few-shot, chúng phải đến từ **các nguồn hoàn toàn tách biệt**. Nếu còn nghi ngờ, đừng đưa vào.
:::

:::warning[Tính phi xác định của LLM]

Đầu ra của LLM là không xác định (non-deterministic). Điểm số thể hiện các phép đo tại một thời điểm cụ thể dưới các phiên bản mô hình và cấu hình API cụ thể. Các nhà cung cấp mô hình có thể cập nhật trọng số, chiến lược giải mã hoặc bộ lọc an toàn bất kỳ lúc nào, điều này có thể gây ra sự sai lệch điểm số giữa các lượt chạy. Bảng xếp hạng ghi lại chính xác mã định danh mô hình (slug) và dấu thời gian cho mỗi lượt gửi.
:::

---

## Điều gì tạo nên một phương pháp tốt

Không phải tất cả các phương pháp đều được tạo ra như nhau. Dưới đây là những điểm khác biệt giữa một công trình nghiên cứu nghiêm túc và những điểm số bị thổi phồng.

### Đặc điểm của một phương pháp mạnh mẽ

- **Tách biệt rõ ràng giữa dữ liệu huấn luyện và dữ liệu đánh giá** — phương pháp của bạn chưa bao giờ nhìn thấy tập đánh giá trong quá trình phát triển, tinh chỉnh, kỹ nghệ gợi ý (prompt engineering) hoặc lựa chọn ví dụ few-shot
- **Có thể tái lập** — người khác có thể sao chép kho lưu trữ của bạn, chạy hệ thống đánh giá và nhận được điểm số tương tự (trong giới hạn tính không xác định của LLM)
- **Được tài liệu hóa** — [thẻ phương pháp](/docs/network/specifications/methods) của bạn mô tả phương pháp của bạn làm gì, sử dụng những công cụ nào và các hạn chế của nó là gì
- **Trung thực về phạm vi** — nếu phương pháp của bạn chỉ hoạt động cho một cặp ngôn ngữ, hãy nói rõ; nếu nó bị giảm chất lượng trên một số cấu trúc hình thái nhất định, hãy ghi nhận điều đó
- **Nhận thức về cộng đồng** — đối với các ngôn ngữ bản địa, phương pháp của bạn tôn trọng chủ quyền dữ liệu. Bạn đã tham vấn các cộng đồng ngôn ngữ hoặc chỉ sử dụng dữ liệu được cấp phép mở

### Các dấu hiệu cảnh báo (những gì sẽ bị loại)

| Dấu hiệu cảnh báo | Tại sao lại là vấn đề |
|----------|--------------------|
| Huấn luyện trên dữ liệu đánh giá | Làm mất hoàn toàn mục đích của việc đánh giá. Điểm số bị thổi phồng sẽ gây hiểu lầm cho mọi người. |
| Lựa chọn kết quả tốt nhất (Cherry-picking) | Chạy 10 lần và chỉ gửi lượt chạy tốt nhất mà không tiết lộ các lượt chạy khác |
| Hậu xử lý không được tiết lộ | Sửa đổi đầu ra bằng thủ công trước khi chấm điểm |
| Dữ liệu hướng dẫn bị ô nhiễm | Sử dụng các ví dụ của tập đánh giá làm gợi ý few-shot hoặc mục từ điển |
| Tuyên bố sẵn sàng thương mại mà không có nguồn gốc rõ ràng | Nếu phương pháp của bạn sử dụng dữ liệu CC BY-NC-SA, nó không sẵn sàng cho mục đích thương mại |

### Các cấp độ xác minh

Các cấp độ xác minh mô tả **ai đã xác thực kết quả** — tách biệt với các cấp độ chất lượng (Cơ bản → Thành thạo) được định nghĩa trong [Thông số kỹ thuật chấm điểm, §5](/docs/network/specifications/scoring#5-quality-tiers), vốn mô tả ý nghĩa của điểm tổng hợp tự động.

| Cấp độ | Ý nghĩa | Cách đạt được |
|------|---------|--------------|
| **Tự đánh giá (Self-benchmarked)** | Bạn tự chạy harness và gửi kết quả | Xuất bản thẻ chạy của bạn với `mt-eval publish` |
| **Đã xác minh bởi Champollion (Champollion Verified)** | Máy chủ đã độc lập chấm điểm lại các đầu ra bạn gửi so với kho ngữ liệu tham chiếu được ghim mã băm (sha-pinned) và tái tạo lại điểm số của bạn | Tự động — mọi lượt gửi đều được chấm điểm lại (xem bên dưới) |
| **Đã kiểm chứng bởi cộng đồng (Community Validated)** | Những người nói song ngữ của ngôn ngữ đích, đủ điều kiện theo giao thức riêng của cộng đồng, đã đánh giá một mẫu phân tầng của đầu ra (≥30 mục, ≥2 người đánh giá) và ≥70% đạt tiêu chuẩn của cộng đồng. Chỉ được cấp thông qua thử nghiệm riêng của cộng đồng; việc giáng cấp do kiểm tra đột xuất được áp dụng hai chiều | Gửi mã phương pháp cho tổ chức quản trị — họ chạy nó với tập tiêu chuẩn vàng và đưa đầu ra cho cộng đồng đánh giá |

### Cách thức mở rộng quy mô xác minh: kiểm toán dựa trên trọng số danh tiếng

**Chúng tôi không khẳng định nguồn gốc.** Một hàng trên bảng xếp hạng được tạo ra bởi một người đóng góp chạy harness *mã nguồn mở* trên máy *của riêng họ*. "Lượt chạy này thực sự đã đi qua harness" không phải là điều mà máy chủ có thể xác minh đối với máy tính tự lưu trữ — khóa ký của harness nằm trong tay người đóng góp, vì vậy chữ ký xác thực một *cỗ máy, chứ không phải sự trung thực*. Thay vì giả vờ như vậy, **tính hợp lệ ở đây là do nỗ lực đạt được và có khả năng tự điều chỉnh**: một hàng đáng tin cậy vì điểm số của nó **có thể tái tạo** và vì người đóng góp đứng sau nó đã **đặt cược danh tiếng mà một sự gian lận bị phát hiện sẽ phá hủy.** Quá trình xác minh được chạy qua bốn lớp, do đó nó kỹ lưỡng ở những nơi cần thiết và tiết kiệm chi phí ở những nơi có thể — dự án không bao giờ phải chạy lại công việc của tất cả mọi người.

- **L0 — chấm điểm lại mọi thứ (miễn phí, 100%).** Máy chủ tính toán lại điểm số của bạn từ *chính các đầu ra bạn đã gửi* so với **kho ngữ liệu tham chiếu được ghim mã băm (sha-pinned)** (không phải bản sao bạn lưu trữ), bằng cùng một chỉ số mà harness sử dụng. Nếu điểm số không thể tái tạo từ các đầu ra, hoặc một tham chiếu được lưu trữ đã bị thay đổi, lượt chạy sẽ bị **loại bỏ** — chỉ riêng điều này đã loại bỏ một điểm số được nhập tay hoặc chỉnh sửa. Một lượt chạy có thể tái tạo sẽ được thăng cấp thành **Champollion Verified**, cấp độ duy nhất mà bảng xếp hạng xếp hạng. Quá trình này chạy trên mọi lượt gửi và mất vài mili-giây.
- **L1 — thang danh tiếng của người đóng góp.** Mỗi người đóng góp (được xác định bằng thông tin đăng nhập của họ) kiếm được danh tiếng *chỉ* bằng cách vượt qua các bước kiểm tra sâu hơn bên dưới — không bao giờ chỉ dựa vào số lượng, vì vậy việc tạo ra các danh tính mới không mang lại lợi ích gì. Danh tiếng là **công khai**, và nó quyết định tần suất kích hoạt bước kiểm tra tốn kém.
- **L2 — chạy lại một *mẫu* (bước kiểm tra tốn kém).** Đối với một tập phát triển *công khai*, L0 không thể bắt được một người đóng góp chỉ đơn giản sao chép tham chiếu làm "bản dịch" của họ. Để bắt được điều đó cần phải thực sự chạy lại mô hình — tính toán thực sự — vì vậy chúng tôi thực hiện nó trên một **mẫu**, không phải trên tất cả mọi người. Một lượt chạy được lấy mẫu cho một lần chạy lại L2 với xác suất tăng theo **mức độ rủi ro/đặt cược** (một lượt chạy thắp sáng cây cầu đầu tiên đến toàn bộ một ngữ hệ *luôn luôn* được chạy lại), tăng theo **sự bất thường** (một bước nhảy vọt quá tốt đến mức khó tin so với kết quả tốt nhất trước đó *luôn luôn* được chạy lại), và giảm theo **danh tiếng** (một người đóng góp đã vượt qua nhiều cuộc kiểm toán hiếm khi bị kiểm tra đột xuất; một người mới hoặc người gửi ẩn danh bị kiểm tra trên mọi lượt chạy cho đến khi họ giành được sự tin tưởng). Vượt qua kiểm toán L2 sẽ làm tăng danh tiếng.
- **L3 — sự chứng thực (xác minh miễn phí).** Khi hai người đóng góp *độc lập* chạy cùng một mô hình trên cùng một kho ngữ liệu và các đầu ra được chấm điểm lại của họ **khớp nhau**, sự trùng khớp đó *chính là* sự xác minh — và nó làm tăng danh tiếng của cả hai. Một sự **bất đồng** thực sự sẽ gắn cờ cả hai lượt chạy cho một cuộc kiểm toán L2. Việc tái tạo kết quả được khen thưởng thay vì bị coi là dư thừa.

**Một sự gian lận bị phát hiện là một thảm họa — giống như một sự thu hồi.** Một sự gian lận được chứng minh sẽ đưa danh tiếng của người đóng góp về không, **kiểm toán lại toàn bộ lịch sử đã xác minh của họ** (mỗi lượt chạy đã xác minh của họ đều được gửi trở lại qua quá trình xác minh), và được ghi lại **công khai** trong nhật ký kiểm toán. Đó là điều làm cho việc lấy mẫu nhẹ nhàng trở nên an toàn: việc gian lận một tập dev công khai có thể lọt qua trong một lượt chạy, nhưng cái giá phải trả dự kiến — mất tất cả sự tin tưởng đã kiếm được và toàn bộ hồ sơ của bạn bị xem xét lại — khiến nó trở thành một vụ cá cược tồi. Những quy tắc này ràng buộc các lượt chạy của chính những người bảo trì một cách công bằng.

**Tại sao việc đóng góp vẫn đáng giá.** Bạn luôn trả phần chi phí đắt đỏ (chạy phương pháp của bạn); dự án chỉ trả cho việc chấm điểm lại L0 miễn phí trên tất cả mọi người cộng với một lần chạy lại L2 trên một *mẫu thu hẹp* — tỷ lệ cao đối với người mới và các lượt chạy có tính chất quan trọng, tỷ lệ thấp đối với những người đóng góp đã được chứng minh. Chi phí xác minh được *khấu hao bằng danh tiếng và chia sẻ bằng sự chứng thực*, không phải trả lại toàn bộ mỗi lần.

---

## Cách gửi

1. **Xây dựng phương pháp của bạn** — xem [Building a Method](/docs/network/specifications/methods) để biết giao diện phương pháp
2. **Chạy harness** — xem [Eval Harness](/docs/network/specifications/harness) để biết cách thiết lập và sử dụng
3. **Tạo thẻ chạy** — harness tạo ra một thẻ chạy JSON với điểm số, dấu vân tay và siêu dữ liệu của bạn
4. **Xuất bản** — `mt-eval publish eval/logs/harness/<your-run-card>.json` tải thẻ chạy lên bảng xếp hạng
5. **Xuất hiện trên bảng xếp hạng** — lượt chạy của bạn được đưa lên ở trạng thái *Tự đánh giá (chưa xác minh)*, sau đó máy chủ tự động chấm điểm lại các đầu ra của bạn so với kho ngữ liệu được ghim mã băm (L0); khi nó tái tạo thành công, lượt chạy sẽ thăng cấp thành *Champollion Verified* — cấp độ duy nhất mà [Method Leaderboard](https://champollion.dev/leaderboard) xếp hạng. Việc kiểm toán sâu hơn dựa trên trọng số danh tiếng sẽ tuân theo các cấp độ tin cậy ở trên

---

## Chính sách Toàn vẹn: Thu hồi, Chạy lại, Gỡ bỏ, Tranh chấp

Được viết trước để việc thực thi là một quy trình, không phải là sự kịch tính. Những quy tắc này ràng buộc tất cả mọi người một cách công bằng — bao gồm cả các lượt chạy của chính những người bảo trì.

**Không có sự thu hồi.** Một lượt chạy được xuất bản là một bản ghi vĩnh viễn. Không có cơ chế nào — cho bất kỳ ai — để xóa một điểm số vì nó đáng xấu hổ. Mỗi hàng lượt chạy đều mang một dấu thời gian `submitted_at` được máy chủ đóng dấu và một dấu vết kiểm toán không thể thay đổi; bản thân các hành động kiểm duyệt cũng được ghi nhật ký.

**Chạy lại sẽ thêm vào, không bao giờ thay thế.** Nếu bạn cải thiện phương pháp của mình, hãy xuất bản một lượt chạy mới. Lượt chạy cũ vẫn giữ nguyên. Tiết lộ có chọn lọc — thử nghiệm riêng tư nhiều biến thể và chỉ xuất bản biến thể chiến thắng — là điều khiến các bảng xếp hạng khác có thể bị thao túng; một bản ghi chỉ-thêm-vào (append-only) là câu trả lời mang tính cấu trúc. Việc loại bỏ trùng lặp dấu vân tay ngăn chặn việc gửi lại thư rác giống hệt nhau từng byte; nó không bao giờ viết lại lịch sử.

**Gỡ bỏ là việc thực thi quy tắc, với quy tắc được nêu tên.** Một lượt chạy bị gỡ bỏ (được đánh dấu `disqualified`, hiển thị rõ ràng — không bị xóa âm thầm) chỉ vì các nguyên nhân được liệt kê: một tập dữ liệu bị cách ly hoặc là tập con không hợp lệ (được thực thi bởi trigger cơ sở dữ liệu bên dưới mọi client), sai lệch checksum của kho ngữ liệu, điểm số bịa đặt hoặc nằm ngoài phạm vi, vi phạm bảo vệ nội dung, hoặc người quản lý rút lại đăng ký của dữ liệu cơ sở. Việc gỡ bỏ sẽ nêu tên quy tắc và bằng chứng. Các nguyên nhân mới được thêm vào đây bằng bản chỉnh sửa có ghi ngày tháng trước khi chúng được áp dụng, không bao giờ được bịa ra hồi tố cho một trường hợp.

**Các cấp độ tin cậy là nhãn, không phải là chỉnh sửa.** Các hàng `self-benchmarked` là các tuyên bố; các hàng `Champollion Verified` đã được chấm điểm lại một cách độc lập từ các đầu ra của người gửi so với kho ngữ liệu được ghim mã băm; `Community Validated` chỉ được cấp thông qua thử nghiệm riêng của cộng đồng. Việc xác minh thay đổi cấp độ của một hàng — nó không bao giờ thay đổi điểm số của hàng đó.

**Danh tiếng là công khai và tự điều chỉnh.** Danh tiếng của người đóng góp, và nhật ký kiểm toán ghi lại mọi lần chấm điểm lại, chạy lại theo mẫu, chứng thực, và việc hủy bỏ do gian lận, đều được công khai. Danh tiếng không phải là hệ số nhân điểm và không bao giờ chạm vào các con số của một lượt chạy — nó chỉ thiết lập tần suất các lượt chạy của một người đóng góp bị kiểm toán lại (xem *kiểm toán dựa trên trọng số danh tiếng* ở trên). Một sự gian lận được chứng minh sẽ được ghi lại công khai như một sự thu hồi và kiểm toán lại toàn bộ lịch sử đã xác minh của người đóng góp; các quy tắc tương tự áp dụng cho các lượt chạy của chính những người bảo trì.

**Tranh chấp.** Mở một issue với id lượt chạy và khiếu nại cụ thể (sai điểm, sai tập dữ liệu, áp dụng sai quy tắc). Những người bảo trì sẽ chạy lại các kiểm tra tất định (deterministic checks) một cách công khai; kết quả và bằng chứng của nó sẽ được đưa lên issue. Nếu tranh chấp là về dữ liệu hoặc xác nhận của một cộng đồng, cơ quan có thẩm quyền của chính cộng đồng đó sẽ quyết định và hội đồng quản trị sẽ thực hiện quyết định của họ. Đối với các cuộc thi có giải thưởng, các quy tắc tương tự được áp dụng cộng với các bước kiểm toán và vòng loại đã được công bố trước của cuộc thi — những người chiến thắng được kiểm toán **trước khi** thanh toán, và việc truất quyền thi đấu sẽ trích dẫn quy tắc chính xác giống như bất kỳ việc gỡ bỏ nào khác.

## Hướng đi tương lai

- **Các lượt chạy so sánh mô hình toàn diện** — đánh giá hệ thống các mô hình tiên phong (GPT-4o, Claude, Gemini, v.v.) trên các ngôn ngữ của champollion bằng cách sử dụng các kho ngữ liệu đánh giá tùy chỉnh (không phải điểm chuẩn công khai)
- **Thêm nhiều cặp ngôn ngữ hơn** — tiếng Quechua, tiếng Inuktitut và các ngôn ngữ ít tài nguyên khác khi các tập dữ liệu được cộng đồng xác thực trở nên khả dụng
- **Nhập tập dữ liệu** — công cụ để chuyển đổi các tập dữ liệu đánh giá bên ngoài (WMT, Tatoeba, v.v.) sang định dạng đánh giá của champollion
- **Tự động chạy lại** — phát hiện các thay đổi phiên bản mô hình và chạy lại các điểm chuẩn để theo dõi sự sai lệch điểm số

---

## Xem thêm

- **[Bảng xếp hạng phương pháp](https://champollion.dev/leaderboard)** — điểm số trực tiếp và các lượt gửi
- **[Hệ thống đánh giá](/docs/network/specifications/harness)** — cách chạy đánh giá
- **[Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets)** — định dạng tập dữ liệu và các tập dữ liệu hiện có
- **[Xây dựng phương pháp](/docs/network/specifications/methods)** — thông số kỹ thuật giao diện phương pháp
- **[Thông số kỹ thuật thẻ lượt chạy](/docs/network/specifications/run-card)** — lược đồ JSON của thẻ lượt chạy
- **[Thông số kỹ thuật điểm chuẩn](/docs/network/specifications/benchmark)** — giao thức đánh giá, định dạng kho ngữ liệu, chủ quyền dữ liệu
- **[Thông số kỹ thuật chấm điểm](/docs/network/specifications/scoring)** — nguồn sự thật duy nhất (SSOT) cho các chỉ số, trọng số tổng hợp và các cấp độ chất lượng
