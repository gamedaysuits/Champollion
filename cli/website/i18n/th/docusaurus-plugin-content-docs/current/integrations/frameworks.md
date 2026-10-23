# คู่มือการผสานการทำงาน

ขั้นตอนการตั้งค่า champollion ร่วมกับเฟรมเวิร์กยอดนิยมแบบทีละขั้นตอน

คำสั่งในหน้านี้เรียกใช้ champollion ด้วย `npx --yes champollion@0.6 <command>` ซึ่งตรึงไว้ที่เวอร์ชัน 0.6 เช่นเดียวกับใน [คู่มือ CI](/docs/guides/ci-cd) เพื่อให้แล็ปท็อปและ CI ของคุณรันเวอร์ชันเดียวกัน และการปล่อยเวอร์ชันใหม่จะไม่ส่งผลต่อการทำงานโดยไม่คาดคิด อีกทางเลือกหนึ่งคือการติดตั้งภายในโปรเจกต์ ในโปรเจกต์ Node คำสั่ง `npm install --save-dev champollion@0.6` จะเพิ่มแพ็กเกจไปยัง `package.json` และคำสั่ง `npx champollion sync` จะเรียกใช้ชุดที่ติดตั้งนั้น

---

## การตั้งค่า API Key

ก่อนที่จะผสานการทำงานกับเฟรมเวิร์กใดก็ตาม คุณจำเป็นต้องมี API key สำหรับการแปล Champollion รองรับผู้ให้บริการสองราย:

### ตัวเลือก A: OpenRouter (แนะนำ)

[OpenRouter](https://openrouter.ai) ให้บริการ API แบบรวมศูนย์สำหรับโมเดล LLM มากกว่า 200 โมเดล มีแพ็กเกจฟรีให้ใช้งาน

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

เหมาะที่สุดสำหรับ: โปรเจกต์ที่มีเนื้อหาจำนวนมาก, การแปล Markdown และโปรเจกต์ที่ต้องมีการปกป้ององค์ประกอบเนื้อหา (บล็อกโค้ด, ชอร์ตโค้ด, ตัวแปร interpolation)

### ตัวเลือก B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

เหมาะที่สุดสำหรับ: คู่สตริงคีย์-ค่า (key-value) ปริมาณมาก (194 ภาษา) **ไม่แนะนำ** สำหรับเนื้อหา Markdown — Google Translate ไม่สามารถแยกแยะบล็อกโค้ด, ชอร์ตโค้ด หรือตัวแปร interpolation ได้

หากต้องการใช้ Google Translate อย่างชัดเจน:

```bash
champollion sync --method google-translate
```

> **คำแนะนำ**: หากมีการตั้งค่าเฉพาะ `GOOGLE_TRANSLATE_API_KEY` เท่านั้น (ไม่มีคีย์ OpenRouter) champollion จะสลับไปใช้ Google Translate โดยอัตโนมัติ

---

## Hugo (TOML / YAML / Markdown)

### โครงสร้างโปรเจกต์

Hugo ใช้ `i18n/` สำหรับการแปลสตริง และ `content/` สำหรับเนื้อหาหน้าเว็บ:

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

### การตั้งค่า

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

สร้าง `champollion.config.json`:

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

### รายละเอียดการแปลเนื้อหา

**Front matter**: รองรับทั้งตัวคั่นแบบ YAML (`---`) และ TOML (`+++`) โดยจะแปล `title`, `description`, `summary`, `subtitle`, `caption` และ `linkTitle` เป็นค่าเริ่มต้น ฟิลด์อื่นๆ ทั้งหมด (date, draft, tags, weight, slug ฯลฯ) จะถูกเก็บรักษาไว้ ปรับแต่งได้ด้วย `translatableFields` ในการกำหนดค่าของคุณ

**การปกป้องบล็อก**: บล็อกโค้ด, ชอร์ตโค้ดของ Hugo (`{{< >}}`, `{{% %}}`), โค้ดแบบอินไลน์ และ HTML ดิบ จะได้รับการปกป้องโดยอัตโนมัติด้วยตัวแทนสัญลักษณ์ Unicode โดยจะคงเดิมไว้โดยไม่ถูกแก้ไข

**รูปแบบการตั้งชื่อไฟล์**: เป็นไปตามรูปแบบการแปลตามชื่อไฟล์ของ Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (ตัดคำต่อท้ายของภาษาต้นทางออก)

**ข้ามไฟล์ที่มีอยู่แล้ว**: ไฟล์ที่แปลแล้วที่มีอยู่เดิมจะไม่ถูกเขียนทับ ให้ลบไฟล์ปลายทางออกหากต้องการบังคับให้แปลใหม่

### รูปแบบพหูพจน์

ไฟล์ภาษาแบบ TOML และ YAML รองรับรูปแบบพหูพจน์ของ CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

ภายในจะแสดงเป็น `items.one` และ `items.other` เพื่อเปรียบเทียบความต่าง (diffing) จากนั้นจะแปลงกลับเป็นรูปแบบเซกชันที่ถูกต้องเมื่อบันทึกลงไฟล์

---

## next-intl (JSON)

### โครงสร้างโปรเจกต์

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

### การตั้งค่า

```bash
npm install --save-dev champollion
```

เรียกใช้ `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar` ซึ่งจะค้นหา `messages/en.json` สร้างไฟล์ปลายทางที่ว่างเปล่า และเขียนไฟล์กำหนดค่าดังตัวอย่างด้านล่าง หรือคุณจะสร้าง `champollion.config.json` ด้วยตนเองก็ได้:

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

ระดับภาษา (น้ำเสียงและความเป็นทางการ) ของแต่ละภาษาปลายทางจะถูกระบุไว้ใน `languages` เพื่อให้มองเห็นและแก้ไขได้: คุณสามารถเปลี่ยนไปใช้ค่าที่กำหนดไว้ล่วงหน้า (preset) ของภาษานั้น (`champollion status` แสดงรายการทั้งหมด) หรือเขียนด้วยถ้อยคำของคุณเอง ภาษาที่ไม่มี preset จะถูกเขียนเป็น `{}` การใช้รายการแบบเรียบง่าย เช่น `"languages": ["fr", "de"]` ก็สามารถทำได้เช่นกัน และจะใช้ค่าเริ่มต้นของแต่ละภาษา

```bash
npx --yes champollion@0.6 sync
```

คำสั่งนี้จะสร้าง `messages/fr.json`, `messages/ja.json` ฯลฯ ขึ้นมา ซึ่งได้รับการแปลอย่างครบถ้วนและคงโครงสร้างคีย์ที่ซ้อนกันไว้ โดย next-intl จะดึงไฟล์เหล่านี้ไปใช้โดยอัตโนมัติ

### ขั้นตอนการพัฒนา

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

### แยกโฟลเดอร์ตามภาษา (ค่าเริ่มต้นของ i18next)

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

`init` จะค้นหา `public/locales/en/` (หรือ `locales/en/`) แล้วชี้ไฟล์กำหนดค่าไปยังตำแหน่งนั้น พร้อมสร้าง `fr/common.json`, `fr/admin/users.json` และไฟล์อื่นๆ เป็นไฟล์ว่าง ส่วนที่เกี่ยวข้องของการกำหนดค่าที่เขียนขึ้น:

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

ไฟล์ namespace แต่ละไฟล์จะได้รับการแปลและเขียนลงในเส้นทางเดียวกันในโฟลเดอร์ของทุกภาษา สตริงที่ปรากฏในหลาย namespace จะได้รับการแปลเพียงครั้งเดียวต่อภาษา ส่วนไฟล์อื่นๆ จะนำข้อความดังกล่าวมาจาก Translation Memory คีย์พหูพจน์ (`key_one`, `key_other`) จะได้รับรูปแบบของแต่ละภาษาเอง ซึ่งอ่านมาจาก CLDR ผ่าน `Intl.PluralRules` API ของ JavaScript: รูปแบบที่ภาษานั้นใช้แต่ภาษาต้นทางไม่มีจะถูกเพิ่มเข้ามา และรูปแบบที่ภาษานั้นไม่ได้ใช้จะถูกละเว้นไป เมื่อใช้ภาษาอังกฤษเป็นต้นทาง ภาษาสเปนและฝรั่งเศสจะได้รับ `key_many` เพิ่มเข้ามา ภาษารัสเซียจะได้รับ `key_few` และ `key_many` ส่วนภาษาญี่ปุ่นจะคงไว้เพียง `key_other` เท่านั้น การซิงก์จะระบุชื่อรูปแบบที่แต่ละภาษาได้รับ ดูเพิ่มเติมที่ [คีย์พหูพจน์ของ i18next](/docs/getting-started/configuration#i18next-plurals) และ [โครงสร้างไฟล์ภาษา](/docs/getting-started/configuration#locale-layouts)

### แยกหนึ่งไฟล์ต่อหนึ่งภาษา

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

### โครงสร้างรูปแบบอื่น

หากไฟล์ของคุณใช้รูปแบบอื่น ให้ระบุด้วย `localesPattern` (`{lang}` คือภาษา และ `{ns}` คือ namespace):

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

### โครงสร้างโปรเจกต์

`flutter gen-l10n` จะอ่านไฟล์ `.arb` หนึ่งไฟล์ต่อหนึ่งภาษา โดยไฟล์ภาษาอังกฤษจะเป็นเทมเพลต:

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

### การตั้งค่า

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init` จะอ่าน `pubspec.yaml` และ `l10n.yaml` (`arb-dir`, `template-arb-file`) โดยดึงภาษาต้นทางมาจากชื่อของเทมเพลต (`app_en.arb` → `en`) และสร้าง `app_fr.arb`, `app_de.arb` และ `app_pt_BR.arb` พร้อมกับ `@@locale` การกำหนดค่าที่เขียนขึ้น:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

หาก `l10n.yaml` มีการตั้งค่า `arb-dir: assets/i18n` และ `template-arb-file: intl_en.arb` รูปแบบจะเป็น `"assets/i18n/intl_{lang}.arb"`

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

เฉพาะข้อความเท่านั้นที่จะได้รับการแปล แต่ละภาษาปลายทางจะมีการตั้งค่า `"@@locale"` เป็นโลแคลของตนเอง โดยเขียนในรูปแบบเดียวกับชื่อไฟล์ (`"pt_BR"`) เนื่องจาก `gen-l10n` จะปฏิเสธไฟล์ที่มี `@@locale` ไม่ตรงกับชื่อไฟล์ อ็อบเจกต์เมทาดาตา `@key` ทุกรายการ เช่น ตัวยึดตำแหน่ง (placeholders) และประเภท จะถูกคัดลอกมาจาก `app_en.arb` โดยไม่มีการเปลี่ยนแปลง ลำดับของคีย์จะเป็นไปตามเทมเพลต และข้อความที่ยังไม่ได้แปลจะถูกละเว้นไว้ เพื่อให้ Flutter สลับไปใช้ภาษาอังกฤษแทน

คำอธิบายในเมทาดาตาของเทมเพลตจะถูกส่งไปยังโมเดลเพื่อใช้เป็นบริบท:

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

ไวยากรณ์ `{count, plural, …}`, ตัวยึดตำแหน่ง `{count}` และตัวเลือก (selectors) จะได้รับการปกป้อง: หากผลการแปลเปลี่ยนแปลงส่วนเหล่านี้ คำแปลจะถูกปฏิเสธและลองใหม่อีกครั้ง (ดูที่ [ข้อความ ICU](/docs/getting-started/configuration#icu)) ภาษาฝรั่งเศสอาจเพิ่มสาขา `many` และภาษาโปแลนด์อาจเพิ่ม `few` และ `many` นอกจากนี้ `champollion verify` ยังตรวจสอบ `@@locale` และเมทาดาตาตัวยึดตำแหน่งของไฟล์ปลายทางทุกไฟล์ หากเครื่องมือก่อนหน้านี้แปลส่วนเหล่านี้ไป `champollion sync --pair en:fr --force` จะเขียนไฟล์ใหม่ ข้อความที่ไม่มีการเปลี่ยนแปลงจะถูกดึงมาจากแคชโดยไม่มีค่าใช้จ่าย

### โลแคลที่อยู่นอกรายการของ Flutter {#flutter-locales-outside-flutters-own-list}

ข้อความของคุณมาจากไฟล์ `.arb` ส่วนข้อความภายในวิดเจ็ตของ Flutter เอง เช่น ตัวเลือกวันที่, "Back", "Cancel", ทิศทางของข้อความ จะมาจาก `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`) ซึ่งครอบคลุมเฉพาะภาษาตามรายการที่กำหนดไว้ ([รายการของ Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)) รหัสสำหรับการใช้งานส่วนตัว เช่น `qaa` รวมถึงภาษาที่มีทรัพยากรน้อยส่วนใหญ่ จะไม่อยู่ในรายการนี้ หากมีโลแคลดังกล่าวใน `supportedLocales` แอปจะเกิดข้อผิดพลาดขณะทำงาน ("No MaterialLocalizations found") เว้นแต่จะมี delegate เข้ามาจัดเตรียมข้อความเหล่านั้น โดย `init` และการซิงก์ที่สร้างไฟล์ `.arb` ใหม่ จะแจ้งเตือนสำหรับภาษาปลายทางที่อยู่นอกรายการ: ระบบจะอ่านข้อมูลนี้จาก Flutter SDK บนเครื่อง (`FLUTTER_ROOT` หรือ `flutter` บน `PATH`) และหากไม่พบ ระบบจะแจ้งว่าไม่สามารถตรวจสอบภาษาปลายทางใดได้บ้าง

วิธีแก้ไขที่เรียบง่ายที่สุดคือการนำข้อความวิดเจ็ตของภาษาที่ Flutter รองรับมาใช้แทน (ในที่นี้คือภาษาอังกฤษ):

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

ใส่รายการนี้ไว้ต่อจาก delegates ของ Flutter เอง:

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

จากนั้นวิดเจ็ตจะแสดงข้อความป้ายกำกับเป็นภาษาอังกฤษ ภายในแอปที่มีข้อความเนื้อหาเป็นภาษาของคุณ หากต้องการแปลข้อความของวิดเจ็ตด้วย คู่มือของ Flutter มีตัวอย่าง `MaterialLocalizations` ฉบับสมบูรณ์สำหรับภาษาใหม่: [Adding support for a new language](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language)

---

## Django และ gettext (.po)

champollion CLI เปิดให้ดูซอร์สโค้ดได้ภายใต้สัญญาอนุญาต [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): ใช้งาน ดัดแปลง และแบ่งปันได้ฟรีเพื่อวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ การใช้งานเพื่อวัตถุประสงค์เชิงพาณิชย์ไม่ครอบคลุมภายใต้สัญญาอนุญาตนี้ ([ใครที่สามารถใช้งานได้](/docs/getting-started/who-may-use-this))

### โครงสร้างโปรเจกต์

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### การตั้งค่า: LOCALE_PATHS และ LANGUAGES {#django-locale-paths}

Django จะค้นหาแคตตาล็อกในโฟลเดอร์ที่ `LOCALE_PATHS` ระบุไว้ และในโฟลเดอร์ `locale/` ของแต่ละแอปที่ติดตั้ง โฟลเดอร์ `locale/` ที่อยู่ข้าง `manage.py` ไม่ได้เป็นของแอปใด ดังนั้นจนกว่าจะระบุชื่อไว้ใน `LOCALE_PATHS` คำสั่ง `compilemessages` ก็ยังคงสร้างไฟล์ `.mo` ได้ แต่เว็บไซต์จะยังคงแสดงข้อความที่ยังไม่ได้แปล `LANGUAGES` คือรายการภาษาที่เว็บไซต์เปิดให้บริการ ค่าเริ่มต้นของ Django คือทุกภาษาที่มาพร้อมกับตัวระบบ ดังนั้นโปรดระบุเฉพาะภาษาของคุณเอง:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### การตั้งค่า

สร้างหรือรีเฟรชแคตตาล็อกด้วย Django ก่อน แคตตาล็อกภาษาอังกฤษจะทำหน้าที่เป็นต้นทาง โดยค่า `msgstr` ที่ว่างเปล่าหมายถึง "ให้ใช้ msgid เป็นข้อความ":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init` จะค้นหา `manage.py` และ `locale/en/LC_MESSAGES/django.po` แล้วเขียน:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` คือโดเมนของ gettext ดังนั้นทั้ง `django.po` และ `djangojs.po` จะได้รับการซิงก์ทั้งคู่

**ค่าเริ่มต้นคือระดับเสียงและรูปแบบเพศสภาพ โดย `init` จะพิมพ์แสดงทั้งสองอย่าง** `formal-vous` จะสั่งให้โมเดลใช้ "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." คำแนะนำเรื่องเพศสภาพของภาษาฝรั่งเศสจะขอให้ใช้ *écriture inclusive* ร่วมกับจุดกึ่งกลาง (middle dot) เมื่อไม่ทราบเพศของผู้อ่าน (`Connecté·e`, `Utilisateur·rice·s`) ส่วนภาษารัสเซีย (`formal-vy`) จะใช้เพศชายซึ่งเป็นค่าเริ่มต้นทั่วไป เว็บไซต์ที่ต้องการรูปแบบอื่น (เช่น หน้าเว็บสำหรับผู้ป่วยของคลินิก) สามารถเปลี่ยนได้ใน `champollion.config.json`: ระดับภาษาใน `languages` (`"fr": "casual-tu"` หรือถ้อยคำของคุณเอง) และ `genderGuidance` — กำหนดเป็น `false` หากไม่ต้องการระบุคำสั่ง หรือใส่คำสั่งของคุณเอง เช่น `"Use the masculine generic."` ([คำแนะนำเรื่องเพศสภาพ](/docs/getting-started/configuration#gender-guidance)) การตั้งค่าที่เปลี่ยนไปจะได้รับรายการแคชแยกต่างหาก ดังนั้น `sync --redo all` จะแปลข้อความที่การตั้งค่าเดิมเคยเขียนไว้อีกครั้ง

**วิธีการใดเป็นตัวแปล และต้องใช้คีย์ใด** หากไม่มี `--method` ตัว `init` จะตั้งค่าเริ่มต้นเป็น `llm`: โมเดลบน [OpenRouter](https://openrouter.ai) ซึ่งต้องมี `OPENROUTER_API_KEY` ในสภาพแวดล้อมหรือในไฟล์ `.env` ข้าง `manage.py` (`init` จะพิมพ์บรรทัดที่ต้องตั้งค่าเมื่อไม่พบคีย์) บนเครื่องที่รันเซิร์ฟเวอร์โมเดล (Ollama, LM Studio, vLLM) การใช้ `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` จะไม่ต้องใช้คีย์ และไม่มีข้อมูลใดออกจากเครื่อง ส่วนตัวรัน CI จะไม่มีเซิร์ฟเวอร์โมเดล ดังนั้น CI จึงต้องระบุโมเดลแบบโฮสต์สำหรับการทำงาน (ดูที่ [คู่มือ CI](/docs/guides/ci-cd)) ดูวิธีการทั้งหมดและคีย์ที่แต่ละวิธีต้องใช้ได้ที่: [วิธีการแปล](/docs/guides/translation-methods)

จากนั้น:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

การซิงก์จะแปลทุกรายการที่มี `msgstr` ว่างเปล่า และทุกรายการที่เป็น `fuzzy` พร้อมกับลบแฟล็ก `fuzzy` ออก รายการที่แปลแล้วจะถูกคงไว้แบบไบต์ต่อไบต์พร้อมกับคอมเมนต์ รายการที่มี `msgctxt` จะนับเป็นคีย์และรายการแคชของตัวเอง ดังนั้นคำว่า "Open" ที่เป็นคำกริยาและ "Open" ที่เป็นคำคุณศัพท์จะได้รับการแปลแยกกัน คอมเมนต์ `#.` และบริบทจะถูกส่งไปยังโมเดล — หากต้องการดูคำขอที่แท้จริงโดยไม่ต้องส่ง ให้เรียกใช้ `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` (บริบทและคอมเมนต์จะปรากฏใต้ "UI context for these keys")

**การตั้งใจแปลรายการใดรายการหนึ่งซ้ำ** ให้ระบุด้วย msgid:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

รายการนี้จะถูกดึงมาจาก Translation Memory หากแคชมีข้อความนั้นอยู่แล้ว คุณจึงได้คำแปลเดิมกลับมาโดยไม่มีค่าใช้จ่าย และการซิงก์จะแจ้งผ่านคำสั่ง `--fresh` การทำซ้ำเช่นนี้ไม่จำเป็นต้องใช้โมเดล: หากใช้ `local` ขณะที่เซิร์ฟเวอร์โมเดลหยุดทำงาน การซิงก์จะแจ้งเตือนว่าเซิร์ฟเวอร์ไม่ตอบสนองและการทำงานรอบนี้ไม่จำเป็นต้องใช้ แล้วจะดำเนินการต่อไป (การทำซ้ำที่ต้องส่งข้อมูลจะหยุดทำงานพร้อมระบุชื่อเซิร์ฟเวอร์) หากต้องการจ่ายค่าแปลใหม่ ให้เพิ่ม `--fresh` เครื่องหมายจุลภาคภายใน msgid ให้เขียนเป็น `\,` และเครื่องหมายคำพูดจะป้องกันไม่ให้เชลล์อ่านส่วนที่เหลือ รายการที่มีบริบทจะระบุชื่อตามที่รายงานพิมพ์แสดง คือ `verb␄Open` หากคุณไม่สามารถพิมพ์ `␄` ได้ ให้เขียน `\x04` แทน: `--redo 'keys:verb\x04Open'` ทั้งสองรูปแบบใช้งานได้ และคำสั่งซ่อมแซมจะแสดงทั้งสองแบบ หากต้องการระบุชื่อรายการในโดเมนเดียวเท่านั้น ให้ใส่โดเมนนำหน้า: `django::Welcome` หากชื่อไม่ตรงกับรายการใด การทำงานจะล้มเหลว (exit 1) และจะแสดงรายการที่ใกล้เคียงที่สุด เช่น ทุกบริบทของ msgid `Cancel` (`button␄Cancel`, `status␄Cancel`) โดยจะไม่ถือว่าเป็นการทำซ้ำที่เสร็จสมบูรณ์อย่างเด็ดขาด

แคตตาล็อกที่ champollion สร้างขึ้น (`init --langs` หรือการซิงก์สำหรับภาษาที่ยังไม่มีแคตตาล็อก) จะได้รับส่วนหัว gettext มาตรฐาน พร้อมฟิลด์ต่างๆ ที่ `msginit` เขียน เพื่อให้ `msgfmt -c` ยอมรับ ส่วนหัวของแคตตาล็อกที่มีอยู่เดิมจะไม่ถูกเขียนทับ

**คำเตือนส่วนหัวของ `msgfmt -c` บนแคตตาล็อกที่ `makemessages` เริ่มต้นไว้** `makemessages` จะเขียนส่วนหัวเทมเพลตของ gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>` ซึ่งทำเครื่องหมายเป็น `#, fuzzy` — จากนั้น `msgfmt -c` จะเตือนทุกครั้งที่คอมไพล์ว่าแต่ละฟิลด์ "still has the initial default value" การซิงก์จะไม่แก้ไขค่าเหล่านั้น (ในส่วนหัวที่มีอยู่เดิม ระบบจะเติมเฉพาะตัวยึดตำแหน่ง `Plural-Forms` หรือชุดอักขระเท่านั้น) ดังนั้นให้แก้ไขด้วยตนเองเพียงครั้งเดียวในแต่ละแคตตาล็อก: ชื่อและเวอร์ชันของโปรเจกต์คุณ วันที่ ผู้แปล (หรือ `Automatically generated`) และทีมแปล (หรือ `none`) นอกจากนี้ให้ลบบรรทัด `#, fuzzy` เหนือ `msgid ""` ออกด้วย ซึ่งเป็นบรรทัดที่ระบุว่าส่วนหัวยังไม่ได้รับการตรวจสอบ `makemessages` จะคงค่าที่คุณเขียนไว้ ส่วน `compilemessages` (`msgfmt --check-format`) ไม่ได้ตรวจสอบส่วนหัว คำเตือนเหล่านี้จึงไม่ทำให้การทำงานล้มเหลว

**รูปแบบพหูพจน์** `msgid` + `msgid_plural` จะรวมกันเป็นข้อความเดียวที่โมเดลจะแปลออกมาในทุกรูปแบบที่ภาษานั้นต้องการ รูปแบบต่างๆ จะถูกเขียนลงใน `msgstr[0]`, `msgstr[1]`, … ตามส่วนหัว `Plural-Forms` ของแคตตาล็อก Django จะเขียนส่วนนี้ให้คุณ ส่วนแคตตาล็อกที่ไม่มีส่วนหัวนี้ จะได้รับส่วนหัวตามที่ `msginit` เขียนไว้สำหรับภาษานั้น (ภาษาฝรั่งเศสคือ `nplurals=2; plural=(n > 1);`) หรือส่วนหัวที่ดึงมาจาก CLDR สำหรับภาษาที่ `msginit` ไม่มีในรายการ:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

เมื่อผลการแปลตกหล่นรูปแบบที่ภาษานั้นใช้สำหรับการนับทั่วไป (ภาษารัสเซียคือ `few` หรือ `many`) การซิงก์จะส่งคำขอไปยังโมเดลอีกครั้ง หากคำตอบยังคงขาดรูปแบบดังกล่าว การซิงก์จะเขียนรูปแบบ `other` ลงแทนที่ พร้อมทำเครื่องหมายรายการนั้นด้วยคอมเมนต์ `# champollion:` และระบุชื่อรายการพร้อมคำสั่งสำหรับขอรับการแปลอีกครั้ง (`--redo 'keys:django::One file' --fresh`) ทุกการซิงก์จะออกด้วยสถานะ `2` ตราบใดที่ยังมีรายการที่ถูกทำเครื่องหมายนี้อยู่ในแคตตาล็อก ไม่ใช่เฉพาะการซิงก์รอบที่เขียนค่านั้นลงไปเท่านั้น เช่นเดียวกับคีย์ที่ถูกระงับไว้ บรรทัดตรวจสอบปิดท้ายจะแจ้งว่าการทำงานไม่สมบูรณ์แทนที่จะเป็น `[OK]` คุณสามารถเขียนรูปแบบต่างๆ ด้วยตนเองแล้วลบบรรทัดคอมเมนต์ออก หรือสั่งให้ขอคำแปลใหม่อีกครั้งด้วย `--model` ที่มีประสิทธิภาพมากขึ้น การซิงก์ด้วยวิธีหรือโมเดลอื่น (โมเดลแบบโฮสต์ของ CI หลังจากใช้โมเดลในเครื่อง) จะขอคำแปลสำหรับรายการนั้นใหม่โดยอัตโนมัติ และ `sync --redo gaps` จะขอคำแปลสำหรับทุกรายการที่ถูกทำเครื่องหมาย หากคำตอบยังคงขาดรูปแบบดังกล่าว รายการนั้นก็จะยังคงถูกทำเครื่องหมายไว้ต่อไป ใน CI สิ่งนี้จะทำให้งานล้มเหลวหลังจาก commit (ดูที่ [คู่มือ CI](/docs/guides/ci-cd#plural-gaps))

**โครงสร้าง gettext แบบอื่น**

| โปรเจกต์ | การกำหนดค่า | ต้นทาง |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` หรือไฟล์ `.pot` เพียงไฟล์เดียวใน `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` หรือ `messages.pot` ใน `translations/` หรือโฟลเดอร์ที่อยู่เหนือขึ้นไป |

ตัวยึดตำแหน่ง `printf` (`%s`, `%(name)s`, `%d`) จะต้องคงอยู่หลังการแปล และเกณฑ์คุณภาพ (quality gate) จะปฏิเสธค่าใดก็ตามที่ทำตัวยึดตำแหน่งสูญหาย ถึงกระนั้นโปรดเรียกใช้ `msgfmt --check-format` (เช่นเดียวกับที่ `compilemessages` ทำ) ก่อนเผยแพร่ใช้งานจริง คำสั่งนี้ยังตรวจสอบประเภทของตัวยึดตำแหน่งด้วย แต่จะตรวจเฉพาะรายการที่ติดแฟล็ก `#, python-format` เท่านั้น: `makemessages` จะเพิ่มแฟล็กนี้ให้กับรายการที่ดึงข้อมูลออกมาพร้อมตัวยึดตำแหน่ง `%` ขณะที่แคตตาล็อกที่สร้างด้วยตนเองอาจไม่มีแฟล็กนี้ ทำให้รายการเหล่านั้นไม่ได้รับการตรวจสอบ ส่วน `champollion verify` จะเปรียบเทียบตัวยึดตำแหน่ง printf ของทุกรายการ (ชื่อและตัวอักษรประเภท) ไม่ว่าจะมีแฟล็กใดก็ตาม และการซิงก์จะคงแฟล็กของรายการต้นทางไว้ในทุกรายการที่แปล แคตตาล็อกจะต้องเข้ารหัสเป็น UTF-8 ดูข้อกำหนดฉบับเต็มได้ที่ [แคตตาล็อก gettext](/docs/getting-started/configuration#gettext)
