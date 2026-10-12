---
slug: /build-mt-for-your-language
title: "내 언어를 위한 기계 번역 구축하기"
description: "‘어디서부터 시작해야 할까요?’라는 고민에서 검증된 번역 워크플로에 이르기까지: 기존 리소스 파악, 테스트 세트 보호, 옵션 비교 평가, 더 나은 모델 구축, 검증 및 배포에 이르는 전 과정을 각 단계별 정확한 명령어와 MCP 도구 호출과 함께 안내해요."
---

# 내 언어를 위한 기계 번역 구축하기

이 페이지는 *"우리 언어를 위한 번역이 필요한데, 어떻게 시작해야 할까요?"*라는 고민에서 출발하여, **직접 준비한 문장으로 측정한** 번역 워크플로를 구축하고 실제로 활용하기까지의 과정을 안내해요. 사람과 AI 에이전트 모두를 위해 작성되었으며, 각 단계마다 실행할 명령어와 에이전트가 대신 호출할 수 있는 [MCP 도구](/docs/network/getting-started/mcp-server)(제공되는 경우)를 함께 소개해요.

두 가지 예시 시나리오:

- **학교**: 소식지와 간단한 앱을 위해 영어 → 플레인즈 크리어(Plains Cree) 번역이 필요해요. 교사들이 수백 개의 문장을 직접 검수했으며, 이 문장들은 비공개로 유지되어야 해요.
- **병원**: 병상용 회화집을 위해 색인에 거의 등록되지 않은 언어로의 영어 번역이 필요해요. 테스트 문장에 임상 표현이 포함되어 있어 외부 AI 서비스로 절대 전송되어서는 안 돼요.

이 과정을 마치면 비공개 테스트 세트, 해당 테스트 세트에서 측정한 여러 방식의 점수, 더 나은 방식(코칭된 모델 또는 직접 훈련한 모델), 그리고 CLI를 통해 배포된 해당 방식을 확보하게 되며, 모든 수치는 산출 근거를 추적할 수 있어요.

:::info[이 가이드가 보장하지 않는 것]
여기에 소개된 어떤 내용도 번역의 완벽한 정확성을 보장하지 않아요. 점수는 단지 어떤 선택지가 **여러분의 문장에서 덜 틀리는지**를 알려줄 뿐이며, 실제로 사용할 수 있는지는 여전히 해당 언어의 유창한 화자가 판단해야 해요. 어떤 수치든 신뢰하기 전에 [솔직한 한계](/docs/network/honest-limitations)를 먼저 읽어보세요.
:::

:::warning[에이전트 주의사항: 사용자의 파일을 열기 전에]
테스트 세트가 비공개일 가능성이 있다면(교사 검수, 간호사 검수, 커뮤니티에서 공개하지 않은 모든 자료), 읽지 마세요. 형식을 확인하기 위한 목적이라도 `cat`, `head` 또는 미리보기를 실행해서는 안 돼요. 에이전트가 읽은 내용은 모델 제공업체로 전송돼요. 먼저 사용자에게 확인하고 로컬 전용(local-only)으로 표시하세요([2단계](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. 설치

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

에이전트의 경우, 설정에 MCP 서버를 추가하세요:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. 기존 리소스 확인하기

사전, 문법, 코퍼스, 분석기(FST), 모델, 공개된 결과, 서비스 등 해당 언어에 대해 이미 알려진 정보와 각 정보의 출처를 확인해요.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**에이전트:** `search_languages { "query": "Atya" }` 도구는 철자가 틀리더라도 편집 거리 기준 가장 가까운 이름을 찾아 코드를 확인해요. 각 결과는 언어 카드에 출처가 인용된 경우에만 사용 지역을 표시하고 그 출처도 함께 보여주므로, 사용자가 이름이 유사한 언어들 사이에서 올바른 언어를 선택할 수 있어요. 출처가 없는 위치 정보는 절대 표시되지 않아요. 해당 줄에 그 사실을 명시하고 대신 후보 언어들을 원천 자료에서 비교할 수 있는 Glottolog 기록 링크를 제공해요. npm 설치 환경의 경우, 번들된 핵심 세트 외의 언어는 champollion.dev에 공개된 카드 테이블에서 채워지는데, 이 테이블에는 아직 필드별 출처가 포함되어 있지 않아서(다음 테이블 업데이트 시 추가 예정) 위치 정보 대신 Glottolog 링크가 표시돼요. 표시된 정보로 후보들을 구분하기 어려울 때는 화자가 직접 결정해야 해요(아래 참조). 그다음 `language_overview { "code": "<code>" }` 도구가 기존 리소스, 벤치마크 및 결과, 번호가 매겨진 다음 단계가 정리된 한 페이지를 제공해요. 단일 언어를 입력받는 모든 도구는 `language` 형식도 지원해요.

언어 카드는 명시된 그대로 읽어야 해요. **기록이 없다는 것은 알 수 없음(unknown)을 의미할 뿐, 존재하지 않는다는 뜻(zero)이 아니에요.** 사전에 대한 언급이 없다고 해서 사전이 없다는 뜻이 아니라 색인에 기록되지 않았다는 뜻이에요. 출처 간 정보가 불일치하는 경우(화자 수가 특히 그렇습니다), 카드는 모든 출처를 보여줘요.

언어 카드가 전혀 없더라도 아래의 모든 작업을 그대로 진행할 수 있어요. 도구가 해당 언어에 대해 알고 있는 정보가 적을 뿐이에요(`nmt-forge init <code> --no-card --name <name>` 명령어로 훈련 프로젝트를 시작하는 것에는 문제가 없어요).

### 변이형(variety)이 아직 확정되지 않은 경우

하나의 이름이 여러 언어에 해당할 수 있어요. 예를 들어 "Ayta"는 필리핀의 6개 아이타어(Ayta) 언어와 일치하며, 각 언어마다 고유한 코드가 있어요. **먼저 언어 화자들에게 물어보세요.** 커뮤니티는 자신들이 사용하는 변이형을 잘 알고 있으며, 외부에서 임의로 선택한 코드는 그들에 대한 단정이 될 수 있어요.

화자들의 답변을 받기 전에 작업을 시작해야 한다면 개인 사용 코드(private-use code)를 사용하세요. ISO 639는 바로 이러한 목적을 위해 `qaa`부터 `qtz`까지를 비워두었어요. 프롬프트와 보고서에 언어 이름이 표시되도록 표시 이름을 지정해 주세요:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

그러면 `champollion.config.json`에 다음과 같이 기록돼요:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init`는 해당 코드가 언어 카드가 없는 개인 사용 코드임을 알려줘요(맞춤법 확인을 요청하지 않아요).

`init`, `sync`, `verify`, `network register-corpus` 모두 개인 사용 코드를 지원해요. 실제 코드로 대체하기 전까지 감수해야 할 사항은 다음과 같아요:

- **카드 정보 부재:** 언어 카드의 어조 프리셋, 복수형 규칙, 문자 체계 정보가 제공되지 않아요. 동기화에 일반 설정이 사용되므로 첫 결과물을 화자와 함께 검토하세요.
- **FST 부재:** 개인 사용 코드에는 형태소 분석기가 연결되지 않으므로 단어 단위 검사가 이루어지지 않아요.
- **이전 결과 부재:** 공개된 벤치마크와 대기열은 실제 코드를 키값으로 사용하므로 `recommend` 및 `corpora`에 표시할 내용이 없어요.

커뮤니티에서 변이형을 확인해주면 해당 코드로 전환하세요:

1. `champollion.config.json`에서 `qaa`을 실제 코드로 변경하세요(카드의 이름이 적절하다면 `name`을 삭제해도 돼요).
2. 로케일 파일 이름을 변경하세요(`messages/qaa.json` → `messages/ayt.json`). 기존 번역은 그대로 유효해요. 다음 `champollion sync` 실행 시 기존 번역을 유지하고 새로운 내용만 번역해요.
3. 실제 언어 쌍으로 테스트 세트를 다시 등록하세요: `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`. 등록된 파일은 새 ID를 선택하지 않는 한 기존 ID를 유지하므로, 명령어 실행 시 전달해야 할 `--id`가 출력돼요. (여기 및 `nmt-forge init`에서 `--pair`은 `eng-ayt` 또는 `"eng>ayt"` 형식을 받아요. 셸이 단독 `>` 기호를 "파일로 쓰기"로 해석하므로 `>` 형식은 따옴표로 감싸세요.)

## 2. 데이터 수집 및 테스트 세트 보호

**먼저 테스트 세트를 분리하세요.** 모델을 훈련하거나 튜닝하기 전에, 모든 평가의 기준이 될 문장들(교사 검수 문장, 간호사 검수 문장 등)을 따로 떼어놓고 이 문장들로는 절대 훈련하지 마세요.

테스트 세트는 TSV 파일이에요. 한 줄에 하나의 문장 쌍이 들어가며 원문, 탭(TAB), 참조 번역 순으로 작성해요. `# `로 시작하는 줄은 주석이에요.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

그런 다음 데이터의 공개 범위를 결정하세요:

| 원하는 방식 | 조치 사항 |
|---|---|
| 이 머신 밖으로 아무것도 유출되지 않음 — 외부 AI 서비스가 이 문장을 절대 보아서는 안 됨 | 테스트 세트 옆에 마커 파일을 배치하세요(아래 참조). 로컬 머신의 모델만 테스트할 수 있어요. |
| 다른 사람이 테스트 세트의 존재는 알 수 있지만 내용은 볼 수 없음 | `champollion network register-corpus --tier private --role test …`로 메타데이터만 등록 |
| 직접 제어하는 머신(필요시 에어갭 환경)에서 테스트 세트로 경연 진행 | `--tier sealed` 및 [주권 노드](/docs/network/sovereignty/sovereign-eval-node) 사용 |
| 공개 라이선스로 누구나 접근 가능 | `--tier public`로 저장 위치 지정(저희는 파일을 직접 호스팅하지 않음) |

"머신 외부로 절대 유출되지 않음"을 위한 마커:

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

이 마커가 있으면 `mt-eval run`는 해당 파일에 대한 모든 원격 프로바이더의 접근을 거부하고 루프백(loopback)에 있는 모델에 대해서만 실행돼요. 자세한 내용: [코퍼스 등록](/docs/network/sovereignty/registering-corpora).

**적절한 라이선스 ID 선택:** 등록 시 `--license`를 입력해야 해요. 임시 값이 아니라 데이터 소유자가 실제로 부여한 조건을 입력해야 해요. 소유자에게 확인한 후 적절한 ID를 선택하세요. 이미 특정 라이선스로 텍스트를 공개하고 있다면 SPDX ID를, "시스템 점수 평가 전용, 훈련 금지, 공유 금지, 유료 평가 금지"라면 `community-eval-grant-nc`를, 유료 평가만 허용되는 동일한 조건이라면 `community-eval-grant`를, 모든 권리 보유(저작권 보호)라면 `proprietary`를, 소유자 고유의 조건이라면 `LicenseRef-<name>`를 선택하세요. 마지막 네 가지는 `LicenseRef-…` ID로, 맞춤형 라이선스에 해당해요. 데이터 관리자(steward)가 권한을 기록하기 전까지 원격 평가는 거부돼요. 관리자의 확인 전까지는 선택한 설정을 임시(provisional)로 기록하세요. 라이선스와 상관없이 로컬 전용(local-only)은 로컬에만 머물러요. 문장의 전송 여부를 결정하는 것은 라이선스가 아니라 마커 파일이에요. [비공개 테스트 세트를 위한 라이선스 ID 선택](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set)을 참조하세요.

**에이전트 주의사항: 로컬 전용 테스트 파일을 읽지 마세요.** `cat`, `head`를 실행하거나 직접 열어 확인해서는 안 돼요. 에이전트가 읽은 내용은 마커가 전송을 금지하도록 지정한 모델 제공업체로 전달돼요. 그럴 필요도 없어요. 도구들은 출력 결과에서 문장을 제외하며(`mt-eval compare`는 문장 대신 항목 ID와 점수만 표시), `--show-text`는 터미널의 사람 사용자를 위한 것이에요.

**에이전트:** `language_overview { "code": "<code>" }`는 해당 언어의 보호 옵션을 나열해요. `run_benchmark`는 마커를 준수하여 보호된 문장을 외부로 전송하는 대신 거부 응답(사유 포함)을 반환해요.

### 추후 모델을 훈련할 계획이 있는 경우: 평가 전에 등록, 스크리닝, 예측 먼저 수행하기

3단계에서 테스트 세트를 평가하기 전에, 지금 다음 세 가지를 순서대로 수행하세요. Forge는 테스트 세트 조회를 모두 기록하며, 벤치마크(3단계)는 점수 측정을 위한 읽기로 처리돼요. 즉, 벤치마크 실행 후에 작성된 사전 등록은 거부돼요. 순서가 매우 중요하며, 나중에 하면 유효하지 않아요.

1. **NMT Forge에 테스트 세트 등록하기:** 읽기 로그가 이때부터 시작되므로 이후의 모든 읽기가 집계돼요(등록 전의 점수 읽기는 목록에만 표시되고 집계되지는 않아요).
2. **훈련 코퍼스를 테스트 세트와 비교하여 스크리닝하기**(`leak-audit`): 점수 측정이 아닌 검사를 위해 테스트 세트를 읽는 것이므로 예측 집계에 포함되지 않아요. 판정 결과를 확인하세요. 대부분의 테스트 행에 대한 유사 문장(near-twin)이 코퍼스에 있다면 전체 데이터로 훈련한 모델은 번역 능력이 아니라 훈련 문구의 암기율(recall)을 측정하게 돼요. 이 경우 보통 전체 데이터로 훈련한 모델과 유사 문장이 제거된(twin-free) 모델 두 가지를 훈련하게 돼요(`--drop-test-twins`가 해당 코퍼스와 설정 파일 `config-notwins.json`을 작성해요).
3. **훈련할 각 모델에 대해 예상치를 사전 등록(preregistration)하기:** 훈련할 모델마다 모델 이름을 붙여 하나씩 작성하세요. 이 예측치는 나중에 테스트 점수를 평가하는 기준이 돼요. 내보내기(export) 시 `--prereg <id>`로 지정한 모델과 비교 평가를 진행해요(하나의 테스트 세트에 두 개가 있으면 임의로 추측하지 않고 작업을 거부해요). `nmt-forge preflight run --config config-notwins.json`가 출력하는 전체 해시인 `--config-hash <hash>`를 사용해 예측을 특정 모델 설정에 고정(pin)할 수도 있어요. 하지만 이후 설정을 조금이라도 수정하면(예: 시간 예산) 해시가 바뀌어 고정이 풀리므로, 내보낼 때 사전 등록 이름을 지정하는 편이 더 간단해요.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

판정 결과가 SEVERE(심각)라면, 유사 문장 제거 모델과 해당 모델의 예측을 추가하세요(`school-crk/`에서):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

유사 문장 제거 코퍼스는 별도의 파일로 저장돼요. `corpus.clean.jsonl`는 전체 데이터 코퍼스로 유지돼요. leak-audit은 설정, 실행 또는 분할(split)에서 읽고 있거나 다른 감사가 작성한 파일을 덮어쓰지 않아요(`--overwrite`는 의도적으로 대체할 때 사용). `--json` 응답에는 각 목록의 처음 몇 개 행 번호가 표시되며, 정제된 코퍼스 옆의 `.audit.json` 파일에 전체 행 번호가 보관돼요.

`--allow-after-reads`는 데이터 읽기 전에 실제로 미리 기록해 둔 예측(예: 종이에 적어둔 것)을 위해서만 제공돼요. 이 내용은 기록되며 모든 보고서에 반영돼요,
export and DEPLOY.md then says the predictions came after the scores.

**에이전트:** `forge_init { "code": "<code>", "dir": "<dir>" }`를 실행한 다음 `forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`, `forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`를 실행하세요(위 명령어들은 프로젝트 내부에서 실행되므로 경로는 `project_dir`에서 읽어오며, 절대 경로는 어디서나 작동해요). 그 후 사용자와 함께 `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`를 모델당 하나씩 진행하고 각 모델 이름을 따서 지정하세요(이후 `forge_export`에서 해당 ID를 `prereg`로 받으며, `forge_prereg`의 `config_hash`를 사용하면 설정에 고정할 수 있어요). 테스트 세트가 등록되자마자 `forge_status`가 이 단계를 안내해요. 4단계 훈련도 동일한 프로젝트에서 진행돼요. `language_overview`에도 이 단계들이 동일한 순서로 나열되어 있어요.

## 3. 선택지 측정하기

후보 모델들을 **직접 준비한** 테스트 세트(추후 훈련 가능성이 있다면 Forge에 등록, 스크리닝 및 사전 등록을 먼저 마쳐야 함 — [2단계](#2-gather-your-data--and-protect-your-test-set) 참조)를 대상으로 실행하세요. 평가 하네스는 기계 번역 분야의 표준 평가 방식에 따라 모든 후보를 동일하게 채점해요. 대표 지표는 95% 신뢰 구간이 포함된 코퍼스 chrF++이며, BLEU, spBLEU, TER가 나란히 제공돼요(절대 하나의 숫자로 합치지 않음). 정확 일치(Exact match) 및 동작 검사(잘못된 문자 체계 출력, 환각 신호)는 비용 및 속도와 함께 진단 지표로 보고돼요. 해당 언어에 고정된 형태소 분석기가 하네스에 등록되어 있는 경우 FST 수용률(FST acceptance)과 형태학적 정확도도 진단 지표로 추가돼요. `mt-eval setup --status`에 해당 언어 목록이 나와 있으며, `mt-eval setup --comet`는 지원되는 경우 COMET을 추가해요.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare`는 점수 차이가 유의미한지 아니면 노이즈 범위 내인지 알려줘요(대응 표본 근사 무작위화 검정). 신뢰 구간 내의 차이는 순위로 볼 수 없어요. 비교 대상 실행들이 같은 폴더에 있으면 보고서 옆에, 그렇지 않으면 상위 `comparisons/` 폴더에 비교 대상 이름을 딴 `comparison-<hash>.json` 파일을 작성하며, 개별 실행 폴더 내부에는 절대 작성하지 않아요. 다른 비교를 수행해도 기존 파일이 덮어쓰이지 않아요.

**평가 팩(Evaluation packs):** 일부 언어는 지표 측정에 필요한 추가 도구를 정의해요(예: 플레인즈 크리어의 경우 형태소 분석기). 처음 `mt-eval run`를 실행하면 누락된 도구가 표시돼요. 분석기가 없다고 해서 실행이 중단되지는 않으며, FST 수용률이 '계산되지 않음(not computed)'으로 표시돼요. `mt-eval setup --lang crk`로 도구를 설치하고(머신당 1회) `mt-eval test <run log>`를 실행하면 다시 번역할 필요 없이 점수만 추가할 수 있어요.

**에이전트:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local", "base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1", "target_language": "crk" }` plans first and runs only with `confirm: true`; `get_run_status { "job_id": "<id>" }` 도구가 점수를 반환해요. `publish: true`를 전달하지 않는 한 아무것도 외부에 공개되지 않아요. `target_language`로 전달된 코드는 프롬프트에 도달하기 전에 언어 카드의 명칭("Plains Cree")으로 변환되며, 실행 계획(plan)에는 모델에 전달될 프롬프트가 표시돼요. 코칭 파일이 있으면 프롬프트가 대체되며 계획에 그 내용이 명시돼요. 카드에 두 개의 문자 체계가 등록되어 있고 `script`를 전달하지 않은 경우, 계획은 참조 번역에서 사용된 문자 체계를 감지하고(머신 로컬에서 글자 수 집계, 문장은 노출되지 않음) 해당 문자 체계를 요청해요. 보고서는 테스트 파일 옆의 `data/results/mcp-run-<id>/`에 저장되고 하네스의 번역 캐시는 `data/results/cache/`에 저장돼요. `get_run_status`는 이들을 위한 `mt-eval compare` 명령어를 출력하며, 등록된 코퍼스 ID를 대상으로 한 실행의 경우 보고서 경로 목록을 표시해요. `local-model` 계획은 확인 시 다운로드될 파일 크기와 저장 위치를 먼저 알려줘요.

**신뢰할 지표의 선택**은 언어에 따라 달라져요. `get_metric_reliability { "language": "<code>" }` (MCP)는 해당 언어에 대해 인간 평가와 검증된 자동 지표가 있는지 보고해요. 대부분의 저자원 언어는 검증된 지표가 없으므로 chrF++을 사용하는 것이 관례예요. 이를 절대적인 점수(등급)가 아니라 동일한 테스트 세트에서 여러 방식을 비교하는 상대적인 지표로 해석하세요.

## 4. 더 나은 방식 구축하기

두 가지 경로가 있어요. 둘 다 3단계와 동일한 방식으로 측정해요.

**범용 모델 코칭하기:** 모델에 용어집과 지침을 제공한 후, 코칭을 적용하여 3단계를 다시 실행하세요:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file`는 Markdown, 일반 텍스트 또는 JSON을 입력받아요. 파일의 전체 텍스트가 모델의 지침이 되어 작성된 그대로 전송돼요.

전문 용어 정확도(목록의 각 용어가 지정된 번역으로 올바르게 출력되는지)를 채점하려면, 비교할 모든 실행에 `--glossary terms.json`(`{"blood pressure": "…"}` 또는 용어별 허용 형태 목록)로 동일한 용어 목록을 지정하세요. 이 용어집은 채점 용도로만 사용되며 모델에 전송되지 않으므로, 일반 실행과 코칭 실행을 동일한 용어 기준으로 공정하게 평가할 수 있어요. `--glossary`가 없으면 JSON 코칭 파일의 `dictionary`([코칭 프롬프팅](/docs/network/tutorials/coached-llm-prompting) 구조: `grammar_rules`, `dictionary`, `style_notes`)이 대신 사용돼요. 이 경우 해당 실행은 자체 코칭 내용을 기준으로 채점되며 출력에 그 사실이 명시돼요. Markdown 코칭 파일은 동일한 방식으로 코칭하지만 용어집을 제공하지는 않아요.

[코칭 프롬프팅](/docs/network/tutorials/coached-llm-prompting) 및 [사전 증강 프롬프팅](/docs/network/tutorials/dictionary-augmented-llm)을 참조하세요.

**NMT Forge로 자체 모델 훈련하기:** NMT Forge는 소규모 데이터 평가 결과를 실제보다 부풀리는 오류(테스트 문장 유출, 잘못된 데이터 분할, 테스트 세트 기반 체크포인트 선택, 노이즈를 성능 향상으로 오인 등)를 사전에 차단해요:

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run`는 `run`가 훈련 전에 수행하는 검사(개발 세트, 모든 훈련 파일의 데이터 유출 검사, 디코딩 길이 등)를 미리 진행하므로, 이 검사를 통과한 실행은 시작 단계에서 거부되지 않아요. `config.json`는 `data/split/`에서 분할 설정을 읽어와요. 다른 곳에 작성된 분할 설정은 수정해야 할 줄을 알려줘요.

훈련 문장 쌍은 테스트 세트와 마찬가지로 TSV(또는 `source`과 `target`이 포함된 JSONL) 형식으로 준비해요. `leak-audit`(2단계)는 테스트 세트가 훈련에 유출될 수 있는 문장을 제외하고 그 이유를 설명해 주었어요. 두 개의 모델을 만드시나요? 분할 후 2단계의 유사 문장 제거 leak-audit을 다시 실행한 뒤(개발 세트가 등록되면 개발 세트 행도 유사 문장 제거 파일에서 제외됨), `nmt-forge run config-notwins.json`와 export it to its own folder with `--prereg notwins`. `nmt-forge status` names 언제든지 다음 명령어를 실행할 수 있어요. 기본 모델은 CPU에서 몇 분 만에 훈련돼요. 1~2천 개의 문장 쌍 기준 chrF++ 점수는 대략 5~30 정도를 기대할 수 있어요. 언어 전반을 학습하는 것이 아니라 주어진 데이터의 문구와 패턴을 학습하기 때문이에요. `export`는 테스트 세트를 한 번 채점하고 mt-eval 보고서를 작성하므로, 훈련된 모델을 3단계의 결과들과 직접 비교할 수 있어요. 전체 단계 가이드: [첫 번째 모델 훈련하기](/docs/network/getting-started/train-your-first-model).

**에이전트:** 처음에 그리고 각 단계마다 `forge_status { "project_dir": "<dir>" }`를 실행하세요. 2단계의 `forge_init`, `forge_register_eval`, `forge_leak_audit`, `forge_prereg`를 완료한 후에는 `forge_split { corpus, test, seed, out }`, `forge_preflight { "target": "run" }`를 실행하고, 터미널에서 `nmt-forge run`를 실행한 후에 `forge_export { run_manifest, out, prereg }`를 실행하세요. `forge_split`를 호출하기 전에 `get_training_guardrails`를 한 번 호출하세요. Forge가 적용하는 각 규칙과 그 규칙이 방지하는 오류 목록을 보여줘요. `forge_split`의 `register` 인수는 접두사 또는 `true`(`project`)를 받으며, `out`의 기본값은 `data/split`예요. `forge_init` 이후의 모든 Forge 도구는 반환된 `project_dir`를 인수로 받아요. `get_training_guardrails`(선택 사항: `topic`)는 각 규칙을 설명해요. 모든 도구의 전체 인수는 [MCP 서버](/docs/network/getting-started/mcp-server#arguments)를 참조하세요.

## 5. 검증하기 — 비공개 또는 공개

점수는 여러분의 소유예요. 직접 공개를 선택하지 않는 한 아무것도 외부에 게시되지 않아요.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

비공개 또는 로컬 전용 테스트 세트는 문장을 절대 업로드하지 않아요. `--dry-run`가 줄별로 이 사실을 확인해 줘요. 다른 사람이 테스트 세트를 보지 않고도 경쟁할 수 있게 하려면, 직접 제어하는 머신에서 경연을 개최하세요. 참가자가 모델 방식을 제출하면 여러분의 노드에서 실행되고 점수만 외부로 전송돼요. 새로운 경연은 마감될 때까지 모든 점수를 숨기므로 아무도 테스트 세트에 맞춰 편법 튜닝을 할 수 없어요. [주권적 경연 개최하기](/docs/network/sovereignty/run-a-sovereign-contest)를 참조하세요. 훈련한 모델을 다른 사람의 경연에 출품하려면, 내보내기 결과물의 `DEPLOY.md` §6에 출품에 필요한 파일들과 정확한 `mt-eval contest submit-model` 명령어가 안내되어 있어요.

**에이전트:** `list_contests { "language": "<code>" }`, `get_contest { id }`; 공개 리더보드의 경우 `get_results { "target_language": "<code>" }` 및 `get_run_card { id }`를 사용하세요.

## 6. 최선의 조합 찾기

**먼저 직접 측정한 결과 중에서 선택하세요.** 테스트 세트에서 채점한 모든 결과는 mt-eval 보고서 형식이에요. 3단계와 4단계의 기준 모델(baseline)과 코칭 실행, 그리고 훈련된 각 모델의 내보내기 결과(export folder). A terminal run with `-o results` writes to `results/*_report.json` 내부의 `evaluation/runlog_report.json`)가 여기에 해당해요. MCP `run_benchmark`로 시작된 실행은 테스트 파일 옆의 `data/results/mcp-run-<id>/`에 기록돼요. 이 결과들을 한 번에 비교해 보세요. 첫 번째 glob 패턴은 터미널 실행용, 두 번째는 에이전트 실행용이에요(실행 방식에 맞는 것을 사용하세요. zsh는 일치하는 항목이 없는 glob에서 오류로 중단돼요):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

신뢰 구간 내의 점수 차이는 순위가 아니며, 훈련 데이터에 테스트 문장과 유사한 문장이 포함된 훈련 모델은 암기율에 의해 점수가 나온 것이에요. 유사 문장 제거 점수(DEPLOY.md와 `nmt-forge report`에 명시됨)를 mt-eval이 표시한 **점수 주의사항(score caveat)**과 함께 나란히 표기하세요. *준불변 출력(near-constant output)* 주의사항(서로 다른 수많은 테스트 문장에 대해 소수의 문장만 반복해서 출력하는 현상)은 점수와 상관없이 출력이 입력을 반영하지 못함을 의미해요. Forge는 `export`, `DEPLOY.md`, `status`, `report`, `compare`, `lint`에서 점수 옆에 이 주의사항을 표시해요. 여러 내보낸 모델이 있는 경우 `nmt-forge status`는 각 모델의 점수, 유사 문장 제거 점수, 주의사항을 표시하고 어떤 모델을 배포할지 선택하도록 요청해요. 선택 결과는 `nmt-forge choose <export>/model`(또는 `nmt-forge serve <export>/model --choose`)로 기록하세요. 테스트를 위해 모델을 일시 서빙하는 것은 '서빙됨(served)'으로만 기록되고 공식 '선택(choice)'으로 기록되지 않으므로, 선택을 완료할 때까지 `status`가 계속 확인을 요청해요.

**에이전트:** `forge_status { "project_dir": "<dir>" }` — `choose-export` 상태에서는 사용자에게 `result.advice.exports` 및 각 내보내기의 점수와 `score_caveats`를 보여주고 배포할 모델을 선택하도록 요청하세요. 사용자의 답변은 터미널에서 `nmt-forge choose`로 기록돼요. 임시 서빙으로는 이 질문이 완료되지 않아요. `forge_compare { eval_set, hyps_a, hyps_b }`는 두 Forge 모델을 A/B 테스트하고 승자 옆에 각 모델의 유사 문장 주의사항과 mt-eval 점수 주의사항을 함께 표시해요. 각 모델의 번역 가설(hypotheses) 파일은 `forge_export`가 반환하는 `hypotheses` 경로(`<export>/evaluation/battery-hyps.jsonl`)예요.

그다음 직접 측정한 결과 너머를 살펴보세요. 언어 쌍이나 텍스트 종류에 따라 가장 적합한 방식이 달라져요. [네트워크](/docs/network/) 페이지에는 기존 방식과 서비스들, 그리고 각각에 대한 근거 자료(직접 측정한 수치가 아니라 공식 공개된 결과)가 정리되어 있어요:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

리더보드에 설정과 함께 공개된 방식은 채점 당시와 동일한 구성으로 설치할 수 있어요: `champollion network leaderboard --install <method> --apply`를 실행하면 해당 언어 쌍에 맞게 프로젝트에 추가돼요. CLI는 **언어 쌍별로** 방식을 설정하므로, 소식지의 크리어(Cree)에는 직접 훈련한 모델을 사용하고 프랑스어에는 호스팅 모델을 사용할 수 있어요. 여러 방식을 연쇄적으로 적용하는 방법(예: 번역 모델 적용 후 검사기 실행)은 [모델 체이닝](/docs/network/tutorials/chained-models)을 참조하세요.

## 7. 실제로 활용하기

직접 측정한 바로 그 방식을 배포하세요 — 다른 방식을 배포하지 마세요.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

실행 중에는 `nmt-forge status`가 `serving` 상태를 표시하며(서버가 여전히 응답하는지 확인), 서버가 중지되면 동일한 포트에 대한 `serve` 명령어를 다시 안내해요.

또는 코칭된 호스팅 모델의 경우 `champollion.config.json`에서 해당 언어 쌍에 설정하세요. 어떤 방식이든 다음과 같이 실행해요:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**자체 모델이 아직 처리하지 못하는 영역:** 수천 개의 문장으로 훈련된 소규모 모델은 문맥 속 문구를 학습해요. 그래서 플레이스홀더(`{name}`), 복수형, 마크업을 손상시키거나 "Home"과 같은 짧은 라벨을 완전한 문장으로 바꿔버리는 실수를 자주 해요. 품질 게이트(quality gate)는 이러한 결과물을 거부하므로 손상된 내용은 저장되지 않아요. 해당 언어 쌍에 **폴백(fallback)** 방식을 지정하면, 거부된 문자열은 동일한 동기화 과정에서 두 번째 방식으로 전달돼요:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

어떤 텍스트도 머신 밖으로 나갈 수 없다면, 로컬에서 실행되는 모델을 폴백으로 지정하세요: `"fallback": { "method": "local", "model": "<your local model>" }`는 로컬 머신의 OpenAI 호환 서버(Ollama, llama.cpp, vLLM)로 요청을 전송하며 API 비용은 $0예요. 호스팅 모델은 대개 더 우수한 대체 결과를 제공하므로, 텍스트를 외부 제공업체로 전송해도 괜찮은 경우에 활용하세요.

자체 모델은 번역할 수 있는 모든 것을 번역해요. 게이트에서 거부된 항목과 누락되거나 손상된 Markdown 블록만 폴백 모델로 전달되며, 폴백의 결과물 역시 동일한 게이트 검사를 거쳐요. `sync`는 언어 쌍별 처리 건수가 포함된 `[FALLBACK]` 줄을 출력하고, `champollion verify`는 두 방식 모두 번역하지 못한 항목들을 나열해요. [폴백 방식](/docs/getting-started/configuration#fallback)을 참조하세요.

단발성 작업의 경우 해당 문자열만 다른 방식으로 번역할 수도 있어요:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…또는 직접 수작업으로 번역하거나 `champollion xliff export`를 사용해 검수자를 거칠 수도 있어요. 그리고 앱 자체의 문자열도 테스트 세트에 포함하세요. 교사들이 검수한 문장에서 높은 점수를 받은 모델이라도 "어디가 아프신가요?" 같은 문장에서는 틀릴 수 있어요.

**문자 체계:** 대상 언어가 두 개 이상의 문자 체계로 표기되는 경우(플레인즈 크리어: 표준 로마자 표기법 및 음절 문자), CLI는 번역 전에 선택을 요청해요. 설정 파일에서 해당 언어의 `"script"`을 설정하세요. 안내 메시지에 선택 가능한 옵션이 표시돼요.

번역 메모리가 적용되므로 변경되지 않은 문장에 대해 비용이 이중으로 청구되지 않으며, 모델을 교체하더라도 전체를 다시 번역하지 않아요. [CI/CD 가이드](/docs/guides/ci-cd)를 참고하여 CI 파이프라인에 연결하세요. 4단계에서 생성된 `export/model/DEPLOY.md`에는 `api` 방식과 네트워크에 안전하게 노출하는 방법을 포함하여 훈련된 모델을 위한 정확한 설정이 담겨 있어요.

**에이전트:** `translate { texts, source_language, target_language }`는 동일한 파이프라인을 통해 문자열을 처리해요. 직접 서빙하는 모델의 경우 `method: "local"` 및 `base_url`, 또는 `method: "api"` 및 `endpoint`를 추가하고, 여러 문자 체계로 작성되는 언어의 경우 `script`를 추가하세요.

## 진행 과정에서의 결정 사항

| 결정 항목 | 선택 항목… | 선택 기준 |
|---|---|---|
| 테스트 세트 저장 위치 | local-only | 민감한 데이터이거나 작성자의 동의를 아직 구하지 못한 경우 |
| | private / sealed | 테스트 세트를 직접 보여주지 않고 존재 사실만 알리거나 경연을 진행하려는 경우 |
| 코칭 vs 훈련 | 호스팅 모델 코칭 | 용어집은 있으나 병렬 말뭉치가 적고, 외부 서비스 이용이 허용되는 경우 |
| | Forge로 훈련 | 수천 개 이상의 문장 쌍이 있거나 데이터를 머신 내에만 보관해야 하는 경우 |
| 공개 여부 | 점수만 공개 | 직접 작성하지 않은 모든 데이터의 기본 권장 설정 |
| | 비공개 | 항상 허용됨 — 비공개 측정만으로도 충분히 유용함 |

## 비용 안내

- 이 도구들은 비상업적 용도로 무료예요. 학교, 공립 병원이나 클리닉, 자선 단체, 연구 프로젝트 등이 이에 해당해요(CLI, nmt-forge, MCP 서버는 PolyForm Noncommercial 1.0.0 라이선스이며, 평가 하네스는 AGPL-3.0 이상 오픈 소스예요). [사용 권한 안내](/docs/getting-started/who-may-use-this)를 참조하세요.
- 호스팅 모델은 제공업체의 요금 기준에 따라 비용이 발생해요. `--max-cost`는 허용된 예산을 초과하기 전에 실행을 중단하며, 보고서에 문장당 비용이 표시돼요. 로컬 모델은 머신의 실행 시간 외에 추가 비용이 들지 않아요.
- 기본 Forge 모델 훈련에는 CPU와 몇 분의 시간만 필요해요. 더 큰 프리셋은 GPU가 필요해요.
