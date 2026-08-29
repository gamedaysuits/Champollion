---
sidebar_position: 8
title: "Cam kết về Sản phẩm phái sinh"
description: "Ai sở hữu các mô hình, bộ nhớ dịch và tiêu chuẩn đánh giá được xây dựng từ dữ liệu ngôn ngữ của cộng đồng: không phải chúng tôi. Champollion là cơ sở hạ tầng để các cộng đồng tự xây dựng và sở hữu những tài nguyên của riêng họ."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# Cam kết về các Tạo tác Phái sinh

Quan điểm về [Quản lý Dữ liệu](/docs/network/sovereignty/data-sovereignty) bao hàm các *đầu vào*: kho ngữ liệu (corpora) ở lại với người quản lý của chúng, chúng tôi không bao giờ lưu trữ hoặc phân phối lại dữ liệu cộng đồng. Trang này đề cập đến các *đầu ra* — những thứ được **xây dựng từ** dữ liệu ngôn ngữ: các mô hình đã được huấn luyện và trọng số (weights) của chúng, bộ nhớ dịch (translation memories), các bản tinh chỉnh (fine-tunes), tập huấn luyện (coaching sets), tiêu chuẩn đánh giá và các tạo tác thực thi (run artifacts).

Cam kết này, tóm gọn trong một câu:

> **Chúng tôi không tuyên bố quyền sở hữu đối với bất kỳ mô hình ngôn ngữ hoặc tạo tác phái sinh từ ngôn ngữ nào được xây dựng từ dữ liệu của cộng đồng — và chúng tôi cũng không có mong muốn đó. Toàn bộ mục đích của dự án này là đưa quyền kiểm soát ở cấp độ phát triển và cấp độ sở hữu đối với các công nghệ này vào tay những người bản ngữ.**

Champollion là **cơ sở hạ tầng**. Một con đường không sở hữu hàng hóa di chuyển trên nó.

## Điều này có ý nghĩa cụ thể là gì

**Các mô hình thuộc về những người có ngôn ngữ mà chúng nói.** Nếu một mô hình được huấn luyện trên dữ liệu của một cộng đồng — bằng công cụ của chúng tôi hoặc của bất kỳ ai khác — các trọng số, các bản tinh chỉnh và mọi phái sinh đều tuân theo các điều khoản của cộng đồng, không phải của chúng tôi. Chúng tôi không lấy bản sao, chúng tôi không cấp phép lại và chúng tôi không coi việc "chúng tôi đã viết kịch bản huấn luyện" là cổ phần sở hữu đối với những gì nó tạo ra. Bài học này mang tính lịch sử, không phải giả thuyết: các cộng đồng ngôn ngữ đã nhiều lần chứng kiến các tổ chức bên ngoài ghi âm, biên soạn hoặc huấn luyện trên ngôn ngữ của họ và sau đó nắm giữ kết quả — bản quyền đối với các bản ghi âm của những người lớn tuổi, các mô hình được huấn luyện trên giọng nói thu thập được — trong khi chính những người bản ngữ lại phải xin phép cho chính giọng nói của họ. Hình thái thất bại đó chính là điều mà cam kết này tồn tại để loại trừ.

**Công việc với tiếng Plains Cree (nêhiyawêwin) là trường hợp thử nghiệm và câu trả lời đã được ấn định.** Không có gì được xây dựng cho tiếng Cree trong dự án này là của chúng tôi — không phải kho ngữ liệu huấn luyện (được sử dụng dưới sự cho phép của chủ sở hữu và không bao giờ được phân phối lại), không phải các luồng xử lý (pipelines) được huấn luyện, không phải bất kỳ mô hình nào đã được huấn luyện. Bất kỳ mô hình tiếng Cree nào được tạo ra trong công việc này sẽ **chỉ được phát hành cho một cơ quan có thẩm quyền được cộng đồng công nhận** — một cơ quan giáo dục, một hội đồng Trưởng lão, hoặc bất kỳ cơ quan nào do chính cộng đồng chỉ định — theo các điều khoản riêng của cộng đồng và không cho ai khác. Không có phiên bản nào của việc này mà một mô hình tiếng Cree được xuất xưởng như một sản phẩm. Công việc đánh giá tiếng Cree cũng **hoàn toàn phi thương mại**: nhiều nhất, Champollion duy trì phương pháp đánh giá *chung* (tiêu chuẩn LYSS — ý tưởng về việc chấm điểm có chủ đích, nhận thức được hình thái học, trung thực khi thất bại). **Bản thể hiện tiếng Cree** của tiêu chuẩn đó — kiến thức ngôn ngữ mà nó mã hóa và xác thực — không phải là thứ chúng tôi sở hữu; việc sử dụng thương mại nó được bảo lưu chờ tham vấn với cộng đồng ngôn ngữ nêhiyaw và các điều khoản của cộng đồng sẽ chi phối.

**Điểm số được truyền đi; các tạo tác thì không.** Bảng xếp hạng công bố các *phép đo* — giá trị chrF++, tỷ lệ xác thực, khoảng tin cậy — với phương pháp và kho ngữ liệu được xác định. Nó không bao giờ công bố, lưu trữ hoặc yêu cầu bản thân mô hình, nội dung kho ngữ liệu hoặc các đầu ra vượt quá những gì điều khoản của người quản lý cho phép. Nếu một cộng đồng muốn hàng ngôn ngữ của họ bị xóa khỏi chế độ xem công khai, các [luồng đăng ký](/docs/network/sovereignty/registering-corpora) tồn tại chính xác là để mức độ hiển thị là quyền quyết định của họ, không phải của chúng tôi.

## Cơ sở hạ tầng có nghĩa là: dữ liệu của bạn, bản dựng của bạn, khóa của bạn

Ba hình thái cụ thể của việc "chúng tôi chỉ là cơ sở hạ tầng" trông như thế nào trong thực tế:

1. **Một cộng đồng xây dựng kho ngữ liệu của riêng họ.** Họ sử dụng CLI trên máy của chính họ; kho ngữ liệu nằm ở nơi họ đặt nó. Nếu họ chọn đăng ký nó để đo chuẩn (benchmarking), sổ đăng ký sẽ lưu trữ một *con trỏ và một mã băm (checksum)* — lấy từ nguồn, theo giấy phép của họ, có thể hủy niêm yết theo yêu cầu của họ. Kho ngữ liệu không bao giờ đi vào kho lưu trữ (repository) hoặc bộ nhớ của chúng tôi. Điều này được thực thi bởi cơ chế mà bạn có thể kiểm tra: repo công khai cung cấp các cổng cách ly và các trigger cơ sở dữ liệu khiến việc lưu trữ nội dung cộng đồng trở nên bất khả thi về mặt cấu trúc, chứ không chỉ là bất lịch sự.

2. **Một cộng đồng huấn luyện mô hình của riêng họ.** Bộ công cụ huấn luyện ([nmt-forge](https://github.com/gamedaysuits/Champollion)) chạy trên phần cứng của họ; các điểm kiểm tra (checkpoints) và trọng số chỉ tồn tại ở đó. Bộ khung đánh giá (eval harness) sẽ chấm điểm nó; bảng xếp hạng ghi lại điểm số. Chúng tôi không bao giờ sở hữu mô hình. Nếu họ muốn nó riêng tư mãi mãi, nó sẽ như vậy — một hàng điểm số là dấu vết công khai duy nhất, và chỉ khi họ công bố nó.

3. **Một cộng đồng chạy bài đo chuẩn của riêng họ.** Với [các cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest), tập kiểm tra (test set) được niêm phong trên cơ sở hạ tầng do cộng đồng kiểm soát; các phương pháp đi *đến* dữ liệu; chỉ có điểm số tổng hợp được đưa ra ngoài. Cộng đồng quyết định ai có thể đánh giá, theo những điều khoản nào và có thể dừng lại bất cứ lúc nào.

Trong mọi trường hợp, hướng di chuyển đều giống nhau: năng lực di chuyển về phía cộng đồng; dữ liệu và các phái sinh của nó không rời xa khỏi cộng đồng.

## Các khuôn khổ mà chúng tôi tôn trọng

Chúng tôi **được truyền cảm hứng bởi, và khao khát hướng tới,** các khuôn khổ quản trị dữ liệu Bản địa mà chính các cộng đồng đã xây dựng. Không phải do chúng tôi tự coi mình là tuân thủ bất kỳ khuôn khổ nào trong số đó — phán quyết đó thuộc về các cộng đồng và tổ chức đã tạo ra chúng. Những gì chúng tôi có thể làm là thiết kế theo hướng của họ, gọi họ là những người thiết lập tiêu chuẩn và nói rõ ràng rằng chúng tôi vô cùng trân trọng cơ hội được lắng nghe và làm việc với các chuyên gia này để cải thiện hệ thống này theo tinh thần của họ:

- **Các nguyên tắc chủ quyền dữ liệu của First Nations** (quyền sở hữu, kiểm soát, truy cập và chiếm hữu) — khuôn khổ gọi tên chính xác bốn năng lực mà trang này cam kết giữ trong tay cộng đồng.
- **Các Nguyên tắc CARE về Quản trị Dữ liệu Bản địa** (Collective Benefit - Lợi ích Tập thể, Authority to Control - Quyền Kiểm soát, Responsibility - Trách nhiệm, Ethics - Đạo đức), từ Global Indigenous Data Alliance — lăng kính điều chỉnh đối với dữ liệu hoàn toàn "mở": sự cởi mở không phải là một đức tính tốt khi nó tước đi quyền hạn của một dân tộc đối với kiến thức của chính họ.
- **Te Mana Raraunga**, hiến chương của Māori Data Sovereignty Network — dữ liệu như một taonga (kho báu) sống, với các quyền và trách nhiệm đi kèm theo nó.
- **Giấy phép Kaitiakitanga** (Te Hiku Media) — theo hiểu biết của chúng tôi, đây là ví dụ thực tế rõ ràng nhất về chủ quyền tạo tác phái sinh trong công nghệ ngôn ngữ: Te Hiku đã xây dựng các mô hình giọng nói *từ* và *cho* te reo Māori và cấp phép truy cập theo các điều khoản giám hộ, để các mô hình mang lại lợi ích cho người Māori và vẫn nằm dưới sự quản trị của người Māori. Khi chúng tôi nói "các mô hình thuộc về người bản ngữ", Te Hiku là bằng chứng tồn tại cho thấy điều đó hoạt động.
- **Mô hình nghiên cứu có sự tham gia của Masakhane** — NLP châu Phi được xây dựng bởi các nhà nghiên cứu bản ngữ với tư cách là đồng tác giả và chủ sở hữu thay vì chỉ là nguồn dữ liệu; minh chứng cho thấy *quá trình* xây dựng công nghệ ngôn ngữ tự nó có thể là sự chuyển giao năng lực.

Đây là những khuôn khổ khác nhau từ những dân tộc khác nhau với các vị thế pháp lý và văn hóa khác nhau — chúng tôi gọi tên chúng cạnh nhau thay vì gộp chúng vào một nhãn duy nhất. Nơi nào thiết kế của chúng tôi chưa đạt được tinh thần của họ, đó là một khiếm khuyết cần khắc phục và chúng tôi thà nghe điều đó từ các chuyên gia còn hơn là phát hiện ra nó trong một cuộc phân tích sau sự cố. Nếu bạn làm việc trong lĩnh vực này và sẵn sàng cho chúng tôi biết chúng tôi đã sai ở đâu: **cuộc trò chuyện đó là đóng góp giá trị nhất mà dự án này có thể nhận được.** Hãy liên hệ với chúng tôi qua [Tham gia](/get-involved).

## Những gì chúng tôi thực sự sở hữu

Để rõ ràng, những thứ mà Champollion *thực sự* tuyên bố sở hữu: mã nguồn cơ sở hạ tầng (CLI, bộ khung, bộ công cụ huấn luyện — mỗi thứ theo giấy phép đã công bố của nó), phương pháp đánh giá chung và các *phép đo phái sinh* của chỉ mục (mang nguồn gốc `champollion-derived` chính xác là để chúng không bao giờ bị quy kết sai cho một cộng đồng hoặc một nguồn thượng nguồn). Đó là hộp công cụ. Những gì bạn xây dựng với nó là của bạn.

