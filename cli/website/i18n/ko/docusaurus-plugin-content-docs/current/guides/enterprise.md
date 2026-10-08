---
sidebar_position: 7
title: "기업용"
description: "리더보드로 검증된 방법, 맞춤형 플러그인, 그리고 단일 명령어 배포를 통해 조직이 번역을 표준화하는 방법을 알아보세요."
---

# 기업용 champollion

당신의 팀은 콘텐츠를 정기적으로 번역해요. 로케일 파일 더미와 CI 파이프라인, 그리고 아마도 누군가 수동으로 Google Translate를 실행하고 결과를 JSON에 복사한 뒤 잘 되기를 바라는 과정을 거치는 프로세스를 가지고 있을 거예요. 아니면 한 벤더의 번역 엔진에 묶여 있는 TMS 플랫폼에 비용을 지불하고 있을 수도 있어요.

champollion은 더 차분한 선택지를 제공해요. 각 언어에 맞는 방법을 선택하고 — 기계든 사람이든 — 그것들을 하나의 명령어로 모두 실행해요.

## 팀이 champollion을 사용하는 이유

1. **각 언어에 맞는 방법을 선택하세요** — 벤더가 기본값으로 정한 것이 아니라 기계든 사람이든
2. **하나의 명령어로 배포하세요** — `npx champollion sync`는 모든 로케일, 모든 형식을 매번 번역해요
3. **코드 변경 없이 방법을 교체하세요** — 마이그레이션이 아닌 설정 변경이에요
4. **파이프라인을 직접 소유하세요** — 벤더 종속도, 월간 대시보드도, 계정도 없어요

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

프랑스어에는 DeepL을 연결해요(팀에서 유럽 언어 번역의 자연스러움을 선호하니까요). 일본어에는 프론티어 LLM을 사용해요. 독일어에는 Google Translate를 쓰고요(빠르고 저렴하며 충분히 훌륭하니까요). 한국어에는 격식체를 사용하는 LLM을 배정해요. 스페인어는 `api` 방식을 통해 전문 번역가 / MTPE 서비스로 라우팅돼요. 여기서는 인간 번역이 부가 기능이 아니라 일급(first-class) 방식이에요. 플레인스 크리어(Plains Cree)에는 직접 제공한 문법 노트와 사전이 포함된 코칭 LLM 방식을 적용해요.

**같은 명령어. 같은 CI 파이프라인. 쌍마다 다른 방법 — 사람이든 기계든. 하나의 설정 파일.**

:::note[커뮤니티 언어 번역 방식의 주권]
위의 플레인스 크리어 언어 쌍은 단순히 또 하나의 언어 쌍이 아니에요. 원주민 언어 및 기타 커뮤니티 언어를 위한 번역 방식은 **커뮤니티가 소유하고 관리**해요. 커뮤니티가 그 기반이 되는 데이터의 권한을 쥐고 이용 약관을 설정하며, 비상업적(NC) 말뭉치나 번역 방식은 기본적으로 상업적 경로에서 제외돼요. 상업적 용도로 사용하려는 경우 배포하기 전에 해당 방식의 라이선스를 확인하세요. 자세한 내용은 [데이터 주권](/docs/network/sovereignty/data-sovereignty)을 참고하세요.
:::

## 리더보드 → 배포 워크플로

:::tip[CLI에 `champollion network leaderboard`가 기본 포함되어 있어요]
아래 워크플로는 `champollion network leaderboard` 명령어에서 실행돼요. 터미널에서 [Network](/arena) 리더보드를 둘러보고 곧바로 방식 플러그인을 설치할 수 있어요. 모든 옵션은 [CLI 레퍼런스](/docs/reference/cli#leaderboard)를 확인해 보세요.
:::

[Network](/arena)는 재현 가능하고 핑거프린트된 채점 방식을 통해 번역 방식을 벤치마킹하는 공간이에요. 실행 결과는 기계 번역(MT) 분야의 표준 방식대로 순위가 매겨져요. 즉, 95% 신뢰구간이 적용된 말뭉치 수준의 chrF++를 기준으로 순위를 정해요. BLEU, TER, COMET도 함께 표시되며, 완전 일치(exact match)나 FST 수용률(FST acceptance) 같은 진단 지표는 헤드라인 점수에 섞이지 않고 별도로 보고돼요. 특정 방식이 다른 방식보다 실제로 더 나은지 여부는 두 숫자 사이의 단순한 격차가 아니라 대응 유의성 검정(paired significance test)으로 판별해요. 리더보드는 제출된 모든 결과를 추적해요.

워크플로는 다음과 같아요:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*이해를 돕기 위한 예시일 뿐이에요 — 위 리더보드 행은 레이아웃 예시예요. 이 예시에서는 처음 두 행의 구간이 겹치므로 리더보드상에서 어느 한쪽이 다른 쪽보다 더 낫다고 판단할 수 없어요. 현재 리더보드는 제출을 접수받고 있으며 아직 공개된 실행 결과는 없어요.*

**당신은 방법을 만들지 않아요. 모델을 학습시키지 않아요. 당신의 도메인, 예산, 라이선스에 맞는 방법을 — 사람이든 기계든 — 고르고 배포해요.** 다음 달에 더 잘 맞는 방법이 나타나면, 하나의 명령어로 교체하세요.

## 오늘 사용 가능한 것

리더보드-CLI 간 다리는 개발 중이에요. 지금 당장 동작하는 것은 다음과 같아요:

### 내장 방법 (플러그인 불필요)

| 방법 | 최적 용도 | 비용 |
|--------|----------|------|
| `llm` (기본값) | 품질 중심, 모든 언어 | OpenRouter를 통한 토큰당 과금 |
| `gemini` | 품질 + 무료 등급 | 무료(제한적), 이후 토큰당 과금 |
| `google-translate` | 속도 + 분량 | 문자 100만당 $20 |
| `deepl` | 유럽어 | 문자 100만당 $25 |
| `llm-coached` | coaching 데이터가 있는 언어 | OpenRouter를 통한 토큰당 과금 |
| `api` | 커스텀/커뮤니티 호스팅 방법 | 자체 호스팅 |

### 플러그인 방법 (별도 설치)

커스텀 플러그인은 어떤 번역 로직이든 감쌀 수 있어요 — 파인튜닝된 모델, FST로 게이팅된 파이프라인, 커뮤니티 API, 또는 JSON을 생성하는 그 밖의 무엇이든요. [플러그인 만들기](/docs/tutorials/build-a-plugin)를 참고하세요.

## 기업 워크플로

### 1. 현재 품질을 평가하세요

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. 후보에 대해 eval harness를 실행하세요

[eval harness](/docs/network/specifications/harness)를 사용하면 동일한 데이터셋에 대해 여러 방법을 벤치마킹할 수 있어요. 스윕을 실행하고, 점수를 비교하고, 우승자를 고르세요:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. 쌍별 우승자를 설정하세요

언어 쌍별로 최적의 방법을 사용하도록 설정을 업데이트하세요. 언어마다 최적의 방법이 다른데 — 그게 바로 핵심이에요.

### 4. CI/CD에 통합하세요

```bash
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

세 개의 명령어. 수동 번역은 전혀 없어요. 파이프라인은 하드코딩된 문자열을 잡아내고, 선택한 방법으로 번역하며, 누락되거나 손상된 것이 있으면 빌드를 실패시켜요.

### 5. 전문 검토 (선택 사항)

중요한 콘텐츠의 경우, 사람의 검토를 위해 XLIFF로 내보내세요:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

대부분은 기계 번역하세요. 핵심 경로는 사람이 검토하세요. 중요한 곳에만 사람의 시간에 비용을 지불하세요.

## 비용 모델

champollion에는 **구독 요금제나 좌석당(per-seat) 요금이 없어요**. CLI는 PolyForm Noncommercial 1.0.0에 따라 소스 코드가 공개되어 있으며, 연구, 교육, 자선 단체, 공공 병원 및 진료소, 정부 기관, 개인 프로젝트 등 비상업적 용도로는 무료예요. 영리 기업의 제품과 같은 상업적 목적으로 사용하는 것은 해당 라이선스의 적용 대상이 아니에요. 도입하기 전에 [이용 가능 대상](/docs/getting-started/who-may-use-this)을 확인해 보세요. 그 외에는 번역 API 호출 비용만 지불하시면 돼요:

| 분량 | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 키 1,000개 × 로케일 5개 | ~$0.50 | ~$0.30 (무료 등급) | ~$2.00 |
| 키 10,000개 × 로케일 15개 | ~$15 | ~$8 | ~$60 |
| 키 50,000개 × 로케일 30개 | ~$75 | ~$40 | ~$300 |

Translation Memory는 이후 동기화 시 **변경된 키**에 대해서만 비용을 지불한다는 것을 의미해요. 10,000개 문자열 중 10개를 업데이트하면, 10,000개가 아니라 10개의 번역에 대해 비용을 지불해요.

## TMS 플랫폼과의 비교

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **가격 정책** | 비상업적 용도로 무료([이용 가능 대상](/docs/getting-started/who-may-use-this)) + API 비용 | 월 $50~$500 + 좌석당 요금 |
| **벤더 종속** | 없음 — 설정에서 제공업체 전환 가능 | 높음 — 해당 플랫폼 클라우드에 데이터 보관 |
| **번역 방식 선택** | 언어 쌍별로 원하는 제공업체 및 모델 선택 가능 | 해당 플랫폼이 제공하는 방식으로 제한 |
| **CI/CD** | 일급 지원 (`lint → sync → audit`) | 플러그인/웹훅 |
| **커스텀 번역 방식** | 플러그인 시스템, 커뮤니티 플러그인 | 지원되지 않음 |
| **품질 게이트** | 기본 내장 (문자 체계 오류, 메아리 번역, 길이) | 서비스마다 다름 |
| **자체 호스팅** | 지원 (LibreTranslate, 커스텀 API) | 미지원 |

자세한 내용은 [전체 비교](/docs/guides/comparison)를 참고하세요.

## 더 읽어보기

- **[빠른 시작](/docs/getting-started/quick-start)** — 60초 만에 첫 동기화 실행하기
- **[번역 방법](/docs/guides/translation-methods)** — 결정 트리가 포함된 전체 방법 메뉴
- **[CI/CD 통합](/docs/guides/ci-cd)** — 파이프라인에서 자동화하기
- **[전문 번역가와 협업하기](/docs/guides/professional-translators)** — XLIFF 내보내기/가져오기
- **[the Network](/arena)** — 벤치마크와 리더보드
- **[설정 레퍼런스](/docs/getting-started/configuration)** — 모든 설정 옵션
