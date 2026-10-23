---
sidebar_position: 2
title: "Bắt đầu nhanh"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Bắt đầu nhanh

Dịch tệp ngôn ngữ đầu tiên của bạn trong 60 giây.

CLI này được dùng miễn phí cho mục đích phi thương mại theo
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); giấy phép này không áp dụng cho
mục đích thương mại. Một trường học, một bệnh viện hoặc phòng khám công, một tổ chức từ thiện hay một dự án cá nhân đều được phép; trang bán hàng của một cửa hàng
thì không. Trang [Ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this) giải thích đầy đủ về điều này.

## 1. Thiết lập các tệp ngôn ngữ

Tạo một tệp ngôn ngữ nguồn. Champollion hỗ trợ JSON, TOML, YAML và nhiều định dạng khác — xem [tài liệu tham khảo CLI](/docs/reference/cli) để biết danh sách đầy đủ:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Thiết lập khóa API

Chọn một nhà cung cấp và thiết lập khóa:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Nhận khóa Gemini miễn phí tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Nhận khóa OpenRouter tại [openrouter.ai](https://openrouter.ai). Với lựa chọn C, hãy chỉ định tên mô hình khi bạn thiết lập dự án: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (hoặc chạy `sync --method local --model llama3.1`).

## 3. Chạy Sync

```bash
npx champollion sync
```

:::note[Bạn tự gõ hay do script chạy?]
Các lệnh trên trang này là những lệnh do bạn tự gõ: `npx champollion` sẽ chạy bản sao mà dự án của bạn đã cài đặt, hoặc bản mà npx tải về — là bản phát hành mới nhất ở lần đầu tiên, rồi sau đó là bản sao đã lưu trong cache. Còn một lệnh mà script chạy thay bạn — như CI, một script `package.json`, hay một git hook — nên chỉ định rõ phiên bản, `npx --yes champollion@0.6 sync`, để bản phát hành mới không bao giờ làm thay đổi những gì bản dựng đang chạy (và `--yes` giúp npx không dừng lại để hỏi). [Hướng dẫn CI](/docs/guides/ci-cd) và [các trang framework](/docs/integrations/frameworks) đều ghim phiên bản theo cách đó.
:::

:::tip[Đang dùng Gemini?]
Nếu bạn chọn Lựa chọn B (Gemini), hãy thêm `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion sẽ:
1. Tự động nhận diện `locales/en.json` làm ngôn ngữ nguồn
2. Tìm (hoặc hỏi bạn) các ngôn ngữ đích
3. Dịch tất cả các khóa
4. Ghi ra `locales/fr.json`, `locales/ja.json`, v.v.
5. Tạo `.champollion.lock` để theo dõi những nội dung đã được dịch

## 4. Kiểm tra kết quả

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## Điều gì xảy ra tiếp theo?

Khi bạn thay đổi một chuỗi nguồn, champollion sẽ phát hiện sự thay đổi thông qua việc theo dõi mã băm SHA-256 và chỉ dịch lại khóa đó ở lần đồng bộ tiếp theo:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

Khóa không thay đổi (`hero.subtitle`) được **bỏ qua**: bản dịch của nó đã có sẵn trong `locales/fr.json`, do đó khóa này không bị gửi đi đâu và thậm chí không cần tra cứu — không tốn lệnh gọi, không mất chi phí, và không được tính vào số liệu "được phục vụ từ bộ nhớ đệm" (served from the cache) của lần chạy.

**Bộ nhớ bản dịch** (**Translation Memory** — `.champollion/tm.json`, được tạo tự động trong mỗi lần đồng bộ) dành cho văn bản *được* đưa vào hàng đợi: một chuỗi bạn đổi ngược lại như cũ, cùng một câu xuất hiện ở tệp khác, hay làm lại toàn bộ một ngôn ngữ (`sync --redo all`). Những nội dung đó được lấy từ bộ nhớ đệm hoàn toàn miễn phí, và dòng thông báo của lần chạy sẽ cho biết số lượng (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Bộ nhớ đệm được lưu riêng theo từng phương thức, văn phong và tệp chỉ dẫn (coaching) — cho cả cặp ngôn ngữ lẫn phương án dự phòng (fallback) tương ứng. Sau khi đổi phương thức (chẳng hạn `local` → `llm`), hoặc sửa đổi nội dung tệp chỉ dẫn (trên cặp ngôn ngữ, trên ngôn ngữ đó hoặc trên phương án dự phòng), sẽ không có gì được tái sử dụng và lần chạy sẽ nêu rõ lý do; chỉ riêng việc đổi mô hình thì vẫn tái sử dụng các bản dịch trước đó. Bản thân một thay đổi sẽ không tự động dịch lại bất cứ thứ gì: `sync` nêu rõ thao tác làm lại và chi phí của thao tác đó.

## Tùy chọn: Tạo tệp cấu hình

Để kiểm soát nhiều hơn, hãy tạo một tệp cấu hình:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` và `--model` chọn phương thức dịch và mô hình (`npx champollion init --help` liệt kê các phương thức); lệnh init sẽ in ra những phương thức mà cấu hình đang sử dụng.

Trình hướng dẫn từng bước sẽ dẫn bạn qua các **cấu hình sẵn về văn phong (register presets)** của từng ngôn ngữ — những chỉ dẫn về giọng điệu/mức độ trang trọng được thiết lập sẵn và tinh chỉnh cho phù hợp với hệ thống ngôn ngữ đó. Tiếng Pháp có các preset T-V (vouvoiement so với tutoiement), tiếng Hàn có các mức độ kính ngữ (해요체 so với 합쇼체 so với 해체), tiếng Nhật có các tùy chọn keigo (です/ます so với 丁寧語).

Hoặc tự tạo tệp cấu hình thủ công với các khóa preset:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

Chạy `npx champollion init` để xem các preset hiện có cho từng ngôn ngữ.

## Tùy chọn: Chế độ theo dõi (Watch Mode)

Tự động dịch khi tệp nguồn của bạn thay đổi:

```bash
npx champollion watch
```

## Các bước tiếp theo

- **[Cấu hình](/docs/getting-started/configuration)** — Tài liệu tham khảo cấu hình đầy đủ
- **[Phương thức dịch](/docs/guides/translation-methods)** — Chọn phương thức phù hợp cho từng cặp ngôn ngữ
- **[Bộ nhớ bản dịch](/docs/concepts/translation-memory)** — Cách bộ nhớ đệm giúp bạn tiết kiệm chi phí khi chạy lại
- **[Làm việc với dịch giả chuyên nghiệp](/docs/guides/professional-translators)** — Xuất file XLIFF để người thật duyệt lại
- **[Tích hợp framework](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Tự động hóa bản dịch trong pipeline của bạn
- **[Khắc phục sự cố](/docs/guides/troubleshooting)** — Các vấn đề thường gặp và cách giải quyết
