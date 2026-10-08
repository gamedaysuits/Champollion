---
sidebar_position: 2
title: "Câu hỏi thường gặp"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Câu hỏi thường gặp (FAQ)

> **Tóm tắt nhanh.** Câu trả lời cho các câu hỏi thường gặp về Champollion Network — cách tính điểm, những trường hợp bị loại, cách xử lý các ngôn ngữ không có FST, đề xuất về mô hình và tham số, cũng như quy trình gửi kết quả.

---

## Tính điểm & Chỉ số

### Bộ công cụ kiểm thử (harness) tính toán những chỉ số nào?

Chỉ số tiêu đề, và cũng là con số duy nhất xếp hạng một lượt chạy, là **corpus chrF++** cùng khoảng tin cậy 95% của nó. Bên cạnh đó, harness báo cáo các chỉ số tiêu chuẩn khác — **BLEU, spBLEU và TER**, cùng **COMET** khi được cài đặt — mỗi chỉ số đứng riêng lẻ, không bao giờ kết hợp. Mọi thứ khác đều là **chẩn đoán**: được báo cáo riêng để giải thích điểm số, không bao giờ là một phần của điểm số. Bảng bên dưới bao gồm chrF++ và các chẩn đoán chính; ba trong số đó không phụ thuộc vào ngôn ngữ và hai chẩn đoán hiện phụ thuộc vào các plugin dành riêng cho CRK, sẽ được tổng quát hóa khi chúng tôi mở rộng sang nhiều ngôn ngữ hơn. Các ngữ liệu tham chiếu có thể chạy được hiện nay là các bộ dữ liệu công khai có giấy phép mở — Global Voices, Tatoeba, TICO-19, IN22, SMOL, v.v. (xem [Tập dữ liệu](/docs/network/leaderboard/datasets)) — và bảng xếp hạng mở cho các bài nộp trên mọi cặp ngôn ngữ đã đăng ký. Plains Cree đơn giản là nơi hai chỉ số đặc thù theo ngôn ngữ (dựa trên FST) được triển khai lần đầu tiên.

| Chỉ số | Thang đo | Ý nghĩa đo lường | Trạng thái |
|--------|----------|------------------|------------|
| **chrF++** (tiêu đề) | 0–100 | Độ trùng lặp n-gram ký tự giữa bản dịch dự đoán và tham chiếu, được tính toán trên toàn bộ ngữ liệu bằng sacreBLEU (chữ ký được ghi lại). Chỉ số bề mặt tiêu chuẩn cho các ngôn ngữ giàu hình thái. | ✅ Tất cả ngôn ngữ |
| **Khớp chính xác** (chẩn đoán) | 0.0–1.0 | Tỷ lệ các mục mà kết quả dự đoán khớp chính xác với tham chiếu sau khi chuẩn hóa. | ✅ Tất cả ngôn ngữ |
| **Độ chấp nhận FST** (chẩn đoán) | 0.0–1.0 | Tỷ lệ các từ đầu ra được bộ chuyển đổi trạng thái hữu hạn (bộ phân tích hình thái) chấp nhận. Chỉ được tính khi tệp nhị phân FST được cung cấp. | ✅ Tất cả ngôn ngữ có FST |
| **Khớp tương đương** (chẩn đoán) | 0.0–1.0 | Tỷ lệ các mục khớp với tham chiếu hoặc một biến thể chấp nhận được — tính đến trật tự từ, quy ước chính tả và khác biệt phương ngữ. | ⚡ CRK (đang tổng quát hóa) |
| **Điểm ngữ nghĩa** (chẩn đoán) | 0.0–1.0 | Điểm bảo toàn ý nghĩa — bản dịch thể hiện ý nghĩa dự định tốt đến mức nào, bất kể hình thức bề mặt? | ⚡ CRK (đang tổng quát hóa) |

Các chẩn đoán chuyên sâu hơn — **độ chính xác hình thái**, **chuyển mã**, **sự tuân thủ thuật ngữ**, **ảo giác** và **phong cách viết** — cùng trạng thái triển khai của từng chỉ số có trong [Quy chuẩn chấm điểm §2](/docs/network/specifications/scoring#2-metric-inventory), danh mục chỉ số đầy đủ.

### Một lượt chạy được chấm điểm như thế nào?

Mỗi lượt chạy mới được chấm điểm theo tiêu chuẩn tính điểm `standard/1`, theo cách lĩnh vực dịch máy báo cáo đánh giá MT (WMT, FLORES-200, AmericasNLP):

- **Chỉ số tiêu đề:** corpus chrF++, được viết cùng khoảng tin cậy bootstrap 95% và chữ ký sacreBLEU — ví dụ `chrF++ 47.5 [45.9, 49.0]`.
- **Bên cạnh:** BLEU, spBLEU, TER và COMET khi được tính toán. Không bao giờ gộp chung.
- **Chẩn đoán:** khớp chính xác, độ chấp nhận FST, độ chính xác hình thái, chuyển mã, ảo giác, thuật ngữ, phong cách viết. Được báo cáo riêng; chúng không bao giờ dùng để xếp hạng một lượt chạy.
- **Lưu ý điểm số** được hiển thị ngay cạnh chỉ số tiêu đề khi harness phát hiện một mẫu hình khiến con số gây hiểu lầm.

Việc một lượt chạy có **tốt hơn** lượt chạy khác hay không được quyết định bằng kiểm định ý nghĩa thống kê theo cặp trên chrF++ (`mt-eval compare --significance`), chứ không phải bằng cách so sánh hai con số. Quy tắc đầy đủ: [Cách chấm điểm các lượt chạy](/docs/network/specifications/scoring#how-runs-are-scored) và [Quy chuẩn ý nghĩa thống kê](/docs/network/specifications/significance).

### Chuyện gì đã xảy ra với điểm tổng hợp và các bậc chất lượng?

Cả hai đều đã bị **ngừng sử dụng** đối với các lượt chạy mới. Điểm tổng hợp trước đây là sự kết hợp có trọng số của chrF++, khớp chính xác, độ chấp nhận FST và các tín hiệu khác, còn các bậc (Cơ sở → Thành thạo) là những nhãn được suy ra từ điểm này. Một số dữ liệu đầu vào của nó không bao giờ so sánh đầu ra với văn bản nguồn hoặc tham chiếu, do đó một hệ thống có thể đạt phần lớn số điểm mà không cần dịch: một mô hình tiếng Anh→Northern Sámi chưa qua đào tạo lặp lại một câu hợp lệ duy nhất cho mọi đầu vào đã đạt điểm 0,6244 — được gắn nhãn "hoạt động được" — với chrF++ là 5,5. Các thẻ lượt chạy mới công bố `composite: null` và `quality_tier: null`.

Các thẻ được công bố trước khi có tiêu chuẩn vẫn giữ điểm tổng hợp đã lưu và duy trì khả năng kiểm chứng; bất cứ nơi nào điểm này được hiển thị, nó đều được gắn nhãn **điểm tổng hợp cũ (đã ngừng sử dụng)**. Xem [lý do điểm tổng hợp bị ngừng sử dụng](/docs/network/specifications/scoring#why-the-composite-was-retired).

Điểm số tự động không phải là phán quyết về chất lượng. Chỉ có đánh giá thủ công của những người nói ngôn ngữ đó mới chứng nhận chất lượng.

### Các bậc xác minh là gì?

**Các bậc xác minh** mô tả *ai đã xác thực kết quả*, chứ không phải kết quả đó tốt đến mức nào:

| Bậc xác minh | Ý nghĩa |
|--------------|---------|
| **Tự chấm điểm (Self-benchmarked)** | Người gửi đã tự chạy harness. Điểm số hợp lý nhưng chưa được xác minh. |
| **Champollion Verified** | Một maintainer đã tái hiện kết quả bằng cách sử dụng cấu hình phương pháp đã nộp. |
| **Cộng đồng xác thực (Community Validated)** | Những người nói song ngữ của ngôn ngữ đích, đủ tiêu chuẩn theo quy trình riêng của cộng đồng, đã đánh giá một mẫu phân tầng của đầu ra (≥30 mục, ≥2 người đánh giá) và ≥70% đáp ứng tiêu chuẩn của cộng đồng. Chỉ được trao thông qua kiểm thử do chính cộng đồng thực hiện; việc giáng hạng qua kiểm tra đột xuất diễn ra tương tự và công khai như nhau. |

Một lượt chạy có thể có điểm chrF++ cao nhưng vẫn chỉ ở mức "Tự chấm điểm" (Self-benchmarked) — nghĩa là chưa có ai độc lập xác nhận điểm số đó và chưa có người nói ngôn ngữ nào đánh giá đầu ra.

---

## Gửi kết quả & Loại bỏ tư cách

### Điều gì khiến lượt gửi của tôi bị loại?

Lượt gửi của bạn sẽ bị từ chối hoặc bị gắn cờ nếu:

1. **Phương pháp của bạn bị lộ dữ liệu đánh giá (data leakage).** Nếu bạn đã huấn luyện, tinh chỉnh (fine-tune), gợi ý vài mẫu (few-shot prompt), hoặc sử dụng bất kỳ mục nhập nào từ tập dữ liệu đánh giá theo cách khác, điểm số của bạn đã bị thổi phồng nhân tạo. Điều này bao gồm cả việc sử dụng các bản dịch tham chiếu trong prompt của bạn.
2. **Thẻ chạy (run card) của bạn không vượt qua kiểm tra tính toàn vẹn.** Mã định danh (fingerprint) phải khớp với cấu hình. Các thẻ chạy bị can thiệp sẽ bị từ chối.
3. **Phương pháp của bạn không triển khai giao thức TranslationMethod.** Bộ công cụ kiểm thử yêu cầu `translate(entries, config) → results`. Các tích hợp tùy chỉnh bỏ qua bộ công cụ kiểm thử sẽ không được chấp nhận.

### Tôi có thể gửi kết quả nhiều lần không?

Có. Bảng xếp hạng theo dõi tất cả các lượt gửi. Bạn có thể lặp đi lặp lại — chạy hàng tá thử nghiệm và chỉ gửi kết quả tốt nhất của mình. Mỗi lượt gửi ghi lại một mã định danh duy nhất, vì vậy không có sự mơ hồ về việc lượt chạy nào tạo ra điểm số nào.

### Làm thế nào để điểm số của tôi được xác minh?

1. **Tự chấm điểm (Self-benchmarked):** Mọi bài nộp đều bắt đầu từ đây, và hiện tại mọi hàng trên bảng xếp hạng vẫn ở mức này.
2. **Champollion Verified:** Dự án sẽ chấm điểm lại các kết quả đầu ra bạn đã nộp so với ngữ liệu tham chiếu được ghim mã sha bằng chỉ số của harness. Khi điểm số của bạn có thể tái lập, lượt chạy sẽ được thăng cấp lên Champollion Verified — bậc mà bảng xếp hạng cuộc thi sử dụng theo mặc định, và là bậc duy nhất đủ điều kiện nhận giải thưởng; bảng xếp hạng công khai cũng liệt kê các hàng tự chấm điểm và được gắn nhãn tương ứng. Nếu không tái lập được hoặc tham chiếu lưu trữ bị thay đổi, lượt chạy sẽ bị loại. Việc chấm điểm lại là một đợt xử lý hàng loạt của maintainer, được chạy thủ công: không có gì tự động chạy khi nộp và không có gì lên lịch trước.
3. **Cộng đồng xác thực (Community Validated):** Những người nói song ngữ của ngôn ngữ đích, đủ tiêu chuẩn theo quy trình riêng của cộng đồng, sẽ đánh giá một mẫu phân tầng từ đầu ra của phương pháp của bạn — ít nhất 30 mục, ít nhất 2 người đánh giá — và ít nhất 70% phải đạt tiêu chuẩn của cộng đồng. Bậc này chỉ được cấp thông qua các thử nghiệm do chính cộng đồng tiến hành theo toàn quyền quyết định của họ, và có thể bị thu hồi theo cách tương tự: một cuộc kiểm tra đột xuất không đạt sẽ giáng hạng phương pháp một cách công khai không kém. Việc này không thể tự động hóa — nó đòi hỏi sự tham gia của cộng đồng.

### Tại sao các bạn không chạy lại phương pháp của mọi người để xác minh?

Bởi vì chúng tôi không đủ nguồn lực và cũng không cần thiết phải làm vậy. Việc chấm điểm lại đầu ra đã nộp của *tất cả mọi người* là miễn phí (việc này phát hiện các điểm số bị tự ý nhập tay hoặc chỉnh sửa). Việc thực sự chạy lại một mô hình tiêu tốn tài nguyên tính toán thực sự, do đó điều này chỉ diễn ra trên một **mẫu** được chọn theo cơ chế **kiểm toán dựa trên trọng số uy tín** — chính sách lấy mẫu đã được xây dựng và thử nghiệm, nhưng trình chạy lại (re-runner) do nó điều phối thì chưa, vì vậy chưa có lượt chạy lại mẫu nào được kích hoạt và một lượt chạy được chọn sẽ được ghi nhận là *L2-pending*. Theo chính sách đó, một lượt chạy luôn được chọn nếu nó mang tính then chốt cao (nó mở ra cây cầu đầu tiên kết nối tới cả một ngữ hệ) hoặc bất thường (một bước nhảy vọt tốt đến mức khó tin so với kết quả tốt nhất trước đó), còn đối với những người đóng góp đã được chứng minh thì hiếm khi bị kiểm tra đột xuất. Uy tín chỉ đạt được bằng cách vượt qua các cuộc kiểm toán này (hoặc nhờ một người đóng góp độc lập chứng thực kết quả của bạn) — chứ không bao giờ tính theo số lượng — do đó các danh tính dùng một lần mới tạo sẽ không nhận được lợi thế gì. Một trường hợp gian lận bị phát hiện sẽ xóa sạch uy tín của người đóng góp về 0, kích hoạt kiểm toán lại toàn bộ lịch sử đã xác minh của họ và được ghi nhận công khai, tương tự như một thông báo đính chính rút bài. Chúng tôi **không** khẳng định rằng lượt chạy của bạn "đã đi qua harness" — đối với tài nguyên tính toán tự lưu trữ vốn không thể xác minh qua máy chủ — vì vậy tính hợp lệ dựa trên *khả năng tái lập + cổ phần uy tín + sự chứng thực*, chứ không phải dựa trên sự chứng nhận đơn thuần. Xem [Quy tắc đánh giá MT](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) để biết mô hình đầy đủ.

### API gửi kết quả đã hoạt động chưa?

Chưa hỗ trợ. Endpoint `https://champollion.dev/api/leaderboard/submit` hiện tại mới chỉ là định hướng. Đường dẫn gửi bài hiện tại là `mt-eval publish` — nó tải một run card từ thư mục đầu ra của harness (`eval/logs/harness/`) trực tiếp lên bảng xếp hạng dưới dạng *self-benchmarked (unverified)*.

---

## Mô hình & Tham số

### Tôi nên sử dụng mô hình nào?

Không có một mô hình duy nhất nào là tốt nhất — nó phụ thuộc vào cặp ngôn ngữ, ngân sách và cách tiếp cận của bạn. Hướng dẫn chung:

| Loại ngôn ngữ | Điểm bắt đầu khuyến nghị | Lý do |
|---------------|---------------------------|-----|
| **Tài nguyên cao** (tiếng Pháp, tiếng Tây Ban Nha, tiếng Nhật) | `google/gemini-2.5-flash` hoặc `gpt-4o-mini` | Nhanh, rẻ, điểm chuẩn cơ sở mạnh mẽ |
| **Tài nguyên thấp có một số mức độ hỗ trợ từ LLM** (tiếng Quechua, tiếng Yoruba) | `google/gemini-2.5-pro` hoặc `anthropic/claude-sonnet-4` | Các mô hình lớn hơn có tri thức ẩn tốt hơn |
| **Đa tổng hợp / tài nguyên cực thấp** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` kết hợp coaching | Dữ liệu huấn luyện (coaching data) quan trọng hơn việc lựa chọn mô hình. OMT-1600 bao gồm một số ngôn ngữ đa tổng hợp (ví dụ: CRK ở phân hạng R1) nhưng với phân tách từ tố (tokenization) BPE tiêu chuẩn — hãy kiểm thử nó như một điểm chuẩn cơ sở trong Network. |

Harness đánh giá sử dụng OpenRouter, vì vậy bất kỳ mô hình nào có sẵn trên OpenRouter đều có thể được đánh giá hiệu năng (benchmark). Xem [openrouter.ai/models](https://openrouter.ai/models) để biết danh sách các mô hình hiện có.

### Tôi nên sử dụng nhiệt độ (temperature) nào?

Nhiệt độ thấp hơn thường tốt hơn cho dịch thuật:

| Nhiệt độ | Ảnh hưởng | Khuyến nghị cho |
|-------------|--------|-----------------|
| **0.0 – 0.2** | Tính xác định cao, đầu ra nhất quán | Các phương pháp sản xuất, kiểm thử điểm chuẩn cuối cùng |
| **0.3 – 0.5** | Có một số biến thể, đôi khi sáng tạo hơn | Khám phá, lặp thử nghiệm ban đầu |
| **0.6+** | Biến thể cao, khó dự đoán | Không khuyến nghị cho kiểm thử điểm chuẩn dịch máy (MT) |

Nhiệt độ được ghi lại trong thẻ chạy, vì vậy các nhiệt độ khác nhau sẽ tạo ra các mã định danh khác nhau — chúng được coi là các thử nghiệm khác nhau.

### Dữ liệu huấn luyện (coaching data) có giúp ích không?

Có, rất nhiều — đối với các ngôn ngữ nghèo tài nguyên. Dữ liệu huấn luyện (quy tắc ngữ pháp, mục từ điển, lưu ý về phong cách) được đưa vào prompt hệ thống của LLM. Đối với Plains Cree, các phương pháp có coaching liên tục vượt trội hơn các phương pháp LLM thuần túy đối với các ngôn ngữ đa tổng hợp vì các LLM đa dụng có mức độ tiếp xúc hạn chế với ngôn ngữ đa tổng hợp và không có nhận thức về hình thái học. Ngay cả OMT-1600, vốn được huấn luyện riêng cho CRK, cũng sử dụng phân tách từ tố BPE tiêu chuẩn nên không thể biểu diễn cấu trúc hình thái đa tổng hợp. Dữ liệu huấn luyện cung cấp bối cảnh ngôn ngữ mà mô hình còn thiếu.

Đối với các ngôn ngữ giàu tài nguyên (tiếng Pháp, tiếng Tây Ban Nha), coaching ít có tác động hơn vì mô hình đã có kiến thức nền tảng mạnh mẽ.

Xem [Dữ liệu huấn luyện (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data) để biết thông số kỹ thuật đầy đủ.

---

## FST & Xác thực hình thái

### Nếu không có FST cho ngôn ngữ của tôi thì sao?

Nhiều ngôn ngữ không có bộ chuyển đổi trạng thái hữu hạn (FST). Điều đó không sao cả — harness vẫn hoạt động bình thường mà không cần có nó. Chỉ số tiêu đề vẫn luôn là chrF++, do đó các lượt chạy có hoặc không có FST đều được chấm điểm như nhau; độ chấp nhận FST là một chỉ số chẩn đoán, và nó được đánh dấu `null` trong thẻ lượt chạy khi không có FST nào được sử dụng.

Các kho đăng ký chính cho các FST hiện có:

| Kho đăng ký | Phạm vi bao phủ | URL |
|-------------|-----------------|-----|
| **GiellaLT** | Hơn 100 ngôn ngữ — các ngôn ngữ Sámi, Cree, Inuktitut và nhiều ngôn ngữ Uralic cùng các ngôn ngữ thiểu số khác | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 cặp ngôn ngữ, chủ yếu là châu Âu | [apertium.org](https://apertium.org/) |
| **UniMorph** | Hệ hình thái cho hơn 150 ngôn ngữ | [unimorph.github.io](https://unimorph.github.io/) |

### Tôi có thể tự xây dựng một FST không?

Có, nhưng việc này không hề đơn giản. Một FST mã hóa các quy tắc hình thái của một ngôn ngữ — tất cả các dạng từ hợp lệ. Việc xây dựng một FST đòi hỏi kiến thức ngôn ngữ học sâu sắc về ngôn ngữ đó. Nếu bạn có quyền truy cập vào ngữ pháp hình thái (ví dụ: từ một khoa ngôn ngữ học), nó có thể được biên dịch thành FST bằng các công cụ như [HFST](https://hfst.github.io/) hoặc [Foma](https://fomafst.github.io/).

### Cơ chế lọc bằng FST (FST gating) hoạt động như thế nào trên thực tế?

Quy trình lọc bằng FST hoạt động như sau:

1. LLM tạo ra một bản dịch
2. Mỗi từ trong đầu ra được kiểm tra đối chiếu với FST
3. Những từ bị FST từ chối sẽ bị gắn cờ là không hợp lệ về mặt hình thái
4. Phương pháp có thể thử lại với phản hồi ("từ X không hợp lệ, hãy thử lại")
5. Sau các lần thử lại, những từ không hợp lệ còn lại sẽ được ghi nhật ký (log)

Tỷ lệ chấp nhận FST đo lường số lượng từ vượt qua bước xác thực. Xem [Hướng dẫn quy trình lọc bằng FST](/docs/network/tutorials/fst-gated-pipeline) để biết ví dụ thực tế hoàn chỉnh.

---

## Dữ liệu & Tập dữ liệu

### Tôi có thể đóng góp tập dữ liệu cho một ngôn ngữ mới không?

Có. Các yêu cầu tối thiểu từ [Thông số kiểm thử điểm chuẩn §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 mục nhập chuẩn vàng (gold-standard)** (nguồn + bản dịch tham chiếu đã xác minh)
- **30 mục nhập phát triển (development)** (có thể trùng lặp với chuẩn vàng đối với các ngữ liệu nhỏ)
- **Sự đồng thuận của cộng đồng** (đối với các ngôn ngữ bản địa, cần có sự cho phép rõ ràng từ một cơ quan quản lý)
- **Tài liệu về nguồn gốc dữ liệu** (dữ liệu đến từ đâu, áp dụng giấy phép nào)

Các tập dữ liệu mới sẽ tự động mở ra các nhánh bảng xếp hạng mới. Xem [Dành cho cộng đồng ngôn ngữ](/docs/network/community/for-language-communities) để biết hướng dẫn dành cho người đóng góp.

### Tập dữ liệu của tôi nên ở định dạng nào?

Định dạng JSON với các tên trường chuẩn hóa:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

Xem [Tập dữ liệu](/docs/network/leaderboard/datasets) để biết schema đầy đủ và định nghĩa về các phân hạng độ khó.

---

## Chủ quyền & Quyền sở hữu

### Ai sở hữu một phương pháp được xây dựng cho một ngôn ngữ bản địa?

Đối với các ngôn ngữ bản địa, một phương pháp đáp ứng tiêu chuẩn của giải thưởng — ngưỡng tự động của nó và sự xác thực của cộng đồng từ những người nói ngôn ngữ — sẽ kích hoạt quy trình [chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer) theo mẫu mặc định. Quyền sở hữu mã nguồn sẽ được chuyển giao từ nhà nghiên cứu sang tổ chức quản trị của cộng đồng ngôn ngữ đó.

Nhà nghiên cứu vẫn giữ lại:
- Quyền công bố (các bài báo học thuật về phương pháp này)
- Ghi nhận đóng góp trên bảng xếp hạng
- Quyền áp dụng các *kỹ thuật* tương tự cho các ngôn ngữ khác

Tổ chức quản lý sẽ nhận được:
- Toàn quyền sở hữu mã nguồn phương pháp và dữ liệu huấn luyện (coaching data)
- Quyền kiểm soát việc triển khai (khi nào, ở đâu, như thế nào) — và mọi lợi ích mà việc triển khai mang lại. Champollion là dự án phi thương mại và không lấy bất kỳ phần chia nào

### Tôi có thể sử dụng Champollion cho các ngôn ngữ không phải bản địa mà không cần lo ngại về vấn đề chủ quyền không?

Đúng vậy. Đối với các ngôn ngữ phổ biến (tiếng Pháp, tiếng Nhật, tiếng Tây Ban Nha, v.v.), không có yêu cầu nào cần xem xét về chủ quyền. Bạn hãy sử dụng Champollion như bình thường — dịch, đồng bộ, xuất bản theo ý muốn. Khung chủ quyền áp dụng riêng cho các ngôn ngữ bản địa và các ngôn ngữ do cộng đồng quản trị, nơi các nguyên tắc quản trị dữ liệu — quyền sở hữu và quyền kiểm soát của cộng đồng đối với dữ liệu ngôn ngữ, CARE, Te Mana Raraunga — đòi hỏi sự quan tâm đặc biệt.

---

## Xem thêm

- **[Cách thức hoạt động](https://champollion.dev/how-it-works)** — giải thích chi tiết về giải pháp
- **[Thông số tính điểm](/docs/network/specifications/scoring)** — nguồn sự thật duy nhất (SSOT) cho tất cả logic tính điểm (chỉ số, trọng số, phân hạng)
- **[Thông số kiểm thử điểm chuẩn](/docs/network/specifications/benchmark)** — giao thức đánh giá, định dạng ngữ liệu, chủ quyền
- **[Gửi một phương pháp](/docs/network/getting-started/submit-a-method)** — hướng dẫn nhanh từng bước
- **[Quy tắc bảng xếp hạng](/docs/network/leaderboard/rules)** — tiêu chí gửi kết quả
- **[Quản lý dữ liệu](/docs/network/sovereignty/data-sovereignty)** — ngữ liệu vẫn ở lại với người quản lý của chúng; mọi giấy phép đều được tôn trọng
