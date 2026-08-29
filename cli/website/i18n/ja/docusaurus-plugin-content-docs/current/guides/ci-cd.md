---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD インテグレーション

ビルドパイプラインで翻訳を自動化します。

## GitHub Actions: プッシュ時の同期

既存のビルドパイプラインに翻訳同期を追加します：

```yaml title=".github/workflows/deploy.yml"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - run: npm run build
```

## GitHub Actions: スケジュール同期

スケジュールに従って翻訳を実行し、自動コミットします：

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          git add i18n/ content/ locales/ messages/
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git push
```

## Google Translate メソッド

OpenRouter の代わりに組み込みの Google Translate メソッドを使用する場合：

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## 直接 LLM プロバイダー

`openai`、`anthropic`、または `gemini` メソッドを直接使用する場合：

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx champollion sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx champollion sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx champollion sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx champollion sync --method deepl
```

## リモート翻訳 API

リモート翻訳エンドポイント（例：ホスト型翻訳サービス）を使用する場合：

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## 三層 CI パイプライン

i18n カバレッジを最大化するために、3 つのツールすべてでパイプラインをゲートします：

```yaml
jobs:
  i18n:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # 1. Catch hardcoded strings before they ship
      - run: npx champollion lint

      # 2. Translate missing keys
      - run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      # 3. Fail if any locale is incomplete
      - run: npx champollion audit
```

| レイヤー | コマンド | タイミング | 目的 |
|---------|---------|-----------|------|
| **Lint** | `lint` | コミット前 | ハードコードされた文字列を含むコミットをブロック |
| **Sync** | `sync` | コミット後 / CI | 不足しているキーと変更されたキーを翻訳 |
| **Audit** | `audit` | ビルドステップ | ロケールが不完全な場合はデプロイを失敗させる |

:::tip[CI における翻訳メモリ]
CI ランナーに永続的なワークスペース（または `.champollion/` のキャッシュ）がある場合、翻訳メモリは自動的に機能します — 以降の同期では、ソーステキストが実際に変更されたキーのみが翻訳されます。エフェメラルなランナーの場合は、実行間で `.champollion/tm.json` をキャッシュすることを検討してください：

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## 関連情報

- [CLI リファレンス](/docs/reference/cli) — コマンドの完全なリファレンス
- [同期の仕組み](/docs/concepts/how-sync-works) — インクリメンタル同期について
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとコスト削減
- [翻訳メソッド](/docs/guides/translation-methods) — 言語ペアごとのメソッド選択
- [品質ゲート](/docs/concepts/quality-gate) — 翻訳が失敗した場合の動作
- [設定](/docs/getting-started/configuration) — 設定リファレンス
