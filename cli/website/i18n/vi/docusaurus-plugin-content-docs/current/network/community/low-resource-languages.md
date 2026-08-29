---
sidebar_position: 5
title: "Hỗ trợ ngôn ngữ ít tài nguyên"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Hỗ trợ ngôn ngữ ít tài nguyên

> **Tóm tắt nội dung.** Hướng dẫn toàn diện về cách xây dựng hệ thống dịch máy cho các ngôn ngữ ít tài nguyên và ngôn ngữ đa tổng hợp (polysynthetic). Bao gồm lý do tại sao các ngôn ngữ này lại khó (độ phức tạp về hình thái, dữ liệu thưa thớt, hiện tượng ảo giác), các tài nguyên tính toán hiện có (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), hơn 10 chiến lược tiếp cận, hệ thống huấn luyện (coaching) của champollion và vòng lặp đánh giá. Hãy bắt đầu tại đây nếu bạn muốn đóng góp một phương pháp cho một ngôn ngữ chưa được hỗ trợ đầy đủ.

:::info[Trạng thái: Đang được tích cực phát triển]
Hỗ trợ cho tiếng Plains Cree (nêhiyawêwin) hiện đang được phát triển. Các công cụ, bộ khung đánh giá (evaluation harness) và bảng xếp hạng (leaderboard) được mô tả ở đây là có thật và có thể sử dụng ngay hôm nay, nhưng pipeline dịch tiếng Cree vẫn chưa được phát hành. Khi được ra mắt, đây sẽ đóng vai trò là bản thiết kế mẫu cho các ngôn ngữ đa tổng hợp và ít tài nguyên khác có hạ tầng FST.
:::

## Bài toán chưa có lời giải

Dịch vụ Cloud Translation của Google liệt kê 194 ngôn ngữ ([danh sách công bố của Google](https://docs.cloud.google.com/translate/docs/languages)). OMT-1600 của Meta (tháng 3 năm 2026) tuyên bố hỗ trợ 1.600 ngôn ngữ — hệ thống dịch máy (MT) lớn nhất từng được công bố. Nhưng đối với khoảng 1.200 ngôn ngữ ở phần đuôi dài (long tail) — theo tính toán của chúng tôi: 1.600 ngôn ngữ được hỗ trợ trừ đi hơn 400 ngôn ngữ mà các tác giả báo cáo là mô hình "hiểu đủ tốt" — chất lượng nằm dưới ngưỡng có thể sử dụng, dữ liệu huấn luyện chủ yếu là văn bản Kinh Thánh, trọng số mô hình không có sẵn để tải xuống, và không có đánh giá độc lập hay khuôn khổ quản trị cộng đồng nào. Đối với khoảng 5.400 ngôn ngữ còn lại, không có mô hình tiền huấn luyện nào tạo ra được bất kỳ kết quả đầu ra nào.

Bối cảnh đã thay đổi đáng kể — các ông lớn công nghệ (Big Tech) hiện đang đầu tư vào việc phủ sóng các ngôn ngữ ít tài nguyên (LRL). Nhưng độ phủ sóng không đồng nghĩa với chất lượng, và chất lượng mà không có sự kiểm chứng độc lập thì không tạo được niềm tin. Các ngôn ngữ ít tài nguyên cần nhiều hơn là một mô hình tuyên bố hỗ trợ chúng — chúng cần sự đánh giá độc lập với xác thực về mặt hình thái học, các ngữ liệu do cộng đồng tuyển chọn và sự quản trị tôn trọng chủ quyền.

**champollion được xây dựng để thay đổi điều đó.**

[Method Leaderboard](https://champollion.dev/leaderboard) là một thử thách mở: hãy xây dựng phương pháp dịch thuật tốt nhất cho một ngôn ngữ chưa được hỗ trợ đầy đủ, chứng minh nó bằng các đánh giá có thể tái tạo và giành lấy điểm số cao nhất. Bất kỳ ai trên thế giới cũng có thể đóng góp — các nhà ngôn ngữ học, nhà nghiên cứu học máy (ML), những người làm công tác ngôn ngữ cộng đồng, sinh viên, hay những người có sở thích nghiên cứu. Bài toán vẫn chưa có lời giải. Cơ sở hạ tầng đã sẵn sàng. Bảng xếp hạng đang chờ đón bạn.

---

## Tại sao điều này lại khó: Hình thái học đa tổng hợp (Polysynthetic Morphology)

Hầu hết các hệ thống dịch máy thương mại được thiết kế cho các ngôn ngữ như tiếng Anh, tiếng Pháp và tiếng Trung — những ngôn ngữ mà từ ngữ tương đối ngắn và câu được xây dựng từ các token rời rạc. Nhưng nhiều ngôn ngữ bản địa, bao gồm cả tiếng Plains Cree, là ngôn ngữ **đa tổng hợp (polysynthetic)**: một từ duy nhất có thể mã hóa những gì tiếng Anh phải diễn đạt bằng cả một câu.

### Ví dụ về tiếng Cree

Hãy xem xét từ tiếng Plains Cree sau:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"khi tôi đi học"*

Đó chỉ là **một từ**. Nó mã hóa thì (quá khứ), hướng (đi đến), gốc từ (học), thể (bị động/phản thân) và ngôi (ngôi thứ nhất số ít). Một LLM được huấn luyện chủ yếu bằng tiếng Anh không có trực giác nào về kiểu mật độ hình thái học này.

Các thách thức còn chồng chất thêm:

| Thách thức | Ý nghĩa |
|-----------|--------------|
| **Độ phức tạp về hình thái** | Một gốc động từ duy nhất có thể tạo ra hàng ngàn dạng biến tố hợp lệ thông qua tiền tố, hậu tố và chu vi tố (circumfixation) |
| **Phân biệt động vật/bất động vật (Animate/inanimate)** | Danh từ được phân loại theo ngữ pháp là động vật hoặc bất động vật — điều này ảnh hưởng đến cách chia động từ, đại từ chỉ định và cách tạo số nhiều. Việc phân loại không phải lúc nào cũng tuân theo tính động vật sinh học (*askiy* "trái đất" là động vật; *maskisin* "chiếc giày" cũng là động vật) |
| **Sự chuyển ngôi (Obviation)** | Các tham chiếu ngôi thứ ba được xếp hạng theo mức độ gần gũi/nổi bật. Sự phân biệt giữa "gần" (proximate) và "xa" (obviative) không có khái niệm tương đương trong tiếng Anh |
| **Dữ liệu huấn luyện thưa thớt** | Các LLM đã tiếp xúc với rất ít văn bản tiếng Plains Cree. Những gì chúng thấy có thể là sự pha trộn giữa các phương ngữ (phương ngữ Y, phương ngữ TH) hoặc các hệ thống chính tả (SRO so với chữ tiết âm - syllabics) |
| **Đường cơ sở (baseline) thương mại yếu** | OMT-1600 bao gồm CRK ở cấp độ R1 (Rất ít tài nguyên) với dữ liệu huấn luyện thuộc miền Kinh Thánh và token hóa BPE tiêu chuẩn. Google Translate không hỗ trợ tiếng Cree. Đánh giá độc lập với các số đo hình thái học là điều làm cho các đường cơ sở này trở nên có ý nghĩa. |

Việc dịch các ngôn ngữ đa tổng hợp vẫn là một **bài toán nghiên cứu mở** — OMT-1600 bao gồm các ngôn ngữ đa tổng hợp nhưng sử dụng token hóa BPE tiêu chuẩn (từ vựng 256K) mà không có nhận thức về hình thái học, nghĩa là nó xé nát các từ ghép thành những mảnh byte vô nghĩa.

---

## Các nghiên cứu trước đây: Cách mọi người đã tiếp cận vấn đề này

### ALTLab FST

Tài nguyên tính toán quan trọng nhất đối với tiếng Plains Cree là **bộ chuyển đổi trạng thái hữu hạn (finite-state transducer - FST)** được phát triển bởi [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) tại Đại học Alberta, hợp tác với [Giellatekno](https://giellatekno.uit.no/) tại UiT Đại học Bắc Cực của Na Uy.

ALTLab FST là một **bộ phân tích và tạo sinh hình thái học**: khi nhận một từ tiếng Cree đã biến tố, nó có thể phân tách từ đó thành gốc từ và các thẻ ngữ pháp, và khi nhận một gốc từ cộng với các thẻ, nó có thể tạo ra dạng biến tố chính xác. Quá trình này mang tính tất định (deterministic) — không có mạng nơ-ron, không có ảo giác, không có xác suất. Nếu FST chấp nhận một từ, từ đó hợp lệ về mặt hình thái học.

Đây là lý do tại sao bảng xếp hạng champollion theo dõi **Tỷ lệ chấp nhận của FST (FST Acceptance Rate)** như một số đo. Một phương pháp dịch thuật tạo ra các từ bị FST từ chối tức là đang tạo ra tiếng Cree không hợp lệ về mặt hình thái — bất kể điểm số chrF++ là bao nhiêu.

**Các tài nguyên chính của ALTLab:**
- [itwêwina](https://itwewina.altlab.app/) — từ điển thông minh tiếng Plains Cree–Anh được hỗ trợ bởi FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — nền tảng từ điển mã nguồn mở có nhận thức về hình thái học
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — cơ sở dữ liệu từ vựng tiếng Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — bối cảnh dự án rộng lớn hơn

### Các cơ sở dữ liệu FST & Hình thái học toàn cầu

Tiếng Plains Cree không phải là ngôn ngữ duy nhất có hạ tầng FST chất lượng cao. Nếu bạn muốn phát triển các pipeline dịch thuật cho các ngôn ngữ ít tài nguyên hoặc phức tạp về hình thái khác, bạn có thể khai thác các trung tâm toàn cầu đã được thiết lập này:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT Đại học Bắc Cực của Na Uy):** Kho lưu trữ lớn nhất về các bộ phân tích và tạo sinh hình thái học FST mã nguồn mở, bao phủ hơn 100 ngôn ngữ. Các lĩnh vực trọng tâm bao gồm các ngôn ngữ Sámi (`sme`, `smj`, `sma`, v.v.), các ngôn ngữ Uralic (Komi, Erzya, Udmurt, v.v.) và các ngôn ngữ thiểu số/bản địa khác. Họ lưu trữ các ngữ liệu văn bản đã xử lý công khai (`corpus-xxx`) trong [Tổ chức GitHub](https://github.com/giellalt/) của họ.
* **[The Apertium Project](https://www.apertium.org/):** Một nền tảng dịch máy dựa trên luật (rule-based) mã nguồn mở. Apertium duy trì các bộ phân tích hình thái học FST được tối ưu hóa cao (sử dụng `lttoolbox` và `hfst`) cùng các từ điển song ngữ cho hàng chục ngôn ngữ, bao gồm một bộ lớn các ngôn ngữ Turkic (Kazakh, Tatar, Kyrgyz, v.v.) và các ngôn ngữ thiểu số ở Châu Âu. Tất cả tài nguyên đều công khai trên [GitHub của Apertium](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** Một dự án hợp tác cung cấp các hệ hình thái học được chuẩn hóa cho hơn 150 ngôn ngữ. Tập dữ liệu được lưu trữ trên Hugging Face tại [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). Nếu một tệp nhị phân FST đã biên dịch không có sẵn cho một ngôn ngữ, các bảng UniMorph có thể được sử dụng như một cổng tra cứu cơ sở dữ liệu tĩnh.
* **[Hội đồng Nghiên cứu Quốc gia Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Cung cấp các công cụ cho các ngôn ngữ bản địa Canada, bao gồm bộ phân tích hình thái học FST tiếng Inuktitut **Uqailaut** và **Nunavut Hansard Parallel Corpus** khổng lồ (1,3 triệu cặp câu tiếng Anh-Inuktitut được gióng hàng).

### Ngữ liệu EdTeKLA

[Nhóm nghiên cứu EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) (cũng tại UAlberta) đã tập hợp một ngữ liệu tiếng Plains Cree từ các tài liệu giáo dục, bản ghi âm và các nguồn từ cộng đồng. Tập dữ liệu đánh giá của champollion [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) được bắt nguồn từ công trình này, xuất bản theo [giấy phép CC BY-NC-SA sửa đổi của EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (các điều khoản phi thương mại, có phạm vi chủ quyền).

### Các phương pháp tiếp cận khác mà mọi người đã thử hoặc có thể thử

Bảng xếp hạng không phụ thuộc vào phương pháp (method-agnostic). Dưới đây là các chiến lược đã được khám phá hoặc đề xuất cho dịch máy ít tài nguyên, bất kỳ chiến lược nào trong số này cũng có thể được gửi lên:

| Phương pháp tiếp cận | Cách hoạt động | Ưu điểm | Nhược điểm |
|----------|-------------|------|------|
| **[Prompting LLM có huấn luyện](/docs/network/tutorials/coached-llm-prompting)** | Tiêm các quy tắc ngữ pháp, từ điển và các cặp ví dụ vào system prompt | Lặp lại nhanh chóng, không cần huấn luyện | Giới hạn chất lượng bị phụ thuộc vào kiến thức cơ bản của LLM |
| **[Few-shot prompting](/docs/network/tutorials/few-shot-prompting)** | Bao gồm các bản dịch đã được xác minh làm ví dụ trong ngữ cảnh (in-context) | Tốt cho phong cách nhất quán | Cửa sổ ngữ cảnh nhỏ; các ví dụ KHÔNG ĐƯỢC lấy từ dữ liệu đánh giá |
| **[Pipeline có cổng FST](/docs/network/tutorials/fst-gated-pipeline)** | LLM tạo sinh → FST xác thực → từ chối và thử lại các hình thái không hợp lệ | Đảm bảo tính hợp lệ về hình thái | Yêu cầu hạ tầng FST; các vòng lặp thử lại làm tăng độ trễ và chi phí |
| **[Tra cứu từ điển + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Bắt buộc sử dụng các thuật ngữ đã biết từ từ điển song ngữ, để LLM xử lý phần còn lại | Giảm thiểu ảo giác đối với các thuật ngữ đã biết | Độ bao phủ của từ điển luôn không đầy đủ |
| **[Mô hình tinh chỉnh](/docs/network/tutorials/fine-tuned-model)** | Tinh chỉnh một mô hình mở (Llama, Mistral) trên văn bản song song — chỉ cần không dùng dữ liệu đánh giá | Có tiềm năng đạt chất lượng cao nhất | Yêu cầu ngữ liệu song song (khan hiếm); tốn kém; rủi ro quá khớp (overfitting) |
| **[Các mô hình chuỗi](/docs/network/tutorials/chained-models)** | Mô hình A tạo bản dịch thô → Mô hình B hậu biên tập (post-edit) → Mô hình C chấm điểm | Có thể kết hợp các thế mạnh chuyên biệt | Phức tạp; chậm; tốn kém |
| **[Lai ghép dựa trên luật + LLM](/docs/network/tutorials/rule-based-hybrid)** | Sử dụng các quy tắc ngôn ngữ học cho các mẫu đã biết, LLM cho mọi thứ khác | Chính xác ở những nơi áp dụng quy tắc | Yêu cầu chuyên môn sâu về ngôn ngữ học |
| **[Tăng cường bằng dịch ngược](/docs/network/tutorials/back-translation)** | Tạo dữ liệu song song tổng hợp bằng cách dịch Cree→Anh, sau đó huấn luyện theo chiều ngược lại | Mở rộng dữ liệu huấn luyện với chi phí rẻ | Khuếch đại các lỗi hiện có của mô hình |
| **[Phương pháp tiến hóa](/docs/network/tutorials/evolutionary-approach)** | Tạo các bản dịch ứng viên, chấm điểm chúng, đột biến các bản dịch tốt nhất, lặp lại | Có thể khám phá các giải pháp mới; có thể song song hóa | Tốn kém về mặt tính toán; cần một hàm thích nghi (fitness function) tốt |
| **[Dịch một phần](/docs/network/tutorials/partial-translation)** | Dịch thủ công một mẫu đại diện, chứng minh phương pháp của bạn khớp với phong cách trên đó, sau đó tự động dịch phần lớn còn lại | Kết hợp chất lượng của con người với quy mô của máy móc | Yêu cầu nỗ lực ban đầu của con người |
| **Chấm điểm JSON / bài thi thủ công** | Tạo thủ công một tệp JSON tập dữ liệu để kiểm tra câu trả lời của học sinh trong một bài thi ngôn ngữ, hoặc chấm điểm một loạt các bản dịch của con người so với tiêu chuẩn vàng | Không yêu cầu ML; hoạt động tốt cho giáo dục và QA | Không mở rộng được cho các nhu cầu dịch thuật liên tục |

### Nó chỉ là JSON

Bộ khung (harness) nhận đầu vào là JSON và xuất điểm số ra dưới dạng JSON. [Định dạng tập dữ liệu](/docs/network/leaderboard/datasets) rất đơn giản:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

Bạn có thể xây dựng nó bằng tay. Bạn có thể xuất nó từ một bảng tính. Bạn có thể tạo nó từ một ngữ liệu. Một giáo viên ngôn ngữ có thể sử dụng nó để chấm điểm các bản dịch của học sinh. Một công ty dịch thuật có thể sử dụng nó để đánh giá năng lực của các freelancer. Một phòng thí nghiệm nghiên cứu có thể sử dụng nó để so sánh các kiến trúc mô hình. Bộ khung không quan tâm JSON đến từ đâu — nó chỉ chấm điểm.

Và bởi vì framework triển khai thực tế (production) sử dụng cùng một giao diện plugin, một phương pháp đạt điểm cao trong bộ khung có thể được triển khai lên trang web của bạn chỉ với một thay đổi cấu hình. **Hãy chứng minh và sử dụng nó.**

Các khả năng thực sự là vô tận. **Nếu bạn có một ý tưởng, hãy xây dựng nó, chạy bộ khung và gửi điểm số của bạn.**

---

## Vai trò của champollion

champollion cung cấp lớp cơ sở hạ tầng — bạn mang đến phương pháp.

### Hệ thống huấn luyện (coaching)

Phương pháp `llm-coached` của champollion cho phép bạn tiêm kiến thức ngôn ngữ học trực tiếp vào prompt của LLM:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

Dữ liệu huấn luyện được tiêm vào mọi prompt của LLM cho cặp `en:crk`, cung cấp cho mô hình ngữ cảnh ngôn ngữ học có cấu trúc mà bình thường nó sẽ không có. Xem [Dữ liệu huấn luyện (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data) để biết thông số kỹ thuật đầy đủ.

### Ngữ vực (Registers)

Ngữ vực là một phần của system prompt giúp điều hướng giọng điệu, mức độ trang trọng và các quy ước chính tả. champollion đi kèm với một ngữ vực tiếng Plains Cree:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

Bạn có thể ghi đè điều này trong cấu hình của mình để thử nghiệm với các chiến lược prompting khác nhau:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Các ngữ vực khác nhau tạo ra các phong cách dịch thuật khác nhau — và các điểm số khác nhau trên bảng xếp hạng. Mỗi lượt gửi sẽ ghi lại chính xác ngữ vực và system prompt được sử dụng (dưới dạng mã băm SHA-256 trong [run card](/docs/network/specifications/run-card)), vì vậy các thử nghiệm đều có thể tái tạo được.

### Chuyển đổi hệ chữ viết (Script conversion)

Tiếng Plains Cree được viết bằng hai hệ chữ viết: **Chính tả La-tinh Tiêu chuẩn (Standard Roman Orthography - SRO)** và **Chữ tiết âm Bản địa Canada (Canadian Aboriginal Syllabics)**. Pipeline của champollion:

1. LLM dịch sang SRO (dựa trên chữ La-tinh, thứ mà các LLM xử lý tốt hơn)
2. Cổng chất lượng (Quality gate) xác thực đầu ra SRO
3. Bộ chuyển đổi tất định biến đổi SRO → Chữ tiết âm (Syllabics)
4. Văn bản đã chuyển đổi được ghi vào đĩa

Bộ chuyển đổi xử lý tất cả các dấu phụ SRO (ê, î, ô, â cho các nguyên âm dài) và ánh xạ chúng sang các ký tự tiết âm chính xác. Xem [Bộ chuyển đổi hệ chữ viết (Script Converters)](https://champollion.dev/docs/concepts/script-converters) để biết chi tiết kỹ thuật.

### Vòng lặp đánh giá

[Bộ khung đánh giá (eval harness)](/docs/network/specifications/harness) chạy phương pháp của bạn đối chiếu với tập dữ liệu đánh giá và tạo ra một [run card](/docs/network/specifications/run-card) có điểm số:

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

Cờ `--name` là một nhãn do bạn chọn. Nó xuất hiện trên bảng xếp hạng để mọi người có thể thấy bạn đã sử dụng chiến lược prompt nào. Bộ khung ghi lại toàn bộ system prompt trong run card, vì vậy cách tiếp cận chính xác của bạn có thể được tái tạo.

:::tip[Thoải mái thử nghiệm, gửi kết quả tốt nhất của bạn]
Bộ khung được thiết kế để lặp lại nhanh chóng. Hãy chạy hàng chục thử nghiệm với các mô hình, dữ liệu huấn luyện, ngữ vực và điều kiện khác nhau. Chỉ gửi lên bảng xếp hạng khi bạn có một kết quả mà bạn tự hào.
:::

---

## Các Nguyên tắc Chủ quyền Dữ liệu {#data-sovereignty-principles}

champollion được thiết kế để hỗ trợ chủ quyền dữ liệu của người bản địa. Các nguyên tắc chủ quyền dữ liệu bản địa — quyền sở hữu và kiểm soát dữ liệu ngôn ngữ thuộc về cộng đồng — định hướng cách chúng tôi tiếp cận công nghệ ngôn ngữ cho các cộng đồng bản địa:

| Nguyên tắc | Cách champollion hỗ trợ |
|-----------|------------------------|
| **Quyền sở hữu (Ownership)** | Các cộng đồng ngôn ngữ sở hữu dữ liệu ngôn ngữ của họ. champollion không bao giờ tự động gửi dữ liệu về máy chủ của chúng tôi |
| **Quyền kiểm soát (Control)** | [Phương pháp API](https://champollion.dev/docs/guides/serving-a-method) cho phép các cộng đồng tự lưu trữ pipeline dịch thuật của riêng họ — chúng tôi cung cấp giao diện, họ kiểm soát việc triển khai |
| **Quyền truy cập (Access)** | Các cộng đồng quyết định ai có thể sử dụng phương pháp của họ. API có thể được bảo vệ bằng xác thực |
| **Quyền chiếm hữu (Possession)** | Tất cả dữ liệu dịch thuật đều nằm trong hệ thống tệp dự án của bạn. [Hệ thống nguồn gốc (provenance system)](https://champollion.dev/docs/concepts/security) theo dõi mọi bản dịch đến từ đâu |

Kiến trúc plugin có nghĩa là một cộng đồng có thể xây dựng một phương pháp kết hợp các kiến thức thiêng liêng hoặc bị hạn chế ở nội bộ, chỉ hiển thị API dịch thuật và duy trì toàn quyền kiểm soát đối với các tài nguyên ngôn ngữ của họ.

---

## Tầm nhìn: Điều gì sẽ đến tiếp theo

Tiếng Plains Cree là mục tiêu đầu tiên. Khi pipeline được xác thực và cộng đồng hài lòng với chất lượng, kiến trúc tương tự sẽ được mở rộng sang các ngôn ngữ đa tổng hợp khác có hạ tầng FST:

- **Các ngôn ngữ Algonquian khác**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Các ngôn ngữ Inuit**: Inuktitut, Inuinnaqtun (cũng sử dụng hệ chữ tiết âm)
- **Các ngữ hệ khác**: bất kỳ ngôn ngữ nào có bộ phân tích FST đều có thể sử dụng pipeline có cổng FST

Bảng xếp hạng được giới hạn theo từng cặp ngôn ngữ. Khi các tập dữ liệu đánh giá mới được đóng góp bởi các cộng đồng ngôn ngữ, các hạng mục mới trên bảng xếp hạng sẽ tự động mở ra.

**Đây là một lời mời mở.** Nếu bạn làm việc với một ngôn ngữ ít tài nguyên — với tư cách là một nhà nghiên cứu, một thành viên cộng đồng, một sinh viên, hay chỉ là một người quan tâm — champollion cung cấp cho bạn các công cụ để xây dựng một thứ gì đó thực tế, đo lường nó một cách trung thực và chia sẻ nó với thế giới. [Method Leaderboard](https://champollion.dev/leaderboard) đang chờ đợi lượt gửi của bạn.

---

## Xem thêm

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — gửi điểm số của bạn và xem các phương pháp so sánh với nhau như thế nào
- **[Đánh giá MT (MT Evaluation)](/docs/network/leaderboard/rules)** — điều gì tạo nên một phương pháp tốt, điều gì sẽ bị loại
- **[Bộ khung đánh giá (Eval Harness)](/docs/network/specifications/harness)** — cách chạy các thử nghiệm
- **[Tập dữ liệu đánh giá (Evaluation Datasets)](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 và FLORES+
- **[Dữ liệu huấn luyện (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data)** — cách cấu trúc kiến thức ngôn ngữ học cho LLM
- **[Bộ chuyển đổi hệ chữ viết (Script Converters)](https://champollion.dev/docs/concepts/script-converters)** — pipeline SRO→Syllabics
- **[Phục vụ phương pháp qua API (Serving a Method via API)](https://champollion.dev/docs/guides/serving-a-method)** — lưu trữ bản dịch do cộng đồng kiểm soát
- **[ALTLab](https://altlab.ualberta.ca/)** — Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — nhóm nghiên cứu Educational Technology, Knowledge & Language
- **[Từ điển itwêwina](https://itwewina.altlab.app/)** — từ điển tiếng Plains Cree–Anh được hỗ trợ bởi FST

