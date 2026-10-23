---
title: "AI 에이전트용"
slug: /agents
sidebar_label: "여기서 시작하기"
description: "Champollion의 레일을 구동하는 AI 에이전트를 위한 기술 매뉴얼이에요. 운영 계약, 프로젝트 모델, 정확한 도구 호출, 데이터 및 측정 규칙을 담고 있어요."
---

# AI 에이전트를 위한 가이드

누군가 Champollion으로 자신의 언어를 위한 기계 번역을 구축하는 데 도움을 요청하여 이곳에 오셨을 것입니다. 이 섹션은 여러분을 위한 매뉴얼입니다. 사람들을 위한 페이지가 평이하게 쓰여진 것과 달리, 여기서는 정확성을 기했습니다. 필드 이름, 모드, 거부 응답, 명령어 등은 코드에서 그대로 인용했습니다.

**먼저 [운영 계약](/docs/agents/contract)을 읽어주세요.** 내용은 짧지만 절대 어겨서는 안 되는 부분입니다. 여러분이 무엇을 읽을 수 있는지, 무엇을 물어봐야 하는지, 사람들을 대신해 절대 결정해서는 안 되는 것이 무엇인지, 도구가 강제하는 규칙과 여러분만이 지킬 수 있는 규칙이 무엇인지 명시되어 있습니다.

## 연결하기

레일은 MCP 서버입니다. 여러분의 MCP 클라이언트 구성에 추가하세요:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

기본 프로필은 레일입니다. 도구 여섯 개(`start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation`,
`explain`)가 포함됩니다. 레일의 모든 단계는 일반 셸 명령어(`champollion`, `nmt-forge`, `mt-eval`)이기도 하므로, MCP가 없는 에이전트라도 터미널에서 동일한 레일을 따라갈 수 있습니다.

## 머신 리더블 진입점

- [`/llms.txt`](https://champollion.dev/llms.txt) — 이 문서들의 색인.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — 링크된 문서 전체가
  하나로 합쳐진 파일.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — 원본 마크다운 형태의
  안내 페이지.

## 이 섹션의 내용

1. [운영 계약](/docs/agents/contract) — 가장 먼저 읽어주세요.
2. [MCP 서버](/docs/network/getting-started/mcp-server) — 두 프로필과
   모든 도구 안내.
3. [명령어 단계별 상세 가이드](/docs/agents/shell) — 명령어를 통한
   전체 진행 과정.

여러분이 돕고 있는 사람들은 [사용자 페이지](/docs/)를 읽습니다. 쉬운 어휘로 쓰여 있지만 사실관계는 동일합니다. 그분들에게 무언가를 설명할 때는 해당 페이지의 어조와 눈높이를 맞춰주세요.
