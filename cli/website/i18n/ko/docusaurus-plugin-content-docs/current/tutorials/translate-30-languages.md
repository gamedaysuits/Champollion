---
sidebar_position: 2
title: "30개 언어 번역하기"
description: "쿡북: 페어별 메서드 조합, 배칭, CI 통합을 활용해 프로젝트를 3개 언어에서 30개 언어로 확장하는 방법이에요."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Cookbook: 30개 언어 번역하기

프로젝트를 소수의 로케일에서 전 세계 범위로 확장해 보세요. 이 cookbook에서는 실제 다국어 배포를 위한 방법 선택, 비용 최적화, CI 통합 과정을 안내해요.

**시나리오:** `en`, `fr`, `es`를 지원하는 SaaS 앱이 있어요. 세 가지 품질 요구 사항 등급에 걸쳐 27개 언어를 추가해야 해요.

---

## 1단계: 언어 분류하기

30개 언어 모두가 같은 접근 방식을 필요로 하는 것은 아니에요. 사용 가능한 방법의 품질에 따라 그룹으로 묶어 보세요:

| 등급 | 언어 | 방법 | 이유 |
|------|-----------|--------|-----|
| **등급 1 — 프리미엄** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | 고부가가치 시장, 미묘한 문법 |
| **등급 2 — 표준** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | 대량 처리, Google의 우수한 지원 |
| **등급 3 — 코칭** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + 플러그인 | 저자원 언어, 용어 적용 필요 |

## 2단계: 쌍별로 구성하기

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.8-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

**참고:** `pairs`에 나열되지 않은 언어는 `defaultMethod: "google-translate"`를 상속받아요. 30개 언어를 모두 나열할 필요는 없어요.

:::info
`crk` 지원은 개발 중이에요 — 상태 및 기여 가이드라인은 [저자원 언어 지원하기](/docs/network/community/low-resource-languages)를 참고하세요.
:::

## 3단계: API 키 설정하기

이 구성에는 두 가지 API 키가 모두 필요해요:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## 4단계: 먼저 Dry Run 실행하기

30개 언어를 번역하기 전에 항상 미리 보기를 실행하세요:

```bash
npx champollion sync --dry
```

출력 결과를 검토하세요. 다음 내용이 표시돼요:
- 어떤 쌍이 어떤 방법을 사용하는지
- 로케일별로 새로 추가되거나 변경된 키의 수
- 등급별 예상 API 호출 수

## 5단계: 동기화 실행하기

```bash
npx champollion sync
```

Champollion은 각 쌍을 독립적으로 처리해요. Google Translate를 사용하는 등급 2 쌍은 빠르게 처리돼요. 등급 1 LLM 쌍은 더 느리지만 품질이 더 높아요. 등급 3 코칭 쌍은 플러그인의 코칭 데이터를 사용해요.

### 증분 업데이트

초기 동기화 이후 후속 실행에서는 **변경되거나 새로 추가된** 키만 번역해요:

```bash
# Only keys that changed since last sync
npx champollion sync
```

lock 파일(`.champollion.lock`)이 번역된 내용을 추적하므로, 안정적인 콘텐츠를 다시 번역하는 일은 절대 없어요.

## 6단계: 품질 감사하기

모든 언어 쌍의 상태를 확인하세요:

```bash
npx champollion status
```

여기에는 각 언어 쌍의 방식, 모델 및 사용역, 코칭 정보와 플러그인이 공개한 벤치마크 점수가 나열돼요(설정에서 지정한 경우 `qualityTier` 라벨도 함께 표시돼요).

### 출력 결과가 지정한 register를 준수했나요?

2단계에서 언어별로 [register](/glossary#term-register)를 선언했어요 — 일본어는 `"Polite/formal"`, 독일어는 `"Formal (Sie)"`. (이 용어가 처음이신가요? 용어집에서 쉬운 말로 설명해요.) 이러한 지침은 번역 프롬프트에 포함되지만, 프롬프트는 요청일 뿐 보장은 아니에요.

[Network harness](/docs/network/specifications/harness) — 공개 리더보드를 구동하는 것과 동일한 도구 — 는 번역 샘플에서 register와 스타일 준수 여부를 측정할 수 있어요. 이 도구의 글쓰기 스타일 메트릭은 각 출력을 예상 register(격식/비격식 표지, T–V 대명사, 축약형, 문장 길이 편차)와 대조해 확인하고, 실행 전반에 걸쳐 `style_consistency_rate`를 보고해요. `--style-profile`로 커스텀 브랜드 보이스 프로필을 지정할 수도 있어요.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

솔직하게 짚고 넘어갈 주의 사항이 두 가지 있어요. 이 지표들은 **참고용(informational)**이며(리더보드의 chrF++ 대표 점수나 순위에 전혀 반영되지 않는 진단용 지표), 격식 감지는 마커 기반으로 이루어져 사람의 판단이 아닌 변화 감지기(drift detector) 역할을 한다는 점이에요. 자세한 내용과 지표 정의는 [문체 및 사용역 지표](/docs/network/specifications/harness#writing-style-and-register-metrics-informational)에서 확인하실 수 있어요.

## 7단계: CI 통합

푸시할 때마다 번역이 최신 상태로 유지되도록 GitHub Actions 워크플로에 추가하세요:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      # Pinned to the 0.5 line: a new release never changes what this job
      # runs. The CI guide has the complete workflow (the translation cache,
      # partial runs, a dry-run check and verify --strict).
      - name: Sync translations
        run: npx --yes champollion@0.5 sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## 비용 추정

30개 언어에 걸쳐 500개의 소스 키가 있는 프로젝트의 경우:

| 등급 | 언어 | 방법 | 대략적인 비용 |
|------|-----------|--------|-----------------|
| 등급 1 (5개 언어) | ja, ko, zh, de, pt | GPT-4o | 전체 동기화당 ~$2.50 |
| 등급 2 (18개 언어) | it, nl, pl 등 | Google Translate | 전체 동기화당 ~$0.90 |
| 등급 3 (4개 언어) | crk, oj, mi, haw | GPT-4o-mini 코칭 | 전체 동기화당 ~$0.40 |
| **합계** | **30개 언어** | **혼합** | **전체 동기화당 ~$3.80** |

증분 동기화(변경된 키 5~20개)의 비용은 전체 동기화의 일부에 불과해요.

## 참고 항목

- [번역 방식](/docs/guides/translation-methods) — 각 번역 방식의 작동 원리와 사용 시기
- [플러그인 사양](/docs/reference/plugin-spec) — 모든 Tier 3 언어를 위한 코칭 데이터 만들기
- [CI/CD 가이드](/docs/guides/ci-cd) — PR 미리보기 빌드를 포함한 고급 CI 패턴
- [품질 게이트(Quality Gate)](/docs/concepts/quality-gate) — 번역을 파일에 쓰기 전에 손상된 출력이 없는지 Champollion이 검사하는 방식
- [지원 언어](/docs/reference/supported-languages) — 언어 코드 전체 목록 및 번역 방식 호환성
- [문체 및 사용역 지표](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — 평가 하네스(eval harness)를 활용한 사용역/문체 준수도 측정(참고용 지표)
- [용어집: 사용역](/glossary#term-register) — 쉬운 말로 풀어쓴 "사용역(register)"의 개념
- [저자원 언어 지원](/docs/network/community/low-resource-languages) — 광범위한 기계 번역 지원이 부족한 언어를 위한 코칭 데이터 추가하기
