---
sidebar_position: 7
title: "Độ mạnh kết nối"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Độ mạnh kết nối

Khi bản đồ mạng vẽ một cung nối giữa hai ngôn ngữ, màu sắc của nó trả lời
một câu hỏi: **cặp ngôn ngữ này đã thực sự được đo lường chưa?**

Điều này có chủ ý khiêm tốn hơn so với những gì bản đồ từng thể hiện. Cho đến ngày 04-09-2026, một cung nối
được tô màu theo thang đo độ mạnh năm cấp — bản dịch tốt nhất *tốt* đến mức nào,
trên thang đo đã hiệu chỉnh theo xác suất ngẫu nhiên. Thang đo đó đã bị loại bỏ. Trang này
giải thích con số đằng sau nó, lý do tại sao việc gỡ bỏ nó là quyết định trung thực,
và bản đồ hiện thể hiện điều gì.

## Vấn đề: điểm số thô không bằng không tại điểm gốc

Hầu hết các điểm số của chúng tôi là **chrF++** (character n-gram F-score, [Popović 2017](https://aclanthology.org/W17-4770/)) — nó đo lường mức độ trùng lặp giữa các ký tự và từ của bản dịch so với bản dịch tham chiếu, từ 0 đến 100.

Nhưng *văn bản ngẫu nhiên không có điểm bằng không*. Mỗi hệ thống chữ viết đều mang lại một số điểm trùng lặp "miễn phí": một hệ chữ viết có ít ký tự riêng biệt, hoặc các từ dài dễ đoán, sẽ đạt điểm cao hơn mức không một cách rõ rệt ngay cả khi "bản dịch" là vô nghĩa. Sự trùng lặp miễn phí đó — **ngưỡng ngẫu nhiên (chance floor)** — khác nhau tùy theo từng ngôn ngữ. Trong các phép đo của chúng tôi, nó dao động từ khoảng 1,6 (chữ Hán) đến hơn 13 (một số ngôn ngữ sử dụng chữ Latin và chữ Ả Rập). Điểm chrF++ thô bằng 14 là nhiễu gần như ngẫu nhiên ở ngôn ngữ này nhưng lại là tín hiệu thực sự ở ngôn ngữ khác — vì vậy chrF++ thô **không thể so sánh giữa các ngôn ngữ**, và một bản đồ được tô màu dựa trên nó sẽ vô tình thiên vị một số hệ chữ viết.

Vấn đề này là có thật, và đó là lý do tại sao bản đồ **không** xếp hạng độ mạnh giữa
các ngôn ngữ với nhau. Đây không phải là vấn đề mà chúng tôi đã giải quyết được.

## Hiệu chỉnh chúng tôi đã xây dựng, và vì sao nó không còn được dùng để tô màu bản đồ

**chrF++ hiệu chỉnh theo xác suất ngẫu nhiên (cchrF++)** tái tỷ lệ hóa điểm số để 0 có nghĩa là "không
tốt hơn mức ngẫu nhiên" *trong ngôn ngữ đó* và 1 có nghĩa là hoàn hảo:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Các ngưỡng sàn được đo lường chứ không phải giả định: đối với mỗi ngôn ngữ, chúng tôi chạy một
ước tính Monte-Carlo — hàng nghìn mốc cơ sở ngẫu nhiên có cùng hệ thống chữ viết được chấm điểm dựa trên các
tài liệu tham chiếu thực tế — chỉ sử dụng văn bản đơn ngữ công khai có sẵn (FLORES-200 dev,
lấy trực tiếp từ nguồn, không bao giờ phân phối lại). Bảng ngưỡng sàn bao gồm 196
ngôn ngữ và là một thành phẩm do Champollion tạo ra.

**Những gì hiệu chỉnh đó thực sự chứng minh được.** Ngưỡng sàn ngẫu nhiên là có tồn tại, chênh lệch
nhau tới khoảng chín lần giữa các hệ thống chữ viết, và có thể được ước tính từ văn bản đơn ngữ
mà hoàn toàn không cần nhãn chất lượng do con người đánh giá. Việc trừ đi ngưỡng này rõ ràng
loại bỏ thành phần ngẫu nhiên khỏi các mốc cơ sở tầm thường: một mánh khóe sao chép nguyên văn nguồn
đạt điểm thô hơn 15 trong tiếng Phần Lan sẽ giảm xuống khoảng 2,5, và ở hầu hết các ngôn ngữ sẽ về đúng
bằng 0. Yếu tố "ngẫu nhiên" bị loại bỏ ở đây là các thống kê bề mặt, không phải là ý nghĩa còn sót lại.

**Những gì nó không chứng minh được.** Nó làm cho điểm **0** mang cùng một ý nghĩa ở mọi
ngôn ngữ. Nhưng nó không làm cho điểm **40** mang cùng một ý nghĩa. Phía trên ngưỡng sàn, phép
hiệu chỉnh chỉ là một phép co giãn tuyến tính đơn thuần, và bằng chứng cho thấy *chất lượng* tương
đương sẽ cho điểm hiệu chỉnh tương đương giữa các ngôn ngữ chỉ mới được chứng minh ở phần đáy của
thang điểm. Khi đối chiếu với các tập dữ liệu đánh giá của con người, nó mang lại hiệu quả ở những nơi các
ngưỡng sàn thực sự khác nhau, không có tác dụng gì ở những nơi chúng giống nhau, và trên một tập dữ liệu có
các ngưỡng sàn đồng đều ở mức thấp, nó lại làm mức độ tương đồng với người đánh giá dịch chuyển theo hướng
*ngược lại* — một kết quả mà chúng tôi vẫn chưa giải thích được.

Việc tô màu bản đồ công khai bằng dải đo độ mạnh năm mức đã khẳng định nhiều hơn những gì
bằng chứng thực tế chứng minh được, đặc biệt đối với chính các ngôn ngữ có nguồn tài nguyên thấp — nơi mà việc
sai lệch đem lại hệ quả lớn nhất. Do đó, thang đo này đã bị loại bỏ cho đến khi các nghiên cứu sâu hơn làm sáng tỏ vấn đề.

Lưu ý rằng việc tô màu theo chrF++ **thô** thay vào đó chưa từng là một lựa chọn: điểm thô
hoàn toàn không thể so sánh giữa các ngôn ngữ khác nhau, và đó chính là lý do phép
hiệu chỉnh này được xây dựng ngay từ đầu. Mã hóa nhị phân là phương án dự phòng trung thực, chứ không
phải là sự hạ cấp xuống một thứ gì đó yếu kém hơn.

## Vị trí của việc đo lường trong hệ thống phân cấp

Từ đáng tin cậy nhất đến ít đáng tin cậy nhất:

1. **Xác minh bởi con người** — người nói thông thạo đánh giá kết quả đầu ra ([xác thực bởi người nói](/docs/network/specifications/speaker-validation)). Không có
   phương pháp tự động nào vượt qua được nó.
2. **Chú thích chuyên gia theo kiểu MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel và cộng sự) — giao thức
   mà WMT sử dụng cho các đánh giá chuẩn vàng; tốn kém, hiếm có, rất tốt.
3. **Điểm số tự động — chỉ trong nội bộ một cặp ngôn ngữ.** chrF++ thô, BLEU,
   COMET và các chỉ số còn lại rất hữu ích để so sánh các hệ thống trên *cùng một* cặp;
   xem [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability)
   để biết từng chỉ số có thể theo sát đánh giá của con người kém đến mức nào trên cặp ngôn ngữ của bạn.
4. **Độ mạnh giữa các ngôn ngữ.** Chúng tôi không công bố bảng xếp hạng. Xem phần trên.

Khi các kết quả được xác minh bởi con người và đạt chuẩn MQM được đưa vào bảng, chúng sẽ được ưu tiên hơn các điểm số tự động cho cùng một cặp ngôn ngữ.

## Cách bản đồ hiển thị

Mỗi trực quan mang lại chính xác một ý nghĩa:

| Kênh hiển thị | Ý nghĩa |
|---------|---------|
| **Màu sắc** | đã được đo lường. Một màu duy nhất, không có dải màu phân cấp — cung nối chỉ cho biết một lượt chạy đã chấm điểm cặp này, và không nói lên điều gì về mức độ tốt ra sao |
| **Nét đứt + làm mờ** | tạm thời: tập kiểm thử nằm dưới [ngưỡng ý nghĩa](/docs/network/specifications/significance) (n &lt; 100), nơi mà khoảng cách điểm số trong phạm vi ~5 chrF++ chỉ là nhiễu. Đây là đặc tính của kích thước mẫu, độc lập với bất kỳ chỉ số nào |
| **Độ rộng** | cố định. Không còn thông tin nào để mã hóa |

Chỉ các cặp **đã đo lường** mới vẽ nên một cung nối đo lường. Các cặp đã đăng ký — đang chờ
để đo lường nhưng chưa được chấm điểm — xuất hiện dưới dạng các đường mảnh màu mờ nhạt,
màu sắc của chúng chỉ cho biết *cặp này có thể tiếp cận được như thế nào hiện nay*
(API thương mại · mô hình mã nguồn mở · frontier, không có nhà cung cấp), chứ không bao giờ thể hiện
chất lượng dịch tốt đến đâu. Hai hệ thống biểu thị thị giác này được tách biệt có chủ ý:
các đường mảnh mờ = khả năng tiếp cận, màu đo lường duy nhất = đã đo lường.
Điểm số cơ sở của một cung nối là lượt chạy đo lường tốt nhất cho cặp đó trên
bảng công khai, được tự động làm mới khi có các lượt chạy mới hoàn thành, và được hiển thị dưới dạng
con số trong nội bộ cặp ngôn ngữ khi bạn mở cung nối — tuyệt đối không phải là thứ hạng so sánh giữa các ngôn ngữ.

## Lưu ý chi tiết

- Các ngưỡng sàn ngẫu nhiên là các thuộc tính (chỉ số × hệ thống chữ viết) được ước tính chỉ từ
  văn bản đơn ngữ; không có nội dung ngữ liệu song ngữ nào được sử dụng hay lưu trữ.
- Bản đồ tập hợp các ngưỡng sàn và phép hiệu chỉnh vẫn là nghiên cứu đã được công bố, và mã nguồn
  vẫn nằm trong kho lưu trữ đang được kiểm thử. Chúng không được kết nối với bất kỳ giao diện công khai nào.
- **Nó hiệu chỉnh mức sàn chứ không hiệu chỉnh mức trần.** Mức điểm tối đa mà một bản dịch
  thực sự tốt có thể đạt được vẫn khác nhau tùy theo từng ngôn ngữ, và phép hiệu chỉnh không tác động gì đến điều đó.
- **Nó không phải là biện pháp phòng chống hành vi sao chép khi dùng chung chữ viết.** Kết quả đầu ra chỉ đơn thuần
  sao chép văn bản nguồn vẫn có thể đạt điểm cao hơn mức ngẫu nhiên khi ngôn ngữ nguồn và ngôn ngữ đích dùng chung một hệ thống chữ viết.
- **Nó không thể thay đổi thứ tự các hệ thống trong cùng một cặp ngôn ngữ.** Phía trên ngưỡng sàn,
  phép hiệu chỉnh chỉ là một phép co giãn tuyến tính, do đó thứ hạng trong cùng cặp là hoàn toàn giống nhau
  trước và sau khi hiệu chỉnh — giá trị khả dĩ duy nhất của nó là để so sánh giữa các cặp.
- Một cung nối đã đo lường cho bạn biết cặp ngôn ngữ đó đã được chấm điểm. Nó **không** xác thực
  ý nghĩa, văn phong hay sự phù hợp về mặt văn hóa. Những yếu tố đó vẫn thuộc về sự đánh giá của con người ([những giới hạn trung thực](/docs/network/honest-limitations)).
- Phương pháp luận về ngưỡng sàn ngẫu nhiên là nghiên cứu của Champollion, được công bố tại đây
  chính là để có thể được kiểm chứng và phản biện.
