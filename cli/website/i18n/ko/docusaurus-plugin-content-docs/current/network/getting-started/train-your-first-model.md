---
sidebar_position: 3
title: "첫 모델 학습하기 (에이전트와 함께)"
description: "코딩 에이전트를 지시해 저자원 MT 모델을 훈련하는 단계별 가이드예요. 설치, 테스트 세트 보호, 노트북 CPU에서의 훈련, 1회 점수 평가, champollion CLI로 모델 서빙하기까지 전 과정을 다뤄요. 사용자가 지시하는 내용, forge가 수행하는 작업, 거절 응답이 어떻게 나타나는지 확인해 보세요."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# 첫 모델 학습하기 (에이전트와 함께)

신경망 기계 번역 모델을 학습하는 방법을 알 필요는 없어요. **코딩 에이전트에게 원하는 것을 말할 수 있으면** 돼요 — Claude, Sonnet/Flash급 모델, 또는 셸 명령을 실행할 수 있는 모든 에이전트요. **nmt-forge**는 에이전트가 *기계적으로* 이를 구동할 수 있도록 만들어졌어요. 매 단계마다 도구가 에이전트에게 다음에 무엇을 해야 하는지 정확히 알려주고, 어떤 단계가 결과를 손상시킬 수 있을 때는 — 큰 소리로, 해결책과 함께 — 거부해요.

이 페이지는 `pip install`부터 champollion CLI가 호출할 수 있는 모델에 이르기까지 전체 루프를 다뤄요. 각 단계는 **에이전트에게 지시할 내용**, **forge가 수행하는 작업**, **거부(refusal) 발생 시 표시되는 화면**(거부가 발생해도 당황하지 마세요 — 거부는 도구가 정상 작동하고 있음을 뜻해요), 그리고 마지막으로 **리포트를 읽는 방법**으로 구성되어 있어요. 이전 단계(기존 자원 찾기), 중간 단계(기존 옵션 측정하기), 이후 단계(배포, 방법 결합)를 다루는 [우리 언어를 위한 MT 구축하기](/docs/build-mt-for-your-language)의 2단계와 4단계에 해당하는 forge 파트예요.

**순서가 중요해요.** 가이드의 3단계에서 `mt-eval run`로 측정하는 베이스라인을 포함하여, **테스트 세트에서 어떤 점수도 매기기 전에** 테스트 세트를 등록하고, 테스트 세트를 기준으로 학습 데이터를 검별(screen)하고, 예측값을 기록(1~3단계)하세요. 벤치마크는 채점 읽기(scoring read)에 해당해요. forge는 이를 카운트하며, 이후에 작성된 예측값은 거부해요. 그런 다음 분할 및 학습(4단계)을 진행하세요.

:::tip 에이전트를 위한 단 하나의 규칙
에이전트에게 이렇게 지시하세요: *"항상 `nmt-forge status --json`를 먼저 실행하고, 모든 단계가 끝난 후에도 실행해. 그리고 `next_command`에 표시된 지시를 그대로 따라."* 이 습관 하나만으로 forge를 가이드 레일처럼 활용할 수 있어요. 모든 forge 명령은 `--json`를 지원해요. stdout으로 정확히 하나의 JSON 문서를 출력하며, 거부가 발생하면 종료 코드 2와 함께 `{"error": {…, "why", "fix"}}` 형태로 반환돼요. 에이전트가 MCP로 연결되는 경우, 동일한 루프가 `forge_status` 도구(`{ "project_dir": "<dir>" }`)로 제공돼요 — [에이전트 가이드](/docs/network/getting-started/agent-guide)를 참고하세요.
:::

---

## 0단계 — 설치 및 에이전트에게 언어 지정하기

**이렇게 말하세요:** *"학습용 extra를 포함해서 nmt-forge를 설치해 줘. 영어→[내 언어] 모델을 학습시키려고 해. 우선 forge가 이 언어에 대해 알고 있는 정보를 탐색해 봐. ISO 639-3 코드는 `crk`야"* (해당 언어의 코드를 사용하세요).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

`[hf]` extra는 학습 라이브러리(torch, transformers, accelerate, tokenizers, sentencepiece, peft)를 추가해요. 기본 모델에는 CPU 전용 wheel로도 충분해요. 일반 `python3 -m pip install nmt-forge`만 설치하면 학습 기능 없이 가드, 분할, 감사(audit) 및 채점 기능만 제공돼요.

**forge가 수행하는 작업:** `nmt-forge discover crk` 명령이 문자 체계, 사전, 형태소 분석기, 기존 말뭉치 및 평가 세트(`do_not_train` / 격리 플래그 포함), 언어별 심판 메트릭 등 해당 언어의 카드를 읽어와요. Champollion 저장소 복사본은 필요 없어요. 카드는 직접 지정한 디렉터리(`--cards-dir`), 로컬 체크아웃 또는 `node_modules/champollion`, 혹은 공개 카드 인덱스(캐시되므로 이후 오프라인에서도 작동함)에서 찾아요. 그런 다음 forge는 해당 언어를 **자산 사다리(asset ladder)**에 배치해요: (1) 병렬 텍스트 → 가드가 적용된 학습; (2) + 단일 언어 텍스트 → 태그 기반 역번역; (3) + 사전/문법 → 출처가 명시된 합성 데이터; (4) + 분석기 → 왕복 검증된 합성; (5) + 심판 메트릭 → 채점 및 체크포인트 선택 시 언어 자체 메트릭 반영.

**빈 필드는 0이 아니라 UNKNOWN을 의미해요.** 카드가 비어 있다는 것은 "이 언어에 아무것도 없다"는 뜻이 아니에요 — 단지 아직 그 리소스를 기록하지 않았을 수 있어요. 언제든지 자신의 병렬 코퍼스를 가져올 수 있어요.

그다음 이렇게 말하세요: *"프로젝트 스캐폴딩을 생성해 줘."*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

그러면 작업 공간(`.forge/`), 시작용 `config.json`, 정확한 명령어 순서가 담긴 `NEXT_STEPS.md` 브리프가 생성돼요. **이후의 모든 명령은 프로젝트 디렉터리 내부에서 실행하세요** — 설정 파일의 경로가 이 디렉터리를 기준으로 지정되어 있어요.

다른 프리셋을 선택하지 않는 한, 시작용 설정은 **`cpu-tiny`** 모델 프리셋을 사용해요:

| `--model` | 설명 | 요구 사항 | 예상 결과 |
|---|---|---|---|
| `cpu-tiny` (기본값) | 제공된 쌍으로 처음부터 학습되는 소형 트랜스포머(~6M 파라미터). 어휘집은 학습용 행에서만 학습됨 | CPU, 다운로드 불필요 | 낮음: 1천~2천 쌍 기준 chrF++ 점수는 대략 5~30 수준(상위 점수는 고도로 정형화된 데이터에서만 발생). 일반적인 언어 능력이 아닌 데이터의 어구와 패턴만 학습함 |
| `cpu-finetune --base <hf-id>` | 직접 지정한 작은 사전 학습 Marian/opus-mt 모델을 미세 조정함(*관련 있는* 언어 쌍 선택) | CPU, 약 300MB 다운로드 | 관련 언어 쌍이 있는 경우 보통 `cpu-tiny`보다 우수함 — 추측하지 말고 dev 세트에서 직접 측정해 보세요 |
| `nllb-600m` | LoRA를 적용한 NLLB-200 distilled 600M | GPU, 약 2.5GB 다운로드 | 가장 강력한 출발점. CPU에서는 forge의 소요 시간 체크에 걸려 몇 분 내로 거부됨 |

프리셋은 `config.json` → `model`에 명시적인 숫자로 기록되므로 숨겨지는 내용이 없으며, 숫자를 변경하면 별도의 해시를 가진 새로운 실행이 생성돼요.

**해당 언어의 카드가 없나요?** 그래도 `nmt-forge init <code> --no-card --name "<name>"` 명령은 프로젝트 스캐폴딩을 정상적으로 생성해요. 카드가 제공했을 모든 정보는 '알 수 없음'으로 기록되며, 임의로 지어내지 않아요.

---

## 1단계 — 테스트 세트를 분리하고 등록하기 {#step-1--set-your-test-set-aside-then-split}

**이렇게 말하세요:** *"여기 병렬 말뭉치와, 별도로 교사가 검수한 테스트 세트가 있어. 테스트 세트는 학습에서 제외하고, 테스트 세트에서 점수를 매기기 전에 먼저 등록해 줘."*

파일 형식은 `.tsv`(소스, TAB, 번역문 순으로 한 줄에 한 쌍; `# `로 시작하는 줄은 주석) 또는 `.jsonl`(한 줄당 `{"source": …, "target": …}`) 형식일 수 있어요. 테스트 세트가 비공개 데이터라면 에이전트를 포함해 어떤 도구라도 이를 읽기 **전에** 로컬 전용으로 표시하세요:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
이렇게 하면 forge가 테스트 세트의 문장을 절대 출력하지 않아요.

**forge가 수행하는 작업 — 자체 테스트 세트가 있는 경우**(학교나 병원의 일반적인 경우):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

등록하면 해당 파일의 **읽기 로그**(`<file>.reads.jsonl`)가 시작돼요. 이제부터 forge나 `mt-eval run` / `mt-eval compare`가 이 파일을 채점할 때마다 횟수가 기록돼요. 등록을 가장 먼저 해야 하는 이유가 바로 여기에 있어요. 등록 전에 실행된 벤치마크는 등록 시점에 나열되기는 하지만 카운트되지는 않아요.

**별도의 테스트 세트가 없다면**, 말뭉치에서 직접 떼어내세요 —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev`를 한 번에 실행하고(4단계에서 분할을 설명해요) 3단계로 넘어가세요.

이제 `nmt-forge status`가 다음 단계인 벤치마크 전 예측값 작성(3단계)을 안내해요 — 그 전에 먼저 말뭉치를 검별하세요(2단계).

---

## 2단계 — 누출 검사하기

**이렇게 말하세요:** *"학습하기 전에 말뭉치를 테스트 세트와 대조해 보고, 어떤 데이터를 제외할 것인지와 그 이유를 알려줘."*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge가 수행하는 작업:** 등록된 모든 dev/test/sealed 세트와 대조하여 말뭉치의 모든 행을 검별해요. 동일한 말뭉치와 동일하게 등록된 세트는 항상 동일한 결과를 내요. 그런 다음 **제외(drop)**할 항목과 이유를 설명해요:

- **동일한 프롬프트(Identical prompt)** — 해당 행의 소스 문장이 테스트 행의 소스와 일치하는 경우(대소문자, 문장 부호, 공백 무시 후). **해당 행의 번역이 다르더라도 제외돼요**: 모델이 테스트 프롬프트와 완전히 똑같은 문장으로 연습하게 되기 때문이에요.
- **동일한 정답(Identical answer)** — 해당 행의 타깃이 테스트 참조 정답과 일치하는 경우.
- **유사 정답(Near-duplicate answer)** — 해당 행의 타깃이 테스트 정답과 단어를 60% 이상 공유하고(철자 변형을 감안해 악센트 제거 후) 전체 정답을 포함하거나, 정답의 일부이거나, 90% 이상 일치하는 경우. 모델에게 정답의 대부분이 노출될 위험이 있어요.

…그리고 **의도적으로 유지(keep)**하며 보고만 하고 제거하지는 않는 항목은 다음과 같아요:

- **템플릿 형제(Template siblings)** — 해당 행이 테스트 정답과 문장 구조를 공유하지만 단어를 서로 맞바꾼 경우(*"I see the dog"* / *"I see the cat"*). 모델은 해당 문장 틀 안에서 본 적 없는 단어를 여전히 직접 생성해 내야 해요. 교재나 학교용 말뭉치에는 이런 예시가 아주 많아요. forge는 학습 데이터에 형제 문장이 존재하는 테스트 행들을 나열해요. 시작용 설정에 `eval.near_dupe_corpus`가 설정되어 있으므로, 최종 리포트에는 전체 점수 옆에 형제 문장이 없는 행에 대한 **"(strict)"** 점수가 함께 표시돼요.
- **유사 프롬프트, 다른 정답(Similar prompt, different answer)** — 소스가 테스트 소스와 거의 비슷하지만(완전 일치는 아님) 번역이 다른 경우예요. 이는 정상적인 최소 대립쌍(minimal contrast)이며 데이터 유출(leak)이 아니에요.

다음은 3개 행의 테스트 세트를 기준으로 검별한 12개 행 샘플 말뭉치의 리포트예요(일부 생략됨; 샘플 문장은 영어 소스에 프랑스어 스타일의 타깃 문장이에요):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

3번 행은 테스트 행과 번역이 *다름*에도 불구하고 제외되었어요. 프롬프트가 테스트 프롬프트와 동일하기 때문이에요.

출력되는 예시는 **여러분의 말뭉치** 행을 줄 번호로 인용해요. 테스트 파일 자체의 텍스트는 절대 출력되지 않으며, **봉인된(sealed)** 세트와 일치하는 행은 줄 번호로만 표시돼요. (말뭉치 행이 테스트 행과 동일하거나 테스트 행을 포함하는 경우, 말뭉치 행을 인용하면 해당 테스트 문장도 노출되므로 출력을 공유할 예정이라면 `--no-examples`를 전달하세요.)

`--clean-to pairs.clean.jsonl`는 살아남은 행들과 함께 그 옆에 내용이 포함되지 않은 감사 기록(`pairs.clean.audit.json`)을 작성해요. 분할하기 **전에** 말뭉치를 검별하세요(4단계에서 정제된 파일을 분할해요). 말뭉치에서 dev 세트를 떼어낸 후에 전체 말뭉치를 다시 검별하지 마세요 — dev 행들이 자기 자신과 일치하여 제외되어 버려요. *추가* 데이터(웹 수집 데이터, 단일 언어 텍스트)도 학습에 추가하기 전에 동일한 방식으로 검별하세요.

**검별을 진행해도 테스트 세트의 채점 기회가 소모되지 않아요.** leak-audit은 행을 비교하기 위해 테스트 세트를 읽지만, forge는 이를 채점 읽기가 아닌 *감사(audit)* 읽기로 기록해요. 따라서 3단계에서 작성할 예측값 등록에 전혀 방해가 되지 않아요.

**판정(verdict)을 먼저 확인하세요**(`VERDICT:` 줄; `--json` 옵션 사용 시 `verdict` 키). 대부분의 테스트 행이 말뭉치에 유사 쌍둥이(near-twin)를 가지고 있다고 나온다면, 전체 데이터로 학습한 모델은 번역 능력이 아니라 학습 어구의 암기율(recall)을 점수화하게 돼요. 고정된 테스트 세트(교사나 간호사가 검수한 세트)를 사용하는 경우 보통 **두 개의 모델**을 학습시키게 돼요. 하나는 전체 데이터로 학습한 모델(일반적으로 배포 시 더 유용함), 다른 하나는 새로운 문장을 어떻게 처리하는지 점수로 보여주는 쌍둥이 제거(twin-free) 모델이에요. 쌍둥이 제거 말뭉치는 `--drop-test-twins`로 생성할 수 있어요:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

이 명령은 테스트 행의 유사 쌍둥이인 학습 행을 제거하고, 전후의 엄격한 하위 집합(strict subset) 상태를 보고하며, 학습할 데이터가 전혀 남지 않게 되면 작업을 거부해요. 그리고 기존 설정 옆에 쌍둥이 제거 모델 설정 파일인 **`config-notwins.json`**를 작성해요. 이 파일은 고유한 `run_name`를 가지며 `data.gold` / `eval.near_dupe_corpus`가 쌍둥이 제거 파일로 설정된 동일한 설정 파일이에요(`--companion-config <file>`로 다른 파일명을 지정할 수 있으며 기존 파일은 덮어쓰지 않아요). 그런 다음 해당 모델을 학습시키는 명령어를 출력해요. dev 세트가 등록되기 전까지(4단계)는 dev 세트를 먼저 떼어내고 이 감사를 다시 실행하라는 메시지가 표시되어, dev 행들 역시 쌍둥이 제거 파일에서 빠질 수 있도록 해요. `nmt-forge status`는 조치를 취할 때까지 이 판정과 미학습 쌍둥이 제거 모델을 경고 목록에 유지해요.

**거부 발생 시 화면:** 잊지 않고 직접 실행하지 않아도 괜찮아요 — `nmt-forge run`은 모든 학습 파일을 테스트 및 봉인 세트와 대조 감사하여 유출 발생 시 실행을 거부해요: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT"*. 해결 방법: `nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>`를 실행하고 정제된 파일로 학습하세요.

---

## 3단계 — 엿보기 전에 예측하기

**이렇게 말하세요:** *"테스트 세트에서 어떤 측정도 하기 전에, 각 모델이 테스트 세트에서 기록할 예상 점수를 먼저 작성해 줘."*

**forge가 수행하는 작업:** 학습할 각 모델에 대해 모델 이름을 딴 사전 등록(preregistration)을 하나씩 수행해요:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

예측값 파일은 예측 항목들로 구성된 JSON 배열이에요. 각 항목에는 메트릭 이름과 한 줄 근거가 포함되며, 나중에 자동으로 검증되는 베이스라인 대비 방향성(`"direction": "increase", "baseline_score": 0, "margin": 5`) 또는 사람이 검토할 자유 형식 기대치(`"expect": "between 10 and 30"`) 중 하나가 들어가요. 여러분(또는 에이전트)은 테스트 점수가 생성되기 **전에**, **그리고 테스트 세트에 대한 기존 모델의 벤치마크가 수행되기 전에** 이를 확정해야 해요. [우리 언어를 위한 MT 구축하기](/docs/build-mt-for-your-language#3-measure-the-options)의 3단계에 있는 베이스라인 측정은 이 단계 *이후*에 이루어져요. 내보낼 때 `--prereg <id>`를 통해 어떤 예측이 어떤 모델을 평가하는지 지정할 수 있어요. 또는 지금 `prereg new`의 `--config-hash <hash>`에 `nmt-forge preflight run --config config-notwins.json`가 출력하는 전체 해시를 지정하여 예측을 모델 설정에 고정할 수도 있어요. 나중에 설정을 수정하면(예: 시간 예산 변경) 해시가 바뀌어 고정이 해제되므로, 내보낼 때 사전 등록 이름을 지정하는 것이 더 간단한 방법이에요.

**거부 발생 시 화면:** 이 단계에서 만날 수 있는 네 가지 거부 상황이에요.

- 수정되지 않은 템플릿은 거부돼요: `REPLACE` 플레이스홀더는 아무것도 예측하지 않아요. 여러분만의 기대치와 근거를 직접 작성하세요.
- 마크다운이나 일반 텍스트 파일은 형식 안내 및 템플릿 명령어와 함께 거부돼요. 지원되는 형식은 단 하나, JSON 배열뿐이에요.
- 테스트 세트의 점수가 이미 매겨진 후에 작성된 사전 등록은 거부돼요: *"[preregister] eval set 'project-test' was already read for scoring … before this preregistration"*. 벤치마크도 카운트에 포함돼요. `--allow-after-reads` 옵션은 해당 읽기 이전에 실제로 (종이 등에) 먼저 작성해 둔 예측값을 위해서만 존재해요. 이 플래그는 기록에 남으며, 모든 리포트, 내보내기 결과, `DEPLOY.md` 및 `nmt-forge status`에 예측값이 N회의 채점 읽기 이후에 작성되었다고 명시돼요.
- 사전 등록 없이 테스트 세트의 점수를 매기려고 하면 거부돼요: *"[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories"*. 기록된 기대치 없는 결과 확인은 사후 끼워 맞추기식 설명에 불과하기 때문이며, 이것이 바로 신뢰할 수 있는 결과와 사후 왜곡을 구분 짓는 기준이에요.

:::info 이것이 왜 추가 작업처럼 느껴지는지
그것이 바로 작업이에요. 여기 있는 모든 가드는 실제 연구자들을 속인 실수예요. 이 도구는 정직한 길을 쉬운 길로 만들고, 부정직한 길을 당신을 멈추게 하는 길로 만들어요.
:::

이제 테스트 세트에서 기존 옵션들을 측정하고([우리 언어를 위한 MT 구축하기](/docs/build-mt-for-your-language#3-measure-the-options)의 3단계), 다시 돌아와 학습을 진행하세요.

---

## 4단계 — 분할, 게이트 확인 후 학습하기 {#step-4--check-the-gates-then-train}

**이렇게 말하세요:** *"정제된 말뭉치를 train과 dev로 분할해 줘. 학습 실행 시 모든 검사를 통과할 수 있을까? 통과한다면 학습을 시작해 줘."*

**forge가 수행하는 작업 — 분할:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

테스트 세트가 이미 등록된 자체 파일로 존재하므로 `--test 0`는 train과 dev만 분할해요(테스트 세트를 직접 떼어낸 경우라면 1단계에서 이미 분할됨). `--register project`는 시작용 설정이 이미 가리키고 있는 이름인 `project-dev`를 작업 공간에 기록해요.

이 분할은 **그룹 분리(group-disjoint)** 방식이에요: 소스 *또는* 타깃을 공유하는 모든 문장 쌍은 반드시 **같은** 쪽으로 들어갑니다. 이는 저자원 번역 점수가 부풀려지는 가장 흔한 원인이에요 — 교재에서 수많은 영어 연습 문제가 하나의 타깃 단어에 매핑될 때, 단순 무작위 분할을 적용하면 한 사본은 train에, 쌍둥이 사본은 test에 들어가 모델이 암기한 정답을 "번역"하게 돼요. 출력 결과에 처리 내용이 표시돼요:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

테스트 세트가 이미 등록되어 있는 경우, `split`는 새로 생성된 train 및 dev 파일을 즉시 테스트 세트와 대조 검별하여 나중에 거부될 수 있는 행이 있으면 경고를 표시해요.

**정형화된 말뭉치(회화집, 연습 문제).** `--near-dupe 0.6`는 동일한 문장 틀로 만들어진 *유사* 중복 문장도 한쪽에 모아두므로, dev나 test 행이 train에 템플릿 쌍둥이를 갖지 않도록 해요. 템플릿 비중이 높은 말뭉치에서는 프레임들이 꼬리를 물고 하나의 거대한 그룹으로 연결될 수 있으며(*"Does your arm hurt?"* ~ *"Does your leg hurt?"* ~ *"Your leg looks swollen"* …), 한 그룹은 통째로 한쪽에만 들어갈 수 있어요. 이로 인해 한쪽 데이터가 요청한 양보다 훨씬 많아지거나(**1.5배** 초과), 학습 데이터가 요청 기준 할당량의 절반 미만으로 줄어들게 되면 `split`는 작업을 거부하고 아무것도 저장하지 않아요: *"[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)"*. 이어 그 이유(연쇄 연결 상태 및 가장 큰 그룹 크기)와 해결 가능한 대안들을 제시해요: 더 높은 임계값 설정, 그룹 크기 상한 설정(`--near-dupe 0.6 --max-group 51` — 상한을 넘는 유사 중복 연결은 끊지 않은 상태로 유지되며 분할 시 카운트됨), `leak-audit --drop-test-twins`로 고정 테스트 세트의 쌍둥이 제거, 또는 학습 자료와 독립적으로 작성된 dev/test 문장 사용. forge는 이 연쇄 상태를 스스로 확인해요: 이러한 말뭉치에서는 사전 점검 및 내보내기 DEPLOY.md의 유사 쌍둥이 관련 안내에서 `--near-dupe 0.6` 사용을 권장하지 않아요.

**거부 발생 시 화면:** 사용자가 직접 분할한 데이터를 forge에 넘겨주었을 때 세트 간 중복이 있으면 `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl`가 이를 거부해요 — *"[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'"*. 해결 방법: 문제되는 행을 손으로 직접 지우지 말고 `split`로 다시 분할하세요.

**두 개의 모델을 학습시키나요?** 이제 dev 세트가 등록되었으므로 2단계의 쌍둥이 제거 감사를 다시 실행하세요(dev 행들도 쌍둥이 제거 파일에서 제외돼요). 여기서 안내되는 `config-notwins.json` 명령어로 아래에서 두 번째 모델을 학습시킬 수 있어요.

**forge가 수행하는 작업 — 게이트 검사:** `nmt-forge preflight run --config config.json` 명령은 학습 extra 설치 여부를 포함하여 실행 과정에서 맞닥뜨릴 모든 게이트를 ✓ 또는 ✗로 나열하고, 각 ✗에 대한 해결 방법을 안내해요:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

모두 초록색으로 확인되면 실행하세요: `nmt-forge run config.json` (쌍둥이 제거 모델의 경우 `nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json`).

기본값인 `cpu-tiny` 프리셋을 사용하면 일반 노트북 CPU에서도 실행할 수 있어요 — GPU나 다운로드가 필요 없어요. 다만 학습은 즉각 완료되는 도구 호출이 **아닌** 유일한 단계이므로, 에이전트는 폴링을 계속하는 대신 출력을 로그 파일로 보내면서 백그라운드로 실행하고 중요한 라인(`refused`, `Error`, `wall-clock`, `RUN EXIT`)만 모니터링해야 해요. 손실 곡선과 중지 버튼이 있는 실시간 패널이 **사용자**를 위해 열려요(해당 포트가 비어 있는 경우 `http://127.0.0.1:8377`에서 접속 가능) — 이 패널은 에이전트용이 아닌 사용자 전용이에요. 실행 초기에 forge는 처리 속도를 측정하여 설정된 `model.time_budget_hours` 내에 끝낼 수 없는 실행을 며칠이 아닌 수 분 내에 감지하고 거부해요.

`[schedule-sanity]` 줄은 forge가 데이터 믹스로부터 도출한 조기 종료(early-stopping) **하한선(floor)**을 보여줘요. 이를 통해 실제 dev 손실이 흔들릴 때 합성 데이터 비중이 높은 실행이 0.5 에포크 만에 비정상 중단되는 현상을 방지해요(실제 발생할 수 있는 장애 유형이에요 — [학습 실행 진단하기](/docs/network/getting-started/diagnosing-training) 참고).

학습이 끝나면 forge는 **격리된 dev 세트를 기준으로 체크포인트를 선택하고**(테스트 세트 기준 절대 불가), `run-manifest.json`를 작성한 뒤 dev 점수(항상 95% 신뢰구간 포함)와 다음 실행할 명령어를 출력해요.

---

## 5단계 — 1회 채점 후 패키징하기

**이렇게 말하세요:** *"테스트 세트에서 모델 점수를 매기고, 바로 사용할 수 있도록 패키징해 줘."*

**forge가 수행하는 작업:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

단 하나의 명령으로 다음 작업이 수행돼요:

- 학습 실행에서 선택된 체크포인트로 테스트 세트를 디코딩하고 점수를 매겨요 — 사전 등록이 없으면 거부되며, 작업 공간 원장에 기록되고, 모든 수치에 95% 신뢰구간이 표시되며, 알기 쉬운 언어로 된 **진단 및 권장 사항(Diagnosis & Recommendations)** 섹션이 포함돼요.
- 결과를 `export/evaluation/`에 **mt-eval 리포트**로 작성해요. 덕분에 `mt-eval compare`를 통해 평가 하네스로 측정한 모든 모델(예: [우리 언어를 위한 MT 구축하기](/docs/build-mt-for-your-language#3-measure-the-options) 3단계의 호스팅 모델들)과 나란히 비교할 수 있어요.
- `export/model/`(가중치와 토크나이저, 학습 상태 제외), `forge-model.json`(모델 소개 및 측정 방식), champollion 플러그인 매니페스트, 정확한 실행 명령어가 포함된 `DEPLOY.md`를 담아 **자체 완비형 모델**로 패키징해요. `export/model/`에는 테스트 문장이 전혀 포함되지 않으며, 실제 배포에 필요한 유일한 폴더예요.

**점수**는 하네스의 대표 지표예요: forge가 표시하는 모든 곳(예: `chrF++ 31.2 [28.4, 34.0]`)에서 95% 신뢰구간이 함께 표기된 corpus chrF++가 동일한 형식으로 제공되며, 상세 기록(`forge-model.json`, 내보내기 요약본, `DEPLOY.md`)에는 sacreBLEU 시그니처가 함께 포함돼요. BLEU, spBLEU, TER은 점수에 섞이지 않고 나란히 표시되며, 완전 일치(exact match) 및 기타 배터리 레인은 진단용으로 활용돼요. forge의 어떤 화면에서도 복합 점수나 품질 등급 라벨을 임의로 출력하지 않아요: 번역 결과의 가치를 판단하는 것은 언어 화자들의 몫이기 때문이에요.

**점수의 한계 조건도 점수와 함께 전달돼요.** mt-eval 리포트는 점수의 의미를 제한하는 모든 요소를 기록해요 — 예를 들어 *거의 일정한 출력(near-constant output)* (서로 다른 수많은 입력에 대해 소수의 문장만 반복 출력하여 입력 내용을 제대로 반영하지 못하는 현상), 참조 정답보다 지나치게 길거나 짧은 출력, 소스 문장의 단순 복사 등이 있어요. `export`는 하네스 고유의 표현 그대로 요약본(`score_caveats`), `forge-model.json`, 그리고 점수 바로 아래의 `DEPLOY.md`에 이를 모두 전달해요. `status`, `report`, `compare`, `lint`도 동일한 내용을 명시해요. 주의 사항이 붙은 점수는 해당 주의 사항 없이는 절대 "인용할 수 있는 수치"로 단독 제공되지 않아요.

도중에 실패하더라도 불완전하게 작성된 내보내기 파일이 남지 않아요. 두 가지 주의점이 있어요: `export/evaluation/`에는 테스트 문장이 포함되어 있으므로 모델과 함께 복사하지 말고 테스트 세트와 함께 보관하세요. (테스트 세트가 비공개로 표시되어 있다면 해당 위치의 모든 파일에도 동일한 표시가 적용돼요.) 또한 **봉인된(sealed)** 테스트 세트는 1회용이에요: 내보내기를 수행하면 기회가 소진되며, 재채점 없이 모델을 패키징하는 `--no-eval` 옵션을 전달하지 않는 한 두 번째 내보내기는 거부돼요.

`nmt-forge evaluate <run-manifest>`는 패키징 없이 수치만 확인하고자 할 때 사용하는 `export`의 채점 전용 기능이에요(`--harness-out DIR` 옵션은 mt-eval 리포트를 작성해요).

**단일 테스트 세트에 두 개의 모델을 평가하는 경우**(예: 전체 데이터로 학습한 모델 하나와 `--drop-test-twins`로 학습한 모델 하나): 작업 공간에 두 번째 실행이 기록되면, 실행의 `NEXT` 라인과 `nmt-forge status`는 실행별 폴더(`--out export-<run>/`)를 지정해요. 내보내기 순서는 상관없어요. 어떤 모델을 두 번째로 내보내든, 전체 데이터 모델의 `DEPLOY.md`는 결국 쌍둥이 제거 모델의 점수를 인용하게 돼요. 하나의 테스트 세트에 두 개의 사전 등록이 있는 경우, `nmt-forge status` 및 `nmt-forge report`는 어떤 등록이 어떤 실행에 적용되는지 나타내요(또는 `--prereg <id>`가 결정해야 함을 나타냄 — export the twin-free model with `--prereg notwins`). `nmt-forge compare`
명령은 테스트 세트에서 두 모델을 A/B 테스트하고 모델별로 학습 데이터에 유사 쌍둥이가 있는 테스트 행의 개수를 알려줘요: 암기율에 기반한 우위는 별도로 보고돼요. 각 모델의 가설 파일 — `<export>/evaluation/battery-hyps.jsonl`, 내보내기 요약에서는 `hypotheses`로 표기됨 — 을 입력받아 mt-eval이 해당 내보내기에 대해 작성한 점수 주의 사항을 전달해요. 쌍둥이 제거 모델의 점수는 새로운 문장에 대해 인용할 수 있는 점수이지만 반드시 주의 사항과 함께 전달되어야 해요: 쌍둥이 제거 모델의 출력이 거의 일정하다면, 그 점수는 새로운 문장을 제대로 번역한다는 증거가 될 수 없으며 `DEPLOY.md`가 점수 옆에 이를 분명히 명시해요).

**하네스에 의한 읽기도 횟수에 포함돼요.** forge가 테스트 세트를 등록하면 파일 옆에 작은 읽기 로그(`<file>.reads.jsonl`)를 시작하고, `mt-eval run` / `mt-eval compare`가 해당 파일을 채점할 때마다 내용이 없는 한 줄짜리 기록(실행 ID, 목적, 파일의 sha256, 타임스탬프)을 추가해요. forge는 이를 읽어 판별해요: 이러한 읽기 발생 후 작성된 사전 등록은 사후 예측(postdiction)으로 간주되어 거부되며(모든 리포트에 공개되는 `--allow-after-reads` 제외 — 3단계를 베이스라인 측정 전에 수행해야 하는 이유예요), `mt-eval`가 읽은 봉인 세트는 소진 처리되고, `status` 및 `ledger show --set`는 읽기 횟수를 카운트하며, `DEPLOY.md`는 내보낸 점수가 최초 확인 결과가 아닐 때 이를 명시해요.

### battery-lint 보고서 읽는 방법

리포트는 **레지스터별**(교재, 정부 문서, 구전 설화 등) 점수 표 — 테스트 행에 레지스터 이름이 지정되지 않은 경우 `all`라는 단일 그룹 — 로 구성되며, 각각 신뢰구간이 표기되고 그 뒤에 진단 결과가 이어져요. 진단에서는 **가장 취약한 레지스터**와 각각의 가장 유력한 원인, 그리고 다음에 시도해 볼 **개선 레버(lever)**를 제시해요:

| 진단 내용 | 의미 | 개선 레버 |
|---|---|---|
| `R1-vocabulary-gap` | 해당 레지스터의 점수가 낮고 **동시에** 출력이 미완성 상태임. 모델의 어휘력이 부족함 | **VOCABULARY(어휘)** — 어휘집을 확장한 후 퍼널을 다시 확인하세요 |
| `R2-structure-gap` | 단어는 알고 있으나 문장의 *형태*를 알지 못함 | **STRUCTURE(구조)** — 누락된 문장 구성을 추가하세요(템플릿/컴포지터) |
| `R3-mixed-convention` | 출력 결과에 여러 철자법이 혼용됨 | **ORTHOGRAPHY(철자법)** — 말뭉치를 단일 표기 규범으로 정규화하고 재학습하세요 |
| `R4-optimism-bound` | 유사 쌍둥이 테스트 행으로 인해 "전체" 점수가 부풀려짐 | **MEASUREMENT(측정)** — 일반화 성능 확인을 위해 strict 점수를 인용하세요 |
| `R5-low-power` | 신뢰구간이 너무 넓음 | **MEASUREMENT(측정)** | 신뢰구간(CI)보다 작은 차이에는 일희일비하지 마세요. 테스트 세트를 늘리세요 |
| `R7-transfer-plateau` | 합성 데이터에서는 성능이 뛰어나지만 실제 텍스트에서는 정체됨 | **REAL-DATA(실제 데이터)** — 단일 언어 데이터를 역번역하거나 실제 병렬 문장을 확보하세요 |
| `R9-harness-score-caveat` | mt-eval 리포트가 점수에 한계 조건을 부여함(예: 거의 일정한 출력). mt-eval이 중대한 문제로 분류한 경우 `high` 표시 | **MEASUREMENT(측정)** — 반드시 주의 사항과 함께 점수를 인용하고, 번역 품질이라 부르기 전에 실제 출력 몇 개를 직접 읽어보세요 |

각 진단 결과에는 해당 판단이 내려진 근거가 함께 제공돼요. 에이전트가 프로그래밍 방식으로 조치할 수 있는 `--json` 진단 항목의 경우: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## 6단계 — champollion CLI에 모델 제공하기

**이렇게 말하세요:** *"내보낸 모델을 서빙하고 우리 앱의 문자열을 번역해 줘."*

**forge가 수행하는 작업:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve`는 두 가지 방식으로 응답해요: champollion **api method** 규약(`POST /translate`) 및 `champollion sync --method local`가 통신하는 **OpenAI 호환** `/v1/chat/completions` 방식이에요. `export/model/DEPLOY.md`에는 권장 방식인 `api` 방식을 위한 `champollion.config.json` 스니펫과 플러그인 매니페스트용 스니펫이 들어 있어요. 서버는 `127.0.0.1`에서만 수신 대기해요. 네트워크상에 노출하려면 포트에 접근할 수 있는 누구나 모델을 사용할 수 있게 되므로 토큰(`--token` 또는 `NMT_FORGE_SERVE_TOKEN`)을 지정해야 해요. 루프백 서버의 경우 CLI에 별도 키가 필요하지 않지만, 토큰과 함께 시작된 서버는 `CHAMPOLLION_API_KEY`에 동일한 값을 넣어주어야 해요.

두 개의 모델을 내보낸 경우 배포할 모델 선택은 사용자의 몫이에요: `nmt-forge choose export-<run>/model` 명령이 선택 사항을 기록하고, `nmt-forge status`가 해당 모델을 지정해요. 단순히 사용해 보기 위해 서빙하는 것은 배포 선택이 아닌 단순 서빙으로 기록돼요. 대신 소버린 콘테스트(sovereign contest)에 모델을 출품하려면, `DEPLOY.md` §6에 선언형(Lane A) 출품에 필요한 파일 목록과 정확한 `mt-eval contest submit-model` 명령어가 정리되어 있어요.

배포하는 모델의 특성을 명확히 알아두세요: NMT 모델은 텍스트 번역 모델이에요. 지시를 따르는 인스트럭션 모델이 **아니므로**, CLI가 LLM 방식에 전달하는 톤 안내, 코칭 파일, 용어집 등은 무시돼요. 또한 저자원 언어의 기계 번역 결과물은 실제 독자에게 닿기 전에 반드시 유창한 화자의 감수를 거쳐야 해요.

---

## 방금 당신이 한 일

여러분은 이제 진정으로 신뢰할 수 있는 점수를 가진 모델을 학습시켰어요: 정답 유출이 없고, 테스트 세트를 엿보지 않고 체크포인트를 선택했으며, 모든 수치에 오차 범위가 표기되어 있고, 결과 확인 전에 예측값을 먼저 기록했으며, 막연한 추측 대신 다음 개선 방향을 짚어주는 진단을 제공해요. 그리고 CLI가 바로 호출할 수 있고 측정한 다른 모든 방법과 직접 비교 가능한 패키징된 모델까지 완성되었어요. 이것이 바로 핵심이에요 — **MT 전문 지식(이나 GPU) 없이도 솔직하고 신뢰할 수 있는 결과를 기본값으로 얻을 수 있어요.**

수치가 기대에 미치지 못하더라도(설계상 기본 모델의 성능이 낮기 때문에 처음에는 당연히 그럴 수 있어요), [학습 실행 진단하기](/docs/network/getting-started/diagnosing-training)를 확인해 보세요 — 정확히 그 순간을 위해 증상별 해결책을 중심으로 작성되어 있어요.
