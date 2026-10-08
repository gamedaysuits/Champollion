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

1. **Giảm kích thước batch** trong cấu hình của bạn:
   ```json
   { "batchSize": 15 }
   ```
2. **Sử dụng mô hình có giới hạn tốc độ cao hơn** (ví dụ: `google/gemini-3.8-flash` có giới hạn rất thoải mái)
3. **Sử dụng phương thức rẻ hơn/nhanh hơn** cho các cặp ngôn ngữ có khối lượng lớn — Google Translate không có giới hạn tốc độ:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Không tìm thấy mô hình / Lỗi 404

Các nhà cung cấp LLM trực tiếp (`openai`, `anthropic`, `gemini`) sẽ nhận tên mô hình theo quy chuẩn riêng của họ. Một ID theo định dạng OpenRouter từ chính nhà cung cấp của họ sẽ được tự động ánh xạ cho bạn (`google/gemini-3.8-flash` → `gemini-3.8-flash` trên `gemini`). Nếu lượt chạy dừng lại với thông báo:

**"is an OpenRouter model id … which has no model by that name"** — Bạn đang sử dụng mô hình theo định dạng OpenRouter từ một nhà cung cấp khác (`google/gemini-3.8-flash` với `openai`). Không có dữ liệu nào được gửi đi. Hãy đặt tên một mô hình của nhà cung cấp đó, sử dụng phương thức hỗ trợ mô hình này, hoặc chuyển sang phương thức `llm` để dùng OpenRouter — thông báo sẽ chỉ rõ từng mục và nơi mô hình được thiết lập:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

Họ cũng kiểm tra tên mô hình của bạn trong lần sử dụng đầu tiên. Nếu bạn thấy một cảnh báo:

**"is an Anthropic/OpenAI/Gemini model"** — Bạn đang gửi một mô hình đến sai nhà cung cấp:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — Mô hình có thể đã bị ngừng hỗ trợ hoặc viết sai chính tả. Champollion sẽ lấy danh sách mô hình thực tế của nhà cung cấp và gợi ý các lựa chọn thay thế. Hãy kiểm tra tài liệu của nhà cung cấp để biết tên mô hình hiện tại.

:::tip[Mô hình có thể bị ngừng hoạt động]
Các nhà cung cấp dịch vụ thường xuyên ngừng hỗ trợ các tên mô hình cũ. Nếu quá trình dịch đột ngột thất bại sau khi nhà cung cấp cập nhật, hãy kiểm tra đầu ra của `[WARN]` — nó sẽ hiển thị cho bạn các lựa chọn thay thế hiện tại.
:::

### `local`: "could not reach …"

Phương thức `local` gửi các yêu cầu đến một máy chủ tương thích với OpenAI trên máy của bạn (Ollama, vLLM, LM Studio, llama.cpp). Khi không thể kết nối, lỗi sẽ nêu rõ địa chỉ đã thử kết nối và thiết lập đã chọn địa chỉ đó:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

Địa chỉ được lấy từ thiết lập đầu tiên có giá trị trong số các mục sau, trong môi trường hoặc trong `.env.local` / `.env`: `LOCAL_API_BASE`, sau đó đến `OPENAI_API_BASE`, rồi đến `OPENAI_BASE_URL`. Nếu không có mục nào được thiết lập, giá trị mặc định của Ollama sẽ được dùng: `http://localhost:11434/v1`. Hãy khởi động máy chủ hoặc sửa lại thiết lập được nêu trong thông báo.

## Chất lượng dịch thuật

### Bản dịch lặp lại ngôn ngữ nguồn

Cổng kiểm soát chất lượng (quality gate) sẽ phát hiện điều này. Nếu bản dịch giống hệt với nguồn tiếng Anh, nó sẽ bị từ chối và thử lại. Nếu tình trạng này vẫn tiếp diễn:

1. **Kiểm tra mô hình** — Một số mô hình hoạt động kém đối với các cặp ngôn ngữ cụ thể
2. **Thêm hướng dẫn về văn phong (register)** — Cho mô hình biết ngôn ngữ cần tạo ra:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Thử một mô hình khác** — Chuyển từ `gpt-4o-mini` sang `gpt-4o` hoặc `google/gemini-3.1-pro-preview`

### Đầu ra sai hệ chữ viết (ví dụ: chữ Latin cho tiếng Nhật)

Trình kiểm tra tính tuân thủ hệ chữ viết của cổng kiểm soát chất lượng sẽ phát hiện hầu hết các trường hợp này. Nếu nó vẫn tiếp diễn:

- Xác minh mã locale là chính xác (`ja`, chứ không phải `jp`)
- Thêm hướng dẫn rõ ràng về hệ chữ viết trong trường `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Tên riêng không qua được bước xác minh (ví dụ: "Curtis Forbes" trong tiếng Nhật)

Tên riêng viết bằng chữ Latin là chính xác, vì vậy hãy cho Champollion biết tên riêng của bạn là gì:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

Mô hình được chỉ dẫn giữ nguyên các tên này như văn bản gốc, và một giá trị chỉ bao gồm các tên này sẽ không bao giờ bị báo cáo là chưa dịch hoặc sai hệ chữ viết. Nếu không có danh sách này, một giá trị chữ Latin ngắn trong một ngôn ngữ không dùng chữ Latin sẽ được thử lại một lần để hỏi xem đó là tên riêng hay nhãn. Nếu mô hình giữ nguyên giá trị đó, nó sẽ được chấp nhận là tên riêng và được lưu vào bộ nhớ đệm (cache), do đó không bao giờ bị tính phí lại. Bạn không cần dùng `--no-verify`.

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

`.champollion.lock` ghi lại văn bản tiếng Anh gốc của từng bản dịch. Hãy giải quyết xung đột khi merge (merge conflict) trong tệp này như với bất kỳ tệp được tạo tự động nào: giữ lại một trong hai bên, chạy `npx champollion sync`, và commit kết quả.

:::warning[Xóa tệp lock không dịch lại bất kỳ nội dung nào]
Nếu không có tệp lock, sync không thể biết chuỗi tiếng Anh nào đã thay đổi kể từ khi các bản dịch hiện có được tạo ra. Nó chỉ dịch các khóa **bị thiếu** trong tệp đích, và ghi lại văn bản tiếng Anh hiện tại làm mốc tham chiếu mới. Một chuỗi tiếng Anh được chỉnh sửa trước khi tệp lock bị xóa sẽ giữ nguyên bản dịch cũ trong âm thầm. Để chủ động dựng lại một locale, hãy sử dụng `--force` (giới hạn phạm vi bằng `--pair`); các bản dịch đã lưu trong bộ nhớ đệm sẽ được tái sử dụng, do đó bạn chỉ bị tính phí cho những văn bản mà bộ nhớ đệm chưa từng gặp.
:::

### Dịch lại các khóa cụ thể

Nếu các bản dịch riêng lẻ bị sai và bạn muốn buộc dịch lại chúng mà không cần xóa tệp khóa:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Cờ `--force-keys` ghi đè việc kiểm tra hash của tệp lock cho các khóa cụ thể đó, buộc dịch lại mà không ảnh hưởng đến bất kỳ khóa nào khác. `--redo keys:hero.title` cũng chính là cờ này nhưng dưới tên gọi mới hơn. Cả hai đều được lấy từ Translation Memory khi bộ nhớ này chứa văn bản đó; hãy thêm `--fresh` để trả phí cho một bản dịch hoàn toàn mới thay vào đó. Khóa có chứa dấu phẩy (như gettext msgid là cả một câu) được viết với `\,`, và đối số được đặt trong dấu ngoặc kép cho shell: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` báo cáo placeholder không khớp (hoặc một giá trị bị hỏng khác)

`champollion verify` (và bước kiểm tra chạy sau mỗi lần sync) sẽ báo cáo các giá trị bị hỏng: placeholder bị mất hoặc bị đổi tên, dạng số nhiều ICU bị lỗi, hoặc một giá trị bị xóa mất các ký tự chữ cái. Lệnh `champollion sync` thông thường **không** sửa các lỗi này. Giá trị đó đã tồn tại trên đĩa và mục trong tệp lock cho biết nó đã được cập nhật mới nhất, do đó sync sẽ bỏ qua nó.

Mỗi phát hiện sẽ nêu rõ lệnh để sửa chính xác các khóa đó, ví dụ:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Hãy chạy lệnh đó. Khi một locale trải rộng trên nhiều tệp, các khóa sẽ được viết dưới dạng `<file>::<key>` (ví dụ `common::nav.home`), lệnh này sẽ chỉ dịch lại khóa của tệp đó và không ảnh hưởng đến tệp nào khác.

Bạn không cần dùng `--fresh`. Nếu giá trị bị hỏng bắt nguồn từ Translation Memory, `verify` đã xóa nó khỏi bộ nhớ đệm và hiển thị thông báo: `[TM] Evicted 1 cached translation(s) that produced damaged values`. Thao tác thực hiện lại sau đó sẽ dịch lại văn bản (hoặc cung cấp một bản dịch khác của chính bộ nhớ đệm cho văn bản đó) thay vì trả lại giá trị bị hỏng. Giá trị do ai đó chỉnh sửa thủ công không bao giờ được lưu vào bộ nhớ đệm, vì vậy sẽ không có gì bị xóa đối với giá trị đó, và thao tác làm lại cũng hoạt động tương tự.

Đối với các tệp nội dung Markdown/MDX, thay vào đó hãy sử dụng `--retranslate` cùng với một đường dẫn hoặc mẫu glob (ví dụ: `--retranslate docs/intro.md`). Tùy chọn này sẽ dịch mới lại các tệp đó ngay cả khi chúng đã cập nhật hoặc từng được dịch thủ công. Sử dụng `--files` để giới hạn lượt chạy cho một số tệp nội dung nhất định mà không ép buộc dịch lại.

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

### Bản dịch sau khi chuyển đổi mô hình hoặc nhà cung cấp

Việc chuyển đổi phương thức (ví dụ: `llm` sang `deepl`), văn phong (register) hoặc coaching sẽ tạo ra các bản dịch mới cho những nội dung được dịch lại, vì cache key bao gồm cả các yếu tố này — nhưng một lệnh sync thông thường sẽ không dịch lại những gì đã hoàn thành: `champollion sync --redo all` mới làm điều đó. Việc chuyển đổi **mô hình** trong cùng một phương thức sẽ tái sử dụng những gì mô hình trước đó đã dịch mà không tốn chi phí; sync sẽ thông báo điều này trước khi ước tính chi phí. Nếu bạn muốn có bản dịch riêng của mô hình mới:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

Chỉ riêng `--fresh-on-model-change` thì chỉ thay đổi các khóa mà lượt chạy vốn dĩ sẽ dịch (các khóa mới hoặc đã thay đổi): sau khi chỉ chuyển đổi mô hình, một lệnh `sync --fresh-on-model-change` thông thường sẽ không gửi bất kỳ yêu cầu nào.

Xem [Bộ nhớ dịch thuật](/docs/concepts/translation-memory) để biết chi tiết về thiết kế khóa bộ nhớ đệm.

## Khôi phục từ một phiên bản lỗi {#recover-old-damage}

Các giá trị được ghi bởi pipeline cũ hơn **không bao giờ tự sửa lành**: mã hash manifest của chúng khớp với nguồn hiện tại, nên `sync` coi chúng là đã hoàn tất và không có gate kiểm tra nào xử lý lại chúng nữa. Nếu bạn đang nâng cấp một dự án từng chạy các phiên bản trước 0.3.0, hãy giả định rằng lỗi có thể đang nằm trong các tệp locale của bạn và tiến hành kiểm tra (audit) trước:

```bash
champollion integrity
```

Quá trình audit phát hiện các dấu hiệu hư hại đã biết và nêu rõ cách khắc phục cho từng trường hợp:

| Phát hiện | Ý nghĩa | Cách khắc phục |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Đầu ra chuyển đổi hệ chữ viết (pIqaD/Tengwar/Kryptonian) được ghi lại khi không yêu cầu chuyển đổi — hiển thị khoảng trắng | `champollion repair-script` (ngoại tuyến, chính xác cho pIqaD) |
| `HOLLOWED VALUES` | Chuỗi nguồn bị xóa mất các ký tự chữ cái — kết quả từ trước khi có gate bảo toàn nội dung | Dịch lại (xem bên dưới) |
| `NO-TRANSLATE DRIFT` | URL hoặc khóa nguyên văn khác đã bị "dịch" | `champollion sync` (được sửa tự động, miễn phí) |

Đối với các giá trị bị rỗng ruột (hollowed values) — hoặc bất kỳ locale nào bạn cảm thấy không còn tin cậy nữa — hãy dựng lại locale đó:

```bash
champollion sync --pair en:tlh --force
```

`--force` đưa lại mọi khóa nguồn vào hàng đợi cho (các) cặp ngôn ngữ trong phạm vi. Các kết quả khớp từ Translation Memory vẫn được cung cấp, nhưng mọi kết quả được phục vụ đều **được xác thực qua các gate hiện tại trước** — một giá trị trong bộ nhớ đệm bị gate từ chối sẽ bị loại bỏ và tính phí lại, nhờ đó bộ nhớ đệm bị nhiễm độc sẽ tự sửa lành thay vì làm hỏng quá trình dựng lại. Hãy thêm `--no-tm` nếu bạn muốn dịch mới hoàn toàn và chịu phí lại bất kể thế nào, và thêm `--max-cost` để giới hạn mức chi phí cho cả hai trường hợp.

Xác minh sau khi sync cũng báo cáo các dấu hiệu hư hại này, nhờ đó locale bị hỏng sẽ khiến `sync` thất bại rõ ràng (kèm theo cách khắc phục được nêu rõ) thay vì âm thầm đưa vào phát hành.

### Đưa vào hàng đợi lại một lần sau khi dọn dẹp bằng `--no-tm` {#one-time-requeue}

Nếu quá trình khôi phục của bạn đã sử dụng `--no-tm`, hãy chuẩn bị cho việc lần sync **kế tiếp** sẽ đưa vào hàng đợi một loạt các khóa lặp lại nguồn (source-echo) mà bạn ngỡ là đã ổn định. `--no-tm` ghi các giá trị mà không đóng dấu chúng vào Translation Memory, và một giá trị *chưa đóng dấu* giống hệt chuỗi nguồn thì không thể phân biệt được với một giá trị chưa dịch — vì vậy nó sẽ được đưa vào hàng đợi một lần, trả về kết quả (thường giống hệt), được đóng dấu và ổn định vĩnh viễn. Đây là chi phí phát sinh một lần, không phải vòng lặp vô tận. Bạn có thể xem trước chính xác những khóa nào bằng lệnh:

```bash
champollion sync --dry --list-keys
```

## Vẫn gặp khó khăn?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Tìm kiếm các vấn đề hiện có hoặc tạo một issue mới
- **[Tài liệu kiến trúc](/docs/concepts/architecture)** — Hiểu về thiết kế hệ thống
- **[Cổng kiểm soát chất lượng](/docs/concepts/quality-gate)** — Cách thức hoạt động của quá trình xác thực bên dưới hệ thống
