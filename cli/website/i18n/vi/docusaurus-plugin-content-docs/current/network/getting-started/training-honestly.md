---
sidebar_position: 2
title: "Huấn luyện mô hình một cách trung thực (nmt-forge)"
related:
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

**Tóm tắt trong 30 giây:** hầu hết các "cải tiến" dịch máy (MT) tài nguyên thấp đều thất bại khi kiểm tra lại — tập kiểm thử (test set) bị rò rỉ vào tập huấn luyện (training set), tập kiểm thử được dùng để chọn checkpoint, hoặc mức tăng chỉ là nhiễu mà không có khoảng sai số (error bar). **nmt-forge** là một bộ công cụ huấn luyện giúp ngăn chặn các lỗi đó ngay từ cấu trúc: các luồng xử lý thông thường sẽ hoạt động đúng cách, còn các luồng sai sẽ bị từ chối kèm theo thông báo giải thích rõ điều *gì* đã xảy ra, *tại sao* nó làm sai lệch kết quả, và cách *khắc phục* chính xác. Nó thực hiện huấn luyện; còn [hệ thống đánh giá (eval harness)](/docs/network/specifications/harness) sẽ chấm điểm. Mỗi cơ chế bảo vệ (guard) trong đó đều tự động hóa việc ngăn chặn một sai lầm mà chúng tôi đã thực sự mắc phải, đo lường và ghi chép lại trong quá trình xây dựng hệ thống dịch thuật tiếng Plains Cree.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

Đó chính là toàn bộ tinh thần của bộ công cụ này, thể hiện qua một thông báo từ chối.

## Câu chuyện năm phút

Đây là thất bại đã khai sinh ra bộ công cụ này. Một cuốn sách giáo khoa tiếng Cree ánh xạ nhiều bài tập tiếng Anh sang cùng một mục tiêu: cả *"Feed him"* và *"Feed her"* đều được dịch thành `asam`. Một phép chia ngẫu nhiên tiêu chuẩn đã đưa một bản sao vào tập huấn luyện và bản sao song sinh của nó vào tập kiểm thử — vì vậy mô hình thực tế đã nhìn thấy 17 trong số 54 câu trả lời "kiểm thử", và những dòng đó đạt điểm chrF++ là 83 so với 44 của các dòng sạch. Mọi thứ ở phía sau (mô hình "vô địch", các phát hiện được xây dựng dựa trên nó) đều phải bỏ đi.

Bộ chia của nmt-forge ngăn chặn điều đó xảy ra **ngay từ thiết kế**: các cặp chia sẻ chung nguồn *hoặc* đích sẽ được nhóm lại, toàn bộ nhóm sẽ nằm về một phía, và một quy trình xác minh không trùng lặp (zero-overlap) sẽ chạy sau mỗi lần phân tách:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Mỗi cơ chế bảo vệ khác cũng có mô-típ tương tự — một sai lầm thực tế được tự động hóa để loại bỏ:

| cơ chế bảo vệ | sai lầm bị loại bỏ |
|---|---|
| **split-guard** | các câu trả lời kiểm thử ẩn nấp trong tập huấn luyện thông qua nguồn/đích chung |
| **dev-fence** | tập kiểm thử được dùng để chọn checkpoint (quá trình huấn luyện từ chối bắt đầu nếu không có tập phát triển - dev set - được đăng ký) |
| **leak-audit** | huấn luyện trên văn bản đánh giá — khớp chính xác, diễn đạt lại (Jaccard), hoặc toàn bộ tệp |
| **funnel-audit** | sự hao hụt ngầm trong pipeline (một ký tự chính tả từng vô tình xóa mất 1.375 động từ trong từ điển một cách âm thầm suốt nhiều tuần) |
| **convention-lint** | huấn luyện trên các quy ước chính tả bị trộn lẫn (khiến mô hình tự trộn lẫn chúng ngay giữa câu) |
| **coverage-map** | một triệu cặp dữ liệu tổng hợp nhưng không có câu mệnh lệnh, câu hỏi, hay sở hữu cách — số lượng lớn che lấp đi các lỗ hổng cấu trúc |
| **sample-strata** | hai loại template chiếm dụng tới một nửa tín hiệu huấn luyện |
| **ci-scoring** | điểm số không có khoảng sai số (mọi con số đều được hiển thị cùng với khoảng tin cậy bootstrap 95% — không có đầu ra điểm số đơn thuần) |
| **schedule-sanity** | cơ chế dừng sớm (early stopping) làm hỏng một lượt chạy nặng dữ liệu tổng hợp ở giữa epoch: với 97% dữ liệu tổng hợp và một tập dev *thực tế* trung thực, dev loss sẽ chạm đáy sớm rồi tăng dần lên — đó là do mô hình đang khớp với khối lượng dữ liệu tổng hợp chứ không phải là hội tụ. Ngưỡng dừng được tính toán tự động từ tỷ lệ pha trộn của bạn, và mỗi can thiệp đều tự giải thích dựa trên quỹ đạo của dev-loss. Lỗi này được phát hiện *nhờ* một quy trình sạch — các thiết lập trung thực sẽ làm lộ ra các lỗi thực sự |
| **eval-ledger** | việc sử dụng dữ liệu đánh giá một cách thích ứng và vô hình (mọi lượt đọc đều được ghi nhật ký; các tập dữ liệu niêm phong chỉ được dùng một lần) |
| **preregister** | các dự đoán hồi cứu (postdiction) được ngụy trang thành dự đoán thực tế (không đăng ký trước → không có bảng so sánh) |

## Bất kỳ ngôn ngữ nào, bất kỳ tài nguyên nào — bắt đầu từ thẻ thông tin

nmt-forge là một công cụ dành cho tất cả ~8.700 ngôn ngữ trong chỉ mục của Champollion, và
nó bắt đầu bằng cách truy vấn chỉ mục xem một ngôn ngữ thực sự có những gì:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Các ký hiệu `?` thể hiện sự trung thực của công cụ: sự vắng mặt trên thẻ thông tin có nghĩa là **chưa biết (unknown)**, chứ không bao giờ có nghĩa là "ngôn ngữ này không có gì". Mọi ngôn ngữ đều leo lên cùng một **nấc thang tài nguyên** — (1) chỉ riêng văn bản song song đã đủ để chạy toàn bộ vòng lặp huấn luyện có bảo vệ; (2) văn bản đơn ngữ bổ sung thêm dịch ngược (backtranslation); (3) một từ điển cộng với một ngữ pháp đã xuất bản giúp việc xây dựng một bộ template có trích dẫn trở nên giá trị; (4) một bộ phân tích hình thái mở khóa tính năng tổng hợp dữ liệu đã được xác minh; (5) một trọng tài LYSS đưa hệ số đo lường riêng của ngôn ngữ đó vào việc chấm điểm và lựa chọn checkpoint. Một thẻ thông tin phong phú (như tiếng Plains Cree) sẽ tự động kết nối các nấc thang 4–5 — các tập đánh giá được gửi đến kèm theo nhãn `NEVER TRAIN ON THIS`, và các luồng plugin của trọng tài đã sẵn sàng để dán vào.

Sau đó, `nmt-forge init <code>` sẽ dựng khung dự án từ thẻ thông tin: một không gian làm việc, một cấu hình khởi đầu, và một bản tóm tắt `NEXT_STEPS.md` được viết cho bạn *và agent của bạn* — kết thúc tại [Gửi một Phương thức](/docs/network/getting-started/submit-a-method) khi bạn đã có thứ gì đó đáng để thử nghiệm.

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

## Tìm hiểu sâu hơn

- **Bạn mới làm quen với các thuật ngữ?** [Huấn luyện MT bằng Ngôn ngữ Bình dân](/docs/network/context/mt-training-concepts) định nghĩa mọi thuật ngữ — dữ liệu huấn luyện so với dữ liệu đánh giá, loss so với decoding, rò rỉ (leakage), chrF++, dịch ngược (backtranslation), điểm bão hòa (plateau) — kèm theo một ví dụ thực tế, được viết cho người chưa có nền tảng.
- **Đã sẵn sàng xây dựng?** [Nếu Bạn Muốn Tự Huấn Luyện Mô Hình Của Riêng Mình](/docs/network/tutorials/train-your-own-model) là hướng dẫn từng bước, định hướng theo agent: chọn một ngôn ngữ → thu thập dữ liệu → tổng hợp → chia tách → huấn luyện → đánh giá → lặp lại → gửi, với mỗi rào chắn bảo vệ được minh họa khi phát hiện ra lỗi của nó.
- **Huấn luyện, sau đó gửi:** một mô hình được huấn luyện một cách trung thực sẽ trở thành một mục trong Mạng lưới thông qua [Gửi một Phương thức](/docs/network/getting-started/submit-a-method).
- **Các khoảng sai số:** [Kiểm định Ý nghĩa Thống kê](/docs/network/specifications/significance) là phép toán mà forge áp dụng theo mặc định.
- **Nên tin cậy chỉ số nào:** hãy kiểm tra [Độ tin cậy của Chỉ số](/docs/network/specifications/metric-reliability) trước khi chọn checkpoint dựa trên bất kỳ chỉ số tự động nào.
- **Toàn bộ thiết kế** — câu chuyện thực tế đằng sau mỗi cơ chế bảo vệ, giao diện gói ngôn ngữ, các thiết lập mặc định của vòng lặp huấn luyện — nằm cùng với mã nguồn trong kho lưu trữ (`forge/DESIGN.md`).
