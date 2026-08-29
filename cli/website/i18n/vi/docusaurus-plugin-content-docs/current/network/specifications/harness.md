---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Tóm tắt nhanh.** Trang này hướng dẫn cài đặt, cấu hình và sử dụng bộ công cụ đánh giá dịch máy (MT evaluation harness) — công cụ dùng để đo kiểm (benchmark) các phương pháp dịch thuật dựa trên các kho ngữ liệu chuẩn hóa và tạo ra các thẻ kết quả (run card) có tính điểm. Để xem định nghĩa chuẩn của các chỉ số, schema và giao thức đánh giá, hãy xem [Benchmark Specification](/docs/network/specifications/benchmark).

Bộ công cụ này chạy các thử nghiệm dịch thuật và tạo ra các thẻ kết quả (run card). Nó xử lý việc dựng prompt, gọi API, tính điểm và tuần tự hóa kết quả — bạn chỉ cần cung cấp tập dữ liệu và mô hình.

## Cài đặt

**Yêu cầu:** Python 3.10+

```bash
pip install mt-eval-harness
```

Lệnh này sẽ cài đặt lệnh `mt-eval`.

## Cách sử dụng

```bash
mt-eval run --corpus path/to/dataset.json
```

Lệnh này sẽ chạy từng mục trong kho ngữ liệu qua mô hình đã cấu hình (hoặc plugin phương pháp), tính điểm kết quả đầu ra và ghi tệp JSON thẻ kết quả vào thư mục đầu ra.

## Các cờ CLI (CLI Flags)

### `mt-eval run`

| Cờ | Bắt buộc | Mặc định | Mô tả |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Đường dẫn đến tệp ngữ liệu (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Các tệp văn bản song song (định dạng FLORES+, WMT) |
| `-m, --model` | — | `gemini-pro` | Slug của mô hình (tên ngắn hoặc ID OpenRouter đầy đủ). Được phân giải qua `shared/model-aliases.json`. Phân tách bằng dấu phẩy nếu chạy nhiều mô hình |
| `-d, --dataset` | — | `all` | Bộ lọc tập dữ liệu: `all`, tên phân đoạn, hoặc khoảng ID |
| `--ids` | — | — | Danh sách các ID mục cần đánh giá, phân tách bằng dấu phẩy |
| `--source-lang` | — | `English` | Tên ngôn ngữ nguồn |
| `--target-lang` | — | — | Tên ngôn ngữ đích |
| `-p, --prompt` | — | `naive` | Phiên bản prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Đường dẫn đến tệp văn bản coaching prompt |
| `--coaching` | — | — | Văn bản coaching nội dòng (chuỗi đặt trong dấu ngoặc kép) |
| `--method` | — | — | Đường dẫn đến thư mục plugin phương pháp (chứa `method.json` + module Python) |
| `--method-card` | — | — | Đường dẫn đến tệp JSON thẻ phương pháp (method card) cho siêu dữ liệu bảng xếp hạng |
| `--fst-retries` | — | `0` | Số lần thử lại FST (chỉ áp dụng cho phương pháp LLM mặc định) |
| `--skip-fst` | — | `false` | Bỏ qua hoàn toàn cổng kiểm soát chất lượng FST |
| `--tools` | — | `false` | Bật chế độ gọi công cụ (tool-calling) |
| `--tools-list` | — | — | Tên các công cụ, phân tách bằng dấu phẩy |
| `--max-tool-rounds` | — | `8` | Số vòng gọi công cụ tối đa cho mỗi mục |
| `--hooks` | — | — | Tên các hook sau dịch thuật (post-translation hooks) |
| `--style-profile` | — | — | Đường dẫn đến tệp JSON hồ sơ phong cách (style profile). Bật các chỉ số nhất quán về phong cách viết (chỉ mang tính thông tin — không bao giờ nằm trong điểm số tổng hợp; xem [§ Chỉ số phong cách viết và văn phong](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Số lượng mục trên mỗi cuộc gọi API |
| `-c, --concurrency` | — | `8` | Số cuộc gọi API song song |
| `--max-tokens` | — | `32768` | Số token tối đa cho mỗi cuộc gọi API |
| `--temperature` | — | `0.0` | Nhiệt độ lấy mẫu (sampling temperature) (0.0 = xác định) |
| `--no-cache` | — | `false` | Tắt lưu bộ nhớ đệm phản hồi (response caching) |
| `--cache-dir` | — | `eval/cache/harness` | Đường dẫn thư mục bộ nhớ đệm |
| `-o, --output-dir` | — | `eval/logs/harness` | Thư mục đầu ra cho các thẻ kết quả và nhật ký (logs) |
| `-n, --name` | — | — | Tên lượt chạy dễ đọc |
| `--dry-run` | — | `false` | Xác thực cấu hình mà không thực hiện cuộc gọi API |
| `--champollion-config` | — | — | Đường dẫn đến `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Thư mục chứa các thẻ ngôn ngữ (language cards) |
| `--target-lang-code` | — | — | Mã ngôn ngữ BCP-47 |

### Tất cả các lệnh con

Tất cả mười tám lệnh con cấp cao nhất, được tạo dựa trên `mt_eval_harness/cli.py`
vào ngày 01-08-2026. Trước thời điểm đó, phần này chỉ liệt kê bảy lệnh trong số đó, và sáu lệnh —
bao gồm `node`, node chấm điểm của nhà tổ chức có chủ quyền — đã
**không được ghi chép tài liệu ở đây cũng như trong hướng dẫn harness**.

**Chạy và chấm điểm**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval run` | Thực thi một lượt chạy dịch thuật (các cờ ở trên) |
| `mt-eval test <log>` | Phân tích nhật ký của một lượt chạy đã hoàn tất |
| `mt-eval compare <logs…>` | So sánh nhiều nhật ký chạy |
| `mt-eval dashboard <logs…>` | Tạo một bảng điều khiển HTML tương tác |
| `mt-eval card <run-card>` | In đẹp (pretty-print) một thẻ chạy (run card) dễ đọc cho con người |

**Tìm phương pháp phù hợp**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval recommend <src> <tgt>` | Hướng dẫn phương pháp cho một cặp ngôn ngữ — tính khả dụng cộng với **bằng chứng được trích dẫn**, không chỉ là một bảng xếp hạng đơn thuần |
| `mt-eval corpora --source X --target Y` | Liệt kê các ngữ liệu đánh giá (eval corpora) có sẵn cho một cặp ngôn ngữ |
| `mt-eval list models\|prompts\|datasets` | Liệt kê các tài nguyên có sẵn |

**Đóng góp**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval publish <report>` | Gửi một TestReport lên bảng xếp hạng |
| `mt-eval queue` | Chạy các tác vụ đầu tiên trong hàng đợi tính toán của cộng đồng bằng khóa (key) của riêng bạn — xem [Đóng góp năng lực tính toán](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Đóng gói một TestReport thành một plugin phương pháp champollion |
| `mt-eval generate-plugin` | Bí danh (alias) cho `export` |
| `mt-eval export-config` | Tạo một đoạn mã `champollion.config.json` từ một TestReport |

**Các cuộc thi, và tự tổ chức một cuộc thi**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval contest` | Quản lý các cuộc thi đánh giá — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Bao quát phiên bản tác vụ dùng chung (shared-task) cho nhiều cặp ngôn ngữ: một hàng nhóm N cuộc thi theo từng cặp ngôn ngữ của một phiên bản kiểu AmericasNLP và mang các mặc định chính sách của nó. **Chỉ bao gồm việc nhóm và các mặc định — mọi cổng (gate) vẫn giữ nguyên cho từng cuộc thi** |
| `mt-eval node` | **Node chấm điểm của nhà tổ chức.** Lấy dữ liệu đầu vào, kiểm soát qua vòng loại công khai, ủy quyền theo chính sách của cuộc thi, chấm điểm dựa trên **các bản dịch tham chiếu bí mật do nhà tổ chức nắm giữ**, chỉ công bố điểm số. Đây là lệnh đứng sau [Tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) và [Node đánh giá có chủ quyền](/docs/network/sovereignty/sovereign-eval-node) — ngữ liệu không bao giờ rời khỏi máy của nhà tổ chức |

`mt-eval node` có mười bảy lệnh con riêng, bao gồm luồng cách ly mạng (airgap lane)
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) và
nghi thức lưu ký M-trên-N (M-of-N custody ceremony) (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Chạy `mt-eval node --help`; các cơ chế
chủ quyền được mô tả trên hai trang đã liên kết ở trên.

**Thiết lập**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval setup` | Cài đặt các dependency tùy chọn (thước đo neural COMET, runtime FST) |
| `mt-eval logout` | Xóa các thông tin xác thực đã lưu |

### Ví dụ

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Schema của Thẻ kết quả (Run Card Schema)

Mỗi thử nghiệm đều tạo ra một **thẻ kết quả (run card)** — một tài liệu JSON độc lập. Cấu trúc cấp cao nhất:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Xem [Run Card Specification](/docs/network/specifications/run-card) để biết schema đầy đủ với tài liệu chi tiết cho từng trường.

:::info[Schema chuẩn]
[Tài liệu đặc tả Benchmark](/docs/network/specifications/benchmark) là nguồn thông tin gốc duy nhất cho schema của run card. Để biết định nghĩa về các chỉ số, trọng số tổng hợp và các bậc chất lượng, hãy xem [Tài liệu đặc tả chấm điểm](/docs/network/specifications/scoring). Trang này hướng dẫn cách sử dụng harness; các tài liệu đặc tả định nghĩa ý nghĩa của các kết quả đầu ra.
:::

### Các khối chính

**`dataset`** — Xác định tập dữ liệu nào đã được sử dụng, bao gồm cả mã băm nội dung của nó để kết quả luôn gắn liền với một phiên bản cụ thể:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Các chỉ số tổng hợp cho lượt chạy:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Theo dõi lượng token sử dụng và chi phí:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Chỉ số phong cách viết và văn phong (Thông tin tham khảo) {#writing-style-and-register-metrics-informational}

Bộ công cụ có thể đánh giá xem các bản dịch có khớp với **văn phong (register)** và **phong cách viết (writing style)** mục tiêu hay không, thông qua plugin chỉ số `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). Một bản dịch có thể chính xác về mặt ngôn ngữ nhưng lại sai văn phong — ví dụ: dùng từ ngữ thân mật trong một tài liệu pháp lý, hoặc dùng văn mẫu trang trọng trong nội dung tiếp thị — và các chỉ số so khớp chuỗi thông thường sẽ không nhận ra điều này. Nhưng các chỉ số này thì có.

**Những gì được đo lường (trên mỗi mục):**

| Chỉ số | Thang đo | Ý nghĩa |
|--------|-------|---------|
| `style_register_match` | boolean | Kết quả đầu ra có khớp với văn phong mong đợi không? Văn phong mục tiêu được lấy từ trường `register` của mục ngữ liệu (xem [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) hoặc từ một hồ sơ phong cách |
| `style_sentence_length_ratio` | float | Độ dài câu trung bình dự đoán so với tham chiếu (1.0 = khớp; sai lệch = lệch phong cách) |
| `style_formality_score` | 0.0–1.0 | Sự xuất hiện của các dấu hiệu trang trọng/thân mật (đại từ nhân xưng, từ viết tắt,...) sử dụng tài nguyên dấu hiệu theo từng ngôn ngữ |

**Tổng hợp:** `style_consistency_rate` — tỷ lệ các mục không phát hiện thấy sự bất đồng nhất về văn phong.

Kích hoạt mục tiêu tùy chỉnh bằng `--style-profile path/to/profile.json` (ví dụ: hồ sơ giọng điệu thương hiệu); nếu không có, plugin sẽ tự động quay về sử dụng siêu dữ liệu `register` của từng mục ngữ liệu nếu có sẵn.

:::caution[Xác định phạm vi rõ ràng]
Các chỉ số này **chỉ mang tính chất tham khảo** — chúng không bao giờ là một phần của điểm số tổng hợp, và việc phát hiện mức độ trang trọng dựa trên dấu hiệu (một phương pháp heuristic), chứ không phải là một đánh giá được học máy. Hãy coi chúng như một công cụ phát hiện độ lệch (drift detector) đối với việc tuân thủ văn phong (register), chứ không phải là phán quyết về chất lượng phong cách.
:::

---

## Phân biệt Fingerprint và Run Card Hash {#fingerprint-vs-run-card-hash}

Bộ công cụ tạo ra hai mã băm (hash) riêng biệt. Chúng phục vụ các mục đích khác nhau:

### Fingerprint (Mã vân tay)

**Fingerprint** trả lời cho câu hỏi: *"Lượt chạy này có thể tái lập được không?"*

Nó băm tổ hợp các dữ liệu đầu vào định nghĩa cấu hình thử nghiệm — chứ không băm kết quả đầu ra:

- SHA-256 của tập dữ liệu
- Slug của mô hình
- Nhãn điều kiện (Condition label)
- SHA-256 của system prompt
- Nhiệt độ (Temperature)
- Phiên bản của bộ công cụ (Harness version)

Hai lượt chạy có fingerprint giống hệt nhau nghĩa là chúng sử dụng cùng một thiết lập. Kết quả của chúng có thể so sánh được với nhau (ngoại trừ tính không xác định của API).

### Run Card Hash (Mã băm thẻ kết quả)

**Run card hash** trả lời cho câu hỏi: *"Tệp kết quả cụ thể này có bị can thiệp hay thay đổi gì không?"*

Đây là mã SHA-256 của toàn bộ tệp JSON thẻ kết quả (ngoại trừ chính trường `run_card_hash`). Nếu bất kỳ trường nào thay đổi — một điểm số, một mốc thời gian, hay một kết quả đầu ra đơn lẻ — mã băm này sẽ bị hỏng (không còn khớp).

:::info[Khi nào nên dùng cái nào]
Sử dụng **fingerprint** để nhóm các lượt chạy có thể so sánh được (cùng một thử nghiệm, các lần thực thi khác nhau). Sử dụng **run card hash** để xác minh tính toàn vẹn của một tệp kết quả cụ thể.
:::

---

## Đăng tải lên Bảng xếp hạng (Leaderboard)

Sau khi hoàn thành một lượt chạy, hãy sử dụng `mt-eval publish` để gửi thẻ kết quả:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Nếu không có `--method-card` nào được cung cấp trong lượt chạy, `mt-eval publish` sẽ khởi chạy một trình hướng dẫn tương tác (`method_card_wizard.py`) để hướng dẫn bạn mô tả phương pháp của mình (tên, phân loại, các công cụ đã sử dụng, v.v.). Kết quả của trình hướng dẫn này sẽ được nhúng vào thẻ kết quả trước khi gửi đi.

### Kiểm tra thủ công

Các run card được lưu dưới dạng tệp JSON trong thư mục đầu ra (mặc định là `eval/logs/harness/`) — hãy kiểm tra chúng ở đó trước khi xuất bản. `mt-eval publish` là đường dẫn gửi nộp; không có quy trình tiếp nhận run-card dựa trên PR.

:::note[API gửi nộp và tải lên qua web chưa hoạt động]
Một endpoint `POST https://champollion.dev/api/leaderboard/submit` và giao diện tải lên Bảng xếp hạng (Leaderboard) đã được lên kế hoạch nhưng **chưa được triển khai**. Cho đến khi chúng được phát hành, đường dẫn gửi nộp duy nhất hoạt động là `mt-eval publish`.
:::

:::warning[Xác thực Bảng xếp hạng]
Bảng xếp hạng xác thực các run card đã gửi so với danh mục đăng ký tập dữ liệu (dataset registry). Các lượt gửi tham chiếu đến tập dữ liệu không xác định, hoặc có `run_card_hash` bị hỏng, sẽ bị từ chối.
:::

:::danger[KHÔNG HUẤN LUYỆN trên dữ liệu đánh giá]
Nếu phương pháp của bạn đã tiếp xúc với tập dữ liệu đánh giá trong quá trình phát triển — dưới dạng dữ liệu huấn luyện, ví dụ few-shot, mục từ điển hoặc tài liệu thiết kế prompt (prompt engineering) — lượt gửi của bạn sẽ bị **loại**. Xem [Đánh giá dịch máy (MT Evaluation)](/docs/network/leaderboard/rules) để biết thế nào là một phương pháp tốt so với một phương pháp không tốt.
:::

---

## Xem thêm

- [MT Evaluation](/docs/network/leaderboard/rules) — tổng quan, giá trị của bảng xếp hạng, và hướng dẫn về phương pháp tốt/xấu
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — định dạng tập dữ liệu, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — schema JSON đầy đủ
- [Building a Method](/docs/network/specifications/methods) — giao diện phương pháp để tạo ra các phương pháp có thể đánh giá được
- [Method Leaderboard](https://champollion.dev/leaderboard) — điểm số benchmark trực tiếp
- [Benchmark Specification](/docs/network/specifications/benchmark) — giao thức đánh giá, định dạng ngữ liệu, schema thẻ kết quả
- [Scoring Specification](/docs/network/specifications/scoring) — nguồn thông tin chuẩn xác duy nhất (SSOT) cho các chỉ số, trọng số tổng hợp và phân khúc chất lượng
