---
sidebar_position: 1
slug: /intro
title: "Giới thiệu"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Một framework quốc tế hóa hoàn toàn có thể tùy chỉnh. Chỉ với một câu lệnh để dịch các tệp ngôn ngữ (locale) của bạn. Một cấu hình duy nhất kiểm soát mọi phương thức, mô hình và cặp ngôn ngữ. Và nếu các phương thức tích hợp sẵn là chưa đủ — hãy tự xây dựng phương thức của riêng bạn, kiểm tra hoạt động và triển khai nó.

```bash
npx champollion sync
```

champollion tự động phát hiện các tệp locale, định dạng và ngôn ngữ đích của bạn. Công cụ sẽ dịch những phần còn thiếu, bỏ qua những phần đã hoàn thành, kiểm tra từng kết quả xem có bị lỗi đầu ra hay không và ghi lại kết quả sạch sẽ. Đó chỉ là điểm khởi đầu.

:::info[Một phần của điều gì đó lớn lao hơn]

CLI này là phần triển khai thực tế của **Champollion** — cơ sở hạ tầng
đo lường dịch máy cho những ngôn ngữ mà không nơi nào khác đo lường, và
công bố những gì tìm được. Phía đo lường xây dựng các bộ kiểm thử đánh giá và
một bản đồ công khai về việc ai có thể dịch ngôn ngữ nào, tốt đến mức nào, trên những loại văn bản nào;
còn CLI là nơi phương pháp đã được kiểm chứng trở thành thứ bạn thực sự có thể chạy được.

Một nguyên tắc định hình mọi thứ: dữ liệu ngôn ngữ được đối xử như dữ liệu sinh học, vì vậy
những người cung cấp ngữ liệu nắm giữ chìa khóa đối với ngữ liệu đó và bất kỳ thứ gì được đo lường
dựa trên nó. Bức tranh toàn cảnh — những gì đang tồn tại, các quy tắc là gì, bạn
phù hợp ở đâu — nằm tại [Champollion là gì](/docs/what-is-champollion), và
phần đo lường nằm trong mục [the Network](/docs/network/).

:::

---

## Tại sao không tự viết script?

Bạn có thể viết một vòng lặp nhanh để gọi Google Translate cho từng key. Hầu hết các nhà phát triển đều làm vậy — chỉ mất khoảng 30 dòng code. Nhưng đây là những điểm mà cách này sẽ thất bại:

- **Không phát hiện thay đổi.** Cập nhật một chuỗi tiếng Anh — bản dịch sẽ mãi mãi lỗi thời. champollion theo dõi từng giá trị nguồn bằng mã băm SHA-256 và chỉ dịch lại những gì đã thay đổi.
- **Không xử lý theo lô.** Một lệnh gọi API cho mỗi khóa nghĩa là 200 khóa = 200 lượt khứ hồi. champollion gom lô thông minh (có thể cấu hình, mặc định 80 khóa/lô cho LLM, 128 cho Google).
- **Không có bộ nhớ đệm.** Mỗi lần đồng bộ lại dịch lại toàn bộ. Bộ nhớ dịch của champollion lưu đệm các bản dịch theo văn bản nguồn + locale + phương thức — việc chạy lại đồng bộ sau khi thay đổi một khóa sẽ chỉ dịch duy nhất khóa đó, không dịch lại toàn bộ tệp.
- **Không có cổng kiểm soát chất lượng.** Dịch máy có thể tạo ảo giác, lặp lại nguyên văn bản nguồn hoặc xuất sai hệ chữ viết. champollion kiểm tra từng bản dịch trước khi ghi — đầu ra trống, lặp lại nguồn, vòng lặp vô tận, độ dài phình to bất thường, nội dung bị xóa và sai hệ chữ viết đều bị phát hiện và từ chối. Cổng kiểm soát này bắt các đầu ra bị lỗi hỏng, chứ không bắt nghĩa sai.
- **Không nhận biết định dạng.** Bị gán cứng với JSON? champollion xử lý JSON, TOML, YAML và Hugo Markdown (frontmatter + nội dung) với khả năng tự động phát hiện.
- **Không kiểm soát phương thức.** Mọi cặp ngôn ngữ đều dùng chung một phương thức. champollion cho phép bạn sử dụng Google Translate cho tiếng Pháp, một LLM cho tiếng Nhật, và một pipeline tùy chỉnh do cộng đồng tự lưu trữ cho tiếng Cree — tất cả trong cùng một tệp cấu hình.

champollion chính là phiên bản sẵn sàng cho môi trường production của đoạn script đó.

---

## Điều gì tạo nên sự khác biệt

### Mọi phương thức đều là một plugin

Phương thức dịch thuật có thể **cấu hình cho từng cặp ngôn ngữ**. Kết hợp Google Translate, LLM, prompt có hướng dẫn (coached prompts) và các API tùy chỉnh trong cùng một dự án:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Tiếng Pháp dùng Google Translate (nhanh, rẻ). Tiếng Nhật dùng LLM cao cấp (sắc thái tinh tế). Tiếng Plains Cree dùng LLM được huấn luyện kèm các quy tắc ngữ pháp và từ điển do bạn cung cấp. Cùng lệnh `sync`. Cùng cổng kiểm soát chất lượng. Cùng một CLI.

### Xem phương thức nào hiệu quả

Bạn nghĩ phương thức của mình có thể dịch từ tiếng Anh sang tiếng Tây Ban Nha? Tiếng Thổ Nhĩ Kỳ sang tiếng Azerbaijan? Tiếng Anh sang tiếng Cree?

**Hãy xây dựng và thử nghiệm nó.** Công cụ [eval harness](/docs/network/specifications/harness) đi kèm sẽ đánh giá hiệu năng (benchmark) của bất kỳ phương thức dịch thuật nào với điểm số có thể tái lập và được định danh (fingerprinted). Bảng xếp hạng [leaderboard](/leaderboard) ghi lại mỗi lượt chạy được công bố, nhờ đó mọi người đều có thể thấy phương thức nào hiệu quả.

Công cụ eval harness và CLI production chia sẻ cùng một giao diện plugin. Một phương thức đạt điểm cao trong harness có thể được sử dụng trong môi trường thực tế — nếu cộng đồng sở hữu ngôn ngữ đó đồng ý. Đối với các ngôn ngữ bản địa và ngôn ngữ ít tài nguyên, sự đồng ý đó là vô cùng quan trọng. Xem [Chủ quyền Dữ liệu](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

Cùng một plugin. Cắm vào và thử nghiệm.

### Bộ công cụ đầy đủ

champollion không chỉ có `sync`. Đây là một pipeline i18n hoàn chỉnh:

| Lệnh | Chức năng |
|---------|-------------|
| `sync` | Dịch các key bị thiếu và bị cũ (với xác thực sau khi đồng bộ) |
| `watch` | Tự động đồng bộ khi tệp nguồn của bạn thay đổi |
| `lint` | Quét mã nguồn để tìm các chuỗi bị viết cứng (hardcoded) |
| `wrap` | Tự động bọc các chuỗi viết cứng trong các lệnh gọi `t()` |
| `audit` | Liệt kê tất cả các nhãn dự phòng (fallback markers) `[EN]` từ các lượt chạy trước |
| `verify` | Xác minh các bản dịch có đầy đủ và chính xác hay không (CI gate) |
| `integrity` | Phát hiện lỗi hỏng placeholder, sự cố mã hóa và tính đầy đủ của số nhiều ICU |
| `seo` | Tạo thẻ hreflang, sitemap và schema JSON-LD |
| `status` | Hiển thị cấu hình cặp ngôn ngữ, plugin và điểm số benchmark |
| `provenance` | Kiểm tra giấy phép của tài nguyên dịch thuật |
| `plugin` | Cài đặt, gỡ bỏ và liệt kê các plugin phương thức |
| `fonts` | Tải xuống phông chữ web cho các bộ chuyển đổi hệ chữ viết PUA |
| `tm` | Quản lý bộ nhớ đệm Bộ nhớ dịch thuật (thống kê, xóa, theo từng ngôn ngữ) |
| `xliff` | Xuất/nhập XLIFF 1.2 để biên dịch viên chuyên nghiệp soát lỗi |

Bốn trong số này — `lint`, `sync`, `verify`, `audit` — tạo thành một pipeline CI giúp phát hiện các chuỗi viết cứng, dịch chúng, xác minh tính chính xác và báo lỗi bản build nếu có bất kỳ ngôn ngữ nào chưa hoàn thành.

---

## Mạng lưới

[Bảng xếp hạng phương thức](/leaderboard) là bảng điểm — trực tiếp, công khai và luôn mở nhận bài nộp. Mỗi bài nộp đều được định danh theo một Git commit, gắn phiên bản với một tập dữ liệu cụ thể và được chấm điểm bởi cùng một khung kiểm thử. Bất kỳ ai cũng có thể gửi bài nộp.

**Bạn có thể xây dựng những gì?** Công cụ harness nhận đầu vào JSON. Các plugin nhận đầu vào JSON. Bất kỳ phương thức nào tạo ra JSON đều có thể được thử nghiệm:

| Hướng tiếp cận | Ví dụ |
|----------|---------|
| **LLM có hướng dẫn (Coached LLM)** | Đưa các quy tắc ngữ pháp và từ điển vào prompt của một mô hình tiên tiến (frontier model) |
| **Mô hình tinh chỉnh (Fine-tuned model)** | Huấn luyện một mô hình mở trên văn bản song song — chỉ cần không dùng dữ liệu đánh giá (eval data) |
| **Pipeline kiểm soát bằng FST** | LLM tạo bản dịch → bộ chuyển đổi trạng thái hữu hạn (FST) xác thực hình thái học → thử lại |
| **Chuỗi mô hình (Chained models)** | Mô hình A nháp → Mô hình B hậu biên tập → Mô hình C chấm điểm |
| **Từ điển + LLM** | Bắt buộc sử dụng các thuật ngữ đã biết từ từ điển, để LLM xử lý phần còn lại |
| **Tiến hóa (Evolutionary)** | Tạo các ứng viên, chấm điểm chúng, đột biến những ứng viên tốt nhất, lặp lại |
| **Dịch thuật một phần** | Dịch thủ công một mẫu thử, chứng minh LLM của bạn khớp với mẫu đó, tự động dịch phần còn lại |

Tinh chỉnh mô hình. Triển khai các thuật toán tiến hóa. Thử nghiệm câu trả lời của học sinh trong các kỳ thi ngôn ngữ. Xây dựng bảng tra cứu. Chuỗi ba mô hình lại với nhau. Miễn là phương thức của bạn tạo ra JSON, công cụ harness sẽ chấm điểm và framework sẽ chạy nó.

:::danger[Quy tắc duy nhất]
**Không huấn luyện trên dữ liệu đánh giá.** Các phương thức tiếp xúc với tập dữ liệu benchmark sẽ bị loại. Bạn có thể tinh chỉnh trên bất kỳ thứ gì bạn muốn. Chỉ là không được dùng tập kiểm thử (test set).
:::

Đây là một lời mời mở. Nếu bạn làm việc với một ngôn ngữ ít tài nguyên — với tư cách là nhà nghiên cứu, thành viên cộng đồng, sinh viên hoặc chỉ là một người quan tâm — hãy xây dựng một phương thức, chạy công cụ harness và củng cố mạng lưới cho tất cả mọi người. Vấn đề này vẫn chưa có lời giải. Cơ sở hạ tầng đã có sẵn ở đây, và nó hoàn toàn mở.

**[→ Xem bảng xếp hạng](/leaderboard)**

---

## Các bước Tiếp theo

**Bắt đầu:**
- [Cài đặt](/docs/getting-started/installation) — Thiết lập trong 2 phút
- [Bắt đầu nhanh](/docs/getting-started/quick-start) — Chạy lần đồng bộ đầu tiên của bạn
- [Ngôn ngữ được hỗ trợ](/docs/reference/supported-languages) — Những gì có sẵn ngay khi cài đặt

**Tùy chỉnh thiết lập của bạn:**
- [Phương thức dịch thuật](/docs/guides/translation-methods) — Chọn phương thức phù hợp cho từng cặp ngôn ngữ
- [Bộ nhớ dịch thuật](/docs/concepts/translation-memory) — Cách bộ nhớ đệm giúp bạn tiết kiệm chi phí
- [Cấu hình](/docs/getting-started/configuration) — Tài liệu tham khảo cấu hình đầy đủ
- [Trang web đa ngôn ngữ Hugo](/docs/tutorials/hugo-multilingual-site) — Dịch nội dung Markdown

**Tìm hiểu sâu hơn:**
- [Làm việc với biên dịch viên chuyên nghiệp](/docs/guides/professional-translators) — Quy trình xuất/nhập XLIFF
- [Chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) — Các nguyên tắc chủ quyền dữ liệu bản địa: quyền sở hữu và kiểm soát dữ liệu ngôn ngữ của cộng đồng
- [Hỗ trợ ngôn ngữ tài nguyên thấp](/docs/network/community/low-resource-languages) — Thử thách khởi đầu tất cả
- [Cookbook: Pipeline có cổng kiểm soát FST](/docs/network/tutorials/fst-gated-pipeline) — Xây dựng một pipeline phân tách
- [Đánh giá MT](/docs/network/leaderboard/rules) — Cách hoạt động của khung kiểm thử và bảng xếp hạng
- [Bảng xếp hạng phương thức](/leaderboard) — Điểm số trực tiếp và các bài nộp
