---
sidebar_position: 3
title: "最初のモデルをトレーニングする（エージェントと一緒に）"
description: "コーディングエージェントに指示を出して低リソースMTモデルをトレーニングするためのステップバイステップのウォークスルーです。インストール、テストセットの保護、ノートPCのCPUでのトレーニング、1回のスコアリング、champollion CLIへのモデル提供までを解説します。指示する内容、forgeが実行する処理、拒否（refusal）がどのように表示されるかについても扱います。"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# 最初のモデルを訓練する（エージェントと一緒に）

ニューラル機械翻訳モデルの訓練方法を知っている必要はありません。必要なのは、**コーディングエージェント（Claude、Sonnet/Flashクラスのモデル、またはシェルコマンドを実行できる任意のエージェント）に何をしたいかを伝える**ことだけです。**nmt-forge** はエージェントが*機械的に*操作できるよう設計されています。各ステップで、ツールはエージェントに次に何をすべきかを正確に伝え、結果を損なうようなステップは——修正方法とともに、はっきりと——拒否します。

このページでは、`pip install`からChampollion CLIが呼び出せるモデルに至るまでの一連の流れ（ループ全体）を扱います。各ステップは、**エージェントに伝えること**、**forgeが行うこと**、**拒絶（refusal）がどのように表示されるか**（発生しても慌てないようにするため — 拒絶はツールが正常に機能している証拠です）、そして最後に**レポートの読み方**として記述されています。これは、事前準備（既存リソースの探索）、中間工程（既存の選択肢の測定）、および事後工程（公開、手法の組み合わせ）を網羅した[Build MT for Your Language](/docs/build-mt-for-your-language)のステップ2および4に対応するforgeパートです。

**順序が重要です。** テストセットで**何かがスコアリングされる前に**、テストセットの登録、テストセットに対する訓練データのスクリーニング、および予測の記録（ステップ1〜3）を行ってください。これには、ガイドのステップ3で`mt-eval run`を使用して測定するベースラインも含まれます。ベンチマークはスコアリングのための読み取りです。forgeはそれをカウントし、読み取り後に記述された予測を拒絶します。その後、分割とトレーニング（ステップ4）を行います。

:::tip エージェントに対する唯一のルール
次のように伝えてください。*「常に最初に、そしてすべてのステップの後に`nmt-forge status --json`を実行してください。その`next_command`の指示に必ず従ってください。」* この習慣ひとつで、forgeは誘導レールのように機能します。すべてのforgeコマンドは`--json`を受け付けます。標準出力には正確に1つのJSONドキュメントが出力され、拒絶は終了コード2の`{"error": {…, "why", "fix"}}`として返されます。エージェントがMCP経由で接続している場合、同じループが`forge_status`ツール（`{ "project_dir": "<dir>" }`）になります。[Agent Guide](/docs/network/getting-started/agent-guide)を参照してください。
:::

---

## ステップ 0 — インストールと、エージェントに対象言語を指定

**あなたの指示:** *「nmt-forgeをtraining extra付きでインストールしてください。英語→[対象言語]のモデルをトレーニングしたいです。まずはforgeがその言語について何を把握しているかを検出してください。ISO 639-3コードは`crk`です」*（対象言語のコードを使用してください）。

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

`[hf]` extraは、トレーニング用ライブラリ（torch、transformers、accelerate、tokenizers、sentencepiece、peft）を追加します。デフォルトモデルであればCPU専用のwheelで十分です。プレーンな`python3 -m pip install nmt-forge`では、トレーニングを含まないガード、分割、監査、およびスコアリングが提供されます。

**forgeが行うこと:** `nmt-forge discover crk`が言語カードを読み取ります。これには用字系（スクリプト）、辞書、形態素解析器、既存のコーパスおよび評価セット（`do_not_train`や隔離フラグを含む）、言語ごとのレフェリー指標が含まれます。Champollionリポジトリのコピーは不要です。カードは指定したディレクトリ（`--cards-dir`）、ローカルのチェックアウトまたは`node_modules/champollion`、あるいは公開カードインデックス（キャッシュされるため以降はオフラインで動作）から取得されます。その後、forgeは対象言語を**アセットラダー（資産の階段）**上に配置します。(1) 並行テキスト → ガード付きトレーニング、(2) + 単言語テキスト → タグ付き逆翻訳、(3) + 辞書/文法 → 出典付き合成データ、(4) + 解析器 → 往復検証済み合成、(5) + レフェリー指標 → スコアリングおよびチェックポイント選択におけるその言語独自の指標。

**空白フィールドは UNKNOWN を意味し、ゼロではありません。** カードが疎であることは「この言語にリソースがない」ということではなく、単にそのリソースがまだ記録されていないだけかもしれません。独自の対訳コーパスをいつでも持ち込むことができます。

次に: *「プロジェクトのスキャフォールディングを行ってください。」*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

これにより、ワークスペース（`.forge/`）、スターター設定（`config.json`）、正確なコマンド順序が記された`NEXT_STEPS.md`ブリーフが出力されます。**以降のすべてのコマンドはプロジェクトディレクトリ内から実行してください** — 設定ファイルのパスはそこからの相対パスになります。

別のプリセットを選択しない限り、スターター設定では**`cpu-tiny`**モデルプリセットが使用されます。

| `--model` | 概要 | 必要要件 | 期待される性能 |
|---|---|---|---|
| `cpu-tiny` (デフォルト) | 用意した対訳ペアを用いてスクラッチからトレーニングされる小型のTransformer（パラメータ数約600万）。語彙はトレーニング行からのみ学習されます | CPU、ダウンロード不要 | 低め: 1,000〜2,000ペアの場合、chrF++はおよそ5〜30（上限は極めて定型化されたデータの場合のみ）。一般的な言語構造ではなく、データのフレーズやパターンを学習します |
| `cpu-finetune --base <hf-id>` | 指定した小型の事前学習済みMarian/opus-mtモデルをファインチューニングします（*関連する*言語ペアのものを選択してください） | CPU、約300MBのダウンロード | 関連ペアが存在する場合、通常は`cpu-tiny`よりも優れています — 推測せず開発セットで測定してください |
| `nllb-600m` | LoRAを適用したNLLB-200 distilled 600M | GPU、約2.5GBのダウンロード | 最も強力なスタート地点。forgeの実時間（ウォールクロック）チェックにより、CPU上では数分以内に拒絶されます |

プリセットは`config.json` → `model`に明示的な数値として書き出されるため、隠蔽されている設定はなく、数値を変更すると別々にハッシュ化された新しい実行になります。

**言語カードが存在しない場合:** `nmt-forge init <code> --no-card --name "<name>"`を実行してもプロジェクトのスキャフォールディングは行われます。カードに記載されるはずだった内容はすべて「unknown」として記録され、勝手に捏造されることはありません。

---

## ステップ 1 — テストセットの隔離と登録 {#step-1--set-your-test-set-aside-then-split}

**あなたの指示:** *「これが並行コーパス、そしてこちらが別途用意した教師チェック済みのテストセットです。テストセットはトレーニングから除外し、何かがスコアリングされる前に登録してください」*

ファイルは`.tsv`（原文、タブ、訳文の順で1行に1ペア。`# `で始まる行はコメント）または`.jsonl`（1行につき`{"source": …, "target": …}`）が利用可能です。テストセットが非公開データである場合は、エージェントを含め何かが読み取る**前に**ローカル専用としてマークしてください: `echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`。これにより、forgeがその文を出力することは一切なくなります。

**forgeが行うこと — 独自のテストセットがある場合**（学校や診療所などでの一般的なケース）:

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

登録を行うと、ファイルの**読み取りログ**（`<file>.reads.jsonl`）が開始されます。これ以降、forgeや`mt-eval run` / `mt-eval compare`によるこのファイルのすべてのスコアリングがカウントされます。登録を最初に行うのはそのためです。登録前に行われたベンチマーク実行は登録時にリストされますが、カウントされません。

**個別のテストセットがない場合**は、コーパスから切り出します — `nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split --register project` registers `project-test` and `project-dev`を1ステップで実行し（ステップ4で分割について説明します）、ステップ3に進みます。

`nmt-forge status`には次のステップとして、ベンチマーク前の予測（ステップ3）が示されます — まずはコーパスをスクリーニングしてください（ステップ2）。

---

## ステップ 2 — リーケージをスクリーニングする

**あなたの指示:** *「トレーニングを行う前に、コーパスをテストセットと照合してチェックし、何を除外すべきかとその理由を教えてください」*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forgeが行うこと:** 登録されているすべての開発/テスト/封印（sealed）セットと全行を照合してスクリーニングします。同じコーパスと同じ登録セットであれば、常に同じ結果が得られます。何が**除外**されるのかについて理由が示されます。

- **同一のプロンプト（Identical prompt）** — 行の原文がテスト行の原文と一致している（大文字小文字、句読点、スペースを無視した後）。**行の訳文が異なる場合でも**除外されます。テストのプロンプトそのものでトレーニングすることになるためです。
- **同一の回答（Identical answer）** — 行の訳文がテストの正解（リファレンス）と一致している。
- **ほぼ重複する回答（Near-duplicate answer）** — 行の訳文の単語の60%以上がテストの回答と共通しており（アクセントは正規化されるため表記揺れもカウントされます）、**かつ**回答全体を含んでいる、その一部である、または90%以上一致している。モデルに回答の大部分が見せられてしまうことになります。

…そして、報告はされるものの意図的に**保持され**、削除されないもの:

- **テンプレート兄弟（Template siblings）** — テストの回答と文の枠組みを共有しているものの、単語が入れ替わっている行（*"I see the dog"* / *"I see the cat"*）。モデルはその枠組みの中で一度も見たことのない単語を生成する必要があります。定型化された教科書や学校コーパスには、これらが大量に含まれています。forgeは、トレーニング内に兄弟関係があるテスト行をリストアップします。スターター設定で`eval.near_dupe_corpus`が設定されているため、最終レポートでは完全なスコアの隣に、兄弟関係のない行に対する**「(strict)」**スコアが表示されます。
- **類似プロンプト・異なる回答（Similar prompt, different answer）** — 原文がテストの原文のほぼ重複（完全一致ではない）であるものの、訳文が異なる場合。これはリークではなく、正当な最小対立（minimal contrast）です。

以下は、3行のテストセットに対してスクリーニングされた12行のテスト用トイコーパスのレポートです（簡略化済み。トイ文は英語とフランス語風の訳文です）:

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

3行目はテスト行とは*異なる*訳文を持っていますが、プロンプトがテストプロンプトと同一であるため除外されます。

例では**コーパス**の行が行番号で引用されます。テストファイル自体のテキストは一切出力されず、**封印（sealed）**セットに一致した行は行番号のみで表示されます。（コーパスの行がテスト行と同一、またはテスト行を含んでいる場合、コーパス行を引用するとそのテスト文も表示されてしまうため、出力を共有する場合は`--no-examples`を渡してください。）

`--clean-to pairs.clean.jsonl`は残った行を書き出し、その横にコンテンツを含まない監査記録（`pairs.clean.audit.json`）を出力します。コーパスのスクリーニングは分割**前**に行ってください（ステップ4でクリーンアップされたファイルを分割します）。開発セットを切り出した後にコーパス全体を再スクリーニングしないでください。開発セットの行自体がマッチして除外されてしまいます。*追加*データ（ウェブ収集データ、単言語テキストなど）も同様に、トレーニングに追加する前にスクリーニングしてください。

**スクリーニングによってテストセットが消費されることはありません。** leak-auditは行を比較するためにテストセットを読み取りますが、forgeはそれを*監査（audit）*用の読み取りとして記録し、スコアリング用の読み取りとは見なしません。したがって、ステップ3で記述する予測の妨げにはなりません。

**まず判定（verdict）を確認してください**（`VERDICT:`の行。`--json`の場合は`verdict`キー）。テスト行の大部分がコーパス内にほぼ重複するペア（ニアツイン）を持っていると表示された場合、全データでトレーニングされたモデルは翻訳能力ではなく、トレーニングフレーズの再現度（想起）をスコアリングすることになります。固定のテストセット（教師や看護師などの専門家がチェックしたもの）を使用する場合、通常は**2つのモデル**をトレーニングします。1つは全データでトレーニングしたもの（通常はこちらの方が実運用には有用）、もう1つは新しい文にその手法がどう対応できるかを示すツインなし（twin-free）のモデルです。ツインなしのコーパスは`--drop-test-twins`から生成されます:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

これはテスト行のニアツインであるトレーニング行を削除し、前後のstrictサブセットを報告し、トレーニングデータが残らなくなる場合は処理を拒絶します。そして、元の設定の横にツインなしモデルの設定ファイル**`config-notwins.json`**を出力します。これは独自の設定ハッシュ（`run_name`）を持ち、`data.gold` / `eval.near_dupe_corpus`がツインなしファイルに設定された同一の構成です（`--companion-config <file>`で別のファイル名を指定できます。既存のファイルが上書きされることはありません）。また、トレーニング用のコマンドも表示されます。開発セットが登録されるまで（ステップ4）、先に切り出しを行ってからこの監査を再実行するよう指示されます。これにより開発セットの行もツインなしファイルから除外されます。`nmt-forge status`は、対応を行うまでこの判定（および未トレーニングのツインなしモデル）を警告として保持し続けます。

**拒絶（refusal）の表示例:** 実行を覚えておく必要はありません — `nmt-forge run`はすべてのトレーニングファイルをテストおよび封印セットと照合して監査し、リークがあれば拒絶します: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT"*。修正方法: `nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>` を実行し、クリーンアップされたファイルでトレーニングします。

---

## ステップ 3 — 確認前に予測を記録する

**あなたの指示:** *「テストセットで何かを測定する前に、各モデルがテストセットでどの程度のスコアを出すと予想されるかを書き留めてください」*

**forgeが行うこと:** トレーニングを予定しているモデルごとに、モデル名にちなんだ事前登録（preregistration）を1つ作成します:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

予測ファイルは、予測のJSON配列です。各予測には指標と1文の根拠、そしてベースラインに対する方向性（`"direction": "increase", "baseline_score": 0, "margin": 5`、後で自動チェックされます）または人間が確認する自由記述の期待値（`"expect": "between 10 and 30"`）が含まれます。あなた（またはエージェント）は、テストスコアが存在する**前**、**そしてテストセット上での既存モデルのベンチマークを行う前**にこれらをコミットします。[Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options)のステップ3にあるベースライン測定は、このステップの*後*に行います。エクスポート時、`--prereg <id>`によってどの予測がどのモデルを判定するかが示されます。あるいは、今すぐ予測をモデルの設定に固定（ピン留め）することもできます: `nmt-forge preflight run --config config-notwins.json`が出力する完全なハッシュを指定して、`prereg new`で`--config-hash <hash>`を実行します。後でその設定を編集（時間予算の変更など）するとハッシュが変わりピンが外れるため、エクスポート時にprereg名を指定する方が簡単な方法です。

**拒絶（refusal）の表示例:** ここで遭遇する可能性のある4つのパターンです。

- 未編集のテンプレートは拒絶されます: `REPLACE`のプレースホルダーは何も予測していないためです。独自の期待値と根拠を記述してください。
- Markdownや通常のテキストファイルは、フォーマットとテンプレートコマンドとともに拒絶されます。形式はJSON配列の1つのみです。
- テストセットがすでにスコアリングされた後に作成された事前登録は拒絶されます: *"[preregister] eval set 'project-test' was already read for scoring … before this preregistration"*。ベンチマークもカウント対象です。`--allow-after-reads`は、それらの読み取りの前に実際に（紙などに）書き留められていた予測のためだけに存在します。これは記録され、すべてのレポート、エクスポート、`DEPLOY.md`、および`nmt-forge status`に、その予測がN回のスコアリング読み取りの後に行われたものであることが明記されます。
- 事前登録のないテストセットのスコアリングは拒絶されます: *"[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories"*。これこそが、正当な結果と「結果ありきの後付けストーリー」を分けるものです。

:::info なぜこれが余分な作業に感じられるのか
これこそが本来の作業です。ここにあるすべてのガードは、実際の研究者を欺いてきた過ちです。このツールは、誠実なパスを簡単なパスにし、不誠実なパスを行き詰まるパスにします。
:::

ここで、テストセット上で既存の選択肢を測定し（[Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options)のステップ3）、戻ってトレーニングに進みます。

---

## ステップ 4 — 分割、ゲートの確認、そしてトレーニング {#step-4--check-the-gates-then-train}

**あなたの指示:** *「クリーンアップしたコーパスを訓練用（train）と開発用（dev）に分割してください。トレーニング実行はすべてのチェックを通過しますか？ 通過するならトレーニングを実行してください」*

**forgeが行うこと — 分割:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

テストセットは登録済みファイルとしてすでに存在しているため（テストセットを切り出した場合はステップ1ですでに分割済み）、`--test 0`はtrainとdevのみを切り出します。`--register project`はワークスペースに`project-dev`を記録します — これはスターター設定がすでに指定している名前です。

この分割は**グループ素（group-disjoint）**で行われます。原文*または*訳文を共有する任意の2つの文ペアは、**同じ**側に配置されます。これは低リソース言語のスコアが水増しされる最も典型的な原因です。教科書で多くの英語ドリルが1つの対象単語に対応している場合、単純なランダム分割を行うと片方がtrainに、そのツインがtestに入り、モデルは単に暗記した回答を「翻訳」することになります。出力には何が行われたかが示されます:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

すでにテストセットが登録されている場合、`split`はその場で新しいtrainファイルおよびdevファイルをテストセットとスクリーニングし、後で拒絶される可能性のある行があれば警告します。

**定型コーパス（会話集、ドリル）。** `--near-dupe 0.6`は、同一のフレームで構築された文である*ほぼ*重複（near-duplicates）も片側にまとめて保持するため、devやtestの行がtraining内にテンプレートツインを持つことはありません。高度に定型化されたコーパスでは、フレームが連鎖して1つの巨大なグループを形成することがあり（*"Does your arm hurt?"* 〜 *"Does your leg hurt?"* 〜 *"Your leg looks swollen"* …）、グループ全体は片側にしか送ることができません。その結果、要求したよりもはるかに多くの行（要求の**1.5倍**以上）が片方に割り当てられたり、trainingの行数が要求で残るはずの行数の半分未満になったりする場合、`split`は処理を拒絶し、何も書き出しません: *"[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)"*。続いてその理由（連鎖と最大グループのサイズ）と有効な解決策（しきい値を上げる、グループサイズに上限を設ける（`--near-dupe 0.6 --max-group 51` — 上限を超えるニアツインのリンクは切断されずに残り、分割時にカウントされます）、`leak-audit --drop-test-twins`で固定テストセットのツインを除外する、またはトレーニング素材とは独立してdev/testの文を作成する）が表示されます。forgeは連鎖自体をチェックします。このようなコーパスでは、そのニアツインに関するアドバイス（ここ、preflight、およびエクスポートのDEPLOY.md内）において`--near-dupe 0.6`は推奨されません。

**拒絶（refusal）の表示例:** 自前で作成した分割データをforgeに渡した場合、各分割間で重複があると`nmt-forge verify-split train.jsonl dev.jsonl test.jsonl`が拒絶します — *"[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'"*。修正方法: 該当する行を手動で削除するのではなく、`split`で再切り出しを行ってください。

**2つのモデルを作成する場合:** 開発セットが登録されたので、ステップ2のツインなし監査を再実行します（開発セットの行もツインなしファイルから除外されます）。その`config-notwins.json`を使用して、以下で2つ目のモデルをトレーニングします。

**forgeが行うこと — ゲートチェック:** `nmt-forge preflight run --config config.json`は、実行時に通過すべきすべてのゲートを✓または✗で一覧表示し、各✗には修正方法を示します（training extraがインストールされているかも含みます）:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

すべてクリア（緑色）になったら: `nmt-forge run config.json`を実行します（ツインなしモデルの場合は、`nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json`）。

デフォルトの`cpu-tiny`プリセットの場合、一般的なラップトップのCPU上で動作します（GPU不要、ダウンロード不要）。ただしトレーニングは即座に終了するツール呼び出しでは**ない**唯一のステップであるため、エージェントはポーリングするのではなく、出力をログファイルにリダイレクトしてバックグラウンドで実行し、重要な行（`refused`、`Error`、`wall-clock`、`RUN EXIT`）のみを監視する必要があります。損失曲線と停止ボタンを備えたライブパネルが**あなた**のために開きます（そのポートが空いていれば`http://127.0.0.1:8377`で開きます）— これはエージェント用ではなく、あなた向けです。実行の初期段階でforgeは速度を測定し、設定の`model.time_budget_hours`以内に完了できない実行を数日後ではなく数分以内に拒絶します。

`[schedule-sanity]`の行には、forgeがデータ構成から導き出した早期終了（early-stopping）の**下限（floor）**が表示されます。これにより、合成データが多い実行において、実際の開発データの損失が一時的に揺らいだだけで0.5エポックで強制終了してしまう事態を防ぎます（これは実際によくある失敗例です — [Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training)を参照してください）。

完了すると、forgeは（テストセットではなく）**隔離された開発セット上でチェックポイントを選択**し、`run-manifest.json`を出力して、開発セットのスコア（常に95%信頼区間付き）を表示し、次に実行すべきコマンドを提示します。

---

## ステップ 5 — 1度だけスコアリングしてパッケージ化

**あなたの指示:** *「テストセットでモデルをスコアリングし、使用できるようにパッケージ化してください」*

**forgeが行うこと:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

1つのコマンドで以下を行います:

- 実行で選択されたチェックポイントを使用してテストセットをデコードし、スコアリングします — 事前登録がない場合は拒絶され、ワークスペースの台帳に記録され、すべての数値に95%信頼区間が付与され、平易な言葉による**Diagnosis & Recommendations（診断と推奨事項）**セクションが出力されます。
- 結果を**mt-evalレポート**として`export/evaluation/`に書き出します。これにより、`mt-eval compare`を実行すると、ハーネスで測定した他のすべての対象（例えば[Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options)のステップ3にあるホスト型モデルなど）の隣にこのモデルが並べて表示されます。
- **自己完結型モデル**を`export/model/`（重みとトークナイザー、トレーニング状態は含まない）、`forge-model.json`（モデルの概要と測定方法）、Champollionプラグインマニフェスト、および正確なコマンドが記載された`DEPLOY.md`にパッケージ化します。`export/model/`にはテスト文は含まれません。デプロイするのはこのフォルダーのみです。

**スコア**はハーネスの主要な見出しです。コーパスchrF++と95%信頼区間は、forgeが表示するすべての場所（例: `chrF++ 31.2 [28.4, 34.0]`）で同じ形式で記載され、完全な記録（`forge-model.json`、エクスポート概要、`DEPLOY.md`）にはsacreBLEUシグネチャが含まれます。BLEU、spBLEU、TERはその横に並べて表示され、混ぜ合わされることはありません。完全一致（exact match）などの各種評価レーンは診断用です。forgeのいかなる画面でも、複合スコアや品質ラベルは出力されません。出力に価値があるかどうかを判断するのは、その言語の話者自身です。

**スコアの限定条件は、スコアとともに引き継がれます。** mt-evalレポートには、スコアの意味を限定するすべての要素が記録されます。例えば、*ほぼ一定の出力（near-constant output）*（モデルが多様な入力に対してごく少数の固定文のいずれかしか返さず、出力が入力に従っていない状態）、リファレンスより極端に長い/短い出力、あるいは原文のコピーなどです。`export`は、これらすべてをハーネス自体の言葉で伝えます: サマリー（`score_caveats`）、`forge-model.json`、そしてスコア直下の`DEPLOY.md`です。`status`、`report`、`compare`、`lint`も同様です。注意書き（caveat）が付いたスコアは、その注記なしに「引用すべき数値」として提示されることは決してありません。

何かが失敗した場合、中途半端に書き出されたエクスポートファイルが残ることはありません。注意点が2つあります: `export/evaluation/`にはテスト文が含まれているため、モデルと一緒にコピーしないでください。テストセットと一緒に保管してください（テストセットが非公開としてマークされている場合、そこにあるすべてのファイルにも同じマークが付きます）。また、**封印（sealed）**テストセットは1回限りです。エクスポートを行うと消費され、`--no-eval`（再スコアリングせずにモデルをパッケージ化）を渡さない限り、2回目のエクスポートは拒絶されます。

`nmt-forge evaluate <run-manifest>`は、パッケージ化せずに数値のみを取得したい場合の`export`のスコア専用部分です（`--harness-out DIR`はmt-evalレポートを出力します）。

**1つのテストセットに対する2つのモデル**（全データでトレーニングしたモデルと`--drop-test-twins`を適用したモデルなど）: ワークスペースに2回目の実行が保持されると、その実行の`NEXT`行および`nmt-forge status`には実行ごとのフォルダー（`--out export-<run>/`）が指定されます。順序は関係ありません。どちらのモデルが2番目にエクスポートされても、全データモデルの`DEPLOY.md`には最終的にツインなしモデルのスコアが引用されます。1つのテストセットに2つの事前登録がある場合、`nmt-forge status`と`nmt-forge report`がどちらの実行にどちらが適用されるかを示します（あるいは`--prereg <id>`が決定する必要があります — export the twin-free model with `--prereg notwins`). `nmt-forge compare`はテストセット上で2つのモデルをA/Bテストし、トレーニングデータ内にニアツインを持つテスト行の数をモデルごとに表示します。想起による優位性は想起として報告されます。各モデルの仮説（`<export>/evaluation/battery-hyps.jsonl`、エクスポート概要では`hypotheses`と表記）を受け取り、mt-evalがそのエクスポートに記録したスコアの注意書きを引き継ぎます。ツインなしスコアは、新しい文に対する評価として引用すべき唯一のスコアですが、付随する注意書きとセットでなければなりません。ツインなしモデルの出力がほぼ一定である場合、そのスコアは新しい文を翻訳できている証拠にはならず、`DEPLOY.md`は数値の横にその旨を明記します。

**ハーネスによる読み取りはカウントされます。** forgeがテストセットを登録すると、ファイルの横に小さな読み取りログ（`<file>.reads.jsonl`）が作成され、`mt-eval run` / `mt-eval compare`がそのファイルをスコアリングするたびに、内容を含まない1行（実行ID、目的、ファイルのsha256、タイムスタンプ）が追加されます。forgeはこれを読み取ります。このような読み取りの後に記述された事前登録は、事後予測（postdiction）として拒絶されます（`--allow-after-reads`を使用した場合を除きますが、その場合はすべてのレポートで開示されます）。これがステップ3がベースラインの前にある理由です。`mt-eval`によって読み取られた封印セットは消費され、`status`と`ledger show --set`は読み取り回数をカウントし、`DEPLOY.md`はエクスポートされたスコアが初見のものではなかった場合にそれを明記します。

### バッテリーリントレポートの読み方

レポートは、**レジスター（文体・分野別: 教科書、行政文書、口承説話など）**ごとのスコアテーブル（テスト行にレジスター名が指定されていない場合は単一グループ`all`）で構成され、それぞれに信頼区間が付き、その後に診断結果が続きます。診断では**最もスコアの低いレジスター**が特定され、それぞれについて最も考えられる原因と、次に打つべき**改善手段（レバー）**が提示されます:

| 診断の表示 | 意味 | 改善手段（レバー） |
|---|---|---|
| `R1-vocabulary-gap` | そのレジスターのスコアが低く、**かつ**出力が不完全。モデルの語彙が不足しています | **VOCABULARY（語彙）** — レキシコンを拡充し、ファネルを再確認する |
| `R2-structure-gap` | 単語は既知だが、文の*構造（shape）*が未知 | **STRUCTURE（構造）** — 不足している構文を追加する（テンプレート/コンポジター） |
| `R3-mixed-convention` | 出力に異なる綴り（表記揺れ）が混在している | **ORTHOGRAPHY（正書法）** — コーパスを1つの表記規則に正規化し、再トレーニングする |
| `R4-optimism-bound` | 「完全（full）」スコアがニアツインのテスト行によって水増しされている | **MEASUREMENT（測定）** — 汎化性能の指標としてstrictスコアを引用する |
| `R5-low-power` | 信頼区間が広い | **MEASUREMENT（測定）** — 信頼区間より小さい差分（delta）に基づいて行動しないこと。テストセットを拡充する |
| `R7-transfer-plateau` | 合成データでは優秀だが、実際のテキストでは停滞している | **REAL-DATA（実データ）** — 単言語データを逆翻訳するか、実際の並行文を取得する |
| `R9-harness-score-caveat` | mt-evalレポートがスコアに条件を付けている（例: ほぼ一定の出力）。mt-evalが重大と判定した場合は`high` | **MEASUREMENT（測定）** — 注意書きを併記してのみスコアを引用し、翻訳品質と呼ぶ前に実際の出力をいくつか確認する |

各診断結果には、判定の根拠となったエビデンスが付随します。エージェントがプログラムで対応可能な`--json`の診断結果については、次のように実行します: `nmt-forge lint export/evaluation/battery-hyps-battery.json --json`.

---

## ステップ 6 — Champollion CLIへのモデル提供（Serve）

**あなたの指示:** *「エクスポートしたモデルを起動（serve）し、アプリの文字列を翻訳してください」*

**forgeが行うこと:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve`は2つの方法で応答します。Champollionの**api method**規約（`POST /translate`）と、`champollion sync --method local`が通信する**OpenAI互換**の`/v1/chat/completions`です。`export/model/DEPLOY.md`には、推奨される`api`メソッドおよびプラグインマニフェスト用の`champollion.config.json`スニペットが含まれています。サーバーは`127.0.0.1`のみをリッスンします。ポートにアクセスできる人なら誰でもモデルを使用できてしまうため、ネットワーク上に公開する場合はトークン（`--token`または`NMT_FORGE_SERVE_TOKEN`）を指定する必要があります。CLIはループバックサーバーに対してはキーを必要としませんが、トークンを指定して起動したサーバーには`CHAMPOLLION_API_KEY`に同じ値を設定する必要があります。

2つのエクスポートモデルがある場合、どちらをデプロイするかはあなたが選択できます: `nmt-forge choose export-<run>/model`がそれを記録し、以降`nmt-forge status`はそのモデルを指定します。試用としてモデルを配信（serve）した場合は、「提供（served）」として記録され、「選択（choice）」としては記録されません。代わりにモデルをソブリンコンテストにエントリーする場合は、`DEPLOY.md` §6に宣言型（レーンA）エントリーを構成するファイル群と正確な`mt-eval contest submit-model`コマンドが記載されています。

何をデプロイしているかを理解してください: NMTモデルはテキストを翻訳するものであり、指示には**従いません**。そのため、CLIがLLMメソッドに送信するトーン指示、コーチングファイル、用語集などは無視されます。また、低リソース言語の機械翻訳は、読者の目に触れる前に流暢な話者によるレビューが必須です。

---

## 今やったこと

これにより、真に信頼できるスコアを持つモデルをトレーニングできました: 回答のリークはなく、テストセットを覗き見ることなく選択されたチェックポイント、すべての数値に付いた誤差範囲（エラーバー）、結果が出る前に記録された予測、推測に頼らず次に打つべき改善手段を示す診断結果 — そしてCLIから呼び出すことができ、測定した他のすべての手法と直接比較可能なパッケージ化されたモデルです。これこそが本質です — **誠実な結果がデフォルトであり、そこに到達するのにMTの専門知識（やGPU）は一切必要ありませんでした。**

数値が芳しくなかった場合（デフォルトモデルは設計上控えめな性能であるため、初回はそうなります）、[Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training)を参照してください — これはまさにそうした状況のために、症状別に書かれたガイドです。
