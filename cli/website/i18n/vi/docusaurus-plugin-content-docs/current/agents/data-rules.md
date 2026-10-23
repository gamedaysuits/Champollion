---
title: "Quy tắc dữ liệu và truyền tải"
slug: /agents/data-rules
description: "Các quy tắc mà mọi công cụ Champollion áp dụng cho dữ liệu của người dân: từng trường trong sidecar set/1, local-only và giá trị mặc định tạm thời, không cho phép huấn luyện, người nói và người nắm giữ đã đồng ý, những gì mỗi công cụ in ra và không bao giờ in ra, bốn chế độ truyền tải, các bậc đăng ký, cùng đầu ra của mô hình dưới dạng tác phẩm phái sinh."
---

# Quy tắc về dữ liệu và truyền tải

Những người nắm giữ dữ liệu ngôn ngữ có quyền quyết định cách dữ liệu được sử dụng. Các ray ghi lại
quyết định của họ bên cạnh mỗi tệp, và mọi công cụ đều tuân theo những gì đã được ghi — với
quyền sở hữu và kiểm soát của cộng đồng đối với dữ liệu ngôn ngữ là quy tắc thiết kế cốt lõi, không phải
một tùy chọn cài đặt. Trang này là bộ quy tắc chính xác: chức năng của từng trường, những gì các
công cụ từ chối thực hiện, và những phần chỉ có bạn mới có thể nắm giữ.

## Sidecar (set/1)

Bên cạnh bất kỳ tệp dữ liệu nào, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Các khóa không xác định sẽ bị từ chối; ghi chú
được đặt dưới `x-`. Một sidecar được ghi trước set/1 (không có `$schema`) được đọc là set/0
và vẫn hợp lệ (`champollion upgrade` sẽ ghi lại).

| Trường | Giá trị | Tác dụng |
|---|---|---|
| `transmission` | `local-only` (giá trị duy nhất) | Chỉ mô hình trên máy tính này mới có thể nhìn thấy văn bản; mọi công cụ đều từ chối gửi văn bản đi bất cứ đâu (bao gồm cả `mt-eval project offer`) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | Mục đích của tệp. `test` và `sealed` không bao giờ được dùng để huấn luyện |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | Tệp chứa nội dung gì |
| `pair` | `{source, target}` | Hướng của các cột, theo mã của thẻ |
| `fields` | `{source, target}` | Cột hoặc trường JSON nào chứa phía nào |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: không mô hình nào được huấn luyện trên tệp này |
| `terms.owner` | text | Ai nắm giữ tệp, theo lời của người nắm giữ |
| `terms.speakers` | text | Tệp chứa lời của ai, theo lời của người nắm giữ |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Những người có lời nói ở đây có đồng ý hay không |
| `terms.consent_record` | path | Ghi chú đồng thuận, tương đối so với thư mục của tệp |
| `holders_agreed` | `{by, date}` | Ai trong số những người nắm giữ đã đồng ý rằng kết quả chỉ-cục-bộ có thể đặt ở vị trí hiện tại (không nới lỏng điều gì) |
| `derived_from` | path | Tệp được bảo vệ mà tệp này được tạo ra từ đó; các đánh dấu của tệp đó được mang sang đây |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Được ghi bởi `champollion network register-corpus`; một tệp bị thay đổi (sha256 khác) sẽ không còn nhận id của thẻ |
| `written_by` | text | Lệnh đã ghi nội dung đó |

**Khóa.** Một sidecar chỉ làm cho tệp trở nên nghiêm ngặt hơn: nó không bao giờ nới lỏng những gì phong bì ngữ liệu
hoặc mục đăng ký đã nêu.

## Chỉ-cục-bộ, và mặc định tạm thời

`champollion data add` đánh dấu tệp mà nó ghi là chỉ-cục-bộ khi `defaults.transmission` của dự án
là `local-only` (những gì `champollion new` ghi), và
luôn như vậy đối với `--into test`. Đánh dấu đó là sự bảo vệ của công cụ cho đến khi những người nắm giữ
trả lời, được gắn cờ `"x-transmission-default": true`.

- Câu trả lời đầu tiên của người nắm giữ sẽ quyết định. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` biến nó thành của họ (cờ
  sẽ được gỡ bỏ).
- **Lưu ý.** Công cụ không thể biết ai đã chạy lệnh. Chỉ gỡ bỏ dấu tạm thời
  khi có câu trả lời từ chính những người nắm giữ.
- **Khóa.** Dấu chỉ-cục-bộ do người nắm giữ đặt ra không thể bị gỡ bỏ bởi bất kỳ
  lệnh nào: *"tệp này được đánh dấu là chỉ-cục-bộ, và sidecar chỉ có thể ngày càng
  nghiêm ngặt hơn. Liệu tệp có thể rời khỏi máy tính này hay không là quyết định của người nắm giữ — nếu
  họ đồng ý, hãy chỉnh sửa sidecar thủ công."*
- **Khóa.** `data mark` trên một tệp chưa được đánh dấu chỉ-cục-bộ cần có `--local-only` hoặc
  `--may-leave`: *"việc văn bản của tệp này có bao giờ được gửi tới một dịch vụ AI bên ngoài
  hay không là quyết định của người nắm giữ, vì vậy điều này không bao giờ được tự ý suy diễn"*.

Ý nghĩa của chỉ-cục-bộ trong từng công cụ:

| Vị trí | Điều gì xảy ra |
|---|---|
| Bất kỳ đánh giá nào (`mt-eval run`, tính điểm của forge) | Chính sách được chuyển thành `sealed` (bậc `local-only`): chỉ điểm cuối loopback, bộ điều hợp trong tiến trình của chính khung đánh giá (`local-model`), hoặc phương thức bên ngoài chạy với `--attest-local-transport` mới có thể thấy văn bản |
| Đầu ra của thiết bị đầu cuối và `--json` | Các câu của tệp bị giữ lại; thay vào đó, số dòng, id, số lượng và điểm số sẽ được in ra, kèm theo một dòng nêu rõ lý do |
| Các tệp được trích xuất từ tệp đó | Các phần chia tách, bản sao đã làm sạch, giả thuyết và nhật ký chạy vẫn giữ nguyên văn bản (chúng nằm trong thư mục của người dùng) và mang theo đánh dấu đó trong sidecar riêng của chúng |
| Mô hình được huấn luyện trên tệp đó | Đầu ra của mô hình cũng là chỉ-cục-bộ (`forge-model.json` `trained_on.terms`; nếu không được ghi nhận thì tính là chỉ-cục-bộ): `try_translation` chỉ trả về trang của mô hình, `champollion connect`, `mt-eval serve` ngoài loopback và `mt-eval translate` bên ngoài dự án cần có `--holders-agreed-by`, và `sync` giữ lại câu trả lời, áp dụng tương tự cho phương thức `api` và `local` ([phục vụ](/docs/agents/serving)) |
| Tệp hướng dẫn hoặc từ điển | Tệp hướng dẫn kèm sidecar sẽ mang chính sách của nó vào câu lệnh nhắc; kết quả đầu ra của lượt chạy bộ từ vựng sẽ bị giữ lại khi từ điển của nó là chỉ-cục-bộ |

**Lưu ý.** `--attest-local-transport` khai báo điểm cuối của một phương thức là cục bộ. Chỉ truyền
tùy chọn này khi bạn đã xác minh điểm cuối nằm trên chính máy này: một địa chỉ
loopback có thể là một proxy chuyển tiếp đi bất cứ đâu.

## Huấn luyện

- **Khóa.** nmt-forge từ chối huấn luyện trên tệp có sidecar ghi
  `terms.training: not-allowed`; một sidecar không đọc được sẽ được tính là có
  hạn chế, không bao giờ tính là không có hạn chế nào.
- **Khóa.** `champollion data combine` không bao giờ kết hợp tệp không được phép: nó chuyển
  tệp đó, cùng với sidecar của tệp, tới `data/not-for-training/`. Lệnh từ chối tệp mà
  những người nắm giữ chưa trả lời — không có `terms.training`, hoặc không có
  `terms.speakers_agreed` (*"chưa có ai xác nhận liệu tất cả những người có lời nói
  trong tệp đã đồng ý hay chưa — champollion tiếp tục hỏi cộng đồng; kết hợp sau đó"*) —
  và tệp đã kết hợp sẽ mang các điều khoản nghiêm ngặt nhất trong số các tệp (chỉ-cục-bộ nếu
  có một tệp như vậy, không được phép nếu có một tệp như vậy, ghi danh mọi chủ sở hữu).
- **Khóa.** Bước điều khoản của hành trình chỉ tính tệp trong `data/parallel/`,
  `data/lexicon/`, `data/grammar/` hoặc `data/monolingual/` là đã trả lời khi
  sidecar của tệp có cả `terms.training` lẫn `terms.speakers_agreed` (và
  câu trả lời về huấn luyện là từ người nắm giữ, không phải cảnh báo cẩn trọng của công cụ dưới đây); cho đến lúc đó,
  hệ thống sẽ hỏi lại, và các ray sẽ không đi tiếp.
- **Lưu ý.** nmt-forge đọc `terms.training`, không đọc `speakers_agreed`. Với một
  tệp cặp duy nhất thì không có thao tác kết hợp, do đó chỉ có bước điều khoản là chờ
  câu trả lời đó: không bao giờ huấn luyện một tệp thiếu câu trả lời của người nói ngôn ngữ.
- **Khóa.** Tệp `test` hoặc `sealed` không bao giờ được dùng để huấn luyện: `--training
  allowed` sẽ bị từ chối đối với tệp đó, và việc gán cho tệp vai trò khác cũng bị từ chối.
- **Khóa.** `not-allowed` không thể trở thành `allowed` bằng lệnh (*"Nếu những người nắm giữ
  đồng ý huấn luyện, hãy chỉnh sửa sidecar thủ công"*) — với một ngoại lệ duy nhất dưới đây.
- Kinh Thánh (USFM) khi đưa vào sẽ có `terms.training: not-allowed` được đánh dấu dưới dạng
  cảnh báo cẩn trọng của công cụ (`"x-training-default": true`); câu trả lời của người nắm giữ sẽ thay thế
  dấu đó.

## Lời của ai, và ai đã đồng ý

`--speakers` ghi nhận tệp chứa lời của ai; `--speakers-agreed` ghi nhận liệu
họ có đồng ý hay không.

| `speakers_agreed` | Tác dụng |
|---|---|
| `yes` | Huấn luyện theo ý kiến của người nắm giữ |
| `not-yet` | Huấn luyện bị buộc chuyển thành `not-allowed` cho đến khi tất cả họ đồng ý; tệp xuất hiện trong `waiting_for_agreement` |
| `some-said-no` | Không mô hình nào được học từ tệp này, vĩnh viễn: *"hãy tách lời của họ sang tệp khác, và đánh dấu phần còn lại"* |
| (chưa trả lời) | Bước điều khoản tiếp tục hỏi, và `data combine` từ chối tệp (ở trên) |

**Ngoại lệ nới lỏng duy nhất mà một lệnh có thể thực hiện:** `not-yet` → `yes` cùng với
`--training allowed`. Khi đó, tệp mà `combine` từng gác lại sẽ quay trở về
`data/parallel/` cho lần kết hợp tiếp theo.

**Lưu ý.** Hãy hỏi câu hỏi `waiting_for_agreement` một lần trong mỗi phiên, thật nhẹ nhàng, và
chỉ trả lời câu hỏi đó khi người đó xác nhận bằng "có" rằng tất cả mọi người đều đã đồng ý.

**`--holders-agreed-by "<who>"`** nêu tên một người trong số những người nắm giữ dữ liệu
đã đồng ý cho phép kết quả chỉ-cục-bộ được chuyển đến một nơi cụ thể: vào các tệp
ngôn ngữ (locale) của ứng dụng (`champollion connect`, được ghi nhận là `holdersAgreed` của cặp), tới
một địa chỉ mà các máy khác có thể truy cập (`mt-eval serve`, `nmt-forge serve`, được báo cáo
trên `/health`), hoặc vào một tệp bên ngoài dự án (`mt-eval translate`,
được ghi nhận là `holders_agreed` của sidecar). Điều này không nới lỏng bất cứ điều gì khác: kết quả
vẫn là chỉ-cục-bộ đối với mọi công cụ. **Lưu ý.** Chỉ truyền tên mà người đó
đã cung cấp cho bạn.

## Những gì công cụ in ra, và không bao giờ in ra

| Công cụ | In ra | Không bao giờ in ra |
|---|---|---|
| `champollion data add` | Số lượng, các cột (chữ cái, tỷ lệ lấp đầy, độ dài trung bình, tỷ lệ chữ cái Latinh), ô tiêu đề chỉ khi ô đó đặt tên cho một trong các ngôn ngữ của cặp, các tầng ELAN theo số thứ tự, và số dòng mà kiểm tra dòng nêu tên | Một câu; bất kỳ ô tiêu đề nào khác (thay vào đó là độ dài của nó); id của tầng ELAN |
| `champollion data mark`, `combine`, `next`, `validate` | Các trường, số lượng, trạng thái | Văn bản của tệp dữ liệu — các công cụ này không bao giờ mở tệp |
| `champollion improve …` | Số lượng và tỷ lệ phần trăm | Các câu trong bảng tính |
| `champollion sync` (các phương thức `local` và `api`) | Các khóa có văn bản chứa từ mà mô hình forge chưa từng thấy trong quá trình huấn luyện, từ `meta.unseen_words` của máy chủ | Văn bản, hoặc chính các từ đó |
| `nmt-forge`, `mt-eval` | Đối với ngữ liệu chỉ-cục-bộ, được niêm phong hoặc cần đồng thuận: id, số dòng, số lượng, điểm số; `[sentence withheld]` bên trong thông báo lỗi | Các câu của ngữ liệu, dù ở dạng kết quả cho người đọc hay `--json` |
| Các công cụ ray MCP | Những gì CLI in ra, đã được rút gọn | Các câu; đầu ra của mô hình chỉ-cục-bộ |

**Lưu ý.** `--show-text` (nmt-forge; `mt-eval compare`) in ra các câu
đã bị giữ lại. Tùy chọn này dành cho người dùng tại thiết bị đầu cuối của chính họ, không bao giờ dành cho tác nhân —
những gì bạn đọc sẽ được gửi tới nhà cung cấp mô hình của bạn.

**Lưu ý.** Không công cụ nào có thể ngăn bạn mở tệp. Đừng bao giờ mở, in,
tóm tắt hoặc dán các tệp dữ liệu, câu kiểm thử, danh sách từ hoặc
bảng tính của cộng đồng — cũng như tệp `input-words.json` của bản xuất: tệp này liệt kê các từ trong
các câu huấn luyện của họ, và nằm bên cạnh thư mục mô hình, không bao giờ nằm bên trong thư mục đó
([phục vụ](/docs/agents/serving#what-an-export-holds)).

**Kiểm tra dòng.** Khi đưa một tệp vào (các cặp câu, bộ kiểm thử hoặc danh sách từ),
`data add` kiểm tra các dòng của tệp dựa trên chính hai cột của tệp đó — không cần
từ điển, không loại bỏ bất kỳ thứ gì. Công cụ đếm và chỉ ra theo số dòng:

- bản sao chép: bản dịch lặp lại nguyên văn câu nguồn (tên riêng hoặc từ mượn
  thì hợp lệ; ngoài ra thì coi như thiếu bản dịch);
- bản lặp lại của một cặp câu trước đó;
- bản dịch dài hơn hoặc ngắn hơn nhiều so với tỷ lệ thông thường của tệp (bị cắt cụt,
  hoặc hai câu nằm trong cùng một ô);
- các dòng có vẻ bị tráo đổi: câu nguồn đọc như bản dịch của tệp, và
  ngược lại;
- chuỗi dòng có vẻ bị lệch một dòng: bản dịch của chúng khớp với dòng tiếp theo hoặc
  dòng trước đó hơn — các con số, dấu chấm hỏi và độ dài khớp nhau khi dịch đi một dòng,
  và các từ ngữ cũng vậy: mức độ các từ nguồn của một dòng tìm thấy sự trùng khớp
  trong các từ của bản dịch, dựa trên tần suất cả hai cùng xuất hiện trong
  phần còn lại của chính tệp đó (từ hiếm hơn có trọng số lớn hơn; bỏ qua chính dòng đang xét).
  Cách này phát hiện độ lệch trong tệp gồm các câu theo mẫu, vốn có độ dài trông rất
  giống nhau; cách này không đem lại thông tin gì nếu vốn từ trong tệp quá nghèo nàn.

Công cụ in tối đa 12 số dòng cho mỗi loại (tối đa 6 chuỗi cho các dòng bị lệch một dòng) — đối với
bảng tính, đó là dòng trong tệp của chính người dùng, tính cả dòng tiêu đề — và ghi lại
số đếm vào `x-import.quality` của sidecar. Kiểm tra độ dài, tráo đổi và lệch dòng
cần ít nhất 20 cặp; danh sách từ (`--into lexicon`) chỉ được kiểm tra bản sao chép và
lặp lại. **Lưu ý.** Hãy chuyển tiếp các số dòng đó: người trong cộng đồng sẽ tự xem các dòng đó
trong tệp của họ và đưa ra quyết định. Đừng bao giờ tự mở tệp ra xem.

**Tệp ELAN.** Khi `data add` không thể phân biệt tầng nào là tầng nào (một phía không được
đặt tên bằng cờ nào, và không có chính xác một tầng được ghi bằng ngôn ngữ của phía đó), công cụ sẽ từ chối
và liệt kê các tầng theo số, theo thứ tự trong tệp: `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` đối với tầng
tham chiếu đến tầng khác. Hãy truyền các số dưới dạng `--source-col` và `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`);
sidecar sẽ ghi lại các số đó (`x-import.elan_tiers`). Số hoặc id
không chỉ định tầng nào sẽ bị từ chối (`no such tier — … Name a tier by its number`), và
tầng có ngôn ngữ được ghi nhận không phải là ngôn ngữ của phía đó cũng vậy. Hai tầng chỉ được ghép cặp
khi một tầng tham chiếu đến tầng kia hoặc chúng có chung khung thời gian — không bao giờ dựa vào
phỏng đoán. **Lưu ý.** Id của một tầng là bất kỳ nội dung gì mà người tạo tệp đã nhập và
thường là tên của một người, do đó `data add` không bao giờ in nó ra. Người dùng có thể tự nhập
id chính xác; bạn chỉ truyền số thứ tự.
Tệp LIFT được khớp theo mã ngôn ngữ của chúng, tệp Toolbox theo các điểm đánh dấu MDF
(`\ge` và `\xe` là tiếng Anh theo tiêu chuẩn).

## Các chế độ truyền tải

Mọi hoạt động đánh giá đều xác định ngữ liệu theo một chế độ trước khi gửi bất kỳ nội dung nào
(`arena/mt_eval_harness/transmission_policy.py`), và ghi nhận chế độ đó vào nhật ký
chạy:

| Chế độ | Khi nào | Mô hình từ xa |
|---|---|---|
| `cleared` | Giấy phép được phép phân phối lại | Được phép |
| `no-train` | Giấy phép Creative Commons tiêu chuẩn phi thương mại hoặc không phái sinh; hoặc ngữ liệu chưa đăng ký không khai báo giấy phép | Chỉ qua các kênh không huấn luyện trên dữ liệu đầu vào: OpenRouter được ghim với `data_collection: deny`, API nhà cung cấp chính thức, hoặc cục bộ. Cam kết không huấn luyện, không phải cam kết không lưu giữ |
| `consent-required` | Giấy phép bị sửa đổi, tùy chỉnh hoặc không nêu rõ (`LicenseRef-*`) | Bị từ chối cho đến khi mục của tập dữ liệu ghi nhận quyền được cấp `transmission_consent` (`granted_by`, `date`, `scope`, `evidence`); cục bộ vẫn hoạt động |
| `sealed` | Đoạn dữ liệu dành riêng hoặc chuẩn vàng, bộ dữ liệu cách ly, hoặc đánh dấu chỉ-cục-bộ của người quản trị | Bị từ chối, không thể ghi đè |

- **Khóa.** Văn bản của ngữ liệu `consent-required` hoặc `sealed` cũng bị giữ lại, không hiển thị
  trên thiết bị đầu cuối.
- Một phương thức bên ngoài (tiện ích mở rộng) trên ngữ liệu `no-train` sẽ chỉ bị cảnh báo, không
  bị từ chối: khung đánh giá không thể nhìn thấy kênh của tiện ích. Trên các ngữ liệu `consent-required`
  và `sealed`, phương thức này sẽ bị từ chối trừ khi có `--attest-local-transport`.
- **Khóa.** Nhà cung cấp cục bộ chỉ được tính là cục bộ khi điểm cuối của nó là một
  địa chỉ loopback (`localhost`, `127.0.0.1`, `::1`, một socket unix) — không bao giờ
  chỉ dựa vào tên của nó.
- **Lưu ý.** Không bao giờ tự ý ghi nhận việc cấp quyền `transmission_consent`, và không bao giờ diễn giải
  giấy phép thay cho chủ sở hữu quyền. Việc cấp quyền được ghi nhận bởi người quản lý
  tập dữ liệu sau khi chủ sở hữu quyền trao quyền đó.
- **Lưu ý.** `--allow-data-collection` chỉ gỡ bỏ ghim cấm huấn luyện đối với
  ngữ liệu chưa đăng ký và không khai báo giấy phép; cờ này khẳng định người gọi lệnh nắm giữ
  các quyền đó. Chỉ truyền cờ này khi người dùng nói rằng họ nắm giữ quyền.

## Các bậc đăng ký

Đăng ký ngữ liệu là tùy chọn: các ray không bao giờ bắt buộc điều này. Việc đăng ký ghi lại một
thẻ siêu dữ liệu để ngữ liệu có thể được đặt tên, so sánh và liệt kê nếu những người nắm giữ lựa chọn.
`champollion network register-corpus` mang tính tương tác tại thiết bị đầu cuối
và có thể viết tập lệnh với các cờ (`--tier`, `--data`, `--license`, `--name`, …).
**Lưu ý.** Bậc đăng ký, cũng như mọi điều khoản, là quyết định của người nắm giữ.

| Bậc | Thẻ | Văn bản | Những gì bị từ chối |
|---|---|---|---|
| `local-only` (mặc định) | Được ghi bên cạnh tệp `--data` (hoặc `--out`, hoặc tại đây), không bao giờ ghi vào thư mục thẻ dùng chung | Không bao giờ rời khỏi máy tính này; sidecar nhận `transmission: local-only` | — |
| `private` | Siêu dữ liệu kèm `quarantine: true`; từ bản cài đặt qua npm, thẻ vẫn ở cục bộ, và việc liệt kê là một yêu cầu riêng (`champollion network submit --type dataset`) | Không bao giờ được tải lên; không có đánh dấu truyền tải — giấy phép của ngữ liệu sẽ quyết định chế độ | — |
| `public` | Siêu dữ liệu cùng một con trỏ tải về từ nguồn (`--repo-url`, `--builder`) | Không bao giờ được lưu trữ máy chủ: được lấy từ chính nguồn của nó | Giấy phép phi thương mại, không phái sinh, bị hạn chế hoặc chưa được xác nhận (*"Hãy đăng ký riêng tư hoặc chỉ-cục-bộ để thay thế."*); `--data` |
| `sealed` | Siêu dữ liệu kèm `quarantine: true` và một khối được niêm phong (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Chỉ tồn tại bản mã hóa, được ghi vào `<id>.sealed.json` hoặc `--seal-out` | Tệp là một bản sao từng byte của một ngữ liệu công khai; `--data` |

Ở mọi bậc, không có nội dung nào được tải lên khi đăng ký (`--json` ghi nhận
`uploadedContent: false`). Lần gọi mạng duy nhất, từ bản cài đặt qua npm, sẽ so sánh
mã sha256 của tệp với danh mục công khai ngay trên máy tính này (mã băm không bao giờ
rời khỏi máy); với `CHAMPOLLION_OFFLINE=1`, thẻ sẽ ghi nhận rằng việc so sánh chưa
được thực hiện. Với `--data`, sidecar sẽ ghi nhận `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` và `registeredAt`. **Khóa.** Một id đã đăng ký
không bao giờ được tạo lại: việc đăng ký lại tệp dưới một id khác sẽ bị từ chối, và
tệp đã thay đổi (sha256 khác) sẽ không còn nhận id hoặc cấp độ của thẻ.

## Đầu ra là sản phẩm phái sinh

Đầu ra của mô hình từ các câu bị hạn chế là một sản phẩm phái sinh của chúng, và việc
đánh giá sẽ tạo ra các đầu ra như vậy trên quy mô lớn. Các công cụ xử lý đầu ra theo cách chúng
xử lý đầu vào:

- Với mọi ngữ liệu không phải là `cleared`, lượt chạy sẽ ghi nhận và in ra một thông báo:
  các dự đoán của mô hình là sản phẩm phái sinh bằng máy từ các câu bị hạn chế, không được phép
  phân phối.
- Khi văn bản bị giữ lại (chỉ-cục-bộ, được niêm phong, cần sự đồng thuận), mọi
  tệp được tạo ra từ văn bản đó — nhật ký chạy, báo cáo, so sánh, mục bộ nhớ đệm,
  đầu ra `mt-eval translate`, các phía chia tách của forge, ngữ liệu đã làm sạch và
  giả thuyết — đều nhận một sidecar set/1 mang dấu bảo vệ (`derived_from`,
  `written_by`). Ngữ liệu `no-train` nhận thông báo nhưng không có sidecar.
- Mô hình được huấn luyện trên văn bản chỉ-cục-bộ sẽ tạo ra đầu ra chỉ-cục-bộ (ở trên).
- `mt-eval publish` không bao giờ tải lên các câu của ngữ liệu chỉ-cục-bộ, ngay cả khi có
  `--publish-entries`, và theo mặc định chỉ xuất bản câu lệnh nhắc kèm hướng dẫn dưới dạng mã băm
  đối với ngữ liệu như vậy. Đối với các ngữ liệu khác, câu lệnh nhắc sẽ được xuất bản trừ khi
  có `--redact-coaching`.

**Lưu ý.** Xuất bản là quyết định của cộng đồng, được đưa ra bằng chính lời nói của họ, sau khi
bản xem trước (`--dry-run`) đã được hiển thị cho họ xem trước. Đừng bao giờ thay mặt họ xuất bản, dán hoặc gửi
kết quả đầu ra của một lượt chạy.

## Tìm hiểu sâu hơn

- [Hợp đồng vận hành](/docs/agents/contract) §1 và §3.
- [Lời của bạn, quy tắc của bạn](/docs/your-words-your-rules) — phiên bản dành cho cộng đồng.
- [Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora) — các
  bậc, kèm theo từng cờ.
- [Phục vụ và triển khai](/docs/agents/serving) — đầu ra chỉ-cục-bộ trong
  thực tế.
- [Chủ quyền dữ liệu, bằng lời lẽ giản dị](/docs/learn/data-sovereignty).
