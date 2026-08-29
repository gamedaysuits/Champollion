---
title: "MCP Server — 에이전트를 위한 출입구"
sidebar_label: "MCP Server"
description: "Model Context Protocol을 통해 AI 에이전트를 Champollion에 연결해 보세요: 번역, 벤치마크 대기열 탐색, 평가 실행 및 모델 학습을 위한 23가지 도구를 제공하며, 어떤 도구에 npx install 이상의 추가 설정이 필요한지 정확히 알려드려요."
---

# MCP Server — 에이전트용 출입구

`champollion-mcp-server`은 [Model Context Protocol](https://modelcontextprotocol.io)을 통해 AI 에이전트에게 Champollion을 노출해요. 여러분이 에이전트이거나 에이전트를 연결하고 있다면, 여기가 바로 그 출입구예요. stdio를 통해 **23개의 도구, 3개의 리소스, 3개의 프롬프트**를 제공해요.

여기에 있는 모든 것은 일반 HTTP로도 접근할 수 있어요([기계 판독 가능 엔드포인트](#machine-readable-endpoints) 참고). 하지만 MCP 서버는 에이전트가 단순히 읽는 것을 넘어 *행동*(번역, 벤치마크 실행, 모델 학습)할 수 있게 해주는 유일한 표면이에요.

## 설치

```bash
npx -y champollion-mcp-server
```

그런 다음 클라이언트에 등록하세요. Claude Code의 경우:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

파일로 구성되는 클라이언트(Claude Desktop, Cursor, Antigravity)의 경우 다음을 추가하세요.

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## 의존하기 전에 읽어보세요

**23개의 도구 중 9개는 기본 `npx` 설치만으로 작동해요. 나머지 14개는 npm 패키지에 포함되어 있지 않고 포함될 수도 없는 소프트웨어가 필요해요.** 이 도구들은 조용히 실패하지 않아요. 각각 무엇이 누락되었는지 명시하는 조치 가능한 오류를 반환하지만, 이를 바탕으로 계획을 세우기 전에 그 형태를 알아두는 것이 좋아요.

| 도구 | `npx` 이후 작동 여부 | 추가로 필요한 것 |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **예** — 읽기 전용, 퍼블릭 엔드포인트에서 제공됨 | 없음 |
| `translate` | 아니요 | `champollion` CLI(`npm i -g champollion`) 및 API 키 |
| `run_benchmark`, `get_run_status` | 아니요 | 평가 하네스 — `pipx install mt-eval-harness` |
| 11개의 `forge_*` 도구 | 아니요 | `CHAMPOLLION_FORGE_DIR`가 `forge/` 디렉터리로 설정된 모노레포 클론. 채점 시 `mt-eval`도 필요함 |

전체 표면을 원한다면 `npx`에 의존하기보다 리포지토리를 클론하세요.

## 도구가 하는 일

**작업 탐색 및 비용 산정.** `list_queue` 및 `get_queue_item`은 열린 벤치마크 대기열을 탐색해요. 이는 지도를 가장 크게 개선할 수 있는 측정 항목의 순위 목록이에요. `estimate_cost`은 비용을 지출하기 전에 일련의 실행에 대한 가격을 매겨요.

**정보 검색.** `search_languages`는 이름, 코드, 어족 또는 지역별로 언어 카드를 검색해요. `get_results` 및 `get_run_card`은 퍼블릭 리더보드에서 채점된 실행 결과를 읽어와요. `get_metric_reliability`는 대부분의 에이전트가 틀리는 질문인 *이 대상 언어에 대해 어떤 지표를 신뢰해야 하는가*에 대해 어족별 인간의 판단과의 상관관계를 바탕으로 답변해요.

**실행.** `translate`은 번역 메모리(반복 시 비용 없음)와 결정론적 품질 게이트를 갖춘 테스트된 파이프라인을 통해 텍스트를 실행해요. `run_benchmark`는 평가를 시작하고 **작업 ID를 즉시 반환**해요. 실제 실행은 클라이언트의 시간 초과보다 오래 걸리기 때문이에요. 해당 ID로 `get_run_status`를 폴링하면 돼요.

**스스로를 속이지 않는 학습.** `get_training_guardrails`은 실제 측정된 실패에서 추출한 규칙을 반환해요. 11개의 `forge_*` 도구는 [NMT Forge](/docs/network/getting-started/training-honestly)를 실행해요. `forge_status`은 처음과 모든 단계 이후에 실행되며, `forge_preflight`는 명령이 거부되기 전에 어떤 게이트에 도달할지 확인해요.

:::note[지출은 설계상 제한되어 있어요]
`run_benchmark`은 **제한 없는 대기열 실행을 거부해요.** `budget`, `top` 또는 특정 `item_id` 중 정확히 하나의 제한을 전달해야 해요. "그냥 대기열 실행"과 같은 호출은 없어요. 대기열을 오해한 에이전트가 무제한으로 비용을 지출할 수 있기 때문이에요.
:::

## 프로토콜 버전

전송은 **stdio 전용**이에요. 에이전트당 하나의 서버 프로세스를 사용해요.

MCP의 [2026-07-28 리비전](https://blog.modelcontextprotocol.io/posts/2026-07-28/)은 프로토콜을 기본적으로 무상태(stateless)로 만들었으며, `initialize` 핸드셰이크와 `Mcp-Session-Id` 헤더를 폐기했어요. 이 서버는 설계상 영향을 받지 않아요. 더 이상 사용되지 않는 기능(Roots, Sampling, Logging)을 전혀 사용하지 않고, 레거시 HTTP+SSE 전송을 사용한 적이 없으며, 교차 호출 상태에 대한 새로운 지침을 이미 따르고 있어요. `run_benchmark`은 전송 세션에 의존하는 대신 모델이 다시 전달하는 명시적인 작업 핸들을 생성해요.

아직 이를 지원하는 게시된 TypeScript SDK가 없기 때문에 새 리비전으로 업그레이드되지 **않았어요**. 전체 입장은 [서버 README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)를 참고하세요.

## 기계 판독 가능 엔드포인트

이 항목들에는 MCP 클라이언트가 필요하지 않아요.

| 엔드포인트 | 설명 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | 원시 마크다운 형태의 [에이전트 출입구](/for-agents) |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 이 사이트의 큐레이션된 인덱스 |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | 인라인 처리된 모든 인덱싱 페이지 |
| [`/queue.json`](https://champollion.dev/queue.json) | 전체 벤치마크 대기열 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | 상위 대기열 항목 |
| [`/registry.json`](https://champollion.dev/registry.json) | 말뭉치 레지스트리 |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 측정된 언어 그래프 |

## 다음 단계

- [에이전트 가이드 — 구축 및 벤치마킹](/docs/network/getting-started/agent-guide)
- [에이전트 가이드 — CLI로 번역하기](/docs/guides/agent-guide)
- [메서드 제출하기](/docs/network/getting-started/submit-a-method)
