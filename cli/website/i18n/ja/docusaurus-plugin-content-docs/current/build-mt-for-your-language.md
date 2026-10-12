---
slug: /build-mt-for-your-language
title: "自言語向けの機械翻訳を構築する"
description: "「何から始めればよいか？」という段階から検証済みの翻訳ワークフローに至るまで。既存リソースの確認、テストセットの保護、選択肢の評価、より優れたものの構築と実証、そしてデプロイまでを、各ステップの具体的なコマンドやMCPツール呼び出しとともに解説します。"
---

# 対象言語向けの機械翻訳を構築する

このページでは、「自分たちの言語の翻訳を行いたいが、何から始めればよいか？」という段階から、**独自の文章で評価・測定し**、実運用に耐えうる翻訳ワークフローを構築するまでの手順を説明します。人間とAIエージェントの双方に向けて書かれており、すべてのステップで実行すべきコマンドと、エージェントが代わりに呼び出す[MCPツール](/docs/network/getting-started/mcp-server)（存在する場合）を示しています。

2つの具体例：

- **学校の事例**: ニュースレターや小規模なアプリ向けに、英語 → 平原クリー語の翻訳を求めている。教師が数百文をチェック済みだが、それらは非公開にしておきたい。
- **病院の事例**: ベッドサイド用の会話集向けに、インデックスでほとんどカバーされていない言語への英語からの翻訳を求めている。テスト文には臨床表現が含まれており、外部のAIサービスに送信することは絶対に避けなければならない。

最終的に手に入るもの：プライベートなテストセット、そのセットに対する複数の手法のスコア、より優れた手法（コーチングされたモデル、または自前で訓練したモデル）、そしてその手法をCLI経由でデプロイした環境（すべての数値は、算出根拠となった手法まで追跡可能）。

:::info[このガイドの対象外となること]
ここに記載されている内容は、翻訳を完全に正確にするものではありません。スコアが示すのは、どの選択肢が**あなた自身の文章において誤りがより少ないか**であり、実際に利用に適しているかを判断するのは依然として流暢な話者です。いずれの数値を信頼する前にも、[Honest Limitations（誠実な制約事項）](/docs/network/honest-limitations)をお読みください。
:::

:::warning[エージェントへ: ユーザーのファイルを開く前の注意]
テストセットが機密である可能性がある場合（教師による確認済み、看護師による確認済み、コミュニティが未公開のものなど）、その内容を読み取らないでください（`cat`、`head`、プレビューも不可、フォーマットの確認であっても禁止）。読み取った内容はモデルプロバイダーに送信されてしまいます。ユーザーに確認し、まずローカル限定（local-only）として設定してください（[ステップ 2](#2-gather-your-data--and-protect-your-test-set)）。
:::

## 0. インストール

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

エージェントの場合は、その設定にMCPサーバーを追加します。

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. 既存のリソースを調査する

その言語についてすでに判明している情報（辞書、文法、コーパス、形態素解析器（FST）、モデル、公開済みの結果、サービスなど）と、それぞれの情報のソースを確認します。

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**エージェント:** `search_languages { "query": "Atya" }` は、スペルミスがあってもコードを検索できます（編集距離による近似名検索）。各検索結果において、その言語がどこで話されているかを表示するのは、言語カードにそのソースが明記されている場合のみであり、ユーザーが似た名前の言語間から適切に選択できるようにそのソースもあわせて表示されます。ソースのない所在地は決して表示されません。その旨が該当行に示され、代わりにGlottologのレコードへのリンクが表示され、情報源元で候補を比較できます。npmインストールの場合、同梱のコアセットに含まれない言語は champollion.dev で公開されているカードテーブルから補完されます。これらにはまだフィールドごとのソースが含まれていないため（テーブルの次回アップロード時に追加予定）、その行には所在地ではなくGlottologへのリンクが含まれます。表示された情報から候補を判別できない場合は、話者の判断を仰ぎます（後述）。その後、`language_overview { "code": "<code>" }` によって、何が存在するか、どのようなベンチマークや結果があるか、そして番号付きの次のステップが1ページにまとめて表示されます。単一の言語を受け付けるツールは、それを `language` としても受け入れます。

カードの記載内容はそのまま解釈してください。**「記載がないこと」は「不明」を意味し、「存在しないこと」を意味するわけではありません。**辞書が記載されていないカードは、インデックスに記録されていないことを意味し、辞書が一切存在しないわけではありません。情報源によって意見が分かれる場合（話者数などでよくあります）、カードにはそのすべてが表示されます。

対象言語のカードがまったく存在しない場合でも、以下の手順はすべて実行可能です。単にツール側がその言語について把握している情報が少ないだけです（いずれにしても `nmt-forge init <code> --no-card --name <name>` は訓練プロジェクトを開始します）。

### 言語の変種がまだ確定していない場合

1つの言語名が複数の言語に該当することがあります。例えば「Ayta」は、フィリピンの6つのアイタ諸言語に一致し、それぞれ異なるコードを持っています。**まずは話者に確認してください。**コミュニティは自分たちがどの変種を話しているかを把握しており、外部が勝手にコードを選ぶことは、彼らに対する決めつけになってしまいます。

回答が得られる前に作業を開始しなければならない場合は、私有領域コード（private-use code）を使用してください。ISO 639では、まさにこのような目的のために `qaa` から `qtz` が予約されています。プロンプトやレポートで言語名が表示されるよう、表示名を設定します。

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

これにより、`champollion.config.json` に次のように書き込まれます。

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` は、コードが言語カードのない私有領域コードであることを示します（スペルの確認は求められません）。

`init`、`sync`、`verify`、`network register-corpus` はすべて私有領域コードを受け付けます。正規のコードに置き換えるまでの間に生じる制約は以下のとおりです。

- **カード情報の欠如。** 言語カードからのレジスター（位相）プリセット、複数形ルール、正書法/文字体系の情報がありません。同期には汎用設定が使用されるため、最初の出力結果は話者と一緒に確認してください。
- **FSTなし。** 私有領域コードには形態素解析器が関連付けられていないため、単語ごとのチェックは行われません。
- **過去の実績データなし。** 公開されているベンチマークやキューは正規のコードでキー管理されているため、`recommend` や `corpora` には表示できるものがありません。

コミュニティによって変種が確認されたら、そのコードに切り替えます。

1. `champollion.config.json` 内で、`qaa` を正規のコードに置き換えます（カードの名称で十分な場合は `name` を削除します）。
2. ロケールファイルの名前を変更します（`messages/qaa.json` → `messages/ayt.json`）。既存の翻訳は有効なまま維持されます。次回の `champollion sync` ではそれらを保持し、新しい内容のみを翻訳します。
3. 正規のペアでテストセットを再登録します：
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`
   登録済みファイルは新しいIDを選択しない限りIDが保持されるため、コマンド実行時に渡すべき `--id` が表示されます。（ここでは `--pair` に `eng-ayt` または `"eng>ayt"` を指定でき、`nmt-forge init` でも同様です。シェルでは単体の `>` が「ファイルへのリダイレクト」として解釈されるため、`>` の形式は引用符で囲んでください。）

## 2. データを収集し、テストセットを保護する

**最初にテストセットを分離してください。** あらゆる訓練やチューニングを行う前に、評価の基準となる文（教師がチェックした文、看護師がチェックした文など）を取り分けておき、それらを訓練には絶対に使用しないでください。

テストセットはTSVファイル形式です。1行に1組の文ペアを含み、原文、タブ文字、参照訳（正解訳）の順で並びます。`# ` で始まる行はコメントとして扱われます。

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

次に、そのデータをどこまで送信してよいかを決定します。

| 希望する設定 | 行うべき操作 |
|---|---|
| このマシンから外部へ一切出さない（外部のAIサービスに文を見せない） | ファイルの隣にマーカーファイルを配置します（後述）。自身のマシン上のローカルモデルのみでテスト可能になります。 |
| テストセットの存在は公開してもよいが、内容は一切非公開にする | `champollion network register-corpus --tier private --role test …` でメタデータのみを登録します |
| 自身が管理するマシン（場合によってはエアギャップ環境）でコンテストを実施する | `--tier sealed` に加え、[sovereign node（主権ノード）](/docs/network/sovereignty/sovereign-eval-node)を使用します |
| 公開されており、オープンライセンスが付与されている | `--tier public` でその所在地を指し示します。当プロジェクトでホストすることは行いません。 |

「このマシンから外部へ出さない」ことを示すマーカー：

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

これを配置すると、`mt-eval run` はそのファイルに対するすべてのリモートプロバイダーを拒否し、ループバック（ローカル）上のモデルに対してのみ実行されます。詳細：
[Registering Corpora（コーパスの登録）](/docs/network/sovereignty/registering-corpora)。

**使用すべきライセンスID。** 登録時に `--license` の指定が求められます。これはデータの所有者が実際に許諾した条件であり、プレースホルダーは絶対に使用しないでください。所有者に確認し、該当するIDを選択します。すでにSPDX IDのもとでテキストを公開している場合はそのID、評価のみを目的とし、訓練不可、共有不可、有償評価不可とする場合は `community-eval-grant-nc`、有償評価のみを許可する場合は `community-eval-grant`、全著作権留保とする場合は `proprietary`、独自の条件を設ける場合は `LicenseRef-<name>` を指定します。後ろの4つは `LicenseRef-…` ID（カスタム許諾）であり、データ管理者が許可を記録するまで、それらに対するリモート評価は拒否されます。管理者の確認が取れるまでは、選択内容を暫定として記録してください。ローカル限定のデータは、ライセンスの内容に関わらずローカルに留まります。文がどこに送られるかを決めるのはライセンスではなくマーカーです。[Which licence id for a private test set（プライベートテストセットに使用するライセンスID）](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set)。

**エージェントへ: ローカル限定のテストファイルを読み取らないでください。** `cat`、`head`、内容確認のためのプレビューなどは一切行わないでください。読み取ったデータはモデルプロバイダーに送信されるため、マーカーが禁止している送信行為に該当してしまいます。読み取る必要もありません。ツール側が出力からテスト文を除外し（`mt-eval compare` は代わりにエントリーIDとスコアを表示します）、`--show-text` はターミナルの人間が確認するためにのみ存在します。

**エージェント:** `language_overview { "code": "<code>" }` はその言語における保護オプションの一覧を表示します。`run_benchmark` はマーカーを尊重し、保護された文を外部に送信する代わりに拒否理由とともにエラーを返します。

### 将来的にモデルを訓練する可能性がある場合：評価前に「登録、スクリーニング、事前予測」を行う

ステップ3でテストセットを使った測定を行う前に、今すぐ以下の3つの手順をこの順序で実行してください。Forgeはテストセットへのすべての参照をカウントしており、ベンチマーク（ステップ3）はスコアリングを伴う参照とみなされます。参照が一度拒否された後に事前登録を作成することはできません。順序が重要であり、後から実行したのでは意味が異なります。

1. **NMT Forgeにテストセットを登録する。** 参照ログの記録がここから開始され、以降のすべての読み取りがカウントされます（登録前のスコア参照は一覧には表示されますが、カウントはされません）。
2. **訓練コーパスをテストセットに対してスクリーニングする**（`leak-audit`）。これは監査目的でテストセットを読み取るものであり、スコアリングではないため予測回数にはカウントされません。判定結果を確認してください。テスト行の大部分に酷似した文（ニアツイン）がコーパス内に存在する場合、全データで訓練したモデルは翻訳能力ではなく訓練フレーズの暗記（再現率）をスコアリングすることになってしまいます。その場合は通常、全データ用とニアツイン除外用の2つのモデルを訓練します（`--drop-test-twins` がそのコーパスと設定 `config-notwins.json` を書き出します）。
3. **訓練予定のモデルごとに1件ずつ、モデル名を付けた予測（preregistration）を書き留める。** これらの予測値が、後でテストスコアを評価する基準となります。エクスポート機能は、各モデルを `--prereg <id>` で指定された予測値と比較評価します（1つのテストセットに2つの予測がある場合、自動推測は行われません）。代わりに、`nmt-forge preflight run --config config-notwins.json` が出力する完全なハッシュである `--config-hash <hash>` を使用して、予測を特定のモデル設定に固定することもできます。ただし、その設定を後から編集（タイムバジェットの変更など）するとハッシュが変わり固定が解除されてしまうため、エクスポート時に事前登録名を指定する方がシンプルです。

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

判定がSEVERE（重大）だった場合は、ニアツイン除外モデルとそのモデル用の予測を追加します（`school-crk/` 内）：

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

ニアツイン除外コーパスは別の独立したファイルとして保存されます。`corpus.clean.jsonl` は全データコーパスとして保持されます。leak-auditは、設定・実行・データ分割で読み込まれているファイルや、他の監査によって書き出されたファイルの上書きを拒否します（`--overwrite` は意図的にファイルを置き換えます）。`--json` の応答には各リストの最初の数行番号が表示され、クリーンアップされたコーパスの隣にある `.audit.json` ファイルにすべての行番号が保持されます。

`--allow-after-reads` は、読み取りが行われる前に実際に（紙の上などで）事前に書き留められていた予測のためだけに存在します。これは記録され、すべてのレポートにおいて、export and DEPLOY.md then says the predictions came after the scores.

**エージェント:** `forge_init { "code": "<code>", "dir": "<dir>" }` を実行後、`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`、`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }` と進め
（上記のコマンドはプロジェクト内から実行されるため、パスは `project_dir` から読み取られます。絶対パスであればどこからでも機能します）、
その後ユーザーとともに `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }` をモデルごとに1件ずつ、各モデルにちなんだ名前で実行します（`forge_export` はそのIDを `prereg` として受け取ります。または `forge_prereg` の `config_hash` で特定の設定に固定します）。テストセットが登録されると、`forge_status` はすぐにこのステップを提示します。ステップ4の訓練は同じプロジェクト内で行われます。
`language_overview` でもこれらのステップがこの順序でリストされます。

## 3. 各選択肢を測定する

**あなた自身の**テストセットに対して各候補を実行します（将来訓練を行う可能性がある場合は、事前にforgeでの登録、スクリーニング、事前予測を済ませておいてください — [ステップ 2](#2-gather-your-data--and-protect-your-test-set)）。ハーネスは、機械翻訳評価の学術標準に則り、すべての候補を同一の方法でスコアリングします。メインの指標はコーパスchrF++（95%信頼区間付き）であり、BLEU、spBLEU、TERが並列して表示されます（決して1つの数値に統合されることはありません）。完全一致（Exact match）および挙動チェック（誤った文字体系の出力、ハルシネーションの兆候）が診断項目として、コストや速度とともにレポートされます。ハーネスに対象言語の形態素解析器が組み込まれている場合は、診断項目としてFST受理率と形態素精度も追加されます。
`mt-eval setup --status` にこれらの言語がリストされており、`mt-eval setup --comet` は適用可能な場合にCOMETを追加します。

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` は、モデル間の差が統計的に有意なものか、ノイズの範囲内かを示します（対応のある近似ランダム化検定）。信頼区間の内側にある差は、順位付けの根拠にはなりません。比較結果は、比較対象の実行名に基づいて `comparison-<hash>.json` として出力されます。レポートが同一フォルダーにある場合はその隣に、異なる場合はその上位の `comparisons/` フォルダーに保存され、特定の実行フォルダーの中に保存されることはありません。別の比較によって上書きされることもありません。

**評価パック。** 言語によっては、メトリクス算出に追加のツールを必要とする場合があります（平原クリー語における形態素解析器など）。初回実行時の `mt-eval run` で不足しているツールが通知されます。解析器が見つからない場合でも実行自体は中断されません。FST受理率は「未計算」として記録され、`mt-eval setup --lang crk` で解析器をインストール（マシンごとに1回）した後に、`mt-eval test <run log>` を実行すれば再翻訳することなくスコアを追加できます。

**エージェント:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` はスコアを返します。`publish: true` を渡さない限り、何も公開されません。`target_language` として指定されたコードは、プロンプトに送られる前に言語カードの名前（「Plains Cree」など）に変換され、実行計画にはモデルに送信されるプロンプトが表示されます。コーチングファイルがある場合はそのプロンプトが差し替えられ、実行計画にその旨が表示されます。カードに2つの表記体系が記載されており、`script` を渡さない場合、実行計画は参照訳がどちらの表記体系を使用しているかを判定し（マシンローカルで文字数をカウント、文自体は外部に送信されません）、その表記体系での出力を要求します。レポートはテストファイルの隣の `data/results/mcp-run-<id>/` に保存され、ハーネスの翻訳キャッシュは `data/results/cache/` に保存されます。`get_run_status` はそれらに対する `mt-eval compare` コマンドを出力し、登録済みコーパスIDに対する実行については、レポートをパス付きで一覧表示します。`local-model` の実行計画には、確認によってどれだけのダウンロードが発生し、どこに保存されるかが事前に示されます。

**どのメトリクスを信頼すべきか**は言語によって異なります。
`get_metric_reliability { "language": "<code>" }` (MCP) は、その言語において自動評価メトリクスが人間の評価と対照して検証されたことがあるかどうかを報告します。低リソース言語の大部分では検証例が存在しないため、慣例としてchrF++が用いられます。これは同一テストセット上での手法間の相対比較として解釈し、絶対的な評価点とはみなさないでください。

## 4. より優れたモデルを構築する

アプローチは2つあります。どちらもステップ3と同じ方法で測定します。

**汎用モデルへのコーチング。** 用語集とガイダンスを与え、コーチングを適用した状態でステップ3を再実行します。

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` にはMarkdown、プレーンテキスト、JSONを指定できます。ファイル全体のテキストがモデルへの指示としてそのまま送信されます。

用語のスコアリング（指定した各用語が指定通りの訳語として出力されているか）を行うには、`--glossary terms.json`（`{"blood pressure": "…"}`、または用語ごとに許容される表記のリスト）を使用して、比較対象のすべての実行に同一の用語リストを指定します。この用語集はスコアリングにのみ使用され、モデルには送信されません。そのため、通常の実行とコーチングを適用した実行の両方を同一の用語基準でスコアリングできます。`--glossary` を指定しない場合、JSONコーチングファイルの `dictionary`（[coached prompting（コーチングプロンプト）](/docs/network/tutorials/coached-llm-prompting)の形式：`grammar_rules`、`dictionary`、`style_notes`）が代わりに使用されます。その場合、実行結果は自身のコーチング内容に対してスコアリングされ、出力にもその旨が示されます。Markdownのコーチングファイルも同様にコーチングを行いますが、用語集は提供されません。

[coached prompting（コーチングプロンプト）](/docs/network/tutorials/coached-llm-prompting)および[dictionary-augmented prompting（辞書拡張プロンプト）](/docs/network/tutorials/dictionary-augmented-llm)を参照してください。

**NMT Forgeで独自モデルを訓練する。** 少量のデータによる結果を見かけ上良く見せてしまうようなミス（テスト文のリーク、不適切なデータ分割、テストセット上でのチェックポイント選択、ノイズを進捗と誤認することなど）を自動で防止します。

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` は、訓練前に `run` が行うチェック（開発セット、すべての訓練ファイルのリーク監査、デコード長）を実行するため、これに合格した実行が開始直後にエラーで拒否されることはありません。`config.json` は `data/split/` からデータ分割を読み取ります。別の場所で分割が行われた場合は、変更すべき行が指示されます。

訓練用の文ペアは、テストセットと同様にTSV（または `source` と `target` を含むJSONL）で用意します。`leak-audit`（ステップ2）によって、テストセットが訓練データに混入するのを防ぐために該当行が除外され、それぞれの理由が説明されています。2つのモデルを訓練する場合は、データ分割後にステップ2のニアツインleak-auditを再実行し（開発セットを登録すると、その行もニアツイン除外ファイルから取り除かれます）、その後 `nmt-forge run config-notwins.json` と
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
任意の時点で次のコマンドを実行します。デフォルトのモデルはCPU上で数分で訓練できます。1,000〜2,000組の文ペアの場合、chrF++はおよそ5〜30程度が見込まれます。これは言語全般ではなく、データ内のフレーズやパターンを学習するためです。`export` はテストセットを1回スコアリングしてmt-evalレポートを出力するため、訓練済みモデルをステップ3のすべての結果と比較できます。詳細な手順：[Train Your First Model（初めてのモデル訓練）](/docs/network/getting-started/train-your-first-model)。

**エージェント:** 最初に、そして各ステップの後に `forge_status { "project_dir": "<dir>" }` を実行します。ステップ2の `forge_init`、`forge_register_eval`、`forge_leak_audit`、`forge_prereg` の後は、`forge_split { corpus, test, seed, out }`、`forge_preflight { "target": "run" }` と進め、ターミナルで `nmt-forge run` を実行した後に `forge_export { run_manifest, out, prereg }` を実行します。`forge_split` の前に `get_training_guardrails` を一度呼び出してください。forgeが適用する各ルールと、それによって防止されるミスの一覧が表示されます。`forge_split` の `register` はプレフィックスまたは `true`（`project`）を受け取り、`out` のデフォルトは `data/split` です。`forge_init` 以降のすべてのforgeツールは、それが返す `project_dir` を受け取ります。`get_training_guardrails`（オプションの `topic`）は各ルールについて説明します。各ツールの全引数については、[MCP Server](/docs/network/getting-started/mcp-server#arguments)を参照してください。

## 5. 評価結果を証明する — プライベートに、または公開で

スコアはあなた自身のものです。自身で選択しない限り、何も公開されません。

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

プライベートまたはローカル限定のテストセットは、その文をアップロードすることは決してありません。`--dry-run` にもその旨が一行ずつ明記されます。テスト文の内容を見せることなく他者と性能を競い合いたい場合は、自身が管理するマシン上でコンテストを開催します。参加者は自身の手法を提出し、それがあなたのノード上で実行され、外部に出るのはスコアのみとなります。新規コンテストでは終了時まで全スコアが非公開となるため、テストセットに合わせた過学習（チーティング）を防ぐことができます。
詳細は [Run a Sovereign Contest（主権コンテストの実施）](/docs/network/sovereignty/run-a-sovereign-contest) を参照してください。訓練したモデルを他者のコンテストに参加させる場合、エクスポート内の `DEPLOY.md` §6 に提出に必要なファイル群と正確な `mt-eval contest submit-model` コマンドが記載されています。

**エージェント:** `list_contests { "language": "<code>" }`、`get_contest { id }`。公開ボード向けには `get_results { "target_language": "<code>" }` および `get_run_card { id }` を使用します。

## 6. 最適な手法を組み合わせる

**まずは自分自身の測定結果の中から選択してください。** テストセット上でスコアリングしたものはすべてmt-evalレポートとして保存されています（ステップ3および4のベースラインやコーチング適用実行、および訓練済みモデルの各エクスポート：export folder). A terminal run with `-o results` writes to 内の `evaluation/runlog_report.json`、
`results/*_report.json`。MCP `run_benchmark` で開始された実行は、テストファイルの隣の `data/results/mcp-run-<id>/` に書き込まれます）。これらを一度にまとめて比較します。1つ目のglobパターンはターミナル実行用、2つ目はエージェント実行用です（実際の実行形態に合致する方を使用してください。zshでは一致するものがないglobでエラー終了します）：

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

信頼区間の内側にある差は順位付けの根拠にはなりません。また、訓練データ内にテスト文のニアツインが存在する訓練済みモデルは再現率（暗記）でスコアを獲得しているため、ニアツイン除外の数値を横に併記してください（DEPLOY.md および `nmt-forge report` にどちらであるかが記載されています）。あわせて、mt-evalが付与した**スコアへの注記（caveat）**も確認してください。「ほぼ一定の出力（near-constant output）」という注記（多種多様なテスト文に対して、ごく少数の特定の文しか出力されない状態）は、スコアの数値がどうであれ入力文の内容を反映していないことを意味します。forgeはこれを `export`、`DEPLOY.md`、`status`、`report`、`compare`、`lint` 内のスコアの隣に表示します。複数のモデルをエクスポートした場合、`nmt-forge status` は各モデルをスコア、ニアツイン除外スコア、注記とともに一覧表示し、どれをデプロイするか選択を求めます。選択結果は `nmt-forge choose <export>/model`（または `nmt-forge serve <export>/model --choose`）で記録します。試行目的でのモデル配信は「配信中（served）」として記録され、「確定した選択」とはみなされないため、決定するまで `status` は確認を求め続けます。

**エージェント:** `forge_status { "project_dir": "<dir>" }` — `choose-export` の状態では、ユーザーに `result.advice.exports` と各エクスポートのスコアおよび `score_caveats` を提示し、どのモデルをデプロイするか尋ねます。ユーザーの回答はターミナル上で `nmt-forge choose` を使って記録されます。暫定的な配信（provisional serve）ではこの決定は完了しません。`forge_compare { eval_set, hyps_a, hyps_b }` は、2つのforgeモデルをそれぞれのニアツイン注記およびmt-evalのスコア注記とともに勝者の隣に表示してA/B比較を行います。各モデルの推論結果（hypotheses）ファイルは、`forge_export` が返す `hypotheses` パスです（`<export>/evaluation/battery-hyps.jsonl`）。

次に、自身の実行結果以外の外部リソースにも目を向けてみましょう。言語ペアやテキストの種類によって、最適な手法は異なります。[Network](/docs/network/) には、利用可能な手法やサービス、そしてそれぞれの根拠（自分自身の測定値ではなく、公に発表されているエビデンス）が掲載されています。

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

リーダーボードに設定とともに公開されている手法は、スコアリングされたときとまったく同じ構成で導入できます。`champollion network leaderboard --install <method> --apply` を実行すると、その言語ペア向けに対象の設定がプロジェクトに追加されます。CLIでは**言語ペアごと**に手法を設定できるため、ニュースレターのクリー語には自前で訓練したモデルを使用し、フランス語にはホスト型の外部モデルを使用するといった使い分けが可能です。複数の手法を連結する方法（例：翻訳モデルの出力をチェッカーにかけるなど）については、[chained models（連動モデル）](/docs/network/tutorials/chained-models)で解説しています。

## 7. 実運用に投入する

実際に測定・評価を行った手法をデプロイしてください（別の手法にすり替えないでください）。

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

サーバーの起動中、`nmt-forge status` には `serving` と表示されます（サーバーが応答し続けているかを確認します）。サーバー停止後は、同一ポートでの再起動コマンドとして `serve` が再度提示されます。

または、コーチングを施したホスト型モデルを使用する場合は、`champollion.config.json` 内で該当の言語ペアに対して設定します。いずれの場合も：

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**自前モデルでまだ対応が難しい点。** 数千文程度で訓練された小規模モデルは、それらのフレーズを学習します。その結果、プレースホルダー（`{name}`）や複数形、マークアップを破損させたり、「Home」のような短いラベルを1つの完全な文に変換してしまったりすることがよくあります。品質ゲート（quality gate）はこのような出力を拒否し、破損したデータが書き込まれるのを防ぎます。言語ペアに**フォールバック（fallback）**を設定しておけば、拒否された文字列は同じ同期処理の中で2番目の手法へと自動的に回されます。

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

マシンからテキストを一切送信できない場合は、フォールバック先もローカルで稼働するモデルに設定します。`"fallback": { "method": "local", "model": "<your local model>" }` を指定すると、このマシン上のOpenAI互換サーバー（Ollama、llama.cpp、vLLM）に送信され、API費用は0ドルで済みます。通常、ホスト型の外部モデルの方がセカンドオピニオンとして強力であるため、テキストを外部プロバイダーに送信しても問題ない場合はそちらを使用してください。

自前モデルは、自身が翻訳可能なすべてのテキストを処理します。フォールバック先には、品質ゲートで拒否されたものや、脱落・破損したMarkdownブロックのみが渡され、その出力も同じ品質ゲートによるチェックを受けます。`sync` は処理件数を含んだ `[FALLBACK]` 行を言語ペアごとに出力し、`champollion verify` はどちらの手法でも翻訳できなかった文字列を一覧表示します。[Fallback method（フォールバック手法）](/docs/getting-started/configuration#fallback)を参照してください。

一度限りの単発処理として、該当の文字列だけを別の方法で翻訳することも可能です。

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…手動で翻訳するか、あるいは `champollion xliff export` を使ってレビュー担当者に依頼することもできます。そして、アプリ独自の文言をテストセットに追加してください。教師が作成した文で高スコアを出すモデルであっても、「どこが痛みますか？」のような表現で誤訳を起こす可能性は十分にあります。

**文字体系（表記体系）。** その言語に複数の正書法が存在する場合（例：平原クリー語における標準ローマ字表記と音節文字）、CLIは翻訳を開始する前にどちらを使用するか選択を求めます。設定ファイル内で該当言語の `"script"` を指定してください。メッセージに選択肢が表示されます。

翻訳メモリ（TM）機能により、変更のない文章に対して二重にコストが発生することはなく、モデルを切り替えても既存の翻訳がすべて再実行されることはありません。[CI/CDガイド](/docs/guides/ci-cd)を参考にCIパイプラインへ組み込んでください。`export/model/DEPLOY.md`（ステップ4で生成）には、訓練済みモデル向けの具体的な設定内容（`api` メソッドや、ネットワーク上で安全に公開する手順を含む）が記載されています。

**エージェント:** `translate { texts, source_language, target_language }` は同一のパイプラインで文字列を処理します。自身で配信するローカルモデルの場合は `method: "local"` と `base_url`、または `method: "api"` と `endpoint` を追加し、複数の文字体系を持つ言語の場合は `script` を指定します。

## 各ステップにおける判断基準

| 決定事項 | 選択肢 | 該当するケース |
|---|---|---|
| テストセットの配置場所 | local-only（ローカル限定） | 機密データである、またはデータ作成者の許諾をまだ得ていない場合 |
| | private / sealed（非公開 / 封印） | 内容は見せずに、存在を周知したい、またはコンテストを開催したい場合 |
| コーチングか訓練か | ホスト型モデルのコーチング | 用語集はあるが対訳テキストが少なく、外部サービスの利用が許容される場合 |
| | forgeによる訓練 | 数千ペア以上のデータがある、またはデータをマシン内に留める必要がある場合 |
| 公開設定 | スコアのみ | 自身が作成したデータではないすべてのケースにおけるデフォルト |
| | 何も公開しない | 常に選択可能（非公開での測定も十分に有用です） |

## 発生するコストについて

- 本ツール群は非商用利用であれば無料です。学校、公立病院・クリニック、慈善団体、研究プロジェクトなどが対象となります（CLI、nmt-forge、MCPサーバーはPolyForm Noncommercial 1.0.0ライセンス、評価ハーネスはオープンソースのAGPL-3.0-or-laterライセンス）。[Who may use this（利用許諾の対象者）](/docs/getting-started/who-may-use-this)。
- ホスト型モデルを利用する場合、各プロバイダーの利用料金が発生します。`--max-cost` を設定すると、許容額を超えて消費する前に実行を停止でき、レポートには1文あたりのコストが表示されます。ローカルモデルの場合、マシンの処理時間以外の費用はかかりません。
- デフォルトのforgeモデルの訓練には、CPUと数分の時間が必要です。より大規模なプリセットを使用する場合はGPUが必要となります。
