---
title: "MCPサーバー — エージェントへの入り口"
sidebar_label: "MCPサーバー"
description: "Model Context Protocolを介してAIエージェントをChampollionに接続します。翻訳、ベンチマークキューの閲覧、評価の実行、モデルのトレーニングを行うための23のツールを提供します。さらに、どのツールがnpxインストール以上の追加手順を必要とするかについても詳しく説明します。"
---

# MCP Server — エージェント向けの入り口

`champollion-mcp-server` は、[Model Context Protocol](https://modelcontextprotocol.io) を介して AI エージェントに Champollion を公開します。あなたがエージェントである場合、またはエージェントを接続しようとしている場合、ここがその入り口となります。stdio 経由で **23個のツール、3つのリソース、3つのプロンプト** を提供します。

ここにあるすべてのものは、プレーンな HTTP としてもアクセス可能です（[機械可読エンドポイント](#machine-readable-endpoints) を参照してください）。しかし、エージェントが単に読み取るだけでなく、*行動*（翻訳、ベンチマークの実行、モデルのトレーニング）できるインターフェースは MCP サーバーのみです。

## インストール

```bash
npx -y champollion-mcp-server
```

その後、クライアントに登録します。Claude Code の場合:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

ファイルで設定するクライアント（Claude Desktop、Cursor、Antigravity）の場合は、以下を追加します:

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

## 依存する前にお読みください

**23個のツールのうち9個は、単なる `npx` のインストールで動作します。残りの14個は、npm パッケージには同梱されておらず、同梱できないソフトウェアを必要とします。** これらは暗黙のうちに失敗することはありません。それぞれが不足しているものを明記した、対処可能なエラーを返します。しかし、これらを前提とした計画を立てる前に、その全体像を把握しておく必要があります。

| ツール | `npx` の後に動作するか | 他に必要なもの |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **はい** — 読み取り専用、パブリックエンドポイントから提供 | なし |
| `translate` | いいえ | `champollion` CLI (`npm i -g champollion`) と API キー |
| `run_benchmark`, `get_run_status` | いいえ | 評価ハーネス — `pipx install mt-eval-harness` |
| 11個の `forge_*` ツール | いいえ | モノレポのクローンと、その `forge/` ディレクトリに設定された `CHAMPOLLION_FORGE_DIR`。スコアリングには `mt-eval` も必要 |

すべての機能を利用したい場合は、`npx` に依存するのではなく、リポジトリをクローンしてください。

## ツールの機能

**作業の閲覧とコスト計算。** `list_queue` と `get_queue_item` は、オープンなベンチマークキュー（マップを最も改善する測定値のランク付けされたリスト）を巡回します。`estimate_cost` は、費用をかける前に一連の実行の価格を計算します。

**情報の検索。** `search_languages` は、名前、コード、語族、または地域で言語カードを検索します。`get_results` と `get_run_card` は、公開リーダーボードからスコア付けされた実行を読み取ります。`get_metric_reliability` は、ほとんどのエージェントが間違える質問（*このターゲット言語ではどの指標を信頼すべきか*）に対して、語族ごとの人間の判断との相関関係から回答します。

**行動。** `translate` は、翻訳メモリ（繰り返しのコストはゼロ）と決定論的な品質ゲートを備えた、テスト済みのパイプラインを通じてテキストを実行します。実際の実行はクライアントのタイムアウトよりも長くかかるため、`run_benchmark` は評価を開始し、**ジョブ ID を即座に返します**。その ID を使用して `get_run_status` をポーリングします。

**自己欺瞞のないトレーニング。** `get_training_guardrails` は、実際に測定された失敗から抽出されたルールを返します。11個の `forge_*` ツールは [NMT Forge](/docs/network/getting-started/training-honestly) を実行します。最初と各ステップの後に `forge_status` を実行し、コマンドが拒否される前にどのゲートに引っかかるかを確認するために `forge_preflight` を実行します。

:::note[支出は設計上制限されています]
`run_benchmark` は**無制限のキュー実行を拒否します。** `budget`、`top`、または特定の `item_id` のいずれか1つの制限を必ず渡す必要があります。キューを誤解したエージェントが無制限に支出してしまうのを防ぐため、「ただキューを実行する」という呼び出しは存在しません。
:::

## プロトコルバージョン

トランスポートは **stdio のみ** です。エージェントごとに1つのサーバープロセスが割り当てられます。

MCP の [2026-07-28 リビジョン](https://blog.modelcontextprotocol.io/posts/2026-07-28/) では、プロトコルがデフォルトでステートレスになり、`initialize` ハンドシェイクと `Mcp-Session-Id` ヘッダーが廃止されました。このサーバーの設計は影響を受けません。非推奨の機能（Roots、Sampling、Logging）は一切使用しておらず、レガシーな HTTP+SSE トランスポートも使用したことがありません。また、呼び出し間の状態に関する新しいガイダンスにもすでに従っています。つまり、トランスポートセッションに依存するのではなく、`run_benchmark` が明示的なジョブハンドルを発行し、モデルがそれを送り返す仕組みになっています。

公開されている TypeScript SDK でこの新しいリビジョンに対応しているものがまだないため、新しいリビジョンへのアップグレードは**行われていません**。詳細な見解については、[サーバーの README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) を参照してください。

## 機械可読エンドポイント

これらには MCP クライアントは必要ありません:

| エンドポイント | 概要 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [エージェントの入り口](/for-agents)（生の Markdown 形式） |
| [`/llms.txt`](https://champollion.dev/llms.txt) | このサイトの厳選されたインデックス |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | インデックス化されたすべてのページ（インライン） |
| [`/queue.json`](https://champollion.dev/queue.json) | 完全なベンチマークキュー |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | キューの上位アイテム |
| [`/registry.json`](https://champollion.dev/registry.json) | コーパスレジストリ |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 測定された言語グラフ |

## 次へ

- [エージェントガイド — 構築とベンチマーク](/docs/network/getting-started/agent-guide)
- [エージェントガイド — CLI を使用した翻訳](/docs/guides/agent-guide)
- [メソッドの送信](/docs/network/getting-started/submit-a-method)
