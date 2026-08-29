---
sidebar_position: 3
title: "Đo lường những điều không thể đo lường"
---

# Đo lường Điều không thể Đo lường: Bài toán Đánh giá trong Dịch máy

**Khảo sát về cách ngành dịch thuật đo lường chất lượng dịch máy, những điểm hạn chế, và giải pháp thay thế từ LYSS (Linguistically-informed Yield & Structural Scoring)**

---

> *"Các số liệu tự động là một lời nói dối tiện lợi. Chúng cho chúng ta một con số, con số đó giúp chúng ta viết một bài báo, và bài báo đó giúp chúng ta tuyên bố về sự tiến bộ. Liệu sự tiến bộ đó có thực sự xảy ra hay không lại là một câu hỏi hoàn toàn khác."*
> — Phỏng theo một quan điểm phổ biến tại WMT Metrics Shared Tasks

---

## Giới thiệu

Dịch máy đang gặp phải một bài toán lớn về đo lường.

Ngành này đã dành hai thập kỷ để xây dựng các hệ thống ngày càng phức tạp — từ bảng cụm từ (phrase tables), cơ chế chú ý (attention mechanisms) cho đến các mô hình ngôn ngữ hàng nghìn tỷ tham số — và trong suốt hành trình đó, nó luôn phải vật lộn với một câu hỏi tưởng chừng đơn giản: *làm thế nào để biết một bản dịch là tốt?*

Câu hỏi này không mang tính học thuật thuần túy. Chỉ số đo lường (metric) bạn chọn sẽ quyết định hệ thống nào "chiến thắng". Nó quyết định dự án nào được cấp vốn, bài báo nào được xuất bản, hệ thống nào được triển khai, và — đối với những ngôn ngữ cần dịch máy nhất — liệu các bản dịch của một cộng đồng có bị đánh giá là thất bại hay không, ngay cả khi chúng thực sự chính xác.

Lịch sử đánh giá dịch máy (MT) là một hình ảnh thu nhỏ về các giá trị của ngành này. Sự thống trị của BLEU trong gần hai thập kỷ cho thấy sự ưu tiên dành cho các phép đo giá rẻ, nhanh chóng, không phụ thuộc vào ngôn ngữ hơn là các đánh giá dựa trên ngôn ngữ học. Sự trỗi dậy của các số liệu mạng nơ-ron như COMET phản ánh sự phát triển ngày càng tinh vi của ngành — cũng như sự phụ thuộc liên tục của nó vào dữ liệu huấn luyện lấy tiếng Anh làm trung tâm. Sự vắng bóng gần như hoàn toàn của các đánh giá nhận biết hình thái (morphology-aware evaluation) phản ánh một lĩnh vực mà cho đến gần đây, vẫn được xây dựng bởi và dành cho những người nói các ngôn ngữ châu Âu mang tính phân tích (analytic European languages).

Tài liệu này theo dõi sự phát triển của việc đánh giá dịch máy từ BLEU đến nay, chỉ ra những điểm mà các phương pháp hiện tại thất bại một cách hệ thống đối với các ngôn ngữ có cấu trúc hình thái phức tạp và tài nguyên thấp, đồng thời xem xét một giải pháp thay thế dựa trên nền tảng ngôn ngữ học sẽ trông như thế nào. Đây là tài liệu đồng hành với các tài liệu ngữ cảnh khác của dự án — [*Từ Pāṇini đến Transformers*](./history-of-language-and-computation.md) (theo dấu lịch sử trí tuệ của ngôn ngữ và tính toán) và [*Báo cáo Thực địa*](./mt-field-briefing.md) (khảo sát bối cảnh dịch máy hiện tại). Trong khi các tài liệu đó đặt câu hỏi "làm thế nào chúng ta đến được đây?" và "những gì đang tồn tại?", tài liệu này sẽ hỏi: "làm thế nào để chúng ta biết liệu có bất kỳ giải pháp nào thực sự hiệu quả?"

---

## Phần 1: Kỷ nguyên Khớp Chuỗi (2002–2015)

### BLEU và Sự ra đời của Đánh giá Tự động



Kỷ nguyên hiện đại của đánh giá dịch máy bắt đầu bằng một bài báo duy nhất: "BLEU: a Method for Automatic Evaluation of Machine Translation" của Kishore Papineni, Salim Roukos, Todd Ward, và Wei-Jing Zhu, được xuất bản tại ACL 2002. BLEU (Bilingual Evaluation Understudy) đo lường mức độ trùng khớp giữa các chuỗi từ (n-gram) của bản dịch máy với một hoặc nhiều bản dịch tham chiếu của con người. Nó bao gồm một hình phạt độ dài ngắn (brevity penalty) để ngăn các hệ thống "gian lận" điểm số bằng các đầu ra ngắn, và tính trung bình nhân của độ chính xác n-gram từ bậc 1 đến bậc 4.

BLEU trở thành "tiền tệ" của ngành vì một lý do đơn giản: nó nhanh, rẻ, có thể tái lập và không phụ thuộc vào ngôn ngữ. Trước BLEU, việc đánh giá một hệ thống dịch máy đòi hỏi sự thẩm định tốn kém và chậm chạp từ con người. BLEU cung cấp một con số có thể được tính toán trong vài mili giây, dễ dàng so sánh giữa các bài báo và được sử dụng để xếp hạng các hệ thống trong các nhiệm vụ chung (shared tasks). Chỉ trong vài năm, nó gần như trở thành bắt buộc — một bài báo không có điểm BLEU sẽ không thể xuất bản.

Nhưng BLEU có những khuyết điểm sâu sắc, đã được ghi nhận rõ ràng mà ngành này đã mất hai thập kỷ để cố gắng khắc phục:

**Không có sự hiểu biết về ngữ nghĩa.** BLEU thuần túy là so khớp bề mặt. "The cat sat on the mat" (Con mèo ngồi trên tấm thảm) sẽ nhận điểm 0 so với bản dịch tham chiếu "the feline rested on the rug" (con thú họ mèo nghỉ ngơi trên tấm thảm nhỏ). Mọi từ đều là từ đồng nghĩa chính xác; ý nghĩa hoàn toàn giống nhau; nhưng điểm số vẫn là 0.

**Mù mờ về hình thái học.** Đối với các ngôn ngữ chắp dính (agglutinative) và đa tổng hợp (polysynthetic), việc so khớp nghiêm ngặt ở cấp độ từ sẽ thất bại thảm hại. Một động từ tiếng Plains Cree được chia thì chính xác nhưng chỉ khác một hình vị (morpheme) so với bản dịch tham chiếu sẽ nhận điểm 0 — ngay cả khi sự khác biệt đó chỉ là một tiểu từ tùy chọn về mặt ngữ pháp hoặc một trật tự từ có giá trị tương đương.

**Khả năng phân biệt kém ở cấp độ câu.** BLEU được thiết kế như một số liệu ở cấp độ ngữ liệu (corpus-level). Ở cấp độ câu, nó rất nhiễu và không đáng tin cậy — tuy nhiên nó vẫn thường xuyên được áp dụng cho các câu đơn lẻ.

**Thiên vị một bản dịch tham chiếu duy nhất.** BLEU giả định rằng chỉ có *một* bản dịch chính xác (hoặc một tập hợp nhỏ các bản dịch tham chiếu). Đối với các ngôn ngữ có trật tự từ tự do, từ vựng phong phú từ đồng nghĩa hoặc có sự mơ hồ mang tính hệ thống (như đại từ "chúng tôi/chúng ta" bao gồm/loại trừ của tiếng Cree), có thể có hàng tá bản dịch chính xác như nhau, và BLEU sẽ phạt tất cả trừ bản dịch ngẫu nhiên trùng khớp với tham chiếu.

**Tương quan yếu với đánh giá của con người.** Các phân tích gộp (meta-analyses) — đặc biệt là của Reiter (2018, *Computational Linguistics*) — đã chỉ ra rằng mối tương quan của BLEU với các đánh giá chất lượng của con người thường rất yếu, đặc biệt là đối với các hệ thống chất lượng cao và các ngôn ngữ khác xa tiếng Anh.

Những khuyết điểm này đã được biết đến ngay từ đầu. Tuy nhiên, BLEU vẫn tồn tại vì các giải pháp thay thế tệ hơn — không phải về độ chính xác, mà là về sự tiện lợi. Ngành này đã tối ưu hóa cho số liệu mà họ có thể tính toán được, chứ không phải số liệu họ thực sự cần.

### NIST (Doddington, 2002)

Số liệu NIST, được George Doddington công bố cùng năm với BLEU tại HLT 2002, đã sửa đổi công thức BLEU theo hai cách. Thứ nhất, nó trọng số hóa các n-gram dựa trên **thông tin chứa đựng (information content)** của chúng — các n-gram hiếm gặp sẽ nhận được trọng số cao hơn các n-gram phổ biến, dựa trên trực giác rằng việc dịch chính xác một cụm từ bất thường sẽ mang lại nhiều thông tin hơn là dịch chính xác từ "of the". Thứ hai, nó sử dụng **trung bình cộng** thay vì trung bình nhân của BLEU, tạo ra điểm số ổn định hơn và không bị giảm xuống 0 khi bất kỳ bậc n-gram nào không có kết quả khớp. NIST đã được sử dụng rộng rãi trong các chương trình đánh giá DARPA TIDES và NIST OpenMT nhưng chưa bao giờ đạt được sự thống trị như BLEU trong cộng đồng nghiên cứu rộng lớn hơn. Bất chấp những cải tiến, nó vẫn chia sẻ hạn chế cơ bản của BLEU: so khớp chuỗi ở cấp độ bề mặt mà không có khái niệm về ý nghĩa.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) là một nỗ lực ban đầu nhằm giải quyết tính cứng nhắc của BLEU. Trong khi BLEU thực hiện so khớp từ chính xác, METEOR đã giới thiệu ba cải tiến:

1. **Tách gốc từ (Stemming)**: Các từ được đưa về dạng gốc trước khi so sánh, giúp ghi nhận một phần điểm cho các biến thể hình thái (ví dụ: "running" khớp với "ran" sau khi tách gốc).
2. **Khớp từ đồng nghĩa**: Sử dụng WordNet, METEOR nhận biết rằng "car" và "automobile" biểu thị cùng một khái niệm.
3. **Căn chỉnh từ (Word alignment)**: Thay vì đếm các n-gram trùng khớp, METEOR căn chỉnh rõ ràng các từ giữa bản dịch máy và bản dịch tham chiếu, sau đó tính toán độ chính xác (precision) và độ gợi nhớ (recall) cùng với một hình phạt phân mảnh (fragmentation penalty).

METEOR liên tục cho thấy mối tương quan cao hơn với đánh giá của con người so với BLEU. Nhưng nó đòi hỏi các tài nguyên đặc thù cho từng ngôn ngữ (bộ tách gốc từ, cơ sở dữ liệu từ đồng nghĩa) làm hạn chế khả năng áp dụng, và tốc độ tính toán cũng chậm hơn. Đối với tiếng Anh, nó tốt hơn. Đối với các ngôn ngữ tài nguyên thấp, các bộ tách gốc từ và cơ sở dữ liệu từ đồng nghĩa đơn giản là không tồn tại.

### TER (Snover và cộng sự, 2006)

Translation Edit Rate (Tỷ lệ chỉnh sửa bản dịch) đo lường số lượng chỉnh sửa tối thiểu (thêm, xóa, thay thế và *dịch chuyển cụm từ*) cần thiết để biến đổi bản dịch máy thành bản dịch tham chiếu, được chuẩn hóa theo độ dài của bản dịch tham chiếu. Thao tác dịch chuyển cụm từ — di chuyển một chuỗi từ liên tiếp sang một vị trí khác — là sự thừa nhận trực tiếp rằng trật tự từ không cố định giữa các ngôn ngữ. Cách tiếp cận khoảng cách chỉnh sửa (edit-distance) của TER rất trực quan (nó đo lường "con người cần thực hiện bao nhiêu công việc hiệu đính?") nhưng lại thừa hưởng cùng một hạn chế cơ bản: nó so sánh với một bản dịch tham chiếu duy nhất và không có khái niệm về ý nghĩa.

### chrF và chrF++ (Popović, 2015; 2017)

Cải tiến số liệu quan trọng nhất giữa BLEU và kỷ nguyên nơ-ron đến từ Maja Popović. **chrF** (character F-score) đo lường sự trùng khớp ở cấp độ *ký tự* thay vì cấp độ từ, tính toán độ chính xác và độ gợi nhớ của n-gram ký tự. **chrF++** bổ sung thêm các unigram và bigram ở cấp độ từ vào công thức này.

Tại sao điều này lại quan trọng đối với các ngôn ngữ giàu hình thái: việc so khớp ở cấp độ ký tự giúp *ghi nhận một phần điểm* cho các hình vị chung. Các từ tiếng Cree *nikî-nipâw* ("Tôi đã ngủ") và *kikî-nipâw* ("Bạn đã ngủ") chia sẻ hầu hết các n-gram ký tự của chúng mặc dù là các từ khác nhau. chrF sẽ ghi nhận một phần điểm đáng kể; trong khi BLEU sẽ cho điểm 0.

chrF++ đã trở thành một số liệu phụ tiêu chuẩn tại các nhiệm vụ chung của WMT, được triển khai trong **sacreBLEU** (Post, 2018), và được công nhận rộng rãi là vượt trội hơn BLEU đối với các ngôn ngữ giàu hình thái. Nhưng nó vẫn là một số liệu so khớp chuỗi — tốt hơn BLEU, nhưng về cơ bản vẫn bị giới hạn bởi cùng một giả định rằng chất lượng dịch thuật có thể được đo lường bằng sự trùng khớp dạng bề mặt.

---

## Phần 2: Cuộc Cách mạng Số liệu Nơ-ron (2018–Nay)



### Ý tưởng cốt lõi: Học cách chấm điểm

Các số liệu so khớp chuỗi ở Phần 1 chia sẻ một lựa chọn thiết kế cơ bản: chúng là các công thức được xây dựng thủ công. Ai đó đã quyết định rằng độ chính xác n-gram, sự trùng khớp ký tự hoặc khoảng cách chỉnh sửa là một đại diện tốt cho chất lượng dịch thuật, và sau đó mọi người đã sử dụng công thức đó trong suốt một thập kỷ.

Cuộc cách mạng số liệu nơ-ron bắt đầu bằng một câu hỏi khác: *điều gì sẽ xảy ra nếu chúng ta huấn luyện một mô hình để dự đoán chất lượng dịch thuật, giống như cách chúng ta huấn luyện các mô hình để dịch?*

### BERTScore (Zhang và cộng sự, 2020)

BERTScore, được công bố tại ICLR 2020 bởi Tianyi Zhang và các đồng nghiệp tại Cornell và MIT, là số liệu đầu tiên được áp dụng rộng rãi chuyển việc đánh giá từ so khớp chuỗi chính xác sang độ tương đồng ngữ nghĩa. Cơ chế của nó rất trang nhã: mã hóa cả bản dịch máy và bản dịch tham chiếu thông qua một mô hình Transformer đã được huấn luyện trước (BERT, RoBERTa, hoặc DeBERTa), tính toán độ tương đồng cosine giữa mọi cặp embedding của token, và sau đó sử dụng thuật toán khớp tham lam (greedy matching) để tính toán độ chính xác (mỗi token của bản dịch máy khớp tốt nhất với token nào trong bản dịch tham chiếu), độ gợi nhớ (mỗi token của bản dịch tham chiếu khớp tốt nhất với token nào trong bản dịch máy), và F1.

BERTScore xử lý các từ đồng nghĩa, diễn đạt lại (paraphrases) và các biến thể trật tự từ một cách tự nhiên — "the feline rested on the rug" có độ tương đồng cao với "the cat sat on the mat" vì các embedding ngữ cảnh nắm bắt được sự tương đương về mặt ngữ nghĩa. Với mBERT (multilingual BERT), nó mở rộng sang bất kỳ ngôn ngữ nào mà mô hình hỗ trợ.

Nhưng BERTScore không được *huấn luyện* trên các đánh giá chất lượng của con người. Nó sử dụng các embedding đã được huấn luyện trước ở dạng nguyên bản, điều đó có nghĩa là nó nắm bắt độ tương đồng ngữ nghĩa chung chung chứ không học cụ thể điều gì làm nên một bản dịch *tốt*. Sự khác biệt này rất quan trọng: một câu có thể tương đồng về mặt ngữ nghĩa với bản dịch tham chiếu nhưng lại là một bản dịch tồi (sai văn phong, bỏ sót phủ định, tự ý thêm từ hạn định). BERTScore cũng thừa hưởng bất kỳ sự thiên vị ngôn ngữ nào tồn tại trong mô hình nền tảng — đối với các ngôn ngữ ít được đại diện trong dữ liệu huấn luyện của BERT, các embedding có thể không nắm bắt được các ranh giới khác biệt có ý nghĩa.

### BLEURT (Sellam và cộng sự, 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), được công bố tại ACL 2020 bởi Thibault Sellam, Dipanjan Das, và Ankur Parikh tại Google, đã giới thiệu một cải tiến then chốt: **huấn luyện trước trên các biến đổi nhân tạo (synthetic perturbations)** trước khi tinh chỉnh trên các đánh giá của con người. Ý tưởng cốt lõi là việc tinh chỉnh trực tiếp một mô hình ngôn ngữ trên các tập dữ liệu đánh giá nhỏ của con người từ WMT sẽ tạo ra một số liệu rất mong manh — nó bị quá khớp (overfit) với các mẫu cụ thể trong dữ liệu huấn luyện và thất bại trên các đầu vào nằm ngoài phân phối.

Giải pháp của BLEURT là một quy trình huấn luyện hai giai đoạn. Trong giai đoạn một, hàng triệu cặp câu nhân tạo được tạo ra thông qua việc xóa từ ngẫu nhiên, thêm từ, thay thế và dịch ngược (backtranslation). Mô hình được huấn luyện để dự đoán điểm số của các số liệu tự động hiện có (BLEU, ROUGE, BERTScore, entailment) cho các cặp câu này — từ đó học được các khái niệm chung về độ tương đồng văn bản. Trong giai đoạn hai, mô hình đã được huấn luyện trước này được tinh chỉnh trên các xếp hạng Đánh giá Trực tiếp (Direct Assessment) của WMT. Bước "khởi động" này đã cải thiện đáng kể độ mạnh mẽ (robustness) của mô hình.

BLEURT-20 đã mở rộng phương pháp này sang đánh giá đa ngữ bằng cách sử dụng bộ mã hóa RemBERT của Google. Nhưng BLEURT vẫn chỉ dựa trên bản dịch tham chiếu (reference-only) — nó không sử dụng văn bản nguồn, điều đó có nghĩa là nó không thể phát hiện các lỗi ảo tưởng (hallucinations) dù bản dịch trông rất trôi chảy, và nó phụ thuộc hoàn toàn vào chất lượng của bản dịch tham chiếu.

### COMET (Rei và cộng sự, 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) đại diện cho công nghệ tiên tiến nhất hiện nay trong việc đánh giá dịch máy tự động. Được phát triển bởi Ricardo Rei và các đồng nghiệp tại **Unbabel**, COMET sử dụng một bộ mã hóa đa ngữ (XLM-RoBERTa) để nhúng ba đầu vào — câu nguồn, bản dịch máy và bản dịch tham chiếu — và dự đoán điểm chất lượng được huấn luyện trên các đánh giá Trực tiếp của con người.

COMET đã giành chiến thắng hoặc xếp thứ nhất trong các WMT Metrics Shared Tasks từ năm 2020 trở đi. Mối tương quan của nó với đánh giá của con người cao hơn đáng kể so với bất kỳ số liệu so khớp chuỗi nào. Nó nhận biết các cách diễn đạt lại, nắm bắt sự bảo toàn ý nghĩa và xử lý các biến thể từ đồng nghĩa mà BLEU hoàn toàn bỏ sót.

Nhưng COMET có một hạn chế nghiêm trọng đối với mục đích của chúng ta: nó được huấn luyện trên các đánh giá của con người từ WMT, vốn chủ yếu là các ngôn ngữ châu Âu. Bộ mã hóa đa ngữ của nó (XLM-R) được huấn luyện trên dữ liệu CommonCrawl, nơi mà tiếng Plains Cree, tiếng North Sámi và hầu hết các ngôn ngữ bản địa gần như vắng bóng. Đối với các ngôn ngữ này, các biểu diễn nội bộ của COMET là không đáng tin cậy — nó có thể đưa ra điểm số, nhưng những điểm số đó không dựa trên bất kỳ sự hiểu biết thực sự nào về cấu trúc của ngôn ngữ.

### xCOMET (Guerreiro và cộng sự, 2024)

xCOMET, được công bố trên TACL 2024 bởi Nuno Guerreiro, Ricardo Rei và các đồng nghiệp tại Unbabel và Instituto Superior Técnico, đã mở rộng COMET từ một công cụ chấm điểm hộp đen thành một **công cụ chẩn đoán**. Cải tiến then chốt là học đa nhiệm (multi-task learning): bên cạnh điểm chất lượng ở cấp độ câu, xCOMET thực hiện **gán nhãn chuỗi ở cấp độ dưới từ (subword-level sequence tagging)** để xác định các phân đoạn lỗi cụ thể trong bản dịch và phân loại chúng thành lỗi nhỏ (minor), lỗi lớn (major) hoặc lỗi nghiêm trọng (critical).

Điều này thu hẹp khoảng cách giữa chấm điểm tự động và phân tích lỗi của con người theo chuẩn MQM. Thay vì chỉ báo cáo "bản dịch này đạt 0.73 điểm", xCOMET có thể chỉ ra những từ cụ thể nào bị sai và mức độ nghiêm trọng của chúng. Quá trình huấn luyện sử dụng phương pháp học theo lộ trình (curriculum learning): đầu tiên huấn luyện trên dữ liệu Đánh giá Trực tiếp cho tác vụ hồi quy cấp độ câu, sau đó thêm dữ liệu được gán nhãn MQM với các nhãn phân đoạn lỗi để huấn luyện chung.

xCOMET đạt được hiệu suất tối ưu đồng thời ở cả cấp độ câu, cấp độ hệ thống và cấp độ phân đoạn lỗi. Nó hoạt động ở cả chế độ có tham chiếu (reference-based) và không có tham chiếu (reference-free). Nhưng nó đòi hỏi dữ liệu huấn luyện được gán nhãn MQM — vốn rất tốn kém để tạo ra và hầu như chỉ tồn tại cho các cặp ngôn ngữ châu Âu.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, được công bố tại NAACL 2024 bởi Jiayi Wang, David Ifeoluwa Adelani và các đồng nghiệp trong cộng đồng Masakhane, là minh chứng quan trọng nhất cho thấy các số liệu nơ-ron *bắt buộc phải* được điều chỉnh cho các ngôn ngữ ít phổ biến — chúng không thể tự động khái quát hóa một cách hiệu quả.

Bài báo đầu tiên đã chứng minh vấn đề: COMET tiêu chuẩn, được huấn luyện trên dữ liệu WMT từ các ngôn ngữ châu Âu, cho thấy mối tương quan yếu hơn đáng kể với đánh giá của con người khi áp dụng cho 13 ngôn ngữ châu Phi (bao gồm tiếng Amharic, Hausa, Igbo, Swahili, Yoruba và Zulu). Để khắc phục, cần có hai thay đổi. Thứ nhất, thay thế XLM-R bằng **AfroXLM-R**, một bộ mã hóa đa ngữ được huấn luyện đặc biệt để biểu diễn tốt hơn các ngôn ngữ châu Phi. Thứ hai, tạo ra **AfriMTE**, một tập dữ liệu đánh giá mới của con người với các hướng dẫn MQM được đơn giản hóa dành cho những người gán nhãn không chuyên — vì việc tìm kiếm các dịch giả chuyên nghiệp song ngữ cho các ngôn ngữ này là rất khó khăn.

AfriCOMET đã chứng minh tính khả thi của ý tưởng: một số liệu nơ-ron dành riêng cho một ngữ hệ có thể vượt trội hơn đáng kể so với phiên bản chung. Nhưng nó cũng cho thấy chi phí đi kèm: ai đó phải xây dựng AfroXLM-R, thu thập dữ liệu đánh giá của con người cho 13 ngôn ngữ và huấn luyện một mô hình mới. Đối với tiếng Plains Cree, không có bộ mã hóa tương đương, tập dữ liệu đánh giá của con người hay số liệu điều chỉnh nào tồn tại. Con đường của AfriCOMET sẽ đòi hỏi phải xây dựng tất cả những thứ này từ đầu — một nỗ lực kéo dài nhiều năm với sự tham gia của cộng đồng để đánh giá thủ công và có thể là một bộ mã hóa chuyên dụng cho ngữ hệ Algonquian.

### GEMBA: LLM làm Công cụ Đánh giá (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), được công bố tại EAMT 2023 bởi Tom Kocmi và Christian Federmann tại Microsoft, đã đặt ra một câu hỏi táo bạo: điều gì sẽ xảy ra nếu bạn chỉ cần *hỏi* GPT-4 xem một bản dịch có tốt hay không?

Cách tiếp cận này đơn giản đến mức đáng ngạc nhiên. **GEMBA-DA** gợi ý (prompt) LLM bằng câu nguồn và bản dịch máy, sau đó yêu cầu xếp hạng chất lượng trên thang điểm 0–100. **GEMBA-MQM** cung cấp ba ví dụ được gán nhãn và yêu cầu LLM xác định các phân đoạn lỗi cụ thể, phân loại chúng theo loại và mức độ nghiêm trọng, rồi đưa ra điểm số theo chuẩn MQM. Không cần huấn luyện riêng cho số liệu này.

Kết quả rất ấn tượng: ở cấp độ hệ thống, GEMBA đạt được mối tương quan cạnh tranh hoặc tối ưu với các đánh giá của con người. Các gán nhãn lỗi của GEMBA-MQM, mặc dù không đáng tin cậy bằng người chấm chuyên nghiệp, nhưng đã cung cấp thông tin chẩn đoán có thể giải thích được mà không cần bất kỳ quá trình huấn luyện chuyên biệt nào.

Nhưng GEMBA cũng dấy lên những lo ngại nghiêm trọng. Nó phụ thuộc vào các mô hình nguồn đóng độc quyền có hành vi thay đổi giữa các phiên bản API. Kết quả không thể tái lập theo nghĩa nghiêm ngặt. Chi phí vận hành lớn ở quy mô rộng (chi phí API để đánh giá toàn bộ tập kiểm thử WMT). Và — điều quan trọng đối với mục đích của chúng ta — sự hiểu biết của LLM về các ngôn ngữ tài nguyên thấp là không chắc chắn. GPT-4 có thể hiểu hoặc không hiểu cấu trúc hình thái của tiếng Plains Cree đủ tốt để đánh giá các bản dịch; không có cách nào để biết nếu không thử nghiệm, và không có gì đảm bảo hành vi này sẽ nhất quán qua các bản cập nhật mô hình. Bản thân Kocmi và Federmann cũng khuyên không nên sử dụng GEMBA để tuyên bố về các cải tiến trong các bài báo học thuật do tính chất hộp đen của việc đánh giá này.

### MetricX và Nhiệm vụ Chung về Số liệu WMT 2024

**MetricX-24**, được phát triển bởi Juraj Juraska, Daniel Deutsch, Mara Finkelstein và Markus Freitag tại Google, đã giành chiến thắng trong WMT 2024 Metrics Shared Task. Được xây dựng trên **mT5** (Multilingual T5, một mô hình encoder-decoder thay vì chỉ encoder như XLM-R được sử dụng bởi COMET), MetricX đi theo một lộ trình kiến trúc khác. Nó sử dụng quy trình tinh chỉnh hai giai đoạn — đầu tiên trên dữ liệu Đánh giá Trực tiếp, sau đó trên điểm số MQM — với việc **tăng cường dữ liệu nhân tạo (synthetic data augmentation)** trên diện rộng nhằm vào các lỗi thường gặp của số liệu (dịch thiếu, dịch trôi chảy nhưng sai nghĩa, ảo tưởng).

Bài báo tổng kết của WMT 2024, mang tên **"Are LLMs Breaking MT Metrics?"** (Liệu các LLM có đang phá vỡ các số liệu dịch máy?), đã đặt câu hỏi liệu các bản dịch do LLM tạo ra có làm hỏng hệ sinh thái số liệu hay không. Câu trả lời là không hoàn toàn: các số liệu nơ-ron được tinh chỉnh (MetricX-24, các biến thể COMET) vẫn hiệu quả, mặc dù các số liệu dựa trên LLM (các biến thể GEMBA) cho thấy sức mạnh đáng ngạc nhiên ở cấp độ hệ thống. Các phát hiện chính bao gồm:

- **Các số liệu nhận biết nguồn (Source-aware metrics)** (sử dụng nguồn + tham chiếu + bản dịch máy) liên tục vượt trội hơn các số liệu chỉ dựa trên bản dịch tham chiếu.
- **Các mô hình lai (Hybrid models)** hoạt động ở cả chế độ có tham chiếu và không có tham chiếu từ một kiến trúc duy nhất là hướng đi mới đang nổi lên.
- **Khoảng cách tài nguyên thấp** vẫn tồn tại: tất cả các số liệu đều hoạt động kém hơn trên các ngôn ngữ ít phổ biến, và khoảng cách này không hề thu hẹp.
- **Các số liệu được huấn luyện trên MQM** (sử dụng các gán nhãn lỗi chi tiết) liên tục vượt trội hơn các số liệu được huấn luyện trên DA (sử dụng điểm số vô hướng).

Các hàm ý đối với việc đánh giá ngôn ngữ tài nguyên thấp là rất rõ ràng: ngành này đang hội tụ về các số liệu nơ-ron lớn, được huấn luyện và nhận biết nguồn như một tiêu chuẩn vàng. Các số liệu này đòi hỏi lượng dữ liệu huấn luyện, tài nguyên tính toán lớn và — quan trọng nhất — dữ liệu đánh giá của con người trong ngôn ngữ đích. Đối với các ngôn ngữ không có bất kỳ tài nguyên nào trong số này, quy trình số liệu tiên tiến nhất hiện nay đơn giản là không thể áp dụng.

### Vấn đề Thiên vị: Số liệu Nơ-ron và Ngôn ngữ Tài nguyên Thấp

Cuộc cách mạng số liệu nơ-ron, phần lớn, là một hiện tượng của các ngôn ngữ tài nguyên cao. Mọi số liệu được huấn luyện trong các phần trước đều được huấn luyện trên dữ liệu đánh giá của con người từ WMT, vốn chỉ bao phủ khoảng 20 cặp ngôn ngữ — tất cả đều liên quan đến các ngôn ngữ châu Âu, tiếng Trung hoặc tiếng Nhật. Các bộ mã hóa nền tảng (XLM-R, mT5, InfoXLM) được huấn luyện trên dữ liệu CommonCrawl, nơi mức độ đại diện tỷ lệ thuận với sự hiện diện trên web: tiếng Anh thống trị, các ngôn ngữ châu Âu được bao phủ tốt, và phần lớn trong số hơn 7.000 ngôn ngữ trên thế giới thực tế là vắng bóng.

Đối với một ngôn ngữ như tiếng Plains Cree, điều này tạo ra một chuỗi thất bại liên hoàn:

1. **Không có dữ liệu huấn luyện**: Không có đánh giá của con người từ WMT cho các bản dịch tiếng Cree, vì vậy không có số liệu nào được huấn luyện để đánh giá chúng.
2. **Không có độ bao phủ của bộ mã hóa**: Từ vựng của XLM-R được xây dựng trên CommonCrawl, nơi văn bản tiếng Cree cực kỳ hiếm. Bộ phân tách từ (tokenizer) chia nhỏ các từ tiếng Cree thành các phân đoạn byte tùy ý, và các embedding ngữ cảnh cho các phân đoạn đó không được huấn luyện tốt.
3. **Không có sự xác thực**: Chưa có ai đo lường xem liệu COMET, BLEURT hay MetricX có tạo ra điểm số có ý nghĩa cho tiếng Cree hay không. Chúng có thể đưa ra *các con số*, nhưng không có bằng chứng nào cho thấy các con số đó tương quan với chất lượng dịch thuật thực tế.
4. **Không có lộ trình cải tiến**: Cách tiếp cận của AfriCOMET — xây dựng một bộ mã hóa riêng cho ngữ hệ, thu thập dữ liệu đánh giá của con người, huấn luyện một số liệu mới — là một nỗ lực kéo dài nhiều năm của nhiều tổ chức. Đối với một cộng đồng ngôn ngữ chỉ có 20.000 người nói, cơ sở hạ tầng nghiên cứu để hỗ trợ việc này hiện không tồn tại.

Kết quả là một nghịch lý: những ngôn ngữ cần đánh giá dịch máy khẩn cấp nhất (vì hệ thống dịch máy của chúng yếu nhất và cần đánh giá cẩn thận nhất) lại chính là những ngôn ngữ mà các công cụ đánh giá tốt nhất hoạt động kém tin cậy nhất. Phản ứng của ngành là đề xuất chrF++ như một giải pháp thay thế "đủ tốt" — và nó thực sự tốt hơn BLEU — nhưng chrF++ vẫn là một số liệu so khớp chuỗi không thể phát hiện sự tương đương, không thể xử lý trự tự từ tự do và không có khái niệm về tính hợp lệ của hình thái học.

---

## Phần 3: Vượt ra ngoài Điểm số — Đánh giá Chẩn đoán và Ngôn ngữ học

### Sự phân tách giữa Độ đầy đủ và Độ trôi chảy

Trước khi các số liệu tự động tồn tại, việc đánh giá dịch máy của con người đã sử dụng một khung đánh giá với hai khía cạnh: **độ đầy đủ (adequacy)** (bản dịch có truyền tải được ý nghĩa của nguồn không?) và **độ trôi chảy (fluency)** (bản dịch có đúng ngữ pháp và tự nhiên trong ngôn ngữ đích không?). Sự phân biệt này, được luật hóa trong các đánh giá dịch máy ban đầu của DARPA và sau đó là tại NIST, đã thừa nhận một điều mà các số liệu tự động phải mất hai thập kỷ để cố gắng tái hiện: chất lượng dịch thuật không phải là một chiều.

Khung đánh giá độ đầy đủ/độ trôi chảy đã không còn được ưa chuộng khi Đánh giá Trực tiếp (một điểm số vô hướng duy nhất) thay thế nó tại WMT. Nhưng ý tưởng cốt lõi vẫn vô cùng quan trọng: một bản dịch có thể trôi chảy nhưng sai nghĩa (ảo tưởng), hoặc không trôi chảy nhưng lại chính xác (biến thể hình thái). Không một điểm số đơn lẻ nào có thể nắm bắt được cả hai.

### MQM: Tiêu chuẩn Vàng (Lommel và cộng sự, 2014; Freitag và cộng sự, 2021)

**Multidimensional Quality Metrics (MQM)** đã thay thế Đánh giá Trực tiếp để trở thành phương pháp đánh giá thủ công chính của WMT từ năm 2021 trở đi. MQM sử dụng các dịch giả chuyên nghiệp để đánh dấu các phân đoạn lỗi cụ thể, phân loại chúng theo loại (dịch sai, bỏ sót, thêm từ, ngữ pháp, thuật ngữ) và mức độ nghiêm trọng (nhỏ = 1 điểm, lớn = 5 điểm, nghiêm trọng = 25 điểm). Điều này tạo ra cả điểm số chất lượng và thông tin chẩn đoán có thể hành động được.

MQM là phương pháp gần nhất với một phương pháp đánh giá "chính xác" — nó không chỉ cho bạn biết bản dịch *tệ đến mức nào*, mà còn cho biết *cụ thể điều gì đã sai*. Nhưng nó đòi hỏi các dịch giả chuyên nghiệp song ngữ, vốn là nguồn lực không tồn tại đủ nhiều đối với hầu hết các ngôn ngữ tài nguyên thấp để thực hiện đánh giá đáng tin cậy về mặt thống kê.

### MorphEval: Đánh giá Hình thái Tương phản (Burlot & Yvon, 2017)

MorphEval là tiền lệ trực tiếp nhất cho việc đánh giá dịch máy nhận biết hình thái học. Được giới thiệu bởi Franck Burlot và François Yvon tại WMT 2017 và mở rộng vào năm 2018, MorphEval đánh giá *năng lực* hình thái học bằng cách sử dụng **các bộ kiểm thử tương phản (contrastive test suites)**.

**Cách hoạt động:** Bộ kiểm thử bao gồm các cặp câu trong ngôn ngữ nguồn chỉ khác nhau đúng một tương phản hình thái — ví dụ: số ít so với số nhiều, hiện tại so với quá khứ, giống đực so với giống cái. Hệ thống dịch máy sẽ dịch cả hai câu. Nếu hệ thống truyền tải chính xác sự tương phản đó trong các bản dịch của mình (ví dụ: tạo ra một từ đích ở số nhiều khi nguồn là số nhiều và một từ đích ở số ít khi nguồn là số ít), tương phản đó được tính là chính xác.

**Các ngôn ngữ được bao phủ:** Tiếng Anh→Tiếng Séc, Tiếng Anh→Tiếng Latvia (v1, WMT 2017); mở rộng sang Tiếng Anh→Tiếng Pháp, Tiếng Anh→Tiếng Đức, Tiếng Anh→Tiếng Phần Lan, Tiếng Thổ Nhĩ Kỳ→Tiếng Anh (v2, WMT 2018).

**Các phát hiện chính:** MorphEval tiết lộ rằng ngay cả các hệ thống dịch máy nơ-ron hoạt động tốt nhất cũng có những thất bại mang tính hệ thống về hình thái học — chúng có thể tạo ra đầu ra trôi chảy nhưng lại sai thì, số hoặc cách. Những lỗi này vô hình trước BLEU và thậm chí vô hình một phần trước COMET.

**Tính khả dụng:** Mã nguồn mở trên GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Hạn chế:** MorphEval đòi hỏi các bộ kiểm thử tương phản được xây dựng thủ công cho từng ngôn ngữ đích, được thiết kế bởi các nhà ngôn ngữ học hiểu rõ các tương phản hình thái của ngôn ngữ đó. Không có bộ kiểm thử nào tồn tại cho bất kỳ ngôn ngữ đa tổng hợp nào. Phương pháp này kiểm tra *năng lực* (hệ thống có thể xử lý tương phản này không?) chứ không phải *tính hợp lệ* (hệ thống có tạo ra các từ thực tế không?) hay *sự tương đương* (hai bản dịch khác nhau này có cùng chính xác không?).

### CheckList: Kiểm thử Hành vi cho NLP (Ribeiro và cộng sự, ACL 2020)

**CheckList**, được công bố tại ACL 2020 bởi Marco Tulio Ribeiro và các đồng nghiệp (đạt giải Bài báo xuất sắc nhất), đã nhập khẩu một ý tưởng từ kỹ nghệ phần mềm vào việc đánh giá NLP: **kiểm thử đơn vị (unit testing)**. Thay vì đánh giá hiệu suất tổng hợp của mô hình trên một điểm chuẩn, CheckList định nghĩa một ma trận các **năng lực (capabilities)** (từ vựng, phủ định, thực thể được đặt tên, suy luận thời gian, đồng tham chiếu) kết hợp với **các loại kiểm thử**:

- **Kiểm thử Chức năng Tối thiểu (MFT)**: Các trường hợp kiểm thử đơn giản, có mục tiêu rõ ràng mà bất kỳ mô hình đủ năng lực nào cũng phải vượt qua.
- **Kiểm thử Tính Bất biến (INV)**: Các biến đổi đối với đầu vào mà *không* làm thay đổi đầu ra (ví dụ: thay đổi một cái tên không được làm thay đổi cảm xúc).
- **Kiểm thử Kỳ vọng Định hướng (DIR)**: Các biến đổi *sẽ* làm thay đổi đầu ra theo một hướng có thể dự đoán được.

Mặc dù ban đầu Checklist được thiết kế cho phân tích cảm xúc và suy luận ngôn ngữ tự nhiên (NLI), nhưng mô hình này hoàn toàn có thể áp dụng trực tiếp cho dịch máy. Người ta có thể tạo ra các MFT cho các hiện tượng hình thái ("hệ thống có tạo ra dạng số nhiều chính xác không?"), các kiểm thử INV cho trật tự từ tự do ("việc sắp xếp lại các từ tiếng Cree có làm thay đổi bản dịch tiếng Anh không?"), và các kiểm thử DIR cho các đặc trưng hình thái ("việc thay đổi nguồn từ thì quá khứ sang thì hiện tại có làm thay đổi thì của đích không?").

Mô hình CheckList đặc biệt phù hợp vì nó chính thức hóa những gì MorphEval thực hiện một cách trực quan: kiểm thử các năng lực cụ thể thay vì đo lường các điểm số tổng hợp. Các lớp biến thể của bộ linter của chúng tôi (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, v.v.) thực chất là các quy tắc bất biến — chúng định nghĩa các biến đổi không được làm thay đổi kết quả đánh giá.

### Các Tập Thử thách và Đánh giá Có Mục tiêu

Mô hình rộng hơn của **các tập thử thách (challenge sets)** — các bộ kiểm thử được xây dựng thủ công nhắm vào các hiện tượng ngôn ngữ cụ thể — đã trở thành một phương pháp đánh giá bổ sung được thiết lập tại WMT từ khoảng năm 2017.

**Isabelle, Cherry & Foster (2017)**, tại NRC Canada, đã tiên phong trong cách tiếp cận này cho dịch máy với các tập kiểm thử được xây dựng thủ công nhằm cô lập các điểm khác biệt về cấu trúc giữa các ngôn ngữ — những trường hợp mà dịch thô (literal translation) có khả năng cao là sai. Công việc tiếp theo của họ (Isabelle & Kuhn, 2018) đã xây dựng 506 câu tiếng Pháp nhắm vào các thử thách dịch thuật cụ thể, cung cấp bức tranh chi tiết về năng lực của hệ thống.

**LingEval97** (Sennrich, EACL 2017) đã tạo ra 97.000 cặp dịch tương phản Tiếng Anh→Tiếng Đức để kiểm tra xem các mô hình NMT có gán xác suất cao hơn cho các bản dịch chính xác so với các cặp câu có lỗi cú pháp hình thái được đưa vào hay không. Một phát hiện chính: các mô hình cấp độ ký tự xuất sắc trong việc chuyển tự (transliteration) nhưng hoạt động kém hơn trong việc hòa hợp cú pháp hình thái ở khoảng cách xa.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) đã mở rộng quy mô tiếp cận tập thử thách một cách mạnh mẽ: 36,476 ví dụ trải dài trên 146 cặp ngôn ngữ kiểm thử 68 hiện tượng ngôn ngữ khác nhau. ACES đã được sử dụng để siêu đánh giá (meta-evaluate) các số liệu được gửi đến nhiệm vụ chung về số liệu của WMT — kiểm tra xem *các số liệu* có thể phát hiện các tương phản hay không, chứ không chỉ là liệu *các hệ thống* có thể tạo ra chúng hay không. Được mở rộng thành **SPAN-ACES** với các gán nhãn phân đoạn lỗi.

**MT-GenEval** (Currey và cộng sự, EMNLP 2022) và **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) nhắm vào độ chính xác về giới tính một cách cụ thể. WinoMT đáng chú ý vì nó sử dụng rõ ràng **phân tích hình thái (morphological analysis)** trên ngôn ngữ đích để xác minh giới tính của các nghề nghiệp được dịch — một trong số ít trường hợp bộ phân tích hình thái được sử dụng như một phần của công cụ đánh giá dịch máy.

**Hjerson** (Popović & Ney, 2011) là một công cụ mã nguồn mở để phân loại lỗi dịch máy tự động sử dụng **các bổ đề (lemmas) và nhãn từ loại (POS tags)** để phân loại lỗi thành năm loại: hình thái, trật tự từ, thiếu từ, thừa từ và lỗi từ vựng. Đây có lẽ là tiền lệ gần nhất với bộ linter của chúng tôi về mặt tinh thần — nó sử dụng phân tích ngôn ngữ học để cung cấp các danh mục lỗi chẩn đoán thay vì một điểm số duy nhất.

Sợi chỉ đỏ xuyên suốt: ngành này đã thừa nhận, nhiều lần, rằng các điểm số tổng hợp là không đủ. Đánh giá chẩn đoán cung cấp mức độ chi tiết cần thiết để hiểu *tại sao* một hệ thống thất bại. Nhưng các phương pháp chẩn đoán đòi hỏi chuyên môn ngôn ngữ học cho từng ngôn ngữ, và chuyên môn đó đang tập trung chủ yếu ở các ngôn ngữ châu Âu.

### AmericasNLP: Đánh giá trong Thực tế

Chuỗi hội thảo AmericasNLP (được tổ chức cùng NAACL), tập trung vào NLP cho các ngôn ngữ bản địa của châu Mỹ, cung cấp điểm so sánh trực tiếp nhất cho các thử thách đánh giá của chúng tôi.

Từ năm 2021 đến năm 2023, nhiệm vụ chung đã sử dụng **chrF** làm số liệu đánh giá chính — được chọn vì tính mạnh mẽ của nó trong các thiết lập tài nguyên thấp và khả năng so khớp ở cấp độ ký tự, giúp ghi nhận một phần điểm cho sự trùng khớp hình thái. Ban tổ chức đã thừa nhận các hạn chế của chrF nhưng không có giải pháp thay thế nào tốt hơn có thể hoạt động trên các loại hình ngôn ngữ đa dạng được đại diện (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri, và các ngôn ngữ khác).

Vào năm 2025, AmericasNLP đã giới thiệu một **Nhiệm vụ chung 3 (Shared Task 3)** chuyên biệt dành riêng cho việc phát triển các số liệu đánh giá dịch máy cho các ngôn ngữ bản địa — lần đầu tiên ngành này thừa nhận một cách rõ ràng rằng các số liệu hiện tại là không đầy đủ cho các ngôn ngữ này. Giải pháp giành chiến thắng, **FUSE** (Feature-Union Scorer), đã kết hợp các embedding câu đa ngữ (LaBSE được tinh chỉnh), độ tương đồng từ vựng, độ tương đồng ngữ âm và so khớp token mờ thông qua hồi quy Ridge và Gradient Boosting. FUSE không sử dụng các bộ phân tích hình thái — việc thiết kế đặc trưng (feature engineering) của nó không phụ thuộc vào ngôn ngữ.

Đây chính là khoảng trống mà công việc của chúng tôi hướng tới. AmericasNLP đã xác định được vấn đề (các số liệu tiêu chuẩn thất bại đối với các ngôn ngữ bản địa) và bắt đầu phát triển các giải pháp thay thế (FUSE). Nhưng không có giải pháp thay thế nào sử dụng kiến thức hình thái học mà các FST cung cấp. Cộng đồng AmericasNLP sử dụng chrF++ vì đó là tùy chọn chung tốt nhất hiện có, trong khi cộng đồng GiellaLT xây dựng các công cụ hình thái học tinh vi nhưng chưa bao giờ được tích hợp vào việc đánh giá dịch máy. Hai cộng đồng này vẫn chưa hội tụ.

---

## Phần 4: Đánh giá Không có Tham chiếu và Ước lượng Chất lượng

Một số tín hiệu đánh giá quan trọng nhất trong khung thử nghiệm của chúng tôi hoàn toàn không yêu cầu các bản dịch tham chiếu. Việc kiểm tra tính hợp lệ bằng FST ("đây có phải là một từ thực tế không?") chỉ cần đầu ra của dịch máy. Bộ phát hiện ảo tưởng cần câu nguồn và bản dịch máy. Bộ phát hiện chuyển mã ngôn ngữ chỉ cần bản dịch máy và kiến thức về hệ chữ viết của ngôn ngữ đích. Việc hiểu những tín hiệu này nằm ở đâu trong bức tranh rộng lớn hơn của đánh giá không có tham chiếu là điều cần thiết để định vị chúng một cách chính xác.

### Mô hình Ước lượng Chất lượng

**Ước lượng Chất lượng (Quality Estimation - QE)** là một nhánh nhỏ của đánh giá dịch máy liên quan đến việc dự đoán chất lượng dịch thuật *không cần* các bản dịch tham chiếu. Đây là một nhiệm vụ chung chuyên biệt tại WMT từ năm 2012, được thúc đẩy bởi nhu cầu thực tế là đánh giá chất lượng dịch máy tại thời điểm triển khai — khi bạn đang dịch văn bản mới và không có bản dịch tham chiếu của con người để so sánh.

Nhiệm vụ QE đã phát triển qua ba thế hệ. **QE dựa trên đặc trưng (Feature-based QE)** (2012–2016) trích xuất các đặc trưng được xây dựng thủ công từ nguồn và bản dịch máy — độ hỗn loạn (perplexity) của mô hình ngôn ngữ, tần suất từ, sự trùng khớp n-gram với dữ liệu đơn ngữ — và huấn luyện các bộ phân loại để dự đoán chất lượng. **QE nơ-ron (Neural QE)** (2017–2021) thay thế các đặc trưng thủ công bằng các biểu diễn tự học, thường sử dụng các bộ mã hóa song ngữ. **QE hiện tại (Current QE)** (2022–nay) được thống trị bởi các phương pháp dựa trên COMET, đặc biệt là **CometKiwi**.

### CometKiwi và COMET Không có Tham chiếu

**CometKiwi** (Rei và cộng sự, WMT 2022), biến thể không có tham chiếu của COMET, sử dụng InfoXLM to mã hóa câu nguồn và bản dịch máy (không cần tham chiếu) và dự đoán điểm chất lượng. Nó đã đạt được kết quả tối ưu trong các nhiệm vụ chung về QE của WMT năm 2022 và 2023.

Phát hiện đáng chú ý: CometKiwi không có tham chiếu đạt được mối tương quan gần tương đương với đánh giá của con người so với COMET có tham chiếu. Điều này gợi ý rằng, đối với các ngôn ngữ giàu tài nguyên, văn bản nguồn chứa đựng gần như đầy đủ tín hiệu đánh giá như bản dịch tham chiếu. Nhưng cảnh báo tương tự vẫn áp dụng: bộ mã hóa của CometKiwi có mức độ biểu diễn tối thiểu đối với các ngôn ngữ tài nguyên thấp, vì vậy các dự đoán không có tham chiếu của nó cho tiếng Cree hoặc tiếng Sámi là không đáng tin cậy.

Đây là điểm mà các số liệu dựa trên FST của chúng tôi mang lại một điều gì đó thực sự khác biệt. Việc kiểm tra tính hợp lệ bằng FST là một **tín hiệu chất lượng xác định, không cần tham chiếu** không đòi hỏi mô hình được huấn luyện và không cần dữ liệu đánh giá của con người. Nếu FST nói một từ không phải là từ tiếng Cree hợp lệ, thì từ đó không phải là từ tiếng Cree hợp lệ — ngoại trừ các trường hợp từ chối sai (false rejections) đối với từ mượn, từ mới và danh từ riêng. Loại tín hiệu chất lượng cứng, dựa trên quy tắc này không có phiên bản tương đương trong hệ sinh thái QE nơ-ron.

### Phát hiện Ảo tưởng trong Dịch máy

Ảo tưởng (hallucination) trong dịch máy — đầu ra trôi chảy nhưng hoàn toàn không liên quan đến nguồn — là một lỗi nghiêm trọng, đặc biệt là trong các thiết lập tài nguyên thấp nơi các mô hình không có đủ dữ liệu huấn luyện để học các mối tương quan nguồn-đích đáng tin cậy.

Công nghệ tiên tiến nhất trong học thuật để phát hiện ảo tưởng sử dụng một số phương pháp:

- **Phát hiện dựa trên embedding**: So sánh embedding của nguồn và bản dịch máy trong một không gian chung (LASER, LaBSE) và gắn cờ các trường hợp độ tương đồng dưới một ngưỡng nhất định.
- **Phát hiện dựa trên xác suất**: Sử dụng chính điểm số độ tin cậy của mô hình dịch máy — các lỗi ảo tưởng có xu hướng có xác suất đầu ra cao nhưng xác suất có điều kiện nguồn thấp.
- **Biến đổi tương phản (Contrastive perturbation)**: So sánh đầu ra dịch máy cho nguồn thực tế với đầu ra cho một nguồn bị biến đổi hoặc không liên quan; nếu các đầu ra giống nhau một cách đáng ngờ, mô hình đang bỏ qua nguồn.
- **LLM làm trọng tài (LLM-as-judge)**: Gợi ý một LLM để đánh giá xem bản dịch có trung thực với nguồn hay không.

Khung thử nghiệm của chúng tôi sử dụng một **plugin phát hiện dựa trên thuật toán phỏng đoán (heuristic detection plugin)** kết hợp bốn tín hiệu: sự phình to độ dài (bản dịch máy dài hơn nhiều so với mong đợi), sự lặp lại (các cụm từ bị lặp lại), sự không khớp thực thể (các thực thể được đặt tên trong nguồn bị thiếu trong bản dịch máy), và sự lặp lại nguồn (bản dịch máy quá giống với văn bản nguồn, gợi ý việc sao chép chưa dịch). Đây là mức cơ bản so với công nghệ tiên tiến nhất trong học thuật — nó bắt được các lỗi ảo tưởng thô thiển nhưng sẽ bỏ sót các lỗi tinh vi. Giá trị của nó là một **bộ lọc không cần tham chiếu, nhanh, rẻ** có thể gắn cờ các lỗi nghiêm trọng nhất mà không cần GPU hoặc gọi API.

### Phát hiện Chuyển mã Ngôn ngữ

Chuyển mã ngôn ngữ (code-switching) trong đầu ra dịch máy — nơi hệ thống tạo ra các từ trong ngôn ngữ nguồn thay vì dịch chúng — là một lỗi khác biệt với ảo tưởng. Nó thường xảy ra khi mô hình gặp một từ mà nó không thể dịch và quay lại sao chép nguồn.

Plugin phát hiện chuyển mã ngôn ngữ của chúng tôi sử dụng **phân tích khối Unicode** (phát hiện các ký tự từ hệ chữ viết của ngôn ngữ nguồn trong đầu ra đáng lẽ phải là ngôn ngữ đích) và **danh sách từ phổ biến** (xác định các từ ngôn ngữ nguồn có tần suất cao xuất hiện mà không được dịch). Đối với tiếng Cree, vốn sử dụng cả SRO (dựa trên ký tự Latin) và chữ viết âm tiết (syllabics), điều này đòi hỏi một số lưu ý — tiếng Anh và SRO chia sẻ chung hệ chữ viết Latin, vì vậy chỉ riêng phân tích khối Unicode là không đủ.

Các tài liệu học thuật về phát hiện chuyển mã ngôn ngữ trong dịch máy còn khá thưa thớt so với phát hiện ảo tưởng. Hầu hết các nghiên cứu tập trung vào chuyển mã ngôn ngữ trong văn bản *đầu vào* (người nói song ngữ trộn lẫn các ngôn ngữ) hơn là trong văn bản *đầu ra* (hệ thống dịch máy thất bại trong việc dịch). Cách tiếp cận dựa trên thuật toán phỏng đoán của chúng tôi, theo hiểu biết của chúng tôi, không bị tụt hậu đáng kể so với bất kỳ công nghệ tiên tiến nào được công bố cho vấn đề cụ thể này.

---

## Phần 5: Khoảng trống Hình thái học

### Những điều các Số liệu Hiện tại Không thể Nhìn thấy

Đây là lập luận cốt lõi của bài viết này, và nó đòi hỏi một minh chứng cụ thể.

Hãy xem xét cặp câu tiếng Plains Cree sau:

| | Văn bản |
|--|------|
| **Nguồn (Tiếng Anh)** | "I saw the man" |
| **Tham chiếu (Tiếng Cree)** | *nikî-wâpamâw nâpêw* |
| **Bản dịch máy A** | *nâpêw nikî-wâpamâw* |
| **Bản dịch máy B** | *nikî-wâpamikow nâpêsis* |

**Bản dịch máy A** là một bản dịch hoàn hảo — nó có cùng các từ nhưng ở một trật tự khác, điều này hoàn toàn đúng ngữ pháp trong tiếng Cree (trật tự từ tự do). **Bản dịch máy B** có nghĩa là "cậu bé đã được nhìn thấy bởi tôi" — sai hướng hành động (*-ikow* là dạng nghịch đảo), sai đối tượng tác động (*nâpêsis* = "cậu bé", chứ không phải "người đàn ông").

| Số liệu | Bản dịch máy A (đúng) | Bản dịch máy B (sai) | Có thể phân biệt được không? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Hầu như không |
| chrF++ | ~65% | ~55% | Phần nào |
| COMET | Không xác định (không có dữ liệu huấn luyện tiếng Cree) | Không xác định | Không đáng tin cậy |
| **FST chấp nhận** | 100% | 100% | Không (cả hai đều là tiếng Cree hợp lệ) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Có** |
| **Bộ xác thực ngữ nghĩa** | VALID | WRONG | **Có** |

Bộ linter và bộ xác thực ngữ nghĩa thành công trong khi BLEU, chrF++ và COMET thất bại — không phải vì chúng là "các số liệu tốt hơn" theo một nghĩa vạn năng nào đó, mà vì chúng có quyền truy cập vào *kiến thức ngôn ngữ học* mà các số liệu so khớp chuỗi và số liệu nơ-ron không có. Chúng biết rằng tiếng Cree có trật tự từ tự do. Chúng biết rằng *wâpamêw* và *wâpamikow* là các bổ đề khác nhau với các cấu trúc đối số khác nhau. Chúng biết rằng *nâpêw* và *nâpêsis* là các từ khác nhau.

Kiến thức này đến từ FST (mã hóa ngữ pháp hình thái), từ điển song ngữ (cung cấp các nghĩa tiếng Anh cho mỗi bổ đề) và các lớp biến thể được định nghĩa thủ công (mã hóa các quy tắc tương đương dựa trên ngôn ngữ học). Không một kiến thức nào trong số này khả dụng đối với một số liệu coi bản dịch chỉ là một chuỗi ký tự.

### Tại sao Ngành này Chưa Giải quyết Điều này

Khoảng trống hình thái học trong đánh giá dịch máy không phải là một bí ẩn. Ngành này biết nó tồn tại. Những lý do khiến nó vẫn tồn tại mang tính cấu trúc:

1. **Thiên vị quy mô.** Cộng đồng đánh giá dịch máy tối ưu hóa cho các số liệu hoạt động trên tất cả các cặp ngôn ngữ của WMT. Các số liệu dựa trên FST hoạt động cho khoảng 30 ngôn ngữ. COMET hoạt động cho hơn 100 ngôn ngữ. chrF++ hoạt động cho tất cả các ngôn ngữ có hệ thống chữ viết. Cộng đồng phần thưởng cho tính vạn năng hơn là độ chính xác.

2. **Sự cô lập của các cộng đồng.** Những người xây dựng FST (các nhà ngôn ngữ học tính toán tại UiT Tromsø, NRC Canada, Đại học Alberta) và những người xây dựng các số liệu đánh giá (các nhà nghiên cứu ML tại Google, Unbabel, WMT) tham gia các hội nghị khác nhau, xuất bản ở các địa điểm khác nhau và hoạt động dưới các cấu trúc khuyến khích khác nhau. Sự giao thoa cần thiết để xây dựng các số liệu đánh giá dựa trên FST đã không xảy ra — không phải vì nó đã được thử nghiệm và thất bại, mà vì các cộng đồng chưa bao giờ hội tụ.

3. **Sự lo ngại về độ bao phủ.** Các FST có các vấn đề từ chối sai đã biết: từ mượn, từ mới và danh từ riêng có thể bị từ chối là không hợp lệ ngay cả khi chúng hoàn toàn có thể chấp nhận được. Điều này khiến các nhà nghiên cứu lo ngại về việc sử dụng FST làm số liệu — một lỗi từ chối sai sẽ làm tăng tỷ lệ lỗi một cách giả tạo. Mối lo ngại này là có cơ sở nhưng có thể định lượng được: việc đo lường tỷ lệ từ chối sai trên văn bản chuẩn đã biết là rất đơn giản.

4. **Nhu cầu không đủ.** Rất ít người đang xây dựng hệ thống dịch máy cho các ngôn ngữ đa tổng hợp, và những người đang làm việc đó (ALT Lab, NRC, những người tham gia AmericasNLP) thường sử dụng chrF++ vì đó là những gì đang tồn tại. Chưa có một nỗ lực phối hợp nào từ cộng đồng dịch máy tài nguyên thấp cho việc đánh giá nhận biết hình thái học, một phần vì cộng đồng này còn nhỏ và một phần vì việc xây dựng các số liệu như vậy đòi hỏi chuyên môn trong cả kỹ nghệ NLP và hình thái học của ngôn ngữ đích cụ thể.

5. **Giả định về số liệu nơ-ron.** Giả định phổ biến từ năm 2020 là các số liệu nơ-ron cuối cùng sẽ giải quyết được vấn đề hình thái học thông qua các biểu diễn tự học. Lập luận cho rằng, nếu bạn huấn luyện COMET on đủ dữ liệu từ các ngôn ngữ giàu hình thái, nó sẽ tự học cách xử lý các biến thể hình thái một cách ngầm định. Điều này có thể đúng đối với các ngôn ngữ giàu hình thái tài nguyên cao (tiếng Phần Lan, tiếng Thổ Nhĩ Kỳ, tiếng Séc). Nhưng nó khó có thể đúng đối với các ngôn ngữ thực tế không có đại diện trong dữ liệu huấn luyện.

---

## Phần 6: LYSS — Một Giải pháp Thay thế dựa trên Nền tảng Ngôn ngữ học

### Những gì Champollion đã xây dựng: LYSS (Linguistically-informed Yield & Structural Scoring)

Khung thử nghiệm đánh giá của dự án Champollion triển khai một khung chấm điểm tổng hợp gọi là **LYSS**, kết hợp các số liệu tiêu chuẩn (chrF++, khớp chính xác) với bốn danh mục số liệu dựa trên ngôn ngữ học. Tên gọi này phản ánh trọng tâm của khung đánh giá: đo lường *hiệu suất (yield)* (bao nhiêu ý nghĩa còn tồn tại qua quá trình dịch) thông qua *chấm điểm cấu trúc (structural scoring)* (các kiểm tra xác định, dựa trên ngôn ngữ học thay vì các embedding tự học).

#### 1. Cổng Hợp lệ Hình thái (Số liệu GiellaLT FST)

Số liệu đơn giản và có khả năng áp dụng rộng rãi nhất: đưa mọi từ của đầu ra dịch máy qua bộ phân tích hình thái trạng thái hữu hạn GiellaLT cho ngôn ngữ đích. Nếu FST có thể phân tích một từ (trả về ít nhất một kết quả phân tích), từ đó hợp lệ về mặt hình thái. Nếu không, từ đó không tồn tại trong ngôn ngữ đích — đó có thể là một từ ảo tưởng, một lỗi hình thái, một lỗi chính tả hoặc một từ mượn không có trong từ điển.

**Đầu ra:** `fst_validity_rate` (0.0–1.0, càng cao càng tốt). Trung bình vĩ mô (macro-average - trung bình của tỷ lệ trên mỗi mục nhập) và trung bình vi mô (micro-average - tổng số từ hợp lệ / tổng số từ).

**Các phụ thuộc:** `pyhfst` (các liên kết Python của Helsinki Finite-State Technology), một tệp phân tích `.hfstol` đã được biên dịch cho ngôn ngữ đích.

**Khả năng mở rộng:** Hoạt động cho bất kỳ ngôn ngữ nào có bộ phân tích GiellaLT FST — hiện tại là hơn 30 ngôn ngữ, chủ yếu là tiếng Sámi, các ngôn ngữ Ural và các ngôn ngữ bản địa vùng Bắc Cực.

**Mối liên hệ với các nghiên cứu trước:** MorphEval kiểm tra xem một hệ thống có thể xử lý các tương phản cụ thể hay không. Số liệu FST kiểm tra xem đầu ra của hệ thống có bao gồm các từ thực tế hay không. Hai phương pháp này bổ sung cho nhau: MorphEval kiểm tra năng lực, số liệu FST kiểm tra tính hợp lệ.

#### 2. Các Lớp Tương đương Ngôn ngữ học (CRK Linter)

Bộ linter giải quyết lỗi nghiêm trọng và âm thầm nhất của đánh giá dựa trên tham chiếu: **phạt các bản dịch chính xác nhưng khác với bản dịch tham chiếu**.

Bộ linter tiếng Plains Cree (844 dòng) triển khai sáu **lớp biến thể (variant classes)**, mỗi lớp mã hóa một quy tắc tương đương dựa trên ngôn ngữ học:

- **WORD_ORDER**: Tiếng Cree có trật tự từ tự do về mặt thực hành (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* và *nâpêw nikî-wâpamâw* có cùng ý nghĩa. Bộ linter tạo ra tất cả các hoán vị và kiểm tra xem bản dịch máy có khớp với bất kỳ hoán vị nào không.
- **ORTHOGRAPHIC**: Chữ viết SRO (Standard Roman Orthography) có các điểm biến thể đã biết — dấu mũ so với dấu gạch ngang (*â* so với *ā*), việc sử dụng dấu gạch nối của các tiền động từ (*nikî-nipâw* so với *nikî nipâw* so với *nikînipâw*). Bộ linter sẽ chuẩn hóa các điểm này.
- **OPTIONAL_PARTICLE**: Một số tiểu từ hội thoại (*mâka*, *êkwa*, *êwako*) có thể xuất hiện hoặc vắng mặt mà không làm thay đổi mệnh đề cốt lõi. Bộ linter kiểm tra xem bản dịch máy có khớp với bản dịch tham chiếu sau khi loại bỏ tiểu từ hay không.
- **LEMMA_SYNONYM**: Một số bổ đề tiếng Cree có thể thay thế cho nhau trong các bối cảnh cụ thể. Điều này sử dụng một danh sách từ đồng nghĩa được tuyển chọn (ví dụ: các biến thể phương ngôn) và, khi có sẵn FST, kiểm tra xem bản dịch máy và bản dịch tham chiếu có chia sẻ các phân tích hình thái hay không.
- **PROGRESSIVE_AMBIGUITY**: Các dạng tiếp diễn trong tiếng Anh ("is walking") có thể được dịch sang tiếng Cree bằng các cấu trúc khác nhau. Bộ linter công nhận các cấu trúc này là tương đương.
- **INCLUSIVE_EXCLUSIVE**: Tiếng Cree phân biệt đại từ "chúng tôi/chúng ta" bao gồm (*ki-* tiền tố) và loại trừ (*ni-* tiền tố) — một sự phân biệt mà tiếng Anh gộp chung vào một đại từ duy nhất. Bộ linter nhận biết rằng cả hai dạng đều có thể chính xác khi câu nguồn tiếng Anh bị mơ hồ.

Bộ linter đưa ra ba kết quả đánh giá: **EXACT** (bản dịch máy khớp với tham chiếu), **EQUIVALENT** (bản dịch máy khác biệt nhưng được phân loại là một biến thể hợp lệ), hoặc **MISS** (không tìm thấy kết quả khớp). Ở cấp độ tổng hợp, nó tính toán một `equivalent_match_rate` — tỷ lệ các bản dịch chính xác hoặc tương đương.

**Mối liên hệ với các nghiên cứu trước:** Tiền lệ song song gần nhất là **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), mã hóa vô số bản dịch hợp lệ dưới dạng các mạng lưới diễn đạt lại và đo lường khoảng cách chỉnh sửa đến dạng hợp lệ gần nhất. Bộ linter của chúng tôi có khái niệm tương tự — nó định nghĩa một tập hợp các bản dịch hợp lệ cho mỗi tham chiếu — nhưng sử dụng các quy tắc biến đổi được định nghĩa theo ngôn ngữ học thay vì các cơ sở dữ liệu diễn đạt lại. HyTER được thiết kế cho tiếng Anh; chưa có ai xây dựng các mạng lưới diễn đạt lại cho tiếng Cree. Các lớp biến thể của chúng tôi, trên thực tế, là một sự xấp xỉ nhỏ gọn, dựa trên quy tắc của những gì HyTER thực hiện với các đồ thị.

Trong khung thử nghiệm CheckList, các lớp biến thể của chúng tôi hoạt động như **các kiểm thử tính bất biến**: các biến đổi không được làm thay đổi kết quả đánh giá. Sự khác biệt là các kiểm thử CheckList thường được áp dụng cho *mô hình*; còn các quy tắc biến thể của chúng tôi được áp dụng cho *số liệu*.

#### 3. Xác thực Ngữ nghĩa Xác định (Số liệu Ngữ nghĩa CRK)

Bộ xác thực ngữ nghĩa (792 dòng) cố gắng thực hiện một điều tham vọng hơn: **so sánh ý nghĩa xác định** mà không cần các embedding nơ-ron. Nó hoạt động qua bốn giai đoạn:

1. **Phân tích hình thái**: Cả bản giả thuyết và bản tham chiếu đều được đưa qua bộ phân tích CRK FST, trả về từ gốc (lemma) và các đặc điểm hình thái cho mỗi từ.
2. **Phân giải chú giải**: Mỗi từ gốc được tra cứu qua API từ điển itwêwina — nơi cung cấp từ điển Wolvengrey (2001) cùng với các từ điển Maskwacîs và Alberta Elders — để lấy các chú giải tiếng Anh.
3. **Trích xuất từ nội dung**: Sử dụng pipeline tiếng Anh của spaCy (`en_core_web_md`), các hư từ (function words) được lọc khỏi cả các chú giải tiếng Anh và văn bản nguồn.
4. **Chấm điểm trùng lặp**: Sự trùng lặp từ nội dung giữa các chú giải của bản giả thuyết và các chú giải của bản tham chiếu sẽ quyết định kết luận ngữ nghĩa.

Bộ xác thực đưa ra các kết quả phân loại: **EXACT_MATCH**, **VALID** (các từ khác nhau nhưng cùng ý nghĩa), **GRAMMAR_ISSUES** (đúng bổ đề nhưng gặp vấn đề ngữ pháp cấp độ câu — sự hòa hợp, tính hoạt, dạng động từ), **PARTIAL** (một phần ý nghĩa được bảo toàn), **INCOMPLETE** (ý nghĩa bị thiếu một phần), **WRONG** (sai ý nghĩa), hoặc **NO_OUTPUT**.

**Mối liên hệ với các nghiên cứu trước:** Đây thực chất là một **sự xấp xỉ xác định cho việc tính toán độ tương đồng ngữ nghĩa của COMET**. Trong khi COMET sử dụng các embedding đa ngữ tự học để đánh giá xem hai câu có cùng ý nghĩa hay không, bộ xác thực của chúng tôi sử dụng một chuỗi các tra cứu xác định: FST → từ điển → spaCy. Ưu điểm là tính minh bạch (mọi bước đều có thể kiểm tra và xác định) và tính độc lập với dữ liệu huấn luyện. Nhược điểm là tính mong manh: chất lượng đánh giá phụ thuộc hoàn toàn vào độ bao phủ của FST và tính đầy đủ của từ điển.

Cách tiếp cận này có liên quan về mặt khái niệm với **MEANT** (Lo & Wu, 2011; Lo, 2017), vốn sử dụng gán nhãn vai trò ngữ nghĩa (semantic role labeling) để đánh giá xem cấu trúc "ai đã làm gì với ai" có được bảo toàn trong bản dịch hay không. Cách tiếp cận của chúng tôi thô hơn (trùng khớp từ thực từ thay vì các vai trò ngữ nghĩa) nhưng hoạt động trên một ngôn ngữ không tồn tại bất kỳ công cụ SRL nào.

#### 4. Các Plugin Phát hiện Hành vi (Ảo tưởng, Chuyển mã Ngôn ngữ, Thuật ngữ)

Ba plugin bổ sung cung cấp **các tín hiệu chất lượng hành vi** bổ trợ cho các số liệu hình thái học:

- **Phát hiện ảo tưởng** (259 dòng): Bốn tín hiệu thuật toán phỏng đoán được trọng số hóa và kết hợp — sự phình to độ dài (40%), sự lặp lại (30%), sự không khớp thực thể (20%), sự lặp lại nguồn (10%). Đây là các bộ lọc không cần tham chiếu, giá rẻ giúp bắt các lỗi bịa đặt thô thiển.
- **Phát hiện chuyển mã ngôn ngữ** (~280 dòng): Phân tích khối Unicode kết hợp với danh sách từ phổ biến để phát hiện các token ngôn ngữ nguồn chưa được dịch. Đầu ra là một `code_switching_rate` (0.0–1.0).
- **Tuân thủ thuật ngữ** (199 dòng): Kiểm tra xem các thuật ngữ được chỉ định trong bảng thuật ngữ có được dịch nhất quán hay không. Trả về `terminology_adherence` (0.0–1.0) hoặc None nếu không cấu hình bảng thuật ngữ.

Các plugin này được định vị một cách trung thực là **các bộ phát hiện thuật toán phỏng đoán cơ bản**, không phải công nghệ tiên tiến nhất. Giá trị của chúng là cung cấp các tín hiệu nhanh, rẻ, có thể giải thích được, có thể được tính toán song song với các số liệu hình thái học phức tạp hơn. Trong khung chấm điểm tổng hợp, chúng mang trọng số thấp (0.05 mỗi loại).

### Các Hạn chế Trung thực

Cách tiếp cận này có những hạn chế đáng kể cần phải được thừa nhận trước khi đưa ra bất kỳ tuyên bố nào về tính mới hay tính hữu dụng:

1. **Tỷ lệ từ chối sai của FST.** FST sẽ từ chối các từ hợp lệ không có trong từ điển của nó — từ mượn, từ mới, thuật ngữ ghép, các thuật ngữ trộn mã ngôn ngữ. Điều này làm tăng tỷ lệ lỗi hình thái một cách giả tạo. Tỷ lệ từ chối sai chưa được đo lường chính thức trên một ngữ liệu đại diện của tiếng Cree. Nếu không có phép đo này, độ chính xác của số liệu hợp lệ FST là không xác định.

2. **Độ bao phủ của từ điển.** Chất lượng của trình xác thực ngữ nghĩa phụ thuộc hoàn toàn vào độ bao phủ của từ điển Wolvengrey. Các từ tiếng Cree không có trong từ điển sẽ không tạo ra chú giải nào, điều này bị trình xác thực coi là một khoảng trống ngữ nghĩa. Từ điển chứa khoảng 18.000–22.000 mục từ (số lượng thay đổi tùy theo ấn bản và phương pháp đếm) — một con số đáng kể, nhưng chưa phải là toàn diện.

3. **Tính đầy đủ của lớp biến thể.** Sáu lớp biến thể của bộ linter được thiết kế dựa trên tài liệu ngôn ngữ học và quan sát các mẫu đầu ra của dịch máy. Có thể có các lớp tương đương bổ sung chưa được nắm bắt — các biến thể phương ngôn, sự khác biệt văn phong, các từ đồng nghĩa cấp độ hội thoại. Không có quy trình chính thức nào đảm bảo tính đầy đủ này.

4. **Chưa có nghiên cứu tương quan với con người.** Khoảng trống quan trọng nhất: chưa có ai đo lường xem liệu các kết quả của bộ linter (EXACT/EQUIVALENT/MISS) hay các kết quả của bộ xác thực ngữ nghĩa có tương quan với các đánh giá của con người về chất lượng dịch thuật hay không. Các số liệu nơ-ron phải mất nhiều năm để thiết lập mối tương quan với đánh giá của con người (các nhiệm vụ chung của WMT). Các số liệu của chúng tôi chưa có sự xác thực như vậy.

5. **Tính đặc thù của ngôn ngữ.** Các lớp biến thể, danh sách từ đồng nghĩa và quy tắc tiểu từ tùy chọn là đặc thù cho tiếng Plains Cree. Việc chuyển chúng sang tiếng North Sámi, tiếng Inuktitut hoặc bất kỳ ngôn ngữ nào khác đòi hỏi các nhà ngôn ngữ học hiểu rõ hình thái học, tính linh hoạt của trật tự từ và các quy ước chữ viết của ngôn ngữ đó. *Khung làm việc* có thể chuyển đổi; nhưng *các quy tắc* thì không.

6. **Các khoảng trống kết nối số liệu.** Tính đến thời điểm viết bài, bốn trong số chín số liệu trong cấu hình chấm điểm tổng hợp (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) có kết nối plugin chưa hoàn thiện hoặc chưa rõ ràng trong khung thử nghiệm. Điểm số tổng hợp thực tế được tính toán từ khoảng năm số liệu với các trọng số được phân bổ lại.

### Những yêu cầu cần thiết để Xác thực Phương pháp này

Để công trình này có thể xuất bản được — ở bất kỳ địa điểm nào, ở bất kỳ cấp độ học thuật nghiêm túc nào — các thử nghiệm sau đây là bắt buộc:

1. **Nghiên cứu tương quan với đánh giá của con người.** Thu thập các đánh giá chất lượng của con người cho một tập hợp các bản dịch Tiếng Anh→Tiếng Cree (lý tưởng là hơn 200 cặp câu được đánh giá bởi hơn 3 người nói song ngữ). Tính toán mối tương quan giữa điểm số của con người và từng số liệu của chúng tôi. Đây là bước xác thực quan trọng nhất. Nếu không có nó, các số liệu chỉ là các sản phẩm kỹ thuật, chứ không phải công cụ đánh giá.

2. **Đo lường tỷ lệ từ chối sai của FST.** Chạy bộ phân tích FST trên một ngữ liệu văn bản tiếng Cree chuẩn đã biết (ví dụ: các văn bản tiếng Cree đã xuất bản, các ngữ liệu song song đã được xác thực) và đo lường tỷ lệ phần trăm các từ hợp lệ bị từ chối. Điều này giúp định lượng độ chính xác của số liệu hợp lệ FST.

3. **Xác thực trên ngôn ngữ thứ hai.** Chuyển số liệu hợp lệ FST sang ngôn ngữ GiellaLT thứ hai (nhiều khả năng là tiếng North Sámi, vốn có bộ phân tích FST hoàn thiện nhất trong hệ sinh thái GiellaLT). Chứng minh rằng số liệu này tạo ra kết quả hợp lý trên đầu ra dịch máy tiếng Sámi. Điều này xác thực tuyên bố về khả năng mở rộng.

4. **So sánh với COMET.** Chạy COMET trên cùng dữ liệu tiếng Cree và so sánh điểm số của nó với các số liệu của chúng tôi và với đánh giá của con người. Nếu COMET tạo ra điểm số có ý nghĩa cho tiếng Cree (điều mà chúng tôi nghi ngờ, nhưng chưa thử nghiệm), các số liệu của chúng tôi cần phải vượt trội hơn nó để chứng minh tính hữu ích. Nếu COMET tạo ra kết quả nhiễu (điều chúng tôi dự đoán), điều này sẽ xác thực sự cần thiết của phương pháp của chúng tôi.

5. **Bổ sung chẩn đoán MorphEval.** Xây dựng một bộ kiểm thử nhỏ (50–100 tương phản) theo phong cách MorphEval cho tiếng Plains Cree nhắm vào các đặc trưng hình thái đặc trưng nhất của ngôn ngữ này (ngôi thứ ba phụ - obviative, dạng nghịch đảo - inverse, trật tự liên kết/độc lập - conjunct/independent, đại từ "chúng tôi/chúng ta" bao gồm/loại trừ, chuỗi tiền động từ). Chạy các hệ thống dịch máy trên bộ kiểm thử này và chứng minh rằng thông tin chẩn đoán thu được là có thể hành động được.

6. **Kiểm toán kết nối và tích hợp.** Khắc phục các khoảng trống kết nối cấu hình chấm điểm được xác định trong kho mã nguồn. Đảm bảo rằng tất cả chín số liệu tổng hợp đều tạo ra giá trị và điểm số tổng hợp được tính toán chính xác.

---

## Phần 7: Định vị và Hướng đi Tương lai

### Vị trí của LYSS trong Bức tranh Đánh giá Dịch máy

Bảng phân loại các phương pháp đánh giá dịch máy, được định vị một cách trung thực:

| Khía cạnh | Số liệu chuỗi (BLEU, chrF++) | Số liệu nơ-ron (COMET, MetricX) | LLM làm trọng tài (GEMBA) | Chẩn đoán (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| **Loại tín hiệu** | Trùng khớp bề mặt | Độ tương đồng ngữ nghĩa tự học | Đánh giá mở | Thử nghiệm năng lực có mục tiêu | Tính hợp lệ hình thái + tương đương dựa trên quy tắc |
| **Dữ liệu huấn luyện cần thiết** | Không | Đánh giá của con người (hàng nghìn) | LLM đã huấn luyện trước | Bộ kiểm thử do nhà ngôn ngữ học thiết kế | FST + từ điển + quy tắc biến thể |
| **Khả năng áp dụng cho LRL** | Vạn năng nhưng yếu | Bị giới hạn bởi độ bao phủ của bộ mã hóa | Bị giới hạn bởi độ bao phủ của LLM | Bị giới hạn bởi việc xây dựng bộ kiểm thử | Bị giới hạn bởi tính khả dụng của FST (~30 ngôn ngữ) |
| **Yêu cầu tham chiếu** | Có | Có (hoặc QE chỉ cần nguồn) | Tùy chọn | Có (tương phản) | Có (LYSS-eq/LYSS-sem) / Không (LYSS-fst) |
| **Khả năng giải thích** | Thấp (một con số) | Thấp (một con số) | Cao (giải thích bằng văn bản) | Cao (đạt/không đạt trên mỗi hiện tượng) | Cao (kết quả đánh giá + các lớp biến thể) |

**LYSS không phải là**: một giải pháp thay thế cho COMET trên các ngôn ngữ giàu tài nguyên, một số liệu vạn năng, hay phương pháp đánh giá nhận biết hình thái học đầu tiên.

**LYSS là**: một khung tích hợp kết hợp đánh giá hợp lệ hình thái dựa trên FST với các số liệu tiêu chuẩn cho trường hợp cụ thể của các ngôn ngữ mà số liệu nơ-ron thiếu độ bao phủ và các công cụ dựa trên quy tắc (FST, từ điển) đã tồn tại. Nó có ba thành phần cốt lõi:
- **LYSS-fst** — Tính hợp lệ hình thái qua FST (`fst_acceptance_rate`)
- **LYSS-eq** — Tính tương đương ngôn ngữ học qua bộ linter (`equivalent_match_rate`)
- **LYSS-sem** — Xác thực ngữ nghĩa xác định (`semantic_score`)

**LYSS mở rộng**: ý tưởng cốt lõi của MorphEval (sử dụng các công cụ hình thái học để đánh giá) từ kiểm thử năng lực chẩn đoán sang chấm điểm chất lượng liên tục.

**LYSS bổ trợ cho**: chrF++ (ghi nhận một phần điểm cho các hình vị chung nhưng không thể phát hiện sự tương đương), COMET (hoạt động trong không gian ngữ nghĩa nhưng thiếu dữ liệu huấn luyện cho LRL), và FUSE (sử dụng thiết kế đặc trưng nhưng không dùng bộ phân tích hình thái).

**Tiền lệ song song gần nhất là**: Hjerson (phân loại lỗi ngôn ngữ học) + HyTER (các lớp tương đương qua mạng lưới diễn đạt lại) + số liệu độ bao phủ ngây thơ của Apertium (kiểm tra tính hợp lệ dựa trên FST). Đóng góp của LYSS không nằm ở bất kỳ kỹ thuật đơn lẻ nào mà là sự tích hợp các ý tưởng này — đặc biệt là tính hợp lệ dựa trên FST và tính tương đương dựa trên quy tắc — vào một khung thử nghiệm đánh giá hoạt động cho một ngôn ngữ đa tổng hợp.

### Tích hợp MorphEval

Phương pháp bộ kiểm thử tương phản của MorphEval và cách tiếp cận chấm điểm liên tục của chúng tôi bổ trợ cho nhau:

- **MorphEval** trả lời: "Hệ thống này có thể xử lý việc đánh dấu thì không? Sự hòa hợp về số? Việc gán cách?"
- **Số liệu FST của chúng tôi** trả lời: "Hệ thống này có tạo ra các từ thực tế không?"
- **Bộ linter của chúng tôi** trả lời: "Bản dịch này có tương đương với bản dịch tham chiếu bất chấp những khác biệt bề mặt không?"
- **Bộ xác thực ngữ nghĩa của chúng tôi** trả lời: "Bản dịch này có mang lại ý nghĩa chính xác không?"

MorphEval là mã nguồn mở. Việc tạo ra một bộ kiểm thử tiếng Plains Cree sẽ đòi hỏi một nhà ngôn ngữ học thiết kế các cặp tương phản bao gồm các tương phản hình thái đặc trưng của tiếng Cree (ngôi thứ ba phụ, đánh dấu nghịch đảo, trật tự liên kết/độc lập, đại từ "chúng tôi/chúng ta" bao gồm/loại trừ, chuỗi tiền động từ). Đây là một công việc đáng kể nhưng có giới hạn — tính bằng tuần, chứ không phải bằng tháng — và sẽ cung cấp khả năng chẩn đoán mà không công cụ đánh giá nào khác có được cho tiếng Cree.

### Câu hỏi về Khả năng Mở rộng

Những ngôn ngữ nào khác có thể áp dụng phương pháp này? Hạn chế chính là tính khả dụng của FST. Cơ sở hạ tầng GiellaLT cung cấp các bộ phân tích hình thái cho hơn 30 ngôn ngữ, chủ yếu thuộc ba ngữ hệ:

- **Các ngôn ngữ Sámi** (North Sámi, Lule Sámi, South Sámi, Skolt Sámi, Inari Sámi): Các FST hoàn thiện với độ bao phủ rộng. Tiếng North Sámi là mục tiêu có thể chuyển đổi ngay lập tức nhất.
- **Các ngôn ngữ Ural** (tiếng Phần Lan, tiếng Estonia, tiếng Komi, tiếng Erzya, tiếng Moksha): Các bộ phân tích được phát triển tốt, mặc dù tiếng Phần Lan và tiếng Estonia có thể không cần đánh giá dựa trên FST một cách khẩn cấp (chúng có độ bao phủ số liệu nơ-ron tốt hơn).
- **Các ngôn ngữ bản địa vùng Bắc Cực** (tiếng Inuktitut qua Uqailaut, tiếng Greenlandic): Các bộ phân tích đã tồn tại nhưng độ bao phủ khác nhau.
- **Các ngôn ngữ GiellaLT khác**: Tiếng Faroe, tiếng Ireland, tiếng Cornish, tiếng Livonia, và các ngôn ngữ khác với các mức độ hoàn thiện FST khác nhau.

Ngoài GiellaLT, nền tảng **Apertium** cung cấp các bộ phân tích hình thái cho khoảng hơn 40 cặp ngôn ngữ. Hệ sinh thái **HFST** (Helsinki Finite-State Technology) là cơ sở hạ tầng chung mà cả GiellaLT và Apertium sử dụng, nghĩa là bất kỳ bộ phân tích Apertium nào về nguyên tắc đều có thể được tích hợp vào cùng một số liệu hợp lệ FST.

Hạn chế thực tế không phải là tính khả dụng của FST mà là **việc xây dựng các lớp biến thể**. Các quy tắc tương đương của bộ linter đòi hỏi chuyên môn ngôn ngữ học cho từng ngôn ngữ đích. Đối với tiếng North Sámi, điều này đòi hỏi sự hiểu biết về tính linh hoạt của trật tự từ tiếng Sámi, các quy ước chữ viết và biến thể phương ngôn. Đối với tiếng Inuktitut, nó đòi hỏi sự hiểu biết về hình thái học đa tổng hợp ở mức độ tương đương với những gì đã được thực hiện cho tiếng Cree. Tuy nhiên, số liệu hợp lệ FST có thể được triển khai ngay lập tức cho bất kỳ ngôn ngữ nào có bộ phân tích GiellaLT — không cần thêm công việc ngôn ngữ học nào khác.

### Hướng tới một Bài báo Khoa học

Một ấn phẩm dựa trên công trình này sẽ phù hợp nhất với một trong các địa điểm sau:

- **WMT Metrics Shared Task** (tổ chức cùng EMNLP): Địa điểm trực tiếp nhất. Sẽ đòi hỏi phải triển khai các số liệu dưới dạng một bài nộp cho nhiệm vụ chung và đánh giá trên các tập kiểm thử WMT — vốn hiện không bao gồm bất kỳ ngôn ngữ đa tổng hợp nào. Có thể nộp dưới dạng bài báo "phát hiện" (findings) hoặc tham gia vào nhiệm vụ phụ về các tập thử thách.
- **LREC-COLING** (Language Resources and Evaluation Conference): Phù hợp tự nhiên cho một bài báo về tài nguyên/công cụ mô tả khung đánh giá và các tài nguyên ngôn ngữ học mà nó sử dụng (FST, từ điển, quy tắc biến thể).
- **ACL hoặc NAACL** (hội nghị chính): Sẽ đòi hỏi nghiên cứu tương quan với con người và ít nhất một ngôn ngữ bổ sung để đáp ứng tiêu chuẩn cho một bài báo hội nghị chính.
- **Hội thảo AmericasNLP**: Khán giả dễ tiếp nhận nhất cho việc đánh giá dịch máy ngôn ngữ bản địa. Tiêu chuẩn xuất bản thấp hơn, nhưng tác động cao trong cộng đồng mục tiêu.
- **ComputEL** (Computational Approaches to Endangered Languages): Địa điểm chuyên biệt tập trung chính xác vào loại công việc này.

Bất kỳ ấn phẩm nào cũng sẽ đòi hỏi các đồng tác giả có chuyên môn về ngôn ngữ học tiếng Cree (để xác thực các lớp biến thể và diễn giải kết quả) và lý tưởng nhất là những người nói tiếng Cree song ngữ (để cung cấp các đánh giá chất lượng của con người cho nghiên cứu tương quan). Đây không phải là tùy chọn — một bài báo về đánh giá dịch máy tiếng Cree được viết hoàn toàn bởi những người không nói tiếng Cree, trong trường hợp tốt nhất, sẽ là không đầy đủ, và trong trường hợp xấu nhất, là sự tiếp nối của các động lực nghiên cứu mang tính khai thác mà ngành này đang cố gắng vượt qua.

---

## Phụ lục A: Ma trận Yêu cầu Số liệu

| Số liệu | Yêu cầu tham chiếu? | Yêu cầu nguồn? | Mô hình được huấn luyện? | Tài nguyên đặc thù ngôn ngữ? | Hoạt động cho LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Có | Không | Không | Không | Kém |
| chrF++ | Có | Không | Không | Không | Tốt hơn BLEU |
| METEOR | Có | Không | Không | Bộ tách gốc từ + WordNet | Chỉ khi tài nguyên tồn tại |
| TER | Có | Không | Không | Không | Tương tự BLEU |
| BERTScore | Có | Không | Có (mBERT) | Không | Phụ thuộc vào độ bao phủ của mô hình |
| BLEURT | Có | Không | Có (được huấn luyện) | Không | Phụ thuộc vào dữ liệu huấn luyện |
| COMET | Có | Có | Có (XLM-R) | Không | Phụ thuộc vào độ bao phủ của XLM-R |
| CometKiwi | Không | Có | Có (XLM-R) | Không | Phụ thuộc vào độ bao phủ của XLM-R |
| GEMBA | Tùy chọn | Có | Có (LLM) | Không | Phụ thuộc vào độ bao phủ của LLM |
| **FST chấp nhận** | **Không** | **Không** | **Không** | **Có (bộ phân tích FST)** | **Có, nếu FST tồn tại** |
| **CRK Linter** | **Có** | **Không** | **Không** | **Có (FST + quy tắc biến thể)** | **Có, nếu tài nguyên tồn tại** |
| **CRK Semantic** | **Có** | **Tùy chọn** | **Không** | **Có (FST + từ điển + spaCy)** | **Có, nếu tài nguyên tồn tại** |
| Phát hiện ảo tưởng | Không | Có | Không | Không | Có |
| Phát hiện chuyển mã | Tùy chọn | Có | Không | Tối thiểu | Có |
| MorphEval | Có (tương phản) | Có | Không | Có (bộ kiểm thử + bộ phân tích) | Chỉ khi bộ kiểm thử tồn tại |

## Phụ lục B: Các Bài báo Khóa

| Trích dẫn | Địa điểm | Mức độ liên quan |
|----------|-------|-----------|
| Papineni và cộng sự (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | Số liệu định hình toàn bộ ngành |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | So khớp n-gram được trọng số hóa theo thông tin |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Tách gốc từ, từ đồng nghĩa, căn chỉnh từ |
| Snover và cộng sự (2006). A Study of Translation Edit Rate | AMTA 2006 | Khoảng cách chỉnh sửa với dịch chuyển cụm từ |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Phân loại lỗi Hjerson |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Các lớp tương đương qua mạng lưới diễn đạt lại |
| Lommel và cộng sự (2014). Multidimensional Quality Metrics | — | Phân loại lỗi MQM |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Đánh giá ở cấp độ ký tự |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Đánh giá n-gram ký tự + từ |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Các bộ kiểm thử hình thái tương phản |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | Các cặp tương phản LingEval97 |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Kiểm thử sự khác biệt cấu trúc có mục tiêu |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | Chuẩn hóa sacreBLEU |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Phân tích gộp về mối tương quan của BLEU với đánh giá của con người |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | Đánh giá giới tính WinoMT |
| Ribeiro và cộng sự (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Bài báo xuất sắc nhất) | Kiểm thử đơn vị dựa trên năng lực cho NLP |
| Zhang và cộng sự (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Độ tương đồng ngữ nghĩa dựa trên embedding |
| Sellam và cộng sự (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Số liệu được huấn luyện trước + tinh chỉnh |
| Rei và cộng sự (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Đánh giá ba đầu vào đa ngữ |
| Freitag và cộng sự (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | Siêu đánh giá dựa trên MQM |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | NMT đa ngữ làm công cụ chấm điểm diễn đạt lại |
| Currey và cộng sự (2022). MT-GenEval | EMNLP 2022 | Độ chính xác giới tính phản thực tế |
| Amrhein và cộng sự (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 hiện tượng, 146 cặp ngôn ngữ |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM làm công cụ đánh giá |
| Guerreiro và cộng sự (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Phát hiện phân đoạn lỗi |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Số liệu nơ-ron cho các ngôn ngữ châu Phi |
| Juraska và cộng sự (2024). MetricX-24 | WMT 2024 | Số liệu chiến thắng dựa trên mT5 |

## Phụ lục C: Thuật ngữ Đánh giá

| Thuật ngữ | Định nghĩa |
|------|------------|
| **Adequacy** | Bản dịch có truyền tải được ý nghĩa của nguồn hay không (Độ đầy đủ). |
| **Fluency** | Bản dịch có đúng ngữ pháp và tự nhiên trong ngôn ngữ đích hay không (Độ trôi chảy). |
| **Direct Assessment (DA)** | Phương pháp đánh giá của con người trong đó người chấm xếp hạng các bản dịch trên thang điểm 0–100. |
| **MQM** | Multidimensional Quality Metrics — phương pháp đánh giá của con người dựa trên phân đoạn lỗi với các mức độ nghiêm trọng được phân loại. |
| **Quality Estimation (QE)** | Dự đoán chất lượng dịch thuật mà không cần bản dịch tham chiếu (Ước lượng Chất lượng). |
| **FST** | Finite-State Transducer (Bộ chuyển đổi trạng thái hữu hạn) — một công cụ tính toán mã hóa các quy tắc hình thái của một ngôn ngữ. |
| **GiellaLT** | Cơ sở hạ tầng cho công nghệ ngôn ngữ dựa trên quy tắc, chủ yếu dành cho tiếng Sámi và các ngôn ngữ Bắc Cực khác. |
| **HFST** | Helsinki Finite-State Technology — khung phần mềm nền tảng cho GiellaLT và Apertium. |
| **SRO** | Standard Roman Orthography — hệ thống chữ viết dựa trên ký tự Latin cho tiếng Plains Cree. |
| **Syllabics** | Chữ viết âm tiết của thổ dân Canada — một hệ thống chữ viết abugida được sử dụng cho tiếng Cree và các ngôn ngữ Algonquian khác. |
| **Polysynthetic** | Một loại hình ngôn ngữ trong đó một từ đơn lẻ có thể mã hóa ý nghĩa tương đương với cả một câu tiếng Anh thông qua việc ghép nhiều phụ tố (Đa tổng hợp). |
| **Obviation** | Một danh mục ngữ pháp trong các ngôn ngữ Algonquian giúp phân biệt giữa hai đối tượng ngôi thứ ba (Ngôi thứ ba phụ). |
| **Inverse** | Một danh mục giống như thể (voice) trong các ngôn ngữ Algonquian đánh dấu rằng đối tượng chịu tác động có vị trí cao hơn tác nhân trên hệ thống phân cấp tính hoạt (Dạng nghịch đảo). |
| **WMT** | Conference on Machine Translation (Hội nghị về Dịch máy) — địa điểm chính cho các nhiệm vụ chung và đánh giá dịch máy. |
| **Contrastive evaluation** | Kiểm thử xem một hệ thống có thể phân biệt các đầu vào khác biệt tối thiểu đòi hỏi các đầu ra khác nhau hay không (Đánh giá tương phản). |
| **Challenge set** | Một bộ kiểm thử được xây dựng thủ công nhắm vào các hiện tượng ngôn ngữ cụ thể (Tập thử thách). |
| **Equivalence class** | Một tập hợp các dạng bề mặt khác nhau biểu thị cùng một ý nghĩa và sẽ nhận được cùng một điểm số đánh giá (Lớp tương đương). |

## Điều này dẫn đến đâu trên trang web này

Câu trả lời của chính Champollion cho các vấn đề được liệt kê ở đây là
[Đặc tả chấm điểm](/docs/network/specifications/scoring) (chỉ số nào
được tính, và khi nào), [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability)
(nên tin cậy chỉ số nào cho từng ngôn ngữ đích), và
[Khung thiết kế ngữ liệu](/docs/network/specifications/corpus-design)
(cách một tập kiểm thử đạt được sự tin cậy).
