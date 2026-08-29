---
sidebar_position: 4
title: "Đặc tả Run Card"
---

# Đặc tả Run Card

> **Tóm tắt tổng quan.** Run card là đơn vị nguyên tử của quá trình benchmarking — một tài liệu JSON ghi lại cấu hình hoàn chỉnh, kết quả theo từng mục và điểm số tổng hợp của một lượt đánh giá (evaluation run). Trang này cung cấp tài liệu về schema, các trường thông tin, cơ chế tạo mã định danh (fingerprint) và cấu trúc điểm số. Xem [Đặc tả Benchmark](/docs/network/specifications/benchmark) để biết các định nghĩa chuẩn hóa.

Run card là bản ghi hoàn chỉnh của một lượt đánh giá đơn lẻ. Nó chứa mọi thông tin cần thiết để hiểu, tái lập và xác minh thử nghiệm: cấu hình, điểm số, kết quả riêng lẻ, lượng token sử dụng và siêu dữ liệu môi trường.

**Phiên bản Schema:** 2.0

:::info[Lược đồ chính thức]
[Tài liệu đặc tả Benchmark](/docs/network/specifications/benchmark) là nguồn thông tin gốc duy nhất cho lược đồ run card. Để biết định nghĩa về các chỉ số, trọng số tổng hợp và các bậc chất lượng, hãy xem [Tài liệu đặc tả chấm điểm](/docs/network/specifications/scoring). Trang này tài liệu hóa bản triển khai hiện tại.
:::

---

## Các trường cấp cao nhất

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 được tạo khi bắt đầu lượt chạy |
| `harness_version` | `string` | Phiên bản ngữ nghĩa (semantic version) của harness đã tạo ra card này (ví dụ: `2.0`) |
| `model_slug` | `string` | Slug của mô hình được sử dụng cho lượt chạy (ví dụ: `google/gemini-3.1-pro`) |
| `model_id` | `string` | Định danh mô hình đã phân giải được trả về bởi API (ví dụ: `gemini-3.1-pro-001`) |
| `condition` | `string` | Nhãn thử nghiệm (ví dụ: `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | Nhãn thời gian ISO 8601 UTC khi lượt chạy bắt đầu |
| `elapsed_seconds` | `number` | Thời gian chạy thực tế (wall-clock duration) của toàn bộ lượt chạy |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Xác định tập dữ liệu đánh giá và ghim nó vào một phiên bản nội dung cụ thể thông qua SHA-256.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `id` | `string` | Định danh tập dữ liệu (ví dụ: `edtekla-dev-v1`) |
| `version` | `string` | Chuỗi phiên bản của tập dữ liệu |
| `language_pair` | `string` | Nhãn hiển thị (ví dụ: `EN→CRK`) |
| `sha256` | `string` | Mã băm SHA-256 của nội dung tệp dữ liệu. Đảm bảo tính chính xác của dữ liệu được sử dụng |
| `entry_count` | `number` | Số lượng mục trong tập dữ liệu |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

Cấu hình API và phân mẻ (batching) được sử dụng cho lượt chạy này.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `api_provider` | `string` | Tên nhà cung cấp API (ví dụ: `openrouter`) |
| `temperature` | `number` | Nhiệt độ lấy mẫu (sampling temperature) |
| `max_tokens` | `number` | Số lượng token tối đa cho mỗi phản hồi (completion) |
| `batch_size` | `number` | Số lượng mục trên mỗi mẻ đồng thời (concurrent batch) |
| `concurrency` | `number` | Số lượng yêu cầu API song song tối đa |
| `coaching_file` | `string` | Đường dẫn đến tệp coaching prompt, nếu có sử dụng |
| `method_path` | `string` | Đường dẫn đến thư mục plugin phương thức, nếu có sử dụng |
| `fst_retries` | `number` | Số lần thử lại FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Run Card đã xuất bản bao gồm `method_config`]
Khi một run card được xuất bản thông qua `mt-eval publish`, `publish.py` sẽ chèn một khối `method_config` chứa MethodConfig 8 trường chuẩn tắc. Điều này cho phép cài đặt bảng xếp hạng không gặp trở ngại — bất kỳ ai cũng có thể tái tạo phương pháp trực tiếp từ run card đã xuất bản.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

Tất cả các trường đều sử dụng định dạng **camelCase** và tuân theo schema MethodConfig chuẩn hóa (xem [Xây dựng một Phương thức](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | Mã băm SHA-256 của system prompt. Được bao gồm trong fingerprint |
| `system_prompt_used` | `string` | Toàn bộ văn bản system prompt được gửi đến mô hình |

Mã băm của prompt là một phần của [fingerprint](#fingerprint) — hai lượt chạy có prompt khác nhau sẽ có fingerprint khác nhau ngay cả khi tất cả các thiết lập khác đều trùng khớp.

---

## `fingerprint`

Một định danh cho khả năng tái lập. Hai lượt chạy có fingerprint giống hệt nhau nghĩa là đã sử dụng cùng một thiết lập thử nghiệm.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `hash` | `string` | Mã băm SHA-256 của các thành phần đã được sắp xếp |
| `components` | `object` | Các giá trị đầu vào đã được băm |

### Các thành phần của Fingerprint

| Thành phần | Mô tả |
|-----------|-------------|
| `dataset_sha256` | Mã băm của tệp dữ liệu |
| `model_slug` | Mô hình được sử dụng |
| `condition` | Nhãn điều kiện thử nghiệm |
| `system_prompt_sha256` | Mã băm của system prompt |
| `temperature` | Nhiệt độ lấy mẫu (sampling temperature) |
| `harness_version` | Phiên bản harness |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Run Card Hash]
Fingerprint xác định *cấu hình thử nghiệm*. `run_card_hash` xác minh *tính toàn vẹn của tệp kết quả*. Xem [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) để biết thêm chi tiết.
:::

---

## `scores`

Các chỉ số tổng hợp cho toàn bộ lượt chạy.

### Điểm số cấp cao nhất

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `total` | `number` | Tổng số mục được đánh giá |
| `exact_matches` | `number` | Các mục có đầu ra khớp chính xác với bản dịch chuẩn (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Các mục có đầu ra được chấp nhận bởi bộ phân tích FST |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). `null` nếu không sử dụng bộ phân tích FST |
| `chrf_plus_plus` | `number` | Điểm chrF++ ở cấp độ ngữ liệu (corpus-level) (0–100) |
| `errors` | `number` | Các mục bị lỗi (lỗi API, hết thời gian chờ, v.v.) |
| `avg_latency_seconds` | `number` | Thời gian phản hồi trung bình (mean) trên tất cả các mục |
| `median_latency_seconds` | `number` | Thời gian phản hồi trung vị (median) |
| `p95_latency_seconds` | `number` | Thời gian phản hồi ở phân vị thứ 95 (95th percentile) |

### `by_difficulty`

Điểm số được chia nhỏ theo phân hạng độ khó. Mỗi khóa (số nguyên từ 1–5) chứa các trường chỉ số tương tự như điểm số cấp cao nhất.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Điểm số được chia nhỏ theo nguồn gốc của mục (entry provenance). Mỗi khóa (ví dụ: `gold_standard`, `textbook`) chứa các trường chỉ số tương tự.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

Theo dõi lượng token sử dụng và chi phí cho toàn bộ lượt chạy.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `prompt_tokens` | `number` | Tổng số token đầu vào (input tokens) trên tất cả các cuộc gọi API |
| `completion_tokens` | `number` | Tổng số token đầu ra (output tokens) |
| `reasoning_tokens` | `number` | Token được sử dụng cho suy luận chuỗi suy nghĩ (chain-of-thought reasoning) (tùy thuộc vào mô hình, bằng 0 đối với hầu hết các mô hình) |
| `cached_tokens` | `number` | Token được cung cấp từ bộ nhớ đệm prompt (prompt cache) của nhà cung cấp |
| `total_cost_usd` | `number` | Tổng chi phí tính bằng USD (theo báo cáo từ API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Siêu dữ liệu môi trường thực thi (runtime environment) phục vụ cho khả năng tái lập.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `harness_version` | `string` | Phiên bản harness (phản chiếu trường `harness_version` ở cấp cao nhất) |
| `harness_git_commit` | `string` | Git commit SHA của harness tại thời điểm chạy |
| `python_version` | `string` | Phiên bản trình thông dịch Python |
| `sacrebleu_version` | `string` | Phiên bản thư viện sacrebleu (được sử dụng để tính điểm chrF++) |
| `os` | `string` | Định danh hệ điều hành |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

Mảng kết quả theo từng mục. Mỗi đối tượng tương ứng với một mục trong tập dữ liệu, theo thứ tự chỉ mục.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `entry_id` | `integer` | ID của mục này trong ngữ liệu (khớp với `entries[].id`) |
| `source` | `string` | Văn bản nguồn đã được dịch |
| `reference` | `string` | Bản dịch chuẩn (gold-standard reference) từ ngữ liệu |
| `predicted` | `string` | Đầu ra thực tế của phương thức |
| `exact_match` | `boolean` | Liệu `predicted` có khớp chính xác với `reference` sau khi chuẩn hóa hay không |
| `entry_chrf` | `number` | Điểm chrF++ ở cấp độ câu cho mục này (0–100) |
| `fst_accepted` | `boolean \| null` | Liệu bộ phân tích FST có chấp nhận đầu ra hay không. `null` nếu không có bộ phân tích nào được cấu hình |
| `fst_analysis` | `string[]` | Các chuỗi phân tích FST cho đầu ra (mảng rỗng nếu không được phân tích hoặc bị từ chối) |
| `difficulty` | `integer` | Phân hạng độ khó từ ngữ liệu (1–5) |
| `provenance` | `string` | Thẻ nguồn gốc (provenance tag) từ ngữ liệu |
| `latency_seconds` | `number` | Thời gian phản hồi cho mục riêng lẻ này |
| `usage` | `object` | Lượng token sử dụng cho từng mục: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Thông báo lỗi nếu mục này thất bại. `null` nếu thành công |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `run_card_hash` | `string` | Mã băm SHA-256 của toàn bộ tệp JSON run card, với chính trường `run_card_hash` được đặt thành `""` trong quá trình băm |

Đây là dấu niêm phong phát hiện can thiệp (tamper-detection seal). Bảng xếp hạng sẽ tính toán lại mã băm này khi gửi lên và từ chối các card không trùng khớp.

**Cách tính mã băm:**

1. Tuần tự hóa (serialize) run card thành JSON với `run_card_hash` được đặt thành `""`
2. Tính toán mã băm SHA-256 của chuỗi đã tuần tự hóa
3. Đặt `run_card_hash` thành chuỗi kết quả dạng hex digest

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Phân tích chi tiết theo từng mục]
Các run card đã xuất bản cũng điền dữ liệu vào bảng Supabase `run_card_entries`, nơi lưu trữ kết quả của từng mục để phân tích chi tiết trên bảng xếp hạng. Bảng này được điền dữ liệu tự động trong quá trình `mt-eval publish`.
:::

---

## Xem thêm

- [Đánh giá MT](/docs/network/leaderboard/rules) — tổng quan, giá trị của bảng xếp hạng và hướng dẫn về phương thức tốt/xấu
- [Eval Harness](/docs/network/specifications/harness) — cách chạy đánh giá và tạo run card
- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — định dạng tập dữ liệu, EDTeKLA, FLORES+
- [Xây dựng một Phương thức](/docs/network/specifications/methods) — giao diện phương thức và đặc tả method card
- [Bảng xếp hạng Phương thức](https://champollion.dev/leaderboard) — điểm số benchmark trực tiếp
- [Đặc tả Benchmark](/docs/network/specifications/benchmark) — giao thức đánh giá, định dạng ngữ liệu, schema của run card
- [Đặc tả Tính điểm](/docs/network/specifications/scoring) — SSOT (nguồn thông tin gốc duy nhất) cho các chỉ số, trọng số tổng hợp và phân hạng chất lượng
