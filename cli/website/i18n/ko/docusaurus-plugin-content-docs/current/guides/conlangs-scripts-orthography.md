---
sidebar_position: 3
title: "인공어, 문자 체계 및 표기법"
---

# 인공어, 스크립트 및 정서법

champollion은 LLM 레지스터와 결정론적 스크립트 변환기를 통해 인공어를 일급으로 지원해요. 이 가이드는 인공어 지원이 어떻게 작동하는지, 어떤 폰트가 필요한지, 그리고 직접 추가하는 방법을 다뤄요.

:::tip[인공어가 중요한 이유]
인공어는 단순한 신기함에 그치지 않아요. 실제로 소외된 언어에 사용되는 것과 완전히 동일한 인프라를 활용해요. 품질 게이트, 코칭 시스템, 스크립트 변환 파이프라인은 Klingon과 Plains Cree에 대해 동일하게 작동해요. 인공어 파이프라인이 작동한다면, 저자원 언어 파이프라인도 작동할 거예요.
:::

---

## 지원되는 인공어

| 언어 | 코드 | 스크립트 변환기 | 필요한 폰트 |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ 로마자 표기 → pIqaD | PUA 폰트 (예: pIqaD qolqoS) |
| Sindarin (Tolkien Elvish) | `x-elvish-s` | ✅ Latin → Tengwar | CSUR PUA 폰트 |
| Kryptonian | `x-kryptonian` | ✅ Latin → Kryptonian | PUA 폰트 |
| Pirate English | `x-pirate` | ❌ 레지스터 전용 | 없음 |
| Shakespearean English | `x-shakespeare` | ❌ 레지스터 전용 | 없음 |
| Yoda-speak | `x-yoda` | ❌ 레지스터 전용 | 없음 |

인공어 코드는 BCP-47 사적 사용 관례에 따라 `x-` 접두사를 사용하는데, SIL International이 할당한 [ISO 639-3](https://iso639-3.sil.org/code/tlh) 코드를 가진 Klingon (`tlh`)은 예외예요.

---

## 유니코드, PUA 및 폰트 요구사항

### 사적 사용 영역

Klingon (pIqaD), Sindarin (Tengwar), Kryptonian은 유니코드 **사적 사용 영역(Private Use Area, PUA)** 문자를 사용해요. PUA는 U+E000–U+F8FF 범위로 — 이 코드포인트에는 **표준 할당이 없어요**. [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/)는 가상 스크립트에 대해 커뮤니티가 합의한 매핑을 유지하지만, 이는 유니코드 표준의 일부가 아니에요.

실제로 이것이 의미하는 바는 다음과 같아요:

- PUA 텍스트는 올바른 폰트가 로드되지 않으면 **빈 상자**(□□□)로 렌더링돼요
- 폰트마다 동일한 PUA 코드포인트에 다른 글리프를 매핑할 수 있어요
- champollion은 PUA 폰트를 번들로 제공하지 않아요 — 직접 로드해야 해요
- 시스템 폰트로는 이 문자들이 절대 렌더링되지 않아요

### 스크립트별 PUA 범위

| 스크립트 | PUA 범위 | CSUR 참조 |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elvish) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | 폰트에 따라 다름 | CSUR 표준 없음 |

### PUA 웹 폰트 로드하기

champollion은 PUA 웹 폰트를 다운로드하고 관리하는 내장 명령을 포함하고 있어요:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

`fonts install` 명령은 검증된 오픈소스 저장소에서 다운로드해요:

| 폰트 | 스크립트 | 라이선스 | 출처 |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (폰트 예외 포함) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(사용자 제공)* | Kryptonian | 다양함 | 사용 가능한 오픈소스 PUA 폰트 없음 |

출력 디렉터리는 프로젝트 구조에서 자동으로 감지돼요 (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, 기본값 → `public/fonts/`). `--dir`로 재정의할 수 있어요.

폰트를 수동으로 관리하고 싶다면, CSS에 `@font-face` 규칙을 추가하세요:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[유니코드 지원은 보장되지 않아요]
Unicode Consortium은 표준에 가상의 스크립트를 인코딩하는 것을 [명시적으로 거부했어요](https://www.unicode.org/faq/private_use.html). PUA 할당은 커뮤니티에서 관리되며 폰트 구현 간에 충돌할 수 있어요. 항상 프로젝트에서 사용하는 정확한 폰트를 지정하고, 여러 브라우저에서 렌더링을 테스트하세요.
:::

---

## 스크립트 변환기

### 작동 방식

Champollion의 문자 변환은 **설정에서 요청할 때만 적용되는 번역 후 훅(post-translation hook)이에요**:

1. LLM이 텍스트를 **작업용 문자**(일반적으로 라틴 문자 또는 SRO)로 번역해요.
2. [품질 게이트](/docs/concepts/quality-gate)가 출력 결과를 검증해요.
3. 페어의 `script:` 설정에서 표시용 문자를 선택하면, 결정론적 변환기가 검증된 텍스트를 변환해요. 변환기가 매핑할 수 없는 글자가 포함된 값은 작업용 문자 그대로 유지되며, 키별로 경고가 발생해요.
4. 결과가 디스크에 기록돼요.

이 두 단계 접근 방식은 LLM이 Latin 기반 스크립트로 작업할 때 더 나은 출력을 생성하기 때문에 효과적이에요. 결정론적 변환기는 모델의 (종종 신뢰할 수 없는) 스크립트 지식에 의존하지 않고 올바른 스크립트 출력을 보장해요.

3단계의 실행 여부는 프로젝트별로 결정돼요. [문자 변환](/docs/getting-started/configuration#script-conversion)을 참고해 주세요. PUA 표시용 문자(pIqaD, Tengwar, Kryptonian)는 전용 폰트가 없으면 아무것도 렌더링되지 않기 때문에 기본적으로 꺼져 있어요. crk와 sr은 두 정서법이 모두 실제 사용되며 선택은 프로젝트의 몫이기 때문에 기본값이 아예 없어요.

### 다섯 가지 변환기 모두

champollion은 다섯 가지 내장 스크립트 변환기를 제공해요:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography를 Canadian Aboriginal Syllabics로 변환해요.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

장모음은 매크론/곡절 부호를 사용해요: ê, î, ô, â. 변환기는 모든 SRO 분음 부호를 처리하여 올바른 음절 문자로 매핑해요. 전체 Cree 파이프라인은 [저자원 언어 지원하기](/docs/network/community/low-resource-languages)를 참조하세요.

#### Serbian: Latin → Cyrillic (`sr`)

Serbian에 대한 결정론적 Latin-to-Cyrillic 변환이에요.

```
Input:  "zdravo"
Output: "здраво"
```

이는 이중자(lj → љ, nj → њ, dž → џ)를 포함한 전체 Serbian 알파벳 매핑을 처리해요.

#### Klingon: 로마자 표기 → pIqaD (`tlh`)

Marc Okrand의 로마자 표기 시스템을 pIqaD PUA 문자로 변환해요.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

Tolkien의 Sindarin 모드 Tengwar 매핑이에요.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latin → Kryptonian (`x-kryptonian`)

팬 어휘집 Kryptonian 스크립트 매핑이에요.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### 변환기 트리거하기

`script` 필드를 작성하려는 정서법의 ISO 15924 코드로 설정해 주세요:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

이 설정 없이는 아무것도 변환되지 않아요. `crk` 및 `sr`의 경우 이 필드는 **필수**예요. 두 정서법 모두 실제로 사용되며, `sync`은(는) 사용자를 대신해 임의로 하나를 선택하지 않아요. PUA 로캘의 경우 기본 로마자 표기 대신 선택적으로 적용(opt-in)할 수 있어요. [문자 변환](/docs/getting-started/configuration#script-conversion)을 참고해 주세요.

---

## 다중 스크립트 언어

일부 실제 언어는 여러 활성 스크립트를 사용해요:

| 언어 | 문자 | Champollion 접근 방식 |
|----------|---------|-----------------|
| 세르비아어 | 라틴 문자 + 키릴 문자 | 단일 로캘, 명시적 선택: `"script": "Cyrl"`은(는) 변환하고, `"script": "Latn"`은(는) 라틴 문자를 유지해요 |
| 평원 크리어 | SRO (라틴 문자) + 음절 문자 | 단일 로캘, 명시적 선택: `"script": "Cans"` 또는 `"script": "Latn"` |
| 중국어 | 간체 + 번체 | 서로 다른 레지스터를 가진 별도의 로캘 코드 (`zh` 대 `zh-TW`) |

두 문자가 동일한 대상 독자에게 제공되는 언어(세르비아어, 평원 크리어)의 경우, 하나의 로캘과 명시적인 `script` 선택을 통해 단일 번역 파이프라인을 유지해요. 문자가 서로 다른 대상 독자에게 제공되는 언어(중국 본토의 중국어 간체, 대만/홍콩의 번체)의 경우에는 별도의 로캘 코드를 사용해 주세요.

---

## 정서법 참고사항

레지스터는 단순한 어조만이 아니에요 — LLM을 올바른 작문 규칙으로 이끄는 **정서법 지침**을 담고 있어요.

### 격식체 호칭 형식

champollion의 내장 레지스터는 각 언어에 문화적으로 적절한 격식체 호칭을 포함해요:

| 언어 | 격식 형식 | 레지스터 지침 |
|----------|------------|---------------------|
| German | Sie | `Use Sie-form for formal address` |
| French | vous | `Use vous-form` |
| Russian | вы | `Professional register with вы-form` |
| Turkish | siz | `Professional register with siz-form` |
| Korean | 합쇼체 | `Formal Korean (합쇼체)` |
| Japanese | です/ます | `Polite professional register (です/ます form)` |
| Polish | Pan/Pani | `Professional register with Pan/Pani form` |

### 성 중립적 작문

각 언어 카드에는 언어별 조언이 담긴 `gender.inclusiveGuidance` 필드가 있어요. 이는 레지스터 프리셋과 별도로 LLM 번역 프롬프트에 주입되므로, 사용자가 어떤 격식 프리셋을 선택하든 일관되게 적용돼요:

- **French**: 가운뎃점 표기를 사용한 Écriture inclusive (예: "Connecté·e")
- **German**: Doppelpunkt 표기 (예: "Benutzer:innen")
- **Spanish**: 성 중립적 재구성 선호; 대체 수단으로 슬래시 표기 (예: "usuario/a")

카드에 특정 지침이 없는 언어(예: Korean, 인공어)의 경우, 시스템은 일반 규칙으로 대체해요: *"성 중립적 형식 또는 사용 가능한 가장 포용적인 옵션을 선호하세요."*

### RTL 스크립트 요구사항

Arabic, Hebrew, Persian, Urdu 레지스터는 모두 오른쪽에서 왼쪽 요구사항을 명시해요: `Ensure text reads naturally in RTL layout contexts.`

### 모든 레지스터 재정의하기

모든 레지스터는 설정 값이에요 — 프로젝트의 목소리에 맞게 재정의하세요:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

전체 설정 참조는 [Configuration](/docs/getting-started/configuration)을 참조하세요.

---

## 새 인공어 추가하기

### 단계별 안내

1. **BCP-47 사적 사용 코드 선택하기**: `x-` 접두사를 사용하세요 (예: `x-dothraki`, `x-valyrian`).

2. **설정에 추가하기**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(선택사항) 스크립트 변환기 추가하기**: 인공어가 Latin이 아닌 표시 스크립트를 사용하는 경우, `lib/scripts.js`에 변환기를 추가하고 `SCRIPT_CONVERTERS`에 등록하세요.

4. **테스트하기**: 파일을 쓰지 않고 번역을 미리 보려면 `champollion sync --dry`를 실행하세요.

5. **품질 게이트 확인하기**: [품질 게이트](/docs/concepts/quality-gate)는 인공어에 맞게 조정이 필요할 수 있어요 — 특히 인공어가 PUA 문자를 사용하는 경우 `requireNonLatin` 검사가 그래요.

:::note[인공어 품질은 LLM의 지식에 좌우돼요]
LLM은 학습 데이터에서 접한 인공어로만 번역할 수 있어요. 잘 문서화된 인공어(Klingon, Sindarin, Dothraki)는 잘 작동해요. 잘 알려지지 않았거나 새로 만들어진 인공어는 일관되지 않은 결과를 낼 수 있어요. 품질을 향상시키려면 [코칭 데이터](/docs/concepts/coaching-data)를 활용하세요.
:::

---

## 참고 항목

- [지원되는 언어](/docs/reference/supported-languages) — 메서드 가용성이 포함된 전체 언어 표
- [스크립트 변환기](/docs/concepts/script-converters) — 변환 파이프라인의 기술적 세부사항
- [번역 메서드](/docs/guides/translation-methods) — 각 번역 메서드의 작동 방식
- [Configuration](/docs/getting-started/configuration) — 언어 및 레지스터 설정을 포함한 설정 참조
- [저자원 언어 지원하기](/docs/network/community/low-resource-languages) — 실제 소외된 언어에 적용된 동일한 인프라
