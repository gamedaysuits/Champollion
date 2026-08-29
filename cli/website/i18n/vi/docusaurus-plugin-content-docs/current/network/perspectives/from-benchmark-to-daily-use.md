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
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Từ Benchmark đến Sử dụng Hàng ngày: Lộ trình Hậu hiệu đính (Post-Editing)

> **Tóm tắt nhanh.** Điểm số trên bảng xếp hạng (leaderboard) không phải là một sản phẩm. Lộ trình từ "phương pháp này đạt điểm 0.78" đến "văn phòng cộng đồng xuất bản tài liệu bằng ngôn ngữ bản địa hàng tuần" chỉ đi qua duy nhất một quy trình: máy móc tạo ra bản nháp, một người nói lưu loát sửa lại bản nháp đó, và chỉ có văn bản đã sửa đổi mới được xuất bản. Mọi ngưỡng chất lượng trong thông số kỹ thuật của chúng tôi đều được hiệu chuẩn theo quy trình đó — chứ không phải cho đầu ra máy dịch không có sự giám sát, điều mà chúng tôi không ủng hộ cho bất kỳ ngôn ngữ nào trên nền tảng này.

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

## Ý nghĩa của các phân hạng chất lượng trong thực tế

Bảng xếp hạng chấm điểm các phương pháp dựa trên sự kết hợp của các chỉ số tự động ([Thông số chấm điểm](/docs/network/specifications/scoring)), và các điểm số này tương ứng với các phân hạng (tier) được đặt tên. Dưới đây là ý nghĩa thực tế của các phân hạng đó trong việc sử dụng hàng ngày:

| Phân hạng (tổng hợp) | Ý nghĩa đối với lộ trình hậu hiệu đính |
|---|---|
| **Cơ bản (Baseline)** (0.00–0.30) | Không thể sử dụng cho bất kỳ việc gì. Đầu ra phần lớn không phải là ngôn ngữ đích. Chỉ hữu ích làm mốc cơ sở nghiên cứu. |
| **Mới nổi (Emerging)** (0.30–0.50) | Vẫn chưa thể làm công cụ soạn thảo. Các đoạn dịch đúng có xuất hiện, nhưng người nói bản ngữ sẽ mất nhiều thời gian để sửa hơn là tự viết mới. |
| **Khả dụng (Functional)** (0.50–0.70) | Phân hạng đầu tiên mà việc hậu hiệu đính *có thể* nhanh hơn dịch từ đầu đối với các văn bản dễ — đáng để thử nghiệm với người nói bản ngữ, nhưng chưa đáng để phụ thuộc vào. Vẫn còn nhiều lỗi hình thái học thường xuyên. |
| **Có thể triển khai (Deployable)** (0.70–0.85) | Phân hạng mục tiêu cho quy trình làm việc ở trên: các bản nháp có hầu hết hình thái học chính xác và người nói lưu loát có thể sửa đổi nhanh hơn đáng kể so với việc dịch lại. **"Có thể triển khai" nghĩa là có thể triển khai *vào một quy trình hậu hiệu đính* — tuyệt đối không phải là "xuất bản không cần kiểm duyệt."** |
| **Lưu loát (Fluent)** (0.85–1.00) | Tiếp cận mức độ dịch thuật của con người có năng lực; lỗi hiếm gặp và nhỏ. Bước kiểm duyệt vẫn được giữ lại — chỉ là nó sẽ nhanh hơn. |

Hai quy tắc trung thực về mặt cấu trúc được đặt lên trên bảng này, lấy trực tiếp từ [Thông số Benchmark §5 và §7](/docs/network/specifications/benchmark#5-quality-tiers):

- **Các phân hạng tự động là nhãn tạm thời, không phải phán quyết.** Chúng là các đề cử để con người đánh giá lại. Các ngưỡng sẽ được hiệu chuẩn lại khi dữ liệu xác thực từ người nói bản ngữ được tích lũy, và chúng có thể khác nhau đối với các ngôn ngữ khác nhau.
- **Không phương pháp nào có thể tuyên bố đạt mức Có thể triển khai trở lên nếu không có sự đánh giá của cộng đồng.** Một mẫu phân tầng từ đầu ra của phương pháp sẽ được gửi đến những người nói song ngữ, họ sẽ đánh giá từng bản dịch theo các mức *từ chối / hiểu ý chính / chấp nhận được / xuất sắc*. Tổ chức quản trị — chứ không phải bảng xếp hạng — sẽ quyết định phương pháp đó có được thăng hạng hay không.

Để so sánh, ngưỡng [Giải thưởng của Nhà sáng lập](/docs/network/specifications/prizes) (điểm tổng hợp ≥ 0.80, ≥99% từ hợp lệ về mặt hình thái, ≥70% được người nói bản ngữ đánh giá từ mức chấp nhận được trở lên) mô tả một phương pháp mà các lỗi còn lại là *lỗi ngôn ngữ thực tế* — chia sai biến hình từ, chứ không phải là các từ tự bịa ra. Đó là hình ảnh của "một bản nháp xứng đáng với thời gian của người nói bản ngữ" được thể hiện qua các con số.

## Từ một phương pháp chiến thắng đến một văn phòng hoạt động hiệu quả

Giả sử một phương pháp vượt qua các rào cản đó. Các bước còn lại thuộc về mặt tổ chức, và chúng được quy định rõ ràng chứ không phải tự phát:

1. **Chuyển giao quyền sở hữu.** Mã nguồn của phương pháp trở thành tài sản của tổ chức quản trị cộng đồng — nhà phát triển vẫn giữ quyền ghi công và quyền công bố ([Chuyển giao Quyền sở hữu](/docs/network/sovereignty/ownership-transfer)).
2. **Phương pháp trở thành một dịch vụ — dịch vụ của cộng đồng.** Nó được đóng gói dưới dạng một plugin mà tổ chức quản trị có thể chạy trên cơ sở hạ tầng của riêng họ, kiểm soát quyền truy cập và các mục đích sử dụng được phép ([Triển khai lên Production](/docs/network/getting-started/deploy-to-production)). Nếu cộng đồng chọn cung cấp nó một cách thương mại, đó hoàn toàn là việc kinh doanh của họ — Champollion không lấy bất kỳ phần chia nào ([Cách dự án được tài trợ](/docs/network/sovereignty/economic-model)).
3. **Các dịch giả tích hợp nó vào công việc hàng ngày.** Một văn phòng dịch thuật kết nối quy trình tài liệu hiện tại của họ với API của phương pháp: văn bản nguồn đi vào, bản nháp đi ra, hậu hiệu đính, xuất bản. Văn bản được xuất bản mang tên tuổi và uy tín của dịch giả — máy móc chỉ là một công cụ trên bàn làm việc của họ, giống như một cuốn từ điển.

## Tình trạng hiện tại

Nói một cách rõ ràng: toàn bộ lộ trình đã được quy định chi tiết từ đầu đến cuối, và đã được xây dựng một phần. Hệ thống đánh giá, các chỉ số, thẻ chạy (run cards) và bảng xếp hạng công khai đã tồn tại; kho ngữ liệu phát triển tiếng Plains Cree và một giải thưởng đang hoạt động đã tồn tại; nền tảng triển khai đã tồn tại. Giao diện đánh giá của cộng đồng, môi trường thử nghiệm (sandbox) đánh giá và vòng phản hồi văn bản đã sửa đổi đã được quy định chi tiết nhưng chưa đi vào hoạt động — các thông số kỹ thuật đánh dấu chúng là kế hoạch, và chúng tôi cũng vậy. Chưa có phương pháp nào hoàn thành toàn bộ hành trình từ benchmark đến việc sử dụng hàng ngày trong cộng đồng. Hành trình đó là định nghĩa về thành công của dự án, đó chính là lý do tại sao chúng tôi sẽ không tuyên bố thành công quá sớm.

---

## Điều này có ý nghĩa gì đối với bạn

:::info[Nếu bạn là thành viên cộng đồng]
Huy hiệu "Deployable" trên bảng xếp hạng không bao giờ có nghĩa là máy móc sẽ xuất bản bằng ngôn ngữ của bạn mà không có sự giám sát — nó có nghĩa là một công cụ tạo bản dịch nháp có thể đã sẵn sàng để *thử nghiệm* trước các dịch giả của bạn, theo các điều khoản của bạn, với những người nói ngôn ngữ đó đóng vai trò là giám khảo (những người được trả phí — xem [Cách người nói ngôn ngữ được trả phí](/docs/network/perspectives/how-speakers-get-paid)). Nếu cộng đồng của bạn vận hành một văn phòng dịch thuật, câu hỏi thực tế cần đặt ra cho chúng tôi là: "một dự án thử nghiệm sẽ trông như thế nào, và ai sẽ là người đánh giá kết quả đầu ra?"
:::

:::info[Nếu bạn là nhà nghiên cứu]
Cách tiếp cận hậu biên tập thay đổi những gì đáng để đo lường: thời gian để đạt được văn bản chấp nhận được với sự tham gia của người nói ngôn ngữ, chứ không chỉ là điểm số tổng hợp. Các chỉ số của Network là đại diện cho điều đó ([Scoring Specification §1](/docs/network/specifications/scoring)), và các nghiên cứu hậu biên tập theo từng ngôn ngữ đối với các ngôn ngữ có cấu trúc hình thái phức tạp là một khoảng trống nghiên cứu còn bỏ ngỏ mà cơ sở hạ tầng này được thiết kế để hỗ trợ.
:::

:::info[Nếu bạn là nhà phát triển]
Hãy tối ưu hóa cho người biên tập, chứ không phải cho chỉ số. Một phương pháp tạo ra các từ có thật với các biến hình đôi khi bị sai có thể được người nói ngôn ngữ sửa lại trong vài giây; một phương pháp tạo ra các dạng từ ảo giác trông có vẻ hợp lý sẽ làm hỏng toàn bộ quy trình làm việc — đó là lý do tại sao tính hợp lệ về mặt hình thái được kiểm soát rất nghiêm ngặt ở đây. Hãy bắt đầu tại [Gửi một Phương pháp](/docs/network/getting-started/submit-a-method), và đọc [Giao diện Phương pháp](/docs/network/specifications/methods) để biết những gì bạn sẽ bàn giao nếu giành chiến thắng.
:::

## Xem thêm

- [Dịch thuật không phải là Hồi sinh Ngôn ngữ](/docs/network/perspectives/translation-is-not-revitalization) — tại sao rào cản con người là điểm mấu chốt, chứ không phải là một hạn chế
- [Báo cáo Lỗi và Làm chủ Bản sửa lỗi](/docs/network/perspectives/reporting-errors-and-owning-corrections) — điều gì xảy ra khi văn bản được xuất bản vẫn bị sai
- [Thông số Benchmark §7](/docs/network/specifications/benchmark#7-human-validation) — rào cản xác thực bởi con người, một cách chính thức
