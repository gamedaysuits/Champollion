---
sidebar_position: 8
title: "쿡북: 역번역 증강(Back-Translation Augmentation)"
---

# 역번역 증강(Back-Translation Augmentation)

> **핵심 아이디어:** 기존 타겟 언어 텍스트를 소스 언어로 다시 번역해 합성 병렬 데이터를 생성한 다음, 이 합성 쌍을 활용해 정방향 모델을 학습하거나 프롬프트로 사용해요. 이렇게 하면 병렬 코퍼스를 저렴하게 확장할 수 있지만, 품질과 관련한 주의 사항이 있어요.

:::info[이 문서는 요리책이며, 완성된 구현이 아니에요]
이 가이드는 전략과 그에 따른 중요한 함정들을 개략적으로 설명해요. 역번역은 강력하지만 주의 깊게 수행하지 않으면 오류를 증폭시킬 수 있어요.
:::

## 언제 사용해야 할까요

- **타겟 언어 단일어 텍스트**는 있지만 병렬 데이터가 부족할 때
- 수작업 번역 없이 [파인튜닝](./fine-tuned-model)을 위한 **학습 코퍼스를 확장**하고 싶을 때
- **퓨샷 예시**가 더 필요하지만 사람의 번역을 충분히 빠르게 확보할 수 없을 때
- 합성 데이터를 **적극적으로 품질 필터링**할 의향이 있을 때

## 작동 방식

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **단일어 텍스트 수집** — 타겟 언어로 된 책, 기사, 녹취록, 소셜 미디어
2. **역번역** — LLM 또는 MT API를 사용해 각 문장을 소스 언어로 번역
3. **품질 필터링** — 다시 번역(라운드 트립)해 비교하고, 라운드 트립 결과 ≈ 원본인 쌍만 유지
4. **합성 코퍼스 활용** — 파인튜닝, 퓨샷 예시 또는 코칭 데이터로 사용

## 품질 필터링: 라운드 트립 테스트

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## 핵심적인 함정: 오류 증폭

:::warning[역번역은 기존 모델의 편향을 증폭시켜요]
역번역 모델이 지속적으로 동일한 오류를 만든다면, 합성 코퍼스는 그 오류들을 "정답"으로 인코딩하게 돼요. 이는 피드백 루프를 만들어요: 잘못된 데이터로 학습 → 더 나쁜 번역 생성 → 더 나쁜 합성 데이터 생성. **항상 품질 필터링을 적극적으로 수행하고**, 합성 데이터를 검증된 사람의 번역과 섞으세요.
:::

## 단일어 텍스트를 찾을 수 있는 곳

- 커뮤니티 뉴스레터, 신문, 간행물
- 타겟 언어로 된 정부 문서(예: Inuktitut의 경우 Nunavut Hansard)
- 교육 자료 및 교과서
- 종교 텍스트(여러 언어로 널리 제공됨)
- 소셜 미디어(적절한 권한과 품질 필터링을 거쳐서)
- 언어 프로그램에서 전사한 오디오/비디오

## 장단점

| | |
|---|---|
| ✅ 학습 데이터를 저렴하게 확장 | ❌ 필터링하지 않으면 모델 오류를 증폭 |
| ✅ 풍부한 단일어 텍스트 활용 | ❌ 품질 상한이 역번역 모델에 의해 제한됨 |
| ✅ 대규모로 손쉽게 생성 | ❌ 라운드 트립 필터링은 연산 부하가 큼 |
| ✅ 다른 접근법을 보완 | ❌ 합성 데이터는 절대 사람의 번역만큼 좋지 않음 |

## 잘 결합되는 방식

- **[파인튜닝 모델](./fine-tuned-model)** — 역번역으로 파인튜닝용 학습 데이터를 생성해요
- **[코퍼스 생성](./corpus-creation)** — 합성 데이터가 사람이 만든 코퍼스를 보완해요
- **[코칭된 LLM 프롬프팅](./coached-llm-prompting)** — 합성 예시가 코칭 사전에 정보를 제공할 수 있어요

## 함께 보기

- [평가 데이터셋](/docs/network/leaderboard/datasets) — 합성 데이터는 평가 데이터와 겹쳐서는 안 돼요
- [리더보드 규칙](/docs/network/leaderboard/rules) — 오염 정책
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages)
