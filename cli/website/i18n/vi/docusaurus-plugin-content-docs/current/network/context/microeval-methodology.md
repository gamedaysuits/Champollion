---
sidebar_position: 4
title: "Microeval: Đánh giá chuyên biệt theo ngôn ngữ cho dịch máy"
slug: '/network/context/microeval-methodology'
---

# Microeval: Các chỉ số đánh giá đặc thù theo ngôn ngữ cho dịch máy

***Phương pháp xây dựng các chỉ số đánh giá được thiết kế riêng cho từng ngôn ngữ bằng cách sử dụng FST, từ điển và các quy tắc tương đương do nhà ngôn ngữ học tuyển chọn — và lý do tại sao lĩnh vực này cần nó***

---

> *"Giới hạn ngôn ngữ của tôi là giới hạn thế giới của tôi."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Giới thiệu

Cộng đồng đánh giá dịch máy đã dành hai thập kỷ để tìm kiếm các chỉ số vạn năng (universal metrics) — các thước đo chất lượng dịch thuật hoạt động hiệu quả trên mọi ngôn ngữ, mọi lĩnh vực và mọi loại hình ngôn ngữ. Cuộc tìm kiếm này đã tạo ra những công cụ đáng chú ý: BLEU (Papineni và cộng sự, 2002), chrF++ (Popović, 2017), COMET (Rei và cộng sự, 2020), MetricX (Juraska và cộng sự, 2023). Đối với khoảng 20 ngôn ngữ chiếm ưu thế trong các nhiệm vụ chung của WMT, các công cụ này hoạt động tốt.

Đối với khoảng 7.000 ngôn ngữ còn lại, chúng không hoạt động hiệu quả.

Bài báo này lập luận rằng **việc tìm kiếm các chỉ số vạn năng, khi áp dụng cho các ngôn ngữ nghèo tài nguyên và có hình thái phức tạp, không chỉ là chưa hoàn thiện — mà đó là một mô hình sai lầm**. Chúng tôi đề xuất **microeval**: một phương pháp xây dựng các chỉ số đánh giá được thiết kế riêng cho từng ngôn ngữ bằng cách sử dụng các công cụ ngôn ngữ tốt nhất hiện có — bộ chuyển đổi trạng thái hữu hạn (finite-state transducers - FST), từ điển song ngữ, bộ phân tích hình thái và các quy tắc tương đương do nhà ngôn ngữ học tuyển chọn.

Microeval không phải là một chỉ số đơn lẻ. Nó là một *thực hành* — một quy trình hệ thống để xây dựng cơ sở hạ tầng đánh giá có mã hóa kiến thức đặc thù của ngôn ngữ. Thực hành này tạo ra các chỉ số, được chúng tôi tập hợp dưới tên khung làm việc là **LYSS** (Linguistically-informed Yield & Structural Scoring). Nhưng đóng góp chính ở đây là phương pháp luận, chứ không phải bất kỳ chỉ số cụ thể nào mà nó tạo ra.

Tài liệu này đồng hành cùng với:
- [Đo lường những điều không thể đo lường](/docs/network/context/mt-evaluation-landscape) — khảo sát bức tranh toàn cảnh về đánh giá, định vị LYSS giữa các chỉ số hiện có
- [Đặc tả tính điểm](/docs/network/specifications/scoring) — đặc tả kỹ thuật cho các định nghĩa chỉ số, trọng số và composite score
- [Chiến lược hợp tác ngữ liệu](/docs/network/specifications/corpus-partnership) — quy trình làm việc thực tế để thiết lập các ngữ liệu đánh giá

Những tài liệu đó mô tả LYSS là *gì* và nó phù hợp ở *đâu*. Tài liệu này giải quyết các câu hỏi sâu sắc hơn: *Tại sao* đánh giá đặc thù theo ngôn ngữ lại cần thiết? Làm *thế nào* để bạn xây dựng nó cho một ngôn ngữ mới? Và *ai* là người quyết định điều gì được coi là "đúng"?

---

## Phần 1: Tại sao các chỉ số vạn năng thất bại trên các ngôn ngữ nghèo tài nguyên

### 1.1 Giả định về tính vạn năng

Mọi chỉ số đánh giá dịch máy lớn kể từ BLEU đều dựa trên một giả định ngầm định: rằng các *cơ chế* của chất lượng dịch thuật là độc lập với ngôn ngữ, ngay cả khi các *tham số* có khác nhau. BLEU đếm mức độ trùng lặp n-gram. chrF++ đếm mức độ trùng lặp n-gram ký tự. COMET huấn luyện một mô hình hồi quy dựa trên đánh giá của con người. Tất cả đều giả định rằng cấu trúc tín hiệu — điều làm cho một bản dịch trở nên "tốt" — có thể được nắm bắt bởi một thuật toán không phụ thuộc vào ngôn ngữ, có thể được tinh chỉnh trên dữ liệu đặc thù của ngôn ngữ.

Đối với các cặp ngôn ngữ châu Âu giàu tài nguyên, giả định này hoạt động khá tốt. Các nhiệm vụ chung về chỉ số của WMT cho thấy mối tương quan cao với con người đối với các cặp tiếng Anh↔tiếng Đức, tiếng Anh↔tiếng Séc, tiếng Anh↔tiếng Trung. Các chỉ số có thể không đồng nhất ở các trường hợp biên, nhưng chúng đồng thuận về phân phối chất lượng.

Đối với các ngôn ngữ đa tổng hợp (polysynthetic) như tiếng Plains Cree (nêhiyawêwin), giả định này bị phá vỡ ở nhiều cấp độ:

**Tính mờ đục về hình thái (Morphological opacity).** Một động từ tiếng Cree duy nhất có thể chứa nhiều thông tin như cả một mệnh đề tiếng Anh. Từ *nikî-wîcihâw* ("Tôi đã giúp anh ấy/cô ấy") mã hóa ngôi, số, tính hoạt tính (animacy), hướng và thì trong một dạng biến hình duy nhất. Một chỉ số n-gram chỉ nhìn thấy một token; một bộ phân tích hình thái nhìn thấy sáu hình vị (morpheme). Các chỉ số bề mặt không thể phân biệt giữa một động từ được biến hình chính xác và một từ ảo tưởng trông có vẻ hợp lý nhưng vi phạm sự hòa hợp về tính hoạt tính — cả hai đều là các token đơn lẻ có độ dài ký tự tương tự nhau.

**Trật tự từ tự do.** Tiếng Cree có trật tự từ tự do về mặt ngữ dụng (Wolfart, 1973, §3.2). Các câu *atim niwâpamâw* và *niwâpamâw atim* ("Tôi nhìn thấy con chó") đều chính xác về mặt ngữ pháp — sự lựa chọn mang tính ngữ dụng chứ không phải cú pháp. Bất kỳ chỉ số nào phạt sự sai lệch trật tự từ so với bản dịch tham chiếu sẽ tạo ra kết quả âm tính giả (false negative) trên mọi cặp từ như vậy.

**Sự tương đương về hình thái.** Tiếng Cree có nhiều cách biểu diễn chính tả hợp lệ cho cùng một từ (các biến thể SRO, sự luân phiên nguyên âm dài/tiến trình). Các bản dịch *nikî-atoskân* và *nikî-atoskên* có thể tương đương nhau về mặt phương ngôn. Một chỉ số khớp chuỗi nhìn thấy hai chuỗi khác nhau; một nhà ngôn ngữ học nhìn thấy cùng một từ.

**Sự thiếu hụt dữ liệu huấn luyện.** Các chỉ số mạng nơ-ron như COMET yêu cầu dữ liệu huấn luyện — các đánh giá chất lượng của con người trên các cặp bản dịch — để học thế nào là "tốt". Đối với tiếng Cree, dữ liệu này không tồn tại. COMET vẫn có thể tạo ra điểm số (nó chuyển sang sử dụng bộ mã hóa đa ngôn ngữ dự phòng), nhưng những điểm số đó chưa được xác thực dựa trên bất kỳ đánh giá chất lượng nào của người nói tiếng Cree bản xứ. Chúng chỉ là những suy diễn từ các mẫu ngôn ngữ châu Âu, áp dụng cho một ngôn ngữ có cấu trúc hoàn toàn khác biệt.

### 1.2 Nghịch lý của việc đánh giá ngôn ngữ nghèo tài nguyên

Điều này tạo ra một nghịch lý:

> Những ngôn ngữ cần dịch máy khẩn thiết nhất lại chính là những ngôn ngữ mà các công cụ đánh giá tốt nhất hoạt động kém tin cậy nhất.

Nếu chúng ta không thể đo lường chất lượng dịch thuật cho các ngôn ngữ này, chúng ta không thể:
- So sánh các phương pháp dịch thuật một cách khách quan
- Phát hiện khi một mô hình tạo ra những từ ảo tưởng vô nghĩa nhưng trông có vẻ hợp lý
- Theo dõi xem lĩnh vực này có đang tiến bộ hay không
- Yêu cầu các nhà cung cấp hệ thống dịch máy chịu trách nhiệm về các tuyên bố chất lượng của họ

Kết quả là một **sự thất bại dây chuyền**: không có dữ liệu huấn luyện → không có độ bao phủ của bộ mã hóa → không có đánh giá được xác thực → không có tiến bộ có thể đo lường → không có động lực đầu tư → không có dữ liệu huấn luyện.

Để phá vỡ chu kỳ này, cần có các phương pháp đánh giá không phụ thuộc vào các tài nguyên mà chúng ta không có (dữ liệu huấn luyện, đánh giá quy mô lớn của con người, bộ mã hóa nơ-ron được tinh chỉnh). Nó đòi hỏi các phương pháp tận dụng các tài nguyên mà chúng ta *thực sự* có.

### 1.3 Những gì chúng ta thực sự có

Đối với nhiều ngôn ngữ nghèo tài nguyên, hàng thập kỷ nghiên cứu thực địa ngôn ngữ học đã tạo ra các công cụ và tài nguyên mà cộng đồng đánh giá dịch máy phần lớn đã bỏ qua:

| Tài nguyên | Nội dung cung cấp | Độ bao phủ |
|----------|-----------------|----------|
| **Finite-State Transducers (FSTs)** | Phân tích hình thái học hoàn chỉnh — mọi dạng từ hợp lệ trong ngôn ngữ | ~100+ ngôn ngữ thông qua GiellaLT, Apertium, NRC |
| **Từ điển song ngữ** | Ánh xạ từ gốc (lemma) sang chú giải (gloss) | Hàng trăm ngôn ngữ (Wolvengrey 2001 cho tiếng Cree: khoảng 18.000–22.000 mục từ tùy thuộc vào ấn bản và phương pháp đếm) |
| **Công cụ phân tích hình thái học** | Gắn thẻ từ loại, bổ đề hóa, tạo hệ biến hóa từ | Hàng chục ngôn ngữ với mức độ bao phủ khác nhau |
| **Ngữ pháp miêu tả** | Các quy tắc chi phối sự hòa hợp, trật tự từ, tính sinh thể, obviation | Có sẵn cho hầu hết các ngôn ngữ đã được tư liệu hóa |
| **Chuyên môn ngôn ngữ** | Các thành viên cộng đồng có thể phân biệt bản dịch đúng và sai | Mặc nhiên tồn tại đối với mọi ngôn ngữ sống |

Các tài nguyên này được xây dựng bởi các nhà ngôn ngữ học máy tính, nhà ngôn ngữ học thực địa và các cộng đồng ngôn ngữ trong nhiều thập kỷ — thường không có mối liên hệ nào với cộng đồng đánh giá dịch máy. FST cho tiếng Plains Cree được xây dựng tại Đại học Alberta bởi Antti Arppe và các đồng nghiệp như một công cụ ghi chép tài liệu ngôn ngữ, chứ không phải một chỉ số đánh giá. Cơ sở hạ tầng GiellaLT tại UiT được xây dựng cho công nghệ ngôn ngữ thiểu số, chứ không phải cho các nhiệm vụ chung của WMT.

**Microeval là thực hành chuyển đổi các tài nguyên hiện có này thành các chỉ số đánh giá.**

---

## Phần 2: Phương pháp luận Microeval

### 2.1 Định nghĩa

**Microeval** là một phương pháp luận hệ thống để xây dựng các chỉ số đánh giá dịch máy được thiết kế riêng cho một ngôn ngữ cụ thể, sử dụng các công cụ và tài nguyên ngôn ngữ đặc thù của ngôn ngữ đó. Một bộ microeval:

1. **Mã hóa kiến thức đặc thù của ngôn ngữ** mà các chỉ số không phụ thuộc vào ngôn ngữ không thể nắm bắt được
2. **Sử dụng cơ sở hạ tầng ngôn ngữ hiện có** (FST, từ điển, ngữ pháp) thay vì yêu cầu dữ liệu huấn luyện mới
3. **Tạo ra điểm số mang tính tất định và có thể giải thích được** — mọi điểm số đều có thể được truy xuất nguồn gốc từ một phán đoán ngôn ngữ cụ thể
4. **Được thiết kế bởi các nhà ngôn ngữ học**, không chỉ bởi các kỹ sư — các lớp biến thể, quy tắc tương đương và logic xác thực phản ánh chuyên môn ngôn ngữ học
5. **Bổ sung thay vì thay thế** các chỉ số vạn năng — microeval lấp đầy các khoảng trống, chứ không chiếm lĩnh toàn bộ không gian

### 2.2 Kiến trúc ba lớp

Một bộ microeval hoàn chỉnh hoạt động ở ba cấp độ phân tích, từ bề mặt đến ngữ nghĩa:

| Lớp | Câu hỏi được giải đáp | Công cụ được sử dụng | Thành phần LYSS |
|-------|------------------|-----------|----------------|
| **Tính hợp lệ về hình thái** | "Mỗi từ có phải là một dạng từ hợp lệ trong ngôn ngữ này không?" | Bộ chuyển đổi trạng thái hữu hạn (FST) | LYSS-fst |
| **Sự tương đương về ngôn ngữ** | "Bản dịch này có phải là một biến thể chấp nhận được của bản dịch tham chiếu không?" | Công cụ kiểm tra lỗi (linter) tất định với các lớp biến thể do nhà ngôn ngữ học tuyển chọn | LYSS-eq |
| **Độ trung thực về ngữ nghĩa** | "Bản dịch này có giữ nguyên ý nghĩa của văn bản nguồn không?" | Khôi phục mục từ bằng FST + nghĩa giải thích từ điển + mức độ trùng lặp từ thực (content-word) | LYSS-sem |

Các lớp này mang tính **tích lũy chứ không phải thay thế cho nhau**. Một bản dịch phải vượt qua cả ba lớp để được coi là hoàn toàn chính xác. Một từ ảo tưởng sẽ thất bại ở Lớp 1. Một biến thể phương ngôn chính xác nhưng khác với bản dịch tham chiếu sẽ bị phát hiện ở Lớp 2. Một bản dịch sử dụng các từ hợp lệ theo trật tự hợp lệ nhưng mang ý nghĩa khác sẽ bị phát hiện ở Lớp 3.

### 2.3 Cách xây dựng một bộ Microeval cho một ngôn ngữ mới

Phần này mô tả quy trình từng bước. Chúng tôi sử dụng tiếng Plains Cree (CRK) làm ví dụ thực tế và khái quát hóa khi có thể.

#### Bước 1: Đánh giá các tài nguyên hiện có

Trước khi xây dựng bất cứ điều gì, hãy kiểm kê những gì đang tồn tại:

| Tài nguyên | Yêu cầu đối với | Cách tìm kiếm | Chất lượng tối thiểu |
|----------|-------------|----------------|-----------------|
| FST | Lớp 1 (LYSS-fst) | Kiểm tra danh mục của GiellaLT, Apertium, NRC | Phải chấp nhận >90% các dạng từ hợp lệ trong một ngữ liệu thử nghiệm |
| Từ điển song ngữ | Lớp 3 (LYSS-sem) | Kiểm tra các dự án ghi chép tài liệu ngôn ngữ, Wiktionary, tài nguyên cộng đồng | >5.000 mục từ với ánh xạ từ mục từ sang nghĩa giải thích |
| Ngữ pháp mô tả | Lớp 2 (LYSS-eq) | Các cuốn ngữ pháp đã xuất bản, luận văn, tài liệu tham khảo do cộng đồng biên soạn | Phải ghi chép lại các bảng biến hình hình thái cốt lõi |
| Người nói song ngữ | Tất cả các lớp (xác thực) | Liên hệ cộng đồng, các chương trình ngôn ngữ của trường đại học | Tối thiểu 3 người nói cho các thử nghiệm xác thực |

**Nếu không có FST tồn tại:** Bỏ qua Lớp 1. Bộ công cụ sẽ chỉ hoạt động trên Lớp 2–3, hoặc chuyển sang sử dụng các chỉ số vạn năng dự phòng (Hồ sơ B trong cách tính điểm LYSS). Điều này không lý tưởng, nhưng vẫn tốt hơn là không có gì.

**Nếu không có từ điển tồn tại:** Bỏ qua Lớp 3 hoặc sử dụng một phiên bản rút gọn với bất kỳ từ vựng nào có sẵn. Một từ điển 500 mục từ sẽ ít hữu ích hơn một từ điển 18.000 mục từ, nhưng nó vẫn cung cấp tín hiệu.

#### Bước 2: Cấu hình cổng kiểm tra tính hợp lệ về hình thái (LYSS-fst)

Nếu có sẵn FST:

1. **Cài đặt FST** bằng cách sử dụng tệp nhị phân phân tích của ngôn ngữ (định dạng HFST `.hfstol` cho GiellaLT)
2. **Chạy thử nghiệm độ bao phủ** trên một ngữ liệu đại diện: FST nhận dạng được bao nhiêu phần trăm token?
3. **Xây dựng danh sách cho phép (allowlist)** cho các khoảng trống FST dự kiến: từ mượn, danh từ riêng, từ mới, từ viết tắt
4. **Tính toán tỷ lệ từ chối sai (false rejection rate) cơ sở** — tỷ lệ phần trăm các từ hợp lệ mà FST từ chối một cách sai lầm
5. **Thiết lập ngưỡng tính điểm** — dưới tỷ lệ chấp nhận FST nào thì chúng tôi sẽ gắn cờ một bản dịch là đáng nghi ngờ về mặt hình thái?

Chỉ số chính là `fst_acceptance_rate`: tỷ lệ các từ đầu ra mà FST nhận dạng được. Tỷ lệ 0,85 có nghĩa là 85% số từ là hình thái tiếng Cree hợp lệ; 15% còn lại là không hợp lệ, từ mượn hoặc các khoảng trống độ bao phủ của FST.

**Quyết định thiết kế quan trọng:** Vấn đề từ chối sai. Một FST được huấn luyện trên ngôn ngữ văn học trang trọng sẽ từ chối các dạng khẩu ngữ hợp lệ. Một FST có độ bao phủ bảng biến hình không hoàn chỉnh sẽ từ chối các biến hình hợp lệ nhưng hiếm gặp. Danh sách cho phép giúp giảm thiểu điều này, nhưng không thể loại bỏ hoàn toàn. *Đó là lý do tại sao chỉ riêng LYSS-fst là không đủ* — nó phải được kết hợp với Lớp 2 và Lớp 3.

#### Bước 3: Thiết kế các lớp biến thể (LYSS-eq)

Đây là bước đòi hỏi khắt khe nhất về mặt ngôn ngữ học và không thể tự động hóa. Một nhà ngôn ngữ học có chuyên môn về ngôn ngữ đích phải xác định:

**Những loại khác biệt nào giữa bản dịch ứng viên và bản dịch tham chiếu nên được coi là "chấp nhận được"?**

Đối với tiếng Plains Cree, chúng tôi đã xác định sáu lớp biến thể:

| Lớp biến thể | Cơ sở ngôn ngữ học | Ví dụ |
|--------------|-----------------|---------|
| `WORD_ORDER` | Trật tự từ tự do về mặt ngữ dụng (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | Các biến thể chính tả SRO, sự luân phiên độ dài nguyên âm | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Các tiểu từ tình thái (discourse particles) tùy chọn về mặt ngữ pháp | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Các từ đồng nghĩa được chứng thực trong từ điển | *wâpamêw* ≡ *kanawâpamêw* (cho nghĩa "nhìn thấy") |
| `PROGRESSIVE_AMBIGUITY` | Nhiều dạng tiến trình (progressive) hợp lệ | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | Sự phân biệt ngôi thứ nhất số nhiều không có trong tiếng Anh | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Các lớp này mang tính đặc thù theo ngôn ngữ.** Một ngôn ngữ khác sẽ có các lớp khác nhau — tiếng Thổ Nhĩ Kỳ có thể có các lớp cho các biến thể hòa hợp nguyên âm, tiếng Nhật cho sự luân phiên kính ngữ, tiếng Inuktitut cho sự biến đổi hậu tố theo phương ngôn.

**Quy trình thiết kế:**
1. Thu thập hơn 100 cặp bản dịch (nguồn + tham chiếu + ứng viên)
2. Xác định tất cả các trường hợp mà bản dịch ứng viên khác với bản dịch tham chiếu nhưng người nói song ngữ vẫn coi là chính xác
3. Phân loại các khác biệt — tìm kiếm các mẫu lặp lại trên nhiều cặp
4. Trang trọng hóa từng mẫu thành một quy tắc tất định (regex, phép toán tập hợp hoặc phép chuyển đổi FST)
5. Xác thực với hơn 3 người nói song ngữ: đối với mỗi lớp biến thể, họ có đồng ý rằng nó chấp nhận được không?
6. Lặp lại: một số lớp sẽ cần tinh chỉnh, một số khác sẽ cần chia tách hoặc hợp nhất

#### Bước 4: Xây dựng bộ xác thực ngữ nghĩa (LYSS-sem)

Bộ xác thực ngữ nghĩa trả lời câu hỏi: "Bản dịch này có cùng ý nghĩa với bản dịch tham chiếu không?" Nó hoạt động qua bốn giai đoạn:

1. **Khôi phục mục từ cho cả hai bản dịch** bằng FST (trích xuất các dạng gốc, loại bỏ biến hình)
2. **Ánh xạ mục từ sang nghĩa giải thích** bằng từ điển song ngữ (mục từ tiếng Cree → nghĩa giải thích tiếng Anh)
3. **So sánh các tập hợp nghĩa giải thích** — các nghĩa giải thích của bản dịch ứng viên có trùng lặp với các nghĩa giải thích của bản dịch tham chiếu không?
4. **Kiểm tra các ràng buộc cấu trúc** — bản dịch ứng viên có vi phạm các quy tắc ngữ pháp đã biết không (sự hòa hợp về tính hoạt tính, dạng động từ, đánh dấu ngôi)?

Bộ xác thực tạo ra các phán quyết: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Mỗi phán quyết đều mang tính tất định và có thể truy xuất nguồn gốc — bạn có thể giải thích *tại sao* một bản dịch nhận được một phán quyết nhất định bằng cách kiểm tra giai đoạn nào đã gắn cờ nó.

**Phiên bản khả thi tối thiểu (Minimum viable version):** Nếu bạn có FST và từ điển, bạn có thể xây dựng một bộ xác thực ngữ nghĩa đơn giản hóa chỉ thực hiện so sánh trùng lặp mục từ-nghĩa giải thích (giai đoạn 1–3). Giai đoạn 4 (kiểm tra ngữ pháp) đòi hỏi nhiều kỹ thuật ngôn ngữ hơn nhưng mang lại giá trị đáng kể cho các ngôn ngữ có hình thái phức tạp.

#### Bước 5: Tích hợp với khung đánh giá (Evaluation Harness)

Bộ microeval được đóng gói dưới dạng một tập hợp các plugin chỉ số cắm vào khung đánh giá:

1. Mỗi chỉ số triển khai giao thức `MetricPlugin`: `compute(entry) → dict`, `aggregate(results) → dict`
2. Hệ thống phát hiện plugin tự động phát hiện các plugin đặc thù theo ngôn ngữ dựa trên mã ngôn ngữ đích
3. Điểm số được đưa vào hàm tính composite score, hàm này kết hợp các chỉ số microeval với các chỉ số vạn năng bằng cách sử dụng các hồ sơ trọng số đặc thù theo ngôn ngữ

### 2.4 Microeval khả thi tối thiểu

Không phải ngôn ngữ nào cũng cần cả ba lớp ngay lập tức. Dưới đây là cấu hình hữu ích tối thiểu ở mỗi cấp độ:

| Cấu hình | Những gì bạn cần | Những gì bạn nhận được | Thời gian xây dựng |
|--------------|--------------|-------------|---------------|
| **Chỉ LYSS-fst** | FST + danh sách cho phép | Cổng kiểm tra tính hợp lệ về hình thái — phát hiện các dạng từ ảo tưởng | 1–2 tuần |
| **LYSS-fst + LYSS-eq** | FST + 3–6 lớp biến thể + thời gian của nhà ngôn ngữ học | Cổng kiểm tra tính hợp lệ + phát hiện sự tương đương — giảm thiểu âm tính giả | 4–8 tuần |
| **LYSS đầy đủ** | FST + các lớp biến thể + từ điển + bộ xác thực ngữ nghĩa | Đánh giá đặc thù theo ngôn ngữ hoàn chỉnh | 8–16 tuần |

Khuyến nghị là bắt đầu với LYSS-fst (nhanh, tác động cao, chỉ yêu cầu một FST có thể đã tồn tại sẵn) và thêm dần các lớp theo thời gian.

---

## Phần 3: Vấn đề từ chối sai (False Rejection)

### 3.1 Định nghĩa

Mỗi chỉ số microeval đều có một tỷ lệ từ chối sai (false rejection rate): xác suất một bản dịch chính xác bị chấm điểm là không chính xác.

Đối với LYSS-fst, từ chối sai xảy ra khi:
- FST không bao phủ một dạng từ hợp lệ (bảng biến hình không đầy đủ)
- Bản dịch chứa một từ mượn mà FST không nhận dạng được
- Bản dịch sử dụng một từ mới hoặc tên thương hiệu
- Bản dịch sử dụng một dạng phương ngôn không có trong từ vựng của FST
- Bản dịch chứa một danh từ riêng không có trong danh sách cho phép

Đối với LYSS-eq, từ chối sai xảy ra khi:
- Bản dịch sử dụng một biến thể chấp nhận được không được bao phủ bởi bất kỳ lớp biến thể nào
- Một lớp biến thể mới là cần thiết nhưng vẫn chưa được xác định

Đối với LYSS-sem, từ chối sai xảy ra khi:
- Một mục từ không có trong từ điển
- Một bản dịch hợp lệ sử dụng chiến lược diễn đạt khác (paraphrase) không ánh xạ tới tập hợp mục từ của bản dịch tham chiếu

### 3.2 Tại sao từ chối sai lại quan trọng hơn chấp nhận sai

Trong đánh giá, từ chối sai (false rejection) tồi tệ hơn chấp nhận sai (false acceptance). Một trường hợp từ chối sai có nghĩa là một bản dịch *chính xác* bị chấm điểm là *sai* — điều này làm nản lòng những người xây dựng mô hình đang làm tốt công việc của họ, và nó làm giảm sút lòng tin vào chỉ số. Một trường hợp chấp nhận sai có nghĩa là một bản dịch *sai* bị chấm điểm là *đúng* — điều này tuy tệ, nhưng nó sẽ bị phát hiện bởi các chỉ số khác trong composite score.

Từ chối sai có tính tích lũy: nếu LYSS-fst có tỷ lệ từ chối sai là 10% trên mỗi từ, và một câu có 5 từ, xác suất có ít nhất một từ bị từ chối sai là khoảng 41%. Điều này có nghĩa là gần một nửa số câu sẽ bị giảm tỷ lệ chấp nhận FST đi ít nhất một từ — không phải vì bản dịch sai, mà vì FST chưa hoàn thiện.

### 3.3 Các chiến lược giảm thiểu

| Chiến lược | Cơ chế | Hiệu quả |
|----------|----------|---------------|
| **Danh sách cho phép (Allowlists)** | Đưa vào danh sách trắng các từ mượn, danh từ riêng, từ viết tắt đã biết | Cao đối với các khoảng trống đã biết, bằng không đối với các khoảng trống chưa biết |
| **Khớp mờ (Fuzzy matching)** | Chấp nhận các từ trong khoảng cách chỉnh sửa (edit distance) bằng 1 so với một dạng từ đã biết | Phát hiện các lỗi chính tả và các biến thể chính tả nhỏ |
| **Tính điểm độ tin cậy** | Trọng số hóa kết quả FST theo mức độ hoàn thiện của bảng biến hình | Yêu cầu siêu dữ liệu về độ bao phủ của bảng biến hình |
| **Ngữỡng đặc thù theo danh mục** | Các ngưỡng khác nhau cho các lĩnh vực khác nhau (lĩnh vực y tế có thể có nhiều từ mượn hơn) | Yêu cầu các ngữ liệu được gắn nhãn lĩnh vực |
| **Danh sách cho phép do cộng đồng duy trì** | Người nói bản xứ gửi các từ mà FST nên chấp nhận | Bền vững nhất trong dài hạn; yêu cầu cơ sở hạ tầng tương tác với cộng đồng |

### 3.4 Đo lường tỷ lệ

Tỷ lệ từ chối sai phải được đo lường bằng thực nghiệm, trên một ngữ liệu đại diện:

1. Lấy một ngữ liệu gồm hơn 500 câu tiếng Cree đã biết là hợp lệ (sách giáo khoa, các bản dịch đã được soát xét)
2. Chạy mọi từ qua FST
3. Đối với mỗi từ bị FST từ chối, hãy nhờ một người nói song ngữ phân loại nó: từ hợp lệ mà FST đã bỏ sót, hay thực sự không hợp lệ?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Phép đo này là một trong những thử nghiệm xác thực bắt buộc (Đặc tả tính điểm §1.6).

---

## Phần 4: Ai quyết định điều gì là "Đúng"?

### 4.1 Chiều kích chính trị của việc đánh giá

Các chỉ số đánh giá không phải là những công cụ trung lập. Mỗi chỉ số đều lồng ghép một lý thuyết về thế nào là "bản dịch chính xác", và lý thuyết đó mang lại những hệ quả:

- Một FST được xây dựng từ tiếng Cree văn học sẽ phạt tiếng Cree khẩu ngữ. Đây là một lựa chọn mang tính *chính trị* về việc phong cách ngôn ngữ nào được coi trọng.
- Một lớp biến thể chấp nhận một dạng phương ngôn này nhưng không chấp nhận dạng khác sẽ ngầm chuẩn hóa ngôn ngữ đó. Chuẩn hóa là một hành động chính trị có lịch sử thuộc địa lâu dài.
- Một bộ xác thực ngữ nghĩa yêu cầu sự trùng lặp mục từ chính xác sẽ phạt việc diễn đạt sáng tạo (creative paraphrase) — một chiến lược dịch thuật quan trọng mà các dịch giả lành nghề sử dụng một cách có chủ ý.

Microeval làm cho các lựa chọn này trở nên *rõ ràng*. Mỗi lớp biến thể, mỗi mục trong danh sách cho phép, mỗi quy tắc tương đương ngữ nghĩa đều là một quyết định riêng biệt, được ghi chép tài liệu và có thể xem xét lại. Đây là một tính năng, không phải lỗi: nó có nghĩa là cộng đồng có thể kiểm tra, thách thức và sửa đổi các quy tắc chi phối cách ngôn ngữ của họ được đánh giá.

### 4.2 Quản trị cộng đồng đối với các quy tắc đánh giá

Đặc biệt đối với các ngôn ngữ bản địa, các quyết định đánh giá phải được quản trị bởi cộng đồng ngôn ngữ, chứ không phải bởi các nhà nghiên cứu hoặc kỹ sư bên ngoài. Đây không chỉ là một nguyên tắc đạo đức (mặc dù đúng là như vậy) — mà đó là một yêu cầu về tính chính xác. Chỉ những người nói trôi chảy mới có thể xác định liệu một biến thể có chấp nhận được hay không.

Mô hình quản trị:

1. **Các nhà nghiên cứu đề xuất** các lớp biến thể, các mục trong danh sách cho phép và các quy tắc ngữ nghĩa dựa trên phân tích ngôn ngữ học
2. **Người nói bản xứ xem xét** từng đề xuất và phê duyệt, từ chối hoặc sửa đổi nó
3. **Các quy tắc đã phê duyệt** được đưa vào kho mã nguồn (codebase) kèm theo ghi nhận đóng góp của người nói
4. **Các quy tắc có tranh chấp** được gắn cờ để cộng đồng thảo luận — chúng bị loại trừ khỏi việc tính điểm cho đến khi được giải quyết
5. **Cộng đồng có thể thu hồi** bất kỳ quy tắc nào vào bất kỳ lúc nào bằng cách xóa nó khỏi tập hợp đã phê duyệt

Mô hình này đòi hỏi cơ sở hạ tầng (khung đánh giá, kiểm soát phiên bản, giao thức xác thực của người nói) và các mối quan hệ (sự tin tưởng giữa các nhà nghiên cứu và các thành viên cộng đồng). Xây dựng cơ sở hạ tầng này là một phần của phương pháp luận microeval.

### 4.3 Sự biến đổi phương ngôn

Câu hỏi quản trị khó khăn nhất: khi hai phương ngôn của một ngôn ngữ không đồng nhất về một dạng từ, dạng nào là "đúng"?

Câu trả lời của Microeval: **cả hai đều đúng.** Các biến thể phương ngôn được biểu diễn dưới dạng các lớp biến thể bổ sung kèm theo thẻ phương ngôn. Composite score có thể được tính toán theo từng phương ngôn hoặc trên các phương ngôn, tùy thuộc vào những gì cuộc đánh giá đang cố gắng đo lường.

Điều này đòi hỏi ngữ liệu phải được gắn thẻ phương ngôn và các lớp biến thể phải nhận biết được phương ngôn. Nó cũng yêu cầu người nói từ nhiều phương ngôn tham gia vào quá trình xác thực. Tài liệu Chiến lược hợp tác ngữ liệu giải quyết các yêu cầu này.

---

## Phần 5: Mối quan hệ với các nghiên cứu trước đây

### 5.1 Những gì Microeval KHÔNG phải

| Tuyên bố chúng tôi KHÔNG đưa ra | Tại sao không |
|------------------------|---------|
| "Các chỉ số vạn năng là vô dụng" | Chúng cung cấp các đường cơ sở (baseline) thiết yếu và khả năng so sánh giữa các ngôn ngữ. Microeval bổ sung chứ không thế chỗ. |
| "Các chỉ số mạng nơ-ron không thể hoạt động cho LRL" | Chúng có thể — với việc tinh chỉnh trên dữ liệu đặc thù của ngôn ngữ. Nhưng dữ liệu đó hiếm khi tồn tại. Microeval hoạt động *ngay bây giờ*. |
| "Đánh giá dựa trên FST là mới lạ" | FST đã được sử dụng trong NLP hàng thập kỷ. Điểm mới lạ là việc triển khai chúng một cách hệ thống dưới dạng các chỉ số đánh giá dịch máy. |
| "LYSS tốt hơn COMET" | Chúng tôi không biết — chúng tôi chưa thực hiện nghiên cứu tương quan với con người. Chúng tôi tin rằng LYSS cung cấp nhiều *thông tin* hơn cho các ngôn ngữ đa tổng hợp, nhưng chúng tôi không thể tuyên bố nó *chính xác* hơn cho đến khi có bằng chứng. |

### 5.2 Các nghiên cứu trước đây gần gũi nhất

| Nghiên cứu | Mối quan hệ với Microeval |
|------|--------------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Các thử nghiệm tương phản cho các hiện tượng hình thái — mang tính bổ sung. MorphEval kiểm tra xem các hệ thống *có thể* tạo ra hình thái hay không; LYSS kiểm tra xem chúng *đã* làm được điều đó chưa. |
| **CheckList** (Ribeiro et al., 2020) | Phương pháp thử nghiệm hành vi cho NLP — mô hình tương tự. CheckList là một phương pháp luận; microeval cũng là một phương pháp luận, được áp dụng cho việc đánh giá thay vì thử nghiệm. |
| **HyTER** (Dreyer & Marcu, 2012) | Các lưới tương đương ngữ nghĩa (meaning-equivalent lattices) — song song khái niệm gần nhất với LYSS-eq. HyTER liệt kê các cách diễn đạt khác; LYSS-eq liệt kê các biến thể hình thái. HyTER yêu cầu xây dựng lưới thủ công cho từng câu; các quy tắc LYSS-eq áp dụng trên toàn bộ ngữ liệu. |
| **Độ bao phủ của Apertium** | Sử dụng độ bao phủ FST làm đại diện cho chất lượng đầu ra dịch máy — dự đoán trực tiếp LYSS-fst. Chưa được trang trọng hóa thành một chỉ số hoặc tích hợp vào một khung tính điểm. |
| **FUSE** (AmericasNLP 2025) | Đánh giá dựa trên đặc trưng cho các ngôn ngữ bản địa châu Mỹ — tương đồng nhất về mặt tinh thần. FUSE đề xuất các đặc trưng ngôn ngữ làm các chiều kích đánh giá; LYSS triển khai các đặc trưng cụ thể cho các ngôn ngữ cụ thể. Cần có sự so sánh đối đầu trực tiếp. |
| **AfriCOMET** (Wang & Adelani, 2024) | COMET được tinh chỉnh cho các ngôn ngữ châu Phi — chứng minh rằng các chỉ số mạng nơ-ron *có thể* được điều chỉnh. Microeval là phần bổ sung dựa trên quy tắc cho các ngôn ngữ không tồn tại dữ liệu tinh chỉnh. |

### 5.3 Sự khác biệt chính

Tất cả các nghiên cứu trước đây về đánh giá nhận biết hình thái đều:
1. **Đề xuất một khung làm việc chung** mà không triển khai nó cho các ngôn ngữ cụ thể (FUSE, CheckList)
2. **Triển khai cho các ngôn ngữ giàu tài nguyên** nơi tồn tại dữ liệu huấn luyện (MorphEval tập trung vào các cặp ngôn ngữ châu Âu)
3. **Tinh chỉnh các chỉ số mạng nơ-ron** vốn yêu cầu dữ liệu mà chúng ta không có (AfriCOMET)

Microeval được thiết kế đặc biệt cho trường hợp mà:
- Các công cụ ngôn ngữ (FST, từ điển) tồn tại
- Dữ liệu huấn luyện để tinh chỉnh chỉ số mạng nơ-ron không tồn tại
- Độ phức tạp hình thái của ngôn ngữ đánh bại các chỉ số bề mặt
- Việc đánh giá phải có khả năng vận hành *ngay bây giờ*, chứ không phải sau một chiến dịch thu thập dữ liệu

---

## Phần 6: Các câu hỏi mở và những hạn chế thẳng thắn

### 6.1 Các câu hỏi chưa có lời giải

1. **Các chỉ số LYSS có tương quan với đánh giá chất lượng của con người không?** Chúng tôi không biết. Nghiên cứu tương quan với con người theo yêu cầu (hơn 200 cặp câu, hơn 3 người nói song ngữ) vẫn chưa được thực hiện. Cho đến khi điều đó xảy ra, điểm số LYSS chỉ là các ước tính kỹ thuật, chứ không phải các phép đo chất lượng đã được xác thực.

2. **Các chỉ số LYSS hoạt động như thế nào khi ngôn ngữ thay đổi?** Các ngôn ngữ sống luôn tiến hóa — từ mượn mới, phương ngôn dịch chuyển, từ mới xuất hiện. FST và các lớp biến thể phải được duy trì. Gánh nặng bảo trì là bao nhiêu? Chúng tôi không biết.

3. **Chất lượng FST tối thiểu để LYSS-fst hữu ích là gì?** Nếu một FST chỉ bao phủ 60% từ vựng, liệu LYSS-fst có còn hữu ích không, hay nhiễu sẽ lấn át tín hiệu? Chúng tôi cần bằng chứng thực nghiệm.

4. **Microeval có thể hoạt động cho các thách thức phi hình thái không?** Các ngôn ngữ có sự phân biệt thanh điệu, phụ âm tặc (click consonants) hoặc chữ viết biểu ý (logographic) đặt ra những thách thức đánh giá mà FST không giải quyết được. Microeval có thể không áp dụng được — hoặc nó có thể yêu cầu các công cụ khác.

5. **Làm thế nào để chúng ta xử lý vấn đề khởi động lạnh (cold-start)?** Xây dựng một bộ microeval đòi hỏi chuyên môn ngôn ngữ học. Đối với các ngôn ngữ không có cộng đồng ngôn ngữ học máy tính hoạt động tích cực, ai sẽ là người thực hiện công việc này?

### 6.2 Những hạn chế thẳng thắn của LYSS

| Hạn chế | Mức độ nghiêm trọng | Biện pháp giảm thiểu |
|-----------|----------|-----------|
| Không có dữ liệu tương quan với con người | 🔴 Nghiêm trọng | Thử nghiệm xác thực bắt buộc #1 |
| Tỷ lệ từ chối sai của FST chưa được đo lường | 🔴 Nghiêm trọng | Thử nghiệm xác thực bắt buộc #2 |
| Chỉ mới được triển khai cho một ngôn ngữ (CRK) | 🟡 Đáng kể | Lên kế hoạch chuyển đổi sang ngôn ngữ thứ hai (tiếng North Sámi) |
| Các lớp biến thể có thể chưa đầy đủ | 🟡 Đáng kể | Đánh giá của cộng đồng + bổ sung liên tục |
| Bộ xác thực ngữ nghĩa yêu cầu spaCy | 🟡 Đáng kể | Phụ thuộc tùy chọn; hạ cấp mượt mà (graceful degradation) |
| Độ bao phủ của từ điển ảnh hưởng đến chất lượng LYSS-sem | 🟡 Đáng kể | Các yêu cầu về kích thước từ điển tối thiểu đã được ghi chép tài liệu |
| Không thể phát hiện độ trôi chảy hoặc tính tự nhiên | 🟡 Đáng kể | Yêu cầu đánh giá của con người hoặc các chỉ số mạng nơ-ron |
| Yêu cầu chuyên môn ngôn ngữ học để mở rộng | 🟡 Đáng kể | Tài liệu phương pháp luận (bài báo này) giúp giảm bớt rào cản |

### 6.3 Con đường phía trước

> *"Nếu chúng ta chỉ tập trung vào những gì có tính khái quát hóa, chúng ta sẽ vô tình quên đi những nơi mà nó không thể áp dụng — và đánh mất các ngôn ngữ này cùng với tất cả tri thức và trí tuệ của chúng."*

Microeval không phải là một giải pháp cho vấn đề đánh giá. Nó là một thực hành — một kỷ luật chú ý đến những điều làm cho mỗi ngôn ngữ trở nên khác biệt, và mã hóa sự chú ý đó vào mã nguồn hoạt động. Thực hành này tốn nhiều công sức, đặc thù theo ngôn ngữ và không bao giờ kết thúc. Nhưng nó tạo ra thứ mà mô hình chỉ số vạn năng không thể làm được: một sự đánh giá nói lên chính ngôn ngữ mà nó đánh giá.

---

## Phụ lục A: Các bài báo chính

| Bài báo | Năm | Đóng góp | Mức độ liên quan |
|-------|------|-------------|-----------|
| Papineni và cộng sự, "BLEU" | 2002 | Chỉ số n-gram nền tảng | Chỉ số vạn năng đường cơ sở |
| Popović, "chrF++" | 2017 | Chỉ số n-gram ký tự | Chỉ số bề mặt tốt nhất cho các ngôn ngữ giàu hình thái |
| Rei và cộng sự, "COMET" | 2020 | Khung đánh giá mạng nơ-ron | Chỉ số mạng nơ-ron vạn năng |
| Dreyer & Marcu, "HyTER" | 2012 | Ngữ nghĩa tương đương ý nghĩa | Tiền thân khái niệm của LYSS-eq |
| Burlot & Yvon, "MorphEval" | 2017 | Đánh giá hình thái | Thử nghiệm hình thái tương phản |
| Ribeiro và cộng sự, "CheckList" | 2020 | Thử nghiệm hành vi cho NLP | Mô hình phương pháp luận |
| Sánchez-Cartagena & Toral, "MorphEval" | 2024 | Đánh giá khả năng hình thái | Phần bổ sung chẩn đoán gần gũi nhất |
| Wang & Adelani, "AfriCOMET" | 2024 | Chỉ số mạng nơ-ron được điều chỉnh cho các ngôn ngữ châu Phi | Chứng minh nhu cầu đánh giá đặc thù theo ngôn ngữ |
| Lindén và cộng sự, "HFST" | 2011 | Khung hình thái trạng thái hữu hạn | Cơ sở hạ tầng cho LYSS-fst |
| Wolfart, "Plains Cree" | 1973 | Ngữ pháp tiếng Cree chuẩn xác | Thẩm quyền ngôn ngữ học cho microeval CRK |
| Wolvengrey, "Cree: Words" | 2001 | Từ điển tiếng Plains Cree | Tài nguyên nền tảng cho LYSS-sem |
| Carroll và cộng sự, "CARE Principles" | 2020 | Quản trị dữ liệu bản địa | Khung quản trị cho microeval |

## Phụ lục B: Tóm tắt thành phần LYSS

| Thành phần | Tên chỉ số | Những gì nó đo lường | Tài nguyên yêu cầu | Trạng thái triển khai |
|-----------|------------|------------------|-------------------|-----------------------|
| LYSS-fst | `fst_acceptance_rate` | Tính hợp lệ về hình thái của các từ đầu ra | GiellaLT FST | ✅ Đang hoạt động (CRK) |
| LYSS-eq | `equivalent_match_rate` | Phát hiện biến thể chấp nhận được | Các lớp biến thể do nhà ngôn ngữ học tuyển chọn | ✅ Đang hoạt động (CRK, 6 lớp) |
| LYSS-sem | `semantic_score` | Sự bảo toàn ý nghĩa thông qua mức độ trùng lặp mục từ-nghĩa giải thích | FST + từ điển song ngữ + spaCy | ✅ Đang hoạt động (CRK, yêu cầu spaCy) |

## Phụ lục C: Các ngôn ngữ có độ bao phủ FST của GiellaLT

Các ngôn ngữ sau đây có sẵn FST thông qua GiellaLT và là các ứng viên để tích hợp LYSS-fst:

<!-- This list should be populated with actual GiellaLT coverage data. -->
<!-- See: https://github.com/giellalt -->

| Ngôn ngữ | ISO 639-3 | Mức độ hoàn thiện FST | Tính khả thi của LYSS-fst |
|----------|-----------|-------------|---------------------|
| Plains Cree | crk | Bản chính thức (Production) | ✅ Đang hoạt động |
| Northern Sámi | sme | Bản chính thức (Production) | 🟡 Đã lên kế hoạch (chuyển đổi đầu tiên) |
| Southern Sámi | sma | Bản chính thức (Production) | 🟡 Ứng viên |
| Lule Sámi | smj | Bản chính thức (Production) | 🟡 Ứng viên |
| Inari Sámi | smn | Bản chính thức (Production) | 🟡 Ứng viên |
| Skolt Sámi | sms | Bản chính thức (Production) | 🟡 Ứng viên |
| Finnish | fin | Bản chính thức (Production) | 🟡 Ứng viên |
| Inuktitut | iku | Bản thử nghiệm (Beta) | 🟡 Cần đánh giá |
| Basque | eus | Bản thử nghiệm (Beta) | 🟡 Cần đánh giá |
| Welsh | cym | Bản thử nghiệm (Beta) | 🟡 Cần đánh giá |
