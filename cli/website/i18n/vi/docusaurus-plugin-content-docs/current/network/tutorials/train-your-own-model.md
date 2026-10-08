---
sidebar_position: 0
title: "Khi bạn muốn tự huấn luyện mô hình của riêng mình"
description: "Hướng dẫn toàn diện từ đầu đến cuối, lấy agent làm trung tâm về việc huấn luyện mô hình dịch thuật cho ngôn ngữ ít tài nguyên bằng nmt-forge — từ python3 -m pip install cho đến mô hình được cung cấp cho champollion CLI. Bạn chỉ đạo một coding agent; các rào chắn bảo vệ sẽ tự động ngăn chặn những sai sót sơ đẳng."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Bạn muốn tự huấn luyện mô hình của riêng mình

Đây là hướng dẫn toàn diện về việc huấn luyện mô hình dịch máy cho một
ngôn ngữ ít tài nguyên — từ trạng thái "Tôi nói ngôn ngữ này nhưng hầu như không có dữ liệu"
đến một mô hình mà bạn có thể báo cáo kết quả một cách trung thực, phục vụ cho ứng dụng của chính bạn thông qua
champollion CLI, và gửi lên [Network](/docs/network/). Huấn luyện chỉ là một
bước trong một hành trình dài hơn (tìm kiếm những gì đang có, đánh giá các lựa chọn, xây dựng
giải pháp tốt hơn, chứng minh hiệu quả, triển khai); [Xây dựng MT cho ngôn ngữ của bạn](/docs/build-mt-for-your-language) là bài viết tổng quan về toàn bộ quy trình này.
Tài liệu này dành cho người mới bắt đầu, và giả định quy trình làm việc hiện đại:
**bạn chỉ đạo một coding agent** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, hoặc tương tự), và agent sẽ chạy các công cụ.

Vì vậy, mỗi bước dưới đây đều có cấu trúc giống nhau:

- 🗣️ **Yêu cầu agent của bạn** — những gì cần hỏi, bằng ngôn ngữ tự nhiên.
- 🛠️ **Công cụ làm gì** — những gì [nmt-forge](/docs/network/getting-started/training-honestly) chạy thay cho bạn, và **hàng rào bảo vệ** (guardrail) giúp phát hiện lỗi kinh điển trước khi nó gây tổn thất cho bạn.
- 👀 **Cách đọc kết quả** — thế nào là "tốt" và những điều cần lưu ý.

:::info[Trước tiên, hãy nắm vững từ vựng]
Nếu các thuật ngữ như *dev set*, *decoding*, *chrF++*, *leakage*, hoặc *round-trip verification* chưa trở nên quen thuộc với bạn, hãy đọc [**Huấn luyện MT bằng ngôn ngữ bình dân**](/docs/network/context/mt-training-concepts) trước — tài liệu này định nghĩa mọi từ ngữ được sử dụng ở đây kèm theo ví dụ thực tế. Trang này sẽ dựa trên tất cả các khái niệm đó.
:::

:::note[Sự trung thực là tính năng, không phải rào cản]
Công cụ này được thiết kế có chủ ý rõ ràng. Các hàng rào bảo vệ của nó tự động hóa việc ngăn chặn những sai lầm thực tế, đã được đo lường từ một dự án thực tế — vì vậy con đường trung thực là mặc định, và các lối tắt không trung thực sẽ **bị từ chối kèm theo thông báo chỉ rõ cách khắc phục**. Khi bạn thấy một thông báo từ chối trong hướng dẫn này, đó là lúc công cụ đang làm đúng nhiệm vụ của nó. Bạn chắc chắn sẽ muốn như vậy.
:::

---

## Những gì bạn cần trước khi bắt đầu

- **Một coding agent** có quyền truy cập terminal và hệ thống tệp. Đây là bên điều phối chính.
- **Một số câu dịch thực tế** cho cặp ngôn ngữ của bạn — ngay cả vài trăm
  cặp câu do con người dịch cũng là một khởi đầu khả thi. Sách giáo khoa song ngữ, kho lưu trữ
  cộng đồng, hồ sơ công khai đã dịch, tài liệu giáo dục. Chất lượng quan trọng hơn
  số lượng.
- **Tùy chọn nhưng rất hữu ích:** văn bản đơn ngữ trong ngôn ngữ đích của bạn, một
  từ điển song ngữ, một ngữ pháp tham khảo đã xuất bản, và một bộ phân tích
  hình thái học (FST). Bạn **không** cần tất cả những thứ này để bắt đầu — công cụ sẽ cho
  bạn biết chính xác tài nguyên nào đang có và tài nguyên nào mở khóa những khả năng nào.
- **Tài nguyên tính toán:** một chiếc laptop. Các rào chắn (guardrails), phân chia dữ liệu, tổng hợp dữ liệu, kiểm toán rò rỉ và
  chấm điểm đều chạy trên CPU, và quá trình huấn luyện mô hình mặc định (một transformer
  nhỏ được huấn luyện từ đầu) cũng vậy. GPU chỉ cần thiết nếu bạn chọn
  preset lớn nhất (`nllb-600m`) — xem [Bước 5](#step-5--train).

> 🗣️ **Nói với agent của bạn:** *"Hãy cài đặt nmt-forge cùng với gói mở rộng huấn luyện của nó
> (`python3 -m pip install 'nmt-forge[hf]'`) và xác nhận lệnh `nmt-forge` chạy được.
> Chúng ta sẽ huấn luyện một mô hình dịch từ tiếng Anh → \<your language\>,
> một cách trung thực."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

Gói mở rộng `[hf]` là ngăn xếp huấn luyện (torch, transformers, accelerate,
tokenizers, sentencepiece, peft); các bản build wheel chỉ dùng CPU hoàn toàn đáp ứng tốt. Không cần
thêm bất cứ thứ gì khác — không cần clone kho lưu trữ Champollion. Mọi lệnh đều nhận `--json`
(một tài liệu JSON trên stdout; một từ chối sẽ trả về dưới dạng `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` chỉ ra lệnh tiếp theo tại
bất kỳ thời điểm nào.

Agent của bạn có thể gọi công cụ `get_training_guardrails` của MCP server Champollion (không có đối số; tùy chọn `topic`)
để nạp toàn bộ bộ quy tắc — mười rào chắn và lỗi sai mà mỗi rào chắn loại bỏ —
vào ngữ cảnh của chính nó trước khi viết bất kỳ lệnh nào. Nếu bạn đang điều phối agent,
hãy yêu cầu nó thực hiện việc này trước.

---

## Bước 1 — Chọn một ngôn ngữ và xem những gì thực sự tồn tại

Mọi dự án đều bắt đầu bằng việc hỏi chỉ mục xem ngôn ngữ đó *có* những gì, một cách trung thực.

> 🗣️ **Yêu cầu agent của bạn:** *"Chạy `nmt-forge discover` cho mã ISO 639-3 của ngôn ngữ đích của tôi và tóm tắt những dữ liệu nào đang tồn tại và những gì còn thiếu."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Công cụ này làm gì.** Nó đọc **card** Champollion của ngôn ngữ —
nguồn chân lý duy nhất cho những gì đã biết về ngôn ngữ đó — và báo cáo các
hệ chữ viết, bộ phân tích hình thái học, từ điển, kho ngữ liệu và tập dữ liệu đánh giá mà
nó ghi nhận, sau đó xếp ngôn ngữ vào **thang tài sản** (asset ladder). (Các card đến từ một
thư mục bạn chỉ định bằng `--cards-dir`, một bản checkout cục bộ hoặc
`node_modules/champollion`, hoặc chỉ mục card công khai — đã được lưu vào bộ nhớ cache nên sẽ hoạt động
ngoại tuyến sau lần tải đầu tiên. Khi ngoại tuyến mà không có cache, hãy xuất card bằng
`champollion network card <code> --json` vào một thư mục và truyền `--cards-dir`.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Cách đọc kết quả.** Các dấu `✓` là những gì bạn có thể làm ngay bây giờ; các dấu `?`
là các bậc thang đang chờ tài sản. Quan trọng nhất, **sự vắng mặt trên card có nghĩa là
*chưa biết*, chứ không bao giờ có nghĩa là "ngôn ngữ này không có gì cả."** Một card thưa thớt thông tin
là lời mời gọi bổ sung những gì bạn biết, chứ không phải ngõ cụt — và ngay cả một card trống trơn cũng giúp
bạn có được vòng lặp huấn luyện đầy đủ rào chắn ở bậc 1. Một card phong phú (như Plains Cree) sẽ tự động kích hoạt
các bậc thang cao hơn: các tập đánh giá của nó được gắn cờ **NEVER TRAIN ON THIS** (TUYỆT ĐỐI KHÔNG HUẤN LUYỆN TRÊN TẬP NÀY), và
trọng tài (referee) dành riêng cho ngôn ngữ đó đã sẵn sàng để tích hợp. Bậc 5 chỉ được đánh dấu khi
gói của trọng tài đó được cài đặt tại đây; nếu không, nó sẽ hiển thị ✗ *UNAVAILABLE*
kèm theo lệnh cài đặt — và trọng tài sẽ không bao giờ được nạp cho một tập kiểm tra chỉ dùng cục bộ hoặc
bị niêm phong (sealed), vì nó có thể tra cứu từ trên một dịch vụ bên ngoài.

Sau đó, khởi tạo khung (scaffold) dự án:

> 🗣️ **Yêu cầu agent của bạn:** *"Khởi tạo khung dự án với `nmt-forge init` cho cặp ngôn ngữ này và đọc cho tôi tệp `NEXT_STEPS.md` mà nó tạo ra."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Lệnh này tạo ra một không gian làm việc (một thư mục `.forge/` mà mọi rào chắn
đều tham chiếu), một **cấu hình khởi đầu**, và một bản tóm tắt `NEXT_STEPS.md` được viết cho *bạn
và agent của bạn* — thứ tự lệnh, thang tài sản cho ngôn ngữ của bạn, và
các nguyên tắc bất biến. Đây là bản đồ dẫn đường cho mọi bước bên dưới. Các đường dẫn trong tệp
cấu hình là tương đối, vì vậy hãy chạy forge từ bên trong thư mục dự án.

`init` cũng chọn **mô hình** mà bạn sẽ huấn luyện (`--model`, được ghi thành
các con số cụ thể trong `config.json`): `cpu-tiny` theo mặc định, `cpu-finetune --base
<hf-id>`, or `nllb-600m`. [Bước 5](#step-5--train) giải thích rõ lựa chọn này. Nếu
ngôn ngữ của bạn chưa có card, `nmt-forge init <code> --no-card --name "<name>"`
vẫn sẽ dựng khung dự án — mọi dữ kiện card đều được ghi nhận là chưa biết, không có gì
bị tự ý tạo ra.

---

## Bước 2 — Trỏ đến bộ phân tích và từ điển (nếu bạn có)

Bước này liên quan đến **nấc thang 3–4** của thang tài sản. Nếu ngôn ngữ của bạn không có bộ phân tích, hãy bỏ qua và chuyển đến [Bước 4](#step-4--split-your-real-data-safely) — bạn sẽ chỉ huấn luyện trên dữ liệu thực tế (và dịch ngược), đây là một lộ trình hoàn toàn hợp lệ.

Nếu bộ phân tích và từ điển *thực sự* tồn tại, chúng sẽ mở khóa khả năng *sản xuất* dữ liệu huấn luyện đã được xác minh — đòn bẩy lớn nhất đối với một ngôn ngữ có ít văn bản song ngữ.

> 🗣️ **Yêu cầu agent của bạn:** *"Thẻ ghi nhận một bộ phân tích hình thái và một từ điển cho ngôn ngữ này. Hãy tải chúng theo hướng dẫn cài đặt trên thẻ, trỏ gói ngôn ngữ (language pack) đến chúng thông qua các biến môi trường đã được tài liệu hóa, và xác nhận bộ phân tích có thể xác minh hai chiều (round-trip) một vài từ đã biết."*

🛠️ **Công cụ làm gì — và ranh giới mà nó sẽ không vượt qua.** Các bộ phân tích (FST) và từ điển là **các công cụ riêng biệt do người dùng tự tải về theo giấy phép riêng của chúng**. Bộ công cụ **không bao giờ đóng gói sẵn hoặc phân phối lại chúng** — nó chỉ hướng dẫn bạn nơi tải và giấy phép của chúng là gì, và bạn tự tải về. Đây không phải là thủ tục hành chính rườm rà: nhiều tài nguyên ngôn ngữ mang những ràng buộc thực tế về quyền hạn và chủ quyền, và công cụ này tôn trọng điều đó ngay từ thiết kế.

Thành phần kết nối là một **gói ngôn ngữ (language pack)**: một plugin nhỏ giúp điều chỉnh bộ phân tích, từ điển, quy tắc chính tả và các mẫu câu trích dẫn ngữ pháp của *bạn* tương thích với công cụ. Bản thân bộ công cụ **không** đi kèm bất kỳ gói ngôn ngữ nào — các gói này tồn tại cùng với ngôn ngữ của chúng (ví dụ: gói Plains Cree nằm trong dự án riêng của nó và được cắm vào thông qua đường dẫn mô-đun).

👀 **Cách đọc kết quả.** Bạn muốn bộ phân tích thực hiện **xác minh hai chiều (round-trip)**: viết ra một dạng từ, đưa cách viết đó ngược trở lại, và nhận được cùng một thẻ ngữ pháp. Nếu không, hàm **chuẩn hóa (canonicalizer)** của gói ngôn ngữ — hàm duy nhất chuẩn hóa chính tả bất cứ khi nào hai thành phần gặp nhau — có lẽ cần thêm một quy tắc. Việc làm đúng điều này rất quan trọng: một ký tự chưa được đối chiếu duy nhất (`ý` so với `y`) từng âm thầm xóa bỏ 1.375 động từ khỏi một quy trình tạo dữ liệu trong nhiều tuần. Tính năng **kiểm định phễu (funnel audit)** của công cụ sẽ đếm chính xác số lượng dữ liệu còn sót lại ở mỗi giai đoạn để lỗi biến mất âm thầm như vậy không thể ẩn giấu.

---

## Bước 3 — Tổng hợp dữ liệu huấn luyện từ các quy tắc ngữ pháp

Với một bộ phân tích + từ điển + một gói các mẫu câu trích dẫn ngữ pháp, bạn can sản xuất hàng trăm nghìn cặp câu đã được xác minh.

> 🗣️ **Yêu cầu agent của bạn:** *"Tạo dữ liệu huấn luyện tổng hợp bằng `nmt-forge synth` bằng cách sử dụng gói ngôn ngữ của chúng ta, sau đó hiển thị cho tôi báo cáo độ bao phủ."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Công cụ làm gì — luật xuất dữ liệu (emit law).** Mỗi hàng dữ liệu đầu ra phải thỏa mãn các quy tắc mà không gói ngôn ngữ nào có thể bỏ qua:

- **Được xác minh hai chiều (Round-trip verified)** — mọi từ được tạo ra đều phải vượt qua bước *tạo → phân tích → cùng kết quả phân tích*, nếu không hàng đó sẽ bị loại bỏ. Không có dạng từ chưa xác minh nào được phép xuất ra.
- **Được trích dẫn ngữ pháp (Grammar-cited)** — mọi loại mẫu câu đều phải trích dẫn tài liệu ngữ pháp đã xuất bản mà nó mô phỏng. Các mẫu câu không có trích dẫn sẽ không tồn tại; mã nguồn sẽ từ chối tải chúng.
- **Được kiểm tra độ bao phủ (Coverage-checked)** — các mẫu câu được đối chiếu với một danh sách kiểm tra các hiện tượng ngữ pháp bắt buộc (câu mệnh lệnh, câu hỏi, sở hữu, dạng nghịch đảo...). Nếu một hiện tượng *bắt buộc* có không ví dụ nào, quá trình xây dựng sẽ thất bại. Đây là chốt chặn chống lại bẫy "một triệu câu nhưng chỉ có vài cấu trúc lặp đi lặp lại" — số lượng lớn che giấu các lỗ hổng cấu trúc.
- **Được đóng dấu nguồn gốc (Provenance-stamped)** — mọi hàng dữ liệu tổng hợp đều được đánh dấu `synthetic: true`. Con dấu này có vai trò chịu lực: hệ thống đăng ký sẽ **từ chối** đăng ký các hàng dữ liệu tổng hợp làm tập kiểm thử (test set). Tập kiểm thử chỉ được phép chứa dữ liệu thực tế.

👀 **Cách đọc kết quả.** Hãy xem báo cáo độ bao phủ để tìm **các mục bắt buộc có độ bao phủ bằng không** (một hiện tượng ngữ pháp mà các mẫu câu của bạn chưa bao giờ tạo ra) và xem **phân phối loại mẫu câu (kind distribution)** — nếu có hai dạng mẫu câu chiếm ưu thế, giới hạn cho mỗi loại của bộ lấy mẫu (mặc định là 15%) sẽ cân bằng lại chúng để không một mẫu đơn lẻ nào chiếm tới một nửa trải nghiệm học của mô hình.

:::tip[Không có bộ phân tích? Hãy dùng dịch ngược (backtranslation)]
Nếu bạn không thể tổng hợp dữ liệu từ quy tắc nhưng bạn có văn bản **đơn ngữ** của ngôn ngữ
đích, hãy yêu cầu agent sử dụng luồng **dịch ngược (backtranslation)**: công cụ sẽ dịch máy
văn bản đơn ngữ của bạn *sang* tiếng Anh bằng một mô hình đảo ngược do bạn cung cấp và ghép
từng kết quả với câu đích **thực tế**. Phía ngôn ngữ đích vẫn giữ được độ chuẩn xác nguyên bản.
Đây là một lệnh gọi thư viện Python (`nmt_forge.training.backtranslation.backtranslate`),
không phải là lệnh phụ CLI: agent của bạn sẽ viết một đoạn script ngắn bọc quanh lệnh gọi này và thêm
tệp đầu ra đã gắn thẻ vào các luồng `data.synthetic` của tệp cấu hình. Lệnh gọi này
**sẽ kiểm toán rò rỉ văn bản đơn ngữ trước** — bởi vì văn bản đó có thể vô tình *chính là*
dữ liệu đánh giá của bạn. Xem
[Hướng dẫn thực hành Dịch ngược](/docs/network/tutorials/back-translation).
:::

---

## Bước 4 — Chia tách dữ liệu thực tế của bạn một cách an toàn

Bây giờ hãy lấy các cặp câu **thực tế** của bạn và để riêng ra những câu mà bạn sẽ dùng để
đánh giá mọi thứ. Đây là nơi ẩn náu của sai lầm gây phá hỏng kết quả nhiều nhất trong
MT cho ngôn ngữ ít tài nguyên, và cũng là nơi rào chắn phát huy trọn vẹn giá trị của mình.

Các tệp của bạn có thể ở định dạng `.tsv` (nguồn, dấu TAB, sau đó là bản dịch, mỗi dòng một
cặp câu; các dòng bắt đầu bằng `# ` là chú thích) hoặc `.jsonl` (mỗi dòng một đối tượng `{"source": …,
"target": …}`).

**Nếu bạn đã có một tập kiểm tra (test set)** — đã được giáo viên kiểm tra, y tá kiểm tra, hoặc mang tính riêng tư —
hãy giữ nó trong một tệp riêng biệt, đăng ký nó, sàng lọc kho ngữ liệu đối chiếu với nó, và
chỉ trích xuất tập huấn luyện (train) và tập phát triển (dev):

> 🗣️ **Nói với agent của bạn:** *"Hãy đăng ký tập test của chúng ta, kiểm toán rò rỉ kho ngữ liệu
> đối chiếu với tập test đó, sau đó chia kho ngữ liệu đã làm sạch thành train và dev bằng
> `nmt-forge split`, đảm bảo tách rời theo nhóm (group-disjoint), với một seed cố định."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Nếu bạn chưa có**, hãy trích xuất tập test từ kho ngữ liệu trong cùng bước này:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **Công cụ này làm gì — rào chắn phân chia (split-guard).** Nó thực hiện **phân chia
tách rời theo nhóm (group-disjoint splitting)**: mọi cặp câu có chung câu nguồn *hoặc* câu đích đều được
nhóm lại thành một, và toàn bộ mỗi nhóm sẽ nằm trọn vẹn ở một phía. Sau đó, nó **xác minh không có
bất kỳ sự trùng lặp nào** và từ chối tiếp tục nếu có trùng lặp:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Cơ chế này loại bỏ hoàn toàn **lỗ rò rỉ kiểu "Feed him" / "Feed her"**: một cuốn sách giáo khoa ánh xạ cả hai câu
luyện tập tiếng Anh này sang cùng một từ đích (`asam`); cách phân chia ngẫu nhiên ngây thơ sẽ đưa một bản sao vào train
và bản sao song sinh của nó vào test, khiến mô hình "vượt qua bài kiểm tra" nhờ học vẹt theo trí nhớ. Trong một dự án thực tế, 17
trên tổng số 54 hàng kiểm tra đã bị rò rỉ theo cách này và đạt điểm 83 so với 44 ở các hàng sạch — và mọi
kết luận dựa trên con số đó đều vô giá trị. `--register project` ghi nhận tập dev
(và tập test khi được trích xuất) dưới dạng `project-dev` / `project-test` —
các tên mà cấu hình khởi đầu đã trỏ sẵn vào — nhờ đó mọi lệnh tiếp theo đều biết rằng
chúng là *các tập đánh giá tuyệt đối không được huấn luyện trên đó*. Khi một tập test đã
được đăng ký từ trước, `split` cũng sàng lọc ngay các tệp train và dev mới tạo đối chiếu với tập test đó tại chỗ.

🛠️ **Và kiểm toán rò rỉ (leak-audit).** `leak-audit` sàng lọc các hàng đối chiếu với mọi tập đánh giá đã đăng ký
và cho biết, kèm theo ví dụ từ chính kho ngữ liệu của bạn, những gì nó sẽ **loại bỏ** —
một hàng có câu nguồn giống hệt câu nhắc kiểm tra (ngay cả khi bản dịch
khác nhau), một hàng có câu đích giống hệt câu trả lời kiểm tra, và một hàng có
câu đích gần như trùng lặp với câu trả lời kiểm tra (nó chứa câu trả lời, là một phần của câu trả lời,
hoặc giống ít nhất 90% khi đã chuẩn hóa dấu) — cùng những gì nó
**chủ ý giữ lại**: *các câu mẫu tương đồng (template siblings)* dùng chung khung câu nhưng chỉ thay đổi
một từ (*"Tôi thấy con chó"* / *"Tôi thấy con mèo"*), và các câu nhắc gần trùng lặp nhưng có
câu trả lời khác nhau. Các hàng kiểm tra có mẫu tương đồng trong tập huấn luyện sẽ được
liệt kê, và — vì cấu hình khởi đầu đặt `eval.near_dupe_corpus` trỏ tới tệp huấn luyện của bạn —
báo cáo cuối cùng sẽ chấm điểm riêng các hàng kiểm tra *không có* mẫu tương đồng,
dưới dạng điểm "(strict)" (nghiêm ngặt), giúp nhận diện rõ mức độ lạc quan ảo mà các mẫu tương đồng mang lại.
Khi phần lớn các hàng kiểm tra có mẫu tương đồng và tập kiểm tra là cố định,
`--clean-to <file> --drop-test-twins` cũng sẽ loại bỏ các bản sao huấn luyện đó (nó
báo cáo tập con nghiêm ngặt trước và sau, và từ chối nếu thao tác làm rỗng tập huấn luyện).
Hãy cung cấp cho nó một tệp riêng (`corpus.notwins.jsonl`): đây là kho ngữ liệu của
mô hình sạch hoàn toàn bản sao, đặt cạnh kho ngữ liệu đầy đủ, và leak-audit từ chối ghi
đè lên bất kỳ tệp nào mà một tệp cấu hình, một lần chạy hoặc một lần phân chia đang đọc.
Kết quả hoàn toàn có tính tất định, và nội dung văn bản của chính tệp
kiểm tra không bao giờ bị in ra.

👀 **Cách đọc kết quả.** Bạn muốn thấy dòng **verified: 0 shared** (đã xác minh: 0 chia sẻ). Nếu thay vào đó bạn nhận được một thông báo `SplitLeakageError`, đừng xóa các hàng bằng tay — việc đó chỉ làm xáo trộn lại vấn đề. Hãy chạy lại bước chia tách nhóm không giao nhau; đó mới là cách khắc phục, và thông báo lỗi cũng chỉ rõ điều đó.

:::danger[Không bao giờ huấn luyện trên một benchmark]
Nếu bạn lấy một tập dữ liệu đánh giá từ hệ thống đăng ký chung (`nmt-forge registry add-harness`), công cụ sẽ đóng dấu và coi nó là vùng cấm đối với việc huấn luyện — **mọi** benchmark trong hệ thống đăng ký đều được gắn cờ *do-not-train* (không huấn luyện). Hãy tinh chỉnh (fine-tune) trên bất kỳ dữ liệu nào bạn có một cách hợp pháp; chỉ là không bao giờ được huấn luyện trên tập test. Đây là [quy tắc duy nhất](/docs/network/leaderboard/rules) của toàn bộ Mạng lưới.
:::

---

## Bước 5 — Huấn luyện

Một tệp cấu hình mô tả toàn bộ lần chạy; một lệnh thực thi lần chạy đó,
đảm bảo tính tái lập. `nmt-forge init` đã tạo sẵn tệp này.

> 🗣️ **Nói với agent của bạn:** *"Hãy đọc `config.json`, thêm luồng dữ liệu tổng hợp nếu chúng ta
> đã tạo, chạy `nmt-forge preflight run --config config.json`, khắc phục bất kỳ vấn đề nào được
> cảnh báo, sau đó chạy `nmt-forge run config.json` và theo dõi chẩn đoán
> tiến trình (schedule diagnostics)."*

Một đoạn trích từ cấu hình khởi đầu, với mô hình `cpu-tiny` mặc định và một
luồng dữ liệu tổng hợp đã được thêm vào:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Nên chọn mô hình nào?** Hãy chọn khi bạn chạy `init` (`--model`); mọi thông số đều được ghi vào
`config.json`:

| preset | định nghĩa | yêu cầu | kỳ vọng thực tế |
|---|---|---|---|
| `cpu-tiny` (mặc định) | một transformer nhỏ (~6M tham số) được huấn luyện từ đầu; từ vựng của nó chỉ được học từ các hàng **huấn luyện** của bạn | CPU laptop, không cần tải xuống | yếu: với 1–2 nghìn cặp câu, chrF++ khoảng 5–30 (mức cao chỉ đạt được với dữ liệu có tính khuôn mẫu cao) — chỉ học được các cụm từ và mẫu câu trong dữ liệu của bạn, không dịch được tổng quát |
| `cpu-finetune --base <hf-id>` | tinh chỉnh một mô hình Marian/opus-mt tiền huấn luyện nhỏ do bạn chỉ định — hãy chọn mô hình cho một cặp ngôn ngữ *có liên quan* | CPU, tải xuống ~300 MB | thường tốt hơn `cpu-tiny` khi có sẵn một cặp ngôn ngữ liên quan — hãy đo lường trên tập dev, đừng phỏng đoán |
| `nllb-600m` | NLLB-200 distilled 600M kết hợp LoRA | GPU, tải xuống ~2.5 GB | điểm khởi đầu mạnh mẽ nhất; trên CPU, bước kiểm tra thời gian thực tế sẽ từ chối trong vòng vài phút |

Mục đích của `cpu-tiny` không nằm ở điểm số của nó. Nó hiện thực hóa **toàn bộ** vòng lặp —
hàng rào bảo vệ, các đợt kiểm toán, bài kiểm tra đăng ký trước, một mô hình mà CLI có thể gọi — để
sau này một mô hình tốt hơn có thể đưa vào cùng dự án đó và được đo lường theo cách y hệt.

`preflight` liệt kê mọi cửa kiểm soát mà lần chạy sẽ đi qua, ✓ hoặc ✗, kèm theo cách khắc phục cho từng ✗
— bao gồm cả việc gói mở rộng huấn luyện đã được cài đặt hay chưa
(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **Công cụ làm gì — bốn hàng rào bảo vệ cùng một lúc.**

- **Kiểm toán rò rỉ trước khi huấn luyện.** *Mọi* luồng dữ liệu — chuẩn (gold), tổng hợp (synthetic), và bất kỳ
  văn bản dịch ngược nào — đều được sàng lọc đối chiếu với *mọi* tập test đã đăng ký và
  tập niêm phong. Rò rỉ câu trả lời (câu nhắc hoặc câu trả lời giống hệt, câu trả lời gần như trùng lặp) và
  việc trùng lặp nguyên cả tệp đều bị coi là lỗi nghiêm trọng; các mẫu tương đồng được giữ lại và báo cáo
  (`--drop-test-twins` sẽ loại bỏ chúng đối với một tập test cố định).
  Không có gì được huấn luyện cho đến khi tập kết hợp hoàn toàn sạch sẽ.
- **Hàng rào tập dev (Dev-fence).** Quá trình huấn luyện **từ chối bắt đầu nếu không có tập dev đã đăng ký**, và
  nó sẽ chỉ chọn checkpoint dựa trên tập dev đó — tuyệt đối không dùng tập test.
  (Nó thậm chí còn kiểm tra nội dung các hàng của dev đối chiếu với các tập test để phát hiện
  mánh khóe `cp test.jsonl dev.jsonl`.) Việc chọn checkpoint có thể dùng **loss** trên tập dev hoặc
  một **chỉ số sinh văn bản** trên tập dev — giải mã tập dev và chấm điểm đầu ra thực tế,
  vốn là tín hiệu trung thực hơn (cấu hình khởi đầu sử dụng chrF++ trên đầu ra dev đã giải mã).
- **Kiểm soát tính hợp lý của lịch trình (Schedule-sanity).** Nếu tập kết hợp của bạn có nhiều dữ liệu tổng hợp, công cụ sẽ *suy ra* một
  ngưỡng dừng tối thiểu từ kích thước tập kết hợp và duy trì huấn luyện qua giai đoạn
  **bão hòa (plateau)** — giai đoạn mà mô hình đã hoàn thành phần học dữ liệu tổng hợp dễ dàng
  nhưng chưa chuyển hóa thành chất lượng thực tế. Điều này ngăn chặn tình trạng "dừng sớm nửa vời" (half-epoch death),
  khi cơ chế early stopping ngây thơ dừng lại ở một phần hai mươi kế hoạch. Tần suất đánh giá
  tập dev cũng được suy ra từ kích thước lần chạy, nhờ đó một lần chạy nhỏ vẫn được đánh giá đầy đủ.
  Mọi can thiệp đều in ra quỹ đạo dev-loss và lý do bằng ngôn ngữ dễ hiểu.
- **Tính toán mức độ tiếp xúc + gắn thẻ dữ liệu tổng hợp.** Dữ liệu chuẩn được tăng trọng số (lặp lại) để
  lượng dữ liệu thực tế ít ỏi không bị lấn át; bản kê khai (manifest) ghi lại **mức độ tiếp xúc
  hiệu dụng trên mỗi câu duy nhất** để việc thử nghiệm A/B luôn công bằng. Nguồn tổng hợp mang
  thẻ định danh; dữ liệu chuẩn không gắn thẻ để giữ vai trò định hình phong cách đầu ra.

Huấn luyện là bước duy nhất mất nhiều thời gian. Agent của bạn nên chạy nó dưới
nền, xuất kết quả ra một tệp nhật ký (log) và theo dõi các dòng quan trọng
(`refused`, `Error`, `wall-clock`, `RUN EXIT`) thay vì liên tục thăm dò trạng thái. Một bảng điều khiển trực tiếp
với các đường cong loss và nút dừng sẽ mở ra cho **bạn** (tại
`http://127.0.0.1:8377` khi cổng đó còn trống). Trong vài phút đầu tiên, forge sẽ đo tốc độ
huấn luyện và in ra ước tính thời gian thực tế, ban đầu là ước tính sớm, sau đó là
ước tính ở trạng thái ổn định. `init` không đặt sẵn hạn mức thời gian, vì hạn mức là con số của bạn,
không phải do công cụ tự nghĩ ra. Hãy đọc ước tính, quyết định khoảng thời gian bạn chấp nhận,
và thêm `"time_budget_hours": <hours>` vào `config.json` dưới mục `model`. Kể từ
đó, forge sẽ từ chối những lần chạy không thể hoàn thành trong khoảng thời gian đó, giúp các lần chạy sai cấu hình
thất bại sớm. Cho đến khi bạn thiết lập hạn mức, chỉ có mức trần an toàn của forge được áp dụng: nó sẽ dừng
một lần chạy kéo dài nhiều ngày, và mọi ước tính sẽ in ra dưới dạng "no budget set;
… ceiling", chứ không phải là hạn mức do ai đó chỉ định.

👀 **Cách đọc kết quả.** Lần chạy sẽ in ra một **báo cáo dev kèm theo khoảng
tin cậy** — không bao giờ có đầu ra là một điểm số trần trụi — và sau đó là lệnh tiếp theo (các
con số dưới đây chỉ mang tính minh họa):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Nếu bạn thấy một thông báo `schedule-sanity` giải thích rằng nó đã *giữ* quá trình huấn luyện vượt qua điểm dừng sớm, đó là lúc chốt chặn vùng bình nguyên đang hoạt động tốt. Lượt chạy cũng ghi lại một **tệp kê khai (manifest)**: hash cấu hình, hash tệp dữ liệu, các seed và tiến trình được suy ra, nhờ đó toàn bộ lượt chạy có thể được tái lặp.

---

## Bước 6 — Đánh giá một cách trung thực

Bạn đã có một mô hình. Trước khi bạn chấm điểm nó trên tập test, bạn phải viết ra những gì mình kỳ vọng — *trước tiên*.

> 🗣️ **Nói với agent của bạn:** *"Hãy viết một bản đăng ký trước (preregistration) cho việc chấm điểm tập test —
> chỉ số dự đoán, hướng thay đổi và biên độ, kèm theo một dòng lý do — sau đó
> xuất lần chạy, thao tác này sẽ chấm điểm tập test một lần duy nhất."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` chỉ định bản đăng ký trước dùng để đánh giá mô hình này. Nếu chỉ có một bản trên
tập test, export sẽ tự tìm thấy nó; nếu có mô hình thứ hai cùng bản đăng ký trước riêng của nó
trên cùng một tập test, export sẽ từ chối đoán, vì vậy bạn cần chỉ định rõ từng bản.

(Việc đăng ký trước có thể thực hiện bất kỳ lúc nào trước lần chấm điểm test đầu tiên — `nmt-forge
status` sẽ yêu cầu điều này trước khi huấn luyện.)

🛠️ **Công cụ làm gì — các chốt chặn chống thêu dệt câu chuyện (anti-storytelling guards).**

- **Đăng ký trước (Preregistration).** Việc chấm điểm một tập **test** đã đăng ký đòi hỏi
  phải có một bản đăng ký trước được viết *trước khi* xem kết quả lần đầu. Tệp dự đoán là một
  mảng JSON: mỗi dự đoán nêu rõ một chỉ số và cơ sở lập luận, cộng với hướng thay đổi
  so với baseline (được kiểm tra tự động bởi `nmt-forge prereg check`) hoặc một kỳ vọng dạng văn bản
  tự do do con người kiểm tra. Mẫu chưa chỉnh sửa, Markdown và văn xuôi đều sẽ bị từ chối
  kèm theo định dạng yêu cầu và cách khắc phục. Nếu không có bản đăng ký trước,
  việc chấm điểm sẽ đơn giản là **bị từ chối**:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  Đây là cơ chế ngăn chặn việc ngụy trang những suy đoán hồi tố ("tất nhiên là nó cải thiện trên
  truyện kể dân gian rồi") thành những dự đoán từ trước. Việc ghi lại cả những phán đoán *thất bại* chính là
  yếu tố làm cho những phán đoán thành công trở nên đáng tin cậy.
- **Luôn luôn có khoảng tin cậy.** Mọi điểm số đều hiển thị cùng khoảng tin cậy bootstrap 95%
  (CI); không có đầu ra nào thiếu CI. Một mức tăng `+0.5` mà các khoảng tin cậy chồng lấn lên nhau thì không
  được coi là một bước tiến.
- **Sổ cái đánh giá (eval-ledger).** Mọi lượt đọc của từng tập đánh giá đều được ghi nhật ký (chỉ thêm mới,
  có bằng chứng chống can thiệp). Hãy hỏi `nmt-forge ledger show --set project-test` để biết một
  tập dữ liệu đã "hao mòn" đến mức nào. Các tập **niêm phong (sealed)** chỉ dùng một lần — chấm điểm một lần rồi đóng lại (lệnh
  `export` lần thứ hai sẽ bị từ chối; `--no-eval` sẽ đóng gói mà không chấm điểm lại).

`export` giải mã tập test bằng checkpoint được chọn từ dev, chấm điểm và
nối thêm phần **Chẩn đoán & Khuyến nghị (Diagnosis & Recommendations)** bằng ngôn ngữ thông thường. Lệnh này cũng
ghi kết quả dưới dạng **báo cáo mt-eval** (`export/evaluation/`), giúp `mt-eval
compare` đặt mô hình của bạn cạnh bất kỳ phương pháp nào khác được đo lường bằng bộ công cụ trên
cùng một tập test, đồng thời đóng gói chính mô hình đó (Bước 8) vào `export/model/` —
nơi không chứa bất kỳ câu test nào. `export/evaluation/` chứa các câu
test của bạn: tuyệt đối không sao chép nó cùng với mô hình, và hãy lưu giữ nó cùng với tập test. `nmt-forge evaluate <run-manifest>` là phần chỉ chấm điểm,
dùng khi bạn không muốn tạo gói đóng gói.

👀 **Cách đọc kết quả.** Hãy đọc con số **kèm theo khoảng tin cậy và theo từng
văn phong (register)**, xem điểm "(strict)" nếu dữ liệu huấn luyện của bạn dùng chung mẫu
câu với tập test, và kiểm tra xem **chỉ số nào đáng tin cậy** trước khi
vội ăn mừng. Để chấm điểm tệp đầu ra của một hệ thống khác trên cùng một tập đã đăng ký,
với nhiều chỉ số hơn:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` hiển thị **độ tin cậy đã được đo lường** của từng chỉ số đối với ngữ hệ của bạn (từ các đánh giá meta của WMT). Đối với một số ngữ hệ, một chỉ số như BLEU hầu như không bám sát đánh giá của con người trong khi COMET lại làm được; đối với nhiều ngữ hệ nghèo tài nguyên, câu trả lời trung thực là *chưa được đo lường* — trong trường hợp đó, đánh giá của người bản xứ, chứ không phải bất kỳ con số tự động nào, mới là tín hiệu thực tế. Xem [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability).

:::tip[Trọng tài riêng của ngôn ngữ của bạn]
Nếu ngôn ngữ của bạn có tiêu chuẩn đánh giá LYSS (một công cụ linter biết rằng, ví dụ, hai cách viết chỉ khác nhau bởi một quy ước nguyên âm dài đã được tài liệu hóa), hãy tích hợp nó bằng `--plugin` và nó sẽ chấm điểm song song với chrF++ — thậm chí có thể *chọn* các checkpoint, nhờ đó mô hình chiến thắng sẽ là mô hình được chính trọng tài của ngôn ngữ đó ưu tiên. Mọi con số từ plugin cũng đều có khoảng tin cậy đi kèm.
:::

---

## Bước 7 — Lặp lại (Iterate)

Bây giờ bạn tiến hành cải tiến — và mọi cải tiến đều được đo lường theo cùng một cách trung thực.

> 🗣️ **Nói với agent của bạn:** *"Hãy thay đổi một thứ — thêm một loại mẫu câu / thêm dữ liệu
> dịch ngược / thử một preset mô hình khác — huấn luyện lại, và kiểm thử A/B đối chiếu với
> lần chạy trước trên tập dev, có kiểm định ý nghĩa thống kê."*

Mỗi lần chạy đã in sẵn điểm số trên tập dev cùng với khoảng tin cậy. Đối với bài kiểm định
theo cặp, hãy giải mã tập dev với từng lần chạy — `nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` là
bản sao cấu hình của bạn có `eval.battery` là `project-dev` — sau đó:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **Công cụ làm gì.** `compare` chạy một **phép kiểm thử ý nghĩa thống kê theo cặp (paired significance test)**, chứ không chỉ là một phép trừ đơn thuần, nhờ đó khẳng định "B vượt trội hơn A" là một tuyên bố được số liệu thống kê hỗ trợ — chứ không phải là nhiễu. Hãy lặp lại trên tập **dev** (đó là mục đích của tập này); giữ tập **test** cho các lần kiểm tra không thường xuyên và đã được đăng ký trước; giữ bất kỳ tập **được niêm phong (sealed)** nào cho bước cuối cùng.

👀 **Cách đọc kết quả.** Một cải tiến thực sự sẽ vượt qua khoảng tin cậy của nó *và* phép kiểm thử ý nghĩa thống kê. Nếu không, dù sao bạn cũng đã học được một điều gì đó — rằng đòn bẩy đó yếu hơn bạn kỳ vọng, điều này rất đáng để biết. Các chốt chặn vùng bình nguyên/độ bao phủ/rò rỉ đồng nghĩa với việc các con số bạn đang so sánh là đáng tin cậy, vì vậy bạn thực sự có thể tin tưởng vào chu trình lặp lại của chính mình.

Các đòn bẩy tiếp theo phổ biến, được sắp xếp sơ bộ theo thứ tự hiệu quả mang lại cho một ngôn ngữ khan hiếm dữ liệu:

1. **Thêm các cặp câu thực tế** — trên quy mô vài nghìn câu, mỗi cặp câu thực tế bổ sung
   đều có giá trị hơn bất kỳ tinh chỉnh thiết lập nào.
2. **Độ bao phủ cao hơn** trong quá trình tổng hợp dữ liệu — bổ sung các hiện tượng ngữ pháp còn thiếu mà
   báo cáo độ bao phủ đã cảnh báo.
3. **Dịch ngược (Backtranslation)** — biến văn bản đơn ngữ đích thành nhiều cặp câu huấn luyện hơn.
4. **Điểm xuất phát mạnh mẽ hơn** — `cpu-finetune` với một mô hình cơ sở cho một cặp ngôn ngữ
   liên quan, hoặc `nllb-600m` trên GPU — được đo lường đối chiếu với `cpu-tiny` trên cùng một tập dev.
5. **Giáo trình huấn luyện (Curriculum)** — tiền huấn luyện trên dữ liệu tổng hợp, sau đó tinh chỉnh trên các cặp câu thực tế.

---

## Bước 8 — Đưa vào sử dụng thực tế và đóng góp cho Network

Một mô hình được huấn luyện trung thực là thứ bạn có thể sử dụng ngay hôm nay, và chính xác là những gì
[Champollion Network](/docs/network/) được xây dựng để đón nhận.

**Tự sử dụng mô hình.** `export` đã đóng gói sẵn mô hình: một thư mục mô hình
khép kín, `forge-model.json` (mô hình là gì và đã được đo lường ra sao), một
bản kê khai plugin champollion (`method.json`), và `DEPLOY.md` với các
lệnh chính xác.

> 🗣️ **Nói với agent của bạn:** *"Hãy khởi chạy dịch vụ cho mô hình đã xuất và dùng nó để dịch
> các chuỗi giao diện của ứng dụng chúng ta bằng champollion CLI."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` hỗ trợ giao ước **api method** của champollion (`POST /translate`) và
điểm cuối `/v1/chat/completions` **tương thích OpenAI** — phương thức thứ hai là thứ mà
`--method local` sử dụng; `DEPLOY.md` chứa đoạn mã `champollion.config.json` cho
phương thức thứ nhất. Nó chỉ lắng nghe trên `127.0.0.1`; việc mở công khai ra mạng đòi hỏi phải có
token (`--token` hoặc `NMT_FORGE_SERVE_TOKEN`). Một mô hình NMT chỉ dịch văn bản và
bỏ qua các chỉ dẫn, do đó các prompt về văn phong, tệp hướng dẫn và bảng thuật ngữ mà CLI
gửi tới các phương thức LLM sẽ không có tác dụng với nó — và đầu ra của nó cần được một người
nói thành thạo kiểm tra trước khi đến tay người đọc.

**Đưa mô hình lên Network.**

> 🗣️ **Yêu cầu agent của bạn:** *"Đóng gói mô hình này dưới dạng một phương pháp (method) và gửi nó lên bảng xếp hạng cho cặp ngôn ngữ của chúng ta."*

- **[Gửi một phương pháp](/docs/network/getting-started/submit-a-method)** sẽ biến mô hình của bạn thành một mục nhập trên Mạng lưới, được chấm điểm trên các kho ngữ liệu tham chiếu công khai và được ghi nhận đóng góp cho bạn.
- Bởi vì quá trình đánh giá của bạn rất sạch sẽ — chia tách nhóm không giao nhau, có rào chắn tập dev, được kiểm định rò rỉ dữ liệu, có khoảng tin cậy, được đăng ký trước — bài nộp của bạn sẽ vượt qua được sự kiểm duyệt khắt khe vốn thường đánh sập hầu hết các tuyên bố về dịch máy nghèo tài nguyên khác. Kiến trúc chống gian lận (các tập test bí mật do cộng đồng sở hữu, kiểm tra khả năng tái lặp, xác thực bởi người bản xứ) không phải là rào cản đối với một mô hình được xây dựng theo cách này; trái lại, nó là một con dấu chứng nhận mức độ uy tín.
- Nếu có một **giải thưởng** đang mở cho ngôn ngữ của bạn, một phương pháp hiện có, tốt hơn mức cơ sở (baseline) được xây dựng một cách trung thực chính là những gì một quỹ tài trợ sẽ phần thưởng. Và khi một phương pháp hoạt động hiệu quả cho một ngôn ngữ bản địa, **quyền sở hữu có thể được chuyển giao cho cộng đồng** — bạn xây dựng nó ở đây và họ triển khai nó, theo các điều khoản của riêng họ. Xem [Quy định giải thưởng](/docs/network/specifications/prizes) và [Chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer).

---

## Toàn bộ hành trình, tóm gọn trong một hơi thở

1. **Khám phá** những tài nguyên ngôn ngữ hiện có (`discover`, `init`) — vắng mặt nghĩa là chưa biết, không phải là con số không.
2. **Trỏ tới** bộ phân tích + từ điển nếu có (bậc 3–4), tôn trọng giấy phép sử dụng của chúng.
3. **Tổng hợp** dữ liệu huấn luyện đã được xác minh, trích dẫn nguồn, kiểm tra độ bao phủ (`synth`) — hoặc **dịch ngược** văn bản đơn ngữ.
4. **Phân chia** dữ liệu thực tế tách rời theo nhóm, sàng lọc đối chiếu với tập test, và đăng ký các tập đánh giá (`registry add`, `leak-audit`, `split`).
5. **Huấn luyện** một cấu hình — mặc định trên CPU — có rào chắn dev, đã kiểm toán rò rỉ, có nhận biết giai đoạn bão hòa (`preflight`, `run`).
6. **Đánh giá** với các dự đoán được viết từ trước, luôn có khoảng tin cậy, lựa chọn đúng chỉ số (`prereg`, `export`).
7. **Lặp lại cải tiến** với các thử nghiệm A/B có kiểm định ý nghĩa thống kê (`compare`).
8. **Sử dụng** mô hình thông qua CLI (`serve`) và **gửi** lên Network — nơi giá trị cốt lõi nằm ở sự trung thực.

Bạn không bao giờ phải học thuộc lòng mười cách khiến kết quả dịch máy nghèo tài nguyên đi chệch hướng. Công cụ này đã biến con đường trung thực thành mặc định và từ chối các lối tắt kèm theo lời giải thích. Đó chính là toàn bộ ý tưởng: **các hàng rào bảo vệ sẽ ngăn chặn các lỗi nghiệp dư để bạn có thể tập trung vào chính ngôn ngữ đó.**

## Tiếp tục tìm hiểu

- [**Huấn luyện MT bằng ngôn ngữ bình dân**](/docs/network/context/mt-training-concepts) — mọi thuật ngữ ở đây, được định nghĩa kèm theo ví dụ.
- [**Huấn luyện mô hình một cách trung thực**](/docs/network/getting-started/training-honestly) — mười hàng rào bảo vệ trên một trang duy nhất, mỗi hàng rào đi kèm câu chuyện thực tế đằng sau nó.
- [**Mô hình tinh chỉnh (Fine-Tuned Model)**](/docs/network/tutorials/fine-tuned-model) và [**Dịch ngược (Back-Translation)**](/docs/network/tutorials/back-translation) — các hướng dẫn chuyên sâu hơn về các kỹ thuật cụ thể.
- [**Tạo kho ngữ liệu (Corpus Creation)**](/docs/network/tutorials/corpus-creation) — xây dựng dữ liệu thực tế làm nền tảng cho mọi thứ khác.
