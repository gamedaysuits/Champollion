---
title: "서빙 및 배포"
slug: /agents/serving
description: "측정된 모델을 실제로 활용해 보세요: nmt-forge export가 작성하는 deployment/1 파일, mt-eval translate 및 serve, nmt-forge serve와 try 페이지, service-api/1 /translate 규약, champollion connect, 에이전트로 구동되는 champollion sync와 함께 로컬 전용 출력이 할 수 있는 일과 할 수 없는 일을 알아봅니다."
---

# 서빙 및 배포

**배포(deployment)는 소스 전용 입력에 대한 측정 파이프라인이에요.** 하나의
deployment/1 파일은 방법, 해당 모델, 게이트 및 언어 쌍을 지정해요.
동일한 파일이 테스트 세트에서 테스트되고, 파일에 대해 실행되며, 서빙되므로
측정된 결과물이 그대로 배포돼요. 이 페이지는
[직접 활용하기](/docs/put-it-to-work)의 에이전트 측 설명서예요.

전반적인 주의 사항: 로컬 전용으로 표시된 문장으로 학습한 모델은 해당 문장을 그대로 재현할 수 있으므로,
**그 출력 역시 로컬 전용이에요**. 데이터 보유자가 달리 동의하지 않는 한, 아래의
모든 도구는 해당 출력을 이 컴퓨터에만 유지하며,
`--holders-agreed-by` 플래그는 누가 동의했는지를 기록해요. **참고.** 해당 플래그는
데이터 보유자가 동의했다고 전달받은 후, 담당자가 알려준 이름으로만 전달하세요.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. 필수: `id`,
`pair`(`source`, `target`, 선택 사항 `target_script`), `method`(`method`,
선택 사항 `model`). 선택 사항: `gates`(gate-chain/1 파일) 및 `serve`
(`host`, 기본값 `127.0.0.1`; `port`). 경로는 레일이 명령을 실행하는
프로젝트 루트를 기준으로 해요. 점수는 지정하지 않아요.

**누가 작성하는가.** 내보내기 결과물이 레일
프로젝트(상위 디렉터리에 `champollion.project.json` 존재) 내에 위치할 때, `nmt-forge export` 명령어가
`deploy/<name>.json` 파일을 작성해요. `<name>`는 케밥 케이스(kebab case)로 표기된 `--name`이며, 그렇지 않으면
`nmt-forge-<run>`이에요:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

내보내기 결과물이 레일 프로젝트 외부에 있거나, 모델이 디코드 훅 하에서 선택되었거나(forge의
훅은 `nmt-forge serve`만 실행해요), 설정에 언어 쌍이 지정되지 않았거나,
문서 유효성 검사에 실패하거나, `deploy/<name>.json`가 이미 다른 모델을 배포 중인 경우(덮어쓰지
않음)에는 파일을 작성하지 않아요(그리고 `no deployment file: …` 메시지를 출력해요).

**누가 읽는가.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**잠금.** `--deployment`를 사용할 때, `run` 및 `translate`는 `--method`,
`-m`/`--model`, `--gates`, `--target-script` 옵션을 거부해요(*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*). `serve` 역시 `--pair`를 거부해요. 다른 언어 쌍의 입력은 거부돼요
(`deployment <id> translates from <src>; this input is in <x>`). 게이트 체인에 대체(fallback)가 있는
배포는 번역 및 서빙은 가능하지만,
측정할 수는 없어요. `mt-eval run`는 대체가 설정된 체인을 거부해요
([방법 및 게이트](/docs/agents/methods#gate-chains)).

## 내보내기 결과물에 포함되는 내용

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` 명령어가 작성하는 항목:

| 경로 | 설명 |
|---|---|
| `<dir>/model/` | 배포할 폴더: 가중치 및 토크나이저, `forge-model.json`(학습 대상 데이터, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, 종류 `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate`(`--port`가 아니면 포트 8378), `card.commercial_ready: false`, 테스트 세트 chrF++, 신뢰 구간 및 n이 포함된 `evidence` |
| `<dir>/evaluation/` | 테스트 세트 증거(evidence). 절대로 모델과 함께 복사하지 마세요 |
| `<dir>/input-words.json` | 학습 문장의 입력 측 단어 목록, 중복 없이 정렬됨(`words`, `english`, `sentences`, `from`, 그리고 실행 시 읽었던 방식대로 읽을 수 없었던 학습 파일을 가리키는 `notes`). `model/` 내에 두지 않고 항상 그 옆에 둠: 사람들의 데이터에서 나온 단어이기 때문이에요. 내보내기에 모델이 포함되어 있고 해당 학습 파일이 이 컴퓨터에 있을 때 작성돼요. 그렇지 않으면 내보내기 요약에 `why`와 함께 `input_words.written: false`로 표시돼요. `nmt-forge serve`는 이를 읽어 모델이 본 적 없는 단어를 명시해요([아래 내용](#words-the-model-never-saw)) |
| `<dir>/README.md` | 내보내기 결과물에 대한 설명 |

## `mt-eval translate`

파일에 대한 파이프라인이며, 점수는 매기지 않아요. `--out`는 `.jsonl`(세그먼트당
한 행: `id`, `source`, `output`, `error`, 게이트 사용 시 `gates`,
`shipped_from`, `fallback`) 또는 `.tsv`(소스, 탭, 출력)를 받아요. `--out`가
없으면 출력 폴더(`-o`)에 `<run id>.translations.jsonl`를 작성해요.
출력 파일은 set/1 사이드카에 입력 데이터의 약관과 모델의 약관을 함께 유지해요.

**잠금.** 방법의 출력(또는 해당 게이트 체인의
대체 출력)이 로컬 전용인 경우, 번역이 시작되기 전에 프로젝트 외부의
대상 경로가 거부돼요: *"refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project"*. 동의가 있으면 사이드카에
`holders_agreed: {by, date}`가 기록되며, 해당 파일은 모든 도구에 대해 로컬 전용으로 유지돼요.

`--json`는 `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed`, `output_gates`를 출력해요. 모든 행이 실패하면 종료 코드 1로 끝나요. 점수가 없으므로
`--publish`는 거부돼요.

## `mt-eval serve`

| | |
|---|---|
| 기본 주소 | `127.0.0.1:8379`(`--host`, `--port` 또는 배포의 `serve` 블록) |
| 서빙 대상 | 이 프로세스에서 실행되는 방법만 해당: `lexicon`, `local-model`, 또는 method.json에서 `dependency_class`를 `S` 또는 `O`로 선언한 플러그인. LLM이나 호스팅 엔진은 거부됨 |
| 토큰 | `MT_EVAL_SERVE_TOKEN`, 환경 변수를 통해서만 설정 가능. `127.0.0.1`, `::1`, `localhost` 이외의 주소에서 수신 대기할 때 필수. 설정된 경우 모든 `POST` 요청(루프백 포함)에 필수. `GET /health`에는 필요하지 않음 |
| 제한 사항 | 본문 1,000,000바이트, 키 500개, 문자열당 20,000자 — 하나라도 초과 시 `413` 반환 |
| 게이트 | `--gates <chain>`(또는 배포의 `gates`). 모든 게이트 플러그인은 참조문 없이 판정해야 하며, 그렇지 않으면 시작되지 않음. 여기서는 대체(fallback)가 허용되며, 반드시 이 프로세스에서 실행되어야 함 |

**잠금 — 루프백 외부.** 토큰이 없는 경우: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"*. 로컬 전용
출력인데 동의가 없는 경우: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"*. 사전의 사이드카에 그렇게 명시되어 있거나(또는
읽을 수 없는 경우), 모델 폴더의 `forge-model.json`에 로컬 전용
학습 약관이 기록되어 있거나 아무것도 기록되어 있지 않은 경우 출력은 로컬 전용이에요.
플러그인 또는 `forge-model.json`가 없는 모델 폴더의 경우 알 수 없음(`null`)으로 보고돼요.

`/health`는 `status`, `method`, `model`, `pair`, `deployment`(`id`,
`sha256`), `runs`(이 프로세스 내에서 처리됨 — 아무것도 외부로 전송되지 않음), `scored`
(없음), `output_gates` 및 `gates`(체인 ID, 핑거프린트, 게이트, 대체),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source`(저장소), `version`를 응답해요.

게이트를 사용할 때 거부된 세그먼트는 해당 게이트의 설정에 따라 반환돼요: `drop` — `errors`
아래의 키, `keep-source` — 소스 원문, `flag` — 출력(`meta.gates.flagged`에
지정된 키), `fallback` — 게이트가 승인한 경우 대체의 번역문.
게이트가 없으면 반환하는 내용을 전혀 검사하지 않아요.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| 기본 주소 | `127.0.0.1`, 포트 `NMT_FORGE_SERVE_PORT` 또는 8378 |
| 토큰 | `--token` 또는 `NMT_FORGE_SERVE_TOKEN`. 루프백 외부에서는 필수. `--detach`는 환경 변수에서만 가져옴 |
| 라우트 | `GET /` — 사용자를 위한 체험 페이지(토큰 없음, 토큰이 설정되어 있으면 요청함), `GET /health`, `POST /translate`(service-api/1), `POST /v1/chat/completions`(OpenAI 호환), `GET /v1/models` |
| `--detach` | `/health` 응답 시 반환. 120초 이내에 응답이 없으면 중지됨. 포트가 이미 응답 중이면 거부됨 |
| `--no-hook` | 실행의 디코드 훅 없이 서빙(`/health` 및 `meta`에 명시됨) |
| `--allow-locale` | 이 로캘 코드도 허용(반복 가능) |
| `--device` | `auto`(기본값) 또는 `cpu`. `auto` 사용 시, 동일 프로젝트의 학습 작업이 실행 중일 때 시작된 서버는 GPU를 공유하지 않고 CPU를 사용하며, `/health`에 그렇게 명시됨(`device_note`) |
| 제한 사항 | 본문 1,000,000바이트, 키 500개, 문자열당 20,000자, 요청당 5,000 단위 모델 작업 — 하나라도 초과 시 `413` 반환. 모델에는 한 번에 32 단위씩 요청되므로, 다른 요청의 문장은 전체 요청이 아니라 청크 하나만 기다리면 됨. 600초 후에도 계속 실행 중인 요청은 부분적으로 응답되지 않고 전체가 거부됨 — `503`, *"send fewer pieces at a time"* |
| 디코딩 | 내보내기 결과물에 `beams_applied`가 기록된 경우 해당 `num_beams`를 사용한 빔 검색(모델 측정 당시와 동일), 이전 버전 내보내기의 경우 그리디(greedy) 검색. 전송된 텍스트는 학습 데이터와 마찬가지로 NFC로 정규화됨 |

**잠금.** 루프백 외부에서는 로컬 전용 문장으로 학습되었거나
학습 데이터에 대한 기록이 없는 등 출력이 로컬 전용인 모델은
`--holders-agreed-by` 없이는 거부돼요. `/health`는 `pair`, `accepts`,
`decode_hook`, `run`, dev 및 test 보고서, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits`(`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline`, `output_gates`를 보고해요. 로컬 전용 모델의 모든 `/translate` 응답에는
`meta.output_local_only: true` 헤더가 포함되며, 모든
`/v1/chat/completions` 응답에는 `meta.output_local_only`(true 또는 false)가 포함돼요.
길이 제한으로 인해 요청 내용이 잘린 경우, 해당 요청의 `meta.cut`는
입력 시 잘린 문장 수(`inputs`)와 상한선에 걸려 중단된 번역
수(`outputs`)를 집계해요([학습](/docs/agents/training#the-guarded-loop)).

**참고.** 체험 페이지는 사람을 위한 페이지예요. `try_translation`(MCP)는 로컬 전용 모델의 경우
사용자를 해당 페이지로 안내해요. 그 출력을 읽기 위해 직접 `/translate`를 호출하지 마세요
([계약](/docs/agents/contract) §1).

### 모델이 본 적 없는 단어

학습 과정에서 모델이 본 적 없는 단어가 포함된 문장은 아무리 매끄럽게 읽히더라도 오역되었을
가능성이 매우 높아요. 가상의 테스트 언어 실험에서,
모델이 본 적 없는 내용어를 포함한 평가용 문장은
358회 중 올바르게 번역된 적이 단 0회였으며(1,600쌍, 6,400쌍, 25,600쌍으로 학습한 ByT5-small),
그럴듯하게 틀린 결과 — 매끄럽고 모든 단어가 실제 형태이지만 의미는 잘못된
번역 — 가 나온 비율이 각각 32%, 55%, 83%에 달했어요. 즉, 모델 성능이 좋을수록 그럴듯하게
지어내는 경향이 커져요. 따라서 서버는 이러한 단어들을 명시해 줘요.

- **`/health`**는 지원 여부를 나타내요: `unseen_words_check`는 `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}` 형태예요.
- **`/translate`**는 요청에 그러한 단어가 포함된 경우에만
  `meta.unseen_words`(키 → 해당 키의 텍스트 중 모델이 본 적 없는 단어 목록, 중복 없이 순서대로) 및 `meta.unseen_note`를 추가해요. **`/v1/chat/completions`**도
  요청된 형식의 키를 사용하여 동일한 내용을 추가해요: 블록 모드에서는 세그먼트별 `SEG_<id>`,
  페이지의 경우 `page`, JSON 객체의 고유 키 또는 `text`.
- **기록 없음, 모든 응답에 표시됨.** 서버는 서빙하는 모델 폴더의 상위 폴더에서 `input-words.json`를
  읽어요. 해당 위치에 파일이 없으면 —   export made before 2026-10-13, one made without its training files on this
  컴퓨터이거나 내보내기 위치에서 다른 곳으로 복사된 모델 폴더인 경우 — 모든 응답의
  `meta.unseen_check`에 검사할 수 없다는 내용과 그 이유가 표시돼요. 모델은 해당
  export, or export it again.에서 서빙하세요.
- **체험 페이지**는 해당 라인을 다음과 같이 표시해요: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

단어란 모든 문자의 연속된 글자(내부의 아포스트로피는 유지됨)를
소문자로 변환하고 NFC로 정규화한 것이에요. 입력 측이 영어인 경우, 일반적인 영어 어미는
양방향 모두 본 것으로 간주돼요(`walk`를 본 경우 → `walked`도 인정; `walked`를
본 경우 → `walk`도 인정).

## service-api/1 — `/translate` 계약

`$schema` `https://champollion.dev/schemas/service-api/1.json`이며,
`shared/test-fixtures/framework/service-api-vectors.json` 규격을 준수해요(`mt-eval serve` 및
`nmt-forge serve`를 대상으로 실행됨).

- **요청** `POST /translate`: `keys`(키 → 소스 문자열, 필수),
  선택 사항 `source_locale`, `target_locale`, `method`, `text_format`
  (문서 텍스트의 경우 `"markdown"`), `instructions`(키 → 메모, 이를 따르도록 선언된
  서버 `accepts_instructions`에만 전송됨). 서버가
  사용하지 않는 필드는 무시되며, 거부되지 않아요.
- **응답:** `200` `{translations, meta}` — `meta`는 필수이며, `207`는
  `errors`(키 → `{message}`)를 추가해요. 오류는 `{error: {message}}` 형식이에요: 처리할 수 없는
  요청은 `400`, 토큰 누락 또는 오류는 `401`, 알 수 없는
  라우트는 `404`, 크기 초과는 `413`, 방법 실패는 `500` — 부분 응답은 절대 반환하지 않아요.
  (`nmt-forge serve`는 600초 제한을 초과한 요청에 대해 `503`도 반환해요.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false 또는 null), `cost_usd`. 서버는 필드를 추가할 수 있어요.
- **`GET /health`**는 `status`(`ok`), `pair`, `output_gates`,
  `output_local_only`가 필수이며, 선택 사항으로 `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`가 있어요.
- **규칙:** `/health`에 `output_local_only: true`로 표시된 서버는
  모든 응답의 `meta`에 `output_local_only: true`를 포함하며, 클라이언트는
  데이터 보유자가 동의한 경우에만 해당 출력을 작성해요.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

`method.json`(지정된 파일 또는 해당 폴더의 `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json`)를
찾아 앱의 `.champollion/methods/`에 설치하고, 각 언어
쌍(`<inputLocale>:<target>`)의 나머지 설정은 유지한 채 `methodPlugin`로 지정해요.
앱 폴더에는 `champollion.config.json`가 있어야 하며, 방법은
앱의 `inputLocale`로부터 번역해야 해요.

**잠금.** 해당 `forge-model.json`(누락된 경우도 포함)나
서비스의 `/health`를 통해 출력이 로컬 전용으로 확인된 모델은
`--holders-agreed-by` 없이는 거부돼요. 앱의 로캘 파일에 작성되는 내용은
앱과 함께 공개 배포되기 때문이에요. 플래그가 지정되면 각 언어 쌍에
`holdersAgreed: {by, date, method, what}`가 기록돼요. 엔드포인트에서
아무런 응답이 없거나(`nmt-forge serve <dir> --detach`로 시작 가능)
`/health`가 service-api/1을 따르지 않는 경우 실패로 처리하지 않고 경고만 출력해요. `--json`는 `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`를 출력해요.

## 에이전트가 주도하는 `champollion sync`

`sync`는 앱이나 사이트의 로캘 파일을 해당
`champollion.config.json`에 지정된 방법으로 번역해요. 대화형으로 질문을 묻지 않아요.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**`--json` 출력**은 한 줄에 JSON 객체 하나씩이에요. 표준 출력(stdout): `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}`과 함께
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify`(`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` 등이 포함돼요. 드라이 런(dry run) 시에는 `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`), `maxCost`가 추가돼요. 표준 오류(stderr): `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` 및
`error`.

| 종료 코드 | 의미 |
|---|---|
| 0 | 정상 완료 |
| 1 | `--redo` 또는 `--force-keys` 이름과 일치하는 키가 없음, 아무것도 처리되지 않은 실패, 오류 발생 |
| 2 | 호출 전 `--max-cost`로 인해 중단됨(또는 예상 비용을 알 수 없음), 또는 부분 완료: 일부 실패, 키 보류, 복수형 누락, 검증(verify) 시 오류 발견 |

드라이 런은 아무것도 전송하거나 작성하지 않고, 검증도 실행하지 않으며,
지정된 키와 일치하는 항목이 없거나 오류가 발생하지 않는 한 종료 코드 0으로 끝나요. `--no-verify`가
지정되지 않는 한, 검증은 실제 동기화 후에 실행돼요.

**잠금 — 로컬 전용 응답.** `api` 방법의 경우, 해당 언어 쌍의
`holdersAgreed`에 해당 방법이 명시되어 있지 않으면 `meta.output_local_only`가 `true`인 배치는
작성되지 않아요. `sync`는 이 내용을 한 번 출력하고 `champollion connect … --holders-agreed-by` 호출을
안내해요. 해당 키들은 번역되지 않은 상태로
남거나 언어 쌍의 대체 방법으로 전달돼요.

**잠금 — `local` 방법.** `local` 방법(OpenAI 호환
엔드포인트)은 서버의 `/health`를 한 번 조회해요. 로컬 전용
문장으로 학습된 모델에 대해 `nmt-forge serve`가 그러하듯 서버가
`output_local_only: true`라고 응답하면, 해당 언어 쌍의
`holdersAgreed`에 `local`가 명시되어 있지 않는 한 해당 서버로부터 가져온 내용은 작성되지 않아요: *"the model at … says what it writes is
local-only … nothing from it was written"* 메시지와 함께
`champollion connect <the model> --holders-agreed-by "<who agreed>"` 호출이 안내돼요.
`/health`가 응답하지 않거나 `true`라고 답하지 않는 서버(예: Ollama 또는
LM Studio 서버)는 기존과 동일하게 사용돼요.

**참고.** forge 모델은 `champollion connect`(`api`
라우트)로 연결하세요. 이는 모델 자체의 학습 출처 기록을 읽고,
설치하는 방법 아래의 언어 쌍에 데이터 보유자의 동의를 기록해요.

**모델이 본 적 없는 단어.** forge 서버가 `meta.unseen_words`에 키를
명시하면, `local` 및 `api` 방법은 텍스트나 단어가 아닌 해당 키 이름으로 경고를 표시해요: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"*(이어서 *"and <n> more"*).
번역문은 그대로 작성되며, 이 경고를 통해 화자가 어떤 항목을
검토해야 할지 알 수 있어요([코칭](/docs/agents/coaching)).

**참고.** 모든 `warn` 줄을 그대로 전달하세요. 기계 번역된 문자열은 화자가
검토하기 전까지는 초안일 뿐이므로, 절대로 정확하다고 표현하지 마세요.

## `champollion serve`

다른 종류의 서버: **앱 프로젝트** 자체에 구성된
번역 스택(방법, 코칭, 번역 메모리, 품질 게이트)을 다른 프로젝트에
서빙해요. 기본값은 `127.0.0.1`, 포트 1822예요. 루프백 바인드에서만 허용되는
`--no-auth`가 지정되지 않는 한, 루프백에서도 베어러 토큰(`--token` 또는 `CHAMPOLLION_SERVE_TOKEN`, 최소 12자)이
필요해요. `--emit-manifest`는 사용자를 위해 종류가 `service`인 method/1 매니페스트를 작성해요.
해당 서버의 `/health`는 service-api/1 상태
문서가 아니라 `{ok, service, version}`이므로, `champollion connect`가 이에 대한 상태 문제를 보고해요.

## 더 알아보기

- [직접 활용하기](/docs/put-it-to-work) — 일반 사용자를 위한 버전이에요.
- [방법 및 게이트](/docs/agents/methods) — method/1 및 gate-chain/1.
- [데이터 및 전송 규칙](/docs/agents/data-rules) — local-only 및
  `holders_agreed`.
- [레일 모델](/docs/agents/rails-model) — 단일 파이프라인.
- [`mt-eval` 레퍼런스](/docs/reference/mt-eval) 및
  [`nmt-forge` 레퍼런스](/docs/network/getting-started/forge-command-reference).
- 앱 및 사이트 번역: [CI/CD](/docs/guides/ci-cd),
  [문제 해결](/docs/guides/troubleshooting).
