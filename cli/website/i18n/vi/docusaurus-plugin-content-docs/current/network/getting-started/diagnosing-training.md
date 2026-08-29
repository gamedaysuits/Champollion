---
sidebar_position: 4
title: "Chẩn đoán lượt chạy huấn luyện"
description: "Khắc phục sự cố dựa trên triệu chứng cho việc huấn luyện MT tài nguyên thấp — bắt đầu từ những gì bạn đang thấy, tìm ra nguyên nhân khả dĩ và đòn bẩy điều chỉnh để khắc phục."
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Chẩn đoán một lượt Huấn luyện

Mô hình của bạn đã được huấn luyện. Các con số không như bạn kỳ vọng. Trang này bắt đầu từ **những gì bạn đang thấy** và dẫn dắt bạn đến nguyên nhân có khả năng xảy ra nhất cùng công cụ forge để khắc phục nó. Hầu hết các lỗi này đều được tự động hóa — `nmt-forge evaluate` sẽ thêm một phần **Chẩn đoán & Khuyến nghị** (Diagnosis & Recommendations) nêu tên phát hiện và đòn bẩy; hướng dẫn này là phiên bản ngôn ngữ dễ hiểu, cộng với một vài điều mà forge chỉ có thể *cảnh báo* (được đánh dấu ⚠ **lưu ý điều này**).

Hãy nói với agent của bạn: *"Chạy `nmt-forge lint <battery-manifest.json> --json` và xử lý phát hiện có mức độ nghiêm trọng cao nhất."* Sau đó, đối chiếu những gì nó báo cáo với các phần bên dưới.

---

## "Rất tốt trên các ví dụ sách giáo khoa, nhưng tệ trên các câu thực tế"

**Cạm bẫy phổ biến nhất đối với ngôn ngữ ít tài nguyên (low-resource).** Dữ liệu tổng hợp/mẫu của bạn đạt điểm số rất đẹp; nhưng văn bản thực tế thì hoàn toàn thất bại.

**Điều gì đang xảy ra:** một **ngưỡng bão hòa chuyển giao (transfer plateau)**. Trong quá trình huấn luyện, loss (độ mất mát) trên tập dev thực tế của bạn đã chạm đáy sớm và sau đó tăng dần lên trong khi loss huấn luyện tiếp tục giảm — mô hình đang học thuộc lòng *khối lượng* dữ liệu tổng hợp chứ không phải đang học cách dịch. Thêm nhiều dữ liệu tổng hợp sẽ **không** giúp ích gì.

**Phát hiện của forge:** `R7-transfer-plateau` (từ schedule story của run manifest). **Đòn bẩy: REAL-DATA.**

**Cách khắc phục:** thêm văn bản thực tế. Dịch ngược (backtranslate) dữ liệu đơn ngữ của ngôn ngữ đích (`nmt_forge.training.backtranslation`), hoặc thu thập các câu song ngữ thực tế. Khối lượng dữ liệu tổng hợp không phải là đòn bẩy — sự đa dạng của dữ liệu *thực tế* mới là đòn bẩy.

⚠ **lưu ý điều này:** nếu tỷ lệ pha trộn của bạn là ~99% dữ liệu tổng hợp so với một tập dev thực tế nhỏ, bạn có nguy cơ gặp phải tình trạng này *trước khi* nhìn thấy nó trong điểm số. Hiện chưa có công cụ kiểm tra trước (pre-flight lint) cho tỷ lệ bất thường này — hãy kiểm tra số lượng gold/synthetic trong mix manifest của bạn.

---

## "Một văn phong (register) tệ hơn nhiều so với các văn phong khác"

Hãy nhìn vào bảng thống kê theo từng văn phong (per-register). Một văn phong duy nhất (ví dụ: hành chính công hoặc pháp lý) thấp hơn hẳn so với phần còn lại.

**Hai nguyên nhân khác nhau — chẩn đoán phân biệt chúng bằng cách nhìn vào *độ bao phủ (coverage)* và liệu đầu ra có *chưa hoàn thành (unfinished)* hay không:**

- **Mô hình thiếu từ vựng** (`R1-vocabulary-gap`: độ bao phủ thấp **và** tỷ lệ chưa hoàn thành cao). **Đòn bẩy: VOCABULARY.** Mở rộng từ vựng (từ điển / thu thập minh chứng - attestation harvest), sau đó chạy hạch toán phễu (funnel accounting) `nmt-forge` để xác nhận các mục từ mới thực sự đi vào ngữ liệu — một lỗi không khớp chính tả dù chỉ một ký tự trước đây đã từng âm thầm xóa bỏ hàng nghìn từ.
- **Mô hình có từ vựng nhưng không có cấu trúc câu** (`R2-structure-gap`: độ bao phủ ổn, nhưng vẫn chưa hoàn thành). **Đòn bẩy: STRUCTURE.** Chạy bản đồ độ bao phủ đối chiếu với danh sách kiểm tra ngữ pháp của bạn và thêm các cấu trúc còn thiếu (câu mệnh lệnh, câu hỏi wh-, sở hữu, đảo ngữ — bất kỳ cấu trúc nào mà các mẫu của bạn chưa từng yêu cầu).

---

## "Đầu ra bị trộn lẫn các cách viết chính tả trong cùng một câu"

Mô hình viết cùng một âm theo hai cách khác nhau, đôi khi ngay trong cùng một câu.

**Điều gì đang xảy ra:** các mục tiêu huấn luyện của bạn đã dạy cho nó rằng các quy ước có thể thay thế cho nhau — ngữ liệu chứa cùng một nội dung nhưng ở nhiều hệ chính tả (orthographies) khác nhau.

**Phát hiện của forge:** `R3-mixed-convention`. **Đòn bẩy: ORTHOGRAPHY.**

**Cách khắc phục:** `convention-lint` ngữ liệu, chuẩn hóa về **một** quy ước chuẩn duy nhất tại ranh giới dữ liệu, và huấn luyện lại. Giữ một tỷ lệ quy ước hỗn hợp trong bộ thử nghiệm (battery) của bạn để bạn có thể theo dõi nó giảm xuống.

---

## "Mô hình B vượt trội hơn mô hình A — nhưng chỉ một chút"

Bạn đã so sánh hai mô hình và một mô hình dẫn trước một phần nhỏ của điểm số.

**Điều gì đang xảy ra:** sự khác biệt có thể nhỏ hơn cả độ nhiễu. Trên 80 câu, khoảng cách 0.4 chrF++ chỉ giống như một trò tung đồng xu.

**Phát hiện của forge:** `R5-low-power` (khoảng tin cậy rộng hơn khoảng chênh lệch delta). **Đòn bẩy: MEASUREMENT.**

**Cách khắc phục:** đừng hành động dựa trên các mức chênh lệch (delta) nhỏ hơn khoảng tin cậy (CI). Hãy mở rộng tập đánh giá (eval set) cho văn phong đó, hoặc sử dụng `nmt-forge compare` để báo cáo một kiểm định ý nghĩa *theo cặp (paired)* thay vì hai khoảng chồng lấp lên nhau. forge không bao giờ đưa ra một điểm số đơn thuần — khoảng tin cậy luôn ở đó chính là để bạn có thể thấy điều này.

⚠ **lưu ý điều này:** kết quả từ một **seed duy nhất** không mang dải phương sai giữa các seed (variance-across-seeds). Một mức cải thiện không duy trì được khi đổi seed (re-seeding) thì không phải là thực tế. Nếu đó là một quyết định quan trọng, hãy chạy lại với 2–3 seed.

---

## "Điểm số trông quá tốt"

Cao một cách đáng ngờ, đặc biệt là ở giai đoạn đầu hoặc với ít dữ liệu. Hãy tin vào sự nghi ngờ đó.

**Kiểm tra theo thứ tự:**

1. **Rò rỉ dữ liệu (Leakage).** `nmt-forge leak-audit <corpus>` — liệu một câu trả lời trong tập test có bị lọt vào tập huấn luyện không? Việc trùng khớp ở phía đích (target-side) là cực kỳ nghiêm trọng vì một lý do rõ ràng.
2. **Lựa chọn checkpoint.** Checkpoint có được chọn trên một **tập dev được rào chắn (fenced dev set)** chứ không phải tập test không? forge từ chối huấn luyện nếu không có tập dev chính là để ngăn chặn điều này, nhưng một pipeline tự viết (hand-rolled) thì không.
3. **Sự lạc quan từ các cặp gần trùng lặp (near-twins).** `R4-optimism-bound`: nếu điểm số của bộ thử nghiệm "đầy đủ" (full) cao hơn vài điểm so với điểm số "nghiêm ngặt" (strict - đã loại trừ các câu gần trùng lặp), thì khoảng cách đó là sự lạc quan giả tạo từ các câu tương đồng (drill-sibling optimism). **Hãy trích dẫn con số nghiêm ngặt (strict)** cho bất kỳ tuyên bố khái quát hóa nào.

---

## "Quá trình huấn luyện dừng lại gần như ngay lập tức"

Lượt chạy kết thúc chỉ sau vài trăm bước; mô hình hầu như chưa kịp tiếp cận dữ liệu.

**Điều gì đang xảy ra:** tính năng dừng sớm (early stopping) đã nhầm lẫn sự dao động của tập dev (vốn chứa nhiều dữ liệu tổng hợp) là sự hội tụ.

**Hành vi của forge:** điều này được *ngăn chặn* theo mặc định — `nmt-forge run` sẽ tính toán một **mức sàn (floor)** dừng từ tỷ lệ pha trộn của bạn và triệt tiêu các lần dừng sớm dưới mức đó, đồng thời ghi lại lý do trong các dòng `[schedule-sanity]`. Nếu bạn thấy một lần dừng ngoài ý muốn, hãy đọc các dòng đó; run manifest ghi lại chính xác những gì đã xảy ra và lý do tại sao.

---

## "Một chỉ số tôi muốn chỉ đơn giản là... biến mất khỏi báo cáo"

Báo cáo trung thực nhưng lại trống ở một trục đánh giá (COMET, kiểm tra tính hợp lệ của FST).

**Phát hiện của forge:** `R6-referee-unavailable` — luồng đánh giá được nêu tên là không khả dụng kèm theo lý do. **Đòn bẩy: REFEREE.**

**Cách khắc phục:** cài đặt/cấu hình referee được chỉ định và chấm điểm lại. Điểm số bạn đang có vẫn trung thực — chúng chỉ tạm thời bị ẩn ở trục đó cho đến khi referee xuất hiện.

---

## "Mô hình tạo ra `<unk>` hoặc các ký tự bị lỗi"

Đặc biệt là trên các hệ chữ viết âm tiết (syllabic) hoặc chữ Latin mở rộng.

⚠ **lưu ý điều này — chưa được tự động hóa.** **Bộ phân tách từ (tokenizer)** của mô hình nền tảng có thể không hỗ trợ hệ chữ viết đích của bạn. forge chưa kiểm tra độ bao phủ của tokenizer trước khi huấn luyện (đây là mục ưu tiên hàng đầu trong danh sách các tính năng còn thiếu của chúng tôi). Hãy kiểm tra tokenizer của mô hình nền tảng với các mẫu chữ viết đích của bạn; ưu tiên chọn mô hình nền tảng có từ vựng bao phủ hệ chữ viết đó (nhiều ngôn ngữ ít tài nguyên được hỗ trợ bởi các mô hình nền tảng thuộc họ NLLB) hoặc mở rộng tokenizer trước khi huấn luyện.

---

## Khi forge từ chối và bạn không hiểu tại sao

Một thông báo từ chối luôn nêu rõ điều gì (**what**) đã xảy ra, tại sao (**why**) nó làm hỏng kết quả, và cách khắc phục (**fix**). Nếu vẫn chưa rõ ràng:

- `nmt-forge status` — bạn đang ở đâu và lệnh tiếp theo duy nhất cần chạy.
- `nmt-forge preflight <command>` — mọi rào cản (gate) mà lệnh đó sẽ gặp phải, ✓/✗, kèm theo cách khắc phục cho mỗi ✗, để bạn giải quyết tất cả cùng một lúc thay vì từng cái một.

Một thông báo từ chối không phải là lỗi trong thiết lập của bạn — đó là việc công cụ phát hiện ra sai sót trước khi nó ảnh hưởng đến kết quả của bạn. Đó chính là toàn bộ triết lý thiết kế.
