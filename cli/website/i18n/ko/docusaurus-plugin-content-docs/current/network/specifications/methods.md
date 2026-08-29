---
sidebar_position: 4
title: "메서드 인터페이스"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# 공유 메서드 인터페이스

> **핵심 요약.** 이 페이지는 모든 Network 메서드가 구현해야 하는 `TranslationMethod` 프로토콜, 여섯 가지 메서드 클래스(`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), *메서드가 어떻게 번역하는지*를 시스템 간에 비교 가능하게 만드는 직교적 **패러다임** 축(`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …), 메서드 플러그인 형식, 그리고 메서드가 평가 샌드박스에서 실행되어 상금 대상이 될 수 있는지를 결정하는 **의존성 클래스**(S/O/A1/A2/X)를 규정해요. 이는 서로 독립적인 세 개의 축이에요. 이 프로토콜을 구현하는 어떤 접근 방식이든 벤치마킹할 수 있으며, 무엇에 의존하는지가 어디에서 경쟁할 수 있는지를 결정해요.

평가 하네스와 champollion은 **번역 메서드**라는 공통 개념을 공유해요. 메서드란 소스 텍스트를 받아 번역된 텍스트를 생성하는 모든 절차를 말하며, 직접적인 LLM 호출이든, 다단계 파이프라인이든, 서드파티 API든, 인간 번역가든 상관없어요.

## 아키텍처

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

`--method path/to/dir`를 통해 로드돼요. 하네스는 어떤 것도 자동으로 발견하지 않아요.

## 두 시스템, 하나의 인터페이스

| | 평가 하네스 | champollion |
|---|---|---|
| **언어** | Python | Node.js |
| **진입점** | `translate.py` | `translate.js` |
| **인터페이스** | `TranslationMethod` 프로토콜 | `methodPlugin` 설정 |
| **목적** | 점수 산정을 포함한 배치 평가 | dev/CI에서의 실시간 현지화 |
| **출력** | 지표가 포함된 실행 카드 | 번역된 로케일 파일 |

두 시스템을 모두 지원하는 메서드는 두 개의 진입점을 제공해요 — 각 언어 런타임마다 하나씩이에요. **메서드 카드**가 그 다리 역할을 해요: 두 시스템이 모두 이해하는 형식으로 메서드를 설명해요.

## 메서드 카드 {#method-card}

메서드 카드는 전체 시스템 프롬프트와 같은 독점적인 세부 사항을 드러내지 않으면서 번역 메서드가 *무엇인지*를 설명해요. 다음 질문에 답해요:

- 이것은 어떤 클래스의 메서드인가요? (raw LLM, coached LLM, pipeline, API 등)
- 어떤 **패러다임**을 사용하나요? (rule-based, statistical, neural-nmt, llm, hybrid)
- 어떤 도구를 사용하나요? (FST 분석기, 사전 등)
- 구현이 오픈 소스인가요?
- 어떤 언어 쌍을 지원하나요?

전체 JSON 스키마는 [메서드 카드 스펙](/docs/network/specifications/methods#method-card)을 참조하세요.

### 예시

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

`dependency_class` 필드는 메서드가 실행하고 이전하는 데 필요한 것을 요약해요 — 아래 [메서드 유효성 및 의존성 클래스](#method-validity-and-dependency-classes)를 참조하세요. `paradigm` 필드는 메서드를 **패러다임 축** 위에 배치해요(여기서는 `hybrid`: rule-based FST로 게이팅된 LLM) — 아래 [패러다임](#paradigms)을 참조하세요.

### 메서드 클래스

| 클래스 | 설명 |
|-------|-------------|
| `raw-llm` | 최소한의 지시로 직접 LLM 호출 |
| `coached-llm` | 구조화된 프롬프트, 예시, 제약이 있는 LLM |
| `pipeline` | 결정론적 구성 요소를 포함한 다단계 파이프라인 |
| `custom-plugin` | `TranslationMethod` 프로토콜을 구현하는 외부 프로세스 |
| `api` | 서드파티 번역 API (Google Translate, DeepL 등) |
| `human` | 인간 번역 (기준선 확립용) |

### 패러다임 {#paradigms}

**패러다임**은 세 번째의 독립적인 축이에요: *메서드가 알고리즘 수준에서 어떻게 번역하는지*를 나타내요. 이는 메서드 클래스와 의존성 클래스 모두와 직교해요. 메서드 클래스만으로는 LLM 중심적이에요 — rule-based [Apertium](https://www.apertium.org/) 시스템과 Google Translate 모두 `pipeline`/`api`에 속하므로, 패러다임 없이는 "rule-based 대 neural"이 보이지 않아요. 패러다임 축은 그 비교를 리더보드에서 일급으로 취급하고 필터링할 수 있게 만들어요.

| 패러다임 | 설명 | 예시 |
|----------|-------------|----------|
| `rule-based` | 유한 상태 변환기, 수작업 문법, 형태론적 전이 | Apertium, GiellaLT FST 생성 |
| `statistical` | 병렬 코퍼스에서 학습된 구문 기반/통계적 MT (SMT) | 고전적인 Moses |
| `neural-nmt` | 전용 신경망 인코더–디코더 MT 모델 | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | 번역하도록 프롬프트된 범용 대규모 언어 모델 | raw 또는 coached GPT / Claude / Gemini 호출 |
| `hybrid` | 하나의 메서드에서 둘 이상의 패러다임을 결합 | rule-based FST로 게이팅된 LLM (crk-translate); NMT + rule-based 후편집 |
| `human` | 인간 번역 (패러다임 수준의 기준선) | 커뮤니티 번역가 기준선 |
| `unknown` | 미지정 — 카드가 패러다임을 선언하지 않음 | 패러다임 이전 카드에 대한 하위 호환 기본값 |

이 축들은 독립적이에요. 몇 가지 실례를 들면:

| 메서드 | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (self-hosted, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-gated, LLM-coached) | `pipeline` | `hybrid` | A2 |
| Raw GPT call | `raw-llm` | `llm` | A1 |

패러다임은 메서드 카드에서 **선택 사항**이에요; 패러다임이 없으면 `unknown`으로 기록돼요(패러다임은 게시를 절대 막지 않아요 — 이 축은 추가적이에요). 위의 열거형은 표준적이고 지원되는 어휘이며, 하네스(`config.VALID_PARADIGMS`)에 의해 강제돼요. 강제가 데이터베이스 제약이 아니라 앱 측에서 이루어지기 때문에, 새로운 패러다임은 마이그레이션 없이 나중에 추가할 수 있어요; 메서드가 어떤 값에 의존하게 된 후에 그 값의 이름을 바꾸거나 제거하는 것만이 비용이 커요.

## 메서드 유효성 및 의존성 클래스 {#method-validity-and-dependency-classes}

메서드는 가장 덜 이용 가능한 의존성만큼만 실행 가능하고, 이전 가능해요. 두 개의 Network 메커니즘이 메서드가 정확히 무엇을 필요로 하는지 아는 것에 의존해요:

1. **샌드박스 평가** ([벤치마크 스펙 §8.2](/docs/network/specifications/benchmark)) — 공식 골드 스탠다드 점수는 네트워크 정책이 **기본 거부**인 샌드박스에서 나와요. 외부 서비스를 조용히 요구하는 메서드는 공식 점수를 생성할 수 없어요.
2. **상금 이전** ([상금 스펙](/docs/network/specifications/prizes)) — 상금을 받은 메서드는 언어 커뮤니티의 거버넌스 조직으로 이전돼요. 제출자가 포함할 권리가 없는 콘텐츠를 번들로 묶은 메서드는 합법적으로 이전될 수 없어요. 제출자는 박스 안의 모든 것에 대한 권리를 보유하거나 부여받아야 해요.

두 검사 모두를 임시방편이 아니라 기계적으로 만들기 위해, 모든 메서드는 `method.json`의 **의존성 매니페스트**에서 파생된 **의존성 클래스**를 선언해요.

> **명명에 관한 참고 — 세 개의 독립적인 축.** *메서드 클래스*(위 §: `raw-llm`, `pipeline`, …)는 메서드의 *형태*를 설명해요 — 제시하는 인터페이스 계약이에요. *패러다임*([§패러다임](#paradigms): `rule-based`, `neural-nmt`, `llm`, …)은 *알고리즘적으로 어떻게 번역하는지*를 설명해요. *의존성 클래스*(이 섹션)는 *실행하고 이전하는 데 무엇이 필요한지*를 설명해요. 이 셋은 직교해요: `pipeline` 메서드는 `rule-based`이거나 `hybrid`일 수 있고, 어떤 의존성 클래스든 될 수 있어요. (클래스와 패러다임이 의도적으로 분리된 이유는 클래스만으로는 LLM 중심적이기 때문이에요 — rule-based 시스템과 neural 시스템이 모두 `pipeline` 또는 `api`으로 제시될 때 이 둘을 구별할 수 없어요.)

### 다섯 가지 의존성 클래스

| 클래스 | 이름 | 정의 | 샌드박스 실행 가능? | 상금 대상? |
|-------|------|-----------|-------------------|-----------------|
| **S** | 자기 완결형 | 모든 코드, 데이터, 모델, 가중치가 메서드 디렉터리 안에 재배포 및 커뮤니티 이전을 허용하는 라이선스로 포함돼요. | ✅ 예, 그대로 | ✅ 예 |
| **O** | 오픈 외부 | 재배포를 허용하는 오픈 라이선스(AGPL과 같은 카피레프트 라이선스 포함)로 외부에 호스팅된 아티팩트에 의존해요 — 예: 설치 시 다운로드되는 FST. | ✅ 예 — 아티팩트는 고정되어 **제출물에 미러링돼요** | ✅ 예, 라이선스 호환성 조건 하에: 카피레프트 조건은 이전을 통해 보존되며, 커뮤니티는 라이선스가 모두에게 부여하는 것과 동일한 권리를 받아요 |
| **A1** | API 의존, 대체 가능 | 런타임 LLM 추론을 요구하며, 모델이 **대체 가능한 설정**이에요 — 충분히 유능한 어떤 모델이든 끼워 넣을 수 있어요. 메서드의 가치는 프롬프트, 코칭 데이터, 코드에 있지, 특정 제공자의 모델에 있지 않아요. | ⚠️ 샌드박스 스펙이 정의하는 **LLM 게이트웨이**를 통해서만 (🔲 계획됨 — 아래 참조) | ⚠️ 조건부 — 아래 참조 |
| **A2** | API 의존, 대체 불가능 | 미러링하거나 대체할 수 없는 외부 데이터 또는 서비스 API에 대한 런타임 호출을 요구해요 — 일반적으로 제공되는 콘텐츠가 독점적이거나 라이선스가 없기 때문이에요 (예: 기반 사전에 공개 라이선스가 없는 사전 API). | ❌ 아니요 — 권리 소유자의 허가 없이는 의존성이 샌드박스에 존재할 수 없어요 | ❌ 권리 소유자가 샌드박스 포함 **및** 이전 권한을 부여하기 전까지는 안 돼요. 눈에 보이는 **"외부 의존성"** 플래그와 함께 오픈(개발 세그먼트) 리더보드에서는 허용돼요 |
| **X** | 폐쇄형 | 제출자가 재배포할 권리가 없는 콘텐츠를 번들로 묶어요 — 라이선스 없는 데이터셋, 스크랩된 독점 콘텐츠, 라이선스 비호환 구성 요소. | ❌ | ❌ 모든 레인에서 허용되지 않아요. 권리 없이 콘텐츠를 번들로 묶는 것은 메서드가 어디에서 실행되든 라이선스 위반이에요 |

**유효 클래스.** 메서드의 의존성 클래스는 S < O < A1 < A2 < X 순서로 선언된 모든 의존성 중 *가장 제한적인* 클래스예요. 라이선스 없는 사전 하나가 그렇지 않았다면 자기 완결형이었을 파이프라인을 클래스 A2(런타임에 접근하는 경우) 또는 클래스 X(권리 없이 번들로 묶는 경우)로 만들어요.

### A1/A2 구분: 대체 가능성

대부분의 메서드는 LLM을 호출해요. Network는 그것을 부인하지 않아요 — 하지만 두 가지 매우 다른 종류의 API 의존성을 구분해요:

- **A1 (대체 가능):** API가 범용 LLM 추론을 제공해요. 모델 식별자는 설정이에요: 메서드는 커뮤니티가 호스팅하는 오픈 웨이트 모델을 포함하여 호환되는 모든 추론 엔드포인트에 대해 처음부터 끝까지 실행되어야 해요. 출력 품질은 모델마다 다를 수 있어요 — 그것은 개발자의 위험이며, 공식 점수는 평가에 사용된 고정 모델에 연결돼요. **제공자 측 상태**(제공자에서만 호스팅되는 파인튜닝, 제공자 파일 저장소, 제공자 특화 어시스턴트)에 의존하는 메서드는 대체 가능하지 *않아요*: 그 상태는 빼낼 수 없으므로, 기반 가중치나 데이터가 제출물에 포함되지 않는 한 그 의존성은 A2예요.
- **A2 (대체 불가능):** API가 고유한 것을 제공해요 — 일반적으로 독점적이거나 라이선스 없는 데이터예요. 어떤 대체 엔드포인트도 그것을 제공할 수 없으며, 권리 소유자의 허가 없이는 콘텐츠를 샌드박스에 미러링할 수 없어요. 메서드는 오픈 리더보드에서 작동하지만(플래그 표시됨), 권한이 존재하기 전까지는 공식 샌드박스 점수를 생성하거나 상금 대상이 될 수 없어요.

**A1 상금 이전이 실제로 전달하는 것.** 커뮤니티는 모델을 받지 않아요 — 아무도 Anthropic, Google, OpenAI의 가중치를 이전할 수 없어요. 이전은 모델 *주변*의 완전한 레시피를 포함해요: 모든 프롬프트, 코칭 데이터, 파이프라인 코드, 재시도 로직, 설정, 그리고 문서화된 모델 요구 사항이에요. 모델은 구성상 대체 가능하기 때문에, 커뮤니티는 개발자의 관여 없이 이전된 메서드를 그들이 선택한 어떤 제공자로든 — 또는 그들 자신의 하드웨어에 있는 오픈 웨이트 모델로 — 향하게 할 수 있어요. 레시피는 소유되고, 엔진은 임대되며 교체 가능해요.

### 의존성 매니페스트 (`method.json`)

모든 메서드는 `method.json` 매니페스트에서 그 의존성을 선언해요. 각 항목은 아티팩트가 무엇인지, 어디서 오는지, 어떤 라이선스가 적용되는지, 메서드가 어떻게 접근하는지를 기록해요:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `id` | ✅ | 의존성에 대한 안정적인 식별자 |
| `kind` | ✅ | `data`, `model`, `software`, 또는 `service` |
| `license` | ✅ | SPDX 식별자, `proprietary`, 또는 `none`. `none`는 공개 라이선스가 없음을 의미해요 — 모든 권리 보유로 취급돼요 |
| `access` | ✅ | `bundled` (메서드 디렉터리에 포함), `mirrored` (설치 시 가져와서 고정하고 제출물에 벤더링), `gateway` (평가 게이트웨이를 통한 런타임 LLM 추론), `external-api` (기타 모든 런타임 네트워크 호출) |
| `source` | ✅ | 표준 URL 또는 `provider:slug` 식별자 |
| `pin` | `mirrored`에 대해 | 정확한 아티팩트를 고정하는 버전, 커밋, 또는 콘텐츠 해시 |
| `substitutable` | `gateway`/`external-api`에 대해 | 호환되는 어떤 엔드포인트든 이 의존성을 제공할 수 있는지 여부 |
| `redistributable` | ✅ | 라이선스가 아티팩트의 재배포를 허용하는지 여부 |
| `transferable` | ✅ | 아티팩트(또는 그에 대한 권리)가 상금 이전 조건 하에 커뮤니티로 전달될 수 있는지 여부 |
| `notes` | ❌ | 자유 형식 컨텍스트 |

**클래스 파생.** 각 의존성은 클래스를 기여하며; 메서드의 `dependency_class`는 가장 제한적인 것이에요:

| 의존성 프로필 | 기여 |
|--------------------|-------------|
| `bundled` + 재배포 및 이전을 허용하는 라이선스 | S |
| `mirrored` + 재배포를 허용하는 오픈 라이선스(카피레프트 포함) | O |
| `gateway` + `substitutable: true` (LLM 추론) | A1 |
| `external-api`, 또는 `substitutable: false`를 포함한 `gateway` | A2 |
| `bundled` + `license: none` 또는 재배포 비호환 라이선스 | X |

선언된 `dependency_class`는 하네스가 매니페스트에서 파생한 클래스와 일치해야 해요. 불일치는 유효성 검사 오류예요.

외부 의존성이 **없는** 메서드는 `"dependency_class": "S"`과 `"dependencies": []`을 선언해요. 빈 배열은 다른 것과 마찬가지로 감사되는 명시적인 진술이에요.

### 유효성 검증 방법

가장 저렴한 것부터 가장 권위 있는 것까지 세 개의 계층:

1. **매니페스트 감사.** 하네스는 매니페스트에서 유효 클래스를 파생하고 불일치를 거부해요. 검토자는 선언된 각 의존성을 명시된 라이선스와 소스에 대조해 확인해요 — 상위 라이선스가 그렇지 않다고 말하는데 `redistributable: true`로 선언된 의존성은 검토에 실패해요.
2. **정적 분석.** 제출된 코드는 매니페스트가 설명하지 않는 네트워크 호출, 동적 다운로드, 파일시스템 접근에 대해 스캔돼요. 검토에서 발견된 *선언되지 않은* 의존성은 그것이 어떤 클래스였을지와 상관없이 거부 사유예요 — 매니페스트는 정확할 뿐만 아니라 완전해야 해요.
3. **샌드박스 네트워크 정책.** 샌드박스 스펙은 **기본 거부 이그레스**를 요구해요: 메서드 컨테이너는 경로가 명시적으로 허용 목록에 추가되지 않는 한 네트워크 접근을 받지 못해요. 스펙이 정의하는 유일한 이그레스 경로는 **LLM 게이트웨이**예요 — 평가 인프라가 운영하는 추론 프록시로, 고정된 모델의 명시적 허용 목록으로 제한되며, 실행 후 감사를 위해 모든 요청과 응답이 로깅돼요. 허용 목록에 없는 것은 정책 계층이 아니라 네트워크 계층에서 실패해요. 네트워크 정책과 게이트웨이 설계는 [벤치마크 스펙 §8.6](/docs/network/specifications/benchmark)을 참조하세요.

> **두 가지 서로 다른 샌드박스 — 하나는 계획 중, 하나는 운영 중.** "샌드박스"라는 단어는 서로 구별되는 두 가지를 아우르므로 이 부분을 주의 깊게 읽어 주세요:
>
> - 🔲 **계획 중: 플랫폼 샌드박스와 그 LLM 게이트웨이.** 이 섹션에서 설명하는 평가 인프라 운영 환경 — 즉 Class A1 메서드가 공식 골드 스탠다드 점수를 생성할 수 있도록 하는 LLM 게이트웨이를 갖춘 환경 — 은 명세는 되어 있지만 아직 구축되지 않았어요. 구축되기 전까지 Class A1 메서드는 *원칙적으로는* 상금 대상이지만 아직 공식 골드 스탠다드 점수를 생성할 수 없어요.
> - ✅ **운영 중: 주최자 노드 메서드 실행 레인.** 콘테스트 주최자 자신의 채점 노드는 이미 네트워크 격리 컨테이너(`mt-eval node run-method`) 내에서 제안된 메서드 번들을 실행해요: `--network=none`로 빌드 및 실행되고, 읽기 전용 루트, 벤더링된 의존성 — 이는 런타임 네트워크가 필요 없는 메서드(설계상 Class S/O)로 제한돼요. 서명된 점수 전용 번들을 이동식 미디어로 전달하는 완전 에어갭 머신에서 실행할 수 있어요. 전체 경로는 [주권적 콘테스트 운영하기](/docs/network/sovereignty/run-a-sovereign-contest)를 참고하세요.
>
> 이 섹션은 플랫폼 명세가 요구하는 내용을 설명하며, 현재 플랫폼에서 실제로 실행되는 내용을 설명하는 것이 아니에요.

### 리더보드 표시

- 리더보드는 각 메서드의 의존성 클래스를 메서드 클래스 배지와 함께 표시해요.
- 오픈 리더보드의 클래스 A2 메서드는 눈에 보이는 **"외부 의존성"** 플래그를 지녀요: 그 점수는 변경되거나 사라질 수 있는 서드파티 서비스에 의존하며, 현재는 상금 대상이 아니에요.
- 클래스 X 메서드는 나열되지 않아요.

## 평가 하네스: TranslationMethod 프로토콜 {#eval-harness-translationmethod-protocol}

평가 하네스는 플러그인에 Python의 구조적 타이핑(`Protocol`)을 사용해요. 올바른 멤버를 가진 클래스라면 어떤 것이든 동작하며 — 상속은 필요 없어요. 프로토콜은 단지 `translate`만이 아니라 **세 개**의 필수 멤버를 가져요:

1. **`name`** (`str`) — 사람이 읽을 수 있는 메서드 이름으로, 실행 ID와 로그에 사용돼요.
2. **`method_card()`** (`-> dict | None`) — 출처 추적을 위한 메서드 메타데이터로, 실행 로그와 게시되는 실행 카드에 포함돼요. 메서드에 카드가 없으면 `None`을 반환하세요.
3. **`async translate(entries, config)`** (`-> list[dict]`) — 번역 그 자체: 엔트리 배치가 들어가고, 엔트리당 하나의 결과 dict가 나와요.

하네스가 `--method path/to/dir`를 통해 플러그인을 로드할 때, `translate`이 호출 가능한지 검증한 다음 `method.name`를 읽고 조건 없이 `method.method_card()`를 호출해요 — 둘 중 하나라도 없는 플러그인은 우아하게 실패하는 것이 아니라 로드 시점에 충돌해요.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

플러그인 디렉터리에는 최소한 `name`과 `entry_point`을 포함하는 `method.json` 매니페스트가 필요해요(`"module_name:ClassName"` — 모듈은 플러그인 디렉터리에서 로드되고 클래스가 인스턴스화돼요). 반환된 메서드 카드가 `class` 또는 `paradigm`을 선언하는 경우, 위의 표준 어휘를 사용해야 해요 — 분류 체계를 벗어난 카드는 리더보드의 필터에서 조용히 제외되는 것이 아니라 로드 시점에 검증에 실패해요.

전체 작동 예제 — 플러그인을 빌드하고, 실행하고, 제출하는 전 과정 — 는 [메서드 제출하기](/docs/network/getting-started/submit-a-method)와 [FST-Gated 파이프라인 쿡북](/docs/network/tutorials/fst-gated-pipeline)을 참고하세요.

## champollion: methodPlugin 설정

champollion에서는 메서드가 `champollion.config.json`에서 언어 쌍별로 등록돼요:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

champollion 측 인터페이스는 [플러그인 스펙](https://champollion.dev/docs/reference/plugin-spec)을 참조하세요.

## 리더보드 통합

메서드 카드가 (`--method-card`을 통해) 실행에 연결되면, 실행 카드에 임베드되어 리더보드에 표시돼요:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

`--method-card`가 제공되지 않으면, `mt-eval publish`는 메서드를 설명하는 과정을 안내하는 인터랙티브 마법사를 실행해요.

리더보드는 다음을 표시해요:
- **클래스 배지** — 시각적 표시기 (예: "pipeline", "coached-llm")
- **패러다임** — 알고리즘적 패러다임 (예: "rule-based", "neural-nmt", "llm", "hybrid"), 필터링 가능한 열 ([패러다임](#paradigms) 참조)
- **의존성 클래스** — S/O/A1/A2 ([메서드 유효성 및 의존성 클래스](#method-validity-and-dependency-classes) 참조); A2 메서드는 "외부 의존성" 플래그를 지녀요
- **메서드 이름** — 메서드 카드에서
- **사용된 도구** — 메서드 카드에서 나열됨
- **오픈 소스 표시기**

메서드 카드가 연결되지 않으면, 리더보드는 하네스 네이티브 설정(모델, 프롬프트 버전, 온도, 활성화된 도구)을 표시해요.

:::danger[평가 데이터로 학습하지 마세요]
개발 과정에서 평가 데이터셋에 — 학습 데이터, few-shot 예제, 사전 항목, 또는 프롬프트 튜닝 자료로 — 노출된 메서드는 리더보드에서 **실격**돼요. 좋은 메서드와 나쁜 메서드를 구별하는 기준은 [MT 평가](/docs/network/leaderboard/rules)를 참고하세요.
:::

---

## 함께 보기

- [MT 평가](/docs/network/leaderboard/rules) — 개요, 리더보드 가치, 좋고 나쁜 메서드 가이드
- [평가 하네스](/docs/network/specifications/harness) — 평가 실행 방법
- [평가 데이터셋](/docs/network/leaderboard/datasets) — 이용 가능한 데이터셋 (EDTeKLA, FLORES+)
- [실행 카드 스펙](/docs/network/specifications/run-card) — 실행 카드 JSON 스키마
- [플러그인 스펙](https://champollion.dev/docs/reference/plugin-spec) — champollion 측 플러그인 인터페이스
- [메서드 리더보드](https://champollion.dev/leaderboard) — 실시간 벤치마크 점수
- [벤치마크 스펙](/docs/network/specifications/benchmark) — 평가 프로토콜, 코퍼스 형식, 실행 카드 스키마
- [점수 산정 스펙](/docs/network/specifications/scoring) — 지표, 복합 가중치, 품질 등급에 대한 SSOT
