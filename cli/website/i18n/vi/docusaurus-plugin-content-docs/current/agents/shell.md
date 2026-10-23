---
title: "Vận hành quy trình từ shell"
slug: /agents/shell
description: "Mọi bước trong quy trình đều là một lệnh thông thường: cài đặt, khởi tạo dự án, đưa dữ liệu vào, ghi lại thuật ngữ, huấn luyện và kiểm thử mô hình với nmt-forge, chạy các vòng cải tiến, dịch và phục vụ với mt-eval — cùng với chế độ ngoại tuyến, các biến môi trường mà công cụ đọc, và các mã thoát."
---

# Vận hành đường ray từ shell

Mỗi bước trên đường ray là một lệnh thông thường. Một agent không có MCP — hoặc một
người ngồi trước terminal — đều đi trên cùng những đường ray này với ba chương trình:
`champollion`, `nmt-forge` và `mt-eval`. Bạn không bao giờ phải ghi
nhớ thứ tự: `champollion next` sẽ gọi tên bước tiếp theo, kèm chế độ thực thi và
câu lệnh chính xác, được đọc từ các tệp của dự án.

Các quy tắc hoàn toàn giống như qua MCP. Bước `confirm` chỉ chạy sau khi
người dùng đồng ý; câu trả lời cho bước `ask_user` là của chính họ
([giao ước](/docs/agents/contract)).

## Cài đặt

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Lưu ý.** Cả hai đều tải về các gói: chế độ `confirm` — hãy hỏi trước. Nếu lệnh `uv
--version` thất bại, người dùng sẽ tự cài đặt uv từ https://docs.astral.sh/uv/;
agent không được tự tải các bộ cài đặt. Quá trình huấn luyện cũng cần gói bổ trợ
huấn luyện của forge (PyTorch và Hugging Face transformers, nặng vài trăm MB). Forge sẽ
chỉ rõ gói này khi bị thiếu (trạng thái `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

Đường ray yêu cầu `nmt-forge` 0.3.0 hoặc mới hơn; phiên bản cũ hơn sẽ được chỉ ra kèm
câu lệnh nâng cấp (`uv tool install --upgrade --python 3.12 nmt-forge`).

## Vòng lặp

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` trong kết quả hiển thị cho con người là chế độ: `run it` (`auto`), `hỏi trước,
sau đó mới chạy` (`confirm`), `hỏi người nắm giữ dữ liệu — không bao giờ trả lời
thay họ` (`ask_user`), `chờ, sau đó hỏi lại` (`wait`), `con người thực hiện việc này`
(`human_only`). Hãy chạy lệnh được chỉ định, rồi hỏi lại. Rời khỏi đường ray
cũng không sao — bạn có thể chạy bất kỳ lệnh chuyên sâu nào, sau đó `champollion next`: bước
tiếp theo sẽ được đọc từ các tệp.

## Bắt đầu

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Ngôn ngữ được xác định bằng mã hoặc tên, được phân giải qua thẻ ngôn ngữ. Một biến thể
không có mã sẽ dùng mã sử dụng riêng (`qaa`–`qtz`) và tên do cộng đồng đặt
(`--target-name`, `--source-name`). **Lưu ý.** Hãy nhắc lại chiều dịch
trước khi tạo dự án: `--dry` sẽ phân giải cả hai ngôn ngữ và không
ghi dữ liệu gì. Hãy truyền từng ngôn ngữ chính xác như người dùng đã gọi tên.

## Thu thập và ghi nhận điều khoản

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` đọc `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, bảng Word `.docx`,
từ điển Toolbox và LIFT, ELAN `.eaf` và USFM
(`--usfm-source`). Lệnh này ghi `<stem>.tsv` cùng tệp phụ trợ (sidecar) của nó, giữ nguyên bản gốc
không chỉnh sửa, và in ra số lượng, các cột cũng như số dòng mà bước kiểm tra
dòng phát hiện (bản sao, lặp lại, độ dài bất thường, các dòng bị hoán đổi hoặc lệch hàng — không có
gì bị xóa bỏ) — tuyệt đối không in các câu dịch. Khi không thể phân biệt được cột nào (hoặc tầng
ELAN theo số, hay ngôn ngữ LIFT nào), lệnh sẽ từ chối và hỏi lại; hãy hỏi
người dùng. `--replace` đọc lại chính tệp gốc đó với các cột khác, vẫn giữ nguyên
câu trả lời của người nắm giữ dữ liệu; `--name <stem>` thêm một tệp khác dưới một tên khác.
Xem [quy tắc dữ liệu](/docs/agents/data-rules#what-tools-print-and-never-print).

Sau đó là các điều khoản, từng tệp một, từ câu trả lời của người dùng:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

`--local-only` hoặc `--may-leave` là bắt buộc đối với tệp chưa được đặt ở chế độ chỉ cục bộ.
Bước điều khoản trong lộ trình sẽ hỏi về từng tệp trong `data/parallel/`,
`data/lexicon/`, `data/grammar/` và `data/monolingual/` cho đến khi cả
câu trả lời huấn luyện và `--speakers-agreed` của tệp đó được ghi nhận. Mọi giá trị đều do
người nắm giữ dữ liệu quyết định — xem [quy tắc dữ liệu](/docs/agents/data-rules) để biết tác vụ của từng mục
và những gì lệnh sẽ từ chối.

## Bảo vệ tập kiểm thử

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Xây dựng và kiểm thử mô hình

Lộ trình sẽ gọi tên các bước này theo thứ tự (các `{placeholders}` của chúng được
điền từ dự án):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` chọn mô hình mạnh nhất mà máy tính này có thể huấn luyện trong vài giờ, dựa trên bộ nhớ của máy ([huấn luyện](/docs/agents/training#models)). Khi có thẻ ngôn ngữ, `--no-card --name` sẽ được bỏ qua.
- `data combine` chỉ chạy khi `data/parallel/` chứa nhiều hơn một tệp. Nó giữ lại các điều khoản nghiêm ngặt nhất của các tệp mà nó kết hợp và từ chối tệp mà những người nắm giữ chưa phản hồi — liệu mô hình có được phép học từ tệp đó hay không, và liệu tất cả những người có lời nói trong đó đã đồng ý hay chưa.
- `prereg new` là một bước `ask_user`: `--expect` và `--rationale` là lời của cộng đồng, chính xác như họ đã nói, được ghi lại trước khi có bất kỳ điểm số nào. Câu hỏi không gợi ý con số nào, và bạn cũng không gợi ý.
- Kích thước tập dev mà hành trình điền vào (`dev_n`) là một phần mười số cặp đã được sàng lọc, tối thiểu 50 và tối đa 500; nếu có ít hơn 200 cặp, nó sẽ là một phần tư số cặp đó, để quá trình huấn luyện giữ lại phần lớn — và con số đó là dưới 50. Cụ thể: 40 câu dev từ 160 cặp, 50 câu từ 200 đến 500 cặp, 160 từ 1.600, 500 từ 5.000 trở lên. Dưới 50 câu, không vòng nào có thể được đánh giá trên tập dev ([đo lường](/docs/agents/measurement#comparing-two-models)). `--near-dupe 0.6` giữ các bản gần như trùng lặp ở một bên; `--max-group` bằng một nửa kích thước tập dev, làm tròn xuống, cộng thêm một.
- `floor` chỉ áp dụng khi `data/lexicon/` chứa danh sách từ.

Từ đây, chính cố vấn của forge sẽ gọi tên từng bước. `champollion next` chuyển tiếp thông tin đó;
`nmt-forge status` nêu trực tiếp:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

Huấn luyện là `confirm` (tiêu tốn tài nguyên tính toán, từ vài phút đến vài giờ); trong khi một lượt chạy tách biệt đang huấn luyện, bước này là `wait`. `nmt-forge run` từ chối lượt chạy mà ổ đĩa không đủ dung lượng chứa trước khi bắt đầu (`[disk-room]`), cùng với dung lượng trống, ước tính của nó và dung lượng mà `nmt-forge tidy` sẽ giải phóng; `nmt-forge tidy --yes` giải phóng dung lượng đó, và `--skip-disk-check` trên `run` vẫn khởi chạy bất chấp cảnh báo, được ghi nhận trong lượt chạy. Hai việc đó là quyết định của người dùng, không phải của bạn ([huấn luyện](/docs/agents/training#disk-space)). Bản xuất chấm điểm mô hình một lần trên tập kiểm thử, so với dự đoán. Việc chọn giữa nhiều bản xuất là của người dùng (`nmt-forge choose <model folder>`). Sau khi có điểm số tập kiểm thử, cộng đồng đánh giá dự đoán của họ:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` khi dự đoán không đúng; `--prediction` là số thứ tự của dự đoán,
1 cho một `--expect` duy nhất; `--by` ghi tên người đánh giá, đúng như họ xưng danh.) Xem
mục [huấn luyện](/docs/agents/training) để biết mọi câu lệnh và trường hợp từ chối của forge.

## Các vòng cải thiện

Sau khi mô hình được đưa vào phục vụ, các vòng lặp bắt đầu:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: trong khi tập dev (thực hành) có dưới 200 câu, một số
  hàng sẽ không có bản nháp — cứ hai câu thì có một câu khi dưới 50, cứ bốn
  câu thì có một câu từ 50 trở lên — và người bản ngữ sẽ tự viết chúng. `improve marks` ghi chúng vào `data/dev/`
  và `improve prepare` thêm chúng vào tập dev (`nmt-forge grow-dev`),
  không bao giờ đưa vào tập huấn luyện. Lệnh này cũng chạy `nmt-forge draft-newer`. Khi có
  một mô hình khác — mô hình mới nhất được huấn luyện khi chưa được đưa vào sử dụng (không được đưa vào
  sử dụng sau vòng của nó: quá ít để kết luận, không có thay đổi đo lường được, hoặc kém hơn), hoặc,
  sau khi thăng cấp, mô hình mà mô hình đang dùng đã thay thế — mô hình đó sẽ soạn nháp
  ngẫu nhiên một nửa số hàng có bản nháp, không đánh dấu, và bảng đối chiếu nằm cạnh
  trang tính (`sheet-key.json`). Sau đó, `improve marks` tính riêng cho từng mô hình —
  phép so sánh mù, mà sau khi thăng cấp là bước kiểm tra mà báo cáo
  cần trước khi xác nhận mức tăng là tiến triển thực sự
  ([đo lường](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, từ vòng 2: cứ 10 câu mới thì có một hàng
  (làm tròn xuống) là bản nháp mà người bản ngữ đã chấm `Y` hoặc `N` trên một trang tính
  trước đó, quay trở lại không đánh dấu ở một vị trí ngẫu nhiên. Dòng đầu tiên của trang tính cho biết một vài
  hàng được đưa lại có chủ ý, nhưng không bao giờ cho biết là những hàng nào; `sheet-key.json` liệt kê chúng
  (`repeat_rows`). Lệnh in ra số lượng hàng quay lại, *"(không đánh dấu là những hàng nào)"*, và rằng chúng mất *"khoảng 10 giây mỗi hàng, không bao giờ được dùng để huấn luyện
  lại"*.
- `improve marks` chỉ đánh giá một hàng được hiển thị lại dựa trên điểm số
  trước đó của người bản ngữ — không bao giờ tính vào phần của vòng này, các cặp huấn luyện hay
  phép so sánh mù — ghi `repeats` vào `marks.json`, và in ra *"Các hàng
  được hiển thị lại: người bản ngữ đã chấm A trên J giống như trước (P%) — W
  từng sai nay đúng, R từng đúng nay sai. Không tính vào phần của vòng này,
  và không huấn luyện lại lần nữa."*
- `improve marks`, khi mô hình còn lại là mô hình mới hơn và người bản ngữ
  đã đánh giá ít nhất một bản nháp của mỗi mô hình, sẽ ghi lại số lượt đếm với forge (chỉ
  số lượt đếm, không bao giờ ghi câu):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Khi người nói đánh dấu mô hình mới hơn đúng rõ ràng nhiều lần hơn, nó sẽ in *"forge đã ghi nhận: đề xuất đưa mô hình mới hơn vào sử dụng (cộng đồng đồng ý trước)"*; khi forge chưa được cài đặt hoặc từ chối, nó sẽ thông báo rằng các đánh dấu không được ghi lại, và lý do tại sao.
- `improve prepare` kết thúc bằng `nmt-forge round-plan`: vòng tiếp tục từ mô hình đang sử dụng (4 lượt qua tất cả các câu từ trước đến nay) hoặc huấn luyện lại từ đầu, và cho biết lý do ([huấn luyện](/docs/agents/training#the-improve-rounds)).

Forge sau đó sẽ đánh giá mô hình mới so với mô hình đang dùng
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`), và đề xuất đưa vào sử dụng (`confirm`) chỉ khi nó tốt hơn
rõ rệt — hoặc, khi kết quả có quá ít dữ liệu để xác định (dưới 50 câu dev)
hoặc không có thay đổi đo đếm được, sau khi điểm chấm mù của người nói cho thấy rõ
sự ưu tiên dành cho nó. Riêng kết quả đánh giá sẽ không đưa điều gì vào sử dụng: chỉ có sự đồng ý của mọi người (`nmt-forge export` và `nmt-forge choose`
của bước đó) mới làm được điều này. Các cặp mới từ `improve marks` sẽ nhận thuật ngữ riêng trước — hành
trình sẽ hỏi. Cách truyền đạt báo cáo: [huấn luyện](/docs/agents/coaching).

## Dịch và phục vụ với mt-eval

`nmt-forge export` bên trong một dự án sẽ ghi `deploy/<name>.json` (deployment/1).
Cùng một tệp này thực hiện việc đo lường, dịch thuật và phục vụ:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Lưu ý.** `mt-eval run` trên tệp kiểm thử không cần đăng ký trước — lệnh chỉ
  ghi nhật ký việc đọc. Hãy chấm điểm tập kiểm thử qua `nmt-forge export` (hoặc sau khi
  dự đoán đã được viết ra), tuyệt đối không làm trước đó.
- `--gates gates/<chain>.json` thêm một chuỗi cổng kiểm soát vào `run`, `translate` hoặc
  `serve` (không có `--deployment`); `run` và `test` sẽ từ chối chuỗi có cơ chế
  dự phòng. Xem [phương thức và cổng kiểm soát](/docs/agents/methods) và
  [phục vụ](/docs/agents/serving).

## Rời đường ray: những gì hiện có cho một ngôn ngữ

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Kiểm tra và nâng cấp các tệp

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Ngoại tuyến

`CHAMPOLLION_OFFLINE=1` ngăn CLI `champollion` kết nối mạng:
thẻ ngôn ngữ chỉ lấy từ bộ đi kèm và bộ nhớ đệm cục bộ (thẻ cho
ngôn ngữ hiếm không được tải về), lượt làm mới bộ đệm thẻ hàng ngày sẽ bị bỏ qua, và
`register-corpus` không đối chiếu mã băm của tệp với danh mục công khai
(lệnh ghi nhận rằng phép đối chiếu chưa được thực hiện). Tùy chọn này không thay đổi những gì một phương thức
gửi đi: phương thức gọi đến nhà cung cấp vẫn cần mạng, và các
quy tắc truyền dữ liệu vẫn được áp dụng.

`MT_EVAL_NO_REMOTE_REGISTRY=1` ngăn `mt-eval` tải sổ đăng ký bộ dữ liệu
từ web (dành cho máy tính cách ly mạng).

Những việc vẫn cần mạng trên đường ray bất kể trường hợp nào: cài đặt các công cụ,
gói bổ trợ huấn luyện, và lần tải đầu tiên của một mô hình đã huấn luyện trước (`byt5-small` hoặc
`byt5-small-lowmem`, khoảng 1,2 GB; `cpu-tiny` không tải gì cả).

## Biến môi trường

Được mã nguồn đọc, dành cho người vận hành. Khóa API của nhà cung cấp chỉ cần thiết cho
các phương thức gọi đến nhà cung cấp, không bao giờ cần trên đường dẫn mặc định của đường ray.

| Biến | Được đọc bởi | Tác dụng |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP server | `rails` (mặc định) hoặc `full` |
| `CHAMPOLLION_CLI_BIN` | MCP server | Điểm nhập `champollion` cần chạy |
| `NMT_FORGE_BIN` | `champollion`, MCP server | Tệp thực thi `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, MCP server | Nơi tìm kiếm `nmt-forge` và `uv` sau `PATH` (mặc định `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: không dùng mạng cho thẻ ngôn ngữ hoặc tra cứu danh mục |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | Bộ nhớ đệm thẻ theo từng người dùng (mặc định `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Tần suất kiểm tra cập nhật bộ nhớ đệm thẻ (mặc định 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Cố định preset mà `auto` chọn (phải là tên preset) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Cổng mặc định (8378 nếu không chỉ định) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Bearer token; bắt buộc khi không dùng loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: không hiển thị bảng theo dõi huấn luyện trực tiếp |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Bearer token (không bao giờ truyền qua giá trị dòng lệnh) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | Bearer token cho máy chủ riêng của CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: không tải sổ đăng ký |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Nơi phân giải đường dẫn của các bộ dữ liệu đã đăng ký trước tiên |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | Khóa của nhà cung cấp mô hình lưu trữ mặc định |

## Đầu ra cho các chương trình

| Công cụ | Đầu ra máy | Mã thoát |
|---|---|---|
| `champollion` | `--json` trên các lệnh đường ray (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 bị từ chối · 2 cách dùng |
| `nmt-forge` | `--json` trên mọi lệnh con: một tài liệu JSON trên stdout, mọi thứ khác trên stderr | 0 ok · 2 bị từ chối (`{"error": …}`) |
| `mt-eval` | `--json` và `--non-interactive` trên mọi lệnh con | 0 ok · khác 0 bị từ chối |

Dạng thức từ chối: [mô hình đường ray](/docs/agents/rails-model#refusal-shapes).

## Tìm hiểu sâu hơn

- [Tài liệu tham khảo lệnh `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) và
  [`mt-eval`](/docs/reference/mt-eval).
- [Mô hình đường ray](/docs/agents/rails-model) — lộ trình và `next --json`.
- [Vận hành đường ray qua MCP](/docs/agents/mcp) — các bước tương tự dưới dạng sáu công cụ.
- [Huấn luyện với nmt-forge](/docs/agents/training) và
  [quy tắc dữ liệu](/docs/agents/data-rules).
