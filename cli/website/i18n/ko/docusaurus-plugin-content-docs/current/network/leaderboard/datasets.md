---
sidebar_position: 3
title: "평가 데이터셋"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# 평가 데이터셋

> **요약.** 이 페이지는 벤치마킹에 사용할 수 있는 평가 데이터셋을 설명하며, 말뭉치(corpus) 항목 스키마, 난이도 등급(1~5), 출처 요구 사항을 포함하고 있어요. 카탈로그에는 **19개 말뭉치 제품군에 걸친 약 4,700개의 소스 가져오기(fetch-from-source) 평가 데이터셋**(TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, WMT newstest/General 블라인드 세트 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA)과 FLORES+가 있어요. 말뭉치 *콘텐츠*는 이곳에 직접 호스팅되지 않아요. 각 데이터셋은 고정된 업스트림 아카이브에서 결정론적으로 다시 빌드되는 sha-pinned 메타데이터 카드예요. **비상업적 / 연구 전용 레인(lane)**(Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k 및 WMT 연구용 세트)은 모든 상업적 / 상금 / API 경로에서 제외돼요. 이 레인 내에서 수정되었거나, 맞춤형이거나, 명시되지 않은 라이선스가 적용된 말뭉치는 추가로 **동의 기반 제한(consent-gated)**을 받아요. 라이선스 텍스트 자체에서 평가 목적의 사용을 허용하거나(WMT 연구용 세트처럼 데이터셋별 명시적 결정으로 기록됨) 권리자의 허가가 데이터셋 항목에 기록되어 있지 않으면 원격 모델 API 평가가 거부돼요. 두 개의 인간 큐레이션 참조 데이터셋인 EDTeKLA Dev v1(Plains Cree)과 FLORES+ Devtest(870개 카탈로그 언어 쌍, 각각 1,012개 문장)는 아래에 자세히 설명되어 있어요. EdTeKLA의 전체 항목 수 내역은 [해당 섹션](#edtekla-development-set-v1)에 한 번 명시되어 있어요.

데이터셋은 하니스(harness)가 실행 대상으로 삼는 고정된 타깃이에요. 각 데이터셋은 골드 스탠다드 참조가 포함된 소스→타깃 쌍이 담긴 JSON 파일이에요. 하니스는 이러한 참조를 기준으로 모델 출력을 채점하며, 참조를 절대 수정하지 않아요.

:::danger[평가 데이터로 학습하지 마세요]

⚠️ **이 데이터셋은 평가 전용이에요.** 평가 데이터로 학습, 파인튜닝, few-shot 프롬프팅되거나 그 외 방식으로 평가 데이터에 노출된 방법은 인위적으로 부풀려진 점수를 만들어내며 **리더보드에서 실격 처리돼요.**

학습에는 별도의 코퍼스를 사용하세요. 평가 세트는 개발 과정에서 모델에 노출되지 않은 상태로 유지되어야 해요.
:::

---

## 데이터셋 형식 {#dataset-format}

모든 데이터셋은 동일한 JSON 스키마를 따라요:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[표준 스키마]
[Benchmark Specification](/docs/network/specifications/benchmark)에서 표준 코퍼스 및 항목 스키마를 정의해요. 이 페이지에서는 사용 가능한 데이터셋과 새 데이터셋을 만드는 방법을 다뤄요.
:::

### 최상위 `dataset` 블록

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `id` | `string` | 고유 데이터셋 식별자(실행 카드 및 리더보드에서 사용) |
| `version` | `string` | 시맨틱 버전. 이 값을 올리면 이전 실행 카드 비교가 무효화돼요 |
| `language_pair` | `string` | 표시 레이블(예: `EN→CRK`) |
| `description` | `string` | 선택 사항. 사람이 읽을 수 있는 요약 |
| `source_language` | `string` | BCP 47 소스 언어 코드 |
| `target_language` | `string` | BCP 47 타깃 언어 코드 |
| `created` | `string` | ISO 8601 생성 날짜 |
| `license` | `string` | SPDX 라이선스 식별자 |
| `provenance` | `string[]` | 항목 전반에 사용된 출처 태그 목록 |

### 항목 필드

| 필드 | 타입 | 필수 | 설명 |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | 코퍼스 내 고유 항목 식별자 |
| `source` | `string` | ✅ | 번역할 소스 텍스트 |
| `reference` | `string` | ✅ | 골드 스탠다드 참조 번역 |
| `difficulty` | `integer` | ✅ | 난이도 등급 1~5(아래 참조) |
| `provenance` | `string` | ✅ | 이 항목의 출처(예: `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | 어투/격식 수준(예: `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | 소통 기능(예: `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | 사람 검토자를 위한 선택적 맥락 |
| `morphological_analysis` | `string` | ❌ | 골드 스탠다드 형태론적 분석 |
| `variant_class` | `string` | ❌ | 허용 가능한 번역 변형을 묶는 클래스 레이블 |

---

## 사용 가능한 데이터셋

카탈로그에는 **19개 말뭉치 제품군에 걸친 약 4,700개의 소스 가져오기 평가 데이터셋**과 아래에 자세히 설명된 두 개의 인간 큐레이션 참조 데이터셋(EDTeKLA + FLORES)이 포함되어 있으며, 2026년 7월 12일 기준으로 레지스트리에는 총 **5,602개의 데이터셋**이 있어요. 모든 말뭉치는 **sha-pinned 메타데이터 카드**예요. 말뭉치 콘텐츠는 이곳에 절대 호스팅되지 않으며, 평가 시점에 고정된 업스트림 아카이브에서 결정론적으로 다시 빌드돼요. 모든 데이터셋에는 `do_not_train`이(가) 포함되어 있어요. 하나의 소스 카드가 여러 언어 쌍별 데이터셋으로 분기되므로 레지스트리 총합은 약 1,417개의 소스 카드를 초과해요. 개방형 레인(open-lane) 데이터셋은 스윕 대기열(sweep queue)에 직접 공급돼요. 연구 전용 레인은 라이선스가 명확히 허용하는 경우에만 온디맨드로 실행돼요(수정/맞춤형/미명시 라이선스는 원격 모델 API 평가를 위해 동의 기반 제한을 받아요).

| 제품군 (Family) | 데이터셋 | 빌더 / 출처 | 라이선스 | 레인 (Lane) |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1,260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | 개방형 |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | 개방형 (HF 제한 다운로드) |
| **Tatoeba** | 874 | [Tatoeba community](https://tatoeba.org), Tatoeba Challenge 경유 | CC-BY-2.0 | 개방형 |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | 개방형 |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | 개방형 |
| **WMT newstest / General** (2014–2025 blind sets) | 178 | WMT (Conference on Machine Translation), sacreBLEU 경유 | `LicenseRef-WMT-Research-Use` | **연구용** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | 개방형 |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | 개방형 |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | 개방형 |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **비상업적 / 연구 전용** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | 개방형 (동일조건변경허락) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **연구 전용** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (공유 과제 주최자) | CC-BY-NC-SA-4.0 | **비상업적 / 연구 전용** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (주최자) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **연구 전용** |
| **Gamayun** | 8 | CLEAR Global (구 Translators without Borders) | `LicenseRef-TWB-Gamayun` | **비상업적 / 연구 전용** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **비상업적 / 연구 전용** |
| **EDTeKLA / prize** | 3 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **비상업적 / 연구 전용 (격리됨)** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **비상업적 / 연구 전용** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **비상업적 / 연구 전용** |

*(FLORES+ devtest — 카탈로그에 등록된 870개 쌍, CC-BY-SA-4.0 — 는 아래에서 자세히 다루는 참조
데이터셋으로, 레지스트리 총계를 5,602개로 만들어요.)*

:::info[비상업적 연구 전용 레인]
카탈로그의 대부분은 허용적인 라이선스(CC0, CC-BY-2.0/3.0/4.0, MIT, Apache-2.0)를 따르며 모든 레인에서 사용할 수 있어요. 소규모 세트인 **Gamayun**(TWB의 맞춤형 라이선스)과 **EDTeKLA**(수정된 주권 범위의 CC BY-NC-SA)는 **비상업적**이에요. 즉, 모든 상업적, 상금 또는 API 경로에서 제외돼요. 수정되었거나, 맞춤형이거나, 명시되지 않은 라이선스가 적용된 말뭉치의 경우, 원격 모델 API 평가는 추가로 **동의 기반 제한(consent-gated)**을 받아요. 라이선스 텍스트 자체에서 평가 목적의 사용을 허용하거나(데이터셋별 명시적 결정으로 기록되며, WMT 연구용 세트가 이에 해당해요) 권리자의 명시적 허가가 데이터셋 항목에 기록되어 있지 않으면, 테스트 하네스(harness)는 해당 텍스트를 타사 모델 API로 전송하는 것을 거부해요(로컬 평가는 여전히 가능해요). 자격 요건은 **사용 목적 기반**이에요. 상업적 레인은 엄격하고, 연구용 레인은 관대하며, 격리(quarantine)가 항상 우선 적용돼요(따라서 부적절한 EdTeKLA 슬라이스는 순위에 오를 수 없어요). 말뭉치가 레인을 선택하는 방법은 [말뭉치 등록 및 노출 레인](/docs/network/sovereignty/registering-corpora)을 참조하세요.
:::

참조 데이터셋은 아래에 자세히 설명돼 있어요. 계열 코퍼스는 동일한 JSON 스키마를 따르며 데이터셋 레지스트리에 나열돼 있어요.

:::note[카탈로그는 채워진 보드가 아니에요]
대규모 코퍼스 카탈로그는 어떤 방법을 벤치마킹할 *수 있는지*를 나타낼 뿐 —
결과로 가득 찬 리더보드가 아니에요. 보드 자체는 시딩 중이에요.
[리더보드 규칙](/docs/network/leaderboard/rules)과
[정직한 한계](/docs/network/honest-limitations)를 참조하세요.
:::

### EDTeKLA Development Set v1 {#edtekla-development-set-v1}

영어→Plains Cree (SRO) 번역을 위해 만들어진 첫 번째 평가 데이터셋이에요. University of Alberta의 [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/)이 제작했어요.

| 속성 | 값 |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **버전** | `1.0` |
| **언어 쌍** | EN → CRK (Plains Cree, SRO 정서법) |
| **항목 수** | 436개 항목의 개발(dev) 분할(`textbook_dev.json`). 체인: 업스트림의 589개 원시 정렬 줄 → 정규화/중복 제거 후 486개의 고유하고 유효한 쌍(Champollion 파생 수치) → 436개 개발용 + 50개 홀드아웃(Champollion의 결정론적 seed-42 분할 — EdTeKLA는 분할이 아닌 원시 파일을 게시해요). 별도의 62개 항목 골드 스탠다드 세트(수작업으로 큐레이션된 연구 전용이며 EdTeKLA 자료가 **아님**)를 더해 프로젝트의 전체 Plains Cree 평가 컬렉션은 548개가 돼요. |
| **난이도 분포** | 쉬움, 보통, 어려움 |
| **출처** | `gold_standard` (화자 검증 완료), `textbook` (출판된 교육 자료) |
| **라이선스** | [EdTeKLA의 수정된 CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — 주권 범위 지정됨. 루트 교재는 CC BY-NC-ND 4.0임) — **리더보드, 상금 및 상업적/API 레인에서 제외됨** (비상업적) |

> **이것은 Plains Cree 평가 세트 수치에 대한 공식적인 선언이에요.** 다른 페이지에서는 이를 다시 명시하지 않고 이곳으로 링크를 연결해요. 486/436/50이라는 수치는 EdTeKLA의 원시 정렬 파일에서 Champollion이 파생한 것이에요(EdTeKLA 자체는 수치나 분할을 게시하지 않아요). 62개 항목의 골드 스탠다드 세트는 EdTeKLA가 아닌 별도의 출처를 가지고 있어요. 위의 수치는 항상 해당 레인과 짝을 이뤄요. EdTeKLA는 수정된 주권 범위의 CC BY-NC-SA를 따르며 **리더보드, 상금 및 상업적/API 경로에서 제외돼요**.

**테스트 항목:**

- 기본 인사말과 자주 쓰는 표현
- 명사 유정성(animacy)과 obviation
- 인칭 및 시제 전반의 동사 활용
- 처격(locative) 구문
- 소유 패러다임
- 복잡한 문장 구조

:::tip[말뭉치 구조]
EdTeKLA 파생 자료는 공개 개발(dev) 세트와 홀드아웃 세트로 나뉘어요(EdTeKLA의 원시 교재 정렬을 Champollion이 분할한 것으로, 수치는 위 표에 있어요). 별도의 62개 항목 골드 스탠다드 세트는 다른 출처에서 수작업으로 큐레이션되었으며 EdTeKLA 말뭉치의 일부가 아니에요. 검증된 골드 스탠다드가 있는 작고 고품질인 데이터셋이 크고 노이즈가 많은 데이터셋보다 훨씬 유용해요. 특히 "적당히 비슷한" 번역이 형태론적으로 유효하지 않은 경우가 많은 저자원(low-resource) 언어에서는 더욱 그래요.
:::

---

## 새 데이터셋 만들기

새 언어 쌍이나 도메인을 위한 데이터셋을 만들려면:

### 1. JSON 구조화하기

[데이터셋 형식](#dataset-format) 스키마를 따르세요. 모든 항목에는 `source`, `reference`, `difficulty`, `provenance`, `register`, `context`가 있어야 해요.

### 2. 고유 ID 할당하기

설명적인 슬러그를 사용하세요: `{project}-{split}-v{version}` (예: `edtekla-dev-v1`, `quechua-test-v1`).

### 3. 골드 스탠다드 검증하기

모든 `reference` 값은 유창한 화자가 검증했거나 출판된 동료 심사(peer-reviewed) 자료에서 가져온 것이어야 해요. 기계 생성 참조는 평가의 목적을 무의미하게 만들어요.

### 4. 난이도 등급 설정하기

각 항목에 정수 난이도 수준을 할당하세요:

| 등급 | 설명 | 예시 |
|------|-------------|----------|
| 1 — 기본 어휘 | 단일 단어, 자주 쓰는 인사말, 숫자 | "hello" → "tânisi" |
| 2 — 단순 문장 | 주어-동사 또는 SVO, 현재 시제 | "I see the dog" |
| 3 — 중간 복잡도 | 과거/미래 시제, 소유, 유정성 | "I saw his dog yesterday" |
| 4 — 복잡한 형태론 | obviation, 수동태, conjunct order | "the woman whose son went to the store" |
| 5 — 고급 | 다중 절, 격식 어투, 의례적, 관용적 | 어투에 맞는 톤을 갖춘 완전한 단락 |

### 5. 출처 태그 지정하기

각 항목은 그것이 어디에서 왔는지 표시해야 해요. 일반적인 태그:

- `gold_standard` — 유창한 화자가 검증함
- `textbook` — 출판된 교육 자료에서 가져옴
- `elicited` — 구조화된 유도(elicitation) 세션을 통해 생성됨
- `corpus` — 병렬 코퍼스에서 추출됨

### 6. 파일 검증하기

JSON이 올바른 형식이고 모든 필수 필드가 존재하는지 확인하기 위해 임의의 모델로 데이터셋에 대해 하니스를 실행하세요:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

하니스는 누락된 필드, 중복된 인덱스, 스키마 위반 시 오류를 발생시켜요.

### 7. 포함 제출하기

[eval harness repository](https://github.com/gamedaysuits/Champollion)에 **소스 페치 방식(fetch-from-source) 메타데이터 카드** — 하니스를 상위 소스(로더/URL, SHA 고정, 라이선스, 출처)로 향하게 하는 레지스트리 항목 — 를 추가하는 풀 리퀘스트를 여세요. **코퍼스 콘텐츠 자체는 절대 커밋하지 마세요.** Champollion은 제3자 코퍼스 텍스트를 호스팅하거나 추적하지 않아요. 하니스는 실행 시점에 상위 소스로부터 참조를 페치하고 새로 페치한 데이터를 기준으로 채점해요. 먼저 로컬에서 검증한 뒤(6단계), 카드만 제출하세요. 검증 방법론과 출처에 대한 문서를 포함하세요.

---

## FLORES+ Devtest

[Open Language Data Initiative (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus)가 관리하는 폭넓은 커버리지의 다국어 벤치마크예요. champollion의 다중 모델 프런티어 비교에 사용돼요.

| 속성 | 값 |
|----------|-------|
| **ID** | 쌍당 하나의 카드: `eval-flores-devtest-v1-<src>-<tgt>` (예: `eval-flores-devtest-v1-amh-fra`) |
| **언어 쌍** | 카탈로그화되고 실행 가능한 870개 쌍(그중 812개는 비영어 두 언어 간) |
| **항목 수** | 쌍당 1,012개 문장 |
| **라이선스** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **소스** | Meta FLORES-200, 현재 OLDI 관리 — 소스에서 페치, 쌍별 SHA 고정(코퍼스 콘텐츠는 여기에서 추적되지 않음) |
| **오염** | **높음** — 상대 비교 전용, 테스트 / 예시 전용(참고 참조) |

:::warning[오염도 HIGH — 상대적 용도만, 절대 벤치마크로는 절대 사용 금지]
FLORES+는 공개된 웹 크롤링 데이터로, 프런티어 모델들이 이미 접했을 가능성이 매우
높아요. Champollion은 이를 **상대적 용도만** 허용하는 레인에서 실행해요: 방법 간
직접 비교에는 사용할 수 있지만, **절대적 품질 점수로는 절대 보고되지 않으며**, [번역 지도](https://champollion.dev)에서
**체인 엣지로도 절대 사용되지 않아요**.
이는 **테스트와 예시 용도로만** 사용해요.
:::

:::danger[평가 전용]
FLORES+는 오직 평가 목적으로만 사용해요. 큐레이터는 이를 **학습 데이터로 사용하지 말 것**을 명시적으로 요청해요. 이 콘텐츠가 모든 학습 코퍼스에서 제외되도록 하세요.
:::

---

## 참고 항목

- [MT Evaluation](/docs/network/leaderboard/rules) — 평가 프레임워크와 리더보드 개요
- [Eval Harness](/docs/network/specifications/harness) — 이러한 데이터셋에 대해 평가를 실행하는 방법
- [Run Card Specification](/docs/network/specifications/run-card) — 결과 기록을 위한 JSON 스키마
- [Method Leaderboard](https://champollion.dev/leaderboard) — 실시간 벤치마크 점수
- [EdTeKLA Project](https://spaces.facsci.ualberta.ca/edtekla/) — Cree 데이터셋을 만든 University of Alberta 연구 그룹
