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
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

모든 명령어에 대한 자세한 도움말을 보려면 `champollion <command> --help`을 실행하세요.

## 전역 옵션

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

`champollion.config.json`을 생성하는 대화형 설정 마법사입니다. 소스 로케일, 대상 언어, 파일 형식, 번역 모델 설정을 안내합니다.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**`--langs` 옵션**: 쉼표로 구분된 대상 언어 코드 목록입니다. 언어 프롬프트를 건너뛰고 각 언어에 대한 기본 레지스터 프리셋을 적용합니다. 완전한 비대화형 설정을 위해 `--yes`과 함께 사용하세요.

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
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**번역 메모리**: 기본적으로 `sync`은 `.champollion/tm.json`을 로드하고 변경되지 않은 소스 값에 대해 캐시된 번역을 제공합니다. 캐시를 우회하려면 `--no-tm`을 사용하세요(번역 제공자를 전환하거나 품질을 디버깅할 때 유용합니다). [번역 메모리](/docs/concepts/translation-memory)를 참조하세요.

**변경 감지**: champollion은 SHA-256 해시를 `.champollion.lock`에 저장합니다. 소스 값이 변경되면 다음 동기화 시 해당 키가 자동으로 재번역됩니다. 모든 개발자가 기준을 공유하도록 잠금 파일을 커밋하세요.

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

진행률 표시줄은 각 배치(~80개 키) 후에 제자리에서 업데이트됩니다. 오류/경고만 보려면 `--quiet`을 사용하고, 기계가 읽을 수 있는 NDJSON 출력을 원하면 `--json`을 사용하세요. 두 옵션 모두 진행률 표시줄과 배너를 숨깁니다.

---

## watch

소스 로케일 파일이 변경될 때 자동으로 동기화합니다. `Ctrl+C`으로 중단할 때까지 실행됩니다.

```bash
champollion watch
```

---

## audit

이전 실행에서 번역되지 않은 `[EN]` 접두사가 붙은 모든 대체 값을 나열합니다. 발견된 항목이 있으면 코드 1로 종료됩니다 — 불완전한 번역으로 빌드를 실패시키는 CI 게이트로 사용하세요.

```bash
champollion audit
```

---

## verify

디스크에서 모든 로케일 파일을 다시 읽고 번역이 실제로 존재하며 올바른지 검증합니다. 이는 모든 `sync`의 끝에서 자동으로 실행되는 것과 동일한 검증입니다(`--no-verify`이 전달되지 않는 한).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**검사 항목:**
- 키 일치성 — 모든 소스 키가 각 대상에 존재하는지
- 이전 실행의 `[EN]` 대체 마커
- 빈 번역
- 스크립트 준수 — 비 라틴 로케일은 비 ASCII 번역을 가져야 함
- 플레이스홀더 보존 — ICU 플레이스홀더가 소스와 일치하는지
- 인코딩 문제 — BOM 마커, 보이지 않는 문자
- 소스 에코 — 소스와 동일한 값(경고)

---

## lint

i18n 번역 호출을 사용해야 하는 하드코딩된 사용자 대상 문자열을 소스 코드에서 스캔합니다. 프레임워크(next-intl, react-i18next, vue-i18n, Hugo)를 자동으로 감지합니다.

```bash
champollion lint                    # exits 1 if issues found
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
- 플레이스홀더 손상 (예: 소스에는 `{name}`이(가) 있지만 타겟에는 누락됨)
- 인코딩 문제 (글자 깨짐(mojibake), 유효하지 않은 Unicode)
- 번역되지 않은 복사본 (타겟 값이 소스와 동일함) — [`noTranslate`](/docs/getting-started/configuration#no-translate) 키는 제외되며, Translation Memory가 파이프라인에서 생성되고 게이트 승인을 받았다고 확인한 에코(echo)도 제외돼요. 플래그가 지정되어 남은 것은 정확히 `sync`이(가) 다시 대기열에 넣을 항목이에요. 두 도구는 정상적인 파일에 대해 서로 다른 결과를 내지 않아요.
- 번역 금지 항목 변형 (소스와 동일하지 *않은* `noTranslate` 키) — 예상 값/실제 값과 이스케이프 처리된 보이지 않는 문자와 함께 보고돼요. 복구하려면 `champollion sync`을(를) 실행하세요.
- 예기치 않은 PUA ([script conversion](/docs/getting-started/configuration#script-conversion)이 꺼져 있는 로케일의 Private Use Area 코드포인트 — 특수 글꼴이 없으면 빈칸으로 렌더링돼요). 복구하려면 `champollion repair-script`을(를) 실행하세요.
- 비워진 값 (글자가 삭제된 소스 상태의 타겟 — 콘텐츠 보존 게이트보다 오래된 파이프라인에서 발생한 손상이에요). `sync --force-keys <key>` 또는 `sync --pair <pair> --force`(으)로 다시 번역하세요.
- 고립된 키 (타겟에는 있지만 소스에는 없는 키)
- ICU MessageFormat 복수형 범주 완전성 (예: 아랍어는 6개의 범주가 필요해요)

---

## repair-script

일어나지 말았어야 할 스크립트 변환을 되돌려요. 변환이 꺼져 있다고 설정된 로케일의 PUA 인코딩 값(pIqaD, Tengwar, Kryptonian)은 변환기 자체의 역방향 테이블을 통해 로마자로 복원돼요.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| 옵션 | 효과 |
|--------|--------|
| `--dry` | 쓰기 없이 복구 미리보기 |
| `--locale <code>` | 하나의 로케일만 복구하기 |
| `--json` | 기계가 읽을 수 있는 JSON 출력 |
| `--warn-only` | 되돌릴 수 없는 PUA가 남아 있어도 0으로 종료하기 |

pIqaD는 정확하게 되돌려져요. Tengwar 및 Kryptonian의 되돌리기는 대소문자를 복구할 수 없어요(대소문자 손실로 플래그 지정됨). Translation Memory는 복구할 필요가 없어요. 변환 전 값을 저장하거든요. 등록된 변환기가 되돌릴 수 없는 PUA가 남아 있으면 1로 종료돼요.

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

페어 구성, 설치된 플러그인, 품질 티어, 벤치마크 점수를 표시합니다.

```bash
champollion status
```

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
champollion plugin remove crk-coached-v1     # remove a plugin
```

플러그인 매니페스트 형식에 대해서는 [플러그인 명세](/docs/reference/plugin-spec)를 참조하세요.

---

## leaderboard

Network 리더보드에서 번역 방법을 탐색, 검색, 설치합니다. 리더보드에서 설치된 방법은 벤치마크 점수와 전체 정식 MethodConfig — 평가 중 사용된 정확한 구성 — 와 함께 제공됩니다.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| 옵션 | 효과 |
|--------|--------|
| `--pair <code>` | 언어 페어별로 리더보드 필터링(예: `en:fr`) |
| `--install <name>` | 리더보드에서 방법 플러그인 설치 |
| `--apply` | 설치 후 `methodPlugin`을 `champollion.config.json`에 자동으로 추가 |

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
