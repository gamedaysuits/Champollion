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
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Bắt đầu nhanh

Dịch tệp ngôn ngữ (locale) đầu tiên của bạn trong 60 giây.

## 1. Thiết lập các tệp ngôn ngữ

Tạo một tệp locale nguồn. Champollion hỗ trợ JSON, TOML, YAML và nhiều định dạng khác — xem [tài liệu tham khảo CLI](/docs/reference/cli) để biết danh sách đầy đủ:

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

## 2. Thiết lập API Key

Chọn một nhà cung cấp và thiết lập key:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

Nhận key Gemini miễn phí tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Nhận key OpenRouter tại [openrouter.ai](https://openrouter.ai).

## 3. Chạy đồng bộ (Sync)

```bash
npx champollion sync
```

:::tip[Sử dụng Gemini?]
Nếu bạn chọn Tùy chọn B (Gemini), hãy thêm `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion sẽ:
1. Tự động phát hiện `locales/en.json` làm nguồn
2. Tìm (hoặc yêu cầu nhập) các ngôn ngữ đích
3. Dịch tất cả các key
4. Ghi vào `locales/fr.json`, `locales/ja.json`, v.v.
5. Tạo `.champollion.lock` để theo dõi những gì đã được dịch

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

Khi bạn thay đổi một chuỗi nguồn, Champollion sẽ phát hiện thay đổi đó thông qua việc theo dõi mã băm SHA-256 và chỉ dịch lại key đó trong lần đồng bộ tiếp theo:

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

Key không thay đổi (`hero.subtitle`) sẽ được lấy từ bộ nhớ đệm **Translation Memory** (Bộ nhớ dịch thuật) của Champollion — không cần gọi API, không tốn chi phí. Bộ nhớ đệm được xây dựng tự động trong mỗi lần đồng bộ và được lưu trữ tại `.champollion/tm.json`.

## Tùy chọn: Tạo tệp cấu hình

Để kiểm soát nhiều hơn, hãy tạo một tệp cấu hình:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

Trình hướng dẫn từng bước sẽ dẫn dắt bạn qua các **register presets** (thiết lập sẵn về văn phong) của từng ngôn ngữ — các hướng dẫn về giọng điệu/mức độ trang trọng được xây dựng sẵn và tinh chỉnh phù hợp với hệ thống ngôn ngữ đó. Tiếng Pháp có các thiết lập sẵn T-V (vouvoiement so với tutoiement), tiếng Hàn có các cấp độ kính ngữ (해요체 so với 합쇼체 so với 해체), tiếng Nhật có các tùy chọn keigo (です/ます so với 丁寧語).

Hoặc tạo tệp cấu hình thủ công với các key thiết lập sẵn:

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
  "model": "google/gemini-2.5-flash"
}
```

Chạy `npx champollion init` để duyệt qua các thiết lập sẵn có cho từng ngôn ngữ.

## Tùy chọn: Chế độ Watch (Theo dõi)

Tự động dịch khi tệp nguồn của bạn thay đổi:

```bash
npx champollion watch
```

## Các bước Tiếp theo

- **[Cấu hình](/docs/getting-started/configuration)** — Tài liệu tham khảo cấu hình đầy đủ
- **[Phương thức dịch](/docs/guides/translation-methods)** — Chọn phương thức phù hợp cho từng cặp ngôn ngữ
- **[Translation Memory](/docs/concepts/translation-memory)** — Cách bộ nhớ đệm giúp bạn tiết kiệm chi phí khi chạy lại
- **[Làm việc với biên dịch viên chuyên nghiệp](/docs/guides/professional-translators)** — Xuất tệp XLIFF để con người soát lỗi
- **[Tích hợp Framework](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Tự động hóa việc dịch thuật trong pipeline của bạn
- **[Xử lý sự cố](/docs/guides/troubleshooting)** — Các vấn đề thường gặp và giải pháp
