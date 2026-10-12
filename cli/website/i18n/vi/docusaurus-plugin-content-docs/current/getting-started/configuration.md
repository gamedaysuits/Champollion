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
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
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

| Trường | Kiểu | Mặc định | Mô tả |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Phiên bản schema cấu hình. Luôn là `3`. |
| `inputLocale` | `string` | `"en"` | Mã ngôn ngữ nguồn (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Đường dẫn đến các tệp locale. Chứa một tệp cho mỗi ngôn ngữ (`fr.json`) hoặc một thư mục cho mỗi ngôn ngữ (`fr/common.json`). Xem [Bố cục tệp locale](#locale-layouts). |
| `localesPattern` | `string` | `null` | Nơi lưu các tệp của mọi ngôn ngữ khi cả hai cấu trúc trên đều không phù hợp, với `{lang}` và `{ns}` tùy chọn: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Tương đối với thư mục gốc của dự án. Thay thế `localesDir`. Xem [Bố cục tệp locale](#locale-layouts). |
| `localesLayout` | `string` | `null` | Ghi đè tự động phát hiện bố cục: `"flat"` (một tệp cho mỗi ngôn ngữ) hoặc `"dir"` (một thư mục cho mỗi ngôn ngữ). Chỉ cần thiết khi cả `en.json` và `en/` đều tồn tại. |
| `defaultNamespace` | `string` | `null` | Trong một dự án có một thư mục cho mỗi ngôn ngữ với nhiều tệp, tệp mà `champollion wrap` sẽ thêm các khóa mới vào (ví dụ: `"common"`). |
| `contentDir` | `string` | `null` | Một thư mục chứa Markdown/MDX cần dịch: thư mục `content/` của Hugo hoặc bất kỳ thư mục nào khác, chẳng hạn như `./newsletters` trong ứng dụng Next.js. Mỗi bản dịch được ghi bên cạnh tệp nguồn của nó dưới dạng `<name>.<locale>.md`, ví dụ: `2026-10.md` → `2026-10.crk.md`. Các tệp đã được đặt tên `<name>.<code>.md` được coi là bản dịch, không phải tệp nguồn. Xem [Dịch nội dung](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Ghi đè các trường frontmatter có thể dịch mặc định cho việc dịch nội dung. `null` sử dụng các giá trị mặc định tích hợp sẵn (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Định dạng tệp: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)), hoặc `auto` (tự động phát hiện từ phần mở rộng của tệp nguồn; `.yml` được tính là YAML và các đích giữ nguyên `.yml`). Bất kỳ giá trị nào khác sẽ dừng lại với lỗi. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Mô hình mặc định cho các phương thức LLM. Một slug mô hình chính xác: slug OpenRouter đầy đủ (`provider/model`). Các bí danh ngắn (`gemini-flash`) và ID linh động (`~vendor/…`, `…-latest`) sẽ bị từ chối, nêu rõ slug cần ghi. Các nhà cung cấp trực tiếp sử dụng tên trần (ví dụ: `gpt-4o`); một slug OpenRouter của chính nhà cung cấp của họ sẽ được ánh xạ tới nó (`openai/gpt-4o` → `gpt-4o`), và slug mà họ không có mô hình tương ứng sẽ dừng lượt chạy trước khi bất kỳ thứ gì được gửi đi ([Tên mô hình](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | Nhiệt độ (temperature) của LLM (0.0–2.0). Càng thấp = càng có tính xác định hơn. |
| `defaultMethod` | `string` | `"llm"` | Phương thức dịch mặc định: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` là một máy chủ tương thích OpenAI trên máy của bạn (mặc định là Ollama). Bị ghi đè bởi cờ CLI `--method`. |
| `batchSize` | `number` | `80` | Số khóa trên mỗi lượt dịch (batch). Cao hơn = ít lệnh gọi API hơn, nhưng prompt lớn hơn. |
| `coachingFile` | `string` | `null` | Đường dẫn đến tệp prompt hướng dẫn (coaching) văn bản tự do (tương đối với thư mục gốc của dự án). Nội dung được đọc khi khởi động và được chèn vào system prompt dưới dạng một khối `Coaching guidance:`. |
| `promptContext` | `string` | `null` | Chuỗi ngữ cảnh ứng dụng được chèn vào system prompt (ví dụ: "E-commerce product descriptions"). Giúp mô hình điều chỉnh bản dịch cho phù hợp với lĩnh vực của bạn. |
| `genderGuidance` | `string` \| `false` | `null` | Cách prompt LLM xử lý giống ngữ pháp (grammatical gender). `null` giữ mặc định của từng ngôn ngữ từ danh mục của Champollion — đối với tiếng Pháp, *écriture inclusive* với dấu chấm giữa (`Connecté·e`, `Utilisateur·rice·s`); đối với tiếng Đức, dạng dấu hai chấm (`Benutzer:innen`). `false` không gửi hướng dẫn nào về giống; một chuỗi sẽ gửi hướng dẫn riêng của bạn (ví dụ: `"Use the masculine generic."`). Cũng có thể thiết lập theo từng ngôn ngữ và từng cặp. Xem [Hướng dẫn về giống](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Tên cần giữ nguyên văn bằng mọi ngôn ngữ: con người, công ty, sản phẩm (ví dụ: `["Curtis Forbes", "Game Day Suits"]`). Mô hình được hướng dẫn giữ nguyên chúng, và giá trị chỉ bao gồm các tên này không bao giờ bị gắn cờ là chưa dịch hoặc sai chữ viết. Điều này khác với `noTranslate`, vốn bỏ qua toàn bộ **khóa**. |
| `jsonConcurrency` | `number` | `200` | Số lượng bản dịch locale song song tối đa cho đồng bộ khóa JSON. Bị ghi đè bởi cờ CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Số lượng lệnh gọi API song song tối đa cho việc dịch nội dung (Markdown/MDX). Bị ghi đè bởi cờ CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Tiền tố đánh dấu được sử dụng bởi `audit` và `verify` để phát hiện các giá trị chưa dịch cũ từ các lần chạy trước. Champollion không ghi tiền tố này — nó chỉ đọc nó để phát hiện. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Tên biến môi trường cho API key. Ghi đè đối với các tên biến môi trường tùy chỉnh. |
| `minContentRetention` | `number` | `0.35` | Tỷ lệ chữ cái/chữ số của nguồn mà đầu ra phải giữ lại trước khi [kiểm tra xóa nội dung](/docs/concepts/quality-gate) tham vấn tín hiệu thứ hai của nó. Cũng có thể thiết lập theo từng cặp và từng ngôn ngữ. |
| `noTranslate` | `string[]` | `[]` | Các khóa dạng đường dẫn chấm (dot-path) và mẫu glob có giá trị được sao chép nguyên văn sang mọi locale. Xem [Các khóa không dịch](#no-translate). Cũng được chấp nhận dưới dạng `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Coi các giá trị nguồn chỉ là URL `scheme://` là không dịch. Đặt thành `false` để gửi các khóa có giá trị là URL đến backend dịch thuật. |
| `baseUrl` | `string` | `""` | URL cơ sở để tạo các phần tử SEO (hreflang, sitemap, JSON-LD). |
| `pairs` | `object` | `{}` | Ghi đè phương thức, mô hình và chất lượng theo từng cặp. Xem [Cấu hình cặp](#pair-configuration). |
| `languages` | `object` | `{}` | Ghi đè theo từng ngôn ngữ. Xem [Cấu hình ngôn ngữ](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Thư mục nguồn để quét lint. `null` = tự động phát hiện từ framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Các mẫu glob cần loại trừ khỏi lint. |
| `lint.minLength` | `number` | `2` | Độ dài chuỗi tối thiểu để gắn cờ là hardcode. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Mẫu URL pattern để tạo thẻ hreflang. |
| `seo.pages` | `string[]` | `null` | Danh sách trang rõ ràng cho SEO. `null` = tự động phát hiện từ các khóa locale. |
| `typegen.output` | `string` | `null` | Đường dẫn đầu ra cho các kiểu TypeScript được tạo. `null` = vô hiệu hóa. |
| `typegen.autoGenerate` | `boolean` | `false` | Tự động tạo lại kiểu sau mỗi lần đồng bộ. |

## Bố cục tệp locale {#locale-layouts}

Champollion đọc các tệp locale của bạn tại nơi mà framework của bạn đã lưu trữ chúng. Có ba cấu trúc.

**Một tệp cho mỗi ngôn ngữ** (`flat`). next-intl, vue-i18n, Hugo, hầu hết các thiết lập tự tùy chỉnh:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Một thư mục cho mỗi ngôn ngữ** (`dir`). i18next và react-i18next, nơi mỗi tệp là một *namespace*:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

Champollion chọn `dir` khi `<localesDir>/<inputLocale>/` là một thư mục chứa các tệp locale. Mỗi tệp nguồn được đồng bộ tới cùng một đường dẫn dưới thư mục của từng ngôn ngữ, và các tệp cùng thư mục còn thiếu sẽ được tạo. Một namespace có thể là một đường dẫn lồng nhau (`admin/users`).

**Bất kỳ cấu trúc nào khác** (`localesPattern`). Đặt tên đường dẫn với `{lang}` và nếu một ngôn ngữ có nhiều tệp, với `{ns}`:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` có thể lặp lại, như trong `"{lang}/app_{lang}.json"`. `{ns}` có thể xuất hiện một lần và có thể trải dài qua các thư mục. Định dạng được xác định từ phần mở rộng trừ khi `format` được thiết lập.

`champollion init` tìm các bố cục này giúp bạn. Trước tiên, nó kiểm tra ứng dụng Flutter (`pubspec.yaml`, cùng `l10n.yaml` nếu có) và các catalog gettext (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`), rồi ghi một `localesPattern` cho chúng. Sau đó, nó kiểm tra thư mục thông thường của framework của bạn (`messages/` cho next-intl, `public/locales/` rồi đến `locales/` cho i18next, `src/locales/` cho vue-i18n, `i18n/` cho Hugo), rồi `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` và `src/i18n`. Nó chỉ sử dụng một thư mục chứa tệp ngôn ngữ nguồn của bạn, và in ra những gì tìm thấy. `init --langs fr,de` cũng tạo các tệp đích trống trong bố cục đó.

:::note[Cách một ngôn ngữ nhiều tệp đồng bộ]
Mỗi tệp được so sánh, dịch và ghi một cách độc lập. `.champollion.lock` ghi lại các khóa dưới dạng `<namespace>::<key>` (`common::nav.home`), và `--force-keys`, ID đơn vị `xliff` và `sync --dry --json` cũng vậy. Một khóa trần trong `--force-keys` sẽ khớp với khóa đó trong mọi tệp. Các dự án một-tệp-cho-mỗi-ngôn ngữ giữ các khóa thuần túy, vì vậy tệp lock của chúng không thay đổi.

Translation Memory được khóa theo văn bản nguồn, không phải theo tệp. Một chuỗi xuất hiện trong hai namespace chỉ được dịch một lần cho mỗi ngôn ngữ. Tệp thứ hai sẽ lấy chuỗi đó từ cache mà không tốn chi phí.
:::

Nếu cả `en.json` và một thư mục `en/` có nội dung đều tồn tại, Champollion sẽ dừng lại và yêu cầu bạn đặt `"localesLayout": "flat"` hoặc `"dir"` thay vì đoán định.

### Khóa số nhiều trong i18next {#i18next-plurals}

i18next lưu trữ các dạng số nhiều dưới dạng các khóa cùng cấp với hậu tố CLDR: `item_one`, `item_other`. Các ngôn ngữ có các dạng số nhiều khác nhau. Tiếng Pháp và tiếng Tây Ban Nha cũng sử dụng `_many`, tiếng Ả Rập sử dụng sáu dạng, và tiếng Nhật chỉ sử dụng `_other`. Khi một tệp nguồn JSON có các khóa này, mỗi đích sẽ nhận chính xác các dạng của ngôn ngữ mình, được đọc từ CLDR thông qua API JavaScript `Intl.PluralRules`:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Sau khi đồng bộ, `fr.json` có `item_one`, `item_many` và `item_other`, còn `ja.json` chỉ có `item_other`. Quá trình đồng bộ sẽ cho biết, đối với các ngôn ngữ của bạn, ngôn ngữ nào thêm hoặc bớt những dạng nào.

Các dạng mới được dịch từ văn bản `_other` của nguồn, `_one` từ `_one`. Khóa `_zero` ở nguồn được giữ lại ở mọi ngôn ngữ, vì i18next tra cứu nó cho số lượng 0 ở tất cả ngôn ngữ. Nếu một lần đồng bộ trước đó đã ghi một dạng mà ngôn ngữ không sử dụng, chẳng hạn như `item_one` trong tiếng Nhật, quá trình đồng bộ chỉ xóa nó khi Translation Memory cho thấy quá trình đồng bộ đã tạo ra giá trị đó. Giá trị được viết thủ công sẽ được giữ lại. Một khóa cho một dạng mà ngôn ngữ không có và nguồn cũng không có khóa tương ứng (tiếng Tây Ban Nha `item_two`) không bao giờ tự ý bị xóa: `verify` sẽ nêu tên nó, và `sync --prune plural-extras` sẽ xóa chính xác các khóa đó, liệt kê từng khóa (với `--dry`, nó sẽ thông báo những gì nó dự kiến xóa). Đối với ngôn ngữ mà CLDR không có quy tắc số nhiều, các dạng của nguồn sẽ được sao chép một-một, và quá trình đồng bộ sẽ thông báo điều đó.

### Thông điệp ICU {#icu}

Các giá trị được viết bằng ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) kết hợp mã với văn bản:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Chỉ phần văn bản bên trong các nhánh mới được dịch. [Cổng chất lượng](/docs/concepts/quality-gate) từ chối bản dịch thay đổi bất kỳ điều gì khác:

- tên biến (`count`, `{name}`), không bao giờ bị đổi tên hoặc bỏ qua;
- các từ `plural`, `select` và `selectordinal`, và kiểu của `{price, number}`;
- các bộ chọn (`=0`, `one`, `other`, `male`). Một `select` giữ nguyên chính xác các tùy chọn của nó. Một `plural` giữ các bộ chọn của nguồn và có thể thêm các danh mục mà ngôn ngữ đích sử dụng, từ CLDR: tiếng Pháp thêm `many`, tiếng Ba Lan `few` và `many`. Danh mục mà ngôn ngữ không sử dụng có thể bị bỏ qua, như tiếng Nhật chỉ giữ lại `other`;
- `#` trong mỗi nhánh số nhiều có chứa nó, ngoại trừ `zero`, `one`, `two` và `=N`, nơi một ngôn ngữ có thể viết số dưới dạng chữ;
- `offset:N`, các đối số lồng nhau, và các chuyển đổi printf như `%s`, `%d` và `%(name)s`.

Mô hình được thông báo về các danh mục mà ngôn ngữ đích sử dụng. Bản dịch bị từ chối sẽ được thử lại một lần kèm theo lý do, ví dụ: `ICU keyword 'other' was translated to 'óthér'`. Dấu nháy đơn trước một phần giữ chỗ (`d'{name}`) là hợp lệ. `verify` và `integrity` chạy cùng một kiểm tra đối với các tệp đã được ghi. Lệnh `sync` thông thường sẽ giữ lại giá trị đã có trên đĩa, vì vậy mỗi phát hiện sẽ nêu tên lệnh để sửa chữa nó, `champollion sync --pair <pair> --redo keys:<key>`. Khi giá trị bị hỏng xuất phát từ Translation Memory, chúng sẽ xóa nó khỏi cache để lệnh đó dịch lại khóa thay vì cung cấp lại cùng một văn bản; không cần dùng `--fresh`.

### Catalog gettext (.po) {#gettext}

Trỏ `localesPattern` (hoặc `localesDir`) đến các catalog của bạn:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**Nguồn** là catalog của ngôn ngữ nguồn, ví dụ: `locale/en/LC_MESSAGES/django.po` từ `django-admin makemessages -l en`. `msgid` của nó là văn bản cần dịch khi `msgstr` trống. Khi catalog đó không tồn tại, nguồn là một template `.pot`:

- Với `localesDir`: tệp `.pot` duy nhất trong thư mục đó.
- Với `localesPattern`: `<name>.pot` trong thư mục đứng trước phần giữ chỗ đầu tiên hoặc thư mục phía trên nó. `<name>` là namespace (`{ns}`, một template cho mỗi miền như `django.pot`), hoặc tên tệp của pattern không có `{lang}` (`messages.po` → `messages.pot`).
- Với `localesLayout: "dir"`: không tìm kiếm template nào. Giữ catalog nguồn trong `<localesDir>/<source>/`.

Nếu có hai template ở vị trí chỉ cần một, quá trình chạy sẽ dừng lại. Champollion không đoán xem template nào là nguồn.

**Khóa.** Mỗi `msgid` là một khóa. Một mục có `msgctxt` được đánh khóa bằng `msgctxt` + U+0004 + `msgid`, theo cách mã hóa riêng của gettext. Động từ "Open" và tính từ "Open" là các khóa riêng biệt và các mục cache riêng biệt. Các báo cáo in dấu phân cách dưới dạng `␄` (`verb␄Open`), và `--force-keys "verb␄Open"` chấp nhận điều đó. Nếu bạn không thể gõ `␄`, hãy viết `\x04` (`--force-keys 'verb\x04Open'`): cả hai cách viết đều hoạt động. `--force-keys` (và `--redo keys:`) phân tách theo dấu phẩy; hãy viết dấu phẩy bên trong một msgid dưới dạng `\,` và đặt đối số trong dấu ngoặc kép: `--redo 'keys:Welcome back\, %(name)s!'`. Các mục không thay đổi được lấy từ cache mà không tốn chi phí.

**Những gì được dịch.** Một mục có `msgstr` trống, hoặc một mục được gắn cờ `fuzzy`, được coi là chưa dịch. Quá trình đồng bộ sẽ dịch nó và xóa `fuzzy` cùng với các dòng previous-msgid `#|`. Các bình luận của người dịch (`# …`) được giữ lại. Các tham chiếu (`#:`), bình luận được trích xuất (`#.`) và cờ được lấy từ nguồn. Bình luận `#.` và `msgctxt` được gửi đến mô hình dưới dạng ngữ cảnh. Các mục mà quá trình đồng bộ không thay đổi được ghi lại chính xác từng byte. Các mục mà nguồn không còn nữa, cùng các mục `#~` lỗi thời, được giữ lại ở cuối tệp.

Một catalog do Champollion tạo (`init --langs`, hoặc đồng bộ cho một locale chưa có catalog) sẽ nhận header đầy đủ mà `msginit --no-translator` ghi, điều mà `msgfmt -c` chấp nhận: `Project-Id-Version`, `Report-Msgid-Bugs-To` và `POT-Creation-Date` được sao chép từ template (`PACKAGE VERSION` được thay thế bằng tên thư mục của dự án, và không có `POT-Creation-Date` nếu không có ngày của template), `PO-Revision-Date` (thời điểm tệp được tạo), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` và `Plural-Forms`. Header của một catalog hiện có không bao giờ bị ghi đè hoàn toàn — chỉ có phần giữ chỗ `Plural-Forms` hoặc `charset=CHARSET` trong đó được điền vào.

**Số nhiều.** Một mục có `msgid_plural` được dịch dưới dạng một thông điệp số nhiều ICU (`{n, plural, one {One file} other {%(count)d files}}`), vì vậy mô hình sẽ viết tất cả các dạng cùng một lúc. Sau đó, nó được ghi vào `msgstr[0]`…`msgstr[n]` thông qua header `Plural-Forms` của đích. Mỗi chỉ mục sẽ nhận danh mục CLDR của các số chọn nó. Tiếng Nga `nplurals=3` là `one`, `few`, `many`. Nếu đích không có header `Plural-Forms`, hoặc chỉ có phần giữ chỗ của template, nó sẽ nhận header mà `msginit` ghi cho ngôn ngữ đó, do đó các vị trí `msgstr[]` của catalog là những vị trí mà gettext và Django chọn: tiếng Pháp `nplurals=2; plural=(n > 1);`, tiếng Đức `nplurals=2; plural=(n != 1);`, tiếng Nga `nplurals=3; …`. Một ngôn ngữ mà `msginit` không có mục tương ứng sẽ nhận một header được dẫn xuất từ CLDR, được kiểm tra đối chiếu với `Intl.PluralRules` cho mọi số lên đến 3.000 và cho các số lớn. Nếu các quy tắc của một ngôn ngữ không thể được viết dưới dạng biểu thức gettext, quá trình đồng bộ sẽ dừng lại và nêu tên lệnh ghi header: `msginit --locale=<lang> --input=<template>.pot`. Một dạng mà catalog không có vị trí (tiếng Pháp `many`, cho 1 000 000, trong một catalog có hai dạng) sẽ không bị yêu cầu lại, đánh dấu hay báo cáo là thiếu; một catalog đã có header riêng sẽ giữ nguyên header đó, và các vị trí của nó là những vị trí được kiểm tra.

**Giới hạn.** Các catalog phải ở định dạng UTF-8. Chuyển đổi các định dạng khác bằng `msgconv --to-code=UTF-8`. Một msgid số nhiều có các dấu ngoặc nhọn không cân bằng không thể được viết dưới dạng thông điệp ICU, vì vậy nó sẽ được báo cáo và để lại cho bạn dịch. Bạn vẫn nên chạy `msgfmt --check-format` (Django: `compilemessages`) trước khi đưa vào phát hành. Nó chỉ kiểm tra các mục được gắn cờ `#, python-format` (hoặc `c-format`, …): `makemessages` thêm cờ vào các mục mà nó trích xuất với phần giữ chỗ `%`, nhưng một catalog được tạo thủ công có thể thiếu cờ này, và các mục đó sẽ không được kiểm tra. `champollion verify` so sánh các phần giữ chỗ printf của mọi mục — tên và chữ cái định kiểu — bất kể cờ của nó là gì, và quá trình đồng bộ giữ nguyên các cờ của mục nguồn trên từng mục mà nó dịch.

### Tệp Flutter ARB (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Sử dụng `arb-dir` và `template-arb-file` từ `l10n.yaml` của bạn nếu chúng khác nhau (`assets/i18n/intl_{lang}.arb`). Chỉ các thông điệp mới được dịch. Khi ghi:

- `@@locale` được đặt thành ngôn ngữ đích theo định dạng của Flutter, khớp với tên tệp (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` từ chối tệp có `@@locale` không khớp với tên của nó.
- Mọi đối tượng metadata `@key` (phần giữ chỗ, kiểu của chúng, mô tả) đều được sao chép từ nguồn. Khóa mà nguồn không có metadata sẽ giữ nguyên metadata của đích.
- Các khóa tuân theo thứ tự của nguồn. Các thông điệp chưa được dịch sẽ được bỏ qua, để Flutter sử dụng fallback về template.

`description` của thông điệp được gửi đến mô hình dưới dạng ngữ cảnh. Các phần giữ chỗ `{name}` và số nhiều ICU được bảo vệ bởi [kiểm tra ICU](#icu). `verify` và `integrity` cũng báo cáo `@@locale` bị sai và metadata phần giữ chỗ khác với nguồn. Bất kỳ lần đồng bộ nào ghi lại tệp đều sẽ sửa chữa cả hai: `champollion sync --pair en:fr --force` cung cấp mọi thông điệp không thay đổi từ cache.

## Các khóa không dịch {#no-translate}

Một số giá trị chỉ có đúng một cách thể hiện chính xác trong mọi ngôn ngữ: URL,
đường dẫn repository, tên package, mã định danh sản phẩm. Một bản dịch chính xác của
`https://example.org/paper` là `https://example.org/paper`.

[Cổng chất lượng](/docs/concepts/quality-gate) của Champollion từ chối
hiện tượng phản xạ nguồn (source-echo) — bản dịch giống hệt nguồn của nó — vì điều đó thường là
do mô hình từ chối thực hiện tác vụ dịch. Đối với các khóa này, điều đó khiến câu trả lời chính xác lại
bị từ chối, và không có đầu ra nào mô hình có thể tạo ra để vượt qua kiểm tra.
Các mô hình yếu hơn tìm cách vượt qua cổng kiểm tra bằng cách thay đổi giá trị vừa đủ (một
`#fragment` tự chế, một dấu gạch chéo cuối chuỗi lạc lõng, một khoảng trắng có độ rộng bằng 0 vô hình),
điều này dẫn đến việc phát hành các liên kết bị hỏng. Các mô hình mạnh hơn trả về giá trị không thay đổi và thất bại
ở cổng chất lượng, khiến `sync` kết thúc với mã khác 0 trong mọi lần chạy.

Thay vào đó, hãy khai báo các khóa đó:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Khóa khớp sẽ được **sao chép nguyên văn từ locale nguồn** — không bao giờ được gửi đến
backend dịch thuật, không bao giờ qua cổng chất lượng, không bao giờ bị tính là lỗi và không bao giờ
bị tính phí. Nó cũng được loại khỏi ước tính chi phí trước khi chạy vì lý do tương tự.

### Cú pháp mẫu (Pattern syntax)

Các mẫu là đường dẫn chấm (dot-path) trên không gian khóa đã làm phẳng, với hai ký tự đại diện (wildcard):

| Mẫu | Khớp | Không khớp |
|-----|------|------------|
| `nav.brand` | `nav.brand` (đường dẫn chính xác) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (lá `url` ở bất kỳ độ sâu nào) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` khớp trong một phân đoạn đơn lẻ; `**` khớp với 0 hoặc nhiều phân đoạn hoàn chỉnh.
Một mẫu không có ký tự đại diện là một đường dẫn khóa chính xác.

### URL được xử lý theo mặc định

Vì một khóa có giá trị URL không có kết quả hợp lệ nào khi qua cổng chất lượng,
`noTranslateUrls` được bật mặc định là `true`: bất kỳ giá trị nguồn nào chỉ là
một URL `scheme://` tuyệt đối đều được coi là không dịch mà không cần cấu hình.

Việc phát hiện được chủ ý thu hẹp — toàn bộ giá trị sau khi loại bỏ khoảng trắng thừa phải là URL.
Đoạn văn chỉ chứa một liên kết (`"Read the paper at https://…"`) vẫn được
dịch bình thường.

Tắt tính năng này bằng `"noTranslateUrls": false` nếu URL của bạn thực sự
dành riêng cho từng locale (chẳng hạn như host tài liệu theo từng ngôn ngữ) — sau đó khai báo
những URL không cần dịch bằng `noTranslate`.

### Sửa chữa và thực thi

Đối với một khóa không dịch, chỉ có duy nhất một giá trị đích chính xác, do đó bất kỳ
sự khác biệt nào cũng là một lỗi. Champollion thực thi điều đó theo cả hai hướng:

- **`sync` sửa chữa nó.** Khóa không dịch có đích bị thiếu,
  có tiền tố `[EN] ` hoặc bị sửa đổi sẽ được ghi lại từ nguồn. Điều này không tốn lệnh gọi
  API nào, và có tính lũy đẳng (idempotent): khi các giá trị đã khớp, các lần đồng bộ sau sẽ bỏ qua khóa
  đó hoàn toàn.
- **`verify` và `integrity` báo lỗi.** Một khóa không dịch bị sai lệch sẽ được
  báo cáo dưới dạng `NO-TRANSLATE DRIFT` kèm theo giá trị kỳ vọng và thực tế —
  các ký tự vô hình được escape dưới dạng `\uXXXX`, vì loại hỏng hóc này
  nếu không thì không thể nhìn thấy trong diff. `champollion integrity` kết thúc với mã `1`, nhờ đó quá trình
  build được liên kết với nó sẽ phát hiện ra URL bị hỏng trước khi phát hành.

Nếu `integrity` thất bại theo cách này trên một dự án bạn vừa cấu hình, nó đang
báo cáo các sai hỏng vốn đã có sẵn trong các tệp locale của bạn. Hãy chạy `champollion sync`
một lần để khắc phục.

## Chuyển đổi hệ chữ viết {#script-conversion}

Một số ngôn ngữ mà Champollion dịch có thể được *viết* theo nhiều cách. Mô hình luôn hoạt động bằng **hệ chữ viết làm việc** của ngôn ngữ đó (chuyển tự Latin — SRO cho tiếng Plains Cree, chuyển tự Okrand cho tiếng Klingon), và sau đó một bộ chuyển đổi có tính xác định có thể ghi lại đầu ra thành một hệ chữ viết hiển thị. Việc có nên làm vậy hay không là quyết định do tệp cấu hình đưa ra — **không bao giờ là mặc định**:

| Locale | Hệ chữ viết làm việc | Có thể chuyển đổi sang | Loại |
|--------|----------------------|------------------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Unicode thực sự — **bắt buộc phải chọn** |
| `sr` / `srp` (tiếng Serbia) | `Latn` | `Cyrl` (Cyrillic) | Unicode thực sự — **bắt buộc phải chọn** |
| `tlh` (tiếng Klingon) | `Latn` (chuyển tự Latin) | `Piqd` (pIqaD) | PUA — tùy chọn bật (opt-in) |
| `x-elvish-s` (tiếng Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — tùy chọn bật (opt-in) |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — tùy chọn bật qua `"script": "x-kryptonian"` |

**Các cặp Unicode thực sự (crk, sr) bắt buộc phải lựa chọn.** Ký tự âm tiết Cree (Cree Syllabics) và chữ Cyrillic là Unicode thông thường — chúng hiển thị ở mọi nơi — và cả hai hệ chính tả đều đang được sử dụng trong thực tế. Champollion sẽ không tự ý chọn hệ thống chữ viết của một cộng đồng thay cho dự án: `init` sẽ hỏi khi bạn chọn ngôn ngữ, và `sync` từ chối chạy cho đến khi cấu hình chỉ rõ lựa chọn nào:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Các hệ chữ viết PUA (tlh, x-elvish-s, x-kryptonian) mặc định là chuyển tự Latin.** pIqaD, Tengwar và Kryptonian *không có trong Unicode* — các bộ chuyển đổi phát ra các codepoint vùng Private Use Area (PUA) vốn không hiển thị được gì trừ khi bạn cung cấp một phông chữ được ánh xạ tới các codepoint đó. Chuyển tự Latin là đầu ra duy nhất hiển thị được ở mọi nơi, vì vậy nó là mặc định. Để xuất ra hệ chữ viết hiển thị:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…và chạy `champollion fonts install` để trang web của bạn có phông chữ có thể hiển thị nó. Nếu phông chữ của bạn được gán theo chuyển tự Latin (nhiều phông chữ conlang hoạt động theo cách này), hãy giữ mặc định.

`script` nhận mã ISO 15924, không phân biệt chữ hoa chữ thường (`"cans"`, `"Cans"` và `"CANS"` đều như nhau). Nó cũng có thể được thiết lập theo từng cặp, mức này sẽ được ưu tiên hơn cấp độ ngôn ngữ. Giá trị không hợp lệ, hoặc một hệ chữ viết mà locale không thể tạo ra, sẽ thất bại ngay khi khởi động — trước bất kỳ lệnh gọi API nào.

### Các chữ cái chưa được ánh xạ và `scriptFallback` {#script-fallback}

Các bộ chuyển đổi chỉ chuyển đổi những gì hệ chính tả của chúng định nghĩa và không gì khác. Chuyển tự Latin tiếng Klingon không có `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` hoặc `z` — vì vậy đầu ra của mô hình chứa một danh từ riêng như "GitHub" không thể chuyển đổi hoàn toàn. Champollion **không bao giờ ghi một giá trị chỉ được chuyển đổi một nửa**: nếu có bất kỳ chữ cái nào không thể ánh xạ, toàn bộ giá trị sẽ được giữ nguyên trong hệ chữ viết làm việc, và cảnh báo sẽ nêu tên các chữ cái kèm theo dòng cấu hình có thể ánh xạ chúng.

Bạn có thể tự khai báo các ánh xạ đó:

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

Mỗi quy tắc sẽ thay thế một chuỗi trong hệ chữ viết làm việc bằng một chuỗi mà bộ chuyển đổi *có thể* ánh xạ, trước khi quá trình chuyển đổi diễn ra. Các quy tắc được xác thực khi khởi động — một chuỗi thay thế mà bản thân nó cũng không thể ánh xạ sẽ bị từ chối.

Champollion **không đi kèm bất kỳ quy tắc dự phòng nào của riêng mình**: việc tự ý tạo ra các điều chỉnh chính tả, đặc biệt là đối với hệ thống chữ viết của một ngôn ngữ thực, không phải là việc của một công cụ lập chỉ mục. Các cộng đồng và fandom đều có quy ước riêng — hãy chủ động áp dụng chúng theo từng dự án.

### Sửa chữa chuyển đổi không mong muốn {#repair-script}

Trước phiên bản 0.3.0, việc chuyển đổi diễn ra vô điều kiện — các dự án hướng tới các locale PUA nhận được đầu ra không thể hiển thị bất kể họ có muốn hay không. Hai công cụ sau đây sẽ giải quyết triệt để vấn đề:

- **`champollion repair-script`** quét các locale có cấu hình chỉ định chuyển đổi đang *tắt* để tìm các codepoint PUA và khôi phục dạng chuyển tự Latin bằng bảng đảo ngược của chính bộ chuyển đổi (dùng `--dry` để xem trước). pIqaD đảo ngược chính xác; phép đảo ngược của Tengwar và Kryptonian làm mất chữ hoa và sẽ thông báo về điều đó.
- **`champollion integrity`** báo lỗi (mã thoát 1) khi tìm thấy PUA ở nơi tính năng chuyển đổi đang tắt — giúp cổng kiểm tra quá trình build phát hiện văn bản không hiển thị được trước khi phát hành, và báo cáo sẽ nêu rõ lệnh sửa chữa.

Translation Memory không bao giờ cần sửa chữa: nó lưu trữ các giá trị trước khi chuyển đổi, vì vậy việc bật hoặc tắt `script:` sau này không đòi hỏi thao tác xử lý cache nào.

Chuyển đổi hệ chữ viết áp dụng cho các chuỗi giao diện người dùng (tệp key-value và JSON của Docusaurus). Phần nội dung Markdown không bao giờ được chuyển đổi — một bộ chuyển đổi ký tự tham lam không có cách nào xử lý an toàn qua các đoạn mã (code span), URL và frontmatter.

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
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### Các trường của cặp

| Trường | Kiểu | Mô tả |
|-------|------|-------------|
| `method` | `string` | Phương thức dịch: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Tên của plugin đã cài đặt (từ `.champollion/methods/`) |
| `model` | `string` | Ghi đè mô hình mặc định cho cặp này |
| `temperature` | `number` | Ghi đè nhiệt độ (temperature) mặc định cho cặp này |
| `batchSize` | `number` | Ghi đè kích thước batch mặc định cho cặp này |
| `register` | `string` | Ghi đè văn phong/sắc thái (khóa preset hoặc văn bản tự do) |
| `endpoint` | `string` | URL endpoint của remote API. Bắt buộc khi `method` là `api`. |
| `coachingFile` | `string` | Đường dẫn đến tệp prompt hướng dẫn (coaching) cho cặp này, được đọc tương đối với dự án; nó thay thế bất kỳ coaching nào kém cụ thể hơn, và tệp không thể đọc được sẽ dừng quá trình chạy |
| `promptContext` | `string` | Ngữ cảnh ứng dụng cho cặp này |
| `genderGuidance` | `string` \| `false` | Hướng dẫn về giống cho các prompt của cặp này: văn bản của riêng bạn, hoặc `false` để không dùng hướng dẫn nào. Xem [Hướng dẫn về giống](#gender-guidance). |
| `qualityTier` | `string` | Nhãn bạn gán cho đầu ra của cặp: `standard`, `high`, `research`, `verified`. Không được đo lường, và quá trình đồng bộ dịch như nhau bất kể nhãn ghi gì; `status` hiển thị nhãn đó (chỉ khi được đặt) và `serve` quảng bá nó |
| `fallback` | `object` | Phương thức thứ hai dành cho những gì phương thức của cặp này không thể dịch một cách an toàn. Xem [Phương thức dự phòng (fallback)](#fallback). `null` xóa cấu hình fallback đã đặt trên ngôn ngữ. |

### Phương thức dự phòng (Fallback) {#fallback}

Một cặp có thể chỉ định một phương thức thứ hai. Phương thức riêng của cặp sẽ dịch trước. Bất kỳ nội dung nào nó không thể dịch an toàn sẽ được chuyển sang fallback một lần:

- **Các tệp key-value:** các khóa bị [cổng chất lượng](/docs/concepts/quality-gate) từ chối (bỏ quên `{name}`, hỏng dạng số nhiều, nhãn hai từ biến thành một đoạn văn) và các khóa mà phương thức không trả về nội dung nào.
- **Markdown (nội dung Hugo và tài liệu Docusaurus):** các trường frontmatter bị bỏ sót hoặc bị làm trống từ ngữ, và các khối nội dung phần thân bị bỏ sót trong phản hồi, bị hư hại (mất phần tử được bảo vệ: mã, thẻ HTML, shortcode) hoặc bị làm trống. Trong phân đoạn `page`, là toàn bộ trang.

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

Khi không có văn bản nào được phép rời khỏi máy của bạn (bệnh viện, trường học, cộng đồng lưu giữ dữ liệu ngôn ngữ tại chỗ), hãy đặt fallback là mô hình bạn tự chạy. Phương thức `local` gửi đến máy chủ tương thích OpenAI trên máy này (Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` thiết lập địa chỉ, xem [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

Nên sử dụng phương thức nào:

- **Mô hình dạng hosted** (`llm-coached` với mô hình Gemini, hoặc một phương thức API khác) thường là ý kiến thứ hai mạnh hơn đối với ngôn ngữ ít tài nguyên, và được tính phí theo yêu cầu. Hãy sử dụng khi văn bản có thể được gửi tới nhà cung cấp đó.
- **`local`** giữ mọi khóa trên máy này, và ước tính chi phí sẽ hiển thị là `$0 API cost (runs on this machine)`. Hãy sử dụng khi không có dữ liệu nào được phép rời khỏi máy, ngay cả khi mô hình bạn có thể chạy trên đó có kích thước nhỏ hơn.

Đầu ra của fallback phải vượt qua cùng một cổng chất lượng. Những gì nó dịch được lưu vào cache dưới phương thức của chính nó trong Translation Memory, để cache ghi lại phương thức nào đã tạo ra từng giá trị. Các lần đồng bộ sau sẽ sử dụng lại nó thay vì hỏi lại phương thức đầu tiên; `--fresh` hoặc `--retranslate` sẽ hỏi lại. Những gì cả hai phương thức đều không dịch được sẽ giữ nguyên trạng thái như khi không có fallback. Một khóa bị bỏ lại chưa dịch và giữ mục lock cũ của nó, để lần đồng bộ tiếp theo sẽ thử lại và `champollion verify` sẽ liệt kê nó. Một khối Markdown được ghi dưới dạng nguồn có tiền tố `[EN] `, không được lưu cache, và tệp sẽ được xử lý lại ở lần đồng bộ tiếp theo. Một khối hoặc trường frontmatter bị cổng chất lượng từ chối từ cả hai phương thức sẽ bị giữ lại (held back), không gửi lại cho chúng cho đến khi `--redo files:<page>` chỉ định trang đó ([Các khối Markdown và trường frontmatter bị từ chối](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Một trường frontmatter bị cả hai phương thức làm trống, hoặc một trang mà cả hai đều không dịch được, sẽ làm tệp bị lỗi, tương tự như khi không có fallback.

Fallback chấp nhận các trường tương tự như một cặp: `method` (bắt buộc), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Nó được phân giải tương tự như một cặp. Các trường nó không thiết lập (văn phong, coaching, ngữ cảnh prompt, …) được kế thừa từ cặp của nó. `coachingFile` riêng của nó được đưa vào prompt và khóa cache của nó, và `champollion status` sẽ hiển thị nó. Hệ chữ viết thuộc về cặp, vì vậy `script` và `scriptFallback` bị từ chối trên một fallback, và `fallback` của riêng fallback cũng vậy. Một phương thức không xác định, hoặc một fallback giống hệt với cặp của nó, sẽ dừng quá trình đồng bộ với lỗi nêu tên cặp đó. Fallback phải sẵn sàng chạy trước khi quá trình đồng bộ bắt đầu, giống như phương thức riêng của cặp (ví dụ: API key của nó phải được thiết lập).

- **`--method` và `--model` chỉ thay đổi phương thức riêng của cặp.** Fallback vẫn giữ những gì tệp cấu hình chỉ định.
- **Chi phí.** Ước tính trước khi chạy chỉ bao gồm phương thức riêng của cặp: không ai có thể biết trước nó sẽ thất bại ở những đâu. Mỗi batch của fallback được tính giá ngay trước khi chạy, bằng cùng một bộ ước tính. Với `--max-cost`, một batch làm cho lượt chạy vượt quá hạn mức tối đa (ước tính cộng với tất cả các batch fallback cho đến thời điểm đó) sẽ bị bỏ qua, kèm theo cảnh báo nêu tên các khóa. Điều này cũng áp dụng cho fallback không thể ước tính chi phí (không xác định không đồng nghĩa với miễn phí). Các khóa đó vẫn ở trạng thái thất bại, và quá trình đồng bộ sẽ thoát với mã khác 0 giống như bất kỳ thất bại từng phần nào.
- **Báo cáo.** `sync` in một dòng cho mỗi cặp, ví dụ: `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. Tóm tắt `--json` cho biết theo từng cặp những gì fallback đã thực hiện (`method`, `attempted`, `accepted`, `failed`, `cached`): trong mỗi mục của `locales` cho các tệp key-value, trong `fallback` cho JSON Docusaurus, và trong `content.fallback` cho Markdown. `champollion status` hiển thị fallback dưới cặp của nó. `--dry` không thể biết trước những gì sẽ thất bại, nên nó không báo cáo gì về fallback.
- **Khi fallback viết phần lớn nội dung.** Khi hơn một nửa số bản dịch mới của một lần chạy cho một cặp (các câu trả lời được chấp nhận của phương thức chính cộng với của fallback) đến từ fallback, `sync` sẽ thêm một cảnh báo: bao nhiêu trên tổng số bao nhiêu, bởi phương thức và mô hình nào, tại sao các câu trả lời của phương thức chính không được sử dụng (từng lý do được thống kê: một câu học vẹt bị lặp lại cho các chuỗi nguồn khác nhau, phồng chiều dài chuỗi, …), và những điều cần cân nhắc — phương thức của cặp có thể không phù hợp với các chuỗi này; kiểm tra những gì đã được ghi (`verify` kiểm tra cấu trúc, người bản ngữ kiểm tra ý nghĩa); sử dụng fallback mạnh hơn. Các mục `--json` mang theo `primaryAccepted` và `primaryReasons` bên cạnh `accepted`. `champollion status` cung cấp tỷ lệ tương tự cho các tệp ("từ fallback: 8 giá trị trong các tệp (…) — 8 trong số 8 mục đồng bộ đã ghi (100%)"), và thông báo khi nó chiếm phần lớn văn bản của locale.
- `champollion serve` cũng sử dụng fallback, trong giới hạn trần `--max-cost-per-request` / `--max-session-cost` của nó.

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
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

Bạn có thể kết hợp cú pháp viết tắt và đối tượng đầy đủ trong cùng một khối.


### Các trường của ngôn ngữ

| Trường | Kiểu | Mô tả |
|-------|------|-------------|
| `register` | `string` | Hướng dẫn về phong cách/văn phong. Có thể là một **khóa preset** (ví dụ: `casual-tu`, `formal-hapsyo`) hoặc văn bản tùy chỉnh. Xem [Thẻ ngôn ngữ](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Tên ngôn ngữ dễ đọc cho con người (để hiển thị trạng thái) |
| `model` | `string` | Ghi đè mô hình mặc định |
| `temperature` | `number` | Ghi đè nhiệt độ (temperature) mặc định |
| `batchSize` | `number` | Ghi đè kích thước batch mặc định |
| `coachingFile` | `string` | Đường dẫn đến tệp prompt hướng dẫn (coaching) cho ngôn ngữ này, được đọc tương đối với dự án; nó thay thế coaching cấp cao nhất, và tệp không thể đọc được sẽ dừng quá trình chạy |
| `promptContext` | `string` | Ngữ cảnh ứng dụng cho ngôn ngữ này |
| `genderGuidance` | `string` \| `false` | Hướng dẫn về giống cho các prompt của ngôn ngữ này: văn bản của riêng bạn, hoặc `false` để không dùng hướng dẫn nào. Xem [Hướng dẫn về giống](#gender-guidance). |
| `maxRetries` | `number` | Giới hạn thử lại tối đa cho các batch thất bại (mặc định: 3) |
| `script` | `string` | Mã ISO 15924 của hệ chính tả mà Champollion ghi (ví dụ: `"Cans"`, `"Piqd"`). Xem [Chuyển đổi hệ chữ viết](#script-conversion). |
| `scriptFallback` | `object` | Quy tắc chuyển tự cho các chữ cái mà bộ chuyển đổi hệ chữ viết không thể ánh xạ. Xem [Chuyển đổi hệ chữ viết](#script-conversion). |
| `endpoint` | `string` | URL endpoint của remote API, cho `"method": "api"` |
| `fallback` | `object` | Phương thức thứ hai dành cho những gì phương thức của ngôn ngữ này không thể dịch một cách an toàn. Xem [Phương thức dự phòng (fallback)](#fallback). |

:::info[Chuỗi kế thừa]
Các thiết lập được giải quyết theo thứ tự sau (ưu tiên cái đầu tiên):
:::

**cấp độ cặp (pair-level)** → **cấp độ ngôn ngữ (language-level)** → **cấu hình toàn cục (global config)** → **mặc định (defaults)**

Ví dụ, nếu `pairs["en:fr"]` thiết lập `model`, nó sẽ ghi đè cả giá trị ở cấp độ ngôn ngữ và giá trị toàn cục của `model`.

### Hướng dẫn về giống {#gender-guidance}

Các prompt LLM mang theo hướng dẫn về giống ngữ pháp đối với những ngôn ngữ
có đặc điểm này. Hướng dẫn này đến từ danh mục của Champollion: tiếng Pháp yêu cầu *écriture
inclusive* với dấu chấm giữa khi không rõ giới tính của người đọc
(`Connecté·e`, không phải `Connecté(e)` hoặc `Connectée`; `Utilisateur·rice·s` ở
số nhiều), tiếng Đức dùng dạng dấu hai chấm (`Benutzer:innen`), tiếng Nhật dùng dạng
trung tính `私`. `champollion init` in thông tin này bên cạnh văn phong của từng ngôn ngữ, và
`champollion status` hiển thị thông tin này theo từng cặp, cùng với nguồn gốc của nó.

Chọn một phong cách khác với `genderGuidance`, cho mọi ngôn ngữ hoặc cho một ngôn ngữ:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` không gửi hướng dẫn nào về giống; một chuỗi sẽ thay thế hướng dẫn của danh mục. Thiết
lập này áp dụng cho các phương thức có nhận hướng dẫn (các phương thức LLM); các công cụ dịch
máy truyền thống (DeepL, Google, …) không được thông báo. Một hướng dẫn về giống
bị thay đổi sẽ tạo ra một prompt khác, do đó nó có các mục cache riêng: những gì
đã được dịch sẽ giữ nguyên cho đến khi bạn dịch lại (`champollion sync
--redo all`, lệnh mà quá trình đồng bộ sẽ gợi ý khi các tệp đang chứa phong cách cũ).

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

Champollion tạo `.champollion.lock` để theo dõi mã băm SHA-256 của các giá trị nguồn đã dịch. **Hãy commit tệp này** để tất cả lập trình viên dùng chung một baseline dịch thuật. Trong dự án có một thư mục cho mỗi ngôn ngữ, các khóa được ghi lại dưới dạng `<namespace>::<key>`.

Đối với mỗi locale đích, tệp lock cũng ghi lại dấu vân tay (fingerprint) của từng giá trị mà quá trình đồng bộ đã ghi và của văn bản nguồn mà nó đã dịch (để nhận diện giá trị do con người chỉnh sửa, và báo cáo bản dịch đã lỗi thời), các khóa mà thao tác redo chưa hoàn thành được (**pending**), và các khóa bị cổng chất lượng từ chối (**held back** không gửi lại cho cùng mô hình đó). Khi có bất kỳ thông tin nào trong số đó cần ghi, tệp sẽ chuyển sang định dạng phiên bản 2, `{"version": 2, "source": {…}, "locales": {…}}`; tệp lock phiên bản 1 (một bản đồ phẳng key → hash) vẫn được đọc như trước. Bản chỉnh sửa thủ công bị thay thế được giữ lại trong `.champollion-replaced-edits.jsonl` bên cạnh nó — hãy commit cả hai. Xem [Cổng chất lượng](/docs/concepts/quality-gate#refused-keys-are-held-back) và [Chỉnh sửa bản dịch](/docs/guides/professional-translators#editing-key-value-files).

Khi một giá trị nguồn thay đổi, mã băm sẽ không còn khớp nữa, và champollion sẽ dịch lại khóa đó trong lần đồng bộ tiếp theo.

## `.champollionignore`

Tạo `.champollionignore` trong thư mục gốc của dự án để loại trừ các tệp khỏi quá trình quét của `lint`. Sử dụng các mẫu glob, như `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Thư mục `.champollion/`

Champollion tạo thư mục `.champollion/` trong thư mục gốc dự án của bạn để lưu trạng thái nội bộ. Đừng đưa thư mục này vào hệ thống kiểm soát phiên bản — đây là bộ nhớ cache riêng cho từng máy, không phải mã nguồn dự án. `champollion init` sẽ thêm dòng này vào `.gitignore`, tạo tệp nếu chưa có (kể cả trong thư mục chưa phải là kho git, để lệnh `git init` và `git add --all` sau này không commit bộ nhớ cache):

```gitignore
.champollion/
```

Hãy commit các tệp lock bên cạnh nó (`.champollion.lock`, `.champollion-content.lock`): chúng ghi lại văn bản nguồn mà mỗi bản dịch được tạo ra từ đó.

| Tệp | Mục đích | Commit? |
|------|---------|--------|
| `tm.json` | Cache Translation Memory — lưu trữ các bản dịch trước đó được đánh khóa theo văn bản nguồn + locale + phương thức | Không (cache cục bộ) |
| `xliff/*.xliff` | Tệp xuất XLIFF để biên dịch viên chuyên nghiệp duyệt | Không (tạm thời) |
| `methods/` | Manifest của các plugin phương thức đã cài đặt | Bị bỏ qua bởi dòng `.champollion/`. Để chia sẻ các plugin đã cài đặt, hãy thay thế dòng đó bằng `.champollion/*` và `!.champollion/methods/` |
| `backups/` | Bản sao lưu trước khi bọc dòng (pre-wrap backup do `wrap --undo` tạo) | Không (lưới an toàn) |

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

| Thành phần xuất (Export) | Chức năng |
|--------|-------------|
| `TranslationMethod` | Lớp cơ sở (Base class) cho mọi phương thức |
| `LLMMethod` | Lớp cơ sở cho các phương thức LLM (OpenRouter) |
| `DirectLLMMethod` | Lớp cơ sở cho các nhà cung cấp LLM trực tiếp (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Các lớp nhà cung cấp LLM trực tiếp |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Các lớp MT (dịch máy) truyền thống |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Coached LLM (OpenRouter + dữ liệu coaching) |
| `APIMethod` | Client remote API |
| `runSync`, `runContentSync` | Pipeline đồng bộ đầy đủ |
| `translateWithFallback`, `translateAndValidate` | Pipeline của một cặp cho một batch các khóa, như cách `sync` thực thi: cache, phương thức, cổng chất lượng, cache, sau đó là fallback của cặp. Truyền một cặp từ `resolvePairs`, `tm` từ `loadTM`, và `cwd` là thư mục dự án: phương thức đọc key, endpoint, coaching và bảng thuật ngữ ở đó, không phải từ `process.cwd()` |
| `createFallbackBudget` | Bộ bảo vệ (guard) `--max-cost` cho các batch fallback (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | Các tệp cấu thành mỗi locale (phẳng, thư mục cho mỗi locale, hoặc `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Phân giải cấu hình |
| `validateTranslations` | Cổng chất lượng |
| `loadCoachingData`, `findDictionaryMatches` | Các tiện ích coaching |

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
