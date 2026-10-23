---
title: "MCP Server — 에이전트와 만나는 관문"
sidebar_label: "MCP Server"
description: "Model Context Protocol을 통해 AI 에이전트를 Champollion에 연결해요. 두 가지 프로필이 있어요. 기본값인 rails 프로필은 6개의 도구로 하나의 언어 프로젝트를 차근차근 안내하고, --profile full은 언어 조회, 벤치마크 대기열 및 말뭉치 레지스트리 둘러보기, 평가 실행, 모델 학습 및 내보내기, 번역을 위한 34개의 도구를 제공해요. 여기에 npx 설치 외에 추가 설정이 필요한 도구가 무엇인지도 정확히 알려줘요."
---

# MCP 서버 — 에이전트용 창구

`champollion-mcp-server`는 stdio 기반의 [Model Context Protocol](https://modelcontextprotocol.io)을 통해 AI 에이전트에 Champollion을 제공해요. 두 가지 프로필이 있어요:

| 프로필 | 시작 명령 | 제공 항목 | 용도 |
|---|---|---|---|
| **rails** (기본값) | `npx -y champollion-mcp-server` | 6개 도구: `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | 빈 폴더에서 사용자의 자체 컴퓨터에서 측정된 모델까지, 언어 프로젝트를 한 번에 한 단계씩 진행 |
| **full** | `npx -y champollion-mcp-server --profile full` (또는 `CHAMPOLLION_MCP_PROFILE=full`) | 도구 34개, 리소스 3개, 프롬프트 4개 | 탐색, 벤치마킹, 단계별 훈련, 번역 및 네트워크 |

누군가가 자신의 언어를 위한 번역기를 구축하도록 돕고 있다면 rails 프로필을 사용하세요. 운용 방법은 [MCP로 rails 운용하기](/docs/agents/mcp)에 있으며, 따라야 할 규칙은 [운영 계약](/docs/agents/contract)에 나와 있어요.

여기에 있는 모든 것은 일반 HTTP로도 접근할 수 있지만([기계 판독 가능한 엔드포인트](#machine-readable-endpoints) 참조), 단순히 읽는 것뿐만 아니라 에이전트가 직접 *동작*(번역, 벤치마크 실행, 모델 훈련)할 수 있게 해 주는 접점은 MCP 서버가 유일해요.

## 설치

```bash
npx -y champollion-mcp-server
```

그런 다음 클라이언트에 등록하세요. Claude Code의 경우:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

파일로 설정하는 클라이언트(Claude Desktop, Cursor, Antigravity)의 경우 다음을 추가하세요:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

full 프로필의 경우, `args`에서 패키지 이름 뒤에 `"--profile", "full"`를 추가하거나 `claude mcp add` 명령 끝에 `--profile full`을 붙이세요.

## rails 프로필 (기본값)

이 6개 도구는 빈 폴더에서 시작하여 사용자의 컴퓨터에서 직접 측정된 모델에 이르기까지 언어 프로젝트를 단계별로 안내해요. 각 단계는 어떤 도구를 호출해야 하는지 정확히 알려주며, 사용자만이 답할 수 있는 모든 질문(누가 파일을 소유하는지, 모델이 파일로부터 학습해도 되는지, 텍스트가 컴퓨터 밖으로 나가도 되는지, 기대하는 바가 무엇인지, 결과가 충분히 좋은지)은 사용자에게 다시 전달돼요. 도구는 개수와 열 정보만 보고하며, 문장은 절대 보고하지 않아요. 모든 도구는 사람이 직접 입력하는 것과 동일한 명령줄을 별도의 제한된 프로세스로 `champollion` 실행해요. 이 프로필은 짧은 지시문으로 작동하는 소형 에이전트를 위해 만들어졌어요.

| 도구 | 인자 | 역할 |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | 프로젝트를 생성해요 (`champollion new`). 첫 호출에서는 아무것도 만들지 않고 `ask_first`를 반환해요. 사용자에게 방향을 다시 전달한 뒤, 사용자의 답변에 맞춰 제공된 호출을 실행하세요 |
| `project_status` | `project_dir`, `wait_seconds?` (최대 120개) | 파일에서 읽어온 다음 단계 (`champollion next --json`): 모드, 전달할 내용, 이유, 이를 실행하는 정확한 호출 |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | `project_status`가 방금 지정한 단계를 실행해요. `confirm` 단계는 사용자가 승인한 후 `confirmed: true`가 필요하고, `ask_user` 단계는 사용자 자신의 답변이 필요하며, `human_only` 및 `wait` 단계는 대신 수행할 작업 안내와 함께 거부돼요 |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` 또는 `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | 스프레드시트, Word 표, Toolbox 또는 LIFT 사전, ELAN 파일, USFM 성경 등 파일이 위치한 곳에서 가져오며(`champollion data add`), 문장은 절대 보고하지 않고 개수와 열 정보만 보고해요 |
| `try_translation` | `project_dir`, `text` (최대 10줄) | 프로젝트가 제공하는 모델로 사용자의 문장 몇 개를 번역해요. 로컬 전용 문장으로 학습한 모델의 경우 텍스트 대신 모델 자체 페이지 주소를 반환해요 |
| `explain` | `topic`: `rails`, `privacy`, `quality`, `modes`, `improve` 또는 `off_rails` | 사용자에게 전달할 쉬운 설명 |

## full 프로필

아래 내용은 탐색, 벤치마킹, 네트워크를 위한 모든 도구가 포함된 **full 프로필**에 대한 설명이에요:

```bash
npx -y champollion-mcp-server --profile full
```

## 사용 전 꼭 읽어두세요

**full 프로필에서는 34개 도구 중 14개가 순수 `npx` 설치 상태에서 바로 작동하며, `translate`는 엔진이 구성되면 작동해요. 나머지 19개는 npm 패키지에 포함되지 않으며 포함될 수도 없는 Python 패키지가 필요해요.** 이 도구들은 조용히 실패하지 않고 누락된 항목을 구체적으로 알려주는 실행 가능한 오류를 반환하지만, 계획을 세우기 전에 이러한 구성을 미리 알아두는 것이 좋아요.

| 도구 | `npx` 후 바로 작동하나요? | 추가로 필요한 항목 |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **예** — 읽기 전용, 공개 엔드포인트에서 제공됨 | 없음 |
| `translate` | 엔진이 있으면 **예** | 선택한 엔진용 API 키 — 또는 `local` 방식과 로컬 머신의 모델 서버 사용 시 불필요 |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | 아니요 | 평가 하네스 — `pipx install mt-eval-harness` |
| 15개의 `forge_*` 도구 | 아니요 | NMT Forge 0.2.0 이상 — `python3 -m pip install nmt-forge` (훈련 및 서빙을 하려면 `'nmt-forge[hf]'` 추가). 평가 하네스를 함께 가져오며 언어 카드를 자체적으로 찾으므로 저장소를 클론할 필요가 없어요 |

이 모든 작업에서 저장소를 클론할 필요는 없어요.

## 각 도구의 역할

**작업 탐색 및 비용 산정.** `list_queue` 및 `get_queue_item`는 공개 벤치마크 큐(언어 지도를 가장 크게 개선할 수 있는 순위별 측정 목록)를 둘러봐요. `estimate_cost`는 비용을 지출하기 전에 일련의 실행에 대한 비용을 미리 계산해 줘요.

**정보 조회.** `search_languages`는 언어 카드를 이름, 코드, 어족, 지역별로 검색하며 오타도 허용해요. 각 결과에는 해당 언어가 사용되는 위치(국가, 지도 좌표, 대지역)와 기타 명칭도 표시돼요. 단, 카드에 출처가 명시된 사실만 출처와 함께 제공되므로 이름이 유사한 언어를 서로 구분할 수 있어요. 출처가 없는 위치 정보는 절대 표시되지 않으며, 해당 줄에 그 사실을 명시하고 대신 Glottolog 레코드로 연결해요. champollion.dev에 게시된 카드 테이블에서 채워진 카드(npm 설치 시 기본 제공 코어 세트 외의 모든 언어)에는 아직 필드별 출처가 포함되어 있지 않으며(테이블의 다음 업로드 시 추가 예정), 따라서 해당 줄에는 위치 대신 Glottolog 링크가 표시돼요. `language_overview`는 특정 언어를 위한 모델 구축을 시작할 때 사용하는 1페이지 분량의 시작점이에요. 기존 자산, 실행 가능한 항목, 다음 단계가 담겨 있어요. `get_language`는 출처가 포함된 전체 카드를 반환해요. `list_corpora`는 언어 쌍이나 벤치마크 패밀리에 등록된 평가 말뭉치 목록을 표시해요. 메타데이터(크기, 라이선스, 오염도 등급, 하네스가 가져올 수 있는지 여부, 액세스 토큰 필요 여부, 격리 보관 여부)만 제공되며, 말뭉치 내용은 절대 반환되지 않아요. 모든 말뭉치가 격리된 언어 쌍은 미지원처럼 보이는 대신 격리 상태임을 명시해요. `get_results` 및 `get_run_card`는 공개 리더보드에서 점수가 매겨진 실행 결과를 읽어와요. `get_metric_reliability`는 대부분의 에이전트가 잘못 판단하기 쉬운 질문인 *이 대상 언어에 어떤 지표를 신뢰해야 하는가*에 대해 언어 패밀리별 인간 평가와의 상관관계를 바탕으로 답해 줘요. `list_contests` 및 `get_contest`는 대회와 명시된 조건을 보여줘요. 대회 참가는 사람이 승인하는 CLI 단계이며, 도구를 통해서는 실행할 수 없어요.

**직접 실행.** `translate`는 번역 메모리(반복 번역 시 비용 $0)와 결정론적 품질 게이트를 갖춘 검증된 파이프라인을 통해 텍스트를 실행해요. 모든 응답에는 실제로 실행된 엔진 이름과 가능한 경우 해당 모델 및 엔드포인트가 명시돼요.
`run_benchmark`는 평가를 시작하고 **작업 ID를 즉시 반환**해요. 실제 실행은 클라이언트 타임아웃보다 오래 걸리기 때문이에요. 이 ID로 `get_run_status`를 폴링하면 돼요. 작업은 서버가 재시작되어도 유지돼요. 실행은 계속 진행되며 나중에 동일한 ID로 폴링해도 상태와 결과가 정상적으로 반환돼요. `publish: true`를 전달하지 않으면 아무것도 게시되지 않아요. 전달할 경우 계획 단계에서 공개될 내용(문장 텍스트가 포함된 모든 행 또는 점수만, 프롬프트 원문 또는 해시만)과 공개 위치가 안내되며, 실제 게시는 계획에서 제시한 정확한 문구로 `publish_ack`를 제공해야만 진행되므로 사용자가 먼저 확인할 수 있어요. 이 플래그 없이 실행된 결과도 동일한 게이트를 거쳐 나중에 게시할 수 있어요. `preview_publish`는 읽기 전용이에요. 하네스 자체의 게시 미리보기, 정확한 문구, 게시를 수행할 정확한 `publish_report` 호출을 보여주며, 스스로 게시하지는 않아요. MCP 어노테이션 `readOnlyHint: true`가 붙어 있어 쓰기 전에 매번 확인하는 에이전트 호스트가 자체적으로 허용할 수 있어요. `publish_report`는 쓰기 작업을 수행하며(`destructiveHint` 및 `openWorldHint` 어노테이션 지정), `scores_only`는 문장 텍스트를 제외해요. 모든 계획은 대상 언어의 `EVAL PACK:` 상태(`missing`(설치 명령 포함), `ready` 또는 `none needed`)로 시작하며, 실행 시 `--yes`를 통과하므로 말뭉치 라이선스와 `do_not_train` 조건을 명시해요. FST(분석기 또는 pyhfst 런타임)가 누락되어도 실행이 중단되지는 않아요. 실행은 계속 진행되며 실행 카드에 FST 수락도가 계산되지 않음으로 표시돼요. 그 외의 구성 요소가 누락되면 번역을 시작하기 전에 실행이 중단돼요. `skip_fst` 및 `skip_eval_standard`는 이러한 요소 없이 점수를 매기며, 실행 카드에 제외된 항목이 표시돼요. 또한 계획에는 COMET 계산 여부가 명시돼요(하네스는 `unbabel-comet`가 설치되어 있을 때마다 COMET을 계산하며, `comet: true`를 지정하면 실행 시 필수로 요구돼요). `metricx` 및 `fuse`는 하네스의 선택적 MetricX-24 및 FUSE 방식 비교기를 요청해요. 계획에는 각 도구에 대해 하네스를 기준으로 설치 여부, 설치할 항목, 다운로드되는 항목이 명시돼요. 하네스가 계산할 수 없는 지표를 요청한 확정 실행은 해당 지표 없이 실행되는 대신 거부돼요. 계획의 `Results:` 및 `Cache:` 줄에는 실행 로그, 보고서, 번역 캐시가 저장되는 위치가 표시돼요. `mt-eval contest prepare`가 배포 가능으로 표시한 폴더(대회의 `public/`) 내부의 테스트 파일은 대회의 `runs/` 폴더로 실행되므로, 실행 시 작성된 내용이 함께 배포되지 않아요. 로컬 머신의 모델(로컬 서버 또는 하네스가 프로세스 내에서 실행하며 증명이 필요 없는 `method: "local-model"`)은 `$0 API cost (runs on this machine)`으로 보고돼요.

**스스로를 속이지 않는 훈련.** `get_training_guardrails`는 실제로 측정된 실패 사례에서 추출한 규칙을 반환해요. 15개의 `forge_*` 도구는 [NMT Forge](/docs/agents/training)를 보호 장치가 적용된 상태로 한 번에 한 단계씩 실행해요. 가장 먼저 그리고 매 단계 후에 실행되는 `forge_status`(다음 명령과 이를 실행할 도구를 안내), 명령이 거부되기 전에 어떤 게이트에 걸리는지 확인하는 `forge_preflight`, 테스트 점수가 존재하기 전에(그리고 테스트 세트에 대한 벤치마크가 실행되기 전에 — 점수를 읽는 작업이 발생하면 이후의 사전 등록이 차단됨) 예측을 기록하는 `forge_prereg_template` 및 `forge_prereg`, 테스트 세트를 단 한 번 평가하고 훈련된 모델을 패키징하는 `forge_export`, 승자 옆에 각 모델의 유사 복제본(near-twin) 주의사항을 나란히 표시하여 두 모델을 A/B 테스트하는 `forge_compare`, 그리고 forge가 판단할 수 없는 예측(자유 텍스트 범위)에 대해 사용자의 자체 판정을 기록하는 `forge_prereg_verdict`(계산된 판정이 아닌 사람의 판정으로 표시됨)가 포함돼요. `forge_status`는 훈련된 모든 실행을 개발 세트 점수와 함께 나열하고, 개발 세트가 포화 상태(체크포인트 선택에서 변별력이 없는 완벽한 개발 점수)인지 알려줘요. 평가 하네스가 테스트 점수에 주의사항(예: 거의 일정한 출력 — 모든 원문 문장에 대해 소수의 출력만 생성됨)을 부여하면, `forge_export`, `forge_status`, `forge_compare`, `forge_lint`는 이를 하네스 고유의 문구 그대로 전달하며, 중대한 주의사항은 다음 단계 맨 앞에 표시돼요. 점수는 주의사항 없이 단독으로 인용되지 않아요. 거부 응답이 돌아올 때는 무엇이 잘못되었는지, 왜 중요한지, 해결 방법이 무엇인지 함께 제공돼요. 도구 호출 시간보다 오래 걸려 터미널에서 대신 실행해야 하는 두 가지 단계는 훈련(`nmt-forge run`)과 내보낸 모델 서빙(`nmt-forge serve` — `translate`와 CLI가 사용할 수 있는 로컬 엔드포인트로 모델을 배치함)이에요.

### 인자

`name`는 필수이며 `name?`는 선택 사항이에요. 한 언어를 인자로 받는 모든 도구는 `language`로도 이를 허용해요. "`code` 또는 `language`"는 두 이름 모두 사용할 수 있으며 둘 중 하나를 전달하면 된다는 뜻이에요. 기존 이름도 계속 작동해요.

| 도구 | 인자 |
|---|---|
| `search_languages` | `query` 또는 `language`, `limit?` |
| `language_overview` | `code` 또는 `language`, `source?` |
| `get_language` | `code` 또는 `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (이 셋 중 최소 하나), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` 또는 `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | 없음 |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` 또는 `priority?` (둘 중 하나) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (gettext msgctxt: 모든 텍스트에 공통 적용하거나 텍스트당 하나씩), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | 모드 하나 선택: `budget?` 또는 `top?` (큐), `item_id?`, 또는 `model?`와 함께 사용하는 `corpus?`(플러그인이 로드하는 모델인 `method_dir`와 함께), `method?` 또는 `method_dir?`(방식 플러그인 디렉터리. `local-model`는 기본값이 없으므로 `model` 필요), `allow_model_pair_mismatch?`(`local-model`: 관련 언어 기준선으로 다른 언어 쌍을 지정하는 OPUS-MT 모델 실행), `attest_local_transport?`(기계 번역 엔진 또는 플러그인. `local-model`에는 필요 없음), `provider?`, `base_url?`, `target_language?`, `script?`(LLM 실행: `Cans` 또는 `Latn`와 같이 출력이 작성되어야 하는 ISO 15924 문자 체계. 대상 언어 카드에 둘 이상 나열된 경우 계획에 표시됨), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` 및 `skip_eval_standard?`(항목 및 말뭉치 실행: FST 또는 평가 표준 지표 없이 점수 산정, 계산되지 않음으로 표시됨), `comet?`(COMET 필수 요구: 미설치 시 실행 거부), `metricx_model?`와 함께 사용하는 `metricx?`, 그리고 `fuse?`(항목 및 말뭉치 실행: 하네스의 선택적 MetricX-24 및 FUSE 방식 비교기, 미설치 시 거부됨). 그다음 `dry_run?`, `confirm?`, `publish?`, `publish_ack?`(실제 게시 시: 계획이 출력하는 정확한 문구), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (완료된 실행의 `*_report.json`), `scores_only?`, `redact_coaching?`, `anonymous?` (읽기 전용: `confirm` 없음, 게시 불가) |
| `publish_report` | `report` (완료된 실행의 `*_report.json`), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (미리보기가 출력하는 정확한 문구) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (확인할 명령), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` 또는 `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` 또는 `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (기본값 `data/split`, `forge_init`의 config.json이 읽는 경로), `dev?`, `register?` (이름 접두사, 또는 `project`의 경우 `true`), `allow_rotate?`, `near_dupe?` (forge가 유사 중복 제외를 권장할 때 0.6과 같은 자카드 임계값), `max_group?` (`near_dupe`와 함께 사용: 가장 큰 유사 중복 그룹), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (자체 `clean_to`(예: `corpus.notwins.jsonl`)와 함께 사용 — 전체 데이터 파일은 절대 사용 금지), `companion_config?` (`drop_test_twins`와 함께 사용: 중복 제거 모델의 설정이 저장될 위치. 기본값 `config-notwins.json`), `overwrite?` (설정, 실행, 분할 또는 다른 감사가 사용하는 `clean_to` 파일을 교체 — 이 플래그가 없으면 거부됨), `full_indices?` (모든 행 번호 목록 전체. 기본적으로 긴 목록은 `{count, first}`로 반환됨), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (특정 실행에 고정), `allow_after_reads?` (해당 세트의 채점된 읽기 전에 작성된 예측에만 해당), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (번호 또는 고유 ID), `verdict` (`held` 또는 `missed`), `by` (판정자), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (각 모델의 실행 매니페스트: 훈련 데이터에서 유사 복제본 검사), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

예를 들어 `get_metric_reliability { "language": "crk" }`와 `get_metric_reliability { "target": "crk" }`는 같은 질문을 요청해요.

### 배포한 모델로 번역하기

`nmt-forge serve`는 제공하는 모델의 두 가지 주소를 출력해요. 둘 중 하나를 `translate`의 대상으로 지정하세요:

| 인자 | 사용 대상 | 예시 |
|---|---|---|
| `base_url` | `method: "local"` — OpenAI 호환 서버 (`"openai"` 포함) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — champollion API 규격 | `http://127.0.0.1:8378/translate` |
| `model` | LLM 엔진 전용. 시스템 프롬프트가 없는 기계 번역 API에서는 거부됨 | `llama3.1` |
| `project_dir` | 모든 방식 — 해당 프로젝트의 번역 메모리 사용 | `~/my-app` |

로컬 머신의 서버에는 키가 필요하지 않아요. 원격 `api` 엔드포인트는 서버 환경의 `CHAMPOLLION_API_KEY`에서 키를 읽어와요. 도구는 알 수 없는 인자를 무시하는 대신 해당 이름을 지정하여 거부하므로, 인자 오타로 인해 텍스트가 다른 모델로 조용히 전송되는 일이 없어요.

### 서버의 상태 저장 위치

모든 것은 `~/.champollion-mcp/`에 저장돼요(위치를 변경하려면 `CHAMPOLLION_MCP_HOME` 설정):

- **`translate`의 번역 메모리**는 해당 폴더 내의 자체 파일인 `.champollion/tm.json`예요. 이는 프로젝트의 `.champollion/tm.json`와는 별개예요. 프로젝트의 파일(해당 위치에서 `champollion sync`가 사용하는 파일)을 대신 사용하려면 `project_dir`를 전달하세요.
- **`run_benchmark` 작업**은 최신 50개를 보관하는 `jobs.json`에 기록돼요. 각 작업은 `jobs/`에 출력 결과와 함께 폴더를 가지며, 큐 항목이나 등록된 말뭉치의 경우 하네스의 결과도 포함돼요. 보유 중인 테스트 파일에 대한 실행은 결과와 캐시를 해당 파일 옆의 `results/`에 기록해요. 단, `mt-eval contest prepare`가 배포 가능으로 표시한 폴더 내의 파일은 대회의 `runs/` 폴더에 실행 결과가 기록돼요. 이러한 각 실행은 그곳에 고유한 `mcp-run-<id>/` 폴더를 할당받으며, `get_run_status`는 이들 전체에 대한 `mt-eval compare` 명령(`results/mcp-run-*/*_report.json`)을 출력해요. 큐 실행은 하네스의 기본 동작대로 서버 작업 폴더 아래의 `eval/logs/harness/queue/`에 보고서를 기록해요.

:::note[비용 지출은 구조적으로 제한돼요]
`run_benchmark`는 **한도가 지정되지 않은 큐 실행을 거부해요.** 반드시 정확히 하나의 한도(`budget`, `top` 또는 특정 `item_id`)를 전달해야 해요. 큐를 잘못 이해한 에이전트가 제한 없이 비용을 지출하는 일을 방지하기 위해 "그냥 큐 실행"과 같은 호출은 지원하지 않아요.
:::

## 프로토콜 버전

전송 방식은 **stdio 전용**으로, 에이전트당 하나의 서버 프로세스가 할당돼요.

MCP의 [2026-07-28 개정판](https://blog.modelcontextprotocol.io/posts/2026-07-28/)에서는 프로토콜을 기본적으로 상태 비저장(stateless) 방식으로 변경하여 `initialize` 핸드셰이크와 `Mcp-Session-Id` 헤더를 폐지했어요. 이 서버는 설계상 영향을 받지 않아요. 지원 중단된 기능(Roots, Sampling, Logging)을 전혀 사용하지 않고, 이전의 HTTP+SSE 전송 방식을 사용한 적이 없으며, 호출 간 상태 관리에 대한 새로운 지침을 이미 따르고 있기 때문이에요. 즉, 전송 세션에 의존하는 대신 `run_benchmark`가 모델이 다시 전달할 명시적 작업 핸들을 발급해요.

아직 해당 버전을 지원하는 TypeScript SDK가 출시되지 않아 새 개정판으로 업그레이드되지는 **않았어요**. 자세한 공식 입장은 [서버 README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)를 참조하세요.

## 기계 판독 가능한 엔드포인트

아래 항목에는 MCP 클라이언트가 필요하지 않아요:

| 엔드포인트 | 설명 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [에이전트용 창구](/for-agents) (원시 Markdown 형태) |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 이 사이트의 선별된 인덱스 |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | 인덱싱된 모든 페이지의 인라인 전문 |
| [`/queue.json`](https://champollion.dev/queue.json) | 전체 벤치마크 큐 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | 큐 상위 항목 |
| [`/registry.json`](https://champollion.dev/registry.json) | 말뭉치 레지스트리 |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 측정된 언어 그래프 |

## 다음 단계

- [MCP로 rails 운용하기](/docs/agents/mcp) — rails 프로필 단계별 가이드
- [운영 계약](/docs/agents/contract) — 에이전트가 준수해야 하는 규칙
- [에이전트 가이드 — 구축 및 벤치마킹](/docs/agents/measurement)
- [에이전트 가이드 — CLI로 번역하기](/docs/agents/serving)
- [방식 제출하기](/docs/network/getting-started/submit-a-method)
