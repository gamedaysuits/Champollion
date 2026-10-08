---
sidebar_position: 7
title: "Dành cho Doanh nghiệp"
description: "Cách các tổ chức có thể chuẩn hóa quy trình dịch thuật bằng các phương pháp đã được kiểm chứng qua bảng xếp hạng, các plugin tùy chỉnh và triển khai chỉ với một câu lệnh."
---

# champollion dành cho Doanh nghiệp

Đội ngũ của bạn dịch thuật nội dung thường xuyên. Bạn có một tập hợp các tệp ngôn ngữ (locale), một pipeline CI, và một quy trình có lẽ bao gồm việc ai đó phải chạy Google Translate thủ công, sao chép kết quả vào tệp JSON và hy vọng mọi thứ suôn sẻ. Hoặc bạn đang trả tiền cho một nền tảng TMS nơi bạn bị ràng buộc vào công cụ dịch thuật của một nhà cung cấp duy nhất.

champollion mang đến cho bạn một lựa chọn nhẹ nhàng hơn: chọn phương thức phù hợp cho từng ngôn ngữ — máy dịch hoặc con người dịch — và chạy tất cả chỉ bằng một lệnh duy nhất.

## Tại sao các đội ngũ sử dụng champollion

1. **Chọn phương thức phù hợp cho từng ngôn ngữ** — máy dịch hoặc con người dịch, chứ không phải bất kỳ thứ gì nhà cung cấp của bạn mặc định chọn
2. **Triển khai chỉ với một lệnh** — `npx champollion sync` dịch mọi ngôn ngữ, mọi định dạng, mọi lúc
3. **Thay đổi phương thức không cần sửa mã nguồn** — chỉ cần thay đổi cấu hình, không cần di chuyển dữ liệu (migration)
4. **Làm chủ pipeline của bạn** — không bị ràng buộc nhà cung cấp, không có bảng điều khiển hàng tháng, không cần tài khoản

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Tiếng Pháp sử dụng DeepL (đội ngũ của bạn thích sự tự nhiên theo phong cách châu Âu của nó). Tiếng Nhật sử dụng một frontier LLM. Tiếng Đức sử dụng Google Translate (nhanh, rẻ, đủ tốt). Tiếng Hàn sử dụng một LLM với văn phong trang trọng. Tiếng Tây Ban Nha được định tuyến đến dịch vụ con người chuyên nghiệp / MTPE thông qua phương thức `api` — dịch thuật bởi con người là một phương thức hạng nhất tại đây, không phải một tiện ích bổ sung chắp vá. Tiếng Plains Cree sử dụng phương thức LLM có huấn luyện (coached LLM), kèm theo ghi chú ngữ pháp và từ điển do bạn cung cấp.

**Cùng một lệnh. Cùng một pipeline CI. Các phương thức khác nhau cho từng cặp ngôn ngữ — con người hoặc máy dịch. Chỉ một tệp cấu hình.**

:::note[Các phương thức cho ngôn ngữ cộng đồng có chủ quyền riêng]
Cặp ngôn ngữ Plains Cree ở trên không chỉ đơn thuần là một cặp ngôn ngữ thông thường. Các phương thức dành cho ngôn ngữ Bản địa và các ngôn ngữ cộng đồng khác đều **thuộc sở hữu và do cộng đồng quản trị**: cộng đồng nắm giữ quyền kiểm soát dữ liệu đằng sau chúng, đặt ra các điều khoản sử dụng, và mọi kho ngữ liệu hoặc phương thức phi thương mại (NC) đều được tách biệt khỏi các mục đích thương mại theo mặc định. Nếu bạn sử dụng cho mục đích thương mại, hãy kiểm tra giấy phép của phương thức trước khi triển khai sản phẩm. Xem [Chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty).
:::

## Quy trình từ Bảng xếp hạng → Triển khai

:::tip[`champollion network leaderboard` đi kèm với CLI]
Quy trình làm việc dưới đây chạy trên lệnh `champollion network leaderboard` — duyệt bảng xếp hạng [Network](/arena) trực tiếp từ terminal của bạn và cài đặt plugin phương thức ngay tại đó. Xem [Tài liệu tham khảo CLI](/docs/reference/cli#leaderboard) để biết tất cả các tùy chọn.
:::

[Network](/arena) là nơi các phương thức dịch thuật được đánh giá chuẩn (benchmark) với điểm số có thể tái lập và có dấu vết xác thực. Các lượt chạy được xếp hạng theo cách mà lĩnh vực dịch máy (MT) xếp hạng: theo chrF++ cấp kho ngữ liệu cùng với khoảng tin cậy 95% của nó. BLEU, TER và COMET được hiển thị bên cạnh, còn các chẩn đoán như khớp chính xác (exact match) và chấp nhận FST (FST acceptance) được báo cáo riêng biệt, không bao giờ bị gộp chung vào chỉ số tiêu đề. Liệu một phương thức có thực sự tốt hơn phương thức khác hay không là kết quả của một kiểm định ý nghĩa theo cặp (paired significance test), chứ không phải đơn thuần là khoảng cách giữa hai con số. Bảng xếp hạng theo dõi mọi lượt gửi bài.

Quy trình làm việc:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Chỉ mang tính chất minh họa — các hàng trên bảng xếp hạng ở trên là một bố cục mẫu. Trong ví dụ này, khoảng tin cậy của hai hàng đầu tiên chồng lấn lên nhau, do đó bảng xếp hạng không khẳng định phương thức nào tốt hơn phương thức nào. Bảng xếp hạng hiện đang mở nhận bài nộp và chưa có lượt chạy nào được công bố.*

**Bạn không cần xây dựng phương thức. Bạn không cần huấn luyện mô hình. Bạn chỉ cần chọn phương thức phù hợp với lĩnh vực, ngân sách và giấy phép của mình — con người hoặc máy dịch — và triển khai nó.** Nếu một phương thức phù hợp hơn xuất hiện vào tháng tới, bạn có thể thay thế nó chỉ bằng một lệnh.

## Những gì đã sẵn sàng hôm nay

Cầu nối từ bảng xếp hạng đến CLI đang được phát triển. Dưới đây là những gì hoạt động ngay lúc này:

### Các phương thức tích hợp sẵn (không cần plugin)

| Phương thức | Phù hợp nhất cho | Chi phí |
|--------|----------|------|
| `llm` (mặc định) | Tập trung vào chất lượng, mọi ngôn ngữ | Theo token qua OpenRouter |
| `gemini` | Chất lượng + gói miễn phí | Miễn phí (giới hạn), sau đó theo token |
| `google-translate` | Tốc độ + số lượng lớn | $20/triệu ký tự |
| `deepl` | Các ngôn ngữ châu Âu | $25/triệu ký tự |
| `llm-coached` | Các ngôn ngữ có dữ liệu huấn luyện (coaching data) | Theo token qua OpenRouter |
| `api` | Các phương thức tùy chỉnh/do cộng đồng lưu trữ | Tự lưu trữ (Self-hosted) |

### Các phương thức plugin (cài đặt riêng biệt)

Các plugin tùy chỉnh có thể bao bọc bất kỳ logic dịch thuật nào — một mô hình đã được tinh chỉnh (fine-tuned), một pipeline được kiểm soát bởi FST, một API cộng đồng, hoặc bất kỳ thứ gì khác tạo ra JSON. Xem [Xây dựng một Plugin](/docs/tutorials/build-a-plugin).

## Quy trình làm việc cho Doanh nghiệp

### 1. Đánh giá chất lượng hiện tại của bạn

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Chạy bộ công cụ đánh giá (eval harness) trên các ứng viên

[Bộ công cụ đánh giá](/docs/network/specifications/harness) cho phép bạn đánh giá hiệu năng của nhiều phương thức trên cùng một tập dữ liệu. Chạy thử nghiệm hàng loạt, so sánh điểm số, chọn ra phương thức chiến thắng:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Cấu hình phương thức chiến thắng cho từng cặp ngôn ngữ

Cập nhật cấu hình của bạn để sử dụng phương thức tốt nhất cho từng cặp ngôn ngữ. Các ngôn ngữ khác nhau có các phương thức tốt nhất khác nhau — đó chính là mấu chốt.

### 4. Tích hợp vào CI/CD

```bash
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Ba câu lệnh. Không cần dịch thuật thủ công. Pipeline sẽ phát hiện các chuỗi ký tự bị viết cứng (hardcoded), dịch chúng bằng các phương thức bạn đã chọn, và báo lỗi bản build nếu có bất kỳ thứ gì bị thiếu hoặc bị hỏng.

### 5. Đánh giá chuyên nghiệp bởi con người (tùy chọn)

Đối với nội dung quan trọng, hãy xuất sang định dạng XLIFF để con người xem xét:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Dịch máy số lượng lớn. Con người xem xét các phần quan trọng. Chỉ trả tiền cho thời gian của con người ở những nơi thực sự cần thiết.

## Mô hình Chi phí

champollion **không thu phí thuê bao và không tính giá theo số lượng người dùng**. CLI có mã nguồn khả dụng theo giấy phép PolyForm Noncommercial 1.0.0 — miễn phí cho mục đích phi thương mại: nghiên cứu, giáo dục, từ thiện, bệnh viện và phòng khám công lập, chính phủ, các dự án cá nhân. Việc sử dụng cho mục đích thương mại, chẳng hạn như sản phẩm của một doanh nghiệp vì lợi nhuận, không nằm trong phạm vi của giấy phép đó. Hãy xem [ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this) trước khi áp dụng. Ngoài ra, bạn chỉ phải trả chi phí cho các lệnh gọi API dịch thuật:

| Số lượng | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 key × 5 ngôn ngữ | ~$0.50 | ~$0.30 (gói miễn phí) | ~$2.00 |
| 10.000 key × 15 ngôn ngữ | ~$15 | ~$8 | ~$60 |
| 50.000 key × 30 ngôn ngữ | ~$75 | ~$40 | ~$300 |

Bộ nhớ dịch thuật (Translation Memory) giúp bạn chỉ phải trả tiền cho **các key đã thay đổi** trong các lần đồng bộ tiếp theo. Nếu bạn cập nhật 10 chuỗi trong số 10.000 chuỗi, bạn chỉ trả tiền cho 10 bản dịch, chứ không phải 10.000.

## So với các Nền tảng TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Mức giá** | Miễn phí cho mục đích phi thương mại ([ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this)) + chi phí API | $50–$500/tháng + phí theo người dùng |
| **Phụ thuộc nhà cung cấp (Vendor lock-in)** | Không có — đổi nhà cung cấp trong file cấu hình | Cao — dữ liệu nằm trên đám mây của họ |
| **Lựa chọn phương thức** | Mọi nhà cung cấp, mọi mô hình, cho từng cặp ngôn ngữ | Bất cứ thứ gì họ cung cấp |
| **CI/CD** | Hỗ trợ hạng nhất (`lint → sync → audit`) | Plugin/webhook |
| **Phương thức tùy chỉnh** | Hệ thống plugin, plugin từ cộng đồng | Không hỗ trợ |
| **Kiểm soát chất lượng (Quality gate)** | Tích hợp sẵn (sai hệ chữ viết, lặp từ, độ dài) | Tùy dịch vụ |
| **Tự lưu trữ (Self-hosted)** | Có (LibreTranslate, API tùy chỉnh) | Không |

Xem [bản so sánh đầy đủ](/docs/guides/comparison) để biết thêm chi tiết.

## Đọc thêm

- **[Bắt đầu nhanh](/docs/getting-started/quick-start)** — chạy lần đồng bộ đầu tiên của bạn trong 60 giây
- **[Các phương thức dịch thuật](/docs/guides/translation-methods)** — danh mục phương thức đầy đủ kèm theo sơ đồ quyết định
- **[Tích hợp CI/CD](/docs/guides/ci-cd)** — tự động hóa trong pipeline của bạn
- **[Làm việc với Biên dịch viên Chuyên nghiệp](/docs/guides/professional-translators)** — xuất/nhập XLIFF
- **[the Network](/arena)** — đánh giá hiệu năng và bảng xếp hạng
- **[Tài liệu tham khảo cấu hình](/docs/getting-started/configuration)** — mọi tùy chọn cấu hình
