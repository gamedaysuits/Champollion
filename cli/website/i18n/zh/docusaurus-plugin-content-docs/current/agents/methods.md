---
title: "方法与门控"
slug: /agents/methods
description: "所有 Champollion 工具读取 method/1 与 gate-chain/1 的具体方式，以 FST 有效性门控作为实操示例，以及除默认训练模型之外的方法配方——引导式 LLM、少样本、词典增强、基于规则的混合模式、链式、部分翻译和微调——并详细说明各自向何处发送何种内容。"
---

# 方法与门控

**方法**（method）指任何执行翻译的实体：训练好的模型、带提示词的 LLM、词典查词、规则引擎、服务、人工。**门控**（gate）是位于方法输出与最终交付内容之间的检查机制。本轨道的默认方法是使用 nmt-forge 训练的模型（[训练](/docs/agents/training)）；本页介绍了两者的编写格式以及其他配方。

以下每个配方均遵循[传输规则](/docs/agents/data-rules)：**调用模型提供商的方法会将文本发送给该提供商**，而仅限本地（local-only）、封存（sealed）或需许可（consent-required）的文件会拒绝此类调用。

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`。必填项：`id`
（连字符连接的小写单词）、`name`、`kind` —— 加上该类别所需的那项配置，由读取器在两个运行时中使用相同的信息进行检查。

| `kind` | 必需配置 | 运行环境 | 文本发送至 |
|---|---|---|---|
| `llm` | `model`（精确 ID，绝非别名）；可选 `provider` | CLI；测试框架通过 `-m` 与 `--provider` | 提供商 |
| `llm-coached` | `model`；辅导内容放入 `coaching`（`file`、`prompt` 或 `dir`） | CLI；测试框架通过 `-m` 与 `--coaching-file` | 提供商：句子与辅导提示 |
| `mt-api` | `engine`（源自 `shared/method-registry.json`） | CLI；测试框架 | 该引擎的服务 |
| `local-model` | `model`（Hugging Face ID 或本地文件夹） | 测试框架，进程内 | 无 |
| `nmt-checkpoint` | `model_dir` | 通过其服务（`nmt-forge serve`） | 本机服务器 |
| `lexicon` | `dictionary` | 测试框架，进程内 | 无 |
| `python` | `entry_point`（`module:Class`） | 测试框架（`mt-eval run --method <folder>`） | 插件发送到的任何地方（`dependency_class`） |
| `service` | `service.endpoint` | CLI（`api` 方法） | 该端点 |
| `human` | — | 人工；使用 `mt-eval test` 对其输出评分 | — |

可选项：`version`、`description`、`author`、`pairs`（`{source?, target}`）、
`decode`（`temperature` 0–2、`batch_size`、`max_tokens`）、`card`（排行榜显示内容）、`dependency_class`（`S` 独立自足、`O` 开放外部、
`A1`/`A2` 依赖 API、`X` 封闭）、`evidence`（实测运行：`dataset`、
`metric`、`score`、`ci`、`n` —— 仅限数字）、`runtimes`（`cli`、`engine`）。

**method.json 的来源：**项目中的 `methods/<id>/method.json`；
`nmt-forge export`（类别 `nmt-checkpoint`）；`mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`）。旧版格式（带有
`type` 的 CLI 插件清单，带有 `entry_point` 的测试框架插件清单）仍可作为
method/0 读取，但会附带警告。带有 `$schema` 的文档将按
method/1 读取，且必须通过验证。

**各运行时支持的类别。**CLI 会拒绝 `python`、`lexicon`、
`local-model` 和 `human`（*“在评测引擎 (mt-eval run --method) 中运行，
而非在 champollion CLI 中运行 —— 或者将其部署为服务并通过其端点使用”*）。
测试框架的 `--method <folder>` 仅加载 `python`；对于任何其他类别，它会
提示改用哪些标志来运行。

**解码。**默认采样温度为 **0**（`shared/model-defaults.json`）：
应用翻译时与测试框架评测时采用统一数值，确保所测即所发 —— `mt-eval run --temperature` 默认使用该值。
语言对、配置或具体运行可以自行设定该值。
模型 ID 必须是精确 slug，绝不能使用别名。

## 门控链

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`，位于
`gates/` 中的单个文件。必填项：`id`、`gates`（一个或多个）。可选项：`description`、
`fallback`。

每个门控包含：`id`、`kind`（`metric-threshold`，唯一类别）、`metric`（指标插件名称）、`field`（该插件逐句段结果中的键 —— 数字，或读取为 1/0 的 true/false）、`min` 和/或 `max`、`on_refuse`。

**规则**（`arena/mt_eval_harness/gates.py`）：

- 门控按顺序运行；**第一个**拒绝某句段的门控决定最终交付的内容：

  | `on_refuse` | 交付内容 | 计为 |
  |---|---|---|
  | `drop` | 无 | 已拒绝 |
  | `keep-source` | 源文本 | 已拒绝 |
  | `flag` | 输出内容，带有标记 | 已标旗，未拒绝 |
  | `fallback` | 回退项的翻译（若相同门控接受）；若再次被拒，则无 | 已拒绝 |

- **锁定。**插件无法评分的句段会被拒绝（`no_value` 或
  `plugin_error:<type>`）—— 绝不假定通过并交付。
- **锁定。**若门控的插件未加载或在此处无法评分，则在翻译任何内容前终止运行：*“无法判定的门控绝不会被视为通过”*。
- **锁定。**回退项必须在此进程内运行（`lexicon`、`local-model`，
  或声明了 `dependency_class` `S` 或 `O` 的插件），确保被拒绝的句段不会发送至任何外部环境。
- **锁定。**`mt-eval run` 与 `mt-eval test` 会拒绝包含 `fallback`
  门控的链：*“回退项仅用于服务部署与翻译，绝不用于测量：否则在单一名称下的得分将一部分归属于该方法，一部分归属于回退项”*。应将回退项作为单独的方法进行测量。
- **门控适用的位置：**`mt-eval run --gates`、`mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`、
  `mt-eval serve --gates` 以及部署的 `gates`。
- 在测量中，主指标衡量交付内容的分数；未受门控约束的 chrF++ 和拒绝率附带显示，且门控链的指纹（其规范 JSON 的 sha256）随报告一同保存（[测量](/docs/agents/measurement#gated-measurement)）。
  使用 `keep-source` 时，在交付源文本之处，主指标将对源文本进行评分。
- **锁定。**每个门控都需要 `min` 和/或 `max`，门控 ID 必须唯一，且
  `fallback` 门控需要链的 `fallback` —— `champollion validate` 与测试框架给出相同的裁决。针对被拒绝的句段附带门控原因进行重试的功能尚未构建。

## 实例详解：FST 有效性门控

有限状态分析器（FST）用于判定某个词是否为该语言中构词正确的合法词。测试框架的指标插件 `giellalt_fst_validity` 会按句段报告 `fst_total_words`、`fst_valid_words`、`fst_invalid_words` 和
`fst_validity_rate`（0–1）。分词按空格进行，并去除边缘标点符号；首字母大写的词会尝试以全小写再次匹配。

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- 该分析器**不随附捆绑**：测试框架仅附带固定版本信息（每个语言的文件名与 sha256），`setup --lang` 会在上游条款许可下，从上游拉取分析器至 `~/.mt-eval/fsts/<code>/`。它作为独立工具运行，绝不链接到 `champollion` CLI 中。
- 缺失分析器绝不会被记为零分：作为指标时，它被标记为未计算；作为门控时，它会终止运行。
- 空输出得分为 0，且在低于 `min` 时被拒绝。
- 若要在服务中使用它，请使用 `on_refuse: "fallback"` 和诸如
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` 的 `fallback` —— 仅适用于
  `translate` 和 `serve`。
- **注意。**FST 接受仅代表某个词存在，并不代表句意正确。它是一项诊断指标：绝不会计入 chrF++ 主评分中。

## 各种配方

### 辅导式 LLM（`llm-coached`）

使用社群指导意见（语法要点、风格、术语）进行提示的通用模型。

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **在测试框架中**，辅导文件的文本*即为*完整的系统提示词，
  因此必须说明要翻译的内容并要求仅输出翻译结果。
  `--glossary` 是评分输入（术语遵循度），绝不会被发送。
- **锁定。**测试框架运行只能有一种辅导配置：`--coaching-file`、`--coaching`
  （内联文本）或旧版的 `--custom-prompt` —— 仅需指定其一。两者同时提供将被拒绝：*“--coaching-file 与 --coaching 均用于为运行提供辅导内容 —— 请仅指定其一（将内联文本写入文件，或移除文件）”*。
- **在 CLI 中**，`llm-coached` 会发送自己的提示词，将辅导内容作为“Coaching guidance”块，并附带 `.champollion/coaching/<locale>.json`
  （`grammar_rules`、`style_notes`、`dictionary`）。
- **注意。**这是两种不同的提示词：在测试框架中测量的辅导得分并非 CLI 实际交付使用的完全相同的提示词。在引用其中之一作为另一方的依据时，请明确说明这一点。
- **发送内容：**向提供商发送每个源句以及完整的辅导内容。带有仅限本地边车（sidecar）的辅导文件仅可在环回端点上运行（`champollion data mark coaching.md --local-only` 用于标记此项）。

### 少样本（Few-shot）

辅导内容中包含的优秀翻译范例。它本质上是辅导式 LLM：命令相同，传输方式相同 —— 范例在系统提示词中传递给提供商。

- **注意。**绝不要从测试集中抽取范例，向远程提供商发送时也绝不要从仅限本地的文件中抽取。系统不会自动将少样本范例与测试参考译文进行比对检查。

### 词典增强型 LLM

- **CLI：**针对每个批次中匹配到的术语（不区分大小写的子字符串匹配），`.champollion/coaching/<locale>.json` 中的 `dictionary` 会作为“REQUIRED TERMINOLOGY”发送给所有 LLM 方法。DeepL 会将其作为术语表接收。翻译完成后会对违规项发出警告；没有重试机制。
- **测试框架：**词典仅作为辅导文件中的文本传递给模型。
- **纯词典查词：**`mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` —— 最长短语优先，保留未登录词，进程内运行。在开发集上的测试即为 `nmt-forge floor`
  （[测量](/docs/agents/measurement#the-dictionary-floor)）。
- **发送内容：**词典的匹配词条连同句子一起发送给提供商。仅限本地的词典绝不能发送给远程提供商。

### 基于规则的混合方法

未内置规则引擎。现有支持包括：`lexicon`（确定性，进程内）；`mt-eval run --method apertium`（基于规则的引擎 —— 它会将文本发送至 `apertium.org`，除非 `APERTIUM_API_URL` 指向您自己的服务器）；以及用于自定义规则的 `python` 插件，可选搭配 LLM。插件类需要 `async def translate(self, entries, config)`；使用 `mt-eval run
--method <folder>` 运行它。使用门控链验证其输出。

- **发送内容：**插件调用的任何目标。插件属于外部方法：在需许可或封存的语料库（包括仅限本地）上，测试框架会拒绝运行它，除非指定 `--attest-local-transport` —— 您只有在确认其调用的所有服务均位于本机后，方可传递此参数。

### 链式方法

内置了两种链：

1. **门控链的回退项：**方法 → 门控 → 进程内回退项 → 相同的门控。仅适用于 `translate` 和 `serve`。
2. **CLI 的语言对回退**（应用语言对上的 `"fallback": {"method": …}`）：主方法 → CLI 的质量门控 → 附带门控反馈进行重试（LLM 方法，或声明了 `acceptsInstructions` 的 `api` 端点）→ 执行一次回退项，并通过相同的门控。

任何更长的链条（跨模型生成、编辑、验证）均应作为 `python`
插件或 `service` 实现。

- **发送内容：**链中的每个环节按其类别规则发送内容。整条链的私密性取决于其中私密性最低的环节。

### 人机协同半自动翻译

模型起草初稿；母语者检查并修正。在轨道中这就是完善轮次：`champollion improve sheet` 起草初稿，母语者标记 `Y`/`N`/`?`，
`champollion improve marks` 将修正内容和确认的初稿转化为训练句对，并将练习行转化为开发集句子（[辅导](/docs/agents/coaching)）。
要将人工翻译本身作为一种方法进行评分（`kind` `human`），请对其输出运行 `mt-eval test`。带有 `on_refuse: "flag"` 的门控会将输出标记为待人工审核。

- **注意。**用于辅导或训练某个方法的句子，绝不能用于对该方法进行评分。
- **发送内容：**除起草模型自身的规则外不发送任何内容；表格保留在项目文件夹内。

### 微调模型

- **在轨道中：**`nmt-forge`（`nmt-checkpoint`；预设 `cpu-tiny`、
  `byt5-small`、`byt5-small-lowmem`、`cpu-finetune`、`nllb-600m`），导出、部署服务并连接 ——
  [训练](/docs/agents/training)、[服务](/docs/agents/serving)。
- **您已拥有的开放模型：**`mt-eval run --method local-model -m
  <Hugging Face id or folder>` —— 进程内运行；任何数据均不出本机。
- **自行部署服务的 LLM**（Ollama、vLLM 或任何兼容 OpenAI 的服务）：
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`。仅当端点为环回地址时才视为本地。
- **发送内容：**端点确为本地时，任何数据均不出本机。

## 深入探索

- [方法规范](/docs/network/specifications/methods)与[插件清单](/docs/reference/plugin-spec)（旧版格式）。
- [服务与部署](/docs/agents/serving) —— deployment/1 与 service-api/1。
- [测量规则](/docs/agents/measurement) —— 门控评分。
- [数据与传输规则](/docs/agents/data-rules) —— 允许发送的内容。
- [适用于应用与网站的翻译方法](/docs/guides/translation-methods)。
