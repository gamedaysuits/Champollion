---
sidebar_position: 4
title: "Chẩn đoán lượt chạy huấn luyện"
description: "Khắc phục sự cố dựa trên triệu chứng cho việc huấn luyện MT tài nguyên thấp — bắt đầu từ những gì bạn đang thấy, tìm ra nguyên nhân khả dĩ và đòn bẩy điều chỉnh để khắc phục."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
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

Mô hình của bạn đã được huấn luyện. Các con số không đạt như bạn kỳ vọng. Trang này bắt đầu từ
**những gì bạn đang thấy** và hướng dẫn bạn tìm ra nguyên nhân có thể xảy ra cùng công cụ forge giúp
khắc phục. Hầu hết các việc này đều được tự động hóa — `nmt-forge export` (và phần chỉ tính điểm của nó,
`nmt-forge evaluate`) sẽ bổ sung mục **Diagnosis & Recommendations** (Chẩn đoán & Khuyến nghị)
nêu rõ phát hiện và giải pháp can thiệp; hướng dẫn này là phiên bản giải thích bằng ngôn ngữ thông thường,
cộng với một số điều mà forge chỉ có thể *cảnh báo* (được đánh dấu ⚠ **chú ý điều này**).

Hãy nói với agent của bạn: *"Chạy `nmt-forge lint <battery-manifest.json> --json` và xử lý
phát hiện có mức độ nghiêm trọng cao nhất."* Sau khi export, battery manifest là
`export/evaluation/battery-hyps-battery.json`. Sau đó đối chiếu những gì nó báo cáo với
các phần bên dưới.

---

## "Điểm của mô hình mặc định quá thấp"

Bạn đã huấn luyện với preset `cpu-tiny` mặc định và điểm kiểm thử rơi vào khoảng
từ 5 đến 30 chrF++.

**Điều gì đang xảy ra:** đó chính là bản chất của preset này. Đây là một transformer
nhỏ được huấn luyện từ đầu chỉ trên các cặp dữ liệu của bạn, vì vậy với 1–2 nghìn cặp, nó chỉ học
các cụm từ và mẫu câu trong dữ liệu của bạn, chứ không phải ngôn ngữ nói chung — mức
cao nhất của khoảng điểm đó chỉ xuất hiện khi dữ liệu có tính khuôn mẫu cao. Nhiệm vụ của nó là
hiện thực hóa toàn bộ quy trình (fenced dev, audited data, preregistered test, một mô hình
mà CLI có thể gọi), chứ không phải để trở thành mô hình đưa vào sử dụng thực tế.

**Cách khắc phục:** thay đổi từng yếu tố một và đo lường trên dev set, theo thứ tự hiệu quả
từ cao xuống thấp:

1. **Thêm các cặp dữ liệu thực tế.** Ở quy mô này, dữ liệu quan trọng hơn bất kỳ thiết lập nào.
2. **Bắt đầu từ mô hình tiền huấn luyện.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` tinh chỉnh một mô hình Marian/opus-mt tiền huấn luyện nhỏ trên CPU — hãy chọn
   một mô hình cho cặp ngôn ngữ *có liên quan*, và so sánh nó với `cpu-tiny` trên dev set
   thay vì mặc định rằng nó sẽ tốt hơn. `--model nllb-600m` là điểm khởi đầu mạnh nhất
   và cần có GPU.
3. **Tạo thêm dữ liệu từ những gì bạn có** — dịch ngược (backtranslation) văn bản đơn ngữ, hoặc
   tổng hợp có kiểm chứng nếu ngôn ngữ của bạn có công cụ phân tích (xem
   [So You Want to Train Your Own Model](/docs/network/tutorials/train-your-own-model)).

⚠ **chú ý điều này:** điểm số cao từ `cpu-tiny` nên được nghi ngờ trước khi
ăn mừng — xem ["Điểm số có vẻ quá tốt"](#the-score-looks-too-good).

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

1. **Rò rỉ dữ liệu (Leakage).** `nmt-forge leak-audit <corpus>` — liệu câu kiểm thử có vô tình nằm trong
   tập huấn luyện không? Nó sẽ loại bỏ các hàng có prompt giống hệt prompt kiểm thử (kể cả khi
   bản dịch khác nhau), các hàng có câu trả lời giống hệt câu trả lời kiểm thử,
   và các hàng chứa, là một phần của, hoặc giống ≥90% câu trả lời
   kiểm thử. `nmt-forge run` từ chối các hàng huấn luyện bị rò rỉ vào test set hoặc sealed set
   đã đăng ký, do đó điều này quan trọng nhất đối với dữ liệu hoặc pipeline nằm ngoài
   forge — hoặc một test set mà bạn chưa từng đăng ký.
2. **Lựa chọn checkpoint.** Checkpoint có được chọn trên một **fenced dev set**,
   chứ không phải test set không? forge từ chối huấn luyện khi không có dev set chính là để ngăn chặn
   điều này, nhưng một pipeline tự dựng thủ công sẽ không làm vậy.
3. **Sự lạc quan từ các biến thể gần giống (near-twins).** `R4-optimism-bound`: nếu điểm battery "full"
   cao hơn điểm "strict" vài điểm, khoảng cách đó chính là sự lạc quan do drill-sibling.
   `leak-audit` cố ý *giữ lại* các biến thể mẫu (*"I see the
   dog"* trong tập huấn luyện, *"I see the cat"* trong test set) và liệt kê các hàng kiểm thử
   có biến thể tương tự; với `eval.near_dupe_corpus` được trỏ tới tệp huấn luyện của bạn (cấu hình
   khởi đầu thực hiện việc này), báo cáo sẽ chấm điểm riêng các hàng kiểm thử *không có*
   biến thể nào, được đánh dấu là "(strict)". **Hãy trích dẫn con số strict** cho bất kỳ
   khẳng định nào về khả năng tổng quát hóa. Nếu *mọi* hàng kiểm thử đều có một biến thể (`R4-recall-not-translation`:
   tập con strict bị rỗng, vì vậy điểm số đo lường khả năng ghi nhớ các cụm từ
   huấn luyện), và test set là cố định, hãy ghi một corpus không có biến thể vào tệp riêng
   bằng lệnh `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` và huấn luyện một mô hình thứ hai không có biến thể trên đó (leak-audit
   sẽ không ghi đè lên tệp mà mô hình đầu tiên đang huấn luyện) — hoặc sử dụng các câu
   kiểm thử được viết độc lập với các mẫu huấn luyện.
4. **Đầu ra không bám theo đầu vào.** `R9-harness-score-caveat`:
   báo cáo mt-eval cho biết điểm số cần có điều kiện đính kèm — thường gặp nhất là **đầu ra gần như bất biến**:
   nhiều câu kiểm thử khác nhau nhận về cùng một vài kết quả đầu ra (một
   mô hình bệnh viện đã trả lời 150 câu khác nhau bằng đúng 9 kết quả đầu ra; nó vẫn
   đạt chrF++ 48, vì một cụm từ phổ biến chia sẻ nhiều ký tự với
   nhiều bản dịch tham chiếu). Mô hình loại bỏ biến thể là đối tượng thường gặp: khi
   các mẫu huấn luyện bị loại bỏ, một mô hình nhỏ có thể quay về phát ra các câu xuất hiện
   thường xuyên nhất. forge chuyển tiếp lời cảnh báo này theo đúng câu chữ của harness —
   trong phần tóm tắt export, `DEPLOY.md`, `status`, `report`, `compare` và
   `lint` — và không bao giờ gọi điểm số như vậy là "con số chuẩn để trích dẫn" nếu thiếu cảnh báo đó.
   Hãy đọc thử một vài kết quả đầu ra (`<export>/evaluation/battery-hyps.jsonl`, trên
   máy chứa test set) trước khi bạn báo cáo điểm số đó là chất lượng dịch thuật;
   nhiều cặp huấn luyện thực tế, đa dạng hơn chính là giải pháp can thiệp.

---

## "Quá trình huấn luyện dừng lại gần như ngay lập tức"

Lượt chạy kết thúc chỉ sau vài trăm bước; mô hình hầu như chưa kịp tiếp cận dữ liệu.

**Điều gì đang xảy ra:** tính năng dừng sớm (early stopping) đã nhầm lẫn sự dao động của tập dev (vốn chứa nhiều dữ liệu tổng hợp) là sự hội tụ.

**Hành vi của forge:** điều này được *ngăn chặn* theo mặc định — `nmt-forge run` suy ra một
**ngưỡng sàn** dừng từ tập hợp dữ liệu của bạn và loại bỏ các lần dừng sớm dưới ngưỡng này, đồng thời ghi lại
lý do trong các dòng `[schedule-sanity]`. Tần suất đánh giá dev set cũng được
xác định dựa trên quy mô của lượt chạy, do đó một lượt chạy nhỏ sẽ không bị bỏ qua việc đánh giá. Nếu
bạn thấy lượt chạy dừng lại đột ngột ngoài dự kiến, hãy đọc các dòng đó; run manifest sẽ ghi lại
chính xác những gì đã xảy ra và lý do. (Một lượt chạy chỉ đơn thuần hoàn thành bước dự kiến cuối cùng
sẽ được báo cáo là đã kết thúc, chứ không phải là dừng sớm.)

---

## "Lượt chạy bị từ chối trước khi thực sự bắt đầu"

**Điều gì đang xảy ra:** một điều kiện kiểm tra (gate) đã kích hoạt — điều này ít tốn kém hơn nhiều so với việc lượt chạy bị lỗi sau
hàng giờ đồng hồ. Các trường hợp phổ biến:

- **Thiếu gói cài đặt mở rộng cho huấn luyện** — `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` đi kèm cách khắc phục,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **Không có dev set, hoặc dev set không đúng** — dev-fence từ chối lượt chạy nếu
  `data.dev` không phải là một tập dữ liệu đã đăng ký với vai trò `dev`. Hãy trích xuất một tập bằng
  `nmt-forge split … --register project`.
- **Rò rỉ dữ liệu** — một tệp huấn luyện có chung prompt hoặc câu trả lời với một test set
  hoặc sealed set đã đăng ký. Hãy làm sạch nó bằng `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` và trỏ cấu hình đến tệp đã làm sạch.
- **Thời gian chạy thực tế** — trong những phút đầu tiên, forge đo tốc độ huấn luyện và
  từ chối lượt chạy nếu dự kiến vượt quá `model.time_budget_hours`. Trên CPU, điều này
  thường có nghĩa là preset cần GPU (`nllb-600m`), hoặc dữ liệu trộn lớn hơn nhiều
  so với dự tính của bạn. Thông báo sẽ nêu rõ các cách can thiệp: giảm tập dữ liệu trộn, rút ngắn
  độ dài chuỗi, hoặc tăng giới hạn thời gian nếu bạn thực sự chấp nhận chờ đợi.

**Cách khắc phục:** chạy `nmt-forge preflight run --config config.json` trước mỗi lượt chạy;
lệnh này liệt kê tất cả các gate, ✓/✗, kèm theo hướng dẫn khắc phục cho từng ✗.

---

## "Một chỉ số tôi muốn chỉ đơn giản là... biến mất khỏi báo cáo"

Báo cáo trung thực nhưng lại trống ở một trục đánh giá (COMET, kiểm tra tính hợp lệ của FST).

**Phát hiện của forge:** `R6-referee-unavailable` — luồng đánh giá được nêu tên là không khả dụng kèm theo lý do. **Đòn bẩy: REFEREE.**

**Cách khắc phục:** cài đặt/cấu hình referee được nêu tên và chấm điểm lại. Khi language
card khai báo referee, thông báo của forge sẽ chỉ ra lệnh cài đặt
(`mt-eval setup --lang <code>`). Điểm số hiện tại của bạn vẫn trung thực — chỉ là
chúng chưa thể đánh giá được phương diện đó cho đến khi có referee.

---

## "Mô hình tạo ra `<unk>` hoặc các ký tự bị lỗi"

Đặc biệt là trên các hệ chữ viết âm tiết (syllabic) hoặc chữ Latin mở rộng.

**Điều này tùy thuộc vào preset.**

- **`cpu-tiny`** tự học từ vựng từ các hàng dữ liệu huấn luyện của bạn, vì vậy mọi
  ký tự xuất hiện trong quá trình huấn luyện đều được bao quát. `<unk>` ở đây có nghĩa là đầu vào
  chứa một ký tự chưa từng xuất hiện trong tập huấn luyện — một chữ cái hoặc
  dấu phụ hiếm gặp, hoặc một dạng Unicode khác của nó (văn bản được chuẩn hóa về NFC, nên
  dấu kết hợp và dấu tách rời được tính như nhau). Hãy kiểm tra xem dữ liệu huấn luyện
  và kiểm thử của bạn có sử dụng cùng một quy tắc chính tả hay không.
- **`cpu-finetune` và `nllb-600m`** sử dụng tokenizer của mô hình nền tảng tiền huấn luyện.

⚠ **chú ý điều này — chưa được tự động hóa (các mô hình nền tảng tiền huấn luyện).** Tokenizer của mô hình nền tảng
**có thể không biểu diễn được hệ chữ viết mục tiêu của bạn**. forge hiện chưa kiểm tra
độ bao phủ của tokenizer trước khi huấn luyện. Hãy kiểm tra tokenizer của mô hình nền tảng với
các mẫu thuộc hệ chữ viết mục tiêu của bạn; nên ưu tiên mô hình nền tảng có từ vựng bao quát được hệ chữ viết đó
(nhiều ngôn ngữ ít tài nguyên được bao quát bởi các mô hình thuộc họ NLLB) hoặc mở rộng
tokenizer trước khi huấn luyện.

---

## Khi forge từ chối và bạn không hiểu tại sao

Một thông báo từ chối luôn nêu rõ điều gì (**what**) đã xảy ra, tại sao (**why**) nó làm hỏng kết quả, và cách khắc phục (**fix**). Nếu vẫn chưa rõ ràng:

- `nmt-forge status` — vị trí hiện tại của bạn và lệnh duy nhất tiếp theo cần thực hiện.
- `nmt-forge preflight <command>` — mọi gate mà lệnh đó sẽ gặp phải, ✓/✗, kèm theo
  cách khắc phục cho từng ✗, giúp bạn giải quyết tất cả cùng một lúc thay vì từng cái một
  (đối với `run`, `evaluate` và `export`, thêm `--config config.json`).
- Thêm `--json` vào bất kỳ lệnh nào khi một agent đang đọc kết quả: việc từ chối
  khi đó sẽ được trả về dưới dạng một đối tượng JSON — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — với mã thoát 2.

Một thông báo từ chối không phải là lỗi trong thiết lập của bạn — đó là việc công cụ phát hiện ra sai sót trước khi nó ảnh hưởng đến kết quả của bạn. Đó chính là toàn bộ triết lý thiết kế.
