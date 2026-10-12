---
sidebar_position: 7
title: "So sánh"
---

# So sánh Champollion

champollion thuộc một phân khúc khác so với hầu hết các công cụ bản địa hóa. Dưới đây là một so sánh trung thực.

## Bức tranh toàn cảnh

Hầu hết các công cụ bản địa hóa đều thuộc một trong ba nhóm sau:

| Phân khúc | Ví dụ | Mô hình |
|----------|----------|-------|
| **Nền tảng TMS đám mây** | Crowdin, Phrase, Locize, Tolgee | Bảng điều khiển SaaS + dịch giả con người + đăng ký hàng tháng |
| **Công cụ trích xuất Key** | i18next-scanner, FormatJS CLI | Quét mã nguồn để tìm các lệnh gọi hàm dịch |
| **Công cụ dịch CLI** | **champollion** | Chạy trực tiếp trong dự án của bạn, dịch tệp trực tiếp, không cần tài khoản đám mây |

Champollion là một **công cụ dịch CLI** — nó dịch trực tiếp các tệp ngôn ngữ (locale files) của bạn bằng cách sử dụng các backend có thể cấu hình (LLM, Google Translate, plugin tùy chỉnh). Không có bảng điều khiển đám mây, không có quy trình làm việc của dịch giả con người, không có phí hàng tháng.

---

## So sánh tính năng

| Tính năng | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Chạy cục bộ (không cần tài khoản đám mây)** | ✅ | ❌ | ❌ | ❌ |
| **Phụ thuộc tối thiểu** | ✅ | ❌ | ❌ | ❌ |
| **Cấu hình phương thức theo từng cặp** | ✅ | ❌ | ❌ | ❌ |
| **Tùy chỉnh ngữ vực ngôn ngữ** | ✅ | ❌ | ❌ | ❌ |
| **Nhận biết nội dung (bảo vệ khối mã)** | ✅ | ❌ | ❌ | ❌ |
| **Ngôn ngữ nhân tạo & chuyển đổi chữ viết** | ✅ | ❌ | ❌ | ❌ |
| **Kiến trúc plugin** | ✅ | ❌ | ❌ | ❌ |
| **Dịch Markdown / nội dung** | ✅ | ✅ | ✅ | ❌ |
| **Bộ nhớ dịch thuật** | ✅ | ✅ | ✅ | ✅ |
| **Xuất/nhập XLIFF** | ✅ | ✅ | ✅ | ❌ |
| **Xác thực số nhiều ICU** | ✅ | ✅ | ✅ | ❌ |
| **Tuân thủ thuật ngữ** | ✅ | ✅ | ✅ | ❌ |
| **Quy trình cho người dịch** | Dựa trên XLIFF | ✅ | ✅ | ✅ |
| **Chỉnh sửa theo ngữ cảnh (trực quan)** | ❌ | ✅ | ✅ | ✅ |
| **Cộng tác nhóm** | ❌ | ✅ | ✅ | ✅ |
| **Hỗ trợ định dạng tệp** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Giá cả** | Miễn phí cho mục đích phi thương mại (bạn tự trả phí LLM) | Từ $0/tháng | Từ $0/tháng | Từ $0/tháng |

---

## Khi nào nên dùng Champollion

**Champollion là một lựa chọn phù hợp khi:**

- Bạn muốn tích hợp dịch máy trực tiếp vào quy trình build (build pipeline) của mình — chứ không phải là một quy trình làm việc riêng biệt
- Bạn cần kiểm soát phương thức dịch cho từng ngôn ngữ (dùng LLM cho một số ngôn ngữ, Google Translate cho những ngôn ngữ khác, và plugin tùy chỉnh cho phần còn lại)
- Bạn đang dịch sang các ngôn ngữ không được hỗ trợ bởi các API phổ biến (ngôn ngữ bản địa, ngôn ngữ có nguy cơ mai một, ngôn ngữ nhân tạo)
- Bạn muốn đầu ra hệ chữ viết mang tính xác định (Cree Syllabics, Klingon pIqaD, Tengwar)
- Bạn muốn hoàn toàn không bị ràng buộc vào nhà cung cấp (vendor lock-in) và không phụ thuộc vào đám mây
- Bạn là nhà phát triển độc lập hoặc đội ngũ nhỏ không cần một bảng điều khiển TMS đầy đủ
- Bạn muốn bàn giao file XLIFF cho dịch giả chuyên nghiệp mà không cần đăng ký tài khoản đám mây

**Một TMS đám mây sẽ phù hợp hơn khi:**

- Bạn có dịch giả chuyên nghiệp xem xét lại từng chuỗi dịch (quy trình XLIFF của champollion đơn giản hơn một TMS đầy đủ)
- Bạn cần quản lý bộ nhớ dịch thuật và thuật ngữ chung (glossary) giữa nhiều dự án
- Bạn cần chỉnh sửa trực quan theo ngữ cảnh (xem trước bản dịch ngay trong giao diện người dùng của bạn)
- Bạn có một đội ngũ lớn với nhu cầu kiểm soát truy cập dựa trên vai trò (RBAC)
- Bạn cần hỗ trợ hơn 50 định dạng tệp khác nhau

---

## Những điều Champollion làm được mà không công cụ nào khác làm được

### 1. Văn phong tùy chỉnh (Custom Registers)

Mỗi cặp ngôn ngữ đều nhận được các hướng dẫn về giọng điệu phù hợp với văn hóa dành cho LLM:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Không có công cụ nào khác đi kèm với 47 văn phong ngôn ngữ được cấu hình sẵn, hoặc cho phép bạn tự định nghĩa các văn phong tùy chỉnh cho từng dự án.

### 2. Bộ chuyển đổi hệ chữ viết xác định (Deterministic Script Converters)

Champollion đi kèm với năm bộ chuyển đổi hệ chữ viết tích hợp sẵn chạy dưới dạng các hook sau dịch thuật — không cần đến LLM:

| Ngôn ngữ | Chuyển đổi | Ví dụ |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillic | `Beograd` → `Београд` |
| `tlh` | Romanization → pIqaD | `tlhIngan Hol` → (ký tự pIqaD) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Chế độ Beleriand) |
| `x-kryptonian` | Latin → Kryptonian | Thay thế mật mã (yêu cầu font chữ) |

Đây là các bộ chuyển đổi thuần bảng tra cứu (lookup-table) — có tính xác định, có thể kiểm chứng và hoàn toàn không có rủi ro LLM tự "ảo tưởng" (hallucination).

### 3. Bảo vệ nhận biết nội dung (Content-Aware Shielding)

Khi dịch Markdown hoặc nội dung đa dạng, Champollion sẽ bảo vệ:

- Các khối mã (fenced code blocks) (` ``` `)
- Mã nội dòng (inline code) (`` ` ` ``)
- Hugo shortcodes (`{{</* */>}}`, `{{%/* */%}}`)
- Các biến nội suy (interpolation variables) (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Các khối HTML thô

Chúng được thay thế bằng các token lính canh Unicode (sentinel tokens) trước khi dịch và được khôi phục lại sau đó. LLM sẽ không bao giờ nhìn thấy mã, shortcode hay các biến của bạn.

### 4. Plugin phương thức huấn luyện (Coached Method Plugins)

Đối với các ngôn ngữ không được hỗ trợ bởi API, bạn có thể xây dựng một phương thức dịch được huấn luyện (coached translation method):

1. Viết dữ liệu huấn luyện ngôn ngữ (quy tắc ngữ pháp, từ vựng, ví dụ)
2. Đóng gói nó thành một plugin
3. Đánh giá nó so với các bản dịch tham chiếu bằng cách sử dụng [hệ thống đánh giá (eval harness)](https://github.com/gamedaysuits/Champollion)
4. Cài đặt nó vào dự án của bạn bằng `champollion plugin install`

Đây là cách champollion xử lý tiếng Plains Cree — và là cách bạn có thể xử lý bất kỳ ngôn ngữ nào, kể cả những ngôn ngữ chưa tồn tại.

---

## Kết luận

Champollion không phải là một công cụ thay thế cho Crowdin. Nó là một công cụ khác dành cho một quy trình làm việc khác. Nếu bạn cần dịch giả con người, hãy sử dụng một TMS. Nếu bạn cần một công cụ CLI dịch các tệp của mình chỉ bằng một lệnh duy nhất và cho phép bạn kiểm soát các phương thức, mô hình và văn phong theo từng ngôn ngữ — hãy sử dụng champollion.
