---
sidebar_position: 2
title: "자주 묻는 질문"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# 자주 묻는 질문

> **핵심 요약.** Champollion Network에 관한 일반적인 질문에 대한 답변입니다 — 채점 방식, 실격 사유, FST가 없는 언어를 다루는 방법, 모델 및 파라미터 권장 사항, 제출 절차 등을 다룹니다.

---

## 채점 및 지표

### 하네스는 어떤 지표를 계산하나요?

하네스는 다섯 가지 지표를 계산해요. 그중 세 가지는 언어에 종속되지 않아 어떤 언어 쌍에도 적용되고, 나머지 두 가지는 현재 CRK 전용 플러그인에 의존하지만 더 많은 언어로 확장하면서 일반화할 예정이에요. 오늘날 실행 가능한 참조 코퍼스는 오픈 라이선스 공개 세트예요 — Global Voices, Tatoeba, TICO-19, IN22, SMOL 등이 있고 ([Datasets](/docs/network/leaderboard/datasets) 참고) — 리더보드는 등록된 모든 언어 쌍에 대해 제출을 받고 있어요. Plains Cree는 단지 두 가지 언어별(FST 기반) 지표가 처음으로 구현된 곳일 뿐이에요.

| 지표 | 척도 | 측정 대상 | 상태 |
|--------|-------|-----------------|--------|
| **chrF++** | 0–100 | 예측 번역과 참조 번역 간의 문자 n-gram 중복도. 형태론적으로 풍부한 언어에 대한 최고의 표면 지표. sacrebleu의 기본 채점을 사용. | ✅ 모든 언어 |
| **완전 일치** | 0.0–1.0 | 정규화 후 예측이 참조와 정확히 일치하는 항목의 비율. | ✅ 모든 언어 |
| **FST 수용** | 0.0–1.0 | 유한 상태 트랜스듀서(형태소 분석기)가 수용하는 출력 단어의 비율. FST 바이너리가 제공될 때만 계산됨. | ✅ FST가 있는 모든 언어 |
| **동등 일치** | 0.0–1.0 | 참조 또는 허용 가능한 변형과 일치하는 항목의 비율 — 어순, 정서법 관행, 방언 차이를 고려함. | ⚡ CRK (일반화 중) |
| **의미 점수** | 0.0–1.0 | 의미 보존 점수 — 표면 형태와 무관하게 번역이 의도된 의미를 얼마나 잘 포착하는가? | ⚡ CRK (일반화 중) |

추가 지표도 계획되어 있어요: **형태론적 정확도**, **코드 스위칭 탐지**, **용어 준수**, **환각 탐지**. 전체 지표 목록(여섯 개 범주)은 [Scoring Specification §2](/docs/network/specifications/scoring#2-metric-inventory)를 참조하세요.

### 종합 점수는 어떻게 계산되나요?

종합 점수는 사용 가능한 지표들의 가중 평균이며, 0.0–1.0 척도로 정규화돼요. 가중치는 두 가지 프로필로 정의돼요:

- **프로필 A** (FST가 있는 언어): 9개 지표, 구조적 지표(FST + 형태론적 정확도)가 종합 가중치의 40%를 차지
- **프로필 B** (FST가 없는 언어): 8개 지표, 의미 및 chrF++가 동일하게 최상위 가중치를 차지

지표를 사용할 수 없을 때는 해당 가중치가 나머지 지표에 비례적으로 재분배돼요. 이는 초기 단계 벤치마크(chrF++와 완전 일치만 사용 가능한 경우)도 여전히 유효한 종합 점수를 산출한다는 의미예요 — 유효 가중치가 사용 가능한 것을 반영할 뿐이에요.

**전체 가중치 표, 정규화 규칙, 제외 근거는 [Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score)에 있어요.** 하네스 코드는 `mt_eval_harness/scoring.py`에서 이 표들을 반영해요. chrF++는 가중치 적용 전에 100으로 나누어 정규화되며, 코드 스위칭 및 환각 비율은 반전돼요(낮을수록 좋음).

### 품질 등급이란 무엇인가요?

품질 등급은 종합 점수 범위에 매핑된 휴리스틱 라벨이에요. 점수가 실질적으로 *무엇을 의미하는지* 전달하는 데 도움을 줘요:

| 등급 | 종합 점수 범위 | 해석 |
|------|----------------|------|
| **Baseline** | 0.00 – 0.30 | 유용한 품질 미만. 방법에 상당한 개선이 필요함. |
| **Emerging** | 0.30 – 0.50 | 가능성을 보임. 일부 번역은 정확하지만 일관성이 없음. |
| **Functional** | 0.50 – 0.70 | 사람의 검토를 거쳐 참조용으로 사용 가능. 검토 없는 배포에는 부적합. |
| **Deployable** | 0.70 – 0.85 | 주기적 검토와 함께 프로덕션 사용 준비 완료. 소유권 이전 자격을 발동함. |
| **Fluent** | 0.85 – 1.00 | 원어민에 가까운 품질. 감독 없는 배포에 적합. |

### 품질 등급과 검증 등급의 차이는 무엇인가요?

**품질 등급**은 *자동 점수가 무엇을 의미하는지*를 설명해요(Baseline → Fluent). **검증 등급**은 *누가 결과를 검증했는지*를 설명해요:

| 검증 등급 | 의미 |
|-------------------|---------------|
| **자체 벤치마크(Self-benchmarked)** | 제출자가 직접 하네스(harness)를 실행했어요. 점수는 타당해 보이지만 검증되지는 않았어요. |
| **Champollion 검증됨(Champollion Verified)** | 메인테이너가 제출된 메서드 구성을 사용하여 결과를 재현했어요. |
| **커뮤니티 검증됨(Community Validated)** | 커뮤니티 자체 프로토콜에 따라 자격을 갖춘 대상 언어의 이중 언어 구사자가 출력의 층화 표본(항목 30개 이상, 리뷰어 2명 이상)을 검토했으며, 70% 이상이 커뮤니티 기준을 충족했어요. 커뮤니티 자체 테스트를 통해서만 부여되며, 불시 감사(spot-audit)에 의한 등급 강등 또한 동일하게 공개적으로 이루어져요. |

어떤 방법은 "Deployable" 품질이지만 검증은 "Self-benchmarked"에 불과할 수 있어요 — 즉 점수는 훌륭해 보이지만 아무도 독립적으로 확인하지 않았다는 의미예요.

---

## 제출 및 실격

### 무엇이 제출을 실격시키나요?

다음의 경우 제출이 거부되거나 플래그가 지정돼요:

1. **방법이 평가 데이터에 노출된 경우.** 평가 데이터셋의 항목을 학습, 파인튜닝, few-shot 프롬프팅하거나 그 외의 방식으로 사용했다면, 점수가 인위적으로 부풀려져요. 여기에는 프롬프트에서 참조 번역을 사용하는 것도 포함돼요.
2. **런 카드가 무결성 검사를 통과하지 못한 경우.** 지문(fingerprint)이 구성과 일치해야 해요. 변조된 런 카드는 거부돼요.
3. **방법이 TranslationMethod 프로토콜을 구현하지 않은 경우.** 하네스는 `translate(entries, config) → results`를 기대해요. 하네스를 우회하는 커스텀 통합은 허용되지 않아요.

### 여러 번 제출할 수 있나요?

네. 리더보드는 모든 제출을 추적해요. 반복할 수 있어요 — 수십 가지 실험을 실행하고 최고의 것만 제출하세요. 각 제출은 고유한 지문을 기록하므로, 어떤 실행이 어떤 점수를 산출했는지에 대한 모호함이 없어요.

### 점수를 어떻게 검증받나요?

1. **자체 벤치마크 (자동):** 모든 제출은 여기서 시작해요.
2. **Champollion 검증됨 (자동):** 서버가 하네스 지표를 사용하여 SHA로 고정된(sha-pinned) 참조 말뭉치와 제출된 출력을 비교해 점수를 다시 매겨요. 점수가 재현되면 해당 실행은 Champollion 검증됨으로 승급되며, 이는 리더보드에서 순위를 매기는 유일한 등급이에요. 재현되지 않거나 저장된 참조가 변경된 경우 해당 실행은 실격 처리돼요.
3. **커뮤니티 검증됨:** 커뮤니티 자체 프로토콜에 따라 자격을 갖춘 대상 언어의 이중 언어 구사자가 메서드 출력의 층화 표본(최소 30개 항목, 최소 2명의 리뷰어)을 검토하며, 최소 70%가 커뮤니티 기준을 충족해야 해요. 이 등급은 커뮤니티가 재량에 따라 자체적으로 실행한 테스트를 통해서만 부여되며, 동일한 방식으로 취소될 수 있어요. 즉, 불시 감사에 실패하면 해당 메서드는 동일하게 공개적으로 강등돼요. 이 과정은 자동화할 수 없으며 커뮤니티의 참여가 필요해요.

### 왜 모든 사람의 메서드를 다시 실행하여 검증하지 않나요?

그럴 여력도 없고 그럴 필요도 없기 때문이에요. 서버는 *모든 사람*이 제출한 출력의 점수를 무료로 다시 매겨요(이를 통해 직접 입력하거나 조작한 점수를 잡아내요). 모델을 실제로 다시 실행하는 데는 실제 컴퓨팅 리소스가 소모되므로, **평판 가중치 감사(reputation-weighted auditing)**로 선택된 **표본(sample)**에 대해서만 실행해요. 위험도가 높거나(전체 어족으로 연결되는 첫 번째 다리를 놓는 경우) 이례적인 경우(이전 최고 기록을 믿기 힘들 정도로 뛰어넘는 경우)에는 항상 다시 실행하며, 검증된 기여자의 실행은 드물게 불시 점검(spot-check)만 진행해요. 평판은 이러한 감사를 통과하거나(또는 독립적인 기여자가 결과를 확증하는 경우에만) 얻을 수 있으며, 제출량으로는 절대 얻을 수 없어요. 따라서 새로 만든 일회성 계정은 아무런 이득을 얻지 못해요. 조작이 한 번이라도 적발되면 기여자의 평판은 0이 되고, 검증된 전체 기록을 다시 감사하며, 논문 철회처럼 공개적으로 기록돼요. 서버에서 검증할 수 없는 자체 호스팅 컴퓨팅의 경우, 제출된 실행이 "하네스를 통과했다"고 주장하지 **않아요**. 따라서 유효성은 증명(attestation)이 아니라 *재현성 + 평판 지분 + 확증(reproducibility + reputation stake + corroboration)*에 달려 있어요. 전체 모델에 대한 자세한 내용은 [기계 번역(MT) 평가 규칙](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing)을 참조하세요.

### 제출 API가 가동 중인가요?

아직이에요. `https://champollion.dev/api/leaderboard/submit` 엔드포인트는 지향점이에요. 현재 제출 경로는 `mt-eval publish`예요 — 하네스 출력 디렉터리(`eval/logs/harness/`)의 run card를 리더보드에 *self-benchmarked (unverified)* 상태로 바로 업로드해요.

---

## 모델 및 파라미터

### 어떤 모델을 사용해야 하나요?

단 하나의 최고 모델은 없어요 — 언어 쌍, 예산, 접근 방식에 따라 달라져요. 일반적인 지침은 다음과 같아요:

| 언어 유형 | 권장 시작점 | 이유 |
|---------------|---------------------------|-----|
| **고자원** (프랑스어, 스페인어, 일본어) | `google/gemini-2.5-flash` 또는 `gpt-4o-mini` | 빠르고, 저렴하며, 강력한 기준선 |
| **일부 LLM 지원이 있는 저자원** (케추아어, 요루바어) | `google/gemini-2.5-pro` 또는 `anthropic/claude-sonnet-4` | 더 큰 모델은 더 나은 잠재 지식을 보유 |
| **다합성어 / 초저자원** (Plains Cree, Inuktitut) | 코칭을 적용한 `google/gemini-2.5-pro` | 코칭 데이터가 모델 선택보다 더 중요함. OMT-1600은 일부 다합성어 언어(예: R1 등급의 CRK)를 포함하지만 표준 BPE 토큰화를 사용함 — Network에서 기준선으로 벤치마크하세요. |

평가 하네스는 OpenRouter를 사용하므로, OpenRouter에서 사용 가능한 모든 모델을 벤치마크할 수 있어요. 사용 가능한 목록은 [openrouter.ai/models](https://openrouter.ai/models)를 참고하세요.

### 어떤 온도(temperature)를 사용해야 하나요?

번역에는 일반적으로 낮을수록 좋아요:

| 온도 | 효과 | 권장 대상 |
|-------------|--------|-----------------|
| **0.0 – 0.2** | 매우 결정론적이고 일관된 출력 | 프로덕션 방법, 최종 벤치마크 |
| **0.3 – 0.5** | 약간의 변동, 때때로 더 창의적 | 탐색, 초기 반복 |
| **0.6+** | 높은 변동, 예측 불가능 | MT 벤치마킹에는 권장하지 않음 |

온도는 런 카드에 기록되므로, 다른 온도는 다른 지문을 생성해요 — 이들은 서로 다른 실험으로 취급돼요.

### 코칭 데이터가 도움이 되나요?

네, 저자원 언어의 경우 상당히 도움이 돼요. 코칭 데이터(문법 규칙, 사전 항목, 스타일 노트)는 LLM 시스템 프롬프트에 주입돼요. Plains Cree의 경우, 다합성어 언어에서는 코칭이 적용된 방법이 원시 LLM 방법보다 일관되게 더 나은 성능을 보여요. 범용 LLM은 다합성어에 대한 노출이 제한적이고 형태론적 인식이 없기 때문이에요. CRK를 위해 특별히 학습된 OMT-1600조차도 다합성 형태론을 구조적으로 표현할 수 없는 표준 BPE 토큰화를 사용해요. 코칭 데이터는 모델에 부족한 언어적 맥락을 제공해요.

고자원 언어(프랑스어, 스페인어)의 경우, 모델이 이미 강력한 기준 지식을 갖고 있기 때문에 코칭의 영향이 더 적어요.

전체 명세는 [Coaching Data](https://champollion.dev/docs/concepts/coaching-data)를 참조하세요.

---

## FST 및 형태론적 검증

### 제 언어에 FST가 없으면 어떻게 하나요?

많은 언어에는 유한 상태 트랜스듀서가 없어요. 괜찮아요 — 하네스는 그것 없이도 작동해요. 종합 점수는 프로필 B 가중치(자세한 내용은 [Scoring Specification §4.3](/docs/network/specifications/scoring#43-weight-tables) 참조)를 사용하며, 이는 가중치를 의미 및 표면 지표로 옮겨요. FST 수용은 런 카드에서 `null`로 표시돼요.

기존 FST를 위한 주요 레지스트리는 다음과 같아요:

| 레지스트리 | 지원 범위 | URL |
|----------|----------|-----|
| **GiellaLT** | 100개 이상의 언어 — 사미어(Sámi), 크리어(Cree), 이누크티투트어(Inuktitut) 및 기타 여러 우랄어족 및 소수 언어 | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | 평원 크리어(Plains Cree), 츳티나어(Tsuut'ina), 오다와어(Odawa) | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | 약 60개 언어 쌍, 주로 유럽 언어 | [apertium.org](https://apertium.org/) |
| **UniMorph** | 150개 이상 언어의 형태론적 패러다임 | [unimorph.github.io](https://unimorph.github.io/) |

### FST를 만들 수 있나요?

네, 하지만 간단하지 않아요. FST는 언어의 형태론적 규칙 — 모든 유효한 단어 형태를 인코딩해요. FST를 만들려면 해당 언어에 대한 깊은 언어학적 지식이 필요해요. 형태론적 문법(예: 언어학과에서 제공하는)에 접근할 수 있다면, [HFST](https://hfst.github.io/)나 [Foma](https://fomafst.github.io/) 같은 도구를 사용하여 FST로 컴파일할 수 있어요.

### FST 게이팅은 실제로 어떻게 작동하나요?

FST 게이팅 파이프라인은 다음과 같이 작동해요:

1. LLM이 번역을 생성함
2. 출력의 각 단어가 FST에 대해 검사됨
3. FST가 거부하는 단어는 형태론적으로 유효하지 않은 것으로 플래그됨
4. 방법은 피드백과 함께 재시도할 수 있음 ("단어 X는 유효하지 않으니 다시 시도하세요")
5. 재시도 후에도 남은 유효하지 않은 단어는 로그에 기록됨

FST 수용률은 몇 개의 단어가 검증을 통과하는지를 측정해요. 완전한 실습 예제는 [FST-Gated Pipeline Tutorial](/docs/network/tutorials/fst-gated-pipeline)을 참조하세요.

---

## 데이터 및 데이터셋

### 새로운 언어를 위한 데이터셋을 기여할 수 있나요?

네. [Benchmark Specification §11](/docs/network/specifications/benchmark#11-extending-to-new-languages)의 최소 요구 사항은 다음과 같아요:

- **50개의 골드 스탠다드 항목** (원문 + 검증된 참조 번역)
- **30개의 개발 항목** (소규모 코퍼스의 경우 골드 스탠다드와 겹칠 수 있음)
- **커뮤니티 동의** (원주민 언어의 경우, 거버넌스 기구의 명시적 승인)
- **출처 문서** (데이터가 어디서 왔는지, 어떤 라이선스가 적용되는지)

새 데이터셋은 자동으로 새로운 리더보드 트랙을 열어요. 기여자 가이드는 [For Language Communities](/docs/network/community/for-language-communities)를 참조하세요.

### 데이터셋은 어떤 형식이어야 하나요?

표준 필드 이름을 사용하는 JSON이에요:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

전체 스키마와 난이도 등급 정의는 [Datasets](/docs/network/leaderboard/datasets)를 참조하세요.

---

## 주권 및 소유권

### 원주민 언어를 위해 만든 방법은 누가 소유하나요?

원주민 언어의 경우, Deployable 등급(종합 점수 ≥ 0.70)에 도달하고 커뮤니티 검증을 통과한 방법은 [소유권 이전](/docs/network/sovereignty/ownership-transfer) 절차를 발동해요. 코드 소유권이 연구자에서 언어 커뮤니티의 거버넌스 조직으로 이전돼요.

연구자는 다음을 보유해요:
- 출판 권리 (방법에 관한 학술 논문)
- 리더보드 상의 크레딧
- 동일한 *기법*을 다른 언어에 적용할 권리

거버넌스 조직은 다음을 얻어요:
- 방법 코드 및 코칭 데이터의 완전한 소유권
- 배포에 대한 통제 (언제, 어디서, 어떻게) — 그리고 배포로 얻는 모든 것. Champollion은 비영리이며 어떤 몫도 취하지 않아요

### 어떠한 주권 관련 우려 없이 비원주민 언어에 champollion을 사용할 수 있나요?

네. 표준 언어(프랑스어, 일본어, 스페인어 등)의 경우, 주권 관련 고려 사항이 없어요. champollion을 평소처럼 사용하세요 — 원하는 대로 번역하고, 동기화하고, 게시하세요. 주권 프레임워크는 데이터 거버넌스 원칙(First Nations 데이터 주권 원칙, CARE, Te Mana Raraunga)이 특별한 고려를 요구하는 원주민 및 커뮤니티 관리 언어에 특별히 적용돼요.

---

## 참고 항목

- **[How It Works](https://champollion.dev/how-it-works)** — 전체 솔루션 설명
- **[Scoring Specification](/docs/network/specifications/scoring)** — 모든 채점 로직(지표, 가중치, 등급)에 대한 SSOT
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — 평가 프로토콜, 코퍼스 형식, 주권
- **[Submit a Method](/docs/network/getting-started/submit-a-method)** — 단계별 빠른 시작
- **[Leaderboard Rules](/docs/network/leaderboard/rules)** — 제출 기준
- **[Data Stewardship](/docs/network/sovereignty/data-sovereignty)** — 코퍼스는 그 관리자에게 남으며, 모든 라이선스가 존중됨
