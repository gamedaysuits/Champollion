---
sidebar_position: 9
title: "쿡북: 진화 / 탐색 기반"
---

# 진화적 / 탐색 기반 번역

> **핵심 아이디어:** 여러 후보 번역을 생성하고, 적합도 함수(chrF++, FST 수용도, 왕복 일관성)에 따라 점수를 매기고, 가장 성능이 좋은 후보를 변이시킨 다음 반복해요. 번역을 위한 자연 선택이라고 할 수 있어요 — 가장 적합한 것이 살아남아요.

:::info[이 문서는 요리책이지 완성된 구현이 아니에요]
이것은 요리책 시리즈에서 가장 실험적인 접근 방식이에요. 대규모 MT에서 검증되지는 않았지만, 아키텍처는 견고하며 하네스는 그것이 만들어내는 무엇이든 기꺼이 점수를 매길 거예요.
:::

## 언제 사용해야 할까요

- **좋은 점수 함수**는 있지만, 단일 모델로는 일관된 결과가 나오지 않을 때
- 단일 탐욕적 생성보다 **해 공간을 더 폭넓게 탐색**하고 싶을 때
- 다수의 병렬 생성(입력당 수십 개의 후보)을 감당할 **연산 예산**이 있을 때
- **새로운 연구**에 관심이 있을 때 — 이 접근법은 저자원 MT에서 아직 충분히 탐구되지 않았어요

## 작동 방식

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## 골격

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## 적합도 함수 설계

적합도 함수가 전부예요. 선택지는 다음과 같아요:

| 메트릭 | 측정하는 것 | 자동화 가능? |
|--------|-----------------|------------|
| 레퍼런스 대비 chrF++ | 골드와의 문자 단위 유사도 | ✅ 예 |
| FST 수용률 | 형태론적 유효성 | ✅ 예 (FST가 있는 경우) |
| 왕복 일관성 | 역번역 시 원문이 복원되나요? | ✅ 예 |
| LLM-as-judge | 다른 LLM이 유창성/정확성을 평가 | ✅ 예 (단, 노이즈가 있음) |
| 사전 용어 존재 여부 | 알려진 용어가 올바르게 나타나나요? | ✅ 예 |

:::tip[여러 신호를 결합하세요]
여러 지표를 가중치로 조합하면 단일 지표보다 더 견고한 적합도 함수를 만들 수 있어요. 이는 하네스 자체의 [복합 점수](/docs/network/leaderboard/rules)를 반영한 거예요.
:::

## 장단점

| | |
|---|---|
| ✅ 다양한 해를 탐색해요 | ❌ 연산 비용이 큼 (N × G API 호출) |
| ✅ 단일 모델로는 찾지 못하는 접근법을 발견할 수 있어요 | ❌ 좋은 적합도 함수가 필요해요 |
| ✅ 병렬화 가능해요 | ❌ 느림 — 번역당 여러 번의 생성이 필요해요 |
| ✅ 모델에 구애받지 않아요 | ❌ 몇 세대가 지나면 수익 체감이 발생해요 |

## 잘 결합되는 방식

- **[연쇄 모델](./chained-models)** — 변이 단계는 일종의 연쇄예요
- **[FST 게이트 파이프라인](./fst-gated-pipeline)** — 적합도 신호로서의 FST 수용도
- **[사전 보강 LLM](./dictionary-augmented-llm)** — 적합도 신호로서의 사전 용어 존재 여부

## 함께 보기

- [Run Card 명세](/docs/network/specifications/run-card) — 항목별로 비용과 지연 시간이 기록돼요
- [Eval 하니스](/docs/network/specifications/harness) — 하니스는 과정이 아니라 최종 출력에 점수를 매겨요
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages)
