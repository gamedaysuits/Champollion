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
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: cookbook
  - label: "Measurement rules"
    to: /docs/agents/measurement
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
python3 -m pip install mt-eval-harness
```

---

## Bước 1: Chạy Harness

Harness sẽ chấm điểm phương thức của bạn dựa trên một bộ dữ liệu chuẩn hóa:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name
```

| Cờ | Chức năng |
|---|---|
| `--corpus` | Đường dẫn tệp kho ngữ liệu hoặc id kho ngữ liệu đã đăng ký (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug mô hình chính xác — id OpenRouter đầy đủ (vd: `google/gemini-3.1-pro-preview`); các bí danh ngắn và id không cố định (`…-latest`) sẽ bị từ chối. Với `--method <plugin dir>`, mô hình được truyền cho plugin của bạn dưới dạng `config.method_model` (bất kỳ cách đặt tên nào mà plugin của bạn sử dụng) |
| `-n, --name` | Nhãn dễ đọc cho lượt chạy của bạn (hiển thị trên bảng xếp hạng) |
| `--temperature` | Nhiệt độ lấy mẫu (mặc định `0.0`: tất định, giá trị mặc định duy nhất trong `shared/model-defaults.json`) |
| `--publish` | Xuất bản thẻ lượt chạy lên bảng xếp hạng khi lượt chạy hoàn tất |

Harness tạo ra một **run card** — một tệp JSON độc lập chứa điểm số của bạn, mã hash của bộ dữ liệu, slug của mô hình và một dấu vân tay mã hóa liên kết kết quả với cấu hình thử nghiệm chính xác.

---

## Bước 2: Xem lại Run Card của bạn

Mỗi lượt chạy sẽ ghi hai tệp vào `eval/logs/harness/`: nhật ký lượt chạy `<run-id>.json`
và báo cáo đã chấm điểm `<run-id>_report.json`. Báo cáo chính là nội dung bạn xuất bản.
Hãy kiểm tra nó trước:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Các trường chính trong khối `overall` của báo cáo:
- `corpus_chrf` — chrF++ ở cấp độ ngữ liệu (0–100), chỉ số tiêu đề và xếp hạng
  chính. Khoảng tin cậy bootstrap 95% của nó là `confidence_intervals.corpus_chrf` và
  chữ ký sacreBLEU của nó là `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) và `primary_metric`
  (`"chrf_plus_plus"`) — tiêu chuẩn mà theo đó báo cáo được chấm điểm
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — các chỉ số tiêu chuẩn khác,
  hiển thị bên cạnh chrF++ và không bao giờ bị trộn lẫn với nó
- `exact_match_rate` — chỉ số chẩn đoán: tỷ lệ bản dịch hoàn hảo
- `confidence_intervals` — các khoảng bootstrap cho những chỉ số trên
- `total_cost_usd` — chi phí của lượt chạy (`null` khi mô hình không có giá
  được công bố, ví dụ: mô hình cục bộ; không bao giờ được báo cáo là $0)

Báo cáo cũng ghi lại những gì mô hình được chỉ dẫn, dưới dạng một con trỏ
(`instructions`: tên tệp hướng dẫn và mã SHA-256, mã SHA-256 của prompt
hệ thống, và nơi lưu toàn bộ văn bản — nhật ký lượt chạy trên máy của bạn). Thẻ
lượt chạy được gửi đến bảng xếp hạng được tổng hợp từ báo cáo này. Nó bổ sung
thẻ phương pháp và dấu vân tay tái lập, đồng thời dẫn đầu với cùng
chỉ số chrF++ và CI; `composite` và `quality_tier` của nó là `null`, vì cả hai đều đã
[ngừng sử dụng](/docs/network/specifications/scoring#how-runs-are-scored). (Một báo cáo
được tạo trước tiêu chuẩn này có thể chứa `published_composite`; đó là chỉ số tổng hợp
cũ, đã ngừng sử dụng, và không bao giờ được so sánh với chrF++.)
`mt-eval publish <report> --dry-run` sẽ in thẻ ra chính xác như cách nó sẽ được
xuất bản. Xem [Quy cách Thẻ lượt chạy](/docs/network/specifications/run-card)
để biết cấu trúc schema của nó.

---

## Bước 3: Gửi

Việc xuất bản sẽ ghi trực tiếp vào bảng xếp hạng **đang hoạt động**, vì vậy nó yêu cầu một
`--prod` rõ ràng — nếu không có, harness sẽ từ chối và thông báo cho bạn. Hãy xem trước:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Để xuất bản trực tiếp từ một lượt chạy, hãy thêm `--publish --prod` vào `mt-eval run`. Nếu
bước xuất bản thất bại, điểm số của lượt chạy vẫn được lưu lại và harness sẽ in ra
lệnh thử lại chính xác. Thiết lập `MT_EVAL_ALLOW_PROD=1` trong môi trường tương đương
với `--prod` đối với các script.

:::note[API gửi dữ liệu và tải lên qua web chưa hoạt động]
Một endpoint `POST https://champollion.dev/api/leaderboard/submit` và
giao diện tải lên Bảng xếp hạng đã được lên kế hoạch nhưng **chưa được triển khai**. Cho đến khi chúng được phát hành,
cách gửi dữ liệu duy nhất hoạt động là `mt-eval publish` (không hỗ trợ tiếp nhận qua
pull-request).
:::

---

## Điều gì xảy ra tiếp theo

1. Bài nộp của bạn được xác thực (mã băm tập dữ liệu, tính toàn vẹn của thẻ lượt chạy)
2. Kết quả xuất hiện trên bảng xếp hạng dưới dạng **Tự đánh giá chuẩn** (bậc tin cậy 1)
3. Trạng thái **Được Champollion xác minh** có được từ việc chấm điểm lại các đầu ra bạn đã nộp dựa trên kho ngữ liệu đã ghim mã SHA. Bộ chấm điểm lại là một lệnh do người duy trì chạy thủ công; không có gì chạy lệnh này khi nộp bài và cũng không có gì lên lịch cho nó, vì vậy hiện tại mọi hàng đều giữ nguyên trạng thái tự đánh giá chuẩn ([các bậc xác minh](/docs/network/leaderboard/rules#verification-tiers))
4. Một vị trí trên bảng xếp hạng mở không chuyển giao bất kỳ quyền nào. Quyền đối với một phương pháp chỉ được chuyển giao theo các điều khoản giải thưởng đã công bố của một cuộc thi kín, được công bố trước khi bất kỳ ai tham gia ([Quyền sở hữu & Điều khoản](/docs/network/sovereignty/ownership-transfer))

---

## Xem thêm

- [Cách sử dụng Harness](/docs/network/specifications/harness) — tài liệu tham khảo CLI đầy đủ
- [Quy tắc Bảng xếp hạng](/docs/network/leaderboard/rules) — tiêu chí gửi và chính sách chống gian lận
- [Xây dựng một Phương thức](/docs/network/specifications/methods) — giao thức TranslationMethod
- [Bộ dữ liệu](/docs/network/leaderboard/datasets) — các bộ dữ liệu đánh giá hiện có
