---
title: "谁可以使用"
description: "用通俗的语言说明各个 Champollion 软件包的许可证——明确适用与不适用的对象。本内容仅为概述，不构成法律建议；一切以许可证正文为准。"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# 谁可以使用

Champollion 的各个软件包并未采用统一的许可证。本页面用通俗易懂的语言说明了每个软件包所适用的群体。

**本页面仅为摘要，不构成法律建议。一切以许可证原文为准。** 下表提供了各许可证的链接，且许可证原文亦随各软件包一同分发。

## 各软件包及其许可证

| 软件包 | 说明 | 许可证 |
|---|---|---|
| `champollion` (npm) | 用于翻译本地化语言包文件的 CLI | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | 为 AI Agent 提供这些工具的 MCP 服务器 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | 模型训练套件 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI；即 `mt-eval` 命令) | 评测框架 | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE)，附带[插件例外条款](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | 平原克里语评估标准插件 | 独立的临时许可证：仅限经许可使用（[发布于 PyPI](https://pypi.org/project/champollion-lyss/)） |

[代码仓库](https://github.com/gamedaysuits/Champollion)中的数据注册表（`shared/`）和数据库迁移（`mt-eval-arena/`）遵循 Apache-2.0 许可证。

## CLI、MCP 服务器与 nmt-forge

这三个组件遵循 PolyForm Noncommercial License 1.0.0。你可以出于**非商业目的**使用、修改和分发它们。许可证本身明确列出了这些目的，其中的两个条款涵盖了绝大多数情况：

> **个人使用（Personal Uses）。** 为增进公共知识而进行的个人研究、实验和测试，或用于个人学习、私人娱乐、业余爱好项目、业余活动或宗教仪式，且不预期有任何商业应用，均属于许可范围内的用途。

> **非商业组织（Noncommercial Organizations）。** 任何慈善组织、教育机构、公共研究机构、公共安全或卫生机构、环境保护组织或政府机构的使用，均属于许可范围内的用途，无论其资金来源或因资金产生的附带义务如何。

对于属于上述类型的组织，其资金来源并不影响许可结论：条款明确指出“无论其资金来源如何”（regardless of the source of funding）。

| 使用主体 | 是否适用？ | 原因 |
|---|---|---|
| 学校翻译其应用或简报 | ✓ 是 | 属于教育机构 |
| 公立医院或公共卫生诊所翻译患者就医指南 | ✓ 是 | 属于公共安全或卫生机构 |
| 慈善机构翻译其网站 | ✓ 是 | 属于慈善组织 |
| 政府机关或公共研究机构 | ✓ 是 | 属于政府机构或公共研究机构 |
| 个人用于无任何商业预期规划的个人或研究项目 | ✓ 是 | 属于用于研究、实验、测试、个人学习或业余爱好的个人使用 |
| 商店翻译其在线商城 | ✗ 否 | 营利性企业的产品属于商业用途 |
| 营利性私立诊所翻译其患者门户系统 | ✗ 否 | 营利性企业的产品属于商业用途，不属于公共卫生机构 |

商业目的不在许可范围内：本许可证未授予任何商业使用权限。

## 评测框架（`mt-eval-harness`）

该评测框架在 GNU Affero 通用公共许可证第 3 版或更高版本（AGPL-3.0-or-later）下开源。AGPL 允许商业使用，但须遵守其自身条款。主要条款包括：

- 如果你分发该框架（无论是否经过修改），必须在相同许可证下分发，并附带源代码。
- 如果你修改了该框架并通过网络向用户提供服务，你必须向这些用户提供修改版本的源代码（第 13 条“远程网络交互”）。

一项单独的授权（[LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md)，依据 AGPL 第 7 条）允许使用其他许可证的评估标准插件通过公开插件接口与该评测框架配合使用。这不会改变评测框架本身的许可证。

## 平原克里语插件（`champollion-lyss`）

`champollion-lyss` 采用独立的临时许可证：仅可在获得书面许可的情况下使用。对于非商业研究、教育以及有益于社区的用途，通常会免费授予许可。严禁任何商业使用。这是一项临时许可证，旨在后续替换为通过社区治理制定的条款。许可证原文及其 NOTICE 文件已随软件包一同分发。

## 这些许可证不涵盖的内容

你通过这些工具使用的翻译服务、模型和语料库仍遵循各自的使用条款：服务提供商的 API 条款、模型许可证、语料库许可证等。评测框架会记录每个语料库的许可证，并应用相应规则以限制哪些模型服务可以访问该语料库，但这些条款均由其所有者制定，而非本页面列出的许可证。

## 许可证原文

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)（亦见 [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)）：适用于 CLI，相同文本亦适用于 [MCP 服务器](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE)和 [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) 及其[插件例外条款](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md)：适用于评测框架
- [champollion-lyss](https://pypi.org/project/champollion-lyss/)：其临时许可证与 NOTICE 文件随软件包一同分发

本页面仅为摘要，不构成法律建议。若本页面内容与许可证原文存在出入，一律以许可证原文为准。
