---
sidebar_position: 1
title: "메서드 제출하기"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: cookbook
  - label: "Measurement rules"
    to: /docs/agents/measurement
    kind: guide
---

# 메서드 제출하기

> **핵심 요약.** 첫 벤치마크 실행을 리더보드에 제출하기 위한 단계별 빠른 시작 가이드입니다. 하네스를 설치하고 데이터셋에 대해 실행한 뒤, 실행 카드를 검토하고 게시하세요. API 키가 있다면 10분이면 됩니다.

이 가이드는 첫 벤치마크 실행을 Network 리더보드에 제출하는 과정을 안내해요.

---

## 사전 준비 사항

- **Python 3.11+**
- **OpenRouter API 키** (또는 사용하는 모델 제공자의 동등한 키)
- **번역 방법** — 소스 텍스트로부터 번역을 생성하는 모든 것

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## 1단계: 하네스 실행하기

하네스는 표준화된 데이터셋에 대해 여러분의 메서드를 채점해요:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name
```

| 플래그 | 설명 |
|---|---|
| `--corpus` | 말뭉치 파일 경로 또는 등록된 말뭉치 ID (`.json`, `.jsonl`, `.tsv`) |
| `--model` | 정확한 모델 슬러그 — 전체 OpenRouter ID(예: `google/gemini-3.1-pro-preview`). 짧은 별칭 및 유동 ID(`…-latest`)는 거부돼요. `--method <plugin dir>` 옵션을 사용할 때는 플러그인에 `config.method_model`(으)로 전달되는 모델 이름(플러그인에서 사용하는 임의의 명칭)을 지정해요 |
| `-n, --name` | 실행에 붙일 사람이 읽기 쉬운 라벨(리더보드에 표시돼요) |
| `--temperature` | 샘플링 온도 (기본값 `0.0`: 결정론적 방식, `shared/model-defaults.json`의 기본값) |
| `--publish` | 실행이 끝나면 실행 카드를 리더보드에 게시해요 |

하네스는 **실행 카드**를 생성해요. 이는 점수, 데이터셋 해시, 모델 슬러그, 그리고 결과를 정확한 실험 구성에 연결하는 암호학적 지문을 담은 독립적인 JSON 파일이에요.

---

## 2단계: 실행 카드 검토하기

각 실행마다 `eval/logs/harness/`에 두 개의 파일이 작성돼요. 실행 로그 `<run-id>.json`와 점수가 매겨진 보고서 `<run-id>_report.json`예요. 실제로 게시하는 것은 이 보고서예요. 먼저 내용을 확인해 보세요:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

보고서의 `overall` 블록에 있는 주요 필드예요:
- `corpus_chrf` — 코퍼스 수준의 chrF++ (0–100)로, 대표 지표이자 순위를 매기는 기준이에요. 95% 부트스트랩 신뢰구간(CI)은 `confidence_intervals.corpus_chrf`이며 sacreBLEU 시그니처는 `sacrebleu_signatures.chrf`예요
- `scoring_standard` (`"standard/1"`) 및 `primary_metric` (`"chrf_plus_plus"`) — 보고서의 점수 산출에 사용된 표준이에요
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — 다른 표준 지표들이며, chrF++ 옆에 나란히 표시되고 절대 혼합되지 않아요
- `exact_match_rate` — 진단 지표로, 완벽하게 번역된 비율을 나타내요
- `confidence_intervals` — 위 지표들에 대한 부트스트랩 구간이에요
- `total_cost_usd` — 실행 비용이에요 (로컬 모델처럼 공개된 가격이 없는 모델의 경우 `null`로 표시되며, 절대로 $0으로 보고되지 않아요)

또한 보고서에는 모델에 전달된 내용이 포인터(`instructions`: 코칭 파일의 이름과 SHA-256, 시스템 프롬프트의 SHA-256, 전체 텍스트가 위치한 로컬 머신의 실행 로그 경로)로 기록돼요. 리더보드로 전송되는 실행 카드는 이 보고서를 바탕으로 조합돼요. 여기에 메서드 카드와 재현성 지문(fingerprint)이 추가되며, 동일한 chrF++ 및 CI가 맨 앞에 표시돼요. `composite` 및 `quality_tier`는 둘 다 [폐지](/docs/network/specifications/scoring#how-runs-are-scored)되었으므로 `null`로 설정돼요. (표준 제정 이전에 작성된 보고서에는 `published_composite`가 포함되어 있을 수 있지만, 이는 레거시 복합 지표로 폐지되었으며 chrF++와 절대 비교되지 않아요.)
`mt-eval publish <report> --dry-run` 명령은 카드가 게시될 형태 그대로 출력해 줘요. 스키마에 대한 자세한 내용은 [실행 카드 사양](/docs/network/specifications/run-card)을 참고하세요.

---

## 3단계: 제출하기

게시는 **라이브** 리더보드에 직접 기록되므로 명시적인 `--prod` 플래그가 필요해요. 이 플래그가 없으면 하네스가 작업을 거부하고 안내 메시지를 표시해요. 먼저 미리보기를 확인해 보세요:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

실행 후 곧바로 게시하려면 `mt-eval run`에 `--publish --prod`를 추가하세요. 게시 단계가 실패하더라도 해당 실행의 점수는 그대로 저장되며, 하네스가 정확한 재시도 명령어를 출력해 줘요. 스크립트에서는 환경 변수에 `MT_EVAL_ALLOW_PROD=1`를 설정하는 것이 `--prod`를 전달하는 것과 동일하게 작동해요.

:::note[제출 API 및 웹 업로드는 아직 지원되지 않아요]
`POST https://champollion.dev/api/leaderboard/submit` 엔드포인트와 리더보드 업로드 UI가 계획되어 있지만 **아직 구현되지 않았어요**. 기능이 출시되기 전까지 작동하는 유일한 제출 경로는 `mt-eval publish`예요(풀 리퀘스트를 통한 접수는 지원하지 않아요).
:::

---

## 다음 단계

1. 제출 항목이 유효한지 검증해요(데이터셋 해시, 실행 카드 무결성).
2. 결과가 리더보드에 **자체 벤치마크(Self-benchmarked)**(신뢰 티어 1)로 표시돼요.
3. **Champollion 검증(Champollion Verified)** 상태는 제출된 결과물을 SHA로 고정된 말뭉치와 대조하여 다시 점수를 매겨 부여돼요. 재채점기는 메인테이너가 직접 실행하는 수동 명령어로, 제출 시 자동으로 실행되거나 예약 실행되지 않으므로 현재는 모든 항목이 자체 벤치마크 상태로 유지돼요([검증 티어](/docs/network/leaderboard/rules#verification-tiers)).
4. 공개 리더보드에 오른다고 해서 어떤 권리도 양도되지 않아요. 방법에 대한 권리는 참가 신청 전에 공지된, 비공개 대회의 명시된 상금 약관에 따라서만 양도돼요([소유권 및 약관](/docs/network/sovereignty/ownership-transfer)).

---

## 참고 항목

- [하네스 사용법](/docs/network/specifications/harness) — 전체 CLI 레퍼런스
- [리더보드 규칙](/docs/network/leaderboard/rules) — 제출 기준 및 부정 방지 정책
- [메서드 구축하기](/docs/network/specifications/methods) — TranslationMethod 프로토콜
- [데이터셋](/docs/network/leaderboard/datasets) — 사용 가능한 평가 데이터셋
