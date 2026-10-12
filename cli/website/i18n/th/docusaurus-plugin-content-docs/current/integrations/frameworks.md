# คู่มือการผสานรวม

การตั้งค่าทีละขั้นตอนสำหรับ champollion กับเฟรมเวิร์กยอดนิยม

คำสั่งในหน้านี้จะรัน champollion ด้วย `npx --yes champollion@0.5 <command>` ซึ่งตรึงเวอร์ชันไว้ที่สาย 0.5 เช่นเดียวกับใน [คู่มือ CI](/docs/guides/ci-cd) เพื่อให้แล็ปท็อปของคุณและ CI ทำงานบนเวอร์ชันเดียวกัน และการปล่อยเวอร์ชันใหม่จะไม่ส่งผลกระทบต่อการรันโดยไม่คาดคิด อีกทางเลือกหนึ่งคือการติดตั้งเฉพาะในโปรเจกต์ ในโปรเจกต์ Node คำสั่ง `npm install --save-dev champollion@0.5` จะเพิ่มแพ็กเกจไปยัง `package.json` และคำสั่ง `npx champollion sync` จะเรียกใช้ชุดที่ติดตั้งนั้น

---

## การตั้งค่า API Key

ก่อนผสานรวมกับเฟรมเวิร์กใดๆ คุณต้องมี API key สำหรับการแปล Champollion รองรับผู้ให้บริการสองราย:

### ตัวเลือก A: OpenRouter (แนะนำ)

[OpenRouter](https://openrouter.ai) ให้บริการ API แบบรวมศูนย์สำหรับโมเดล LLM กว่า 200 รายการ มีระดับบริการฟรี

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

เหมาะสำหรับ: โปรเจกต์ที่มีเนื้อหาจำนวนมาก การแปล Markdown และโปรเจกต์ที่ต้องการการป้องกันเนื้อหา (code blocks, shortcodes, ตัวแปร interpolation)

### ตัวเลือก B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

เหมาะที่สุดสำหรับ: คู่สตริงคีย์-ค่า (key-value) ปริมาณมาก (194 ภาษา) **ไม่แนะนำ** สำหรับเนื้อหา Markdown — Google Translate ไม่สามารถรับรู้บล็อกโค้ด, ชอร์ตโค้ด (shortcodes) หรือตัวแปรแทรกข้อความ (interpolation variables) ได้

หากต้องการใช้ Google Translate อย่างชัดเจน:

```bash
champollion sync --method google-translate
```

> **เคล็ดลับ**: หากตั้งค่าเฉพาะ `GOOGLE_TRANSLATE_API_KEY` (ไม่มี OpenRouter key) champollion จะสลับไปใช้ Google Translate โดยอัตโนมัติ

---

## Hugo (TOML / YAML / Markdown)

### โครงสร้างโปรเจกต์

Hugo ใช้ `i18n/` สำหรับการแปล string และ `content/` สำหรับเนื้อหาหน้า:

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

**Front matter**: รองรับทั้ง YAML (`---`) และ TOML (`+++`) delimiters แปล `title`, `description`, `summary`, `subtitle`, `caption` และ `linkTitle` ตามค่าเริ่มต้น ฟิลด์อื่นๆ ทั้งหมด (date, draft, tags, weight, slug ฯลฯ) จะถูกเก็บรักษาไว้ ปรับแต่งได้ด้วย `translatableFields` ในการกำหนดค่าของคุณ

**การป้องกัน Block**: Code blocks, Hugo shortcodes (`{{< >}}`, `{{% %}}`), inline code และ raw HTML จะถูกป้องกันโดยอัตโนมัติโดยใช้ Unicode sentinel placeholders และจะผ่านไปโดยไม่ถูกแตะต้อง

**รูปแบบชื่อไฟล์**: ปฏิบัติตามรูปแบบ translation-by-filename ของ Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (ตัด source suffix ออก)

**ข้ามไฟล์ที่มีอยู่**: ไฟล์ที่แปลแล้วจะไม่ถูกเขียนทับ ลบไฟล์เป้าหมายเพื่อบังคับให้แปลใหม่

### รูปแบบพหูพจน์

TOML และ YAML locales รองรับรูปแบบพหูพจน์ CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

แสดงภายในเป็น `items.one` และ `items.other` สำหรับการ diff จากนั้น re-serialize ไปยังรูปแบบ sectioned ที่ถูกต้องเมื่อเขียน

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

รัน `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar` คำสั่งจะค้นหา `messages/en.json` สร้างไฟล์ปลายทางที่ว่างเปล่า และเขียนคอนฟิกดังตัวอย่างด้านล่าง หรือคุณจะสร้าง `champollion.config.json` ด้วยตัวเองก็ได้:

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

ระดับภาษา (register) ของแต่ละเป้าหมาย (โทนเสียงและความเป็นทางการ) จะถูกเขียนลงใน `languages` เพื่อให้มองเห็นและแก้ไขได้: คุณสามารถเปลี่ยนค่าใดค่าหนึ่งเป็นพรีเซ็ตอื่นของภาษานั้น (`champollion status` จะแสดงรายการเหล่านี้) หรือเป็นคำที่คุณกำหนดเอง ภาษาที่ไม่มีพรีเซ็ตจะถูกเขียนเป็น `{}` นอกจากนี้ รายการธรรมดาอย่าง `"languages": ["fr", "de"]` ก็สามารถใช้งานได้เช่นกันและจะใช้ค่าเริ่มต้นของแต่ละภาษา

```bash
npx --yes champollion@0.5 sync
```

สร้าง `messages/fr.json`, `messages/ja.json` ฯลฯ — แปลครบถ้วน โดยรักษาโครงสร้าง nested key ของคุณไว้ next-intl จะรับรู้ไฟล์เหล่านี้โดยอัตโนมัติ

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
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init` จะค้นหา `public/locales/en/` (หรือ `locales/en/`) กำหนดให้การกำหนดค่าชี้ไปที่ไฟล์ดังกล่าว และสร้าง `fr/common.json`, `fr/admin/users.json` ตลอดจนไฟล์อื่นๆ เป็นไฟล์เปล่า ส่วนของการกำหนดค่าที่เกี่ยวข้องที่ถูกเขียนขึ้นคือ:

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

ไฟล์ namespace แต่ละไฟล์จะได้รับการแปลและเขียนลงในพาธเดียวกันภายในโฟลเดอร์ของแต่ละภาษา ข้อความที่ปรากฏในหลาย namespace จะถูกแปลเพียงครั้งเดียวต่อภาษา ส่วนไฟล์อื่นๆ จะดึงค่านั้นมาจาก Translation Memory คีย์รูปพหูพจน์ (`key_one`, `key_other`) จะได้รับรูปแบบเฉพาะของแต่ละภาษา โดยอ่านจาก CLDR ผ่าน JavaScript `Intl.PluralRules` API: รูปแบบที่ภาษานั้นใช้แต่ต้นฉบับไม่มีจะถูกเพิ่มเข้ามา และรูปแบบที่ภาษานั้นไม่ได้ใช้จะถูกละเว้นไป เมื่อใช้ภาษาอังกฤษเป็นต้นฉบับ ภาษาสเปนและภาษาฝรั่งเศสจะได้ `key_many` เพิ่มเข้ามา ภาษารัสเซียจะได้ `key_few` และ `key_many` เพิ่มเข้ามา ส่วนภาษาญี่ปุ่นจะคงเหลือเพียง `key_other` เท่านั้น การ sync จะระบุชื่อรูปแบบที่แต่ละภาษาของคุณได้รับเพิ่มเติม ดูเพิ่มเติมที่ [คีย์พหูพจน์ของ i18next](/docs/getting-started/configuration#i18next-plurals) และ [โครงสร้างไฟล์ Locale](/docs/getting-started/configuration#locale-layouts)

### หนึ่งไฟล์ต่อภาษา

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

หากไฟล์ของคุณมีรูปแบบอื่น ให้ระบุรูปแบบด้วย `localesPattern` (`{lang}` คือภาษา และ `{ns}` คือเนมสเปซ):

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

`flutter gen-l10n` จะอ่านไฟล์ `.arb` หนึ่งไฟล์ต่อหนึ่งภาษา โดยไฟล์ภาษาอังกฤษจะใช้เป็นเทมเพลต:

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` จะอ่าน `pubspec.yaml` และ `l10n.yaml` (`arb-dir`, `template-arb-file`) กำหนดภาษาต้นทางจากชื่อของเทมเพลต (`app_en.arb` → `en`) และสร้าง `app_fr.arb`, `app_de.arb` และ `app_pt_BR.arb` พร้อมด้วย `@@locale` คอนฟิกที่ถูกสร้างขึ้นจะมีลักษณะดังนี้:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

หาก `l10n.yaml` กำหนดค่า `arb-dir: assets/i18n` และ `template-arb-file: intl_en.arb` รูปแบบแพตเทิร์นจะเป็น `"assets/i18n/intl_{lang}.arb"`

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

ระบบจะแปลเฉพาะข้อความเท่านั้น ไฟล์ปลายทางแต่ละไฟล์จะมี `"@@locale"` ที่ตั้งค่าตามโลแคลของตัวเอง โดยเขียนในรูปแบบเดียวกับที่ระบุในชื่อไฟล์ (`"pt_BR"`) เนื่องจาก `gen-l10n` จะปฏิเสธไฟล์ที่มีค่า `@@locale` ไม่ตรงกับชื่อไฟล์ ออบเจกต์เมทาดาตา `@key` ทุกรายการ เช่น ตัวแทนที่ (placeholder) และชนิดข้อมูล จะถูกคัดลอกจาก `app_en.arb` โดยไม่มีการเปลี่ยนแปลง ลำดับของคีย์จะเรียงตามเทมเพลต และข้อความที่ยังไม่ได้รับการแปลจะถูกละเว้นไว้ เพื่อให้ Flutter สลับไปใช้ภาษาอังกฤษเป็นภาษาสำรอง (fallback)

คำอธิบาย (description) ในเมทาดาตาของเทมเพลตจะถูกส่งไปยังโมเดลเป็นบริบท:

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

ไวยากรณ์ `{count, plural, …}` ตัวแทนที่ `{count}` และ selector จะได้รับการปกป้อง: หากผลการแปลมีการเปลี่ยนแปลงสิ่งเหล่านี้ ระบบจะปฏิเสธและลองใหม่อีกครั้ง (ดูที่ [ข้อความ ICU](/docs/getting-started/configuration#icu)) ภาษาฝรั่งเศสอาจเพิ่มกิ่ง `many` และภาษาโปแลนด์อาจเพิ่ม `few` และ `many` นอกจากนี้ `champollion verify` ยังตรวจสอบ `@@locale` และเมทาดาตาของตัวแทนที่ในทุกไฟล์ปลายทาง หากเครื่องมือก่อนหน้านี้แปลค่าเหล่านั้นไป `champollion sync --pair en:fr --force` จะเขียนไฟล์นั้นใหม่ ส่วนข้อความที่ไม่มีการเปลี่ยนแปลงจะดึงมาจากแคชโดยไม่มีค่าใช้จ่าย

### โลแคลที่อยู่นอกรายการของ Flutter {#flutter-locales-outside-flutters-own-list}

ข้อความของคุณจะมาจากไฟล์ `.arb` ส่วนข้อความภายในวิดเจ็ตของ Flutter เอง เช่น ตัวเลือกวันที่, "Back", "Cancel" ตลอดจนทิศทางของข้อความ จะมาจาก `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`) ซึ่งครอบคลุมเฉพาะภาษาในรายการที่กำหนดไว้ ([รายการของ Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)) รหัสที่ใช้เป็นการส่วนตัว (private-use code) เช่น `qaa` และภาษาส่วนใหญ่ที่มีทรัพยากรน้อย (low-resource languages) จะไม่ได้อยู่ในรายการนี้ หากมีโลแคลดังกล่าวใน `supportedLocales` แอปจะเกิดข้อผิดพลาดขณะทำงาน ("No MaterialLocalizations found") เว้นแต่จะมี delegate มาคอยจัดเตรียมข้อความนั้นให้ ทั้ง `init` และการ sync ที่สร้างไฟล์ `.arb` ใหม่ จะแจ้งเตือนสำหรับเป้าหมายแต่ละรายการที่อยู่นอกรายการ: โดยจะอ่านข้อมูลจาก Flutter SDK ในเครื่อง (`FLUTTER_ROOT` หรือ `flutter` บน `PATH`) และหากไม่พบ SDK ก็จะระบุว่ามีเป้าหมายใดบ้างที่ไม่สามารถตรวจสอบได้

วิธีแก้ไขที่เรียบง่ายที่สุดคือการนำข้อความภาษาที่ Flutter รองรับมาใช้กับวิดเจ็ตเหล่านั้นชั่วคราว (ในที่นี้คือภาษาอังกฤษ):

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

ระบุไว้ต่อจาก delegate ของ Flutter เอง:

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

จากนั้นวิดเจ็ตจะแสดงข้อความกำกับเป็นภาษาอังกฤษภายในแอปที่ข้อความหลักเป็นภาษาของคุณ หากต้องการแปลข้อความของวิดเจ็ตด้วยเช่นกัน คู่มือของ Flutter มีตัวอย่างการตั้งค่า `MaterialLocalizations` แบบเต็มสำหรับภาษาใหม่: [Adding support for a new language](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language)

---

## Django และ gettext (.po)

champollion CLI เป็นซอร์สโค้ดที่เปิดเผยภายใต้สัญญาอนุญาต [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): ใช้งาน แก้ไข และแบ่งปันได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ การนำไปใช้เพื่อวัตถุประสงค์เชิงพาณิชย์จะไม่ครอบคลุมภายใต้สัญญาอนุญาตนี้ ([ใครบ้างที่สามารถใช้งานได้](/docs/getting-started/who-may-use-this))

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

Django จะค้นหา catalog ในโฟลเดอร์ที่ระบุไว้ใน `LOCALE_PATHS` และในโฟลเดอร์ `locale/` ของแต่ละแอปที่ติดตั้งไว้ โฟลเดอร์ `locale/` ที่อยู่ข้าง `manage.py` ไม่ได้เป็นของแอปใดเลย ดังนั้นจนกว่า `LOCALE_PATHS` จะระบุชื่อโฟลเดอร์ดังกล่าว คำสั่ง `compilemessages` จะยังคงสร้างไฟล์ `.mo` ได้ แต่เว็บไซต์จะยังคงแสดงข้อความที่ยังไม่ได้แปล `LANGUAGES` คือรายการภาษาที่เว็บไซต์ให้บริการ ค่าเริ่มต้นของ Django คือทุกภาษาที่มาพร้อมกับตัวเฟรมเวิร์ก ดังนั้นโปรดระบุเฉพาะภาษาของคุณ:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### การตั้งค่า

สร้างหรือรีเฟรช catalog ด้วย Django ก่อนเป็นอันดับแรก โดยใช้ catalog ภาษาอังกฤษเป็นต้นฉบับ ค่า `msgstr` ที่ว่างเปล่าจะหมายถึง "ใช้ค่า msgid เป็นข้อความ":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` จะค้นหา `manage.py` และ `locale/en/LC_MESSAGES/django.po` แล้วเขียนค่าดังนี้:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` คือโดเมนของ gettext ดังนั้นทั้ง `django.po` และ `djangojs.po` จะได้รับการ sync ทั้งคู่

**ค่าเริ่มต้นประกอบด้วยระดับภาษา (tone) และรูปแบบการระบุเพศภาวะ (gender style) โดยที่ `init` จะพิมพ์แสดงทั้งสองอย่าง** `formal-vous` จะขอให้โมเดลใช้ "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." คำแนะนำเรื่องเพศภาวะของภาษาฝรั่งเศสจะขอให้ใช้ *écriture inclusive* ร่วมกับจุดกึ่งกลาง (middle dot) เมื่อไม่ทราบเพศของผู้อ่าน (`Connecté·e`, `Utilisateur·rice·s`) ส่วนของภาษารัสเซีย (`formal-vy`) จะใช้รูปเพศชายซึ่งเป็นค่าเริ่มต้นทั่วไป หากเว็บไซต์ต้องการรูปแบบอื่น (เช่น หน้าเว็บสำหรับผู้ป่วยของคลินิก) สามารถเปลี่ยนได้ใน `champollion.config.json`: กำหนดระดับภาษาใน `languages` (`"fr": "casual-tu"` หรือข้อความที่คุณกำหนดเอง) และ `genderGuidance` — ใช้ `false` หากไม่ต้องการระบุคำแนะนำ หรือใส่คำแนะนำของคุณเอง เช่น `"Use the masculine generic."` ([คำแนะนำเรื่องเพศภาวะ](/docs/getting-started/configuration#gender-guidance)) การตั้งค่าที่เปลี่ยนแปลงไปจะมีรายการแคชแยกเป็นของตัวเอง ดังนั้น `sync --redo all` จะทำการแปลสิ่งที่ค่าเดิมเคยเขียนไว้อีกครั้ง

**วิธีใดที่ใช้ในการแปล และต้องใช้คีย์ใดบ้าง** หากไม่มี `--method` ตัว `init` จะตั้งค่าเริ่มต้นเป็น `llm`: ซึ่งเป็นโมเดลบน [OpenRouter](https://openrouter.ai) ที่จำเป็นต้องมี `OPENROUTER_API_KEY` ในตัวแปรสภาพแวดล้อมหรือในไฟล์ `.env` ซึ่งอยู่ข้างๆ `manage.py` (`init` จะพิมพ์บรรทัดที่ต้องตั้งค่าหากไม่พบคีย์ดังกล่าว) บนเครื่องที่รันเซิร์ฟเวอร์โมเดล (Ollama, LM Studio, vLLM) คำสั่ง `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` ไม่จำเป็นต้องใช้คีย์ใดๆ และไม่มีข้อมูลใดถูกส่งออกจากเครื่อง ส่วน CI runner จะไม่มีเซิร์ฟเวอร์โมเดล ดังนั้น CI จึงต้องระบุโมเดลแบบโฮสต์สำหรับการรัน (ดูเพิ่มเติมที่ [คู่มือ CI](/docs/guides/ci-cd)) รายละเอียดของแต่ละวิธีและคีย์ที่จำเป็นต้องใช้: [วิธีการแปล](/docs/guides/translation-methods)

จากนั้น:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

การ sync จะแปลทุกรายการที่มี `msgstr` ว่างเปล่า และทุกรายการที่เป็น `fuzzy` พร้อมทั้งลบแฟล็ก `fuzzy` ออก ส่วนรายการที่แปลแล้วจะคงไว้เหมือนเดิมแบบไบต์ต่อไบต์ รวมถึงความคิดเห็น (comment) ต่างๆ รายการที่มี `msgctxt` จะถือเป็นคีย์เฉพาะและเป็นรายการแคชของตัวเอง ดังนั้นคำว่า "Open" ที่เป็นคำกริยาและ "Open" ที่เป็นคำคุณศัพท์จะได้รับการแปลแยกจากกัน ความคิดเห็น `#.` และบริบทจะถูกส่งไปยังโมเดล — หากต้องการดู request ที่ส่งแบบแม่นยำโดยไม่ต้องส่งจริง ให้รัน `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (บริบทและความคิดเห็นจะปรากฏใต้หัวข้อ "UI context for these keys")

**การแปลซ้ำเฉพาะรายการที่ต้องการ** ระบุชื่อรายการด้วย msgid:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

รายการนี้จะถูกดึงมาจาก Translation Memory หากในแคชมีข้อความนั้นอยู่แล้ว คุณจึงได้ผลการแปลเดิมกลับมาโดยไม่มีค่าใช้จ่าย และการ sync จะแจ้งสิ่งนี้ผ่านคำสั่ง `--fresh` การทำซ้ำเช่นนี้ไม่จำเป็นต้องใช้โมเดล: เมื่อใช้ `local` และเซิร์ฟเวอร์โมเดลหยุดทำงาน การ sync จะแจ้งเตือนว่าเซิร์ฟเวอร์ไม่ตอบสนองแต่การรันครั้งนี้ไม่จำเป็นต้องใช้ แล้วจะทำงานต่อไป (หากเป็นการทำซ้ำที่ต้องส่งข้อมูลไประบบจะหยุดทำงานและระบุชื่อเซิร์ฟเวอร์) หากต้องการส่งแปลใหม่ ให้เพิ่ม `--fresh` เครื่องหมายจุลภาคภายใน msgid ให้เขียนเป็น `\,` และการใส่เครื่องหมายคำพูดจะช่วยป้องกันไม่ให้เชลล์อ่านข้อความส่วนที่เหลือ รายการที่มีบริบทจะถูกระบุชื่อตามที่ปรากฏในรายงานคือ `verb␄Open` หากคุณไม่สามารถพิมพ์ `␄` ได้ ให้เขียนเป็น `\x04` แทน: `--redo 'keys:verb\x04Open'` สามารถใช้ได้ทั้งสองแบบ และคำสั่งซ่อมแซมจะแสดงให้เห็นทั้งสองรูปแบบ หากต้องการระบุรายการเฉพาะในโดเมนเดียว ให้ใส่ชื่อโดเมนนำหน้า: `django::Welcome` หากชื่อที่ระบุไม่ตรงกับรายการใดเลย การรันจะล้มเหลว (exit 1) และจะแสดงรายการที่ใกล้เคียงที่สุด เช่น ทุกบริบทของ msgid `Cancel` (`button␄Cancel`, `status␄Cancel`) โดยจะไม่ถือว่าการทำซ้ำเสร็จสิ้นอย่างเด็ดขาด

catalog ที่ champollion สร้างขึ้น (`init --langs` หรือการ sync สำหรับภาษาที่ยังไม่มี catalog) จะได้รับส่วนหัวมาตรฐานของ gettext ซึ่งมีฟิลด์ต่างๆ ตามที่ `msginit` สร้างขึ้น เพื่อให้ `msgfmt -c` ยอมรับไฟล์นั้น ส่วนหัวของ catalog ที่มีอยู่เดิมจะไม่ถูกเขียนทับ

**คำเตือนเกี่ยวกับส่วนหัวจาก `msgfmt -c` บน catalog ที่ `makemessages` เริ่มต้นไว้** `makemessages` จะเขียนส่วนหัวเทมเพลตของ gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>` ที่มีเครื่องหมาย `#, fuzzy` — จากนั้น `msgfmt -c` จะแจ้งเตือนทุกครั้งที่คอมไพล์ว่าแต่ละฟิลด์ "still has the initial default value" การ sync จะไม่แตะต้องค่าเหล่านั้น (ในส่วนหัวที่มีอยู่เดิม ระบบจะกรอกเฉพาะตัวแทนที่ `Plural-Forms` หรือ charset เท่านั้น) ดังนั้นโปรดแก้ไขด้วยตนเองเพียงครั้งเดียวในแต่ละ catalog: ใส่ชื่อและเวอร์ชันของโปรเจกต์คุณ วันที่ ผู้แปล (หรือ `Automatically generated`) และทีมงาน (หรือ `none`) รวมถึงลบบรรทัด `#, fuzzy` ที่อยู่เหนือ `msgid ""` ออก ซึ่งเป็นบรรทัดที่ระบุว่าส่วนหัวยังไม่ได้รับการตรวจสอบ โดยที่ `makemessages` จะยังคงเก็บค่าที่คุณเขียนไว้ ส่วน `compilemessages` (`msgfmt --check-format`) จะไม่ตรวจสอบส่วนหัว ดังนั้นคำเตือนเหล่านี้จะไม่ทำให้การทำงานล้มเหลว

**รูปพหูพจน์** `msgid` + `msgid_plural` จะรวมเป็นหนึ่งข้อความที่โมเดลจะแปลออกมาในทุกรูปแบบที่ภาษานั้นต้องการ รูปแบบต่างๆ จะถูกเขียนลงใน `msgstr[0]`, `msgstr[1]`, … ตามส่วนหัว `Plural-Forms` ของ catalog โดย Django จะเขียนส่วนหัวนี้ให้คุณโดยอัตโนมัติ สำหรับ catalog ที่ไม่มีส่วนหัวนี้ จะได้รับส่วนหัวตามที่ `msginit` กำหนดไว้สำหรับภาษานั้น (ภาษาฝรั่งเศสคือ `nplurals=2; plural=(n > 1);`) หรือคำนวณมาจาก CLDR สำหรับภาษาที่ `msginit` ไม่ได้ระบุไว้ในรายการ:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

เมื่อผลการแปลขาดรูปแบบที่ภาษานั้นใช้สำหรับการนับจำนวนทั่วไป (ภาษารัสเซีย `few` หรือ `many`) การ sync จะสอบถามโมเดลใหม่อีกครั้ง หากคำตอบยังคงขาดรูปแบบนั้นอยู่ การ sync จะเขียนรูปแบบ `other` ลงไปแทน ทำเครื่องหมายรายการนั้นด้วยความคิดเห็น `# champollion:` และระบุชื่อรายการพร้อมคำสั่งสำหรับขอรับการแปลใหม่ (`--redo 'keys:django::One file' --fresh`) การ sync ทุกครั้งจะจบการทำงานด้วยรหัส `2` ตราบใดที่ยังมีรายการที่ถูกทำเครื่องหมายอยู่ใน catalog ไม่ใช่เฉพาะการ sync รอบที่เขียนค่านั้นลงไปเท่านั้น เช่นเดียวกับกรณีของคีย์ที่ถูกระงับไว้ (held back) บรรทัดตรวจสอบตอนปิดท้ายจะแจ้งว่าการรันยังไม่สมบูรณ์แทนที่จะเป็น `[OK]` คุณสามารถเขียนรูปแบบพหูพจน์ด้วยตนเองแล้วลบบรรทัดความคิดเห็นออก หรือขอรับการแปลใหม่อีกครั้งด้วย `--model` ที่มีประสิทธิภาพสูงกว่า การ sync ด้วยวิธีหรือโมเดลอื่น (โมเดลแบบโฮสต์ของ CI หลังจากใช้โมเดลในเครื่อง) จะส่งคำขอสำหรับรายการนั้นซ้ำให้โดยอัตโนมัติ และคำสั่ง `sync --redo gaps` จะส่งคำขอซ้ำสำหรับทุกรายการที่ถูกทำเครื่องหมาย หากคำตอบยังคงขาดรูปแบบดังกล่าว รายการนั้นก็จะยังคงมีเครื่องหมายอยู่ต่อไป ใน CI กรณีนี้จะทำให้งานล้มเหลวหลังการ commit (ดูเพิ่มเติมที่ [คู่มือ CI](/docs/guides/ci-cd#plural-gaps))

**โครงสร้าง gettext รูปแบบอื่น**

| โปรเจกต์ | คอนฟิก | ต้นฉบับ |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` หรือไฟล์ `.pot` ไฟล์เดียวใน `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` หรือ `messages.pot` ใน `translations/` หรือโฟลเดอร์ด้านบน |

ตัวแทนที่ `printf` (`%s`, `%(name)s`, `%d`) จะต้องคงอยู่หลังการแปล และเกณฑ์วัดคุณภาพ (quality gate) จะปฏิเสธค่าใดก็ตามที่ทำตัวแทนที่สูญหาย อย่างไรก็ตาม คุณควรยังคงรัน `msgfmt --check-format` (`compilemessages` ดำเนินการขั้นตอนนี้อยู่แล้ว) ก่อนนำไปใช้งานจริง คำสั่งนี้จะตรวจสอบชนิดข้อมูลของตัวแทนที่ด้วยเช่นกัน แต่จะตรวจเฉพาะรายการที่ติดแฟล็ก `#, python-format` เท่านั้น: คำสั่ง `makemessages` จะเพิ่มแฟล็กนี้ให้กับรายการที่ดึงข้อมูลออกมาพร้อมกับตัวแทนที่ `%` ในขณะที่ catalog ที่สร้างขึ้นด้วยตนเองอาจไม่มีแฟล็กดังกล่าว ทำให้รายการเหล่านั้นไม่ได้รับการตรวจสอบ ด้าน `champollion verify` จะเปรียบเทียบตัวแทนที่แบบ printf ในทุกรายการ (ทั้งชื่อและตัวอักษรระบุชนิดข้อมูล) ไม่ว่าจะมีแฟล็กใดก็ตาม และการ sync จะคงแฟล็กของรายการต้นฉบับไว้ในทุกรายการที่แปล catalog จะต้องเข้ารหัสเป็น UTF-8 ดูเพิ่มเติมที่ [gettext catalogs](/docs/getting-started/configuration#gettext) สำหรับกฎเกณฑ์ฉบับเต็ม
