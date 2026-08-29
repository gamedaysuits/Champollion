---
sidebar_position: 3
title: "Cấu hình"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Cấu hình

Champollion hoạt động không cần cấu hình — nó tự động phát hiện các tệp ngôn ngữ (locale), định dạng và ngôn ngữ đích từ dự án của bạn. Để kiểm soát nhiều hơn, hãy tạo `champollion.config.json` trong thư mục gốc của dự án, hoặc chạy:

```bash
npx champollion init
```

## Tài liệu tham khảo cấu hình đầy đủ

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen chưa được triển khai]
Khối cấu hình `typegen` được trình tải cấu hình nhận diện và bảo toàn, nhưng tính năng tạo kiểu TypeScript vẫn chưa được triển khai. Đây là phần giữ chỗ cho một tính năng đã được lên kế hoạch. Việc thiết lập các giá trị này sẽ không có tác dụng.
:::


### Các trường thông tin

| Trường | Loại | Mặc định | Mô tả |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Phiên bản schema cấu hình. Luôn là `3`. |
| `inputLocale` | `string` | `"en"` | Mã ngôn ngữ nguồn (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Đường dẫn đến các tệp locale. Champollion sẽ quét thư mục này. |
| `contentDir` | `string` | `null` | Thư mục nội dung Hugo. Kích hoạt tính năng dịch phần thân Markdown. |
| `translatableFields` | `string[]` | `null` | Ghi đè các trường frontmatter có thể dịch mặc định cho việc dịch nội dung. `null` sử dụng các giá trị mặc định tích hợp sẵn (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Định dạng tệp: `json`, `toml`, `yaml`, hoặc `auto` (phát hiện từ phần mở rộng). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Mô hình mặc định cho các phương thức LLM. Chấp nhận các slug OpenRouter đầy đủ (`provider/model`) hoặc các bí danh ngắn từ `shared/model-aliases.json` (ví dụ: `gemini-flash`). Các nhà cung cấp trực tiếp sử dụng tên trần (ví dụ: `gpt-4o`). |
| `temperature` | `number` | `0.3` | Nhiệt độ LLM (0.0–2.0). Thấp hơn = mang tính xác định (deterministic) cao hơn. |
| `defaultMethod` | `string` | `"llm"` | Phương thức dịch mặc định: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Bị ghi đè bởi cờ CLI `--method`. |
| `batchSize` | `number` | `80` | Số lượng khóa trên mỗi lô dịch. Cao hơn = ít lệnh gọi API hơn, nhưng prompt lớn hơn. |
| `coachingFile` | `string` | `null` | Đường dẫn đến tệp prompt huấn luyện dạng văn bản tự do (tương đối so với thư mục gốc của dự án). Nội dung được đọc lúc khởi động và chèn vào system prompt dưới dạng một khối `Coaching guidance:`. |
| `promptContext` | `string` | `null` | Chuỗi ngữ cảnh ứng dụng được chèn vào system prompt (ví dụ: "Mô tả sản phẩm thương mại điện tử"). Giúp mô hình điều chỉnh các bản dịch phù hợp với lĩnh vực của bạn. |
| `jsonConcurrency` | `number` | `200` | Số lượng bản dịch locale song song tối đa cho việc đồng bộ khóa JSON. Bị ghi đè bởi cờ CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Số lượng lệnh gọi API song song tối đa cho việc dịch nội dung (Markdown/MDX). Bị ghi đè bởi cờ CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Tiền tố đánh dấu được `audit` và `verify` sử dụng để phát hiện các giá trị chưa dịch cũ từ các lần chạy trước. Champollion không ghi tiền tố này — nó chỉ đọc để phát hiện. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Tên biến môi trường cho khóa API. Ghi đè cho các tên biến môi trường tùy chỉnh. |
| `minContentRetention` | `number` | `0.35` | Tỷ lệ chữ cái/chữ số của nguồn mà đầu ra phải giữ lại trước khi [kiểm tra xóa nội dung](/docs/concepts/quality-gate) tham khảo tín hiệu thứ hai của nó. Cũng có thể thiết lập theo từng cặp và từng ngôn ngữ. |
| `noTranslate` | `string[]` | `[]` | Các khóa dạng đường dẫn chấm (dot-path) và các mẫu glob có giá trị được sao chép nguyên văn sang mọi locale. Xem [Các khóa không dịch](#no-translate). Cũng được chấp nhận dưới dạng `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Xử lý các giá trị nguồn chỉ chứa một URL `scheme://` là không dịch. Đặt `false` để gửi các khóa có giá trị URL đến backend dịch thuật. |
| `baseUrl` | `string` | `""` | URL cơ sở cho việc tạo các artifact SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Ghi đè phương thức, mô hình và chất lượng theo từng cặp. Xem [Cấu hình cặp](#pair-configuration). |
| `languages` | `object` | `{}` | Ghi đè theo từng ngôn ngữ. Xem [Cấu hình ngôn ngữ](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Thư mục nguồn cho việc quét lint. `null` = tự động phát hiện từ framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Các mẫu glob để loại trừ khỏi lint. |
| `lint.minLength` | `number` | `2` | Độ dài chuỗi tối thiểu để gắn cờ là hardcode. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Mẫu URL (template) cho việc tạo thẻ hreflang. |
| `seo.pages` | `string[]` | `null` | Danh sách trang rõ ràng cho SEO. `null` = tự động phát hiện từ các khóa locale. |
| `typegen.output` | `string` | `null` | Đường dẫn đầu ra cho các kiểu TypeScript được tạo. `null` = vô hiệu hóa. |
| `typegen.autoGenerate` | `boolean` | `false` | Tự động tạo lại các kiểu sau mỗi lần đồng bộ. |

## Các khóa không dịch {#no-translate}

Một số giá trị chỉ có duy nhất một cách hiển thị chính xác trong mọi ngôn ngữ: một URL, một đường dẫn kho lưu trữ, một tên gói, một định danh sản phẩm. Bản dịch chính xác của `https://example.org/paper` là `https://example.org/paper`.

[Cổng chất lượng](/docs/concepts/quality-gate) của Champollion từ chối source-echo — một bản dịch giống hệt với nguồn của nó — vì đó thường là do mô hình từ chối thực hiện công việc. Đối với các khóa này, điều đó khiến câu trả lời đúng lại bị từ chối, và không có đầu ra nào mà mô hình có thể tạo ra để vượt qua. Các mô hình yếu hơn học cách đánh bại cổng này bằng cách thay đổi giá trị vừa đủ (một `#fragment` được bịa ra, một dấu gạch chéo thừa ở cuối, một khoảng trắng vô hình có độ rộng bằng không), điều này dẫn đến việc xuất bản các liên kết bị hỏng. Các mô hình mạnh hơn trả về giá trị không thay đổi và không vượt qua được cổng, do đó `sync` thoát với mã khác không (non-zero) trong mỗi lần chạy.

Thay vào đó, hãy khai báo các khóa đó:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Một khóa khớp sẽ được **sao chép nguyên văn từ locale nguồn** — không bao giờ được gửi đến backend dịch thuật, không bao giờ bị kiểm tra qua cổng chất lượng, không bao giờ bị tính là lỗi và không bao giờ bị tính phí. Nó cũng được loại trừ khỏi ước tính chi phí trước khi chạy vì lý do tương tự.

### Cú pháp mẫu

Các mẫu là các đường dẫn chấm (dot-paths) trên không gian khóa đã được làm phẳng, với hai ký tự đại diện (wildcard):

| Mẫu | Khớp với | Không khớp với |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (đường dẫn chính xác) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (một nút lá `url` ở bất kỳ độ sâu nào) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` khớp trong phạm vi một phân đoạn duy nhất; `**` khớp với không hoặc nhiều phân đoạn hoàn chỉnh. Một mẫu không có ký tự đại diện là một đường dẫn khóa chính xác.

### Các URL được xử lý theo mặc định

Bởi vì một khóa có giá trị URL không có kết quả chính xác nào khi qua cổng chất lượng, `noTranslateUrls` được đặt là `true` ngay từ đầu: bất kỳ giá trị nguồn nào chỉ chứa một URL `scheme://` tuyệt đối sẽ được coi là không dịch mà không cần cấu hình.

Việc phát hiện được cố tình thu hẹp — toàn bộ giá trị sau khi cắt bỏ khoảng trắng (trimmed) phải là URL. Văn bản chỉ chứa một liên kết (`"Read the paper at https://…"`) vẫn được dịch bình thường.

Hãy tắt tính năng này bằng `"noTranslateUrls": false` nếu các URL của bạn thực sự mang tính đặc thù theo locale (ví dụ: các máy chủ tài liệu theo từng ngôn ngữ) — sau đó khai báo những URL không mang tính đặc thù bằng `noTranslate`.

### Sửa chữa và thực thi

Đối với một khóa không dịch, chỉ có duy nhất một giá trị đích chính xác, vì vậy bất kỳ sự khác biệt nào cũng là một lỗi. Champollion thực thi điều đó theo cả hai hướng:

- **`sync` sửa chữa nó.** Một khóa không dịch có giá trị đích bị thiếu, có tiền tố `[EN] `, hoặc bị thay đổi sẽ được ghi lại từ nguồn. Việc này không tốn lệnh gọi API nào và có tính lũy đẳng (idempotent): một khi các giá trị đã khớp, các lần đồng bộ sau sẽ bỏ qua hoàn toàn khóa này.
- **`verify` và `integrity` sẽ báo lỗi.** Một khóa không dịch bị sai lệch sẽ được báo cáo là `NO-TRANSLATE DRIFT` cùng với các giá trị mong đợi và thực tế — các ký tự vô hình được escape dưới dạng `\uXXXX`, vì loại hỏng hóc này nếu không sẽ không thể nhìn thấy trong một bản diff. `champollion integrity` thoát với mã `1`, do đó một bản build được liên kết với nó sẽ bắt được một URL bị hỏng trước khi xuất bản.

Nếu `integrity` gặp lỗi theo cách này trên một dự án bạn vừa cấu hình, nó đang báo cáo sự hỏng hóc đã có sẵn trong các tệp locale của bạn. Hãy chạy `champollion sync` một lần để sửa chữa nó.

## Chuyển đổi hệ chữ viết {#script-conversion}

Một số ngôn ngữ mà Champollion dịch có thể được *viết* theo nhiều cách. Mô hình luôn hoạt động bằng **hệ chữ viết làm việc** (working script) của ngôn ngữ đó (chữ Latinh hóa — SRO cho tiếng Plains Cree, chữ Latinh hóa Okrand cho tiếng Klingon), và một bộ chuyển đổi mang tính xác định sau đó có thể viết lại đầu ra thành một hệ chữ viết hiển thị (display script). Việc có nên làm như vậy hay không là một quyết định do cấu hình đưa ra — **không bao giờ là mặc định**:

| Locale | Hệ chữ viết làm việc | Có thể chuyển đổi sang | Loại |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Unicode thực — **bắt buộc chọn** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (Cyrillic) | Unicode thực — **bắt buộc chọn** |
| `tlh` (Klingon) | `Latn` (Latinh hóa) | `Piqd` (pIqaD) | PUA — tùy chọn (opt-in) |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — tùy chọn (opt-in) |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — tùy chọn qua `"script": "x-kryptonian"` |

**Các cặp Unicode thực (crk, sr) bắt buộc phải lựa chọn.** Chữ Cree Syllabics và chữ Cyrillic là Unicode thông thường — chúng hiển thị ở mọi nơi — và cả hai hệ thống chính tả đều được sử dụng trong thực tế. Champollion sẽ không thay mặt dự án chọn hệ thống chữ viết của một cộng đồng: `init` sẽ hỏi khi bạn chọn ngôn ngữ, và `sync` từ chối chạy cho đến khi cấu hình chỉ định rõ:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Các hệ chữ viết PUA (tlh, x-elvish-s, x-kryptonian) mặc định là chữ Latinh hóa.** pIqaD, Tengwar và Kryptonian *không có trong Unicode* — các bộ chuyển đổi phát ra các điểm mã Private Use Area (Vùng sử dụng riêng) sẽ không hiển thị gì cả trừ khi bạn cung cấp một phông chữ được ánh xạ tới các điểm mã đó. Chữ Latinh hóa là đầu ra duy nhất hiển thị ở mọi nơi, vì vậy nó là mặc định. Để phát ra hệ chữ viết hiển thị thay thế:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…và chạy `champollion fonts install` để trang web của bạn có một phông chữ có thể vẽ nó. Nếu các phông chữ của bạn được liên kết với chuyển tự Latinh (nhiều phông chữ ngôn ngữ nhân tạo - conlang - là như vậy), hãy giữ nguyên mặc định.

`script` nhận một mã ISO 15924, không phân biệt chữ hoa chữ thường (`"cans"`, `"Cans"` và `"CANS"` là như nhau). Nó cũng có thể được thiết lập theo từng cặp, và sẽ ưu tiên hơn so với cấp độ ngôn ngữ. Một giá trị không hợp lệ, hoặc một hệ chữ viết mà locale không thể tạo ra, sẽ gây lỗi lúc khởi động — trước bất kỳ lệnh gọi API nào.

### Các chữ cái không được ánh xạ và `scriptFallback` {#script-fallback}

Các bộ chuyển đổi chỉ dịch những gì hệ thống chính tả của chúng định nghĩa và không gì khác. Chữ Latinh hóa của tiếng Klingon không có `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` hoặc `z` — vì vậy đầu ra của mô hình chứa một danh từ riêng như "GitHub" không thể chuyển đổi hoàn toàn. Champollion **không bao giờ ghi một giá trị chỉ được chuyển đổi một nửa**: nếu bất kỳ chữ cái nào không thể ánh xạ, toàn bộ giá trị sẽ giữ nguyên ở hệ chữ viết làm việc, và cảnh báo sẽ nêu tên các chữ cái cộng với dòng cấu hình có thể ánh xạ chúng.

Những ánh xạ đó là do bạn khai báo:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Mỗi quy tắc thay thế một chuỗi hệ chữ viết làm việc bằng một chuỗi mà bộ chuyển đổi *có thể* ánh xạ, trước khi quá trình chuyển đổi chạy. Các quy tắc được xác thực lúc khởi động — một sự thay thế mà bản thân nó không thể ánh xạ sẽ bị từ chối.

Champollion **không đi kèm bất kỳ quy tắc dự phòng (fallback) nào của riêng nó**: việc phát minh ra các bản chuyển thể chính tả, đặc biệt là đối với hệ thống chữ viết của một ngôn ngữ thực, không phải là quyết định của một công cụ. Các cộng đồng và fandom có những quy ước riêng — hãy áp dụng chúng một cách có chủ đích, theo từng dự án.

### Sửa chữa việc chuyển đổi không mong muốn {#repair-script}

Trước phiên bản 0.3.0, việc chuyển đổi là vô điều kiện — các dự án nhắm mục tiêu đến các locale PUA nhận được đầu ra không thể hiển thị dù họ có muốn hay không. Hai công cụ sau đây sẽ giải quyết vấn đề này:

- **`champollion repair-script`** quét các locale có cấu hình *tắt* chuyển đổi đối với các điểm mã PUA và khôi phục chữ Latinh hóa bằng cách sử dụng bảng đảo ngược của chính bộ chuyển đổi (dùng `--dry` để xem trước). pIqaD đảo ngược chính xác; các đảo ngược của Tengwar và Kryptonian sẽ mất viết hoa và có thông báo về điều đó.
- **`champollion integrity`** báo lỗi (thoát với mã 1) khi tìm thấy PUA ở nơi chuyển đổi bị tắt — do đó một cổng build sẽ bắt được văn bản không thể hiển thị trước khi nó được xuất bản, và báo cáo sẽ nêu tên cách sửa chữa.

Bộ nhớ dịch thuật (Translation Memory) không bao giờ cần sửa chữa: nó lưu trữ các giá trị trước khi chuyển đổi, vì vậy việc bật hoặc tắt `script:` sau này không yêu cầu xử lý bộ nhớ cache.

Việc chuyển đổi hệ chữ viết áp dụng cho các chuỗi UI (các tệp key-value và Docusaurus JSON). Phần thân Markdown không bao giờ được chuyển đổi — một bộ chuyển đổi ký tự tham lam (greedy) không có cách nào an toàn để đi qua các đoạn mã (code spans), URL và front matter.

## Cấu hình cặp {#pair-configuration}

Mỗi cặp nguồn→đích có thể được cấu hình độc lập:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Các trường của cặp

| Trường | Kiểu | Mô tả |
|-------|------|-------------|
| `method` | `string` | Phương thức dịch: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Tên của một plugin đã cài đặt (từ `.champollion/methods/`) |
| `model` | `string` | Ghi đè mô hình mặc định cho cặp này |
| `temperature` | `number` | Ghi đè nhiệt độ mặc định cho cặp này |
| `batchSize` | `number` | Ghi đè kích thước loạt (batch size) mặc định cho cặp này |
| `register` | `string` | Ghi đè văn phong/giọng điệu (khóa preset hoặc văn bản tự do) |
| `endpoint` | `string` | URL điểm cuối API từ xa. Bắt buộc khi `method` là `api`. |
| `coachingFile` | `string` | Đường dẫn đến tệp prompt huấn luyện cho cặp này |
| `promptContext` | `string` | Ngữ cảnh ứng dụng cho cặp này |
| `qualityTier` | `string` | Cấp độ hiển thị: `standard`, `high`, `research`, `verified` |

## Cấu hình ngôn ngữ {#language-configuration}

Ngôn ngữ chấp nhận ba định dạng:

### Mảng các mã ngôn ngữ (đơn giản nhất)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Mỗi ngôn ngữ sẽ nhận văn phong mặc định từ bảng văn phong tích hợp sẵn. Các ngôn ngữ không có mặc định sẽ nhận `"Professional register."`.

### Đối tượng với các chuỗi văn phong

Giá trị có thể là một **khóa preset** từ thẻ của ngôn ngữ, hoặc văn bản văn phong tùy chỉnh:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion kiểm tra xem chuỗi có khớp với khóa preset trong thẻ ngôn ngữ hay không. Nếu có, prompt văn phong đầy đủ từ thẻ sẽ được sử dụng. Nếu không, chuỗi sẽ được sử dụng nguyên trạng. Xem [Ngôn ngữ được hỗ trợ](/docs/reference/supported-languages#language-cards) để biết các preset có sẵn.

### Đối tượng với cấu hình đầy đủ

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

Bạn có thể kết hợp cú pháp viết tắt và đối tượng đầy đủ trong cùng một khối.


### Các trường của ngôn ngữ

| Trường | Loại | Mô tả |
|-------|------|-------------|
| `register` | `string` | Hướng dẫn về văn phong/giọng điệu. Có thể là một **khóa cài đặt sẵn** (ví dụ: `casual-tu`, `formal-hapsyo`) hoặc văn bản tùy chỉnh. Xem [Thẻ ngôn ngữ](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Tên ngôn ngữ con người có thể đọc được (để hiển thị trạng thái) |
| `model` | `string` | Ghi đè mô hình mặc định |
| `temperature` | `number` | Ghi đè nhiệt độ mặc định |
| `batchSize` | `number` | Ghi đè kích thước lô mặc định |
| `coachingFile` | `string` | Đường dẫn đến tệp prompt huấn luyện cho ngôn ngữ này |
| `promptContext` | `string` | Ngữ cảnh ứng dụng cho ngôn ngữ này |
| `maxRetries` | `number` | Ngân sách thử lại tối đa cho các lô bị lỗi (mặc định: 3) |
| `script` | `string` | Mã ISO 15924 của hệ thống chính tả mà Champollion viết (ví dụ: `"Cans"`, `"Piqd"`). Xem [Chuyển đổi hệ chữ viết](#script-conversion). |
| `scriptFallback` | `object` | Các quy tắc chuyển tự cho các chữ cái mà bộ chuyển đổi hệ chữ viết không thể ánh xạ. Xem [Chuyển đổi hệ chữ viết](#script-conversion). |

:::info[Chuỗi kế thừa]
Các thiết lập được giải quyết theo thứ tự sau (ưu tiên cái đầu tiên):
:::

**cấp độ cặp (pair-level)** → **cấp độ ngôn ngữ (language-level)** → **cấu hình toàn cục (global config)** → **mặc định (defaults)**

Ví dụ, nếu `pairs["en:fr"]` thiết lập `model`, nó sẽ ghi đè cả giá trị ở cấp độ ngôn ngữ và giá trị toàn cục của `model`.

## Nguồn không phải tiếng Anh

Nếu ngôn ngữ nguồn của bạn không phải là tiếng Anh:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Tệp Lock

Champollion tạo ra `.champollion.lock` để theo dõi các mã băm SHA-256 của các giá trị nguồn đã dịch. **Hãy commit tệp này** để tất cả các nhà phát triển chia sẻ cùng một mốc dịch cơ sở.

Khi một giá trị nguồn thay đổi, mã băm sẽ không còn khớp nữa, và champollion sẽ dịch lại khóa đó trong lần đồng bộ tiếp theo.

## `.champollionignore`

Tạo `.champollionignore` trong thư mục gốc của dự án để loại trừ các tệp khỏi quá trình quét của `lint`. Sử dụng các mẫu glob, như `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Thư mục `.champollion/`

Champollion tạo một thư mục `.champollion/` trong thư mục gốc của dự án cho trạng thái nội bộ. Nhìn chung, bạn nên **thêm thư mục này vào `.gitignore`** — đây là phần tối ưu hóa cục bộ, không phải mã nguồn của dự án:

```gitignore
.champollion/
```

| Tệp | Mục đích | Commit? |
|------|---------|--------|
| `tm.json` | Bộ nhớ đệm Translation Memory — lưu trữ các bản dịch trước đó được định danh bằng văn bản nguồn + ngôn ngữ + phương thức | Không (bộ nhớ đệm cục bộ) |
| `xliff/*.xliff` | Các tệp xuất XLIFF để biên dịch viên chuyên nghiệp xem xét | Không (tạm thời) |
| `methods/` | Manifest của các plugin phương thức đã cài đặt | Có (cấu hình chia sẻ) |
| `backups/` | Các bản sao lưu trước khi bọc (được tạo bởi `wrap --undo`) | Không (mạng lưới an toàn) |

Xem [Translation Memory](/docs/concepts/translation-memory) để biết chi tiết về `tm.json` và cách nó giúp tiết kiệm chi phí API.

---

## API lập trình

Đối với các tập lệnh build và tích hợp tùy chỉnh, hãy import trực tiếp từ package:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Các Export có sẵn

| Export | Chức năng |
|--------|-------------|
| `TranslationMethod` | Lớp cơ sở cho tất cả các phương thức |
| `LLMMethod` | Lớp cơ sở cho các phương thức LLM (OpenRouter) |
| `DirectLLMMethod` | Lớp cơ sở cho các nhà cung cấp LLM trực tiếp (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Các lớp nhà cung cấp LLM trực tiếp |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Các lớp dịch máy (MT) truyền thống |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM có huấn luyện (OpenRouter + dữ liệu huấn luyện) |
| `APIMethod` | Client API từ xa |
| `runSync`, `runContentSync` | Pipeline đồng bộ hóa đầy đủ |
| `resolveConfig`, `resolvePairs` | Phân giải cấu hình |
| `validateTranslations` | Cổng kiểm soát chất lượng (quality gate) |
| `loadCoachingData`, `findDictionaryMatches` | Các tiện ích huấn luyện |

### Mở rộng nhà cung cấp tùy chỉnh

Kế thừa `DirectLLMMethod` để thêm một nhà cung cấp LLM mới trong khoảng 40 dòng mã:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

Bạn sẽ nhận được các tính năng dịch, huấn luyện, vòng lặp thử lại, xác thực mô hình, các cấp độ chất lượng và hỗ trợ thiết lập hoàn toàn miễn phí. Chỉ có cấu trúc yêu cầu HTTP là đặc thù của từng nhà cung cấp. Đối với các adapter không phải LLM sử dụng `fetch()` thô, hãy sử dụng helper chia sẻ `fetchWithRetry()` từ `lib/methods/fetch-with-retry.js` thay vì tự viết vòng lặp thử lại của riêng bạn.

---

## Xem thêm

- [Tài liệu tham khảo CLI](/docs/reference/cli) — tất cả các lệnh và cờ
- [Phương thức dịch](/docs/guides/translation-methods) — lựa chọn và kết hợp các phương thức
- [Translation Memory](/docs/concepts/translation-memory) — lưu bộ nhớ đệm và tiết kiệm chi phí
- [Làm việc với biên dịch viên chuyên nghiệp](/docs/guides/professional-translators) — quy trình làm việc với XLIFF
- [Đặc tả Plugin](/docs/reference/plugin-spec) — định dạng manifest của plugin phương thức
- [Kiến trúc](/docs/concepts/architecture) — cách các thành phần kết nối với nhau
- [Ngôn ngữ được hỗ trợ](/docs/reference/supported-languages) — hỗ trợ ngôn ngữ tích hợp sẵn
- [Cách hoạt động của đồng bộ hóa](/docs/concepts/how-sync-works) — pipeline dịch thuật
