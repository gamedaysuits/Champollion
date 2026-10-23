---
title: "Các rào chắn bảo vệ"
slug: /guardrails
description: "Những sai lầm âm thầm phá hỏng các dự án dịch thuật, và cách rào chắn xử lý từng lỗi — bằng ngôn từ giản dị."
---

# Từng rào chắn bảo vệ, giải thích chi tiết

Hầu hết các dự án dịch thuật không thất bại một cách ồn ào. Chúng thất bại trong im lặng. Những từ ngữ được chia sẻ vì tin tưởng lại trôi dạt đến nơi không nên đến. Một công cụ dịch trông có vẻ tuyệt vời — bởi vì nó đang được kiểm tra trên chính những câu nó đã ghi nhớ. Một vòng chạy may mắn lại trông giống như tiến bộ.

Mỗi rào chắn bảo vệ dưới đây giúp ngăn chặn một trong những vấn đề đó. Các công cụ tự mình thực thi hầu hết các rào chắn; một số rào chắn phụ thuộc vào bạn và trợ lý của bạn, và mỗi rào chắn đều nêu rõ điều đó.

Một từ bạn sẽ thấy bên dưới: **điểm số** là một con số cho biết các câu của công cụ dịch sát đến mức nào so với cách một người nói đã diễn đạt. Điểm càng cao nghĩa là càng sát.

## 1. Ngôn từ của bạn rời khỏi nơi an toàn

**Điều trục trặc.** Những từ ngữ được chia sẻ vì tin tưởng lại trôi dạt vào máy tính của người khác, hoặc nằm trong AI của người khác.

**Cách các rào chắn hoạt động.** Mỗi tệp đều có một ghi chú đi kèm ngay bên cạnh, nêu rõ quyết định của những người sở hữu tệp đó: liệu tệp có bao giờ được rời khỏi máy tính này không, và liệu một công cụ dịch có được học từ nó hay không. Mọi công cụ đều tuân theo ghi chú này.

- Các tệp ban đầu được để ở chế độ riêng tư, cho đến khi những người sở hữu chúng trả lời.
- Sau khi họ trả lời, các công cụ có thể làm cho quy tắc nghiêm ngặt hơn, chứ không bao giờ lỏng lẻo hơn. Chỉ có con người mới có thể nới lỏng chúng, một cách có chủ đích, bằng tay. Nếu một người chưa được hỏi ý kiến sau đó đồng ý, sự đồng ý đó sẽ được thêm vào.
- Ngôn từ của bất kỳ ai cũng không được dùng để huấn luyện công cụ dịch cho đến khi cộng đồng nói rằng những người nói đó đã đồng ý. Ngôn từ của những người nói chưa đồng ý, hoặc đã nói không, sẽ được để riêng ra.
- Một công cụ dịch đã học từ các câu riêng tư cũng được đối xử như tài liệu riêng tư, bởi vì nó có thể lặp lại những gì đã học.
- Đối với các tệp lưu trên máy tính này, các công cụ chỉ hiển thị cho trợ lý AI của bạn số lượng câu, chứ không hiển thị nội dung câu.

**Điều phụ thuộc vào bạn.** Hầu hết các trợ lý AI chạy trên máy tính của một công ty và gửi bất kỳ thứ gì chúng đọc về cho công ty đó. Nếu bạn yêu cầu trợ lý mở tệp của mình, nó có thể làm điều đó — không công cụ nào ngăn chặn được. Đối với những từ ngữ bạn muốn giữ riêng tư, hãy dùng một trợ lý chạy trên chính máy tính của bạn, hoặc đừng yêu cầu nó mở các tệp đó. Và các công cụ không thể phân biệt được ai là người trả lời câu hỏi, vì vậy những người sở hữu ngôn từ nên tự mình trả lời. Trang [Ngôn từ của bạn, quy tắc của bạn](/docs/your-words-your-rules) có giải thích đầy đủ về điều này.

## 2. Bài kiểm tra thực chất lại là bài tập về nhà

**Điều trục trặc.** Bạn kiểm tra công cụ dịch trên các câu mà nó đã học. Nó nhớ các câu đó và trông có vẻ xuất sắc — rồi vấp ngã ở bất kỳ câu nào mới. Điều đó giống như chấm điểm học sinh bằng đúng những câu hỏi trong bài tập về nhà tối hôm qua.

**Cách các rào chắn hoạt động.** Trước bất kỳ quá trình huấn luyện nào, bạn để riêng các câu kiểm tra đã được một người nói thành thạo rà soát. Chúng được đánh dấu để không công cụ dịch nào học từ chúng, và các công cụ sẽ không đưa chúng vào nội dung hiển thị trừ khi có người yêu cầu xem.

## 3. Các bản sao gần giống

**Điều trục trặc.** Câu kiểm tra chính xác không nằm trong số các câu mà công cụ dịch đã học — nhưng một câu gần giống như vậy lại có. *"Chúng tôi đang đi đến cửa hàng"* được đưa ra kiểm tra, còn *"Bây giờ chúng tôi đang đi đến cửa hàng"* đã được học. Công cụ dịch được tính điểm nhờ khả năng ghi nhớ, chứ không phải nhờ khả năng dịch.

**Cách các rào chắn hoạt động.** Trước khi bắt đầu huấn luyện, mọi câu mà công cụ dịch chuẩn bị học đều được kiểm tra đối chiếu với các câu kiểm tra. Các bản sao y hệt và các bản sao gần giống đều được để riêng ra. Những câu chỉ trùng lặp mẫu câu vẫn được giữ lại nhưng được đếm số lượng, để bạn có thể thấy chúng có thể khiến điểm số trông tốt hơn thực tế đến mức nào.

## 4. Nhìn lén đáp án

**Điều trục trặc.** Kiểm tra công cụ dịch của bạn với các câu kiểm tra sau mỗi thay đổi nhỏ, và bạn sẽ từ từ tinh chỉnh nó bám theo đúng những câu đó. Bài kiểm tra sẽ không còn cho bạn biết điều gì mới nữa.

**Cách các rào chắn hoạt động.** Tiến bộ hàng ngày được đánh giá trên một tập **câu luyện tập** riêng biệt, được tách ra từ dữ liệu của bạn. Mỗi lần các công cụ huấn luyện chấm điểm tập câu kiểm tra, kết quả đó sẽ được ghi lại, và chúng sẽ không hiển thị điểm kiểm tra cho đến khi một dự đoán bằng văn bản được ghi nhận.

## 5. Đặt ra kỳ vọng sau khi đã thấy kết quả

**Điều trục trặc.** Một khi kết quả đã hiện lên màn hình, người ta rất dễ nói *"đúng như chúng tôi nghĩ."* Khi đó kết quả không thể làm bạn ngạc nhiên, và nó cũng không thể dạy cho bạn điều gì.

**Cách các rào chắn hoạt động.** Trước khi công cụ dịch đầu tiên được huấn luyện, những người xây dựng nó sẽ viết ra những gì họ kỳ vọng, bằng chính lời văn của họ. Các rào chắn sẽ không cho tiếp tục cho đến khi nội dung đó được viết ra, và sau đó kết quả sẽ được đối chiếu lại với nó.

## 6. Nhầm lẫn vận may với tiến bộ

**Điều trục trặc.** Hai công cụ dịch có thể có điểm số hơi khác nhau chỉ do ngẫu nhiên, nhất là trên một số lượng câu nhỏ. Một vòng chạy may mắn trông giống như tiến bộ, và một cải thiện thực sự có thể bị che lấp trong các biến thiên ngẫu nhiên.

**Rào chắn làm những gì.** Một trình dịch mới được so sánh với trình dịch bạn đang
dùng, từng câu một, trên cùng những câu luyện tập. Trình dịch này chỉ được đề xuất
cho bạn nếu đạt điểm cao hơn mức mà may mắn thông thường có thể giải thích — và
ngay cả khi đó, nó chỉ tiếp quản khi bạn đồng ý. Nếu không,
các công cụ sẽ thông báo *"không có thay đổi đo lường được"* — kèm mức cải thiện bao nhiêu là quá nhỏ để
nhận thấy với ngần ấy câu luyện tập. Với ít hơn 50 câu luyện tập,
không điểm số nào có thể phân định, nên các công cụ hoàn toàn không đưa ra quyết định: thay vào đó,
đánh giá của người nói, trên các bản nháp từ cả hai mà không biết bản nào của bên nào, sẽ quyết định.

## 7. Liệu nó có tốt hơn một cuốn từ điển?

**Điều trục trặc.** Điểm số tự thân nó có rất ít ý nghĩa. Một công cụ dịch có thể chẳng làm tốt hơn việc tra từng từ trong một danh sách từ vựng.

**Cách các rào chắn hoạt động.** Nếu bạn có một danh sách từ vựng, các công cụ trước tiên sẽ đo lường xem việc tra từng từ mang lại kết quả đến đâu. Một công cụ dịch chỉ đáng dùng ở những chỗ nó vượt qua được cách làm đó.

## 8. Hai công cụ dịch ẩn sau một điểm số

**Điều trục trặc.** Khi một công cụ dịch không xử lý được một câu, một công cụ dịch dự phòng thứ hai có thể vào cuộc. Điều đó hoàn toàn ổn khi bạn sử dụng nó. Nhưng nếu một điểm kiểm tra lại trộn lẫn cả hai, bạn không thể biết mình vừa đo lường công cụ nào.

**Cách các rào chắn hoạt động.** Điểm kiểm tra luôn luôn đến từ một công cụ dịch duy nhất. Công cụ dự phòng được phép dùng khi bạn dịch thực tế, nhưng tuyệt đối không được dùng khi bạn đo lường công cụ.

## 9. Nói quá sự thật

**Điều trục trặc.** Một trợ lý nhiệt tình tuyên bố *"công cụ dịch của bạn đã sẵn sàng!"* trong khi nó mới chỉ vừa được huấn luyện qua loa.

**Cách các rào chắn hoạt động.** Các công cụ lưu giữ hồ sơ về những gì thực sự đã diễn ra. Trợ lý của bạn được chỉ dẫn chỉ báo cáo đúng những điều đó, và chuyển tiếp từng cảnh báo nguyên văn từng chữ một. Điều này phụ thuộc vào việc trợ lý có tuân thủ các chỉ dẫn của mình hay không.

---

Không có điều nào trong số này tự làm cho công cụ dịch trở nên tốt. Chúng đảm bảo rằng bạn luôn biết rõ công cụ đang ở mức độ nào — và những người sở hữu ngôn ngữ luôn nắm quyền quyết định.

**Tiếp theo:** [Những gì công cụ chưa làm được →](/docs/what-it-cant-do-yet)

## Tìm hiểu sâu hơn

- [Thỏa ước vận hành cho các agent AI](/docs/agents/contract) — từng quy tắc, và việc các công cụ tự thực thi quy tắc đó hay chỉ có trợ lý mới có thể tuân thủ.
- [Mọi lệnh, từng bước một](/docs/agents/shell) — nơi mỗi bước kiểm tra chạy, cùng các câu lệnh chính xác.
- Khái niệm "vượt quá may mắn" ở đây nghĩa là gì: điểm chrF++ của công cụ dịch mới trên tập luyện tập (dev) phải cao hơn trong phép kiểm tra theo cặp và khoảng tin cậy của nó phải luôn ở trên mức 0. Tập luyện tập cũng được dùng để chọn điểm kiểm tra (checkpoint) tốt nhất của công cụ dịch mới, điều này hơi có lợi cho công cụ mới một chút.
- [Trách nhiệm coi sóc dữ liệu](/docs/your-words-your-rules) — cách dữ liệu được sử dụng mà không bị bàn giao cho bên ngoài.
