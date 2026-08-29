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

Harness tính toán năm chỉ số. Ba chỉ số không phụ thuộc vào ngôn ngữ và hoạt động với bất kỳ cặp ngôn ngữ nào; hai chỉ số còn lại hiện đang phụ thuộc vào các plugin dành riêng cho CRK và sẽ được tổng quát hóa khi chúng tôi mở rộng sang nhiều ngôn ngữ hơn. Các kho ngữ liệu tham chiếu có thể chạy được hiện nay là các bộ dữ liệu công cộng được cấp phép mở — Global Voices, Tatoeba, TICO-19, IN22, SMOL, và nhiều bộ dữ liệu khác (xem [Datasets](/docs/network/leaderboard/datasets)) — và bảng xếp hạng luôn mở nhận bài nộp cho mọi cặp ngôn ngữ đã đăng ký. Plains Cree chỉ đơn giản là nơi hai chỉ số dành riêng cho ngôn ngữ (được hỗ trợ bởi FST) được triển khai đầu tiên.

| Chỉ số | Thang đo | Đo lường cái gì | Trạng thái |
|--------|-------|-----------------|--------|
| **chrF++** | 0–100 | Độ trùng lặp n-gram ký tự giữa bản dịch dự đoán và bản dịch tham chiếu. Chỉ số bề mặt tốt nhất cho các ngôn ngữ giàu hình thái. Sử dụng cách tính điểm gốc của sacrebleu. | ✅ Tất cả ngôn ngữ |
| **Exact match** | 0.0–1.0 | Tỷ lệ các mục nhập mà bản dịch dự đoán khớp hoàn toàn với bản dịch tham chiếu sau khi chuẩn hóa. | ✅ Tất cả ngôn ngữ |
| **FST acceptance** | 0.0–1.0 | Tỷ lệ các từ đầu ra được chấp nhận bởi bộ chuyển đổi trạng thái hữu hạn (bộ phân tích hình thái). Chỉ được tính khi có tệp nhị phân FST. | ✅ Tất cả ngôn ngữ có FST |
| **Equivalent match** | 0.0–1.0 | Tỷ lệ các mục nhập khớp với bản dịch tham chiếu hoặc một biến thể chấp nhận được — có tính đến trật tự từ, quy ước chính tả và khác biệt phương ngữ. | ⚡ CRK (đang tổng quát hóa) |
| **Semantic score** | 0.0–1.0 | Điểm bảo toàn ngữ nghĩa — bản dịch truyền tải ý nghĩa dự định tốt như thế nào, bất kể hình thức bề mặt? | ⚡ CRK (đang tổng quát hóa) |

Các chỉ số bổ sung đã được lên kế hoạch: **độ chính xác hình thái (morphological accuracy)**, **phát hiện chuyển mã (code-switching detection)**, **tuân thủ thuật ngữ (terminology adherence)**, và **phát hiện ảo tưởng (hallucination detection)**. Xem [Thông số tính điểm §2](/docs/network/specifications/scoring#2-metric-inventory) để biết danh mục chỉ số đầy đủ (sáu danh mục).

### Điểm tổng hợp (composite score) được tính như thế nào?

Điểm tổng hợp là trung bình có trọng số của các chỉ số hiện có, được chuẩn hóa về thang đo 0.0–1.0. Trọng số được định nghĩa trong hai cấu hình (profile):

- **Cấu hình A** (ngôn ngữ có FST): 9 chỉ số, các chỉ số cấu trúc (FST + độ chính xác hình thái) chiếm 40% trọng số tổng hợp
- **Cấu hình B** (ngôn ngữ không có FST): 8 chỉ số, chỉ số ngữ nghĩa và chrF++ chiếm trọng số cao nhất bằng nhau

Khi một chỉ số không khả dụng, trọng số của nó sẽ được phân bổ lại theo tỷ lệ cho các chỉ số còn lại. Điều này có nghĩa là các điểm chuẩn giai đoạn đầu (chỉ có chrF++ và exact match) vẫn tạo ra điểm tổng hợp hợp lệ — trọng số thực tế chỉ phản ánh những gì đang có sẵn.

**Bảng trọng số đầy đủ, quy tắc chuẩn hóa và lý do loại trừ có trong [Thông số tính điểm §4](/docs/network/specifications/scoring#4-composite-score).** Mã nguồn của bộ công cụ kiểm thử phản ánh chính xác các bảng này trong `mt_eval_harness/scoring.py`. chrF++ được chuẩn hóa bằng cách chia cho 100 trước khi tính trọng số; tỷ lệ chuyển mã và tỷ lệ ảo tưởng được đảo ngược (thấp hơn = tốt hơn).

### Các phân hạng chất lượng (quality tiers) là gì?

Các phân hạng chất lượng là các nhãn heuristic được ánh xạ tới các khoảng điểm tổng hợp. Chúng giúp diễn giải ý nghĩa thực tế của một số điểm:

| Phân hạng | Khoảng điểm tổng hợp | Diễn giải |
|------|----------------|----------------|
| **Baseline** | 0.00 – 0.30 | Dưới mức chất lượng hữu ích. Phương pháp cần cải thiện đáng kể. |
| **Emerging** | 0.30 – 0.50 | Có triển vọng. Một số bản dịch chính xác nhưng không nhất quán. |
| **Functional** | 0.50 – 0.70 | Có thể dùng để tham khảo với sự kiểm duyệt của con người. Không phù hợp để triển khai trực tiếp mà không kiểm duyệt. |
| **Deployable** | 0.70 – 0.85 | Sẵn sàng để sử dụng thực tế với sự kiểm duyệt định kỳ. Kích hoạt điều kiện chuyển giao quyền sở hữu. |
| **Fluent** | 0.85 – 1.00 | Chất lượng gần như người bản xứ. Phù hợp để triển khai tự động không cần giám sát. |

### Sự khác biệt giữa phân hạng chất lượng và phân hạng xác minh là gì?

**Phân hạng chất lượng (quality tiers)** mô tả *ý nghĩa của điểm số tự động* (Baseline → Fluent). **Phân hạng xác minh (verification tiers)** mô tả *ai đã xác thực kết quả đó*:

| Cấp độ xác minh | Ý nghĩa |
|-------------------|---------------|
| **Tự đánh giá** | Người gửi đã tự chạy harness. Điểm số có vẻ hợp lý nhưng chưa được xác minh. |
| **Đã xác minh bởi Champollion** | Một người bảo trì đã tái tạo lại kết quả bằng cách sử dụng cấu hình phương pháp đã gửi. |
| **Đã xác thực bởi cộng đồng** | Những người nói song ngữ của ngôn ngữ đích, đủ điều kiện theo giao thức riêng của cộng đồng, đã đánh giá một mẫu phân tầng của đầu ra (≥30 mục, ≥2 người đánh giá) và ≥70% đạt tiêu chuẩn của cộng đồng. Chỉ được cấp thông qua quá trình kiểm thử của chính cộng đồng; việc giáng cấp do kiểm tra đột xuất (spot-audit) cũng mang tính đối xứng và được công khai tương tự. |

Một phương pháp có thể đạt chất lượng "Deployable" nhưng chỉ ở mức xác minh "Self-benchmarked" — nghĩa là điểm số trông rất tuyệt nhưng chưa có ai xác nhận độc lập.

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

1. **Tự đánh giá (tự động):** Mọi bản gửi đều bắt đầu ở đây.
2. **Đã xác minh bởi Champollion (tự động):** Máy chủ chấm điểm lại các đầu ra bạn đã gửi so với kho ngữ liệu tham chiếu được ghim mã băm (sha-pinned) bằng số liệu của harness. Khi điểm số của bạn được tái tạo, lần chạy đó sẽ được thăng cấp lên Đã xác minh bởi Champollion — cấp độ duy nhất được xếp hạng trên bảng. Nếu không thể tái tạo, hoặc một tham chiếu được lưu trữ đã bị thay đổi, lần chạy đó sẽ bị loại.
3. **Đã xác thực bởi cộng đồng:** Những người nói song ngữ của ngôn ngữ đích, đủ điều kiện theo giao thức riêng của cộng đồng, đánh giá một mẫu phân tầng từ đầu ra của phương pháp của bạn — ít nhất 30 mục, ít nhất 2 người đánh giá — và ít nhất 70% phải đạt tiêu chuẩn của cộng đồng. Cấp độ này chỉ được cấp thông qua quá trình kiểm thử do chính cộng đồng tự chạy, theo quyết định của họ, và có thể bị thu hồi theo cách tương tự: một cuộc kiểm tra đột xuất thất bại sẽ giáng cấp phương pháp một cách công khai tương tự. Quá trình này không thể tự động hóa — nó đòi hỏi sự tham gia của cộng đồng.

### Tại sao bạn không chạy lại phương pháp của tất cả mọi người để xác minh?

Bởi vì chúng tôi không đủ khả năng chi trả và cũng không cần thiết phải làm vậy. Máy chủ chấm điểm lại đầu ra đã gửi của *tất cả mọi người* miễn phí (điều này giúp phát hiện các điểm số được nhập tay hoặc bị chỉnh sửa). Việc thực sự chạy lại một mô hình tiêu tốn tài nguyên máy tính thực tế, vì vậy chúng tôi thực hiện điều đó trên một **mẫu** được chọn bằng phương pháp **kiểm toán theo trọng số uy tín (reputation-weighted auditing)**: một lần chạy luôn được chạy lại nếu nó có tầm quan trọng cao (nó thắp sáng cây cầu đầu tiên đến toàn bộ một ngữ hệ) hoặc bất thường (một bước nhảy vọt quá tốt đến mức khó tin so với kết quả tốt nhất trước đó), và đối với những người đóng góp đã được chứng minh, nó hiếm khi bị kiểm tra đột xuất. Uy tín chỉ đạt được bằng cách vượt qua các cuộc kiểm toán này (hoặc bởi một người đóng góp độc lập chứng thực kết quả của bạn) — không bao giờ dựa trên số lượng — vì vậy những danh tính dùng một lần mới tạo sẽ không thu được lợi ích gì. Một hành vi làm giả bị phát hiện sẽ đưa uy tín của người đóng góp về 0, kiểm toán lại toàn bộ lịch sử đã xác minh của họ và được ghi lại công khai, giống như một sự thu hồi (retraction). Chúng tôi **không** tuyên bố lần chạy của bạn "đã đi qua harness" — đối với tài nguyên máy tính tự lưu trữ không thể xác minh bằng máy chủ — vì vậy tính hợp lệ dựa trên *khả năng tái tạo + cổ phần uy tín + sự chứng thực*, chứ không phải dựa trên sự chứng nhận. Xem [Quy tắc đánh giá MT](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) để biết toàn bộ mô hình.

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

Nhiều ngôn ngữ không có bộ chuyển đổi trạng thái hữu hạn (FST). Điều đó không sao cả — bộ công cụ kiểm thử vẫn hoạt động bình thường mà không cần nó. Điểm tổng hợp sẽ sử dụng trọng số của Cấu hình B (see [Thông số tính điểm §4.3](/docs/network/specifications/scoring#43-weight-tables)) để chuyển trọng số sang các chỉ số ngữ nghĩa và bề mặt. Tỷ lệ chấp nhận FST được đánh dấu là `null` trong thẻ chạy.

Các kho đăng ký chính cho các FST hiện có:

| Sổ đăng ký | Độ bao phủ | URL |
|----------|----------|-----|
| **GiellaLT** | Hơn 100 ngôn ngữ — các ngôn ngữ Sámi, Cree, Inuktitut, và nhiều ngôn ngữ Uralic cũng như ngôn ngữ thiểu số khác | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 cặp ngôn ngữ, chủ yếu là châu Âu | [apertium.org](https://apertium.org/) |
| **UniMorph** | Các hệ biến hóa hình thái cho hơn 150 ngôn ngữ | [unimorph.github.io](https://unimorph.github.io/) |

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

Đối với các ngôn ngữ bản địa, các phương pháp đạt đến phân hạng Deployable (điểm tổng hợp ≥ 0.70) VÀ vượt qua bước xác thực của cộng đồng sẽ kích hoạt quy trình [chuyển giao quyền sở hữu](/docs/network/sovereignty/ownership-transfer). Quyền sở hữu mã nguồn sẽ chuyển giao từ nhà nghiên cứu sang tổ chức quản lý của cộng đồng ngôn ngữ đó.

Nhà nghiên cứu vẫn giữ lại:
- Quyền công bố (các bài báo học thuật về phương pháp này)
- Ghi nhận đóng góp trên bảng xếp hạng
- Quyền áp dụng các *kỹ thuật* tương tự cho các ngôn ngữ khác

Tổ chức quản lý sẽ nhận được:
- Toàn quyền sở hữu mã nguồn phương pháp và dữ liệu huấn luyện (coaching data)
- Quyền kiểm soát việc triển khai (khi nào, ở đâu, như thế nào) — và mọi lợi ích mà việc triển khai mang lại. Champollion là dự án phi thương mại và không lấy bất kỳ phần chia nào

### Tôi có thể sử dụng Champollion cho các ngôn ngữ không phải bản địa mà không cần lo ngại về vấn đề chủ quyền không?

Có. Đối với các ngôn ngữ phổ biến (tiếng Pháp, tiếng Nhật, tiếng Tây Ban Nha, v.v.), không có vấn đề chủ quyền nào cần xem xét. Hãy sử dụng Champollion một cách bình thường — dịch thuật, đồng bộ hóa, xuất bản tùy ý bạn. Khung chủ quyền áp dụng cụ thể cho các ngôn ngữ bản địa và ngôn ngữ do cộng đồng quản lý, nơi các nguyên tắc quản trị dữ liệu (chủ quyền dữ liệu của First Nations, CARE, Te Mana Raraunga) yêu cầu sự cân nhắc đặc biệt.

---

## Xem thêm

- **[Cách thức hoạt động](https://champollion.dev/how-it-works)** — giải thích chi tiết về giải pháp
- **[Thông số tính điểm](/docs/network/specifications/scoring)** — nguồn sự thật duy nhất (SSOT) cho tất cả logic tính điểm (chỉ số, trọng số, phân hạng)
- **[Thông số kiểm thử điểm chuẩn](/docs/network/specifications/benchmark)** — giao thức đánh giá, định dạng ngữ liệu, chủ quyền
- **[Gửi một phương pháp](/docs/network/getting-started/submit-a-method)** — hướng dẫn nhanh từng bước
- **[Quy tắc bảng xếp hạng](/docs/network/leaderboard/rules)** — tiêu chí gửi kết quả
- **[Quản lý dữ liệu](/docs/network/sovereignty/data-sovereignty)** — ngữ liệu vẫn ở lại với người quản lý của chúng; mọi giấy phép đều được tôn trọng

