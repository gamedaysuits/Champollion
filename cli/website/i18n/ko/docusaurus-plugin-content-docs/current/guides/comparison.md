---
sidebar_position: 7
title: "비교"
---

# Champollion 비교

champollion은 대부분의 로컬라이제이션 도구와는 다른 범주에 속해요. 솔직한 비교를 소개해 드릴게요.

## 전체 지형

대부분의 로컬라이제이션 도구는 다음 세 가지 범주 중 하나에 속해요:

| 범주 | 예시 | 모델 |
|----------|----------|-------|
| **클라우드 TMS 플랫폼** | Crowdin, Phrase, Locize, Tolgee | SaaS 대시보드 + 인간 번역가 + 월 구독료 |
| **키 추출 도구** | i18next-scanner, FormatJS CLI | 소스 코드에서 번역 함수 호출을 스캔 |
| **CLI 번역 엔진** | **champollion** | 프로젝트 내에서 실행하여 파일을 직접 번역, 클라우드 계정 불필요 |

Champollion은 **CLI 번역 엔진**이에요 — 구성 가능한 백엔드(LLM, Google Translate, 커스텀 플러그인)를 사용해 로케일 파일을 직접 번역해요. 클라우드 대시보드도, 인간 번역가 워크플로도, 월 요금도 없어요.

---

## 기능 비교

| 기능 | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **로컬 실행 (클라우드 계정 불필요)** | ✅ | ❌ | ❌ | ❌ |
| **최소한의 의존성** | ✅ | ❌ | ❌ | ❌ |
| **언어 쌍별 번역 방식 설정** | ✅ | ❌ | ❌ | ❌ |
| **사용자 정의 언어 사용역** | ✅ | ❌ | ❌ | ❌ |
| **콘텐츠 인식 (코드 블록 보호)** | ✅ | ❌ | ❌ | ❌ |
| **인공어 및 문자 변환** | ✅ | ❌ | ❌ | ❌ |
| **플러그인 아키텍처** | ✅ | ❌ | ❌ | ❌ |
| **Markdown / 콘텐츠 번역** | ✅ | ✅ | ✅ | ❌ |
| **번역 메모리** | ✅ | ✅ | ✅ | ✅ |
| **XLIFF 내보내기/가져오기** | ✅ | ✅ | ✅ | ❌ |
| **ICU 복수형 유효성 검사** | ✅ | ✅ | ✅ | ❌ |
| **용어집 적용** | ✅ | ✅ | ✅ | ❌ |
| **인간 번역가 워크플로우** | XLIFF 기반 | ✅ | ✅ | ✅ |
| **문맥 내 편집 (시각적)** | ❌ | ✅ | ✅ | ✅ |
| **팀 협업** | ❌ | ✅ | ✅ | ✅ |
| **지원하는 파일 형식** | JSON, TOML, YAML, MD, XLIFF | 50개 이상 | 40개 이상 | JSON |
| **가격** | 비상업적 용도로 무료 (LLM 비용은 직접 지불해요) | 월 $0부터 | 월 $0부터 | 월 $0부터 |

---

## Champollion을 사용해야 할 때

**Champollion이 적합한 경우:**

- 별도의 워크플로가 아니라 빌드 파이프라인에 통합된 기계 번역을 원할 때
- 언어별 방식 제어가 필요할 때 (일부는 LLM, 일부는 Google Translate, 나머지는 커스텀 플러그인)
- API 지원이 없는 언어로 번역할 때 (원주민 언어, 소멸 위기 언어, 인공어)
- 결정론적 문자 출력을 원할 때 (Cree Syllabics, Klingon pIqaD, Tengwar)
- 벤더 종속성과 클라우드 의존성이 전혀 없기를 원할 때
- 전체 TMS 대시보드가 필요 없는 1인 개발자나 소규모 팀일 때
- 클라우드 구독 없이 XLIFF 기반으로 전문 번역가에게 작업을 넘기고 싶을 때

**클라우드 TMS가 더 적합한 경우:**

- 모든 문자열을 검토하는 전문 인간 번역가가 있을 때 (champollion의 XLIFF 워크플로는 전체 TMS보다 단순해요)
- 프로젝트 간 번역 메모리 및 용어집 관리가 필요할 때
- 인컨텍스트 시각 편집이 필요할 때 (UI 내에서 번역 미리보기)
- 역할 기반 접근 제어가 필요한 대규모 팀일 때
- 50개 이상의 파일 형식 지원이 필요할 때

---

## Champollion만이 하는 일

### 1. 커스텀 레지스터

모든 언어 쌍에 대해 LLM에 문화적으로 적절한 어조 지침을 제공해요:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

47개의 사전 구성된 언어 레지스터를 함께 제공하거나, 프로젝트별로 커스텀 레지스터를 정의할 수 있게 하는 도구는 다른 어디에도 없어요.

### 2. 결정론적 문자 변환기

Champollion은 번역 후 훅으로 실행되는 5개의 내장 문자 변환기를 제공해요 — LLM이 필요 없어요:

| 로케일 | 변환 | 예시 |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillic | `Beograd` → `Београд` |
| `tlh` | Romanization → pIqaD | `tlhIngan Hol` → (pIqaD 글리프) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latin → Kryptonian | 암호 치환 (폰트 필요) |

이들은 순수 룩업 테이블 변환기예요 — 결정론적이고, 감사 가능하며, LLM 환각 위험이 전혀 없어요.

### 3. 콘텐츠 인식 보호

Markdown이나 리치 콘텐츠를 번역할 때 Champollion은 다음을 보호해요:

- 울타리 코드 블록 (` ``` `)
- 인라인 코드 (`` ` ` ``)
- Hugo 숏코드 (`{{</* */>}}`, `{{%/* */%}}`)
- 보간 변수 (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- 원시 HTML 블록

이들은 번역 전에 유니코드 센티널 토큰으로 대체되었다가 이후에 복원돼요. LLM은 여러분의 코드, 숏코드, 변수를 절대 보지 못해요.

### 4. 코칭 방식 플러그인

API 지원이 없는 언어의 경우, 코칭 번역 방식을 구축할 수 있어요:

1. 언어학적 코칭 데이터(문법 규칙, 어휘, 예시)를 작성해요
2. 이를 플러그인으로 번들링해요
3. [평가 하네스](https://github.com/gamedaysuits/Champollion)를 사용해 참조 번역과 비교하여 벤치마크해요
4. `champollion plugin install`으로 프로젝트에 설치해요

이것이 champollion이 Plains Cree를 처리하는 방식이며 — 아직 존재하지 않는 언어를 포함해 어떤 언어든 처리할 수 있는 방법이에요.

---

## 결론

Champollion은 Crowdin을 대체하는 도구가 아니에요. 다른 워크플로를 위한 다른 도구예요. 인간 번역가가 필요하다면 TMS를 사용하세요. 명령어 하나로 파일을 번역하고 방식, 모델, 레지스터에 대한 언어별 제어를 제공하는 CLI가 필요하다면 — champollion을 사용하세요.
