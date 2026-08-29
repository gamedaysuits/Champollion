---
sidebar_position: 6
title: "Khắc phục sự cố"
---

# Khắc phục sự cố

Các vấn đề thường gặp và giải pháp cho champollion.

## API & Xác thực

### "OPENROUTER_API_KEY not found"

Champollion yêu cầu một API key để dịch thuật bằng LLM. Hãy thiết lập nó làm biến môi trường:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Hoặc trong tệp `.env` (nếu dự án của bạn tải các tệp `.env`):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Nếu bạn chỉ có API key của Google Translate, champollion sẽ tự động phát hiện và sử dụng Google Translate làm phương thức mặc định. Không cần thay đổi cấu hình.
:::

### Lỗi "401 Unauthorized" từ OpenRouter

API key của bạn không hợp lệ hoặc đã hết hạn. Hãy xác minh lại tại [openrouter.ai/keys](https://openrouter.ai/keys).

### Lỗi "429 Too Many Requests" / Giới hạn lượt yêu cầu (Rate Limiting)

Champollion xử lý giới hạn lượt yêu cầu nội bộ bằng cơ chế exponential backoff (thử lại với thời gian chờ tăng dần). Nếu bạn liên tục gặp phải giới hạn lượt yêu cầu:

1. **Giảm kích thước batch (lô)** trong cấu hình của bạn:
   ```json
   { "batchSize": 15 }
   ```
2. **Sử dụng mô hình có giới hạn lượt yêu cầu cao hơn** (ví dụ: `google/gemini-3.5-flash` có giới hạn rất thoải mái)
3. **Sử dụng phương thức rẻ hơn/nhanh hơn** cho các cặp ngôn ngữ có khối lượng lớn — Google Translate không có giới hạn lượt yêu cầu:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Không tìm thấy mô hình / Lỗi 404

Các nhà cung cấp LLM trực tiếp (`openai`, `anthropic`, `gemini`) sẽ xác thực chuỗi mô hình của bạn trong lần sử dụng đầu tiên. Nếu bạn thấy cảnh báo:

**"looks like an OpenRouter path"** — Bạn đang sử dụng mô hình định dạng OpenRouter (`google/gemini-3.5-flash`) với một nhà cung cấp trực tiếp. Các nhà cung cấp trực tiếp sử dụng tên mô hình thuần túy:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

Hoặc chuyển sang phương thức `llm` để sử dụng OpenRouter:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — Bạn đang gửi một mô hình đến sai nhà cung cấp:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — Mô hình có thể đã bị ngừng hỗ trợ hoặc viết sai chính tả. Champollion sẽ lấy danh sách mô hình thực tế của nhà cung cấp và gợi ý các lựa chọn thay thế. Hãy kiểm tra tài liệu của nhà cung cấp để biết tên mô hình hiện tại.

:::tip[Mô hình có thể bị ngừng hoạt động]
Các nhà cung cấp dịch vụ thường xuyên ngừng hỗ trợ các tên mô hình cũ. Nếu quá trình dịch đột ngột thất bại sau khi nhà cung cấp cập nhật, hãy kiểm tra đầu ra của `[WARN]` — nó sẽ hiển thị cho bạn các lựa chọn thay thế hiện tại.
:::

## Chất lượng dịch thuật

### Bản dịch lặp lại ngôn ngữ nguồn

Cổng kiểm soát chất lượng (quality gate) sẽ phát hiện điều này. Nếu bản dịch giống hệt với nguồn tiếng Anh, nó sẽ bị từ chối và thử lại. Nếu tình trạng này vẫn tiếp diễn:

1. **Kiểm tra mô hình** — Một số mô hình hoạt động kém hiệu quả đối với các cặp ngôn ngữ cụ thể
2. **Thêm hướng dẫn về văn phong/ngôn ngữ (register)** — Cho mô hình biết cần tạo ra ngôn ngữ nào:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Thử một mô hình khác** — Chuyển từ `gpt-4o-mini` sang `gpt-4o` hoặc `google/gemini-2.5-pro`

### Đầu ra sai hệ chữ viết (ví dụ: chữ Latin cho tiếng Nhật)

Trình kiểm tra tính tuân thủ hệ chữ viết của cổng kiểm soát chất lượng sẽ phát hiện hầu hết các trường hợp này. Nếu nó vẫn tiếp diễn:

- Xác minh mã locale là chính xác (`ja`, chứ không phải `jp`)
- Thêm hướng dẫn rõ ràng về hệ chữ viết trong trường `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Các mẫu ảo tưởng (hallucination) trong đầu ra

Các mẫu trigram lặp đi lặp lại (ví dụ: "hello hello hello") sẽ bị phát hiện bởi trình phát hiện vòng lặp ảo tưởng. Nếu đầu ra bị lỗi font/ký tự lạ nhưng vẫn vượt qua trình phát hiện:

1. **Giảm kích thước batch** — Các batch nhỏ hơn sẽ tạo ra đầu ra tập trung hơn
2. **Sử dụng mô hình mạnh hơn** — Các mô hình lớn hơn ít bị ảo tưởng hơn đối với các hệ chữ viết không phải Latin
3. **Thêm dữ liệu hướng dẫn (coaching data)** — Các thuật ngữ từ điển sẽ giúp định hình bản dịch chính xác hơn

## Vấn đề về Tệp & Định dạng

### "No locale files found" (Không tìm thấy tệp locale)

Champollion tự động phát hiện các tệp locale. Nếu không thể tìm thấy chúng:

1. **Kiểm tra `localesDir`** — Phải trỏ đến thư mục chứa các tệp locale:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Kiểm tra cách đặt tên tệp** — Các tệp phải được đặt tên theo mã locale: `en.json`, `fr.json`, v.v.
3. **Kiểm tra định dạng** — Các định dạng được hỗ trợ: JSON, nested JSON, YAML, TOML

### Xung đột tệp khóa (lock file)

Nếu `.champollion.lock` rơi vào trạng thái lỗi:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Việc xóa tệp khóa đồng nghĩa với việc lần đồng bộ tiếp theo sẽ dịch lại tất cả các khóa, chứ không chỉ những khóa đã thay đổi. Điều này sẽ ảnh hưởng đến chi phí API đối với các dự án lớn.
:::

### Dịch lại các khóa cụ thể

Nếu các bản dịch riêng lẻ bị sai và bạn muốn buộc dịch lại chúng mà không cần xóa tệp khóa:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Cờ `--force-keys` sẽ ghi đè việc kiểm tra mã hash của tệp khóa đối với các khóa cụ thể đó, buộc dịch lại mà không ảnh hưởng đến bất kỳ khóa nào khác.

### Việc dịch nội dung làm hỏng các khối mã (code block)

Điều này không nên xảy ra — các khối mã đã được bảo vệ trước khi dịch. Nếu nó xảy ra:

1. Xác minh khối mã sử dụng ký hiệu bao bọc tiêu chuẩn (ba dấu nháy ngược)
2. Kiểm tra các khối mã chưa được đóng trong Markdown nguồn
3. Gửi một issue — đây là lỗi trong hệ thống bảo vệ bằng lính canh (sentinel shielding system)

## Vấn đề về CLI

### `--watch` không phát hiện thay đổi

Tính năng theo dõi tệp sử dụng `fs.watch` gốc của Node.js. Các vấn đề đã biết:

- **Ổ đĩa mạng** — `fs.watch` hoạt động không ổn định trên các phân vùng gắn kết NFS/SMB
- **Docker volume** — Sử dụng chế độ polling hoặc chạy champollion bên trong container
- **Thư mục lớn** — Trình theo dõi giám sát `localesDir` một cách đệ quy; các cây thư mục quá sâu có thể vượt quá giới hạn của hệ điều hành

### `npx` chạy phiên bản cũ

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

Hoặc cài đặt toàn cục (global):

```bash
npm install -g champollion
champollion sync
```

## Hiệu năng

### Đồng bộ chậm khi có nhiều ngôn ngữ

Theo mặc định, Champollion dịch song song tất cả các locale. Nếu quá trình đồng bộ vẫn chậm:

1. **Sử dụng Google Translate cho các cặp ngôn ngữ có khối lượng lớn** — Nó nhanh hơn từ 10–50 lần so với dịch thuật bằng LLM
2. **Tăng kích thước batch** (mặc định là 80):
   ```json
   { "batchSize": 120 }
   ```
3. **Điều chỉnh mức độ đồng thời (concurrency)** — Mức độ song song của locale JSON mặc định là 200 và nội dung là 48. Nếu nhà cung cấp API của bạn hỗ trợ giới hạn lượt yêu cầu cao hơn:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Sử dụng mô hình nhanh** — `gpt-4o-mini` nhanh hơn đáng kể so với `gpt-4o`

### Chi phí API cao

- **Kiểm tra kích thước batch** — Batch lớn hơn = ít cuộc gọi API hơn = chi phí thấp hơn
- **Sử dụng Bộ nhớ dịch thuật (Translation Memory)** — TM được bật theo mặc định. Chạy `champollion tm stats` để xác minh nó đang hoạt động. Nếu bạn thấy 0 mục sau nhiều lần đồng bộ, có thể có vấn đề với quyền truy cập thư mục `.champollion/` của bạn
- **Sử dụng bộ nhớ đệm prompt (prompt caching)** — Champollion chia nhỏ các tin nhắn hệ thống/người dùng để tối ưu hóa cache hit trên các mô hình Anthropic và Google
- **Sử dụng Google Translate cho các ngôn ngữ Nhóm 2 (Tier 2)** — Xem hướng dẫn [Dịch 30 ngôn ngữ](/docs/tutorials/translate-30-languages)

### Bản dịch cũ (stale) sau khi chuyển đổi nhà cung cấp

Nếu bạn chuyển từ phương thức dịch này sang phương thức dịch khác (ví dụ: từ `llm` sang `deepl`), bộ nhớ đệm TM vẫn có thể cung cấp các bản dịch cũ từ phương thức trước đó cho các khóa có văn bản nguồn không thay đổi. Khóa bộ nhớ đệm (cache key) bao gồm tên phương thức, vì vậy hầu hết các trường hợp đều được xử lý tự động. Nhưng nếu bạn đã thay đổi `model` trong cùng một phương thức:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Xem [Bộ nhớ dịch thuật](/docs/concepts/translation-memory) để biết chi tiết về thiết kế khóa bộ nhớ đệm.

## Khôi phục từ một phiên bản lỗi {#recover-old-damage}

Các giá trị được ghi bởi một pipeline cũ hơn **không bao giờ tự phục hồi**: mã băm (hash) trong manifest của chúng khớp với nguồn hiện tại, vì vậy `sync` coi chúng đã được xử lý xong (settled) và không có cổng (gate) nào kiểm tra lại chúng nữa. Nếu bạn đang nâng cấp một dự án từng chạy các phiên bản trước 0.3.0, hãy giả định rằng có thể có lỗi đang tồn tại trong các tệp locale của bạn và hãy kiểm tra (audit) trước:

```bash
champollion integrity
```

Quá trình kiểm tra sẽ phát hiện các dấu hiệu lỗi đã biết và chỉ ra cách khắc phục cho từng lỗi:

| Phát hiện | Mô tả | Cách khắc phục |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Đầu ra của quá trình chuyển đổi hệ chữ viết (pIqaD/Tengwar/Kryptonian) được ghi lại khi không có yêu cầu chuyển đổi — hiển thị trống | `champollion repair-script` (ngoại tuyến, chính xác cho pIqaD) |
| `HOLLOWED VALUES` | Nguồn bị xóa các chữ cái — đầu ra từ trước khi có cổng bảo toàn nội dung (content-preservation gate) | Dịch lại (xem bên dưới) |
| `NO-TRANSLATE DRIFT` | Một URL hoặc khóa nguyên văn (verbatim key) khác đã bị "dịch" | `champollion sync` (được sửa chữa miễn phí, tự động) |

Đối với các giá trị bị rỗng (hollowed values) — hoặc bất kỳ locale nào mà bạn không còn tin tưởng — hãy xây dựng lại nó:

```bash
champollion sync --pair en:tlh --force
```

`--force` sẽ đưa vào hàng đợi lại (re-queue) mọi khóa nguồn cho (các) cặp ngôn ngữ trong phạm vi. Các kết quả từ Bộ nhớ dịch (Translation Memory) vẫn được sử dụng, nhưng mỗi kết quả được sử dụng sẽ **được xác thực qua các cổng hiện tại trước** — một giá trị được lưu trong bộ nhớ cache mà cổng hiện tại từ chối sẽ bị loại bỏ và tính phí lại (re-billed), nhờ đó một bộ nhớ cache bị lỗi sẽ tự phục hồi thay vì tiếp tục cung cấp dữ liệu cho quá trình xây dựng lại. Thêm `--no-tm` nếu bạn muốn tính phí lại hoàn toàn mới bất kể tình trạng ra sao, và `--max-cost` để giới hạn mức chi tiêu trong cả hai trường hợp.

Quá trình xác minh sau đồng bộ (post-sync verification) cũng báo cáo các dấu hiệu này, vì vậy một locale bị lỗi sẽ làm thất bại `sync` một cách rõ ràng (kèm theo tên cách khắc phục) thay vì được phát hành một cách âm thầm.

### Đưa vào hàng đợi lại một lần sau khi dọn dẹp bằng `--no-tm` {#one-time-requeue}

Nếu quá trình khôi phục của bạn đã sử dụng `--no-tm`, hãy chuẩn bị cho việc lần đồng bộ **tiếp theo** sẽ đưa vào hàng đợi một loạt các khóa lặp lại nguồn (source-echo keys) mà bạn tưởng rằng đã được xử lý xong. `--no-tm` ghi các giá trị mà không đóng dấu (stamping) chúng vào Bộ nhớ dịch, và một giá trị *chưa được đóng dấu* giống hệt với nguồn của nó thì không thể phân biệt được với một giá trị chưa được dịch — vì vậy nó sẽ được đưa vào hàng đợi lại một lần, trả về kết quả (thường là giống hệt), được đóng dấu và xử lý xong vĩnh viễn. Đây là chi phí chỉ tốn một lần, không phải là một vòng lặp. Xem trước chính xác các khóa nào bằng lệnh:

```bash
champollion sync --dry --list-keys
```

## Vẫn gặp khó khăn?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Tìm kiếm các vấn đề hiện có hoặc tạo một issue mới
- **[Tài liệu kiến trúc](/docs/concepts/architecture)** — Hiểu về thiết kế hệ thống
- **[Cổng kiểm soát chất lượng](/docs/concepts/quality-gate)** — Cách thức hoạt động của quá trình xác thực bên dưới hệ thống
