---
sidebar_position: 8
title: "Giao thức xác thực người nói"
slug: '/network/specifications/speaker-validation'
---

# Giao thức Xác thực bởi Người nói

> **Mục đích.** Tài liệu này xác định chính xác những gì chúng tôi cần từ những người nói song ngữ Cree–Tiếng Anh để xác thực các số liệu đánh giá LYSS. Nếu không có sự xác thực này, các điểm số tự động của chúng tôi chỉ là những ước tính kỹ thuật, không phải là các phép đo chất lượng đã được chứng minh. Đây là khoảng trống quan trọng nhất trong dự án.
>
> **Đối tượng.** Các đối tác cộng đồng, cộng tác viên tiềm năng, người đánh giá tài trợ và nhóm dự án.


---

## 1. Tại sao chúng tôi cần người nói bản xứ

Khung đánh giá LYSS (Linguistically-informed Yield & Structural Scoring) tính toán điểm số chất lượng tự động cho các bản dịch từ tiếng Anh → tiếng Cree Đồng bằng (Plains Cree). Khung này sử dụng ba tín hiệu cốt lõi:

- **LYSS-fst**: Bản dịch đầu ra có chứa các từ tiếng Cree hợp lệ không? (được kiểm tra bởi bộ chuyển đổi trạng thái hữu hạn GiellaLT)
- **LYSS-eq**: Bản dịch đầu ra có phải là một biến thể chấp nhận được của bản dịch tham chiếu không? (được kiểm tra bởi các lớp tương đương của linter)
- **LYSS-sem**: Bản dịch đầu ra có giữ nguyên ý nghĩa của văn bản nguồn không? (được kiểm tra bởi bộ xác thực ngữ nghĩa)

Các chỉ số này tạo ra các con số. **Chúng tôi không biết liệu những con số đó có ý nghĩa gì hay không.** FST có thể từ chối các từ hợp lệ mà nó không nhận diện được (từ mượn, từ mới, danh từ riêng). Linter có thể bỏ sót các trường hợp tương đương hợp lệ hoặc chấp nhận các trường hợp không hợp lệ. Bộ xác thực ngữ nghĩa có thể đánh giá sai ý nghĩa. Cho đến khi những người nói song ngữ cho chúng tôi biết liệu điểm số tự động của chúng tôi có khớp với đánh giá của con người về chất lượng dịch thuật hay không, chúng tôi vẫn chỉ đang đoán mò.

Mọi chỉ số đánh giá dịch máy (MT) lớn (BLEU, COMET, chrF++) đều được xác thực bằng cách so sánh điểm số tự động với hàng nghìn đánh giá chất lượng của con người. Chúng tôi cũng cần điều tương tự — ở quy mô nhỏ hơn vì tài nguyên có hạn, nhưng với cùng một mức độ nghiêm ngặt.

---

## 2. Những gì chúng tôi cần: Ba nhiệm vụ

### Nhiệm vụ A: Đánh giá chất lượng bản dịch (Chính — tổng cộng khoảng 8 giờ)

**Nội dung:** Đánh giá 200 bản dịch tiếng Anh → tiếng Cree do máy tạo ra theo hai thang đo.

**Đối tượng:** Từ 3 người nói song ngữ tiếng Cree Đồng bằng – tiếng Anh trở lên, có khả năng đọc trôi chảy hệ chữ viết SRO (Standard Roman Orthography).

**Cách thức hoạt động:**

1. Chúng tôi cung cấp một bảng tính hoặc biểu mẫu web gồm 200 hàng. Mỗi hàng bao gồm:
   - Câu nguồn tiếng Anh
   - Bản dịch tiếng Cree do máy tạo ra
   - (Tùy chọn) bản dịch tiếng Cree tham chiếu để so sánh

2. Đối với mỗi bản dịch, người nói sẽ đánh giá hai yếu tố:

   **Độ đầy đủ (Adequacy)** (bản dịch có truyền tải đúng nội dung không?):
   | Điểm | Nhãn | Ý nghĩa |
   |------|-------|---------|
   | 1 | Không có | Bản dịch không liên quan gì đến văn bản nguồn |
   | 2 | Ít | Khớp được một vài từ nhưng ý nghĩa tổng thể bị sai |
   | 3 | Nhiều | Ý nghĩa cốt lõi được đảm bảo nhưng các phần quan trọng bị thiếu hoặc sai |
   | 4 | Hầu hết | Hầu hết mọi thứ đều chính xác, chỉ có một vài khoảng trống nhỏ về nghĩa |
   | 5 | Toàn bộ | Bản dịch truyền tải đầy đủ ý nghĩa của văn bản nguồn |

   **Độ trôi chảy (Fluency)** (nghe có giống tiếng Cree tự nhiên không?):
   | Điểm | Nhãn | Ý nghĩa |
   |------|-------|---------|
   | 1 | Không thể hiểu được | Đây không phải là tiếng Cree |
   | 2 | Không trôi chảy | Các từ riêng lẻ có thể là tiếng Cree nhưng cấu trúc câu bị hỏng |
   | 3 | Không tự nhiên | Có thể hiểu được nhưng rõ ràng không phải là cách người nói tiếng Cree sẽ nói |
   | 4 | Tốt | Nghe tự nhiên nhưng vẫn còn một vài chỗ gượng gạo nhỏ |
   | 5 | Hoàn hảo | Một người nói tiếng Cree bản xứ hoàn toàn có thể viết như thế này |

3. Tùy chọn, người nói có thể thêm ghi chú tự do để giải thích cho đánh giá của mình (ví dụ: "sai sự hòa hợp động tính/vô tính ở động từ", "đây là phương ngữ th nhưng tôi đánh giá dựa trên phương ngữ y").

**Ước tính thời gian:** ~2,5 phút cho mỗi bản dịch × 200 bản dịch = ~8 giờ. Có thể chia thành nhiều buổi (ví dụ: 4 buổi, mỗi buổi 2 giờ trong vòng 2 tuần).

**Thù lao:** 50–65 CAD/giờ (khớp với mức thù lao cho người nói trong BENCHMARK_SPEC §10.3). Tổng cộng mỗi người: 400–520 CAD. Cho 3 người: **1.200–1.560 CAD**.

**Chúng tôi sẽ làm gì với dữ liệu này:** Chúng tôi tính toán hệ số tương quan giữa điểm số LYSS tự động và đánh giá của người nói. Nếu LYSS-fst tương quan với điểm đánh giá độ trôi chảy và LYSS-sem tương quan với điểm đánh giá độ đầy đủ, các chỉ số này sẽ được xác thực. Nếu không, chúng tôi sẽ biết cần phải sửa chúng ở đâu.

---

### Nhiệm vụ B: Xác thực tính tương đương của Linter (~2 giờ)

**Nội dung:** Xem xét 50 cặp bản dịch tiếng Cree mà linter của chúng tôi phân loại là "tương đương" và cho chúng tôi biết liệu chúng có thực sự mang ý nghĩa giống nhau hay không.

**Đối tượng:** 1–2 người nói song ngữ (có thể là cùng những người tham gia Nhiệm vụ A).

**Cách thức hoạt động:**

1. Chúng tôi cung cấp 50 cặp bản dịch. Mỗi cặp bao gồm:
   - Văn bản nguồn tiếng Anh
   - Bản dịch A (bản dịch tham chiếu)
   - Bản dịch B (một biến thể mà linter của chúng tôi cho là tương đương)
   - Lý do tương đương (ví dụ: "hoán đổi trật tự từ", "biến thể chính tả", "lược bỏ tiểu từ tùy chọn")

2. Đối với mỗi cặp, người nói sẽ trả lời:
   - **Cùng ý nghĩa?** Có / Không / Tùy thuộc vào ngữ cảnh
   - **Cả hai đều tự nhiên?** Có / A tốt hơn / B tốt hơn / Cả hai đều không tự nhiên
   - **Ghi chú** (văn bản tự do tùy chọn)

**Ước tính thời gian:** ~2 phút cho mỗi cặp × 50 cặp = ~2 giờ.

**Thù lao:** 50–65 CAD/giờ × 2 giờ = **100–130 CAD mỗi người**.

**Chúng tôi sẽ làm gì với dữ liệu này:** Chúng tôi tính toán độ chính xác (precision) của từng lớp tương đương. Nếu người nói xác nhận 90% các trường hợp tương đương về "trật tự từ" là thực sự tương đương, lớp đó sẽ được xác thực. Nếu họ nói rằng 40% các trường hợp tương đương về "từ đồng nghĩa của từ gốc" là sai, chúng tôi biết rằng cần phải sửa đổi hoặc loại bỏ lớp đó.

---

### Nhiệm vụ C: Đánh giá tỷ lệ từ chối sai của FST (~1,5 giờ)

**Nội dung:** Xem xét 100 từ tiếng Cree bị bộ phân tích FST từ chối (báo rằng không phải là từ tiếng Cree hợp lệ) và cho chúng tôi biết liệu chúng có thực sự hợp lệ hay không.

**Đối tượng:** 1 người nói song ngữ có vốn từ vựng tiếng Cree phong phú.

**Cách thức hoạt động:**

1. Chúng tôi chạy bộ phân tích FST trên kho ngữ liệu phát triển EdTeKLA gồm 436 mục của chúng tôi (`textbook_dev.json`) và thu thập mọi từ mà nó từ chối.
2. Chúng tôi trình bày tối đa 100 từ bị từ chối cho người nói cùng với ngữ cảnh câu của chúng.
3. Đối với mỗi từ, người nói sẽ trả lời:
   - **Đây có phải là một từ Cree hợp lệ không?** Có / Không / Không chắc chắn
   - **Nếu có, đó là loại từ gì?** Từ đã được thiết lập / Từ mượn / Tên riêng / Dạng phương ngữ / Từ mới / Khác
   - **Ghi chú** (tùy chọn)

**Ước tính thời gian:** ~1 phút cho mỗi từ × 100 từ = ~1,5 giờ.

**Thù lao:** 50–65 CAD/giờ × 1,5 giờ = **75–100 CAD**.

**Chúng tôi sẽ làm gì với dữ liệu này:** Chúng tôi tính toán tỷ lệ từ chối sai (false rejection rate) của FST. Nếu FST từ chối 50 từ và người nói xác nhận 30 từ trong số đó là hợp lệ, tỷ lệ từ chối sai là 60% — mức cao không thể chấp nhận được, đòi hỏi phải có một danh sách cho phép (allowlist) dành cho từ mượn/ngoại lệ. Nếu người nói chỉ xác nhận 5 từ là hợp lệ, tỷ lệ từ chối sai là 10% — chỉ số này là đáng tin cậy.

---

## 3. Tổng thời gian và chi phí cam kết của người nói

| Nhiệm vụ | Số lượng người nói cần thiết | Số giờ mỗi người | Chi phí mỗi người | Tổng chi phí |
|------|----------------|-------------------|-----------------|------------|
| A: Đánh giá chất lượng | 3 | ~8 giờ | 400–520 CAD | 1.200–1.560 CAD |
| B: Xác thực Linter | 2 | ~2 giờ | 100–130 CAD | 200–260 CAD |
| C: Đánh giá FST | 1 | ~1,5 giờ | 75–100 CAD | 75–100 CAD |
| **Tổng cộng** | **3 người nói** | **~11,5 giờ (tối đa mỗi người)** | **575–750 CAD (tối đa)** | **1.475–1.920 CAD** |

Nếu cùng 3 người nói thực hiện tất cả các nhiệm vụ: **~11,5 giờ mỗi người trong vòng 2–4 tuần, 575–750 CAD mỗi người**.

Một người nói chỉ thực hiện Nhiệm vụ A sẽ cam kết khoảng **~8 giờ trong vòng 2 tuần với mức thù lao 400–520 CAD**.

---

## 4. Tiêu chuẩn đối với người nói

**Yêu cầu bắt buộc:**
- Nói song ngữ tiếng Cree Đồng bằng và tiếng Anh
- Đọc trôi chảy hệ chữ viết SRO (Standard Roman Orthography)
- Sẵn sàng đánh giá các bản dịch theo một thang đo có cấu trúc

**Ưu tiên:**
- Có kinh nghiệm với phương ngữ y (phương ngữ được sử dụng trong kho ngữ liệu tham chiếu của chúng tôi từ EDTeKLA)
- Có kinh nghiệm giảng dạy hoặc dịch thuật (giúp đưa ra đánh giá chất lượng chuẩn xác hơn)
- Quen thuộc với các văn phong khác nhau (trang trọng, giáo dục, giao tiếp hàng ngày)

**Không yêu cầu:**
- Kiến thức kỹ thuật hoặc xử lý ngôn ngữ tự nhiên (NLP) (chúng tôi cung cấp tất cả các công cụ và ngữ cảnh)
- Kỹ năng máy tính phức tạp (giao diện đánh giá sẽ là một bảng tính hoặc biểu mẫu web đơn giản)
- Đã từng tham gia vào dự án Champollion trước đó

---

## 5. Quản trị dữ liệu {#5-data-governance}

Tất cả các đóng góp của người nói đều được quản lý bởi các chính sách dữ liệu hướng tới chủ quyền dữ liệu của dự án:

- **Quyền sở hữu:** Đánh giá chất lượng của người nói vẫn là đóng góp trí tuệ của chính họ. Họ sẽ được ghi nhận danh tính bằng tên (hoặc ẩn danh, tùy theo lựa chọn của họ) trong bất kỳ ấn phẩm nào.
- **Quyền kiểm soát:** Người nói có thể rút lại các đánh giá của mình bất kỳ lúc nào. Việc rút lại sẽ xóa dữ liệu của họ khỏi tất cả các phân tích.
- **Quyền truy cập:** Dữ liệu đánh giá được lưu trữ trên cơ sở hạ tầng do tổ chức quản trị cộng đồng kiểm soát (khi được thành lập) hoặc trên nền tảng ưa thích của người nói.
- **Quyền sở hữu vật lý:** Dữ liệu đánh giá thô không bao giờ được công bố. Chỉ có các số liệu thống kê tổng hợp (hệ số tương quan, độ đồng thuận giữa các người đánh giá) mới xuất hiện trong các ấn phẩm.
- **Thù lao:** Người nói được trả tiền cho thời gian của họ bất kể chúng tôi có sử dụng các đánh giá của họ hay không. Việc thanh toán không phụ thuộc vào kết quả đánh giá.

---

## 6. Quyền lợi của người nói {#6-what-speakers-get}

Ngoài thù lao:

- **Đồng tác giả** trong bất kỳ ấn phẩm nào sử dụng đánh giá của họ (nếu muốn)
- **Được ghi nhận đóng góp** trong tất cả các tài liệu của dự án
- **Quyền tiếp cận sớm** các công cụ và kết quả đánh giá
- **Đóng góp ý kiến** về cách sử dụng các chỉ số — nếu người nói cho rằng "linter của bạn sai ở điểm X", chúng tôi sẽ sửa linter đó
- **Quyền phủ quyết** đối với việc công bố các kết quả mà họ thấy có vấn đề

---

## 7. Cách thức bắt đầu {#7-how-to-get-started}

Nếu bạn là người nói song ngữ tiếng Cree – tiếng Anh quan tâm đến việc tham gia, hoặc nếu bạn biết ai đó có thể quan tâm:

1. **Liên hệ với chúng tôi** tại [email/liên hệ của dự án] — không yêu cầu cam kết, chỉ là một cuộc trò chuyện trao đổi
2. **Chúng tôi giải thích các nhiệm vụ** bằng ngôn ngữ bình dân, dễ hiểu (không dùng thuật ngữ chuyên ngành phức tạp)
3. **Bạn chọn nhiệm vụ** mà mình quan tâm (A, B, C hoặc bất kỳ sự kết hợp nào)
4. **Chúng tôi thiết lập một lịch trình** phù hợp với bạn (các khoảng thời gian 2 giờ, thời gian linh hoạt)
5. **Bạn đánh giá các bản dịch** qua bảng tính hoặc biểu mẫu web — từ bất kỳ đâu, vào thời gian rảnh của bạn
6. **Chúng tôi thanh toán nhanh chóng** — trong vòng 2 tuần sau khi hoàn thành mỗi phần nhiệm vụ

---

## 8. Điều gì xảy ra sau đó

Với dữ liệu xác thực từ người nói, chúng tôi có thể:

1. **Công bố các hệ số tương quan của chỉ số** — chứng minh (hoặc bác bỏ) rằng điểm số LYSS phản ánh đúng đánh giá của con người
2. **Hiệu chuẩn lại các chỉ số** — điều chỉnh trọng số, ngưỡng và các lớp tương đương dựa trên phản hồi của người nói
3. **Sửa lỗi linter** — loại bỏ các trường hợp tương đương sai, thêm các trường hợp còn thiếu
4. **Sửa danh sách cho phép (allowlist) của FST** — thêm các từ hợp lệ mà FST đã từ chối một cách không chính xác
5. **Nộp bài báo cho các hội nghị/tạp chí học thuật** — với người nói là đồng tác giả, thiết lập LYSS như một chỉ số đánh giá đã được xác thực cho việc đánh giá dịch máy ngôn ngữ đa tổng hợp

Nếu không có sự xác thực từ người nói, LYSS vẫn chỉ là một công cụ kỹ thuật. Có nó, LYSS sẽ trở thành một chỉ số đánh giá có cơ sở khoa học vững chắc. Đó là sự khác biệt giữa "chúng tôi đã xây dựng một thứ gì đó" và "chúng tôi đã chứng minh nó hoạt động hiệu quả".

---


## Điều này dẫn đến đâu trên trang web này

Xác thực của người nói là một giai đoạn trong một quy trình lớn hơn: luồng công việc
[Hợp tác Kho ngữ liệu](/docs/network/specifications/corpus-partnership)
là nơi các nhiệm vụ này kết hợp vào việc xây dựng một kho ngữ liệu đánh giá, và
[Cách thức Trả thù lao cho Người nói](/docs/network/perspectives/how-speakers-get-paid)
là phiên bản ngôn ngữ dễ hiểu của các mức giá và điều khoản ở trên.
