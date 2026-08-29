---
sidebar_position: 7
title: "Khung thiết kế ngữ liệu"
---

# Khung Thiết kế Tập ngữ liệu Đánh giá (Evaluation Corpus Design Framework)

Khi bạn đánh giá một frontier model trên FLORES+ và nó đạt 85 điểm chrF++, bạn không thể phân biệt được "mô hình này dịch tốt" hay "mô hình này đã ghi nhớ các cặp câu cụ thể này." Sự mơ hồ duy nhất đó là lý do framework này tồn tại: một ngữ liệu đánh giá chỉ đáng để xây dựng nếu điểm số của nó phản ánh đúng những gì chúng tuyên bố, và điều đó đòi hỏi một thiết kế có chủ đích — các cặp câu mới, nguồn gốc được theo dõi, phân tầng lĩnh vực, phân cấp độ khó. Trang này là nguồn thông tin chuẩn xác về cách các tập dữ liệu đánh giá của Champollion được thiết kế, xây dựng và duy trì.

> **Phiên bản:** 1.0 · **Trạng thái:** Bản nháp · Tài liệu đi kèm: quy trình [Corpus Partnership](/docs/network/specifications/corpus-partnership) đưa phương pháp luận này vào thực tiễn với một bộ phận nghiên cứu.

---

## 1. Nguyên tắc Thiết kế

### 1.1 — Tại sao không dùng các Benchmark Công khai?

Các tập ngữ liệu song song công khai (FLORES+, Tatoeba, các bộ kiểm thử WMT, OPUS) luôn có sẵn để phát triển và gỡ lỗi nhưng bị **loại trừ khỏi bảng xếp hạng đánh giá chính thức**. Lý do rất đơn giản:

**Ô nhiễm dữ liệu.** Các Frontier LLM được huấn luyện trên lượng dữ liệu thu thập từ web khổng lồ. Bất kỳ văn bản song ngữ nào từng tồn tại công khai — đặc biệt là trong các tập dữ liệu benchmark được chọn lọc và trích dẫn rộng rãi — rất có thể đã nằm trong dữ liệu huấn luyện của chúng. Đây không phải là một mối lo ngại trên lý thuyết — [nghiên cứu đã chứng minh](https://arxiv.org/abs/2311.04850) các tác động ô nhiễm có thể đo lường được trên các benchmark MT. (Các benchmark công khai vẫn được chạy ở đây — nhưng chỉ trong một hạng mục *so sánh tương đối* để xếp hạng các phương pháp với nhau, không bao giờ được xem là chất lượng tuyệt đối.)

Đối với Champollion, điều này đặc biệt quan trọng vì:
- Bảng xếp hạng so sánh song song các phương pháp LLM, các dịch vụ MT truyền thống và các hệ thống được xây dựng cho mục đích cụ thể
- Tuyên ngôn giá trị của chúng tôi là *đánh giá trung thực, nghiêm ngặt*
- Người dùng mục tiêu của chúng tôi (các cộng đồng ngôn ngữ) đưa ra quyết định triển khai dựa trên những điểm số này

### 1.2 — Các Yêu cầu Cốt lõi

Mỗi tập ngữ liệu đánh giá của Champollion phải đáp ứng:

| Yêu cầu | Cơ sở lý luận |
|-------------|-----------|
| **Do con người viết** | Không sử dụng dữ liệu tổng hợp. Tất cả văn bản nguồn và bản dịch tham chiếu phải do con người viết. LLM có thể hỗ trợ căn chỉnh (alignment) và định dạng nhưng không bao giờ được tự tạo nội dung. |
| **Không công khai ở dạng song song** | Văn bản nguồn có thể công khai; bản dịch tham chiếu có thể công khai; nhưng *sự ghép cặp* cụ thể đó không được tồn tại dưới dạng một tập ngữ liệu song song có thể tải xuống. |
| **Được theo dõi nguồn gốc** | Mỗi mục nhập phải có nguồn gốc được ghi chép rõ ràng: tài liệu nguồn, người dịch, giấy phép, ngày tháng. |
| **Dựa trên thông tin ngôn ngữ học** | Phạm vi bao phủ phải được định hướng bởi các đặc điểm loại hình học (typological features), không phải lấy mẫu ngẫu nhiên. |
| **Phân tầng theo lĩnh vực** | Các mục nhập phải trải dài trên các lĩnh vực văn bản được xác định với tỷ lệ đại diện được kiểm soát. |
| **Phân cấp độ khó** | Các mục nhập phải được gán các cấp độ khó (1–5) dựa trên độ phức tạp về cấu trúc. |
| **Được kiểm soát phiên bản** | Các phiên bản tập ngữ liệu được băm nội dung (content-hashed). Điểm số chỉ có thể so sánh được trong cùng một phiên bản. |
| **Cộng đồng có thể đánh giá** | Các bản dịch tham chiếu phải có thể được xem xét và đánh giá bởi các thành viên trong cộng đồng ngôn ngữ. |

### 1.3 — Tính Trung lập về Loại Tập ngữ liệu, Độ dài và Phong cách

Champollion là một trung tâm đánh giá dịch thuật mở và **trung lập về định nghĩa của một đơn vị dịch thuật**. Một mục nhập trong tập ngữ liệu là văn bản có độ dài tùy ý — một câu ngắn đơn lẻ, một câu dài gồm nhiều mệnh đề, một đoạn văn hoặc toàn bộ tài liệu — và nền tảng này đánh giá tất cả chúng theo cùng một cách. **Không có giới hạn nào đối với văn bản ngắn hoặc dễ.** Hệ thống kiểm thử (harness) không áp đặt giới hạn độ dài (nó cố tình thiết lập khoảng trống token đầu ra rộng rãi để tránh cắt ngắn các bản dịch dài); các cấp độ khó (§3) và lĩnh vực (§2.1) là *các trục có thể cấu hình*, chứ không phải là rào cản để loại trừ các tài liệu khó hoặc dài.

Trung tâm này trung lập và có thể cấu hình trên các trục:

| Trục | Phạm vi |
|------|-------|
| **Độ chi tiết (Granularity)** | câu · câu dạng dài · đoạn văn · tài liệu (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Độ dài & độ phức tạp** | ngắn → dài; đơn giản → rất phức tạp (cấp độ khó 1–5) |
| **Phong cách & văn phong (register)** | trang trọng, thân mật, kỹ thuật, văn học, hội thoại, hành chính (phân loại lĩnh vực, §2.1) |
| **Phương pháp** | bất kỳ `TranslationMethod` nào — LLM, NMT mạng nơ-ron, dựa trên luật, lai (hybrid), con người |
| **Ngôn ngữ & cặp ngôn ngữ** | bất kỳ cặp ngôn ngữ có hướng nào; không tích hợp sẵn định kiến thiên vị ngôn ngữ tài nguyên cao |

Một tập ngữ liệu sẽ khai báo loại, độ chi tiết, văn phong và độ khó của riêng nó trong thẻ thông tin (card) của nó, và hệ thống kiểm thử sẽ tôn trọng bất kỳ điều gì thẻ đó khai báo. Các tập ngữ liệu **phát triển** mặc định có nguồn gốc từ Tatoeba là các câu ngắn vì bản thân Tatoeba là như vậy — đó là đặc tính của các tập ngữ liệu nguồn đó, **không phải** là giới hạn của nền tảng. Các bộ đánh giá cấp độ tài liệu và dạng dài là những đối tượng hạng nhất (first-class); hãy đăng ký chúng theo cùng một cách (và ví dụ, đối với các mục nhập rất dài, hãy cấu hình kích thước lô yêu cầu nhỏ hơn).

---

## 2. Lựa chọn Văn bản Nguồn

### 2.1 — Phân loại Lĩnh vực (Domain Taxonomy)

Champollion đánh giá dịch thuật cho **các bối cảnh triển khai thực tế**, không phải các bài tập học thuật. Mỗi mục nhập trong tập ngữ liệu được gắn thẻ với một lĩnh vực từ **hệ thống phân loại lĩnh vực 16 mã chuẩn**, được xác thực tại thời điểm xây dựng.

Hệ thống phân loại này được định nghĩa một lần duy nhất — trong [Benchmark Specification §2.7](/docs/network/specifications/benchmark#27-domain), nguồn thông tin gốc duy nhất — và không được nhắc lại ở đây để tránh sai lệch. Các mã là: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, và `ui`. Xem §2.7 để biết mô tả của từng mã và đối tượng sử dụng điển hình. Không tự ý đưa vào các mã lĩnh vực nằm ngoài tập hợp đó.

### 2.2 — Phân bổ Lĩnh vực

Một tập ngữ liệu đánh giá tiêu chuẩn nên hướng tới sự phân bổ rộng khắp các lĩnh vực có liên quan nhất đến cộng đồng mục tiêu. Các mã và tỷ lệ phần trăm chính xác sẽ thay đổi tùy theo cặp ngôn ngữ; bảng dưới đây là một phân bổ mục tiêu mang tính *minh họa*, sử dụng các mã chuẩn từ §2.1:

| Lĩnh vực | Mã | % Mục tiêu | Cơ sở lý luận |
|--------|------|----------|-----------|
| Giao diện phần mềm (Software UI) | `ui` | 25% | Bối cảnh triển khai chính cho người dùng CLI của champollion |
| Chính phủ / Hành chính | `gov` | 15% | Dịch thuật có tính chất quan trọng với các tác động pháp lý |
| Giáo dục | `edu` | 15% | Trường hợp sử dụng cốt lõi cho việc phục hồi ngôn ngữ |
| Văn học / Tự sự | `literary` | 10% | Kiểm tra sắc thái văn hóa và văn phong văn học |
| Hội thoại | `conv` | 10% | Kiểm tra văn phong thân mật và các mẫu lời nói tự nhiên |
| Kỹ thuật | `tech` | 10% | Kiểm tra độ chính xác và tính nhất quán của thuật ngữ |
| Y tế / Sức khỏe | `medical` | 10% | Quan trọng, kiểm tra từ vựng chuyên ngành |
| Tin tức / Báo chí | `news` | 5% | Kiểm tra từ vựng đương đại và văn phong trung lập |

### 2.3 — Tiêu chí Lựa chọn Nguồn

Khi lựa chọn văn bản nguồn cho một tập ngữ liệu mới:

1. **Tính tương thích của giấy phép.** Văn bản nguồn phải thuộc giấy phép cho phép sử dụng trong tập ngữ liệu đánh giá. Ưu tiên CC BY, CC BY-SA hoặc thuộc phạm vi công cộng (public domain). Hãy ghi chép rõ ràng về giấy phép.

2. **Tính cập nhật.** Ưu tiên các văn bản được xuất bản trong vòng 10 năm qua. Ngôn ngữ luôn phát triển — đặc biệt là từ vựng xung quanh công nghệ, quản trị và y tế.

3. **Sự đa dạng về văn phong.** Trong mỗi lĩnh vực, hãy tìm kiếm các văn bản ở các mức độ trang trọng khác nhau. Một thông cáo báo chí của chính phủ (trang trọng) và một bài đăng trên mạng xã hội của chính phủ (thân mật) đều thuộc lĩnh vực `admin` nhưng có văn phong khác nhau.

4. **Sự phù hợp về văn hóa.** Đối với các ngôn ngữ bản địa và ngôn ngữ thiểu số, hãy ưu tiên các văn bản có ý nghĩa quan trọng đối với cộng đồng — tài liệu quản lý đất đai, tài liệu giáo dục bằng ngôn ngữ đó, văn bản bảo tồn văn hóa — thay vì các văn bản tình cờ tồn tại ở dạng song song.

5. **Không sử dụng nguồn dịch máy.** Nếu một tài liệu "song song" được tạo ra bằng cách chạy bản gốc qua Google Translate rồi hiệu đính (post-editing), nó KHÔNG được chấp nhận làm bản dịch tham chiếu. Bản dịch tham chiếu phải là một bản dịch độc lập do con người thực hiện.

---

## 3. Hệ thống Cấp độ Khó

### 3.1 — Định nghĩa Cấp độ

Mỗi mục nhập được gán một cấp độ khó (1–5) dựa trên độ phức tạp về cấu trúc của *văn bản nguồn*, chứ không phải độ khó dịch thuật (vốn thay đổi tùy theo phương pháp).

| Cấp độ | Nhãn | Đặc điểm Cấu trúc |
|------|-------|---------------------------|
| 1 | **Cơ bản (Elementary)** | Các câu đơn giản. Một mệnh đề duy nhất. Thì hiện tại. Từ vựng thông dụng. Không có thành ngữ. Không có cấu trúc lồng ghép. |
| 2 | **Trung cấp (Intermediate)** | Các câu ghép. Hai mệnh đề được nối với nhau bằng liên từ. Thì quá khứ/tương lai. Một số từ vựng chuyên ngành. |
| 3 | **Nâng cao (Advanced)** | Các câu phức. Mệnh đề phụ, mệnh đề quan hệ. Trộn lẫn các thì. Thuật ngữ chuyên ngành. Thể bị động. |
| 4 | **Chuyên gia (Expert)** | Nhiều mệnh đề lồng nhau. Văn phong pháp lý/kỹ thuật. Cấu trúc điều kiện. Khái niệm trừu tượng. Các tham chiếu văn hóa. |
| 5 | **Cực khó (Extreme)** | Văn xuôi dày đặc với nhiều thách thức đồng thời: mệnh đề phụ lồng nhau, tham chiếu đại từ mơ hồ, thành ngữ văn hóa, văn phong hỗn hợp, từ vựng hiếm gặp. |

### 3.2 — Các Yêu cầu Độ khó Dựa trên Thông tin Ngôn ngữ học

Bên cạnh độ phức tạp về cấu trúc, độ khó còn được điều chỉnh bởi **khoảng cách loại hình học (typological distance)** giữa ngôn ngữ nguồn và ngôn ngữ đích. Các yếu tố này được rút ra từ các đặc điểm loại hình học của WALS và dữ liệu phân loại của thẻ ngôn ngữ (language card):

| Yếu tố | Độ khó Thấp | Độ khó Cao |
|--------|---------------|-----------------|
| **Trật tự từ** | Cùng trật tự cơ bản (ví dụ: SVO→SVO) | Khác trật tự cơ bản (ví dụ: SVO→SOV) |
| **Loại hình hình thái học** | Loại hình tương tự (ví dụ: analytic→analytic) | Loại hình khác nhau (ví dụ: analytic→polysynthetic) |
| **Giống ngữ pháp (Grammatical gender)** | Cùng hệ thống hoặc không có giống | Nguồn không có giống, đích có hệ thống giống phức tạp |
| **Kính ngữ/Văn phong** | Không có đánh dấu văn phong | Đích có hệ thống văn phong phức tạp (ví dụ: tiếng Nhật, tiếng Hàn) |
| **Hệ chữ viết** | Cùng hệ chữ viết | Khác hệ chữ viết (yêu cầu chuyển tự) |
| **Tính hữu sinh (Animacy)** | Không phân biệt tính hữu sinh | Đích có sự hòa hợp dựa trên tính hữu sinh (ví dụ: tiếng Cree) |
| **Tính chứng thực (Evidentiality)** | Không có tính chứng thực | Đích đánh dấu nguồn thông tin bằng ngữ pháp |

### 3.3 — Phân bổ Cấp độ

Một tập ngữ liệu tiêu chuẩn nên có tỷ lệ xấp xỉ:

| Cấp độ | % Mục tiêu | Cơ sở lý luận |
|------|----------|-----------|
| 1 | 15% | Thiết lập mức cơ sở (baseline) — ngay cả các phương pháp kém cũng phải xử lý được những câu này |
| 2 | 25% | Dịch thuật thực tế cơ bản và thiết yếu |
| 3 | 30% | Nơi sự khác biệt về chất lượng giữa các phương pháp bắt đầu lộ rõ |
| 4 | 20% | Phân biệt giữa phương pháp tốt và phương pháp xuất sắc |
| 5 | 10% | Kiểm thử mức trần (ceiling test) — rất ít phương pháp có thể xử lý tốt những câu này |

---

## 4. Chất lượng Bản dịch Tham chiếu

### 4.1 — Yêu cầu đối với Người dịch

Các bản dịch tham chiếu phải được thực hiện bởi những người dịch là con người đáp ứng:

1. **Người nói trôi chảy** ngôn ngữ đích (L1 hoặc tương đương)
2. **Có khả năng đọc viết thành thạo** cả ngôn ngữ nguồn và ngôn ngữ đích
3. **Có hiểu biết về lĩnh vực** của văn bản (ví dụ: người dịch y khoa cho các văn bản sức khỏe, v.v.)
4. **Độc lập** — người dịch không được tiếp cận với bất kỳ kết quả dịch máy (MT) nào cho cùng một văn bản trong quá trình dịch

### 4.2 — Bản Yêu cầu Dịch thuật (Translation Brief)

Mỗi người dịch sẽ nhận được một bản yêu cầu bao gồm:

- **Văn phong** cần sử dụng (trang trọng, hội thoại, v.v.)
- **Đối tượng độc giả mục tiêu** (công chúng, chuyên gia, trẻ em, v.v.)
- Bất kỳ **quy ước thuật ngữ** nào đặc thù cho cộng đồng ngôn ngữ đó
- Hướng dẫn rõ ràng: "Hãy dịch nghĩa, không dịch từ. Một bản dịch nghe tự nhiên có giá trị hơn một bản dịch sát nghĩa từng chữ."

### 4.3 — Đảm bảo Chất lượng

1. **Dịch song song (Dual translation).** Lý tưởng nhất là mỗi mục nhập có hai bản dịch tham chiếu độc lập bởi các người dịch khác nhau. Khi điều này không khả thi, hãy ưu tiên dịch song song cho các Cấp độ 4–5.

2. **Cộng đồng xem xét.** Các bản dịch tham chiếu nên được xem xét bởi ít nhất một người nói khác không phải là người thực hiện bản dịch đó.

3. **Các biến thể được chấp nhận.** Đối với mỗi bản dịch tham chiếu, hãy ghi chép lại các biến thể được chấp nhận đã biết (trật tự từ, quy ước chính tả, các dạng phương ngôn). Những thông tin này sẽ cung cấp dữ liệu cho chỉ số đo lường `equivalent_match_rate`.

### 4.4 — Điều gì tạo nên một Bản dịch Tham chiếu Tồi

| Vấn đề | Tại sao nó làm mất hiệu lực đánh giá |
|---------|------------------------------|
| Được dịch máy rồi hiệu đính | Việc hiệu đính vẫn giữ nguyên cấu trúc dịch máy; gây bất lợi cho các phương pháp tạo ra bản dịch tự nhiên hơn |
| Được dịch bởi người đang học, không phải người nói trôi chảy | Bản dịch tham chiếu có thể chứa lỗi, dẫn đến việc phạt các kết quả dịch máy đúng |
| Quá sát nghĩa từng chữ | Các bản dịch tự nhiên sẽ bị điểm kém khi so sánh với các bản dịch tham chiếu quá sát nghĩa |
| Chỉ có một cách hiểu duy nhất cho nguồn mơ hồ | Phạt các cách hiểu thay thế khác cũng hợp lệ |

---

## 5. Ngăn ngừa Rò rỉ Dữ liệu (Contamination Prevention)

### 5.1 — Mô hình Mối đe dọa Rò rỉ Dữ liệu

| Mối đe dọa | Mô tả | Biện pháp giảm thiểu |
|--------|-------------|------------|
| **Trùng lặp dữ liệu huấn luyện** | Các LLM được huấn luyện trên tập ngữ liệu song song | Không công bố công khai tập ngữ liệu song song |
| **Rò rỉ few-shot** | Tác giả phương pháp sử dụng các mục nhập đánh giá làm ví dụ few-shot | Kiểm tra dấu vân tay (Fingerprint-check): các mục nhập trong prompt sẽ bị phát hiện và gắn cờ |
| **Rò rỉ gián tiếp** | Văn bản nguồn tồn tại trong dữ liệu huấn luyện của LLM (đơn ngữ) | Có thể chấp nhận được — văn bản nguồn đơn ngữ dự kiến sẽ tồn tại. Sự *ghép cặp* mới là thứ bắt buộc phải mới lạ. |
| **Rò rỉ từ cộng đồng** | Những người xem xét trong cộng đồng chia sẻ công khai các mục nhập | Các điều khoản giấy phép nghiêm cấm việc phân phối lại tập ngữ liệu song song |

### 5.2 — Các Cấp độ Bảo mật Tập ngữ liệu

| Cấp độ | Khả năng hiển thị | Sử dụng |
|------|-----------|-----|
| **Bộ phát triển công khai (Public development set)** | Công khai hoàn toàn | Phát triển phương pháp, gỡ lỗi, kiểm thử hồi quy. Điểm số KHÔNG được công bố trên bảng xếp hạng. |
| **Bộ đánh giá giữ lại (Held-out evaluation set)** | Văn bản nguồn hiển thị, bản dịch tham chiếu được giữ bí mật | Đánh giá bảng xếp hạng chính thức. Các phương pháp nhận văn bản nguồn và trả về bản dịch; việc chấm điểm diễn ra ở phía máy chủ. Bản dịch tham chiếu không bao giờ được tiết lộ cho phương pháp. |
| **Bộ tiêu chuẩn vàng (Gold-standard set)** | Bí mật hoàn toàn, do cộng đồng kiểm soát | Đánh giá được cộng đồng xác thực. Được quản lý bởi tổ chức quản trị. Được sử dụng cho cấp độ xác minh "Được cộng đồng xác thực" (Community Validated). |

### 5.3 — Chính sách Luân phiên

Các tập ngữ liệu đánh giá nên được **luân phiên** định kỳ:

1. Sau khi một tập ngữ liệu đã được sử dụng trong 12 tháng, hãy bắt đầu xây dựng tập ngữ liệu thay thế
2. Chuyển tập ngữ liệu cũ sang trạng thái "bộ phát triển" (công khai)
3. Thúc đẩy tập ngữ liệu mới lên thành "bộ đánh giá giữ lại"
4. Điều này ngăn ngừa rò rỉ dữ liệu dần dần thông qua việc tối ưu hóa lặp đi lặp lại đối với một mục tiêu cố định

---

## 6. Quy trình Xây dựng Tập ngữ liệu

### 6.1 — Quy trình Từng bước

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Phạm vi Bao phủ Hiện tượng Ngôn ngữ học

Mỗi tập ngữ liệu nên bao gồm các mục nhập kiểm tra các hiện tượng ngôn ngữ học cụ thể có liên quan đến cặp ngôn ngữ. Những thông tin này được rút ra từ các trường `linguisticChallenges` và `contactInfluences` của thẻ ngôn ngữ:

**Các hiện tượng phổ quát (tất cả các cặp ngôn ngữ):**
- Giải quyết đại từ (các tiền ngữ mơ hồ)
- Phủ định (đơn, kép, phạm vi)
- Từ chỉ số lượng (tất cả, một số, không có, hầu hết)
- Biểu thức thời gian (ngày tương đối, khoảng thời gian)
- Thực thể được đặt tên (con người, địa điểm, tổ chức)
- Con số và phép đo lường
- Danh sách và sự liệt kê

**Các hiện tượng đặc thù theo cặp (từ thẻ ngôn ngữ):**
- Đối với các ngôn ngữ đích đa tổng hợp (polysynthetic): hình thái động từ phức tạp, sự hợp nhất (incorporation)
- Đối với các ngôn ngữ đích có phân biệt giống: sự hòa hợp giống, tham chiếu trung lập/bao hàm
- Đối với các ngôn ngữ đích SOV: động từ cuối mệnh đề, hậu giới từ (postpositions)
- Đối với các ngôn ngữ thanh điệu: phân biệt nghĩa phụ thuộc vào thanh điệu
- Đối với các ngôn ngữ có kính ngữ: dấu hiệu văn phong, bối cảnh xã hội
- Đối với các ngôn ngữ tiếp xúc (contact languages): ranh giới chuyển mã (code-switching), tích hợp từ mượn

### 6.3 — Kích thước Tập ngữ liệu Tối thiểu

Độ tin cậy thống kê đòi hỏi số lượng mục nhập tối thiểu. Những số liệu này dựa trên các yêu cầu về khoảng tin cậy bootstrap ghép cặp (từ `significance.py`):

| Mục đích | Số mục nhập Tối thiểu | Khuyến nghị |
|---------|-----------------|-------------|
| Bộ phát triển | 50 | 100–200 |
| Bộ đánh giá giữ lại | 100 | 200–500 |
| Bộ tiêu chuẩn vàng | 200 | 500+ |
| Tối thiểu cho mỗi lĩnh vực | 10 | 25+ |
| Tối thiểu cho mỗi cấp độ | 10 | 20+ |

**Tại sao tối thiểu phải là 100 cho việc đánh giá?** Với ít hơn ~100 mục nhập, các kiểm định ý nghĩa bootstrap ghép cặp (1.000 lần lấy mẫu lại) không thể phát hiện một cách đáng tin cậy các khác biệt nhỏ hơn ~5 điểm chrF++. Với hơn 200 mục nhập, chúng tôi có thể phát hiện các khác biệt khoảng ~2 điểm ở mức p<0.05.

---

## 7. Định dạng JSON của Tập ngữ liệu

Mỗi mục nhập tập ngữ liệu tuân theo đặc tả của hệ thống kiểm thử:

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Các Biện pháp Chống Gian lận (Anti-Gaming Measures)

### 8.1 — Tính Toàn vẹn của Tập ngữ liệu

| Biện pháp | Triển khai |
|---------|----------------|
| **Băm nội dung (Content hashing)** | Phiên bản tập ngữ liệu = SHA-256 của các ID mục nhập đã sắp xếp + các bản dịch tham chiếu. Bất kỳ sửa đổi nào cũng tạo ra một phiên bản mới. |
| **Tạo dấu vân tay mục nhập (Entry fingerprinting)** | Mỗi mục nhập có một ID được tạo ra từ nội dung. Nếu ai đó gửi kết quả đối chiếu với một tập ngữ liệu đã bị sửa đổi, dấu vân tay sẽ không khớp. |
| **Bắt buộc giữ lại (Held-out enforcement)** | Đối với đánh giá chính thức, các phương pháp CHỈ nhận được văn bản nguồn. Bản dịch tham chiếu không bao giờ được tiết lộ. Việc chấm điểm diễn ra ở phía máy chủ. |
| **Lịch trình luân phiên** | Các tập ngữ liệu được luân phiên hàng năm để ngăn chặn việc tối ưu hóa dài hạn đối với một mục tiêu cố định. |

### 8.2 — Tính Toàn vẹn của Lượt gửi (Submission Integrity)

| Biện pháp | Triển khai |
|---------|----------------|
| **Dấu vân tay xác định (Deterministic fingerprint)** | Cấu hình chạy (mô hình, nhiệt độ/temperature, prompt, phiên bản tập ngữ liệu) được băm. Các cấu hình giống hệt nhau sẽ tạo ra các dấu vân tay giống hệt nhau. |
| **Phát hiện chọn lọc kết quả tốt nhất (Cherry-pick detection)** | Người gửi phải công khai tất cả các lượt chạy, không chỉ lượt chạy tốt nhất. Nhiều lượt gửi có cùng một dấu vân tay sẽ bị gắn cờ. |
| **Kiểm tra rò rỉ dữ liệu (Contamination check)** | Nếu các mục nhập đánh giá xuất hiện nguyên văn trong prompt hoặc dữ liệu hướng dẫn (coaching data) của phương pháp, lượt gửi đó sẽ bị loại. |

---

## 9. Các Tập ngữ liệu Hiện có

### 9.1 — Bộ Phát triển EDTeKLA v1

| Thuộc tính | Giá trị |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Cặp ngôn ngữ** | EN → CRK (Plains Cree, SRO) |
| **Các mục** | Tập dev gồm 436 mục (`textbook_dev.json`). Chi tiết phân bổ đầy đủ được nêu một lần trên [trang Evaluation Datasets](/docs/network/leaderboard/datasets#edtekla-development-set-v1). |
| **Lĩnh vực** | Giáo dục (100%) |
| **Cấp độ** | 1–5 (phân bổ sẽ được xác định sau khi kiểm tra từng mục) |
| **Giấy phép** | CC BY-NC-SA sửa đổi của EdTeKLA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, phạm vi chủ quyền) — **được loại trừ khỏi bảng xếp hạng, giải thưởng và các hạng mục thương mại/API** (phi thương mại) |
| **Trạng thái** | Tập phát triển (công khai) |

**Hạn chế:** Chỉ có một lĩnh vực duy nhất (chỉ dành cho giáo dục). Không có sự phân tầng lĩnh vực. Việc phân bổ cấp độ có thể cần được kiểm tra lại. Kích thước tập ngữ liệu nhỏ làm hạn chế sức mạnh thống kê cho việc kiểm định ý nghĩa.

### 9.2 — Các Tập ngữ liệu Dự kiến

| Tập ngữ liệu | Cặp ngôn ngữ | Trạng thái | Chủ sở hữu |
|--------|------|--------|-------|
| Tập ngữ liệu tùy chỉnh EN → TL (Filipino) | EN → TL | Đã lên kế hoạch | Chủ sở hữu dự án |
| Bộ giữ lại EN → CRK | EN → CRK | Tương lai (cần đối tác cộng đồng) | Tổ chức quản trị cộng đồng |

---

## 10. Tích hợp Thẻ Ngôn ngữ (Language Card Integration)

Khung tập ngữ liệu tích hợp với hệ thống thẻ ngôn ngữ:

1. **Lựa chọn lĩnh vực** được định hướng bởi trường `linguisticChallenges` của thẻ — nếu một ngôn ngữ có các thách thức độc đáo (đa tổng hợp, thanh điệu, tính hữu sinh), tập ngữ liệu phải bao gồm các mục nhập để kiểm tra chúng.

2. **Hiệu chuẩn độ khó** sử dụng trường `classification` của thẻ — khoảng cách loại hình học giữa các họ ngôn ngữ nguồn và đích sẽ ảnh hưởng đến những gì cấu thành nên mức độ "khó".

3. **Phạm vi bao phủ văn phong** sử dụng trường `registers` của thẻ — nếu một ngôn ngữ có các văn phong được xác định (formal-filipino, taglish-professional, taglish-casual), tập ngữ liệu nên bao gồm các mục nhập ở từng cấp độ văn phong.

4. **Kiểm thử ảnh hưởng tiếp xúc** sử dụng trường `contactInfluences` của thẻ — đối với các ngôn ngữ có các lớp từ mượn nặng nề (tiếng Filipino: tiếng Tây Ban Nha + tiếng Anh + tiếng Ả Rập), hãy bao gồm các mục nhập để kiểm tra xem các phương pháp xử lý từ mượn có chính xác hay không so với việc dịch quá đà (over-translating).

5. **Xử lý hệ chữ viết** sử dụng trường `scripts[]` của thẻ — đối với các ngôn ngữ sử dụng nhiều hệ chữ viết (tiếng Serbia: chữ Cyrillic + chữ Latin), hãy bao gồm các mục nhập để kiểm tra việc lựa chọn hệ chữ viết chính xác.

---

## Tài liệu Tham khảo

- **Champollion Scoring Specification** — định nghĩa tất cả các chỉ số đo lường, trọng số tổng hợp, cấp độ chất lượng
- **Champollion Benchmark Specification** — giao thức đánh giá, định dạng tập ngữ liệu, chủ quyền dữ liệu
- **WALS** (World Atlas of Language Structures) — cơ sở dữ liệu đặc điểm loại hình học
- **Glottolog** — nguồn thông tin gốc về phân loại ngôn ngữ
- **ISO 639-3** — tiêu chuẩn nhận dạng ngôn ngữ
- **EdTeKLA** — nguồn của tập ngữ liệu đánh giá đầu tiên

---

*Tài liệu này là một đặc tả động (living specification). Hãy cập nhật nó khi các tập ngữ liệu mới được xây dựng và các bài học kinh nghiệm được rút ra.*
