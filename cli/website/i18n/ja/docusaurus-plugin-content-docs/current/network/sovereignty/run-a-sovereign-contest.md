---
sidebar_position: 9
title: "自律的なコンテストを開催する"
slug: /network/sovereignty/run-a-sovereign-contest
description: "コミュニティや組織が、自分たちで保有する非公開のコーパスを使って機械翻訳コンテストを運営するための、セルフサービス型のエンドツーエンドの手順です。Champollion がデータや賞金を管理することは一切ありません。"
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# 主権コンテストを開催する

> **エグゼクティブサマリー。** コミュニティや組織は、**自組織のインフラから外に出ることのない**非公開テストコーパスを対象に、スポンサー賞金付きの評価コンテストを開催できます。コーパスの構築、暗号化、ホスティング、鍵の管理はすべてあなたが行います。ネットワークに登録されるのは、内容を含まないメタデータカードと暗号文のダイジェストのみです。手法はまず公開コーパスで資格審査を通過する必要があり、封印済みセットへの評価実行はすべてカストディアンの承認を必要とします。外部に出るのは**スコアのみ**です。賞金は**スポンサーが保管**します — あなたの組織または指定する信託機関が管理し、**Champollion は資金にもデータにも一切関与しません。** このページは、エンドツーエンドのセルフサービス運用手順書です。

:::warning[現在利用可能な機能と開発中の機能]
始める前に、現実を正確に把握してください — これは進化中の非商用研究プロジェクトです。私たちを盲目的に信頼するより、ご自身で確認されることをお勧めします：

- ✅ **稼働中:** コーパスの登録（メタデータカード、ハッシュピン留め、公開レーン）、封印セットのレジストリ（ダイジェスト + 管理者グループ + 予選用データ、コンテンツなし）、封印レーンを備えたコンテストの仕組み、承認リクエスト/付与/監査データレイヤー（保留中 → M-of-Nの決定 → 1回限りの期限付き付与、追記専用のハッシュチェーン監査ログ）、およびデータベースレイヤーで強制されるスコアのみの出力。
- ✅ **稼働中: 主催者のスコアリングノード + 仮説レーン。** 1つのコマンドで、コーパスを公開開発セット（予選用データ）、ブラインドテストセット（ソースは公開、参照データはあなたのマシン上で保存時に封印）、およびオプションで完全な秘密セット（`mt-eval contest prepare`）に分割します。封印されたセット、予選用データ、およびコンテストの登録は、**あなた自身のサインインからのセルフサービス**です（`contest prepare --self-serve`、または事前に準備したコンテストの場合は `mt-eval contest register --manifest`）。すべての行はデータベースレイヤーでIDにバインドされており、キュレーターの介入や特権キーはありません（正直な制限事項についてはステップ4を参照してください）。参加者は `mt-eval contest submit-hypotheses` を使用して翻訳を提出します（CLIはローカルで開発セットを自己採点し、しきい値を下回るアップロードを拒否します）。あなたのセルフホストノード（`mt-eval node serve`）は、開発セットの証拠を再採点し、予選用データでゲートを設け、コンテストのモデル（`per-submission` — 管理者が各スコアリングを承認 — または `blanket` / `open`）に従って承認し、あなたのマシンから決して出ることのない参照データに対してブラインドセットを採点し、**集計のみ**の実行カードを公開します。このレーンが証明**しない**こと：指定された手法が仮説を生成したこと（手法のIDは参加者が主張するものであり、すべての実行カードにそのようにラベル付けされます）。また、決意を持った攻撃者が多くの異なる提出物から参照シグナルを抽出するのを防ぐことはできません。レート制限、バイト単位で同一の重複排除、および監査チェーンによってそれを遅らせることはできますが、真の解決策は以下の手法実行レーンです。
- ✅ **稼働中: 2つの秘密セット手法レーン。** 公開された仮説レーンの記録を持つ参加者は、あなたの秘密セットに対して自らの手法を提案できます。ノードは提出物からレーンを選択します：
  - **レーンA — 宣言型モデル（推奨）。** 標準的なニューラルモデルはデータです：`mt-eval contest submit-model` は、safetensorsの重み + 宣言型トークナイザー + 設定を送信します — **コードなし、Dockerfileなし。** あなたのノードは、それがコードを含まないこと（pickleではなくsafetensorsであること、`trust_remote_code`/`auto_map` がないこと、データのみのファイルであること）を検証し、自身の信頼できるエンジン（`transformers`、`trust_remote_code=False`、オフライン）で重みを実行します。アーキテクチャはデフォルトで寛容です（あなたのエンジンがネイティブにロードできるものなら何でも可）。慎重なホストは許可リストを固定できます。信頼できないものは何も実行されないため、サンドボックス化するものはありません。公開される `declarative-model` では、手法のIDは**構造上コードフリー**となります。
  - **レーンB — 実行可能バンドル（サンドボックスのフォールバック）。** コードである手法の場合：`mt-eval contest submit-method` はDockerfile + エントリポイントを送信します。管理者が承認した後、あなたのノードはネットワークから隔離されたコンテナ（`--network=none` — 内部にネットワークスタックは存在せず、読み取り専用のルート、ドロップされたケーパビリティ、サニタイズされた環境）内でそれを実行します。最初に自動化された静的チェックが行われ、参照データがコンテナに入ることは決してありません。公開される `method-execution` では、IDは**実行検証済み**となります。
  どちらのレーンでも：バンドルのハッシュは承認リクエストに固定され（実行されるものは証明可能に提案されたものです）、スコアは同じ集計のみのパスを通じて公開されます。最大限の隔離のために、スコアリングマシンを完全なエアギャップにすることができます：承認されたリクエストとEd25519で署名されたスコアのみのバンドルは、リムーバブルメディア（`mt-eval node relay` / `import-bundle` / `export-scores`）を介して交差します — 秘密のテキストは接続されたマシンにさえ到達しません。これらのレーンにまだ含まれて**いない**もの：ノードのハードウェア構成証明（IDは自己申告）、正式な紛争処理メカニズム、および — 特にレーンBについて — 削除されたネットワークスタックを超えるコンテナのより深い堅牢化（seccompプロファイル、microVM。これがレーンAを推奨する理由です）。[正直な制限事項](/docs/network/honest-limitations)を参照してください。
- 🔲 **開発中: しきい値署名。** M-of-Nの管理者承認は、現在、承認および監査テーブルに*記録*されています。M個のシェアなしでは付与を生成できないようにする暗号化しきい値キーツールはまだ構築されていません — 現在の封印キーはラベル付けされた単一キーペアの代用品（`champollion seal-corpus keygen`）であり、エアギャップのスコアバンドル署名は単一のノードキー（`seal-corpus sign-keygen`）であり、スチュワードセレモニーではありません。
- ❌ **設計上存在しないもの:** Champollionがあなたのコーパスをホストすること、あなたのキーを保持すること、または賞金を保持すること。参加者の仮説（彼ら自身の翻訳）は私たちのストレージを通過しますが、あなたのコーパスのコンテンツが通過することは決してありません。

以下のステップが 🔲 リストの項目に依存する場合、そのステップに明記されています。
:::

---

## 取り決めの概要

| 誰が | 保持するもの | 保持しないもの |
|-----|-------|-------------|
| **あなた（コミュニティ／組織）** | コーパス、暗号化鍵（カストディアン経由）、賞金、授賞の決定 | — |
| **Champollion ／ネットワーク** | メタデータカード、暗号文ダイジェスト、承認・監査レコード、公開スコア | あなたのコーパスの内容、鍵、資金 |
| **手法開発者** | 自分の手法 | あなたのテストデータ — 彼らが見るのはスコアのみで、文章は見えません |

以下はすべて、この表を機械的に展開したものです。

---

## 主催者の前提条件

ステップ1の前に、ノード側の実行に実際に何が必要かを把握してください：

- **docker または podman** — メソッド実行レーンに必要です。ノードはまず docker を、次に podman を自動検出します。どちらも存在しない場合は、明確なエラーメッセージを出して起動を拒否します。**フォールバックはありません** — `--network=none` によるコンテナ分離は根幹となる保証であり、コンテナランタイムなしでは何も実行されません。
- **Node.js 20.11+ および `champollion` npm CLI** — ハーネスはシーリング暗号を再実装しません。`champollion seal-corpus`（動詞：`keygen`、`seal`、`open`、`sign-keygen`、`sign`、`verify`）が唯一の暗号実装（X25519-ECDH → HKDF-SHA256 → AES-256-GCM）であり、主催者ノードはこれをシェルアウトして呼び出します。
- **`~/.mt-eval/node.json` のノード設定ファイル。** すべての `mt-eval node` コマンドは、設定ファイルがなければ起動を拒否します — いずれかのコマンドを一度実行すると、エラーメッセージに設定ファイルのパスとテンプレートの場所が示されます（テンプレートはハーネスのソース内、`mt_eval_harness/contest_node.py` に同梱されています）。設定ファイルには、自己申告の `node_id`（すべてのリクエストフィンガープリントに組み込まれます）と、開発用リファレンスおよびシールド済みアーティファクトを指す `contests` マップが含まれます。
- **サインイン。** アカウント作成の手順は別途ありません：ID が必要な最初のコマンド（例：`mt-eval contest prepare --self-serve` または `mt-eval publish`）が、**GitHub または Google**（Supabase Auth）経由のブラウザ OAuth サインインを開きます。そのアカウントのメールアドレスが、すべてのレジストリ行に紐付けられる ID となります — 組織が管理するものを使用してください。
- **インテークスロットル。** 参加者の提出はサブミッター単位でレート制限されており、**デフォルトは24時間あたり5件**です（プロービング防止のため。準備時に `--intake-daily-limit` で、またはシェアードタスクエディションのデフォルトとしてコンテストごとに設定可能）。コンテストのスケジュールはこれを考慮して計画してください。

**セルフサービス登録に関する正直な注意点。** **デフォルトのネットワークホスト型エンドポイント**では、セルフサービス登録（`contest prepare --self-serve` / `contest register`）は現在、本番エンドポイントのガードで停止します：CLI は本番プロジェクトへの書き込みを行わず、明示的なメッセージとともに拒否します。これはそのドアを開くかどうかのポリシー決定が保留中のためです。フェデレーテッドホスト（独自の Supabase プロジェクト）は影響を受けません。デフォルトホストでガードに当たった場合、それは現在の状態であり、設定ミスではありません — [Issue を開いてください](https://github.com/gamedaysuits)。登録手続きをサポートします。

---

## ステップ 1 — 非公開テストコーパスを構築する

測定に使用するコーパスを設計し、最初から非公開に保ちます。コーパスの内容は、これまでに公開、投稿、またはモデルプロバイダーと共有されたことがないものにしてください。

- エントリ構造、難易度ティア、レジスターカバレッジについては [Corpus Design Framework](/docs/network/specifications/corpus-design) を、ツールについては [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) を参照してください。
- 封印前に流暢な話者によるエントリの確認を行ってください — [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) は、手法レビューだけでなくコーパス QA にも再利用できるレビュー構造を説明しています。
- コーパスの**バージョン**ラベルを今決めてください（例: `v1`）。承認付与は特定のバージョンにバインドされるため、バージョン管理は単なる記録管理ではなくセキュリティモデルの一部です。

## ステップ 2 — 暗号化して YOUR インフラにホストする

コーパスを保存時に暗号化し（任意の現代的な AEAD スキーム — 例: `age`/x25519 または AES-256-GCM）、**暗号文**をあなたが管理する場所にホストします。Champollion は平文も暗号文も受け取りません。

公開するのは 1 つのアーティファクトのみです: **暗号文 blob の SHA-256 ダイジェスト**。

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

ダイジェストは公開されますが、データは公開されません。誰でも後から、評価に使用された blob が封印した blob とバイト単位で同一であることを検証できます — 所有なしの完全性保証です。これは[通常のコーパス登録](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content)と同じ「コピーではなくハッシュ」の規律です。

## ステップ 3 — メタデータカードを登録する

標準のフェイルプライベート[登録レーン](/docs/network/sovereignty/registering-corpora)を通じてコーパスを登録します: `language_pair`、`license`、`attribution`、`do_not_train` を含むカードを作成します — **文章は含みません**。**private** 公開レーンを選択してください。次のステップの封印済みセット登録によって、コンテスト対象として有効になります。

## ステップ 4 — 封印済みセットとして登録する

封印済みセットとは、3 つの事項を公的記録に残す、内容を含まないレジストリエントリです:

| フィールド | コミットする内容 |
|-------|------------------------|
| `ciphertext_digest` | 「コーパス」として扱われる正確なバイト列 |
| `custodian_group_id` | アクセスを管理するグループの不透明な ID（同意なしに組織名や国名を公開しない） |
| `current_qualifier_id` | 封印済み実行を提案する前に手法がクリアしなければならない公開ラウンド |

登録は**自分のサインインからセルフサービスで行えます** — キュレーターの介在も特権鍵も不要です:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

マニフェストはあなたのマシンに残ります — 登録時に送信されるのは、内容を含まない ID、ダイジェスト、閾値のみです。すべてのレジストリ行は**アイデンティティにバインド**されています: データベースは登録したサインイン済みアカウントを記録し、そのバインディングを後の編集から保護します。また、資格審査用セットがゲートできる封印済みセットは、**同じ**アイデンティティが登録したものに限られます。封印済みセットは隔離状態で生成されます（通常のコンテストを支援したり、公開リーダーボードにランクされたりすることは決してできません）。資格審査用セットは安全な状態で生成され、登録はレート制限されます — これらはすべて、私たちのクライアントを含むすべてのクライアントの下にあるデータベーストリガーによって強制されます。レジストリ自体は公開読み取り可能なので、あなたのエントリが封印した内容を正確に示していること — そしてそれ以上のものが含まれていないこと — を確認できます。

**正直な制限。** セルフサービスの扉は登録のみです（データベースレイヤーでの挿入専用）。**資格審査用セットのローテーションと封印済みセットの廃止はキュレーター経由で行います** — [GitHub](https://github.com/gamedaysuits) でイシューを開くかプロジェクトに連絡してください。また、後のステップでオーガナイザースコアリングノードを実行すること（ライフサイクルの進行、承認付与、監査操作）は、あなた自身のノード上の別のサービス認証レーンです — セルフサービスは公的記録の範囲で終わります。

## ステップ 5 — カストディアンと M-of-N ルールを選択する

あなたのコーパスへのすべての評価を共同で承認しなければならない人物または機関、および閾値（例: **5 人中 3 人**）を選択します。カストディアンは Champollion ではなくあなたのコミュニティに対して責任を負うべきです — コミュニティごとの条件の設定方法については [Data Stewardship](/docs/network/sovereignty/data-sovereignty) および [Ownership & Terms](/docs/network/sovereignty/ownership-transfer) を参照してください。

**正直な告白:** 閾値*暗号*ツール（M 個の署名なしでは付与を文字通り生成できないような鍵シェア）は**開発中**です。現在、M-of-N ルールは記録されたプロセスとして強制されています: すべてのアクセスリクエストは **pending** キューに入り、カストディアンの決定が記録され、付与は承認済みリクエストに対してのみ生成されます。各付与は**単回使用、時間制限付き、1 つの特定の（手法、コーパスバージョン、評価ノード）フィンガープリントにバインド**されており、ブロックされた試みを含むすべてのイベントは**追記専用、ハッシュチェーン、公開読み取り可能な監査ログ**に記録されます。データベースはすべてのクライアントと鍵の下で不正な状態遷移を拒否します。現時点でまだ拒否できないのは、プラットフォームオペレーター自体の侵害です — それが閾値署名が解決するものであり、それが実装されるまでは「Champollion は鍵シェアをゼロ保持する」を、今日検証できる特性としてではなく、構築中の設計目標として扱ってください。

## ステップ 6 — 賞金を設定する

コンテストとともに決定し、公開します:

- **金額と通貨。**
- **スポンサー** — 資金を提供する主体。
- **資金の保管場所** — あなたの組織の口座、または指定するコミュニティ信託機関。**Champollion は賞金の保管、エスクロー、送金を一切行いません。** 保管者のアイデンティティを事前に公開することが賞金の信頼性を担保します。[terms templates](/docs/network/sovereignty/terms-templates#trojan-horse-risks) のスポンサーデフォルトリスクに関する注記を参照してください。
- **閾値条件** — 手法がクリアしなければならないスコアの基準。[Prize Specification](/docs/network/specifications/prizes) に従って記述します: メトリクス閾値、話者検証要件、再現性。公開スコアから授賞条件を検証可能にしてください。基準がクリアされたかどうかについて、誰もあなた（または私たち）の言葉を信じる必要がないようにします。

## ステップ 7 — コンテストを作成する

封印済みセットを対象とするコンテストは、明示的な**封印レーン**を使用します。資格審査はフェイルクローズドです: 封印済みセットの登録が存在してアクティブでない限り、コンテストは拒否されます — また、コンテストを作成しても**誰にも**コーパスへのアクセスは付与されません。

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*（`--corpus` の値は登録済みの `sealed_set_id` です。封印レーンは封印済みセット登録から**自動的に**選択されます — 追加フラグは不要です。封印済みセットは通常のコンテストを支援することは決してできず、通常の隔離済みデータセットはいかなるコンテストも支援できません。両方のルールはデータベースで、すべてのクライアントの下で強制されます。ステップ 4 で `contest register` または `prepare --self-serve` を使用して登録した場合、コンテスト行は**すでに存在します** — このステップをスキップしてください。`contest create` を手動で実行するのは、既に登録済みの封印済みセットからコンテストを組み立てる場合のみです。）*

## ステップ 8 — 手法はまず公開環境で資格審査を通過する

開発者は、あなたの言語ペアの**公開**コーパスで手法を構築・採点します — 通常の [submit-a-method](/docs/network/getting-started/submit-a-method) パスです。あなたの封印済みセットの `current_qualifier_id` は、封印済み実行をリクエストする前に手法がクリアしなければならない公開ラウンドを指定します。これにより、コーパスへの探索的な圧力を排除します: 公開環境で実際のパフォーマンスを示すまで、誰も封印済みセットを狙うことはできません。

:::note[参加者の方へ：コンテストはどのエンドポイントにありますか？]
**ネットワークホスト型**のコンテストはセットアップ不要です — ハーネスに同梱されているデフォルトエンドポイントにコンテストの仕組み（仮説インテーク、予選ゲート、メソッド提案）が含まれており、`mt-eval contest submit-hypotheses` / `submit-method` はそのまま動作します。

**フェデレーテッド型**コンテスト — オーガナイザーが自身の Supabase プロジェクト上で機構を運用するため、提出物が私たちのストレージを経由しない — は、コンテスト資料とともにエンドポイントを公開します。提出前にエクスポートしてください:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

ハーネスがコンテスト機構を持たないエンドポイント（例: マイグレーションが不足しているフェデレーテッドホスト）を指している場合、コマンドは *「このSupabaseエンドポイントではコンテストレーンがまだ利用できません」* というメッセージとともに停止し、どのエンドポイントと通信していたかを表示します。（フェデレーテッドオーガナイザーの方へ: コーパスリリースの隣にこれら2つの値を公開してください。`--node-id` および `--corpus-version`。）
:::

## ステップ 9 — 封印済み実行: リクエスト、承認、実行、スコア出力

資格審査を通過した各手法について:

1. あなたの封印済みセットに対して**リクエスト**が提出されます — `pending` に入り、（手法 tarball ハッシュ、コーパス ID、コーパスバージョン、`scores-only`、評価ノード測定値）の不変フィンガープリントを持ちます。
2. あなたの**カストディアンが決定します**（M-of-N）。承認により**付与**が生成されます: 単回使用、有効期限付き、その正確なフィンガープリントに対してのみ有効。
3. 評価は**あなたの**ノード上のネットワーク分離サンドボックスで実行されます（`mt-eval node run-method`）: 自動静的チェック、ネットワークスタックのないコンテナ、コンテナ外に保持される参照 — または最大限の分離のために、署名済みスコアのみバンドルをリムーバブルメディアで受け渡す真のエアギャップマシン上で実行します（カバーされているものとされていないものについては上記のステータスボックスを参照）。
4. **スコアのみが出力されます。** `scores-only` 出力ルールはデータベースレイヤーで固定されています。あなたのコーパスのエントリごとのテキストは公開されません。
5. すべてのステップ — リクエスト、投票、付与、使用、およびブロックされた試み — は公開のハッシュチェーン監査ログに追記され、あなた（および誰でも）が再現できます。

## Submitting a method (for participants) — two lanes
## 手法の提出（参加者向け） — 2つのレーン

Most NMT entries are not exotic: a standard fine-tuned transformer and its
weights. For those, there is a **preferred, code-free lane** — and a sandbox
fallback for methods that genuinely are code.

ほとんどのNMT（ニューラル機械翻訳）のエントリーは特殊なものではありません。標準的なファインチューニングされたTransformerとその重みです。それらのために、**推奨されるコードフリーのレーン**があります。また、純粋にコードである手法のためのサンドボックスのフォールバックもあります。

### Lane A — declarative model (preferred for standard NMT)
### レーンA — 宣言型モデル（標準的なNMTに推奨）

If your method is a standard neural model, you submit it as **data** — the
weights, tokenizer, and config — and the organizer runs it in their own trusted
inference engine. **No Dockerfile, no code, no sandbox.** Because nothing you
submit executes, the organizer's safety check is a decidable format validation
instead of trying to prove arbitrary code is safe — a strictly stronger
guarantee for you and for the corpus.

あなたの手法が標準的なニューラルモデルである場合、それを**データ**（重み、トークナイザー、設定）として提出し、主催者は自身の信頼できる推論エンジンでそれを実行します。**Dockerfileなし、コードなし、サンドボックスなし。** 提出したものは何も実行されないため、主催者の安全性チェックは、任意のコードが安全であることを証明しようとするのではなく、決定可能なフォーマット検証となります。これは、あなたとコーパスにとって厳密により強力な保証です。

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

The rules your bundle must satisfy (validated locally before upload, and again
by the organizer's node):

バンドルが満たさなければならないルール（アップロード前にローカルで検証され、主催者のノードで再度検証されます）：

- **Weights are `safetensors`, never pickle.** A PyTorch `.bin`/`.pt`/`.ckpt`
  is a pickle — arbitrary code on load — and is refused. Export to
  `model.safetensors` (`safetensors` / `transformers` do this natively).
- **An architecture the organizer's engine loads natively.** `config.json`'s
  `architectures` can be any architecture the host's `transformers` implements
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, and many more) — hosts are
  **permissive by default**, because with `trust_remote_code=False` the safety
  comes from the code-free format, not the architecture name (an unsupported
  architecture simply fails to load, running nothing). A careful host may
  publish an allowlist. No `auto_map`, no `trust_remote_code` — those smuggle
  custom code back in and are always refused.
- **A declarative tokenizer** (`tokenizer.json` or a `sentencepiece` `.model` +
  vocab), and **data files only** — no `.py`/scripts/binaries in the bundle.

- **重みは `safetensors` であり、決してpickleではありません。** PyTorchの `.bin`/`.pt`/`.ckpt` はpickle（ロード時の任意のコード）であり、拒否されます。`model.safetensors` にエクスポートしてください（`safetensors` / `transformers` はこれをネイティブに行います）。
- **主催者のエンジンがネイティブにロードするアーキテクチャ。** `config.json` の `architectures` は、ホストの `transformers` が実装する任意のアーキテクチャ（Marian、NLLB/M2M100、mBART、T5、Pegasusなど多数）にすることができます。ホストは**デフォルトで寛容**です。なぜなら、`trust_remote_code=False` では、安全性はアーキテクチャ名ではなくコードフリーのフォーマットから得られるからです（サポートされていないアーキテクチャは単にロードに失敗し、何も実行されません）。慎重なホストは許可リストを公開する場合があります。`auto_map` や `trust_remote_code` は不可です。これらはカスタムコードを密かに持ち込むため、常に拒否されます。
- **宣言型トークナイザー**（`tokenizer.json` または `sentencepiece` `.model` + vocab）、および**データファイルのみ** — バンドル内に `.py`/スクリプト/バイナリを含めることはできません。

The organizer runs it with `trust_remote_code=False`, offline, and only scores
leave — published as `declarative-model`, method identity **code-free by
construction**. (Multi-GB weights: use `--bundle-out` for the sneakernet lane,
same as below.)

主催者はそれを `trust_remote_code=False` を使用してオフラインで実行し、スコアのみが出力されます。これは `declarative-model` として公開され、手法のIDは**構造上コードフリー**となります。（数GBの重みの場合：以下と同様に、スニーカーネットレーンには `--bundle-out` を使用してください。）

### Lane B — runnable bundle (the sandbox, for code methods)
### レーンB — 実行可能バンドル（コード手法のためのサンドボックス）

If your method is genuinely code — a pipeline, an LLM-coached hybrid, a custom
decoder — it can't be run declaratively, so it goes through the network-isolated
sandbox instead. This is the honestly-weaker lane (it contains untrusted code
rather than refusing to run it), so use Lane A whenever your method is a
standard model.

あなたの手法が純粋にコードである場合（パイプライン、LLMが指導するハイブリッド、カスタムデコーダーなど）、宣言的に実行することはできないため、代わりにネットワークから隔離されたサンドボックスを通過します。これは正直なところ弱いレーンです（信頼できないコードの実行を拒否するのではなく、それを含んでいるため）。したがって、手法が標準的なモデルである場合は、常にレーンAを使用してください。

**実行可能バンドルの契約は stdin/stdout です。** バンドルはエントリーポイントを宣言します（例：`method/translate.py`）。コンテナ内で、主催者のノードは次のコマンドを正確に実行します：

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

ソース文は1行につき1文が stdin に届きます。stdout には1行につき1つの翻訳を書き出してください。`--method-dir` として渡したものはすべてバンドル内の `method/` にパックされ、実行時に **`/method` に読み取り専用でマウント**されます — ウェイトも含め、イメージへのコピーは不要です。コンテナはネットワークスタックなし（`--network=none`）、読み取り専用ルート、書き込み可能な `/tmp` で動作します。

**最小限の Hugging Face transformers ラッパー：**

```python title="method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Dockerfile はネットワークなしでビルドできなければなりません。** 主催者は `--network=none` を使用してイメージをビルドします — エアギャップビルドテスト*がそのまま*ビルドとなります — そのため、すべての依存関係は**バンドルにベンダリング**する必要があります（PyPI にアクセスする `pip install` はビルドに失敗し、プリフライト静的スキャンが送信前にネットワーク呼び出しを検出します）。メソッドディレクトリ内に wheel ファイルを同梱し、そこからインストールしてください：

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

次のコマンドで提出します：

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

（まずコンテストの仮説レーンレコードが公開されている必要があります — ステップ9のT1ゲート — また `--agree` はメソッド提出の利用規約に同意することを意味します。）

**数GB以上のウェイト：スニーカーネットレーンを使用してください。** ホスト型インテークパスはタールボールをコンテストホストのストレージへの**単一の POST** としてアップロードするため、そのホストのストレージアップロード制限に縛られます — コードや小さなモデルには問題ありませんが、数GB以上のチェックポイントには向きません。バンドル契約自体はより大きなアーティファクト（タールボール最大100GB、ビルド済みイメージ最大150GB）に対応しています。大きなウェイトの場合は、ホスト型アップロードをスキップしてください：

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

交換ディレクトリはリムーバブルメディア（または双方が信頼するチャネル）で主催者に届けられます。主催者は `mt-eval node import-bundle` でそれを取り込みます。バンドルの SHA-256 はいずれの方法でも認可リクエストに固定されるため、実行されるものは提案したものと証明可能な形で一致します。

**主催者の方へ：エアギャップマシンにベースイメージをプリロードしてください。** イメージビルドは `--network=none` で実行されるため、Dockerfile の `FROM` ベースイメージはマシンのローカルイメージストアに既に存在している必要があります。接続済みのマシンでは `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim` を実行し、`base.tar` をバンドルと一緒に持ち込んでください。エアギャップマシンでは、`mt-eval node run-method` を実行する前に `docker load -i base.tar` を実行してください。使用するベースイメージについては、公開するコンテスト資料で参加者と事前に合意してください。

## ステップ 10 — スコアを公開し、公開した閾値に従って授賞する

スコアのみの結果は、封印済みセット評価としてマークされ、他の実行と同様に[リーダーボード](/docs/network/leaderboard/rules)に公開されます。ステップ 6 で公開した閾値条件を手法がクリアした場合 — 自動化されたものではなくあなたのコミュニティのゲートである[話者検証](/docs/network/specifications/speaker-validation)を含む — **あなた**（またはあなたの信託機関）があなた自身の公開条件に従って賞金を授与します。Champollion の役割は測定で終わります。

---

## あなたが永続的に保持するもの

- **コーパス。** あなたのインフラから外に出ることはありませんでした。暗号文をオフラインにすれば、封印済みセットは単純に実行不可能になります。
- **鍵。** あなたのカストディアンが付与を停止すればアクセスは消滅します。
- **資金。** 他の場所にあったことは一度もありません。
- **記録。** 監査ログのヘッドダイジェストは公開可能なので、誰があなたのコーパスに対して何を実行したかの履歴は、誰によっても — 私たちを含めて — 密かに書き換えることはできません。

適用可能な条件の文言 — 所有権、スコアのみのライセンス、コンテストへの攻撃方法の明示的な解説 — については、[Terms Templates](/docs/network/sovereignty/terms-templates) を参照してください。
