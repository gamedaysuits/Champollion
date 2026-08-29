# Machine Translation: Bản tóm tắt lĩnh vực (2013–2026)

*Lịch sử tường thuật dành cho bất kỳ ai bước vào bối cảnh MT*

---

## Mục lục

- [Phần 1: Cuộc cách mạng Neural (2013–2017)](#part-1-the-neural-revolution-20132017)
- [Phần 2: Bước ngoặt đa ngôn ngữ (2018–2022)](#part-2-the-multilingual-turn-20182022)
- [Phần 3: Kỷ nguyên LLM (2022–2026)](#part-3-the-llm-era-20222026)
- [Phần 4: Vấn đề Low-Resource (Tài nguyên thấp)](#part-4-the-low-resource-problem)
- [Phần 5: Finite-State Transducers và các hệ thống dựa trên quy tắc](#part-5-finite-state-transducers-and-rule-based-systems)
- [Phần 6: Đo lường chất lượng — Vấn đề đánh giá](#part-6-measuring-quality--the-evaluation-problem)
- [Phần 7: Bối cảnh thể chế](#part-7-the-institutional-landscape)
- [Phần 8: Những biên giới mở](#part-8-open-frontiers)
- [Phụ lục A: Các bài báo chính](#appendix-a-key-papers)
- [Phụ lục B: Hội nghị và Cộng đồng](#appendix-b-conferences-and-communities)
- [Phụ lục C: Công cụ, Tập dữ liệu và Tài nguyên thực tế](#appendix-c-tools-datasets-and-practical-resources)
- [Phụ lục D: Thuật ngữ](#appendix-d-glossary)

---

## Phần 1: Cuộc cách mạng Neural (2013–2017)

### Chế độ cũ: Statistical Machine Translation (Dịch máy thống kê)

Để hiểu được cuộc cách mạng đã định hình lại machine translation (dịch máy) vào giữa những năm 2010, trước tiên bạn cần hiểu những gì đã diễn ra trước đó — và tại sao nó lại thất bại.

Từ khoảng năm 2003 đến 2015, mô hình thống trị trong MT là **Statistical Machine Translation (SMT)**, cụ thể là **phrase-based SMT** (SMT dựa trên cụm từ). Ý tưởng cốt lõi đơn giản đến mức đánh lừa: thay vì viết các quy tắc về cách ngôn ngữ hoạt động, bạn thu thập một lượng lớn văn bản song song (parallel text) — các tài liệu được con người dịch sang hai ngôn ngữ — và để các thuật toán thống kê học các điểm tương đồng. Hệ thống sẽ phân tích một câu nguồn thành các cụm từ chồng chéo (không phải cụm từ ngôn ngữ học, mà là các đoạn n-gram tùy ý), tìm các bản dịch có khả năng thống kê cao nhất cho mỗi đoạn, và sau đó lắp ráp thành một câu đích sử dụng một **language model** (mô hình ngôn ngữ) để đảm bảo đầu ra trôi chảy.

Công cụ chủ lực của thời kỳ này là **Moses**, một bộ công cụ SMT mã nguồn mở được phát triển chủ yếu tại Đại học Edinburgh dưới sự dẫn dắt của Philipp Koehn, phát hành năm 2006. Moses trở thành Linux của nghiên cứu MT — hầu như mọi phòng thí nghiệm MT học thuật trên thế giới đều sử dụng nó. Công cụ đồng hành của nó, **cdec** (do Chris Dyer tại Carnegie Mellon phát triển), cung cấp các khả năng tương tự với một hình thức khác. Cùng nhau, các công cụ này đã định hình một thập kỷ nghiên cứu MT.

Phrase-based SMT hoạt động tốt một cách đáng ngạc nhiên đối với các cặp ngôn ngữ có dữ liệu song song dồi dào và trật tự từ tương tự nhau — Anh–Pháp, Anh–Tây Ban Nha, Anh–Đức. Nhưng nó có những hạn chế sâu sắc về mặt cấu trúc. Hệ thống không có khái niệm về ý nghĩa. Nó chỉ khớp mẫu (pattern-matching) trên các chuỗi bề mặt, lắp ráp các bản dịch từ các đoạn được ghi nhớ. Nó gặp khó khăn với các phụ thuộc tầm xa (long-range dependencies - ví dụ: một đại từ thay thế cho một danh từ ở vài mệnh đề trước đó), với việc sắp xếp lại trật tự từ giữa các ngôn ngữ có loại hình khác nhau (ví dụ: Anh–Nhật, nơi động từ xuất hiện ở các vị trí đối lập), và với bất kỳ hiện tượng nào đòi hỏi sự trừu tượng hóa thực sự về cấu trúc ngôn ngữ. Mỗi cải tiến đều đòi hỏi kỹ thuật ngày càng phức tạp: các quy tắc sắp xếp lại trật tự từ được làm thủ công, các đặc trưng thưa thớt (sparse features), các language model khổng lồ. Kiến trúc này đang chạm đến giới hạn của nó.

### Bước đột phá: Sequence-to-Sequence với Attention

Vết nứt đầu tiên trong mô hình SMT không đến từ cộng đồng MT, mà từ các nhà nghiên cứu deep learning làm việc về các bài toán mô hình hóa chuỗi (sequence modelling).

Vào tháng 9 năm 2014, **Dzmitry Bahdanau, Kyunghyun Cho, và Yoshua Bengio** tại Đại học Montréal đã xuất bản một bài báo mang tính bước ngoặt: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (được trình bày tại ICLR 2015). Đổi mới then chốt chính là **attention mechanism** (cơ chế attention).

Để hiểu tại sao điều này lại quan trọng, bạn cần biết bối cảnh trước đó. Chỉ vài tháng trước, Ilya Sutskever, Oriol Vinyals, và Quoc V. Le tại Google đã xuất bản ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) (NIPS 2014), chứng minh rằng một mạng neural với kiến trúc **encoder–decoder** có thể dịch các câu. Encoder đọc câu nguồn từng từ một và nén nó thành một vector có độ dài cố định duy nhất — một bản tóm tắt bằng số của toàn bộ đầu vào. Sau đó, decoder tạo ra câu đích từng từ một từ vector đó.

Cách tiếp cận này rất thanh lịch nhưng có một lỗ hổng chí mạng: vector duy nhất đó là một **nút thắt cổ chai** (bottleneck). Tất cả thông tin trong một câu nguồn dài ba mươi từ phải được nhồi nhét qua một vector gồm, giả sử, 1.000 con số. Các câu ngắn được dịch khá tốt; các câu dài bị suy giảm chất lượng nghiêm trọng, vì mô hình đã quên các từ đầu tiên vào thời điểm nó mã hóa xong các từ cuối cùng.

Attention mechanism của Bahdanau đã giải quyết vấn đề này. Thay vì nén toàn bộ nguồn thành một vector, decoder được phép **nhìn lại** tất cả các trạng thái ẩn (hidden states) của encoder — các biểu diễn trung gian tại mọi vị trí nguồn — và tự động đánh trọng số xem vị trí nào là phù hợp nhất để tạo ra từng từ đích. Khi tạo ra từ tiếng Anh "cat", mô hình có thể chú ý mạnh nhất đến từ tiếng Pháp "chat" trong nguồn, ngay cả khi chúng ở cách xa nhau trong câu. Mô hình đã học cách *căn chỉnh* (align) các từ nguồn và đích như một phần của quá trình dịch, thay vì dựa vào một bản tóm tắt nén duy nhất.

Đây là sự đổi mới nền tảng. Attention không chỉ cải thiện MT; nó đã trở thành cơ chế trung tâm của hầu như mọi tiến bộ sau này trong xử lý ngôn ngữ tự nhiên (NLP).

### Google chuyển sang Neural

Các kết quả học thuật của năm 2014–2015 rất ấn tượng nhưng chưa sẵn sàng cho môi trường production. Điều đó đã thay đổi vào cuối năm 2016.

Vào tháng 9 năm 2016, một nhóm lớn tại Google do **Yonghui Wu** dẫn đầu đã xuất bản ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). Hệ thống này, được gọi là **GNMT** (Google Neural Machine Translation), là một kiến trúc encoder–decoder quy mô công nghiệp với attention, được huấn luyện trên các tài nguyên dữ liệu song song khổng lồ của Google. Bài báo đưa ra một tuyên bố đáng chú ý: trên một số cặp ngôn ngữ nhất định, GNMT đã giảm 55–85% lỗi dịch thuật so với hệ thống phrase-based SMT hiện có của Google.

Vào tháng 11 năm 2016, Google bắt đầu âm thầm chuyển đổi Google Translate từ phrase-based SMT sang GNMT cho các cặp ngôn ngữ chính. Quá trình chuyển đổi về cơ bản đã hoàn tất đối với các cặp ngôn ngữ tài nguyên cao (high-resource) vào năm 2017. Đối với người dùng, sự thay đổi này rất rõ rệt. Những bản dịch trước đây đọc có vẻ gượng gạo, rời rạc và đôi khi vô nghĩa đã trở nên trôi chảy hơn đáng kể — đôi khi đến mức đáng kinh ngạc. Kỷ nguyên lấy "những câu vô nghĩa của Google Translate" làm trò đùa đang đi đến hồi kết.

Phản ứng cạnh tranh diễn ra nhanh chóng. Vào tháng 8 năm 2017, **DeepL**, do **Gereon Frahling** thành lập tại Cologne, Đức, đã ra mắt dịch vụ dịch thuật của mình. DeepL phát triển từ dự án từ điển song ngữ Linguee và tạo sự khác biệt thông qua chất lượng dịch thuật được cảm nhận — đặc biệt là đối với các cặp ngôn ngữ châu Âu, nơi nó nhanh chóng tạo dựng được danh tiếng trong giới dịch giả chuyên nghiệp vì tạo ra đầu ra tự nhiên, mang tính thành ngữ hơn Google. Mô hình kinh doanh của DeepL (freemium với API trả phí) và sự tập trung vào chất lượng thay vì số lượng đã định hình vị thế thị trường của họ trong tương lai. DeepL hỗ trợ khoảng 33 ngôn ngữ — ít hơn nhiều so với con số 194 trong danh sách Cloud Translation của Google — nhưng với định vị ưu tiên chất lượng.

### Transformer

Nếu attention mechanism của Bahdanau là nền móng, thì **Transformer** chính là tòa nhà được xây dựng trên đó — và tòa nhà này là một tòa nhà chọc trời.

Vào tháng 6 năm 2017, một nhóm gồm tám nhà nghiên cứu tại Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, và Illia Polosukhin** — đã xuất bản ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) tại NIPS 2017

Các đột phá chính bao gồm:

1. **Self-attention**: Mỗi từ trong một câu sẽ chú ý đến mọi từ khác trong cùng câu đó, tính toán các mối quan hệ song song thay vì tuần tự. Điều này nắm bắt được các phụ thuộc tầm xa mà không gặp phải nút thắt thông tin của RNN, và — quan trọng nhất — nó có thể chạy song song trên phần cứng hiện đại (GPU và TPU), giúp quá trình huấn luyện nhanh hơn đáng kể.

2. **Multi-head attention**: Thay vì tính toán một mẫu chú ý duy nhất, mô hình tính toán đồng thời nhiều mẫu chú ý ("heads"), mỗi mẫu có khả năng nắm bắt các loại mối quan hệ ngôn ngữ khác nhau — cú pháp, ngữ nghĩa, vị trí.

3. **Positional encoding**: Vì self-attention xử lý tất cả các từ đồng thời (không giống như RNN xử lý tuần tự), mô hình không có khái niệm vốn có về thứ tự từ. Positional encodings (Mã hóa vị trí) — các hàm toán học được đưa vào đầu vào — cung cấp thông tin này.

Transformer không chỉ vượt trội hơn các mô hình dựa trên RNN trên các benchmark dịch thuật. Nó được huấn luyện **nhanh hơn nhiều bậc độ lớn** nhờ khả năng xử lý song song. Điều này có thể nói là quan trọng ngang với việc cải thiện chất lượng: các nhà nghiên cứu giờ đây có thể lặp lại nhanh hơn, huấn luyện trên nhiều dữ liệu hơn và mở rộng quy mô lên các mô hình lớn hơn. Vòng lặp tích cực của việc mở rộng quy mô đã bắt đầu.

Trong vòng hai năm, kiến trúc Transformer đã trở thành nền tảng cho hầu hết các công trình tiên tiến nhất trong NLP — không chỉ MT (Dịch máy), mà còn mô hình hóa ngôn ngữ, phân loại văn bản, trả lời câu hỏi, tóm tắt, và cuối cùng là các mô hình ngôn ngữ lớn (GPT, BERT, LLaMA) sẽ định hình lại bối cảnh AI rộng lớn hơn. Mọi hệ thống được thảo luận trong phần còn lại của bản tóm tắt này đều được xây dựng trên Transformer.

### Bước ngoặt WMT 2016

**Conference on Machine Translation** (WMT), được tổ chức hàng năm như một hội thảo đi kèm với các hội nghị NLP lớn, tổ chức các **shared tasks** (tác vụ chung) mang tính cạnh tranh, nơi các nhóm nghiên cứu gửi hệ thống MT và được xếp hạng với nhau trên các tập kiểm tra tiêu chuẩn. WMT là thứ gần gũi nhất mà lĩnh vực MT có được như một bảng xếp hạng công khai.

Tại **WMT 2016**, các hệ thống neural MT đã vượt trội một cách quyết đoán so với các hệ thống SMT dựa trên cụm từ trên hầu hết các cặp ngôn ngữ trong shared task. Đây là khoảnh khắc trọng tâm của lĩnh vực này dịch chuyển. Các nhà nghiên cứu đã dành cả sự nghiệp để xây dựng các hệ thống dựa trên cụm từ bắt đầu chuyển đổi công cụ sang mô hình neural. Trong vòng hai năm, các ấn phẩm mới sử dụng SMT dựa trên cụm từ cho bất kỳ mục đích nào khác ngoài so sánh lịch sử về cơ bản đã chấm dứt. Moses, công cụ đã định hình cả một thập kỷ, đã chính thức nghỉ hưu.

Sự chuyển đổi diễn ra nhanh chóng một cách đáng kinh ngạc so với tiêu chuẩn của các cuộc chuyển giao mô hình học thuật — có lẽ chỉ ba đến bốn năm từ bài báo năm 2014 của Bahdanau cho đến sự thống trị gần như hoàn toàn của neural MT vào năm 2018. Đối với một nhà nghiên cứu bước vào lĩnh vực này ngày nay, SMT dựa trên cụm từ là bối cảnh lịch sử, không phải là một hướng nghiên cứu trực tiếp. Nhưng nó là bối cảnh thiết yếu, bởi vì các giả định, benchmark và thói quen đánh giá của kỷ nguyên SMT vẫn còn vang vọng trong lĩnh vực này.

---

## Phần 2: Bước ngoặt Đa ngôn ngữ (2018–2022)

### Một Mô hình, Nhiều Ngôn ngữ

Thế hệ đầu tiên của các hệ thống neural MT là **song ngữ**: một mô hình cho mỗi cặp ngôn ngữ. Anh–Pháp cần một mô hình; Pháp–Anh cần một mô hình riêng biệt. Việc mở rộng phương pháp này lên N ngôn ngữ về mặt lý thuyết đòi hỏi N×(N−1) mô hình — một nút thắt về kỹ thuật và dữ liệu đã giới hạn hiệu quả neural MT ở một số ít các cặp ngôn ngữ có nguồn tài nguyên dồi dào.

Câu hỏi định hình giai đoạn 2018–2022 là: *liệu một mô hình neural duy nhất có thể học cách dịch giữa nhiều ngôn ngữ cùng một lúc không?* Câu trả lời hóa ra là có, với những hệ quả sâu sắc và phức tạp.

### Biểu diễn Xuyên ngôn ngữ: mBERT và XLM-R

Trước khi các mô hình dịch đa ngôn ngữ xuất hiện, một khám phá bất ngờ trong các mô hình *hiểu* ngôn ngữ đã tạo tiền đề.

Vào cuối năm 2018, Google đã phát hành **Multilingual BERT (mBERT)** — một mô hình Transformer duy nhất được huấn luyện trên văn bản Wikipedia từ 104 ngôn ngữ. BERT (Bidirectional Encoder Representations from Transformers) không phải là một mô hình dịch thuật; nó là một bộ mã hóa ngôn ngữ đa mục đích, được huấn luyện để dự đoán các từ bị che khuất trong văn bản. Điều làm các nhà nghiên cứu kinh ngạc là một đặc tính nổi lên: mBERT đã phát triển các **biểu diễn xuyên ngôn ngữ** mà không hề được dạy một cách rõ ràng rằng các ngôn ngữ có liên quan với nhau. Nếu bạn fine-tune mBERT trên một tác vụ phân loại cảm xúc tiếng Anh và sau đó áp dụng nó vào văn bản tiếng Pháp — mà không có bất kỳ dữ liệu huấn luyện tiếng Pháp nào — nó vẫn hoạt động cực kỳ tốt. Hiện tượng này, được gọi là **zero-shot cross-lingual transfer** (chuyển giao xuyên ngôn ngữ zero-shot), cho thấy rằng các mô hình đa ngôn ngữ đang học một loại không gian biểu diễn chung giữa các ngôn ngữ.

Năm 2020, **Alexis Conneau** và các cộng sự tại Facebook AI Research (nay là Meta) đã đẩy điều này đi xa hơn với **XLM-R** (Cross-lingual Language Model – RoBERTa). Được huấn luyện trên 2,5 terabyte dữ liệu CommonCrawl đã được lọc qua 100 ngôn ngữ, XLM-R vượt trội đáng kể so với mBERT trên các benchmark xuyên ngôn ngữ. Nó chứng minh rằng với đủ dữ liệu và dung lượng mô hình, một bộ mã hóa duy nhất có thể xây dựng các biểu diễn đa ngôn ngữ mạnh mẽ.

Bản thân các mô hình này không phải là công cụ dịch thuật, nhưng chúng cung cấp nền tảng khái niệm và kỹ thuật cho MT đa ngôn ngữ. Nếu một mô hình có thể học các biểu diễn chung trên 100 ngôn ngữ, thì một mô hình dịch thuật cũng phải có khả năng dịch giữa chúng — ít nhất là về mặt nguyên tắc.

### Dịch thuật Many-to-Many: M2M-100

Các hệ thống MT đa ngôn ngữ truyền thống có một bí mật tồi tệ: chúng định tuyến hầu hết các bản dịch **thông qua tiếng Anh**. Dịch từ tiếng Bồ Đào Nha sang tiếng Nhật có nghĩa là trước tiên dịch tiếng Bồ Đào Nha sang tiếng Anh, sau đó từ tiếng Anh sang tiếng Nhật. Cách tiếp cận "lấy tiếng Anh làm trung tâm" này mang tính thực dụng — hầu hết dữ liệu song song đều có tiếng Anh ở một bên — nhưng nó gây ra các lỗi tích lũy và áp đặt cấu trúc tiếng Anh lên mọi bản dịch.

Vào tháng 10 năm 2020, Facebook AI đã công bố **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): một mô hình dịch thuật many-to-many bao phủ **100 ngôn ngữ và 2.200 hướng dịch** mà không cần định tuyến qua tiếng Anh. Đây là một bước đột phá về mặt khái niệm. Mô hình có thể dịch trực tiếp giữa, ví dụ, tiếng Bengal và tiếng Swahili, sử dụng dữ liệu song song được khai thác từ web cho các cặp không phải tiếng Anh.

M2M-100 đã chứng minh rằng việc lấy tiếng Anh làm trung gian không phải là một hạn chế bắt buộc của MT đa ngôn ngữ. Nhưng nó cũng bộc lộ những giới hạn của phương pháp này: chất lượng rất không đồng đều giữa các cặp ngôn ngữ, với một số hướng dịch hầu như không thể sử dụng được. Khoảng cách giữa "mô hình này *bao phủ* 2.200 hướng" và "mô hình này *hoạt động tốt* ở 2.200 hướng" sẽ trở thành một chủ đề trọng tâm.

### NLLB-200: Không Ngôn ngữ nào bị Bỏ lại phía sau

Nỗ lực MT đa ngôn ngữ tham vọng nhất của Meta đã xuất hiện vào tháng 7 năm 2022 với **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), được xuất bản dưới dạng một bài báo nghiên cứu của Meta AI với hơn 200 đồng tác giả). Mục tiêu đã được thể hiện rõ trong tên gọi: xây dựng một mô hình duy nhất hỗ trợ 200 ngôn ngữ, với sự tập trung đặc biệt vào các ngôn ngữ ít tài nguyên (low-resource) trước đây bị MT thương mại bỏ qua.

Những đóng góp kỹ thuật của NLLB-200 là rất đáng kể:

- **Kiến trúc**: Một Transformer dày đặc (dense) và một biến thể **Mixture-of-Experts (MoE)**, nơi các tập hợp con khác nhau của các tham số mô hình kích hoạt cho các cặp ngôn ngữ khác nhau. Biến thể lớn nhất, NLLB-200-MoE-54B, có 54 tỷ tham số. Một phiên bản chưng cất (distilled) 600 triệu tham số đã giúp việc triển khai trở nên khả thi.

- **Khai thác dữ liệu**: Nhóm nghiên cứu đã phát triển các công cụ tự động để khai thác các câu song song từ các bản thu thập dữ liệu web (web crawls), bao gồm một mô hình nhận dạng ngôn ngữ (bao phủ hơn 200 ngôn ngữ) và một bộ lọc câu song song. Pipeline này rất quan trọng để thu thập dữ liệu huấn luyện cho các ngôn ngữ có sự hiện diện tối thiểu trên web.

- **FLORES-200**: Một benchmark đánh giá tiêu chuẩn hóa bao phủ tất cả 200 ngôn ngữ với các câu được dịch chuyên nghiệp. FLORES-200 đã trở thành một công cụ thiết yếu cho lĩnh vực này — trước đây, không có benchmark nào tồn tại cho hầu hết các ngôn ngữ này.

- **Phát hành mã nguồn mở**: Cả mô hình và FLORES-200 đều được phát hành công khai, cho phép các nhà nghiên cứu trên toàn thế giới xây dựng dựa trên công trình này.

NLLB-200 là một cột mốc quan trọng, nhưng những hạn chế của nó cũng quan trọng không kém để hiểu rõ. Chất lượng thay đổi rất lớn giữa các ngôn ngữ. Đối với các cặp có tài nguyên dồi dào (Anh–Pháp, Anh–Trung), mô hình hoạt động tốt nhưng không phải là state-of-the-art (tiên tiến nhất) so với các hệ thống chuyên biệt. Đối với các ngôn ngữ ít tài nguyên, chất lượng đầu ra dao động từ mức hữu ích đến mức cơ bản là không hoạt động, tùy thuộc vào lượng dữ liệu huấn luyện đã được khai thác. Mô hình cũng thể hiện **lời nguyền đa ngôn ngữ (curse of multilinguality)**: việc thêm nhiều ngôn ngữ vào một mô hình có dung lượng cố định sẽ làm loãng chất lượng biểu diễn cho mỗi ngôn ngữ. Các ngôn ngữ ít tài nguyên được hưởng lợi từ transfer learning (cấu trúc chia sẻ với các ngôn ngữ liên quan), nhưng các ngôn ngữ nhiều tài nguyên thực sự có thể trở nên *tệ hơn* khi mô hình cố gắng phục vụ quá nhiều mục tiêu. Đây không chỉ đơn thuần là vấn đề mở rộng quy mô — nó phản ánh một sự căng thẳng cơ bản trong thiết kế mô hình đa ngôn ngữ.

### Bộ công cụ Seamless

Meta tiếp tục thúc đẩy MT đa ngôn ngữ với dòng mô hình **Seamless** vào năm 2023–2024. **SeamlessM4T** ("Massively Multilingual and Multimodal Machine Translation," tháng 8 năm 2023) là một mô hình duy nhất xử lý **dịch giọng nói sang giọng nói, giọng nói sang văn bản, văn bản sang giọng nói và văn bản sang văn bản** trên khoảng 100 ngôn ngữ (với mức độ bao phủ khác nhau giữa các phương thức). Điều này thể hiện sự hội tụ của các luồng nghiên cứu trước đây vốn tách biệt — nhận dạng giọng nói tự động (ASR), dịch văn bản và chuyển văn bản thành giọng nói (TTS) — thành một hệ thống đa ngôn ngữ thống nhất.

Bộ **Seamless Communication** tiếp theo đã bổ sung khả năng streaming (dịch gần như theo thời gian thực) và dịch giọng nói biểu cảm (giữ nguyên các đặc điểm thanh nhạc như cảm xúc và phong cách nói qua các ngôn ngữ). Các hệ thống này vẫn là các nguyên mẫu nghiên cứu thay vì các công cụ sẵn sàng cho sản xuất, nhưng chúng báo hiệu hướng đi của lĩnh vực này: đa phương thức, đa ngôn ngữ và thời gian thực.

### "Đa ngôn ngữ Quy mô lớn" Có ý nghĩa gì trong Thực tế

Đối với một nhà nghiên cứu bước vào lĩnh vực này, điều quan trọng là phải phân biệt giữa **độ bao phủ ngôn ngữ** của một mô hình và **chất lượng ngôn ngữ** của nó. Một mô hình "hỗ trợ 200 ngôn ngữ" có thể cung cấp các bản dịch xuất sắc cho 20 ngôn ngữ trong số đó, đầu ra có thể sử dụng được cho 50 ngôn ngữ và văn bản về cơ bản là ngẫu nhiên cho phần còn lại. Con số tiêu đề sẽ gây hiểu lầm nếu không có đánh giá chất lượng trên từng ngôn ngữ.

**Lời nguyền đa ngôn ngữ** là thuật ngữ kỹ thuật cho vấn đề pha loãng dung lượng: một mô hình với các tham số hữu hạn không thể biểu diễn tất cả các ngôn ngữ tốt như nhau. Việc thêm nhiều ngôn ngữ mang lại lợi ích cho các ngôn ngữ ít tài nguyên nhất (thông qua chuyển giao xuyên ngôn ngữ từ các ngôn ngữ liên quan) nhưng lại gây hại cho các ngôn ngữ có tài nguyên cao nhất (bằng cách tiêu thụ dung lượng lẽ ra có thể dành riêng cho chúng). Điều này tạo ra một sự căng thẳng trong thiết kế: bạn xây dựng một mô hình phổ quát duy nhất, hay nhiều mô hình chuyên biệt? Lĩnh vực này vẫn chưa giải quyết được câu hỏi đó.

---

## Phần 3: Kỷ nguyên LLM (2022–2026)

### Khi AI Đa mục đích Học cách Dịch

Sự xuất hiện của các mô hình ngôn ngữ lớn (LLM) — GPT-3.5/4, Gemini, Claude, LLaMA — đã tạo ra một tình huống kỳ lạ trong lĩnh vực MT. Các mô hình này không được huấn luyện đặc biệt cho việc dịch thuật. Chúng được huấn luyện để dự đoán token tiếp theo trong các kho văn bản khổng lồ, chủ yếu là tiếng Anh nhưng ngày càng đa ngôn ngữ. Tuy nhiên, khi được prompt với các hướng dẫn như "Dịch câu tiếng Pháp sau sang tiếng Anh," chúng tạo ra các bản dịch mà đối với các cặp ngôn ngữ nhiều tài nguyên, là tốt một cách đáng kinh ngạc.

Điều này đặt ra cho lĩnh vực một câu hỏi về bản sắc: nếu AI đa mục đích có thể dịch tốt như các hệ thống dịch thuật chuyên dụng, liệu "dịch máy" có còn là một lĩnh vực nghiên cứu riêng biệt không? Câu trả lời, tính đến năm 2026, là có với một số điều kiện — nhưng mối quan hệ giữa nghiên cứu MT và phát triển LLM đa mục đích đã trở nên đan xen sâu sắc.

### Các Benchmark Đầu tiên: LLM so với MT Chuyên dụng

Việc đánh giá có hệ thống các LLM cho dịch thuật bắt đầu vào đầu năm 2023, ngay sau khi phát hành ChatGPT (tháng 11 năm 2022) và GPT-4 (tháng 3 năm 2023).

**Jiao et al. (2023)**, trong ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745), đã cung cấp một đánh giá ban đầu. Những phát hiện của họ đã thiết lập một mô hình giữ được sự ổn định đáng kể: LLM **cạnh tranh rất cao đối với các cặp ngôn ngữ châu Âu nhiều tài nguyên** (Anh–Đức, Anh–Pháp, Anh–Trung) và **yếu hơn đáng kể đối với các cặp ít tài nguyên và có khoảng cách về loại hình ngôn ngữ**. Họ cũng giới thiệu **pivot prompting** — hướng dẫn mô hình dịch thông qua một ngôn ngữ trung gian — giúp cải thiện hiệu suất trên các cặp khó.

**Hendy et al. (2023)** tại Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) đã tiến hành một đánh giá toàn diện hơn trên 18 hướng dịch. Kết luận của họ: Các mô hình GPT sánh ngang với MT thương mại tiên tiến nhất cho các cặp nhiều tài nguyên nhưng có "khả năng hạn chế" đối với các ngôn ngữ ít tài nguyên.

Đến năm 2024–2025, bức tranh đã trở nên rõ ràng hơn. Đối với **các cặp nhiều tài nguyên**, các LLM tốt nhất (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) đã sánh ngang hoặc vượt qua các hệ thống MT chuyên dụng, đặc biệt là đối với các tác vụ đòi hỏi sự hiểu biết ngữ cảnh, diễn đạt thành ngữ và tính mạch lạc ở cấp độ tài liệu — những lĩnh vực mà neural MT truyền thống, vốn xử lý các câu một cách cô lập, luôn gặp khó khăn. Đối với **các cặp ít tài nguyên**, các mô hình đa ngôn ngữ chuyên dụng như NLLB-200 và các hệ thống được xây dựng có mục đích của Google Translate vẫn vượt trội hơn LLM, thường là đáng kể.

### BLOOM: Khoảnh khắc Đa ngôn ngữ Mở

Vào tháng 7 năm 2022, tổ chức hợp tác **BigScience** — một nỗ lực tình nguyện kéo dài một năm do Hugging Face điều phối với sự tham gia của hàng trăm nhà nghiên cứu trên toàn cầu — đã phát hành **BLOOM**: một mô hình ngôn ngữ đa ngôn ngữ truy cập mở với 176 tỷ tham số bao phủ **46 ngôn ngữ tự nhiên và 13 ngôn ngữ lập trình**. Được huấn luyện trên kho ngữ liệu ROOTS bằng siêu máy tính Jean Zay ở Pháp, BLOOM là LLM đa ngôn ngữ truy cập mở thực sự khổng lồ đầu tiên.

BLOOM không phải là một công cụ dịch thuật chuyên dụng, nhưng ý nghĩa của nó đối với MT là rất lớn. Nó chứng minh rằng các mô hình mã nguồn mở có thể hỗ trợ hàng chục ngôn ngữ ở quy mô lớn, cung cấp nền tảng cho nghiên cứu đa ngôn ngữ bên ngoài các phòng thí nghiệm của công ty. Biến thể được tinh chỉnh theo hướng dẫn (instruction-tuned) của nó, **BLOOMZ**, cho thấy khả năng tổng quát hóa xuyên ngôn ngữ — khi được fine-tune trên các tác vụ bằng một ngôn ngữ, nó có thể thực hiện chúng bằng các ngôn ngữ khác.

### LLaMA và Sự bùng nổ Fine-Tuning

Dòng **LLaMA** (Large Language Model Meta AI) của Meta, bắt đầu từ tháng 2 năm 2023, đã đi theo một con đường khác. LLaMA 1 chủ yếu lấy tiếng Anh làm trung tâm, với khả năng đa ngôn ngữ hạn chế. LLaMA 2 (tháng 7 năm 2023) cải thiện đôi chút nhưng vẫn phân loại việc sử dụng không phải tiếng Anh là "ngoài phạm vi" (out-of-scope). Điểm uốn đến với **LLaMA 3** (tháng 4 năm 2024), mở rộng dữ liệu huấn luyện lên gấp bảy lần và giới thiệu từ vựng 128.000 token — cải thiện đáng kể việc mã hóa văn bản không phải tiếng Anh. LLaMA 3 chính thức hỗ trợ tám ngôn ngữ (Anh, Đức, Pháp, Ý, Bồ Đào Nha, Hindi, Tây Ban Nha, Thái) với chất lượng khác nhau cho nhiều ngôn ngữ khác.

Tầm quan trọng của LLaMA đối với MT không nằm ở khả năng dịch trực tiếp mà nằm ở vai trò của nó như một **mô hình nền tảng (foundation model) cho fine-tuning**. Cả hai LLM dịch thuật chuyên biệt được thảo luận dưới đây — Tower và ALMA — đều được xây dựng trên LLaMA. Các trọng số mở (open weights) đã tạo ra một hệ sinh thái phát triển mạnh mẽ của các dẫn xuất chuyên biệt.

### Các LLM Dịch thuật Chuyên dụng: Tower và ALMA

Sự phát triển quan trọng nhất của năm 2023–2024 là sự xuất hiện của các LLM được fine-tune đặc biệt cho dịch thuật — các hệ thống lai kế thừa sự tinh vi về ngữ cảnh của các LLM đa mục đích nhưng được tối ưu hóa cho chất lượng dịch thuật.

**ALMA** (Advanced Language Model-based trAnslator), được phát triển bởi **Haoran Xu** và các cộng sự tại Đại học Johns Hopkins, đã chứng minh một hiểu biết sâu sắc quan trọng: bạn không cần các kho ngữ liệu song song khổng lồ để xây dựng một công cụ dịch thuật xuất sắc. ALMA đã sử dụng phương pháp **fine-tuning hai giai đoạn** trên LLaMA-2: đầu tiên, tiếp tục pre-training trên dữ liệu đơn ngữ không phải tiếng Anh để mở rộng kiến thức đa ngôn ngữ; sau đó, fine-tuning trên một tập dữ liệu song song nhỏ, chất lượng cao. Phiên bản tiếp theo, **ALMA-R** (tháng 1 năm 2024), đã giới thiệu **Contrastive Preference Optimisation (CPO)** — huấn luyện mô hình trên dữ liệu sở thích (bản dịch tốt hơn so với tệ hơn) thay vì chỉ văn bản song song. Kết quả: các mô hình 7B và 13B tham số đã sánh ngang hoặc vượt qua GPT-4 trên các benchmark dịch thuật. Bài báo đã được xuất bản tại ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Một phiên bản sau đó, **X-ALMA**, đã mở rộng phạm vi bao phủ lên 50 ngôn ngữ bằng cách sử dụng các module plug-and-play dành riêng cho từng ngôn ngữ.

**Tower**, được phát triển bởi **Unbabel** (một công ty dịch thuật AI của Bồ Đào Nha) hợp tác với SARDINE Lab và MICS Lab, đã có một cái nhìn rộng hơn. Thay vì chỉ tối ưu hóa cho dịch thuật, Tower bao phủ **toàn bộ pipeline dịch thuật**: sửa lỗi nguồn, nhận dạng thực thể có tên (NER), hậu biên tập (post-editing), xếp hạng bản dịch và phát hiện lỗi. Các mô hình Tower ban đầu (7B và 13B, dựa trên LLaMA-2) vượt trội hơn NLLB-200-54B. **Tower v2** (70B, được trình bày tại WMT 2024) vượt trội hơn GPT-4o, Claude 3.5 Sonnet và DeepL. Phiên bản mới nhất **Tower+** (2025) đã mở rộng lên 22–27 ngôn ngữ và giải quyết vấn đề "quên thảm khốc" (catastrophic forgetting) — xu hướng các mô hình được fine-tune làm mất đi các khả năng chung — thông qua tối ưu hóa sở thích và học tăng cường (reinforcement learning).

### Prompting so với Fine-Tuning: Cuộc tranh luận Đang diễn ra

Một câu hỏi dai dẳng trong không gian LLM-MT là liệu tốt hơn nên **prompt** một LLM đa mục đích để dịch (zero-shot hoặc few-shot) hay **fine-tune** một mô hình dành riêng cho dịch thuật. Bằng chứng cho thấy câu trả lời phụ thuộc vào tác vụ:

- **Prompting** bảo tồn các khả năng chung của LLM — điều hướng tính trang trọng, kiểm soát phong cách, tính mạch lạc ở cấp độ tài liệu — và không yêu cầu huấn luyện bổ sung. Nó lý tưởng cho việc lặp lại nhanh chóng và dịch thuật sáng tạo hoặc theo ngữ cảnh.
- **Fine-tuning** tạo ra độ chính xác cao hơn trên các cặp ngôn ngữ và miền cụ thể nhưng có nguy cơ làm suy giảm các khả năng khác ("quên thảm khốc"). Nó yêu cầu dữ liệu song song và tài nguyên tính toán.
- **Các phương pháp tiếp cận lai (Hybrid)** ngày càng chiếm ưu thế trong thực tế: các mô hình được fine-tune cho bản dịch ban đầu, với các bước hậu biên tập hoặc tự tinh chỉnh dựa trên LLM.

### Tình trạng Tiên tiến Hiện tại (2025–2026)

Câu trả lời trung thực cho "hệ thống MT nào là tốt nhất?" là: **còn tùy**.

| Trường hợp sử dụng | Phương pháp tốt nhất | Lý do |
|---|---|---|
| Nhiều tài nguyên, khối lượng lớn | NMT thương mại (Google, DeepL) | Tốc độ, chi phí, tính nhất quán |
| Nhiều tài nguyên, chất lượng cao | LLM (GPT-4o, Gemini 2.5 Pro) hoặc Tower+ | Hiểu ngữ cảnh, xử lý thành ngữ |
| Ít tài nguyên, độ bao phủ rộng | Meta OMT, NLLB-200, Google Translate | Độ bao phủ đa ngôn ngữ chuyên dụng |
| Ít tài nguyên, cặp ngôn ngữ cụ thể | NLLB hoặc LLM được fine-tune trên dữ liệu miền | Cải thiện chất lượng có mục tiêu |
| Nghiên cứu mã nguồn mở | Tower+, ALMA-R, X-ALMA | Trọng số mở, có thể tái tạo, cạnh tranh |

Vào tháng 3 năm 2026, Meta đã phát hành **OMT (Omnilingual Machine Translation)** — phiên bản kế nhiệm của NLLB-200, mở rộng phạm vi bao phủ từ 200 lên **hơn 1.600 ngôn ngữ**. OMT giải quyết điều mà Meta gọi là "nút thắt tạo văn bản" (generation bottleneck): các mô hình ngôn ngữ lớn có thể hiểu nhiều ngôn ngữ nhưng gặp khó khăn trong việc tạo ra văn bản trôi chảy bằng các ngôn ngữ đó. OMT có hai kiến trúc — OMT-LLaMA (chỉ có decoder, 1B–8B tham số) và OMT-NLLB (encoder-decoder) — và giới thiệu các công cụ đánh giá mới bao gồm BOUQuET và BLASER 3 (một số liệu ước tính chất lượng không cần tham chiếu). Các báo cáo ban đầu chỉ ra rằng các mô hình 1B–8B tham số sánh ngang hoặc vượt qua các baseline LLM 70B trên các tác vụ dịch thuật. Liệu OMT cuối cùng có bao gồm tiếng Plains Cree hay các ngôn ngữ Algonquian khác hay không vẫn còn phải chờ xem.

Bài báo về các phát hiện của shared task WMT 2024 có tựa đề rất phù hợp là **"Kỷ nguyên LLM Đã đến nhưng MT Vẫn chưa được Giải quyết."** LLM đã nâng cao giới hạn cho dịch thuật nhiều tài nguyên nhưng vẫn chưa giải quyết được những thách thức cơ bản của MT ít tài nguyên, tính đầy đủ của đánh giá hoặc độ phức tạp về hình thái học.

---

## Phần 4: Vấn đề Ít Tài nguyên

### Tại sao Hầu hết các Ngôn ngữ Bị Bỏ lại phía sau

Trong số khoảng 7.000 ngôn ngữ đang tồn tại trên thế giới, các dịch vụ MT thương mại được triển khai bao phủ khoảng 200 ngôn ngữ, và mọi hình thức dịch máy kết hợp lại chỉ đạt khoảng 550 ([cách chúng tôi đếm](/docs/network/context/coverage-counting)). Phần lớn các ngôn ngữ **hoàn toàn không có dịch máy**. Để hiểu tại sao, cần phải hiểu các hệ thống MT cần gì và hầu hết các ngôn ngữ thiếu gì.

Neural MT yêu cầu **dữ liệu song song**: các bộ sưu tập lớn các câu được con người dịch giữa hai ngôn ngữ. Đối với Anh–Pháp, dữ liệu này tồn tại rất phong phú — biên bản nghị viện EU (Europarl), tài liệu của Liên Hợp Quốc, kho lưu trữ tin tức và bộ nhớ dịch thuật thương mại cung cấp hàng trăm triệu câu song song. Đối với một ngôn ngữ như tiếng Plains Cree (*nêhiyawêwin*), được nói bởi khoảng 20.000 người chủ yếu ở miền tây Canada, dữ liệu như vậy về cơ bản không tồn tại. Không có biên bản của Liên Hợp Quốc bằng tiếng Plains Cree. Không có kho ngữ liệu tin tức song ngữ. Tổng số văn bản song song có sẵn có thể được đo bằng hàng nghìn câu thay vì hàng triệu.

Lĩnh vực này sử dụng các cấp độ tài nguyên sơ bộ để phân loại các ngôn ngữ:

| Cấp độ | Dữ liệu Song song Có sẵn | Ví dụ |
|---|---|---|
| Nhiều tài nguyên (High-resource) | >10 triệu cặp câu | Anh, Pháp, Đức, Trung, Tây Ban Nha |
| Tài nguyên trung bình (Medium-resource) | 1–10 triệu cặp | Thổ Nhĩ Kỳ, Việt Nam, Swahili |
| Ít tài nguyên (Low-resource) | 100K–1 triệu cặp | Yoruba, Guaraní, Maltese |
| Cực kỳ ít tài nguyên | <100K cặp | Plains Cree, Quechua, hầu hết các ngôn ngữ Bản địa |
| Về cơ bản là không có | <10K cặp | Hàng ngàn ngôn ngữ trên toàn thế giới |

### Vấn đề Tokenizer

Trước khi một mô hình neural có thể xử lý văn bản, nó phải chuyển đổi các ký tự thành các token số — một quá trình được gọi là **tokenisation** (mã hóa token). Thuật toán tokenisation thống trị là **Byte Pair Encoding (BPE)**, được phổ biến bởi Sennrich et al. (2016) và được triển khai trong các công cụ như **SentencePiece** (Kudo & Richardson, 2018). BPE hoạt động bằng cách học các chuỗi ký tự phổ biến nhất trong một kho ngữ liệu huấn luyện và xây dựng một từ vựng gồm các đơn vị từ phụ (subword). Trong tiếng Anh, các từ phổ biến như "the" trở thành các token đơn lẻ; các từ hiếm được chia thành các phần từ phụ ("unforgivable" → "un" + "forgiv" + "able").

Vấn đề là các từ vựng BPE chủ yếu được huấn luyện trên các ngôn ngữ nhiều tài nguyên, với tiếng Anh thường chiếm ưu thế. Đối với các ngôn ngữ ít tài nguyên, đặc biệt là những ngôn ngữ có hình thái phức tạp hoặc chữ viết không phải hệ Latinh, hậu quả là rất nghiêm trọng:

- **Phân đoạn quá mức (Over-segmentation)**: Một từ duy nhất trong một ngôn ngữ đa tổng hợp (polysynthetic) như tiếng Plains Cree có thể mã hóa toàn bộ một mệnh đề. Từ *nikî-nipâw* ("Tôi đã ngủ") sẽ bị chia thành nhiều mảnh — có khả năng là các byte riêng lẻ — vì thuật toán BPE chưa bao giờ thấy các chuỗi ký tự này trước đây. Những gì là một đơn vị có ý nghĩa đối với người nói lại trở thành hàng tá mảnh vô nghĩa đối với mô hình.

- **Vấn đề sinh sôi (The fertility problem)**: Một từ duy nhất trong một ngôn ngữ phức tạp về hình thái có thể yêu cầu 5–15 token, trong khi bản dịch tiếng Anh của nó sử dụng 1–3 token. Điều này tạo ra một sự bất đối xứng lớn về độ dài chuỗi làm suy giảm sự liên kết chú ý (attention alignment) và chất lượng dịch thuật.

- **Hình phạt chữ viết (Script penalties)**: Các ngôn ngữ sử dụng chữ viết không phải hệ Latinh (âm tiết Cree, Ethiopic, Devanagari) được token hóa thậm chí còn kém hiệu quả hơn, đôi khi phải lùi về các byte riêng lẻ. Điều này có nghĩa là cửa sổ ngữ cảnh hiệu quả của mô hình nhỏ hơn đáng kể đối với các ngôn ngữ này.

Đây không chỉ đơn thuần là một sự bất tiện về mặt kỹ thuật. Từ vựng của tokenizer thực sự mã hóa một sự thiên vị đối với các ngôn ngữ có nguồn tài nguyên dồi dào ở cấp độ cơ bản nhất của hệ thống. Một mô hình dành 15 token để mã hóa một từ tiếng Cree duy nhất sẽ còn lại ít dung lượng hơn nhiều để hiểu phần còn lại của câu so với một mô hình xử lý tiếng Anh, nơi cùng một thông tin đó có thể chỉ chiếm 3 token.

### Vấn đề Chất lượng Dữ liệu

Dữ liệu song song hạn chế tồn tại cho các ngôn ngữ ít tài nguyên thường đến từ **các miền hẹp**. Hai nguồn văn bản song song đa ngôn ngữ lớn nhất cho các ngôn ngữ thiếu tài nguyên là:

1. **Bản dịch Kinh thánh**: Kinh thánh đã được dịch sang hơn 700 ngôn ngữ, và một phần sang hơn 3.000 ngôn ngữ. Điều này làm cho văn bản tôn giáo trở thành nguồn tài nguyên song song có sẵn nhiều nhất cho nhiều ngôn ngữ — nhưng một mô hình được huấn luyện chủ yếu trên văn bản Kinh thánh sẽ học một ngữ vực, từ vựng và miền cụ thể. Nó có thể tạo ra "ngươi không được" (thou shalt not) nhưng không thể dịch "vui lòng đặt một chuyến bay."

2. **JW300**: Một tập dữ liệu được trích xuất từ các ấn phẩm của Nhân Chứng Giê-hô-va, bao phủ khoảng 300 ngôn ngữ. Mặc dù lớn và đa ngôn ngữ, JW300 làm dấy lên cả các vấn đề về độ lệch miền (nội dung tôn giáo) và những lo ngại về đạo đức liên quan đến nguồn gốc và sự đồng ý của các bản dịch cơ bản.

**Ô nhiễm benchmark** là một mối quan tâm nghiêm trọng khác. Khi dữ liệu song song khan hiếm, cùng một văn bản có thể xuất hiện trong cả tập huấn luyện và tập đánh giá — một sự rò rỉ dữ liệu làm thổi phồng các số liệu chất lượng. Nhóm dữ liệu càng nhỏ, điều này càng khó ngăn chặn và phát hiện.

### Tăng cường Dữ liệu: Làm được Nhiều hơn từ Ít hơn

Các nhà nghiên cứu đã phát triển các kỹ thuật để kéo giãn dữ liệu hạn chế:

- **Backtranslation (Dịch ngược)** (Sennrich et al., 2016): Huấn luyện một mô hình ban đầu trên dữ liệu song song có sẵn, sau đó sử dụng nó để dịch văn bản **đơn ngữ** của ngôn ngữ đích trở lại ngôn ngữ nguồn. Điều này tạo ra dữ liệu song song tổng hợp có nhiễu nhưng có thể cải thiện đáng kể chất lượng mô hình. Backtranslation đã trở thành một kỹ thuật tiêu chuẩn trên toàn bộ phổ tài nguyên.

- **Dữ liệu tổng hợp do LLM tạo ra**: Sử dụng các mô hình ngôn ngữ lớn để tạo dữ liệu huấn luyện cho các cặp ít tài nguyên. Điều này đầy hứa hẹn nhưng cũng mang lại rủi ro — văn bản được tạo ra có thể thể hiện "translationese" (các mẫu dịch quá sát nghĩa hoặc bị ảnh hưởng bởi ngôn ngữ nguồn) và có thể khuếch đại bất kỳ thành kiến nào tồn tại trong LLM.

- **Chuyển giao xuyên ngôn ngữ (Cross-lingual transfer)**: Huấn luyện trên dữ liệu song song từ một ngôn ngữ có tài nguyên cao hơn có liên quan (ví dụ: sử dụng dữ liệu Tây Ban Nha–Anh để khởi động MT Guaraní–Anh) và hy vọng các đặc điểm cấu trúc được chia sẻ sẽ chuyển giao. Điều này hoạt động tốt hơn đối với các ngôn ngữ có quan hệ gần gũi so với các ngôn ngữ có khoảng cách về loại hình.

- **Phân đoạn hình thái (Morphological segmentation)**: Tiền xử lý văn bản để chia các từ thành các hình vị (morphemes - đơn vị có ý nghĩa nhỏ nhất) trước khi đưa chúng vào mô hình. Đối với các ngôn ngữ chắp dính (agglutinative) và đa tổng hợp (polysynthetic), điều này có thể cải thiện đáng kể hiệu quả tokenisation và chất lượng dịch thuật. Cách tiếp cận này kết nối trực tiếp với các công cụ dựa trên quy tắc được thảo luận trong phần tiếp theo.

---

## Phần 5: Finite-State Transducers và Các Hệ thống Dựa trên Quy tắc

### Tại sao Các Quy tắc Vẫn Quan trọng

Câu chuyện cho đến nay là về sự thống trị của neural: các hệ thống thống kê được thay thế bằng mạng neural, mạng neural được thay thế bằng Transformer, Transformer được mở rộng thành LLM. Nhưng có một truyền thống song song trong ngôn ngữ học máy tính chưa bao giờ biến mất — và đối với một số ngôn ngữ nhất định, nó vẫn không thể thiếu.

**Các hệ thống dựa trên quy tắc (Rule-based systems)** mã hóa kiến thức ngôn ngữ học rõ ràng: các quy tắc hình thái, từ vựng, các mẫu chuyển giao cú pháp. Chúng không học từ dữ liệu; chúng được xây dựng bởi các nhà ngôn ngữ học hiểu rõ các ngôn ngữ liên quan. Đối với các ngôn ngữ có nguồn tài nguyên dồi dào, phương pháp này từ lâu đã bị vượt qua bởi các phương pháp dựa trên dữ liệu. Nhưng đối với các ngôn ngữ có hình thái phức tạp và dữ liệu tối thiểu, các hệ thống dựa trên quy tắc thường cung cấp phân tích đáng tin cậy duy nhất hiện có.

### Finite-State Transducers: Kiến thức Cơ bản

Một **Finite-State Transducer (FST)** là một thiết bị tính toán ánh xạ giữa hai cấp độ biểu diễn — thường là giữa một dạng bề mặt (những gì bạn thấy trong văn bản) và một phân tích cơ bản (ý nghĩa ngôn ngữ học của nó). Hãy coi nó như một cỗ máy có các trạng thái và sự chuyển đổi: nó đọc các ký hiệu đầu vào, di chuyển giữa các trạng thái và tạo ra các ký hiệu đầu ra.

Để có một ví dụ cụ thể, hãy xem xét từ tiếng Plains Cree *nikî-nipâw*. Một bộ phân tích hình thái dựa trên FST có thể lấy dạng bề mặt này và tạo ra:

> nipâw + Verb + AI + Independent + Past + 1st Person Singular

Điều này cho bạn biết từ đó là động từ *nipâw* ("ngủ") ở thể độc lập (independent order), thì quá khứ, ngôi thứ nhất số ít — "Tôi đã ngủ." Transducer mã hóa các quy tắc hình thái của tiếng Cree: tiền tố nào chỉ người, tiền tố nào đánh dấu thì, dạng động từ nào đi với mẫu biến cách nào. Quan trọng nhất, điều này hoạt động **hai chiều**: với một phân tích, FST có thể tạo ra dạng bề mặt chính xác.

Cơ sở hạ tầng kỹ thuật để xây dựng FST bao gồm:

- **HFST** (Helsinki Finite-State Transducer Technology): Một bộ công cụ mã nguồn mở được duy trì tại Đại học Helsinki, cung cấp khuôn khổ tính toán để xây dựng và chạy các transducer. HFST triển khai các hình thức ban đầu được phát triển bởi Xerox (lexc, twolc, xfst) và tương thích với **foma**, một bộ công cụ FST mã nguồn mở khác.

- **lexc**: Một hình thức để chỉ định **từ vựng (lexicon)** — kho chứa các hình vị (gốc, tiền tố, hậu tố) và các mẫu cấu tạo từ kết hợp chúng.

- **twolc**: Một hình thức để chỉ định **các quy tắc hình thái âm vị học (morphophonological rules)** — những thay đổi âm thanh xảy ra khi các hình vị kết hợp (ví dụ: sự hài hòa nguyên âm, sự biến đổi phụ âm).

### GiellaLT: Cơ sở hạ tầng Bắc Cực

**GiellaLT** (từ tiếng Bắc Sámi *giella*, "ngôn ngữ") là một cơ sở hạ tầng công nghệ ngôn ngữ có trụ sở tại **UiT — Đại học Bắc Cực của Na Uy** ở Tromsø. Nó đại diện cho nỗ lực sâu rộng nhất trên toàn thế giới nhằm xây dựng các công cụ dựa trên FST cho các ngôn ngữ bản địa và thiểu số.

Ban đầu được biết đến với tên gọi **Giellatekno** (nghiên cứu) và **Divvun** (công cụ ngôn ngữ), dự án — do các nhà ngôn ngữ học **Trond Trosterud** và **Sjur Nørstebø Moshagen** dẫn dắt — đã phát triển các bộ phân tích hình thái, công cụ kiểm tra chính tả và các công cụ ngôn ngữ khác cho hơn **100 ngôn ngữ**, tập trung vào các ngôn ngữ Sámi (Bắc Sámi, Lule Sámi, Nam Sámi và các ngôn ngữ khác), các ngôn ngữ Uralic, và các ngôn ngữ Bắc Cực và Bản địa khác.

GiellaLT sử dụng HFST làm backend tính toán và đã phát triển một cơ sở hạ tầng chia sẻ tinh vi: một hệ thống build chung, các framework kiểm thử chia sẻ và các thành phần ngôn ngữ học có thể tái sử dụng. Tất cả mã đều là mã nguồn mở, được lưu trữ trên [GitHub](https://github.com/giellalt), với hàng trăm kho lưu trữ bao gồm cơ sở hạ tầng cốt lõi và các repo dành riêng cho từng ngôn ngữ (ví dụ: `lang-sme` cho tiếng Bắc Sámi, `lang-crk` cho tiếng Plains Cree). Tài liệu của dự án nằm tại [giellalt.github.io](https://giellalt.github.io/). Cổng thông tin công cộng, **[Borealium.org](https://borealium.org)** — được tài trợ bởi Hội đồng Bộ trưởng Bắc Âu — cung cấp quyền truy cập miễn phí vào các công cụ hiệu đính, bàn phím, từ điển, công cụ học ngôn ngữ (Oahpa) và tổng hợp giọng nói cho các ngôn ngữ Sámi, Kven, Faroese, Greenlandic và các ngôn ngữ khác.

Mối quan hệ giữa GiellaLT và chính sách ngôn ngữ quốc gia rất đáng chú ý. Phần lớn kinh phí của dự án đến từ **Nghị viện Sámi Na Uy** và các chương trình ngôn ngữ của chính phủ Bắc Âu, phản ánh một cam kết chính trị đối với công nghệ ngôn ngữ Bản địa hiếm thấy về quy mô và thời lượng.

### Apertium: MT Dựa trên Quy tắc Mã nguồn mở

**[Apertium](https://www.apertium.org/)** là một nền tảng dịch máy dựa trên quy tắc mã nguồn mở, ban đầu được phát triển tại Universitat d'Alacant (Tây Ban Nha) với sự tài trợ từ chính phủ Tây Ban Nha và Catalan. Nó bắt đầu vào năm 2004 với trọng tâm là các cặp ngôn ngữ có liên quan (Tây Ban Nha–Catalan, Tây Ban Nha–Bồ Đào Nha) nơi các quy tắc chuyển giao nông (shallow transfer rules) — dịch từng từ với các điều chỉnh hình thái — tạo ra kết quả tốt một cách đáng ngạc nhiên. Những người đóng góp chính bao gồm **Francis M. Tyers**, người đóng vai trò trung tâm trong cả quá trình phát triển của Apertium và việc áp dụng nó cho các ngôn ngữ thiếu tài nguyên.

Kiến trúc của Apertium là một **pipeline** cổ điển:

1. **Phân tích hình thái** (dựa trên FST): Xác định bổ đề (lemma) và các đặc điểm hình thái của mỗi từ
2. **Khử nhập nhằng từ loại (Part-of-speech disambiguation)**: Chọn phân tích chính xác khi các từ có sự mơ hồ
3. **Chuyển giao từ vựng (Lexical transfer)**: Ánh xạ các bổ đề ngôn ngữ nguồn sang các bổ đề ngôn ngữ đích
4. **Chuyển giao cấu trúc (Structural transfer)**: Áp dụng các quy tắc để xử lý các thay đổi về trật tự từ, sự hòa hợp và các khác biệt cú pháp khác
5. **Tạo hình thái (Morphological generation)** (dựa trên FST): Tạo ra dạng bề mặt ngôn ngữ đích được biến cách chính xác

Tính đến năm 2025, Apertium hỗ trợ hàng trăm cặp ngôn ngữ ở các mức chất lượng khác nhau, tất cả đều được lưu trữ trên [GitHub](https://github.com/apertium). Nó vẫn được phát triển tích cực bởi một cộng đồng quốc tế và đặc biệt hữu ích cho các cặp ngôn ngữ có quan hệ gần gũi, nơi phương pháp dựa trên quy tắc của nó có thể đạt được chất lượng hợp lý mà không cần dữ liệu huấn luyện.

### Các Phương pháp Lai: FST + Neural

Biên giới hứa hẹn nhất cho MT ít tài nguyên có thể là **các kiến trúc lai (hybrid architectures)** kết hợp phân tích hình thái dựa trên quy tắc với dịch thuật neural. Ý tưởng rất đơn giản: sử dụng FST để phân đoạn các từ thành các hình vị (giải quyết vấn đề tokenization được mô tả trong Phần 4), sau đó đưa văn bản đã phân đoạn vào hệ thống neural MT.

Đối với một ngôn ngữ đa tổng hợp như tiếng Plains Cree, điều này có nghĩa là mô hình neural nhận được một chuỗi các đơn vị có ý nghĩa thay vì các mảnh byte tùy ý. **Phòng thí nghiệm Công nghệ Ngôn ngữ Alberta (ALT Lab)** tại Đại học Alberta, do **Antti Arppe** dẫn dắt, đã xây dựng các bộ phân tích hình thái dựa trên FST toàn diện và các công cụ từ điển hướng tới cộng đồng cho tiếng Plains Cree bằng cách sử dụng cơ sở hạ tầng GiellaLT. Công trình được công bố gần đây nhất của họ (Arppe 2025, AmericasNLP) chứng minh việc ánh xạ dựa trên FST giữa các dạng từ Cree đã biến cách và các cụm từ tiếng Anh — về cơ bản là "dịch thuật hạn chế" thông qua các phương pháp finite-state, hoạt động ở cấp độ từ/cụm từ thay vì toàn bộ câu. Đáng chú ý, ALT Lab **chưa** công bố một hệ thống MT lai FST+neural; công việc của họ dựa trên nền tảng ngôn ngữ học, dựa trên quy tắc và ưu tiên độ tin cậy cũng như tiện ích cộng đồng hơn là các phương pháp tiếp cận neural thử nghiệm. Trong khi đó, Nguyen, Hammerly và Silfverberg (2025, AmericasNLP) đã trình diễn một pipeline lai LLM+FST cho các động từ tiếng Ojibwe tại UBC, đạt được kết quả khả quan (chrF 0.82) — bản sao được công bố gần nhất với phương pháp lai cho một ngôn ngữ Algonquian.

Chiến lược lai này đại diện cho sự hội tụ của hai truyền thống đã chạy xuyên suốt lịch sử của MT: kiến thức rõ ràng của nhà ngôn ngữ học và quá trình học thống kê của kỹ sư. Đối với các ngôn ngữ cần MT nhất, không có truyền thống nào đứng một mình là đủ.

---

## Phần 6: Đo lường Chất lượng — Vấn đề Đánh giá

### Làm thế nào Bạn Biết Một Bản dịch là Tốt?

Câu hỏi này nghe có vẻ đơn giản. Trên thực tế, nó là một trong những vấn đề chưa được giải quyết khó nhất trong lĩnh vực này, và cách bạn trả lời nó quyết định hệ thống nào có vẻ "hoạt động" và hệ thống nào không.

### BLEU: Tiêu chuẩn Không hoàn hảo

Trong hơn hai thập kỷ, số liệu tự động thống trị trong MT là **BLEU** (Bilingual Evaluation Understudy), được Papineni et al. tại IBM giới thiệu vào năm 2002. BLEU đo lường mức độ trùng lặp của các chuỗi từ (n-grams) trong bản dịch máy với một hoặc nhiều bản dịch tham chiếu của con người. Nó bao gồm một hình phạt độ ngắn (brevity penalty) để ngăn các hệ thống gian lận điểm số bằng các đầu ra ngắn.

BLEU đã trở thành đơn vị tiền tệ của lĩnh vực này vì nó nhanh, rẻ, độc lập với ngôn ngữ và có thể tái tạo. Gần như mọi bài báo MT được xuất bản từ năm 2002 đến năm 2020 đều báo cáo điểm BLEU. Các shared task của WMT đã sử dụng nó làm số liệu chính trong nhiều năm.

Nhưng BLEU có những sai sót sâu sắc ngày càng trở nên rõ ràng:

- **Không hiểu ngữ nghĩa**: BLEU hoàn toàn là khớp bề mặt. Nếu một bản dịch sử dụng một từ đồng nghĩa hoàn hảo nhưng tình cờ không xuất hiện trong bản tham chiếu, BLEU sẽ phạt nó. Câu "the cat sat on the mat" sẽ bị điểm 0 so với bản tham chiếu "the feline rested on the rug."
- **Khả năng phân biệt cấp độ câu kém**: BLEU được thiết kế như một số liệu cấp độ kho ngữ liệu. Ở cấp độ câu, nó không đáng tin cậy và có nhiều nhiễu.
- **Mù hình thái**: Đối với các ngôn ngữ chắp dính (tiếng Thổ Nhĩ Kỳ, tiếng Phần Lan, tiếng Swahili), nơi một bổ đề duy nhất có thể có hàng chục dạng biến cách, việc khớp chính xác ở cấp độ từ sẽ thất bại thảm hại. Một động từ được biến cách chính xác nhưng khác một hậu tố so với bản tham chiếu sẽ bị điểm 0.
- **Tương quan yếu với đánh giá của con người**: Các phân tích tổng hợp, đáng chú ý là Reiter (2018), đã chỉ ra rằng mối tương quan của BLEU với các đánh giá chất lượng của con người thường yếu, đặc biệt là đối với các hệ thống chất lượng cao và đối với các ngôn ngữ có khoảng cách xa với tiếng Anh.

### chrF và chrF++

**chrF** (character F-score), được Maja Popović giới thiệu vào năm 2015, giải quyết vấn đề mù hình thái của BLEU bằng cách đo lường sự trùng lặp ở **cấp độ ký tự** thay vì cấp độ từ. Điều này mang lại điểm số một phần cho các thân từ và gốc từ được chia sẻ ngay cả khi các biến cách khác nhau — rất quan trọng đối với các ngôn ngữ phong phú về hình thái. **chrF++** (Popović, 2017) thêm lại các n-gram cấp độ từ, đạt được mối tương quan tốt hơn với đánh giá của con người so với các số liệu chỉ dùng ký tự hoặc chỉ dùng từ. Cả hai đều được triển khai trong **sacreBLEU**, bộ công cụ đánh giá tiêu chuẩn, và đã trở thành các số liệu phụ tiêu chuẩn trong các shared task của WMT.

### COMET và xCOMET: Đánh giá Neural

Tiến bộ đáng kể nhất trong đánh giá MT là việc chuyển sang **các số liệu neural** — các mô hình đánh giá bản thân chúng là các Transformer, được huấn luyện để dự đoán các đánh giá chất lượng của con người.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), được phát triển bởi Ricardo Rei và các cộng sự tại **Unbabel** (2020), sử dụng một bộ mã hóa xuyên ngôn ngữ (XLM-RoBERTa) để nhúng câu nguồn, bản dịch và bản tham chiếu, sau đó dự đoán điểm chất lượng. Không giống như BLEU, COMET hoạt động trong không gian ngữ nghĩa — nó nhận ra các cách diễn đạt khác (paraphrases), nắm bắt việc bảo toàn ý nghĩa và liên tục cho thấy mối tương quan cao hơn nhiều với đánh giá của con người so với các số liệu cấp độ bề mặt. COMET đã giành chiến thắng hoặc đứng đầu trong các WMT Metrics Shared Tasks từ năm 2020 trở đi.

**xCOMET** (Guerreiro et al., 2024, xuất bản trên TACL) còn tiến xa hơn: ngoài điểm chất lượng, nó tạo ra **phát hiện khoảng lỗi chi tiết (fine-grained error span detection)** — xác định các lỗi cụ thể trong bản dịch, phân loại chúng theo loại (độ chính xác, độ trôi chảy, thuật ngữ) và mức độ nghiêm trọng (nhẹ, nặng, nghiêm trọng). Điều này thu hẹp khoảng cách giữa việc chấm điểm tự động và phân tích ngôn ngữ học của con người.

### AfriCOMET: Đánh giá cho những Ngôn ngữ Ít được Phục vụ

COMET tiêu chuẩn, được huấn luyện chủ yếu trên các đánh giá của con người đối với ngôn ngữ châu Âu, có thể không tổng quát hóa tốt cho các ngôn ngữ khác biệt về loại hình. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) giải quyết vấn đề này bằng cách fine-tune trên dữ liệu đánh giá của con người từ **13 ngôn ngữ châu Phi** và sử dụng **AfroXLM-R** — một bộ mã hóa đa ngôn ngữ được huấn luyện đặc biệt để biểu diễn tốt hơn các ngôn ngữ châu Phi. Công trình này, do cộng đồng Masakhane (xem Phần 7) tạo ra, chứng minh rằng bản thân các số liệu đánh giá cũng phải được điều chỉnh cho phù hợp với sự đa dạng ngôn ngữ.

### Đánh giá của Con người: MQM và Đánh giá Trực tiếp

Các số liệu tự động chỉ là đại diện. Chân lý cơ sở (ground truth) vẫn là **đánh giá của con người**, có hai hình thức chính:

**Đánh giá Trực tiếp (Direct Assessment - DA)** yêu cầu người đánh giá chấm điểm các bản dịch trên thang điểm 0–100. Nó tương đối nhanh và rẻ (có thể sử dụng người đánh giá từ cộng đồng - crowd-sourced) và là phương pháp đánh giá chính của con người tại WMT từ năm 2017 đến năm 2020. Điểm yếu của nó: khi chất lượng MT được cải thiện, những người đánh giá không chuyên không còn có thể phân biệt giữa các hệ thống tạo ra đầu ra gần như chuyên nghiệp. DA trở nên không đáng tin cậy ở mức cao nhất của phổ chất lượng.

**Số liệu Chất lượng Đa chiều (Multidimensional Quality Metrics - MQM)** đã thay thế DA làm phương pháp đánh giá chính của con người tại WMT từ năm 2021 trở đi. MQM sử dụng **các dịch giả chuyên nghiệp**, những người đánh dấu các khoảng lỗi cụ thể trong bản dịch, phân loại lỗi theo loại (dịch sai, bỏ sót, ngữ pháp, thuật ngữ) và mức độ nghiêm trọng (nhẹ = 1 điểm, nặng = 5 điểm, nghiêm trọng = 25 điểm). Điều này tạo ra cả điểm chất lượng và thông tin chẩn đoán có thể hành động — bạn không chỉ biết bản dịch *tệ đến mức nào*, mà còn biết *cụ thể điều gì đã sai*.

| Tính năng | DA | MQM |
|---|---|---|
| Người đánh giá | Người làm việc cộng đồng (Crowd-workers) | Dịch giả chuyên nghiệp |
| Phương pháp | Điểm tổng thể 0–100 | Đánh dấu khoảng lỗi |
| Chẩn đoán | Không có | Phân loại lỗi chi tiết |
| Chi phí | Thấp hơn | Cao hơn |
| Độ tin cậy | Yếu hơn đối với MT chất lượng cao | Tiêu chuẩn vàng (Gold standard) |
| Sử dụng chính tại WMT | 2017–2020 | 2021–nay |

### Cuộc khủng hoảng Đánh giá đối với các Ngôn ngữ Ít Tài nguyên

Đối với các ngôn ngữ ít tài nguyên, vấn đề đánh giá càng trở nên phức tạp bởi một số yếu tố:

- **Không có người đánh giá đủ trình độ**: MQM yêu cầu các dịch giả chuyên nghiệp song ngữ. Đối với nhiều LRL (ngôn ngữ ít tài nguyên), việc tìm kiếm những người đánh giá như vậy là vô cùng khó khăn.
- **Không có bản dịch tham chiếu**: Cả COMET và BLEU đều yêu cầu các bản dịch tham chiếu để so sánh. Đối với nhiều miền và ngôn ngữ, chúng không tồn tại.
- **Sự thiên vị của số liệu**: Cả số liệu bề mặt và số liệu neural đều được phát triển và xác thực trên dữ liệu ngôn ngữ châu Âu. Hành vi của chúng trên các ngôn ngữ khác biệt về loại hình là không chắc chắn.
- **Rủi ro ảo giác (Hallucination)**: Trong các môi trường ít tài nguyên, các mô hình MT có thể tạo ra đầu ra trôi chảy nhưng hoàn toàn không liên quan đến nguồn — một hiện tượng được gọi là **ảo giác**. Các số liệu bề mặt có thể gán điểm khác 0 cho đầu ra ảo giác nếu nó tình cờ chia sẻ các n-gram với bản tham chiếu.

Việc xây dựng **các tập đánh giá tùy chỉnh** — thậm chí là những tập nhỏ gồm 200–500 cặp câu được tuyển chọn cẩn thận trong miền đích — là điều cần thiết cho bất kỳ nỗ lực MT ít tài nguyên nghiêm túc nào. Việc chỉ dựa vào điểm FLORES-200 hoặc BLEU mà không có đánh giá theo miền cụ thể là một công thức dẫn đến sự tự tin thái quá.

---

## Phần 7: Bối cảnh Thể chế

### Các Công ty Tham gia

Lĩnh vực MT được định hình bởi một số ít các tác nhân doanh nghiệp lớn, mỗi bên có các chiến lược riêng biệt:

**Google Translate** vẫn là hệ thống MT được sử dụng rộng rãi nhất trên toàn cầu; Cloud Translation API của họ liệt kê **194 ngôn ngữ** ([Danh sách được công bố của Google](https://docs.cloud.google.com/translate/docs/languages) — sản phẩm tiêu dùng quảng cáo nhiều hơn, nhưng Google không công bố danh sách tĩnh của bên thứ nhất cho nó). **Sáng kiến 1000 Ngôn ngữ** của Google (được công bố năm 2022) nhằm mục đích xây dựng các mô hình AI bao phủ 1.000 ngôn ngữ được nói nhiều nhất trên thế giới. Cloud Translation API cung cấp hai cấp độ: Basic (NMT cũ) và Advanced (các mô hình mới nhất). Google ngày càng tích hợp các khả năng của Gemini LLM vào Translate, với các tính năng dịch thuật thành ngữ, nhận biết ngữ cảnh xuất hiện vào năm 2025.

**Meta** đã định vị mình là động lực chính của MT đa ngôn ngữ mã nguồn mở thông qua NLLB-200, M2M-100, FLORES-200 và bộ công cụ Seamless. Triết lý phát hành mô hình mở của Meta đã mang tính biến đổi đối với nghiên cứu học thuật, cung cấp các baseline và công cụ mà nếu không có sẽ đòi hỏi tài nguyên tính toán đắt đỏ.

**DeepL** chiếm một thị trường ngách tập trung vào chất lượng, hỗ trợ khoảng **33 ngôn ngữ** — tất cả đều có nguồn tài nguyên tương đối dồi dào — với danh tiếng về đầu ra tự nhiên, mang tính thành ngữ được các dịch giả chuyên nghiệp ưa thích. Mô hình kinh doanh của DeepL (freemium cho người tiêu dùng + API trả phí cho doanh nghiệp) và tham số tính trang trọng của nó (kiểm soát ngữ vực trang trọng so với thân mật) phản ánh sự tập trung vào quy trình dịch thuật chuyên nghiệp thay vì độ bao phủ ngôn ngữ rộng.

**Microsoft Translator** (một phần của Azure AI Services) cung cấp dịch thuật trên **135 ngôn ngữ** với khả năng tích hợp doanh nghiệp thông qua Microsoft 365 và Teams. Tính năng Custom Translator của nó cho phép các tổ chức fine-tune các mô hình trên dữ liệu dành riêng cho miền.

**Unbabel** kết hợp MT với hậu biên tập của con người trong một quy trình làm việc "human-in-the-loop" (có con người tham gia), cùng với các đóng góp nghiên cứu của họ (COMET, xCOMET, Tower). Nó đại diện cho ứng dụng thương mại của mô hình "MT + con người đánh giá".

**LibreTranslate**, được xây dựng trên engine **Argos Translate**, cung cấp một giải pháp thay thế MT hoàn toàn mã nguồn mở, có thể tự lưu trữ (self-hostable) mà không phụ thuộc vào công ty — điều quan trọng đối với các tổ chức có yêu cầu về chủ quyền dữ liệu.

### Các Cộng đồng Cơ sở

Một số công việc quan trọng nhất trong MT — đặc biệt là đối với các ngôn ngữ ít được phục vụ — diễn ra trong các tổ chức nghiên cứu do cộng đồng thúc đẩy:

**[Masakhane](https://www.masakhane.io/)** (từ tiếng isiZulu có nghĩa là "chúng ta cùng nhau xây dựng") là một cộng đồng nghiên cứu cơ sở tập trung vào NLP cho các ngôn ngữ châu Phi, được thành lập vào năm 2019. Với hàng trăm thành viên trên khắp lục địa và cộng đồng hải ngoại, Masakhane đã tạo ra các tập dữ liệu nền tảng (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), các số liệu đánh giá (AfriCOMET) và các nghiên cứu đã thúc đẩy đáng kể NLP ngôn ngữ châu Phi. Các nhân vật chủ chốt bao gồm **David Ifeoluwa Adelani** (Mila / UCL). Mã và dữ liệu được lưu trữ trên [GitHub](https://github.com/masakhane-io); trung tâm giao tiếp chính là không gian làm việc Slack của họ (tham gia qua masakhane.io), với các cuộc họp cộng đồng hàng tuần. Masakhane hoạt động dựa trên các nguyên tắc về quyền sở hữu của người châu Phi đối với công nghệ ngôn ngữ châu Phi — một sự phản đối có chủ ý đối với các mô hình nghiên cứu khai thác, nơi các tổ chức bên ngoài thu thập dữ liệu từ các cộng đồng ngôn ngữ mà không có sự hợp tác có ý nghĩa. Họ công khai không khuyến khích "nghiên cứu nhảy dù" (parachute research) nơi người ngoài khai thác dữ liệu ngôn ngữ học mà không có quan hệ đối tác cộng đồng có ý nghĩa.

**AmericasNLP** là một chuỗi hội thảo (tổ chức cùng với NAACL) tập trung vào NLP cho các ngôn ngữ Bản địa của châu Mỹ. Được tổ chức bởi các nhà nghiên cứu bao gồm **Manuel Mager**, **Arturo Oncevay** và **Luis Chiruzzo**, nó chạy các shared task về MT cho các ngôn ngữ như Quechua, Guaraní, Aymara, Nahuatl, Rarámuri và các ngôn ngữ khác. Hội thảo nêu bật những thách thức nghiên cứu đặc thù của châu Mỹ — hình thái đa tổng hợp, hệ thống thanh điệu, sự khan hiếm dữ liệu cực độ và các khía cạnh chính trị của công nghệ ngôn ngữ đối với các dân tộc bị thuộc địa hóa.

**[ALT Lab](https://altlab.ualberta.ca)** (Phòng thí nghiệm Công nghệ Ngôn ngữ Alberta) tại Đại học Alberta, do **Antti Arppe** dẫn dắt, tập trung đặc biệt vào các công cụ tính toán cho tiếng Plains Cree và các ngôn ngữ Bản địa khác ở miền tây Canada. ALT Lab xây dựng các bộ phân tích hình thái dựa trên FST và các công cụ ngôn ngữ hướng tới cộng đồng (sử dụng cơ sở hạ tầng GiellaLT), và làm việc hợp tác chặt chẽ với các cộng đồng nói tiếng Cree — một mô hình phát triển công nghệ ngôn ngữ lấy cộng đồng làm trung tâm. Dự án hướng tới công chúng của họ **[21st Century Tools for Indigenous Languages](https://21c.tools)** cung cấp các từ điển trực tuyến và các công cụ hình thái được xây dựng trên cơ sở hạ tầng này.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (Hội đồng Nghiên cứu Quốc gia Canada), do **Patrick Littell** dẫn dắt, duy trì một chương trình tích cực hỗ trợ hơn 25 ngôn ngữ Bản địa trên khắp Canada, bao gồm nhiều phương ngữ Cree, Algonquin, Innu và Michif. NRC ILT đã công bố nghiên cứu MT cho Anh–Inuktitut (sử dụng kho ngữ liệu Nunavut Hansard) và phát triển các công cụ mã nguồn mở bao gồm **kiyânaw Transcribe** (phiên âm tiếng Cree và Ojibwe), các bộ phân tích hình thái và **ReadAlong Studio** (căn chỉnh âm thanh-văn bản). Tất cả mã đều là mã nguồn mở và NRC tuyên bố rõ ràng không yêu cầu bản quyền đối với dữ liệu ngôn ngữ học của cộng đồng.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) là một sáng kiến LLM đa ngôn ngữ khoa học mở với hơn 3.000 người đóng góp từ hơn 119 quốc gia. Mặc dù không phải là một hệ thống MT chuyên dụng, các mô hình Aya (Aya-101 bao phủ 101 ngôn ngữ, Aya 23 bao phủ 23 ngôn ngữ có tác động cao, Tiny Aya bao phủ 70 ngôn ngữ ở mức 3,35B tham số) rất hiệu quả cho các tác vụ dịch thuật. **Aya Collection** — 513 triệu phiên bản huấn luyện theo kiểu hướng dẫn — là tập dữ liệu hướng dẫn đa ngôn ngữ mở lớn nhất. Mô hình quản trị cộng đồng rất đáng để nghiên cứu.

**[GhanaNLP / Khaya](https://ghananlp.org)** là một sáng kiến NLP do cộng đồng thúc đẩy đã tạo ra nền tảng dịch thuật **Khaya** — một trong số ít các hệ thống MT do cộng đồng quản lý thực sự được triển khai để sử dụng hàng ngày. Khaya cung cấp dịch máy neural, ASR và TTS cho khoảng 12 ngôn ngữ Ghana (Twi, Ewe, Ga, Fante, Kusaal và các ngôn ngữ khác) thông qua web, ứng dụng di động và API dành cho nhà phát triển. Cách tiếp cận của họ — hơn 40.000 cặp câu song song được xây dựng thông qua sự hợp tác của các nhà ngôn ngữ học và phản hồi của cộng đồng — chứng minh rằng MT do cộng đồng quản lý có thể hoạt động thực tế, chứ không chỉ là khát vọng.

### Tài trợ và Chính sách

Nghiên cứu MT cho các ngôn ngữ ít tài nguyên phụ thuộc vào các luồng tài trợ khá khác biệt so với vốn đầu tư mạo hiểm và doanh thu quảng cáo duy trì MT thương mại:

- **Lacuna Fund**: Một quỹ dữ liệu hợp tác được hỗ trợ bởi Quỹ Rockefeller, Google.org, IDRC của Canada và GIZ của Đức. Lacuna đặc biệt tài trợ cho việc tạo ra **các tập dữ liệu được gắn nhãn** cho các ngôn ngữ ít được đại diện — lấp đầy khoảng trống dữ liệu vốn là nguyên nhân gốc rễ của khoảng cách chất lượng MT.

- **AI4D** (Artificial Intelligence for Development): Một chương trình hỗ trợ các học bổng nghiên cứu AI cho công nghệ ngôn ngữ châu Phi, được điều hành thông qua IDRC và Cơ quan Hợp tác Phát triển Quốc tế Thụy Điển.

- **Thập kỷ Quốc tế về Ngôn ngữ Bản địa của UNESCO (2022–2032)**: Một khuôn khổ chính trị đã nâng cao vị thế của công nghệ ngôn ngữ Bản địa trên toàn cầu, mặc dù kinh phí nghiên cứu cụ thể vẫn còn khiêm tốn.

- **Ngân hàng Phát triển Liên Mỹ (Inter-American Development Bank)**: Đã tài trợ cho dự án **GuaranIA** về MT Guaraní–Tây Ban Nha ở Paraguay, một ví dụ về tài chính phát triển hỗ trợ công nghệ ngôn ngữ.

- **Các hội đồng nghiên cứu quốc gia**: Phần lớn công việc MT ít tài nguyên được tài trợ thông qua các kênh học thuật tiêu chuẩn (NSF, NSERC, các chương trình Horizon của EU), thường là các thành phần của các khoản tài trợ AI hoặc ngôn ngữ học rộng lớn hơn.

---

## Phần 8: Những Biên giới Mở

### Những gì Vẫn chưa được Giải quyết

Lĩnh vực MT vào năm 2026 đồng thời có khả năng cao hơn và trung thực hơn về những hạn chế của nó so với bất kỳ thời điểm nào trước đây. Một số vấn đề biên giới xác định bối cảnh nghiên cứu hiện tại:

**Dịch thuật cấp độ tài liệu** phần lớn vẫn chưa được giải quyết. Hầu hết các hệ thống MT — bao gồm nhiều LLM — dịch từng câu một, làm mất đi tính mạch lạc của diễn ngôn, việc giải quyết đại từ qua các ranh giới câu và tính nhất quán về phong cách. Một dịch giả con người đọc toàn bộ tài liệu trước khi dịch; hầu hết các hệ thống MT xử lý các câu một cách cô lập. Nghiên cứu về MT cấp độ tài liệu đang hoạt động tích cực nhưng vẫn chưa tạo ra các hệ thống duy trì độ mạch lạc một cách đáng tin cậy trên các văn bản dài.

**Diễn ngôn và ngữ dụng học (Discourse and pragmatics)** — khoảng cách giữa nghĩa đen và ý định giao tiếp — tiếp tục thách thức MT. Sự mỉa mai, nói giảm nói tránh, ám chỉ văn hóa và độ nhạy cảm về ngữ vực (trang trọng so với thân mật, tôn trọng so với suồng sã) được các LLM tốt nhất nắm bắt một phần nhưng không nhất quán. Một dịch giả làm việc giữa tiếng Nhật và tiếng Anh phải điều hướng một hệ thống kính ngữ phức tạp; các hệ thống MT hiện tại xử lý điều này tốt nhất là không đồng đều.

**Dịch thuật đa phương thức** — dịch trong ngữ cảnh với hình ảnh, video hoặc âm thanh — là một lĩnh vực nghiên cứu mới nổi. Một món trong thực đơn được mô tả là "trứng cá chuồn" (flying fish roe) hoàn toàn có ý nghĩa với một hình ảnh đi kèm; nếu không có nó, MT có thể tạo ra một thứ gì đó kỳ lạ. Bộ công cụ Seamless và các LLM đa phương thức (Gemini, GPT-4o) đã bắt đầu giải quyết vấn đề này, nhưng MT đa phương thức mạnh mẽ vẫn là một biên giới.

**Dịch giọng nói sang giọng nói theo thời gian thực** với độ trễ tự nhiên (độ trễ dưới 3 giây), bảo tồn danh tính người nói và chuyển giao tông giọng cảm xúc đang tiến gần đến mức sẵn sàng sản xuất cho các cặp nhiều tài nguyên. Google, Meta và một số công ty khởi nghiệp đã trình diễn các hệ thống nguyên mẫu vào năm 2025. Đối với các ngôn ngữ ít tài nguyên, dịch giọng nói theo thời gian thực vẫn còn xa vời.

**"Dặm cuối" cho các ngôn ngữ ít tài nguyên** có lẽ là vấn đề chưa được giải quyết quan trọng nhất của lĩnh vực này. Khoảng cách giữa điểm benchmark FLORES-200 và tiện ích thực tế cho một cộng đồng ngôn ngữ là rất lớn. Một mô hình đạt 15 điểm BLEU cho bản dịch tiếng Plains Cree–Anh không hữu ích cho bất kỳ mục đích thực tế nào. Việc thu hẹp khoảng cách này không chỉ đòi hỏi các mô hình tốt hơn mà còn cần dữ liệu tốt hơn, đánh giá tốt hơn, tokenisation tốt hơn và — quan trọng nhất — sự hợp tác thực sự với các cộng đồng ngôn ngữ thay vì khai thác tài nguyên ngôn ngữ học cho các ấn phẩm học thuật.

**Hậu biên tập và sự hợp tác giữa con người-AI** đang trở thành mô hình thống trị cho dịch thuật chuyên nghiệp. Thay vì thay thế các dịch giả con người, MT ngày càng được định vị như một công cụ tạo bản nháp đầu tiên mà sau đó các dịch giả con người sẽ tinh chỉnh. Hiểu biết về khoa học nhận thức của hậu biên tập, đo lường nỗ lực hậu biên tập và thiết kế các giao diện hỗ trợ sự hợp tác giữa con người-AI là những lĩnh vực nghiên cứu tích cực với những tác động thương mại trực tiếp.

### Các Khía cạnh Chính trị

MT không trung lập về mặt chính trị. Việc lựa chọn hỗ trợ ngôn ngữ nào, thu thập dữ liệu nào, ai kiểm soát các mô hình và tiêu chuẩn chất lượng của ai được áp dụng đều là những quyết định mang lại hậu quả đáng kể cho các cộng đồng ngôn ngữ.

Sự thống trị của tiếng Anh như một ngôn ngữ trung gian mã hóa một quan điểm cụ thể về dịch thuật như một thứ gì đó chảy qua tiếng Anh. Việc sử dụng Kinh thánh và các văn bản truyền giáo làm dữ liệu huấn luyện cho các ngôn ngữ Bản địa làm dấy lên các câu hỏi về sự đồng ý và sự phù hợp về mặt văn hóa. Sự tập trung khả năng MT vào một số ít các công ty ở Thung lũng Silicon tạo ra các mối quan hệ phụ thuộc mà một số cộng đồng ngôn ngữ công khai phản đối.

**Chủ quyền dữ liệu** là một mối quan tâm trọng tâm. Tại Canada, các nguyên tắc **chủ quyền dữ liệu của First Nations** — do chính các cộng đồng First Nations trình bày — khẳng định rằng các cộng đồng Bản địa sở hữu dữ liệu của họ, kiểm soát cách nó được thu thập và sử dụng, có quyền truy cập vào nó và sở hữu nó về mặt vật lý. Đối với MT, điều này có nghĩa là dữ liệu huấn luyện bắt nguồn từ các văn bản ngôn ngữ Bản địa, các kho ngữ liệu đánh giá được xây dựng từ kiến thức cộng đồng và các mô hình dịch thuật được huấn luyện trên các tài nguyên do cộng đồng nắm giữ đều thuộc quyền quản trị của cộng đồng — không phải quyền quản trị của bất kỳ tổ chức nghiên cứu hay công ty công nghệ nào đã xây dựng mô hình.

Điều này có những tác động kỹ thuật trực tiếp. Một hệ thống MT được xây dựng bằng dữ liệu cộng đồng không thể đơn giản là mã nguồn mở theo nghĩa thông thường nếu cộng đồng chưa đồng ý với điều đó. Các benchmark đánh giá không thể được công bố nếu dữ liệu kiểm tra bao gồm các tài liệu nhạy cảm về mặt văn hóa. Một "mô hình thuộc sở hữu của cộng đồng" không phải là một sự mâu thuẫn — nó là một yêu cầu thiết kế. Bất kỳ nỗ lực nghiêm túc nào trong MT ít tài nguyên cho các ngôn ngữ Bản địa đều phải hướng tới chủ quyền dữ liệu theo mặc định, chứ không phải là một suy nghĩ muộn màng.

Đây không chỉ đơn thuần là những chú thích về đạo đức — chúng định hình các ưu tiên nghiên cứu, quyết định tài trợ và kiến trúc kỹ thuật. "Xây dựng MT tốt hơn" không thể tách rời khỏi các câu hỏi về ai được hưởng lợi, ai quyết định và kiến thức ngôn ngữ học của ai được coi trọng.

---

## Phụ lục A: Các bài báo chính

Một danh sách đọc theo trình tự thời gian của các bài báo đã định hình quỹ đạo của lĩnh vực này. Mỗi mục bao gồm một ghi chú ngắn gọn về lý do tại sao nó quan trọng.

| Năm | Bài báo | Tác giả | Ý nghĩa |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Thiết lập số liệu đánh giá MT thống trị trong hai thập kỷ |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Chứng minh dịch thuật encoder-decoder neural |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Giới thiệu cơ chế attention |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Đưa neural MT vào quy mô sản xuất |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Giới thiệu tokenisation BPE cho MT |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Giới thiệu backtranslation để tăng cường dữ liệu |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Giới thiệu kiến trúc Transformer |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: biểu diễn xuyên ngôn ngữ cho 100 ngôn ngữ |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: many-to-many không cần tiếng Anh làm trung gian |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Số liệu đánh giá neural có tương quan cao với con người |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | NLLB Team (Meta) | Mô hình MT 200 ngôn ngữ + benchmark FLORES-200 |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | Fine-tuning LLM cho dịch thuật SOTA với dữ liệu nhỏ |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Toàn bộ pipeline dịch thuật trong một LLM duy nhất |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Phát hiện lỗi chi tiết trong đánh giá MT |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | Đánh giá MT được điều chỉnh cho các ngôn ngữ châu Phi |

---

## Phụ lục B: Các Hội nghị và Cộng đồng

### Các Hội nghị Lớn

Hệ sinh thái hội nghị NLP/MT tuân theo nhịp độ hàng năm. Bảng dưới đây liệt kê các địa điểm chính, tiếp theo là ngày tháng của các phiên bản gần đây.

| Hội nghị | Tên đầy đủ | Tần suất | Ghi chú |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Hàng năm | Địa điểm cạnh tranh chính của lĩnh vực; các shared task xác định các benchmark |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Hàng năm | Hội nghị NLP hàng đầu |
| **EMNLP** | Empirical Methods in NLP | Hàng năm | Hội nghị hàng đầu thứ hai; thường tổ chức WMT |
| **NAACL** | North American Chapter of the ACL | Hàng năm (luân phiên với ACL) | Hội nghị khu vực lớn |
| **EACL** | European Chapter of the ACL | Hai năm một lần | Hội nghị khu vực châu Âu |
| **COLING** | Intl. Conf. on Computational Linguistics | Hai năm một lần | Đã được sáp nhập với LREC cho năm 2024; hiện đã tách riêng trở lại |
| **LREC** | Language Resources & Evaluation Conference | Hai năm một lần | Tập trung vào dữ liệu, tài nguyên và đánh giá |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Hàng năm | Tập trung vào dịch giọng nói |

#### Các Phiên bản Gần đây

*Chỉ có ngày tháng — một cách có chủ ý. Một cột "trạng thái" ghi **Sắp diễn ra** sẽ sai vào ngày sự kiện bắt đầu, và trang này không thể biết ngày hôm nay là ngày nào. Hãy tự so sánh các ngày dưới đây với lịch; kỷ yếu cho bất kỳ sự kiện nào đã được tổ chức đều có trên [ACL Anthology](https://aclanthology.org).*

| Sự kiện | Ngày tháng | Địa điểm |
|---|---|---|
| **COLING 2025** | 19–24 tháng 1, 2025 | Abu Dhabi, UAE |
| **EACL 2026** | 24–29 tháng 3, 2026 | Rabat, Morocco |
| **LREC 2026** | 11–16 tháng 5, 2026 | Palma de Mallorca, Tây Ban Nha |
| **ACL 2026** | 2–7 tháng 7, 2026 | San Diego, Mỹ |
| **AmericasNLP 2026** | 3–4 tháng 7, 2026 (tổ chức cùng ACL) | San Diego, Mỹ |

*ACL 2025 (Vienna), EMNLP 2025 (Tô Châu), WMT 2025 (Tô Châu), IWSLT 2025 (Vienna) và PACLIC 39 (Hà Nội) đều diễn ra vào năm 2025. Kỷ yếu của chúng có sẵn trên [ACL Anthology](https://aclanthology.org).*

#### Các Shared Task của WMT 2025

Các shared task của WMT là thứ gần gũi nhất mà lĩnh vực MT có được như một cuộc thi công khai. Phiên bản năm 2025 bao gồm:

- **General Machine Translation** — tác vụ hàng đầu
- **Automated Translation Evaluation Systems** — các số liệu thống nhất và ước tính chất lượng
- **Low-Resource Indic Language Translation**
- **Creole Language Translation**
- **Terminology Shared Task**
- **Model Compression** — làm cho các mô hình MT nhỏ hơn và nhanh hơn
- **Open Language Data** — cải thiện dữ liệu huấn luyện mở
- **Multilingual Instruction Shared Task (MIST)**
- **Limited Resources Slavic LLMs**

### Các Hội thảo Chuyên đề

| Hội thảo | Trọng tâm | Phiên bản Gần nhất Được biết | Tổ chức cùng với |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Các ngôn ngữ Bản địa của châu Mỹ | 3–4 tháng 7, 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP ngôn ngữ châu Phi | 31 tháng 7, 2025 (ACL 2025, Vienna) | ACL / ICLR |
| **LoResMT** | MT ít tài nguyên | Thường là hàng năm tại các hội nghị *ACL | Khác nhau |
| **SIGTYP** | ACL SIG về Loại hình học Ngôn ngữ | Hội thảo hàng năm | ACL |

### Các Tài nguyên Cộng đồng Chính

- **[machinetranslate.org](https://machinetranslate.org)** — Cơ sở kiến thức mã nguồn mở, do cộng đồng thúc đẩy về công nghệ MT. Được điều hành bởi Machine Translate Foundation (tổ chức phi lợi nhuận, Zug, Thụy Sĩ, thành lập năm 2021). Bao gồm các phương pháp tiếp cận, API, mô hình, hỗ trợ ngôn ngữ và tin tức trong ngành. Được cấp phép CC BY-SA 4.0. Một điểm khởi đầu tuyệt vời cho bất kỳ chủ đề nào trong bản tóm tắt này.

- **[ACL Anthology](https://aclanthology.org)** — Kho lưu trữ truy cập mở dứt khoát của các bài báo nghiên cứu NLP/CL. Mọi bài báo tại ACL, EMNLP, NAACL, EACL, WMT và các địa điểm liên quan đều có sẵn miễn phí tại đây.

---

## Phụ lục C: Công cụ, Tập dữ liệu và Tài nguyên Thực tế

Phụ lục này bao gồm các công cụ và nguồn dữ liệu cụ thể quan trọng trong công việc MT ngày nay. Nó được viết cho những người biết cách sử dụng terminal nhưng có thể không biết về hệ sinh thái MT.

### Các Framework Huấn luyện

Đây là các gói phần mềm được sử dụng để *huấn luyện* các mô hình neural MT từ đầu (hoặc fine-tune các mô hình hiện có). Bạn sẽ sử dụng chúng nếu bạn đang xây dựng mô hình dịch thuật của riêng mình thay vì sử dụng một mô hình hiện có thông qua API.

| Framework | Nhà phát triển | Ngôn ngữ | Ghi chú |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Edinburgh | C++ | Trình huấn luyện NMT mã nguồn mở nhanh nhất — có thể huấn luyện một mô hình nhanh hơn 3–5 lần so với các giải pháp thay thế dựa trên PyTorch. Được viết bằng C++ thuần túy với các phụ thuộc tối thiểu. Cung cấp sức mạnh cho Microsoft Translator. Mọi mô hình OpusMT (xem bên dưới) đều được huấn luyện bằng nó. Được đặt theo tên của Marian Rejewski, nhà toán học người Ba Lan đã giúp giải mã Enigma. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | Bộ công cụ nghiên cứu chủ lực của Meta — được sử dụng để xây dựng M2M-100, NLLB-200 và hầu hết các công trình MT được công bố của Meta. Tính mô-đun cao: bạn có thể hoán đổi các kiến trúc, hàm mất mát (loss functions) và xử lý dữ liệu. Sự lựa chọn tiêu chuẩn cho các nhà nghiên cứu tái tạo hoặc mở rộng công trình của Meta. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | Điểm khởi đầu dễ tiếp cận nhất để huấn luyện các mô hình MT tùy chỉnh. Bắt nguồn từ một dự án nghiên cứu của Harvard, hiện được duy trì bởi SYSTRAN (một công ty MT thương mại). Bao gồm CTranslate2 để triển khai (xem bên dưới). Tài liệu tốt cho người mới bắt đầu. |

**Khi nào bạn sẽ sử dụng chúng?** Nếu bạn có dữ liệu song song (thậm chí chỉ vài nghìn cặp câu) và muốn huấn luyện hoặc fine-tune một mô hình dịch thuật chuyên dụng cho một cặp ngôn ngữ cụ thể. Bạn sẽ KHÔNG sử dụng chúng cho dịch thuật dựa trên LLM (prompting GPT/Claude/Gemini), vốn không yêu cầu huấn luyện — chỉ cần gọi API.

### Suy luận và Triển khai (Inference and Deployment)

Các công cụ này chạy các mô hình *đã được huấn luyện* để tạo ra các bản dịch. Hãy coi các framework huấn luyện ở trên như "xưởng nơi chiếc xe được chế tạo" và những công cụ này như "chìa khóa điện để khởi động chiếc xe."

| Công cụ | Chức năng | Khi nào nên sử dụng |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Một engine C++ chạy các mô hình Transformer ở tốc độ cao với bộ nhớ thấp. Hỗ trợ lượng tử hóa (quantisation) INT8/INT4 (thu nhỏ mô hình xuống 1/4 kích thước với mức giảm chất lượng tối thiểu). Chạy trên CPU hoặc GPU mà không cần cài đặt PyTorch. Hỗ trợ NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Khi bạn muốn tự lưu trữ (self-host) một mô hình dịch thuật trên máy chủ hoặc máy tính xách tay mà không cần cụm GPU. Lựa chọn hàng đầu để triển khai sản xuất các mô hình MT mã nguồn mở. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Thư viện Python tải và chạy các mô hình với một vài dòng mã: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Cung cấp ~1.500 mô hình song ngữ OpusMT đã được huấn luyện trước cộng với NLLB-200, mBART, mT5 và M2M-100. | Khi bạn muốn con đường nhanh nhất từ "Tôi muốn dịch một cái gì đó" đến mã hoạt động. Hai dòng Python và bạn đang dịch. Thông lượng thấp hơn CTranslate2 nhưng dễ thiết lập hơn nhiều. |

### Các Dòng Mô hình Đã được Huấn luyện trước (Pre-Trained)

Đây là các mô hình dịch thuật *đã được huấn luyện* mà bạn có thể tải xuống và sử dụng ngay lập tức. Không cần huấn luyện — chỉ cần tải và dịch.

| Dòng Mô hình | Ngôn ngữ | Nhà phát triển | Mô tả | Nơi tìm thấy |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | Hơn 1.000 cặp | Đại học Helsinki (Jörg Tiedemann) | Bộ sưu tập lớn nhất các mô hình dịch thuật song ngữ mã nguồn mở. Mỗi mô hình xử lý một cặp ngôn ngữ (ví dụ: `opus-mt-en-fr` cho Anh→Pháp). Được huấn luyện trên dữ liệu OPUS bằng Marian NMT, được chuyển đổi sang định dạng PyTorch cho Hugging Face. Chất lượng khác nhau — xuất sắc cho các cặp nhiều tài nguyên, kém cho các cặp ít tài nguyên. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 ngôn ngữ | Meta | Một mô hình đa ngôn ngữ duy nhất dịch giữa bất kỳ ngôn ngữ nào trong số 200 ngôn ngữ. Có sẵn ở các biến thể 600M, 1.3B và 3.3B tham số. Phiên bản 600M chạy trên máy tính xách tay; phiên bản 3.3B cần một GPU tốt. Chất lượng thay đổi rất lớn — mạnh đối với tài nguyên trung bình, thường kém đối với các ngôn ngữ thực sự ít tài nguyên. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 ngôn ngữ | Meta | Phiên bản tiền nhiệm của NLLB-200 — mô hình đầu tiên dịch trực tiếp giữa các cặp không phải tiếng Anh (ví dụ: Bengali↔Swahili) mà không cần định tuyến qua tiếng Anh. Quan trọng về mặt lịch sử; phần lớn đã được thay thế bởi NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 ngôn ngữ | Unbabel | Không chỉ là một công cụ dịch thuật — xử lý toàn bộ pipeline dịch thuật (sửa lỗi, NER, hậu biên tập, ước tính chất lượng) trong một LLM duy nhất. Được fine-tune từ LLaMA. Tính đến năm 2025, Tower v2 (70B) vượt trội hơn GPT-4o và DeepL trên một số benchmark. | Hugging Face |
| **ALMA / X-ALMA** | 50 ngôn ngữ | Đại học Johns Hopkins | Các mô hình dựa trên LLaMA được fine-tune đặc biệt cho dịch thuật bằng cách sử dụng tối ưu hóa sở thích (dạy mô hình bản dịch nào con người thích hơn). Các phiên bản 7B và 13B sánh ngang với chất lượng GPT-4 trên các cặp nhiều tài nguyên. X-ALMA mở rộng lên 50 ngôn ngữ với các module adapter dành riêng cho từng ngôn ngữ. | Hugging Face |

### Các Nguồn Dữ liệu Song song

Dữ liệu song song là nhiên liệu để huấn luyện các mô hình MT: các bộ sưu tập câu bằng hai ngôn ngữ là bản dịch của nhau, được căn chỉnh theo từng dòng. Nếu không có dữ liệu song song, bạn không thể huấn luyện một mô hình MT thông thường. (Dịch thuật dựa trên LLM tránh được điều này — bạn có thể prompt GPT để dịch mà không cần bất kỳ dữ liệu song song nào — nhưng các mô hình chuyên dụng vẫn cần nó.)

| Tập dữ liệu | Quy mô | Mô tả | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | Hơn 100 tỷ cặp câu, hơn 1.000 ngôn ngữ | Nguồn tài nguyên quan trọng nhất cho dữ liệu MT. Một bộ sưu tập meta tổng hợp hàng chục kho ngữ liệu phụ (xem bên dưới) vào một cổng thông tin có thể tìm kiếm. Được tạo ra và duy trì bởi Jörg Tiedemann tại Đại học Helsinki. Nếu bạn đang tìm kiếm dữ liệu song song bằng bất kỳ ngôn ngữ nào, OPUS là nơi bạn bắt đầu. Có thể truy cập qua cổng thông tin web, gói Python `opustools` và Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60 triệu từ/ngôn ngữ, 21 ngôn ngữ EU | Biên bản Nghị viện Châu Âu — các bài phát biểu của các chính trị gia được dịch sang tất cả các ngôn ngữ chính thức của EU. Được tạo bởi Philipp Koehn. Nền tảng về mặt lịch sử (tập dữ liệu đã làm cho nghiên cứu SMT trở nên khả thi), nhưng giới hạn ở các ngôn ngữ EU và ngữ vực nghị viện. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Hàng tỷ cặp, hơn 29 cặp ngôn ngữ | Dự án do EU tài trợ thu thập dữ liệu web để tìm văn bản song song xuất hiện tự nhiên (các trang web song ngữ, các trang được dịch). Nhiều nhiễu hơn nhiều so với các kho ngữ liệu được tuyển chọn nhưng lớn hơn rất nhiều. Đã phát hành pipeline thu thập dữ liệu mã nguồn mở **Bitextor**, mà bất kỳ ai cũng có thể sử dụng để khai thác dữ liệu song song của riêng họ từ web. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392 triệu cặp URL, 137 hướng ghép với tiếng Anh | Các tài liệu song song được khai thác trên web từ Common Crawl (Meta/JHU). Đặc biệt hữu ích cho các ngôn ngữ có tài nguyên từ thấp đến trung bình không xuất hiện trong các kho ngữ liệu được tuyển chọn. Chất lượng thấp hơn Europarl nhưng độ bao phủ rộng hơn nhiều. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135 triệu câu song song, 1.620 cặp | Các câu song song được khai thác tự động từ Wikipedia bằng cách sử dụng các embedding đa ngôn ngữ LASER (Meta). Hữu ích vì Wikipedia tồn tại bằng nhiều ngôn ngữ — nhưng việc căn chỉnh là tự động (không được con người xác minh), vì vậy một số cặp có nhiễu hoặc sai. | GitHub (LASER repo) |
| **[Tatoeba](https://tatoeba.org)** | Hơn 500 ngôn ngữ | Một bộ sưu tập các câu ví dụ và bản dịch của chúng do cộng đồng duy trì, được đóng góp bởi các tình nguyện viên trên toàn thế giới. Các câu riêng lẻ, không phải tài liệu. **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** (Helsinki-NLP) liên quan cung cấp các phần chia train/test sạch cho hàng ngàn cặp ngôn ngữ — được sử dụng để huấn luyện các mô hình OpusMT. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 ngôn ngữ | Một benchmark đánh giá tiêu chuẩn hóa (KHÔNG PHẢI dữ liệu huấn luyện). Các câu được dịch chuyên nghiệp được sử dụng để so sánh các hệ thống trên một sân chơi bình đẳng. Được tạo bởi Meta cùng với NLLB-200. Nếu bạn muốn so sánh hệ thống của mình với các baseline đã được công bố, đây là tập kiểm tra nên sử dụng. | Hugging Face |

### Các Kho ngữ liệu phụ Chính trong OPUS

OPUS tổng hợp nhiều kho ngữ liệu song song độc lập. Khi tìm kiếm dữ liệu bằng một ngôn ngữ cụ thể, các bộ sưu tập phụ này rất đáng để kiểm tra:

- **OpenSubtitles** — Phụ đề phim và truyền hình. Khối lượng khổng lồ nhưng có nhiễu — phụ đề thường được đơn giản hóa, không trang trọng và có thể chứa lỗi phiên âm.
- **JW300** — Các ấn phẩm của Nhân Chứng Giê-hô-va, bao phủ ~300 ngôn ngữ. Độ bao phủ ngôn ngữ rộng nhất so với bất kỳ kho ngữ liệu đơn lẻ nào, nhưng bị lệch miền nặng nề về nội dung tôn giáo và gây tranh cãi về mặt đạo đức (xem Phần 4).
- **Bible** — Các bản dịch Kinh thánh bằng hơn 700 ngôn ngữ. Miền hẹp nhất trong tất cả (văn bản tôn giáo cổ đại), nhưng đối với nhiều ngôn ngữ, đây là văn bản song song duy nhất tồn tại.
- **Tanzil** — Các bản dịch Kinh Quran. Hữu ích cho dữ liệu ghép với tiếng Ả Rập.
- **GNOME / KDE** — Các chuỗi bản địa hóa phần mềm ("File → Save", "Are you sure you want to delete?"). Hữu ích cho miền kỹ thuật/UI nhưng rất rập khuôn.
- **EMEA** — Các tài liệu của Cơ quan Quản lý Dược phẩm Châu Âu. Hữu ích cho dịch thuật miền y sinh.

---

## Phụ lục D: Thuật ngữ

**Attention mechanism (Cơ chế chú ý)**: Một thành phần mạng neural cho phép mô hình tập trung động vào các phần khác nhau của đầu vào khi tạo ra từng phần của đầu ra. Được giới thiệu bởi Bahdanau et al. (2014) cho MT; được tổng quát hóa trong Transformer (2017).

**Backtranslation (Dịch ngược)**: Một kỹ thuật tăng cường dữ liệu trong đó văn bản đơn ngữ của ngôn ngữ đích được dịch ngược lại ngôn ngữ nguồn bởi một hệ thống MT sơ bộ, tạo ra dữ liệu song song tổng hợp để huấn luyện.

**BLEU**: Bilingual Evaluation Understudy. Một số liệu đánh giá MT tự động dựa trên sự trùng lặp độ chính xác của n-gram với các bản dịch tham chiếu.

**BPE (Byte Pair Encoding)**: Một thuật toán tokenisation từ phụ (subword) lặp đi lặp lại việc hợp nhất các cặp ký tự thường xuyên nhất để xây dựng một từ vựng. Được sử dụng trong hầu hết các hệ thống NMT và LLM hiện đại.

**COMET**: Một số liệu đánh giá MT neural sử dụng các embedding xuyên ngôn ngữ để dự đoán các đánh giá chất lượng của con người, hoạt động trên nguồn + giả thuyết + tham chiếu.

**Curse of multilinguality (Lời nguyền đa ngôn ngữ)**: Hiện tượng trong đó việc thêm nhiều ngôn ngữ vào một mô hình đa ngôn ngữ làm loãng chất lượng trên mỗi ngôn ngữ do dung lượng mô hình cố định.

**Encoder–decoder**: Một kiến trúc neural trong đó một bộ mã hóa (encoder) xử lý chuỗi đầu vào thành các biểu diễn, và một bộ giải mã (decoder) tạo ra chuỗi đầu ra từ các biểu diễn đó.

**FLORES-200**: Một benchmark đánh giá MT tiêu chuẩn hóa bao phủ 200 ngôn ngữ, được tạo bởi Meta cùng với NLLB-200.

**FST (Finite-State Transducer)**: Một thiết bị tính toán ánh xạ giữa các chuỗi ký hiệu đầu vào và đầu ra bằng cách sử dụng các trạng thái và sự chuyển đổi. Được sử dụng trong hình thái học tính toán để phân tích và tạo ra các dạng từ.

**Hallucination (Ảo giác)**: Trong MT, việc tạo ra đầu ra trôi chảy nhưng không liên quan hoặc không trung thành với văn bản nguồn. Đặc biệt phổ biến trong các môi trường ít tài nguyên.

**High-resource language (Ngôn ngữ nhiều tài nguyên)**: Một ngôn ngữ có văn bản kỹ thuật số và dữ liệu dịch song song phong phú (thường >10 triệu cặp câu với tiếng Anh). Ví dụ: Pháp, Đức, Trung, Tây Ban Nha.

**LLM (Large Language Model - Mô hình Ngôn ngữ Lớn)**: Một mô hình ngôn ngữ neural với hàng tỷ tham số, được huấn luyện trên các kho văn bản khổng lồ để dự đoán token tiếp theo. Ví dụ: GPT-4, Gemini, LLaMA, Claude.

**Low-resource language (LRL - Ngôn ngữ ít tài nguyên)**: Một ngôn ngữ có văn bản kỹ thuật số và dữ liệu song song hạn chế (<1 triệu cặp câu). Phần lớn các ngôn ngữ trên thế giới thuộc loại này.

**MQM (Multidimensional Quality Metrics - Số liệu Chất lượng Đa chiều)**: Một khuôn khổ đánh giá của con người trong đó các dịch giả chuyên nghiệp chú thích các khoảng lỗi cụ thể trong các bản dịch, được phân loại theo loại và mức độ nghiêm trọng.

**NMT (Neural Machine Translation - Dịch máy Neural)**: MT sử dụng mạng neural, trái ngược với các phương pháp thống kê (SMT) hoặc dựa trên quy tắc (RBMT).

**Parallel data / parallel corpus (Dữ liệu song song / kho ngữ liệu song song)**: Một bộ sưu tập các văn bản bằng hai ngôn ngữ là bản dịch của nhau, được căn chỉnh ở cấp độ câu. Nguồn tài nguyên huấn luyện chính cho MT.

**Polysynthetic language (Ngôn ngữ đa tổng hợp)**: Một ngôn ngữ trong đó các từ được cấu tạo từ nhiều hình vị, thường mã hóa thông tin mà sẽ yêu cầu một mệnh đề đầy đủ trong các ngôn ngữ phân tích như tiếng Anh. Ví dụ: Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Một bộ tokeniser và detokeniser từ phụ độc lập với ngôn ngữ, triển khai BPE và phân đoạn mô hình ngôn ngữ unigram. Được sử dụng rộng rãi trong NLP đa ngôn ngữ.

**Transformer**: Kiến trúc neural thống trị cho NLP kể từ năm 2017, hoàn toàn dựa trên các cơ chế self-attention. Được giới thiệu trong "Attention Is All You Need" (Vaswani et al., 2017).

**Zero-shot cross-lingual transfer (Chuyển giao xuyên ngôn ngữ zero-shot)**: Áp dụng một mô hình được huấn luyện trên một ngôn ngữ (thường là tiếng Anh) sang một ngôn ngữ khác mà không cần bất kỳ dữ liệu huấn luyện nào của ngôn ngữ đích, dựa vào các biểu diễn đa ngôn ngữ được chia sẻ.

---

*Bản tóm tắt này được biên soạn vào tháng 6 năm 2026. Lĩnh vực MT phát triển nhanh chóng; các khả năng cụ thể của mô hình và kết quả benchmark nên được xác minh lại với các nguồn hiện tại. Để biết những phát triển mới nhất, hãy tham khảo [machinetranslate.org](https://machinetranslate.org), [ACL Anthology](https://aclanthology.org) và kỷ yếu của shared task WMT gần đây nhất.*


---


## Điều này dẫn đến đâu trên trang web này

Khoảng trống mà bản tóm tắt này mô tả — hàng trăm ngôn ngữ hoàn toàn không có bản dịch nào được đo lường — là những gì phần còn lại của trang web này được xây dựng để thu hẹp. Lập luận về cách thức ([Champollion là gì](/docs/what-is-champollion)), tính kinh tế của việc xây dựng một tập đánh giá thay vì một kho ngữ liệu huấn luyện ([Ai được hưởng lợi — các nhà nghiên cứu](/docs/network/who-benefits#researchers)), và trạng thái của những gì thực sự đã được đo lường cho đến nay ([Những Hạn chế Trung thực](/docs/network/honest-limitations)) là ba bài đọc tiếp theo tự nhiên nhất.
