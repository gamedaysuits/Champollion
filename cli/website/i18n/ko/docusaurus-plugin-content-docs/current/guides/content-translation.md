---
sidebar_position: 5
title: "콘텐츠 번역"
---

# 콘텐츠 번역 (Markdown)

Champollion은 Markdown 및 MDX 파일의 프런트매터 필드와 본문을 모두 번역해요. 코드 블록, 숏코드 및 기타 구조화된 요소는 번역되지 않도록 보호돼요.

파일들은 **콘텐츠 디렉터리**(`contentDir`)에 위치해요. 이 디렉터리는 Markdown 파일이 있는 어떤 폴더든 될 수 있어요. Hugo 사이트의 `content/`일 수도 있고, Next.js 앱 내부의 뉴스레터 폴더일 수도 있죠. Docusaurus 사이트(`docusaurus.config.js`가 있는 사이트)는 방식이 달라요. `docs/` 및 `blog/`가 `contentDir` 없이 `i18n/<locale>/` 폴더로 번역돼요. 자세한 내용은 [프레임워크 연동](/docs/guides/framework-integration)을 참고하세요.

## 설정

설정 파일에서 `contentDir`를 설정하거나, 명령줄에서 `--content-dir`를 전달하세요:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

동기화가 시작될 때, sync는 해당 폴더의 이름을 표시하고 번역 결과가 어디로 저장될지 알려줘요:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Hugo 사이트인 경우 감지된 근거(예: `Detected framework: Hugo (hugo.toml)`)도 함께 표시해요. `hugo.toml`/`.yaml`/`.yml`/`.json` 파일, Hugo의 `config/_default/` 폴더, `baseURL` 같은 Hugo 전용 설정이 포함된 `config.toml` 또는 `config.yaml`, `archetypes/` 폴더, 또는 Hugo 템플릿이 들어 있는 `layouts/` 폴더가 있으면 Hugo 사이트로 감지돼요. Hugo 사이트이든 아니든, 파일은 동일한 방식으로 번역되고 이름이 지정돼요.

## 번역 파일이 저장되는 위치

각 번역 파일은 확장자 앞에 대상 로캘이 추가되어 **원본 파일 바로 옆에** 저장돼요. 이는 Hugo의 '파일명 기반 번역' 규칙이에요:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

하위 폴더도 함께 검색되며, 각 번역 파일은 해당 원본 파일이 있는 폴더에 유지돼요. 애플리케이션은 이 이름을 통해 특정 로캘에 맞는 파일을 선택해요. 예를 들어 Next.js 페이지는 Plains Cree용으로 `newsletters/2026-10.crk.md`을 읽어요.

**어떤 파일이 원본으로 간주되는가.** 폴더 내의 모든 `.md` 및 `.mdx` 파일은 원본으로 간주돼요. 단, 파일명이 `.<code>.md`(또는 `.mdx`)로 끝나고 `<code>` 부분이 언어 코드처럼 보이는 경우는 제외돼요. 여기서 언어 코드는 소문자 2~3글자이며, 선택적으로 `-Hant` 같은 문자 체계 및/또는 `-BR`, `-419` 같은 지역 코드가 뒤따를 수 있어요. 이런 파일은 번역본으로 인식되어 건너뛰어요. 원본 언어 접미사(`launch.en.md`)가 붙은 파일은 여전히 원본으로 간주돼요. 한 가지 주의할 점은, `guide.faq.md`와 같은 이름의 원본 파일도 2~3글자의 접미사로 끝나기 때문에 "faq"로의 번역 파일로 오인되어 번역되지 않는다는 것이에요. 이런 파일은 `guide-faq.md` 등으로 이름을 변경해 주세요.

## 번역되는 항목

### Front Matter

YAML(`---`)과 TOML(`+++`) 구분자 모두 지원됩니다. 기본적으로 다음 필드가 번역됩니다:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

다른 모든 필드(`date`, `draft`, `tags`, `weight`, `slug` 등)는 원본에서 그대로 복사돼요. 설정 파일의 `translatableFields`로 이 목록을 변경할 수 있어요.

### 본문 콘텐츠

기본적으로 본문은 문단 및 기타 최상위 블록으로 분할되며, 각 블록 단위로 번역돼요. 구조화된 요소는 번역 전에 플레이스홀더로 보호된 후 번역이 끝나면 복원돼요. `contentSegmentation: "page"` 옵션을 사용하면 본문 전체가 하나의 덩어리로 번역돼요.

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

## 파일이 다시 번역되는 시점

Sync는 `.champollion-content.lock`에 각 원본 파일의 핑거프린트(SHA-256)를 기록해요. 이 파일을 번역 결과와 함께 커밋하세요.

- **원본 변경 없음:** 번역 파일은 수정되지 않아요.
- **원본 변경됨:** 파일이 업데이트돼요. 영어 원문이 변경되지 않은 문단은 [번역 메모리](/docs/concepts/translation-memory)에서 비용 없이 가져오므로, 변경된 문단에 대해서만 비용을 지불하면 돼요.
- **잠금 항목이 없는 번역 파일**(직접 작성한 파일)은 그대로 유지되며 사용자가 작성한 것으로 기록돼요. 단, 0.5.0 미만 버전의 CLI에서 작성된 `[EN] ` 마커가 여전히 포함된 파일은 예외적으로 다시 번역돼요.
- **사유와 함께 재시도한 후에도 품질 게이트에서 거부된 블록**은 페이지에 아무런 마커 없이 원본 텍스트를 유지해요. 해당 페이지의 잠금 항목에는 `pending:<hash>`가 기록되고, 거부 내역은 `.champollion-content.lock`에 저장돼요. 이후 sync 실행 시 해당 블록을 동일한 모델로 다시 전송하지 않으므로 추가 요금이 청구되지 않아요. `status` 및 `verify`에서 해당 페이지 목록을 확인할 수 있어요. `--redo files:<page>`로 다시 요청하거나, `fallback` 방식을 추가하거나, 문단을 직접 작성할 수 있어요(직접 작성한 내용은 유지돼요). 거부된 프런트매터 필드도 같은 방식으로 원본 텍스트를 유지하며, 페이지의 나머지 부분은 정상적으로 작성돼요. 자세한 내용은 [거부된 Markdown 블록 및 프런트매터 필드](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)를 참고하세요.

파일을 의도적으로 다시 번역하려면 파일명을 직접 지정하세요. 경로는 sync가 출력하는 경로로, 콘텐츠 디렉터리에 대한 상대 경로예요:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## 번역 검토 및 편집 {#reviewing-and-editing-translations}

검토자는 번역된 파일에서 직접 번역된 Markdown을 수정할 수 있어요. 나중에 원본이 변경되더라도 Champollion은 이러한 수정 사항을 보존해요.

1. `champollion sync`를 실행하고 번역 결과와 함께 `.champollion-content.lock`를 커밋하세요.
2. 검토자가 번역된 파일(예: `newsletters/2026-10.crk.md`)을 열고 편집해요. 어떤 문단이든 수정할 수 있고, `title`나 `description` 같은 번역된 프런트매터 필드도 수정할 수 있어요.
3. 검토자가 파일을 커밋해요. 수정한 내용을 "적용"하기 위해 별도의 명령을 실행할 필요는 없어요.

다음 `champollion sync` 실행 시 수정 사항이 처리되는 방식:

| 상황 | sync의 동작 |
|---|---|
| 원본이 변경되지 않은 경우 | 아무 작업도 하지 않아요. 번역 파일은 검토자가 남겨둔 상태 그대로 유지돼요. |
| 원본의 **다른** 문단이 변경된 경우 | 검토자가 수정한 문단과 필드는 **그대로 유지**되고 변경된 문단만 번역돼요. 실행 시 이 내용이 표시돼요(예: `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`). 검토자의 텍스트는 이후 모든 sync 작업에서도 그대로 유지돼요. |
| 검토자가 수정한 원본 문단이 **함께** 변경된 경우 | 검토자의 버전은 더 이상 존재하지 않는 영어 원문을 번역한 것이므로 해당 문단이 다시 번역돼요. 실행 시 검토자가 작성했던 문구가 포함된 경고가 출력되므로, 여전히 적절하다면 다시 적용할 수 있어요. |
| 검토자가 문단을 추가, 삭제 또는 병합했거나 해당 언어 쌍이 `contentSegmentation: "page"`를 사용하는 경우 | 문단 단위로 수정을 매칭할 수 없어요. 원본이 변경되면 파일은 **있는 그대로 유지**되며, 문제가 해결될 때까지 매번 sync 실행 시 경고와 함께 목록에 표시돼요. 직접 수동으로 업데이트하거나(이후 sync에서 수정된 파일을 최신 상태로 인식함), `--redo files:<path>`를 사용해 기계 번역으로 교체하세요. |

코드 블록, 문단 사이의 공백, 그리고 번역되지 않는 프런트매터 필드(`date`, `tags` 등)에 가해진 수정 사항은 파일을 다시 작성할 때 유지되지 않아요. 이 부분들은 항상 원본에서 가져와요.

**의도적으로 수정 사항 덮어쓰기.** 수정 사항은 파일명을 명시적으로 지정했을 때만 덮어써져요. `--redo files:2026-10.md`는 캐시된 기계 번역을 다시 적용해요. `--redo files:2026-10.md --fresh`(또는 `--retranslate 2026-10.md`)는 처음부터 다시 번역해요. 파일명을 지정하지 않고 모든 콘텐츠를 다시 처리하는 실행(`--redo content`, `--force-content`)에서는 수정 사항이 유지돼요.

**수정 사항을 인식하는 방식.** sync가 번역을 작성할 때마다, 작성한 모든 문단의 짧은 핑거프린트를 `.champollion-content.lock`에 함께 기록해요. 디스크의 문단이 이와 더 이상 일치하지 않으면 사람이 수정한 것으로 판단해요. 잠금 파일이 유실되면 수정 사항을 인식할 수 없으므로 반드시 버전 관리에 포함하세요. 이전 버전의 Champollion에서 작성된 번역은 다음 sync 실행 시 기록돼요. 해당 파일에 가한 수정 사항이 번역 메모리에 보관된 내용과 다르면 사용자가 수정한 것으로 인식돼요.

검토자가 작성한 텍스트는 기계 번역 결과물로서 번역 메모리에 저장되지 않아요.

:::note[XLIFF는 문자열 파일만 지원해요]
`champollion xliff export`는 앱의 **문자열 파일**(키 및 값)을 번역가의 CAT 툴로 전달해 줘요. 자세한 내용은 [전문 번역가와의 협업](/docs/guides/professional-translators)을 참고하세요. 아직 Markdown 콘텐츠에 대한 XLIFF 내보내기는 지원되지 않으므로, 번역된 Markdown은 위에서 설명한 대로 파일 내부에서 직접 검토해요.
:::

## Markdown 전용 메서드

:::warning[Google Translate와 Markdown]
Google Translate는 코드 블록, 숏코드, 보간 변수를 **전혀 인식하지 못해요**. 구조화된 Markdown 콘텐츠가 손상될 수 있어요. 콘텐츠 번역에는 구조화된 요소를 명시적으로 보호하는 LLM 방식(`llm` 또는 `llm-coached`)을 사용하세요.
:::

콘텐츠 번역이 Google Translate에서 LLM 메서드로 폴백되면, champollion은 그 이유를 설명하는 경고를 기록합니다.
