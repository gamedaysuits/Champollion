---
sidebar_position: 5
title: "リソースの少ない言語をサポートする"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# 低リソース言語のサポート

> **エグゼクティブサマリー** 低リソース言語および複統合的言語向けの機械翻訳を構築するための包括的なガイドです。これらの言語が難しい理由（形態論的複雑さ、データの少なさ、ハルシネーション）、既存の計算資源（ALTLab FST、GiellaLT、Apertium、UniMorph、EdTeKLA）、10以上のミニアプローチ戦略、champollionのコーチングシステム、および評価ループについて網羅しています。十分なサービスを受けていない言語のためのメソッドに貢献したい場合は、ここから始めてください。

:::info[ステータス: 活発に開発中]
平原クリー語（nêhiyawêwin）のサポートは現在開発中です。ここで説明されているツール、評価ハーネス、およびリーダーボードは実在し、今日から使用可能ですが、クリー語の翻訳パイプラインはまだリリースされていません。リリースされた際には、これがFSTインフラストラクチャを持つ他の複統合的言語や低リソース言語の青写真として機能します。
:::

## 未解決の問題

GoogleのCloud Translationサービスは194言語をリストアップしています（[Googleの公開リスト](https://docs.cloud.google.com/translate/docs/languages)）。MetaのOMT-1600（2026年3月）は1,600言語のカバーを主張しており、これはこれまでに公開された中で最大の機械翻訳（MT）システムです。しかし、そのロングテールにある約1,200言語（カバーする1,600言語から、著者がモデルが「十分に理解している」と報告する400以上の言語を引いた計算）については、品質が実用的な閾値を下回っており、トレーニングデータは聖書のテキストに偏り、モデルの重みはダウンロードできず、独立した評価やコミュニティのガバナンスフレームワークも存在しません。残りの約5,400言語については、事前学習済みモデルは一切の出力を生成しません。

状況は大きく変化しました。現在、大手テクノロジー企業は低リソース言語（LRL）のカバーに投資しています。しかし、カバーしていることは品質を意味するわけではなく、独立した検証のない品質は信頼に繋がりません。低リソース言語には、カバーしていると主張するモデル以上のものが必要です。形態論的検証を伴う独立した評価、コミュニティによってキュレーションされたコーパス、そして主権を尊重するガバナンスが必要なのです。

**champollionは、それを変えるために構築されました。**

[Method Leaderboard](https://champollion.dev/leaderboard)はオープンな課題です。十分なサービスを受けていない言語のための最高の翻訳メソッドを構築し、再現可能な評価でそれを証明し、トップスコアを獲得してください。言語学者、機械学習の研究者、コミュニティの言語活動家、学生、趣味で取り組む人など、世界中の誰もが貢献できます。問題は未解決です。インフラストラクチャはここにあります。リーダーボードがあなたを待っています。

---

## なぜこれが難しいのか: 複統合的な形態論

ほとんどの商用MTシステムは、英語、フランス語、中国語などの言語向けに設計されています。これらの言語では、単語は比較的短く、文は個別のトークンから構築されます。しかし、平原クリー語を含む多くの先住民言語は**複統合的（polysynthetic）**です。つまり、英語では文全体として表現される内容を、1つの単語にエンコードすることができます。

### クリー語の例

平原クリー語の単語を考えてみましょう。

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"私が学校に行ったとき"*

これは**1つの単語**です。時制（過去）、方向（〜へ行く）、語根（学ぶ）、態（受動態/再帰態）、および人称（一人称単数）がエンコードされています。主に英語でトレーニングされたLLMは、このような形態論的な密度に対する直感を持っていません。

課題はさらに複合的になります。

| 課題 | 意味 |
|-----------|--------------|
| **形態論的複雑さ** | 1つの動詞の語根から、接頭辞、接尾辞、接周辞を通じて何千もの有効な活用形が生成される可能性があります。 |
| **有生/無生の区別** | 名詞は文法的に有生（animate）または無生（inanimate）に分類されます。これは動詞の活用、指示代名詞、および複数形に影響を与えます。この分類は必ずしも生物学的な有生性に従うわけではありません（*askiy*「地球」は有生であり、*maskisin*「靴」も有生です）。 |
| **近接/忌避（Obviation）** | 三人称の言及は、近接性/顕著性によってランク付けされます。「近接（proximate）」と「忌避（obviative）」の区別には、英語に相当するものがありません。 |
| **トレーニングデータの少なさ** | LLMは平原クリー語のテキストをほとんど学習していません。学習したデータも、方言（Y方言、TH方言）や正書法（SROと音節文字）が混在している可能性があります。 |
| **弱い商用ベースライン** | OMT-1600は、聖書ドメインのトレーニングと標準的なBPEトークン化を使用して、CRK（クリー語）をR1（非常に低リソース）層に含めています。Google翻訳はクリー語をサポートしていません。形態論的指標を用いた独立した評価こそが、これらのベースラインを意味のあるものにします。 |

複統合的言語の翻訳は依然として**未解決の研究課題**です。OMT-1600には複統合的言語が含まれていますが、形態論的な認識を持たない標準的なBPEトークン化（256Kの語彙）を使用しているため、構成的な単語を意味のないバイトの断片に切り刻んでしまいます。

---

## 先行技術: 人々はこれにどうアプローチしてきたか

### ALTLab FST

平原クリー語にとって最も重要な計算資源は、アルバータ大学の[Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/)が、ノルウェー北極大学（UiT）の[Giellatekno](https://giellatekno.uit.no/)と協力して開発した**有限状態トランスデューサ（FST）**です。

ALTLab FSTは**形態素解析器および生成器**です。活用されたクリー語の単語が与えられると、それを語根と文法タグに分解でき、語根とタグが与えられると、正しい活用形を生成できます。これは決定論的であり、ニューラルネットワークも、ハルシネーションも、確率も関与しません。FSTが単語を受け入れた場合、その単語は形態論的に有効です。

これが、champollionのリーダーボードが指標として**FST Acceptance Rate（FST受容率）**を追跡している理由です。FSTが拒否する単語を生成する翻訳メソッドは、chrF++スコアがどうであれ、形態論的に無効なクリー語を生成していることになります。

**主要なALTLabリソース:**
- [itwêwina](https://itwewina.altlab.app/) — FSTを搭載したインテリジェントな平原クリー語–英語辞書
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — オープンソースの形態論を認識する辞書プラットフォーム
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — 平原クリー語の語彙データベース
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — より広範なプロジェクトのコンテキスト

### グローバルなFSTおよび形態論レジストリ

高品質なFSTインフラストラクチャを持つ言語は平原クリー語だけではありません。他の低リソース言語や形態論的に複雑な言語の翻訳パイプラインを開発したい場合は、以下の確立されたグローバルハブを活用できます。

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (ノルウェー北極大学 UiT):** 100以上の言語をカバーする、オープンソースのFST形態素解析器および生成器の最大のリポジトリです。重点分野には、サーミ語（`sme`、`smj`、`sma`など）、ウラル語族（コミ語、エルジャ語、ウドムルト語など）、およびその他の少数民族/先住民言語が含まれます。彼らは[GitHub Organization](https://github.com/giellalt/)で公開の処理済みテキストコーパス（`corpus-xxx`）をホストしています。
* **[The Apertium Project](https://www.apertium.org/):** オープンソースのルールベース機械翻訳プラットフォームです。Apertiumは、高度に最適化されたFST形態素解析器（`lttoolbox`および`hfst`を使用）と、テュルク諸語（カザフ語、タタール語、キルギス語など）の大規模なスイートやヨーロッパの少数言語を含む数十の言語の対訳辞書を維持しています。すべてのリソースは[ApertiumのGitHub](https://github.com/apertium)で公開されています。
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** 150以上の言語の標準化された形態論的パラダイムを提供する共同プロジェクトです。データセットはHugging Faceの[unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies)でホストされています。ある言語のコンパイル済みFSTバイナリが利用できない場合、UniMorphのテーブルを静的なデータベース検索ゲートとして使用できます。
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** カナダの先住民言語向けのツールを提供しており、これには**Uqailaut**イヌクティトゥット語FST形態素解析器や、大規模な**Nunavut Hansard Parallel Corpus**（130万の英語-イヌクティトゥット語の文ペア）が含まれます。

### EdTeKLAコーパス

[EdTeKLA研究グループ](https://spaces.facsci.ualberta.ca/edtekla/)（同じくアルバータ大学）は、教育資料、音声の書き起こし、およびコミュニティのソースから平原クリー語のコーパスを構築しました。champollionの評価データセットである[EDTeKLA Dev v1](/docs/network/leaderboard/datasets)はこの作業から派生したものであり、[EdTeKLAの修正版CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora)（主権をスコープとした非営利条件）の下で公開されています。

### 人々が試した、または試すことができるその他のアプローチ

リーダーボードはメソッドに依存しません。以下は、低リソースMTのために探求または提案されている戦略であり、これらのいずれも提出可能です。

| アプローチ | 仕組み | メリット | デメリット |
|----------|-------------|------|------|
| **[コーチング付きLLMプロンプティング](/docs/network/tutorials/coached-llm-prompting)** | 文法ルール、辞書、および例のペアをシステムプロンプトに注入する | 反復が速く、トレーニングが不要 | 品質の上限がLLMの基礎知識に制限される |
| **[Few-shotプロンプティング](/docs/network/tutorials/few-shot-prompting)** | 検証済みの翻訳をコンテキスト内の例として含める | 一貫したスタイルに適している | コンテキストウィンドウが小さい。例は評価データから取得してはならない |
| **[FSTゲートパイプライン](/docs/network/tutorials/fst-gated-pipeline)** | LLMが生成 → FSTが検証 → 無効な形態論を拒否して再試行する | 形態論的な有効性を保証する | FSTインフラストラクチャが必要。再試行ループによりレイテンシとコストが増加する |
| **[辞書検索 + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | 対訳辞書から既知の用語を強制し、残りをLLMに処理させる | 既知の用語のハルシネーションを減らす | 辞書のカバー範囲は常に不完全である |
| **[ファインチューニング済みモデル](/docs/network/tutorials/fine-tuned-model)** | オープンモデル（Llama、Mistral）をパラレルテキストでファインチューニングする（ただし評価データは除く） | 最高の品質が得られる可能性がある | パラレルコーパス（希少）が必要。高コスト。過学習のリスクがある |
| **[連鎖モデル](/docs/network/tutorials/chained-models)** | モデルAが粗訳を生成 → モデルBがポストエディット → モデルCがスコアリングする | 専門家の強みを組み合わせることができる | 複雑。遅い。高コスト |
| **[ルールベース + LLMハイブリッド](/docs/network/tutorials/rule-based-hybrid)** | 既知のパターンには言語学的ルールを使用し、それ以外にはLLMを使用する | ルールが適用される箇所では正確 | 深い言語学的専門知識が必要 |
| **[逆翻訳による拡張](/docs/network/tutorials/back-translation)** | クリー語→英語に翻訳して合成パラレルデータを生成し、その逆でトレーニングする | トレーニングデータを安価に拡張できる | 既存のモデルのエラーを増幅させる |
| **[進化的アプローチ](/docs/network/tutorials/evolutionary-approach)** | 候補となる翻訳を生成し、スコアリングし、最もパフォーマンスの高いものを変異させ、繰り返す | 斬新な解決策を発見できる可能性がある。並列化可能 | 計算コストが高い。優れた適応度関数が必要 |
| **[部分翻訳](/docs/network/tutorials/partial-translation)** | 代表的なサンプルを手動で翻訳し、メソッドがそのスタイルに一致することを証明してから、残りの大部分を自動翻訳する | 人間の品質と機械のスケールを組み合わせる | 初期段階で人間の労力が必要 |
| **手動JSON / 試験の採点** | 語学試験での学生の回答をテストするためにデータセットのJSONファイルを手作りするか、ゴールドスタンダードに対して人間の翻訳のバッチを採点する | MLは不要。教育やQAに有効 | 継続的な翻訳ニーズにはスケールしない |

### 単なるJSONです

ハーネスはJSONを入力として受け取り、スコアリングされたJSONを出力します。[データセットのフォーマット](/docs/network/leaderboard/datasets)はシンプルです。

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

これを手動で構築することも、スプレッドシートからエクスポートすることも、コーパスから生成することもできます。語学教師が学生の翻訳を採点するために使用することも、翻訳エージェンシーがフリーランサーをベンチマークするために使用することも、研究室がモデルアーキテクチャを比較するために使用することもできます。ハーネスはJSONがどこから来たかを気にしません。ただスコアリングするだけです。

また、本番環境のデプロイメントフレームワークも同じプラグインインターフェースを採用しているため、ハーネスで高スコアを出したメソッドは、設定を1つ変更するだけでWebサイトにデプロイできます。**証明して、使用してください。**

可能性は本当に無限大です。**アイデアがあるなら、それを構築し、ハーネスを実行して、スコアを提出してください。**

---

## champollionの役割

champollionはインフラストラクチャ層を提供します。メソッドを持ち込むのはあなたです。

### コーチングシステム

champollionの`llm-coached`メソッドを使用すると、言語学的知識をLLMのプロンプトに直接注入できます。

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

コーチングデータは、`en:crk`ペアのすべてのLLMプロンプトに注入され、モデルに通常では得られない構造化された言語学的コンテキストを与えます。完全な仕様については、[Coaching Data](https://champollion.dev/docs/concepts/coaching-data)を参照してください。

### レジスター

レジスターは、トーン、フォーマルさ、および正書法の規則を制御するシステムプロンプトの一部です。champollionには、平原クリー語のレジスターが1つ同梱されています。

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

設定でこれをオーバーライドして、さまざまなプロンプティング戦略を試すことができます。

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

異なるレジスターは異なる翻訳スタイルを生み出し、リーダーボードでのスコアも異なります。各提出物には、使用された正確なレジスターとシステムプロンプトが（[ランカード](/docs/network/specifications/run-card)にSHA-256ハッシュとして）記録されるため、実験は再現可能です。

### 文字体系の変換

平原クリー語は、**標準ローマ字正書法（SRO）**と**カナダ先住民音節文字**の2つの文字体系で書かれます。champollionのパイプラインは以下の通りです。

1. LLMがSRO（ラテン文字ベースであり、LLMがより適切に処理できる）に翻訳する
2. 品質ゲートがSROの出力を検証する
3. 決定論的コンバーターがSRO → 音節文字に変換する
4. 変換されたテキストがディスクに書き込まれる

コンバーターはすべてのSROのダイアクリティカルマーク（長母音のê、î、ô、â）を処理し、それらを正しい音節文字にマッピングします。技術的な詳細については、[Script Converters](https://champollion.dev/docs/concepts/script-converters)を参照してください。

### 評価ループ

[評価ハーネス](/docs/network/specifications/harness)は、評価データセットに対してメソッドを実行し、スコアリングされた[ランカード](/docs/network/specifications/run-card)を生成します。

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

`--name`フラグは、あなたが選択するラベルです。これはリーダーボードに表示されるため、他の人があなたがどのようなプロンプト戦略を使用したかを確認できます。ハーネスはランカードに完全なシステムプロンプトを記録するため、あなたの正確なアプローチは再現可能です。

:::tip[自由に実験し、最高の結果を提出する]
ハーネスは迅速な反復のために設計されています。さまざまなモデル、コーチングデータ、レジスター、および条件を使用して、何十もの実験を実行してください。自信のある結果が得られたときにのみ、リーダーボードに提出してください。
:::

---

## データ主権の原則 {#data-sovereignty-principles}

champollionは、先住民のデータ主権をサポートするように設計されています。言語データに対するコミュニティによる所有、管理、アクセス、および保持が、私たちが先住民コミュニティのための言語テクノロジーにどのようにアプローチするかを導くものです。

| 原則 | champollionによるサポート方法 |
|-----------|------------------------|
| **所有 (Ownership)** | 言語コミュニティは自身の言語データを所有します。champollionが外部と通信したり、私たちのサーバーにデータを送信したりすることは決してありません。 |
| **管理 (Control)** | [APIメソッド](https://champollion.dev/docs/guides/serving-a-method)により、コミュニティは独自の翻訳パイプラインをホストできます。私たちはインターフェースを提供し、コミュニティが実装を管理します。 |
| **アクセス (Access)** | コミュニティは、誰が彼らのメソッドを使用できるかを決定します。APIは認証によって制限することができます。 |
| **保持 (Possession)** | すべての翻訳データはプロジェクトのファイルシステム内に留まります。[プロビナンスシステム](https://champollion.dev/docs/concepts/security)は、すべての翻訳がどこから来たかを追跡します。 |

プラグインアーキテクチャにより、コミュニティは神聖な知識や制限された知識を内部に組み込んだメソッドを構築し、翻訳APIのみを公開して、言語リソースに対する完全な管理を維持することができます。

---

## ビジョン: 次に来るもの

平原クリー語は最初のターゲットです。パイプラインが検証され、コミュニティが品質に満足すれば、同じアーキテクチャがFSTインフラストラクチャを持つ他の複統合的言語にも拡張されます。

- **他のアルゴンキン語族**: 森林クリー語、湿原クリー語、オジブウェー語、ブラックフット語
- **イヌイット語族**: イヌクティトゥット語、イヌイナクトゥン語（これらも音節文字を使用します）
- **他の語族**: FST解析器を持つ言語であれば、FSTゲートパイプラインを使用できます

リーダーボードは言語ペアごとにスコープされています。言語コミュニティによって新しい評価データセットが提供されると、新しいリーダーボードのトラックが自動的に開かれます。

**これはオープンな招待状です。** 研究者、コミュニティメンバー、学生、あるいは単に関心を持つ人として、低リソース言語に取り組んでいるなら、champollionは本物を構築し、それを誠実に測定し、世界と共有するためのツールを提供します。[Method Leaderboard](https://champollion.dev/leaderboard)はあなたの提出を待っています。

---

## 関連項目

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — スコアを提出し、メソッドの比較を確認する
- **[MT Evaluation](/docs/network/leaderboard/rules)** — 優れたメソッドの条件、失格になる条件
- **[Eval Harness](/docs/network/specifications/harness)** — 実験の実行方法
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1およびFLORES+
- **[Coaching Data](https://champollion.dev/docs/concepts/coaching-data)** — LLMのための言語学的知識の構造化方法
- **[Script Converters](https://champollion.dev/docs/concepts/script-converters)** — SRO→音節文字のパイプライン
- **[Serving a Method via API](https://champollion.dev/docs/guides/serving-a-method)** — コミュニティ管理の翻訳のホスティング
- **[ALTLab](https://altlab.ualberta.ca/)** — Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — Educational Technology, Knowledge & Language研究グループ
- **[itwêwina dictionary](https://itwewina.altlab.app/)** — FSTを搭載した平原クリー語–英語辞書

