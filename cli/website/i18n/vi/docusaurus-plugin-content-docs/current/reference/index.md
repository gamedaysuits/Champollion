---
title: "Tài liệu tham khảo"
slug: /reference
description: "Mọi chi tiết kỹ thuật trên cùng một bản đồ: các lệnh, định dạng tệp, thông số kỹ thuật, giới hạn kỹ thuật, tổ chức bài kiểm tra khép kín, bảng xếp hạng, dịch ứng dụng và trang web, Atlas, cùng cơ sở hạ tầng mạng."
---

# Tài liệu tham khảo

Hồ sơ kỹ thuật đầy đủ dành cho nhà phát triển, nhà nghiên cứu và các tác tử AI.
[Các trang dành cho người đọc](/docs/) thuật lại cùng nội dung bằng ngôn từ bình dị, và
[hướng dẫn dành cho tác tử](/docs/agents) trình bày cách một tác tử điều khiển hệ thống; mỗi trang
dưới đây nêu rõ điều đó với độ chính xác tuyệt đối.

## Lệnh

- [`champollion`](/docs/reference/cli) — mọi lệnh và cờ của công cụ
  dự án và trình dịch ứng dụng lẫn trang web.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — mọi
  lệnh của bộ công cụ huấn luyện mô hình, được tạo tự động từ bộ phân tích cú pháp của nó.
- [`mt-eval`](/docs/reference/mt-eval) — mọi lệnh của khung
  đánh giá, được tạo tự động từ bộ phân tích cú pháp của nó.
- [Máy chủ MCP](/docs/network/getting-started/mcp-server) — cả hai cấu hình,
  mọi công cụ và mọi đối số.

## Định dạng

- [Các định dạng framework](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 và service-api/1, từ các schema tương ứng.
- [Thẻ lượt chạy](/docs/network/specifications/run-card) — những gì một lượt chạy
  được chấm điểm ghi nhận và công bố.
- [Dữ liệu hướng dẫn](/docs/concepts/coaching-data) — các ghi chú ngữ pháp và danh sách
  từ vựng được cung cấp cho một phương thức LLM.
- [Đặc tả plugin](/docs/reference/plugin-spec) — tệp manifest của plugin phương thức
  (`method.json`) mà một phương thức dịch phát hành kèm theo.
- [Thẻ ngôn ngữ](/docs/reference/language-card-spec) — schema của một thẻ
  trong Atlas.

## Đặc tả kỹ thuật

- [Chấm điểm](/docs/network/specifications/scoring) — chuẩn chấm điểm standard/1: chỉ số
  chính chrF++ của ngữ liệu cùng khoảng bootstrap 95%, các chỉ số tiêu chuẩn
  bên cạnh, và các phép chẩn đoán được tách riêng.
- [Ý nghĩa thống kê](/docs/network/specifications/significance) — các kiểm định bắt cặp,
  và thời điểm một lượt chạy tốt hơn một lượt chạy khác.
- [Giao diện phương thức](/docs/network/specifications/methods) — phương thức là gì,
  các lớp và các phụ thuộc của nó.
- [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability) —
  chỉ số nào đáng tin cậy cho loại ngôn ngữ nào, dựa trên đánh giá của con người.
- [Điểm chuẩn](/docs/network/specifications/benchmark) — giao thức mà mọi
  lượt chạy hợp lệ đều tuân theo.
- [Bộ khung đánh giá](/docs/network/specifications/harness) — cách `mt-eval` chạy,
  chấm điểm và công bố.
- [Xác thực bởi người nói](/docs/network/specifications/speaker-validation) — đánh giá
  từ con người mà điểm số tự động đại diện thay thế.

## Giới hạn kỹ thuật

- [Giới hạn kỹ thuật](/docs/network/honest-limitations) — những điều không được cam kết:
  các tầng tin cậy tự báo cáo, chưa có đánh giá từ người nói, việc lưu ký bộ kiểm thử niêm phong, và không có
  độ tin cậy theo từng câu.

## Tổ chức bài kiểm tra niêm phong

- [Tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest)
  — tài liệu vận hành toàn diện cho một tập kiểm thử không bao giờ rời khỏi máy của đơn vị lưu trữ.
- [Nút đánh giá có chủ quyền](/docs/network/sovereignty/sovereign-eval-node) — cỗ
  máy chấm điểm: phần cứng, air gap và nghi thức bàn giao khóa.
- [Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora) —
  các tầng mức độ hiển thị và luồng giấy phép cho ngữ liệu bạn nắm giữ.
- [Quyền sở hữu & điều khoản](/docs/network/sovereignty/ownership-transfer) và
  [Mẫu điều khoản](/docs/network/sovereignty/terms-templates) — những gì một bài nộp
  chuyển giao, được công bố trước khi có người tham gia.
- [Giải thưởng](/docs/network/specifications/prizes) — những yêu cầu đối với một giải thưởng, nếu
  nhà tài trợ khởi xướng.

## Bảng xếp hạng và công bố

- [Bảng xếp hạng và công bố](/docs/reference/leaderboard) — bảng xếp hạng là
  gì, hai loại điểm chuẩn, và một lượt chạy được công bố mang theo những gì.
- [Quy tắc gửi bài](/docs/network/leaderboard/rules) — những gì được chấp nhận,
  những gì bị loại, và các tầng xác minh.
- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — các tập dữ liệu
  đã đăng ký và luồng giấy phép của chúng.
- [Gửi một phương thức](/docs/network/getting-started/submit-a-method) — chạy
  bộ khung và công bố thẻ lượt chạy.
- [Đóng góp tài nguyên tính toán](/docs/network/getting-started/contributing-compute) —
  chạy các mục từ hàng đợi công khai bằng khóa của riêng bạn.
- [FAQ](/docs/network/getting-started/faq) — các chỉ số, mô hình, FST và
  việc bị loại.

## Dịch ứng dụng và trang web

- [Dịch ứng dụng và trang web](/docs/intro) — những gì `champollion sync` thực hiện, cùng
  hướng dẫn đến từng trang liên quan: bắt đầu nhanh, cài đặt, cấu hình,
  framework, CI/CD, phương thức, nội dung, bộ nhớ dịch, cổng chất lượng,
  bảo mật, tập lệnh, trình dịch và khắc phục sự cố.

## Atlas

- [Atlas](/docs/atlas) — chỉ mục ngôn ngữ là gì và các dữ kiện của nó
  đến từ đâu.
- [Đặc tả thẻ ngôn ngữ](/docs/reference/language-card-spec) và
  [quy trình trích dẫn](/docs/reference/language-card-citation-procedure) —
  từng trường thông tin, và cách mỗi trường được trích dẫn.
- [Những gì được coi là một ngôn ngữ](/docs/network/context/what-counts-as-a-language)
  — những câu trả lời mà chỉ mục đưa ra, và lý do vì sao.
- [Gửi đề xuất lên chỉ mục](/docs/network/getting-started/submit-to-the-index) và
  [Báo cáo lỗi](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — đề xuất một mục mới hoặc một nội dung chỉnh sửa.

## Hạ tầng mạng lưới

- [Xây dựng hàng đợi](/docs/network/specifications/queue-construction) và
  [lý do hàng đợi được thiết kế như vậy](/docs/network/perspectives/why-the-queue)
  — cách hàng đợi công việc công khai xếp hạng những gì cần đo lường tiếp theo.
- [Độ mạnh kết nối](/docs/network/specifications/connection-strength) —
  cung kết nối trên bản đồ mạng lưới thể hiện điều gì về một cặp ngôn ngữ, và thang đo độ mạnh
  đã ngừng sử dụng.
- [Đóng góp tài nguyên tính toán](/docs/network/getting-started/contributing-compute) —
  vận hành hàng đợi.
