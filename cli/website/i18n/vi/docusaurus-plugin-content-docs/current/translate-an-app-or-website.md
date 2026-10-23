---
title: "Dịch ứng dụng hoặc trang web"
slug: /translate-an-app-or-website
description: "Dịch các từ ngữ trên màn hình ứng dụng hoặc trang web sang ngôn ngữ của bạn, luôn cập nhật khi bản gốc thay đổi, và chọn trình dịch phụ trách từng ngôn ngữ."
---

# Dịch ứng dụng hoặc trang web

Các ứng dụng và trang web lưu trữ từ ngữ của mình — nút bấm, menu, thông báo, trang — trong
các tệp, mỗi ngôn ngữ một tệp. Champollion có thể điền vào tệp ngôn ngữ của bạn
thay bạn, và luôn cập nhật mỗi khi bản gốc thay đổi. Chỉ cần một lệnh duy nhất:

```bash
npx champollion sync
```

Công cụ sẽ tìm các tệp ngôn ngữ của ứng dụng, chỉ dịch những gì còn thiếu hoặc
đã thay đổi, kiểm tra từng bản dịch trước khi ghi, và giữ nguyên phần còn
lại.

## Trình dịch nào sẽ thực hiện công việc

Bạn tự chọn cho từng ngôn ngữ:

- **Trình dịch của riêng bạn**, được xây dựng trên rails — các công cụ sẽ kết nối trình dịch với
  ứng dụng của bạn. Nếu trình dịch học từ các câu riêng tư, nó chỉ kết nối sau khi bạn
  nêu rõ ai, trong số những người nắm giữ ngôn từ, đã đồng ý.
- **Mô hình AI hoặc dịch vụ dịch thuật** — dành cho các ngôn ngữ mà chúng đã
  xử lý tốt. Những dịch vụ này sẽ gửi từ ngữ trong ứng dụng của bạn tới công ty vận hành chúng, vì vậy
  hãy chỉ dùng cho văn bản có thể chia sẻ.
- **Dịch vụ của riêng bạn**, tại một địa chỉ do bạn cung cấp.

## Những việc công cụ đảm nhiệm

- **Chỉ dịch phần thay đổi.** Công cụ ghi nhớ những gì đã dịch trước đó, nên bạn không bao giờ
  phải trả phí hai lần cho cùng một câu.
- **Kiểm tra trước khi ghi.** Các câu trả lời trống, bản gốc bị sao chép lại, từ ngữ
  lặp lại theo vòng lặp, văn bản dài hơn nhiều so với mức cần thiết, các phần bị thiếu, hoặc
  sai bảng chữ cái đều bị phát hiện và từ chối. Các bước kiểm tra này giúp phát hiện kết quả bị hỏng,
  chứ không bắt lỗi sai nghĩa — người nói ngôn ngữ đó vẫn có tiếng nói cuối cùng.
- **Tệp của bạn, định dạng của bạn.** Các trang JSON, YAML, TOML và Markdown, cùng các
  framework ứng dụng và trang web phổ biến.

## Ai có thể sử dụng

Miễn phí cho mục đích phi thương mại — ứng dụng của trường học, trang web cộng đồng, dịch vụ
công. Sản phẩm của doanh nghiệp không thuộc phạm vi của giấy phép miễn phí; nếu một cộng đồng
người nói muốn sử dụng cho mục đích thương mại, hãy hỏi, và giấy phép sẽ được cấp miễn phí.
Trang [Ai có thể sử dụng](/docs/getting-started/who-may-use-this) có thông tin chi tiết.

**Tiếp theo:** [Tổ chức một bài kiểm tra kín →](/docs/host-a-sealed-test)

## Tìm hiểu sâu hơn

- [Dịch ứng dụng và trang web](/docs/intro) — tài liệu tham khảo đầy đủ: bắt đầu nhanh,
  cấu hình, framework, bộ nhớ dịch, các bước kiểm tra chất lượng, CI.
- [Phục vụ và triển khai](/docs/agents/serving) — kết nối trình dịch của riêng bạn.
