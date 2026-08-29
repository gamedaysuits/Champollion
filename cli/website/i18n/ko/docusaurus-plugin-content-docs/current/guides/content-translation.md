---
sidebar_position: 5
title: "콘텐츠 번역"
---

# 콘텐츠 번역 (Hugo Markdown)

Champollion은 Hugo Markdown 파일을 번역합니다 — front matter 필드와 본문 콘텐츠 모두 — 코드 블록, 쇼트코드, 구조화된 요소를 완벽하게 보호하면서요.

## 설정

Markdown 콘텐츠 번역을 활성화하려면 설정에서 `contentDir`을 지정하세요:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## 번역되는 항목

### Front Matter

YAML(`---`)과 TOML(`+++`) 구분자 모두 지원됩니다. 기본적으로 다음 필드가 번역됩니다:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

그 외 모든 필드(`date`, `draft`, `tags`, `weight`, `slug` 등)는 그대로 유지됩니다. 설정에서 `translatableFields`로 커스터마이징하세요.

### 본문 콘텐츠

전체 Markdown 본문은 블록 보호와 함께 번역됩니다 — 구조화된 요소는 번역 전에 Unicode 센티넬 플레이스홀더로 보호되었다가 번역 후에 복원됩니다.

## 블록 보호

다음 요소들은 번역 과정에서 손대지 않고 그대로 통과됩니다:

| 요소 | 예시 | 보호 |
|---------|---------|-----------|
| 코드 블록 | ``````` ```js ... ``` ``````` | 전체 블록 보호 |
| 인라인 코드 | `` `variable` `` | 보호됨 |
| Hugo 쇼트코드 | `{{< figure >}}`, `{{% note %}}` | 전체 블록 보호 |
| Raw HTML | `<div>`, `<table>` | 보호됨 |
| 링크 (URL) | `[text](https://...)` | URL 유지, 텍스트 번역 |
| 보간(Interpolation) | `{{ .Count }}` | 보호됨 |

## 파일명 규칙

Hugo의 파일명 기반 번역 패턴을 따릅니다:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## 건너뛰기 동작

이미 번역된 파일은 **절대 덮어쓰지 않습니다**. `my-post.fr.md`가 이미 존재하면 건너뜁니다. 재번역을 강제하려면 대상 파일을 삭제하세요.

## Markdown 전용 메서드

:::warning[Google Translate와 Markdown]
Google Translate는 코드 블록, 숏코드, 또는 보간 변수를 **인식하지 못해요**. 구조화된 Markdown 콘텐츠를 손상시킬 거예요. 콘텐츠 번역에는 LLM 방식(`llm` 또는 `llm-coached`)을 사용하세요 — 이들은 구조화된 요소를 명시적으로 보호해요.
:::

콘텐츠 번역이 Google Translate에서 LLM 메서드로 폴백되면, champollion은 그 이유를 설명하는 경고를 기록합니다.
