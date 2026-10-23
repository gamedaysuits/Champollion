---
title: "封印テストの主催とプロジェクトへの参加"
slug: /agents/hosting-and-joining
description: "自身で構築する以外にも、2つの参加方法があります。mt-eval contest と mt-eval node で封印テストを主催する方法（動作はしますが、まだ完全にレールに乗っているわけではなく、主催者が選んだ保管者がキーシェアを保持します）、そして mt-eval project で登録済みプロジェクトに参加する方法です。すべてのコマンドについて、何がどこへ送信され、何が決して表示されないのかを説明します。"
---

# 封印テストのホストとプロジェクトへの参加

ビルドレールの隣にある2つのレーンです。どちらも通常の`mt-eval`コマンドであり、いずれも`champollion next`が指定するステップではありません。

## 封印テストをホストする

**正確な現状。**

- 動作します。封印セットの準備、鍵セレモニー、エアギャップされたノードでのエントリーの実行、判定やランキングはすべてテスト済みのコマンドです。
- **まだレール上にはありません。** `champollion new --kind task`は拒否されます。唯一のジャーニーは言語に関するものです。手動での長めの手順が必要となるため、[コンテスト運用手順書](/docs/network/sovereignty/run-a-sovereign-contest)に従ってください。
- **鍵のシェアは主催者が指定した保管者によって保持されます。** コード内で保管者を任命したり審査したりすることはありません。いかなるテストにおいても、コミュニティの鍵保管者は任命されていません。
- **Champollionは鍵のシェアも秘密鍵も保持しません。** セレモニーは主催者のマシン上で実行され、登録時に送信されるのは識別子、ダイジェスト、予選通過のしきい値のみです。鍵、シェア、文自体が送信されることは決してありません。

**注意。** ホストすることは、人々の文がどう扱われ、誰がそれをロック解除できるかを決定することです。以下のすべてのステップは主催者の判断によるものです。主催者から求められた場合にのみ各ステップを実行してください。

### 作成されるもの

`mt-eval contest prepare`は主催者のコーパスを分割します。

| フラグ | セット | 閲覧可能な対象 |
|---|---|---|
| `--dev-size`（必須） | 予選セット：原文と参照訳 | 公開（`<out>/public/`からリリース） |
| `--secret-size` | コンテストの登録対象となる封印テスト | 閲覧者なし（`<out>/local/`内に封印） |
| `--sealed-holdout-size`（`--secret-size`が必要） | 第2の封印スプリット。採点されるが終了まで非公開 | 閲覧者なし |

`--seed`、`--qualifier-threshold`（0より大きい値）、および`--license`は必須です（ライセンスは推測されません）。`--custodian-group`と`--threshold-pubkey`が必要です（封印セットの暗号化先となる鍵）。各封印セットの平文は封印後に削除されます。`<out>/local/manifest.json`はレシピを保持し、マシンから外部に出ることはありません。封印には`champollion network seal-corpus seal`が実行されるため、`champollion` CLIがインストールされている必要があります。

### 保管管理

**しきい値保管管理（N個中M個）。** エアギャップされたノード上：

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init`は、鍵を生成し、Shamirの秘密分散法で分割し、1回の呼び出しでゼロクリアします。公開記録である`ceremony.json`と、保管者ごとに1つのシェアファイルを書き出します。`--set`は秘密セットのID、`--group`はprepareで使用する`--custodian-group`である必要があります。prepareはこれらをチェックしないため、不一致は実行が拒否されたときに初めて判明します。セレモニーの記録である`--threshold-pubkey <ceremony>/ceremony.json`をprepareに渡してください。

**ロック。** 封印セットの復号は、セットに一致するIDを持つ異なる保管者からの少なくともM個のシェアを指定した `mt-eval node run-method <id>
--offline --share … --share …` によってのみ行われます。しきい値保管管理はこのオフラインレーンでのみ実行されます。

**単一鍵。** `champollion network seal-corpus keygen --out <dir>`は1組のキーペアを作成します。その鍵ファイルを保持している人は誰でも単独で復号できます。これは接続ノードレーンで使用される方式です。

### 主催者の手順（しきい値保管管理）

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

セットがセレモニー鍵で封印されていた場合、`node init --from-contest`によってしきい値保管管理が設定されます。参加者は公開開発セットで予選通過を行います（`mt-eval contest qualify`) and submit methods or models (`mt-eval contest submit-method`、`mt-eval contest submit-model`、いずれも`--offline --bundle-out`パスを指定）。すべてのノードコマンドは[ノードガイド](/docs/network/sovereignty/sovereign-eval-node)に記載されています。

### 接続が必要なものとその所有者

| オフラインで動作 | サインインが必要 | データベースのサービスキーが必要 |
|---|---|---|
| `contest prepare --no-register`、`contest qualify`（`--offline-qualifier-id`、`--offline-threshold`を伴う）、`contest validate`、`submit-* --offline`、すべての`node ceremony`、`node seal`、`node keygen`、`node init`、`node import-bundle`、`node run-method --offline`、`node export-scores`、`node verdicts`、`node egress-check` | `contest register`、`contest create`、オンラインの`submit-*`、`contest open-intake`、`contest close-intake`、`contest close` | `--no-register`または`--self-serve`を伴わない`contest prepare`、`node serve`、`node list`、`node approve`、`node deny`、オンラインの`node run-method`、`node relay`、および結果が保留されている場合の`contest close` |

サービスキーはデータベースを運用する者に属します。外部の主催者は、自身のデータベース（`MT_EVAL_SUPABASE_URL`とそのキー）に対してこれらを実行するか、オフラインレーンにとどまります（この場合、スコアは署名済みマニフェストから検証可能ですが、公開ボードには登録されません）。**注意。** `MT_EVAL_ALLOW_PROD`は決して設定しないでください。これを設定すると、デフォルトの本番データベースへの書き込み拒否が解除されますが、それはエージェントが判断すべきことではありません。

## プロジェクトへの参加

**登録済みプロジェクト**とは、文、単語リスト、メソッドなどのファイルを提供して他の人が協力できるように、オーナーが一覧掲載した言語プロジェクトです（レビューの時間や計算資源の提供はまだ行われていません）。以下の `mt-eval project` コマンドはプロジェクトデータベース（`MT_EVAL_SUPABASE_URL`）と通信します。`list`（匿名）と`review`（運用者用）を除くすべてのサブコマンドはサインインを行います（キャッシュされたセッション、`MT_EVAL_REFRESH_TOKEN`、またはインタラクティブなGitHub/Googleサインイン）。アカウントはサインインのメールアドレスになります。

**ルール。**

- **一覧掲載前のレビュー。** 新規プロジェクトは`pending_review`として開始され、レビュー後にのみ一覧掲載されます。オーナーはプロジェクトをクローズすることはできますが、直接一覧掲載することはできません。
- **オーナーの名前は自由に設定可能**（`--owner-name`）。プロジェクトの行にメールアドレスは保持されません。オーナーのアカウント情報は切り離され、本人のみが閲覧できます。
- **一覧掲載にメールアドレスは含まれません。** `project list`は匿名で名前と件数を表示します。`project offers`は協力者が指定した名前（`--as`）を表示します。オーナーのアカウントは提供記録内の協力者のアカウントメールアドレスを引き続き閲覧でき、同意書（consent note）には両方のアカウントが記録されます。
- **提供は双方が保持します。** 承諾すると、提出者と承認者を明記した同意書が書き込まれます。
- **ファイルの内容は出力されません。** 名前、件数、状態のみが出力されます。

### オーナー

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register`は`champollion.project.json`から言語ペア（および`--purpose`でない限り目的）を読み取ります。オプションとして`--slug`、`--domain`、`--register`、`--about`があります。アカウントごとに24時間あたり最大5件の登録が可能です。
- `ask` `--kind`は`sentences`、`word-list`、または`method`です。募集（ask）はプロジェクトが一覧掲載されている間のみ表示されます。
- `accept`はファイルをダウンロードし、**sha256を検証し**（不一致の場合は拒否）、`inbox/offer-<offer id>-<file name>`および`consent/offer-<offer id>.json`（`offer_id`、`file`、`sha256`、`submitted_by`、`authorized_by`、`terms`、`note`、`held_by`）を書き込み、提供を承諾済みに更新します。その後、ファイルは通常のものと同様に取り込まれ（`champollion data add inbox/<file>`）、保持者の条件が尋ねられます。
- **注意。** 協力者の`--terms`は同意書に記載されています。`champollion data mark`で記録する回答は、それらを緩和するものであってはなりません。

### 協力者

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer`は、一覧掲載されているプロジェクトにのみ、最大50MBの空でないファイルを1つ、そのsha256とともにプロジェクトのプライベートストレージにアップロードします。協力者1人あたり24時間で最大24件の提供が可能です。
- 提供の状態遷移は1度だけです：`offered` → `accepted`、`declined`、または`withdrawn`。
- **注意。** 取り下げまたは辞退は提供の状態を変更しますが、アップロードされたファイルをストレージから削除するわけではありません。協力者が取り戻したくなる可能性のあるファイルを提供する前に、その旨を伝えてください。
- **ロック。** `offer`はアップロードを行う前にファイルのサイドカーを読み取ります。`local-only`ファイル、`sealed`セット、および`speakers_agreed`が`not-yet`または`some-said-no`であるファイルは拒否されます。サイドカーが読み取れない場合、提供は中止されます。オーバーライドは存在せず、マークの変更権限は保持者にあります。提供の条件に`training: not-allowed`の条件が追加されるため、オーナーはそれを見ることができます。
- **注意。** 提供を行うと、ファイルは協力者のコンピューターからプロジェクトデータベースのストレージへと送信されます。必ず協力者に確認を取り、協力者に代わってファイルを提供しないでください。

`mt-eval project review`はデータベース運用者用のコマンドです（サービスキーを使用します）。エージェント向けのコマンドではありません。

## さらに詳しく

- [封印テストのホスト](/docs/host-a-sealed-test)および[プロジェクトへの参加](/docs/join-a-project) — 一般向けバージョン。
- [主権型コンテストの実施](/docs/network/sovereignty/run-a-sovereign-contest)および[主権型評価ノード](/docs/network/sovereignty/sovereign-eval-node)。
- [所有権の移転](/docs/network/sovereignty/ownership-transfer)および[利用規約テンプレート](/docs/network/sovereignty/terms-templates)。
- [データと転送のルール](/docs/agents/data-rules) — 封印セットとローカル専用ファイル。
- [`mt-eval`リファレンス](/docs/reference/mt-eval)。
