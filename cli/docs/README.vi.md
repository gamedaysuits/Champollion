# Champollion

[![phiên bản npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Giấy phép: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**Phát triển theo khuôn khổ, với các rào chắn bảo vệ.** Phát triển và triển khai dịch máy theo khuôn khổ (on rails), được xây dựng với sự quan tâm đến các cộng đồng ngôn ngữ bản địa và có ít tài nguyên. CLI này là lớp dự án và triển khai.

**Xây dựng mô hình cho một ngôn ngữ**, ngay trên máy tính của bạn:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

Một ngôn ngữ không có mã tiêu chuẩn sẽ sử dụng mã sử dụng nội bộ (private-use code) và tên riêng của nó:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(bất kỳ mã nào từ `qaa` đến `qtz`).

`champollion new` khởi tạo một dự án với không gian lưu trữ cho mọi thứ;
`champollion next` chỉ ra bước tiếp theo — từ các tệp mà cộng đồng lưu giữ (bảng tính, bảng Word, từ điển Toolbox hoặc LIFT, bản phiên âm ELAN) đến một mô hình đã được đo lường và đưa vào ứng dụng của bạn. Mỗi bước đều nêu rõ ai là người quyết định: những người nắm giữ ngôn ngữ sẽ quyết định các câu chữ của ngôn ngữ đó có thể đi đến đâu và những gì được phát hành. Một AI agent có thể thực hiện các bước tương tự thông qua
[MCP server](https://www.npmjs.com/package/champollion-mcp-server). Khuôn khổ này đảm bảo về quy trình, chứ không phải chất lượng: bạn sẽ biết một mô hình tốt đến mức nào, chứ không phải mặc định là nó tốt — một mô hình cộng đồng nhỏ gọn đầu tiên thường là một cuốn sách cụm từ (phrasebook) đã được đo lường.
Bắt đầu tại [champollion.dev/start](https://champollion.dev/start).

**Dịch các tệp locale của ứng dụng** chỉ với một lệnh:

```bash
npx champollion sync
```

Champollion tự động phát hiện các tệp locale, định dạng của chúng và các ngôn ngữ đích. Nó dịch các key còn thiếu, bỏ qua những gì đã hoàn thành và ghi lại kết quả — từ một engine được lưu trữ (hosted engine), hoặc từ một mô hình do bạn tự xây dựng và phục vụ (`champollion connect`).

**Giấy phép:** mã nguồn mở (source-available) theo [PolyForm Noncommercial License 1.0.0](../LICENSE) — miễn phí sử dụng, thay đổi và chia sẻ cho các mục đích phi thương mại (dự án cá nhân, nghiên cứu, giảng dạy và sử dụng bởi các tổ chức từ thiện, trường học và cơ quan công quyền). Việc sử dụng cho mục đích thương mại không nằm trong phạm vi của giấy phép này. Evaluation harness là mã nguồn mở (AGPL-3.0-or-later). [Ai có thể sử dụng](https://champollion.dev/docs/getting-started/who-may-use-this) · [Chi tiết](#license).

## Tại sao không tự viết script?

Bạn có thể viết một script nhanh để lặp qua các key tiếng Anh và gọi Google Translate. Hầu hết các nhà phát triển đều làm vậy — chỉ mất khoảng 30 dòng code. Dưới đây là lý do tại sao cách này dễ gặp lỗi:

- **Không phát hiện thay đổi.** Khi bạn cập nhật một chuỗi tiếng Anh, bản dịch cũ sẽ bị kẹt lại mãi mãi. Champollion theo dõi mọi giá trị nguồn bằng mã băm SHA-256 và chỉ dịch lại những gì đã thay đổi.
- **Không gom nhóm (batching).** Một lệnh gọi API cho mỗi key đồng nghĩa với 200 key = 200 vòng lặp mạng. Champollion gom nhóm một cách thông minh (có thể cấu hình, mặc định 80 key/nhóm cho LLM, 128 cho Google).
- **Không có cổng kiểm soát chất lượng (quality gate).** Dịch máy có thể bị ảo giác (hallucinate), lặp lại nguyên văn bản nguồn hoặc xuất ra sai hệ chữ viết. Champollion kiểm tra mọi bản dịch trước khi ghi — đầu ra trống, lặp lại bản nguồn, vòng lặp vô tận, độ dài tăng bất thường, nội dung bị xóa và sai hệ chữ viết đều bị phát hiện và từ chối. Cổng kiểm soát này bắt các lỗi đầu ra bị hỏng, chứ không phải lỗi sai ý nghĩa.
- **Không nhận biết định dạng.** Bị hardcode cho JSON? Champollion xử lý JSON, TOML, YAML và Hugo Markdown (frontmatter + body) với khả năng tự động phát hiện.
- **Không an toàn.** Champollion bảo vệ khỏi prototype pollution, path traversal thông qua các mã locale bị thao túng và lỗi hỏng khối mã (code block) trong quá trình dịch Markdown.

Champollion là phiên bản production của script đó.

> [!NOTE]
> **Những gì Champollion dịch.** Champollion nhắm đến **các tệp locale và nội dung có cấu trúc** — các cặp key-value JSON, cấu hình TOML/YAML, các trang Hugo Markdown, tài liệu trao đổi XLIFF. Nó được tối ưu hóa cho văn bản viết trang trọng: chuỗi UI, tài liệu, thông cáo chính thức, tài liệu giáo dục. Nó không phải là một chatbot, trình dịch giọng nói theo thời gian thực hay AI đàm thoại đa dụng. Đối với mỗi cặp ngôn ngữ, phương pháp dịch có thể được cấu hình — từ các API thương mại (Google Translate, DeepL) đến các plugin do cộng đồng phát triển, các benchmark công khai và các mô hình do bạn tự huấn luyện và phục vụ theo khuôn khổ.

## Bắt đầu nhanh

```bash
npm install --save-dev champollion
```

### Lấy API Key

Champollion cần một backend dịch thuật. Hãy chọn một:

| Nhà cung cấp | Key | Phù hợp nhất cho |
|----------|-----|----------|
| **OpenRouter** (khuyên dùng) | `OPENROUTER_API_KEY` | Các dự án nhiều nội dung, Markdown, hơn 200 mô hình |
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

**OpenRouter** (hơn 200 mô hình): Đăng ký tại [openrouter.ai](https://openrouter.ai), sau đó:

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

### Ngôn ngữ nguồn không phải tiếng Anh

Nếu ngôn ngữ nguồn của bạn không phải là tiếng Anh:

```bash
champollion sync --source fr                      # CLI flag
```

Hoặc thiết lập cố định trong cấu hình của bạn:

```json
{ "inputLocale": "fr" }
```

## Tính năng

Bạn xử lý i18n framework (next-intl, i18next, Hugo). Champollion xử lý các tệp dịch thuật.

- **Đa định dạng** — JSON, TOML, YAML, Hugo Markdown (front matter + body) và XLIFF 1.2
- **Tăng dần (Incremental)** — Chỉ dịch những gì đã thay đổi (theo dõi bằng mã băm SHA-256)
- **Lưu bộ nhớ đệm (Cached)** — Translation Memory lưu trữ các kết quả trước đó; việc chạy lại đồng bộ hóa không tốn phí cho các key không thay đổi
- **Kiểm soát chất lượng (Quality-gated)** — Kiểm tra mọi bản dịch để tìm đầu ra bị hỏng: vòng lặp vô tận, sai hệ chữ viết, lặp lại bản nguồn, độ dài tăng bất thường và nội dung bị xóa (không kiểm tra ý nghĩa)
- **Nhận biết nội dung (Content-aware)** — Các phương pháp LLM bảo vệ các khối mã, shortcode, liên kết và biến nội suy trong quá trình dịch Markdown
- **Công cụ Pipeline** — `lint`, `audit`, `integrity`, `seo` cho các cổng CI
- **Tương tác XLIFF** — Xuất các bản dịch để đánh giá chuyên môn trong các công cụ CAT (memoQ, SDL Trados, Phrase), sau đó nhập chúng trở lại
- **Phụ thuộc tối thiểu** — hai dependency khi chạy: `@translated/lara` (Lara provider SDK) và `cree-sro-syllabics` (trình chuyển đổi Plains Cree SRO ⇄ syllabics của ALTLab/NRC). Yêu cầu Node 20+

## Vượt xa Google Translate

Phần bắt đầu nhanh giúp bạn chạy với một LLM hoặc Google Translate. Nhưng Google Translate chỉ hỗ trợ khoảng 130 ngôn ngữ. Trong khi có hơn 7.000 ngôn ngữ trên thế giới.

**Ý tưởng cốt lõi của Champollion: phương pháp dịch có thể được cấu hình cho từng cặp ngôn ngữ.** Sử dụng Google Translate cho tiếng Pháp, một LLM được huấn luyện với các ghi chú ngữ pháp và từ điển riêng của bạn cho tiếng Plains Cree, và một API do bạn tự lưu trữ cho một ngôn ngữ không có dịch vụ nào hỗ trợ — tất cả trong cùng một dự án, tất cả với cùng một CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Nếu bạn có thể tìm ra cách dịch một cặp ngôn ngữ — thông qua prompt engineering, từ điển cộng đồng, FST pipeline hoặc các mô hình fine-tune — champollion cho phép bạn đóng gói phương pháp đó thành một plugin và triển khai nó cùng với mọi thứ khác.

> Ra đời từ việc dịch một trang web production sang tiếng Plains Cree, nơi không có sẵn API thương mại nào. Kiến trúc theo từng cặp ngôn ngữ không phải là lý thuyết — nó tồn tại vì một dự án cần Google Translate cho tiếng Pháp và một FST pipeline được huấn luyện cho một ngôn ngữ bản địa, chạy song song trong cùng một lệnh đồng bộ hóa.

Công cụ đi kèm [MT Eval Harness](https://github.com/gamedaysuits/Champollion) cho phép bạn benchmark và so sánh các phương pháp dịch, sau đó xuất các phương pháp hiệu quả thành các plugin champollion. Bất kỳ ai nói được cả hai ngôn ngữ đều có thể phát triển, thử nghiệm và chia sẻ một phương pháp dịch — không yêu cầu nền tảng độc quyền.

### Chọn phương pháp của bạn

Champollion hỗ trợ 10 phương pháp dịch. Mỗi cặp ngôn ngữ có thể sử dụng một phương pháp khác nhau.

**Các nhà cung cấp LLM** — tốt nhất về chất lượng, nhận biết Markdown, tương thích với việc huấn luyện (coaching):

| Phương pháp | Key | Tính năng |
|--------|-----|-------------|
| `llm` (mặc định) | `OPENROUTER_API_KEY` | LLM qua OpenRouter — hơn 200 mô hình, tự động định tuyến |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + quy tắc ngữ pháp, từ điển, ghi chú văn phong |
| `openai` | `OPENAI_API_KEY` | API OpenAI trực tiếp (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API Anthropic trực tiếp (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API Google Gemini trực tiếp (Flash, Pro) — có gói miễn phí |
| `local` | *(không có)* | Mô hình riêng của bạn đằng sau một endpoint tương thích với OpenAI (Ollama, vLLM, LM Studio, một mô hình được huấn luyện với `nmt-forge`). Thiết lập `LOCAL_API_BASE` nếu nó không ở mặc định của Ollama. Văn bản không bao giờ rời khỏi cơ sở hạ tầng của bạn |

**Dịch máy truyền thống (Traditional MT)** — tốt nhất về tốc độ, chi phí và các cặp key-value khối lượng lớn:

| Phương pháp | Key | Tính năng |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (hơn 130 ngôn ngữ) |
| `deepl` | `DEEPL_API_KEY` | DeepL API có hỗ trợ thuật ngữ (hơn 30 ngôn ngữ) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (hơn 100 ngôn ngữ) |
| `libretranslate` | *(tự lưu trữ)* | LibreTranslate tự lưu trữ (AGPL, miễn phí) |

**Cơ sở hạ tầng** — dành cho các endpoint tùy chỉnh hoặc do cộng đồng lưu trữ:

| Phương pháp | Key | Tính năng |
|--------|-----|-------------|
| `api` | *(theo nhà cung cấp)* | HTTP client mỏng cho bất kỳ REST endpoint nào |

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
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **Lưu ý**: Các phương pháp dịch máy truyền thống (Google Translate, DeepL, Microsoft Translator, LibreTranslate) xử lý tốt các cặp key-value nhưng không thể dịch nội dung Markdown một cách an toàn. Đối với các dự án nhiều nội dung, các phương pháp LLM được khuyên dùng — chúng bảo vệ rõ ràng các khối mã, shortcode và biến nội suy.

## Plugin

Plugin là các công thức dịch được đóng gói sẵn cho các cặp ngôn ngữ cụ thể. Chúng là các tệp manifest JSON — không phải mã nguồn — cho champollion biết nên sử dụng phương pháp nào, với cài đặt ra sao và chất lượng nào đã được benchmark.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

Xem [tài liệu tham khảo](https://champollion.dev/docs/reference/plugin-spec) để biết định dạng manifest.

## Các lệnh

| Lệnh | Mục đích |
|---------|---------|
| `init` | Trình hướng dẫn thiết lập tương tác (hoặc `--yes` cho các mặc định nhanh) |
| `sync` | Dịch & đồng bộ hóa tất cả các tệp locale |
| `serve` | Phục vụ stack dịch thuật của dự án này qua HTTP (hợp đồng api-method) |
| `watch` | Tự động đồng bộ hóa khi có thay đổi tệp |
| `audit` | Gắn cờ các locale chưa hoàn chỉnh (cổng CI) |
| `lint` | Tìm các chuỗi hardcode trong mã nguồn |
| `status` | Hiển thị cấu hình cặp ngôn ngữ, phương pháp, ngữ vực và benchmark của plugin |
| `provenance` | Kiểm tra giấy phép tài nguyên dịch thuật |
| `wrap` | Tự động bọc các chuỗi hardcode trong các lệnh gọi `t()` (có hỗ trợ hoàn tác) |
| `seo` | Tạo hreflang, sitemap.xml hoặc JSON-LD schema |
| `integrity` | Kiểm tra lỗi hỏng placeholder, mã hóa và tính hoàn chỉnh của ICU plural |
| `plugin` | Cài đặt, gỡ bỏ hoặc liệt kê các plugin phương pháp |
| `fonts` | Tải xuống web font cho các trình chuyển đổi hệ chữ viết PUA |
| `tm` | Quản lý bộ nhớ đệm Translation Memory (thống kê, xóa, tạo mầm, dọn dẹp) |
| `xliff` | Xuất/nhập XLIFF 1.2 để dịch giả chuyên nghiệp đánh giá |
| `models` | Liệt kê các mô hình khả dụng cho một nhà cung cấp (`--method gemini`) |
| `verify` | Đọc lại các tệp locale đã ghi và xác nhận các bản dịch có mặt và chính xác (cổng CI) |
| `doctor` | Kiểm tra tình trạng hệ thống: thẻ ngôn ngữ, cấu hình, phương pháp và trình chuyển đổi |

Các lệnh hoạt động với chỉ mục dùng chung (shared index) và bảng xếp hạng (leaderboard), thay vì dự án của bạn, được nhóm dưới `champollion network` (mỗi lệnh cũng hoạt động mà không cần tiền tố):

| Lệnh | Mục đích |
|---------|---------|
| `network card` | In đẹp một thẻ ngôn ngữ (`network card <code>`, `--json` cho dạng thô) |
| `network recommend` | Hướng dẫn phương pháp cho một cặp ngôn ngữ — tính khả dụng + bằng chứng trích dẫn (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | Hiển thị bảng xếp hạng dịch máy (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | Đăng ký một kho ngữ liệu đánh giá (evaluation corpus): chọn giấy phép + cấp độ hiển thị (chỉ cục bộ/riêng tư/công khai/niêm phong) |
| `network seal-corpus` | Các động từ mã hóa cấp độ niêm phong (sealed-tier): `keygen` / `seal` / `open` (cầu nối organizer-node) |
| `network submit` | Đề xuất một mục chỉ mục (có kiểm duyệt) — in ra một GitHub issue đã điền sẵn |

Chạy `champollion <command> --help` để xem trợ giúp chi tiết về bất kỳ lệnh nào.

Tài liệu tham khảo đầy đủ: [tài liệu tham khảo](https://champollion.dev/docs/reference/cli)

### Cổng Pre-commit

`champollion lint` được xây dựng để làm một cổng commit (commit gate): nó thoát với mã `1` khi tìm thấy các chuỗi hardcode hiển thị cho người dùng và `0` khi sạch (`--warn-only` báo cáo mà không chặn). Hãy kết nối nó vào một thư mục hooks được theo dõi trong dự án của bạn:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Hoặc kích hoạt nó từ [lint-staged](https://github.com/lint-staged/lint-staged) để nó chỉ chạy khi các tệp nguồn được stage:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Không đưa `champollion sync` vào pre-commit — nó thực hiện các lệnh gọi API mạng, vì vậy tốt nhất là nó sẽ chậm và tệ nhất là chặn các commit khi ngoại tuyến. Thay vào đó, hãy chạy nó trong CI hoặc một pre-push hook, với `champollion audit` / `champollion verify` làm cổng kiểm soát.

## Cấu hình

Tạo `champollion.config.json` hoặc chạy `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Tùy chọn | Mặc định | Mô tả |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Mã ngôn ngữ nguồn |
| `localesDir` | `"./locales"` | Đường dẫn đến các tệp locale: một tệp cho mỗi ngôn ngữ (`fr.json`) hoặc một thư mục cho mỗi ngôn ngữ (`fr/common.json`, i18next) |
| `localesPattern` | `null` | Bất kỳ bố cục nào khác, ví dụ: `"src/i18n/{ns}/{lang}.json"` (thay thế `localesDir`) |
| `contentDir` | `null` | Thư mục Markdown/MDX cần dịch (một `content/` của Hugo hoặc bất kỳ thư mục nào); mỗi bản dịch được ghi bên cạnh bản nguồn của nó dưới dạng `<name>.<locale>.md` |
| `format` | `"auto"` | Định dạng tệp: `json`, `toml`, `yaml`, hoặc `auto` |
| `model` | `"google/gemini-3.8-flash"` | Mô hình mặc định (OpenRouter slug). Các nhà cung cấp trực tiếp tự phân giải mặc định của họ khi chạy. Chạy `champollion models --method gemini` để khám phá các mô hình khả dụng. |
| `defaultMethod` | `"llm"` | Phương pháp dịch mặc định (bị ghi đè bởi cờ `--method`) |
| `batchSize` | `80` | Số lượng key trên mỗi nhóm dịch (batch) |
| `pairs` | `{}` | Ghi đè phương pháp, mô hình và chất lượng cho từng cặp ngôn ngữ |

**Ghi đè theo từng ngôn ngữ**: Mỗi ngôn ngữ có một [Thẻ ngôn ngữ (Language Card)](https://champollion.dev/docs/reference/language-card-spec) — một trong 50 thẻ được tuyển chọn chứa các preset ngữ vực, hệ thống độ trang trọng, quy tắc đánh máy và các cờ hỗ trợ phương pháp. Các thẻ sử dụng [kiến trúc hai tầng](https://champollion.dev/docs/agents/rails-model) (runtime + reference) để đảm bảo hiệu suất ở quy mô lớn. Tạo khung (scaffold) cho một thẻ mới bằng `node scripts/generate-language-card.mjs <code>`. Sử dụng các key preset làm viết tắt, hoặc viết văn bản ngữ vực tùy chỉnh:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**Chế độ không cấu hình (Zero-config mode)**: Không có tệp cấu hình? Champollion tự động phát hiện các tệp locale, định dạng và ngôn ngữ đích từ dự án của bạn.

Các giá trị ngôn ngữ có thể là một key preset (ví dụ: `"casual-tu"`), văn bản ngữ vực tùy chỉnh hoặc một đối tượng (kiểm soát toàn diện). Các ghi đè cấp độ cặp ngôn ngữ trong `pairs` được ưu tiên hơn các cài đặt cấp độ ngôn ngữ. Chạy `npx champollion init` để duyệt các preset khả dụng cho mỗi ngôn ngữ.

Xem [Tài liệu tham khảo CLI](https://champollion.dev/docs/reference/cli) để biết chi tiết thiết lập cụ thể cho từng framework.

## Đầu ra CLI

Khi bạn chạy `sync`, champollion hiển thị chính xác những gì đang diễn ra:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

Dòng cuối cùng của ước tính nêu rõ mức giá cho mỗi con số, nguồn gốc và thời gian (`--json` mang thông tin chi tiết). "Translating …" chỉ được hiển thị khi có dữ liệu được gửi đi: một lần chạy thử (dry run), hoặc một lần chạy không có gì để gửi, sẽ báo rằng nó đang kiểm tra các locale thay thế. Thanh tiến trình cập nhật tại chỗ khi mỗi nhóm hoàn thành (~80 key mỗi lần cập nhật). Khi `contentDir` được thiết lập, quá trình đồng bộ hóa sẽ nêu tên thư mục và nơi các bản dịch của nó đi đến; nó chỉ báo `Detected framework: Hugo` khi tìm thấy một trang web Hugo thực sự (`hugo.toml`, một `config.toml` với các cài đặt Hugo, `archetypes/`, …). Tính năng phát hiện định dạng phân biệt `(auto)` với `(config)` để làm rõ cách định dạng được phân giải.

**Các chế độ đầu ra**: `--quiet` ẩn các đầu ra thông tin (chỉ hiển thị lỗi và cảnh báo). `--json` phát ra NDJSON có thể đọc bằng máy cho các pipeline CI/CD.

## Tăng cường bảo mật và độ ổn định (Hardening)

- **Exponential backoff** — thử lại 3 lần với jitter khi gặp lỗi 429/5xx
- **Timeout request 30s** — AbortController ngăn chặn tình trạng treo
- **Xác thực phản hồi** — chỉ chấp nhận các key đã được gửi đi dịch
- **Cổng kiểm soát chất lượng (Quality gate)** — bắt các vòng lặp ảo giác, đầu ra sai hệ chữ viết, độ dài tăng bất thường và lặp lại bản nguồn
- **Thử lại theo tầng (Retry cascade)** — khi phân tích JSON thất bại, thử lại theo nhóm → nửa nhóm → từng key riêng lẻ (giới hạn ngân sách qua `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` lưu bộ nhớ đệm các bản dịch được khóa bằng văn bản nguồn + locale + phương pháp; các key không thay đổi được phục vụ từ bộ nhớ đệm trong các lần đồng bộ hóa tiếp theo, loại bỏ các lệnh gọi API dư thừa
- **Lưu bộ nhớ đệm prompt (Prompt caching)** — việc tách biệt tin nhắn system/user cho phép lưu bộ nhớ đệm ở cấp độ nhà cung cấp, giảm chi phí token trên các nhóm
- **Thực thi thuật ngữ** — các bản dịch được huấn luyện sẽ được xác minh với các thuật ngữ từ điển sau khi LLM phản hồi
- **Bảo vệ khỏi prototype pollution** — chặn `__proto__`, `constructor`, `prototype`
- **Kiểm soát đường dẫn (Path containment)** — việc ghi tệp được xác thực để luôn nằm trong các thư mục đã cấu hình
- **Bảo vệ khối (Block protection)** — các khối mã, shortcode, HTML được bảo vệ trong quá trình dịch nội dung
- **Kiến trúc Fail-loud** — các lỗi dịch thuật luôn ném ra các thông báo lỗi có thể xử lý được, không bao giờ âm thầm ghi dữ liệu rác
- **Xác minh sau đồng bộ hóa** — lệnh `verify` đọc lại các tệp đã ghi và xác nhận các bản dịch có mặt, đúng hệ chữ viết và nguyên vẹn placeholder
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

**Phụ thuộc tối thiểu** — xem ở trên.

## Giấy phép

PolyForm Noncommercial 1.0.0. Champollion CLI là mã nguồn mở (source-available) — miễn phí cài đặt, sử dụng và sửa đổi cho các mục đích phi thương mại (nghiên cứu, giáo dục, công việc cộng đồng) theo [PolyForm Noncommercial License 1.0.0](../LICENSE); việc sử dụng cho mục đích thương mại không nằm trong phạm vi của giấy phép này. Nói một cách đơn giản, với các ví dụ — một trường học, một bệnh viện hoặc phòng khám công, một tổ chức từ thiện, một dự án cá nhân hoặc nghiên cứu được bao gồm; sản phẩm của một doanh nghiệp vì lợi nhuận, chẳng hạn như mặt tiền cửa hàng, thì không: [Ai có thể sử dụng](https://champollion.dev/docs/getting-started/who-may-use-this) (đây là bản tóm tắt, không phải lời khuyên pháp lý; văn bản giấy phép có giá trị quyết định). Gói npm `champollion` được xuất bản là PolyForm-Noncommercial-1.0.0; `cli/LICENSE` là giấy phép có thẩm quyền cho gói được phân phối. Công cụ đi kèm MT Eval Harness và các thông số kỹ thuật là mã nguồn mở, được cấp phép AGPL-3.0-or-later — với ngoại lệ §7 eval-standard-plugin — tại [kho lưu trữ harness](https://github.com/gamedaysuits/Champollion) công khai.
