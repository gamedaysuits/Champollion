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
    to: https://champollion.dev/docs/getting-started/configuration
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Tóm tắt nhanh.** Trang này hướng dẫn cài đặt, cấu hình và sử dụng bộ công cụ đánh giá dịch máy (MT evaluation harness) — công cụ dùng để đo kiểm (benchmark) các phương pháp dịch thuật dựa trên các kho ngữ liệu chuẩn hóa và tạo ra các thẻ kết quả (run card) có tính điểm. Để xem định nghĩa chuẩn của các chỉ số, schema và giao thức đánh giá, hãy xem [Benchmark Specification](/docs/network/specifications/benchmark).

Bộ công cụ này chạy các thử nghiệm dịch thuật và tạo ra các thẻ kết quả (run card). Nó xử lý việc dựng prompt, gọi API, tính điểm và tuần tự hóa kết quả — bạn chỉ cần cung cấp tập dữ liệu và mô hình.

## Cài đặt

**Yêu cầu:** Python 3.11+

```bash
python3 -m pip install mt-eval-harness
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
| `--source-file` / `--reference-file` | — | — | Các tệp văn bản song ngữ (định dạng FLORES+, WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Slug mô hình chính xác: id đầy đủ trên OpenRouter, hoặc tên chính xác riêng của nhà cung cấp trực tiếp. Không dùng bí danh và không dùng id biến động (`~vendor/…`, `…-latest`): tên ngắn như `gemini-pro` sẽ bị từ chối, và thông báo từ chối sẽ nêu rõ slug cần ghi. Phân tách bằng dấu phẩy cho các lượt chạy nhiều mô hình. Với `--method local-model`, đây là mô hình cần chạy — một id Hugging Face hoặc một thư mục mô hình — và là bắt buộc: công cụ đó không có mô hình mặc định. Với một plugin phương pháp, giá trị này được chuyển cho plugin dưới dạng `config.method_model`. Bất kỳ công cụ MT nào khác sẽ dịch bằng mô hình riêng của nó và lượt chạy sẽ báo `-m` không được sử dụng |
| `-d, --dataset` | — | `all` | Bộ lọc tập dữ liệu: `all`, tên phân đoạn hoặc dải ID |
| `--ids` | — | — | Các ID mục cần đánh giá, phân tách bằng dấu phẩy |
| `--source-lang` | — | `English` | Tên ngôn ngữ nguồn |
| `--target-lang` | — | — | Tên ngôn ngữ đích, như được nêu trong câu lệnh (prompt). Mã được cung cấp ở đây (`sme`) được đặt tên theo thẻ ngôn ngữ của nó ("Northern Sami"), và phần đầu lượt chạy sẽ thông báo điều đó; mã không có thẻ nào đặt tên (mã dùng riêng `qaa`) vẫn giữ nguyên là mã, kèm cảnh báo rằng câu lệnh sẽ chứa mã này |
| `-p, --prompt` | — | `naive` | Phiên bản câu lệnh (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Đường dẫn đến tệp văn bản câu lệnh chỉ dẫn (coaching prompt). Tệp này **thay thế** câu lệnh tích hợp sẵn: mô hình nhận được tệp đúng như nội dung đã viết (cộng với dòng `--target-script`), chứ không phải chỉ dẫn tích hợp sẵn "Translate the given … text to …; output only the translation". Lượt chạy thử (dry run) và phần đầu lượt chạy thông báo điều này qua một kết luận: ✓ khi tệp nêu tên ngôn ngữ đích (và theo tên hoặc mã nào), ⚠ khi tệp không nêu cả tên lẫn mã ngôn ngữ, hoặc không kiểm tra khi không biết tên hoặc mã nào |
| `--glossary` | — | — | Bảng thuật ngữ đánh giá (JSON) để kiểm tra mức độ tuân thủ thuật ngữ; chỉ dùng để chấm điểm, không bao giờ gửi tới mô hình |
| `--coaching` | — | — | Văn bản chỉ dẫn nội dòng (chuỗi trong dấu ngoặc kép) |
| `--method` | — | — | Đường dẫn đến thư mục plugin phương pháp (chứa `method.json` + mô-đun Python), hoặc một công cụ MT đã đăng ký (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Với `--method local-model`: chạy mô hình cặp OPUS-MT có id chỉ định cặp khác với cặp của ngữ liệu (`opus-mt-en-fi` trên ngữ liệu `eng>sme`, dưới dạng đường cơ sở ngôn ngữ liên quan). Bị từ chối nếu thiếu cờ này; thẻ lượt chạy sẽ ghi nhận điều đó |
| `--method-card` | — | — | Đường dẫn đến tệp JSON thẻ phương pháp cho siêu dữ liệu bảng xếp hạng |
| `--skip-fst` | — | `false` | Chấm điểm mà không tính độ chấp nhận FST, ngay cả khi ngôn ngữ có FST, và không đưa ra thông báo nào thêm về điều đó. Thẻ lượt chạy sẽ đánh dấu là chưa tính toán. Nếu không có cờ này, việc thiếu FST (bộ phân tích hoặc runtime pyhfst của nó) cũng không làm dừng lượt chạy: quá trình vẫn tiếp tục, thẻ lượt chạy đánh dấu độ chấp nhận FST và hình thái học là chưa tính toán, và thông báo sẽ nhắc đến `mt-eval setup --lang <code>`. Sau khi cài đặt gói đó, `mt-eval test <run log>` sẽ thêm điểm FST vào lượt chạy đã hoàn thành mà không cần dịch lại. Không có gì tự động tải xuống cả |
| `--skip-eval-standard` | — | `false` | Chấm điểm mà không dùng các chỉ số tiêu chuẩn đánh giá của thẻ ngôn ngữ (một gói bên ngoài). Thẻ lượt chạy đánh dấu chúng là chưa tính toán. Không có cờ này, các chỉ số của gói đã cài đặt sẽ được tính; một gói chưa được cài đặt được coi là tiện ích bổ sung tùy chọn — lượt chạy vẫn tiến hành mà không có các chỉ số của gói đó (được đánh dấu là chưa tính toán) và nêu rõ `python3 -m pip install` mà thẻ đã khai báo. Lượt chạy sẽ không tự cài đặt bất kỳ thứ gì |
| `--tools` | — | `false` | Bật chế độ gọi công cụ |
| `--tools-list` | — | — | Tên các công cụ, phân tách bằng dấu phẩy |
| `--max-tool-rounds` | — | `8` | Số vòng gọi công cụ tối đa cho mỗi mục |
| `--style-profile` | — | — | Đường dẫn đến tệp JSON hồ sơ văn phong. Bật các chỉ số tính nhất quán của văn phong (chẩn đoán — không bao giờ là một phần của điểm số tiêu đề; xem [§ Chỉ số văn phong và văn cảnh](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Số mục cho mỗi lệnh gọi API |
| `-c, --concurrency` | — | `8` | Số lệnh gọi API song song |
| `--max-tokens` | — | `32768` | Số token tối đa cho mỗi lệnh gọi API |
| `--temperature` | — | `0.0` | Nhiệt độ lấy mẫu (0.0 = tất định) |
| `--no-cache` | — | `false` | Tắt lưu phản hồi vào bộ nhớ đệm |
| `--cache-dir` | — | `eval/cache/harness` | Đường dẫn thư mục bộ nhớ đệm (xem [Bộ nhớ đệm bản dịch](#the-translation-cache)) |
| `--metricx` | — | `false` | Đồng thời tính toán MetricX-24 (Google, Apache-2.0), một điểm số lỗi neural càng thấp càng tốt (0–25), được báo cáo bên cạnh điểm tiêu đề chrF++ và không bao giờ bị trộn lẫn với nó. Cần gói bổ sung `metricx` và mã mô hình của Google (xem [Chỉ số neural tùy chọn](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Cùng với `--metricx`: một checkpoint MetricX khác (bản xl/xxl hoặc bản `google/metricx-25-*`) |
| `--fuse` | — | `false` | Đồng thời tính toán bộ so sánh kiểu FUSE, một bản tái hiện chưa huấn luyện của phương pháp AmericasNLP 2025 FUSE, được báo cáo dưới dạng bộ so sánh chẩn đoán, không bao giờ nằm trong điểm tiêu đề. Cần gói bổ sung `fuse` (xem [Chỉ số neural tùy chọn](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Thư mục đầu ra cho thẻ lượt chạy và nhật ký |
| `-n, --name` | — | — | Tên lượt chạy dễ đọc cho người dùng |
| `--dry-run` | — | `false` | Xác thực cấu hình và ngữ liệu mà không thực hiện lệnh gọi API. Lệnh này nêu tên tệp chỉ dẫn và bảng thuật ngữ mà lượt chạy sẽ sử dụng (hoặc `none`), hiển thị câu lệnh (toàn bộ câu lệnh tích hợp sẵn; với tệp chỉ dẫn thì hiển thị dòng đầu tiên và sha256 của nó, cùng lưu ý rằng nó thay thế câu lệnh tích hợp sẵn), cho biết vị trí bộ nhớ đệm bản dịch, và thực hiện cùng quy trình kiểm tra gói đánh giá như một lượt chạy thực sự, báo cáo trên các dòng bắt đầu bằng `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …` hoặc `none needed for <language>`) mà không gây lỗi. Dòng thứ hai cho biết liệu lượt chạy thực sự có bị dừng hay không: việc thiếu FST không bao giờ làm dừng lượt chạy, trong khi thiếu bất kỳ thành phần nào khác sẽ làm dừng. Dưới `--json`, phần tóm tắt chứa `coaching_file`, `prompt` (loại, sha256 và độ dài; văn bản của câu lệnh tích hợp sẵn), `glossary_file` và `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Mã ngôn ngữ BCP-47 |
| `--target-script` | — | — | Hệ chữ viết ISO 15924 mà các bản dịch phải được viết bằng (`Latn`, `Cans`, …), phải là hệ chữ mà thẻ ngôn ngữ đích liệt kê. Câu lệnh của harness sẽ yêu cầu hệ chữ này (cũng được thêm vào văn bản của tệp chỉ dẫn), do đó nó là một phần trong mã sha256 của câu lệnh. Đối với một ngôn ngữ được viết bằng nhiều hơn một hệ chữ, chẳng hạn như tiếng Plains Cree, hãy sử dụng hệ chữ mà các bản tham chiếu của bạn được viết bằng. Nếu không có cờ này, harness sẽ đếm các ký tự của bản tham chiếu theo hệ chữ (dưới dạng tổng hợp: không có câu nào được hiển thị, vì vậy điều này cũng áp dụng cho ngữ liệu chỉ lưu cục bộ) và yêu cầu hệ chữ chiếm từ 90% trở lên, thông báo điều đó trong phần đầu lượt chạy ("references are 100% Latn → prompting for Latn") và ghi nhận vào nhật ký lượt chạy (`config.target_script_source`); các bản tham chiếu bị trộn lẫn sẽ không nhận hệ chữ nào cùng lời cảnh báo kèm tỷ lệ, và một bản tham chiếu bằng hệ chữ khác khi đó sẽ bị điểm gần bằng không. Bị từ chối đối với công cụ MT hoặc plugin phương pháp, vì chúng không nhận câu lệnh |

`--champollion-config` và `--prompt champollion` đã ngừng sử dụng từ phiên bản 0.2.0 và sẽ bị từ chối kèm lý do. `--champollion-cards-dir` cũng vậy; hãy thiết lập `MT_EVAL_CARDS_DIR` để trỏ harness sang một thư mục thẻ khác. Chúng đã dựng lại lời nhắc của CLI bằng Python, và bản sao đó đã có sự khác biệt so với CLI. Hãy sử dụng một plugin phương pháp (`--method`) để đánh giá một phương pháp CLI, và `mt-eval export-config` để chuyển kết quả trở lại dự án CLI.

### Các chỉ số mạng nơ-ron tùy chọn

COMET được tính toán bất cứ khi nào `unbabel-comet` được cài đặt (`mt-eval setup --comet`: dung lượng cài đặt khoảng 300 MB, và khoảng 2,3 GB mô hình trong lần sử dụng đầu tiên). Hai chỉ số khác sẽ bị tắt trừ khi một lượt chạy yêu cầu chúng, vì mỗi chỉ số đều tải một mô hình lớn. Giống như COMET, chúng chạy trên máy này (không tốn chi phí API, không có văn bản nào được gửi đi đâu), được báo cáo cạnh điểm tiêu đề chrF++ và không bao giờ kết hợp với nó, và thẻ lượt chạy sẽ hiển thị "not run" kèm theo cờ cần truyền khi chúng không được yêu cầu.

| Chỉ số | Cờ | Yêu cầu | Chi phí |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, giá trị càng thấp càng tốt, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) và mã mô hình của Google, vốn không có trên PyPI: `python3 -m pip install git+https://github.com/google-research/metricx` | Checkpoint `google/metricx-24-hybrid-large-v2p6` mặc định và bộ tokenizer mT5-XL sẽ tải xuống vài GB từ Hugging Face trong lần sử dụng đầu tiên; việc chấm điểm sẽ chậm trên CPU. Khi không có bản tham chiếu, chỉ số này sẽ chấm điểm ở chế độ không dùng bản tham chiếu (QE) |
| Bộ so sánh kiểu FUSE (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE tải xuống khoảng 1,8 GB trong lần sử dụng đầu tiên. Nếu không có LaBSE, điểm số sẽ không được tính toán và báo cáo sẽ nêu rõ điều đó. Đây là bản chưa qua huấn luyện (trung bình không tính trọng số của các phần thành phần), và kết quả được gắn cờ `fuse_untrained` |

Qua MCP (cấu hình đầy đủ, `--profile full`), `run_benchmark` nhận `metricx` (với `metricx_model`) và `fuse`, còn `comet: true` yêu cầu COMET; kế hoạch của nó cho biết mỗi thành phần đã được cài đặt hay chưa, và một lượt chạy đã xác nhận yêu cầu thành phần mà harness không thể tính toán sẽ bị từ chối.

Mỗi chỉ số đo lường điều gì và mức độ tin cậy đối với một ngôn ngữ được trình bày chi tiết trong [Chấm điểm](/docs/network/specifications/scoring) và [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability).

### Bộ nhớ đệm bản dịch

Mỗi lượt chạy đều lưu đầu ra của mô hình cho từng câu nguồn vào bộ nhớ đệm (`--cache-dir`, mặc định là `eval/cache/harness` bên dưới thư mục mà lượt chạy bắt đầu), nhờ đó lượt chạy lại với cùng cấu hình có thể tái sử dụng mà không tốn chi phí. Khóa bộ nhớ đệm bao gồm mô hình, lời nhắc khi gửi đi (sha256 của nó), các cài đặt làm thay đổi đầu ra và phiên bản harness, do đó việc thay đổi bất kỳ yếu tố nào trong số đó sẽ không bao giờ trả về đầu ra cũ. Bộ nhớ đệm lưu giữ các bản sao của các câu trong ngữ liệu:

- phần đầu lượt chạy và lượt chạy thử in ra vị trí của nó và số lượng mục nó lưu giữ;
- thư mục chứa `.gitignore`, nên git sẽ bỏ qua nó;
- nó không bao giờ được ghi vào một thư mục `mt-eval contest prepare` được đánh dấu là có thể phát hành (`public/` của nó): `mt-eval run` từ chối `--cache-dir` hoặc `--output-dir` như vậy và chỉ định thư mục `runs/` của cuộc thi ([Tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest));
- một ngữ liệu chỉ dùng cục bộ, được niêm phong hoặc yêu cầu sự đồng thuận sẽ có thư mục `protected/<namespace>/` riêng, được tạo khóa theo cài đặt lượt chạy, sha256 của ngữ liệu và các điều khoản của nó, và mọi tệp tại đó đều mang dấu xác thực của ngữ liệu trong tệp phụ `<file>.champollion.json` ([Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora));
- xóa thư mục để xóa các bản sao, hoặc truyền cờ `--no-cache` để không lưu giữ bất kỳ bản sao nào.

`run_benchmark` của máy chủ MCP (cấu hình đầy đủ) nêu tên bộ nhớ đệm trong kế hoạch và kết quả của nó. Đối với tệp bạn nắm giữ, nó đặt bộ nhớ đệm bên cạnh kết quả của lượt chạy (`<corpus folder>/results/cache/`), và đối với một id ngữ liệu đã đăng ký thì đặt trong thư mục riêng của nó (`~/.champollion-mcp/cache/harness/`). Bộ nhớ đệm đã có sẵn trong `eval/cache/harness` dưới thư mục làm việc của máy chủ từ các lượt chạy trước tiếp tục được sử dụng, do đó kết quả đầu ra của nó không phải trả phí hai lần. Các mục của nó không phụ thuộc vào vị trí của thư mục, vì vậy thư mục này có thể di chuyển được.

### Toàn bộ các lệnh con

Toàn bộ hai mươi lệnh con cấp cao nhất. Mọi cờ của từng lệnh con đều có trong
[tài liệu tham khảo lệnh `mt-eval`](/docs/reference/mt-eval) được tạo tự động; phần này
cho biết công dụng của từng lệnh.

**Chạy và chấm điểm**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval run` | Thực thi một lượt chạy dịch thuật (các cờ ở trên) |
| `mt-eval test <log>` | Phân tích nhật ký lượt chạy đã hoàn tất. `-o <path>` ghi báo cáo vào vị trí khác với `<log>_report.json`, và nhật ký lượt chạy sẽ ghi lại đường dẫn đó để `card` và `compare` có thể tìm thấy. `--glossary <file>` chấm điểm thuật ngữ dựa trên bảng thuật ngữ đó; báo cáo ghi lại tên cùng sha256 của nó, đồng thời thẻ, `compare` và bản xem trước xuất bản sẽ cho biết độ tuân thủ thuật ngữ (một chỉ số chẩn đoán) đã được chấm điểm dựa trên bảng thuật ngữ nào |
| `mt-eval compare <reports…>` | So sánh hai hoặc nhiều lượt chạy (`*_report.json`, hoặc các nhật ký lượt chạy). Mỗi hàng tương ứng với một chỉ số (chrF++, BLEU, spBLEU, TER, …), mỗi cột tương ứng với một lượt chạy được ký hiệu A, B, C…, các chỉ số có giá trị càng thấp càng tốt được đánh dấu; `--significance` bổ sung các kiểm định theo cặp cho từng cặp, mỗi bảng được đặt tên theo các chữ cái của lượt chạy, kèm khoảng tin cậy 95% cho Δ, và nêu rõ rằng các giá trị p được tính riêng cho từng chỉ số và chưa hiệu chỉnh; `--method paired_bootstrap` thay thế phương pháp hoán vị ngẫu nhiên xấp xỉ mặc định bằng bootstrap Koehn ([Ý nghĩa thống kê](/docs/network/specifications/significance)). Ghi tệp `comparison-<hash>.json` (mã băm của các id lượt chạy được so sánh, giúp lần so sánh khác không bao giờ ghi đè lên nó) bên cạnh các báo cáo nếu chúng dùng chung thư mục, ngược lại sẽ ghi vào `comparisons/` trong thư mục chung gần nhất của chúng (không bao giờ ghi vào thư mục riêng của một lượt chạy), trừ khi `-o` chỉ định một tệp cụ thể. Riêng kiểm định chrF++ sẽ quyết định lượt chạy nào tốt hơn; các hàng khác chỉ được hiển thị chứ không dùng để quyết định. Điểm tổng hợp của báo cáo cũ được coi là đã ngừng sử dụng và không được đưa vào so sánh |
| `mt-eval dashboard <logs…>` | Tạo bảng điều khiển HTML tương tác |
| `mt-eval card <run log>` | In đẹp thẻ lượt chạy dễ đọc cho người dùng. Điểm số lấy từ báo cáo của lượt chạy: bên cạnh nhật ký, tại nơi `mt-eval test -o` đã ghi nhận, hoặc `--report <path>`. Lượt chạy không tìm thấy báo cáo sẽ hiển thị NOT SCORED và vị trí đã tìm kiếm, không bao giờ hiển thị các số không. Bạn cũng có thể truyền tệp báo cáo; tệp này sẽ được đọc cùng với nhật ký lượt chạy mà nó ghi nhận |

**Đưa một phương pháp vào hoạt động** (không chấm điểm)

| Lệnh con | Chức năng |
|---|---|
| `mt-eval translate` | Dịch đầu vào chỉ có nguồn bằng một phương pháp — quy trình chạy mà không chấm điểm. Ghi `.jsonl` hoặc `.tsv` với các điều khoản của đầu vào dưới dạng tệp bổ trợ set/1; một phương pháp có đầu ra chỉ lưu cục bộ sẽ chỉ ghi bên trong dự án trừ khi `--holders-agreed-by` nêu rõ ai trong số những người nắm giữ dữ liệu đã đồng thuận |
| `mt-eval serve` | Phục vụ một phương pháp chạy trên máy này (`lexicon`, `local-model`, hoặc một plugin thuộc lớp phụ thuộc S hoặc O) đằng sau hợp đồng champollion `/translate`, từ một tệp deployment/1 hoặc các cờ, với tệp gate-chain/1 tùy chọn kiểm soát từng câu trả lời. Mặc định liên kết với 127.0.0.1; máy chủ khác cần `$MT_EVAL_SERVE_TOKEN` |

**Tìm phương pháp phù hợp**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval recommend <src> <tgt>` | Hướng dẫn phương pháp cho một cặp ngôn ngữ — khả năng sẵn có kèm theo **bằng chứng được trích dẫn**, không phải là một bảng xếp hạng đơn thuần. Cặp ngôn ngữ cũng có thể được cung cấp dưới dạng `--source <src> --target <tgt>`, định dạng mà `corpora` sử dụng |
| `mt-eval corpora --source X --target Y` | Liệt kê các ngữ liệu đánh giá có sẵn cho một cặp ngôn ngữ. Một trong hai cờ có thể hoạt động độc lập: `--target Y` liệt kê mọi ngữ liệu dịch sang Y, `--source X` liệt kê mọi ngữ liệu dịch từ X |
| `mt-eval corpora --with-fst` | Chỉ hiển thị các ngữ liệu có ngôn ngữ đích sở hữu FST mà harness cố định phiên bản, để có thể chấm điểm mức chấp nhận FST. Mỗi ngôn ngữ đích được liệt kê kèm trạng thái FST của nó đã được cài đặt trên máy này hay chưa và cách cài đặt (`mt-eval setup --lang <code>`, hoặc cài đặt thủ công cho một số định dạng). Có thể kết hợp với `--source`/`--target`, hoặc sử dụng riêng lẻ cho mọi cặp. Không có gì được tải xuống |
| `mt-eval list models\|prompts\|datasets` | Liệt kê các tài nguyên khả dụng |

**Đóng góp**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval publish <report>` | Gửi TestReport lên bảng xếp hạng |
| `mt-eval queue` | Chạy mục đầu tiên trong hàng đợi tính toán cộng đồng bằng khóa riêng của bạn — xem [Đóng góp tài nguyên tính toán](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Đóng gói TestReport thành một plugin phương pháp champollion (một `method.json` method/1) |
| `mt-eval generate-plugin` | Bí danh cho `export` |
| `mt-eval export-config` | Tạo một đoạn trích `champollion.config.json` từ TestReport |

**Các cuộc thi và tự tổ chức cuộc thi**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval contest` | Điều hành hoặc tham gia một **cuộc thi có chủ quyền** — dành cho ban tổ chức: `prepare`, `register`, `create`, `rank`, `close`, `export`; dành cho người tham gia: `qualify` (tự chấm điểm tập phát triển công khai để lấy biên nhận xét duyệt; vòng loại là chrF++ trên thang 0–100), `validate` (diễn tập các bước kiểm tra của nút ngoại tuyến), `submit-model` / `submit-method` (bàn giao mô hình hoặc phương pháp), `status`, `list`. Tham gia cuộc thi bằng cách cung cấp cho nút của ban tổ chức thứ gì đó mà nút có thể CHẠY; việc tải lên bản dịch và liên kết thẻ tự báo cáo đã bị ngừng sử dụng làm phương thức tham gia vào ngày 2026-09-06 |
| `mt-eval shared-task` | Khung tổng thể cho kỳ nhiệm vụ chung đa cặp: một hàng nhóm N cuộc thi theo từng cặp của một kỳ nhiệm vụ chung đa cặp và mang các chính sách mặc định của kỳ đó. **Chỉ nhóm và đặt giá trị mặc định — mọi cổng kiểm soát vẫn theo từng cuộc thi** |
| `mt-eval node` | **Nút chấm điểm của ban tổ chức.** Thăm dò đầu vào, kiểm soát qua vòng loại công khai, cấp quyền theo chính sách cuộc thi, chấm điểm dựa trên **các bản tham chiếu bí mật do ban tổ chức nắm giữ**, chỉ công bố điểm số. Đây là lệnh đằng sau [Điều hành cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) và [Nút đánh giá có chủ quyền](/docs/network/sovereignty/sovereign-eval-node) — ngữ liệu không bao giờ rời khỏi máy của ban tổ chức |

`mt-eval node` có mười tám lệnh con riêng, bao gồm luồng cách ly mạng (airgap lane)
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) và
nghi thức ủy thác quyền giám hộ M-trên-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Chạy `mt-eval node --help`; các cơ chế
về quyền chủ quyền được mô tả trên hai trang liên kết ở trên.

**Cài đặt**

| Lệnh con | Chức năng |
|---|---|
| `mt-eval setup` | Cài đặt các phần phụ thuộc tùy chọn (chỉ số mạng nơ-ron COMET, môi trường thực thi FST) |
| `mt-eval logout` | Xóa thông tin xác thực đã lưu |

### Ví dụ

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline
```

Harness không bao giờ thử lại hoặc lọc một bản dịch bị FST từ chối: độ
chấp nhận FST là một chỉ số, được chấm điểm khi gói đánh giá của ngôn ngữ có FST. Một
phương pháp muốn thử lại theo chỉ dẫn của FST sẽ thực hiện việc đó bên trong plugin của chính nó, như
hướng dẫn `fst-gated-pipeline` chỉ ra. (`--fst-retries` và `--hooks` chưa từng
được kết nối với bất kỳ thứ gì trên dòng lệnh; cả hai đều bị từ chối với lý do đó.)

---

## Schema của Thẻ kết quả (Run Card Schema)

Mỗi thử nghiệm đều tạo ra một **thẻ kết quả (run card)** — một tài liệu JSON độc lập. Cấu trúc cấp cao nhất:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

:::info[Lược đồ chuẩn xác]
[Quy cách Benchmark](/docs/network/specifications/benchmark) là nguồn thông tin duy nhất đáng tin cậy (SSOT) cho lược đồ thẻ lượt chạy. Để xem định nghĩa chỉ số và cách chấm điểm các lượt chạy, hãy xem [Quy cách chấm điểm](/docs/network/specifications/scoring). Trang này hướng dẫn cách sử dụng harness; các quy cách sẽ xác định ý nghĩa của các kết quả đầu ra.
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

:::caution[Phạm vi rõ ràng]
Các chỉ số này là **chỉ số chẩn đoán** — chúng không bao giờ là một phần của điểm số tiêu đề, và việc phát hiện mức độ trang trọng dựa trên dấu hiệu (phương pháp phỏng đoán), chứ không phải đánh giá qua học máy. Hãy coi chúng là công cụ phát hiện độ lệch trong việc tuân thủ ngữ vực, chứ không phải kết luận về chất lượng phong cách.
:::

---

## Phân biệt Fingerprint và Run Card Hash {#fingerprint-vs-run-card-hash}

Bộ công cụ tạo ra hai mã băm (hash) riêng biệt. Chúng phục vụ các mục đích khác nhau:

### Fingerprint (Mã vân tay)

**Fingerprint** trả lời cho câu hỏi: *"Lượt chạy này có thể tái lập được không?"*

Nó băm tổ hợp các dữ liệu đầu vào định nghĩa cấu hình thử nghiệm — chứ không băm kết quả đầu ra:

- SHA-256 của tập dữ liệu
- Slug mô hình
- Nhãn điều kiện
- SHA-256 của lời nhắc hệ thống
- Nhiệt độ (Temperature)
- Kích thước lô (Batch size)
- Công cụ đã bật
- Phiên bản harness

Tổng cộng có tám thành phần: kích thước lô và việc gọi công cụ làm thay đổi
đầu ra một cách rõ rệt, do đó chúng là một phần trong định danh của thử nghiệm — hai lượt chạy có
kích thước lô khác nhau sẽ **không** dùng chung một dấu vết vân tay. Xem
[Quy cách Benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Hai lượt chạy có fingerprint giống hệt nhau nghĩa là chúng sử dụng cùng một thiết lập. Kết quả của chúng có thể so sánh được với nhau (ngoại trừ tính không xác định của API).

### Run Card Hash (Mã băm thẻ kết quả)

**Run card hash** trả lời cho câu hỏi: *"Tệp kết quả cụ thể này có bị can thiệp hay thay đổi gì không?"*

Đây là mã SHA-256 của toàn bộ tệp JSON thẻ kết quả (ngoại trừ chính trường `run_card_hash`). Nếu bất kỳ trường nào thay đổi — một điểm số, một mốc thời gian, hay một kết quả đầu ra đơn lẻ — mã băm này sẽ bị hỏng (không còn khớp).

:::info[Khi nào nên dùng cái nào]
Sử dụng **fingerprint** để nhóm các lượt chạy có thể so sánh được (cùng một thử nghiệm, các lần thực thi khác nhau). Sử dụng **run card hash** để xác minh tính toàn vẹn của một tệp kết quả cụ thể.
:::

---

## Đăng tải lên Bảng xếp hạng (Leaderboard)

Sau khi hoàn tất một lượt chạy, hãy sử dụng `mt-eval publish` trên `<run-id>_report.json` của lượt chạy. Việc ghi lên bảng xếp hạng trực tiếp cần có `--prod` (hoặc `MT_EVAL_ALLOW_PROD=1`) rõ ràng; `mt-eval run --publish --prod` thực hiện cả hai bước cùng một lúc:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [Đánh giá MT](/docs/network/leaderboard/rules) — tổng quan, giá trị của bảng xếp hạng và hướng dẫn về các phương pháp tốt/xấu
- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — định dạng tập dữ liệu, EDTeKLA, FLORES+
- [Quy cách thẻ lượt chạy](/docs/network/specifications/run-card) — lược đồ JSON đầy đủ
- [Xây dựng phương pháp](/docs/network/specifications/methods) — giao diện phương pháp để tạo các phương pháp có thể đánh giá được
- [Bảng xếp hạng phương pháp](https://champollion.dev/leaderboard) — điểm số benchmark trực tiếp
- [Quy cách Benchmark](/docs/network/specifications/benchmark) — giao thức đánh giá, định dạng ngữ liệu, lược đồ thẻ lượt chạy
- [Quy cách chấm điểm](/docs/network/specifications/scoring) — nguồn tin cậy duy nhất (SSOT) cho các chỉ số và cách thức chấm điểm các lượt chạy
