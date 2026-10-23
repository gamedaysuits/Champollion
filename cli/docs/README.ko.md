# Champollion

[![npm 버전](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![라이선스: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**안전장치가 마련된 레일 위에서.** 자원이 부족한 언어와 원주민 언어 커뮤니티를 염두에 두고 구축된, 레일 위에서의 기계 번역 개발 및 배포 도구입니다. 이 CLI는 프로젝트 및 배포 레이어 역할을 해요.

내 컴퓨터에서 **특정 언어를 위한 모델을 빌드**해 보세요:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

표준 코드가 없는 언어는 사용자 정의(private-use) 코드와 해당 언어의 고유한 이름을 사용해요:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(`qaa`부터 `qtz` 사이의 모든 코드).

`champollion new`는 모든 것이 제자리에 있는 프로젝트를 시작해요. `champollion next`은 커뮤니티가 보관하는 파일(스프레드시트, Word 표, Toolbox 또는 LIFT 사전, ELAN 전사 자료)에서부터 측정된 모델을 거쳐 앱에 적용하기까지의 다음 단계를 알려줘요. 각 단계는 누가 결정권자인지 명시해요. 언어를 보유한 사람들이 문장이 어디로 갈지, 무엇을 배포할지 결정해요. AI 에이전트도 [MCP 서버](https://www.npmjs.com/package/champollion-mcp-server)를 통해 동일한 단계를 밟을 수 있어요. 이 레일은 품질이 아닌 프로세스를 보장해요. 모델이 무조건 좋다는 것이 아니라, 모델이 얼마나 좋은지 알 수 있게 해줘요. 첫 번째 소규모 커뮤니티 모델은 보통 측정된 형태의 회화집(phrasebook)이에요. [champollion.dev/start](https://champollion.dev/start)에서 시작해 보세요.

명령어 하나로 **앱의 로케일 파일을 번역**해 보세요:

```bash
npx champollion sync
```

Champollion은 로케일 파일, 파일 형식, 대상 언어를 자동으로 감지해요. 누락된 키를 번역하고, 이미 완료된 항목은 건너뛰며, 호스팅된 엔진이나 직접 빌드하고 서빙하는 모델(`champollion connect`)을 통해 결과를 작성해요.

**라이선스:** [PolyForm Noncommercial License 1.0.0](../LICENSE)에 따라 소스가 공개(source-available)되며, 비상업적 목적(개인 프로젝트, 연구, 교육, 자선 단체, 학교 및 공공 기관의 사용)으로는 자유롭게 사용, 변경 및 공유할 수 있어요. 상업적 목적으로 사용하는 것은 이 라이선스에 포함되지 않아요. 평가 하네스(evaluation harness)는 오픈 소스(AGPL-3.0-or-later)예요. [누가 사용할 수 있나요](https://champollion.dev/docs/getting-started/who-may-use-this) · [상세 정보](#license).

## 왜 직접 스크립트를 작성하지 않나요?

영어 키를 반복하며 Google Translate를 호출하는 간단한 스크립트를 작성할 수도 있어요. 대부분의 개발자가 그렇게 하며, 약 30줄이면 충분해요. 하지만 이 방식이 실패하는 이유는 다음과 같아요:

- **변경 사항 감지 불가.** 영어 문자열을 업데이트해도 번역은 영원히 과거 상태로 남아 있어요. Champollion은 SHA-256 해시로 모든 원본 값을 추적하고 변경된 내용만 다시 번역해요.
- **일괄 처리(Batching) 불가.** 키당 한 번의 API 호출은 200개의 키 = 200번의 왕복을 의미해요. Champollion은 지능적으로 일괄 처리해요(설정 가능, 기본값은 LLM의 경우 배치당 80개 키, Google의 경우 128개).
- **품질 게이트 부재.** 기계 번역은 환각(hallucination)을 일으키거나, 원본을 그대로 반환하거나, 잘못된 문자로 출력할 수 있어요. Champollion은 작성하기 전에 모든 번역을 검사해요. 빈 출력, 원본 반복, 반복 루프, 길이 팽창, 삭제된 콘텐츠 및 잘못된 문자를 포착하고 거부해요. 이 게이트는 잘못된 의미가 아니라 망가진 출력을 잡아내요.
- **형식 인식 불가.** JSON으로 하드코딩되어 있나요? Champollion은 자동 감지를 통해 JSON, TOML, YAML 및 Hugo Markdown(프런트매터 + 본문)을 처리해요.
- **안전성 부재.** Champollion은 프로토타입 오염, 조작된 로케일 코드를 통한 경로 탐색(path traversal), Markdown 번역 중 코드 블록 손상을 방지해요.

Champollion은 그 스크립트의 프로덕션 버전이에요.

> [!NOTE]
> **Champollion이 번역하는 대상.** Champollion은 JSON 키-값 쌍, TOML/YAML 구성, Hugo Markdown 페이지, XLIFF 교환 문서 등 **로케일 파일과 구조화된 콘텐츠**를 대상으로 해요. UI 문자열, 문서, 공식 커뮤니케이션, 교육 자료와 같은 공식적인 서면 텍스트에 최적화되어 있어요. 챗봇이나 실시간 음성 번역기, 범용 대화형 AI가 아니에요. 상용 API(Google Translate, DeepL)부터 커뮤니티에서 개발한 플러그인, 공개 벤치마크, 레일 위에서 직접 훈련하고 서빙하는 모델에 이르기까지 각 언어 쌍에 대해 번역 방법을 설정할 수 있어요.

## 빠른 시작

```bash
npm install --save-dev champollion
```

### API 키 발급받기

Champollion에는 번역 백엔드가 필요해요. 하나를 선택해 주세요:

| 제공자(Provider) | 키(Key) | 추천 대상(Best for) |
|----------|-----|----------|
| **OpenRouter** (권장) | `OPENROUTER_API_KEY` | 콘텐츠가 많은 프로젝트, Markdown, 200개 이상의 모델 |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o 직접 액세스 |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 직접 액세스 |
| **Gemini** | `GEMINI_API_KEY` | 무료 티어 사용 가능 |
| **DeepL** | `DEEPL_API_KEY` | 유럽어, 용어집(glossary) 지원 |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130개 이상의 언어, 대용량 처리 |

**가장 빠른 시작** (무료): [aistudio.google.com](https://aistudio.google.com/apikey)에 가입하여 무료 Gemini 키를 받으세요:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200개 이상의 모델): [openrouter.ai](https://openrouter.ai)에 가입한 후 다음을 실행하세요:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate** 대안 (키-값 쌍 전용 — Markdown 인식 불가):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **참고**: `GOOGLE_TRANSLATE_API_KEY`만 설정된 경우, champollion은 자동으로 Google Translate로 전환해요. 구성을 변경할 필요가 없어요. SDK, 서비스 계정, `pip install` 없이 REST API를 직접 사용해요. 키만 있으면 돼요.

이게 전부예요. 더 세밀하게 제어하려면 구성 파일을 생성하세요:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

각 언어에는 해당 언어 체계에 맞게 조정된 사전 구축된 어조/격식 지침인 **레지스터 프리셋(register presets)**이 제공돼요(프랑스어의 vouvoiement, 독일어의 Siezen, 일본어의 です/ます, 한국어의 해요체). 초기화 마법사를 통해 프리셋을 찾아보고 선택하거나, `--yes`를 전달하여 기본값을 수락할 수 있어요.

### 영어가 아닌 원본

원본 언어가 영어가 아닌 경우:

```bash
champollion sync --source fr                      # CLI flag
```

또는 구성 파일에 영구적으로 설정하세요:

```json
{ "inputLocale": "fr" }
```

## 주요 기능

i18n 프레임워크(next-intl, i18next, Hugo)는 여러분이 다루세요. 번역 파일은 Champollion이 처리할게요.

- **다중 형식 지원** — JSON, TOML, YAML, Hugo Markdown(프런트매터 + 본문) 및 XLIFF 1.2
- **증분 번역** — 변경된 내용만 번역해요(SHA-256 해시 추적).
- **캐싱** — 번역 메모리(Translation Memory)가 이전 결과를 저장해요. 변경되지 않은 키에 대해 동기화를 다시 실행해도 비용이 발생하지 않아요.
- **품질 게이트** — 반복 루프, 잘못된 문자 출력, 원본 반복, 길이 팽창 및 삭제된 콘텐츠 등 망가진 출력이 있는지 모든 번역을 검사해요(의미는 검사하지 않아요).
- **콘텐츠 인식** — LLM 방식은 Markdown 번역 중 코드 블록, 숏코드, 링크 및 보간(interpolation) 변수를 보호해요.
- **파이프라인 도구** — CI 게이트를 위한 `lint`, `audit`, `integrity`, `seo`
- **XLIFF 상호 운용성** — CAT 도구(memoQ, SDL Trados, Phrase)에서 전문가 검토를 위해 번역을 내보내고 다시 가져올 수 있어요.
- **최소한의 종속성** — 런타임 종속성은 `@translated/lara`(Lara 제공자 SDK)와 `cree-sro-syllabics`(ALTLab/NRC의 Plains Cree SRO ⇄ 음절 문자 변환기) 두 가지뿐이에요. Node 20 이상이 필요해요.

## Google Translate 그 이상

빠른 시작을 통해 LLM이나 Google Translate로 실행할 수 있어요. 하지만 Google Translate는 약 130개의 언어만 지원해요. 전 세계에는 7,000개가 넘는 언어가 있어요.

**Champollion의 핵심 아이디어: 언어 쌍마다 번역 방법을 설정할 수 있어요.** 프랑스어에는 Google Translate를, Plains Cree어에는 자체 문법 노트와 사전으로 코칭된 LLM을, 어떤 서비스도 지원하지 않는 언어에는 직접 호스팅하는 API를 사용해 보세요. 이 모든 것을 동일한 프로젝트에서, 동일한 CLI로 수행할 수 있어요.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

프롬프트 엔지니어링, 커뮤니티 사전, FST 파이프라인 또는 미세 조정된 모델을 통해 언어 쌍을 번역하는 방법을 찾을 수 있다면, champollion을 사용하여 해당 방법을 플러그인으로 패키징하고 다른 모든 것과 함께 배포할 수 있어요.

> 기성 API가 존재하지 않는 Plains Cree어로 프로덕션 웹사이트를 번역하는 과정에서 탄생했어요. 언어 쌍별 아키텍처는 이론적인 것이 아니에요. 한 프로젝트에서 프랑스어를 위한 Google Translate와 원주민 언어를 위한 코칭된 FST 파이프라인이 동일한 동기화 명령 내에서 나란히 실행되어야 했기 때문에 만들어졌어요.

함께 제공되는 [MT 평가 하네스(MT Eval Harness)](https://github.com/gamedaysuits/Champollion)를 사용하면 번역 방식을 벤치마킹하고 비교한 다음, 작동하는 방식을 champollion 플러그인으로 내보낼 수 있어요. 두 언어를 모두 구사하는 사람이라면 누구나 독점 플랫폼 없이도 번역 방법을 개발, 테스트 및 공유할 수 있어요.

### 방법 선택하기

Champollion은 10가지 번역 방법을 지원해요. 각 언어 쌍은 서로 다른 방법을 사용할 수 있어요.

**LLM 제공자** — 품질이 가장 좋고, Markdown을 인식하며, 코칭과 호환돼요:

| 방법(Method) | 키(Key) | 기능(What It Does) |
|--------|-----|-------------|
| `llm` (기본값) | `OPENROUTER_API_KEY` | OpenRouter를 통한 LLM — 200개 이상의 모델, 자동 라우팅 |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + 문법 규칙, 사전, 스타일 노트 |
| `openai` | `OPENAI_API_KEY` | OpenAI API 직접 호출 (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic API 직접 호출 (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini API 직접 호출 (Flash, Pro) — 무료 티어 사용 가능 |
| `local` | *(없음)* | OpenAI 호환 엔드포인트 뒤에 있는 자체 모델(Ollama, vLLM, LM Studio, `nmt-forge`로 훈련된 모델). Ollama의 기본값이 아닌 경우 `LOCAL_API_BASE`를 설정하세요. 텍스트가 인프라 외부로 유출되지 않아요 |

**전통적인 기계 번역(Traditional MT)** — 속도, 비용 및 대용량 키-값 쌍에 가장 적합해요:

| 방법(Method) | 키(Key) | 기능(What It Does) |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130개 이상의 언어) |
| `deepl` | `DEEPL_API_KEY` | 용어집을 지원하는 DeepL API (30개 이상의 언어) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100개 이상의 언어) |
| `libretranslate` | *(자체 호스팅)* | 자체 호스팅 LibreTranslate (AGPL, 무료) |

**인프라** — 사용자 정의 또는 커뮤니티 호스팅 엔드포인트용:

| 방법(Method) | 키(Key) | 기능(What It Does) |
|--------|-----|-------------|
| `api` | *(제공자별)* | 모든 REST 엔드포인트를 위한 씬(thin) HTTP 클라이언트 |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **참고**: 전통적인 기계 번역 방식(Google Translate, DeepL, Microsoft Translator, LibreTranslate)은 키-값 쌍을 잘 처리하지만 Markdown 콘텐츠를 안전하게 번역할 수는 없어요. 콘텐츠가 많은 프로젝트의 경우 LLM 방식을 권장해요. 이 방식은 코드 블록, 숏코드 및 보간 변수를 명시적으로 보호해요.

## 플러그인

플러그인은 특정 언어 쌍을 위해 미리 패키징된 번역 레시피예요. 코드가 아닌 JSON 매니페스트(manifest)로, champollion에게 어떤 방법을 어떤 설정으로 사용할지, 그리고 어떤 품질이 벤치마킹되었는지 알려줘요.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

매니페스트 형식은 [참조 문서](https://champollion.dev/docs/reference/plugin-spec)를 확인하세요.

## 명령어

| 명령어(Command) | 목적(Purpose) |
|---------|---------|
| `init` | 대화형 설정 마법사 (또는 빠른 기본값을 위한 `--yes`) |
| `sync` | 모든 로케일 파일 번역 및 동기화 |
| `serve` | HTTP를 통해 이 프로젝트의 번역 스택 서빙 (api-method 계약) |
| `watch` | 파일 변경 시 자동 동기화 |
| `audit` | 불완전한 로케일 플래그 지정 (CI 게이트) |
| `lint` | 소스 코드에서 하드코딩된 문자열 찾기 |
| `status` | 쌍 구성, 방법, 레지스터 및 플러그인 벤치마크 표시 |
| `provenance` | 번역 리소스 라이선스 감사 |
| `wrap` | 하드코딩된 문자열을 `t()` 호출로 자동 래핑 (실행 취소 포함) |
| `seo` | hreflang, sitemap.xml 또는 JSON-LD 스키마 생성 |
| `integrity` | 자리 표시자(placeholder) 손상, 인코딩 및 ICU 복수형 완전성 확인 |
| `plugin` | 방법 플러그인 설치, 제거 또는 목록 표시 |
| `fonts` | PUA 문자 변환기용 웹 폰트 다운로드 |
| `tm` | 번역 메모리 캐시 관리 (통계, 지우기, 시드, 정리) |
| `xliff` | 전문 번역가 검토를 위한 XLIFF 1.2 내보내기/가져오기 |
| `models` | 제공자(`--method gemini`)의 사용 가능한 모델 목록 표시 |
| `verify` | 작성된 로케일 파일을 다시 읽고 번역이 존재하며 올바른지 확인 (CI 게이트) |
| `doctor` | 시스템 상태 확인: 카드, 구성, 방법 및 변환기 |

프로젝트가 아닌 공유 인덱스 및 리더보드와 작동하는 명령어는 `champollion network` 아래에 그룹화되어 있어요(각각 접두사 없이도 작동해요):

| 명령어(Command) | 목적(Purpose) |
|---------|---------|
| `network card` | 언어 카드 예쁘게 출력 (원시 데이터는 `network card <code>`, `--json`) |
| `network recommend` | 쌍에 대한 방법 안내 — 가용성 + 인용된 증거 (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | 기계 번역(MT) 리더보드 표시 (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | 평가 말뭉치(corpus) 등록: 라이선스 + 노출 티어(로컬 전용/비공개/공개/봉인) 선택 |
| `network seal-corpus` | 봉인된 티어(Sealed-tier) 암호화 동사: `keygen` / `seal` / `open` (주최자-노드 브리지) |
| `network submit` | 인덱스 항목 제안 (검토 필요) — 미리 채워진 GitHub 이슈 출력 |

명령어에 대한 자세한 도움말을 보려면 `champollion <command> --help`을 실행하세요.

전체 참조: [참조 문서](https://champollion.dev/docs/reference/cli)

### Pre-commit 게이트

`champollion lint`은 커밋 게이트로 구축되었어요. 하드코딩된 사용자 대면 문자열을 찾으면 `1`로 종료하고, 깨끗하면 `0`으로 종료해요(`--warn-only`는 차단하지 않고 보고만 해요). 프로젝트의 추적되는 훅(hooks) 디렉터리에 연결해 보세요:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

또는 소스 파일이 스테이징될 때만 실행되도록 [lint-staged](https://github.com/lint-staged/lint-staged)에서 트리거하세요:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

`champollion sync`는 pre-commit에서 제외하세요. 네트워크 API 호출을 수행하므로 기껏해야 느려지고, 최악의 경우 오프라인 상태에서 커밋을 차단해요. 대신 CI나 pre-push 훅에서 실행하고, `champollion audit` / `champollion verify`을 게이트로 사용하세요.

## 구성

`champollion.config.json`을 생성하거나 `champollion init`를 실행하세요:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| 옵션(Option) | 기본값(Default) | 설명(Description) |
|--------|---------|-------------|
| `inputLocale` | `"en"` | 원본 언어 코드 |
| `localesDir` | `"./locales"` | 로케일 파일 경로: 언어당 하나의 파일(`fr.json`) 또는 언어당 하나의 폴더(`fr/common.json`, i18next) |
| `localesPattern` | `null` | 기타 레이아웃, 예: `"src/i18n/{ns}/{lang}.json"` (`localesDir`를 대체함) |
| `contentDir` | `null` | 번역할 Markdown/MDX 폴더(Hugo `content/` 또는 임의의 폴더). 각 번역은 원본 옆에 `<name>.<locale>.md` 형식으로 작성됨 |
| `format` | `"auto"` | 파일 형식: `json`, `toml`, `yaml` 또는 `auto` |
| `model` | `"google/gemini-3.8-flash"` | 기본 모델(OpenRouter 슬러그). 직접 제공자는 런타임에 자체 기본값을 확인해요. 사용 가능한 모델을 찾으려면 `champollion models --method gemini`를 실행하세요. |
| `defaultMethod` | `"llm"` | 기본 번역 방법 (`--method` 플래그로 재정의됨) |
| `batchSize` | `80` | 번역 배치당 키 수 |
| `pairs` | `{}` | 쌍별 방법, 모델 및 품질 재정의 |

**언어별 재정의**: 각 언어에는 [언어 카드(Language Card)](https://champollion.dev/docs/reference/language-card-spec)가 있어요. 이는 레지스터 프리셋, 격식 체계, 타이포그래피 규칙 및 방법 지원 플래그를 포함하는 50개의 큐레이션된 카드 중 하나예요. 카드는 대규모 성능을 위해 [2계층 아키텍처](https://champollion.dev/docs/agents/rails-model)(런타임 + 참조)를 사용해요. `node scripts/generate-language-card.mjs <code>`으로 새 카드의 스캐폴딩을 생성하세요. 프리셋 키를 약어로 사용하거나 사용자 정의 레지스터 텍스트를 작성하세요:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
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

**무설정(Zero-config) 모드**: 구성 파일이 없나요? Champollion은 프로젝트에서 로케일 파일, 형식 및 대상 언어를 자동으로 감지해요.

언어 값은 프리셋 키(예: `"casual-tu"`), 사용자 정의 레지스터 텍스트 또는 객체(전체 제어)일 수 있어요. `pairs`의 쌍 수준 재정의가 언어 수준 설정보다 우선해요. 각 언어에 사용 가능한 프리셋을 찾아보려면 `npx champollion init`을 실행하세요.

프레임워크별 설정 세부 정보는 [CLI 참조](https://champollion.dev/docs/reference/cli)를 확인하세요.

## CLI 출력

`sync`를 실행하면 champollion이 정확히 무슨 일이 일어나고 있는지 보여줘요:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

예상치의 마지막 줄에는 각 수치가 책정된 요율, 출처 및 시기가 명시돼요(자세한 내용은 `--json`에 있어요). "Translating …"은 무언가를 전송할 때만 표시돼요. 예행연습(dry run)이거나 전송할 내용이 없는 실행의 경우 대신 로케일을 확인 중이라고 표시해요. 진행률 표시줄은 각 배치가 완료될 때마다 제자리에서 업데이트돼요(업데이트당 약 80개 키). `contentDir`이 설정된 경우, 동기화는 폴더 이름과 번역이 저장될 위치를 명시해요. 실제 Hugo 사이트(`hugo.toml`, Hugo 설정이 있는 `config.toml`, `archetypes/` 등)를 찾았을 때만 `Detected framework: Hugo`이라고 표시해요. 형식 감지는 형식이 어떻게 확인되었는지 명확히 하기 위해 `(auto)`과 `(config)`를 구분해요.

**출력 모드**: `--quiet`은 정보성 출력을 억제해요(오류 및 경고만 표시). `--json`는 CI/CD 파이프라인을 위해 기계가 읽을 수 있는 NDJSON을 내보내요.

## 보안 강화(Hardening)

- **지수 백오프(Exponential backoff)** — 429/5xx 오류 발생 시 지터(jitter)와 함께 3회 재시도해요.
- **30초 요청 시간 초과** — AbortController가 무한 대기(hanging)를 방지해요.
- **응답 유효성 검사** — 번역을 위해 전송된 키만 수락해요.
- **품질 게이트** — 환각 루프, 잘못된 문자 출력, 길이 팽창 및 원본 반복을 포착해요.
- **재시도 캐스케이드(Retry cascade)** — JSON 파싱 실패 시 배치 → 절반 배치 → 개별 키 순으로 재시도해요(`maxRetries`를 통해 예산 제한).
- **번역 메모리** — `.champollion/tm.json`는 원본 텍스트 + 로케일 + 방법을 키로 사용하여 번역을 캐시해요. 변경되지 않은 키는 후속 동기화 시 캐시에서 제공되어 불필요한 API 호출을 제거해요.
- **프롬프트 캐싱** — 시스템/사용자 메시지 분리를 통해 제공자 수준의 캐싱을 활성화하여 배치 전반에 걸쳐 토큰 비용을 줄여요.
- **용어 적용** — 코칭된 번역은 LLM이 응답한 후 사전 용어와 대조하여 검증돼요.
- **프로토타입 오염 방지** — `__proto__`, `constructor`, `prototype`를 차단해요.
- **경로 격리(Path containment)** — 파일 쓰기가 구성된 디렉터리 내에 머물도록 검증돼요.
- **블록 보호** — 콘텐츠 번역 중 코드 블록, 숏코드, HTML을 보호해요.
- **Fail-loud 아키텍처** — 번역 실패 시 항상 조치 가능한 오류 메시지와 함께 예외를 발생시키며, 절대 조용히 쓰레기 값을 쓰지 않아요.
- **동기화 후 검증** — `verify` 명령어는 작성된 파일을 다시 읽고 번역이 존재하며, 올바른 문자이고, 자리 표시자가 온전한지 확인해요.
- **부분 성공** — 하나의 배치가 실패해도 나머지 배치를 차단하지 않아요.

## 테스트

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**최소한의 종속성** — 위 내용을 참조하세요.

## 라이선스

PolyForm Noncommercial 1.0.0. Champollion CLI는 소스가 공개(source-available)되어 있으며, [PolyForm Noncommercial License 1.0.0](../LICENSE)에 따라 비상업적 목적(연구, 교육, 커뮤니티 작업)으로 자유롭게 설치, 사용 및 수정할 수 있어요. 상업적 목적으로 사용하는 것은 이 라이선스에 포함되지 않아요. 쉽게 예를 들어 설명하자면, 학교, 공공 병원이나 의원, 자선 단체, 개인 또는 연구 프로젝트는 포함되지만, 상점의 쇼핑몰과 같은 영리 기업의 제품은 포함되지 않아요: [누가 사용할 수 있나요](https://champollion.dev/docs/getting-started/who-may-use-this) (요약본이며 법적 조언이 아니에요. 라이선스 원문이 우선해요). 게시된 `champollion` npm 패키지는 PolyForm-Noncommercial-1.0.0이에요. `cli/LICENSE`는 배포된 패키지에 대한 권위 있는 라이선스예요. 함께 제공되는 MT 평가 하네스 및 사양은 오픈 소스이며, 공개 [하네스 리포지토리](https://github.com/gamedaysuits/Champollion)에서 §7 eval-standard-plugin 예외가 포함된 AGPL-3.0-or-later 라이선스가 적용돼요.
