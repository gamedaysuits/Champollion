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

CLI này miễn phí cho mục đích sử dụng phi thương mại theo
[Giấy phép Phi thương mại PolyForm 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); việc sử dụng cho mục đích thương mại không nằm trong phạm vi
của giấy phép này. Một trường học, một bệnh viện hoặc phòng khám công, một tổ chức từ thiện hoặc một dự án cá nhân đều được áp dụng; trang bán hàng của một cửa hàng
thì không. Trang [Ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this) sẽ giải thích đầy đủ chi tiết.

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

## 2. Thiết lập API Key

Chọn một nhà cung cấp và thiết lập key:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Lấy khóa Gemini miễn phí tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Lấy khóa OpenRouter tại [openrouter.ai](https://openrouter.ai). Đối với tùy chọn C, hãy chỉ định mô hình của bạn khi thiết lập dự án: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (hoặc chạy `sync --method local --model llama3.1`).

## 3. Chạy đồng bộ (Sync)

```bash
npx champollion sync
```

:::note[Do bạn tự nhập hay được chạy bằng script?]
Các lệnh trên trang này là những lệnh bạn tự nhập: `npx champollion` chạy bản cài đặt trong dự án của bạn, hoặc bản mà npx tải về — bản phát hành mới nhất ở lần đầu tiên, sau đó là bản sao đã lưu trong cache. Một lệnh do script chạy cho bạn — CI, một script `package.json`, một git hook — nên chỉ định phiên bản cụ thể, `npx --yes champollion@0.5 sync`, để bản phát hành mới không bao giờ làm thay đổi những gì bản build đang chạy (và `--yes` ngăn npx dừng lại để hỏi). [Hướng dẫn CI](/docs/guides/ci-cd) và [các trang framework](/docs/integrations/frameworks) ghim phiên bản theo cách đó.
:::

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

Khóa không thay đổi (`hero.subtitle`) sẽ bị **bỏ qua**: bản dịch của nó đã có trong `locales/fr.json`, vì vậy nó không được gửi đi đâu và thậm chí không cần tra cứu — không có lệnh gọi, không tốn chi phí, và không được tính vào con số "được phân phát từ bộ nhớ cache" của lượt chạy.

**Bộ nhớ dịch** (`.champollion/tm.json`, được tạo tự động trong mỗi lần đồng bộ) dành cho văn bản *được* đưa vào hàng đợi: một chuỗi bạn đổi lại như cũ, cùng một câu trong một tệp khác, một lần dịch lại toàn bộ ngôn ngữ (`sync --redo all`). Những nội dung đó được phân phát miễn phí từ bộ nhớ cache, và dòng thông tin lượt chạy sẽ cho biết số lượng (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Bộ nhớ cache được lưu riêng theo từng phương thức, văn phong (register) và hướng dẫn (coaching) — riêng cho từng cặp ngôn ngữ và phương án dự phòng của nó. Sau khi chuyển đổi phương thức (ví dụ `local` → `llm`), hoặc thay đổi nội dung của tệp hướng dẫn (trên cặp ngôn ngữ, ngôn ngữ của nó hoặc phương án dự phòng), sẽ không có gì được tái sử dụng và lượt chạy sẽ nêu rõ lý do; nếu chỉ thay đổi mô hình thì vẫn tái sử dụng các bản dịch trước đó. Bản thân một thay đổi không tự động dịch lại bất cứ thứ gì: `sync` nêu rõ lượt làm lại và chi phí của nó.

## Tùy chọn: Tạo tệp cấu hình

Để kiểm soát nhiều hơn, hãy tạo một tệp cấu hình:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` và `--model` chọn phương thức dịch và mô hình (`npx champollion init --help` liệt kê các phương thức); init sẽ in ra những mục mà cấu hình đang sử dụng.

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
  "model": "google/gemini-3.8-flash"
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
