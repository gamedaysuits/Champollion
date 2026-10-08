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
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# 벤치마크에서 일상적 사용까지: 포스트 에디팅으로 가는 길

> **요약하자면.** 리더보드 점수는 제품이 아니에요. "이 방식의 chrF++ 점수가 47.5점이다"에서 "밴드 사무국(band office)이 매주 해당 언어로 문서를 발행한다"로 이어지는 길은 정확히 단 하나의 워크플로를 거쳐요. 기계가 초안을 작성하고, 유창한 화자가 이를 교정하며, 오직 교정된 텍스트만 발행되는 것이죠. 저희 사양에 있는 모든 품질 기준선은 바로 이 워크플로에 맞춰 조정되어 있어요. 저희 플랫폼의 어떤 언어에 대해서도 지지하지 않는, 감독 없는 기계 번역 결과물에 맞춘 것이 아니에요.

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

## 리더보드 점수가 알려줄 수 있는 것과 없는 것

리더보드는 기계 번역(MT) 분야의 방식대로 방법론들의 순위를 매겨요. 95% 신뢰 구간과 sacreBLEU 서명이 포함된 말뭉치 수준의 **chrF++**(0–100)를 기준으로 하며, BLEU, spBLEU, TER, COMET을 함께 표기하고 FST 수락률과 같은 진단 지표는 별도로 보고해요([점수 산정 사양](/docs/network/specifications/scoring#how-runs-are-scored)). 동일한 평가 세트에서 한 방법이 다른 방법보다 나은지 여부는 단순히 두 숫자를 눈대중으로 비교하는 것이 아니라 대응 표본 유의성 검정(paired significance test)을 통해 결정돼요([유의성 검정](/docs/network/specifications/significance)).

이것이 커뮤니티에 알려줄 수 있는 점은 어떤 방식이 신뢰할 수 있는 참조 번역에 더 가까운 결과물을 생성하는지, 그리고 두 방식 간의 격차가 유의미한지 여부예요. 반면 알려줄 수 없는 점은 그 초안이 화자의 시간을 들일 만한 가치가 있는지 여부예요. 언어와 평가 세트에 따라 동일한 chrF++ 수치라도 의미하는 바가 다르기 때문에, 이곳의 어떤 자동 점수도 품질 라벨을 직접 부여하지 않아요. 과거에 네트워크는 가중 복합 점수를 이름이 붙은 등급("기능적(functional)", "배포 가능(deployable)", …)에 매핑하곤 했지만, 모든 입력에 대해 유효한 문장 하나만을 반복하는 시스템조차 "기능적"으로 분류되는 문제가 있어 해당 라벨들은 폐기되었어요([복합 점수가 폐기된 이유](/docs/network/specifications/scoring#why-the-composite-was-retired)).

[벤치마크 사양 §7](/docs/network/specifications/benchmark#7-human-validation)에 따라 구조적 정직성을 위한 두 가지 규칙이 도출돼요:

- **점수는 인간 검토를 위한 후보 추천일 뿐, 판결이 아니에요.** 높은 chrF++ 점수는 해당 방식을 화자들과 함께 파일럿으로 시험해 볼 가치가 있다는 뜻이지, 배포 준비가 끝났다는 뜻이 아니에요.
- **오직 커뮤니티 검토만이 해당 방식이 사후 편집(post-editing) 워크플로에 준비되었는지를 결정해요.** 결과물의 층화 표본이 이중언어 구사자들에게 전달되며, 화자들은 각 번역을 *거부(reject) / 요지 파악(gist) / 수용 가능(acceptable) / 우수(excellent)* 로 평가해요. 해당 방식의 다음 단계 진입 여부를 결정하는 것은 리더보드가 아니라 거버넌스 조직이에요.

비교를 위해 살펴보자면, [Founder's Prize](/docs/network/specifications/prizes) 조건(chrF++ 하한선, 관문 조건으로서 99% 이상의 형태학적으로 유효한 단어, 화자 평가에서 70% 이상의 '수용 가능' 이상 비율)은 남아 있는 실수가 지어낸 단어가 아니라 잘못된 굴절과 같은 *실제 언어적 오류* 수준인 방식을 설명해요. 이것이 바로 "화자의 시간을 들일 만한 가치가 있는 초안"을 숫자로 나타낸 모습이며, 화자들의 평가가 이를 최종적으로 판정하는 조건이에요.

## 우승한 방법에서 작동하는 사무소까지

어떤 방법이 그 관문들을 통과한다고 가정해 봐요. 남은 단계는 조직적이며, 즉흥적으로 하는 것이 아니라 사양으로 정해져 있어요:

1. **소유권이 이전돼요.** 그 방법의 코드는 커뮤니티의 거버넌스 조직의 재산이 되고 — 개발자는 귀속 표시와 발표 권리를 유지해요 ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **방법은 서비스가 돼요 — 커뮤니티의 서비스로요.** 거버넌스 조직이 자체 인프라에서 실행할 수 있는 플러그인으로 패키징되어, 접근과 허용된 용도를 통제해요 ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). 커뮤니티가 이를 상업적으로 제공하기로 선택한다면, 그것은 모든 의미에서 그들의 사업이에요 — Champollion은 어떤 몫도 가져가지 않아요 ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **번역가들이 이를 하루 일과에 연결해요.** 번역 사무소는 기존 문서 워크플로를 그 방법의 API에 연결해요: 원문을 넣고, 초안을 받고, 포스트 에디팅하고, 발행해요. 발행된 텍스트는 번역가의 이름과 권위를 담고 있으며 — 기계는 사전처럼 그들의 책상 위에 놓인 도구예요.

## 오늘 이것이 서 있는 자리

솔직히 말씀드리면, 전체 경로는 엔드투엔드로 명세화되었지만 부분적으로만 구축되어 있어요. 평가 하네스, 지표, 실행 카드(run card), 공개 리더보드는 존재해요. 평가 샌드박스는 구축되었지만 토이(toy) 방법으로만 시험해 본 상태예요. 업스트림에는 플레인스 크리어(Plains Cree) 개발 말뭉치가 존재해요. 상금은 제안되었지만 아직 열려 있는 것은 없어요. 배포 플랫폼은 존재해요. 커뮤니티 검토 인터페이스와 교정 텍스트 피드백 루프는 사양에는 명시되어 있지만 아직 운영되지 않고 있어요. 사양에 계획 중(planned)으로 표시되어 있고, 저희도 그렇게 밝히고 있어요. 벤치마크부터 일상적인 커뮤니티 사용에 이르는 전 과정을 완료한 방식은 아직 없어요. 그 여정 자체가 이 프로젝트가 정의하는 성공이기에, 저희는 결코 이를 섣부르게 성공했다고 주장하지 않아요.

---

## 이것이 당신에게 의미하는 것

:::info[커뮤니티 구성원이신가요?]
높은 리더보드 점수가 기계가 감독 없이 커뮤니티의 언어로 글을 게시한다는 것을 의미하지는 않아요. 이는 초안 생성기가 번역사들을 대상으로 *오디션*을 볼 준비가 되었음을 의미할 뿐이에요. 커뮤니티의 조건에 따라, 커뮤니티의 화자들이 심사위원(유급 심사위원 — [화자에게 보상이 지급되는 방식](/docs/network/perspectives/how-speakers-get-paid) 참조)이 되어 심사하게 돼요. 커뮤니티에서 번역 사무소를 운영하고 있다면, 저희에게 문의하실 적절한 질문은 다음과 같아요: "파일럿은 어떤 모습으로 진행되며, 결과물은 누가 검토하나요?"
:::

:::info[연구자이신가요?]
사후 편집(post-editing)이라는 프레이밍은 측정할 가치가 있는 대상을 바꾸어 놓아요. 단순한 chrF++뿐만 아니라, 화자가 참여하는 루프(speaker in the loop) 내에서 수용 가능한 텍스트가 완성되기까지 걸리는 시간(time-to-acceptable-text)을 측정하는 것이죠. 네트워크의 지표들은 이를 대신하는 대리지표(proxy)이며([점수 산정 사양 §1](/docs/network/specifications/scoring)), 형태론적으로 복잡한 언어에 대한 언어별 사후 편집 연구는 이 인프라가 지원하도록 설계된 미개척 연구 영역(open research gap)이에요.
:::

:::info[빌더라면]
지표가 아니라 편집자를 위해 최적화하세요. 실제 단어를 생성하되 가끔 잘못된 굴절을 만드는 방법은 화자가 몇 초 만에 고칠 수 있지만, 그럴듯해 보이는 형태를 환각으로 만들어내는 방법은 전체 워크플로를 망칩니다. 이것이 바로 여기서 형태론적 타당성을 그토록 엄격하게 통제하는 이유예요. [방법 제출하기](/docs/network/getting-started/submit-a-method)에서 시작하고, 우승할 경우 결국 무엇을 넘겨주게 될지 알아보려면 [Method Interface](/docs/network/specifications/methods)를 읽어 보세요.
:::

## 함께 보기

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — 왜 인간 관문이 한계가 아니라 핵심인지
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — 발행된 텍스트가 그럼에도 틀렸을 때 무슨 일이 일어나는지
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — 인간 검증 관문, 공식적으로
