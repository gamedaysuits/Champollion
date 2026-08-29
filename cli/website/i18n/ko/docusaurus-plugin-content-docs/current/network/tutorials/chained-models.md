---
sidebar_position: 6
title: "쿡북: 연결된 모델"
---

# 연쇄 모델 (다단계 파이프라인)

> **핵심 아이디어:** 모델 A가 대략적인 번역을 생성 → 모델 B가 이를 후편집 → 모델 C가 결과를 채점하거나 검증해요. 각 단계는 한 가지에 특화돼요. 파이프라인의 출력은 어떤 단일 모델보다도 우수해요.

:::info[이 문서는 완성된 구현이 아니라 요리책이에요]
이 가이드는 다단계 파이프라인 아키텍처를 개략적으로 설명해요. 구체적인 모델과 체인 구성은 언어 쌍과 예산에 따라 달라져요.
:::

## 언제 사용해야 할까요

- 단일 모델이 **일관되지 않은 품질**을 내는 경우 — 일부 입력에서는 좋지만 일부에서는 나쁜 경우
- **생성과 검증을 분리**하고 싶은 경우 — 한 모델은 만들고, 다른 모델은 비평해요
- **번역당 여러 번의 API 호출**에 대한 예산이 있는 경우 (지연 시간과 비용이 단계에 따라 선형적으로 증가해요)
- **서로 다른 강점**을 가진 모델을 결합하고 싶은 경우 (예: 창의적인 생성기 + 정밀한 편집기)

## 작동 방식

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## 예시: 3단계 파이프라인

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## 일반적인 체인 패턴

| 패턴 | 단계 | 사용 사례 |
|---------|--------|----------|
| **생성 → 편집** | 빠른 LLM → 강력한 LLM | 비용 효율적인 품질 개선 |
| **생성 → 검증 → 재시도** | LLM → FST/규칙 → LLM (실패 시 재시도) | 형태론적 정확성 ([FST-Gated](./fst-gated-pipeline) 참조) |
| **생성 → 역번역 → 채점** | LLM(en→crk) → LLM(crk→en) → 비교 | 왕복 일관성 검사 |
| **앙상블 → 투표** | 3개의 LLM을 독립적으로 → 다수결 투표 | 다양성을 통한 견고성 |

## 주요 설계 결정

**지연 시간 예산:** 각 단계는 지연 시간을 배가해요. 단계당 2초가 걸리는 3단계 체인 = 번역당 6초예요. 배치 평가에는 괜찮지만, 실시간에는 적합하지 않을 수 있어요.

**비용 배수:** 3단계 = API 비용의 3배예요. 초기 단계에는 저렴한 모델을, 중요한 단계에는 비싼 모델을 사용하세요.

**오류 전파:** 잘못된 1단계 출력은 2단계를 오도할 수 있어요. 이후 모델이 복구할 수 있도록 모든 단계에 원본 소스를 포함하세요.

## 장단점

| | |
|---|---|
| ✅ 전문가의 강점을 결합할 수 있음 | ❌ 단계마다 지연 시간과 비용이 배가됨 |
| ✅ 관심사의 분리 (생성 vs. 검증) | ❌ 디버깅이 복잡함 — 어느 단계가 오류를 일으켰나? |
| ✅ 개별 단계를 쉽게 교체할 수 있음 | ❌ 단계 간 오류 전파 |
| ✅ 왕복 검증으로 환각을 잡아냄 | ❌ 2~3단계를 넘어서면 수익이 감소함 |

## 잘 결합되는 방식

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 검증 단계로서의 FST
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 생성 단계에서의 사전 주입
- **[Coached LLM Prompting](./coached-llm-prompting)** — 하나 이상의 단계에서의 코칭

## 함께 보기

- [Eval Harness](/docs/network/specifications/harness) — 하니스는 엔드투엔드 파이프라인 출력을 측정해요
- [Run Card Specification](/docs/network/specifications/run-card) — 지연 시간과 비용은 항목별로 기록돼요
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
