---
sidebar_position: 1
slug: /intro
title: "소개"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

완전히 커스터마이징 가능한 국제화 프레임워크예요. 명령어 하나로 locale 파일을 번역해요. 설정 파일 하나로 모든 방식, 모델, 언어 쌍을 제어해요. 그리고 내장된 방식으로 충분하지 않다면 — 직접 만들고, 작동하는지 테스트하고, 배포하세요.

```bash
npx champollion sync
```

champollion은 locale 파일, 형식, 대상 언어를 자동으로 감지해요. 누락된 부분을 번역하고, 완료된 부분은 건너뛰고, 모든 결과를 검증하고, 깔끔한 출력을 작성해요. 그게 출발점이에요.

:::info[더 큰 무언가의 일부]

이 CLI는 아무도 측정하지 않는 언어의 기계 번역 성능을 측정하고 그 결과를 공개하는 인프라인 **Champollion**의 배포를 담당하는 부분이에요. 측정 파트에서는 평가 테스트 세트를 구축하고, 누가 어떤 종류의 텍스트를 얼마나 잘 번역할 수 있는지 보여주는 공개 지도를 만들어요. 그리고 CLI는 이렇게 검증된 방식을 여러분이 실제로 실행할 수 있는 형태로 만들어 줘요.

한 가지 규칙이 모든 것을 결정해요. 언어 데이터는 생체 데이터처럼 취급되므로, 말뭉치(corpus)를 제공하는 사람들이 해당 데이터와 이를 바탕으로 측정된 모든 결과에 대한 권한을 갖게 돼요. 무엇이 존재하고, 규칙은 무엇이며, 여러분이 어디에 해당하는지 등 전체적인 그림은 [Champollion이란?](/docs/what-is-champollion)에서 확인할 수 있으며, 측정 파트는 [네트워크](/docs/network/)에서 다루고 있어요.

:::

---

## 그냥 직접 스크립트로 짜면 안 되나요?

각 키에 대해 Google Translate를 호출하는 간단한 루프를 작성할 수 있어요. 대부분의 개발자가 그렇게 하죠 — 약 30줄이면 돼요. 여기서 문제가 생겨요:

- **변경 감지 없음.** 영어 문자열을 업데이트해도 — 번역은 영원히 오래된 상태로 남아요. champollion은 모든 소스 값을 SHA-256 해시로 추적하고 변경된 것만 다시 번역해요.
- **배칭 없음.** 키당 하나의 API 호출은 200개 키 = 200번의 왕복을 의미해요. champollion은 지능적으로 배칭해요 (설정 가능, 기본값은 LLM의 경우 80 keys/batch, Google의 경우 128).
- **캐싱 없음.** 모든 sync가 모든 것을 다시 번역해요. champollion의 Translation Memory는 소스 텍스트 + locale + 방식으로 번역을 캐싱해요 — 하나의 키를 변경한 후 sync를 다시 실행하면 전체 파일이 아니라 그 하나의 키만 번역해요.
- **품질 게이트 없음.** 기계 번역은 환각을 일으키고, 소스를 그대로 되돌려주거나, 잘못된 스크립트로 출력해요. champollion은 작성하기 전에 모든 번역을 검증해요 — 잘못된 스크립트, 길이 팽창, 소스 반향이 잡혀서 거부돼요.
- **형식 인식 없음.** JSON에 하드코딩되어 있나요? champollion은 자동 감지로 JSON, TOML, YAML, Hugo Markdown (frontmatter + body)를 처리해요.
- **방식 제어 없음.** 모든 쌍이 동일한 방식을 받아요. champollion은 같은 설정 파일에서 프랑스어에는 Google Translate, 일본어에는 LLM, Cree에는 커뮤니티가 호스팅하는 커스텀 파이프라인을 사용하게 해줘요.

champollion은 그 스크립트의 프로덕션 버전이에요.

---

## 무엇이 다른가요

### 모든 방식이 플러그인이에요

번역 방식은 **언어 쌍마다 설정 가능**해요. 같은 프로젝트에서 Google Translate, LLM, 코칭된 프롬프트, 커스텀 API를 섞어 쓰세요:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

프랑스어는 Google Translate를 사용해요 (빠르고 저렴함). 일본어는 프리미엄 LLM을 사용해요 (뉘앙스가 풍부함). Plains Cree는 문법 규칙, 사전, 형태론적 검증을 갖춘 코칭된 플러그인을 사용해요. 같은 `sync` 명령어. 같은 품질 게이트. 같은 CLI.

### 무엇이 작동하는지 확인하세요

당신의 방식이 영어를 스페인어로 번역할 수 있다고 생각하나요? 터키어를 아제르바이잔어로? 영어를 Cree로?

**만들고 테스트하세요.** 함께 제공되는 [eval harness](/docs/network/specifications/harness)는 재현 가능하고 지문이 찍힌 점수로 모든 번역 방식을 벤치마킹해요. [leaderboard](/leaderboard)는 게시된 각 실행을 기록하여 모두가 무엇이 작동하는지 볼 수 있게 해요.

eval harness와 프로덕션 CLI는 같은 플러그인 인터페이스를 공유해요. harness에서 좋은 점수를 받은 방식은 프로덕션에서 사용할 수 있어요 — 그 언어를 사용하는 커뮤니티가 동의한다면요. 원주민 언어와 저자원 언어의 경우, 그 동의가 중요해요. [Data Sovereignty](/docs/network/sovereignty/data-sovereignty)를 참고하세요.

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

# Use it locally
npx champollion sync
```

같은 플러그인. 꽂고 테스트하세요.

### 전체 툴킷

champollion은 단지 `sync`만이 아니에요. 완전한 i18n 파이프라인이에요:

| 명령어 | 하는 일 |
|---------|-------------|
| `sync` | 누락되고 오래된 키를 번역 (sync 후 검증 포함) |
| `watch` | 소스 파일이 변경될 때 자동 sync |
| `lint` | 소스 코드에서 하드코딩된 문자열 스캔 |
| `wrap` | 하드코딩된 문자열을 `t()` 호출로 자동 래핑 |
| `audit` | 이전 실행의 모든 `[EN]` 폴백 마커 나열 |
| `verify` | 번역이 존재하고 올바른지 검증 (CI 게이트) |
| `integrity` | placeholder 손상, 인코딩 문제, ICU 복수형 완전성 감지 |
| `seo` | hreflang 태그, sitemap, JSON-LD 스키마 생성 |
| `status` | 쌍 설정, 플러그인, 벤치마크 점수 표시 |
| `provenance` | 번역 리소스 라이선스 감사 |
| `plugin` | 방식 플러그인 설치, 제거, 나열 |
| `fonts` | PUA 스크립트 변환기용 웹 폰트 다운로드 |
| `tm` | Translation Memory 캐시 관리 (통계, 삭제, locale별) |
| `xliff` | 전문 번역가 검토를 위한 XLIFF 1.2 내보내기/가져오기 |

이 중 네 개 — `lint`, `sync`, `verify`, `audit` — 는 하드코딩된 문자열을 잡아내고, 번역하고, 정확성을 검증하고, 어떤 locale이라도 불완전하면 빌드를 실패시키는 CI 파이프라인을 구성해요.

---

## The Network

[방식 리더보드](/leaderboard)는 실시간으로 공개되며 제출이 열려 있는 점수판이에요. 모든 제출물은 Git 커밋으로 핑거프린트가 남고, 특정 데이터셋에 맞춰 버전이 지정되며, 동일한 테스트 환경(harness)에서 점수가 매겨져요. 누구나 제출할 수 있어요.

**무엇을 만들 수 있나요?** harness는 JSON을 받아요. 플러그인은 JSON을 받아요. JSON을 생성하는 모든 방식은 테스트할 수 있어요:

| 접근 방식 | 예시 |
|----------|---------|
| **Coached LLM** | 문법 규칙과 사전을 프론티어 모델의 프롬프트에 주입 |
| **Fine-tuned model** | 병렬 텍스트로 오픈 모델을 학습 — 단, eval 데이터로는 안 됨 |
| **FST-gated pipeline** | LLM이 생성 → finite-state transducer가 형태론 검증 → 재시도 |
| **Chained models** | 모델 A가 초안 작성 → 모델 B가 후편집 → 모델 C가 점수 매김 |
| **Dictionary + LLM** | 사전에서 알려진 용어를 강제하고, 나머지는 LLM이 처리 |
| **Evolutionary** | 후보를 생성하고, 점수를 매기고, 최고를 변이시키고, 반복 |
| **Partial translation** | 샘플을 손으로 번역하고, LLM이 일치함을 증명하고, 나머지를 자동 번역 |

모델을 파인튜닝하세요. 진화 알고리즘을 배포하세요. 언어 시험에서 학생 답안을 테스트하세요. 조회 테이블을 만드세요. 세 개의 모델을 함께 연결하세요. 당신의 방식이 JSON을 생성하는 한, harness가 점수를 매기고 프레임워크가 실행해요.

:::danger[유일한 규칙]
**평가 데이터로 학습하지 마세요.** 벤치마크 데이터셋에 노출된 방식은 자격이 박탈돼요. 원하는 것으로 파인튜닝하세요. 단, 테스트 세트로는 안 돼요.
:::

이건 공개 초대예요. 저자원 언어를 다루고 있다면 — 연구자로서, 커뮤니티 구성원으로서, 학생으로서, 아니면 그저 관심 있는 사람으로서 — 방식을 만들고, harness를 실행하고, 모두를 위해 네트워크를 강화하세요. 이 문제는 아직 해결되지 않았어요. 인프라는 여기 있고, 열려 있어요.

**[→ 리더보드 보기](/leaderboard)**

---

## 다음 단계

**시작하기:**
- [Installation](/docs/getting-started/installation) — 2분 만에 설정
- [Quick Start](/docs/getting-started/quick-start) — 첫 sync 실행
- [Supported Languages](/docs/reference/supported-languages) — 기본으로 사용 가능한 것

**설정 커스터마이징:**
- [Translation Methods](/docs/guides/translation-methods) — 쌍마다 올바른 방식 선택
- [Translation Memory](/docs/concepts/translation-memory) — 캐싱이 비용을 절약하는 방법
- [Configuration](/docs/getting-started/configuration) — 전체 설정 레퍼런스
- [Hugo Multilingual Site](/docs/tutorials/hugo-multilingual-site) — Markdown 콘텐츠 번역

**더 알아보기:**
- [전문 번역가와 협업하기](/docs/guides/professional-translators) — XLIFF 내보내기/가져오기 워크플로우
- [데이터 주권](/docs/network/sovereignty/data-sovereignty) — First Nations 데이터 주권 원칙, CARE 및 마오리(Māori) 데이터 주권
- [자원이 부족한 언어 지원하기](/docs/network/community/low-resource-languages) — 이 모든 것을 시작하게 만든 도전 과제
- [쿡북: FST-Gated 파이프라인](/docs/network/tutorials/fst-gated-pipeline) — 분해(decomposition) 파이프라인 구축하기
- [기계 번역(MT) 평가](/docs/network/leaderboard/rules) — 테스트 환경(harness)과 리더보드 작동 방식
- [방식 리더보드](/leaderboard) — 실시간 점수 및 제출물
