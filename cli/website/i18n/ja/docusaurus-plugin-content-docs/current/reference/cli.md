---
sidebar_position: 1
title: "CLIリファレンス"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLIリファレンス

## コマンド

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

任意のコマンドの詳細なヘルプを表示するには、`champollion <command> --help`を実行してください。

## グローバルオプション

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

`champollion.config.json`を作成するインタラクティブなセットアップウィザードです。ソースロケール、ターゲット言語、ファイル形式、翻訳モデルの設定をガイドします。

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**`--langs` オプション**: ターゲット言語コードをカンマ区切りで指定します。言語の入力プロンプトをスキップし、各言語のデフォルトレジスタープリセットを適用します。`--yes`と組み合わせることで、完全に非インタラクティブなセットアップが可能です。

**言語プリセット**: ターゲット言語の入力プロンプトでは、プリセット名を入力できます：
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

プリセットと個別コードの組み合わせ例：`european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

すべてのロケールファイルにわたって、未翻訳のキーと古くなったキーを翻訳します。デフォルトでは、同期後に検証を実行します。

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**翻訳メモリ**: デフォルトでは、`sync`は`.champollion/tm.json`を読み込み、変更されていないソース値に対してキャッシュされた翻訳を返します。翻訳プロバイダーの切り替え時やデバッグ時には、`--no-tm`を使用してキャッシュをバイパスできます。詳細は[翻訳メモリ](/docs/concepts/translation-memory)を参照してください。

**変更検出**: champollionはSHA-256ハッシュを`.champollion.lock`に保存します。ソース値が変更されると、次回の同期時にそれらのキーが自動的に再翻訳されます。すべての開発者がベースラインを共有できるよう、ロックファイルをコミットしてください。

**並列処理**: JSONキーの翻訳とコンテンツの翻訳はどちらも並列で実行されます。JSONロケールは同時に翻訳され（デフォルト：200並列ロケール）、各ロケール内のバッチも並列化されます（4並列バッチ）。コンテンツ翻訳（Markdown、MDX、ブログ投稿）はフラットなワークアイテムプールで実行されます（デフォルト：48並列APIコール）。`--json-concurrency`、`--content-concurrency`、または`--concurrency`（両方を設定）で上書きできます。

**出力**: 同期時にはバージョンバナー、フォーマット／フレームワーク検出結果、コスト見積もり、およびロケールごとのプログレスバーが表示されます：

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

プログレスバーはバッチ（約80キー）ごとにその場で更新されます。エラーと警告のみを表示するには`--quiet`を、機械可読なNDJSON出力には`--json`を使用してください。どちらもプログレスバーとバナーを非表示にします。

---

## watch

ソースロケールファイルが変更されたときに自動的に同期します。`Ctrl+C`で中断するまで実行し続けます。

```bash
champollion watch
```

---

## audit

過去の実行で生成された`[EN]`プレフィックス付きのフォールバック値をすべて一覧表示します。見つかった場合はコード1で終了します。翻訳が不完全なビルドを失敗させるCIゲートとして使用できます。

```bash
champollion audit
```

---

## verify

ディスクからすべてのロケールファイルを再読み込みし、翻訳が実際に存在し正しいことを検証します。これは`sync`の終了時に自動的に実行される検証と同じです（`--no-verify`が渡された場合を除く）。

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**チェック内容：**
- キーの一致 — すべてのソースキーが各ターゲットに存在するか
- 過去の実行による`[EN]`フォールバックマーカー
- 空の翻訳
- スクリプトの適合性 — 非ラテン系ロケールには非ASCII文字の翻訳が必要
- プレースホルダーの保持 — ICUプレースホルダーがソースと一致するか
- エンコーディングの問題 — BOMマーカー、不可視文字
- ソースのエコー — ソースと同一の値（警告）

---

## lint

i18n翻訳呼び出しを使用すべきハードコードされたユーザー向け文字列をソースコードからスキャンします。フレームワーク（next-intl、react-i18next、vue-i18n、Hugo）を自動検出します。

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**検出内容：**
- JSXテキスト、`placeholder`、`alt`、`aria-label`、`title`内のハードコードされた文字列
- ユーザー向けコンテンツがあるがi18nフレームワークのインポートがないファイル
- デッドキー — どのソースファイルからも参照されていないロケールキー
- カバレッジスコア — i18nを通じて処理されている文字列の割合

**除外設定**: プロジェクトルートに`.champollionignore`を作成してください（`.gitignore`のようなglobパターンを使用）。

---

## wrap

`lint`で検出されたハードコードされた文字列を`t()`呼び出しで自動的にラップします。ファイルを変更する前に自動バックアップを作成します。

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**安全ゲート：**
1. Gitクリーンチェック（ドライランではスキップ）
2. `.champollion-backup/`への自動バックアップ
3. 各ファイル書き込み前の差分プレビュー
4. バックアップからの復元のための`--undo`サポート

---

## seo

多言語サイト向けのSEOアーティファクトを生成します。

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| サブコマンド | 出力 |
|------------|--------|
| `hreflang` | `<link rel="alternate" hreflang>`タグ |
| `sitemap` | 多言語`sitemap.xml` |
| `jsonld` | JSON-LD WebSite言語スキーマ |

---

## integrity

翻訳済みロケールファイルの破損とドリフトを検出します。

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**チェック内容:**
- プレースホルダーの破損（例: ソースには存在するがターゲットには存在しない `{name}`）
- エンコーディングの問題（文字化け、無効なUnicode）
- 未翻訳のコピー（ターゲットの値がソースと同一） — [`noTranslate`](/docs/getting-started/configuration#no-translate) キーは除外され、Translation Memory がパイプラインで生成されゲートで承認されたと確認したエコーも除外されます。フラグが立てられたままのものは、まさに `sync` が再キューイングするものです。正常なファイルについて、これら2つのツール間で不一致が生じることはありません。
- 翻訳不要の乖離（ソースと同一*ではない* `noTranslate` キー） — 期待される値と実際の値、およびエスケープされた不可視文字とともに報告されます。修復するには `champollion sync` を実行します。
- 予期しない PUA（[script conversion](/docs/getting-started/configuration#script-conversion) がオフになっているロケールにおける私用領域のコードポイント — 特殊なフォントがないと空白でレンダリングされます）。修復するには `champollion repair-script` を実行します。
- 空洞化された値（文字が削除されたソースとなっているターゲット — コンテンツ保持ゲートより古いパイプラインによる破損）。`sync --force-keys <key>` または `sync --pair <pair> --force` を使用して再翻訳してください。
- 孤立したキー（ターゲットには存在するがソースには存在しないキー）
- ICU MessageFormat の複数形カテゴリの完全性（例: アラビア語には6つのカテゴリが必要）

---

## repair-script

発生するべきではなかったスクリプト変換を元に戻します。変換がオフに設定されているロケール内の PUA エンコードされた値（pIqaD、Tengwar、Kryptonian）は、コンバーター自身の逆変換テーブルを介してローマ字表記に復元されます。

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| オプション | 効果 |
|--------|--------|
| `--dry` | 書き込まずに修復をプレビューする |
| `--locale <code>` | 1つのロケールのみを修復する |
| `--json` | 機械可読なJSON出力 |
| `--warn-only` | 復元不可能なPUAが残っていても終了コード0で終了する |

pIqaD は正確に逆変換されます。Tengwar と Kryptonian の逆変換では大文字と小文字の区別を復元できません（大文字・小文字の欠落としてフラグが立てられます）。Translation Memory は変換前の値を保存しているため、修復の必要はありません。登録されているどのコンバーターでも逆変換できない PUA が残っている場合は、終了コード 1 で終了します。

---

## tm

翻訳メモリキャッシュ（`.champollion/tm.json`）を管理します。TMは過去の翻訳を保存し、APIを呼び出す代わりに後続の同期時にそれらを返します。

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| サブコマンド | 出力 |
|------------|--------|
| `stats` | エントリ数、ファイルサイズ、ロケール別の内訳 |
| `clear` | キャッシュファイルの削除（全体またはロケール別） |

| オプション | 効果 |
|--------|--------|
| `--locale <code>` | 特定のロケールのエントリのみをクリア |
| `--yes` | 確認プロンプトをスキップ |

TMの仕組みとクリアするタイミングについては、[翻訳メモリ](/docs/concepts/translation-memory)を参照してください。

---

## xliff

プロの翻訳者によるレビュー用にXLIFF 1.2ファイルをエクスポート・インポートします。XLIFFはmemoQ、SDL Trados、PhraseなどのCATツールでサポートされている汎用交換フォーマットです。

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| サブコマンド | 出力 |
|------------|--------|
| `export` | ソースとターゲットのロケールファイルから`.xliff`を生成 |
| `import` | レビュー済みの`.xliff`翻訳をロケールファイルにマージ |

| オプション | 効果 |
|--------|--------|
| `--locale <code>` | エクスポート対象のターゲットロケール（必須） |
| `--out <path>` | カスタム出力パスまたはディレクトリ |
| `--dry` | 書き込みを行わずにインポートをプレビュー |

完全なワークフローについては、[プロの翻訳者との連携](/docs/guides/professional-translators)を参照してください。

---

## status

ペアの設定、インストール済みプラグイン、品質ティア、ベンチマークスコアを表示します。

```bash
champollion status
```

---

## provenance

インストール済みのすべてのプラグインの翻訳リソースライセンスを監査します。

```bash
champollion provenance
```

---

## plugin

翻訳メソッドプラグインを管理します。プラグインは`.champollion/methods/`にインストールされる、あらかじめパッケージ化された翻訳レシピです。

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

プラグインマニフェスト形式については、[プラグイン仕様](/docs/reference/plugin-spec)を参照してください。

---

## leaderboard

Networkリーダーボードから翻訳メソッドを閲覧、検索、インストールします。リーダーボードからインストールされたメソッドには、ベンチマークスコアと完全な正規MethodConfig（評価時に使用された正確な設定）が付属しています。

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| オプション | 効果 |
|--------|--------|
| `--pair <code>` | 言語ペアでリーダーボードをフィルタリング（例：`en:fr`） |
| `--install <name>` | リーダーボードからメソッドプラグインをインストール |
| `--apply` | インストール後、`methodPlugin`を`champollion.config.json`に自動的に追加 |

**`--apply`ワークフロー：** `--apply`を付けてインストールすると、champollionはメソッドプラグインを`.champollion/methods/`に書き込み、**さらに**`champollion.config.json`を更新して該当ペアにそのメソッドを使用するよう設定します。これは「最高スコアのメソッドは何か？」から「本番環境で使用中」までの最速の経路です。

---

## fonts

構築言語スクリプトコンバーター用のPUA Webフォントをダウンロードして管理します。Private Use Area文字を使用する言語（クリンゴン語、シンダリン語、クリプトン語）は、スクリプトをレンダリングするためにカスタムWebフォントが必要です。このコマンドは、検証済みのオープンソースリポジトリからフォントをダウンロードします。

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| サブコマンド | 出力 |
|------------|--------|
| `list` | 必要なPUAフォントとそのインストール状況を表示 |
| `install` | 設定済み言語のフォントをダウンロード |

| オプション | 効果 |
|--------|--------|
| `--dir <path>` | フォント出力ディレクトリを上書き（プロジェクトタイプから自動検出） |
| `--css` | フォントと一緒に`conlang-fonts.css`スニペットを生成 |
| `--config <path>` | 設定ファイルへのパス（どの言語にフォントが必要かの検出に使用） |

**自動検出：** 出力ディレクトリはプロジェクト構造から推定されます：
- **Docusaurus** → `static/fonts/` または `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **デフォルト** → `public/fonts/`

**ネイティブUnicodeコンバーター**（`crk` → クリー音節文字、`sr` → セルビア語キリル文字）はフォントのインストールを必要としません。

PUAフォントの詳細については、[構築言語、スクリプト、正書法](/docs/guides/conlangs-scripts-orthography)を参照してください。

## 3層パイプライン

堅牢なi18nを実現するために、`lint`、`sync`、`audit`を組み合わせて使用してください：

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| レイヤー | コマンド | タイミング | 目的 |
|-------|---------|------|---------|
| **Lint** | `lint` | コミット前 | ハードコードされた文字列を含むコミットをブロック |
| **Sync** | `sync` | コミット後 / CI | 未翻訳・変更済みキーを翻訳 |
| **Verify** | `verify` | 同期後 / CI | 翻訳が存在し正しいことを確認 |
| **Audit** | `audit` | ビルドステップ | いずれかのロケールに`[EN]`マーカーがある場合はデプロイを失敗させる |

---

## 関連項目

- [設定](/docs/getting-started/configuration) — 設定ファイルリファレンス
- [翻訳メソッド](/docs/guides/translation-methods) — ペアごとのメソッド選択
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとコスト削減
- [プロの翻訳者との連携](/docs/guides/professional-translators) — XLIFFワークフロー
- [プラグイン仕様](/docs/reference/plugin-spec) — プラグインマニフェスト形式
- [CI/CDガイド](/docs/guides/ci-cd) — パイプラインでのCLIコマンドの自動化
- [同期の仕組み](/docs/concepts/how-sync-works) — 同期パイプラインの理解
- [品質ゲート](/docs/concepts/quality-gate) — 翻訳の検証方法
