---
sidebar_position: 1
title: 'From Pāṇini to Transformers'
---

# From Pāṇini to Transformers: Language, Computation, and the Unfinished Work of Translation

**A History of the Ideas Behind champollion**

---

> *"When I look at an article in Russian, I say: 'This is really written in English, but it has been coded in some strange symbols. I will now proceed to decode.'"*
> — Warren Weaver, 1949

---

## Introduction

The dream of a machine that could translate between human languages is older than the computer itself. It is, in some sense, *the* original problem of artificial intelligence—older than chess-playing programs, older than expert systems, older than neural networks. This desire is often framed through European parables like the Tower of Babel, which positions linguistic diversity as a punishment or a problem to be solved, bypassing the reality that pre-contact Indigenous societies have long navigated staggering linguistic diversity through sophisticated trade languages (like Chinook Jargon) and sign systems (like Plains Indian Sign Language) without seeking universal homogenization.

But the history that leads to this moment—to a world where large language models can translate passable French but hallucinate nonsense in Cree—is not a straight line. It is a braid of at least four distinct threads: the formal study of language, the mathematical theory of computation, the statistical revolution in machine learning, and a darker history that explains *why* the languages most in need of technology are the very languages for which it does not exist. That fourth thread is the history of colonial language suppression and cultural genocide—the deliberate, systematic destruction of Indigenous languages across every continent where European powers established dominion. Without understanding that history, the technical problem looks like an accident of data scarcity. It is not an accident.

This paper traces all four threads from their origins to their convergence in the present day. It is, admittedly, somewhat Whiggish—it tells the story as if it were always leading here. History, of course, did not know where it was going. But the threads are real, the connections are genuine, and understanding them is essential to understanding why projects like champollion exist, why they are built the way they are built, and why they matter now.

---

## I. The Grammar of Everything: From Pāṇini to Chomsky

### The First Formal Grammar (c. 4th Century BCE)

The story begins not in a European university but in ancient India, with a scholar named Pāṇini. Around the 4th century BCE, Pāṇini composed the *Aṣṭādhyāyī*—a grammar of Sanskrit comprising roughly 4,000 rules. This was not a grammar in the loose, pedagogical sense. It was a *generative* grammar: a finite set of rules capable, in principle, of producing every valid utterance in the language.

Pāṇini's system used what we would now recognize as formal rewriting rules, with variables, recursion, and ordered application. The linguist Paul Kiparsky has argued that the *Aṣṭādhyāyī* is "the most complete generative grammar of any language yet written" (Kiparsky, 1993). The computer scientist Gerard Huet has shown that Pāṇini's rules can be modeled as a finite-state transducer—the same computational formalism that, twenty-five centuries later, would become central to morphological analysis of polysynthetic languages.

Pāṇini did not know he was doing computer science. But he was.

### The Rosetta Stone and the Birth of Comparative Linguistics (1799)

For most of recorded history, the study of language was primarily the study of *one's own* language—or, at most, the study of a sacred or classical language for liturgical purposes. The intellectual revolution that created modern linguistics began with a stone.

The Rosetta Stone, discovered by Napoleon's soldiers in 1799, bore the same decree in three scripts: Egyptian hieroglyphics, Demotic script, and Ancient Greek. Jean-François Champollion's decipherment of the hieroglyphics in 1822 was more than an archaeological triumph. It demonstrated a principle that would become foundational: that languages could be understood *through each other*. Translation was not merely a practical skill; it was a method of scientific investigation.

### William Jones and the Indo-European Hypothesis (1786)

Even before Champollion, the British philologist Sir William Jones had delivered his famous lecture to the Asiatic Society of Bengal in 1786, observing that Sanskrit bore to Greek and Latin "a stronger affinity, both in the roots of verbs and in the forms of grammar, than could possibly have been produced by accident." Jones proposed that all three descended from a common ancestor "which, perhaps, no longer exists."

This was the birth of historical and comparative linguistics. It established that languages were not isolated, static entities but members of families—related by descent, shaped by time, subject to regular laws of change. It was, in its way, an evolutionary theory decades before Darwin.

### August Schleicher's Language Trees (1861)

It was August Schleicher, a German linguist, who made the Darwinian connection explicit. In 1861—just two years after *On the Origin of Species*—Schleicher published his *Stammbaum* (family tree) model of the Indo-European languages. His diagrams look almost indistinguishable from phylogenetic trees in biology. Languages, like species, branched, diverged, and occasionally went extinct.

Schleicher's trees were a simplification (languages also *converge* through contact, borrowing, and creolization), but the model proved enormously productive. It established the principle that linguistic diversity was not random noise but structured data, amenable to systematic analysis. And it posed, implicitly, a question that remains central to our project: what happens to the branches that are dying?

### Ferdinand de Saussure and the Architecture of Language (1916)

The next revolution came from Ferdinand de Saussure, whose *Cours de linguistique générale* (published posthumously in 1916 from students' notes) established structural linguistics. Saussure drew a sharp distinction between *langue* (the abstract system of a language) and *parole* (actual speech). He argued that linguistic signs were *arbitrary*—the word "tree" bears no inherent connection to trees—and that meaning arose from *differences* within a system, not from any positive content.

Saussure's key diagram—the oval divided between *signifié* (signified, the concept) and *signifiant* (signifier, the sound-image), linked by arrows showing their inseparable relationship—became one of the most reproduced images in the humanities. It established the principle that a language is a *system of systems*, where each element derives its value from its relationships with all the others.

This had profound implications for translation. If meaning is relational and systemic, then translation is not a matter of swapping words. It requires understanding the entire architecture of a language. Two languages may carve up the world in fundamentally different ways—an insight that would later be developed (and sometimes over-stated) by Edward Sapir and Benjamin Lee Whorf.

### Sapir, Bloomfield, and the Study of Indigenous Languages

In North America, the early 20th century brought a different tradition of linguistic fieldwork. Edward Sapir and Leonard Bloomfield worked extensively with Indigenous languages—Sapir with Navajo, Nootka, and many others; Bloomfield with Menomini and other Algonquian languages. They encountered linguistic structures radically different from anything in the Indo-European family.

Sapir, in particular, developed a typological framework that classified languages along several axes, including the critical distinction between *analytic* languages (like English, where words tend to be short and meaning is carried by word order) and *polysynthetic* languages (like Cree, where a single word can encode what English would express as an entire sentence). A single Cree verb form might incorporate the subject, object, tense, aspect, evidentiality, and several modifying elements into one morphologically complex word.

This work established two facts that remain central to our project. First: the world's languages are far more structurally diverse than any European-centric model would suggest. Second: many of these languages were already endangered. However, while early structural linguists documented this complexity, they often participated in "salvage anthropology"—an extractive academic model that treated Indigenous people merely as "informants" to build Western academic careers. This approach severed languages from their epistemological roots, paving the way for treating language as disembodied, extractable data rather than living, relational systems.

### The Chomsky Revolution (1957)

In 1957, a 28-year-old MIT linguist named Noam Chomsky published *Syntactic Structures*, a slim book that detonated like a bomb in the field. Chomsky argued that the goal of linguistics should be to discover the *generative grammar* of a language—a finite set of rules that could produce all and only the grammatical sentences of that language.

More provocatively, Chomsky proposed the *Chomsky hierarchy*: a classification of formal grammars by their computational power. The hierarchy has four levels:

- **Type 3 (Regular)**: Recognized by finite automata. Simple patterns.
- **Type 2 (Context-Free)**: Recognized by pushdown automata. Recursive structures like nested parentheses.
- **Type 1 (Context-Sensitive)**: Recognized by linear bounded automata. More complex dependencies.
- **Type 0 (Recursively Enumerable)**: Recognized by Turing machines. Anything computable.

Chomsky argued that natural languages required at least context-free grammars, and possibly more. This was a direct bridge between linguistics and the mathematical theory of computation. The same formal tools that Alan Turing had developed to reason about the limits of computing could now be applied to human language.

Chomsky also proposed the idea of *Universal Grammar*—that the capacity for language is innate, that all human languages share deep structural properties, and that the diversity of surface forms masks an underlying unity. This remains controversial (many typologists and functionalists disagree), but the formal tools Chomsky introduced—phrase structure rules, transformational grammars, the hierarchy itself—became the foundation of computational linguistics.

---

## II. The Dream of Universal Translation

### Ramon Llull's Thinking Machine (1305)

The dream of mechanizing thought—and with it, the dream of mechanical translation—is remarkably old. Ramon Llull, a 13th-century Catalan mystic, designed the *Ars Magna*: a system of rotating concentric discs inscribed with fundamental concepts, whose combinations were meant to generate all possible truths. Llull's wheels were, in a sense, the first combinatorial logic machine. Leibniz later cited Llull as an inspiration.

### Athanasius Kircher and the Polygraphia Nova (1663)

Athanasius Kircher, the great Jesuit polymath, published *Polygraphia Nova et Universalis* in 1663—a system of "universal writing" intended to allow communication across language barriers. Kircher's system assigned numbers to concepts, which could then be decoded into any language with the appropriate table. It was, in essence, an interlingua—a language-independent representation of meaning.

The system didn't work very well. But the *idea* persisted: that between any two languages there exists a common conceptual space, and that translation is a matter of mapping through it. This interlingua hypothesis was not just a flawed scientific experiment; it was an epistemological extension of colonial control, incapable of mapping divergent ontologies. The philosopher W.V.O. Quine would later formalize this failure with his concept of the *indeterminacy of translation* (1960), arguing that radical translation is inherently indeterminate. Universal, context-free mapping between fundamentally divergent linguistic systems is a philosophical impossibility, not merely an engineering hurdle.

### John Wilkins and the Philosophical Language (1668)

Just five years after Kircher, the English natural philosopher John Wilkins published *An Essay towards a Real Character, and a Philosophical Language*—an attempt to create a language whose structure *perfectly mirrored the structure of reality*. Every concept would be classified in a great taxonomy, and its name would encode its position in that taxonomy.

Wilkins' project failed (reality proved resistant to tidy classification), but it anticipated something important: the idea that language could be *engineered*, that the relationship between words and meanings could be made systematic and explicit. This is, in a deep sense, what computational linguists do when they build ontologies and knowledge graphs.

### Leibniz and the Characteristica Universalis

Gottfried Wilhelm Leibniz, who independently invented calculus and designed a mechanical calculator, dreamed of a *characteristica universalis*—a universal formal language in which all human knowledge could be expressed—and a *calculus ratiocinator*—a machine that could reason in that language. "If controversies were to arise," Leibniz wrote, "there would be no more need of disputation between two philosophers than between two accountants. For it would suffice to take their pencils in their hands, to sit down to their slates, and to say to each other: Let us calculate."

Leibniz also invented binary arithmetic—the number system that would, centuries later, become the language of digital computers. His 1703 paper *Explication de l'Arithmétique Binaire* showed that any number could be represented using only 0 and 1. He saw this as a reflection of the divine creation (something from nothing), but it would prove to be the foundation of all digital computation.

### Warren Weaver's Memo (1949)

The modern era of machine translation begins with a memorandum. In July 1949, the American mathematician and science administrator Warren Weaver wrote to Norbert Wiener, proposing that the new electronic computers might be applied to translation. His memo contained the remarkable passage quoted at the opening of this paper: the idea that a Russian text is "really written in English, but... coded in some strange symbols."

Weaver's metaphor was drawn from wartime cryptanalysis—the idea that translation was fundamentally a *decoding* problem. This was not merely an analogy. The same statistical and information-theoretic tools that had been developed to break enemy ciphers might, Weaver suggested, be applicable to the problem of translation.

The memo was wildly optimistic, but it launched a research program. Within five years, the first machine translation demonstration would take place.

---

## III. The Machinery of Thought: Computation and Information

### George Boole and the Algebra of Logic (1854)

In 1854, George Boole published *An Investigation of the Laws of Thought*—a work that reduced logical reasoning to algebraic operations. Boole showed that the propositions of logic could be manipulated using the same rules as algebra, with AND corresponding to multiplication, OR to addition, and NOT to complement.

Boolean algebra seemed like a mathematical curiosity at the time. It would become the operating principle of every digital circuit ever built.

### Charles Babbage and Ada Lovelace (1837–1843)

Charles Babbage designed (but never completed) the Analytical Engine—a mechanical, steam-powered, general-purpose computer. Unlike his earlier Difference Engine (a specialized calculator), the Analytical Engine had a memory ("the Store"), a processing unit ("the Mill"), conditional branching, and looping. It was, in principle, Turing-complete.

Ada Lovelace, working from a description of the Engine, wrote a set of detailed notes that included what is widely considered the first published computer program: an algorithm for computing Bernoulli numbers (Note G, 1843). But Lovelace's most profound contribution was conceptual. She saw that the Engine could manipulate *symbols*, not just numbers. "The Analytical Engine weaves algebraical patterns," she wrote, "just as the Jacquard loom weaves flowers and leaves." The implication—that computation could be applied to any domain with a formal structure, including language—was prescient.

### Alan Turing and the Universal Machine (1936)

In 1936, Alan Turing published "On Computable Numbers, with an Application to the Entscheidungsproblem"—a paper that simultaneously defined computation, proved its limits, and invented the modern computer (in abstract form).

Turing's key insight was the *universal machine*: a single machine that, given the right instructions encoded on its tape, could simulate *any other* machine. This established that there was no essential difference between hardware and software, between the machine and the program. A single device, properly programmed, could compute anything that was computable at all.

Turing's work also established the limits of computation (the halting problem) and laid the groundwork for his later exploration of machine intelligence. His 1950 paper "Computing Machinery and Intelligence," which proposed the famous Turing Test, framed the question of machine intelligence explicitly in terms of *language*: a machine is intelligent if, through conversation, it cannot be distinguished from a human.

### Claude Shannon and Information Theory (1948)

In 1948, Claude Shannon published "A Mathematical Theory of Communication" in the *Bell System Technical Journal*—a paper that founded the field of information theory. Shannon showed that communication could be modeled as a system: an *information source* generates a *message*, which a *transmitter* encodes into a *signal*, which passes through a *channel* (subject to *noise*), which a *receiver* decodes back into a message for a *destination*.

Shannon's key contribution was the concept of *entropy*—a measure of the uncertainty or information content of a message. He proved that for any channel with a given noise level, there exists a maximum rate at which information can be transmitted reliably (the channel capacity), and that this rate can be achieved with sufficiently clever encoding.

The connection to translation is deep. Shannon himself, in a 1951 paper, used information theory to analyze the statistical structure of English. He showed that English text is highly redundant—that a native speaker, given a sequence of letters, can predict the next letter with high accuracy. This redundancy is what makes communication robust against noise, but it also means that the *information content* of language is much lower than its raw symbol count would suggest.

Warren Weaver immediately saw the connection: if translation is decoding, and if the statistical structure of language can be modeled, then translation is an information-theoretic problem. This insight would take decades to bear fruit, but when it did, it transformed the field.

### Von Neumann and the Stored-Program Computer (1945)

John von Neumann's 1945 report on the EDVAC (Electronic Discrete Variable Automatic Computer) described what we now call the *von Neumann architecture*: a computer with a single memory store for both data and instructions, a central processing unit, and input/output mechanisms. This architecture—data and programs sharing the same memory, processed sequentially by a CPU—remains the fundamental design of nearly every computer in use today.

The von Neumann architecture made software practical. Programs could be stored, modified, and even generated by other programs. This was the technological precondition for everything that followed: compilers, operating systems, and eventually the neural network frameworks that power modern machine translation.

---

## IV. Machine Translation: The First AI Problem

### The Georgetown-IBM Experiment and the Cold War (1954)

On January 7, 1954, researchers at Georgetown University and IBM demonstrated the first public machine translation system. The system translated 60 Russian sentences into English using a vocabulary of 250 words and six grammar rules. The sentences were carefully selected to be within the system's capabilities, but the demonstration generated enormous excitement.

The *New York Times* reported that the experiment portended a future where "a push-button electronic translator" would make all the world's scientific literature instantly accessible. However, this public optimism masked the material reality of the project's funding and purpose. The Georgetown-IBM experiment—and the early machine translation field generally—was not driven by a utopian desire for universal communication. It was funded by the United States military and intelligence apparatus (including the CIA and DARPA) as an urgent Cold War imperative to surveil and intercept Soviet scientific and military texts. 

The view of language as a "code to be cracked" (as Weaver put it) was intrinsically tied to militarized surveillance. Researchers predicted that machine translation would be a solved problem within five years. They were wrong by more than half a century.

### The ALPAC Report and the First AI Winter (1966)

In 1966, the Automatic Language Processing Advisory Committee (ALPAC), convened by the U.S. government, issued a devastating report. After reviewing a decade of MT research, ALPAC concluded that machine translation was slower, less accurate, and more expensive than human translation, and recommended that funding be redirected to basic research in computational linguistics.

The ALPAC report effectively killed MT research funding in the United States for over a decade. It was the first "AI winter"—a pattern that would repeat: extravagant promises, modest results, disillusionment, funding collapse.

But the report also contained a deeper insight. Machine translation had failed, in part, because language was harder than anyone had expected. The rule-based approach—writing explicit grammar rules to parse and generate sentences—worked for simple cases but broke down catastrophically on real text. Language was too ambiguous, too context-dependent, too *alive* for brittle rules to capture.

### Rule-Based and Transfer-Based MT (1970s–1980s)

Research continued, more quietly, through the 1970s and 1980s. Systems like SYSTRAN (which powered the European Commission's early translation services) used large hand-crafted dictionaries and transfer rules to map between language pairs. These systems could produce useful rough translations for restricted domains, but they required enormous engineering effort for each language pair, and they rarely handled unrestricted text gracefully.

The fundamental problem was clear: language is not a cipher. You cannot translate by looking up words in a dictionary and rearranging them according to grammatical rules, because meaning depends on context, on world knowledge, on the speaker's intent, on the entire history of a conversation. The interlingua approach—translating through an abstract, language-independent representation—was theoretically elegant but practically impossible. No one could define the interlingua.

### The Statistical Revolution (1990s)

The breakthrough came not from better rules but from better data. In the late 1980s and early 1990s, researchers at IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra, and Robert Mercer) developed a series of statistical models for machine translation—the famous IBM Models 1 through 5.

The key insight was Weaver's old idea, finally made rigorous: translation as decoding. Given a foreign sentence *f*, find the English sentence *e* that maximizes P(e|f). By Bayes' theorem, this is equivalent to maximizing P(f|e) × P(e)—a *translation model* (how likely is this foreign sentence given this English one?) times a *language model* (how likely is this English sentence on its own?).

The IBM models learned these probabilities from large *parallel corpora*—collections of texts that existed in both languages (like the Canadian parliamentary Hansards, which were published in both English and French). No hand-crafted rules were required. The system learned to translate by observing millions of examples of human translation.

Statistical MT worked dramatically better than rule-based MT for languages with abundant parallel data. It also introduced a critical piece of infrastructure: the **BLEU score** (Papineni et al., 2002), a metric for automatically evaluating translation quality by comparing machine output to human reference translations. BLEU made it possible to measure progress quantitatively and to run large-scale experiments.

But statistical MT had a fatal assumption baked in: it required *parallel corpora*. For the world's major language pairs—English-French, English-Chinese, English-Spanish—parallel data was abundant. For the vast majority of the world's 7,000 languages, it simply did not exist.

### The Neural Revolution: Seq2Seq, Attention, Transformers (2014–2017)

The next transformation came with deep learning. In 2014, Ilya Sutskever, Oriol Vinyals, and Quoc Le demonstrated *sequence-to-sequence* (seq2seq) models for MT: neural networks that could read an entire sentence in one language and generate a translation in another, without any explicit alignment or phrase tables.

In 2015, Dzmitry Bahdanau, Kyunghyun Cho, and Yoshua Bengio introduced the *attention mechanism*—allowing the decoder to "look back" at different parts of the source sentence while generating each word of the translation. This dramatically improved performance on long sentences.

And in 2017, Vaswani et al. at Google published "Attention Is All You Need," introducing the *Transformer* architecture. The Transformer dispensed with recurrence entirely, processing entire sequences in parallel using self-attention. It was faster to train, easier to scale, and produced better translations than anything that had come before.

Transformers led directly to the large language models (LLMs) of the 2020s: GPT, BERT, PaLM, LLaMA, and their descendants. These models, trained on vast quantities of text from the internet, can translate between hundreds of language pairs with remarkable fluency.

But "remarkable fluency" is not the same as "reliable accuracy." And for the world's low-resource languages, the situation is far worse than it appears.

---

## V. The Other History: Language, Power, and Cultural Genocide

The previous four sections tell the story of ideas—of grammarians, mathematicians, and engineers building toward machine translation. But there is another history, running in parallel, that explains *why* the languages most in need of translation technology are the very ones for which it does not exist. This is not a story about data scarcity as a neutral fact. It is a story about deliberate destruction.

The reason that Plains Cree has no machine translation support is not primarily because Cree is a hard language for computers (though it is). It is because, for over a century, the governments of Canada and the United States ran systematic programs to eradicate Indigenous languages from the mouths of children. The "data scarcity" that makes low-resource MT so difficult is, in large part, the *downstream consequence of cultural genocide*. Any honest account of why these languages need technology must reckon with why they were brought to the edge of extinction in the first place.

### Before Contact: A Continent of Languages

The linguistic diversity of the pre-contact Americas was staggering. At the time of European contact, North America alone was home to an estimated 300 to 600 distinct languages, organized into dozens of unrelated language families—more genetic diversity than in all of Europe. South America may have had 1,500 or more (Campbell, 1997). Australia had over 250 languages. The Pacific Islands, sub-Saharan Africa, and mainland Southeast Asia were similarly diverse.

These were not "primitive" or "simple" languages. Many of the most structurally complex languages ever documented are Indigenous. The polysynthetic morphology of Algonquian languages (including Cree, Ojibwe, and Blackfoot), the tonal systems of Navajo, the elaborate evidentiality marking of Quechua, the click consonants of the Khoisan languages—these represent the full range of what human language can be. They encode sophisticated systems of knowledge about kinship, ecology, law, spirituality, and history. Each language is a library—an irreplaceable record of one community's way of understanding and organizing the world.

Edward Sapir recognized this clearly. Writing in 1921, he observed that "when it comes to linguistic form, Plato walks with the Macedonian swineherd, Confucius with the head-hunting savage of Assam." The languages of Indigenous peoples were not lesser. They were different—and their differences contained knowledge that no other language possessed.

### The Mechanics of Language Death

Languages do not die of natural causes. They die when the conditions for their transmission are disrupted—when children stop learning them, when speakers are punished for using them, when the social and economic incentives shift so that speaking the dominant language becomes a condition of survival.

This disruption can happen gradually, through economic and demographic pressure. But across the colonial world, it was overwhelmingly *deliberate*. The suppression of Indigenous languages was not a side effect of colonization. It was a stated policy goal.

### Canada: The Residential School System (1831–1996)

In Canada, the Indian Residential School system operated for over 160 years, with the explicit goal of eliminating Indigenous languages and cultures. An estimated 150,000 First Nations, Métis, and Inuit children were removed from their families and communities and placed in government-funded, church-operated boarding schools.

The central policy was articulated with chilling clarity by Duncan Campbell Scott, the Deputy Superintendent General of Indian Affairs, in 1920: "I want to get rid of the Indian problem... Our objective is to continue until there is not a single Indian in Canada that has not been absorbed into the body politic and there is no Indian question and no Indian Department."

The mechanism was language. Children were forbidden to speak their mother tongues. Punishments for speaking an Indigenous language ranged from beatings to solitary confinement to having needles pushed through their tongues. Children arrived speaking Cree, Ojibwe, Inuktitut, Dene, Haida, or any of dozens of other languages. They were punished until they stopped.

The Truth and Reconciliation Commission of Canada (2015) documented the systematic nature of this assault. Its final report concluded that the residential school system constituted *cultural genocide*—the destruction of the structures and practices that allow a group to continue as a group. Language was the primary target. Without language, ceremony is disrupted, oral history is broken, kinship systems become unintelligible, and the intergenerational transmission of knowledge ceases.

The last federally operated residential school in Canada closed in 1996. Many of the Elders who are the last fluent speakers of their languages today are residential school survivors. Their fluency is not merely a linguistic resource. It is an act of resistance.

### The United States: Indian Boarding Schools (1860s–1960s)

The United States operated a parallel system. Captain Richard Henry Pratt, founder of the Carlisle Indian Industrial School in 1879, coined the phrase that defined the era: "Kill the Indian, save the man." Over 350 government-funded boarding schools operated across the United States, with policies nearly identical to those in Canada. Indigenous children were forbidden to speak their languages, forced to adopt English names, and subjected to systematic cultural erasure.

A 2022 report by the U.S. Department of the Interior identified over 400 federal Indian boarding schools in 37 states, documenting the deaths of at least 500 children in the system—a number the report acknowledged was almost certainly a significant undercount. The investigation found that the system was designed not merely to educate but to "culturally assimilate Indian children by forcibly relocating them from their families and communities."

The linguistic consequences were catastrophic. Of the roughly 300 Indigenous languages spoken in the territory that became the United States, more than half are now extinct. Of those that survive, most have fewer than 1,000 fluent speakers, and many have fewer than 10. The Endangered Languages Project classifies the majority of surviving Native American languages as "severely" or "critically" endangered.

### Australia: The Stolen Generations (1910–1970)

In Australia, government policies between 1910 and 1970 forcibly removed Aboriginal and Torres Strait Islander children from their families. These children—known as the Stolen Generations—were placed in missions, reserves, and white foster families. The explicit aim was assimilation: to breed out Aboriginal identity within a few generations.

Aboriginal languages were suppressed in missions and government institutions. Children who spoke their languages were punished. The Bringing Them Home report (1997), produced by the Australian Human Rights Commission, documented the systematic nature of these removals and their devastating effects on language, culture, and family.

Of the estimated 250 Aboriginal Australian languages spoken at the time of European contact, fewer than 20 are being transmitted to children today (Marmion et al., 2014). Over 100 are completely extinct. The remaining languages survive largely through the efforts of elderly speakers working with linguists and community organizations in a race against time.

### Scandinavia: The Sámi Languages

The suppression of Indigenous languages was not limited to settler-colonial states in the southern hemisphere. In Norway, Sweden, and Finland, Sámi children were subjected to boarding school systems (*internatskoler*) from the mid-19th century through the 1960s. Sámi languages were banned in schools; children were punished for speaking them. Norway's "Norwegianization" (*fornorskingspolitikk*) policy explicitly aimed to eliminate the Sámi language and replace it with Norwegian.

Of the nine surviving Sámi languages, several have fewer than 500 speakers. Ume Sámi has approximately 20. Pite Sámi has fewer than 30. The languages survive in part because of revitalization programs that began in the 1970s, including the establishment of Sámi-language schools and media—programs that arrived just in time for some dialects and too late for others.

### Aotearoa New Zealand: Te Reo Māori

The Māori language (te reo Māori) was the majority language of Aotearoa until the mid-20th century. British colonial education policies, beginning in the 1860s, progressively marginalized te reo in schools. By the 1970s, fewer than 20% of Māori were fluent speakers, and the language was at risk of extinction within a generation.

The Māori response was one of the earliest and most successful language revitalization movements in the world. Kōhanga reo (language nests) for preschool children, established in 1982, immersed infants and toddlers in te reo from birth. Kura kaupapa Māori (Māori-medium schools) followed. These programs, alongside the Māori Language Act of 1987 (which made te reo an official language), have stabilized the language—though fluent speakers still constitute a minority of the Māori population.

New Zealand also produced one of the most important frameworks for Indigenous data governance: *Te Mana Raraunga*, the Māori Data Sovereignty Network. This framework asserts that Māori data—including linguistic data—is a taonga (treasure) subject to the rights and responsibilities of kaitiakitanga (guardianship). It directly informed the development of the CARE principles for Indigenous data governance and is a foundational reference for the data sovereignty mechanisms in champollion.

### The Pattern: Language as a Target of Colonial Power

The geographic and cultural specifics differ, but the pattern is remarkably consistent. Across Canada, the United States, Australia, Scandinavia, and New Zealand—and in many other places, from Taiwan to Siberia to the Andean highlands—colonial and post-colonial states identified Indigenous languages as obstacles to assimilation and targeted them for elimination. The tools were similar everywhere: remove children from their families, forbid the use of Indigenous languages, punish transgressions, and reward adoption of the colonial language.

This was not a historical footnote. The last residential school in Canada closed in *1996*. The last Indian boarding school in the United States closed in the *1960s*. Many of the people who survived these systems are still alive. The trauma is intergenerational. And the linguistic damage is ongoing: languages that lost a generation of speakers in the boarding school era are now losing their last fluent Elders.

### From Cultural Genocide to "Data Scarcity"

This history is directly relevant to the technical problem of machine translation. When computer scientists describe a language as "low-resource," they typically mean: there are few digital texts, few parallel corpora, few dictionaries, and few annotated datasets. The framing is neutral, as if data scarcity were an act of nature, like a desert with little rain.

It is not. The "data scarcity" of Indigenous languages is the *downstream consequence* of language suppression policies. Languages that were forbidden in schools produced fewer written texts. Languages whose speakers were punished for speaking them developed fewer institutional uses. Languages that lost a generation of transmission produced fewer bilingual speakers who could create parallel corpora.

The pipeline from cultural genocide to data scarcity is direct:

1. **Suppression** → Children punished for speaking the language
2. **Disrupted transmission** → Fewer children learn the language
3. **Reduced speaker base** → Fewer adults use it in daily life
4. **Reduced institutional use** → Fewer written documents, fewer digital texts
5. **Data scarcity** → ML models have nothing to train on
6. **No MT support** → The language is invisible to technology
7. **Accelerated decline** → Technology reinforces the marginalization that policy began

This pipeline means that any technology project working with Indigenous languages inherits a political and moral context whether it acknowledges it or not. A machine translation system that treats Cree language data as raw material to be ingested by models is, however inadvertently, continuing the extractive dynamic that began with residential schools. The data was made scarce by violence. The speakers who created what data exists did so against enormous odds. Any system that uses that data without the community's meaningful control is compounding the original harm.

### The Complicity of the Sciences and Western Ideology

It is critical to recognize that science and technology were not innocent bystanders to this colonial project; they were active participants. The "Enlightenment" ideology that sought to categorize, quantify, and standardize the world often treated Indigenous peoples and their languages merely as subjects of research or curiosities for a "salvage anthropology." This extractive practice locked knowledge in Western universities while doing little to stop the political machinery destroying those communities. 

This project stands in stark contrast to methodologies like the Tuskegee syphilis study or extractive linguistic anthropology, which treat BIPOC people as experimental subjects or passive providers of raw data. We are not here to experiment on Indigenous people, extract their knowledge, or force a Western culturally monolithic ideology upon them. Our aim is to facilitate their *own* ways of knowing and their *own* standards of value. We provide the infrastructure; the language communities build the test sets, define the metrics, and maintain the buy-in. Without their buy-in, none of this works.

### Why This History Shapes Our Design

This is why champollion's governance model is not a feature—it is the foundation. Every major design decision in the project is a *direct response* to the history described above. The goal is data sovereignty: to support communities in sustaining, revitalizing, and governing their living languages entirely on their own terms.

**Why the test data is encrypted and held by community trusts.** Because Indigenous linguistic data has been extracted, published, and exploited without consent for over a century. Missionary linguistics, such as the efforts by the Summer Institute of Linguistics (SIL), historically monopolized Indigenous parallel corpora under an extractive, assimilationist framework. Furthermore, unlike many modern NLP projects that rely heavily on translated Bibles as their primary parallel corpus for low-resource languages, we explicitly do not use translated Bibles as corpuses. The encrypted test set, with keys held only by the community's governance organization, is a technical mechanism that makes it *architecturally impossible* to repeat extractive patterns.

**Why we use sandboxed execution instead of open test sets.** Because once linguistic data is published openly, the community loses control over it permanently. Conventional ML benchmarks publish their test sets—anyone can download them, train on them, or use them for any purpose. This modern AI data scraping represents a new form of "data colonialism" and "digital enclosure." For communities whose languages were nearly eradicated by force, losing control over their remaining linguistic resources is not a minor inconvenience. It is a direct continuation of historical territorial dispossession. Sandboxed execution ensures that the community's data never leaves their infrastructure.

**Why method ownership transfers to the community.** Because the history of "helping" Indigenous communities is, overwhelmingly, a history of outsiders building things *about* Indigenous people rather than *for* or *with* them. Academic papers are published, grants are collected, careers are advanced—and the community is left with nothing. The ownership transfer mechanism ensures that when an ML engineer builds a working translation method for Plains Cree, the Plains Cree community *owns that method*. The engineer keeps credit and attribution. The community keeps the asset.

**Why anything a community-owned method earns belongs entirely to the community.** Because language revitalization is expensive, and the communities doing the hardest work—the Elders teaching, the parents sending children to immersion schools, the activists running language nests—are chronically underfunded. Furthermore, the very AI infrastructure we use (e.g., data centers, mineral mining, water use) exacts a disproportionate material toll on Indigenous lands globally. Champollion is a non-commercial project and holds no claim on any of it: if a Cree translation method ever generates value, that value should fund Cree language programs. Technology should be a tool that serves communities, not a mechanism that extracts value from them.

**Why we say "sovereignty-aspirant" rather than claiming compliance.** Indigenous data-sovereignty frameworks were developed by specific peoples for specific contexts — First Nations data-sovereignty principles in Canada, CARE (Collective Benefit, Authority to Control, Responsibility, Ethics), Te Mana Raraunga (Māori Data Sovereignty), and the FAIR principles each address these concerns from different cultural and legal positions. We do not claim to implement any of them in full; that determination belongs to the communities who authored them. We say our design is *sovereignty-aspirant* — built so that communities *can* exercise ownership, control, access, and possession of their data and the technologies derived from it. The architecture reaches toward sovereignty; whether it achieves sovereignty is for the communities to decide. We treat this as unfinished work, welcome objections, and will act on them.

**Why the platform benchmarks *methods*, not *models*.** Because Indigenous language communities should not be dependent on any single corporation's model. The open architecture of a "method" means the solution doesn't even have to be a costly, material-heavy LLM. It could be a highly efficient, community-hosted rule-based system running on traditional computing hardware. If the best translation method for Cree uses Google's Gemini today, the community should be able to switch to an open-source or deterministic alternative tomorrow without rebuilding everything. Method-level benchmarking ensures that the community's asset is a *recipe*, not a dependency.

**Why the community must build this infrastructure now.** The paradox of leveraging AI while critiquing its material extraction is resolved by a harsh strategic reality: if this problem isn't solved by the community on their own sovereign terms, it will inevitably be "solved" by others on extractive terms. Even if a massive corporation eventually builds a translation model for a given Indigenous language, the community requires its own independent, sandboxed benchmarking infrastructure to verify *when* and *if* they have actually succeeded according to community standards—and to ensure the community captures the value of that success.

This is not politics bolted onto technology. It is technology designed by people who understand the history.

---

## VI. The Current Moment: 6,800 Languages Left Behind

### The Scale of the Problem

Of the roughly 7,000 living languages spoken on Earth today, only around 550 have machine translation of any kind — and barely 200 are served by a deployed commercial service ([how we count](/docs/network/context/coverage-counting)). The rest are invisible to the technology—not because they are less worthy, but because the statistical and neural approaches that dominate modern MT are fundamentally *data-hungry*. They require millions of parallel sentences to learn from. For most of the world's languages, those sentences do not exist.

The languages most affected are precisely those most endangered: Indigenous languages, minority languages, oral traditions with limited written records. These are languages whose speakers are often elderly, whose communities are small, whose political power is minimal. They are the languages that most need technological support for preservation and revitalization—and they are the languages for which existing technology is least useful.

### The Polysynthetic Challenge

The problem is not merely one of data scarcity. Many of the world's most endangered languages are *polysynthetic*—they have morphological systems of extraordinary complexity that fundamentally break the assumptions of standard NLP.

Consider Plains Cree (nêhiyawêwin), an Algonquian language spoken across the Canadian prairies. A single Cree verb can encode information that English would spread across an entire clause: the subject, the object, the tense, the aspect, the evidentiality, the modality, and various other grammatical categories, all packed into a single word through a system of prefixes, suffixes, and internal modifications.

This creates several problems for standard MT approaches:

1. **Tokenization failure.** Subword tokenizers like BPE (Byte Pair Encoding), designed for analytic languages like English, shatter polysynthetic words into meaningless fragments. The morphological structure is destroyed before the model ever sees it. BPE is not neutral; it represents a purely empiricist, surface-level epistemology that fundamentally clashes with the deep, rule-based morphological hierarchies inherent to polysynthetic languages. It is an architectural bias that actively dismantles structural morphology.

2. **Combinatorial explosion.** A polysynthetic language may have millions of possible word forms for a single verb root. No training corpus, however large, can contain more than a tiny fraction of them. Neural models have no way to *generalize* to unseen forms.

3. **Hallucination.** Large language models, when asked to translate into polysynthetic languages, often generate morphologically invalid forms—words that no native speaker would ever produce. The model has learned statistical patterns from limited data but has no understanding of the language's morphological rules.

### Finite State Transducers: The Bridge

There is, however, a technology that *does* handle morphological complexity well: the **Finite State Transducer** (FST). An FST is a formal computational device that maps between an input string and an output string through a series of state transitions. For morphological analysis, an FST can map a surface word form to its underlying morphological structure (and vice versa), handling the full combinatorial complexity of the language's morphology.

FSTs are the direct descendants of Pāṇini's rewriting rules. They are Chomsky's Type 3 (regular) grammars in computational form. They are the living embodiment of the connection between formal linguistics and computation. 

In pairing FSTs with LLMs, `champollion` executes a crucial philosophical synthesis: it reconciles the *rationalist* structural tradition (rules) with the *empiricist* statistical paradigm (probability) to counteract the data-hungry, majoritarian biases of modern AI.

For polysynthetic languages, FSTs can provide something that neural models cannot: *deterministic verification*. Given a word form, an FST can say definitively whether it is a valid form in the language—not probabilistically, not "this looks right," but *yes* or *no*. This is the answer to the core query that haunts neural MT for low-resource languages: *How do you verify that a generated word is real without a human in the loop?*

The technical answer is: you use the formal grammar. You use the very tools that Pāṇini invented twenty-five centuries ago, encoded in the computational formalism that Turing and Chomsky made rigorous.

However, we must recognize that this deterministic power carries its own risks. Enforcing a "yes" or "no" validation onto an oral, fluid language risks imposing a rigid Standard Language Ideology. When an FST dictates what is "correct," it can inadvertently recapitulate the very colonial normativity it was designed to evade—flattening dialectal variation, punishing code-switching, and enforcing a singular, normalized grammar on a diverse community. Because FSTs represent just one metric of formal correctness, their rigid empiricism must be tempered. This is precisely why the community must hold the pen. The community sets the standard, builds the rules, and defines what the machine accepts as valid, engineering FSTs that carve out space for oral fluidity and regional dialects. The formal grammar is not a universal truth handed down by computer scientists; it is an infrastructure operated by the speakers themselves.

### champollion: Where the Threads Converge

This is where the champollion project enters the story. It sits at the exact convergence point of all the threads we have traced:

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

champollion is a platform designed to direct the competitive energy of the machine learning community toward languages that the market has abandoned. It provides a benchmarking infrastructure where anyone can submit a translation method—neural, rule-based, hybrid, or novel—and have it evaluated against rigorous standards. Crucially, it uses FST-based validation to ensure that generated forms are morphologically valid, and it relies on native speaker verification as the ultimate ground truth.

The platform embodies several principles that this history makes clear:

**No single approach is sufficient.** The history of MT is a history of paradigm shifts—from rules to statistics to neural networks. Each new paradigm solved problems the previous one couldn't, but each also had blind spots. For low-resource polysynthetic languages, the answer is almost certainly *hybrid*: neural fluency constrained by formal correctness.

**Data sovereignty is not optional—it is a structural response to historical harm.** As Section V documents in detail, Indigenous languages are not merely "data-scarce" by accident. They were made scarce by deliberate policy. The project's sovereignty-aspirant design—ensuring that language data remains under the control of Indigenous communities, that decryption keys are held by community trusts, that algorithm ownership transfers to speakers—is not an afterthought. It is a direct response to centuries of extractive practice, from residential school-era documentation by outsiders to modern-day dataset scraping.

An earlier version of this paragraph said the architecture makes repeating those patterns *technically impossible*. That was an overclaim and it has been withdrawn. The mechanisms are real and specific — a corpus is encrypted on the holder's own device before anything leaves it, decryption requires several custodians acting together rather than any single party, and corpus content is fetched from its source rather than hosted here — but "impossible" is not a property any of them can carry. Software has bugs, operators make mistakes, and a determined party with enough of the right roles is a residual risk that no design removes. The honest claim is that the easy paths are closed and the hard ones leave evidence. What this project can promise is mechanism and disclosure, not impossibility.

**The long game is revitalization.** Translation is the *proving ground*, but the real prize is language revitalization through teaching. The formal grammars and morphological models built for machine translation are precisely the technical foundations needed for machine-assisted language learning. If we can build an FST that validates Cree verb forms for a translation system, we can also use that FST to help a student learn to conjugate Cree verbs.

### Why This Moment

We are living in a unique moment in the history of language technology. Several factors have converged:

1. **Open-source tools are mature.** The FST toolkits (like HFST and Foma), the neural MT frameworks (like OpenNMT and Fairseq), and the evaluation infrastructure can now be assembled by a small team at minimal cost.

2. **Community organizing is accelerating.** Indigenous language communities are increasingly sophisticated in their use of technology and their assertion of data sovereignty. Organizations like the First Voices initiative, the Canadian Indigenous Languages Technology Project, and numerous community-led efforts are building the human infrastructure that technology alone cannot provide.

3. **AI capabilities have reached a threshold.** Large language models, while insufficient on their own for low-resource MT, can serve as powerful components in hybrid systems—generating candidate translations that are then verified and constrained by formal methods.

4. **The cost has collapsed.** What would have required a government laboratory in 1954 or a major corporation in 2000 can now be done with cloud computing credits and open-source software. The bottleneck is no longer technology or money. It is *will*.

The question is not whether the technology can be built. It can. The question is whether it will be built *correctly*—with the right governance, the right incentives, and the right respect for the communities it is meant to serve.

That is the question this project exists to answer.

---

## References

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


## Where this leads on this site

The history ends where this project begins: most living languages still
outside the technology. [What Champollion Is](/docs/what-is-champollion)
states the plan in five minutes, and
[how coverage is counted](/docs/network/context/coverage-counting) shows
exactly where today's line sits.
