---
sidebar_position: 3
title: "Từ thử nghiệm hiệu năng đến sử dụng thực tế: Quy trình hậu hiệu đính"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Cách một phương pháp dịch thuật được thử nghiệm hiệu năng trở thành quy trình dịch thuật của cộng đồng: bản nháp máy, hậu hiệu đính bởi người bản xứ thông thạo, văn bản được xuất bản — với các ngưỡng chất lượng trung thực ở mỗi bước."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Từ Benchmark đến Sử dụng Hàng ngày: Lộ trình Hậu hiệu đính (Post-Editing)

> **Tóm tắt ngắn gọn.** Điểm số trên bảng xếp hạng (leaderboard) không phải là một sản phẩm hoàn chỉnh. Con đường từ "phương pháp này đạt điểm chrF++ 47,5" đến "văn phòng cộng đồng xuất bản tài liệu bằng ngôn ngữ này hàng tuần" chỉ đi qua duy nhất một quy trình làm việc: máy móc tạo bản nháp, một người nói thông thạo hiệu đính nó, và chỉ có văn bản đã được chỉnh sửa mới được xuất bản. Mọi ngưỡng chất lượng trong thông số kỹ thuật của chúng tôi đều được hiệu chỉnh theo quy trình đó — chứ không dành cho đầu ra tự động không có sự giám sát của máy móc, điều mà chúng tôi không xác nhận đối với bất kỳ ngôn ngữ nào trên nền tảng này.

Mọi người đôi khi hỏi khi nào một phương pháp dịch thuật sẽ "đủ tốt để chỉ việc sử dụng". Đối với các ngôn ngữ mà Mạng lưới này phục vụ, câu hỏi đó ẩn chứa một cái bẫy. Câu trả lời thành thực là mục tiêu đáng hướng tới không phải là "đủ tốt để xuất bản mà không cần kiểm duyệt" — mà là **"đủ tốt để việc hiệu đính một bản nháp hiệu quả hơn là dịch lại từ đầu."** Ngưỡng đó thấp hơn nhiều, có thể đo lường được, và việc vượt qua nó sẽ thay đổi hoàn toàn năng suất hàng tuần của một văn phòng dịch thuật cộng đồng.

---

## Quy trình làm việc, từ đầu đến cuối

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Ba điều cần lưu ý:

1. **Máy móc không bao giờ tự xuất bản.** Đơn vị đầu ra là một bản nháp. Bước hiệu đính của người nói bản ngữ không phải là khâu đảm bảo chất lượng được thêm vào ở cuối — đó chính là quy trình làm việc.
2. **Thời gian của người nói bản ngữ là tài nguyên được tối ưu hóa.** Một phương pháp tốt hơn một phương pháp khác chính xác ở chỗ nó giúp người nói ít phải sửa lỗi hơn. Nghiên cứu về hậu hiệu đính (post-editing) đối với các ngôn ngữ có nguồn tài nguyên dồi dào liên tục chỉ ra rằng phương pháp này nhanh hơn dịch từ đầu ở mức chất lượng dịch máy (MT) trung bình (Plitt & Masselot 2010; Green, Heer & Manning 2013, cả hai đều được trích dẫn kèm liên kết trong [Dịch thuật không phải là Hồi sinh Ngôn ngữ](/docs/network/perspectives/translation-is-not-revitalization)). Liệu điều đó có đúng với các ngôn ngữ đa tổng hợp (polysynthetic) hay không chính là điều mà benchmark tồn tại để tìm câu trả lời — chúng tôi coi đó là một giả thuyết cần xác minh cho từng ngôn ngữ, chứ không phải là một giả định.
3. **Vòng phản hồi được làm chủ.** Mỗi tài liệu được sửa đổi là dữ liệu huấn luyện và hướng dẫn tiềm năng — và nó thuộc về cộng đồng, để phản hồi ngược lại (hoặc không) theo các điều khoản của họ dưới các quy tắc [chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty). Cơ chế phản hồi là một mục tiêu thiết kế của nền tảng, hiện chưa phải là một tính năng hoàn thiện; xem [Báo cáo Lỗi và Làm chủ Bản sửa lỗi](/docs/network/perspectives/reporting-errors-and-owning-corrections) để biết cách thức hoạt động dự kiến của các bản sửa lỗi và nguồn gốc dữ liệu.

## Điểm số trên bảng xếp hạng có thể và không thể cho bạn biết điều gì

Bảng xếp hạng xếp hạng các phương pháp theo cách mà lĩnh vực MT (dịch máy) thực hiện: bằng **chrF++** ở cấp độ ngữ liệu (0–100) kèm theo khoảng tin cậy 95% và chữ ký sacreBLEU, cùng với BLEU, spBLEU, TER và COMET bên cạnh và các chẩn đoán như tỷ lệ chấp nhận FST được báo cáo riêng ([Quy cách chấm điểm](/docs/network/specifications/scoring#how-runs-are-scored)). Việc một phương pháp có tốt hơn phương pháp khác trên cùng một tập đánh giá hay không được quyết định bởi kiểm định ý nghĩa thống kê theo cặp (paired significance test), chứ không phải bằng cách nhìn ước lượng hai con số ([Kiểm định ý nghĩa thống kê](/docs/network/specifications/significance)).

Điều đó cho cộng đồng biết: phương pháp nào tạo ra kết quả gần hơn với các bản dịch tham chiếu đáng tin cậy, và liệu khoảng cách giữa hai phương pháp có thực sự tồn tại hay không. Điều nó không thể cho bạn biết: liệu một bản nháp có đáng để người bản ngữ bỏ thời gian ra xem xét hay không. Cùng một con số chrF++ lại mang ý nghĩa khác nhau đối với các ngôn ngữ và tập đánh giá khác nhau, vì vậy không có điểm số tự động nào ở đây mang nhãn chất lượng. Mạng lưới trước đây từng ánh xạ một điểm tổng hợp có trọng số vào các bậc được đặt tên ("chức năng", "có thể triển khai",…); những nhãn đó đã bị loại bỏ, một phần vì một hệ thống lặp lại một câu hợp lệ duy nhất cho mọi đầu vào từng được dán nhãn "chức năng" ([tại sao điểm tổng hợp bị loại bỏ](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Hai nguyên tắc trung thực về mặt cấu trúc sau đây được rút ra từ [Quy cách chuẩn đối sánh §7](/docs/network/specifications/benchmark#7-human-validation):

- **Điểm số là một sự đề cử cho việc đánh giá của con người, không phải là một phán quyết.** Điểm chrF++ cao khiến một phương pháp đáng để thử nghiệm với người bản ngữ; nó không đồng nghĩa với việc phương pháp đó đã sẵn sàng.
- **Chỉ có đánh giá từ cộng đồng mới xác định được một phương pháp đã sẵn sàng cho quy trình hậu biên tập (post-editing).** Một mẫu phân tầng từ đầu ra của nó được gửi đến những người nói song ngữ, những người này sẽ đánh giá từng bản dịch theo mức *từ chối / nắm ý chính / chấp nhận được / xuất sắc*. Tổ chức quản trị — chứ không phải bảng xếp hạng — sẽ quyết định liệu phương pháp đó có được tiến xa hơn hay không.

Để so sánh, các điều kiện của [Giải thưởng của Nhà sáng lập](/docs/network/specifications/prizes) (mức sàn chrF++, rào cản ≥99% từ hợp lệ về mặt hình thái học, ≥70% được người nói đánh giá từ chấp nhận được trở lên) mô tả một phương pháp mà các lỗi còn lại là *lỗi ngôn ngữ thực tế* — sai biến hình từ, chứ không phải từ ngữ bịa đặt. Đó là hình ảnh của "một bản nháp đáng để người nói bỏ thời gian" được thể hiện qua các con số, và phán quyết của người nói là điều kiện định đoạt điều đó.

## Từ một phương pháp chiến thắng đến một văn phòng hoạt động hiệu quả

Giả sử một phương pháp vượt qua các rào cản đó. Các bước còn lại thuộc về mặt tổ chức, và chúng được quy định rõ ràng chứ không phải tự phát:

1. **Chuyển giao quyền sở hữu.** Mã nguồn của phương pháp trở thành tài sản của tổ chức quản trị cộng đồng — nhà phát triển vẫn giữ quyền ghi công và quyền công bố ([Chuyển giao Quyền sở hữu](/docs/network/sovereignty/ownership-transfer)).
2. **Phương pháp trở thành một dịch vụ — dịch vụ của cộng đồng.** Nó được đóng gói dưới dạng một plugin mà tổ chức quản trị có thể chạy trên cơ sở hạ tầng của riêng họ, kiểm soát quyền truy cập và các mục đích sử dụng được phép ([Triển khai lên Production](/docs/network/getting-started/deploy-to-production)). Nếu cộng đồng chọn cung cấp nó một cách thương mại, đó hoàn toàn là việc kinh doanh của họ — Champollion không lấy bất kỳ phần chia nào ([Cách dự án được tài trợ](/docs/network/sovereignty/economic-model)).
3. **Các dịch giả tích hợp nó vào công việc hàng ngày.** Một văn phòng dịch thuật kết nối quy trình tài liệu hiện tại của họ với API của phương pháp: văn bản nguồn đi vào, bản nháp đi ra, hậu hiệu đính, xuất bản. Văn bản được xuất bản mang tên tuổi và uy tín của dịch giả — máy móc chỉ là một công cụ trên bàn làm việc của họ, giống như một cuốn từ điển.

## Tình trạng hiện tại

Nói một cách rõ ràng: toàn bộ lộ trình đã được đặc tả từ đầu đến cuối, và đã được xây dựng một phần. Khung đánh giá (evaluation harness), các chỉ số, thẻ lượt chạy (run cards) và bảng xếp hạng công khai đã có sẵn; môi trường thử nghiệm đánh giá (evaluation sandbox) đã được xây dựng nhưng mới chỉ được thử nghiệm với một phương pháp mô hình đơn giản; ngữ liệu phát triển tiếng Plains Cree đã có ở thượng nguồn; một giải thưởng đã được đề xuất, nhưng chưa có giải nào mở; nền tảng triển khai đã sẵn sàng. Giao diện đánh giá cộng đồng và vòng lặp phản hồi văn bản đã hiệu đính đã được đặc tả nhưng chưa đi vào hoạt động — các thông số kỹ thuật đánh dấu chúng là đang lên kế hoạch, và chúng tôi cũng vậy. Chưa có phương pháp nào hoàn thành toàn bộ hành trình từ chuẩn đối sánh đến việc sử dụng hàng ngày trong cộng đồng. Hành trình đó chính là định nghĩa về thành công của dự án, và đó chính xác là lý do tại sao chúng tôi sẽ không tuyên bố điều đó quá sớm.

---

## Điều này có ý nghĩa gì đối với bạn

:::info[Nếu bạn là thành viên cộng đồng]
Điểm số cao trên bảng xếp hạng không bao giờ có nghĩa là máy móc sẽ tự động xuất bản bằng ngôn ngữ của bạn mà không có sự giám sát — nó có nghĩa là một công cụ tạo bản nháp có thể đã sẵn sàng để *thử giọng* trước các dịch giả của bạn, theo các điều kiện của bạn, với người nói ngôn ngữ của bạn làm giám khảo (được trả thù lao — xem [Cách người nói nhận thù lao](/docs/network/perspectives/how-speakers-get-paid)). Nếu cộng đồng của bạn vận hành một văn phòng dịch thuật, câu hỏi thích hợp để đưa ra cho chúng tôi là: "một đợt thử nghiệm sẽ trông như thế nào, và ai sẽ đánh giá đầu ra?"
:::

:::info[Nếu bạn là nhà nghiên cứu]
Khuôn khổ hậu biên tập thay đổi những gì đáng đo lường: thời gian để đạt được văn bản chấp nhận được khi có người nói tham gia vào quy trình, chứ không chỉ riêng chrF++. Các chỉ số của Mạng lưới là đại diện cho điều đó ([Quy cách chấm điểm §1](/docs/network/specifications/scoring)), và các nghiên cứu hậu biên tập theo từng ngôn ngữ cho các ngôn ngữ có cấu trúc hình thái phức tạp là một khoảng trống nghiên cứu mở mà cơ sở hạ tầng này được thiết kế để hỗ trợ.
:::

:::info[Nếu bạn là nhà phát triển]
Hãy tối ưu hóa cho người biên tập, chứ không phải cho chỉ số. Một phương pháp tạo ra các từ có thật với các biến hình đôi khi bị sai có thể được người nói ngôn ngữ sửa lại trong vài giây; một phương pháp tạo ra các dạng từ ảo giác trông có vẻ hợp lý sẽ làm hỏng toàn bộ quy trình làm việc — đó là lý do tại sao tính hợp lệ về mặt hình thái được kiểm soát rất nghiêm ngặt ở đây. Hãy bắt đầu tại [Gửi một Phương pháp](/docs/network/getting-started/submit-a-method), và đọc [Giao diện Phương pháp](/docs/network/specifications/methods) để biết những gì bạn sẽ bàn giao nếu giành chiến thắng.
:::

## Xem thêm

- [Dịch thuật không phải là Hồi sinh Ngôn ngữ](/docs/network/perspectives/translation-is-not-revitalization) — tại sao rào cản con người là điểm mấu chốt, chứ không phải là một hạn chế
- [Báo cáo Lỗi và Làm chủ Bản sửa lỗi](/docs/network/perspectives/reporting-errors-and-owning-corrections) — điều gì xảy ra khi văn bản được xuất bản vẫn bị sai
- [Thông số Benchmark §7](/docs/network/specifications/benchmark#7-human-validation) — rào cản xác thực bởi con người, một cách chính thức
