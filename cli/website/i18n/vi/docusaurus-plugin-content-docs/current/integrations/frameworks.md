# Hướng dẫn tích hợp

Thiết lập từng bước cho champollion với các framework phổ biến.

Các lệnh trên trang này chạy champollion với `npx --yes champollion@0.6 <command>`: được ghim ở nhánh 0.6, như trong [hướng dẫn CI](/docs/guides/ci-cd), để máy tính xách tay của bạn và CI chạy cùng một phiên bản và bản phát hành mới không bao giờ làm thay đổi lượt chạy một cách bất ngờ. Cài đặt cục bộ theo dự án là một phương án thay thế. Trong một dự án Node, `npm install --save-dev champollion@0.6` sẽ thêm nó vào `package.json`, và `npx champollion sync` sau đó sẽ chạy bản sao đó.

---

## Thiết lập khóa API

Trước khi tích hợp với bất kỳ framework nào, bạn cần có khóa API dịch thuật. Champollion hỗ trợ hai nhà cung cấp:

### Tùy chọn A: OpenRouter (khuyến nghị)

[OpenRouter](https://openrouter.ai) cung cấp API hợp nhất cho hơn 200 mô hình LLM. Có gói miễn phí.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Phù hợp nhất cho: các dự án nhiều nội dung, dịch Markdown, và các dự án cần bảo vệ nhận biết nội dung (khối mã, shortcode, biến nội suy).

### Tùy chọn B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Phù hợp nhất cho: khối lượng lớn các cặp chuỗi khóa-giá trị (194 ngôn ngữ). **Không khuyến nghị** cho nội dung Markdown — Google Translate không có khả năng nhận biết các khối mã, shortcode hoặc biến nội suy.

Để sử dụng Google Translate một cách tường minh:

```bash
champollion sync --method google-translate
```

> **Mẹo**: Nếu chỉ có `GOOGLE_TRANSLATE_API_KEY` được đặt (không có khóa OpenRouter), champollion sẽ tự động chuyển sang Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Cấu trúc dự án

Hugo sử dụng `i18n/` cho các bản dịch chuỗi và `content/` cho nội dung trang:

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### Thiết lập

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Tạo `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### Chi tiết dịch nội dung

**Front matter**: Hỗ trợ cả dấu phân cách YAML (`---`) và TOML (`+++`). Mặc định dịch `title`, `description`, `summary`, `subtitle`, `caption`, và `linkTitle`. Mọi trường khác (date, draft, tags, weight, slug, v.v.) đều được giữ nguyên. Tùy chỉnh bằng `translatableFields` trong tệp cấu hình của bạn.

**Bảo vệ khối**: Các khối mã, shortcode của Hugo (`{{< >}}`, `{{% %}}`), mã nội dòng và HTML thô được tự động bảo vệ bằng các trình giữ chỗ lính canh Unicode. Chúng được giữ nguyên vẹn qua quá trình dịch.

**Quy ước đặt tên tệp**: Tuân theo mẫu dịch theo tên tệp của Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (loại bỏ hậu tố nguồn)

**Bỏ qua tệp đã có**: Các tệp đã dịch hiện có không bao giờ bị ghi đè. Hãy xóa tệp đích để buộc dịch lại.

### Dạng số nhiều

Các tệp bản địa hóa TOML và YAML hỗ trợ các dạng số nhiều của CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Về mặt nội bộ, chúng được biểu diễn dưới dạng `items.one` và `items.other` để so sánh khác biệt, sau đó được tuần tự hóa lại thành định dạng phân phần chính xác khi ghi.

---

## next-intl (JSON)

### Cấu trúc dự án

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### Thiết lập

```bash
npm install --save-dev champollion
```

Chạy `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Lệnh này tìm `messages/en.json`, tạo các tệp đích trống và ghi cấu hình tương tự như bên dưới. Hoặc bạn có thể tự tạo `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": {
    "fr": "formal-vous", "de": "formal-Sie", "ja": "polite", "es": "neutral-latam",
    "ko": "polite-haeyo", "zh": {}, "pt": "professional", "ar": {}
  }
}
```

Sắc thái (register - giọng điệu và mức độ trang trọng) của mỗi mục tiêu được ghi vào `languages`, để bạn có thể xem và chỉnh sửa: thay đổi sang một thiết lập sẵn khác của ngôn ngữ (`champollion status` liệt kê chúng) hoặc theo lời diễn đạt của riêng bạn. Ngôn ngữ không có thiết lập sẵn được ghi là `{}`. Một danh sách đơn giản, `"languages": ["fr", "de"]`, cũng hoạt động và sử dụng mặc định của từng ngôn ngữ.

```bash
npx --yes champollion@0.6 sync
```

Tạo `messages/fr.json`, `messages/ja.json`, v.v. — được dịch hoàn chỉnh, bảo toàn cấu trúc khóa lồng nhau của bạn. next-intl sẽ tự động nhận diện chúng.

### Quy trình phát triển

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next (JSON)

### Thư mục cho mỗi ngôn ngữ (mặc định của i18next)

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,ja
```

`init` tìm thấy `public/locales/en/` (hoặc `locales/en/`), trỏ cấu hình vào đó, và tạo `fr/common.json`, `fr/admin/users.json` cùng các tệp khác dưới dạng tệp trống. Phần cấu hình liên quan mà lệnh này ghi ra:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.6 sync
```

Mỗi tệp không gian tên được dịch và ghi vào cùng một đường dẫn trong thư mục của từng ngôn ngữ. Một chuỗi xuất hiện trong nhiều không gian tên chỉ được dịch một lần cho mỗi ngôn ngữ; các tệp khác nhận chuỗi đó từ Bộ nhớ dịch thuật. Các khóa số nhiều (`key_one`, `key_other`) nhận các dạng riêng của từng ngôn ngữ, được đọc từ CLDR thông qua API JavaScript `Intl.PluralRules`: dạng mà ngôn ngữ sử dụng nhưng nguồn còn thiếu sẽ được thêm vào, còn dạng ngôn ngữ không dùng sẽ bị loại bỏ. Với nguồn là tiếng Anh, tiếng Tây Ban Nha và tiếng Pháp có thêm `key_many`, tiếng Nga có thêm `key_few` và `key_many`, còn tiếng Nhật chỉ giữ lại `key_other`. Sync sẽ gọi tên các dạng mà mỗi ngôn ngữ của bạn nhận được. Xem [khóa số nhiều i18next](/docs/getting-started/configuration#i18next-plurals) và [Bố cục tệp bản địa hóa](/docs/getting-started/configuration#locale-layouts).

### Mỗi ngôn ngữ một tệp

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### Các bố cục khác

Nếu các tệp của bạn tuân theo một mẫu khác, hãy mô tả mẫu đó bằng `localesPattern` (`{lang}` là ngôn ngữ, `{ns}` là không gian tên):

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "src/i18n/{ns}/{lang}.json",
  "languages": ["fr", "de", "ja"]
}
```

---

## Flutter (ARB)

### Cấu trúc dự án

`flutter gen-l10n` đọc một tệp `.arb` cho mỗi ngôn ngữ. Tệp tiếng Anh đóng vai trò là mẫu:

```
my_app/
├── l10n.yaml              ← optional: arb-dir, template-arb-file
├── lib/
│   └── l10n/
│       ├── app_en.arb     ← source of truth (template)
│       ├── app_fr.arb
│       └── app_pt_BR.arb
└── pubspec.yaml           ← flutter: generate: true
```

### Thiết lập

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init` đọc `pubspec.yaml` và `l10n.yaml` (`arb-dir`, `template-arb-file`), lấy ngôn ngữ nguồn từ tên của tệp mẫu (`app_en.arb` → `en`), và tạo `app_fr.arb`, `app_de.arb` cùng `app_pt_BR.arb` với `@@locale` của chúng. Cấu hình được ghi:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Nếu `l10n.yaml` đặt `arb-dir: assets/i18n` và `template-arb-file: intl_en.arb`, mẫu sẽ là `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

Chỉ các thông điệp được dịch. Mỗi mục tiêu sẽ có `"@@locale"` được đặt thành bản địa của chính nó, được viết theo cách mà tên tệp viết (`"pt_BR"`), vì `gen-l10n` sẽ từ chối tệp có `@@locale` không khớp với tên của nó. Mọi đối tượng siêu dữ liệu `@key`, chẳng hạn như trình giữ chỗ và kiểu của chúng, đều được sao chép từ `app_en.arb` mà không thay đổi. Các khóa tuân theo thứ tự của tệp mẫu, và thông điệp chưa được dịch sẽ được bỏ qua, để Flutter sử dụng thông điệp tiếng Anh dự phòng.

Các mô tả trong siêu dữ liệu của tệp mẫu được gửi đến mô hình dưới dạng ngữ cảnh:

```json title="lib/l10n/app_en.arb"
{
  "@@locale": "en",
  "itemCount": "{count, plural, =0{No items} one{1 item} other{{count} items}}",
  "@itemCount": {
    "description": "Badge on the cart icon",
    "placeholders": { "count": { "type": "int" } }
  }
}
```

Cú pháp `{count, plural, …}`, trình giữ chỗ `{count}` và các bộ chọn được bảo vệ: bản dịch làm thay đổi chúng sẽ bị từ chối và thử lại (xem [thông điệp ICU](/docs/getting-started/configuration#icu)). Tiếng Pháp có thể thêm nhánh `many` và tiếng Ba Lan có thể thêm `few` cùng `many`. `champollion verify` cũng kiểm tra `@@locale` và siêu dữ liệu trình giữ chỗ của mọi tệp đích. Nếu một công cụ trước đó đã dịch chúng, `champollion sync --pair en:fr --force` sẽ ghi lại tệp. Các thông điệp không thay đổi được lấy từ bộ nhớ đệm mà không tốn chi phí.

### Bản địa ngoài danh sách riêng của Flutter {#flutter-locales-outside-flutters-own-list}

Các thông điệp của bạn đến từ các tệp `.arb`. Văn bản bên trong các widget riêng của Flutter — bộ chọn ngày tháng, "Back", "Cancel", hướng văn bản — đến từ `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), vốn chỉ hỗ trợ một danh sách ngôn ngữ cố định ([danh sách của Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Mã sử dụng riêng như `qaa`, cùng hầu hết các ngôn ngữ tài nguyên thấp, không có trong danh sách này. Với bản địa như vậy trong `supportedLocales`, ứng dụng sẽ gặp lỗi khi chạy ("No MaterialLocalizations found") trừ khi có một delegate cung cấp văn bản đó. `init`, và lệnh sync tạo tệp `.arb` mới, sẽ thông báo điều này cho từng mục tiêu nằm ngoài danh sách: chúng đọc danh sách từ Flutter SDK trên máy (`FLUTTER_ROOT`, hoặc `flutter` trên `PATH`), và nếu không có SDK, chúng sẽ cho biết những mục tiêu nào không thể kiểm tra.

Cách khắc phục nhỏ nhất là mượn văn bản của một ngôn ngữ mà Flutter hỗ trợ cho các widget đó (ở đây là tiếng Anh):

```dart title="lib/fallback_localizations.dart"
import 'package:flutter/widgets.dart';

/// Flutter's own widget text for the app's locales flutter_localizations
/// does not cover, borrowed from a locale it does cover.
class FallbackLocalizationsDelegate<T> extends LocalizationsDelegate<T> {
  const FallbackLocalizationsDelegate(this.covered, this.languages);

  final LocalizationsDelegate<T> covered; // e.g. GlobalMaterialLocalizations.delegate
  final Set<String> languages;            // your codes outside Flutter's list

  @override
  bool isSupported(Locale locale) => languages.contains(locale.languageCode);

  @override
  Future<T> load(Locale locale) => covered.load(const Locale('en'));

  @override
  bool shouldReload(FallbackLocalizationsDelegate<T> old) => false;
}
```

Liệt kê nó sau các delegate riêng của Flutter:

```dart
MaterialApp(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    FallbackLocalizationsDelegate<MaterialLocalizations>(GlobalMaterialLocalizations.delegate, {'qaa'}),
    FallbackLocalizationsDelegate<CupertinoLocalizations>(GlobalCupertinoLocalizations.delegate, {'qaa'}),
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  // …
)
```

Các widget sau đó sẽ hiển thị nhãn tiếng Anh bên trong một ứng dụng có văn bản riêng bằng ngôn ngữ của bạn. Để dịch cả văn bản của widget, hướng dẫn của Flutter trình bày đầy đủ `MaterialLocalizations` cho một ngôn ngữ mới: [Thêm hỗ trợ cho ngôn ngữ mới](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django và gettext (.po)

CLI champollion là phần mềm có sẵn mã nguồn theo [Giấy phép Phi thương mại PolyForm 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): miễn phí sử dụng, sửa đổi và chia sẻ cho các mục đích phi thương mại. Việc sử dụng cho mục đích thương mại không nằm trong phạm vi của giấy phép này ([ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this)).

### Cấu trúc dự án

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Cài đặt: LOCALE_PATHS và LANGUAGES {#django-locale-paths}

Django tìm kiếm các catalog trong các thư mục mà `LOCALE_PATHS` liệt kê và trong thư mục `locale/` của mỗi ứng dụng đã cài đặt. Thư mục `locale/` nằm cạnh `manage.py` không thuộc về ứng dụng nào, vì vậy cho đến khi `LOCALE_PATHS` chỉ định nó, `compilemessages` vẫn tạo các tệp `.mo` nhưng trang web vẫn hiển thị văn bản chưa dịch. `LANGUAGES` là danh sách các ngôn ngữ mà trang web cung cấp; mặc định của Django là mọi ngôn ngữ đi kèm với nó, vì vậy hãy liệt kê các ngôn ngữ của riêng bạn:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Thiết lập

Trước tiên hãy tạo hoặc làm mới các catalog bằng Django. Catalog tiếng Anh là nguồn. Các trường `msgstr` trống của nó có nghĩa là "msgid chính là văn bản":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init` tìm thấy `manage.py` và `locale/en/LC_MESSAGES/django.po` rồi ghi:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` là domain của gettext, do đó cả `django.po` và `djangojs.po` đều được đồng bộ.

**Các giá trị mặc định bao gồm giọng điệu và phong cách giới tính; `init` in ra cả hai.** `formal-vous` yêu cầu mô hình dùng "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." Hướng dẫn giới tính của tiếng Pháp yêu cầu *écriture inclusive* với dấu chấm ở giữa khi không rõ giới tính của người đọc (`Connecté·e`, `Utilisateur·rice·s`); của tiếng Nga (`formal-vy`) sử dụng giống đực, là mặc định theo quy ước. Một trang web muốn phong cách khác (chẳng hạn như các trang cho bệnh nhân của một phòng khám) có thể thay đổi trong `champollion.config.json`: sắc thái trong `languages` (`"fr": "casual-tu"`, hoặc từ ngữ của riêng bạn), và `genderGuidance` — `false` nếu không có chỉ dẫn, hoặc chỉ dẫn riêng của bạn, chẳng hạn như `"Use the masculine generic."` ([Hướng dẫn về giới tính](/docs/getting-started/configuration#gender-guidance)). Cài đặt bị thay đổi sẽ nhận các mục bộ nhớ đệm riêng, do đó `sync --redo all` sẽ dịch lại những gì cài đặt cũ đã ghi.

**Phương pháp nào thực hiện dịch và cần khóa nào.** Nếu không có `--method`, `init` sẽ thiết lập mặc định, `llm`: một mô hình trên [OpenRouter](https://openrouter.ai), vốn cần `OPENROUTER_API_KEY` trong môi trường hoặc trong tệp `.env` bên cạnh `manage.py` (`init` in ra dòng cần đặt khi bị thiếu). Trên một máy chạy máy chủ mô hình (Ollama, LM Studio, vLLM), `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` không cần khóa nào, và không có gì rời khỏi máy. Trình chạy CI không có máy chủ mô hình, do đó CI chỉ định một mô hình được lưu trữ cho lượt chạy của nó (xem [hướng dẫn CI](/docs/guides/ci-cd)). Mọi phương pháp và khóa mà mỗi phương pháp cần: [Phương thức dịch thuật](/docs/guides/translation-methods).

Sau đó:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

Lệnh sync dịch mọi mục có `msgstr` trống và mọi mục `fuzzy`, đồng thời xóa cờ `fuzzy`. Các mục đã được dịch sẽ được giữ nguyên từng byte, cùng với các nhận xét của chúng. Một mục có `msgctxt` là khóa riêng và mục bộ nhớ đệm riêng, do đó động từ "Open" và tính từ "Open" được dịch tách biệt. Các nhận xét `#.` và ngữ cảnh được gửi đến mô hình — để xem yêu cầu chính xác mà không cần gửi, hãy chạy `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` (ngữ cảnh và nhận xét xuất hiện dưới mục "UI context for these keys").

**Chủ động dịch lại một mục.** Chỉ định mục đó bằng msgid của nó:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Mục này được cung cấp từ Bộ nhớ dịch thuật khi bộ nhớ đệm đã chứa văn bản đó, vì vậy bạn nhận lại cùng bản dịch mà không mất chi phí, và sync thông báo điều đó bằng lệnh `--fresh`. Việc thực hiện lại như vậy không cần mô hình: với `local` và máy chủ mô hình đã dừng, sync cảnh báo rằng máy chủ không phản hồi và lượt chạy này không cần đến nó, rồi tiếp tục (lượt làm lại cần gửi nội dung sẽ dừng lại và nêu tên máy chủ). Để trả phí cho một bản dịch mới, hãy thêm `--fresh`. Dấu phẩy bên trong msgid được viết là `\,`, và dấu ngoặc kép giúp shell không đọc phần còn lại. Một mục có ngữ cảnh được đặt tên như cách các báo cáo in ra, `verb␄Open`. Nếu bạn không thể gõ `␄`, hãy viết `\x04` thay thế: `--redo 'keys:verb\x04Open'`. Cả hai cách viết đều hoạt động, và các lệnh sửa chữa hiển thị cả hai. Để chỉ định mục trong một domain duy nhất, hãy thêm tiền tố domain: `django::Welcome`. Tên không khớp với mục nào sẽ làm hỏng lượt chạy (thoát mã 1) và liệt kê các mục gần nhất, ví dụ mọi ngữ cảnh của msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Nó không bao giờ được coi là một lượt làm lại hoàn tất.

Catalog do champollion tạo ra (`init --langs`, hoặc sync cho một ngôn ngữ chưa có catalog) sẽ nhận tiêu đề gettext chuẩn, các trường mà `msginit` ghi, để `msgfmt -c` chấp nhận nó. Tiêu đề của catalog hiện có không bao giờ bị ghi đè.

**Cảnh báo tiêu đề `msgfmt -c` trên các catalog mà `makemessages` đã khởi tạo.** `makemessages` ghi tiêu đề mẫu của gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, được đánh dấu `#, fuzzy` — và sau đó `msgfmt -c` cảnh báo mỗi khi biên dịch rằng từng trường "still has the initial default value". Lệnh sync giữ nguyên các giá trị đó (trong tiêu đề hiện có, nó chỉ điền trình giữ chỗ `Plural-Forms` hoặc charset), vì vậy hãy sửa chúng thủ công một lần trong mỗi catalog: tên và phiên bản dự án của bạn, ngày tháng, người dịch (hoặc `Automatically generated`) và nhóm (hoặc `none`); đồng thời xóa dòng `#, fuzzy` phía trên `msgid ""`, vốn đánh dấu tiêu đề là chưa được duyệt. `makemessages` giữ nguyên các giá trị bạn đã viết. `compilemessages` (`msgfmt --check-format`) không kiểm tra tiêu đề, vì vậy những cảnh báo này không bao giờ khiến nó thất bại.

**Dạng số nhiều.** `msgid` + `msgid_plural` trở thành một thông điệp mà mô hình dịch với tất cả các dạng ngôn ngữ cần. Các dạng này được ghi vào `msgstr[0]`, `msgstr[1]`, … theo tiêu đề `Plural-Forms` của catalog. Django sẽ tự ghi tiêu đề này cho bạn. Catalog thiếu tiêu đề sẽ nhận tiêu đề mà `msginit` ghi cho ngôn ngữ đó (tiếng Pháp `nplurals=2; plural=(n > 1);`), hoặc tiêu đề được lấy từ CLDR cho ngôn ngữ mà `msginit` không liệt kê:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Khi bản dịch bỏ sót một dạng mà ngôn ngữ sử dụng cho đếm thông thường (tiếng Nga `few` hoặc `many`), sync sẽ yêu cầu mô hình cung cấp lại dạng đó. Nếu câu trả lời vẫn còn thiếu, sync sẽ ghi dạng `other` vào vị trí đó, đánh dấu mục này bằng nhận xét `# champollion:` và nêu tên mục đó cùng lệnh để yêu cầu lại (`--redo 'keys:django::One file' --fresh`). Mọi lượt sync sẽ thoát với mã `2` khi có một mục được đánh dấu trong catalog, không chỉ lượt sync đã ghi nó, giống như một khóa bị giữ lại. Dòng xác minh kết thúc của nó thông báo lượt chạy chưa hoàn thành thay vì `[OK]`. Hãy viết các dạng bằng tay và xóa dòng nhận xét, hoặc yêu cầu lại với một `--model` mạnh hơn. Một lượt sync bằng phương pháp hoặc mô hình khác (mô hình được lưu trữ của CI, sau mô hình cục bộ) sẽ tự yêu cầu lại mục đó, và `sync --redo gaps` sẽ yêu cầu lại cho mọi mục được đánh dấu; nếu câu trả lời cũng thiếu các dạng này, mục đó sẽ vẫn được đánh dấu. Trong CI, điều này sẽ khiến công việc thất bại sau commit (xem [hướng dẫn CI](/docs/guides/ci-cd#plural-gaps)).

**Các bố cục gettext khác.**

| Dự án | Cấu hình | Nguồn |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, hoặc tệp `.pot` duy nhất trong `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, hoặc `messages.pot` trong `translations/` hoặc thư mục bên trên nó |

Các trình giữ chỗ `printf` (`%s`, `%(name)s`, `%d`) phải được giữ nguyên vẹn qua quá trình dịch, và cổng chất lượng sẽ từ chối giá trị làm mất trình giữ chỗ. Bạn vẫn nên chạy `msgfmt --check-format` (`compilemessages` thực hiện việc này) trước khi phát hành. Lệnh này cũng kiểm tra kiểu của trình giữ chỗ, nhưng chỉ trên các mục có gắn cờ `#, python-format`: `makemessages` thêm cờ vào các mục mà nó trích xuất có trình giữ chỗ `%`, trong khi catalog tạo thủ công có thể thiếu cờ này, và những mục đó sẽ không được kiểm tra. `champollion verify` so sánh các trình giữ chỗ printf của mọi mục (tên và ký tự kiểu) bất kể cờ của nó là gì, và sync giữ nguyên các cờ của mục nguồn trên mỗi mục mà nó dịch. Các catalog phải ở định dạng UTF-8. Xem [catalog gettext](/docs/getting-started/configuration#gettext) để biết toàn bộ các quy tắc.
