---
title: "Tổ chức bài kiểm tra niêm phong và tham gia dự án"
slug: /agents/hosting-and-joining
description: "Hai cách tham gia ngoài việc tự xây dựng: tổ chức một bài kiểm tra niêm phong bằng mt-eval contest và mt-eval node (tính năng đã hoạt động, hiện chưa có trên rails, và người giám hộ do ban tổ chức chọn sẽ nắm giữ các phần khóa), và tham gia một dự án đã đăng ký bằng mt-eval project — chi tiết từng lệnh, gửi nội dung gì đến đâu, và những gì sẽ không bao giờ hiển thị."
---

# Tổ chức bài kiểm tra niêm phong và tham gia một dự án

Hai luồng bên cạnh các đường ray dựng (build rails). Cả hai đều là các lệnh `mt-eval` thuần túy; không có lệnh nào là bước mà `champollion next` gọi tên.

## Tổ chức bài kiểm tra niêm phong

**Tình trạng trung thực.**

- Mọi thứ đã hoạt động: việc chuẩn bị tập dữ liệu niêm phong, nghi thức khóa (key ceremony), chạy các bài nộp trên một node cách ly mạng (air-gapped), các phán quyết và xếp hạng đều là những lệnh đã có kiểm thử.
- **Tính năng này vẫn chưa được đưa lên ray (rails).** `champollion new --kind task` bị từ chối;
  hành trình duy nhất là hành trình ngôn ngữ. Hãy chuẩn bị cho một lộ trình thủ công dài hơn, và
  làm theo [sổ tay vận hành cuộc thi](/docs/network/sovereignty/run-a-sovereign-contest).
- **Các phần chia sẻ khóa do những người giám hộ mà ban tổ chức chỉ định nắm giữ.** Không có gì trong
  mã nguồn bổ nhiệm hay thẩm định họ. Chưa có người giám hộ khóa cộng đồng nào được
  chỉ định cho bất kỳ bài kiểm tra nào.
- **Champollion không giữ bất kỳ phần khóa hay khóa riêng tư nào.** Nghi thức chạy trên
  máy của ban tổ chức, và việc đăng ký chỉ gửi các mã định danh, bản tóm lược (digest)
  và ngưỡng vòng loại — không bao giờ gửi khóa, phần chia sẻ khóa hay các câu văn.

**Lưu ý.** Việc tổ chức sẽ quyết định điều gì xảy ra với các câu văn của mọi người và ai có thể
mở khóa chúng. Mỗi bước dưới đây đều là quyết định của ban tổ chức; chỉ chạy từng bước
khi họ yêu cầu.

### Những gì được tạo ra

`mt-eval contest prepare` phân chia ngữ liệu của ban tổ chức:

| Cờ | Tập | Ai xem được |
|---|---|---|
| `--dev-size` (bắt buộc) | Vòng loại: nguồn và tham chiếu | Công khai, phát hành từ `<out>/public/` |
| `--secret-size` | Bài kiểm tra niêm phong mà cuộc thi được đăng ký đối chiếu | Không ai cả: được niêm phong trong `<out>/local/` |
| `--sealed-holdout-size` (cần `--secret-size`) | Phần chia niêm phong thứ hai, được chấm điểm nhưng giữ lại cho đến khi kết thúc | Không ai cả |

`--seed`, `--qualifier-threshold` (lớn hơn 0) và `--license` là bắt buộc — không
mặc định bất kỳ giấy phép nào. `--custodian-group` và `--threshold-pubkey` là bắt buộc
(khóa mà các tập niêm phong được mã hóa bằng). Văn bản gốc (plaintext) của mỗi tập niêm phong
sẽ bị xóa sau khi niêm phong; `<out>/local/manifest.json` giữ công thức và
không bao giờ rời khỏi máy. Việc niêm phong chạy `champollion network seal-corpus seal`, vì vậy
CLI `champollion` phải được cài đặt.

### Giám hộ

**Giám hộ theo ngưỡng (M trên N).** Trên node cách ly mạng:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` tạo khóa, chia nhỏ khóa bằng lược đồ Shamir và xóa về 0 trong một
lệnh gọi duy nhất; lệnh ghi `ceremony.json` (bản ghi công khai) và một tệp phần chia sẻ cho mỗi
người giám hộ. `--set` phải là ID của tập dữ liệu bí mật và `--group` phải là
`--custodian-group` mà lệnh prepare sẽ dùng — prepare không kiểm tra chúng, và sự
không khớp chỉ được phát hiện khi một lượt chạy bị từ chối. Hãy cung cấp cho prepare bản ghi
của nghi thức: `--threshold-pubkey <ceremony>/ceremony.json`.

**Khóa.** Tập dữ liệu niêm phong chỉ được giải mã bằng `mt-eval node run-method <id>
--offline --share … --share …` với ít nhất M phần chia sẻ từ các người
giám hộ khác nhau có ID khớp với tập dữ liệu. Giám hộ theo ngưỡng chỉ chạy trên
luồng ngoại tuyến này.

**Khóa đơn.** `champollion network seal-corpus keygen --out <dir>` tạo một
cặp khóa; bất kỳ ai nắm giữ tệp khóa của nó đều có thể tự giải mã. Đây là những gì luồng
node có kết nối mạng sử dụng.

### Lộ trình của ban tổ chức (giám hộ theo ngưỡng)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` thiết lập việc giám hộ theo ngưỡng khi tập dữ liệu được niêm phong bằng
khóa nghi thức. Thí sinh tham gia đủ điều kiện trên tập dev công khai (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, cả hai đều có đường dẫn `--offline --bundle-out`).
[Hướng dẫn về node](/docs/network/sovereignty/sovereign-eval-node) có đầy đủ
các lệnh của node.

### Những gì cần kết nối mạng, và của ai

| Hoạt động ngoại tuyến | Cần đăng nhập | Cần khóa dịch vụ của cơ sở dữ liệu |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (với `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, mọi `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, `submit-*` trực tuyến, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` không có `--no-register` hoặc `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, `node run-method` trực tuyến, `node relay`, và `contest close` khi kết quả được giữ lại |

Khóa dịch vụ thuộc về bất kỳ ai vận hành cơ sở dữ liệu. Ban tổ chức bên ngoài
sẽ chạy các lệnh này trên cơ sở dữ liệu của riêng họ (`MT_EVAL_SUPABASE_URL` và các
khóa của nó), hoặc gắn bó với luồng ngoại tuyến — nơi điểm số có thể xác minh từ các
bản kê (manifest) đã ký nhưng không được đưa lên bảng xếp hạng công khai. **Lưu ý.** Không bao giờ đặt
`MT_EVAL_ALLOW_PROD`: biến này sẽ dỡ bỏ việc công cụ từ chối ghi vào cơ sở dữ liệu
production mặc định, và đó không phải là quyết định của một agent.

## Tham gia một dự án

Một **dự án đã đăng ký** là một dự án ngôn ngữ mà chủ sở hữu đã niêm yết để người khác
có thể giúp đỡ, bằng các tệp: câu văn, danh sách từ vựng hoặc phương pháp (thời gian đánh giá và
tài nguyên tính toán hiện chưa được cung cấp). Các lệnh `mt-eval
project` dưới đây tương tác với cơ sở dữ liệu của dự án
(`MT_EVAL_SUPABASE_URL`). Mọi lệnh phụ ngoại trừ `list` (ẩn danh) và
`review` (dành cho người vận hành) đều yêu cầu đăng nhập (phiên đã lưu trong cache,
`MT_EVAL_REFRESH_TOKEN`, hoặc đăng nhập tương tác bằng GitHub hoặc Google);
tài khoản chính là email đăng nhập.

**Các quy tắc.**

- **Được đánh giá trước khi niêm yết.** Dự án mới bắt đầu ở trạng thái `pending_review`; nó chỉ
  được niêm yết sau khi được duyệt. Chủ sở hữu có thể đóng dự án, chứ không bao giờ tự ý niêm yết được.
- **Chủ sở hữu được đặt tên theo ý họ chọn** (`--owner-name`). Hàng của dự án
  không lưu email; tài khoản của chủ sở hữu được tách riêng, chỉ họ mới đọc được.
- **Không có email trong danh sách niêm yết.** `project list` là ẩn danh và chỉ hiển thị tên cùng
  số lượng; `project offers` in ra những người trợ giúp theo tên họ đã cung cấp (`--as`).
  Tài khoản chủ sở hữu vẫn có thể đọc email tài khoản của người trợ giúp trong bản ghi của
  lời đề nghị, và ghi chú đồng thuận sẽ ghi lại cả hai tài khoản.
- **Lời đề nghị do cả hai bên nắm giữ.** Việc chấp nhận sẽ ghi lại một ghi chú đồng thuận nêu rõ ai
  đã gửi và ai đã ủy quyền.
- **Không có nội dung nào được in ra từ tệp.** Chỉ có tên, số lượng và trạng thái.

### Chủ sở hữu

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` đọc cặp ngôn ngữ từ `champollion.project.json` (và mục đích,
  trừ khi có `--purpose`); các tùy chọn `--slug`, `--domain`, `--register`, `--about`.
  Tối đa 5 lần đăng ký cho mỗi tài khoản trong 24 giờ.
- `ask` `--kind` là `sentences`, `word-list` hoặc `method`; các yêu cầu chỉ hiển thị khi
  dự án đang được niêm yết.
- `accept` tải tệp về, **xác minh sha256 của tệp** (từ chối nếu
  không khớp), ghi `inbox/offer-<offer id>-<file name>` và
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), sau đó đánh dấu
  lời đề nghị là đã được chấp nhận. Tệp sau đó được tiếp nhận như bất kỳ tệp nào khác —
  `champollion data add inbox/<file>` — và các điều khoản của người nắm giữ tệp sẽ được hỏi.
- **Lưu ý.** `--terms` của người trợ giúp nằm trong ghi chú đồng thuận. Các câu trả lời mà bạn
  ghi lại bằng `champollion data mark` không được nới lỏng các điều khoản đó.

### Người trợ giúp

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` tải một tệp không rỗng có dung lượng tối đa 50 MB lên bộ lưu trữ
  riêng tư của dự án, cùng mã sha256 của nó, và chỉ gửi đến dự án đã được niêm yết. Tối đa 24
  lời đề nghị cho mỗi người trợ giúp trong 24 giờ.
- Một lời đề nghị chỉ chuyển trạng thái một lần: `offered` → `accepted`, `declined` hoặc `withdrawn`.
- **Lưu ý.** Việc rút lại hoặc từ chối sẽ thay đổi trạng thái của lời đề nghị; nó không
  xóa tệp đã tải lên khỏi bộ lưu trữ. Hãy thông báo điều này trước khi người trợ giúp đề nghị
  bất cứ thứ gì mà họ có thể muốn lấy lại.
- **Khóa.** `offer` đọc tệp sidecar đi kèm trước khi tải lên bất kỳ thứ gì. Lệnh
  từ chối tệp `local-only`, tập `sealed`, và tệp có
  `speakers_agreed` là `not-yet` hoặc `some-said-no`; tệp sidecar không đọc được
  sẽ dừng việc gửi đề nghị. Không có cách ghi đè: dấu chỉ định này chỉ có người nắm giữ mới có quyền thay đổi.
  Điều khoản `training: not-allowed` được thêm vào điều khoản của lời đề nghị để chủ sở hữu
  có thể nhìn thấy.
- **Lưu ý.** Lời đề nghị sẽ gửi tệp từ máy tính của người trợ giúp đến bộ lưu trữ
  của cơ sở dữ liệu dự án. Hãy hỏi người trợ giúp, và đừng bao giờ tự ý đề nghị tệp thay cho họ.

`mt-eval project review` dành cho người vận hành cơ sở dữ liệu (lệnh này sử dụng khóa
dịch vụ). Đây không phải là lệnh của agent.

## Tìm hiểu sâu hơn

- [Tổ chức bài kiểm tra niêm phong](/docs/host-a-sealed-test) và
  [Tham gia một dự án](/docs/join-a-project) — các phiên bản dành cho cộng đồng.
- [Vận hành một cuộc thi tự chủ](/docs/network/sovereignty/run-a-sovereign-contest)
  và [node đánh giá tự chủ](/docs/network/sovereignty/sovereign-eval-node).
- [Chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer) và
  [các biểu mẫu điều khoản](/docs/network/sovereignty/terms-templates).
- [Các quy tắc dữ liệu và truyền dẫn](/docs/agents/data-rules) — các tập niêm phong và
  tệp chỉ dùng cục bộ.
- [Tài liệu tham khảo `mt-eval`](/docs/reference/mt-eval).
