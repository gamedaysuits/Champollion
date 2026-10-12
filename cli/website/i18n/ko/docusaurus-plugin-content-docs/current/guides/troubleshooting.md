---
sidebar_position: 6
title: "문제 해결"
---

# 문제 해결

champollion의 일반적인 문제와 해결 방법입니다.

## API & 인증

### "OPENROUTER_API_KEY not found"

Champollion은 LLM 번역을 위해 API 키가 필요해요. 환경 변수로 설정하세요:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

또는 `.env` 파일에 설정하세요 (프로젝트가 `.env` 파일을 로드하는 경우):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Google Translate API 키만 있는 경우, champollion이 이를 자동으로 감지하여 Google Translate를 기본 방식으로 사용해요. 설정을 변경할 필요가 없어요.
:::

### OpenRouter에서 "401 Unauthorized" 발생

API 키가 유효하지 않거나 만료되었어요. [openrouter.ai/keys](https://openrouter.ai/keys)에서 확인하세요.

### "429 Too Many Requests" / 속도 제한

Champollion은 지수 백오프를 통해 속도 제한을 내부적으로 처리해요. 속도 제한에 계속 걸린다면:

1. 설정에서 **배치 크기를 줄이세요**:
   ```json
   { "batchSize": 15 }
   ```
2. **속도 제한이 더 높은 모델을 사용하세요** (예: `google/gemini-3.8-flash`는 제한이 넉넉해요)
3. 처리량이 많은 언어 쌍에는 **더 저렴하거나 빠른 방식을 사용하세요** — Google Translate에는 속도 제한이 없어요:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### 모델을 찾을 수 없음 / 404 오류

직접 LLM 제공업체(`openai`, `anthropic`, `gemini`)에는 해당 제공업체 고유의 모델 이름이 전송돼요. 해당 벤더의 OpenRouter 형식 ID는 자동으로 매핑돼요 (`gemini`에서 `google/gemini-3.8-flash` → `gemini-3.8-flash`). 다음과 같은 메시지와 함께 실행이 중단되는 경우:

**"is an OpenRouter model id … which has no model by that name"** — 다른 벤더의 OpenRouter 형식 모델을 사용하고 있어요 (`openai`에서 `google/gemini-3.8-flash`). 아무것도 전송되지 않았어요. 해당 제공업체의 모델 이름을 지정하거나, 해당 모델을 지원하는 방식을 사용하거나, `llm` 방식으로 전환하여 OpenRouter를 사용하세요. 메시지에 각각의 내용과 모델이 설정된 위치가 표시돼요:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

또한 처음 사용할 때 모델 이름을 확인해요. 다음과 같은 경고가 표시되는 경우:

**"is an Anthropic/OpenAI/Gemini model"** — 잘못된 제공업체로 모델을 보내고 있어요:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — 모델이 더 이상 사용되지 않거나 철자가 틀렸을 수 있어요. Champollion은 제공업체의 실시간 모델 목록을 가져와 대안을 제안해요. 현재 모델 이름은 제공업체의 문서를 확인하세요.

:::tip[모델 지원 중단은 발생해요]
공급자는 정기적으로 모델 이름을 폐기해요. 공급자 업데이트 이후 번역이 갑자기 실패한다면 `[WARN]` 출력을 확인해 보세요. 현재 사용 가능한 대안을 보여줄 거예요.
:::

### `local`: "could not reach …"

`local` 방식은 로컬 머신의 OpenAI 호환 서버(Ollama, vLLM, LM Studio, llama.cpp)로 요청을 보내요. 연결할 수 없는 경우, 오류 메시지에 시도한 주소와 해당 주소를 지정한 설정 항목이 표시돼요:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

주소는 환경 변수 또는 `.env.local` / `.env`에 설정된 항목 중 `LOCAL_API_BASE`, `OPENAI_API_BASE`, `OPENAI_BASE_URL` 순으로 가장 먼저 발견된 값을 사용해요. 아무것도 설정되어 있지 않으면 Ollama의 기본값인 `http://localhost:11434/v1`를 사용해요. 서버를 시작하거나 메시지에 표시된 설정을 수정하세요.

## 번역 품질

### 번역이 원본 언어를 그대로 반복함

품질 게이트가 이를 잡아내요. 번역이 영어 원본과 동일하면 거부되고 재시도돼요. 이 문제가 계속되면:

1. **모델 확인하기** — 특정 언어 쌍에서는 성능이 떨어지는 모델이 있어요
2. **어조(register) 지침 추가하기** — 모델에 어떤 언어로 출력할지 지시하세요:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **다른 모델 시도하기** — `gpt-4o-mini`에서 `gpt-4o` 또는 `google/gemini-3.1-pro-preview`로 변경해 보세요

### 잘못된 문자 체계 출력 (예: 일본어에 라틴 문자 사용)

품질 게이트의 문자 체계 준수 검사가 대부분의 경우를 잡아내요. 이 문제가 계속되면:

- 로케일 코드가 올바른지 확인하세요 (`jp`가 아니라 `ja`)
- `register` 필드에 명시적인 문자 체계 지시문을 추가하세요:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### 이름이 검증에 실패하는 경우 (예: 일본어의 "Curtis Forbes")

로마자 표기가 올바른 이름이므로, Champollion에 어떤 것이 이름인지 알려주세요:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

모델에 이름을 표기된 그대로 유지하도록 지시하며, 이러한 이름으로만 이루어진 값은 번역되지 않았거나 잘못된 문자로 보고되지 않아요. 목록이 없으면 비로마자 언어에서 짧은 로마자 값은 이름인지 레이블인지 묻는 재시도를 한 번 거치게 돼요. 모델이 이를 그대로 유지하면 이름으로 승인되어 캐시되므로 추가 비용이 다시 청구되지 않아요. `--no-verify`는 필요하지 않아요.

### 출력의 환각 패턴

반복되는 트라이그램 패턴(예: "hello hello hello")은 환각 루프 감지기가 잡아내요. 출력이 깨졌지만 감지기를 통과하는 경우:

1. **배치 크기를 줄이세요** — 더 작은 배치는 더 집중된 출력을 생성해요
2. **더 강력한 모델을 사용하세요** — 더 큰 모델은 비라틴 문자 체계에서 환각이 덜 발생해요
3. **코칭 데이터를 추가하세요** — 사전 용어가 번역을 고정시켜줘요

## 파일 & 형식 문제

### "No locale files found"

Champollion은 로케일 파일을 자동으로 감지해요. 찾을 수 없는 경우:

1. **`localesDir`를 확인하세요** — 로케일 파일이 있는 디렉터리를 가리켜야 해요:
   ```json
   { "localesDir": "./locales" }
   ```
2. **파일 이름을 확인하세요** — 파일은 로케일 코드로 이름이 지정되어야 해요: `en.json`, `fr.json` 등
3. **형식을 확인하세요** — 지원되는 형식: JSON, 중첩 JSON, YAML, TOML

### 잠금 파일 충돌

`.champollion.lock` 파일은 각 번역이 어떤 영어 텍스트로부터 생성되었는지
기록해요. 일반적인 자동 생성 파일처럼 병합 충돌을 해결하면 돼요. 둘 중
한쪽을 선택하고 `npx champollion sync`를 실행한 다음, 결과를 커밋하세요.

:::warning[잠금 파일을 삭제해도 다시 번역되지 않아요]
잠금 파일이 없으면 기존 번역이 생성된 후 어떤 영어 문자열이 변경되었는지
sync가 알 수 없어요. 대상 파일에 **누락된** 키만 번역하고 현재 영어를
새 기준점으로 기록해요. 잠금 파일을 삭제하기 전에 수정된 영어 문자열은
조용히 기존 번역을 그대로 유지하게 돼요. 특정 로캘을 의도적으로 다시 빌드하려면
`--force`를 사용하세요(`--pair`로 범위를 지정할 수 있어요).
캐시된 번역은 재사용되므로 캐시에 한 번도 없었던 텍스트에 대해서만 비용이 청구돼요.
:::

### 특정 키 재번역하기

개별 번역이 잘못되어 잠금 파일을 삭제하지 않고 강제로 재번역하려는 경우:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

`--force-keys` 플래그는 해당 특정 키에 대해 잠금 파일의 해시 검사를 건너뛰어 다른 키에 영향을 주지 않고 재번역을 강제해요. `--redo keys:hero.title`는 같은 기능의 새로운 이름이에요. 둘 다 번역 메모리(Translation Memory)에 해당 텍스트가 있으면 메모리에서 제공돼요. 대신 새로 번역 비용을 지불하고 번역하려면 `--fresh`를 추가하세요. 쉼표가 포함된 키(gettext msgid는 문장 전체임)는 `\,`로 작성하고 셸을 위해 인수를 따옴표로 감싸야 해요: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify`에서 플레이스홀더 불일치(또는 기타 손상된 값)를 보고하는 경우

`champollion verify`(및 모든 sync 후 실행되는 검사)는 누락되거나 이름이 바뀐 플레이스홀더, 깨진 ICU 복수형, 글자가 삭제된 값 등 손상된 값을 보고해요. 일반적인 `champollion sync`는 이를 복구하지 **않아요**. 해당 값이 이미 디스크에 있고 잠금 파일 항목에 최신 상태로 표시되어 있으므로 sync가 이를 건드리지 않아요.

각 발견 항목에는 해당 키들을 정확히 복구하는 명령어가 표시돼요. 예:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

해당 명령어를 실행하세요. 하나의 로캘이 여러 파일에 걸쳐 있는 경우 키는 `<file>::<key>`(예: `common::nav.home`) 형식으로 작성되어, 다른 파일은 제외하고 해당 파일의 키만 재번역해요.

`--fresh`는 필요하지 않아요. 손상된 값이 번역 메모리에서 온 경우, `verify`가 이미 캐시에서 제거했으며 다음과 같이 안내해요: `[TM] Evicted 1 cached translation(s) that produced damaged values`. 그런 다음 재작업(redo) 시 손상된 값을 다시 가져오는 대신 텍스트를 다시 번역하거나(또는 캐시에 저장된 다른 정상 번역을 제공) 처리해요. 직접 수정한 값은 캐시되지 않으므로 제거되는 내용이 없으며, 재작업도 동일한 방식으로 동작해요.

Markdown/MDX 콘텐츠 파일의 경우, 대신 경로 또는 glob과 함께 `--retranslate`를 사용하세요(예: `--retranslate docs/intro.md`). 파일이 최신 상태이거나 직접 번역한 것이라도 새로 번역해요. 강제로 재번역하지 않고 일부 콘텐츠 파일로만 실행을 제한하려면 `--files`를 사용하세요.

### 콘텐츠 번역이 코드 블록을 손상시킴

이런 일은 발생하지 않아야 해요 — 코드 블록은 번역 전에 보호돼요. 만약 발생한다면:

1. 코드 블록이 표준 펜싱(삼중 백틱)을 사용하는지 확인하세요
2. 원본 Markdown에 닫히지 않은 코드 블록이 있는지 확인하세요
3. 이슈를 제출하세요 — 이것은 센티넬 보호 시스템의 버그예요

## CLI 문제

### `--watch`가 변경 사항을 감지하지 못함

파일 감시는 Node.js 네이티브 `fs.watch`을 사용해요. 알려진 문제:

- **네트워크 드라이브** — `fs.watch`는 NFS/SMB 마운트에서 안정적으로 작동하지 않아요
- **Docker 볼륨** — 폴링 모드를 사용하거나 컨테이너 내부에서 champollion을 실행하세요
- **대규모 디렉터리** — 감시기는 `localesDir`을 재귀적으로 모니터링해요; 매우 깊은 트리는 OS 제한을 초과할 수 있어요

### `npx`가 이전 버전을 실행함

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

또는 전역으로 설치하세요:

```bash
npm install -g champollion
champollion sync
```

## 성능

### 여러 언어에 대해 동기화가 느림

Champollion은 기본적으로 모든 로케일을 병렬로 번역해요. 그래도 동기화가 느린 경우:

1. **대용량 페어에는 Google Translate를 사용하세요** — LLM 번역보다 10~50배 빨라요
2. **배치 크기를 늘리세요** (기본값은 80):
   ```json
   { "batchSize": 120 }
   ```
3. **동시성을 조정하세요** — JSON 로케일 병렬성은 기본값이 200이고 콘텐츠는 48이에요. API 제공업체가 더 높은 속도 제한을 지원하는 경우:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **빠른 모델을 사용하세요** — `gpt-4o-mini`는 `gpt-4o`보다 훨씬 빨라요

### 높은 API 비용

- **배치 크기를 확인하세요** — 더 큰 배치 = 더 적은 API 호출 = 더 낮은 비용
- **Translation Memory를 사용하세요** — TM은 기본적으로 켜져 있어요. `champollion tm stats`를 실행하여 작동하는지 확인하세요. 여러 번 동기화한 후에도 0개의 항목이 표시되면 `.champollion/` 디렉터리 권한에 문제가 있을 수 있어요
- **프롬프트 캐싱을 사용하세요** — Champollion은 Anthropic 및 Google 모델에서 캐시 적중을 위해 시스템/사용자 메시지를 분리해요
- **Tier 2 언어에는 Google Translate를 사용하세요** — [30개 언어 번역하기](/docs/tutorials/translate-30-languages) 쿡북을 참조하세요

### 모델 또는 제공업체 변경 후 번역

방식(예: `llm`에서 `deepl`로), 어조 또는 코칭을 변경하면 캐시 키에 포함되므로 다시 번역되는 항목에 대해 새 번역이 생성돼요. 하지만 일반 sync는 이미 완료된 항목을 다시 번역하지 않으며, `champollion sync --redo all`를 사용해야 해요. 동일한 방식 내에서 **모델**만 변경하는 경우에는 이전 모델이 번역한 내용을 비용 없이 재사용하며, sync가 예상 비용 표시 전에 이를 알려줘요. 새 모델 자체의 번역을 원하는 경우:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change`만 단독으로 사용하는 경우 실행 시 원래 번역 대상인 키(신규 또는 변경된 키)만 변경돼요. 모델만 변경한 후에는 일반 `sync --fresh-on-model-change`를 실행해도 아무것도 전송되지 않아요.

캐시 키 설계에 대한 자세한 내용은 [Translation Memory](/docs/concepts/translation-memory)를 참조하세요.

## 잘못된 버전 복구하기 {#recover-old-damage}

이전 파이프라인에서 작성된 값은 **절대 자동으로 복구되지 않아요**. 매니페스트 해시가 현재 소스와 일치하므로 `sync`는 이를 완료된 상태로 간주하며, 어떤 게이트(검증 단계)도 이를 다시 검사하지 않아요. 0.3.0 이전 버전을 실행했던 프로젝트를 업그레이드하는 경우 로캘 파일에 손상된 내용이 남아 있을 수 있으므로 먼저 감사를 진행하세요:

```bash
champollion integrity
```

감사는 알려진 손상 패턴을 감지하고 각각에 대한 해결 방법을 제시해요:

| 발견 항목 | 설명 | 해결 방법 |
|---------|-----------|-----|
| `UNEXPECTED PUA` | 변환을 원하지 않았는데 작성된 문자 변환 출력(pIqaD/Tengwar/Kryptonian) — 공백으로 렌더링됨 | `champollion repair-script` (오프라인, pIqaD에 정확함) |
| `HOLLOWED VALUES` | 글자가 삭제된 소스 — 콘텐츠 보존 게이트가 도입되기 전의 출력물 | 재번역(아래 참조) |
| `NO-TRANSLATE DRIFT` | "번역"되어 버린 URL 또는 기타 원문 유지(verbatim) 키 | `champollion sync` (무료로 자동 복구됨) |

내용이 비워진 값 — 또는 더 이상 신뢰할 수 없는 로캘의 경우 — 다시 빌드하세요:

```bash
champollion sync --pair en:tlh --force
```

`--force`는 지정된 언어 쌍의 모든 소스 키를 대기열에 다시 등록해요. 번역 메모리(Translation Memory)에 일치하는 항목은 여전히 제공되지만, 제공되는 모든 항목은 **먼저 현재 게이트를 기준으로 유효성 검사를 거쳐요**. 게이트에서 거부된 캐시 값은 제거되고 새로 비용이 청구되므로, 오염된 캐시가 재빌드에 전달되는 대신 캐시 자체가 스스로 복구돼요. 기존 캐시와 관계없이 완전히 새로 비용을 지불하고 번역하려면 `--no-tm`를 추가하고, 어느 쪽이든 비용 상한을 두려면 `--max-cost`를 추가하세요.

동기화 후 검증에서도 이러한 패턴이 보고되므로, 손상된 로캘이 조용히 배포되는 대신 명확한 해결 방법과 함께 `sync` 실패로 처리돼요.

### `--no-tm` 정리 후 1회성 대기열 재등록 {#one-time-requeue}

복구에 `--no-tm`를 사용했다면 **다음** sync 시 이미 완료되었다고 생각했던 소스 반영(source-echo) 키들이 대량으로 대기열에 들어갈 수 있어요. `--no-tm`는 번역 메모리에 등록(stamping)하지 않고 값을 작성하므로, 소스와 동일한 *미등록* 값은 번역되지 않은 값과 구분할 수 없어요. 따라서 한 번 대기열에 들어가 다시 처리되고(종종 동일한 값으로 반환됨), 메모리에 등록된 후 영구적으로 안정화돼요. 이는 한 번만 발생하는 비용이며 무한 루프가 아니에요. 대상 키를 미리 확인하려면 다음을 실행하세요:

```bash
champollion sync --dry --list-keys
```

## 여전히 막혔나요?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — 기존 이슈를 검색하거나 새 이슈를 제출하세요
- **[아키텍처 문서](/docs/concepts/architecture)** — 시스템 설계를 이해하세요
- **[품질 게이트](/docs/concepts/quality-gate)** — 검증이 내부적으로 어떻게 작동하는지 알아보세요
