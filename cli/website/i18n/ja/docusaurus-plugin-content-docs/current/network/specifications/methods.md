---
sidebar_position: 4
title: "メソッドインターフェース"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# 共有メソッドインターフェース

> **要約。** このページでは、すべての Network メソッドが実装しなければならない `TranslationMethod` プロトコル、6 つのメソッドクラス（`raw-llm`、`coached-llm`、`pipeline`、`custom-plugin`、`api`、`human`）、*メソッドがどのように翻訳するか* をシステム間で比較可能にする直交する **パラダイム** 軸（`rule-based`、`statistical`、`neural-nmt`、`llm`、`hybrid`、…）、メソッドプラグイン形式、そして評価サンドボックスでの実行と賞の受賞資格を決定する **依存クラス**（S/O/A1/A2/X）について説明します。これらは 3 つの独立した軸です。このプロトコルを実装するアプローチであればベンチマーク可能であり、何に依存するかによってどこで競えるかが決まります。

eval ハーネスと champollion は、**翻訳メソッド** という共通の概念を持っています。メソッドとは、ソーステキストを受け取り翻訳テキストを生成する任意の手続きであり、直接的な LLM 呼び出し、多段階パイプライン、サードパーティ API、または人間による翻訳が含まれます。

## アーキテクチャ

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

`--method path/to/dir` 経由で読み込まれます。ハーネスは自動的に何も検出しません。

## 2 つのシステム、1 つのインターフェース

| | Eval ハーネス | champollion |
|---|---|---|
| **言語** | Python | Node.js |
| **エントリーポイント** | `translate.py` | `translate.js` |
| **インターフェース** | `TranslationMethod` プロトコル | `methodPlugin` 設定 |
| **目的** | スコアリングを伴うバッチ評価 | 開発/CI でのライブローカライゼーション |
| **出力** | メトリクス付きランカード | 翻訳済みロケールファイル |

両方のシステムをサポートするメソッドは、各言語ランタイム用に 1 つずつ、合計 2 つのエントリーポイントを提供します。**メソッドカード** はその橋渡し役であり、両方のシステムが理解できる形式でメソッドを説明します。

## メソッドカード {#method-card}

メソッドカードは、完全なシステムプロンプトなどの独自情報を明かすことなく、翻訳メソッドが *何であるか* を説明します。以下の問いに答えます：

- これはどのクラスのメソッドか？（生の LLM、coached LLM、パイプライン、API など）
- どの **パラダイム** を使用しているか？（rule-based、statistical、neural-nmt、llm、hybrid）
- どのツールを使用しているか？（FST アナライザー、辞書など）
- 実装はオープンソースか？
- どの言語ペアをサポートしているか？

完全な JSON スキーマについては、[メソッドカード仕様](/docs/network/specifications/methods#method-card) を参照してください。

### 例

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

`dependency_class` フィールドはメソッドの実行と転送に必要なものをまとめています。詳細は後述の [メソッドの有効性と依存クラス](#method-validity-and-dependency-classes) を参照してください。`paradigm` フィールドはメソッドを **パラダイム軸** 上に位置づけます（ここでは `hybrid`：ルールベースの FST によってゲートされた LLM）。詳細は後述の [パラダイム](#paradigms) を参照してください。

### メソッドクラス

| クラス | 説明 |
|-------|-------------|
| `raw-llm` | 最小限の指示による直接 LLM 呼び出し |
| `coached-llm` | 構造化プロンプト、例示、制約を持つ LLM |
| `pipeline` | 決定論的コンポーネントを含む多段階パイプライン |
| `custom-plugin` | `TranslationMethod` プロトコルを実装する外部プロセス |
| `api` | サードパーティ翻訳 API（Google Translate、DeepL など） |
| `human` | 人間による翻訳（ベースライン確立用） |

### パラダイム {#paradigms}

**パラダイム** は 3 番目の独立した軸であり、*アルゴリズムレベルでメソッドがどのように翻訳するか* を表します。メソッドクラスと依存クラスの両方に対して直交しています。メソッドクラスだけでは LLM 中心になってしまいます。ルールベースの [Apertium](https://www.apertium.org/) システムと Google Translate はどちらも `pipeline`/`api` に分類されるため、パラダイム軸なしでは「ルールベース vs ニューラル」の違いが見えません。パラダイム軸によって、その比較がリーダーボード上でファーストクラスかつフィルタリング可能になります。

| パラダイム | 説明 | 例 |
|----------|-------------|----------|
| `rule-based` | 有限状態トランスデューサー、手書き文法、形態論的転換 | Apertium、GiellaLT FST 生成 |
| `statistical` | 対訳コーパスから学習したフレーズベース / 統計的 MT（SMT） | 古典的な Moses |
| `neural-nmt` | 専用のニューラルエンコーダー–デコーダー MT モデル | Google Translate、DeepL、Microsoft Translator、OPUS-MT、LibreTranslate、Tilde MT、Translated (Lara) |
| `llm` | 翻訳するようにプロンプトされた汎用大規模言語モデル | 生または coached の GPT / Claude / Gemini 呼び出し |
| `hybrid` | 1 つのメソッド内で 2 つ以上のパラダイムを組み合わせる | ルールベース FST によってゲートされた LLM（crk-translate）；NMT + ルールベース後編集 |
| `human` | 人間による翻訳（パラダイムレベルのベースライン） | コミュニティ翻訳者ベースライン |
| `unknown` | 未指定 — カードにパラダイムが宣言されていない | パラダイム導入前のカードの後方互換デフォルト |

各軸は独立しています。具体的な例を示します：

| メソッド | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate（セルフホスト、OSS） | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate（FST ゲート、LLM coached） | `pipeline` | `hybrid` | A2 |
| 生の GPT 呼び出し | `raw-llm` | `llm` | A1 |

パラダイムはメソッドカードでは **任意** です。パラダイムが指定されていない場合は `unknown` として記録されます（公開をブロックすることはありません — この軸は追加的なものです）。上記の列挙型は正規のサポートされた語彙であり、ハーネスによって強制されます（`config.VALID_PARADIGMS`）。強制はアプリ側で行われ、データベース制約ではないため、メソッドが依存している値の名前変更や削除にコストがかかるだけで、後から新しいパラダイムを追加することはマイグレーションなしに可能です。

## メソッドの有効性と依存クラス {#method-validity-and-dependency-classes}

メソッドの実行可能性と転送可能性は、最も利用しにくい依存関係によって決まります。メソッドが何を必要とするかを正確に把握することに依存する Network のメカニズムが 2 つあります：

1. **サンドボックス評価**（[ベンチマーク仕様 §8.2](/docs/network/specifications/benchmark)）— 公式のゴールドスタンダードスコアは、ネットワークポリシーが **デフォルト拒否** のサンドボックスから得られます。外部サービスを暗黙的に必要とするメソッドは、公式スコアを生成できません。
2. **賞の転送**（[賞仕様](/docs/network/specifications/prizes)）— 受賞メソッドは言語コミュニティのガバナンス組織に転送されます。提出者が含める権利を持たないコンテンツをバンドルしたメソッドは、合法的に転送できません。提出者はパッケージ内のすべてのものについて権利を保有している（または付与されている）必要があります。

両方のチェックをアドホックではなく機械的に行うために、すべてのメソッドは `method.json` の **依存マニフェスト** から導出された **依存クラス** を宣言します。

> **命名に関する注記 — 3 つの独立した軸。** *メソッドクラス*（§上記：`raw-llm`、`pipeline`、…）はメソッドの *形状*、つまりそれが提示するインターフェース契約を説明します。*パラダイム*（[§パラダイム](#paradigms)：`rule-based`、`neural-nmt`、`llm`、…）は *アルゴリズム的にどのように翻訳するか* を説明します。*依存クラス*（このセクション）は *実行と転送に何が必要か* を説明します。3 つは直交しています：`pipeline` メソッドは `rule-based` または `hybrid` であり得て、任意の依存クラスになり得ます。（クラスとパラダイムは意図的に分離されています。クラスだけでは LLM 中心になってしまい、両方が `pipeline` または `api` として現れる場合にルールベースシステムとニューラルシステムを区別できないためです。）

### 5 つの依存クラス

| クラス | 名称 | 定義 | サンドボックス実行可能？ | 賞の受賞資格？ |
|-------|------|-----------|-------------------|-----------------|
| **S** | 自己完結型 | すべてのコード、データ、モデル、ウェイトが再配布とコミュニティ転送を許可するライセンスのもとでメソッドディレクトリ内に含まれている。 | ✅ はい、そのまま | ✅ はい |
| **O** | オープン外部 | 再配布を許可するオープンライセンス（AGPL などのコピーレフトライセンスを含む）のもとで外部ホストされたアーティファクトに依存する — 例：インストール時にダウンロードされる FST。 | ✅ はい — アーティファクトはピン留めされ、**提出物にミラーリング**される | ✅ はい、ライセンス互換性条件付き：コピーレフト条項は転送を通じて保持され、コミュニティはライセンスが全員に付与するのと同じ権利を受け取る |
| **A1** | API 依存、代替可能 | ランタイム LLM 推論を必要とし、モデルが **代替可能な設定** である — 十分な能力を持つ任意のモデルを差し込むことができる。メソッドの価値は特定のプロバイダーのモデルではなく、プロンプト、コーチングデータ、コードにある。 | ⚠️ サンドボックス仕様が定義する **LLM ゲートウェイ** 経由のみ（🔲 計画中 — 後述参照） | ⚠️ 条件付き — 後述参照 |
| **A2** | API 依存、代替不可 | ミラーリングまたは代替できない外部データまたはサービス API へのランタイム呼び出しを必要とする — 通常、提供されるコンテンツが独自または未ライセンスであるため（例：基礎となる辞書に公開ライセンスがない辞書 API）。 | ❌ いいえ — 権利者の許可なしに依存関係はサンドボックス内に存在できない | ❌ 権利者がサンドボックス収録 **および** 転送許可を付与するまで不可。オープン（開発セグメント）リーダーボードでは **「外部依存」** フラグ付きで許可 |
| **X** | クローズド | 提出者が再配布する権利を持たないコンテンツをバンドルしている — 未ライセンスのデータセット、スクレイピングされた独自コンテンツ、ライセンス非互換のコンポーネント。 | ❌ | ❌ すべてのレーンで不適格。権利なしにコンテンツをバンドルすることは、メソッドがどこで実行されるかに関わらずライセンス違反である |

**実効クラス。** メソッドの依存クラスは、S < O < A1 < A2 < X の順序で、宣言されたすべての依存関係の中で *最も制限の厳しい* クラスです。ライセンスのない辞書が 1 つあるだけで、それ以外は自己完結型のパイプラインがクラス A2（ランタイムでアクセスされる場合）またはクラス X（権利なしにバンドルされる場合）になります。

### A1/A2 の区別：代替可能性

ほとんどのメソッドは LLM を呼び出します。Network はそれを否定しませんが、2 種類の API 依存関係を区別します：

- **A1（代替可能）：** API はコモディティ LLM 推論を提供します。モデル識別子は設定であり、メソッドはコミュニティがホストするオープンウェイトモデルを含む任意の互換推論エンドポイントに対してエンドツーエンドで実行できなければなりません。モデルによって出力品質は異なる場合があります — それは開発者のリスクであり、公式スコアは評価で使用されたピン留めモデルに紐付けられます。**プロバイダー側の状態**（プロバイダーのみでホストされるファインチューン、プロバイダーのファイルストア、プロバイダー固有のアシスタント）に依存するメソッドは代替可能ではありません：その状態は差し替えられないため、基礎となるウェイトやデータが提出物に含まれていない限り、依存関係は A2 です。
- **A2（代替不可）：** API は固有のもの — 通常は独自または未ライセンスのデータ — を提供します。代替エンドポイントはそれを提供できず、権利者の許可なしにコンテンツをサンドボックスにミラーリングすることもできません。メソッドはオープンリーダーボード（フラグ付き）では機能しますが、許可が存在するまで公式サンドボックススコアを生成したり賞の受賞資格を得たりすることはできません。

**A1 賞転送が実際に伝えるもの。** コミュニティはモデルを受け取りません — Anthropic、Google、OpenAI のウェイトを誰も転送することはできません。転送はモデルの *周囲にある* 完全なレシピをカバーします：すべてのプロンプト、コーチングデータ、パイプラインコード、リトライロジック、設定、および文書化されたモデル要件。モデルは設計上代替可能であるため、コミュニティは開発者の関与なしに、転送されたメソッドを任意のプロバイダーまたは自分たちのハードウェア上のオープンウェイトモデルに向けることができます。レシピは所有され、エンジンは賃借されて交換可能です。

### 依存マニフェスト（`method.json`）

すべてのメソッドは `method.json` マニフェストで依存関係を宣言します。各エントリーは、アーティファクトが何であるか、どこから来るか、どのライセンスが適用されるか、メソッドがどのようにアクセスするかを記録します：

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `id` | ✅ | 依存関係の安定した識別子 |
| `kind` | ✅ | `data`、`model`、`software`、または `service` |
| `license` | ✅ | SPDX 識別子、`proprietary`、または `none`。`none` は公開ライセンスが存在しないことを意味し、全権留保として扱われる |
| `access` | ✅ | `bundled`（メソッドディレクトリに含まれる）、`mirrored`（インストール時に取得、ピン留め、提出物にベンダリング）、`gateway`（評価ゲートウェイ経由のランタイム LLM 推論）、`external-api`（その他のランタイムネットワーク呼び出し） |
| `source` | ✅ | 正規 URL または `provider:slug` 識別子 |
| `pin` | `mirrored` の場合 | 正確なアーティファクトをピン留めするバージョン、コミット、またはコンテンツハッシュ |
| `substitutable` | `gateway`/`external-api` の場合 | 任意の互換エンドポイントがこの依存関係を提供できるかどうか |
| `redistributable` | ✅ | ライセンスがアーティファクトの再配布を許可するかどうか |
| `transferable` | ✅ | アーティファクト（またはその権利）が賞転送条件のもとでコミュニティに移転できるかどうか |
| `notes` | ❌ | 自由形式のコンテキスト |

**クラス導出。** 各依存関係はクラスに寄与し、メソッドの `dependency_class` は最も制限の厳しいものになります：

| 依存プロファイル | 寄与 |
|--------------------|-------------|
| `bundled` + ライセンスが再配布と転送を許可 | S |
| `mirrored` + 再配布を許可するオープンライセンス（コピーレフト含む） | O |
| `gateway` + `substitutable: true`（LLM 推論） | A1 |
| `external-api`、または `gateway` かつ `substitutable: false` | A2 |
| `bundled` + `license: none` または再配布非互換ライセンス | X |

宣言された `dependency_class` は、ハーネスがマニフェストから導出したクラスと一致しなければなりません。不一致は検証エラーです。

外部依存関係が **ない** メソッドは `"dependency_class": "S"` と `"dependencies": []` を宣言します。空の配列は肯定的な宣言であり、他と同様に監査されます。

### 有効性の検証方法

最も低コストから最も権威あるものまで、3 つの層があります：

1. **マニフェスト監査。** ハーネスはマニフェストから実効クラスを導出し、不一致を拒否します。レビュアーは宣言された各依存関係をその記載ライセンスとソースに照らして確認します — `redistributable: true` と宣言された依存関係の上流ライセンスが異なる場合はレビューで不合格になります。
2. **静的解析。** 提出されたコードは、マニフェストが説明していないネットワーク呼び出し、動的ダウンロード、ファイルシステムアクセスについてスキャンされます。レビューで見つかった *未宣言の* 依存関係は、それがどのクラスであったかに関わらず拒否の根拠となります — マニフェストは正確なだけでなく完全でなければなりません。
3. **サンドボックスネットワークポリシー。** サンドボックス仕様は **デフォルト拒否の egress** を要求します：メソッドコンテナはパスが明示的に許可リストに登録されていない限りネットワークアクセスを得られません。仕様が定義する唯一の egress パスは **LLM ゲートウェイ** です — 評価インフラが運営する推論プロキシで、ピン留めされたモデルの明示的な許可リストに制限され、すべてのリクエストとレスポンスが実行後の監査のためにログに記録されます。許可リストにないものはポリシー層ではなくネットワーク層で失敗します。ネットワークポリシーとゲートウェイ設計については [ベンチマーク仕様 §8.6](/docs/network/specifications/benchmark) を参照してください。

> **2つの異なるサンドボックス — 1つは計画中、1つは稼働中。** 「サンドボックス」という言葉が2つの異なるものを指しているため、注意してお読みください：
>
> - 🔲 **計画中：プラットフォームサンドボックスとそのLLMゲートウェイ。** このセクションで説明する評価インフラが運用する環境 — そのLLMゲートウェイによってClass A1メソッドが公式ゴールドスタンダードスコアを生成できるようになる予定のもの — は仕様として定義されていますが、まだ構築されていません。構築されるまでの間、Class A1メソッドは原則として賞の対象となりますが、現時点では公式ゴールドスタンダードスコアを生成することはできません。
> - ✅ **稼働中：主催者ノードのメソッド実行レーン。** コンテスト主催者自身のスコアリングノードは、提案されたメソッドバンドルをネットワーク分離コンテナ（`mt-eval node run-method`）内ですでに実行しています：`--network=none`でビルド・実行され、ルートは読み取り専用、依存関係はベンダー化されており、実行時にネットワークを必要としないメソッド（構造上Class S/O）に限定されます。署名済みスコアのみのバンドルをリムーバブルメディアで受け渡す、真のエアギャップマシン上でも動作します。エンドツーエンドの手順については、[Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest)を参照してください。
>
> このセクションでは、現在プラットフォーム上で動作しているものではなく、プラットフォーム仕様が要求する内容を説明しています。

### リーダーボード表示

- リーダーボードは各メソッドの依存クラスをメソッドクラスバッジとともに表示します。
- オープンリーダーボード上のクラス A2 メソッドには **「外部依存」** フラグが表示されます：そのスコアは変更または消滅する可能性のあるサードパーティサービスに依存しており、現時点では賞の受賞資格がありません。
- クラス X のメソッドは掲載されません。

## Eval ハーネス：TranslationMethod プロトコル {#eval-harness-translationmethod-protocol}

evalハーネスはプラグインにPythonの構造的型付け（`Protocol`）を使用しています。適切なメンバーを持つクラスであれば継承なしで動作します。プロトコルには`translate`だけでなく、**3つ**の必須メンバーがあります：

1. **`name`**（`str`）— 人間が読めるメソッド名。実行IDおよびログで使用されます。
2. **`method_card()`**（`-> dict | None`）— 出所追跡のためのメソッドメタデータ。実行ログおよび公開された実行カードに埋め込まれます。メソッドにカードがない場合は`None`を返してください。
3. **`async translate(entries, config)`**（`-> list[dict]`）— 翻訳処理本体：エントリのバッチを受け取り、エントリごとに1つの結果dictを返します。

ハーネスが`--method path/to/dir`経由でプラグインを読み込む際、`translate`が呼び出し可能であることを検証し、次に`method.name`を読み取り、`method.method_card()`を無条件に呼び出します。どちらかが欠けているプラグインは、グレースフルに失敗するのではなく、ロード時にクラッシュします。

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

プラグインディレクトリには、少なくとも`name`と`entry_point`を含む`method.json`マニフェストが必要です（`"module_name:ClassName"` — モジュールはプラグインディレクトリから読み込まれ、クラスがインスタンス化されます）。返されたメソッドカードが`class`または`paradigm`を宣言する場合、上記の正規ボキャブラリーを使用する必要があります。タクソノミー外のカードは、リーダーボードのフィルターから暗黙的に除外されるのではなく、ロード時にバリデーションエラーとなります。

プラグインのビルド、実行、提出までのエンドツーエンドの実例については、[Submit a Method](/docs/network/getting-started/submit-a-method)および[FST-Gated Pipeline cookbook](/docs/network/tutorials/fst-gated-pipeline)を参照してください。

## champollion：methodPlugin 設定

champollion では、メソッドは `champollion.config.json` で言語ペアごとに登録されます：

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

champollion 側のインターフェースについては、[プラグイン仕様](https://champollion.dev/docs/reference/plugin-spec) を参照してください。

## リーダーボード統合

メソッドカードがランに添付されると（`--method-card` 経由）、ランカードに埋め込まれてリーダーボードに表示されます：

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

`--method-card` が提供されていない場合、`mt-eval publish` はメソッドの説明を案内するインタラクティブウィザードを起動します。

リーダーボードに表示される内容：
- **クラスバッジ** — 視覚的インジケーター（例：「pipeline」、「coached-llm」）
- **パラダイム** — アルゴリズムパラダイム（例：「rule-based」、「neural-nmt」、「llm」、「hybrid」）、フィルタリング可能な列（[パラダイム](#paradigms) 参照）
- **依存クラス** — S/O/A1/A2（[メソッドの有効性と依存クラス](#method-validity-and-dependency-classes) 参照）；A2 メソッドには「外部依存」フラグが付く
- **メソッド名** — メソッドカードから
- **使用ツール** — メソッドカードから一覧表示
- **オープンソースインジケーター**

メソッドカードが添付されていない場合、リーダーボードはハーネスネイティブの設定（モデル、プロンプトバージョン、温度、有効なツール）を表示します。

:::danger[評価データでのトレーニングは禁止]
開発プロセスにおいて評価データセットへの露出があったメソッド — トレーニングデータ、few-shotの例、辞書エントリ、またはプロンプトチューニング素材としての使用を含む — はリーダーボードから**失格**となります。良いメソッドと悪いメソッドを区別する基準については、[MT Evaluation](/docs/network/leaderboard/rules)を参照してください。
:::

---

## 関連情報

- [MT 評価](/docs/network/leaderboard/rules) — 概要、リーダーボードの価値、良いメソッド・悪いメソッドのガイダンス
- [Eval ハーネス](/docs/network/specifications/harness) — 評価の実行方法
- [評価データセット](/docs/network/leaderboard/datasets) — 利用可能なデータセット（EDTeKLA、FLORES+）
- [ランカード仕様](/docs/network/specifications/run-card) — ランカード JSON スキーマ
- [プラグイン仕様](https://champollion.dev/docs/reference/plugin-spec) — champollion 側プラグインインターフェース
- [メソッドリーダーボード](https://champollion.dev/leaderboard) — ライブベンチマークスコア
- [ベンチマーク仕様](/docs/network/specifications/benchmark) — 評価プロトコル、コーパス形式、ランカードスキーマ
- [スコアリング仕様](/docs/network/specifications/scoring) — メトリクス、複合ウェイト、品質ティアの SSOT
