---
sidebar_position: 3
title: "구성"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 구성

Champollion은 별도의 구성 없이 작동해요 — 프로젝트에서 로케일 파일, 형식, 대상 언어를 자동으로 감지해요. 더 세밀하게 제어하려면 프로젝트 루트에 `champollion.config.json`을 생성하거나 다음을 실행하세요:

```bash
npx champollion init
```

## 전체 구성 레퍼런스

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen은 아직 구현되지 않았어요]
`typegen` 구성 블록은 구성 로더가 인식하고 보존하지만, TypeScript 타입 생성은 아직 구현되지 않았어요. 이는 계획된 기능을 위한 자리 표시자예요. 이 값들을 설정해도 아무런 효과가 없어요.
:::


### 필드

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `version` | `number` | `3` | 설정 스키마 버전이에요. 항상 `3`예요. |
| `inputLocale` | `string` | `"en"` | 소스 언어 코드(BCP 47)예요. |
| `localesDir` | `string` | `"./locales"` | 로케일 파일 경로예요. 언어당 하나의 파일(`fr.json`) 또는 언어당 하나의 폴더(`fr/common.json`)를 보관해요. [로케일 파일 레이아웃](#locale-layouts)을 참고하세요. |
| `localesPattern` | `string` | `null` | 두 형태 모두 맞지 않을 때 모든 언어의 파일이 위치하는 경로로, `{lang}` 및 선택적인 `{ns}`를 포함해요: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. 프로젝트 루트 기준 상대 경로예요. `localesDir`을 대체해요. [로케일 파일 레이아웃](#locale-layouts)을 참고하세요. |
| `localesLayout` | `string` | `null` | 레이아웃 감지를 재정의해요: `"flat"`(언어당 하나의 파일) 또는 `"dir"`(언어당 하나의 폴더). `en.json`와 `en/`가 모두 존재할 때만 필요해요. |
| `defaultNamespace` | `string` | `null` | 파일이 여러 개 있는 언어당 폴더 프로젝트에서 `champollion wrap`가 새 키를 추가할 파일이에요(예: `"common"`). |
| `contentDir` | `string` | `null` | 번역할 Markdown/MDX 폴더예요: Hugo `content/` 폴더 또는 Next.js 앱의 `./newsletters`와 같은 기타 폴더예요. 각 번역본은 소스 옆에 `<name>.<locale>.md` 형태로 작성돼요(예: `2026-10.md` → `2026-10.crk.md`). 이미 이름이 `<name>.<code>.md` 형식인 파일은 소스가 아닌 번역본으로 처리돼요. [콘텐츠 번역](/docs/guides/content-translation)을 참고하세요. |
| `translatableFields` | `string[]` | `null` | 콘텐츠 번역 시 기본 번역 가능 프론트매터 필드를 재정의해요. `null`는 내장 기본값(`title`, `description`, `summary`)을 사용해요. |
| `format` | `string` | `"auto"` | 파일 형식: `json`, `toml`, `yaml`, `po`([gettext](#gettext)), `arb`([Flutter](#arb)) 또는 `auto`(소스 파일 확장자에서 감지, `.yml`는 YAML로 간주되며 대상은 `.yml`를 유지함). 다른 값은 오류와 함께 중단돼요. |
| `model` | `string` | `"google/gemini-3.8-flash"` | LLM 방식의 기본 모델이에요. 정확한 모델 슬러그(전체 OpenRouter 슬러그(`provider/model`))를 사용해야 해요. 짧은 별칭(`gemini-flash`)이나 유동적 ID(`~vendor/…`, `…-latest`)는 거부되며, 작성해야 할 슬러그를 안내해요. 직접 제공업체(direct provider)는 기본 이름(예: `gpt-4o`)을 사용하며, 자체 벤더의 OpenRouter 슬러그는 여기에 매핑되고(`openai/gpt-4o` → `gpt-4o`), 모델이 없는 슬러그는 요청을 보내기 전에 실행을 중단해요([모델 이름](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | LLM temperature(0.0–2.0)예요. 낮을수록 결과가 더 결정적이에요. |
| `defaultMethod` | `string` | `"llm"` | 기본 번역 방식: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local`는 로컬 머신에서 실행되는 OpenAI 호환 서버예요(기본값은 Ollama). `--method` CLI 플래그로 재정의할 수 있어요. |
| `batchSize` | `number` | `80` | 번역 배치당 키 수예요. 높을수록 API 호출 수는 줄어들지만 프롬프트 크기는 커져요. |
| `coachingFile` | `string` | `null` | 자유 형식 코칭 프롬프트 파일의 경로예요(프로젝트 루트 기준 상대 경로). 시작 시 파일 내용을 읽어 시스템 프롬프트에 `Coaching guidance:` 블록으로 주입해요. |
| `promptContext` | `string` | `null` | 시스템 프롬프트에 주입되는 애플리케이션 컨텍스트 문자열이에요(예: "전자상거래 제품 설명"). 모델이 번역을 도메인에 맞게 조정하도록 도와줘요. |
| `genderGuidance` | `string` \| `false` | `null` | LLM 프롬프트가 문법적 성별(grammatical gender)을 처리하는 방식이에요. `null`는 Champollion 카탈로그에 정의된 각 언어의 기본값을 유지해요. 프랑스어의 경우 가운뎃점(interpunct)을 사용하는 *포용적 표기법(écriture inclusive)* (`Connecté·e`, `Utilisateur·rice·s`), 독일어의 경우 콜론 형식(`Benutzer:innen`)을 사용해요. `false`는 성별 지침을 보내지 않으며, 문자열을 전달하면 사용자 지정 지침을 전송해요(예: `"Use the masculine generic."`). 언어별 및 언어쌍별로도 설정할 수 있어요. [성별 지침](#gender-guidance)을 참고하세요. |
| `protectedTerms` | `string[]` | `[]` | 모든 언어에서 그대로 유지할 이름(인명, 회사명, 제품명 등, 예: `["Curtis Forbes", "Game Day Suits"]`)이에요. 모델에 이를 유지하도록 지시하며, 이러한 이름으로만 구성된 값은 미번역 또는 잘못된 문자 체계(wrong-script)로 플래그가 지정되지 않아요. **키** 전체를 건너뛰는 `noTranslate`와는 달라요. |
| `jsonConcurrency` | `number` | `200` | JSON 키 동기화의 최대 병렬 로케일 번역 수예요. `--json-concurrency` CLI 플래그로 재정의할 수 있어요. |
| `contentConcurrency` | `number` | `48` | 콘텐츠(Markdown/MDX) 번역의 최대 병렬 API 호출 수예요. `--content-concurrency` CLI 플래그로 재정의할 수 있어요. |
| `fallbackPrefix` | `string` | `"[EN] "` | 이전 실행에서 번역되지 않은 레거시 값을 감지하기 위해 `audit` 및 `verify`에서 사용하는 마커 접두사예요. Champollion은 이 접두사를 직접 쓰지 않으며, 감지용으로만 읽어요. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | API 키의 환경 변수 이름이에요. 사용자 정의 환경 변수 이름을 사용할 때 재정의하세요. |
| `minContentRetention` | `number` | `0.35` | [콘텐츠 삭제 검사](/docs/concepts/quality-gate)가 보조 신호를 참조하기 전에 출력이 유지해야 하는 소스 문자/숫자의 비율이에요. 언어쌍별 및 언어별로도 설정할 수 있어요. |
| `noTranslate` | `string[]` | `[]` | 값이 모든 로케일에 그대로 복사되는 점 표기법(dot-path) 키 및 글롭(glob) 패턴이에요. [번역 제외 키](#no-translate)를 참고하세요. `skipKeys`로도 사용할 수 있어요. |
| `noTranslateUrls` | `boolean` | `true` | `scheme://` URL로만 이루어진 소스 값을 번역 제외 대상으로 처리해요. URL 값을 가진 키를 번역 백엔드로 보내려면 `false`로 설정하세요. |
| `baseUrl` | `string` | `""` | SEO 산출물(hreflang, 사이트맵, JSON-LD) 생성을 위한 기본 URL이에요. |
| `pairs` | `object` | `{}` | 언어쌍별 방식, 모델, 품질 재정의 설정이에요. [언어쌍 구성](#pair-configuration)을 참고하세요. |
| `languages` | `object` | `{}` | 언어별 재정의 설정이에요. [언어 구성](#language-configuration)을 참고하세요. |
| `lint.srcDir` | `string` | `null` | 린트 검사를 위한 소스 디렉터리예요. `null` = 프레임워크에서 자동 감지해요. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | 린트에서 제외할 글롭 패턴이에요. |
| `lint.minLength` | `number` | `2` | 하드코딩된 것으로 감지할 최소 문자열 길이에요. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | hreflang 태그 생성을 위한 URL 패턴 템플릿이에요. |
| `seo.pages` | `string[]` | `null` | SEO를 위한 명시적 페이지 목록이에요. `null` = 로케일 키에서 자동 감지해요. |
| `typegen.output` | `string` | `null` | 생성된 TypeScript 타입의 출력 경로예요. `null` = 비활성화됨. |
| `typegen.autoGenerate` | `boolean` | `false` | 각 동기화 후 타입을 자동으로 재생성해요. |

## 로케일 파일 레이아웃 {#locale-layouts}

Champollion은 프레임워크가 로케일 파일을 보관하는 기존 위치에서 파일을 읽어와요. 세 가지 형태가 있어요.

**언어당 하나의 파일** (`flat`). next-intl, vue-i18n, Hugo, 대부분의 자체 구축 설정:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**언어당 하나의 폴더** (`dir`). 각 파일이 *네임스페이스*인 i18next 및 react-i18next:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

Champollion은 `<localesDir>/<inputLocale>/`가 로케일 파일 폴더일 때 `dir`를 선택해요. 모든 소스 파일은 각 언어 폴더 아래의 동일한 경로로 동기화되며, 누락된 파일과 폴더는 생성돼요. 네임스페이스는 중첩 경로(`admin/users`)일 수도 있어요.

**기타 모든 형태** (`localesPattern`). 경로를 `{lang}`로 지정하고, 언어에 파일이 여러 개 있는 경우 `{ns}`도 함께 지정하세요:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`"{lang}/app_{lang}.json"`처럼 `{lang}`는 반복될 수 있어요. `{ns}`는 한 번 나타날 수 있으며 여러 폴더에 걸쳐 있을 수 있어요. `format`가 설정되어 있지 않으면 포맷은 확장자로부터 결정돼요.

`champollion init`는 이러한 레이아웃을 자동으로 찾아줘요. 먼저 Flutter 앱(`pubspec.yaml`, 존재하는 경우 `l10n.yaml` 포함) 및 gettext 카탈로그(`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`)가 있는지 확인하고, 해당하는 경우 `localesPattern`를 작성해요. 그런 다음 프레임워크의 일반적인 폴더(next-intl의 경우 `messages/`, i18next의 경우 `public/locales/` 후 `locales/`, vue-i18n의 경우 `src/locales/`, Hugo의 경우 `i18n/`)를 확인한 후, `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales`, `src/i18n`를 차례로 확인해요. 소스 언어 파일이 포함된 폴더만 사용하며, 발견한 내용을 출력해요. `init --langs fr,de`는 해당 레이아웃에 빈 타깃 파일도 생성해요.

:::note[다중 파일 언어 동기화 방식]
각 파일은 개별적으로 비교되고 번역되며 작성돼요. `.champollion.lock`는 키를 `<namespace>::<key>`(`common::nav.home`) 형식으로 기록하며, `--force-keys`, `xliff` 유닛 ID 및 `sync --dry --json`도 마찬가지예요. `--force-keys`의 단순 키는 모든 파일의 해당 키와 일치해요. 언어당 하나의 파일 프로젝트는 일반 키를 유지하므로 잠금 파일이 변경되지 않아요.

번역 메모리(Translation Memory)는 파일이 아닌 소스 텍스트를 키로 사용해요. 두 네임스페이스에 나타나는 문자열은 언어당 한 번만 번역돼요. 두 번째 파일은 비용 없이 캐시에서 해당 문자열을 가져와요.
:::

`en.json`와 내용이 채워진 `en/` 폴더가 둘 다 존재하는 경우, Champollion은 임의로 추측하지 않고 중단한 뒤 `"localesLayout": "flat"` 또는 `"dir"`를 설정하도록 요청해요.

### i18next 복수형 키 {#i18next-plurals}

i18next는 복수형을 CLDR 접미사가 붙은 형제 키로 저장해요: `item_one`, `item_other`. 언어마다 복수형 형태가 달라요. 프랑스어와 스페인어는 `_many`도 사용하고, 아랍어는 6가지 형태를 사용하며, 일본어는 `_other`만 사용해요. JSON 소스 파일에 이러한 키가 있으면, JavaScript `Intl.PluralRules` API를 통해 CLDR에서 읽어와 각 타깃 언어에 정확히 맞는 형태만 생성돼요:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

동기화가 끝나면 `fr.json`에는 `item_one`, `item_many`, `item_other`가 생기고, `ja.json`에는 `item_other`만 생겨요. 동기화 과정에서 설정된 언어별로 어떤 형태가 추가되거나 제외되는지 알려줘요.

새로운 형태는 소스의 `_other` 텍스트에서 번역되며, `_one`는 `_one`에서 번역돼요. i18next는 모든 언어에서 개수가 0일 때 `_zero`를 조회하므로, 소스에 있는 `_zero`는 모든 언어에서 유지돼요. 이전 동기화에서 일본어의 `item_one`처럼 해당 언어가 사용하지 않는 형태를 작성했다면, 번역 메모리에서 동기화가 해당 값을 생성했음을 확인할 수 있을 때만 이를 제거해요. 직접 수동으로 작성한 값은 유지돼요. 해당 언어에 없는 형태이면서 소스에도 키가 없는 형태(스페인어 `item_two`)는 저절로 제거되지 않아요. `verify`가 해당 키를 지정하고, `sync --prune plural-extras`가 각 키를 나열하면서 정확히 그 키들만 제거해요(`--dry` 사용 시 제거할 항목을 미리 알려줘요). CLDR에 복수형 규칙이 없는 언어의 경우 소스의 형태가 일대일로 복사되며, 동기화 시 이 내용이 안내돼요.

### ICU 메시지 {#icu}

ICU MessageFormat(next-intl, react-intl, vue-i18n, Flutter)으로 작성된 값은 코드와 텍스트가 섞여 있어요:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

분기 내부의 텍스트만 번역돼요. [품질 게이트](/docs/concepts/quality-gate)는 그 외의 다른 부분을 변경하는 번역을 거부해요:

- 변수 이름(`count`, `{name}`): 이름이 변경되거나 삭제되지 않아요.
- `plural`, `select`, `selectordinal` 단어 및 `{price, number}`의 타입.
- 선택자(`=0`, `one`, `other`, `male`): `select`는 정확히 기존 옵션을 유지해요. `plural`는 소스의 선택자를 유지하면서 CLDR을 바탕으로 타깃 언어가 사용하는 카테고리를 추가할 수 있어요(프랑스어는 `many` 추가, 폴란드어는 `few` 및 `many` 추가). 해당 언어가 사용하지 않는 카테고리는 제외될 수 있어요(예: 일본어는 `other`만 유지).
- 복수형 분기에 포함된 `#`(숫자를 단어로 표기할 수 있는 `zero`, `one`, `two`, `=N` 제외).
- `offset:N`, 중첩 인수 및 `%s`, `%d`, `%(name)s`와 같은 printf 변환.

모델에는 타깃 언어가 어떤 카테고리를 사용하는지 전달돼요. 거부된 번역은 그 이유(예: `ICU keyword 'other' was translated to 'óthér'`)와 함께 한 번 재시도돼요. 플레이스홀더 앞의 아포스트로피(`d'{name}`)는 허용돼요. `verify`와 `integrity`는 이미 작성된 파일에 대해 동일한 검사를 실행해요. 일반 `sync`는 디스크에 이미 있는 값을 유지하므로, 발견된 문제마다 이를 복구하는 명령인 `champollion sync --pair <pair> --redo keys:<key>`를 안내해요. 손상된 값이 번역 메모리에서 온 경우 캐시에서 해당 값을 제거하므로, 해당 명령은 동일한 텍스트를 제공하는 대신 키를 다시 번역해요(`--fresh`는 필요하지 않아요).

### gettext 카탈로그 (.po) {#gettext}

`localesPattern`(또는 `localesDir`)가 카탈로그를 가리키도록 설정하세요:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**소스**는 소스 언어의 카탈로그예요(예: `django-admin makemessages -l en`의 `locale/en/LC_MESSAGES/django.po`). `msgstr`가 비어 있을 때 `msgid`가 번역할 텍스트가 돼요. 해당 카탈로그가 존재하지 않는 경우 소스는 `.pot` 템플릿이 돼요:

- `localesDir` 사용 시: 해당 폴더에 있는 하나의 `.pot`.
- `localesPattern` 사용 시: 첫 번째 플레이스홀더 앞의 폴더 또는 그 상위 폴더에 있는 `<name>.pot`. `<name>`는 네임스페이스(`{ns}`, `django.pot`처럼 도메인당 하나의 템플릿)이거나 `{lang}`를 제외한 패턴의 파일 이름(`messages.po` → `messages.pot`)이에요.
- `localesLayout: "dir"` 사용 시: 템플릿을 찾지 않아요. 소스 카탈로그를 `<localesDir>/<source>/`에 보관하세요.

템플릿이 하나만 있어야 할 위치에 두 개가 있으면 실행이 중단돼요. Champollion은 어느 쪽이 소스인지 임의로 추측하지 않아요.

**키.** 각 `msgid`는 하나의 키예요. `msgctxt`가 있는 항목은 gettext 자체 인코딩 방식인 `msgctxt` + U+0004 + `msgid` 형식으로 키가 지정돼요. 동사 "Open"과 형용사 "Open"은 서로 다른 키이자 별도의 캐시 항목이에요. 보고서에는 구분자가 `␄`(`verb␄Open`)로 출력되며, `--force-keys "verb␄Open"`에서도 이를 지원해요. `␄`를 입력할 수 없다면 `\x04`(`--force-keys 'verb\x04Open'`)로 작성해도 돼요(두 표기 모두 동작해요). `--force-keys`(및 `--redo keys:`)는 쉼표를 기준으로 분할하므로, msgid 내부의 쉼표는 `\,`로 작성하고 인수를 따옴표로 묶으세요: `--redo 'keys:Welcome back\, %(name)s!'`. 변경되지 않은 항목은 캐시에서 비용 없이 가져와요.

**번역 대상.** `msgstr`가 비어 있거나 `fuzzy` 플래그가 지정된 항목은 미번역 항목으로 간주돼요. 동기화 시 이를 번역하고 `#|` 이전 msgid 줄과 함께 `fuzzy`를 제거해요. 번역가 주석(`# …`)은 유지돼요. 참조(`#:`), 추출된 주석(`#.`) 및 플래그는 소스에서 가져와요. `#.` 주석과 `msgctxt`는 모델에 컨텍스트로 전달돼요. 동기화가 변경하지 않은 항목은 바이트 단위로 그대로 다시 작성돼요. 소스에 더 이상 없는 항목 및 더 이상 사용되지 않는 `#~` 항목은 파일 끝에 유지돼요.

Champollion이 생성하는 카탈로그(`init --langs` 또는 아직 카탈로그가 없는 로케일의 동기화)는 `msginit --no-translator`가 작성하고 `msgfmt -c`가 수용하는 전체 헤더를 갖게 돼요: 템플릿에서 복사된 `Project-Id-Version`, `Report-Msgid-Bugs-To`, `POT-Creation-Date`(`PACKAGE VERSION`는 프로젝트 폴더 이름으로 대체되며, 템플릿 날짜가 없으면 `POT-Creation-Date`는 없음), `PO-Revision-Date`(파일이 생성된 시점), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit`, `Plural-Forms`. 기존 카탈로그의 헤더는 다시 작성되지 않으며, 헤더 내의 플레이스홀더 `Plural-Forms` 또는 `charset=CHARSET`만 채워져요.

**복수형.** `msgid_plural`이 있는 항목은 하나의 ICU 복수형 메시지(`{n, plural, one {One file} other {%(count)d files}}`)로 번역되므로 모델이 모든 형태를 한 번에 작성해요. 그런 다음 대상의 `Plural-Forms` 헤더를 통해 `msgstr[0]`…`msgstr[n]`에 기록돼요. 각 인덱스는 해당 인덱스를 선택하는 숫자의 CLDR 카테고리를 가져와요. 러시아어 `nplurals=3`은 `one`, `few`, `many`이에요. 대상에 `Plural-Forms` 헤더가 없거나 템플릿 플레이스홀더만 있는 경우, 해당 언어에 대해 `msginit`이 작성하는 헤더를 받게 되므로 카탈로그의 `msgstr[]` 슬롯은 gettext와 Django가 선택하는 슬롯이 돼요: 프랑스어 `nplurals=2; plural=(n > 1);`, 독일어 `nplurals=2; plural=(n != 1);`, 러시아어 `nplurals=3; …`. `msginit`에 항목이 없는 언어는 CLDR에서 파생된 헤더를 받으며, 최대 3,000까지의 모든 숫자와 큰 숫자에 대해 `Intl.PluralRules`과 대조하여 검증돼요. 어떤 언어의 규칙을 gettext 표현식으로 작성할 수 없는 경우 동기화가 중단되고 헤더를 작성하는 명령어가 표시돼요: `msginit --locale=<lang> --input=<template>.pot`. 카탈로그에 슬롯이 없는 형태(두 가지 형태의 카탈로그에서 1 000 000에 대한 프랑스어 `many`)는 다시 요청되거나 누락된 것으로 표시 또는 보고되지 않아요. 자체 헤더가 있는 카탈로그는 이를 유지하며, 해당 슬롯이 검사 대상이 돼요.

**제한 사항.** 카탈로그는 반드시 UTF-8이어야 해요. 다른 인코딩은 `msgconv --to-code=UTF-8`로 변환하세요. 중괄호의 짝이 맞지 않는 복수형 msgid는 ICU 메시지로 작성할 수 없으므로, 보고된 후 직접 번역할 수 있도록 남겨둬요. 배포하기 전에 여전히 `msgfmt --check-format`(Django의 경우: `compilemessages`)를 실행하세요. 이 명령어는 `#, python-format`(또는 `c-format` 등) 플래그가 지정된 항목만 검사해요. `makemessages`는 `%` 플레이스홀더를 사용하여 추출하는 항목에 플래그를 추가하지만, 수동으로 작성된 카탈로그에는 플래그가 없을 수 있어 해당 항목이 검사되지 않은 채 넘어갈 수 있어요. `champollion verify`는 플래그에 상관없이 모든 항목의 printf 플레이스홀더(이름 및 타입 문자)를 비교하며, 동기화는 번역하는 각 항목에 소스 항목의 플래그를 유지해요.

### Flutter ARB 파일 (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

서로 다른 경우 `l10n.yaml`의 `arb-dir` 및 `template-arb-file`를 사용하세요(`assets/i18n/intl_{lang}.arb`). 메시지만 번역돼요. 작성 시:

- `@@locale`는 파일 이름과 일치하도록 Flutter 형식의 타깃으로 설정돼요(`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n`는 `@@locale`가 파일 이름과 일치하지 않는 파일을 거부해요.
- 모든 `@key` 메타데이터 객체(플레이스홀더, 타입, 설명)는 소스에서 복사돼요. 소스에 메타데이터가 없는 키는 타깃의 메타데이터를 유지해요.
- 키는 소스의 순서를 따라요. 번역되지 않은 메시지는 제외되므로 Flutter가 템플릿으로 대체(fallback)해요.

메시지 `description`는 모델에 컨텍스트로 전달돼요. `{name}` 플레이스홀더와 ICU 복수형은 [ICU 검사](#icu)를 통해 보호돼요. `verify` 및 `integrity`는 잘못된 `@@locale` 및 소스와 다른 플레이스홀더 메타데이터도 보고해요. 파일을 다시 작성하는 모든 동기화에서 둘 다 복구되며, `champollion sync --pair en:fr --force`는 변경되지 않은 모든 메시지를 캐시에서 제공해요.

## 번역 제외 키 {#no-translate}

어떤 값들은 모든 언어에서 정확히 하나의 올바른 표현만을 가져요: URL, 저장소 경로, 패키지 이름, 제품 식별자 등이 그렇습니다. `https://example.org/paper`의 올바른 번역은 `https://example.org/paper`예요.

Champollion의 [품질 게이트](/docs/concepts/quality-gate)는 소스와 동일한 번역인 '소스 에코(source-echo)'를 거부해요. 이는 일반적으로 모델이 작업을 거부한 결과이기 때문이에요. 하지만 이러한 키의 경우 올바른 답이 오히려 거부 대상이 되어, 모델이 통과할 수 있는 출력을 만들어낼 방법이 없어요. 성능이 떨어지는 모델은 값을 살짝 변형하여(지어낸 `#fragment`, 불필요한 후행 슬래시, 눈에 보이지 않는 너비가 0인 공백 등) 게이트를 우회하려 하므로 깨진 링크가 배포될 수 있어요. 성능이 뛰어난 모델은 값을 변경하지 않고 그대로 반환하여 게이트를 통과하지 못하므로, `sync`가 매번 0이 아닌 종료 코드로 종료돼요.

대신 이러한 키를 선언해 두세요:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

일치하는 키는 **소스 로케일에서 그대로 복사돼요**. 번역 백엔드로 전송되지 않고, 품질 게이트 검사를 거치지 않으며, 실패로 집계되지도 않고 비용도 청구되지 않아요. 동일한 이유로 실행 전 예상 비용에서도 제외돼요.

### 패턴 구문

패턴은 평탄화된 키 공간에 대한 점 표기 경로(dot-path)이며, 두 가지 와일드카드를 지원해요:

| 패턴 | 일치하는 항목 | 일치하지 않는 항목 |
|------|--------------|-------------------|
| `nav.brand` | `nav.brand` (정확한 경로) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (어떤 깊이의 `url` 리프) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*`는 단일 세그먼트 내에서 일치하고, `**`는 0개 이상의 전체 세그먼트와 일치해요.
와일드카드가 없는 패턴은 정확한 키 경로를 의미해요.

### URL은 기본적으로 처리돼요

URL 값을 가진 키는 품질 게이트에서 올바른 결과를 얻을 수 없기 때문에, 기본적으로 `noTranslateUrls`는 `true`로 설정되어 있어요. 별도의 설정 없이도 절대 `scheme://` URL로만 이루어진 모든 소스 값은 번역 제외 대상으로 처리돼요.

감지 기준은 의도적으로 엄격하게 적용돼요. 공백을 제거한 전체 값이 오직 URL이어야 해요. 단순히 링크를 포함하고 있는 산문 텍스트(`"Read the paper at https://…"`)는 여전히 정상적으로 번역돼요.

URL이 실제로 로케일별로 고유한 경우(예: 언어별 문서 호스트) `"noTranslateUrls": false`로 이 기능을 끄고, 로케일별이 아닌 URL만 `noTranslate`로 선언하세요.

### 복구 및 강제 적용

번역 제외 키의 경우 타깃 값으로 올바른 결과는 오직 하나뿐이므로 어떠한 차이도 결함으로 간주돼요. Champollion은 양방향 모두에서 이를 강제해요:

- **`sync`가 이를 복구해요.** 타깃이 누락되었거나, `[EN] ` 접두사가 붙었거나, 변경된 번역 제외 키는 소스 값으로 다시 작성돼요. 이는 API 호출 비용이 들지 않으며 멱등성을 지녀요. 값이 일치하게 되면 이후의 동기화에서는 해당 키를 완전히 건너뛰어요.
- **`verify` 및 `integrity`는 이를 감지하고 실패 처리해요.** 변형된 번역 제외 키는 기대값 및 실제값과 함께 `NO-TRANSLATE DRIFT`로 보고돼요. 보이지 않는 문자는 `\uXXXX` 형태로 이스케이프되는데, 그렇지 않으면 diff에서 이러한 손상을 식별할 수 없기 때문이에요. `champollion integrity`는 `1`로 종료되므로, 빌드 파이프라인에 연결해 두면 손상된 URL이 배포되기 전에 잡아낼 수 있어요.

방금 구성한 프로젝트에서 `integrity`가 이러한 이유로 실패한다면, 로케일 파일에 이미 존재하던 손상을 보고하는 것이에요. `champollion sync`를 한 번 실행하여 복구하세요.

## 문자 체계 변환 {#script-conversion}

Champollion이 번역하는 언어 중 일부는 두 가지 이상의 방식으로 *표기*될 수 있어요. 모델은 항상 해당 언어의 **작업용 문자(working script)**(라틴 로마자 표기법 — 플레인스크리어의 경우 SRO, 클링온어의 경우 Okrand 로마자 표기법)로 작동하며, 이후 결정론적 변환기가 출력을 화면 표시용 문자(display script)로 다시 작성할 수 있어요. 변환 여부는 설정에서 직접 결정하며, **결코 기본값으로 처리되지 않아요**:

| 로케일 | 작업용 문자 | 변환 가능 문자 | 유형 |
|--------|------------|---------------|------|
| `crk` (플레인스크리어) | `Latn` (SRO) | `Cans` (음절문자) | 실제 유니코드 — **선택 필수** |
| `sr` / `srp` (세르비아어) | `Latn` | `Cyrl` (키릴 문자) | 실제 유니코드 — **선택 필수** |
| `tlh` (클링온어) | `Latn` (로마자 표기) | `Piqd` (pIqaD) | PUA — 선택적 사용(opt-in) |
| `x-elvish-s` (신다린) | `Latn` | `Teng` (텡과르) | PUA — 선택적 사용(opt-in) |
| `x-kryptonian` | `Latn` | 크립톤어 | PUA — `"script": "x-kryptonian"`를 통한 선택적 사용(opt-in) |

**실제 유니코드 언어쌍(crk, sr)은 선택이 필수예요.** 크리어 음절문자와 키릴 문자는 일반 유니코드이므로 어디서나 렌더링되며, 두 맞춤법 모두 실제로 널리 사용되고 있어요. Champollion은 프로젝트를 대신해 특정 언어 커뮤니티의 문자 체계를 임의로 선택하지 않아요. `init` 실행 시 언어를 선택하면 어떤 문자를 쓸지 질문하며, 설정 파일에 어느 쪽인지 명시될 때까지 `sync`는 실행을 거부해요:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA 문자(tlh, x-elvish-s, x-kryptonian)는 기본적으로 로마자 표기를 사용해요.** pIqaD, 텡과르, 크립톤어는 *유니코드에 포함되어 있지 않아요*. 변환기가 해당 코드포인트에 매핑된 폰트를 함께 제공하지 않는 한 아무것도 렌더링되지 않는 사용자 정의 영역(PUA) 코드포인트를 출력하기 때문이에요. 로마자 표기만이 어디서나 렌더링될 수 있는 유일한 출력이므로 기본값으로 설정되어 있어요. 대신 화면 표시용 문자를 출력하려면 다음과 같이 설정하세요:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…그리고 사이트에서 해당 문자를 그릴 수 있는 폰트를 갖추도록 `champollion fonts install`를 실행하세요. 폰트가 라틴 음역(Latin transliteration)에 맞춰 매핑되어 있다면(많은 인공어 폰트가 그렇습니다) 기본값을 유지하세요.

`script`는 대소문자 구분 없이 ISO 15924 코드를 받아요(`"cans"`, `"Cans"`, `"CANS"`는 모두 동일해요). 언어쌍별로도 설정할 수 있으며, 이 설정이 언어 레벨 설정보다 우선해요. 유효하지 않은 값이거나 해당 로케일이 생성할 수 없는 문자인 경우 API 호출이 이루어지기 전인 시작 시점에 실패해요.

### 매핑되지 않은 문자와 `scriptFallback` {#script-fallback}

변환기는 해당 맞춤법에 정의된 내용만 변환하며 그 외의 것은 변환하지 않아요. 클링온어 로마자 표기에는 `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z`가 없으므로 "GitHub"와 같은 고유명사가 포함된 모델 출력은 완전히 변환될 수 없어요. Champollion은 **절대로 절반만 변환된 값을 쓰지 않아요**. 변환할 수 없는 글자가 하나라도 있으면 전체 값이 작업용 문자로 유지되며, 경고 메시지에 해당 글자들과 이를 매핑할 수 있는 설정 라인이 표시돼요.

해당 매핑은 직접 선언할 수 있어요:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

각 규칙은 변환이 실행되기 전에 작업용 문자 시퀀스를 변환기가 매핑할 수 있는 시퀀스로 대체해요. 규칙은 시작 시점에 유효성 검사를 거치며, 대체 문자 자체가 매핑 불가능한 경우 거부돼요.

Champollion은 **자체적인 대체(fallback) 규칙을 제공하지 않아요**. 특히 실제 언어의 문자 체계에 대해 임의로 맞춤법 적응 방식을 만들어내는 것은 도구가 결정할 일이 아니기 때문이에요. 커뮤니티나 팬덤마다 고유한 관례가 있으므로, 프로젝트별로 신중하게 채택하세요.

### 원치 않는 변환 복구하기 {#repair-script}

0.3.0 이전에는 변환이 무조건적으로 이루어졌기 때문에, PUA 로케일을 타깃으로 하는 프로젝트는 원하든 원치 않든 렌더링할 수 없는 출력을 받게 되었어요. 두 가지 도구가 이 문제를 해결해요:

- **`champollion repair-script`**: 설정에서 변환이 *꺼져(off)* 있는 로케일에서 PUA 코드포인트를 검색하고 변환기 자체의 역변환 테이블을 사용하여 로마자 표기를 복원해요(미리 보려면 `--dry` 사용). pIqaD는 정확히 역변환되며, 텡과르와 크립톤어 역변환은 대소문자 구분이 손실되고 이에 대한 안내가 표시돼요.
- **`champollion integrity`**: 변환이 꺼진 상태에서 PUA가 발견되면 실패 처리(종료 코드 1)해요. 따라서 빌드 게이트에서 렌더링 불가능한 텍스트가 배포되기 전에 잡아내고, 보고서에 복구 방법을 안내해요.

번역 메모리는 복구할 필요가 전혀 없어요. 변환 전 값을 저장하므로 나중에 `script:` 설정을 켜거나 끄더라도 캐시를 별도로 작업할 필요가 없어요.

문자 체계 변환은 UI 문자열(키-값 파일 및 Docusaurus JSON)에 적용돼요. Markdown 본문은 절대로 변환되지 않아요. 문자 단위의 탐욕적 변환기가 코드 범위, URL, 프론트매터를 손상 없이 안전하게 처리할 수 있는 방법이 없기 때문이에요.

## 페어 구성 {#pair-configuration}

각 소스→대상 페어는 독립적으로 구성할 수 있어요:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### 페어 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `method` | `string` | 번역 방식: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | 설치된 플러그인 이름(`.champollion/methods/`에서 제공) |
| `model` | `string` | 이 언어쌍에 대한 기본 모델 재정의 |
| `temperature` | `number` | 이 언어쌍에 대한 기본 temperature 재정의 |
| `batchSize` | `number` | 이 언어쌍에 대한 기본 배치 크기 재정의 |
| `register` | `string` | 말투/어조(Register/tone) 재정의(프리셋 키 또는 자유 형식 텍스트) |
| `endpoint` | `string` | 원격 API 엔드포인트 URL. `method`가 `api`일 때 필수예요. |
| `coachingFile` | `string` | 이 언어쌍의 코칭 프롬프트 파일 경로예요(프로젝트 기준 상대 경로). 덜 구체적인 코칭 설정을 대체하며, 파일을 읽을 수 없으면 실행이 중단돼요. |
| `promptContext` | `string` | 이 언어쌍의 애플리케이션 컨텍스트 |
| `genderGuidance` | `string` \| `false` | 이 언어쌍 프롬프트의 성별 지침: 직접 작성한 텍스트 또는 지침을 쓰지 않으려면 `false`. [성별 지침](#gender-guidance)을 참고하세요. |
| `qualityTier` | `string` | 해당 언어쌍의 출력에 부여하는 레이블: `standard`, `high`, `research`, `verified`. 측정되지 않으며 내용에 관계없이 동기화는 동일하게 번역돼요. `status`에 표시되며(설정된 경우에만), `serve`에서 홍보돼요. |
| `fallback` | `object` | 이 언어쌍의 방식이 안전하게 번역할 수 없을 때 사용할 보조 방식이에요. [대체 방식](#fallback)을 참고하세요. `null`는 언어에 설정된 대체 방식을 제거해요. |

### 대체 방식 {#fallback}

언어쌍은 보조 방식을 지정할 수 있어요. 언어쌍 자체의 방식이 먼저 번역을 수행해요. 안전하게 번역할 수 없는 모든 항목은 대체 방식으로 한 번 전달돼요:

- **키-값 파일:** [품질 게이트](/docs/concepts/quality-gate)가 거부한 키(누락된 `{name}`, 깨진 복수형, 두 단어짜리 라벨이 한 문단으로 늘어난 경우 등) 및 해당 방식이 아무것도 반환하지 않은 키.
- **Markdown(Hugo 콘텐츠 및 Docusaurus 문서):** 누락되었거나 단어가 비워진 프론트매터 필드, 응답에서 누락되거나 손상(보호된 요소인 코드, HTML 태그, 숏코드 유실)되거나 비워진 본문 블록. `page` 세그먼테이션의 경우 페이지 전체.

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

어떤 텍스트도 머신 외부로 유출되어서는 안 되는 환경(병원, 학교, 언어 데이터를 온프레미스로 보관하는 커뮤니티 등)이라면, 직접 실행하는 모델을 대체 방식으로 지정하세요. `local` 방식은 로컬 머신의 OpenAI 호환 서버(Ollama, llama.cpp, vLLM, LM Studio 등)로 요청을 전송해요(`LOCAL_API_BASE`로 주소를 설정하며, [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model) 참고):

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

선택 기준:

- **호스팅 모델**(Gemini 모델을 사용하는 `llm-coached` 또는 기타 API 방식)은 저자원 언어(low-resource language)에 대해 대체로 더 강력한 2차 대안이며, 요청당 비용이 청구돼요. 텍스트를 해당 제공업체로 전송해도 무방할 때 사용하세요.
- **`local`**는 모든 키를 로컬 머신에 유지하며, 비용 예측치에 `$0 API cost (runs on this machine)`로 표시돼요. 실행 가능한 모델의 크기가 더 작더라도 데이터가 머신 외부로 나가선 안 될 때 사용하세요.

대체 방식의 출력도 동일한 품질 게이트를 통과해야 해요. 번역된 내용은 번역 메모리에 해당 방식의 이름으로 캐시되므로, 캐시는 각 값을 어떤 방식이 생성했는지 기록해요. 이후 동기화에서는 첫 번째 방식에 다시 묻지 않고 이 캐시를 재사용해요(`--fresh` 또는 `--retranslate`를 사용하면 다시 요청해요). 두 방식 모두 번역하지 못한 항목은 대체 방식이 없을 때와 동일한 상태로 유지돼요. 키는 번역되지 않은 채 기존 잠금 항목을 유지하므로 다음 동기화에서 재시도되며 `champollion verify`에 나열돼요. Markdown 블록은 `[EN] ` 접두사가 붙은 소스로 작성되어 캐시되지 않으며, 다음 동기화 시 파일이 다시 처리돼요. 품질 게이트가 두 방식 모두에서 거부한 블록이나 프론트매터 필드는 보류(held back)되어, `--redo files:<page>`로 해당 페이지를 명시하기 전까지는 다시 전송되지 않아요([거부된 Markdown 블록 및 프론트매터 필드](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). 두 방식 모두 비워버린 프론트매터 필드나 둘 다 번역하지 못한 페이지는 대체 방식이 없을 때와 마찬가지로 해당 파일을 실패 처리해요.

대체 방식은 언어쌍과 동일한 필드를 지원해요: `method`(필수), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. 언어쌍과 동일한 방식으로 해석돼요. 설정하지 않은 필드(말투, 코칭, 프롬프트 컨텍스트 등)는 해당 언어쌍에서 가져와요. 자체 `coachingFile`는 프롬프트와 캐시 키에 반영되며 `champollion status`에 표시돼요. 문자 체계는 언어쌍에 속하므로 대체 방식에서는 `script` 및 `scriptFallback`가 거부되며, 대체 방식 자체의 `fallback`도 허용되지 않아요. 알 수 없는 방식이거나 언어쌍과 동일한 대체 방식인 경우 해당 언어쌍의 이름을 명시하는 오류와 함께 동기화가 중단돼요. 언어쌍 자체의 방식과 마찬가지로 동기화가 시작되기 전에 대체 방식도 실행 준비가 되어 있어야 해요(예: API 키가 설정되어 있어야 함).

- **`--method` 및 `--model`는 언어쌍 자체의 방식만 변경해요.** 대체 방식은 설정 파일에 지정된 값을 유지해요.
- **비용.** 실행 전 예상 비용은 언어쌍 자체의 방식만 다뤄요. 어떤 항목이 실패할지 미리 알 수 없기 때문이에요. 각 대체 배치는 실행 직전에 동일한 추정기를 통해 비용이 계산돼요. `--max-cost` 사용 시, 실행 비용이 한도(예상 비용 + 지금까지의 모든 대체 배치 비용)를 초과하게 만드는 배치는 건너뛰며 해당 키를 명시하는 경고를 출력해요. 비용을 추정할 수 없는 대체 방식(알 수 없다고 해서 무료는 아님)도 마찬가지예요. 이러한 키는 실패 상태로 유지되며, 동기화는 다른 부분 실패와 마찬가지로 0이 아닌 종료 코드로 종료돼요.
- **보고.** `sync`는 언어쌍당 한 줄씩 출력해요(예: `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`). `--json` 요약은 언어쌍별로 대체 방식이 수행한 작업(`method`, `attempted`, `accepted`, `failed`, `cached`)을 안내해요: 키-값 파일의 경우 `locales`의 각 항목, Docusaurus JSON의 경우 `fallback`, Markdown의 경우 `content.fallback`에 표시돼요. `champollion status`는 해당 언어쌍 아래에 대체 방식을 표시해요. `--dry`는 무엇이 실패할지 알 수 없으므로 대체 방식에 대해서는 아무것도 보고하지 않아요.
- **대체 방식이 대부분을 작성한 경우.** 특정 언어쌍에 대한 신규 번역(언어쌍 방식이 수용한 응답 + 대체 방식의 응답) 중 절반 이상이 대체 방식에서 나온 경우, `sync`는 경고 하나를 추가해요: 전체 중 몇 개인지, 어떤 방식과 모델인지, 언어쌍 방식의 응답이 사용되지 않은 이유(서로 다른 소스 문자열에 대해 암기된 문장이 반복됨, 길이 팽창 등 각 이유별 집계), 고려해야 할 사항(언어쌍의 방식이 이 문자열에 적합하지 않을 수 있음, 작성된 내용 확인(`verify`는 구조를 확인하고, 원어민/화자가 의미를 확인), 더 강력한 대체 방식 사용 등). `--json` 항목에는 `accepted` 옆에 `primaryAccepted` 및 `primaryReasons`가 포함돼요. `champollion status`는 파일에 대해서도 동일한 비율을 제공하며("from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)"), 로케일 텍스트의 대부분을 차지할 때 이를 안내해요.
- `champollion serve`도 `--max-cost-per-request` / `--max-session-cost` 한도 내에서 대체 방식을 사용해요.

## 언어 구성 {#language-configuration}

언어는 세 가지 형식을 허용해요:

### 코드 배열 (가장 간단)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

각 언어는 내장 레지스터 테이블에서 기본 레지스터를 받아요. 기본값이 없는 언어는 `"Professional register."`을 받아요.

### 레지스터 문자열이 있는 객체

값은 언어 카드의 **프리셋 키**이거나 사용자 지정 레지스터 텍스트일 수 있어요:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion은 문자열이 언어 카드의 프리셋 키와 일치하는지 확인해요. 일치하면 카드의 전체 레지스터 프롬프트가 사용돼요. 그렇지 않으면 문자열이 그대로 사용돼요. 사용 가능한 프리셋은 [지원 언어](/docs/reference/supported-languages#language-cards)를 참조하세요.

### 전체 구성이 있는 객체

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

같은 블록에서 축약형과 전체 객체를 혼합할 수 있어요.


### 언어 필드

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `register` | `string` | 스타일/어조 지침이에요. **프리셋 키**(예: `casual-tu`, `formal-hapsyo`) 또는 사용자 지정 텍스트일 수 있어요. [언어 카드](/docs/reference/supported-languages#language-cards)를 참고하세요. |
| `name` | `string` | 사람이 읽을 수 있는 언어 이름(상태 표시에 사용) |
| `model` | `string` | 기본 모델 재정의 |
| `temperature` | `number` | 기본 temperature 재정의 |
| `batchSize` | `number` | 기본 배치 크기 재정의 |
| `coachingFile` | `string` | 이 언어의 코칭 프롬프트 파일 경로예요(프로젝트 기준 상대 경로). 최상위 코칭 설정을 대체하며, 파일을 읽을 수 없으면 실행이 중단돼요. |
| `promptContext` | `string` | 이 언어의 애플리케이션 컨텍스트 |
| `genderGuidance` | `string` \| `false` | 이 언어 프롬프트의 성별 지침: 직접 작성한 텍스트 또는 지침을 쓰지 않으려면 `false`. [성별 지침](#gender-guidance)을 참고하세요. |
| `maxRetries` | `number` | 실패한 배치에 대한 최대 재시도 횟수(기본값: 3) |
| `script` | `string` | Champollion이 작성하는 맞춤법의 ISO 15924 코드(예: `"Cans"`, `"Piqd"`). [문자 체계 변환](#script-conversion)을 참고하세요. |
| `scriptFallback` | `object` | 문자 체계 변환기가 매핑할 수 없는 글자에 대한 음역(transliteration) 규칙이에요. [문자 체계 변환](#script-conversion)을 참고하세요. |
| `endpoint` | `string` | `"method": "api"`용 원격 API 엔드포인트 URL |
| `fallback` | `object` | 이 언어의 방식이 안전하게 번역할 수 없을 때 사용할 보조 방식이에요. [대체 방식](#fallback)을 참고하세요. |

:::info[상속 체인]
설정은 다음 순서로 해석돼요 (먼저 오는 것이 우선):

**페어 수준** → **언어 수준** → **전역 구성** → **기본값**

예를 들어, `pairs["en:fr"]`이 `model`을 설정하면, 언어 수준과 전역 `model` 값을 모두 재정의해요.
:::

### 성별 지침 {#gender-guidance}

문법적 성별이 있는 언어의 경우 LLM 프롬프트에 성별 지침이 포함돼요. 이 지침은 Champollion 카탈로그에서 가져와요: 프랑스어는 독자의 성별을 알 수 없을 때 가운뎃점을 사용하는 *포용적 표기법(écriture inclusive)*을 요청하고(`Connecté(e)`나 `Connectée` 대신 `Connecté·e`, 복수형은 `Utilisateur·rice·s`), 독일어는 콜론 형식(`Benutzer:innen`), 일본어는 중립적인 `私`를 요청해요. `champollion init`는 각 언어의 어조 옆에 이를 출력하며, `champollion status`는 언어쌍별로 해당 지침과 그 출처를 표시해요.

모든 언어 또는 특정 언어에 대해 `genderGuidance`로 다른 스타일을 선택하세요:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false`는 성별 지침을 보내지 않으며, 문자열을 전달하면 카탈로그의 지침을 대체해요. 이 설정은 지침을 받는 방식(LLM 방식)에 적용되며, 기계 번역 엔진(DeepL, Google 등)에는 전달되지 않아요. 변경된 성별 지침은 서로 다른 프롬프트가 되므로 별도의 캐시 항목을 가져요. 따라서 이미 번역된 내용은 다시 번역하기 전까지 그대로 유지돼요(파일에 이전 스타일이 남아 있을 경우 동기화 시 `champollion sync --redo all` 실행을 제안해요).

## 영어가 아닌 소스

소스 언어가 영어가 아닌 경우:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## 잠금 파일

Champollion은 번역된 소스 값의 SHA-256 해시를 추적하기 위해 `.champollion.lock`를 생성해요. 모든 개발자가 동일한 번역 기준점을 공유할 수 있도록 **이 파일을 커밋하세요**. 언어당 하나의 폴더를 사용하는 프로젝트에서는 키가 `<namespace>::<key>` 형식으로 기록돼요.

타깃 로케일별로 잠금 파일은 동기화가 작성한 각 값과 번역한 소스 텍스트의 핑거프린트(사람이 수정한 값을 인식하고 오래된 번역을 보고할 수 있도록 함), 재실행(redo)이 완료하지 못한 키(**pending**), 품질 게이트가 거부한 키(동일한 모델에 대해 **held back**)도 기록해요. 이러한 내용을 하나라도 기록해야 하면 파일은 버전 2 형식인 `{"version": 2, "source": {…}, "locales": {…}}`가 되며, 버전 1 잠금 파일(단순 키 → 해시 맵)은 기존대로 읽혀요. 대체된 수동 편집 내용은 바로 옆의 `.champollion-replaced-edits.jsonl`에 보관되므로 두 파일 모두 커밋하세요. [품질 게이트](/docs/concepts/quality-gate#refused-keys-are-held-back) 및 [번역 편집하기](/docs/guides/professional-translators#editing-key-value-files)를 참고하세요.

소스 값이 변경되면 해시가 더 이상 일치하지 않으며, champollion은 다음 동기화 시 해당 키를 다시 번역해요.

## `.champollionignore`

`lint` 스캔에서 파일을 제외하려면 프로젝트 루트에 `.champollionignore`을 생성하세요. `.gitignore`처럼 glob 패턴을 사용해요:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` 디렉터리

Champollion은 내부 상태를 위해 프로젝트 루트에 `.champollion/` 디렉터리를 생성해요. 이는 프로젝트 소스가 아니라 머신별 로컬 캐시이므로 버전 관리에서 제외하세요. `champollion init`는 `.gitignore`에 다음 줄을 추가하며, 파일이 없으면 새로 생성해요(아직 git 저장소가 아닌 폴더에서도 생성하므로 이후 `git init` 및 `git add --all` 실행 시 캐시가 커밋되지 않도록 방지해요):

```gitignore
.champollion/
```

그 옆에 있는 잠금 파일들(`.champollion.lock`, `.champollion-content.lock`)은 커밋하세요. 각 번역이 어떤 소스 텍스트로부터 만들어졌는지를 기록하기 때문이에요.

| 파일 | 용도 | 커밋 여부 |
|------|------|----------|
| `tm.json` | 번역 메모리 캐시 — 소스 텍스트 + 로케일 + 방식을 키로 이전 번역을 저장함 | 아니요 (로컬 캐시) |
| `xliff/*.xliff` | 전문 번역가 검토를 위한 XLIFF 내보내기 파일 | 아니요 (임시 파일) |
| `methods/` | 설치된 방식 플러그인 매니페스트 | `.champollion/` 라인에 의해 무시됨. 설치된 플러그인을 공유하려면 해당 라인을 `.champollion/*` 및 `!.champollion/methods/`로 대체하세요 |
| `backups/` | 줄바꿈 전 백업(`wrap --undo`에 의해 생성됨) | 아니요 (안전망) |

`tm.json`과 그것이 API 비용을 절감하는 방법에 대한 자세한 내용은 [번역 메모리](/docs/concepts/translation-memory)를 참조하세요.

---

## 프로그래밍 방식 API

빌드 스크립트 및 사용자 지정 통합을 위해 패키지에서 직접 임포트하세요:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### 사용 가능한 익스포트

| 내보내기(Export) | 역할 |
|-----------------|------|
| `TranslationMethod` | 모든 방식의 기본 클래스 |
| `LLMMethod` | LLM 방식(OpenRouter)의 기본 클래스 |
| `DirectLLMMethod` | 직접 LLM 제공업체(OpenAI, Anthropic, Gemini)의 기본 클래스 |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | 직접 LLM 제공업체 클래스 |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | 기존 MT 클래스 |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | 코칭된 LLM(OpenRouter + 코칭 데이터) |
| `APIMethod` | 원격 API 클라이언트 |
| `runSync`, `runContentSync` | 전체 동기화 파이프라인 |
| `translateWithFallback`, `translateAndValidate` | `sync`가 실행하는 키 배치에 대한 단일 언어쌍 파이프라인: 캐시, 방식, 품질 게이트, 캐시, 그리고 해당 언어쌍의 대체 방식 순으로 실행. `resolvePairs`의 언어쌍, `loadTM`의 `tm`, 프로젝트 디렉터리인 `cwd`를 전달: 방식은 키, 엔드포인트, 코칭, 용어집을 `process.cwd()`가 아니라 여기에서 읽음 |
| `createFallbackBudget` | 대체 배치를 위한 `--max-cost` 가드(`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | 각 로케일을 구성하는 파일(단일 파일, 로케일당 폴더, 또는 `localesPattern`) |
| `resolveConfig`, `resolvePairs` | 설정 해석 |
| `validateTranslations` | 품질 게이트 |
| `loadCoachingData`, `findDictionaryMatches` | 코칭 유틸리티 |

### 사용자 지정 제공자 확장

`DirectLLMMethod`을 확장하여 약 40줄로 새로운 LLM 제공자를 추가하세요:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

translate, 코칭, 재시도 루프, 모델 검증, 품질 등급, 설정 도움말을 무료로 얻을 수 있어요. 제공자별로 다른 것은 HTTP 요청 형태뿐이에요. 원시 `fetch()`을 사용하는 비-LLM 어댑터의 경우, 직접 재시도 루프를 작성하는 대신 `lib/methods/fetch-with-retry.js`의 공유 `fetchWithRetry()` 헬퍼를 사용하세요.

---

## 참고 항목

- [CLI 레퍼런스](/docs/reference/cli) — 모든 명령과 플래그
- [번역 방식](/docs/guides/translation-methods) — 방식 선택 및 혼합
- [번역 메모리](/docs/concepts/translation-memory) — 캐싱 및 비용 절감
- [전문 번역가와 작업하기](/docs/guides/professional-translators) — XLIFF 워크플로
- [플러그인 사양](/docs/reference/plugin-spec) — 방식 플러그인 매니페스트 형식
- [아키텍처](/docs/concepts/architecture) — 각 부분이 어떻게 연결되는지
- [지원 언어](/docs/reference/supported-languages) — 내장 언어 지원
- [동기화 작동 방식](/docs/concepts/how-sync-works) — 번역 파이프라인
