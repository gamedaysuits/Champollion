---
sidebar_position: 4
title: "Báo cáo lỗi và quyền sở hữu các bản sửa lỗi"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Cách người nói báo cáo thông tin sai lệch hoặc bản dịch không chính xác, ai quyết định bước xử lý tiếp theo, cách các bản sửa lỗi lưu lại thông tin nguồn gốc, và tại sao các cộng đồng nắm giữ quyền phủ quyết đối với dữ liệu ngôn ngữ của chính họ."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Báo cáo lỗi và Quyền sở hữu bản sửa lỗi

> **Quan điểm.** Việc xảy ra sai sót là điều không thể tránh khỏi đối với một nền tảng công bố các dữ kiện và đánh giá về hàng ngàn ngôn ngữ. Điều *không* tất yếu là ai sẽ được tin tưởng khi một lỗi được báo cáo, và ai là người sở hữu bản sửa lỗi đó. Câu trả lời của chúng tôi: báo cáo của một người nói lưu loát có giá trị cao hơn hệ thống tự động của chúng tôi, mỗi bản sửa lỗi đều mang theo nguồn gốc (provenance) cho biết ai đã thay đổi cái gì và tại sao, và một cộng đồng có thể rút lại hoặc phủ quyết việc sử dụng dữ liệu ngôn ngữ của họ — không phải như một sự ưu ái, mà là một thuộc tính được thực thi của kiến trúc hệ thống.

Hầu hết các nền tảng dữ liệu đều coi các báo cáo lỗi như các yêu cầu hỗ trợ (support ticket): người dùng phàn nàn, người duy trì quyết định, và bản ghi thay đổi một cách âm thầm. Đối với dữ liệu ngôn ngữ bản địa, mô hình đó hoàn toàn bị đảo ngược. Người báo cáo lỗi thường có thẩm quyền cao hơn nền tảng — một người bản xứ nói với chúng tôi rằng một từ bị sai không phải là một "người dùng", họ chính là thực tế khách quan (ground truth) đang sửa lại một đại diện (proxy). Thiết kế dưới đây xuất phát từ việc nghiêm túc thực hiện nguyên tắc đó.

---

## Hai loại lỗi, một nguyên tắc

Nền tảng công bố hai loại khẳng định có thể bị sai:

1. **Các dữ kiện về một ngôn ngữ** — các thẻ ngôn ngữ (language card) điều hướng việc đánh giá: dữ liệu phân loại, chính tả, các đặc điểm ngôn ngữ học, các chỉ số nào được áp dụng. Một thẻ có thể đưa ra ước tính sai về số lượng người nói, mối quan hệ phương ngữ sai, hoặc trạng thái hệ thống chữ viết sai.
2. **Các đánh giá về bản dịch** — một bản dịch tham chiếu trong kho ngữ liệu (corpus) mà người bản xứ cho là sai hoặc không tự nhiên; một chỉ số tự động từ chối một từ hợp lệ hoặc chấp nhận một từ không hợp lệ; một huy hiệu "Có thể triển khai" (Deployable) trên kết quả đầu ra mà người bản xứ không chấp nhận.

Nguyên tắc bao trùm cả hai, vốn đã mang tính ràng buộc trong [Scoring Specification](/docs/network/specifications/scoring) và [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation): **kết quả tự động là các đại diện (proxy); người bản xứ là thực tế khách quan (ground truth).** Cam kết được công bố trong [Speaker Validation Protocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) đã nêu rõ ràng: nếu một người nói rằng linter sai về một điều gì đó, chúng tôi sẽ sửa linter.

## Hành trình của một báo cáo

Dưới đây là lộ trình mà một báo cáo sẽ trải qua, cùng với các trạng thái thực tế — một số phần hiện đã hoạt động, một số phần đã được lên đặc tả kỹ thuật nhưng chưa được xây dựng.

**Báo cáo bản dịch kém hoặc đánh giá chỉ số sai (đang hoạt động, qua kênh trực tiếp).** Một người nói phát hiện bản dịch tham chiếu sai, một từ bị từ chối oan, hoặc một từ "tương đương" không thể chấp nhận được có thể báo cáo thông qua trình theo dõi lỗi (issue tracker) trên kho lưu trữ công khai của dự án hoặc bằng cách liên hệ trực tiếp với dự án. Phiên bản có cấu trúc của quy trình này — màn hình xếp hạng với các tùy chọn *từ chối / nắm ý chính / chấp nhận được / xuất sắc* và ghi chú văn bản tự do — là giao diện đánh giá của cộng đồng, được quy định trong [Benchmark Specification §7.3](/docs/network/specifications/benchmark#7-human-validation) nhưng chưa chính thức hoạt động. Cho đến lúc đó, các báo cáo sẽ được xử lý trực tiếp giữa người với người, và bản thân các tác vụ xác thực (đánh giá có cấu trúc và có trả phí của người nói — xem [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)) là kênh sửa lỗi chính.

**Báo cáo dữ kiện sai trên thẻ ngôn ngữ (đang hoạt động, cùng các kênh trên).** Việc sửa lỗi trên thẻ cũng tuân theo cùng một lộ trình: báo cáo, xem xét, thay đổi có phiên bản. Bởi vì các thẻ điều hướng hành vi đánh giá — chỉ số nào được tải, mô hình nào được đề xuất — việc sửa lỗi trên thẻ có thể thay đổi điểm số, do đó các sửa đổi được áp dụng dưới dạng các thay đổi dữ liệu được ghi nhận, không bao giờ là các chỉnh sửa âm thầm.

**Điều gì xảy ra tiếp theo — ai quyết định:**

- **Quyết định về mặt ngôn ngữ học thuộc về người nói ngôn ngữ đó.** Liệu một dạng từ có hợp lệ hay không, hai cách diễn đạt có tương đương hay không, một văn phong có phù hợp hay không — nền tảng chỉ thực thi câu trả lời; chứ không tự đưa ra câu trả lời. Khi những người nói không đồng ý với nhau (về phương ngữ, quy ước chính tả), câu trả lời sẽ được ghi nhận dưới dạng biến thể, chứ không phải do chúng tôi phân xử — cấu trúc (schema) của kho ngữ liệu và linter hỗ trợ gắn thẻ các biến thể phương ngữ như các lựa chọn thay thế được chấp nhận thay vì bắt buộc chọn một phương án duy nhất.
- **Quyết định về dữ liệu của một cộng đồng thuộc về tổ chức quản trị của cộng đồng đó.** Đối với các ngôn ngữ có tổ chức quản trị, các thay đổi đối với kho ngữ liệu đánh giá, việc chấp nhận các sửa đổi vào các bộ kiểm thử được niêm phong (sealed test sets), và các hệ quả triển khai đều phải thông qua họ — đó là nguyên tắc Kiểm soát (Control) trong [chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) được triển khai dưới dạng quy trình thực tế, chứ không phải khẩu hiệu trên áp phích.
- **Các lỗi kỹ thuật thuần túy sẽ được sửa trực tiếp.** Lỗi chính tả, liên kết hỏng, trường dữ liệu bị phân tích sai — được báo cáo, sửa chữa và ghi nhật ký. Không phải mọi thứ đều cần đến một hội đồng.

## Các bản sửa lỗi mang theo nguồn gốc

Một bản sửa lỗi mà bạn không thể truy vết nguồn gốc thì chỉ là một ý kiến mới hơn. Ba quy tắc về nguồn gốc được áp dụng cho mọi dữ kiện và mọi bản sửa lỗi:

1. **Mọi dữ kiện đều phải nêu rõ nguồn.** Các thẻ ngôn ngữ và các mục trong kho ngữ liệu ghi lại nguồn gốc của từng giá trị — một tập dữ liệu đã công bố, một đóng góp từ cộng đồng, hoặc đánh giá của một người nói.
2. **Các giá trị phái sinh được gắn nhãn là của chúng tôi, không phải của nguồn thượng nguồn (upstream).** Khi nền tảng tính toán một thứ gì đó — một giá trị tổng hợp, một mã hóa lại, một chỉ số hỗn hợp — nó sẽ được ghi nhận là một phái sinh của nền tảng *từ* nguồn thượng nguồn, không bao giờ được ghi dưới tên của nguồn thượng nguồn đó. Một tập dữ liệu thượng nguồn không bao giờ phải chịu trách nhiệm, hoặc được ghi nhận công lao, cho một con số mà họ không hề công bố.
3. **Các bản sửa lỗi trở thành một phần của hồ sơ.** Bản sửa lỗi của người nói được ghi nhận là một khẳng định mới, có ghi nhận nguồn đóng góp (nêu tên hoặc ẩn danh, tùy theo lựa chọn của người nói — cùng các điều khoản như công việc xác thực) thay thế cho giá trị cũ; lịch sử thay đổi vẫn có thể kiểm toán được. Các phiên bản kho ngữ liệu được xác thực bằng mã băm (hash-manifested) ([Corpus Partnership §4.4](/docs/network/specifications/corpus-partnership)), vì vậy một kho ngữ liệu đã sửa đổi rõ ràng là một phiên bản mới, và mỗi thẻ chạy (run card) đều ghi lại chính xác phiên bản nào đã được dùng để chấm điểm — các điểm số cũ vẫn có thể giải thích được, các điểm số mới phản ánh đúng bản sửa lỗi.

## Quyền phủ quyết, một cách cụ thể

"Quyền kiểm soát của cộng đồng" là điều dễ dàng tuyên bố. Dưới đây là cách điều đó được hiện thực hóa trong kiến trúc đã công bố:

- **Người nói có thể rút lại các đóng góp của họ.** Một người nói có thể rút lại các đánh giá của họ bất kỳ lúc nào, và việc rút lại này sẽ xóa chúng khỏi tất cả các phân tích ([Speaker Validation §5](/docs/network/specifications/speaker-validation#5-data-governance)). Người nói cũng nắm quyền phủ quyết đối với việc công bố các kết quả mà họ thấy có vấn đề.
- **Các cộng đồng có thể dừng hoàn toàn việc đánh giá.** Các bộ kiểm thử được niêm phong được mã hóa, với các khóa được lưu giữ sao cho riêng nền tảng không bao giờ có thể tự khôi phục lại chúng; một cộng đồng có thể thu hồi quyền truy cập đánh giá bằng cách từ chối tham gia vào việc khôi phục khóa ([Corpus Partnership §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). Câu hỏi "Nếu chúng tôi muốn dừng lại thì sao?" đã có câu trả lời rõ ràng trong đặc tả: dữ liệu được niêm phong không bao giờ bị lộ, và việc đánh giá sẽ kết thúc.
- **Không có điểm số nào có thể ghi đè quyết định của cộng đồng.** Một phương pháp đứng đầu bảng xếp hạng vẫn chỉ được triển khai nếu tổ chức quản trị cho phép ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)) — và một cộng đồng quyết định hoàn toàn không triển khai dịch máy (MT) cho ngôn ngữ của họ là đang vận hành hệ thống đúng như thiết kế, chứ không phải đang phá vỡ nó (xem [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)).

## Những gì chúng tôi chưa xây dựng

Theo tinh thần của phần còn lại trong tài liệu này: giao diện đánh giá của cộng đồng mới chỉ nằm trong kế hoạch, chưa hoạt động thực tế. Chưa có tổ chức quản trị nào được thành lập cho bất kỳ ngôn ngữ hiện tại nào — quyền giám hộ cộng đồng đối với điểm chuẩn Plains Cree đang trong quá trình xác nhận, và chúng tôi không công khai tên của những người giám hộ trước khi họ đồng ý. Cho đến khi các mảnh ghép đó tồn tại, các sửa đổi sẽ được thực hiện thông qua các kênh trực tiếp, có thể truy xuất nguồn gốc, và các đặc tả kỹ thuật đã công bố — chứ không phải trang này — vẫn là mô tả mang tính ràng buộc của quy trình. Nếu trang này và một đặc tả kỹ thuật có điểm không thống nhất, đặc tả kỹ thuật sẽ được ưu tiên, và chúng tôi cũng coi sự không thống nhất đó là một lỗi đáng để báo cáo.

---

## Điều này có ý nghĩa gì đối với bạn

:::info[Nếu bạn là thành viên cộng đồng]
Nếu có điều gì đó về ngôn ngữ của bạn trên nền tảng này bị sai — một sự thật, một bản dịch, một nhãn dán — báo cáo của bạn là minh chứng từ thực tế khách quan, chứ không phải là một khiếu nại cần được phân loại xử lý. Bạn quyết định xem bản sửa lỗi của mình có được ghi nhận bằng tên hay không; đóng góp của bạn có thể được rút lại sau đó; và cộng đồng của bạn có thể dừng hoàn toàn việc sử dụng dữ liệu của mình. Bắt đầu tại [Dành cho các cộng đồng ngôn ngữ](/docs/network/community/for-language-communities), hoặc chỉ cần mở một issue trên kho lưu trữ công khai.
:::

:::info[Nếu bạn là nhà nghiên cứu]
Các bản sửa lỗi ở đây là dữ liệu có nguồn gốc rõ ràng, không phải là các chỉnh sửa âm thầm: các phiên bản ngữ liệu được băm (hash), các thẻ chạy (run card) ghim chính xác phiên bản mà chúng được chấm điểm đối chiếu, và các giá trị phái sinh được gắn nhãn là phái sinh. Nếu bạn xây dựng dựa trên điểm số hoặc ngữ liệu của Network, hãy trích dẫn phiên bản — và hãy coi làn sóng sửa lỗi do người bản xứ dẫn dắt là một phát hiện về tính hợp lệ của chỉ số đo lường, bởi vì bản chất của nó chính là như vậy.
:::

:::info[Nếu bạn là nhà phát triển]
Điểm số phương pháp của bạn có thể thay đổi một cách hợp lệ mà không cần mã nguồn của bạn thay đổi — một từ bị từ chối sai được đưa vào danh sách cho phép (allowlist), một bản dịch tham chiếu được sửa lại, một lớp biến thể được khắc phục. Hãy thiết kế để thích ứng với điều đó: ghim các phiên bản ngữ liệu trong thẻ chạy của bạn ([Thông số kỹ thuật Run Card](/docs/network/specifications/run-card)), theo dõi nhật ký thay đổi (changelog) của tập dữ liệu, và coi các sửa lỗi từ người bản xứ là tín hiệu lỗi đáng tin cậy nhất mà bạn có thể nhận được miễn phí.
:::

## Xem thêm

- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — cùng một thẩm quyền của người nói, ở giai đoạn điểm chuẩn
- [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use) — nơi các bản sửa lỗi gặp gỡ quy trình xuất bản
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — chủ quyền dữ liệu của First Nations, CARE, và Te Mana Raraunga, các nguyên tắc đằng sau thiết kế này
