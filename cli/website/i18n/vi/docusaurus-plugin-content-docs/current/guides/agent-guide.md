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
|---|---|---|
| `inputLocale` | Ngôn ngữ nguồn | `en` |
| `languages` | Các ngôn ngữ đích (mảng hoặc đối tượng) | `[]` |
| `pairs` | Ghi đè theo từng cặp (khóa `"src:tgt"`) kèm cấu hình phương thức | tùy chọn |
| `localesDir` | Nơi chứa các tệp locale | `./locales` |
| `model` | Mô hình LLM cho các phương thức `llm`/`llm-coached` | `google/gemini-3.8-flash` |
| `batchSize` | Số khóa trên mỗi lệnh gọi API | 80 (LLM); Google Translate giới hạn tối đa 128 phân đoạn/yêu cầu |
| `jsonConcurrency` | Dịch locale song song cho các khóa JSON | 50 |
| `contentConcurrency` | Lệnh gọi API song song để dịch nội dung | 48 (tài liệu Docusaurus), 12 (`contentDir`) |

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

| Kiểm tra | Lỗi phát hiện | Ví dụ |
|---|---|---|
| **Rỗng/trống** | Mô hình không trả về nội dung nào | `""` |
| **Lặp lại nguồn** | Mô hình trả về nội dung đầu vào tiếng Anh mà không thay đổi | `"Welcome"` cho tiếng Nhật |
| **Vòng lặp ảo giác** | Trigram bị lặp lại | `"Qo' Qo' Qo' Qo'"` |
| **Phồng độ dài** | Đầu ra dài hơn 4 lần độ dài nguồn (đúng 4 lần thì đạt) | Nguồn 10 ký tự → đầu ra 50 ký tự |
| **Tuân thủ hệ chữ viết** | Sai hệ chữ viết cho locale | Văn bản Latin cho locale tiếng Ả Rập |

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
|---|---|---|
| `.champollion.lock` | Mã băm SHA-256 của các giá trị nguồn đã dịch (phát hiện thay đổi), cùng với dữ liệu cho từng locale: những gì sync đã ghi, các khóa mà lệnh redo để ở trạng thái chờ (pending), các khóa bị giữ lại sau khi bị từ chối | **Có** — hãy commit tệp này |
| `.champollion-replaced-edits.jsonl` | Các bản dịch được chỉnh sửa thủ công mà sync đã thay thế, kèm theo câu chữ của chúng (chỉ được ghi khi điều đó xảy ra) | **Có** — hãy commit tệp này |
| `.champollion-content.lock` | Tương tự, nhưng dành cho các tệp nội dung Markdown/MDX | **Có** — hãy commit tệp này |
| `.champollion/` | Thư mục trạng thái nội bộ (bộ nhớ đệm `tm.json`, tệp xuất XLIFF, bản sao lưu) | **Không** — hãy đưa vào gitignore; `tm.json` là bộ nhớ đệm cục bộ (xem [Cấu hình](/docs/getting-started/configuration)) |
| Các tệp huấn luyện do bạn tạo (ví dụ: `coaching/fr.json`) | Kiến thức ngôn ngữ của bạn | **Có** — hãy commit các tệp này |
| `champollion.config.json` | Cấu hình dự án | **Có** — hãy commit tệp này |

---

## Các mẫu lệnh phổ biến

**Dịch tất cả các cặp đã cấu hình:**
```bash
npx champollion sync
```
Champollion dịch tất cả các locale song song. Nhờ bộ nhớ đệm TM, chỉ các khóa bị thay đổi mới gọi tới API (các cặp không thay đổi được lấy trực tiếp từ bộ nhớ đệm, do đó việc đồng bộ toàn bộ rất tiết kiệm).

**Chỉ dịch các cặp cụ thể:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` giới hạn lượt chạy cho (các) cặp được chỉ định; các bước kiểm tra tính sẵn sàng và chi phí chỉ áp dụng cho những cặp đó. Việc chỉ định một cặp không nằm trong biểu đồ cặp đã cấu hình của bạn sẽ báo lỗi rõ ràng kèm theo danh sách các cặp đã cấu hình — hoàn toàn không có chuyện im lặng bỏ qua (silent no-op).

**Cách viết một cặp.** Một cặp trong dự án được viết theo cách `champollion.config.json` dùng làm khóa, `en:fr`. `sync`, `verify` và `serve` cũng đọc được `en>fr` và `en-fr`, còn `en-pt-BR` được so khớp với các cặp bạn đã cấu hình. Các lệnh mạng (`network register-corpus`, `leaderboard`, `recommend`, `submit`) ghi một cặp dưới dạng `eng>crk`, định dạng mà bảng xếp hạng lưu trữ, và đọc `eng-crk` cũng như `eng:crk` theo cùng cách đó. Ở đó, một cặp chỉ có dấu gạch nối phải bao gồm hai mã có hai hoặc ba chữ cái (`eng-crk`). Một mã có dấu gạch nối riêng cần dùng `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` cũng có thể mang ý nghĩa `eng-pt` và `BR`, do đó nó bị từ chối chứ không bao giờ được suy đoán. Trong shell, hãy đặt dạng `>` trong dấu ngoặc kép: `--pair "eng>crk"`. Nếu không có dấu ngoặc kép, shell sẽ chuyển hướng đầu ra vào một tệp có tên `crk`.

**Chế độ nội dung (một thư mục Markdown/MDX: một `content/` của Hugo hoặc bất kỳ thư mục nào; tài liệu Docusaurus được tự động tìm thấy mà không cần chỉ định):**
```bash
npx champollion sync --content-dir ./content
```
Dịch tài liệu, bài viết blog và các tệp nội dung song song với JSON locale. Mỗi bản dịch được ghi ngay cạnh tệp nguồn của nó dưới dạng `<name>.<locale>.md`; các chỉnh sửa mà người đánh giá thực hiện trên đó sẽ được giữ lại khi nguồn thay đổi ở chỗ khác ([Dịch nội dung](/docs/guides/content-translation#reviewing-and-editing-translations)). Dịch nội dung chạy song song; bạn có thể tinh chỉnh bằng `--content-concurrency`.

**Chạy thử (xem trước mà không ghi đè):**
```bash
npx champollion sync --dry-run
```

**Bắt buộc dịch lại các key cụ thể:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Xử lý lại tất cả các tệp nội dung (văn bản trong bộ nhớ đệm được tái sử dụng, do đó văn bản không thay đổi sẽ không tốn phí):**
```bash
npx champollion sync --force-content
```

**Dịch mới các tệp nội dung cụ thể (tính phí), hoặc giới hạn lượt chạy cho một số tệp:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Lượt chạy máy có thể đọc được:** `--json` ghi mỗi đối tượng JSON trên một dòng (NDJSON), mỗi đối tượng có một `level`: trên stdout gồm các thông điệp `info` và `ok`, các bản ghi `event` (`"event": "cost"` — ước tính, trước cổng kiểm soát `--max-cost` — và một bản ghi `"event": "file"` cho mỗi tệp nội dung và locale), và cuối cùng là `{"level": "summary", "command": "sync", …}` kết thúc; trên stderr là các dòng `warn` và `error`, cũng ở định dạng JSON. Hãy chọn phần tóm tắt theo cấp độ của nó, đừng bao giờ chỉ dựa vào vị trí dòng: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. Mã thoát (exit code) `2` biểu thị một phần (một số công việc đã hoàn thành, một số bị lỗi).

Trong phần ước tính (sự kiện `cost`, và `costEstimate` trong bản tóm tắt), `totalEstimatedCost` sẽ là `null` bất cứ khi nào có phần nào chưa rõ giá — không bao giờ là tổng một phần, không bao giờ là `0` cho phần chưa biết; `knownEstimatedCost` lưu giữ phần đã có giá, `unknownCost.reason` liệt kê tên các cặp không có giá, và `unknownCost.notes` nêu rõ phần nào không có giá và lý do — `{ subject, pairs, note }`, chẳng hạn như tên mô hình không có trong danh sách của OpenRouter (nhiều khả năng là lỗi chính tả, kèm theo các tên được liệt kê gần giống nhất), một mô hình có trong danh sách nhưng không có giá trên mỗi token, hoặc bảng giá không thể đọc được. Mô hình chạy trên máy này (điểm cuối `local` hoặc `api` tại `localhost`/`127.0.0.1`/`::1`) có giá `0` kèm `"local": true`. Trường `sentToModel` của bản tóm tắt đếm số khóa đã gửi tới phương thức trong lượt chạy này (`tmHits`: được phân phối từ bộ nhớ đệm). Bản tóm tắt của lượt chạy thử (dry run) chứa `preflight: { ready, failures }` — `ready: false` nghĩa là lượt chạy thực tế sẽ dừng lại và thoát với mã `1` (thiếu khóa, hoặc máy chủ mô hình mà lượt chạy cần không phản hồi), mặc dù bản thân lượt chạy thử thoát với mã `0` ([mã thoát](/docs/reference/cli#sync-exit-codes)). Với `--max-cost`, nó cũng chứa `maxCost: { cap, estimatedCost, wouldStop }` — `wouldStop: true` (kèm theo `exitCode: 2` và `reason`) nghĩa là lượt chạy thực tế sẽ dừng lại ở mức giới hạn trước bất kỳ lệnh gọi API nào. `realRun: { exitCode, wouldStop, reasons }` là mã thoát mà lượt chạy thực tế sẽ kết thúc, theo như bản xem trước có thể xác định: kiểm tra sơ bộ (preflight) và giới hạn chi tiêu (cap), cộng với những gì khiến nó kết thúc ở trạng thái một phần (partial) — các khóa bị giữ lại, các thông điệp số nhiều trên đĩa thiếu dạng thức mà ngôn ngữ đó sử dụng mà hệ thống sẽ không hỏi lại (được đếm trong `totalPluralGaps` của lượt chạy thử). Lượt chạy thử không xác minh điều gì (`verify: { "ran": false }`). Hãy chạy dry run với các tùy chọn `--method`/`--model` của lượt chạy thực tế: nếu không có chúng, nó sẽ kiểm tra phương thức được chỉ định trong cấu hình.

**Kiểm tra trạng thái bản dịch:**
```bash
npx champollion status
```
Hiển thị phương thức, mô hình, độ bao phủ và thông tin plugin của từng cặp (chỉ có `qualityTier` khi cấu hình thiết lập — đây là nhãn, không phải thước đo).

**Kiểm tra các giá trị dự phòng chưa được dịch:**
```bash
npx champollion audit
```
Liệt kê tất cả các giá trị dự phòng `[EN]` cần được dịch.

---

## Khắc phục sự cố

| Sự cố | Cách khắc phục |
|---|---|
| `OPENROUTER_API_KEY not set` | Xuất khóa hoặc thêm nó vào `.env` trong thư mục gốc của dự án |
| `No locale files found` | Thiết lập `localesDir` trong cấu hình, hoặc đảm bảo các tệp locale của bạn khớp với quy cách đặt tên chuẩn (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Locale đích của bạn nhận được văn bản chữ Latin thay vì hệ chữ viết mong muốn — hãy thử một mô hình khác hoặc thêm dữ liệu huấn luyện |
| `[GATE] Source echo` | Mô hình trả về tiếng Anh nguyên bản không đổi — dữ liệu huấn luyện hoặc một mô hình khác thường sẽ khắc phục được điều này |
| Tất cả bản dịch đều được lưu trong bộ nhớ đệm | Chạy với `--no-tm` để bỏ qua bộ nhớ đệm, hoặc `--force-keys` cho các khóa cụ thể |
| Xung đột lock file | `.champollion.lock` chứa các mã băm — xung đột khi merge có thể được giải quyết an toàn bằng cách giữ lại phiên bản bất kỳ, sau đó chạy lại sync. Việc giữ lại bản ghi theo từng locale của phía bên kia có thể khiến một số giá trị được đọc là đã chỉnh sửa thủ công (khi đó lệnh redo hàng loạt sẽ giữ lại và đặt tên cho chúng; `--redo keys:` thay thế một giá trị) — không bao giờ xảy ra điều ngược lại |
| Các khóa bị "giữ lại" (held back) | Cổng chất lượng trước đó đã từ chối câu trả lời của mô hình đó; lệnh sync thông thường sẽ không gửi lại (nó sẽ bị tính phí cho cùng một câu trả lời). `champollion sync --redo keys:<key>` sẽ yêu cầu lại; hoặc thêm `fallback`, liệt kê nó trong `noTranslate`, hoặc viết thủ công |

---

## Bước tiếp theo

- [Bắt đầu nhanh](/docs/getting-started/quick-start) — hướng dẫn chi tiết để bắt đầu
- [Tài liệu tham khảo CLI](/docs/reference/cli) — toàn bộ câu lệnh và flag
- [Cách thức hoạt động](/docs/how-it-works) — giải thích về pipeline đồng bộ
- [The Eval Harness Bridge](/docs/guides/bridge) — cách champollion kết nối với Network
- **Bạn muốn xây dựng phương thức dịch thuật của riêng mình?** Hãy xem [Hướng dẫn dành cho Network Agent](/docs/network/getting-started/agent-guide) — xây dựng một phương thức, chứng minh nó hoạt động hiệu quả trên bảng xếp hạng công khai và cạnh tranh giải thưởng nếu/khi có chương trình mở (giải thưởng là một cơ chế đã được lên kế hoạch — xem [Hạn chế thực tế](/docs/network/honest-limitations)).
