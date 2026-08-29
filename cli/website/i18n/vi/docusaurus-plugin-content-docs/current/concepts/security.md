---
sidebar_position: 4
title: "Bảo mật"
---

# Bảo mật & An toàn

Champollion được thiết kế để đảm bảo an toàn trong các môi trường đối nghịch — nơi dữ liệu bản địa hóa (locale) có thể đến từ các nguồn không đáng tin cậy, nơi các tên tệp được cố tình tạo ra có thể thoát khỏi ranh giới thư mục, và nơi đầu ra của LLM có thể chứa bất kỳ thứ gì.

## Mô hình mối đe dọa

| Mối đe dọa | Vector tấn công | Biện pháp giảm thiểu |
|--------|--------------|-----------|
| **Prototype pollution** | Các khóa JSON được cố tình tạo ra (`__proto__`, `constructor`) | Từ chối tại thời điểm phân tích (parse) |
| **Path traversal** | Các mã locale như `../../etc/passwd` | Việc ghi tệp được xác thực theo các thư mục đã cấu hình |
| **Lỗi khối mã** | LLM dịch bên trong các rào chắn mã (code fence) | Bảo vệ bằng lính canh Unicode (Unicode sentinel) |
| **Khóa ảo tưởng** | LLM trả về các khóa không được gửi đi | Xác thực phản hồi — chỉ các khóa được chấp nhận mới được ghi |
| **Tiêu hao token ngoài tầm kiểm soát** | Các vòng lặp thử lại vô hạn | Giới hạn ngân sách thông qua `maxRetries` |

## Bảo vệ chống Prototype Pollution

Tất cả các khóa locale đều được xác thực dựa trên một danh sách chặn trước khi xử lý:

- `__proto__`
- `constructor`
- `prototype`

Bất kỳ khóa nào khớp với các mẫu này đều bị từ chối kèm theo lỗi. Điều này ngăn chặn kẻ tấn công sử dụng các tệp locale được cố tình tạo ra để sửa đổi các prototype của đối tượng JavaScript.

## Giới hạn đường dẫn

Khi ghi các tệp locale, champollion xác thực rằng đường dẫn đầu ra nằm trong các thư mục đã cấu hình (`localesDir`, `contentDir`). Các mã locale được làm sạch — một mã như `../../secrets` không thể ghi ra ngoài thư mục mong muốn.

## Bảo vệ khối dữ liệu

Trong quá trình dịch nội dung Markdown, các phần tử có cấu trúc được thay thế bằng các trình giữ chỗ lính canh Unicode (Unicode sentinel) trước khi văn bản được gửi đến LLM:

1. **Khối mã** (dạng rào chắn và nội dòng) → lính canh
2. **Hugo shortcode** (`{{< >}}`, `{{% %}}`) → lính canh  
3. **HTML thô** → lính canh
4. **Biến nội suy** (`{{ .Count }}`) → lính canh

Sau khi dịch, các lính canh được thay thế bằng nội dung gốc. LLM không bao giờ nhìn thấy các khối mã, shortcode hoặc HTML — do đó nó không thể làm hỏng chúng.

## Xác thực phản hồi

Khi LLM trả về phản hồi JSON, champollion xác thực rằng:
- Chỉ các khóa được gửi trong loạt (batch) mới xuất hiện trong phản hồi
- Không có khóa bổ sung nào bị chèn vào
- Phản hồi được phân tích cú pháp thành JSON hợp lệ

Các khóa ảo tưởng sẽ bị âm thầm loại bỏ. Điều này ngăn chặn đầu ra của LLM chèn các bản dịch không mong muốn vào các tệp locale của bạn.

## Cổng chất lượng (Quality Gate)

Mỗi bản dịch đều được xác thực qua năm bước kiểm tra xác định trước khi được ghi vào đĩa. Xem [Cổng chất lượng](/docs/concepts/quality-gate) để biết thêm chi tiết.

## Thử lại với độ trễ tăng dần (Exponential Backoff)

Các cuộc gọi API sử dụng cơ chế thử lại với độ trễ tăng dần (exponential backoff) kết hợp nhiễu ngẫu nhiên (jitter) đối với các phản hồi 429 (giới hạn lượt gọi) và 5xx (lỗi máy chủ). Ba lần thử lại với độ trễ tăng dần giúp tránh việc dồn dập gửi yêu cầu đến API trong thời gian xảy ra sự cố.

## Thời gian chờ yêu cầu (Request Timeout)

Mỗi yêu cầu API có thời gian chờ là 30 giây thông qua `AbortController`. Điều này ngăn quá trình đồng bộ hóa bị treo vô thời hạn do kết nối bị ngắt.

## Báo lỗi rõ ràng khi dịch thất bại

Khi API không khả dụng hoặc bản dịch thất bại, champollion sẽ đưa ra một lỗi rõ ràng kèm theo hướng dẫn xử lý thay vì âm thầm ghi dữ liệu rác. Không có trình giữ chỗ nào có tiền tố `[EN]` được ghi trong quá trình đồng bộ hóa.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

Thất bại của một tệp không làm dừng toàn bộ quá trình đồng bộ hóa — lỗi sẽ được ghi nhật ký (log) và quy trình (pipeline) tiếp tục với tệp tiếp theo, giúp bạn đạt được tiến trình tối đa trong mỗi lần chạy.

## Xác minh sau đồng bộ hóa

Sau khi tất cả các bản dịch hoàn tất, champollion sẽ đọc lại các tệp locale đã ghi từ đĩa và chạy một lượt xác minh. Điều này giúp phát hiện khoảng cách giữa việc đồng bộ báo cáo thành công và việc bản dịch thực tế bị sai:

- **Sự tương đồng về khóa (Key parity)** — tất cả các khóa nguồn đều có mặt trong mỗi mục tiêu
- **Các dấu mốc `[EN]`** — các dấu mốc dự phòng cũ từ các lần chạy trước
- **Bản dịch trống** — các giá trị trống bị lọt qua
- **Tuân thủ hệ chữ viết** — các locale không phải chữ Latinh nhưng lại có bản dịch chỉ chứa ký tự ASCII
- **Bảo toàn trình giữ chỗ** — các trình giữ chỗ ICU khớp với nguồn

Bỏ qua bằng `--no-verify` hoặc chạy độc lập bằng `npx champollion verify`.

## Kiểm thử

Các đặc tính bảo mật được xác minh bởi bộ kiểm thử đối nghịch (adversarial test suite):

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Xem thêm

- [Kiến trúc](/docs/concepts/architecture) — cách hệ sinh thái ba phần kết nối với nhau
- [Tài liệu tham khảo CLI — integrity](/docs/reference/cli#integrity) — lệnh kiểm tra tính toàn vẹn
- [Tài liệu tham khảo CLI — provenance](/docs/reference/cli#provenance) — lệnh kiểm tra nguồn gốc
- [Đặc tả Plugin](/docs/reference/plugin-spec) — các trường nguồn gốc trong manifest của plugin
- [Cổng chất lượng](/docs/concepts/quality-gate) — các bước kiểm tra an toàn ở cấp độ dịch thuật
