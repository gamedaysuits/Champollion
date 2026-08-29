---
sidebar_position: 1
title: "Tài liệu tham khảo CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Tham chiếu CLI

## Lệnh

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Chạy `champollion <command> --help` để xem hướng dẫn chi tiết cho bất kỳ lệnh nào.

## Tùy chọn toàn cục

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Trình hướng dẫn thiết lập tương tác giúp tạo `champollion.config.json`. Hướng dẫn bạn thiết lập locale nguồn, ngôn ngữ đích, định dạng tệp và mô hình dịch thuật.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**Tùy chọn `--langs`**: Danh sách các mã ngôn ngữ đích, phân tách bằng dấu phẩy. Bỏ qua bước hỏi ngôn ngữ và áp dụng các thiết lập sẵn (preset) về văn phong mặc định cho từng ngôn ngữ. Kết hợp với `--yes` để thiết lập hoàn toàn không tương tác.

**Thiết lập sẵn ngôn ngữ (Language presets)**: Khi được hỏi về ngôn ngữ đích, bạn có thể nhập tên thiết lập sẵn:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Kết hợp thiết lập sẵn và mã riêng lẻ: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Dịch các khóa bị thiếu và lỗi thời trên tất cả các tệp locale. Chạy xác minh sau khi đồng bộ hóa theo mặc định.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Bộ nhớ dịch thuật (Translation Memory)**: Theo mặc định, `sync` sẽ tải `.champollion/tm.json` và cung cấp các bản dịch đã lưu trong bộ nhớ đệm cho các giá trị nguồn không thay đổi. Sử dụng `--no-tm` để bỏ qua bộ nhớ đệm (hữu ích khi chuyển đổi nhà cung cấp dịch thuật hoặc kiểm tra chất lượng). Xem [Bộ nhớ dịch thuật](/docs/concepts/translation-memory).

**Phát hiện thay đổi**: champollion lưu trữ các mã băm SHA-256 trong `.champollion.lock`. Khi các giá trị nguồn thay đổi, lần đồng bộ tiếp theo sẽ tự động dịch lại các khóa đó. Hãy commit tệp lock để tất cả các nhà phát triển chia sẻ cùng một mốc cơ sở.

**Xử lý song song**: Cả việc dịch khóa JSON và dịch nội dung đều chạy song song. Các locale JSON được dịch đồng thời (mặc định: 200 locale đồng thời), với các lô (batch) trong mỗi locale cũng được song song hóa (4 lô đồng thời). Việc dịch nội dung (Markdown, MDX, bài viết blog) chạy trong một nhóm công việc phẳng (mặc định: 48 cuộc gọi API đồng thời). Ghi đè bằng `--json-concurrency`, `--content-concurrency`, hoặc `--concurrency` (thiết lập cả hai).

**Đầu ra**: Quá trình đồng bộ hiển thị biểu ngữ phiên bản, phát hiện định dạng/framework, ước tính chi phí và thanh tiến trình cho từng locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Các thanh tiến trình cập nhật trực tiếp tại chỗ sau mỗi lô (~80 khóa). Sử dụng `--quiet` để chỉ hiển thị lỗi/cảnh báo, hoặc `--json` để xuất ra định dạng NDJSON mà máy có thể đọc được. Cả hai tùy chọn này đều ẩn thanh tiến trình và biểu ngữ.

---

## watch

Tự động đồng bộ hóa khi tệp locale nguồn thay đổi. Chạy cho đến khi bị ngắt bằng `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Liệt kê tất cả các giá trị dự phòng chưa được dịch có tiền tố `[EN]` từ các lần chạy trước. Thoát với mã lỗi 1 nếu tìm thấy bất kỳ giá trị nào — sử dụng như một cổng kiểm duyệt CI để dừng các bản build có bản dịch chưa hoàn thành.

```bash
champollion audit
```

---

## verify

Đọc lại tất cả các tệp locale từ đĩa và xác minh xem các bản dịch có thực sự tồn tại và chính xác hay không. Đây chính là quy trình xác minh tự động chạy ở cuối mỗi lệnh `sync` (trừ khi `--no-verify` được truyền vào).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**Những gì được kiểm tra:**
- Tính tương đồng của khóa — tất cả các khóa nguồn đều có mặt trong mỗi ngôn ngữ đích
- Các dấu hiệu dự phòng `[EN]` từ các lần chạy trước
- Bản dịch trống
- Tuân thủ hệ chữ viết — các locale không dùng chữ Latinh phải có bản dịch không chứa ký tự ASCII
- Giữ nguyên trình giữ chỗ (placeholder) — các trình giữ chỗ ICU phải khớp với nguồn
- Lỗi mã hóa — dấu BOM, ký tự ẩn
- Trùng lặp nguồn — các giá trị giống hệt với nguồn (cảnh báo)

---

## lint

Quét mã nguồn để tìm các chuỗi hiển thị cho người dùng bị viết cứng (hardcoded) mà lẽ ra nên sử dụng các lệnh gọi dịch thuật i18n. Tự động phát hiện framework của bạn (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Những gì được phát hiện:**
- Các chuỗi viết cứng trong văn bản JSX, `placeholder`, `alt`, `aria-label`, `title`
- Các tệp có nội dung hiển thị cho người dùng nhưng không import framework i18n
- Khóa chết (dead keys) — các khóa locale không được tệp nguồn nào tham chiếu đến
- Điểm số bao phủ (coverage score) — tỷ lệ phần trăm các chuỗi được xử lý qua i18n

**Ngoại lệ**: Tạo `.champollionignore` trong thư mục gốc của dự án (sử dụng các mẫu glob, ví dụ: `.gitignore`).

---

## wrap

Tự động bao bọc các chuỗi viết cứng được phát hiện bởi `lint` trong các lệnh gọi `t()`. Tự động tạo bản sao lưu trước khi sửa đổi tệp.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Các chốt an toàn:**
1. Kiểm tra trạng thái Git sạch (bỏ qua trong chế độ chạy thử - dry-run)
2. Tự động sao lưu vào `.champollion-backup/`
3. Xem trước thay đổi (diff) trước khi ghi vào mỗi tệp
4. Hỗ trợ `--undo` để khôi phục từ bản sao lưu

---

## seo

Tạo các thành phần SEO cho các trang web đa ngôn ngữ.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Lệnh phụ | Đầu ra |
|------------|--------|
| `hreflang` | Thẻ `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` đa ngôn ngữ |
| `jsonld` | Sơ đồ ngôn ngữ WebSite JSON-LD |

---

## integrity

Phát hiện lỗi dữ liệu và sự sai lệch trong các tệp locale đã dịch.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Những gì nó kiểm tra:**
- Lỗi placeholder (ví dụ: `{name}` có trong bản gốc nhưng bị thiếu trong bản dịch)
- Vấn đề về mã hóa (mojibake, Unicode không hợp lệ)
- Các bản sao chưa được dịch (giá trị đích giống hệt bản gốc) — các khóa [`noTranslate`](/docs/getting-started/configuration#no-translate) được miễn trừ, và các chuỗi được giữ nguyên (echoes) mà Translation Memory xác nhận là do pipeline tạo ra và đã được cổng kiểm duyệt chấp thuận cũng vậy. Những gì còn lại bị gắn cờ chính xác là những gì `sync` sẽ đưa vào hàng đợi lại (requeue) — hai công cụ này không thể bất đồng về một tệp khỏe mạnh
- Sự sai lệch của no-translate (một khóa `noTranslate` *không* giống hệt với bản gốc) — được báo cáo với các giá trị mong đợi/thực tế và các ký tự vô hình được escape; chạy `champollion sync` để sửa chữa
- PUA không mong muốn (các điểm mã Private Use Area trong một locale có [script conversion](/docs/getting-started/configuration#script-conversion) bị tắt — sẽ hiển thị trống nếu không có phông chữ đặc biệt); chạy `champollion repair-script` để sửa chữa
- Các giá trị bị rỗng (hollowed values) (một giá trị đích là bản gốc của nó nhưng các chữ cái đã bị xóa — thiệt hại từ một pipeline cũ hơn cổng bảo tồn nội dung); dịch lại bằng `sync --force-keys <key>` hoặc `sync --pair <pair> --force`
- Các khóa mồ côi (các khóa trong bản dịch không tồn tại trong bản gốc)
- Tính đầy đủ của danh mục số nhiều (plural category) trong ICU MessageFormat (ví dụ: tiếng Ả Rập cần 6 danh mục)

---

## repair-script

Đảo ngược quá trình chuyển đổi chữ viết (script conversion) lẽ ra không bao giờ nên xảy ra: Các giá trị được mã hóa PUA (pIqaD, Tengwar, Kryptonian) trong các locale có cấu hình tắt chuyển đổi sẽ được khôi phục về dạng Latinh hóa (romanization) thông qua bảng đảo ngược của chính bộ chuyển đổi.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Tùy chọn | Hiệu ứng |
|--------|--------|
| `--dry` | Xem trước các sửa chữa mà không ghi |
| `--locale <code>` | Chỉ sửa chữa một locale |
| `--json` | Đầu ra JSON máy có thể đọc được |
| `--warn-only` | Thoát với mã 0 ngay cả khi vẫn còn PUA không thể đảo ngược |

pIqaD đảo ngược một cách chính xác. Các đảo ngược của Tengwar và Kryptonian không thể khôi phục lại việc viết hoa (được gắn cờ là mất định dạng chữ hoa/thường). Translation Memory không cần sửa chữa — nó lưu trữ các giá trị trước khi chuyển đổi. Thoát với mã 1 khi vẫn còn PUA mà không có bộ chuyển đổi nào được đăng ký có thể đảo ngược.

---

## tm

Quản lý bộ nhớ đệm của Bộ nhớ dịch thuật (`.champollion/tm.json`). TM lưu trữ các bản dịch trước đó và cung cấp chúng trong các lần đồng bộ tiếp theo thay vì gọi API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Lệnh phụ | Đầu ra |
|------------|--------|
| `stats` | Số lượng mục, kích thước tệp, phân tích theo từng locale |
| `clear` | Xóa tệp bộ nhớ đệm (toàn bộ hoặc theo từng locale) |

| Tùy chọn | Tác dụng |
|--------|--------|
| `--locale <code>` | Chỉ xóa các mục của một locale |
| `--yes` | Bỏ qua yêu cầu xác nhận |

Xem [Bộ nhớ dịch thuật](/docs/concepts/translation-memory) để biết cách hoạt động của TM và khi nào cần xóa nó.

---

## xliff

Xuất và nhập các tệp XLIFF 1.2 để các dịch giả chuyên nghiệp soát xét. XLIFF là định dạng trao đổi phổ biến được hỗ trợ bởi các công cụ CAT như memoQ, SDL Trados và Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Lệnh phụ | Đầu ra |
|------------|--------|
| `export` | Tạo `.xliff` từ các tệp locale nguồn + đích |
| `import` | Gộp các bản dịch `.xliff` đã soát xét vào các tệp locale |

| Tùy chọn | Tác dụng |
|--------|--------|
| `--locale <code>` | Locale đích để xuất (bắt buộc) |
| `--out <path>` | Đường dẫn đầu ra hoặc thư mục tùy chỉnh |
| `--dry` | Xem trước khi nhập mà không ghi vào tệp |

Xem [Làm việc với dịch giả chuyên nghiệp](/docs/guides/professional-translators) để biết quy trình làm việc đầy đủ.

---

## status

Hiển thị cấu hình cặp ngôn ngữ, các plugin đã cài đặt, các cấp chất lượng và điểm số benchmark.

```bash
champollion status
```

---

## provenance

Kiểm duyệt bản quyền tài nguyên dịch thuật cho tất cả các plugin đã cài đặt.

```bash
champollion provenance
```

---

## plugin

Quản lý các plugin phương thức dịch thuật. Plugin là các công thức dịch thuật được đóng gói sẵn và được cài đặt vào `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

Xem [Đặc tả Plugin](/docs/reference/plugin-spec) để biết định dạng manifest của plugin.

---

## leaderboard

Duyệt, tìm kiếm và cài đặt các phương thức dịch thuật từ bảng xếp hạng Network. Các phương thức được cài đặt từ bảng xếp hạng đi kèm với điểm số benchmark và cấu hình MethodConfig chuẩn đầy đủ — cấu hình chính xác được sử dụng trong quá trình đánh giá.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Tùy chọn | Tác dụng |
|--------|--------|
| `--pair <code>` | Lọc bảng xếp hạng theo cặp ngôn ngữ (ví dụ: `en:fr`) |
| `--install <name>` | Cài đặt một plugin phương thức từ bảng xếp hạng |
| `--apply` | Sau khi cài đặt, tự động thêm `methodPlugin` vào `champollion.config.json` |

**Quy trình làm việc của `--apply`**: Khi bạn cài đặt bằng `--apply`, champollion sẽ ghi plugin phương thức vào `.champollion/methods/` **và** vá tệp `champollion.config.json` của bạn để sử dụng nó cho cặp ngôn ngữ tương ứng. Đây là con đường nhanh nhất từ "phương thức nào có điểm số tốt nhất?" đến "tôi đang sử dụng nó trong môi trường production."

---

## fonts

Tải xuống và quản lý các phông chữ web PUA cho các bộ chuyển đổi hệ chữ viết của ngôn ngữ nhân tạo. Các ngôn ngữ sử dụng các ký tự thuộc Vùng Sử dụng Riêng (Private Use Area - PUA) như Klingon, Sindarin, Kryptonian cần các phông chữ web tùy chỉnh để hiển thị chữ viết của chúng. Lệnh này sẽ tải chúng xuống từ các kho lưu trữ nguồn mở đã được xác minh.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Lệnh phụ | Đầu ra |
|------------|--------|
| `list` | Hiển thị những phông chữ PUA nào cần thiết và trạng thái cài đặt của chúng |
| `install` | Tải xuống phông chữ cho các ngôn ngữ đã được cấu hình |

| Tùy chọn | Tác dụng |
|--------|--------|
| `--dir <path>` | Ghi đè thư mục đầu ra của phông chữ (tự động phát hiện từ loại dự án) |
| `--css` | Tạo một đoạn mã `conlang-fonts.css` cùng với các phông chữ |
| `--config <path>` | Đường dẫn đến tệp cấu hình (được sử dụng để phát hiện ngôn ngữ nào cần phông chữ) |

**Tự động phát hiện**: Thư mục đầu ra được suy ra từ cấu trúc dự án của bạn:
- **Docusaurus** → `static/fonts/` hoặc `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Mặc định** → `public/fonts/`

**Các bộ chuyển đổi Unicode gốc** (`crk` → Chữ âm tiết Cree, `sr` → Chữ Cyrillic Serbia) KHÔNG yêu cầu cài đặt phông chữ.

Xem [Ngôn ngữ nhân tạo, Chữ viết & Chính tả](/docs/guides/conlangs-scripts-orthography) để biết chi tiết đầy đủ về phông chữ PUA.

## Quy trình ba lớp (Three-Layer Pipeline)

Sử dụng kết hợp `lint`, `sync`, và `audit` để có một quy trình i18n cực kỳ vững chắc:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Lớp | Lệnh | Khi nào | Mục đích |
|-------|---------|------|---------|
| **Lint** | `lint` | Trước khi commit | Chặn các commit có chứa chuỗi viết cứng |
| **Sync** | `sync` | Sau khi commit / CI | Dịch các khóa bị thiếu và thay đổi |
| **Verify** | `verify` | Sau khi đồng bộ / CI | Xác nhận các bản dịch có tồn tại và chính xác |
| **Audit** | `audit` | Bước build | Dừng triển khai (fail deployment) nếu bất kỳ locale nào có dấu hiệu `[EN]` |

---

## Xem thêm

- [Cấu hình](/docs/getting-started/configuration) — tài liệu tham khảo tệp cấu hình
- [Phương thức dịch thuật](/docs/guides/translation-methods) — lựa chọn phương thức cho từng cặp ngôn ngữ
- [Bộ nhớ dịch thuật](/docs/concepts/translation-memory) — lưu bộ nhớ đệm và tiết kiệm chi phí
- [Làm việc với dịch giả chuyên nghiệp](/docs/guides/professional-translators) — quy trình làm việc với XLIFF
- [Đặc tả Plugin](/docs/reference/plugin-spec) — định dạng manifest của plugin
- [Hướng dẫn CI/CD](/docs/guides/ci-cd) — tự động hóa các lệnh CLI trong pipeline của bạn
- [Cách hoạt động của Sync](/docs/concepts/how-sync-works) — tìm hiểu về quy trình đồng bộ hóa
- [Cổng chất lượng (Quality Gate)](/docs/concepts/quality-gate) — cách các bản dịch được xác thực
