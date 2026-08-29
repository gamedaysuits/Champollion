---
sidebar_position: 2
title: "화자에게 보수를 지급하는 방식"
slug: '/network/perspectives/how-speakers-get-paid'
description: "커뮤니티 검증자와 번역가가 벤치마크 작업에 대해 받는 보수, 화자에게 보수를 지급하는 것이 왜 타협 불가능한지, 그리고 네트워크가 성장함에 따라 보상이 어떻게 확장되는지 설명해요. 모든 수치는 공개된 사양에서 가져왔어요."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# 화자에게 보수를 지급하는 방식

> **투명성 안내.** 이 페이지의 모든 수치는 이미 공개된 명세서에 나와 있어요 — [Benchmark Specification §10](/docs/network/specifications/benchmark#10-cost-framework), [Speaker Validation Protocol](/docs/network/specifications/speaker-validation), 그리고 [Prize Specification](/docs/network/specifications/prizes)입니다. 이 페이지는 화자의 시간이 여기서 어떤 가치를 갖는지 알아내기 위해 명세서를 읽지 않아도 되도록, 그 수치들을 한곳에 쉬운 언어로 모아 놓았어요. 해당 문서들이 이미 명시한 내용을 넘어서는 어떤 약속도 하지 않아요.

기계가 생성한 문장이 실제로 자연스러운지, 그리고 올바른 의미를 담고 있는지 판단할 수 있는 이중언어 화자는 이 전체 시스템에서 가장 희소하고 가장 가치 있는 참여자예요. 나머지 모든 것 — 하네스, 지표, 리더보드 — 은 그 사람의 적은 시간을 최대한 활용하기 위해 존재해요.

그래서 첫 번째 원칙은 간단해요: **화자는 결과가 무엇을 보여주든 상관없이, 전문가 요율로 자신의 시간에 대해 보수를 받아요.**

---

## 화자에게 보수를 지급하는 것이 타협 불가능한 이유

언어 기술 연구는 오랫동안 유창한 화자를 무료 자원으로 취급하는 습관이 있었어요 — 화자를 제외한 모두를 위해 데이터셋, 논문, 경력을 만들어내는 "커뮤니티 참여" 말이에요. 우리는 그런 패턴을 착취적이라고 보며, 이 작업을 수행하기에 가장 적합한 사람들은 바로 그 언어로 가르치고, 번역하고, 아이를 키우는 시급한 일에 이미 시간을 빼앗기고 있는 사람들이에요.

세 가지 설계상의 결과가 따라와요:

1. **자원봉사 파이프라인 없음.** 우리는 화자에게 연구에 대한 호의로 평가 작업을 기부하라고 요청하지 않아요. 참여는 유급 계약이며, 이를 거절해도 화자에게는 아무런 비용이 들지 않아요.
2. **지급은 무조건적임.** 화자는 자신의 평점이 사용되든 안 되든 보수를 받으며, 지급은 결과에 좌우되지 않아요. 공개된 프로토콜은 각 작업 블록을 완료한 후 2주 이내에 지급하기로 약속하고 있어요.
3. **보상이 계약의 전부는 아님.** 평점을 제공하는 화자는 크레딧(실명 또는 익명, 본인 선택), 자신의 평점을 사용하는 출판물에 대한 선택적 공동 저자 자격, 언제든지 자신의 기여를 철회할 권리, 그리고 문제가 있다고 판단되는 결과의 출판에 대한 거부권도 받아요. 이러한 조건은 부속 문서가 아니라 [Speaker Validation Protocol §5–6](/docs/network/specifications/speaker-validation)에 명시되어 있어요.

## 공개된 요율

벤치마크 비용 프레임워크는 코퍼스 및 검증 작업에 대한 이중언어 화자 보상을 **시간당 $50–65 CAD**로 정하고 있어요. 역할별로 이것이 의미하는 바는 다음과 같아요:

### 벤치마크 코퍼스 구축

모든 방법이 채점의 기준으로 삼는 참조 번역을 만드는 것은 기초가 되는 화자 작업이에요. 언어별 공개된 구축 예산은 다음과 같아요:

| 작업 | 공개 범위 | 근거 |
|------|-----------------|-------|
| 코퍼스 큐레이션 (50–150개 항목) | $2,500–6,000 | 시간당 $50–65, 이중언어 화자 시간 |
| 방법 출력 검토 | $500–1,500 | 동일한 시간당 요율 |

전체 코퍼스는 전통적으로 화자에게 대략 80시간이 걸려요; 계획된 에이전트 지원 워크플로우(문장 초안 작성과 서식은 도구가 처리하고, 번역은 항상 사람이 담당)는 이를 30–40시간에 가깝게 줄이도록 설계되었어요 — 반복 작업의 시간은 줄이고, 시간당 요율은 동일하게 유지하면서, 화자는 진정으로 사람이 필요한 부분만 담당하게 해요.

### 지표 검증

자동화된 점수가 어떤 의미를 갖기 전에, 화자는 그것을 인간의 판단과 대조해 확인해야 해요. [Speaker Validation Protocol](/docs/network/specifications/speaker-validation)은 정확한 작업, 시간, 지급액을 공개하고 있어요:

| 작업 | 시간 | 화자당 지급액 |
|------|------|-----------------|
| A — 기계 번역 200개를 적절성과 유창성 기준으로 평가 | 약 8시간 | $400–520 CAD |
| B — "동등한" 번역 쌍 50개 검토 | 약 2시간 | $100–130 CAD |
| C — 형태소 분석기가 거부한 단어 100개 검토 | 약 1.5시간 | $75–100 CAD |

세 가지 모두를 수행하는 화자는 2주에서 4주에 걸쳐 약 11.5시간을 투자하고 **$575–750 CAD**를 받아요. 전체 3인 화자 검증 라운드는 프로젝트에 $1,475–1,920의 비용이 드는데 — 바로 이것이 핵심이에요: 화자 검증은 프로젝트에서 작은 항목이며, 결코 비용을 "절감"하는 지점이 되어서는 안 돼요.

### 상금 청구 검토

어떤 상금도 자동화된 점수만으로 지급되지 않아요. [Founder's Prize](/docs/network/specifications/prizes)($10,000 CAD, English→Plains Cree)는 최소 2명의 이중언어 화자가 최소 30개 출력의 계층화된 표본을 독립적으로 검토하고, 70% 이상이 "수용 가능" 또는 "우수"로 평가될 것을 요구해요. 그 검토는 동일한 요율에 따른 유급 화자 작업이에요 — 그리고 이는 또한 하나의 관문이기도 해요: 화자는 상금 청구를 무산시킬 수 있으며, 이는 의도된 설계예요.

## 콘테스트에 따라 확장되는 방식

이 모델은 화자 보상이 플랫폼에 의해 희석되는 대신 플랫폼과 함께 성장하도록 구축되어 있어요:

- **각 새로운 언어는 유급 코퍼스 계약으로 시작돼요.** 언어별 공개된 구축 비용($3,350–8,500 일체 포함)은 대부분 화자 보상이에요 — 의도적으로 단일 항목 중 가장 큰 구성 요소예요.
- **각 새로운 상금 풀은 자체적인 유급 검토를 수반해요.** [prize template](/docs/network/specifications/prizes#4-future-prize-pools)을 따르는 모든 후원 콘테스트는 동일한 커뮤니티 검증 요건을 지니며, 이는 모든 콘테스트가 해당 언어에 대한 화자 검토 작업에 자금을 댄다는 것을 의미해요.
- **커뮤니티가 소유한 방법은 커뮤니티가 자금을 대는 자산으로 남아요.** 이전된 방법은 거버넌스 조직에 온전히 귀속되며 — 그것을 배포해 얻는 모든 수익은 전적으로 커뮤니티의 것이고([작업 자금 조달 방식](/docs/network/sovereignty/economic-model)), 커뮤니티가 적절하다고 판단하는 대로 지속적인 검토, 코퍼스 성장, 언어 프로그램에 사용될 수 있어요. 그 배분은 우리가 아닌 커뮤니티의 결정이에요.

## 우리가 약속하지 *않은* 것

정직함을 위해 경계를 표시해야 해요:

- 위 요율은 현재 Plains Cree 작업에 대한 공개된 요율이에요. 향후 언어에 대한 요율은 파트너 커뮤니티와 함께 정하고 동일한 방식으로 공개될 거예요 — 작업이 시작되기 전에, 명세서에 말이에요.
- Champollion은 비상업적이고, 자체 수익을 창출하지 않으며, 현재 **창립자에 의해 자체 자금으로 운영되고 있어요** — 보조금과 후원 자금은 우리가 가진 것이 아니라 우리가 찾고 있는 것이에요. [작업 자금 조달 방식](/docs/network/sovereignty/economic-model)은 보장이 아니라 그 메커니즘을 설명해요.
- "공정하게 지급받음"은 필요하지만 충분하지는 않아요. 지급 그 자체가 프로젝트를 비착취적으로 만들지는 못해요 — 소유권과 통제권이 그렇게 하며, 이것이 바로 보상이 [스튜어드십 모델](/docs/network/sovereignty/data-sovereignty)을 대체하는 것이 아니라 그 안에 자리 잡고 있는 이유예요.

---

## 이것이 당신에게 의미하는 것

:::info[커뮤니티 구성원인 경우]
지원이 부족한 언어와 영어에 모두 능통하다면, 여러분의 판단은 이 시스템에서 가장 가치 있는 입력이며, 공개된 조건은 다음과 같아요: 시간당 $50~65 CAD, 유연한 일정 조율, 2주 이내 지급, 원하는 방식의 크레딧 표기, 그리고 기여를 철회할 권리예요. 프로그래밍은 필요하지 않아요. [언어 커뮤니티를 위한 안내](/docs/network/community/for-language-communities) 또는 [화자 검증 프로토콜 §7](/docs/network/specifications/speaker-validation#7-how-to-get-started)에서 시작해 보세요.
:::

:::info[연구자인 경우]
화자 보상을 일급 연구 비용으로 예산에 반영하세요 — 공개된 수치(지표 검증 라운드당 $1,475~1,920, 코퍼스 큐레이션 $2,500~6,000)는 연구비 기준으로는 적은 금액이며, 이것이 자동화된 점수를 방어할 수 있게 만드는 요소예요. [코퍼스 파트너십 전략](/docs/network/specifications/corpus-partnership)에서는 학과가 자금이 지원되는 화자 작업을 포함하여 이 체계에 어떻게 연결되는지 보여드려요.
:::

:::info[개발자인 경우]
직접 자금을 대지 않더라도 유료 화자 작업의 혜택을 누려요: 검증된 지표는 여러분의 리더보드 점수를 의미 있게 만들고, 유료 커뮤니티 검토는 여러분의 방법과 상금 사이를 가로막는 관문이에요. 만약 우승한다면, 화자들이 여러분의 결과물을 면밀히 검토하도록 보수를 받았을 것이라고 예상하세요 — 그리고 [여러분 방법의 소유권이 이전](/docs/network/sovereignty/ownership-transfer)되어 그 언어를 사용하는 커뮤니티에게 넘어갈 것이라고 예상하세요.
:::

## 함께 보기

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — 화자 권위가 다른 모든 것을 어떻게 규정하는지
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — 벤치마크 이후에도 이어지는 화자 권위
- [Benchmark Specification §10](/docs/network/specifications/benchmark#10-cost-framework) — 이 수치들이 나온 전체 비용 프레임워크
