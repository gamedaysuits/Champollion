# 통합 가이드

주요 프레임워크와 함께 champollion을 설정하는 단계별 가이드예요.

이 페이지의 명령어들은 [CI 가이드](/docs/guides/ci-cd)에서처럼 0.6 계열로 고정된 `npx --yes champollion@0.6 <command>` 버전의 champollion을 실행해요. 이렇게 하면 개발용 노트북과 CI 환경에서 같은 버전이 실행되어, 새 릴리스로 인해 예기치 않게 동작이 바뀌는 일이 없어요. 프로젝트 로컬에 설치하는 대안도 있어요. Node 프로젝트에서는 `npm install --save-dev champollion@0.6` 명령어로 `package.json`에 추가하고, `npx champollion sync` 명령어로 해당 버전을 실행해요.

---

## API 키 설정

프레임워크와 연동하기 전에 번역 API 키가 필요해요. Champollion은 두 가지 제공업체를 지원해요:

### 옵션 A: OpenRouter (권장)

[OpenRouter](https://openrouter.ai)는 200개 이상의 LLM 모델을 위한 단일 API를 제공해요. 무료 티어도 이용할 수 있어요.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

추천 용도: 콘텐츠가 많은 프로젝트, Markdown 번역, 콘텐츠 인식 보호(코드 블록, 숏코드, 보간 변수)가 필요한 프로젝트.

### 옵션 B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

추천 용도: 대량의 키-값 문자열 쌍(194개 언어). Markdown 콘텐츠에는 **권장하지 않아요** — Google Translate는 코드 블록, 숏코드, 보간 변수를 인식하지 못해요.

Google Translate를 직접 지정해 사용하려면:

```bash
champollion sync --method google-translate
```

> **팁**: `GOOGLE_TRANSLATE_API_KEY`만 설정되어 있다면(OpenRouter 키가 없는 경우), champollion이 자동으로 Google Translate로 전환해요.

---

## Hugo (TOML / YAML / Markdown)

### 프로젝트 구조

Hugo는 문자열 번역에 `i18n/`를, 페이지 콘텐츠에 `content/`을 사용해요:

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

### 설정

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

`champollion.config.json` 파일을 만드세요:

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

### 콘텐츠 번역 세부 사항

**프론트 매터(Front matter)**: YAML(`---`) 및 TOML(`+++`) 구분자를 모두 지원해요. 기본적으로 `title`, `description`, `summary`, `subtitle`, `caption`, `linkTitle`를 번역해요. 다른 모든 필드(date, draft, tags, weight, slug 등)는 유지돼요. 설정 파일에서 `translatableFields`로 원하는 대로 조정할 수 있어요.

**블록 보호**: 코드 블록, Hugo 숏코드(`{{< >}}`, `{{% %}}`), 인라인 코드, 순수 HTML은 유니코드 센티널 플레이스홀더를 사용해 자동으로 보호돼요. 이 요소들은 전혀 수정되지 않고 그대로 유지돼요.

**파일명 규칙**: Hugo의 파일명 기반 번역 패턴을 따라요:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (소스 접미사 제거)

**기존 파일 건너뛰기**: 이미 번역된 파일은 절대 덮어쓰지 않아요. 강제로 다시 번역하려면 대상 파일을 삭제하세요.

### 복수형

TOML 및 YAML 로캘은 CLDR 복수형을 지원해요:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

변경 사항 비교(diffing)를 위해 내부적으로 `items.one` 및 `items.other`로 표현된 뒤, 파일에 쓸 때 알맞은 섹션 형식으로 다시 직렬화돼요.

---

## next-intl (JSON)

### 프로젝트 구조

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

### 설정

```bash
npm install --save-dev champollion
```

`npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`를 실행하세요. `messages/en.json`를 찾아서 빈 대상 파일들을 만들고 아래와 같은 설정 파일을 작성해 줘요. 또는 `champollion.config.json`를 직접 만들어도 돼요:

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

각 대상 언어의 사용역(register, 어조와 격식)이 `languages`에 기록되므로, 직접 확인하고 수정할 수 있어요. 해당 언어의 다른 프리셋(`champollion status` 명령어로 확인 가능)이나 여러분만의 설명으로 변경해 보세요. 프리셋이 없는 언어는 `{}`로 기록돼요. 단순 목록 형태인 `"languages": ["fr", "de"]`도 작동하며 각 언어의 기본값을 사용해요.

```bash
npx --yes champollion@0.6 sync
```

`messages/fr.json`, `messages/ja.json` 등이 완전히 번역되어 생성되며, 중첩된 키 구조도 그대로 유지돼요. next-intl이 이를 자동으로 인식해요.

### 개발 워크플로

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

### 언어별 폴더 (i18next 기본값)

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

`init` 명령어가 `public/locales/en/`(또는 `locales/en/`)를 찾아 설정 파일에 지정하고, `fr/common.json`, `fr/admin/users.json` 등을 빈 파일로 생성해요. 작성되는 설정의 관련 부분은 다음과 같아요:

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

각 네임스페이스 파일은 번역되어 모든 언어 폴더의 동일한 경로에 작성돼요. 여러 네임스페이스에 나타나는 문자열은 언어별로 한 번만 번역되며, 다른 파일들은 번역 메모리(Translation Memory)에서 가져와요. 복수형 키(`key_one`, `key_other`)는 JavaScript `Intl.PluralRules` API를 통해 CLDR에서 읽어온 각 언어 고유의 형태를 갖게 돼요. 원본에는 없지만 해당 언어에서 사용하는 형태는 추가되고, 사용하지 않는 형태는 제외돼요. 영어 원본 기준으로 스페인어와 프랑스어는 `key_many`이 추가되고, 러시아어는 `key_few`과 `key_many`이 추가되며, 일본어는 `key_other`만 유지돼요. 동기화 시 설정한 각 언어별로 어떤 형태가 추가되었는지 알려줘요. [i18next 복수형 키](/docs/getting-started/configuration#i18next-plurals) 및 [로캘 파일 레이아웃](/docs/getting-started/configuration#locale-layouts)을 참고하세요.

### 언어별 단일 파일

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

### 기타 레이아웃

파일들이 다른 패턴을 따른다면 `localesPattern`로 패턴을 지정하세요(`{lang}`는 언어, `{ns}`는 네임스페이스예요):

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

### 프로젝트 구조

`flutter gen-l10n`는 언어별로 하나의 `.arb` 파일을 읽어요. 영어 파일이 템플릿 역할을 해요:

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

### 설정

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init`는 `pubspec.yaml`와 `l10n.yaml`(`arb-dir`, `template-arb-file`)을 읽고, 템플릿 이름에서 소스 언어를 가져와(`app_en.arb` → `en`), `app_fr.arb`, `app_de.arb`, `app_pt_BR.arb`을 해당 `@@locale`와 함께 생성해요. 작성되는 설정은 다음과 같아요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

`l10n.yaml`에 `arb-dir: assets/i18n`과 `template-arb-file: intl_en.arb`이 설정되어 있으면, 패턴은 `"assets/i18n/intl_{lang}.arb"`가 돼요.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

메시지만 번역돼요. `gen-l10n`는 파일 이름과 `@@locale`가 일치하지 않는 파일을 거부하기 때문에, 각 대상 파일의 `"@@locale"`는 파일 이름에 쓰인 방식(`"pt_BR"`) 그대로 해당 로캘로 설정돼요. 플레이스홀더 및 그 타입과 같은 모든 `@key` 메타데이터 객체는 `app_en.arb`에서 수정 없이 그대로 복사돼요. 키는 템플릿의 순서를 따르며, 아직 번역되지 않은 메시지는 제외되어 Flutter가 영어 메시지로 대체(폴백)하게 돼요.

템플릿 메타데이터의 설명(description)은 모델에 문맥으로 전달돼요:

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

`{count, plural, …}` 구문, `{count}` 플레이스홀더 및 선택자(selector)는 보호돼요. 이를 변경하는 번역은 거부되고 재시도돼요([ICU 메시지](/docs/getting-started/configuration#icu) 참고). 프랑스어는 `many` 분기를 추가할 수 있고, 폴란드어는 `few`과 `many`을 추가할 수 있어요. `champollion verify`는 모든 대상 파일의 `@@locale` 및 플레이스홀더 메타데이터도 검사해요. 이전 도구가 이들을 번역해 두었다면 `champollion sync --pair en:fr --force`가 파일을 다시 작성해요. 변경되지 않은 메시지는 비용 없이 캐시에서 가져와요.

### Flutter 자체 목록에 없는 로캘 {#flutter-locales-outside-flutters-own-list}

여러분의 메시지는 `.arb` 파일에서 가져와요. 날짜 선택기, "Back", "Cancel", 텍스트 방향 등 Flutter 자체 위젯 내부의 텍스트는 정해진 언어 목록을 지원하는 `flutter_localizations`(`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`)에서 가져와요([Flutter 목록](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). `qaa`과 같은 사용자 정의(private-use) 코드나 대부분의 저자원 언어는 이 목록에 없어요. 대리자(delegate)가 해당 텍스트를 제공하지 않으면 `supportedLocales`에 이러한 로캘이 있을 때 런타임에 앱 오류("No MaterialLocalizations found")가 발생해요. `init` 및 새 `.arb` 파일을 생성하는 동기화 작업은 목록에 없는 각 대상 언어에 대해 이를 알려줘요. 머신에 있는 Flutter SDK(`FLUTTER_ROOT` 또는 `PATH`의 `flutter`)에서 확인하며, SDK가 없으면 확인할 수 없었던 대상을 알려줘요.

가장 간단한 해결 방법은 해당 위젯들에 Flutter가 지원하는 언어(여기서는 영어)의 텍스트를 빌려 쓰는 거예요:

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

Flutter 자체 델리게이트 뒤에 나열하세요:

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

그러면 앱 자체의 텍스트가 여러분의 언어로 표시되는 동안 위젯은 영어 라벨을 보여주게 돼요. 위젯의 텍스트까지 번역하려면 Flutter 가이드에서 새 언어를 위한 전체 `MaterialLocalizations` 작성법을 확인하세요: [새 언어 지원 추가하기](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django 및 gettext (.po)

champollion CLI는 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)에 따라 소스가 제공(source-available)돼요. 비상업적 용도로는 자유롭게 사용, 수정, 공유할 수 있어요. 상업적 용도로 사용하는 것은 이 라이선스에서 허용되지 않아요([이용 대상 안내](/docs/getting-started/who-may-use-this)).

### 프로젝트 구조

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### 설정: LOCALE_PATHS 및 LANGUAGES {#django-locale-paths}

Django는 `LOCALE_PATHS`에 나열된 폴더와 각 설치된 앱의 `locale/` 폴더에서 카탈로그를 찾아요. `manage.py` 옆에 있는 `locale/` 폴더는 어떤 앱에도 속하지 않으므로, `LOCALE_PATHS`에 지정하기 전까지는 `compilemessages`가 `.mo` 파일을 빌드하더라도 사이트에는 계속 번역되지 않은 텍스트가 표시돼요. `LANGUAGES`는 사이트에서 제공하는 언어 목록이에요. Django의 기본값은 기본 제공되는 모든 언어이므로, 직접 지원할 언어들을 나열해 주세요:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### 설정

먼저 Django로 카탈로그를 생성하거나 새로고침하세요. 영어 카탈로그가 소스 역할을 해요. 비어 있는 `msgstr`는 "msgid가 곧 텍스트"임을 의미해요:

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init`는 `manage.py` 및 `locale/en/LC_MESSAGES/django.po`를 찾아서 다음과 같이 작성해요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}`는 gettext 도메인이므로, `django.po`와 `djangojs.po`가 모두 동기화돼요.

**기본값은 어조와 성별 스타일이며, `init`가 둘 다 출력해요.** `formal-vous`는 모델에 "격식 있는 프랑스어. 일관되게 존칭 vous형(vouvoiement) 사용. 전문적이고 학술적인 사용역."을 요청해요. 프랑스어 성별 지침은 독자의 성별을 알 수 없을 때 가운뎃점(middle dot)을 사용하는 *포용적 글쓰기(écriture inclusive)*를 요청해요(`Connecté·e`, `Utilisateur·rice·s`). 러시아어(`formal-vy`)는 관례적 기본값인 남성형을 사용해요. 다른 스타일을 원하는 사이트(예: 병원의 환자용 페이지)는 `champollion.config.json`에서 이를 변경할 수 있어요: `languages`의 사용역(`"fr": "casual-tu"` 또는 직접 작성한 문구)과 `genderGuidance`(지침을 주지 않으려면 `false`, 또는 `"Use the masculine generic."`처럼 직접 작성)을 설정하세요([성별 지침](/docs/getting-started/configuration#gender-guidance) 참고). 변경된 설정은 자체 캐시 항목을 가지므로, `sync --redo all` 실행 시 이전 설정으로 작성된 내용을 다시 번역해요.

**번역 방식과 필요한 키.** `--method`가 없으면 `init`는 기본값인 `llm`를 설정해요. 이는 [OpenRouter](https://openrouter.ai)의 모델이며, 환경 변수나 `manage.py` 옆의 `.env` 파일에 `OPENROUTER_API_KEY`가 필요해요(키가 없을 경우 `init`가 설정해야 할 항목을 출력해요). 모델 서버(Ollama, LM Studio, vLLM)를 실행하는 머신에서는 `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1`에 키가 필요 없으며, 외부로 데이터가 전송되지 않아요. CI 러너에는 모델 서버가 없으므로 CI 실행 시 호스팅된 모델을 지정해요([CI 가이드](/docs/guides/ci-cd) 참고). 모든 번역 방식과 각각 필요한 키는 [번역 방식](/docs/guides/translation-methods)을 참고하세요.

그런 다음:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

동기화(sync)는 비어 있는 `msgstr` 항목과 모든 `fuzzy` 항목을 번역하고 `fuzzy` 플래그를 제거해요. 이미 번역된 항목은 주석과 함께 바이트 단위까지 그대로 유지돼요. `msgctxt`가 있는 항목은 고유한 키와 캐시 항목을 가지므로, 동사 "Open"과 형용사 "Open"은 별도로 번역돼요. `#.` 주석과 문맥 정보가 모델에 전송돼요. 실제로 요청을 보내지 않고 정확한 요청 내용을 확인하려면 `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'`를 실행하세요(문맥과 주석이 "UI context for these keys" 아래에 표시돼요).

**특정 항목만 의도적으로 다시 번역하기.** msgid로 항목을 지정하세요:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

캐시에 이미 해당 텍스트가 있으면 번역 메모리에서 가져오므로 비용 없이 동일한 번역을 다시 얻을 수 있고, 동기화 시 `--fresh` 명령어로 이를 안내해요. 이러한 재작업에는 모델이 필요 없어요. `local`를 사용 중이고 모델 서버가 중지되어 있어도, 동기화 프로세스는 서버가 응답하지 않지만 이번 실행에는 서버가 필요 없다는 경고를 띄우고 계속 진행해요(실제로 무언가를 전송해야 하는 재작업은 서버 이름을 표시하며 중단돼요). 새로 비용을 들여 번역하려면 `--fresh`를 추가하세요. msgid 내부의 쉼표는 `\,`로 표기하며, 따옴표를 쓰면 셸이 나머지 부분을 잘못 해석하지 않아요. 문맥(context)이 있는 항목은 리포트에 출력되는 방식대로 `verb␄Open`와 같이 지정해요. `␄`를 입력하기 어렵다면 대신 `\x04`를 사용해 `--redo 'keys:verb\x04Open'`로 작성하세요. 두 표기법 모두 동작하며 복구 명령어에도 둘 다 표시돼요. 특정 도메인의 항목만 지정하려면 도메인을 접두사로 붙이세요: `django::Welcome`. 일치하는 항목이 없으면 실행에 실패하고(exit 1), 가장 유사한 항목 목록(예: msgid `Cancel`의 모든 문맥인 `button␄Cancel`, `status␄Cancel`)을 보여줘요. 완료된 재작업으로 그냥 넘어가지 않아요.

champollion이 생성하는 카탈로그(`init --langs` 또는 아직 카탈로그가 없는 언어에 대한 동기화)는 `msginit`가 작성하는 필드인 표준 gettext 헤더를 포함하므로 `msgfmt -c`가 정상적으로 인식해요. 기존 카탈로그의 헤더는 절대 덮어쓰지 않아요.

**`makemessages`로 시작한 카탈로그의 `msgfmt -c` 헤더 경고.** `makemessages`는 gettext의 템플릿 헤더(`#, fuzzy` 플래그가 붙은 `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`)를 작성하며, `msgfmt -c`는 컴파일할 때마다 각 필드가 "still has the initial default value(여전히 초기 기본값을 가지고 있음)"라는 경고를 표시해요. 동기화는 이 값들을 건드리지 않으므로(기존 헤더에서는 플레이스홀더 `Plural-Forms`나 charset만 채워요), 각 카탈로그에서 한 번씩 직접 수정해 주세요. 프로젝트 이름과 버전, 날짜, 번역자(또는 `Automatically generated`), 팀(또는 `none`)을 입력하고, 헤더가 아직 검토되지 않았음을 나타내는 `msgid ""` 위의 `#, fuzzy` 줄도 삭제하세요. `makemessages`는 여러분이 작성한 값을 유지해요. `compilemessages`(`msgfmt --check-format`)는 헤더를 검사하지 않으므로 이 경고로 인해 검사가 실패하지 않아요.

**복수형.** `msgid`와 `msgid_plural`는 해당 언어에 필요한 모든 형태를 포함해 모델이 번역하는 하나의 메시지가 돼요. 이 형태들은 카탈로그의 `Plural-Forms` 헤더에 따라 `msgstr[0]`, `msgstr[1]`, …에 작성돼요. Django가 이 헤더를 대신 작성해 줘요. 헤더가 없는 카탈로그는 해당 언어에 대해 `msginit`가 작성하는 헤더(프랑스어 `nplurals=2; plural=(n > 1);`)를 받거나, `msginit`에 나열되지 않은 언어의 경우 CLDR에서 파생된 헤더를 받아요:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

해당 언어에서 일반적인 수량 표현에 사용하는 형태(러시아어 `few` 또는 `many`)가 번역에서 누락되면, 동기화 프로세스가 모델에 다시 요청해요. 응답에 여전히 해당 형태가 없으면, 동기화 프로세스는 `other` 형태를 그 자리에 적고, 해당 항목에 `# champollion:` 주석을 표시하며 다시 요청할 수 있는 명령어(`--redo 'keys:django::One file' --fresh`)를 안내해요. 보류된 키와 마찬가지로, 표시된 항목이 카탈로그에 남아 있는 한 이를 작성한 실행뿐만 아니라 이후의 모든 동기화 실행이 `2`로 종료돼요. 마지막 검증 줄에도 `[OK]` 대신 실행이 불완전하다고 표시돼요. 해당 형태를 직접 손으로 작성하고 주석 줄을 삭제하거나, 더 강력한 `--model`로 다시 요청하세요. 다른 방식이나 모델로 동기화(예: 로컬 모델 실행 후 CI의 호스팅 모델 실행)하면 해당 항목을 자동으로 다시 요청하고, `sync --redo gaps`는 표시된 모든 항목을 다시 요청해요. 그래도 응답에 해당 형태가 없으면 항목은 계속 표시된 상태로 남아요. CI 환경에서는 커밋 후 작업이 실패하게 돼요([CI 가이드](/docs/guides/ci-cd#plural-gaps) 참고).

**기타 gettext 레이아웃.**

| 프로젝트 | 설정 | 소스 |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, 또는 `po/` 안의 `.pot` 파일 하나 |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, 또는 `translations/`나 그 상위 폴더의 `messages.pot` |

`printf` 플레이스홀더(`%s`, `%(name)s`, `%d`)는 번역 과정에서 반드시 유지되어야 하며, 품질 게이트(quality gate)는 플레이스홀더가 누락된 값을 거부해요. 배포하기 전에 여전히 `msgfmt --check-format`를 실행해 보세요(`compilemessages`가 이 작업을 수행해요). 이 검사는 플레이스홀더 타입도 확인하지만, `#, python-format` 플래그가 지정된 항목에서만 확인해요. `makemessages`는 `%` 플레이스홀더로 추출한 항목에 이 플래그를 추가하지만, 수작업으로 만든 카탈로그에는 플래그가 없을 수 있어 검사되지 않은 채 넘어갈 수 있어요. `champollion verify`는 플래그에 상관없이 모든 항목의 printf 플레이스홀더(이름 및 타입 글자)를 비교하며, 동기화 프로세스는 원본 항목의 플래그를 번역된 각 항목에 그대로 유지해요. 카탈로그는 반드시 UTF-8이어야 해요. 전체 규칙은 [gettext 카탈로그](/docs/getting-started/configuration#gettext)를 참고하세요.
