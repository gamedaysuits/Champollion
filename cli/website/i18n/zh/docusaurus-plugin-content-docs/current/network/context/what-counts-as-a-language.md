---
sidebar_position: 2
title: "这里如何定义语言？"
---

# 这里什么算作一种语言？

> **执行摘要。** 该网络按 ISO 639-3 编目语言，对单个语言进行基准测试（而非宏语言总称），将手语作为自然语言纳入其中，包括 ISO 认可的构造语言，排除编程语言，并在不偏袒任何一方的情况下展示分类争议。本页解释了每项选择及其对排行榜的含义。

任何跨数千种语言进行翻译基准测试的项目都必须回答一个古老且出人意料地困难的问题：什么算作一种语言？语言学家早已知道，"语言"和"方言"之间的界限在社会和政治上的意义与结构上的意义一样大——著名的说法是*"语言是有陆军和海军的方言"*，这句话由意第绪语言学家 Max Weinreich 在 1945 年推广（他将其归功于他一次讲座的听众）。我们无法回避这个问题，所以这是我们的答案和推理。

---

## 手语是语言。就这样。

手语是自然语言——具有完整的语法、儿童的本族语习得，以及活跃的语言社区。自 William Stokoe 在 1960 年证明美国手语具有与口语相同的内部结构以来，这在语言学中已成定论，此后六十年的研究（Klima & Bellugi 1979；Sandler & Lillo-Martin 2006）只是进一步深化了这一点。ISO 639-3 为手语分配单个语言代码；Glottolog 将其与口语族系一起编目。我们的编目包括 160 多种手语，标记为 `modality: signed`。

其中一些是濒危的土著语言：平原印第安手语（`psd`）在历史上是北美主要的部落间通用语，如今处于极度濒危状态（Davis 2010，*Hand Talk*）。手语濒危*就是*土著语言濒危，这在本项目的使命范围内。

**诚实的范围说明。** 该网络目前对*基于文本的*机器翻译进行基准测试。手语机器翻译——处理视频、空间语法以及没有广泛采用的书写形式的语言——是一个不同且在很大程度上未解决的技术问题（见 Yin et al. 2021，"Including Signed Languages in Natural Language Processing," ACL）。我们尚未提供此服务。我们编目中的手语条目明确说明了这一点：**尚未提供服务——绝不是"不是语言"。**

## 有两种模态。书写不是其中之一。

语言有两种主要模态：**口语**和**手语**。书写不是第三种模态——它是叠加在语言之上的一种技术，世界上大多数语言都没有标准化的书写形式。这就是为什么我们的语言卡片单独追踪书写（一种语言使用哪些文字，或者它是否根本没有标准化的正字法），并诚实地追踪它：对于基于文本的机器翻译平台，一种语言是否有书写形式是关键信息，而不是脚注——无书写形式的语言并不是较低级的语言。

## 构造语言：包括。编程语言：排除。

我们遵循 ISO 639-3 本身的界线。该标准仅在构造语言是完整语言、为人类交流而设计、具有文献和已将其传递给第二代使用者的社区时才承认它——并明确排除计算机编程语言。世界语具有本族使用者，符合条件；Python 不符合，因为没有人从父母那里将 Python 作为第一语言习得。我们的编目包括 ISO 认可的二十多种构造语言，标记为此类，不包括任何编程语言。

## 我们对单个语言进行基准测试，而非总称

ISO 639-3 区分*单个语言*和*宏语言*——总称代码，如 `cre`（克里语）、`ara`（阿拉伯语）或 `zho`（汉语），涵盖几种密切相关的单个语言。该网络的基准单位是**单个语言**，原因是操作性的：翻译资源是特定于语言变体的。为平原克里语（`crk`）构建的形态分析器不会生成穆斯克里语（`crm`）；埃及阿拉伯语语料库对摩洛哥阿拉伯语方法质量的说明不大。附加到总称代码的分数将是对从未实际评估过的语言变体的声称——所以我们不这样做。

宏语言仍然作为**中心页面**出现在编目中：导航将总称身份链接到其单个成员，反映 ISO 本身的观察，即两个身份级别都是真实的。在单个语言下方，我们显示来自 Glottolog 的语言树的方言和谱系信息（Hammarström & Forkel 2022），该树将族系、语言和方言建模为一个可导航的层次结构。

**对于标记为总括性代码（umbrella code）的语料库该如何处理？** 许多现实世界中的数据确实如此——作为“克丘亚语（Quechua）”、“波斯语（Persian）”或“中文（简体）”发布的数据集。我们将上游标签视为*有待解析的元数据*，而非盲目遵从或直接丢弃的事实。机械性情况会直接根据官方 ISO 表自动解析：文字标签会被剥离（`cmn-Hans` 是使用简体汉字书写的现代标准汉语——文字被记录，语言身份为 `cmn`），而已废弃的代码则遵循其官方后继代码。当发布者明确说明其数据究竟属于哪种变体时——例如 FLORES+ 将其克丘亚语记录编码为 `quy`（阿亚库乔克丘亚语）——我们会在语料库的注册表项中记录该解析结果*及对应引用*，该语料库便会在实际的独立语言下进行基准测试。而当没有人能说清某个数据集合到底包含哪种变体时（某些社区句子集合刻意保留了一个泛化的“阿拉伯语”分类桶），我们不会凭空猜测：语料库仍按其自身标签编目，并在工作队列中排除，同时附带一段可在队列元数据中查看的机器可读原因；其上的任何历史评分都将保留在如实标记的总括节点上——绝不会悄悄计入从未实际评估过的变体中。每一次解析都是可重新推导的：固定的 ISO 表、每个语料库的解析标记以及引用文献均包含在公开注册表中。

## 当权威机构意见不一致时，我们展示两者

ISO 639-3 与 Glottolog 偶尔在分类的拆分或归并上存在分歧，而社群本身有时也不同意这两者的划分。我们不作裁决。语言卡片提供了一个*分类说明（taxonomy notes）*功能，用于展示存在分歧的来源，且只要社群表达了偏好，命名就遵循社群意愿。某种变体是否算作“一种语言”，归根结底部分是一个认同问题——而认同问题应归属于社群自身，这是我们从原住民数据治理框架中吸纳的一项原则。

## 研究方向：基准作为测量工具

像这样的评估竞技场几乎作为副产品产出了一类新型证据，用以说明各种语言变体在*实际运作中*的接近程度。如果一个保持不变的单一翻译方法能够很好地服务于若干相关变体，且其使用者的反馈认可其输出，那么这些变体在实践中就聚为一类；如果它们需要单独的语料库和单独的方法，那么无论命名政治如何界定，它们在实际运作中就是截然不同的。这与从录音文本可理解度测试到自动化词汇距离度量等古老的实证传统颇为相似，只不过带有一种基于实际部署的视角。

我们谨慎地提供这一点，作为研究方向而非声称。方法转移结果受语料库大小、领域、正字法和训练数据污染的混淆，聚集总是相对于方法和质量阈值的。最重要的是：这个信号可以*为*关于语言和方言的对话提供信息，但它永远不会覆盖社区如何识别自己的语言。

---

## 参考文献

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## 本网站的后续内容

此处的统计规则规范了本网站上的每一个数字：[覆盖率统计方法](/docs/network/context/coverage-counting)将其应用于机器翻译服务，而[语言卡片](/docs/reference/language-card-spec)则按语言记录了每个来源的实际声明。
