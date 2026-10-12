---
title: "MCP Server — cánh cửa dành cho agent"
sidebar_label: "MCP Server"
description: "Kết nối một agent AI với Champollion qua Model Context Protocol: 34 công cụ để tra cứu ngôn ngữ, duyệt hàng đợi benchmark và corpus registry, chạy đánh giá, huấn luyện và xuất mô hình, cùng với dịch thuật — kèm thông tin chính xác về những công cụ cần thiết lập thêm ngoài một lệnh npx install."
---

# MCP Server — cánh cửa dành cho agent

`champollion-mcp-server` mở ra giao diện Champollion cho các AI agent qua [Model
Context Protocol](https://modelcontextprotocol.io). Nếu bạn là một agent, hoặc bạn
đang kết nối với một agent, thì đây chính là cánh cửa: **34 công cụ, 3 tài nguyên và 4 prompt**
qua stdio.

Mọi thứ ở đây cũng có thể truy cập được dưới dạng HTTP thuần túy — xem [Các endpoint có thể đọc bằng máy](#machine-readable-endpoints) — nhưng MCP server là bề mặt duy nhất cho phép một agent *hành động* (dịch thuật, chạy benchmark, huấn luyện mô hình) thay vì chỉ đọc.

## Cài đặt

```bash
npx -y champollion-mcp-server
```

Sau đó đăng ký nó với client của bạn. Đối với Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Đối với các client được cấu hình bằng file (Claude Desktop, Cursor, Antigravity), hãy thêm:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## Đọc phần này trước khi bạn phụ thuộc vào nó

**14 trong số 34 công cụ hoạt động ngay từ một bản cài đặt `npx` thuần túy, và `translate` hoạt động
khi đã có một engine. 19 công cụ còn lại cần các gói Python mà gói npm
không đi kèm và không thể đi kèm.** Chúng không gặp lỗi âm thầm — mỗi công cụ đều trả về một
lỗi có thể xử lý, nêu rõ những gì còn thiếu — nhưng bạn nên nắm rõ cấu trúc trước khi
lên kế hoạch sử dụng.

| Công cụ | Hoạt động sau `npx`? | Những gì khác cần có |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Có** — chỉ đọc, được phục vụ từ các endpoint công khai | không cần gì |
| `translate` | **Có**, khi có engine | một API key cho engine bạn chọn — hoặc không cần, với phương thức `local` và một model server trên máy của chính bạn |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Không | harness đánh giá — `pipx install mt-eval-harness` |
| 15 công cụ `forge_*` | Không | NMT Forge 0.2.0 trở lên — `python3 -m pip install nmt-forge` (thêm `'nmt-forge[hf]'` để huấn luyện và phục vụ). Nó tự mang theo harness đánh giá và tự tìm các thẻ ngôn ngữ; không cần clone mã nguồn |

Không cần clone kho mã nguồn cho bất kỳ phần nào trong số này.

## Chức năng của các công cụ

**Duyệt và tính chi phí công việc.** `list_queue` và `get_queue_item` duyệt qua hàng đợi benchmark mở — danh sách xếp hạng các phép đo sẽ cải thiện bản đồ nhiều nhất. `estimate_cost` định giá một tập hợp các lần chạy trước khi bạn tiêu tốn bất kỳ chi phí nào.

**Tra cứu thông tin.** `search_languages` tìm kiếm các thẻ ngôn ngữ theo tên,
mã, ngữ hệ hoặc khu vực, và chấp nhận lỗi chính tả. Mỗi kết quả cũng cho biết nơi
ngôn ngữ được sử dụng (quốc gia, điểm bản đồ, đại khu vực) và các tên gọi khác
của nó — chỉ những dữ kiện mà thẻ có trích dẫn nguồn, kèm theo từng nguồn đó, để
các ngôn ngữ có tên tương tự có thể được phân biệt. Một vị trí không có nguồn trích dẫn sẽ
không bao giờ được hiển thị; dòng thông tin sẽ ghi rõ điều đó và dẫn liên kết đến bản ghi Glottolog
của ngôn ngữ để thay thế. Các thẻ được điền từ bảng thẻ đã xuất bản của champollion.dev (trong
bản cài đặt npm, mọi ngôn ngữ nằm ngoài tập hợp cốt lõi đi kèm) chưa mang
nguồn cho từng trường — chúng sẽ có trong lần tải lên bảng tiếp theo — vì vậy những dòng đó
mang liên kết Glottolog thay vì vị trí địa lý. `language_overview` là điểm
bắt đầu gói gọn trong một trang để xây dựng cho một ngôn ngữ: những gì hiện có, những gì có thể
chạy, và các bước tiếp theo. `get_language` trả về thẻ đầy đủ có trích dẫn.
`list_corpora` liệt kê các ngữ liệu đánh giá đã đăng ký
cho một cặp ngôn ngữ hoặc nhóm benchmark — chỉ siêu dữ liệu (kích thước,
giấy phép, mức độ nhiễm bẩn, và liệu harness có thể tìm nạp, cần
access token, hay giữ nó trong vùng cách ly); nội dung ngữ liệu không bao giờ được trả về,
và một cặp ngôn ngữ có tất cả ngữ liệu bị cách ly sẽ nêu rõ điều đó thay vì trông như
không được hỗ trợ. `get_results` và `get_run_card` đọc các lượt chạy đã chấm điểm từ
bảng xếp hạng công khai. `get_metric_reliability` trả lời câu hỏi mà hầu hết
các agent đều trả lời sai — *tôi nên tin tưởng chỉ số nào cho ngôn ngữ đích này* —
từ tương quan với đánh giá của con người theo từng ngữ hệ. `list_contests`
và `get_contest` hiển thị các cuộc thi và các điều khoản đã công bố của chúng; việc tham gia một cuộc thi là
bước thực hiện qua CLI cần con người phê duyệt, không bao giờ là một công cụ.

**Hành động.** `translate` chạy văn bản qua pipeline đã kiểm thử, cùng với Bộ nhớ Dịch thuật (Translation
Memory - các bản dịch lặp lại không tốn chi phí) và quality gate tất định. Mỗi kết quả trả về
đều nêu tên engine thực tế đã chạy, cùng với model và endpoint tương ứng nếu có.
`run_benchmark` bắt đầu một quá trình đánh giá và trả về **job id ngay lập tức**,
bởi các lượt chạy thực tế sẽ vượt quá bất kỳ thời gian chờ (timeout) nào của client; bạn thăm dò `get_run_status` với
id đó. Một job vẫn tiếp tục tồn tại qua lần khởi động lại server: lượt chạy vẫn tiếp tục, và
việc thăm dò cùng id đó sau đó vẫn trả về trạng thái và kết quả của nó. Không có gì
được xuất bản trừ khi bạn truyền `publish: true`; kế hoạch sau đó sẽ nêu rõ những gì sẽ được
công khai — từng dòng kèm văn bản câu, hoặc chỉ điểm số; prompt, hoặc chỉ
hash của nó; và ở đâu — và việc xuất bản thực tế cần `publish_ack` với câu chữ
chính xác như kế hoạch đưa ra, để người dùng đã xem qua chúng trước. Một lượt chạy được thực hiện mà không có cờ này
có thể được xuất bản sau, đằng sau cùng một cổng kiểm duyệt. `preview_publish` là chế độ chỉ đọc:
nó hiển thị bản xem trước khi xuất bản của chính harness, câu chữ chính xác và đúng lệnh gọi
`publish_report` sẽ xuất bản nó, và nó không thể tự xuất bản. Nó
mang annotation MCP `readOnlyHint: true`, để agent host vốn hỏi ý kiến
trước mỗi lần ghi có thể tự động cho phép. `publish_report` thực hiện việc ghi
(được đánh dấu `destructiveHint` và `openWorldHint`), và `scores_only`
giữ lại văn bản câu. Mỗi kế hoạch cũng mở đầu bằng
trạng thái `EVAL PACK:` của ngôn ngữ đích — `missing` (kèm theo lệnh
cài đặt nó), `ready`, hoặc `none needed` — và nêu rõ giấy phép ngữ liệu cùng
điều khoản `do_not_train` của nó, vì lượt chạy đã vượt qua `--yes`. Một FST bị thiếu (bộ
phân tích hoặc runtime pyhfst của nó) không bao giờ làm dừng lượt chạy: nó vẫn tiếp tục, và thẻ
lượt chạy đánh dấu độ chấp nhận FST chưa được tính toán. Bất kỳ thành phần nào khác bị thiếu sẽ dừng lượt chạy
trước khi dịch. `skip_fst` và `skip_eval_standard` chấm điểm mà không cần các
thành phần đó, và thẻ lượt chạy đánh dấu những gì đã bị bỏ qua. Kế hoạch cũng cho biết liệu
COMET có được tính toán hay không (harness sẽ tính toán nó bất cứ khi nào `unbabel-comet` được
cài đặt; `comet: true` yêu cầu lượt chạy bắt buộc phải có nó), và `metricx` cùng `fuse`
yêu cầu MetricX-24 và bộ so sánh kiểu FUSE tùy chọn của harness. Đối với mỗi
thành phần, kế hoạch cho biết, từ harness, liệu nó đã được cài đặt chưa, cần cài đặt những gì
và nó sẽ tải xuống những gì. Một lượt chạy đã xác nhận yêu cầu một chỉ số mà harness
không thể tính toán sẽ bị từ chối thay vì chạy mà không có nó. Các dòng `Results:`
và `Cache:` của kế hoạch cho biết log của lượt chạy, báo cáo và cache bản dịch được lưu ở đâu.
Một tệp kiểm thử nằm trong thư mục mà `mt-eval contest prepare` đánh dấu là có thể phát hành
(`public/` của một cuộc thi) sẽ chạy vào thư mục `runs/` của cuộc thi để thay thế, để
không có gì do lượt chạy ghi ra bị phát hành cùng với nó. Một model trên chính máy của
bạn (một server cục bộ, hoặc `method: "local-model"`, vốn được harness chạy
in-process và không cần xác thực) được báo cáo là `$0 API cost (runs on
this machine)`.

**Huấn luyện mà không tự lừa dối mình.** `get_training_guardrails` trả về các quy tắc
được trích xuất từ các lỗi thực tế đã đo lường. 15 công cụ `forge_*` chạy
[NMT Forge](/docs/network/getting-started/training-honestly) từng bước có kiểm soát một
lần — `forge_status` trước tiên và sau mỗi bước (nó nêu rõ lệnh
tiếp theo và công cụ chạy lệnh đó), `forge_preflight` để xem một lệnh
sẽ gặp phải cổng kiểm duyệt nào trước khi nó từ chối, `forge_prereg_template` và `forge_prereg`
để ghi lại các dự đoán trước khi có bất kỳ điểm kiểm thử nào (và trước bất kỳ
benchmark nào trên tập kiểm thử: một thao tác đọc chấm điểm sẽ chặn việc đăng ký trước sau đó),
`forge_export` để chấm điểm tập kiểm thử một lần và đóng gói model đã huấn luyện,
`forge_compare` để so sánh A/B hai model kèm lưu ý về bản sao gần giống của mỗi model bên cạnh
model chiến thắng, và
`forge_prereg_verdict` để ghi lại phán quyết của chính người dùng đối với một dự đoán mà forge
không thể đánh giá (một dải văn bản tự do) — được hiển thị dưới dạng phán quyết của con người, không bao giờ là kết
quả tính toán. `forge_status` liệt kê mọi lượt chạy đã huấn luyện cùng điểm dev của nó và
cho biết khi nào một tập dev bị bão hòa (điểm dev hoàn hảo khiến việc
lựa chọn checkpoint không còn gì để phân định). Khi harness đánh giá đưa ra lưu ý
về điểm kiểm thử (ví dụ: đầu ra gần như không đổi: một vài đầu ra
được đưa ra cho mọi câu nguồn), `forge_export`, `forge_status`,
`forge_compare` và `forge_lint` mang lưu ý đó theo đúng câu chữ của harness, và một
lưu ý quan trọng sẽ xuất hiện đầu tiên ở bước tiếp theo: điểm số không bao giờ được trích dẫn mà thiếu
lưu ý đó. Một phản hồi từ chối sẽ trả về
nguyên nhân lỗi, lý do lỗi này quan trọng và cách khắc phục. Có hai bước kéo dài hơn bất kỳ lệnh gọi
công cụ nào và chạy trong terminal: huấn luyện (`nmt-forge run`) và phục vụ
model đã xuất khẩu (`nmt-forge serve`, đưa model ra sau một endpoint cục bộ mà
`translate` và CLI có thể sử dụng).

### Đối số

`name` là bắt buộc và `name?` là tùy chọn. Mọi công cụ nhận một
ngôn ngữ cũng chấp nhận nó dưới dạng `language`: "`code` hoặc `language`" nghĩa là cả hai
tên đều hoạt động, và bạn chỉ cần truyền một tên. Các tên gốc vẫn tiếp tục hoạt động.

| Công cụ | Đối số |
|---|---|
| `search_languages` | `query` hoặc `language`, `limit?` |
| `language_overview` | `code` hoặc `language`, `source?` |
| `get_language` | `code` hoặc `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (ít nhất một trong ba đối số này), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` hoặc `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | không có |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` hoặc `priority?` (một trong hai) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (một msgctxt của gettext: một cho mọi văn bản, hoặc một cho mỗi văn bản), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | một chế độ: `budget?` hoặc `top?` (hàng đợi), `item_id?`, hoặc `corpus?` cùng `model?` (với `method_dir`, model mà plugin tải), `method?` hoặc `method_dir?` (thư mục plugin phương thức; `local-model` cần `model` — không có giá trị mặc định), `allow_model_pair_mismatch?` (`local-model`: chạy một model cặp OPUS-MT đặt tên cho một cặp khác, dưới dạng baseline ngôn ngữ liên quan), `attest_local_transport?` (một engine MT hoặc một plugin; không bao giờ cần cho `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (các lượt chạy LLM: chữ viết ISO 15924 mà đầu ra phải được viết theo, chẳng hạn như `Cans` hoặc `Latn`; kế hoạch sẽ thông báo khi thẻ ngôn ngữ đích liệt kê nhiều hơn một chữ viết), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` và `skip_eval_standard?` (các lượt chạy item và ngữ liệu: chấm điểm không có FST hoặc các chỉ số tiêu chuẩn đánh giá, được đánh dấu là chưa tính), `comet?` (yêu cầu COMET: lượt chạy bị từ chối khi chưa cài đặt), `metricx?` cùng `metricx_model?`, và `fuse?` (các lượt chạy item và ngữ liệu: MetricX-24 và bộ so sánh kiểu FUSE tùy chọn của harness, bị từ chối khi chưa cài đặt); sau đó là `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (với việc xuất bản thực tế: các từ chính xác mà kế hoạch in ra), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (`*_report.json` của một lượt chạy đã hoàn tất), `scores_only?`, `redact_coaching?`, `anonymous?` (chỉ đọc: không có `confirm`, không thể xuất bản) |
| `publish_report` | `report` (`*_report.json` của một lượt chạy đã hoàn tất), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (các từ chính xác mà bản xem trước in ra) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (lệnh cần kiểm tra), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` hoặc `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` hoặc `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (mặc định `data/split`, đường dẫn mà config.json của `forge_init` đọc), `dev?`, `register?` (tiền tố tên, hoặc `true` cho `project`), `allow_rotate?`, `near_dupe?` (ngưỡng Jaccard chẳng hạn như 0.6, khi forge khuyến nghị tách lọc các bản ghi gần trùng lặp), `max_group?` (với `near_dupe`: nhóm gần trùng lặp lớn nhất), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (với `clean_to` riêng của nó, ví dụ `corpus.notwins.jsonl` — không bao giờ là tệp toàn bộ dữ liệu), `companion_config?` (với `drop_test_twins`: nơi lưu cấu hình của model không trùng lặp; mặc định `config-notwins.json`), `overwrite?` (thay thế tệp `clean_to` mà một cấu hình, lượt chạy, phân tách hoặc kiểm tra khác sử dụng — bị từ chối nếu thiếu), `full_indices?` (đầy đủ mọi danh sách số thứ tự dòng; theo mặc định các danh sách dài được trả về dưới dạng `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (gán cố định cho một lượt chạy), `allow_after_reads?` (chỉ dành cho các dự đoán được ghi trước các lần đọc chấm điểm của tập hợp), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (số thứ tự của nó, hoặc id riêng của nó), `verdict` (`held` hoặc `missed`), `by` (người đã đánh giá), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (run manifest của từng model: dữ liệu huấn luyện của nó được kiểm tra các bản sao gần giống), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Ví dụ: `get_metric_reliability { "language": "crk" }` và
`get_metric_reliability { "target": "crk" }` đều đưa ra cùng một câu hỏi.

### Dịch với model bạn đã triển khai

`nmt-forge serve` in ra hai địa chỉ cho model mà nó phục vụ. Hãy trỏ
`translate` vào một trong hai địa chỉ:

| Đối số | Sử dụng với | Ví dụ |
|---|---|---|
| `base_url` | `method: "local"` — một server tương thích OpenAI (cũng là `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — hợp đồng API của champollion | `http://127.0.0.1:8378/translate` |
| `model` | chỉ dành cho các engine LLM; bị từ chối đối với các API dịch máy vốn không có tùy chọn này | `llama3.1` |
| `project_dir` | bất kỳ phương thức nào — sử dụng Bộ nhớ Dịch thuật của dự án đó | `~/my-app` |

Một server trên máy của chính bạn không cần key. Một endpoint `api` từ xa đọc
key từ `CHAMPOLLION_API_KEY` trong môi trường của server. Công cụ sẽ từ chối
đối số mà nó không nhận biết, theo tên cụ thể, thay vì bỏ qua nó, nhờ vậy một đối số
viết sai chính tả không thể âm thầm gửi văn bản của bạn đến một model khác.

### Nơi server lưu trữ trạng thái

Mọi thứ đều nằm trong `~/.champollion-mcp/` (thiết lập `CHAMPOLLION_MCP_HOME` để di chuyển
nó):

- **Bộ nhớ Dịch thuật của `translate`** là tệp riêng của nó,
  `.champollion/tm.json` trong thư mục đó. Nó tách biệt với `.champollion/tm.json` của bất kỳ dự án nào.
  Truyền `project_dir` để sử dụng tệp của dự án thay thế,
  chính là tệp mà `champollion sync` sử dụng tại đó.
- **Các job `run_benchmark`** được ghi lại trong `jobs.json`, nơi lưu giữ
  50 job mới nhất. Mỗi job có một thư mục trong `jobs/` chứa đầu ra của nó và kết quả
  của harness đối với mục hàng đợi hoặc ngữ liệu đã đăng ký. Một lượt chạy trên tệp kiểm thử
  mà bạn nắm giữ sẽ ghi kết quả và cache bên cạnh tệp đó, trong
  `results/` — ngoại trừ tệp trong thư mục mà `mt-eval contest prepare`
  đánh dấu là có thể phát hành, lượt chạy của tệp đó sẽ ghi vào thư mục `runs/` của cuộc thi.
  Các lượt chạy trong hàng đợi sẽ ghi báo cáo vào `eval/logs/harness/queue/` dưới
  thư mục làm việc của server, như harness vẫn luôn thực hiện.

:::note[Chi tiêu được giới hạn theo thiết kế]
`run_benchmark` **từ chối một lần chạy hàng đợi không giới hạn.** Bạn phải truyền chính xác một giới hạn — `budget`, `top`, hoặc một `item_id` cụ thể. Không có lệnh gọi "chỉ chạy hàng đợi" nào, bởi vì một agent hiểu sai về hàng đợi có thể sẽ tiêu tốn không giới hạn.
:::

## Phiên bản giao thức

Giao thức truyền tải (Transport) **chỉ là stdio** — một tiến trình server cho mỗi agent.

[Bản sửa đổi ngày 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) của MCP đã làm cho giao thức mặc định trở thành stateless (không trạng thái), loại bỏ quá trình bắt tay `initialize` và header `Mcp-Session-Id`. Server này không bị ảnh hưởng về mặt thiết kế: nó không sử dụng bất kỳ khả năng nào đã bị ngừng hỗ trợ (Roots, Sampling, Logging), chưa bao giờ sử dụng giao thức truyền tải HTTP+SSE cũ, và đã tuân theo hướng dẫn mới về trạng thái cross-call — `run_benchmark` tạo ra một job handle rõ ràng mà mô hình truyền ngược lại, thay vì dựa vào một phiên truyền tải (transport session).

Nó **chưa** được nâng cấp lên bản sửa đổi mới, bởi vì chưa có TypeScript SDK nào được phát hành hỗ trợ nó. Xem [README của server](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) để biết quan điểm đầy đủ.

## Các endpoint có thể đọc bằng máy

Không cần MCP client cho các endpoint này:

| Endpoint | Mô tả |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [Cánh cửa dành cho agent](/for-agents), dưới dạng markdown thô |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Chỉ mục được tuyển chọn của trang web này |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Mọi trang được lập chỉ mục, inlined |
| [`/queue.json`](https://champollion.dev/queue.json) | Toàn bộ hàng đợi benchmark |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Các mục hàng đầu trong hàng đợi |
| [`/registry.json`](https://champollion.dev/registry.json) | Registry của ngữ liệu |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Đồ thị ngôn ngữ đã được đo lường |

## Tiếp theo

- [Hướng dẫn Agent — xây dựng & benchmark](/docs/network/getting-started/agent-guide)
- [Hướng dẫn Agent — dịch thuật với CLI](/docs/guides/agent-guide)
- [Gửi một Phương pháp](/docs/network/getting-started/submit-a-method)
