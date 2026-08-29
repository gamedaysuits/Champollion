---
sidebar_position: 3
title: "벤치마크에서 일상 사용까지: 포스트에디팅의 여정"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "벤치마크로 검증된 번역 방법이 어떻게 커뮤니티 번역 워크플로가 되는지 살펴봐요. 기계 초안, 유창한 화자의 포스트에디팅, 최종 출판 텍스트에 이르기까지 각 단계마다 정직한 품질 기준을 적용합니다."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# 벤치마크에서 일상적 사용까지: 포스트 에디팅으로 가는 길

> **요약.** 리더보드 점수는 제품이 아니에요. "이 방법은 0.78점을 기록했다"에서 "밴드 사무소가 매주 그 언어로 문서를 발행한다"까지 가는 길은 정확히 하나의 워크플로를 거쳐요. 기계가 초안을 만들고, 유창한 화자가 이를 수정하며, 수정된 텍스트만 발행되는 거죠. 우리 사양의 모든 품질 기준은 그 워크플로에 맞춰 보정되어 있어요 — 감독 없는 기계 출력이 아니라요. 우리는 이 플랫폼의 어떤 언어에 대해서도 감독 없는 기계 출력을 지지하지 않아요.

사람들은 때때로 번역 방법이 언제 "그냥 쓸 만큼 충분히 좋아지는지" 묻곤 해요. 이 Network가 지원하는 언어들에 대해서는, 그 질문에 함정이 있어요. 정직한 답은, 목표로 삼을 만한 기준이 "검토 없이 발행할 만큼 충분히 좋음"이 아니라 **"초안을 검토하는 것이 처음부터 번역하는 것보다 나을 만큼 충분히 좋음"** 이라는 거예요. 그 기준은 훨씬 낮고, 측정 가능하며, 그 기준을 넘어서면 커뮤니티 번역 사무소가 일주일에 만들어낼 수 있는 것이 달라져요.

---

## 워크플로, 처음부터 끝까지

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

주목할 세 가지:

1. **기계는 결코 발행하지 않아요.** 출력의 단위는 초안이에요. 화자의 수정 과정은 마지막에 덧붙인 품질 보증이 아니라 — 워크플로 그 자체예요.
2. **화자의 시간이 최적화되는 자원이에요.** 한 방법이 다른 방법보다 나은 것은 정확히 화자가 고칠 것을 덜 남기는 만큼이에요. 자원이 풍부한 언어에 대한 포스트 에디팅 연구는 중간 정도의 MT 품질에서 처음부터 번역하는 것보다 지속적으로 더 빠르다는 것을 발견해요 (Plitt & Masselot 2010; Green, Heer & Manning 2013, 둘 다 [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)에 링크와 함께 인용되어 있어요). 그것이 다합성어에도 적용되는지는 바로 벤치마크가 밝혀내려는 것이에요 — 우리는 이것을 가정이 아니라 언어별로 검증할 가설로 다뤄요.
3. **피드백 루프는 소유되어 있어요.** 수정된 모든 문서는 잠재적 학습 및 코칭 데이터이며 — 커뮤니티에 속해요. [데이터 주권](/docs/network/sovereignty/data-sovereignty) 규칙에 따라 그들의 조건 하에 피드백으로 되돌리거나 (되돌리지 않을 수도) 있어요. 피드백 메커니즘은 플랫폼의 설계 목표이지 아직 구축된 기능은 아니에요. 수정과 출처가 어떻게 작동하도록 되어 있는지는 [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections)를 참고하세요.

## 품질 등급이 실제 사용에 의미하는 것

리더보드는 자동화된 지표의 종합으로 방법에 점수를 매기며 ([Scoring Specification](/docs/network/specifications/scoring)), 그 점수는 명명된 등급에 매핑돼요. 다음은 그 등급들을 일상적 사용의 관점으로 정직하게 옮긴 거예요:

| 등급 (종합) | 포스트 에디팅 경로에 의미하는 것 |
|---|---|
| **Baseline** (0.00–0.30) | 어떤 용도로도 사용 불가능해요. 출력이 대체로 대상 언어가 아니에요. 연구의 최저 기준으로만 유용해요. |
| **Emerging** (0.30–0.50) | 여전히 초안 작성 도구가 아니에요. 올바른 조각들이 나타나지만, 화자는 새로 쓰는 것보다 고치는 데 더 많은 시간을 쓸 거예요. |
| **Functional** (0.50–0.70) | 쉬운 텍스트에 대해 포스트 에디팅이 처음부터 번역하는 것보다 *나을 수도* 있는 첫 등급이에요 — 화자와 함께 파일럿을 해볼 만하지만, 의존할 만하지는 않아요. 빈번한 형태론적 오류가 남아 있어요. |
| **Deployable** (0.70–0.85) | 위 워크플로의 목표 등급이에요: 대부분의 형태론이 올바르고 유창한 화자가 다시 번역하는 것보다 의미 있게 더 빠르게 수정할 수 있는 초안이에요. **"Deployable"은 *포스트 에디팅 워크플로에* 배포 가능하다는 뜻이지 — 결코 "검토 없이 발행"을 의미하지 않아요.** |
| **Fluent** (0.85–1.00) | 유능한 인간 번역에 근접해요; 오류가 드물고 경미해요. 검토 과정은 유지되며 — 다만 더 빨라질 뿐이에요. |

이 표 위에는 두 가지 구조적 정직성 규칙이 놓여 있으며, [Benchmark Specification §5 및 §7](/docs/network/specifications/benchmark#5-quality-tiers)에서 바로 가져온 거예요:

- **자동화된 등급은 판결이 아니라 잠정적 라벨이에요.** 이는 인간 검토를 위한 후보 지명이에요. 임계값은 화자 검증 데이터가 쌓이면서 재보정될 것이며, 언어마다 다르게 나타날 수 있어요.
- **어떤 방법도 커뮤니티 검토 없이는 Deployable 이상을 주장할 수 없어요.** 출력의 계층화된 표본이 이중 언어 화자에게 전달되고, 그들은 각 번역을 *reject / gist / acceptable / excellent* 로 평가해요. 그 방법이 진전할지는 리더보드가 아니라 — 거버넌스 조직이 결정해요.

비교하자면, [Founder's Prize](/docs/network/specifications/prizes) 임계값(종합 ≥ 0.80, 형태론적으로 유효한 단어 ≥99%, 화자 평가 acceptable 이상 ≥70%)은 남은 실수가 *실제 언어의 오류*인 방법을 나타내요 — 즉 조작된 단어가 아니라 잘못된 굴절이죠. 그것이 "화자의 시간을 들일 가치가 있는 초안"을 숫자로 나타낸 모습이에요.

## 우승한 방법에서 작동하는 사무소까지

어떤 방법이 그 관문들을 통과한다고 가정해 봐요. 남은 단계는 조직적이며, 즉흥적으로 하는 것이 아니라 사양으로 정해져 있어요:

1. **소유권이 이전돼요.** 그 방법의 코드는 커뮤니티의 거버넌스 조직의 재산이 되고 — 개발자는 귀속 표시와 발표 권리를 유지해요 ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **방법은 서비스가 돼요 — 커뮤니티의 서비스로요.** 거버넌스 조직이 자체 인프라에서 실행할 수 있는 플러그인으로 패키징되어, 접근과 허용된 용도를 통제해요 ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). 커뮤니티가 이를 상업적으로 제공하기로 선택한다면, 그것은 모든 의미에서 그들의 사업이에요 — Champollion은 어떤 몫도 가져가지 않아요 ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **번역가들이 이를 하루 일과에 연결해요.** 번역 사무소는 기존 문서 워크플로를 그 방법의 API에 연결해요: 원문을 넣고, 초안을 받고, 포스트 에디팅하고, 발행해요. 발행된 텍스트는 번역가의 이름과 권위를 담고 있으며 — 기계는 사전처럼 그들의 책상 위에 놓인 도구예요.

## 오늘 이것이 서 있는 자리

명확히 말하자면: 전체 경로는 처음부터 끝까지 사양으로 정해져 있고, 부분적으로 구축되어 있어요. 평가 하니스, 지표, 실행 카드, 공개 리더보드는 존재하고요; Plains Cree 개발 코퍼스와 활성 프라이즈도 존재하며; 배포 플랫폼도 존재해요. 커뮤니티 검토 인터페이스, 평가 샌드박스, 수정된 텍스트 피드백 루프는 사양으로 정해져 있지만 아직 운영되지 않아요 — 사양은 이를 계획된 것으로 표시하고, 우리도 그렇게 해요. 아직 어떤 방법도 벤치마크에서 일상적 커뮤니티 사용까지의 전체 여정을 완주하지 않았어요. 그 여정이 이 프로젝트가 정의하는 성공이며, 바로 그래서 우리는 이를 성급하게 주장하지 않을 거예요.

---

## 이것이 당신에게 의미하는 것

:::info[커뮤니티 구성원이라면]
리더보드의 "Deployable" 배지는 기계가 감독 없이 여러분의 언어로 게시한다는 의미가 절대 아닙니다. 이는 초안 생성기가 여러분의 조건에 따라, 여러분의 화자를 심사자로 하여 번역가 앞에서 *오디션*을 볼 준비가 되었을 수 있다는 뜻이에요(심사자는 보수를 받습니다 — [화자가 보수를 받는 방법](/docs/network/perspectives/how-speakers-get-paid) 참고). 여러분의 커뮤니티가 번역 사무소를 운영한다면, 저희에게 물어볼 만한 관련 질문은 이것입니다. "파일럿은 어떤 모습일까요, 그리고 누가 결과물을 검토하나요?"
:::

:::info[연구자라면]
포스트 에디팅 관점은 무엇을 측정할 가치가 있는지를 바꿉니다. 단순한 종합 점수가 아니라, 화자가 참여한 상태에서 수용 가능한 텍스트에 도달하기까지의 시간이 중요해요. Network의 지표는 그것을 대신하는 프록시이며([Scoring Specification §1](/docs/network/specifications/scoring)), 형태론적으로 복잡한 언어에 대한 언어별 포스트 에디팅 연구는 이 인프라가 지원하도록 설계된 미해결 연구 과제입니다.
:::

:::info[빌더라면]
지표가 아니라 편집자를 위해 최적화하세요. 실제 단어를 생성하되 가끔 잘못된 굴절을 만드는 방법은 화자가 몇 초 만에 고칠 수 있지만, 그럴듯해 보이는 형태를 환각으로 만들어내는 방법은 전체 워크플로를 망칩니다. 이것이 바로 여기서 형태론적 타당성을 그토록 엄격하게 통제하는 이유예요. [방법 제출하기](/docs/network/getting-started/submit-a-method)에서 시작하고, 우승할 경우 결국 무엇을 넘겨주게 될지 알아보려면 [Method Interface](/docs/network/specifications/methods)를 읽어 보세요.
:::

## 함께 보기

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — 왜 인간 관문이 한계가 아니라 핵심인지
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — 발행된 텍스트가 그럼에도 틀렸을 때 무슨 일이 일어나는지
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — 인간 검증 관문, 공식적으로
