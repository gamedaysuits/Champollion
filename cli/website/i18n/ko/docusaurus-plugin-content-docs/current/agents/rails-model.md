---
title: "레일 모델"
slug: /agents/rails-model
description: "Champollion 레일에서 프로젝트가 어떻게 구축되는지 알아보세요. 프로젝트 트리, 모든 도구가 읽는 6가지 스키마 검증 포맷, 수용된 입력부터 측정된 출력까지 이어지는 단 하나의 파이프라인, 데이터로서의 여정, 모든 거부의 형태를 설명해요."
---

# 레일 모델

레일 위의 프로젝트는 일반 파일들로 이루어진 폴더예요. 모든 도구 — `champollion` CLI, `nmt-forge`, `mt-eval`, MCP 서버 — 는 동일한 파일을 직접 읽고, 동일한 스키마를 기준으로 동일한 판정을 내려요. 다음 단계는 항상 파일에서 읽어오며, 기억해 두지 않아요. (프로젝트 외부에 존재하는 것은 두 가지예요. MCP 서버는 자체 수명 동안 한 단계의 실패 횟수를 집계하고, nmt-forge는 `~/.nmt-forge`에 머신 전체를 통틀어 하나의 훈련 큐를 유지해요.) 손으로 파일을 직접 수정한 뒤 다음 단계를 요청하면, 변경 사항이 반영된 답변을 받을 수 있어요.

이 페이지는 지도 역할을 해요. 운영 규칙은 [계약](/docs/agents/contract)에 있고, 도구 호출 방법은 [MCP](/docs/agents/mcp) 및 [셸](/docs/agents/shell)에 정리되어 있어요.

## 도구

| 도구 | 설치 | 레일에서의 역할 |
|---|---|---|
| `champollion` | npm (Node 20.11+) | 프로젝트를 시작하고, 데이터를 가져오며, 데이터 조건을 기록하고, 다음 단계를 지정하고, 개선 라운드를 실행하며, 모델을 앱에 연결해요 |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | 훈련, 스크리닝, 분할, 예측 기록, 테스트 세트 기반 모델 평가 및 내보내기, 서빙을 수행하며 원장을 관리해요 |
| `mt-eval` | `nmt-forge`(`mt-eval-harness` 패키지)와 함께 제공돼요 | 테스트 세트, 파일 또는 요청에 대해 방식을 실행하고, 게이트를 적용하며, 점수를 매겨요 |
| `champollion-mcp-server` | npx | `champollion` CLI를 제한된 자식 프로세스로 구동해요. 레일 프로필은 여섯 가지 도구로 구성돼요 |

각 도구는 독립된 프로세스로 실행돼요. MCP 서버는 사람이 입력하는 것과 동일한 명령어를 실행해요(자체 `run_next_step`은 `champollion`, `nmt-forge`, `uv tool install … nmt-forge` 이외의 다른 프로그램은 거부해요).

## 프로젝트 트리

`champollion new <folder> --from <language> --to <language>`는 다음 항목을 생성해요:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

이미 프로젝트가 있거나(종료 코드 1) 숨김 파일이 아닌 파일이 포함된 폴더(종료 코드 1), 그리고 `language` 이외의 `kind`은 거부돼요. `task` 및 `service` 프로젝트는 아직 레일에 준비되지 않았어요. `--dry`는 언어를 확인하기만 하고 아무것도 기록하지 않아요.

각 단계가 실행되면서 나머지를 추가해요:

| 경로 | 작성 주체 | 보관 내용 |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — 인접한 파일의 사용 조건 |
| `data/combined-from/` | `champollion data combine` | combine이 결합한 원본 파일들 (이동되며, 삭제되지 않음) |
| `data/not-for-training/` | `champollion data combine` | 소유자가 어떤 모델도 학습에 사용할 수 없다고 명시한 파일들 |
| `.forge/` | `nmt-forge init` | 워크숍: `eval-registry.json`, `ledger.jsonl`, 사전 등록 내역, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | 학습 설정 (명시적인 수치로 확장된 모델 프리셋) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | 선별된 학습 쌍 |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | 개발 세트, 각 라운드의 학습 파일 |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | 화자가 개발 세트를 위해 작성한 문장 — 역할 `dev`, 로컬 전용, 학습에 사용되지 않음 |
| `improve/time.json` | `champollion improve time` | 화자의 시간, 화자의 표현으로 기록된 내용 |
| `improve/round-<k>/` | improve 단계 | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (다른 모델이 초안을 작성한 행 — 현재 사용되지 않는 더 새로운 모델이거나 프로모션으로 대체된 모델: 행 번호, 실행 이름, 관계 및 각 모델의 학습 쌍 수 — 그리고 2라운드부터는 `repeat_rows`: 다시 표시된 행, 각각의 `row`, `from_round`, `from_row` 및 이전 `mark`), `marks.json` (개수, 구간을 포함한 정답 비율, `blind`, 그리고 `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | 내보낸 모델과 해당 모델의 method.json |
| `deploy/<name>.json` | `nmt-forge export` (rails 프로젝트 내부) | deployment/1 — 배포 대상 |
| `gates/*.json` | 사람 | gate-chain/1 — 출력과 실제 배포되는 내용 사이의 검사 |
| `methods/<id>/method.json` | 사람 | method/1 (`nmt-forge export`에 의해 모델 폴더 `mt-eval export` 및 `champollion serve --emit-manifest`에도 작성됨) |

## 포맷

`shared/schemas/framework/`에는 여섯 가지 프레임워크 스키마가 있어요. 각 문서는 `$schema`에 해당 스키마를 명시해요. 알 수 없는 키는 거부되며, 사용자 정의 키는 `x-` 아래에 추가해야 해요.

| 포맷 | `$schema` | 위치 | 설명 |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | 결정 사항만 포함: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | 데이터 파일의 조건: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, 등록 필드, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | 단일 방식: `id`, `name`, `kind` 및 해당 종류의 단일 설정, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | 순서가 지정된 `metric-threshold` 게이트 및 선택적 `fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | 단일 방식, 해당 게이트, 언어 쌍 하나, 선택적 `serve` 호스트 및 포트 |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | `/translate` 계약 | 요청, 응답, 오류 및 `/health` 문서 |

`project.defaults` — 별도의 지정이 없을 때 프로젝트에 추가된 데이터에 기본 부여되는 조건이에요. `champollion new`는 `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`은 `local-only` 또는 `ask`, `training`는 `allowed`, `not-allowed` 또는 `ask`, `share_scores`는 `never` 또는 `ask`로 기록돼요. `ask` 설정은 도구가 작업을 멈추고 확인하도록 만들어요 — 레일은 결코 답을 임의로 지어내지 않아요.

프레임워크 스키마는 아니지만 모델의 일부인 두 가지 기록이 더 있어요:

- **forge 원장**, `.forge/ledger.jsonl`: 추가 전용(append-only)이며 해시 체인으로 연결돼요(각 항목에는 이전 항목의 해시가 포함되므로, 수정이 발생하면 `nmt-forge ledger verify`가 실패해요). 등록 내역, 등록된 세트의 모든 읽기 작업, 사전 등록, 점수, 봉인 세트 사용, 오버라이드, 유출 감사 판정, 사전 최소 기준치(dictionary floor), 내보내기, 선택 항목, 서빙, 라운드 판정(`improve-compare`: `better`, `worse`, `no-change`, 또는 50개 개발 문장 미만일 때의 `too-few`), 각 라운드의 학습 방식(`round-plan`), 검토 시트를 위한 다른 모델의 초안(`draft-newer`: 실행 이름, `relation`, 각 모델의 학습 쌍 수 및 초안 수), 새 모델에 대한 화자의 블라인드 판정(`improve-speaker`: 실행 이름, 네 가지 개수, `z`, `clear`), 모델 변경 사항(`not-now`를 포함한 `model-change`), 그리고 `nmt-forge tidy`가 삭제한 내역(`tidy`: 실행 및 바이트 수)을 기록해요. 개수, 해시, 경로만 기록될 뿐, 문장은 결코 기록되지 않아요. 이는 변조 흔적을 감지하는 장부 기록일 뿐, 암호학적 보안은 아니에요.
- **실행 카드**: 채점된 실행에 대해 `mt-eval run`가 기록하는 내용이자, 게시된 결과에 포함되는 내용이에요. [실행 카드 사양](/docs/network/specifications/run-card)을 참고하세요.

**검증(Lock).** `champollion validate [folder]`는 프로젝트 파일, 모든 사이드카, 모든 `method.json`(루트, `methods/*/` 및 `.champollion/methods/*/` 내부), `gates/*.json`, `deploy/*.json`를 이 스키마들과 비교하여 검사해요. 하네스도 동일한 파일을 읽고 동일한 판정을 내려요. 종료 코드 0 = 오류 없음, 1 = 유효하지 않은 문서, 2 = 사용법 오류를 의미해요. 오직 이 JSON 파일들만 열어보며, 데이터 파일은 절대 열지 않아요.

`champollion upgrade [folder]`는 set/1 이전에 작성된 사이드카(`$schema` 없음)를 모든 값을 보존하면서 set/1 형식으로 다시 작성해요(set/1이 모르는 키는 `x-<key>` 아래로 이동해요). 유효하지 않은 사이드카는 그대로 두고, 이전 버전의 `method.json`는 수정 없이 목록에 표시해요. 모든 도구는 경고와 함께 이를 여전히 method/0으로 읽을 수 있어요.

## 단일 파이프라인

방식이 텍스트를 다루는 모든 경로는 평가 엔진 내의 단일 파이프라인으로 동작해요:

1. **수용(Admit).** 입력의 조건(set/1 사이드카, JSON 엔벨로프, 레지스트리 항목)을 읽고 번역이 이루어지기 전에 전송 정책을 결정하고 적용해요. 정책상 허용되지 않는 채널은 여기서 거부돼요([데이터 규칙](/docs/agents/data-rules) 참고).
2. **방식(Method).** 한 가지 방식이 번역을 수행해요(method/1 종류: `llm`, `llm-coached`, `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`, `human`).
3. **게이트(Gates).** 게이트 체인이 지정된 경우 각 세그먼트를 심사해요. 최초로 거부한 게이트가 무엇을 전달할지 결정해요(`drop`, `keep-source`, `flag`, `fallback`). [방식과 게이트](/docs/agents/methods)를 참고하세요.
4. **출력(Outputs).** 실행 로그가 기록돼요. 조건이 표시된 입력에서 추출된 파일은 그 조건을 나란히 생성된 사이드카에 유지해요.
5. **지표(Metrics).** 참조문이 있는 경우에만 계산돼요. 대표 점수는 전달된 번역을 평가하며, 게이트 미적용 점수가 그 옆에 나란히 놓여요. [측정](/docs/agents/measurement)을 참고하세요.

모드들은 동일한 파이프라인이 서로 다른 입력을 처리하는 형태예요:

| 모드 | 명령어 | 입력 | 지표 |
|---|---|---|---|
| 측정 | `mt-eval run`(`mt-eval test`는 실행 로그 점수를 다시 매김) | 테스트 또는 개발 세트 | 있음 |
| 파일 번역 | `mt-eval translate --out <file>` | 소스 전용 | 없음 |
| 서빙 | `mt-eval serve` | 한 번에 요청 하나씩 | 없음 |

**배포는 소스 전용 입력을 처리하는 측정 파이프라인이에요.** 단 하나의 deployment/1 파일이 테스트되고(`mt-eval run --deployment`), 파일에 대해 실행되며(`mt-eval translate --deployment`), 서빙(`mt-eval serve --deployment`)되므로 측정된 그대로 출시돼요. `--deployment`를 사용할 경우 파일에서 결정되는 플래그(`--method`, `-m`/`--model`, `--gates`, `--target-script`)는 거부돼요. 배포 파일에는 점수를 명시하지 않아요. 측정된 수치는 실행 결과이며, 해당 실행 기록과 함께 보관돼요. [서빙](/docs/agents/serving)을 참고하세요.

## 데이터로서의 여정

작업 순서는 파일 형태로 정의되어 있어요: `shared/journeys/language.json`. 평가기인 `cli/lib/framework/journey.js`가 유일한 판독기이며, `champollion next`, MCP 레일 프로필, `NEXT.md` 모두 여기에 동일한 질문을 던져요. **완료되지 않은 첫 번째 단계가 곧 다음 단계예요.** 평가기는 사이드카, 프로젝트 파일, forge의 레지스트리와 원장만 읽을 뿐 데이터 파일의 텍스트는 절대 읽지 않아요. 또한 설치 단계의 `nmt-forge --version`(최대 30초)와 작업이 훈련에 도달했을 때의 `nmt-forge status --json`(최대 60초)를 제외하고는 아무것도 직접 실행하지 않아요.

**단계.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**단계(step)**는 `id`, `stage`, `mode`, 사용자에게 설명하기 위한 쉬운 문장(`say`)과 이것이 중요한 이유(`why`)를 가지며, 대개 `command`도 포함해요. 선택 필드는 다음과 같아요:

| 필드 | 의미 |
|---|---|
| `done_when` | 단계 완료 여부를 판단하는 검사. 필수(위임 단계 제외) |
| `when` | 단계가 적용되기 위해 반드시 충족되어야 하는 검사(사전 최소 기준은 `data/lexicon/`에 파일이 있을 때만 적용됨) |
| `question`, `answers` | `ask_user` 단계의 질문 및 답변 슬롯: `{"enum": [...]}` 또는 `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | 사람의 단계를 대신해 에이전트가 직접 수행하는 작업(`add_data`로 지정된 파일 가져오기) |
| `outdated` | 검사 결과 도구 버전이 너무 낮을 때 사용되는 변형 |
| `delegate` | `"nmt-forge"`: forge 자체 어드바이저에 권한을 넘김 |

`say`, `question`, `command` 내의 `{placeholders}`는 프로젝트 파일과 발견된 파일들에서 채워져요.

**검사(Checks)** 항목은 닫힌 집합이에요. 평가기는 알 수 없는 검사를 만나면 오류를 발생시켜요:
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path`(`min_version` 동반), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**모드:**

| 모드 | 동작 주체 | 레일에서 허용하는 작업 |
|---|---|---|
| `auto` | 에이전트 | 명령어 실행 |
| `confirm` | 사용자의 승인 후 에이전트 | 설치, 훈련, 비용이 들거나 게시를 수반하는 모든 작업. 사용자가 동의한 후에만 실행 |
| `ask_user` | 사용자가 답변 | `question` 질문하기. 사용자의 답변을 `answers`의 키로 전달하며, 절대 대신 답하지 않음 |
| `wait` | 없음 | 무언가 실행 중임. 나중에 다시 확인 |
| `human_only` | 사용자 | 문장 수집, 초안 표시, 선택 |
| `use_tool` | 에이전트(자체 도구 사용) | MCP 전용: `agent` 필드가 있는 `human_only` 단계는 `step.tool`를 포함하는 `use_tool`로 표시됨 |

**위임.** `forge` 단계에서 여정은 `nmt-forge status --json`을 실행하고 forge의 상태를 해당 단계로 취해요. Forge의 상태는 다음과 같이 모드에 매핑돼요:
`training` → `wait`, `ready-to-train` 및 `needs-training-extra` → `confirm`,
`missing-preregistration` → `ask_user`, `choose-export` → `human_only`,
`improve-compare` → `auto`, `improve-promote` → `confirm`,
`improve-stronger-model` → `ask_user`. 그 외의 모든 상태는 forge가 명령어를 제시하면 `auto`, 제시하지 않으면 `human_only`가 돼요. `serving` 상태가 되면 빌드 단계가 끝나고 개선 단계가 시작돼요.

단계 목록 외부에서 주어지는 단계 유형 두 가지가 있어요:

- **예측 평가.** 테스트 세트에서 점수가 매겨진 모델을 내보낸 후, 사람들이 직접 작성한 예측 문장에 대한 그들의 판정을 기다려요: `answers` `verdict`(`held` 또는 `missed`) 및 `by`(판정한 사람)를 포함하며 `nmt-forge prereg verdict`를 실행하는 `ask_user` 단계예요.
- **동의 대기.** 사이드카에 `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting`이라고 적힌 모든 파일은, 사용자가 답변을 얻는 즉시 자체 단계 ID를 통해 답변돼요. 이 작업은 레일의 나머지 진행을 절대 가로막지 않아요.

**단계 ID**는 `<journey step id>:<8 hex characters>`예요 — 단계와 채워진 명령어의 해시값이에요. 프로젝트가 변경되면 ID도 변경되며, 이전 ID를 사용하는 `run_next_step`는 거부돼요(`the project changed since that step was named`).

**`champollion next --json` 반환값:** `project`, `kind`, `stage`(`n`, `of`, `id`, `title`), `done`(단계 ID들), `step`(`id`, `mode`, `say`, `why`, 그리고 존재하는 경우 `command`, `question`, `answers`, `agent`, `agent_tool`, `file`, `source`), `now`(forge의 팩트 — 현재 시점에 참인 정보), `waiting`, `forge`(`state`, `blockers`, `warnings`), `finished`(남은 단계가 없을 때), `error`. 오류가 발생하고 단계가 없으면 종료 코드 1이 반환돼요.

## 거부 형태

모든 거부 메시지는 어떤 일이 일어났는지 설명하며, 대부분은 그 이유와 해결책도 함께 제시해요.

| 도구 | 사람을 위한 출력 | 기계를 위한 출력 | 종료 코드 |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, 이어서 `  why: …` 및 `  fix: …` | `--json`: 표준 출력(stdout)의 `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` | 2 (거부됨) |
| `champollion` | 표준 오류(stderr)의 `[ERR] message` | 명령어가 지원하는 경우 `--json` | 1 (거부됨), 2 (사용법 오류) |
| MCP 레일 도구 | — | `isError: true`를 포함한 `{"refused": "<reason>", …}` 및 재시도가 가능한 경우 재시도 정보(`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

forge 오류의 `type`는 예외 클래스예요(잘못된 인자의 경우 `UsageError` — forge는 임의로 추측하기보다는 축약된 플래그를 거부해요). forge의 가드 이름에는 `split-guard`, `dev-fence`, `leak-audit`, `preregister`, `eval-ledger`, `ci-scoring`, `registry`, `improve-loop`, 그리고 `disk-room`(디스크 용량이 감당할 수 없는 학습 실행)가 포함돼요. 오류에서 보류된 말뭉치의 문장을 인용해야 할 때, 문장은 `[sentence withheld]`로 표시되고 객체에는 `text_withheld`가 추가돼요.

거부 내용을 쉬운 말로 전달하고 제시된 해결책을 따르거나, 다음 단계를 다시 요청하세요. 두 번 실패한 단계는 사용자가 결정하기 전까지 다시 실행되지 않아요([MCP](/docs/agents/mcp#when-a-step-fails)).

## 더 알아보기

- [운영 계약](/docs/agents/contract) — 규칙, 잠금 및 참고 사항.
- [MCP를 통한 레일 구동](/docs/agents/mcp) 및 [셸에서의 구동](/docs/agents/shell).
- [데이터 및 전송 규칙](/docs/agents/data-rules) — set/1 전체 내용.
- [방식과 게이트](/docs/agents/methods) 및 [서빙](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [실행 카드 사양](/docs/network/specifications/run-card) 및 [하네스 사양](/docs/network/specifications/harness).
- [`mt-eval` 명령어 레퍼런스](/docs/reference/mt-eval) 및 [`nmt-forge` 명령어 레퍼런스](/docs/network/getting-started/forge-command-reference).
