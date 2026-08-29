---
sidebar_position: 3
title: "Quality Gate"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# 품질 게이트

모든 번역은 디스크에 기록되기 전에 결정론적 검증 게이트를 통과해요. 품질 게이트는 일반적인 기계 번역 실패 모드를 잡아내요 — 조용한 폴백도 없고, 로케일 파일에 쓰레기 데이터가 기록되는 일도 없어요.

## 검증 검사

| 검사 항목 | 탐지 내용 | 게이트 라벨 |
|-------|----------------|-----------|
| **비어있음/공백** | 모델이 빈 문자열이나 공백을 반환함 | `[GATE] empty` |
| **원본 에코** | 모델이 원본 영어 입력을 그대로 반환함 | `[GATE] source-echo` |
| **환각 루프** | 반복되는 트라이그램 패턴 (예: `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **길이 팽창** | 출력 길이가 원본보다 지나치게 긺 | `[GATE] length` |
| **콘텐츠 삭제** | 출력에서 원본의 글자들이 제거됨 | `[GATE] content` |
| **문자 체계 준수** | 대상 로케일에 맞지 않는 문자 체계 | `[GATE] script` |
| **ICU 복수형 범주** | 로케일에 필요한 복수형 형태가 누락됨 | `[GATE] icu-plural` |

[`noTranslate`](/docs/getting-started/configuration#no-translate)로 선언된 키는 게이트에 도달하지 않아요. 원본에서 그대로 복사되므로 검증할 내용이 없기 때문이에요.

### 빈 값/공백

빈 문자열, 공백만 있는 값, 또는 `null`인 번역을 거부해요. 어려운 키에 대해 아무것도 반환하지 않는 모델을 잡아내요.

### 원문 그대로 반환

모델이 번역하지 않고 영어 원문을 그대로 반환하는 경우를 감지해요. 짧은 문자열과 명세가 부족한 프롬프트에서 흔히 발생해요.

짧은 대부분의 ASCII 문자열(30자 이하)은 예외예요. `"Blog"`, `"GitHub"`, `"npm"`은 어디서나 영어로 유지되는 것이 맞으며, 이를 거부하면 무한 루프에 빠지게 돼요.

URL, 저장소 경로, 제품 식별자 등 변경되지 않는 것이 올바른 더 긴 값들은 게이트의 문제가 아니며 게이트를 조정해서 해결할 수 없어요. 정답 자체가 에코(원본 그대로)이기 때문에 모델이 출력할 수 있는 다른 모든 결과는 틀린 것이 돼요. 이러한 키는 [`noTranslate`](/docs/getting-started/configuration#no-translate)로 선언하여 파이프라인을 완전히 우회하도록 하세요. URL 값을 가진 키는 기본적으로 이 방식으로 처리돼요.

### 환각 루프

출력의 trigram(3자) 패턴을 분석해요. 어떤 trigram이 출력 길이 대비 임계값을 초과하여 반복되면 번역이 거부돼요. 이는 `"Qo' Qo' Qo' Qo' Qo'"`와 같은 비정상적인 출력을 잡아내요.

### 길이 팽창

출력 길이가 `maxLengthRatio × source length`(기본값: 4×)을 초과하는 번역을 거부해요. 이는 짧은 입력에 대해 긴 텍스트 덩어리를 생성하는 모델 환각을 잡아내요.

설정 파일의 `maxLengthRatio`를 통해 구성할 수 있어요.

### 콘텐츠 삭제

길이 팽창의 반대 경우예요. 문자열에 대한 어휘가 없는 모델은 번역할 수 없는 모든 글자를 삭제하고 원본의 구두점과 띄어쓰기만 남겨둘 수 있어요.

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

다른 어떤 검사로도 이를 잡아낼 수 없어요. 비어있지도 않고, 에코도 아니며, 반복적이지도 않고, 원본 *길이*의 33% 수준이므로 `minLengthRatio`를 가볍게 통과해요.

이 검사는 원본과 출력 사이의 **콘텐츠 문자**(구두점, 공백, 보이지 않는 서식을 무시한 글자와 숫자)를 비교해요. 하지만 밀도만으로는 규칙이 될 수 없어요. 정상적으로 밀도가 높은 문자 체계도 정확히 같은 위치에 있기 때문이에요.

| 원본 | 출력 | 유지된 콘텐츠 | 판정 |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **거부됨** |
| `Getting started` | `入门` | 14% | 승인됨 |
| `Frequently asked questions` | `常见问题` | 17% | 승인됨 |

첫 번째 경우를 잡아내는 임계값은 중국어, 일본어, 한국어를 완전히 거부하게 돼요. 이들을 구분하는 것은 얼마나 살아남았는지가 아니라 *어디서 왔는지*예요. 속이 빈 출력은 원본에서 문자를 삭제하여 만들 수 있는 원본의 **부분 수열(subsequence)**인 반면, 실제 번역은 원본과 공유하는 부분이 거의 없어요. 플래그를 지정하려면 **두 가지** 신호가 모두 필요하므로, 이 검사는 반복 탐지기와 마찬가지로 필요조건이지만 충분조건은 아니에요.

쌍(pair) 또는 언어별로 `minContentRetention`(기본값 `0.35`)를 통해 구성할 수 있어요. 이 값을 높이면 검사가 더 민감해지며, 항상 부분 수열 신호와 함께 발생해요.

:::note[이것은 품질 조절 다이얼이 아니라 어휘 신호예요]
특정 대상 언어에 대해 이 검사가 반복적으로 발생한다면, 모델이 해당 텍스트에 대한 어휘를 가지고 있지 않다는 뜻이에요. 주로 폐쇄적인 어휘집을 가진 언어에서 짧고 전문 용어가 많은 문자열일 때 발생해요. 임계값을 느슨하게 하면 조용히 손상된 결과가 다시 나타날 뿐, 번역이 생성되지는 않아요. 프롬프트, 코칭 데이터 또는 쌍(pair)을 수정하세요.
:::

### 스크립트 준수

언어 카드에 비라틴 문자 체계(아랍어, CJK, 키릴 문자 등)가 기록된 로케일의 경우, 출력에 실제로 비 ASCII 문자가 포함되어 있는지 검증해요. 해당 로케일에 대해 라틴 문자로만 구성된 출력은 잘못된 문자 체계로 간주되어 거부돼요.

이 검사가 *아닌* 것에 대한 두 가지 명확한 설명이에요.

- 이 검사는 **`script:` 구성 필드에 의해 구동되지 않아요.** 해당 필드는 [문자 체계 변환](/docs/getting-started/configuration#script-conversion)을 위한 출력 정서법을 선택하며, 게이트의 예상 값은 언어 카드에서 가져와요.
- 이 검사는 항상 문자 체계 변환 *이전에* **모델이 내보내는 작업 문자 체계**를 검증해요. 문자 체계 변환기(crk, sr, tlh 등)가 있는 로케일은 정상적으로 라틴 작업 문자 체계 출력을 생성하므로 이 검사에서 제외돼요. 구성에서 선택한 경우 변환은 게이트 이후에 발생해요.

## 실패 시 동작

1. 실패한 번역은 `[GATE]` 접두사, 키 이름, 사유, 그리고 값의 미리보기와 함께 stderr에 로깅돼요
2. 해당 키는 로케일 파일에 기록되지 **않아요**
3. 재시도 캐스케이드가 작동해요 (아래 참조)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## 피드백 재시도 및 재시도 캐스케이드

게이트에서 거부된 키는 **한 번의 피드백 재시도**를 거치게 돼요. 거부 사유가 키별 컨텍스트로 프롬프트에 주입돼요(낮은 온도(temperature)에서 맹목적으로 재시도하면 바이트 단위로 동일한 출력이 반환될 수 있기 때문이에요). 재시도에 통과하면 키가 기록되고 동기화는 **녹색(성공)** 상태가 돼요. 자체적으로 복구되는 게이트 거부는 실패가 아니며, 이것이 의도된 의미 체계예요. 재시도 후에도 여전히 실패하는 키만 건너뛰고 보고되며(동기화가 0이 아닌 값으로 종료됨), 다음 동기화에서 다시 시도돼요.

재시도는 LLM, Google Translate, DeepL 또는 직접 제공자 등 쌍(pair) 자체의 번역 메서드를 통해 실행돼요. 이는 번역 메모리(Translation Memory) 적중 시에도 적용돼요. 게이트가 거부한 캐시된 값은 제거되고 동일한 실행에서 다시 번역되므로, 오염된 캐시가 스스로 복구돼요.

이와 별개로 전체 배치(batch)가 실패하는 경우(JSON 구문 분석 오류), champollion은 점진적으로 더 작은 배치로 재시도해요.

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

재시도 예산은 `maxRetries`(기본값: 3, 언어별 구성 가능)로 제한돼요. 이는 지속적으로 실패하는 키에 대한 토큰 비용 폭주를 방지해요.

재시도를 모두 소진한 후에는 문제가 되는 키가 로깅되고 건너뛰어져요. 이 키들은 다음 `sync` 실행 시 다시 시도돼요.

## 프롬프트 캐싱

시스템 메시지(레지스터, 문법 규칙, 스타일 노트)는 사용자 메시지(번역할 키)와 분리돼요. 이 분리는 의도적이에요:

- 시스템 메시지는 주어진 로케일에 대해 **배치 전반에 걸쳐 동일해요**
- Anthropic과 Google 같은 제공업체는 반복되는 시스템 메시지를 캐싱해요
- 결과적으로 첫 번째 배치는 전체 토큰 비용을 지불하지만, 이후 배치는 사용자 메시지에 대해서만 비용을 지불해요

이는 배치가 많은 프로젝트의 토큰 비용을 크게 줄일 수 있어요.

## ICU MessageFormat 검증

`integrity` 명령은 ICU MessageFormat 복수형 패턴을 CLDR 복수형 규칙과 대조하여 검증해요. 원본 파일이 다음과 같은 ICU 구문을 사용하는 경우:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion은 번역된 버전이 대상 로케일에 필요한 모든 복수형 카테고리를 포함하는지 확인해요. 예를 들어, 아랍어는 `one`과 `other`만이 아니라 여섯 개의 카테고리(`zero`, `one`, `two`, `few`, `many`, `other`)가 필요해요.

`champollion integrity`를 실행하여 모든 로케일에서 복수형 완전성을 확인하세요.

## 용어 강제

사전이 있는 코칭된 쌍의 경우, champollion은 번역 후 용어 검사를 실행해요. 품질 게이트를 통과한 후, LLM이 실제로 필요한 사전 용어를 사용했는지 검증해요.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

용어 위반은 **차단 오류가 아니라 경고예요**. 번역은 여전히 디스크에 기록돼요. 이는 의도적이에요 — LLM이 대안을 선택한 정당한 이유(맥락, 문법)가 있을 수 있고, 용어 불일치로 차단하는 것이 도움보다 해가 될 수 있기 때문이에요.

위반을 수정하려면 코칭 사전을 업데이트하거나 로케일 파일을 수동으로 편집하세요.

---

## 참고 항목

- [동기화 작동 방식](/docs/concepts/how-sync-works) — 품질 게이트가 파이프라인에서 어디에 위치하는지
- [번역 방법](/docs/guides/translation-methods) — 게이트로 입력되는 방법들
- [스크립트 변환기](/docs/concepts/script-converters) — 게이트 통과 후 스크립트 변환
- [코칭 데이터](/docs/concepts/coaching-data) — 상위 단계에서 번역 품질 개선
- [번역 메모리](/docs/concepts/translation-memory) — 검증된 번역 캐싱
- [CLI 참조 — sync](/docs/reference/cli#sync) — 재시도 동작을 포함한 sync 플래그
- [CLI 참조 — integrity](/docs/reference/cli#integrity) — ICU 복수형 감사
