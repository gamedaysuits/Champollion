---
sidebar_position: 2
title: "Quyền sở hữu & Điều khoản"
---

# Quyền sở hữu & Điều khoản

> **Tóm tắt điều hành.** Champollion không có thỏa thuận chung duy nhất, đây là chủ ý thiết kế.
> Các điều khoản được thiết lập cho từng ngữ liệu (corpus), từng ngôn ngữ và từng giải thưởng bởi người quản lý sở hữu
> dữ liệu đó — nhiệm vụ của nền tảng là tôn trọng bất kỳ điều khoản nào trong số đó. Trang
> này mô tả các khía cạnh mà một bản điều khoản bao gồm và **Bản mẫu Chuyển giao Cộng đồng** (Community Transfer Template),
> điểm khởi đầu mặc định cho các giải thưởng được tài trợ trên các ngữ liệu ngôn ngữ bản địa.

## Khung điều khoản

Champollion được thiết kế để linh hoạt trong các điều khoản nhằm tôn trọng tất cả các giấy phép — và để hỗ trợ các thỏa thuận mới lạ: ngữ liệu bí mật,
bộ kiểm thử do cộng đồng nắm giữ và các yêu cầu triển khai có chủ quyền. Các ngôn ngữ khác nhau sẽ có các thỏa thuận khác nhau. Một ngữ liệu CC0, một ngữ liệu cộng đồng chỉ dành cho nghiên cứu, và một bộ tiêu chuẩn vàng (gold-standard) khép kín được quản lý bởi một hội đồng bộ tộc đều có thể tham gia, mỗi bên theo các điều khoản riêng của mình.

Điều đồng nhất duy nhất là cơ chế thực thi các điều khoản đó: các làn hiển thị (exposure lanes), cổng giấy phép (license gates), khu vực cách ly (quarantine) và đăng ký lấy từ nguồn (fetch-from-source registration) (xem [Đăng ký Ngữ liệu](/docs/network/sovereignty/registering-corpora)). Điều *không bao giờ* đồng nhất chính là bản thân thỏa thuận đó.

Khi một người quản lý ngữ liệu thiết lập các điều khoản — cho việc tham gia đánh giá hiệu năng (benchmark), cho một giải thưởng được tài trợ, hoặc cho bất kỳ điều gì khác — bản điều khoản sẽ trả lời một nhóm câu hỏi nhỏ:

| Khía cạnh | Câu hỏi |
|---|---|
| **Hiển thị ngữ liệu** | Làn hiển thị nào — công khai, chỉ dành cho nghiên cứu, hay riêng tư? Các tài liệu tham khảo có bao giờ được hiển thị không? |
| **Sở hữu phương pháp** | Nếu giành được giải thưởng, ai là người sở hữu phương pháp chiến thắng — nhà phát triển, cộng đồng, hay chia sẻ chung? |
| **Triển khai** | Ai có thể triển khai phương pháp, ở đâu và dưới những điều kiện nào? |
| **Tự lưu trữ (Self-hosting)** | Phương pháp có phải chạy hoàn toàn trên cơ sở hạ tầng do cộng đồng kiểm soát không? |
| **Bảo mật** | Bộ kiểm thử có được niêm phong không? Ai giữ khóa? Ai ủy quyền cho mỗi lượt chạy đánh giá? |
| **Đền bù** | Người xây dựng, người xác thực và người đánh giá được trả lương như thế nào? (Các mặc định đã công bố: [Cách Người nói Ngôn ngữ được Trả lương](/docs/network/perspectives/how-speakers-get-paid)) |

Không có câu hỏi nào ở trên có câu trả lời do nền tảng áp đặt. Các mặc định dưới đây là một bản mẫu, không phải là quy tắc.

## Bản mẫu Chuyển giao Cộng đồng

Đối với các giải thưởng được tài trợ trên các ngữ liệu ngôn ngữ bản địa, bản mẫu mặc định — được cung cấp như một điểm khởi đầu để cơ quan quản lý của cộng đồng sửa đổi — hoạt động như sau:

### 1. Phát triển phương pháp
Một nhà nghiên cứu, sinh viên hoặc nhà phát triển xây dựng một phương pháp dịch thuật — một quy trình được kiểm soát bằng FST (FST-gated pipeline), một LLM được huấn luyện kèm cặp (coached LLM), một mô hình được tinh chỉnh (fine-tuned model), hoặc bất kỳ phương pháp tiếp cận nào khác — sử dụng tài nguyên của riêng họ và dữ liệu được cấp phép mở.

### 2. Đánh giá mạng lưới
Phương pháp này được đánh giá hiệu năng thông qua [hệ thống đánh giá (eval harness)](/docs/network/specifications/harness). Mỗi lượt gửi đều được gắn dấu vân tay (fingerprint) với một commit Git và phiên bản bộ dữ liệu cụ thể. Điểm số có thể tái lập được.

### 3. Cộng đồng đánh giá
Kết quả được xem xét bởi các nhân sự ngôn ngữ trong cộng đồng. Điểm số cao trên bảng xếp hạng chứng minh phương pháp đó *hoạt động hiệu quả*; nó không chứng minh phương pháp đó là *phù hợp*. Những người nói song ngữ sẽ xác thực một mẫu kết quả đầu ra, và những người đánh giá của cộng đồng có thể từ chối một phương pháp vì bất kỳ lý do gì.

### 4. Chuyển giao quyền sở hữu
Khi một phương pháp đáp ứng được tiêu chuẩn giải thưởng (các chỉ số tự động **và** xác thực từ con người), nhà phát triển sẽ chuyển giao phương pháp đó — mã nguồn, trọng số đã huấn luyện (trained weights), cấu hình, dữ liệu huấn luyện kèm cặp — cho tổ chức quản lý của cộng đồng (một hội đồng bộ tộc, cơ quan ngôn ngữ hoặc tổ chức tương tự do cộng đồng lựa chọn, không bao giờ do Champollion chọn). Cộng đồng sở hữu hoàn toàn sản phẩm đó: họ có thể kiểm tra, sửa đổi, triển khai, lưu kho hoặc cấp phép cho nó mà không có bất kỳ khiếu nại tiếp diễn nào từ nhà phát triển hoặc từ Champollion.

Các thành phần của bên thứ ba mà nhà phát triển không sở hữu (một mô hình nền tảng có trọng số mở, một FST giấy phép AGPL) không thể chuyển giao quyền sở hữu — chúng được chuyển sang cho cộng đồng theo các giấy phép mở riêng của chúng, đó là lý do tại sao tính hợp lệ của giải thưởng yêu cầu mọi dependency phải mang các quyền mà cộng đồng thực sự có thể nhận được. Xem các nhóm dependency trong [Tài liệu kỹ thuật Giao diện Phương pháp](/docs/network/specifications/methods#method-validity-and-dependency-classes).

Nhà phát triển giữ lại những gì nhà nghiên cứu nên giữ: quyền không bị giới hạn trong việc công bố phương pháp tiếp cận và kết quả, tái sử dụng các kỹ thuật của họ ở bất kỳ đâu, và sự ghi nhận vĩnh viễn với tư cách là người tạo ra phương pháp.

### 5. Triển khai — nếu và theo cách cộng đồng lựa chọn
Cộng đồng quyết định xem phương pháp đó có được triển khai hay không, bởi ai và theo các điều khoản nào. Việc triển khai độc lập hoàn toàn là công việc riêng của cộng đồng: **Champollion không lấy bất kỳ phần chia sẻ nào từ những gì cộng đồng kiếm được từ tài sản mà họ sở hữu**, và không nắm giữ quyền triển khai nào của riêng mình.

:::note[Trạng thái: bản mẫu, không phải lịch sử thực tế]
Chưa có giải thưởng nào được mở và chưa có hoạt động chuyển giao nào diễn ra — bảng xếp hạng
hiện tại chưa có lượt chạy nào được công bố. Bản mẫu này được tài liệu hóa để các điều khoản
dự kiến được minh bạch trước khi bất kỳ ai bỏ công sức ra, và để ban quản trị của cộng đồng
có một bản thảo cụ thể để phản hồi thay vì một trang giấy trắng.
Một văn bản được ký kết, được soạn thảo với sự tư vấn pháp lý cho các bên liên quan cụ thể,
mới là điều làm cho những nội dung này có tính ràng buộc.
:::

## Dành cho các nhà nghiên cứu

Nếu bạn đang phát triển một phương pháp cho một ngôn ngữ bản địa:

1. **Thiết lập mối quan hệ** với cộng đồng ngôn ngữ trước khi bạn bắt đầu
2. **Sử dụng dữ liệu được cấp phép mở** để phát triển (không sử dụng các tài nguyên bị giới hạn của cộng đồng)
3. **Ghi chép nguồn gốc (provenance)** trong [thẻ lượt chạy (run card)](/docs/network/specifications/run-card) của bạn — mọi tài nguyên, giấy phép và nguồn gốc của nó
4. **Đọc kỹ các điều khoản của giải thưởng trước khi xây dựng** — nếu các điều khoản bao gồm việc chuyển giao, đóng góp của bạn là kiến trúc và kỹ thuật (thuộc quyền công bố và tái sử dụng của bạn); đóng góp của cộng đồng là kiến thức ngôn ngữ giúp phương pháp đó hoạt động được cho ngôn ngữ của họ

## Xem thêm

- [Quản lý Dữ liệu](/docs/network/sovereignty/data-sovereignty) — lập trường mà các điều khoản này thực thi
- [Cách Công việc được Tài trợ](/docs/network/sovereignty/economic-model) — dòng tiền di chuyển như thế nào, và Champollion nhận được gì (không nhận gì)
- [Đăng ký Ngữ liệu](/docs/network/sovereignty/registering-corpora) — các làn hiển thị và lấy từ nguồn
- [Tài liệu kỹ thuật Giải thưởng](/docs/network/specifications/prizes) — các điều kiện ngưỡng và quy trình nhận giải
