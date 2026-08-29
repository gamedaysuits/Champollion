---
sidebar_position: 3
title: "쿡북: Few-Shot Prompting"
---

# Few-Shot Prompting

> **핵심 아이디어:** 검증된 고품질 번역 쌍을 in-context 예시로 포함하여, LLM이 지시가 아닌 시연을 통해 대상 언어의 패턴, 스타일, 관례를 학습하도록 해요.

:::info[이것은 쿡북이며, 완성된 구현이 아니에요]
이 가이드는 접근 방식과 그 핵심 설계 결정을 개략적으로 설명해요. 여러분의 언어 쌍과 사용 가능한 리소스에 맞게 조정하세요.
:::

## 언제 사용해야 할까요

- **검증된 번역이 소량** 있을 때 (gold 쌍이 5~10개만 있어도 도움이 돼요)
- LLM이 규칙이 아닌 예시를 통해 **특정 스타일이나 어조**를 따르도록 하고 싶을 때
- 대상 언어에 **설명하기보다 보여주기가 쉬운** 패턴이 있을 때 (어순, 접사 패턴, 격식 표현 등)

## 작동 방식

1. **예시 쌍 선별** — 핵심 패턴을 보여주는 고품질 원문→대상 번역을 선택해요
2. **in-context 예시로 형식화** — 실제 번역 요청 전에 시스템 또는 사용자 프롬프트에 포함해요
3. **하니스 실행** — 예시가 zero-shot 대비 지표를 개선하는지 측정해요
4. **예시 선택 반복 개선** — 다양한 실패 양상을 다루도록 예시를 교체해요

## 예시 프롬프트 구조

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## 중요한 규칙: 평가 데이터 오염 금지

:::danger[평가 데이터를 few-shot 예제로 사용하지 마세요]
여러분의 예제가 평가 데이터셋에서 나온 것이라면, 여러분의 방법은 리더보드에서 **실격**돼요. Few-shot 예제는 사전, 교과서, 커뮤니티가 검증한 쌍, 또는 별도의 개발 세트와 같은 독립적인 출처에서 나와야 해요. 하니스는 여러분의 정확한 프롬프트를 지문화하기 때문에 오염은 감지될 수 있어요.
:::

## 주요 설계 결정

**예시는 몇 개나?** 3~8개가 가장 이상적이에요. 더 적으면 LLM에게 신호가 너무 부족하고, 더 많으면 컨텍스트 윈도우를 잡아먹으면서 효과는 점점 줄어들어요.

**어떤 예시를?** 난이도보다 다양성을 우선하세요. 다양한 문장 구조, 단어 길이, 문법적 특징을 다루세요. 예시가 하나의 패턴에 몰리지 않도록 하세요.

**정적 선택 vs. 동적 선택?** 정적 예시가 더 간단해요. 동적 선택(현재 입력과 유사한 예시를 고르는 방식)은 품질을 높일 수 있지만 복잡성이 늘어나요 — 검색 단계에는 [chained models](./chained-models)를 고려해 보세요.

## 장단점

| | |
|---|---|
| ✅ 스타일 매칭에 강력함 | ❌ 작은 컨텍스트 윈도우가 예시 개수를 제한함 |
| ✅ 학습이 필요 없음 | ❌ 예시 선택은 과학이 아니라 기술임 |
| ✅ 모든 LLM에서 동작함 | ❌ 평가 데이터 오염 위험(실격) |
| ✅ 다양한 예시 세트를 A/B 테스트하기 쉬움 | ❌ 예시가 모든 입력 유형에 일반화되지 않을 수 있음 |

## 잘 결합되는 방식

- **[Coached LLM Prompting](./coached-llm-prompting)** — 규칙 + 예시를 함께 쓰면 둘 중 하나만 쓰는 것보다 나아요
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 강제 용어 + 스타일 예시
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 스타일은 예시로, 형태론적 정확성은 FST로

## 함께 보기

- [MT 평가 규칙](/docs/network/leaderboard/rules) — 무엇이 실격되는지
- [평가 데이터셋](/docs/network/leaderboard/datasets) — 예시로 사용할 수 **없는** 것을 알아두세요
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages)
