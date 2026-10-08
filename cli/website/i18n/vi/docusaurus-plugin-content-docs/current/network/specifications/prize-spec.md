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

Giải thưởng là một nửa mang tính khích lệ trong thỏa thuận ưu tiên đánh giá (eval-first). Một cộng đồng hoặc
nhóm nghiên cứu giám tuyển một tập đánh giá nhỏ, được niêm phong — khoảng vài trăm cặp câu,
mỗi cặp đều đã được kiểm tra ([Hợp tác ngữ liệu](/docs/network/specifications/corpus-partnership)
chính là quy trình đó). Một nhà tài trợ công bố giải thưởng gắn liền với điểm số mục tiêu trên tập
dữ liệu đó. Kể từ thời điểm đó, ngôn ngữ trở thành một thử thách thường trực: bất kỳ người xây dựng phương pháp
nào trên thế giới cũng có thể nhắm tới nó, bảng xếp hạng đo lường công khai mọi nỗ lực,
và chuẩn mực được quyết định bởi chính đáp án chuẩn của cộng đồng thay
vì bởi bất kỳ ai nói to nhất. Tài liệu này quy định cách hoạt động của một giải thưởng
như vậy — các điều kiện ngưỡng, quy trình nhận thưởng, các lớp phụ thuộc và quy tắc —
để chuẩn mực trở nên rõ ràng và không phụ thuộc vào phương pháp khi giải thưởng mở ra.

Giải thưởng được **nhà tài trợ cấp vốn và nắm giữ**: tiền nằm ở
tổ chức tài trợ, hoặc ở một quỹ tín thác cộng đồng do nhà tài trợ chỉ định —
**Champollion không bao giờ giữ, ký quỹ hay luân chuyển tiền thưởng.** Bất kỳ cộng đồng
hoặc tổ chức nào cũng có thể tự tổ chức một giải thưởng theo lộ trình tự phục vụ trong
[Tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest),
tự nắm giữ ngữ liệu và tiền của chính mình.

> **Trạng thái: ĐỀ XUẤT — chưa có giải thưởng nào mở và chưa có phần thưởng nào ở đây có thể nhận được.**
> Điều kiện tiên quyết để một giải thưởng *mở ra* nằm ở khía cạnh đo lường: một
> ngữ liệu chuẩn vàng được cộng đồng đồng thuận và cổng đánh giá từ người bản ngữ.
> Cả hai hiện đều chưa tồn tại. Hộp cát đánh giá cô lập vật lý (air-gapped) đã được phát hành — xem
> [Quy cách Benchmark §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> Chưa có điểm số nào trên trang web này vượt qua ngưỡng giải thưởng. Xem
> [Các hạn chế trung thực](/docs/network/honest-limitations). Tham chiếu chỉ số:
> [Quy cách tính điểm](/docs/network/specifications/scoring); giao thức:
> [Quy cách Benchmark](/docs/network/specifications/benchmark).

> **Lớp cam kết đã hoạt động.** Tính năng đóng băng giúp các điều khoản giải thưởng đã công bố
> không thể chỉnh sửa một khi đã có bài dự thi, cùng các kết quả được giữ lại (`hidden_until_close`),
> được thực thi trong cơ sở dữ liệu trên endpoint do mạng lưu trữ kể từ ngày
> 07-09-2026. Một host liên kết nhận được các quy tắc tương tự bằng cách áp dụng bản di chuyển (migration)
> đi kèm với harness; đối với endpoint cũ hơn, harness sẽ quay về tập cơ sở
> và thông báo rõ ràng thay vì giả vờ hoạt động. Quy tắc chỉ xuất
> dữ liệu tổng hợp trong §3.2 luôn được thực thi ở mọi nơi.

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

> Để tài trợ một giải thưởng, tổ chức quyên góp tài nguyên tính toán hoặc thảo luận về quan hệ đối tác,
> hãy liên hệ với dự án qua [GitHub](https://github.com/gamedaysuits). Chưa có người giám sát
> khóa cộng đồng nào được chỉ định, và chưa có quốc gia hay tổ chức nào được nêu tên
> là đối tác trước khi họ đồng thuận.

---

## 1. Triết lý

> **Thỏa thuận tóm gọn trong một câu: giải mã một ngôn ngữ, chiến thắng, theo các điều khoản do host công bố.**
> Champollion chủ đích là một hoạt động đo kiểm chuẩn ML — cạnh tranh là cách các cặp ngôn ngữ khó được giải quyết.
> Chúng tôi mời các nhà nghiên cứu ML và bất kỳ ai có năng lực xây dựng phương pháp
> tốt nhất cho một cặp ngôn ngữ khó cụ thể và giành giải thưởng. Điều gì xảy ra với
> phương pháp sau đó là lựa chọn được công bố của **host**, không phải của chúng tôi và không có
> mặc định nào: một cộng đồng muốn phương pháp chiến thắng được bàn giao sẽ nêu rõ trong
> điều khoản của họ, và cộng đồng chỉ muốn đo lường rồi xóa bỏ sẽ nêu rõ điều đó (§1.3).
> Năng lượng cạnh tranh là có thật, và nó hướng tới sứ mệnh — dịch được mọi
> ngôn ngữ, theo các điều khoản do chính người dân của ngôn ngữ đó đặt ra — chứ không phải leo bảng xếp hạng
> vì danh tiếng đơn thuần.

### 1.1 Giải thưởng Phần thưởng cho Sự bứt phá, Không phải Sự tham gia

Tiền giải thưởng chỉ được giải ngân khi một phương pháp chứng minh được rằng nó đạt được ngưỡng năng lực đã xác định. Không có giải thưởng tham gia, giải khuyến khích hoặc khoản thanh toán an ủi. Nếu không ai vượt qua ngưỡng, không ai được trả tiền. Đây là thiết kế có chủ ý — điều đó có nghĩa là các nhà tài trợ chỉ trả tiền cho những kết quả thực sự hoạt động hiệu quả.

### 1.2 Xác thực từ Cộng đồng là Không thể Thương lượng

Các chỉ số tự động chỉ là các đại diện (SCORING_SPEC §1.1). Một phương pháp có thể đạt điểm cao trên chrF++ và mức độ chấp nhận của FST trong khi tạo ra đầu ra mà không người bản xứ nào chấp nhận được. **Mọi yêu cầu nhận giải thưởng đều yêu cầu xác thực từ cộng đồng** — những người nói song ngữ phải xác nhận đầu ra có thể sử dụng được. Đây là cổng xác thực con người (BENCHMARK_SPEC §7).

### 1.3 Điều gì xảy ra với phương pháp chiến thắng được tuyên bố rõ ràng, không suy diễn {#1-3-declared-terms}

Có một điều cố định, bởi vì đó chính là bản chất của một cuộc thi có chủ quyền: bài dự thi được bàn giao cho nút cô lập vật lý của chính host, nút này sẽ chạy bài thi với tập niêm phong trên máy của host. Điều gì xảy ra với nó *sau đó* là lựa chọn do host công bố, được đưa ra theo từng cuộc thi và xuất bản kèm theo — và đó là **một trong ba lựa chọn**:

| Điều khoản | Ý nghĩa đối với bạn |
|---|---|
| `pass_to_holders` — *chuyển giao cho bên nắm giữ* | Phương pháp được chuyển giao cho các bên nắm giữ benchmark có chủ quyền. Họ tính điểm và giữ lại phương pháp, bất kể ai chiến thắng. |
| `retain_ip` — *giữ lại quyền sở hữu trí tuệ* | Bạn giữ quyền sở hữu phương pháp của mình. Host tính điểm và giữ tối đa một bản sao niêm phong để kiểm toán. |
| `release_open` — *phát hành mở* | Bạn giữ quyền sở hữu nhưng phải phát hành phương pháp theo giấy phép mở. Việc phát hành đó là điều kiện nhận thưởng. |

Mọi thứ khác phát sinh từ một điều khoản — liệu artifact có được giữ lại hay không, liệu có quyền nào bị chuyển giao hay không, host có thể sử dụng nó vào mục đích gì, khi nào đến hạn phát hành — đều được **suy ra** từ tùy chọn mà host đã chọn (§2.1, điều kiện 7), chứ không phải là một ô riêng biệt để host tích chọn. Host chọn điều khoản; các chi tiết sẽ tự động suy ra theo sau.

Hai hệ quả đáng được nêu rõ ràng:

- **Cuộc thi không công bố điều khoản giải thưởng sẽ không có giải thưởng.** Đó là mặc định. Đây không phải là cuộc thi kém quan trọng hơn, và không có quyền nào của bài dự thi bị chuyển dịch.
- **Không có điều gì là ngầm định.** Điều khoản được công bố sẽ được băm (hash), hiển thị cho người dự thi bằng ngôn ngữ dễ hiểu và được chấp thuận thông qua mã băm đó; sự chấp thuận được đính kèm bên trong bài dự thi và được bảo đảm bởi mã băm nội dung của nó, và nút của host sẽ từ chối bài dự thi nào chấp thuận bất kỳ điều gì khác. Điều khoản sau đó sẽ bị đóng băng ngay khi cuộc thi có bài dự thi đầu tiên, do đó không ai bị ràng buộc bởi các điều khoản mà họ chưa từng đọc.

Khi host chọn `pass_to_holders`, nhà phát triển vẫn giữ quyền ghi nhận tác giả và quyền công bố, và mục đích của sự sắp xếp này là tiền thưởng sẽ tài trợ cho công nghệ mà cộng đồng ngôn ngữ thực sự có thể sử dụng. Đó là lý do chính đáng để một host cộng đồng chọn điều khoản này. Đó là một lựa chọn, không phải một quy tắc bắt buộc.

### 1.4 Chống Gian lận

Các ngưỡng giải thưởng được xác định dựa trên **đánh giá chuẩn vàng** (tập kiểm thử bí mật, được chạy bởi tổ chức quản trị trong hộp cát). Nhà phát triển không bao giờ được xem dữ liệu kiểm thử. Điều này được thực thi bằng kiến trúc — không phải là một chính sách dựa trên danh dự. Xem BENCHMARK_SPEC §8.2.

### 1.5 Cấp phép Ngữ liệu: Ngữ liệu Phi thương mại Không được tham gia Tuyến Giải thưởng

Một số ngữ liệu được sử dụng trong quá trình phát triển phương pháp mang giấy phép phi thương mại — ví dụ: ngữ liệu Sách giáo khoa tiếng Cree của EdTeKLA mang giấy phép **CC BY-NC-SA sửa đổi của EdTeKLA** (phạm vi chủ quyền, phi thương mại; sách giáo khoa gốc là CC BY-NC-ND 4.0). Các ngữ liệu này **chỉ dành cho làn nghiên cứu/phát triển**:

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
| **Quỹ giải thưởng** | **$10.000 CAD** (đề xuất) |
| **Cặp ngôn ngữ** | Tiếng Anh → Plains Cree (EN→CRK) |
| **Nhà tài trợ dự kiến** | Người sáng lập dự án Champollion — một cam kết dự kiến, **chưa có quỹ nào được giữ ở bất kỳ đâu.** Khi được cam kết, số tiền này sẽ nằm ở nhà tài trợ hoặc một quỹ tín thác cộng đồng được chỉ định — không bao giờ nằm ở Champollion. |
| **Trạng thái** | **ĐỀ XUẤT — chưa mở.** Chưa nhận bài nộp. |
| **Mở khi** | Chỉ khi ngữ liệu chuẩn vàng và cổng đánh giá từ người bản ngữ tồn tại (hiện cả hai đều chưa có), hộp cát đánh giá đã được chứng minh với các mô hình thực tế (cho đến nay nó mới chỉ chạy thử một phương pháp mô phỏng), và quỹ của nhà tài trợ được nắm giữ có thể xác minh theo §4.2. |
| **Hết hạn** | Không hết hạn khi đã mở. |

#### Các Điều kiện Ngưỡng

Một phương pháp nhận Giải thưởng của Nhà sáng lập bằng cách đáp ứng đồng thời **TẤT CẢ** các điều kiện sau:

| # | Điều kiện | Chỉ số | Ngưỡng | Cơ sở lý luận |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Điểm tổng hợp~~ — **đã ngừng sử dụng** | — | — | Điều kiện này (điểm tổng hợp ≥ 0,80) đã ngừng sử dụng cùng với điểm tổng hợp vào ngày 04-10-2026 ([Quy cách tính điểm §4](/docs/network/specifications/scoring#4-composite-score)). Điều kiện điểm số hiện chỉ là chrF++ độc lập (điều kiện 3); số thứ tự được giữ lại để các điều kiện khác không bị đổi số. |
| 2 | **Chấp nhận FST** (cổng chẩn đoán, không phải điểm số) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Về cơ bản, tất cả các từ đầu ra phải là các dạng hình thái hợp lệ được FST của GiellaLT công nhận. Dung sai 1% dành cho các trường hợp ngoại lệ (danh từ riêng, từ mới, từ mượn) mà FST có thể không bao quát một cách hợp lý. Đây là cổng chất lượng định hình cho dịch máy ngôn ngữ đa tổng hợp (polysynthetic MT) — nếu FST từ chối hơn 1% số từ, phương pháp đó đang tạo ra các dạng từ không tồn tại trong ngôn ngữ. Toàn bộ mục đích của giải thưởng này là để có được một hệ thống không làm biến dạng ngôn ngữ. |
| 3 | **chrF++** (điểm số) | `chrf_plus_plus` (SCORING_SPEC §2.1), cùng chữ ký sacreBLEU và khoảng tin cậy 95% | **≥ 55,0** | chrF++ của ngữ liệu trên tập niêm phong phải đạt 55 trên thang điểm 0–100 — chỉ số tiêu đề chuẩn ([Quy cách tính điểm](/docs/network/specifications/scoring#how-runs-are-scored)). Nó so sánh từng đầu ra với bản dịch tham chiếu, do đó một hệ thống không thể vượt qua bằng các từ hợp lệ nhưng không dịch đúng văn bản đầu vào. |
| 4 | **Xác thực của cộng đồng** | Đánh giá bởi con người (BENCHMARK_SPEC §7) | **≥ 70% "chấp nhận được" hoặc "xuất sắc"** | Một mẫu phân tầng các đầu ra (≥30 bài trên các mức độ khó từ 2–5) được xem xét bởi ≥2 người nói tiếng CRK song ngữ. Ít nhất 70% số bài được xem xét phải nhận được đánh giá "chấp nhận được" hoặc "xuất sắc". |
| 5 | **Đánh giá chuẩn vàng** | Thực thi trong hộp cát (BENCHMARK_SPEC §8.2) | **Bắt buộc** | Tất cả các chỉ số tự động phải được tính toán trên phân đoạn ngữ liệu `gold_standard`, do tổ chức quản trị chạy trong môi trường hộp cát. Điểm trên tập phát triển không được tính. |
| 6 | **Khả năng tái lập** | Khớp dấu vân tay (BENCHMARK_SPEC §3.8) | **±2%** | Tổ chức quản trị phải có khả năng chạy lại phương pháp và đạt điểm số trong phạm vi ±2% so với run card đã nộp. |
| 7 | **Các điều khoản giải thưởng đã công bố của cuộc thi được đáp ứng** | Các xác minh mà điều khoản đó yêu cầu (xem bên dưới) | **Bắt buộc** | Giải thưởng chỉ tồn tại trong các cuộc thi có chủ quyền, nơi bài dự thi của bạn được thực thi bởi nút cô lập vật lý của host trên một tập niêm phong. Điều gì xảy ra với nó *sau đó* là một trong ba tùy chọn được công bố kèm theo cuộc thi trước khi mở nhận bài — không phải là một điều kiện đơn lẻ áp dụng cho mọi cuộc thi. |

#### Chi tiết về điều kiện 7: điều khoản là một trong ba lựa chọn

Mọi cuộc thi có chủ quyền đều hoạt động theo cùng một cách tại thời điểm thực thi: bạn giao phương pháp
của mình (trọng số hoặc mã nguồn) cho nút cô lập vật lý của host, và nút này sẽ chấm điểm
trên tập niêm phong. Đó chính là ý nghĩa của việc "host đã đo lường", và điều này
không thể thay đổi.

Điều gì xảy ra *sau* đó là lựa chọn của host, được công bố theo từng cuộc thi, và
là một trong ba tùy chọn. Host sẽ công bố điều này trước khi mở nhận bài dự thi; nó sẽ bị
**đóng băng** ngay khi cuộc thi có bài dự thi đầu tiên, vì vậy điều khoản bạn đọc được chính là
điều khoản ràng buộc bạn.

| Điều khoản | Ý nghĩa đối với bạn |
|---|---|
| `pass_to_holders` — *chuyển giao cho bên nắm giữ* | Phương pháp được chuyển giao cho các bên nắm giữ benchmark có chủ quyền. Họ tính điểm và giữ lại phương pháp, bất kể ai chiến thắng. |
| `retain_ip` — *giữ lại quyền sở hữu trí tuệ* | Bạn giữ quyền sở hữu phương pháp của mình. Host tính điểm và giữ tối đa một bản sao niêm phong để kiểm toán. |
| `release_open` — *phát hành mở* | Bạn giữ quyền sở hữu nhưng phải phát hành phương pháp theo giấy phép mở. Việc phát hành đó là điều kiện nhận thưởng. |

**Ý nghĩa chi tiết của từng tùy chọn.** Bốn khía cạnh này — cùng với giấy phép
đi kèm với yêu cầu phát hành bắt buộc — đều được *suy ra* từ tùy chọn: host
không bao giờ viết `rights` hoặc `host_use` thủ công, và không cuộc thi nào có thể phối hợp lẫn lộn
chúng:

| Trường | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — artifact có còn tồn tại sau khi chấm điểm không? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — quyền sở hữu có bị chuyển giao không? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — host có thể sử dụng nó cho mục đích gì? | `any` | `evaluation_only` | `any` (theo giấy phép mở mà bạn đã phát hành) |
| `release` — **bạn** có phải phát hành nó không, và khi nào? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — bạn phát hành theo giấy phép nào | — | — | `any_osi`, hoặc mã định danh SPDX được chỉ định |

Hai trong số các tùy chọn cho phép host thu hẹp một trường, và chỉ có vậy:

- trong `retain_ip`, host có thể đặt `retention` thành `delete_after_scoring` — phương pháp của bạn sẽ bị hủy sau khi được chấm điểm;
- trong `release_open`, host có thể chuyển việc phát hành sang `required_before_scores` (bạn phát hành trước khi điểm số của chính bạn được công bố) hoặc `required_after_prize` (bạn phát hành sau khi thanh toán giải thưởng), và có thể chỉ định giấy phép thay vì chấp nhận bất kỳ giấy phép nào được OSI phê duyệt.

Một `community_terms_url` — liên kết `https://` tới các điều khoản bằng văn bản của chính host —
có thể đi kèm với bất kỳ tùy chọn nào trong ba tùy chọn trên. Trên chính cuộc thi, tùy chọn đã chọn
được ghi lại dưới dạng `disposition` của nó, và đó là giá trị duy nhất mà mọi thứ ở trên
được suy ra.

Bất kỳ điều gì khác đều bị từ chối khi cuộc thi được tạo: một tùy chọn không thể cung cấp
trường mà nó vốn không hỗ trợ, và một trường được nhập thủ công trong khi đáng lẽ phải
được suy ra sẽ bị từ chối kèm theo tên trường thay vì âm thầm chấp nhận.

**Những gì được kiểm tra trước khi giải thưởng được chi trả.** Các xác minh bắt buộc phát sinh
trực tiếp từ điều khoản; không có host nào cấu hình riêng lẻ chúng:

- **Bàn giao** — luôn luôn áp dụng. Host nắm giữ chính xác artifact mà nó đã chấm điểm (mã băm
  phương pháp được nút ghi lại). Điều này được đo lường cụ thể.
- **Phát hành** — theo `release_open`, khi việc phát hành đến hạn trước khi công bố điểm
  hoặc trước khi trao giải. Host ghi lại URL phát hành và mã SHA-256 của
  artifact đã phát hành; bản ghi được kiểm tra, và URL không bao giờ được fetch (truy xuất mạng), do đó một
  kết quả đã đóng băng không bao giờ phụ thuộc vào thời gian hoạt động của bên thứ ba. Việc phát hành bắt buộc
  *sau* khi nhận giải là một nghĩa vụ đến hạn sau khi thanh toán, vì vậy nó không nằm trong
  các bước kiểm tra chi trả.
- **Chuyển nhượng** — theo `pass_to_holders`, nơi quyền sở hữu được chuyển giao. Văn bản
  chuyển nhượng là một công cụ pháp lý được ký bên ngoài nền tảng này; host ghi lại văn bản đó
  cùng ngày ký, và nền tảng xác minh rằng bản ghi có tồn tại.
  **Nền tảng không bao giờ xác minh tính pháp lý.**

**Cuộc thi không công bố điều khoản giải thưởng sẽ không có giải thưởng.** Không có điều khoản mặc định
và không có điều khoản nào được giả định thay cho bất kỳ ai. Tham gia một cuộc thi có
công bố điều khoản đồng nghĩa với việc chấp nhận nó một cách rõ ràng, thông qua mã băm của nó, tại thời điểm nộp bài —
sự chấp thuận này được đóng gói vào gói nộp của bạn và là một phần trong những gì nút của host
kiểm tra.

> **Tại sao lại là 99+% FST?** Vấn đề cốt lõi trong dịch máy đối với các ngôn ngữ đa tổng hợp là ảo giác (hallucination) — các LLM tạo ra các chuỗi ký tự *trông có vẻ* giống ngôn ngữ đích nhưng lại không hợp lệ về mặt hình thái học. Một phương pháp tạo ra 95% đầu ra hợp lệ vẫn có tới 5% từ ngữ bịa đặt — mức nhiễu không thể chấp nhận được cho bất kỳ mục đích sử dụng thực tế nào trong môi trường production. Ngưỡng 99%+ đòi hỏi mức độ ảo giác gần như bằng không trong khi vẫn chừa chỗ cho các trường hợp ngoại lệ hiếm gặp (danh từ riêng mà FST không biết, từ mới hợp lệ). Nếu một phương pháp không thể đạt được tỷ lệ chấp nhận FST từ 99%+ trở lên, thì nó vẫn chưa giải quyết được bài toán.
>
> **Tại sao cần kết hợp cả chrF++ và FST, và tại sao chỉ một trong hai là không đủ.** Tỷ lệ chấp nhận FST chỉ cho biết mỗi từ đều tồn tại; một hệ thống lặp lại duy nhất một câu hợp lệ cho mọi đầu vào vẫn có thể vượt qua FST một cách tuyệt đối. chrF++ so sánh từng đầu ra với bản dịch tham chiếu, do đó nó sẽ phát hiện ra điều đó. Cả hai con số tự động này đều không chứng nhận chất lượng: cổng xác thực cộng đồng (điều kiện #4) mới là yếu tố xác nhận rằng người bản ngữ thấy đầu ra có thể sử dụng được.

#### Ý nghĩa Thực tế của Ngưỡng này

Những gì các điều kiện cùng nhau thiết lập:

- **Hầu như mọi** từ đầu ra đều là từ tiếng Cree có thật (FST xác thực 99%+ — gần như không có dạng từ bịa đặt)
- Các đầu ra gần với bản dịch tham chiếu trên tập niêm phong (chrF++ ≥ 55)
- Những người nói song ngữ, theo quy trình riêng của cộng đồng, đã đánh giá ít nhất 70% mẫu phân tầng ở mức chấp nhận được hoặc tốt hơn — điều kiện duy nhất thể hiện chất lượng thực sự
- Các lỗi còn lại là lỗi ngôn ngữ thực tế (sai biến hình từ, sai thể gián tiếp/obviation, không khớp về tính sống động/animacy) — không phải các từ bịa đặt

Đây là một hệ thống **không làm biến dạng ngôn ngữ.** Nó có thể không hoàn hảo, nhưng mọi từ nó tạo ra đều là từ có thật. Đó là tiêu chuẩn tối thiểu cho việc dịch máy tôn trọng một ngôn ngữ đa tổng hợp.

---

## 3. Quy trình Nhận Giải thưởng

### 3.1 Tiếp nhận, sau đó nộp bài

1. **Đạt điều kiện công khai.** Nhà phát triển tự chấm điểm tập phát triển (dev set) đã phát hành của cuộc thi bằng hệ thống của chính họ và giữ lại biên nhận (`mt-eval contest qualify`). Biên nhận về bản chất là tự báo cáo — đó là một lời tuyên bố, và host sẽ kiểm tra lời tuyên bố này ở bước 4.

2. **Bàn giao bài dự thi.** Việc tham gia cuộc thi được thực hiện bằng cách cung cấp cho nút của host thứ gì đó mà nó có thể chạy, theo một trong hai làn:
   - một **mô hình** — các trọng số safetensors, một declarative tokenizer và tệp cấu hình, hoàn toàn không có mã nguồn (`mt-eval contest submit-model`); hoặc
   - một **phương pháp** — một Dockerfile và một entrypoint, đã được tích hợp sẵn các gói phụ thuộc (vendored) để có thể build và chạy mà không cần mạng (`mt-eval contest submit-method`).

   Việc tải lên các bản dịch của một tập kiểm thử đã phát hành, và liên kết tới một điểm số do chính nhà phát triển công bố, đã **ngừng sử dụng làm đường dẫn nộp bài thi vào ngày 06-09-2026** và các lệnh đã bị xóa. Điểm số tự báo cáo vẫn thuộc về bảng xếp hạng mở, vốn là một bảng công khai được lập chỉ mục theo ngữ liệu và chiều cặp ngôn ngữ — không phải là một cuộc thi và không phải là một làn giải thưởng.

3. **Khai báo trên chính bài dự thi:** phân nhánh (`constrained` — chỉ được huấn luyện trên dữ liệu mà host cho phép — hoặc `unconstrained`), số lượng tham số, giấy phép của trọng số và liệu chúng có công khai hay không, dữ liệu huấn luyện mà tuyên bố ràng buộc đề cập đến, liệu đây là bài dự thi chính của đội hay bài dự thi tương phản (contrastive), và — khi cuộc thi yêu cầu — phần mô tả hệ thống. Nhà phát triển cũng truyền `--agree` cho các điều khoản nộp phương pháp, và khi cuộc thi công bố các điều khoản giải thưởng, truyền `--accept-terms <hash>` cho các điều khoản đó.

### 3.2 Đánh giá

1. Nút của host thực hiện **các bước kiểm tra tĩnh** trên gói nộp, từ chối bất kỳ thứ gì cần đến mạng, và từ chối bài dự thi đã chấp thuận các điều khoản giải thưởng khác với những điều khoản mà cuộc thi này công bố.
2. Nút **tự thực thi lại bước đủ điều kiện**, trên bản sao tập dev công khai của chính nó, sử dụng cùng trình thực thi làn và cùng bộ chấm điểm. Biên nhận của nhà phát triển chỉ là một lời tuyên bố; đây mới là phép đo thực tế. Việc không đạt yêu cầu sẽ bị từ chối tại đây — trước khi bất kỳ người giám sát nào được yêu cầu phê duyệt bất kỳ điều gì, và trước khi tập niêm phong được mở ra — nêu rõ những gì đã tuyên bố, những gì đã đo được và mức chuẩn là bao nhiêu.
3. **Người giám sát ủy quyền** lượt chạy niêm phong (M-trên-N, theo mô hình ủy quyền của cuộc thi). Quyền cấp phép chỉ sử dụng một lần, có giới hạn thời gian và được liên kết với dấu vân tay chính xác (bundle hash, corpus, corpus version, node).
4. Bài dự thi chạy với ngữ liệu niêm phong `gold_standard` bên trong hộp cát cách ly mạng trên chính máy của host, và các chỉ số tự động được tính toán (chrF++ cùng CI và chữ ký của nó, các chỉ số chuẩn khác, và các chẩn đoán như tỷ lệ chấp nhận FST). Tập holdout niêm phong đã khai báo và bất kỳ bộ kiểm thử của bên thứ ba nào cũng chạy trong **cùng** một lượt chạy được ủy quyền đó.
5. **Chỉ có điểm số tổng hợp được đưa ra ngoài** — được thực thi ở tầng cơ sở dữ liệu, không phải theo quy ước. Nếu cuộc thi cam kết `hidden_until_close`, thẻ thông tin sẽ được giữ lại cho đến khi việc kết thúc cuộc thi công bố nó.
6. Nếu đạt các ngưỡng tự động (điều kiện 2–3), host sẽ tiến hành đánh giá cộng đồng. Nếu không đạt, nhà phát triển sẽ nhận được điểm số của họ và không có quy trình đánh giá cộng đồng nào được kích hoạt.

### 3.3 Đánh giá từ Cộng đồng

1. Một mẫu đầu ra được phân tầng (≥30 mục, bao gồm các mức độ khó từ 2–5) được trình bày cho những người nói song ngữ
2. Ít nhất 2 người đánh giá độc lập sẽ xếp hạng cho mỗi mục
3. Thang điểm đánh giá: **loại bỏ (reject)** / **hiểu ý chính (gist)** / **chấp nhận được (acceptable)** / **xuất sắc (excellent)**
4. Nếu ≥70% số mục nhận được đánh giá "chấp nhận được" hoặc "xuất sắc" từ cả hai người đánh giá, bước xác thực cộng đồng sẽ được thông qua

### 3.4 Giải ngân

Thứ tự là cố định: **các bước cổng đã công bố được xác minh → cuộc thi kết thúc → giải thưởng được chi trả.** Đó là những bước nào sẽ tùy thuộc vào các điều khoản mà cuộc thi *này* đã công bố (§2.1, điều kiện 7) — nhưng dù là bước nào, chúng đều được xác minh trước khi đóng cuộc thi, và không có khoản tiền nào được chi trả từ một bảng xếp hạng vẫn đang biến động.

Nhà tổ chức có thể `close --force` bỏ qua một cổng chưa được đáp ứng. Việc kết thúc sau đó vẫn diễn ra và bảng xếp hạng bị đóng băng sẽ ghi lại tính đủ điều kiện nhận giải của bài dự thi đó chính xác như đã tính toán — không đủ điều kiện, kèm theo tên bước không đạt. Một cuộc kết thúc cưỡng bức chỉ là một cuộc thi đã kết thúc, chứ không bao giờ là một cổng đã được thông qua.

1. Cả 7 điều kiện đều được đáp ứng
2. **Mọi bước cổng mà các điều khoản giải thưởng đã công bố của cuộc thi yêu cầu đều được xác minh** — luôn luôn bao gồm việc bàn giao artifact đã được chấm điểm, cộng với một bản phát hành đã được ghi nhận và/hoặc một bản chuyển nhượng đã được ghi nhận khi các điều khoản đó yêu cầu
3. Cuộc thi được **kết thúc** và bảng xếp hạng của nó bị đóng băng
4. Tổ chức quản trị xác nhận kết quả đối chiếu với bảng xếp hạng bị đóng băng
5. Tiền thưởng được chi trả trong vòng 30 ngày kể từ ngày xác nhận
6. Bất kỳ điều gì mà các điều khoản đã công bố quy định về quyền sở hữu sẽ có hiệu lực theo đúng các điều khoản đó — đối với cuộc thi có `rights` là `participant_retains_all`, hoàn toàn không có gì bị chuyển giao
7. Kết quả được công bố trên bảng xếp hạng với hạng xác thực "Được cộng đồng xác thực" (Community Validated)

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

| Hạng | Số tiền | Ngưỡng đề xuất |
|------|--------|---------------------|
| **Seed** | 5.000$–15.000$ | Mức chuẩn chrF++ trên tập niêm phong, được công bố trước khi cuộc thi mở + xác thực cộng đồng |
| **Breakthrough** | 25.000$–50.000$ | Mức chuẩn chrF++ cao hơn + xác thực cộng đồng |
| **Grand Prize** | 100.000$+ | Các điều kiện Breakthrough + độ bao phủ đa phong cách ngôn ngữ (multi-register) + tích hợp triển khai |

Mức chuẩn luôn là chrF++ (kèm theo chữ ký của nó, để có thể tái lập); các cổng chẩn đoán như mức chấp nhận FST có thể được thêm vào, dưới dạng các cổng kiểm soát. Điểm tổng hợp hoặc phân hạng chất lượng không thể dùng làm ngưỡng giải thưởng.

Nhà tài trợ cũng có thể tài trợ cho:
- **Tiền thưởng cải tiến (Improvement bounties)** — khoản chi trả cố định cho mỗi 5 điểm chrF++ cải thiện so với mức tốt nhất hiện tại
- **Giải thưởng phong cách ngôn ngữ (Register prizes)** — các giải thưởng riêng biệt cho các phong cách ngôn ngữ cụ thể (trang trọng, nghi lễ, giáo dục)
- **Giải thưởng chi phí (Cost prizes)** — chi phí thấp nhất cho mỗi bài dự thi trong số các phương pháp vượt qua mức chuẩn chrF++ (chi phí được báo cáo bên cạnh điểm số, không bao giờ kết hợp với điểm số)

### 4.2 Nơi Nắm giữ Tiền Quỹ Giải thưởng

Tiền quỹ giải thưởng được **nắm giữ bởi nhà tài trợ**: chúng nằm ở tổ chức tài trợ hoặc ở một quỹ tín thác cộng đồng do nhà tài trợ chỉ định — **không bao giờ ở Champollion**, bên chỉ điều phối việc đo lường và không chạm vào tiền. Một giải thưởng uy tín sẽ công bố trước khi mở giải: **ai là người nắm giữ tiền quỹ**, theo thỏa thuận nào (tài khoản tổ chức, quỹ tín thác hoặc ký quỹ bên thứ ba do nhà tài trợ chọn) và ngưỡng trao giải — để việc vượt qua ngưỡng có thể được xác minh từ điểm số được công bố cộng với phán quyết xác thực từ người bản xứ của cộng đồng, và việc quỵt thanh toán sẽ bị công khai rõ ràng. Hiện tại không có quỹ giải thưởng nào được nắm giữ ở bất kỳ đâu. Nếu một giải thưởng hết hạn mà không có người nhận, tiền quỹ vẫn ở nguyên nơi cũ — với nhà tài trợ — để được chuyển hướng hoặc rút về theo quyết định của nhà tài trợ. Cơ chế tự phục vụ, bao gồm rủi ro quỵt tiền của nhà tài trợ và các biện pháp giảm thiểu, được tài liệu hóa trong [Chạy một Cuộc thi Chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) và [Mẫu Điều khoản](/docs/network/sovereignty/terms-templates).

---

## 5. Bị loại

Một bài nộp sẽ bị loại nếu:

1. **Huấn luyện trên dữ liệu đánh giá.** Phương pháp đã tiếp xúc với các mục ngữ liệu `gold_standard` hoặc `held_out`. (Được ngăn chặn về mặt kiến trúc nhờ việc thực thi trong hộp cát — nhưng nếu phát hiện bằng chứng về sự nhiễm bẩn dữ liệu, kết quả sẽ bị hủy bỏ.)
2. **Không thể tái lập.** Tổ chức quản trị không thể tái lập điểm số trong phạm vi ±2%.
3. **Phụ thuộc không khai báo hoặc không hợp lệ.** Phương pháp yêu cầu quyền truy cập lúc chạy (runtime) tới các dịch vụ bên ngoài vượt quá những gì manifest phụ thuộc khai báo, hoặc lớp phụ thuộc thực tế của nó là A2 hoặc X (§1.6). Suy luận LLM Lớp A1 đã khai báo được định tuyến qua cổng đánh giá (evaluation gateway) được cho phép; bất kỳ sự phụ thuộc mạng nào khác lúc chạy — và bất kỳ sự phụ thuộc chưa khai báo nào thuộc bất kỳ lớp nào — đều dẫn đến việc bị loại.
4. **Chưa ký điều khoản tham gia.** Tất cả các thành viên trong nhóm phải đồng ý với các điều khoản nộp phương pháp, và — khi cuộc thi công bố các điều khoản giải thưởng (§1.3) — với các điều khoản đó, thông qua mã băm.
5. **Phát hiện gian lận/thao túng chỉ số.** Đầu ra được tối ưu hóa cho chỉ số thay vì chất lượng dịch thuật (bị phát hiện qua đánh giá cộng đồng và/hoặc các bước kiểm tra chống gian lận theo BENCHMARK_SPEC §9.3).

---

## 6. Mối quan hệ với các Đặc tả khác

| Tài liệu này | Tham chiếu | Mục đích |
|--------------|-----------|-----|
| §2 điều kiện ngưỡng | SCORING_SPEC "How runs are scored" và §2.1–2.2 (chỉ số) | Định nghĩa và thang đo chỉ số |
| §2 xác thực cộng đồng | BENCHMARK_SPEC §7 | Quy trình đánh giá bởi con người |
| §3 thực thi hộp cát | BENCHMARK_SPEC §8.2 | Cơ chế chủ quyền |
| §1.3 điều khoản giải thưởng đã công bố | BENCHMARK_SPEC §8.3 | Host có thể làm gì với bài dự thi sau đó |
| §1.6 các lớp phụ thuộc | Quy cách Giao diện Phương pháp; BENCHMARK_SPEC §8.6 | Định nghĩa lớp, điều khoản chấp nhận, chính sách mạng hộp cát |
| §4 giải thưởng chi phí | SCORING_SPEC §6.2 | Công thức chỉ số chi phí |

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
1. Giao diện bảng xếp hạng phải hiển thị các giải thưởng đang hoạt động và các điều kiện ngưỡng của chúng
2. Các run card đáp ứng các ngưỡng tự động (điều kiện 2–3) phải được gắn cờ để cộng đồng đánh giá
3. Không sử dụng phân hạng chất lượng: trường `quality_tier` có giá trị null trên mọi run card mới (tiêu chuẩn tính điểm/1)
4. Lớp **điều khoản** giải thưởng đã được tích hợp sẵn (`contest_prize_terms` — công bố, mã băm, chấp thuận và cổng chi trả), và bản thân việc tính điểm không thay đổi. Những gì một quỹ giải thưởng mới bổ sung là chính sách ngưỡng trong §2 và việc hiển thị trên bảng xếp hạng ở các mục 1–2 ở trên

---

*Cơ cấu giải thưởng phải tương thích với các điều khoản giải thưởng mà chính cuộc thi đó công bố (§1.3). Các điều khoản đó là sự lựa chọn của host trên mọi phương diện — từ "chấm điểm, xóa bỏ, mọi quyền thuộc về người dự thi" cho đến "bạn bàn giao, chúng tôi chấm điểm và giữ lại bất kể kết quả ra sao" — và chúng được công bố, băm và chấp thuận trước khi bất kỳ ai tham gia. Một host cộng đồng muốn một phương pháp chiến thắng trở thành tài sản của cộng đồng có thể tuyên bố chính xác điều đó, và giải thưởng khi ấy sẽ tài trợ cho việc tạo ra công nghệ thuộc về cộng đồng ngôn ngữ. Không có điều gì ở đây tự ý giả định thay cho bất kỳ host nào.*
