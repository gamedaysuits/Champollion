---
sidebar_position: 3
title: "Cổng kiểm soát chất lượng"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Quality Gate

Mỗi bản dịch đều phải trải qua một cổng xác thực xác định (deterministic validation gate) trước khi được ghi vào đĩa. Quality gate này giúp phát hiện các lỗi dịch máy phổ biến — không có lỗi ngầm (silent fallback), không ghi dữ liệu rác vào các tệp ngôn ngữ (locale files) của bạn.

## Các bước kiểm tra xác thực (Validation Checks)

| Kiểm tra | Lỗi phát hiện | Nhãn Gate |
|-------|----------------|-----------|
| **Trống/khoảng trắng** | Mô hình trả về chuỗi rỗng hoặc khoảng trắng | `[GATE] empty` |
| **Lặp lại nguồn** | Mô hình trả về nguyên bản đầu vào tiếng Anh | `[GATE] source-echo` |
| **Vòng lặp ảo giác** | Các mẫu trigram lặp lại (ví dụ: `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Phình độ dài** | Đầu ra dài hơn đáng kể so với nguồn | `[GATE] length` |
| **Xóa nội dung** | Đầu ra là nguồn bị xóa các chữ cái | `[GATE] content` |
| **Tuân thủ hệ chữ viết** | Sai hệ chữ viết cho locale đích | `[GATE] script` |
| **Danh mục số nhiều ICU** | Thiếu các dạng số nhiều bắt buộc cho locale | `[GATE] icu-plural` |

Các key được khai báo [`noTranslate`](/docs/getting-started/configuration#no-translate) không bao giờ đi qua gate — chúng được sao chép nguyên văn từ nguồn, do đó không có gì để xác thực.

### Trống/Khoảng trắng (Empty/Blank)

Từ chối các bản dịch là chuỗi rỗng, chỉ chứa khoảng trắng hoặc `null`. Điều này giúp phát hiện các mô hình không trả về kết quả gì cho các khóa (keys) khó.

### Lặp lại nguồn (Source Echo)

Phát hiện khi mô hình trả về văn bản nguồn tiếng Anh thay vì dịch nó. Lỗi này thường xảy ra với các chuỗi ngắn và các câu lệnh (prompts) chưa đủ chi tiết.

Các chuỗi ngắn chủ yếu là ASCII (≤ 30 ký tự) được miễn trừ — `"Blog"`, `"GitHub"`, `"npm"` hợp lệ giữ nguyên tiếng Anh ở mọi nơi, và việc từ chối chúng sẽ gây ra vòng lặp vô hạn.

Các giá trị dài hơn mà vẫn đúng khi không thay đổi — URL, đường dẫn repository, định danh sản phẩm — không phải là vấn đề của gate và không thể khắc phục bằng cách tinh chỉnh gate: câu trả lời đúng *chính là* bản sao lặp lại (echo), do đó mọi đầu ra có thể có của mô hình đều sai. Hãy khai báo các key đó với [`noTranslate`](/docs/getting-started/configuration#no-translate) và chúng sẽ bỏ qua hoàn toàn pipeline. Các key có giá trị URL được xử lý theo cách đó theo mặc định.

### Vòng lặp ảo giác (Hallucination Loop)

Phân tích các mẫu trigram (3 ký tự) trong kết quả đầu ra. Nếu bất kỳ trigram nào lặp lại nhiều hơn số lần ngưỡng quy định so với độ dài đầu ra, bản dịch sẽ bị từ chối. Điều này giúp phát hiện các kết quả đầu ra bị lỗi thoái hóa như `"Qo' Qo' Qo' Qo' Qo'"`.

### Phình to độ dài (Length Inflation)

Từ chối các bản dịch có độ dài đầu ra vượt quá `maxLengthRatio × source length` (mặc định: 4×). Điều này giúp phát hiện các ảo giác của mô hình tạo ra cả một bức tường văn bản cho một đầu vào ngắn.

Có thể cấu hình thông qua `maxLengthRatio` trong tệp cấu hình của bạn.

### Xóa nội dung

Trái ngược với phình độ dài. Một mô hình không có từ vựng cho một chuỗi có thể xóa mọi chữ cái mà nó không thể dịch và chỉ để lại dấu câu cùng khoảng trắng của nguồn:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Không có kiểm tra nào khác phát hiện được điều này. Nó không trống, không phải là lặp lại nguồn, không lặp từ, và với *độ dài* bằng 33% so với nguồn, nó dễ dàng vượt qua `minLengthRatio`.

Kiểm tra này so sánh **các ký tự nội dung** — chữ cái và chữ số, bỏ qua dấu câu, khoảng trắng và định dạng ẩn — giữa nguồn và đầu ra. Nhưng chỉ riêng mật độ thì không thể làm quy tắc, bởi vì các hệ chữ viết dày đặc hợp lệ cũng nằm ở vị trí chính xác như vậy:

| Nguồn | Đầu ra | Nội dung được giữ lại | Phán quyết |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **bị từ chối** |
| `Getting started` | `入门` | 14% | được chấp nhận |
| `Frequently asked questions` | `常见问题` | 17% | được chấp nhận |

Bất kỳ ngưỡng nào bắt được trường hợp đầu tiên đều sẽ từ chối thẳng thừng tiếng Trung, tiếng Nhật và tiếng Hàn. Điều phân biệt chúng không phải là bao nhiêu phần trăm sống sót mà là *nó đến từ đâu*: đầu ra bị làm rỗng là một **chuỗi con** (subsequence) của chính nguồn của nó — có thể tạo ra bằng cách xóa các ký tự khỏi nguồn — trong khi một bản dịch thực sự về cơ bản không chia sẻ gì với nguồn. Việc gắn cờ yêu cầu **cả hai** tín hiệu, do đó kiểm tra này là điều kiện cần-nhưng-chưa-đủ giống như cách hoạt động của bộ phát hiện lặp từ.

Có thể cấu hình thông qua `minContentRetention` (mặc định `0.35`), theo từng cặp hoặc từng ngôn ngữ. Tăng giá trị này làm cho việc kiểm tra nhạy hơn; nó chỉ kích hoạt cùng với tín hiệu chuỗi con.

:::note[Đây là tín hiệu từ vựng, không phải nút điều chỉnh chất lượng]
Khi điều này kích hoạt liên tục cho một ngôn ngữ đích, mô hình không có từ vựng cho văn bản đó — thường là các chuỗi ngắn, dày đặc thuật ngữ trong một ngôn ngữ có vốn từ vựng đóng. Việc nới lỏng ngưỡng sẽ khôi phục lại lỗi hỏng ngầm (silent corruption); nó không tạo ra bản dịch. Hãy sửa prompt, dữ liệu huấn luyện (coaching data), hoặc cặp ngôn ngữ.
:::

### Tuân thủ hệ chữ viết (Script Compliance)

Đối với các locale mà language card ghi nhận hệ chữ viết phi Latinh (Ả Rập, CJK, Cyrillic, …), xác thực rằng đầu ra thực sự chứa các ký tự phi ASCII — đầu ra chỉ có chữ Latinh cho các locale đó sẽ bị từ chối vì sai hệ chữ viết.

Hai điểm làm rõ về những gì kiểm tra này *không phải*:

- Nó **không được điều khiển bởi trường cấu hình `script:`.** Trường đó chọn hệ thống chính tả đầu ra cho [chuyển đổi hệ chữ viết](/docs/getting-started/configuration#script-conversion); kỳ vọng của gate đến từ các language card.
- Nó luôn xác thực **hệ chữ viết làm việc (working script) mà mô hình phát ra**, *trước* bất kỳ quá trình chuyển đổi hệ chữ viết nào. Các locale có bộ chuyển đổi hệ chữ viết (crk, sr, tlh, …) tạo ra đầu ra hệ chữ viết làm việc Latinh một cách chính xác, do đó chúng được miễn kiểm tra này; việc chuyển đổi — nếu cấu hình chọn tham gia — diễn ra sau gate.

## Điều gì xảy ra khi thất bại

1. Bản dịch bị lỗi sẽ được ghi nhật ký (log) vào stderr với tiền tố `[GATE]`, tên khóa (key), lý do và bản xem trước của giá trị
2. Khóa đó sẽ **không** được ghi vào tệp ngôn ngữ
3. Quy trình thử lại liên tiếp (retry cascade) sẽ được kích hoạt (xem bên dưới)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Thử lại với phản hồi (Feedback Retry) và Chuỗi thử lại (Retry Cascade)

Một key bị gate từ chối sẽ có **một lần thử lại với phản hồi**: lý do từ chối được đưa vào prompt dưới dạng ngữ cảnh cho từng key (một lần thử lại mù quáng ở nhiệt độ thấp sẽ trả về đầu ra giống hệt từng byte). Nếu lần thử lại thành công, key được ghi lại và quá trình đồng bộ có màu **xanh** — một sự từ chối của gate tự phục hồi không phải là lỗi, và đây là ngữ nghĩa có chủ đích. Chỉ những key vẫn thất bại sau khi thử lại mới bị bỏ qua, được báo cáo (quá trình đồng bộ thoát với mã khác 0), và được thử lại trong lần đồng bộ tiếp theo.

Việc thử lại chạy qua phương thức dịch riêng của cặp ngôn ngữ, bất kể đó là gì — LLM, Google Translate, DeepL, hay một nhà cung cấp trực tiếp. Nó cũng áp dụng cho các kết quả khớp từ Bộ nhớ dịch (Translation Memory): một giá trị được lưu trong cache bị gate từ chối sẽ bị loại bỏ và dịch lại trong cùng một lần chạy, nhờ đó một cache bị nhiễm độc sẽ tự phục hồi.

Một cách riêng biệt, khi toàn bộ một batch thất bại (lỗi phân tích cú pháp JSON), champollion sẽ thử lại với các batch nhỏ dần:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Ngân sách thử lại được giới hạn bởi `maxRetries` (mặc định: 3, có thể cấu hình cho từng ngôn ngữ). Điều này ngăn chặn việc tiêu tốn token ngoài tầm kiểm soát cho các khóa liên tục bị lỗi.

Sau khi đã thử lại hết số lần cho phép, các khóa gặp sự cố sẽ được ghi nhật ký và bỏ qua. Chúng sẽ được thử lại trong lần chạy `sync` tiếp theo.

## Bộ nhớ đệm Prompt (Prompt Caching)

Thông điệp hệ thống (system message - bao gồm văn phong, quy tắc ngữ pháp, lưu ý về phong cách) được tách biệt khỏi thông điệp của người dùng (user message - các khóa cần dịch). Sự phân tách này là có chủ ý:

- Thông điệp hệ thống là **giống nhau giữa các loạt** đối với một ngôn ngữ nhất định
- Các nhà cung cấp như Anthropic và Google sẽ lưu bộ nhớ đệm (cache) cho các thông điệp hệ thống lặp lại
- Kết quả: loạt đầu tiên sẽ trả toàn bộ chi phí token, các loạt tiếp theo chỉ trả phí cho thông điệp của người dùng

Điều này có thể giảm đáng kể chi phí token cho các dự án có nhiều loạt dịch.

## Xác thực ICU MessageFormat

Lệnh `integrity` xác thực các mẫu số nhiều ICU MessageFormat dựa trên các quy tắc số nhiều của CLDR. Nếu tệp nguồn của bạn sử dụng cú pháp ICU như:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion sẽ xác minh xem các phiên bản dịch có bao gồm tất cả các danh mục số nhiều bắt buộc cho ngôn ngữ đích hay không. Ví dụ, tiếng Ả Rập yêu cầu sáu danh mục (`zero`, `one`, `two`, `few`, `many`, `other`) — chứ không chỉ `one` và `other`.

Chạy `champollion integrity` để kiểm tra tính đầy đủ của số nhiều trên tất cả các ngôn ngữ.

## Áp dụng thuật ngữ (Terminology Enforcement)

Đối với các cặp ngôn ngữ được huấn luyện (coached pairs) có kèm từ điển, Champollion sẽ chạy một bước kiểm tra thuật ngữ sau khi dịch. Sau khi vượt qua quality gate, hệ thống sẽ xác minh xem LLM có thực sự sử dụng các thuật ngữ bắt buộc trong từ điển hay không.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Các vi phạm thuật ngữ chỉ là **cảnh báo, không phải lỗi chặn (blocking errors)**. Bản dịch vẫn được ghi vào đĩa. Điều này là có chủ ý — LLM có thể có lý do chính đáng để chọn một từ thay thế (ngữ cảnh, ngữ pháp), và việc chặn bản dịch chỉ vì không khớp thuật ngữ sẽ gây hại nhiều hơn lợi.

Để khắc phục các vi phạm, hãy cập nhật từ điển huấn luyện (coaching dictionary) hoặc chỉnh sửa tệp ngôn ngữ theo cách thủ công.

---

## Xem thêm

- [Cách hoạt động của Sync](/docs/concepts/how-sync-works) — vị trí của quality gate trong quy trình (pipeline)
- [Phương thức dịch](/docs/guides/translation-methods) — các phương thức cung cấp dữ liệu đầu vào cho gate
- [Bộ chuyển đổi hệ chữ viết (Script Converters)](/docs/concepts/script-converters) — chuyển đổi hệ chữ viết sau bước gate
- [Dữ liệu huấn luyện (Coaching Data)](/docs/concepts/coaching-data) — cải thiện chất lượng dịch thuật từ nguồn
- [Bộ nhớ dịch (Translation Memory)](/docs/concepts/translation-memory) — lưu bộ nhớ đệm cho các bản dịch đã được xác thực
- [Tài liệu tham khảo CLI — sync](/docs/reference/cli#sync) — các cờ (flags) của lệnh sync bao gồm cả hành vi thử lại
- [Tài liệu tham khảo CLI — integrity](/docs/reference/cli#integrity) — kiểm tra số nhiều ICU
