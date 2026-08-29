---
sidebar_position: 2
title: "モデルを正直にトレーニングする (nmt-forge)"
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# モデルを誠実に訓練する（nmt-forge）

**30秒でわかる要点：** 低リソース機械翻訳の「改善」のほとんどは、再検証すると崩れます――テストセットが訓練データに漏れていた、テストセットがチェックポイントを選んでいた、あるいは誤差範囲のないノイズにすぎなかった、というケースがほとんどです。**nmt-forge** は、そうしたミスを構造的に起こしにくくする訓練スイートです。通常のパスは正しい手順を踏み、誤ったパスは「何が起きたか」「なぜ結果が汚染されるか」「具体的な修正方法」を示すメッセージとともに拒否します。訓練はこのツールが行い、スコアリングは [eval harness](/docs/network/specifications/harness) が担います。スイートに組み込まれたすべてのガードは、Plains Cree 翻訳の構築中に実際に犯し、測定し、記録したミスを機械化したものです。

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

それがこのスイートの本質を一つの拒否メッセージに凝縮したものです。

## 5分でわかる経緯

このスイートが生まれたきっかけとなった失敗を紹介します。あるクリー語の教科書では、複数の英語ドリルが一つのターゲットに対応しています。*"Feed him"* と *"Feed her"* はどちらも `asam` と訳されます。標準的なランダム分割では、一方が訓練データに、もう一方がテストセットに入ります――その結果、モデルは54件の「テスト」回答のうち17件を文字通り事前に見ており、該当行のchrF++スコアは83だったのに対し、クリーンな行は44でした。その後の判断（「チャンピオン」モデルや、それに基づく知見）はすべて破棄せざるを得ませんでした。

nmt-forge のスプリッターは、**構造的に**そのような事態を不可能にします。ソースまたはターゲットを共有するペアはグループ化され、グループ全体がどちらか一方に入り、分割のたびにゼロオーバーラップの検証が実行されます。

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

他のすべてのガードも同じ形をしています――実際のミスを機械化して排除します。

| ガード | 排除するミス |
|---|---|
| **split-guard** | ソース・ターゲットの共有を通じてテストの回答が訓練データに紛れ込むこと |
| **dev-fence** | テストセットがチェックポイントを選んでしまうこと（登録済みの dev セットがなければ訓練を開始しない） |
| **leak-audit** | eval テキストで訓練すること――完全一致、言い換え（Jaccard）、またはファイル全体の漏れ |
| **funnel-audit** | パイプラインの暗黙的なデータ欠損（ある正書法の文字が一度に1,375件の辞書動詞を、数週間にわたって気づかれずに削除した） |
| **convention-lint** | 混在した綴り規則で訓練すること（モデルが文中で規則を混在させるようになる） |
| **coverage-map** | 命令文・疑問文・所有表現が一切ない100万件の合成ペア――量が構造的な欠陥を隠す |
| **sample-strata** | 2種類のテンプレートが訓練シグナルの半分を占有すること |
| **ci-scoring** | 誤差範囲のないスコア（すべての数値は95%ブートストラップCIとともに表示され、スコア単体の出力は存在しない） |
| **schedule-sanity** | 合成データが多いランで早期停止が半エポックで打ち切ること：合成データが97%で誠実な *real* dev セットを使う場合、dev lossは早期に底を打って上昇します――これはモデルが合成データの塊に過適合しているのであり、収束ではありません。停止フロアはデータの混合比から自動的に導出され、すべての介入はdev lossの軌跡とともに説明されます。これはクリーンなプロトコルによって発見されました――誠実なセットアップは本物のバグを浮かび上がらせます |
| **eval-ledger** | eval データの暗黙的な適応的使用（すべての読み取りはログに記録され、封印済みセットは一度しか使用できない） |
| **preregister** | 事後予測を事前予測として提示すること（事前登録なしでは比較表を作成できない） |

## どの言語でも、どんなアセットでも――カードから始める

nmt-forgeは、Champollionのインデックスにある約8,700の全言語に対応する単一のツールであり、
まずは、ある言語に実際に何が存在するのかをインデックスに問い合わせることから始まります：

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

`?` マークはツールが誠実であることの表れです。カードに記載がないことは **不明** を意味し、「この言語には何もない」という意味ではありません。すべての言語は同じ **アセットラダー** を登ります――（1）対訳テキストだけでも完全なガード付き訓練ループが使えます。（2）単言語テキストがあれば逆翻訳が追加されます。（3）辞書と公刊された文法書があれば、引用付きテンプレートパックを構築する価値が生まれます。（4）形態素解析器があれば検証済み合成が可能になります。（5）LYSS レフェリーがあれば、その言語独自のメトリクスをスコアリングとチェックポイント選択に組み込めます。充実したカード（Plains Cree）はランク4〜5を自動的に接続し――eval セットは `NEVER TRAIN ON THIS` フラグ付きで届き、レフェリーのプラグインレーンはすぐに貼り付けられる状態で用意されます。

`nmt-forge init <code>` はカードからプロジェクトを足場として構築します。ワークスペース、スターター設定、そして *あなたとあなたのエージェント* のために書かれた `NEXT_STEPS.md` ブリーフが生成され、テストに値するものができたら [Submit a Method](/docs/network/getting-started/submit-a-method) へと続きます。

## 説明できる合成データ

形態素解析器（FST）を持つ言語では、forge は **言語パック** を通じて訓練データを生成します――そして、どのパックも回避できない *emit law* を強制します。生成されたすべての単語は解析器を往復しなければなりません（生成 → 解析 → 同一の解析結果）。すべてのテンプレートは転写元の公刊文法書を引用し、すべての妥当性フィルターは名前付きでカウントされ、すべての行には `synthetic: true` のスタンプが押されます。このスタンプは機能的な意味を持ちます。レジストリは**テストセットへの合成行の混入を拒否します**。テストは実データのみです。

forge 自体には言語パックが同梱されていません――汎用ツールだからです。パックはそれぞれの言語とともに管理され、モジュールパスまたはエントリーポイントでプラグインします（Plains Cree パックは crk-translate プロジェクトに含まれています）。

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

解析器と辞書は独立したユーザー取得ツールとして、それぞれのライセンスのもとで管理されます――バンドルも再配布もされません。

## その言語独自のレフェリーをループに組み込む

LYSS 評価基準（言語ごとのリンター。たとえば、2つのクリー語の綴りが文書化された長母音規則によってのみ異なることを認識するものなど）は、すべてのスコアリング面に組み込まれます――チェックポイント選択にも組み込まれるため、勝者となるモデルは単に chrF++ が高いものではなく、*その言語のレフェリーが* 優れていると判断したものになります。

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

すべてのプラグイン数値には信頼区間が付与されます。前提条件が満たされていないレフェリーは、でたらめなスコアではなく *unavailable* を報告します。

同じことが **完全な harness メトリクススタック** にも当てはまります――nmt-forge は [eval harness](/docs/network/specifications/harness) が対応するすべてのメトリクスに対応しており、ニューラルメトリクス（COMET、COMET-QE、MetricX）も含まれます。推論は一度だけ実行され、信頼区間はキャッシュされたエントリーごとのスコアからブートストラップされます。自動メトリクスでチェックポイントを選択する前に、`discover` はあなたの言語ファミリーに対する各メトリクスの[測定済み信頼性](/docs/network/specifications/metric-reliability)を示します――イヌクティトゥット語では、BLEU は人間の判断とほとんど相関しません（r=0.16）が、COMET は相関します（r=0.86）。低リソース言語ファミリーの多くでは、正直な答えは *未測定* です。ツールは、最適化の対象とする前に、どの数値を信頼すべきかを教えてくれます。

## さらに詳しく知るには

- **用語に不慣れな方は？** [MT Training in Plain Language](/docs/network/context/mt-training-concepts) ですべての用語を定義しています――訓練データと eval データ、loss とデコーディング、リーク、chrF++、逆翻訳、プラトーなど――ゼロの前提知識で読めるよう、具体的な例とともに解説しています。
- **構築を始める準備ができたら？** [So You Want to Train Your Own Model](/docs/network/tutorials/train-your-own-model) はステップバイステップのエージェント向けウォークスルーです。言語を選ぶ → データを集める → 合成する → 分割する → 訓練する → 評価する → 反復する → 提出する、という流れで、各ガードがミスを捕捉する様子を示しています。
- **訓練して提出する：** 誠実に訓練されたモデルは [Submit a Method](/docs/network/getting-started/submit-a-method) を通じて Network のエントリーになります。
- **誤差範囲について：** [Statistical Significance Testing](/docs/network/specifications/significance) は forge がデフォルトで適用する数学的手法です。
- **どのメトリクスを信頼するか：** 自動メトリクスでチェックポイントを選択する前に [Metric Reliability](/docs/network/specifications/metric-reliability) を確認してください。
- **完全な設計**――各ガードの測定済みの背景、パックインターフェース、訓練ループのデフォルト――はコードとともにリポジトリ（`forge/DESIGN.md`）に収録されています。
