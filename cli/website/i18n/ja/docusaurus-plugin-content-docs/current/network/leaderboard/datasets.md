---
sidebar_position: 3
title: "評価データセット"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# 評価データセット

> **概要** 本ページでは、ベンチマークに利用可能な評価データセットについて説明します。これには、コーパスエントリのスキーマ、難易度（1〜5）、および出所の要件が含まれます。カタログには、**19のコーパスファミリーにわたる約4,700のソース取得型（fetch-from-source）評価データセット**（TICO-19、IN22、Tatoeba、GlobalVoices、SMOL、ALT、Turkic-x-WMT、WMT24++、WMT newstest/Generalブラインドセット2014–2025、MAFAND-MT、NusaX、NusaTranslation、LoResMT、AmericasNLP 2021、NICT-SAP、BSD、MENYO-20k、Gamayun、EdTeKLA）とFLORES+が含まれています。コーパスの*コンテンツ*がここにホストされることはありません。各データセットはSHAで固定されたメタデータカードであり、固定されたアップストリームのアーカイブから決定論的に再構築されます。**非営利 / 研究専用レーン**（Gamayun、EdTeKLA、MAFAND-MT、NusaTranslation、LoResMT、AmericasNLP、NICT-SAP、BSD、MENYO-20k、およびWMT研究用セット）は、商用 / 賞（prize） / APIパスから除外されます。その中で、改変されたライセンス、独自のライセンス、または明記されていないライセンスに基づくコーパスは、さらに**同意による制限（consent-gated）**の対象となります。ライセンステキスト自体が評価目的での使用を許可している場合（WMT研究用セットのように、データセットごとの明示的な決定として記録されている場合）、または権利者の許可がデータセットエントリに記録されている場合を除き、リモートのモデルAPIによる評価は拒否されます。人間によってキュレーションされた2つのリファレンスデータセット（EDTeKLA Dev v1（平原クリー語）およびFLORES+ Devtest（カタログ化された870の言語ペア、各1,012文））については、以下で詳しく説明します。EdTeKLAの完全なエントリ数の内訳は、[該当セクション](#edtekla-development-set-v1)に一度だけ記載されています。

データセットは、ハーネスが実行する固定のターゲットです。各データセットは、ソース→ターゲットのペアとゴールドスタンダード参照を含むJSONファイルです。ハーネスはモデルの出力をこれらの参照と照合してスコアを算出します。参照を変更することはありません。

:::danger[評価データでのトレーニングは禁止]

⚠️ **これらのデータセットは評価専用です。** 評価データを使ってトレーニング、ファインチューニング、フューショットプロンプト、またはその他の方法で学習させたメソッドは、スコアが人為的に高くなり、**リーダーボードから失格となります。**

トレーニングには別のコーパスを使用してください。評価セットは、開発中にモデルが参照しない状態を保つ必要があります。
:::

---

## データセットの形式 {#dataset-format}

すべてのデータセットは同じJSONスキーマに従います。

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[標準スキーマ]
[ベンチマーク仕様](/docs/network/specifications/benchmark)では、標準のコーパスおよびエントリスキーマを定義しています。このページでは、利用可能なデータセットと新しいデータセットの作成方法について説明します。
:::

### トップレベル `dataset` ブロック

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | `string` | データセットの一意な識別子（ランカードおよびリーダーボードで使用） |
| `version` | `string` | セマンティックバージョン。インクリメントすると以前のランカードとの比較が無効になります |
| `language_pair` | `string` | 表示ラベル（例：`EN→CRK`） |
| `description` | `string` | 任意。人が読める概要 |
| `source_language` | `string` | BCP 47 ソース言語コード |
| `target_language` | `string` | BCP 47 ターゲット言語コード |
| `created` | `string` | ISO 8601 作成日 |
| `license` | `string` | SPDX ライセンス識別子 |
| `provenance` | `string[]` | エントリ全体で使用される出典タグのリスト |

### エントリフィールド

| フィールド | 型 | 必須 | 説明 |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | コーパス内でのエントリの一意な識別子 |
| `source` | `string` | ✅ | 翻訳するソーステキスト |
| `reference` | `string` | ✅ | ゴールドスタンダードの参照翻訳 |
| `difficulty` | `integer` | ✅ | 難易度ティア 1〜5（下記参照） |
| `provenance` | `string` | ✅ | このエントリの出典（例：`gold_standard`、`textbook`、`elicited`） |
| `register` | `string` | ✅ | レジスター／丁寧さのレベル（例：`conversational`、`formal`、`ceremonial`） |
| `context` | `string` | ✅ | コミュニケーション機能（例：`greeting`、`declaration`、`instruction`） |
| `notes` | `string` | ❌ | 人間のレビュアー向けの任意のコンテキスト |
| `morphological_analysis` | `string` | ❌ | ゴールドスタンダードの形態論的分析 |
| `variant_class` | `string` | ❌ | 許容される翻訳バリアントをグループ化するクラスラベル |

---

## 利用可能なデータセット

カタログには、**19のコーパスファミリーにわたる約4,700のソース取得型評価データセット**に加え、以下で詳述する人間によってキュレーションされた2つのリファレンスデータセット（EDTeKLA + FLORES）が含まれており、2026年7月12日時点でのレジストリの合計は**5,602データセット**です。すべてのコーパスは**SHAで固定されたメタデータカード**です。コーパスのコンテンツがここにホストされることはなく、評価時に固定されたアップストリームのアーカイブから決定論的に再構築されます。すべてのデータセットには`do_not_train`が含まれています。1つのソースカードがペアごとの多数のデータセットに展開されるため、レジストリの合計数は約1,417のソースカードを上回ります。オープンレーンのデータセットは、スイープキューに直接供給されます。研究専用レーンは、ライセンスで明確に許可されている場合にオンデマンドで実行されます（改変されたライセンス、独自のライセンス、または明記されていないライセンスは、リモートのモデルAPI評価において同意による制限の対象となります）。

| ファミリー | データセット数 | ビルダー / ソース | ライセンス | レーン |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1,260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | オープン |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | オープン (HFゲート付きダウンロード) |
| **Tatoeba** | 874 | [Tatoeba community](https://tatoeba.org) (Tatoeba Challenge経由) | CC-BY-2.0 | オープン |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | オープン |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | オープン |
| **WMT newstest / General** (2014–2025 ブラインドセット) | 178 | WMT (Conference on Machine Translation) (sacreBLEU経由) | `LicenseRef-WMT-Research-Use` | **研究利用** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | オープン |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | オープン |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | オープン |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **非営利 / 研究専用** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | オープン (継承) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **研究専用** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (共有タスク主催者) | CC-BY-NC-SA-4.0 | **非営利 / 研究専用** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (主催者) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **研究専用** |
| **Gamayun** | 8 | CLEAR Global (旧Translators without Borders) | `LicenseRef-TWB-Gamayun` | **非営利 / 研究専用** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **非営利 / 研究専用** |
| **EDTeKLA / prize** | 3 | アルバータ大学 EdTeKLA Research Group | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **非営利 / 研究専用 (隔離)** |
| **BSD** | 2 | 東京大学 鶴岡研究室 | CC-BY-NC-SA-4.0 | **非営利 / 研究専用** |
| **MENYO-20k** | 2 | Masakhane / ザールラント大学 (uds-lsv) | CC-BY-NC-4.0 | **非営利 / 研究専用** |

*（FLORES+ devtest — 870の登録ペア、CC-BY-SA-4.0 — は以下で詳しく説明する参照データセットであり、レジストリの合計を5,602に引き上げます。）*

:::info[非営利の研究専用レーン]
カタログの大部分は寛容なライセンス（CC0、CC-BY-2.0/3.0/4.0、MIT、Apache-2.0）であり、すべてのレーンで使用可能です。ごく一部のセット（TWBの独自ライセンスである**Gamayun**、および主権を範囲とする改変されたCC BY-NC-SAである**EDTeKLA**）は**非営利**であり、商用、賞、またはAPIパスから除外されています。改変されたライセンス、独自のライセンス、または明記されていないライセンスに基づくコーパスの場合、リモートのモデルAPI評価はさらに**同意による制限（consent-gated）**の対象となります。ライセンステキスト自体が評価目的での使用を許可している場合（WMT研究用セットのように、データセットごとの明示的な決定として記録されている場合）、または権利者の明示的な許可がデータセットエントリに記録されている場合を除き、テストハーネスはサードパーティのモデルAPIへのテキスト送信を拒否します（ローカルでの評価は引き続き可能です）。適格性は**用途ベース**です。商用レーンは厳格で、研究レーンは寛容であり、隔離（quarantine）が常に優先されます（そのため、不適切なEdTeKLAのスライスがランク付けされることは決してありません）。コーパスがレーンを選択する方法については、[コーパスの登録と公開レーン](/docs/network/sovereignty/registering-corpora)を参照してください。
:::

参照データセットについては以下で詳しく説明します。ファミリーコーパスも同じJSONスキーマに従い、データセットレジストリに一覧表示されています。

:::note[カタログはデータが揃ったボードではありません]
大規模なコーパスカタログは、手法が*ベンチマーク可能な*対象を示すものであり、結果が揃ったリーダーボードではありません。ボード自体はシード中です。[リーダーボードのルール](/docs/network/leaderboard/rules)および[正直な制限事項](/docs/network/honest-limitations)を参照してください。
:::

### EDTeKLA 開発セット v1 {#edtekla-development-set-v1}

英語→Plains Cree（SRO）翻訳のために構築された最初の評価データセットです。アルバータ大学の [EdTeKLA 研究グループ](https://spaces.facsci.ualberta.ca/edtekla/)によって作成されました。

| プロパティ | 値 |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **バージョン** | `1.0` |
| **言語ペア** | EN → CRK (平原クリー語、SRO正書法) |
| **エントリ数** | 436エントリの開発用分割 (`textbook_dev.json`)。チェーン: アップストリームの589の未加工アライメント行 → 正規化/重複排除後の486の一意の有効なペア (Champollion由来のカウント) → 436の開発用 + 50のホールドアウト (Champollionの決定論的なseed-42による分割 — EdTeKLAは未加工ファイルを公開しており、分割は公開していません)。これとは別の62エントリのゴールドスタンダードセット (手動でキュレーションされた研究専用のものであり、EdTeKLAの資料では**ありません**) を合わせると、プロジェクトの平原クリー語評価コレクションの合計は548になります。 |
| **難易度分布** | Easy, Medium, Hard |
| **出所** | `gold_standard` (話者による検証済み)、`textbook` (出版された教育資料) |
| **ライセンス** | [EdTeKLAの改変版CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — 主権を範囲とする。ルートの教科書はCC BY-NC-ND 4.0) — **リーダーボード、賞、および商用/APIレーンから除外** (非営利) |

> **これは平原クリー語の評価セット数に関する公式な声明です。** 他のページでは数値を再記載せず、ここにリンクしています。486/436/50という数値は、EdTeKLAの未加工のアライメントファイルからChampollionが導き出したものです（EdTeKLA自体はカウントや分割を公開していません）。62エントリのゴールドスタンダードセットは、EdTeKLAとは別の出所を持っています。上記のカウントは常にそのレーンとペアになっています。EdTeKLAは主権を範囲とする改変されたCC BY-NC-SAを採用しており、**リーダーボード、賞、および商用/APIパスから除外されています**。

**テスト対象：**

- 基本的な挨拶と一般的なフレーズ
- 名詞のアニマシーとオブビエーション
- 人称・時制にわたる動詞活用
- 場所格の構文
- 所有格のパラダイム
- 複雑な文構造

:::tip[コーパスの構造]
EdTeKLA由来の資料は、公開されている開発用セットとホールドアウトセットに分割されます（EdTeKLAの未加工の教科書アライメントに対するChampollionによる分割。カウントは上の表を参照）。これとは別の62エントリのゴールドスタンダードセットは、他のソースから手動でキュレーションされたものであり、EdTeKLAコーパスの一部ではありません。検証済みのゴールドスタンダードを備えた小規模で高品質なデータセットは、大規模でノイズの多いデータセットよりも有用です。特に、「それに近い」翻訳が形態論的に無効であることが多い低資源言語においてはなおさらです。
:::

---

## 新しいデータセットの作成

新しい言語ペアまたはドメインのデータセットを作成するには：

### 1. JSONを構造化する

[データセットの形式](#dataset-format)スキーマに従ってください。すべてのエントリには `source`、`reference`、`difficulty`、`provenance`、`register`、および `context` が必要です。

### 2. 一意なIDを割り当てる

わかりやすいスラッグを使用してください：`{project}-{split}-v{version}`（例：`edtekla-dev-v1`、`quechua-test-v1`）。

### 3. ゴールドスタンダードを検証する

すべての `reference` の値は、流暢な話者によって検証されているか、査読済みの公開リソースから取得されている必要があります。機械生成の参照は評価の目的を損ないます。

### 4. 難易度ティアを設定する

各エントリに整数の難易度レベルを割り当てます：

| ティア | 説明 | 例 |
|------|-------------|----------|
| 1 — 基本語彙 | 単語、一般的な挨拶、数字 | "hello" → "tânisi" |
| 2 — 単純な文 | 主語・動詞またはSVO、現在形 | "I see the dog" |
| 3 — 中程度の複雑さ | 過去・未来形、所有格、アニマシー | "I saw his dog yesterday" |
| 4 — 複雑な形態論 | オブビエーション、受動態、接続法語順 | "the woman whose son went to the store" |
| 5 — 上級 | 複文、フォーマルなレジスター、儀礼的表現、慣用句 | レジスターに適したトーンを持つ完全な段落 |

### 5. 出典にタグを付ける

各エントリの出典を示す必要があります。一般的なタグ：

- `gold_standard` — 流暢な話者によって検証済み
- `textbook` — 公開された教育教材から取得
- `elicited` — 構造化されたエリシテーションセッションで作成
- `corpus` — 対訳コーパスから抽出

### 6. ファイルを検証する

任意のモデルを使ってデータセットに対してハーネスを実行し、JSONが正しい形式であること、および必須フィールドがすべて存在することを確認します：

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

ハーネスは、フィールドの欠落、インデックスの重複、またはスキーマ違反があった場合にエラーを出力します。

### 7. 収録のために提出する

[eval ハーネスリポジトリ](https://github.com/gamedaysuits/Champollion)に対してプルリクエストを作成し、**フェッチ元メタデータカード** — ハーネスを上流ソース（ローダー/URL、SHAピン、ライセンス、出典）に向けるレジストリエントリ — を追加してください。**コーパスのコンテンツ自体はコミットしないでください。** Champollion はサードパーティのコーパステキストをホストまたは追跡しません。ハーネスは実行時に上流ソースから参照をフェッチし、取得したばかりのデータに対してスコアを算出します。まずローカルで検証し（ステップ6）、カードのみを提出してください。検証方法と出典の文書も含めてください。

---

## FLORES+ Devtest

[Open Language Data Initiative（OLDI）](https://huggingface.co/datasets/openlanguagedata/flores_plus)が管理する広範囲をカバーする多言語ベンチマークです。Champollion のマルチモデルフロンティア比較に使用されます。

| プロパティ | 値 |
|----------|-------|
| **ID** | ペアごとに1枚のカード：`eval-flores-devtest-v1-<src>-<tgt>`（例：`eval-flores-devtest-v1-amh-fra`） |
| **言語ペア** | 870の収録・実行可能なペア（うち812件は英語以外の2言語間） |
| **エントリ数** | ペアあたり1,012文 |
| **ライセンス** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **ソース** | Meta FLORES-200（現在はOLDI管理）— ソースからフェッチ、ペアごとにSHAピン留め（コーパスコンテンツはここでは追跡されません） |
| **汚染** | **高** — 相対比較専用、テスト・例示のみ（注記参照） |

:::warning[高汚染 — 相対比較専用、絶対ベンチマークとしては使用不可]
FLORES+ は公開されているウェブクロールデータであり、フロンティアモデルがすでに学習済みである可能性が非常に高いです。Champollion はこれを**相対比較専用**レーンで実行します。手法同士の比較には使用できますが、**絶対的な品質スコアとして報告することは禁止**されており、[翻訳マップ](https://champollion.dev)上の**チェーンエッジとして使用することも禁止**されています。これは**テストおよびデモンストレーション専用**です。
:::

:::danger[評価専用]
FLORES+ は評価のみを目的としています。キュレーターは、これを**トレーニングデータとして使用しないよう**明示的に求めています。そのコンテンツがトレーニングコーパスに含まれないよう確認してください。
:::

---

## 関連項目

- [MT 評価](/docs/network/leaderboard/rules) — 評価フレームワークとリーダーボードの概要
- [Eval ハーネス](/docs/network/specifications/harness) — これらのデータセットに対して評価を実行する方法
- [ランカード仕様](/docs/network/specifications/run-card) — 結果を記録するためのJSONスキーマ
- [メソッドリーダーボード](https://champollion.dev/leaderboard) — ライブベンチマークスコア
- [EdTeKLA プロジェクト](https://spaces.facsci.ualberta.ca/edtekla/) — Cree データセットを担当するアルバータ大学の研究グループ
