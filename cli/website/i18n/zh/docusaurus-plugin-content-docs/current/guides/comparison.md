---
sidebar_position: 7
title: "对比"
---

# Champollion 的对比

champollion 与大多数本地化工具属于不同的类别。以下是诚实的对比。

## 市场格局

大多数本地化工具分为以下三类之一：

| 类别 | 示例 | 模式 |
|----------|----------|-------|
| **云 TMS 平台** | Crowdin、Phrase、Locize、Tolgee | SaaS 仪表板 + 人工翻译 + 月度订阅 |
| **密钥提取工具** | i18next-scanner、FormatJS CLI | 扫描源代码中的翻译函数调用 |
| **CLI 翻译引擎** | **champollion** | 在项目中运行，直接翻译文件，无需云账户 |

Champollion 是一个 **CLI 翻译引擎** — 它使用可配置的后端（LLM、Google Translate、自定义插件）直接翻译你的语言文件。无云仪表板、无人工翻译工作流、无月度费用。

---

## 功能对比

| 特性 | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **本地运行（无需云账号）** | ✅ | ❌ | ❌ | ❌ |
| **极简依赖** | ✅ | ❌ | ❌ | ❌ |
| **按语言对配置方法** | ✅ | ❌ | ❌ | ❌ |
| **自定义语言语域** | ✅ | ❌ | ❌ | ❌ |
| **内容感知（保护代码块）** | ✅ | ❌ | ❌ | ❌ |
| **人造语言与文字转换** | ✅ | ❌ | ❌ | ❌ |
| **插件架构** | ✅ | ❌ | ❌ | ❌ |
| **Markdown / 内容翻译** | ✅ | ✅ | ✅ | ❌ |
| **翻译记忆库** | ✅ | ✅ | ✅ | ✅ |
| **XLIFF 导出/导入** | ✅ | ✅ | ✅ | ❌ |
| **ICU 复数验证** | ✅ | ✅ | ✅ | ❌ |
| **术语强制执行** | ✅ | ✅ | ✅ | ❌ |
| **人工翻译工作流** | 基于 XLIFF | ✅ | ✅ | ✅ |
| **上下文编辑（可视化）** | ❌ | ✅ | ✅ | ✅ |
| **团队协作** | ❌ | ✅ | ✅ | ✅ |
| **文件格式支持** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **定价** | 非商业用途免费（仅需支付 LLM 费用） | $0/月起 | $0/月起 | $0/月起 |

---

## 何时使用 Champollion

**Champollion 适合以下情况：**

- 你想将机器翻译集成到构建管道中 — 而不是单独的工作流
- 你需要按语言的方法控制（某些语言用 LLM，其他用 Google Translate，其余用自定义插件）
- 你要翻译到没有 API 覆盖的语言（土著语言、濒危语言、构造语言）
- 你想要确定性的文字输出（Cree 音节文字、克林贡 pIqaD、Tengwar）
- 你想要零供应商锁定和零云依赖
- 你是独立开发者或小团队，不需要完整的 TMS 仪表板
- 你想要基于 XLIFF 的专业翻译交接，无需云订阅

**云 TMS 更适合以下情况：**

- 你有专业人工翻译审查每个字符串（champollion 的 XLIFF 工作流比完整 TMS 更简单）
- 你需要跨项目翻译记忆库和术语表管理
- 你需要上下文可视化编辑（在你的 UI 中预览翻译）
- 你有大型团队，需要基于角色的访问控制
- 你需要 50+ 文件格式支持

---

## Champollion 独有的功能

### 1. 自定义寄存器

每个语言对都获得文化上适当的 LLM 语气指导：

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

没有其他工具提供 47 个预配置的语言寄存器，或让你为每个项目定义自定义寄存器。

### 2. 确定性文字转换器

Champollion 附带五个内置文字转换器，作为翻译后处理钩子运行 — 无需 LLM：

| 语言环境 | 转换 | 示例 |
|--------|-----------|---------|
| `crk` | SRO → Cree 音节文字 | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | 拉丁字母 → 西里尔字母 | `Beograd` → `Београд` |
| `tlh` | 罗马化 → pIqaD | `tlhIngan Hol` → (pIqaD 字形) |
| `x-elvish-s` | 拉丁字母 → Tengwar | Sindarin → Tengwar（Beleriand 模式） |
| `x-kryptonian` | 拉丁字母 → 氪星文 | 密码替换（需要字体） |

这些是纯查找表转换器 — 确定性、可审计、零 LLM 幻觉风险。

### 3. 内容感知保护

翻译 Markdown 或富文本内容时，Champollion 保护：

- 围栏代码块（` ``` `）
- 内联代码（`` ` ` ``）
- Hugo 短代码（`{{</* */>}}`、`{{%/* */%}}`）
- 插值变量（`{{ .Count }}`、`{name}`、`{{t('key')}}`）
- 原始 HTML 块

这些在翻译前被替换为 Unicode 哨兵令牌，之后恢复。LLM 永远看不到你的代码、你的短代码或你的变量。

### 4. 指导方法插件

对于没有 API 覆盖的语言，你可以构建一个指导翻译方法：

1. 编写语言学指导数据（语法规则、词汇、示例）
2. 将其打包为插件
3. 使用 [eval 工具](https://github.com/gamedaysuits/Champollion) 针对参考翻译进行基准测试
4. 使用 `champollion plugin install` 在你的项目中安装它

这是 champollion 处理 Plains Cree 的方式 — 也是你处理任何语言（包括尚不存在的语言）的方式。

---

## 总结

Champollion 不是 Crowdin 的替代品。它是不同工作流的不同工具。如果你需要人工翻译，使用 TMS。如果你需要一个 CLI，用一个命令翻译你的文件，并让你对方法、模型和寄存器进行按语言控制 — 使用 champollion。
