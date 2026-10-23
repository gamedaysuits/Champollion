# أدلة التكامل

إعداد خطوة بخطوة لأداة champollion مع أطر العمل الشائعة.

تُشغّل الأوامر الواردة في هذه الصفحة أداة champollion باستخدام `npx --yes champollion@0.6 <command>`: مثبتةً على الإصدار 0.6، كما هو موضح في [دليل CI](/docs/guides/ci-cd)، لكي يعمل حاسوبك المحمول وبيئة CI الخاصة بك على الإصدار نفسه، ولا يتسبب أي إصدار جديد في تغيير التشغيل بصورة غير متوقعة. ويُعد التثبيت المحلي داخل المشروع هو البديل. في مشاريع Node، يضيفه الأمر `npm install --save-dev champollion@0.6` إلى `package.json`، ثم يقوم `npx champollion sync` بتشغيل تلك النسخة.

---

## إعداد مفتاح API

قبل التكامل مع أي إطار عمل، ستحتاج إلى مفتاح API للترجمة. يدعم Champollion مزوّدَين:

### الخيار أ: OpenRouter (موصى به)

يوفر [OpenRouter](https://openrouter.ai) واجهة برمجة تطبيقات (API) موحدة لأكثر من 200 نموذج من نماذج اللغات الكبيرة (LLM). وتتوفر خطة مجانية.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

الأفضل لـ: المشاريع الغنية بالمحتوى، وترجمة ملفات Markdown، والمشاريع التي تتطلب حماية واعية بالمحتوى (كتل الأكواد البرمجية، والأكواد القصيرة، ومتغيرات الاستيفاء).

### الخيار ب: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

الأفضل لـ: أزواج السلاسل النصية بنظام (المفتاح والقيمة) ذات الحجم الكبير (194 لغة). **لا يُوصى به** لمحتوى Markdown — إذ لا يمتلك Google Translate إدراكاً لكتل الأكواد البرمجية، أو الأكواد القصيرة، أو متغيرات الاستيفاء.

لاستخدام Google Translate بشكل صريح:

```bash
champollion sync --method google-translate
```

> **تلميح**: إذا تم ضبط `GOOGLE_TRANSLATE_API_KEY` فقط (بدون مفتاح OpenRouter)، يتحول champollion تلقائياً إلى Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### بنية المشروع

يستخدم Hugo المجلد `i18n/` لترجمات السلاسل النصية والمجلد `content/` لمحتوى الصفحات:

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

### الإعداد

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

أنشئ `champollion.config.json`:

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

### تفاصيل ترجمة المحتوى

**البيانات الوصفية (Front matter)**: يدعم محددات كل من YAML (`---`) وTOML (`+++`). ويترجم افتراضياً `title` و`description` و`summary` و`subtitle` و`caption` و`linkTitle`. وتُحفظ جميع الحقول الأخرى (date وdraft وtags وweight وslug وغيرها). يمكنك التخصيص عبر `translatableFields` في ملف التكوين الخاص بك.

**حماية الكتل**: تتم حماية كتل الأكواد البرمجية، وأكواد Hugo القصيرة (`{{< >}}`، `{{% %}}`)، والأكواد المضمنة، وHTML الخام تلقائياً باستخدام نصوص بديلة حارسة بنظام Unicode. وتمر دون أن يمسها أي تغيير.

**اصطلاح تسمية الملفات**: يتبع نمط Hugo في الترجمة حسب اسم الملف:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (يزيل لاحقة المصدر)

**تخطي الملفات الموجودة**: لا يتم مطلقاً الكتابة فوق الملفات المترجمة الموجودة مسبقاً. احذف الملف الهدف لفرض إعادة الترجمة.

### صيغ الجمع

تدعم لغات TOML وYAML صيغ الجمع الخاصة بـ CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

تُمثَّل داخلياً على هيئة `items.one` و`items.other` لتحديد الفروقات، ثم يُعاد تسلسلها إلى التنسيق المقسم الصحيح عند الكتابة.

---

## next-intl (JSON)

### بنية المشروع

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

### الإعداد

```bash
npm install --save-dev champollion
```

شغّل `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. سيعثر على `messages/en.json`، ويُنشئ الملفات الهدف الفارغة، ويكتب تكويناً مشابهاً لما هو موضح أدناه. أو أنشئ `champollion.config.json` بنفسك:

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

يُكتب الأسلوب اللغوي (نبرة الخطاب ودرجة رسميته) لكل لغة هدف داخل `languages`، بحيث يكون مرئياً وقابلاً للتعديل: يمكنك تغيير أحدها إلى إعداد مسبق آخر من إعدادات اللغة (يعرضها `champollion status`) أو بكلماتك الخاصة. واللغة التي ليس لها إعدادات مسبقة تُكتب كـ `{}`. وتعمل القائمة البسيطة، `"languages": ["fr", "de"]`، أيضاً وتستخدم الإعداد الافتراضي لكل لغة.

```bash
npx --yes champollion@0.6 sync
```

يُنشئ `messages/fr.json` و`messages/ja.json` وغيرهما — مترجمة بالكامل، مع الحفاظ على بنية المفاتيح المتداخلة لديك. ويتعرف عليها next-intl تلقائياً.

### سير عمل التطوير

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

### مجلد لكل لغة (الافتراضي في i18next)

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

يعثر `init` على `public/locales/en/` (أو `locales/en/`)، ويوجه ملف التكوين إليه، ويُنشئ `fr/common.json` و`fr/admin/users.json` والملفات الأخرى كملفات فارغة. الجزء ذو الصلة من التكوين الذي يكتبه:

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

يُترجَم كل ملف نطاق تسمية ويُكتب في المسار نفسه داخل مجلد كل لغة. والسلسلة النصية التي تظهر في عدة نطاقات تسمية تُترجم مرة واحدة لكل لغة؛ بينما تحصل عليها الملفات الأخرى من ذاكرة الترجمة. وتحصل مفاتيح الجمع (`key_one`، `key_other`) على الصيغ الخاصة بكل لغة، مقروءةً من CLDR عبر واجهة `Intl.PluralRules` في JavaScript: حيث تُضاف الصيغة التي تستخدمها اللغة وتفتقر إليها لغة المصدر، وتُستبعد الصيغة التي لا تستخدمها. فإذا كان المصدر بالإنجليزية، تكتسب الإسبانية والفرنسية صيغة `key_many`، وتكتسب الروسية صيغتي `key_few` و`key_many`، بينما تحتفظ اليابانية بـ `key_other` فقط. وتوضح عملية المزامنة بالاسم، بالنسبة للغاتك الخاصة، الصيغَ التي تكتسبها كل لغة. راجع [مفاتيح جمع i18next](/docs/getting-started/configuration#i18next-plurals) و[تخطيطات ملفات اللغات](/docs/getting-started/configuration#locale-layouts).

### ملف واحد لكل لغة

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

### تخطيطات أخرى

إذا كانت ملفاتك تتبع نمطاً آخر، فقم بوصفه باستخدام `localesPattern` (حيث يمثل `{lang}` اللغة، و`{ns}` نطاق التسمية):

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

### بنية المشروع

يقرأ `flutter gen-l10n` ملف `.arb` واحداً لكل لغة. والملف الإنجليزي هو القالب:

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

### الإعداد

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

يقرأ `init` كلاً من `pubspec.yaml` و`l10n.yaml` (`arb-dir`، `template-arb-file`)، ويأخذ لغة المصدر من اسم القالب (`app_en.arb` → `en`)، ويُنشئ `app_fr.arb` و`app_de.arb` و`app_pt_BR.arb` مع `@@locale` الخاصة بها. التكوين الذي يكتبه:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

إذا حدد `l10n.yaml` كلاً من `arb-dir: assets/i18n` و`template-arb-file: intl_en.arb`، فسيكون النمط هو `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

تُترجم الرسائل فقط. ويحصل كل هدف على `"@@locale"` مضبوطاً على إعداداته المحلية الخاصة، ومكتوباً بالطريقة نفسها المكتوب بها اسم الملف (`"pt_BR"`)، لأن `gen-l10n` يرفض أي ملف لا يتطابق فيه `@@locale` مع اسمه. ويتم نسخ كل كائن بيانات وصفية `@key`، مثل العناصر النائبة وأنواعها، من `app_en.arb` دون تغيير. وتتبع المفاتيح ترتيب القالب، بينما تُستبعد الرسالة التي لم تُترجم بعد، ليعود Flutter تلقائياً إلى الرسالة الإنجليزية البديلة.

تُرسل الأوصاف الموجودة في البيانات الوصفية للقالب إلى النموذج كسياق:

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

تتم حماية صياغة `{count, plural, …}`، والعنصر النائب `{count}` والمحددات: حيث تُرفض أي ترجمة تغيرها وتتم إعادة المحاولة (راجع [رسائل ICU](/docs/getting-started/configuration#icu)). قد تضيف الفرنسية فرع `many` والبولندية `few` و`many`. كما يتحقق `champollion verify` أيضاً من `@@locale` والبيانات الوصفية للعناصر النائبة في كل ملف هدف. وإذا كانت أداة سابقة قد ترجمتها، فإن `champollion sync --pair en:fr --force` يعيد كتابة الملف. وتُسترجع الرسائل غير المتغيرة من الذاكرة المؤقتة دون أي تكلفة.

### اللغات خارج قائمة Flutter الخاصة {#flutter-locales-outside-flutters-own-list}

تأتي رسائلك من ملفات `.arb`. أما النصوص الموجودة داخل عناصر واجهة مستخدم Flutter نفسها — مثل منتقي التاريخ، و"رجوع"، و"إلغاء"، واتجاه النص — فتأتي من `flutter_localizations` (`GlobalMaterialLocalizations`، `GlobalCupertinoLocalizations`)، والتي تغطي قائمة محددة من اللغات ([قائمة Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). ولا تشتمل هذه القائمة على رموز الاستخدام الخاص مثل `qaa` ومعظم اللغات منخفضة الموارد. وإذا وُجدت مثل هذه اللغة في `supportedLocales`، يفشل التطبيق أثناء وقت التشغيل ("No MaterialLocalizations found") ما لم يوفّر وكيل مفوض تلك النصوص. يوضح أمر `init`، وأي عملية مزامنة تُنشئ ملف `.arb` جديداً، هذا الأمر لكل لغة هدف خارج القائمة: إذ يقرؤون ذلك من Flutter SDK الموجود على الجهاز (`FLUTTER_ROOT`، أو `flutter` في `PATH`)، وفي حال عدم توفره، يذكرون اللغات المستهدفة التي تعذر التحقق منها.

أبسط حل هو استعارة نصوص لغة يدعمها Flutter لتلك العناصر (الإنجليزية هنا):

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

أدرجه بعد وكلاء Flutter الخاصين:

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

عندئذٍ ستعرض عناصر الواجهة تسميات بالإنجليزية داخل تطبيق تكون نصوصه الخاصة بلغتك أنت. ولترجمة نصوص عناصر الواجهة أيضاً، يوضح دليل Flutter فئة `MaterialLocalizations` كاملة لإضافة لغة جديدة: [إضافة دعم للغة جديدة](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django وgettext (.po)

واجهة سطر الأوامر الخاصة بـ champollion متوفرة المصدر بموجب ترخيص [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): مجانية للاستخدام والتعديل والمشاركة للأغراض غير التجارية. ولا يغطي هذا الترخيص استخدامها لأغراض تجارية ([من يحق له استخدام هذا](/docs/getting-started/who-may-use-this)).

### بنية المشروع

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### الإعدادات: LOCALE_PATHS وLANGUAGES {#django-locale-paths}

يبحث Django عن فهارس الترجمة في المجلدات التي تسردها `LOCALE_PATHS` وفي مجلد `locale/` التابع لكل تطبيق مثبت. ولا ينتمي مجلد `locale/` المجاور لـ `manage.py` إلى أي تطبيق، لذا حتى يتم تحديده بالاسم في `LOCALE_PATHS`، يواصل `compilemessages` بناء ملفات `.mo` الخاصة به لكن الموقع يظل يعرض النص غير المترجم. وتمثل `LANGUAGES` قائمة اللغات التي يقدمها الموقع؛ والافتراضي في Django هو كل لغة تأتي مدمجة معه، لذا حدد لغاتك الخاصة:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### الإعداد

أنشئ الفهارس أو قم بتحديثها باستخدام Django أولاً. فهرس اللغة الإنجليزية هو المصدر. وحقول `msgstr` الفارغة فيه تعني أن "msgid هو النص نفسه":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

يعثر `init` على `manage.py` و`locale/en/LC_MESSAGES/django.po` ويكتب:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

يمثل `{ns}` نطاق gettext، وبذلك تتم مزامنة كل من `django.po` و`djangojs.po`.

**الإعدادات الافتراضية هي نبرة الخطاب وأسلوب التذكير والتأنيث؛ ويطبع `init` كليهما.** يطلب `formal-vous` من النموذج "فرنسية رسمية. استخدام صيغة vous (vouvoiement) باستمرار. أسلوب احترافي وأكاديمي." ويطلب توجيه التذكير والتأنيث في الفرنسية استخدام *الكتابة الشاملة* مع النقطة الوسطى عندما يكون جنس القارئ غير معروف (`Connecté·e`، `Utilisateur·rice·s`)؛ بينما يستخدم التوجيه الروسي (`formal-vy`) المذكر، وهو الخيار الافتراضي التقليدي. والموقع الذي يرغب في أسلوب مختلف (صفحات المرضى في عيادة طبية مثلاً) يغير ذلك في `champollion.config.json`: الأسلوب اللغوي في `languages` (`"fr": "casual-tu"`، أو بكلماتك الخاصة)، و`genderGuidance` — `false` لعدم وجود توجيه، أو بتوجيهك الخاص مثل `"Use the masculine generic."` ([إرشادات التذكير والتأنيث](/docs/getting-started/configuration#gender-guidance)). ويحصل أي إعداد معدل على مدخلات ذاكرة مؤقتة خاصة به، لذا فإن `sync --redo all` يعيد ترجمة ما كتبه الإعداد القديم.

**أي طريقة تترجم، وأي مفتاح تحتاجه.** بدون `--method`، يقوم `init` بإعداد الخيار الافتراضي، `llm`: نموذج على [OpenRouter](https://openrouter.ai)، والذي يتطلب `OPENROUTER_API_KEY` في متغيرات البيئة أو في ملف `.env` بجوار `manage.py` (يطبع `init` السطر المطلوب ضبطه في حال عدم وجوده). وعلى جهاز يشغّل خادم نماذج محلياً (Ollama أو LM Studio أو vLLM)، لا يحتاج `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` إلى أي مفتاح، ولا يغادر أي شيء الجهاز. ونظراً لأن خادم تشغيل CI لا يحتوي على خادم نماذج، يحدد CI نموذجاً مستضافاً لتشغيله (راجع [دليل CI](/docs/guides/ci-cd)). للاطلاع على كل طريقة والمفتاح الذي تتطلبه: [طرق الترجمة](/docs/guides/translation-methods).

بعد ذلك:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

تترجم المزامنة كل مدخل يحتوي على `msgstr` فارغ وكل مدخل `fuzzy`، مع إزالة علامة `fuzzy`. وتُترك المدخلات المترجمة مسبقاً كما هي بايت ببايت، إلى جانب تعليقاتها. ويُعد المدخل الذي يحتوي على `msgctxt` مفتاحاً مستقلاً ومدخلاً منفصلاً في الذاكرة المؤقتة، بحيث تُترجم كلمة "Open" كفعل و"Open" كصفة كلٌ على حدة. وتُرسل تعليقات `#.` والسياق إلى النموذج — ولرؤية الطلب بدقة دون إرساله، شغّل `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` (يظهر السياق والتعليق تحت "UI context for these keys").

**إعادة ترجمة مدخل واحد عمداً.** حدده عبر msgid الخاص به:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

يتم تقديم هذا من ذاكرة الترجمة عندما تحتوي الذاكرة المؤقتة على هذا النص بالفعل، وبالتالي تسترجع الترجمة نفسها دون أي تكلفة، وتوضح المزامنة ذلك باستخدام الأمر `--fresh`. ولا تتطلب إعادة الترجمة هذه أي نموذج: فمع `local` وإيقاف خادم النموذج، تُحذر المزامنة من أن الخادم لا يستجيب وأن هذا التشغيل لا يحتاج إليه، ثم تواصل العمل (بينما تتوقف إعادة الترجمة التي تضطر إلى إرسال شيء ما، مع ذكر اسم الخادم). لدفع تكلفة ترجمة جديدة، أضف `--fresh`. تُكتب الفاصلة داخل msgid كـ `\,`، وتمنع علامات الاقتباس الصدفة من قراءة ما تبقى. ويُسمى المدخل ذو السياق كما تطبعه التقارير، `verb␄Open`. وإذا تعذر عليك كتابة `␄`، فاكتب `\x04` بدلاً منه: `--redo 'keys:verb\x04Open'`. كلا الرسمين الإملائيين يعملان، وتعرض أوامر الإصلاح كليهما. لتحديد المدخل في نطاق واحد فقط، أضف النطاق كبادئة: `django::Welcome`. وأي اسم لا يطابق أي مدخل يُفشل عملية التشغيل (exit 1) ويسرد أقرب المدخلات، على سبيل المثال كل سياق لـ msgid `Cancel` (`button␄Cancel`، `status␄Cancel`). ولا يمر مطلقاً كإعادة تشغيل مكتملة.

يحصل الفهرس الذي يُنشئه champollion (`init --langs`، أو المزامنة للغة ليس لها فهرس بعد) على ترويسة gettext القياسية، وهي الحقول التي يكتبها `msginit`، ليقبلها `msgfmt -c`. ولا يُعاد أبداً كتابة ترويسة أي فهرس موجود مسبقاً.

**تحذيرات ترويسة `msgfmt -c` في الفهارس التي بدأها `makemessages`.** يكتب `makemessages` ترويسة قالب gettext — `Project-Id-Version: PACKAGE VERSION`، `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`، `Last-Translator: FULL NAME <EMAIL@ADDRESS>`، `Language-Team: LANGUAGE <LL@li.org>`، مع تمييزها بـ `#, fuzzy` — ويُحذر `msgfmt -c` بعد ذلك عند كل تصريف من أن كل حقل "still has the initial default value". تترك المزامنة تلك القيم كما هي (في الترويسة الموجودة، تملأ فقط العنصر النائب `Plural-Forms` أو ترميز الأحرف)، لذا قم بتصحيحها يدوياً مرة واحدة في كل فهرس: اسم مشروعك وإصداره، والتاريخ، والمترجم (أو `Automatically generated`)، والفريق (أو `none`)؛ واحذف أيضاً سطر `#, fuzzy` فوق `msgid ""`، والذي يميّز الترويسة بأنها لم تُراجع بعد. ويحتفظ `makemessages` بالقيم التي كتبتها. لا يتحقق `compilemessages` (`msgfmt --check-format`) من الترويسة، لذا لا تتسبب هذه التحذيرات في إفشاله أبداً.

**صيغ الجمع.** يصبح `msgid` + `msgid_plural` رسالة واحدة يترجمها النموذج بجميع الصيغ التي تتطلبها اللغة. وتُكتب الصيغ في `msgstr[0]`، و`msgstr[1]`، وما إلى ذلك وفقاً لترويسة `Plural-Forms` الخاصة بالفهرس. يكتبها Django نيابةً عنك. أما الفهرس الذي يفتقر إليها، فيحصل على الترويسة التي يكتبها `msginit` للغة (للفرنسية `nplurals=2; plural=(n > 1);`)، أو ترويسة مشتقة من CLDR للغات التي لا يسردها `msginit`:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

عندما تُسقط الترجمة صيغةً تستخدمها اللغة للأعداد العادية (الروسية `few` أو `many`)، تطلب المزامنة من النموذج تلك الصيغة مرة أخرى. وإذا ظلت الإجابة تفتقر إليها، تكتب المزامنة صيغة `other` مكانها، وتضع علامة على المدخل بتعليق `# champollion:` وتسميه بالأمر الذي يعيد الطلب (`--redo 'keys:django::One file' --fresh`). ينتهي كل تشغيل مزامنة بـ `2` طالما وُجد مدخل محدد بعلامة في الفهرس، وليس فقط المزامنة التي كتبته، كما يحدث مع المفتاح المحجوب. ويوضح سطر التحقق الختامي أن التشغيل غير مكتمل بدلاً من `[OK]`. اكتب الصيغ يدوياً واحذف سطر التعليق، أو اطلبها مجدداً باستخدام `--model` أقوى. وأي مزامنة بطريقة أو نموذج آخر (نموذج CI المستضاف، بعد نموذج محلي) تطلب المدخل مرة أخرى تلقائياً، ويطلب `sync --redo gaps` كل مدخل معلّم؛ وإذا كانت الإجابة تفتقر إلى الصيغ أيضاً، يظل المدخل معلّماً. في CI، يؤدي هذا إلى إفشال المهمة بعد الإيداع (راجع [دليل CI](/docs/guides/ci-cd#plural-gaps)).

**تخطيطات gettext الأخرى.**

| المشروع | التكوين | المصدر |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`، أو ملف `.pot` الوحيد في `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`، أو `messages.pot` في `translations/` أو المجلد الذي يعلوه |

يجب أن تظل عناصر `printf` النائبة (`%s`، `%(name)s`، `%d`) سليمة أثناء الترجمة، وترفض بوابة الجودة أي قيمة تفقد أياً منها. ومع ذلك، يُرجى تشغيل `msgfmt --check-format` (كما يفعل `compilemessages`) قبل إطلاق التطبيق. كما يتحقق أيضاً من أنواع العناصر النائبة، ولكن فقط في المدخلات التي تحمل علامة `#, python-format`: يُضيف `makemessages` هذه العلامة إلى المدخلات التي يستخرجها بعنصر `%` نائب، بينما قد يفتقر الفهرس الذي أُنشئ يدوياً إليها، وتمر تلك المدخلات دون فحص. يقارن `champollion verify` عناصر printf النائبة في كل مدخل (الاسم وحرف النوع) أياً كانت علاماته، وتحتفظ المزامنة بعلامات مدخل المصدر في كل مدخل تترجمه. يجب أن تكون الفهارس بترميز UTF-8. راجع [فهارس gettext](/docs/getting-started/configuration#gettext) للاطلاع على القواعد الكاملة.
