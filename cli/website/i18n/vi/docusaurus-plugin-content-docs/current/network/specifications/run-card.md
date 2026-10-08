---
sidebar_position: 4
title: "Đặc tả Run Card"
---

# Đặc tả Run Card

> **Tóm tắt tổng quan.** Run card là đơn vị nguyên tử của quá trình benchmarking — một tài liệu JSON ghi lại cấu hình hoàn chỉnh, kết quả theo từng mục và điểm số tổng hợp của một lượt đánh giá (evaluation run). Trang này cung cấp tài liệu về schema, các trường thông tin, cơ chế tạo mã định danh (fingerprint) và cấu trúc điểm số. Xem [Đặc tả Benchmark](/docs/network/specifications/benchmark) để biết các định nghĩa chuẩn hóa.

Run card là bản ghi hoàn chỉnh của một lượt đánh giá đơn lẻ. Nó chứa mọi thông tin cần thiết để hiểu, tái lập và xác minh thử nghiệm: cấu hình, điểm số, kết quả riêng lẻ, lượng token sử dụng và siêu dữ liệu môi trường.

**Phiên bản Schema:** 2.0

:::info[Lược đồ chuẩn]
[Quy cách Benchmark](/docs/network/specifications/benchmark) là nguồn chân lý duy nhất (single source of truth) cho schema của run card. Để biết định nghĩa các số liệu và cách tính điểm các lần chạy (tiêu đề chrF++, các số liệu tiêu chuẩn đi kèm, các chẩn đoán), hãy xem [Quy cách Chấm điểm](/docs/network/specifications/scoring). Trang này ghi lại tài liệu về cách triển khai hiện tại.
:::

---

## Các trường cấp cao nhất

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 được tạo khi bắt đầu lần chạy |
| `harness_version` | `string` | Phiên bản ngữ nghĩa (Semantic version) của harness đã tạo thẻ này (ví dụ: `2.0`) |
| `model_slug` | `string` | Slug của mô hình được dùng cho lần chạy (ví dụ: `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Định danh mô hình đã phân giải được trả về bởi API (ví dụ: `gemini-3.1-pro-001`) |
| `condition` | `string` | Nhãn thử nghiệm: nội dung harness ghi là `naive` (prompt tích hợp sẵn của nó), `coached` (một tệp coaching đã thay thế nó) hoặc, đối với plugin phương thức, là lớp phương thức (method class) của nó; văn bản tự do, do đó thẻ được tạo thủ công có thể ghi `coached-v3` hoặc `few-shot`. Không phải là nhãn chất lượng (các bậc chất lượng đã ngừng sử dụng; `scores.quality_tier` là null trên mọi thẻ mới) |
| `timestamp` | `string` | Mốc thời gian ISO 8601 UTC khi lần chạy bắt đầu |
| `elapsed_seconds` | `number` | Thời gian thực tế (wall-clock duration) của toàn bộ lần chạy |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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
| `api_provider` | `string` | Thành phần truyền tải văn bản: nhà cung cấp API cho luồng LLM riêng của harness (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); id của engine cho một MT engine (ví dụ: `google-translate`); đối với plugin phương thức, là `local` khi người vận hành xác nhận việc truyền tải hoàn toàn cục bộ (`--attest-local-transport`), nếu không thì là `method-plugin` |
| `temperature` | `number` | Nhiệt độ lấy mẫu (sampling temperature) |
| `max_tokens` | `number` | Số token tối đa cho mỗi completion |
| `batch_size` | `number` | Số mục trên mỗi batch đồng thời |
| `concurrency` | `number` | Số yêu cầu API song song tối đa |
| `coaching_file` | `string` | Đường dẫn đến tệp coaching prompt, nếu có sử dụng (bản ghi riêng của nhật ký lần chạy; thẻ đã xuất bản đặt tên coaching theo tên tệp, hoặc `inline coaching` cho văn bản `--coaching` — không bao giờ là đường dẫn cục bộ) |
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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` luôn là `null` trên thẻ mới: các bậc chất lượng đã ngừng sử dụng. Tất cả các trường đều dùng **camelCase** và tuân theo schema MethodConfig chuẩn (xem [Xây dựng Phương thức](/docs/network/specifications/methods)).
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

Danh sách chuẩn nằm tại [Quy cách Benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint). Tóm tắt ngắn gọn:

| Thành phần | Mô tả |
|-----------|-------------|
| `dataset_sha256` | Mã hash của tệp tập dữ liệu |
| `model_slug` | Mô hình được sử dụng (đối với MT engine hoặc plugin phương thức, là engine id hoặc method id) |
| `condition` | Nhãn điều kiện thử nghiệm |
| `system_prompt_sha256` | Mã hash của system prompt |
| `temperature` | Nhiệt độ lấy mẫu |
| `batch_size`, `tools_enabled` | Việc xử lý theo đợt (batching) và sử dụng công cụ |
| `harness_version` | Phiên bản harness |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Phiên bản 2 (harness 0.2.0 trở lên): kênh, endpoint host (đã hash), giới hạn token, cùng với phiên bản và mã hash code của phương thức |
| `method_model`, `method_dependencies_sha256` | Phiên bản 2, chỉ dành cho các lần chạy plugin phương thức: mô hình được chuyển cho plugin (`-m`) và mã hash của `dependencies` đã khai báo của nó |
| `method_model`, `method_model_sha256` | Phiên bản 2, chỉ dành cho các lần chạy `--method local-model`: mô hình đã tải (Hugging Face id hoặc tên thư mục) và mã hash nội dung của nó (đối với thư mục) hoặc revision (đối với Hugging Face id) |

`fingerprint.version` cho biết thẻ đã được hash theo danh sách nào.

### `engine_model`

Một lần chạy MT engine chạy mô hình được cung cấp (`--method local-model -m <model>`) sẽ mang theo thông tin mô hình đã tải:

| Trường | Mô tả |
|-------|-------------|
| `given` | Những gì `-m` trả về |
| `kind` | `directory` hoặc `hub` (một Hugging Face id) |
| `id` | Hugging Face id, hoặc tên của thư mục (không bao giờ là đường dẫn cục bộ) |
| `sha256` | Chỉ dành cho thư mục: SHA-256 trên danh sách tệp theo định dạng `sha256sum` |
| `revision` | Chỉ dành cho Hugging Face id: revision đã tải |
| `family`, `backend` | `opus`, `nllb` hoặc `madlad`; `transformers` hoặc `ctranslate2` |
| `decode` | Độ dài tối đa của kết quả đầu ra: độ dài mà mô hình khai báo, hoặc quy tắc của harness (`max(64, 4 × source tokens)` token mới, giới hạn ở số vị trí của bộ giải mã - decoder) |
| `pair_mismatch` | Chỉ xuất hiện khi mô hình cặp OPUS-MT cho một cặp ngôn ngữ khác được chủ ý chạy (`--allow-model-pair-mismatch`) |

`method_config.model` đặt tên cho cùng một mô hình (`<id>@<revision>`, hoặc `<directory name>@sha256:<hash>`). Nhật ký lần chạy `local-model` không ghi lại mô hình nào sẽ không xuất bản gì: thẻ sẽ báo `engine_model_unrecorded` và `mt-eval publish` sẽ từ chối nó.

### `method_plugin`

Một lần chạy plugin phương thức (`--method <plugin dir>`) cũng mang theo thông tin định danh plugin, như runner đã ghi lại:

| Trường | Mô tả |
|-------|-------------|
| `version` | Phiên bản mà `method.json` khai báo (`null` khi không khai báo) |
| `code_sha256` | SHA-256 trên các tệp của plugin (`method.json` và các tệp `.py` của nó, một manifest theo kiểu `sha256sum`) |
| `model_given` | Mô hình mà plugin được nhận qua `-m/--model`, hoặc `null` |
| `models_called`, `models_basis` | (Các) mô hình mà plugin báo cáo là đã gọi, và liệu điều đó được quan sát từ kết quả hay được khai báo |
| `dependency_class` | Lớp phụ thuộc (dependency class) mà `method.json` khai báo |
| `dependencies` | Danh sách `dependencies` mà `method.json` khai báo, không bao gồm văn bản tự do `notes` |
| `dependencies_sha256` | SHA-256 của toàn bộ danh sách đã khai báo (thành phần fingerprint) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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
| `exact_matches` | `number` | Các mục mà đầu ra khớp chính xác với bản chuẩn (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | **Từ** đầu ra mà bộ phân tích FST chấp nhận, tính tổng trên tất cả các mục (không phải số lượng mục). `null` nếu không dùng bộ phân tích FST |
| `fst_acceptance_rate` | `number` | Giá trị trung bình của tỷ lệ chấp nhận trên mỗi mục (số từ được chấp nhận của mỗi mục ÷ số từ của mục đó; đầu ra trống tính là 0), 0.0–1.0. Đây **không phải** là `fst_accepted` ÷ tổng số từ — tỷ lệ từ gộp đó là `corpus_validity_rate` của báo cáo, hiển thị trên run card dưới dạng "Words accepted". `null` nếu không dùng bộ phân tích FST |
| `chrf_plus_plus` | `number` | **Số liệu tiêu đề và xếp hạng chính:** chrF++ cấp độ ngữ thể (corpus-level) (sacreBLEU chrF, `word_order=2`), 0–100. Khoảng tin cậy bootstrap 95% của nó là `confidence_intervals.corpus_chrf` và chữ ký của nó là `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` trên mọi thẻ mới. Thẻ không có trường này đã được chấm điểm theo điểm tổng hợp đã ngừng sử dụng (`legacy-composite`) và được xác minh theo cách đó |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Các số liệu tiêu chuẩn hiển thị bên cạnh chrF++, không bao giờ pha trộn (BLEU là `corpus_bleu` cấp cao nhất của thẻ; COMET là `comet_score` với `comet_model`, khi được tính toán) |
| `sacrebleu_signatures` | `object` | Chữ ký sacreBLEU của từng số liệu sacreBLEU được tính toán: `chrf` (tiêu đề), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | Các khoảng bootstrap 95%; `corpus_chrf` là của chỉ số tiêu đề |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Đã ngừng sử dụng.** Luôn là `null` trên thẻ mới. Thẻ cũ vẫn giữ các giá trị đã lưu trữ; giao diện nào vẫn hiển thị điểm tổng hợp này sẽ dán nhãn là "legacy composite (retired)" |
| `errors` | `number` | Các mục bị lỗi (lỗi API, timeout, v.v.) |
| `avg_latency_seconds` | `number` | Thời gian phản hồi trung bình trên tất cả các mục |
| `median_latency_seconds` | `number` | Thời gian phản hồi trung vị |
| `p95_latency_seconds` | `number` | Thời gian phản hồi ở phân vị thứ 95 |

### `by_difficulty`

Điểm số được phân chia theo bậc độ khó, có khóa theo bậc (`"1"`–`"5"`, `"0"` cho trường hợp chưa xếp hạng). Các trường này **không phải** là các trường ở cấp cao nhất: `avg_chrf` và `avg_bleu` là **giá trị trung bình trên từng câu** của chrF++ và BLEU trên các mục thuộc bậc đó, trong khi `chrf_plus_plus` và BLEU ở cấp cao nhất là **cấp độ ngữ thể (corpus-level)** (được tính toán trên tất cả các phân đoạn cùng một lúc). Đây là hai số liệu thống kê khác nhau: đặc biệt, BLEU cấp ngữ thể thường thấp hơn nhiều so với giá trị trung bình của BLEU cấp câu, vì vậy con số tiêu đề 0.5 đặt cạnh giá trị bậc 10.2 không phải là mâu thuẫn. Hãy so sánh các bậc với nhau, đừng bao giờ so sánh với số liệu tiêu đề.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

Chỉ xuất hiện khi có yếu tố nào đó làm hạn chế ý nghĩa của điểm số. Một điểm số có thể được tính toán chính xác nhưng vẫn không phản ánh đúng những gì nhãn của nó thể hiện, vì vậy điều kiện hạn chế luôn đi kèm với con số: `mt-eval test`, `mt-eval card`, `mt-eval compare`, bảng điều khiển (dashboard) và bản xem trước `mt-eval publish` sẽ in nó ngay cạnh số liệu tiêu đề, còn `publish` lưu trữ nó tại đây để hiển thị trên bảng xếp hạng (leaderboard). Nó không bao giờ thay đổi điểm số: số liệu tiêu đề chrF++ vẫn được tính toán như bình thường, và lưu ý (caveat) sẽ nêu rõ điều gì giới hạn nó hoặc một chẩn đoán bên cạnh.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` hoặc `near_constant_output` |
| `source` | `string` | Đơn vị đo lường: `nmt-forge` hoặc `mt-eval-harness` |
| `severity` | `string` | `major` (đọc số liệu tiêu đề kèm theo điều kiện này) hoặc `minor` |
| `message` | `string` | Một câu, tối đa 480 ký tự |

**`train_test_near_twin`**, được ghi bởi nmt-forge. Khi `nmt-forge export` (hoặc `evaluate`) chấm điểm một mô hình, nó sẽ kiểm tra từng hàng kiểm thử xem có bản sao gần như trùng khớp trong dữ liệu huấn luyện hay không và ghi lại kết quả vào các tệp mt-eval mà nó tạo ra. Harness sao chép thông số đó vào thẻ: `near_twin_rows` trong số `n` hàng kiểm thử có bản sao (`near_twin_share`), và `strict_n` hàng không có. Khi có đủ số lượng các hàng đó, `strict_corpus_chrf` và `strict_corpus_chrf_ci` sẽ cung cấp điểm chrF++ riêng cho chúng, đây chính là con số thể hiện khả năng khái quát hóa (generalization). `recall_not_translation` là `true` khi có ít nhất một nửa số hàng có bản sao. Khi đó, ngay cả điểm chrF++ đạt 100 cũng chỉ đo lường mức độ mô hình nhớ lại các cụm từ huấn luyện, chứ không phải khả năng dịch thuật của nó. Nếu bước kiểm tra của forge không chạy, lưu ý sẽ là `minor` và nêu rõ điều đó. Bước kiểm tra nếu không tìm thấy bản sao nào sẽ không thêm lưu ý.

**`length_inflation`**, được đo bởi harness. Lưu ý này được thêm vào khi đầu ra có độ dài trung bình gấp hơn 2 lần độ dài văn bản tham chiếu (ngưỡng phồng của [`length_ratio`](/docs/network/specifications/scoring)), hoặc khi có ít nhất một phần tư số mục được chấm điểm gặp tình trạng này. Các ví dụ few-shot bị rò rỉ, ghi chú hoặc văn bản lặp lại làm tăng độ dài đầu ra, và các điểm số dựa trên tham chiếu khi đó sẽ đo lường điều này. Các trường gồm `mean_length_ratio`, `inflated_entries` trên `scored_entries`, `ratio_bound` và `share_bound`.

**`length_deflation`**, được đo bởi harness. Đây là mặt đối lập của `length_inflation`: đầu ra **ngắn hơn** nhiều so với tham chiếu, tức là các từ đã bị bỏ sót. Lưu ý này được thêm vào khi đầu ra có độ dài trung bình dưới 0.5 lần độ dài tham chiếu (ngưỡng cắt ngắn của [`length_ratio`](/docs/network/specifications/scoring)), hoặc khi có ít nhất một phần tư số mục được chấm điểm gặp tình trạng này. Một số chẩn đoán chỉ đánh giá các từ có trong đầu ra: tỷ lệ chấp nhận FST và chuyển mã (code-switching). Hệ thống bỏ qua những gì nó không dịch được sẽ làm tăng các chỉ số này. Khi lần chạy có một trong các chỉ số đó, lưu ý sẽ là `major` và khuyến cáo không nên coi chúng là chất lượng khi đặt cạnh các lần chạy dịch toàn bộ. Chỉ số tiêu đề chrF++ tính trọng số cho độ bao phủ (recall), do đó nó sẽ tính đến các từ bị thiếu. Khi cả hai số liệu này đều không xuất hiện (chỉ có chrF++ và khớp chính xác), nó sẽ là một ghi chú `minor`. Các trường gồm `mean_length_ratio`, `short_entries` trên `scored_entries`, `ratio_bound`, `share_bound` và `emitted_only_metrics`.

**`source_copy`**, được đo bởi harness. Lưu ý này được thêm vào khi có ít nhất một nửa số đầu ra được chấm điểm là bản sao của nguồn (bỏ qua chữ hoa/chữ thường, dấu phụ và dấu câu). Các dòng có tham chiếu chính là nguồn, chẳng hạn như tên riêng, sẽ được bỏ qua. Các số liệu không so sánh với tham chiếu vẫn có thể tính điểm cho các từ được sao chép. Các trường gồm `copies` trên `considered_entries`, `copy_share` và `share_bound`.

**`near_constant_output`**, được đo bởi harness. Một đầu ra duy nhất được trả về cho nhiều đầu vào *khác nhau*. Đầu ra và nguồn được so sánh mà không xét đến chữ hoa/chữ thường, dấu câu và khoảng trắng; các dấu phụ (diacritics) vẫn được tính, vì giữa hai đầu ra chúng giúp phân biệt các từ. Một đầu ra được xem là lặp lại xuyên nguồn (cross-source repeat) khi có ít nhất 3 nguồn riêng biệt nhận được nó (5 nguồn nếu nó dài một hoặc hai từ, do các câu trả lời ngắn thường có lý do chính đáng để lặp lại). Đầu ra khớp với tham chiếu của chính nó là câu trả lời đúng và không bị tính vào đây. Lưu ý này được thêm vào khi các trường hợp lặp lại chiếm ít nhất một phần tư số nguồn riêng biệt, và tối thiểu là 5 nguồn. Nó luôn là `major`. Khi lần chạy chứa số liệu đánh giá đầu ra mà không cần tham chiếu (độ chấp nhận FST, chuyển mã), thông báo sẽ nêu tên số liệu đó: số liệu như vậy sẽ cộng điểm cho một câu hợp lệ mỗi khi nó xuất hiện. Các trường gồm `repeated_sources` trên `considered_sources`, `repeat_share`, `repeated_outputs`, `top_output_sources` và `top_output_words` (đầu ra lặp lại nhiều nhất: bao nhiêu nguồn nhận được nó, và độ dài của nó), `share_bound`, `min_repeats`, `min_sources`, `min_sources_short` và `emitted_only_metrics`. Đây chỉ là các số đếm: lưu ý không bao giờ chứa văn bản của đầu ra.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

Trường này nằm bên trong tệp JSON của run card đã lưu trữ, do đó nó không cần cột trong cơ sở dữ liệu. Nó không phải là một phần của [fingerprint](#fingerprint): nó mô tả kết quả chứ không phải thử nghiệm.

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

- [Đánh giá MT](/docs/network/leaderboard/rules) — tổng quan, giá trị trên bảng xếp hạng và hướng dẫn về phương thức tốt/xấu
- [Eval Harness](/docs/network/specifications/harness) — cách chạy đánh giá và tạo run card
- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — định dạng tập dữ liệu, EDTeKLA, FLORES+
- [Xây dựng Phương thức](/docs/network/specifications/methods) — giao diện phương thức và quy cách method card
- [Bảng xếp hạng Phương thức](https://champollion.dev/leaderboard) — điểm benchmark trực tiếp
- [Quy cách Benchmark](/docs/network/specifications/benchmark) — giao thức đánh giá, định dạng ngữ liệu, schema của run card
- [Quy cách Chấm điểm](/docs/network/specifications/scoring) — SSOT cho các số liệu và cách tính điểm các lần chạy
