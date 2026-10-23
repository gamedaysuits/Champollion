---
title: "셸에서 레일 다루기"
slug: /agents/shell
description: "모든 레일 단계를 일반 명령어로 실행할 수 있어요: 설치, 프로젝트 시작, 데이터 가져오기, 용어 기록, nmt-forge로 모델 훈련 및 테스트, 개선 라운드 실행, mt-eval로 번역 및 서빙 — 여기에 오프라인 모드, 도구가 읽는 환경 변수, 종료 코드까지 함께 다룹니다."
---

# 셸에서 레일 조작하기

레일의 모든 단계는 평범한 명령이에요. MCP가 없는 에이전트나 터미널 앞의 사람도 세 가지 프로그램(`champollion`, `nmt-forge`, `mt-eval`)으로 동일한 레일을 따라갈 수 있어요. 순서를 외울 필요는 전혀 없어요. `champollion next`(이)가 프로젝트 파일에서 읽어 들인 모드와 정확한 명령으로 다음 단계를 알려줘요.

규칙은 MCP를 통할 때와 같아요. `confirm` 단계는 사람이 동의한 후에만 실행되며, `ask_user` 단계의 답변은 사람의 몫이에요([계약](/docs/agents/contract)).

## 설치

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**참고.** 둘 다 패키지를 다운로드해요. `confirm` 모드이므로 먼저 물어보세요. `uv --version`이 실패하면 사용자가 https://docs.astral.sh/uv/ 에서 uv를 설치해야 해요. 에이전트는 설치 프로그램을 다운로드하지 않아요. 훈련에는 forge의 training 엑스트라(PyTorch 및 Hugging Face transformers, 수백 MB)도 필요해요. 이것이 누락되면 forge가 이를 알려줘요(상태 `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

레일에는 `nmt-forge` 0.3.0 이상이 필요해요. 이전 버전인 경우 업그레이드 명령(`uv tool install --upgrade --python 3.12 nmt-forge`)과 함께 안내돼요.

## 루프

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

사람용 출력의 `How:`(은)는 모드를 나타내요. `run it` (`auto`), `먼저 묻고
실행` (`confirm`), `데이터 소유자에게 묻기 — 절대 대신 답하지
않기` (`ask_user`), `대기 후 다시 묻기` (`wait`), `사람이 직접 수행`
(`human_only`). 안내된 명령을 실행한 다음 다시 물어보세요. 레일에서 잠시 벗어나도 괜찮아요 — 임의의 전문가 명령을 실행한 다음 `champollion next`(을)를 실행하세요. 다음 단계는 파일에서 읽어와요.

## 시작하기

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

언어는 언어 카드를 통해 확인되는 코드 또는 이름이에요. 코드가 없는 방언이나 변이형은 사용자 정의 코드(`qaa`–`qtz`)와 해당 언어 사용자들이 붙인 이름(`--target-name`, `--source-name`)을 써요. **참고.** 프로젝트가 생성되기 전에 번역 방향을 사용자에게 되풀이해 알려주세요. `--dry`(은)는 두 언어를 확인하기만 하고 아무것도 쓰지 않아요. 각 언어는 사람이 명명한 그대로 전달하세요.

## 데이터 수집 및 조건 기록

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add`(은)는 `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, Word `.docx` 표, Toolbox 및 LIFT 사전, ELAN `.eaf`, USFM(`--usfm-source`)을 읽어요. 원본은 그대로 둔 채 `<stem>.tsv` 및 사이드카 파일을 생성하며, 개수, 열, 그리고 행 검사에서 식별된 행 번호(중복, 반복, 비정상적인 길이, 뒤바뀌거나 밀린 행 등 — 어떤 것도 삭제되지 않음)만 출력하고 문장은 절대 출력하지 않아요. 어떤 열(또는 번호별 ELAN 계층, LIFT 언어)인지 구분할 수 없으면 작업을 거부하고 질문해요. 사람에게 물어보세요. `--replace`(은)는 소유자의 답변을 유지하면서 다른 열로 동일한 원본을 다시 읽으며, `--name <stem>`(은)는 다른 이름으로 다른 파일을 추가해요. [데이터 규칙](/docs/agents/data-rules#what-tools-print-and-never-print)을 참조하세요.

그런 다음 사람의 답변을 바탕으로 한 번에 한 파일씩 조건을 기록해요:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

아직 로컬 전용이 아닌 파일에는 `--local-only` 또는 `--may-leave`이 필수예요. 여정의 terms 단계에서는 훈련 관련 답변과 `--speakers-agreed`이 모두 기록될 때까지 `data/parallel/`, `data/lexicon/`, `data/grammar/`, `data/monolingual/`의 각 파일에 대해 물어봐요. 모든 값은 소유자의 결정에 따라야 해요 — 각 항목의 역할과 명령이 거부하는 조건은 [데이터 규칙](/docs/agents/data-rules)을 참조하세요.

## 테스트 세트 보호

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## 모델 빌드 및 테스트

여정에서 다음 항목들을 순서대로 안내해요(`{placeholders}` 값은 프로젝트에서 채워짐):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto`은 이 컴퓨터의 메모리를 기준으로 몇 시간 안에 훈련할 수 있는 가장 강력한 모델을 선택해요([훈련](/docs/agents/training#models)). 언어 카드가 있으면 `--no-card --name`은 제외돼요.
- `data combine`은 `data/parallel/`에 둘 이상의 파일이 있을 때만 실행돼요. 합쳐지는 파일들 중 가장 엄격한 조건을 유지하며, 보유자가 아직 답변하지 않은 파일(모델이 이를 통해 학습해도 되는지, 그리고 그 안에 말이 담긴 모든 사람이 동의했는지 여부)은 거부해요.
- `prereg new`은 `ask_user` 단계예요. `--expect`과 `--rationale`은 점수가 존재하기 전에 작성된, 사람들이 말한 그대로의 말이에요. 질문은 어떤 숫자도 암시하지 않으며, 여러분도 암시해서는 안 돼요.
- 여정이 채워 넣는 개발 세트 크기(`dev_n`)는 선별된 쌍의 10분의 1로, 최소 50개에서 최대 500개예요. 쌍이 200개 미만인 경우에는 훈련 데이터가 대부분을 유지하도록 대신 4분의 1로 설정되며, 이는 50개 미만이 돼요. 즉, 160개 쌍 중 개발 문장은 40개, 200~500개 쌍 중에서는 50개, 1,600개 중에서는 160개, 5,000개 이상에서는 500개가 돼요. 50개 미만이면 개발 세트에서 어떤 라운드도 평가할 수 없어요([측정](/docs/agents/measurement#comparing-two-models)). `--near-dupe 0.6`은 유사한 복사본들을 한쪽에 유지해요. `--max-group`은 개발 세트 크기의 절반(내림)에 1을 더한 값이에요.
- `floor`은 `data/lexicon/`에 단어 목록이 포함되어 있을 때만 적용돼요.

여기서부터는 forge 자체 어드바이저가 각 단계를 안내해요. `champollion next`(이)가 이를 전달하며, `nmt-forge status`(이)가 직접 알려줘요:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

훈련은 `confirm`이에요(몇 분에서 몇 시간에 걸쳐 컴퓨팅 자원을 사용해요). 분리된 실행(detached run)이 훈련되는 동안 이 단계는 `wait` 상태예요. `nmt-forge run`은 디스크가 감당할 수 없는 실행을 시작하기 전에 거부하며(`[disk-room]`), 여유 공간, 예상 사용량, 그리고 `nmt-forge tidy`으로 확보할 수 있는 용량을 함께 표시해요. `nmt-forge tidy --yes`은 해당 공간을 확보하고, `run`의 `--skip-disk-check`는 이를 실행에 기록한 채 그래도 시작해요. 이 두 가지는 여러분이 아닌 사용자가 결정할 일이에요([훈련](/docs/agents/training#disk-space)). 내보내기(export)는 테스트 세트에서 예측값과 비교하여 모델을 한 번 평가해요. 여러 내보내기 결과 중 하나를 선택하는 것은 사용자의 몫이에요(`nmt-forge choose <model folder>`). 테스트 세트 평가 후에는 사람들이 자신들의 예측을 심사해요:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(예측이 들어맞지 않은 경우 `--missed`, `--prediction`(은)는 예측 번호이며 단일 `--expect`의 경우 1, `--by`(은)는 평가한 사람의 이름이나 역할을 그들이 말한 그대로 지정해요.) 모든 forge 명령과 거부 조건은 [훈련](/docs/agents/training)을 참조하세요.

## 개선 라운드

모델 서빙이 시작되면 개선 라운드가 시작돼요:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: 개발(연습) 세트가 200문장 미만일 때는 일부 행에 초안이 없으며(50문장 미만일 때는 2개 중 1개, 50문장부터는 4개 중 1개), 화자가 직접 작성해요. `improve marks`가 이를 `data/dev/`에 기록하고 `improve prepare`가 개발 세트(`nmt-forge grow-dev`)에 추가해요(학습에는 절대 추가하지 않아요). 또한 `nmt-forge draft-newer`도 실행해요. 다른 모델이 있는 경우 — 최신 학습 모델이 사용 중이 아닐 때(해당 라운드 이후 사용되지 않음: 판단하기에 데이터가 너무 적거나, 측정 가능한 변화가 없거나, 더 나빠진 경우) 또는 승격 후 현재 사용 중인 모델에 의해 대체된 모델 — 해당 모델이 초안이 있는 행의 무작위 절반을 표시 없이 초안 작성하며, 정답 키는 시트 옆에 보관돼요(`sheet-key.json`). 그런 다음 `improve marks`가 각 모델을 따로 집계해요. 이것이 바로 블라인드 비교이며, 승격 후에 보고서가 점수 상승을 진정한 개선으로 인정하기 위해 거쳐야 하는 확인 과정이에요([측정](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, 2라운드부터: 새 문장 10개마다 1행씩(내림) 이전 시트에서 화자가 `Y` 또는 `N`로 표시했던 초안이 무작위 위치에 표시 없이 다시 돌아와요. 시트의 첫 번째 줄에는 몇몇 행이 의도적으로 다시 돌아온다고 안내하지만 어떤 행인지는 밝히지 않으며, `sheet-key.json`가 이를 나열해요(`repeat_rows`). 이 명령어는 다시 돌아온 행의 수, *"(어떤 행인지는 표시되지 않음)"*, 그리고 *"행당 약 10초가 걸리며, 다시는 학습에 사용되지 않음"*이라는 내용을 출력해요.
- `improve marks`는 다시 표시된 행을 오직 화자의 이전 표시와만 비교하여 평가하며(해당 라운드의 몫, 학습 쌍 또는 블라인드 비교에는 절대 포함되지 않아요), `repeats`를 `marks.json`에 기록하고 다음과 같이 출력해요: *"다시 표시된 행: 화자가 J개 중 A개를 이전과 똑같이 표시함(P%) — 한때 틀렸다가 이제 맞은 것 W개, 한때 맞았다가 이제 틀린 것 R개. 이번 라운드 점수에 집계되지 않으며, 다시 학습에 사용되지 않음."*
- `improve marks`는 다른 모델이 더 최신 모델이고 화자가 각 모델의 초안을 하나 이상 평가했을 때, forge에 집계 수치를 기록해요(수치만 기록하며 문장은 절대 기록하지 않아요):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  화자가 더 새로운 모델이 맞았다고 명확히 더 자주 표시한 경우, *"forge recorded it: it offers to put the newer model to use (the people say yes first)"*라고 출력해요. forge가 설치되어 있지 않거나 거부하는 경우, 표시가 기록되지 않았다는 점과 그 이유를 안내해요.
- `improve prepare`은 `nmt-forge round-plan`로 끝나요. 라운드는 사용 중인 모델에서 계속되거나(지금까지의 모든 문장을 4번 순회) 처음부터 훈련하며, 그 이유를 설명해요([훈련](/docs/agents/training#the-improve-rounds)).

그다음 Forge는 사용 중인 모델과 새 모델을 비교해 평가하고
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`), 새 모델이 눈에 띄게 더 나을 때만 사용하도록(`confirm`) 제안해요 —
또는 판정하기에 문장 수가 너무 적거나(개발 문장 50개 미만)
측정 가능한 변화가 없었던 경우에는 화자의 블라인드 평가 점수가 새 모델을 명확히 선호했을
때 제안해요. 판정 결과만으로는 아무것도 적용되지 않아요. 오직 사람들의 동의(해당 단계의
`nmt-forge export` 및 `nmt-forge choose`)가 있어야만 적용돼요. `improve marks`에서 가져온 새 쌍은 먼저 고유한 용어를 부여받아요 —
여정 중에 이를 물어봐요. 보고서를 전달하는 방법: [코칭](/docs/agents/coaching).

## mt-eval로 번역 및 서빙하기

프로젝트 내에서 `nmt-forge export`(을)를 실행하면 `deploy/<name>.json`(deployment/1)을 작성해요. 동일한 파일이 측정, 번역, 서빙을 수행해요:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **참고.** 테스트 파일에 대한 `mt-eval run`(은)는 사전 등록이 필요하지 않아요. 읽기 기록만 남겨요. 테스트 세트 평가는 `nmt-forge export`(을)를 통하거나 예측이 작성된 후에만 진행해야 하며, 그전에는 절대 진행하지 마세요.
- `--gates gates/<chain>.json`(은)는 `run`, `translate` 또는 `serve`(`--deployment` 제외)에 게이트 체인을 추가해요. `run` 및 `test`(은)는 폴백(대체)되는 체인을 거부해요. [메서드 및 게이트](/docs/agents/methods)와 [서빙](/docs/agents/serving)을 참조하세요.

## 레일 밖에서: 해당 언어에 존재하는 자원 확인하기

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## 파일 검사 및 업그레이드

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## 오프라인

`CHAMPOLLION_OFFLINE=1`(은)는 `champollion` CLI가 네트워크에 접근하지 못하도록 차단해요. 언어 카드는 번들 세트와 로컬 캐시에서만 가져오며(롱테일 카드는 가져오지 않음), 매일 진행되는 카드 캐시 갱신을 건너뛰고, `register-corpus`(은)는 파일 해시를 공개 카탈로그와 비교하지 않아요(비교가 수행되지 않았음으로 기록됨). 메서드가 전송하는 내용 자체는 변경되지 않아요. 프로바이더를 호출하는 메서드는 여전히 네트워크가 필요하며, 전송 규칙도 그대로 적용돼요.

`MT_EVAL_NO_REMOTE_REGISTRY=1`(은)는 `mt-eval`(이)가 웹에서 데이터셋 레지스트리를 가져오지 못하도록 차단해요(에어갭 환경의 컴퓨터용).

그럼에도 불구하고 레일에서 네트워크가 필요한 작업: 도구 설치, training 엑스트라 설치, 사전 학습된 모델의 최초 다운로드(`byt5-small` 또는 `byt5-small-lowmem`, 약 1.2GB. `cpu-tiny`은 아무것도 다운로드하지 않음).

## 환경 변수

운영자를 위해 코드에서 읽어 들이는 변수들이에요. 프로바이더 API 키는 프로바이더를 호출하는 메서드에만 필요하며, 레일의 기본 경로에서는 전혀 필요하지 않아요.

| 변수 | 읽는 주체 | 효과 |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP 서버 | `rails`(기본값) 또는 `full` |
| `CHAMPOLLION_CLI_BIN` | MCP 서버 | 실행할 `champollion` 진입점 |
| `NMT_FORGE_BIN` | `champollion`, MCP 서버 | `nmt-forge` 실행 파일 |
| `UV_TOOL_BIN_DIR` | `champollion`, MCP 서버 | `PATH` 후 `nmt-forge` 및 `uv`을 찾을 위치(기본값 `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: 카드 또는 카탈로그 조회 시 네트워크 사용 안 함 |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | 사용자별 카드 캐시(기본값 `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | 카드 캐시 업데이트 확인 주기(기본값 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | `auto`(이)가 선택하는 프리셋 고정(프리셋 이름이어야 함) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | 기본 포트(지정하지 않을 경우 8378) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | 베어러 토큰. 루프백 외부에서 필수 |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: 실시간 훈련 패널 비활성화 |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | 베어러 토큰(명령줄 값으로 절대 넘기지 않음) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | CLI 자체 서버용 베어러 토큰 |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: 레지스트리 가져오기 비활성화 |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | 등록된 데이터셋 경로를 먼저 확인하는 위치 |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | 기본 호스팅 모델 프로바이더 키 |

## 프로그램용 출력

| 도구 | 머신 출력 | 종료 코드 |
|---|---|---|
| `champollion` | 레일 명령에서의 `--json` (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 성공 · 1 거부됨 · 2 사용법 오류 |
| `nmt-forge` | 모든 하위 명령에서 `--json`: stdout으로 하나의 JSON 문서 출력, 나머지 전부는 stderr로 출력 | 0 성공 · 2 거부됨 (`{"error": …}`) |
| `mt-eval` | 모든 하위 명령에서 `--json` 및 `--non-interactive` | 0 성공 · 0이 아닌 값 거부됨 |

거부 형태: [레일 모델](/docs/agents/rails-model#refusal-shapes).

## 더 알아보기

- [`champollion` 명령 레퍼런스](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) 및
  [`mt-eval`](/docs/reference/mt-eval).
- [레일 모델](/docs/agents/rails-model) — 여정과 `next --json`.
- [MCP로 레일 조작하기](/docs/agents/mcp) — 6개 도구로 진행하는 동일한 단계.
- [nmt-forge로 훈련하기](/docs/agents/training) 및
  [데이터 규칙](/docs/agents/data-rules).
