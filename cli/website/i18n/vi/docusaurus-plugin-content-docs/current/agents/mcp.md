---
title: "Điều khiển rails qua MCP"
slug: /agents/mcp
description: "Kết nối client MCP với hồ sơ rails của Champollion và từng bước xử lý một dự án ngôn ngữ với sáu công cụ: thiết lập cho từng client, mọi đối số và kết quả trả về, vòng lặp, các chế độ từng bước, phản hồi từ chối và các chủ đề giải thích."
---

# Vận hành rails qua MCP

Profile mặc định của máy chủ MCP là rails: sáu công cụ đồng hành cùng một
dự án ngôn ngữ từ một thư mục trống đến một mô hình đã được đo lường ngay trên chính
máy tính của người dùng. Mỗi công cụ chạy CLI `champollion` dưới dạng một tiến trình
riêng biệt, có giới hạn — cùng các lệnh mà một người tự nhập. Máy chủ cũng chuyển cho client
của bạn các chỉ dẫn vận hành ngắn (`instructions-rails.md`) khi kết nối.

## Kết nối

Máy chủ giao tiếp MCP qua stdio và cần Node.js 20.11 hoặc mới hơn. Cấu
hình mà mọi client được cấu hình qua tệp tiếp nhận:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Client | Nơi lưu cấu hình |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Thêm mục này, lưu lại, rồi khởi động lại ứng dụng |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` trong thư mục `.cursor` của dự án, hoặc trong `.cursor` tại thư mục home |

Các client khác có khả năng khởi chạy một máy chủ stdio cục bộ cũng dùng cùng câu lệnh;
trang này chỉ mô tả ba client ở trên.

**Đường dẫn công cụ.** Máy chủ tự tìm CLI mà nó phụ thuộc vào. Nó tìm
`nmt-forge` trên `PATH`, sau đó trong `UV_TOOL_BIN_DIR` (mặc định là `~/.local/bin`,
nơi `uv tool install` đặt tệp) — một client khởi chạy từ ứng dụng desktop thường
có `PATH` ngắn hơn terminal. Ghi đè bằng các biến môi trường trong
`env` của mục máy chủ:

| Biến | Tác dụng |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (mặc định) hoặc `full` |
| `CHAMPOLLION_CLI_BIN` | điểm vào CLI `champollion` cần chạy thay vì bản đi kèm |
| `NMT_FORGE_BIN` | tệp thực thi `nmt-forge` (hành trình của CLI cũng tôn trọng biến này) |
| `UV_TOOL_BIN_DIR` | nơi tìm `nmt-forge` và `uv` sau `PATH` |

## Profile

| Profile | Chọn bằng | Bản chất |
|---|---|---|
| rails | mặc định | Sáu công cụ và các chỉ dẫn ngắn; một dự án ngôn ngữ, từ đầu đến cuối |
| full | `--profile full` trong `args`, hoặc `CHAMPOLLION_MCP_PROFILE=full` | Toàn bộ công cụ: thẻ ngôn ngữ, kho ngữ liệu, benchmark, hàng đợi, cuộc thi, huấn luyện forge, phát hành |

Bất kỳ giá trị nào khác đều sẽ dừng máy chủ: `unknown MCP profile "<value>" (rails or
full)`. Danh mục đầy đủ được liệt kê trên
[trang máy chủ MCP](/docs/network/getting-started/mcp-server). Đối với một
dự án ngôn ngữ, hãy tiếp tục dùng profile rails: đây là profile mà mọi bước
đều được đọc từ các tệp của dự án.

## Vòng lặp

1. Chưa có dự án → `start_project`. Lần gọi đầu tiên không tạo ra gì: hãy chuyển lời
   `ask_first` tới người dùng, sau đó thực hiện lệnh gọi mà nó đưa ra theo câu trả lời của họ.
2. `project_status` → đọc `step.mode`, `step.say`, `step.why`.
3. Thực hiện những gì chế độ yêu cầu, dùng `step.call` — lệnh gọi chính xác để thực hiện
   bước đó.
4. Quay lại bước 2. Sau bất kỳ thay đổi thủ công nào do bạn hoặc người dùng thực hiện, hãy gọi
   lại `project_status`: bước tiếp theo luôn được đọc từ các tệp.
5. `step: null` → rails đã hoàn thành. Hãy nói cho người dùng biết nội dung `finished`.

| `step.mode` | Thực hiện điều này | `step.call` |
|---|---|---|
| `auto` | Chạy lệnh | `run_next_step` với `project_dir`, `step_id` |
| `confirm` | Nói cho người dùng biết bước này làm gì (cài đặt, huấn luyện); hỏi có hoặc không; chỉ chạy khi họ đồng ý. Nếu "để sau", hãy ghi nhận: không có gì chạy | `run_next_step` với `confirmed: true` được thêm sau khi đồng ý; `declined: true` khi "để sau" |
| `ask_user` | Hỏi `step.question` bằng lời lẽ mộc mạc; truyền câu trả lời của họ theo các khóa trong `step.answers`. Khi "để sau": nếu `not-now` là một trong các giá trị `enum` của chính ô đó, thì đó là câu trả lời — hãy truyền nó; nếu không, hãy ghi nhận: không có gì chạy | `run_next_step` với `answers` — mỗi ô được viết dưới dạng `<…>`, cần thay bằng lời của người dùng; `declined: true` đối với "để sau" không nằm trong danh sách câu trả lời |
| `wait` | Có tiến trình đang chạy | `project_status` với `wait_seconds: 120`; lặp lại chừng nào chế độ vẫn là `wait` |
| `use_tool` | Bạn thực hiện ngay lúc này với `step.tool`; không chuyển lại | ví dụ: `add_data` với `path: "<each file the person named, where it is>"` |
| `human_only` | Người dùng thực hiện: báo cho họ `step.say` | không có |

`step.command` là nội dung mà rails chạy — không bao giờ là tên công cụ. Một `<…>` trong lệnh gọi là
một ô chờ câu trả lời hoặc tệp của người dùng; ô nào gửi lại nguyên dạng sẽ bị
từ chối.

## Sáu công cụ

### `start_project`

| Đối số | Kiểu | Ý nghĩa |
|---|---|---|
| `folder` | string, bắt buộc | Thư mục mới cho dự án, tương đối với `parent_dir` |
| `from` | string, bắt buộc | Ngôn ngữ nguồn đưa vào: mã hoặc tên |
| `to` | string, bắt buộc | Ngôn ngữ đích tạo ra: mã hoặc tên |
| `target_name`, `source_name` | string | Tên ngôn ngữ theo cách người bản ngữ gọi; bắt buộc đối với mã dùng riêng (`qaa`–`qtz`) |
| `purpose` | string | Mục đích của bản dịch, diễn đạt bằng lời của người dùng |
| `parent_dir` | string | Nơi tạo thư mục (mặc định: thư mục làm việc của máy chủ) |
| `confirmed` | boolean | `true` chỉ sau khi người dùng đồng ý với chiều dịch |

Nếu không có `confirmed: true`, công cụ sẽ chạy `champollion new --dry` và trả về
`made: false`, `ask_first` (một câu cần nói: *"Bộ dịch này nhận X và
trả về Y — bạn đưa X vào và nhận Y ra. Đó có đúng là chiều bạn
muốn không?"*), `if_yes` và `if_the_other_way` (mỗi mục là một lệnh gọi hoàn chỉnh) cùng
`languages` — nội dung mà mỗi tên được phân giải thành, kèm `matchedAs` khi từ
người dùng nhập là một tên khác mà thẻ ghi nhận, và `alsoNamed` khi cùng một từ đó gọi tên
các ngôn ngữ khác. Hãy nhắc lại cả hai điều này. Khi có `confirmed: true`, công cụ sẽ tạo dự án
và trả về `project`, `languages` cùng `next` (bước đầu tiên).

Một cái tên không có thẻ nào chứa và cũng không có tên gần giống: phản hồi từ chối sẽ kèm thêm
`if_it_has_no_code`, chính là lệnh gọi đó với `to: "qaa"` và tên của họ dưới dạng
`target_name`. Chỉ sử dụng nó cho đúng cái tên mà người dùng đã đưa ra.

### `project_status`

Đối số: `project_dir` (bắt buộc); `wait_seconds` (0–120). Với
`wait_seconds`, công cụ đọc lại mỗi 5 giây một lần chừng nào bước còn là `wait`, và
trả về kết quả khi bước thay đổi hoặc hết thời gian.

Trả về `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call`, và nếu có thì kèm `question`, `answers`, `command`,
`tool`, `for_the_person`), cùng các mục sau khi áp dụng:

| Trường | Bản chất | Việc bạn làm |
|---|---|---|
| `true_now` | Bản ghi của chính Forge, dưới dạng các câu: các mô hình đã huấn luyện cùng chrF++ tập dev tốt nhất, kết luận kiểm toán rò rỉ cho từng tập kiểm thử, điểm số tập kiểm thử, liệu việc huấn luyện có đang chạy không, liệu mô hình có đang được phục vụ không và ở đâu | Chỉ nêu những gì đã làm từ các dòng này, không thêm gì khác |
| `waiting_for_agreement` | Các tệp mà người nói ngôn ngữ chưa đồng ý (`speakers_agreed: not-yet`): mỗi tệp có `file`, `question`, `say` và `call` riêng | Hỏi từng câu một lần mỗi phiên, thật nhẹ nhàng; chỉ gọi lệnh khi người dùng xác nhận mọi người đã đồng ý |
| `files_not_added` | Các tệp mà `add_data` đã từ chối trong phiên này và hiện vẫn chưa có trong dự án, mỗi tệp kèm lý do từ chối | Đưa từng tệp vào (thông báo từ chối hướng dẫn cách làm), hoặc báo cho người dùng biết tệp nào bị bỏ lại và lý do |
| `model_in_use` | Khi mô hình đã được phục vụ, bên cạnh các bước của vòng cải thiện: `say` (trang thử nghiệm và cách dùng) và `for_the_person` (lệnh `champollion connect` để đưa mô hình vào ứng dụng hoặc trang web của họ) | Báo cho người dùng một lần; họ sẽ chạy connect khi muốn |
| `blockers`, `warnings` | Của Forge, nguyên văn | Chuyển tiếp nguyên văn từng từ |
| `finished` | Khi không còn bước nào: những việc người dùng có thể làm lúc này (thử nghiệm mô hình trên trang của nó; một ứng dụng) | Nói cho người dùng |
| `error` | Lý do không thể gọi tên bước nào | Chuyển tiếp lại |

Thư mục dự án không tồn tại, hoặc không có `champollion.project.json`,
sẽ bị từ chối kèm danh sách các dự án tìm thấy gần đó.

### `run_next_step`

| Đối số | Kiểu | Ý nghĩa |
|---|---|---|
| `project_dir` | string, bắt buộc | Thư mục dự án |
| `step_id` | string, bắt buộc | `step.id` (hoặc id của một mục `waiting_for_agreement`) vừa được trả về |
| `answers` | object of strings | `ask_user`: câu trả lời của người dùng theo các khóa trong `step.answers` |
| `confirmed` | boolean | `confirm`: `true` chỉ sau khi người dùng đồng ý. Ngoài ra: một bước đã thất bại hai lần, chỉ chạy khi người dùng yêu cầu thử lại nguyên trạng |
| `declined` | boolean | `true` khi người dùng trả lời để sau cho bước `confirm`, hoặc cho câu hỏi không có câu trả lời `not-now` riêng: không có gì chạy, và sẽ không hỏi lại trong phiên này. Nếu `not-now` là một trong các câu trả lời, hãy truyền vào trong `answers` |

Công cụ sẽ đọc lại bước tiếp theo trước khi chạy bất kỳ thứ gì. **Khóa:**

- ID khác sẽ bị từ chối: `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only` bị từ chối (`a person does this step: …`); một bước `human_only`
  mà agent thực hiện bằng công cụ sẽ bị từ chối kèm công cụ cần dùng.
- `wait` bị từ chối; `confirm` nếu thiếu `confirmed: true` sẽ bị từ chối (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: mọi câu trả lời đều bắt buộc (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `phần giữ chỗ `<…>` bị
  từ chối; câu trả lời nằm ngoài `enum` bị từ chối.
- Chỉ các chương trình của chính rails mới được chạy: `champollion`, `nmt-forge`, và `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` hoặc một
  ký tự `&` đứng riêng sẽ bị từ chối; `&&` nối các phần, chạy theo thứ tự, dừng lại ở lỗi
  đầu tiên.
- Mỗi phần bị giới hạn trong 10 phút (cài đặt `uv` là 15 phút).
- `declined: true` đối với một bước không phải `confirm` cũng không phải `ask_user` sẽ bị
  từ chối: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `declined: true` đối với một bước có `answers` bao gồm `not-now` (hiện tại là `try_it` của
  đề xuất mô hình mạnh hơn) sẽ bị từ chối, và thông báo từ chối mang theo `answers`
  của bước: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Trả về `ran` — cho mỗi phần: `command`, `exit_code`, `timed_out` khi xảy ra, và
40 dòng cuối của `output` — cùng `next`, bước tiếp theo theo
cấu trúc của `project_status`.

#### "Để sau"

Có hai cách để ghi nhận điều này, và bước hiện tại sẽ quyết định cách xử lý:

| Bước | "Để sau" là | Nội dung được ghi nhận | Khi nào xuất hiện lại |
|---|---|---|---|
| Một bước `ask_user` có `answers` chứa `not-now` (đề xuất mô hình mạnh hơn: `try_it`, `yes` hoặc `not-now`) | Một câu trả lời: `answers: {"try_it": "not-now"}` | Sổ cái của Forge (`model-change`, `answer: "not-now"`); không có gì khác thay đổi | Sau hai vòng nữa mà tập dev đánh giá là **no-change** hoặc **worse** — xuyên suốt các phiên |
| Một bước `confirm` (huấn luyện, cài đặt, đưa mô hình vào sử dụng), hoặc câu hỏi người dùng chưa thể trả lời | `declined: true` | Chỉ trong bộ nhớ của máy chủ này | Khi máy chủ khởi động lại (phiên tiếp theo) |

`declined: true` không chạy gì cả và trả về `declined` (id của bước), `ran: []`,
`say` (*"Không có gì được chạy. Bước này sẽ không được hỏi lại trong phiên này; nếu họ tự nhắc đến
và đồng ý, hãy thực hiện khi đó."*) cùng `next`. Việc từ chối được lưu giữ trong suốt
vòng đời của máy chủ — tức một phiên; khi máy chủ khởi động lại sẽ quên trạng thái này. Trong thời gian
hiệu lực, bước đó trả về từ `project_status` và `run_next_step` kèm
`declined_this_session` (thời điểm, dưới dạng giờ ISO) và `say` của nó bắt đầu bằng *"Họ
đã chọn để sau (HH:MM UTC) cho bước này: …"* và kết thúc bằng *"Không hỏi lại trong phiên
này — không có gì cần họ đồng ý được phép chạy. Nếu chính họ chủ động nhắc đến
và đồng ý, hãy thực hiện với confirmed: true (hoặc câu trả lời của họ)."* Một lệnh
`confirmed: true` sau đó, hoặc các câu trả lời, sẽ thực hiện bước và xóa trạng thái từ chối này.
**Lưu ý.** Đừng hỏi lại trong phiên này, và đừng tìm cách đi vòng qua bước đó; nếu
người dùng tự nhắc đến và đồng ý, hãy thực hiện khi đó.

#### Khi một bước thất bại

**Khóa.** Một bước đã thất bại hai lần liên tiếp (mã thoát khác 0 hoặc quá thời gian chờ, tính
trong suốt vòng đời máy chủ) sẽ bị từ chối ở lần thứ ba trừ khi có `confirmed: true`,
cùng với `last_output` của nó. **Lưu ý.** Cờ đó do bạn quyết định thiết lập: hãy nói cho người dùng biết
thông báo lỗi nói gì, rồi hoặc là họ khắc phục (chạy một lệnh đã sửa trong terminal cũng
được — sau đó gọi `project_status`), hoặc là họ yêu cầu thử lại nguyên trạng.

### `add_data`

| Đối số | Kiểu | Ý nghĩa |
|---|---|---|
| `project_dir` | string, bắt buộc | Thư mục dự án |
| `path` | string, bắt buộc | Tệp ở vị trí hiện tại: đường dẫn tuyệt đối, hoặc tương đối với thư mục dự án hoặc nơi máy chủ khởi động |
| `into` | `parallel` (mặc định) · `test` · `lexicon` | Các cặp câu để học; các câu kiểm thử đã rà soát; danh sách từ |
| `source_col`, `target_col` | string | Cột dưới dạng chữ cái (`A`), số hoặc tiêu đề; đối với ELAN, số thứ tự tầng (tier) mà thông báo từ chối liệt kê (hoặc tier id chính xác mà người dùng nhập); đối với LIFT, mã ngôn ngữ |
| `sheet` | string | Trang tính hoặc bảng nào, khi có nhiều trang/bảng |
| `header` | boolean | `true`: hàng đầu tiên là tiêu đề; `false`: đó là dữ liệu |
| `usfm_source` | string | Chỉ dành cho kinh thánh USFM: văn bản của ngôn ngữ còn lại (tệp hoặc thư mục `.usfm`) |
| `replace` | boolean | Đọc lại tệp đã thêm trước đó (tiêu đề hoặc các cột khác); câu trả lời của người nắm giữ dữ liệu vẫn được giữ nguyên |

Công cụ chạy `champollion data add`. Trước tiên hãy gọi chỉ với đường dẫn: một tiêu đề
nêu tên các ngôn ngữ trong cặp sẽ quyết định các cột; nếu không, công cụ sẽ hỏi, và bạn
hỏi người dùng — tuyệt đối không tự quyết định từ nội dung. Nó đọc các bảng tính
(`.xlsx`, `.ods`, `.csv`), `.tsv` và `.txt`, bảng trong Word `.docx`, từ điển Toolbox
và LIFT, các tệp ELAN `.eaf` và USFM.

Trả về `result` (báo cáo của CLI: số lượng, các cột, các tầng ELAN theo số thứ tự, và
số hàng mà quá trình kiểm tra hàng chỉ ra — bản sao, lặp lại, độ dài bất thường,
hàng bị hoán đổi hoặc lệch vị trí, không có gì bị xóa — tuyệt đối không in câu văn), `read_from` khi
tệp được tìm thấy từ thư mục khởi động của máy chủ, và `also` khi
tệp còn chứa nội dung khác (các câu ví dụ của từ điển dưới dạng cặp câu, hoặc các giải nghĩa dưới dạng
danh sách từ) — mỗi mục là một lệnh gọi `add_data` hoàn chỉnh. Hãy thực hiện trừ khi
các điều khoản của người dùng đối với tệp đó loại trừ nó. Hãy chuyển tiếp kết quả kiểm tra hàng nguyên trạng:
người dùng sẽ tự xem các hàng đó trong chính tệp của họ
([quy tắc dữ liệu](/docs/agents/data-rules#what-tools-print-and-never-print)).
Đừng bao giờ yêu cầu người dùng di chuyển tệp; `inbox/` chỉ là nơi họ có thể thả
tệp vào.

### `try_translation`

Đối số: `project_dir`; `text` — tối đa 10 dòng, nhiều nhất 2.000 ký tự,
mỗi dòng một câu, là những từ ngữ mà người dùng cung cấp cho bạn.

Công cụ sẽ tìm mô hình mà dự án này phục vụ (tác vụ `serve` khỏe mạnh mới nhất trong
`nmt-forge jobs --json`), chỉ trên máy tính này, và đọc `/health` của nó.

- **Khóa.** Nếu `output_local_only` không phải là `false` (true hoặc unknown), công cụ
  sẽ không trả về bản dịch nào: `shown_to_person_only: true`, `open` (trang riêng của
  mô hình) và `say`. Hãy hướng người dùng đến đó; đừng yêu cầu họ dán lại
  bản dịch cho bạn.
- Máy chủ yêu cầu token sẽ bị từ chối: token không bao giờ được giao cho
  agent.
- Nếu không, nó trả về `model`, `pair`, `translations` (`source`,
  `translation` trên mỗi dòng), `errors` nếu có, và `say`: hãy chuyển tiếp nguyên
  trạng; máy chủ không kiểm tra bất kỳ nội dung nào nó trả về.

### `explain`

Đối số: `topic`. Các văn bản bằng lời mộc mạc để chuyển tiếp:

| `topic` | Nội dung bao gồm |
|---|---|
| `rails` | Thư mục dự án và thứ tự của các bước |
| `privacy` | Ý nghĩa của sidecar; lý do bạn không bao giờ mở các tệp |
| `quality` | Điểm số hứa hẹn điều gì và không hứa hẹn điều gì |
| `modes` | Cách thực hiện từng loại bước |
| `improve` | Các vòng sau khi mô hình được đưa vào sử dụng: khoảng một phần mười hàng duyệt *"được cố ý lấy lại từ bảng trước đó (bảng tính có nêu rõ điều này …)"*; đề xuất mô hình tốt hơn để sử dụng và mọi người đồng ý (*"chỉ riêng kết luận thì không thay đổi được gì"*); kết luận too-few; đề xuất mô hình mạnh hơn sau *"hai vòng liên tiếp mà tập dev có thể đánh giá không thấy cải thiện (tính từ mô hình gần nhất được đưa vào sử dụng)"* |
| `off_rails` | Rời khỏi rails: chạy một lệnh chuyên gia, sau đó gọi `project_status` |

## Lưu ý cho toàn bộ phiên

- **Lưu ý.** Mọi thứ bạn đọc đều được gửi đến nhà cung cấp mô hình của bạn. `add_data`,
  `project_status` và `run_next_step` chỉ báo cáo số lượng, các cột và trạng thái, không bao giờ
  báo cáo câu văn; hãy giữ đúng như vậy. Đừng tự mở các tệp.
- **Lưu ý.** Câu trả lời `ask_user`, `confirmed: true` và sự đồng ý
  `waiting_for_agreement` là của người dùng. Các công cụ kiểm tra xem câu trả lời
  có hiện diện và đúng định dạng hay không; chỉ có bạn mới có thể đảm bảo đó là của họ.
- **Lưu ý.** Chuyển tiếp `blockers`, `warnings` và mọi khuyến cáo nguyên văn từng từ, cùng
  mọi con số kèm đơn vị và tập dữ liệu mà nó được đo lường
  ([hướng dẫn](/docs/agents/coaching)).

## Tìm hiểu sâu hơn

- [Hợp đồng vận hành](/docs/agents/contract) — các khóa và lưu ý.
- [Mô hình rails](/docs/agents/rails-model) — hành trình, các chế độ và
  step id mà các công cụ này đọc.
- [Vận hành rails từ shell](/docs/agents/shell) — các bước tương tự dưới dạng
  câu lệnh.
- [Máy chủ MCP](/docs/network/getting-started/mcp-server) — cả hai profile
  và danh mục công cụ đầy đủ.
