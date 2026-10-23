---
sidebar_position: 1
slug: /intro
title: "앱 및 사이트 번역"
description: "`champollion sync`로 앱이나 웹사이트의 자체 파일을 번역하기 위한 레퍼런스예요. 어떤 기능을 하는지, 언제 사용하는지, 관련 모든 페이지에 대한 안내를 담고 있어요."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# 앱 및 사이트 번역

`champollion sync`은 앱이나 웹사이트의 번역을 원본 언어의 변경 사항과 일치하도록 유지해 줘요. 로케일 파일(또는 마크다운 페이지)을 읽고, 빠지거나 오래된 항목만 찾아 번역한 뒤, 각 결과를 검사하여 원래 파일 형식 그대로 다시 저장해요.

```bash
npx champollion sync
```

이 섹션은 이 워크플로에 대한 레퍼런스 문서예요. 쉬운 설명부터 먼저 보고 싶다면 [앱이나 웹사이트 번역하기](/docs/translate-an-app-or-website) 문서를 읽어보세요.

## `sync`의 동작 방식

1. **파일 찾기.** 로케일 폴더와 형식(JSON, TOML, YAML, gettext PO, Flutter ARB) 또는 마크다운/MDX 페이지 폴더(Hugo, Docusaurus 또는 `--content-dir`으로 지정한 모든 폴더)를 감지해요.
2. **변경 사항 파악.** 모든 원본 값은 `.champollion.lock`에 SHA-256 해시로 기록돼요. 누락되었거나 비어 있는 키, 또는 원본 텍스트가 변경된 키만 대기열에 추가되고 나머지는 그대로 유지돼요.
3. **언어쌍별로 선택한 방식으로 번역.** 하나의 설정 파일에서 어떤 언어쌍은 LLM으로, 다른 언어쌍은 기계 번역 API로, 또 다른 언어쌍은 직접 학습시켜 서빙하는 모델로 보낼 수 있어요. LLM 방식은 기본적으로 온도(temperature) 0으로 번역해요(`shared/model-defaults.json`의 유일한 기본값이에요). 호스팅된 모델은 실행마다 조금씩 달라질 수 있는데, 번역 메모리(Translation Memory)가 이미 얻은 결과를 보관하는 이유 중 하나이기도 해요.
4. **이미 비용을 치른 번역 재사용.** 번역 메모리는 원본 텍스트, 로케일, 번역 방식별로 각 번역을 캐시해요. 다시 돌아온 텍스트(원래대로 되돌린 문자열, 다른 파일에 있는 동일한 문장, 재작업 등)는 추가 비용 없이 처리돼요.
5. **저장하기 전에 모든 결과 검사.** 품질 게이트(Quality gate)는 빈 출력, 원본 그대로 복사된 결과, 반복 루프, 잘못된 문자 체계(script), 손상된 플레이스홀더 및 이와 유사한 오류를 거부하며, 피드백을 반영해 한 번 재시도해요. 이는 잘못된 의미가 아니라 깨진 출력을 잡아내요.
6. **저장 후 검증.** 동기화 후 단계에서 저장된 파일을 다시 읽어 키 일치 여부, 빈 값, 문자 체계, 플레이스홀더를 확인해요. `champollion verify` 및 `champollion audit` 명령어도 CI 게이트로서 같은 종류의 검사를 실행해요.

어떤 것도 알림 없이 몰래 저장되지 않아요. 재시도 후에도 게이트가 거부한 키는 미번역 상태로 남겨져 보고되며, 동기화는 `2` 코드로 종료돼요. 거부 내역이 기록되므로 다음 일반 동기화 때 동일한 모델에 같은 답변에 대한 비용을 다시 지불하지 않아요. `--redo` 옵션으로 다시 요청하거나, 해당 언어쌍에 `fallback` 방식을 추가하거나, 직접 손으로 값을 입력하면 돼요.

## 이럴 때 사용하세요

- 앱이나 웹사이트의 텍스트가 로케일 파일이나 마크다운으로 관리되고 있으며, 원본이 바뀔 때마다 다른 언어 번역도 최신 상태로 유지하고 싶을 때.
- 하나의 프로젝트 안에서 언어쌍마다 다른 번역 방식을 사용하면서, 비용 지출 한도를 정하고(`--max-cost`) 과금 전에 미리 확인하고(`--dry`) 싶을 때.
- 가드레일 위에서 번역기를 구축했고 앱에서 이를 활용하고 싶을 때. `champollion connect` 명령어로 서빙된 모델을 앱 프로젝트에 연결하고, `sync` 명령어로 번역할 수 있어요. 로컬 전용 데이터로 학습된 모델은 권리 보유자가 동의한 경우에만 연결돼요.

기존 서비스가 제대로 지원하지 못하는 언어를 위한 번역기를 구축하는 작업은 `sync`으로 하는 것이 아니에요. 그런 경우에는 [프로젝트 시작하기](/docs/start)에서 시작해 보세요.

## 이 섹션의 문서들

**시작하기**

- [빠른 시작](/docs/getting-started/quick-start) — 몇 분 만에 첫 동기화 완료하기.
- [설치](/docs/getting-started/installation) — 요구 사항, API 키, 라이선스 안내.
- [설정](/docs/getting-started/configuration) — `champollion.config.json`의 모든 필드, 언어쌍별 설정, 로케일 레이아웃 및 대체(fallback) 설정.

**프레임워크 및 파이프라인**

- [프레임워크 연동](/docs/integrations/frameworks) — Hugo, next-intl, react-i18next, Flutter, gettext를 사용하는 Django.
- [CI/CD](/docs/guides/ci-cd) — 게이트 역할을 하는 `lint`, `sync`, `verify`, `audit`.
- [콘텐츠 번역](/docs/guides/content-translation) — 마크다운 및 MDX 페이지, 프론트매터(front matter)와 유지되는 요소들.

**번역 방식 선택하기**

- [번역 방식](/docs/guides/translation-methods) — 모든 번역 방식, 해당 키, 사용 시기.
- [코칭 데이터](/docs/concepts/coaching-data) — 각 요청과 함께 LLM에 전달되는 문법 설명과 단어 목록.
- [문자 체계 변환기](/docs/concepts/script-converters) 및 [인공어, 문자 체계와 정서법](/docs/guides/conlangs-scripts-orthography) — 표기 체계, 글꼴, 인공 언어.

**내부 동작 원리**

- [동기화 동작 방식](/docs/concepts/how-sync-works) — 파이프라인의 단계별 안내.
- [번역 메모리](/docs/concepts/translation-memory) — 캐시의 구조와 키 기준.
- [품질 게이트](/docs/concepts/quality-gate) — 모든 검사 항목 및 거부된 키나 블록의 처리 방식.
- [보안](/docs/concepts/security) — 조작된 키와 경로, 보호된 코드 블록, 명확한 실패 처리(failing loudly).

**협업 및 문제 해결**

- [전문 번역가와의 협업](/docs/guides/professional-translators) — 검토를 위한 XLIFF 내보내기 및 가져오기.
- [문제 해결](/docs/guides/troubleshooting) — 자주 발생하는 오류와 해결 방법.

모든 명령어와 플래그는 [CLI 레퍼런스](/docs/reference/cli)에 정리되어 있으며, 번역 방식 플러그인 형식은 [플러그인 규격](/docs/reference/plugin-spec)에서 확인할 수 있어요.

## 라이선스

`champollion` CLI는 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)에 따라 소스코드가 공개(source-available)되어 있어요. 적용 대상에 대한 자세한 내용은 [사용 권한 안내](/docs/getting-started/who-may-use-this) 문서에서 확인하실 수 있어요.
문제가 발생했거나 프로젝트에 도움이 필요하신가요? [문의해 주세요](/docs/getting-help).
