# 통합 가이드

인기 프레임워크와 champollion을 연동하기 위한 단계별 설정 안내입니다.

이 페이지의 명령어는 [CI 가이드](/docs/guides/ci-cd)에서와 같이 0.5 버전에 고정된 `npx --yes champollion@0.5 <command>`을(를) 사용하여 champollion을 실행해요. 이렇게 하면 로컬 컴퓨터와 CI 환경에서 동일한 버전이 실행되므로 새 릴리스로 인해 예기치 않게 동작이 변경되는 일이 없어요. 프로젝트 로컬 설치도 대안이 될 수 있어요. Node 프로젝트에서는 `npm install --save-dev champollion@0.5`(으)로 `package.json`에 추가한 다음, `npx champollion sync`(으)로 해당 복사본을 실행할 수 있어요.

---

## API 키 설정

프레임워크와 연동하기 전에 번역 API 키가 필요해요. Champollion은 두 가지 제공업체를 지원해요:

### 옵션 A: OpenRouter (권장)

[OpenRouter](https://openrouter.ai)는 200개 이상의 LLM 모델을 위한 통합 API를 제공해요. 무료 등급도 이용할 수 있어요.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

가장 적합한 용도: 콘텐츠가 많은 프로젝트, Markdown 번역, 그리고 콘텐츠 인식 보호(코드 블록, 숏코드, 보간 변수)가 필요한 프로젝트에 적합해요.

### 옵션 B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

추천 용도: 대량의 키-값 문자열 쌍 (194개 언어). Markdown 콘텐츠에는 **권장하지 않아요** — Google Translate는 코드 블록, 숏코드, 보간(interpolation) 변수를 인식하지 못해요.

Google Translate를 명시적으로 사용하려면:

```bash
champollion sync --method google-translate
```

> **팁**: `GOOGLE_TRANSLATE_API_KEY`만 설정되어 있고 OpenRouter 키가 없으면, champollion이 자동으로 Google Translate로 전환해요.

---

## Hugo (TOML / YAML / Markdown)

### 프로젝트 구조

Hugo는 문자열 번역에 `i18n/`을, 페이지 콘텐츠에 `content/`을 사용해요:

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

`champollion.config.json`을 생성하세요:

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

**Front matter**: YAML(`---`)과 TOML(`+++`) 구분자를 모두 지원해요. 기본적으로 `title`, `description`, `summary`, `subtitle`, `caption`, `linkTitle`를 번역해요. 그 외 모든 필드(date, draft, tags, weight, slug 등)는 그대로 유지돼요. 설정에서 `translatableFields`으로 커스터마이징할 수 있어요.

**블록 보호**: 코드 블록, Hugo 숏코드(`{{< >}}`, `{{% %}}`), 인라인 코드, raw HTML은 Unicode 센티넬 플레이스홀더를 사용해 자동으로 보호돼요. 변경 없이 그대로 통과돼요.

**파일명 규칙**: Hugo의 파일명 기반 번역 패턴을 따라요:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (소스 접미사 제거)

**기존 파일 건너뛰기**: 이미 번역된 파일은 절대 덮어쓰지 않아요. 재번역을 강제하려면 대상 파일을 삭제하세요.

### 복수형

TOML과 YAML 로케일은 CLDR 복수형을 지원해요:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

내부적으로는 diff를 위해 `items.one`과 `items.other`로 표현되며, 작성 시 올바른 섹션 형식으로 다시 직렬화돼요.

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

`npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`을(를) 실행하세요. `messages/en.json`을(를) 찾아 빈 대상 파일을 생성하고 아래와 같은 설정 파일을 작성해요. 또는 `champollion.config.json` 파일을 직접 생성할 수도 있어요:

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

각 타깃의 어조(톤과 격식 수준)는 `languages`에 기록되므로 직접 확인하고 수정할 수 있어요. 해당 언어의 다른 프리셋(`champollion status`에서 목록 확인 가능)으로 변경하거나 직접 원하는 표현으로 수정해 보세요. 프리셋이 없는 언어는 `{}`(으)로 기록돼요. 일반 목록 형태인 `"languages": ["fr", "de"]`도 사용할 수 있으며, 이 경우 각 언어의 기본값이 적용돼요.

```bash
npx --yes champollion@0.5 sync
```

`messages/fr.json`, `messages/ja.json` 등을 생성해요 — 중첩된 키 구조를 유지하며 완전히 번역돼요. next-intl이 자동으로 인식해요.

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
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init`은 `public/locales/en/`(또는 `locales/en/`)을 찾아 설정이 해당 경로를 가리키도록 지정하고, `fr/common.json`, `fr/admin/users.json` 및 기타 파일들을 빈 파일로 생성해요. 이때 작성되는 설정의 관련 부분은 다음과 같아요:

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

각 네임스페이스 파일은 번역되어 모든 언어 폴더의 동일한 경로에 작성돼요. 여러 네임스페이스에 나타나는 문자열은 언어당 한 번만 번역되며, 다른 파일은 Translation Memory에서 해당 문자열을 가져와요. 복수형 키(`key_one`, `key_other`)는 JavaScript `Intl.PluralRules` API를 통해 CLDR에서 읽어온 각 언어 고유의 형태를 적용받아요. 소스 언어에는 없지만 대상 언어에서 사용하는 형태는 추가되고, 사용하지 않는 형태는 제외돼요. 영어 소스의 경우 스페인어와 프랑스어는 `key_many`이(가) 추가되고, 러시아어는 `key_few` 및 `key_many`이(가) 추가되며, 일본어는 `key_other`만 유지돼요. 동기화 시 각 언어별로 추가되는 형태의 이름이 표시돼요. 자세한 내용은 [i18next 복수형 키](/docs/getting-started/configuration#i18next-plurals) 및 [로캘 파일 레이아웃](/docs/getting-started/configuration#locale-layouts)을 참고하세요.

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

파일이 다른 패턴을 따르고 있다면 `localesPattern`으로 지정할 수 있어요(`{lang}`은 언어, `{ns}`은 네임스페이스예요):

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

`flutter gen-l10n`은(는) 언어당 하나의 `.arb` 파일을 읽어요. 영어 파일이 템플릿 역할을 해요:

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init`은(는) `pubspec.yaml` 및 `l10n.yaml`(`arb-dir`, `template-arb-file`)을(를) 읽고, 템플릿 이름(`app_en.arb` → `en`)에서 소스 언어를 가져와 `@@locale`이(가) 포함된 `app_fr.arb`, `app_de.arb`, `app_pt_BR.arb`을(를) 생성해요. 생성되는 설정 내용은 다음과 같아요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

`l10n.yaml`에 `arb-dir: assets/i18n` 및 `template-arb-file: intl_en.arb`이(가) 설정되어 있다면 패턴은 `"assets/i18n/intl_{lang}.arb"`이(가) 돼요.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

메시지만 번역돼요. `gen-l10n`은(는) 파일 이름과 `@@locale`이(가) 일치하지 않는 파일을 거부하므로, 각 대상 파일의 `"@@locale"`은(는) 파일 이름 표기 방식(`"pt_BR"`)에 맞춰 자체 로캘로 설정돼요. 플레이스홀더 및 해당 유형과 같은 모든 `@key` 메타데이터 객체는 `app_en.arb`에서 변경 없이 복사돼요. 키는 템플릿의 순서를 따르며, 아직 번역되지 않은 메시지는 제외되어 Flutter가 영어 메시지로 대체(fallback)할 수 있도록 해요.

템플릿 메타데이터의 설명은 모델에 컨텍스트로 전달돼요:

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

`{count, plural, …}` 구문, `{count}` 플레이스홀더 및 선택자는 보호돼요. 이를 변경하는 번역은 거부되고 재시도돼요([ICU 메시지](/docs/getting-started/configuration#icu) 참고). 프랑스어는 `many` 분기를 추가할 수 있고, 폴란드어는 `few` 및 `many`을(를) 추가할 수 있어요. `champollion verify`은(는) 모든 대상 파일의 `@@locale` 및 플레이스홀더 메타데이터도 검사해요. 이전 도구가 이를 번역해 버린 경우 `champollion sync --pair en:fr --force`이(가) 파일을 다시 작성해요. 변경되지 않은 메시지는 비용 없이 캐시에서 가져와요.

### Flutter 자체 목록에 없는 로캘 {#flutter-locales-outside-flutters-own-list}

사용자 메시지는 `.arb` 파일에서 가져와요. 날짜 선택기, "뒤로", "취소", 텍스트 방향 등 Flutter 자체 위젯 내부의 텍스트는 정해진 언어 목록([Flutter 목록](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html))을 지원하는 `flutter_localizations`(`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`)에서 가져와요. `qaa`과 같은 사용자 정의 코드 및 대부분의 저자원 언어는 이 목록에 없어요. `supportedLocales`에 이러한 로캘이 포함되어 있으면 델리게이트가 해당 텍스트를 제공하지 않는 한 앱 실행 시 런타임 오류("No MaterialLocalizations found")가 발생해요. `init` 및 새 `.arb` 파일을 생성하는 동기화 작업은 목록에 없는 각 대상 언어에 대해 이 점을 안내해요. 시스템의 Flutter SDK(`FLUTTER_ROOT` 또는 `PATH`의 `flutter`)에서 이를 읽어오며, SDK가 없으면 확인할 수 없는 대상이 무엇인지 알려줘요.

가장 간단한 해결 방법은 해당 위젯에 Flutter가 지원하는 언어(여기서는 영어)의 텍스트를 빌려 쓰는 것이에요:

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

Flutter 자체 델리게이트 뒤에 이를 나열하세요:

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

그러면 앱 자체 텍스트는 해당 언어로 표시되면서 위젯에는 영어 라벨이 표시돼요. 위젯의 텍스트까지 번역하려면 Flutter 가이드에서 새 언어를 위한 전체 `MaterialLocalizations` 구현 방법을 확인하세요: [새 언어 지원 추가하기](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django 및 gettext (.po)

champollion CLI는 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)에 따라 소스 코드가 공개되어 있어요. 비상업적 목적으로 자유롭게 사용, 수정, 공유할 수 있어요. 상업적 목적의 사용은 이 라이선스에서 허용되지 않아요 ([사용 대상 안내](/docs/getting-started/who-may-use-this)).

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

Django는 `LOCALE_PATHS`에 나열된 폴더와 각 설치된 앱의 `locale/` 폴더에서 카탈로그를 찾아요. `manage.py` 옆에 있는 `locale/`은(는) 어떤 앱에도 속하지 않으므로, `LOCALE_PATHS`에 지정하기 전까지는 `compilemessages`이(가) `.mo` 파일을 빌드하더라도 사이트에는 계속 번역되지 않은 텍스트가 표시돼요. `LANGUAGES`은(는) 사이트에서 제공하는 언어 목록이에요. Django 기본값은 함께 제공되는 모든 언어이므로, 직접 지원할 언어들을 나열하세요:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### 설정

먼저 Django를 사용해 카탈로그를 생성하거나 새로고침하세요. 영어 카탈로그가 소스가 돼요. 비어 있는 `msgstr`은 "msgid가 본문 텍스트임"을 의미해요:

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init`은(는) `manage.py` 및 `locale/en/LC_MESSAGES/django.po`을(를) 찾아 다음과 같이 작성해요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}`은(는) gettext 도메인이므로 `django.po` 및 `djangojs.po`이(가) 모두 동기화돼요.

**기본값에는 어조와 성별 스타일이 포함되며, `init`은(는) 둘 다 출력해요.** `formal-vous`은(는) 모델에 "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register."를 요청해요. 프랑스어의 성별 지침은 독자의 성별을 알 수 없을 때 가운뎃점을 사용한 포용적 글쓰기(*écriture inclusive*)를 요청하며(`Connecté·e`, `Utilisateur·rice·s`), 러시아어(`formal-vy`)는 관례적 기본값인 남성형을 사용해요. 다른 스타일을 원하는 사이트(예: 병원의 환자용 페이지)는 `champollion.config.json`에서 이를 변경할 수 있어요. `languages`에서 어조를 변경하거나(`"fr": "casual-tu"` 또는 직접 작성한 문구), `genderGuidance`에서 변경할 수 있어요(별도 지침이 없으면 `false`, 또는 `"Use the masculine generic."`과 같이 직접 작성, [성별 지침](/docs/getting-started/configuration#gender-guidance) 참고). 변경된 설정에는 자체 캐시 항목이 적용되므로, `sync --redo all` 실행 시 이전 설정으로 작성된 내용을 다시 번역해요.

**어떤 방식이 번역을 수행하고 어떤 키가 필요한지.** `--method`이(가) 없으면 `init`은(는) 기본값인 `llm`을(를) 설정해요. 이는 [OpenRouter](https://openrouter.ai)의 모델로, 환경 변수 또는 `manage.py` 옆의 `.env` 파일에 `OPENROUTER_API_KEY`이(가) 필요해요(키가 누락된 경우 `init`이(가) 설정해야 할 행을 출력해요). 모델 서버(Ollama, LM Studio, vLLM)를 실행하는 머신에서는 `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1`에 API 키가 필요하지 않으며, 머신 외부로 아무것도 전송되지 않아요. CI 러너에는 모델 서버가 없으므로 실행 시 호스팅 모델을 지정해요([CI 가이드](/docs/guides/ci-cd) 참고). 지원되는 모든 방식과 각각 필요한 키는 [번역 방식](/docs/guides/translation-methods)을 참고하세요.

그 다음:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

동기화는 `msgstr`이(가) 비어 있는 모든 항목과 모든 `fuzzy` 항목을 번역하고 `fuzzy` 플래그를 제거해요. 이미 번역된 항목은 주석과 함께 바이트 단위까지 그대로 유지돼요. `msgctxt`이(가) 있는 항목은 자체 키와 캐시 항목을 가지므로, 동사 "Open"과 형용사 "Open"은 각각 별도로 번역돼요. `#.` 주석과 컨텍스트는 모델로 전송돼요. 실제로 전송하지 않고 정확한 요청 내용을 확인하려면 `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'`을(를) 실행하세요(컨텍스트와 주석은 "UI context for these keys" 아래에 표시돼요).

**특정 항목을 의도적으로 다시 번역하기.** msgid로 대상을 지정하세요:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

캐시에 이미 해당 텍스트가 있는 경우 Translation Memory에서 이를 제공하므로 비용 없이 동일한 번역을 다시 가져오며, 동기화 시 `--fresh` 명령어와 함께 이를 안내해요. 이러한 재실행에는 모델이 필요하지 않아요. `local` 상태에서 모델 서버가 중지되어 있어도 서버가 응답하지 않지만 이번 실행에는 필요하지 않다는 경고를 표시하고 계속 진행돼요(전송해야 할 데이터가 있는 재번역의 경우 서버 이름을 표시하며 중단돼요). 새로 비용을 들여 번역하려면 `--fresh`을(를) 추가하세요. msgid 내부의 쉼표는 `\,`(으)로 표기하며, 따옴표는 셸이 나머지를 잘못 해석하지 않도록 보호해 줘요. 컨텍스트가 있는 항목은 보고서에 출력되는 형식인 `verb␄Open`(으)로 지정해요. `␄`을(를) 입력할 수 없다면 대신 `\x04`을(를) 사용하여 `--redo 'keys:verb\x04Open'`(으)로 작성할 수 있어요. 두 표기법 모두 동작하며, 복구 명령어도 두 표기법을 모두 표시해요. 특정 도메인의 항목만 지정하려면 도메인을 접두사로 붙이세요: `django::Welcome`. 일치하는 항목이 없는 이름을 입력하면 실행이 실패(exit 1)하고 가장 가까운 항목 목록을 나열해요(예: msgid `Cancel`의 모든 컨텍스트인 `button␄Cancel`, `status␄Cancel`). 완료된 재번역으로 간주하여 넘어가는 일은 결코 없어요.

champollion이 생성하는 카탈로그(`init --langs` 또는 아직 카탈로그가 없는 언어에 대한 동기화)에는 `msginit`이(가) 작성하는 필드와 같은 표준 gettext 헤더가 포함되므로 `msgfmt -c`이(가) 정상적으로 인식해요. 기존 카탈로그의 헤더는 절대 다시 작성되지 않아요.

**`makemessages`이(가) 시작한 카탈로그에 대한 `msgfmt -c` 헤더 경고.** `makemessages`은(는) `#, fuzzy` 플래그가 붙은 gettext 템플릿 헤더(`Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`)를 작성하며, `msgfmt -c`은(는) 컴파일할 때마다 각 필드가 "still has the initial default value"라는 경고를 표시해요. 동기화 작업은 이 값들을 건드리지 않으므로(기존 헤더에서는 플레이스홀더 `Plural-Forms` 또는 문자셋만 채워 넣음), 각 카탈로그에서 직접 한 번 수정해 주세요. 프로젝트 이름 및 버전, 날짜, 번역가(또는 `Automatically generated`), 팀(또는 `none`)을 입력하고, 헤더가 아직 검토되지 않았음을 나타내는 `msgid ""` 위의 `#, fuzzy` 행도 삭제하세요. `makemessages`은(는) 직접 입력한 값을 그대로 유지해요. `compilemessages`(`msgfmt --check-format`)은(는) 헤더를 검사하지 않으므로 이 경고로 인해 실패하지 않아요.

**복수형.** `msgid` + `msgid_plural`은(는) 모델이 해당 언어에 필요한 모든 형태로 번역하는 하나의 메시지가 돼요. 이 형태들은 카탈로그의 `Plural-Forms` 헤더에 따라 `msgstr[0]`, `msgstr[1]` 등에 작성돼요. Django가 이 헤더를 자동으로 작성해 줘요. 헤더가 없는 카탈로그에는 `msginit`이(가) 해당 언어에 대해 작성하는 헤더(프랑스어 `nplurals=2; plural=(n > 1);`)가 지정되거나, `msginit`에 나열되지 않은 언어의 경우 CLDR에서 파생된 헤더가 지정돼요:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

일반적인 수량 표현에 사용되는 형태(러시아어 `few` 또는 `many`)가 번역에서 누락되면, 동기화 작업이 모델에 다시 요청해요. 응답에도 여전히 누락되어 있다면 동기화는 해당 위치에 `other` 형태를 작성하고, `# champollion:` 주석으로 항목을 표시한 뒤 다시 요청할 수 있는 명령어(`--redo 'keys:django::One file' --fresh`)와 함께 해당 항목 이름을 지정해요. 보류된 키와 마찬가지로, 표시된 항목이 카탈로그에 남아 있는 한 이를 작성한 동기화뿐만 아니라 모든 동기화 작업이 `2`(으)로 종료돼요. 마지막 검증 줄에도 `[OK]` 대신 실행이 불완전하다고 표시돼요. 해당 형태를 직접 작성하고 주석 줄을 삭제하거나, 더 강력한 `--model`(으)로 다시 요청하세요. 다른 방식이나 모델(로컬 모델 실행 후 CI의 호스팅 모델 등)을 사용하는 동기화는 자동으로 해당 항목을 다시 요청하고, `sync --redo gaps`은(는) 표시된 모든 항목을 다시 요청해요. 응답에 여전히 해당 형태가 누락되어 있다면 항목은 계속 표시된 상태로 남아요. CI 환경에서는 커밋 후 작업이 실패하게 돼요([CI 가이드](/docs/guides/ci-cd#plural-gaps) 참고).

**기타 gettext 레이아웃.**

| 프로젝트 | 설정 | 소스 |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` 또는 `po/`의 `.pot` 파일 |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` 또는 `translations/`이나 상위 폴더의 `messages.pot` |

`printf` 플레이스홀더(`%s`, `%(name)s`, `%d`)는 번역 후에도 유지되어야 하며, 품질 게이트는 플레이스홀더가 유실된 번역 값을 거부해요. 배포하기 전에 `msgfmt --check-format`(`compilemessages`이(가) 수행함)을(를) 실행하는 것이 좋아요. 이 도구는 플레이스홀더 유형도 검사하지만, `#, python-format` 플래그가 지정된 항목에 대해서만 검사해요. `makemessages`은(는) `%` 플레이스홀더와 함께 추출한 항목에 이 플래그를 추가하지만, 직접 만든 카탈로그에는 플래그가 없을 수 있어 해당 항목들은 검사되지 않아요. `champollion verify`은(는) 플래그와 상관없이 모든 항목의 printf 플레이스홀더(이름 및 유형 문자)를 비교하며, 동기화는 소스 항목의 플래그를 번역된 각 항목에 유지해요. 카탈로그는 UTF-8 형식이어야 해요. 전체 규칙은 [gettext 카탈로그](/docs/getting-started/configuration#gettext)를 참고하세요.
