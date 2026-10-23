---
title: "リファレンス"
slug: /reference
description: "すべての技術的詳細を1つのマップにまとめました。コマンド、ファイル形式、仕様、技術的制限、シールドテストのホスティング、リーダーボード、アプリおよびサイトの翻訳、Atlas、そしてネットワークインフラストラクチャを網羅しています。"
---

# リファレンス

開発者、研究者、AIエージェントのための完全な技術記録です。
[一般向けドキュメント](/docs/)では同じ内容を平易な言葉で説明しており、
[エージェント用マニュアル](/docs/agents)ではエージェントによる操作方法を解説しています。以下の各ページでは、そのすべてを厳密に記載しています。

## コマンド

- [`champollion`](/docs/reference/cli) — プロジェクトツールおよびアプリ・サイト翻訳ツールの全コマンドとフラグ。
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — パーサーから生成された、モデル学習スイートの全コマンド。
- [`mt-eval`](/docs/reference/mt-eval) — パーサーから生成された、評価ハーネスの全コマンド。
- [MCPサーバー](/docs/network/getting-started/mcp-server) — 両方のプロファイル、全ツール、全引数。

## フォーマット

- [フレームワークのフォーマット](/docs/reference/formats) — スキーマに基づく project/1、set/1、method/1、gate-chain/1、deployment/1、service-api/1。
- [実行カード](/docs/network/specifications/run-card) — スコア測定済みの実行が記録・公開する内容。
- [コーチングデータ](/docs/concepts/coaching-data) — LLM方式に与えられる文法ノートと単語リスト。
- [プラグイン仕様](/docs/reference/plugin-spec) — 翻訳方式が同梱する方式プラグインのマニフェスト（`method.json`）。
- [言語カード](/docs/reference/language-card-spec) — Atlasにおけるカードのスキーマ。

## 仕様

- [スコアリング](/docs/network/specifications/scoring) — スコアリング標準/1：コーパスchrF++の見出し値と95%ブートストラップ区間、その横に並ぶ標準指標、および個別に保持される診断情報。
- [有意性](/docs/network/specifications/significance) — 対応のある検定と、ある実行が別の実行より優れていると判定される基準。
- [方式インターフェース](/docs/network/specifications/methods) — 方式の定義、クラス、依存関係。
- [指標の信頼性](/docs/network/specifications/metric-reliability) — 人手による評価に基づき、どの言語種別にどの指標を信頼すべきか。
- [ベンチマーク](/docs/network/specifications/benchmark) — 有効な実行すべてが従うプロトコル。
- [ハーネス](/docs/network/specifications/harness) — `mt-eval`の実行、スコアリング、公開の仕組み。
- [話者検証](/docs/network/specifications/speaker-validation) — 自動スコアが代替している人手によるレビュー。

## 技術的な制約

- [技術的な制約](/docs/network/honest-limitations) — 保証していない事項：自己申告による信頼性ティア、現時点での話者レビューの不在、封印テストの保管、文単位の信頼度スコアの不在。

## 封印テストをホストする

- [主権コンテストの実施](/docs/network/sovereignty/run-a-sovereign-contest) — ホストのマシンから決して外に出ないテストセットのためのエンドツーエンドの手順書。
- [主権評価ノード](/docs/network/sovereignty/sovereign-eval-node) — スコア測定用マシン：ハードウェア、エアギャップ、キーセレモニー。
- [コーパスの登録](/docs/network/sovereignty/registering-corpora) — 保持しているコーパスの公開ティアとライセンス区分。
- [所有権と規約](/docs/network/sovereignty/ownership-transfer)および[規約テンプレート](/docs/network/sovereignty/terms-templates) — 応募によって引き渡される権利（応募前に宣言されます）。
- [賞金・賞品](/docs/network/specifications/prizes) — スポンサーが賞を設定する場合の要件。

## リーダーボードと公開

- [リーダーボードと公開](/docs/reference/leaderboard) — ボードの概要、2種類のベンチマーク、公開された実行に含まれる情報。
- [提出規則](/docs/network/leaderboard/rules) — 受理されるもの、失格となるもの、検証ティア。
- [評価データセット](/docs/network/leaderboard/datasets) — 登録されたデータセットと各ライセンス区分。
- [方式を提出する](/docs/network/getting-started/submit-a-method) — ハーネスを実行し、実行カードを公開する。
- [計算資源を提供する](/docs/network/getting-started/contributing-compute) — 自身のキーを使用して公開キューからアイテムを実行する。
- [よくある質問](/docs/network/getting-started/faq) — 指標、モデル、FST、失格について。

## アプリおよびサイトの翻訳

- [アプリおよびサイトの翻訳](/docs/intro) — `champollion sync`の機能と、各ページへのガイド：クイックスタート、インストール、設定、フレームワーク、CI/CD、方式、コンテンツ、翻訳メモリ、品質ゲート、セキュリティ、スクリプト、翻訳者、トラブルシューティング。

## Atlas

- [Atlas](/docs/atlas) — 言語インデックスの概要とその情報の出典。
- [言語カード仕様](/docs/reference/language-card-spec)および[引用手順](/docs/reference/language-card-citation-procedure) — 全フィールドとそれぞれの引用方法。
- [何をもって言語とするか](/docs/network/context/what-counts-as-a-language) — インデックスが示す回答とその理由。
- [インデックスへの登録](/docs/network/getting-started/submit-to-the-index)および[エラーの報告](/docs/network/perspectives/reporting-errors-and-owning-corrections) — エントリや修正の提案。

## ネットワークインフラ

- [キューの構築](/docs/network/specifications/queue-construction)および[キューがこのように構築されている理由](/docs/network/perspectives/why-the-queue) — 公開作業キューが次に測定すべき対象をどのように順位付けするか。
- [接続強度](/docs/network/specifications/connection-strength) — ネットワークマップ上の弧（アーク）が言語ペアについて示す内容、および廃止された強度スケール。
- [計算資源を提供する](/docs/network/getting-started/contributing-compute) — キューの処理を実行する。
