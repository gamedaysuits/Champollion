---
title: "Phục vụ và triển khai"
slug: /agents/serving
description: "Đưa mô hình đã được đánh giá vào hoạt động: tệp deployment/1 mà nmt-forge export ghi ra, mt-eval translate và serve, nmt-forge serve cùng trang dùng thử của lệnh này, hợp đồng service-api/1 /translate, champollion connect và champollion sync do agent điều khiển — cùng với những gì đầu ra chỉ cục bộ có thể và không thể làm."
---

# Phục vụ và triển khai

**Một bản triển khai là quy trình đo lường trên đầu vào chỉ gồm văn bản nguồn.** Một
tệp deployment/1 nêu rõ phương thức, mô hình, các cổng kiểm soát và cặp ngôn ngữ tương ứng.
Cùng tệp đó được kiểm thử trên một tập kiểm thử, chạy trên một tệp và được phục vụ, nhờ vậy những gì
được đo lường chính là những gì được phát hành. Trang này là phần dành cho tác nhân của
[Đưa vào sử dụng](/docs/put-it-to-work).

Xuyên suốt tài liệu: một mô hình học từ các câu được đánh dấu chỉ-cục-bộ có thể lặp lại
chúng, vì vậy **đầu ra của nó cũng chỉ-cục-bộ**. Mọi công cụ dưới đây đều giữ đầu ra đó
trên máy tính này trừ khi những người nắm giữ dữ liệu đồng ý khác đi, và
`--holders-agreed-by` ghi lại người đã đồng ý. **Lưu ý.** Chỉ truyền cờ đó cùng
tên mà người dùng đã cung cấp cho bạn, sau khi họ xác nhận những người nắm giữ dữ liệu đã đồng ý.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Bắt buộc: `id`,
`pair` (`source`, `target`, tùy chọn `target_script`), `method` (`method`,
tùy chọn `model`). Tùy chọn: `gates` (một tệp gate-chain/1) và `serve`
(`host`, mặc định `127.0.0.1`; `port`). Các đường dẫn là tương đối so với thư mục gốc của dự án,
nơi rails chạy các lệnh. Nó không nêu điểm số nào.

**Thành phần ghi tệp.** `nmt-forge export`, khi bản xuất nằm bên trong một dự án
rails (có một `champollion.project.json` phía trên nó), sẽ ghi
`deploy/<name>.json` — `<name>` là `--name` ở định dạng kebab-case, nếu không thì là
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

Nó không ghi tệp nào (và thông báo `no deployment file: …`) khi bản xuất nằm ngoài
dự án rails, khi mô hình được chọn dưới một hook giải mã (chỉ
`nmt-forge serve` mới chạy các hook của forge), khi cấu hình không nêu cặp ngôn ngữ nào, khi
tài liệu không hợp lệ, hoặc khi `deploy/<name>.json` đã triển khai
một mô hình khác (không bao giờ bị thay thế).

**Thành phần đọc tệp.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Các khóa bảo vệ.** Khi có `--deployment`, `run` và `translate` sẽ từ chối `--method`,
`-m`/`--model`, `--gates` và `--target-script` (*"--deployment … xác định
phương thức, mô hình, các cổng kiểm soát và hệ chữ đích; hãy bỏ … (hoặc thay đổi
tệp)"*); `serve` cũng từ chối `--pair`. Đầu vào thuộc cặp ngôn ngữ khác sẽ bị từ chối
(`deployment <id> translates from <src>; this input is in <x>`). Một
bản triển khai có chuỗi cổng dự phòng (fallback) có thể được dịch và phục vụ, nhưng không thể
được đo lường: `mt-eval run` từ chối một chuỗi có dự phòng
([các phương thức và cổng kiểm soát](/docs/agents/methods#gate-chains)).

## Thành phần của một bản xuất

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` ghi:

| Đường dẫn | Ý nghĩa |
|---|---|
| `<dir>/model/` | Thư mục dùng để triển khai: trọng số và bộ tách từ (tokenizer), `forge-model.json` (dữ liệu đã dùng để huấn luyện, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, loại `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (cổng 8378 trừ khi `--port`), `card.commercial_ready: false`, `evidence` kèm theo chrF++ của tập kiểm thử, khoảng tin cậy và n |
| `<dir>/evaluation/` | Bằng chứng của tập kiểm thử. Không bao giờ sao chép tệp này cùng với mô hình |
| `<dir>/input-words.json` | Các từ thuộc phía đầu vào của các câu huấn luyện, mỗi từ một lần, được sắp xếp (`words`, `english`, `sentences`, `from`, và `notes` nêu tên tệp huấn luyện không thể đọc được như khi lượt chạy đã đọc). Nằm cạnh `model/`, không bao giờ nằm trong đó: chúng là từ ngữ lấy từ dữ liệu của cộng đồng. Được ghi khi bản xuất bao gồm mô hình và các tệp huấn luyện của nó có trên máy tính này; nếu không, bản tóm tắt của bản xuất sẽ ghi `input_words.written: false` kèm `why`. `nmt-forge serve` đọc tệp này để nêu tên các từ mô hình chưa từng thấy ([bên dưới](#words-the-model-never-saw)) |
| `<dir>/README.md` | Bản xuất này là gì |

## `mt-eval translate`

Quy trình xử lý trên một tệp, không chấm điểm gì. `--out` nhận `.jsonl` (mỗi phân đoạn một hàng: `id`, `source`, `output`, `error`, và khi có cổng kiểm soát là `gates`,
`shipped_from`, `fallback`) hoặc `.tsv` (nguồn, tab, đầu ra). Nếu không có `--out`
nó sẽ ghi `<run id>.translations.jsonl` vào thư mục đầu ra (`-o`).
Đầu ra mang theo các điều khoản của đầu vào — và của mô hình — trong một tệp phụ set/1 kèm theo (sidecar).

**Khóa bảo vệ.** Khi đầu ra của phương thức là chỉ-cục-bộ (hoặc đầu ra của phương án dự phòng trong chuỗi cổng là chỉ-cục-bộ), đích đến nằm ngoài dự án sẽ bị từ chối trước khi dịch bất cứ thứ gì: *"từ chối ghi …: những gì phương thức này ghi là chỉ-cục-bộ (…), và vị trí đó nằm ngoài … — nơi mà những người nắm giữ dữ liệu không lựa chọn. Chỉ họ mới có thể đồng ý điều đó — hãy hỏi họ; nếu họ đồng ý: --holders-agreed-by "<who
agreed>" (được ghi lại trong tệp phụ kèm theo; tệp vẫn được đánh dấu chỉ-cục-bộ). Hoặc ghi tệp bên trong dự án"*. Khi có sự đồng ý, tệp phụ kèm theo sẽ ghi lại `holders_agreed: {by, date}`; tệp vẫn giữ trạng thái chỉ-cục-bộ đối với mọi công cụ.

`--json` in ra `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` và `output_gates`. Trả về mã thoát 1 khi mọi hàng đều thất bại. `--publish`
bị từ chối: không có điểm số nào.

## `mt-eval serve`

| | |
|---|---|
| Địa chỉ mặc định | `127.0.0.1:8379` (`--host`, `--port`, hoặc khối `serve` của bản triển khai) |
| Thành phần phục vụ | Chỉ phương thức chạy trong tiến trình này: `lexicon`, `local-model`, hoặc một plugin có method.json khai báo `dependency_class` `S` hoặc `O`. LLM hoặc công cụ lưu trữ bên ngoài bị từ chối |
| Mã xác thực (Token) | `MT_EVAL_SERVE_TOKEN`, chỉ lấy từ biến môi trường. Bắt buộc khi lắng nghe trên bất kỳ địa chỉ nào khác ngoài `127.0.0.1`, `::1` hoặc `localhost`; khi được đặt, bắt buộc đối với mọi `POST` (cả loopback). `GET /health` không bao giờ cần |
| Giới hạn | Thân yêu cầu 1.000.000 byte, 500 khóa, 20.000 ký tự mỗi chuỗi — vượt quá bất kỳ giới hạn nào sẽ trả về `413` |
| Cổng kiểm soát | `--gates <chain>` (hoặc `gates` của bản triển khai). Mọi plugin cổng kiểm soát phải đánh giá mà không cần bản dịch tham chiếu, nếu không nó sẽ không khởi động. Một phương án dự phòng được phép ở đây, và phải chạy trong tiến trình này |

**Khóa bảo vệ — ngoài loopback.** Khi không có mã xác thực (token): *"từ chối lắng nghe trên … khi không có token — bất kỳ ai truy cập được vào cổng đều có thể sử dụng phương thức"*. Khi đầu ra là chỉ-cục-bộ và không có sự đồng ý: *"từ chối phục vụ trên …: những gì phương thức này ghi là chỉ-cục-bộ (…), và một địa chỉ mà các máy khác có thể truy cập sẽ gửi dữ liệu ra khỏi máy này. Chỉ những người nắm giữ dữ liệu mới có thể đồng ý điều đó — hãy hỏi họ; nếu họ đồng ý: --holders-agreed-by "<who agreed>" (được báo cáo trên /health), hoặc giữ nguyên --host 127.0.0.1"*. Đầu ra là chỉ-cục-bộ khi tệp phụ kèm theo của từ điển xác nhận điều đó (hoặc không thể đọc được), hoặc `forge-model.json` của thư mục mô hình ghi nhận các điều khoản huấn luyện chỉ-cục-bộ hoặc không ghi nhận điều khoản nào; trạng thái được báo cáo là không xác định (`null`) đối với một plugin hoặc một thư mục mô hình không có `forge-model.json`.

`/health` phản hồi `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (trong tiến trình này — không có gì được gửi đi đâu), `scored`
(không có gì), `output_gates` và `gates` (id chuỗi, vân tay (fingerprint), các cổng, phương án dự phòng),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (kho lưu trữ) và `version`.

Khi có cổng kiểm soát, một phân đoạn bị từ chối sẽ trả về theo cách cổng đó quy định: `drop` — khóa
dưới `errors`; `keep-source` — văn bản nguồn; `flag` — đầu ra, khóa
được nêu trong `meta.gates.flagged`; `fallback` — bản dịch dự phòng nếu các
cổng chấp nhận nó. Khi không có cổng kiểm soát, nó không kiểm tra bất kỳ nội dung nào trả về.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Địa chỉ mặc định | `127.0.0.1`, cổng `NMT_FORGE_SERVE_PORT` hoặc 8378 |
| Mã xác thực (Token) | `--token` hoặc `NMT_FORGE_SERVE_TOKEN`; bắt buộc khi ở ngoài loopback. `--detach` chỉ lấy giá trị này từ biến môi trường |
| Tuyến đường (Routes) | `GET /` — trang thử nghiệm cho người dùng (không cần token; trang sẽ yêu cầu khi có token được thiết lập); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (tương thích OpenAI); `GET /v1/models` |
| `--detach` | Trả về sau khi `/health` phản hồi; bị dừng nếu không phản hồi trong vòng 120 giây. Bị từ chối khi cổng đã đang phản hồi |
| `--no-hook` | Phục vụ mà không có hook giải mã của lượt chạy (được thông báo trên `/health` và trong `meta`) |
| `--allow-locale` | Đồng thời chấp nhận các mã bản địa này (có thể lặp lại) |
| `--device` | `auto` (mặc định) hoặc `cpu`. Với `auto`, máy chủ được khởi động trong khi tác vụ huấn luyện của cùng dự án đang chạy sẽ sử dụng CPU thay vì chia sẻ GPU, và `/health` sẽ thông báo điều đó (`device_note`) |
| Giới hạn | Thân yêu cầu 1.000.000 byte, 500 khóa, 20.000 ký tự mỗi chuỗi, 5.000 phần việc mô hình cho mỗi yêu cầu — vượt quá bất kỳ giới hạn nào sẽ trả về `413`. Mô hình được yêu cầu 32 phần mỗi lần, nhờ vậy một câu từ yêu cầu khác chỉ phải chờ một phần nhỏ (chunk), không bao giờ phải chờ cả một yêu cầu. Yêu cầu vẫn đang chạy sau 600 giây sẽ bị từ chối toàn bộ — `503`, *"hãy gửi ít phần việc hơn mỗi lần"* — không bao giờ được trả lời một phần |
| Giải mã | Tìm kiếm chùm (beam search) với `num_beams` của bản xuất khi bản xuất ghi nhận `beams_applied` (theo đúng cách mô hình đã được đo lường); tìm kiếm tham lam (greedy) đối với bản xuất cũ hơn. Văn bản gửi đi được chuẩn hóa sang NFC, giống như dữ liệu huấn luyện |

**Khóa bảo vệ.** Ngoài loopback, một mô hình có đầu ra chỉ-cục-bộ — được huấn luyện trên
các câu chỉ-cục-bộ, hoặc không có bản ghi về những gì nó đã học — sẽ bị từ chối
nếu không có `--holders-agreed-by`. `/health` báo cáo `pair`, `accepts`,
`decode_hook`, `run`, các báo cáo dev và test, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` và `output_gates`. Mỗi câu trả lời `/translate` từ một
mô hình chỉ-cục-bộ đều mang `meta.output_local_only: true`, và mỗi
phản hồi `/v1/chat/completions` đều mang `meta.output_local_only` (true hoặc false).
Khi các giới hạn độ dài cắt bớt bất kỳ nội dung nào trong một yêu cầu, `meta.cut` của yêu cầu đó sẽ đếm các
câu bị cắt bớt ở đầu vào (`inputs`) và các bản dịch dừng lại ở giới
hạn trần (`outputs`) ([huấn luyện](/docs/agents/training#the-guarded-loop)).

**Lưu ý.** Trang thử nghiệm là dành cho người dùng. `try_translation` (MCP) chuyển hướng họ
đến đó đối với một mô hình chỉ-cục-bộ; bạn không bao giờ được tự gọi `/translate` để đọc
đầu ra của mô hình ([thỏa ước](/docs/agents/contract) §1).

### Những từ mô hình chưa từng thấy

Một câu chứa từ mà mô hình chưa từng thấy trong quá trình huấn luyện rất có khả năng
bị dịch sai, dù đọc lên có vẻ trôi chảy đến đâu. Trên ngôn ngữ kiểm thử giả lập, một
câu tách biệt chứa một thực từ (content word) mà mô hình chưa từng thấy đã được dịch
đúng 0 lần trong tổng số 358 lần (ByT5-small ở 1.600, 6.400 và 25.600 cặp huấn luyện),
và cho ra kết quả sai một cách tự tin — trôi chảy, mỗi từ đều là dạng từ có thật, nhưng ý nghĩa
lại sai — trong 32%, 55% và 83% số lần: mô hình càng tốt thì dự đoán trông càng
thuyết phục. Do đó máy chủ nêu rõ những từ đó.

- **`/health`** cho biết liệu máy chủ có thể thực hiện hay không: `unseen_words_check` là `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** bổ sung, chỉ khi yêu cầu chứa những từ như vậy,
  `meta.unseen_words` (khóa → các từ trong văn bản của khóa đó mà mô hình chưa từng
  thấy, mỗi từ một lần, theo thứ tự) và `meta.unseen_note`. **`/v1/chat/completions`**
  bổ sung thông tin tương tự, được định danh theo nội dung đã yêu cầu: `SEG_<id>` cho mỗi phân đoạn ở chế
  độ khối, `page` cho một trang, các khóa riêng của đối tượng JSON, hoặc `text`.
- **Không có bản ghi, được thông báo trên mỗi phản hồi.** Máy chủ đọc `input-words.json`
  từ thư mục phía trên thư mục mô hình mà nó phục vụ. Khi không có gì ở đó — một máy tính
  export made before 2026-10-13, one made without its training files on this
  hoặc một thư mục mô hình được sao chép rời khỏi bản xuất của nó — `meta.unseen_check`
  của mỗi phản hồi sẽ thông báo không thể kiểm tra, và nêu lý do. Hãy phục vụ mô hình từ
  export, or export it again.
- **Trang thử nghiệm** đánh dấu dòng: *"Chưa từng thấy trong huấn luyện: … — dòng này
  rất có thể bị sai, dù đọc lên có vẻ trôi chảy đến đâu."*

Một từ là một chuỗi các chữ cái thuộc bất kỳ hệ chữ nào (giữ nguyên dấu nháy đơn bên trong),
chuyển thành chữ thường, ở dạng NFC. Khi phía đầu vào là tiếng Anh, một hậu tố tiếng Anh thông thường
được tính là đã thấy theo cả hai chiều (thấy `walk` → `walked` được tính; thấy `walked`
→ `walk` được tính).

## service-api/1 — thỏa ước `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json`, tuân thủ
`shared/test-fixtures/framework/service-api-vectors.json` (chạy kiểm tra đối với
`mt-eval serve` và `nmt-forge serve`).

- **Yêu cầu (Request)** `POST /translate`: `keys` (khóa → chuỗi nguồn; bắt buộc),
  tùy chọn `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` cho văn bản tài liệu), `instructions` (khóa → ghi chú; chỉ gửi tới
  máy chủ được khai báo tuân theo chúng, `accepts_instructions`). Trường nào máy chủ
  không sử dụng sẽ bị bỏ qua, không bao giờ bị từ chối.
- **Phản hồi (Response):** `200` `{translations, meta}` — `meta` là bắt buộc; `207` bổ sung
  `errors` (khóa → `{message}`). Các lỗi ở dạng `{error: {message}}`: `400` cho
  yêu cầu không thể xử lý, `401` cho token bị thiếu hoặc sai, `404` cho tuyến đường
  không xác định, `413` cho kích thước quá lớn, `500` khi phương thức thất bại — không bao giờ trả lời một phần.
  (`nmt-forge serve` cũng trả về `503` đối với yêu cầu vượt quá giới hạn 600 giây.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false hoặc null), `cost_usd`; máy chủ có thể thêm các trường khác.
- **`GET /health`** yêu cầu `status` (`ok`), `pair`, `output_gates` và
  `output_local_only`; tùy chọn `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **Quy tắc:** máy chủ có `/health` trả về `output_local_only: true` sẽ đặt
  `output_local_only: true` trong `meta` của mọi phản hồi, và ứng dụng khách (client) chỉ
  ghi đầu ra đó vào nơi mà những người nắm giữ dữ liệu đã đồng ý.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Lệnh tìm `method.json` (tệp được đặt tên, hoặc `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` trong
thư mục), cài đặt tệp đó vào `.champollion/methods/` của ứng dụng, và trỏ
từng cặp ngôn ngữ của ứng dụng (`<inputLocale>:<target>`) vào đó dưới dạng `methodPlugin`, đồng thời giữ nguyên
phần còn lại của cặp ngôn ngữ. Thư mục ứng dụng cần có `champollion.config.json`, và
phương thức phải dịch từ `inputLocale` của ứng dụng.

**Khóa bảo vệ.** Một mô hình có đầu ra chỉ-cục-bộ — được xác định từ
`forge-model.json` của nó (trường hợp thiếu cũng được tính), hoặc từ `/health` của dịch vụ —
sẽ bị từ chối nếu không có `--holders-agreed-by`: những gì mô hình ghi vào các
tệp bản địa của ứng dụng sẽ được xuất bản cùng ứng dụng. Khi có cờ này, mỗi cặp ngôn ngữ sẽ ghi lại
`holdersAgreed: {by, date, method, what}`. Lệnh đưa ra cảnh báo mà không làm gián đoạn khi
không có phản hồi tại điểm cuối (`nmt-forge serve <dir> --detach` khởi động điểm cuối)
hoặc khi `/health` không tuân theo service-api/1. `--json` in ra `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, được điều khiển bởi tác nhân

`sync` dịch các tệp bản địa của ứng dụng hoặc trang web bằng các phương thức được nêu tên trong
`champollion.config.json` của ứng dụng đó. Lệnh không hỏi tương tác bất kỳ điều gì.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**Đầu ra `--json`** gồm một đối tượng JSON trên mỗi dòng. Trên stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` kèm theo
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` cùng nhiều thông tin khác; một lượt chạy thử (dry run) sẽ bổ sung `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) và `maxCost`. Trên stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` cùng
`error`.

| Mã thoát | Ý nghĩa |
|---|---|
| 0 | Thành công, không có lỗi |
| 1 | Tên `--redo` hoặc `--force-keys` không khớp với khóa nào; các lỗi không có gì được xử lý; một lỗi xảy ra |
| 2 | `--max-cost` đã dừng lệnh trước bất kỳ lệnh gọi nào (hoặc không xác định được ước tính chi phí); hoặc thành công một phần: có phần việc thất bại, các khóa bị giữ lại, thiếu dạng số nhiều, hoặc bước xác minh phát hiện lỗi |

Lượt chạy thử (dry run) không gửi và không ghi bất cứ thứ gì, không thực hiện xác minh, và thoát với mã 0 trừ khi
khóa được chỉ định không khớp với mục nào hoặc đã xảy ra lỗi. Quá trình xác minh chạy sau một lượt đồng bộ hóa thực tế
trừ khi có `--no-verify`.

**Khóa bảo vệ — câu trả lời chỉ-cục-bộ.** Đối với phương thức `api`, một lô có
`meta.output_local_only` là `true` sẽ không được ghi trừ khi `holdersAgreed` của cặp ngôn ngữ
nêu tên phương thức đó; `sync` thông báo điều này một lần, và nêu rõ lệnh gọi
`champollion connect … --holders-agreed-by`. Những khóa đó vẫn giữ nguyên
trạng thái chưa dịch (hoặc chuyển sang phương án dự phòng của cặp ngôn ngữ).

**Khóa bảo vệ — phương thức `local`.** Phương thức `local` (một điểm cuối
tương thích OpenAI) truy vấn `/health` của máy chủ một lần. Khi kết quả trả về
`output_local_only: true` — như `nmt-forge serve` thực hiện đối với một mô hình được huấn luyện trên
các câu chỉ-cục-bộ — không có nội dung nào từ máy chủ đó được ghi trừ khi `holdersAgreed`
của cặp ngôn ngữ nêu rõ `local`: *"mô hình tại … cho biết những gì nó ghi là
chỉ-cục-bộ … không có nội dung nào từ mô hình được ghi"*, kèm theo lệnh gọi
`champollion connect <the model> --holders-agreed-by "<who agreed>"`. Một
máy chủ có `/health` không phản hồi hoặc không báo `true` (chẳng hạn như máy chủ Ollama hoặc
LM Studio) vẫn được sử dụng như trước.

**Lưu ý.** Kết nối một mô hình forge bằng `champollion connect` (tuyến
`api`): lệnh này đọc bản ghi của chính mô hình về những gì nó đã học, và ghi nhận
sự đồng ý của những người nắm giữ dữ liệu trên cặp ngôn ngữ thuộc phương thức mà lệnh cài đặt.

**Những từ mô hình chưa từng thấy.** Khi máy chủ forge nêu các khóa trong
`meta.unseen_words`, các phương thức `local` và `api` sẽ đưa ra cảnh báo kèm các khóa —
không bao giờ đưa ra văn bản hoặc các từ: *"<API batch N | Local method>: <n> khóa chứa
các từ mô hình chưa từng thấy trong quá trình huấn luyện — rất có khả năng bị dịch sai, dù đọc lên có vẻ
trôi chảy; hãy nhờ một người nói ngôn ngữ này kiểm tra lại: <up to 20 keys>"* (sau đó là *"và thêm <n> khóa nữa"*).
Các bản dịch vẫn được ghi; cảnh báo là cách để mọi người biết cần
kiểm tra phần nào ([hướng dẫn](/docs/agents/coaching)).

**Lưu ý.** Chuyển tiếp mọi dòng `warn`. Các chuỗi do máy dịch chỉ là bản nháp
cho đến khi một người nói ngôn ngữ đó xem lại; không bao giờ được gọi chúng là bản dịch chính xác.

## `champollion serve`

Một máy chủ khác: máy chủ này phục vụ ngăn xếp dịch thuật được cấu hình riêng của **dự án ứng dụng**
(phương thức, hướng dẫn, bộ nhớ dịch, cổng chất lượng) cho
các dự án khác. Mặc định là `127.0.0.1`, cổng 1822. Máy chủ yêu cầu một bearer token
ngay cả trên loopback (`--token` hoặc `CHAMPOLLION_SERVE_TOKEN`, tối thiểu 12
ký tự) trừ khi có `--no-auth`, cờ này chỉ được chấp nhận khi liên kết với loopback.
`--emit-manifest` ghi một bản kê khai (manifest) method/1 loại `service` cho bên sử dụng.
`/health` của nó là `{ok, service, version}`, không phải tài liệu kiểm tra tình trạng của service-api/1,
vì vậy `champollion connect` sẽ báo cáo các sự cố về tình trạng hoạt động cho máy chủ này.

## Tìm hiểu sâu hơn

- [Đưa vào sử dụng](/docs/put-it-to-work) — phiên bản dành cho cộng đồng.
- [Phương thức và cổng kiểm soát](/docs/agents/methods) — method/1 và gate-chain/1.
- [Quy tắc dữ liệu và truyền tải](/docs/agents/data-rules) — chỉ-cục-bộ và
  `holders_agreed`.
- [Mô hình rails](/docs/agents/rails-model) — một quy trình duy nhất.
- [Tài liệu tham khảo `mt-eval`](/docs/reference/mt-eval) và
  [Tài liệu tham khảo `nmt-forge`](/docs/network/getting-started/forge-command-reference).
- Dịch ứng dụng và trang web: [CI/CD](/docs/guides/ci-cd),
  [xử lý sự cố](/docs/guides/troubleshooting).
