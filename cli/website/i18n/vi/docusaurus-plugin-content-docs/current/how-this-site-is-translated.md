---
id: how-this-site-is-translated
title: "Cách trang web này được dịch"
description: "Mọi locale trên trang web này đều được dịch máy bởi chính Champollion — cùng một CLI mà tài liệu này mô tả. Chúng tôi “dogfood” chính công cụ của mình."
---

# Trang web này được dịch như thế nào

Trang web này có sẵn bằng 13 ngôn ngữ. Mọi ngôn ngữ ngoại trừ tiếng Anh đều được
**dịch máy bởi chính Champollion** — cùng một CLI mà tài liệu này
mô tả (`npx champollion sync`). Chúng tôi tự sử dụng công cụ của chính mình.

Hiện tại, mọi cặp ngôn ngữ đều sử dụng một mô hình duy nhất:
**`google/gemini-3.1-pro-preview`**, dịch với hướng dẫn về
văn phong và thuật ngữ cho từng ngôn ngữ được mô tả bên dưới. Chúng tôi cố ý chọn một mô hình
như một mặc định trung thực trong khi xây dựng lại việc lựa chọn mô hình
dựa trên điểm chuẩn của mình (xem bên dưới) — vì vậy đây là một lựa chọn rõ ràng, được ghi chép lại, không phải là một
kết quả mà chúng tôi đang tô vẽ thành một thứ không có thật.

Hai điều bạn nên biết với tư cách là người đọc:

1. **Các trang này là bản dịch máy.** Chúng được tạo ra với
   hướng dẫn về văn phong và thuật ngữ được mô tả bên dưới, nhưng không có con người nào đánh giá
   từng câu. Nếu có điều gì đó đọc không đúng, phiên bản tiếng Anh là
   bản gốc có thẩm quyền — và chúng tôi rất mong nhận được sự sửa đổi.
2. **Mô hình hiện tại là một mặc định, sẽ được chọn theo điểm chuẩn trong tương lai.**
   Thiết kế của Champollion là chọn mô hình dịch *cho từng cặp
   ngôn ngữ* bằng điểm chuẩn — chấm điểm mọi ứng viên trên một kho ngữ liệu phát triển và
   dịch ngôn ngữ đó bằng phương pháp có điểm số cao nhất (các trường hợp hòa về mặt thống kê
   sẽ được quyết định bởi chi phí). Chúng tôi đang chạy lại quá trình lựa chọn đó qua
   cổng kiểm tra tính toàn vẹn của riêng mình trước khi ghim các mô hình chiến thắng cho từng cặp tại đây. **Cho đến khi các lần chạy đó
   được công bố trên [Network leaderboard](/leaderboard), trang này sẽ
   không tuyên bố nguồn gốc điểm chuẩn mà nó không thể cho bạn thấy.**

## Nguồn gốc theo ngôn ngữ

| Locale | Ngôn ngữ | Phương pháp | Mô hình | Văn phong | Lần đồng bộ cuối |
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | *vous* trang trọng | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | trang trọng | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | Mỹ Latinh trung tính | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | kỹ thuật chuyên nghiệp | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (lịch sự) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (lịch sự) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | chuyên nghiệp | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | chuyên nghiệp trung tính | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | dạng *bạn* trung tính | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | MSA, chuyên nghiệp | 2026-07-18 |

## Lựa chọn điểm chuẩn mà chúng tôi đang xây dựng lại

Phương pháp dự kiến — và cách cấu hình được thiết kế để hoạt động — là
lựa chọn mô hình cho từng cặp ngôn ngữ dựa trên đánh giá của riêng chúng tôi: chấm điểm mọi
mô hình ứng viên trên kho ngữ liệu phát triển của cặp ngôn ngữ đó, lấy
điểm tổng hợp cao nhất và giải quyết các trường hợp hòa về mặt thống kê bằng chi phí. Toàn bộ quy trình này được
ghi chép lại cho bất kỳ ai muốn tái tạo nó.

Hôm nay, chúng tôi **không** công bố điểm tổng hợp hoặc "người chiến thắng điểm chuẩn" cho từng
ngôn ngữ trên trang này, bởi vì quá trình quét lựa chọn hỗ trợ cho
những con số đó đang được chạy lại qua cổng kiểm tra tính toàn vẹn của hệ thống thử nghiệm (harness integrity gate) trước.
Khi hoàn tất, các lần chạy sẽ có trên bảng xếp hạng công khai, bảng này sẽ
hiển thị mô hình chiến thắng của từng cặp cùng với lần chạy được trích dẫn và cấu hình trang web
sẽ ghim lại các mô hình chiến thắng cho từng cặp. Cho đến lúc đó: một mặc định trung thực.

*Điểm tổng hợp (Composite score)* là số liệu chất lượng kết hợp của Network (chrF++, khớp
chính xác và các plugin số liệu được tải, đã xác minh bằng bootstrap-CI). Điểm số chỉ
có thể so sánh **trong cùng một cặp ngôn ngữ**, không bao giờ so sánh giữa các cặp — sự khác biệt về hệ thống chữ viết và
kho ngữ liệu làm cho việc so sánh chéo giữa các cặp trở nên vô nghĩa.

## Văn phong và giọng điệu

Mỗi ngôn ngữ được dịch với một văn phong rõ ràng được chọn từ
các thẻ ngôn ngữ của Champollion, vì vậy mức độ trang trọng được nhất quán trên toàn trang web:

- **Français** — vouvoiement (*vous* trang trọng)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — trang trọng, với các thuật ngữ kỹ thuật tiêu chuẩn
- **Español** — tiếng Tây Ban Nha Mỹ Latinh trung tính
- **简体中文** — văn phong kỹ thuật chuyên nghiệp
- **日本語** — です/ます (dạng lịch sự)
- **한국어** — 해요체 (lịch sự)
- **Português** — văn phong chuyên nghiệp
- **ไทย** — chuyên nghiệp trung tính
- **Tiếng Việt** — dạng *bạn* trung tính
- **العربية** — Tiếng Ả Rập Hiện đại Tiêu chuẩn (MSA), văn phong chuyên nghiệp

## Những gì không được dịch máy

Các khối mã, lệnh CLI, khóa cấu hình, tên gói, URL và
danh từ riêng được bảo vệ trong quá trình dịch và được giữ nguyên bằng tiếng Anh theo
thiết kế.

## Bạn tìm thấy lỗi dịch thuật?

Hãy mở một issue hoặc PR — nguồn của mọi trang được dịch là bản gốc
tiếng Anh. Các sửa đổi đối với một trang được dịch sẽ được giữ lại trong các lần đồng bộ hóa sau này miễn là
nguồn tiếng Anh của trang đó không thay đổi (quá trình đồng bộ hóa chỉ dịch lại một
trang khi nguồn tiếng Anh của nó thay đổi).

*Bản thân trang này cũng được dịch máy bằng phương pháp được mô tả ở trên — nó
mô tả quá trình dịch của chính nó.*
