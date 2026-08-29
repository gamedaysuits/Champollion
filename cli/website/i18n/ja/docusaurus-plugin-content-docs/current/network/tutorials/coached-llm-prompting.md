---
sidebar_position: 2
title: "クックブック：コーチング付き LLM プロンプティング"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# コーチング付き LLM プロンプティング

> **アイデア:** 文法規則、バイリンガル辞書、スタイルノートを LLM のシステムプロンプトに直接注入します。トレーニングもファインチューニングも不要 — 有効な翻訳へと出力を導く、構造化された言語知識を活用するだけです。

:::info[これはクックブックであり、完成した実装ではありません]
このガイドは、アプローチとその主要な設計上の決定事項の概要を示しています。使用する言語ペア、利用可能なリソース、および評価目標に合わせて適宜調整してください。
:::

## このアプローチを使うべき場面

- 対象言語に関する**言語的知識**（文法規則、辞書エントリ、スタイルの好み）はあるが、ファインチューニングに十分な並列データがない場合
- **素早くイテレーションしたい**場合 — プロンプトの変更は数秒でデプロイでき、再トレーニングは不要
- LLM が誤りやすい対象言語の**既知のパターン**がある場合（性の一致、スクリプトの慣習、丁寧さのレベルなど）
- コーチング付きプロンプティングをベースラインと比較してベンチマークし、効果的な手法を繰り返し改善したい場合

## 仕組み

1. **コーチングデータを準備する** — 文法規則、バイリンガル辞書、スタイルノートを構造化された JSON ファイルにまとめます
2. **レジスターを設定する** — 言語、スクリプト、トーンを指定するシステムプロンプトのプレフィックスを作成します
3. **ハーネスを実行する** — コーチングデータがすべての LLM プロンプトに注入されます
4. **失敗を確認する** — 品質ゲートが拒否した内容を確認し、パターンに対処するためのルールを追加します
5. **イテレーションする** — コーチングファイルを改訂するたびに新しい実験となり、ハーネスがすべてを追跡します

## コーチングデータの構造

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## 主要な設計上の判断

**ルールの具体性とコンテキストウィンドウ:** ルールが多いほど LLM へのガイダンスは増えますが、実際の翻訳に使えるコンテキストウィンドウを消費します。影響の大きいルール 5〜10 個から始め、特定の失敗パターンが見られた場合にのみ追加してください。

**辞書のカバレッジ:** 完全な辞書は必要ありません — LLM が一貫して誤る用語に絞って対応してください。20〜30 の強制用語だけでも、一貫性を大幅に向上させることができます。

**ルールの順序が重要:** 最も重要なルールを先頭に置いてください。LLM は早い段階の指示により強く注目します。

## 実験の実行

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## メリットとデメリット

| | |
|---|---|
| ✅ トレーニングコストがゼロ | ❌ 品質の上限は LLM の基礎知識に依存する |
| ✅ 即座にイテレーション可能（プロンプトを変更して再実行） | ❌ コンテキストウィンドウにより注入できるコーチング量が制限される |
| ✅ あらゆる LLM プロバイダーで動作する | ❌ ルールが競合する可能性があり、プロンプトの相互作用のデバッグは経験が必要 |
| ✅ 透明性が高い — LLM が見ている内容をそのまま確認できる | ❌ 新しい知識を生み出すのではなく、既存の知識を誘導するだけ |

## 組み合わせに適したアプローチ

- **[FST ゲート付きパイプライン](./fst-gated-pipeline)** — コーチングと形態論的バリデーションを組み合わせることで、コーチング単独では見逃す問題を検出できます
- **[辞書拡張 LLM](./dictionary-augmented-llm)** — 用語の強制はコーチングの一形態です
- **[Few-Shot プロンプティング](./few-shot-prompting)** — 例とルールを組み合わせると、それぞれ単独よりも効果的です

## 関連情報

- [メソッドインターフェース](/docs/network/specifications/methods) — コーチングデータのフォーマットと TranslationMethod プロトコル
- [低リソース言語のサポート](/docs/network/community/low-resource-languages) — 全体的なコンテキスト
- [評価ハーネス](/docs/network/specifications/harness) — 実験の実行方法
