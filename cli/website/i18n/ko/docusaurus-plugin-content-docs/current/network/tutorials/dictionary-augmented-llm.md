---
sidebar_position: 4
title: "쿡북: 사전 기반 LLM"
---

# 사전 보강 LLM

> **핵심 아이디어:** 이중 언어 사전에서 특정 용어에 대해 검증된 알려진 번역을 강제하고, LLM이 문장 구조와 알려지지 않은 어휘를 처리하도록 합니다. 사전은 정확성의 기준점을 제공하고, LLM은 유창함을 제공해요.

:::info[이 문서는 완성된 구현이 아니라 쿡북입니다]
이 가이드는 접근 방식을 개략적으로 설명해요. 구체적인 사전 매칭 및 주입 전략은 언어 쌍과 사용 가능한 어휘 자원에 따라 달라질 거예요.
:::

## 언제 사용해야 할까요

- 언어 쌍에 대한 **이중 언어 사전이 존재할 때** (작은 것이라도)
- LLM이 핵심 용어를 지속적으로 **환각(hallucinate)할 때** — 존재하지 않는 단어를 만들어낼 때
- 번역 전반에 걸쳐 **용어 일관성**이 필요할 때 (같은 단어가 어디서나 동일하게 번역됨)
- 표준 LLM 번역이 틀리는 **도메인 특화 콘텐츠**(법률, 의료, 교육)를 번역할 때

## 작동 방식

1. **이중 언어 사전 로드** — 출발어 용어를 검증된 도착어 번역에 매핑하는 키→값 쌍
2. **출발어 텍스트를 사전과 매칭** — 입력에서 알려진 번역이 있는 용어를 식별
3. **매칭 결과를 프롬프트에 주입** — LLM에게 "이 용어들은 반드시 다음과 같이 번역되어야 한다"고 지시
4. **LLM이 번역 생성** — 사전 제약을 필수 요구사항으로 적용
5. **후처리** — 사전 용어가 출력에 나타나는지 검증; 그렇지 않으면 재시도

## 사전 형식

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## 프롬프트 구조

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## 주요 설계 결정

**매칭 전략:** 정확한 일치가 가장 단순해요. 표제어 기반 매칭("teachers"가 "teacher"와 일치)은 더 많이 잡아내지만 출발어 표제어 추출기가 필요해요. 퍼지 매칭은 오탐(false positive) 위험이 있어요.

**굴절 처리:** 다종합어(polysynthetic language)에서는 사전 형태가 문장에 맞도록 굴절되어야 할 수 있어요. 어근을 제공하고 LLM이 굴절하도록 하거나, 여러 굴절 형태를 제공할 수 있어요. [FST](./fst-gated-pipeline)로 결과를 검증할 수 있어요.

**충돌 해결:** LLM이 사전 용어를 무시하면 어떻게 할까요? 선택지: (a) 더 강력한 지시로 재시도, (b) 문자열 치환으로 후처리, (c) 수용하고 검토를 위해 플래그 표시.

## 장단점

| | |
|---|---|
| ✅ 알려진 용어에 대한 환각 제거 | ❌ 사전 커버리지는 항상 불완전함 |
| ✅ 핵심 어휘의 일관성 보장 | ❌ 굴절/활용이 문장 맥락과 맞지 않을 수 있음 |
| ✅ 감사 및 업데이트가 용이함 | ❌ 과도한 제약은 부자연스러운 출력을 낳을 수 있음 |
| ✅ 사전은 재사용 가능한 자산 | ❌ 애초에 사전이 존재해야 함 |

## 사전을 찾을 수 있는 곳

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–영어 (FST 기반; morphodict 플랫폼은 오픈 소스이지만, 사전 콘텐츠 자체는 개방형 라이선스가 아니에요)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — 포괄적인 Plains Cree 참고 자료 (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — 수십 개의 언어 쌍을 지원하는 이중 언어 사전
- **[Giellatekno](https://giellalt.github.io/)** — Sámi, Uralic 및 기타 소수 언어를 위한 사전
- 커뮤니티에서 제작한 용어집, 교육 자료, 용어 목록

## 잘 결합되는 방식

- **[Coached LLM Prompting](./coached-llm-prompting)** — 사전 항목은 일종의 코칭 데이터예요
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST가 사전 용어가 올바르게 굴절되었는지 검증해요
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — 하나의 규칙 계층으로서 결정론적 사전 조회

## 참고 항목

- [저자원 언어 지원](/docs/network/community/low-resource-languages) — 전체 맥락
- [Method Interface](/docs/network/specifications/methods) — 메서드 구조 방식
