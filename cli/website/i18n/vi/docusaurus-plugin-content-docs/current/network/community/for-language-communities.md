---
sidebar_position: 1
title: "Dành cho các cộng đồng ngôn ngữ"
---

# Dành cho các Cộng đồng Ngôn ngữ

> **Tóm tắt tổng quan.** Cộng đồng của bạn có thể sở hữu tập kiểm thử riêng của mình — "đáp án mẫu" để mọi phương pháp dịch thuật được đo lường đối chiếu — và tự tổ chức cuộc thi theo các điều kiện của riêng mình mà không bao giờ phải bàn giao dữ liệu. Trang này giải thích những gì Network yêu cầu từ các cộng đồng ngôn ngữ (bản dịch tham chiếu, duyệt bản dịch, dữ liệu hướng dẫn), những gì bạn nhận lại (công việc được chi trả theo mức giá công bố khi có kinh phí — hiện tại chưa có nguồn quỹ nào được giữ — cùng quyền sở hữu mã nguồn và toàn quyền kiểm soát triển khai), cũng như các biện pháp bảo vệ chủ quyền được đặt lên hàng đầu. Không yêu cầu kỹ năng lập trình. Một số biện pháp bảo vệ được tích hợp sẵn trong phần mềm và cơ sở dữ liệu; những biện pháp khác vẫn đang là cam kết, và trang [Những hạn chế trung thực](/docs/network/honest-limitations) sẽ nêu rõ biện pháp nào thuộc nhóm nào.

Bạn không cần phải là một lập trình viên để đóng góp cho Mạng lưới. Nếu bạn nói một ngôn ngữ bản địa hoặc ngôn ngữ ít tài nguyên, bạn là người quan trọng nhất trong hệ sinh thái này.

---

## Chủ quyền là trên hết

Trước khi chúng tôi yêu cầu bất cứ điều gì từ bạn, đây là nguyên tắc cơ bản: **dữ liệu ngôn ngữ của bạn là của bạn.** Dữ liệu ngôn ngữ là *dữ liệu sinh học* — nó mang bản sắc và các mối quan hệ của cộng đồng bạn và không thể ẩn danh hóa một cách có ý nghĩa — vì vậy những người cung cấp dữ liệu nắm giữ chìa khóa đối với nó và đối với bất kỳ thứ gì được đo lường dựa trên nó. Network được xây dựng dựa trên [các nguyên tắc về chủ quyền dữ liệu của người bản địa](/docs/network/sovereignty/data-sovereignty):

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

Các cam đoan đằng sau tất cả những điều này được ghi rõ thành văn bản, chứ không ngầm hiểu:
[Quản trị dữ liệu](/docs/network/sovereignty/data-sovereignty) (lập trường về chủ quyền dữ liệu/CARE
và những điều cấm chúng tôi không được làm) và
[Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer) (những gì
xảy ra, theo hợp đồng, khi một phương pháp chiến thắng).

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

Xây dựng ngữ liệu và duyệt bản dịch là công việc chuyên môn, được trả thù lao theo
[mức giá công bố](/docs/network/perspectives/how-speakers-get-paid) khi có kinh phí
(hiện tại chưa có nguồn quỹ nào được giữ) — và việc trả thù lao không đồng nghĩa với việc mua dữ liệu của bạn. Bạn được trả công cho công việc *và* vẫn là
chủ sở hữu của những gì bạn xây dựng. Champollion là một dự án nghiên cứu phi thương mại: dự án
không bán bất cứ thứ gì, không tính phí theo mức sử dụng, và [không nhận bất kỳ phần chia nào](/docs/network/sovereignty/economic-model)
từ bất kỳ khoản thu nào mà cộng đồng của bạn kiếm được từ phương pháp do cộng đồng sở hữu.

### Quyền kiểm soát

Tổ chức quản trị của bạn kiểm soát:
- Ai có thể truy cập phương pháp dịch thuật
- Liệu nó có thể được sử dụng cho mục đích thương mại hay không — và nếu có, thì theo các điều khoản của bạn, giữ lại toàn bộ doanh thu kiếm được
- Khi nào và làm thế nào để cập nhật nó
- Dữ liệu nào được sử dụng để phát triển thêm

---

## Cách thức Tham gia

:::tip[Điều người nói ngôn ngữ có thể làm ngay hôm nay — nếu cộng đồng đồng ý]
Champollion không xây dựng hay lưu trữ ngữ liệu — dữ liệu kiểm thử luôn được lấy
từ chính nguồn của nó. Nếu những người nói ngôn ngữ trong cộng đồng của bạn muốn đóng góp các câu
*ngay bây giờ*, [Tatoeba](https://tatoeba.org) chấp nhận các đóng góp
từng câu một ở bất kỳ ngôn ngữ nào, và các bộ sưu tập mở như
[OPUS](https://opus.nlpl.eu/) tập hợp văn bản song ngữ mà Network dùng để xây dựng
bộ chuẩn đánh giá (benchmark). Các câu được thêm vào đó có thể trở thành dữ liệu đánh giá tại đây.

Hãy hiểu rõ sự đánh đổi trước: Tatoeba phát hành các câu theo giấy phép mở
(mặc định là CC BY 2.0 FR), vì vậy bất kỳ ai cũng có thể sao chép chúng — bao gồm cả việc huấn luyện các mô hình
AI — và các bản sao đã tạo không thể thu hồi lại. Đó có thể là lựa chọn
phù hợp cho các câu giao tiếp hàng ngày. Đối với bất kỳ nội dung nào mà cộng đồng của bạn muốn giữ
dưới quyền kiểm soát của riêng mình, hãy tự lưu giữ dữ liệu và sử dụng một
[tập kiểm thử niêm phong](/docs/network/sovereignty/run-a-sovereign-contest) thay thế.
Một ứng dụng cho phép người nói ngôn ngữ đóng góp trực tiếp và công cụ xây dựng ngữ liệu đã nằm trong kế hoạch nhưng chưa
được xây dựng.
:::

1. **Liên hệ** — Mở một issue trên [kho lưu trữ của Network](https://github.com/gamedaysuits/Champollion) hoặc gửi email đến [info@champollion.dev](mailto:info@champollion.dev)
2. **Mô tả ngôn ngữ của bạn** — Ngôn ngữ thuộc ngữ hệ nào? Có bao nhiêu người nói? Sử dụng hệ thống chữ viết nào? Hiện có những tài nguyên tính toán nào (FST, từ điển, ngữ liệu)?
3. **Bắt đầu từ quy mô nhỏ** — Thậm chí chỉ 50 cặp câu dịch được tuyển chọn kỹ lưỡng cũng đủ để tạo một tập dữ liệu đánh giá và mở một nhánh bảng xếp hạng mới. Công việc làm ngữ liệu được [chi trả theo mức giá công bố](/docs/network/perspectives/how-speakers-get-paid) khi có kinh phí; hiện tại chưa có nguồn quỹ nào được giữ
4. **Giữ quyền sở hữu cho bạn** — Đăng ký ngữ liệu dưới dạng siêu dữ liệu trong phân làn bạn chọn ([Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora)); nếu bạn muốn tập kiểm thử được giữ bí mật hoàn toàn, [hướng dẫn quy trình tổ chức cuộc thi tự chủ](/docs/network/sovereignty/run-a-sovereign-contest) là con đường phù hợp
5. **Kết nối chúng tôi với ban quản trị** — Ai trong cộng đồng của bạn có thẩm quyền đối với dữ liệu ngôn ngữ và công nghệ? Mô hình chủ quyền của Network yêu cầu một đối tác quản trị

---

## Xem thêm

- [Tổ chức một cuộc thi tự chủ](/docs/network/sovereignty/run-a-sovereign-contest) — hướng dẫn quy trình (runbook) cho đợt đánh giá do cộng đồng kiểm soát
- [Biểu mẫu điều khoản](/docs/network/sovereignty/terms-templates) — các điều khoản pháp lý đơn giản, theo hướng phi tín nhiệm (trustless) mà cộng đồng của bạn có thể điều chỉnh, với các rủi ro kiểu "ngựa thành Troy" được nêu rõ
- [Quản trị dữ liệu](/docs/network/sovereignty/data-sovereignty) — lập trường, và các khuôn khổ (CARE, Te Mana Raraunga cùng các văn kiện khác về chủ quyền dữ liệu của người bản địa) đã định hình nên lập trường này
- [Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer) — các điều khoản riêng cho từng ngôn ngữ và điều gì xảy ra khi một phương pháp chiến thắng
- [Cách công việc được tài trợ](/docs/network/sovereignty/economic-model) — dòng tiền vận hành như thế nào trong một dự án phi thương mại
- [Hỗ trợ một ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — bối cảnh kỹ thuật dành cho các nhà nghiên cứu làm việc cùng cộng đồng
