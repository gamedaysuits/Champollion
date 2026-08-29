---
sidebar_position: 5
title: "저자원 언어 지원"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# 저자원 언어 지원하기

> **요약.** 저자원 및 포합어(polysynthetic languages)를 위한 기계 번역 구축에 대한 종합 가이드입니다. 이러한 언어가 어려운 이유(형태론적 복잡성, 희소 데이터, 환각 현상), 기존 컴퓨팅 리소스(ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), 10가지 이상의 접근 전략, champollion 코칭 시스템 및 평가 루프를 다룹니다. 소외된 언어를 위한 번역 방식을 기여하고 싶다면 여기서부터 시작하세요.

:::info[상태: 활발히 개발 중]
Plains Cree(nêhiyawêwin) 지원은 현재 개발 중입니다. 여기에 설명된 도구, 평가 하네스(evaluation harness) 및 리더보드는 실제 존재하며 오늘 바로 사용할 수 있지만, Cree 번역 파이프라인은 아직 출시되지 않았습니다. 출시가 완료되면, 이는 FST 인프라를 갖춘 다른 포합어 및 저자원 언어를 위한 청사진 역할을 할 것입니다.
:::

## 미해결 문제

Google의 Cloud Translation 서비스는 194개 언어를 지원합니다([Google의 공식 목록](https://docs.cloud.google.com/translate/docs/languages)). Meta의 OMT-1600(2026년 3월)은 1,600개 언어를 지원한다고 주장하며, 이는 지금까지 발표된 기계 번역(MT) 시스템 중 가장 큰 규모입니다. 하지만 롱테일에 속하는 약 1,200개의 언어(지원하는 1,600개 언어에서 저자들이 모델이 "충분히 잘 이해한다"고 보고한 400여 개 언어를 뺀 수치)의 경우, 품질이 사용 가능한 기준치에 미치지 못하고, 학습 데이터는 성경 텍스트가 지배적이며, 모델 가중치를 다운로드할 수 없고, 독립적인 평가나 커뮤니티 거버넌스 프레임워크가 없습니다. 나머지 약 5,400개 언어에 대해서는 사전 학습된 모델이 어떠한 결과물도 생성하지 못합니다.

상황은 크게 변했습니다. 이제 거대 기술 기업(Big Tech)들이 저자원 언어(LRL) 지원에 투자하고 있습니다. 하지만 지원 범위가 곧 품질을 의미하지는 않으며, 독립적인 검증 없는 품질은 신뢰할 수 없습니다. 저자원 언어에는 단순히 지원한다고 주장하는 모델 이상의 것이 필요합니다. 형태론적 검증을 동반한 독립적인 평가, 커뮤니티가 큐레이션한 말뭉치(corpora), 그리고 주권을 존중하는 거버넌스가 필요합니다.

**champollion은 이를 변화시키기 위해 만들어졌습니다.**

[Method Leaderboard](https://champollion.dev/leaderboard)는 공개적인 도전 과제입니다. 소외된 언어를 위한 최고의 번역 방식을 구축하고, 재현 가능한 평가를 통해 이를 증명하여 최고 점수를 획득해 보세요. 언어학자, 머신러닝 연구자, 커뮤니티 언어 작업자, 학생, 취미 개발자 등 전 세계 누구나 기여할 수 있습니다. 문제는 아직 해결되지 않았습니다. 인프라는 준비되어 있습니다. 리더보드가 여러분을 기다리고 있습니다.

---

## 이것이 어려운 이유: 포합어의 형태론

대부분의 상용 기계 번역 시스템은 영어, 프랑스어, 중국어와 같이 단어가 비교적 짧고 개별 토큰으로 문장이 구성되는 언어를 위해 설계되었습니다. 하지만 Plains Cree를 포함한 많은 원주민 언어는 **포합어(polysynthetic)**입니다. 즉, 영어로는 문장 전체로 표현해야 하는 내용을 단 하나의 단어에 담아낼 수 있습니다.

### Cree어 예시

다음 Plains Cree 단어를 살펴보세요.

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"내가 학교에 갔을 때"*

이것은 **하나의 단어**입니다. 여기에는 시제(과거), 방향(~로 가는), 어근(배우다), 태(수동/재귀), 인칭(1인칭 단수)이 모두 포함되어 있습니다. 주로 영어로 학습된 LLM은 이러한 형태론적 밀도에 대한 직관이 없습니다.

어려움은 가중됩니다.

| 과제 | 의미 |
|-----------|--------------|
| **형태론적 복잡성(Morphological complexity)** | 단일 동사 어근이 접두사, 접미사, 양분 접사(circumfixation)를 통해 수천 개의 유효한 굴절형을 생성할 수 있습니다. |
| **유정/무정 구분(Animate/inanimate distinction)** | 명사는 문법적으로 유정물(animate) 또는 무정물(inanimate)로 나뉘며, 이는 동사 활용, 지시 대명사, 복수형에 영향을 미칩니다. 이 분류가 항상 생물학적 유정성을 따르는 것은 아닙니다(*askiy* "지구"는 유정물이고, *maskisin* "신발"도 유정물입니다). |
| **회피어(Obviation)** | 3인칭 지칭은 근접성/현저성에 따라 순위가 매겨집니다. "근접어(proximate)"와 "회피어(obviative)"의 구분은 영어에는 없는 개념입니다. |
| **희소한 학습 데이터(Sparse training data)** | LLM은 Plains Cree 텍스트를 거의 접하지 못했습니다. 접한 데이터조차도 방언(Y-방언, TH-방언)이나 정서법(SRO 대 음절 문자)이 섞여 있을 수 있습니다. |
| **취약한 상용 베이스라인(Weak commercial baseline)** | OMT-1600은 성경 도메인 학습 및 표준 BPE 토큰화를 사용하여 CRK를 R1(매우 낮은 자원) 계층에 포함합니다. Google 번역은 Cree를 지원하지 않습니다. 형태론적 지표를 사용한 독립적인 평가가 있어야만 이러한 베이스라인이 의미를 가집니다. |

포합어 번역은 여전히 **미해결 연구 과제**로 남아 있습니다. OMT-1600은 포합어를 포함하고 있지만 형태론적 인식 없이 표준 BPE 토큰화(256K 어휘)를 사용하므로, 합성된 단어를 의미 없는 바이트 조각으로 잘게 부수어 버립니다.

---

## 선행 기술: 사람들이 이 문제에 접근한 방법

### ALTLab FST

Plains Cree를 위한 가장 중요한 컴퓨팅 리소스는 노르웨이 북극 대학교(UiT)의 [Giellatekno](https://giellatekno.uit.no/)와 협력하여 앨버타 대학교의 [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/)에서 개발한 **유한 상태 트랜스듀서(FST, finite-state transducer)**입니다.

ALTLab FST는 **형태소 분석기 및 생성기**입니다. 굴절된 Cree 단어가 주어지면 이를 어근과 문법 태그로 분해할 수 있으며, 어근과 태그가 주어지면 올바른 굴절형을 생성할 수 있습니다. 이는 결정론적(deterministic)으로 작동하며, 신경망이나 환각 현상, 확률에 의존하지 않습니다. FST가 어떤 단어를 허용한다면, 그 단어는 형태론적으로 유효한 것입니다.

이것이 바로 champollion 리더보드가 **FST 허용률(FST Acceptance Rate)**을 지표로 추적하는 이유입니다. FST가 거부하는 단어를 생성하는 번역 방식은 chrF++ 점수와 관계없이 형태론적으로 유효하지 않은 Cree를 생성하는 것입니다.

**주요 ALTLab 리소스:**
- [itwêwina](https://itwewina.altlab.app/) — FST로 구동되는 지능형 Plains Cree-영어 사전
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — 오픈 소스 형태소 인식 사전 플랫폼
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — Plains Cree 어휘 데이터베이스
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — 더 넓은 범위의 프로젝트 컨텍스트

### 글로벌 FST 및 형태론 레지스트리

고품질 FST 인프라를 갖춘 언어는 Plains Cree뿐만이 아닙니다. 다른 저자원 언어나 형태론적으로 복잡한 언어를 위한 번역 파이프라인을 개발하고 싶다면, 다음과 같이 확립된 글로벌 허브를 활용할 수 있습니다.

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (노르웨이 북극 대학교 UiT):** 100개 이상의 언어를 다루는 오픈 소스 FST 형태소 분석기 및 생성기의 최대 저장소입니다. 주요 대상 언어로는 사미어(Sámi languages)(`sme`, `smj`, `sma` 등), 우랄어(Komi, Erzya, Udmurt 등) 및 기타 소수/원주민 언어가 있습니다. 이들은 [GitHub Organization](https://github.com/giellalt/)에서 공개적으로 처리된 텍스트 말뭉치(`corpus-xxx`)를 호스팅합니다.
* **[The Apertium Project](https://www.apertium.org/):** 오픈 소스 규칙 기반 기계 번역 플랫폼입니다. Apertium은 튀르크어(카자흐어, 타타르어, 키르기스어 등) 및 유럽 소수 언어를 포함한 수십 개의 언어에 대해 고도로 최적화된 FST 형태소 분석기(`lttoolbox` 및 `hfst` 사용)와 이중 언어 사전을 유지 관리합니다. 모든 리소스는 [Apertium의 GitHub](https://github.com/apertium)에 공개되어 있습니다.
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** 150개 이상의 언어에 대한 표준화된 형태론적 패러다임을 제공하는 협업 프로젝트입니다. 데이터셋은 Hugging Face의 [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies)에서 호스팅됩니다. 특정 언어에 대해 컴파일된 FST 바이너리를 사용할 수 없는 경우, UniMorph 테이블을 정적 데이터베이스 조회 게이트로 사용할 수 있습니다.
* **[캐나다 국립 연구 위원회 (NRC)](https://nrc-digital-repository.canada.ca/):** **Uqailaut** 이누크티투트어 FST 형태소 분석기와 방대한 **Nunavut Hansard 병렬 말뭉치**(130만 개의 정렬된 영어-이누크티투트어 문장 쌍)를 포함하여 캐나다 원주민 언어를 위한 도구를 제공합니다.

### EdTeKLA 말뭉치

(마찬가지로 앨버타 대학교에 소속된) [EdTeKLA 연구 그룹](https://spaces.facsci.ualberta.ca/edtekla/)은 교육 자료, 오디오 전사 및 커뮤니티 출처를 바탕으로 Plains Cree 언어 말뭉치를 구축했습니다. champollion 평가 데이터셋인 [EDTeKLA Dev v1](/docs/network/leaderboard/datasets)은 이 작업에서 파생되었으며, [EdTeKLA의 수정된 CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora)(주권 범위 지정, 비상업적 조건)에 따라 게시되었습니다.

### 사람들이 시도했거나 시도할 수 있는 다른 접근 방식

리더보드는 특정 방식에 얽매이지 않습니다(method-agnostic). 다음은 저자원 기계 번역(MT)을 위해 탐구되거나 제안된 전략들이며, 이 중 어떤 것이든 제출할 수 있습니다.

| 접근 방식 | 작동 원리 | 장점 | 단점 |
|----------|-------------|------|------|
| **[코칭된 LLM 프롬프팅(Coached LLM prompting)](/docs/network/tutorials/coached-llm-prompting)** | 시스템 프롬프트에 문법 규칙, 사전, 예문 쌍을 주입합니다. | 빠른 반복 가능, 학습 불필요 | LLM의 기본 지식에 의해 품질 한계가 결정됨 |
| **[퓨샷 프롬프팅(Few-shot prompting)](/docs/network/tutorials/few-shot-prompting)** | 검증된 번역을 인컨텍스트(in-context) 예제로 포함합니다. | 일관된 스타일 유지에 유리함 | 작은 컨텍스트 창; 예제는 평가 데이터에서 가져오면 안 됨 |
| **[FST 게이트 파이프라인(FST-gated pipeline)](/docs/network/tutorials/fst-gated-pipeline)** | LLM 생성 → FST 검증 → 유효하지 않은 형태소 거부 및 재시도 | 형태론적 유효성 보장 | FST 인프라 필요; 재시도 루프로 인한 지연 시간 및 비용 증가 |
| **[사전 조회 + LLM(Dictionary lookup + LLM)](/docs/network/tutorials/dictionary-augmented-llm)** | 이중 언어 사전의 알려진 용어를 강제 적용하고, 나머지는 LLM이 처리하도록 합니다. | 알려진 용어에 대한 환각 현상 감소 | 사전 커버리지는 항상 불완전함 |
| **[파인튜닝된 모델(Fine-tuned model)](/docs/network/tutorials/fine-tuned-model)** | 병렬 텍스트(평가 데이터 제외)를 사용하여 오픈 모델(Llama, Mistral)을 파인튜닝합니다. | 잠재적으로 가장 높은 품질 | 병렬 말뭉치 필요(희소함); 비용이 많이 듦; 과적합 위험 |
| **[체인 모델(Chained models)](/docs/network/tutorials/chained-models)** | 모델 A가 대략적인 번역 생성 → 모델 B가 사후 편집 → 모델 C가 채점 | 전문가의 강점을 결합할 수 있음 | 복잡함; 느림; 비용이 많이 듦 |
| **[규칙 기반 + LLM 하이브리드(Rule-based + LLM hybrid)](/docs/network/tutorials/rule-based-hybrid)** | 알려진 패턴에는 언어학적 규칙을 사용하고, 나머지는 LLM을 사용합니다. | 규칙이 적용되는 곳에서는 정확함 | 깊은 언어학적 전문 지식 필요 |
| **[역번역 증강(Back-translation augmentation)](/docs/network/tutorials/back-translation)** | Cree→영어로 번역하여 합성 병렬 데이터를 생성한 다음, 그 반대로 학습시킵니다. | 저렴하게 학습 데이터 확장 | 기존 모델의 오류를 증폭시킴 |
| **[진화적 접근(Evolutionary approach)](/docs/network/tutorials/evolutionary-approach)** | 후보 번역을 생성하고, 점수를 매기고, 가장 성능이 좋은 것을 변형하는 과정을 반복합니다. | 새로운 솔루션 발견 가능; 병렬화 가능 | 계산 비용이 많이 듦; 좋은 적합도 함수(fitness function) 필요 |
| **[부분 번역(Partial translation)](/docs/network/tutorials/partial-translation)** | 대표 샘플을 수동으로 번역하고, 해당 방식이 스타일에 맞는지 증명한 다음, 나머지 대량의 데이터를 자동 번역합니다. | 인간의 품질과 기계의 확장성을 결합 | 초기 인력 투입 필요 |
| **수동 JSON / 시험 채점(Manual JSON / exam grading)** | 언어 시험에서 학생의 답안을 테스트하기 위해 데이터셋 JSON 파일을 수작업으로 만들거나, 골드 스탠다드(gold standard)를 기준으로 사람의 번역 배치를 채점합니다. | ML 불필요; 교육 및 QA에 적합 | 지속적인 번역 요구 사항으로 확장할 수 없음 |

### 단순한 JSON입니다

하네스는 JSON을 입력받아 JSON으로 점수를 출력합니다. [데이터셋 형식](/docs/network/leaderboard/datasets)은 간단합니다.

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

이를 수작업으로 구성할 수도 있고, 스프레드시트에서 내보낼 수도 있으며, 말뭉치에서 생성할 수도 있습니다. 언어 교사는 학생의 번역을 채점하는 데 사용할 수 있고, 번역 에이전시는 프리랜서를 벤치마킹하는 데 사용할 수 있으며, 연구소는 모델 아키텍처를 비교하는 데 사용할 수 있습니다. 하네스는 JSON의 출처를 따지지 않고 그저 점수를 매길 뿐입니다.

또한 프로덕션 배포 프레임워크가 동일한 플러그인 인터페이스를 사용하기 때문에, 하네스에서 좋은 점수를 받은 방식은 구성(config) 변경 한 번만으로 웹사이트에 배포할 수 있습니다. **증명하고 사용하세요.**

가능성은 그야말로 무궁무진합니다. **아이디어가 있다면 구축하고, 하네스를 실행하여 점수를 제출해 보세요.**

---

## champollion의 역할

champollion은 인프라 계층을 제공하며, 여러분은 번역 방식을 가져오면 됩니다.

### 코칭 시스템

champollion의 `llm-coached` 방식을 사용하면 언어학적 지식을 LLM 프롬프트에 직접 주입할 수 있습니다.

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

코칭 데이터는 `en:crk` 쌍에 대한 모든 LLM 프롬프트에 주입되어, 모델이 다른 방법으로는 얻을 수 없는 구조화된 언어학적 컨텍스트를 제공합니다. 전체 사양은 [코칭 데이터(Coaching Data)](https://champollion.dev/docs/concepts/coaching-data)를 참조하세요.

### 레지스터(Registers)

레지스터는 어조, 격식, 정서법 규칙을 조절하는 시스템 프롬프트의 일부입니다. champollion은 하나의 Plains Cree 레지스터를 기본으로 제공합니다.

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

구성(config)에서 이를 재정의하여 다양한 프롬프팅 전략을 실험해 볼 수 있습니다.

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

레지스터가 다르면 번역 스타일도 달라지며, 리더보드의 점수도 달라집니다. 각 제출물은 사용된 정확한 레지스터와 시스템 프롬프트를 ([실행 카드(run card)](/docs/network/specifications/run-card)에 SHA-256 해시로) 기록하므로 실험을 재현할 수 있습니다.

### 문자 변환(Script conversion)

Plains Cree는 **표준 로마자 정서법(SRO, Standard Roman Orthography)**과 **캐나다 원주민 음절 문자(Canadian Aboriginal Syllabics)**라는 두 가지 문자로 표기됩니다. champollion의 파이프라인은 다음과 같습니다.

1. LLM이 SRO로 번역합니다(라틴 문자 기반이므로 LLM이 더 잘 처리함).
2. 품질 게이트(Quality gate)가 SRO 출력물을 검증합니다.
3. 결정론적 변환기가 SRO → 음절 문자로 변환합니다.
4. 변환된 텍스트가 디스크에 기록됩니다.

변환기는 모든 SRO 발음 구별 기호(장모음의 경우 ê, î, ô, â)를 처리하고 이를 올바른 음절 문자에 매핑합니다. 기술적인 세부 사항은 [문자 변환기(Script Converters)](https://champollion.dev/docs/concepts/script-converters)를 참조하세요.

### 평가 루프

[평가 하네스(eval harness)](/docs/network/specifications/harness)는 평가 데이터셋에 대해 여러분의 방식을 실행하고 점수가 매겨진 [실행 카드(run card)](/docs/network/specifications/run-card)를 생성합니다.

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

`--name` 플래그는 여러분이 선택하는 레이블입니다. 이 레이블은 리더보드에 표시되어 사람들이 여러분이 어떤 프롬프트 전략을 사용했는지 볼 수 있게 해줍니다. 하네스는 실행 카드에 전체 시스템 프롬프트를 기록하므로, 여러분의 정확한 접근 방식을 재현할 수 있습니다.

:::tip[자유롭게 실험하고, 최고의 결과를 제출하세요]
하네스는 빠른 반복 작업을 위해 설계되었습니다. 다양한 모델, 코칭 데이터, 레지스터 및 조건을 사용하여 수십 번의 실험을 실행해 보세요. 자랑스럽게 내세울 만한 결과가 나왔을 때만 리더보드에 제출하세요.
:::

---

## 데이터 주권 원칙 {#data-sovereignty-principles}

champollion은 원주민 데이터 주권을 지원하도록 설계되었습니다. 언어 데이터에 대한 커뮤니티의 소유권, 통제권, 접근권, 점유권은 원주민 커뮤니티를 위한 언어 기술에 접근하는 방식을 안내합니다.

| 원칙 | champollion의 지원 방식 |
|-----------|------------------------|
| **소유권(Ownership)** | 언어 커뮤니티는 자신들의 언어 데이터에 대한 소유권을 가집니다. champollion은 절대 외부로 정보를 빼내거나 당사 서버로 데이터를 전송하지 않습니다. |
| **통제권(Control)** | [API 방식](https://champollion.dev/docs/guides/serving-a-method)을 통해 커뮤니티가 자체 번역 파이프라인을 호스팅할 수 있습니다. 우리는 인터페이스를 제공하고, 커뮤니티는 구현을 통제합니다. |
| **접근권(Access)** | 커뮤니티가 자신들의 방식을 사용할 수 있는 사람을 결정합니다. API는 인증을 통해 접근을 제한할 수 있습니다. |
| **점유권(Possession)** | 모든 번역 데이터는 프로젝트의 파일 시스템에 유지됩니다. [출처 시스템(provenance system)](https://champollion.dev/docs/concepts/security)은 모든 번역이 어디서 왔는지 추적합니다. |

플러그인 아키텍처를 통해 커뮤니티는 신성하거나 제한된 지식을 내부적으로 통합하는 방식을 구축하고, 번역 API만 노출하며, 자신들의 언어 리소스에 대한 완전한 통제권을 유지할 수 있습니다.

---

## 비전: 앞으로의 계획

Plains Cree가 첫 번째 목표입니다. 파이프라인이 검증되고 커뮤니티가 품질에 만족하게 되면, 동일한 아키텍처가 FST 인프라를 갖춘 다른 포합어로 확장됩니다.

- **기타 알곤킨어족(Algonquian languages)**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **이누이트어(Inuit languages)**: Inuktitut, Inuinnaqtun (이들 역시 음절 문자를 사용함)
- **기타 어족**: FST 분석기가 있는 모든 언어는 FST 게이트 파이프라인을 사용할 수 있습니다.

리더보드는 언어 쌍(language-pair)을 기준으로 합니다. 언어 커뮤니티에서 새로운 평가 데이터셋을 기여함에 따라 새로운 리더보드 트랙이 자동으로 열립니다.

**이것은 공개적인 초대장입니다.** 연구자, 커뮤니티 구성원, 학생 또는 단순히 관심을 가진 사람으로서 저자원 언어를 다루고 있다면, champollion은 실질적인 것을 구축하고, 정직하게 측정하며, 이를 세상과 공유할 수 있는 도구를 제공합니다. [Method Leaderboard](https://champollion.dev/leaderboard)가 여러분의 제출을 기다리고 있습니다.

---

## 참고 항목

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — 점수를 제출하고 방식들을 비교해 보세요.
- **[MT 평가(MT Evaluation)](/docs/network/leaderboard/rules)** — 좋은 방식의 기준과 실격 사유
- **[평가 하네스(Eval Harness)](/docs/network/specifications/harness)** — 실험 실행 방법
- **[평가 데이터셋(Evaluation Datasets)](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 및 FLORES+
- **[코칭 데이터(Coaching Data)](https://champollion.dev/docs/concepts/coaching-data)** — LLM을 위한 언어학적 지식 구조화 방법
- **[문자 변환기(Script Converters)](https://champollion.dev/docs/concepts/script-converters)** — SRO→음절 문자 파이프라인
- **[API를 통한 방식 제공(Serving a Method via API)](https://champollion.dev/docs/guides/serving-a-method)** — 커뮤니티가 통제하는 번역 호스팅
- **[ALTLab](https://altlab.ualberta.ca/)** — 앨버타 언어 기술 연구소(Alberta Language Technology Lab)
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — 교육 기술, 지식 및 언어 연구 그룹
- **[itwêwina 사전(itwêwina dictionary)](https://itwewina.altlab.app/)** — FST로 구동되는 Plains Cree-영어 사전
