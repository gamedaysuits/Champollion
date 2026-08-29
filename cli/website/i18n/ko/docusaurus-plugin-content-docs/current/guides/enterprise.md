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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

프랑스어는 DeepL을 사용해요(팀이 그 유럽어 유창성을 선호해서요). 일본어는 프런티어 LLM을 사용해요. 독일어는 Google Translate를 사용해요(빠르고, 저렴하고, 충분히 좋아요). 한국어는 격식체를 갖춘 LLM을 사용해요. 스페인어는 `api` 방법을 통해 전문 사람 번역 / MTPE 서비스로 라우팅돼요 — 여기서 사람 번역은 부가 기능이 아니라 일급 방법이에요. Plains Cree는 커뮤니티가 구축하고 커뮤니티가 소유하는 coached 플러그인을 사용해요.

**같은 명령어. 같은 CI 파이프라인. 쌍마다 다른 방법 — 사람이든 기계든. 하나의 설정 파일.**

:::note[커뮤니티 언어 방법은 주권을 가져요]
위의 Plains Cree 플러그인은 단순히 "또 하나의 방법"이 아니에요. 원주민 및 기타 커뮤니티 언어를 위한 방법은 **커뮤니티가 소유하고 관리해요**: 커뮤니티가 그 뒤에 있는 데이터의 키를 보유하고, 사용 조건을 정하며, 모든 비상업적(NC) 코퍼스나 방법은 기본적으로 상업적 경로에서 제외돼요. 사용 목적이 상업적이라면, 배포하기 전에 해당 방법의 라이선스를 확인하세요. [데이터 주권](/docs/network/sovereignty/data-sovereignty)을 참고하세요.
:::

## 리더보드 → 배포 워크플로

:::tip[`champollion leaderboard`은(는) CLI에 포함되어 있어요]
아래 워크플로우는 `champollion leaderboard` 명령어로 실행돼요. 터미널에서 [Network](/arena) 리더보드를 탐색하고 그곳에서 바로 메서드 플러그인을 설치해 보세요. 모든 옵션은 [CLI 레퍼런스](/docs/reference/cli#leaderboard)를 참고해 주세요.
:::

[Network](/arena)는 번역 방법이 재현 가능하고 지문화된 점수로 벤치마킹되는 곳이에요. 모든 방법은 여러 지표(chrF++, 정확 일치, FST 수용, 시맨틱 점수)에 걸쳐 종합 점수를 받아요. 리더보드는 모든 제출을 추적해요.

워크플로우:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*예시일 뿐이에요 — 위의 리더보드 행은 예시 레이아웃이에요. 보드는 현재 제출이 열려 있으며 아직 공개된 실행 결과가 없어요.*

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
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

세 개의 명령어. 수동 번역은 전혀 없어요. 파이프라인은 하드코딩된 문자열을 잡아내고, 선택한 방법으로 번역하며, 누락되거나 손상된 것이 있으면 빌드를 실패시켜요.

### 5. 전문 검토 (선택 사항)

중요한 콘텐츠의 경우, 사람의 검토를 위해 XLIFF로 내보내세요:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

대부분은 기계 번역하세요. 핵심 경로는 사람이 검토하세요. 중요한 곳에만 사람의 시간에 비용을 지불하세요.

## 비용 모델

champollion은 **구독료나 사용자당 라이선스 비용이 없어요**. CLI는 PolyForm Noncommercial 1.0.0 라이선스에 따라 소스가 공개되어 있어요. 비상업적 용도(연구, 교육, 커뮤니티 활동)로는 무료로 사용할 수 있으며, 상업적 용도로 사용하려면 허가가 필요하므로 먼저 [저희에게 문의](/get-involved)해 주세요. 그 외에는 번역 API 호출 비용만 지불하시면 돼요.

| 분량 | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 키 1,000개 × 로케일 5개 | ~$0.50 | ~$0.30 (무료 등급) | ~$2.00 |
| 키 10,000개 × 로케일 15개 | ~$15 | ~$8 | ~$60 |
| 키 50,000개 × 로케일 30개 | ~$75 | ~$40 | ~$300 |

Translation Memory는 이후 동기화 시 **변경된 키**에 대해서만 비용을 지불한다는 것을 의미해요. 10,000개 문자열 중 10개를 업데이트하면, 10,000개가 아니라 10개의 번역에 대해 비용을 지불해요.

## TMS 플랫폼과의 비교

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **가격** | 비상업적 용도 무료 (상업적 용도는 허가 필요) + API 비용 | 월 $50–$500 + 사용자당 비용 |
| **벤더 종속성** | 없음 — 설정에서 제공업체 변경 가능 | 높음 — 데이터가 해당 클라우드에 저장됨 |
| **메서드 선택** | 모든 제공업체, 모든 모델, 언어 쌍별 설정 가능 | 제공업체에서 지원하는 항목만 |
| **CI/CD** | 기본 지원 (`lint → sync → audit`) | 플러그인/웹훅 |
| **커스텀 메서드** | 플러그인 시스템, 커뮤니티 플러그인 | 지원하지 않음 |
| **품질 게이트** | 내장됨 (잘못된 문자, 에코, 길이) | 서비스마다 다름 |
| **셀프 호스팅** | 지원함 (LibreTranslate, 커스텀 API) | 지원하지 않음 |

자세한 내용은 [전체 비교](/docs/guides/comparison)를 참고하세요.

## 더 읽어보기

- **[빠른 시작](/docs/getting-started/quick-start)** — 60초 만에 첫 동기화 실행하기
- **[번역 방법](/docs/guides/translation-methods)** — 결정 트리가 포함된 전체 방법 메뉴
- **[CI/CD 통합](/docs/guides/ci-cd)** — 파이프라인에서 자동화하기
- **[전문 번역가와 협업하기](/docs/guides/professional-translators)** — XLIFF 내보내기/가져오기
- **[the Network](/arena)** — 벤치마크와 리더보드
- **[설정 레퍼런스](/docs/getting-started/configuration)** — 모든 설정 옵션
