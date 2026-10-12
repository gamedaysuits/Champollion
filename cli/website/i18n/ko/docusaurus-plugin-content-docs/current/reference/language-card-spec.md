---
sidebar_position: 4
title: "언어 카드 명세"
description: "Champollion의 언어별 구성 카드를 위한 표준 스키마예요."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# 언어 카드 사양

> **단일 진실 공급원(Single source of truth).** 이 문서는 모든 언어 카드의 표준 형태를 정의해요.
> 카드는 인용된 출처가 명시한 내용만을 기술해요. 어떤 출처도 언급하지 않은
> 필드는 **null이 아니라 생략돼요** — 누락된 필드는 "알려진 것이 없다"는 뜻이 아니라
> "어떤 출처도 언급하지 않았다"는 것을 의미해요. 기계 검증이 가능한 스키마는 npm
> 패키지에 `shared/schemas/language-card.schema.json`로 포함되어 제공되며,
> [아래의 표준 예시](#canonical-template)는 사이트 빌드 시마다 라이브 말뭉치에서
> 생성되므로, 이 페이지가 설명하는 카드와 내용이 달라질 수 없어요.

## 2026-08 지도(atlas) 리빌드 — 이 스키마에서 변경된 점

카드 말뭉치는 이제 **빌드 결과물(build output)**이에요. 모든 카드는 고정된(pinned)
업스트림 스냅샷 저장소로부터 투영되며, 사실 정보가 변경되면 직접 편집되지
않고 항상 다시 빌드돼요. 이번 리빌드를 통해 카드 형태에서 네 가지가 변경되었어요:

1. **이견이 있는 필드는 출처 표기 엔벨로프(attribution envelope)를 포함해요.** 인용된
   출처 간에 실질적인 이견이 있는 경우, 필드는 단순 단일 값이 아니라
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment`, 그리고 새로운 출처로 인해 이견이 발생하는
   모든 필드에 적용돼요. 소비자는 단순 단일 값을 가정하기보다는 공개된 어댑터(npm 패키지의
   `normalizeCard()`)를 통해 카드를 읽어야 해요. `display()`는 엔벨로프를
   합의된 값으로 해석하며, 진정한 이견이 발생했을 때 임의로 승자를 선택하는 대신
   의도적으로 아무것도 반환하지 않아요.

2. **이름이 바뀐 필드들.** `endonym`가 `nativeName`를 대체함 · `codeAliases`가
   `aliases`를 대체함 · `scripts[]`(확인된 모든 문자 체계)가 단일
   `script`를 대체했으며 기본 문자는 카드의 최대 BCP 47 태그에서 파생됨 · `endangerment`(각
   출처 자체 척도에 따른 모든 출처의 평가)가 단일 `vitality` 객체를 대체함 · `isoLanguageType`와
   `isoScope`는 이제 이니셜 대신 ISO 639-3 자체 단어("Living", "Macrolanguage")를
   사용함. 새로운 필드: `modality`("spoken"/"signed", Glottolog 계통에서
   파생), `glottologBucket`(Glottolog의 비계통적 분류 버킷, 어족 슬롯과
   분리됨), `locale`/`localeScoped`.

3. **주장되지 않은 필드는 null이 아니라 생략돼요.** 어떤 출처도 언급하지 않은 필드는
   카드에서 빠져 있어요. 이전 규칙("모든 카드는 null이더라도 모든 최상위 필드를
   반드시 포함해야 함")은 폐기되었어요. 공개된 인터페이스에서 빈 값은 알려진 것이 전혀 없다는
   주장으로 읽히는데, 이는 아직 살펴보지 않았다는 것과 완전히 다르기 때문이에요.

4. **로캘 카드가 존재해요.** 언어 카드와 함께 로캘 프로젝션(`fra-CA`,
   `cmn-Hant`)은 특정 지역이나 문자에 맞춰 해결된 해당 언어의 사실 정보를 담고
   있으며, `locale: {language, region, script}` 블록으로 식별돼요. 로캘은 언어가 아니에요.
   이 블록을 확인하여 언어 수 집계에서 로캘을 제외하세요.

## 설계 원칙

1. **모든 것에 출처를 밝혀요.** 모든 사실적 주장은 이름과 버전이 명시된 1차 출처로
   거슬러 올라가요. 출처가 없는 주장은 검증할 수 없는 주장이에요. `_fieldSources`
   맵(및 하위 객체의 필드별 `source` 어노테이션)을 통해 출처를 명확히 밝혀요.

2. **이견을 보존해요.** 권위 있는 출처 간에 이견이 있는 경우(한 출처는 화자 수를
   50,000명이라 하고, 다른 출처는 20,000명이라 하는 경우), 카드는 출처 표기와 함께
   *양쪽 모두*를 위와 같은 엔벨로프 형태로 저장해요. 우리는 평균을 내거나, 임의로 해결하거나,
   한쪽 편을 들지 않아요. 사용자가 직접 뉘앙스를 파악할 수 있어요.

3. **부재는 주장되지 않았음을 의미해요.** 필드가 누락되었다는 것은 어떤 출처도 그 값을
   언급하지 않았음을 뜻해요. 어떤 속성이 실제로 적용되지 않는 경우(예: 문법적 성이
   없는 언어의 성별 구분), 빈칸으로 두는 대신 인용된 값에 이를 명시적으로 나타내요.

4. **패치하지 않고 항상 다시 빌드해요.** 카드는 결정론적(deterministic) 빌드를 통해
   고정된 출처로부터 투영돼요. 사실 정보의 오류는 해당 소스 핸들러에서 수정되고 말뭉치가
   다시 빌드돼요. 직접적인 내부 수정이나 병합 전용 보강 레이어는 없어요.

---

## 3계층 아키텍처

| 계층 | 위치 | 목적 |
|-------|----------|---------|
| **언어 카드** | `shared/language-cards/<code>.json` | 언어별 구성: 정체성, 분류, 리소스 등 모든 것 |
| **속(genus) 카드** | `shared/language-cards/genera/<genus>.json` | 관련 언어들을 위한 공유 런타임 속성 (자동 생성이 아닌 큐레이션됨) |
| **언어 트리** | `shared/language-cards/language-tree.json` | 전체 Glottolog 계층 구조 — Lab UI 및 언어 탐색을 위한 참조 데이터 |

---

## 상속 모델

> **지도 리빌드 이후 거의 역사적인 내용이에요.** 디스크 상의 어떤 언어 카드도
> 더 이상 `extends`를 포함하지 않아요. 상속된 설명문은 인용할 수 없었기 때문에(어족
> 단위의 주장이 언어 단위 주소로 표시됨) 모든 카드는 빌드 과정에서 완전히 구체화(materialize)돼요.
> 메커니즘 자체는 한 곳에서 유지되고 있어요. 바로 npm 패키지의 오프라인 번들이 로캘 카드를
> 해당 언어에 대한 간결한 `extends` 델타로 제공하며, 여기서 설명된 것과 동일한
> 병합 방식으로 해결돼요.

카드가 `"extends": "family-dravidian"`을 설정하면, 런타임은 부모
카드를 자식에 `_deepMerge()`(`lib/registers.js`에서)을 사용해 병합해요. 이를 통해
속 카드는 공유 레지스터, 격식 체계, 성별 안내를 정의할 수 있고,
이것이 모든 소속 언어로 흐르게 돼요 — 수백 개의
개별 카드에 데이터를 중복하지 않고요.

### 병합 시맨틱

| 자식 값 | 동작 | 이유 |
|-------------|----------|-----|
| `null` | 부모로부터 상속 | `null`은 "나는 이것을 정의하지 않는다"를 의미 — 부모의 값이 흘러 들어옴 |
| Non-null | 부모를 재정의 | 자식의 데이터가 더 구체적임 — 우선함 |
| 중첩 객체 | 재귀적 병합 | 자식 필드가 재정의하고, 부모 필드는 보존됨 |
| 배열 | 전체 교체 | 배열은 항목별로 병합되지 않음 — 자식 배열이 이김 |

### 정체성 필드 (절대 상속되지 않음)

일부 필드는 카드 자체에 속하며 부모로부터 절대 상속되어서는 안 돼요:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

부모 카드가 `aliases: ["macro-code"]`를 정의하더라도, 자식 카드는 그러한 별칭을
상속하지 않아요. 이 필드들은 항상 자식 자신의 값이에요 (설정되지 않은 경우
`null` 포함).

**이유:** 이 규칙이 없으면, 모든 Cree 언어가 매크로언어 부모로부터
`aliases: ["cre"]`를 상속하게 되어, 모든 변종이 매크로의 별칭이 돼요.

### 예시: Cree 카드가 해석되는 방식

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

런타임에서 `getLanguageCard("crk")`은 genus-cree의
레지스터 + family-algic의 속성(있는 경우) + crk 자신의 정체성 및 메타데이터를 병합한 객체를 반환해요.

### 속 카드 템플릿

속 카드는 `shared/language-cards/genera/`에 있으며 언어 그룹의 공유 속성을
정의해요. 일반 카드와 동일한 스키마를 따르지만
다른 관례를 따라요:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**핵심 규칙:** 속 카드는 그룹 전체에 걸쳐 진정으로 공유되고
권위 있는 참조로부터 출처가 확인된 데이터만 포함해야 해요. 격식 체계가
소속 언어들 간에 다르다면, 그것은 속이 아닌 개별 카드에 속해요.

## 표준 예시 \{#canonical-template}

> **직접 작성하지 않고 생성되었어요.** 이 섹션의 모든 내용은 빌드 시점에
> 라이브 말뭉치로부터 파생된 것이에요. 완전한 `crk`(플레인스 크리어) 카드 전체(바이트 단위까지 정확함)와
> `fra-CA` 로캘 발췌본이 포함되어 있어요. 말뭉치가 다시 빌드되면 다음 사이트
> 빌드 시 이 페이지가 다시 생성돼요. 시대에 뒤처질 수 있는 수동 유지 관리 템플릿은 더 이상 남아 있지
> 않아요. 이전 템플릿은 실제 카드와 전체 스키마 세대만큼 차이가 벌어져
> 2026년 8월 16일에 폐기되었어요.

이 예시는 **디스크에 저장된 형태(on-disk shape)**, 즉 파일을 열었을 때 확인되는 형태를 보여줘요.
소비자는 여전히 공개된 어댑터(npm 패키지의 `normalizeCard()`)를 통해 카드를 읽어야 해요.
어댑터는 엔벨로프를 해결하고, 전환 전 이름을 연결하며, 원시(raw) 카드가 의도적으로 담지 않는
표시 전용 값(기본 문자, 활력 등급)을 도출해 줘요.

읽으면서 주목할 점:

1. **출처 표기 엔벨로프.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`,
   `politenessDistinction`는 각각 `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   형태를 가지며 `"agreement": "incommensurable"`를 포함해요. 출처마다 서로 다른
   척도로 평가하므로, 임의의 승자 기준 척도로 변환하는 대신 각 값마다 고유한 `scale`를
   명시해요.

2. **생략은 주장되지 않았음을 의미해요.** 이 카드에는 `iso639_1`(플레인스 크리어에는
   ISO 639-1 코드가 없음)와 `phonologicalInventory`(수집된 출처 중 이를 주장하는 곳이 없음)가
   없어요. 이러한 필드는 단순히 존재하지 않을 뿐이며, 절대 `null`나 `[]`가 아니에요.

3. **출처 정보(Provenance)는 일급 계층이에요.** `_fieldSources`는 모든 필드를
   이를 주장한 출처에 매핑하며, Champollion이 계산한 값에는 `champollion-derived-v1`가
   표시돼요. `_card`는 카드의 타입, ID, 리비전, 그리고 수정 레인이 건드릴 수
   있는 필드를 명시해요. `_atlas`는 말뭉치 릴리스를 명시해요.

4. **실행 결과(run results)가 없어요.** 카드의 어떤 내용도 방법론 결과의 측정된
   점수가 아니에요. chrF, FST 수용률 및 유사 지표는 (방법, 데이터셋, 지표)로
   인덱싱되는 실행 결과이며 리더보드에 기록돼요. 카드는 리소스가 *존재한다*는 사실만을
   명시해요(`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### 로캘 카드는 언어가 아닌 프로젝션이에요 \{#locale-card-example}

언어 카드 옆에는 로캘 카드(`fra-CA`, `cmn-Hant`)가 있어요. 이는 코드 형태가 아니라
`locale` 블록으로 식별되며, **특정 지역이나 문자에 맞춰 해결된** 언어의 사실 정보예요.
로캘 카드는 해당 언어의 사실 정보를 상속받아 문자와 지역 범위에 국한된 정보(`script`,
`localeScoped`)를 해결하며, **언어가 아니에요**. 해당 `locale` 블록을 확인하여
모든 언어 수 집계 및 언어별 목록에서 로캘 카드를 제외하세요.

<CardSpecExample variant="locale" />

---

## 필드 레퍼런스 \{#field-reference}

아래의 모든 표에는 두 가지 규칙이 적용돼요:

- **"envelope"**는 *모든* 출처의 주장을 담고 있는 출처 표기 엔벨로프(`{agreement, consensus?,
  values: [{value, source, note?, scale?}]}`)를 의미해요. `envelope`로 나열된
  필드는 단 하나의 출처만 언급된 카드에서는 단순 단일 값으로 나타날 수 있어요(예: Glottolog 전용
  랭구오이드는 단순 단일 `name`를 가짐). 이용자는 두 가지 경우를 모두 처리해야 하며,
  공개된 어댑터가 이를 처리해 줘요.
- `code` 및 `name` 외에는 필수 필드가 없으며, 그 외 모든 것은
  **출처에서 주장하지 않는 경우 생략돼요**. 각 필드를 주장하는 출처는
  카드별로 `_fieldSources`에 기록되므로, 표에는 시간이 지나면 변경될 수 있는 특정 버전을
  고정하기보다 출처의 *종류*를 설명해요.

### § 1. 정체성 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `code` | `string` | **필수.** 카드 ID 및 파일 이름. 언어 카드의 경우 ISO 639-3(`crk`), Glottolog 전용 랭구오이드는 글롯토코드, 로캘 카드는 로캘 코드(`fra-CA`). |
| `name` | envelope | **필수.** 영어 참조 명칭 (ISO 639-3 레지스트리, LinguaMeta, Glottolog). |
| `endonym` | envelope | `nativeName` 대체. 화자가 해당 언어로 자신의 언어를 부르는 명칭 (LinguaMeta, Wikidata). 어떤 출처도 언급하지 않은 경우 누락됨 — 엔도님은 절대 임의로 만들어내거나 음역하지 않음. |
| `alternateNames` | `string[]` | 확인된 기타 영어 명칭. |
| `iso639_1` | `string` | 2자리 ISO 639-1 코드가 존재하는 경우에만 표시됨 (`fra` → `"fr"`). |
| `isoScope` | `string` | ISO 639-3의 자체 단어 — `"Individual"`, `"Macrolanguage"`, `"Special"` (`"I"`/`"M"`/`"S"` 이니셜 대체). |
| `isoLanguageType` | `string` | `isoType` 대체. ISO 639-3의 자체 단어 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | 이 언어가 속한 거대언어 (`crk` → `"cre"`). ISO 639-3 거대언어 매핑. |
| `macrolanguageMembers` | `string[]` | 거대언어 허브 카드에서: 개별 하위 구성원 코드 (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | 거대언어 카드에서: BCP 47 레지스트리가 이 거대언어의 태그로 통합하는 구성원 (CLDR 별칭 표 + SIL langtags, 각각 출처 명시). |
| `supersededCodes` | `string[]` | SIL이 이제 이 언어로 안내하는 폐기된 ISO 639-3 코드 — 이전 코드로 발행된 말뭉치가 계속 확인될 수 있도록 후속 언어 카드에 기록됨. |
| `codeAliases` | `string[]` | `aliases` 대체. 이 카드로 연결되는 코드 수준 식별자. |
| `bcp47` | `string` | 명시된 해당 언어의 BCP 47 태그 (LinguaMeta). |
| `bcp47Tag` | envelope | Champollion 파생: RFC 5646 태그 (가장 짧은 ISO 639 코드 우선). |
| `bcp47FullTag` | envelope | 최대 언어-문자-지역 형태 (CLDR likelySubtags + SIL langtags). 어댑터는 이 태그에서 **기본 문자**를 파생함. |
| `modality` | `string` | Glottolog 계통에서 파생된 `"spoken"` 또는 `"signed"`. 문자는 양식이 아니라 정서법 속성임 — 문자로 표기되지 않는 언어도 온전한 음성 또는 수어 언어임. |
| `locale` | `object` | **로캘 카드 전용.** `{language, region, script, publishedTag, source, note}` — 바로 그 로캘 식별 정보. 코드 형태가 아니라 반드시 이 블록으로 언어 수 집계에서 로캘 카드를 제외해야 함. |
| `localeScoped` | `object` | 로캘 카드 전용: 로캘의 지역/문자에 맞춰 해결된 값 (예: `scriptName`, `cldrOfficialStatus`). |

### § 2. 분류 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `glottocode` | `string` | Glottolog의 이 랭구오이드 식별자 (`crk` → `"plai1258"`). ISO 639-3에는 없고 Glottolog에만 기록된 랭구오이드는 글롯토코드를 카드 `code`로 사용함. |
| `classification` | `object` | 아래 분류 필드들을 담는 컨테이너. 각각 독립적으로 출처가 지정되고 독립적으로 생략됨 — 고립어이거나 Glottolog 버킷으로 분류된 언어는 이 객체의 일부만 가지는 것이 정상임. |
| `classification.family` | envelope | 각 분류 기관이 주장하는 최상위 어족. Glottolog와 WALS는 항상 일치하지 않는 별도의 분류 체계이므로 둘 다 유지하고 출처를 밝힘. 린트 규칙 R5는 엔벨로프 내부의 Glottolog 값을 Glottolog 자체 트리와 대조 확인하여 WALS와 Glottolog 간의 불일치는 허용하지만 Glottolog가 잘못 인용되는 것은 방지함. 고립어는 어족을 아예 포함하지 않음. |
| `classification.familyGlottocode` | `string` | 해당 최상위 어족의 글롯토코드 (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | WALS의 중간 분류 노드 (`crk` → `"Algonquian"`). Glottolog가 **아닌** WALS의 개념 — Glottolog는 속 수준이 없는 임의 깊이의 트리를 제공하므로, WALS가 해당 언어를 코딩한 경우에만 존재함. |
| `classification.ancestry` | `string[]` | 루트부터 나열된 조상 글롯토코드 형태의 Glottolog 계통 경로 (`["algi1248", …, "plai1264"]`). 순서 **자체**가 주장 내용임: 알파벳순 집합이 아닌 경로임. |
| `classification.glottologBucket` | `string` | Glottolog의 비계통적 버킷 — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. 버킷은 계통이 아니라 유형별로 분류하므로 어족 슬롯과 분리됨: 버킷이 있는 카드는 어족이 없으며, 이는 정직한 결과임. |
| `isIsolate` | `boolean` | Glottolog가 이 언어를 고립어로 분류하는지 여부. |

전환 전 카드에는 `genusGlottocode`도 포함되어 있었어요. 이는 그 값을
만들어낸 범주 오류와 함께 폐기되었어요. 속(genus)은 WALS의 개념이며,
이를 Glottolog 식별자로 포장하는 것은 Glottolog에 존재하지도 않는 트리 노드를
주장하는 셈이었기 때문이에요. Glottolog 계층 구조는 대신 `ancestry`로 전달돼요.

### § 3. 지리 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `macroarea` | `string` | Glottolog의 대지역 — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` 또는 `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Glottolog의 대표 좌표. 영토가 아니라 점(point)임: 언어를 지도 위에 표시할 뿐 사용 범위나 경계에 대해서는 아무것도 주장하지 않음. |
| `countries` | `string[]` | Glottolog가 해당 언어와 연계하는 국가들의 ISO 3166-1 alpha-2 코드 (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | CLDR에 기록된(LinguaMeta를 통해 전달됨), 특정 지역이 해당 언어에 부여한 공식 지위 — `"Official"`, `"Regional official"`. 로캘 카드의 경우 *해당 로캘의* 지역에 맞춰 해결된 지위가 `localeScoped.cldrOfficialStatus`에 위치함. |

전환 전의 `regions` 배열(행정 코드와 함께 제공되던 국가별 화자 수 세부 내역)과
`arealContext`(언어동조대 멤버십)는 폐기되었어요. 수집된 출처 중 이를
주장하는 곳이 없으며, 출처 없는 큐레이션은 리빌드를 거치며 유지되지 않아요.
지역 수준의 화자 수 주장은 인용 가능한 출처가 파이프라인에 추가되는 날 다시 복원될 수 있어요.
그때까지는 기재하지 않는 것이 정직한 상태예요.

### § 4. 문자 체계 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `scripts` | `string[]` | 단순 단일 `script` 대체. 확인된 **모든** ISO 15924 코드 (`crk` → `["Cans", "Latn"]`), 정렬되지 않음 — `scripts[0]`를 "유일한" 문자로 읽어서는 안 됨. 기본 문자는 어댑터가 `bcp47FullTag`의 최대 태그에서 파생함. |
| `scriptNames` | `string[]` | Champollion이 파생한 `scripts[]`의 표시 이름 (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | `dir` 대체. 출처 자체 단어 — `"left-to-right"` / `"right-to-left"` (이전에는 `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: 해당 언어의 기본 문자로 너무나 명백하여 BCP 47 태그에서 생략되는 문자 (`fra` → `"Latn"`). |
| `script` | `string` | **로캘 카드 전용**: 로캘에 맞춰 해결된 문자 (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). 언어 카드에는 단순 문자 필드가 없음. |

확인된 문자 표기가 없는 언어는 단순히 **`scripts` 필드가 없어요** —
부재는 출처에서 문자를 주장하지 않았음을 의미하며, 해당 언어가 "문자가 없는 언어"라고
단정하는 주장이 아니에요. (수어가 이러한 그룹 중 가장 커요. 일상적인 문자 생활을
위해 커뮤니티 표준으로 채택된 표기 체계가 없기 때문이에요.)

### § 5. 인구통계 및 활력 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `speakerEstimates` | envelope | 출처가 표기된 모든 출처의 추정치. 값은 정확한 수치이거나 출처 자체의 범위 문자열(`"10000-99999"`)일 수 있으며, 출처의 단서 조항은 `note`에 그대로 전달됨. `"agreement": "conflicting"`는 흔히 발생함 — 충돌을 보여주는 것 *자체*가 제품의 목적이며, 아무것도 평균을 내거나 한쪽을 고르지 않음. |
| `endangerment` | envelope | 단일 `vitality` 객체 대체. **해당 출처 자체의 척도에 따른** 모든 출처의 평가 — 각 값은 `scale` 필드를 포함하며, ELCat, Glottolog AES, LinguaMeta 어휘 체계가 서로 1:1로 대응되지 않으므로 `"agreement": "incommensurable"`가 일반적임. 어댑터는 선언된 권위 순서에 따라 단일 출처로부터 하나의 표시용 *활력 등급*을 파생하며, 이 등급은 표시 전용이고 출처가 표기된 전체 세트는 카드에 그대로 유지됨. |

Champollion 어디에서든 *표시되는* 화자 수는 인용된 `speakerEstimates` 항목 중
하나와 일치하거나 명시적인 `champollion-derived` 출처를 포함해야 해요. 이는
카드 무결성 규칙에 의해 강제돼요.

### § 5.5 문서화 및 디지털 존재 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `documentation` | `object` | `documentationDepth` 대체. 언어가 얼마나 잘 기술되어 있는지에 대한 Glottolog 자체 용어로 작성된 기록. |
| `documentation.medLevel` | `string` | Glottolog의 Most Extensive Description 수준 그대로 — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Glottolog 참고 문헌 목록에서 가장 광범위한 기술의 서지 키. |
| `documentation.firstDocumented` | `number` | Glottolog 자체의 최초 문서화 연도 열 그대로 — 전환 전 최상위 필드에서 이 위치로 이동함. 수백 개 언어에만 존재하며, 이 희소성 자체도 알아둘 가치가 있음. |
| `documentation.lastDocumented` | `number` | Glottolog의 최종 문서화 연도 열 그대로 — 약 천 개 언어에 존재함. |
| `wikipediaEdition` | `object` | `digitalPresence` 대체. `{site, url, name}` — 이 언어로 개설된 Wikipedia 판이 존재함 (`afr` → `af.wikipedia.org`). 존재 여부만 나타내며, 의도적으로 **문서 수는 제외함**: 여러 판이 대부분 봇에 의해 생성되었고, 방대한 판이라고 해서 번역가가 활용할 수 있는 의미에서 작은 판보다 "문서화가 더 잘 된" 것은 아니기 때문임. |
| `dialectCount` | `number` | Glottolog 자체 `child_dialect_count` 열 그대로 — 전체 하위 트리가 아닌 직속 하위 방언만 포함함. 이는 우리의 계산이 아닌 Glottolog의 주장임: 이전 규칙에서는 `champollion-derived`로 표시하여 수천 개의 카드가 Glottolog의 집계를 자신의 성과인 양 취급했음. |

전환 전 `digitalPresence` 블록의 나머지 부분(Common Voice 시간,
Tatoeba 문장 수)은 해당 출처들이 파이프라인에 도입될 때까지 폐기되었어요 —
Tatoeba 말뭉치 자체는 이미 알맞은 위치인 `resources.corpora` (§ 9) 하위의
병렬 말뭉치로 제공되고 있어요.

### § 6. 격식, 레지스터 및 성별 필드

투영된 말뭉치는 여기에 인용된 사실 정보인 단 하나의 필드만을 담고 있어요:

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `politenessDistinction` | envelope | 언어가 2인칭 형태에서 공손성을 문법화하는지 여부. Grambank GB415 (이진: 부재/존재) 및 WALS 45A (4단계: 구분 없음 / 이진 / 다중 / 대명사 회피) 전반에 걸쳐 출처가 명시됨. 서로 다른 척도이므로 각 값은 자체 `scale`를 명시하며 엔벨로프는 이를 불일치가 아니라 **비교 불가능**으로 보고함. |

**사용역 시스템은 설정이며, 카드 사실 정보가 아니에요.** 전환 전
말뭉치는 각각 1,800개에 가까운 카드에 `formality` 산문과 `registers` 프롬프트를
저장했어요 — 이 중 대부분은 위의 두 출처에서 생성된 후 마치 수작업으로
큐레이션된 설정인 것처럼 유지되었어요. 지도는 사실 정보를 유지하고, 설정 인터페이스 —
`formality`, `registers`, `gender`, `codeSwitching` — 는
**npm 패키지의 큐레이션된 스키마**(`language-card.schema.json`)의 일부로 남아 큐레이션된
속/어족 허브 카드에 위치하며, [상속 모델](#inheritance-model)에 설명된
사용역 시스템의 `extends` 병합을 통해 CLI에 도달해요.
이들은 투영된 지도 필드가 아니에요: 투영된 말뭉치의 어떤 카드도 이를 담고 있지 않으며
지도 빌드는 이를 절대 기록하지 않아요.
[좋은 사용역 프리셋 작성하기](#writing-good-register-presets)의 지침은
이 큐레이션된 레인에 적용돼요.

### § 7. 언어학적 프로필 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `typologicalProfile` | `object` | 수집된 유형론적 특성당 하나의 키. 각 값은 출처 자체의 코딩이며, 각 키는 출처가 이 언어를 코딩한 경우에만 존재함. 불리언은 Grambank 특성에서, 범주 문자열은 WALS 챕터에서 가져오며, 결정 레지스트리는 모든 키에 대해 정확한 업스트림 매개변수를 명시함. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — 인용된 PHOIBLE 인벤토리를 바탕으로 Champollion이 계산한 개수(PHOIBLE은 분절음당 한 행씩 발행하며 개수를 명시하지 않음). 따라서 모든 값은 `champollion-derived` 출처 정보를 가짐. **PHOIBLE이 유일한 성조 권위 출처임** (린트 R1): Grambank에는 성조 특성이 없으며 카드의 다른 어떤 것도 성조 유무를 주장할 수 없음. |
| `numeralSystem` | `object` | `{base}` — Chan의 *Numeral Systems of the World's Languages*에서 가져온 기수법 밑 원문 그대로 (`"decimal"`, `"quinary-vigesimal"`, `"body tally"` 등 거의 100가지의 구별되는 값). Chan 자체의 base 열이 비어 있는 경우(조사된 언어의 약 절반)에는 누락됨. 이전 생성기가 빈칸을 `"decimal"`로 채워 2,000개 언어의 값을 허위로 만들어냈기 때문임. |
| `pluralCategories` | `string[]` | CLDR이 이 언어에 명시한 기수 복수형 범주 — 아랍어는 `["zero", "one", "two", "few", "many", "other"]`를 구분하고 프랑스어는 3개, 중국어는 1개를 구분함. CLDR 자체 규칙 세트의 키에서 읽어오므로 우리의 도출 결과가 아닌 CLDR의 주장임. 전환 전 `rules.plurals.categories`를 대체함. i18n 파이프라인에서 메시지가 몇 개의 복수형을 제공해야 하는지 파악하는 데 필요함. |

현재 투영되는 `typologicalProfile` 키와 해당 업스트림 매개변수:

- **WALS 챕터** (범주 문자열, WALS 자체 값 레이블): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank 특성** (불리언): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

전환 전 `linguisticChallenges` 및 `contactInfluences` 블록은 투영되지
않아요 — 수집된 출처가 없는 조사 기반 산문은 § 6의 사용역 인터페이스처럼 npm
패키지의 큐레이션된 스키마에 유지돼요(아래의
[접촉 영향 유형](#contact-influence-types) 표가 해당 레인을 지원함).
`rules` 블록은 폐기되었어요: 그중 인용 가능한 내용은 여기의
`pluralCategories`와 § 4의 문자 필드로 유지돼요.

### § 8. 백과사전 필드

카드에서 폐기됨. 전환 전 `encyclopedic`(역사 및 방언 에세이,
기관 링크), `culturalAphorism`, `varieties` 블록은 카드 단위로 수동
큐레이션된 산문이었으며, 리빌드 설계에 따라 삭제돼요. `varieties`가
암시했던 구성원 관련 사실 정보는 이제 인용된 식별 필드(§ 1 `macrolanguageMembers` 및
`canonicalisedMembers`)가 되었으며, 변이형별 도구 지원 범위는 각 구성원 자체 카드가
답변해요(`methodSupport`, `resources`). 대표적인 격언은 동의와 인용이 있는
커뮤니티 기여 레인을 통해 다시 추가될 수 있지만, 출처 없는 카드 필드로는 돌아오지 않아요.

### § 9. 디지털 리소스 필드

이 섹션의 모든 내용은 **품질이 아니라 존재 여부와 지원 기능만을** 주장해요:
리소스가 공개되었는지, 누가 공개했는지만을 다루며 — 결코 리소스가 우수하거나 완전하거나
사용 가능한지, 혹은 측정된 점수가 얼마인지를 다루지 않아요. 방법론 결과의 모든 측정된 점수는
(방법, 데이터셋, 지표)로 인덱싱되는 실행 결과이며, 리더보드에 기록되고 카드에는 엄격히 금지돼요(린트 R3).

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `resources` | `object` | 컨테이너: 아래의 각 하위 필드는 독립적으로 출처가 지정된 목록이며, 어떤 출처도 언급하지 않은 경우 생략됨. |
| `resources.fsts` | `object[]` | 공개된 유한 상태 형태론 분석기: `{name, url, publisher, license, licenceEstablished, archived}`. 라이선스는 카탈로그 전반에 동일하다고 가정하지 않고 각 항목별로 제공됨 — 라이선스 경계에는 실제 사용 조건이 필요함. 다포합어의 경우 FST가 유일하게 존재하는 구조적 검사 도구인 경우가 많음. |
| `resources.corpora` | `object[]` | 이 언어를 포함하는 병렬 말뭉치: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. **쌍** 형태로 명시됨. 병렬 말뭉치는 오직 쌍을 통해서만 언어를 증명하기 때문임 — 대상 언어를 밝히지 않고 "스와힐리어를 지원함"이라고 하는 것은 아무도 묻지 않은 질문에 답하는 것과 같음. 존재 여부와 규모만 다루며 품질은 다루지 않음. |
| `resources.monolingualCorpora` | `object[]` | 단일어 말뭉치 — "말뭉치가 있음"이 비교할 수 없는 두 가지 의미를 갖지 않도록 `corpora`와 분리하여 유지함. |
| `resources.speech` | `object[]` | 공개된 음성 리소스. 존재 여부만 다룸. |
| `resources.keyboards` | `object[]` | 공개된 키보드 배열. 단순하지만 핵심적임: 표준 배열로는 입력할 수 없는 문자가 필요한 정서법의 경우, 키보드 배열의 존재 여부가 언어 입력 가능 여부를 결정함. |
| `resources.typology` | `object[]` | 이 언어를 *코딩*하는 유형론 데이터셋 및 그 범위: `{dataset, featuresCoded, datasetFeatureTotal}`. 존재 여부와 범위만 다루며 내용은 다루지 않음 — 특성이 나타내는 내용은 사람이 이를 수용하는 매개변수 맵을 작성하기 전까지 카드에 포함되지 않음(수용된 특성은 § 7의 `typologicalProfile`에 표시됨). 특성 개수는 우리의 계산이므로 `champollion-derived` 출처 정보를 가짐. |
| `lexicalResources` | `object` | 어휘 존재 사실 정보를 담는 컨테이너. |
| `lexicalResources.datasets` | `object[]` | 공개된 어휘 목록과 그 커버리지: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | 공개된 사전 — 품질이 아니라 존재 여부만 다루며, 발행자가 방향을 지정한 경우 **방향성**을 가짐: 한 방향으로 가는 사전은 반대 방향으로 가는 사전과 다른 리소스임. 항목의 형태가 일정하지 않음(CLDF 데이터셋은 항목 수를 알고 있고, 저장소는 언어 쌍과 방향을 알고 있음). 각 항목은 자체 출처를 밝히며, 라이선스와 아카이브 상태는 항목별로 전달됨. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | CLICS³를 바탕으로 Champollion이 계산한 개수: 이 언어에서 확인된 개념 수, 그리고 2개 이상의 서로 다른 개념에 매핑되는 어형의 수. `champollion-derived`. |
| `methodSupport` | `object` | 어떤 번역 방법이 이 언어를 지원하는지 — 지원 기능만 다루며 점수는 다루지 않음. 형태: `{total, byTier, named, truncated}`. 영어는 수천 개의 방법 엣지를 가지고 중간값 언어는 수십 개를 가지므로, 카드는 증거의 *형태*를 유지함 — `total` 및 신뢰도 등급(`fetched`, `partially-confirmed`, `model-card-declared`)당 `byTier` 개수 — 그리고 상한선 내에서 가장 유력한 항목만 나열함(각 `{value, variant, source, confidence}`). 레지스트리 **서비스**는 상한선에 구애받지 않고 항상 전체 이름이 명시되므로, `named`에 서비스가 없다는 것은 실제 미지원을 의미함. 모델 카드 항목이 없다는 것은 "가장 유력한 항목에 포함되지 않음"만을 의미하며, 모든 엣지는 지도 저장소에서 계속 쿼리할 수 있음. |
| `metricModelSupport` | envelope | 하네스가 로드하는 모델 식별자(`masakhane/africomet-mtl`)와 함께, 이 언어의 지원 여부를 공개한 평가 지표 모델. COMET 모델 선택과 같은 실제 동작을 구동하지만 점수가 아닌 지원 기능만을 나타냄. |

**위의 필드들로 통합된 항목:** 전환 전의 `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`), `databaseCoverage` (→
`resources.typology` 및 `lexicalResources` — 데이터베이스 항목은 이제 불리언이 아니라 범위를 가진 인용된 커버리지 사실 정보임).

**카드에서 폐기된 항목:** `omt1600`, `evalDatasets`, `pipelineReadiness`,
`metricPlugins` — 수집된 출처 중 어느 것도 이를 주장하지 않으며, 준비도 등급은 인용이 아닌 주관적 판단이기 때문이에요.

**투영되지 않고 큐레이션됨:** 평가 표준 선언 인터페이스(`evalStandard`,
`evalMetrics`, `evalPack`)는 npm 패키지의 큐레이션된 스키마에 유지돼요.
이들은 평가 하네스에 어떤 외부 심판 패키지가 언어를 채점하는지 알려줘요(출전자가 아닌 심판임 —
하네스 코어에는 언어별 채점기 코드가 포함되어 있지 않음). 하네스는 카드에 해당 정보가
있으면 이를 읽어오지만, 투영된 말뭉치의 어떤 카드도 현재 이를 포함하고 있지 않으며
지도 빌드도 이를 기록하지 않아요. 하네스의 FST 설치 프로그램이 `resources.fsts[]`
항목(`language_cards.py` 내의 `get_fst_install_info()`)에서 읽어오는
`install` 블록도 마찬가지예요. 투영된 항목은 오직 존재 사실 정보만을 담고 있어요.

### § 10. 출처 필드

| 필드 | 형태 | 참고 사항 |
|-------|-------|-------|
| `_fieldSources` | `object` | 모든 카드에 존재. 카드의 모든 필드 경로(`"classification.family"`, `"coordinates.lat"`)를 이를 주장한 정렬된 소스 ID(`["glottolog-v5.3", "wals-v2020.5"]`)에 매핑함. Champollion이 계산한 값은 `champollion-derived-v1`를 가짐. 소스 ID는 버전 관리되므로(`grambank-v1.0.3`, `iso639-3-20260715`) 모든 주장은 이를 제공한 정확한 릴리스로 거슬러 올라감. |
| `coverage` | `object` | 모든 카드에 존재하며, **어떤 출처도 주장하지 않고 프로젝터가 계산함**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — 이 언어에 대해 언급하는 구별되는 출처의 수, 채워질 수 있는 전체 카드 컴포넌트 중 값을 가진 컴포넌트의 수, 출처가 *부재*한다고 명시적으로 기록한 값의 수(확인 후 없다고 언급함 — 한 번도 살펴보지 않은 것과는 다른 사실 정보). 이를 통해 내용이 적은 카드가 방치된 것처럼 보이지 않고 내용이 적은 **이유**를 설명할 수 있음. |
| `_card` | `object` | 카드 자체의 메타데이터: `{type, id, revision, correctableFields}`. `type`는 `"language"` 또는 `"locale"`(방법 카드와 말뭉치 카드는 동일한 프로젝터를 사용함); `revision`는 콘텐츠 해시이므로 카드 콘텐츠가 조금이라도 변경되면 값이 바뀜; `correctableFields`는 값을 담고 있는 필드 경로를 나열함 — 수정 레인이 건드릴 수 있는 필드들임. |
| `_atlas` | `object` | `{version}` — 말뭉치 릴리스 스탬프 (릴리스 간에는 `"unreleased"`). 빌드 타임스탬프가 **아니라** 의도적으로 릴리스 ID를 사용함: 타임스탬프를 쓰면 동일한 고정 핀에서 생성된 두 빌드가 날짜에 따라 달라져 누구나 지도를 검증할 수 있는 속성(동일한 핀 입력 시 동일한 바이트 출력)이 깨지기 때문임. |

전환 전의 출처 블록은 전체가 폐기되었어요: `dataSources`(필드별
`_fieldSources` 맵으로 대체됨), `supportTier`(계산된 주관적 판단으로,
중립적인 `coverage` 집계로 대체됨), `_generated`(말뭉치 전체가 생성되며,
스탬프는 `_card.revision`와 `_atlas.version`임), `humanReviewed` 및
`notes`(자체 기록을 가진 레인에 속하는 큐레이션), 그리고 최상위
수준의 `firstDocumented`/`lastDocumented`(실제 출처가 이를 주장하는 § 5.5의
`documentation`로 이동됨).

---

## 언어 코드 정책

Champollion은 표준 식별자로 **ISO 639-3**을 사용해요. 다른 표준 코드는
별칭으로 등록되며 런타임에 ISO 639-3 코드로 해석돼요.

| 우선순위 | 표준 | 예시 | 필드 | 용도 |
|----------|----------|---------|-------|-----|
| 1 (표준/기본) | ISO 639-3 | `crk` | `code` | 카드 파일명, 설정 키, API 매개변수 |
| 2 (별칭) | ISO 639-1 | `iu` | `codeAliases[]` | CLI에서 지원되며, ISO 639-3으로 확인됨 |
| 3 (별칭) | BCP 47 | `fil` | `codeAliases[]` | CLI에서 지원되며, ISO 639-3으로 확인됨 |
| 참조 | Glottocode | `plai1258` | `glottocode` | 분류 전용, 런타임용 아님 |

**해결 순서:** 사용자가 코드를 제공할 때:
1. `card.code`에서 직접 일치 → 발견됨
2. `card.codeAliases[]`에서 일치 → 발견됨, 표준 카드 반환
3. `card.iso639_1`에서 일치 → 발견됨 (폴백)
4. 찾을 수 없음 → 오류

### 마이그레이션 이력: ISO 639-1 → ISO 639-3

v8 이전에는 카드 파일명이 가능한 경우 ISO 639-1 코드를 사용했어요 (`fr.json`,
`de.json`, `ja.json`). 639-3 마이그레이션에서 모든 카드는
ISO 639-3 등가물로 이름이 변경됐어요:

| 이전 | 이후 | 이유 |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3이 표준 |
| `de.json` | `deu.json` | 639-3이 표준 |
| `zh.json` | `cmn.json` | 매크로언어 → 기본 개별 언어 |
| `ar.json` | `arb.json` | 매크로언어 → 현대 표준 아랍어 |
| `ms.json` | `zsm.json` | 매크로언어 → 표준 말레이어 |

**이전 코드는 어떻게 되었나요?**
- 이전 639-1 코드는 `card.iso639_1`에 있어요
- 이전 639-1 코드는 `card.codeAliases[]`에 있어요 (`fra` → `["fr"]`)
- `resolveCode("fr")`는 런타임에 `"fra"`를 반환해요 — 이전 버전과 호환돼요
- 사용자는 설정에 `"fr"`를 그대로 쓸 수 있어요 — 투명하게 해결돼요

**아키텍처상 변경된 점:**
- `_deepMerge()`은 이제 `null` 값을 건너뛰어요 (부모로부터 상속)
- `_deepMerge()`은 이제 정체성 필드 세트를 가져요 (code, extends, aliases는 절대 상속되지 않음)
- `formality.default`은 이제 레지스터 `isDefault: true` 플래그에서 파생돼요
- 205개의 Grambank 파생 카드가 구조적 `formality.default` 수정을 받았어요
- 38개의 속/어족/매크로언어 카드가 상속 대상을 제공해요

---

## 엣지 케이스

### 수어 (Sign Languages)
수어(예: ASE — 미국 수어)는 ISO 639-3 코드를 보유한 정식 언어예요.
지리적 분포와 화자 수를 가지지만 다음과 같은 특징이 있어요:
- `modality`는 `"signed"`예요 — 해당 언어가 무엇인지를 카드가
  명확히 주장하는 내용이에요. 문자 체계의 부재는 별개의 사실 정보예요
- `scripts`는 보통 없지만(커뮤니티 표준으로 채택된 표기 체계가 없음),
  출처가 이를 주장하는 경우 `"Sgnw"`(SignWriting)가 나타나요
- `textDirection`는 없어요
- `linguisticChallenges`에서는 공간 문법, 분류사 등을 다루어야 해요

### 고대어 및 역사적 언어 (Ancient & Historical Languages)
라틴어(`lat`, isoLanguageType `"Historical"`) 및 산스크리트어(`san`)와
같은 언어는 여전히 특정 맥락(전례, 학문)에서 사용되지만 모어 화자는 없어요:
- `isoLanguageType`는 ISO 자체의 상태 단어(`"Ancient"`,
  `"Historical"`, `"Extinct"`)를 그대로 담아요 — 카드는 이를 임의로 완화하거나 덮어쓰지 않아요
- `endangerment` 및 `speakerEstimates`는 인용된 출처가 실제로 평가한
  내용을 단서 조항까지 그대로 보고해요(L2 커뮤니티 화자 수는 출처가 표시한 레이블 그대로 유지됨)
- `firstDocumented` / `lastDocumented`는 해당 언어의 시기를 특정해요

### 인공어 (Constructed Languages)
에스페란토(`epo`, isoLanguageType `"Constructed"`), 로지반(Lojban) 등:
- `classification`는 없을 수 있어요 — Glottolog는 인공어를 비계통적
  버킷으로 분류하며, 버킷은 절대 어족으로 표시되지 않아요
- `contactInfluences`는 바탕이 된 언어 자료를 반영해요 (예: 에스페란토는 로망스어군, 게르만어군, 슬라브어군에서 유래함)
- `endangerment`는 특이해요 — 화자 커뮤니티는 성장하고 있지만 고유한 모국이 없어요

### 거대언어 (Macrolanguages)
아랍어(`ara`), 중국어(`zho`), 크리어(`cre`), 케추아어(`que`)는
여러 개별 언어를 포괄하는 거대언어예요:
- `isoScope: "Macrolanguage"` — 내비게이션 허브이며, 벤치마크 대상이 될 수 없어요
- `macrolanguageMembers`는 개별 구성원 코드를 나열해요.
  `canonicalisedMembers`는 BCP 47 레지스트리가 거대언어 태그로 통합하는 구성원을
  기록해요(각 레지스트리 출처 명시)
- `methodSupport`는 *거대언어 카드*가 지원하는 바를 반영해요 (주로 표준화된 변이형)
- 개별 구성원은 자체 카드를 가지며, 허브로 연결되는 `macrolanguage`를 포함해요

### 표준화된 정서법이 없는 언어
많은 언어(특히 구전 전통 언어)는 표준화된 문자 표기 체계가 없거나,
경쟁 관계에 있는 여러 정서법을 가지고 있어요:
- `scripts`, `scriptNames`, `textDirection`가 없어요 — 어떤 출처도
  문자를 주장하지 않았으며, 이는 "문자가 없는 언어"라는 주장과는 달라요
- `notes`에서는 정서법 상황을 설명해야 해요
- `linguisticChallenges`에서는 이것이 기계 번역에 미치는 영향(예: 학습 데이터 부재)을 명시해야 해요

### 다이글로시아
아랍어(MSA 대 방언)나 과라니어(Jopará 대 순수 과라니어) 같은 언어:
- `codeSwitching`은 혼합 변종 상황을 포착해요
- `registers`은 다양한 수준에 대한 프리셋을 제공할 수 있어요
- `varieties`은 다이글로시아 쌍을 나열할 수 있어요

---

## 접촉 영향 유형

| 유형 | 의미 | 예시 |
|------|---------|---------|
| `superstrate` | 커뮤니티에 강요된 지배 언어 | French → English (1066년 이후) |
| `substrate` | 강요된 언어에 영향을 미치는 모국어 | Celtic → English |
| `adstrate` | 상호 영향이 있는 인접 언어 | Norse → English |
| `learned_borrowing` | 교육/학문을 통한 차용 | Latin → English |
| `lexical_borrowing` | 접촉을 통한 직접 어휘 차용 | Spanish → Filipino |
| `relexification` | 대규모 어휘 대체 | Portuguese → Papiamentu |

## 접촉 영향 깊이

| 깊이 | 의미 |
|-------|---------|
| `light` | 소수의 차용어, 최소한의 구조적 영향 |
| `moderate` | 특정 영역에서의 상당한 어휘 |
| `heavy` | 광범위한 어휘 및 일부 구조적 특징 |
| `structural` | 문법, 통사, 음운에 영향 |
| `defining` | 접촉으로 형성된 핵심 정체성 (크레올어, 혼합 언어) |

---

## 좋은 레지스터 프리셋 작성하기

**좋은 프리셋 프롬프트:**
- 격식 특징을 명시적으로 명명 (예: "해요체", "vous-form", "siz-form")
- 사용할 특정 대명사나 동사 형태를 설명
- 이 레지스터가 적절한 경우의 맥락 제공
- 해당하는 경우 문자 고려사항 언급

**하지 말 것:** 프리셋 프롬프트에 성별 포용적 안내를 넣지 마세요. 성별 안내는
`card.gender.inclusiveGuidance`에 속해요 — 별도로 주입돼요.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### 프리셋 명명 규칙

프리셋 키는 설명적이고 소문자-하이픈으로 연결되어야 해요:
- T-V 언어: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- 말 단계: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- 중립: `professional`, `neutral-professional`
- 코드 스위칭: `taglish-professional`, `pure-filipino`

---

## 카드 사실 정보를 업데이트하는 방법

카드는 **빌드 결과물**이에요 — 고정된 업스트림 스냅샷으로부터 결정론적으로 투영돼요.
이제 카드별 보강 절차는 존재하지 않아요: 수동으로 실행되던 `enrich-*`
스크립트 레인은 폐기되었으며, 카드 파일에 직접 수행한 수정은 다음 빌드 시 삭제돼요.
사실 정보를 변경하려면:

1. **결정을 등록해요.** 모든 필드는 빌드의 결정 레지스트리에서 한 행을 차지해요:
   어떤 업스트림 매개변수가 값을 제공하는지, 어떻게 투영되는지, 값이 없을 때
   무엇을 의미하는지가 정의돼요.
2. **수집 레이어를 수정해요.** 잘못된 값은 소스 핸들러의 결함(또는 오래된 업스트림 핀)이지,
   카드에서 직접 패치할 대상이 아니에요.
3. **다시 빌드하고 전환해요.** 빌드는 고정된 스냅샷으로부터 모든 카드를 다시 투영해요.
   게이트는 부분 빌드, null/빈 값, 무결성 규칙을 통과하지 못한 카드를 거부해요.

### 충돌 처리

출처 간에 이견이 있는 경우:
1. 출처 표기와 함께 **모두 저장해요** — 이것이 출처 표기 엔벨로프의 목적이에요
2. **평균을 내거나** 한쪽을 편들지 **마세요** — `consensus`는 출처들이 실제로
   일치할 때만 나타나요
3. 해당 값의 `note`에 **각 출처의 단서 조항을 그대로** 전달해요
4. 표시 또는 계산을 위한 단일 값은 선언된 권위 순서에 따라 **어댑터에 의해 파생돼요** —
   카드 자체는 전체 내역을 그대로 유지해요

---

## 검증

리빌드 후에는 린터를 실행하세요:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR 체크리스트

카드를 수정하는 변경 사항을 제출할 때(기억하세요: 카드가 아니라 빌드를 변경해야 해요):

- [ ] 수정 사항이 수집 핸들러나 결정 레지스트리에 반영되어 있는지 확인해요 — 어떤 카드 파일도 직접 편집하지 않아요
- [ ] 필드에는 출처가 주장한 값만 포함되어 있는지 확인해요 — 카드를 "완성"하기 위해 `null`나
      `[]`로 채워 넣지 않아요
- [ ] `classification`는 직접 작성하지 않고 Glottolog에서 가져왔는지 확인해요
- [ ] 수정된 모든 필드의 출처 정보가 `_fieldSources`에 기록되고,
      Champollion이 계산한 값에는 `champollion-derived` 출처가 표기되는지 확인해요
- [ ] 카드의 어떤 위치에도 방법론 결과의 측정된 점수가 나타나지 않는지 확인해요
- [ ] 린터와 카드 무결성 게이트가 오류 없이 통과하는지 확인해요

---

## 전문 참조

| 표준 | 관리 주체 | 우리의 사용처 |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | 표준 언어 코드, 매크로언어 관계 |
| [Glottolog](https://glottolog.org) | Max Planck Institute | 분류, 좌표, AES 위기 상태 |
| [WALS](https://wals.info) | Max Planck Institute | 속 정의, 유형론적 특징 |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | 문자 코드 |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | 로케일 데이터, 복수 규칙, 타이포그래피 |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | 화자 수, 자칭어, 문자 데이터 |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, 화자 추정치, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | 위기 분류 |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | 필리핀 언어 캡슐 |

참고: 출처별 상세 안내는 [언어 카드 인용 절차](/docs/reference/language-card-citation-procedure)를
확인하세요.
