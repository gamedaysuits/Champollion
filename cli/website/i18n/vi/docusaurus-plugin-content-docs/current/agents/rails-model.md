---
title: "Mô hình rails"
slug: /agents/rails-model
description: "Cách một dự án trên rails của Champollion được xây dựng: cây dự án, sáu định dạng được xác thực bằng schema mà mọi công cụ đều đọc, quy trình duy nhất từ đầu vào được chấp nhận đến đầu ra được đo lường, hành trình dưới dạng dữ liệu, và hình thái của từng trường hợp từ chối."
---

# Mô hình rails

Một dự án trên rails là một thư mục chứa các tệp thông thường. Mọi công cụ — CLI `champollion`, `nmt-forge`, `mt-eval` và MCP server — đều đọc các tệp này như nhau, theo cùng các schema, với cùng các kết luận đánh giá. Bước tiếp theo luôn được đọc từ các tệp, không bao giờ được ghi nhớ tạm thời. (Có hai thứ nằm ngoài dự án: MCP server đếm số lần thất bại của một bước trong suốt vòng đời của nó, và nmt-forge duy trì một hàng đợi huấn luyện trên toàn máy trong `~/.nmt-forge`.) Hãy sửa đổi một tệp bằng tay, sau đó yêu cầu bước tiếp theo, và câu trả lời sẽ phản ánh đúng thay đổi đó.

Trang này đóng vai trò như một bản đồ hướng dẫn. Các quy tắc vận hành nằm trong [bản hợp đồng quy chuẩn](/docs/agents/contract); các lệnh gọi công cụ nằm trong [MCP](/docs/agents/mcp) và [shell](/docs/agents/shell).

## Các công cụ

| Công cụ | Cài đặt | Vai trò trên rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Khởi tạo dự án, đưa dữ liệu vào, ghi nhận các điều khoản, chỉ định bước tiếp theo, chạy các vòng cải tiến, kết nối mô hình với ứng dụng |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Huấn luyện, sàng lọc, phân chia tập dữ liệu, ghi lại dự đoán, chấm điểm mô hình trên tập kiểm thử và xuất mô hình, phục vụ mô hình; duy trì sổ cái |
| `mt-eval` | đi kèm với `nmt-forge` (gói `mt-eval-harness`) | Chạy một phương pháp trên tập kiểm thử, một tệp hoặc một yêu cầu; áp dụng các cổng kiểm soát; chấm điểm |
| `champollion-mcp-server` | npx | Điều khiển CLI `champollion` dưới dạng các tiến trình con có giới hạn; cấu hình rails bao gồm sáu công cụ |

Mỗi công cụ chạy như một tiến trình riêng biệt. MCP server chạy chính những lệnh mà một người dùng nhập vào (`run_next_step` của nó từ chối bất kỳ chương trình nào khác ngoài `champollion`, `nmt-forge` và `uv tool install … nmt-forge`).

## Cây thư mục dự án

`champollion new <folder> --from <language> --to <language>` tạo ra:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

Lệnh này từ chối thư mục đã chứa dự án (exit 1) hoặc bất kỳ tệp không ẩn nào (exit 1), và từ chối `kind` khác ngoài `language`: các dự án `task` và `service` hiện chưa hỗ trợ trên rails. `--dry` phân giải các ngôn ngữ và không ghi gì vào đĩa.

Các bước tiếp theo sẽ bổ sung phần còn lại trong quá trình chạy:

| Đường dẫn | Được ghi bởi | Chứa |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — các điều khoản của tệp bên cạnh |
| `data/combined-from/` | `champollion data combine` | các bản gốc mà combine đã gộp (đã di chuyển, không bao giờ bị xóa) |
| `data/not-for-training/` | `champollion data combine` | các tệp mà người nắm giữ quyền cho biết không mô hình nào được học từ chúng |
| `.forge/` | `nmt-forge init` | không gian làm việc: `eval-registry.json`, `ledger.jsonl`, các bản đăng ký trước, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | cấu hình huấn luyện (một preset mô hình được mở rộng thành các con số cụ thể) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | các cặp huấn luyện đã qua sàng lọc |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | tập dev; tệp huấn luyện của từng vòng |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | các câu người nói đã viết cho tập dev — vai trò `dev`, chỉ lưu cục bộ, không bao giờ dùng để huấn luyện |
| `improve/time.json` | `champollion improve time` | thời gian của người nói, theo lời của chính họ |
| `improve/round-<k>/` | các bước improve | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (những hàng mà mô hình kia đã soạn thảo — một mô hình mới hơn chưa được dùng, hoặc mô hình mà một lần thăng cấp đã thay thế: số hàng, tên lần chạy, mối quan hệ và số lượng cặp huấn luyện của từng mô hình — và, từ vòng 2, `repeat_rows`: các hàng được hiển thị lại, mỗi `row`, `from_round`, `from_row` và `mark` trước đó), `marks.json` (các số lượng đếm, tỷ lệ đúng cùng khoảng tin cậy của nó, `blind`, và `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | một mô hình đã xuất và method.json của nó |
| `deploy/<name>.json` | `nmt-forge export` (bên trong một dự án rails) | deployment/1 — những gì được triển khai |
| `gates/*.json` | con người | gate-chain/1 — các bước kiểm tra giữa đầu ra và những gì được phát hành |
| `methods/<id>/method.json` | con người | method/1 (cũng do `nmt-forge export` ghi vào một thư mục mô hình, `mt-eval export` và `champollion serve --emit-manifest`) |

## Các định dạng

Sáu schema của framework nằm trong `shared/schemas/framework/`. Mỗi tài liệu chỉ định schema của nó trong `$schema`. Các khóa không xác định đều bị từ chối; khóa riêng của bạn sẽ được đặt dưới `x-`.

| Định dạng | `$schema` | Vị trí | Bản chất |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Chỉ các quyết định: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | Các điều khoản của một tệp dữ liệu: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, các trường đăng ký, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Một phương pháp: `id`, `name`, `kind` và thiết lập duy nhất của loại đó, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Các cổng `metric-threshold` có thứ tự và một `fallback` tùy chọn |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Một phương pháp, các cổng kiểm soát của nó, một cặp ngôn ngữ; tùy chọn máy chủ và cổng `serve` |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | hợp đồng `/translate` | Các tài liệu yêu cầu, phản hồi, lỗi và `/health` |

`project.defaults` — thiết lập mặc định cho dữ liệu thêm vào dự án khi không có chỉ định nào khác. `champollion new` ghi `{"transmission": "local-only", "training": "ask", "share_scores": "ask"}`. The values: `transmission` `local-only` hoặc `ask`; `training` `allowed`, `not-allowed` hoặc `ask`; `share_scores` `never` hoặc `ask`. Giá trị `ask` khiến các công cụ dừng lại để hỏi — rails không bao giờ tự ý đưa ra câu trả lời.

Có hai bản ghi khác không phải là schema của framework nhưng là một phần của mô hình:

- **Sổ cái forge**, `.forge/ledger.jsonl`: chỉ ghi thêm và được nối chuỗi băm
  (mỗi mục nhúng mã băm của mục liền trước; `nmt-forge ledger verify`
  sẽ báo lỗi nếu có bất kỳ chỉnh sửa nào). Sổ cái này ghi lại các lượt đăng ký, mọi lần đọc một tập
  hợp đã đăng ký, các lượt đăng ký trước, điểm số, các lần dùng tập niêm phong, việc ghi đè, phán quyết
  kiểm toán rò rỉ, mức sàn từ điển, các lượt xuất, lựa chọn, lượt phục vụ, phán quyết vòng
  (`improve-compare`: `better`, `worse`, `no-change`, hoặc `too-few` dưới 50
  câu dev), cách mỗi vòng huấn luyện (`round-plan`), các bản nháp của mô hình kia
  cho bảng đánh giá (`draft-newer`: tên lượt chạy, `relation`, số lượng cặp huấn luyện
  của từng mô hình và số lượng bản nháp), phán quyết đánh giá mù của người nói tiếng đối với một mô hình mới hơn (`improve-speaker`: tên lượt chạy, bốn số lượng đếm, `z`,
  `clear`), các thay đổi mô hình (`model-change`, bao gồm một `not-now`) và những gì
  `nmt-forge tidy` đã gỡ bỏ (`tidy`: các lượt chạy và số byte). Chỉ có các số đếm, mã băm và
  đường dẫn — tuyệt đối không bao giờ chứa một câu văn nào. Đây là việc ghi chép sổ sách
  giúp phát hiện can thiệp, không phải bảo mật mật mã học.
- **Thẻ lượt chạy**: những gì `mt-eval run` ghi lại cho một lượt chạy có tính điểm, và những gì một
  kết quả được công bố mang theo. Xem [đặc tả thẻ lượt chạy](/docs/network/specifications/run-card).

**Khóa kiểm tra.** `champollion validate [folder]` kiểm tra tệp dự án, từng tệp sidecar, từng `method.json` (tại thư mục gốc, trong `methods/*/` và `.champollion/methods/*/`), `gates/*.json` và `deploy/*.json` đối chiếu với các schema này. Bộ kiểm thử đọc cùng các tệp này với cùng kết luận. Exit 0 = không có lỗi, 1 = tài liệu không hợp lệ, 2 = lỗi sử dụng lệnh. Lệnh chỉ mở các tệp JSON này, không bao giờ mở tệp dữ liệu.

`champollion upgrade [folder]` viết lại các tệp sidecar được tạo trước thời set/1 (không có `$schema`) thành set/1, giữ lại mọi giá trị (khóa mà set/1 không nhận biết sẽ được chuyển vào `x-<key>`). Nó giữ nguyên sidecar không hợp lệ và liệt kê `method.json` cũ hơn mà không thay đổi: mọi công cụ vẫn đọc được nó, dưới dạng method/0, kèm theo một cảnh báo.

## Quy trình duy nhất

Mọi cách thức mà một phương pháp xử lý văn bản đều tuân theo một quy trình duy nhất trong công cụ đánh giá:

1. **Tiếp nhận.** Các điều khoản của đầu vào được đọc (tệp sidecar set/1, vỏ bọc JSON, mục đăng ký) và chính sách truyền tải của nó được giải quyết cũng như thực thi trước khi dịch bất cứ thứ gì. Kênh truyền tải nào không được chính sách cho phép sẽ bị từ chối tại đây (xem [quy tắc dữ liệu](/docs/agents/data-rules)).
2. **Phương pháp.** Một phương pháp thực hiện dịch (các loại của method/1: `llm`, `llm-coached`, `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`, `human`).
3. **Cổng kiểm soát.** Nếu một chuỗi cổng được chỉ định, từng phân đoạn sẽ được đánh giá; cổng đầu tiên từ chối sẽ quyết định nội dung nào được phát hành (`drop`, `keep-source`, `flag`, `fallback`). Xem [phương pháp và cổng kiểm soát](/docs/agents/methods).
4. **Đầu ra.** Nhật ký lượt chạy được ghi lại; các tệp được trích xuất từ dữ liệu đầu vào có đánh dấu sẽ mang theo các điều khoản tương ứng trong một tệp sidecar bên cạnh.
5. **Chỉ số đo lường.** Chỉ tính khi có bản dịch tham chiếu: điểm số tiêu đề đánh giá nội dung đã phát hành, điểm số chưa qua cổng kiểm soát nằm bên cạnh. Xem [đo lường](/docs/agents/measurement).

Các chế độ hoạt động đều là cùng một quy trình áp dụng trên dữ liệu đầu vào khác nhau:

| Chế độ | Lệnh | Đầu vào | Chỉ số đo lường |
|---|---|---|---|
| Đo lường | `mt-eval run` (`mt-eval test` chấm điểm lại một nhật ký lượt chạy) | tập kiểm thử hoặc tập phát triển | có |
| Dịch một tệp | `mt-eval translate --out <file>` | chỉ chứa văn bản nguồn | không |
| Phục vụ | `mt-eval serve` | từng yêu cầu một | không |

**Một bản triển khai chính là quy trình đo lường áp dụng trên đầu vào chỉ có nguồn.** Một tệp deployment/1 được kiểm thử (`mt-eval run --deployment`), chạy trên một tệp (`mt-eval translate --deployment`) và được phục vụ (`mt-eval serve --deployment`), để đảm bảo những gì đã đo lường chính là những gì được phát hành. Với `--deployment`, các cờ do tệp quyết định (`--method`, `-m`/`--model`, `--gates`, `--target-script`) đều bị từ chối. Một bản triển khai không nêu điểm số: con số đo lường được là kết quả của một lượt chạy, được lưu cùng lượt chạy đó. Xem [phục vụ](/docs/agents/serving).

## Lộ trình dưới dạng dữ liệu

Trình tự công việc được lưu trong một tệp: `shared/journeys/language.json`. Bộ đánh giá, `cli/lib/framework/journey.js`, là bên duy nhất đọc tệp này; `champollion next`, cấu hình rails của MCP và `NEXT.md` đều hỏi nó cùng một câu hỏi. **Bước đầu tiên chưa hoàn thành chính là bước tiếp theo.** Nó chỉ đọc các tệp sidecar, tệp dự án cùng sổ đăng ký và sổ cái của forge — không bao giờ đọc văn bản của tệp dữ liệu — và không chạy bất cứ thứ gì ngoại trừ `nmt-forge --version` (giới hạn trong 30 giây) cho bước cài đặt và `nmt-forge status --json` (giới hạn trong 60 giây) khi công việc bước vào giai đoạn huấn luyện.

**Các giai đoạn.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**Một bước** bao gồm `id`, `stage`, `mode`, những lời giải thích dễ hiểu cho người dùng (`say`) và lý do tại sao bước này quan trọng (`why`), cùng với `command` trong hầu hết trường hợp. Các trường tùy chọn:

| Trường | Ý nghĩa |
|---|---|
| `done_when` | Điều kiện kiểm tra xác nhận bước này đã hoàn thành. Bắt buộc (ngoại trừ trên bước ủy quyền) |
| `when` | Điều kiện kiểm tra bắt buộc phải thỏa mãn để bước này có hiệu lực (mức sàn từ điển chỉ áp dụng khi `data/lexicon/` chứa một tệp) |
| `question`, `answers` | Câu hỏi của một bước `ask_user` và các ô câu trả lời: `{"enum": [...]}` hoặc `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | Việc tác nhân tự thực hiện cho bước của con người (đưa các tệp được chỉ định vào bằng `add_data`) |
| `outdated` | Một biến thể được sử dụng khi kiểm tra thấy công cụ đã quá cũ |
| `delegate` | `"nmt-forge"`: bàn giao cho cố vấn riêng của forge |

Các `{placeholders}` trong `say`, `question` và `command` được điền tự động từ tệp dự án và các tệp được tìm thấy.

**Các bước kiểm tra** là một tập hợp cố định; bộ đánh giá sẽ báo lỗi nếu gặp kiểm tra lạ: `project_valid`, `data_files`, `every_data_file_has_terms`, `protected_test_set`, `tool_on_path` (với `min_version`), `path_exists`, `forge_test_registered`, `single_file`, `forge_role_registered`, `forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`, `improve_prepared`, `forge_trained_on_current`.

**Các chế độ:**

| Chế độ | Ai thực hiện | Những gì rails cho phép |
|---|---|---|
| `auto` | tác nhân | chạy lệnh |
| `confirm` | tác nhân, sau khi được đồng ý | cài đặt, huấn luyện, bất kỳ thao tác nào tốn kém hoặc xuất bản; chỉ chạy sau khi người dùng đồng ý |
| `ask_user` | người dùng trả lời | hỏi `question`; truyền câu trả lời theo các khóa trong `answers`; không bao giờ tự trả lời thay họ |
| `wait` | không ai | tác vụ đang chạy; hãy hỏi lại sau |
| `human_only` | con người | thu thập câu, đánh giá bản dịch thô, lựa chọn |
| `use_tool` | tác nhân, bằng công cụ riêng của nó | Chỉ trên MCP: bước `human_only` có trường `agent` được hiển thị dưới dạng `use_tool` kèm `step.tool` |

**Ủy quyền.** Tại bước `forge`, lộ trình sẽ gọi `nmt-forge status --json` và lấy trạng thái của forge làm bước tiếp theo. Các trạng thái của forge tương ứng với các chế độ: `training` → `wait`; `ready-to-train` và `needs-training-extra` → `confirm`; `missing-preregistration` → `ask_user`; `choose-export` → `human_only`; `improve-compare` → `auto`; `improve-promote` → `confirm`; `improve-stronger-model` → `ask_user`. Bất kỳ trạng thái nào khác đều là `auto` khi forge chỉ định một lệnh, và `human_only` khi không có lệnh nào. Trạng thái `serving` kết thúc giai đoạn xây dựng và giai đoạn cải tiến bắt đầu.

Có hai loại bước xuất phát từ bên ngoài danh sách các bước:

- **Đánh giá bản dịch dự đoán.** Sau khi một mô hình xuất ra được chấm điểm trên tập kiểm thử, câu dự đoán do người dùng viết theo lời của họ sẽ chờ kết luận đánh giá: một bước `ask_user` với `answers` `verdict` (`held` hoặc `missed`) và `by` (ai là người đánh giá), chạy lệnh `nmt-forge prereg verdict`.
- **Chờ sự đồng ý.** Mỗi tệp có sidecar ghi `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting`, được giải quyết bằng id bước riêng của nó bất cứ khi nào người dùng có câu trả lời. Bước này không bao giờ làm ngưng trệ phần còn lại của rails.

**Id của bước** là `<journey step id>:<8 hex characters>` — mã băm của bước và lệnh đã được điền đầy đủ của nó. Nếu dự án thay đổi, id cũng thay đổi, và một `run_next_step` mang id cũ sẽ bị từ chối (`the project changed since that step was named`).

**Những gì `champollion next --json` trả về:** `project`, `kind`, `stage` (`n`, `of`, `id`, `title`), `done` (các id bước), `step` (`id`, `mode`, `say`, `why`, và nếu có thì thêm `command`, `question`, `answers`, `agent`, `agent_tool`, `file`, `source`), `now` (thông tin thực tế từ forge — những gì đang diễn ra ngay lúc này), `waiting`, `forge` (`state`, `blockers`, `warnings`), `finished` (khi không còn bước nào) và `error`. Mã thoát exit 1 khi có lỗi và không có bước nào.

## Dạng phản hồi từ chối

Mỗi phản hồi từ chối đều nêu rõ điều gì đã xảy ra, và đa số đều giải thích lý do cùng cách khắc phục.

| Công cụ | Đầu ra cho người đọc | Đầu ra máy đọc | Mã thoát |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, sau đó là `  why: …` và `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` trên stdout | 2 từ chối |
| `champollion` | `[ERR] message` trên stderr | `--json` khi lệnh có hỗ trợ | 1 từ chối, 2 lỗi sử dụng |
| Các công cụ MCP rails | — | `{"refused": "<reason>", …}` với `isError: true`, kèm cách thử lại nếu có (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` trong lỗi của forge là lớp ngoại lệ (`UsageError` đối với các đối số
không hợp lệ — forge thà từ chối các cờ viết tắt thay vì đoán mò). Tên các rào chắn
của forge bao gồm `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` và `disk-room` (một
lượt huấn luyện mà đĩa cứng không đủ chỗ chứa). Khi một lỗi
đáng lẽ sẽ trích dẫn một câu thuộc kho ngữ liệu được giữ lại, câu đó sẽ hiển thị là
`[sentence withheld]` và đối tượng sẽ bổ sung `text_withheld`.

Hãy truyền đạt lại lời từ chối bằng từ ngữ giản dị và làm theo hướng dẫn khắc phục, hoặc yêu cầu bước tiếp theo một lần nữa. Một bước đã thất bại hai lần sẽ không được chạy lại cho đến khi người dùng quyết định ([MCP](/docs/agents/mcp#when-a-step-fails)).

## Tìm hiểu sâu hơn

- [Hợp đồng vận hành](/docs/agents/contract) — các quy tắc, khóa kiểm tra và ghi chú.
- [Điều khiển rails qua MCP](/docs/agents/mcp) và [từ shell](/docs/agents/shell).
- [Quy tắc dữ liệu và truyền tải](/docs/agents/data-rules) — chi tiết đầy đủ về set/1.
- [Phương pháp và cổng kiểm soát](/docs/agents/methods) và [phục vụ](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [Đặc tả thẻ lượt chạy](/docs/network/specifications/run-card) và [đặc tả bộ kiểm thử](/docs/network/specifications/harness).
- [Tài liệu tham khảo lệnh `mt-eval`](/docs/reference/mt-eval) và [tài liệu tham khảo lệnh `nmt-forge`](/docs/network/getting-started/forge-command-reference).
