---
title: "언어 카드 인용 절차"
sidebar_label: "Citation Procedure"
---

# 언어 카드 인용 절차

*Champollion이 언어 카드의 모든 주장을 1차 출처까지 추적할 수 있도록 보장하는 방법.*

---

## 1. 문제점

언어 카드에는 사실에 기반한 주장 — 화자 수, 위기 상태, 접촉 영향, 형태론적 속성, 표기 관례, 메서드 지원 — 이 담겨 있으며, 이는 **반드시 검증 가능해야 해요**. 현재 상태는 다음과 같아요:

- `dataSources` 필드는 문자열의 단순 배열이에요 (예: `["cldr-48", "glottolog-5.3"]`)
- 필드별 인용 세분화가 없어요
- "약 280만 명의 화자"나 "취약함" 같은 주장에는 추적 가능한 출처가 없어요
- 검토자가 어떤 출처가 어떤 주장을 뒷받침하는지 판단할 수 없어요

> [!CAUTION]
> **출처가 없는 주장은 검증할 수 없는 주장이에요.** 전문적 엄격함을 표방하는 프로젝트에서는 언어 카드의 모든 단언이 특정하고 버전이 명시된 1차 출처까지 추적 가능해야 해요.

---

## 2. 권위 있는 출처 (우선순위순)

각 유형의 주장에 대해 다음 출처가 권위가 있어요. **항상 사용 가능한 가장 높은 순위의 출처를 우선시하세요.**

### 분류 및 식별

| 우선순위 | 출처 | 다루는 범위 | 라이선스 | 인용 방법 |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | 어족, 계통, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | ISO 코드, 거대언어 | 무료 | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | 속(genus) 정의, 유형론적 특징 | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | 로케일 코드, 문자 코드, 복수형 규칙 | Unicode ToS | `cldr-{version}` |

### 화자 인구 통계 및 활력도

| 우선순위 | 출처 | 다루는 범위 | 라이선스 | 인용 방법 |
|---|---|---|---|---|
| 1 | 국가 인구조사 데이터 | 공식 화자 수 | 다양함 (대개 공개) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | 화자 추정치, EGIDS | 독점 (구독제) | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | 위기 상태 | 무료 | `unesco-atlas-{year}` |
| 4 | 출판된 학술 논문 | 지역별 화자 조사 | 논문별 라이선스 | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | 필리핀 언어 | 학술 | `katig-{year}` |

> [!WARNING]
> **인구 통계 주장의 1차 출처로 Wikipedia, LLM이 생성한 텍스트, 또는 자기 지식을 절대 사용하지 마세요.** 이들은 잘해야 2차/3차 출처에 불과해요. 항상 1차 데이터까지 거슬러 추적하세요.

### 메서드 지원 (번역 API 커버리지)

| 메서드 | 검증 출처 | 검증 방법 | 인용 방법 |
|---|---|---|---|
| Google Translate | [언어 목록](https://cloud.google.com/translate/docs/languages) | API 호출 또는 문서 페이지 | `google-translate-{date}` |
| DeepL | [언어 목록](https://www.deepl.com/docs-api/translate-text/) | API 호출 | `deepl-api-{date}` |
| Microsoft Translator | [언어 목록](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | 문서 페이지 | `ms-translator-{date}` |
| LibreTranslate | [언어 목록](https://libretranslate.com/languages) | API 호출 | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + 모델 카드 | `nllb-200-{date}` |
| LLM | 항상 `true` | 해당 없음 (품질이 다양함) | `llm-assumed` |

### DLS (Digital Language Support)

| 우선순위 | 출처 | 다루는 범위 | 인용 방법 |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | DLS 점수 (원본 143개 도구) | `simons-2022` |
| 2 | Ethnologue 27판 이상 | DLS 점수 (확장된 211개 도구) | `ethnologue-{edition}-dls` |

### 표기, 복수형, 문자

| 우선순위 | 출처 | 다루는 범위 | 인용 방법 |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | 복수형 규칙, 인용 부호, 숫자 서식 | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | 문자 코드 | `iso15924-{date}` |
| 3 | 출판된 문법서 | 언어별 규칙 | `{author}-{year}` |

### 접촉 영향

| 우선순위 | 출처 | 다루는 범위 | 인용 방법 |
|---|---|---|---|
| 1 | 출판된 역사언어학 논문 | 차용어 연구, 접촉 역사 | `{author}-{year}` |
| 2 | 참조 문법서 | 구조적 영향 설명 | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | 유형론적 비교 | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **접촉 영향 주장은 출처를 찾기가 가장 어려워요.** "스페인어 상층(superstrate), 깊음, 1571–1898" 같은 주장에는 역사언어학 전문 지식이 필요해요. 출판된 출처를 찾을 수 없다면 추측하지 말고 해당 주장에 `"citation_needed": true`로 표시하세요.

---

## 3. 인용 절차 (단계별)

### 새 언어 카드를 만들 때

1. **자동으로 채워지는 필드부터 시작하세요:**
   - `node scripts/build-language-tree.mjs --enrich` 실행 → Glottolog에서 `classification`를 채워요
   - `dataSources`에 `"glottolog-{version}"`를 기록하세요

2. **CLDR 데이터를 추가하세요:**
   - CLDR에서 복수형 규칙, 인용 부호, 문자 코드를 조회하세요
   - `dataSources`에 `"cldr-{version}"`를 기록하세요

3. **화자 인구 통계를 조사하세요:**
   - 국가 인구조사 데이터를 가장 먼저 확인하세요
   - Ethnologue와 교차 참조하세요 (가능한 경우)
   - UNESCO Atlas와 교차 참조하세요
   - 참고한 모든 출처를 `dataSources`에 기록하세요

4. **메서드 지원을 검증하세요:**
   - 각 API의 언어 목록을 확인하세요 (기억이나 추측이 아니라)
   - 검증 날짜를 기록하세요

5. **접촉 영향을 조사하세요:**
   - 출판된 역사언어학 논문을 찾으세요
   - 인용과 함께 시기, 유형, 깊이를 문서화하세요
   - 출판된 출처가 없다면 영향 항목에 `"citation_needed": true`를 추가하세요

6. **활력도를 조사하세요:**
   - EGIDS를 위해 Ethnologue를 확인하세요
   - 위기 상태를 위해 UNESCO Atlas를 확인하세요
   - 출처 간 불일치가 있으면 기록하세요

7. **`dataSources`를 채우세요:**
   - 참고한 모든 출처를 나열하세요 (데이터를 제공한 것뿐만 아니라)
   - 위 표의 인용 형식을 사용하세요

### 기존 카드를 업데이트할 때

1. **`dataSources`를 업데이트하지 않고 사실 주장을 절대 변경하지 마세요**
2. **화자 수를 업데이트하는 경우**, 기존 출처를 제거하고 새 출처를 추가하세요
3. **메서드 지원을 추가하는 경우**, API와 대조하여 검증하고 날짜를 기록하세요
4. **모든 메서드 지원 확인에 날짜를 기록하세요** — API 커버리지는 자주 바뀌어요

---

## 4. 제안된 스키마 개선: 필드별 인용

### 현재 스키마 (단순 `dataSources`)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**문제점:** 어떤 필드가 CLDR에서 왔나요? 어떤 것이 Glottolog에서 왔나요? 어떤 것이 출처가 없나요?

### 제안된 개선: 구조화된 `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### 마이그레이션 경로

이것은 **하위 호환성이 있는** 변경이에요:
1. 기존 카드는 단순 배열을 유지해요 (여전히 유효함)
2. 새 카드는 구조화된 형식을 사용해요
3. 스키마 검증은 두 형식을 모두 허용해요
4. 기존 카드는 검토될 때 점진적으로 마이그레이션하세요

> [!TIP]
> **스크립트로 검증하세요.** 다음을 수행하는 `validate-citations.mjs` 스크립트를 추가하세요:
> - 모든 카드에 최소한 `classification`와 `vitality` 출처가 있는지 확인해요
> - 단순 `dataSources` 배열이 있는 카드를 업그레이드 대상으로 표시해요
> - 날짜가 기록된 검증이 없는 `methodSupport` 항목에 대해 경고해요

---

## 5. 품질 체크리스트

언어 카드 변경을 병합하기 전에 다음을 확인하세요:

- [ ] 모든 화자 수에 출처가 있나요 (Wikipedia가 아니라 인구조사 또는 Ethnologue)
- [ ] 모든 UNESCO/EGIDS 상태에 출처가 있나요
- [ ] 모든 메서드 지원 플래그가 실제 API와 대조하여 검증되었나요 (추측이 아니라)
- [ ] 모든 접촉 영향에 출판된 학술 출처가 있거나 `citation_needed`로 표시되어 있나요
- [ ] 분류가 Glottolog에서 자동으로 채워졌나요 (수작업이 아니라)
- [ ] `dataSources`가 참고한 모든 출처를 나열하나요
- [ ] LLM이 생성한 지식에만 의존하는 주장이 없나요
- [ ] 원어민이 검토한 경우 `humanReviewed`가 검토자의 식별자와 날짜로 설정되어 있나요

---

## 6. `humanReviewed` 필드

언어 카드 스키마에는 현재 모든 카드에서 `null`인 `humanReviewed` 필드가 포함되어 있어요. 이 필드는 원어민이나 자격을 갖춘 언어학자가 카드를 검토할 때 채워야 해요:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **커뮤니티 검토가 최고의 기준이에요.** 자동화된 데이터와 학술 논문이 토대를 제공하지만, 원어민의 검토가 최종 검증이에요. 이는 특히 다음의 경우에 매우 중요해요:
> - 접촉 영향 주장 (커뮤니티 구성원은 어떤 차용어가 실제로 사용되는지 알아요)
> - 활력도 평가 (커뮤니티 구성원은 아이들이 그 언어를 말하는지 알아요)
> - 격식 체계 (학술적 설명은 일상적 사용 양상을 놓칠 수 있어요)

---

## 7. 이 절차에 대한 참고 문헌

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — 무료
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode 이용 약관
5. Ethnologue: https://www.ethnologue.com — 독점 (구독제)
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — 무료
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Language Card Spec: `cli/website/docs/reference/language-card-spec.md`
