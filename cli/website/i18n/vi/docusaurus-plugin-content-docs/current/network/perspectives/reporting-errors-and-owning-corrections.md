---
sidebar_position: 4
title: "Báo cáo lỗi và quyền sở hữu các bản sửa lỗi"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Cách người nói báo cáo thông tin sai lệch hoặc bản dịch không chính xác, ai quyết định bước xử lý tiếp theo, cách các bản sửa lỗi lưu lại thông tin nguồn gốc, và tại sao các cộng đồng nắm giữ quyền phủ quyết đối với dữ liệu ngôn ngữ của chính họ."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Báo cáo lỗi và Quyền sở hữu bản sửa lỗi

> **Lập trường.** Việc mắc sai sót là điều không thể tránh khỏi đối với một nền tảng công bố các dữ kiện và đánh giá về nhiều ngôn ngữ. Điều *không* thể là điều tất nhiên là việc ai được tin tưởng khi một lỗi được báo cáo, và ai sở hữu bản chỉnh sửa đó. Câu trả lời của chúng tôi: báo cáo của một người nói thông thạo có giá trị cao hơn quy trình tự động hóa của chúng tôi, mỗi bản chỉnh sửa đều mang theo nguồn gốc ghi rõ ai đã thay đổi điều gì và vì sao, và một cộng đồng có thể rút lại hoặc phủ quyết việc sử dụng dữ liệu ngôn ngữ của mình — không phải như một cử chỉ lịch sự, mà như một đặc tính được thực thi bởi kiến trúc hệ thống.

Hầu hết các nền tảng dữ liệu đều coi các báo cáo lỗi như các yêu cầu hỗ trợ (support ticket): người dùng phàn nàn, người duy trì quyết định, và bản ghi thay đổi một cách âm thầm. Đối với dữ liệu ngôn ngữ bản địa, mô hình đó hoàn toàn bị đảo ngược. Người báo cáo lỗi thường có thẩm quyền cao hơn nền tảng — một người bản xứ nói với chúng tôi rằng một từ bị sai không phải là một "người dùng", họ chính là thực tế khách quan (ground truth) đang sửa lại một đại diện (proxy). Thiết kế dưới đây xuất phát từ việc nghiêm túc thực hiện nguyên tắc đó.

---

## Hai loại lỗi, một nguyên tắc

Nền tảng công bố hai loại khẳng định có thể bị sai:

1. **Dữ kiện về một ngôn ngữ** — các thẻ ngôn ngữ thúc đẩy việc đánh giá: dữ liệu phân loại, chính tả, đặc điểm ngôn ngữ học, những chỉ số nào được áp dụng. Một thẻ có thể đưa ra ước tính sai về số người nói, mối quan hệ sai lệch giữa các phương ngữ, hoặc trạng thái sai của hệ thống chữ viết.
2. **Đánh giá về bản dịch** — một bản dịch tham chiếu trong kho ngữ liệu mà người nói ngôn ngữ đó cho là sai hoặc không tự nhiên; một chỉ số tự động từ chối một từ hợp lệ hoặc chấp nhận một từ không hợp lệ; điểm số tự động cao đối với kết quả đầu ra mà người nói sẽ không chấp nhận.

Nguyên tắc bao trùm cả hai, vốn đã mang tính ràng buộc trong [Scoring Specification](/docs/network/specifications/scoring) và [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation): **kết quả tự động là các đại diện (proxy); người bản xứ là thực tế khách quan (ground truth).** Cam kết được công bố trong [Speaker Validation Protocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) đã nêu rõ ràng: nếu một người nói rằng linter sai về một điều gì đó, chúng tôi sẽ sửa linter.

## Hành trình của một báo cáo

Dưới đây là lộ trình mà một báo cáo sẽ trải qua, cùng với các trạng thái thực tế — một số phần hiện đã hoạt động, một số phần đã được lên đặc tả kỹ thuật nhưng chưa được xây dựng.

**Báo cáo bản dịch kém hoặc đánh giá chỉ số không chuẩn (hiện đang vận hành, qua kênh trực tiếp).** Một người nói ngôn ngữ khi thấy bản dịch tham chiếu bị sai, một từ bị từ chối oan, hoặc một phương án "tương đương" không thể chấp nhận được có thể báo cáo điều đó qua trình theo dõi vấn đề của kho lưu trữ công khai của dự án hoặc bằng cách liên hệ trực tiếp với dự án. Phiên bản có cấu trúc của quy trình này — các màn hình đánh giá với các tùy chọn *từ chối / nắm ý / chấp nhận được / xuất sắc* cùng ghi chú tự do — là giao diện đánh giá cộng đồng, vốn được quy định trong [Đặc tả Benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation) nhưng chưa được đưa vào vận hành. Cho đến lúc đó, các báo cáo được xử lý trực tiếp giữa người với người, và bản thân các tác vụ xác thực (đánh giá có trả phí, có cấu trúc từ người nói — xem [Làm việc với người nói](/docs/working-with-speakers)) là kênh chỉnh sửa chính.

**Báo cáo dữ kiện sai trên thẻ ngôn ngữ (đang hoạt động, cùng các kênh trên).** Việc sửa lỗi trên thẻ cũng tuân theo cùng một lộ trình: báo cáo, xem xét, thay đổi có phiên bản. Bởi vì các thẻ điều hướng hành vi đánh giá — chỉ số nào được tải, mô hình nào được đề xuất — việc sửa lỗi trên thẻ có thể thay đổi điểm số, do đó các sửa đổi được áp dụng dưới dạng các thay đổi dữ liệu được ghi nhận, không bao giờ là các chỉnh sửa âm thầm.

**Điều gì xảy ra tiếp theo — ai quyết định:**

- **Quyền phán quyết về mặt ngôn ngữ thuộc về những người nói ngôn ngữ đó.** Liệu một dạng thức có hợp lệ hay không, liệu hai cách diễn đạt có tương đương hay không, liệu văn phong có phù hợp hay không — nền tảng sẽ thực thi câu trả lời; nền tảng không tự đưa ra câu trả lời đó. Khi những người nói không đồng thuận (phương ngữ, quy ước chính tả), câu trả lời được ghi nhận dưới dạng biến thể, chứ không phải do chúng tôi phân xử — lược đồ kho ngữ liệu và linter hỗ trợ việc gắn thẻ các biến thể phương ngữ như những lựa chọn thay thế có thể chấp nhận được thay vì ép buộc một biến thể duy nhất thắng cuộc.
- **Các quyết định về dữ liệu của một cộng đồng thuộc về tổ chức quản trị của cộng đồng đó.** Đối với các ngôn ngữ có tổ chức quản trị, việc thay đổi kho ngữ liệu đánh giá, chấp nhận các bản chỉnh sửa vào các tập kiểm thử niêm phong, và các hệ quả khi triển khai đều phải thông qua họ — đó là quyền kiểm soát dữ liệu ngôn ngữ của cộng đồng — xem [Lời nói của bạn, quy tắc của bạn](/docs/your-words-your-rules) — được triển khai như một quy trình, không phải một tấm áp phích.
- **Các lỗi kỹ thuật đơn thuần chỉ việc sửa chữa.** Một lỗi chính tả, một liên kết hỏng, một trường bị phân tích sai — được báo cáo, sửa chữa, và ghi nhật ký. Không phải điều gì cũng cần đến một hội đồng.

## Các bản sửa lỗi mang theo nguồn gốc

Một bản sửa lỗi mà bạn không thể truy vết nguồn gốc thì chỉ là một ý kiến mới hơn. Ba quy tắc về nguồn gốc được áp dụng cho mọi dữ kiện và mọi bản sửa lỗi:

1. **Mọi dữ kiện đều ghi rõ nguồn.** Thẻ ngôn ngữ và các mục kho ngữ liệu ghi lại xuất xứ của từng giá trị — một tập dữ liệu đã công bố, một đóng góp từ cộng đồng, hay một đánh giá từ người nói.
2. **Các giá trị phái sinh được dán nhãn là của chúng tôi, không phải của nguồn thượng nguồn.** Khi nền tảng tính toán một giá trị nào đó — một phép tổng hợp, một phép mã hóa lại, một chỉ số kết hợp — giá trị đó được ghi nhận là một dẫn xuất của nền tảng *từ* nguồn thượng nguồn, không bao giờ được ghi dưới danh nghĩa của nguồn thượng nguồn. Một tập dữ liệu thượng nguồn không bao giờ phải chịu trách nhiệm, hay được ghi công, cho một con số mà chính nó không công bố.
3. **Các bản chỉnh sửa trở thành một phần của hồ sơ lưu trữ.** Bản chỉnh sửa của người nói được ghi lại như một khẳng định mới, có ghi nhận nguồn gốc (công khai danh tính hoặc ẩn danh, tùy theo lựa chọn của người nói — cùng điều khoản như công việc xác thực) thay thế cho giá trị cũ; lịch sử của những gì đã thay đổi vẫn có thể kiểm toán được. Các phiên bản kho ngữ liệu được lập bản kê bằng mã băm ([Đăng ký kho ngữ liệu](/docs/network/sovereignty/registering-corpora)), do đó một kho ngữ liệu đã chỉnh sửa sẽ là một phiên bản mới rõ ràng, và mỗi thẻ lượt chạy đều ghi nhận chính xác phiên bản mà nó được chấm điểm dựa trên — điểm số cũ vẫn giữ nguyên khả năng diễn giải, điểm số mới phản ánh bản sửa đổi.

## Quyền phủ quyết, một cách cụ thể

"Quyền kiểm soát của cộng đồng" là điều dễ dàng tuyên bố. Dưới đây là cách điều đó được hiện thực hóa trong kiến trúc đã công bố:

- **Người nói có thể rút lại đóng góp của mình.** Người nói có thể rút lại các đánh giá của họ bất kỳ lúc nào, và việc rút lại sẽ loại bỏ chúng khỏi mọi phân tích ([Xác thực bởi người nói §5](/docs/network/specifications/speaker-validation#5-data-governance)). Người nói cũng nắm quyền phủ quyết đối với việc công bố các kết quả mà họ thấy có vấn đề.
- **Cộng đồng có thể dừng việc đánh giá hoàn toàn.** Các tập kiểm thử niêm phong được mã hóa, và Champollion không giữ bất kỳ phần khóa nào, do đó chỉ riêng nền tảng thì không bao giờ có thể khôi phục lại chúng. Hiện nay, các khóa của tập niêm phong do ban tổ chức nắm giữ — người giám hộ khóa của cộng đồng: hiện chưa có ai được chỉ định. Một khi những người giám hộ do cộng đồng chỉ định nắm giữ các phần khóa của một tập dữ liệu, họ có thể dừng việc đánh giá bằng cách từ chối tham gia vào quá trình khôi phục khóa ([Đăng ký kho ngữ liệu](/docs/network/sovereignty/registering-corpora)). Câu hỏi "Nếu chúng tôi muốn dừng lại thì sao?" đã có câu trả lời rõ ràng: dữ liệu niêm phong không bao giờ bị lộ, và quá trình đánh giá sẽ chấm dứt.
- **Không điểm số nào có thể ghi đè quyết định của cộng đồng.** Một vị trí trên bảng xếp hạng không trao quyền cho bất kỳ ai triển khai một phương pháp cho ngôn ngữ của một cộng đồng ([Chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer)) — và một cộng đồng quyết định hoàn toàn không nên triển khai MT cho ngôn ngữ của họ là đang thực thi hệ thống đúng như thiết kế, chứ không phải đang phá vỡ nó (xem [Dịch thuật không phải là Hồi sinh ngôn ngữ](/docs/network/perspectives/translation-is-not-revitalization)).

## Những gì chúng tôi chưa xây dựng

Theo đúng tinh thần của phần còn lại trong mục tài liệu này: giao diện đánh giá cộng đồng hiện mới nằm trong kế hoạch, chưa hoạt động chính thức. Chưa có tổ chức quản trị nào được thành lập cho bất kỳ ngôn ngữ hiện tại nào — chưa có người giám hộ cộng đồng nào được chỉ định cho bất kỳ benchmark nào, bao gồm cả tiếng Plains Cree, và chúng tôi không công khai tên của những người giám hộ trước khi họ đồng thuận. Cho đến khi các phần này sẵn sàng, các hiệu đính sẽ được xử lý qua các kênh trực tiếp, có thể quy trách nhiệm, và các tài liệu đặc tả đã công bố — chứ không phải trang này — vẫn là mô tả có tính ràng buộc về quy trình. Trong trường hợp trang này và tài liệu đặc tả có sự mâu thuẫn, đặc tả sẽ có giá trị quyết định, và chúng tôi cũng coi sự mâu thuẫn đó là một lỗi đáng để báo cáo.

---

## Điều này có ý nghĩa gì đối với bạn

:::info[Nếu bạn là thành viên cộng đồng]
Nếu có điều gì đó về ngôn ngữ của bạn trên nền tảng này chưa chính xác — một dữ kiện, một bản dịch, một nhãn dán — báo cáo của bạn là lời chứng thực từ thực tế chuẩn xác, chứ không phải một khiếu nại chờ phân loại xử lý. Bạn quyết định xem bản chỉnh sửa của mình có được ghi nhận đích danh hay không; đóng góp của bạn có thể được rút lại sau đó; và cộng đồng của bạn có thể dừng hoàn toàn việc sử dụng dữ liệu của mình. Hãy bắt đầu tại [Lời nói của bạn, quy tắc của bạn](/docs/your-words-your-rules), hoặc chỉ cần mở một vấn đề trên kho lưu trữ công khai.
:::

:::info[Nếu bạn là nhà nghiên cứu]
Các bản sửa lỗi ở đây là dữ liệu có nguồn gốc rõ ràng, không phải là các chỉnh sửa âm thầm: các phiên bản ngữ liệu được băm (hash), các thẻ chạy (run card) ghim chính xác phiên bản mà chúng được chấm điểm đối chiếu, và các giá trị phái sinh được gắn nhãn là phái sinh. Nếu bạn xây dựng dựa trên điểm số hoặc ngữ liệu của Network, hãy trích dẫn phiên bản — và hãy coi làn sóng sửa lỗi do người bản xứ dẫn dắt là một phát hiện về tính hợp lệ của chỉ số đo lường, bởi vì bản chất của nó chính là như vậy.
:::

:::info[Nếu bạn là nhà phát triển]
Điểm số phương pháp của bạn có thể thay đổi một cách hợp lệ mà không cần mã nguồn của bạn thay đổi — một từ bị từ chối sai được đưa vào danh sách cho phép (allowlist), một bản dịch tham chiếu được sửa lại, một lớp biến thể được khắc phục. Hãy thiết kế để thích ứng với điều đó: ghim các phiên bản ngữ liệu trong thẻ chạy của bạn ([Thông số kỹ thuật Run Card](/docs/network/specifications/run-card)), theo dõi nhật ký thay đổi (changelog) của tập dữ liệu, và coi các sửa lỗi từ người bản xứ là tín hiệu lỗi đáng tin cậy nhất mà bạn có thể nhận được miễn phí.
:::

## Xem thêm

- [Làm việc với người nói](/docs/working-with-speakers) — cùng quyền quyết định của người nói, ở giai đoạn đánh giá chuẩn
- [Đưa vào hoạt động](/docs/put-it-to-work) — nơi các chỉnh sửa kết nối với quy trình xuất bản
- [Từ ngữ của bạn, quy tắc của bạn](/docs/your-words-your-rules) — ai quyết định điều gì xảy ra với dữ liệu ngôn ngữ, công cụ thực thi những gì, và điều gì không một công cụ nào có thể ngăn cản
