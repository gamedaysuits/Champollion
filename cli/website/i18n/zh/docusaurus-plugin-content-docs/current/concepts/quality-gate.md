---
sidebar_position: 3
title: "质量门禁"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# 质量门

每次翻译在写入磁盘前都会通过一个确定性的验证门。质量门捕捉常见的机器翻译失败模式——没有无声回退，没有垃圾数据写入你的本地化文件。

## 验证检查

| 检查项 | 捕获内容 | 门控标签 |
|-------|----------------|-----------|
| **空/空白** | 模型返回了空字符串或空白字符 | `[GATE] empty` |
| **源文本回显** | 模型返回了原始的英文输入 | `[GATE] source-echo` |
| **幻觉循环** | 重复的三元组模式（例如 `"Qo' Qo' Qo'"`） | `[GATE] hallucination` |
| **长度膨胀** | 输出明显长于源文本 | `[GATE] length` |
| **内容删除** | 输出是移除了字母的源文本 | `[GATE] content` |
| **书写系统合规性** | 目标语言环境的书写系统错误 | `[GATE] script` |
| **ICU 复数类别** | 缺少该语言环境所需的复数形式 | `[GATE] icu-plural` |

声明为 [`noTranslate`](/docs/getting-started/configuration#no-translate) 的键永远不会到达门控 —— 它们会从源文本中原样复制，因此没有任何需要验证的内容。

### 空白/空字符串

拒绝空字符串、仅空格或 `null` 的翻译。这捕捉模型对困难键返回空值的情况。

### 源文本回显

检测模型返回英文源文本而不是翻译的情况。常见于短字符串和规范不足的提示。

较短的、主要由 ASCII 字符组成的字符串（≤ 30 个字符）可豁免 —— `"Blog"`、`"GitHub"`、`"npm"` 在任何地方都合理地保持为英文，拒绝它们会导致无限循环。

较长且保持不变也是正确的值（如 URL、仓库路径、产品标识符）并不是门控的问题，也无法通过调整门控来修复：正确的答案*就是*回显，因此模型的所有可能输出都是错误的。使用 [`noTranslate`](/docs/getting-started/configuration#no-translate) 声明这些键，它们将完全绕过处理管道。默认情况下，值为 URL 的键会以这种方式处理。

### 幻觉循环

分析输出中的三字符（trigram）模式。如果任何三字符相对于输出长度重复次数超过阈值，翻译将被拒绝。这捕捉产生退化输出的情况，如 `"Qo' Qo' Qo' Qo' Qo'"`。

### 长度膨胀

拒绝输出长度超过 `maxLengthRatio × source length`（默认值：4×）的翻译。这捕捉为短输入产生大量文本的模型幻觉。

可通过配置中的 `maxLengthRatio` 配置。

### 内容删除

这是长度膨胀的镜像情况。如果模型对某个字符串缺乏词汇量，它可能会删除所有无法翻译的字母，仅保留源文本的标点符号和空格：

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

没有其他检查项能捕获到这一点。它不为空，不是回显，也不重复，并且其长度为源文本*长度*的 33%，可以轻松通过 `minLengthRatio` 检查。

该检查会比较源文本和输出之间的**内容字符**（字母和数字，忽略标点符号、空白字符和不可见的格式字符）。但不能仅凭密度作为规则，因为合法的密集型书写系统也处于完全相同的情况：

| 源文本 | 输出 | 保留的内容 | 判定结果 |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **已拒绝** |
| `Getting started` | `入门` | 14% | 已接受 |
| `Frequently asked questions` | `常见问题` | 17% | 已接受 |

任何能捕获第一种情况的阈值都会直接拒绝中文、日文和韩文。区分它们的不是保留了多少内容，而是*内容从何而来*：被掏空的输出是其自身源文本的**子序列**（可以通过删除源文本中的字符来生成），而真正的翻译与源文本基本上没有共享内容。触发标记需要**同时具备**这两个信号，因此该检查与重复检测器一样，是必要但不充分的。

可通过 `minContentRetention`（默认值为 `0.35`）按语言对或按语言进行配置。提高该值会使检查更加积极；它只会在伴随子序列信号时触发。

:::note[这是一个词汇量信号，而不是质量调节盘]
当某个目标语言反复触发此检查时，说明模型没有用于该文本的词汇 —— 通常是在词汇表封闭的语言中，简短且充满行话的字符串。放宽阈值只会恢复静默损坏；它并不能产生翻译。请修复提示词、辅导数据或语言对配置。
:::

### 脚本合规性

对于语言卡片记录为非拉丁书写系统（阿拉伯语、中日韩文字、西里尔字母等）的语言环境，验证输出是否确实包含非 ASCII 字符 —— 对于这些语言环境，仅包含拉丁字母的输出将因书写系统错误而被拒绝。

关于此检查*不是*什么，有两点澄清：

- 它**不受 `script:` 配置字段的驱动。** 该字段用于选择[书写系统转换](/docs/getting-started/configuration#script-conversion)的输出正字法；门控的预期来自语言卡片。
- 它始终验证**模型发出的工作书写系统**，且在任何书写系统转换*之前*进行。带有书写系统转换器（如 crk、sr、tlh 等）的语言环境会正确生成拉丁工作书写系统的输出，因此它们可豁免此检查；转换（如果配置中启用了的话）发生在门控之后。

## 失败时的处理

1. 失败的翻译被记录到 stderr，带有 `[GATE]` 前缀、键名、原因和值的预览
2. 该键**不会**被写入本地化文件
3. 重试级联启动（见下文）

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## 反馈重试与重试级联

被门控拒绝的键会获得**一次反馈重试**：拒绝原因会作为每个键的上下文注入到提示词中（在低温度下进行盲目重试只会返回字节完全相同的输出）。如果重试通过，该键将被写入，且同步状态为**绿色** —— 能够自我修复的门控拒绝不算作失败，这也是预期的语义。只有在重试后仍然失败的键才会被跳过、报告（同步以非零状态退出），并在下一次同步时重新尝试。

重试会通过该语言对自身的翻译方法运行，无论它是 LLM、Google Translate、DeepL 还是直接提供商。这也适用于翻译记忆库的命中项：被门控拒绝的缓存值会被驱逐，并在同一次运行中重新翻译，从而使被污染的缓存能够自我修复。

另外，当整个批处理失败（JSON 解析错误）时，champollion 会使用逐渐减小的批次进行重试：

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

重试预算由 `maxRetries`（默认值：3，每种语言可配置）限制。这防止了对持续失败的键的无限制令牌支出。

耗尽重试后，问题键被记录并跳过。它们将在下一次 `sync` 运行时重试。

## 提示缓存

系统消息（寄存器、语法规则、风格说明）与用户消息（要翻译的键）分离。这种分离是有意的：

- 系统消息对于给定的语言环境**在批次间相同**
- Anthropic 和 Google 等提供商缓存重复的系统消息
- 结果：第一个批次支付全部令牌成本，后续批次仅支付用户消息的成本

这可以显著降低具有许多批次的项目的令牌成本。

## ICU MessageFormat 验证

`integrity` 命令根据 CLDR 复数规则验证 ICU MessageFormat 复数模式。如果你的源文件使用 ICU 语法，如：

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion 验证翻译版本包含目标语言环境所需的所有复数类别。例如，阿拉伯文需要六个类别（`zero`、`one`、`two`、`few`、`many`、`other`）——而不仅仅是 `one` 和 `other`。

运行 `champollion integrity` 检查所有语言环境的复数完整性。

## 术语强制

对于带有字典的教练对，champollion 运行翻译后的术语检查。质量门通过后，它验证 LLM 是否实际使用了所需的字典术语。

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

术语违规是**警告，不是阻止错误**。翻译仍然被写入磁盘。这是有意的——LLM 可能有选择替代方案的有效理由（上下文、语法），而对术语不匹配的阻止会造成更多伤害。

要修复违规，请更新教练字典或手动编辑本地化文件。

---

## 另请参阅

- [同步工作原理](/docs/concepts/how-sync-works) — 质量门在管道中的位置
- [翻译方法](/docs/guides/translation-methods) — 输入到门的方法
- [脚本转换器](/docs/concepts/script-converters) — 门后脚本转换
- [教练数据](/docs/concepts/coaching-data) — 上游改进翻译质量
- [翻译记忆](/docs/concepts/translation-memory) — 缓存已验证的翻译
- [CLI 参考 — sync](/docs/reference/cli#sync) — sync 标志，包括重试行为
- [CLI 参考 — integrity](/docs/reference/cli#integrity) — ICU 复数审计
