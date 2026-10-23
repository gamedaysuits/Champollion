---
title: "AIエージェント向け"
slug: /agents
sidebar_label: "はじめに"
description: "Champollionのレールを動かすAIエージェント向けの技術マニュアルです。運用契約、プロジェクトモデル、正確なツール呼び出し、データと測定のルールについて説明しています。"
---

# AIエージェント向け

あなたがここにいるのは、ある人が自分の言語のためにChampollionを使って機械翻訳を構築するのを手伝ってほしいと求めたからです。このセクションはあなたのためのマニュアルです。人々のためのページが平易な言葉で書かれているのに対し、ここでは正確さを重視しています。フィールド名、モード、拒否応答、コマンドはコードからそのまま引用されています。

**まず[運用規約](/docs/agents/contract)をお読みください。** 短い内容ですが、絶対に誤解してはならない重要な部分です。読んでもよいもの、尋ねなければならないこと、人々の代わりに決して決めてはならないこと、そしてツールによって強制されるルールとあなた自身だけが守れるルールについて書かれています。

## 接続

レールはMCPサーバーとして提供されています。お使いのMCPクライアントの設定に追加してください：

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

デフォルトプロファイルはレール（ガイド付き手順）です。`start_project`、`project_status`、`run_next_step`、`add_data`、`try_translation`、`explain`の6つのツールが含まれます。レールの各ステップは通常のシェルコマンド（`champollion`、`nmt-forge`、`mt-eval`）でもあるため、MCP非対応のエージェントでもターミナルから同じレールを進めることができます。

## 機械可読なエントリーポイント

- [`/llms.txt`](https://champollion.dev/llms.txt) — 本ドキュメントのインデックス。
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — リンク先ドキュメントを1つのファイルにまとめたもの。
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — 未加工のMarkdown形式による導入部。

## このセクションの内容

1. [運用規約](/docs/agents/contract) — まず最初にお読みください。
2. [MCPサーバー](/docs/network/getting-started/mcp-server) — 両方のプロファイルとすべてのツールについて。
3. [コマンド一覧：ステップバイステップ](/docs/agents/shell) — コマンドを使った完全な手順ガイド。

あなたがサポートしている人々は、[人々のためのページ](/docs/)を読んでいます。そこには平易な言葉で、同じ事実が書かれています。彼らに何かを説明するときは、それらのページの語調に合わせてください。
