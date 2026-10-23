---
title: "MCP Server — Cửa ngõ dành cho tác nhân"
sidebar_label: "MCP Server"
description: "Kết nối tác nhân AI với Champollion qua Model Context Protocol. Hai profile: profile rails (mặc định) dẫn dắt một dự án ngôn ngữ với sáu công cụ; --profile full cung cấp 34 công cụ để tra cứu ngôn ngữ, duyệt hàng đợi kiểm chuẩn và danh mục ngữ liệu, chạy đánh giá, huấn luyện và xuất mô hình, cùng với dịch thuật — kèm thông tin chính xác về những công cụ cần nhiều hơn một lệnh npx install."
---

# MCP Server — cánh cửa hướng về agent

`champollion-mcp-server` hiển thị Champollion cho các AI agent qua [Model
Context Protocol](https://modelcontextprotocol.io), thông qua stdio. Nó có hai
profile:

| Profile | Khởi chạy với | Những gì được cung cấp | Được thiết kế cho |
|---|---|---|---|
| **rails** (mặc định) | `npx -y champollion-mcp-server` | sáu công cụ: `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | dẫn dắt một dự án ngôn ngữ từ một thư mục trống đến mô hình đã được đo lường ngay trên máy tính của người dùng, từng bước một |
| **full** | `npx -y champollion-mcp-server --profile full` (hoặc `CHAMPOLLION_MCP_PROFILE=full`) | 34 công cụ, 3 tài nguyên và 4 prompt | khám phá, đo điểm chuẩn, huấn luyện từng bước, dịch thuật và mạng lưới |

Nếu bạn đang giúp ai đó xây dựng một trình dịch cho ngôn ngữ của họ, hãy dùng
profile rails; cách vận hành được nêu trong [Vận hành rails qua
MCP](/docs/agents/mcp), và các quy tắc bạn tuân theo nằm trong [hợp đồng
vận hành](/docs/agents/contract).

Mọi thứ ở đây cũng có thể truy cập qua HTTP thông thường — xem [Các endpoint
cho máy đọc](#machine-readable-endpoints) — nhưng MCP server là bề mặt duy nhất
cho phép một agent *hành động* (dịch, chạy benchmark, huấn luyện mô hình) thay vì
chỉ đọc.

## Cài đặt

```bash
npx -y champollion-mcp-server
```

Sau đó đăng ký với client của bạn. Đối với Claude Code:

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

Đối với profile full, hãy thêm `"--profile", "full"` sau tên gói trong
`args`, hoặc kết thúc lệnh `claude mcp add` bằng `--profile full`.

## Profile rails (mặc định)

Sáu công cụ này dẫn dắt một dự án ngôn ngữ từ một thư mục trống đến mô hình
đã được đo lường ngay trên máy tính của người dùng. Mỗi bước cho biết chính xác
công cụ nào cần gọi, và mọi câu hỏi mà chỉ người dùng mới có thể trả lời (ai nắm
giữ file, liệu mô hình có được phép học từ file đó hay không, liệu văn bản trong đó có được
phép rời khỏi máy tính hay không, họ kỳ vọng điều gì, kết quả đã đủ tốt chưa) đều được chuyển
ngược lại cho họ. Các công cụ báo cáo số lượng và các cột, không bao giờ báo cáo các câu hoàn chỉnh. Mọi công cụ đều điều khiển dòng lệnh `champollion`
dưới dạng một tiến trình riêng biệt, có giới hạn — cùng các lệnh mà người dùng
gõ. Profile này được xây dựng cho các agent nhỏ, với hướng dẫn ngắn gọn.

| Công cụ | Đối số | Chức năng |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | Tạo một dự án (`champollion new`). Lần gọi đầu tiên không tạo gì và trả về `ask_first`: thuật lại hướng đi cho người dùng, sau đó thực hiện lệnh gọi mà nó cung cấp theo câu trả lời của họ |
| `project_status` | `project_dir`, `wait_seconds?` (tối đa 120) | Bước tiếp theo, được đọc từ các file (`champollion next --json`): chế độ của bước đó, cần nói gì, lý do, và lệnh gọi chính xác để thực hiện bước đó |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | Chạy bước mà `project_status` vừa nêu tên. Bước `confirm` cần `confirmed: true` sau khi người dùng đồng ý; bước `ask_user` cần câu trả lời của chính người dùng; các bước `human_only` và `wait` bị từ chối kèm theo việc cần làm thay thế |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` hoặc `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | Nạp file tại vị trí của nó — bảng tính, bảng Word, từ điển Toolbox hoặc LIFT, file ELAN, hoặc kinh thánh USFM (`champollion data add`) — và báo cáo số lượng cùng các cột, không bao giờ báo cáo các câu |
| `try_translation` | `project_dir`, `text` (tối đa 10 dòng) | Dịch một vài câu của người dùng bằng mô hình mà dự án phục vụ. Đối với mô hình đã học từ các câu chỉ lưu cục bộ, nó trả về địa chỉ trang riêng của mô hình, không bao giờ trả về văn bản |
| `explain` | `topic`: `rails`, `privacy`, `quality`, `modes`, `improve` hoặc `off_rails` | Các giải thích bằng ngôn từ bình dị để truyền đạt lại |

## Profile full

Mọi nội dung dưới đây mô tả **profile full** — toàn bộ công cụ, phục vụ khám phá,
đo điểm chuẩn và mạng lưới:

```bash
npx -y champollion-mcp-server --profile full
```

## Hãy đọc phần này trước khi dựa vào nó

**Trong profile full, mười bốn trong số 34 công cụ hoạt động ngay từ bản cài đặt `npx` thuần túy, và `translate` hoạt động
ngay khi có một engine. Mười chín công cụ còn lại cần các gói Python mà gói npm
không và không thể cung cấp kèm.** Chúng không thất bại trong im lặng — mỗi công cụ đều trả về một
lỗi có thể hành động nêu rõ những gì còn thiếu — nhưng bạn nên biết cấu trúc tổng thể trước
khi lập kế hoạch sử dụng.

| Công cụ | Hoạt động sau khi `npx`? | Cần thêm những gì |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Có** — chỉ đọc, được phục vụ từ các endpoint công khai | không cần gì |
| `translate` | **Có**, khi có một engine | API key cho engine bạn chọn — hoặc không cần, với phương thức `local` và một model server trên chính máy tính của bạn |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Không | eval harness — `pipx install mt-eval-harness` |
| mười lăm công cụ `forge_*` | Không | NMT Forge 0.2.0 trở lên — `python3 -m pip install nmt-forge` (thêm `'nmt-forge[hf]'` để huấn luyện và phục vụ). Nó mang sẵn eval harness và tự tìm thẻ ngôn ngữ; không cần clone kho lưu trữ |

Không cần clone kho lưu trữ cho bất kỳ phần nào trong số này.

## Các công cụ làm những gì

**Duyệt và tính chi phí công việc.** `list_queue` và `get_queue_item` duyệt hàng đợi
benchmark mở — danh sách xếp hạng các phép đo lường có thể cải thiện bản đồ
nhiều nhất. `estimate_cost` định giá một tập hợp lượt chạy trước khi bạn chi tiêu bất kỳ khoản nào.

**Tra cứu thông tin.** `search_languages` tìm kiếm các thẻ ngôn ngữ theo tên,
mã, ngữ hệ hoặc khu vực, và chấp nhận lỗi chính tả. Mỗi kết quả cũng cho biết nơi
ngôn ngữ được nói (các quốc gia, một điểm trên bản đồ, đại khu vực) cùng các tên
khác của nó — chỉ những dữ kiện mà thẻ có trích dẫn nguồn, kèm theo từng nguồn đó, để
có thể phân biệt các ngôn ngữ có tên tương tự nhau. Vị trí không có nguồn trích dẫn sẽ
không bao giờ được hiển thị; dòng thông tin sẽ nêu rõ điều đó và dẫn liên kết đến bản ghi Glottolog
của ngôn ngữ để thay thế. Các thẻ được điền từ bảng thẻ đã xuất bản của champollion.dev (trong bản
cài đặt npm, là mọi ngôn ngữ nằm ngoài tập hợp cốt lõi đi kèm) hiện chưa có nguồn
cho từng trường — chúng sẽ có trong lần tải lên bảng tiếp theo — vì vậy những
dòng đó dẫn liên kết Glottolog thay vì vị trí. `language_overview` là điểm khởi đầu
gói gọn trong một trang để xây dựng cho một ngôn ngữ: những gì đã có, những gì có thể
chạy và các bước tiếp theo. `get_language` trả về toàn bộ thẻ kèm trích dẫn.
`list_corpora` liệt kê các ngữ liệu đánh giá đã đăng ký cho một cặp ngôn ngữ
hoặc họ benchmark — chỉ siêu dữ liệu (kích thước, giấy phép, mức độ nhiễm bẩn dữ liệu,
và liệu harness có thể tìm nạp, cần access token, hay đang cách ly nó); nội dung
ngữ liệu không bao giờ được trả về, và cặp ngôn ngữ có tất cả ngữ liệu đều bị cách ly sẽ
nêu rõ điều đó thay vì hiển thị như không được hỗ trợ. `get_results` và `get_run_card`
đọc các lượt chạy đã chấm điểm từ bảng xếp hạng công khai. `get_metric_reliability` trả lời câu hỏi mà hầu hết
các agent đều nhầm lẫn — *tôi nên tin tưởng chỉ số nào cho ngôn ngữ đích này* —
từ mối tương quan với đánh giá của con người theo từng ngữ hệ. `list_contests`
và `get_contest` hiển thị các cuộc thi cùng điều khoản đã công bố; tham gia cuộc thi là một
bước CLI do con người cấp quyền, không bao giờ là một công cụ.

**Hành động.** `translate` chạy văn bản qua pipeline đã kiểm thử, cùng Bộ nhớ
dịch (lặp lại không tốn chi phí) và cổng chất lượng tất định. Mỗi câu trả lời
đều nêu tên engine thực tế đã chạy, kèm theo mô hình và endpoint của nó nếu có.
`run_benchmark` bắt đầu một lượt đánh giá và trả về **id công việc ngay lập tức**,
vì các lượt chạy thực tế kéo dài hơn bất kỳ khoảng thời gian chờ nào của client; bạn thăm dò `get_run_status` bằng
id đó. Tác vụ vẫn tồn tại qua quá trình khởi động lại server: lượt chạy vẫn tiếp tục, và
việc thăm dò cùng id đó sau đó vẫn trả về trạng thái cùng kết quả của nó. Không có gì
được xuất bản trừ khi bạn truyền `publish: true`; kế hoạch sau đó sẽ cho biết những gì sẽ được
công khai — từng hàng kèm văn bản câu, hoặc chỉ điểm số; prompt, hoặc chỉ
mã băm của nó; và nơi xuất bản — cùng với việc xuất bản thực tế cần `publish_ack` đúng
từng từ mà kế hoạch đưa ra, để người dùng thấy được chúng trước. Một lượt chạy được thực hiện mà không có đối số này
có thể được xuất bản sau, đằng sau cùng một cổng kiểm soát. `preview_publish` là chỉ đọc:
nó hiển thị bản xem trước xuất bản của chính harness, chính xác các từ và chính xác
lệnh gọi `publish_report` dùng để xuất bản, và nó không thể xuất bản. Nó
mang chú thích MCP `readOnlyHint: true`, nhờ đó host của agent vốn hỏi ý kiến
trước mỗi thao tác ghi có thể tự động cho phép. `publish_report` thực hiện thao tác ghi
(được chú thích `destructiveHint` và `openWorldHint`), và `scores_only`
giữ lại văn bản câu. Mỗi kế hoạch cũng mở đầu bằng
trạng thái `EVAL PACK:` của ngôn ngữ đích — `missing` (kèm theo lệnh
cài đặt nó), `ready`, hoặc `none needed` — và nêu tên giấy phép ngữ liệu cùng
điều khoản `do_not_train` của nó, vì lượt chạy vượt qua `--yes`. Một FST bị thiếu (bộ
phân tích hoặc runtime pyhfst của nó) không bao giờ làm dừng lượt chạy: nó vẫn tiếp tục, và thẻ
lượt chạy đánh dấu độ chấp nhận FST chưa được tính toán. Bất kỳ thành phần nào khác bị thiếu sẽ dừng lượt chạy
trước khi dịch. `skip_fst` và `skip_eval_standard` chấm điểm mà không cần các thành
phần đó, và thẻ lượt chạy sẽ đánh dấu những gì đã bị bỏ qua. Kế hoạch cũng cho biết liệu
COMET có được tính toán hay không (harness sẽ tính toán nó bất cứ khi nào `unbabel-comet` được
cài đặt; `comet: true` yêu cầu lượt chạy phải có nó), và `metricx` cùng `fuse`
yêu cầu bộ so sánh MetricX-24 và dạng FUSE tùy chọn của harness. Đối với mỗi
thành phần, kế hoạch cho biết, từ harness, liệu nó đã được cài đặt hay chưa, cần cài đặt những gì
và nó tải xuống những gì. Một lượt chạy đã xác nhận yêu cầu một chỉ số mà harness
không thể tính toán sẽ bị từ chối thay vì chạy mà thiếu chỉ số đó. Các dòng `Results:`
và `Cache:` của kế hoạch cho biết vị trí lưu nhật ký lượt chạy, báo cáo và bộ nhớ cache dịch.
Một file kiểm tra bên trong thư mục mà `mt-eval contest prepare` đánh dấu là có thể phát hành
(`public/` của cuộc thi) sẽ chạy vào thư mục `runs/` của cuộc thi để thay thế, nhờ đó
không có nội dung nào do lượt chạy ghi lại bị phát hành cùng với nó. Một mô hình trên chính máy tính
của bạn (máy chủ cục bộ, hoặc `method: "local-model"`, vốn được harness chạy
trong cùng tiến trình và không cần chứng thực) được báo cáo là `$0 API cost (runs on
this machine)`.

**Huấn luyện mà không tự lừa dối mình.** `get_training_guardrails` trả về các quy tắc
được trích xuất từ các lỗi đo lường thực tế. Mười lăm công cụ `forge_*` vận hành
[NMT Forge](/docs/agents/training) từng bước được bảo vệ
một — `forge_status` trước tiên và sau mỗi bước (nó nêu tên lệnh tiếp theo
và công cụ chạy lệnh đó), `forge_preflight` để xem một lệnh sẽ gặp các cổng
kiểm soát nào trước khi nó từ chối, `forge_prereg_template` và `forge_prereg`
để ghi lại các dự đoán trước khi có bất kỳ điểm kiểm tra nào (và trước bất kỳ
benchmark nào trên tập kiểm tra: một lần đọc chấm điểm sẽ chặn đăng ký trước sau đó),
`forge_export` để chấm điểm tập kiểm tra một lần và đóng gói mô hình đã huấn luyện,
`forge_compare` để so sánh A/B hai mô hình kèm theo lưu ý về bản gần trùng lặp của từng mô hình bên cạnh
mô hình chiến thắng, và
`forge_prereg_verdict` để ghi lại phán quyết của chính người dùng về một dự đoán mà forge
không thể đánh giá (khoảng văn bản tự do) — được hiển thị dưới dạng phán quyết của con người, không bao giờ là
phán quyết được tính toán. `forge_status` liệt kê mọi lượt chạy đã huấn luyện kèm theo điểm dev và
cho biết khi nào một tập dev bị bão hòa (điểm dev hoàn hảo và không còn gì để việc lựa chọn
checkpoint cân nhắc). Khi eval harness đưa ra một lưu ý
về điểm kiểm tra (ví dụ đầu ra gần như không đổi: chỉ một số ít đầu ra
được đưa ra cho mọi câu nguồn), `forge_export`, `forge_status`,
`forge_compare` và `forge_lint` sẽ mang lưu ý đó theo đúng câu từ của harness, và một lưu ý
quan trọng sẽ xuất hiện đầu tiên trong bước tiếp theo: điểm số không bao giờ được trích dẫn nếu không có
lưu ý đó. Một lời từ chối được trả về
kèm theo thông tin về những gì đã xảy ra lỗi, tại sao điều đó quan trọng và cách khắc phục. Hai bước kéo dài hơn bất kỳ
lệnh gọi công cụ nào và sẽ chạy trong terminal: huấn luyện (`nmt-forge run`) và phân phối
mô hình đã xuất (`nmt-forge serve`, đưa mô hình ra sau một endpoint cục bộ mà
`translate` và CLI có thể sử dụng).

### Đối số

`name` là bắt buộc và `name?` là tùy chọn. Mọi công cụ nhận một
ngôn ngữ cũng chấp nhận đối số đó dưới dạng `language`: "`code` hoặc `language`" nghĩa là cả hai
tên đều hoạt động, và bạn truyền vào một tên. Các tên gốc vẫn tiếp tục hoạt động.

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
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (một msgctxt gettext: một cho mọi văn bản, hoặc một cho mỗi văn bản), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | một chế độ: `budget?` hoặc `top?` (hàng đợi), `item_id?`, hoặc `corpus?` với `model?` (cùng với `method_dir`, mô hình mà plugin tải), `method?` hoặc `method_dir?` (thư mục plugin phương thức; `local-model` cần `model` — không có giá trị mặc định), `allow_model_pair_mismatch?` (`local-model`: chạy một mô hình cặp OPUS-MT đặt tên cho một cặp khác, dưới dạng đường cơ sở ngôn ngữ liên quan), `attest_local_transport?` (một engine MT hoặc một plugin; không bao giờ cần cho `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (các lượt chạy LLM: chữ viết ISO 15924 mà đầu ra phải được viết bằng, chẳng hạn như `Cans` hoặc `Latn`; kế hoạch sẽ cho biết khi thẻ của ngôn ngữ đích liệt kê nhiều hơn một chữ viết), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` và `skip_eval_standard?` (các lượt chạy hạng mục và ngữ liệu: chấm điểm mà không có FST hoặc các chỉ số chuẩn đánh giá, được đánh dấu là chưa tính toán), `comet?` (yêu cầu COMET: lượt chạy bị từ chối khi chỉ số này chưa được cài đặt), `metricx?` với `metricx_model?`, và `fuse?` (các lượt chạy hạng mục và ngữ liệu: bộ so sánh MetricX-24 và dạng FUSE tùy chọn của harness, bị từ chối khi chưa được cài đặt); tiếp theo là `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (với lệnh xuất bản thực tế: chính xác những từ mà kế hoạch in ra), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (`*_report.json` của một lượt chạy đã hoàn thành), `scores_only?`, `redact_coaching?`, `anonymous?` (chỉ đọc: không có `confirm`, không thể xuất bản) |
| `publish_report` | `report` (`*_report.json` của một lượt chạy đã hoàn thành), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (chính xác những từ mà bản xem trước in ra) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (lệnh cần kiểm tra), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` hoặc `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` hoặc `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (mặc định là `data/split`, đường dẫn mà config.json của `forge_init` đọc), `dev?`, `register?` (tiền tố tên, hoặc `true` cho `project`), `allow_rotate?`, `near_dupe?` (ngưỡng Jaccard chẳng hạn như 0.6, khi forge khuyến nghị việc loại bỏ bản trùng lặp gần), `max_group?` (với `near_dupe`: nhóm bản trùng lặp gần lớn nhất), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (với `clean_to` riêng của nó, ví dụ `corpus.notwins.jsonl` — không bao giờ là file toàn bộ dữ liệu), `companion_config?` (với `drop_test_twins`: nơi lưu cấu hình của mô hình không chứa bản trùng lặp; mặc định là `config-notwins.json`), `overwrite?` (thay thế một file `clean_to` mà một cấu hình, một lượt chạy, một phần chia tách hoặc một lần kiểm tra khác sử dụng — bị từ chối nếu không có đối số này), `full_indices?` (toàn bộ danh sách số hàng đầy đủ; theo mặc định các danh sách dài sẽ trả về dưới dạng `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (ghim vào một lượt chạy), `allow_after_reads?` (chỉ dành cho các dự đoán được ghi lại trước các lần đọc chấm điểm của tập hợp), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (số thứ tự, hoặc id của chính nó), `verdict` (`held` hoặc `missed`), `by` (người đã đánh giá), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (run manifest của từng mô hình: dữ liệu huấn luyện của nó được kiểm tra để tìm các bản gần trùng lặp), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Ví dụ, `get_metric_reliability { "language": "crk" }` và
`get_metric_reliability { "target": "crk" }` đưa ra cùng một câu hỏi.

### Dịch bằng mô hình bạn đã triển khai

`nmt-forge serve` in ra hai địa chỉ cho mô hình mà nó phục vụ. Hãy trỏ
`translate` vào một trong hai địa chỉ đó:

| Đối số | Sử dụng với | Ví dụ |
|---|---|---|
| `base_url` | `method: "local"` — một máy chủ tương thích OpenAI (cũng dùng cho `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — hợp đồng API của champollion | `http://127.0.0.1:8378/translate` |
| `model` | Chỉ dành cho các engine LLM; bị từ chối đối với các API dịch máy vốn không có đối số này | `llama3.1` |
| `project_dir` | Bất kỳ phương thức nào — sử dụng Bộ nhớ dịch của dự án đó | `~/my-app` |

Một máy chủ trên chính máy tính của bạn không cần key. Một endpoint `api` từ xa sẽ đọc
key từ `CHAMPOLLION_API_KEY` trong môi trường của máy chủ. Công cụ sẽ từ chối
đối số mà nó không nhận biết, theo tên, thay vì bỏ qua, nhờ đó một đối số
viết sai chính tả không thể âm thầm gửi văn bản của bạn đến một mô hình khác.

### Nơi server lưu giữ trạng thái của nó

Mọi thứ nằm trong `~/.champollion-mcp/` (thiết lập `CHAMPOLLION_MCP_HOME` để di chuyển
nó):

- **Bộ nhớ dịch của `translate`** là một file riêng,
  `.champollion/tm.json` trong thư mục đó. File này tách biệt với `.champollion/tm.json`
  của bất kỳ dự án nào. Hãy truyền `project_dir` để sử dụng file của dự án thay thế,
  tức file mà `champollion sync` sử dụng ở đó.
- **Các tác vụ `run_benchmark`** được ghi lại trong `jobs.json`, nơi lưu giữ
  50 tác vụ mới nhất. Mỗi tác vụ có một thư mục trong `jobs/` chứa kết quả đầu ra và, đối với
  một hạng mục trong hàng đợi hoặc một ngữ liệu đã đăng ký, là kết quả của harness. Lượt chạy trên một file kiểm tra
  mà bạn nắm giữ sẽ ghi kết quả và bộ nhớ cache ngay cạnh file đó, trong
  `results/` — ngoại trừ file nằm trong thư mục mà `mt-eval contest prepare`
  đánh dấu là có thể phát hành, khi đó lượt chạy sẽ ghi vào thư mục `runs/` của cuộc thi. Mỗi
  lượt chạy như vậy sẽ có thư mục `mcp-run-<id>/` riêng ở đó, và `get_run_status`
  sẽ in lệnh `mt-eval compare` trên toàn bộ các lượt chạy đó
  (`results/mcp-run-*/*_report.json`).
  Các lượt chạy trong hàng đợi sẽ ghi báo cáo vào `eval/logs/harness/queue/` dưới
  thư mục làm việc của server, như harness vẫn luôn làm.

:::note[Chi tiêu được giới hạn theo thiết kế]
`run_benchmark` **từ chối lượt chạy hàng đợi không giới hạn.** Bạn phải truyền chính xác một
giới hạn — `budget`, `top`, hoặc một `item_id` cụ thể. Không có lệnh gọi "cứ chạy
hàng đợi", vì nếu không, một agent hiểu sai về hàng đợi có thể
chi tiêu không giới hạn.
:::

## Phiên bản giao thức

Phương thức truyền tải là **chỉ qua stdio** — một tiến trình server cho mỗi agent.

[Bản sửa đổi ngày 28-07-2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/) của MCP
đã đặt giao thức thành không trạng thái theo mặc định, loại bỏ bắt tay `initialize` và
header `Mcp-Session-Id`. Server này không bị ảnh hưởng về mặt thiết kế: nó không sử dụng bất kỳ
khả năng nào đã bị ngừng hỗ trợ (Roots, Sampling, Logging), chưa từng sử dụng phương thức truyền tải
HTTP+SSE cũ, và đã tuân theo hướng dẫn mới về trạng thái giữa các lệnh gọi —
`run_benchmark` tạo ra một job handle tường minh mà mô hình truyền ngược lại, thay vì
dựa vào một phiên truyền tải.

Server **chưa** được nâng cấp lên bản sửa đổi mới, vì chưa có SDK TypeScript nào được công bố
hỗ trợ bản sửa đổi này. Hãy xem [README của
server](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) để biết
quan điểm đầy đủ.

## Các endpoint cho máy đọc

Không cần MCP client cho các endpoint này:

| Endpoint | Mô tả |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [Cửa đón tiếp agent](/for-agents), dưới dạng markdown thô |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Mục lục chọn lọc của trang web này |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Mọi trang được lập chỉ mục, được nhúng trực tiếp |
| [`/queue.json`](https://champollion.dev/queue.json) | Toàn bộ hàng đợi benchmark |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Các hạng mục đầu hàng đợi |
| [`/registry.json`](https://champollion.dev/registry.json) | Sổ đăng ký ngữ liệu |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Đồ thị ngôn ngữ đã được đo lường |

## Bước tiếp theo

- [Vận hành rails qua MCP](/docs/agents/mcp) — profile rails, từng bước một
- [Hợp đồng vận hành](/docs/agents/contract) — các quy tắc mà agent tuân theo
- [Hướng dẫn cho Agent — xây dựng & benchmark](/docs/agents/measurement)
- [Hướng dẫn cho Agent — dịch thuật bằng CLI](/docs/agents/serving)
- [Gửi một phương thức](/docs/network/getting-started/submit-a-method)
