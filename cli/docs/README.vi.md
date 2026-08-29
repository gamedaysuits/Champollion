# Champollion

[![phiên bản npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Giấy phép: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


Dịch các tệp locale của bạn chỉ với một lệnh:

```bash
npx champollion sync
```

Champollion tự động phát hiện các tệp locale của bạn, định dạng của chúng và các ngôn ngữ đích. Công cụ này dịch các key còn thiếu, bỏ qua những gì đã hoàn thành và ghi lại kết quả. Chỉ đơn giản vậy thôi.

> **Một phần của Champollion** — cơ sở hạ tầng mã nguồn mở dành cho dịch máy đáng tin cậy trên mọi ngôn ngữ. CLI này là phần triển khai của một dự án lớn hơn nhằm xây dựng các tập dữ liệu kiểm thử và bản đồ cho thấy ai có thể dịch ngôn ngữ nào, mức độ hiệu quả của từng phương pháp trên từng loại văn bản và những khoảng trống nào vẫn còn tồn tại. Dự án chạy trên hai loại benchmark (điểm chuẩn): benchmark công khai trên dữ liệu mở (rộng rãi, chi phí thấp, hoan nghênh mọi phương pháp) và benchmark có chủ quyền — các tập dữ liệu kiểm thử bí mật do các cộng đồng tạo ra, sở hữu và kiểm soát, và chúng tôi không bao giờ nhìn thấy. Cơ sở hạ tầng này là mã nguồn mở và được quản lý độc lập; các tập dữ liệu kiểm thử và phương pháp dành cho ngôn ngữ của một cộng đồng thuộc về chính cộng đồng đó. Được xây dựng cùng với các cộng đồng, không bao giờ thu thập trái phép từ họ — họ là người nắm giữ chìa khóa. Mọi phương pháp đều được hoan nghênh, dù là con người hay máy móc. Khám phá mạng lưới tại [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Tại sao không tự viết script?

Bạn có thể viết một script nhanh để lặp qua các key tiếng Anh của mình và gọi Google Translate. Hầu hết các lập trình viên đều làm vậy — chỉ mất khoảng 30 dòng code. Dưới đây là lý do tại sao cách này dễ gặp lỗi:

- **Không phát hiện thay đổi.** Khi bạn cập nhật một chuỗi tiếng Anh, bản dịch sẽ bị lỗi thời vĩnh viễn. Champollion theo dõi mọi giá trị nguồn bằng mã băm SHA-256 và chỉ dịch lại những gì đã thay đổi.
- **Không gom nhóm (batching).** Một lệnh gọi API cho mỗi key có nghĩa là 200 key = 200 vòng lặp request. Champollion gom nhóm một cách thông minh (có thể cấu hình, mặc định 80 key/nhóm đối với LLM, 128 đối với Google).
- **Không kiểm soát chất lượng.** Dịch máy có thể bị ảo giác (hallucinate), lặp lại nguyên văn bản nguồn hoặc xuất ra sai hệ thống chữ viết (script). Champollion xác thực mọi bản dịch trước khi ghi — các lỗi sai hệ thống chữ viết, độ dài tăng bất thường và lặp lại bản nguồn đều bị phát hiện và loại bỏ.
- **Không nhận biết định dạng.** Bị hardcode cho JSON? Champollion xử lý JSON, TOML, YAML và Hugo Markdown (frontmatter + phần thân) với khả năng tự động phát hiện.
- **Không an toàn.** Champollion bảo vệ khỏi prototype pollution (ô nhiễm nguyên mẫu), path traversal (duyệt đường dẫn) thông qua các mã locale bị thao túng và lỗi hỏng code block trong quá trình dịch Markdown.

Champollion là phiên bản production của script đó.

> [!NOTE]
> **Những gì Champollion dịch.** Champollion nhắm đến **các tệp locale và nội dung có cấu trúc** — các cặp key-value JSON, cấu hình TOML/YAML, các trang Hugo Markdown, tài liệu trao đổi XLIFF. Công cụ này được tối ưu hóa cho văn bản viết trang trọng: chuỗi UI, tài liệu, thông tin liên lạc chính thức, tài liệu giáo dục. Đây không phải là chatbot, trình dịch giọng nói theo thời gian thực hay AI đàm thoại đa dụng. Đối với mỗi cặp ngôn ngữ, phương pháp dịch đều có thể cấu hình — từ các API thương mại (Google Translate, DeepL) đến các plugin do cộng đồng phát triển được đánh giá benchmark qua [MT Eval Arena](https://champollion.dev/arena).

## Bắt đầu nhanh

```bash
npm install --save-dev champollion
```

### Lấy API Key

Champollion cần một backend dịch thuật. Hãy chọn một:

| Nhà cung cấp | Key | Phù hợp nhất cho |
|----------|-----|----------|
| **OpenRouter** (khuyên dùng) | `OPENROUTER_API_KEY` | Các dự án nhiều nội dung, Markdown, hơn 200 model |
| **OpenAI** | `OPENAI_API_KEY` | Truy cập trực tiếp GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Truy cập trực tiếp Claude |
| **Gemini** | `GEMINI_API_KEY` | Có gói miễn phí |
| **DeepL** | `DEEPL_API_KEY` | Các ngôn ngữ châu Âu, hỗ trợ thuật ngữ (glossary) |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | Hơn 130 ngôn ngữ, khối lượng lớn |

**Bắt đầu nhanh nhất** (miễn phí): Đăng ký tại [aistudio.google.com](https://aistudio.google.com/apikey) để nhận key Gemini miễn phí:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (hơn 200 model): Đăng ký tại [openrouter.ai](https://openrouter.ai), sau đó:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

Giải pháp thay thế **Google Translate** (chỉ dành cho các cặp key-value — không nhận biết Markdown):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Lưu ý**: Nếu chỉ thiết lập `GOOGLE_TRANSLATE_API_KEY`, champollion sẽ tự động chuyển sang Google Translate. Không cần thay đổi cấu hình. Sử dụng trực tiếp REST API — không cần SDK, không cần service account, không cần `pip install`. Chỉ cần key.

Chỉ vậy thôi. Để kiểm soát nhiều hơn, hãy tạo một tệp cấu hình:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Mỗi ngôn ngữ đi kèm với **các preset ngữ vực (register presets)** — các hướng dẫn về giọng điệu/độ trang trọng được xây dựng sẵn và tinh chỉnh cho hệ thống ngôn ngữ đó (vouvoiement cho tiếng Pháp, Siezen cho tiếng Đức, です/ます cho tiếng Nhật, 해요체 cho tiếng Hàn). Trình hướng dẫn khởi tạo (init wizard) cho phép bạn duyệt và chọn các preset, hoặc truyền `--yes` để chấp nhận các giá trị mặc định.

### Nguồn không phải tiếng Anh

Nếu ngôn ngữ nguồn của bạn không phải là tiếng Anh:

```bash
champollion sync --source fr                      # CLI flag
```

Hoặc thiết lập cố định trong cấu hình của bạn:

```json
{ "inputLocale": "fr" }
```

## Chức năng

Bạn xử lý i18n framework (next-intl, i18next, Hugo). Champollion xử lý các tệp dịch thuật.

- **Đa định dạng** — JSON, TOML, YAML, Hugo Markdown (front matter + phần thân) và XLIFF 1.2
- **Tăng dần (Incremental)** — Chỉ dịch những gì đã thay đổi (theo dõi bằng mã băm SHA-256)
- **Lưu cache** — Bộ nhớ dịch thuật (Translation Memory) lưu trữ các kết quả trước đó; việc chạy lại đồng bộ hóa không tốn chi phí cho các key không thay đổi
- **Kiểm soát chất lượng** — Xác thực mọi bản dịch: phát hiện ảo giác, đầu ra sai hệ thống chữ viết, lặp lại bản nguồn và độ dài tăng bất thường
- **Nhận biết nội dung** — Các phương pháp LLM bảo vệ code block, shortcode, liên kết và biến nội suy trong quá trình dịch Markdown
- **Công cụ pipeline** — `lint`, `audit`, `integrity`, `seo` cho các cổng CI (CI gates)
- **Tương tác XLIFF** — Xuất các bản dịch để đánh giá chuyên môn trong các công cụ CAT (memoQ, SDL Trados, Phrase), sau đó nhập chúng trở lại
- **Tối thiểu dependency** — hai dependency lúc chạy (better-sqlite3 cho cơ sở dữ liệu ngôn ngữ đi kèm, tên locale CLDR); không có SDK của nhà cung cấp. Yêu cầu Node 20+

## Vượt xa Google Translate

Phần bắt đầu nhanh giúp bạn chạy với một LLM hoặc Google Translate. Nhưng Google Translate chỉ hỗ trợ khoảng 130 ngôn ngữ. Trong khi có tới hơn 7.000 ngôn ngữ trên thế giới.

**Ý tưởng cốt lõi của Champollion: phương pháp dịch có thể cấu hình cho từng cặp ngôn ngữ.** Sử dụng Google Translate cho tiếng Pháp, một LLM với huấn luyện hình thái học (morphological coaching) cho tiếng Plains Cree và một API do cộng đồng lưu trữ cho tiếng Quechua — tất cả trong cùng một dự án, tất cả với cùng một CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Nếu bạn có thể tìm ra cách dịch một cặp ngôn ngữ — thông qua prompt engineering, từ điển cộng đồng, pipeline FST hoặc các model được tinh chỉnh (fine-tuned) — champollion cho phép bạn đóng gói phương pháp đó thành một plugin và triển khai nó cùng với mọi thứ khác.

> Ra đời từ việc dịch một trang web production sang tiếng Plains Cree, nơi không có sẵn API thương mại nào. Kiến trúc theo từng cặp ngôn ngữ không phải là lý thuyết — nó tồn tại vì một dự án cần Google Translate cho tiếng Pháp và một pipeline FST được huấn luyện cho một ngôn ngữ bản địa, chạy song song trong cùng một lệnh đồng bộ hóa.

Công cụ đi kèm [MT Eval Harness](https://github.com/gamedaysuits/Champollion) cho phép bạn đánh giá benchmark và so sánh các phương pháp dịch, sau đó xuất các phương pháp hiệu quả thành plugin champollion. Bất kỳ ai nói được cả hai ngôn ngữ đều có thể phát triển, kiểm thử và chia sẻ một phương pháp dịch — không yêu cầu nền tảng độc quyền.

### Chọn phương pháp của bạn

Champollion hỗ trợ 10 phương pháp dịch. Mỗi cặp ngôn ngữ có thể sử dụng một phương pháp khác nhau.

**Các nhà cung cấp LLM** — tốt nhất về chất lượng, nhận biết Markdown, tương thích với huấn luyện (coaching):

| Phương pháp | Key | Chức năng |
|--------|-----|-------------|
| `llm` (mặc định) | `OPENROUTER_API_KEY` | LLM qua OpenRouter — hơn 200 model, tự động định tuyến |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + quy tắc ngữ pháp, từ điển, ghi chú văn phong |
| `openai` | `OPENAI_API_KEY` | API OpenAI trực tiếp (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API Anthropic trực tiếp (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API Google Gemini trực tiếp (Flash, Pro) — có gói miễn phí |

**Dịch máy (MT) truyền thống** — tốt nhất về tốc độ, chi phí và các cặp key-value khối lượng lớn:

| Phương pháp | Key | Chức năng |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (hơn 130 ngôn ngữ) |
| `deepl` | `DEEPL_API_KEY` | DeepL API có hỗ trợ thuật ngữ (hơn 30 ngôn ngữ) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (hơn 100 ngôn ngữ) |
| `libretranslate` | *(tự lưu trữ)* | LibreTranslate tự lưu trữ (AGPL, miễn phí) |

**Cơ sở hạ tầng** — dành cho các endpoint tùy chỉnh hoặc do cộng đồng lưu trữ:

| Phương pháp | Key | Chức năng |
|--------|-----|-------------|
| `api` | *(theo nhà cung cấp)* | Thin HTTP client cho bất kỳ REST endpoint nào |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **Lưu ý**: Các phương pháp dịch máy truyền thống (Google Translate, DeepL, Microsoft Translator, LibreTranslate) xử lý tốt các cặp key-value nhưng không thể dịch nội dung Markdown một cách an toàn. Đối với các dự án nhiều nội dung, các phương pháp LLM được khuyên dùng — chúng bảo vệ rõ ràng các code block, shortcode và biến nội suy.

## Plugin

Plugin là các công thức dịch được đóng gói sẵn cho các cặp ngôn ngữ cụ thể. Chúng là các manifest JSON — không phải code — cho champollion biết nên sử dụng phương pháp nào, với cài đặt ra sao và chất lượng nào đã được đánh giá benchmark.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

Xem [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) để biết định dạng manifest.

## Các lệnh

| Lệnh | Mục đích |
|---------|---------|
| `init` | Trình hướng dẫn thiết lập tương tác (hoặc `--yes` để dùng nhanh các mặc định) |
| `sync` | Dịch & đồng bộ hóa tất cả các tệp locale |
| `watch` | Tự động đồng bộ hóa khi có thay đổi tệp |
| `audit` | Gắn cờ các locale chưa hoàn thiện (cổng CI) |
| `card` | In đẹp thẻ ngôn ngữ (language card) (`card <code>`, `--json` cho dạng thô) |
| `register-corpus` | Đăng ký một kho ngữ liệu đánh giá: chọn giấy phép + mức độ hiển thị (chỉ cục bộ/riêng tư/công khai/niêm phong) |
| `submit` | Đề xuất một mục chỉ mục (yêu cầu phê duyệt) — in ra một GitHub issue đã điền sẵn |
| `lint` | Tìm các chuỗi hardcode trong mã nguồn |
| `status` | Hiển thị cấu hình cặp ngôn ngữ, phương pháp, ngữ vực và các cấp độ chất lượng |
| `provenance` | Kiểm tra giấy phép tài nguyên dịch thuật |
| `wrap` | Tự động bọc các chuỗi hardcode trong các lệnh gọi `t()` (có hỗ trợ hoàn tác) |
| `seo` | Tạo hreflang, sitemap.xml hoặc schema JSON-LD |
| `integrity` | Kiểm tra lỗi hỏng placeholder, mã hóa và tính hoàn thiện của số nhiều ICU |
| `plugin` | Cài đặt, gỡ bỏ hoặc liệt kê các plugin phương pháp |
| `fonts` | Tải xuống web font cho các bộ chuyển đổi hệ thống chữ viết PUA |
| `tm` | Quản lý cache Bộ nhớ dịch thuật (thống kê, xóa, theo từng locale) |
| `xliff` | Xuất/nhập XLIFF 1.2 để người dịch chuyên nghiệp đánh giá |
| `models` | Liệt kê các model khả dụng cho một nhà cung cấp (`--method gemini`) |
| `verify` | Đọc lại các tệp locale đã ghi và xác nhận các bản dịch có mặt và chính xác (cổng CI) |
| `leaderboard` | Hiển thị bảng xếp hạng MT (`--pair`, `--sort`, `--install N`) |
| `doctor` | Kiểm tra tình trạng hệ thống: thẻ, cấu hình, phương pháp và bộ chuyển đổi |

Chạy `champollion <command> --help` để xem trợ giúp chi tiết về bất kỳ lệnh nào.

Tài liệu tham khảo đầy đủ: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Cổng Pre-commit

`champollion lint` được xây dựng để làm cổng commit (commit gate): nó thoát với mã `1` khi tìm thấy các chuỗi hardcode hiển thị cho người dùng và `0` khi sạch (`--warn-only` báo cáo mà không chặn). Hãy kết nối nó vào thư mục hooks được theo dõi trong dự án của bạn:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Hoặc kích hoạt nó từ [lint-staged](https://github.com/lint-staged/lint-staged) để nó chỉ chạy khi các tệp nguồn được đưa vào stage:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Không đưa `champollion sync` vào pre-commit — nó thực hiện các lệnh gọi API mạng, do đó tốt nhất là nó sẽ chậm và tệ nhất là chặn các commit khi ngoại tuyến. Thay vào đó, hãy chạy nó trong CI hoặc pre-push hook, với `champollion audit` / `champollion verify` làm cổng kiểm tra.

## Cấu hình

Tạo `champollion.config.json` hoặc chạy `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Tùy chọn | Mặc định | Mô tả |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Mã ngôn ngữ nguồn |
| `localesDir` | `"./locales"` | Đường dẫn đến các tệp locale |
| `contentDir` | `null` | Thư mục nội dung Hugo (kích hoạt dịch Markdown) |
| `format` | `"auto"` | Định dạng tệp: `json`, `toml`, `yaml`, hoặc `auto` |
| `model` | `"google/gemini-3.5-flash"` | Model mặc định (slug của OpenRouter). Các nhà cung cấp trực tiếp tự phân giải mặc định của họ lúc chạy. Chạy `champollion models --method gemini` để khám phá các model khả dụng. |
| `defaultMethod` | `"llm"` | Phương pháp dịch mặc định (bị ghi đè bởi cờ `--method`) |
| `batchSize` | `80` | Số key mỗi nhóm dịch (batch) |
| `pairs` | `{}` | Ghi đè phương pháp, model và chất lượng theo từng cặp ngôn ngữ |

**Ghi đè theo từng ngôn ngữ**: Mỗi ngôn ngữ có một [Thẻ ngôn ngữ (Language Card)](../website/docs/reference/language-card-spec.md) — một trong 50 thẻ được tuyển chọn chứa các preset ngữ vực, hệ thống độ trang trọng, quy tắc đánh máy và cờ hỗ trợ phương pháp. Các thẻ sử dụng [kiến trúc hai tầng](../website/docs/concepts/architecture.md) (runtime + reference) để đảm bảo hiệu suất ở quy mô lớn. Tạo khung (scaffold) một thẻ mới bằng `node scripts/generate-language-card.mjs <code>`. Sử dụng các key preset làm cách viết tắt, hoặc viết văn bản ngữ vực tùy chỉnh:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**Chế độ không cần cấu hình (Zero-config)**: Không có tệp cấu hình? Champollion tự động phát hiện các tệp locale, định dạng và ngôn ngữ đích từ dự án của bạn.

Các giá trị ngôn ngữ có thể là một key preset (ví dụ: `"casual-tu"`), văn bản ngữ vực tùy chỉnh hoặc một object (kiểm soát toàn diện). Các ghi đè cấp độ cặp ngôn ngữ trong `pairs` được ưu tiên hơn các cài đặt cấp độ ngôn ngữ. Chạy `npx champollion init` để duyệt các preset khả dụng cho mỗi ngôn ngữ.

Xem [Tài liệu tham khảo CLI](../website/docs/reference/cli.md) để biết chi tiết thiết lập cụ thể cho từng framework.

## Đầu ra CLI

Khi bạn chạy `sync`, champollion hiển thị chính xác những gì đang diễn ra:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Thanh tiến trình cập nhật tại chỗ khi mỗi nhóm (batch) hoàn thành (~80 key mỗi lần cập nhật). Tính năng phát hiện framework hiển thị `Hugo` khi `contentDir` được thiết lập. Tính năng phát hiện định dạng phân biệt `(auto)` với `(config)` để làm rõ cách định dạng được phân giải.

**Các chế độ đầu ra**: `--quiet` chặn đầu ra thông tin (chỉ hiển thị lỗi và cảnh báo). `--json` phát ra NDJSON mà máy có thể đọc được cho các pipeline CI/CD.

## Tăng cường (Hardening)

- **Exponential backoff** — Thử lại 3 lần với độ trễ ngẫu nhiên (jitter) khi gặp lỗi 429/5xx
- **Timeout request 30 giây** — AbortController ngăn chặn tình trạng treo
- **Xác thực phản hồi** — chỉ chấp nhận các key đã được gửi đi dịch
- **Kiểm soát chất lượng** — phát hiện các vòng lặp ảo giác, đầu ra sai hệ thống chữ viết, độ dài tăng bất thường và lặp lại bản nguồn
- **Thử lại theo tầng (Retry cascade)** — khi phân tích cú pháp JSON thất bại, thử lại toàn bộ nhóm → nửa nhóm → từng key riêng lẻ (giới hạn ngân sách qua `maxRetries`)
- **Bộ nhớ dịch thuật (Translation Memory)** — `.champollion/tm.json` lưu cache các bản dịch được khóa bằng văn bản nguồn + locale + phương pháp; các key không thay đổi được phục vụ từ cache trong các lần đồng bộ hóa tiếp theo, loại bỏ các lệnh gọi API dư thừa
- **Lưu cache prompt** — việc tách biệt tin nhắn system/user cho phép lưu cache ở cấp độ nhà cung cấp, giảm chi phí token trên các nhóm
- **Thực thi thuật ngữ** — các bản dịch được huấn luyện sẽ được xác minh đối chiếu với các thuật ngữ trong từ điển sau khi LLM phản hồi
- **Bảo vệ khỏi prototype pollution** — chặn `__proto__`, `constructor`, `prototype`
- **Kiểm soát đường dẫn** — việc ghi tệp được xác thực để luôn nằm trong các thư mục đã cấu hình
- **Bảo vệ block** — code block, shortcode, HTML được bảo vệ trong quá trình dịch nội dung
- **Kiến trúc Fail-loud** — các lỗi dịch thuật luôn ném ra ngoại lệ với thông báo lỗi có thể xử lý được, không bao giờ âm thầm ghi ra dữ liệu rác
- **Xác minh sau đồng bộ hóa** — lệnh `verify` đọc lại các tệp đã ghi và xác nhận các bản dịch có mặt, đúng hệ thống chữ viết và giữ nguyên placeholder
- **Thành công một phần** — một nhóm thất bại không chặn các nhóm còn lại

## Kiểm thử

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Tối thiểu dependency** — xem ở trên.

## Giấy phép

Apache-2.0. Champollion CLI là mã nguồn mở — miễn phí cài đặt, sử dụng, sửa đổi và phân phối lại theo các điều khoản của [Giấy phép Apache, Phiên bản 2.0](../LICENSE). Gói npm `champollion` được xuất bản theo giấy phép Apache-2.0; `cli/LICENSE` là giấy phép có thẩm quyền cho gói được phân phối. Công cụ đi kèm MT Eval Harness và các đặc tả cũng là mã nguồn mở, được cấp phép theo AGPL-3.0-or-later — với ngoại lệ §7 eval-standard-plugin — tại [kho lưu trữ harness](https://github.com/gamedaysuits/Champollion) công khai.
