---
sidebar_position: 2
title: "Cách thức chi trả cho Người bản xứ"
slug: '/network/perspectives/how-speakers-get-paid'
description: "Mức thù lao mà các kiểm định viên và dịch giả cộng đồng nhận được cho công việc đánh giá chuẩn (benchmark), lý do tại sao việc trả phí cho người bản xứ là điều không thể thương lượng, và cách thức mở rộng quy mô bồi thường khi Mạng lưới phát triển. Tất cả số liệu đều được lấy từ các thông số kỹ thuật đã công bố."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# Cách Người Nói Được Trả Lương

> **Lưu ý về tính minh bạch.** Mọi con số trên trang này đều đã xuất hiện trong các tài liệu đặc tả đã công bố — [Đặc tả Benchmark §10](/docs/network/specifications/benchmark#10-cost-framework), [Giao thức Xác thực Người nói](/docs/network/specifications/speaker-validation), và [Đặc tả Giải thưởng](/docs/network/specifications/prizes). Trang này tập hợp chúng lại một nơi, bằng ngôn ngữ bình dân, để không ai phải đọc tài liệu đặc tả kỹ thuật mới tìm được giá trị thời gian của người nói tại đây. Trang này không đưa ra cam kết nào vượt quá những gì các tài liệu đó đã tuyên bố.

Một người nói song ngữ, người có thể đánh giá liệu một câu do máy tạo ra có thực tế, trôi chảy và mang đúng ý nghĩa hay không, là người tham gia khan hiếm và có giá trị nhất trong toàn bộ hệ thống này. Mọi thứ khác — khung thử nghiệm, số đo đánh giá, bảng xếp hạng — tồn tại chỉ để giúp một lượng nhỏ thời gian của người đó mang lại hiệu quả lâu dài.

Vì vậy, quy tắc đầu tiên rất đơn giản: **người nói ngôn ngữ được trả thù lao cho thời gian làm việc của họ theo mức giá chuyên nghiệp, bất kể kết quả ra sao** — một khi công việc này được cấp kinh phí. Hiện tại chưa có nguồn quỹ nào được nắm giữ, do đó chưa có công việc nào với người nói ngôn ngữ đang được tiến hành.

---

## Tại sao việc trả lương cho người nói là không thể thương lượng

Nghiên cứu công nghệ ngôn ngữ có một thói quen lâu đời là xem người nói trôi chảy như một nguồn tài nguyên miễn phí — "sự tham gia của cộng đồng" tạo ra các bộ dữ liệu, bài báo và sự nghiệp cho tất cả mọi người ngoại trừ chính những người nói. Chúng tôi coi mô hình đó là mang tính bóc lột, và những người có đủ trình độ nhất để làm công việc này chính xác là những người mà thời gian của họ đã bị chiếm dụng bởi công việc khẩn cấp là giảng dạy, dịch thuật và nuôi dạy trẻ em bằng ngôn ngữ đó.

Ba hệ quả thiết kế được rút ra như sau:

1. **Không dựa vào lực lượng tình nguyện viên.** Chúng tôi không yêu cầu người nói ngôn ngữ đóng góp công việc đánh giá như một sự hỗ trợ thiện chí cho nghiên cứu. Việc tham gia là một công việc được trả thù lao, và từ chối tham gia không làm người nói ngôn ngữ chịu bất kỳ thiệt thòi nào.
2. **Thanh toán vô điều kiện.** Người nói ngôn ngữ sẽ được chi trả thù lao bất kể đánh giá của họ có được sử dụng hay không, và việc thanh toán không phụ thuộc vào kết quả. Giao thức đã công bố cam kết thanh toán trong vòng hai tuần kể từ khi hoàn thành mỗi khối tác vụ.
3. **Thù lao không phải là tất cả.** Người nói ngôn ngữ tham gia đóng góp đánh giá cũng được ghi nhận đóng góp (nêu tên hoặc ẩn danh, tùy họ lựa chọn), tùy chọn đứng tên đồng tác giả trên các ấn phẩm sử dụng đánh giá của họ, quyền rút lại đóng góp bất cứ lúc nào, và quyền phủ quyết đối với việc công bố các kết quả mà họ thấy có vấn đề. Các điều khoản này nằm trong [Giao thức Xác thực của Người nói ngôn ngữ §5–6](/docs/network/specifications/speaker-validation), chứ không phải trong một thỏa thuận phụ ngoài lề.

## Các mức phí đã công bố

Khung chi phí benchmark quy định mức bồi thường cho người nói song ngữ là **$50–65 CAD mỗi giờ** cho công việc xây dựng ngữ liệu và xác thực. Ý nghĩa của mức phí đó theo từng vai trò:

### Xây dựng ngữ liệu benchmark

Tạo ra các bản dịch tham chiếu mà mọi phương pháp đều được chấm điểm dựa vào đó là nhiệm vụ nền tảng của người nói. Ngân sách thiết lập đã công bố cho mỗi ngôn ngữ:

| Công việc | Khoảng công bố | Cơ sở |
|------|-----------------|-------|
| Biên tập ngữ liệu (50–150 mục) | $2,500–6,000 | $50–65/giờ, thời gian của người nói song ngữ |
| Đánh giá kết quả của phương pháp | $500–1,500 | Cùng mức phí theo giờ |

Một ngữ liệu đầy đủ theo truyền thống mất khoảng 80 giờ của người nói; quy trình làm việc có sự hỗ trợ của tác nhân (agent) theo kế hoạch (việc soạn thảo câu và định dạng do công cụ xử lý, việc dịch thuật luôn do con người thực hiện) được thiết kế để giảm thời gian đó xuống còn 30–40 giờ — ít giờ làm việc lặp đi lặp lại hơn, cùng mức phí theo giờ, và người nói chỉ thực hiện những phần thực sự cần đến con người.

### Xác thực các số đo đánh giá

Trước khi các điểm số tự động có bất kỳ ý nghĩa nào, người nói phải kiểm tra chúng đối chiếu với đánh giá của con người. [Giao thức Xác thực Người nói](/docs/network/specifications/speaker-validation) công bố chính xác các nhiệm vụ, số giờ và mức thù lao:

| Nhiệm vụ | Thời gian | Thù lao cho mỗi người nói |
|------|------|-----------------|
| A — Đánh giá 200 bản dịch máy về độ đầy đủ và độ trôi chảy | ~8 giờ | $400–520 CAD |
| B — Đánh giá 50 cặp dịch thuật "tương đương" | ~2 giờ | $100–130 CAD |
| C — Đánh giá 100 từ mà bộ phân tích hình thái học đã từ chối | ~1.5 giờ | $75–100 CAD |

Một người nói thực hiện cả ba nhiệm vụ sẽ cam kết khoảng 11.5 giờ trong vòng hai đến bốn tuần để nhận **$575–750 CAD**. Vòng xác thực đầy đủ với ba người nói tiêu tốn của dự án $1,475–1,920 — đây chính là điểm mấu chốt: xác thực của người nói là một hạng mục nhỏ trong dự án và không bao giờ được là nơi để "tiết kiệm" chi phí.

### Đánh giá các yêu cầu nhận giải thưởng

Không có giải thưởng nào được trao chỉ dựa trên điểm số đánh giá tự động. [Giải thưởng của Nhà sáng lập](/docs/network/specifications/prizes) được đề xuất (10.000 CAD, Tiếng Anh→Plains Cree — hiện chưa mở và chưa có nguồn kinh phí) sẽ yêu cầu ít nhất hai người nói song ngữ đánh giá độc lập một mẫu phân tầng gồm ít nhất 30 kết quả đầu ra, và từ 70% trở lên phải được đánh giá là "chấp nhận được" hoặc "xuất sắc". Đợt đánh giá đó là công việc có trả thù lao cho người nói ngôn ngữ theo cùng mức giá — và đó cũng là một cổng kiểm soát: người nói ngôn ngữ có quyền bác bỏ điều kiện nhận giải thưởng, và điều đó được thiết kế có chủ đích.

## Cách mô hình này mở rộng quy mô theo các cuộc thi

Mô hình được xây dựng để thù lao của người nói tăng lên cùng với nền tảng thay vì bị pha loãng bởi nó:

- **Mỗi ngôn ngữ mới đều bắt đầu với một cam kết xây dựng ngữ liệu có trả phí.** Chi phí thiết lập đã công bố cho mỗi ngôn ngữ ($3,350–8,500 trọn gói) phần lớn là thù lao cho người nói — đây là thành phần đơn lẻ lớn nhất, một cách có chủ ý.
- **Mỗi quỹ giải thưởng mới đều mang lại hoạt động đánh giá có trả phí riêng.** Mọi cuộc thi được tài trợ tuân theo [mẫu giải thưởng](/docs/network/specifications/prizes#4-future-prize-pools) đều mang yêu cầu xác thực cộng đồng tương tự, điều đó có nghĩa là mọi cuộc thi đều tài trợ cho công việc đánh giá của người nói đối với ngôn ngữ đó.
- **Các phương pháp do cộng đồng sở hữu vẫn là tài sản do cộng đồng tài trợ.** Một phương pháp được chuyển giao hoàn toàn thuộc về tổ chức quản trị — bất kỳ khoản thu nhập nào từ việc triển khai nó đều hoàn toàn thuộc về cộng đồng ([Cách tài trợ cho công việc](/docs/network/sovereignty/economic-model)), sẵn sàng cho việc tiếp tục đánh giá, phát triển ngữ liệu và các chương trình ngôn ngữ tùy theo ý muốn của cộng đồng. Việc phân bổ đó là quyết định của cộng đồng, không phải của chúng tôi.

## Những gì chúng tôi *chưa* hứa

Sự trung thực đòi hỏi phải vạch rõ các giới hạn:

- Các mức giá ở trên là những gì chúng tôi dự định chi trả cho công việc với tiếng Plains Cree khi có kinh phí; hiện tại chưa có công việc nào như vậy được tài trợ hay triển khai. Mức giá cho các ngôn ngữ trong tương lai sẽ được thiết lập cùng với cộng đồng đối tác và được công bố theo cùng một cách — trong các tài liệu đặc tả, trước khi công việc bắt đầu.
- Champollion là dự án phi thương mại, không tự tạo ra doanh thu và hiện đang **được tự tài trợ bởi người sáng lập** — nguồn tài trợ từ các khoản trợ cấp và nhà tài trợ là điều chúng tôi đang tìm kiếm, chứ không phải những gì chúng tôi đang có sẵn. [Cách công việc được tài trợ](/docs/network/sovereignty/economic-model) mô tả cơ chế hoạt động, không phải là một sự đảm bảo.
- "Được trả thù lao công bằng" là điều kiện cần nhưng chưa đủ. Việc trả thù lao không tự nó biến một dự án thành phi bóc lột — quyền sở hữu và quyền kiểm soát mới quyết định điều đó, đây là lý do tại sao việc chi trả thù lao nằm bên trong [mô hình quản trị](/docs/network/sovereignty/data-sovereignty) chứ không phải để thay thế nó.

---

## Điều này có ý nghĩa gì đối với bạn

:::info[Nếu bạn là thành viên cộng đồng]
Nếu bạn là người song ngữ sử dụng một ngôn ngữ chưa được hỗ trợ đầy đủ và tiếng Anh, sự đánh giá của bạn là thông tin đầu vào có giá trị nhất trong hệ thống này, và các điều khoản được công bố là: $50–65 CAD/giờ, lịch trình linh hoạt, thanh toán trong vòng hai tuần, ghi nhận đóng góp theo điều kiện của bạn, và quyền rút lại các đóng góp của mình. Không yêu cầu kỹ năng lập trình. Bắt đầu với [Dành cho các cộng đồng ngôn ngữ](/docs/network/community/for-language-communities) hoặc [Giao thức xác thực người nói §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[Nếu bạn là nhà nghiên cứu]
Hãy lập ngân sách bồi dưỡng cho người nói như một chi phí nghiên cứu ưu tiên hàng đầu — các số liệu được công bố ($1.475–1.920 cho một vòng xác thực chỉ số; $2.500–6.000 cho việc biên tập kho ngữ liệu) là rất nhỏ so với tiêu chuẩn của các khoản tài trợ và chúng chính là yếu tố giúp các điểm số tự động có cơ sở vững chắc. [Chiến lược hợp tác kho ngữ liệu](/docs/network/specifications/corpus-partnership) chỉ ra cách một khoa học thuật kết nối vào hệ thống này với công việc của người nói được tài trợ sẵn tích hợp bên trong.
:::

:::info[Nếu bạn là nhà phát triển]
Bạn được hưởng lợi từ công việc có trả phí của người nói ngay cả khi bạn không bao giờ tài trợ cho nó: các chỉ số đã được xác thực là yếu tố giúp điểm số trên bảng xếp hạng của bạn có ý nghĩa, và sự đánh giá có trả phí từ cộng đồng là yếu tố quyết định giữa phương pháp của bạn và một giải thưởng. Nếu bạn giành chiến thắng, hãy chuẩn bị tinh thần rằng người nói đã được trả tiền để xem xét kỹ lưỡng kết quả đầu ra của bạn — và hãy chuẩn bị cho việc [quyền sở hữu phương pháp của bạn sẽ được chuyển giao](/docs/network/sovereignty/ownership-transfer) cho cộng đồng sở hữu ngôn ngữ mà phương pháp đó phục vụ.
:::

## Xem thêm

- [Dịch thuật không phải là vực dậy ngôn ngữ](/docs/network/perspectives/translation-is-not-revitalization) — tại sao quyền hạn của người nói định hình mọi thứ khác
- [Báo cáo lỗi và sở hữu các bản sửa lỗi](/docs/network/perspectives/reporting-errors-and-owning-corrections) — quyền hạn của người nói sau cả quá trình benchmark
- [Đặc tả Benchmark §10](/docs/network/specifications/benchmark#10-cost-framework) — khung chi phí đầy đủ làm cơ sở cho các con số này
