---
sidebar_position: 7
title: "쿡북: 규칙 기반 + LLM 하이브리드"
---

# 규칙 기반 + LLM 하이브리드

> **핵심 아이디어:** 정확하다고 확신하는 패턴(형태론적 접사, 숫자 형식, 알려진 구문 구조)에는 결정론적 언어 규칙을 사용하고, 그 외 모든 것에 대한 창의적인 번역은 LLM에 맡기세요. 규칙이 적용되는 곳에서는 규칙이 LLM을 재정의하고, LLM은 그 빈틈을 채워요.

:::info[이 문서는 요리책일 뿐, 완성된 구현이 아니에요]
이 가이드는 하이브리드 아키텍처의 개요를 설명해요. 구체적인 규칙은 대상 언어의 문법과 사용 가능한 언어 자원에 전적으로 달려 있어요.
:::

## 언제 사용해야 할까요

- 대상 언어에 대한 **깊은 언어학적 전문성**이 있는 경우(또는 언어학자에게 접근할 수 있는 경우)
- 일부 번역 패턴이 **결정론적**인 경우 — 올바른 출력을 확실하게 알고 있는 경우
- LLM이 특정 패턴(숫자 형식, 경어, 교착어)에서 **지속적으로 실패하는** 경우
- 중요도가 높은 패턴에 대해 **정확성을 보장**하면서 나머지에 대해서는 유창성을 유지하고 싶은 경우

## 작동 방식

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **규칙 정의** — 정규식 패턴, FST 조회, 알려진 번역을 위한 조회 테이블
2. **전처리** — 소스에서 규칙에 일치하는 세그먼트를 식별하고 추출해요
3. **LLM 번역** — 규칙 출력을 제약 조건으로 하여 나머지 텍스트를 번역해요
4. **병합** — 규칙 출력이 있는 경우 이를 우선하여 번역을 재조립해요
5. **검증** — 병합된 결과에 대한 선택적 FST/규칙 검사

## 예시: 숫자 및 날짜 규칙

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## 주요 설계 결정

**규칙 우선순위:** 규칙과 LLM이 동일한 세그먼트에 대해 모두 출력을 생성할 때 어느 것이 우선할까요? **정확성이 중요한** 패턴에는 규칙이 우선해야 해요. **유창성이 중요한** 패턴에는 LLM이 우선해야 해요.

**세분성:** 단어 수준 규칙(사전 조회), 구 수준 규칙(관용구 매핑), 구조 규칙(문장 재배열). 단어 수준에서 시작하고, 패턴을 식별하면서 구 수준을 추가하세요.

**규칙 유지 관리:** 모든 규칙은 유지 관리 의무를 수반해요. 대략적인 규칙을 대량으로 두기보다는 신뢰도가 높은 소수의 규칙을 선호하세요. 규칙이 올바른지 확신할 수 없다면 LLM에 맡기세요.

## 장단점

| | |
|---|---|
| ✅ 규칙이 적용되는 곳에서 정확성 보장 | ❌ 깊은 언어학적 전문성이 필요해요 |
| ✅ 투명함 — 규칙을 읽고 감사할 수 있어요 | ❌ 규칙/LLM 경계에서 부자연스러운 출력이 발생할 수 있어요 |
| ✅ 규칙은 빠름(API 비용 없음) | ❌ 규칙 수가 늘어날수록 유지 관리 부담이 커져요 |
| ✅ 점진적 — 배우면서 규칙을 추가할 수 있어요 | ❌ 규칙 경계에서의 굴절 처리가 어려워요 |

## 잘 결합되는 방식

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — 특정 종류의 규칙 엔진으로서의 FST
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 사전 조회는 간단한 규칙이에요
- **[Coached LLM Prompting](./coached-llm-prompting)** — 코칭은 약한 선호를 처리하고, 규칙은 강한 요구 사항을 처리해요

## 함께 보기

- [GiellaLT](https://giellalt.github.io/) — 100개 이상의 언어를 위한 오픈소스 FST 인프라
- [Apertium](https://www.apertium.org/) — 이중 언어 사전을 갖춘 규칙 기반 MT 플랫폼
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages)
