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
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

Các lệnh hoạt động với chỉ mục dùng chung và bảng xếp hạng, thay vì với dự án
của bạn, được nhóm dưới `champollion network`. Mỗi lệnh cũng hoạt động mà không cần
tiền tố này:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Chạy `champollion <command> --help` để xem trợ giúp chi tiết về bất kỳ lệnh nào
(`champollion network` liệt kê các lệnh mạng).

## Tùy chọn toàn cục

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Cách viết một cặp ngôn ngữ

Một cặp ngôn ngữ trong dự án được viết theo cách `champollion.config.json` đặt khóa: `en:fr`. `sync`, `verify` và `serve` cũng đọc `en>fr` và `en-fr`, và `en-pt-BR` được so khớp với các cặp bạn đã cấu hình. Các lệnh mạng (`network register-corpus`, `leaderboard`, `recommend`, `submit`) viết một cặp dưới dạng `eng>crk`, định dạng mà bảng xếp hạng lưu trữ và `mt-eval` sử dụng, đồng thời đọc `eng-crk` và `eng:crk` theo cùng cách. Khi chỉ dùng dấu gạch nối, một cặp gồm hai mã gồm hai hoặc ba chữ cái (`eng-crk`). Mã có dấu gạch nối riêng cần `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` bị từ chối, không bao giờ tự suy đoán. Hãy đặt dạng `>` trong dấu ngoặc kép khi dùng shell: nếu không có ngoặc kép, `--pair eng>crk` sẽ chuyển hướng đầu ra vào một tệp tên là `crk`.

---

## init

Trình hướng dẫn thiết lập tương tác giúp tạo `champollion.config.json`. Hướng dẫn bạn thiết lập locale nguồn, ngôn ngữ đích, định dạng tệp và mô hình dịch thuật.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**Tùy chọn `--content-dir`**: Một thư mục chứa các tệp Markdown/MDX cần dịch cùng với các tệp locale của bạn (được viết dưới dạng `contentDir`). Thư mục này phải tồn tại; `init` sẽ dừng lại mà không ghi bất kỳ nội dung nào nếu thư mục không tồn tại.

**Dự án có tệp chỉ dành cho cục bộ sẽ mặc định thành `local`**: Phương thức mặc định là `llm` (OpenRouter, một dịch vụ được lưu trữ trên máy chủ). Khi bất kỳ tệp nào trong dự án được đánh dấu là chỉ cục bộ — một `<file>.champollion.json` bên cạnh với `"transmission": "local-only"`, như `champollion network register-corpus --data <file> --tier local-only` ghi — `init` (cũng như `--yes`) sẽ mặc định chuyển sang phương thức `local`: một mô hình được phục vụ trên máy này (`http://localhost:11434/v1` mặc định của Ollama, hoặc máy chủ mà `LOCAL_API_BASE` chỉ định). Lệnh sẽ nêu rõ lý do, gọi tên tệp được đánh dấu, và cách chủ động chọn một phương thức lưu trữ trên máy chủ: `champollion init --force --method llm --model <model>`. Tùy chọn `--method` rõ ràng luôn được ưu tiên; sau đó `init` sẽ ghi chú tệp được đánh dấu bên cạnh nơi văn bản được chuyển đến.

**Chạy lại `init` (`--force`)**: Nếu không có `--force`, `init` sẽ dừng khi `champollion.config.json` đã tồn tại. Khi có cờ này, `init` sẽ bắt đầu từ tệp đó và chỉ ghi lại những gì các cờ chỉ định: `--langs` thiết lập danh sách ngôn ngữ đích (ngôn ngữ đã có từ trước vẫn giữ nguyên mục nhập — ngữ vực, hệ chữ viết, tên gọi), `--method` đặt phương thức mặc định (và mô hình đi kèm, trừ khi `--model` chỉ định mô hình khác), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name`, và `--method api` cho các cặp ngôn ngữ được chỉ định. Lệnh chỉ phát hiện lại cấu trúc locale khi tệp không còn tìm thấy các tệp nguồn của bạn nữa (hoặc `--dir` chỉ định một thư mục khác). Mọi cài đặt khác — `batchSize`, `pairs`, `glossary`, phương án dự phòng (fallback), ngữ vực bạn đã chọn — vẫn giữ nguyên như cũ. Lệnh sẽ in ra từng trường đã thay đổi và những trường được giữ lại, đồng thời sao chép tệp trước đó sang `champollion.config.json.bak` trước (khi bản sao lưu đó đã chứa tệp cũ hơn, tệp tiếp theo sẽ là `.bak.2`, `.bak.3` …; bản sao lưu cũ không bao giờ bị ghi đè). Tệp không phải là JSON hợp lệ sẽ không thể giữ lại: tệp sẽ được sao lưu và một tệp mới sẽ được ghi. Để thay đổi một cài đặt, bạn chỉ cần chỉnh sửa trực tiếp trong tệp — `init` không bao giờ cần phải chạy lại chỉ vì điều đó.

**Tìm các tệp locale của bạn**: `init` tìm kiếm tệp của ngôn ngữ nguồn trước khi ghi bất kỳ nội dung nào. Lệnh kiểm tra thư mục thông thường của framework bạn dùng trước tiên (next-intl `messages/`, i18next `public/locales/<lang>/` rồi đến `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), sau đó đến `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` và `src/i18n`, rồi in ra những gì tìm thấy. Lệnh không bao giờ ghi một `localesDir` không tồn tại. Xem [Bố cục tệp locale](/docs/getting-started/configuration#locale-layouts).

**Tùy chọn `--langs`**: Danh sách các mã ngôn ngữ đích phân tách bằng dấu phẩy. Bỏ qua lời nhắc chọn ngôn ngữ và áp dụng cấu hình sẵn (preset) ngữ vực mặc định của từng ngôn ngữ — được ghi vào cấu hình, để bạn có thể nhìn thấy và chỉnh sửa: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (thay đổi thành một preset khác, hoặc bằng các từ ngữ của riêng bạn mô tả giọng văn; ngôn ngữ không có preset nào được ghi là `{}`). Tùy chọn này cũng tạo các tệp đích trống trong bố cục của bạn (`fr.json`, hoặc `fr/common.json` cho từng namespace). Kết hợp với `--yes` để thiết lập hoàn toàn không tương tác.

**`--method api --endpoint <url>`**: Máy chủ tuân theo hợp đồng API của champollion — ví dụ: một mô hình bạn đã huấn luyện, được phục vụ bởi `nmt-forge serve`. `init` ghi một cặp cho mỗi ngôn ngữ đích, cùng một mục nhập như `DEPLOY.md` bên cạnh mô hình: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` cho biết điểm cuối có tuân theo hướng dẫn cho từng khóa hay không (mô hình được huấn luyện bằng nmt-forge thì không); nếu không có cờ này, `init` sẽ lấy giá trị từ tệp manifest của plugin đã cài đặt cho cùng điểm cuối đó (`.champollion/methods/<name>/method.json`), hoặc để trống. Cần có `--langs` (điểm cuối được đặt theo từng cặp), và chỉ cần khóa (key) cho điểm cuối nằm ngoài máy này (`CHAMPOLLION_API_KEY`). Hãy thêm phương thức `fallback` vào cặp theo cách thủ công, như `DEPLOY.md` minh họa.

**Tùy chọn `--script`**: Một số ngôn ngữ được viết bằng nhiều hơn một hệ chính tả thực tế — tiếng Plains Cree (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Syllabics), tiếng Serbia (`sr`: `Latn`, `Cyrl`). Champollion không tự ý chọn thay cho một cộng đồng: `sync` từ chối dịch ngôn ngữ như vậy cho đến khi cấu hình chỉ định rõ một hệ chữ. Trình hướng dẫn sẽ hỏi; với `--yes`, hãy truyền `--script crk=Cans` (nhiều ngôn ngữ: `--script crk=Cans,sr=Latn`; với một ngôn ngữ đích duy nhất thì `--script Cans` là đủ), thao tác này sẽ ghi `"languages": { "crk": { "script": "Cans" } }`. Nếu không có tùy chọn này, `init --yes` sẽ thông báo những ngôn ngữ nào cần lựa chọn, liệt kê các lựa chọn và in dòng `"script"` để thêm vào mục nhập của ngôn ngữ đó trong cấu hình.

**Tùy chọn `--name`**: Mã sử dụng riêng (`qaa`–`qtz`, dành cho một biến thể chưa có mã xác nhận) không có thẻ ngôn ngữ, vì vậy `init` sẽ thông báo điều đó thay vì yêu cầu bạn kiểm tra chính tả. `--name qaa="Ayta (variety not yet confirmed)"` cung cấp tên hiển thị mà prompt và báo cáo sử dụng, được viết dưới dạng `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (nhiều ngôn ngữ: `--name "qaa=…;qab=…"`). Bên cạnh mỗi ngữ vực, `init` cũng in ra hướng dẫn về giống mà prompt LLM mang theo cho ngôn ngữ đó ([Hướng dẫn về giống](/docs/getting-started/configuration#gender-guidance)).

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
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Theo mặc định, `sync` tải `.champollion/tm.json` và cung cấp các bản dịch đã lưu trong bộ nhớ cache cho các giá trị nguồn không thay đổi. Việc chuyển đổi mô hình không làm mất đi điều đó: văn bản đã được dịch theo mô hình trước đó sẽ được tái sử dụng mà không tốn chi phí, và lệnh sync sẽ thông báo điều này trước phần ước tính chi phí. Để yêu cầu mô hình mới dịch lại chúng: `--redo all --fresh-on-model-change` — lệnh sẽ gửi các khóa mà mô hình trước đó đã dịch, còn những gì mô hình mới đã dịch vẫn được lấy từ cache (nếu đứng một mình, `--fresh-on-model-change` chỉ ảnh hưởng đến các khóa mà lượt chạy dù sao cũng sẽ dịch). Sử dụng `--no-tm` để bỏ qua bộ nhớ cache hoàn toàn (hữu ích khi gỡ lỗi chất lượng). Xem [Translation Memory](/docs/concepts/translation-memory).

**Ước tính chi phí và `--max-cost`**: Phần ước tính chỉ tính giá cho những gì lượt chạy sẽ tính phí. Các khóa, trường front-matter và khối Markdown đã có trong Translation Memory được tính giá $0, và bảng sẽ hiển thị những gì cache đã tiết kiệm được. Mô hình được phục vụ trên máy này (`local`, hoặc điểm cuối `api` tại `localhost`/`127.0.0.1`/`::1`) sẽ hiển thị `$0 (local)` — không có hóa đơn API; phần cứng và điện năng của bạn không được tính vào. `--max-cost` sẽ so sánh với con số đó. Nếu vượt quá giới hạn hoặc không có ước tính (phương thức không có giá công bố, chẳng hạn như `local` trỏ tới một máy khác), sync sẽ dừng lại trước bất kỳ lệnh gọi API nào và thoát với mã `2`; không có nội dung nào được dịch hoặc ghi. Dòng kết thúc cho biết có bao nhiêu khóa đã được gửi tới mô hình và bao nhiêu khóa được lấy từ cache.

Bên dưới bảng, một dòng sẽ hiển thị mức giá áp dụng và nguồn gốc của nó — đối với mô hình lưu trữ trên máy chủ, là giá trên 1M token đầu vào và đầu ra từ bảng giá công khai của OpenRouter, cùng thời điểm đọc giá (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); đối với nhà cung cấp trực tiếp (`openai`, `anthropic`, `gemini`), danh sách tương tự được dùng thay cho giá riêng của nhà cung cấp, và khi không đọc được danh sách (hoặc không có giá cho mô hình), một bản sao lưu trong champollion sẽ được dùng, kèm theo ngày kiểm tra gần nhất và lý do; DeepL, Google và Microsoft dựa trên giá công bố theo ký tự, kèm theo ngày cập nhật. Đây chỉ là ước tính: dòng này nêu rõ số lượng token (hoặc ký tự) giả định cho mỗi khóa, và hóa đơn thực tế sẽ tùy thuộc vào độ dài thực. Với `--json`, ước tính sẽ có thêm chi tiết: `rate` của từng cặp và `rates` của lượt chạy (`inputPerMillion`, `outputPerMillion` hoặc `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` hoặc `verified`).

**Xem trước yêu cầu**: `sync --dry --show-prompt [key]` in ra chính xác yêu cầu mà phương thức của cặp sẽ gửi đi — các thông điệp hệ thống và người dùng (hoặc đối với điểm cuối `api` là phần thân yêu cầu), được tạo bởi chính mã của phương thức đó, với các khóa API đã được ẩn bớt — và không gửi gì cả. Khi đi kèm với một khóa (được gọi theo cách `--redo keys:` đặt tên: `verb␄Open`, `common::nav.home`; một msgid của gettext có dấu phẩy có thể được cung cấp toàn bộ), lệnh hiển thị yêu cầu của khóa đó bất kể nó có nằm trong hàng đợi hay không. Khi một lượt chạy thực tế sẽ không gửi gì cho khóa đó (khóa đã cập nhật, được phục vụ từ cache hoặc bị giữ lại), lệnh sẽ nêu rõ và chỉ định lệnh `--redo keys:<key> --fresh` có thể gửi nó. Nếu không có khóa nào, lệnh sẽ hiển thị đợt (batch) đầu tiên mà mỗi tệp sẽ gửi, hoặc thông báo rằng sẽ không có gì được gửi. Đây là cách để kiểm tra xem gettext `msgctxt`, bình luận `#.` hoặc mô tả ARB có đến được mô hình hay không. Các công cụ dịch máy (DeepL, Google…) chỉ nhận riêng văn bản nguồn; bản xem trước sẽ nêu rõ điều này. Với `--json`, mỗi yêu cầu là một dòng `{"level": "event", "event": "request", …}`.

**Chạy thử (dry run)**: `--dry` không dịch gì và không ghi gì, nhưng lệnh kiểm tra trước những gì lượt chạy thực tế sẽ kiểm tra: khi thiếu khóa mà phương thức yêu cầu (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), lệnh cảnh báo rằng lượt chạy thực tế sẽ dừng lại và nêu tên biến. Lệnh kiểm tra xem khóa đã được đặt chưa, chứ không kiểm tra xem nó có hoạt động không: không có gì được gửi đi nên giá trị giữ chỗ (placeholder) vẫn được chấp nhận. Lệnh vẫn thoát với mã `0` — bản xem trước không bao giờ thất bại (xem [mã thoát](#sync-exit-codes)). Điều tương tự cũng áp dụng cho `--max-cost`: chạy thử không dừng lại ở mức giới hạn ngân sách, nhưng khi mức ước tính vượt quá giới hạn (hoặc không xác định), lệnh sẽ thông báo một lần ở cuối rằng lượt chạy thực tế sẽ dừng tại đó và thoát với mã `2`. Với `--json`, mỗi dòng là một đối tượng JSON có `level` (`info`, `ok`, `event` trên stdout; `warn`, `error` trên stderr), và dòng stdout cuối cùng là phần tóm tắt, `{"level": "summary", "command": "sync", …}`, chứa `preflight: { ready, failures }`, với mức giới hạn `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, và `realRun: { exitCode, wouldStop, reasons }` — mã thoát mà lượt chạy thực tế sẽ kết thúc, theo như những gì bản xem trước có thể nhận biết (xem [mã thoát](#sync-exit-codes)). Hãy chạy lệnh với các cờ mà lệnh sync thực tế sử dụng (`--method`, `--model`): nếu không có chúng, lệnh sẽ kiểm tra phương thức mà cấu hình chỉ định. Bản thân mã thoát của chạy thử không bao giờ làm thất bại bước CI, do đó cảnh báo `--max-cost` của nó hướng dẫn cách đặt cổng kiểm tra: đọc `maxCost.wouldStop` (hoặc `realRun.exitCode`) từ tóm tắt `--json` — ví dụ `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. [Bước kiểm tra trong hướng dẫn CI](/docs/guides/ci-cd#check-before-sync) thực hiện điều đó và khi thất bại, bước này in lý do (`realRun.reasons`) thay vì chỉ đưa ra `false` trống rỗng. `totalPluralGaps` của chạy thử đếm các thông điệp số nhiều trên đĩa thiếu dạng mà ngôn ngữ sử dụng mà lượt chạy thực tế sẽ không yêu cầu lại, và `verify` là `{ "ran": false }` (không có gì được ghi nên không có gì được xác minh).

**Dịch lại**: `--redo` cho biết *cái gì* cần dịch lại và `--fresh` cho biết *có phải trả phí cho việc đó hay không*. Nếu không có `--fresh`, bất kỳ nội dung nào bộ nhớ cache đã có sẽ được lấy lại miễn phí (và vẫn vượt qua cổng chất lượng); khi có cờ này, mọi thứ trong hàng đợi sẽ được dịch mới và bị tính phí. Các cờ cũ hơn (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) vẫn hoạt động và có ý nghĩa chính xác như bảng mô tả.

**Giới hạn phạm vi theo tệp**: `--files` giới hạn bước dịch nội dung cho các tệp khớp mẫu, và `--redo files:<glob> --fresh` buộc dịch mới cho các tệp khớp mẫu (trường hợp chủ động chi trả lại duy nhất). Các mẫu khớp với các đường dẫn mà sync in ra (tương đối so với `contentDir`, `2026-10.md`) và cùng đường dẫn đó tính từ thư mục gốc của dự án (`newsletter/2026-10.md`): `*` chỉ nằm trong một thư mục và `**` áp dụng xuyên suốt các thư mục. Cả hai cờ đều có thể lặp lại nhiều lần. Một mẫu không khớp với tệp nào sẽ dừng lượt chạy trước khi bất kỳ chi phí nào phát sinh. Bước dịch key-value vốn đã mang tính lũy tiến (incremental) và chạy như bình thường.

**Xử lý lỗi**: Một tệp nội dung bị lỗi không làm dừng các tệp khác. Các tệp thành công được ghi nhận và bản dịch của chúng được lưu vào cache, và lượt chạy kết thúc với danh sách các tệp bị lỗi kèm trạng thái còn lại của từng tệp. Dòng thông tin tệp không bao giờ hiển thị `[OK]` khi các khóa trong đó chưa được dịch. Phần tóm tắt lỗi nêu rõ, theo từng khóa, những gì lần sync tiếp theo sẽ thực hiện: yêu cầu lại (không có phản hồi sử dụng được), yêu cầu thêm một lần nữa (đang chờ xử lý từ một lần làm lại - redo), hoặc giữ lại (bị từ chối bởi cổng chất lượng). Các khối Markdown và trường front-matter bị cổng từ chối cũng được giữ lại theo cách tương tự, theo từng trang; `--redo files:<page>` hoặc `--redo content` sẽ yêu cầu dịch lại ([Cổng chất lượng](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Mã thoát là `0` (mọi thứ ổn thỏa), `2` (một phần: một số việc đã hoàn thành, có thứ bị lỗi, bị giữ lại hoặc không xác minh được, một thông điệp số nhiều được ghi thiếu dạng mà ngôn ngữ sử dụng cho các số đếm thông thường — hoặc bị dừng bởi `--max-cost` trước khi chi tiêu bất kỳ khoản nào) hoặc `1` (không có gì thành công).

**Phát hiện thay đổi**: champollion lưu trữ các hàm băm SHA-256 trong `.champollion.lock`. Khi giá trị nguồn thay đổi, lần sync tiếp theo sẽ tự động dịch lại các khóa đó. Hãy commit tệp lock để tất cả các nhà phát triển chia sẻ cùng một mốc chuẩn (baseline). Tệp lock cũng ghi lại, theo từng locale đích, dấu vết (fingerprint) của từng giá trị mà sync đã ghi (để giá trị do người chỉnh sửa được nhận diện và giữ lại trong các lần redo hàng loạt — [Chỉnh sửa bản dịch](/docs/guides/professional-translators#editing-key-value-files)), các khóa mà lần redo không thể hoàn tất (**pending**: lần sync tiếp theo sẽ yêu cầu chúng thêm một lần nữa) và các khóa bị cổng chất lượng từ chối (**held back**: không gửi lại cho cùng mô hình đó trong một lần sync thông thường — [Cổng chất lượng](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Chỉnh sửa thủ công và làm lại (redo)**: `--redo all`, `--force` và việc chuyển đổi mô hình sẽ giữ nguyên các giá trị mà một người đã chỉnh sửa, đồng thời cho biết rõ giá trị nào; `--redo keys:<key>` khi chỉ định tên khóa sẽ ghi đè khóa đó; một khóa có nguồn thay đổi sẽ được dịch lại. Giá trị chỉnh sửa bị thay thế sẽ được in ra và nối thêm vào `.champollion-replaced-edits.jsonl` (được theo dõi — hãy commit cùng với tệp lock).

**Khóa gettext có ngữ cảnh (context)**: một khóa là `msgctxt` + U+0004 + `msgid`. Báo cáo in ký tự phân cách dưới dạng `␄`, dạng mà `--redo keys:` và `--force-keys` chấp nhận; để nhập, hãy viết `\x04`: `--redo 'keys:django::verb\x04Open'` (dấu ngoặc đơn giúp giữ lại dấu gạch chéo ngược). Cả hai cách viết đều hoạt động. Các lệnh sửa chữa in ra dạng `␄`, theo sau là một bình luận shell chỉ rõ `\x04`.

**Khóa được chỉ định tên nhưng không khớp**: `--redo keys:` / `--force-keys` với tên không có trong bất kỳ khóa nguồn nào (lỗi đánh máy, hoặc msgid chỉ tồn tại cùng với một ngữ cảnh) sẽ thất bại với mã thoát 1. Lỗi sẽ liệt kê các khóa gần đúng nhất, bao gồm mọi biến thể ngữ cảnh của msgid đó, theo cả hai cách viết. Khi không có tên nào khớp, sẽ không có gì chạy. Khi có một số tên khớp, những tên đó sẽ được làm lại, rồi lượt chạy sẽ thất bại và nêu tên những phần còn lại.

**Khóa được chỉ định tên lấy từ bộ nhớ cache**: nếu không có `--fresh`, một lần redo sẽ trả về những gì cache đang lưu (được kiểm tra lại, không tốn phí) và thông báo điều đó, kèm theo lệnh `--fresh` để yêu cầu mô hình dịch lại cùng chi phí của nó.

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

Thanh tiến trình cập nhật tại chỗ sau mỗi đợt (~80 khóa). Sử dụng `--quiet` để chỉ hiển thị lỗi/cảnh báo, hoặc `--json` để xuất dữ liệu NDJSON cho máy đọc. Cả hai tùy chọn đều ẩn thanh tiến trình và biểu ngữ. Với `--json`, sự kiện `cost` sẽ xuất hiện trước cổng `--max-cost`, sự kiện `file` sẽ xuất hiện cho từng tệp nội dung và locale, và `summary` sẽ kết thúc mỗi lượt chạy.

### Mã thoát {#sync-exit-codes}

| Mã | Lượt chạy thực tế | Chạy thử (`--dry`) |
|------|------------|---------------------|
| `0` | Mọi nội dung trong hàng đợi đã được dịch và xác minh, hoặc không có gì trong hàng đợi. | Đã chạy — ngay cả khi thông báo rằng lượt chạy thực tế sẽ dừng lại. |
| `2` | Một phần: một số việc đã hoàn thành, nhưng có thứ bị lỗi, bị giữ lại hoặc không xác minh được, hoặc một thông điệp số nhiều được ghi thiếu dạng mà ngôn ngữ sử dụng cho các số đếm thông thường. Ngoài ra: `--max-cost` đã dừng lượt chạy trước khi gửi bất cứ thứ gì. | Không bao giờ. |
| `1` | Không có gì thành công, hoặc lượt chạy không thể khởi động: thiếu khóa mà phương thức yêu cầu, máy chủ mô hình mà lượt chạy cần không phản hồi, khóa được chỉ định để làm lại không khớp với bất kỳ khóa nào, mẫu `--files` không khớp với tệp nào, hoặc cấu hình không hợp lệ. | Bản thân việc chạy thử không thể thực hiện: khóa được chỉ định để làm lại không khớp với bất kỳ khóa nào, mẫu `--files` không khớp với tệp nào, hoặc cấu hình không hợp lệ. |

Lệnh chạy thử cố ý thoát với mã `0`: đó là bản xem trước bạn chạy trước khi đưa ra quyết định, và bước CI chỉ mang tính kiểm tra không được phép thất bại. Những gì lượt chạy thực tế sẽ làm nằm ở các dòng cuối cùng của lệnh chạy thử và trong phần tóm tắt `--json` của nó: `preflight.ready: false` có nghĩa là lượt chạy thực tế sẽ dừng trước khi dịch và thoát với mã `1` (`preflight.failures` nêu rõ lý do); `maxCost.wouldStop: true` có nghĩa là nó sẽ dừng lại ở mức giới hạn ngân sách và thoát với mã `2` (`maxCost.exitCode: 2`); `maxCost.exitCode: 1`, cùng với `maxCost.stopsEarlier`, có nghĩa là bước kiểm tra trước (preflight) sẽ dừng nó trước khi kiểm tra giới hạn. `realRun.exitCode` tập hợp tất cả lại, cùng với những điều khiến lượt chạy thực tế chỉ hoàn thành một phần: các khóa bị giữ lại, hoặc các thông điệp số nhiều trên đĩa thiếu dạng mà ngôn ngữ sử dụng mà nó sẽ không yêu cầu lại (`2`; `realRun.reasons` nêu rõ tên chúng, và dòng cuối cùng của chạy thử sẽ thông báo điều đó). Việc cổng chất lượng từ chối hoặc xác minh thất bại, điều mà chỉ lượt chạy thực tế mới có thể phát hiện, vẫn có thể biến kết quả dự đoán từ `0` thành `2`. [Bước kiểm tra trong hướng dẫn CI](/docs/guides/ci-cd#check-before-sync) biến chúng thành một bước CI thất bại có in rõ lý do.

---

## watch

Tự động đồng bộ hóa khi tệp locale nguồn thay đổi. Chạy cho đến khi bị ngắt bằng `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Cổng kiểm tra tính đầy đủ. Liệt kê mọi khóa chưa được dịch — bị thiếu, để trống, hoặc vẫn là phương án dự phòng `[EN]` — và mọi bản dịch đã **lỗi thời**: được tạo từ văn bản nguồn cũ hơn bản hiện tại (theo `.champollion.lock`; việc chỉnh sửa nguồn nhưng dịch lại thất bại sẽ dẫn đến tình trạng này). Mỗi danh sách lỗi thời kết thúc bằng lệnh để dịch lại mục đó. Thoát với mã 1 nếu tìm thấy bất kỳ trường hợp nào — sử dụng làm cổng CI để làm thất bại bản build có bản dịch chưa hoàn tất hoặc bị cũ.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Đọc lại tất cả các tệp locale từ đĩa và xác minh xem các bản dịch có thực sự tồn tại và chính xác hay không. Đây chính là quy trình xác minh tự động chạy ở cuối mỗi lệnh `sync` (trừ khi `--no-verify` được truyền vào).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**Những gì lệnh kiểm tra:**
- Tính tương đồng của khóa (key parity) — tất cả các khóa nguồn đều có mặt trong từng ngôn ngữ đích (đối với các khóa số nhiều i18next, là các khóa của chính các dạng số nhiều CLDR thuộc locale đó: tiếng Pháp cũng cần `count_many`)
- Dấu hiệu dự phòng `[EN]` từ các lượt chạy trước
- Bản dịch trống
- Tính tuân thủ hệ chữ viết — locale không dùng chữ Latinh không được chứa toàn văn bản Latinh; các chữ cái được phân loại theo hệ chữ viết Unicode, do đó chữ Latinh có dấu và chữ Latinh độ rộng đầy đủ (fullwidth) vẫn được tính là Latinh. Chữ cái Latinh fullwidth là một lỗi trong bất kỳ locale nào ngoài phạm vi nghệ thuật in ấn CJK
- Phần giữ chỗ (placeholder), mỗi phát hiện được gọi tên theo cú pháp liên quan — cấu trúc ICU MessageFormat (`ICU structure error`: một đối số `{name}`, một từ khóa hoặc bộ chọn plural/select bị dịch, mất `#`), các phép chuyển đổi printf (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — một `%(name)s` bị mất trong gettext catalog được định danh là printf, không phải ICU), phép nội suy i18next (`i18next {{…}} placeholder mismatch`: `{{name}}`, bao gồm `{{name}}` được viết dưới dạng `{name}`, thứ mà i18next in ra nguyên bản), và một dấu ngoặc nhọn đơn `{name}` nằm ngoài thông điệp ICU (`{…} placeholder mismatch`)
- Thẻ định dạng (markup) — theo từng tên thẻ phải có đủ thẻ mở, thẻ đóng và thẻ tự đóng như nguồn, được lồng theo cùng một cách (mất `</strong>` là một lỗi)
- Vấn đề mã hóa — ký hiệu BOM, các ký tự ẩn
- Trùng lặp nguồn (source echo) — giá trị giống hệt nguồn (cảnh báo)
- Dạng số nhiều — thông điệp số nhiều thiếu dạng mà ngôn ngữ sử dụng cho các số đếm thông thường (tiếng Nga `few`/`many`), một mục gettext có các dạng chỉ lặp lại `other` (sync đánh dấu những mục này bằng bình luận `# champollion:`), một khóa i18next hoặc `msgstr[n]` cho một dạng mà ngôn ngữ không có (cảnh báo)
- Locale giống hệt nhau — hai locale đích có cùng văn bản cho hầu hết các khóa: có thể locale này đang dùng ngôn ngữ của locale kia (cảnh báo)
- Cùng văn bản, khác nguồn — một văn bản được viết cho nhiều chuỗi nguồn khác nhau (mô hình lặp lại một câu học vẹt): hai chuỗi nhiều từ khác nhau rõ rệt lại được trả về cùng một văn bản từ bốn từ trở lên, hoặc từ ba từ trở lên trong các trường hợp khác; một câu mà lần sync trước đã phát hiện mô hình lặp lại sẽ bị tính ngay cả khi chỉ xuất hiện một lần. Điều này được kiểm tra trên các giá trị khóa, từng nhánh plural/select của ICU (các nhánh của một số nhiều được tính là một nguồn) và các trang Markdown của locale (các trường front-matter và các khối; bỏ qua `# ` và dấu câu kết thúc), theo cùng quy tắc mà cổng của `sync` dùng để từ chối (lỗi)
- Lỗi thời — bản dịch được tạo từ văn bản nguồn cũ hơn bản hiện tại (cảnh báo tại đây; `audit` sẽ báo lỗi thất bại vì điều này)
- Mất dấu chấm hỏi hoặc dấu chấm than — nguồn kết thúc bằng `?` hoặc `!` và bản dịch không kết thúc bằng dấu đó cũng như dấu tương đương trong hệ chữ của ngôn ngữ đích (`？`, `؟`, `;` của tiếng Hy Lạp, …). Đây là một cảnh báo: một số ngôn ngữ đánh dấu câu hỏi bằng một từ hoặc tiểu từ

Lệnh này kiểm tra cấu trúc, không kiểm tra ngữ nghĩa: việc vượt qua kiểm tra chỉ cho biết các khóa, placeholder, dạng số nhiều,
markup và hệ chữ viết còn nguyên vẹn, chứ không có nghĩa là văn bản diễn đạt đúng — hãy nhờ
người bản ngữ xem lại trước khi tin cậy sử dụng.

**Những locale nào.** `verify` kiểm tra mọi locale; `verify --pair en:fr` chỉ kiểm tra
tiếng Pháp. Sau `sync --pair en:fr`, bước kiểm tra sau khi sync chỉ bao quát các cặp
đã chạy, không kiểm tra các cặp khác. Bước kiểm tra có giới hạn phạm vi sẽ thông báo điều đó ở dòng kết thúc — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` dòng đó chứa
`checked` (các locale đã kiểm tra) và `scope`.

**Độ bao phủ số nhiều.** Khối của mỗi locale có một dòng cho mỗi loại số nhiều mà
các tệp của nó chứa — các khóa có hậu tố của i18next, các thông điệp số nhiều ICU, các mục
`msgid_plural` của gettext — nêu tên các dạng mà locale dự kiến sẽ có
(các danh mục số nhiều của CLDR dành cho ngôn ngữ đó; trong gettext catalog, là những dạng mà
`Plural-Forms` của nó có vị trí) và liệu mọi số nhiều có đủ các dạng đó hay không:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` nêu tên các dạng số nhiều còn thiếu một dạng cụ thể. Một dạng chỉ dành cho các số trên 1000 hoặc
phân số (như `many` tiếng Pháp trong thông điệp ICU) được nêu riêng: dạng `other`
được dùng thay thế, và điều này không bị tính là một lỗi phát hiện. Dòng này là bản tóm tắt — việc
thiếu một dạng cũng là một phát hiện ở phía trên (thiếu khóa, cảnh báo số nhiều).

**`--json`** ghi một đối tượng JSON trên mỗi dòng. Mỗi locale nhận một bản ghi trên
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — với
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), `errors` của nó,
`warnings` và `infos`, `placeholders` (mỗi phát hiện đi kèm `syntax` của nó: `icu`,
`printf`, `i18next`, `brace` hoặc `markup`) và `plurals` (theo từng chủng loại và kiểu:
`categories`, `total`, `complete`, `incomplete`). Các phát hiện cũng là
các dòng `error`/`warn` trên stderr, và dòng kết thúc giữ nguyên cấp độ và
thông điệp của nó (`ok` trên stdout khi kiểm tra thành công, `error` trên stderr khi không thành
công) và mang theo số đếm `errors` cùng `warnings`. Sau khi sync, các bản ghi
tương tự sẽ xuất hiện trước phần tóm tắt của chính lệnh sync. (Bản ghi của dự án Docusaurus
không có `keys` hoặc `plurals`: các chuỗi UI của nó được kiểm tra theo từng tệp.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Mã thoát:** `1` khi phát hiện thấy lỗi — hoặc khi không thể kiểm tra bất cứ thứ gì
(tệp nguồn hoặc thư mục locale không nằm ở vị trí mà cấu hình chỉ định;
dòng lỗi sẽ nêu rõ đường dẫn và cài đặt), `0` cho các trường hợp khác. Cảnh báo không làm
lệnh thất bại trừ khi bạn truyền `--strict`, tùy chọn này sẽ thoát với mã `1` khi có bất kỳ cảnh báo nào (chẳng hạn quy trình CI
không được phép phát hành các dạng số nhiều tiếng Nga thiếu dạng `few`/`many`) và kết thúc
bằng một dòng `[FAIL]`, không bao giờ là dòng `[OK]`; `--warn-only` cũng khiến các lỗi thoát với mã `0`
. Locale có số lượng khóa không khớp sẽ thông báo thay vì `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Quét mã nguồn để tìm các chuỗi hiển thị cho người dùng bị viết cứng (hardcoded) mà lẽ ra nên sử dụng các lệnh gọi dịch thuật i18n. Tự động phát hiện framework của bạn (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
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

**Không có gì để lint là một lỗi**: khi không có tệp nguồn nào khớp (các thư mục mặc định của framework — `src/`, `app/`, `pages/`, `components/` cho các dự án web — hoặc `--src` của bạn), lint sẽ thoát với mã `1` và nêu tên các thư mục cũng như phần mở rộng mà nó đã tìm kiếm. Một lệnh lint không kiểm tra gì thì không được phép vượt qua cổng CI; hãy trỏ lệnh tới mã của bạn bằng `--src <dir>` hoặc `"lint": { "srcDir": "<dir>" }`.

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

**Những gì lệnh kiểm tra:**
- Placeholder bị hỏng (ví dụ: `{name}` có trong nguồn nhưng thiếu ở đích)
- Vấn đề mã hóa (mojibake, Unicode không hợp lệ)
- Bản sao chưa dịch (giá trị đích giống hệt nguồn) — các khóa [`noTranslate`](/docs/getting-started/configuration#no-translate) được miễn trừ, cũng như các trường hợp trùng lặp nguồn mà Translation Memory xác nhận là do pipeline tạo ra và đã được cổng phê duyệt. Những gì còn bị gắn cờ chính xác là những gì `sync` sẽ đưa lại vào hàng đợi — hai công cụ không thể bất đồng về một tệp ổn định
- Độ lệch no-translate (khóa `noTranslate` *không* giống hệt nguồn) — được báo cáo kèm giá trị dự kiến/thực tế và các ký tự ẩn được escape; chạy `champollion sync` để sửa
- Ký tự PUA không mong muốn (các điểm mã Private Use Area trong một locale có [chuyển đổi hệ chữ viết](/docs/getting-started/configuration#script-conversion) đang tắt — sẽ hiển thị trống nếu không có phông chữ đặc biệt); chạy `champollion repair-script` để sửa
- Giá trị rỗng ruột (đích là chuỗi nguồn bị xóa hết chữ cái — hư hại từ một pipeline cũ hơn trước khi có cổng bảo toàn nội dung); hãy dịch lại bằng `sync --force-keys <key>` hoặc `sync --pair <pair> --force`
- Khóa mồ côi (khóa ở đích không tồn tại ở nguồn)
- Tính đầy đủ của danh mục số nhiều ICU MessageFormat (ví dụ: tiếng Ả Rập cần 6 danh mục) — theo cùng quy tắc mà `sync` và `verify` sử dụng: thiếu dạng mà các số đếm thông thường chạm tới (tiếng Nga `few`/`many`) là một cảnh báo; dạng chỉ các số trên 1000 hoặc phân số mới chạm tới (tiếng Pháp `many`, dùng cho 1 000 000) là một ghi chú, vì dạng `other` được sử dụng ở đó

---

## repair-script

Đảo ngược quá trình chuyển đổi hệ chữ viết lẽ ra không nên xảy ra: các giá trị mã hóa PUA (pIqaD, Tengwar, Kryptonian) trong các locale có cấu hình tắt tính năng chuyển đổi sẽ được khôi phục về dạng Latinh hóa thông qua bảng đảo ngược của chính bộ chuyển đổi.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Tùy chọn | Tác dụng |
|--------|--------|
| `--dry` | Xem trước các sửa chữa mà không ghi |
| `--locale <code>` | Chỉ sửa chữa một locale |
| `--json` | Đầu ra JSON cho máy đọc |
| `--warn-only` | Thoát với mã 0 ngay cả khi vẫn còn ký tự PUA không thể đảo ngược |

pIqaD được đảo ngược chính xác. Việc đảo ngược Tengwar và Kryptonian không thể khôi phục chữ hoa (được gắn cờ là case-lossy). Translation Memory không cần sửa chữa — nó lưu trữ các giá trị trước khi chuyển đổi. Lệnh thoát với mã 1 khi vẫn còn PUA mà không có bộ chuyển đổi đã đăng ký nào có thể đảo ngược được.

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

Hiển thị cấu hình cặp ngôn ngữ, các plugin đã cài đặt và điểm chuẩn benchmark.

Một cặp ngôn ngữ có cấu hình đặt `qualityTier` (`standard`, `high`, `research` hoặc
`verified`) sẽ hiển thị thông tin đó, đúng với bản chất của nó: một nhãn do bạn chọn chứ không phải
một phép đo lường — sync vẫn dịch như nhau bất kể nhãn ghi gì, và `serve`
sẽ quảng bá nhãn đó. Cặp không thiết lập nhãn nào sẽ hiển thị none (`--json` vẫn có
`qualityTier`, với `qualityTierSet: false`).

```bash
champollion status
```

Sau khi chuyển đổi mô hình, lệnh cũng thông báo khi các tệp của một locale có chứa văn bản kết hợp từ nhiều
mô hình (từ Translation Memory: mô hình nào đã tạo ra từng giá trị
trên đĩa), kèm theo lệnh để mô hình hiện tại dịch lại những giá trị mà
mô hình trước đó đã viết — `sync --pair <pair> --redo all --fresh-on-model-change`.
Đối với phương thức chạy một mô hình do bạn chọn (`local`, `api`, `external`), lệnh
lặp lại ghi chú giấy phép mà lần sync đầu tiên đã in một lần. Đối với phương thức tương thích với OpenAI
(`local`, `openai`), lệnh hiển thị địa chỉ mà các yêu cầu được gửi tới và cài đặt
đã chọn địa chỉ đó: `LOCAL_API_BASE` trong biến môi trường hoặc trong `.env`, hoặc mặc định
(Ollama, `http://localhost:11434/v1`). Với `contentDir`, lệnh liệt kê thư mục nội dung
bên cạnh các tệp key-value, cùng số trang nguồn mà thư mục này chứa và số lượng bản dịch
theo từng ngôn ngữ là hiện tại, lỗi thời hay đang chờ xử lý.
Đang chờ xử lý (pending) có nghĩa là chưa có bản dịch, hoặc các phần bị cổng chất lượng từ chối được giữ nguyên ở ngôn ngữ nguồn (content lock hiển thị `pending:<hash>`).
Bên dưới mỗi ngữ vực, lệnh hiển thị hướng dẫn về giới tính mà prompt LLM mang theo và nguồn gốc
của hướng dẫn đó (mặc định của Champollion cho ngôn ngữ, cấu hình của bạn, hoặc tắt —
xem [Hướng dẫn về giống](/docs/getting-started/configuration#gender-guidance)).
Đối với một cặp có phương án dự phòng (fallback), lệnh đếm số lượng giá trị trong các tệp mà fallback
đã ghi và liệt kê một vài giá trị đầu tiên.
`--json` mang nội dung tương tự như `requestsGoTo` (trên một cặp hoặc fallback có điểm cuối như vậy), `content`, `genderGuidance` và `fallback.valuesInFiles`.

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
champollion plugin remove my-method          # remove a plugin
```

Xem [Đặc tả Plugin](/docs/reference/plugin-spec) để biết định dạng manifest của plugin.

---

## leaderboard

`champollion network leaderboard` (cũng hoạt động dưới dạng `champollion leaderboard`). Duyệt, tìm kiếm và cài đặt các phương thức dịch từ bảng xếp hạng Network. Các phương thức được cài đặt từ bảng xếp hạng đi kèm điểm benchmark và toàn bộ MethodConfig chuẩn hóa — cấu hình chính xác được sử dụng trong quá trình đánh giá.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Tùy chọn | Tác dụng |
|--------|--------|
| `--pair <pair>` | Lọc theo cặp ngôn ngữ, như cách bảng xếp hạng viết: `"eng>fra"` (ISO 639-3; đặt `>` trong dấu ngoặc kép). `eng-fra` và `eng:fra` cũng hoạt động, và mã gồm 2 chữ cái sẽ được phân giải (`en` → `eng`) |
| `--install <rank>` | Cài đặt phương thức ở thứ hạng đó (như được liệt kê) dưới dạng plugin |
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
