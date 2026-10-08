---
sidebar_position: 1
title: "CLI 레퍼런스"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI 참조

## 명령어

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

프로젝트가 아닌 공유 인덱스 및 리더보드와 작동하는 명령어들은 `champollion network` 아래에 그룹화되어 있어요. 각 명령어는 접두사 없이도 작동해요:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

어떤 명령어로든 상세 도움말을 보려면 `champollion <command> --help`을 실행하세요
(`champollion network`은 네트워크 명령어 목록을 표시해요).

## 전역 옵션

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### 언어 쌍 작성하기

프로젝트 언어 쌍은 `champollion.config.json`이 키를 지정하는 방식인 `en:fr` 형식으로 작성해요. `sync`, `verify`, `serve`도 `en>fr`와 `en-fr`을 읽으며, `en-pt-BR`은 설정한 언어 쌍과 대조돼요. 네트워크 명령어(`network register-corpus`, `leaderboard`, `recommend`, `submit`)는 리더보드가 저장하고 `mt-eval`이 사용하는 형태인 `eng>crk` 형식으로 언어 쌍을 기록하며, `eng-crk`와 `eng:crk`도 동일한 방식으로 읽어요. 하이픈만 사용할 경우, 언어 쌍은 2글자 또는 3글자 코드 두 개로 구성돼요(`eng-crk`). 자체 하이픈이 포함된 코드는 `>`이 필요해요: `--pair "eng>pt-BR"`. `eng-pt-BR`은 임의로 추측하지 않고 거부돼요. 쉘에서는 `>` 형식을 따옴표로 감싸세요. 따옴표를 쓰지 않으면 `--pair eng>crk`가 출력을 `crk`라는 이름의 파일로 리다이렉트해요.

---

## init

`champollion.config.json`을 생성하는 대화형 설정 마법사입니다. 소스 로케일, 대상 언어, 파일 형식, 번역 모델 설정을 안내합니다.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**`--content-dir` 옵션**: 로캘 파일과 함께 번역할 Markdown/MDX 파일이 있는 폴더예요(`contentDir` 형식으로 작성). 폴더가 반드시 존재해야 하며, 존재하지 않으면 `init`은 아무것도 쓰지 않고 중단돼요.

**로컬 전용 파일이 있는 프로젝트는 기본값이 `local`로 설정돼요**: 기본 메서드는 `llm`(호스팅 서비스인 OpenRouter)예요. 프로젝트 내 어느 곳이든 파일이 로컬 전용으로 표시되어 있으면(`champollion network register-corpus --data <file> --tier local-only`이 작성하듯 옆에 `"transmission": "local-only"`이 있는 `<file>.champollion.json`이 존재하면), `init`(`--yes` 포함)은 대신 `local` 메서드를 기본값으로 사용해요. 이 머신에서 서빙되는 모델(Ollama의 기본값 `http://localhost:11434/v1` 또는 `LOCAL_API_BASE`이 지정하는 서버)을 사용해요. 표시된 파일의 이름을 지정하며 이유를 안내하고, 호스팅 메서드를 의도적으로 선택하는 방법(`champollion init --force --method llm --model <model>`)도 알려줘요. 명시적인 `--method`가 항상 우선하며, 이 경우 `init`은 텍스트가 전송되는 위치 옆에 표시된 파일을 표기해요.

**`init` 다시 실행하기 (`--force`)**: `--force`이 없으면 `init`은 `champollion.config.json`이 존재할 때 중단돼요. 플래그가 있으면 `init`은 해당 파일에서 시작하여 플래그가 지정한 항목만 다시 작성해요: `--langs`은 타깃 목록을 설정하고(이미 있는 언어는 레지스터, 문자 체계, 이름 등 기존 항목 유지), `--method`은 기본 메서드(및 `--model`이 지정하지 않는 한 모델도 함께)를 설정하며, `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name`, 그리고 `--method api`은 지정된 언어 쌍을 설정해요. 로캘 레이아웃은 파일에서 소스 파일을 더 이상 찾을 수 없을 때(또는 `--dir`이 다른 폴더를 지정할 때)만 다시 감지해요. 다른 모든 설정(`batchSize`, `pairs`, `glossary`, 폴백, 선택한 레지스터)은 그대로 유지돼요. 변경된 필드와 유지된 필드를 각각 출력하며, 이전 파일을 먼저 `champollion.config.json.bak`로 복사해요(해당 백업에 이미 이전 파일이 있으면 다음 백업은 `.bak.2`, `.bak.3` …이 되며, 이전 백업을 덮어쓰지 않아요). 유효한 JSON이 아닌 파일은 유지할 수 없으므로 백업된 후 새 파일이 작성돼요. 설정을 하나만 바꾸려면 파일에서 직접 수정하세요. 이를 위해 `init`을 다시 실행할 필요는 없어요.

**로캘 파일 찾기**: `init`은 무엇이든 쓰기 전에 먼저 소스 언어의 파일을 찾아요. 프레임워크의 일반적인 폴더를 먼저 확인하고(next-intl `messages/`, i18next `public/locales/<lang>/` 및 `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), 그다음 `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales`, `src/i18n`을 확인한 후 찾은 내용을 출력해요. 존재하지 않는 `localesDir`은 절대 작성하지 않아요. [로캘 파일 레이아웃](/docs/getting-started/configuration#locale-layouts)을 참고하세요.

**`--langs` 옵션**: 쉼표로 구분된 타깃 언어 코드 목록이에요. 언어 선택 프롬프트를 건너뛰고 각 언어의 기본 레지스터 프리셋을 적용해요. 이는 설정 파일에 기록되므로 선택 사항을 확인하고 편집할 수 있어요: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (다른 프리셋으로 변경하거나 어조를 설명하는 사용자 지정 단어로 변경 가능하며, 프리셋이 없는 언어는 `{}`으로 기록돼요). 또한 레이아웃에 빈 타깃 파일을 생성해요(`fr.json` 또는 각 네임스페이스별 `fr/common.json`). 완전한 비대화형 설정을 위해 `--yes`과 함께 사용하세요.

**`--method api --endpoint <url>`**: champollion API 규격을 따르는 서버예요. 예를 들어 직접 학습시키고 `nmt-forge serve`로 서빙하는 모델 등이 해당돼요. `init`은 타깃당 하나의 언어 쌍을 기록하며, 모델 옆의 `DEPLOY.md`과 동일한 항목이에요: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false`은 엔드포인트가 키별 지침을 따르는지 여부를 나타내요(nmt-forge로 학습된 모델은 따르지 않음). 이 설정이 없으면 `init`은 동일한 엔드포인트에 대해 설치된 플러그인 매니페스트(`.champollion/methods/<name>/method.json`)에서 값을 가져오거나 지정되지 않은 상태로 둬요. `--langs`이 필요하며(엔드포인트는 언어 쌍별로 설정됨), 키는 이 머신 외부에 있는 엔드포인트(`CHAMPOLLION_API_KEY`)인 경우에만 필요해요. `DEPLOY.md`에 표시된 것처럼 언어 쌍에 `fallback` 메서드를 수동으로 추가하세요.

**`--script` 옵션**: 몇몇 언어는 둘 이상의 실제 정서법으로 표기돼요. 플레인스 크리어(Plains Cree, `crk`: `Latn` = 표준 로마자 표기법, `Cans` = 음절 문자), 세르비아어(`sr`: `Latn`, `Cyrl`) 등이 그 예시예요. Champollion은 커뮤니티를 대신하여 정서법을 선택하지 않아요. `sync`은 설정에서 하나를 지정할 때까지 해당 언어의 번역을 거부해요. 마법사에서 이를 묻지만, `--yes`을 사용할 때는 `--script crk=Cans`를 전달하세요(여러 개인 경우: `--script crk=Cans,sr=Latn`, 단일 타깃 언어인 경우 `--script Cans`로 충분함). 그러면 `"languages": { "crk": { "script": "Cans" } }`이 작성돼요. 지정하지 않으면 `init --yes`은 선택이 필요한 언어를 알리고 선택지를 나열하며, 설정의 해당 언어 항목에 추가할 `"script"` 라인을 출력해요.

**`--name` 옵션**: 사용자 정의 코드(확정된 코드가 없는 변종을 위한 `qaa`–`qtz`)는 언어 카드가 없으므로, `init`은 철자 확인을 요청하는 대신 이 사실을 알려줘요. `--name qaa="Ayta (variety not yet confirmed)"`은 프롬프트와 리포트에서 사용할 표시 이름을 지정하며, `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` 형식으로 작성돼요(여러 개인 경우: `--name "qaa=…;qab=…"`). 각 레지스터 옆에 `init`은 해당 언어에 대해 LLM 프롬프트가 전달하는 성별 지침도 출력해요([성별 지침](/docs/getting-started/configuration#gender-guidance)).

**언어 프리셋**: 대상 언어를 입력하라는 메시지가 표시되면 프리셋 이름을 입력할 수 있습니다:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

프리셋과 개별 코드를 혼합하세요: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

모든 로케일 파일에서 누락되거나 오래된 키를 번역합니다. 기본적으로 동기화 후 검증을 실행합니다.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**번역 메모리(Translation Memory)**: 기본적으로 `sync`은 `.champollion/tm.json`을 로드하고 변경되지 않은 소스 값에 대해 캐시된 번역을 제공해요. 모델을 변경해도 캐시가 버려지지 않아요. 이전 모델에서 이미 번역된 텍스트는 비용 없이 재사용되며, sync는 비용 예상 전에 이를 안내해요. 새 모델이 대신 번역하게 하려면 `--redo all --fresh-on-model-change`을 사용하세요. 이전 모델이 번역한 키들을 전송하며, 새 모델이 이미 번역한 내용은 여전히 캐시에서 가져와요(단독으로 사용할 경우 `--fresh-on-model-change`은 어차피 이번 실행에서 번역할 키에만 영향을 줘요). 캐시를 완전히 우회하려면 `--no-tm`을 사용하세요(품질 디버깅 시 유용해요). [번역 메모리](/docs/concepts/translation-memory)를 참고하세요.

**예상 비용 및 `--max-cost`**: 예상 비용에는 이번 실행에서 실제로 청구될 금액만 산정돼요. 번역 메모리에 이미 있는 키, 프론트매터 필드, Markdown 블록은 $0로 계산되며, 표에는 캐시를 통해 절감된 금액이 표시돼요. 이 머신에서 서빙되는 모델(`localhost`/`127.0.0.1`/`::1`의 `local` 또는 `api` 엔드포인트)은 `$0 (local)`으로 표시돼요. 즉, API 요금이 없으며 하드웨어 및 전력 비용은 포함되지 않아요. `--max-cost`은 이 수치와 한도를 비교해요. 한도를 초과하거나 예상 비용이 없는 경우(다른 머신을 가리키는 `local`처럼 공개된 가격이 없는 메서드), sync는 API 호출 전에 중단되고 종료 코드 `2`을 반환해요. 아무것도 번역되거나 작성되지 않아요. 마지막 줄에는 모델로 전송된 키 개수와 캐시에서 가져온 키 개수가 표시돼요.

표 아래 한 줄에는 산정된 요율과 그 출처가 표시돼요. 호스팅 모델의 경우 OpenRouter 공개 가격표의 입력 및 출력 토큰 100만 개당 가격과 읽어온 시점(`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`)이 표시돼요. 직접 제공업체(`openai`, `anthropic`, `gemini`)의 경우 동일한 목록이 제공업체 자체 가격을 대신하며, 목록을 읽을 수 없거나(또는 모델 가격이 없는 경우) champollion 내부에 보관된 복사본이 마지막 확인 날짜 및 이유와 함께 사용돼요. DeepL, Google, Microsoft는 공개된 글자당 가격과 해당 날짜를 기준으로 해요. 이는 예상치일 뿐이에요. 해당 줄에는 키당 가정한 토큰(또는 글자) 수가 명시되며, 실제 요금은 실제 길이에 따라 달라져요. `--json`을 사용하면 예상치에 세부 정보가 포함돼요: 각 언어 쌍의 `rate` 및 실행의 `rates`(`inputPerMillion`, `outputPerMillion` 또는 `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` 또는 `verified`).

**요청 미리보기**: `sync --dry --show-prompt [key]`은 해당 언어 쌍의 메서드로 전송될 정확한 요청(메서드 자체 코드로 생성된 시스템 및 사용자 메시지, 또는 `api` 엔드포인트의 경우 요청 본문이며 API 키는 마스킹됨)을 출력하고 아무것도 전송하지 않아요. 키 이름을 지정하면(`--redo keys:`이 지정하는 형식: `verb␄Open`, `common::nav.home`. 쉼표가 포함된 gettext msgid는 전체 지정 가능) 대기열에 있는지 여부와 관계없이 해당 키의 요청을 보여줘요. 실제 실행 시 아무것도 전송하지 않을 키인 경우(최신 상태이거나 캐시에서 제공되거나 보류된 경우) 그 이유를 설명하고 이를 전송할 수 있는 `--redo keys:<key> --fresh` 명령어를 알려줘요. 키를 지정하지 않으면 각 파일이 전송할 첫 번째 배치를 보여주거나 아무것도 전송되지 않음을 표시해요. gettext `msgctxt`, `#.` 주석, 또는 ARB 설명이 모델에 도달하는지 확인하는 방법이에요. 기계 번역 엔진(DeepL, Google 등)에는 소스 텍스트만 전송되며 미리보기에도 그렇게 표시돼요. `--json`을 사용하면 각 요청이 `{"level": "event", "event": "request", …}` 형식의 한 줄로 출력돼요.

**드라이 런(Dry runs)**: `--dry`은 아무것도 번역하거나 쓰지 않지만, 실제 실행 시 먼저 확인해야 할 사항들을 점검해요. 메서드에 필요한 키가 누락된 경우(`OPENROUTER_API_KEY`, `DEEPL_API_KEY` 등) 실제 실행 시 중단된다는 경고를 띄우고 변수 이름을 알려줘요. 키가 설정되어 있는지만 확인할 뿐 정상 작동 여부는 확인하지 않아요(아무것도 전송되지 않으므로 플레이스홀더 값도 통과함). 종료 코드는 여전히 `0`이에요. 미리보기는 실패하지 않아요([종료 코드](#sync-exit-codes) 참고). `--max-cost`도 마찬가지예요. 드라이 런은 한도에서 멈추지 않지만, 예상 비용이 한도를 초과하거나(또는 알 수 없는 경우) 실제 실행 시 거기서 중단되어 `2`로 종료된다는 점을 마지막에 한 번 안내해요. `--json`을 사용하면 모든 줄이 `level`을 포함하는 하나의 JSON 객체가 돼요(stdout에는 `info`, `ok`, `event`, stderr에는 `warn`, `error`). 그리고 마지막 stdout 줄은 요약인 `{"level": "summary", "command": "sync", …}`로, `preflight: { ready, failures }`, 한도 `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, 그리고 미리보기가 파악할 수 있는 한 실제 실행이 끝났을 종료 코드인 `realRun: { exitCode, wouldStop, reasons }`을 전달해요([종료 코드](#sync-exit-codes) 참고). 실제 sync에서 사용하는 플래그(`--method`, `--model`)와 함께 실행하세요. 플래그가 없으면 설정에 지정된 메서드를 확인해요. 드라이 런 자체의 종료 코드는 CI 단계를 절대 실패시키지 않으므로, `--max-cost` 경고는 게이트를 설정하는 방법을 안내해요: `--json` 요약에서 `maxCost.wouldStop`(또는 `realRun.exitCode`)을 읽어오세요(예: `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`). [CI 가이드의 확인 단계](/docs/guides/ci-cd#check-before-sync)가 바로 이 방식을 사용하며, 실패 시 단순한 `false` 대신 이유(`realRun.reasons`)를 출력해요. 드라이 런의 `totalPluralGaps`은 실제 실행 시 다시 요청하지 않을, 해당 언어에서 사용하는 복수형이 누락된 디스크 상의 복수형 메시지 수를 계산하며, `verify`은 `{ "ran": false }`이에요(아무것도 작성되지 않았으므로 검증된 것도 없음).

**다시 번역하기**: `--redo`은 *무엇을* 다시 번역할지 지정하고, `--fresh`는 *비용을 지불할지 여부*를 지정해요. `--fresh`이 없으면 캐시에 이미 있는 모든 내용은 비용 없이 반환돼요(여전히 품질 게이트도 통과함). 플래그가 있으면 대기열에 있는 모든 항목을 새로 번역하고 요금이 청구돼요. 기존 플래그(`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`)도 여전히 작동하며 표에 나온 설명과 정확히 일치해요.

**파일 범위 제한하기**: `--files`은 콘텐츠 단계를 일치하는 파일로 제한하고, `--redo files:<glob> --fresh`는 일치하는 파일에 대해 새로운 번역을 강제해요(의도적인 재지출 허용). 패턴은 sync가 출력하는 경로(`contentDir` 기준 상대 경로, `2026-10.md`) 및 프로젝트 루트 기준 동일 경로(`newsletter/2026-10.md`)와 일치해요: `*`은 폴더 내에 유지되고 `**`은 폴더를 넘어 매칭돼요. 두 플래그 모두 반복 지정할 수 있어요. 일치하는 파일이 없는 패턴이 있으면 비용이 발생하기 전에 실행이 중단돼요. 키-값 단계는 이미 증분 방식이므로 평소대로 실행돼요.

**실패**: 하나의 콘텐츠 파일이 실패해도 다른 파일의 처리는 중단되지 않아요. 성공한 파일은 기록되고 해당 번역은 캐시되며, 실행이 끝나면 실패한 파일 목록과 각 파일이 어떤 상태로 남았는지 표시돼요. 파일 내의 키가 번역되지 않은 경우 파일 줄에 `[OK]`가 절대 표시되지 않아요. 실패 요약에는 각 키별로 다음 sync가 수행할 작업이 표시돼요: 다시 요청(사용 가능한 답변 없음), 한 번 더 요청(다시 실행 중 대기 중), 또는 보류(품질 게이트에서 거부됨). 게이트에서 거부된 Markdown 블록과 프론트매터 필드도 페이지별로 동일하게 보류돼요. `--redo files:<page>` 또는 `--redo content`으로 다시 요청할 수 있어요([품질 게이트](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). 종료 코드는 `0`(모두 성공), `2`(부분 성공: 일부 작업 완료, 일부 실패, 보류됨, 검증 실패, 해당 언어에서 일반적인 수량에 사용하는 복수형이 누락된 채 메시지가 작성됨, 또는 비용을 지출하기 전에 `--max-cost`로 중단됨), `1`(아무것도 성공하지 못함) 중 하나예요.

**변경 감지**: champollion은 `.champollion.lock`에 SHA-256 해시를 저장해요. 소스 값이 변경되면 다음 sync에서 해당 키를 자동으로 다시 번역해요. 모든 개발자가 동일한 기준점을 공유할 수 있도록 락 파일을 커밋하세요. 또한 락 파일에는 타깃 로캘별로 sync가 작성한 각 값의 지문(fingerprint)이 기록되어, 사람이 수정한 값을 인식하고 대량 재실행 시에도 유지할 수 있어요([번역 수정하기](/docs/guides/professional-translators#editing-key-value-files)). 아울러 재실행이 완료되지 못한 키(**보류 중**: 다음 sync에서 한 번 더 요청) 및 품질 게이트가 거부한 키(**제외**: 일반 sync 시 동일한 모델로 재전송하지 않음 — [품질 게이트](/docs/concepts/quality-gate#refused-keys-are-held-back))도 기록돼요.

**수동 편집 및 재실행**: `--redo all`, `--force` 및 모델 전환 시 사람이 편집한 값은 그대로 유지되며 어떤 값인지 표시돼요. 특정 키를 지정한 `--redo keys:<key>`은 해당 값을 교체하고, 소스가 변경된 키는 다시 번역돼요. 교체된 수동 편집 내용은 출력되며 `.champollion-replaced-edits.jsonl`에 추가돼요(추적되므로 락 파일과 함께 커밋하세요).

**컨텍스트가 있는 gettext 키**: 키는 `msgctxt` + U+0004 + `msgid` 구조예요. 리포트에는 구분자가 `␄`로 출력되며, `--redo keys:`과 `--force-keys`도 이를 그대로 인식해요. 직접 입력할 때는 `\x04`를 작성하세요: `--redo 'keys:django::verb\x04Open'`(작은따옴표를 사용해야 백슬래시가 유지돼요). 두 표기법 모두 동작해요. 복구 명령어는 `␄` 형식을 출력하고 그 뒤에 `\x04`을 지정하는 쉘 주석을 덧붙여요.

**일치하는 항목이 없는 키를 지정한 경우**: 소스 키에 없는 이름(오타 또는 컨텍스트와 함께만 존재하는 msgid)으로 `--redo keys:` / `--force-keys`을 실행하면 종료 코드 1로 실패해요. 오류 메시지에는 두 표기법 모두로 해당 msgid의 모든 컨텍스트 변형을 포함하여 가장 유사한 키 목록을 나열해요. 일치하는 이름이 하나도 없으면 아무것도 실행되지 않아요. 일부만 일치하는 경우 일치하는 키를 다시 실행한 후 나머지 키 이름을 나열하며 실행이 실패해요.

**캐시에서 제공되는 지정 키**: `--fresh`이 없으면 다시 실행할 때 캐시에 저장된 내용을(비용 없이 다시 확인하여) 제공하고 그 사실을 알리며, 모델에 다시 요청할 수 있는 `--fresh` 명령어와 해당 비용을 함께 표시해요.

**병렬 처리**: JSON 키 번역과 콘텐츠 번역이 모두 병렬로 실행됩니다. JSON 로케일은 동시에 번역되며(기본값: 200개 동시 로케일), 각 로케일 내의 배치도 병렬로 처리됩니다(4개 동시 배치). 콘텐츠 번역(Markdown, MDX, 블로그 게시물)은 플랫 작업 항목 풀에서 실행됩니다(기본값: 48개 동시 API 호출). `--json-concurrency`, `--content-concurrency`, 또는 `--concurrency`(둘 다 설정)로 재정의하세요.

**출력**: Sync는 버전 배너, 형식/프레임워크 감지, 비용 추정치, 로케일별 진행률 표시줄을 표시합니다:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

진행률 표시줄은 각 배치(약 80개 키)마다 제자리에서 업데이트돼요. 오류/경고만 보려면 `--quiet`을 사용하고, 기계 판독 가능한 NDJSON 출력을 얻으려면 `--json`을 사용하세요. 두 옵션 모두 진행률 표시줄과 배너를 표시하지 않아요. `--json`을 사용하면 `--max-cost` 게이트 전에 `cost` 이벤트가 발생하고, 각 콘텐츠 파일 및 로캘마다 `file` 이벤트가 발생하며, `summary`로 모든 실행이 종료돼요.

### 종료 코드 {#sync-exit-codes}

| 코드 | 실제 실행 | 드라이 런 (`--dry`) |
|------|------------|---------------------|
| `0` | 대기열의 모든 항목이 번역 및 검증되었거나, 대기열에 아무것도 없었음. | 실행 완료 — 실제 실행 시 중단되었을 것이라고 안내하는 경우에도 해당. |
| `2` | 부분 성공: 일부 작업이 완료되었으나 일부 실패함, 보류됨, 검증되지 않음, 또는 언어에서 일반적인 수량에 사용하는 복수형이 누락된 채 메시지가 작성됨. 또한 아무것도 전송되기 전에 `--max-cost`로 실행이 중단된 경우. | 발생하지 않음. |
| `1` | 아무것도 성공하지 못했거나 실행을 시작할 수 없음: 메서드에 필요한 키 누락, 필요한 모델 서버의 무응답, 재실행할 키와 일치하는 항목 없음, `--files` 패턴과 일치하는 파일 없음, 또는 설정이 유효하지 않음. | 드라이 런 자체가 실행될 수 없음: 재실행할 키와 일치하는 항목 없음, `--files` 패턴과 일치하는 파일 없음, 또는 설정이 유효하지 않음. |

드라이 런은 의도적으로 `0`으로 종료돼요. 결정을 내리기 전에 실행해보는 미리보기이므로, 확인만 하는 CI 단계가 실패해서는 안 되기 때문이에요. 실제 실행이 수행할 작업은 드라이 런의 마지막 줄과 `--json` 요약에 나와 있어요: `preflight.ready: false`은 실제 실행 시 번역 전에 중단되어 `1`으로 종료됨을 의미해요(`preflight.failures`에 이유 표시). `maxCost.wouldStop: true`은 한도에서 중단되어 `2`으로 종료됨을 의미해요(`maxCost.exitCode: 2`). `maxCost.exitCode: 1`과 `maxCost.stopsEarlier`은 한도를 확인하기 전에 프리플라이트 검사에서 중단됨을 의미해요. `realRun.exitCode`은 이들을 종합하고 실제 실행을 부분 완료 상태로 만들 요인들도 함께 포함해요: 보류된 키, 또는 다시 요청하지 않을 해당 언어의 복수형이 누락된 디스크 상의 복수형 메시지(`2`. `realRun.reasons`이 이름을 지정하며 드라이 런의 마지막 줄에도 표시됨). 실제 실행에서만 발견할 수 있는 품질 게이트의 거부나 검증 실패로 인해 예상된 `0`이 `2`로 바뀔 수도 있어요. [CI 가이드의 확인 단계](/docs/guides/ci-cd#check-before-sync)에서는 이를 실패하는 CI 단계로 변환하여 이유를 출력하도록 처리해요.

---

## watch

소스 로케일 파일이 변경될 때 자동으로 동기화합니다. `Ctrl+C`으로 중단할 때까지 실행됩니다.

```bash
champollion watch
```

---

## audit

완전성 게이트예요. 번역되지 않은 모든 키(누락됨, 비어 있음, 또는 여전히 `[EN]` 폴백 상태임)와 **최신 상태가 아닌(out of date)** 번역(현재 소스 텍스트보다 오래된 소스 텍스트로 생성된 번역, `.champollion.lock` 기준. 소스 수정 후 재번역이 실패했을 때 바로 이 상태가 됨)을 모두 나열해요. 최신 상태가 아닌 목록의 끝에는 이를 다시 번역하는 명령어가 표시돼요. 하나라도 발견되면 코드 1로 종료되므로, 불완전하거나 오래된 번역이 있는 빌드를 실패시키는 CI 게이트로 사용하세요.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

디스크에서 모든 로케일 파일을 다시 읽고 번역이 실제로 존재하며 올바른지 검증합니다. 이는 모든 `sync`의 끝에서 자동으로 실행되는 것과 동일한 검증입니다(`--no-verify`이 전달되지 않는 한).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**검사 항목:**
- 키 일치성 — 각 타깃에 모든 소스 키가 존재하는지 여부(i18next 복수형 키의 경우 해당 로캘의 CLDR 복수형에 해당하는 키: 프랑스어는 `count_many`도 필요함)
- 이전 실행의 `[EN]` 폴백 마커
- 비어 있는 번역
- 문자 체계 준수 — 비라틴계 로캘에 라틴 문자만 포함되어서는 안 됨. 문자는 유니코드 문자 체계(Script)별로 분류되므로 악센트 부호가 붙은 문자 및 전각 라틴 문자도 라틴 문자로 취급됨. CJK 타이포그래피 이외의 로캘에서 전각 라틴 문자는 오류로 처리됨
- 플레이스홀더, 관련된 문법별로 명명된 결과 — ICU MessageFormat 구조(`ICU structure error`: `{name}` 인수, 번역된 plural/select 키워드 또는 선택자, 누락된 `#`), printf 변환(`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — gettext 카탈로그의 누락된 `%(name)s`는 ICU가 아닌 printf로 명명됨), i18next 보간(`i18next {{…}} placeholder mismatch`: `{{name}}`, i18next가 있는 그대로 출력하는 `{name}`로 작성된 `{{name}}` 포함), 그리고 ICU 메시지 외부의 단일 중괄호 `{name}`(`{…} placeholder mismatch`)
- 마크업 — 태그 이름별로 소스와 동일한 여는 태그, 닫는 태그, 자체 닫는 태그가 동일한 중첩 구조를 가지는지 여부(누락된 `</strong>`은 오류)
- 인코딩 문제 — BOM 마커, 보이지 않는 문자
- 소스 에코(Source echoes) — 소스와 동일한 값(경고)
- 복수형 — 해당 언어에서 일반적인 수량에 사용하는 형태가 누락된 복수형 메시지(러시아어 `few`/`many`), `other`만 반복하는 형태의 gettext 항목(sync는 이를 `# champollion:` 주석으로 표시함), 해당 언어에 없는 형태의 i18next 키 또는 `msgstr[n]`(경고)
- 동일한 로캘 — 대부분의 키에 대해 동일한 텍스트를 가진 두 타깃 로캘: 한쪽이 다른 쪽의 언어로 되어 있을 가능성이 높음(경고)
- 서로 다른 소스에 동일한 텍스트 — 여러 개의 서로 다른 소스 문자열에 동일한 텍스트가 작성된 경우(모델이 암기한 문장을 반복함): 명확히 다른 여러 단어로 된 문자열에 4단어 이상의 동일한 텍스트(그 외의 경우 3단어 이상)로 응답한 경우. 이전 sync에서 모델이 반복한 것으로 확인된 문장은 단 한 번만 나타나도 카운트됨. 키 값, 각 ICU plural/select 분기(하나의 복수형 분기들은 하나의 소스로 카운트됨), 로캘의 Markdown 페이지(프론트매터 필드 및 블록, `# ` 및 끝 문장부호 제외) 전반에 걸쳐 계산되며, `sync`의 게이트가 거부하는 것과 동일한 규칙을 적용(오류)
- 오래됨(Out of date) — 현재 소스 텍스트보다 오래된 소스 텍스트로 생성된 번역(여기서는 경고, `audit`에서는 실패 처리됨)
- 누락된 물음표 또는 느낌표 — 소스가 `?` 또는 `!`로 끝나는데 번역이 해당 기호나 타깃 문자 체계의 동등한 기호(`？`, `؟`, 그리스어 `;` 등)로 끝나지 않는 경우. 경고: 일부 언어는 기호 대신 단어나 불변화사(조사)로 의문을 나타내기도 함

의미가 아니라 구조를 검사해요. 통과했다는 것은 키, 플레이스홀더, 복수형,
마크업, 문자 체계가 온전하다는 뜻이지 번역이 정확하다는 의미는 아니에요.
실제 사용하기 전에 해당 언어 화자의 검토를 받으세요.

**대상 로캘.** `verify`은 모든 로캘을 검사하고, `verify --pair en:fr`은
프랑스어만 검사해요. `sync --pair en:fr` 이후의 post-sync 검사는 실행된 언어 쌍만
다루며 다른 언어 쌍은 다루지 않아요. 범위가 제한된 검사는 마지막 줄에 이를 안내해요 — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json`에서는 해당 줄에
`checked`(검사된 로캘)과 `scope`가 포함돼요.

**복수형 커버리지.** 각 로캘 블록에는 파일에 포함된 복수형 종류(i18next 접미사 키, ICU 복수형 메시지, gettext
`msgid_plural` 항목)별로 한 줄씩 표시되며,
해당 로캘이 가져야 할 예상 형태(해당 로캘의 CLDR 복수형 카테고리, gettext 카탈로그의 경우 `Plural-Forms`에
슬롯이 있는 형태)와 모든 복수형 메시지가 이를 갖추고 있는지 여부를 알려줘요:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗`은 형태가 누락된 복수형의 이름을 지정해요. 1000 초과의 숫자나
소수에만 사용되는 형태(ICU 메시지에서의 프랑스어 `many`)는 별도로 명시돼요. `other`
형태가 이를 대신하므로 지적 사항(finding)으로 처리되지 않아요. 이 줄은 요약이며,
누락된 형태는 그 위에서도 지적 사항(누락된 키, 복수형 경고)으로 표시돼요.

**`--json`**은 한 줄에 하나의 JSON 객체를 작성해요. 각 로캘은 stdout에 레코드를 받으며
— `{"level": "event", "event": "verify", "locale": "fr", …}` — 여기에는
`ok`, `keys`(`expected`, `present`, `missing`, `extra`), 해당 로캘의 `errors`,
`warnings` 및 `infos`, `placeholders`(각 지적 사항과 그에 따른 `syntax`: `icu`,
`printf`, `i18next`, `brace` 또는 `markup`), 그리고 `plurals`(종류 및 유형별:
`categories`, `total`, `complete`, `incomplete`)이 포함돼요. 지적 사항은 stderr에도
`error`/`warn` 줄로 출력되며, 마지막 줄은 레벨과 메시지를 유지하고(검사 통과 시 stdout에
`ok`, 실패 시 stderr에 `error`) `errors` 및 `warnings` 수를 전달해요. sync 후에는 동일한
레코드가 sync 자체 요약보다 먼저 출력돼요. (Docusaurus 프로젝트의 레코드에는
`keys`이나 `plurals`이 포함되지 않아요: UI 문자열이 파일별로 검사되기 때문이에요.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**종료 코드:** 오류를 발견했을 때 — 또는 아무것도 검사할 수 없었을 때(소스 파일이나 로캘 폴더가
설정이 가리키는 위치에 없음. 오류 줄에 경로와 설정 이름이 표시됨) `1`이며,
그렇지 않으면 `0`이에요. `--strict`을 전달하지 않는 한 경고로 인해 실패하지는 않아요.
이 플래그를 전달하면 어떤 경고든 `1`로 종료되며(예: 러시아어 복수형에서 `few`/`many` 형태가
누락된 채 배포되면 안 되는 CI 환경), `[OK]` 줄이 아닌 `[FAIL]` 줄로 끝나요. `--warn-only`은
오류 발생 시에도 `0`로 종료되도록 해요. 키 개수가 맞지 않는 로캘은 `[OK]` 대신 다음과 같이 표시돼요:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

i18n 번역 호출을 사용해야 하는 하드코딩된 사용자 대상 문자열을 소스 코드에서 스캔합니다. 프레임워크(next-intl, react-i18next, vue-i18n, Hugo)를 자동으로 감지합니다.

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**감지 항목:**
- JSX 텍스트, `placeholder`, `alt`, `aria-label`, `title`의 하드코딩된 문자열
- 사용자 대상 콘텐츠가 있지만 i18n 프레임워크 import가 없는 파일
- 죽은 키 — 어떤 소스 파일도 참조하지 않는 로케일 키
- 커버리지 점수 — i18n을 거치는 문자열의 비율

**제외**: 프로젝트 루트에 `.champollionignore`을 생성하세요(`.gitignore`과 같은 glob 패턴).

**린트할 대상이 없으면 실패로 처리돼요**: 일치하는 소스 파일이 없을 때(프레임워크의 기본 폴더 — 웹 프로젝트의 경우 `src/`, `app/`, `pages/`, `components/` — 또는 설정된 `--src`), lint는 `1`로 종료되며 검색한 폴더 및 확장자 이름을 알려줘요. 아무것도 검사하지 않은 린트가 CI 게이트를 통과해서는 안 돼요. `--src <dir>` 또는 `"lint": { "srcDir": "<dir>" }`을 사용하여 코드가 있는 위치를 지정하세요.

---

## wrap

`lint`에 의해 감지된 하드코딩된 문자열을 `t()` 호출로 자동 래핑합니다. 파일을 수정하기 전에 자동 백업을 생성합니다.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**안전 게이트:**
1. Git-clean 검사(dry-run에서는 건너뜀)
2. `.champollion-backup/`으로 자동 백업
3. 각 파일 쓰기 전 diff 미리보기
4. 백업에서 복원하는 `--undo` 지원

---

## seo

다국어 사이트를 위한 SEO 아티팩트를 생성합니다.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| 하위 명령어 | 출력 |
|------------|--------|
| `hreflang` | `<link rel="alternate" hreflang>` 태그 |
| `sitemap` | 다국어 `sitemap.xml` |
| `jsonld` | JSON-LD WebSite 언어 스키마 |

---

## integrity

번역된 로케일 파일의 손상 및 드리프트를 감지합니다.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**검사 항목:**
- 플레이스홀더 손상 (예: 소스에는 `{name}`이 있지만 타깃에는 누락됨)
- 인코딩 문제 (문자 깨짐(모지바케), 유효하지 않은 유니코드)
- 번역되지 않은 사본 (타깃 값이 소스와 동일함) — [`noTranslate`](/docs/getting-started/configuration#no-translate) 키는 제외되며, 번역 메모리가 파이프라인에서 생성되고 게이트 승인을 받았음을 확인한 에코도 제외돼요. 여전히 표시되는 항목은 `sync`이 다시 대기열에 넣을 항목과 정확히 일치해요 — 정상적인 파일에 대해 두 도구의 판단이 다를 수 없어요
- 번역 제외 대상 변형(No-translate drift) (소스와 동일하지 *않은* `noTranslate` 키) — 예상 값/실제 값과 함께 보이지 않는 문자가 이스케이프 처리되어 보고돼요. `champollion sync`을 실행하여 복구하세요
- 예기치 않은 PUA ([문자 체계 변환](/docs/getting-started/configuration#script-conversion)이 비활성화된 로캘에 있는 사용자 정의 영역(PUA) 코드포인트 — 특수 폰트 없이는 빈칸으로 렌더링됨). `champollion repair-script`를 실행하여 복구하세요
- 내용이 비워진 값 (타깃이 소스에서 글자만 삭제된 상태 — 콘텐츠 보존 게이트보다 오래된 파이프라인에서 발생한 손상). `sync --force-keys <key>` 또는 `sync --pair <pair> --force`로 다시 번역하세요
- 고아 키 (소스에는 없고 타깃에만 존재하는 키)
- ICU MessageFormat 복수형 카테고리 완전성 (예: 아랍어는 6개 카테고리 필요) — `sync` 및 `verify`이 사용하는 규칙과 동일: 일반적인 수량에 해당하는 누락된 형태(러시아어 `few`/`many`)는 경고, 1000 초과의 숫자나 소수에만 해당하는 형태(프랑스어 `many`, 1 000 000에 사용됨)는 `other` 형태가 대신 사용되므로 참고 사항으로 처리돼요

---

## repair-script

발생하지 말았어야 할 문자 체계 변환을 되돌려요: 변환이 비활성화된 로캘에서 PUA로 인코딩된 값(pIqaD, 텡과르, 크립톤어)을 변환기 자체의 역변환 테이블을 통해 로마자 표기로 복원해요.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| 옵션 | 효과 |
|--------|--------|
| `--dry` | 파일 작성 없이 복구 내용 미리보기 |
| `--locale <code>` | 단일 로캘만 복구 |
| `--json` | 기계 판독 가능한 JSON 출력 |
| `--warn-only` | 되돌릴 수 없는 PUA가 남아 있어도 종료 코드 0 반환 |

pIqaD는 완벽하게 역변환돼요. 텡과르와 크립톤어 역변환은 대소문자를 복원할 수 없어요(대소문자 손실로 플래그 지정). 번역 메모리는 변환 전 값을 저장하므로 복구할 필요가 없어요. 등록된 변환기가 되돌릴 수 없는 PUA가 남아 있으면 종료 코드 1로 종료돼요.

---

## tm

번역 메모리 캐시(`.champollion/tm.json`)를 관리합니다. TM은 이전 번역을 저장하고 API를 호출하는 대신 이후 동기화 시 이를 제공합니다.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| 하위 명령어 | 출력 |
|------------|--------|
| `stats` | 항목 수, 파일 크기, 로케일별 분석 |
| `clear` | 캐시 파일 삭제(전체 또는 로케일별) |

| 옵션 | 효과 |
|--------|--------|
| `--locale <code>` | 하나의 로케일에 대한 항목만 지우기 |
| `--yes` | 확인 프롬프트 건너뛰기 |

TM 작동 방식과 언제 지워야 하는지에 대해서는 [번역 메모리](/docs/concepts/translation-memory)를 참조하세요.

---

## xliff

전문 번역가 검토를 위해 XLIFF 1.2 파일을 내보내고 가져옵니다. XLIFF는 memoQ, SDL Trados, Phrase와 같은 CAT 도구에서 지원하는 범용 교환 형식입니다.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| 하위 명령어 | 출력 |
|------------|--------|
| `export` | 소스 + 대상 로케일 파일에서 `.xliff` 생성 |
| `import` | 검토된 `.xliff` 번역을 로케일 파일에 병합 |

| 옵션 | 효과 |
|--------|--------|
| `--locale <code>` | 내보내기 대상 로케일(필수) |
| `--out <path>` | 사용자 지정 출력 경로 또는 디렉토리 |
| `--dry` | 쓰기 없이 가져오기 미리보기 |

전체 워크플로에 대해서는 [전문 번역가와 함께 작업하기](/docs/guides/professional-translators)를 참조하세요.

---

## status

언어 쌍 설정, 설치된 플러그인, 벤치마크 점수를 표시해요.

설정에서 `qualityTier`(`standard`, `high`, `research` 또는
`verified`)을 지정한 언어 쌍은 해당 값을 표시해요. 단, 이는 측정값이 아니라
직접 선택한 라벨일 뿐이에요 — 이 값과 관계없이 sync는 동일하게 번역하며, `serve`에
이를 알릴 뿐이에요. 설정하지 않은 언어 쌍은 아무것도 표시하지 않아요(`--json`에는 여전히
`qualityTierSet: false`와 함께 `qualityTier`가 있음).

```bash
champollion status
```

모델 전환 후에는 한 로캘의 파일에 여러 모델의 텍스트가 섞여 있을 때(번역 메모리를 통해
디스크 상의 각 값을 어떤 모델이 생성했는지 확인) 이를 알려주고, 이전 모델이 작성한 값을
현재 모델로 번역하는 명령어(`sync --pair <pair> --redo all --fresh-on-model-change`)도 함께 안내해요.
사용자가 선택한 모델을 실행하는 메서드(`local`, `api`, `external`)의 경우
첫 번째 sync에서 한 번 출력했던 라이선스 안내를 다시 표시해요. OpenAI 호환
메서드(`local`, `openai`)의 경우 요청이 전송되는 주소와 이를 선택한 설정을 보여줘요:
환경 변수 또는 `.env`의 `LOCAL_API_BASE`, 또는 기본값(Ollama, `http://localhost:11434/v1`).
`contentDir`이 지정되어 있으면 키-값 파일 옆에 콘텐츠 폴더를 나열하고,
해당 폴더에 포함된 소스 페이지 수와 언어별로 최신 상태, 만료됨(out of date), 대기 중(pending)인 번역 수를 보여줘요.
대기 중이란 아직 번역되지 않았거나 품질 게이트에서 거부된 부분이 소스 언어로 남아 있음을 뜻해요(콘텐츠 락 파일에는 `pending:<hash>`로 기록됨).
각 레지스터 아래에는 LLM 프롬프트가 전달하는 성별 지침과 그 출처(해당 언어에 대한 Champollion의 기본값, 사용자 설정, 또는 비활성화됨 —
[성별 지침](/docs/getting-started/configuration#gender-guidance) 참고)를 보여줘요.
폴백이 있는 언어 쌍의 경우 파일 내에서 폴백이 작성한 값의 개수를 세고 처음 몇 개를 보여줘요.
`--json`은 `requestsGoTo`(해당 엔드포인트를 사용하는 언어 쌍 또는 폴백의 경우), `content`, `genderGuidance`, `fallback.valuesInFiles`과 동일한 내용을 담고 있어요.

---

## provenance

설치된 모든 플러그인에 대한 번역 리소스 라이선스를 감사합니다.

```bash
champollion provenance
```

---

## plugin

번역 방법 플러그인을 관리합니다. 플러그인은 `.champollion/methods/`에 설치되는 사전 패키징된 번역 레시피입니다.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

플러그인 매니페스트 형식에 대해서는 [플러그인 명세](/docs/reference/plugin-spec)를 참조하세요.

---

## leaderboard

`champollion network leaderboard` (`champollion leaderboard`로도 동작해요). Network 리더보드에서 번역 메서드를 탐색, 검색 및 설치해요. 리더보드에서 설치된 메서드에는 벤치마크 점수와 평가 중에 사용된 정확한 설정인 전체 정규 MethodConfig가 함께 제공돼요.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| 옵션 | 효과 |
|--------|--------|
| `--pair <pair>` | 리더보드 표기 방식대로 언어 쌍을 필터링해요: `"eng>fra"` (ISO 639-3, 쉘에서는 `>`을 따옴표로 감싸세요). `eng-fra` 및 `eng:fra`도 동작하며, 2글자 코드는 자동으로 변환돼요 (`en` → `eng`) |
| `--install <rank>` | 해당 순위(목록에 표시된 순위)의 메서드를 플러그인으로 설치 |
| `--apply` | 설치 후 `champollion.config.json`에 자동으로 `methodPlugin` 추가 |

**`--apply` 워크플로:** `--apply`으로 설치하면, champollion은 방법 플러그인을 `.champollion/methods/`에 작성하고 **또한** 해당 페어에 사용하도록 `champollion.config.json`을 패치합니다. 이것은 "무엇이 가장 좋은 점수를 받나?"에서 "프로덕션에서 사용하고 있어요"로 가는 가장 빠른 경로입니다.

---

## fonts

인공어 스크립트 변환기를 위한 PUA 웹 폰트를 다운로드하고 관리합니다. Private Use Area 문자를 사용하는 언어(클링온어, 신다린어, 크립톤어)는 스크립트를 렌더링하기 위해 사용자 지정 웹 폰트가 필요합니다. 이 명령어는 검증된 오픈소스 저장소에서 이를 다운로드합니다.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| 하위 명령어 | 출력 |
|------------|--------|
| `list` | 어떤 PUA 폰트가 필요한지와 설치 상태를 표시 |
| `install` | 구성된 언어의 폰트 다운로드 |

| 옵션 | 효과 |
|--------|--------|
| `--dir <path>` | 폰트 출력 디렉토리 재정의(프로젝트 유형에서 자동 감지) |
| `--css` | 폰트와 함께 `conlang-fonts.css` 스니펫 생성 |
| `--config <path>` | 설정 파일 경로(어떤 언어가 폰트를 필요로 하는지 감지하는 데 사용) |

**자동 감지:** 출력 디렉토리는 프로젝트 구조에서 추론됩니다:
- **Docusaurus** → `static/fonts/` 또는 `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **기본값** → `public/fonts/`

**네이티브 유니코드 변환기**(`crk` → 크리 음절문자, `sr` → 세르비아 키릴 문자)는 폰트 설치가 필요하지 않습니다.

전체 PUA 폰트 세부 정보에 대해서는 [인공어, 스크립트 및 정서법](/docs/guides/conlangs-scripts-orthography)을 참조하세요.

## 3계층 파이프라인

견고한 i18n을 위해 `lint`, `sync`, `audit`을 함께 사용하세요:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| 계층 | 명령어 | 시점 | 목적 |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | 하드코딩된 문자열이 있는 커밋 차단 |
| **Sync** | `sync` | Post-commit / CI | 누락 및 변경된 키 번역 |
| **Verify** | `verify` | Post-sync / CI | 번역이 존재하고 올바른지 확인 |
| **Audit** | `audit` | 빌드 단계 | 로케일에 `[EN]` 마커가 있으면 배포 실패 |

---

## 참고 항목

- [구성](/docs/getting-started/configuration) — 설정 파일 참조
- [번역 방법](/docs/guides/translation-methods) — 페어별 방법 선택
- [번역 메모리](/docs/concepts/translation-memory) — 캐싱 및 비용 절감
- [전문 번역가와 함께 작업하기](/docs/guides/professional-translators) — XLIFF 워크플로
- [플러그인 명세](/docs/reference/plugin-spec) — 플러그인 매니페스트 형식
- [CI/CD 가이드](/docs/guides/ci-cd) — 파이프라인에서 CLI 명령어 자동화
- [Sync 작동 방식](/docs/concepts/how-sync-works) — 동기화 파이프라인 이해하기
- [품질 게이트](/docs/concepts/quality-gate) — 번역이 검증되는 방식
