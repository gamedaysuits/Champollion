---
title: "MCP Server —— 面向智能体的入口"
sidebar_label: "MCP Server"
description: "通过 Model Context Protocol 将 AI 智能体连接至 Champollion：包含 23 个用于翻译、浏览基准测试队列、运行评估和训练模型的工具 —— 并明确指出哪些工具需要除 npx install 之外的额外配置。"
---

# MCP Server — 面向 Agent 的入口

`champollion-mcp-server` 通过 [Model Context Protocol](https://modelcontextprotocol.io) 将 Champollion 暴露给 AI Agent。如果你是一个 Agent，或者正在接入 Agent，这就是入口：通过 stdio 提供 **23 个工具、3 个资源和 3 个提示词**。

这里的所有内容也可以通过普通 HTTP 访问——参见 [机器可读端点](#machine-readable-endpoints)——但 MCP 服务器是唯一能让 Agent 执行*操作*（翻译、运行基准测试、训练模型）而不仅仅是读取的接口。

## 安装

```bash
npx -y champollion-mcp-server
```

然后将其注册到你的客户端。对于 Claude Code：

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

对于通过文件配置的客户端（Claude Desktop、Cursor、Antigravity），添加：

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

## 依赖它之前请先阅读此内容

**23 个工具中有 9 个可以在仅安装 `npx` 的情况下工作。其余 14 个需要 npm 包未包含且无法包含的软件。** 它们不会静默失败——每个工具都会返回一个可操作的错误，指明缺少了什么——但在你围绕它进行规划之前，你应该了解其概况。

| 工具 | `npx` 后可用？ | 还需要什么 |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **是** —— 只读，由公共端点提供 | 无 |
| `translate` | 否 | `champollion` CLI (`npm i -g champollion`) 和 API 密钥 |
| `run_benchmark`, `get_run_status` | 否 | 评估工具（eval harness）—— `pipx install mt-eval-harness` |
| 11 个 `forge_*` 工具 | 否 | monorepo 的克隆，并将 `CHAMPOLLION_FORGE_DIR` 设置为其 `forge/` 目录；评分还需要 `mt-eval` |

如果你需要完整的接口，请克隆代码仓库，而不是依赖 `npx`。

## 工具的功能

**浏览并估算工作成本。** `list_queue` 和 `get_queue_item` 遍历开放的基准测试队列——这是能最大程度改进映射的测量任务排名列表。`estimate_cost` 在你产生任何花费之前，为一组运行任务进行估价。

**查找信息。** `search_languages` 按名称、代码、语系或地区搜索语言卡片。`get_results` 和 `get_run_card` 从公共排行榜读取已评分的运行结果。`get_metric_reliability` 通过每个语系与人类判断的相关性，回答了大多数 Agent 都会弄错的问题——*对于这个目标语言，我应该信任哪个指标*。

**执行操作。** `translate` 通过经过测试的流水线运行文本，包含翻译记忆库（Translation Memory，重复内容不产生费用）和确定性的质量门禁。`run_benchmark` 启动评估并**立即返回一个任务 ID（job id）**，因为实际运行时间会超过任何客户端的超时时间；你需要使用该 ID 轮询 `get_run_status`。

**真实有效地训练。** `get_training_guardrails` 返回从实际测量的失败案例中提取的规则。11 个 `forge_*` 工具运行 [NMT Forge](/docs/network/getting-started/training-honestly)——在第一步以及每一步之后运行 `forge_status`，运行 `forge_preflight` 以查看命令在拒绝之前会触发哪些门禁。

:::note[支出在设计上是有上限的]
`run_benchmark` **拒绝无限制的队列运行。** 你必须传递且仅传递一个限制条件——`budget`、`top` 或特定的 `item_id`。不存在“直接运行队列”的调用，因为如果 Agent 误解了队列，可能会导致无限制的支出。
:::

## 协议版本

传输方式**仅限 stdio**——每个 Agent 对应一个服务器进程。

MCP 的 [2026-07-28 修订版](https://blog.modelcontextprotocol.io/posts/2026-07-28/) 默认将协议设为无状态，废弃了 `initialize` 握手和 `Mcp-Session-Id` 标头。本服务器在设计上不受影响：它没有使用任何已弃用的功能（Roots、Sampling、Logging），从未使用过传统的 HTTP+SSE 传输，并且已经遵循了跨调用状态的新指南——`run_benchmark` 会生成一个明确的任务句柄（job handle）供模型传回，而不是依赖于传输会话。

它**尚未**升级到新修订版，因为目前还没有发布的 TypeScript SDK 支持该版本。有关完整立场，请参阅 [服务器 README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)。

## 机器可读端点

这些端点不需要 MCP 客户端：

| 端点 | 说明 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [Agent 入口](/for-agents)，原始 Markdown 格式 |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 本站点的精选索引 |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | 每个被索引的页面，内联格式 |
| [`/queue.json`](https://champollion.dev/queue.json) | 完整的基准测试队列 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | 队列顶部项目 |
| [`/registry.json`](https://champollion.dev/registry.json) | 语料库注册表 |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 已测量的语言图谱 |

## 下一步

- [Agent 指南 — 构建与基准测试](/docs/network/getting-started/agent-guide)
- [Agent 指南 — 使用 CLI 翻译](/docs/guides/agent-guide)
- [提交方法](/docs/network/getting-started/submit-a-method)
