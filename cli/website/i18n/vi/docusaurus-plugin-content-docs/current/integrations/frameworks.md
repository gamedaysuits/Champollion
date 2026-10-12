# Hướng dẫn Tích hợp

Hướng dẫn thiết lập từng bước cho Champollion với các framework phổ biến.

Các lệnh trên trang này chạy champollion với `npx --yes champollion@0.5 <command>`: được ghim vào nhánh phiên bản 0.5, giống như trong [hướng dẫn CI](/docs/guides/ci-cd), để máy tính xách tay của bạn và CI chạy cùng một phiên bản và bản phát hành mới không bao giờ bất ngờ làm thay đổi lượt chạy. Cài đặt cục bộ trong dự án là một phương án thay thế. Trong một dự án Node, `npm install --save-dev champollion@0.5` sẽ thêm nó vào `package.json`, và `npx champollion sync` sau đó sẽ chạy bản sao đó.

---

## Thiết lập API Key

Trước khi tích hợp với bất kỳ framework nào, bạn cần có API key dịch thuật. Champollion hỗ trợ hai nhà cung cấp:

### Tùy chọn A: OpenRouter (khuyên dùng)

[OpenRouter](https://openrouter.ai) cung cấp một API hợp nhất cho hơn 200 mô hình LLM. Có sẵn gói miễn phí.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Phù hợp nhất cho: các dự án nhiều nội dung, dịch thuật Markdown, và các dự án cần bảo vệ nội dung theo ngữ cảnh (khối mã, shortcode, biến nội suy).

### Tùy chọn B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Phù hợp nhất cho: các cặp chuỗi khóa - giá trị khối lượng lớn (194 ngôn ngữ). **Không khuyến nghị** cho nội dung Markdown — Google Translate không nhận biết được các khối mã, shortcode hay biến nội suy.

Để sử dụng Google Translate một cách rõ ràng:

```bash
champollion sync --method google-translate
```

> **Mẹo**: Nếu chỉ có `GOOGLE_TRANSLATE_API_KEY` được thiết lập (không có key OpenRouter), Champollion sẽ tự động chuyển sang Google Translate.

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

### Chi tiết dịch thuật nội dung

**Front matter**: Hỗ trợ cả dấu phân cách YAML (`---`) và TOML (`+++`). Dịch các trường `title`, `description`, `summary`, `subtitle`, `caption`, và `linkTitle` theo mặc định. Tất cả các trường khác (date, draft, tags, weight, slug, v.v.) đều được giữ nguyên. Tùy chỉnh bằng `translatableFields` trong cấu hình của bạn.

**Bảo vệ khối**: Các khối mã, Hugo shortcode (`{{< >}}`, `{{% %}}`), mã inline và HTML thô sẽ tự động được bảo vệ bằng các trình giữ chỗ Unicode sentinel. Chúng sẽ được giữ nguyên vẹn.

**Quy ước đặt tên tệp**: Tuân theo mô hình dịch-theo-tên-tệp của Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (loại bỏ hậu tố nguồn)

**Bỏ qua tệp đã có**: Các tệp đã dịch hiện có sẽ không bao giờ bị ghi đè. Hãy xóa tệp đích để bắt buộc dịch lại.

### Dạng số nhiều

Các tệp ngôn ngữ TOML và YAML hỗ trợ các dạng số nhiều CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Được biểu diễn nội bộ dưới dạng `items.one` and `items.other` để so sánh sự khác biệt (diffing), sau đó được tuần tự hóa lại thành định dạng phân đoạn chính xác khi ghi.

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

Chạy `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Lệnh này sẽ tìm `messages/en.json`, tạo các tệp đích trống và ghi tệp cấu hình như bên dưới. Hoặc tự bạn tạo `champollion.config.json`:

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

Văn phong (sắc thái và độ trang trọng) của từng ngôn ngữ đích được ghi vào `languages`, giúp bạn có thể xem và chỉnh sửa: chuyển sang một preset khác của ngôn ngữ đó (`champollion status` sẽ liệt kê danh sách) hoặc tự viết theo ý bạn. Ngôn ngữ không có preset sẽ được ghi dưới dạng `{}`. Một danh sách đơn giản, `"languages": ["fr", "de"]`, cũng hoạt động và sẽ sử dụng mặc định của từng ngôn ngữ.

```bash
npx --yes champollion@0.5 sync
```

Tạo ra `messages/fr.json`, `messages/ja.json`, v.v. — được dịch hoàn toàn, giữ nguyên cấu trúc key lồng nhau của bạn. next-intl sẽ tự động nhận diện chúng.

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

### Mỗi ngôn ngữ một thư mục (mặc định của i18next)

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init` tìm thấy `public/locales/en/` (hoặc `locales/en/`), trỏ cấu hình vào đó và tạo `fr/common.json`, `fr/admin/users.json` cùng các tệp khác dưới dạng tệp trống. Phần cấu hình liên quan được ghi ra:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.5 sync
```

Mỗi tệp namespace được dịch và ghi vào cùng một đường dẫn trong thư mục của từng ngôn ngữ. Một chuỗi xuất hiện trong nhiều namespace sẽ chỉ được dịch một lần cho mỗi ngôn ngữ; các tệp khác sẽ lấy chuỗi đó từ Translation Memory. Các khóa số nhiều (`key_one`, `key_other`) nhận các dạng riêng của từng ngôn ngữ, được đọc từ CLDR thông qua JavaScript `Intl.PluralRules` API: dạng mà ngôn ngữ sử dụng nhưng nguồn còn thiếu sẽ được thêm vào, còn dạng ngôn ngữ không sử dụng sẽ bị lược bỏ. Với nguồn tiếng Anh, tiếng Tây Ban Nha và tiếng Pháp sẽ có thêm `key_many`, tiếng Nga có thêm `key_few` và `key_many`, còn tiếng Nhật chỉ giữ lại `key_other`. Quá trình đồng bộ hóa sẽ chỉ ra các dạng mà từng ngôn ngữ của bạn nhận được. Xem [các khóa số nhiều i18next](/docs/getting-started/configuration#i18next-plurals) và [Bố cục tệp bản địa hóa](/docs/getting-started/configuration#locale-layouts).

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

Nếu các tệp của bạn tuân theo một mẫu khác, hãy mô tả mẫu đó bằng `localesPattern` (`{lang}` là ngôn ngữ, `{ns}` là namespace):

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` đọc `pubspec.yaml` và `l10n.yaml` (`arb-dir`, `template-arb-file`), lấy ngôn ngữ nguồn từ tên của tệp mẫu (`app_en.arb` → `en`), rồi tạo `app_fr.arb`, `app_de.arb` và `app_pt_BR.arb` cùng với `@@locale` của chúng. Cấu hình được ghi ra:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Nếu `l10n.yaml` thiết lập `arb-dir: assets/i18n` và `template-arb-file: intl_en.arb`, mẫu đường dẫn sẽ là `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Chỉ các thông điệp mới được dịch. Mỗi tệp đích sẽ có `"@@locale"` được đặt thành locale riêng của nó, viết theo định dạng của tên tệp (`"pt_BR"`), vì `gen-l10n` sẽ từ chối tệp có `@@locale` không khớp với tên của nó. Mọi đối tượng siêu dữ liệu `@key`, chẳng hạn như placeholder và kiểu dữ liệu của chúng, đều được sao chép nguyên vẹn từ `app_en.arb`. Các khóa tuân theo thứ tự của tệp mẫu, và thông điệp nào chưa được dịch sẽ bị bỏ qua, để Flutter sử dụng thông điệp tiếng Anh dự phòng.

Mô tả trong siêu dữ liệu của tệp mẫu được gửi đến mô hình dưới dạng ngữ cảnh:

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

Cú pháp `{count, plural, …}`, placeholder `{count}` và các bộ chọn đều được bảo vệ: bản dịch làm thay đổi chúng sẽ bị từ chối và thử lại (xem [thông điệp ICU](/docs/getting-started/configuration#icu)). Tiếng Pháp có thể thêm nhánh `many` còn tiếng Ba Lan thêm `few` và `many`. `champollion verify` cũng kiểm tra `@@locale` và siêu dữ liệu placeholder của mọi tệp đích. Nếu một công cụ trước đó đã dịch chúng, `champollion sync --pair en:fr --force` sẽ ghi lại tệp. Các thông điệp không thay đổi sẽ được lấy từ bộ nhớ đệm mà không tốn chi phí.

### Các locale nằm ngoài danh sách có sẵn của Flutter {#flutter-locales-outside-flutters-own-list}

Các thông điệp của bạn đến từ các tệp `.arb`. Văn bản bên trong các widget mặc định của Flutter — trình chọn ngày, "Back", "Cancel", hướng văn bản — đến từ `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), vốn hỗ trợ một danh sách ngôn ngữ cố định ([danh sách của Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Mã dùng riêng như `qaa` và hầu hết các ngôn ngữ ít tài nguyên đều không có trong danh sách này. Khi sử dụng locale như vậy trong `supportedLocales`, ứng dụng sẽ gặp lỗi lúc chạy ("No MaterialLocalizations found") trừ khi có một delegate cung cấp văn bản đó. `init`, cũng như lệnh đồng bộ tạo tệp `.arb` mới, sẽ thông báo điều này đối với từng ngôn ngữ đích nằm ngoài danh sách: chúng đọc thông tin từ Flutter SDK trên máy (`FLUTTER_ROOT`, hoặc `flutter` trên `PATH`), và nếu không có SDK, chúng sẽ cho biết những ngôn ngữ đích nào chưa kiểm tra được.

Cách khắc phục đơn giản nhất là tạm mượn văn bản từ một ngôn ngữ mà Flutter hỗ trợ (ở đây là tiếng Anh) cho các widget đó:

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

Liệt kê nó sau các delegate có sẵn của Flutter:

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

Khi đó, các widget sẽ hiển thị nhãn tiếng Anh bên trong một ứng dụng có văn bản riêng bằng ngôn ngữ của bạn. Để dịch cả văn bản của widget, hướng dẫn của Flutter sẽ chỉ cách tạo đầy đủ `MaterialLocalizations` cho một ngôn ngữ mới: [Adding support for a new language](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django và gettext (.po)

CLI champollion được phát hành dưới dạng source-available theo giấy phép [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): miễn phí sử dụng, sửa đổi và chia sẻ cho mục đích phi thương mại. Việc sử dụng cho mục đích thương mại không thuộc phạm vi của giấy phép này ([ai có thể sử dụng](/docs/getting-started/who-may-use-this)).

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

Django tìm kiếm các catalog trong các thư mục được liệt kê ở `LOCALE_PATHS` và trong thư mục `locale/` của mỗi ứng dụng đã cài đặt. Thư mục `locale/` nằm cạnh `manage.py` không thuộc về ứng dụng nào, nên chừng nào `LOCALE_PATHS` chưa khai báo nó, `compilemessages` vẫn tạo các tệp `.mo` nhưng trang web vẫn hiển thị văn bản chưa dịch. `LANGUAGES` là danh sách các ngôn ngữ mà trang web cung cấp; mặc định của Django là mọi ngôn ngữ đi kèm sẵn, vì vậy hãy liệt kê các ngôn ngữ của riêng bạn:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Thiết lập

Trước tiên, hãy tạo hoặc làm mới các catalog bằng Django. Catalog tiếng Anh là nguồn. Các `msgstr` trống của nó có nghĩa là "msgid chính là nội dung văn bản":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
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

`{ns}` là gettext domain, vì vậy cả `django.po` lẫn `djangojs.po` đều được đồng bộ hóa.

**Giá trị mặc định gồm giọng điệu và phong cách giống; `init` in ra cả hai.** `formal-vous` yêu cầu mô hình dùng "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." Hướng dẫn về giống trong tiếng Pháp yêu cầu dùng *écriture inclusive* với dấu chấm giữa khi chưa biết giới tính của người đọc (`Connecté·e`, `Utilisateur·rice·s`); tiếng Nga (`formal-vy`) sử dụng giống đực, là mặc định theo quy ước. Một trang web muốn phong cách khác (chẳng hạn như các trang dành cho bệnh nhân của một phòng khám) có thể thay đổi điều đó trong `champollion.config.json`: văn phong trong `languages` (`"fr": "casual-tu"`, hoặc từ ngữ của riêng bạn), và `genderGuidance` — `false` nếu không có chỉ dẫn nào, hoặc chỉ dẫn riêng của bạn, chẳng hạn như `"Use the masculine generic."` ([Hướng dẫn về giống](/docs/getting-started/configuration#gender-guidance)). Cài đặt bị thay đổi sẽ có các mục cache riêng, vì vậy `sync --redo all` sẽ dịch lại những gì cài đặt cũ đã ghi.

**Phương thức nào thực hiện dịch và cần khóa nào.** Nếu không có `--method`, `init` sẽ thiết lập mặc định là `llm`: một mô hình trên [OpenRouter](https://openrouter.ai), vốn cần `OPENROUTER_API_KEY` trong môi trường hoặc trong tệp `.env` đặt cạnh `manage.py` (`init` sẽ in ra dòng cần thiết lập nếu thiếu). Trên máy chạy model server (Ollama, LM Studio, vLLM), `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` không cần khóa và không có dữ liệu nào rời khỏi máy. CI runner không có model server, vì vậy CI sẽ chỉ định một mô hình hosted cho lượt chạy của nó (xem [hướng dẫn CI](/docs/guides/ci-cd)). Mọi phương thức dịch và khóa cần thiết: [Phương thức dịch](/docs/guides/translation-methods).

Sau đó:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

Lệnh đồng bộ sẽ dịch mọi mục có `msgstr` trống và mọi mục `fuzzy`, đồng thời xóa cờ `fuzzy`. Các mục đã được dịch sẽ được giữ nguyên từng byte, cùng với các comment của chúng. Một mục có `msgctxt` sẽ là một khóa riêng và một mục cache riêng, do đó động từ "Open" và tính từ "Open" được dịch tách biệt. Các comment `#.` và ngữ cảnh được gửi đến mô hình — để xem yêu cầu chính xác mà không cần gửi đi, hãy chạy `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (ngữ cảnh và comment xuất hiện dưới mục "UI context for these keys").

**Chủ động dịch lại một mục cụ thể.** Chỉ định nó bằng msgid:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Mục này sẽ được phục vụ từ Translation Memory nếu bộ nhớ đệm đã chứa văn bản đó, nhờ vậy bạn nhận lại bản dịch tương tự mà không tốn chi phí, và lệnh đồng bộ sẽ thông báo điều đó cùng lệnh `--fresh`. Việc dịch lại như vậy không cần đến mô hình: với `local` và model server đã dừng, quá trình đồng bộ sẽ cảnh báo rằng server không phản hồi nhưng lượt chạy này không cần đến nó, rồi tiếp tục chạy (lượt dịch lại nào buộc phải gửi dữ liệu sẽ dừng lại và nêu tên server). Để chi trả cho một bản dịch mới, hãy thêm `--fresh`. Dấu phẩy bên trong msgid được viết là `\,`, và dấu ngoặc kép giúp shell không đọc nhầm phần còn lại. Một mục có ngữ cảnh được đặt tên như báo cáo in ra: `verb␄Open`. Nếu bạn không thể gõ `␄`, hãy viết `\x04` thay thế: `--redo 'keys:verb\x04Open'`. Cả hai cách viết đều hoạt động và các lệnh sửa lỗi hiển thị cả hai. Để chỉ định mục trong một domain duy nhất, hãy thêm tiền tố domain: `django::Welcome`. Một tên không khớp với bất kỳ mục nào sẽ khiến lượt chạy thất bại (exit 1) và liệt kê các mục gần nhất, ví dụ mọi ngữ cảnh của msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Trường hợp này không bao giờ được coi là đã hoàn tất việc dịch lại.

Catalog do champollion tạo ra (`init --langs`, hoặc lệnh đồng bộ cho ngôn ngữ chưa có catalog) sẽ có phần header gettext tiêu chuẩn với các trường mà `msginit` ghi, giúp `msgfmt -c` chấp nhận nó. Header của catalog hiện có không bao giờ bị ghi đè.

**Cảnh báo header `msgfmt -c` trên các catalog do `makemessages` khởi tạo.** `makemessages` ghi header mẫu của gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, được đánh dấu là `#, fuzzy` — và `msgfmt -c` sau đó cảnh báo ở mỗi lần biên dịch rằng mỗi trường "still has the initial default value". Quá trình đồng bộ giữ nguyên các giá trị đó (trong header hiện có, nó chỉ điền vào `Plural-Forms` giữ chỗ hoặc charset), vì vậy hãy tự chỉnh sửa thủ công một lần trong từng catalog: tên và phiên bản dự án của bạn, ngày tháng, người dịch (hoặc `Automatically generated`) và nhóm dịch (hoặc `none`); ngoài ra hãy xóa dòng `#, fuzzy` phía trên `msgid ""` vốn đánh dấu header là chưa được xem xét. `makemessages` giữ lại các giá trị bạn đã viết. `compilemessages` (`msgfmt --check-format`) không kiểm tra header, nên các cảnh báo này không bao giờ làm nó thất bại.

**Dạng số nhiều.** `msgid` + `msgid_plural` trở thành một thông điệp duy nhất mà mô hình sẽ dịch với tất cả các dạng mà ngôn ngữ đó yêu cầu. Các dạng được ghi vào `msgstr[0]`, `msgstr[1]`, … theo header `Plural-Forms` của catalog. Django sẽ tự ghi header này cho bạn. Catalog nào chưa có sẽ nhận header mà `msginit` ghi cho ngôn ngữ đó (tiếng Pháp `nplurals=2; plural=(n > 1);`), hoặc header được trích xuất từ CLDR đối với ngôn ngữ không có trong danh sách của `msginit`:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Khi bản dịch bỏ sót một dạng mà ngôn ngữ sử dụng cho phép đếm thông thường (tiếng Nga `few` hoặc `many`), quá trình đồng bộ sẽ yêu cầu mô hình dịch lại dạng đó. Nếu câu trả lời vẫn còn thiếu, quá trình đồng bộ sẽ ghi dạng `other` vào vị trí đó, đánh dấu mục này bằng comment `# champollion:` và chỉ định nó kèm theo lệnh để yêu cầu lại (`--redo 'keys:django::One file' --fresh`). Mọi lượt đồng bộ đều thoát với mã `2` khi vẫn còn mục bị đánh dấu trong catalog, chứ không riêng gì lượt đồng bộ đã ghi mục đó, tương tự như một khóa bị giữ lại. Dòng xác minh kết thúc sẽ báo rằng lượt chạy chưa hoàn tất thay vì `[OK]`. Hãy tự tay viết các dạng đó và xóa dòng comment, hoặc yêu cầu lại với một `--model` mạnh hơn. Quá trình đồng bộ bằng phương thức hoặc mô hình khác (mô hình hosted của CI, sau khi dùng mô hình cục bộ) sẽ tự động yêu cầu lại mục đó, và `sync --redo gaps` sẽ yêu cầu lại mọi mục bị đánh dấu; nếu câu trả lời vẫn thiếu các dạng, mục đó vẫn giữ nguyên trạng thái bị đánh dấu. Trong CI, điều này sẽ làm thất bại job sau commit (xem [hướng dẫn CI](/docs/guides/ci-cd#plural-gaps)).

**Các bố cục gettext khác.**

| Dự án | Cấu hình | Nguồn |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, hoặc tệp `.pot` duy nhất trong `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, hoặc `messages.pot` trong `translations/` hoặc thư mục phía trên nó |

Các placeholder `printf` (`%s`, `%(name)s`, `%d`) phải được giữ nguyên vẹn qua quá trình dịch, và quality gate sẽ từ chối giá trị nào làm mất placeholder. Bạn vẫn nên chạy `msgfmt --check-format` (`compilemessages` có thực hiện) trước khi release. Lệnh này cũng kiểm tra kiểu của placeholder, nhưng chỉ trên các mục được gắn cờ `#, python-format`: `makemessages` thêm cờ vào các mục mà nó trích xuất có placeholder `%`, trong khi catalog tạo thủ công có thể thiếu cờ này, khiến các mục đó không được kiểm tra. `champollion verify` so sánh các placeholder printf của từng mục (tên và ký tự kiểu) bất kể cờ của nó là gì, và quá trình đồng bộ giữ nguyên các cờ của mục nguồn trên từng mục mà nó dịch. Các catalog bắt buộc phải là UTF-8. Xem [catalog gettext](/docs/getting-started/configuration#gettext) để biết đầy đủ các quy tắc.
