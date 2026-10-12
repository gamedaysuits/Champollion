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

1. 在配置中**减小批处理大小**：
   ```json
   { "batchSize": 15 }
   ```
2. **使用速率限制更高的模型**（例如 `google/gemini-3.8-flash` 拥有宽松的限制）
3. 对大体量语言对**使用更便宜/更快速的方法** — Google Translate 没有速率限制：
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### 模型未找到 / 404 错误

直连 LLM 提供商（`openai`、`anthropic`、`gemini`）接收的是其自有的模型名称。属于其自身供应商的 OpenRouter 格式 ID 会自动为您映射（在 `gemini` 上 `google/gemini-3.8-flash` → `gemini-3.8-flash`）。如果运行终止并提示：

**"is an OpenRouter model id … which has no model by that name"** — 您使用了来自其他供应商的 OpenRouter 格式模型（在 `openai` 中使用了 `google/gemini-3.8-flash`）。未发送任何请求。请指定该提供商拥有的模型名称、使用支持该模型的方法，或切换到 `llm` 方法以使用 OpenRouter — 错误信息指出了每个选项以及该模型的配置位置：

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

它们还会在首次使用时检查您的模型名称。如果您看到警告：

**"is an Anthropic/OpenAI/Gemini model"** — 你将模型发送到了错误的提供商：

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — 模型可能已弃用或拼写错误。Champollion 会获取提供商的实时模型列表并建议替代方案。查看提供商的文档以了解当前模型名称。

:::tip[模型弃用会发生]
提供商会定期停用模型名称。如果在提供商更新后翻译突然失败，请检查 `[WARN]` 输出——它会向你显示当前的替代方案。
:::

### `local`: "could not reach …"

`local` 方法会向您本地机器上兼容 OpenAI 的服务器（Ollama、vLLM、LM Studio、llama.cpp）发送请求。当无法连接时，错误信息会指明它尝试访问的地址以及指定该地址的配置项：

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

该地址取自环境变量或 `.env.local` / `.env` 中最先设置的一项：依次为 `LOCAL_API_BASE`、`OPENAI_API_BASE`、`OPENAI_BASE_URL`。如果均未设置，则使用 Ollama 的默认地址 `http://localhost:11434/v1`。请启动服务器，或修复错误信息中提示的配置项。

## 翻译质量

### 翻译回显源语言

质量门会捕获这种情况。如果翻译与英文源相同，它会被拒绝并重试。如果问题持续：

1. **检查模型** — 某些模型在特定语言对上的表现较差
2. **添加语域指令** — 告知模型要生成的语言语域：
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **尝试其他模型** — 从 `gpt-4o-mini` 切换到 `gpt-4o` 或 `google/gemini-3.1-pro-preview`

### 错误的脚本输出（例如，日语的拉丁文本）

质量门的脚本合规性检查会捕获大多数情况。如果问题持续：

- 验证区域设置代码是否正确（`ja`，而不是 `jp`）
- 在 `register` 字段中添加显式脚本说明：
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### 人名未通过验证（例如日语中的 "Curtis Forbes"）

人名使用拉丁字母是正确的，因此请告知 Champollion 哪些是人名：

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

模型会被指示原样保留它们，并且仅由这些人名构成的文本值绝不会被报告为未翻译或文字书写系统错误。如果没有该列表，非拉丁文字语言中较短的拉丁文字值会重试一次，询问它是人名还是标签。如果模型保留了它，则会被接受为人名并缓存，因此绝不会重复计费。您不需要 `--no-verify`。

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

`.champollion.lock` 记录了每项翻译所对应的源英文文本。
像处理任何生成文件一样解决其中的合并冲突：保留任意
一方，运行 `npx champollion sync`，然后提交结果。

:::warning[删除锁定文件不会重新翻译任何内容]
没有锁定文件，sync 就无法获知自现有翻译生成以来修改了哪些英文字符串。
它只会翻译目标文件中**缺失**的键，并将当前的英文记录为新基准。
在锁定文件被删除之前编辑过的英文字符串会静默保留其旧翻译。
若要特意重新构建某个语言区域，请使用 `--force`（通过
`--pair` 限制其范围）；已缓存的翻译会被复用，因此仅对缓存中从未
出现过的文本计费。
:::

### 重新翻译特定密钥

如果单个翻译错误，你想强制重新翻译它们而不删除锁文件：

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

`--force-keys` 标志会覆盖这些特定键的锁定文件哈希检查，强制重新翻译而不影响任何其他键。`--redo keys:hero.title` 是其新名称，功能相同。当翻译记忆库包含该文本时，两者都会直接从记忆库提供翻译；若要改为重新付费翻译，请添加 `--fresh`。包含逗号的键（gettext msgid 是完整句子）可以用 `\,` 编写，并在 shell 中将参数用引号括起：`--redo 'keys:Welcome back\, %(name)s!'`。

### `verify` 报告占位符不匹配（或其他受损文本）

`champollion verify`（以及每次同步后运行的检查）会报告受损的值：丢失或被重命名的占位符、损坏的 ICU 复数形式、字母被删减的值。单纯执行 `champollion sync` **不会**修复它们。该值已存在于磁盘上，且其锁条目表明它是最新的，因此 sync 不会改动它。

每个检测项都会指明精准修复这些键的命令，例如：

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

运行该命令即可。当一个语言区域跨越多个文件时，键的表示形式为 `<file>::<key>`（例如 `common::nav.home`），这只会重新翻译该文件中的键，而不会触及其他文件。

您不需要 `--fresh`。如果受损的值来自翻译记忆库，`verify` 已经将其从缓存中移除，并会显示提示：`[TM] Evicted 1 cached translation(s) that produced damaged values`。随后的重新翻译会再次翻译该文本（或使用缓存中自身不同的翻译），而不是再次提供受损的内容。手动编辑的值绝不会被缓存，因此不会为其移除任何内容，重新翻译的执行逻辑也是一样的。

对于 Markdown/MDX 内容文件，请改用带有路径或 glob 的 `--retranslate`（例如 `--retranslate docs/intro.md`）。即使这些文件已是最新的或经过手动翻译，该命令也会全新翻译它们。使用 `--files` 可将运行范围限定在某些内容文件，而不会强制重新翻译。

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

### 切换模型或提供商后的翻译

切换方法（例如从 `llm` 切换到 `deepl`）、语域或提示指导会为重新翻译的内容生成全新翻译，因为缓存键包含了这些因素 — 但常规同步不会重新翻译任何已完成的内容，`champollion sync --redo all` 才会。在同一方法内切换**模型**则会免费复用上一个模型翻译的内容；sync 会在预估之前提示这一点。如果您需要新模型自身的翻译：

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

单独使用 `--fresh-on-model-change` 只会更改本次运行本来就会翻译的键（新增或已变更的键）：仅仅切换模型后，常规的 `sync --fresh-on-model-change` 不会发送任何请求。

有关缓存密钥设计的详细信息，请参见 [翻译记忆](/docs/concepts/translation-memory)。

## 从损坏版本恢复 {#recover-old-damage}

旧版流水线写入的值**绝不会自动修复**：它们的清单哈希值与当前源文本匹配，因此 `sync` 会认为它们已定稿，没有任何校验门禁会再次检查它们。如果您要升级一个曾运行 0.3.0 之前版本的项目，请假设语言区域文件中可能存在受损内容，并先执行审查：

```bash
champollion integrity
```

审查会检测已知损坏特征并指出对应的修复方法：

| 检测项 | 说明 | 修复方法 |
|---------|-----------|-----|
| `UNEXPECTED PUA` | 在不需要文字转换时写入的文字转换输出（pIqaD/Tengwar/Kryptonian）— 渲染为空白 | `champollion repair-script`（离线，对 pIqaD 完全精确） |
| `HOLLOWED VALUES` | 字母被删减的源文本 — 内容保留门禁引入前的输出 | 重新翻译（见下文） |
| `NO-TRANSLATE DRIFT` | 被“翻译”了的 URL 或其他原样保留键 | `champollion sync`（免费自动修复） |

对于被删减的内容 — 或任何您不再信任的语言区域 — 请对其进行重建：

```bash
champollion sync --pair en:tlh --force
```

`--force` 会为指定范围的语言对重新排队每个源文本键。翻译记忆库命中仍会被提供，但每个命中的条目都会**先经过当前门禁验证** — 被当前门禁拒绝的缓存值会被逐出并重新计费翻译，因此受污染的缓存会自动自愈，而不会继续污染重建结果。如果您无论如何都希望完全重新付费翻译，请添加 `--no-tm`，并且在任何一种情况下都可以添加 `--max-cost` 来设定开销上限。

同步后验证也会报告这些特征，因此受损的语言区域会在 `sync` 时明确报错（并指明修复方法），而不会悄无声息地发布上线。

### `--no-tm` 清理后的一次性重新排队 {#one-time-requeue}

如果您的恢复操作使用了 `--no-tm`，**下一次**同步预计会排队一批您原本以为已定稿的源文本回显键。`--no-tm` 写入值时不会将其盖章存入翻译记忆库，而一个与源文本完全相同且*未被盖章*的值与未翻译的值无法区分 — 因此它会重新排队一次，返回结果（通常与源文本相同），完成盖章，并永久定稿。这是一次性开销，而非死循环。可以通过以下命令预览具体的键：

```bash
champollion sync --dry --list-keys
```

## 仍然卡住？

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — 搜索现有问题或提交新问题
- **[架构文档](/docs/concepts/architecture)** — 了解系统设计
- **[质量门](/docs/concepts/quality-gate)** — 验证如何在幕后工作
