---
sidebar_position: 7
title: "Cường độ kết nối (cchrF++)"
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

Khi bản đồ mạng lưới vẽ một cung nối giữa hai ngôn ngữ, màu sắc của nó trả lời cho một câu hỏi duy nhất: **bản dịch tốt nhất được đo lường giữa chúng thực sự tốt đến mức nào — một cách trung thực?**

Phần "trung thực" này khó hơn chúng ta tưởng. Trang này giải thích, bằng ngôn ngữ bình dị, con số đằng sau màu sắc đó.

## Vấn đề: điểm số thô không bằng không tại điểm gốc

Hầu hết các điểm số của chúng tôi là **chrF++** (character n-gram F-score, [Popović 2017](https://aclanthology.org/W17-4770/)) — nó đo lường mức độ trùng lặp giữa các ký tự và từ của bản dịch so với bản dịch tham chiếu, từ 0 đến 100.

Nhưng *văn bản ngẫu nhiên không có điểm bằng không*. Mỗi hệ thống chữ viết đều mang lại một số điểm trùng lặp "miễn phí": một hệ chữ viết có ít ký tự riêng biệt, hoặc các từ dài dễ đoán, sẽ đạt điểm cao hơn mức không một cách rõ rệt ngay cả khi "bản dịch" là vô nghĩa. Sự trùng lặp miễn phí đó — **ngưỡng ngẫu nhiên (chance floor)** — khác nhau tùy theo từng ngôn ngữ. Trong các phép đo của chúng tôi, nó dao động từ khoảng 1,6 (chữ Hán) đến hơn 13 (một số ngôn ngữ sử dụng chữ Latin và chữ Ả Rập). Điểm chrF++ thô bằng 14 là nhiễu gần như ngẫu nhiên ở ngôn ngữ này nhưng lại là tín hiệu thực sự ở ngôn ngữ khác — vì vậy chrF++ thô **không thể so sánh giữa các ngôn ngữ**, và một bản đồ được tô màu dựa trên nó sẽ vô tình thiên vị một số hệ chữ viết.

## Giải pháp: trừ đi ngưỡng ngẫu nhiên

**chrF++ hiệu chỉnh ngẫu nhiên (cchrF++)** điều chỉnh lại thang điểm sao cho 0 có nghĩa là "không tốt hơn ngẫu nhiên" *trong ngôn ngữ đó* và 1 có nghĩa là hoàn hảo:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Các ngưỡng này được đo lường thực tế chứ không phải giả định: đối với mỗi ngôn ngữ, chúng tôi chạy một ước tính Monte-Carlo — hàng nghìn mốc cơ sở ngẫu nhiên có cùng hệ chữ viết được chấm điểm so với các bản tham chiếu thực tế — chỉ sử dụng văn bản đơn ngữ có sẵn công khai (FLORES-200 dev, được tải từ nguồn, không bao giờ phân phối lại). Bảng ngưỡng hiện bao gồm 196 ngôn ngữ và là một sản phẩm phái sinh từ Champollion (nguồn gốc `champollion-derived`; được tạo lại bởi `cli/website/scripts/build-cchrf-floors.mjs`).

Hai quy tắc thận trọng giúp giữ cho việc hiệu chỉnh luôn trung thực:

- **Một cặp chỉ được hiệu chỉnh khi CẢ HAI phía đều có ngưỡng đo lường.** Nếu thiếu một trong hai, cung nối sẽ hiển thị màu xám trung tính — *đã đo lường, chưa rõ ngưỡng* — và không bao giờ nằm trên dải màu.
- **Cặp ngôn ngữ sẽ sử dụng ngưỡng CAO HƠN trong hai ngưỡng.** Việc hiệu chỉnh có thể làm giảm độ mạnh thực tế chứ không bao giờ thổi phồng nó.

## Vị trí của cchrF++ trong hệ thống phân cấp

cchrF++ là thước đo độ mạnh *tự động* tốt nhất của chúng tôi — nhưng nó không nằm ở đỉnh của hệ thống phân cấp. Từ đáng tin cậy nhất đến ít đáng tin cậy nhất:

1. **Xác minh bởi con người** — người nói trôi chảy đánh giá kết quả đầu ra ([xác minh bởi người bản xứ](/docs/network/specifications/speaker-validation)). Không có công cụ tự động nào có thể vượt qua điều này.
2. **Chú thích của chuyên gia theo kiểu MQM** ([Multidimensional Quality Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel và các cộng sự) — giao thức mà WMT sử dụng cho các đánh giá chuẩn vàng; tốn kém, hiếm hoi, nhưng rất tốt.
3. **cchrF++** — đã hiệu chỉnh ngẫu nhiên, có thể so sánh giữa các ngôn ngữ, chi phí tính toán rẻ ở mọi nơi.
4. **chrF++ thô / BLEU / các chỉ số mạng thần kinh** — hữu ích trong phạm vi một tập dữ liệu; xem [Độ tin cậy của chỉ số](/docs/network/specifications/metric-reliability) để biết mỗi chỉ số có thể lệch khỏi đánh giá của con người đối với cặp ngôn ngữ của bạn đến mức nào.

Khi các kết quả được xác minh bởi con người và đạt chuẩn MQM được đưa vào bảng, chúng sẽ được ưu tiên hơn các điểm số tự động cho cùng một cặp ngôn ngữ.

## Cách bản đồ hiển thị

Mỗi trực quan mang lại chính xác một ý nghĩa:

| Kênh | Ý nghĩa |
|---------|---------|
| **Màu sắc** | Dải cchrF++ — năm bước, từ đỏ đến xanh lá dịu: *gần ngưỡng* (&lt; 0.15), *yếu* (0.15–0.35), *đang phát triển* (0.35–0.55), *có thể sử dụng* (0.55–0.75), *mạnh* (≥ 0.75) |
| **Xám trung tính** | đã đo lường, nhưng chưa rõ ngưỡng ngẫu nhiên của ít nhất một phía — không bao giờ được đưa vào dải màu |
| **Nét đứt + làm mờ** | tạm thời: tập kiểm thử nằm dưới [ngưỡng ý nghĩa](/docs/network/specifications/significance) (n &lt; 100), nơi các khoảng cách điểm số trong khoảng ~5 chrF++ chỉ là nhiễu |
| **Độ rộng** | lặp lại dải màu (để hỗ trợ khả năng tiếp cận, không phải là một biến số thứ hai) |

Chỉ các cặp **đã đo lường** mới nằm trên dải độ mạnh. Các cặp đã đăng ký — đang chờ đo lường nhưng chưa được chấm điểm — xuất hiện dưới dạng các đường mảnh màu phẳng mờ nhạt, màu sắc của chúng chỉ cho biết *cách tiếp cận cặp ngôn ngữ này hiện tại* (API thương mại · mô hình mã nguồn mở · mô hình tiên phong, không có nhà cung cấp), chứ không bao giờ thể hiện chất lượng dịch thuật tốt ra sao. Hai hệ thống ký hiệu này được phân tách một cách có chủ ý: các đường phẳng mờ = khả năng tiếp cận, dải màu từ đỏ→xanh lá = độ mạnh đo lường được. Điểm số cơ sở của một cung nối là lượt chạy đo lường tốt nhất cho cặp đó trên bảng công khai, được tự động cập nhật khi có các lượt chạy mới.

## Lưu ý chi tiết

- Các ngưỡng là các thuộc tính của chỉ số × hệ chữ viết được ước tính chỉ từ văn bản đơn ngữ; không có nội dung kho ngữ liệu song song nào được sử dụng hoặc lưu trữ.
- cchrF++ cho bạn biết một bản dịch vượt qua mức ngẫu nhiên và vượt qua bao nhiêu — nó **không** xác thực ý nghĩa, văn phong, hay sự phù hợp về mặt văn hóa. Những điều đó vẫn thuộc về đánh giá của con người ([giới hạn trung thực](/docs/network/honest-limitations)).
- Phương pháp luận ngưỡng ngẫu nhiên là nghiên cứu của Champollion; tập bản đồ ngưỡng và phần hiệu chỉnh được công bố tại đây chính xác là để chúng có thể được kiểm tra và phản biện.
