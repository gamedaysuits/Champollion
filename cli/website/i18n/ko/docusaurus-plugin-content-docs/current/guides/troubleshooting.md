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
2. **더 높은 속도 제한을 가진 모델을 사용하세요** (예: `google/gemini-3.5-flash`는 넉넉한 제한을 제공해요)
3. 대용량 페어에는 **더 저렴하거나 빠른 방식을 사용하세요** — Google Translate에는 속도 제한이 없어요:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### 모델을 찾을 수 없음 / 404 오류

직접 LLM 제공업체(`openai`, `anthropic`, `gemini`)는 첫 사용 시 모델 문자열을 검증해요. 다음과 같은 경고가 표시되면:

**"looks like an OpenRouter path"** — 직접 제공업체에서 OpenRouter 형식의 모델(`google/gemini-3.5-flash`)을 사용하고 있어요. 직접 제공업체는 단순 모델 이름을 사용해요:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

또는 OpenRouter를 사용하려면 `llm` 방식으로 전환하세요:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — 잘못된 제공업체로 모델을 보내고 있어요:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — 모델이 더 이상 사용되지 않거나 철자가 틀렸을 수 있어요. Champollion은 제공업체의 실시간 모델 목록을 가져와 대안을 제안해요. 현재 모델 이름은 제공업체의 문서를 확인하세요.

:::tip[모델 지원 중단은 발생해요]
공급자는 정기적으로 모델 이름을 폐기해요. 공급자 업데이트 이후 번역이 갑자기 실패한다면 `[WARN]` 출력을 확인해 보세요. 현재 사용 가능한 대안을 보여줄 거예요.
:::

## 번역 품질

### 번역이 원본 언어를 그대로 반복함

품질 게이트가 이를 잡아내요. 번역이 영어 원본과 동일하면 거부되고 재시도돼요. 이 문제가 계속되면:

1. **모델을 확인하세요** — 일부 모델은 특정 언어 페어에서 성능이 좋지 않아요
2. **레지스터 지시문을 추가하세요** — 모델에게 어떤 언어를 생성해야 하는지 알려주세요:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **다른 모델을 사용해 보세요** — `gpt-4o-mini`에서 `gpt-4o` 또는 `google/gemini-2.5-pro`로 전환하세요

### 잘못된 문자 체계 출력 (예: 일본어에 라틴 문자 사용)

품질 게이트의 문자 체계 준수 검사가 대부분의 경우를 잡아내요. 이 문제가 계속되면:

- 로케일 코드가 올바른지 확인하세요 (`jp`가 아니라 `ja`)
- `register` 필드에 명시적인 문자 체계 지시문을 추가하세요:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

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

`.champollion.lock`가 잘못된 상태가 되면:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
잠금 파일을 삭제하면 다음 동기화 시 변경된 키뿐만 아니라 모든 키를 재번역해요. 대규모 프로젝트의 경우 API 비용에 영향을 줘요.
:::

### 특정 키 재번역하기

개별 번역이 잘못되어 잠금 파일을 삭제하지 않고 강제로 재번역하려는 경우:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

`--force-keys` 플래그는 해당 특정 키에 대한 잠금 파일 해시 검사를 무시하여 다른 키에 영향을 주지 않고 재번역을 강제해요.

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

### 제공업체 전환 후 오래된 번역

한 번역 방식에서 다른 방식으로 전환하는 경우(예: `llm`에서 `deepl`로), TM 캐시는 원본 텍스트가 변경되지 않은 키에 대해 이전 방식의 오래된 번역을 계속 제공할 수 있어요. 캐시 키에는 방식 이름이 포함되어 있어 대부분의 경우 자동으로 처리돼요. 하지만 같은 방식 내에서 `model`을 변경한 경우:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

캐시 키 설계에 대한 자세한 내용은 [Translation Memory](/docs/concepts/translation-memory)를 참조하세요.

## 잘못된 버전에서 복구하기 {#recover-old-damage}

이전 파이프라인에서 작성된 값은 **절대 스스로 복구되지 않아요**. 매니페스트 해시가 현재 소스와 일치하기 때문에 `sync`는 이를 확정된 것으로 간주하고 어떤 게이트도 이를 다시 확인하지 않아요. 0.3.0 이전 버전을 실행했던 프로젝트를 업그레이드하는 경우, 로캘 파일에 손상이 있을 수 있다고 가정하고 먼저 감사를 진행하세요:

```bash
champollion integrity
```

감사를 통해 알려진 손상 서명을 감지하고 각각에 대한 해결책을 제시해요:

| 발견 항목 | 설명 | 해결책 |
|---------|-----------|-----|
| `UNEXPECTED PUA` | 변환을 원하지 않았을 때 작성된 스크립트 변환 출력(pIqaD/Tengwar/Kryptonian) — 빈 화면으로 렌더링됨 | `champollion repair-script` (오프라인, pIqaD에 대해 정확함) |
| `HOLLOWED VALUES` | 글자가 삭제된 소스 — 콘텐츠 보존 게이트 이전의 출력 | 다시 번역하기 (아래 참조) |
| `NO-TRANSLATE DRIFT` | "번역된" URL 또는 기타 원문 그대로 유지되어야 할 키 | `champollion sync` (무료로 자동 복구됨) |

비어 있는 값이나 더 이상 신뢰할 수 없는 로캘의 경우, 다시 빌드하세요:

```bash
champollion sync --pair en:tlh --force
```

`--force`는 범위가 지정된 쌍에 대한 모든 소스 키를 다시 대기열에 추가해요. Translation Memory의 적중(hit) 항목은 계속 제공되지만, 제공되는 모든 적중 항목은 **먼저 현재 게이트를 기준으로 유효성이 검사돼요**. 게이트가 거부하는 캐시된 값은 제거되고 다시 청구되므로, 오염된 캐시가 다시 빌드에 사용되지 않고 스스로 복구돼요. 상관없이 완전히 새로 다시 청구하려면 `--no-tm`를 추가하고, 어느 쪽이든 비용을 제한하려면 `--max-cost`을 추가하세요.

동기화 후 검증에서도 이러한 서명을 보고하므로, 손상된 로캘은 조용히 배포되는 대신 `sync`에서 (해결책 이름과 함께) 명시적으로 실패해요.

### `--no-tm` 정리 후 일회성 대기열 재추가 {#one-time-requeue}

복구에 `--no-tm`을 사용했다면, **다음** 동기화 시 확정되었다고 생각했던 소스 에코(source-echo) 키 배치가 대기열에 추가될 수 있어요. `--no-tm`는 Translation Memory에 스탬프를 찍지 않고 값을 작성하며, 소스와 동일한 *스탬프가 없는* 값은 번역되지 않은 값과 구별할 수 없어요. 따라서 한 번 다시 대기열에 추가되고, (종종 동일하게) 돌아와서 스탬프가 찍히고 영구적으로 확정돼요. 이는 일회성 비용이며 무한 루프가 아니에요. 다음 명령어로 어떤 키인지 정확히 미리 확인해 보세요:

```bash
champollion sync --dry --list-keys
```

## 여전히 막혔나요?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — 기존 이슈를 검색하거나 새 이슈를 제출하세요
- **[아키텍처 문서](/docs/concepts/architecture)** — 시스템 설계를 이해하세요
- **[품질 게이트](/docs/concepts/quality-gate)** — 검증이 내부적으로 어떻게 작동하는지 알아보세요
