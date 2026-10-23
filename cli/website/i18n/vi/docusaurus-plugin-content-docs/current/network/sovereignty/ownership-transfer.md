---
sidebar_position: 2
title: "Quyền sở hữu & Điều khoản"
---

# Quyền sở hữu & Điều khoản

> **Tóm tắt tổng quan.** Champollion không có một thỏa thuận chung duy nhất, theo đúng chủ đích thiết kế.
> Các điều khoản được thiết lập theo từng ngữ liệu, từng ngôn ngữ và từng giải thưởng bởi người quản trị sở hữu
> dữ liệu — nhiệm vụ của nền tảng là tôn trọng bất kể điều khoản nào trong số đó. Trang
> này mô tả các khía cạnh mà một bản điều khoản bao gồm và **Mẫu chuyển giao cộng đồng**: điểm khởi đầu mà cơ quan quản trị
> của một cộng đồng có thể tiếp nhận và sửa đổi khi tổ chức giải thưởng và chọn
> điều khoản `pass_to_holders`.

## Khung điều khoản

Champollion được thiết kế để linh hoạt trong các điều khoản nhằm tôn trọng tất cả các giấy phép — và để hỗ trợ các thỏa thuận mới lạ: ngữ liệu bí mật,
bộ kiểm thử do cộng đồng nắm giữ và các yêu cầu triển khai có chủ quyền. Các ngôn ngữ khác nhau sẽ có các thỏa thuận khác nhau. Một ngữ liệu CC0, một ngữ liệu cộng đồng chỉ dành cho nghiên cứu, và một bộ tiêu chuẩn vàng (gold-standard) khép kín được quản lý bởi một hội đồng bộ tộc đều có thể tham gia, mỗi bên theo các điều khoản riêng của mình.

Điều đồng nhất duy nhất là cơ chế thực thi các điều khoản đó: các làn hiển thị (exposure lanes), cổng giấy phép (license gates), khu vực cách ly (quarantine) và đăng ký lấy từ nguồn (fetch-from-source registration) (xem [Đăng ký Ngữ liệu](/docs/network/sovereignty/registering-corpora)). Điều *không bao giờ* đồng nhất chính là bản thân thỏa thuận đó.

Khi một người quản lý ngữ liệu thiết lập các điều khoản — cho việc tham gia đánh giá hiệu năng (benchmark), cho một giải thưởng được tài trợ, hoặc cho bất kỳ điều gì khác — bản điều khoản sẽ trả lời một nhóm câu hỏi nhỏ:

| Khía cạnh | Câu hỏi đặt ra |
|---|---|
| **Mức độ hiển thị ngữ liệu** | Làn nào — công khai, chỉ dành cho nghiên cứu, hay riêng tư? Bản dịch tham chiếu có bao giờ hiển thị không? |
| **Quyền sở hữu phương pháp** | Nếu có người thắng giải, ai sở hữu phương pháp chiến thắng — nhà phát triển, cộng đồng, hay chia sẻ chung? |
| **Triển khai** | Ai có thể triển khai phương pháp, ở đâu, và theo những điều kiện nào? |
| **Tự lưu trữ** | Phương pháp có bắt buộc phải chạy hoàn toàn trên hạ tầng do cộng đồng kiểm soát không? |
| **Bảo mật** | Tập kiểm thử có được niêm phong không? Ai giữ khóa? Ai cấp quyền cho mỗi lượt đánh giá? |
| **Thù lao** | Người xây dựng, người xác thực và người thẩm định được trả bao nhiêu? (Mặc định đã công bố: [Làm việc với người bản ngữ](/docs/working-with-speakers)) |

Không có câu hỏi nào ở trên có câu trả lời do nền tảng áp đặt. Các mặc định dưới đây là một bản mẫu, không phải là quy tắc.

## Bản mẫu Chuyển giao Cộng đồng

Bên tổ chức một cuộc thi niêm phong sẽ chọn một trong ba điều khoản giải thưởng — `pass_to_holders`,
`retain_ip` hoặc `release_open` — và công bố điều khoản đó trước khi có bất kỳ ai tham gia
([Đặc tả giải thưởng](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three)).
Một vị trí trên bảng xếp hạng mở không chuyển giao bất kỳ quyền nào theo bất kỳ điều khoản nào trong số đó. Bản
mẫu này nêu rõ `pass_to_holders` đối với một ngữ liệu ngôn ngữ bản địa,
được đưa ra như một điểm khởi đầu để cơ quan quản trị của cộng đồng sửa đổi. Quy
trình hoạt động như sau:

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

:::note[Trạng thái: bản mẫu, không phải lịch sử thành tích]
Hiện chưa có giải thưởng nào mở và chưa có đợt chuyển giao nào diễn ra. Bản mẫu này được ghi lại để các điều
khoản dự kiến minh bạch trước khi bất kỳ ai bỏ công sức, và để cơ quan
quản trị của cộng đồng có một bản thảo cụ thể để phản hồi thay vì một trang giấy trắng.
Một văn bản có chữ ký, được soạn thảo cùng chuyên viên tư vấn pháp lý cho các bên cụ thể, mới là thứ
khiến bất kỳ điều nào ở đây có giá trị ràng buộc.
:::

## Dành cho các nhà nghiên cứu

Nếu bạn đang phát triển một phương pháp cho một ngôn ngữ bản địa:

1. **Thiết lập mối quan hệ** với cộng đồng ngôn ngữ trước khi bạn bắt đầu
2. **Sử dụng dữ liệu được cấp phép mở** để phát triển (không sử dụng các tài nguyên bị giới hạn của cộng đồng)
3. **Ghi chép nguồn gốc (provenance)** trong [thẻ lượt chạy (run card)](/docs/network/specifications/run-card) của bạn — mọi tài nguyên, giấy phép và nguồn gốc của nó
4. **Đọc kỹ các điều khoản của giải thưởng trước khi xây dựng** — nếu các điều khoản bao gồm việc chuyển giao, đóng góp của bạn là kiến trúc và kỹ thuật (thuộc quyền công bố và tái sử dụng của bạn); đóng góp của cộng đồng là kiến thức ngôn ngữ giúp phương pháp đó hoạt động được cho ngôn ngữ của họ

## Xem thêm

- [Ngôn từ của bạn, quy tắc của bạn](/docs/your-words-your-rules) — lập trường mà các điều khoản này hiện thực hóa
- [Cách công việc được tài trợ](/docs/getting-started/who-may-use-this) — dòng tiền dịch chuyển thế nào, và Champollion nhận gì (không nhận gì)
- [Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora) — các làn hiển thị và lấy dữ liệu từ nguồn
- [Đặc tả giải thưởng](/docs/network/specifications/prizes) — các điều kiện ngưỡng và quy trình nhận thưởng
