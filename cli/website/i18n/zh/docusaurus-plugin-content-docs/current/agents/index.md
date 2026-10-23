---
title: "面向 AI 智能体"
slug: /agents
sidebar_label: "从这里开始"
description: "驱动 Champollion 轨道的 AI Agent 技术手册：运行契约、项目模型、精确工具调用，以及数据与度量规则。"
---

# 面向 AI Agent

你来到这里，是因为有人请你使用 Champollion 帮助为他们的语言构建机器翻译。本节是你的操作手册。与面向大众页面的通俗表述不同，这里的内容精准严格：字段名、模式、拒绝策略与命令均直接引用自代码。

**请先阅读[操作契约](/docs/agents/contract)。** 它很短，但也是你绝不能出错的部分：你可以读取什么、你必须询问什么、你绝不能替社群做何决定，以及哪些规则由工具强制执行、哪些只能靠你自觉遵守。

## 连接

轨道系统是一个 MCP 服务器。将其添加到你的 MCP 客户端配置中：

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

默认配置文件即为轨道系统：包含六个工具 —— `start_project`、`project_status`、`run_next_step`、`add_data`、`try_translation` 和 `explain`。轨道的每一步也都是普通的 Shell 命令（`champollion`、`nmt-forge`、`mt-eval`），因此没有 MCP 的 Agent 也可以在终端中沿着相同的轨道逐步操作。

## 机器可读入口

- [`/llms.txt`](https://champollion.dev/llms.txt) — 本文档索引。
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — 合并在单个文件中的所有关联文档。
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — 原始 Markdown 格式的入口页面。

## 本节内容

1. [操作契约](/docs/agents/contract) — 请先阅读此处。
2. [MCP 服务器](/docs/network/getting-started/mcp-server) — 两种配置文件及所有工具。
3. [逐条命令操作指引](/docs/agents/shell) — 包含具体命令的完整操作流程。

你所协助的人们阅读的是[面向大众的页面](/docs/)：通俗易懂，事实一致。当你向他们解释内容时，应以那些页面的语域风格为准。
