---
sidebar_position: 10
title: "쿡북: 부분 번역 (사람 + 기계)"
---

# 부분 번역 (사람 + 기계)

> **개념:** 대표 샘플을 직접 번역하고, 그 샘플에서 기계 번역 방식이 사람의 스타일과 일치함을 입증한 다음, 나머지 대량 분량을 자동 번역해요. 사람의 품질과 기계의 규모를 결합하는 방식이에요 — 사람이 기준을 세우고, 기계가 그것을 따르죠.

:::info[이 문서는 완성된 구현이 아니라 쿡북이에요]
이 가이드는 인간-기계 하이브리드 워크플로우를 개략적으로 설명해요. 번역 에이전시, 커뮤니티 언어 작업자, 그리고 교육 환경에서 특히 유용해요.
:::

## 언제 사용해야 할까요

- **유창한 화자에게 접근할 수 있지만** 그들의 시간이 제한적인 경우
- **대량의 분량**을 번역해야 하지만 그중 일부만 완벽하면 되는 경우
- 사람의 번역으로 **품질 기준을 확립한** 다음 MT로 규모를 확장하고 싶은 경우
- 일부에 대한 화자의 검토가 가능한 **교육 또는 커뮤니티 환경**에서 작업하는 경우

## 작동 방식

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **대표 샘플 선정** — 다양한 문장 유형, 길이, 주제를 포함해요
2. **샘플 직접 번역** — 스타일, 어조, 용어에 대한 골드 스탠다드를 확립해요
3. **기계 번역 방식 구성** — 사람의 번역을 코칭 데이터, few-shot 예시, 또는 파인튜닝 데이터로 활용해요
4. **사람 샘플로 기계 채점** — 기계가 사람의 스타일과 일치하나요?
5. **나머지 자동 번역** — 샘플에서 기계 품질이 허용 가능한 경우
6. **선택적 사람 검토** — 신뢰도가 낮은 출력에 플래그를 지정해 화자 검토를 받아요

## 품질 보증: 스타일 일치 테스트

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## 샘플 선정

**분포를 포괄하세요.** 100개의 항목에는 다음이 포함되어야 해요:
- 짧은 구문 (1~3 단어)과 완전한 문장
- 일반 어휘와 도메인 특화 용어
- 단순한 구조와 복잡한 구조
- 여러 문법적 특징 (의문문, 명령문, 조건문)

**쉬운 것만 골라내지 마세요.** 샘플에는 사용하는 방식이 어려움을 겪을 만한 항목이 포함되어야 해요 — 바로 그곳에서 사람의 품질이 가장 중요하니까요.

## 커뮤니티 검토 워크플로

토착어 커뮤니티의 경우, 이 접근 방식은 화자의 시간을 존중해요:

1. **화자가 50~100개 항목을 번역** (집중 작업 2~4시간)
2. **기계가 나머지 900개를 번역** — 화자의 작업을 코칭 데이터로 활용해요
3. **화자가 플래그된 항목을 검토** — 기계가 가장 확신하지 못한 항목만 검토해요 (추가 1~2시간)
4. **결과:** 약 50시간 대신 약 5시간의 화자 시간으로 사람에 가까운 품질의 번역 1,000개를 얻어요

## 장단점

| | |
|---|---|
| ✅ 사람의 품질과 기계의 규모를 결합 | ❌ 초기 사람 투자가 필요함 |
| ✅ 제한적인 화자 가용성을 존중 | ❌ 기계가 모든 스타일적 뉘앙스를 포착하지 못할 수 있음 |
| ✅ 자연스러운 품질 보증 워크플로 | ❌ 샘플 선정이 전체 품질에 영향을 줌 |
| ✅ 커뮤니티/교육 환경에 적합 | ❌ 플래그된 항목에 대한 사람 검토 병목 |

## 잘 결합되는 방식

- **[Coached LLM Prompting](./coached-llm-prompting)** — 사람의 번역이 코칭 데이터에 정보를 제공해요
- **[Few-Shot Prompting](./few-shot-prompting)** — 사람의 번역을 컨텍스트 내 예시로 활용해요
- **[Corpus Creation](./corpus-creation)** — 사람 샘플이 곧 코퍼스 생성이에요

## 함께 보기

- [For Language Communities](/docs/network/community/for-language-communities) — 커뮤니티 참여 모델
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — 번역 데이터의 소유권
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
