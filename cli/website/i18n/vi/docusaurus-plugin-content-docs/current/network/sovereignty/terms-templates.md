---
sidebar_position: 10
title: "Mẫu điều khoản"
slug: /network/sovereignty/terms-templates
description: "Các ý tưởng điều khoản linh hoạt, hướng tới mô hình phi tín nhiệm (trustless) dành cho cộng đồng đang vận hành một cuộc thi độc lập — bao gồm quyền sở hữu, cấp phép chỉ tính điểm (scores-only), tính toàn vẹn được ghim bằng mã băm (hash-pinned), mặc định đóng khi thất bại (fail-closed) và một góc nhìn trung thực về các rủi ro mã độc Trojan."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Mẫu Điều khoản (Terms Templates)

> **Tóm tắt dành cho người điều hành.** Các điều khoản điểm xuất phát mà một cộng đồng hoặc tổ chức có thể
> điều chỉnh khi tổ chức một [cuộc thi tự chủ (sovereign contest)](/docs/network/sovereignty/run-a-sovereign-contest).
> Định hướng thiết kế xuyên suốt là **thiên về phi tín nhiệm (trustless-leaning)**: bất cứ khi nào có thể, một
> điều khoản đều được hỗ trợ bởi một cơ chế (mã băm, cổng kiểm soát, nhật ký chỉ ghi thêm) thay vì
> một lời hứa. Mỗi điều khoản gồm một đoạn văn ngắn kèm theo phần giải thích bằng ngôn ngữ bình dân, dễ hiểu.

:::warning[Đây không phải là lời khuyên pháp lý]
Đây là những *ý tưởng* soạn thảo từ một dự án nghiên cứu phi thương mại, không phải là lời khuyên pháp lý, và chúng tôi không phải là luật sư. Luật pháp khác nhau tùy theo khu vực tài phán, và các khuôn khổ chủ quyền dữ liệu của người bản địa áp đặt các nghĩa vụ mà không biểu mẫu nào có thể tự đáp ứng được. Hãy để cố vấn pháp lý của riêng bạn — và quy trình quản trị cộng đồng của riêng bạn — xem xét mọi thứ trước khi bạn áp dụng chúng.
:::

---

## Các điều khoản cốt lõi

### 1. Kho ngữ liệu là và vẫn là tài sản của chủ sở hữu

*Điều khoản.* Kho ngữ liệu đánh giá, tất cả các mục nhập trong đó và tất cả siêu dữ liệu phái sinh
vẫn là tài sản duy nhất của cộng đồng/tổ chức đăng ký. Không có việc sử dụng cơ chế đăng ký, cuộc thi hoặc đánh giá nào của Mạng lưới chuyển giao bất kỳ
quyền, quyền sở hữu hoặc lợi ích nào trong kho ngữ liệu cho nền tảng, cho các nhà phát triển phương pháp,
hoặc cho bất kỳ nhà tài trợ nào. Nền tảng không lưu giữ bản sao và không yêu cầu giấy phép nào ngoài
bản tóm tắt (digest) của khối dữ liệu được mã hóa (encrypted blob).

*Giải thích dễ hiểu:* việc chạy một cuộc thi dựa trên kho ngữ liệu của bạn không cấp cho ai bất kỳ phần nào trong đó. Champollion chỉ giữ một mã băm (hash), chứ không giữ quyền sở hữu.

### 2. Việc đánh giá chỉ cấp giấy phép hiển thị điểm số — không có gì khác

*Điều khoản.* Một lượt chạy đánh giá được ủy quyền sẽ cấp cho nền tảng và nhà phát triển phương pháp
giấy phép để nhận và công bố **chỉ các điểm số bằng số và số liệu thống kê tổng hợp**. Nó **không** cấp
quyền giữ lại nội dung kho ngữ liệu sau lượt chạy, **không** có quyền huấn luyện, tinh chỉnh (fine-tune) hoặc hướng dẫn bất kỳ mô hình nào trên đó, và **không** có quyền xây dựng các kho ngữ liệu phái sinh, các ví dụ ghi nhớ hoặc bảng tra cứu từ đó. Bất kỳ việc lưu giữ nội dung nào vượt quá lượt chạy sẽ chấm dứt giấy phép và làm mất hiệu lực kết quả của lượt chạy đó.

*Giải thích dễ hiểu:* những gì thu được từ một lượt chạy khép kín chỉ là một con số. Các câu văn sẽ không bao giờ bị lộ ra ngoài — không đưa vào bảng xếp hạng, không đưa vào tập dữ liệu huấn luyện, và không nằm trong bộ nhớ đệm của bất kỳ ai.

### 3. Tính toàn vẹn được ghim bằng mã băm: bản tóm tắt được công bố, nội dung thì không bao giờ

*Điều khoản.* Kho ngữ liệu được xác định duy nhất bằng bản tóm tắt SHA-256 được công bố của
khối dữ liệu được mã hóa và một nhãn phiên bản. Chỉ các khối dữ liệu khớp với bản tóm tắt mới được tính là
kho ngữ liệu; mọi lượt chạy đối với các byte không khớp đều vô hiệu. Việc công bố bản tóm tắt không phải là công bố nội dung, và không có điều khoản nào trong các điều khoản này bắt buộc chủ sở hữu phải tiết lộ nội dung cho bất kỳ ai.

*Giải thích dễ hiểu:* mọi người đều có thể kiểm tra kho ngữ liệu *nào* đã được sử dụng; nhưng không ai có quyền *đọc* nó. Nếu các byte không khớp với mã băm, lượt chạy đó không được tính.

### 4. Mặc định đóng khi thất bại (Fail-closed)

*Điều khoản.* Mọi sự mơ hồ đều được giải quyết theo hướng không truy cập và không công bố. Một yêu cầu
không được ủy quyền rõ ràng bởi ngưỡng người giám hộ (custodian threshold) sẽ bị từ chối; một quyền hạn
đã hết hạn hoặc đã được sử dụng sẽ bị hủy bỏ; một kết quả không thể xác minh nguồn gốc sẽ không được công bố; một kho ngữ liệu hết hạn đăng ký sẽ ngừng hoạt động. Sự im lặng không bao giờ cấu thành sự đồng ý.

*Giải thích dễ hiểu:* khi nghi ngờ, câu trả lời là không. Không có gì tự động chuyển sang trạng thái mở theo mặc định.

### 5. Sự ủy quyền của người giám hộ kiểm soát mọi lượt chạy

*Điều khoản.* Không có đánh giá nào được phép thực thi đối với kho ngữ liệu khép kín mà không có sự ủy quyền được ghi nhận, được phê duyệt theo ngưỡng và một quyền hạn sử dụng một lần, có giới hạn thời gian được liên kết với phương pháp cụ thể, phiên bản kho ngữ liệu và môi trường đánh giá. Tất cả
các sự kiện ủy quyền, bao gồm cả các lần từ chối và các nỗ lực bị chặn, đều được ghi lại trong một nhật ký kiểm toán chỉ ghi thêm (append-only), có thể phát lại công khai.

*Giải thích dễ hiểu:* những người giám hộ của bạn phê duyệt từng lượt chạy một, và toàn bộ lịch sử đều được công khai và không thể bị giả mạo. (Công cụ ký theo ngưỡng mật mã vẫn đang được phát triển — xem [hộp trạng thái trong tài liệu hướng dẫn chạy](/docs/network/sovereignty/run-a-sovereign-contest) — vì vậy hiện tại điều khoản này được thực thi như một quy trình được ghi nhận, chưa phải bằng toán học.)

### 6. Quỹ giải thưởng do nhà tài trợ nắm giữ và quy tắc trao giải là công khai

*Điều khoản.* Quỹ giải thưởng do tổ chức tài trợ được chỉ tên hoặc một quỹ tín thác cộng đồng được chỉ định nắm giữ — không bao giờ do nền tảng nắm giữ. Ngưỡng trao giải được công bố trước khi cuộc thi bắt đầu, có thể xác minh được từ điểm số được công bố cộng với phán quyết xác thực của người bản xứ (speaker-validation) của chính cộng đồng, và quyết định trao giải chỉ thuộc về người nắm giữ quỹ.

*Giải thích dễ hiểu:* tiền nằm trong tay bên tài trợ, tiêu chuẩn được công khai, và bất kỳ ai cũng có thể kiểm tra xem tiêu chuẩn đó đã được đáp ứng hay chưa. Champollion không thể thanh toán, giữ lại hoặc chuyển hướng giải thưởng vì Champollion không bao giờ giữ tiền.

---

## Rủi ro từ "Ngựa Trojan" {#trojan-horse-risks}

Một tài liệu điều khoản trung thực sẽ chỉ ra các cách mà thỏa thuận có thể bị tấn công. Hãy đưa những điều này vào tài liệu của bạn — một nhà tài trợ hoặc cộng đồng đã đọc chúng sẽ khó bị tổn hại hơn.

### Các bài nộp phương pháp độc hại cố gắng lọc dữ liệu kiểm tra ra ngoài

Một "phương pháp" (method) là mã nguồn được gửi lên. Một mã nguồn độc hại có thể cố gắng tuồn các câu kiểm tra ra ngoài — bằng cách mã hóa chúng trong kết quả đầu ra, ghi chúng vào nhật ký hoặc gửi về máy chủ riêng.
**Biện pháp giảm thiểu:** chỉ xuất điểm số (văn bản đầu ra của từng mục từ các lượt chạy khép kín không bao giờ được công bố — hiện được thực thi ở lớp dữ liệu); một **hộp cát không có lối ra (no-egress sandbox)** để thực thi khép kín (🔲 đang phát triển — cho đến khi tính năng này được ra mắt, hãy coi biện pháp giảm thiểu này là một phần và cân nhắc kỹ phê duyệt của những người giám hộ); và **ngân sách truy vấn/lượt chạy cho mỗi phương pháp trong mỗi vòng** — một phương pháp chỉ nhận được một số lượng nhỏ lượt chạy khép kín cố định, vì vậy kho ngữ liệu không thể bị dựng lại bằng cách thăm dò lặp đi lặp lại ngay cả thông qua kênh điểm số.

### Kho ngữ liệu được gửi lên bị nhiễm độc hoặc bị ô nhiễm

Cuộc tấn công cũng có thể xảy ra theo chiều ngược lại: ai đó cung cấp cho cộng đồng một kho ngữ liệu kiểm tra "có sẵn" nhưng bị sai lệch một cách tinh vi, gây phản cảm hoặc đã được công khai (vì vậy các phương pháp đã ghi nhớ nó và điểm số trở nên vô nghĩa).
**Biện pháp giảm thiểu:** yêu cầu chứng minh nguồn gốc đối với mỗi mục nhập (ai là tác giả, khi nào, từ nguồn nào); [xác thực bởi người bản xứ](/docs/network/specifications/speaker-validation) đối với chính kho ngữ liệu trước khi niêm phong; và sàng lọc ô nhiễm đối với dữ liệu công khai trước khi kho ngữ liệu được chấp nhận làm tiêu chuẩn đánh giá hoặc tiêu chuẩn vàng.

### Trojan giấy phép trong các thư viện phụ thuộc (dependencies)

Một phương pháp chiến thắng nhưng lại âm thầm đi kèm với nội dung hoặc mã nguồn có giấy phép cấm mục đích sử dụng của cộng đồng (triển khai thương mại, phân phối lại) sẽ làm hỏng quá trình chuyển giao — bạn thắng được một công cụ mà bạn không thể sử dụng hợp pháp.
**Biện pháp giảm thiểu:** khai báo phân loại thư viện phụ thuộc và một cổng kiểm soát giấy phép tự động đối với các bài nộp (xem bảng phân loại thư viện phụ thuộc trong [Đặc tả giải thưởng](/docs/network/specifications/prizes)); các thư viện phụ thuộc không được khai báo sẽ bị truất quyền thi đấu.

### Tấn công giả mạo thông tin xác thực (Credential phishing)

Bất kỳ ai chạy một cuộc thi đều trở thành mục tiêu cho các cuộc tấn công kiểu "dán mã token của bạn vào đây để xác minh đăng ký". **Biện pháp giảm thiểu:** không bao giờ dán mã token, khóa hoặc thông tin xác thực vào các trang web của bên thứ ba hoặc chia sẻ chúng trong các cuộc trò chuyện; tất cả việc xác thực trong dự án này đều diễn ra thông qua luồng OAuth của CLI, và **không còn luồng mã token truy cập cá nhân trên trình duyệt nữa** — bất kỳ trang nào yêu cầu mã này đều là độc hại. Các quyết định của người giám hộ nên diễn ra qua các kênh mà cộng đồng của bạn đã tin tưởng.

### Nhà tài trợ quỵt giải thưởng

Trường hợp thất bại âm thầm: các phương pháp vượt qua tiêu chuẩn nhưng nhà tài trợ không trả tiền.
**Biện pháp giảm thiểu:** công bố danh tính của bên giữ quỹ và thỏa thuận nắm giữ (tài khoản tổ chức, quỹ tín thác, đại lý ký quỹ) *trước khi* cuộc thi bắt đầu; làm cho các điều kiện trao giải có thể xác minh được từ điểm số được công bố để việc quỵt giải thưởng hiển thị rõ ràng trước công chúng như một sự thất hứa, chứ không thể chối cãi như một quyết định chủ quan; và ưu tiên chọn bên giữ quỹ có uy tín để mất mát. Champollion không thể bảo lãnh cho rủi ro này — theo thiết kế, nó không bao giờ giữ tiền — vì vậy uy tín của giải thưởng chính là uy tín của bên nắm giữ quỹ được chỉ tên.

---

## Cách sử dụng các mẫu này

Sao chép những gì phù hợp, xóa những gì không phù hợp, thêm những gì quy trình quản trị của bạn yêu cầu, và công bố kết quả cùng với cuộc thi của bạn để những người tham gia đồng ý với các điều khoản của *bạn*, chứ không phải dựa trên cảm tính. Các điều khoản riêng của từng cộng đồng — bao gồm cả việc chuyển nhượng quyền sở hữu phương pháp cho các giải thưởng được tài trợ — là điều bình thường ở đây, không phải là ngoại lệ: xem [Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer).

