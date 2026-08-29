---
sidebar_position: 1
title: "من Pāṇini إلى Transformers"
---

# From Pāṇini to Transformers: Language, Computation, and the Unfinished Work of Translation
# من Pāṇini إلى Transformers: اللغة والحوسبة والعمل غير المكتمل للترجمة

**A History of the Ideas Behind champollion**
**تاريخ الأفكار وراء champollion**

---

> *"When I look at an article in Russian, I say: 'This is really written in English, but it has been coded in some strange symbols. I will now proceed to decode.'"*
> — Warren Weaver, 1949
> *"عندما أنظر إلى مقال باللغة الروسية، أقول: 'هذا مكتوب حقًا باللغة الإنجليزية، ولكنه شُفّر ببعض الرموز الغريبة. سأشرع الآن في فك التشفير.'"*
> — Warren Weaver، 1949

---

## Introduction
## مقدمة

The dream of a machine that could translate between human languages is older than the computer itself. It is, in some sense, *the* original problem of artificial intelligence—older than chess-playing programs, older than expert systems, older than neural networks. This desire is often framed through European parables like the Tower of Babel, which positions linguistic diversity as a punishment or a problem to be solved, bypassing the reality that pre-contact Indigenous societies have long navigated staggering linguistic diversity through sophisticated trade languages (like Chinook Jargon) and sign systems (like Plains Indian Sign Language) without seeking universal homogenization.
حلم الآلة القادرة على الترجمة بين اللغات البشرية أقدم من الحاسوب نفسه. وهو، بمعنى ما، المشكلة *الأصلية* للذكاء الاصطناعي—أقدم من برامج لعب الشطرنج، وأقدم من النظم الخبيرة، وأقدم من الشبكات العصبية. وغالبًا ما تُصاغ هذه الرغبة من خلال أمثلة أوروبية مثل برج بابل (Tower of Babel)، والتي تضع التنوع اللغوي كعقاب أو مشكلة يجب حلها، متجاهلة حقيقة أن مجتمعات السكان الأصليين قبل الاتصال قد تعاملت لفترة طويلة مع تنوع لغوي مذهل من خلال لغات تجارية متطورة (مثل Chinook Jargon) وأنظمة إشارات (مثل Plains Indian Sign Language) دون السعي إلى التجانس العالمي.

But the history that leads to this moment—to a world where large language models can translate passable French but hallucinate nonsense in Cree—is not a straight line. It is a braid of at least four distinct threads: the formal study of language, the mathematical theory of computation, the statistical revolution in machine learning, and a darker history that explains *why* the languages most in need of technology are the very languages for which it does not exist. That fourth thread is the history of colonial language suppression and cultural genocide—the deliberate, systematic destruction of Indigenous languages across every continent where European powers established dominion. Without understanding that history, the technical problem looks like an accident of data scarcity. It is not an accident.
لكن التاريخ الذي يقود إلى هذه اللحظة—إلى عالم حيث يمكن للنماذج اللغوية الكبيرة ترجمة لغة فرنسية مقبولة ولكنها تهلوس بهراء في لغة Cree—ليس خطًا مستقيمًا. إنه ضفيرة من أربعة خيوط متمايزة على الأقل: الدراسة الرسمية للغة، والنظرية الرياضية للحوسبة، والثورة الإحصائية في التعلم الآلي، وتاريخ أكثر قتامة يفسر *السبب* في أن اللغات الأكثر احتياجًا للتكنولوجيا هي اللغات ذاتها التي لا تتوفر لها هذه التكنولوجيا. هذا الخيط الرابع هو تاريخ القمع اللغوي الاستعماري والإبادة الثقافية—التدمير المتعمد والممنهج للغات السكان الأصليين عبر كل قارة أسست فيها القوى الأوروبية سيطرتها. وبدون فهم هذا التاريخ، تبدو المشكلة التقنية وكأنها حادثة ناتجة عن ندرة البيانات. إنها ليست حادثة.

This paper traces all four threads from their origins to their convergence in the present day. It is, admittedly, somewhat Whiggish—it tells the story as if it were always leading here. History, of course, did not know where it was going. But the threads are real, the connections are genuine, and understanding them is essential to understanding why projects like champollion exist, why they are built the way they are built, and why they matter now.
تتتبع هذه الورقة الخيوط الأربعة جميعها من أصولها إلى تقاربها في يومنا هذا. وهي، باعتراف الجميع، تتسم ببعض النزعة التبريرية (Whiggish)—فهي تروي القصة وكأنها كانت تقود دائمًا إلى هنا. التاريخ، بالطبع، لم يكن يعرف إلى أين يتجه. لكن الخيوط حقيقية، والروابط أصلية، وفهمها ضروري لفهم سبب وجود مشاريع مثل champollion، وسبب بنائها بالطريقة التي بُنيت بها، وسبب أهميتها الآن.

---

## I. The Grammar of Everything: From Pāṇini to Chomsky
## أولاً. قواعد كل شيء: من Pāṇini إلى Chomsky

### The First Formal Grammar (c. 4th Century BCE)
### أول قواعد نحوية رسمية (حوالي القرن الرابع قبل الميلاد)

The story begins not in a European university but in ancient India, with a scholar named Pāṇini. Around the 4th century BCE, Pāṇini composed the *Aṣṭādhyāyī*—a grammar of Sanskrit comprising roughly 4,000 rules. This was not a grammar in the loose, pedagogical sense. It was a *generative* grammar: a finite set of rules capable, in principle, of producing every valid utterance in the language.
لا تبدأ القصة في جامعة أوروبية بل في الهند القديمة، مع عالم يُدعى Pāṇini. في حوالي القرن الرابع قبل الميلاد، ألّف Pāṇini كتاب *Aṣṭādhyāyī*—وهو كتاب قواعد للغة السنسكريتية يضم حوالي 4000 قاعدة. لم تكن هذه قواعد نحوية بالمعنى التربوي الفضفاض. بل كانت قواعد *توليدية* (generative): مجموعة محدودة من القواعد القادرة، من حيث المبدأ، على إنتاج كل نطق صحيح في اللغة.

Pāṇini's system used what we would now recognize as formal rewriting rules, with variables, recursion, and ordered application. The linguist Paul Kiparsky has argued that the *Aṣṭādhyāyī* is "the most complete generative grammar of any language yet written" (Kiparsky, 1993). The computer scientist Gerard Huet has shown that Pāṇini's rules can be modeled as a finite-state transducer—the same computational formalism that, twenty-five centuries later, would become central to morphological analysis of polysynthetic languages.
استخدم نظام Pāṇini ما نعتبره الآن قواعد إعادة كتابة رسمية، مع متغيرات، وتكرار (recursion)، وتطبيق مرتب. وقد جادل اللغوي Paul Kiparsky بأن *Aṣṭādhyāyī* هو "أكمل قواعد توليدية لأي لغة كُتبت حتى الآن" (Kiparsky، 1993). وقد أظهر عالم الحاسوب Gerard Huet أنه يمكن نمذجة قواعد Pāṇini كمحول حالة محدودة (finite-state transducer)—وهي نفس الشكلية الحسابية التي ستصبح، بعد خمسة وعشرين قرنًا، مركزية للتحليل الصرفي للغات متعددة التركيب (polysynthetic).

Pāṇini did not know he was doing computer science. But he was.
لم يكن Pāṇini يعلم أنه كان يمارس علوم الحاسوب. لكنه كان كذلك.

### The Rosetta Stone and the Birth of Comparative Linguistics (1799)
### حجر رشيد وولادة اللغويات المقارنة (1799)

For most of recorded history, the study of language was primarily the study of *one's own* language—or, at most, the study of a sacred or classical language for liturgical purposes. The intellectual revolution that created modern linguistics began with a stone.
لمعظم التاريخ المسجل، كانت دراسة اللغة في المقام الأول دراسة للغة *المرء نفسه*—أو، على الأكثر، دراسة لغة مقدسة أو كلاسيكية لأغراض طقسية. الثورة الفكرية التي خلقت اللغويات الحديثة بدأت بحجر.

The Rosetta Stone, discovered by Napoleon's soldiers in 1799, bore the same decree in three scripts: Egyptian hieroglyphics, Demotic script, and Ancient Greek. Jean-François Champollion's decipherment of the hieroglyphics in 1822 was more than an archaeological triumph. It demonstrated a principle that would become foundational: that languages could be understood *through each other*. Translation was not merely a practical skill; it was a method of scientific investigation.
حجر رشيد (Rosetta Stone)، الذي اكتشفه جنود نابليون في عام 1799، كان يحمل نفس المرسوم بثلاثة خطوط: الهيروغليفية المصرية، والخط الديموطيقي، واليونانية القديمة. كان فك Jean-François Champollion لرموز الهيروغليفية في عام 1822 أكثر من مجرد انتصار أثري. فقد أثبت مبدأً سيصبح تأسيسيًا: وهو أنه يمكن فهم اللغات *من خلال بعضها البعض*. لم تكن الترجمة مجرد مهارة عملية؛ بل كانت طريقة للبحث العلمي.

### William Jones and the Indo-European Hypothesis (1786)
### William Jones وفرضية اللغات الهندو-أوروبية (1786)

Even before Champollion, the British philologist Sir William Jones had delivered his famous lecture to the Asiatic Society of Bengal in 1786, observing that Sanskrit bore to Greek and Latin "a stronger affinity, both in the roots of verbs and in the forms of grammar, than could possibly have been produced by accident." Jones proposed that all three descended from a common ancestor "which, perhaps, no longer exists."
حتى قبل Champollion، ألقى عالم فقه اللغة البريطاني السير William Jones محاضرته الشهيرة أمام الجمعية الآسيوية في البنغال في عام 1786، ملاحظًا أن السنسكريتية تحمل لليونانية واللاتينية "تقاربًا أقوى، سواء في جذور الأفعال أو في أشكال القواعد، مما يمكن أن يكون قد نتج عن طريق الصدفة." اقترح Jones أن الثلاثة ينحدرون من سلف مشترك "والذي، ربما، لم يعد موجودًا."

This was the birth of historical and comparative linguistics. It established that languages were not isolated, static entities but members of families—related by descent, shaped by time, subject to regular laws of change. It was, in its way, an evolutionary theory decades before Darwin.
كانت هذه ولادة اللغويات التاريخية والمقارنة. فقد أثبتت أن اللغات لم تكن كيانات معزولة وثابتة بل أعضاء في عائلات—مرتبطة بالنسب، وتشكلت بمرور الزمن، وتخضع لقوانين منتظمة للتغيير. لقد كانت، بطريقتها الخاصة، نظرية تطورية قبل عقود من Darwin.

### August Schleicher's Language Trees (1861)
### أشجار اللغات لـ August Schleicher (1861)

It was August Schleicher, a German linguist, who made the Darwinian connection explicit. In 1861—just two years after *On the Origin of Species*—Schleicher published his *Stammbaum* (family tree) model of the Indo-European languages. His diagrams look almost indistinguishable from phylogenetic trees in biology. Languages, like species, branched, diverged, and occasionally went extinct.
كان August Schleicher، وهو لغوي ألماني، هو من جعل الارتباط الدارويني صريحًا. في عام 1861—بعد عامين فقط من نشر كتاب *أصل الأنواع* (On the Origin of Species)—نشر Schleicher نموذجه *Stammbaum* (شجرة العائلة) للغات الهندو-أوروبية. تبدو مخططاته غير قابلة للتمييز تقريبًا عن أشجار التطور في علم الأحياء. اللغات، مثل الأنواع، تتفرع، وتتباعد، وتنقرض في بعض الأحيان.

Schleicher's trees were a simplification (languages also *converge* through contact, borrowing, and creolization), but the model proved enormously productive. It established the principle that linguistic diversity was not random noise but structured data, amenable to systematic analysis. And it posed, implicitly, a question that remains central to our project: what happens to the branches that are dying?
كانت أشجار Schleicher تبسيطًا (اللغات *تتقارب* أيضًا من خلال الاتصال، والاستعارة، والتهجين اللغوي)، لكن النموذج أثبت أنه مثمر للغاية. فقد أرسى مبدأ أن التنوع اللغوي لم يكن ضوضاء عشوائية بل بيانات منظمة، قابلة للتحليل المنهجي. وطرح، ضمنيًا، سؤالاً يظل مركزيًا لمشروعنا: ماذا يحدث للفروع التي تموت؟

### Ferdinand de Saussure and the Architecture of Language (1916)
### Ferdinand de Saussure وبنية اللغة (1916)

The next revolution came from Ferdinand de Saussure, whose *Cours de linguistique générale* (published posthumously in 1916 from students' notes) established structural linguistics. Saussure drew a sharp distinction between *langue* (the abstract system of a language) and *parole* (actual speech). He argued that linguistic signs were *arbitrary*—the word "tree" bears no inherent connection to trees—and that meaning arose from *differences* within a system, not from any positive content.
جاءت الثورة التالية من Ferdinand de Saussure، الذي أسس كتابه *Cours de linguistique générale* (نُشر بعد وفاته في عام 1916 من مذكرات طلابه) اللغويات البنيوية. رسم Saussure تمييزًا حادًا بين *langue* (النظام المجرد للغة) و *parole* (الكلام الفعلي). وجادل بأن العلامات اللغوية كانت *اعتباطية*—فكلمة "شجرة" لا تحمل أي صلة متأصلة بالأشجار—وأن المعنى نشأ من *الاختلافات* داخل النظام، وليس من أي محتوى إيجابي.

Saussure's key diagram—the oval divided between *signifié* (signified, the concept) and *signifiant* (signifier, the sound-image), linked by arrows showing their inseparable relationship—became one of the most reproduced images in the humanities. It established the principle that a language is a *system of systems*, where each element derives its value from its relationships with all the others.
أصبح مخطط Saussure الرئيسي—الشكل البيضاوي المقسم بين *signifié* (المدلول، المفهوم) و *signifiant* (الدال، الصورة الصوتية)، المرتبطين بأسهم تظهر علاقتهما التي لا تنفصل—أحد أكثر الصور استنساخًا في العلوم الإنسانية. وقد أرسى مبدأ أن اللغة هي *نظام من الأنظمة*، حيث يستمد كل عنصر قيمته من علاقاته مع جميع العناصر الأخرى.

This had profound implications for translation. If meaning is relational and systemic, then translation is not a matter of swapping words. It requires understanding the entire architecture of a language. Two languages may carve up the world in fundamentally different ways—an insight that would later be developed (and sometimes over-stated) by Edward Sapir and Benjamin Lee Whorf.
كان لهذا آثار عميقة على الترجمة. إذا كان المعنى علائقيًا ومنهجيًا، فإن الترجمة ليست مسألة تبديل كلمات. إنها تتطلب فهم البنية الكاملة للغة. قد تقسم لغتان العالم بطرق مختلفة جوهريًا—وهي رؤية سيتم تطويرها لاحقًا (والمبالغة فيها أحيانًا) بواسطة Edward Sapir و Benjamin Lee Whorf.

### Sapir, Bloomfield, and the Study of Indigenous Languages
### Sapir و Bloomfield ودراسة لغات السكان الأصليين

In North America, the early 20th century brought a different tradition of linguistic fieldwork. Edward Sapir and Leonard Bloomfield worked extensively with Indigenous languages—Sapir with Navajo, Nootka, and many others; Bloomfield with Menomini and other Algonquian languages. They encountered linguistic structures radically different from anything in the Indo-European family.
في أمريكا الشمالية، جلب أوائل القرن العشرين تقليدًا مختلفًا للعمل الميداني اللغوي. عمل Edward Sapir و Leonard Bloomfield على نطاق واسع مع لغات السكان الأصليين—Sapir مع Navajo و Nootka والعديد من اللغات الأخرى؛ و Bloomfield مع Menomini ولغات Algonquian الأخرى. لقد واجهوا هياكل لغوية مختلفة جذريًا عن أي شيء في العائلة الهندو-أوروبية.

Sapir, in particular, developed a typological framework that classified languages along several axes, including the critical distinction between *analytic* languages (like English, where words tend to be short and meaning is carried by word order) and *polysynthetic* languages (like Cree, where a single word can encode what English would express as an entire sentence). A single Cree verb form might incorporate the subject, object, tense, aspect, evidentiality, and several modifying elements into one morphologically complex word.
طوّر Sapir، على وجه الخصوص، إطارًا تصنيفيًا يصنف اللغات على عدة محاور، بما في ذلك التمييز الحاسم بين اللغات *التحليلية* (مثل الإنجليزية، حيث تميل الكلمات إلى أن تكون قصيرة ويُحمل المعنى بواسطة ترتيب الكلمات) واللغات *متعددة التركيب* (مثل Cree، حيث يمكن لكلمة واحدة أن تشفر ما تعبر عنه الإنجليزية كجملة كاملة). قد يدمج شكل فعل واحد في لغة Cree الفاعل، والمفعول به، والزمن، والجانب، والأدلة (evidentiality)، والعديد من العناصر المعدلة في كلمة واحدة معقدة صرفيًا.

This work established two facts that remain central to our project. First: the world's languages are far more structurally diverse than any European-centric model would suggest. Second: many of these languages were already endangered. However, while early structural linguists documented this complexity, they often participated in "salvage anthropology"—an extractive academic model that treated Indigenous people merely as "informants" to build Western academic careers. This approach severed languages from their epistemological roots, paving the way for treating language as disembodied, extractable data rather than living, relational systems.
أرسى هذا العمل حقيقتين تظلان مركزيتين لمشروعنا. أولاً: لغات العالم أكثر تنوعًا من الناحية الهيكلية بكثير مما قد يوحي به أي نموذج يتمحور حول أوروبا. ثانيًا: العديد من هذه اللغات كانت مهددة بالانقراض بالفعل. ومع ذلك، في حين وثّق اللغويون البنيويون الأوائل هذا التعقيد، إلا أنهم غالبًا ما شاركوا في "أنثروبولوجيا الإنقاذ" (salvage anthropology)—وهو نموذج أكاديمي استخراجي يعامل السكان الأصليين مجرد "مخبرين" لبناء مسيرات مهنية أكاديمية غربية. أدى هذا النهج إلى فصل اللغات عن جذورها المعرفية، مما مهد الطريق لمعاملة اللغة كبيانات مجردة وقابلة للاستخراج بدلاً من كونها أنظمة حية وعلائقية.

### The Chomsky Revolution (1957)
### ثورة Chomsky (1957)

In 1957, a 28-year-old MIT linguist named Noam Chomsky published *Syntactic Structures*, a slim book that detonated like a bomb in the field. Chomsky argued that the goal of linguistics should be to discover the *generative grammar* of a language—a finite set of rules that could produce all and only the grammatical sentences of that language.
في عام 1957، نشر لغوي يبلغ من العمر 28 عامًا في معهد ماساتشوستس للتكنولوجيا (MIT) يُدعى Noam Chomsky كتاب *Syntactic Structures*، وهو كتاب رفيع انفجر كقنبلة في هذا المجال. جادل Chomsky بأن هدف اللغويات يجب أن يكون اكتشاف *القواعد التوليدية* للغة—وهي مجموعة محدودة من القواعد التي يمكن أن تنتج جميع الجمل النحوية لتلك اللغة، وتلك الجمل فقط.

More provocatively, Chomsky proposed the *Chomsky hierarchy*: a classification of formal grammars by their computational power. The hierarchy has four levels:
وبشكل أكثر استفزازًا، اقترح Chomsky *تسلسل Chomsky الهرمي* (Chomsky hierarchy): وهو تصنيف للقواعد الرسمية حسب قوتها الحسابية. يتكون التسلسل الهرمي من أربعة مستويات:

- **Type 3 (Regular)**: Recognized by finite automata. Simple patterns.
- **Type 2 (Context-Free)**: Recognized by pushdown automata. Recursive structures like nested parentheses.
- **Type 1 (Context-Sensitive)**: Recognized by linear bounded automata. More complex dependencies.
- **Type 0 (Recursively Enumerable)**: Recognized by Turing machines. Anything computable.
- **النوع 3 (منتظم - Regular)**: يتم التعرف عليه بواسطة الآلات ذات الحالة المحدودة (finite automata). أنماط بسيطة.
- **النوع 2 (خالٍ من السياق - Context-Free)**: يتم التعرف عليه بواسطة آلات الدفع لأسفل (pushdown automata). هياكل متكررة مثل الأقواس المتداخلة.
- **النوع 1 (حساس للسياق - Context-Sensitive)**: يتم التعرف عليه بواسطة آلات محدودة خطية (linear bounded automata). تبعيات أكثر تعقيدًا.
- **النوع 0 (قابل للعد بشكل متكرر - Recursively Enumerable)**: يتم التعرف عليه بواسطة آلات Turing. أي شيء قابل للحساب.

Chomsky argued that natural languages required at least context-free grammars, and possibly more. This was a direct bridge between linguistics and the mathematical theory of computation. The same formal tools that Alan Turing had developed to reason about the limits of computing could now be applied to human language.
جادل Chomsky بأن اللغات الطبيعية تتطلب على الأقل قواعد خالية من السياق، وربما أكثر. كان هذا جسرًا مباشرًا بين اللغويات والنظرية الرياضية للحوسبة. نفس الأدوات الرسمية التي طورها Alan Turing للتفكير في حدود الحوسبة يمكن الآن تطبيقها على اللغة البشرية.

Chomsky also proposed the idea of *Universal Grammar*—that the capacity for language is innate, that all human languages share deep structural properties, and that the diversity of surface forms masks an underlying unity. This remains controversial (many typologists and functionalists disagree), but the formal tools Chomsky introduced—phrase structure rules, transformational grammars, the hierarchy itself—became the foundation of computational linguistics.
اقترح Chomsky أيضًا فكرة *القواعد العالمية* (Universal Grammar)—وهي أن القدرة على اللغة فطرية، وأن جميع اللغات البشرية تشترك في خصائص هيكلية عميقة، وأن تنوع الأشكال السطحية يخفي وحدة أساسية. لا يزال هذا مثيرًا للجدل (يختلف العديد من علماء التصنيف والوظيفيين)، لكن الأدوات الرسمية التي قدمها Chomsky—قواعد بنية العبارة، والقواعد التحويلية، والتسلسل الهرمي نفسه—أصبحت أساس اللغويات الحاسوبية.

---

## II. The Dream of Universal Translation
## ثانيًا. حلم الترجمة العالمية

### Ramon Llull's Thinking Machine (1305)
### آلة التفكير لـ Ramon Llull (1305)

The dream of mechanizing thought—and with it, the dream of mechanical translation—is remarkably old. Ramon Llull, a 13th-century Catalan mystic, designed the *Ars Magna*: a system of rotating concentric discs inscribed with fundamental concepts, whose combinations were meant to generate all possible truths. Llull's wheels were, in a sense, the first combinatorial logic machine. Leibniz later cited Llull as an inspiration.
حلم مكننة الفكر—ومعه حلم الترجمة الآلية—قديم بشكل ملحوظ. صمم Ramon Llull، وهو متصوف كتالوني من القرن الثالث عشر، *Ars Magna*: وهو نظام من الأقراص متحدة المركز الدوارة المنقوشة بمفاهيم أساسية، والتي كان يُقصد من مجموعاتها توليد جميع الحقائق الممكنة. كانت عجلات Llull، بمعنى ما، أول آلة منطق توافقي. وقد استشهد Leibniz لاحقًا بـ Llull كمصدر إلهام.

### Athanasius Kircher and the Polygraphia Nova (1663)
### Athanasius Kircher و Polygraphia Nova (1663)

Athanasius Kircher, the great Jesuit polymath, published *Polygraphia Nova et Universalis* in 1663—a system of "universal writing" intended to allow communication across language barriers. Kircher's system assigned numbers to concepts, which could then be decoded into any language with the appropriate table. It was, in essence, an interlingua—a language-independent representation of meaning.
نشر Athanasius Kircher، العالم الموسوعي اليسوعي العظيم، *Polygraphia Nova et Universalis* في عام 1663—وهو نظام "كتابة عالمية" يهدف إلى السماح بالتواصل عبر حواجز اللغة. خصص نظام Kircher أرقامًا للمفاهيم، والتي يمكن بعد ذلك فك تشفيرها إلى أي لغة باستخدام الجدول المناسب. لقد كان، في جوهره، لغة وسيطة (interlingua)—تمثيل للمعنى مستقل عن اللغة.

The system didn't work very well. But the *idea* persisted: that between any two languages there exists a common conceptual space, and that translation is a matter of mapping through it. This interlingua hypothesis was not just a flawed scientific experiment; it was an epistemological extension of colonial control, incapable of mapping divergent ontologies. The philosopher W.V.O. Quine would later formalize this failure with his concept of the *indeterminacy of translation* (1960), arguing that radical translation is inherently indeterminate. Universal, context-free mapping between fundamentally divergent linguistic systems is a philosophical impossibility, not merely an engineering hurdle.
لم يعمل النظام بشكل جيد. لكن *الفكرة* استمرت: وهي أنه بين أي لغتين توجد مساحة مفاهيمية مشتركة، وأن الترجمة هي مسألة رسم خرائط من خلالها. لم تكن فرضية اللغة الوسيطة هذه مجرد تجربة علمية معيبة؛ بل كانت امتدادًا معرفيًا للسيطرة الاستعمارية، غير قادرة على رسم خرائط للأنطولوجيات المتباينة. سيقوم الفيلسوف W.V.O. Quine لاحقًا بإضفاء الطابع الرسمي على هذا الفشل من خلال مفهومه عن *عدم حتمية الترجمة* (1960)، مجادلاً بأن الترجمة الجذرية غير محددة بطبيعتها. إن التعيين العالمي الخالي من السياق بين الأنظمة اللغوية المتباينة بشكل أساسي هو استحالة فلسفية، وليس مجرد عقبة هندسية.

### John Wilkins and the Philosophical Language (1668)
### John Wilkins واللغة الفلسفية (1668)

Just five years after Kircher, the English natural philosopher John Wilkins published *An Essay towards a Real Character, and a Philosophical Language*—an attempt to create a language whose structure *perfectly mirrored the structure of reality*. Every concept would be classified in a great taxonomy, and its name would encode its position in that taxonomy.
بعد خمس سنوات فقط من Kircher، نشر الفيلسوف الطبيعي الإنجليزي John Wilkins كتاب *An Essay towards a Real Character, and a Philosophical Language*—وهي محاولة لإنشاء لغة يعكس هيكلها *هيكل الواقع بشكل مثالي*. سيتم تصنيف كل مفهوم في تصنيف عظيم، وسيقوم اسمه بتشفير موقعه في ذلك التصنيف.

Wilkins' project failed (reality proved resistant to tidy classification), but it anticipated something important: the idea that language could be *engineered*, that the relationship between words and meanings could be made systematic and explicit. This is, in a deep sense, what computational linguists do when they build ontologies and knowledge graphs.
فشل مشروع Wilkins (أثبت الواقع مقاومته للتصنيف المرتب)، لكنه توقع شيئًا مهمًا: فكرة أنه يمكن *هندسة* اللغة، وأنه يمكن جعل العلاقة بين الكلمات والمعاني منهجية وصريحة. هذا، بالمعنى العميق، هو ما يفعله اللغويون الحاسوبيون عندما يبنون الأنطولوجيات والرسوم البيانية المعرفية.

### Leibniz and the Characteristica Universalis
### Leibniz و Characteristica Universalis

Gottfried Wilhelm Leibniz, who independently invented calculus and designed a mechanical calculator, dreamed of a *characteristica universalis*—a universal formal language in which all human knowledge could be expressed—and a *calculus ratiocinator*—a machine that could reason in that language. "If controversies were to arise," Leibniz wrote, "there would be no more need of disputation between two philosophers than between two accountants. For it would suffice to take their pencils in their hands, to sit down to their slates, and to say to each other: Let us calculate."
حلم Gottfried Wilhelm Leibniz، الذي اخترع التفاضل والتكامل بشكل مستقل وصمم آلة حاسبة ميكانيكية، بـ *characteristica universalis*—وهي لغة رسمية عالمية يمكن التعبير فيها عن كل المعرفة البشرية—و *calculus ratiocinator*—وهي آلة يمكنها التفكير في تلك اللغة. كتب Leibniz: "إذا نشأت خلافات، فلن تكون هناك حاجة للجدال بين فيلسوفين أكثر من الحاجة إليه بين محاسبين. لأنه سيكفي أن يأخذوا أقلامهم في أيديهم، ويجلسوا إلى ألواحهم، ويقولوا لبعضهم البعض: دعونا نحسب."

Leibniz also invented binary arithmetic—the number system that would, centuries later, become the language of digital computers. His 1703 paper *Explication de l'Arithmétique Binaire* showed that any number could be represented using only 0 and 1. He saw this as a reflection of the divine creation (something from nothing), but it would prove to be the foundation of all digital computation.
اخترع Leibniz أيضًا الحساب الثنائي—نظام الأرقام الذي سيصبح، بعد قرون، لغة الحواسيب الرقمية. أظهرت ورقته البحثية عام 1703 *Explication de l'Arithmétique Binaire* أنه يمكن تمثيل أي رقم باستخدام 0 و 1 فقط. لقد رأى هذا كانعكاس للخلق الإلهي (شيء من لا شيء)، لكنه سيثبت أنه أساس كل الحوسبة الرقمية.

### Warren Weaver's Memo (1949)
### مذكرة Warren Weaver (1949)

The modern era of machine translation begins with a memorandum. In July 1949, the American mathematician and science administrator Warren Weaver wrote to Norbert Wiener, proposing that the new electronic computers might be applied to translation. His memo contained the remarkable passage quoted at the opening of this paper: the idea that a Russian text is "really written in English, but... coded in some strange symbols."
يبدأ العصر الحديث للترجمة الآلية بمذكرة. في يوليو 1949، كتب عالم الرياضيات والمسؤول العلمي الأمريكي Warren Weaver إلى Norbert Wiener، مقترحًا أنه يمكن تطبيق الحواسيب الإلكترونية الجديدة على الترجمة. تضمنت مذكرته الفقرة الرائعة المقتبسة في بداية هذه الورقة: فكرة أن النص الروسي "مكتوب حقًا باللغة الإنجليزية، ولكنه... شُفّر ببعض الرموز الغريبة."

Weaver's metaphor was drawn from wartime cryptanalysis—the idea that translation was fundamentally a *decoding* problem. This was not merely an analogy. The same statistical and information-theoretic tools that had been developed to break enemy ciphers might, Weaver suggested, be applicable to the problem of translation.
استُمدت استعارة Weaver من تحليل الشفرات في زمن الحرب—فكرة أن الترجمة كانت في الأساس مشكلة *فك تشفير*. لم يكن هذا مجرد تشبيه. اقترح Weaver أن نفس الأدوات الإحصائية والنظرية للمعلومات التي تم تطويرها لكسر شفرات العدو قد تكون قابلة للتطبيق على مشكلة الترجمة.

The memo was wildly optimistic, but it launched a research program. Within five years, the first machine translation demonstration would take place.
كانت المذكرة متفائلة للغاية، لكنها أطلقت برنامجًا بحثيًا. في غضون خمس سنوات، سيتم إجراء أول عرض توضيحي للترجمة الآلية.

---

## III. The Machinery of Thought: Computation and Information
## ثالثًا. آلة الفكر: الحوسبة والمعلومات

### George Boole and the Algebra of Logic (1854)
### George Boole وجبر المنطق (1854)

In 1854, George Boole published *An Investigation of the Laws of Thought*—a work that reduced logical reasoning to algebraic operations. Boole showed that the propositions of logic could be manipulated using the same rules as algebra, with AND corresponding to multiplication, OR to addition, and NOT to complement.
في عام 1854، نشر George Boole كتاب *An Investigation of the Laws of Thought*—وهو عمل اختزل التفكير المنطقي إلى عمليات جبرية. أظهر Boole أنه يمكن معالجة مقترحات المنطق باستخدام نفس قواعد الجبر، حيث يتوافق AND مع الضرب، و OR مع الجمع، و NOT مع المكمل.

Boolean algebra seemed like a mathematical curiosity at the time. It would become the operating principle of every digital circuit ever built.
بدا الجبر البولياني (Boolean algebra) وكأنه فضول رياضي في ذلك الوقت. لكنه سيصبح مبدأ التشغيل لكل دائرة رقمية تم بناؤها على الإطلاق.

### Charles Babbage and Ada Lovelace (1837–1843)
### Charles Babbage و Ada Lovelace (1837–1843)

Charles Babbage designed (but never completed) the Analytical Engine—a mechanical, steam-powered, general-purpose computer. Unlike his earlier Difference Engine (a specialized calculator), the Analytical Engine had a memory ("the Store"), a processing unit ("the Mill"), conditional branching, and looping. It was, in principle, Turing-complete.
صمم Charles Babbage (لكنه لم يكمل أبدًا) المحرك التحليلي (Analytical Engine)—وهو حاسوب ميكانيكي يعمل بالبخار ومتعدد الأغراض. على عكس محرك الفرق (Difference Engine) السابق (وهو آلة حاسبة متخصصة)، كان المحرك التحليلي يحتوي على ذاكرة ("المخزن")، ووحدة معالجة ("المطحنة")، وتفرع شرطي، وتكرار. لقد كان، من حيث المبدأ، مكتملًا حسب تورينج (Turing-complete).

Ada Lovelace, working from a description of the Engine, wrote a set of detailed notes that included what is widely considered the first published computer program: an algorithm for computing Bernoulli numbers (Note G, 1843). But Lovelace's most profound contribution was conceptual. She saw that the Engine could manipulate *symbols*, not just numbers. "The Analytical Engine weaves algebraical patterns," she wrote, "just as the Jacquard loom weaves flowers and leaves." The implication—that computation could be applied to any domain with a formal structure, including language—was prescient.
كتبت Ada Lovelace، انطلاقًا من وصف للمحرك، مجموعة من الملاحظات التفصيلية التي تضمنت ما يُعتبر على نطاق واسع أول برنامج حاسوبي منشور: خوارزمية لحساب أرقام برنولي (الملاحظة G، 1843). لكن مساهمة Lovelace الأكثر عمقًا كانت مفاهيمية. لقد رأت أن المحرك يمكنه معالجة *الرموز*، وليس الأرقام فقط. كتبت: "ينسج المحرك التحليلي أنماطًا جبرية، تمامًا كما ينسج نول الجاكار الزهور والأوراق." كان التضمين—بأنه يمكن تطبيق الحوسبة على أي مجال ذي بنية رسمية، بما في ذلك اللغة—سابقًا لأوانه.

### Alan Turing and the Universal Machine (1936)
### Alan Turing والآلة العالمية (1936)

In 1936, Alan Turing published "On Computable Numbers, with an Application to the Entscheidungsproblem"—a paper that simultaneously defined computation, proved its limits, and invented the modern computer (in abstract form).
في عام 1936، نشر Alan Turing "On Computable Numbers, with an Application to the Entscheidungsproblem"—وهي ورقة بحثية حددت الحوسبة في نفس الوقت، وأثبتت حدودها، واخترعت الحاسوب الحديث (في شكل مجرد).

Turing's key insight was the *universal machine*: a single machine that, given the right instructions encoded on its tape, could simulate *any other* machine. This established that there was no essential difference between hardware and software, between the machine and the program. A single device, properly programmed, could compute anything that was computable at all.
كانت رؤية Turing الرئيسية هي *الآلة العالمية* (universal machine): آلة واحدة يمكنها، بالنظر إلى التعليمات الصحيحة المشفرة على شريطها، محاكاة *أي آلة أخرى*. أثبت هذا أنه لا يوجد فرق جوهري بين الأجهزة والبرمجيات، بين الآلة والبرنامج. يمكن لجهاز واحد، مبرمج بشكل صحيح، أن يحسب أي شيء قابل للحساب على الإطلاق.

Turing's work also established the limits of computation (the halting problem) and laid the groundwork for his later exploration of machine intelligence. His 1950 paper "Computing Machinery and Intelligence," which proposed the famous Turing Test, framed the question of machine intelligence explicitly in terms of *language*: a machine is intelligent if, through conversation, it cannot be distinguished from a human.
أرسى عمل Turing أيضًا حدود الحوسبة (مشكلة التوقف - halting problem) ووضع الأساس لاستكشافه اللاحق لذكاء الآلة. ورقته البحثية عام 1950 "Computing Machinery and Intelligence"، والتي اقترحت اختبار تورينج (Turing Test) الشهير، صاغت مسألة ذكاء الآلة صراحةً من حيث *اللغة*: تكون الآلة ذكية إذا لم يكن من الممكن، من خلال المحادثة، تمييزها عن الإنسان.

### Claude Shannon and Information Theory (1948)
### Claude Shannon ونظرية المعلومات (1948)

In 1948, Claude Shannon published "A Mathematical Theory of Communication" in the *Bell System Technical Journal*—a paper that founded the field of information theory. Shannon showed that communication could be modeled as a system: an *information source* generates a *message*, which a *transmitter* encodes into a *signal*, which passes through a *channel* (subject to *noise*), which a *receiver* decodes back into a message for a *destination*.
في عام 1948، نشر Claude Shannon "A Mathematical Theory of Communication" في مجلة *Bell System Technical Journal*—وهي ورقة بحثية أسست مجال نظرية المعلومات. أظهر Shannon أنه يمكن نمذجة الاتصال كنظام: يولد *مصدر المعلومات* *رسالة*، يقوم *جهاز الإرسال* بتشفيرها إلى *إشارة*، والتي تمر عبر *قناة* (تخضع لـ *الضوضاء*)، والتي يقوم *جهاز الاستقبال* بفك تشفيرها مرة أخرى إلى رسالة لـ *وجهة*.

Shannon's key contribution was the concept of *entropy*—a measure of the uncertainty or information content of a message. He proved that for any channel with a given noise level, there exists a maximum rate at which information can be transmitted reliably (the channel capacity), and that this rate can be achieved with sufficiently clever encoding.
كانت مساهمة Shannon الرئيسية هي مفهوم *الإنتروبيا* (entropy)—وهو مقياس لعدم اليقين أو محتوى المعلومات في رسالة. لقد أثبت أنه بالنسبة لأي قناة ذات مستوى ضوضاء معين، يوجد معدل أقصى يمكن من خلاله نقل المعلومات بشكل موثوق (سعة القناة)، وأنه يمكن تحقيق هذا المعدل بتشفير ذكي بما فيه الكفاية.

The connection to translation is deep. Shannon himself, in a 1951 paper, used information theory to analyze the statistical structure of English. He showed that English text is highly redundant—that a native speaker, given a sequence of letters, can predict the next letter with high accuracy. This redundancy is what makes communication robust against noise, but it also means that the *information content* of language is much lower than its raw symbol count would suggest.
الارتباط بالترجمة عميق. استخدم Shannon نفسه، في ورقة بحثية عام 1951، نظرية المعلومات لتحليل البنية الإحصائية للغة الإنجليزية. أظهر أن النص الإنجليزي زائد عن الحاجة بشكل كبير—حيث يمكن للمتحدث الأصلي، بالنظر إلى تسلسل من الحروف، التنبؤ بالحرف التالي بدقة عالية. هذا التكرار هو ما يجعل الاتصال قويًا ضد الضوضاء، ولكنه يعني أيضًا أن *محتوى المعلومات* للغة أقل بكثير مما يوحي به عدد رموزها الخام.

Warren Weaver immediately saw the connection: if translation is decoding, and if the statistical structure of language can be modeled, then translation is an information-theoretic problem. This insight would take decades to bear fruit, but when it did, it transformed the field.
رأى Warren Weaver الارتباط على الفور: إذا كانت الترجمة هي فك تشفير، وإذا كان من الممكن نمذجة البنية الإحصائية للغة، فإن الترجمة هي مشكلة نظرية معلومات. ستستغرق هذه الرؤية عقودًا لتؤتي ثمارها، ولكن عندما حدث ذلك، غيرت المجال.

### Von Neumann and the Stored-Program Computer (1945)
### Von Neumann وحاسوب البرنامج المخزن (1945)

John von Neumann's 1945 report on the EDVAC (Electronic Discrete Variable Automatic Computer) described what we now call the *von Neumann architecture*: a computer with a single memory store for both data and instructions, a central processing unit, and input/output mechanisms. This architecture—data and programs sharing the same memory, processed sequentially by a CPU—remains the fundamental design of nearly every computer in use today.
وصف تقرير John von Neumann لعام 1945 حول EDVAC (الحاسوب الآلي الإلكتروني ذو المتغيرات المنفصلة) ما نسميه الآن *بنية von Neumann*: حاسوب بذاكرة تخزين واحدة لكل من البيانات والتعليمات، ووحدة معالجة مركزية، وآليات إدخال/إخراج. تظل هذه البنية—البيانات والبرامج التي تشترك في نفس الذاكرة، وتتم معالجتها بالتسلسل بواسطة وحدة المعالجة المركزية—التصميم الأساسي لكل حاسوب مستخدم اليوم تقريبًا.

The von Neumann architecture made software practical. Programs could be stored, modified, and even generated by other programs. This was the technological precondition for everything that followed: compilers, operating systems, and eventually the neural network frameworks that power modern machine translation.
جعلت بنية von Neumann البرمجيات عملية. يمكن تخزين البرامج وتعديلها وحتى إنشاؤها بواسطة برامج أخرى. كان هذا هو الشرط التكنولوجي المسبق لكل ما تلا ذلك: المترجمات (compilers)، وأنظمة التشغيل، وفي النهاية أطر الشبكات العصبية التي تشغل الترجمة الآلية الحديثة.

---

## IV. Machine Translation: The First AI Problem
## رابعًا. الترجمة الآلية: مشكلة الذكاء الاصطناعي الأولى

### The Georgetown-IBM Experiment and the Cold War (1954)
### تجربة Georgetown-IBM والحرب الباردة (1954)

On January 7, 1954, researchers at Georgetown University and IBM demonstrated the first public machine translation system. The system translated 60 Russian sentences into English using a vocabulary of 250 words and six grammar rules. The sentences were carefully selected to be within the system's capabilities, but the demonstration generated enormous excitement.
في 7 يناير 1954، عرض باحثون في جامعة Georgetown و IBM أول نظام ترجمة آلية عام. ترجم النظام 60 جملة روسية إلى الإنجليزية باستخدام مفردات من 250 كلمة وست قواعد نحوية. تم اختيار الجمل بعناية لتكون ضمن قدرات النظام، لكن العرض التوضيحي أثار حماسًا هائلاً.

The *New York Times* reported that the experiment portended a future where "a push-button electronic translator" would make all the world's scientific literature instantly accessible. However, this public optimism masked the material reality of the project's funding and purpose. The Georgetown-IBM experiment—and the early machine translation field generally—was not driven by a utopian desire for universal communication. It was funded by the United States military and intelligence apparatus (including the CIA and DARPA) as an urgent Cold War imperative to surveil and intercept Soviet scientific and military texts. 
ذكرت صحيفة *New York Times* أن التجربة تنذر بمستقبل حيث سيجعل "مترجم إلكتروني بضغطة زر" جميع المؤلفات العلمية في العالم في متناول اليد على الفور. ومع ذلك، أخفى هذا التفاؤل العام الواقع المادي لتمويل المشروع والغرض منه. لم تكن تجربة Georgetown-IBM—ومجال الترجمة الآلية المبكر بشكل عام—مدفوعة برغبة طوباوية في التواصل العالمي. بل تم تمويلها من قبل الجيش الأمريكي وجهاز المخابرات (بما في ذلك وكالة المخابرات المركزية CIA و DARPA) كضرورة ملحة في الحرب الباردة لمراقبة واعتراض النصوص العلمية والعسكرية السوفيتية.

The view of language as a "code to be cracked" (as Weaver put it) was intrinsically tied to militarized surveillance. Researchers predicted that machine translation would be a solved problem within five years. They were wrong by more than half a century.
كانت النظرة إلى اللغة على أنها "شفرة يجب كسرها" (كما عبر Weaver) مرتبطة ارتباطًا وثيقًا بالمراقبة العسكرية. توقع الباحثون أن الترجمة الآلية ستكون مشكلة محلولة في غضون خمس سنوات. لقد كانوا مخطئين بأكثر من نصف قرن.

### The ALPAC Report and the First AI Winter (1966)
### تقرير ALPAC وشتاء الذكاء الاصطناعي الأول (1966)

In 1966, the Automatic Language Processing Advisory Committee (ALPAC), convened by the U.S. government, issued a devastating report. After reviewing a decade of MT research, ALPAC concluded that machine translation was slower, less accurate, and more expensive than human translation, and recommended that funding be redirected to basic research in computational linguistics.
في عام 1966، أصدرت اللجنة الاستشارية للمعالجة الآلية للغات (ALPAC)، التي عقدتها الحكومة الأمريكية، تقريرًا مدمرًا. بعد مراجعة عقد من أبحاث الترجمة الآلية (MT)، خلصت ALPAC إلى أن الترجمة الآلية كانت أبطأ وأقل دقة وأكثر تكلفة من الترجمة البشرية، وأوصت بإعادة توجيه التمويل إلى البحوث الأساسية في اللغويات الحاسوبية.

The ALPAC report effectively killed MT research funding in the United States for over a decade. It was the first "AI winter"—a pattern that would repeat: extravagant promises, modest results, disillusionment, funding collapse.
أدى تقرير ALPAC فعليًا إلى القضاء على تمويل أبحاث الترجمة الآلية في الولايات المتحدة لأكثر من عقد من الزمان. كان هذا أول "شتاء للذكاء الاصطناعي" (AI winter)—وهو نمط سيتكرر: وعود باهظة، ونتائج متواضعة، وخيبة أمل، وانهيار التمويل.

But the report also contained a deeper insight. Machine translation had failed, in part, because language was harder than anyone had expected. The rule-based approach—writing explicit grammar rules to parse and generate sentences—worked for simple cases but broke down catastrophically on real text. Language was too ambiguous, too context-dependent, too *alive* for brittle rules to capture.
لكن التقرير تضمن أيضًا رؤية أعمق. لقد فشلت الترجمة الآلية، جزئيًا، لأن اللغة كانت أصعب مما توقعه أي شخص. نجح النهج القائم على القواعد—كتابة قواعد نحوية صريحة لتحليل وتوليد الجمل—في الحالات البسيطة ولكنه انهار بشكل كارثي على النص الحقيقي. كانت اللغة غامضة للغاية، وتعتمد على السياق للغاية، و *حية* للغاية بحيث لا يمكن للقواعد الهشة التقاطها.

### Rule-Based and Transfer-Based MT (1970s–1980s)
### الترجمة الآلية القائمة على القواعد والقائمة على النقل (السبعينيات - الثمانينيات)

Research continued, more quietly, through the 1970s and 1980s. Systems like SYSTRAN (which powered the European Commission's early translation services) used large hand-crafted dictionaries and transfer rules to map between language pairs. These systems could produce useful rough translations for restricted domains, but they required enormous engineering effort for each language pair, and they rarely handled unrestricted text gracefully.
استمرت الأبحاث، بهدوء أكبر، خلال السبعينيات والثمانينيات. استخدمت أنظمة مثل SYSTRAN (التي شغلت خدمات الترجمة المبكرة للمفوضية الأوروبية) قواميس كبيرة مصنوعة يدويًا وقواعد نقل للتعيين بين أزواج اللغات. يمكن لهذه الأنظمة إنتاج ترجمات تقريبية مفيدة لمجالات مقيدة، لكنها تطلبت جهدًا هندسيًا هائلاً لكل زوج لغوي، ونادرًا ما تعاملت مع النص غير المقيد برشاقة.

The fundamental problem was clear: language is not a cipher. You cannot translate by looking up words in a dictionary and rearranging them according to grammatical rules, because meaning depends on context, on world knowledge, on the speaker's intent, on the entire history of a conversation. The interlingua approach—translating through an abstract, language-independent representation—was theoretically elegant but practically impossible. No one could define the interlingua.
كانت المشكلة الأساسية واضحة: اللغة ليست شفرة. لا يمكنك الترجمة من خلال البحث عن الكلمات في قاموس وإعادة ترتيبها وفقًا للقواعد النحوية، لأن المعنى يعتمد على السياق، وعلى المعرفة بالعالم، وعلى نية المتحدث، وعلى التاريخ الكامل للمحادثة. كان نهج اللغة الوسيطة (interlingua)—الترجمة من خلال تمثيل مجرد ومستقل عن اللغة—أنيقًا من الناحية النظرية ولكنه مستحيل عمليًا. لم يستطع أحد تحديد اللغة الوسيطة.

### The Statistical Revolution (1990s)
### الثورة الإحصائية (التسعينيات)

The breakthrough came not from better rules but from better data. In the late 1980s and early 1990s, researchers at IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra, and Robert Mercer) developed a series of statistical models for machine translation—the famous IBM Models 1 through 5.
لم يأتِ الاختراق من قواعد أفضل بل من بيانات أفضل. في أواخر الثمانينيات وأوائل التسعينيات، طور باحثون في IBM (Peter Brown و Stephen Della Pietra و Vincent Della Pietra و Robert Mercer) سلسلة من النماذج الإحصائية للترجمة الآلية—نماذج IBM الشهيرة من 1 إلى 5.

The key insight was Weaver's old idea, finally made rigorous: translation as decoding. Given a foreign sentence *f*, find the English sentence *e* that maximizes P(e|f). By Bayes' theorem, this is equivalent to maximizing P(f|e) × P(e)—a *translation model* (how likely is this foreign sentence given this English one?) times a *language model* (how likely is this English sentence on its own?).
كانت الرؤية الرئيسية هي فكرة Weaver القديمة، والتي أصبحت أخيرًا صارمة: الترجمة كفك تشفير. بالنظر إلى جملة أجنبية *f*، ابحث عن الجملة الإنجليزية *e* التي تزيد من P(e|f). وفقًا لنظرية Bayes، فإن هذا يعادل تعظيم P(f|e) × P(e)—*نموذج ترجمة* (ما مدى احتمالية هذه الجملة الأجنبية بالنظر إلى هذه الجملة الإنجليزية؟) مضروبًا في *نموذج لغة* (ما مدى احتمالية هذه الجملة الإنجليزية بمفردها؟).

The IBM models learned these probabilities from large *parallel corpora*—collections of texts that existed in both languages (like the Canadian parliamentary Hansards, which were published in both English and French). No hand-crafted rules were required. The system learned to translate by observing millions of examples of human translation.
تعلمت نماذج IBM هذه الاحتمالات من *مجموعات نصوص متوازية* (parallel corpora) كبيرة—مجموعات من النصوص التي كانت موجودة بكلتا اللغتين (مثل سجلات البرلمان الكندي Hansards، والتي نُشرت باللغتين الإنجليزية والفرنسية). لم تكن هناك حاجة إلى قواعد مصنوعة يدويًا. تعلم النظام الترجمة من خلال مراقبة ملايين الأمثلة للترجمة البشرية.

Statistical MT worked dramatically better than rule-based MT for languages with abundant parallel data. It also introduced a critical piece of infrastructure: the **BLEU score** (Papineni et al., 2002), a metric for automatically evaluating translation quality by comparing machine output to human reference translations. BLEU made it possible to measure progress quantitatively and to run large-scale experiments.
عملت الترجمة الآلية الإحصائية بشكل أفضل بكثير من الترجمة الآلية القائمة على القواعد للغات ذات البيانات المتوازية الوفيرة. كما قدمت جزءًا مهمًا من البنية التحتية: **درجة BLEU** (Papineni وآخرون، 2002)، وهي مقياس للتقييم التلقائي لجودة الترجمة من خلال مقارنة مخرجات الآلة بالترجمات المرجعية البشرية. جعلت BLEU من الممكن قياس التقدم كميًا وإجراء تجارب واسعة النطاق.

But statistical MT had a fatal assumption baked in: it required *parallel corpora*. For the world's major language pairs—English-French, English-Chinese, English-Spanish—parallel data was abundant. For the vast majority of the world's 7,000 languages, it simply did not exist.
لكن الترجمة الآلية الإحصائية كان بها افتراض قاتل مدمج: لقد تطلبت *مجموعات نصوص متوازية*. بالنسبة لأزواج اللغات الرئيسية في العالم—الإنجليزية-الفرنسية، الإنجليزية-الصينية، الإنجليزية-الإسبانية—كانت البيانات المتوازية وفيرة. أما بالنسبة للغالبية العظمى من لغات العالم البالغ عددها 7000 لغة، فهي ببساطة لم تكن موجودة.

### The Neural Revolution: Seq2Seq, Attention, Transformers (2014–2017)
### الثورة العصبية: Seq2Seq، الانتباه، Transformers (2014–2017)

The next transformation came with deep learning. In 2014, Ilya Sutskever, Oriol Vinyals, and Quoc Le demonstrated *sequence-to-sequence* (seq2seq) models for MT: neural networks that could read an entire sentence in one language and generate a translation in another, without any explicit alignment or phrase tables.
جاء التحول التالي مع التعلم العميق. في عام 2014، عرض Ilya Sutskever و Oriol Vinyals و Quoc Le نماذج *تسلسل إلى تسلسل* (seq2seq) للترجمة الآلية: شبكات عصبية يمكنها قراءة جملة كاملة بلغة واحدة وتوليد ترجمة بلغة أخرى، دون أي محاذاة صريحة أو جداول عبارات.

In 2015, Dzmitry Bahdanau, Kyunghyun Cho, and Yoshua Bengio introduced the *attention mechanism*—allowing the decoder to "look back" at different parts of the source sentence while generating each word of the translation. This dramatically improved performance on long sentences.
في عام 2015، قدم Dzmitry Bahdanau و Kyunghyun Cho و Yoshua Bengio *آلية الانتباه* (attention mechanism)—مما سمح لوحدة فك التشفير بـ "النظر إلى الوراء" إلى أجزاء مختلفة من الجملة المصدر أثناء توليد كل كلمة من الترجمة. أدى هذا إلى تحسين الأداء بشكل كبير في الجمل الطويلة.

And in 2017, Vaswani et al. at Google published "Attention Is All You Need," introducing the *Transformer* architecture. The Transformer dispensed with recurrence entirely, processing entire sequences in parallel using self-attention. It was faster to train, easier to scale, and produced better translations than anything that had come before.
وفي عام 2017، نشر Vaswani وآخرون في Google ورقة "Attention Is All You Need"، مقدمين بنية *Transformer*. استغنى Transformer عن التكرار (recurrence) تمامًا، حيث قام بمعالجة تسلسلات كاملة بالتوازي باستخدام الانتباه الذاتي (self-attention). كان أسرع في التدريب، وأسهل في التوسع، وأنتج ترجمات أفضل من أي شيء جاء من قبل.

Transformers led directly to the large language models (LLMs) of the 2020s: GPT, BERT, PaLM, LLaMA, and their descendants. These models, trained on vast quantities of text from the internet, can translate between hundreds of language pairs with remarkable fluency.
أدت Transformers مباشرة إلى النماذج اللغوية الكبيرة (LLMs) في عشرينيات القرن الحالي: GPT و BERT و PaLM و LLaMA ونسلها. يمكن لهذه النماذج، المدربة على كميات هائلة من النصوص من الإنترنت، الترجمة بين مئات أزواج اللغات بطلاقة ملحوظة.

But "remarkable fluency" is not the same as "reliable accuracy." And for the world's low-resource languages, the situation is far worse than it appears.
لكن "الطلاقة الملحوظة" ليست مثل "الدقة الموثوقة". وبالنسبة للغات منخفضة الموارد في العالم، فإن الوضع أسوأ بكثير مما يبدو.

---

## V. The Other History: Language, Power, and Cultural Genocide
## خامسًا. التاريخ الآخر: اللغة والسلطة والإبادة الثقافية

The previous four sections tell the story of ideas—of grammarians, mathematicians, and engineers building toward machine translation. But there is another history, running in parallel, that explains *why* the languages most in need of translation technology are the very ones for which it does not exist. This is not a story about data scarcity as a neutral fact. It is a story about deliberate destruction.
تروي الأقسام الأربعة السابقة قصة الأفكار—قصة النحويين وعلماء الرياضيات والمهندسين الذين يبنون نحو الترجمة الآلية. ولكن هناك تاريخ آخر، يسير بالتوازي، يفسر *السبب* في أن اللغات الأكثر احتياجًا لتكنولوجيا الترجمة هي اللغات ذاتها التي لا تتوفر لها هذه التكنولوجيا. هذه ليست قصة عن ندرة البيانات كحقيقة محايدة. إنها قصة عن التدمير المتعمد.

The reason that Plains Cree has no machine translation support is not primarily because Cree is a hard language for computers (though it is). It is because, for over a century, the governments of Canada and the United States ran systematic programs to eradicate Indigenous languages from the mouths of children. The "data scarcity" that makes low-resource MT so difficult is, in large part, the *downstream consequence of cultural genocide*. Any honest account of why these languages need technology must reckon with why they were brought to the edge of extinction in the first place.
السبب في أن لغة Plains Cree ليس لها دعم للترجمة الآلية ليس في المقام الأول لأن Cree لغة صعبة على الحواسيب (على الرغم من أنها كذلك). بل لأن حكومتي كندا والولايات المتحدة أدارتا، لأكثر من قرن، برامج منهجية للقضاء على لغات السكان الأصليين من أفواه الأطفال. إن "ندرة البيانات" التي تجعل الترجمة الآلية منخفضة الموارد صعبة للغاية هي، إلى حد كبير، *النتيجة اللاحقة للإبادة الثقافية*. أي سرد صادق لسبب احتياج هذه اللغات إلى التكنولوجيا يجب أن يأخذ في الاعتبار سبب دفعها إلى حافة الانقراض في المقام الأول.

### Before Contact: A Continent of Languages
### قبل الاتصال: قارة من اللغات

The linguistic diversity of the pre-contact Americas was staggering. At the time of European contact, North America alone was home to an estimated 300 to 600 distinct languages, organized into dozens of unrelated language families—more genetic diversity than in all of Europe. South America may have had 1,500 or more (Campbell, 1997). Australia had over 250 languages. The Pacific Islands, sub-Saharan Africa, and mainland Southeast Asia were similarly diverse.
كان التنوع اللغوي في الأمريكتين قبل الاتصال مذهلاً. في وقت الاتصال الأوروبي، كانت أمريكا الشمالية وحدها موطنًا لما يقدر بـ 300 إلى 600 لغة متميزة، منظمة في عشرات العائلات اللغوية غير المترابطة—تنوع جيني أكثر مما في كل أوروبا. ربما كان في أمريكا الجنوبية 1500 لغة أو أكثر (Campbell، 1997). كان في أستراليا أكثر من 250 لغة. وكانت جزر المحيط الهادئ، وأفريقيا جنوب الصحراء الكبرى، والبر الرئيسي لجنوب شرق آسيا متنوعة بالمثل.

These were not "primitive" or "simple" languages. Many of the most structurally complex languages ever documented are Indigenous. The polysynthetic morphology of Algonquian languages (including Cree, Ojibwe, and Blackfoot), the tonal systems of Navajo, the elaborate evidentiality marking of Quechua, the click consonants of the Khoisan languages—these represent the full range of what human language can be. They encode sophisticated systems of knowledge about kinship, ecology, law, spirituality, and history. Each language is a library—an irreplaceable record of one community's way of understanding and organizing the world.
لم تكن هذه لغات "بدائية" أو "بسيطة". العديد من اللغات الأكثر تعقيدًا من الناحية الهيكلية التي تم توثيقها على الإطلاق هي لغات السكان الأصليين. الصرف متعدد التركيب للغات Algonquian (بما في ذلك Cree و Ojibwe و Blackfoot)، والأنظمة النغمية للغة Navajo، وعلامات الأدلة المعقدة للغة Quechua، والحروف الساكنة النقرية للغات Khoisan—تمثل هذه النطاق الكامل لما يمكن أن تكون عليه اللغة البشرية. إنها تشفر أنظمة معرفية متطورة حول القرابة، والبيئة، والقانون، والروحانية، والتاريخ. كل لغة هي مكتبة—سجل لا يمكن تعويضه لطريقة مجتمع واحد في فهم العالم وتنظيمه.

Edward Sapir recognized this clearly. Writing in 1921, he observed that "when it comes to linguistic form, Plato walks with the Macedonian swineherd, Confucius with the head-hunting savage of Assam." The languages of Indigenous peoples were not lesser. They were different—and their differences contained knowledge that no other language possessed.
أدرك Edward Sapir هذا بوضوح. كتب في عام 1921، ملاحظًا أنه "عندما يتعلق الأمر بالشكل اللغوي، يمشي أفلاطون مع راعي الخنازير المقدوني، وكونفوشيوس مع الهمجي صائد الرؤوس في آسام." لم تكن لغات الشعوب الأصلية أقل شأنًا. لقد كانت مختلفة—واحتوت اختلافاتهم على معرفة لا تمتلكها أي لغة أخرى.

### The Mechanics of Language Death
### آليات موت اللغة

Languages do not die of natural causes. They die when the conditions for their transmission are disrupted—when children stop learning them, when speakers are punished for using them, when the social and economic incentives shift so that speaking the dominant language becomes a condition of survival.
اللغات لا تموت لأسباب طبيعية. إنها تموت عندما تتعطل ظروف انتقالها—عندما يتوقف الأطفال عن تعلمها، عندما يُعاقب المتحدثون على استخدامها، عندما تتغير الحوافز الاجتماعية والاقتصادية بحيث يصبح التحدث باللغة السائدة شرطًا للبقاء.

This disruption can happen gradually, through economic and demographic pressure. But across the colonial world, it was overwhelmingly *deliberate*. The suppression of Indigenous languages was not a side effect of colonization. It was a stated policy goal.
يمكن أن يحدث هذا التعطيل تدريجيًا، من خلال الضغط الاقتصادي والديموغرافي. ولكن عبر العالم الاستعماري، كان *متعمدًا* بشكل ساحق. لم يكن قمع لغات السكان الأصليين أثرًا جانبيًا للاستعمار. بل كان هدفًا سياسيًا معلنًا.

### Canada: The Residential School System (1831–1996)
### كندا: نظام المدارس الداخلية (1831–1996)

In Canada, the Indian Residential School system operated for over 160 years, with the explicit goal of eliminating Indigenous languages and cultures. An estimated 150,000 First Nations, Métis, and Inuit children were removed from their families and communities and placed in government-funded, church-operated boarding schools.
في كندا، عمل نظام المدارس الداخلية الهندية لأكثر من 160 عامًا، بهدف صريح هو القضاء على لغات وثقافات السكان الأصليين. تم إبعاد ما يقدر بنحو 150,000 طفل من الأمم الأولى (First Nations) و Métis و Inuit عن عائلاتهم ومجتمعاتهم ووضعهم في مدارس داخلية تمولها الحكومة وتديرها الكنيسة.

The central policy was articulated with chilling clarity by Duncan Campbell Scott, the Deputy Superintendent General of Indian Affairs, in 1920: "I want to get rid of the Indian problem... Our objective is to continue until there is not a single Indian in Canada that has not been absorbed into the body politic and there is no Indian question and no Indian Department."
تم التعبير عن السياسة المركزية بوضوح مخيف من قبل Duncan Campbell Scott، نائب المشرف العام للشؤون الهندية، في عام 1920: "أريد التخلص من المشكلة الهندية... هدفنا هو الاستمرار حتى لا يكون هناك هندي واحد في كندا لم يتم استيعابه في الجسد السياسي ولا توجد مسألة هندية ولا إدارة هندية."

The mechanism was language. Children were forbidden to speak their mother tongues. Punishments for speaking an Indigenous language ranged from beatings to solitary confinement to having needles pushed through their tongues. Children arrived speaking Cree, Ojibwe, Inuktitut, Dene, Haida, or any of dozens of other languages. They were punished until they stopped.
كانت الآلية هي اللغة. مُنع الأطفال من التحدث بلغاتهم الأم. تراوحت عقوبات التحدث بلغة السكان الأصليين من الضرب إلى الحبس الانفرادي إلى دفع الإبر عبر ألسنتهم. وصل الأطفال وهم يتحدثون Cree أو Ojibwe أو Inuktitut أو Dene أو Haida أو أي من عشرات اللغات الأخرى. وعوقبوا حتى توقفوا.

The Truth and Reconciliation Commission of Canada (2015) documented the systematic nature of this assault. Its final report concluded that the residential school system constituted *cultural genocide*—the destruction of the structures and practices that allow a group to continue as a group. Language was the primary target. Without language, ceremony is disrupted, oral history is broken, kinship systems become unintelligible, and the intergenerational transmission of knowledge ceases.
وثقت لجنة الحقيقة والمصالحة الكندية (2015) الطبيعة المنهجية لهذا الاعتداء. وخلص تقريرها النهائي إلى أن نظام المدارس الداخلية شكل *إبادة ثقافية*—تدمير الهياكل والممارسات التي تسمح لمجموعة بالاستمرار كمجموعة. كانت اللغة هي الهدف الأساسي. بدون اللغة، تتعطل المراسم، وينكسر التاريخ الشفوي، وتصبح أنظمة القرابة غير مفهومة، ويتوقف انتقال المعرفة بين الأجيال.

The last federally operated residential school in Canada closed in 1996. Many of the Elders who are the last fluent speakers of their languages today are residential school survivors. Their fluency is not merely a linguistic resource. It is an act of resistance.
أُغلقت آخر مدرسة داخلية تديرها الحكومة الفيدرالية في كندا في عام 1996. العديد من الشيوخ الذين هم آخر المتحدثين بطلاقة للغاتهم اليوم هم من الناجين من المدارس الداخلية. طلاقتهم ليست مجرد مورد لغوي. إنها عمل من أعمال المقاومة.

### The United States: Indian Boarding Schools (1860s–1960s)
### الولايات المتحدة: المدارس الداخلية الهندية (ستينيات القرن التاسع عشر - ستينيات القرن العشرين)

The United States operated a parallel system. Captain Richard Henry Pratt, founder of the Carlisle Indian Industrial School in 1879, coined the phrase that defined the era: "Kill the Indian, save the man." Over 350 government-funded boarding schools operated across the United States, with policies nearly identical to those in Canada. Indigenous children were forbidden to speak their languages, forced to adopt English names, and subjected to systematic cultural erasure.
أدارت الولايات المتحدة نظامًا موازيًا. صاغ الكابتن Richard Henry Pratt، مؤسس مدرسة Carlisle الصناعية الهندية في عام 1879، العبارة التي حددت العصر: "اقتل الهندي، وأنقذ الإنسان." عملت أكثر من 350 مدرسة داخلية تمولها الحكومة في جميع أنحاء الولايات المتحدة، بسياسات متطابقة تقريبًا مع تلك الموجودة في كندا. مُنع أطفال السكان الأصليين من التحدث بلغاتهم، وأُجبروا على تبني أسماء إنجليزية، وتعرضوا لمحو ثقافي منهجي.

A 2022 report by the U.S. Department of the Interior identified over 400 federal Indian boarding schools in 37 states, documenting the deaths of at least 500 children in the system—a number the report acknowledged was almost certainly a significant undercount. The investigation found that the system was designed not merely to educate but to "culturally assimilate Indian children by forcibly relocating them from their families and communities."
حدد تقرير صدر عام 2022 عن وزارة الداخلية الأمريكية أكثر من 400 مدرسة داخلية هندية فيدرالية في 37 ولاية، ووثق وفاة ما لا يقل عن 500 طفل في النظام—وهو رقم أقر التقرير بأنه من المؤكد تقريبًا أنه أقل بكثير من العدد الحقيقي. وجد التحقيق أن النظام لم يُصمم لمجرد التعليم بل لـ "استيعاب الأطفال الهنود ثقافيًا عن طريق نقلهم قسرًا من عائلاتهم ومجتمعاتهم."

The linguistic consequences were catastrophic. Of the roughly 300 Indigenous languages spoken in the territory that became the United States, more than half are now extinct. Of those that survive, most have fewer than 1,000 fluent speakers, and many have fewer than 10. The Endangered Languages Project classifies the majority of surviving Native American languages as "severely" or "critically" endangered.
كانت العواقب اللغوية كارثية. من بين ما يقرب من 300 لغة من لغات السكان الأصليين التي كان يُتحدث بها في الإقليم الذي أصبح الولايات المتحدة، انقرض أكثر من نصفها الآن. ومن بين اللغات التي نجت، فإن معظمها يضم أقل من 1000 متحدث بطلاقة، والعديد منها يضم أقل من 10. يصنف مشروع اللغات المهددة بالانقراض (Endangered Languages Project) غالبية اللغات الأمريكية الأصلية الباقية على أنها مهددة بالانقراض "بشدة" أو "بشكل حرج".

### Australia: The Stolen Generations (1910–1970)
### أستراليا: الأجيال المسروقة (1910–1970)

In Australia, government policies between 1910 and 1970 forcibly removed Aboriginal and Torres Strait Islander children from their families. These children—known as the Stolen Generations—were placed in missions, reserves, and white foster families. The explicit aim was assimilation: to breed out Aboriginal identity within a few generations.
في أستراليا، أدت السياسات الحكومية بين عامي 1910 و 1970 إلى إبعاد أطفال السكان الأصليين وسكان جزر مضيق توريس قسرًا عن عائلاتهم. تم وضع هؤلاء الأطفال—المعروفين باسم الأجيال المسروقة (Stolen Generations)—في بعثات، ومحميات، وعائلات حاضنة بيضاء. كان الهدف الصريح هو الاستيعاب: القضاء على هوية السكان الأصليين في غضون بضعة أجيال.

Aboriginal languages were suppressed in missions and government institutions. Children who spoke their languages were punished. The Bringing Them Home report (1997), produced by the Australian Human Rights Commission, documented the systematic nature of these removals and their devastating effects on language, culture, and family.
تم قمع لغات السكان الأصليين في البعثات والمؤسسات الحكومية. وعوقب الأطفال الذين تحدثوا بلغاتهم. وثق تقرير Bringing Them Home (1997)، الذي أصدرته اللجنة الأسترالية لحقوق الإنسان، الطبيعة المنهجية لعمليات الإبعاد هذه وآثارها المدمرة على اللغة والثقافة والأسرة.

Of the estimated 250 Aboriginal Australian languages spoken at the time of European contact, fewer than 20 are being transmitted to children today (Marmion et al., 2014). Over 100 are completely extinct. The remaining languages survive largely through the efforts of elderly speakers working with linguists and community organizations in a race against time.
من بين ما يقدر بنحو 250 لغة من لغات السكان الأصليين الأستراليين التي كان يُتحدث بها في وقت الاتصال الأوروبي، يتم نقل أقل من 20 لغة إلى الأطفال اليوم (Marmion وآخرون، 2014). انقرضت أكثر من 100 لغة تمامًا. وتعيش اللغات المتبقية إلى حد كبير من خلال جهود المتحدثين المسنين الذين يعملون مع اللغويين والمنظمات المجتمعية في سباق مع الزمن.

### Scandinavia: The Sámi Languages
### الدول الاسكندنافية: لغات Sámi

The suppression of Indigenous languages was not limited to settler-colonial states in the southern hemisphere. In Norway, Sweden, and Finland, Sámi children were subjected to boarding school systems (*internatskoler*) from the mid-19th century through the 1960s. Sámi languages were banned in schools; children were punished for speaking them. Norway's "Norwegianization" (*fornorskingspolitikk*) policy explicitly aimed to eliminate the Sámi language and replace it with Norwegian.
لم يقتصر قمع لغات السكان الأصليين على الدول الاستعمارية الاستيطانية في نصف الكرة الجنوبي. في النرويج والسويد وفنلندا، خضع أطفال Sámi لأنظمة المدارس الداخلية (*internatskoler*) من منتصف القرن التاسع عشر حتى ستينيات القرن العشرين. تم حظر لغات Sámi في المدارس؛ وعوقب الأطفال على التحدث بها. هدفت سياسة "النروجة" (*fornorskingspolitikk*) في النرويج صراحةً إلى القضاء على لغة Sámi واستبدالها بالنرويجية.

Of the nine surviving Sámi languages, several have fewer than 500 speakers. Ume Sámi has approximately 20. Pite Sámi has fewer than 30. The languages survive in part because of revitalization programs that began in the 1970s, including the establishment of Sámi-language schools and media—programs that arrived just in time for some dialects and too late for others.
من بين لغات Sámi التسع الباقية، يضم العديد منها أقل من 500 متحدث. تضم لغة Ume Sámi حوالي 20 متحدثًا. وتضم لغة Pite Sámi أقل من 30 متحدثًا. تعيش اللغات جزئيًا بسبب برامج التنشيط التي بدأت في السبعينيات، بما في ذلك إنشاء مدارس ووسائل إعلام بلغة Sámi—وهي برامج وصلت في الوقت المناسب لبعض اللهجات ومتأخرة جدًا للبعض الآخر.

### Aotearoa New Zealand: Te Reo Māori
### أوتياروا نيوزيلندا: Te Reo Māori

The Māori language (te reo Māori) was the majority language of Aotearoa until the mid-20th century. British colonial education policies, beginning in the 1860s, progressively marginalized te reo in schools. By the 1970s, fewer than 20% of Māori were fluent speakers, and the language was at risk of extinction within a generation.
كانت لغة الماوري (te reo Māori) هي لغة الأغلبية في أوتياروا حتى منتصف القرن العشرين. أدت سياسات التعليم الاستعماري البريطاني، بدءًا من ستينيات القرن التاسع عشر، إلى تهميش لغة te reo تدريجيًا في المدارس. بحلول السبعينيات، كان أقل من 20% من الماوري يتحدثون بطلاقة، وكانت اللغة معرضة لخطر الانقراض في غضون جيل واحد.

The Māori response was one of the earliest and most successful language revitalization movements in the world. Kōhanga reo (language nests) for preschool children, established in 1982, immersed infants and toddlers in te reo from birth. Kura kaupapa Māori (Māori-medium schools) followed. These programs, alongside the Māori Language Act of 1987 (which made te reo an official language), have stabilized the language—though fluent speakers still constitute a minority of the Māori population.
كانت استجابة الماوري واحدة من أقدم وأنجح حركات تنشيط اللغة في العالم. قامت Kōhanga reo (أعشاش اللغة) للأطفال في سن ما قبل المدرسة، والتي تأسست في عام 1982، بغمر الرضع والأطفال الصغار في لغة te reo منذ الولادة. تلتها Kura kaupapa Māori (مدارس متوسطة الماوري). أدت هذه البرامج، إلى جانب قانون لغة الماوري لعام 1987 (والذي جعل te reo لغة رسمية)، إلى استقرار اللغة—على الرغم من أن المتحدثين بطلاقة لا يزالون يشكلون أقلية من سكان الماوري.

New Zealand also produced one of the most important frameworks for Indigenous data governance: *Te Mana Raraunga*, the Māori Data Sovereignty Network. This framework asserts that Māori data—including linguistic data—is a taonga (treasure) subject to the rights and responsibilities of kaitiakitanga (guardianship). It directly informed the development of the CARE principles for Indigenous data governance and is a foundational reference for the data sovereignty mechanisms in champollion.
أنتجت نيوزيلندا أيضًا أحد أهم أطر حوكمة بيانات السكان الأصليين: *Te Mana Raraunga*، شبكة سيادة بيانات الماوري. يؤكد هذا الإطار أن بيانات الماوري—بما في ذلك البيانات اللغوية—هي taonga (كنز) يخضع لحقوق ومسؤوليات kaitiakitanga (الوصاية). وقد وجه هذا بشكل مباشر تطوير مبادئ CARE لحوكمة بيانات السكان الأصليين وهو مرجع أساسي لآليات سيادة البيانات في champollion.

### The Pattern: Language as a Target of Colonial Power
### النمط: اللغة كهدف للسلطة الاستعمارية

The geographic and cultural specifics differ, but the pattern is remarkably consistent. Across Canada, the United States, Australia, Scandinavia, and New Zealand—and in many other places, from Taiwan to Siberia to the Andean highlands—colonial and post-colonial states identified Indigenous languages as obstacles to assimilation and targeted them for elimination. The tools were similar everywhere: remove children from their families, forbid the use of Indigenous languages, punish transgressions, and reward adoption of the colonial language.
تختلف التفاصيل الجغرافية والثقافية، لكن النمط متسق بشكل ملحوظ. عبر كندا والولايات المتحدة وأستراليا والدول الاسكندنافية ونيوزيلندا—وفي العديد من الأماكن الأخرى، من تايوان إلى سيبيريا إلى مرتفعات الأنديز—حددت الدول الاستعمارية وما بعد الاستعمارية لغات السكان الأصليين كعقبات أمام الاستيعاب واستهدفتها بالقضاء عليها. كانت الأدوات متشابهة في كل مكان: إبعاد الأطفال عن عائلاتهم، وحظر استخدام لغات السكان الأصليين، ومعاقبة التجاوزات، ومكافأة تبني اللغة الاستعمارية.

This was not a historical footnote. The last residential school in Canada closed in *1996*. The last Indian boarding school in the United States closed in the *1960s*. Many of the people who survived these systems are still alive. The trauma is intergenerational. And the linguistic damage is ongoing: languages that lost a generation of speakers in the boarding school era are now losing their last fluent Elders.
لم يكن هذا حاشية تاريخية. أُغلقت آخر مدرسة داخلية في كندا في عام *1996*. وأُغلقت آخر مدرسة داخلية هندية في الولايات المتحدة في *ستينيات القرن العشرين*. العديد من الأشخاص الذين نجوا من هذه الأنظمة لا يزالون على قيد الحياة. الصدمة تنتقل عبر الأجيال. والضرر اللغوي مستمر: اللغات التي فقدت جيلاً من المتحدثين في عصر المدارس الداخلية تفقد الآن آخر شيوخها الفصحاء.

### From Cultural Genocide to "Data Scarcity"
### من الإبادة الثقافية إلى "ندرة البيانات"

This history is directly relevant to the technical problem of machine translation. When computer scientists describe a language as "low-resource," they typically mean: there are few digital texts, few parallel corpora, few dictionaries, and few annotated datasets. The framing is neutral, as if data scarcity were an act of nature, like a desert with little rain.
هذا التاريخ وثيق الصلة بالمشكلة التقنية للترجمة الآلية. عندما يصف علماء الحاسوب لغة بأنها "منخفضة الموارد"، فإنهم يعنون عادةً: هناك عدد قليل من النصوص الرقمية، وعدد قليل من مجموعات النصوص المتوازية، وعدد قليل من القواميس، وعدد قليل من مجموعات البيانات المشروحة. الإطار محايد، كما لو كانت ندرة البيانات فعلًا من أفعال الطبيعة، مثل صحراء قليلة المطر.

It is not. The "data scarcity" of Indigenous languages is the *downstream consequence* of language suppression policies. Languages that were forbidden in schools produced fewer written texts. Languages whose speakers were punished for speaking them developed fewer institutional uses. Languages that lost a generation of transmission produced fewer bilingual speakers who could create parallel corpora.
إنها ليست كذلك. إن "ندرة البيانات" في لغات السكان الأصليين هي *النتيجة اللاحقة* لسياسات قمع اللغة. اللغات التي تم حظرها في المدارس أنتجت نصوصًا مكتوبة أقل. اللغات التي عوقب متحدثوها على التحدث بها طورت استخدامات مؤسسية أقل. اللغات التي فقدت جيلاً من الانتقال أنتجت عددًا أقل من المتحدثين ثنائيي اللغة الذين يمكنهم إنشاء مجموعات نصوص متوازية.

The pipeline from cultural genocide to data scarcity is direct:
المسار من الإبادة الثقافية إلى ندرة البيانات مباشر:

1. **Suppression** → Children punished for speaking the language
2. **Disrupted transmission** → Fewer children learn the language
3. **Reduced speaker base** → Fewer adults use it in daily life
4. **Reduced institutional use** → Fewer written documents, fewer digital texts
5. **Data scarcity** → ML models have nothing to train on
6. **No MT support** → The language is invisible to technology
7. **Accelerated decline** → Technology reinforces the marginalization that policy began
1. **القمع** ← معاقبة الأطفال على التحدث باللغة
2. **تعطيل الانتقال** ← عدد أقل من الأطفال يتعلمون اللغة
3. **تقلص قاعدة المتحدثين** ← عدد أقل من البالغين يستخدمونها في الحياة اليومية
4. **انخفاض الاستخدام المؤسسي** ← وثائق مكتوبة أقل، نصوص رقمية أقل
5. **ندرة البيانات** ← نماذج التعلم الآلي (ML) ليس لديها ما تتدرب عليه
6. **لا يوجد دعم للترجمة الآلية (MT)** ← اللغة غير مرئية للتكنولوجيا
7. **تدهور متسارع** ← التكنولوجيا تعزز التهميش الذي بدأته السياسة

This pipeline means that any technology project working with Indigenous languages inherits a political and moral context whether it acknowledges it or not. A machine translation system that treats Cree language data as raw material to be ingested by models is, however inadvertently, continuing the extractive dynamic that began with residential schools. The data was made scarce by violence. The speakers who created what data exists did so against enormous odds. Any system that uses that data without the community's meaningful control is compounding the original harm.
يعني هذا المسار أن أي مشروع تكنولوجي يعمل مع لغات السكان الأصليين يرث سياقًا سياسيًا وأخلاقيًا سواء اعترف بذلك أم لا. إن نظام الترجمة الآلية الذي يعامل بيانات لغة Cree كمواد خام تبتلعها النماذج هو، وإن كان عن غير قصد، يواصل الديناميكية الاستخراجية التي بدأت مع المدارس الداخلية. أصبحت البيانات نادرة بسبب العنف. المتحدثون الذين أنشأوا ما هو موجود من بيانات فعلوا ذلك ضد احتمالات هائلة. أي نظام يستخدم تلك البيانات دون سيطرة مجدية من المجتمع يضاعف الضرر الأصلي.

### The Complicity of the Sciences and Western Ideology
### تواطؤ العلوم والأيديولوجية الغربية

It is critical to recognize that science and technology were not innocent bystanders to this colonial project; they were active participants. The "Enlightenment" ideology that sought to categorize, quantify, and standardize the world often treated Indigenous peoples and their languages merely as subjects of research or curiosities for a "salvage anthropology." This extractive practice locked knowledge in Western universities while doing little to stop the political machinery destroying those communities. 
من الأهمية بمكان أن ندرك أن العلم والتكنولوجيا لم يكونا متفرجين أبرياء على هذا المشروع الاستعماري؛ بل كانا مشاركين نشطين. إن أيديولوجية "التنوير" التي سعت إلى تصنيف العالم وقياسه وتوحيده غالبًا ما عاملت الشعوب الأصلية ولغاتها مجرد مواضيع للبحث أو فضول لـ "أنثروبولوجيا الإنقاذ". أدت هذه الممارسة الاستخراجية إلى حبس المعرفة في الجامعات الغربية بينما لم تفعل الكثير لوقف الآلة السياسية التي تدمر تلك المجتمعات.

This project stands in stark contrast to methodologies like the Tuskegee syphilis study or extractive linguistic anthropology, which treat BIPOC people as experimental subjects or passive providers of raw data. We are not here to experiment on Indigenous people, extract their knowledge, or force a Western culturally monolithic ideology upon them. Our aim is to facilitate their *own* ways of knowing and their *own* standards of value. We provide the infrastructure; the language communities build the test sets, define the metrics, and maintain the buy-in. Without their buy-in, none of this works.
يقف هذا المشروع في تناقض صارخ مع منهجيات مثل دراسة Tuskegee لمرض الزهري أو الأنثروبولوجيا اللغوية الاستخراجية، والتي تعامل الأشخاص من ذوي البشرة الملونة والسكان الأصليين (BIPOC) كمواضيع تجريبية أو مزودين سلبيين للبيانات الخام. نحن لسنا هنا لإجراء تجارب على السكان الأصليين، أو استخراج معرفتهم، أو فرض أيديولوجية غربية متجانسة ثقافيًا عليهم. هدفنا هو تسهيل طرقهم *الخاصة* في المعرفة ومعايير القيمة *الخاصة* بهم. نحن نوفر البنية التحتية؛ وتقوم مجتمعات اللغة ببناء مجموعات الاختبار، وتحديد المقاييس، والحفاظ على المشاركة. بدون مشاركتهم، لن ينجح أي من هذا.

### Why This History Shapes Our Design
### لماذا يشكل هذا التاريخ تصميمنا

This is why champollion's governance model is not a feature—it is the foundation. Every major design decision in the project is a *direct response* to the history described above. The goal is data sovereignty: to support communities in sustaining, revitalizing, and governing their living languages entirely on their own terms.
لهذا السبب لا يُعد نموذج حوكمة champollion ميزة—بل هو الأساس. كل قرار تصميم رئيسي في المشروع هو *استجابة مباشرة* للتاريخ الموصوف أعلاه. الهدف هو سيادة البيانات: دعم المجتمعات في الحفاظ على لغاتها الحية وتنشيطها وحوكمتها بالكامل وفقًا لشروطها الخاصة.

**Why the test data is encrypted and held by community trusts.** Because Indigenous linguistic data has been extracted, published, and exploited without consent for over a century. Missionary linguistics, such as the efforts by the Summer Institute of Linguistics (SIL), historically monopolized Indigenous parallel corpora under an extractive, assimilationist framework. Furthermore, unlike many modern NLP projects that rely heavily on translated Bibles as their primary parallel corpus for low-resource languages, we explicitly do not use translated Bibles as corpuses. The encrypted test set, with keys held only by the community's governance organization, is a technical mechanism that makes it *architecturally impossible* to repeat extractive patterns.
**لماذا يتم تشفير بيانات الاختبار والاحتفاظ بها من قبل صناديق المجتمع.** لأن البيانات اللغوية للسكان الأصليين تم استخراجها ونشرها واستغلالها دون موافقة لأكثر من قرن. احتكرت اللغويات التبشيرية، مثل جهود المعهد الصيفي للغويات (SIL)، تاريخيًا مجموعات النصوص المتوازية للسكان الأصليين في ظل إطار استخراجي واستيعابي. علاوة على ذلك، على عكس العديد من مشاريع معالجة اللغات الطبيعية (NLP) الحديثة التي تعتمد بشكل كبير على الأناجيل المترجمة كمجموعة نصوص متوازية أساسية للغات منخفضة الموارد، فإننا لا نستخدم صراحة الأناجيل المترجمة كمجموعات نصوص. مجموعة الاختبار المشفرة، مع المفاتيح التي تحتفظ بها فقط منظمة حوكمة المجتمع، هي آلية تقنية تجعل من *المستحيل معماريًا* تكرار الأنماط الاستخراجية.

**Why we use sandboxed execution instead of open test sets.** Because once linguistic data is published openly, the community loses control over it permanently. Conventional ML benchmarks publish their test sets—anyone can download them, train on them, or use them for any purpose. This modern AI data scraping represents a new form of "data colonialism" and "digital enclosure." For communities whose languages were nearly eradicated by force, losing control over their remaining linguistic resources is not a minor inconvenience. It is a direct continuation of historical territorial dispossession. Sandboxed execution ensures that the community's data never leaves their infrastructure.
**لماذا نستخدم التنفيذ في بيئة معزولة (sandboxed execution) بدلاً من مجموعات الاختبار المفتوحة.** لأنه بمجرد نشر البيانات اللغوية بشكل مفتوح، يفقد المجتمع السيطرة عليها بشكل دائم. تنشر معايير التعلم الآلي التقليدية مجموعات الاختبار الخاصة بها—يمكن لأي شخص تنزيلها أو التدريب عليها أو استخدامها لأي غرض. يمثل كشط بيانات الذكاء الاصطناعي الحديث هذا شكلاً جديدًا من أشكال "استعمار البيانات" و "التطويق الرقمي". بالنسبة للمجتمعات التي كادت لغاتها أن تُمحى بالقوة، فإن فقدان السيطرة على مواردها اللغوية المتبقية ليس إزعاجًا بسيطًا. إنه استمرار مباشر للتجريد التاريخي من الأراضي. يضمن التنفيذ في بيئة معزولة عدم مغادرة بيانات المجتمع للبنية التحتية الخاصة بهم أبدًا.

**Why method ownership transfers to the community.** Because the history of "helping" Indigenous communities is, overwhelmingly, a history of outsiders building things *about* Indigenous people rather than *for* or *with* them. Academic papers are published, grants are collected, careers are advanced—and the community is left with nothing. The ownership transfer mechanism ensures that when an ML engineer builds a working translation method for Plains Cree, the Plains Cree community *owns that method*. The engineer keeps credit and attribution. The community keeps the asset.
**لماذا تنتقل ملكية الطريقة إلى المجتمع.** لأن تاريخ "مساعدة" مجتمعات السكان الأصليين هو، بشكل ساحق، تاريخ من الغرباء الذين يبنون أشياء *عن* السكان الأصليين بدلاً من *لهم* أو *معهم*. تُنشر الأوراق الأكاديمية، وتُجمع المنح، وتتقدم المسيرات المهنية—ويُترك المجتمع بلا شيء. تضمن آلية نقل الملكية أنه عندما يبني مهندس تعلم آلي طريقة ترجمة فعالة للغة Plains Cree، فإن مجتمع Plains Cree *يمتلك تلك الطريقة*. يحتفظ المهندس بالفضل والنسب. ويحتفظ المجتمع بالأصل.

**Why anything a community-owned method earns belongs entirely to the community.** Because language revitalization is expensive, and the communities doing the hardest work—the Elders teaching, the parents sending children to immersion schools, the activists running language nests—are chronically underfunded. Furthermore, the very AI infrastructure we use (e.g., data centers, mineral mining, water use) exacts a disproportionate material toll on Indigenous lands globally. Champollion is a non-commercial project and holds no claim on any of it: if a Cree translation method ever generates value, that value should fund Cree language programs. Technology should be a tool that serves communities, not a mechanism that extracts value from them.
**لماذا ينتمي أي شيء تكسبه طريقة مملوكة للمجتمع بالكامل إلى المجتمع.** لأن تنشيط اللغة مكلف، والمجتمعات التي تقوم بأصعب عمل—الشيوخ الذين يعلمون، والآباء الذين يرسلون أطفالهم إلى مدارس الانغماس، والنشطاء الذين يديرون أعشاش اللغة—يعانون من نقص مزمن في التمويل. علاوة على ذلك، فإن البنية التحتية للذكاء الاصطناعي التي نستخدمها (مثل مراكز البيانات، وتعدين المعادن، واستخدام المياه) تفرض خسائر مادية غير متناسبة على أراضي السكان الأصليين على مستوى العالم. Champollion هو مشروع غير تجاري ولا يطالب بأي من ذلك: إذا ولدت طريقة ترجمة Cree قيمة في أي وقت، فيجب أن تمول هذه القيمة برامج لغة Cree. يجب أن تكون التكنولوجيا أداة تخدم المجتمعات، وليست آلية تستخرج القيمة منها.

**Why we say "sovereignty-aspirant" rather than claiming compliance.** Indigenous data-sovereignty frameworks were developed by specific peoples for specific contexts — First Nations data-sovereignty principles in Canada, CARE (Collective Benefit, Authority to Control, Responsibility, Ethics), Te Mana Raraunga (Māori Data Sovereignty), and the FAIR principles each address these concerns from different cultural and legal positions. We do not claim to implement any of them in full; that determination belongs to the communities who authored them. We say our design is *sovereignty-aspirant* — built so that communities *can* exercise ownership, control, access, and possession of their data and the technologies derived from it. The architecture reaches toward sovereignty; whether it achieves sovereignty is for the communities to decide. We treat this as unfinished work, welcome objections, and will act on them.
**لماذا نقول "طامح إلى السيادة" بدلاً من ادعاء الامتثال.** طُوِّرت أطر سيادة بيانات الشعوب الأصلية من قبل شعوب محددة لسياقات محددة — فمبادئ الأمم الأولى لسيادة البيانات في كندا، ومبادئ CARE (المنفعة الجماعية، سلطة السيطرة، المسؤولية، الأخلاق)، و Te Mana Raraunga (سيادة بيانات الماوري)، ومبادئ FAIR، تعالج كلٌّ منها هذه المخاوف من مواقف ثقافية وقانونية مختلفة. نحن لا ندعي تنفيذ أي منها بالكامل؛ هذا التحديد يخص المجتمعات التي صاغتها. نقول إن تصميمنا *طامح إلى السيادة (sovereignty-aspirant)* — تم بناؤه بحيث *يمكن* للمجتمعات ممارسة الملكية والسيطرة والوصول والحيازة لبياناتها والتقنيات المستمدة منها. تصل البنية نحو السيادة؛ وما إذا كانت تحقق السيادة متروك للمجتمعات لتقرره. نحن نتعامل مع هذا كعمل غير مكتمل، ونرحب بالاعتراضات، وسنتصرف بناءً عليها.

**Why the platform benchmarks *methods*, not *models*.** Because Indigenous language communities should not be dependent on any single corporation's model. The open architecture of a "method" means the solution doesn't even have to be a costly, material-heavy LLM. It could be a highly efficient, community-hosted rule-based system running on traditional computing hardware. If the best translation method for Cree uses Google's Gemini today, the community should be able to switch to an open-source or deterministic alternative tomorrow without rebuilding everything. Method-level benchmarking ensures that the community's asset is a *recipe*, not a dependency.
**لماذا تقيس المنصة أداء *الطرق*، وليس *النماذج*.** لأن مجتمعات لغات السكان الأصليين لا ينبغي أن تعتمد على نموذج أي شركة واحدة. تعني البنية المفتوحة لـ "الطريقة" أن الحل لا يجب أن يكون نموذجًا لغويًا كبيرًا (LLM) مكلفًا وثقيلًا ماديًا. يمكن أن يكون نظامًا عالي الكفاءة قائمًا على القواعد يستضيفه المجتمع ويعمل على أجهزة حوسبة تقليدية. إذا كانت أفضل طريقة ترجمة للغة Cree تستخدم Gemini من Google اليوم، فيجب أن يكون المجتمع قادرًا على التبديل إلى بديل مفتوح المصدر أو حتمي غدًا دون إعادة بناء كل شيء. تضمن المقارنة المعيارية على مستوى الطريقة أن أصل المجتمع هو *وصفة*، وليس تبعية.

**Why the community must build this infrastructure now.** The paradox of leveraging AI while critiquing its material extraction is resolved by a harsh strategic reality: if this problem isn't solved by the community on their own sovereign terms, it will inevitably be "solved" by others on extractive terms. Even if a massive corporation eventually builds a translation model for a given Indigenous language, the community requires its own independent, sandboxed benchmarking infrastructure to verify *when* and *if* they have actually succeeded according to community standards—and to ensure the community captures the value of that success.
**لماذا يجب على المجتمع بناء هذه البنية التحتية الآن.** يتم حل مفارقة الاستفادة من الذكاء الاصطناعي مع انتقاد استخراجه المادي من خلال واقع استراتيجي قاسٍ: إذا لم يتم حل هذه المشكلة من قبل المجتمع بشروطه السيادية الخاصة، فسيتم "حلها" حتمًا من قبل الآخرين بشروط استخراجية. حتى لو قامت شركة ضخمة في النهاية ببناء نموذج ترجمة للغة معينة من لغات السكان الأصليين، فإن المجتمع يتطلب بنية تحتية مستقلة ومعزولة للمقارنة المعيارية للتحقق *متى* و *إذا* كانوا قد نجحوا بالفعل وفقًا لمعايير المجتمع—ولضمان حصول المجتمع على قيمة ذلك النجاح.

This is not politics bolted onto technology. It is technology designed by people who understand the history.
هذه ليست سياسة ملحقة بالتكنولوجيا. إنها تكنولوجيا صممها أشخاص يفهمون التاريخ.

---

## VI. The Current Moment: 6,800 Languages Left Behind
## سادسًا. اللحظة الحالية: 6800 لغة تُركت في الخلف

### The Scale of the Problem
### حجم المشكلة

Of the roughly 7,000 living languages spoken on Earth today, only around 550 have machine translation of any kind — and barely 200 are served by a deployed commercial service ([how we count](/docs/network/context/coverage-counting)). The rest are invisible to the technology—not because they are less worthy, but because the statistical and neural approaches that dominate modern MT are fundamentally *data-hungry*. They require millions of parallel sentences to learn from. For most of the world's languages, those sentences do not exist.
من بين ما يقرب من 7000 لغة حية يُتحدث بها على الأرض اليوم، تمتلك حوالي 550 لغة فقط ترجمة آلية من أي نوع — وبالكاد يتم تقديم خدمة تجارية منشورة لـ 200 لغة ([كيف نحسب](/docs/network/context/coverage-counting)). الباقي غير مرئي للتكنولوجيا—ليس لأنها أقل قيمة، ولكن لأن المناهج الإحصائية والعصبية التي تهيمن على الترجمة الآلية الحديثة *متعطشة للبيانات* بشكل أساسي. إنها تتطلب ملايين الجمل المتوازية للتعلم منها. بالنسبة لمعظم لغات العالم، هذه الجمل غير موجودة.

The languages most affected are precisely those most endangered: Indigenous languages, minority languages, oral traditions with limited written records. These are languages whose speakers are often elderly, whose communities are small, whose political power is minimal. They are the languages that most need technological support for preservation and revitalization—and they are the languages for which existing technology is least useful.
اللغات الأكثر تضررًا هي على وجه التحديد تلك الأكثر عرضة للانقراض: لغات السكان الأصليين، ولغات الأقليات، والتقاليد الشفوية ذات السجلات المكتوبة المحدودة. هذه هي اللغات التي غالبًا ما يكون متحدثوها من كبار السن، ومجتمعاتها صغيرة، وقوتها السياسية في حدها الأدنى. إنها اللغات الأكثر احتياجًا للدعم التكنولوجي للحفظ والتنشيط—وهي اللغات التي تكون التكنولوجيا الحالية أقل فائدة لها.

### The Polysynthetic Challenge
### التحدي متعدد التركيب

The problem is not merely one of data scarcity. Many of the world's most endangered languages are *polysynthetic*—they have morphological systems of extraordinary complexity that fundamentally break the assumptions of standard NLP.
المشكلة ليست مجرد ندرة البيانات. العديد من اللغات الأكثر عرضة للانقراض في العالم هي لغات *متعددة التركيب* (polysynthetic)—لديها أنظمة صرفية ذات تعقيد غير عادي تكسر بشكل أساسي افتراضات معالجة اللغات الطبيعية (NLP) القياسية.

Consider Plains Cree (nêhiyawêwin), an Algonquian language spoken across the Canadian prairies. A single Cree verb can encode information that English would spread across an entire clause: the subject, the object, the tense, the aspect, the evidentiality, the modality, and various other grammatical categories, all packed into a single word through a system of prefixes, suffixes, and internal modifications.
تأمل لغة Plains Cree (nêhiyawêwin)، وهي لغة Algonquian يُتحدث بها عبر البراري الكندية. يمكن لفعل واحد في لغة Cree أن يشفر معلومات قد تنشرها الإنجليزية عبر جملة كاملة: الفاعل، والمفعول به، والزمن، والجانب، والأدلة، والجهة (modality)، وفئات نحوية أخرى مختلفة، كلها معبأة في كلمة واحدة من خلال نظام من السوابق واللواحق والتعديلات الداخلية.

This creates several problems for standard MT approaches:
يخلق هذا العديد من المشاكل لمناهج الترجمة الآلية القياسية:

1. **Tokenization failure.** Subword tokenizers like BPE (Byte Pair Encoding), designed for analytic languages like English, shatter polysynthetic words into meaningless fragments. The morphological structure is destroyed before the model ever sees it. BPE is not neutral; it represents a purely empiricist, surface-level epistemology that fundamentally clashes with the deep, rule-based morphological hierarchies inherent to polysynthetic languages. It is an architectural bias that actively dismantles structural morphology.
1. **فشل التقسيم إلى رموز (Tokenization).** تقوم أدوات التقسيم إلى رموز فرعية مثل BPE (تشفير زوج البايت)، المصممة للغات التحليلية مثل الإنجليزية، بتحطيم الكلمات متعددة التركيب إلى أجزاء لا معنى لها. يتم تدمير البنية الصرفية قبل أن يراها النموذج. BPE ليس محايدًا؛ فهو يمثل نظرية معرفية تجريبية بحتة على المستوى السطحي تتعارض بشكل أساسي مع التسلسلات الهرمية الصرفية العميقة القائمة على القواعد المتأصلة في اللغات متعددة التركيب. إنه تحيز معماري يفكك بنشاط الصرف الهيكلي.

2. **Combinatorial explosion.** A polysynthetic language may have millions of possible word forms for a single verb root. No training corpus, however large, can contain more than a tiny fraction of them. Neural models have no way to *generalize* to unseen forms.
2. **الانفجار التوافقي.** قد تحتوي اللغة متعددة التركيب على ملايين أشكال الكلمات الممكنة لجذر فعل واحد. لا يمكن لأي مجموعة نصوص تدريبية، مهما كانت كبيرة، أن تحتوي على أكثر من جزء ضئيل منها. ليس لدى النماذج العصبية أي طريقة لـ *التعميم* على الأشكال غير المرئية.

3. **Hallucination.** Large language models, when asked to translate into polysynthetic languages, often generate morphologically invalid forms—words that no native speaker would ever produce. The model has learned statistical patterns from limited data but has no understanding of the language's morphological rules.
3. **الهلوسة.** غالبًا ما تولد النماذج اللغوية الكبيرة، عندما يُطلب منها الترجمة إلى لغات متعددة التركيب، أشكالًا غير صالحة صرفيًا—كلمات لن ينتجها أي متحدث أصلي أبدًا. لقد تعلم النموذج أنماطًا إحصائية من بيانات محدودة ولكن ليس لديه فهم للقواعد الصرفية للغة.

### Finite State Transducers: The Bridge
### محولات الحالة المحدودة: الجسر

There is, however, a technology that *does* handle morphological complexity well: the **Finite State Transducer** (FST). An FST is a formal computational device that maps between an input string and an output string through a series of state transitions. For morphological analysis, an FST can map a surface word form to its underlying morphological structure (and vice versa), handling the full combinatorial complexity of the language's morphology.
ومع ذلك، هناك تقنية *تتعامل* مع التعقيد الصرفي بشكل جيد: **محول الحالة المحدودة** (FST). FST هو جهاز حسابي رسمي يعين بين سلسلة إدخال وسلسلة إخراج من خلال سلسلة من انتقالات الحالة. بالنسبة للتحليل الصرفي، يمكن لـ FST تعيين شكل كلمة سطحي إلى بنيته الصرفية الأساسية (والعكس صحيح)، والتعامل مع التعقيد التوافقي الكامل لصرف اللغة.

FSTs are the direct descendants of Pāṇini's rewriting rules. They are Chomsky's Type 3 (regular) grammars in computational form. They are the living embodiment of the connection between formal linguistics and computation. 
محولات FST هي أحفاد مباشرون لقواعد إعادة الكتابة لـ Pāṇini. إنها قواعد Chomsky من النوع 3 (المنتظمة) في شكل حسابي. إنها التجسيد الحي للارتباط بين اللغويات الرسمية والحوسبة.

In pairing FSTs with LLMs, `champollion` executes a crucial philosophical synthesis: it reconciles the *rationalist* structural tradition (rules) with the *empiricist* statistical paradigm (probability) to counteract the data-hungry, majoritarian biases of modern AI.
في إقران محولات FST مع النماذج اللغوية الكبيرة (LLMs)، ينفذ `champollion` توليفة فلسفية حاسمة: فهو يوفق بين التقليد الهيكلي *العقلاني* (القواعد) والنموذج الإحصائي *التجريبي* (الاحتمال) لمواجهة التحيزات المتعطشة للبيانات والأغلبية للذكاء الاصطناعي الحديث.

For polysynthetic languages, FSTs can provide something that neural models cannot: *deterministic verification*. Given a word form, an FST can say definitively whether it is a valid form in the language—not probabilistically, not "this looks right," but *yes* or *no*. This is the answer to the core query that haunts neural MT for low-resource languages: *How do you verify that a generated word is real without a human in the loop?*
بالنسبة للغات متعددة التركيب، يمكن لمحولات FST توفير شيء لا تستطيع النماذج العصبية توفيره: *التحقق الحتمي*. بالنظر إلى شكل كلمة، يمكن لـ FST أن يقول بشكل قاطع ما إذا كان شكلاً صالحًا في اللغة—ليس بشكل احتمالي، وليس "هذا يبدو صحيحًا"، ولكن *نعم* أو *لا*. هذه هي الإجابة على الاستعلام الأساسي الذي يطارد الترجمة الآلية العصبية للغات منخفضة الموارد: *كيف تتحقق من أن الكلمة المولدة حقيقية بدون وجود إنسان في الحلقة؟*

The technical answer is: you use the formal grammar. You use the very tools that Pāṇini invented twenty-five centuries ago, encoded in the computational formalism that Turing and Chomsky made rigorous.
الإجابة التقنية هي: أنت تستخدم القواعد الرسمية. أنت تستخدم نفس الأدوات التي اخترعها Pāṇini قبل خمسة وعشرين قرنًا، مشفرة في الشكلية الحسابية التي جعلها Turing و Chomsky صارمة.

However, we must recognize that this deterministic power carries its own risks. Enforcing a "yes" or "no" validation onto an oral, fluid language risks imposing a rigid Standard Language Ideology. When an FST dictates what is "correct," it can inadvertently recapitulate the very colonial normativity it was designed to evade—flattening dialectal variation, punishing code-switching, and enforcing a singular, normalized grammar on a diverse community. Because FSTs represent just one metric of formal correctness, their rigid empiricism must be tempered. This is precisely why the community must hold the pen. The community sets the standard, builds the rules, and defines what the machine accepts as valid, engineering FSTs that carve out space for oral fluidity and regional dialects. The formal grammar is not a universal truth handed down by computer scientists; it is an infrastructure operated by the speakers themselves.
ومع ذلك، يجب أن ندرك أن هذه القوة الحتمية تحمل مخاطرها الخاصة. إن فرض تحقق "نعم" أو "لا" على لغة شفوية وسلسة يهدد بفرض أيديولوجية لغة قياسية صارمة. عندما يملي FST ما هو "صحيح"، فإنه يمكن أن يلخص عن غير قصد نفس المعيارية الاستعمارية التي صُمم للتهرب منها—تسطيح الاختلاف اللهجي، ومعاقبة التبديل اللغوي (code-switching)، وفرض قواعد نحوية مفردة وموحدة على مجتمع متنوع. نظرًا لأن محولات FST تمثل مقياسًا واحدًا فقط للصحة الرسمية، يجب تخفيف تجريبيتها الصارمة. هذا هو بالضبط سبب وجوب أن يمسك المجتمع بالقلم. يضع المجتمع المعيار، ويبني القواعد، ويحدد ما تقبله الآلة كصالح، ويهندس محولات FST التي تقتطع مساحة للسيولة الشفوية واللهجات الإقليمية. القواعد الرسمية ليست حقيقة عالمية يسلمها علماء الحاسوب؛ إنها بنية تحتية يديرها المتحدثون أنفسهم.

### champollion: Where the Threads Converge
### champollion: حيث تتقارب الخيوط

This is where the champollion project enters the story. It sits at the exact convergence point of all the threads we have traced:
هنا يدخل مشروع champollion القصة. إنه يقع في نقطة التقارب الدقيقة لجميع الخيوط التي تتبعناها:

- **From Pāṇini**: The principle that language can be described by formal, generative rules.
- **From Schleicher and Sapir**: The understanding that the world's languages are diverse, structured, and often endangered.
- **From the residential schools and their aftermath**: The understanding that "data scarcity" is not a neutral technical fact but the consequence of deliberate language suppression—and that any technology touching these languages must be built with sovereignty at the foundation.
- **From Chomsky**: The formal hierarchy of grammars that connects linguistics to computation.
- **From Shannon**: The mathematical framework for understanding communication, noise, and signal.
- **From Turing and von Neumann**: The universal machines that can execute any computable function.
- **From Weaver and the IBM Models**: The insight that translation can be treated as a statistical problem.
- **From the Transformer revolution**: The powerful neural models that can translate—but only when they have enough data.
- **From the FST tradition**: The formal tools that can handle morphological complexity where neural models fail.
- **From Indigenous data-sovereignty frameworks — CARE, Te Mana Raraunga, and their peers**: The governance frameworks that ensure technology serves communities rather than extracting from them.
- **من Pāṇini**: المبدأ القائل بأنه يمكن وصف اللغة بقواعد رسمية وتوليدية.
- **من Schleicher و Sapir**: الفهم بأن لغات العالم متنوعة ومنظمة وغالبًا ما تكون مهددة بالانقراض.
- **من المدارس الداخلية وعواقبها**: الفهم بأن "ندرة البيانات" ليست حقيقة تقنية محايدة بل نتيجة لقمع اللغة المتعمد—وأن أي تقنية تمس هذه اللغات يجب أن تُبنى مع السيادة في الأساس.
- **من Chomsky**: التسلسل الهرمي الرسمي للقواعد الذي يربط اللغويات بالحوسبة.
- **من Shannon**: الإطار الرياضي لفهم الاتصال والضوضاء والإشارة.
- **من Turing و von Neumann**: الآلات العالمية التي يمكنها تنفيذ أي وظيفة قابلة للحساب.
- **من Weaver ونماذج IBM**: الرؤية القائلة بأنه يمكن التعامل مع الترجمة كمشكلة إحصائية.
- **من ثورة Transformer**: النماذج العصبية القوية التي يمكنها الترجمة—ولكن فقط عندما يكون لديها بيانات كافية.
- **من تقليد FST**: الأدوات الرسمية التي يمكنها التعامل مع التعقيد الصرفي حيث تفشل النماذج العصبية.
- **من أطر سيادة بيانات الشعوب الأصلية — CARE و Te Mana Raraunga ونظيراتها**: أطر الحوكمة التي تضمن أن التكنولوجيا تخدم المجتمعات بدلاً من الاستخراج منها.

champollion is a platform designed to direct the competitive energy of the machine learning community toward languages that the market has abandoned. It provides a benchmarking infrastructure where anyone can submit a translation method—neural, rule-based, hybrid, or novel—and have it evaluated against rigorous standards. Crucially, it uses FST-based validation to ensure that generated forms are morphologically valid, and it relies on native speaker verification as the ultimate ground truth.
champollion هي منصة مصممة لتوجيه الطاقة التنافسية لمجتمع التعلم الآلي نحو اللغات التي تخلى عنها السوق. إنها توفر بنية تحتية للمقارنة المعيارية حيث يمكن لأي شخص تقديم طريقة ترجمة—عصبية، أو قائمة على القواعد، أو هجينة، أو جديدة—وتقييمها وفقًا لمعايير صارمة. والأهم من ذلك، أنها تستخدم التحقق القائم على FST لضمان أن الأشكال المولدة صالحة صرفيًا، وتعتمد على تحقق المتحدث الأصلي كحقيقة أساسية نهائية.

The platform embodies several principles that this history makes clear:
تجسد المنصة عدة مبادئ يوضحها هذا التاريخ:

**No single approach is sufficient.** The history of MT is a history of paradigm shifts—from rules to statistics to neural networks. Each new paradigm solved problems the previous one couldn't, but each also had blind spots. For low-resource polysynthetic languages, the answer is almost certainly *hybrid*: neural fluency constrained by formal correctness.
**لا يوجد نهج واحد كافٍ.** تاريخ الترجمة الآلية هو تاريخ من التحولات النموذجية—من القواعد إلى الإحصائيات إلى الشبكات العصبية. حل كل نموذج جديد مشاكل لم يستطع النموذج السابق حلها، ولكن كان لكل منها أيضًا نقاط عمياء. بالنسبة للغات متعددة التركيب منخفضة الموارد، فإن الإجابة هي بالتأكيد *هجينة*: طلاقة عصبية مقيدة بالصحة الرسمية.

**Data sovereignty is not optional—it is a structural response to historical harm.** As Section V documents in detail, Indigenous languages are not merely "data-scarce" by accident. They were made scarce by deliberate policy. The project's sovereignty-aspirant design—ensuring that language data remains under the control of Indigenous communities, that decryption keys are held by community trusts, that algorithm ownership transfers to speakers—is not an afterthought. It is a direct response to centuries of extractive practice, from residential school-era documentation by outsiders to modern-day dataset scraping.
**سيادة البيانات ليست اختيارية—إنها استجابة هيكلية للضرر التاريخي.** كما يوثق القسم الخامس بالتفصيل، فإن لغات السكان الأصليين ليست مجرد "نادرة البيانات" عن طريق الصدفة. لقد أصبحت نادرة بسبب سياسة متعمدة. إن تصميم المشروع الطامح إلى السيادة—والذي يضمن بقاء بيانات اللغة تحت سيطرة مجتمعات السكان الأصليين، واحتفاظ صناديق المجتمع بمفاتيح فك التشفير، ونقل ملكية الخوارزمية إلى المتحدثين—ليس فكرة لاحقة. إنه استجابة مباشرة لقرون من الممارسة الاستخراجية، من التوثيق في عصر المدارس الداخلية من قبل الغرباء إلى كشط مجموعات البيانات في العصر الحديث.

An earlier version of this paragraph said the architecture makes repeating those patterns *technically impossible*. That was an overclaim and it has been withdrawn. The mechanisms are real and specific — a corpus is encrypted on the holder's own device before anything leaves it, decryption requires several custodians acting together rather than any single party, and corpus content is fetched from its source rather than hosted here — but "impossible" is not a property any of them can carry. Software has bugs, operators make mistakes, and a determined party with enough of the right roles is a residual risk that no design removes. The honest claim is that the easy paths are closed and the hard ones leave evidence. What this project can promise is mechanism and disclosure, not impossibility.
ذكرت نسخة سابقة من هذه الفقرة أن البنية تجعل تكرار تلك الأنماط *مستحيلاً تقنيًا*. كان ذلك ادعاءً مبالغًا فيه وتم سحبه. الآليات حقيقية ومحددة — يتم تشفير مجموعة النصوص على جهاز الحائز نفسه قبل أن يغادره أي شيء، ويتطلب فك التشفير عدة أمناء يتصرفون معًا بدلاً من أي طرف واحد، ويتم جلب محتوى مجموعة النصوص من مصدره بدلاً من استضافته هنا — لكن "المستحيل" ليس خاصية يمكن لأي منها أن يحملها. تحتوي البرمجيات على أخطاء، ويرتكب المشغلون أخطاء، ويمثل الطرف المصمم الذي يتمتع بما يكفي من الأدوار الصحيحة خطرًا متبقيًا لا يزيله أي تصميم. الادعاء الصادق هو أن المسارات السهلة مغلقة والمسارات الصعبة تترك أدلة. ما يمكن أن يعد به هذا المشروع هو الآلية والإفصاح، وليس الاستحالة.

**The long game is revitalization.** Translation is the *proving ground*, but the real prize is language revitalization through teaching. The formal grammars and morphological models built for machine translation are precisely the technical foundations needed for machine-assisted language learning. If we can build an FST that validates Cree verb forms for a translation system, we can also use that FST to help a student learn to conjugate Cree verbs.
**اللعبة الطويلة هي التنشيط.** الترجمة هي *أرضية الإثبات*، لكن الجائزة الحقيقية هي تنشيط اللغة من خلال التدريس. القواعد الرسمية والنماذج الصرفية المبنية للترجمة الآلية هي بالضبط الأسس التقنية اللازمة لتعلم اللغة بمساعدة الآلة. إذا تمكنا من بناء FST يتحقق من صحة أشكال أفعال Cree لنظام ترجمة، فيمكننا أيضًا استخدام FST هذا لمساعدة الطالب على تعلم تصريف أفعال Cree.

### Why This Moment
### لماذا هذه اللحظة

We are living in a unique moment in the history of language technology. Several factors have converged:
نحن نعيش في لحظة فريدة في تاريخ تكنولوجيا اللغة. لقد تقاربت عدة عوامل:

1. **Open-source tools are mature.** The FST toolkits (like HFST and Foma), the neural MT frameworks (like OpenNMT and Fairseq), and the evaluation infrastructure can now be assembled by a small team at minimal cost.
1. **الأدوات مفتوحة المصدر ناضجة.** يمكن الآن تجميع مجموعات أدوات FST (مثل HFST و Foma)، وأطر الترجمة الآلية العصبية (مثل OpenNMT و Fairseq)، وبنية التقييم التحتية بواسطة فريق صغير بأقل تكلفة.

2. **Community organizing is accelerating.** Indigenous language communities are increasingly sophisticated in their use of technology and their assertion of data sovereignty. Organizations like the First Voices initiative, the Canadian Indigenous Languages Technology Project, and numerous community-led efforts are building the human infrastructure that technology alone cannot provide.
2. **التنظيم المجتمعي يتسارع.** أصبحت مجتمعات لغات السكان الأصليين متطورة بشكل متزايد في استخدامها للتكنولوجيا وتأكيدها على سيادة البيانات. تقوم منظمات مثل مبادرة First Voices، ومشروع تكنولوجيا لغات السكان الأصليين الكندي، والعديد من الجهود التي يقودها المجتمع ببناء البنية التحتية البشرية التي لا يمكن للتكنولوجيا وحدها توفيرها.

3. **AI capabilities have reached a threshold.** Large language models, while insufficient on their own for low-resource MT, can serve as powerful components in hybrid systems—generating candidate translations that are then verified and constrained by formal methods.
3. **وصلت قدرات الذكاء الاصطناعي إلى عتبة.** يمكن للنماذج اللغوية الكبيرة، على الرغم من عدم كفايتها بمفردها للترجمة الآلية منخفضة الموارد، أن تعمل كمكونات قوية في الأنظمة الهجينة—حيث تولد ترجمات مرشحة يتم التحقق منها وتقييدها بعد ذلك بالطرق الرسمية.

4. **The cost has collapsed.** What would have required a government laboratory in 1954 or a major corporation in 2000 can now be done with cloud computing credits and open-source software. The bottleneck is no longer technology or money. It is *will*.
4. **انهارت التكلفة.** ما كان يتطلب مختبرًا حكوميًا في عام 1954 أو شركة كبرى في عام 2000 يمكن القيام به الآن باستخدام أرصدة الحوسبة السحابية والبرمجيات مفتوحة المصدر. لم تعد عنق الزجاجة هي التكنولوجيا أو المال. إنها *الإرادة*.

The question is not whether the technology can be built. It can. The question is whether it will be built *correctly*—with the right governance, the right incentives, and the right respect for the communities it is meant to serve.
السؤال ليس ما إذا كان يمكن بناء التكنولوجيا. يمكن ذلك. السؤال هو ما إذا كان سيتم بناؤها *بشكل صحيح*—بالحوكمة الصحيحة، والحوافز الصحيحة، والاحترام الصحيح للمجتمعات التي يُقصد خدمتها.

That is the question this project exists to answer.
هذا هو السؤال الذي يوجد هذا المشروع للإجابة عليه.

---

## References
## المراجع

- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.
- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.

---

*This document is part of the champollion project documentation. It is released under the same license as the project itself.*
*هذا المستند جزء من وثائق مشروع champollion. تم إصداره بموجب نفس ترخيص المشروع نفسه.*

---

## إلى أين يقود هذا في هذا الموقع

The history ends where this project begins: most living languages still
outside the technology. [What Champollion Is](/docs/what-is-champollion)
states the plan in five minutes, and
[how coverage is counted](/docs/network/context/coverage-counting) shows
exactly where today's line sits.
ينتهي التاريخ حيث يبدأ هذا المشروع: لا تزال معظم اللغات الحية
خارج التكنولوجيا. يوضح [ما هو Champollion](/docs/what-is-champollion)
الخطة في خمس دقائق، ويوضح
[كيف يتم حساب التغطية](/docs/network/context/coverage-counting)
بالضبط أين يقع خط اليوم.
