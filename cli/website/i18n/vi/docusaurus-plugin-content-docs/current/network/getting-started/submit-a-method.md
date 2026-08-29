---
sidebar_position: 1
title: "Gửi một phương thức"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Gửi một Phương thức

> **Tóm tắt nhanh.** Hướng dẫn từng bước để gửi lượt chạy thử nghiệm (benchmark run) đầu tiên của bạn lên bảng xếp hạng. Cài đặt harness, chạy thử nghiệm với một bộ dữ liệu, xem lại run card của bạn và xuất bản. Mất 10 phút nếu bạn có API key.

Hướng dẫn này sẽ dẫn dắt bạn qua các bước để gửi lượt chạy thử nghiệm đầu tiên của mình lên bảng xếp hạng Network.

---

## Điều kiện tiên quyết

- **Python 3.11+**
- **Một API key của OpenRouter** (hoặc tương đương cho nhà cung cấp mô hình của bạn)
- **Một phương thức dịch thuật** — bất kỳ thứ gì tạo ra bản dịch từ văn bản nguồn

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## Bước 1: Chạy Harness

Harness sẽ chấm điểm phương thức của bạn dựa trên một bộ dữ liệu chuẩn hóa:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Flag | Chức năng |
|---|---|
| `--corpus` | Đường dẫn tệp ngữ liệu hoặc ID ngữ liệu đã đăng ký (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug của mô hình — tên viết tắt (ví dụ: `gemini-pro`) hoặc ID OpenRouter đầy đủ |
| `-n, --name` | Nhãn dễ đọc cho lượt chạy của bạn (hiển thị trên bảng xếp hạng) |
| `--temperature` | Nhiệt độ lấy mẫu (sampling temperature) (thấp hơn = mang tính xác định cao hơn) |
| `--fst-retries` | Tùy chọn: số lần thử lại FST |
| `--publish` | Xuất bản run card lên bảng xếp hạng khi lượt chạy kết thúc |

Harness tạo ra một **run card** — một tệp JSON độc lập chứa điểm số của bạn, mã hash của bộ dữ liệu, slug của mô hình và một dấu vân tay mã hóa liên kết kết quả với cấu hình thử nghiệm chính xác.

---

## Bước 2: Xem lại Run Card của bạn

Các run card được lưu vào `eval/logs/harness/`. Hãy kiểm tra kỹ run card của bạn trước khi gửi:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Các trường quan trọng cần kiểm tra:
- `scores.chrf_plus_plus` — chỉ số chất lượng chính của bạn
- `scores.exact_match_rate` — tỷ lệ bản dịch hoàn hảo
- `scores.fst_acceptance_rate` — tính hợp lệ về mặt hình thái (nếu có sử dụng FST)
- `totals.total_cost_usd` — chi phí của lượt chạy
- `fingerprint` — mã hash khả năng tái lập của thử nghiệm

Xem [Thông số kỹ thuật Run Card](/docs/network/specifications/run-card) để biết schema đầy đủ.

---

## Bước 3: Gửi

### Xuất bản tự động

Nếu bạn đã truyền `--publish` khi chạy harness, run card của bạn đã được tải lên thành công.

### Xuất bản thủ công

Xuất bản bất kỳ run card nào bằng harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Nếu bạn không muốn sử dụng quy trình xuất bản tự động, hãy mở một pull request tới
[kho lưu trữ eval harness](https://github.com/gamedaysuits/Champollion)
với tệp JSON run card của bạn nằm trong thư mục `results/`.

:::note[API gửi dữ liệu và tải lên qua web chưa hoạt động]
Một endpoint `POST https://champollion.dev/api/leaderboard/submit` và một
giao diện tải lên Leaderboard đã được lên kế hoạch nhưng **chưa được triển khai**. Cho đến khi chúng được phát hành,
các con đường gửi dữ liệu duy nhất hoạt động là `mt-eval publish` và một pull request đến
repo harness ở trên.
:::

---

## Điều gì xảy ra tiếp theo

1. Bản gửi của bạn được xác thực (mã băm dataset, tính toàn vẹn của run card)
2. Kết quả xuất hiện trên bảng xếp hạng dưới dạng **Tự đánh giá** (cấp độ tin cậy 1)
3. Để đạt được trạng thái **Champollion Verified**, hãy gửi phương pháp của bạn dưới dạng một plugin có thể cài đặt để những người bảo trì có thể tái tạo lại kết quả của bạn
4. Đối với các phương pháp dành cho ngôn ngữ bản địa: nếu phương pháp của bạn đạt vị trí đứng đầu, quá trình [chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer) sẽ bắt đầu

---

## Xem thêm

- [Cách sử dụng Harness](/docs/network/specifications/harness) — tài liệu tham khảo CLI đầy đủ
- [Quy tắc Bảng xếp hạng](/docs/network/leaderboard/rules) — tiêu chí gửi và chính sách chống gian lận
- [Xây dựng một Phương thức](/docs/network/specifications/methods) — giao thức TranslationMethod
- [Bộ dữ liệu](/docs/network/leaderboard/datasets) — các bộ dữ liệu đánh giá hiện có
