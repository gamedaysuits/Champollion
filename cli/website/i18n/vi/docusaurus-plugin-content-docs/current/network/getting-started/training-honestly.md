---
sidebar_position: 2
title: "Huấn luyện mô hình một cách trung thực (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Huấn luyện Mô hình một cách Trung thực (nmt-forge)

**Tóm tắt trong 30 giây:** hầu hết các "cải tiến" MT (dịch máy) tài nguyên thấp đều không đứng vững khi xem xét lại — tập kiểm thử bị rò rỉ vào tập huấn luyện, tập kiểm thử được dùng để chọn checkpoint, hoặc mức cải thiện chỉ là nhiễu ngẫu nhiên không có thanh sai số. **nmt-forge** là một bộ công cụ huấn luyện giúp ngăn chặn các sai sót đó từ mặt cấu trúc: các luồng thông thường của nó luôn làm đúng, còn các luồng sai sẽ từ chối thực thi kèm theo thông báo giải thích *điều gì* đã xảy ra, *tại sao* điều đó làm sai lệch kết quả, và chính xác *cách khắc phục*. Nó đảm nhiệm huấn luyện; [khung đánh giá](/docs/network/specifications/harness) đảm nhiệm chấm điểm. Mỗi cơ chế bảo vệ trong đó tự động hóa việc ngăn chặn một sai lầm mà chúng tôi từng thực sự mắc phải, đã đo lường và ghi lại thành tài liệu trong quá trình xây dựng bản dịch tiếng Plains Cree. Công cụ được cài đặt bằng lệnh `python3 -m pip install 'nmt-forge[hf]'`, và mô hình mặc định của nó có thể huấn luyện ngay trên CPU máy tính xách tay.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

Đó chính là toàn bộ tinh thần của bộ công cụ này, thể hiện qua một thông báo từ chối.

## Câu chuyện năm phút

Đây là thất bại đã khai sinh ra bộ công cụ này. Một cuốn sách giáo khoa tiếng Cree ánh xạ nhiều bài tập tiếng Anh sang cùng một mục tiêu: cả *"Feed him"* và *"Feed her"* đều được dịch thành `asam`. Một phép chia ngẫu nhiên tiêu chuẩn đã đưa một bản sao vào tập huấn luyện và bản sao song sinh của nó vào tập kiểm thử — vì vậy mô hình thực tế đã nhìn thấy 17 trong số 54 câu trả lời "kiểm thử", và những dòng đó đạt điểm chrF++ là 83 so với 44 của các dòng sạch. Mọi thứ ở phía sau (mô hình "vô địch", các phát hiện được xây dựng dựa trên nó) đều phải bỏ đi.

Bộ chia của nmt-forge ngăn chặn điều đó xảy ra **ngay từ thiết kế**: các cặp chia sẻ chung nguồn *hoặc* đích sẽ được nhóm lại, toàn bộ nhóm sẽ nằm về một phía, và một quy trình xác minh không trùng lặp (zero-overlap) sẽ chạy sau mỗi lần phân tách:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Nếu tập kiểm thử của bạn đã là một tệp riêng biệt được đăng ký trước — một tập dữ liệu do giáo viên kiểm duyệt mà bạn giữ riêng tư — `--test 0` sẽ chỉ phân chia tập train và dev.)

Mọi cơ chế bảo vệ khác đều có chung mô thức — một sai lầm có thật, được loại bỏ bằng cơ chế tự động.
Cùng nhau, chúng tạo nên các **hàng rào bảo vệ khi huấn luyện**: hãy đọc chúng trước khi bạn phân chia dữ liệu
(`nmt-forge init` và `nmt-forge status` sẽ dẫn tới đây tại bước đó; các agent cũng nhận được cùng các quy tắc này, kèm theo sai lầm được đo lường đằng sau mỗi quy tắc, từ MCP tool `get_training_guardrails`).

| cơ chế bảo vệ | sai lầm mà nó loại bỏ |
|---|---|
| **split-guard** | đáp án kiểm thử ẩn trong tập huấn luyện thông qua nguồn/đích trùng lặp |
| **dev-fence** | tập kiểm thử chọn checkpoint của bạn (quá trình huấn luyện từ chối bắt đầu nếu không có tập dev đã đăng ký) |
| **leak-audit** | huấn luyện trên văn bản đánh giá — prompt giống hệt (ngay cả khi có bản dịch khác), đáp án giống hệt hoặc gần như trùng lặp, hoặc toàn bộ tệp. Nó cũng nêu rõ những gì nó cố tình *giữ lại* và lý do: các mẫu tương đồng chỉ đổi một từ (*"I see the dog"* / *"I see the cat"*) là dữ liệu luyện tập, không phải đáp án, và được báo cáo chứ không bị loại bỏ — trừ khi mọi hàng kiểm thử đều có một mẫu như vậy, khi đó `--clean-to … --drop-test-twins` sẽ loại bỏ các bản sao trong tập huấn luyện của một tập kiểm thử cố định. Tính tất định: cùng ngữ liệu, cùng kết quả |
| **funnel-audit** | sự hao hụt dữ liệu âm thầm trong quy trình (một ký tự chính tả từng xóa mất 1.375 động từ từ điển một cách vô hình suốt nhiều tuần) |
| **convention-lint** | huấn luyện trên các quy ước chính tả lẫn lộn (khiến mô hình trộn lẫn chúng ngay giữa câu) |
| **coverage-map** | một triệu cặp câu tổng hợp nhưng không có câu mệnh lệnh, câu hỏi, cấu trúc sở hữu — số lượng che giấu các lỗ hổng cấu trúc |
| **sample-strata** | hai loại mẫu chiếm dụng một nửa tín hiệu huấn luyện |
| **ci-scoring** | điểm số không có thanh sai số (mọi con số đều hiển thị kèm khoảng tin cậy bootstrap 95% — không có đầu ra điểm số trần trụi) |
| **schedule-sanity** | dừng sớm (early stopping) làm hỏng một lượt chạy nặng dữ liệu tổng hợp chỉ sau nửa epoch: với 97% dữ liệu tổng hợp và một tập dev *thực* trung thực, dev loss chạm đáy sớm rồi tăng dần lên — đó là do mô hình đang khớp với khối dữ liệu tổng hợp chứ không phải hội tụ. Ngưỡng dừng tối thiểu được tự động suy ra từ tỷ lệ pha trộn dữ liệu của bạn, và mọi can thiệp đều tự giải thích dựa trên quỹ đạo của dev loss. Vấn đề này được phát hiện *nhờ* một giao thức minh bạch — thiết lập trung thực sẽ làm lộ ra các lỗi thực sự |
| **eval-ledger** | việc sử dụng dữ liệu đánh giá thích ứng một cách vô hình (mọi lượt đọc đều được ghi nhật ký; các tập dữ liệu niêm phong chỉ dùng một lần) |
| **preregister** | suy đoán hồi tố giả dạng dự đoán (không đăng ký trước → không có điểm kiểm thử, không có bảng so sánh; một định dạng dự đoán duy nhất, một mảng JSON — `nmt-forge prereg template` tạo một tệp để chỉnh sửa) |
| **score caveats** | trích dẫn điểm số có kèm điều kiện cảnh báo từ khung đánh giá — *đầu ra gần như bất biến* (một vài câu lặp lại cho nhiều đầu vào khác nhau: đầu ra không bám theo đầu vào), đầu ra dài hơn hoặc ngắn hơn nhiều so với bản dịch tham chiếu, sao chép nguyên văn nguồn. forge không tự tính toán những điều này; nó chuyển tiếp mọi lưu ý cảnh báo mà khung đánh giá đã ghi, bằng chính lời văn của khung đánh giá, ngay cạnh điểm số — trong tóm tắt xuất dữ liệu, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` và `lint` — và không bao giờ đưa ra điểm số kèm cảnh báo dưới dạng "con số để trích dẫn" mà thiếu đi lưu ý của nó |

## Bất kỳ ngôn ngữ nào, bất kỳ tài nguyên nào — bắt đầu từ thẻ thông tin

nmt-forge là một công cụ duy nhất cho toàn bộ ~8.700 ngôn ngữ trong chỉ mục của Champollion, và
nó bắt đầu bằng việc truy vấn chỉ mục xem một ngôn ngữ thực sự đang có những gì:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Các ký hiệu `?` thể hiện sự trung thực của công cụ: sự vắng mặt trên thẻ thông tin có nghĩa là **chưa biết (unknown)**, chứ không bao giờ có nghĩa là "ngôn ngữ này không có gì". Mọi ngôn ngữ đều leo lên cùng một **nấc thang tài nguyên** — (1) chỉ riêng văn bản song song đã đủ để chạy toàn bộ vòng lặp huấn luyện có bảo vệ; (2) văn bản đơn ngữ bổ sung thêm dịch ngược (backtranslation); (3) một từ điển cộng với một ngữ pháp đã xuất bản giúp việc xây dựng một bộ template có trích dẫn trở nên giá trị; (4) một bộ phân tích hình thái mở khóa tính năng tổng hợp dữ liệu đã được xác minh; (5) một trọng tài LYSS đưa hệ số đo lường riêng của ngôn ngữ đó vào việc chấm điểm và lựa chọn checkpoint. Một thẻ thông tin phong phú (như tiếng Plains Cree) sẽ tự động kết nối các nấc thang 4–5 — các tập đánh giá được gửi đến kèm theo nhãn `NEVER TRAIN ON THIS`, và các luồng plugin của trọng tài đã sẵn sàng để dán vào.

`nmt-forge init <code>` sau đó sẽ khởi tạo khung dự án từ card: một không gian làm việc,
một cấu hình khởi đầu, và một bản tóm tắt `NEXT_STEPS.md` được viết riêng cho bạn *và agent của bạn*
với thứ tự lệnh chính xác. Lệnh này hoạt động từ một `pip install` thông thường —
các card được đọc từ một thư mục bạn chỉ định, bản sao cục bộ, hoặc chỉ mục card công khai
(được lưu vào bộ nhớ đệm để dùng ngoại tuyến) — và một ngôn ngữ chưa có card cũng nhận được
một dự án (`--no-card --name "<name>"`), với mọi thông tin trên card được ghi nhận là
chưa xác định thay vì tự bịa ra.

## Từ máy tính xách tay đến mô hình được triển khai phục vụ

Quy trình trung thực này không cần đến GPU. `init` ghi một trong ba preset mô hình
vào tệp cấu hình dưới dạng các con số rõ ràng:

| preset | yêu cầu | những gì có thể mong đợi |
|---|---|---|
| `cpu-tiny` (mặc định) — một transformer nhỏ được huấn luyện từ đầu, vốn từ vựng chỉ học từ các hàng huấn luyện của bạn | CPU máy tính xách tay, không cần tải về | yếu theo chủ đích thiết kế: trên 1–2 nghìn cặp câu, chrF++ đạt khoảng 5–30 — nắm được các cụm từ và mẫu câu từ dữ liệu của bạn, chứ không phải dịch thuật tổng quát |
| `cpu-finetune --base <hf-id>` — một mô hình Marian/opus-mt tiền huấn luyện nhỏ do bạn chỉ định, dành cho một cặp ngôn ngữ liên quan | CPU, tải về ~300 MB | thường tốt hơn `cpu-tiny` khi tồn tại một cặp ngôn ngữ liên quan — hãy đo lường thực tế |
| `nllb-600m` — NLLB-200 distilled 600M với LoRA | GPU | điểm khởi đầu mạnh mẽ nhất |

`cpu-tiny` ra đời nhằm hiện thực hóa *toàn bộ* quy trình ngay từ ngày đầu tiên — hàng rào chắn, các bước
kiểm toán, bài kiểm tra đã đăng ký trước, một mô hình mà CLI có thể gọi — để sau này một mô hình
tốt hơn có thể tích hợp thẳng vào cùng dự án đó và được đo lường theo đúng cách thức tương tự. Sau khi
huấn luyện, hai lệnh sau sẽ hoàn tất công việc:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` chấm điểm tập kiểm thử một lần duy nhất (bắt buộc phải đăng ký trước, khoảng tin cậy
95%; `--prereg <id>` nêu tên bản đăng ký trước được viết cho mô hình này
với `nmt-forge prereg new <id>` — với hai mô hình trên cùng một tập kiểm thử, mỗi mô hình
được đánh giá theo bản riêng của nó, lệnh export từ chối tự đoán), ghi kết quả dưới dạng một báo cáo mt-eval
mà `mt-eval compare` đọc được, và đóng gói một mô hình độc lập hoàn chỉnh kèm
manifest plugin champollion và một `DEPLOY.md`. `serve` hỗ trợ giao thức api-method của champollion và một
endpoint tương thích với OpenAI, nhờ đó `champollion sync --method local` có thể thực hiện dịch thuật
với mô hình; nó chỉ lắng nghe trên localhost trừ khi bạn cung cấp một token. Mọi lệnh
đều nhận `--json` dành cho agent (một tài liệu JSON trên stdout; các trường hợp từ chối dưới dạng
`{"error": {…, "why", "fix"}}`, mã thoát 2). Hướng dẫn chi tiết đầy đủ nằm tại
[Huấn luyện mô hình đầu tiên của bạn](/docs/network/getting-started/train-your-first-model);
một khi bạn đã có kết quả đáng để thử nghiệm,
[Gửi một phương thức](/docs/network/getting-started/submit-a-method) sẽ biến nó thành
một mục trong Network.

## Dữ liệu tổng hợp có thể bảo vệ được

Đối với các ngôn ngữ có bộ phân tích hình thái (FST), forge sản xuất dữ liệu huấn luyện thông qua các **gói ngôn ngữ (language packs)** — và áp dụng một *luật xuất bản (emit law)* mà không gói nào có thể từ chối: mọi từ được tạo ra phải trải qua quy trình khứ hồi qua bộ phân tích (tạo -> phân tích -> cho ra cùng một kết quả phân tích), mọi template phải trích dẫn ngữ pháp đã xuất bản mà nó chuyển biên, mọi bộ lọc tính hợp lý đều được đặt tên và đếm số lượng, và mọi dòng đều được đóng dấu `synthetic: true`. Con dấu đó đóng vai trò chịu lực: hệ thống đăng ký **từ chối các dòng tổng hợp trong tập kiểm thử**. Các bài kiểm thử chỉ được phép sử dụng dữ liệu thực tế.

Bản thân forge không đi kèm với bất kỳ gói ngôn ngữ nào — nó là một công cụ đa dụng. Các gói ngôn ngữ nằm cùng với ngôn ngữ của chúng và được cắm vào thông qua đường dẫn mô-đun hoặc điểm truy cập (entry point) (gói tiếng Plains Cree nằm trong dự án crk-translate):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Các bộ phân tích và từ điển được giữ riêng biệt, là các công cụ do người dùng tự tải về theo giấy phép riêng của chúng — không bao giờ được đóng gói kèm theo, không bao giờ được phân phối lại.

## Trọng tài riêng của ngôn ngữ của bạn, tham gia vào quy trình

Các tiêu chuẩn đánh giá LYSS (các công cụ linter theo từng ngôn ngữ, ví dụ như biết rằng hai cách viết tiếng Cree chỉ khác nhau bởi một quy ước nguyên âm dài đã được ghi chép) sẽ tích hợp vào mọi bề mặt chấm điểm — và vào cả việc lựa chọn checkpoint, để mô hình chiến thắng là mô hình được *trọng tài của chính ngôn ngữ đó* ưu tiên, chứ không chỉ dựa vào chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Mỗi con số từ plugin đều có một khoảng tin cậy; một trọng tài thiếu các điều kiện tiên quyết sẽ báo cáo là *không khả dụng (unavailable)* thay vì đưa ra một điểm số bịa đặt.

Điều tương tự cũng đúng với **toàn bộ ngăn xếp chỉ số của hệ thống đánh giá** — nmt-forge hỗ trợ mọi thứ mà [hệ thống đánh giá (eval harness)](/docs/network/specifications/harness) hỗ trợ, bao gồm cả các chỉ số mạng nơ-ron (COMET, COMET-QE, MetricX), với quá trình suy luận được chạy một lần và các khoảng tin cậy được bootstrap từ điểm số của từng mục đã được lưu vào bộ nhớ đệm. Trước khi bạn chọn checkpoint dựa trên bất kỳ chỉ số tự động nào, `discover` sẽ hiển thị [độ tin cậy đã được đo lường](/docs/network/specifications/metric-reliability) của từng chỉ số đối với ngữ hệ của bạn — đối với tiếng Inuktitut, BLEU hầu như không theo sát đánh giá của con người (r=0.16) trong khi COMET thì có (r=0.86); đối với hầu hết các ngữ hệ tài nguyên thấp, câu trả lời trung thực là *chưa được đo lường*. Công cụ này sẽ cho bạn biết nên tin vào con số nào trước khi bạn tối ưu hóa theo hướng đó.

## Tìm hiểu chuyên sâu hơn

- **Bạn mới làm quen với các thuật ngữ?** [Huấn luyện MT bằng ngôn ngữ đơn giản](/docs/network/context/mt-training-concepts) định nghĩa từng thuật ngữ —
  dữ liệu huấn luyện so với dữ liệu đánh giá, loss so với decoding, rò rỉ dữ liệu, chrF++, dịch ngược,
  điểm chững lại — đi kèm ví dụ minh họa cụ thể, được viết cho người chưa có nền tảng.
- **Đã sẵn sàng xây dựng?** [Bạn muốn tự huấn luyện mô hình của riêng mình](/docs/network/tutorials/train-your-own-model) là bài hướng dẫn từng bước,
  ưu tiên agent: chọn ngôn ngữ → thu thập dữ liệu → tổng hợp → phân chia dữ liệu
  → huấn luyện → đánh giá → lặp lại → triển khai phục vụ và gửi nộp, kèm minh họa từng hàng rào bảo vệ
  bắt lỗi tương ứng. [Xây dựng MT cho ngôn ngữ của bạn](/docs/build-mt-for-your-language) đặt việc huấn luyện vào bức tranh
  toàn cảnh của cả hành trình — tìm hiểu những gì đang có, đo lường các lựa chọn, triển khai.
- **Huấn luyện, rồi gửi nộp:** một mô hình được huấn luyện trung thực sẽ trở thành một mục trong Network
  thông qua [Gửi một phương thức](/docs/network/getting-started/submit-a-method).
- **Các thanh sai số:** [Kiểm định ý nghĩa thống kê](/docs/network/specifications/significance) là phần toán học mà forge
  áp dụng theo mặc định.
- **Tin tưởng chỉ số nào:** hãy xem [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability) trước khi
  lựa chọn checkpoint dựa trên bất kỳ chỉ số tự động nào.
- **Mọi câu lệnh và flag:** xem [Tài liệu tham khảo lệnh forge](/docs/network/getting-started/forge-command-reference),
  được sinh ra tự động từ chính công cụ.
- **Hệ thống phân loại lỗi thất bại** — mỗi sai lầm, một ví dụ cụ thể, và cơ chế bảo vệ
  bắt được nó — được đính kèm sẵn trong mã nguồn của nmt-forge. Các agent nhận được cùng bộ quy tắc
  này từ công cụ `get_training_guardrails` của máy chủ MCP (tùy chọn `topic`), và mọi lần từ chối
  đều đi kèm phần giải thích điều gì/tại sao/cách khắc phục.
