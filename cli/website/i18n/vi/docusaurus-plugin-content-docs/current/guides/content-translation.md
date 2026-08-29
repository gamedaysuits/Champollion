---
sidebar_position: 5
title: "Dịch thuật nội dung"
---

# Dịch nội dung (Hugo Markdown)

Champollion dịch các tệp Hugo Markdown — cả các trường front matter và nội dung phần thân (body content) — với sự bảo vệ toàn diện cho các khối mã (code block), shortcode và các thành phần cấu trúc.

## Thiết lập

Thiết lập `contentDir` trong cấu hình của bạn để kích hoạt tính năng dịch nội dung Markdown:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## Những gì được dịch

### Front Matter

Cả hai dấu phân cách YAML (`---`) và TOML (`+++`) đều được hỗ trợ. Theo mặc định, các trường sau sẽ được dịch:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Tất cả các trường khác (`date`, `draft`, `tags`, `weight`, `slug`, v.v.) được giữ nguyên. Tùy chỉnh bằng `translatableFields` trong cấu hình của bạn.

### Nội dung phần thân

Toàn bộ phần thân Markdown được dịch với tính năng bảo vệ khối — các thành phần cấu trúc được che chắn bằng các trình giữ chỗ sentinel Unicode trước khi dịch và được khôi phục lại sau đó.

## Bảo vệ khối

Các thành phần sau sẽ đi qua quá trình dịch mà không bị thay đổi:

| Thành phần | Ví dụ | Bảo vệ |
|---------|---------|-----------|
| Khối mã (Code blocks) | ``````` ```js ... ``` ``````` | Toàn bộ khối được che chắn |
| Mã nội dòng (Inline code) | `` `variable` `` | Được che chắn |
| Hugo shortcodes | `{{< figure >}}`, `{{% note %}}` | Toàn bộ khối được che chắn |
| HTML thô (Raw HTML) | `<div>`, `<table>` | Được che chắn |
| Liên kết (URLs) | `[text](https://...)` | URL được giữ nguyên, văn bản được dịch |
| Nội suy (Interpolation) | `{{ .Count }}` | Được che chắn |

## Quy ước đặt tên tệp

Tuân theo mẫu dịch theo tên tệp (translation-by-filename) của Hugo:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Hành vi bỏ qua

Các tệp đã dịch hiện có **không bao giờ bị ghi đè**. Nếu `my-post.fr.md` đã tồn tại, nó sẽ bị bỏ qua. Hãy xóa tệp đích để bắt buộc dịch lại.

## Các phương thức chỉ dành cho Markdown

:::warning[Google Translate và Markdown]
Google Translate **không nhận biết** được các khối mã, shortcode, hoặc các biến nội suy. Nó sẽ làm hỏng nội dung Markdown có cấu trúc. Hãy sử dụng các phương pháp LLM (`llm` hoặc `llm-coached`) để dịch nội dung — chúng bảo vệ các thành phần cấu trúc một cách rõ ràng.
:::

Khi quá trình dịch nội dung chuyển hướng dự phòng (fallback) từ Google Translate sang một phương thức LLM, champollion sẽ ghi nhật ký (log) một cảnh báo giải thích lý do.
