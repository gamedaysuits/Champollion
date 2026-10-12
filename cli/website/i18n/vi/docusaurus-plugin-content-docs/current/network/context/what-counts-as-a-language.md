---
sidebar_position: 2
title: "Điều gì được coi là một ngôn ngữ ở đây?"
---

# Điều gì được coi là một ngôn ngữ ở đây?

> **Tóm tắt tổng quan.** Network lập danh mục các ngôn ngữ theo ISO 639-3, đánh giá chuẩn (benchmark) từng ngôn ngữ riêng lẻ (không gộp chung theo nhóm ngôn ngữ vĩ mô), xem ngôn ngữ ký hiệu là các ngôn ngữ tự nhiên đúng bản chất, bao gồm các ngôn ngữ nhân tạo được ISO công nhận, loại trừ các ngôn ngữ lập trình, và hiển thị các tranh chấp phân loại mà không đứng về bên nào. Trang này giải thích từng lựa chọn và ý nghĩa của chúng đối với bảng xếp hạng.

Bất kỳ dự án nào đánh giá chuẩn bản dịch trên hàng nghìn ngôn ngữ đều phải trả lời một câu hỏi lâu đời và khó khăn đến bất ngờ: điều gì được tính là một ngôn ngữ? Các nhà ngôn ngữ học từ lâu đã biết rằng ranh giới giữa "ngôn ngữ" và "phương ngữ" mang tính xã hội và chính trị nhiều như cấu trúc của nó — câu châm biếm nổi tiếng rằng *"ngôn ngữ là một phương ngữ có quân đội và hải quân"* được nhà ngôn ngữ học tiếng Yiddish Max Weinreich phổ biến vào năm 1945 (ông ghi nhận câu này từ một thính giả tại một buổi diễn thuyết của mình). Chúng tôi không thể né tránh câu hỏi này, vì vậy đây là câu trả lời cùng lập luận của chúng tôi.

---

## Ngôn ngữ ký hiệu là ngôn ngữ. Chấm hết.

Ngôn ngữ ký hiệu là ngôn ngữ tự nhiên — với ngữ pháp hoàn chỉnh, được trẻ em tiếp nhận tự nhiên từ nhỏ, và có các cộng đồng ngôn ngữ đang sống. Điều này đã được ngôn ngữ học khẳng định từ chứng minh năm 1960 của William Stokoe rằng Ngôn ngữ Ký hiệu Mỹ có cùng kiểu cấu trúc nội tại như các ngôn ngữ nói, và sáu mươi năm nghiên cứu kể từ đó (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) càng củng cố quan điểm này. ISO 639-3 gán mã ngôn ngữ riêng lẻ cho các ngôn ngữ ký hiệu; Glottolog lập danh mục chúng cùng với các ngữ hệ ngôn ngữ nói. Danh mục của chúng tôi bao gồm hơn 160 ngôn ngữ trong số đó, được gắn thẻ `modality: signed`.

Một số là các ngôn ngữ Bản địa đang bị đe dọa: Ngôn ngữ Ký hiệu Thổ dân Đồng bằng Bắc Mỹ (`psd`), trong lịch sử từng là một ngôn ngữ chung liên bộ tộc lớn trên khắp Bắc Mỹ, hiện đang bị đe dọa nghiêm trọng (Davis 2010, *Hand Talk*). Sự mai một của ngôn ngữ ký hiệu *chính là* sự mai một của ngôn ngữ Bản địa, và nó nằm trong sứ mệnh của dự án này.

**Một lưu ý trung thực về phạm vi.** Network hiện chỉ đánh giá chuẩn dịch máy *dựa trên văn bản*. Dịch máy ngôn ngữ ký hiệu — xử lý video, ngữ pháp không gian và các ngôn ngữ không có dạng viết phổ biến — là một bài toán kỹ thuật khác biệt và phần lớn vẫn chưa có lời giải (xem Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL). Chúng tôi hiện chưa hỗ trợ việc này. Các mục ngôn ngữ ký hiệu trong danh mục của chúng tôi nêu rõ điều đó: **chưa được hỗ trợ — tuyệt đối không phải là "không phải một ngôn ngữ".**

## Có hai phương thức giao tiếp. Chữ viết không phải là một trong số đó.

Ngôn ngữ tồn tại ở hai phương thức chính: **nói** và **ký hiệu**. Chữ viết không phải là phương thức thứ ba — nó là một công nghệ được xếp lớp lên trên một ngôn ngữ, và phần lớn các ngôn ngữ trên thế giới vẫn tồn tại mà không có chữ viết chuẩn hóa. Đó là lý do tại sao các thẻ ngôn ngữ của chúng tôi theo dõi chữ viết một cách riêng biệt (ngôn ngữ sử dụng hệ chữ viết nào, hay hoàn toàn không có chính tả chuẩn hóa) và theo dõi một cách trung thực: đối với một nền tảng dịch máy dựa trên văn bản, việc một ngôn ngữ có dạng viết hay không là thông tin quan trọng chứ không phải là chú thích phụ — và một ngôn ngữ không có chữ viết không phải là một ngôn ngữ kém giá trị hơn.

## Ngôn ngữ nhân tạo: được chấp nhận. Ngôn ngữ lập trình: bị loại trừ.

Chúng tôi tuân theo tiêu chuẩn của chính ISO 639-3. Tiêu chuẩn này chỉ chấp nhận một ngôn ngữ nhân tạo nếu nó là một ngôn ngữ hoàn chỉnh, được thiết kế cho giao tiếp của con người, có nền văn học và một cộng đồng đã truyền lại cho thế hệ người dùng thứ hai — và nó loại trừ rõ ràng các ngôn ngữ lập trình máy tính. Esperanto, với những người nói bản ngữ, đủ điều kiện; Python thì không, vì không ai học Python như một tiếng mẹ đẻ từ cha mẹ mình. Danh mục của chúng tôi bao gồm hai mươi tư ngôn ngữ nhân tạo được ISO công nhận, được phân loại đúng như vậy, và không có ngôn ngữ lập trình nào.

## Chúng tôi đánh giá chuẩn từng ngôn ngữ riêng lẻ, không phải theo nhóm chung

ISO 639-3 phân biệt *ngôn ngữ riêng lẻ* với *ngôn ngữ vĩ mô* — các mã bao quát như `cre` (tiếng Cree), `ara` (tiếng Ả Rập), hoặc `zho` (tiếng Trung) bao hàm nhiều ngôn ngữ riêng lẻ có quan hệ gần gũi. Đơn vị đánh giá chuẩn của Network là **ngôn ngữ riêng lẻ**, vì lý do vận hành: tài nguyên dịch thuật mang tính đặc thù theo từng biến thể. Một bộ phân tích hình thái học được xây dựng cho tiếng Plains Cree (`crk`) không tạo ra được tiếng Moose Cree (`crm`); một kho ngữ liệu tiếng Ả Rập Ai Cập nói lên rất ít điều về chất lượng của một phương pháp đối với tiếng Ả Rập Ma-rốc. Một điểm số gắn với một mã bao quát sẽ là một tuyên bố về những biến thể chưa từng được đánh giá trên thực tế — vì vậy chúng tôi không làm điều đó.

Các ngôn ngữ vĩ mô vẫn xuất hiện trong danh mục dưới dạng các **trang trung tâm**: điều hướng liên kết định danh bao quát với các thành viên riêng lẻ của nó, phản ánh đúng quan sát của ISO rằng cả hai cấp độ định danh đều có thực. Dưới cấp ngôn ngữ riêng lẻ, chúng tôi hiển thị thông tin phương ngữ và phả hệ từ cây ngôn ngữ của Glottolog (Hammarström & Forkel 2022), mô hình hóa các ngữ hệ, ngôn ngữ và phương ngữ thành một hệ thống phân cấp có thể điều hướng được.

**Còn những kho ngữ liệu được gắn nhãn bằng mã bao quát thì sao?** Rất nhiều dữ liệu trong thực tế rơi vào trường hợp này — các tập dữ liệu được phát hành dưới tên "Quechua", "Persian" hoặc "Chinese (Simplified)". Chúng tôi coi nhãn nguồn là *siêu dữ liệu cần phân giải*, chứ không phải một sự thật hiển nhiên cần tuân theo hay loại bỏ. Các trường hợp máy móc sẽ được phân giải tự động từ các bảng ISO chính thức: thẻ hệ chữ viết bị lược bỏ (`cmn-Hans` là tiếng Quan Thoại, viết bằng chữ Hán giản thể — hệ chữ viết được ghi lại, định danh ngôn ngữ là `cmn`), và một mã đã ngưng sử dụng sẽ chuyển theo mã kế nhiệm chính thức của nó. Khi nhà phát hành ghi nhận rõ dữ liệu của họ thực chất là biến thể nào — FLORES+ mã hóa bản ghi Quechua của họ là `quy`, Ayacucho Quechua — chúng tôi ghi lại cách phân giải đó *cùng với trích dẫn* trên mục đăng ký của kho ngữ liệu, và kho ngữ liệu đó sẽ được đánh giá chuẩn dưới đúng ngôn ngữ riêng lẻ thực tế. Và khi không ai có thể xác định một bộ sưu tập chứa biến thể nào (một số bộ sưu tập câu cộng đồng cố tình giữ một nhóm "tiếng Ả Rập" chung chung), chúng tôi không đoán mò: kho ngữ liệu vẫn được lập danh mục theo đúng nhãn của nó, bị loại khỏi hàng đợi công việc kèm lý do mà máy có thể đọc được trong siêu dữ liệu của hàng đợi, và mọi điểm số lịch sử của nó vẫn được gắn với nút bao quát được dán nhãn trung thực — không bao giờ được âm thầm ghi nhận cho một biến thể chưa từng được đánh giá. Mọi phân giải đều có thể truy xuất lại: các bảng ISO được cố định, dấu phân giải của từng kho ngữ liệu và các trích dẫn đều được cung cấp công khai trong sổ đăng ký.

## Khi các cơ quan có thẩm quyền bất đồng, chúng tôi hiển thị cả hai

ISO 639-3 và Glottolog đôi khi tách hoặc gộp khác nhau, và các cộng đồng đôi khi cũng không đồng tình với cả hai bên. Chúng tôi không phân xử. Thẻ ngôn ngữ có tính năng *ghi chú phân loại* để hiển thị sự bất đồng cùng các nguồn dẫn, và việc đặt tên sẽ theo cộng đồng bất cứ khi nào cộng đồng thể hiện nguyện vọng. Việc một biến thể có phải là "một ngôn ngữ" hay không, xét cho cùng, một phần là câu hỏi về bản sắc — và câu hỏi về bản sắc thuộc về chính các cộng đồng đó, một nguyên tắc chúng tôi tiếp thu từ các khuôn khổ quản trị dữ liệu Bản địa.

## Một hướng nghiên cứu: sử dụng đánh giá chuẩn làm công cụ đo lường

Một điều mà một đấu trường như thế này tạo ra, gần như một sản phẩm phụ, là một loại bằng chứng mới về mức độ gần gũi thực sự giữa các biến thể ngôn ngữ *về mặt vận hành*. Nếu một phương pháp dịch duy nhất, được giữ cố định, phục vụ đủ tốt cho nhiều biến thể liên quan đến mức người nói của các biến thể đó chấp nhận kết quả đầu ra, thì các biến thể đó thực tế thuộc cùng một cụm; nếu chúng đòi hỏi các kho ngữ liệu riêng và các phương pháp riêng, thì chúng khác biệt về mặt vận hành — bất kể khía cạnh chính trị trong việc đặt tên nói gì. Điều này tương tự như các truyền thống thực nghiệm trước đây, từ kiểm tra khả năng thông hiểu qua văn bản ghi âm đến các phép đo khoảng cách từ vựng tự động, nhưng với một góc nhìn dựa trên triển khai thực tế.

Chúng tôi đưa ra điều này một cách cẩn trọng, như một hướng nghiên cứu hơn là một khẳng định. Kết quả chuyển giao phương pháp bị nhiễu bởi kích thước kho ngữ liệu, miền dữ liệu, chính tả và sự nhiễm dữ liệu huấn luyện, và việc gom cụm luôn mang tính tương đối đối với một phương pháp cùng một ngưỡng chất lượng. Trên hết: tín hiệu này có thể *cung cấp thông tin* cho các cuộc thảo luận về ngôn ngữ và phương ngữ, nhưng không bao giờ ghi đè lên cách một cộng đồng tự định danh ngôn ngữ của chính họ.

---

## Tài liệu Tham khảo

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, chủ biên (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" và "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Điều này dẫn đến đâu trên trang web này

Các quy tắc đếm ở đây chi phối mọi con số trên trang web này:
[phương pháp tính độ bao phủ](/docs/network/context/coverage-counting) áp dụng
chúng cho các dịch vụ dịch máy, và
[thẻ ngôn ngữ](/docs/reference/language-card-spec) ghi lại, theo từng ngôn ngữ,
những gì mỗi nguồn thực sự công bố.
