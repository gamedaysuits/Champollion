---
sidebar_position: 1
slug: /intro
title: "アプリとサイトの翻訳"
description: "`champollion sync` でアプリやウェブサイト自体のファイルを翻訳するためのリファレンスです。何ができるのか、いつ使うのか、そして関連するすべてのページへの案内をまとめています。"
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

# アプリとサイトの翻訳

`champollion sync` は、アプリやウェブサイトの翻訳を原語に合わせて最新の状態に保ちます。ロケールファイル（またはMarkdownページ）を読み込み、不足している部分や古くなった部分を見つけて、その部分だけを翻訳し、各結果を検証して、ファイル固有の形式で書き戻します。

```bash
npx champollion sync
```

このセクションはその機能のリファレンスです。まずは平易な言葉で書かれた解説を読みたい場合は、[アプリやウェブサイトを翻訳する](/docs/translate-an-app-or-website) をご覧ください。

## `sync` の動作

1. **ファイルを検出します。** ロケールフォルダとフォーマット（JSON、TOML、YAML、gettext PO、Flutter ARB）、またはMarkdown/MDXページのフォルダ（Hugo、Docusaurus、あるいは `--content-dir` で指定した任意のフォルダ）を検出します。
2. **変更箇所を特定します。** すべての元の値は `.champollion.lock` にSHA-256ハッシュとして記録されます。存在しないキー、空のキー、または原文が変更されたキーがキューに追加され、それ以外はそのまま保持されます。
3. **言語ペアごとに選んだ方法で翻訳します。** 1つの設定ファイルで、あるペアをLLMに、別のペアを機械翻訳APIに、さらに別のペアを自身で学習・ホストしたモデルに送信できます。LLMによる方法はデフォルトで温度（temperature）0で翻訳されます（`shared/model-defaults.json` における唯一のデフォルト値です）。ホスト型モデルでも実行ごとにわずかに結果が変わることがありますが、翻訳メモリ（Translation Memory）がすでに取得した内容を保持する理由の1つがここにあります。
4. **すでに支払い済みの翻訳を再利用します。** 翻訳メモリは、原文テキスト、ロケール、翻訳方法ごとに各翻訳をキャッシュします。元に戻された文字列、別ファイル内の同一の文、やり直しなど、再び現れたテキストは無料で処理されます。
5. **書き込む前にすべての結果を検証します。** 品質ゲート（quality gate）は、空の出力、原文のコピー、反復ループ、誤った文字体系の出力、破損したプレースホルダーなどの破損を拒絶し、フィードバック付きの再試行を1回行います。意味の誤りではなく、壊れた出力を検出します。
6. **書き込み後に検証します。** 同期後のパスで書き込まれたファイルを再度読み込み、キーの整合性、空の値、文字体系、プレースホルダーをチェックします。`champollion verify` や `champollion audit` も、CIゲートとして同様のチェックを実行します。

通知なしに勝手に書き込まれることはありません。再試行後もゲートによって拒絶されたキーは未翻訳のまま残されて報告され、同期処理は `2` で終了します。拒絶された内容は記憶されるため、次回の通常の同期で同じモデルに対して同じ回答の費用を支払うことはありません。`--redo` で再度要求するか、その言語ペアに `fallback` メソッドを追加するか、手作業で値を書き込みます。

## どのような場合に使うか

- アプリやウェブサイトのテキストがロケールファイルやMarkdownに置かれており、原文の変更に合わせて他の言語を常に最新の状態に保ちたい場合。
- 1つのプロジェクト内で言語ペアごとに異なる翻訳方法を使い、支出を制限し（`--max-cost`）、課金が発生する前に費用を可視化したい場合（`--dry`）。
- レール上で翻訳モデルを構築し、それをアプリで使いたい場合：`champollion connect` で提供されているモデルをアプリプロジェクトに組み込み、`sync` でそのモデルを使って翻訳します。ローカル限定のデータで学習されたモデルは、その保持者の同意がある場合にのみ接続されます。

どのサービスもうまく対応していない言語向けの翻訳モデルを構築するには、`sync` は適していません。その場合は、[プロジェクトを始める](/docs/start) からご覧ください。

## このセクションのページ

**はじめに**

- [クイックスタート](/docs/getting-started/quick-start) — 数分で最初の同期を実行。
- [インストール](/docs/getting-started/installation) — 要件、APIキー、ライセンス。
- [設定](/docs/getting-started/configuration) — `champollion.config.json` の各フィールド、言語ペアごとの設定、ロケールのレイアウト、フォールバック。

**フレームワークとパイプライン**

- [フレームワーク連携](/docs/integrations/frameworks) — Hugo、next-intl、react-i18next、Flutter、gettextを用いたDjango。
- [CI/CD](/docs/guides/ci-cd) — ゲートとしての `lint`、`sync`、`verify`、`audit`。
- [コンテンツ翻訳](/docs/guides/content-translation) — MarkdownおよびMDXページ、フロントマター、保持される要素。

**翻訳方法の選択**

- [翻訳方法](/docs/guides/translation-methods) — 各種翻訳方法、キー、および使い分け。
- [コーチングデータ](/docs/concepts/coaching-data) — 各リクエストとともにLLMへ渡される文法上の注意点や単語リスト。
- [文字体系コンバーター](/docs/concepts/script-converters) および [人工言語・文字体系・正書法](/docs/guides/conlangs-scripts-orthography) — 表記体系、フォント、人工言語。

**内部の仕組み**

- [同期の仕組み](/docs/concepts/how-sync-works) — パイプラインのステップごとの流れ。
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとそのキーの仕組み。
- [品質ゲート](/docs/concepts/quality-gate) — 各チェック内容と、拒絶されたキーやブロックの処理。
- [セキュリティ](/docs/concepts/security) — 不正に細工されたキーやパス、保護されたコードブロック、明確なエラー通知。

**人と課題**

- [プロの翻訳者との連携](/docs/guides/professional-translators) — レビュー用のXLIFFエクスポートおよびインポート。
- [トラブルシューティング](/docs/guides/troubleshooting) — よくあるエラーと修正方法。

すべてのコマンドとフラグは [CLIリファレンス](/docs/reference/cli) に、メソッドプラグインの形式は [プラグイン仕様](/docs/reference/plugin-spec) に記載されています。

## ライセンス

`champollion` CLIは、[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) に基づいてソース利用可能（source-available）となっています。対象者の詳細については、[利用可能な対象者](/docs/getting-started/who-may-use-this) を参照してください。
お困りの場合や、プロジェクトのサポートが必要な場合は、[お問い合わせください](/docs/getting-help)。
