---
sidebar_position: 1
title: "Từ Pāṇini đến Transformers"
---

# Từ Pāṇini đến Transformers: Ngôn ngữ, Tính toán, và Sứ mệnh Dịch thuật Chưa Hoàn thành

**Lịch sử của những Ý tưởng Đằng sau champollion**

---

> *"Khi tôi nhìn vào một bài báo bằng tiếng Nga, tôi tự nhủ: 'Bài này thực chất được viết bằng tiếng Anh, nhưng nó đã được mã hóa bằng một số ký hiệu kỳ lạ. Bây giờ tôi sẽ tiến hành giải mã.'"*
> — Warren Weaver, 1949

---

## Giới thiệu

Giấc mơ về một cỗ máy có thể dịch thuật giữa các ngôn ngữ của con người còn lâu đời hơn cả chính máy tính. Theo một nghĩa nào đó, đây là bài toán sơ khai *nhất* của trí tuệ nhân tạo—lâu đời hơn cả các chương trình chơi cờ vua, hệ chuyên gia hay mạng thần kinh. Mong muốn này thường được đóng khung qua các câu chuyện ngụ ngôn châu Âu như Tháp Babel, vốn coi sự đa dạng ngôn ngữ như một hình phạt hoặc một vấn đề cần giải quyết, bỏ qua thực tế rằng các xã hội bản địa trước khi tiếp xúc với người châu Âu đã từ lâu điều phối sự đa dạng ngôn ngữ đáng kinh ngạc thông qua các ngôn ngữ thương mại tinh vi (như Chinook Jargon) và hệ thống ký hiệu (như Ngôn ngữ Ký hiệu Bản địa vùng Đồng bằng) mà không tìm kiếm sự đồng nhất hóa toàn cầu.

Nhưng lịch sử dẫn đến thời điểm này—đến một thế giới nơi các mô hình ngôn ngữ lớn có thể dịch tiếng Pháp ở mức chấp nhận được nhưng lại tạo ra những nội dung vô nghĩa (hallucinate) bằng tiếng Cree—không phải là một đường thẳng. Đó là sự bện chặt của ít nhất bốn sợi chỉ riêng biệt: nghiên cứu hình thức về ngôn ngữ, lý thuyết toán học về tính toán, cuộc cách mạng thống kê trong học máy, và một lịch sử đen tối hơn giải thích *tại sao* những ngôn ngữ cần đến công nghệ nhất lại chính là những ngôn ngữ không có công nghệ hỗ trợ. Sợi chỉ thứ tư đó là lịch sử đàn áp ngôn ngữ thuộc địa và diệt chủng văn hóa—sự hủy diệt có chủ đích, mang tính hệ thống đối với các ngôn ngữ bản địa trên khắp mọi châu lục nơi các cường quốc châu Âu thiết lập quyền thống trị. Nếu không hiểu lịch sử đó, vấn đề kỹ thuật trông sẽ chỉ như một sự cố ngẫu nhiên của việc khan hiếm dữ liệu. Nhưng đó không phải là sự cố ngẫu nhiên.

Tài liệu này theo dấu cả bốn sợi chỉ từ nguồn gốc của chúng cho đến khi chúng hội tụ ở thời điểm hiện tại. Phải thừa nhận rằng, nó có phần mang tính Whig (Whiggish)—kể câu chuyện như thể nó luôn dẫn đến đây. Lịch sử, tất nhiên, không biết mình sẽ đi về đâu. Nhưng các sợi chỉ là có thật, các mối liên kết là chân thực, và việc hiểu chúng là điều cần thiết để hiểu tại sao các dự án như champollion tồn tại, tại sao chúng được xây dựng theo cách chúng được xây dựng, và tại sao chúng lại quan trọng vào lúc này.

---

## I. Ngữ pháp của Mọi thứ: Từ Pāṇini đến Chomsky

### Ngữ pháp Hình thức Đầu tiên (khoảng Thế kỷ thứ 4 TCN)

Câu chuyện bắt đầu không phải ở một trường đại học châu Âu mà ở Ấn Độ cổ đại, với một học giả tên là Pāṇini. Khoảng thế kỷ thứ 4 TCN, Pāṇini đã biên soạn cuốn *Aṣṭādhyāyī*—một cuốn ngữ pháp tiếng Phạn gồm khoảng 4.000 quy tắc. Đây không phải là ngữ pháp theo nghĩa sư phạm lỏng lẻo. Đó là một ngữ pháp *tạo sinh* (generative grammar): một tập hợp hữu hạn các quy tắc có khả năng tạo ra mọi phát ngôn hợp lệ trong ngôn ngữ đó về mặt nguyên lý.

Hệ thống của Pāṇini sử dụng những gì mà ngày nay chúng ta công nhận là các quy tắc viết lại hình thức (formal rewriting rules), với các biến số, đệ quy và áp dụng theo thứ tự. Nhà ngôn ngữ học Paul Kiparsky đã lập luận rằng *Aṣṭādhyāyī* là "ngữ pháp tạo sinh hoàn chỉnh nhất của bất kỳ ngôn ngữ nào từng được viết ra" (Kiparsky, 1993). Nhà khoa học máy tính Gerard Huet đã chỉ ra rằng các quy tắc của Pāṇini có thể được mô hình hóa như một bộ chuyển đổi trạng thái hữu hạn (finite-state transducer)—cùng một hình thức tính toán mà hai mươi lăm thế kỷ sau, sẽ trở thành trung tâm của phân tích hình thái cho các ngôn ngữ đa tổng hợp (polysynthetic languages).

Pāṇini không biết mình đang làm khoa học máy tính. Nhưng thực tế là ông đã làm điều đó.

### Bia đá Rosetta và Sự ra đời của Ngôn ngữ học So sánh (1799)

Trong hầu hết lịch sử được ghi chép lại, việc nghiên cứu ngôn ngữ chủ yếu là nghiên cứu ngôn ngữ *của chính mình*—hoặc cùng lắm là nghiên cứu một ngôn ngữ thiêng liêng hoặc cổ điển cho các mục đích phụng vụ. Cuộc cách mạng trí tuệ tạo ra ngôn ngữ học hiện đại bắt đầu bằng một phiến đá.

Bia đá Rosetta, được những người lính của Napoleon phát hiện vào năm 1799, khắc cùng một sắc lệnh bằng ba chữ viết: chữ tượng hình Ai Cập, chữ Demotic và tiếng Hy Lạp cổ đại. Việc Jean-François Champollion giải mã chữ tượng hình vào năm 1822 không chỉ là một chiến thắng khảo cổ học. Nó đã chứng minh một nguyên lý trở thành nền tảng: rằng các ngôn ngữ có thể được hiểu *thông qua nhau*. Dịch thuật không chỉ đơn thuần là một kỹ năng thực hành; nó là một phương pháp nghiên cứu khoa học.

### William Jones và Giả thuyết Ấn-Âu (1786)

Ngay cả trước Champollion, nhà ngữ văn học người Anh Sir William Jones đã trình bày bài giảng nổi tiếng của mình trước Hiệp hội Á châu Bengal vào năm 1786, nhận xét rằng tiếng Phạn có "mối quan hệ chặt chẽ với tiếng Hy Lạp và tiếng Latinh, cả về gốc động từ và các dạng ngữ pháp, mạnh mẽ đến mức không thể nào là do ngẫu nhiên tạo ra." Jones đề xuất rằng cả ba đều bắt nguồn từ một tổ tiên chung "mà có lẽ không còn tồn tại."

Đây là sự ra đời của ngôn ngữ học lịch sử và so sánh. Nó xác định rằng các ngôn ngữ không phải là các thực thể cô lập, tĩnh tại mà là các thành viên của các ngữ hệ—liên kết với nhau bằng nguồn gốc, được định hình bởi thời gian, tuân theo các quy luật thay đổi thường xuyên. Theo cách của nó, đây là một lý thuyết tiến hóa trước Darwin hàng thập kỷ.

### Cây Ngôn ngữ của August Schleicher (1861)

Chính August Schleicher, một nhà ngôn ngữ học người Đức, đã làm cho mối liên hệ Darwin trở nên rõ ràng. Vào năm 1861—chỉ hai năm sau cuốn *Nguồn gốc các loài*—Schleicher đã xuất bản mô hình *Stammbaum* (cây gia đình) của các ngôn ngữ Ấn-Âu. Các sơ đồ của ông trông gần như không thể phân biệt được với cây phát sinh chủng loại trong sinh học. Ngôn ngữ, giống như các loài sinh vật, phân nhánh, phân tách và thỉnh thoảng bị tuyệt chủng.

Các cây của Schleicher là một sự đơn giản hóa (các ngôn ngữ cũng *hội tụ* thông qua tiếp xúc, vay mượn và creole hóa), nhưng mô hình này đã chứng minh hiệu quả to lớn. Nó thiết lập nguyên lý rằng sự đa dạng ngôn ngữ không phải là nhiễu ngẫu nhiên mà là dữ liệu có cấu trúc, có thể phân tích một cách hệ thống. Và nó đặt ra một câu hỏi ngầm vốn vẫn là trung tâm của dự án của chúng tôi: điều gì xảy ra với các nhánh đang chết dần?

### Ferdinand de Saussure và Kiến trúc của Ngôn ngữ (1916)

Cuộc cách mạng tiếp theo đến từ Ferdinand de Saussure, người có cuốn *Cours de linguistique générale* (Giáo trình ngôn ngữ học đại cương, xuất bản sau khi ông qua đời vào năm 1916 từ ghi chép của sinh viên) đã thiết lập ngôn ngữ học cấu trúc. Saussure phân biệt rõ ràng giữa *langue* (hệ thống trừu tượng của một ngôn ngữ) và *parole* (lời nói thực tế). Ông lập luận rằng các ký hiệu ngôn ngữ là *độc đoán*—từ "cây" không mang mối liên hệ vốn có nào với những cái cây thực tế—và ý nghĩa nảy sinh từ *sự khác biệt* trong một hệ thống, chứ không phải từ bất kỳ nội dung tích cực nào.

Sơ đồ then chốt của Saussure—hình bầu dục được chia đôi giữa *signifié* (cái được biểu đạt, khái niệm) và *signifiant* (cái biểu đạt, hình ảnh âm thanh), được liên kết bằng các mũi tên thể hiện mối quan hệ không thể tách rời của chúng—đã trở thành một trong những hình ảnh được tái bản nhiều nhất trong các ngành nhân văn. Nó thiết lập nguyên lý rằng một ngôn ngữ là một *hệ thống của các hệ thống*, nơi mỗi yếu tố có được giá trị từ các mối quan hệ của nó với tất cả các yếu tố khác.

Điều này có ý nghĩa sâu sắc đối với dịch thuật. Nếu ý nghĩa mang tính quan hệ và hệ thống, thì dịch thuật không phải là việc tráo đổi các từ ngữ. Nó đòi hỏi sự hiểu biết về toàn bộ kiến trúc của một ngôn ngữ. Hai ngôn ngữ có thể phân chia thế giới theo những cách cơ bản khác nhau—một hiểu biết sau này được phát triển (và đôi khi bị cường điệu hóa) bởi Edward Sapir và Benjamin Lee Whorf.

### Sapir, Bloomfield, và Nghiên cứu về các Ngôn ngữ Bản địa

Ở Bắc Mỹ, đầu thế giới thứ 20 đã mang lại một truyền thống nghiên cứu thực địa ngôn ngữ khác. Edward Sapir và Leonard Bloomfield đã làm việc sâu rộng với các ngôn ngữ bản địa—Sapir với tiếng Navajo, Nootka và nhiều ngôn ngữ khác; Bloomfield với tiếng Menomini và các ngôn ngữ Algonquian khác. Họ đã gặp phải các cấu trúc ngôn ngữ hoàn toàn khác biệt với bất kỳ thứ gì trong ngữ hệ Ấn-Âu.

Đặc biệt, Sapir đã phát triển một khung phân loại ngôn ngữ theo nhiều trục, bao gồm sự phân biệt quan trọng giữa ngôn ngữ *đơn lập* (analytic - như tiếng Anh, nơi các từ có xu hướng ngắn và ý nghĩa được truyền tải bằng trật tự từ) và ngôn ngữ *đa tổng hợp* (polysynthetic - như tiếng Cree, nơi một từ duy nhất có thể mã hóa những gì tiếng Anh sẽ diễn đạt bằng cả một câu). Một dạng động từ tiếng Cree duy nhất có thể tích hợp chủ ngữ, tân ngữ, thì, thể, tính chứng thực (evidentiality) và một số yếu tố bổ nghĩa vào một từ phức tạp về mặt hình thái.

Công việc này đã xác định hai thực tế vẫn là trung tâm của dự án của chúng tôi. Thứ nhất: các ngôn ngữ trên thế giới đa dạng về cấu trúc hơn nhiều so với bất kỳ mô hình lấy châu Âu làm trung tâm nào đề xuất. Thứ hai: nhiều ngôn ngữ trong số này đã bị đe dọa tuyệt chủng. Tuy nhiên, trong khi các nhà ngôn ngữ học cấu trúc thời kỳ đầu ghi chép lại sự phức tạp này, họ thường tham gia vào "nhân học cứu hộ" (salvage anthropology)—một mô hình học thuật mang tính khai thác, coi người bản địa chỉ đơn thuần là "người cung cấp thông tin" để xây dựng sự nghiệp học thuật phương Tây. Cách tiếp cận này đã cắt đứt ngôn ngữ khỏi cội nguồn nhận thức luận của chúng, mở đường cho việc coi ngôn ngữ là dữ liệu tách rời, có thể khai thác được thay vì là các hệ thống sống động, mang tính quan hệ.

### Cuộc cách mạng Chomsky (1957)

Vào năm 1957, một nhà ngôn ngữ học 28 tuổi của MIT tên là Noam Chomsky đã xuất bản cuốn *Syntactic Structures* (Các cấu trúc cú pháp), một cuốn sách mỏng nhưng đã gây chấn động mạnh mẽ trong lĩnh vực này. Chomsky lập luận rằng mục tiêu của ngôn ngữ học nên là khám phá ra *ngữ pháp tạo sinh* của một ngôn ngữ—một tập hợp hữu hạn các quy tắc có thể tạo ra tất cả và chỉ những câu đúng ngữ pháp của ngôn ngữ đó.

Khiêu khích hơn, Chomsky đề xuất *hệ phân cấp Chomsky*: một phân loại các ngữ pháp hình thức theo sức mạnh tính toán của chúng. Hệ phân cấp có bốn cấp độ:

- **Loại 3 (Chính quy - Regular)**: Được nhận dạng bởi các máy tự động hữu hạn. Các mẫu đơn giản.
- **Loại 2 (Phi ngữ cảnh - Context-Free)**: Được nhận dạng bởi các máy tự động đẩy xuống. Các cấu trúc đệ quy như dấu ngoặc lồng nhau.
- **Loại 1 (Cực ngữ cảnh - Context-Sensitive)**: Được nhận dạng bởi các máy tự động giới hạn tuyến tính. Các phụ thuộc phức tạp hơn.
- **Loại 0 (Đệ quy đếm được - Recursively Enumerable)**: Được nhận dạng bởi máy Turing. Bất cứ thứ gì có thể tính toán được.

Chomsky lập luận rằng các ngôn ngữ tự nhiên đòi hỏi ít nhất là ngữ pháp phi ngữ cảnh, và có thể hơn thế nữa. Đây là chiếc cầu nối trực tiếp giữa ngôn ngữ học và lý thuyết toán học về tính toán. Cùng một công cụ hình thức mà Alan Turing đã phát triển để suy luận về các giới hạn của tính toán giờ đây có thể được áp dụng cho ngôn ngữ của con người.

Chomsky cũng đề xuất ý tưởng về *Ngữ pháp Phổ quát* (Universal Grammar)—rằng khả năng ngôn ngữ là bẩm sinh, rằng tất cả các ngôn ngữ của con người đều chia sẻ các đặc tính cấu trúc sâu sắc, và sự đa dạng của các dạng bề mặt che giấu một sự thống nhất bên dưới. Điều này vẫn còn gây tranh cãi (nhiều nhà phân loại học và nhà chức năng học không đồng ý), nhưng các công cụ hình thức mà Chomsky giới thiệu—các quy tắc cấu trúc cụm, ngữ pháp cải biến, và chính hệ phân cấp—đã trở thành nền tảng của ngôn ngữ học tính toán.

---

## II. Giấc mơ về Dịch thuật Phổ quát

### Cỗ máy Tư duy của Ramon Llull (1305)

Giấc mơ cơ giới hóa tư duy—và cùng với nó, giấc mơ về dịch thuật cơ học—đã có từ rất lâu đời. Ramon Llull, một nhà thần bí người Catalan thế kỷ 13, đã thiết kế *Ars Magna*: một hệ thống các đĩa đồng tâm xoay được khắc các khái niệm cơ bản, mà sự kết hợp của chúng nhằm tạo ra tất cả các sự thật có thể có. Các bánh xe của Llull, theo một nghĩa nào đó, là cỗ máy logic tổ hợp đầu tiên. Leibniz sau này đã trích dẫn Llull như một nguồn cảm hứng.

### Athanasius Kircher và Polygraphia Nova (1663)

Athanasius Kircher, nhà bác học vĩ đại dòng Tên, đã xuất bản cuốn *Polygraphia Nova et Universalis* vào năm 1663—một hệ thống "chữ viết phổ quát" nhằm cho phép giao tiếp vượt qua rào cản ngôn ngữ. Hệ thống của Kircher gán các con số cho các khái niệm, sau đó có thể được giải mã sang bất kỳ ngôn ngữ nào bằng bảng tra cứu thích hợp. Về bản chất, nó là một interlingua—một biểu diễn ý nghĩa độc lập với ngôn ngữ.

Hệ thống này hoạt động không tốt lắm. Nhưng *ý tưởng* vẫn tồn tại: rằng giữa hai ngôn ngữ bất kỳ luôn tồn tại một không gian khái niệm chung, và dịch thuật là việc ánh xạ thông qua không gian đó. Giả thuyết interlingua này không chỉ là một thử nghiệm khoa học thiếu sót; nó là một sự mở rộng nhận thức luận của sự kiểm soát thuộc địa, không có khả năng ánh xạ các bản thể luận khác biệt. Nhà triết học W.V.O. Quine sau này đã hình thức hóa thất bại này với khái niệm *tính bất định của dịch thuật* (indeterminacy of translation - 1960), lập luận rằng dịch thuật triệt để vốn dĩ là bất định. Việc ánh xạ phổ quát, phi ngữ cảnh giữa các hệ thống ngôn ngữ khác biệt căn bản là một điều bất khả thi về mặt triết học, chứ không đơn thuần là một rào cản kỹ thuật.

### John Wilkins và Ngôn ngữ Triết học (1668)

Chỉ năm năm sau Kircher, nhà triết học tự nhiên người Anh John Wilkins đã xuất bản cuốn *An Essay towards a Real Character, and a Philosophical Language*—một nỗ lực tạo ra một ngôn ngữ mà cấu trúc của nó *phản chiếu hoàn hảo cấu trúc của thực tại*. Mọi khái niệm sẽ được phân loại trong một hệ thống phân loại lớn, và tên của nó sẽ mã hóa vị trí của nó trong hệ thống phân loại đó.

Dự án của Wilkins đã thất bại (thực tại tỏ ra kháng cự lại sự phân loại gọn gàng), nhưng nó đã dự đoán trước một điều quan trọng: ý tưởng rằng ngôn ngữ có thể được *thiết kế*, rằng mối quan hệ giữa từ ngữ và ý nghĩa có thể được thực hiện một cách hệ thống và rõ ràng. Theo một nghĩa sâu sắc, đây chính là những gì các nhà ngôn ngữ học tính toán làm khi họ xây dựng các bản thể luận (ontologies) và đồ thị tri thức (knowledge graphs).

### Leibniz và Characteristica Universalis

Gottfried Wilhelm Leibniz, người đã độc lập phát minh ra giải tích và thiết kế một máy tính cơ học, đã mơ về một *characteristica universalis*—một ngôn ngữ hình thức phổ quát trong đó tất cả tri thức nhân loại có thể được diễn đạt—và một *calculus ratiocinator*—một cỗ máy có thể suy luận bằng ngôn ngữ đó. "Nếu có tranh chấp nảy sinh," Leibniz viết, "thì hai nhà triết học sẽ không cần phải tranh luận nhiều hơn hai kế toán viên. Bởi vì chỉ cần cầm bút chì trong tay, ngồi vào bàn đá, và nói với nhau: Chúng ta hãy tính toán."

Leibniz cũng phát minh ra số học nhị phân—hệ thống số mà nhiều thế kỷ sau, sẽ trở thành ngôn ngữ của máy tính kỹ thuật số. Tài liệu năm 1703 của ông *Explication de l'Arithmétique Binaire* đã chỉ ra rằng bất kỳ số nào cũng có thể được biểu diễn chỉ bằng cách sử dụng 0 và 1. Ông coi đây là sự phản chiếu của sự sáng tạo thiêng liêng (tạo ra thứ gì đó từ hư vô), nhưng nó đã chứng minh là nền tảng của mọi tính toán kỹ thuật số.

### Bản ghi nhớ của Warren Weaver (1949)

Kỷ nguyên hiện đại của dịch máy bắt đầu bằng một bản ghi nhớ. Vào tháng 7 năm 1949, nhà toán học và nhà quản lý khoa học người Mỹ Warren Weaver đã viết thư cho Norbert Wiener, đề xuất rằng các máy tính điện tử mới có thể được áp dụng cho dịch thuật. Bản ghi nhớ của ông chứa đoạn văn đáng chú ý được trích dẫn ở đầu tài liệu này: ý tưởng rằng một văn bản tiếng Nga "thực chất được viết bằng tiếng Anh, nhưng... được mã hóa bằng một số ký hiệu kỳ lạ."

Phép ẩn dụ của Weaver được rút ra từ phân tích mật mã thời chiến—ý tưởng rằng dịch thuật về cơ bản là một bài toán *giải mã*. Đây không chỉ đơn thuần là một phép so sánh. Các công cụ lý thuyết thông tin và thống kê tương tự đã được phát triển để bẻ khóa mật mã của kẻ thù, Weaver gợi ý, có thể áp dụng cho bài toán dịch thuật.

Bản ghi nhớ này lạc quan một cách thái quá, nhưng nó đã khởi động một chương trình nghiên cứu. Trong vòng năm năm, buổi trình diễn dịch máy đầu tiên đã diễn ra.

---

## III. Bộ máy của Tư duy: Tính toán và Thông tin

### George Boole và Đại số Logic (1854)

Vào năm 1854, George Boole đã xuất bản cuốn *An Investigation of the Laws of Thought*—một công trình giảm suy luận logic thành các phép toán đại số. Boole chỉ ra rằng các mệnh đề logic có thể được thao tác bằng các quy tắc tương tự như đại số, với phép VÀ (AND) tương ứng với phép nhân, HOẶC (OR) tương ứng với phép cộng, và PHỦ ĐỊNH (NOT) tương ứng với phần bù.

Đại số Boolean dường như là một sự tò mò toán học vào thời điểm đó. Nhưng nó đã trở thành nguyên lý hoạt động của mọi mạch kỹ thuật số từng được chế tạo.

### Charles Babbage và Ada Lovelace (1837–1843)

Charles Babbage đã thiết kế (nhưng chưa bao giờ hoàn thành) Analytical Engine (Máy Phân tích)—một máy tính đa năng, chạy bằng hơi nước, hoạt động bằng cơ học. Không giống như Difference Engine (Máy Vi phân) trước đó của ông (một máy tính chuyên dụng), Analytical Engine có bộ nhớ ("the Store"), bộ xử lý ("the Mill"), rẽ nhánh có điều kiện và vòng lặp. Về mặt nguyên lý, nó là Turing-complete.

Ada Lovelace, làm việc từ bản mô tả của cỗ máy, đã viết một tập hợp các ghi chú chi tiết bao gồm những gì được coi là chương trình máy tính đầu tiên được công bố: một thuật toán để tính số Bernoulli (Ghi chú G, 1843). Nhưng đóng góp sâu sắc nhất của Lovelace mang tính khái niệm. Bà thấy rằng cỗ máy có thể thao tác các *ký hiệu*, chứ không chỉ các con số. "Analytical Engine dệt các mẫu đại số," bà viết, "giống như khung dệt Jacquard dệt hoa và lá." Ý nghĩa của điều này—rằng tính toán có thể được áp dụng cho bất kỳ lĩnh vực nào có cấu trúc hình thức, bao gồm cả ngôn ngữ—là một dự đoán thiên tài.

### Alan Turing và Cỗ máy Phổ quát (1936)

Vào năm 1936, Alan Turing đã xuất bản tài liệu "On Computable Numbers, with an Application to the Entscheidungsproblem"—một tài liệu đồng thời định nghĩa tính toán, chứng minh các giới hạn của nó và phát minh ra máy tính hiện đại (dưới dạng trừu tượng).

Insight then chốt của Turing là *cỗ máy phổ quát* (universal machine): một cỗ máy duy nhất, khi được cung cấp các hướng dẫn thích hợp được mã hóa trên băng của nó, có thể mô phỏng *bất kỳ* cỗ máy nào khác. Điều này xác định rằng không có sự khác biệt cơ bản giữa phần cứng và phần mềm, giữa máy móc và chương trình. Một thiết bị duy nhất, được lập trình đúng cách, có thể tính toán bất cứ thứ gì có thể tính toán được.

Công trình của Turing cũng thiết lập các giới hạn của tính toán (bài toán dừng - halting problem) và đặt nền móng cho việc khám phá trí tuệ máy móc sau này của ông. Tài liệu năm 1950 của ông "Computing Machinery and Intelligence," đề xuất Phép thử Turing (Turing Test) nổi tiếng, đã đóng khung câu hỏi về trí tuệ máy móc một cách rõ ràng dưới dạng *ngôn ngữ*: một cỗ máy là thông minh nếu, thông qua trò chuyện, nó không thể bị phân biệt với con người.

### Claude Shannon và Lý thuyết Thông tin (1948)

Vào năm 1948, Claude Shannon đã xuất bản tài liệu "A Mathematical Theory of Communication" trên tạp chí *Bell System Technical Journal*—một tài liệu sáng lập ra lĩnh vực lý thuyết thông tin. Shannon chỉ ra rằng truyền thông có thể được mô hình hóa như một hệ thống: một *nguồn thông tin* tạo ra một *thông điệp*, một *bộ phát* mã hóa thông điệp đó thành một *tín hiệu*, tín hiệu này đi qua một *kênh* (chịu tác động của *nhiễu*), một *bộ thu* giải mã tín hiệu trở lại thành thông điệp cho một *đích đến*.

Đóng góp then chốt của Shannon là khái niệm *entropy*—một thước đo tính không chắc chắn hoặc nội dung thông tin của một thông điệp. Ông đã chứng minh rằng đối với bất kỳ kênh nào có mức nhiễu nhất định, luôn tồn tại một tốc độ tối đa mà tại đó thông tin có thể được truyền đi một cách đáng tin cậy (dung lượng kênh), và tốc độ này có thể đạt được bằng cách mã hóa đủ thông minh.

Mối liên hệ với dịch thuật là rất sâu sắc. Chính Shannon, trong một tài liệu năm 1951, đã sử dụng lý thuyết thông tin để phân tích cấu trúc thống kê của tiếng Anh. Ông chỉ ra rằng văn bản tiếng Anh có tính dư thừa cao—rằng một người bản ngữ, khi được cung cấp một chuỗi các chữ cái, có thể dự đoán chữ cái tiếp theo với độ chính xác cao. Sự dư thừa này là thứ giúp truyền thông mạnh mẽ trước nhiễu, nhưng nó cũng có nghĩa là *nội dung thông tin* của ngôn ngữ thấp hơn nhiều so với số lượng ký hiệu thô của nó.

Warren Weaver ngay lập tức thấy được mối liên hệ: nếu dịch thuật là giải mã, và nếu cấu trúc thống kê của ngôn ngữ có thể được mô hình hóa, thì dịch thuật là một bài toán lý thuyết thông tin. Insight này phải mất nhiều thập kỷ mới đơm hoa kết trái, nhưng khi nó xảy ra, nó đã thay đổi hoàn toàn lĩnh vực này.

### Von Neumann và Máy tính Chương trình Lưu trữ (1945)

Báo cáo năm 1945 của John von Neumann về EDVAC (Electronic Discrete Variable Automatic Computer) đã mô tả những gì chúng ta gọi là *kiến trúc von Neumann*: một máy tính có một bộ nhớ duy nhất cho cả dữ liệu và hướng dẫn, một bộ xử lý trung tâm và các cơ chế đầu vào/đầu ra. Kiến trúc này—dữ liệu và chương trình chia sẻ cùng một bộ nhớ, được xử lý tuần tự bởi CPU—vẫn là thiết kế cơ bản của hầu hết mọi máy tính được sử dụng ngày nay.

Kiến trúc von Neumann đã làm cho phần mềm trở nên thực tế. Các chương trình có thể được lưu trữ, sửa đổi và thậm chí được tạo ra bởi các chương trình khác. Đây là điều kiện tiên quyết về mặt công nghệ cho mọi thứ diễn ra sau đó: trình biên dịch, hệ điều hành, và cuối cùng là các khung mạng thần kinh cung cấp sức mạnh cho dịch máy hiện đại.

---

## IV. Dịch máy: Bài toán AI Đầu tiên

### Thử nghiệm Georgetown-IBM và Chiến tranh Lạnh (1954)

Vào ngày 7 tháng 1 năm 1954, các nhà nghiên cứu tại Đại học Georgetown và IBM đã trình diễn hệ thống dịch máy công cộng đầu tiên. Hệ thống đã dịch 60 câu tiếng Nga sang tiếng Anh bằng cách sử dụng vốn từ vựng gồm 250 từ và sáu quy tắc ngữ pháp. Các câu được lựa chọn cẩn thận để nằm trong khả năng của hệ thống, nhưng buổi trình diễn đã tạo ra sự phấn khích to lớn.

Tờ *New York Times* đưa tin rằng thử nghiệm này báo hiệu một tương lai nơi "một dịch giả điện tử nút bấm" sẽ giúp tất cả các tài liệu khoa học trên thế giới có thể truy cập ngay lập tức. Tuy nhiên, sự lạc quan công khai này đã che giấu thực tế vật chất về nguồn vốn và mục đích của dự án. Thử nghiệm Georgetown-IBM—và lĩnh vực dịch máy thời kỳ đầu nói chung—không được thúc đẩy bởi mong muốn không tưởng về giao tiếp phổ quát. Nó được tài trợ bởi quân đội Hoa Kỳ và bộ máy tình báo (bao gồm CIA và DARPA) như một yêu cầu cấp bách của Chiến tranh Lạnh nhằm giám sát và chặn các văn bản khoa học và quân sự của Liên Xô.

Quan điểm coi ngôn ngữ là một "mật mã cần bẻ khóa" (như Weaver đã nói) gắn liền với hoạt động giám sát quân sự hóa. Các nhà nghiên cứu dự đoán rằng dịch máy sẽ là một vấn đề được giải quyết trong vòng năm năm. Họ đã sai hơn nửa thế kỷ.

### Báo cáo ALPAC và Mùa đông AI Đầu tiên (1966)

Vào năm 1966, Ủy ban Cố vấn Xử lý Ngôn ngữ Tự động (ALPAC), do chính phủ Hoa Kỳ triệu tập, đã ban hành một báo cáo gây chấn động. Sau khi xem xét một thập kỷ nghiên cứu dịch máy (MT), ALPAC kết luận rằng dịch máy chậm hơn, kém chính xác hơn và đắt đỏ hơn dịch thuật của con người, đồng thời khuyến nghị chuyển hướng tài trợ sang nghiên cứu cơ bản trong ngôn ngữ học tính toán.

Báo cáo ALPAC đã chấm dứt nguồn tài trợ nghiên cứu MT tại Hoa Kỳ trong hơn một thập kỷ. Đó là "mùa đông AI" đầu tiên—một mô hình sẽ lặp lại: những lời hứa ngông cuồng, kết quả khiêm tốn, sự vỡ mộng, và sự sụp đổ tài trợ.

Nhưng báo cáo cũng chứa đựng một insight sâu sắc hơn. Dịch máy đã thất bại, một phần, vì ngôn ngữ khó hơn bất kỳ ai mong đợi. Cách tiếp cận dựa trên quy tắc—viết các quy tắc ngữ pháp rõ ràng để phân tích cú pháp và tạo câu—hoạt động cho các trường hợp đơn giản nhưng thất bại thảm hại trên văn bản thực tế. Ngôn ngữ quá mơ hồ, quá phụ thuộc vào ngữ cảnh, quá *sống động* để các quy tắc cứng nhắc có thể nắm bắt được.

### MT Dựa trên Quy tắc và Dựa trên Chuyển đổi (Thập niên 1970–1980)

Nghiên cứu vẫn tiếp tục, lặng lẽ hơn, trong suốt thập niên 1970 và 1980. Các hệ thống như SYSTRAN (cung cấp sức mạnh cho các dịch vụ dịch thuật ban đầu của Ủy ban Châu Âu) đã sử dụng các từ điển lớn được xây dựng thủ công và các quy tắc chuyển đổi để ánh xạ giữa các cặp ngôn ngữ. Các hệ thống này có thể tạo ra các bản dịch thô hữu ích cho các lĩnh vực bị hạn chế, nhưng chúng đòi hỏi nỗ lực kỹ thuật khổng lồ cho mỗi cặp ngôn ngữ, và chúng hiếm khi xử lý tốt các văn bản không bị giới hạn.

Vấn đề cơ bản đã rõ ràng: ngôn ngữ không phải là một mật mã. Bạn không thể dịch bằng cách tra từ trong từ điển và sắp xếp lại chúng theo các quy tắc ngữ pháp, bởi vì ý nghĩa phụ thuộc vào ngữ cảnh, vào tri thức thế giới, vào ý định của người nói, vào toàn bộ lịch sử của một cuộc trò chuyện. Cách tiếp cận interlingua—dịch thông qua một biểu diễn trừu tượng, độc lập với ngôn ngữ—về mặt lý thuyết thì thanh lịch nhưng thực tế lại bất khả thi. Không ai có thể định nghĩa được interlingua.

### Cuộc cách mạng Thống kê (Thập niên 1990)

Bước đột phá không đến từ các quy tắc tốt hơn mà từ dữ liệu tốt hơn. Vào cuối thập niên 1980 và đầu thập niên 1990, các nhà nghiên cứu tại IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra, và Robert Mercer) đã phát triển một loạt các mô hình thống kê cho dịch máy—các Mô hình IBM nổi tiếng từ 1 đến 5.

Insight then chốt là ý tưởng cũ của Weaver, cuối cùng đã được thực hiện một cách nghiêm ngặt: dịch thuật như một quá trình giải mã. Cho một câu tiếng nước ngoài *f*, tìm câu tiếng Anh *e* sao cho tối đa hóa P(e|f). Theo định lý Bayes, điều này tương đương với việc tối đa hóa P(f|e) × P(e)—một *mô hình dịch* (khả năng câu tiếng nước ngoài này xuất hiện khi có câu tiếng Anh này là bao nhiêu?) nhân với một *mô hình ngôn ngữ* (khả năng câu tiếng Anh này tự xuất hiện là bao nhiêu?).

Các mô hình IBM đã học các xác suất này từ các *song ngữ ngữ liệu* (parallel corpora) lớn—các bộ sưu tập văn bản tồn tại ở cả hai ngôn ngữ (như các biên bản Hansard của nghị viện Canada, được xuất bản bằng cả tiếng Anh và tiếng Pháp). Không cần quy tắc thủ công nào. Hệ thống học cách dịch bằng cách quan sát hàng triệu ví dụ về dịch thuật của con người.

MT thống kê hoạt động hiệu quả hơn đáng kể so với MT dựa trên quy tắc đối với các ngôn ngữ có nguồn dữ liệu song ngữ dồi dào. Nó cũng giới thiệu một phần hạ tầng quan trọng: **điểm BLEU** (Papineni et al., 2002), một chỉ số để tự động đánh giá chất lượng dịch thuật bằng cách so sánh đầu ra của máy với các bản dịch tham chiếu của con người. BLEU giúp đo lường tiến trình một cách định lượng và chạy các thử nghiệm quy mô lớn.

Nhưng MT thống kê có một giả định chí mạng đi kèm: nó yêu cầu *song ngữ ngữ liệu*. Đối với các cặp ngôn ngữ lớn trên thế giới—Anh-Pháp, Anh-Trung, Anh-Tây Ban Nha—dữ liệu song ngữ rất dồi dào. Đối với đại đa số trong số 7,000 ngôn ngữ trên thế giới, dữ liệu này đơn giản là không tồn tại.

### Cuộc cách mạng Thần kinh: Seq2Seq, Attention, Transformers (2014–2017)

Sự chuyển đổi tiếp theo đến với học sâu (deep learning). Vào năm 2014, Ilya Sutskever, Oriol Vinyals, và Quoc Le đã trình diễn các mô hình *sequence-to-sequence* (seq2seq) cho MT: các mạng thần kinh có thể đọc toàn bộ một câu bằng một ngôn ngữ và tạo ra bản dịch bằng một ngôn ngữ khác, không cần bất kỳ sự căn chỉnh rõ ràng hay bảng cụm từ nào.

Vào năm 2015, Dzmitry Bahdanau, Kyunghyun Cho, và Yoshua Bengio đã giới thiệu *cơ chế chú ý* (attention mechanism)—cho phép bộ giải mã "nhìn lại" các phần khác nhau của câu nguồn trong khi tạo ra từng từ của bản dịch. Điều này đã cải thiện đáng kể hiệu suất trên các câu dài.

Và vào năm 2017, Vaswani và các cộng sự tại Google đã xuất bản tài liệu "Attention Is All You Need," giới thiệu kiến trúc *Transformer*. Transformer loại bỏ hoàn toàn tính tuần hoàn (recurrence), xử lý toàn bộ các chuỗi song song bằng cách sử dụng cơ chế tự chú ý (self-attention). Nó huấn luyện nhanh hơn, dễ mở rộng hơn và tạo ra các bản dịch tốt hơn bất kỳ thứ gì trước đó.

Transformers dẫn trực tiếp đến các mô hình ngôn ngữ lớn (LLMs) của thập niên 2020: GPT, BERT, PaLM, LLaMA, và các thế hệ sau của chúng. Các mô hình này, được huấn luyện trên lượng văn bản khổng lồ từ internet, có thể dịch giữa hàng trăm cặp ngôn ngữ với độ trôi chảy đáng kinh ngạc.

Nhưng "độ trôi chảy đáng kinh ngạc" không đồng nghĩa với "độ chính xác đáng tin cậy." Và đối với các ngôn ngữ nghèo tài nguyên trên thế giới, tình hình tồi tệ hơn nhiều so với những gì thể hiện bên ngoài.

---

## V. Lịch sử Khác: Ngôn ngữ, Quyền lực, và Diệt chủng Văn hóa

Bốn phần trước kể câu chuyện về các ý tưởng—về các nhà ngữ pháp, nhà toán học và kỹ sư xây dựng hướng tới dịch máy. Nhưng có một lịch sử khác, chạy song song, giải thích *tại sao* những ngôn ngữ cần đến công nghệ dịch thuật nhất lại chính là những ngôn ngữ không có công nghệ đó. Đây không phải là câu chuyện về sự khan hiếm dữ liệu như một sự thật trung lập. Đó là câu chuyện về sự hủy diệt có chủ đích.

Lý do tiếng Plains Cree không có sự hỗ trợ dịch máy không chủ yếu là vì tiếng Cree là một ngôn ngữ khó đối với máy tính (mặc dù đúng là như vậy). Đó là bởi vì, trong hơn một thế kỷ, chính phủ Canada và Hoa Kỳ đã thực hiện các chương trình có hệ thống nhằm xóa sổ các ngôn ngữ bản địa khỏi miệng của trẻ em. Sự "khan hiếm dữ liệu" khiến MT nghèo tài nguyên trở nên khó khăn như vậy, phần lớn là *hệ quả hạ nguồn của nạn diệt chủng văn hóa*. Bất kỳ báo cáo trung thực nào về lý do tại sao các ngôn ngữ này cần công nghệ đều phải đối mặt với lý do tại sao chúng bị đưa đến bờ vực tuyệt chủng ngay từ đầu.

### Trước khi Tiếp xúc: Một Lục địa của các Ngôn ngữ

Sự đa dạng ngôn ngữ của châu Mỹ trước khi tiếp xúc với người châu Âu là vô cùng kinh ngạc. Vào thời điểm tiếp xúc với châu Âu, riêng Bắc Mỹ là nhà của khoảng 300 đến 600 ngôn ngữ riêng biệt, được tổ chức thành hàng chục ngữ hệ không liên quan—nhiều sự đa dạng di truyền hơn toàn bộ châu Âu. Nam Mỹ có thể có 1,500 ngôn ngữ hoặc hơn (Campbell, 1997). Úc có hơn 250 ngôn ngữ. Các đảo Thái Bình Dương, châu Phi cận Sahara và Đông Nam Á đại lục cũng đa dạng tương tự.

Đây không phải là những ngôn ngữ "nguyên thủy" hay "đơn giản". Nhiều ngôn ngữ phức tạp nhất về mặt cấu trúc từng được ghi nhận là ngôn ngữ bản địa. Hình thái đa tổng hợp của các ngôn ngữ Algonquian (bao gồm tiếng Cree, Ojibwe, và Blackfoot), hệ thống thanh điệu của tiếng Navajo, việc đánh dấu tính chứng thực phức tạp của tiếng Quechua, các phụ âm click của các ngôn ngữ Khoisan—những thứ này đại diện cho toàn bộ phạm vi của những gì ngôn ngữ nhân loại có thể đạt tới. Chúng mã hóa các hệ thống tri thức tinh vi về quan hệ họ hàng, sinh thái, luật pháp, tâm linh và lịch sử. Mỗi ngôn ngữ là một thư viện—một hồ sơ không thể thay thế về cách một cộng đồng hiểu và tổ chức thế giới.

Edward Sapir đã nhận ra điều này một cách rõ ràng. Viết vào năm 1921, ông nhận xét rằng "khi nói đến dạng ngôn ngữ, Plato đi cùng với người chăn lợn Macedonia, Khổng Tử đi cùng với người săn đầu người man rợ ở Assam." Ngôn ngữ của các dân tộc bản địa không hề kém cỏi hơn. Chúng khác biệt—và sự khác biệt của chúng chứa đựng tri thức mà không ngôn ngữ nào khác sở hữu.

### Cơ chế của Sự tàn lụi Ngôn ngữ

Ngôn ngữ không chết vì các nguyên nhân tự nhiên. Chúng chết khi các điều kiện truyền dạy bị gián đoạn—khi trẻ em ngừng học chúng, khi người nói bị trừng phạt vì sử dụng chúng, khi các động lực xã hội và kinh tế thay đổi khiến việc nói ngôn ngữ thống trị trở thành điều kiện để sinh tồn.

Sự gián đoạn này có thể xảy ra dần dần, thông qua áp lực kinh tế và nhân khẩu học. Nhưng trên khắp thế giới thuộc địa, nó diễn ra một cách cực kỳ *có chủ đích*. Việc đàn áp các ngôn ngữ bản địa không phải là tác dụng phụ của quá trình thuộc địa hóa. Đó là một mục tiêu chính sách được tuyên bố rõ ràng.

### Canada: Hệ thống Trường Nội trú Bản địa (1831–1996)

Tại Canada, hệ thống Trường Nội trú Bản địa (Indian Residential School) đã hoạt động trong hơn 160 năm, với mục tiêu rõ ràng là xóa bỏ ngôn ngữ và văn hóa bản địa. Ước tính có khoảng 150,000 trẻ em First Nations, Métis, và Inuit đã bị tách khỏi gia đình và cộng đồng của họ và đưa vào các trường nội trú do chính phủ tài trợ, nhà thờ điều hành.

Chính sách trung tâm đã được Duncan Campbell Scott, Phó Tổng Giám đốc phụ trách các vấn đề Bản địa, phát biểu với sự rõ ràng đến lạnh gáy vào năm 1920: "Tôi muốn loại bỏ vấn đề người Bản địa... Mục tiêu của chúng tôi là tiếp tục cho đến khi không còn một người Bản địa nào ở Canada chưa được đồng hóa vào thể chế chính trị và không còn câu hỏi về người Bản địa cũng như không còn Bộ phụ trách người Bản địa."

Cơ chế thực hiện là ngôn ngữ. Trẻ em bị cấm nói tiếng mẹ đẻ của mình. Các hình phạt cho việc nói ngôn ngữ bản địa dao động từ đánh đập, biệt giam cho đến việc bị kim đâm qua lưỡi. Trẻ em đến trường nói tiếng Cree, Ojibwe, Inuktitut, Dene, Haida, hoặc bất kỳ ngôn ngữ nào trong số hàng chục ngôn ngữ khác. Chúng bị trừng phạt cho đến khi dừng lại.

Ủy ban Sự thật và Hòa giải Canada (2015) đã ghi chép lại tính chất hệ thống của cuộc tấn công này. Báo cáo cuối cùng của ủy ban kết luận rằng hệ thống trường nội trú cấu thành hành vi *diệt chủng văn hóa*—sự hủy diệt các cấu trúc và thực hành cho phép một nhóm người tiếp tục tồn tại như một nhóm người. Ngôn ngữ là mục tiêu hàng đầu. Không có ngôn ngữ, các nghi lễ bị gián đoạn, lịch sử truyền khẩu bị phá vỡ, hệ thống quan hệ họ hàng trở nên không thể hiểu được, và việc truyền dạy tri thức qua các thế hệ bị chấm dứt.

Ngôi trường nội trú cuối cùng do liên bang vận hành tại Canada đã đóng cửa vào năm 1996. Nhiều Người cao tuổi (Elders) là những người nói trôi chảy cuối cùng của ngôn ngữ của họ ngày nay là những người sống sót sau trường nội trú. Sự trôi chảy của họ không chỉ đơn thuần là một tài nguyên ngôn ngữ. Đó là một hành động kháng cự.

### Hoa Kỳ: Các Trường Nội trú Bản địa (Thập niên 1860–1960)

Hoa Kỳ vận hành một hệ thống song song. Đại úy Richard Henry Pratt, người sáng lập Trường Công nghiệp Bản địa Carlisle vào năm 1879, đã đặt ra cụm từ định hình kỷ nguyên đó: "Giết phần Bản địa, cứu phần Người." Hơn 350 trường nội trú do chính phủ tài trợ đã hoạt động trên khắp Hoa Kỳ, với các chính sách gần như giống hệt ở Canada. Trẻ em bản địa bị cấm nói ngôn ngữ của mình, bị buộc phải nhận tên tiếng Anh, và chịu sự xóa nhòa văn hóa có hệ thống.

Một báo cáo năm 2022 của Bộ Nội vụ Hoa Kỳ đã xác định hơn 400 trường nội trú liên bang dành cho người Bản địa tại 37 bang, ghi nhận cái chết của ít nhất 500 trẻ em trong hệ thống—một con số mà báo cáo thừa nhận gần như chắc chắn là thấp hơn nhiều so với thực tế. Cuộc điều tra phát hiện ra rằng hệ thống này được thiết kế không chỉ để giáo dục mà còn để "đồng hóa văn hóa trẻ em Bản địa bằng cách cưỡng bức di dời chúng khỏi gia đình và cộng đồng."

Hậu quả ngôn ngữ là vô cùng thảm khốc. Trong số khoảng 300 ngôn ngữ bản địa được nói tại vùng lãnh thổ trở thành Hoa Kỳ, hơn một nửa hiện đã tuyệt chủng. Trong số những ngôn ngữ còn tồn tại, hầu hết có ít hơn 1,000 người nói trôi chảy, và nhiều ngôn ngữ có ít hơn 10 người. Dự án Ngôn ngữ Bị đe dọa tuyệt chủng (Endangered Languages Project) phân loại phần lớn các ngôn ngữ bản địa Mỹ còn sót lại là bị đe dọa "nghiêm trọng" hoặc "nguy cấp".

### Úc: Các Thế hệ bị Đánh cắp (1910–1970)

Tại Úc, các chính sách của chính phủ từ năm 1910 đến 1970 đã cưỡng bức tách trẻ em Thổ dân và người đảo Torres Strait khỏi gia đình của họ. Những đứa trẻ này—được gọi là Các Thế hệ bị Đánh cắp (Stolen Generations)—được đưa vào các cơ sở truyền giáo, khu bảo tồn và các gia đình nhận nuôi là người da trắng. Mục tiêu rõ ràng là đồng hóa: xóa bỏ bản sắc Thổ dân trong vòng vài thế hệ.

Các ngôn ngữ Thổ dân bị đàn áp trong các cơ sở truyền giáo và tổ chức chính phủ. Trẻ em nói ngôn ngữ của mình bị trừng phạt. Báo cáo Bringing Them Home (1997), do Ủy ban Nhân quyền Úc thực hiện, đã ghi chép lại tính chất hệ thống của các vụ cưỡng bức di dời này và những tác động tàn phá của chúng đối với ngôn ngữ, văn hóa và gia đình.

Trong số ước tính 250 ngôn ngữ Thổ dân Úc được nói vào thời điểm tiếp xúc với châu Âu, chưa đến 20 ngôn ngữ đang được truyền dạy cho trẻ em ngày nay (Marmion et al., 2014). Hơn 100 ngôn ngữ đã tuyệt chủng hoàn toàn. Các ngôn ngữ còn lại tồn tại phần lớn nhờ nỗ lực của những người nói lớn tuổi làm việc với các nhà ngôn ngữ học và các tổ chức cộng đồng trong một cuộc chạy đua với thời gian.

### Scandinavia: Các Ngôn ngữ Sámi

Sự đàn áp các ngôn ngữ bản địa không chỉ giới hạn ở các quốc gia thuộc địa định cư ở bán cầu nam. Ở Na Uy, Thụy Điển và Phần Lan, trẻ em Sámi đã phải chịu hệ thống trường nội trú (*internatskoler*) từ giữa thế kỷ 19 cho đến thập niên 1960. Ngôn ngữ Sámi bị cấm trong trường học; trẻ em bị trừng phạt vì nói chúng. Chính sách "Na Uy hóa" (*fornorskingspolitikk*) của Na Uy nhằm mục đích rõ ràng là xóa bỏ ngôn ngữ Sámi và thay thế bằng tiếng Na Uy.

Trong số chín ngôn ngữ Sámi còn tồn tại, một số ngôn ngữ có ít hơn 500 người nói. Tiếng Ume Sámi có khoảng 20 người nói. Tiếng Pite Sámi có ít hơn 30 người nói. Các ngôn ngữ này tồn tại một phần nhờ các chương trình hồi sinh bắt đầu vào thập niên 1970, bao gồm việc thành lập các trường học và truyền thông bằng tiếng Sámi—các chương trình đến vừa kịp lúc đối với một số phương ngữ và quá muộn đối với những phương ngữ khác.

### Aotearoa New Zealand: Te Reo Māori

Tiếng Māori (te reo Māori) là ngôn ngữ đa số của Aotearoa cho đến giữa thế kỷ 20. Các chính sách giáo dục thuộc địa của Anh, bắt đầu từ thập niên 1860, đã dần dần gạt bỏ te reo trong trường học. Đến thập niên 1970, chưa đầy 20% người Māori nói trôi chảy, và ngôn ngữ này có nguy cơ tuyệt chủng trong vòng một thế hệ.

Phản ứng của người Māori là một trong những phong trào hồi sinh ngôn ngữ sớm nhất và thành công nhất trên thế giới. Kōhanga reo (tổ ấm ngôn ngữ) dành cho trẻ em mầm non, được thành lập vào năm 1982, đã nhúng trẻ sơ sinh và trẻ nhỏ vào te reo từ khi mới sinh. Kura kaupapa Māori (trường học dạy bằng tiếng Māori) theo sau. Các chương trình này, cùng với Đạo luật Ngôn ngữ Māori năm 1987 (biến te reo thành ngôn ngữ chính thức), đã ổn định ngôn ngữ—mặc dù những người nói trôi chảy vẫn chiếm thiểu số trong dân số Māori.

New Zealand cũng tạo ra một trong những khung quản trị dữ liệu quan trọng nhất đối với dữ liệu bản địa: *Te Mana Raraunga*, Mạng lưới Chủ quyền Dữ liệu Māori. Khung này khẳng định rằng dữ liệu Māori—bao gồm cả dữ liệu ngôn ngữ—là một taonga (báu vật) tuân theo các quyền và trách nhiệm của kaitiakitanga (quyền giám hộ). Nó trực tiếp định hình sự phát triển của các nguyên tắc CARE đối với quản trị dữ liệu bản địa và là tài liệu tham khảo nền tảng cho các cơ chế chủ quyền dữ liệu trong champollion.

### Mô hình chung: Ngôn ngữ là Mục tiêu của Quyền lực Thuộc địa

Các đặc thù địa lý và văn hóa có thể khác nhau, nhưng mô hình chung thì nhất quán một cách đáng kinh ngạc. Trên khắp Canada, Hoa Kỳ, Úc, Scandinavia và New Zealand—và ở nhiều nơi khác, từ Đài Loan đến Siberia đến vùng cao nguyên Andes—các quốc gia thuộc địa và hậu thuộc địa đã xác định các ngôn ngữ bản địa là rào cản đối với sự đồng hóa và nhắm mục tiêu xóa bỏ chúng. Các công cụ ở khắp mọi nơi đều tương tự nhau: tách trẻ em khỏi gia đình, cấm sử dụng ngôn ngữ bản địa, trừng phạt các hành vi vi phạm, và thưởng cho việc áp dụng ngôn ngữ thuộc địa.

Đây không phải là một chú thích lịch sử. Ngôi trường nội trú cuối cùng ở Canada đóng cửa vào năm *1996*. Trường nội trú bản địa cuối cùng ở Hoa Kỳ đóng cửa vào thập niên *1960*. Nhiều người sống sót sau các hệ thống này vẫn còn sống. Chấn thương mang tính thế hệ. Và thiệt hại ngôn ngữ vẫn đang tiếp diễn: các ngôn ngữ đã mất đi một thế hệ người nói trong kỷ nguyên trường nội trú giờ đây đang mất đi những Người cao tuổi nói trôi chảy cuối cùng của họ.

### Từ Diệt chủng Văn hóa đến "Khan hiếm Dữ liệu"

Lịch sử này liên quan trực tiếp đến vấn đề kỹ thuật của dịch máy. Khi các nhà khoa học máy tính mô tả một ngôn ngữ là "nghèo tài nguyên" (low-resource), họ thường có ý là: có ít văn bản kỹ thuật số, ít song ngữ ngữ liệu, ít từ điển, và ít tập dữ liệu được gán nhãn. Cách đóng khung này mang tính trung lập, như thể sự khan hiếm dữ liệu là một hiện tượng tự nhiên, giống như một sa mạc có ít mưa.

Nhưng không phải vậy. Sự "khan hiếm dữ liệu" của các ngôn ngữ bản địa là *hệ quả hạ nguồn* của các chính sách đàn áp ngôn ngữ. Các ngôn ngữ bị cấm trong trường học tạo ra ít văn bản viết hơn. Các ngôn ngữ mà người nói bị trừng phạt vì sử dụng chúng phát triển ít mục đích sử dụng mang tính thể chế hơn. Các ngôn ngữ mất đi một thế hệ truyền dạy tạo ra ít người nói song ngữ hơn để có thể tạo ra song ngữ ngữ liệu.

Đường ống dẫn từ diệt chủng văn hóa đến khan hiếm dữ liệu là trực tiếp:

1. **Đàn áp** → Trẻ em bị trừng phạt vì nói ngôn ngữ bản địa
2. **Gián đoạn truyền dạy** → Ít trẻ em học ngôn ngữ hơn
3. **Giảm lượng người nói** → Ít người lớn sử dụng nó trong cuộc sống hàng ngày
4. **Giảm sử dụng mang tính thể chế** → Ít tài liệu viết hơn, ít văn bản kỹ thuật số hơn
5. **Khan hiếm dữ liệu** → Các mô hình ML không có gì để huấn luyện
6. **Không có hỗ trợ MT** → Ngôn ngữ trở nên vô hình trước công nghệ
7. **Đẩy nhanh sự suy giảm** → Công nghệ củng cố sự gạt bỏ mà chính sách đã bắt đầu

Đường ống này có nghĩa là bất kỳ dự án công nghệ nào làm việc với các ngôn ngữ bản địa đều thừa hưởng một bối cảnh chính trị và đạo đức dù có thừa nhận hay không. Một hệ thống dịch máy coi dữ liệu ngôn ngữ Cree là nguyên liệu thô để các mô hình hấp thụ, dù vô tình, đang tiếp tục động lực khai thác bắt đầu từ các trường nội trú. Dữ liệu bị làm cho khan hiếm bởi bạo lực. Những người nói tạo ra những dữ liệu hiện có đã làm điều đó vượt qua những trở ngại khổng lồ. Bất kỳ hệ thống nào sử dụng dữ liệu đó mà không có sự kiểm soát có ý nghĩa của cộng đồng đều đang làm trầm trọng thêm tổn hại ban đầu.

### Sự Đồng lõa của Khoa học và Ý thức hệ Phương Tây

Điều quan trọng cần nhận ra là khoa học và công nghệ không phải là những bên đứng ngoài cuộc vô tội đối với dự án thuộc địa này; họ là những người tham gia tích cực. Ý thức hệ "Khai sáng" tìm cách phân loại, định lượng và tiêu chuẩn hóa thế giới thường coi các dân tộc bản địa và ngôn ngữ của họ chỉ đơn thuần là đối tượng nghiên cứu hoặc sự tò mò cho một "nhân học cứu hộ". Thực hành mang tính khai thác này đã khóa chặt tri thức trong các trường đại học phương Tây trong khi làm rất ít để ngăn chặn bộ máy chính trị đang hủy hoại các cộng đồng đó.

Dự án này đứng ở thế đối lập hoàn toàn với các phương pháp luận như nghiên cứu giang mai Tuskegee hay nhân học ngôn ngữ mang tính khai thác, vốn coi những người da màu (BIPOC) là đối tượng thử nghiệm hoặc nhà cung cấp dữ liệu thô thụ động. Chúng tôi không ở đây để thử nghiệm trên người bản địa, khai thác tri thức của họ, hoặc áp đặt một ý thức hệ văn hóa nguyên khối của phương Tây lên họ. Mục tiêu của chúng tôi là tạo điều kiện cho các phương thức nhận thức *của riêng họ* và các tiêu chuẩn giá trị *của riêng họ*. Chúng tôi cung cấp hạ tầng; các cộng đồng ngôn ngữ xây dựng các tập kiểm thử, định nghĩa các chỉ số, và duy trì sự đồng thuận. Không có sự đồng thuận của họ, không có gì hoạt động được.

### Tại sao Lịch sử này Định hình Thiết kế của Chúng tôi

Đây là lý do tại sao mô hình quản trị của champollion không phải là một tính năng—nó là nền tảng. Mọi quyết định thiết kế lớn trong dự án là một *phản hồi trực tiếp* đối với lịch sử được mô tả ở trên. Mục tiêu là chủ quyền dữ liệu: hỗ trợ các cộng đồng trong việc duy trì, hồi sinh và quản trị các ngôn ngữ sống của họ hoàn toàn theo các điều khoản của riêng họ.

**Tại sao dữ liệu kiểm thử được mã hóa và nắm giữ bởi các quỹ tín thác cộng đồng.** Bởi vì dữ liệu ngôn ngữ bản địa đã bị khai thác, xuất bản và lợi dụng mà không có sự đồng ý trong hơn một thế kỷ. Ngôn ngữ học truyền giáo, chẳng hạn như các nỗ lực của Viện Ngôn ngữ học Mùa hè (SIL), trong lịch sử đã độc quyền hóa các song ngữ ngữ liệu bản địa dưới một khung làm việc mang tính khai thác, đồng hóa. Hơn nữa, không giống như nhiều dự án NLP hiện đại phụ thuộc nhiều vào Kinh Thánh dịch như một song ngữ ngữ liệu chính cho các ngôn ngữ nghèo tài nguyên, chúng tôi tuyên bố rõ ràng không sử dụng Kinh Thánh dịch làm ngữ liệu. Tập kiểm thử được mã hóa, với các khóa chỉ do tổ chức quản trị của cộng đồng nắm giữ, là một cơ chế kỹ thuật giúp việc lặp lại các mô hình khai thác trở nên *bất khả thi về mặt kiến trúc*.

**Tại sao chúng tôi sử dụng thực thi trong môi trường cô lập (sandboxed execution) thay vì các tập kiểm thử mở.** Bởi vì một khi dữ liệu ngôn ngữ được xuất bản công khai, cộng đồng sẽ mất quyền kiểm soát nó vĩnh viễn. Các benchmark ML thông thường xuất bản các tập kiểm thử của họ—bất kỳ ai cũng có thể tải xuống, huấn luyện trên đó, hoặc sử dụng cho bất kỳ mục đích nào. Việc cào dữ liệu AI hiện đại này đại diện cho một hình thức mới của "chủ nghĩa thực dân dữ liệu" (data colonialism) và "bao chiếm kỹ thuật số" (digital enclosure). Đối với các cộng đồng có ngôn ngữ gần như bị xóa sổ bằng bạo lực, việc mất quyền kiểm soát đối với các tài nguyên ngôn ngữ còn lại của họ không phải là một sự bất tiện nhỏ. Đó là sự tiếp nối trực tiếp của việc tước đoạt lãnh thổ trong lịch sử. Thực thi trong môi trường cô lập đảm bảo rằng dữ liệu của cộng đồng không bao giờ rời khỏi hạ tầng của họ.

**Tại sao quyền sở hữu phương pháp chuyển giao cho cộng đồng.** Bởi vì lịch sử "giúp đỡ" các cộng đồng bản địa, phần lớn, là lịch sử của những người bên ngoài xây dựng mọi thứ *về* người bản địa thay vì *cho* hoặc *với* họ. Các bài báo học thuật được xuất bản, các khoản tài trợ được thu thập, sự nghiệp được thăng tiến—và cộng đồng không nhận được gì. Cơ chế chuyển giao quyền sở hữu đảm bảo rằng khi một kỹ sư ML xây dựng một phương pháp dịch thuật hoạt động hiệu quả cho tiếng Plains Cree, cộng đồng tiếng Plains Cree *sở hữu phương pháp đó*. Kỹ sư giữ lại sự ghi nhận và đóng góp. Cộng đồng giữ lại tài sản.

**Tại sao bất kỳ khoản thu nhập nào từ phương pháp thuộc sở hữu cộng đồng hoàn toàn thuộc về cộng đồng.** Bởi vì việc hồi sinh ngôn ngữ rất tốn kém, và các cộng đồng đang làm những công việc khó khăn nhất—những Người cao tuổi giảng dạy, những bậc cha mẹ gửi con đến các trường học nhúng ngôn ngữ, những nhà hoạt động vận hành các tổ ấm ngôn ngữ—đang bị thiếu kinh phí trầm trọng. Hơn nữa, chính hạ tầng AI mà chúng ta sử dụng (ví dụ: trung tâm dữ liệu, khai thác khoáng sản, sử dụng nước) gây ra một tổn thất vật chất không cân xứng đối với các vùng đất bản địa trên toàn cầu. Champollion là một dự án phi thương mại và không đòi hỏi quyền lợi gì từ nó: nếu một phương pháp dịch tiếng Cree tạo ra giá trị, giá trị đó nên tài trợ cho các chương trình ngôn ngữ Cree. Công nghệ nên là một công cụ phục vụ các cộng đồng, chứ không phải là một cơ chế khai thác giá trị từ họ.

**Tại sao chúng tôi nói "hướng tới chủ quyền dữ liệu" thay vì "đã được chứng nhận".** Các nguyên tắc chủ quyền dữ liệu của First Nations — quyền sở hữu, kiểm soát, truy cập và chiếm hữu dữ liệu thuộc về cộng đồng — được trình bày dành riêng cho các bối cảnh của First Nations. Các khuôn khổ quản trị dữ liệu bản địa khác—CARE (Collective Benefit - Lợi ích tập thể, Authority to Control - Thẩm quyền kiểm soát, Responsibility - Trách nhiệm, Ethics - Đạo đức), Te Mana Raraunga (Chủ quyền Dữ liệu Māori), và các nguyên tắc FAIR—giải quyết các mối quan tâm tương tự từ các vị thế văn hóa và pháp lý khác nhau. Chúng tôi không tuyên bố áp dụng các nguyên tắc đó một cách toàn diện; quyết định đó thuộc về các cộng đồng First Nations. Chúng tôi nói rằng thiết kế của mình *hướng tới chủ quyền dữ liệu* — được thiết kế với sự lưu tâm đến các nguyên tắc chủ quyền dữ liệu của First Nations: nó được xây dựng để các cộng đồng *có thể* thực thi quyền sở hữu, kiểm soát, truy cập và chiếm hữu đối với dữ liệu của họ và các công nghệ bắt nguồn từ đó. Kiến trúc này hướng tới chủ quyền; việc nó có đạt được chủ quyền hay không là do các cộng đồng quyết định. Chúng tôi coi đây là một công việc chưa hoàn thiện, hoan nghênh các ý kiến phản đối và sẽ hành động dựa trên những ý kiến đó.

**Tại sao nền tảng đánh giá các *phương pháp*, chứ không phải các *mô hình*.** Bởi vì các cộng đồng ngôn ngữ bản địa không nên phụ thuộc vào mô hình của bất kỳ tập đoàn đơn lẻ nào. Kiến trúc mở của một "phương pháp" có nghĩa là giải pháp thậm chí không cần phải là một LLM tốn kém, nặng nề về vật chất. Nó có thể là một hệ thống dựa trên quy tắc hiệu quả cao, được lưu trữ tại cộng đồng chạy trên phần cứng máy tính truyền thống. Nếu phương pháp dịch tốt nhất cho tiếng Cree sử dụng Gemini của Google hôm nay, cộng đồng sẽ có thể chuyển sang một giải pháp thay thế mã nguồn mở hoặc tất định vào ngày mai mà không cần xây dựng lại mọi thứ. Đánh giá ở cấp độ phương pháp đảm bảo rằng tài sản của cộng đồng là một *công thức*, chứ không phải là một sự phụ thuộc.

**Tại sao cộng đồng phải xây dựng hạ tầng này ngay bây giờ.** Nghịch lý của việc tận dụng AI trong khi phê phán sự khai thác vật chất của nó được giải quyết bằng một thực tế chiến lược khắc nghiệt: nếu vấn đề này không được giải quyết bởi cộng đồng theo các điều khoản chủ quyền của riêng họ, nó sẽ chắc chắn bị "giải quyết" bởi những người khác theo các điều khoản mang tính khai thác. Ngay cả khi một tập đoàn khổng lồ cuối cùng xây dựng một mô hình dịch thuật cho một ngôn ngữ bản địa nhất định, cộng đồng vẫn yêu cầu hạ tầng đánh giá độc lập, cô lập của riêng mình để xác minh *khi nào* và *liệu* họ có thực sự thành công theo các tiêu chuẩn của cộng đồng hay không—và để đảm bảo cộng đồng nắm giữ giá trị của sự thành công đó.

Đây không phải là chính trị được ghép vào công nghệ. Đây là công nghệ được thiết kế bởi những người hiểu rõ lịch sử.

---

## VI. Thời điểm Hiện tại: 6,800 Ngôn ngữ bị Bỏ lại Phía sau

### Quy mô của Vấn đề

Trong số khoảng 7.000 ngôn ngữ đang được sử dụng trên Trái đất hiện nay, chỉ có khoảng 550 ngôn ngữ có bất kỳ hình thức dịch máy nào — và vỏn vẹn 200 ngôn ngữ được hỗ trợ bởi một dịch vụ thương mại đã triển khai ([cách chúng tôi thống kê](/docs/network/context/coverage-counting)). Phần còn lại hoàn toàn vô hình đối với công nghệ—không phải vì chúng kém giá trị hơn, mà bởi vì các phương pháp tiếp cận thống kê và mạng nơ-ron đang thống trị lĩnh vực dịch máy hiện đại về cơ bản là *khát dữ liệu*. Chúng đòi hỏi hàng triệu câu song song để học. Đối với hầu hết các ngôn ngữ trên thế giới, những câu như vậy không hề tồn tại.

Các ngôn ngữ bị ảnh hưởng nhiều nhất chính là những ngôn ngữ bị đe dọa tuyệt chủng nhất: ngôn ngữ bản địa, ngôn ngữ thiểu số, truyền khẩu với các ghi chép viết hạn chế. Đây là những ngôn ngữ mà người nói thường là người cao tuổi, cộng đồng nhỏ, quyền lực chính trị tối thiểu. Chúng là những ngôn ngữ cần hỗ trợ công nghệ nhất để bảo tồn và hồi sinh—và chúng là những ngôn ngữ mà công nghệ hiện tại ít hữu ích nhất.

### Thách thức Đa tổng hợp

Vấn đề không chỉ đơn thuần là sự khan hiếm dữ liệu. Nhiều ngôn ngữ bị đe dọa tuyệt chủng nhất trên thế giới là ngôn ngữ *đa tổng hợp*—chúng có các hệ thống hình thái cực kỳ phức tạp, phá vỡ hoàn toàn các giả định của NLP tiêu chuẩn.

Hãy xem xét tiếng Plains Cree (nêhiyawêwin), một ngôn ngữ Algonquian được nói trên khắp các vùng thảo nguyên Canada. Một động từ tiếng Cree duy nhất có thể mã hóa thông tin mà tiếng Anh sẽ phải trải rộng trên toàn bộ một mệnh đề: chủ ngữ, tân ngữ, thì, thể, tính chứng thực, tình thái (modality), và nhiều danh mục ngữ pháp khác, tất cả được đóng gói vào một từ duy nhất thông qua một hệ thống tiền tố, hậu tố và các biến đổi nội bộ.

Điều này tạo ra một số vấn đề cho các cách tiếp cận MT tiêu chuẩn:

1. **Thất bại phân tách từ (Tokenization failure).** Các bộ phân tách từ con (subword tokenizers) như BPE (Byte Pair Encoding), được thiết kế cho các ngôn ngữ đơn lập như tiếng Anh, đập vỡ các từ đa tổng hợp thành các mảnh vô nghĩa. Cấu trúc hình thái bị phá hủy trước khi mô hình nhìn thấy nó. BPE không trung lập; nó đại diện cho một nhận thức luận thuần túy thực nghiệm, cấp độ bề mặt, xung đột căn bản với các phân cấp hình thái sâu sắc, dựa trên quy tắc vốn có của các ngôn ngữ đa tổng hợp. Đó là một định kiến kiến trúc chủ động tháo dỡ hình thái cấu trúc.

2. **Bùng nổ tổ hợp.** Một ngôn ngữ đa tổng hợp có thể có hàng triệu dạng từ khả dĩ cho một gốc động từ duy nhất. Không có ngữ liệu huấn luyện nào, dù lớn đến đâu, có thể chứa nhiều hơn một phần nhỏ trong số chúng. Các mô hình thần kinh không có cách nào để *khái quát hóa* cho các dạng từ chưa từng thấy.

3. **Tạo ra nội dung vô nghĩa (Hallucination).** Các mô hình ngôn ngữ lớn, khi được yêu cầu dịch sang các ngôn ngữ đa tổng hợp, thường tạo ra các dạng từ không hợp lệ về mặt hình thái—những từ mà không người bản ngữ nào từng tạo ra. Mô hình đã học các mẫu thống kê từ dữ liệu hạn chế nhưng không có sự hiểu biết về các quy tắc hình thái của ngôn ngữ.

### Bộ chuyển đổi Trạng thái Hữu hạn: Chiếc Cầu nối

Tuy nhiên, có một công nghệ xử lý tốt sự phức tạp về hình thái: **Bộ chuyển đổi Trạng thái Hữu hạn** (Finite State Transducer - FST). Một FST là một thiết bị tính toán hình thức ánh xạ giữa một chuỗi đầu vào và một chuỗi đầu ra thông qua một loạt các chuyển đổi trạng thái. Đối với phân tích hình thái, một FST có thể ánh xạ một dạng từ bề mặt sang cấu trúc hình thái cơ bản của nó (và ngược lại), xử lý toàn bộ sự phức tạp tổ hợp của hình thái ngôn ngữ.

FSTs là hậu duệ trực tiếp của các quy tắc viết lại của Pāṇini. Chúng là ngữ pháp Loại 3 (chính quy) của Chomsky dưới dạng tính toán. Chúng là hiện thân sống động của mối liên kết giữa ngôn ngữ học hình thức và tính toán.

Khi kết hợp FSTs với LLMs, `champollion` thực hiện một sự tổng hợp triết học quan trọng: nó hòa giải truyền thống cấu trúc *duy lý* (các quy tắc) với mô hình thống kê *thực nghiệm* (xác suất) để chống lại các định kiến đói dữ liệu, đa số của AI hiện đại.

Đối với các ngôn ngữ đa tổng hợp, FSTs có thể cung cấp một thứ mà các mô hình thần kinh không thể: *xác minh tất định* (deterministic verification). Cho một dạng từ, một FST có thể khẳng định chắc chắn liệu nó có phải là một dạng từ hợp lệ trong ngôn ngữ đó hay không—không phải theo xác suất, không phải "trông có vẻ đúng," mà là *có* hoặc *không*. Đây là câu trả lời cho câu hỏi cốt lõi ám ảnh MT thần kinh cho các ngôn ngữ nghèo tài nguyên: *Làm thế nào để bạn xác minh một từ được tạo ra là có thật mà không có con người tham gia vào quy trình?*

Câu trả lời kỹ thuật là: bạn sử dụng ngữ pháp hình thức. Bạn sử dụng chính các công cụ mà Pāṇini đã phát minh ra hai mươi lăm thế kỷ trước, được mã hóa trong hình thức tính toán mà Turing và Chomsky đã làm cho nghiêm ngặt.

Tuy nhiên, chúng ta phải nhận ra rằng sức mạnh tất định này mang lại những rủi ro riêng của nó. Việc áp đặt một xác minh "có" hoặc "không" lên một ngôn ngữ truyền khẩu, linh hoạt có nguy cơ áp đặt một Ý thức hệ Ngôn ngữ Tiêu chuẩn cứng nhắc. Khi một FST áp đặt những gì là "chính xác", nó có thể vô tình lặp lại chính quy chuẩn thuộc địa mà nó được thiết kế để né tránh—làm phẳng sự biến đổi phương ngữ, trừng phạt việc chuyển mã (code-switching), và áp đặt một ngữ pháp chuẩn hóa duy nhất lên một cộng đồng đa dạng. Bởi vì FSTs chỉ đại diện cho một thước đo của tính chính xác hình thức, tính thực nghiệm cứng nhắc của chúng phải được giảm bớt. Đây chính là lý do tại sao cộng đồng phải là người nắm giữ cây bút. Cộng đồng thiết lập tiêu chuẩn, xây dựng các quy tắc, và định nghĩa những gì máy móc chấp nhận là hợp lệ, thiết kế các FST để tạo không gian cho sự linh hoạt truyền khẩu và các phương ngữ vùng miền. Ngữ pháp hình thức không phải là một sự thật phổ quát được trao xuống bởi các nhà khoa học máy tính; nó là một hạ tầng được vận hành bởi chính những người nói.

### champollion: Nơi các Sợi chỉ Hội tụ

Đây là nơi dự án champollion bước vào câu chuyện. Nó nằm ở điểm hội tụ chính xác của tất cả các sợi chỉ mà chúng ta đã theo dấu:

- **Từ Pāṇini**: Nguyên lý cho rằng ngôn ngữ có thể được mô tả bằng các quy tắc hình thức, tạo sinh.
- **Từ Schleicher và Sapir**: Sự hiểu biết rằng các ngôn ngữ trên thế giới rất đa dạng, có cấu trúc, và thường bị đe dọa tuyệt chủng.
- **Từ các trường nội trú và hậu quả của chúng**: Sự hiểu biết rằng "khan hiếm dữ liệu" không phải là một sự thật kỹ thuật trung lập mà là hệ quả của sự đàn áp ngôn ngữ có chủ đích—và bất kỳ công nghệ nào chạm vào các ngôn ngữ này đều phải được xây dựng với chủ quyền là nền tảng.
- **Từ Chomsky**: Hệ phân cấp hình thức của ngữ pháp kết nối ngôn ngữ học với tính toán.
- **Từ Shannon**: Khung toán học để hiểu về truyền thông, nhiễu và tín hiệu.
- **Từ Turing và von Neumann**: Các cỗ máy phổ quát có thể thực thi bất kỳ hàm khả tính nào.
- **Từ Weaver và các Mô hình IBM**: Insight cho rằng dịch thuật có thể được xử lý như một bài toán thống kê.
- **Từ cuộc cách mạng Transformer**: Các mô hình thần kinh mạnh mẽ có thể dịch thuật—nhưng chỉ khi chúng có đủ dữ liệu.
- **Từ truyền thống FST**: Các công cụ hình thức có thể xử lý sự phức tạp hình thái nơi các mô hình thần kinh thất bại.
- **Từ các nguyên tắc chủ quyền dữ liệu của First Nations, CARE, và Te Mana Raraunga**: Các khung quản trị đảm bảo công nghệ phục vụ các cộng đồng thay vì khai thác từ họ.

champollion là một nền tảng được thiết kế để hướng năng lượng cạnh tranh của cộng đồng học máy vào các ngôn ngữ mà thị trường đã bỏ rơi. Nó cung cấp một hạ tầng đánh giá nơi bất kỳ ai cũng có thể gửi một phương pháp dịch thuật—thần kinh, dựa trên quy tắc, lai, hoặc mới lạ—và được đánh giá theo các tiêu chuẩn nghiêm ngặt. Quan trọng là, nó sử dụng xác minh dựa trên FST để đảm bảo các dạng từ được tạo ra là hợp lệ về mặt hình thái, và nó dựa vào sự xác minh của người bản ngữ như là chân lý tối thượng (ground truth).

Nền tảng này thể hiện một số nguyên lý mà lịch sử này đã làm rõ:

**Không có cách tiếp cận đơn lẻ nào là đủ.** Lịch sử của MT là lịch sử của các bước chuyển dịch mô hình—từ quy tắc sang thống kê rồi đến mạng thần kinh. Mỗi mô hình mới giải quyết được các vấn đề mà mô hình trước đó không thể, nhưng mỗi mô hình cũng có những điểm mù. Đối với các ngôn ngữ đa tổng hợp nghèo tài nguyên, câu trả lời chắc chắn là *lai* (hybrid): độ trôi chảy thần kinh được giới hạn bởi tính chính xác hình thức.

**Chủ quyền dữ liệu không phải là một tùy chọn—đó là một phản ứng mang tính cấu trúc đối với những tổn hại trong lịch sử.** Như Phần V đã ghi chép chi tiết, các ngôn ngữ bản địa không đơn thuần bị "khan hiếm dữ liệu" một cách tình cờ. Chúng bị làm cho khan hiếm bởi các chính sách có chủ ý. Thiết kế hướng tới chủ quyền dữ liệu của dự án—đảm bảo rằng dữ liệu ngôn ngữ vẫn nằm dưới sự kiểm soát của các cộng đồng bản địa, rằng các khóa giải mã được nắm giữ bởi các quỹ tín thác của cộng đồng, rằng quyền sở hữu thuật toán được chuyển giao cho những người nói ngôn ngữ đó—không phải là một suy nghĩ muộn màng. Đó là một phản ứng trực tiếp đối với nhiều thế kỷ thực thi các hành vi khai thác, từ việc ghi chép tài liệu của những người ngoài cuộc trong thời kỳ trường học nội trú cho đến việc cào dữ liệu (dataset scraping) thời hiện đại.

Một phiên bản trước của đoạn văn này đã nói rằng kiến trúc này khiến việc lặp lại những mô hình đó là *bất khả thi về mặt kỹ thuật*. Đó là một tuyên bố phóng đại và đã được rút lại. Các cơ chế này là có thật và cụ thể — một ngữ liệu (corpus) được mã hóa ngay trên thiết bị của người sở hữu trước khi bất kỳ dữ liệu nào rời đi, việc giải mã đòi hỏi nhiều người giám quản cùng hành động thay vì bất kỳ một bên đơn lẻ nào, và nội dung ngữ liệu được lấy từ nguồn của nó thay vì được lưu trữ tại đây — nhưng "bất khả thi" không phải là một đặc tính mà bất kỳ cơ chế nào trong số đó có thể mang lại. Phần mềm có lỗi, người vận hành mắc sai lầm, và một bên quyết tâm với đủ các vai trò phù hợp là một rủi ro tồn dư mà không có thiết kế nào loại bỏ được. Tuyên bố trung thực nhất là các con đường dễ dàng đã bị đóng lại và những con đường khó khăn sẽ để lại bằng chứng. Những gì dự án này có thể hứa hẹn là cơ chế và sự minh bạch, chứ không phải sự bất khả thi.

**Mục tiêu dài hạn là hồi sinh.** Dịch thuật là *bãi thử*, nhưng giải thưởng thực sự là hồi sinh ngôn ngữ thông qua giảng dạy. Các ngữ pháp hình thức và mô hình hình thái được xây dựng cho dịch máy chính là những nền tảng kỹ thuật cần thiết cho việc học ngôn ngữ có sự hỗ trợ của máy tính. Nếu chúng ta có thể xây dựng một FST xác minh các dạng động từ tiếng Cree cho một hệ thống dịch thuật, chúng ta cũng có thể sử dụng FST đó để giúp một học sinh học cách chia động từ tiếng Cree.

### Tại sao lại là Thời điểm này

Chúng ta đang sống trong một thời điểm độc đáo trong lịch sử công nghệ ngôn ngữ. Một số yếu tố đã hội tụ:

1. **Các công cụ mã nguồn mở đã trưởng thành.** Các bộ công cụ FST (như HFST và Foma), các khung MT thần kinh (như OpenNMT và Fairseq), và hạ tầng đánh giá giờ đây có thể được lắp ráp bởi một đội ngũ nhỏ với chi phí tối thiểu.

2. **Hoạt động tổ chức cộng đồng đang tăng tốc.** Các cộng đồng ngôn ngữ bản địa ngày càng tinh tế trong việc sử dụng công nghệ và khẳng định chủ quyền dữ liệu của họ. Các tổ chức như sáng kiến First Voices, Dự án Công nghệ Ngôn ngữ Bản địa Canada, và vô số nỗ lực do cộng đồng dẫn dắt đang xây dựng hạ tầng con người mà công nghệ đơn thuần không thể cung cấp.

3. **Khả năng AI đã đạt đến một ngưỡng mới.** Các mô hình ngôn ngữ lớn, mặc dù không đủ nếu đứng riêng lẻ cho MT nghèo tài nguyên, có thể phục vụ như các thành phần mạnh mẽ trong các hệ thống lai—tạo ra các bản dịch ứng viên sau đó được xác minh và giới hạn bởi các phương pháp hình thức.

4. **Chi phí đã sụp đổ.** Những gì từng yêu cầu một phòng thí nghiệm chính phủ vào năm 1954 hoặc một tập đoàn lớn vào năm 2000 giờ đây có thể được thực hiện với tín dụng điện toán đám mây và phần mềm mã nguồn mở. Điểm nghẽn không còn là công nghệ hay tiền bạc. Đó là *ý chí*.

Câu hỏi không phải là liệu công nghệ có thể được xây dựng hay không. Nó có thể. Câu hỏi là liệu nó có được xây dựng *đúng cách* hay không—với sự quản trị đúng đắn, các động lực đúng đắn, và sự tôn trọng đúng đắn đối với các cộng đồng mà nó được thiết kế để phục vụ.

Đó là câu hỏi mà dự án này tồn tại để trả lời.

---

## Tài liệu Tham khảo

- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.

---

*Tài liệu này là một phần của tài liệu hướng dẫn dự án champollion. Nó được phát hành theo cùng một giấy phép với chính dự án.*

---


## Điều này dẫn đến đâu trên trang web này

Lịch sử kết thúc ở nơi dự án này bắt đầu: hầu hết các ngôn ngữ đang được sử dụng vẫn
nằm ngoài phạm vi của công nghệ. [Champollion là gì](/docs/what-is-champollion)
trình bày kế hoạch trong năm phút, và
[cách thống kê mức độ bao phủ](/docs/network/context/coverage-counting) cho thấy
chính xác ranh giới hiện tại đang nằm ở đâu.
