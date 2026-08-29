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

**如果语料库在提供时带有统称代码（umbrella code）标签怎么办？** 许多现实世界的数据都是如此——例如发布为“Quechua”、“Persian”或“Chinese (Simplified)”的数据集。我们将上游标签视为*待解析的元数据*，而不是必须服从或丢弃的绝对真理。机械性的情况会根据官方 ISO 表格自动解析：剥离文字（script）标签（`cmn-Hans` 是现代标准汉语，使用简体中文书写——文字信息会被记录，而语言标识为 `cmn`），并且已废弃的代码会遵循其官方的后继代码。当发布者记录了其数据实际属于哪种变体时——例如 FLORES+ 将其 Quechua 记录编码为 `quy`（阿亚库乔克丘亚语，Ayacucho Quechua）——我们会在语料库的注册条目中记录该解析结果*并附上引用*，然后该语料库将在真实的独立语言下进行基准测试。而当没有人能说明一个集合包含哪种变体时（一些社区句子集合会刻意保留一个通用的“Arabic”分类），我们不会去猜测：该语料库将保留在其自身标签下进行目录分类，它会被排除在工作队列之外，你可以在队列的元数据中看到机器可读的排除原因，并且其上的任何历史分数都会保留在一个如实标记的统称节点（umbrella node）上——绝不会默默地归功于从未被评估过的变体。每次解析都是可重新推导的：固定的 ISO 表格、每个语料库的解析标记以及引用信息，均在公共注册表中发布。

## 当权威机构意见不一致时，我们展示两者

ISO 639-3 和 Glottolog 有时会以不同的方式分割或合并，社区有时与两者都不同意。我们不进行仲裁。语言卡片带有*分类说明*功能，显示带有来源的分歧，命名遵循社区在社区表达偏好的任何地方。一个语言变体是否"是一种语言"最终在一定程度上是身份问题——身份问题属于社区本身，这是我们从原住民数据治理框架中采纳的原则。

## 研究方向：基准作为测量工具

这样的竞技场产生的东西之一，几乎是作为副产品，是关于语言变体在*操作上*实际有多接近的一种新型证据。如果单一翻译方法保持固定，为几个相关变体提供可部署质量的服务，这些变体在实践中聚集；如果它们需要单独的语料库和单独的方法，它们在操作上是不同的——无论命名政治如何。这类似于较早的经验传统，从录制文本的相互理解测试到自动词汇距离测量，具有部署基础的转折。

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

---


## 本网站的后续内容

这里的计数规则决定了本网站上的每一个数字：
[覆盖率统计方法](/docs/network/context/coverage-counting)将它们应用
于机器翻译（MT）服务，而
[语言卡片](/docs/reference/language-card-spec)则按语言记录了
每个来源实际声明的内容。
