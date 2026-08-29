---
sidebar_position: 2
title: "Thế nào được coi là một ngôn ngữ ở đây?"
---

# Ở đây, điều gì được tính là một Ngôn ngữ?

> **Tóm tắt nội dung.** Network (Mạng lưới) phân loại các ngôn ngữ theo tiêu chuẩn ISO 639-3, đánh giá chuẩn các ngôn ngữ riêng biệt (không phải các macrolanguage - ngôn ngữ bao trùm), bao gồm các ngôn ngữ ký hiệu với tư cách là ngôn ngữ tự nhiên, bao gồm các ngôn ngữ nhân tạo được ISO công nhận, loại trừ các ngôn ngữ lập trình và hiển thị các tranh cãi về phân loại học mà không thiên vị bên nào. Trang này giải thích từng lựa chọn và ý nghĩa của chúng đối với bảng xếp hạng.

Bất kỳ dự án nào đánh giá chuẩn bản dịch trên hàng ngàn ngôn ngữ đều phải trả lời một câu hỏi cũ và khó một cách đáng ngạc nhiên: điều gì được tính là một ngôn ngữ? Các nhà ngôn ngữ học từ lâu đã biết rằng ranh giới giữa "ngôn ngữ" (language) và "phương ngữ" (dialect) mang tính xã hội và chính trị nhiều như tính cấu trúc của nó — câu nói đùa nổi tiếng rằng *"một ngôn ngữ là một phương ngữ có quân đội và hải quân"* đã được nhà ngôn ngữ học tiếng Yiddish Max Weinreich phổ biến vào năm 1945 (ông ghi nhận câu nói này từ một khán giả trong một buổi diễn thuyết của mình). Chúng tôi không thể né tránh câu hỏi này, vì vậy dưới đây là các câu trả lời và lập luận của chúng tôi.

---

## Ngôn ngữ ký hiệu là ngôn ngữ. Chấm hết.

Ngôn ngữ ký hiệu là ngôn ngữ tự nhiên — với ngữ pháp hoàn chỉnh, được trẻ em tiếp thu như tiếng mẹ đẻ và có các cộng đồng ngôn ngữ đang tồn tại. Điều này đã được giới ngôn ngữ học công nhận kể từ khi William Stokoe chứng minh vào năm 1960 rằng Ngôn ngữ Ký hiệu Mỹ (American Sign Language) có cùng loại cấu trúc nội tại như ngôn ngữ nói, và sáu mươi năm nghiên cứu kể từ đó (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) chỉ càng làm sâu sắc thêm quan điểm này. ISO 639-3 gán cho các ngôn ngữ ký hiệu những mã ngôn ngữ riêng biệt; Glottolog phân loại chúng song song với các ngữ hệ ngôn ngữ nói. Danh mục của chúng tôi bao gồm hơn 160 ngôn ngữ ký hiệu, được gắn thẻ `modality: signed`.

Một số là các ngôn ngữ Bản địa đang bị đe dọa: Ngôn ngữ Ký hiệu của người Da đỏ vùng Đồng bằng (Plains Indian Sign Language - `psd`), trong lịch sử từng là một ngôn ngữ giao tiếp chung (lingua franca) quan trọng giữa các bộ lạc trên khắp Bắc Mỹ, hiện đang bị đe dọa nghiêm trọng (Davis 2010, *Hand Talk*). Sự nguy cấp của ngôn ngữ ký hiệu *chính là* sự nguy cấp của ngôn ngữ Bản địa, và điều này nằm trong sứ mệnh của dự án.

**Một lưu ý thành thực về phạm vi.** Network hiện đang đánh giá chuẩn dịch máy *dựa trên văn bản*. Dịch máy (MT) cho ngôn ngữ ký hiệu — làm việc với video, ngữ pháp không gian và các ngôn ngữ không có hình thức viết được áp dụng rộng rãi — là một vấn đề kỹ thuật khác biệt và phần lớn chưa được giải quyết (xem Yin và cộng sự 2021, "Including Signed Languages in Natural Language Processing," ACL). Chúng tôi chưa hỗ trợ lĩnh vực này. Các mục ngôn ngữ ký hiệu trong danh mục của chúng tôi ghi rõ điều đó: **chưa được hỗ trợ — không bao giờ là "không phải một ngôn ngữ."**

## Có hai phương thức giao tiếp. Chữ viết không nằm trong số đó.

Ngôn ngữ tồn tại dưới hai phương thức chính: **nói** và **ký hiệu**. Chữ viết không phải là phương thức thứ ba — nó là một công nghệ được phủ lên trên một ngôn ngữ, và hầu hết các ngôn ngữ trên thế giới vẫn phát triển mà không cần một hệ thống chữ viết chuẩn hóa. Đó là lý do tại sao các thẻ ngôn ngữ (language cards) của chúng tôi theo dõi chữ viết một cách riêng biệt (ngôn ngữ sử dụng hệ thống chữ viết nào, hoặc liệu nó có hệ thống chính tả chuẩn hóa hay không) và theo dõi một cách trung thực: đối với một nền tảng dịch máy dựa trên văn bản, việc một ngôn ngữ có chữ viết hay không là thông tin quan trọng, không phải là một chú thích phụ — và một ngôn ngữ không có chữ viết không phải là một ngôn ngữ kém cỏi hơn.

## Ngôn ngữ nhân tạo: được chấp nhận. Ngôn ngữ lập trình: bị loại trừ.

Chúng tôi tuân theo quy định của ISO 639-3. Tiêu chuẩn này chỉ chấp nhận một ngôn ngữ nhân tạo nếu nó là một ngôn ngữ hoàn chỉnh, được thiết kế cho giao tiếp của con người, có văn học và một cộng đồng đã truyền lại nó cho thế hệ người dùng thứ hai — và nó loại trừ rõ ràng các ngôn ngữ lập trình máy tính. Tiếng Esperanto, với những người bản ngữ của nó, đủ điều kiện; Python thì không, vì không ai tiếp thu Python như ngôn ngữ mẹ đẻ từ cha mẹ của họ. Danh mục của chúng tôi bao gồm khoảng hai chục ngôn ngữ nhân tạo được ISO công nhận, được phân loại rõ ràng, và không có ngôn ngữ lập trình nào.

## Chúng tôi đánh giá chuẩn các ngôn ngữ riêng biệt, không phải các ngôn ngữ bao trùm

ISO 639-3 phân biệt *các ngôn ngữ riêng biệt* (individual languages) với *các macrolanguage* — các mã bao trùm như `cre` (tiếng Cree), `ara` (tiếng Ả Rập), hoặc `zho` (tiếng Trung) bao hàm một số ngôn ngữ riêng biệt có quan hệ họ hàng gần. Đơn vị đánh giá chuẩn của Network là **ngôn ngữ riêng biệt**, vì một lý do vận hành: các tài nguyên dịch thuật mang tính đặc thù theo từng biến thể (variety-specific). Một bộ phân tích hình thái học được xây dựng cho tiếng Plains Cree (`crk`) không thể tạo ra tiếng Moose Cree (`crm`); một tập ngữ liệu của tiếng Ả Rập Ai Cập không nói lên được nhiều điều về chất lượng của một phương pháp đối với tiếng Ả Rập Maroc. Một điểm số được gắn với một mã bao trùm sẽ là một tuyên bố về các biến thể chưa bao giờ thực sự được đánh giá — vì vậy chúng tôi không làm điều đó.

Các macrolanguage vẫn xuất hiện trong danh mục dưới dạng **các trang trung tâm (hub pages)**: hệ thống điều hướng liên kết một danh tính bao trùm với các thành viên riêng biệt của nó, phản ánh quan sát của chính ISO rằng cả hai cấp độ danh tính đều có thật. Dưới cấp độ ngôn ngữ riêng biệt, chúng tôi hiển thị thông tin về phương ngữ và phả hệ từ cây ngôn ngữ (languoid tree) của Glottolog (Hammarström & Forkel 2022), mô hình hóa các ngữ hệ, ngôn ngữ và phương ngữ thành một hệ thống phân cấp có thể điều hướng.

**Còn các tập ngữ liệu được gắn nhãn bằng mã bao trùm thì sao?** Rất nhiều dữ liệu thực tế gặp tình trạng này — các tập dữ liệu được xuất bản dưới dạng "Quechua," "Persian," hoặc "Chinese (Simplified)." Chúng tôi coi nhãn gốc là *siêu dữ liệu cần được phân giải*, chứ không phải là một chân lý để tuân theo hay loại bỏ. Các trường hợp mang tính cơ học sẽ tự động được phân giải từ các bảng ISO chính thức: thẻ chữ viết bị loại bỏ (`cmn-Hans` là tiếng Quan Thoại, viết bằng chữ Hán Giản thể — chữ viết được ghi nhận, danh tính ngôn ngữ là `cmn`), và một mã đã ngừng sử dụng sẽ tuân theo mã kế nhiệm chính thức của nó. Khi nhà xuất bản ghi chép rõ dữ liệu của họ thực sự thuộc biến thể nào — FLORES+ mã hóa bản ghi tiếng Quechua của họ là `quy`, tiếng Ayacucho Quechua — chúng tôi ghi lại sự phân giải đó *kèm theo trích dẫn* trên mục đăng ký của tập ngữ liệu, và tập ngữ liệu được đánh giá chuẩn dưới ngôn ngữ riêng biệt thực sự. Và khi không ai có thể nói rõ một bộ sưu tập chứa biến thể nào (một số bộ sưu tập câu của cộng đồng cố tình giữ một nhóm "Arabic" chung chung), chúng tôi không phỏng đoán: tập ngữ liệu vẫn được lập danh mục dưới nhãn riêng của nó, nó bị loại khỏi hàng đợi công việc với một lý do mà máy có thể đọc được mà bạn có thể thấy trong siêu dữ liệu của hàng đợi, và bất kỳ điểm số lịch sử nào trên đó vẫn được gắn với một nút bao trùm được dán nhãn trung thực — không bao giờ âm thầm ghi nhận cho một biến thể chưa từng được đánh giá. Mọi sự phân giải đều có thể truy xuất lại: các bảng ISO được ghim, các dấu phân giải cho từng tập ngữ liệu và các trích dẫn đều được cung cấp trong sổ đăng ký công khai.

## Khi các cơ quan thẩm quyền bất đồng, chúng tôi hiển thị cả hai

ISO 639-3 và Glottolog đôi khi có cách chia tách hoặc gộp nhóm khác nhau, và các cộng đồng đôi khi không đồng tình với cả hai. Chúng tôi không phân xử. Các thẻ ngôn ngữ cung cấp tính năng *ghi chú phân loại học (taxonomy notes)* hiển thị sự bất đồng kèm theo nguồn trích dẫn, và việc đặt tên tuân theo cộng đồng ở bất cứ nơi nào cộng đồng đã bày tỏ sự ưu tiên. Rốt cuộc, việc một biến thể có phải là "một ngôn ngữ" hay không, một phần là vấn đề về danh tính — và các vấn đề về danh tính thuộc về chính các cộng đồng, một nguyên tắc mà chúng tôi áp dụng từ các khuôn khổ chủ quyền dữ liệu Bản địa.

## Một hướng nghiên cứu: đánh giá chuẩn như một công cụ đo lường

Một điều mà một đấu trường như thế này tạo ra, gần như là một sản phẩm phụ, là một loại bằng chứng mới về mức độ gần gũi thực sự của các biến thể ngôn ngữ *về mặt vận hành*. Nếu một phương pháp dịch thuật duy nhất, được giữ cố định, phục vụ một số biến thể có liên quan ở chất lượng có thể triển khai, thì các biến thể đó sẽ gom cụm trong thực tế; nếu chúng đòi hỏi các tập ngữ liệu riêng biệt và các phương pháp riêng biệt, thì chúng khác biệt về mặt vận hành — bất kể các chính sách đặt tên nói gì. Điều này giống với các truyền thống thực nghiệm cũ hơn, từ kiểm tra mức độ dễ hiểu của văn bản được ghi âm đến các phép đo khoảng cách từ vựng tự động, nhưng với một bước ngoặt dựa trên nền tảng triển khai thực tế.

Chúng tôi đưa ra điều này một cách cẩn trọng, như một hướng nghiên cứu chứ không phải là một lời khẳng định. Kết quả chuyển giao phương pháp bị nhiễu bởi kích thước tập ngữ liệu, miền dữ liệu, hệ thống chính tả và sự ô nhiễm dữ liệu huấn luyện, và việc gom cụm luôn mang tính tương đối so với một phương pháp và một ngưỡng chất lượng. Trên hết: tín hiệu này có thể *cung cấp thông tin* cho các cuộc thảo luận về ngôn ngữ và phương ngữ, nhưng nó không bao giờ thay thế cách một cộng đồng xác định ngôn ngữ của chính họ.

---

## Tài liệu Tham khảo

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/

---


## Điều này dẫn đến đâu trên trang web này

Các quy tắc tính toán ở đây chi phối mọi con số trên trang web này: [phương pháp luận về độ phủ](/docs/network/context/coverage-counting) áp dụng chúng cho các dịch vụ MT (dịch máy), và [các thẻ ngôn ngữ](/docs/reference/language-card-spec) ghi lại, đối với từng ngôn ngữ, những gì mà mỗi nguồn thực sự tuyên bố.
