---
sidebar_position: 4
title: "安全性"
---

# 安全与防护

Champollion 设计用于在对抗性环境中安全运行——区域设置数据可能来自不受信任的源、精心构造的文件名可能逃逸目录边界、LLM 输出可能包含任何内容。

## 威胁模型

| 威胁 | 攻击向量 | 缓解措施 |
|--------|--------------|-----------|
| **原型污染** | 精心构造的 JSON 键（`__proto__`、`constructor`） | 在解析时拒绝 |
| **路径遍历** | 区域代码如 `../../etc/passwd` | 文件写入验证到配置的目录 |
| **代码块损坏** | LLM 在代码围栏内翻译 | Unicode 哨兵屏蔽 |
| **幻觉键** | LLM 返回未发送的键 | 响应验证——仅接受的键被写入 |
| **失控的令牌支出** | 无限重试循环 | 通过 `maxRetries` 进行预算限制 |

## 原型污染防护

所有区域键在处理前都针对黑名单进行验证：

- `__proto__`
- `constructor`
- `prototype`

任何匹配这些模式的键都会被拒绝并返回错误。这可防止攻击者使用精心构造的区域文件来修改 JavaScript 对象原型。

## 路径隔离

写入区域文件时，champollion 验证输出路径保持在配置的目录内（`localesDir`、`contentDir`）。区域代码被清理——如 `../../secrets` 这样的代码无法写入预期目录之外。

## 块保护

在翻译 Markdown 内容期间，结构化元素在文本发送到 LLM 之前被替换为 Unicode 哨兵占位符：

1. **代码块**（围栏式和内联式）→ 哨兵
2. **Hugo 短代码**（`{{< >}}`、`{{% %}}`）→ 哨兵
3. **原始 HTML** → 哨兵
4. **插值变量**（`{{ .Count }}`）→ 哨兵

翻译后，哨兵被替换为原始内容。LLM 永远看不到代码块、短代码或 HTML——它无法损坏它们。

## 响应验证

当 LLM 返回 JSON 响应时，champollion 验证：
- 批次中发送的键才会出现在响应中
- 没有额外的键被注入
- 响应解析为有效的 JSON

幻觉键被静默丢弃。这可防止 LLM 输出向区域文件注入意外的翻译。

## 质量门

每个翻译在写入磁盘前都通过五个确定性检查进行验证。详见[质量门](/docs/concepts/quality-gate)。

## 指数退避

API 调用在 429（速率限制）和 5xx（服务器错误）响应上使用带抖动的指数退避。三次重试且延迟递增可防止在中断期间频繁调用 API。

## 请求超时

每个 API 请求都有 30 秒的超时时间，通过 `AbortController` 实现。这可防止同步过程在死连接上无限期挂起。

## 大声失败的翻译失败

当 API 不可用或翻译失败时，champollion 会抛出带有可操作指导的大声错误，而不是静默写入垃圾。同步期间永远不会写入任何 `[EN]` 前缀的占位符。

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

一个文件的失败不会停止整个同步——错误被记录，管道继续处理下一个文件，因此每次运行都能获得最大进度。

## 同步后验证

所有翻译完成后，champollion 从磁盘重新读取写入的区域文件并运行验证过程。这可捕捉同步报告成功与翻译实际错误之间的间隙：

- **键奇偶性** — 每个目标中存在所有源键
- **`[EN]` 标记** — 来自先前运行的旧版回退标记
- **空翻译** — 漏过的空白值
- **脚本合规性** — 非拉丁文区域设置仅包含 ASCII 翻译
- **占位符保留** — ICU 占位符与源匹配

使用 `--no-verify` 跳过或使用 `npx champollion verify` 独立运行。

## 测试

安全属性由对抗性测试套件验证：

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## 另见

- [架构](/docs/concepts/architecture) — 三部分生态系统如何连接
- [CLI 参考 — 完整性](/docs/reference/cli#integrity) — 完整性检查命令
- [CLI 参考 — 来源](/docs/reference/cli#provenance) — 来源审计命令
- [插件规范](/docs/reference/plugin-spec) — 插件清单中的来源字段
- [质量门](/docs/concepts/quality-gate) — 翻译级别的安全检查
