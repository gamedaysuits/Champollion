---
sidebar_position: 4
title: "지원 언어"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# 지원 언어

champollion은 50개 언어를 위한 구조화된 구성 파일인 **Language Cards**를 제공해요. 각 카드에는 레지스터 프리셋, 격식 체계 메타데이터, 메서드 지원 플래그, 타이포그래피 규칙, 문자 정보가 포함되어 있어요. LLM이 알고 있는 언어라면 어떤 언어든 구성 파일에 한 줄만 추가하면 사용할 수 있어요. 아래 목록은 큐레이션을 거쳐 프로덕션에 바로 사용할 수 있는 레지스터를 갖춘 언어들이에요.

---

## 번역 메서드

각 언어는 다음 번역 메서드 중 하나 이상을 사용할 수 있어요:

| 아이콘 | 방식 | 작동 원리 | 비용 |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | 신경망 기계 번역(Neural MT) 베이스라인이에요. 194개 언어를 지원해요. 키-값(Key-value) 문자열만 지원하며, Markdown 콘텐츠는 안전하게 번역할 수 없어요. | 100만 자당 약 $20 |
| 🔵 | **LLM (OpenRouter)** | 모델이 알고 있는 모든 언어를 지원해요. 어조(Register)가 조정된 프롬프트를 사용해요. 키-값 및 Markdown 콘텐츠를 처리할 수 있어요. | 모델마다 달라요 |
| 🟣 | **LLM-Coached** | LLM과 함께 문법 사전 및 코칭 데이터를 프롬프트에 주입해요. 형태론적으로 복잡한 언어에 가장 적합해요. | 모델마다 달라요 |
| 🟠 | **API (Plugin)** | HTTP를 통해 제공되는 커뮤니티 호스팅 번역 파이프라인이에요. [주권 지향(sovereignty-aspirant)](/docs/network/community/low-resource-languages)이에요. | 제공자마다 달라요 |

Google Translate에는 `GOOGLE_TRANSLATE_API_KEY`을, LLM 메서드에는 `OPENROUTER_API_KEY`을 설정하세요. 자세한 내용은 [번역 메서드](/docs/guides/translation-methods)를 참고하세요.

---

## 우선 순위 언어

웹 및 모바일 애플리케이션에서 가장 많이 요청되는 로케일이며, champollion의 권장 접근성 우선 순서로 나열되어 있어요.

| 국기 | 언어 | 코드 | Google | LLM | Coached | 문자 | 비고 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | 아랍어 | `ar` | ✅ | ✅ | ✅ | — | RTL. 현대 표준 아랍어 (فصحى). |
| 🇵🇭 | 필리핀어 (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Docusaurus 구성에서는 `fil`을 사용하세요. champollion은 둘 다 인식해요. |
| 🇫🇷 | 프랑스어 | `fr` | ✅ | ✅ | ✅ | — | Vous형. 성 중립 (Connecté·e). |
| 🇪🇸 | 스페인어 | `es` | ✅ | ✅ | ✅ | — | 중립적 라틴 아메리카 스페인어. |
| 🇩🇪 | 독일어 | `de` | ✅ | ✅ | ✅ | — | Sie형. 성 중립 (Benutzer:innen). |
| 🇯🇵 | 일본어 | `ja` | ✅ | ✅ | ✅ | — | 본문은 です/ます, UI 레이블은 する. |
| 🇨🇳 | 중국어 (간체) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | 이탈리아어 | `it` | ✅ | ✅ | ✅ | — | Lei형. |
| 🇧🇷 | 포르투갈어 (BR) | `pt` | ✅ | ✅ | ✅ | — | 브라질 포르투갈어. |
| 🇰🇷 | 한국어 | `ko` | ✅ | ✅ | ✅ | — | 해요체 공손 레지스터. |

## 주요 세계 언어

| 국기 | 언어 | 코드 | Google | LLM | Coached | 문자 | 비고 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | 벵골어 | `bn` | ✅ | ✅ | ✅ | — | শুদ্ধ ভাষা 선호. |
| 🇧🇬 | 불가리아어 | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | 체코어 | `cs` | ✅ | ✅ | ✅ | — | Vykání (vy형). |
| 🇩🇰 | 덴마크어 | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | 그리스어 | `el` | ✅ | ✅ | ✅ | — | 현대 Δημοτική. |
| 🇮🇷 | 페르시아어 | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | 핀란드어 | `fi` | ✅ | ✅ | ✅ | — | 문법적 성 없음. |
| 🇮🇱 | 히브리어 | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | 힌디어 | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. 영어 외래어 최소화. |
| 🇭🇺 | 헝가리어 | `hu` | ✅ | ✅ | ✅ | — | Ön형. |
| 🇮🇩 | 인도네시아어 | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | 말레이어 | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | 네덜란드어 | `nl` | ✅ | ✅ | ✅ | — | U형. |
| 🇳🇴 | 노르웨이어 | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | 폴란드어 | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani형. |
| 🇵🇹 | 포르투갈어 (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | 유럽 포르투갈어. |
| 🇷🇴 | 루마니아어 | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | 러시아어 | `ru` | ✅ | ✅ | ✅ | — | Вы형. |
| 🇸🇰 | 슬로바키아어 | `sk` | ✅ | ✅ | ✅ | — | Vykanie (vy형). |
| 🇷🇸 | 세르비아어 | `sr` | ✅ | ✅ | ✅ | 🔤 라틴 문자→키릴 문자 | 결정론적 문자 변환기. |
| 🇸🇪 | 스웨덴어 | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | 스와힐리어 | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | 태국어 | `th` | ✅ | ✅ | ✅ | — | ครับ/ค่ะ 공손 종결사. |
| 🇹🇷 | 터키어 | `tr` | ✅ | ✅ | ✅ | — | Siz형. |
| 🇺🇦 | 우크라이나어 | `uk` | ✅ | ✅ | ✅ | — | Ви형. |
| 🇵🇰 | 우르두어 | `ur` | ✅ | ✅ | ✅ | — | RTL. آپ형. |
| 🇻🇳 | 베트남어 | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | 중국어 (번체) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | 조지아어 | `ka` | ✅ | ✅ | — | — | ქართული. 카르트벨리어족. |
| 🇳🇬 | 요루바어 | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. 성조어 (3성). |

## 지역 변형

| 국기 | 언어 | 코드 | Google | LLM | Coached | 문자 | 비고 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | 멕시코 스페인어 | `es-MX` | ✅ | ✅ | ✅ | — | Tú형. 따뜻한 레지스터. |
| 🇨🇦 | 캐나다 프랑스어 | `fr-CA` | ✅ | ✅ | ✅ | — | 퀘벡 관용어. |

---

## 원주민 및 저자원 언어

이 언어들은 상용 기계 번역(MT) 서비스에서 지원하지 않아요. champollion은 언어 커뮤니티가 [커뮤니티 데이터 주권 원칙](/docs/network/community/low-resource-languages)에 따라 자체적인 번역 방식을 구축할 수 있도록 도구를 제공해요.

| | 언어 | 코드 | Google | LLM | Coached | 문자 | 상태 |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→음절 문자 | 🚧 개발 중 |
| 🌄 | 케추아어 | `qu` | ✅ | ✅ | — | — | Runasimi. 증거성 접미사. |

:::info[Plains Cree는 현재 활발히 개발 중이에요]
Plains Cree를 위한 어조, 코칭 인프라, 문자 변환기, 평가 도구는 모두 정상적으로 작동하지만, 번역 파이프라인은 **아직 출시되지 않았어요**. 출시 전 품질을 보장하기 위해 [커뮤니티 데이터 주권 원칙](/docs/network/community/low-resource-languages)에 따라 언어 커뮤니티와 협력하고 있어요. 전체 이야기와 기여 방법은 [자원이 부족한 언어 지원하기](/docs/network/community/low-resource-languages)를 확인해 주세요.
:::

:::tip[더 많은 저자원 언어 추가하기]
champollion의 method 플러그인 시스템은 이를 위해 설계되었어요. 언어 커뮤니티는 커스텀 번역 method를 만들고, 자체적으로 관리하여 호스팅하고, [API method](/docs/guides/serving-a-method)를 통해 제공할 수 있어요. [Method Leaderboard](/leaderboard)는 모든 언어 쌍의 점수를 추적해요 — method를 만들고, harness를 실행하고, 최고 점수를 차지하세요.
:::

---

## 인공 언어

인공 언어(conlang)는 LLM 레지스터와 선택적 문자 변환기를 통해 지원돼요. 실제 언어와 동일한 인프라를 사용해요 — 품질 게이트, 코칭 시스템, 문자 변환 파이프라인이 동일하게 작동해요.

| | 언어 | 코드 | Google | LLM | 문자 | 비고 |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 로마자→pIqaD | PUA 폰트 필요. Marc Okrand 어휘. |
| 🧝 | Sindarin (톨킨 엘프어) | `x-elvish-s` | ❌ | ✅ | 🔤 라틴 문자→Tengwar | CSUR PUA 폰트 필요. |
| 🏴‍☠️ | Pirate English | `x-pirate` | ❌ | ✅ | — | 레지스터 전용. 항해 비유. |
| 🦸 | Kryptonian | `x-kryptonian` | ❌ | ✅ | 🔤 라틴 문자→Kryptonian | PUA 폰트 필요. |
| 🎭 | Shakespearean English | `x-shakespeare` | ❌ | ✅ | — | 레지스터 전용. Thee/thou, -eth/-est 형태. |
| 🐸 | Yoda-speak | `x-yoda` | ❌ | ✅ | — | 레지스터 전용. OSV 어순. |

PUA 폰트 요구 사항, Unicode 제한, 직접 추가하는 방법은 [인공 언어, 문자 및 정서법](/docs/guides/conlangs-scripts-orthography)을 참고하세요.

---

## 언어 프리셋

`init` 마법사는 빠른 설정을 위해 프리셋 이름을 지원해요. 프리셋과 개별 코드를 함께 사용할 수 있어요.

| 프리셋 | 확장 결과 |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## 모든 언어 추가하기

champollion은 **LLM이 알고 있는 모든 언어**로 번역할 수 있어요 — 위 표는 내장 레지스터 프리셋이 있는 언어만 나열한 것뿐이에요. 목록에 없는 언어를 추가하려면, 구성에 해당 언어의 BCP-47 코드를 포함하세요:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

LLM은 해당 언어에 대한 학습 지식을 사용해 번역해요. `register`을 설정하면 어조, 격식, 정서법 관습을 제어할 수 있어요. 자세한 내용은 [구성](/docs/getting-started/configuration)을 참고하세요.

---

## Language Cards {#language-cards}

각 내장 언어에는 **Language Card**가 있어요 — `shared/language-cards/`에 있는 통합 JSON 파일로, 레지스터, 격식, 메서드 지원, 타이포그래피 규칙, 계보 분류, 언어적 과제, NLP 리소스 등 모든 메타데이터를 담고 있어요.

### 통합 카드 아키텍처

각 카드는 import 시 즉시 로드돼요. 별도의 참조 계층은 없어요 — 모든 데이터가 언어별로 하나의 파일에 들어 있어요. 카드는 권위 있는 출처에서 보강돼요:

| 출처 | 데이터 |
|--------|------|
| [Glottolog](https://glottolog.org) | 어족 분류, 계보 체인, Glottocode |
| [WALS](https://wals.info) | 속(genus) 분류, 유형론적 특징 |
| [CLDR](https://cldr.unicode.org) | 문자, 방향, 복수형 규칙, 타이포그래피 |
| [ISO 15924](https://unicode.org/iso15924/) | 문자 코드 |

### 주요 카드 필드

| 필드 | 포함 내용 |
|-------|------------------|
| **`nativeName`** | 내칭(endonym) — 해당 언어가 자체 문자로 스스로를 부르는 이름 (예: ქართული, Runasimi) |
| **`classification`** | 계보 앵커: Glottolog의 어족, 속, 전체 계보 체인 |
| **`contactInfluences`** | 보편적 접촉 역사 — 차용 계층, 상층, 하층 |
| **격식 체계** | T-V 구분, 화계, 경어, 종결사 등 |
| **레지스터 프리셋** | 해당 언어의 특성에 맞춘 명명된 LLM 프롬프트 프리셋 |
| **메서드 지원** | 이 언어를 지원하는 번역 API |
| **성 지침** | 문법적 성 규칙과 포용적 글쓰기 팁 |
| **문자/방향** | ISO 15924 문자 코드 및 RTL/LTR |
| **규칙** | 타이포그래피(인용 부호, 띄어쓰기), 대문자 표기, 복수형 범주 |
| **`glottocode`** | 상호 참조를 위한 표준 Glottolog 식별자 |
| **`dataSources`** | 출처 추적 (예: `["glottolog-5.3", "cldr-48"]`) |

### 새 Language Card 스캐폴딩

권위 있는 데이터 출처(IANA, CLDR, Glottolog)에서 카드를 스캐폴딩하려면 생성기를 사용하세요:

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

생성기는 메타데이터(코드, 문자, 방향, 복수형, 인용 부호, 메서드 지원, 분류)를 자동으로 채우고, 언어적 판단이 필요한 필드는 사람이 큐레이션하도록 TODO로 표시해요.

### 프리셋 키 사용하기

전체 레지스터 텍스트를 작성하는 대신, 프리셋 키 이름을 사용할 수 있어요:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion은 키를 전체 레지스터 프롬프트로 변환해요. 각 언어에 사용 가능한 프리셋을 확인하려면 `npx champollion init`을 실행하세요.

### 예시 프리셋

| 언어 | 프리셋 | 기본값 |
|----------|---------|--------|
| 프랑스어 | `formal-vous`, `casual-tu` | `formal-vous` |
| 한국어 | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| 일본어 | `polite`, `formal-keigo`, `casual` | `polite` |
| 독일어 | `formal-Sie`, `casual-du` | `formal-Sie` |
| 태국어 | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| 스페인어 | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

필드 검증 및 PR 체크리스트를 포함한 전체 사양은 [Language Card 기여하기](https://github.com/gamedaysuits/champollion)를 참고하세요.

---

## 참고 항목

- [구성](/docs/getting-started/configuration) — 언어 설정을 포함한 전체 구성 레퍼런스
- [번역 메서드](/docs/guides/translation-methods) — 각 메서드의 작동 방식
- [문자 변환기](/docs/concepts/script-converters) — 결정론적 문자 변환 파이프라인
- [인공 언어, 문자 및 정서법](/docs/guides/conlangs-scripts-orthography) — PUA 폰트, Unicode, 인공 언어 추가
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages) — 소외된 언어를 위한 메서드 구축
