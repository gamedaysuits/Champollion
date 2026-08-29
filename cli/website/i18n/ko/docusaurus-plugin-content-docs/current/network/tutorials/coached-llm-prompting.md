---
sidebar_position: 2
title: "쿡북: 코칭 기반 LLM 프롬프팅"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# 코칭 기반 LLM 프롬프팅

> **핵심 아이디어:** 문법 규칙, 이중 언어 사전, 스타일 노트를 LLM의 시스템 프롬프트에 직접 주입하세요. 학습도, 파인튜닝도 필요 없습니다 — 출력을 유효한 번역으로 유도하는 구조화된 언어 지식만 있으면 됩니다.

:::info[이 문서는 완성된 구현이 아니라 요리책입니다]
이 가이드는 접근 방식과 그 핵심 설계 결정을 개략적으로 설명해요. 여러분의 언어 쌍, 사용 가능한 리소스, 평가 목표에 맞게 조정하세요.
:::

## 언제 사용해야 할까요

- 대상 언어에 대한 **언어 지식**(문법 규칙, 사전 항목, 스타일 선호도)은 있지만, 파인튜닝에 충분한 병렬 데이터는 없는 경우
- **빠르게 반복**하고 싶은 경우 — 프롬프트 변경은 몇 초 만에 배포되며, 재학습이 필요 없어요
- 대상 언어에 LLM이 자주 틀리는 **알려진 패턴**(성 일치, 문자 표기 규칙, 격식 수준)이 있는 경우
- 코칭 기반 프롬프팅을 기준선과 비교 벤치마크하고, 효과적인 방법을 중심으로 반복하고 싶은 경우

## 작동 방식

1. **코칭 데이터 구성** — 구조화된 JSON 파일에 문법 규칙, 이중 언어 사전, 스타일 노트를 담아요
2. **레지스터 구성** — 언어, 문자, 톤을 설정하는 시스템 프롬프트 접두사
3. **하니스 실행** — 코칭 데이터가 모든 LLM 프롬프트에 주입돼요
4. **실패 검토** — 품질 게이트가 거부한 항목을 살펴보고, 패턴을 해결할 규칙을 추가하세요
5. **반복** — 각 코칭 파일 수정본은 새로운 실험이며, 하니스가 이를 모두 추적해요

## 코칭 데이터 구조

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## 주요 설계 결정

**규칙 구체성 대 컨텍스트 윈도우:** 규칙이 많을수록 LLM에 더 많은 지침을 제공하지만, 실제 번역에 쓸 수 있는 컨텍스트 윈도우를 잠식해요. 영향력이 큰 규칙 5~10개로 시작하고, 특정 실패 패턴이 보일 때만 더 추가하세요.

**사전 커버리지:** 완전한 사전이 필요하지는 않아요 — LLM이 일관되게 틀리는 용어에 집중하세요. 강제 용어가 20~30개만 있어도 일관성이 크게 개선될 수 있어요.

**규칙 순서의 중요성:** 가장 중요한 규칙을 먼저 배치하세요. LLM은 앞쪽 지침에 더 강하게 주의를 기울여요.

## 실험 실행하기

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## 장단점

| | |
|---|---|
| ✅ 학습 비용 제로 | ❌ 품질 상한이 LLM의 기본 지식에 의해 제한됨 |
| ✅ 즉각적인 반복(프롬프트 변경 → 재실행) | ❌ 컨텍스트 윈도우가 코칭 분량을 제한함 |
| ✅ 모든 LLM 제공자와 호환 | ❌ 규칙이 충돌할 수 있음 — 프롬프트 상호작용 디버깅은 기술임 |
| ✅ 투명함 — LLM이 보는 내용을 정확히 읽을 수 있음 | ❌ 새로운 지식을 만들지 않고, 기존 지식을 유도할 뿐임 |

## 잘 결합되는 방식

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 코칭 + 형태론 검증으로 코칭만으로는 놓치는 부분을 잡아내요
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 강제 용어는 코칭의 한 형태예요
- **[Few-Shot Prompting](./few-shot-prompting)** — 예시 + 규칙을 함께 쓰면 둘 중 하나만 쓰는 것보다 강력해요

## 함께 보기

- [Method Interface](/docs/network/specifications/methods) — 코칭 데이터 형식과 TranslationMethod 프로토콜
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — 전체 맥락
- [Eval Harness](/docs/network/specifications/harness) — 실험 실행 방법
