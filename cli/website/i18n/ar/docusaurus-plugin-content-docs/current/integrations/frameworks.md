# أدلة التكامل

إعداد خطوة بخطوة لأداة Champollion مع أطر العمل الشائعة.

تُشغّل الأوامر الواردة في هذه الصفحة champollion باستخدام `npx --yes champollion@0.5 <command>`: مثبتًا على إصدارات 0.5، كما هو موضح في [دليل CI](/docs/guides/ci-cd)، بحيث يعمل حاسوبك المحمول وبيئة CI الخاصة بك على نفس الإصدار ولا يغيّر أي إصدار جديد التشغيل على نحو غير متوقع. والتثبيت المحلي على مستوى المشروع هو البديل؛ ففي مشروع Node، يضيفه `npm install --save-dev champollion@0.5` إلى `package.json`، ثم يقوم `npx champollion sync` بتشغيل تلك النسخة.

---

## إعداد مفتاح API

قبل التكامل مع أي إطار عمل، ستحتاج إلى مفتاح API للترجمة. يدعم Champollion مزوّدَين اثنين:

### الخيار أ: OpenRouter (موصى به)

يوفر [OpenRouter](https://openrouter.ai) واجهة API موحدة لأكثر من 200 نموذج من نماذج LLM. تتوفر فئة مجانية.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

الأنسب لـ: المشاريع الغنية بالمحتوى، وترجمة Markdown، والمشاريع التي تتطلب حماية واعية بالمحتوى (كتل الأكواد البرمجية، والأكواد القصيرة، ومتغيرات الاستيفاء).

### الخيار ب: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

الأنسب لـ: أزواج السلاسل النصية بنظام المفتاح والقيمة ذات الحجم الكبير (194 لغة). **لا يُوصى به** لمحتوى Markdown — لا يدرك Google Translate كتل الأكواد البرمجية، أو الأكواد القصيرة، أو متغيرات الاستيفاء.

لاستخدام Google Translate صراحةً:

```bash
champollion sync --method google-translate
```

> **تلميح**: إذا تم تعيين `GOOGLE_TRANSLATE_API_KEY` فقط (بدون مفتاح OpenRouter)، يتحول champollion تلقائيًا إلى Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### بنية المشروع

يستخدم Hugo المجلد `i18n/` لترجمات النصوص و`content/` لمحتوى الصفحات:

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

**البيانات الوصفية (Front matter)**: يدعم محددات كل من YAML (`---`) وTOML (`+++`). وتتم ترجمة `title` و`description` و`summary` و`subtitle` و`caption` و`linkTitle` افتراضيًا. ويتم الحفاظ على جميع الحقول الأخرى (date وdraft وtags وweight وslug وغيرها). يمكنك التخصيص عبر `translatableFields` في ملف الإعدادات الخاص بك.

**حماية الكتل البرمجية**: يتم تلقائيًا حماية كتل الأكواد البرمجية، ورموز Hugo القصيرة (`{{< >}}`، `{{% %}}`)، والأكواد المضمنة، وHTML المباشر باستخدام عناصر نائبة حارسة من رموز Unicode. وتمر دون أن يمسها أي تغيير.

**اصطلاح تسمية الملفات**: يتبع نمط الترجمة حسب اسم الملف الخاص بـ Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (يزيل لاحقة المصدر)

**تخطي الملفات الموجودة**: لا يتم استبدال الملفات المترجمة الموجودة مسبقًا أبدًا. احذف الملف المستهدف لفرض إعادة ترجمته.

### صيغ الجمع

تدعم ملفات لغات TOML وYAML صيغ الجمع الخاصة بـ CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

تُمثَّل داخليًا كـ `items.one` و`items.other` لتحديد الفروقات (diffing)، ثم يُعاد تسلسلها إلى التنسيق المقسم الصحيح عند الكتابة.

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

شغّل `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. سيعثر على `messages/en.json`، وينشئ ملفات الهدف الفارغة ويكتب ملف تكوين مثل الموضح أدناه. أو يمكنك إنشاء `champollion.config.json` بنفسك:

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

يتم تسجيل أسلوب الخطاب (نبرته ودرجة رسميته) لكل لغة هدف في `languages`، بحيث يكون ظاهرًا وقابلًا للتعديل: يمكنك تغيير إحداها إلى إعداد مسبق آخر خاص باللغة (يعرض `champollion status` قائمة بها) أو كتابة وصفك الخاص. وتُكتب اللغة التي ليس لها إعدادات مسبقة كـ `{}`. كما تعمل القائمة البسيطة، `"languages": ["fr", "de"]`، أيضًا وتستخدم الإعداد الافتراضي لكل لغة.

```bash
npx --yes champollion@0.5 sync
```

ينشئ `messages/fr.json` و`messages/ja.json` وما إلى ذلك — مترجمة بالكامل، مع الحفاظ على بنية المفاتيح المتداخلة لديك. ويتعرف عليها next-intl تلقائيًا.

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

### مجلد لكل لغة (الإعداد الافتراضي في i18next)

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

يعثر `init` على `public/locales/en/` (أو `locales/en/`)، ويوجه ملف الإعدادات إليه، ويُنشئ `fr/common.json` و`fr/admin/users.json` والملفات الأخرى كملفات فارغة. الجزء ذو الصلة من ملف الإعدادات الذي يكتبه:

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

يُترجم كل ملف نطاق تسمية (namespace) ويُكتب إلى نفس المسار في مجلد كل لغة. وتُترجم السلسلة النصية التي تظهر في عدة نطاقات تسمية مرة واحدة لكل لغة؛ بينما تحصل بقية الملفات عليها من ذاكرة الترجمة (Translation Memory). وتحصل مفاتيح الجمع (`key_one`، `key_other`) على الصيغ الخاصة بكل لغة، والمقروءة من CLDR عبر JavaScript `Intl.PluralRules` API: فتُضاف الصيغة التي تستخدمها اللغة إذا كانت مفقودة في المصدر، وتُستبعد الصيغة التي لا تستخدمها. فمع مصدر باللغة الإنجليزية، تكتسب الإسبانية والفرنسية `key_many`، وتكتسب الروسية `key_few` و`key_many`، بينما تحتفظ اليابانية بـ `key_other` فقط. وتوضح المزامنة (Sync)، بالنسبة للغاتك الخاصة، الصيغ التي تكتسبها كل لغة منها. راجع [مفاتيح الجمع في i18next](/docs/getting-started/configuration#i18next-plurals) و[تخطيطات ملفات اللغات](/docs/getting-started/configuration#locale-layouts).

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

إذا كانت ملفاتك تتبع نمطًا آخر، فصفه باستخدام `localesPattern` (حيث يمثل `{lang}` اللغة، و`{ns}` نطاق التسمية):

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

يقرأ `flutter gen-l10n` ملف `.arb` واحدًا لكل لغة. والملف الإنجليزي هو القالب:

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

يقرأ `init` كلاً من `pubspec.yaml` و`l10n.yaml` (`arb-dir`، `template-arb-file`)، ويأخذ لغة المصدر من اسم القالب (`app_en.arb` ← `en`)، وينشئ `app_fr.arb` و`app_de.arb` و`app_pt_BR.arb` مع `@@locale` الخاصة بها. والتكوين الذي يكتبه هو:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

إذا عيّن `l10n.yaml` كلاً من `arb-dir: assets/i18n` و`template-arb-file: intl_en.arb`، فسيكون النمط هو `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

تُترجم الرسائل فقط. ويحصل كل هدف على `"@@locale"` معيّنة حسب لغته الخاصة (locale)، ومكتوبة بنفس الطريقة المكتوبة بها في اسم الملف (`"pt_BR"`)، لأن `gen-l10n` يرفض أي ملف لا تتطابق فيه `@@locale` مع اسمه. ويتم نسخ كل كائن بيانات وصفية `@key`، مثل العناصر النائبة وأنواعها، من `app_en.arb` دون تغيير. وتتبع المفاتيح ترتيب القالب، وتُستبعد أي رسالة لم تُترجم بعد، بحيث يلجأ Flutter إلى النسخة الإنجليزية كبديل احتياطي (fallback).

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

تتم حماية بنية `{count, plural, …}` والعنصر النائب `{count}` والمحددات (selectors): حيث تُرفض أي ترجمة تغيّرها وتتم إعادة محاولتها (راجع [رسائل ICU](/docs/getting-started/configuration#icu)). قد تضيف الفرنسية فرع `many` وتضيف البولندية `few` و`many`. كما يتحقق `champollion verify` من `@@locale` والبيانات الوصفية للعناصر النائبة في كل ملف هدف. وإذا كانت أداة سابقة قد ترجمتها، فإن `champollion sync --pair en:fr --force` يعيد كتابة الملف. أما الرسائل التي لم تتغير فتُسترد من التخزين المؤقت دون أي تكلفة.

### اللغات خارج قائمة Flutter الخاصة {#flutter-locales-outside-flutters-own-list}

تأتي رسائلك من ملفات `.arb`. أما النصوص الموجودة داخل عناصر واجهة المستخدم الخاصة بـ Flutter نفسها (widgets) — كمنتقي التاريخ، و"Back"، و"Cancel"، واتجاه النص — فتأتي من `flutter_localizations` (`GlobalMaterialLocalizations`، `GlobalCupertinoLocalizations`)، والتي تغطي قائمة محددة من اللغات ([قائمة Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). ولا تشتمل هذه القائمة على رموز الاستخدام الخاص مثل `qaa`، ومعظم اللغات منخفضة الموارد. وإذا وُجدت مثل هذه اللغة في `supportedLocales`، يفشل التطبيق أثناء التشغيل ("No MaterialLocalizations found") ما لم يوفّر مفوَّض (delegate) ذلك النص. وينبّه `init`، وأي عملية مزامنة تُنشئ ملف `.arb` جديدًا، إلى ذلك لكل لغة هدف خارج القائمة: إذ يقرؤونها من Flutter SDK على الجهاز (`FLUTTER_ROOT`، أو `flutter` في `PATH`)، وفي حال عدم توفره، يبيّنون الأهداف التي لم يتمكنوا من التحقق منها.

أبسط حل هو إعارة تلك العناصر نصًا من لغة يغطيها Flutter (الإنجليزية هنا):

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

أدرجه بعد مفوّضي Flutter الأصليين:

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

تعرض عناصر الواجهة بعد ذلك تسميات باللغة الإنجليزية داخل تطبيق نصوصه الخاصة بلغتك. ولترجمة نصوص عناصر الواجهة أيضًا، يوضح دليل Flutter نموذج `MaterialLocalizations` كاملًا للغة جديدة: [إضافة دعم للغة جديدة](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django وgettext (.po)

تتوفر واجهة سطر أوامر champollion كمصدر متاح بموجب [ترخيص PolyForm غير التجاري 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): وهو مجاني للاستخدام والتعديل والمشاركة للأغراض غير التجارية. ولا يغطي هذا الترخيص استخدامها لأغراض تجارية ([من يحق له استخدام هذا](/docs/getting-started/who-may-use-this)).

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

يبحث Django عن فهارس الترجمة في المجلدات التي يسردها `LOCALE_PATHS` وفي مجلد `locale/` الخاص بكل تطبيق مثبت. والمجلد `locale/` المجاور لـ `manage.py` لا يتبع لأي تطبيق، لذا حتى يقوم `LOCALE_PATHS` بتحديده، يستمر `compilemessages` في بناء ملفات `.mo` الخاصة به ولكن الموقع يستمر في عرض النص غير المترجم. ويحدد `LANGUAGES` قائمة اللغات التي يقدمها الموقع؛ والافتراضي في Django هو تضمين كل لغة يأتي معها، لذا حدد لغاتك الخاصة:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### الإعداد

أنشئ فهارس الترجمة أو حدّثها باستخدام Django أولاً. الفهرس الإنجليزي هو المصدر؛ وتعني قيم `msgstr` الفارغة فيه أن "msgid هو النص نفسه":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
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

`{ns}` هو نطاق gettext، ولذا تتم مزامنة كلٍّ من `django.po` و`djangojs.po`.

**الإعدادات الافتراضية هي نبرة الصوت وأسلوب التذكير والتأنيث؛ ويطبع `init` كلاهما.** يطلب `formal-vous` من النموذج: "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." وتطلب إرشادات الجنس في الفرنسية استخدام *الكتابة الشاملة* (*écriture inclusive*) بنقطة التوسيط عند عدم معرفة جنس القارئ (`Connecté·e`، `Utilisateur·rice·s`)؛ بينما تستخدم الإرشادات الخاصة بالروسية (`formal-vy`) صيغة المذكر، وهو الخيار التقليدي الافتراضي. وإذا كان الموقع يتطلب أسلوبًا مختلفًا (صفحات المرضى في عيادة، على سبيل المثال) فيمكن تغييره في `champollion.config.json`: مستوى الخطاب (register) في `languages` (`"fr": "casual-tu"`، أو بكلماتك الخاصة)، و`genderGuidance` — `false` لعدم تقديم أي تعليمات، أو إرشاداتك الخاصة مثل `"Use the masculine generic."` ([إرشادات الجنس](/docs/getting-started/configuration#gender-guidance)). وأي تغيير في الإعدادات يحصل على مدخلات تخزين مؤقت خاصة به، لذا فإن `sync --redo all` يعيد ترجمة ما كتبه الإعداد القديم.

**طريقة الترجمة والمفتاح الذي تتطلبه.** بدون `--method`، يُعدّ `init` الخيار الافتراضي، `llm`: وهو نموذج على [OpenRouter](https://openrouter.ai)، ويتطلب وجود `OPENROUTER_API_KEY` في متغيرات البيئة أو في ملف `.env` بجوار `manage.py` (يطبع `init` السطر المطلوب تعيينه عند فقده). وعلى جهاز يشغّل خادم نماذج محليًا (Ollama، LM Studio، vLLM)، لا يتطلب `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` أي مفتاح، ولا يغادر أي شيء الجهاز. ونظرًا لأن بيئة تشغيل CI لا تحتوي على خادم نماذج، فإن بيئة CI تحدد نموذجًا مستضافًا لتشغيلها (راجع [دليل CI](/docs/guides/ci-cd)). لمعرفة كل طريقة والمفتاح الذي تحتاجه: [طرق الترجمة](/docs/guides/translation-methods).

بعد ذلك:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

تترجم المزامنة كل مدخل يحتوي على `msgstr` فارغة وكل مدخل `fuzzy`، مع إزالة علامة `fuzzy`. أما المدخلات المترجمة بالفعل فتُترك كما هي بايتًا ببايت مع تعليقاتها. ويُعد المدخل الذي يحتوي على `msgctxt` مفتاحًا مستقلاً ومدخلاً منفصلاً في التخزين المؤقت، بحيث تُترجم كلمة "Open" كفعل و"Open" كصفة بشكل منفصل. وتُرسل تعليقات `#.` والسياق إلى النموذج — ولرؤية الطلب الفعلي بدقة دون إرساله، شغّل `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (يظهر السياق والتعليق تحت "UI context for these keys").

**إعادة ترجمة مدخل واحد عمدًا.** حدده عبر قيمة msgid الخاصة به:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

يتم جلب هذا من ذاكرة الترجمة (Translation Memory) عندما يحتوي التخزين المؤقت على ذلك النص بالفعل، وبذلك تسترجع الترجمة نفسها دون أي تكلفة، وتوضح عملية المزامنة ذلك عبر أمر `--fresh`. ولا تحتاج عملية الإعادة هذه إلى نموذج: فمع `local` وتوقف خادم النماذج، تحذر المزامنة من أن الخادم لا يستجيب وأن هذا التشغيل لا يحتاج إليه، ثم تواصل عملها (أما الإعادة التي يلزمها إرسال بيانات فتتوقف مع ذكر اسم الخادم). لدفع تكلفة ترجمة جديدة، أضف `--fresh`. تُكتب الفاصلة داخل msgid كـ `\,`، وتمنع علامات الاقتباس سطر الأوامر (shell) من قراءة الباقي. ويُسمى المدخل ذو السياق كما تطبعه التقارير: `verb␄Open`. وإذا تعذر عليك كتابة `␄`، فاكتب `\x04` بدلاً منها: `--redo 'keys:verb\x04Open'`. كلا الرسمين صحيح، وتُظهرهما أوامر الإصلاح. ولتحديد المدخل في نطاق واحد فقط، أضف النطاق كبادئة: `django::Welcome`. وإذا لم يتطابق الاسم مع أي مدخل، تفشل عملية التشغيل (exit 1) وتُسرد أقرب المدخلات، مثل كل سياق لـ msgid `Cancel` (`button␄Cancel`، `status␄Cancel`)؛ ولا يتم تمريرها أبدًا كعملية إعادة مكتملة.

يحصل الفهرس الذي ينشئه champollion (سواء `init --langs`، أو عبر المزامنة للغة لا تملك فهرسًا بعد) على ترويسة gettext القياسية والحقول التي يكتبها `msginit`، مما يجعله مقبولاً لدى `msgfmt -c`. ولا يُعاد كتابة ترويسة أي فهرس موجود مسبقًا.

**تحذيرات ترويسة `msgfmt -c` في الفهارس التي بدأها `makemessages`.** يكتب `makemessages` ترويسة قالب gettext — `Project-Id-Version: PACKAGE VERSION`، `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`، `Last-Translator: FULL NAME <EMAIL@ADDRESS>`، `Language-Team: LANGUAGE <LL@li.org>`، مع تعليمها بـ `#, fuzzy` — ثم يُصدر `msgfmt -c` تحذيرًا عند كل تجميع يفيد بأن كل حقل "ما يزال يحتوي على القيمة الافتراضية الأولية". وتترك المزامنة تلك القيم وشأنها (فهي تملأ فقط في الترويسة الموجودة العنصر النائب `Plural-Forms` أو ترميز المحارف)، لذا قم بتصحيحها يدويًا لمرة واحدة في كل فهرس: اسم مشروعك وإصداره، والتاريخ، والمترجم (أو `Automatically generated`)، وفريق العمل (أو `none`)؛ واحذف أيضًا سطر `#, fuzzy` فوق `msgid ""`، والذي يميّز الترويسة بأنها لم تُراجع بعد. ويحتفظ `makemessages` بالقيم التي تكتبها. ولا يتحقق `compilemessages` (`msgfmt --check-format`) من الترويسة، ولذا لا تتسبب هذه التحذيرات في فشله أبدًا.

**صيغ الجمع.** يصبح `msgid` + `msgid_plural` رسالة واحدة يترجمها النموذج بجميع الصيغ التي تحتاج إليها اللغة. وتُكتب الصيغ في `msgstr[0]`، و`msgstr[1]`، وما يليها... وفقًا لترويسة `Plural-Forms` في الفهرس. ويكتبها Django نيابةً عنك. أما الفهرس الذي يفتقر إليها فيحصل على الترويسة التي يكتبها `msginit` لتلك اللغة (مثل الفرنسية `nplurals=2; plural=(n > 1);`)، أو ترويسة مشتقة من CLDR للغات التي لا يسردها `msginit`:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

عندما تُسقط الترجمة صيغةً تستخدمها اللغة للأعداد المعتادة (مثل الروسية `few` أو `many`)، تطلب المزامنة من النموذج تزويدها بها مجددًا. وإذا ظلت الإجابة تفتقر إليها، تكتب المزامنة صيغة `other` في مكانها، وتميّز المدخل بتعليق `# champollion:` وتحدده مع الأمر الذي يعيد طلبه (`--redo 'keys:django::One file' --fresh`). وتخرج كل عملية مزامنة برمز `2` طالما وُجد مدخل معلّم في الفهرس، وليس فقط المزامنة التي كتبته، كما يحدث مع المفاتيح المحجوبة. ويشير سطر التحقق الختامي إلى أن التشغيل غير مكتمل بدلاً من `[OK]`. يمكنك كتابة الصيغ يدويًا وحذف سطر التعليق، أو إعادة الطلب باستخدام `--model` أقوى. وتقوم أي مزامنة بطريقة أو نموذج آخر (كالنموذج المستضاف في CI بعد نموذج محلي) بطلب المدخل مجددًا تلقائيًا، كما يطلب `sync --redo gaps` كل مدخل معلّم؛ وإذا كانت الإجابة تفتقر إلى الصيغ أيضًا، يظل المدخل معلّمًا. وفي بيئة CI، يؤدي هذا إلى فشل المهمة بعد الإيداع (commit) (راجع [دليل CI](/docs/guides/ci-cd#plural-gaps)).

**تخطيطات gettext الأخرى.**

| المشروع | التكوين | المصدر |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`، أو الملف `.pot` الوحيد في `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`، أو `messages.pot` في `translations/` أو المجلد الذي يعلوه |

يجب أن تظل عناصر `printf` النائبة (`%s`، `%(name)s`، `%d`) سليمة بعد الترجمة، وترفض بوابة الجودة (quality gate) أي قيمة تفقد أحدها. ومع ذلك، احرص على تشغيل `msgfmt --check-format` (كما يفعل `compilemessages`) قبل النشر. كما يتحقق أيضًا من أنواع العناصر النائبة، ولكن فقط في المدخلات التي تحمل علامة `#, python-format`: حيث يضيف `makemessages` العلامة إلى المدخلات التي يستخرجها بعنصر `%` نائب، بينما قد يفتقر الفهرس المنشأ يدويًا إليها، مما يترك تلك المدخلات دون فحص. ويقارن `champollion verify` عناصر printf النائبة لكل مدخل (الاسم وحرف النوع) بغض النظر عن علاماته، وتحافظ المزامنة على علامات مدخل المصدر في كل مدخل تترجمه. ويجب أن تكون الفهارس بترميز UTF-8. راجع [فهارس gettext](/docs/getting-started/configuration#gettext) للاطلاع على القواعد الكاملة.
