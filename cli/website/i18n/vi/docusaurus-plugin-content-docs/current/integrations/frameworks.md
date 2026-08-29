# Hướng dẫn Tích hợp

Hướng dẫn thiết lập từng bước cho Champollion với các framework phổ biến.

---

## Thiết lập API Key

Trước khi tích hợp với bất kỳ framework nào, bạn cần có API key dịch thuật. Champollion hỗ trợ hai nhà cung cấp:

### Tùy chọn A: OpenRouter (khuyên dùng)

[OpenRouter](https://openrouter.ai) cung cấp một API hợp nhất cho hơn 200 mô hình LLM. Có sẵn gói miễn phí.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Phù hợp nhất cho: các dự án nhiều nội dung, dịch thuật Markdown, và các dự án cần bảo vệ nội dung theo ngữ cảnh (khối mã, shortcode, biến nội suy).

### Tùy chọn B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Phù hợp nhất cho: các cặp chuỗi key-value số lượng lớn (194 ngôn ngữ). **Không khuyên dùng** cho nội dung Markdown — Google Translate không nhận biết được các khối mã, shortcode, hoặc biến nội suy.

Để sử dụng Google Translate một cách rõ ràng:

```bash
champollion sync --method google-translate
```

> **Mẹo**: Nếu chỉ có `GOOGLE_TRANSLATE_API_KEY` được thiết lập (không có key OpenRouter), Champollion sẽ tự động chuyển sang Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Cấu trúc dự án

Hugo sử dụng `i18n/` cho các bản dịch chuỗi và `content/` cho nội dung trang:

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### Thiết lập

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Tạo `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### Chi tiết dịch thuật nội dung

**Front matter**: Hỗ trợ cả dấu phân cách YAML (`---`) và TOML (`+++`). Dịch các trường `title`, `description`, `summary`, `subtitle`, `caption`, và `linkTitle` theo mặc định. Tất cả các trường khác (date, draft, tags, weight, slug, v.v.) đều được giữ nguyên. Tùy chỉnh bằng `translatableFields` trong cấu hình của bạn.

**Bảo vệ khối**: Các khối mã, Hugo shortcode (`{{< >}}`, `{{% %}}`), mã inline và HTML thô sẽ tự động được bảo vệ bằng các trình giữ chỗ Unicode sentinel. Chúng sẽ được giữ nguyên vẹn.

**Quy ước đặt tên tệp**: Tuân theo mô hình dịch-theo-tên-tệp của Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (loại bỏ hậu tố nguồn)

**Bỏ qua tệp đã có**: Các tệp đã dịch hiện có sẽ không bao giờ bị ghi đè. Hãy xóa tệp đích để bắt buộc dịch lại.

### Dạng số nhiều

Các tệp ngôn ngữ TOML và YAML hỗ trợ các dạng số nhiều CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Được biểu diễn nội bộ dưới dạng `items.one` and `items.other` để so sánh sự khác biệt (diffing), sau đó được tuần tự hóa lại thành định dạng phân đoạn chính xác khi ghi.

---

## next-intl (JSON)

### Cấu trúc dự án

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### Thiết lập

```bash
npm install --save-dev champollion
```

Tạo `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": ["fr", "de", "ja", "es", "ko", "zh", "pt", "ar"]
}
```

```bash
npx champollion sync
```

Tạo ra `messages/fr.json`, `messages/ja.json`, v.v. — được dịch hoàn toàn, giữ nguyên cấu trúc key lồng nhau của bạn. next-intl sẽ tự động nhận diện chúng.

### Quy trình phát triển

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next (JSON)

### Cấu trúc tệp phẳng (khuyên dùng)

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### Cấu trúc thư mục lồng nhau

Nếu bạn sử dụng cấu trúc `{locale}/{namespace}.json`, hãy tạo một script đồng bộ để làm phẳng (flatten) → dịch (translate) → khôi phục cấu trúc lồng nhau (unflatten). Xem [tài liệu react-i18next](https://react.i18next.com/) để biết thêm chi tiết.
