# Dịch máy: Báo cáo tổng quan lĩnh vực (2013–2026)

*Lịch sử tường thuật dành cho bất kỳ ai bước chân vào bức tranh toàn cảnh MT*

---

## Mục lục

- [Phần 1: Cuộc cách mạng nơ-ron (2013–2017)](#part-1-the-neural-revolution-20132017)
- [Phần 2: Bước chuyển sang đa ngôn ngữ (2018–2022)](#part-2-the-multilingual-turn-20182022)
- [Phần 3: Kỷ nguyên LLM (2022–2026)](#part-3-the-llm-era-20222026)
- [Phần 4: Vấn đề tài nguyên thấp](#part-4-the-low-resource-problem)
- [Phần 5: Bộ chuyển đổi trạng thái hữu hạn và các hệ thống dựa trên luật](#part-5-finite-state-transducers-and-rule-based-systems)
- [Phần 6: Đo lường chất lượng — Bài toán đánh giá](#part-6-measuring-quality--the-evaluation-problem)
- [Phần 7: Bức tranh toàn cảnh các tổ chức](#part-7-the-institutional-landscape)
- [Phần 8: Những chân trời rộng mở](#part-8-open-frontiers)
- [Phụ lục A: Các bài báo then chốt](#appendix-a-key-papers)
- [Phụ lục B: Các hội nghị và cộng đồng](#appendix-b-conferences-and-communities)
- [Phụ lục C: Công cụ, tập dữ liệu và tài nguyên thực tế](#appendix-c-tools-datasets-and-practical-resources)
- [Phụ lục D: Thuật ngữ](#appendix-d-glossary)

---

## Phần 1: Cuộc cách mạng nơ-ron (2013–2017)

### Chế độ cũ: Dịch máy thống kê

Để hiểu cuộc cách mạng đã định hình lại dịch máy vào giữa những năm 2010, trước tiên bạn cần hiểu những gì diễn ra trước đó — và lý do vì sao nó sụp đổ.

Từ khoảng năm 2003 đến 2015, mô hình thống trị trong MT là **Dịch máy thống kê (SMT - Statistical Machine Translation)**, cụ thể là **SMT dựa trên cụm từ (phrase-based SMT)**. Ý tưởng cốt lõi tưởng chừng rất đơn giản: thay vì viết các quy tắc về cách thức hoạt động của ngôn ngữ, bạn thu thập một lượng khổng lồ văn bản song ngữ — các tài liệu được con người dịch sang hai ngôn ngữ — và để các thuật toán thống kê tự học mối tương quan. Hệ thống sẽ phân tách một câu nguồn thành các cụm từ chồng chéo lên nhau (không phải các cụm từ ngữ pháp, mà là các đoạn n-gram tùy ý), tìm các bản dịch có xác suất thống kê cao cho từng đoạn, rồi ghép thành một câu đích bằng cách sử dụng một **mô hình ngôn ngữ (language model)** nhằm đảm bảo đầu ra trôi chảy.

Công cụ chủ lực của thời kỳ này là **Moses**, một bộ công cụ SMT mã nguồn mở được phát triển chủ yếu tại Đại học Edinburgh dưới sự dẫn dắt của Philipp Koehn, phát hành năm 2006. Moses đã trở thành "Linux của nghiên cứu MT" — hầu như mọi phòng thí nghiệm MT học thuật trên thế giới đều sử dụng nó. Một công cụ đồng hành cùng nó, **cdec** (do Chris Dyer phát triển tại Carnegie Mellon), cung cấp các khả năng tương tự với một hình thức hình thức hóa khác. Cùng nhau, các công cụ này đã định hình một thập kỷ nghiên cứu MT.

SMT dựa trên cụm từ hoạt động hiệu quả đến kinh ngạc đối với các cặp ngôn ngữ có dữ liệu song ngữ dồi dào và trật tự từ tương đồng — Anh–Pháp, Anh–Tây Ban Nha, Anh–Đức. Nhưng nó lại có những hạn chế cấu trúc sâu sắc. Hệ thống hoàn toàn không có khái niệm về mặt ngữ nghĩa. Nó chỉ đơn thuần khớp mẫu trên các chuỗi bề mặt, lắp ráp các bản dịch từ các đoạn đã ghi nhớ. Nó gặp khó khăn với các phụ thuộc tầm xa (một đại từ tham chiếu đến một danh từ cách đó vài mệnh đề), với việc đảo trật tự từ giữa các ngôn ngữ khác biệt về loại hình (chẳng hạn như Anh–Nhật, nơi động từ xuất hiện ở vị trí đối lập), và với bất kỳ hiện tượng nào đòi hỏi sự trừu tượng hóa thực sự về cấu trúc ngôn ngữ. Mỗi cải tiến đều đòi hỏi kỹ thuật ngày càng phức tạp, rườm rà: các quy tắc đảo trật tự thủ công, các đặc trưng thưa (sparse features), các mô hình ngôn ngữ khổng lồ. Kiến trúc này đã dần chạm tới giới hạn trần của nó.

### Bước đột phá: Sequence-to-Sequence cùng cơ chế Attention

Vết rạn đầu tiên trong mô hình SMT không đến từ cộng đồng MT, mà từ các nhà nghiên cứu học sâu (deep learning) làm việc trên các bài toán mô hình hóa chuỗi (sequence modelling).

Vào tháng 9 năm 2014, **Dzmitry Bahdanau, Kyunghyun Cho, và Yoshua Bengio** tại Université de Montréal đã công bố một bài báo mang tính bước ngoặt: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (được trình bày tại ICLR 2015). Đổi mới then chốt chính là **cơ chế chú ý (attention mechanism)**.

Để hiểu vì sao điều này lại quan trọng, bạn cần nắm được bối cảnh trước đó. Chỉ vài tháng trước, Ilya Sutskever, Oriol Vinyals, và Quoc V. Le tại Google đã công bố bài báo ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) (NIPS 2014), chứng minh rằng một mạng nơ-ron với kiến trúc **encoder–decoder** (bộ mã hóa – bộ giải mã) có thể dịch các câu. Bộ mã hóa đọc câu nguồn từng từ một và nén nó thành một vector đơn lẻ có độ dài cố định — một bản tóm tắt số học của toàn bộ đầu vào. Sau đó, bộ giải mã sẽ sinh ra câu đích từng từ một từ vector đó.

Cách tiếp cận này rất thanh lịch nhưng lại có một lỗ hổng nghiêm trọng: vector đơn lẻ đó là một **nút thắt cổ chai**. Tất cả thông tin trong một câu nguồn dài ba mươi từ phải bị ép vào một vector chỉ chứa, chẳng hạn, 1.000 con số. Các câu ngắn được dịch khá tốt; các câu dài bị suy giảm chất lượng nghiêm trọng, bởi vì mô hình đã quên các từ trước đó vào thời điểm nó mã hóa xong các từ phía sau.

Cơ chế attention của Bahdanau đã giải quyết triệt để vấn đề này. Thay vì nén toàn bộ câu nguồn thành một vector duy nhất, bộ giải mã được phép **nhìn lại** tất cả các trạng thái ẩn (hidden states) của bộ mã hóa — các biểu diễn trung gian ở mọi vị trí câu nguồn — và tự động gán trọng số xem vị trí nào liên quan nhất để sinh ra từng từ đích. Khi tạo ra từ tiếng Anh "cat", mô hình có thể tập trung chú ý mạnh nhất vào từ tiếng Pháp "chat" trong câu nguồn, ngay cả khi chúng nằm cách xa nhau trong câu. Mô hình đã học cách *căn chỉnh* (align) các từ nguồn và đích như một phần của quá trình dịch, thay vì phụ thuộc vào một bản tóm tắt nén đơn lẻ.

Đây là cải tiến nền tảng. Attention không chỉ cải thiện MT; nó đã trở thành cơ chế trung tâm của hầu như mọi bước tiến tiếp theo trong xử lý ngôn ngữ tự nhiên (NLP).

### Google chuyển sang mạng nơ-ron

Các kết quả học thuật năm 2014–2015 rất ấn tượng nhưng vẫn chưa sẵn sàng cho môi trường sản phẩm (production). Điều đó đã thay đổi vào cuối năm 2016.

Vào tháng 9 năm 2016, một nhóm nghiên cứu lớn tại Google do **Yonghui Wu** dẫn đầu đã công bố ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). Hệ thống này, được biết đến với tên gọi **GNMT** (Google Neural Machine Translation), là một kiến trúc encoder–decoder quy mô công nghiệp kết hợp cơ chế attention, được huấn luyện trên nguồn tài nguyên dữ liệu song ngữ khổng lồ của Google. Bài báo đưa ra một tuyên bố gây kinh ngạc: trên một số cặp ngôn ngữ nhất định, GNMT đã giảm lỗi dịch từ 55–85% so với hệ thống SMT dựa trên cụm từ hiện có của Google.

Vào tháng 11 năm 2016, Google bắt đầu âm thầm chuyển đổi Google Translate từ SMT dựa trên cụm từ sang GNMT cho các cặp ngôn ngữ chính. Quá trình chuyển đổi về cơ bản đã hoàn tất cho các cặp ngôn ngữ tài nguyên cao vào năm 2017. Đối với người dùng, sự thay đổi thật ngoạn mục. Những bản dịch trước đây vốn khô cứng, rời rạc và thỉnh thoảng vô nghĩa nay trở nên trôi chảy hơn đáng kể — đôi khi trôi chảy đến mức bất ngờ. Kỷ nguyên coi "Google Dịch nói nhảm" như một trò đùa đã dần đi đến hồi kết.

Phản ứng cạnh tranh diễn ra nhanh chóng. Vào tháng 8 năm 2017, **DeepL**, do **Gereon Frahling** thành lập tại Cologne, Đức, đã ra mắt dịch vụ dịch thuật của mình. DeepL phát triển từ dự án đối chiếu song ngữ Linguee và tạo sự khác biệt nhờ chất lượng dịch vượt trội — đặc biệt đối với các cặp ngôn ngữ châu Âu, nơi nó nhanh chóng tạo dựng được danh tiếng trong giới dịch giả chuyên nghiệp vì tạo ra văn bản tự nhiên, giàu sắc thái bản ngữ hơn Google. Mô hình kinh doanh của DeepL (freemium với API trả phí) cùng việc tập trung vào chất lượng thay vì số lượng đã định hình vị thế thị trường của hãng sau này. DeepL hỗ trợ khoảng 33 ngôn ngữ — ít hơn nhiều so với con số 194 trong danh sách của Google Cloud Translation — nhưng giữ vững định vị chất lượng là trên hết.

### Transformer

Nếu cơ chế attention của Bahdanau là nền móng, thì **Transformer** chính là tòa nhà được xây trên nền móng đó — và tòa nhà này là một tòa nhà chọc trời.

Vào tháng 6 năm 2017, một nhóm gồm tám nhà nghiên cứu tại Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, và Illia Polosukhin** — đã công bố bài báo ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) tại NIPS 2017. Tiêu đề không hề nói quá; đó là một khẳng định kiến trúc chính xác. Trong khi các mô hình trước đây sử dụng mạng nơ-ron hồi quy (RNN) làm xương sống — xử lý từ ngữ một cách tuần tự, từng từ một, giống như đọc một câu từ trái sang phải — thì Transformer loại bỏ hoàn toàn tính hồi quy và chỉ dựa duy nhất vào attention.

Các cải tiến then chốt bao gồm:

1. **Self-attention (Tự chú ý)**: Mỗi từ trong một câu chú ý đến mọi từ khác trong cùng câu đó, tính toán các mối quan hệ song song thay vì tuần tự. Cơ chế này nắm bắt các phụ thuộc tầm xa mà không gặp phải nút thắt cổ chai thông tin của RNN, và — quan trọng nhất — nó xử lý song song được trên phần cứng hiện đại (GPU và TPU), giúp việc huấn luyện nhanh hơn rõ rệt.

2. **Multi-head attention (Chú ý đa đầu)**: Thay vì tính toán một mẫu attention duy nhất, mô hình tính toán nhiều mẫu attention đồng thời ("các đầu" hay "heads"), mỗi đầu có khả năng nắm bắt các loại quan hệ ngôn ngữ khác nhau — cú pháp, ngữ nghĩa, vị trí.

3. **Positional encoding (Mã hóa vị trí)**: Vì self-attention xử lý tất cả các từ cùng một lúc (không giống như RNN xử lý tuần tự), mô hình vốn không có khái niệm nội tại về trật tự từ. Các mã hóa vị trí — các hàm toán học được đưa vào đầu vào — sẽ cung cấp thông tin này.

Transformer không chỉ vượt trội hơn các mô hình dựa trên RNN trên các bài benchmark dịch thuật. Nó huấn luyện **nhanh hơn nhiều bậc độ lớn** nhờ khả năng song song hóa. Điều này được cho là quan trọng ngang ngửa với việc cải thiện chất lượng: các nhà nghiên cứu giờ đây có thể lặp nhanh hơn, huấn luyện trên nhiều dữ liệu hơn và mở rộng quy mô sang các mô hình lớn hơn. Vòng xoáy mở rộng quy mô tích cực đã bắt đầu.

Trong vòng hai năm, kiến trúc Transformer đã trở thành nền tảng cho hầu như toàn bộ các công trình nghiên cứu hiện đại nhất (state-of-the-art) trong NLP — không chỉ MT, mà cả mô hình hóa ngôn ngữ, phân loại văn bản, trả lời câu hỏi, tóm tắt văn bản, và cuối cùng là các mô hình ngôn ngữ lớn (GPT, BERT, LLaMA) sẽ định hình lại toàn cảnh AI nói chung. Mọi hệ thống được thảo luận trong phần còn lại của báo cáo này đều được xây dựng trên Transformer.

### Bước ngoặt WMT 2016

**Conference on Machine Translation** (WMT), được tổ chức hàng năm dưới dạng hội thảo đồng địa điểm với các hội nghị NLP lớn, triển khai các **nhiệm vụ chung (shared tasks)** mang tính cạnh tranh, nơi các nhóm nghiên cứu nộp các hệ thống MT và được xếp hạng đối đầu trên các tập kiểm thử tiêu chuẩn hóa. WMT là sân chơi gần nhất mà lĩnh vực MT có để đóng vai trò như một bảng xếp hạng công khai.

Tại **WMT 2016**, các hệ thống MT nơ-ron đã áp đảo hoàn toàn các hệ thống SMT dựa trên cụm từ trên hầu như tất cả các cặp ngôn ngữ trong nhiệm vụ chung. Đây chính là thời điểm trọng tâm của lĩnh vực này dịch chuyển. Các nhà nghiên cứu từng dành cả sự nghiệp để xây dựng các hệ thống dựa trên cụm từ bắt đầu chuyển hướng sang mô hình nơ-ron. Trong vòng hai năm, các ấn phẩm mới sử dụng SMT dựa trên cụm từ cho bất kỳ mục đích nào khác ngoài việc so sánh lịch sử về cơ bản đã chấm dứt. Moses, công cụ từng định hình cả một thập kỷ, đã chính thức lui về quá khứ.

Sự chuyển đổi diễn ra nhanh chóng một cách đáng kinh ngạc theo tiêu chuẩn của các bước chuyển mô hình học thuật — chỉ khoảng ba đến bốn năm kể từ bài báo năm 2014 của Bahdanau đến sự thống trị gần như hoàn toàn của MT nơ-ron vào năm 2018. Đối với một nhà nghiên cứu bước chân vào lĩnh vực này ngày nay, SMT dựa trên cụm từ chỉ còn là bối cảnh lịch sử, không phải là một hướng nghiên cứu thực tế. Nhưng đó là bối cảnh thiết yếu, bởi vì các giả định, bài benchmark và thói quen đánh giá của kỷ nguyên SMT vẫn còn vang vọng trong toàn ngành.

---

## Phần 2: Bước chuyển sang đa ngôn ngữ (2018–2022)

### Một mô hình, nhiều ngôn ngữ

Thế hệ hệ thống MT nơ-ron đầu tiên là các hệ thống **song ngữ**: một mô hình cho mỗi cặp ngôn ngữ. Cặp Anh–Pháp cần một mô hình; Pháp–Anh lại cần một mô hình riêng biệt. Việc mở rộng quy mô cách tiếp cận này cho N ngôn ngữ về mặt lý thuyết đòi hỏi N×(N−1) mô hình — một nút thắt cổ chai về mặt kỹ thuật và dữ liệu khiến MT nơ-ron bị giới hạn trên thực tế trong một số ít cặp ngôn ngữ dồi dào tài nguyên.

Câu hỏi định hình giai đoạn 2018–2022 là: *liệu một mô hình nơ-ron đơn lẻ có thể học cách dịch giữa nhiều ngôn ngữ cùng một lúc không?* Câu trả lời hóa ra là có, đi kèm những hệ quả sâu sắc và phức tạp.

### Biểu diễn xuyên ngôn ngữ: mBERT và XLM-R

Trước khi các mô hình dịch đa ngôn ngữ xuất hiện, một khám phá bất ngờ trong các mô hình *hiểu* ngôn ngữ đã mở đường cho hướng đi này.

Vào cuối năm 2018, Google đã phát hành **Multilingual BERT (mBERT)** — một mô hình Transformer đơn lẻ được huấn luyện trên văn bản Wikipedia từ 104 ngôn ngữ. BERT (Bidirectional Encoder Representations from Transformers) không phải là mô hình dịch thuật; nó là một bộ mã hóa ngôn ngữ đa mục đích, được huấn luyện để dự đoán các từ bị che giấu trong văn bản. Điều khiến các nhà nghiên cứu sửng sốt là một đặc tính mới nổi: mBERT đã phát triển các **biểu diễn xuyên ngôn ngữ (cross-lingual representations)** mà chưa bao giờ được dạy một cách rõ ràng rằng các ngôn ngữ có liên quan với nhau. Nếu bạn tinh chỉnh (fine-tune) mBERT cho tác vụ phân loại cảm xúc tiếng Anh rồi áp dụng trực tiếp lên văn bản tiếng Pháp — hoàn toàn không có dữ liệu huấn luyện tiếng Pháp nào — nó vẫn hoạt động rất ấn tượng. Hiện tượng này, được gọi là **chuyển giao xuyên ngôn ngữ zero-shot (zero-shot cross-lingual transfer)**, gợi ý rằng các mô hình đa ngôn ngữ đang học một loại không gian biểu diễn chung giữa các ngôn ngữ.

Năm 2020, **Alexis Conneau** cùng các đồng nghiệp tại Facebook AI Research (nay là Meta) đã đẩy xa điều này hơn với **XLM-R** (Cross-lingual Language Model – RoBERTa). Được huấn luyện trên 2,5 terabyte dữ liệu CommonCrawl đã qua lọc trên 100 ngôn ngữ, XLM-R vượt trội đáng kể so với mBERT trên các bài benchmark xuyên ngôn ngữ. Nó chứng minh rằng với đủ dữ liệu và dung lượng mô hình, một bộ mã hóa đơn lẻ có thể xây dựng các biểu diễn đa ngôn ngữ vững chắc.

Bản thân các mô hình này không phải là công cụ dịch, nhưng chúng đã cung cấp nền tảng khái niệm và kỹ thuật cho MT đa ngôn ngữ. Nếu một mô hình có thể học các biểu diễn chung trên 100 ngôn ngữ, thì một mô hình dịch thuật hẳn cũng có thể dịch qua lại giữa chúng — ít nhất là về mặt nguyên lý.

### Dịch Many-to-Many: M2M-100

Các hệ thống MT đa ngôn ngữ truyền thống có một "bí mật không mấy tự hào": chúng định tuyến hầu hết các bản dịch **qua tiếng Anh**. Dịch từ tiếng Bồ Đào Nha sang tiếng Nhật đồng nghĩa với việc trước tiên dịch tiếng Bồ Đào Nha sang tiếng Anh, sau đó từ tiếng Anh sang tiếng Nhật. Cách tiếp cận "lấy tiếng Anh làm trung tâm" này mang tính thực dụng — hầu hết dữ liệu song ngữ đều có một vế là tiếng Anh — nhưng nó gây ra lỗi tích lũy và áp đặt cấu trúc câu của tiếng Anh lên mọi bản dịch.

Vào tháng 10 năm 2020, Facebook AI đã công bố **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): một mô hình dịch many-to-many bao quát **100 ngôn ngữ và 2.200 chiều dịch** mà không cần định tuyến qua tiếng Anh. Đây là một bước đột phá về mặt khái niệm. Mô hình có thể dịch trực tiếp giữa, chẳng hạn, tiếng Bengali và tiếng Swahili, bằng cách sử dụng dữ liệu song ngữ được khai thác từ web cho các cặp không có tiếng Anh.

M2M-100 đã chứng minh rằng việc dùng tiếng Anh làm ngôn ngữ bắc cầu (pivoting) không phải là một ràng buộc bắt buộc của MT đa ngôn ngữ. Nhưng nó cũng bộc lộ những giới hạn của cách tiếp cận này: chất lượng rất không đồng đều giữa các cặp ngôn ngữ, với một số chiều dịch hầu như không thể sử dụng được. Khoảng cách giữa "mô hình này *hỗ trợ* 2.200 chiều dịch" và "mô hình này *hoạt động tốt* ở 2.200 chiều dịch" sẽ trở thành một chủ đề trọng tâm.

### NLLB-200: Không để ngôn ngữ nào bị bỏ lại phía sau

Nỗ lực MT đa ngôn ngữ tham vọng nhất của Meta xuất hiện vào tháng 7 năm 2022 với **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), được công bố dưới dạng bài báo nghiên cứu của Meta AI với hơn 200 đồng tác giả). Mục tiêu đã thể hiện rõ ràng ngay trong tên gọi: xây dựng một mô hình duy nhất hỗ trợ 200 ngôn ngữ, đặc biệt tập trung vào các ngôn ngữ tài nguyên thấp vốn bị MT thương mại phớt lờ trước đây.

Các đóng góp kỹ thuật của NLLB-200 rất đáng kể:

- **Kiến trúc**: Một mô hình Transformer dày đặc (dense) và một biến thể **Mixture-of-Experts (MoE)**, nơi các tập hợp tham số khác nhau của mô hình được kích hoạt cho các cặp ngôn ngữ khác nhau. Biến thể lớn nhất, NLLB-200-MoE-54B, có 54 tỷ tham số. Một phiên bản chưng cất (distilled) 600 triệu tham số đã giúp việc triển khai thực tế trở nên khả thi.

- **Khai phá dữ liệu**: Nhóm nghiên cứu đã phát triển các công cụ tự động để khai phá các câu song ngữ từ dữ liệu thu thập web (web crawls), bao gồm một mô hình nhận diện ngôn ngữ (bao quát hơn 200 ngôn ngữ) và một bộ lọc câu song ngữ. Quy trình này mang tính sống còn để thu thập dữ liệu huấn luyện cho các ngôn ngữ có sự hiện diện tối thiểu trên web.

- **FLORES-200**: Một bộ benchmark đánh giá tiêu chuẩn hóa bao quát toàn bộ 200 ngôn ngữ với các câu được dịch bởi các dịch giả chuyên nghiệp. FLORES-200 đã trở thành một công cụ thiết yếu cho lĩnh vực này — trước đó, hầu hết các ngôn ngữ này đều chưa từng có bộ benchmark nào.

- **Phát hành mở**: Cả mô hình và FLORES-200 đều được phát hành công khai, cho phép các nhà nghiên cứu trên toàn thế giới kế thừa và phát triển thêm.

NLLB-200 là một cột mốc mang tính lịch sử, nhưng việc hiểu rõ những hạn chế của nó cũng quan trọng không kém. Chất lượng dao động rất lớn giữa các ngôn ngữ. Đối với các cặp dồi dào tài nguyên (Anh–Pháp, Anh–Trung), mô hình đáp ứng tốt nhưng chưa đạt mức xuất sắc nhất (state-of-the-art) so với các hệ thống chuyên biệt. Đối với các ngôn ngữ tài nguyên thấp, chất lượng đầu ra dao động từ mức hữu ích đến mức thực chất không thể dùng được, tùy thuộc vào lượng dữ liệu huấn luyện đã khai thác được nhiều hay ít. Mô hình cũng thể hiện rõ **lời nguyền đa ngôn ngữ (curse of multilinguality)**: việc thêm nhiều ngôn ngữ vào một mô hình có dung lượng cố định sẽ làm loãng chất lượng biểu diễn cho từng ngôn ngữ. Các ngôn ngữ tài nguyên thấp được hưởng lợi từ việc học chuyển giao (cấu trúc chia sẻ với các ngôn ngữ có liên quan), nhưng các ngôn ngữ tài nguyên cao thực tế có thể bị *kém đi* khi mô hình phải gánh vác quá nhiều mục tiêu cùng lúc. Đây không chỉ đơn thuần là bài toán mở rộng quy mô — nó phản ánh một sự giằng co mang tính nền tảng trong thiết kế mô hình đa ngôn ngữ.

### Bộ công cụ Seamless

Meta tiếp tục đẩy mạnh MT đa ngôn ngữ với dòng mô hình **Seamless** trong giai đoạn 2023–2024. **SeamlessM4T** ("Massively Multilingual and Multimodal Machine Translation," tháng 8 năm 2023) là một mô hình duy nhất xử lý **dịch giọng nói sang giọng nói, giọng nói sang văn bản, văn bản sang giọng nói và văn bản sang văn bản** trên khoảng 100 ngôn ngữ (với độ bao phủ khác nhau giữa các phương thức). Đây là sự hội tụ của các nhánh nghiên cứu vốn tách biệt trước đây — nhận dạng giọng nói tự động (ASR), dịch văn bản và tổng hợp giọng nói (TTS) — thành một hệ thống đa ngôn ngữ hợp nhất.

Bộ sản phẩm tiếp theo **Seamless Communication** đã bổ sung khả năng phát trực tuyến (dịch gần với thời gian thực) và dịch giọng nói có biểu cảm (giữ lại các đặc điểm giọng nói như cảm xúc và phong cách nói qua các ngôn ngữ). Các hệ thống này vẫn dừng lại ở mức nguyên mẫu nghiên cứu hơn là các công cụ sẵn sàng cho môi trường sản phẩm, nhưng chúng báo hiệu hướng đi tương lai của lĩnh vực này: đa phương thức, đa ngôn ngữ và thời gian thực.

### "Đa ngôn ngữ quy mô lớn" có ý nghĩa gì trong thực tế

Đối với một nhà nghiên cứu mới bước vào lĩnh vực này, điều cốt yếu là phải phân biệt giữa **độ bao phủ ngôn ngữ** và **chất lượng ngôn ngữ** của một mô hình. Một mô hình "hỗ trợ 200 ngôn ngữ" có thể cung cấp bản dịch xuất sắc cho 20 ngôn ngữ, đầu ra dùng tạm được cho 50 ngôn ngữ, và thực chất tạo ra văn bản ngẫu nhiên cho phần còn lại. Con số trên dòng tiêu đề rất dễ gây hiểu lầm nếu thiếu đi sự đánh giá chất lượng trên từng ngôn ngữ riêng biệt.

**Lời nguyền đa ngôn ngữ (curse of multilinguality)** là thuật ngữ kỹ thuật chỉ vấn đề suy giảm dung lượng: một mô hình với các tham số hữu hạn không thể biểu diễn tất cả các ngôn ngữ tốt như nhau. Thêm nhiều ngôn ngữ sẽ mang lại lợi ích cho các ngôn ngữ nghèo tài nguyên nhất (thông qua chuyển giao xuyên ngôn ngữ từ các ngôn ngữ liên quan) nhưng lại gây hại cho các ngôn ngữ giàu tài nguyên nhất (do tiêu tốn dung lượng vốn có thể dành riêng cho chúng). Điều này tạo ra một thế lưỡng nan trong thiết kế: bạn nên xây dựng một mô hình vạn năng duy nhất, hay nhiều mô hình chuyên biệt? Ngành nghiên cứu hiện vẫn chưa có lời giải dứt khoát cho câu hỏi này.

---

## Phần 3: Kỷ nguyên LLM (2022–2026)

### Khi AI đa mục đích học dịch thuật

Sự xuất hiện của các mô hình ngôn ngữ lớn (LLM) — GPT-3.5/4, Gemini, Claude, LLaMA — đã tạo ra một tình huống kỳ lạ trong lĩnh vực MT. Những mô hình này không được huấn luyện chuyên biệt cho dịch thuật. Chúng được huấn luyện để dự đoán token tiếp theo trong các kho ngữ liệu văn bản khổng lồ, chủ yếu là tiếng Anh nhưng ngày càng đa ngôn ngữ hơn. Tuy nhiên, khi được nhắc bằng các câu lệnh như "Dịch câu tiếng Pháp sau sang tiếng Anh", chúng lại tạo ra các bản dịch tốt đến mức đáng kinh ngạc đối với các cặp ngôn ngữ tài nguyên cao.

Điều này đặt lĩnh vực MT trước một câu hỏi về bản sắc: nếu AI đa mục đích có thể dịch tốt như các hệ thống dịch chuyên dụng, liệu "dịch máy" có còn là một lĩnh vực nghiên cứu riêng biệt? Câu trả lời, tính đến năm 2026, là có (nhưng có điều kiện) — mối quan hệ giữa nghiên cứu MT và phát triển LLM đa mục đích đã trở nên gắn kết chặt chẽ với nhau.

### Những bài benchmark đầu tiên: LLM so với MT chuyên dụng

Việc đánh giá có hệ thống các LLM cho tác vụ dịch thuật bắt đầu vào đầu năm 2023, ngay sau khi ChatGPT (tháng 11 năm 2022) và GPT-4 (tháng 3 năm 2023) ra mắt.

**Jiao et al. (2023)**, trong bài báo ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745), đã đưa ra một đánh giá sớm. Các phát hiện của họ thiết lập một khuôn mẫu tương đối ổn định: LLM **có tính cạnh tranh rất cao đối với các cặp ngôn ngữ châu Âu tài nguyên cao** (Anh–Đức, Anh–Pháp, Anh–Trung) và **yếu hơn rõ rệt đối với các cặp tài nguyên thấp và các cặp khác biệt về loại hình ngôn ngữ**. Họ cũng giới thiệu kỹ thuật **prompt trung gian (pivot prompting)** — hướng dẫn mô hình dịch thông qua một ngôn ngữ trung gian — giúp cải thiện hiệu năng trên các cặp khó.

**Hendy et al. (2023)** tại Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) đã thực hiện một đánh giá toàn diện hơn trên 18 chiều dịch. Kết luận của họ: các mô hình GPT sánh ngang với MT thương mại hàng đầu đối với các cặp tài nguyên cao nhưng có "khả năng hạn chế" trên các ngôn ngữ tài nguyên thấp.

Đến giai đoạn 2024–2025, bức tranh đã trở nên rõ ràng hơn. Đối với **các cặp tài nguyên cao**, những LLM tốt nhất (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) tương đương hoặc vượt trội hơn các hệ thống MT chuyên dụng, đặc biệt đối với các tác vụ đòi hỏi hiểu ngữ cảnh, diễn đạt thành ngữ và sự mạch lạc ở cấp độ tài liệu — những khía cạnh mà MT nơ-ron truyền thống (vốn xử lý các câu riêng lẻ) luôn gặp khó khăn. Đối với **các cặp tài nguyên thấp**, các mô hình đa ngôn ngữ chuyên dụng như NLLB-200 và các hệ thống xây dựng riêng của Google Translate vẫn vượt trội hơn LLM, thường là với khoảng cách rất lớn.

### BLOOM: Thời khắc đa ngôn ngữ mở

Vào tháng 7 năm 2022, dự án hợp tác **BigScience** — một nỗ lực tình nguyện kéo dài một năm do Hugging Face điều phối với sự tham gia của hàng trăm nhà nghiên cứu trên toàn cầu — đã phát hành **BLOOM**: một mô hình ngôn ngữ đa ngôn ngữ truy cập mở với 176 tỷ tham số bao quát **46 ngôn ngữ tự nhiên và 13 ngôn ngữ lập trình**. Được huấn luyện trên kho ngữ liệu ROOTS bằng siêu máy tính Jean Zay tại Pháp, BLOOM là LLM đa ngôn ngữ truy cập mở thực sự khổng lồ đầu tiên.

BLOOM không phải là một công cụ dịch thuật chuyên dụng, nhưng ý nghĩa của nó đối với MT là rất đáng kể. Nó chứng minh rằng các mô hình mã nguồn mở có thể hỗ trợ hàng chục ngôn ngữ ở quy mô lớn, tạo nền tảng cho nghiên cứu đa ngôn ngữ bên ngoài các phòng thí nghiệm của các tập đoàn. Biến thể tinh chỉnh theo câu lệnh của nó, **BLOOMZ**, đã cho thấy khả năng khái quát hóa xuyên ngôn ngữ — khi được tinh chỉnh trên các tác vụ bằng một ngôn ngữ, nó có thể thực hiện chúng trên các ngôn ngữ khác.

### LLaMA và sự bùng nổ tinh chỉnh

Dòng mô hình **LLaMA** (Large Language Model Meta AI) của Meta, bắt đầu từ tháng 2 năm 2023, đã chọn một hướng đi khác. LLaMA 1 chủ yếu lấy tiếng Anh làm trung tâm, với khả năng đa ngôn ngữ rất hạn chế. LLaMA 2 (tháng 7 năm 2023) có cải thiện đôi chút nhưng vẫn phân loại việc sử dụng ngoài tiếng Anh là "ngoài phạm vi". Bước ngoặt đến với **LLaMA 3** (tháng 4 năm 2024), tăng lượng dữ liệu huấn luyện lên gấp bảy lần và giới thiệu một bộ từ vựng 128.000 token — cải thiện đáng kể khả năng mã hóa văn bản phi tiếng Anh. LLaMA 3 chính thức hỗ trợ tám ngôn ngữ (Anh, Đức, Pháp, Ý, Bồ Đào Nha, Hindi, Tây Ban Nha, Thái) với chất lượng khác nhau cho nhiều ngôn ngữ khác.

Tầm quan trọng của LLaMA đối với MT ít nằm ở khả năng dịch trực tiếp của nó, mà phần lớn nằm ở vai trò như một **mô hình nền tảng để tinh chỉnh (fine-tuning)**. Cả hai LLM dịch thuật chuyên dụng được thảo luận dưới đây — Tower và ALMA — đều được xây dựng trên LLaMA. Trọng số mở của nó đã tạo ra một hệ sinh thái phái sinh chuyên biệt phát triển mạnh mẽ.

### Các LLM dịch thuật chuyên dụng: Tower và ALMA

Bước phát triển đáng chú ý nhất của giai đoạn 2023–2024 là sự xuất hiện của các LLM được tinh chỉnh chuyên biệt cho dịch thuật — các hệ thống lai thừa hưởng khả năng hiểu ngữ cảnh phức tạp của các LLM đa mục đích nhưng được tối ưu hóa cho chất lượng dịch thuật.

**ALMA** (Advanced Language Model-based trAnslator), do **Haoran Xu** và các đồng nghiệp tại Đại học Johns Hopkins phát triển, đã chứng minh một hiểu biết cốt lõi: bạn không cần các kho ngữ liệu song ngữ khổng lồ để xây dựng một bộ dịch xuất sắc. ALMA sử dụng phương pháp **tinh chỉnh hai giai đoạn** trên LLaMA-2: đầu tiên, tiếp tục tiền huấn luyện trên dữ liệu đơn ngữ phi tiếng Anh để mở rộng kiến thức đa ngôn ngữ; sau đó, tinh chỉnh trên một tập dữ liệu song ngữ nhỏ nhưng chất lượng cao. Phiên bản tiếp theo, **ALMA-R** (tháng 1 năm 2024), đã đưa vào kỹ thuật **Tối ưu hóa sở thích tương phản (Contrastive Preference Optimisation - CPO)** — huấn luyện mô hình trên dữ liệu sở thích (bản dịch tốt hơn so với bản dịch kém hơn) thay vì chỉ dùng văn bản song ngữ. Kết quả: các mô hình 7B và 13B tham số đã tương đương hoặc vượt qua GPT-4 trên các bài benchmark dịch thuật. Bài báo được công bố tại ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Một phiên bản sau đó, **X-ALMA**, đã mở rộng độ bao phủ lên 50 ngôn ngữ bằng cách sử dụng các mô-đun cắm-và-chạy (plug-and-play) theo từng ngôn ngữ cụ thể.

**Tower**, do **Unbabel** (một công ty dịch thuật AI của Bồ Đào Nha) phát triển cùng sự hợp tác của SARDINE Lab và MICS Lab, có tầm nhìn rộng hơn. Thay vì chỉ tối ưu hóa riêng cho dịch thuật, Tower bao quát **toàn bộ quy trình dịch**: sửa lỗi văn bản nguồn, nhận diện thực thể có tên (NER), biên tập hậu kỳ (post-editing), xếp hạng bản dịch và phát hiện lỗi. Các mô hình Tower ban đầu (7B và 13B, dựa trên LLaMA-2) đã vượt trội hơn NLLB-200-54B. **Tower v2** (70B, được trình bày tại WMT 2024) đã vượt qua GPT-4o, Claude 3.5 Sonnet và DeepL. Phiên bản mới nhất **Tower+** (2025) mở rộng lên 22–27 ngôn ngữ và giải quyết hiện tượng "quên thảm khốc" (catastrophic forgetting) — xu hướng các mô hình tinh chỉnh bị mất đi các khả năng tổng quát — thông qua tối ưu hóa sở thích và học tăng cường.

### Prompting so với Fine-Tuning: Cuộc tranh luận chưa hồi kết

Một câu hỏi dai dẳng trong không gian LLM-MT là liệu việc **prompt** một LLM đa mục đích cho dịch thuật (zero-shot hoặc few-shot) tốt hơn, hay **tinh chỉnh (fine-tune)** một mô hình chuyên biệt cho dịch thuật sẽ tốt hơn. Các bằng chứng cho thấy câu trả lời phụ thuộc vào từng tác vụ:

- **Prompting** bảo toàn các khả năng tổng quát của LLM — điều hướng mức độ trang trọng, kiểm soát phong cách, tính mạch lạc ở cấp độ tài liệu — và không đòi hỏi huấn luyện thêm. Cách này lý tưởng cho việc lặp nhanh và dịch thuật sáng tạo hoặc cần nhiều ngữ cảnh.
- **Fine-tuning** mang lại độ chính xác cao hơn trên các cặp ngôn ngữ và miền dữ liệu cụ thể nhưng có nguy cơ làm suy giảm các khả năng khác ("quên thảm khốc"). Phương pháp này đòi hỏi dữ liệu song ngữ và tài nguyên tính toán.
- **Các phương pháp lai** ngày càng chiếm ưu thế trong thực tế: sử dụng các mô hình tinh chỉnh để dịch ban đầu, kết hợp với các lượt biên tập hậu kỳ hoặc tự tinh chỉnh (self-refinement) dựa trên LLM.

### Trạng thái công nghệ hiện tại (2025–2026)

Câu trả lời thành thực nhất cho câu hỏi "đâu là hệ thống MT tốt nhất?" là: **còn tùy thuộc vào nhu cầu**.

| Trường hợp sử dụng | Cách tiếp cận tốt nhất | Lý do |
|---|---|---|
| Tài nguyên cao, khối lượng lớn | NMT thương mại (Google, DeepL) | Tốc độ, chi phí, tính nhất quán |
| Tài nguyên cao, chất lượng cao | LLM (GPT-4o, Gemini 2.5 Pro) hoặc Tower+ | Hiểu ngữ cảnh, xử lý thành ngữ tốt |
| Tài nguyên thấp, độ phủ rộng | Meta OMT, NLLB-200, Google Translate | Độ bao phủ đa ngôn ngữ được xây dựng chuyên biệt |
| Tài nguyên thấp, cặp ngôn ngữ cụ thể | NLLB hoặc LLM được tinh chỉnh trên dữ liệu chuyên ngành | Cải thiện chất lượng có mục tiêu |
| Nghiên cứu mã nguồn mở | Tower+, ALMA-R, X-ALMA | Trọng số mở, có thể tái lập, giàu tính cạnh tranh |

Vào tháng 3 năm 2026, Meta đã phát hành **OMT (Omnilingual Machine Translation)** — thế hệ kế nhiệm của NLLB-200, mở rộng độ bao phủ từ 200 lên **hơn 1.600 ngôn ngữ**. OMT giải quyết vấn đề mà Meta gọi là "nút thắt cổ chai thế hệ" (generation bottleneck): các mô hình ngôn ngữ lớn có thể hiểu nhiều ngôn ngữ nhưng gặp khó khăn trong việc tạo ra văn bản trôi chảy bằng các ngôn ngữ đó. OMT có hai kiến trúc — OMT-LLaMA (chỉ decoder, 1B–8B tham số) và OMT-NLLB (encoder-decoder) — đồng thời giới thiệu các công cụ đánh giá mới bao gồm BOUQuET và BLASER 3 (một độ đo ước lượng chất lượng không cần tham chiếu). Các báo cáo ban đầu chỉ ra rằng các mô hình 1B–8B tham số tương đương hoặc vượt trội hơn các mô hình cơ sở LLM 70B trên các tác vụ dịch thuật. Việc liệu OMT có bao gồm tiếng Plains Cree hoặc các ngôn ngữ Algonquian khác hay không vẫn còn phải chờ xem.

Bài báo tổng kết nhiệm vụ chung WMT 2024 có tiêu đề rất xác đáng: **"The LLM Era Is Here but MT Is Not Solved Yet"** (Kỷ nguyên LLM đã đến nhưng MT vẫn chưa được giải quyết triệt để). LLM đã nâng cao trần chất lượng cho dịch thuật tài nguyên cao nhưng vẫn chưa giải quyết được các thách thức căn bản của MT tài nguyên thấp, tính đầy đủ của việc đánh giá, hay sự phức tạp về mặt hình thái học.

---

## Phần 4: Vấn đề tài nguyên thấp

### Vì sao hầu hết các ngôn ngữ đều bị bỏ lại phía sau

Trong số khoảng 7.000 ngôn ngữ đang tồn tại trên thế giới, các dịch vụ MT thương mại được triển khai chỉ bao quát khoảng 200 ngôn ngữ, và tất cả các hình thức dịch máy cộng lại cũng chỉ chạm tới khoảng 550 ngôn ngữ ([cách chúng tôi thống kê](/docs/network/context/coverage-counting)). Phần lớn các ngôn ngữ trên thế giới hoàn toàn **không có bất kỳ công cụ dịch máy nào**. Để hiểu lý do tại sao, cần hiểu các hệ thống MT cần những gì và hầu hết các ngôn ngữ đang thiếu hụt những gì.

MT nơ-ron đòi hỏi **dữ liệu song ngữ**: những bộ sưu tập câu khổng lồ được dịch qua lại giữa hai ngôn ngữ bởi con người. Đối với cặp Anh–Pháp, dữ liệu này có rất nhiều — các biên bản nghị viện EU (Europarl), tài liệu của Liên Hợp Quốc, kho lưu trữ tin tức và các bộ nhớ dịch thuật thương mại cung cấp hàng trăm triệu câu song ngữ. Đối với một ngôn ngữ như Plains Cree (*nêhiyawêwin*), được nói bởi khoảng 20.000 người chủ yếu ở miền tây Canada, dữ liệu như vậy gần như không tồn tại. Không có biên bản Liên Hợp Quốc bằng tiếng Plains Cree. Không có kho ngữ liệu tin tức song ngữ. Tổng số văn bản song ngữ hiện có có thể chỉ đo bằng hàng nghìn câu thay vì hàng triệu.

Ngành nghiên cứu sử dụng các bậc tài nguyên ước chừng để phân loại ngôn ngữ:

| Bậc | Dữ liệu song ngữ hiện có | Ví dụ |
|---|---|---|
| Tài nguyên cao | >10 triệu cặp câu | Tiếng Anh, Pháp, Đức, Trung, Tây Ban Nha |
| Tài nguyên trung bình | 1–10 triệu cặp câu | Tiếng Thổ Nhĩ Kỳ, Việt Nam, Swahili |
| Tài nguyên thấp | 100K–1 triệu cặp câu | Tiếng Yoruba, Guaraní, Malta |
| Tài nguyên cực thấp | <100K cặp câu | Tiếng Plains Cree, Quechua, hầu hết ngôn ngữ bản địa |
| Gần như bằng không | <10K cặp câu | Hàng nghìn ngôn ngữ trên toàn thế giới |

### Vấn đề của bộ tách từ (Tokenizer)

Trước khi một mô hình nơ-ron có thể xử lý văn bản, nó phải chuyển đổi các ký tự thành các token số học — một quá trình được gọi là **tách từ (tokenisation)**. Thuật toán tách từ chiếm ưu thế hiện nay là **Byte Pair Encoding (BPE)**, được Sennrich et al. (2016) phổ biến hóa và được triển khai trong các công cụ như **SentencePiece** (Kudo & Richardson, 2018). BPE hoạt động bằng cách học các chuỗi ký tự phổ biến nhất trong một kho ngữ liệu huấn luyện và xây dựng một bộ từ vựng gồm các đơn vị dưới từ (subwords). Trong tiếng Anh, các từ phổ biến như "the" trở thành các token đơn lẻ; các từ hiếm bị tách thành các mẩu dưới từ ("unforgivable" → "un" + "forgiv" + "able").

Vấn đề là các bộ từ vựng BPE được huấn luyện chủ yếu trên các ngôn ngữ tài nguyên cao, trong đó tiếng Anh thường chiếm ưu thế áp đảo. Đối với các ngôn ngữ tài nguyên thấp, đặc biệt là những ngôn ngữ có hình thái phức tạp hoặc chữ viết phi Latinh, hệ quả là vô cùng nghiêm trọng:

- **Phân mảnh quá mức (Over-segmentation)**: Một từ đơn lẻ trong một ngôn ngữ đa tổng hợp (polysynthetic) như tiếng Plains Cree có thể mã hóa cả một mệnh đề hoàn chỉnh. Từ *nikî-nipâw* ("Tôi đã ngủ") sẽ bị bẻ vụn thành vô số mảnh nhỏ — thậm chí là từng byte riêng lẻ — bởi vì thuật toán BPE chưa từng thấy các chuỗi ký tự này trước đây. Những gì vốn là một đơn vị có nghĩa đối với người bản ngữ lại trở thành hàng chục mảnh vụn vô nghĩa đối với mô hình.

- **Vấn đề độ sinh từ (Fertility problem)**: Một từ đơn lẻ trong một ngôn ngữ có hình thái phức tạp có thể cần tới 5–15 token, trong khi bản dịch tiếng Anh của nó chỉ cần 1–3 token. Điều này tạo ra sự bất đối xứng khổng lồ về độ dài chuỗi, làm suy giảm khả năng căn chỉnh chú ý (attention alignment) và chất lượng dịch thuật.

- **Bất lợi về hệ chữ viết (Script penalties)**: Các ngôn ngữ sử dụng chữ viết phi Latinh (chữ âm tiết Cree, chữ Ge'ez Ethiopia, chữ Devanagari) bị tách từ kém hiệu quả hơn nữa, đôi khi phải phân rã về từng byte riêng lẻ. Điều này đồng nghĩa với việc cửa sổ ngữ cảnh hiệu dụng của mô hình bị thu hẹp đáng kể đối với các ngôn ngữ này.

Đây không chỉ là một sự bất tiện thuần túy về mặt kỹ thuật. Bộ từ vựng của tokenizer thực chất đã mã hóa sự thiên vị đối với các ngôn ngữ giàu tài nguyên ngay từ cấp độ nền tảng nhất của hệ thống. Một mô hình phải tiêu tốn 15 token để mã hóa một từ tiếng Cree duy nhất sẽ còn lại rất ít dung lượng để hiểu phần còn lại của câu so với một mô hình xử lý tiếng Anh, nơi cùng một lượng thông tin đó có thể chỉ chiếm 3 token.

### Vấn đề chất lượng dữ liệu

Lượng dữ liệu song ngữ ít ỏi thực sự tồn tại cho các ngôn ngữ tài nguyên thấp thường đến từ **các phạm vi rất hẹp**. Hai nguồn văn bản song ngữ đa ngôn ngữ lớn nhất cho các ngôn ngữ nghèo tài nguyên là:

1. **Các bản dịch Kinh Thánh**: Kinh Thánh đã được dịch sang hơn 700 ngôn ngữ, và các phần trích đoạn được dịch sang hơn 3.000 ngôn ngữ. Điều này làm cho văn bản tôn giáo trở thành nguồn tài nguyên song ngữ sẵn có nhất cho nhiều ngôn ngữ — nhưng một mô hình được huấn luyện chủ yếu trên văn bản kinh thánh sẽ chỉ học được một văn phong, từ vựng và lĩnh vực rất đặc thù. Nó có thể tạo ra câu "ngươi không được làm điều này" nhưng lại không thể dịch nổi câu "làm ơn đặt giúp tôi một chuyến bay".

2. **JW300**: Một tập dữ liệu được trích xuất từ các ấn phẩm của Nhân Chứng Giê-hô-va, bao quát khoảng 300 ngôn ngữ. Dù có quy mô lớn và đa ngôn ngữ, JW300 lại đặt ra cả vấn đề lệch lĩnh vực (nội dung tôn giáo) lẫn những quan ngại về mặt đạo đức liên quan đến nguồn gốc và sự đồng thuận của các bản dịch nền tảng.

**Nhiễm bẩn benchmark (Benchmark contamination)** cũng là một mối lo ngại nghiêm trọng khác. Khi dữ liệu song ngữ khan hiếm, cùng một văn bản có thể vô tình nằm ở cả tập huấn luyện lẫn tập đánh giá — một sự rò rỉ dữ liệu khiến các chỉ số chất lượng bị thổi phồng ảo. Nguồn dữ liệu càng nhỏ thì càng khó phòng ngừa và phát hiện hiện tượng này.

### Tăng cường dữ liệu: Tạo ra nhiều hơn từ nguồn lực ít ỏi

Các nhà nghiên cứu đã phát triển nhiều kỹ thuật để tận dụng tối đa nguồn dữ liệu hạn chế:

- **Dịch ngược (Backtranslation)** (Sennrich et al., 2016): Huấn luyện một mô hình ban đầu trên dữ liệu song ngữ hiện có, sau đó sử dụng nó để dịch văn bản **đơn ngữ** của ngôn ngữ đích ngược trở lại ngôn ngữ nguồn. Thao tác này tạo ra dữ liệu song ngữ tổng hợp tuy còn nhiễu nhưng có thể cải thiện đáng kể chất lượng mô hình. Dịch ngược đã trở thành một kỹ thuật tiêu chuẩn trên mọi phân khúc tài nguyên.

- **Dữ liệu tổng hợp do LLM tạo ra**: Sử dụng các mô hình ngôn ngữ lớn để tạo dữ liệu huấn luyện cho các cặp tài nguyên thấp. Hướng đi này rất triển vọng nhưng tiềm ẩn rủi ro — văn bản được tạo ra có thể biểu hiện tính "dịch ngữ" (translationese - các khuôn mẫu dịch thô cứng, mất tự nhiên hoặc bị ảnh hưởng nặng bởi cấu trúc câu nguồn) và có thể khuếch đại bất kỳ định kiến nào vốn có trong LLM.

- **Chuyển giao xuyên ngôn ngữ (Cross-lingual transfer)**: Huấn luyện trên dữ liệu song ngữ từ một ngôn ngữ có quan hệ họ hàng giàu tài nguyên hơn (chẳng hạn dùng dữ liệu Tây Ban Nha–Anh để khởi tạo MT cho cặp Guaraní–Anh) với hy vọng các đặc trưng cấu trúc chung sẽ được chuyển giao. Cách này hoạt động tốt hơn đối với các ngôn ngữ có quan hệ họ hàng gần so với các ngôn ngữ khác biệt về loại hình.

- **Phân đoạn hình thái học (Morphological segmentation)**: Tiền xử lý văn bản để tách các từ thành các hình vị (morpheme - đơn vị nhỏ nhất có nghĩa) trước khi đưa vào mô hình. Đối với các ngôn ngữ chắp dính (agglutinative) và đa tổng hợp (polysynthetic), điều này có thể cải thiện ngoạn mục hiệu quả tách từ và chất lượng dịch thuật. Phương pháp này liên kết trực tiếp với các công cụ dựa trên luật được thảo luận trong phần tiếp theo.

---

## Phần 5: Bộ chuyển đổi trạng thái hữu hạn và các hệ thống dựa trên luật

### Vì sao các quy tắc ngữ pháp vẫn quan trọng

Câu chuyện từ đầu đến nay dường như là sự áp đảo hoàn toàn của mạng nơ-ron: hệ thống thống kê bị thay thế bởi mạng nơ-ron, mạng nơ-ron bị thay thế bởi Transformer, Transformer được mở rộng thành LLM. Nhưng có một truyền thống song hành trong ngôn ngữ học tính toán chưa bao giờ biến mất — và đối với một số ngôn ngữ nhất định, nó vẫn đóng vai trò không thể thay thế.

**Các hệ thống dựa trên luật (Rule-based systems)** mã hóa tri thức ngôn ngữ học tường minh: các quy tắc hình thái học, từ điển, các mẫu chuyển đổi cú pháp. Chúng không học từ dữ liệu; chúng được xây dựng bởi các nhà ngôn ngữ học am hiểu sâu sắc về các ngôn ngữ liên quan. Đối với các ngôn ngữ giàu tài nguyên, cách tiếp cận này từ lâu đã bị các phương pháp dựa trên dữ liệu vượt qua. Nhưng đối với các ngôn ngữ có hình thái phức tạp và dữ liệu tối thiểu, các hệ thống dựa trên luật thường cung cấp phương pháp phân tích đáng tin cậy duy nhất hiện có.

### Bộ chuyển đổi trạng thái hữu hạn (FST): Nhập môn

Một **Bộ chuyển đổi trạng thái hữu hạn (FST - Finite-State Transducer)** là một thiết bị tính toán ánh xạ giữa hai cấp độ biểu diễn — điển hình là giữa dạng bề mặt (những gì bạn thấy trong văn bản) và phân tích bên dưới (ý nghĩa ngôn ngữ học của nó). Hãy hình dung nó như một cỗ máy gồm các trạng thái và các bước chuyển dịch: nó đọc các ký hiệu đầu vào, chuyển đổi giữa các trạng thái và tạo ra các ký hiệu đầu ra.

Xét một ví dụ cụ thể với từ tiếng Plains Cree *nikî-nipâw*. Một bộ phân tích hình thái học dựa trên FST có thể nhận dạng bề mặt này và xuất ra:

> nipâw + Động từ + AI + Thức độc lập + Quá khứ + Ngôi thứ nhất số ít

Kết quả này cho bạn biết từ đó là động từ *nipâw* ("ngủ") ở thể độc lập (independent order), thì quá khứ, ngôi thứ nhất số ít — "Tôi đã ngủ." Bộ chuyển đổi mã hóa các quy tắc của hình thái học tiếng Cree: tiền tố nào chỉ ngôi vị, tiền tố nào đánh dấu thì, dạng động từ nào đi với mẫu biến cách nào. Điều cốt yếu là cơ chế này hoạt động **hai chiều**: khi được cung cấp một phân tích ngữ pháp, FST có thể tạo ra dạng bề mặt chính xác.

Cơ sở hạ tầng kỹ thuật để xây dựng FST bao gồm:

- **HFST** (Helsinki Finite-State Transducer Technology): Một bộ công cụ mã nguồn mở được duy trì tại Đại học Helsinki, cung cấp khung tính toán để xây dựng và thực thi các bộ chuyển đổi. HFST triển khai các hình thức chuẩn hóa vốn được Xerox phát triển ban đầu (lexc, twolc, xfst) và tương thích với **foma**, một bộ công cụ FST mã nguồn mở khác.

- **lexc**: Một chuẩn hình thức để chỉ định **từ vựng (lexicon)** — danh mục các hình vị (gốc từ, tiền tố, hậu tố) và các mẫu cấu tạo từ kết hợp chúng lại với nhau.

- **twolc**: Một chuẩn hình thức để chỉ định **các quy tắc hình âm học (morphophonological rules)** — các biến đổi âm thanh xảy ra khi các hình vị kết hợp với nhau (ví dụ: sự hài hòa nguyên âm, biến đổi phụ âm).

### GiellaLT: Cơ sở hạ tầng vùng Bắc Cực

**GiellaLT** (bắt nguồn từ từ *giella* trong tiếng Bắc Sámi, nghĩa là "ngôn ngữ") là một cơ sở hạ tầng công nghệ ngôn ngữ đặt tại **UiT — The Arctic University of Norway** ở Tromsø. Đây là nỗ lực quy mô nhất trên thế giới nhằm xây dựng các công cụ dựa trên FST cho các ngôn ngữ bản địa và ngôn ngữ thiểu số.

Ban đầu được biết đến với tên gọi **Giellatekno** (nghiên cứu) và **Divvun** (công cụ ngôn ngữ), dự án — do các nhà ngôn ngữ học **Trond Trosterud** và **Sjur Nørstebø Moshagen** dẫn dắt — đã phát triển các bộ phân tích hình thái học, công cụ kiểm tra chính tả và các công cụ ngôn ngữ khác cho hơn **100 ngôn ngữ**, tập trung vào các ngôn ngữ Sámi (Bắc Sámi, Lule Sámi, Nam Sámi, v.v.), các ngôn ngữ Ural và các ngôn ngữ Bắc Cực cùng ngôn ngữ bản địa khác.

GiellaLT sử dụng HFST làm nền tảng tính toán và đã phát triển một cơ sở hạ tầng dùng chung rất tinh vi: hệ thống bản dựng chung, các khung kiểm thử chia sẻ và các thành phần ngôn ngữ học có thể tái sử dụng. Toàn bộ mã nguồn đều mở, được lưu trữ trên [GitHub](https://github.com/giellalt), với hàng trăm kho lưu trữ bao gồm cơ sở hạ tầng cốt lõi và các kho riêng cho từng ngôn ngữ (ví dụ: `lang-sme` cho tiếng Bắc Sámi, `lang-crk` cho tiếng Plains Cree). Tài liệu của dự án có tại [giellalt.github.io](https://giellalt.github.io/). Cổng thông tin hướng tới công chúng, **[Borealium.org](https://borealium.org)** — được tài trợ bởi Hội đồng Bộ trưởng Bắc Âu — cung cấp quyền truy cập miễn phí vào các công cụ hiệu đính, bàn phím, từ điển, công cụ học ngôn ngữ (Oahpa) và tổng hợp giọng nói cho các ngôn ngữ Sámi, Kven, Faroe, Greenland và nhiều ngôn ngữ khác.

Mối quan hệ giữa GiellaLT và chính sách ngôn ngữ quốc gia là một điểm rất đáng chú ý. Phần lớn kinh phí của dự án đến từ **Nghị viện Sámi Na Uy** và các chương trình ngôn ngữ của chính phủ các nước Bắc Âu, phản ánh một cam kết chính trị đối với công nghệ ngôn ngữ bản địa hiếm thấy về cả quy mô lẫn thời gian duy trì.

### Apertium: Dịch máy dựa trên luật mã nguồn mở

**[Apertium](https://www.apertium.org/)** là một nền tảng dịch máy dựa trên luật mã nguồn mở, ban đầu được phát triển tại Universitat d'Alacant (Tây Ban Nha) với sự tài trợ của chính phủ Tây Ban Nha và Catalunya. Dự án bắt đầu vào năm 2004 với trọng tâm là các cặp ngôn ngữ có quan hệ họ hàng (Tây Ban Nha–Catalunya, Tây Ban Nha–Bồ Đào Nha), nơi các quy tắc chuyển giao nông (shallow transfer rules) — dịch từng từ một kết hợp điều chỉnh hình thái — mang lại kết quả tốt đáng kinh ngạc. Những người đóng góp chủ chốt bao gồm **Francis M. Tyers**, người giữ vai trò trung tâm trong cả quá trình phát triển của Apertium lẫn việc áp dụng nó cho các ngôn ngữ nghèo tài nguyên.

Kiến trúc của Apertium là một **quy trình đường ống (pipeline)** kinh điển:

1. **Phân tích hình thái học** (dựa trên FST): Xác định từ nguyên (lemma) và các đặc trưng hình thái của từng từ
2. **Khử nhập nhằng từ loại (POS disambiguation)**: Chọn phân tích chính xác khi các từ có tính đa nghĩa/nhập nhằng
3. **Chuyển giao từ vựng**: Ánh xạ các từ nguyên của ngôn ngữ nguồn sang các từ nguyên của ngôn ngữ đích
4. **Chuyển giao cấu trúc**: Áp dụng các quy tắc để xử lý việc thay đổi trật tự từ, sự hòa hợp ngữ pháp và các khác biệt cú pháp khác
5. **Sinh hình thái học** (dựa trên FST): Tạo ra dạng bề mặt được chia biến cách chính xác của ngôn ngữ đích

Tính đến năm 2025, Apertium hỗ trợ hàng trăm cặp ngôn ngữ ở các mức chất lượng khác nhau, tất cả đều được lưu trữ trên [GitHub](https://github.com/apertium). Nó vẫn tiếp tục được phát triển tích cực bởi một cộng đồng quốc tế và đặc biệt hữu ích cho các cặp ngôn ngữ có quan hệ họ hàng gần, nơi cách tiếp cận dựa trên luật của nó có thể đạt được chất lượng hợp lý mà không cần dữ liệu huấn luyện.

### Các phương pháp lai: FST + Nơ-ron

Chân trời hứa hẹn nhất cho MT tài nguyên thấp có thể là **các kiến trúc lai** kết hợp phân tích hình thái học dựa trên luật với dịch thuật nơ-ron. Ý tưởng rất trực diện: sử dụng FST để phân đoạn các từ thành các hình vị (giải quyết bài toán tách từ đã mô tả trong Phần 4), sau đó đưa văn bản đã phân đoạn vào một hệ thống MT nơ-ron.

Đối với một ngôn ngữ đa tổng hợp như Plains Cree, điều này có nghĩa là mô hình nơ-ron sẽ nhận được một chuỗi các đơn vị có nghĩa thay vì các mảnh byte tùy tiện. **Phòng thí nghiệm Công nghệ Ngôn ngữ Alberta (ALT Lab)** tại Đại học Alberta, do **Antti Arppe** dẫn dắt, đã xây dựng các bộ phân tích hình thái học dựa trên FST toàn diện và các công cụ từ điển phục vụ cộng đồng cho tiếng Plains Cree bằng cơ sở hạ tầng GiellaLT. Công trình công bố gần đây nhất của họ (Arppe 2025, AmericasNLP) chứng minh việc ánh xạ dựa trên FST giữa các dạng từ được chia biến cách của tiếng Cree và các cụm từ tiếng Anh — về bản chất là "dịch thuật có giới hạn" thông qua các phương pháp trạng thái hữu hạn, hoạt động ở cấp độ từ/cụm từ thay vì câu hoàn chỉnh. Đáng chú ý, ALT Lab **chưa** công bố một hệ thống MT lai FST+nơ-ron nào; công trình của họ đặt nền tảng trên ngôn ngữ học, dựa trên luật, và ưu tiên độ tin cậy cùng tiện ích cộng đồng hơn là các phương pháp tiếp cận nơ-ron thực nghiệm. Trong khi đó, Nguyen, Hammerly, và Silfverberg (2025, AmericasNLP) đã trình diễn một quy trình lai LLM+FST cho các động từ tiếng Ojibwe tại UBC, đạt được kết quả ấn tượng (chrF 0.82) — công trình tương đồng được công bố gần nhất với phương pháp tiếp cận lai cho một ngôn ngữ thuộc ngữ hệ Algonquian.

Chiến lược lai này đại diện cho sự hội tụ của hai truyền thống đã song hành trong suốt lịch sử MT: tri thức tường minh của nhà ngôn ngữ học và việc học thống kê của kỹ sư máy tính. Đối với những ngôn ngữ cần MT nhất, không một truyền thống đơn lẻ nào là đủ.

---

## Phần 6: Đo lường chất lượng — Bài toán đánh giá

### Làm thế nào để biết một bản dịch có tốt hay không?

Câu hỏi này nghe có vẻ đơn giản. Nhưng thực tế, nó là một trong những bài toán hóc búa chưa có lời giải trọn vẹn trong ngành, và cách bạn trả lời nó sẽ quyết định hệ thống nào có vẻ như "hoạt động hiệu quả" và hệ thống nào không.

### BLEU: Tiêu chuẩn chưa hoàn hảo

Trong hơn hai thập kỷ, thước đo tự động thống trị trong MT là **BLEU** (Bilingual Evaluation Understudy), được Papineni et al. tại IBM giới thiệu vào năm 2002. BLEU đo lường mức độ trùng khớp giữa các chuỗi từ (n-grams) của bản dịch máy với một hoặc nhiều bản dịch tham chiếu do con người thực hiện. Nó bao gồm một hình phạt độ ngắn (brevity penalty) để ngăn các hệ thống lách điểm bằng cách đưa ra các đầu ra quá ngắn.

BLEU đã trở thành "đồng tiền chung" của lĩnh vực này vì nó nhanh, rẻ, độc lập với ngôn ngữ và có thể tái lập. Hầu như mọi bài báo MT được xuất bản từ năm 2002 đến 2020 đều báo cáo điểm BLEU. Các nhiệm vụ chung của WMT đã sử dụng nó làm thước đo chính trong nhiều năm.

Nhưng BLEU lại có những khiếm khuyết sâu sắc ngày càng lộ rõ:

- **Không có sự hiểu biết về ngữ nghĩa**: BLEU thuần túy là việc so khớp bề mặt. Nếu một bản dịch sử dụng một từ đồng nghĩa hoàn hảo nhưng tình cờ không xuất hiện trong bản tham chiếu, BLEU sẽ phạt điểm. Câu "the cat sat on the mat" sẽ nhận điểm 0 khi so với câu tham chiếu "the feline rested on the rug".
- **Khả năng phân biệt kém ở cấp độ câu**: BLEU được thiết kế như một thước đo ở cấp độ kho ngữ liệu (corpus-level). Ở cấp độ câu, nó rất thiếu tin cậy và nhiều nhiễu.
- **Mù quáng trước hình thái học**: Đối với các ngôn ngữ chắp dính (Thổ Nhĩ Kỳ, Phần Lan, Swahili), nơi một từ nguyên đơn lẻ có thể có hàng chục dạng chia biến cách, việc so khớp nghiêm ngặt ở cấp độ từ sẽ thất bại thảm hại. Một động từ được chia biến cách đúng nhưng chỉ khác một hậu tố so với bản tham chiếu sẽ bị tính điểm 0.
- **Tương quan yếu với đánh giá của con người**: Các phân tích tổng hợp, đáng chú ý là Reiter (2018), đã chỉ ra rằng mức độ tương quan của BLEU với đánh giá chất lượng của con người thường rất yếu, đặc biệt đối với các hệ thống chất lượng cao và các ngôn ngữ có khoảng cách xa với tiếng Anh.

### chrF và chrF++

**chrF** (character F-score), do Maja Popović giới thiệu vào năm 2015, giải quyết sự mù quáng hình thái học của BLEU bằng cách đo lường độ trùng khớp ở **cấp độ ký tự** thay vì cấp độ từ. Điều này ghi nhận điểm thành phần cho các thân từ và gốc từ được chia sẻ ngay cả khi các biến cách khác nhau — một yếu tố sống còn cho các ngôn ngữ giàu hình thái. **chrF++** (Popović, 2017) bổ sung lại n-gram cấp độ từ, đạt được độ tương quan tốt hơn với đánh giá của con người so với các thước đo chỉ dựa trên ký tự hoặc chỉ dựa trên từ. Cả hai đều được triển khai trong **sacreBLEU**, bộ công cụ đánh giá tiêu chuẩn, và đã trở thành các thước đo phụ tiêu chuẩn trong các nhiệm vụ chung của WMT.

### COMET và xCOMET: Đánh giá bằng mạng nơ-ron

Bước tiến quan trọng nhất trong việc đánh giá MT là sự chuyển hướng sang **các thước đo nơ-ron** — các mô hình đánh giá bản thân chúng cũng là các Transformer, được huấn luyện để dự đoán các phán đoán chất lượng của con người.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), do Ricardo Rei và các đồng nghiệp tại **Unbabel** (2020) phát triển, sử dụng một bộ mã hóa xuyên ngôn ngữ (XLM-RoBERTa) để nhúng câu nguồn, bản dịch và câu tham chiếu, sau đó dự đoán một điểm chất lượng. Khác với BLEU, COMET hoạt động trong không gian ngữ nghĩa — nó nhận biết các cách diễn đạt tương đương (paraphrase), nắm bắt việc bảo toàn ý nghĩa, và liên tục thể hiện mối tương quan cao hơn nhiều với đánh giá của con người so với các thước đo cấp độ bề mặt. COMET đã giành chiến thắng hoặc đứng đầu trong các nhiệm vụ chung về Thước đo của WMT từ năm 2020 trở đi.

**xCOMET** (Guerreiro et al., 2024, công bố trên TACL) còn tiến xa hơn: bên cạnh điểm chất lượng, nó cung cấp khả năng **phát hiện đoạn lỗi chi tiết (fine-grained error span detection)** — xác định các lỗi cụ thể trong bản dịch, phân loại chúng theo loại lỗi (độ chính xác, độ trôi chảy, thuật ngữ) và mức độ nghiêm trọng (nhẹ, nặng, nghiêm trọng). Điều này giúp thu hẹp khoảng cách giữa việc chấm điểm tự động và phân tích ngôn ngữ học của con người.

### AfriCOMET: Đánh giá cho các ngôn ngữ chưa được phục vụ đầy đủ

COMET tiêu chuẩn, được huấn luyện chủ yếu trên dữ liệu đánh giá của con người bằng các ngôn ngữ châu Âu, có thể không khái quát hóa tốt cho các ngôn ngữ khác biệt về loại hình. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) giải quyết vấn đề này bằng cách tinh chỉnh trên dữ liệu đánh giá của con người từ **13 ngôn ngữ châu Phi** và sử dụng **AfroXLM-R** — một bộ mã hóa đa ngôn ngữ được huấn luyện chuyên biệt để biểu diễn tốt hơn các ngôn ngữ châu Phi. Công trình này, do cộng đồng Masakhane thực hiện (xem Phần 7), chứng minh rằng bản thân các thước đo đánh giá cũng phải được điều chỉnh để thích ứng với sự đa dạng ngôn ngữ.

### Đánh giá của con người: MQM và Đánh giá trực tiếp (DA)

Các thước đo tự động chỉ là những đại lượng xấp xỉ. Chân lý chuẩn xác (ground truth) vẫn là **đánh giá của con người**, bao gồm hai hình thức chính:

**Đánh giá trực tiếp (Direct Assessment - DA)** yêu cầu người chấm điểm cho điểm các bản dịch trên thang từ 0–100. Phương pháp này tương đối nhanh và rẻ (có thể sử dụng người chấm từ cộng đồng mạng - crowd-sourced) và là phương pháp đánh giá con người chính tại WMT từ năm 2017 đến 2020. Điểm yếu của nó: khi chất lượng MT ngày càng nâng cao, những người chấm không chuyên không còn có thể phân biệt được giữa các hệ thống tạo ra đầu ra gần như dịch giả chuyên nghiệp. DA trở nên thiếu tin cậy ở phân khúc chất lượng cao nhất.

**Bộ tiêu chuẩn chất lượng đa chiều (Multidimensional Quality Metrics - MQM)** đã thay thế DA trở thành phương pháp đánh giá con người chính của WMT từ năm 2021 trở đi. MQM sử dụng **các dịch giả chuyên nghiệp**, những người sẽ đánh dấu các đoạn lỗi cụ thể trong bản dịch, phân loại lỗi theo loại (dịch sai, bỏ sót, ngữ pháp, thuật ngữ) và mức độ nghiêm trọng (nhẹ = 1 điểm, nặng = 5 điểm, nghiêm trọng = 25 điểm). Cách tiếp cận này vừa tạo ra điểm chất lượng vừa mang lại thông tin chẩn đoán hữu ích — bạn không chỉ biết một bản dịch *tệ đến mức nào*, mà còn biết *chính xác nó sai ở đâu*.

| Đặc điểm | DA | MQM |
|---|---|---|
| Người chấm | Cộng đồng mạng (Crowd-workers) | Dịch giả chuyên nghiệp |
| Phương pháp | Điểm tổng thể 0–100 | Gán nhãn đoạn lỗi cụ thể |
| Chẩn đoán | Không có | Phân loại lỗi chi tiết |
| Chi phí | Thấp hơn | Cao hơn |
| Độ tin cậy | Kém hơn đối với MT chất lượng cao | Chuẩn mực vàng (Gold standard) |
| Sử dụng chính tại WMT | 2017–2020 | 2021–nay |

### Khủng hoảng đánh giá đối với các ngôn ngữ tài nguyên thấp

Đối với các ngôn ngữ tài nguyên thấp, bài toán đánh giá càng trở nên trầm trọng do nhiều yếu tố:

- **Không có người đánh giá đủ tiêu chuẩn**: MQM đòi hỏi các dịch giả chuyên nghiệp song ngữ. Đối với nhiều ngôn ngữ tài nguyên thấp, việc tìm kiếm những người đánh giá như vậy là cực kỳ khó khăn.
- **Không có bản dịch tham chiếu**: Cả COMET và BLEU đều cần các bản dịch tham chiếu để so sánh. Đối với nhiều lĩnh vực và ngôn ngữ, các bản dịch này không hề tồn tại.
- **Định kiến của thước đo**: Cả thước đo bề mặt lẫn thước đo nơ-ron đều được phát triển và xác thực trên dữ liệu các ngôn ngữ châu Âu. Hành vi của chúng trên các ngôn ngữ khác biệt về loại hình vẫn là điều chưa chắc chắn.
- **Nguy cơ ảo giác (Hallucination risk)**: Trong các bối cảnh tài nguyên thấp, các mô hình MT có thể tạo ra đầu ra rất trôi chảy nhưng hoàn toàn không liên quan đến câu nguồn — một hiện tượng gọi là **ảo giác (hallucination)**. Các thước đo bề mặt có thể vẫn cho điểm khác không đối với đầu ra ảo giác này nếu nó vô tình trùng lặp một vài n-gram với câu tham chiếu.

Việc xây dựng **các tập đánh giá tùy chỉnh** — ngay cả những tập nhỏ chỉ gồm 200–500 cặp câu được chọn lọc cẩn thận trong lĩnh vực mục tiêu — là điều thiết yếu cho bất kỳ nỗ lực MT tài nguyên thấp nghiêm túc nào. Việc chỉ dựa hoàn toàn vào điểm FLORES-200 hoặc BLEU mà không có sự đánh giá theo từng lĩnh vực cụ thể là công thức dẫn đến sự tự tin ảo.

---

## Phần 7: Bức tranh toàn cảnh các tổ chức

### Các thế lực doanh nghiệp

Lĩnh vực MT được định hình bởi một số ít các tập đoàn lớn, mỗi bên đều có chiến lược riêng biệt:

**Google Translate** vẫn là hệ thống MT được sử dụng rộng rãi nhất trên toàn cầu; Cloud Translation API của hãng liệt kê **194 ngôn ngữ** ([danh sách công bố của Google](https://docs.cloud.google.com/translate/docs/languages) — sản phẩm dành cho người dùng cá nhân quảng cáo con số nhiều hơn, nhưng Google không công bố danh sách tĩnh chính thức cho phiên bản này). Sáng kiến **1000 Languages Initiative** của Google (công bố năm 2022) hướng tới việc xây dựng các mô hình AI bao quát 1.000 ngôn ngữ được nói nhiều nhất thế giới. Cloud Translation API cung cấp hai gói: Cơ bản (Basic - NMT kế thừa) và Nâng cao (Advanced - các mô hình mới nhất). Google ngày càng tích hợp sâu rộng các khả năng của LLM Gemini vào Translate, với các tính năng dịch thuật thích ứng ngữ cảnh, tự nhiên theo thành ngữ xuất hiện vào năm 2025.

**Meta** tự định vị mình là động lực chính thúc đẩy MT đa ngôn ngữ mã nguồn mở thông qua NLLB-200, M2M-100, FLORES-200, và bộ công cụ Seamless. Triết lý phát hành mô hình mở của Meta đã mang lại tác động mang tính chuyển đổi cho nghiên cứu học thuật, cung cấp các đường cơ sở và công cụ mà nếu không có thì sẽ đòi hỏi nguồn tài nguyên tính toán ngoài tầm với.

**DeepL** chiếm lĩnh một phân khúc tập trung vào chất lượng, hỗ trợ khoảng **33 ngôn ngữ** — tất cả đều tương đối giàu tài nguyên — với danh tiếng về văn phong tự nhiên, đậm chất bản ngữ được các dịch giả chuyên nghiệp ưa chuộng. Mô hình kinh doanh của DeepL (freemium cho người dùng cá nhân + API trả phí cho doanh nghiệp) cùng tham số điều chỉnh mức độ trang trọng (kiểm soát văn phong trang trọng so với thân mật) phản ánh sự tập trung vào quy trình dịch thuật chuyên nghiệp thay vì mở rộng độ bao phủ ngôn ngữ.

**Microsoft Translator** (thuộc Azure AI Services) cung cấp khả năng dịch trên **135 ngôn ngữ** với sự tích hợp doanh nghiệp thông qua Microsoft 365 và Teams. Tính năng Custom Translator của dịch vụ này cho phép các tổ chức tinh chỉnh mô hình trên dữ liệu chuyên ngành cụ thể.

**Unbabel** kết hợp MT với việc con người biên tập hậu kỳ theo quy trình "human-in-the-loop" (con người tham gia vào vòng lặp), song song với các đóng góp nghiên cứu của mình (COMET, xCOMET, Tower). Công ty đại diện cho ứng dụng thương mại của mô hình "MT + con người rà soát".

**LibreTranslate**, được xây dựng trên công cụ **Argos Translate**, cung cấp một giải pháp MT mã nguồn mở hoàn toàn, có thể tự lưu trữ (self-hostable) và không phụ thuộc vào bất kỳ tập đoàn nào — điều này rất quan trọng đối với các tổ chức có yêu cầu về chủ quyền dữ liệu.

### Các cộng đồng cơ sở

Một số công trình quan trọng nhất trong MT — đặc biệt đối với các ngôn ngữ chưa được phục vụ đầy đủ — lại diễn ra tại các tổ chức nghiên cứu do cộng đồng dẫn dắt:

**[Masakhane](https://www.masakhane.io/)** (bắt nguồn từ tiếng isiZulu có nghĩa là "chúng ta cùng nhau xây dựng") là một cộng đồng nghiên cứu cơ sở tập trung vào NLP cho các ngôn ngữ châu Phi, được thành lập vào năm 2019. Với hàng trăm thành viên trên khắp lục địa và cộng đồng hải ngoại, Masakhane đã tạo ra các tập dữ liệu nền tảng (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), các thước đo đánh giá (AfriCOMET), và các nghiên cứu thúc đẩy đáng kể NLP cho ngôn ngữ châu Phi. Những nhân vật chủ chốt bao gồm **David Ifeoluwa Adelani** (Mila / UCL). Mã nguồn và dữ liệu được lưu trữ trên [GitHub](https://github.com/masakhane-io); kênh liên lạc chính là không gian làm việc Slack của họ (tham gia qua masakhane.io), với các buổi họp cộng đồng hàng tuần. Masakhane hoạt động dựa trên các nguyên tắc về quyền sở hữu của người châu Phi đối với công nghệ ngôn ngữ châu Phi — một sự phản kháng có chủ đích đối với các mô hình nghiên cứu mang tính bóc lột, nơi các tổ chức bên ngoài thu thập dữ liệu từ các cộng đồng ngôn ngữ mà không có sự hợp tác thực chất. Họ công khai phản đối kiểu "nghiên cứu nhảy dù" (parachute research), nơi những người bên ngoài đến trích xuất dữ liệu ngôn ngữ mà không thiết lập mối quan hệ đối tác có ý nghĩa với cộng đồng.

**AmericasNLP** là một chuỗi hội thảo (đồng địa điểm với NAACL) tập trung vào NLP cho các ngôn ngữ bản địa của châu Mỹ. Do các nhà nghiên cứu bao gồm **Manuel Mager**, **Arturo Oncevay**, và **Luis Chiruzzo** tổ chức, chuỗi hội thảo triển khai các nhiệm vụ chung về MT cho các ngôn ngữ như Quechua, Guaraní, Aymara, Nahuatl, Rarámuri, và các ngôn ngữ khác. Hội thảo làm nổi bật những thách thức nghiên cứu đặc thù của châu Mỹ — hình thái đa tổng hợp, hệ thống thanh điệu, sự khan hiếm dữ liệu cùng cực, và các khía cạnh chính trị của công nghệ ngôn ngữ đối với các dân tộc từng bị thực dân hóa.

**[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) tại Đại học Alberta, do **Antti Arppe** dẫn dắt, tập trung chuyên sâu vào các công cụ tính toán cho tiếng Plains Cree và các ngôn ngữ bản địa khác ở miền tây Canada. ALT Lab xây dựng các bộ phân tích hình thái học dựa trên FST và các công cụ ngôn ngữ phục vụ cộng đồng (sử dụng cơ sở hạ tầng GiellaLT), đồng thời hợp tác chặt chẽ với các cộng đồng nói tiếng Cree — một hình mẫu tiêu biểu cho việc phát triển công nghệ ngôn ngữ lấy cộng đồng làm trung tâm. Dự án hướng tới công chúng của họ mang tên **[21st Century Tools for Indigenous Languages](https://21c.tools)** cung cấp các từ điển trực tuyến và công cụ hình thái học được xây dựng trên cơ sở hạ tầng này.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (National Research Council Canada), do **Patrick Littell** dẫn dắt, duy trì một chương trình tích cực hỗ trợ hơn 25 ngôn ngữ bản địa trên khắp Canada, bao gồm nhiều phương ngữ tiếng Cree, Algonquin, Innu, và Michif. NRC ILT đã công bố nghiên cứu MT cho cặp Anh–Inuktitut (sử dụng kho ngữ liệu Nunavut Hansard) và phát triển các công cụ mã nguồn mở bao gồm **kiyânaw Transcribe** (phiên âm tiếng Cree và Ojibwe), các bộ phân tích hình thái học, và **ReadAlong Studio** (căn chỉnh âm thanh – văn bản). Toàn bộ mã nguồn đều mở và NRC công khai tuyên bố không giữ bản quyền đối với dữ liệu ngôn ngữ của cộng đồng.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) là một sáng kiến LLM đa ngôn ngữ khoa học mở với hơn 3.000 người đóng góp từ hơn 119 quốc gia. Dù không phải là một hệ thống MT chuyên dụng, các mô hình Aya (Aya-101 bao quát 101 ngôn ngữ, Aya 23 bao quát 23 ngôn ngữ có tầm ảnh hưởng lớn, Tiny Aya bao quát 70 ngôn ngữ ở quy mô 3,35 tỷ tham số) hoạt động rất hiệu quả cho các tác vụ dịch thuật. **Aya Collection** — gồm 513 triệu mẫu huấn luyện dạng câu lệnh — là tập dữ liệu câu lệnh đa ngôn ngữ mở lớn nhất hiện nay. Mô hình quản trị cộng đồng của dự án này rất đáng để học hỏi.

**[GhanaNLP / Khaya](https://ghananlp.org)** là một sáng kiến NLP do cộng đồng thúc đẩy đã tạo ra nền tảng dịch thuật **Khaya** — một trong số ít các hệ thống MT do cộng đồng quản trị thực sự được triển khai phục vụ đời sống hàng ngày. Khaya cung cấp dịch máy nơ-ron, ASR và TTS cho khoảng 12 ngôn ngữ Ghana (Twi, Ewe, Ga, Fante, Kusaal, và các ngôn ngữ khác) thông qua web, ứng dụng di động và API cho nhà phát triển. Cách tiếp cận của họ — xây dựng hơn 40.000 cặp câu song ngữ thông qua sự hợp tác với các nhà ngôn ngữ học và phản hồi từ cộng đồng — chứng minh rằng MT do cộng đồng quản trị hoàn toàn có thể đi vào vận hành thực tế chứ không chỉ dừng lại ở mức nguyện vọng.

### Tài trợ và Chính sách

Nghiên cứu MT cho các ngôn ngữ tài nguyên thấp phụ thuộc vào các nguồn tài trợ rất khác biệt so với nguồn vốn đầu tư mạo hiểm và doanh thu quảng cáo vốn nuôi sống MT thương mại:

- **Lacuna Fund**: Một quỹ dữ liệu hợp tác được hỗ trợ bởi Rockefeller Foundation, Google.org, IDRC của Canada và GIZ của Đức. Lacuna tài trợ chuyên biệt cho việc tạo ra **các tập dữ liệu được gán nhãn** cho các ngôn ngữ ít được đại diện — nhằm lấp đầy khoảng trống dữ liệu vốn là nguyên nhân gốc rễ gây ra chênh lệch chất lượng MT.

- **AI4D** (Artificial Intelligence for Development): Một chương trình tài trợ các học bổng nghiên cứu AI cho công nghệ ngôn ngữ châu Phi, được vận hành thông qua IDRC và Cơ quan Hợp tác Phát triển Quốc tế Thụy Điển (Sida).

- **UNESCO International Decade of Indigenous Languages (2022–2032)**: Một khuôn khổ chính trị đã nâng cao vị thế của công nghệ ngôn ngữ bản địa trên toàn cầu, mặc dù nguồn tài trợ nghiên cứu cụ thể vẫn còn ở mức khiêm tốn.

- **Ngân hàng Phát triển Liên Mỹ (IDB)**: Đã tài trợ cho dự án **GuaranIA** phục vụ MT cặp Guaraní–Tây Ban Nha tại Paraguay, một ví dụ tiêu biểu về việc tài chính phát triển hỗ trợ cho công nghệ ngôn ngữ.

- **Các hội đồng nghiên cứu quốc gia**: Phần lớn công việc MT tài nguyên thấp được tài trợ thông qua các kênh học thuật tiêu chuẩn (NSF, NSERC, các chương trình EU Horizon), thường nằm trong khuôn khổ của các khoản tài trợ lớn hơn về AI hoặc ngôn ngữ học.

---

## Phần 8: Những chân trời rộng mở

### Những bài toán vẫn chưa có lời giải

Lĩnh vực MT vào năm 2026 đồng thời trở nên mạnh mẽ hơn và cũng thành thực hơn về những hạn chế của mình so với bất kỳ giai đoạn nào trước đây. Một số bài toán biên giới đang định hình bức tranh nghiên cứu hiện tại:

**Dịch thuật cấp độ tài liệu (Document-level translation)** phần lớn vẫn chưa được giải quyết triệt để. Hầu hết các hệ thống MT — bao gồm nhiều LLM — đều dịch từng câu một, làm mất đi tính mạch lạc của diễn ngôn, khả năng giải quyết đại từ xuyên ranh giới câu và tính nhất quán về văn phong. Một dịch giả con người sẽ đọc toàn bộ tài liệu trước khi dịch; hầu hết các hệ thống MT lại xử lý các câu một cách tách biệt. Nghiên cứu về MT cấp độ tài liệu đang diễn ra tích cực nhưng vẫn chưa tạo ra được các hệ thống duy trì độ mạch lạc một cách đáng tin cậy trên các văn bản dài.

**Diễn ngôn và ngữ dụng học (Discourse and pragmatics)** — khoảng cách giữa nghĩa đen và chủ đích giao tiếp — tiếp tục là thách thức lớn đối với MT. Sự mỉa mai, nói giảm nói tránh, điển tích văn hóa và sự nhạy cảm về văn phong (trang trọng so với thân mật, kính cẩn so với suồng sã) chỉ được các LLM tốt nhất nắm bắt một phần nhưng không nhất quán. Một dịch giả làm việc giữa tiếng Nhật và tiếng Anh phải điều hướng một hệ thống kính ngữ phức tạp; các hệ thống MT hiện tại xử lý điều này tốt nhất cũng chỉ ở mức chập chờn.

**Dịch thuật đa phương thức (Multimodal translation)** — dịch trong ngữ cảnh đi kèm hình ảnh, video hoặc âm thanh — là một lĩnh vực nghiên cứu mới nổi. Một món ăn trong thực đơn được mô tả là "flying fish roe" (trứng cá chuồn) sẽ rất dễ hiểu nếu có hình ảnh kèm theo; nếu không có, MT có thể tạo ra một cách dịch kỳ quặc. Bộ công cụ Seamless và các LLM đa phương thức (Gemini, GPT-4o) đã bắt đầu giải quyết vấn đề này, nhưng MT đa phương thức mạnh mẽ và ổn định vẫn còn là một chân trời mở.

**Dịch giọng nói sang giọng nói thời gian thực (Real-time speech-to-speech translation)** với độ trễ tự nhiên (dưới 3 giây), bảo toàn đặc trưng giọng nói của người nói và truyền tải được sắc thái cảm xúc đang tiến gần đến mức sẵn sàng cho môi trường sản phẩm đối với các cặp tài nguyên cao. Google, Meta và một số công ty khởi nghiệp đã trình diễn các hệ thống nguyên mẫu vào năm 2025. Đối với các ngôn ngữ tài nguyên thấp, dịch giọng nói thời gian thực vẫn còn là một mục tiêu xa vời.

**"Chặng cuối" cho các ngôn ngữ tài nguyên thấp** có lẽ là bài toán chưa có lời giải quan trọng nhất của lĩnh vực này. Khoảng cách giữa điểm benchmark FLORES-200 và tính hữu dụng thực tế đối với một cộng đồng ngôn ngữ là rất lớn. Một mô hình đạt 15 điểm BLEU trên chiều dịch Plains Cree–Anh hoàn toàn không có ích cho bất kỳ mục đích thực tế nào. Thu hẹp khoảng cách này đòi hỏi không chỉ các mô hình tốt hơn mà còn cần dữ liệu tốt hơn, phương pháp đánh giá tốt hơn, thuật toán tách từ tốt hơn, và — quan trọng nhất — sự hợp tác chân thành với các cộng đồng ngôn ngữ thay vì chỉ trích xuất tài nguyên ngôn ngữ phục vụ cho các bài báo học thuật.

**Biên tập hậu kỳ và sự cộng tác giữa con người và AI (Post-editing and human-AI collaboration)** đang trở thành mô hình chiếm ưu thế cho dịch thuật chuyên nghiệp. Thay vì thay thế dịch giả con người, MT ngày càng được định vị như một công cụ tạo bản thảo đầu tiên để các dịch giả tinh chỉnh lại. Hiểu được khoa học nhận thức của việc biên tập hậu kỳ, đo lường nỗ lực biên tập và thiết kế các giao diện hỗ trợ sự cộng tác giữa con người và AI là những lĩnh vực nghiên cứu tích cực có tác động thương mại trực tiếp.

### Các chiều kích chính trị

MT không trung lập về mặt chính trị. Việc lựa chọn hỗ trợ ngôn ngữ nào, thu thập dữ liệu nào, ai kiểm soát các mô hình và tiêu chuẩn chất lượng của ai được áp dụng đều là những quyết định mang lại hệ quả sâu sắc cho các cộng đồng ngôn ngữ.

Sự thống trị của tiếng Anh như một ngôn ngữ bắc cầu (pivot language) đã mã hóa một góc nhìn đặc thù rằng dịch thuật là thứ bắt buộc phải luân chuyển qua tiếng Anh. Việc sử dụng Kinh Thánh và các văn bản truyền giáo làm dữ liệu huấn luyện cho các ngôn ngữ bản địa đặt ra các câu hỏi về sự đồng thuận và tính phù hợp văn hóa. Sự tập trung năng lực MT vào một số ít công ty Thung lũng Silicon tạo ra các mối quan hệ phụ thuộc mà một số cộng đồng ngôn ngữ công khai phản đối.

**Chủ quyền dữ liệu (Data sovereignty)** là một mối quan tâm cốt lõi. Tại Canada, các nguyên tắc chủ quyền dữ liệu của các Dân tộc Bản địa (First Nations) khẳng định rằng các cộng đồng bản địa sở hữu dữ liệu của họ, kiểm soát cách thức dữ liệu được thu thập và sử dụng, có quyền truy cập và nắm giữ dữ liệu đó về mặt vật lý. Đối với MT, điều này có nghĩa là dữ liệu huấn luyện thu được từ các văn bản ngôn ngữ bản địa, các kho ngữ liệu đánh giá được xây dựng từ tri thức cộng đồng, và các mô hình dịch thuật được huấn luyện trên các tài nguyên do cộng đồng nắm giữ đều phải chịu sự quản trị của cộng đồng — chứ không phải sự quản trị của bất kỳ tổ chức nghiên cứu hay công ty công nghệ nào tạo ra mô hình đó.

Điều này dẫn đến những hệ quả kỹ thuật trực tiếp. Một hệ thống MT được xây dựng bằng dữ liệu cộng đồng không thể đơn giản là mở mã nguồn theo cách thông thường nếu cộng đồng chưa đồng thuận với điều đó. Các bộ benchmark đánh giá không thể được công bố nếu dữ liệu kiểm thử chứa các tài liệu nhạy cảm về mặt văn hóa. Một "mô hình do cộng đồng làm chủ" không phải là một điều mâu thuẫn — đó là một yêu cầu thiết kế bắt buộc. Bất kỳ nỗ lực nghiêm túc nào trong MT tài nguyên thấp cho các ngôn ngữ bản địa đều phải hướng tới chủ quyền dữ liệu theo mặc định — được thiết kế vì quyền sở hữu và kiểm soát của cộng đồng đối với dữ liệu ngôn ngữ, chứ không phải coi đó là điều nghĩ đến sau cùng.

Đây không đơn thuần là những ghi chú đạo đức bên lề — chúng định hình các ưu tiên nghiên cứu, quyết định tài trợ và các kiến trúc kỹ thuật. "Xây dựng MT tốt hơn" không thể tách rời khỏi các câu hỏi về việc ai là người hưởng lợi, ai là người quyết định và tri thức ngôn ngữ của ai được tôn trọng.

---

## Phụ lục A: Các bài báo chính

Dưới đây là danh sách tài liệu đọc theo trình tự thời gian gồm các bài báo đã định hình quỹ đạo phát triển của lĩnh vực này. Mỗi mục đi kèm một ghi chú ngắn gọn về lý do vì sao nó quan trọng.

| Năm | Bài báo | Tác giả | Ý nghĩa |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Thiết lập thước đo đánh giá MT thống trị trong hai thập kỷ |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Chứng minh khả năng dịch thuật của kiến trúc encoder-decoder nơ-ron |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Giới thiệu cơ chế chú ý (attention mechanism) |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Đưa MT nơ-ron lên quy mô môi trường sản xuất công nghiệp |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Giới thiệu việc tách từ BPE cho MT |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Giới thiệu phương pháp dịch ngược (backtranslation) để tăng cường dữ liệu |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Giới thiệu kiến trúc Transformer |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: học biểu diễn xuyên ngôn ngữ cho 100 ngôn ngữ |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: dịch many-to-many không cần tiếng Anh bắc cầu |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Thước đo đánh giá nơ-ron có độ tương quan cao với đánh giá con người |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | NLLB Team (Meta) | Mô hình MT 200 ngôn ngữ + bộ benchmark FLORES-200 |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | Tinh chỉnh LLM cho dịch thuật SOTA với dữ liệu nhỏ |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Toàn bộ quy trình dịch thuật trong một LLM duy nhất |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Phát hiện lỗi chi tiết trong đánh giá MT |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | Đánh giá MT được điều chỉnh thích ứng cho các ngôn ngữ châu Phi |

---

## Phụ lục B: Các hội nghị và cộng đồng

### Các hội nghị lớn

Hệ sinh thái hội nghị NLP/MT diễn ra theo chu kỳ hàng năm. Bảng dưới đây liệt kê các địa điểm chính, kèm theo thời gian diễn ra của các kỳ gần nhất.

| Hội nghị | Tên đầy đủ | Tần suất | Ghi chú |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Hàng năm | Sân chơi cạnh tranh chính của ngành; các nhiệm vụ chung thiết lập các bộ chuẩn benchmark |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Hàng năm | Hội nghị hàng đầu (flagship) về NLP |
| **EMNLP** | Empirical Methods in NLP | Hàng năm | Hội nghị hàng đầu thứ hai; thường là nơi đăng cai WMT |
| **NAACL** | North American Chapter of the ACL | Hàng năm (luân phiên với ACL) | Hội nghị khu vực lớn |
| **EACL** | European Chapter of the ACL | 2 năm một lần | Hội nghị khu vực châu Âu |
| **COLING** | Intl. Conf. on Computational Linguistics | 2 năm một lần | Từng sáp nhập với LREC năm 2024; hiện đã tách riêng trở lại |
| **LREC** | Language Resources & Evaluation Conference | 2 năm một lần | Tập trung vào dữ liệu, tài nguyên và đánh giá |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Hàng năm | Tập trung vào dịch giọng nói |

#### Các kỳ tổ chức gần đây

*Chỉ hiển thị ngày tháng — một cách có chủ đích. Một cột "trạng thái" ghi **Sắp diễn ra** sẽ bị sai ngay trong ngày sự kiện bắt đầu, và trang này không thể biết được ngày hôm nay là ngày nào. Bạn hãy tự đối chiếu ngày tháng bên dưới với lịch; kỷ yếu của bất kỳ sự kiện nào đã diễn ra đều có trên [ACL Anthology](https://aclanthology.org).*

| Sự kiện | Thời gian | Địa điểm |
|---|---|---|
| **COLING 2025** | 19–24 tháng 1, 2025 | Abu Dhabi, UAE |
| **EACL 2026** | 24–29 tháng 3, 2026 | Rabat, Morocco |
| **LREC 2026** | 11–16 tháng 5, 2026 | Palma de Mallorca, Tây Ban Nha |
| **ACL 2026** | 2–7 tháng 7, 2026 | San Diego, Hoa Kỳ |
| **AmericasNLP 2026** | 3–4 tháng 7, 2026 (đồng địa điểm với ACL) | San Diego, Hoa Kỳ |

*ACL 2025 (Vienna), EMNLP 2025 (Tô Châu), WMT 2025 (Tô Châu), IWSLT 2025 (Vienna), và PACLIC 39 (Hà Nội) đều đã diễn ra trong năm 2025. Kỷ yếu của các hội nghị này hiện có trên [ACL Anthology](https://aclanthology.org).*

#### Các nhiệm vụ chung tại WMT 2025

Các nhiệm vụ chung (shared tasks) của WMT là sự kiện gần nhất mà lĩnh vực MT có để đóng vai trò như một cuộc thi công khai. Kỳ tổ chức năm 2025 bao gồm:

- **Dịch máy tổng quát (General Machine Translation)** — nhiệm vụ mũi nhọn
- **Các hệ thống đánh giá dịch thuật tự động (Automated Translation Evaluation Systems)** — các thước đo thống nhất và ước lượng chất lượng
- **Dịch ngôn ngữ Indic tài nguyên thấp (Low-Resource Indic Language Translation)**
- **Dịch ngôn ngữ Creole (Creole Language Translation)**
- **Nhiệm vụ chung về thuật ngữ (Terminology Shared Task)**
- **Nén mô hình (Model Compression)** — làm cho các mô hình MT nhỏ hơn và nhanh hơn
- **Dữ liệu ngôn ngữ mở (Open Language Data)** — cải thiện dữ liệu huấn luyện mở
- **Nhiệm vụ chung về câu lệnh đa ngôn ngữ (MIST - Multilingual Instruction Shared Task)**
- **LLM cho các ngôn ngữ Slavic tài nguyên hạn chế (Limited Resources Slavic LLMs)**

### Các hội thảo chuyên đề

| Hội thảo | Trọng tâm | Kỳ gần nhất được biết | Đồng địa điểm với |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Các ngôn ngữ bản địa châu Mỹ | 3–4 tháng 7, 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP cho ngôn ngữ châu Phi | 31 tháng 7, 2025 (ACL 2025, Vienna) | ACL / ICLR |
| **LoResMT** | MT tài nguyên thấp | Thường tổ chức hàng năm tại các hội nghị *ACL | Nhiều hội nghị khác nhau |
| **SIGTYP** | Nhóm chuyên trách ACL về Loại hình học ngôn ngữ | Hội thảo thường niên | ACL |

### Các tài nguyên cộng đồng then chốt

- **[machinetranslate.org](https://machinetranslate.org)** — Cơ sở tri thức mở do cộng đồng thúc đẩy về công nghệ MT. Được vận hành bởi Machine Translate Foundation (tổ chức phi lợi nhuận tại Zug, Thụy Sĩ, thành lập năm 2021). Cung cấp thông tin về các phương pháp tiếp cận, API, mô hình, độ hỗ trợ ngôn ngữ và tin tức trong ngành. Được cấp phép theo CC BY-SA 4.0. Một điểm khởi đầu tuyệt vời cho bất kỳ chủ đề nào trong báo cáo này.

- **[ACL Anthology](https://aclanthology.org)** — Kho lưu trữ truy cập mở chuẩn mực về các bài báo nghiên cứu NLP/CL. Mọi bài báo tại ACL, EMNLP, NAACL, EACL, WMT và các hội nghị liên quan đều có thể truy cập miễn phí tại đây.

---

## Phụ lục C: Công cụ, tập dữ liệu và tài nguyên thực tế

Phụ lục này đề cập đến các công cụ và nguồn dữ liệu cụ thể đóng vai trò quan trọng trong công việc MT hiện nay. Nội dung được viết cho những người đã quen thuộc với dòng lệnh terminal nhưng có thể chưa nắm rõ hệ sinh thái MT.

### Các bộ khung huấn luyện (Training Frameworks)

Đây là các gói phần mềm được sử dụng để *huấn luyện* các mô hình MT nơ-ron từ đầu (hoặc tinh chỉnh các mô hình hiện có). Bạn sẽ sử dụng các bộ khung này nếu muốn tự xây dựng mô hình dịch thuật của riêng mình thay vì sử dụng một mô hình sẵn có qua API.

| Bộ khung | Nhà phát triển | Ngôn ngữ | Ghi chú |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / ĐH Edinburgh | C++ | Bộ huấn luyện NMT mã nguồn mở nhanh nhất — có thể huấn luyện một mô hình nhanh hơn 3–5 lần so với các giải pháp thay thế dựa trên PyTorch. Được viết bằng C++ thuần với sự phụ thuộc tối thiểu. Là nền tảng vận hành Microsoft Translator. Mọi mô hình OpusMT (xem bên dưới) đều được huấn luyện bằng công cụ này. Được đặt theo tên của Marian Rejewski, nhà toán học Ba Lan đã giúp giải mã cỗ máy Enigma. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | Bộ công cụ nghiên cứu chủ lực của Meta — được dùng để xây dựng M2M-100, NLLB-200 và hầu hết các công trình MT đã công bố của Meta. Tính mô-đun hóa rất cao: bạn có thể hoán đổi các kiến trúc, hàm mất mát và quy trình xử lý dữ liệu. Là lựa chọn tiêu chuẩn cho các nhà nghiên cứu muốn tái lập hoặc phát triển thêm từ các công trình của Meta. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | Điểm khởi đầu dễ tiếp cận nhất để huấn luyện các mô hình MT tùy chỉnh. Xuất phát từ một dự án nghiên cứu của Harvard, hiện được duy trì bởi SYSTRAN (một công ty MT thương mại). Bao gồm CTranslate2 phục vụ việc triển khai (xem bên dưới). Tài liệu hướng dẫn tốt cho người mới bắt đầu. |

**Khi nào bạn nên sử dụng các công cụ này?** Khi bạn có dữ liệu song ngữ (thậm chí chỉ vài nghìn cặp câu) và muốn huấn luyện hoặc tinh chỉnh một mô hình dịch chuyên dụng cho một cặp ngôn ngữ cụ thể. Bạn SẼ KHÔNG dùng các công cụ này cho dịch thuật dựa trên LLM (viết prompt cho GPT/Claude/Gemini), vốn không đòi hỏi huấn luyện — mà chỉ cần gọi API.

### Suy luận và Triển khai (Inference and Deployment)

Các công cụ này dùng để chạy các mô hình *đã được huấn luyện* để tạo ra bản dịch. Hãy hình dung các bộ khung huấn luyện ở trên là "xưởng nơi chiếc xe được chế tạo" và các công cụ này là "chìa khóa đánh lửa để khởi động xe".

| Công cụ | Chức năng | Khi nào nên dùng |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Một engine C++ chạy các mô hình Transformer với tốc độ cao và tốn ít bộ nhớ. Hỗ trợ lượng tử hóa INT8/INT4 (thu nhỏ kích thước mô hình xuống còn 1/4 mà suy giảm chất lượng không đáng kể). Chạy trên CPU hoặc GPU mà không cần cài đặt PyTorch. Hỗ trợ NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Khi bạn muốn tự lưu trữ (self-host) một mô hình dịch thuật trên máy chủ hoặc máy tính xách tay mà không cần cụm GPU. Lựa chọn hàng đầu để triển khai production các mô hình MT mã nguồn mở. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Thư viện Python tải và chạy các mô hình chỉ với vài dòng code: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Cung cấp khoảng 1.500 mô hình song ngữ OpusMT được huấn luyện trước cùng với NLLB-200, mBART, mT5 và M2M-100. | Khi bạn muốn con đường nhanh nhất từ ý nghĩ "tôi muốn dịch thứ gì đó" đến đoạn code chạy được. Hai dòng Python là bạn đã có thể bắt đầu dịch. Thông lượng thấp hơn CTranslate2 nhưng thiết lập dễ dàng hơn rất nhiều. |

### Các dòng mô hình được huấn luyện trước

Đây là các mô hình dịch thuật *đã được huấn luyện sẵn* mà bạn có thể tải về và sử dụng ngay lập tức. Không yêu cầu huấn luyện — chỉ cần nạp lên và dịch.

| Dòng mô hình | Số ngôn ngữ | Nhà phát triển | Bản chất | Nơi tìm kiếm |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1.000+ cặp | Đại học Helsinki (Jörg Tiedemann) | Bộ sưu tập các mô hình dịch song ngữ mã nguồn mở lớn nhất. Mỗi mô hình xử lý một cặp ngôn ngữ (ví dụ: `opus-mt-en-fr` cho chiều Anh→Pháp). Được huấn luyện trên dữ liệu OPUS bằng Marian NMT, chuyển đổi sang định dạng PyTorch cho Hugging Face. Chất lượng khác nhau — xuất sắc cho các cặp giàu tài nguyên, hạn chế cho tài nguyên thấp. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 ngôn ngữ | Meta | Một mô hình đa ngôn ngữ duy nhất dịch giữa bất kỳ ngôn ngữ nào trong số 200 ngôn ngữ. Có sẵn các biến thể 600M, 1.3B và 3.3B tham số. Bản 600M có thể chạy trên laptop; bản 3.3B cần GPU tương đối tốt. Chất lượng dao động rất lớn — mạnh ở mức tài nguyên trung bình, thường kém ở mức tài nguyên thực sự thấp. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 ngôn ngữ | Meta | Tiền thân của NLLB-200 — mô hình đầu tiên dịch trực tiếp giữa các cặp không có tiếng Anh (ví dụ: Bengali↔Swahili) mà không cần định tuyến qua tiếng Anh. Có ý nghĩa lịch sử quan trọng; phần lớn đã được thay thế bởi NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 ngôn ngữ | Unbabel | Không chỉ là một công cụ dịch — xử lý toàn bộ quy trình dịch (sửa lỗi, NER, biên tập hậu kỳ, ước lượng chất lượng) trong một LLM duy nhất. Được tinh chỉnh từ LLaMA. Tính đến năm 2025, Tower v2 (70B) vượt trội hơn GPT-4o và DeepL trên nhiều bài benchmark. | Hugging Face |
| **ALMA / X-ALMA** | 50 ngôn ngữ | Đại học Johns Hopkins | Các mô hình dựa trên LLaMA được tinh chỉnh chuyên biệt cho dịch thuật bằng phương pháp tối ưu hóa sở thích (dạy mô hình biết bản dịch nào được con người ưa thích hơn). Các phiên bản 7B và 13B đạt chất lượng ngang ngửa GPT-4 trên các cặp tài nguyên cao. X-ALMA mở rộng lên 50 ngôn ngữ với các mô-đun adapter riêng cho từng ngôn ngữ. | Hugging Face |

### Các nguồn dữ liệu song ngữ

Dữ liệu song ngữ là nhiên liệu để huấn luyện các mô hình MT: các tập hợp câu trong hai ngôn ngữ là bản dịch của nhau, được căn chỉnh theo từng dòng. Không có dữ liệu song ngữ, bạn không thể huấn luyện một mô hình MT thông thường. (Dịch thuật dựa trên LLM bỏ qua được điều này — bạn có thể prompt GPT để dịch mà không cần bất kỳ dữ liệu song ngữ nào — nhưng các mô hình chuyên dụng vẫn rất cần nó.)

| Tập dữ liệu | Quy mô | Bản chất | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ cặp câu, 1.000+ ngôn ngữ | Tài nguyên quan trọng nhất đối với dữ liệu MT. Một siêu kho lưu trữ tổng hợp hàng chục kho ngữ liệu con (xem bên dưới) vào một cổng thông tin có thể tìm kiếm được. Do Jörg Tiedemann tại Đại học Helsinki tạo ra và duy trì. Nếu bạn đang tìm kiếm dữ liệu song ngữ ở bất kỳ ngôn ngữ nào, OPUS là nơi bạn nên bắt đầu. Có thể truy cập qua cổng web, gói Python `opustools` và Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M từ/ngôn ngữ, 21 ngôn ngữ EU | Các biên bản của Nghị viện châu Âu — bài phát biểu của các chính trị gia được dịch sang tất cả các ngôn ngữ chính thức của EU. Do Philipp Koehn tạo ra. Mang tính nền tảng lịch sử (tập dữ liệu giúp nghiên cứu SMT trở nên khả thi), nhưng bị giới hạn trong các ngôn ngữ EU và văn phong nghị trường. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Hàng tỷ cặp, 29+ cặp ngôn ngữ | Dự án do EU tài trợ, thu thập dữ liệu web để tìm các văn bản song ngữ xuất hiện tự nhiên (các trang web song ngữ, các trang đã dịch). Nhiễu hơn nhiều so với các kho ngữ liệu được tuyển chọn nhưng có quy mô lớn hơn rất nhiều. Đã phát hành quy trình thu thập dữ liệu mã nguồn mở **Bitextor**, cho phép bất kỳ ai cũng có thể tự khai phá dữ liệu song ngữ từ web. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M cặp URL, 137 chiều ghép đôi với tiếng Anh | Các tài liệu song ngữ được khai phá từ web thông qua Common Crawl (Meta/JHU). Đặc biệt hữu ích cho các ngôn ngữ tài nguyên thấp đến trung bình vốn không xuất hiện trong các kho ngữ liệu được tuyển chọn. Chất lượng thấp hơn Europarl nhưng độ bao phủ rộng hơn nhiều. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M câu song ngữ, 1.620 cặp | Các câu song ngữ được khai phá tự động từ Wikipedia bằng cách sử dụng các vector nhúng đa ngôn ngữ LASER (Meta). Hữu ích vì Wikipedia có mặt ở nhiều ngôn ngữ — nhưng việc căn chỉnh được thực hiện tự động (chưa qua con người kiểm chứng), do đó một số cặp câu có thể bị nhiễu hoặc sai lệch. | GitHub (kho LASER) |
| **[Tatoeba](https://tatoeba.org)** | 500+ ngôn ngữ | Một bộ sưu tập các câu ví dụ và bản dịch do cộng đồng duy trì, được đóng góp bởi các tình nguyện viên trên toàn thế giới. Bao gồm các câu riêng lẻ chứ không phải tài liệu. Thử thách liên quan **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** (Helsinki-NLP) cung cấp các tập chia train/test sạch cho hàng nghìn cặp ngôn ngữ — được dùng để huấn luyện các mô hình OpusMT. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 ngôn ngữ | Một bộ benchmark đánh giá tiêu chuẩn hóa (KHÔNG PHẢI dữ liệu huấn luyện). Gồm các câu được dịch bởi dịch giả chuyên nghiệp, dùng để so sánh các hệ thống trên một mặt bằng công bằng. Do Meta tạo ra song song với NLLB-200. Nếu bạn muốn so sánh hệ thống của mình với các đường cơ sở đã công bố, đây là tập kiểm thử cần dùng. | Hugging Face |

### Các kho ngữ liệu con quan trọng trong OPUS

OPUS tổng hợp nhiều kho ngữ liệu song ngữ độc lập. Khi tìm kiếm dữ liệu ở một ngôn ngữ cụ thể, các bộ sưu tập con sau đây rất đáng để kiểm tra:

- **OpenSubtitles** — Phụ đề phim điện ảnh và truyền hình. Quy mô khổng lồ nhưng nhiều nhiễu — phụ đề thường được đơn giản hóa, mang tính khẩu ngữ và có thể chứa lỗi phiên âm.
- **JW300** — Các ấn phẩm của Nhân Chứng Giê-hô-va, bao quát khoảng 300 ngôn ngữ. Độ bao phủ ngôn ngữ rộng nhất trong số các kho ngữ liệu đơn lẻ, nhưng bị lệch lĩnh vực nghiêm trọng về nội dung tôn giáo và còn gây tranh cãi về mặt đạo đức (xem Phần 4).
- **Bible** — Bản dịch Kinh Thánh trong hơn 700 ngôn ngữ. Lĩnh vực hẹp nhất trong tất cả (văn bản tôn giáo cổ), nhưng đối với nhiều ngôn ngữ, đây là văn bản song ngữ duy nhất từng tồn tại.
- **Tanzil** — Bản dịch Kinh Quran. Hữu ích cho dữ liệu ghép cặp với tiếng Ả Rập.
- **GNOME / KDE** — Chuỗi bản địa hóa phần mềm ("Tệp → Lưu", "Bạn có chắc chắn muốn xóa không?"). Hữu ích cho lĩnh vực kỹ thuật/giao diện người dùng nhưng rất mang tính khuôn mẫu.
- **EMEA** — Tài liệu của Cơ quan Quản lý Dược phẩm Châu Âu. Hữu ích cho việc dịch thuật lĩnh vực y sinh.

---

## Phụ lục D: Thuật ngữ

**Attention mechanism (Cơ chế chú ý)**: Một thành phần mạng nơ-ron cho phép mô hình tập trung động vào các phần khác nhau của đầu vào khi tạo ra từng phần của đầu ra. Được Bahdanau et al. (2014) giới thiệu cho MT; được tổng quát hóa trong Transformer (2017).

**Backtranslation (Dịch ngược)**: Một kỹ thuật tăng cường dữ liệu, trong đó văn bản đơn ngữ của ngôn ngữ đích được dịch ngược trở lại ngôn ngữ nguồn bằng một hệ thống MT sơ bộ, tạo ra dữ liệu song ngữ tổng hợp để huấn luyện.

**BLEU**: Bilingual Evaluation Understudy. Một thước đo đánh giá MT tự động dựa trên độ trùng khớp chính xác của n-gram với các bản dịch tham chiếu.

**BPE (Byte Pair Encoding)**: Thuật toán tách từ dưới từ (subword) thực hiện ghép cặp lặp đi lặp lại các cặp ký tự thường xuyên nhất để xây dựng bộ từ vựng. Được sử dụng trong hầu như mọi hệ thống NMT và LLM hiện đại.

**COMET**: Một thước đo đánh giá MT nơ-ron sử dụng các vector nhúng xuyên ngôn ngữ để dự đoán các phán đoán chất lượng của con người, hoạt động dựa trên bộ ba: nguồn + giả thuyết dịch + tham chiếu.

**Curse of multilinguality (Lời nguyền đa ngôn ngữ)**: Hiện tượng khi việc thêm nhiều ngôn ngữ vào một mô hình đa ngôn ngữ làm suy giảm chất lượng của từng ngôn ngữ do dung lượng mô hình là cố định.

**Encoder–decoder (Bộ mã hóa – bộ giải mã)**: Một kiến trúc nơ-ron trong đó bộ mã hóa xử lý chuỗi đầu vào thành các biểu diễn, và bộ giải mã tạo ra chuỗi đầu ra từ các biểu diễn đó.

**FLORES-200**: Một bộ chuẩn benchmark đánh giá MT tiêu chuẩn hóa bao quát 200 ngôn ngữ, do Meta tạo ra song song với NLLB-200.

**FST (Finite-State Transducer - Bộ chuyển đổi trạng thái hữu hạn)**: Một thiết bị tính toán ánh xạ giữa các chuỗi ký hiệu đầu vào và đầu ra bằng cách sử dụng các trạng thái và bước chuyển dịch. Được dùng trong hình thái học tính toán để phân tích và sinh ra các dạng từ.

**Hallucination (Ảo giác)**: Trong MT, hiện tượng mô hình tạo ra đầu ra trôi chảy nhưng hoàn toàn không liên quan hoặc không trung thành với văn bản nguồn. Đặc biệt phổ biến trong các bối cảnh tài nguyên thấp.

**High-resource language (Ngôn ngữ tài nguyên cao)**: Ngôn ngữ có lượng văn bản số hóa và dữ liệu dịch thuật song ngữ dồi dào (thường >10 triệu cặp câu với tiếng Anh). Ví dụ: tiếng Pháp, Đức, Trung, Tây Ban Nha.

**LLM (Large Language Model - Mô hình ngôn ngữ lớn)**: Một mô hình ngôn ngữ nơ-ron với hàng tỷ tham số, được huấn luyện trên các kho ngữ liệu văn bản khổng lồ để dự đoán token tiếp theo. Ví dụ: GPT-4, Gemini, LLaMA, Claude.

**Low-resource language - LRL (Ngôn ngữ tài nguyên thấp)**: Ngôn ngữ có lượng văn bản số hóa và dữ liệu song ngữ hạn chế (<1 triệu cặp câu). Phần lớn các ngôn ngữ trên thế giới đều thuộc nhóm này.

**MQM (Multidimensional Quality Metrics - Bộ tiêu chuẩn chất lượng đa chiều)**: Một khung đánh giá của con người, nơi các dịch giả chuyên nghiệp gán nhãn các đoạn lỗi cụ thể trong bản dịch, phân loại theo loại lỗi và mức độ nghiêm trọng.

**NMT (Neural Machine Translation - Dịch máy nơ-ron)**: MT sử dụng mạng nơ-ron, trái ngược với các phương pháp tiếp cận thống kê (SMT) hoặc dựa trên luật (RBMT).

**Parallel data / parallel corpus (Dữ liệu song ngữ / kho ngữ liệu song ngữ)**: Tập hợp các văn bản bằng hai ngôn ngữ là bản dịch của nhau, được căn chỉnh ở cấp độ câu. Tài nguyên huấn luyện chính cho MT.

**Polysynthetic language (Ngôn ngữ đa tổng hợp)**: Ngôn ngữ trong đó các từ được cấu thành từ rất nhiều hình vị, thường mã hóa lượng thông tin tương đương cả một mệnh đề hoàn chỉnh trong các ngôn ngữ phân tích tính như tiếng Anh. Ví dụ: tiếng Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Một bộ tách từ và ghép từ cấp độ dưới từ độc lập với ngôn ngữ, triển khai thuật toán phân đoạn BPE và mô hình ngôn ngữ unigram. Được sử dụng rộng rãi trong NLP đa ngôn ngữ.

**Transformer**: Kiến trúc nơ-ron thống trị cho NLP kể từ năm 2017, dựa hoàn toàn trên các cơ chế tự chú ý (self-attention). Được giới thiệu trong bài báo "Attention Is All You Need" (Vaswani et al., 2017).

**Zero-shot cross-lingual transfer (Chuyển giao xuyên ngôn ngữ zero-shot)**: Việc áp dụng một mô hình được huấn luyện trên một ngôn ngữ (thường là tiếng Anh) sang một ngôn ngữ khác mà không cần bất kỳ dữ liệu huấn luyện nào của ngôn ngữ đích, dựa vào các biểu diễn đa ngôn ngữ dùng chung.

---

*Báo cáo này được tổng hợp vào tháng 6 năm 2026. Lĩnh vực MT biến chuyển rất nhanh chóng; các khả năng cụ thể của mô hình và kết quả benchmark cần được xác minh lại dựa trên các nguồn tin hiện hành. Để theo dõi các bước phát triển mới nhất, hãy tham khảo [machinetranslate.org](https://machinetranslate.org), [ACL Anthology](https://aclanthology.org), và kỷ yếu của nhiệm vụ chung WMT gần nhất.*



## Điều này dẫn đến đâu trên trang web này

Khoảng trống mà báo cáo này mô tả — hàng trăm ngôn ngữ hoàn toàn chưa có bất kỳ dữ liệu dịch thuật nào được đo lường — chính là mục tiêu mà phần còn lại của trang web này hướng tới để thu hẹp. Luận điểm về phương pháp thực hiện ([Champollion là gì](/docs/what-is-champollion)), tính kinh tế của việc xây dựng một tập đánh giá thay vì một kho ngữ liệu huấn luyện ([Ai được hưởng lợi — Các nhà nghiên cứu](/docs/network/who-benefits#researchers)), và thực trạng những gì thực sự đã được đo lường cho đến nay ([Những hạn chế trung thực](/docs/network/honest-limitations)) là ba bài đọc tiếp theo phù hợp nhất dành cho bạn.
