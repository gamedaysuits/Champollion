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

champollion은 로케일 파일, 형식, 대상 언어를 자동으로 감지해요. 누락된 부분은 번역하고, 완료된 부분은 건너뛰며, 모든 결과물에 손상된 출력이 있는지 확인한 뒤 깔끔한 결과물을 작성해요. 이것이 바로 시작점이에요.

:::info[더 큰 무언가의 일부]

이 CLI는 **Champollion**의 배포단이에요. 다른 곳에서는 다루지 않는 언어의 기계 번역을 측정하고, 그 결과를 공개하는 인프라죠. 측정단에서는 평가용 테스트 세트와 함께 누가 어떤 텍스트를, 얼마나 잘 번역할 수 있는지를 보여주는 공개 지도를 구축해요. CLI는 이렇게 검증된 방식을 실제로 실행할 수 있는 도구로 구현해 둔 곳이고요.

모든 것은 한 가지 원칙을 바탕으로 해요. 언어 데이터는 생체 데이터처럼 다루어지므로, 말뭉치를 제공한 이들이 데이터 자체와 이를 기준으로 측정된 모든 것에 대한 권한을 갖는다는 점이에요. 전체적인 내용(존재하는 것, 규칙, 사용자의 위치 등)은 [Champollion이란 무엇인가](/docs/what-is-champollion)에서 확인할 수 있으며, 측정단에 대한 내용은 [Network](/docs/network/)에서 다루고 있어요.

:::

---

## 그냥 직접 스크립트로 짜면 안 되나요?

각 키에 대해 Google Translate를 호출하는 간단한 루프를 작성할 수 있어요. 대부분의 개발자가 그렇게 하죠 — 약 30줄이면 돼요. 여기서 문제가 생겨요:

- **변경 사항 감지 부재.** 영어 문자열을 업데이트해도 번역본은 영원히 이전 상태로 남아 있어요. champollion은 SHA-256 해시로 모든 원본 값을 추적하여 변경된 부분만 다시 번역해요.
- **배치 처리 부재.** 키당 한 번씩 API를 호출하면 키 200개에 200번의 왕복 통신이 발생해요. champollion은 지능적으로 배치를 묶어 처리해요(설정 가능, 기본값: LLM의 경우 배치당 80개 키, Google은 128개).
- **캐싱 부재.** 동기화할 때마다 모든 것을 다시 번역해요. champollion의 번역 메모리(Translation Memory)는 원본 텍스트 + 로케일 + 번역 방식을 기준으로 번역을 캐시해요. 키 하나만 변경된 후 동기화를 다시 실행하면 전체 파일이 아니라 변경된 키 하나만 번역해요.
- **품질 게이트 부재.** 기계 번역은 환각(할루시네이션)을 일으키거나, 원본을 그대로 따라 하거나, 잘못된 문자로 출력하기도 해요. champollion은 번역을 저장하기 전에 매번 검사해요. 빈 출력, 원본 텍스트 복제, 반복 루프, 과도한 길이 증가, 내용 누락, 잘못된 문자 체계 등을 감지해 거절해요. 이 게이트는 잘못된 의미가 아니라 손상된 출력을 잡아내요.
- **형식 인식 부재.** JSON으로만 하드코딩되어 있나요? champollion은 JSON, TOML, YAML, Hugo Markdown(프런트매터 + 본문)을 자동으로 감지해 처리해요.
- **방식 제어 부재.** 모든 언어 쌍에 동일한 방식이 적용되나요? champollion을 사용하면 동일한 설정 파일 안에서 프랑스어에는 Google Translate를, 일본어에는 LLM을, 크리어(Cree)에는 커뮤니티에서 직접 호스팅하는 커스텀 파이프라인을 지정할 수 있어요.

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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

프랑스어에는 Google Translate(빠르고 저렴함)를 사용해요. 일본어에는 프리미엄 LLM(뉘앙스 반영)을 사용하고요. 플레인스 크리어(Plains Cree)에는 직접 제공한 문법 규칙과 사전으로 학습된 LLM을 적용해요. 모두 같은 `sync` 명령어를 쓰고, 같은 품질 게이트를 거치며, 같은 CLI로 실행돼요.

### 무엇이 작동하는지 확인하세요

당신의 방식이 영어를 스페인어로 번역할 수 있다고 생각하나요? 터키어를 아제르바이잔어로? 영어를 Cree로?

**만들고 테스트하세요.** 함께 제공되는 [eval harness](/docs/network/specifications/harness)는 재현 가능하고 지문이 찍힌 점수로 모든 번역 방식을 벤치마킹해요. [leaderboard](/leaderboard)는 게시된 각 실행을 기록하여 모두가 무엇이 작동하는지 볼 수 있게 해요.

eval harness와 프로덕션 CLI는 같은 플러그인 인터페이스를 공유해요. harness에서 좋은 점수를 받은 방식은 프로덕션에서 사용할 수 있어요 — 그 언어를 사용하는 커뮤니티가 동의한다면요. 원주민 언어와 저자원 언어의 경우, 그 동의가 중요해요. [Data Sovereignty](/docs/network/sovereignty/data-sovereignty)를 참고하세요.

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

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

[방식 리더보드](/leaderboard)는 점수판 역할을 해요. 실시간으로 공개되며 누구나 제출할 수 있어요. 모든 제출물은 특정 Git 커밋으로 핑거프린팅되고, 특정 데이터셋에 버전이 지정되며, 동일한 테스트 하네스로 점수가 매겨져요. 누구나 제출할 수 있어요.

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
- [전문 번역가와 협업하기](/docs/guides/professional-translators) — XLIFF 내보내기/가져오기 워크플로
- [데이터 주권](/docs/network/sovereignty/data-sovereignty) — 원주민 데이터 주권 원칙: 언어 데이터에 대한 커뮤니티의 소유권과 통제권
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages) — 이 모든 여정의 시작이 된 도전 과제
- [쿡북: FST 게이트 파이프라인](/docs/network/tutorials/fst-gated-pipeline) — 분해 파이프라인 구축하기
- [기계 번역 평가](/docs/network/leaderboard/rules) — 테스트 하네스와 리더보드 작동 방식
- [방식 리더보드](/leaderboard) — 실시간 점수 및 제출 현황
