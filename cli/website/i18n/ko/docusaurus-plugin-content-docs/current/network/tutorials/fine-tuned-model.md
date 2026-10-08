---
sidebar_position: 5
title: "쿡북: Fine-Tuned Model"
---

# Fine-Tuned Model

> **핵심 아이디어:** 오픈 웨이트 모델(Llama, Mistral, Gemma)을 대상 언어 쌍의 병렬 텍스트로 파인튜닝하세요. 잠재적으로 가장 높은 품질 한계를 가지지만, 부족할 수 있는 병렬 데이터가 필요하며, 평가 데이터 오염 규칙이 엄격해요.

:::info[이것은 쿡북이며, 완성된 구현이 아니에요]
이 가이드는 접근 방식, 데이터 요구 사항, 그리고 함정을 설명해요. 실제 학습 인프라는 harness 범위를 벗어나요.
:::

## 언제 사용해야 할까요

- 평가 데이터셋과 **완전히 독립적인 병렬 코퍼스**(수백~수천 개의 문장 쌍)에 접근할 수 있어요
- 학습을 위한 **GPU 접근 권한**(로컬 하드웨어, 클라우드, 또는 대학 컴퓨팅 클러스터)이 있어요
- 특정 언어 쌍에 대해 **가장 높은 품질 한계**를 원하고 학습에 투자할 의향이 있어요
- 다른 접근 방식(coached prompting, few-shot)이 품질 정체에 도달했어요

## 작동 방식

1. **병렬 데이터 수집** — 독립적인 출처(교과서, 커뮤니티 아카이브, Hansard 기록, 종교 텍스트, 교육 자료)의 소스-타깃 문장 쌍
2. **학습 형식 준비** — instruction-tuning 형식(system prompt + input + expected output)
3. **파인튜닝** — 베이스 모델에 LoRA/QLoRA 적용(4-bit 양자화로 컨슈머 GPU에서도 실행 가능)
4. **하니스로 평가** — 파인튜닝된 모델을 평가 하니스에 실행
5. **반복** — 학습 데이터, 하이퍼파라미터, 베이스 모델 선택 조정

## 데이터 요구사항

| 코퍼스 크기 | 예상 결과 |
|-------------|----------------|
| 50–200 쌍 | zero-shot 대비 미미한 개선; 과적합 가능성 |
| 200–1,000 쌍 | 눈에 띄는 스타일 및 용어 개선 |
| 1,000–5,000 쌍 | 특정 언어 쌍에 대한 상당한 품질 향상 |
| 5,000+ 쌍 | 베이스 모델의 품질 한계에 근접 |

:::danger[평가 데이터 오염 = 실격]
학습 데이터는 평가 데이터셋과 절대 겹쳐서는 안 돼요. 문장도, 어휘 목록도, 동일한 내용의 의역도 안 돼요. harness는 여러분의 출력물을 지문처럼 식별하며, 통계적 중복은 감지될 수 있어요. 데이터 소스가 독립적인지 확실하지 않다면, 제외하는 쪽을 택하세요. [Leaderboard Rules](/docs/network/leaderboard/rules)를 참고하세요.
:::

## 스켈레톤: LoRA 파인튜닝

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## 병렬 데이터를 찾는 곳

- **커뮤니티 아카이브** — 교육 자료, 정부 문서, 이중 언어 출판물
- **Nunavut Hansard** — 130만 개의 정렬된 영어-이누크티투트 쌍(NRC Canada)
- **Bible translations** — 많은 저자원 언어에 대해 사용 가능하지만, 도메인에 특화되어 있어요
- **교육용 교과서** — 언어 학습 맥락을 위해 이중 언어로 제공되는 경우가 많아요
- **직접 만들기** — [Corpus Creation Guide](./corpus-creation)를 참고하세요

## 장단점

| | |
|---|---|
| ✅ 가장 높은 품질 한계 | ❌ 병렬 데이터 필요(LRL의 경우 부족) |
| ✅ 모델이 언어별 패턴을 학습 | ❌ GPU 비용(LoRA가 도움이 되긴 하지만) |
| ✅ 프롬프트 기반 접근 방식보다 우수할 수 있음 | ❌ 소규모 데이터셋에서 과적합 위험 |
| ✅ 일회성 학습 비용, 이후 저렴한 추론 | ❌ 엄격한 평가 오염 규칙 |

## 잘 결합되는 방식

- **[Corpus Creation](./corpus-creation)** — 필요한 학습 데이터를 구축하세요
- **[Back-Translation](./back-translation)** — 병렬 코퍼스를 합성적으로 확장하세요
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 파인튜닝된 모델 + 형태론적 검증
- **[Coached LLM Prompting](./coached-llm-prompting)** — 파인튜닝된 베이스 위에 코칭 적용

## 함께 보기

- [Evaluation Datasets](/docs/network/leaderboard/datasets) — 학습에 사용할 수 없는 것을 알아두세요
- [Leaderboard Rules](/docs/network/leaderboard/rules) — 오염 정책
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
