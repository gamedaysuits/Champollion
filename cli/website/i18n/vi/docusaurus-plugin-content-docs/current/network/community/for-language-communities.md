---
sidebar_position: 1
title: "Dành cho các cộng đồng ngôn ngữ"
---

# Dành cho các Cộng đồng Ngôn ngữ

> **Tóm tắt dành cho quản lý.** Cộng đồng của bạn có thể sở hữu bộ kiểm thử của riêng mình — "đáp án" mà mọi phương pháp dịch thuật đều được đo lường dựa vào — và tự tổ chức cuộc thi theo các điều khoản của riêng mình mà không bao giờ phải bàn giao dữ liệu. Trang này giải thích những gì Mạng lưới (Network) yêu cầu từ các cộng đồng ngôn ngữ (bản dịch tham chiếu, đánh giá bản dịch, dữ liệu huấn luyện), những gì bạn nhận lại (công việc có trả phí theo mức giá đã công bố, quyền sở hữu mã nguồn, toàn quyền kiểm soát triển khai) và các đảm bảo về chủ quyền được đặt lên hàng đầu. Không yêu cầu kỹ năng lập trình, và không có gì ở đây yêu cầu bạn phải tin tưởng chúng tôi: các đảm bảo này mang tính cấu trúc, không phải là những lời hứa suông.

Bạn không cần phải là một lập trình viên để đóng góp cho Mạng lưới. Nếu bạn nói một ngôn ngữ bản địa hoặc ngôn ngữ ít tài nguyên, bạn là người quan trọng nhất trong hệ sinh thái này.

---

## Chủ quyền là trên hết

Trước khi chúng tôi yêu cầu bất cứ điều gì từ bạn, quy tắc nền tảng là: **dữ liệu ngôn ngữ của bạn là của bạn.** Dữ liệu ngôn ngữ là *dữ liệu sinh học (biodata)* — nó mang bản sắc và các mối quan hệ của cộng đồng bạn và không thể ẩn danh hóa một cách thực chất — vì vậy những người cung cấp dữ liệu chính là những người nắm giữ chìa khóa của nó, và của bất kỳ thứ gì được đo lường dựa trên nó. Mạng lưới được xây dựng trên [các nguyên tắc chủ quyền dữ liệu của First Nations](/docs/network/sovereignty/data-sovereignty):

- Chúng tôi không bao giờ thu thập hoặc lưu trữ dữ liệu ngôn ngữ của bạn trên máy chủ của chúng tôi
- Các phương pháp dịch thuật sử dụng kiến trúc `api` — tất cả dữ liệu huấn luyện, từ điển và quy tắc ngữ pháp đều nằm trên cơ sở hạ tầng do bạn kiểm soát
- Bạn quyết định ai có thể phát triển các phương pháp dịch thuật cho ngôn ngữ của bạn
- Điểm số trên bảng xếp hạng chứng minh một phương pháp hoạt động hiệu quả; chúng không cấp quyền triển khai phương pháp đó

:::note[Trạng thái hiện tại]
Mô hình chuyển giao quyền sở hữu được mô tả dưới đây là một **thiết kế đã được cam kết, chưa phải là một chương trình đang vận hành.** Bảng xếp hạng đã mở để nhận bài nộp và hiện chưa có lượt chạy nào được công bố, và cũng chưa có phương pháp nào được chuyển giao cho một cộng đồng. Chúng tôi mô tả cách nó được thiết kế để hoạt động để bạn có thể yêu cầu chúng tôi thực hiện đúng cam kết — chứ không phải để ám chỉ rằng nó đã đi vào hoạt động. Mối quan hệ, và quyền hạn của bạn đối với dữ liệu của mình, luôn được đặt lên hàng đầu; những thứ khác sẽ theo sau đó.
:::

---

## Sở hữu Bộ kiểm thử của riêng bạn

Vị thế mạnh mẽ nhất mà một cộng đồng có thể nắm giữ trong hệ thống này là **sở hữu chính bộ chuẩn đối sánh (benchmark)**. Bộ kiểm thử chính là đáp án: ai nắm giữ nó sẽ quyết định thế nào là "bản dịch tốt" cho ngôn ngữ đó, và mọi phương pháp — của chúng tôi, của một tập đoàn, hay của bất kỳ ai — đều được đo lường theo tiêu chuẩn của *bạn*.

- **Đăng ký là siêu dữ liệu (metadata), không phải nội dung.** Đăng ký một ngữ liệu với Mạng lưới nghĩa là xuất bản một thẻ mô tả — không bao giờ là tải ngữ liệu lên. Bạn tự chọn [phân làn tiếp cận](/docs/network/sovereignty/registering-corpora) cho nó: mở (open), có kiểm soát (gated), hoặc chủ quyền hoàn toàn (fully sovereign).
- **Các chuẩn đối sánh chủ quyền được giữ bí mật.** Trong làn chủ quyền, bộ kiểm thử không bao giờ rời khỏi cơ sở hạ tầng của cộng đồng và chúng tôi không bao giờ nhìn thấy nó. Các phương pháp được chấm điểm dựa trên bộ kiểm thử đó ngay tại phía bạn; chỉ có điểm số được gửi đi.
- **Bạn có thể tự tổ chức cuộc thi của riêng mình.** Tài liệu hướng dẫn từng bước — [Tự tổ chức Cuộc thi Chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) — sẽ hướng dẫn bạn cách tổ chức một đợt đánh giá do cộng đồng kiểm soát theo các điều khoản của riêng bạn: bộ kiểm thử của bạn, quy tắc của bạn, quyết định của bạn về việc những gì (nếu có) sẽ được công bố.

Các đảm bảo đằng sau tất cả những điều này đều được viết rõ ràng bằng văn bản, không phải ngầm hiểu: [Quản trị Dữ liệu](/docs/network/sovereignty/data-sovereignty) (quan điểm chủ quyền dữ liệu/CARE và những gì chúng tôi bị cấm thực hiện) và [Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer) (những gì xảy ra, về mặt hợp đồng, khi một phương pháp giành chiến thắng).

---

## Những gì Chúng tôi Cần từ Bạn

### Bản dịch tham chiếu

Chúng tôi cần các cặp dịch thuật được tuyển chọn để đánh giá — một bên là tiếng Anh, bên kia là ngôn ngữ của bạn. Chúng trở thành "đáp án" để chấm điểm cho mọi phương pháp dịch thuật.

Bạn có thể tạo ra những bản dịch này từ:
- **Tài liệu giáo dục** — bài tập trong sách giáo khoa, giáo án, phiếu bài tập
- **Tài liệu cộng đồng** — biên bản cuộc họp, bản tin, thông báo
- **Các cụm từ hàng ngày** — các chuỗi giao diện người dùng (UI), nhãn ứng dụng, các cách diễn đạt phổ biến
- **Nội dung văn hóa** — các câu chuyện, bài hát hoặc mô tả (với sự cho phép phù hợp)

Định dạng là JSON đơn giản:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Đánh giá bản dịch

Mọi phương pháp tuyên bố tạo ra bản dịch hoạt động được đều cần sự xác nhận của con người. Những người nói song ngữ sẽ xem xét kết quả đầu ra và cho chúng tôi biết máy tính đã dịch đúng hay chưa — và quan trọng hơn là *tại sao* nó dịch sai.

### Dữ liệu huấn luyện (Coaching data)

Các quy tắc ngữ pháp, mục từ điển, cấu trúc hình thái học — đây là những tài nguyên ngôn ngữ giúp các phương pháp dịch thuật hoạt động. Kiến thức của bạn về cách ngôn ngữ của bạn hoạt động là thứ không một mô hình AI nào có thể thay thế được.

---

## Những gì Bạn Nhận lại

### Quyền sở hữu

Khi một phương pháp dịch thuật được xây dựng cho ngôn ngữ của bạn và được xác thực trên Mạng lưới, [quyền sở hữu sẽ được chuyển giao](/docs/network/sovereignty/ownership-transfer) cho tổ chức quản trị của cộng đồng bạn. Bạn sở hữu mã nguồn, trọng số mô hình (model weights) và việc triển khai.

### Công việc có trả phí, không khai thác dữ liệu

Xây dựng ngữ liệu và đánh giá bản dịch là công việc chuyên môn, được trả lương theo [mức giá đã công bố](/docs/network/perspectives/how-speakers-get-paid) — và việc thanh toán không có nghĩa là mua đứt dữ liệu của bạn. Bạn được trả tiền cho công việc thực hiện *và* vẫn là chủ sở hữu của những gì bạn xây dựng. Champollion là một dự án nghiên cứu phi thương mại: nó không bán gì, không tính phí sử dụng và [không lấy bất kỳ phần chia nào](/docs/network/sovereignty/economic-model) từ bất kỳ khoản thu nhập nào mà cộng đồng của bạn kiếm được từ phương pháp dịch thuật mà cộng đồng sở hữu.

### Quyền kiểm soát

Tổ chức quản trị của bạn kiểm soát:
- Ai có thể truy cập phương pháp dịch thuật
- Liệu nó có thể được sử dụng cho mục đích thương mại hay không — và nếu có, thì theo các điều khoản của bạn, giữ lại toàn bộ doanh thu kiếm được
- Khi nào và làm thế nào để cập nhật nó
- Dữ liệu nào được sử dụng để phát triển thêm

---

## Cách thức Tham gia

:::tip[Điều mà người nói có thể làm ngay hôm nay]
Champollion không xây dựng hoặc lưu trữ kho ngữ liệu — dữ liệu thử nghiệm luôn được lấy từ nguồn gốc của nó. Nếu những người nói trong cộng đồng của bạn muốn đóng góp các câu *ngay bây giờ*, [Tatoeba](https://tatoeba.org) chấp nhận các đóng góp theo từng câu bằng bất kỳ ngôn ngữ nào, và các bộ sưu tập mở như [OPUS](https://opus.nlpl.eu/) sẽ tổng hợp văn bản song song mà Mạng lưới dùng để xây dựng các bộ dữ liệu chuẩn (benchmarks). Các câu được thêm vào đó có thể trở thành dữ liệu đánh giá tại đây trong lần xây dựng kho ngữ liệu tiếp theo. Một ứng dụng đóng góp trực tiếp từ người nói và trình xây dựng kho ngữ liệu là bước tiếp theo được lên kế hoạch trong lộ trình của chúng tôi.
:::

1. **Liên hệ** — Mở một issue trên [kho lưu trữ Mạng lưới (Network repository)](https://github.com/gamedaysuits/Champollion) hoặc gửi email đến [info@champollion.dev](mailto:info@champollion.dev)
2. **Mô tả ngôn ngữ của bạn** — Nó thuộc ngữ hệ nào? Có bao nhiêu người nói? Sử dụng hệ thống chữ viết nào? Có những tài nguyên máy tính nào (FST, từ điển, ngữ liệu)?
3. **Bắt đầu từ quy mô nhỏ** — Chỉ cần 50 cặp dịch thuật được tuyển chọn là đủ để tạo ra một tập dữ liệu đánh giá và mở một nhánh bảng xếp hạng mới. Công việc xây dựng ngữ liệu được [trả lương theo mức giá đã công bố](/docs/network/perspectives/how-speakers-get-paid)
4. **Giữ quyền sở hữu của bạn** — Đăng ký ngữ liệu dưới dạng siêu dữ liệu trong làn bạn chọn ([Đăng ký Ngữ liệu](/docs/network/sovereignty/registering-corpora)); nếu bạn muốn bộ kiểm thử hoàn toàn bí mật, [tài liệu hướng dẫn cuộc thi chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) là con đường dành cho bạn
5. **Kết nối chúng tôi với ban quản trị** — Ai trong cộng đồng của bạn có thẩm quyền đối với dữ liệu ngôn ngữ và công nghệ? Mô hình chủ quyền của Mạng lưới yêu cầu một đối tác quản trị

---

## Xem thêm

- [Tự tổ chức Cuộc thi Chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) — tài liệu hướng dẫn cho một đợt đánh giá do cộng đồng kiểm soát
- [Mẫu Điều khoản](/docs/network/sovereignty/terms-templates) — các điều khoản đơn giản về mặt pháp lý, hướng tới sự phi tập trung (trustless) mà cộng đồng của bạn có thể điều chỉnh, với các rủi ro kiểu "ngựa thành Troy" được giải thích rõ ràng
- [Quản trị Dữ liệu](/docs/network/sovereignty/data-sovereignty) — quan điểm và các khung làm việc (chủ quyền dữ liệu của First Nations, CARE, Te Mana Raraunga) đã định hình nên nó
- [Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer) — các điều khoản cho từng ngôn ngữ và những gì xảy ra khi một phương pháp giành chiến thắng
- [Cách Dự án được Tài trợ](/docs/network/sovereignty/economic-model) — dòng tiền di chuyển như thế nào trong một dự án phi thương mại
- [Hỗ trợ Ngôn ngữ Ít tài nguyên](/docs/network/community/low-resource-languages) — bối cảnh kỹ thuật dành cho các nhà nghiên cứu làm việc cùng với các cộng đồng

