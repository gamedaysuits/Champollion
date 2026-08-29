---
sidebar_position: 6
title: "스크립트 변환기"
---

# Script Converters

Script converters는 텍스트를 한 문자 체계에서 다른 문자 체계로 변환하는 결정론적이고 LLM이 필요 없는 번역 후 후크입니다. "한 번 번역하고 여러 문자 체계로 렌더링"하는 워크플로를 가능하게 해요 — 작업용 문자 체계(일반적으로 Latin)로 번역한 다음, 표시용 문자 체계로 자동 변환하는 방식이에요.

## Script Converters를 사용하는 이유

일부 언어는 동일한 구어에 대해 여러 문자 체계를 사용해요:

- **Plains Cree**: 편집용 SRO(Latin) → 표시용 음절문자(ᓀᐦᐃᔭᐍᐏᐣ)
- **Serbian**: 국제용 Latin → 국내용 Cyrillic
- **Klingon**: 입력용 로마자 표기 → 표시용 pIqaD (  )

비(非)Latin 문자 체계로 직접 번역하면 문제가 생겨요: LLM이 문자를 환각으로 만들어내고, JSON 파일은 버전 관리가 어려워지며, diff 도구가 변경 사항을 비교하지 못해요. Script converters는 번역을 버전 관리에 적합한 문자 체계로 유지하고 동기화 시점에 결정론적으로 변환함으로써 이 문제를 해결해요.

## 사용 가능한 변환기

Champollion에는 다섯 가지 내장 script converter가 함께 제공돼요:

| Locale | From | To | Type | Font Required? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Cree Syllabics | Deterministic | No — native Unicode |
| `sr` | Latin | Cyrillic | Deterministic | No — native Unicode |
| `tlh` | Romanization | pIqaD | Deterministic | Yes — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Mode of Beleriand) | Deterministic | Yes — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Font-based cipher | Yes — PUA U+E100–E119 |

### 결정론적 방식 vs. 폰트 기반 방식

- **결정론적 변환기**(Cree, Serbian, Klingon, Tengwar)는 언어 규칙을 사용하여 실제 문자 대 문자 매핑을 수행해요. 출력에는 실제 Unicode 문자가 포함돼요.
- **폰트 기반 변환기**(Kryptonian)는 1:1 치환 암호로, 출력이 특정 폰트가 로드되어야만 올바르게 렌더링되는 Unicode PUA 문자예요.

## 작동 방식

Script converters는 번역 **후** 후처리 단계로 실행돼요. 파이프라인은 다음과 같아요:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

예를 들어 Plains Cree의 경우:
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### 탐욕적 좌에서 우로의 매칭

모든 변환기는 동일한 알고리즘을 사용해요: 각 문자 위치에서 먼저 가능한 가장 긴 매칭을 시도한 다음, 점차 더 짧은 매칭을 시도해요. 어떤 패턴과도 매칭되지 않는 문자(공백, 구두점, 숫자)는 변경 없이 그대로 통과해요.

이 방식은 이중자(digraph)와 삼중자(trigraph)를 올바르게 처리해요:
- Klingon: `tlh` → 단일 pIqaD 문자 (`t` + `l` + `h`이 아님)
- Serbian: `nj` → `њ` (`н` + `ј`이 아님)
- Cree: `twê` → 단일 음절문자 (`t` + `w` + `ê`이 아님)

## Script Converters 사용하기

변환은 **설정에서 결정해야 하며, 절대 자동으로 이루어지지 않아요** (0.3.0 버전부터 — 이전 버전은 무조건 변환을 수행하여, 라틴어 음역을 예상하는 폰트를 사용하는 프로젝트에 렌더링할 수 없는 PUA 텍스트를 배포했어요):

- **crk와 sr에는 두 가지 실제 정서법이 있어요** (SRO/음절 문자, 라틴/키릴 문자). 기본값은 없어요: `champollion init`는 어떤 문자로 작성할지 묻고, `sync`는 설정에 명시될 때까지 실행을 거부해요. Champollion은 특정 커뮤니티의 표기 체계를 임의로 선택하지 않아요.
- **tlh, x-elvish-s 및 x-kryptonian은 로마자 표기가 기본값이에요** — 이들의 표시 문자는 사용자 정의 영역(Private Use Area)이므로 특수 폰트 없이는 렌더링할 수 없어요. 명시적으로 사용을 설정해야 해요.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

champollion이 `en:crk`을 `"script": "Cans"`과 동기화할 때, 번역은 SRO(게이트가 검증하는 작업 문자)로 생성된 다음, `crk.json`에 쓰기 전에 음절 문자(Syllabics)로 변환돼요. `"script": "Latn"`를 사용하거나 — 또는 `script:`가 전혀 없는 tlh의 경우 — 작업 문자가 최종 결과물이 되며 아무것도 변환되지 않아요.

변환기가 매핑할 수 없는 글자(Klingon에는 `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z`가 없어서 "GitHub"를 완전히 변환할 수 없어요)는 문자를 섞어 쓰지 않고 작업 문자의 **전체 값**을 유지하며, 해당 글자를 명시하는 경고를 표시해요. [`scriptFallback`](/docs/getting-started/configuration#script-fallback)를 사용하여 자체 음역 규칙을 선언해 주세요.

무조건적으로 변환이 적용되던 시절에 발생한 변환을 되돌리려면 [`champollion repair-script`](/docs/getting-started/configuration#repair-script)를 실행해 주세요. 변환이 꺼져 있는 곳에서 PUA가 발견되면 `champollion integrity`는 실패해요.

### 변환기 상태 확인하기

```bash
npx champollion status
```

상태 출력에는 각 쌍에 대해 확정된 문자 결정 사항이 표시돼요. 즉, 어떤 문자로 작성될지, 그리고 변환기를 사용할 수 있지만 활성화되지 않았는지 여부를 보여줘요.

## 웹 폰트 요구 사항

세 가지 변환기는 사용자 정의 웹 폰트가 필요한 Unicode Private Use Area(PUA) 문자를 출력해요:

### Klingon (pIqaD)

CSUR 호환 pIqaD 폰트(예: "pIqaD qolqoS" 또는 "Klingon pIqaD HaSta")를 설치하세요:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

CSUR 호환 Tengwar 폰트(예: "Tengwar Formal CSUR", "Tengwar Annatar")를 설치하세요:

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

PUA 코드포인트 U+E100–E119에 매핑된 Kryptonian 폰트를 설치하세요:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Kryptonian을 위한 대체 방법]
Kryptonian은 순수한 A-Z 암호이므로, 스크립트 변환기를 완전히 건너뛰고 CSS를 통해 Latin 텍스트에 폰트를 적용할 수 있어요. 이 방법은 웹 배포에서 더 간단한 경우가 많아요. Kryptonian 폰트를 제공하고 관련 요소에 `font-family`을 설정하기만 하면 돼요.
:::

## 사용자 정의 변환기 추가하기

새로운 언어를 위한 변환기를 추가하려면 `lib/scripts.js`을 편집하세요:

1. **변환 맵 생성** — `[from, to]` 쌍의 정렬된 배열로, 가장 긴 시퀀스를 먼저 배치
2. **변환기 함수 생성** — 탐욕적 좌에서 우로의 스캐너 (`sroToSyllabics`을 템플릿으로 사용)
3. locale 코드를 키로 사용하여 `SCRIPT_CONVERTERS` 객체에 **등록**
4. `registers.js`의 해당 언어 register 항목에 **`script` 필드 추가**

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## 참고 항목

- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — PUA 폰트, Unicode, 새 변환기 추가
- [Quality Gate](/docs/concepts/quality-gate) — script 변환 전에 실행되는 검증
- [Supported Languages](/docs/reference/supported-languages) — 어떤 언어에 script converter가 있는지
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — 맥락 속 SRO→음절문자
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — 다단계 파이프라인에서의 script 변환
