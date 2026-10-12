---
sidebar_position: 3
title: "Huấn luyện mô hình đầu tiên của bạn (với agent của bạn)"
description: "Hướng dẫn từng bước để huấn luyện mô hình MT tài nguyên thấp bằng cách chỉ dẫn một coding agent — cài đặt, bảo vệ tập kiểm thử của bạn, huấn luyện trên CPU laptop, chấm điểm một lần và phục vụ mô hình cho champollion CLI. Những gì bạn nói, những gì forge làm và phản hồi từ chối trông như thế nào."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Huấn luyện mô hình đầu tiên của bạn (với agent của bạn)

Bạn không cần phải biết cách huấn luyện một mô hình dịch máy nơ-ron. Bạn chỉ cần có khả năng **nói với một coding agent những gì bạn muốn** — Claude, hoặc một mô hình thuộc phân khúc Sonnet/Flash, hoặc bất kỳ agent nào có thể chạy các lệnh shell. **nmt-forge** được xây dựng để agent có thể vận hành nó một cách *cơ học*: ở mỗi bước, công cụ sẽ cho agent biết chính xác phải làm gì tiếp theo, và từ chối — một cách rõ ràng, kèm theo giải pháp khắc phục — khi một bước nào đó có thể làm hỏng kết quả của bạn.

Trang này mô tả toàn bộ quy trình, từ `pip install` đến một mô hình mà champollion CLI
có thể gọi. Mỗi bước được trình bày dưới dạng **bạn nói gì với agent của mình**, **forge
thực hiện điều gì**, **khi bị từ chối sẽ trông như thế nào** (để cả hai không hoảng sợ
khi có từ chối xảy ra — từ chối nghĩa là công cụ đang hoạt động đúng cách), và ở phần cuối,
**cách đọc báo cáo**. Đây là phần liên quan đến forge trong bước 2 và 4 của tài liệu
[Xây dựng MT cho ngôn ngữ của bạn](/docs/build-mt-for-your-language), bao gồm các công việc
trước đó (tìm kiếm những gì hiện có), ở giữa (đo lường các lựa chọn hiện có) và sau đó
(xuất bản, kết hợp các phương pháp).

**Thứ tự thực hiện rất quan trọng.** Hãy đăng ký tập kiểm thử của bạn, rà soát dữ liệu
huấn luyện dựa trên tập đó, và ghi lại các dự đoán của bạn (Bước 1–3) **trước khi bất kỳ
thứ gì được chấm điểm trên tập kiểm thử** — bao gồm cả các mốc cơ sở (baseline) mà bước 3
của hướng dẫn đo lường bằng `mt-eval run`. Một lượt benchmark là một lượt đọc chấm điểm:
forge sẽ tính lượt này, và từ chối một dự đoán được ghi lại sau đó. Sau đó phân tách và
huấn luyện (Bước 4).

:::tip Quy tắc duy nhất cho agent của bạn
Hãy nói với nó: *"Luôn chạy `nmt-forge status --json` trước tiên, và sau mỗi bước.
Làm bất cứ điều gì mà `next_command` của nó yêu cầu."* Chỉ một thói quen đó sẽ biến
forge thành một đường ray dẫn hướng. Mọi lệnh forge đều nhận `--json`: chính xác
một tài liệu JSON trên stdout, và lệnh từ chối trả về dưới dạng `{"error": {…, "why", "fix"}}` với mã
thoát (exit code) 2. Nếu agent của bạn kết nối qua MCP, cùng một vòng lặp đó là công cụ
`forge_status` (`{ "project_dir": "<dir>" }`) — xem [Hướng dẫn dành cho Agent](/docs/network/getting-started/agent-guide).
:::

---

## Bước 0 — Cài đặt và trỏ agent tới ngôn ngữ của bạn

**Bạn nói:** *"Cài đặt nmt-forge cùng với gói mở rộng training (training extra). Tôi muốn
huấn luyện một mô hình tiếng Anh→[ngôn ngữ của bạn]. Hãy bắt đầu bằng cách tìm hiểu xem
forge biết gì về ngôn ngữ này. Mã ISO 639-3 là `crk`"* (sử dụng mã ngôn ngữ của bạn).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

Gói mở rộng `[hf]` bổ sung các thư viện huấn luyện (torch, transformers, accelerate,
tokenizers, sentencepiece, peft). Các bản phân phối (wheel) chỉ dùng CPU là đủ cho mô hình
mặc định. Bản `python3 -m pip install nmt-forge` thông thường cung cấp cho bạn các bộ bảo vệ (guards),
phân tách (splits), kiểm tra (audits) và chấm điểm (scoring) mà không cần huấn luyện.

**forge thực hiện:** `nmt-forge discover crk` đọc thẻ thông tin (card) của ngôn ngữ — chữ viết,
từ điển, bộ phân tích hình thái học, các kho ngữ liệu hiện có và các tập đánh giá (kèm theo
mọi cờ `do_not_train` / cách ly), cùng các chỉ số trọng tài riêng theo từng ngôn ngữ. Bạn
không cần một bản sao của kho lưu trữ Champollion: các card được tìm thấy trong thư mục bạn
chỉ định (`--cards-dir`), bản checkout cục bộ hoặc `node_modules/champollion`, hoặc chỉ mục card công
khai (được lưu vào bộ nhớ cache, nhờ đó hoạt động ngoại tuyến sau này). forge sau đó xếp
ngôn ngữ của bạn vào **thang đo tài sản** (asset ladder): (1) văn bản song ngữ → huấn luyện
có bảo vệ; (2) + đơn ngữ → dịch ngược (backtranslation) có gắn thẻ; (3) + từ điển/ngữ pháp →
dữ liệu tổng hợp có trích dẫn; (4) + bộ phân tích → tổng hợp dữ liệu được xác thực khứ hồi
(round-trip-verified); (5) + chỉ số trọng tài → chỉ số riêng của ngôn ngữ đó trong chấm điểm
và chọn checkpoint.

**Một trường trống nghĩa là CHƯA XÁC ĐỊNH (UNKNOWN), chứ không bao giờ là bằng không.** Một thẻ thưa thớt không có nghĩa là "ngôn ngữ này không có gì" — có thể nó chỉ chưa ghi nhận tài nguyên đó. Bạn luôn có thể tự mang theo kho ngữ liệu song ngữ của riêng mình.

Sau đó: *"Khởi tạo khung dự án (scaffold)."*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Thao tác này sẽ ghi một không gian làm việc (`.forge/`), tệp `config.json` khởi đầu,
và một bản tóm tắt `NEXT_STEPS.md` với thứ tự lệnh chính xác. **Hãy chạy mọi lệnh sau này
từ bên trong thư mục dự án** — các đường dẫn cấu hình đều tương đối so với thư mục này.

Cấu hình khởi đầu sử dụng cấu hình mẫu (preset) mô hình **`cpu-tiny`** trừ khi bạn chọn cấu hình khác:

| `--model` | Ý nghĩa | Yêu cầu | Kỳ vọng |
|---|---|---|---|
| `cpu-tiny` (mặc định) | một mô hình transformer nhỏ (~6 triệu tham số) được huấn luyện từ đầu trên các cặp câu của bạn; vốn từ vựng chỉ được học từ các dòng huấn luyện của bạn | một CPU, không cần tải xuống | yếu: trên 1–2 nghìn cặp câu, chrF++ xấp xỉ 5–30 (mức cao nhất chỉ đạt được với dữ liệu có tính khuôn mẫu cao). Mô hình học các cụm từ và mẫu câu từ dữ liệu của bạn, không phải ngôn ngữ nói chung |
| `cpu-finetune --base <hf-id>` | tinh chỉnh một mô hình Marian/opus-mt tiền huấn luyện nhỏ do bạn chỉ định (chọn mô hình cho cặp ngôn ngữ *có liên quan*) | một CPU, tải xuống ~300 MB | thường tốt hơn `cpu-tiny` khi tồn tại cặp ngôn ngữ liên quan — hãy đo lường trên tập dev của bạn, đừng đoán định |
| `nllb-600m` | NLLB-200 distilled 600M kèm LoRA | một GPU, tải xuống ~2,5 GB | khởi đầu mạnh mẽ nhất; kiểm tra thời gian thực (wall-clock) của forge sẽ từ chối chạy trên CPU chỉ trong vài phút |

Cấu hình preset được ghi rõ ràng dưới dạng các con số cụ thể trong `config.json` → `model`,
vì vậy không có gì bị ẩn giấu và việc thay đổi một con số sẽ tạo ra một lượt chạy mới có mã băm (hash) riêng biệt.

**Không có card cho ngôn ngữ của bạn?** `nmt-forge init <code> --no-card --name "<name>"`
vẫn sẽ tạo khung cho dự án; mọi thông tin mà một card lẽ ra cung cấp sẽ được ghi nhận là
chưa biết (unknown), và không có gì bị tự bịa ra.

---

## Bước 1 — Tách riêng tập kiểm thử và đăng ký nó {#step-1--set-your-test-set-aside-then-split}

**Bạn nói:** *"Đây là kho ngữ liệu song ngữ của tôi và, tách riêng, tập kiểm thử
đã được giáo viên kiểm tra. Hãy giữ tập kiểm thử nằm ngoài quá trình huấn luyện,
và đăng ký nó trước khi bất kỳ thứ gì được chấm điểm trên đó."*

Các tệp có thể ở định dạng `.tsv` (câu nguồn, một dấu TAB, sau đó là bản dịch,
mỗi dòng một cặp; các dòng bắt đầu bằng `# ` là chú thích) hoặc `.jsonl`
(`{"source": …, "target": …}` trên mỗi dòng). Nếu tập kiểm thử là riêng tư, hãy đánh dấu nó là chỉ-cục-bộ
(local-only) **trước khi** bất kỳ thứ gì đọc nó — bao gồm cả agent của bạn:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
Khi đó forge sẽ không bao giờ in các câu của tập này.

**forge thực hiện — nếu bạn có tập kiểm thử riêng** (trường hợp phổ biến đối với
trường học hoặc phòng khám):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

Việc đăng ký sẽ khởi tạo **nhật ký đọc** (`<file>.reads.jsonl`) của tệp: từ thời điểm này,
mỗi lần tệp này được chấm điểm — bởi forge, hoặc bởi `mt-eval run` / `mt-eval compare`
— đều được tính. Đó là lý do tại sao việc đăng ký được thực hiện đầu tiên: một lượt
chạy benchmark được thực hiện trước đó sẽ được liệt kê khi đăng ký, nhưng không được tính vào số lần.

**Nếu bạn không có tập kiểm thử riêng**, hãy trích xuất một tập từ ngữ liệu thay vào đó —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` chỉ trong một bước
(Bước 4 giải thích về phân tách dữ liệu) — rồi chuyển sang Bước 3.

`nmt-forge status` lúc này sẽ nêu rõ bước tiếp theo: đưa ra các dự đoán (Bước 3), trước
bất kỳ lượt benchmark nào — hãy rà soát ngữ liệu của bạn trước (Bước 2).

---

## Bước 2 — Sàng lọc rò rỉ dữ liệu

**Bạn nói:** *"Trước khi chúng ta huấn luyện, hãy kiểm tra ngữ liệu dựa trên tập kiểm thử
và cho tôi biết bạn sẽ loại bỏ những gì và tại sao."*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge thực hiện:** nó rà soát từng dòng dựa trên mọi tập dev/test/sealed đã đăng ký.
Cùng một ngữ liệu và cùng các tập đã đăng ký
luôn cho ra kết quả giống nhau. Nó giải thích những gì nó sẽ **loại bỏ** (drop):

- **Câu nhắc giống hệt (Identical prompt)** — câu nguồn của dòng trùng khớp với câu nguồn
  của một dòng trong tập kiểm thử (sau khi bỏ qua chữ hoa/thường, dấu câu và khoảng trắng).
  Bị loại bỏ **ngay cả khi bản dịch của dòng đó khác biệt**: mô hình vẫn sẽ bị coi là đã
  luyện tập trên đúng câu nhắc kiểm thử đó.
- **Câu trả lời giống hệt (Identical answer)** — câu đích của dòng trùng với bản dịch
  tham chiếu kiểm thử.
- **Câu trả lời gần như trùng lặp (Near-duplicate answer)** — câu đích của dòng chia sẻ
  ít nhất 60% từ ngữ với một câu trả lời kiểm thử (đã gập dấu phụ/accents folded, do đó
  các biến thể chính tả vẫn được tính) **và** chứa toàn bộ câu trả lời, là một phần của nó,
  hoặc giống nhau ít nhất 90%. Mô hình sẽ bị coi là đã nhìn thấy gần hết câu trả lời.

…và những gì nó **chủ đích giữ lại**, được báo cáo nhưng không bao giờ bị xóa:

- **Khuôn mẫu tương đồng (Template siblings)** — dòng chia sẻ cùng một khung câu với câu
  trả lời kiểm thử nhưng thay thế một từ qua lại (*"I see the dog"* / *"I see the cat"*).
  Mô hình vẫn phải tạo ra từ mà nó chưa từng thấy trong khung câu đó. Các kho ngữ liệu
  sách giáo khoa và trường học thường có rất nhiều trường hợp này. forge liệt kê các dòng
  kiểm thử có mẫu tương đồng trong tập huấn luyện; vì cấu hình khởi đầu thiết lập
  `eval.near_dupe_corpus`, báo cáo cuối cùng sẽ hiển thị điểm số **"(strict)"** trên
  các dòng không có mẫu tương đồng bên cạnh điểm số đầy đủ.
- **Câu nhắc tương tự, câu trả lời khác biệt (Similar prompt, different answer)** — câu
  nguồn gần như trùng lặp (không phải bản sao y hệt) với một câu nguồn kiểm thử, nhưng bản
  dịch thì khác: một sự tương phản tối thiểu hợp lệ, không phải rò rỉ dữ liệu.

Dưới đây là báo cáo cho một ngữ liệu mẫu gồm 12 dòng được rà soát với tập kiểm thử 3 dòng
(đã cắt bớt; các câu mẫu là tiếng Anh với đích giống tiếng Pháp):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

Dòng 3 có bản dịch *khác* với dòng kiểm thử nhưng vẫn bị loại bỏ:
câu nhắc của nó chính là câu nhắc kiểm thử.

Các ví dụ trích dẫn các dòng trong **ngữ liệu của bạn** theo số dòng; nội dung văn bản của
chính tệp kiểm thử không bao giờ được in ra, và dòng khớp với tập **niêm phong (sealed)**
chỉ được hiển thị bằng số dòng. (Khi một dòng trong ngữ liệu giống hệt dòng kiểm thử, hoặc
chứa dòng kiểm thử, việc trích dẫn dòng ngữ liệu cũng sẽ làm lộ câu kiểm thử đó — hãy truyền
`--no-examples` nếu đầu ra sẽ được chia sẻ.)

`--clean-to pairs.clean.jsonl` ghi lại các dòng còn giữ lại, cùng với một bản ghi kiểm tra không chứa
nội dung (content-free audit record) bên cạnh chúng (`pairs.clean.audit.json`). Hãy rà soát ngữ liệu
**trước khi** bạn phân tách (Bước 4 sẽ phân tách tệp đã được làm sạch). Đừng rà soát lại
toàn bộ ngữ liệu sau khi đã trích xuất tập dev từ đó — các dòng tập dev sẽ tự khớp với
chính chúng và bị loại bỏ. Rà soát mọi dữ liệu *bổ sung* (thu thập từ web, văn bản đơn ngữ)
theo cùng cách này trước khi đưa vào huấn luyện.

**Việc rà soát không làm tiêu hao tập kiểm thử của bạn.** leak-audit đọc tập kiểm thử để
so sánh các dòng, và forge ghi nhận đó là một lượt đọc *kiểm tra* (audit read), không bao
giờ là lượt đọc chấm điểm: nó không cản trở các dự đoán bạn viết ở Bước 3.

**Hãy đọc kết luận (verdict) trước** (dòng `VERDICT:`; với `--json`, là khóa `verdict`).
Nếu nó cho biết hầu hết các dòng kiểm thử đều có câu gần như song sinh (near-twin) trong ngữ
liệu của bạn, thì một mô hình được huấn luyện trên toàn bộ ngữ liệu đó sẽ chỉ chấm điểm khả
năng ghi nhớ các cụm từ huấn luyện thay vì khả năng dịch. Với một tập kiểm thử cố định
(đã được giáo viên hoặc y tá kiểm tra), thông thường bạn sẽ huấn luyện **hai mô hình**: một
mô hình trên toàn bộ dữ liệu — thường là mô hình hữu ích hơn để triển khai — và một mô hình
không có câu song sinh (twin-free) mà điểm số của nó thể hiện cách phương pháp tiếp cận xử lý
các câu mới. Ngữ liệu không có câu song sinh được tạo ra từ `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Lệnh này loại bỏ các dòng huấn luyện là bản song sinh gần của các dòng kiểm thử, báo cáo tập
hợp con nghiêm ngặt (strict subset) trước và sau, từ chối nếu thao tác đó khiến không còn gì
để huấn luyện — và ghi cấu hình của mô hình không có câu song sinh bên cạnh cấu hình của bạn,
**`config-notwins.json`**: cùng một cấu hình với `run_name` riêng, và
`data.gold` / `eval.near_dupe_corpus` được trỏ tới tệp không có câu song sinh
(`--companion-config <file>` đặt tên cho một tệp khác; tệp đã tồn tại sẽ không bao giờ bị
ghi đè). Lệnh này sẽ in ra câu lệnh để huấn luyện mô hình đó. Cho đến khi tập dev được
đăng ký (Bước 4), nó sẽ nhắc bạn trích xuất tập dev trước và chạy lại bước kiểm tra này,
để các dòng tập dev cũng bị loại khỏi tệp không có câu song sinh. `nmt-forge status` giữ lại kết
luận này — và sau đó là mô hình không có câu song sinh chưa được huấn luyện — trong phần cảnh
báo cho đến khi bạn xử lý nó.

**Khi bị từ chối sẽ trông như thế nào:** bạn không cần phải nhớ chạy lệnh này — `nmt-forge
run` sẽ kiểm tra mọi tệp huấn luyện dựa trên các tập kiểm thử và tập niêm phong của bạn và
từ chối nếu có rò rỉ: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0
identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12
template sibling(s) … which are KEPT"*. Cách khắc phục: `nmt-forge leak-audit <file>
--clean-to <file.clean.jsonl>` và huấn luyện trên tệp đã được làm sạch.

---

## Bước 3 — Dự đoán trước khi xem kết quả

**Bạn nói:** *"Hãy ghi lại điểm số kỳ vọng của từng mô hình trên tập kiểm thử —
trước khi chúng ta đo lường bất kỳ thứ gì trên đó."*

**forge thực hiện:** một bản đăng ký trước (preregistration) cho mỗi mô hình bạn dự định
huấn luyện, được đặt tên theo mô hình:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Một tệp dự đoán là một mảng JSON chứa các dự đoán. Mỗi mục nêu tên một chỉ số đo lường và
lý do ngắn gọn trong một câu, kèm theo hướng so sánh với mốc cơ sở
(`"direction": "increase", "baseline_score": 0, "margin": 5`) — sẽ được tự động kiểm tra sau —
hoặc kỳ vọng dạng văn bản tự do (`"expect": "between 10 and 30"`) do con người kiểm tra. Bạn
(hoặc agent của bạn, nói rõ) cam kết những điều này **trước khi** có bất kỳ điểm kiểm thử nào
tồn tại — **và trước bất kỳ lượt benchmark nào của mô hình hiện có trên tập kiểm thử**: các
mốc cơ sở ở bước 3 của [Xây dựng MT cho ngôn ngữ của bạn](/docs/build-mt-for-your-language#3-measure-the-options)
được thực hiện *sau* bước này. Khi bạn xuất (export), `--prereg <id>` sẽ cho biết dự đoán nào
đánh giá mô hình nào. Hoặc bạn có thể ghim dự đoán vào cấu hình của mô hình ngay bây giờ:
`--config-hash <hash>` trên `prereg new`, với mã hash đầy đủ mà
`nmt-forge preflight run --config config-notwins.json` in ra. Bất kỳ chỉnh sửa nào sau này
đối với cấu hình đó (chẳng hạn như ngân sách thời gian) sẽ thay đổi mã hash và gỡ ghim,
do đó việc chỉ định bản prereg khi xuất là cách đơn giản hơn.

**Khi bị từ chối sẽ trông như thế nào:** bốn trường hợp bạn có thể gặp ở đây.

- Bản mẫu chưa qua chỉnh sửa sẽ bị từ chối: các trình giữ chỗ `REPLACE` của nó không
  đưa ra dự đoán gì. Hãy viết kỳ vọng và lý do giải thích của riêng bạn.
- Tệp Markdown hoặc văn bản xuôi sẽ bị từ chối kèm theo định dạng yêu cầu và lệnh tạo mẫu.
  Chỉ có một định dạng duy nhất: mảng JSON.
- Bản đăng ký trước được viết sau khi tập kiểm thử đã được chấm điểm sẽ bị từ chối:
  *"[preregister] eval set 'project-test' was already read for scoring … before
  this preregistration"*. Lượt benchmark cũng được tính. `--allow-after-reads` chỉ tồn tại
  cho các dự đoán thực sự đã được ghi lại trước các lượt đọc đó (chẳng hạn như trên giấy);
  nó được ghi lại, và mọi báo cáo, tệp xuất, `DEPLOY.md` và
  `nmt-forge status` sau đó sẽ nói rõ rằng các dự đoán này được đưa ra sau N lượt đọc chấm điểm.
- Việc chấm điểm tập kiểm thử khi chưa có đăng ký trước sẽ bị từ chối: *"[preregister] no
  preregistration for eval set 'project-test' … why: results looked at without
  written-down expectations become post-hoc stories"*. Đây chính là điều phân biệt một kết
  quả thực tế với việc thêu dệt câu chuyện sau khi đã biết kết quả (results-first storytelling).

:::info Tại sao việc này có vẻ như thêm việc
Đây chính là công việc cần làm. Mỗi rào chắn ở đây là một sai lầm từng đánh lừa các nhà nghiên cứu thực thụ. Công cụ này biến con đường trung thực thành con đường dễ dàng và biến con đường không trung thực thành con đường ngăn cản bạn.
:::

Bây giờ, hãy đo lường các lựa chọn hiện có trên tập kiểm thử — bước 3 của [Xây dựng MT cho
ngôn ngữ của bạn](/docs/build-mt-for-your-language#3-measure-the-options) — rồi quay lại để
huấn luyện.

---

## Bước 4 — Phân tách, kiểm tra điều kiện (gates), rồi huấn luyện {#step-4--check-the-gates-then-train}

**Bạn nói:** *"Phân tách ngữ liệu đã làm sạch thành tập train và dev. Liệu lượt huấn luyện
có vượt qua tất cả các bài kiểm tra không? Nếu có, hãy huấn luyện."*

**forge thực hiện — phân tách:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` chỉ trích xuất train và dev, vì tập kiểm thử của bạn đã tồn tại dưới dạng
một tệp riêng biệt được đăng ký (nếu trích xuất cả tập test thì Bước 1 đã thực hiện phân tách rồi).
`--register project` ghi nhận `project-dev` trong không gian làm việc — tên mà cấu hình khởi đầu đã trỏ tới.

Việc phân tách là **không giao nhóm (group-disjoint)**: bất kỳ hai cặp câu nào có chung
câu nguồn *hoặc* câu đích đều sẽ nằm ở **cùng một** phía. Đây là nguyên nhân phổ biến nhất
khiến điểm số của các ngôn ngữ tài nguyên thấp bị thổi phồng — một cuốn sách giáo khoa ánh xạ
nhiều bài tập tiếng Anh sang một từ đích, việc phân tách ngẫu nhiên ngây thơ sẽ đưa một bản
sao vào tập train và bản song sinh của nó vào tập test, và mô hình "dịch" được câu trả lời
mà nó chỉ đơn giản là đã ghi nhớ. Đầu ra cho biết điều gì đã diễn ra:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Với tập kiểm thử đã được đăng ký, `split` cũng rà soát ngay các tệp train và dev mới
dựa trên tập kiểm thử đó và cảnh báo nếu có bất kỳ dòng nào sẽ bị từ chối sau này.

**Ngữ liệu theo khuôn mẫu (sách từ vựng, bài tập luyện câu).** `--near-dupe 0.6` cũng giữ
các câu *gần như* trùng lặp — những câu được xây dựng trên cùng một cấu trúc khung — ở cùng
một phía, để dòng thuộc tập dev hoặc test không bao giờ có bản song sinh khuôn mẫu trong tập
training. Trên một ngữ liệu có nhiều khuôn mẫu, các khung câu có thể liên kết theo chuỗi thành
một nhóm khổng lồ (*"Does your arm hurt?"* ~ *"Does your leg hurt?"* ~ *"Your leg looks swollen"* …),
và một nhóm chỉ có thể được xếp nguyên vẹn về một phía. Khi điều đó khiến một phía nhận nhiều
dòng hơn nhiều so với yêu cầu của bạn — vượt quá **1,5×** yêu cầu — hoặc khiến tập huấn luyện
còn lại ít hơn một nửa so với mức mà yêu cầu để lại, `split` sẽ từ chối và không ghi
tệp nào: *"[split-guard] split refused — nothing was written: the carve does not match the
request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the
773 rows the request leaves it)"*, theo sau là lý do (sự liên kết chuỗi, cùng kích thước của
nhóm lớn nhất) và các hướng giải quyết hiệu quả: ngưỡng cao hơn, giới hạn kích thước nhóm
(`--near-dupe 0.6 --max-group 51` — các liên kết gần trùng lặp vượt quá giới hạn sẽ không bị cắt, và quá trình
phân tách sẽ đếm chúng), loại bỏ các câu song sinh của một tập kiểm thử cố định bằng
`leak-audit --drop-test-twins`, hoặc các câu dev/test được viết độc lập với tài liệu huấn luyện. forge tự
kiểm tra hiện tượng liên kết chuỗi này: trên ngữ liệu như vậy, lời khuyên về câu gần song sinh
của nó (tại đây, trong preflight, và trong tệp DEPLOY.md khi xuất) sẽ không đề xuất `--near-dupe 0.6`.

**Khi bị từ chối sẽ trông như thế nào:** nếu bạn đưa cho forge một bản phân tách do chính bạn
tự tạo, `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` sẽ từ chối khi các phía bị chồng chéo — *"[split-guard] 3 shared canonical
source keys and 1 shared target keys between 'train' and 'test'"* — kèm theo cách khắc phục:
phân tách lại bằng `split`; không tự xóa các dòng vi phạm bằng tay.

**Hai mô hình?** Bây giờ khi tập dev đã được đăng ký, hãy chạy lại kiểm tra không có câu
song sinh từ Bước 2 (các dòng tập dev cũng sẽ được loại khỏi tệp không có câu song sinh);
`config-notwins.json` của nó sẽ huấn luyện mô hình thứ hai bên dưới.

**forge thực hiện — kiểm tra điều kiện (gates):** `nmt-forge preflight run --config config.json` liệt kê mọi cổng điều kiện
mà lượt chạy sẽ gặp, ✓ hoặc ✗, mỗi ✗ đi kèm cách khắc phục — bao gồm cả việc gói mở rộng
training đã được cài đặt hay chưa:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Khi tất cả đều có màu xanh lá: `nmt-forge run config.json` (và đối với mô hình không có câu song sinh,
`nmt-forge preflight run --config config-notwins.json && nmt-forge run
config-notwins.json`).

Với preset `cpu-tiny` mặc định, quá trình này chạy trên CPU máy tính xách tay thông thường — không
cần GPU, không cần tải xuống. Huấn luyện vẫn là bước duy nhất **không phải** là một lệnh gọi công
cụ tức thì, vì vậy agent của bạn nên chạy nó dưới nền với đầu ra được chuyển vào tệp log, và chỉ
theo dõi các dòng quan trọng (`refused`, `Error`, `wall-clock`, `RUN EXIT`)
thay vì liên tục thăm dò (polling). Một bảng điều khiển trực tiếp với các đường cong hàm mất mát
(loss curves) và nút dừng sẽ mở ra cho **bạn** (tại `http://127.0.0.1:8377` khi cổng đó còn trống) — bảng
này dành cho bạn, không phải cho agent. Ở giai đoạn đầu của lượt chạy, forge sẽ đo tốc độ và từ
chối — chỉ trong vài phút, không phải vài ngày — một lượt chạy không thể hoàn thành trong phạm vi
`model.time_budget_hours` của cấu hình.

Các dòng `[schedule-sanity]` hiển thị **ngưỡng sàn** (floor) dừng sớm (early-stopping) mà forge suy
ra từ tỷ lệ pha trộn dữ liệu của bạn, nhờ đó lượt chạy có nhiều dữ liệu tổng hợp không bị dừng đột
ngột ở nửa epoch khi hàm loss trên tập dev thực dao động (một dạng lỗi thực tế — xem
[Chẩn đoán một lượt huấn luyện](/docs/network/getting-started/diagnosing-training)).

Khi hoàn tất, forge đã **chọn một checkpoint trên tập dev được rào chắn** (không bao giờ
trên tập test), ghi một `run-manifest.json`, và in điểm số tập dev — luôn đi kèm khoảng tin cậy 95% —
theo sau là lệnh tiếp theo.

---

## Bước 5 — Chấm điểm một lần duy nhất và đóng gói

**Bạn nói:** *"Chấm điểm mô hình trên tập kiểm thử và đóng gói để chúng ta có thể sử dụng."*

**forge thực hiện:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Một lệnh duy nhất:

- giải mã tập kiểm thử của bạn bằng checkpoint mà lượt chạy đã chọn và chấm điểm — bị từ chối
  nếu không có đăng ký trước, được ghi vào sổ cái (ledger) của không gian làm việc, khoảng tin cậy
  95% cho mọi con số, và một phần **Chẩn đoán & Khuyến nghị (Diagnosis & Recommendations)** bằng ngôn
  ngữ dễ hiểu;
- ghi kết quả dưới dạng một **báo cáo mt-eval** trong `export/evaluation/`, để
  `mt-eval compare` đặt mô hình này bên cạnh bất kỳ mô hình nào bạn đã đo lường bằng bộ công cụ đánh giá
  (ví dụ: các mô hình được lưu trữ trên máy chủ ở bước 3 của
  [Xây dựng MT cho ngôn ngữ của bạn](/docs/build-mt-for-your-language#3-measure-the-options));
- đóng gói một **mô hình khép kín (self-contained model)** trong `export/model/` (trọng số và
  tokenizer, không có trạng thái huấn luyện), `forge-model.json` (mô hình này là gì và đã được đo lường
  như thế nào), tệp manifest của plugin champollion, và `DEPLOY.md` với các câu lệnh chính xác.
  `export/model/` không chứa câu kiểm thử nào; đây là thư mục duy nhất bạn triển khai.

**Điểm số** là tiêu đề nổi bật của bộ đánh giá: chrF++ của ngữ liệu kèm khoảng tin cậy 95%,
được viết theo cùng một cách ở mọi nơi mà forge hiển thị — ví dụ `chrF++ 31.2 [28.4, 34.0]` — kèm theo
chữ ký sacreBLEU trong các bản ghi đầy đủ (`forge-model.json`, bản tóm tắt xuất dữ liệu, `DEPLOY.md`).
BLEU, spBLEU và TER được hiển thị bên cạnh, không bao giờ bị hòa lẫn vào nhau; độ trùng khớp
chính xác (exact match) và các làn kiểm tra khác đóng vai trò chẩn đoán. Không có giao diện
forge nào in điểm tổng hợp hay nhãn chất lượng: giá trị thực tế của bản dịch là do chính người
bản ngữ đánh giá.

**Những yếu tố đánh giá điều kiện điểm số luôn đi kèm với điểm số đó.** Báo cáo mt-eval ghi lại
mọi yếu tố giới hạn ý nghĩa của điểm số — ví dụ như *đầu ra gần như bất biến* (mô hình trả về một
trong số ít câu cho nhiều đầu vào khác nhau, do đó đầu ra không theo sát đầu vào), đầu ra dài hơn
hoặc ngắn hơn nhiều so với bản tham chiếu, hoặc sao chép nguyên văn câu nguồn. `export`
truyền tải từng lưu ý này theo đúng từ ngữ của bộ đánh giá: trong phần tóm tắt của nó
(`score_caveats`), trong `forge-model.json`, và trong `DEPLOY.md` ngay bên dưới điểm số.
`status`, `report`, `compare` và `lint` cũng nêu điều tương tự.
Một điểm số đi kèm lưu ý cảnh báo sẽ không bao giờ được đưa ra như là "con số để trích dẫn" mà
thiếu đi lưu ý đó.

Nếu có bất kỳ lỗi nào xảy ra, sẽ không có bản xuất dở dang nào bị sót lại. Hai lưu ý:
`export/evaluation/` chứa các câu kiểm thử của bạn — không bao giờ sao chép tệp này cùng với mô hình;
hãy giữ nó cùng với tập kiểm thử. (Khi tập kiểm thử được đánh dấu là riêng tư, mọi tệp ở đó đều
mang cùng dấu hiệu này.) Và tập kiểm thử **niêm phong (sealed)** chỉ được dùng một lần duy nhất:
việc xuất sẽ tiêu tốn tập này, và lần xuất thứ hai sẽ bị từ chối trừ khi bạn truyền
`--no-eval` (đóng gói mô hình mà không chấm điểm lại).

`nmt-forge evaluate <run-manifest>` là phần chỉ chấm điểm của `export`, nếu bạn
chỉ muốn có các con số mà không cần đóng gói (`--harness-out DIR` ghi báo cáo mt-eval).

**Hai mô hình trên cùng một tập kiểm thử** (ví dụ: một mô hình được huấn luyện trên toàn bộ dữ liệu
và một mô hình với `--drop-test-twins`): khi không gian làm việc chứa lượt chạy thứ hai, dòng
`NEXT` và `nmt-forge status` của lượt chạy sẽ đặt tên cho mỗi lượt một thư mục
(`--out export-<run>/`). Thứ tự không quan trọng: dù mô hình nào được xuất sau, `DEPLOY.md` của mô
hình toàn bộ dữ liệu cuối cùng vẫn sẽ trích dẫn điểm của mô hình không có câu song sinh. Với hai bản
đăng ký trước trên một tập kiểm thử, `nmt-forge status` và `nmt-forge report` cho biết bản nào áp dụng cho
lượt chạy nào (hoặc `--prereg <id>` phải đưa ra quyết định — export the twin-free model with `--prereg notwins`). `nmt-forge compare` tiến hành thử nghiệm A/B
hai mô hình trên tập kiểm thử và cho biết, theo từng mô hình, có bao nhiêu dòng kiểm thử có câu gần
song sinh trong dữ liệu huấn luyện của nó: một chiến thắng nhờ khả năng ghi nhớ sẽ được báo cáo là một
chiến thắng như vậy. Lệnh này lấy các bản dịch giả định (hypotheses) của từng mô hình — `<export>/evaluation/battery-hyps.jsonl`,
có tên là `hypotheses` trong phần tóm tắt xuất dữ liệu — và chuyển tiếp các lưu ý về điểm số mà
mt-eval đã ghi cho lần xuất đó. Điểm số của mô hình không có câu song sinh là con số duy nhất để
trích dẫn cho các câu mới, nhưng chỉ khi đi kèm với bất kỳ lưu ý cảnh báo nào: nếu đầu ra của mô
hình không có câu song sinh gần như bất biến, điểm số của nó không phải là bằng chứng cho thấy nó
dịch được các câu mới, và `DEPLOY.md` sẽ ghi rõ điều đó bên cạnh con số).

**Các lượt đọc của bộ đánh giá đều được tính.** Khi forge đăng ký một tập kiểm thử, nó sẽ khởi tạo
một nhật ký đọc nhỏ bên cạnh tệp (`<file>.reads.jsonl`), và `mt-eval run` / `mt-eval compare` sẽ thêm một
dòng không chứa nội dung (id lượt chạy, mục đích, sha256 của tệp, dấu thời gian) mỗi lần chúng chấm
điểm tệp đó. forge sẽ đọc nhật ký này: bản đăng ký trước được viết sau một lượt đọc như vậy sẽ bị từ
chối vì bị coi là dự đoán hồi quy/tiên lượng sau (postdiction) (trừ khi có `--allow-after-reads`, điều mà
mọi báo cáo sau đó đều công khai) — đây là lý do tại sao Bước 3 diễn ra trước các mốc cơ sở — một tập
niêm phong được đọc bởi `mt-eval` sẽ bị coi là đã sử dụng hết, `status` và `ledger show --set`
sẽ đếm các lượt đọc, và `DEPLOY.md` sẽ thông báo khi điểm số được xuất không phải là kết quả xem
lần đầu.

### Cách đọc báo cáo battery-lint

Báo cáo là một bảng điểm **theo văn phong/thể loại ngữ vực (register)** (sách giáo khoa, văn bản chính phủ,
truyện truyền khẩu, …) — hoặc một nhóm duy nhất, `all`, khi các dòng kiểm thử của bạn không
ghi rõ ngữ vực — mỗi mục đi kèm khoảng tin cậy của nó, theo sau là phần chẩn đoán. Phần chẩn đoán sẽ chỉ
ra các **ngữ vực yếu nhất** của bạn và đối với mỗi ngữ vực, nêu rõ nguyên nhân có khả năng nhất cùng
**đòn bẩy (lever)** cần tác động tiếp theo:

| Nếu phần chẩn đoán ghi… | Điều đó có nghĩa là… | Đòn bẩy |
|---|---|---|
| `R1-vocabulary-gap` | ngữ vực có điểm thấp **và** đầu ra chưa hoàn chỉnh; mô hình thiếu từ vựng | **TỪ VỰNG (VOCABULARY)** — mở rộng vốn từ, sau đó kiểm tra lại phễu |
| `R2-structure-gap` | các từ đã biết nhưng *cấu trúc* câu thì chưa | **CẤU TRÚC (STRUCTURE)** — bổ sung các cấu trúc còn thiếu (templates/compositor) |
| `R3-mixed-convention` | đầu ra bị lẫn lộn quy cách chính tả | **CHÍNH TẢ (ORTHOGRAPHY)** — chuẩn hóa ngữ liệu về một quy ước duy nhất, huấn luyện lại |
| `R4-optimism-bound` | điểm số "đầy đủ" bị thổi phồng do các dòng kiểm thử gần song sinh | **ĐO LƯỜNG (MEASUREMENT)** — trích dẫn điểm nghiêm ngặt (strict) cho khả năng tổng quát hóa |
| `R5-low-power` | khoảng tin cậy quá rộng | **ĐO LƯỜNG (MEASUREMENT)** — không hành động dựa trên các mức chênh lệch nhỏ hơn khoảng tin cậy (CI); mở rộng tập kiểm thử |
| `R7-transfer-plateau` | kết quả tốt trên dữ liệu tổng hợp, nhưng bị đình trệ trên văn bản thực | **DỮ LIỆU THỰC (REAL-DATA)** — dịch ngược dữ liệu đơn ngữ hoặc thu thập các câu song ngữ thực tế |
| `R9-harness-score-caveat` | báo cáo mt-eval kèm lưu ý điều kiện cho điểm số (ví dụ: đầu ra gần như bất biến); `high` khi mt-eval coi đó là vấn đề nghiêm trọng | **ĐO LƯỜNG (MEASUREMENT)** — chỉ trích dẫn điểm số kèm theo lưu ý cảnh báo, và đọc kỹ một số câu đầu ra trước khi gọi đó là chất lượng dịch thuật |

Mỗi phát hiện đều đi kèm bằng chứng kích hoạt nó. Đối với các phát hiện `--json`, agent của bạn
có thể xử lý bằng lập trình: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Bước 6 — Cung cấp mô hình cho champollion CLI

**Bạn nói:** *"Khởi chạy dịch vụ (serve) mô hình đã xuất và dùng nó để dịch các chuỗi văn bản của ứng dụng chúng tôi."*

**forge thực hiện:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` phản hồi theo hai cách: giao ước **api method** của champollion
(`POST /translate`) và `/v1/chat/completions` **tương thích OpenAI**, đây
là giao thức mà `champollion sync --method local` giao tiếp. `export/model/DEPLOY.md` chứa
đoạn trích `champollion.config.json` cho phương thức `api` (phương thức được khuyến nghị)
và cho manifest của plugin. Máy chủ chỉ lắng nghe trên `127.0.0.1`; để hiển thị
nó trên mạng, bạn phải cung cấp cho nó một mã token (`--token`, hoặc
`NMT_FORGE_SERVE_TOKEN`), vì bất kỳ ai truy cập được cổng đó đều có thể sử dụng mô
hình của bạn. CLI không cần khóa cho máy chủ loopback; máy chủ được khởi động bằng
mã token sẽ yêu cầu cùng giá trị đó trong `CHAMPOLLION_API_KEY`.

Với hai mô hình đã được xuất, quyền chọn mô hình nào để triển khai thuộc về bạn:
`nmt-forge choose export-<run>/model` ghi nhận lựa chọn đó, và `nmt-forge status`
sau đó sẽ nêu tên mô hình đó. Việc chạy dịch vụ thử nghiệm một mô hình được ghi nhận là đã khởi chạy,
chứ không phải là một lựa chọn triển khai. Để đưa mô hình vào một cuộc thi độc lập (sovereign contest),
mục §6 của `DEPLOY.md` liệt kê các tệp tạo thành bài dự thi khai báo (declarative / Làn A) cùng câu lệnh
`mt-eval contest submit-model` chính xác.

Hãy hiểu rõ những gì bạn đang triển khai: một mô hình NMT dịch văn bản; nó **không**
tuân theo các chỉ dẫn (instructions), vì vậy các hướng dẫn về văn phong, tệp chỉ dẫn (coaching files)
và bảng thuật ngữ mà CLI gửi đến các phương thức LLM sẽ bị bỏ qua. Và bản dịch máy của một ngôn ngữ
tài nguyên thấp luôn cần có sự rà soát của người nói thông thạo trước khi bất kỳ nội dung nào đến tay người đọc.

---

## Những gì bạn vừa thực hiện

Bạn đã huấn luyện một mô hình với điểm số mà bạn thực sự có thể tin tưởng: không bị rò rỉ câu trả lời,
checkpoint được chọn mà không cần nhìn trước tập kiểm thử, thanh sai số trên mọi con số,
các dự đoán được ghi lại trước khi có kết quả, phần chẩn đoán chỉ rõ đòn bẩy tiếp theo
thay vì để bạn tự đoán mò — và một mô hình được đóng gói hoàn chỉnh mà CLI có thể gọi
cũng như so sánh trực tiếp với mọi phương pháp khác mà bạn đã đo lường. Đó chính là
toàn bộ mục tiêu — **kết quả trung thực là mặc định, và không đòi hỏi chuyên môn sâu về MT
(hay GPU) để đạt được.**

Khi các con số làm bạn thất vọng (chắc chắn sẽ có lần đầu — mô hình mặc định vốn được
thiết kế là mô hình nhẹ/yếu), hãy chuyển đến
[Chẩn đoán một lượt huấn luyện](/docs/network/getting-started/diagnosing-training) —
tài liệu này tiếp cận theo triệu chứng trước tiên, được viết riêng cho đúng thời điểm đó.
