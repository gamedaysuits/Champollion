---
title: "利用対象について"
description: "各Champollionパッケージのライセンスについて、誰が対象となり誰が対象外となるかをわかりやすく解説します。これは概要であり、法的な助言ではありません。正式な規定はライセンス本文が優先されます。"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# 利用対象者

Champollionのパッケージには、単一のライセンスが一括して適用されているわけではありません。このページでは、各パッケージが誰を対象としているかをわかりやすく説明します。

**これは要約であり、法的助言ではありません。正式なライセンス条文が優先されます。** 各ライセンスへのリンクは以下の表に記載されており、パッケージ自体にも同梱されています。

## 各パッケージとそのライセンス

| パッケージ | 概要 | ライセンス |
|---|---|---|
| `champollion` (npm) | ロケールファイルを翻訳するCLI | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | AIエージェントにこれらのツールを提供するMCPサーバー | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | モデルトレーニングスイート | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI、`mt-eval` コマンド) | 評価ハーネス | [プラグイン例外条項](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md)付き [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) |
| `champollion-lyss` (PyPI) | 平原クリー語（Plains Cree）の評価基準プラグイン | 独自の暫定ライセンス：許可制（[PyPIにて公開](https://pypi.org/project/champollion-lyss/)） |

[リポジトリ](https://github.com/gamedaysuits/Champollion)内のデータレジストリ（`shared/`）およびデータベースマイグレーション（`mt-eval-arena/`）は、Apache-2.0ライセンスです。

## CLI、MCPサーバー、nmt-forge

これら3つは PolyForm Noncommercial License 1.0.0 の下で提供されています。**非商用目的**において、使用、改変、共有が許可されています。許諾される目的はライセンス自体に定義されています。ほとんどのケースは、以下の2つの条項によって判断されます。

> **個人での利用（Personal Uses）** 商用利用を一切想定しない、公の知識に資するための研究、実験、テスト、または個人学習、プライベートな娯楽、趣味のプロジェクト、アマチュア活動、宗教的儀式を目的とした個人利用は、許可された目的での利用とみなされます。

> **非営利組織（Noncommercial Organizations）** 慈善団体、教育機関、公的研究機関、公安・公衆衛生機関、環境保護団体、または政府機関による利用は、資金提供の出所やそれに付随する義務にかかわらず、許可された目的での利用とみなされます。

これらの組織形態のいずれかに該当する場合、資金調達の方法によって判断が変わることはありません。条項には「資金提供の出所にかかわらず」と明記されています。

| 対象 | 利用可能か | 理由 |
|---|---|---|
| アプリやニュースレターを翻訳する学校 | ✓ 可 | 教育機関に該当 |
| 患者向け案内を翻訳する公立病院または公的医療クリニック | ✓ 可 | 公安・公衆衛生機関に該当 |
| ウェブサイトを翻訳する慈善団体 | ✓ 可 | 慈善団体に該当 |
| 官公庁または公的研究機関 | ✓ 可 | 政府機関または公的研究機関に該当 |
| 商用展開を想定していない個人プロジェクトや研究プロジェクトでの個人利用 | ✓ 可 | 研究、実験、テスト、個人学習、趣味を目的とした個人利用に該当 |
| 店舗サイト（オンラインストア）を翻訳する商店・企業 | ✗ 不可 | 営利企業の製品・サービスであり商用利用に該当 |
| 患者向けポータルを翻訳する営利目的の民間クリニック | ✗ 不可 | 営利企業の製品・サービスであり商用利用に該当（公衆衛生機関ではない） |

商用目的の利用は対象外であり、このライセンスでは許可されていません。

## 評価ハーネス（`mt-eval-harness`）

この評価ハーネスは、GNU Affero General Public License バージョン3以降（AGPL-3.0-or-later）の下で提供されているオープンソースです。AGPLは独自の利用条件の下で商用利用を認めています。主な条件は以下のとおりです。

- 改変の有無にかかわらず、本ハーネスを再頒布する場合は、ソースコードを添えて同一のライセンス下で頒布しなければなりません。
- 本ハーネスを改変し、ネットワーク経由で利用者に提供する場合は、その改変バージョンのソースコードを利用者に提供しなければなりません（第13条「リモートネットワークによる相互利用」）。

独立した許諾条項（AGPL第7条に基づく [LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md)）により、他のライセンスが適用された評価基準プラグインも、公開プラグインインターフェースを通じて本ハーネスと連携して動作させることができます。これによって本ハーネス自体のライセンスが変更されることはありません。

## 平原クリー語プラグイン（`champollion-lyss`）

`champollion-lyss` には独自の暫定ライセンスが適用されており、書面による許可を得た場合にのみ使用できます。非営利の研究、教育、およびコミュニティの利益となる用途については、通常、無償で許可が下ります。商用利用は一切認められていません。これは暫定ライセンスであり、コミュニティのガバナンスによって定められる利用規約に置き換えられることを意図しています。ライセンス条文およびそのNOTICE（告知事項）はパッケージに同梱されています。

## これらのライセンスの適用外となるもの

これらのツールを通じて利用する翻訳サービス、モデル、コーパスには、それぞれの利用条件（プロバイダーのAPI利用規約、モデルのライセンス、コーパスのライセンス）がそのまま適用されます。評価ハーネスは各コーパスのライセンスを記録し、どのモデルサービスがそれを参照できるかに関するルールを適用しますが、それらの条件は各権利者によって定められたものであり、このページで説明しているライセンスによって規定されるものではありません。

## ライセンス条文

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)（[polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0) でも確認可能）：CLI、ならびに [MCPサーバー](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) および [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) に適用される同条文
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) およびその[プラグイン例外条項](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md)：評価ハーネス
- [champollion-lyss](https://pypi.org/project/champollion-lyss/)：暫定ライセンスおよびNOTICEはパッケージ内に同梱

このページは要約であり、法的助言ではありません。本ページの内容とライセンス条文に相違がある場合は、ライセンス条文が優先されます。
