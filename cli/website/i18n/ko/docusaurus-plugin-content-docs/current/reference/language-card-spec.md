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

> **단일 진실 공급원(Single source of truth).** 이 문서는 모든 언어 카드의 표준 형태를 정의해요. 카드는 인용된 출처가 주장하는 내용만 주장해요. 어떤 출처도 주장하지 않는 필드는 **null이 아니라 생략**돼요. 누락된 필드는 "출처가 언급하지 않음"을 의미하며, 결코 "알 수 있는 내용이 없음"을 의미하지 않아요. 기계가 검사할 수 있는 스키마는 npm 패키지에 `shared/schemas/language-card.schema.json`(으)로 포함되어 제공되며, [아래의 표준 예시](#canonical-template)는 사이트가 빌드될 때마다 라이브 코퍼스에서 생성되므로 이 페이지의 내용은 설명하는 카드와 어긋날 수 없어요.

## 2026-08 아틀라스 재빌드 — 이 스키마에서 변경된 사항

이제 카드 코퍼스는 **빌드 출력물**이에요. 모든 카드는 고정된 업스트림 스냅샷 저장소에서 투영되며, 사실이 변경될 때마다 편집되는 것이 아니라 재빌드돼요. 이 재빌드와 함께 형태에 관한 네 가지 사항이 변경되었어요.

1. **이견이 있는 필드는 출처 표기 엔벨로프(attribution envelope)를 포함해요.** 인용된 출처들이 실제로 일치하지 않는 경우, 해당 필드는 단순한 평면적(flat) 값이 아니라 `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment` 및 새로운 출처로 인해 이견이 발생한 모든 필드가 이에 해당해요. 소비자는 평면적 값을 가정하기보다는 게시된 어댑터(npm 패키지의 `normalizeCard()`)를 통해 카드를 읽어야 해요. `display()`는 엔벨로프를 합의된 값으로 해석하며, 실제 이견이 있는 경우에는 승자를 선택하는 대신 의도적으로 아무것도 반환하지 않아요.

2. **이름이 변경된 필드.** `endonym`이(가) `nativeName`을(를) 대체했어요 · `codeAliases`이(가) `aliases`을(를) 대체했어요 · `scripts[]`(모든 증명된 문자)이(가) 평면적인 `script`을(를) 대체했으며, 기본 문자는 카드의 최대 BCP 47 태그에서 파생돼요 · `endangerment`(각 출처의 자체 척도에 따른 모든 출처의 평가)이(가) 단일 `vitality` 객체를 대체했어요 · `isoLanguageType` 및 `isoScope`은(는) 이제 이니셜 대신 ISO 639-3의 자체 단어("Living", "Macrolanguage")를 포함해요. 새 필드: `modality`(Glottolog의 계통에서 파생된 "spoken"/"signed"), `glottologBucket`(어족 슬롯에서 제외된 Glottolog의 비계통적 버킷), `locale`/`localeScoped`.

3. **주장되지 않은 필드는 null이 아니라 생략돼요.** 어떤 출처도 주장하지 않는 필드는 카드에 존재하지 않아요. 이전 규칙("모든 카드는 null일지라도 모든 최상위 필드를 포함해야 한다")은 폐기되었어요. 공개된 표면의 빈 값은 알 수 있는 내용이 없다는 주장으로 읽히며, 이는 찾아보지 않은 것과는 다르기 때문이에요.

4. **로케일 카드가 존재해요.** 언어 카드와 함께, 로케일 투영(`fra-CA`, `cmn-Hant`)은 `locale: {language, region, script}` 블록으로 식별되는 지역이나 문자에 대해 해석된 해당 언어의 사실을 포함해요. 로케일은 언어가 아니에요. 해당 블록을 기준으로 언어 수 계산에서 로케일을 제외하세요.

## 설계 원칙

1. **모든 것의 출처를 명시해요.** 모든 사실적 주장은 이름이 지정되고 버전이 관리되는 1차 출처로 추적돼요. 출처가 없는 주장은 검증할 수 없는 주장이에요. `_fieldSources` 맵(그리고 하위 객체의 필드별 `source` 주석)은 출처를 명확하게 해요.

2. **이견을 보존해요.** 권위 있는 기관들의 의견이 일치하지 않을 때(한 출처는 화자가 50,000명이라고 하고 다른 출처는 20,000명이라고 하는 경우), 카드는 위의 엔벨로프 형태처럼 출처 표기와 함께 *둘 다* 저장해요. 우리는 평균을 내거나, 해결하거나, 한쪽 편을 들지 않아요. 사용자가 직접 뉘앙스를 파악할 수 있어요.

3. **부재는 주장되지 않음을 의미해요.** 누락된 필드는 어떤 출처도 값을 주장하지 않음을 의미해요. 속성이 실제로 적용되지 않는 경우(예: 문법적 성별이 없는 언어의 문법적 성별), 인용된 값은 비워두는 대신 명시적으로 그렇다고 표시해요.

4. **패치되지 않고 재빌드돼요.** 카드는 결정론적 빌드를 통해 고정된 출처에서 투영돼요. 사실에 대한 결함은 출처 핸들러에서 수정되고 코퍼스가 재빌드돼요. 제자리(in-place) 편집이나 병합 전용 강화 레이어는 없어요.

---

## 3계층 아키텍처

| 계층 | 위치 | 목적 |
|-------|----------|---------|
| **언어 카드** | `shared/language-cards/<code>.json` | 언어별 구성: 정체성, 분류, 리소스 등 모든 것 |
| **속(genus) 카드** | `shared/language-cards/genera/<genus>.json` | 관련 언어들을 위한 공유 런타임 속성 (자동 생성이 아닌 큐레이션됨) |
| **언어 트리** | `shared/language-cards/language-tree.json` | 전체 Glottolog 계층 구조 — Lab UI 및 언어 탐색을 위한 참조 데이터 |

---

## 상속 모델

> **아틀라스 재빌드 이후 대체로 역사적인 내용이 되었어요.** 디스크의 어떤 언어 카드도 더 이상 `extends`을(를) 포함하지 않아요. 상속된 산문은 인용할 수 없었기 때문에(어족 수준의 주장이 언어 수준의 주소로 표시됨) 모든 카드는 빌드에 의해 완전히 구체화돼요. 이 메커니즘 자체는 한 곳에 남아 있어요. npm 패키지의 오프라인 번들은 로케일 카드를 해당 언어에 대한 압축된 `extends` 델타로 제공하며, 여기에 설명된 것과 동일한 병합을 통해 해석돼요.

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

> **작성되지 않고 생성돼요.** 이 섹션의 모든 내용은 빌드 시점에 라이브 코퍼스에서 파생돼요. 전체 `crk`(Plains Cree) 카드가 바이트 단위로 동일하게 포함되며, `fra-CA` 로케일 발췌본이 추가돼요. 코퍼스가 재빌드되면 다음 사이트 빌드에서 이 페이지를 다시 파생시켜요. 구식이 될 수 있는 수동 유지 관리 템플릿은 더 이상 남아 있지 않아요. 이전 템플릿은 카드보다 전체 스키마 세대가 뒤처져 2026년 8월 16일에 폐기되었어요.

이 예시는 파일을 열었을 때 얻을 수 있는 **디스크 상의 형태(on-disk shape)**를 보여줘요. 소비자는 여전히 게시된 어댑터(npm 패키지의 `normalizeCard()`)를 통해 카드를 읽어야 해요. 이 어댑터는 엔벨로프를 해석하고, 전환 이전의 이름들을 연결하며, 원시 카드가 의도적으로 포함하지 않는 표시 전용 값(기본 문자, 활력도 등급)을 파생시켜요.

읽을 때 주의할 점:

1. **출처 표기 엔벨로프.** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` 및 `politenessDistinction`은(는) 각각 `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment`을(를) 포함하며 `"agreement": "incommensurable"`을(를) 가져요. 출처들이 서로 다른 척도로 평가하므로, 각 값은 승자의 척도로 변환되는 대신 자체 `scale`을(를) 명시해요.

2. **생략은 주장되지 않음을 의미해요.** 카드에는 `iso639_1`(Plains Cree에는 ISO 639-1 코드가 없음)이(가) 없고 `phonologicalInventory`(수집된 출처 중 이를 주장하는 곳이 없음)이(가) 없어요. 이러한 필드는 단순히 존재하지 않으며, 결코 `null`이나 `[]`이(가) 아니에요.

3. **출처(Provenance)는 일급(first-class) 레이어예요.** `_fieldSources`은(는) 모든 필드를 이를 주장한 출처에 매핑하며, `champollion-derived-v1`은(는) Champollion이 계산한 값을 표시해요. `_card`은(는) 카드의 유형, ID, 리비전 및 수정 레인(correction lane)이 건드릴 수 있는 필드를 기록하고, `_atlas`은(는) 코퍼스 릴리스를 기록해요.

4. **실행 결과가 없어요.** 카드에 있는 어떤 것도 메서드 출력의 측정된 점수가 아니에요. chrF, FST 수락률 및 이와 유사한 항목은 (메서드, 데이터셋, 메트릭)을 키로 하는 실행 결과이며 리더보드에 존재해요. 카드는 리소스가 *존재한다*는 사실만 주장해요(`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### 로케일 카드는 언어가 아니라 투영이에요 \{#locale-card-example}

언어 카드 옆에는 로케일 카드(`fra-CA`, `cmn-Hant`)가 있어요. 이는 **지역이나 문자에 대해 해석된** 언어의 사실들로, 코드 형태가 아니라 `locale` 블록으로 식별돼요. 로케일 카드는 해당 언어의 사실을 상속하고, 문자와 지역 범위의 사실(`script`, `localeScoped`)을 해석하며, **언어가 아니에요**. 해당 `locale` 블록을 기준으로 모든 언어 수 계산 및 언어별 목록에서 로케일 카드를 제외하세요.

<CardSpecExample variant="locale" />

---

## 필드 참조 \{#field-reference}

아래의 모든 표에는 두 가지 규칙이 적용돼요.

- **"엔벨로프(envelope)"**는 *모든* 출처의 주장을 포함하는 출처 표기 엔벨로프(`{agreement, consensus?, values: [{value, source, note?, scale?}]}`)를 의미해요. `envelope`(으)로 나열된 필드는 단일 출처만 언급하는 카드에서 평면적 값으로 나타날 수 있어요(예를 들어, Glottolog 전용 랭구오이드(languoid)는 평면적인 `name`을(를) 가짐). 소비자는 두 가지를 모두 처리해야 하며, 게시된 어댑터가 이 역할을 수행해요.
- `code` 및 `name` 외에는 필수 필드가 없어요. 그 외의 모든 것은 **어떤 출처도 주장하지 않을 때 생략**돼요. 각 필드를 주장하는 출처는 `_fieldSources`의 카드별로 기록되므로, 표는 변경될 수 있는 버전을 고정하는 대신 출처의 *종류*를 설명해요.

### § 1. 정체성 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `code` | `string` | **필수.** 카드 ID 및 파일 이름. 언어 카드의 경우 ISO 639-3(`crk`)을 사용하고, Glottolog 전용 랭구오이드는 글로토코드(glottocode)를 포함하며, 로케일 카드는 로케일 코드(`fra-CA`)를 포함해요. |
| `name` | envelope | **필수.** 영어 참조 이름(ISO 639-3 레지스트리, LinguaMeta, Glottolog). |
| `endonym` | envelope | `nativeName`을(를) 대체했어요. 화자가 해당 언어로 그 언어를 부르는 이름(LinguaMeta, Wikidata). 어떤 출처도 주장하지 않으면 존재하지 않아요. 내명(endonym)은 우리가 결코 발명하거나 음역하지 않아요. |
| `alternateNames` | `string[]` | 증명된 다른 영어 이름. |
| `iso639_1` | `string` | 두 글자로 된 ISO 639-1 코드가 존재하는 경우에만 표시돼요(`fra` → `"fr"`). |
| `isoScope` | `string` | ISO 639-3의 자체 단어 — `"Individual"`, `"Macrolanguage"`, `"Special"` (`"I"`/`"M"`/`"S"` 이니셜을 대체함). |
| `isoLanguageType` | `string` | `isoType`을(를) 대체했어요. ISO 639-3의 자체 단어 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | 이 언어가 속한 대언어(macrolanguage)(`crk` → `"cre"`). ISO 639-3 대언어 매핑. |
| `macrolanguageMembers` | `string[]` | 대언어 허브 카드의 경우: 개별 구성원 코드(`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | 대언어 카드의 경우: BCP 47 레지스트리가 이 대언어의 태그로 통합하는(fold into) 태그를 가진 구성원(CLDR 별칭 표 + SIL langtags, 각각 출처 표기됨). |
| `supersededCodes` | `string[]` | SIL이 현재 이 언어로 연결하는 폐기된 ISO 639-3 코드 — 이전 코드로 게시된 코퍼스가 여전히 해석될 수 있도록 후속 언어에 기록돼요. |
| `codeAliases` | `string[]` | `aliases`을(를) 대체했어요. 이 카드로 해석되는 코드 수준 식별자. |
| `bcp47` | `string` | 주장된 언어의 BCP 47 태그(LinguaMeta). |
| `bcp47Tag` | envelope | Champollion 파생: RFC 5646 태그(가장 짧은 ISO 639 코드가 우선함). |
| `bcp47FullTag` | envelope | 최대 언어-문자-지역 형태(CLDR likelySubtags + SIL langtags). 어댑터는 이 태그에서 **기본 문자**를 파생시켜요. |
| `modality` | `string` | `"spoken"` 또는 `"signed"`, Glottolog의 계통에서 파생돼요. 쓰기는 양식(modality)이 아니라 정서법 속성이며, 문자가 없는 언어도 여전히 완전히 음성 언어이거나 수어예요. |
| `locale` | `object` | **로케일 카드 전용.** `{language, region, script, publishedTag, source, note}` — 로케일 식별자. 코드 형태가 아니라 이 블록을 기준으로 언어 수 계산에서 로케일 카드를 제외하세요. |
| `localeScoped` | `object` | 로케일 카드 전용: 로케일의 지역/문자에 대해 해석된 값(예: `scriptName`, `cldrOfficialStatus`). |

### § 2. 분류 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `glottocode` | `string` | 이 랭구오이드에 대한 Glottolog의 식별자(`crk` → `"plai1258"`). Glottolog 전용 랭구오이드(ISO 639-3에는 없지만 Glottolog에는 기록된 언어)는 글로토코드를 카드 `code`(으)로 사용해요. |
| `classification` | `object` | 아래 배치 필드의 컨테이너. 각각은 독립적으로 출처가 지정되고 독립적으로 생략돼요. 고립어이거나 Glottolog 버킷에 분류된 언어는 합당하게 이 객체의 일부만 포함해요. |
| `classification.family` | envelope | 각 분류 기관이 주장하는 최상위 어족. Glottolog와 WALS는 항상 일치하지는 않는 별개의 분류 체계이므로 둘 다 유지되고 출처가 표기돼요. 린트(Lint) 규칙 R5는 엔벨로프 내부의 Glottolog 값을 Glottolog 자체 트리와 대조하여 검사해요. WALS는 Glottolog와 다를 수 있지만, Glottolog를 잘못 인용해서는 안 돼요. 고립어는 어족을 전혀 포함하지 않아요. |
| `classification.familyGlottocode` | `string` | 해당 최상위 어족의 글로토코드(`crk` → `"algi1248"`). |
| `classification.genus` | `string` | WALS의 중간 분류 노드(`crk` → `"Algonquian"`). Glottolog 개념이 **아닌** WALS 개념(Glottolog는 속(genus) 수준이 없는 임의 깊이의 트리를 게시함)이므로 WALS가 언어를 코딩하는 곳에만 존재해요. |
| `classification.ancestry` | `string[]` | 조상 글로토코드로서의 Glottolog 하강 경로(루트 우선)(`["algi1248", …, "plai1264"]`). 순서가 **곧** 주장이에요. 이것은 경로이며 결코 알파벳순 집합이 아니에요. |
| `classification.glottologBucket` | `string` | Glottolog의 비계통적 버킷 — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. 버킷은 계통이 아니라 종류별로 분류하기 때문에 어족 슬롯에서 제외돼요. 버킷이 있는 카드는 어족이 없으며, 이것이 정직한 결과예요. |
| `isIsolate` | `boolean` | Glottolog가 이 언어를 고립어로 분류하는지 여부. |

전환 이전 카드에는 `genusGlottocode`도 포함되어 있었어요. 이는 이를 생성한 범주 오류와 함께 폐기되었어요. 속(genus)은 WALS의 개념이며, 이를 Glottolog 식별자로 포장하는 것은 Glottolog에 없는 트리 노드를 주장하는 것이었어요. 대신 Glottolog 계층 구조는 `ancestry`에 의해 전달돼요.

### § 3. 지리 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `macroarea` | `string` | Glottolog의 대지역(macroarea) — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` 또는 `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Glottolog의 대표 지점. 지역이 아니라 지점이에요. 언어를 지도에 표시하며 범위나 경계에 대해서는 아무것도 주장하지 않아요. |
| `countries` | `string[]` | Glottolog가 언어와 연관시키는 국가의 ISO 3166-1 alpha-2 코드(`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | CLDR이 기록한 대로 일부 지역이 언어에 부여하는 공식 지위(LinguaMeta를 통해 전달됨) — `"Official"`, `"Regional official"`. 로케일 카드의 경우, *해당 로케일의* 지역에 대해 해석된 지위가 `localeScoped.cldrOfficialStatus`에 위치해요. |

전환 이전의 `regions` 배열(관리 코드가 포함된 국가별 화자 분석) 및 `arealContext`(언어 연합(Sprachbund) 멤버십)은 폐기되었어요. 수집된 출처 중 이를 주장하는 곳이 없으며, 출처가 없는 큐레이션은 재빌드 시 유지되지 않아요. 지역 수준의 화자 주장은 인용 가능한 출처가 파이프라인에 도입되는 날에 다시 돌아올 수 있어요. 그때까지는 부재가 정직한 상태예요.

### § 4. 문자 체계 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `scripts` | `string[]` | 평면적인 `script`을(를) 대체했어요. 증명된 **모든** ISO 15924 코드(`crk` → `["Cans", "Latn"]`)이며 순서가 없어요. `scripts[0]`을(를) "유일한" 문자로 읽지 마세요. 기본 문자는 어댑터가 `bcp47FullTag`의 최대 태그에서 파생시켜요. |
| `scriptNames` | `string[]` | `scripts[]`에 대해 Champollion이 파생시킨 표시 이름(`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | `dir`을(를) 대체했어요. 출처의 자체 단어 — `"left-to-right"` / `"right-to-left"` (이전 `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: 해당 언어에 너무 표준적이어서 BCP 47 태그에서 생략되는 문자(`fra` → `"Latn"`). |
| `script` | `string` | **로케일 카드 전용**: 로케일 해석된 문자(`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). 언어 카드에는 평면적 문자 필드가 없어요. |

증명된 쓰기가 없는 언어는 단순히 **`scripts` 필드가 없어요**. 부재는 어떤 출처도 문자를 주장하지 않았음을 의미하며, 언어가 "문자가 없다(unwritten)"는 주장이 아니에요. (수어가 이러한 그룹 중 가장 큽니다. 일상적인 읽고 쓰기를 위해 커뮤니티 표준으로 채택된 표기법 시스템이 없어요.)

### § 5. 인구통계 및 활력 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `speakerEstimates` | envelope | 출처가 표기된 모든 출처의 추정치. 값은 정확한 수치이거나 출처 자체의 범위 문자열(`"10000-99999"`)일 수 있으며, 출처의 주의 사항은 `note`에 그대로 전달돼요. `"agreement": "conflicting"`은(는) 흔히 발생해요. 충돌을 보여주는 것 *자체가* 제품의 목적이며, 평균을 내거나 하나를 선택하지 않아요. |
| `endangerment` | envelope | 단일 `vitality` 객체를 대체했어요. **해당 출처의 자체 척도에 따른** 모든 출처의 평가 — 각 값은 `scale` 필드를 포함하며, ELCat, Glottolog AES 및 LinguaMeta 어휘는 서로의 번역이 아니기 때문에 `"agreement": "incommensurable"`이(가) 일반적이에요. 어댑터는 선언된 권위 순서에 따라 단일 명명된 출처에서 하나의 표시용 *활력도 등급(vitality tier)*을 파생시켜요. 해당 등급은 표시 전용이며, 출처가 표기된 전체 세트는 카드에 유지돼요. |

Champollion의 어디에서든 *표시되는* 화자 수는 인용된 `speakerEstimates` 항목 중 하나와 일치하거나 명시적인 `champollion-derived` 출처를 포함해야 해요. 이는 카드 무결성 규칙에 의해 강제돼요.

### § 5.5 문서화 및 디지털 존재 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `documentation` | `object` | `documentationDepth`을(를) 대체했어요. 언어가 얼마나 잘 설명되어 있는지에 대한 Glottolog의 기록(Glottolog 자체 용어 사용). |
| `documentation.medLevel` | `string` | Glottolog의 가장 광범위한 설명(Most Extensive Description) 수준, 원문 그대로 — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Glottolog의 참조 카탈로그에 있는 가장 광범위한 설명의 서지 키. |
| `documentation.firstDocumented` | `number` | Glottolog 자체의 문서화 첫 연도(first-year-of-documentation) 열, 원문 그대로 — 전환 이전의 최상위 필드에서 여기로 이동했어요. 수백 개의 언어에만 존재하며, 이러한 희소성 자체가 알아둘 가치가 있어요. |
| `documentation.lastDocumented` | `number` | Glottolog의 문서화 마지막 연도(last-year-of-documentation) 열, 원문 그대로 — 약 천 개의 언어에 존재해요. |
| `wikipediaEdition` | `object` | `digitalPresence`을(를) 대체했어요. `{site, url, name}` — 이 언어로 된 열린 위키백과 에디션이 존재해요(`afr` → `af.wikipedia.org`). 의도적으로 **문서 수 없이** 존재 여부만 표시해요. 여러 에디션이 주로 봇에 의해 생성되며, 거대한 에디션이 번역가가 사용할 수 있는 어떤 의미에서든 작은 에디션보다 "더 잘 문서화"된 것은 아니기 때문이에요. |
| `dialectCount` | `number` | Glottolog 자체의 `child_dialect_count` 열, 원문 그대로 — 전체 하위 트리가 아닌 직접적인 하위 방언만 해당돼요. 이는 우리의 산술이 아니라 Glottolog의 주장이에요. 이전 규칙은 이를 `champollion-derived`(으)로 표시하여 수천 개의 카드가 Glottolog의 집계를 자신의 공로로 삼게 만들었어요. |

전환 이전 `digitalPresence` 블록의 나머지 부분(Common Voice 시간, Tatoeba 문장 수)은 해당 출처가 파이프라인에 도입될 때까지 폐기돼요. Tatoeba 코퍼스 자체는 이미 제자리인 `resources.corpora`(§ 9) 아래의 병렬 코퍼스로 나타나요.

### § 6. 격식, 레지스터 및 성별 필드

투영된 코퍼스는 여기에 정확히 하나의 필드, 즉 인용된 사실을 포함해요.

| Field | Shape | Notes |
|-------|-------|-------|
| `politenessDistinction` | envelope | 언어가 2인칭 형태에서 공손함을 문법화하는지 여부. Grambank GB415(이진: 부재/존재) 및 WALS 45A(4단계: 구분 없음 / 이진 / 다중 / 대명사 회피)에 걸쳐 출처가 표기돼요. 이들은 서로 다른 척도이므로 각 값은 자체 `scale`을(를) 명시하며, 엔벨로프는 이를 이견이 아니라 **비교 불가능(incommensurable)**한 것으로 보고해요. |

**레지스터 시스템은 구성(configuration)이며 카드 사실이 아니에요.** 전환 이전 코퍼스는 거의 1,800개의 카드 각각에 `formality` 산문과 `registers` 프롬프트를 저장했어요. 이들 대부분은 위의 동일한 두 출처에서 생성된 후 마치 수동으로 큐레이션된 구성인 것처럼 전달되었어요. 아틀라스는 사실을 유지해요. 구성 표면(`formality`, `registers`, `gender`, `codeSwitching`)은 **npm 패키지의 큐레이션된 스키마**(`language-card.schema.json`)의 일부로 남아 큐레이션된 속/어족 허브 카드에 존재하며, [상속 모델(Inheritance Model)](#inheritance-model)에 설명된 레지스터 시스템의 `extends` 병합을 통해 CLI에 도달해요. 이들은 투영된 아틀라스 필드가 아니에요. 투영된 코퍼스의 어떤 카드도 이를 포함하지 않으며, 아틀라스 빌드는 결코 이를 작성하지 않아요. [좋은 레지스터 사전 설정 작성하기(Writing Good Register Presets)](#writing-good-register-presets)의 지침은 해당 큐레이션된 레인에 적용돼요.

### § 7. 언어학적 프로필 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `typologicalProfile` | `object` | 수집된 유형학적 특징당 하나의 키, 각 값은 출처 자체의 코딩, 각 키는 출처가 이 언어를 코딩하는 곳에만 존재해요. 부울(Boolean)은 Grambank 특징에서, 범주 문자열은 WALS 장(chapter)에서 가져와요. 결정 레지스트리는 모든 키에 대한 정확한 업스트림 매개변수를 명명해요. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — 인용된 PHOIBLE 인벤토리에 대해 Champollion이 계산한 수치(PHOIBLE은 세그먼트당 하나의 행을 게시하며 수치를 주장하지 않음)이므로 모든 값은 `champollion-derived` 출처를 포함해요. **PHOIBLE은 유일한 성조(tone) 권위자예요**(린트 R1). Grambank에는 성조 특징이 없으며, 카드의 다른 어떤 것도 성조를 주장할 수 없어요. |
| `numeralSystem` | `object` | `{base}` — 진수(numeral base), Chan의 *Numeral Systems of the World's Languages*에서 원문 그대로 가져옴(`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; 거의 100개의 고유한 값). Chan 자체의 진수 열이 비어 있는 경우(조사된 언어의 약 절반) 존재하지 않아요. 이전 생성기가 빈칸을 `"decimal"`(으)로 채우고 2,000개의 언어에 대해 값을 발명했기 때문이에요. |
| `pluralCategories` | `string[]` | CLDR이 이 언어에 대해 명시하는 기수 복수형 범주 — 아랍어는 `["zero", "one", "two", "few", "many", "other"]`을(를) 구분하고, 프랑스어는 그중 3개, 중국어는 1개를 구분해요. CLDR 자체 규칙 세트의 키에서 읽어오므로 이는 우리의 파생이 아니라 CLDR의 주장이에요. 전환 이전의 `rules.plurals.categories`을(를) 대체했어요. i18n 파이프라인은 메시지가 제공해야 하는 복수형의 수를 알기 위해 이를 필요로 해요. |

현재 투영된 `typologicalProfile` 키와 해당 업스트림 매개변수:

- **WALS 장(chapters)** (범주 문자열, WALS 자체 값 레이블): `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank 특징** (부울): `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

전환 이전의 `linguisticChallenges` 및 `contactInfluences` 블록은 투영되지 않아요. 수집된 출처가 없는 연구된 산문은 § 6의 레지스터 표면처럼 npm 패키지의 큐레이션된 스키마에 유지돼요(아래의 [접촉 영향 유형(Contact Influence Types)](#contact-influence-types) 표가 해당 레인을 제공함). `rules` 블록은 폐기되었어요. 그중 인용 가능한 내용은 여기의 `pluralCategories` 및 § 4의 문자 필드로 살아남아요.

### § 8. 백과사전 필드

카드에서 폐기되었어요. 전환 이전의 `encyclopedic`(역사 및 방언 에세이, 기관 링크), `culturalAphorism` 및 `varieties` 블록은 카드 단위의 수동 큐레이션 산문이었으며, 재빌드 시 의도적으로 삭제돼요. `varieties`이(가) 가리키던 멤버십 사실은 이제 인용된 식별자 필드(§ 1 `macrolanguageMembers` 및 `canonicalisedMembers`)가 되었으며, 변종별 도구 적용 범위는 각 구성원의 자체 카드(`methodSupport`, `resources`)에서 답변돼요. 대표적인 속담은 동의와 인용을 거쳐 커뮤니티 기여 레인을 통해 돌아올 수 있지만, 출처가 없는 카드 필드로는 돌아오지 않아요.

### § 9. 디지털 리소스 필드

이 섹션의 모든 내용은 **존재와 기능(capability)을 주장하며, 결코 품질을 주장하지 않아요**. 리소스가 게시되었다는 사실과 누가 게시했는지를 나타낼 뿐, 그것이 훌륭하거나 완전하거나 사용 가능하다고 주장하지 않으며 측정된 점수도 아니에요. 메서드 출력의 측정된 점수는 (메서드, 데이터셋, 메트릭)을 키로 하는 실행 결과이며, 리더보드에 존재하고 카드에서는 금지돼요(린트 R3).

| Field | Shape | Notes |
|-------|-------|-------|
| `resources` | `object` | 컨테이너: 아래의 각 하위 필드는 독립적으로 출처가 지정된 목록이며, 어떤 출처도 주장하지 않을 때 생략돼요. |
| `resources.fsts` | `object[]` | 게시된 유한 상태 형태소 분석기(finite-state morphological analysers): `{name, url, publisher, license, licenceEstablished, archived}`. 라이선스는 카탈로그 전체에 균일하다고 가정하는 대신 각 항목과 함께 이동해요. 라이선스 경계에는 실제 약관이 필요하기 때문이에요. 포합어(polysynthetic language)의 경우 FST는 종종 존재하는 유일한 구조적 검사 도구예요. |
| `resources.corpora` | `object[]` | 이 언어를 증명하는 병렬 코퍼스: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. 병렬 코퍼스는 쌍을 통해서만 언어를 증명하므로 **쌍(pairs)**을 통해 명시돼요. 무엇과 대조하는지 말하지 않고 "스와힐리어를 다룬다"고 하는 것은 아무도 묻지 않은 질문에 답하는 것과 같아요. 존재와 크기만 나타내며 결코 품질을 나타내지 않아요. |
| `resources.monolingualCorpora` | `object[]` | 단일어 코퍼스 — "코퍼스가 있다"는 말이 비교할 수 없는 두 가지를 의미하지 않도록 `corpora`와(과) 분리되어 유지돼요. |
| `resources.speech` | `object[]` | 게시된 음성 리소스. 존재 여부만 표시해요. |
| `resources.keyboards` | `object[]` | 게시된 키보드 레이아웃. 단순하지만 중요한 역할을 해요. 표준 레이아웃에서 생성되지 않는 문자가 필요한 정서법의 경우, 레이아웃은 언어를 입력할 수 있는지 없는지의 차이를 만들어요. |
| `resources.typology` | `object[]` | 이 언어를 *코딩*하는 유형학적 데이터셋과 그 범위: `{dataset, featuresCoded, datasetFeatureTotal}`. 존재와 범위만 나타내며 결코 내용을 나타내지 않아요. 특징이 말하는 내용은 누군가 이를 수락하는 매개변수 맵을 작성할 때까지 카드에 표시되지 않아요(수락된 내용은 § 7의 `typologicalProfile`에 나타남). 특징 수는 우리의 산술이므로 `champollion-derived` 출처를 포함해요. |
| `lexicalResources` | `object` | 어휘 존재 사실을 위한 컨테이너. |
| `lexicalResources.datasets` | `object[]` | 게시된 단어 목록과 그 적용 범위: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | 게시된 사전 — 존재 여부만 나타내며 결코 품질을 나타내지 않고, 게시자가 지시하는 방향으로 **방향성(directed)**을 가져요. 한 방향으로 가는 사전은 다른 방향으로 가는 사전과 다른 리소스예요. 항목의 형태는 균일하지 않으며(CLDF 데이터셋은 항목 수를 알고, 저장소는 쌍과 방향을 앎), 각각 자체 출처를 명시하고 라이선스 및 보관 상태는 항목별로 이동해요. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | CLICS³에 대해 Champollion이 계산한 수치: 이 언어에 대해 증명된 개념, 그리고 두 개 이상의 고유한 개념에 매핑되는 형태. `champollion-derived`. |
| `methodSupport` | `object` | 이 언어를 다루는 번역 메서드 — 기능(capability)이며 결코 점수가 아니에요. 형태: `{total, byTier, named, truncated}`. 영어는 수천 개의 메서드 엣지(edges)를 전달하고 중간값 언어는 수십 개를 전달하므로, 카드는 증거의 *형태*(`total` 및 신뢰도 등급별 `byTier` 수(`fetched`, `partially-confirmed`, `model-card-declared`))를 유지하고 가장 강력한 항목(각 `{value, variant, source, confidence}`)만 제한적으로 명시해요. 레지스트리 **서비스**는 항상 제한 없이 전체 이름이 명시되므로 `named`에 서비스가 없다는 것은 실제 답변이에요. 모델 카드 항목이 없다는 것은 "가장 강력한 항목에 속하지 않음"을 의미할 뿐이며, 모든 엣지는 아틀라스 저장소에서 계속 쿼리할 수 있어요. |
| `metricModelSupport` | envelope | 이 언어의 적용 범위를 게시하는 평가 메트릭 모델과 하네스(harness)가 로드하는 모델 식별자(`masakhane/africomet-mtl`). 실제 동작(COMET 모델 선택)을 주도하며 여전히 기능(capability)이고 결코 점수가 아니에요. |

**위 필드에 통합됨:** 전환 이전의 `keyboardSupport`(→ `resources.keyboards`), `corpusAvailability`(→ `resources.corpora` / `resources.monolingualCorpora`) 및 `databaseCoverage`(→ `resources.typology` 및 `lexicalResources` — 데이터베이스 항목은 이제 부울이 아니라 범위가 포함된 인용된 적용 범위 사실임).

**카드에서 폐기됨:** `omt1600`, `evalDatasets`, `pipelineReadiness` 및 `metricPlugins` — 수집된 출처 중 어느 것도 이를 주장하지 않으며, 준비도 등급(readiness tier)은 인용이 아니라 판단이에요.

**투영되지 않고 큐레이션됨:** 평가 표준 선언 표면(`evalStandard`, `evalMetrics`, `evalPack`)은 npm 패키지의 큐레이션된 스키마에 유지돼요. 이들은 평가 하네스에 어떤 외부 심판(referee) 패키지가 언어를 채점하는지 알려줘요(참가자가 아닌 심판 — 하네스 코어에는 언어별 채점자 코드가 포함되어 있지 않음). 하네스는 카드가 존재할 때 카드에서 이를 읽지만, 현재 투영된 코퍼스의 어떤 카드도 이를 포함하지 않으며 아틀라스 빌드는 이를 작성하지 않아요. 하네스의 FST 설치 프로그램이 `resources.fsts[]` 항목(`language_cards.py`의 `get_fst_install_info()`)에서 읽는 `install` 블록도 마찬가지예요. 투영된 항목은 존재 사실만 포함해요.

### § 10. 출처 필드

| Field | Shape | Notes |
|-------|-------|-------|
| `_fieldSources` | `object` | 모든 카드에 존재해요. 카드의 모든 필드 경로(`"classification.family"`, `"coordinates.lat"`)를 이를 주장한 정렬된 출처 ID(`["glottolog-v5.3", "wals-v2020.5"]`)에 매핑해요. Champollion이 계산한 값은 `champollion-derived-v1`을(를) 포함해요. 출처 ID는 버전이 관리되므로(`grambank-v1.0.3`, `iso639-3-20260715`) 모든 주장은 이를 만든 정확한 릴리스로 추적돼요. |
| `coverage` | `object` | 모든 카드에 존재하며, **어떤 출처도 주장하지 않고 투영기(projector)에 의해 계산돼요**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — 이 언어에 대해 언급하는 고유한 출처의 수, 채울 수 있는 전체 카드 구성 요소 중 값을 포함하는 구성 요소의 수, 그리고 출처가 *부재*로 긍정적으로 기록한 값의 수(찾아보고 없다고 말함 — 찾아보지 않은 것과는 다른 사실). 이를 통해 내용이 빈약한 카드가 방치된 것처럼 보이는 대신 **왜** 빈약한지 말할 수 있어요. |
| `_card` | `object` | 카드 자체의 메타데이터: `{type, id, revision, correctableFields}`. `type`은(는) `"language"` 또는 `"locale"`(메서드 및 코퍼스 카드는 동일한 투영기를 사용함)이고, `revision`은(는) 콘텐츠 해시이므로 카드 콘텐츠가 변경되면 이 값도 변경돼요. `correctableFields`은(는) 값을 포함하는 필드 경로(수정 레인이 건드릴 수 있는 필드)를 나열해요. |
| `_atlas` | `object` | `{version}` — 코퍼스 릴리스 스탬프(릴리스 간에는 `"unreleased"`). 의도적으로 빌드 타임스탬프가 **아닌** 릴리스 ID를 사용해요. 타임스탬프를 사용하면 동일한 핀(pin)에서 생성된 두 빌드가 날짜에 따라 달라지게 되어, 누구나 아틀라스를 검사할 수 있게 하는 속성(동일한 핀 입력, 동일한 바이트 출력)이 파괴되기 때문이에요. |

전환 이전의 출처(provenance) 블록은 통째로 폐기되었어요. `dataSources`(필드별 `_fieldSources` 맵으로 대체됨), `supportTier`(계산된 판단, 중립적인 `coverage` 수치로 대체됨), `_generated`(전체 코퍼스가 생성됨, 스탬프는 `_card.revision` 및 `_atlas.version`임), `humanReviewed` 및 `notes`(자체 기록이 있는 레인에 속하는 큐레이션), 그리고 최상위 `firstDocumented`/`lastDocumented`(출처가 실제로 이를 주장하는 § 5.5의 `documentation`(으)로 이동됨).

---

## 언어 코드 정책

Champollion은 표준 식별자로 **ISO 639-3**을 사용해요. 다른 표준 코드는
별칭으로 등록되며 런타임에 ISO 639-3 코드로 해석돼요.

| Priority | Standard | Example | Field | Use |
|----------|----------|---------|-------|-----|
| 1 (표준) | ISO 639-3 | `crk` | `code` | 카드 파일 이름, 구성 키, API 매개변수 |
| 2 (별칭) | ISO 639-1 | `iu` | `codeAliases[]` | CLI에서 허용됨, ISO 639-3으로 해석됨 |
| 3 (별칭) | BCP 47 | `fil` | `codeAliases[]` | CLI에서 허용됨, ISO 639-3으로 해석됨 |
| 참조 | 글로토코드 | `plai1258` | `glottocode` | 분류 전용, 런타임용 아님 |

**해석 순서:** 사용자가 코드를 제공할 때:
1. `card.code`에 직접 일치 → 찾음
2. `card.codeAliases[]`에 일치 → 찾음, 표준 카드 반환
3. `card.iso639_1`에 일치 → 찾음 (대체(fallback))
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
- 이전 639-1 코드는 `card.iso639_1`에 있어요.
- 이전 639-1 코드는 `card.codeAliases[]`에 있어요(`fra` → `["fr"]`).
- `resolveCode("fr")`은(는) 런타임에 `"fra"`을(를) 반환해요 — 이전 버전과 호환돼요.
- 사용자는 여전히 구성에 `"fr"`을(를) 작성할 수 있어요 — 투명하게 해석돼요.

**아키텍처상 변경된 점:**
- `_deepMerge()`은 이제 `null` 값을 건너뛰어요 (부모로부터 상속)
- `_deepMerge()`은 이제 정체성 필드 세트를 가져요 (code, extends, aliases는 절대 상속되지 않음)
- `formality.default`은 이제 레지스터 `isDefault: true` 플래그에서 파생돼요
- 205개의 Grambank 파생 카드가 구조적 `formality.default` 수정을 받았어요
- 38개의 속/어족/매크로언어 카드가 상속 대상을 제공해요

---

## 엣지 케이스

### 수어(Sign Languages)
수어(예: ASE — 미국 수어)는 ISO 639-3 코드를 가진 합법적인 언어예요. 지리적 정보와 화자 수가 있지만 다음과 같은 특징이 있어요.
- `modality`은(는) `"signed"`이에요 — 언어가 *무엇인지*에 대한 카드의 긍정적인 주장이며, 쓰기 시스템의 부재는 별개의 사실이에요.
- `scripts`은(는) 일반적으로 존재하지 않지만(커뮤니티 표준으로 채택된 표기법 시스템이 없음), 출처가 주장하는 곳에는 `"Sgnw"`(SignWriting)이 나타나요.
- `textDirection`은(는) 존재하지 않아요.
- `linguisticChallenges`은(는) 공간 문법, 분류사 등을 다뤄야 해요.

### 고대 및 역사적 언어
라틴어(`lat`, isoLanguageType `"Historical"`) 및 산스크리트어(`san`)와 같은 언어는 특정 상황(전례, 학술)에서 여전히 사용되지만 원어민이 없어요.
- `isoLanguageType`은(는) ISO 자체의 상태 단어(`"Ancient"`, `"Historical"`, `"Extinct"`)를 포함해요 — 카드는 결코 이를 완화하거나 재정의하지 않아요.
- `endangerment` 및 `speakerEstimates`은(는) 인용된 출처가 실제로 평가하는 내용을 보고하며, 주의 사항을 원문 그대로 전달해요(L2 커뮤니티 수는 출처가 레이블을 지정한 대로 레이블이 지정된 상태로 유지됨).
- `firstDocumented` / `lastDocumented`은(는) 이들을 시간상에 위치시켜요.

### 인공어(Constructed Languages)
에스페란토(`epo`, isoLanguageType `"Constructed"`), 로지반(Lojban) 등:
- `classification`이(가) 없을 수 있어요 — Glottolog는 인공어를 비계통적 버킷 아래에 분류하며, 버킷은 결코 어족으로 표시되지 않아요.
- `contactInfluences`은(는) 출처 자료를 반영해요(예: 에스페란토는 로망스어, 게르만어, 슬라브어에서 차용함).
- `endangerment`은(는) 특이해요 — 화자 커뮤니티는 성장하고 있지만 고유한 본고장(homeland)이 없어요.

### 대언어(Macrolanguages)
아랍어(`ara`), 중국어(`zho`), 크리어(`cre`), 케추아어(`que`)는 여러 개별 언어를 포괄하는 대언어예요.
- `isoScope: "Macrolanguage"` — 탐색 허브이며 결코 벤치마크 대상이 아니에요.
- `macrolanguageMembers`은(는) 개별 구성원 코드를 나열해요. `canonicalisedMembers`은(는) BCP 47 레지스트리가 대언어의 태그로 통합하는(fold into) 구성원을 기록해요(각 레지스트리 출처 표기됨).
- `methodSupport`은(는) *대언어 카드*가 지원하는 내용(일반적으로 표준화된 변종)을 반영해요.
- 개별 구성원은 자체 카드를 가지며, 허브로 돌아가는 `macrolanguage`을(를) 포함해요.

### 표준화된 정서법이 없는 언어
많은 언어(특히 구전 전통 언어)에는 표준화된 쓰기 시스템이 없거나 경쟁하는 정서법이 있어요.
- `scripts`, `scriptNames` 및 `textDirection`은(는) 존재하지 않아요 — 어떤 출처도 문자를 주장하지 않았으며, 이는 "문자가 없다(unwritten)"는 주장과 같지 않아요.
- `notes`은(는) 정서법 상황을 설명해야 해요.
- `linguisticChallenges`은(는) 이것이 기계 번역(MT)에 미치는 영향(예: 훈련 데이터 없음)을 기록해야 해요.

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

## 카드 사실이 업데이트되는 방법

카드는 **빌드 출력물**이에요. 고정된 업스트림 스냅샷에서 결정론적으로 투영돼요. 더 이상 카드별 강화 절차는 없어요. 수동으로 실행되는 `enrich-*` 스크립트 레인은 폐기되었으며, 카드 파일을 직접 편집한 내용은 다음 빌드에서 삭제돼요. 사실을 변경하려면:

1. **결정을 등록해요.** 모든 필드는 빌드의 결정 레지스트리에 있는 하나의 행이에요. 어떤 업스트림 매개변수가 이를 제공하는지, 어떻게 투영되는지, 그리고 부재 값이 무엇을 의미하는지 나타내요.
2. **수집(ingest) 레이어를 수정해요.** 잘못된 값은 출처 핸들러(또는 오래된 업스트림 핀)의 결함이며, 결코 카드에서 패치할 사항이 아니에요.
3. **재빌드 및 전환(cut over)해요.** 빌드는 고정된 스냅샷에서 모든 카드를 다시 투영해요. 게이트(gates)는 부분 빌드, null/빈 값, 무결성 규칙을 통과하지 못한 카드를 거부해요.

### 충돌 처리

출처 간에 이견이 있는 경우:
1. 출처 표기와 함께 **모두 저장해요** — 이것이 출처 표기 엔벨로프의 목적이에요.
2. **평균을 내거나** 한쪽 편을 들지 마세요 — `consensus`은(는) 출처가 실제로 일치할 때만 나타나요.
3. **각 출처의 주의 사항**을 해당 값의 `note`에 원문 그대로 전달해요.
4. 표시나 계산을 위한 단일 값은 선언된 권위 순서에 따라 **어댑터에 의해 파생돼요** — 카드 자체는 전체 범위를 유지해요.

---

## 검증

재빌드 후에는 린터를 실행하세요:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR 체크리스트

카드를 건드리는 변경 사항을 제출할 때(기억하세요: 카드가 아니라 빌드를 변경해야 해요):

- [ ] 수정 사항은 수집 핸들러나 결정 레지스트리에 존재해요 — 어떤 카드 파일도 수동으로 편집되지 않아요.
- [ ] 필드는 출처가 주장한 값만 포함해요 — 카드를 "완성"하기 위해 `null` 또는 `[]`(으)로 채워진(padded) 내용이 없어요.
- [ ] `classification`은(는) Glottolog에서 가져와요(수동으로 빌드되지 않음).
- [ ] 건드린 모든 필드의 출처는 `_fieldSources`에 기록되며, Champollion이 계산한 값은 `champollion-derived` 출처를 포함해요.
- [ ] 메서드 출력의 측정된 점수는 카드의 어느 곳에도 나타나지 않아요.
- [ ] 린터 및 카드 무결성 게이트를 오류 없이 통과해요.

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
