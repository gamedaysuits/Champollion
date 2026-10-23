---
title: "Cải thiện qua từng vòng"
slug: /make-it-better
description: "Cách một công cụ dịch đầu tiên tiến bộ: người bản ngữ kiểm tra các bản nháp, các công cụ gợi ý điều gì hữu ích nhất, và mỗi vòng đều cho bạn biết trung thực liệu nó đã tốt hơn hay chưa."
---

# Cải thiện qua từng vòng

Mô hình dịch đầu tiên của bạn chỉ là sự khởi đầu, không phải đích đến. Từ đây, nó sẽ phát triển qua từng
**vòng**. Mỗi vòng, người bản ngữ sẽ kiểm tra những gì mô hình viết, bạn thêm vào các câu
hữu ích nhất, và mô hình sẽ học lại. Kết thúc mỗi vòng, bạn sẽ nhận được
một báo cáo ngắn: những gì đã thay đổi, các công cụ chắc chắn đến mức nào, và việc cần làm tiếp theo.

Đây là cốt lõi của hệ thống ray. Đây cũng là nơi thời gian của người bản ngữ mang lại nhiều
hiệu quả nhất.

## Trước vòng đầu tiên: cần bao nhiêu thời gian?

Hệ thống ray bắt đầu bằng việc hỏi người bản ngữ có thể dành bao nhiêu thời gian — mỗi tuần, và tổng
cộng. Mỗi vòng được điều chỉnh theo lượng thời gian đó. Khi một vài vòng đã cho thấy xu hướng, hệ thống ray
sẽ cho bạn biết rõ ràng lượng thời gian đó có thể mang lại kết quả gì, kể cả khi thời gian có vẻ
quá ít. Hệ thống không bao giờ đòi hỏi nhiều hơn. Thời gian của người bản ngữ là của chính họ.

## Một vòng

1. **Danh sách mong muốn.** Các công cụ sẽ xem xét những chỗ trình dịch làm sai và tạo một bảng có thể in ra về những điều hữu ích nhất: các từ mà nó chưa từng gặp — kèm yêu cầu viết hai hoặc ba câu cho mỗi từ, vì một từ chỉ gặp một lần thì hiếm khi học được — và những dạng câu khiến nó lúng túng. Một phần tư bảng được để trống, nhờ đó bạn vẫn có thể viết những gì *bạn* cần. Dùng nhiều hay ít tùy ý bạn.
2. **Các câu của bạn.** Hãy viết từ 20 câu trở lên mà bạn thực sự muốn dịch — những câu bạn sẽ nói ở nhà, viết trong lời nhắn, hoặc dạy trên lớp. Viết bao nhiêu câu tùy theo khả năng người nói có thể kiểm tra trong tuần này.
3. **Trình dịch tạo bản nháp.** Trình dịch sẽ viết bản dịch của từng câu vào một bảng dành cho người nói. Khi còn ít câu luyện tập, một số hàng sẽ không có bản dịch nháp — cứ hai câu thì có một câu để trống cho đến khi có đủ 50 câu luyện tập, sau đó là một trên bốn cho đến khi đạt 200 câu. Người nói sẽ tự viết những câu đó, và chúng trở thành các câu luyện tập mới (không bao giờ dùng để học).
4. **Người nói kiểm tra.** Với mỗi bản nháp: ghi **Y** nếu đúng; **N** nếu sai, kèm theo cách nói đúng; **?** nếu không chắc chắn. Hãy mở bảng trong một trang tính, hoặc in ra rồi nhập các đánh dấu vào sau.

   Từ vòng thứ hai, cứ khoảng mười hàng thì có một hàng được lấy lại từ bảng trước đó, hoàn toàn có chủ ý — phần đầu bảng có nói rõ điều này, nhưng không chỉ rõ là hàng nào.
   Hãy đánh dấu lại từ đầu, như thể đó là câu mới. Mức độ trùng khớp giữa các lần đánh dấu cho mọi người biết kết quả đáng tin cậy đến đâu. Những hàng này chỉ mất vài giây cho mỗi câu, và không bao giờ tính vào kết quả của vòng đó.
5. **Các công cụ đọc kết quả đánh dấu.** Chúng sẽ đếm xem có bao nhiêu bản nháp là đúng. Những chỗ sửa lại và các bản nháp được đánh dấu đúng sẽ trở thành các câu mới để học hỏi — sau khi bạn đã nêu rõ chúng thuộc về ai, giống như với bất kỳ tệp nào.
6. **Báo cáo.** Xem bên dưới.
7. **Học lại.** Khi bạn đồng ý, trình dịch sẽ học từ mọi thứ có được cho đến nay — thường là tiếp nối từ bản bạn đang dùng, nhờ đó một vòng học sẽ mất ít thời gian hơn so với lần dạy đầu tiên. Bản mới được so sánh với bản bạn đang dùng, theo từng câu một, trên cùng các câu luyện tập. Chỉ khi bản mới tốt hơn một cách rõ rệt chứ không phải do may mắn thì hệ thống ray mới đề xuất nó cho bạn — và nó chỉ thay thế bản cũ khi bạn đồng ý. Nếu không, bản bạn đang dùng vẫn được giữ lại, và vòng tiếp theo sẽ bắt đầu. Khi có ít hơn 50 câu luyện tập, không điểm số nào có thể khẳng định bản nào tốt hơn — vì vậy các công cụ sẽ không đoán mò. Bản bạn đang dùng sẽ được giữ lại, và người nói sẽ quyết định thay (xem bên dưới).

## Báo cáo vòng

Mỗi báo cáo bắt đầu bằng tiến độ, sau đó là các phần kiểm tra, rồi đến việc cần làm:

- **Tỷ lệ bản nháp được người nói đánh dấu là đúng** — con số quan trọng nhất — kèm theo một khoảng ước lượng cho thấy mức độ chắc chắn của các công cụ.
- **Điểm luyện tập** — điểm số trên thang 100 cho biết trình dịch dịch sát đến mức nào, dựa trên các câu luyện tập mà nó chưa từng học — và liệu trình dịch mới có thực sự đánh bại bản cũ hay không.
- **Kiểm tra xem trình dịch có chỉ đơn thuần học vẹt hay không** — liệu những tiến bộ trên các câu luyện tập có xuất hiện trên các câu mới hay không.
- **Mức độ đáng tin cậy của các đánh dấu** — khi mười hàng xuất hiện lại đã được đánh dấu: tần suất người nói đánh dấu chúng theo cùng một cách, và liệu các bản nháp từng bị đánh dấu sai giờ có được đánh dấu đúng thường xuyên hơn không, điều này có thể xảy ra khi bất kỳ ai dần quen với một trình dịch. Đó không phải lỗi của ai cả, và là điều rất đáng để biết.
- **Còn bao xa nữa thì "dùng được"** — một khi sự tiến bộ là có thật, một khoảng ước tính xem cần thêm bao nhiêu câu và bao nhiêu giờ, mỗi lần số câu của bạn tăng gấp đôi. Khoảng ước tính này cũng tính đến mức độ đáng tin cậy từ các đánh dấu của người nói.
- **Hai đến bốn việc cần làm tiếp theo** — chẳng hạn như *viết các câu có những từ này*, *đánh dấu bảng này*, *thử trình dịch mạnh hơn*, hoặc *yêu cầu trợ giúp qua Tham gia một dự án*.

Trợ lý của bạn được chỉ dẫn truyền đạt toàn bộ thông tin cùng ý nghĩa của từng con số, chỉ
ghi nhận những tiến bộ mà các công cụ đã đo lường được, và nói rõ *"không có thay đổi đo lường được"*
khi kết quả là như vậy. Một vòng không có thay đổi đo lường được vẫn
có giá trị: mô hình dịch bạn đang dùng vẫn được giữ lại, và bạn biết mình đang ở đâu.

## Người bản ngữ kiểm tra mà không biết câu nào từ mô hình nào

Có hai trường hợp sẽ tiến hành kiểm tra ẩn trên chính các câu của bạn:

- **Sau khi bạn đưa trình dịch mới vào sử dụng**, trang tiếp theo sẽ trộn các bản nháp của nó với các bản nháp từ trình dịch cũ mà nó đã thay thế — được chọn ngẫu nhiên, không gắn nhãn. Một mức tăng chỉ được tính là tiến bộ thực sự khi chính các đánh giá của người nói cũng đồng tình.
- **Khi các câu luyện tập không thể phân định** — có ít hơn 50 câu, hoặc vòng vừa rồi không cho thấy thay đổi nào đo lường được — một nửa số bản nháp ở trang tiếp theo sẽ đến từ trình dịch mới. Nếu người nói thể hiện rõ sự ưu tiên cho nó, hệ thống ray dẫn sẽ đề xuất đưa nó vào sử dụng (bạn vẫn có quyền đồng ý hay không), và báo cáo sẽ nêu rõ rằng nó được chọn dựa trên đánh giá của người nói.

Dù theo cách nào, người bản ngữ cũng đánh dấu từng bản nháp theo cùng một cách, mà không cần biết
mô hình dịch nào đã viết ra nó.

## Khi các vòng không còn tiến triển

Hai vòng liên tiếp không thấy tiến bộ rõ rệt không có nghĩa là các vòng dịch đã hết
tác dụng. Khi mô hình dịch đã khá tốt, một vòng có thể bổ sung ít hơn mức mà các
câu luyện tập có thể thể hiện. Báo cáo sẽ nêu rõ điều này — báo cáo không thể phân biệt giữa
mức tiến bộ nhỏ và việc không tiến bộ — và chỉ ra những hướng đi nhanh hơn: dùng một mô hình
dịch mạnh hơn, hoặc thêm nhiều câu thuộc các dạng mà mô hình hay làm sai.

Nếu bạn bắt đầu với loại trình dịch nhỏ, máy tính của bạn có khả năng dạy loại mạnh hơn, và hai vòng liên tiếp kể từ lần cuối bạn đổi trình dịch không cho thấy mức tăng nào đo lường được, hệ thống ray dẫn sẽ đề xuất chuyển đổi. (Các vòng có quá ít câu luyện tập để phân định sẽ không được tính.) Bản tải xuống sẽ lớn hơn và mất nhiều thời gian hơn để dạy, vì vậy hệ thống ray dẫn sẽ hỏi: *đồng ý*, hoặc *chưa phải lúc này*. Nếu bạn đồng ý, nó sẽ học từ mọi thứ bạn có, và chỉ được đề xuất cho bạn nếu nó tốt hơn ở mức đo lường được — bạn vẫn có quyền đồng ý trước khi nó chính thức thay thế.

## Những người chưa đồng thuận

Nếu một số câu của bạn đến từ những người chưa đồng thuận, hệ thống ray
sẽ để những câu đó sang một bên và tiếp tục hoạt động. Mỗi phiên làm việc, hệ thống sẽ hỏi nhẹ nhàng
một lần xem mọi người đã đồng thuận chưa. Khi câu trả lời là có, những câu đó sẽ được đưa vào vòng
tiếp theo.

**Tiếp theo:** [Cần bao nhiêu câu? →](/docs/how-many-sentences)

## Tìm hiểu sâu hơn

- [Hướng dẫn mọi người](/docs/agents/coaching) — cách trợ lý truyền đạt
  báo cáo và các quy tắc trợ lý tuân theo.
- [Quy tắc đo lường](/docs/agents/measurement) — chính xác cách xác định
  "tốt hơn" và các giới hạn của nó.
- [Cần bao nhiêu câu?](/docs/how-many-sentences) — kết quả tích lũy qua
  các vòng.
