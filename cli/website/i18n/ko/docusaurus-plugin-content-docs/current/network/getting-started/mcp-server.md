---
title: "MCP Server — 에이전트를 위한 출입구"
sidebar_label: "MCP Server"
description: "Model Context Protocol을 통해 AI 에이전트를 Champollion에 연결해 보세요. 언어 조회, 벤치마크 대기열 및 코퍼스 레지스트리 탐색, 평가 실행, 모델 학습 및 내보내기, 번역을 지원하는 34가지 도구와 함께, 단순 npx install 이상의 작업이 필요한 도구가 무엇인지 정확히 확인할 수 있어요."
---

# MCP Server — 에이전트용 출입구

`champollion-mcp-server`은(는) [Model Context Protocol](https://modelcontextprotocol.io)을 통해 Champollion을 AI 에이전트에 제공해요. 여러분이 에이전트이거나 에이전트를 연결하고 있다면, 바로 이것이 관문이에요. stdio를 통해 **34개의 도구, 3개의 리소스, 4개의 프롬프트**를 제공해요.

여기에 있는 모든 것은 일반 HTTP로도 접근할 수 있어요([기계 판독 가능 엔드포인트](#machine-readable-endpoints) 참고). 하지만 MCP 서버는 에이전트가 단순히 읽는 것을 넘어 *행동*(번역, 벤치마크 실행, 모델 학습)할 수 있게 해주는 유일한 표면이에요.

## 설치

```bash
npx -y champollion-mcp-server
```

그런 다음 클라이언트에 등록하세요. Claude Code의 경우:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

파일로 구성되는 클라이언트(Claude Desktop, Cursor, Antigravity)의 경우 다음을 추가하세요.

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

## 의존하기 전에 읽어보세요

**34개 도구 중 14개는 순수 `npx` 설치만으로 작동하며, `translate`은(는) 엔진이 갖춰지면 작동해요. 나머지 19개는 npm 패키지에 포함되지 않으며 포함될 수도 없는 Python 패키지가 필요해요.** 이 도구들은 조용히 실패하지 않고, 누락된 항목을 구체적으로 알려주는 실질적인 오류를 반환해요. 하지만 이를 바탕으로 계획을 세우기 전에 전체 구성을 알아두는 것이 좋아요.

| 도구 | `npx` 후 작동 여부 | 추가로 필요한 항목 |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **예** — 읽기 전용, 공개 엔드포인트에서 제공 | 없음 |
| `translate` | **예** (엔진 필요) | 선택한 엔진의 API 키 — 또는 `local` 방식과 자체 머신의 모델 서버를 사용할 경우 필요 없음 |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | 아니요 | 평가 하네스 — `pipx install mt-eval-harness` |
| 15개의 `forge_*` 도구 | 아니요 | NMT Forge 0.2.0 이상 — `python3 -m pip install nmt-forge` (학습 및 서빙을 위해 `'nmt-forge[hf]'` 추가). 평가 하네스를 함께 제공하며 언어 카드를 자동으로 찾으므로 클론할 필요가 없음 |

그 어떤 작업에도 저장소를 클론할 필요가 없어요.

## 도구가 하는 일

**작업 탐색 및 비용 산정.** `list_queue` 및 `get_queue_item`은 열린 벤치마크 대기열을 탐색해요. 이는 지도를 가장 크게 개선할 수 있는 측정 항목의 순위 목록이에요. `estimate_cost`은 비용을 지출하기 전에 일련의 실행에 대한 가격을 매겨요.

**정보 검색하기.** `search_languages`은(는) 이름, 코드, 어족 또는 지역별로 언어 카드를 검색하며, 오타도 허용해요. 각 결과에는 해당 언어가 사용되는 지역(국가, 지도 좌표, 매크로에어리어)과 다른 명칭도 표시돼요. 이름이 비슷한 언어들을 구분할 수 있도록 해당 카드가 출처를 인용한 사실만 각 출처와 함께 제공해요. 출처가 없는 위치는 절대 표시되지 않으며, 해당 줄에 그 사실을 명시하고 대신 해당 언어의 Glottolog 기록으로 연결해요. champollion.dev의 게시된 카드 테이블에서 채워진 카드(npm 설치 시 번들된 핵심 세트 외의 모든 언어)에는 아직 필드별 출처가 포함되어 있지 않으므로(다음 테이블 업로드 시 제공 예정), 이러한 줄에는 위치 대신 Glottolog 링크가 포함돼요. `language_overview`은(는) 특정 언어를 위한 빌드를 시작할 수 있는 한 페이지짜리 시작점이에요. 무엇이 존재하고, 무엇을 실행할 수 있으며, 다음 단계는 무엇인지 보여줘요. `get_language`은(는) 출처가 인용된 전체 카드를 반환해요. `list_corpora`은(는) 언어 쌍 또는 벤치마크 패밀리에 대해 등록된 평가 말뭉치 목록을 표시해요. 메타데이터만 제공되며(크기, 라이선스, 오염도 등급, 하네스가 가져올 수 있는지 여부, 액세스 토큰이 필요한지 여부, 격리 상태인지 여부), 말뭉치 본문은 절대 반환되지 않아요. 모든 말뭉치가 격리된 언어 쌍은 지원되지 않는 것처럼 보이지 않고 격리 상태임을 명시해요. `get_results` 및 `get_run_card`은(는) 공개 리더보드에서 점수가 매겨진 실행 결과를 읽어와요. `get_metric_reliability`은(는) 대부분의 에이전트가 틀리는 질문, 즉 *이 대상 언어에 대해 어떤 지표를 신뢰해야 하는가*에 대해 어족별 인간 평가와의 상관관계를 기반으로 답변해요. `list_contests` 및 `get_contest`은(는) 대회와 명시된 조건을 보여줘요. 대회 참가는 사람이 승인하는 CLI 단계이며 도구로 실행되지 않아요.

**작업 실행하기.** `translate`은(는) 번역 메모리(Translation Memory, 반복 시 비용 없음) 및 결정론적 품질 게이트를 갖춘 검증된 파이프라인을 통해 텍스트를 실행해요. 모든 답변에는 실제로 실행된 엔진의 이름이 명시되며, 존재하는 경우 모델과 엔드포인트도 함께 표시돼요.
`run_benchmark`은(는) 평가를 시작하고 **작업 ID를 즉시 반환**해요. 실제 실행은 클라이언트 타임아웃보다 오래 걸리기 때문이에요. 이 ID로 `get_run_status`을(를) 폴링하면 돼요. 작업은 서버가 재시작되어도 유지돼요. 실행은 계속 진행되며, 재시작 후에도 동일한 ID를 폴링하여 상태와 결과를 확인할 수 있어요. `publish: true`을(를) 전달하지 않으면 아무것도 게시되지 않아요. 그러면 계획(plan)에는 문장 텍스트가 포함된 모든 행 또는 점수만 게시되는지, 프롬프트 또는 프롬프트의 해시만 게시되는지, 그리고 어디에 게시되는지 등 공개될 내용이 명시돼요. 또한 실제 게시를 수행하려면 계획에 표시된 정확한 문구로 `publish_ack`을(를) 전달해야 하므로, 사용자가 해당 내용을 먼저 확인할 수 있어요. 이 플래그 없이 실행된 작업도 동일한 게이트를 거쳐 나중에 게시할 수 있어요. `preview_publish`은(는) 읽기 전용이에요. 하네스 자체의 게시 미리보기, 정확한 문구, 그리고 이를 게시할 정확한 `publish_report` 호출을 보여주며, 자체적으로 게시할 수는 없어요. 이 도구는 MCP 어노테이션 `readOnlyHint: true`을(를) 지니고 있어, 쓰기 작업 전에 매번 확인하는 에이전트 호스트가 자체적으로 허용할 수 있어요. `publish_report`은(는) 쓰기를 수행하며(`destructiveHint` 및 `openWorldHint` 어노테이션 부여), `scores_only`은(는) 문장 텍스트를 제외해요. 모든 계획은 대상 언어의 `EVAL PACK:` 상태(`missing`(설치 명령어 포함), `ready`, 또는 `none needed`)로 시작하며, 실행 시 `--yes`이(가) 전달되므로 말뭉치 라이선스와 해당 `do_not_train` 조건을 명시해요. FST(분석기 또는 pyhfst 런타임)가 없어도 실행이 중단되지는 않아요. 작업은 계속 진행되며 실행 카드에는 FST 수락 여부가 계산되지 않음(not computed)으로 표시돼요. 그 외의 누락된 요소가 있으면 번역을 시작하기 전에 실행이 중단돼요. `skip_fst` 및 `skip_eval_standard`은(는) 이러한 요소 없이 점수를 매기며, 실행 카드에는 제외된 항목이 표시돼요. 또한 계획에는 COMET 계산 여부가 표시돼요(하네스는 `unbabel-comet`이(가) 설치되어 있을 때마다 이를 계산하며, `comet: true`은(는) 실행 시 이를 필수로 요구하도록 설정해요). `metricx` 및 `fuse`은(는) 하네스의 선택적 기능인 MetricX-24 및 FUSE 스타일 비교기를 요청해요. 각 항목에 대해 계획에는 설치 여부, 설치할 항목, 다운로드되는 항목이 하네스 기준으로 명시돼요. 하네스가 계산할 수 없는 지표를 요청하는 확인된 실행은 해당 지표 없이 실행되는 대신 거부돼요. 계획의 `Results:` 및 `Cache:` 줄에는 실행 로그, 보고서, 번역 캐시가 저장될 위치가 명시돼요. `mt-eval contest prepare`에서 릴리스 가능으로 표시한 폴더(대회의 `public/`) 내부의 테스트 파일은 대회의 `runs/` 폴더에 대신 실행되어, 실행 시 기록된 어떤 내용도 함께 릴리스되지 않도록 해요. 자체 머신에 있는 모델(로컬 서버 또는 하네스가 프로세스 내에서 실행하여 증명이 필요 없는 `method: "local-model"`)은 `$0 API cost (runs on this machine)`으로 보고돼요.

**스스로를 속이지 않고 학습하기.** `get_training_guardrails`은(는) 실제로 측정된 실패 사례에서 추출된 규칙을 반환해요. 15개의 `forge_*` 도구는 [NMT Forge](/docs/network/getting-started/training-honestly)를 안전한 보호 장치와 함께 단계별로 실행해요. 맨 처음 및 매 단계마다 실행되는 `forge_status`(다음 명령어와 이를 실행할 도구를 안내), 명령어가 거부되기 전에 어떤 게이트에 걸리는지 확인하는 `forge_preflight`, 테스트 점수가 나오기 전에(그리고 테스트 세트에 대한 벤치마크가 실행되기 전에) 예측을 기록하는 `forge_prereg_template` 및 `forge_prereg`(점수 조회가 발생하면 이후 사전 등록이 차단됨), 테스트 세트의 점수를 한 번 매기고 학습된 모델을 패키징하는 `forge_export`, 승자 옆에 각 모델의 유사 쌍둥이(near-twin) 주의사항을 표시하며 두 모델을 A/B 테스트하는 `forge_compare`, forge가 판단할 수 없는 예측(자유 형식 텍스트 범위)에 대해 사용자의 자체 평가를 기록하는 `forge_prereg_verdict`(계산된 평가가 아닌 인간의 평가로 표시됨) 등이 있어요. `forge_status`은(는) 학습된 모든 실행 목록과 dev 점수를 나열하며, dev 세트가 포화 상태(체크포인트 선택에서 구분할 수 없는 완벽한 dev 점수)일 때 이를 알려줘요. 평가 하네스가 테스트 점수에 주의사항을 부여할 때(예: 거의 일정한 출력 — 모든 원본 문장에 대해 극소수의 출력만 제공되는 경우), `forge_export`, `forge_status`, `forge_compare` 및 `forge_lint`은(는) 하네스 자체의 문구로 이를 전달하며, 중대한 주의사항은 다음 단계에서 맨 먼저 표시되어 주의사항 없이 점수만 인용되는 일이 없도록 해요. 거부된 경우 무엇이 잘못되었는지, 왜 중요한지, 해결 방법은 무엇인지와 함께 반환돼요. 도구 호출 시간보다 오래 걸려 터미널에서 대신 실행되는 두 가지 단계가 있어요. 바로 학습(`nmt-forge run`)과 내보낸 모델의 서빙(`nmt-forge serve`, `translate` 및 CLI가 사용할 수 있는 로컬 엔드포인트 뒤에 배치)이에요.

### 인수

`name`은(는) 필수이고 `name?`은(는) 선택 사항이에요. 언어 하나를 입력받는 모든 도구는 `language`(으)로도 해당 값을 받아요. "`code` 또는 `language`"는 두 이름 중 어느 쪽이든 사용 가능하며 둘 중 하나를 전달하면 된다는 뜻이에요. 기존 이름도 계속 작동해요.

| 도구 | 인수 |
|---|---|
| `search_languages` | `query` 또는 `language`, `limit?` |
| `language_overview` | `code` 또는 `language`, `source?` |
| `get_language` | `code` 또는 `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?`(이 세 가지 중 최소 하나), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` 또는 `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | 없음 |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` 또는 `priority?`(둘 중 하나) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?`(gettext msgctxt: 모든 텍스트에 적용할 하나, 또는 텍스트당 하나), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | 모드 중 하나: `budget?` 또는 `top?`(대기열), `item_id?`, 또는 `model?`과 함께 사용하는 `corpus?`(`method_dir` 포함 시 플러그인이 로드하는 모델), `method?` 또는 `method_dir?`(메서드 플러그인 디렉터리; `local-model`에는 기본값이 없으므로 `model`이(가) 필요함), `allow_model_pair_mismatch?`(`local-model`: 관련 언어 베이스라인으로서 다른 언어 쌍을 지정하는 OPUS-MT 언어 쌍 모델 실행), `attest_local_transport?`(MT 엔진 또는 플러그인; `local-model`에는 불필요), `provider?`, `base_url?`, `target_language?`, `script?`(LLM 실행: `Cans` 또는 `Latn` 등 출력이 작성되어야 하는 ISO 15924 문자 체계; 대상 카드가 둘 이상을 나열하는 경우 계획에 명시됨), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` 및 `skip_eval_standard?`(항목 및 말뭉치 실행: FST 또는 평가 표준 지표 없이 채점, 계산되지 않음으로 표시), `comet?`(COMET 필수 요구: 미설치 시 실행 거부), `metricx_model?`과 함께 사용하는 `metricx?`, `fuse?`(항목 및 말뭉치 실행: 하네스의 선택적 기능인 MetricX-24 및 FUSE 스타일 비교기, 미설치 시 거부); 그리고 `dry_run?`, `confirm?`, `publish?`, `publish_ack?`(실제 게시 시 계획에 출력된 정확한 문구), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report`(완료된 실행의 `*_report.json`), `scores_only?`, `redact_coaching?`, `anonymous?`(읽기 전용: `confirm`이(가) 없어 게시 불가) |
| `publish_report` | `report`(완료된 실행의 `*_report.json`), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?`(미리보기에 출력된 정확한 문구) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target`(확인할 명령어), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` 또는 `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` 또는 `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?`(기본값 `data/split`, `forge_init`의 config.json이 읽는 경로), `dev?`, `register?`(이름 접두사, 또는 `project`의 경우 `true`), `allow_rotate?`, `near_dupe?`(forge가 유사 중복 제외를 권장할 때 0.6과 같은 자카드 임계값), `max_group?`(`near_dupe` 사용 시: 가장 큰 유사 중복 그룹), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?`(자체 `clean_to` 포함, 예: `corpus.notwins.jsonl` — all-data 파일은 절대 사용 불가), `companion_config?`(`drop_test_twins` 사용 시: 쌍둥이가 제거된 모델의 설정이 저장될 위치; 기본값 `config-notwins.json`), `overwrite?`(설정, 실행, 분할 또는 다른 감사가 사용하는 `clean_to` 파일 교체 — 지정하지 않으면 거부됨), `full_indices?`(모든 행 번호 목록 전체; 기본적으로 긴 목록은 `{count, first}`(으)로 반환됨), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?`(특정 실행 하나에 고정), `allow_after_reads?`(해당 세트의 점수 조회 이전에 기록된 예측에만 해당), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction`(해당 번호 또는 고유 ID), `verdict`(`held` 또는 `missed`), `by`(평가자), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?`(각 모델의 실행 매니페스트: 학습 데이터에서 유사 쌍둥이 검사), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

예를 들어 `get_metric_reliability { "language": "crk" }` 및
`get_metric_reliability { "target": "crk" }`은(는) 동일한 질문을 던져요.

### 직접 배포한 모델로 번역하기

`nmt-forge serve`은(는) 서빙하는 모델에 대한 두 개의 주소를 출력해요. 둘 중 하나로
`translate`을(를) 가리키도록 설정하세요:

| 인수 | 함께 사용할 대상 | 예시 |
|---|---|---|
| `base_url` | `method: "local"` — OpenAI 호환 서버 (`"openai"`도 지원) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — champollion API 규약 | `http://127.0.0.1:8378/translate` |
| `model` | LLM 엔진 전용(프롬프트가 없는 기계 번역 API에서는 거부됨) | `llama3.1` |
| `project_dir` | 모든 방식 — 해당 프로젝트의 번역 메모리(Translation Memory) 사용 | `~/my-app` |

자체 머신에서 실행되는 서버에는 키가 필요하지 않아요. 원격 `api` 엔드포인트는 서버 환경의 `CHAMPOLLION_API_KEY`에서 키를 읽어와요. 이 도구는 알 수 없는 인수를 무시하지 않고 이름과 함께 명시적으로 거부하므로, 인수에 오타가 있어 텍스트가 엉뚱한 모델로 조용히 전송되는 일을 방지해요.

### 서버의 상태 저장 위치

모든 데이터는 `~/.champollion-mcp/`에 저장돼요(위치를 변경하려면 `CHAMPOLLION_MCP_HOME`을(를) 설정하세요):

- **`translate`의 번역 메모리(Translation Memory)**는 해당 폴더 내의 자체 파일인 `.champollion/tm.json`이에요. 이는 개별 프로젝트의 `.champollion/tm.json`과(와) 별개예요. 해당 프로젝트에서 `champollion sync`이(가) 사용하는 프로젝트 파일을 대신 사용하려면 `project_dir`을(를) 전달하세요.
- **`run_benchmark` 작업**은 최신 50개를 유지하는 `jobs.json`에 기록돼요. 각 작업은 `jobs/` 내에 자체 출력과 (대기열 항목 또는 등록된 말뭉치의 경우) 하네스의 결과를 담는 폴더를 가져요. 보유 중인 테스트 파일에 대한 실행은 해당 파일 옆의 `results/`에 결과와 캐시를 기록해요. 단, `mt-eval contest prepare`에서 릴리스 가능으로 표시한 폴더 내의 파일은 제외되며, 이 경우 대회의 `runs/` 폴더에 실행 결과가 기록돼요. 대기열 실행은 하네스의 기본 동작과 마찬가지로 서버 작업 폴더 아래의 `eval/logs/harness/queue/`에 보고서를 기록해요.

:::note[지출은 설계상 제한되어 있어요]
`run_benchmark`은 **제한 없는 대기열 실행을 거부해요.** `budget`, `top` 또는 특정 `item_id` 중 정확히 하나의 제한을 전달해야 해요. "그냥 대기열 실행"과 같은 호출은 없어요. 대기열을 오해한 에이전트가 무제한으로 비용을 지출할 수 있기 때문이에요.
:::

## 프로토콜 버전

전송은 **stdio 전용**이에요. 에이전트당 하나의 서버 프로세스를 사용해요.

MCP의 [2026-07-28 리비전](https://blog.modelcontextprotocol.io/posts/2026-07-28/)은 프로토콜을 기본적으로 무상태(stateless)로 만들었으며, `initialize` 핸드셰이크와 `Mcp-Session-Id` 헤더를 폐기했어요. 이 서버는 설계상 영향을 받지 않아요. 더 이상 사용되지 않는 기능(Roots, Sampling, Logging)을 전혀 사용하지 않고, 레거시 HTTP+SSE 전송을 사용한 적이 없으며, 교차 호출 상태에 대한 새로운 지침을 이미 따르고 있어요. `run_benchmark`은 전송 세션에 의존하는 대신 모델이 다시 전달하는 명시적인 작업 핸들을 생성해요.

아직 이를 지원하는 게시된 TypeScript SDK가 없기 때문에 새 리비전으로 업그레이드되지 **않았어요**. 전체 입장은 [서버 README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)를 참고하세요.

## 기계 판독 가능 엔드포인트

이 항목들에는 MCP 클라이언트가 필요하지 않아요.

| 엔드포인트 | 설명 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | 원시 마크다운 형태의 [에이전트 출입구](/for-agents) |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 이 사이트의 큐레이션된 인덱스 |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | 인라인 처리된 모든 인덱싱 페이지 |
| [`/queue.json`](https://champollion.dev/queue.json) | 전체 벤치마크 대기열 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | 상위 대기열 항목 |
| [`/registry.json`](https://champollion.dev/registry.json) | 말뭉치 레지스트리 |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 측정된 언어 그래프 |

## 다음 단계

- [에이전트 가이드 — 구축 및 벤치마킹](/docs/network/getting-started/agent-guide)
- [에이전트 가이드 — CLI로 번역하기](/docs/guides/agent-guide)
- [메서드 제출하기](/docs/network/getting-started/submit-a-method)
