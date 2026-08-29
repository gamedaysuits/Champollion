---
sidebar_position: 9
title: "Hướng dẫn dành cho Agent: Sử dụng champollion"
description: "Cách các AI agent có thể cài đặt, cấu hình và chạy champollion để dịch các tệp locale."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Hướng dẫn dành cho Agent: Sử dụng champollion

champollion là một công cụ CLI giúp dịch các tệp ngôn ngữ (locale) của ứng dụng chỉ bằng một câu lệnh. Hướng dẫn này dành cho các AI agent (hoặc lập trình viên làm việc với AI agent) muốn nhanh chóng dịch các tệp ngôn ngữ từ con số không.

:::tip[Đã quen thuộc?]
Nếu bạn chỉ cần các lệnh, hãy chuyển đến [CLI Reference](/docs/reference/cli). Nếu bạn muốn xây dựng và đánh giá hiệu năng một phương thức dịch thuật, hãy xem [Network Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Thiết lập môi trường

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Yêu cầu:**
- Node.js 20.11+ (native ESM)
- Khóa API cho nhà cung cấp dịch vụ dịch thuật của bạn

**Thiết lập API key** — champollion cần ít nhất một key tùy thuộc vào phương thức bạn sử dụng:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion tự động đọc `.env.local` và `.env` (độ ưu tiên: `process.env` → `.env.local` → `.env`). Lấy khóa OpenRouter tại [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Đồng bộ lần đầu

Champollion tự động phát hiện các tệp ngôn ngữ (locale) của bạn, định dạng của chúng (JSON, TOML, hoặc YAML), và các ngôn ngữ đích của bạn:

```bash
npx champollion sync
```

**Quá trình diễn ra:**
1. Tải `champollion.config.json` (hoặc tự động phát hiện các thiết lập)
2. Quét tệp ngôn ngữ nguồn, làm phẳng (flatten) các key lồng nhau
3. So sánh với `.champollion.lock` (mã băm SHA-256 của các giá trị đã dịch trước đó)
4. Kiểm tra `.champollion/tm.json` để tìm các bản dịch đã lưu trong bộ nhớ đệm (Translation Memory)
5. Chỉ dịch các **key bị thay đổi, bị thiếu hoặc đã cũ** thông qua phương thức đã cấu hình
6. Chạy cổng kiểm soát chất lượng (quality gate - 5 bước kiểm tra) trên mỗi bản dịch
7. Ghi các bản dịch đạt yêu cầu vào tệp ngôn ngữ đích
8. Cập nhật tệp lock và bộ nhớ đệm TM

Trong một lần chạy lại thông thường sau khi thay đổi một key, bước 4 sẽ lấy 142 key từ bộ nhớ đệm và bước 5 chỉ dịch 1 key. Đây là lý do tại sao các lần đồng bộ tiếp theo diễn ra rất nhanh và tiết kiệm chi phí.

---

## Cấu hình

Tạo `champollion.config.json` trong thư mục gốc của dự án:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Các khóa cặp (pair keys) sử dụng **dấu hai chấm** (`en:fr`), không phải dấu gạch ngang — dấu gạch ngang được dành riêng cho các mã ngôn ngữ vùng miền như `es-MX`.

Các trường chính:

| Trường | Mục đích | Mặc định |
|-------|---------|---------|
| `inputLocale` | Ngôn ngữ nguồn | `en` |
| `languages` | Ngôn ngữ đích (mảng hoặc đối tượng) | `[]` |
| `pairs` | Ghi đè theo từng cặp (các khóa `"src:tgt"`) với cấu hình phương thức | tùy chọn |
| `localesDir` | Nơi lưu trữ các tệp ngôn ngữ | `./locales` |
| `model` | Mô hình LLM cho các phương thức `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | Số khóa trên mỗi cuộc gọi API | 80 (LLM); Google Translate giới hạn ở mức 128 phân đoạn/yêu cầu |
| `jsonConcurrency` | Dịch song song các ngôn ngữ cho các khóa JSON | 50 |
| `contentConcurrency` | Các cuộc gọi API song song để dịch nội dung | 48 (tài liệu Docusaurus), 12 (Hugo `contentDir`) |

Tài liệu tham khảo đầy đủ: [Cấu hình](/docs/getting-started/configuration)

---

## Các phương thức dịch

| Phương thức | Khi nào nên dùng | Chi phí | API key cần thiết |
|--------|------------|------|---------------|
| **`llm`** | Đa mục đích, tốt cho các ngôn ngữ có tài nguyên phong phú | Theo token (tùy thuộc vào mô hình) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Khi bạn có quy tắc ngữ pháp/từ điển cho ngôn ngữ đích | Theo token + ngữ cảnh huấn luyện (coaching) | `OPENROUTER_API_KEY` |
| **`google-translate`** | Các ngôn ngữ có tài nguyên lớn mà Google Translate hoạt động tốt | $20/triệu ký tự | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Pipeline tùy chỉnh được lưu trữ phía sau một HTTP endpoint | Do máy chủ quyết định | Không (endpoint tự xử lý xác thực) |
| **`plugin`** | Phương thức đóng gói sẵn được cài đặt cục bộ | Thay đổi tùy loại | Thay đổi tùy loại |

Chi tiết: [Phương thức dịch thuật](/docs/guides/translation-methods)

---

## Dữ liệu huấn luyện (Coaching Data)

Đối với các cặp `llm-coached`, dữ liệu huấn luyện sẽ định hướng LLM bằng kiến thức ngôn ngữ rõ ràng. Tạo một tệp huấn luyện:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Tham chiếu nó trong cấu hình cặp ngôn ngữ của bạn:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

Cổng kiểm soát chất lượng sẽ xác minh xem các thuật ngữ trong từ điển có thực sự xuất hiện trong kết quả đầu ra hay không — các trường hợp vi phạm sẽ được ghi nhận dưới dạng cảnh báo `[TERM]`.

Chi tiết: [Dữ liệu huấn luyện](/docs/concepts/coaching-data)

---

## Cổng kiểm soát chất lượng (Quality Gate)

Mỗi bản dịch đều phải trải qua năm bước kiểm tra tự động trước khi được ghi vào đĩa:

| Kiểm tra | Lỗi phát hiện được | Ví dụ |
|-------|----------------|---------|
| **Trống/bỏ trống** | Mô hình không trả về kết quả nào | `""` |
| **Lặp lại nguồn** | Mô hình trả về nguyên bản đầu vào tiếng Anh không thay đổi | `"Welcome"` cho tiếng Nhật |
| **Vòng lặp ảo tưởng** | Các trigram bị lặp lại | `"Qo' Qo' Qo' Qo'"` |
| **Phình to độ dài** | Kết quả đầu ra dài gấp 4 lần trở lên so với nguồn | Nguồn 10 ký tự → Đầu ra 50 ký tự |
| **Tuân thủ hệ chữ viết** | Sai hệ chữ viết cho ngôn ngữ đó | Văn bản chữ Latinh cho ngôn ngữ tiếng Ả Rập |

Các lỗi thất bại được ghi nhật ký với tiền tố `[GATE]`. Không có cơ chế tự động chuyển đổi dự phòng trong im lặng — nếu một bản dịch thất bại, nó sẽ được báo cáo chứ không âm thầm được chấp nhận.

Chi tiết: [Cổng kiểm soát chất lượng](/docs/concepts/quality-gate)

---

## Bộ nhớ dịch thuật (Translation Memory)

Champollion lưu bản dịch vào bộ nhớ đệm trong `.champollion/tm.json`, được định danh bằng văn bản nguồn + ngôn ngữ + phương thức. Trong các lần đồng bộ tiếp theo, các key không thay đổi sẽ được lấy từ bộ nhớ đệm — không cần gọi API, không tốn chi phí.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Để bỏ qua bộ nhớ đệm cho một lần chạy: `npx champollion sync --no-tm`

Chi tiết: [Bộ nhớ dịch thuật](/docs/concepts/translation-memory)

---

## Các tệp được tạo ra

Champollion tạo ra một số tệp trong dự án của bạn. Hãy hiểu rõ chúng là gì để tránh vô tình xóa hoặc commit nhầm tệp:

| Tệp | Mục đích | Git? |
|------|---------|------|
| `.champollion.lock` | Mã băm SHA-256 của các giá trị nguồn đã dịch (phát hiện thay đổi) | **Có** — commit tệp này |
| `.champollion-content.lock` | Tương tự, nhưng dành cho các tệp nội dung Markdown/MDX | **Có** — commit tệp này |
| `.champollion/` | Thư mục trạng thái nội bộ (bộ nhớ đệm `tm.json`, xuất XLIFF, sao lưu) | **Không** — thêm vào gitignore; `tm.json` là bộ nhớ đệm cục bộ (xem [Cấu hình](/docs/getting-started/configuration)) |
| Các tệp huấn luyện (coaching) do bạn soạn thảo (ví dụ: `coaching/fr.json`) | Kiến thức ngôn ngữ của bạn | **Có** — commit các tệp này |
| `champollion.config.json` | Cấu hình dự án | **Có** — commit tệp này |

---

## Các mẫu lệnh phổ biến

**Dịch tất cả các cặp đã cấu hình:**
```bash
npx champollion sync
```
Champollion dịch tất cả các locale song song. Với TM caching, chỉ những key bị thay đổi mới gọi đến API (các cặp không thay đổi được lấy từ cache, do đó việc đồng bộ toàn bộ rất tiết kiệm chi phí).

**Chỉ dịch các cặp cụ thể:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` giới hạn quá trình chạy chỉ ở (các) cặp được chỉ định; các bước kiểm tra tính sẵn sàng và chi phí chỉ áp dụng cho các cặp đó. Việc chỉ định một cặp không có trong đồ thị cặp đã cấu hình của bạn sẽ báo lỗi rõ ràng kèm theo danh sách các cặp đã cấu hình — không bao giờ bỏ qua trong im lặng.

**Chế độ nội dung (Markdown/MDX cho Docusaurus, Hugo, v.v.):**
```bash
npx champollion sync --content-dir ./content
```
Dịch các tài liệu, bài viết blog và tệp nội dung song song với tệp JSON ngôn ngữ. Quá trình dịch nội dung chạy song song; điều chỉnh bằng `--content-concurrency`.

**Chạy thử (xem trước mà không ghi đè):**
```bash
npx champollion sync --dry-run
```

**Bắt buộc dịch lại các key cụ thể:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Bắt buộc dịch lại tất cả các tệp nội dung:**
```bash
npx champollion sync --force-content
```

**Kiểm tra trạng thái dịch thuật:**
```bash
npx champollion status
```
Hiển thị độ phủ (coverage), các mức chất lượng và thông tin plugin cho từng cặp ngôn ngữ.

**Kiểm tra các giá trị dự phòng chưa được dịch:**
```bash
npx champollion audit
```
Liệt kê tất cả các giá trị dự phòng `[EN]` cần được dịch.

---

## Khắc phục sự cố

| Sự cố | Cách khắc phục |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Export key đó hoặc thêm nó vào `.env` trong thư mục gốc của dự án |
| `No locale files found` | Thiết lập `localesDir` trong cấu hình, hoặc đảm bảo các tệp ngôn ngữ của bạn khớp với cách đặt tên tiêu chuẩn (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Ngôn ngữ đích của bạn nhận được văn bản chữ Latinh thay vì hệ chữ viết mong muốn — hãy thử một mô hình khác hoặc thêm dữ liệu huấn luyện (coaching data) |
| `[GATE] Source echo` | Mô hình trả về tiếng Anh không thay đổi — dữ liệu huấn luyện hoặc một mô hình khác thường sẽ khắc phục được lỗi này |
| Tất cả bản dịch đều được lấy từ bộ nhớ đệm | Chạy với `--no-tm` để bỏ qua bộ nhớ đệm, hoặc `--force-keys` cho các key cụ thể |
| Xung đột tệp lock | `.champollion.lock` sử dụng mã băm SHA-256 — việc giải quyết xung đột merge bằng cách giữ lại một trong hai phiên bản là an toàn, sau đó chạy lại lệnh sync |

---

## Bước tiếp theo

- [Bắt đầu nhanh](/docs/getting-started/quick-start) — hướng dẫn chi tiết để bắt đầu
- [Tài liệu tham khảo CLI](/docs/reference/cli) — toàn bộ câu lệnh và flag
- [Cách thức hoạt động](/docs/how-it-works) — giải thích về pipeline đồng bộ
- [The Eval Harness Bridge](/docs/guides/bridge) — cách champollion kết nối với Network
- **Bạn muốn xây dựng phương thức dịch thuật của riêng mình?** Hãy xem [Hướng dẫn dành cho Network Agent](/docs/network/getting-started/agent-guide) — xây dựng một phương thức, chứng minh nó hoạt động hiệu quả trên bảng xếp hạng công khai và cạnh tranh giải thưởng nếu/khi có chương trình mở (giải thưởng là một cơ chế đã được lên kế hoạch — xem [Hạn chế thực tế](/docs/network/honest-limitations)).
