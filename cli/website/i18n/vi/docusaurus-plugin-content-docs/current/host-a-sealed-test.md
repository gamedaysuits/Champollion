---
title: "Tổ chức bài kiểm tra niêm phong"
slug: /host-a-sealed-test
description: "Cho phép người khác thử nghiệm công cụ dịch của họ trên các câu kiểm tra của bạn mà không bao giờ nhìn thấy chúng — bài kiểm tra niêm phong là gì, bạn quyết định những gì, và những gì hiện có ngày nay."
---

# Tổ chức một bài kiểm tra niêm phong

Đôi khi trình dịch tốt nhất cho ngôn ngữ của bạn lại đến từ một người khác —
một nhà nghiên cứu, một sinh viên, hay một công ty. Một **bài kiểm tra niêm phong** cho phép họ chứng minh điều đó trên
các câu của *bạn*, mà không bao giờ nhìn thấy những câu đó.

## Cách thức hoạt động

Các câu kiểm tra của bạn được khóa bằng một chiếc chìa khóa, ngay trên máy tính của bạn. Những người muốn
tham gia thi đấu sẽ gửi trình dịch của họ đến. Máy tính của bạn chạy từng trình dịch trên
các câu đã khóa, và chỉ có điểm số được xuất ra — không bao giờ để lộ các câu, và
không bao giờ để lộ các bản dịch.

Nhờ đó, bài kiểm tra vẫn giữ đúng bản chất là một bài kiểm tra thực sự: không ai có thể nghiên cứu trước hay tinh chỉnh theo nó, vì
không ai có thể đọc được nó.

## Những gì bạn quyết định

Bạn đặt ra các điều khoản trước khi bất kỳ ai tham gia thi đấu:

- **Mức độ như thế nào được coi là đủ tốt** để giành chiến thắng.
- **Điều gì sẽ xảy ra với phương pháp chiến thắng:**
  - **nó trở thành của bạn** — nó được chuyển giao cho bạn, những người tổ chức bài kiểm tra;
  - **người tạo ra nó giữ lại nó** — bạn chấm điểm, và cùng lắm chỉ giữ một bản sao được khóa để
    đối chiếu kiểm tra;
  - **người tạo ra nó giữ lại nó, nhưng chia sẻ với mọi người** — họ phải công bố nó
    công khai.
- **Liệu có giải thưởng hay không**, và ai tài trợ giải thưởng đó. Champollion không nhận
  bất kỳ phần chia nào từ bất kỳ giải thưởng nào.

## Hiện tại đã có những gì

Các công cụ dành cho bài kiểm tra niêm phong đã hoạt động: khóa một bộ dữ liệu, chạy các trình dịch
được gửi lên trên một máy tính ngắt kết nối internet, và chỉ công bố
điểm số. Nhưng điều này **vẫn chưa được đưa vào quy trình định sẵn** — hiện tại, điều đó có nghĩa là bạn phải làm theo một
tài liệu hướng dẫn dài hơn, chứ không phải trả lời từng bước các câu hỏi của trợ lý.

Ai nắm giữ chìa khóa hiện nay: bất kỳ ai khóa bộ dữ liệu đó. Chưa có cộng đồng nào chỉ định
những người cùng nhau nắm giữ chìa khóa, và Champollion không nắm giữ bất kỳ phần nào của bất kỳ chìa khóa nào.

Các bài kiểm tra niêm phong đang mở, nếu có, sẽ được liệt kê trên
trang [nhiệm vụ chung](/shared-tasks).

**Quay lại phần đầu:** [Đây là gì →](/docs/what-is-champollion)

## Tìm hiểu sâu hơn

- [Tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest)
  — toàn bộ tài liệu hướng dẫn.
- [Nút đánh giá có chủ quyền](/docs/network/sovereignty/sovereign-eval-node)
  — máy tính chạy các bài nộp.
- [Điều khoản giải thưởng](/docs/network/specifications/prizes) — chi tiết
  cả ba tùy chọn.
- [Tổ chức và tham gia](/docs/agents/hosting-and-joining) — các câu lệnh.
