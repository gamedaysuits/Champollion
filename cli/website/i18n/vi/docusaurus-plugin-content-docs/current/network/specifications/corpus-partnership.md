---
sidebar_position: 9
title: "Chiến lược hợp tác xây dựng kho ngữ liệu"
slug: '/network/specifications/corpus-partnership'
---

# Chiến lược Hợp tác Xây dựng Ngữ liệu: Thiết lập Ngữ liệu Đánh giá Thông qua các Khoa Ngôn ngữ học Học thuật

Việc xây dựng một ngữ liệu *huấn luyện* cho một ngôn ngữ ít tài nguyên đòi hỏi hàng trăm nghìn cặp câu — quá nhiều để có thể kiểm tra, do đó chất lượng sẽ biến động theo những cách không ai thấy được cho đến khi một mô hình được huấn luyện trên đó gặp thất bại. Một ngữ liệu *đánh giá* chỉ cần vài trăm cặp câu, mỗi cặp đều được kiểm duyệt bởi một người am hiểu ngôn ngữ đó, và nó không bao giờ lỗi thời: mỗi mô hình hoặc phương pháp mới xuất hiện đều được đo lường dựa trên nó. Tài liệu này là quy trình làm việc để xây dựng sản phẩm thứ hai, rẻ hơn đáng kể đó — sản phẩm bàn giao duy nhất mà chuyên môn của một khoa có thể chạm đến từng câu một — và cho những gì diễn ra sau đó: với một tiêu chuẩn đánh giá được thiết lập, một [giải thưởng được công bố](/docs/network/specifications/prizes) sẽ biến ngôn ngữ của bạn thành một mục tiêu mà bất kỳ người xây dựng phương pháp nào trên thế giới cũng có thể nhắm tới, và bảng xếp hạng công khai sẽ đo lường mọi nỗ lực.

> **Mục đích.** Toàn bộ quy trình làm việc để thiết lập một ngữ liệu đánh giá dịch máy thông qua quan hệ đối tác với khoa ngôn ngữ học: những gì khoa bàn giao, ngữ liệu phải trông như thế nào, cách nó được niêm phong bằng mật mã, cách thức hoạt động của đánh giá trong môi trường sandbox, và những gì khoa nhận lại được. Đây là tài liệu bạn mang đến cuộc họp với một đối tác học thuật tiềm năng.
>
> **Đối tượng độc giả.** Trưởng khoa, nghiên cứu viên chính, điều phối viên nghiên cứu và giám đốc chương trình ngôn ngữ bản địa tại các trường đại học có các chương trình NLP hoặc tư liệu hóa ngôn ngữ đang hoạt động.
>
> **Tài liệu đi kèm:**
> - [Khung thiết kế ngữ liệu](/docs/network/specifications/corpus-design) — phương pháp luận đằng sau các ngữ liệu đánh giá hợp lệ, đáng tin cậy
> - [Đặc tả giải thưởng](/docs/network/specifications/prizes) — một nửa của sự khích lệ: công bố một giải thưởng dựa trên tập dữ liệu đã niêm phong của bạn
> - [Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora) — cách một ngữ liệu tham gia vào Network mà không rời khỏi tay bạn
> - [Giao thức xác thực của người nói](/docs/network/specifications/speaker-validation) — yêu cầu đối với những người nói song ngữ để *gắn nhãn* các bản dịch hiện có (đánh giá chất lượng, xác thực linter, đánh giá FST)
> - [Đặc tả Benchmark](/docs/network/specifications/benchmark) — toàn bộ đặc tả kỹ thuật cho các ngữ liệu, run card và giao thức đánh giá
> - [Chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) — các nguyên tắc chủ quyền dữ liệu, CARE, và lý do tại sao việc chuyển giao quyền sở hữu lại quan trọng

---

## 1. Kết quả của Mối quan hệ Hợp tác này

Một **ngữ liệu đánh giá được niêm phong**: một tập hợp các cặp văn bản song song được tuyển chọn (ngôn ngữ nguồn → ngôn ngữ đích) trở thành chân lý mặt đất (ground truth) để đo lường chất lượng dịch máy. Các phương pháp được thử nghiệm dựa trên ngữ liệu này trong một môi trường thử nghiệm (sandbox) — các nhà phát triển không bao giờ nhìn thấy dữ liệu kiểm tra.

Mối quan hệ hợp tác tạo ra ba tạo tác:

| Tạo tác | Bản chất | Ai kiểm soát |
|----------|-----------|-----------------|
| **Ngữ liệu phát triển** | Hơn 100–200 cặp văn bản song song công khai để phát triển phương pháp | Xuất bản công khai (CC BY-NC-SA 4.0 hoặc tương đương) |
| **Tập kiểm tra tiêu chuẩn vàng** | 50–150 cặp văn bản song song bí mật để đánh giá chính thức | Tổ chức quản trị cộng đồng (được niêm phong mã hóa) |
| **Bộ kiểm tra chẩn đoán** | 10–50 cặp đối chiếu mục tiêu nhằm kiểm tra các hiện tượng ngôn ngữ cụ thể | Xuất bản công khai |

Tổng cộng là 160–400 cặp — một ngữ liệu mà một nhóm nghiên cứu thực sự có thể tuyển chọn đạt tiêu chuẩn chuyên môn, so với hàng trăm nghìn cặp mà một ngữ liệu huấn luyện sẽ đòi hỏi. Ngữ liệu phát triển cho phép bất kỳ ai cũng có thể xây dựng các phương pháp dịch thuật. Tập dữ liệu tiêu chuẩn vàng đảm bảo các phương pháp đó được kiểm tra một cách trung thực. Bộ chẩn đoán nắm bắt các kiểu lỗi cụ thể (ví dụ: "hệ thống này có thể xử lý hiện tượng obviation không?").

---

## 2. Những việc Khoa Cần Thực hiện

### Giai đoạn 1: Thiết kế Ngữ liệu (2–4 tuần, thời gian của nghiên cứu viên)

**Dẫn dắt:** PI hoặc nghiên cứu sinh sau tiến sĩ có chuyên môn về ngôn ngữ đích.

1. **Lựa chọn các lĩnh vực tài liệu nguồn.** Chọn 4–6 lĩnh vực thực tế mà cộng đồng ngôn ngữ thực sự cần dịch thuật. Phân loại của chúng tôi hỗ trợ 16 lĩnh vực (xem Thông số Điểm chuẩn §2.7):

   | Độ ưu tiên | Lĩnh vực | Lý do |
   |----------|--------|-----|
   | 🔴 Cao | `edu` — Giáo dục | Sách giáo khoa, chương trình giảng dạy — nhu cầu trực tiếp của cộng đồng |
   | 🔴 Cao | `gov` — Chính phủ | Tài liệu của hội đồng bộ tộc, chính sách — nhu cầu thực tế hàng ngày |
   | 🔴 Cao | `medical` — Y tế | Biểu mẫu tiếp nhận của phòng khám, thông tin sức khỏe — cực kỳ quan trọng cho sự an toàn |
   | 🟡 Trung bình | `conv` — Giao tiếp | Trò chuyện hàng ngày — thiết lập mức độ lưu loát cơ bản |
   | 🟡 Trung bình | `legal` — Pháp lý | Tài liệu về quyền lợi, hiệp ước — có ý nghĩa quan trọng với cộng đồng |
   | 🟢 Thấp hơn | `literary` — Văn học/Văn hóa | Câu chuyện, lịch sử truyền miệng — bảo tồn văn hóa |

2. **Soạn thảo tài liệu thiết kế ngữ liệu** chỉ rõ:
   - Quy mô mục tiêu cho mỗi phân đoạn (phát triển, tiêu chuẩn vàng, chẩn đoán)
   - Phân bổ các mức độ khó (xem §3.3 bên dưới)
   - Phạm vi văn phong và lĩnh vực
   - Tiêu chí lựa chọn câu nguồn (không dùng văn bản nhân tạo, không chỉ dùng Kinh Thánh)
   - Kế hoạch tuyển dụng người bản xứ

3. **Gửi thiết kế cho chúng tôi để xem xét.** Chúng tôi sẽ xác thực thiết kế dựa trên schema ngữ liệu (Thông số Điểm chuẩn §2) và gửi lại phản hồi trong vòng 1 tuần.

### Giai đoạn 2: Tạo Câu Nguồn (4–8 tuần, thời gian của người bản xứ)

**Dẫn dắt:** Điều phối viên nghiên cứu làm việc với những người nói song ngữ.

1. **Tạo hoặc lựa chọn các câu nguồn** trên các lĩnh vực và mức độ khó đã lên kế hoạch. Nguồn có thể là:
   - Tài liệu song ngữ đã xuất bản hiện có (sách giáo khoa, tài liệu chính phủ)
   - Các câu mới được gợi mở nhằm bao quát các hiện tượng ngôn ngữ cụ thể
   - Được điều chỉnh từ các tài liệu thực tế (chương trình họp của hội đồng bộ tộc, biểu mẫu phòng khám, tài liệu giáo dục)

2. **Mỗi câu nguồn phải có:**
   - Thẻ lĩnh vực (từ phân loại 16 mã)
   - Thẻ văn phong (giao tiếp, trang trọng, kỹ thuật, nghi lễ, giáo dục)
   - Thẻ ngữ cảnh (chào hỏi, tuyên bố, câu hỏi, hướng dẫn, tường thuật, nhãn, lỗi)
   - Mức độ khó ước tính (1–5, xem §3.3)
   - Thẻ nguồn gốc (sách giáo khoa, gợi mở, ngữ liệu, tiêu chuẩn vàng)

3. **Dịch từng câu nguồn** sang ngôn ngữ đích, được thực hiện bởi những người nói song ngữ. Việc có nhiều bản dịch tham chiếu cho mỗi mục là rất giá trị nhưng không bắt buộc.

4. **Tùy chọn, thêm phân tích hình thái** cho mỗi bản dịch tham chiếu:
   - Chú giải xen kẽ (phân tích từng hình vị)
   - Chuỗi thẻ FST (nếu có FST cho ngôn ngữ đó)
   - Ghi chú của người dịch về các biến thể phương ngôn, sự mơ hồ, hoặc ngữ cảnh văn hóa

### Giai đoạn 3: Đảm bảo Chất lượng (2–4 tuần)

**Dẫn dắt:** Nhà ngôn ngữ học có chuyên môn về ngôn ngữ đích.

1. **Đánh giá chéo.** Mỗi bản dịch nên được xem xét bởi ít nhất một người nói song ngữ khác, người không tham gia dịch bản dịch gốc đó. Người đánh giá sẽ kiểm tra:
   - Bản dịch có chính xác không?
   - Nghe có tự nhiên không?
   - Đánh giá độ khó có chính xác không?
   - Có biến thể nào được chấp nhận cần được lưu ý không?

2. **Chạy qua công cụ xác thực schema của chúng tôi.** Chúng tôi cung cấp một tập lệnh để xác thực ngữ liệu dựa trên schema đầu vào (Thông số Điểm chuẩn §2.2). Tập lệnh kiểm tra:
   - Các trường bắt buộc phải có mặt
   - Mã lĩnh vực hợp lệ
   - Mức độ khó là số nguyên từ 1–5
   - Không có ID trùng lặp
   - Mã hóa ký tự (chuẩn hóa UTF-8 NFC)

3. **Nếu có FST cho ngôn ngữ đó,** hãy chạy các bản dịch tham chiếu qua FST. Mọi từ trong bản dịch tham chiếu phải hợp lệ với FST. Những từ không hợp lệ (từ mượn, từ mới, danh từ riêng) phải được ghi nhận trong một danh sách cho phép (allowlist).

### Giai đoạn 4: Phân đoạn và Niêm phong (1 tuần, kỹ thuật của chúng tôi)

**Dẫn dắt:** Đội ngũ Champollion, với sự xem xét của khoa.

1. **Phân tách phân tầng.** Chúng tôi chia ngữ liệu thành các phân đoạn bằng cách sử dụng lấy mẫu ngẫu nhiên xác định (seed được ghi nhận, có thể tái lập):

   | Phân đoạn | Quy mô Mục tiêu | Quyền truy cập |
   |---------|------------|--------|
   | `development` | 60% số mục (tối thiểu 100) | Công khai |
   | `gold_standard` | 30% số mục (tối thiểu 50) | Bí mật, được niêm phong |
   | `held_out` | 10% số mục (tối thiểu 10) | Bí mật, được niêm phong, không bao giờ sử dụng cho đến khi được kích hoạt |

   Việc phân tách này bảo toàn sự phân bổ mức độ khó (lấy mẫu phân tầng) để mỗi phân đoạn có tỷ lệ đại diện tương đương trên các mức độ khó.

2. **Niêm phong mã hóa** các phân đoạn gold_standard và held_out:

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **Phân đoạn phát triển** được đưa vào kho lưu trữ công khai và xuất bản với đầy đủ giấy phép.

4. **Phân đoạn chẩn đoán** cũng được công khai — nó kiểm tra các hiện tượng ngôn ngữ cụ thể (xem §3.4).

### Giai đoạn 5: Tích hợp và Ra mắt (1–2 tuần, kỹ thuật của chúng tôi)

1. **Cấu hình khung thử nghiệm.** Chúng tôi thêm ngôn ngữ vào khung đánh giá:
   - Thẻ ngôn ngữ được tạo hoặc xác minh
   - Ngữ liệu được đăng ký trong danh mục tập dữ liệu
   - Các chỉ số LYSS được cấu hình (LYSS-fst nếu có FST, LYSS-eq nếu có quy tắc linter)
   - Hồ sơ tính điểm mặc định được chọn (Hồ sơ A nếu có FST, Hồ sơ B nếu ngược lại)

2. **Điểm chuẩn cơ sở.** Chúng tôi chạy một lượt quét 12 mô hình đối với phân đoạn phát triển để cập nhật điểm số ban đầu lên bảng xếp hạng.

3. **Thông báo công khai.** Ngôn ngữ xuất hiện trên bảng xếp hạng của Mạng lưới với điểm chuẩn phân đoạn phát triển trực tiếp. Khoa được ghi nhận là đối tác ngữ liệu.

---

## 3. Cấu trúc Yêu cầu của Ngữ liệu

### 3.1 Định dạng

Mỗi tệp ngữ liệu là một tài liệu JSON tuân theo schema trong Thông số Điểm chuẩn §2.1–§2.2:

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Yêu cầu Quy mô Tối thiểu

| Phân đoạn | Số mục Tối thiểu | Khuyến nghị |
|---------|----------------|-------------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Tổng cộng** | **170** | **350–530** |

### 3.3 Phân bổ Độ khó

Ngữ liệu phải bao gồm các mục thuộc cả năm mức độ khó, tập trung nhiều vào các mức 2–4:

| Mức độ | Mô tả | Phân bổ Mục tiêu |
|------|-------------|-------------------|
| 1 — Từ vựng cơ bản | Từ đơn lẻ, lời chào thông thường, chữ số | 10–15% |
| 2 — Câu đơn giản | SVO, thì hiện tại | 25–30% |
| 3 — Độ phức tạp trung bình | Thì quá khứ/tương lai, từ sở hữu, tính sinh động (animacy) | 30–35% |
| 4 — Hình thái phức tạp | Hiện tượng obviation, thể bị động, conjunct order, mệnh đề quan hệ | 15–20% |
| 5 — Nâng cao | Nhiều mệnh đề, văn phong trang trọng, nghi lễ, thành ngữ | 5–10% |

### 3.4 Bộ Kiểm tra Chẩn đoán

Phân đoạn chẩn đoán kiểm tra các hiện tượng ngôn ngữ cụ thể bằng cách sử dụng **các cặp đối chiếu**: một bản dịch đúng và một bản dịch sai có sự khác biệt tối thiểu. Nếu chỉ số của hệ thống chấm điểm bản dịch đúng cao hơn, bài kiểm tra sẽ đạt.

Đối với các ngôn ngữ đa tổng hợp (polysynthetic), bộ chẩn đoán nên nhắm vào:

| Hiện tượng | Ví dụ (tiếng Cree) | Nội dung Kiểm tra |
|-----------|----------------|--------------|
| **Sự hòa hợp tính sinh động** | atim (AN) so với maskisin (IN) — các dạng động từ khác nhau | Hệ thống có biết danh từ nào là sinh động (animate) không? |
| **Hiện tượng obviation** | Ngôi thứ ba gần (proximate) so với ngôi thứ ba xa (obviative) | Hệ thống có theo dõi hệ thống phân cấp ngôi thứ ba không? |
| **Đánh dấu nghịch đảo** | Dạng động từ trực tiếp so với nghịch đảo | Hệ thống có xử lý được trường hợp đối tượng tác động (patient) xếp trên tác nhân (agent) không? |
| **Conjunct/Independent** | Trật tự động từ trong mệnh đề chính so với mệnh đề phụ | Hệ thống có sử dụng đúng hệ biến hóa động từ không? |
| **Bao gồm/Loại trừ** | "Chúng ta (bao gồm bạn)" so với "Chúng tôi (không bao gồm bạn)" | Hệ thống có phân biệt được các dạng đại từ nhân xưng số nhiều ngôi thứ nhất không? |

Đối với các ngữ hệ khác, hãy xác định 3–5 hiện tượng mang tính chẩn đoán cao nhất để phân biệt giữa bản dịch đạt yêu cầu và không đạt yêu cầu. Chuyên môn ngôn ngữ học của khoa là thiết yếu ở đây — đây là những bài kiểm tra mà chỉ chuyên gia mới biết cách viết.

### 3.5 Những gì Chúng tôi KHÔNG Muốn

| Phản mẫu (Anti-Pattern) | Lý do |
|-------------|-----|
| **Chỉ dùng văn bản Kinh Thánh** | Văn phong cổ, từ vựng phụng vụ, cấu trúc rập khuôn. OMT-1600 đã đánh giá 1.560 ngôn ngữ theo cách này — chúng tôi chủ động tránh nó. |
| **Cặp đánh giá nhân tạo** | Các bản dịch tham chiếu do LLM tạo ra sẽ làm mất đi mục đích của việc đánh giá. Bản dịch tham chiếu phải do con người viết. |
| **Ngữ liệu đơn văn phong** | Toàn bộ là trang trọng, hoặc toàn bộ là giao tiếp. Dịch thuật thực tế bao gồm nhiều văn phong khác nhau. |
| **Chỉ có độ khó mức 1** | Các từ đơn lẻ và lời chào không kiểm tra khả năng dịch thuật — chúng chỉ kiểm tra việc tra cứu từ vựng. |
| **Bản dịch tham chiếu bằng dịch máy** | Sử dụng kết quả của Google Translate làm "bản dịch tham chiếu" là một vòng lặp luẩn quẩn. |
| **Các câu không có thẻ ngữ cảnh** | Chúng tôi cần biết chức năng giao tiếp để phân tích chẩn đoán. |

---

## 4. Niêm phong Mã hóa và Thử nghiệm trong Môi trường Sandbox {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 Tại sao phải Niêm phong Tập Kiểm tra?

Các điểm chuẩn ML thông thường công bố công khai các tập kiểm tra. Sau khi được công bố, các LLM tiên tiến cuối cùng sẽ huấn luyện trên chúng (vô tình hoặc thông qua việc thu thập dữ liệu web), khiến điểm số không còn đáng tin cậy. Đối với dữ liệu ngôn ngữ bản địa, còn có một mối lo ngại khác: dữ liệu ngôn ngữ được công bố có thể bị sử dụng mà không có sự đồng ý của cộng đồng.

Việc niêm phong đảm bảo:
- **Tính toàn vẹn của tập kiểm tra:** Các phương pháp không thể khớp quá mức (overfit) với dữ liệu mà chúng chưa từng thấy
- **Chủ quyền dữ liệu:** Cộng đồng kiểm soát ai được đánh giá dựa trên dữ liệu của họ
- **Độ mới vĩnh cửu:** Tập kiểm tra không bao giờ bị ô nhiễm

### 4.2 Cách thức Hoạt động của Thử nghiệm Sandbox

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Quản lý Khóa

Khóa mã hóa cho tập kiểm tra được niêm phong được chia nhỏ bằng cách sử dụng Cơ chế chia sẻ bí mật Shamir với ngưỡng 2-trên-3:

| Bên giữ khóa | Vai trò | Quyền thu hồi |
|-------------|------|-----------------|
| **Tổ chức quản trị cộng đồng** | Người giám hộ chính | Có thể đơn phương thu hồi quyền truy cập đánh giá |
| **Khoa học thuật đối tác** | Đồng giám hộ | Có thể tham gia vào việc khôi phục khóa |
| **Dự án Champollion** | Bên thứ ba giữ hộ (Escrow) | Không thể tự truy cập dữ liệu; đảm bảo tính liên tục nếu các bên khác không còn khả năng hoạt động |

Bất kỳ 2 trong số 3 phần khóa nào cũng có thể khôi phục lại khóa gốc. Điều này có nghĩa là:
- Cộng đồng + khoa có thể truy cập dữ liệu mà không cần Champollion
- Cộng đồng + Champollion có thể truy cập dữ liệu mà không cần khoa
- Champollion đơn độc KHÔNG BAO GIỜ có thể truy cập dữ liệu

### 4.4 Bản kê Khai băm (Hash Manifests)

Khi ngữ liệu được niêm phong, một **bản kê khai băm** sẽ được xuất bản lên một commit Git công khai:

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

Điều này chứng minh:
- Ngữ liệu đã tồn tại vào một ngày cụ thể
- Nó có quy mô và cấu trúc đã biết
- Bất kỳ sửa đổi nào đối với các phân đoạn được niêm phong sẽ làm hỏng chuỗi băm
- Cộng đồng có thể xác minh dữ liệu của họ không bị can thiệp

---

## 5. Những gì Khoa Nhận được

### 5.1 Cơ sở Hạ tầng Nghiên cứu

| Tài sản | Mô tả |
|-------|------------|
| **Khung đánh giá** | Một khung đánh giá hoạt động tốt, đã được thử nghiệm cho ngôn ngữ của họ — tiết kiệm hàng tháng trời xây dựng công cụ |
| **Các chỉ số LYSS** | Các chỉ số đánh giá đặc thù cho ngôn ngữ (LYSS-fst, LYSS-eq, LYSS-sem) được cấu hình cho ngôn ngữ của họ — nếu có tài nguyên FST và từ điển |
| **Bảng xếp hạng** | Một bảng xếp hạng công khai, trực tiếp hiển thị trạng thái công nghệ tiên tiến nhất cho cặp ngôn ngữ của họ |
| **Điểm chuẩn cơ sở** | Lượt quét 12 mô hình cung cấp các điểm chuẩn cơ sở tức thì, có thể công bố |
| **Bộ kiểm tra chẩn đoán** | Các bài kiểm tra mục tiêu cho các hiện tượng ngôn ngữ cụ thể — có thể tái sử dụng cho các đánh giá khác |

### 5.2 Công bố Khoa học

Việc xây dựng ngữ liệu và kết quả đánh giá hỗ trợ nhiều công bố khoa học:

| Bài báo | Nơi công bố | Vai trò của Khoa |
|-------|-------|-----------------|
| Phương pháp xây dựng ngữ liệu | LREC, ComputEL | Tác giả chính hoặc đồng tác giả |
| Kết quả đánh giá cơ sở | ACL, EMNLP | Đồng tác giả |
| Xác thực chỉ số LYSS | WMT Metrics Shared Task | Đồng tác giả |
| Thiết kế bộ kiểm tra chẩn đoán | SIGMORPHON, NAACL | Tác giả chính hoặc đồng tác giả |
| Tài nguyên NLP đặc thù ngôn ngữ | Các hội thảo/tạp chí chuyên biệt về ngôn ngữ | Tác giả chính |

### 5.3 Lợi thế khi Xin Tài trợ

Mối quan hệ hợp tác cung cấp các kết quả đầu ra cụ thể cho các đề xuất xin tài trợ:

- "Cơ sở hạ tầng đánh giá mã nguồn mở cho dịch máy [ngôn ngữ]" — sản phẩm bàn giao có thể chứng minh được
- "Chủ quyền dữ liệu mã hóa cho dữ liệu ngôn ngữ bản địa" — áp dụng các khung chủ quyền đã được thiết lập (CARE, Kaitiakitanga, TK Labels) vào đánh giá dịch máy; có thể công bố
- "Điểm chuẩn do cộng đồng quản lý với bảng xếp hạng trực tiếp" — chỉ số tác động liên tục
- "Đánh giá độc lập về OMT-1600 / Google Translate cho [ngôn ngữ]" — kịp thời, có mức độ hiển thị cao

### 5.4 Tác động Cộng đồng

- Cộng đồng ngôn ngữ có được **khả năng đánh giá độc lập** — họ có thể đánh giá xem bất kỳ hệ thống dịch máy nào (Google, Meta, hoặc tùy chỉnh) có thực sự hoạt động hiệu quả cho ngôn ngữ của họ hay không
- Cộng đồng **kiểm soát dữ liệu kiểm tra** thông qua việc giám hộ khóa mã hóa
- Bất kỳ phương thức nào được chứng minh qua điểm chuẩn sẽ **chuyển giao quyền sở hữu** cho cộng đồng (xem Thông số Điểm chuẩn §8.3), giúp cộng đồng giữ lại mọi giá trị mà một đợt triển khai mang lại — Champollion là dự án phi thương mại và không lấy bất kỳ phần chia nào

### 5.5 Chi phí đối với Khoa

| Thành phần | Chi phí Ước tính | Ai chi trả |
|-----------|---------------|----------|
| Thời gian của PI/nghiên cứu sinh sau TS (thiết kế, giám sát) | ~40 giờ | Khoa (hoặc từ nguồn tài trợ) |
| Thù lao cho người bản xứ (dịch thuật) | $2,500–6,000 | Từ nguồn tài trợ hoặc Champollion tài trợ |
| Thù lao cho người bản xứ (đánh giá) | $500–1,500 | Từ nguồn tài trợ hoặc Champollion tài trợ |
| Thời gian của điều phối viên nghiên cứu | ~20 giờ | Khoa |
| **Kỹ thuật, cơ sở hạ tầng, khung thử nghiệm** | **$0** | **Dự án Champollion** |

Chúng tôi cung cấp toàn bộ phần kỹ thuật, cấu hình khung thử nghiệm, thiết lập chỉ số LYSS, tích hợp bảng xếp hạng và cơ sở hạ tầng liên tục mà không tính phí đối với khoa. Đóng góp của khoa là chuyên môn ngôn ngữ học và khả năng tiếp cận người bản xứ.

---

## 6. Lộ trình Thực hiện

| Giai đoạn | Thời gian | Cột mốc Quan trọng |
|-------|----------|--------------|
| 1: Thiết kế Ngữ liệu | 2–4 tuần | Tài liệu thiết kế được phê duyệt |
| 2: Câu Nguồn + Dịch thuật | 4–8 tuần | Hoàn thành ngữ liệu thô |
| 3: Đảm bảo Chất lượng | 2–4 tuần | Được đánh giá chéo, xác thực schema |
| 4: Niêm phong | 1 tuần | Niêm phong tiêu chuẩn vàng, công bố bản kê khai băm |
| 5: Tích hợp | 1–2 tuần | Ngôn ngữ hoạt động trực tiếp trên bảng xếp hạng với các điểm cơ sở |
| **Tổng cộng** | **10–19 tuần** | **Bảng xếp hạng trực tiếp với đánh giá được niêm phong** |

---

## 7. Cách thức bắt đầu {#7-how-to-get-started}

1. **Liên hệ với chúng tôi** — [email/thông tin liên hệ dự án]. Chúng tôi sẽ lên lịch một cuộc gọi 30 phút để thảo luận về ngôn ngữ của bạn, các tài nguyên sẵn có và hậu cần hợp tác.

2. **Chúng tôi cung cấp:**
   - Tài liệu này
   - Schema ngữ liệu và các công cụ xác thực
   - Các ví dụ từ ngữ liệu tiếng Cree (CRK) hiện tại của chúng tôi
   - Bản mẫu thiết kế ngữ liệu nháp

3. **Bạn cung cấp:**
   - Một nghiên cứu viên chính (PI) hoặc nghiên cứu sinh sau tiến sĩ (postdoc) để dẫn dắt công việc ngôn ngữ học
   - Quyền tiếp cận những người nói song ngữ (hoặc kế hoạch tuyển dụng họ)
   - Thông tin về các tài nguyên có sẵn (FST, từ điển, các ngữ liệu hiện có)
   - Sự phê duyệt của tổ chức về quản trị dữ liệu (nhất quán với các nguyên tắc chủ quyền dữ liệu của First Nations, hoặc khuôn khổ riêng của cộng đồng)

4. **Chúng ta cùng thiết kế ngữ liệu** — lựa chọn lĩnh vực, phân bổ độ khó, các bài kiểm tra chẩn đoán, lộ trình và ngân sách.

5. **Công việc bắt đầu.** Chúng tôi sẽ họp cập nhật hàng tuần. Khoa có toàn quyền tự quyết đối với các quyết định ngôn ngữ học; chúng tôi đảm nhận toàn bộ phần kỹ thuật.

---

## 8. Câu hỏi Thường gặp

### "Chúng tôi đã có sẵn một ngữ liệu song song. Chúng tôi có thể sử dụng nó không?"

Có — nếu ngữ liệu có nguồn gốc rõ ràng, do con người viết, và giấy phép cho phép sử dụng trong việc đánh giá. Chúng tôi sẽ giúp bạn định dạng nó theo schema của chúng tôi, thêm siêu dữ liệu còn thiếu và tích hợp nó. Các ngữ liệu hiện có có thể đẩy nhanh đáng kể lộ trình (bỏ qua Giai đoạn 2 hoặc giảm nó xuống thành một bài tập điền vào chỗ trống).

### "Chúng tôi không có FST cho ngôn ngữ của mình."

Không sao cả. LYSS-fst (tính hợp lệ về hình thái) yêu cầu một FST, nhưng khung thử nghiệm vẫn hoạt động tốt mà không cần nó bằng cách sử dụng trọng số của Hồ sơ B (chrF++, BLEU, COMET, các chỉ số hành vi). Nếu có một FST GiellaLT cho một ngôn ngữ liên quan, chúng tôi có thể điều chỉnh nó. Nếu không, ngữ liệu vẫn cho phép đánh giá có giá trị — chỉ là không có bước lọc tính hợp lệ về hình thái.

### "Người bản xứ của chúng tôi sử dụng chữ viết không phải Latin."

Được hỗ trợ đầy đủ. Schema ngữ liệu xử lý bất kỳ chữ viết Unicode nào. Chúng tôi đã thiết kế cho SRO (Chữ viết La-tinh chuẩn) và chữ tượng thanh (syllabics) cho tiếng Cree, nhưng cơ sở hạ tầng tương tự cũng hoạt động tốt cho chữ Devanagari, chữ Ả Rập, CJK, chữ Ethiopia, hoặc bất kỳ hệ thống chữ viết nào khác.

### "Còn về sự khác biệt phương ngôn thì sao?"

Hãy gắn thẻ cho nó. Schema đầu vào ngữ liệu bao gồm một trường `notes` cho thông tin phương ngôn. Nếu có nhiều phương ngôn được đại diện, hãy ghi nhận chúng. Các lớp tương đương của linter (LYSS-eq) có thể được cấu hình để chấp nhận các biến thể phương ngôn là tương đương. Bộ kiểm tra chẩn đoán có thể bao gồm các đối chiếu đặc thù cho từng phương ngôn.

### "Ai sở hữu ngữ liệu?"

Cộng đồng ngôn ngữ, thông qua tổ chức quản trị. Khoa được ghi nhận là đối tác nghiên cứu. Champollion giữ một phần khóa ký gửi để đảm bảo tính liên tục của hoạt động nhưng không thể tự mình truy cập dữ liệu được niêm phong. Phân đoạn phát triển được xuất bản theo giấy phép Creative Commons do cộng đồng chỉ định.

### "Nếu chúng tôi muốn dừng lại thì sao?"

Cộng đồng có thể thu hồi quyền truy cập đánh giá bất kỳ lúc nào bằng cách từ chối khôi phục khóa mã hóa. Dữ liệu được niêm phong không bao giờ bị lộ. Phân đoạn phát triển, vốn đã được xuất bản, vẫn được công khai theo giấy phép của nó. Các kết quả nghiên cứu của khoa (công bố, bài trình bày) vẫn thuộc quyền sở hữu của khoa để giữ lại trong mọi trường hợp.

### "Nếu tổ chức quản trị cộng đồng chưa tồn tại thì sao?"

Chúng ta có thể bắt đầu với các Giai đoạn 1–3 (thiết kế ngữ liệu, tạo lập, QA) mà chưa cần một tổ chức quản trị. Việc niêm phong (Giai đoạn 4) yêu cầu xác định một người giám hộ khóa. Trong thời gian chờ đợi, khoa có thể đóng vai trò là đồng giám hộ cùng với dự án Champollion, với sự thống nhất rằng quyền giám hộ sẽ được chuyển giao cho tổ chức quản trị cộng đồng khi tổ chức này được thành lập.

---

## Phụ lục: Gắn thẻ so với Xây dựng Ngữ liệu

Tài liệu này đề cập đến **xây dựng ngữ liệu** — tạo ra các cặp văn bản song song tạo nên chân lý mặt đất cho việc đánh giá. Gắn thẻ (chú thích hình thái, chú giải xen kẽ, chuỗi thẻ FST) là một hoạt động riêng biệt giúp làm phong phú ngữ liệu nhưng không bắt buộc đối với việc đánh giá cơ bản.

| Hoạt động | Bắt buộc? | Những gì nó mang lại |
|----------|-----------|-----------------|
| **Xây dựng ngữ liệu** (tài liệu này) | ✅ Bắt buộc | Đánh giá cơ bản: chrF++, khớp chính xác, COMET, các chỉ số hành vi |
| **Kiểm tra độ bao phủ FST** | 🟡 Tùy chọn | Chỉ số tính hợp lệ hình thái LYSS-fst **và** chỉ số `morphological_accuracy` dựa trên FST (khớp từ căn — không cần chú thích; Thông số Tính điểm §2.2) |
| **Chú thích hình thái** | 🟡 Tùy chọn | Sẽ cho phép nâng cấp lên phiên bản *được xác thực vàng* của `morphological_accuracy` trong tương lai; phiên bản dựa trên FST (ở trên) không cần điều này |
| **Quy tắc tương đương linter** | 🟡 Tùy chọn | Chỉ số khớp tương đương LYSS-eq |
| **Quy tắc xác thực ngữ nghĩa** | 🟡 Tùy chọn | Chỉ số xác thực ngữ nghĩa LYSS-sem |
| **Đánh giá chất lượng của người bản xứ** | Hoạt động riêng biệt | Xác thực chỉ số (xem [Giao thức Xác thực Người bản xứ](/docs/network/specifications/speaker-validation)) |

Việc gắn thẻ và xác thực của người bản xứ được đề cập trong các tài liệu riêng biệt và có thể tiến hành song song hoặc sau khi xây dựng ngữ liệu.

