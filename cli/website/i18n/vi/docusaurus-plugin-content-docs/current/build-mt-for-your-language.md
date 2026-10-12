---
slug: /build-mt-for-your-language
title: "Xây dựng hệ thống dịch máy cho ngôn ngữ của bạn"
description: "Từ “làm thế nào để bắt đầu?” cho đến một quy trình dịch thuật đã được kiểm thử: tìm kiếm những gì hiện có, bảo vệ tập kiểm thử của bạn, đo lường các lựa chọn, xây dựng giải pháp tốt hơn, chứng minh hiệu quả và triển khai — cùng các câu lệnh và lệnh gọi công cụ MCP chính xác cho từng bước."
---

# Xây dựng dịch máy cho ngôn ngữ của bạn

Trang này sẽ hướng dẫn bạn từ câu hỏi *"chúng tôi muốn có bản dịch cho ngôn ngữ của mình — bắt đầu như thế nào?"* đến một quy trình dịch thuật mà bạn đã **đo lường trên chính các câu dữ liệu của mình** và đưa vào hoạt động thực tế. Tài liệu được viết cho cả con người lẫn các AI agent: mỗi bước đều cung cấp lệnh cần chạy và, nếu có sẵn, [công cụ MCP](/docs/network/getting-started/mcp-server) tương ứng để agent gọi thay thế.

Hai ví dụ xuyên suốt:

- **Một trường học** muốn dịch Anh → Plains Cree cho bản tin và một ứng dụng nhỏ. Các giáo viên đã kiểm tra vài trăm câu và muốn giữ chúng ở chế độ riêng tư.
- **Một bệnh viện** muốn dịch Anh → một ngôn ngữ mà chỉ mục hầu như chưa hỗ trợ, dùng cho một cuốn sổ tay thuật ngữ đầu giường bệnh. Các câu kiểm thử của họ chứa thuật ngữ lâm sàng và tuyệt đối không bao giờ được gửi đến dịch vụ AI bên ngoài.

Kết quả bạn sẽ nhận được: một tập kiểm thử riêng tư, điểm số đánh giá cho nhiều phương pháp khác nhau trên tập kiểm thử đó, một phương pháp tốt hơn (mô hình được kèm cặp qua prompt hoặc mô hình do chính bạn huấn luyện), và phương pháp đó được triển khai thông qua CLI — với mọi con số đều có thể truy nguyên về nguồn gốc tạo ra nó.

:::info[Những điều tài liệu này không làm]
Không có nội dung nào ở đây đảm bảo bản dịch sẽ hoàn toàn chính xác. Điểm số chỉ cho bạn biết tùy chọn nào *ít sai hơn trên các câu dữ liệu của bạn*; một người bản ngữ thông thạo vẫn là người quyết định nội dung có phù hợp để sử dụng hay không. Hãy đọc kỹ phần [Các giới hạn trung thực](/docs/network/honest-limitations) trước khi bạn dựa vào bất kỳ con số nào.
:::

:::warning[Dành cho Agent: trước khi bạn mở bất kỳ tệp nào của người dùng]
Nếu một tập kiểm thử có khả năng là riêng tư (được giáo viên kiểm tra, y tá kiểm tra, hoặc bất cứ thứ gì mà cộng đồng chưa công khai), đừng đọc nó — không dùng `cat`, `head` hoặc xem trước, thậm chí không xem định dạng của nó. Những gì bạn đọc sẽ được gửi đến nhà cung cấp mô hình của bạn. Hãy hỏi người dùng và đánh dấu tệp đó ở chế độ chỉ cục bộ (local-only) trước ([bước 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Cài đặt

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Đối với agent, hãy thêm MCP server vào cấu hình của nó:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Tìm hiểu những gì đã có sẵn

Những thông tin đã biết về ngôn ngữ đó — từ điển, ngữ pháp, ngữ liệu (corpora), bộ phân tích từ vựng (FST), mô hình, kết quả đã công bố, dịch vụ — và nguồn gốc của từng dữ kiện.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent:** `search_languages { "query": "Atya" }` tìm mã ngôn ngữ ngay cả khi viết sai chính tả (các tên gần nhất theo khoảng cách chỉnh sửa edit distance). Mỗi kết quả chỉ hiển thị nơi ngôn ngữ được sử dụng khi thẻ ngôn ngữ của nó trích dẫn nguồn cho thông tin đó, và hiển thị rõ nguồn đó để người dùng có thể chọn giữa các ngôn ngữ có tên tương tự nhau. Vị trí không có nguồn sẽ không bao giờ được hiển thị: dòng thông tin sẽ nêu rõ điều đó và dẫn liên kết đến bản ghi Glottolog của ngôn ngữ thay thế, nơi các ứng viên có thể được so sánh trực tiếp tại nguồn. Khi cài đặt từ npm, một ngôn ngữ nằm ngoài bộ lõi đi kèm sẽ được điền từ các bảng thẻ đã công bố của champollion.dev, hiện chưa kèm nguồn cho từng trường dữ liệu (chúng sẽ có trong lần tải bảng tiếp theo), vì vậy dòng thông tin của nó sẽ có liên kết Glottolog thay vì vị trí địa lý. Khi không có thông tin hiển thị nào giúp phân biệt các ứng viên, người bản ngữ sẽ quyết định (bên dưới). Sau đó, `language_overview { "code": "<code>" }` cung cấp một trang tổng hợp: những gì đã có, các benchmark và kết quả hiện có, cùng các bước tiếp theo được đánh số. Bất kỳ công cụ nào nhận một ngôn ngữ cũng chấp nhận tham số dưới dạng `language`.

Hãy đọc thẻ ngôn ngữ theo đúng nguyên tắc: **sự vắng mặt đồng nghĩa với chưa biết, không phải bằng không.** Thẻ không liệt kê từ điển nào có nghĩa là chỉ mục chưa ghi nhận từ điển nào — chứ không phải không có từ điển nào tồn tại. Ở những nơi các nguồn không thống nhất (số lượng người nói thường hay bất đồng), thẻ sẽ hiển thị tất cả các nguồn đó.

Nếu ngôn ngữ của bạn hoàn toàn chưa có thẻ nào, bạn vẫn có thể thực hiện mọi thứ bên dưới; các công cụ chỉ đơn giản là biết ít thông tin hơn về nó (`nmt-forge init <code> --no-card --name <name>` dù sao cũng khởi tạo một dự án huấn luyện).

### Khi biến thể ngôn ngữ chưa được xác nhận

Một tên gọi có thể tương ứng với nhiều ngôn ngữ. Ví dụ, "Ayta" khớp với sáu ngôn ngữ Ayta ở Philippines, mỗi ngôn ngữ có một mã riêng. **Hãy hỏi người bản ngữ trước.** Cộng đồng biết rõ họ nói biến thể nào, và việc tự ý chọn mã thay họ là một khẳng định mang tính áp đặt lên họ.

Nếu bạn bắt buộc phải bắt đầu trước khi họ có thể trả lời, hãy sử dụng mã dùng riêng (private-use): ISO 639 dành riêng dải từ `qaa` đến `qtz` cho chính mục đích này. Đặt cho nó một tên hiển thị để các prompt và báo cáo có thể gọi đúng tên ngôn ngữ:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

lệnh này sẽ ghi vào `champollion.config.json`:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` sẽ thông báo rằng mã này là mã dùng riêng và không có thẻ ngôn ngữ (công cụ sẽ không yêu cầu bạn kiểm tra lại chính tả).

`init`, `sync`, `verify` và `network register-corpus` đều chấp nhận mã dùng riêng. Những hạn chế bạn phải chấp nhận cho đến khi mã thực tế được thay thế vào:

- **Không có dữ kiện từ thẻ ngôn ngữ.** Không có thiết lập sẵn về văn phong (register), quy tắc số nhiều hay hệ chữ viết từ thẻ ngôn ngữ. Lệnh sync sẽ sử dụng các cài đặt chung, vì vậy hãy kiểm tra các kết quả đầu tiên với người bản ngữ.
- **Không có FST.** Không có bộ phân tích hình thái học nào được liên kết với mã dùng riêng, do đó không có gì được kiểm tra theo từng từ.
- **Không có kết quả đo lường trước đó.** Các benchmark đã công bố và hàng đợi được lập chỉ mục theo mã thực tế, vì vậy `recommend` và `corpora` sẽ không có dữ liệu để hiển thị.

Khi cộng đồng xác nhận biến thể chính xác, hãy chuyển sang mã của biến thể đó:

1. Trong `champollion.config.json`, thay thế `qaa` bằng mã thực (và bỏ `name` nếu tên trên thẻ đã khớp).
2. Đổi tên các tệp locale (`messages/qaa.json` → `messages/ayt.json`). Các bản dịch vẫn hợp lệ: lệnh `champollion sync` tiếp theo sẽ giữ nguyên chúng và chỉ dịch những nội dung mới.
3. Đăng ký lại tập kiểm thử dưới cặp ngôn ngữ thực:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   Lệnh này sẽ in ra `--id` cần truyền vào, vì một tệp đã đăng ký sẽ giữ nguyên id của nó trừ khi bạn chọn một id mới. (`--pair` chấp nhận `eng-ayt` hoặc `"eng>ayt"` ở đây và trong `nmt-forge init`; hãy đặt dạng `>` trong dấu ngoặc kép, vì shell sẽ hiểu ký tự `>` đứng riêng là lệnh "ghi vào tệp".)

## 2. Thu thập dữ liệu — và bảo vệ tập kiểm thử của bạn

**Tách riêng tập kiểm thử trước tiên.** Hãy để riêng các câu mà bạn sẽ dùng để đánh giá mọi thứ (các câu đã được giáo viên kiểm tra, y tá kiểm tra) trước khi bạn huấn luyện hoặc tinh chỉnh bất cứ thứ gì, và tuyệt đối không bao giờ huấn luyện trên các câu này.

Một tập kiểm thử là một tệp TSV: mỗi dòng chứa một cặp câu gồm câu nguồn, một ký tự TAB, rồi đến bản dịch tham chiếu. Các dòng bắt đầu bằng `# ` là dòng chú thích.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Sau đó, hãy quyết định phạm vi dữ liệu được phép truyền đi:

| Bạn muốn… | Hãy làm điều này |
|---|---|
| Không có gì rời khỏi máy này — không dịch vụ AI bên ngoài nào được phép thấy các câu này | Đặt một tệp đánh dấu bên cạnh nó (bên dưới). Chỉ có mô hình trên chính máy của bạn mới có thể được kiểm thử với nó. |
| Người khác có thể thấy tập kiểm thử tồn tại, nhưng không bao giờ thấy nội dung của nó | `champollion network register-corpus --tier private --role test …` chỉ đăng ký metadata |
| Một cuộc thi đánh giá trên tập này, chạy trên máy do bạn kiểm soát, có thể cách ly hoàn toàn với mạng (air-gapped) | `--tier sealed` kết hợp với [sovereign node](/docs/network/sovereignty/sovereign-eval-node) |
| Tập dữ liệu là công khai và được cấp phép mở | `--tier public` trỏ đến nơi lưu trữ của nó; chúng tôi vẫn không bao giờ lưu trữ tập tin đó |

Tệp đánh dấu cho "không bao giờ rời khỏi máy này":

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Khi có tệp này, `mt-eval run` sẽ từ chối mọi nhà cung cấp từ xa đối với tệp đó và chỉ chạy đánh giá với mô hình trên loopback cục bộ. Chi tiết:
[Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora).

**Chọn id giấy phép nào.** Việc đăng ký yêu cầu `--license`: các điều khoản mà chủ sở hữu dữ liệu thực sự cấp quyền, không bao giờ dùng giá trị giữ chỗ tạm thời. Hãy hỏi họ, sau đó chọn id thể hiện đúng điều đó: id SPDX nếu họ đã xuất bản văn bản theo một giấy phép chuẩn; `community-eval-grant-nc` cho nghĩa "chỉ để chấm điểm hệ thống, không bao giờ dùng huấn luyện, không bao giờ chia sẻ, không chấm điểm trả phí"; `community-eval-grant` cho điều khoản tương tự nhưng cho phép chấm điểm trả phí; `proprietary` cho giữ toàn bộ bản quyền (all rights reserved); hoặc `LicenseRef-<name>` cho các điều khoản riêng của họ. Bốn lựa chọn cuối là các id thuộc `LicenseRef-…`, tức các quyền cấp riêng biệt: việc đánh giá từ xa trên các tập này sẽ bị từ chối cho đến khi người quản trị dữ liệu (steward) ghi nhận quyền cho phép. Cho đến khi người quản trị xác nhận, hãy ghi nhận lựa chọn của bạn ở trạng thái tạm thời (provisional). Chế độ chỉ cục bộ (local-only) luôn giữ dữ liệu ở máy cục bộ bất kể giấy phép là gì: chính tệp đánh dấu, chứ không phải giấy phép, quyết định các câu dữ liệu được phép đi đâu.
[Chọn id giấy phép nào cho tập kiểm thử riêng tư](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Dành cho Agent: không đọc tệp kiểm thử chỉ cục bộ (local-only).** Không dùng `cat`, `head` hoặc mở tệp ra xem. Những gì bạn đọc sẽ gửi đến nhà cung cấp mô hình của bạn, nơi mà tệp đánh dấu đã nghiêm cấm các câu này được gửi đến. Bạn cũng không cần phải đọc: các công cụ sẽ loại bỏ các câu văn này khỏi nội dung in ra (`mt-eval compare` hiển thị id mục và điểm số thay vào đó), và `--show-text` chỉ dành cho người dùng trực tiếp tại terminal.

**Agent:** `language_overview { "code": "<code>" }` liệt kê các tùy chọn bảo vệ cho ngôn ngữ; `run_benchmark` tôn trọng tệp đánh dấu và trả về thông báo từ chối (kèm lý do) thay vì gửi các câu được bảo vệ ra ngoài.

### Nếu bạn có thể sẽ huấn luyện mô hình sau này: đăng ký, rà soát, dự đoán — trước khi chấm bất kỳ điểm nào

Hãy thực hiện ba việc này ngay bây giờ, theo đúng thứ tự này, trước khi bước 3 thực hiện bất kỳ phép đo nào trên tập kiểm thử. Forge đếm mọi lần truy cập vào tập kiểm thử, và một benchmark (bước 3) là một lần đọc để chấm điểm: việc đăng ký trước (preregistration) được ghi sau khi đã có một lần đọc sẽ bị từ chối. Thứ tự thực hiện rất quan trọng; làm sau sẽ không còn giá trị như nhau.

1. **Đăng ký tập kiểm thử với NMT Forge.** Nhật ký đọc bắt đầu từ đây, để mọi lần đọc sau đó đều được tính (lần đọc chấm điểm trước khi đăng ký sẽ được liệt kê, nhưng không được tính vào số đếm).
2. **Rà soát ngữ liệu huấn luyện của bạn đối chiếu với tập kiểm thử** (`leak-audit`). Lệnh này đọc tập kiểm thử phục vụ việc kiểm toán, không dùng để chấm điểm, do đó không tính vào số lần đọc theo dự đoán của bạn. Hãy đọc kết luận của nó: nếu hầu hết các dòng kiểm thử đều có một câu gần như giống hệt (near-twin) trong ngữ liệu, mô hình được huấn luyện trên toàn bộ dữ liệu đó sẽ chỉ phản ánh khả năng nhớ lại các cụm từ huấn luyện chứ không phải khả năng dịch thuật. Khi đó, bạn thường sẽ huấn luyện hai mô hình: một mô hình trên toàn bộ dữ liệu, và một mô hình không có câu trùng lặp (twin-free) (`--drop-test-twins` ghi ngữ liệu và cấu hình tương ứng, `config-notwins.json`).
3. **Ghi lại kỳ vọng của bạn, mỗi bản đăng ký trước cho một mô hình bạn dự định huấn luyện**, đặt tên theo tên mô hình. Các dự đoán này chính là cơ sở để đánh giá điểm số kiểm thử sau này: lệnh export sẽ đánh giá từng mô hình so với bản dự đoán bạn chỉ định bằng `--prereg <id>` (nếu có hai mô hình trên cùng một tập kiểm thử, nó sẽ từ chối tự đoán định). Bạn cũng có thể ghim dự đoán vào cấu hình của mô hình đó bằng `--config-hash <hash>`, chuỗi băm đầy đủ mà `nmt-forge preflight run --config config-notwins.json` in ra. Bất kỳ chỉnh sửa nào sau đó đối với cấu hình (chẳng hạn như ngân sách thời gian) sẽ làm thay đổi chuỗi băm và làm mất liên kết ghim, vì vậy việc đặt tên cho bản đăng ký trước khi export là cách đơn giản hơn.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

Nếu kết luận rà soát là SEVERE, hãy thêm mô hình không trùng lặp (twin-free) và các dự đoán riêng của nó (trong `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

Ngữ liệu không trùng lặp sẽ được lưu vào một tệp riêng. `corpus.clean.jsonl` vẫn giữ nguyên là ngữ liệu chứa toàn bộ dữ liệu: leak-audit từ chối ghi đè lên tệp mà một cấu hình, một lần chạy hoặc một lần phân chia dữ liệu (split) đang đọc, hoặc tệp mà một lần kiểm toán khác đã ghi (`--overwrite` dùng để chủ động thay thế một tệp). Kết quả trả về của `--json` liệt kê vài số dòng đầu tiên của từng danh sách; tệp `.audit.json` bên cạnh ngữ liệu đã làm sạch sẽ lưu giữ toàn bộ danh sách đó.

`--allow-after-reads` chỉ tồn tại cho các dự đoán thực sự được ghi lại từ trước các lần đọc (ví dụ: ghi trên giấy). Thông tin này được ghi nhận, và mỗi báo cáo, export and DEPLOY.md then says the predictions came after the scores.

**Agent:** `forge_init { "code": "<code>", "dir": "<dir>" }`, sau đó
`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`,
`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`
(các đường dẫn được đọc từ `project_dir`, vì các lệnh trên được chạy từ bên trong dự án; đường dẫn tuyệt đối hoạt động ở bất kỳ đâu),
sau đó `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`
cùng với người dùng, một bản cho mỗi mô hình, mỗi bản được đặt tên theo mô hình của nó (sau đó `forge_export` nhận id đó làm `prereg`; `config_hash` trên `forge_prereg` sẽ ghim bản đăng ký vào cấu hình tương ứng). `forge_status` sẽ nêu tên bước này ngay khi tập kiểm thử được đăng ký. Bước 4 sẽ huấn luyện trong cùng một dự án.
`language_overview` cũng liệt kê các bước này theo đúng thứ tự.

## 3. Đo lường các tùy chọn

Chạy từng ứng viên đối chiếu với tập kiểm thử của **chính bạn** (đã được đăng ký, rà soát rò rỉ và đăng ký trước với forge nếu bạn có ý định huấn luyện sau này — [bước 2](#2-gather-your-data--and-protect-your-test-set)). Khung đánh giá (harness) chấm điểm mọi ứng viên theo cùng một cách chuẩn mực mà ngành MT báo cáo: chỉ số chính là corpus chrF++ kèm khoảng tin cậy 95%, bên cạnh là BLEU, spBLEU và TER (không bao giờ gộp chung thành một con số duy nhất). Khớp chính xác (exact match) và các kiểm tra hành vi (đầu ra sai hệ chữ viết, tín hiệu ảo giác hallucination) được báo cáo dưới dạng chẩn đoán, kèm theo chi phí và tốc độ. Ở những ngôn ngữ mà khung đánh giá có bộ phân tích hình thái học được ghim cố định, nó sẽ bổ sung độ chấp nhận FST và độ chính xác hình thái học dưới dạng chẩn đoán;
`mt-eval setup --status` liệt kê các ngôn ngữ đó, và `mt-eval setup --comet` bổ sung COMET ở những trường hợp áp dụng được.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` cho biết mức chênh lệch là thực tế hay chỉ nằm trong phạm vi nhiễu ngẫu nhiên (hoán vị xấp xỉ theo cặp - paired approximate randomization). Sự chênh lệch nằm trong các khoảng tin cậy không cấu thành một sự xếp hạng. Lệnh này ghi tệp `comparison-<hash>.json`, đặt tên theo các lần chạy được so sánh, nằm cạnh các báo cáo khi chúng dùng chung thư mục, hoặc vào thư mục `comparisons/` bên trên khi chúng khác thư mục, không bao giờ ghi đè vào thư mục riêng của một lần chạy. Một phép so sánh khác sẽ không bao giờ ghi đè lên tệp này.

**Gói đánh giá (Evaluation packs).** Một số ngôn ngữ khai báo các công cụ bổ sung mà chỉ số của chúng yêu cầu (đối với Plains Cree là một bộ phân tích hình thái học). Lệnh `mt-eval run` đầu tiên sẽ nêu tên những công cụ còn thiếu. Việc thiếu bộ phân tích không bao giờ làm dừng lần chạy: độ chấp nhận FST sẽ được đánh dấu là chưa tính toán (not computed), `mt-eval setup --lang crk` sẽ cài đặt nó (một lần cho mỗi máy), và sau đó `mt-eval test <run log>` sẽ bổ sung điểm số mà không cần dịch lại từ đầu.

**Agent:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` trả về điểm số. Lệnh không công bố bất cứ điều gì trừ khi bạn truyền `publish: true`. Mã ngôn ngữ dạng `target_language` sẽ được lấy tên từ thẻ ngôn ngữ ("Plains Cree") trước khi đưa vào prompt, và kế hoạch chạy sẽ hiển thị prompt mà mô hình sẽ nhận được. Tệp kèm cặp (coaching file) sẽ thay thế prompt đó và kế hoạch sẽ nêu rõ điều này. Khi thẻ ngôn ngữ liệt kê hai hệ chữ viết và bạn không truyền `script`, kế hoạch sẽ đọc hệ chữ viết mà các bản dịch tham chiếu đang sử dụng (đếm số ký tự trên máy của bạn, không hiển thị câu nào ra ngoài) và yêu cầu hệ chữ viết đó. Các báo cáo sẽ được lưu bên cạnh tệp kiểm thử, trong `data/results/mcp-run-<id>/`, cùng với bộ nhớ đệm dịch thuật của harness trong `data/results/cache/`. `get_run_status` in ra lệnh `mt-eval compare` tương ứng, và đối với các lần chạy trên một id ngữ liệu đã đăng ký, nó sẽ liệt kê các báo cáo theo đường dẫn. Một kế hoạch `local-model` sẽ thông báo trước dung lượng tải về cần thiết khi xác nhận và vị trí lưu trữ.

**Nên tin tưởng chỉ số nào** tùy thuộc vào ngôn ngữ:
`get_metric_reliability { "language": "<code>" }` (MCP) báo cáo xem đã từng có chỉ số tự động nào được thẩm định đối chiếu với đánh giá của con người cho ngôn ngữ đó hay chưa. Đối với hầu hết các ngôn ngữ tài nguyên thấp thì chưa có, vì vậy chrF++ là quy chuẩn thông thường — hãy hiểu nó như một phép so sánh tương đối giữa các phương pháp trên cùng một tập kiểm thử, chứ không phải là điểm số đánh giá tuyệt đối.

## 4. Xây dựng giải pháp tốt hơn

Có hai hướng đi. Đo lường cả hai theo cùng một cách như ở bước 3.

**Kèm cặp mô hình tổng quát (Coached model).** Cung cấp cho mô hình một bảng thuật ngữ và hướng dẫn ngữ cảnh, sau đó chạy lại bước 3 với cấu hình kèm cặp đó:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` chấp nhận định dạng Markdown, văn bản thuần hoặc JSON; toàn bộ nội dung của tệp chính là chỉ dẫn dành cho mô hình, được gửi nguyên văn như khi viết.

Để chấm điểm thuật ngữ (liệu từng thuật ngữ được liệt kê có được dịch chính xác theo yêu cầu hay không?), hãy cung cấp cho mọi lần chạy cần so sánh cùng một danh sách thuật ngữ bằng `--glossary terms.json` (`{"blood pressure": "…"}`, hoặc một danh sách các dạng từ được chấp nhận cho mỗi thuật ngữ). Bảng thuật ngữ chỉ được dùng cho mục đích chấm điểm; nó không bao giờ được gửi đến mô hình, do đó lần chạy thông thường và lần chạy kèm cặp đều được chấm điểm trên cùng các thuật ngữ như nhau. Nếu không có `--glossary`, trường `dictionary` của tệp JSON kèm cặp (cấu trúc [coached prompting](/docs/network/tutorials/coached-llm-prompting): `grammar_rules`, `dictionary`, `style_notes`) sẽ được sử dụng thay thế. Trong trường hợp đó, lần chạy sẽ được chấm điểm đối chiếu với chính hướng dẫn kèm cặp của nó, và đầu ra sẽ nêu rõ điều này. Tệp kèm cặp dạng Markdown cũng thực hiện việc kèm cặp tương tự nhưng không cung cấp bảng thuật ngữ có cấu trúc.

Xem thêm về [kèm cặp qua prompt (coached prompting)](/docs/network/tutorials/coached-llm-prompting) và
[prompt tăng cường từ điển (dictionary-augmented prompting)](/docs/network/tutorials/dictionary-augmented-llm).

**Tự huấn luyện mô hình của riêng bạn** với NMT Forge, công cụ từ chối các lỗi thường khiến kết quả trên tập dữ liệu nhỏ trông có vẻ tốt hơn thực tế (rò rỉ câu kiểm thử, phân chia dữ liệu sai, chọn checkpoint trên tập kiểm thử, nhầm lẫn nhiễu dữ liệu thành sự tiến bộ):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` thực hiện các bước kiểm tra mà `run` thực hiện trước khi huấn luyện — tập dev, việc kiểm toán rò rỉ của từng tệp huấn luyện, độ dài giải mã (decode length) — để một lần chạy vượt qua bước này sẽ không bị từ chối ngay khi bắt đầu. `config.json` đọc cấu hình phân chia từ `data/split/`; một phép phân chia được ghi ở nơi khác sẽ chỉ rõ những dòng nào cần thay đổi.

Các cặp câu huấn luyện được đặt trong một tệp TSV tương tự như tập kiểm thử (hoặc JSONL với `source` và `target`); `leak-audit` (bước 2) đã loại bỏ bất kỳ câu nào có thể gây rò rỉ tập kiểm thử vào tập huấn luyện và giải thích rõ từng trường hợp. Bạn muốn huấn luyện hai mô hình? Sau khi phân chia dữ liệu, hãy chạy lại lệnh leak-audit không trùng lặp (twin-free) từ bước 2 (khi tập dev đã được đăng ký, các dòng của nó cũng sẽ được loại bỏ khỏi tệp không trùng lặp), sau đó chạy `nmt-forge run config-notwins.json` và
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
lệnh tiếp theo tại bất kỳ thời điểm nào. Mô hình mặc định huấn luyện trên CPU chỉ trong vài phút; với khoảng 1–2 nghìn cặp câu, bạn có thể kỳ vọng chrF++ rơi vào khoảng 5–30 — mô hình học các cụm từ và mẫu câu trong dữ liệu của bạn, chứ không phải ngôn ngữ nói chung. `export` chấm điểm tập kiểm thử một lần và ghi báo cáo mt-eval, nhờ đó mô hình được huấn luyện có thể so sánh trực tiếp với mọi phương pháp từ bước 3. Hướng dẫn từng bước đầy đủ: [Huấn luyện mô hình đầu tiên của bạn](/docs/network/getting-started/train-your-first-model).

**Agent:** chạy `forge_status { "project_dir": "<dir>" }` đầu tiên và sau mỗi bước; sau các lệnh `forge_init`, `forge_register_eval`, `forge_leak_audit` và `forge_prereg` của bước 2: gọi `forge_split { corpus, test, seed, out }`,
`forge_preflight { "target": "run" }`, sau đó — sau khi chạy `nmt-forge run` trong terminal — gọi `forge_export { run_manifest, out, prereg }`. Hãy gọi `get_training_guardrails` một lần trước `forge_split`: công cụ này liệt kê từng quy tắc mà forge thực thi và lỗi mà quy tắc đó ngăn chặn. Tham số `register` của `forge_split` nhận một tiền tố hoặc `true` (`project`), và `out` mặc định là `data/split`. Mọi công cụ forge sau `forge_init` đều nhận `project_dir` mà nó trả về. `get_training_guardrails` (tùy chọn `topic`) giải thích chi tiết từng quy tắc. Xem toàn bộ đối số của từng công cụ tại:
[MCP Server](/docs/network/getting-started/mcp-server#arguments).

## 5. Chứng minh kết quả — riêng tư hoặc công khai

Điểm số là của bạn. Không có gì được công bố trừ khi bạn chủ động lựa chọn làm điều đó.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Một tập kiểm thử riêng tư hoặc chỉ cục bộ (local-only) không bao giờ tải các câu dữ liệu lên mạng; `--dry-run` khẳng định điều này trên từng dòng. Để cho phép người khác cạnh tranh trên tập kiểm thử của bạn mà không bao giờ nhìn thấy nội dung dữ liệu, hãy tổ chức một cuộc thi trên một máy do bạn kiểm soát: người tham gia gửi phương pháp của họ, phương pháp đó sẽ chạy trên node của bạn, và chỉ có điểm số được gửi ra ngoài. Các cuộc thi mới sẽ ẩn toàn bộ điểm số cho đến khi cuộc thi kết thúc, nhờ đó không ai có thể tinh chỉnh mô hình để đối phó riêng với tập kiểm thử của bạn. Xem [Tổ chức một cuộc thi tự chủ (Sovereign Contest)](/docs/network/sovereignty/run-a-sovereign-contest). Để đưa một mô hình bạn đã huấn luyện vào cuộc thi của người khác, mục §6 trong tệp `DEPLOY.md` của bản export sẽ nêu tên các tệp cấu thành bài dự thi và lệnh `mt-eval contest submit-model` chính xác cần chạy.

**Agent:** `list_contests { "language": "<code>" }`, `get_contest { id }`;
`get_results { "target_language": "<code>" }` và `get_run_card { id }` dành cho bảng xếp hạng công khai.

## 6. Kết hợp những giải pháp tốt nhất

**Ưu tiên chọn lựa trong số các kết quả đo lường của chính bạn trước.** Mọi thứ bạn đã chấm điểm trên tập kiểm thử đều là một báo cáo mt-eval: từ các bản chạy baseline và bản chạy kèm cặp ở bước 3 và bước 4 cho đến bản export của từng mô hình được huấn luyện (`evaluation/runlog_report.json` trong thư mục export folder). A terminal run with `-o results` writes to
`results/*_report.json` của nó; một lần chạy được khởi tạo qua MCP `run_benchmark` sẽ ghi ngay cạnh tệp kiểm thử, trong `data/results/mcp-run-<id>/`). Hãy so sánh tất cả chúng cùng một lúc — mẫu glob thứ nhất dành cho các lần chạy từ terminal, mẫu thứ hai dành cho các lần chạy của agent (hãy dùng mẫu khớp với các lần chạy của bạn; zsh sẽ dừng lại nếu một glob không khớp với tệp nào):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Sự chênh lệch nằm trong các khoảng tin cậy không cấu thành một sự xếp hạng, và một mô hình được huấn luyện có các dòng kiểm thử gần như trùng lặp (near-twins) trong dữ liệu huấn luyện thực chất đã đạt điểm dựa trên khả năng ghi nhớ: hãy trích dẫn con số không trùng lặp (twin-free) bên cạnh nó (DEPLOY.md và `nmt-forge report` nêu rõ con số nào), cùng với bất kỳ **lưu ý cảnh báo điểm số (score caveat)** nào mà mt-eval đã gắn cho con số đó. Cảnh báo *đầu ra gần như bất biến (near-constant output)* (chỉ một vài câu cố định được trả về cho rất nhiều câu kiểm thử khác nhau) có nghĩa là đầu ra không bám theo đầu vào, bất kể điểm số ra sao; forge in cảnh báo này ngay bên cạnh điểm số trong `export`, `DEPLOY.md`, `status`, `report`, `compare` và `lint`. Khi có nhiều mô hình đã export, `nmt-forge status` sẽ liệt kê từng mô hình cùng với điểm số, điểm số twin-free và các cảnh báo tương ứng, rồi yêu cầu bạn chọn mô hình để triển khai. Hãy ghi nhận lựa chọn bằng `nmt-forge choose <export>/model` (hoặc `nmt-forge serve <export>/model --choose`). Việc khởi chạy phục vụ (serve) một mô hình để dùng thử chỉ được ghi nhận là đang serve chứ không phải lựa chọn chính thức của bạn, do đó `status` sẽ tiếp tục hỏi cho đến khi bạn đưa ra lựa chọn.

**Agent:** `forge_status { "project_dir": "<dir>" }` — trong trạng thái `choose-export`, hãy hiển thị cho người dùng `result.advice.exports`, điểm số của từng bản export kèm theo `score_caveats` tương ứng, và hỏi xem nên triển khai mô hình nào; câu trả lời của người dùng được ghi nhận bằng `nmt-forge choose` trong terminal. Một lần serve tạm thời sẽ không giải quyết được câu hỏi này. `forge_compare { eval_set, hyps_a, hyps_b }` thực hiện kiểm thử A/B giữa hai mô hình forge kèm theo cảnh báo near-twin của từng mô hình và các lưu ý cảnh báo điểm số của mt-eval bên cạnh mô hình chiến thắng; tệp giả thuyết (hypotheses file) của mỗi mô hình chính là đường dẫn `hypotheses` mà `forge_export` trả về (`<export>/evaluation/battery-hyps.jsonl`).

Sau đó, hãy nhìn rộng ra ngoài các lần chạy của riêng bạn. Các phương pháp khác nhau sẽ phát huy hiệu quả tốt nhất cho các cặp ngôn ngữ khác nhau và các loại văn bản khác nhau. Mục [Network](/docs/network/) liệt kê các phương pháp và dịch vụ hiện có cùng bằng chứng thực nghiệm cho từng phương pháp — những gì đã được công bố chính thức, chứ không phải những gì bạn tự đo lường:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Một phương pháp được công bố trên bảng xếp hạng kèm theo cấu hình có thể được cài đặt chính xác như cách nó đã được chấm điểm: `champollion network leaderboard --install <method> --apply` sẽ thêm phương pháp đó vào dự án của bạn cho cặp ngôn ngữ tương ứng. CLI cấu hình phương pháp **theo từng cặp ngôn ngữ**, vì vậy tiếng Cree của bản tin có thể sử dụng mô hình bạn đã huấn luyện trong khi tiếng Pháp sử dụng mô hình được host sẵn. Việc liên kết chuỗi các phương pháp (ví dụ: một mô hình dịch tiếp nối bởi một bộ kiểm tra) được hướng dẫn trong [các mô hình chuỗi (chained models)](/docs/network/tutorials/chained-models).

## 7. Sử dụng trong thực tế

Hãy triển khai chính phương pháp mà bạn đã đo lường — không phải một phương pháp khác.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Trong khi mô hình đang chạy, `nmt-forge status` sẽ báo `serving` (công cụ kiểm tra xem server có còn phản hồi hay không); sau khi server dừng, nó sẽ nêu lại lệnh `serve` tương ứng, trên cùng cổng mạng đó.

Hoặc, đối với một mô hình được host sẵn có kèm cặp qua prompt, hãy thiết lập mô hình đó cho cặp ngôn ngữ trong `champollion.config.json`. Dù theo cách nào:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**Những gì mô hình tự huấn luyện của bạn chưa thể làm được.** Một mô hình nhỏ được huấn luyện trên vài nghìn câu chỉ học được các cụm từ trong phạm vi đó. Nó thường làm hỏng các biến giữ chỗ (`{name}`), các dạng số nhiều và định dạng đánh dấu markup, hoặc biến một nhãn ngắn như "Home" thành cả một câu dài. Cổng kiểm soát chất lượng (quality gate) sẽ từ chối các đầu ra này; không có dữ liệu hỏng nào được ghi lại. Hãy thiết lập cho cặp ngôn ngữ một **phương án dự phòng (fallback)**, và những chuỗi đó sẽ được chuyển sang một phương pháp thứ hai trong cùng một phiên đồng bộ:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Nếu không có văn bản nào được phép rời khỏi máy của bạn, hãy thiết lập phương án dự phòng là một mô hình cũng chạy ngay tại đó: `"fallback": { "method": "local", "model": "<your local model>" }` gửi yêu cầu đến một server tương thích với OpenAI trên chính máy này (Ollama, llama.cpp, vLLM), với chi phí API là $0. Một mô hình được host sẵn thường là phương án đối chứng thứ hai mạnh mẽ hơn; hãy sử dụng nó khi văn bản được phép gửi đến nhà cung cấp dịch vụ đó.

Mô hình của bạn sẽ dịch mọi thứ nó có thể xử lý. Phương án dự phòng chỉ nhận những chuỗi bị cổng kiểm soát từ chối, cùng các khối Markdown bị bỏ sót hoặc làm hỏng, và đầu ra của nó cũng phải vượt qua cổng kiểm soát chất lượng tương tự. `sync` in ra một dòng `[FALLBACK]` cho mỗi cặp ngôn ngữ kèm số lượng cụ thể, và `champollion verify` liệt kê bất kỳ nội dung nào mà cả hai phương pháp đều không thể dịch được. Xem [Phương thức dự phòng (Fallback method)](/docs/getting-started/configuration#fallback).

Nếu chỉ muốn xử lý một lần thay vì cấu hình tự động, hãy dịch riêng các chuỗi đó bằng một phương pháp khác:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…hoặc dịch thủ công, hoặc thông qua một người duyệt bản dịch với `champollion xliff export`. Và hãy đưa các chuỗi riêng của ứng dụng vào tập kiểm thử của bạn: một mô hình đạt điểm cao trên các câu do giáo viên soạn thảo vẫn có thể dịch sai câu "Chỗ nào bị đau?".

**Hệ thống chữ viết.** Nếu ngôn ngữ được viết bằng nhiều hơn một hệ chữ viết (ví dụ Plains Cree: Chữ Latinh chuẩn hóa - Standard Roman Orthography và Chữ ký âm - syllabics), CLI sẽ yêu cầu bạn lựa chọn trước khi dịch. Hãy thiết lập `"script"` cho ngôn ngữ đó trong tệp cấu hình; thông báo sẽ liệt kê các tùy chọn có sẵn.

Bộ nhớ dịch thuật (translation memory) đảm bảo rằng một câu không thay đổi sẽ không bao giờ bị tính phí lần thứ hai, và việc chuyển đổi mô hình sẽ không khiến toàn bộ nội dung phải dịch lại từ đầu. Tích hợp quy trình này vào CI với [Hướng dẫn CI/CD](/docs/guides/ci-cd). Tệp `export/model/DEPLOY.md` (từ bước 4) chứa cấu hình chính xác cho một mô hình đã huấn luyện, bao gồm phương thức `api` và cách mở kết nối an toàn trên mạng.

**Agent:** `translate { texts, source_language, target_language }` chạy các chuỗi văn bản qua cùng một pipeline xử lý. Thêm `method: "local"` và `base_url`, hoặc `method: "api"` và `endpoint`, đối với mô hình do bạn tự host và phục vụ, và thêm `script` đối với ngôn ngữ được viết bằng nhiều hơn một hệ chữ viết.

## Các quyết định trong suốt quá trình

| Quyết định | Chọn… | Khi nào |
|---|---|---|
| Nơi lưu trữ tập kiểm thử | local-only | Dữ liệu nhạy cảm, hoặc bạn chưa hỏi ý kiến những người đã viết ra nó |
| | private / sealed | Bạn muốn người khác biết nó tồn tại, hoặc cạnh tranh đánh giá trên đó mà không thấy dữ liệu |
| Kèm cặp hay huấn luyện | Kèm cặp mô hình được host sẵn | Bạn có bảng thuật ngữ và ít văn bản song ngữ, đồng thời việc dùng dịch vụ bên ngoài là chấp nhận được |
| | Huấn luyện với forge | Bạn có từ vài nghìn cặp câu trở lên, hoặc dữ liệu bắt buộc phải ở lại trên máy của bạn |
| Công bố | Chỉ điểm số | Mặc định cho bất kỳ dữ liệu nào không phải do chính bạn tự viết |
| | Không công bố gì | Luôn được phép — việc đo lường nội bộ vẫn rất hữu ích |

## Chi phí

- Các công cụ được miễn phí cho mục đích sử dụng phi thương mại: trường học, bệnh viện hoặc phòng khám công lập, tổ chức từ thiện hoặc dự án nghiên cứu đều được áp dụng (CLI, nmt-forge và MCP server thuộc giấy phép PolyForm Noncommercial 1.0.0; khung đánh giá evaluation harness là mã nguồn mở, theo giấy phép AGPL-3.0-or-later). [Ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this).
- Mô hình được host sẵn có chi phí theo biểu giá của nhà cung cấp mô hình đó; `--max-cost` sẽ dừng lần chạy trước khi chi phí vượt quá mức bạn cho phép, và báo cáo sẽ hiển thị chi phí trên từng câu. Mô hình cục bộ hoàn toàn không tốn phí ngoài thời gian vận hành máy của bạn.
- Việc huấn luyện mô hình forge mặc định chỉ cần CPU và mất vài phút; các thiết lập cấu hình lớn hơn sẽ cần đến GPU.
