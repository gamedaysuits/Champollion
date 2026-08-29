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
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
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
pip install mt-eval-harness
```

---

## 1단계: 하네스 실행하기

하네스는 표준화된 데이터셋에 대해 여러분의 메서드를 채점해요:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| 플래그 | 기능 |
|---|---|
| `--corpus` | 코퍼스 파일 경로 또는 등록된 코퍼스 id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | 모델 슬러그 — 짧은 별칭(예: `gemini-pro`) 또는 전체 OpenRouter ID |
| `-n, --name` | 실행에 대한 사람이 읽을 수 있는 레이블(리더보드에 표시됨) |
| `--temperature` | 샘플링 온도(낮을수록 더 결정적임) |
| `--fst-retries` | 선택 사항: FST 재시도 횟수 |
| `--publish` | 실행이 완료되면 실행 카드를 리더보드에 게시 |

하네스는 **실행 카드**를 생성해요. 이는 점수, 데이터셋 해시, 모델 슬러그, 그리고 결과를 정확한 실험 구성에 연결하는 암호학적 지문을 담은 독립적인 JSON 파일이에요.

---

## 2단계: 실행 카드 검토하기

Run card는 `eval/logs/harness/`에 저장돼요. 제출하기 전에 자신의 것을 확인하세요:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

확인해야 할 주요 필드:
- `scores.chrf_plus_plus` — 기본 품질 지표
- `scores.exact_match_rate` — 완벽한 번역의 비율
- `scores.fst_acceptance_rate` — 형태론적 유효성(FST를 사용한 경우)
- `totals.total_cost_usd` — 실행에 든 비용
- `fingerprint` — 실험의 재현성 해시

전체 스키마는 [실행 카드 명세](/docs/network/specifications/run-card)를 참고하세요.

---

## 3단계: 제출하기

### 자동 게시

하네스를 실행할 때 `--publish`을 전달했다면, 실행 카드가 이미 업로드된 상태예요.

### 수동 게시

하네스로 실행 카드를 게시하세요:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

게시 흐름을 사용하고 싶지 않다면, 실행 카드 JSON을 `results/` 디렉터리에 담아
[eval harness 저장소](https://github.com/gamedaysuits/Champollion)에
풀 리퀘스트를 열어 주세요.

:::note[제출 API와 웹 업로드는 아직 사용할 수 없어요]
`POST https://champollion.dev/api/leaderboard/submit` 엔드포인트와
Leaderboard 업로드 UI는 계획되어 있지만 **아직 구현되지 않았어요**. 출시되기 전까지는
작동하는 제출 경로는 `mt-eval publish`과 위의 harness 저장소에 대한 풀 리퀘스트뿐이에요.
:::

---

## 다음 단계

1. 제출물이 검증돼요(dataset hash, run card 무결성).
2. 결과가 리더보드에 **Self-benchmarked**(신뢰도 티어 1)로 표시돼요.
3. **Champollion Verified** 상태를 얻으려면, 메인테이너가 결과를 재현할 수 있도록 method를 설치 가능한 플러그인으로 제출해 주세요.
4. 원주민 언어 method의 경우: 해당 method가 최상위권에 도달하면 [소유권 이전](/docs/network/sovereignty/ownership-transfer) 절차가 시작돼요.

---

## 참고 항목

- [하네스 사용법](/docs/network/specifications/harness) — 전체 CLI 레퍼런스
- [리더보드 규칙](/docs/network/leaderboard/rules) — 제출 기준 및 부정 방지 정책
- [메서드 구축하기](/docs/network/specifications/methods) — TranslationMethod 프로토콜
- [데이터셋](/docs/network/leaderboard/datasets) — 사용 가능한 평가 데이터셋
