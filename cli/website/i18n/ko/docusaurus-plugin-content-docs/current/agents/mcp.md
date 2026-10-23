---
title: "MCP를 통해 레일 구동하기"
slug: /agents/mcp
description: "MCP 클라이언트를 Champollion의 레일 프로필에 연결하고 여섯 가지 도구로 언어 프로젝트를 진행해 보세요: 클라이언트별 설정, 모든 인수와 반환값, 루프, 스텝 모드, 거부 처리 및 설명 주제."
---

# MCP로 레일 구동하기

MCP 서버의 기본 프로필은 레일이에요. 빈 폴더에서 사용자의 자체 컴퓨터에 측정된 모델이 구축될 때까지 하나의 언어 프로젝트를 안내하는 여섯 가지 도구로 이루어져 있어요. 각 도구는 사용자가 직접 입력하는 것과 동일한 명령어로 `champollion` CLI를 별도의 제한된 프로세스로 실행해요. 서버는 연결 시점에 클라이언트에 짧은 운영 지침(`instructions-rails.md`)도 전달해요.

## 연결하기

서버는 stdio를 통해 MCP로 통신하며 Node.js 20.11 이상이 필요해요. 파일로 설정하는 모든 클라이언트가 사용하는 설정은 다음과 같아요:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| 클라이언트 | 설정 위치 |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. 항목을 추가하고 저장한 뒤 앱을 다시 시작하세요 |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | 프로젝트의 `.cursor` 폴더 내 `mcp.json` 또는 홈 폴더의 `.cursor` |

로컬 stdio 서버를 시작할 수 있는 다른 클라이언트도 동일한 명령어를 사용해요. 이 페이지에서는 위의 세 가지만 다뤄요.

**도구 경로.** 서버는 의존하는 CLI를 스스로 찾아요. `PATH`에서 `nmt-forge`을(를) 찾은 다음, `UV_TOOL_BIN_DIR`(기본값은 `uv tool install`이(가) 설치하는 위치인 `~/.local/bin`)에서 찾아요. 데스크톱 앱에서 실행된 클라이언트는 터미널보다 `PATH`이(가) 더 짧은 경우가 많아요. 재정의하려면 서버 항목의 `env`에 환경 변수로 지정하세요:

| 변수 | 영향 |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails`(기본값) 또는 `full` |
| `CHAMPOLLION_CLI_BIN` | 번들로 제공되는 것 대신 실행할 `champollion` CLI 진입점 |
| `NMT_FORGE_BIN` | `nmt-forge` 실행 파일 (CLI 여정에서도 동일한 변수가 적용돼요) |
| `UV_TOOL_BIN_DIR` | `PATH` 이후 `nmt-forge` 및 `uv`을(를) 찾을 위치 |

## 프로필

| 프로필 | 선택 방법 | 설명 |
|---|---|---|
| rails | 기본값 | 여섯 가지 도구와 짧은 지침, 하나의 언어 프로젝트를 처음부터 끝까지 진행 |
| full | `args`의 `--profile full` 또는 `CHAMPOLLION_MCP_PROFILE=full` | 모든 도구: 언어 카드, 말뭉치, 벤치마크, 큐, 콘테스트, forge 훈련, 배포 |

그 외의 다른 값을 지정하면 서버가 중단돼요: `unknown MCP profile "<value>" (rails or
full)`. 전체 도구 목록은
[MCP 서버 페이지](/docs/network/getting-started/mcp-server)에 정리되어 있어요. 언어 프로젝트의 경우 rails 프로필을 그대로 유지하세요. 모든 단계가 프로젝트 파일에서 읽히는 프로필이에요.

## 루프

1. 프로젝트가 아직 없음 → `start_project`. 첫 호출에서는 아무것도 생성하지 않아요. `ask_first`의 내용을 사용자에게 전달한 다음, 사용자의 답변에 따라 제공된 호출을 실행하세요.
2. `project_status` → `step.mode`, `step.say`, `step.why` 읽기.
3. 해당 모드의 지침에 따라 `step.call`(해당 단계를 수행하는 정확한 호출)을 사용하여 실행하세요.
4. 다시 2번으로 돌아가요. 사용자나 에이전트가 직접 수정한 사항이 있다면 `project_status`을(를) 다시 호출하세요. 다음 단계는 항상 파일에서 읽어와요.
5. `step: null` → 레일이 완료되었어요. 사용자에게 `finished`의 내용을 알려주세요.

| `step.mode` | 수행할 작업 | `step.call` |
|---|---|---|
| `auto` | 실행하세요 | `project_dir`, `step_id`을(를) 포함한 `run_next_step` |
| `confirm` | 어떤 작업인지(설치, 훈련) 사용자에게 알리고 동의 여부(yes/no)를 물어보세요. 승인한 경우에만 실행하세요. "지금은 아님(not now)"인 경우 기록만 하고 아무것도 실행하지 않아요 | 승인 후 `confirmed: true`이(가) 추가된 `run_next_step`, "지금은 아님"인 경우 `declined: true` |
| `ask_user` | 쉬운 말로 `step.question`을(를) 물어보고, `step.answers`의 키에 맞춰 답변을 전달하세요. "지금은 아님": `not-now`이(가) 슬롯 자체의 `enum` 값 중 하나인 경우 이는 답변이므로 전달하세요. 그렇지 않다면 기록만 하고 아무것도 실행하지 않아요 | `answers`을(를) 포함한 `run_next_step` — 각 슬롯은 사용자의 답변으로 대체할 수 있도록 `<…>` 형태로 작성됨. 답변 중 하나가 아닌 "지금은 아님"의 경우 `declined: true` |
| `wait` | 실행 중인 작업이 있어요 | `wait_seconds: 120`을(를) 포함한 `project_status`. 모드가 `wait`(으)로 유지되는 동안 반복하세요 |
| `use_tool` | `step.tool`을(를) 사용하여 지금 직접 처리하세요. 되돌려 보내지 마세요 | 예: `path: "<each file the person named, where it is>"`을(를) 포함한 `add_data` |
| `human_only` | 사용자가 직접 처리해야 해요: `step.say`의 내용을 알려주세요 | 없음 |

`step.command`은(는) 도구 이름이 아니라 레일이 실행하는 내용이에요. 호출에 포함된 `<…>`은(는) 사용자의 답변이나 파일을 넣는 슬롯이며, 슬롯을 그대로 다시 전송하면 거부돼요.

## 여섯 가지 도구

### `start_project`

| 인수 | 유형 | 의미 |
|---|---|---|
| `folder` | 문자열, 필수 | `parent_dir` 기준 프로젝트를 위한 새 폴더 |
| `from` | 문자열, 필수 | 입력할 언어: 코드 또는 이름 |
| `to` | 문자열, 필수 | 출력될 언어: 코드 또는 이름 |
| `target_name`, `source_name` | 문자열 | 사용자들이 부르는 해당 언어의 고유 명칭. 비표준/개인용 코드(`qaa`–`qtz`)인 경우 필수 |
| `purpose` | 문자열 | 번역의 용도(사용자가 직접 표현한 말) |
| `parent_dir` | 문자열 | 폴더를 생성할 위치 (기본값: 서버 작업 디렉터리) |
| `confirmed` | 불리언 | 사용자가 번역 방향에 동의한 후에만 `true` 설정 |

`confirmed: true`이(가) 없으면 `champollion new --dry`을(를) 실행하고 `made: false`, `ask_first`(사용자에게 말할 문장: *"이 번역기는 X를 받아서 Y로 돌려줘요. 즉 X를 넣으면 Y가 나와요. 원하는 방향이 맞나요?"*), `if_yes` 및 `if_the_other_way`(각각 완전한 호출 형태), `languages`(각 이름이 해석된 결과. 사용자의 단어가 카드에 기록된 다른 이름인 경우 `matchedAs`, 동일한 단어가 다른 언어를 가리킬 수 있는 경우 `alsoNamed` 포함)을(를) 반환해요. 둘 다 사용자에게 다시 확인해 주세요. `confirmed: true`이(가) 있으면 프로젝트를 생성하고 `project`, `languages`, `next`(첫 번째 단계)을(를) 반환해요.

어떤 카드에도 없고 유사한 것도 없는 이름인 경우, 거부 응답에 `if_it_has_no_code`(`to: "qaa"` 및 사용자가 입력한 이름을 `target_name`(으)로 지정한 동일한 호출)이(가) 추가돼요. 사용자가 알려준 이름에만 사용하세요.

### `project_status`

인수: `project_dir`(필수), `wait_seconds`(0–120). `wait_seconds`을(를) 지정하면 단계가 `wait` 상태인 동안 5초마다 다시 읽으며, 단계가 바뀌거나 시간이 초과되면 결과를 반환해요.

`project`, `stage`(`"2/6 Gather your data"`), `step`(`id`, `mode`,
`say`, `why`, `call`, 그리고 해당하는 경우 `question`, `answers`, `command`,
`tool`, `for_the_person`)을(를) 반환하며, 해당되는 경우 다음 항목도 함께 반환해요:

| 필드 | 설명 | 수행할 작업 |
|---|---|---|
| `true_now` | Forge 자체 기록(문장 형태): 훈련된 모델 및 최고 개발 chrF++, 테스트 세트별 유출 검사 판정, 테스트 세트 점수, 훈련 진행 여부, 모델 제공 여부 및 위치 | 이 내용에 적힌 작업만 전달하고 그 이상은 말하지 마세요 |
| `waiting_for_agreement` | 화자가 아직 동의하지 않은 파일(`speakers_agreed: not-yet`): 각각 `file`, `question`, `say` 및 고유한 `call` 포함 | 세션당 한 번씩 조심스럽게 질문하고, 사용자가 모두 동의했다고 말할 때만 해당 호출을 실행하세요 |
| `files_not_added` | 이번 세션에서 `add_data`이(가) 거부하여 프로젝트에 아직 포함되지 않은 파일과 각각의 거부 사유 | 각각 가져오거나(거부 메시지에 방법 안내됨), 제외된 파일과 그 이유를 사용자에게 설명하세요 |
| `model_in_use` | 모델이 제공되면 개선 라운드 단계와 함께 표시: `say`(체험 페이지 및 사용 방법) 및 `for_the_person`(앱이나 웹사이트에 적용하는 `champollion connect` 명령어) | 사용자에게 한 번 알려주세요. 사용자가 원할 때 connect를 실행해요 |
| `blockers`, `warnings` | Forge 메시지 원문 | 토씨 하나 바꾸지 말고 그대로 전달하세요 |
| `finished` | 남은 단계가 없을 때: 사용자가 지금 할 수 있는 일(페이지에서 모델 사용해 보기, 앱 등) | 사용자에게 알려주세요 |
| `error` | 단계를 지정할 수 없는 이유 | 그대로 전달하세요 |

존재하지 않거나 `champollion.project.json`이(가) 없는 프로젝트 폴더는 주변에서 발견된 프로젝트 목록과 함께 거부돼요.

### `run_next_step`

| 인수 | 유형 | 의미 |
|---|---|---|
| `project_dir` | 문자열, 필수 | 프로젝트 폴더 |
| `step_id` | 문자열, 필수 | 방금 반환된 `step.id`(또는 `waiting_for_agreement` 항목의 id) |
| `answers` | 문자열 객체 | `ask_user`: `step.answers`의 키에 따른 사용자의 답변 |
| `confirmed` | 불리언 | `confirm`: 사용자가 승인한 후에만 `true` 설정. 두 번 실패한 단계의 경우, 사용자가 그대로 다시 시도하라고 했을 때만 설정 |
| `declined` | 불리언 | `true`: 사용자가 `confirm` 단계나 자체 `not-now` 답변이 없는 질문에 "지금은 아님"이라고 답한 경우. 아무것도 실행되지 않으며 이번 세션에서는 다시 묻지 않음. `not-now`이(가) 답변 중 하나인 경우 `answers`에 전달 |

어떤 작업이든 실행하기 전에 다음 단계를 다시 읽어요. **잠금 조건:**

- 다른 id는 거부돼요: `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only`은(는) 거부돼요(`a person does this step: …`). 에이전트가 도구로 수행하는 `human_only` 단계는 사용할 도구 안내와 함께 거부돼요.
- `wait`은(는) 거부돼요. `confirmed: true` 없는 `confirm`은(는) 거부돼요(`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: 모든 답변이 필수예요(`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` 자리표시자는 거부되며, `enum` 범위를 벗어난 답변도 거부돼요).
- 레일 자체 프로그램만 실행돼요: `champollion`, `nmt-forge`, `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` 또는 단독 `&`은(는) 거부돼요. `&&`은(는) 각 부분을 연결하여 순서대로 실행하며 첫 번째 실패 시 중단돼요.
- 각 부분의 제한 시간은 10분이에요(`uv` 설치는 15분).
- `confirm`도 `ask_user`도 아닌 단계에서 `declined: true`을(를) 사용하면 거부돼요: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `answers`에 `not-now`이(가) 포함된 단계(현재 더 강력한 모델 제안의 `try_it`)에서 `declined: true`을(를) 사용하면 거부되며, 거부 메시지에 해당 단계의 `answers`이(가) 포함돼요: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

`ran`(각 부분별: `command`, `exit_code`, 타임아웃 발생 시 `timed_out`, `output`의 마지막 40줄) 및 `project_status` 형태의 다음 단계인 `next`을(를) 반환해요.

#### "지금은 아님(Not now)"

이를 기록하는 방법에는 두 가지가 있으며, 단계에 따라 결정돼요:

| 단계 | "지금은 아님"의 처리 | 기록 대상 | 다시 표시되는 시점 |
|---|---|---|---|
| `answers`에 `not-now`이(가) 포함된 `ask_user` 단계(더 강력한 모델 제안: `try_it`, `yes` 또는 `not-now`) | 답변: `answers: {"try_it": "not-now"}` | Forge 원장(`model-change`, `answer: "not-now"`), 그 외 다른 것은 변경되지 않음 | 개발 세트 평가 결과 **변화 없음(no-change)** 또는 **더 나쁨(worse)**으로 판정된 라운드가 2회 더 진행된 후(세션 간 유지) |
| `confirm` 단계(훈련, 설치, 모델 배포) 또는 사용자가 아직 답할 수 없는 질문 | `declined: true` | 이 서버의 메모리에만 기록 | 서버가 다시 시작될 때(다음 세션) |

`declined: true`은(는) 아무것도 실행하지 않으며 `declined`(단계 id), `ran: []`, `say`(*"아무것도 실행되지 않았어요. 이번 세션에서는 다시 묻지 않아요. 사용자가 먼저 이야기를 꺼내며 승인하면 그때 진행하세요."*), `next`을(를) 반환해요. 거절 상태는 서버 수명(단일 세션) 동안 유지되며, 서버를 다시 시작하면 잊혀져요. 거절 상태가 유지되는 동안 해당 단계는 `project_status` 및 `run_next_step`에서 `declined_this_session`(시점, ISO 시간 형식)과 함께 반환되며, `say`은(는) *"사용자가 이에 대해 지금은 아님(HH:MM UTC)이라고 답했어요: …"*로 시작하여 *"이번 세션에서는 다시 묻지 마세요 — 승인이 필요한 작업은 실행되지 않아요. 사용자가 직접 이야기를 꺼내며 승인하면 confirmed: true(또는 답변)로 진행하세요."*로 끝나요. 이후 `confirmed: true` 또는 답변이 전달되면 단계를 실행하고 거절 상태를 해제해요.
**참고.** 이번 세션에서는 다시 묻지 말고 단계를 우회하지도 마세요. 사용자가 직접 이야기를 꺼내며 승인하면 그때 진행하세요.

#### 단계가 실패했을 때

**잠금 조건.** 두 번 연속 실패한 단계(0이 아닌 종료 코드 또는 타임아웃, 서버 수명 동안 계산)는 `confirmed: true`이(가) `last_output`과(와) 함께 지정되지 않는 한 세 번째 시도에서 거부돼요. **참고.** 해당 플래그는 에이전트가 설정할 수 있어요. 사용자에게 출력 내용을 알려주고, 사용자가 직접 수정한 뒤(터미널에서 수정한 명령어를 실행해도 돼요 — 그런 다음 `project_status` 호출) 진행하거나, 사용자가 그대로 다시 시도하라고 할 때 설정하세요.

### `add_data`

| 인수 | 유형 | 의미 |
|---|---|---|
| `project_dir` | 문자열, 필수 | 프로젝트 폴더 |
| `path` | 문자열, 필수 | 파일 위치: 절대 경로 또는 프로젝트 폴더나 서버 시작 위치 기준 상대 경로 |
| `into` | `parallel`(기본값) · `test` · `lexicon` | 학습할 문장 쌍, 검토된 테스트 문장, 단어 목록 |
| `source_col`, `target_col` | 문자열 | 열(문자 `A`, 숫자 또는 헤더 이름). ELAN의 경우 거부 목록에 표시된 티어 번호(또는 사용자가 입력한 정확한 티어 id). LIFT의 경우 언어 코드 |
| `sheet` | 문자열 | 시트 또는 테이블이 여러 개일 때 대상 시트/테이블 |
| `header` | 불리언 | `true`: 첫 번째 행이 헤더임, `false`: 데이터임 |
| `usfm_source` | 문자열 | USFM 성경 전용: 다른 언어의 텍스트(`.usfm` 파일 또는 폴더) |
| `replace` | 불리언 | 이미 추가된 파일을 다시 읽기(다른 헤더 또는 열). 데이터 보유자의 답변은 유지됨 |

`champollion data add`을(를) 실행해요. 처음에는 경로만 지정하여 호출하세요. 언어 쌍의 언어 이름을 지정하는 헤더가 열을 결정해요. 그렇지 않으면 질문이 반환되며, 에이전트는 이를 사용자에게 물어봐야 해요(내용을 보고 임의로 결정하지 마세요). 스프레드시트(`.xlsx`, `.ods`, `.csv`), `.tsv` 및 `.txt`, Word `.docx` 표, Toolbox 및 LIFT 사전, ELAN `.eaf` 파일, USFM을 읽을 수 있어요.

`result`(CLI 보고서: 개수, 열, 번호별 ELAN 티어, 행 검사에서 지목된 행 번호 — 복사본, 반복, 비정상적인 길이, 뒤바뀌거나 밀린 행 등. 아무것도 삭제되지 않으며 문장은 절대 출력되지 않음), 서버 시작 폴더에서 파일을 찾은 경우 `read_from`, 파일에 추가 데이터가 포함된 경우(사전의 예문 쌍, 대역어 단어 목록 등) `also`(각 항목은 완전한 `add_data` 호출 형태)을(를) 반환해요. 해당 파일에 대한 사용자의 조건에서 제외하도록 하지 않는 한 호출하세요. 행 검사 결과는 있는 그대로 전달하세요. 사용자가 자신의 파일에서 해당 행들을 직접 확인해요([데이터 규칙](/docs/agents/data-rules#what-tools-print-and-never-print)). 사용자에게 파일을 이동하라고 요구하지 마세요. `inbox/`은(는) 사용자가 파일을 가져다 둘 수 있는 장소일 뿐이에요.

### `try_translation`

인수: `project_dir`, `text`(최대 10줄, 최대 2,000자, 한 줄에 한 문장, 사용자가 입력한 단어).

이 컴퓨터 내에서만 이 프로젝트가 제공하는 모델(`nmt-forge jobs --json`에서 가장 최근에 정상 작동한 `serve` 작업)을 찾고 해당 `/health`을(를) 읽어요.

- **잠금 조건.** `output_local_only`이(가) `false`(true 또는 unknown)가 아닌 경우 번역을 반환하지 않아요: `shown_to_person_only: true`, `open`(모델 자체 페이지), `say`. 사용자를 해당 페이지로 안내하세요. 번역 결과를 다시 붙여넣어 달라고 요청하지 마세요.
- 토큰을 요구하는 서버는 거부돼요. 토큰은 에이전트에 절대 전달되지 않아요.
- 그 외의 경우 `model`, `pair`, `translations`(한 줄당 `source`, `translation`), 있는 경우 `errors`, `say`을(를) 반환해요. 있는 그대로 전달하세요. 서버는 반환된 내용을 확인하지 않아요.

### `explain`

인수: `topic`. 사용자에게 전달할 쉬운 설명 텍스트:

| `topic` | 다루는 내용 |
|---|---|
| `rails` | 프로젝트 폴더와 단계별 순서 |
| `privacy` | 사이드카의 의미와 에이전트가 파일을 열어보지 않는 이유 |
| `quality` | 점수가 보장하는 것과 보장하지 않는 것 |
| `modes` | 각 단계 유형별 진행 방법 |
| `improve` | 모델 사용 후의 라운드: 검토 행 10개 중 약 1개는 *"의도적으로 이전 시트에서 다시 가져옴(시트에 그렇게 표시됨 …)"*; 더 나은 모델의 사용이 제안되고 사용자가 승인함(*"판정만으로는 아무것도 바뀌지 않음"*); 너무 적음(too-few) 판정; *"개발 세트 평가에서 개선이 없는 것으로 나타난 연속 2회 라운드 후(마지막으로 사용된 모델 기준)"* 더 강력한 모델 제안 |
| `off_rails` | 레일에서 벗어나기: 전문가 명령어를 실행한 다음 `project_status` 호출 |

## 세션 전체에 적용되는 주의사항

- **참고.** 에이전트가 읽는 모든 내용은 모델 제공업체로 전송돼요. `add_data`, `project_status`, `run_next_step`은(는) 개수, 열, 상태만 보고하며 문장은 절대 보고하지 않아요. 이 원칙을 지켜주세요. 파일을 직접 열어보지 마세요.
- **참고.** `ask_user` 답변, `confirmed: true`, `waiting_for_agreement` 승인은 사용자의 몫이에요. 도구는 답변이 존재하고 형식이 올바른지만 확인해요. 그 답변이 진짜 사용자의 것인지는 에이전트만 확인할 수 있어요.
- **참고.** `blockers`, `warnings` 및 모든 주의사항을 한 글자도 바꾸지 말고 그대로 전달하고, 모든 수치는 단위 및 측정된 세트와 함께 전달하세요([코칭](/docs/agents/coaching)).

## 더 알아보기

- [운영 계약](/docs/agents/contract) — 잠금 조건 및 참고사항.
- [레일 모델](/docs/agents/rails-model) — 여정, 모드 및 이 도구들이 읽는 단계 id.
- [셸에서 레일 구동하기](/docs/agents/shell) — 동일한 단계를 명령어로 실행하기.
- [MCP 서버](/docs/network/getting-started/mcp-server) — 두 프로필 및 전체 도구 카탈로그.
