---
sidebar_position: 2
title: "モデルを正直にトレーニングする (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
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

**30秒でわかる概要:** 低リソース機械翻訳（MT）の「改善」の多くは、再検証すると崩れ去ります。テストセットが訓練データに混入していたり、テストセットによってチェックポイントが選ばれていたり、あるいは得られた向上が誤差範囲も示されないノイズにすぎなかったりするためです。**nmt-forge** は、そうした誤りを構造的に排除する訓練スイートです。正常な手順を踏めば正しく動作し、誤った手順を踏んだ場合は拒絶して、*何が*起きたか、*なぜ*結果が損なわれるのか、そして正確な*修正方法*をメッセージで示します。本ツールは訓練を行い、[評価ハーネス](/docs/network/specifications/harness)がスコアを測定します。組み込まれたすべてのガードは、平原クリー語の翻訳システムを構築する過程で私たちが実際に犯し、測定し、文書化した誤りを自動化したものです。`python3 -m pip install 'nmt-forge[hf]'` でインストールでき、デフォルトのモデルはノートPCのCPU上で訓練できます。

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

それがこのスイートの本質を一つの拒否メッセージに凝縮したものです。

## 5分でわかる経緯

このスイートが生まれたきっかけとなった失敗を紹介します。あるクリー語の教科書では、複数の英語ドリルが一つのターゲットに対応しています。*"Feed him"* と *"Feed her"* はどちらも `asam` と訳されます。標準的なランダム分割では、一方が訓練データに、もう一方がテストセットに入ります――その結果、モデルは54件の「テスト」回答のうち17件を文字通り事前に見ており、該当行のchrF++スコアは83だったのに対し、クリーンな行は44でした。その後の判断（「チャンピオン」モデルや、それに基づく知見）はすべて破棄せざるを得ませんでした。

nmt-forge のスプリッターは、**構造的に**そのような事態を不可能にします。ソースまたはターゲットを共有するペアはグループ化され、グループ全体がどちらか一方に入り、分割のたびにゼロオーバーラップの検証が実行されます。

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

（テストセットがすでに別個の登録済みファイルとして存在する場合 — 講師が確認し、非公開にしてあるセットなど — `--test 0` は訓練用と検証（dev）用のみを分割します。）

その他のガードもすべて同じ設計思想です — 実際の誤りを、自動化によって排除しています。これらを総称して**訓練ガードレール**と呼びます。分割（split）を行う前にお読みください（`nmt-forge init` と `nmt-forge status` は、そのステップでここを参照するよう指示します。エージェントもMCPツールの `get_training_guardrails` から、各ルールの背景にある実測された誤りと共に同一のルールを取得します）。

| ガード | 排除する誤り |
|---|---|
| **split-guard** | ソース/ターゲットの重複により、テストの正解が訓練データ内に潜り込むこと |
| **dev-fence** | テストセットを使ってチェックポイントを選んでしまうこと（登録済みのdevセットがない場合、訓練の開始を拒絶します） |
| **leak-audit** | 評価用テキストでの訓練 — 同一のプロンプト（翻訳が異なる場合も含む）、同一またはほぼ重複した回答、あるいはファイル全体の混入。また、意図的に*保持*するものとその理由も示します。1単語だけ入れ替えたテンプレートの兄弟文（*"I see the dog"* / *"I see the cat"*）は練習であり答えではないため、削除されずに報告されます（すべてのテスト行に兄弟文が存在し、固定されたテストセットに対して `--clean-to … --drop-test-twins` が訓練側のペアを削除する場合を除きます）。決定論的：同じコーパスであれば、常に同じ結果になります |
| **funnel-audit** | パイプラインでのサイレントなデータ脱落（かつて、正書法における1文字が原因で、1,375語の辞書動詞が何週間にもわたって不可視のまま削除されていました） |
| **convention-lint** | 複数の表記ルールが混在したデータでの訓練（モデルが文の途中で表記ルールを混同するようになります） |
| **coverage-map** | 命令文も疑問文も所有表現もない100万組の合成ペア — データ量が構造的な欠落を覆い隠してしまうこと |
| **sample-strata** | わずか2種類のテンプレートが訓練シグナルの半分を占有してしまうこと |
| **ci-scoring** | 誤差範囲のないスコア（すべての数値は95%ブートストラップ信頼区間と共に表示されます — 単独スコアの出力は存在しません） |
| **schedule-sanity** | 合成データが多い実行で、わずか0.5エポックで早期終了（early stopping）してしまうこと：97%が合成データで、devセットに正直な*実データ*を使用している場合、dev損失は早期に底を打ち、その後上昇傾向を示します — これは収束ではなく、モデルが大量の合成データに適合している状態です。停止の閾値はデータの配合比率から自動的に導出され、すべての介入措置はdev損失の推移とともに理由が説明されます。これはクリーンなプロトコルによって*初めて*発見された問題です — 正直な設定こそが真のバグをあぶり出します |
| **eval-ledger** | 評価データの目に見えない適応的利用（すべての読み込みがログに記録され、封印されたセットは1回限りの使用となります） |
| **preregister** | 事前予測を装った事後予測（事前登録なし → テストスコアなし、比較表なし。予測フォーマットはJSON配列の1種類のみ — `nmt-forge prereg template` が編集用のファイルを書き出します） |
| **score caveats** | 評価ハーネスが条件付きとしたスコアを引用すること — *ほぼ一定の出力*（多種多様な入力に対して少数の同じ文が出力される：入力に応じた出力になっていない）、参照訳より極端に長いまたは短い出力、ソースの丸写しなど。forgeはこれらを独自に計算しません。エクスポートの要約、`forge-model.json`、`DEPLOY.md`、`status`、`report`、`compare`、`lint` において、ハーネスが記録したすべての注記をハーネス自身の文言のままスコアの隣に引き渡します — 条件付きのスコアを、注記なしで「引用すべき数値」として提示することは決してありません |

## どの言語でも、どんなアセットでも――カードから始める

nmt-forgeは、Champollionのインデックスに含まれる約8,700言語すべてに対応する単一のツールであり、まずインデックスに対してその言語に実際に何が存在するかを問い合わせることから始まります：

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

`?` マークはツールが誠実であることの表れです。カードに記載がないことは **不明** を意味し、「この言語には何もない」という意味ではありません。すべての言語は同じ **アセットラダー** を登ります――（1）対訳テキストだけでも完全なガード付き訓練ループが使えます。（2）単言語テキストがあれば逆翻訳が追加されます。（3）辞書と公刊された文法書があれば、引用付きテンプレートパックを構築する価値が生まれます。（4）形態素解析器があれば検証済み合成が可能になります。（5）LYSS レフェリーがあれば、その言語独自のメトリクスをスコアリングとチェックポイント選択に組み込めます。充実したカード（Plains Cree）はランク4〜5を自動的に接続し――eval セットは `NEVER TRAIN ON THIS` フラグ付きで届き、レフェリーのプラグインレーンはすぐに貼り付けられる状態で用意されます。

次に `nmt-forge init <code>` がカードからプロジェクトの雛形を生成します：ワークスペース、初期設定ファイル、そしてあなた*とあなたのエージェント*のために書かれた正確なコマンド順序を含む `NEXT_STEPS.md` の指示書です。プレーンな `pip install` から動作します — カードは指定したディレクトリ、ローカルチェックアウト、またはパブリックなカードインデックス（オフライン使用のためにキャッシュされます）から読み込まれます — また、まだカードがない言語でもプロジェクトを作成でき（`--no-card --name "<name>"`）、カードの各事実は捏造されるのではなく「不明」として記録されます。

## ノートPCからモデルの配信まで

この誠実な開発ループにはGPUは不要です。`init` は、3つのモデルプリセットのいずれかを明示的な数値として設定ファイルに書き込みます：

| プリセット | 必要な環境 | 期待される成果 |
|---|---|---|
| `cpu-tiny`（デフォルト） — スクラッチから訓練される小型Transformer、語彙は訓練データ行のみから学習 | ノートPCのCPU、ダウンロード不要 | 設計上控えめな性能：1,000〜2,000ペアでchrF++はおよそ5〜30程度 — 汎用的な翻訳ではなく、データのフレーズやパターンを学習 |
| `cpu-finetune --base <hf-id>` — 近縁言語ペア向けに指定する、事前訓練済みの小型Marian/opus-mtモデル | CPU、約300 MBのダウンロード | 近縁言語ペアが存在する場合は通常 `cpu-tiny` より優れています — 実際に測定してください |
| `nllb-600m` — LoRAを適用したNLLB-200蒸留版600M | GPU | 最も強力なスタート地点 |

`cpu-tiny` が用意されている理由は、初日から開発ループ*全体*を機能させるためです — フェンス、監査、事前登録されたテスト、CLIから呼び出し可能なモデル — これにより、後からより優れたモデルを同じプロジェクトに投入しても、まったく同じ方法で測定できるようになります。訓練後は、2つのコマンドで作業が完了します：

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` はテストセットを1回だけスコアリングし（事前登録必須、95%信頼区間。`--prereg <id>` は `nmt-forge prereg new <id>` でこのモデル用に書き出された事前登録を指定します — 1つのテストセットに2つのモデルがあり、それぞれ独自に判定される場合、exportは推測を拒絶します）、結果を `mt-eval compare` が読み取れるmt-evalレポートとして書き出し、champollionプラグインマニフェストと `DEPLOY.md` を含む自己完結型のモデルをパッケージ化します。`serve` はchampollionのapi-methodコントラクトとOpenAI互換エンドポイントに対応しているため、`champollion sync --method local` からこれを使って翻訳を行うことができます。トークンを指定しない限り、localhostでのみリッスンします。すべてのコマンドはエージェント向けに `--json` を受け付けます（標準出力に1つのJSONドキュメントを出力し、拒絶時は `{"error": {…, "why", "fix"}}`、終了コード2）。完全な手順は [最初のモデルを訓練する](/docs/network/getting-started/train-your-first-model) に記載されています。テストに値するものができたら、[手法を提出する](/docs/network/getting-started/submit-a-method) でNetworkエントリへと変換できます。

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

- **用語に不慣れな場合:** [わかりやすいMT訓練用語集](/docs/network/context/mt-training-concepts) では、予備知識ゼロの方に向けて、具体例を交えながらあらゆる用語（訓練データと評価データの違い、損失とデコーディング、リーク、chrF++、逆翻訳、プラトーなど）を定義しています。
- **構築を始める準備ができた場合:** [独自のモデルを訓練する](/docs/network/tutorials/train-your-own-model) は、言語の選択 → データの収集 → 合成 → 分割 → 訓練 → 評価 → 反復 → 配信と提出まで、各ガードレールが誤りを捕捉する様子を示しながら進める、エージェント対応のステップバイステップのチュートリアルです。[自分の言語向けのMTを構築する](/docs/build-mt-for-your-language) では、既存のものの調査、選択肢の測定、デプロイといった全体の道程の文脈の中に訓練を位置づけています。
- **訓練してから提出する:** 誠実に訓練されたモデルは、[手法を提出する](/docs/network/getting-started/submit-a-method) を通じてNetworkエントリになります。
- **誤差範囲について:** [統計的有意性検定](/docs/network/specifications/significance) は、forgeがデフォルトで適用する数学的根拠を説明しています。
- **どの指標を信頼すべきか:** 自動評価指標に基づいてチェックポイントを選択する前に、[指標の信頼性](/docs/network/specifications/metric-reliability) をご確認ください。
- **すべてのコマンドとフラグ:** ツール自体から生成された [forge コマンドリファレンス](/docs/network/getting-started/forge-command-reference) を参照してください。
- **失敗の分類法** — 各誤り、具体例、それを捕捉するガード — はnmt-forgeのソースコードに同梱されています。エージェントもMCPサーバーの `get_training_guardrails` ツール（オプションの `topic`）から同じルールセットを取得でき、すべての拒絶メッセージには理由（何が/なぜ/修正方法）が含まれています。
