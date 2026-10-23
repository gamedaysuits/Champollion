---
title: "参考"
slug: /reference
description: "一览所有技术细节：命令、文件格式、规范、技术限制、托管封闭测试、排行榜、应用与网站翻译、Atlas 以及网络基础设施。"
---

# 参考

面向开发者、研究人员和 AI Agent 的完整技术记录。
[面向公众的页面](/docs/)用通俗的语言讲述了同样的内容，
而 [Agent 手册](/docs/agents)则说明了 Agent 如何驱动它；下方
的每个页面都以极其精确的规范进行了阐述。

## 命令

- [`champollion`](/docs/reference/cli) —— 项目工具与应用及网站翻译器的所有命令和标志。
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) —— 模型训练套件的所有命令，由其解析器自动生成。
- [`mt-eval`](/docs/reference/mt-eval) —— 评测框架的所有命令，由其解析器自动生成。
- [MCP 服务器](/docs/network/getting-started/mcp-server) —— 两种配置文件、所有工具及所有参数。

## 格式

- [框架格式](/docs/reference/formats) —— project/1、set/1、method/1、gate-chain/1、deployment/1 和 service-api/1，源自各自的模式定义。
- [运行卡片](/docs/network/specifications/run-card) —— 经过评分的运行所记录并发布的内容。
- [辅导数据](/docs/concepts/coaching-data) —— 提供给 LLM 方法的语法注释与词表。
- [插件规范](/docs/reference/plugin-spec) —— 翻译方法所附带的方法插件清单（`method.json`）。
- [语言卡片](/docs/reference/language-card-spec) —— Atlas 中卡片的模式定义。

## 规范

- [评分](/docs/network/specifications/scoring) —— scoring standard/1：语料库 chrF++ 首要指标及其 95% 自助区间、附带的标准指标，以及独立分开的诊断指标。
- [显著性](/docs/network/specifications/significance) —— 配对检验，以及何时一次运行优于另一次运行。
- [方法接口](/docs/network/specifications/methods) —— 方法的定义、其类与依赖项。
- [指标可靠性](/docs/network/specifications/metric-reliability) —— 根据人工评判，针对哪类语言该信任哪种指标。
- [基准测试](/docs/network/specifications/benchmark) —— 每次有效运行所遵循的协议。
- [评测框架](/docs/network/specifications/harness) —— `mt-eval` 如何运行、评分和发布。
- [母语者验证](/docs/network/specifications/speaker-validation) —— 自动评分所代表的人工审核。

## 技术局限

- [技术局限](/docs/network/honest-limitations) —— 本项目不做承诺的内容：自主声明的信任等级、尚无母语者审核、密封测试集的保管，以及不支持逐句置信度。

## 举办封存测试

- [举办主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest) —— 确保测试集永不离开主办方机器的端到端操作手册。
- [主权评测节点](/docs/network/sovereignty/sovereign-eval-node) —— 评分机器：硬件、物理隔离与密钥仪式。
- [注册语料库](/docs/network/sovereignty/registering-corpora) —— 您所持有语料库的公开层级与许可通道。
- [所有权与条款](/docs/network/sovereignty/ownership-transfer)与[条款模板](/docs/network/sovereignty/terms-templates) —— 参赛作品所转让的权益，在任何人参赛前即已声明。
- [奖项](/docs/network/specifications/prizes) —— 赞助方若设立奖项所需满足的要求。

## 排行榜与发布

- [排行榜与发布](/docs/reference/leaderboard) —— 排行榜的定义、两类基准测试，以及已发布的运行包含的内容。
- [提交规则](/docs/network/leaderboard/rules) —— 准入条件、取消资格的情况以及验证层级。
- [评测数据集](/docs/network/leaderboard/datasets) —— 已注册的数据集及其许可通道。
- [提交方法](/docs/network/getting-started/submit-a-method) —— 运行评测框架并发布运行卡片。
- [贡献算力](/docs/network/getting-started/contributing-compute) —— 使用您自己的密钥运行公开队列中的项目。
- [常见问题](/docs/network/getting-started/faq) —— 指标、模型、FST 与取消资格。

## 应用与网站翻译

- [应用与网站翻译](/docs/intro) —— `champollion sync` 的功能，以及相关各页面的指南：快速上手、安装、配置、框架、CI/CD、方法、内容、翻译记忆库、质量门禁、安全、脚本、翻译器和故障排除。

## Atlas

- [Atlas](/docs/atlas) —— 语言索引的定义及其事实来源。
- [语言卡片规范](/docs/reference/language-card-spec)与[引用流程](/docs/reference/language-card-citation-procedure) —— 每个字段及其引用方式。
- [何为语言](/docs/network/context/what-counts-as-a-language) —— 索引给出的答案及其原因。
- [提交至索引](/docs/network/getting-started/submit-to-the-index)与[报告错误](/docs/network/perspectives/reporting-errors-and-owning-corrections) —— 提议新增条目或提交更正。

## 网络基础设施

- [队列构建](/docs/network/specifications/queue-construction)与[为何这样构建队列](/docs/network/perspectives/why-the-queue) —— 公共工作队列如何排定接下来测量的优先顺序。
- [连接强度](/docs/network/specifications/connection-strength) —— 网络拓扑图上的弧线代表哪种语言对关系，以及已废弃的强度梯度。
- [贡献算力](/docs/network/getting-started/contributing-compute) —— 运行队列任务。
