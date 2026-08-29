---
sidebar_position: 6
title: "故障排除"
---

# 故障排除

Champollion 的常见问题和解决方案。

## API 和身份验证

### "OPENROUTER_API_KEY not found"

Champollion 需要 API 密钥来进行 LLM 翻译。将其设置为环境变量：

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

或在 `.env` 文件中（如果你的项目加载 `.env` 文件）：

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
如果你只有 Google Translate API 密钥，champollion 会自动检测并使用 Google Translate 作为默认方法。无需更改配置。
:::

### OpenRouter 返回 "401 Unauthorized"

你的 API 密钥无效或已过期。在 [openrouter.ai/keys](https://openrouter.ai/keys) 验证。

### "429 Too Many Requests" / 速率限制

Champollion 使用指数退避在内部处理速率限制。如果你持续遇到速率限制：

1. **减少配置中的批处理大小**：
   ```json
   { "batchSize": 15 }
   ```
2. **使用速率限制更高的模型**（例如，`google/gemini-3.5-flash` 有慷慨的限制）
3. **对高容量对使用更便宜/更快的方法** — Google Translate 没有速率限制：
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### 模型未找到 / 404 错误

直接 LLM 提供商（`openai`、`anthropic`、`gemini`）在首次使用时验证你的模型字符串。如果你看到警告：

**"looks like an OpenRouter path"** — 你在直接提供商中使用了 OpenRouter 格式的模型（`google/gemini-3.5-flash`）。直接提供商使用裸模型名称：

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

或切换到 `llm` 方法来使用 OpenRouter：
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — 你将模型发送到了错误的提供商：

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — 模型可能已弃用或拼写错误。Champollion 会获取提供商的实时模型列表并建议替代方案。查看提供商的文档以了解当前模型名称。

:::tip[模型弃用会发生]
提供商会定期停用模型名称。如果在提供商更新后翻译突然失败，请检查 `[WARN]` 输出——它会向你显示当前的替代方案。
:::

## 翻译质量

### 翻译回显源语言

质量门会捕获这种情况。如果翻译与英文源相同，它会被拒绝并重试。如果问题持续：

1. **检查模型** — 某些模型对特定语言对的表现不佳
2. **添加寄存器说明** — 告诉模型要生成什么语言：
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **尝试不同的模型** — 从 `gpt-4o-mini` 切换到 `gpt-4o` 或 `google/gemini-2.5-pro`

### 错误的脚本输出（例如，日语的拉丁文本）

质量门的脚本合规性检查会捕获大多数情况。如果问题持续：

- 验证区域设置代码是否正确（`ja`，而不是 `jp`）
- 在 `register` 字段中添加显式脚本说明：
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### 输出中的幻觉模式

重复的三元组模式（例如，"hello hello hello"）由幻觉循环检测器捕获。如果输出是乱码但通过了检测器：

1. **减少批处理大小** — 较小的批处理会产生更集中的输出
2. **使用更强大的模型** — 较大的模型在非拉丁脚本上的幻觉较少
3. **添加教练数据** — 字典术语锚定翻译

## 文件和格式问题

### "No locale files found"

Champollion 自动检测区域设置文件。如果找不到：

1. **检查 `localesDir`** — 必须指向包含区域设置文件的目录：
   ```json
   { "localesDir": "./locales" }
   ```
2. **检查文件命名** — 文件必须按区域设置代码命名：`en.json`、`fr.json` 等。
3. **检查格式** — 支持的格式：JSON、嵌套 JSON、YAML、TOML

### 锁文件冲突

如果 `.champollion.lock` 处于不良状态：

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
删除锁文件意味着下次同步将重新翻译所有密钥，而不仅仅是更改的密钥。这对大型项目有 API 成本影响。
:::

### 重新翻译特定密钥

如果单个翻译错误，你想强制重新翻译它们而不删除锁文件：

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

`--force-keys` 标志覆盖这些特定密钥的锁文件哈希检查，强制重新翻译而不影响任何其他密钥。

### 内容翻译破坏代码块

这不应该发生 — 代码块在翻译前被屏蔽。如果发生：

1. 验证代码块使用标准围栏（三个反引号）
2. 检查源 Markdown 中是否有未关闭的代码块
3. 提交问题 — 这是哨兵屏蔽系统中的错误

## CLI 问题

### `--watch` 不检测更改

文件监视使用 Node.js 原生 `fs.watch`。已知问题：

- **网络驱动器** — `fs.watch` 在 NFS/SMB 挂载上不能可靠工作
- **Docker 卷** — 使用轮询模式或在容器内运行 champollion
- **大型目录** — 监视器递归监视 `localesDir`；非常深的树可能超过操作系统限制

### `npx` 运行旧版本

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

或全局安装：

```bash
npm install -g champollion
champollion sync
```

## 性能

### 多种语言的同步速度慢

Champollion 默认并行翻译所有区域设置。如果同步仍然很慢：

1. **对高容量对使用 Google Translate** — 它比 LLM 翻译快 10–50 倍
2. **增加批处理大小**（默认为 80）：
   ```json
   { "batchSize": 120 }
   ```
3. **调整并发** — JSON 区域设置并行性默认为 200，内容为 48。如果你的 API 提供商支持更高的速率限制：
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **使用快速模型** — `gpt-4o-mini` 明显比 `gpt-4o` 快

### 高 API 成本

- **检查批处理大小** — 较大的批处理 = 较少的 API 调用 = 较低的成本
- **使用翻译记忆** — TM 默认启用。运行 `champollion tm stats` 验证它是否工作。如果多次同步后看到 0 个条目，你的 `.champollion/` 目录权限可能有问题
- **使用提示缓存** — Champollion 分割系统/用户消息以在 Anthropic 和 Google 模型上获得缓存命中
- **对第 2 层语言使用 Google Translate** — 参见 [翻译 30 种语言](/docs/tutorials/translate-30-languages) 食谱

### 切换提供商后的陈旧翻译

如果你从一种翻译方法切换到另一种（例如，`llm` 到 `deepl`），TM 缓存可能仍然为源文本未更改的密钥提供来自前一种方法的旧翻译。缓存密钥包括方法名称，所以大多数情况会自动处理。但如果你在同一方法中更改了 `model`：

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

有关缓存密钥设计的详细信息，请参见 [翻译记忆](/docs/concepts/translation-memory)。

## 从错误版本中恢复 {#recover-old-damage}

旧版流水线写入的值**永远不会自我修复**：它们的清单哈希值与当前源匹配，因此 `sync` 会认为它们已处理完毕，任何网关（gate）都不会再检查它们。如果你正在升级一个运行过 0.3.0 之前版本的项目，请假设你的本地化文件中可能存在损坏，并首先进行审计（audit）：

```bash
champollion integrity
```

审计会检测已知的损坏特征，并为每种情况指明修复方法：

| 发现的问题 | 问题描述 | 修复方法 |
|---------|-----------|-----|
| `UNEXPECTED PUA` | 在不需要转换时写入的文字转换输出（pIqaD/Tengwar/Kryptonian）——渲染为空白 | `champollion repair-script`（离线，针对 pIqaD 精确修复） |
| `HOLLOWED VALUES` | 删除了字母的源文本——内容保留网关引入之前的输出 | 重新翻译（见下文） |
| `NO-TRANSLATE DRIFT` | 被“翻译”的 URL 或其他应原样保留的键 | `champollion sync`（自动免费修复） |

对于被掏空的值（hollowed values）——或者任何你不再信任的本地化语言——请重建它：

```bash
champollion sync --pair en:tlh --force
```

`--force` 会将指定语言对的所有源键重新排队。翻译记忆库（Translation Memory）的命中项仍会被使用，但每个命中项**首先会经过当前网关的验证**——现在被网关拒绝的缓存值将被驱逐并重新计费，因此被污染的缓存会自我修复，而不是继续用于重建。如果你无论如何都想要完全重新计费的全新翻译，请添加 `--no-tm`，并使用 `--max-cost` 来限制这两种情况下的开销。

同步后验证也会报告这些特征，因此损坏的本地化文件会在 `sync` 时大声报错（并指明修复方法），而不是悄无声息地发布。

### `--no-tm` 清理后的一次性重新排队 {#one-time-requeue}

如果你的恢复操作使用了 `--no-tm`，请注意**下一次**同步时，会将一批你以为已经处理完毕的源回显键（source-echo keys）排队。`--no-tm` 写入值时不会将它们标记（stamp）到翻译记忆库中，而一个与其源文本完全相同的*未标记*值，与未翻译的值是无法区分的——因此它会重新排队一次，返回（通常是相同的值），被标记，然后永久稳定下来。这是一次性成本，而不是死循环。你可以使用以下命令准确预览哪些键会被排队：

```bash
champollion sync --dry --list-keys
```

## 仍然卡住？

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — 搜索现有问题或提交新问题
- **[架构文档](/docs/concepts/architecture)** — 了解系统设计
- **[质量门](/docs/concepts/quality-gate)** — 验证如何在幕后工作
