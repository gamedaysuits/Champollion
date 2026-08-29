# Tradução de Máquina: Um Relatório de Campo (2013–2026)

*Uma narrativa histórica para qualquer pessoa entrando no cenário de TM*

---

## Índice

- [Parte 1: A Revolução Neural (2013–2017)](#parte-1-a-revolução-neural-20132017)
- [Parte 2: A Virada Multilíngue (2018–2022)](#parte-2-a-virada-multilíngue-20182022)
- [Parte 3: A Era dos LLMs (2022–2026)](#parte-3-a-era-dos-llms-20222026)
- [Parte 4: O Problema dos Recursos Baixos](#parte-4-o-problema-dos-recursos-baixos)
- [Parte 5: Transdutores de Estados Finitos e Sistemas Baseados em Regras](#parte-5-transdutores-de-estados-finitos-e-sistemas-baseados-em-regras)
- [Parte 6: Medindo Qualidade — O Problema da Avaliação](#parte-6-medindo-qualidade--o-problema-da-avaliação)
- [Parte 7: O Cenário Institucional](#parte-7-o-cenário-institucional)
- [Parte 8: Fronteiras Abertas](#parte-8-fronteiras-abertas)
- [Apêndice A: Artigos-Chave](#apêndice-a-artigos-chave)
- [Apêndice B: Conferências e Comunidades](#apêndice-b-conferências-e-comunidades)
- [Apêndice C: Ferramentas, Conjuntos de Dados e Recursos Práticos](#apêndice-c-ferramentas-conjuntos-de-dados-e-recursos-práticos)
- [Apêndice D: Glossário](#apêndice-d-glossário)

---

## Parte 1: A Revolução Neural (2013–2017)

### O Antigo Regime: Tradução Automática Estatística

Para entender a revolução que reformulou a tradução automática em meados dos anos 2010, você primeiro precisa entender o que veio antes — e por que falhou.

De aproximadamente 2003 a 2015, o paradigma dominante em TM foi a **Tradução Automática Estatística (SMT)**, especificamente **SMT baseada em frases**. A ideia central era enganosamente simples: em vez de escrever regras sobre como a linguagem funciona, você reúne enormes quantidades de texto paralelo — documentos traduzidos por humanos em dois idiomas — e deixa algoritmos estatísticos aprenderem as correspondências. O sistema decomporia uma sentença de origem em frases sobrepostas (não frases linguísticas, mas pedaços arbitrários de n-gramas), encontraria traduções estatisticamente prováveis para cada pedaço e então montaria uma sentença de destino usando um **modelo de linguagem** que garantisse que a saída fosse fluente.

A ferramenta de trabalho dessa era foi **Moses**, um kit de ferramentas SMT de código aberto desenvolvido principalmente na Universidade de Edimburgo sob Philipp Koehn, lançado em 2006. Moses tornou-se o Linux da pesquisa em TM — praticamente todos os laboratórios de TM acadêmicos do mundo o usavam. Seu companheiro, **cdec** (desenvolvido por Chris Dyer na Carnegie Mellon), oferecia capacidades semelhantes com um formalismo diferente. Juntas, essas ferramentas definiram uma década de pesquisa em TM.

A SMT baseada em frases funcionava surpreendentemente bem para pares de idiomas com dados paralelos abundantes e ordem de palavras semelhante — inglês–francês, inglês–espanhol, inglês–alemão. Mas tinha limitações estruturais profundas. O sistema não tinha conceito de significado. Era correspondência de padrões sobre cadeias de superfície, montando traduções a partir de fragmentos memorizados. Tinha dificuldade com dependências de longo alcance (um pronome referindo-se a um substantivo várias orações atrás), com reordenação entre idiomas tipologicamente diferentes (inglês–japonês, por exemplo, onde verbos aparecem em posições opostas) e com qualquer fenômeno que exigisse abstração genuína sobre a estrutura da linguagem. Cada melhoria exigia engenharia cada vez mais barroca: regras de reordenação feitas à mão, características esparsas, modelos de linguagem massivos. A arquitetura estava se aproximando de seu limite.

### O Avanço: Sequência-para-Sequência com Atenção

A primeira rachadura no paradigma SMT não veio da comunidade de TM, mas de pesquisadores de aprendizado profundo trabalhando em problemas de modelagem de sequências.

Em setembro de 2014, **Dzmitry Bahdanau, Kyunghyun Cho e Yoshua Bengio** da Université de Montréal publicaram um artigo que se provaria transformador: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (apresentado na ICLR 2015). A inovação-chave foi o **mecanismo de atenção**.

Para entender por que isso importava, você precisa do contexto anterior. Apenas alguns meses antes, Ilya Sutskever, Oriol Vinyals e Quoc V. Le do Google publicaram ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) (NIPS 2014), demonstrando que uma rede neural com uma arquitetura **codificador–decodificador** poderia traduzir sentenças. O codificador lê a sentença de origem palavra por palavra e a comprime em um único vetor de comprimento fixo — um resumo numérico de toda a entrada. O decodificador então gera a sentença de destino palavra por palavra a partir desse vetor.

Isso era elegante, mas tinha uma falha crítica: o vetor único era um **gargalo**. Toda a informação em uma sentença de origem de trinta palavras tinha que ser espremida através de um vetor de, digamos, 1.000 números. Sentenças curtas traduziam razoavelmente bem; sentenças longas se degradavam muito, porque o modelo esquecia das palavras anteriores no momento em que terminava de codificar as posteriores.

O mecanismo de atenção de Bahdanau resolveu isso. Em vez de comprimir toda a origem em um vetor, o decodificador podia **olhar para trás** para todos os estados ocultos do codificador — as representações intermediárias em cada posição de origem — e pesar dinamicamente quais posições eram mais relevantes para gerar cada palavra de destino. Ao produzir a palavra em inglês "cat", o modelo podia prestar mais atenção à palavra francesa "chat" na origem, mesmo que estivessem longe na sentença. O modelo aprendeu a *alinhar* palavras de origem e destino como parte do processo de tradução, em vez de depender de um único resumo comprimido.

Essa foi a inovação fundamental. A atenção não apenas melhorou a TM; tornou-se o mecanismo central de praticamente todo o progresso subsequente no processamento de linguagem natural.

### Google Vai Neural

Os resultados acadêmicos de 2014–2015 eram impressionantes, mas ainda não prontos para produção. Isso mudou no final de 2016.

Em setembro de 2016, um grande time do Google liderado por **Yonghui Wu** publicou ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). O sistema, conhecido como **GNMT** (Google Neural Machine Translation), era uma arquitetura codificador–decodificador em escala industrial com atenção, treinada nos vastos recursos de dados paralelos do Google. O artigo fez uma afirmação impressionante: em certos pares de idiomas, GNMT reduziu erros de tradução em 55–85% em comparação com o sistema SMT baseado em frases existente do Google.

Em novembro de 2016, o Google começou a mudar silenciosamente o Google Translate de SMT baseada em frases para GNMT para pares de idiomas principais. A transição foi essencialmente completa para pares de alto recurso até 2017. Para os usuários, a mudança foi dramática. Traduções que anteriormente pareciam rígidas, fragmentadas e ocasionalmente sem sentido tornaram-se substancialmente mais fluentes — às vezes surpreendentemente. A era do "gibberish do Google Translate" como piada estava terminando.

A resposta competitiva foi rápida. Em agosto de 2017, o **DeepL**, fundado por **Gereon Frahling** em Colônia, Alemanha, lançou seu serviço de tradução. O DeepL surgiu do projeto de concordância bilíngue Linguee e se diferenciou pela qualidade percebida da tradução — particularmente para pares de idiomas europeus, onde rapidamente desenvolveu uma reputação entre tradutores profissionais por produzir resultados mais naturais e idiomáticos do que o Google. O modelo de negócios do DeepL (freemium com uma API paga) e seu foco na qualidade em vez da abrangência definiriam sua posição de mercado no futuro. O DeepL oferece suporte a aproximadamente 33 idiomas — muito menos do que os 194 na lista do Cloud Translation do Google — mas com um posicionamento que prioriza a qualidade.

### O Transformer

Se o mecanismo de atenção de Bahdanau foi a fundação, então o **Transformer** foi o edifício construído sobre ela — e o edifício era um arranha-céu.

Em junho de 2017, um time de oito pesquisadores do Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser e Illia Polosukhin** — publicaram ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) na NIPS 2017. O título não era hipérbole; era uma afirmação arquitetônica precisa. Onde modelos anteriores usavam redes neurais recorrentes (RNNs) como sua espinha dorsal — processando palavras sequencialmente, uma de cada vez, como ler uma sentença da esquerda para a direita — o Transformer dispensou a recorrência inteiramente e confiou apenas em atenção.

As inovações-chave foram:

1. **Auto-atenção**: Cada palavra em uma sentença presta atenção a todas as outras palavras na mesma sentença, computando relacionamentos em paralelo em vez de sequencialmente. Isso captura dependências de longo alcance sem o gargalo de informação das RNNs e — crucialmente — se paraleliza em hardware moderno (GPUs e TPUs), tornando o treinamento dramaticamente mais rápido.

2. **Atenção multi-cabeça**: Em vez de computar um único padrão de atenção, o modelo computa múltiplos padrões de atenção simultaneamente ("cabeças"), cada um potencialmente capturando diferentes tipos de relacionamentos linguísticos — sintáticos, semânticos, posicionais.

3. **Codificação posicional**: Como a auto-atenção processa todas as palavras simultaneamente (diferentemente das RNNs, que processam sequencialmente), o modelo não tem noção inerente de ordem de palavras. Codificações posicionais — funções matemáticas injetadas na entrada — fornecem essa informação.

O Transformer não apenas superou modelos baseados em RNN em benchmarks de tradução. Treinou **ordens de magnitude mais rápido** por causa de seu paralelismo. Isso era talvez tão importante quanto a melhoria de qualidade: pesquisadores agora podiam iterar mais rápido, treinar em mais dados e escalar para modelos maiores. O ciclo virtuoso de escala havia começado.

Dentro de dois anos, a arquitetura Transformer havia se tornado o substrato para essencialmente todo o trabalho de ponta em NLP — não apenas TM, mas modelagem de linguagem, classificação de texto, resposta a perguntas, sumarização e eventualmente os grandes modelos de linguagem (GPT, BERT, LLaMA) que reformulariam o cenário de IA mais amplo. Cada sistema discutido no restante deste relatório é construído no Transformer.

### O Divisor de Águas WMT 2016

A **Conferência sobre Tradução Automática** (WMT), realizada anualmente como um workshop co-localizado com conferências principais de NLP, executa **tarefas compartilhadas** competitivas onde times de pesquisa submetem sistemas de TM e são classificados um contra o outro em conjuntos de testes padronizados. WMT é o mais próximo que o campo de TM tem de um placar público.

Na **WMT 2016**, sistemas de TM neural superaram decisivamente sistemas de SMT baseada em frases em praticamente todos os pares de idiomas na tarefa compartilhada. Esse foi o momento em que o centro de gravidade do campo se deslocou. Pesquisadores que haviam passado carreiras construindo sistemas baseados em frases começaram a se reformular para o paradigma neural. Dentro de dois anos, novas publicações usando SMT baseada em frases para qualquer coisa além de comparação histórica tinham essencialmente cessado. Moses, a ferramenta que havia definido uma década, foi funcionalmente aposentada.

A transição foi notavelmente rápida pelos padrões de mudanças de paradigma acadêmicas — talvez três a quatro anos do artigo de Bahdanau em 2014 para a dominância quase completa de TM neural até 2018. Para um pesquisador entrando no campo hoje, SMT baseada em frases é contexto histórico, não uma direção de pesquisa ativa. Mas é contexto essencial, porque as suposições, benchmarks e hábitos de avaliação da era SMT ainda ecoam através do campo.

---

## Parte 2: A Virada Multilíngue (2018–2022)

### Um Modelo, Muitos Idiomas

A primeira geração de sistemas de TM neural eram **bilíngues**: um modelo por par de idiomas. Inglês–francês exigia um modelo; francês–inglês exigia um separado. Escalar essa abordagem para N idiomas teoricamente exigia N×(N−1) modelos — um gargalo de engenharia e dados que efetivamente limitava TM neural a um punhado de pares bem-recursos.

A pergunta que definiu 2018–2022 foi: *um único modelo neural pode aprender a traduzir entre muitos idiomas de uma vez?* A resposta se mostrou ser sim, com consequências profundas e complicadas.

### Representações Cross-Linguais: mBERT e XLM-R

Antes que modelos de tradução multilíngues chegassem, uma descoberta inesperada em modelos de *compreensão* de linguagem preparou o terreno.

No final de 2018, o Google lançou **Multilingual BERT (mBERT)** — um único modelo Transformer treinado em texto da Wikipedia de 104 idiomas. BERT (Bidirectional Encoder Representations from Transformers) não era um modelo de tradução; era um codificador de linguagem de propósito geral, treinado para prever palavras mascaradas em texto. O que surpreendeu pesquisadores foi uma propriedade emergente: mBERT desenvolveu **representações cross-linguais** sem nunca ser explicitamente ensinado que idiomas eram relacionados. Se você ajustasse mBERT em uma tarefa de classificação de sentimento em inglês e então o aplicasse a texto em francês — sem dados de treinamento em francês — ele funcionava notavelmente bem. Esse fenômeno, chamado **transferência cross-lingual zero-shot**, sugeriu que modelos multilíngues estavam aprendendo algum tipo de espaço representacional compartilhado entre idiomas.

Em 2020, **Alexis Conneau** e colegas no Facebook AI Research (agora Meta) levaram isso adiante com **XLM-R** (Cross-lingual Language Model – RoBERTa). Treinado em 2,5 terabytes de dados CommonCrawl filtrados em 100 idiomas, XLM-R superou significativamente mBERT em benchmarks cross-linguais. Demonstrou que com dados suficientes e capacidade de modelo, um único codificador poderia construir representações multilíngues robustas.

Esses modelos não eram tradutores em si, mas forneceram a fundação conceitual e técnica para TM multilíngue. Se um modelo pudesse aprender representações compartilhadas em 100 idiomas, então um modelo de tradução deveria ser capaz de traduzir entre eles — pelo menos em princípio.

### Tradução Muitos-para-Muitos: M2M-100

Sistemas de TM multilíngues tradicionais tinham um segredo sujo: eles roteavam a maioria das traduções **através do inglês**. Traduzir de português para japonês significava primeiro traduzir português para inglês, depois inglês para japonês. Essa abordagem "centrada em inglês" era pragmática — a maioria dos dados paralelos envolve inglês de um lado — mas introduzia erros compostos e impunha estrutura de linguagem inglesa em cada tradução.

Em outubro de 2020, Facebook AI publicou **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): um modelo de tradução muitos-para-muitos cobrindo **100 idiomas e 2.200 direções de tradução** sem rotear através do inglês. Esse foi um avanço conceitual. O modelo poderia traduzir diretamente entre, digamos, bengali e suaíli, usando dados paralelos minerados da web para pares não-ingleses.

M2M-100 provou que pivotagem em inglês não era uma restrição necessária de TM multilíngue. Mas também revelou os limites da abordagem: a qualidade era altamente desigual entre pares de idiomas, com algumas direções mal utilizáveis. A lacuna entre "este modelo *cobre* 2.200 direções" e "este modelo *funciona bem* em 2.200 direções" se tornaria um tema central.

### NLLB-200: Nenhuma Língua Deixada Para Trás

O esforço de TM multilíngue mais ambicioso da Meta chegou em julho de 2022 com **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), publicado como um artigo de pesquisa Meta AI com mais de 200 co-autores). O objetivo era explícito no nome: construir um único modelo suportando 200 idiomas, com foco particular em idiomas de baixo recurso previamente ignorados pela TM comercial.

As contribuições técnicas de NLLB-200 foram substanciais:

- **Arquitetura**: Um Transformer denso e uma variante **Mixture-of-Experts (MoE)**, onde diferentes subconjuntos dos parâmetros do modelo se ativam para diferentes pares de idiomas. A maior variante, NLLB-200-MoE-54B, tinha 54 bilhões de parâmetros. Uma versão destilada de 600M parâmetros tornou a implantação viável.

- **Mineração de dados**: O time desenvolveu ferramentas automatizadas para minerar sentenças paralelas de rastreamentos web, incluindo um modelo de identificação de idioma (cobrindo 200+ idiomas) e um filtro de sentença paralela. Esse pipeline foi crítico para reunir dados de treinamento para idiomas com presença web mínima.

- **FLORES-200**: Um benchmark de avaliação padronizado cobrindo todos os 200 idiomas com sentenças traduzidas profissionalmente. FLORES-200 se tornou uma ferramenta essencial para o campo — anteriormente, nenhum benchmark existia para a maioria desses idiomas.

- **Lançamento aberto**: Tanto o modelo quanto FLORES-200 foram lançados abertamente, permitindo que pesquisadores em todo o mundo construíssem sobre o trabalho.

NLLB-200 foi um marco, mas suas limitações são igualmente importantes de entender. A qualidade variava enormemente entre idiomas. Para pares bem-recursos (inglês–francês, inglês–chinês), o modelo era competente, mas não de ponta em comparação com sistemas especializados. Para idiomas de baixo recurso, a qualidade de saída variava de útil a essencialmente não funcional, dependendo de quanto dados de treinamento haviam sido minerados. O modelo também exibia a **maldição da multilingualidade**: adicionar mais idiomas a um modelo de capacidade fixa dilui a qualidade de representação para cada idioma. Idiomas de baixo recurso se beneficiam de aprendizado de transferência (estrutura compartilhada com idiomas relacionados), mas idiomas de alto recurso podem realmente *piorar* conforme o modelo tenta servir muitos mestres. Isso não é meramente um problema de escala — reflete uma tensão fundamental no design de modelos multilíngues.

### A Suite Seamless

Meta continuou empurrando TM multilíngue com a família de modelos **Seamless** em 2023–2024. **SeamlessM4T** ("Massively Multilingual and Multimodal Machine Translation", agosto de 2023) era um único modelo manipulando **tradução fala-para-fala, fala-para-texto, texto-para-fala e texto-para-texto** em aproximadamente 100 idiomas (com cobertura variável entre modalidades). Isso representou uma convergência de threads de pesquisa previamente separadas — reconhecimento automático de fala (ASR), tradução de texto e síntese de fala (TTS) — em um sistema multilíngue unificado.

A suite **Seamless Communication** subsequente adicionou capacidades de streaming (tradução quase em tempo real) e tradução de fala expressiva (preservando características vocais como emoção e estilo de fala entre idiomas). Esses sistemas permanecem protótipos de pesquisa em vez de ferramentas prontas para produção, mas sinalizam a direção do campo: multimodal, multilíngue e em tempo real.

### O Que "Massivamente Multilíngue" Significa na Prática

Para um pesquisador entrando neste campo, é crucial distinguir entre a **cobertura de idiomas** de um modelo e sua **qualidade de idioma**. Um modelo que "suporta 200 idiomas" pode fornecer excelentes traduções para 20 deles, saída aceitável para 50 e essencialmente texto aleatório para o restante. O número de manchete é enganoso sem avaliação de qualidade por idioma.

A **maldição da multilingualidade** é o termo técnico para o problema de diluição de capacidade: um modelo com parâmetros finitos não pode representar todos os idiomas igualmente bem. Adicionar mais idiomas beneficia os idiomas de recurso mais baixo (através de transferência cross-lingual de idiomas relacionados), mas prejudica os de recurso mais alto (consumindo capacidade que poderia ter sido dedicada a eles). Isso cria uma tensão de design: você constrói um modelo universal, ou muitos especializados? O campo não resolveu essa questão.

---

## Parte 3: A Era dos LLMs (2022–2026)

### Quando a IA de Propósito Geral Aprendeu a Traduzir

A chegada de grandes modelos de linguagem (LLMs) — GPT-3.5/4, Gemini, Claude, LLaMA — criou uma situação estranha no campo de TM. Esses modelos não foram treinados especificamente para tradução. Foram treinados para prever o próximo token em vastos corpora de texto, principalmente em inglês, mas cada vez mais multilíngues. Ainda assim, quando solicitados com instruções como "Traduza a seguinte sentença francesa para inglês", eles produziam traduções que eram, para pares de idiomas de alto recurso, surpreendentemente boas.

Isso apresentou o campo com uma questão de identidade: se a IA de propósito geral pode traduzir tão bem quanto sistemas de tradução construídos especificamente, "tradução automática" permanece uma área de pesquisa distinta? A resposta, a partir de 2026, é um sim qualificado — mas o relacionamento entre pesquisa de TM e desenvolvimento de LLM de propósito geral se tornou profundamente entrelaçado.

### Os Primeiros Benchmarks: LLMs vs. TM Dedicada

A avaliação sistemática de LLMs para tradução começou no início de 2023, logo após o lançamento do ChatGPT (novembro de 2022) e GPT-4 (março de 2023).

**Jiao et al. (2023)**, em ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745), forneceu uma avaliação inicial. Seus achados estabeleceram um padrão que se manteve notavelmente estável: LLMs são **altamente competitivos para pares de idiomas europeus de alto recurso** (inglês–alemão, inglês–francês, inglês–chinês) e **significativamente mais fracos para pares de baixo recurso e tipologicamente distantes**. Eles também introduziram **pivoting de prompt** — instruindo o modelo a traduzir através de um idioma intermediário — que melhorou o desempenho em pares difíceis.

**Hendy et al. (2023)** na Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) conduziram uma avaliação mais abrangente em 18 direções de tradução. Sua conclusão: modelos GPT rivalizavam com TM comercial de ponta para pares de alto recurso, mas tinham "capacidade limitada" em idiomas de baixo recurso.

Por 2024–2025, o quadro havia se aguçado. Para **pares de alto recurso**, os melhores LLMs (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) igualavam ou superavam sistemas de TM dedicados, particularmente para tarefas exigindo compreensão contextual, expressão idiomática e coerência em nível de documento — áreas onde TM neural tradicional, que processa sentenças isoladamente, sempre teve dificuldade. Para **pares de baixo recurso**, modelos multilíngues dedicados como NLLB-200 e sistemas construídos especificamente do Google Translate ainda superam LLMs, frequentemente significativamente.

### BLOOM: O Momento Multilíngue Aberto

Em julho de 2022, a colaboração **BigScience** — um esforço de um ano de voluntários coordenado pela Hugging Face envolvendo centenas de pesquisadores globalmente — lançou **BLOOM**: um modelo de linguagem multilíngue de código aberto de 176 bilhões de parâmetros cobrindo **46 idiomas naturais e 13 linguagens de programação**. Treinado no corpus ROOTS usando o supercomputador Jean Zay na França, BLOOM foi o primeiro LLM multilíngue massivo de acesso aberto.

BLOOM não era um tradutor dedicado, mas sua significância para TM era considerável. Demonstrou que modelos de código aberto podiam suportar dezenas de idiomas em escala, fornecendo uma fundação para pesquisa multilíngue fora de laboratórios corporativos. Sua variante ajustada para instruções, **BLOOMZ**, mostrou capacidades de generalização cross-lingual — ajustado em tarefas em um idioma, poderia realizá-las em outros.

### LLaMA e a Explosão de Fine-Tuning

A série **LLaMA** (Large Language Model Meta AI) da Meta, começando em fevereiro de 2023, tomou um caminho diferente. LLaMA 1 era principalmente centrada em inglês, com capacidade multilíngue limitada. LLaMA 2 (julho de 2023) melhorou marginalmente, mas ainda classificava uso não-inglês como "fora de escopo". O ponto de inflexão veio com **LLaMA 3** (abril de 2024), que expandiu os dados de treinamento sete vezes e introduziu um vocabulário de 128.000 tokens — melhorando dramaticamente a codificação de texto não-inglês. LLaMA 3 oficialmente suportava oito idiomas (inglês, alemão, francês, italiano, português, hindi, espanhol, tailandês) com qualidade variável para muitos outros.

A importância de LLaMA para TM reside menos em sua capacidade de tradução direta e mais em seu papel como **modelo de fundação para fine-tuning**. Ambos os LLMs de tradução especializados discutidos abaixo — Tower e ALMA — são construídos em LLaMA. Os pesos abertos criaram um ecossistema próspero de derivados especializados.

### LLMs de Tradução Construídos Especificamente: Tower e ALMA

O desenvolvimento mais significativo de 2023–2024 foi o surgimento de LLMs especificamente ajustados para tradução — sistemas híbridos que herdam a sofisticação contextual de LLMs de propósito geral, mas são otimizados para qualidade de tradução.

**ALMA** (Advanced Language Model-based trAnslator), desenvolvido por **Haoran Xu** e colegas na Johns Hopkins University, demonstrou uma percepção-chave: você não precisa de corpora paralelos massivos para construir um excelente tradutor. ALMA usou uma abordagem **de fine-tuning em dois estágios** em LLaMA-2: primeiro, treinamento prévio continuado em dados monolíngues não-ingleses para expandir conhecimento multilíngue; depois, fine-tuning em um pequeno conjunto de dados paralelos de alta qualidade. O acompanhamento, **ALMA-R** (janeiro de 2024), introduziu **Contrastive Preference Optimisation (CPO)** — treinando o modelo em dados de preferência (traduções melhores vs. piores) em vez de apenas texto paralelo. O resultado: modelos de 7B e 13B parâmetros que igualavam ou superavam GPT-4 em benchmarks de tradução. O artigo foi publicado na ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Uma versão posterior, **X-ALMA**, expandiu cobertura para 50 idiomas usando módulos plug-and-play específicos de idioma.

**Tower**, desenvolvido por **Unbabel** (uma empresa portuguesa de IA de tradução) em colaboração com SARDINE Lab e MICS Lab, tomou uma visão mais ampla. Em vez de otimizar apenas para tradução, Tower cobriu o **pipeline de tradução inteiro**: correção de origem, reconhecimento de entidade nomeada, pós-edição, classificação de tradução e detecção de erro. Os modelos Tower iniciais (7B e 13B, baseados em LLaMA-2) superaram NLLB-200-54B. **Tower v2** (70B, apresentado na WMT 2024) superou GPT-4o, Claude 3.5 Sonnet e DeepL. O mais recente **Tower+** (2025) expandiu para 22–27 idiomas e abordou "esquecimento catastrófico" — a tendência de modelos ajustados perderem capacidades gerais — através de otimização de preferência e aprendizado por reforço.

### Prompting vs. Fine-Tuning: O Debate Contínuo

Uma pergunta persistente no espaço LLM-TM é se é melhor **fazer prompt** de um LLM de propósito geral para tradução (zero-shot ou few-shot) ou **fazer fine-tuning** de um modelo especificamente para tradução. A evidência sugere que a resposta é dependente de tarefa:

- **Prompting** preserva as capacidades gerais do LLM — direcionamento de formalidade, controle de estilo, coerência em nível de documento — e não requer treinamento adicional. É ideal para iteração rápida e tradução criativa ou contextual.
- **Fine-tuning** produz maior precisão em pares de idiomas e domínios específicos, mas arrisca degradar outras capacidades ("esquecimento catastrófico"). Requer dados paralelos e computação.
- **Abordagens híbridas** são cada vez mais dominantes na prática: modelos ajustados para tradução inicial, com passes de pós-edição baseados em LLM ou auto-refinamento.

### O Estado Atual da Arte (2025–2026)

A resposta honesta para "qual é o melhor sistema de TM?" é: **depende**.

| Caso de Uso | Melhor Abordagem | Por Quê |
|---|---|---|
| Alto recurso, alto volume | TM Comercial (Google, DeepL) | Velocidade, custo, consistência |
| Alto recurso, alta qualidade | LLMs (GPT-4o, Gemini 2.5 Pro) ou Tower+ | Compreensão contextual, tratamento de idioma |
| Baixo recurso, cobertura ampla | Meta OMT, NLLB-200, Google Translate | Cobertura multilíngue construída especificamente |
| Baixo recurso, par específico | NLLB ajustado ou LLM ajustado em dados de domínio | Melhoria de qualidade direcionada |
| Pesquisa de código aberto | Tower+, ALMA-R, X-ALMA | Pesos abertos, reproduzível, competitivo |

Em março de 2026, Meta lançou **OMT (Omnilingual Machine Translation)** — o sucessor de NLLB-200, estendendo cobertura de 200 para **1.600+ idiomas**. OMT aborda o que Meta chama de "gargalo de geração": grandes modelos de linguagem podem entender muitos idiomas, mas têm dificuldade em gerar texto fluente neles. OMT vem em duas arquiteturas — OMT-LLaMA (decoder-only, 1B–8B parâmetros) e OMT-NLLB (encoder-decoder) — e introduz novas ferramentas de avaliação incluindo BOUQuET e BLASER 3 (uma métrica de estimativa de qualidade sem referência). Relatórios iniciais indicam que os modelos de 1B–8B parâmetros igualam ou superam baselines de LLM de 70B em tarefas de tradução. Se OMT eventualmente incluirá Plains Cree ou outros idiomas Algonquianos permanece a ser visto.

O artigo de achados da tarefa compartilhada WMT 2024 foi apropriadamente intitulado **"The LLM Era Is Here but MT Is Not Solved Yet."** LLMs elevaram o teto para tradução de alto recurso, mas não resolveram os desafios fundamentais de TM de baixo recurso, adequação de avaliação ou complexidade morfológica.

---

## Parte 4: O Problema dos Recursos Baixos

### Por Que a Maioria dos Idiomas É Deixada Para Trás

Dos aproximadamente 7.000 idiomas vivos no mundo, os serviços comerciais de MT (tradução automática) implantados cobrem cerca de 200, e todas as formas de tradução automática combinadas alcançam apenas cerca de 550 ([como contamos](/docs/network/context/coverage-counting)). A grande maioria das línguas **não possui nenhuma tradução automática**. Entender o porquê exige compreender o que os sistemas de MT precisam e o que falta na maioria das línguas.

TM neural requer **dados paralelos**: grandes coleções de sentenças traduzidas entre dois idiomas por humanos. Para inglês–francês, esses dados existem em abundância — procedimentos parlamentares da UE (Europarl), documentos da ONU, arquivos de notícias e memórias de tradução comerciais fornecem centenas de milhões de sentenças paralelas. Para um idioma como Plains Cree (*nêhiyawêwin*), falado por aproximadamente 20.000 pessoas principalmente no oeste do Canadá, esses dados essencialmente não existem. Não há procedimentos da ONU em Plains Cree. Não há corpora de notícias bilíngues. O texto paralelo total disponível pode ser medido em milhares de sentenças em vez de milhões.

O campo usa tiers de recurso aproximados para categorizar idiomas:

| Tier | Dados Paralelos Disponíveis | Exemplos |
|---|---|---|
| Alto recurso | >10 milhões de pares de sentenças | Inglês, francês, alemão, chinês, espanhol |
| Recurso médio | 1–10 milhões de pares | Turco, vietnamita, suaíli |
| Baixo recurso | 100K–1 milhão de pares | Iorubá, guarani, maltês |
| Recurso extremamente baixo | <100K pares | Plains Cree, quíchua, maioria dos idiomas indígenas |
| Essencialmente zero | <10K pares | Milhares de idiomas em todo o mundo |

### O Problema do Tokenizador

Antes que um modelo neural possa processar texto, ele deve converter caracteres em tokens numéricos — um processo chamado **tokenização**. O algoritmo de tokenização dominante é **Byte Pair Encoding (BPE)**, popularizado por Sennrich et al. (2016) e implementado em ferramentas como **SentencePiece** (Kudo & Richardson, 2018). BPE funciona aprendendo as sequências de caracteres mais comuns em um corpus de treinamento e construindo um vocabulário de unidades de subpalavra. Em inglês, palavras comuns como "the" se tornam tokens únicos; palavras raras são divididas em pedaços de subpalavra ("unforgivable" → "un" + "forgiv" + "able").

O problema é que vocabulários BPE são treinados principalmente em idiomas de alto recurso, com inglês tipicamente dominando. Para idiomas de baixo recurso, especialmente aqueles com morfologia complexa ou scripts não-latinos, as consequências são severas:

- **Sobre-segmentação**: Uma única palavra em um idioma polissintético como Plains Cree pode codificar uma cláusula inteira. A palavra *nikî-nipâw* ("Eu dormi") seria quebrada em numerosos fragmentos — potencialmente bytes individuais — porque o algoritmo BPE nunca viu essas sequências de caracteres antes. O que é uma unidade significativa para um falante se torna uma dúzia de fragmentos sem sentido para o modelo.

- **O problema da fertilidade**: Uma única palavra em um idioma morfologicamente complexo pode exigir 5–15 tokens, enquanto sua tradução em inglês usa 1–3. Isso cria uma assimetria massiva em comprimento de sequência que degrada alinhamento de atenção e qualidade de tradução.

- **Penalidades de script**: Idiomas usando scripts não-latinos (silabários Cree, Etíope, Devanagari) são tokenizados ainda menos eficientemente, às vezes caindo de volta para bytes individuais. Isso significa que a janela de contexto efetiva do modelo é dramaticamente menor para esses idiomas.

Isso não é meramente uma inconveniência técnica. O vocabulário do tokenizador efetivamente codifica um viés em favor de idiomas bem-recursos no nível mais fundamental do sistema. Um modelo que gasta 15 tokens codificando uma única palavra Cree tem muito menos capacidade restante para entender o resto da sentença em comparação com um modelo processando inglês, onde a mesma informação pode ocupar 3 tokens.

### O Problema da Qualidade de Dados

Os dados paralelos limitados que existem para idiomas de baixo recurso frequentemente vêm de **domínios estreitos**. As duas maiores fontes de texto paralelo multilíngue para idiomas sub-recursos são:

1. **Traduções bíblicas**: A Bíblia foi traduzida para mais de 700 idiomas e porções para mais de 3.000. Isso torna o texto religioso o recurso paralelo único mais disponível para muitos idiomas — mas um modelo treinado principalmente em texto bíblico aprende um registro específico, vocabulário e domínio. Pode produzir "thou shalt not", mas não pode traduzir "por favor, reserve um voo."

2. **JW300**: Um conjunto de dados extraído de publicações das Testemunhas de Jeová, cobrindo aproximadamente 300 idiomas. Embora grande e multilíngue, JW300 levanta tanto problemas de viés de domínio (conteúdo religioso) quanto preocupações éticas sobre a proveniência e consentimento das traduções subjacentes.

**Contaminação de benchmark** é outra preocupação séria. Quando dados paralelos são escassos, o mesmo texto pode acabar em conjuntos de treinamento e avaliação — um vazamento de dados que infla métricas de qualidade. Quanto menor o pool de dados, mais difícil é prevenir e detectar isso.

### Aumento de Dados: Fazendo Mais com Menos

Pesquisadores desenvolveram técnicas para esticar dados limitados:

- **Backtranslation** (Sennrich et al., 2016): Treinar um modelo inicial em dados paralelos disponíveis, depois usá-lo para traduzir **texto monolíngue** de idioma de destino de volta para o idioma de origem. Isso cria dados paralelos sintéticos que são ruidosos, mas podem melhorar significativamente a qualidade do modelo. Backtranslation se tornou uma técnica padrão em todo o espectro de recursos.

- **Dados sintéticos gerados por LLM**: Usar grandes modelos de linguagem para gerar dados de treinamento para pares de baixo recurso. Isso é promissor, mas introduz riscos — o texto gerado pode exibir "translationese" (padrões anormalmente literais ou influenciados pela origem) e pode amplificar quaisquer vieses existentes no LLM.

- **Transferência cross-lingual**: Treinar em dados paralelos de um idioma relacionado de recurso mais alto (por exemplo, usando dados espanhol–inglês para inicializar TM guarani–inglês) e esperar que características estruturais compartilhadas se transfiram. Isso funciona melhor para idiomas intimamente relacionados do que para aqueles tipologicamente distantes.

- **Segmentação morfológica**: Pré-processar texto para dividir palavras em morfemas (unidades significativas menores) antes de alimentá-las ao modelo. Para idiomas aglutinadores e polissintéticos, isso pode melhorar dramaticamente a eficiência de tokenização e qualidade de tradução. Essa abordagem se conecta diretamente às ferramentas baseadas em regras discutidas na próxima seção.

---

## Parte 5: Transdutores de Estados Finitos e Sistemas Baseados em Regras

### Por Que Regras Ainda Importam

A narrativa até agora foi uma de dominância neural: sistemas estatísticos substituídos por redes neurais, redes neurais substituídas por Transformers, Transformers escalados em LLMs. Mas há uma tradição paralela em linguística computacional que nunca desapareceu — e para certos idiomas, permanece indispensável.

**Sistemas baseados em regras** codificam conhecimento linguístico explícito: regras morfológicas, léxicos, padrões de transferência sintática. Eles não aprendem com dados; são construídos por linguistas que entendem os idiomas envolvidos. Para idiomas bem-recursos, essa abordagem foi há muito superada por métodos orientados a dados. Mas para idiomas com morfologia complexa e dados mínimos, sistemas baseados em regras frequentemente fornecem a única análise confiável disponível.

### Transdutores de Estados Finitos: Uma Introdução

Um **Transdutor de Estados Finitos (FST)** é um dispositivo computacional que mapeia entre dois níveis de representação — tipicamente entre uma forma de superfície (o que você vê em texto) e uma análise subjacente (o que significa linguisticamente). Pense nele como uma máquina com estados e transições: lê símbolos de entrada, se move entre estados e produz símbolos de saída.

Para um exemplo concreto, considere a palavra Plains Cree *nikî-nipâw*. Um analisador morfológico baseado em FST pode pegar essa forma de superfície e produzir:

> nipâw + Verbo + AI + Independente + Passado + 1ª Pessoa Singular

Isso lhe diz que a palavra é o verbo *nipâw* ("dormir") na ordem independente, tempo passado, primeira pessoa singular — "Eu dormi." O transdutor codifica as regras de morfologia Cree: quais prefixos indicam pessoa, quais marcam tempo, quais formas de verbo tomam quais padrões flexionais. Crucialmente, isso funciona **bidirecionalmente**: dada uma análise, o FST pode gerar a forma de superfície correta.

A infraestrutura técnica para construir FSTs inclui:

- **HFST** (Helsinki Finite-State Transducer Technology): Um kit de ferramentas de código aberto mantido na Universidade de Helsinque, fornecendo o framework computacional para construir e executar transdutores. HFST implementa os formalismos originalmente desenvolvidos pela Xerox (lexc, twolc, xfst) e é compatível com **foma**, outro kit de ferramentas FST de código aberto.

- **lexc**: Um formalismo para especificar o **léxico** — o inventário de morfemas (raízes, prefixos, sufixos) e os padrões de formação de palavras que os combinam.

- **twolc**: Um formalismo para especificar **regras morfofonológicas** — as mudanças de som que ocorrem quando morfemas se combinam (por exemplo, harmonia vocálica, mutação consonantal).

### GiellaLT: Infraestrutura Ártica

**GiellaLT** (da palavra Northern Sámi *giella*, "idioma") é uma infraestrutura de tecnologia de linguagem baseada na **UiT — The Arctic University of Norway** em Tromsø. Representa o esforço mais extenso em todo o mundo para construir ferramentas baseadas em FST para idiomas indígenas e minoritários.

Originalmente conhecido como **Giellatekno** (pesquisa) e **Divvun** (ferramentas de idiomas), o projeto — liderado pelos linguistas **Trond Trosterud** e **Sjur Nørstebø Moshagen** — desenvolveu analisadores morfológicos, corretores ortográficos e outras ferramentas de idiomas para mais de **100 línguas**, com foco nas línguas Sami (Sami do Norte, Sami de Lule, Sami do Sul e outras), línguas urálicas e outras línguas árticas e indígenas.

GiellaLT usa HFST como seu backend computacional e desenvolveu uma infraestrutura compartilhada sofisticada: um sistema de construção comum, frameworks de teste compartilhados e componentes linguísticos reutilizáveis. Todo código é de código aberto, hospedado no [GitHub](https://github.com/giellalt), com centenas de repositórios incluindo infraestrutura central e repos específicos de idioma (por exemplo, `lang-sme` para Northern Sámi, `lang-crk` para Plains Cree). A documentação do projeto fica em [giellalt.github.io](https://giellalt.github.io/). O portal de acesso público, **[Borealium.org](https://borealium.org)** — financiado pelo Conselho Nórdico de Ministros — fornece acesso gratuito a ferramentas de prova, teclados, dicionários, ferramentas de aprendizado de idioma (Oahpa) e síntese de fala para idiomas Sámi, Kven, Faroês, Groenlândês e outros.

O relacionamento entre GiellaLT e política de idioma nacional é notável. Muito do financiamento do projeto vem do **Parlamento Sámi Norueguês** e programas de idioma do governo nórdico, refletindo um compromisso político com tecnologia de idioma indígena que é incomum em escala e duração.

### Apertium: TM de Código Aberto Baseada em Regras

**[Apertium](https://www.apertium.org/)** é uma plataforma de tradução automática baseada em regras de código aberto, originalmente desenvolvida na Universitat d'Alacant (Espanha) com financiamento dos governos espanhol e catalão. Começou em 2004 com foco em pares de idiomas relacionados (espanhol–catalão, espanhol–português) onde regras de transferência rasa — traduzindo palavra por palavra com ajustes morfológicos — produzem resultados surpreendentemente bons. Contribuidores-chave incluem **Francis M. Tyers**, que foi central tanto para o desenvolvimento de Apertium quanto para sua adoção para idiomas sub-recursos.

A arquitetura de Apertium é um **pipeline** clássico:

1. **Análise morfológica** (baseada em FST): Identificar o lema e características morfológicas de cada palavra
2. **Desambiguação de parte-do-discurso**: Escolher a análise correta quando palavras são ambíguas
3. **Transferência lexical**: Mapear lemas de idioma de origem para lemas de idioma de destino
4. **Transferência estrutural**: Aplicar regras para lidar com mudanças de ordem de palavras, concordância e outras diferenças sintáticas
5. **Geração morfológica** (baseada em FST): Produzir a forma de superfície de idioma de destino corretamente flexionada

A partir de 2025, Apertium suporta centenas de pares de idiomas em níveis de qualidade variados, todos hospedados no [GitHub](https://github.com/apertium). Permanece ativamente desenvolvido por uma comunidade internacional e é particularmente útil para pares de idiomas intimamente relacionados onde sua abordagem baseada em regras pode alcançar qualidade razoável sem dados de treinamento.

### Abordagens Híbridas: FST + Neural

A fronteira mais promissora para TM de baixo recurso pode ser **arquiteturas híbridas** que combinam análise morfológica baseada em regras com tradução neural. A ideia é direta: use um FST para segmentar palavras em morfemas (resolvendo o problema de tokenização descrito na Parte 4), depois alimente o texto segmentado para um sistema de TM neural.

Para um idioma polissintético como Plains Cree, isso significa que o modelo neural recebe uma sequência de unidades significativas em vez de fragmentos de byte arbitrários. O **Alberta Language Technology Lab (ALT Lab)** na Universidade de Alberta, liderado por **Antti Arppe**, construiu analisadores morfológicos abrangentes baseados em FST e ferramentas de dicionário voltadas para a comunidade para Plains Cree usando a infraestrutura GiellaLT. Seu trabalho publicado mais recente (Arppe 2025, AmericasNLP) demonstra mapeamento baseado em FST entre formas de palavras Cree flexionadas e frases em inglês — essencialmente "tradução restrita" via métodos de estado finito, operando no nível de palavra/frase em vez de sentenças completas. Notavelmente, ALT Lab **não** publicou um sistema de TM híbrido FST+neural; seu trabalho é fundamentado linguisticamente, baseado em regras e prioriza confiabilidade e utilidade comunitária sobre abordagens neurais experimentais. Enquanto isso, Nguyen, Hammerly e Silfverberg (2025, AmericasNLP) demonstraram um pipeline híbrido LLM+FST para verbos Ojibwe na UBC, alcançando resultados fortes (chrF 0.82) — o análogo publicado mais próximo de uma abordagem híbrida para um idioma Algonquiano.

Essa estratégia híbrida representa uma convergência das duas tradições que correram através da história de TM: o conhecimento explícito do linguista e o aprendizado estatístico do engenheiro. Para os idiomas que mais precisam de TM, nenhuma tradição sozinha é suficiente.

---

## Parte 6: Medindo Qualidade — O Problema da Avaliação

### Como Você Sabe Se Uma Tradução É Boa?

Essa pergunta parece simples. É, de fato, um dos problemas mais difíceis não resolvidos no campo, e como você a responde determina quais sistemas parecem "funcionar" e quais não.

### BLEU: O Padrão Imperfeito

Por mais de duas décadas, a métrica automática dominante em TM foi **BLEU** (Bilingual Evaluation Understudy), introduzida por Papineni et al. na IBM em 2002. BLEU mede quanto as sequências de palavras (n-gramas) da tradução automática se sobrepõem com uma ou mais traduções de referência humana. Inclui uma penalidade de brevidade para evitar que sistemas trapaceiem a pontuação com saídas curtas.

BLEU se tornou a moeda do campo porque é rápido, barato, independente de idioma e reproduzível. Praticamente todos os artigos de TM publicados entre 2002 e 2020 relataram pontuações BLEU. Tarefas compartilhadas WMT o usaram como métrica primária por anos.

Mas BLEU tem falhas profundas que se tornaram cada vez mais aparentes:

- **Sem compreensão semântica**: BLEU é pura correspondência de superfície. Se uma tradução usa um sinônimo perfeito que não aparece na referência, BLEU a penaliza. A sentença "the cat sat on the mat" marca zero contra uma referência de "the feline rested on the rug."
- **Discriminação fraca em nível de sentença**: BLEU foi projetado como uma métrica em nível de corpus. No nível de sentença, é não confiável e ruidosa.
- **Cegueira morfológica**: Para idiomas aglutinadores (turco, finlandês, suaíli), onde um único lema pode ter dezenas de formas flexionadas, correspondência estrita em nível de palavra falha catastroficamente. Um verbo corretamente flexionado que difere por um sufixo da referência marca zero.
- **Correlação fraca com julgamento humano**: Meta-análises, notavelmente Reiter (2018), mostraram que a correlação de BLEU com avaliações de qualidade humana é frequentemente fraca, particularmente para sistemas de alta qualidade e para idiomas distantes do inglês.

### chrF e chrF++

**chrF** (character F-score), introduzido por Maja Popović em 2015, aborda a cegueira morfológica de BLEU medindo sobreposição no **nível de caractere** em vez de nível de palavra. Isso dá crédito parcial para raízes e radicais compartilhados mesmo quando flexões diferem — crucial para idiomas morfologicamente ricos. **chrF++** (Popović, 2017) adiciona n-gramas em nível de palavra de volta, alcançando melhor correlação com julgamento humano do que caractere-apenas ou palavra-apenas. Ambos são implementados em **sacreBLEU**, o kit de ferramentas de avaliação padrão, e se tornaram métricas secundárias padrão em tarefas compartilhadas WMT.

### COMET e xCOMET: Avaliação Neural

O avanço mais significativo em avaliação de TM foi a mudança para **métricas neurais** — modelos de avaliação que são eles próprios Transformers, treinados para prever julgamentos de qualidade humana.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), desenvolvido por Ricardo Rei e colegas em **Unbabel** (2020), usa um codificador cross-lingual (XLM-RoBERTa) para incorporar a sentença de origem, a tradução e a referência, depois prediz uma pontuação de qualidade. Diferentemente de BLEU, COMET opera em espaço semântico — reconhece paráfrases, captura preservação de significado e consistentemente mostrou correlação muito mais alta com julgamento humano do que métricas em nível de superfície. COMET venceu ou ficou em primeiro lugar em Tarefas Compartilhadas de Métricas WMT de 2020 em diante.

**xCOMET** (Guerreiro et al., 2024, publicado em TACL) vai além: além de uma pontuação de qualidade, produz **detecção de erro de intervalo fino** — identificando erros específicos na tradução, classificando-os por tipo (precisão, fluência, terminologia) e severidade (menor, maior, crítico). Isso preenche a lacuna entre pontuação automática e análise linguística humana.

### AfriCOMET: Avaliação para os Desatendidos

COMET padrão, treinado principalmente em julgamentos humanos de idiomas europeus, pode não generalizar bem para idiomas tipologicamente diferentes. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) aborda isso ajustando em dados de avaliação humana de **13 idiomas africanos** e usando **AfroXLM-R** — um codificador multilíngue especificamente treinado para representar melhor idiomas africanos. Esse trabalho, produzido pela comunidade Masakhane (veja Parte 7), demonstra que métricas de avaliação em si devem ser adaptadas para diversidade linguística.

### Avaliação Humana: MQM e Avaliação Direta

Métricas automáticas são proxies. A verdade fundamental permanece **avaliação humana**, que toma duas formas primárias:

**Avaliação Direta (DA)** pede aos avaliadores humanos para marcar traduções em uma escala de 0–100. É relativamente rápido e barato (avaliadores de multidão podem ser usados) e foi o método de avaliação humana primário na WMT de 2017 a 2020. Sua fraqueza: conforme a qualidade de TM melhorou, avaliadores não-especialistas não conseguiam mais distinguir entre sistemas produzindo saída próxima a profissional. DA se tornou não confiável no topo do espectro de qualidade.

**Métricas de Qualidade Multidimensional (MQM)** substituíram DA como método de avaliação humana primário da WMT de 2021 em diante. MQM usa **tradutores profissionais** que marcam intervalos de erro específicos na tradução, classificam erros por tipo (tradução errada, omissão, gramática, terminologia) e severidade (menor = 1 ponto, maior = 5 pontos, crítico = 25 pontos). Isso produz tanto uma pontuação de qualidade quanto informação diagnóstica acionável — você sabe não apenas *quão ruim* uma tradução é, mas *o que especificamente deu errado*.

| Característica | DA | MQM |
|---|---|---|
| Avaliadores | Trabalhadores de multidão | Tradutores profissionais |
| Método | Pontuação holística 0–100 | Anotação de intervalo de erro |
| Diagnósticos | Nenhum | Categorização de erro detalhada |
| Custo | Menor | Maior |
| Confiabilidade | Mais fraca para TM de alta qualidade | Padrão ouro |
| Uso primário WMT | 2017–2020 | 2021–presente |

### A Crise de Avaliação para Idiomas de Baixo Recurso

Para idiomas de baixo recurso, o problema de avaliação é composto por vários fatores:

- **Sem avaliadores qualificados**: MQM requer tradutores profissionais bilíngues. Para muitos LRLs, encontrar tais avaliadores é extremamente difícil.
- **Sem traduções de referência**: COMET e BLEU ambos requerem traduções de referência para comparação. Para muitos domínios e idiomas, estas não existem.
- **Viés de métrica**: Tanto métricas de superfície quanto métricas neurais foram desenvolvidas e validadas em dados de idioma europeu. Seu comportamento em idiomas tipologicamente distantes é incerto.
- **Risco de alucinação**: Em configurações de baixo recurso, modelos de TM podem produzir saída fluente que é completamente não relacionada à origem — um fenômeno chamado **alucinação**. Métricas de superfície podem atribuir pontuações não-zero a saída alucinada se acidentalmente compartilhar n-gramas com a referência.

Construir **conjuntos de avaliação personalizados** — mesmo pequenos de 200–500 pares de sentenças cuidadosamente curados no domínio de destino — é essencial para qualquer esforço sério de TM de baixo recurso. Confiar apenas em pontuações FLORES-200 ou BLEU sem avaliação específica de domínio é uma receita para confiança falsa.

---

## Parte 7: O Cenário Institucional

### Atores Corporativos

O campo de TM é moldado por um punhado de atores corporativos principais, cada um com estratégias distintas:

O **Google Translate** continua sendo o sistema de MT mais utilizado globalmente; sua Cloud Translation API lista **194 idiomas** ([lista publicada pelo Google](https://docs.cloud.google.com/translate/docs/languages) — o produto para o consumidor anuncia mais, mas o Google não publica nenhuma lista estática oficial para ele). A **1000 Languages Initiative** do Google (anunciada em 2022) tem como objetivo construir modelos de IA que cubram os 1.000 idiomas mais falados do mundo. A Cloud Translation API oferece dois níveis: Basic (NMT legado) e Advanced (modelos mais recentes). O Google tem integrado cada vez mais os recursos do seu LLM Gemini ao Translate, com funcionalidades de tradução idiomática e sensível ao contexto surgindo em 2025.

**Meta** se posicionou como o principal impulsionador de TM multilíngue de código aberto através de NLLB-200, M2M-100, FLORES-200 e a suite Seamless. A filosofia de lançamento de modelo aberto da Meta foi transformadora para pesquisa acadêmica, fornecendo baselines e ferramentas que de outra forma exigiriam recursos de computação proibitivos.

**DeepL** ocupa um nicho focado em qualidade, suportando aproximadamente **33 idiomas** — todos relativamente bem-recursos — com uma reputação de saída natural e idiomática preferida por tradutores profissionais. O modelo de negócios da DeepL (consumidor freemium + API paga para empresa) e seu parâmetro de formalidade (controlando registro formal vs. informal) refletem um foco em fluxos de trabalho de tradução profissional em vez de cobertura de idioma ampla.

O **Microsoft Translator** (parte do Azure AI Services) fornece tradução para **135 idiomas** com integração corporativa por meio do Microsoft 365 e do Teams. Seu recurso Custom Translator permite que as organizações façam o ajuste fino de modelos em dados de domínios específicos.

**Unbabel** combina TM com pós-edição humana em um fluxo de trabalho "humano-no-loop", ao lado de suas contribuições de pesquisa (COMET, xCOMET, Tower). Representa a aplicação comercial do paradigma "TM + revisão humana".

**LibreTranslate**, construído no motor **Argos Translate**, fornece uma alternativa de TM totalmente de código aberto e auto-hospedável sem dependência corporativa — importante para organizações com requisitos de soberania de dados.

### Comunidades de Base

Alguns dos trabalhos mais importantes em TM — particularmente para idiomas desatendidos — acontecem em organizações de pesquisa orientadas por comunidade:

**[Masakhane](https://www.masakhane.io/)** (do isiZulu para "construímos juntos") é uma comunidade de pesquisa de base focada em NLP para idiomas africanos, fundada em 2019. Com centenas de membros em todo o continente e diáspora, Masakhane produziu conjuntos de dados fundamentais (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), métricas de avaliação (AfriCOMET) e pesquisa que avançou significativamente NLP de idioma africano. Figuras-chave incluem **David Ifeoluwa Adelani** (Mila / UCL). Código e dados são hospedados no [GitHub](https://github.com/masakhane-io); o hub de comunicação primário é seu espaço Slack (junte-se via masakhane.io), com reuniões comunitárias semanais. Masakhane opera em princípios de propriedade africana de tecnologia de idioma africano — um contra deliberado a padrões de pesquisa extrativista onde instituições externas coletam dados de comunidades de idioma sem colaboração significativa. Eles explicitamente desencorajam "pesquisa de paraquedas" onde outsiders extraem dados linguísticos sem parceria significativa com a comunidade.

**AmericasNLP** é uma série de workshops (co-localizada com NAACL) focada em NLP para idiomas indígenas das Américas. Organizada por pesquisadores incluindo **Manuel Mager**, **Arturo Oncevay** e **Luis Chiruzzo**, executa tarefas compartilhadas em TM para idiomas como Quíchua, Guarani, Aimará, Nahuatl, Rarámuri e outros. O workshop superficializa desafios de pesquisa únicos às Américas — morfologia polissintética, sistemas tonais, escassez de dados extrema e as dimensões políticas de tecnologia de linguagem para povos colonizados.

**[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) na Universidade de Alberta, liderado por **Antti Arppe**, foca especificamente em ferramentas computacionais para Plains Cree e outros idiomas indígenas do oeste do Canadá. ALT Lab constrói analisadores morfológicos baseados em FST e ferramentas de linguagem voltadas para a comunidade (usando a infraestrutura GiellaLT), e trabalha em colaboração próxima com comunidades falantes de Cree — um modelo para desenvolvimento de tecnologia de linguagem centrado em comunidade. Seu projeto de acesso público **[21st Century Tools for Indigenous Languages](https://21c.tools)** fornece dicionários online e ferramentas morfológicas construídas nessa infraestrutura.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (National Research Council Canada), liderado por **Patrick Littell**, mantém um programa ativo suportando 25+ idiomas indígenas em todo o Canadá, incluindo múltiplos dialetos Cree, Algonquino, Innu e Michif. NRC ILT publicou pesquisa de TM para inglês–inuktitut (usando o corpus Nunavut Hansard) e desenvolve ferramentas de código aberto incluindo **kiyânaw Transcribe** (transcrição Cree e Ojibwe), analisadores morfológicos e **ReadAlong Studio** (alinhamento áudio-texto). Todo código é de código aberto e NRC explicitamente não reivindica direitos autorais sobre dados linguísticos comunitários.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) é uma iniciativa de LLM multilíngue de ciência aberta com 3.000+ contribuidores de 119+ países. Embora não seja um sistema de TM dedicado, modelos Aya (Aya-101 cobrindo 101 idiomas, Aya 23 cobrindo 23 idiomas de alto impacto, Tiny Aya cobrindo 70 idiomas em 3.35B parâmetros) são altamente eficazes para tarefas de tradução. A **Aya Collection** — 513M instâncias de estilo de instrução — é o maior conjunto de dados de instrução multilíngue aberto. O modelo de governança comunitária vale a pena estudar.

**[GhanaNLP / Khaya](https://ghananlp.org)** é uma iniciativa de NLP orientada por comunidade que produziu a plataforma de tradução **Khaya** — um dos poucos sistemas de TM realmente governados por comunidade implantados para uso diário. Khaya fornece tradução automática neural, ASR e TTS para ~12 idiomas ganenses (Twi, Ewe, Ga, Fante, Kusaal e outros) via web, aplicativos móveis e API de desenvolvedor. Sua abordagem — 40.000+ pares de sentenças paralelas construídos através de colaboração de linguista e feedback comunitário — demonstra que TM governada por comunidade pode ser operacional, não apenas aspiracional.

### Financiamento e Política

Pesquisa de TM para idiomas de baixo recurso depende de fluxos de financiamento bastante diferentes daqueles que sustentam TM comercial:

- **Lacuna Fund**: Um fundo de dados colaborativo apoiado pela Fundação Rockefeller, Google.org, IDRC do Canadá e GIZ da Alemanha. Lacuna especificamente financia a criação de **conjuntos de dados rotulados** para idiomas sub-representados — preenchendo a lacuna de dados que é a causa raiz de lacunas de qualidade de TM.

- **AI4D** (Artificial Intelligence for Development): Um programa apoiando bolsas de pesquisa de IA para tecnologia de idioma africano, operado através de IDRC e da Agência Sueca de Cooperação Internacional para o Desenvolvimento.

- **Década Internacional da UNESCO de Idiomas Indígenas (2022–2032)**: Um framework político que elevou o perfil de tecnologia de idioma indígena globalmente, embora financiamento de pesquisa concreto tenha sido modesto.

- **Banco Interamericano de Desenvolvimento**: Financiou o projeto **GuaranIA** para TM guarani–espanhol no Paraguai, um exemplo de financiamento de desenvolvimento apoiando tecnologia de linguagem.

- **Conselhos de pesquisa nacionais**: Muito trabalho de TM de baixo recurso é financiado através de canais acadêmicos padrão (NSF, NSERC, programas Horizon da UE), frequentemente como componentes de concessões de IA ou linguística mais amplas.

---

## Parte 8: Fronteiras Abertas

### O Que Permanece Não Resolvido

O campo de TM em 2026 é simultaneamente mais capaz e mais honesto sobre suas limitações do que em qualquer ponto anterior. Vários problemas de fronteira definem o cenário de pesquisa atual:

**Tradução em nível de documento** permanece em grande parte não resolvida. A maioria dos sistemas de TM — incluindo muitos LLMs — traduz sentença por sentença, perdendo coerência de discurso, resolução de pronome entre limites de sentença e consistência estilística. Um tradutor humano lê o documento completo antes de traduzir; a maioria dos sistemas de TM processa sentenças isoladamente. Pesquisa em TM em nível de documento é ativa, mas ainda não produziu sistemas que confiável mantenham coerência em textos longos.

**Discurso e pragmática** — a lacuna entre significado literal e intenção comunicativa — continua desafiando TM. Ironia, subestimação, alusões culturais e sensibilidade de registro (formal vs. informal, respeitoso vs. casual) são parcialmente capturados pelos melhores LLMs, mas inconsistentemente. Um tradutor trabalhando entre japonês e inglês deve navegar um sistema honorífico elaborado; sistemas de TM atuais lidam com isso desigualmente na melhor das hipóteses.

**Tradução multimodal** — traduzindo em contexto com imagens, vídeo ou áudio — é uma área de pesquisa emergente. Um item de menu descrito como "flying fish roe" faz sentido perfeito com uma imagem acompanhante; sem ela, TM pode produzir algo estranho. A suite Seamless e LLMs multimodais (Gemini, GPT-4o) começaram a abordá-lo, mas TM multimodal robusto permanece uma fronteira.

**Tradução de fala-para-fala em tempo real** com latência natural (atraso sub-3-segundo), preservação de identidade do falante e transferência de tom emocional está se aproximando de prontidão para produção para pares de alto recurso. Google, Meta e várias startups demonstraram sistemas protótipos em 2025. Para idiomas de baixo recurso, tradução de fala em tempo real permanece distante.

**A "última milha" para idiomas de baixo recurso** é talvez o problema mais importante não resolvido do campo. A lacuna entre uma pontuação de benchmark FLORES-200 e utilidade real para uma comunidade de idioma é vasta. Um modelo que marca 15 BLEU em tradução Plains Cree–inglês não é útil para qualquer propósito prático. Fechar essa lacuna requer não apenas modelos melhores, mas dados melhores, avaliação melhor, tokenização melhor e — crucialmente — colaboração genuína com comunidades de idioma em vez de extração de recursos linguísticos para publicações acadêmicas.

**Pós-edição e colaboração humano-IA** está se tornando o paradigma dominante para tradução profissional. Em vez de substituir tradutores humanos, TM está cada vez mais posicionada como um gerador de primeiro rascunho que tradutores humanos então refinam. Entender a ciência cognitiva de pós-edição, medir esforço de pós-edição e projetar interfaces que apoiem colaboração humano-IA são áreas de pesquisa ativa com implicações comerciais diretas.

### As Dimensões Políticas

TM não é politicamente neutra. A escolha de quais idiomas suportar, quais dados coletar, quem controla os modelos e quais padrões de qualidade se aplicam são todas decisões com consequências significativas para comunidades de idioma.

A dominância do inglês como idioma pivô codifica uma visão particular de tradução como algo que flui através do inglês. O uso de textos bíblicos e missionários como dados de treinamento para idiomas indígenas levanta questões sobre consentimento e adequação cultural. A concentração de capacidade de TM em um punhado de empresas do Vale do Silício cria relacionamentos de dependência que algumas comunidades de idioma explicitamente resistem.

A **soberania de dados** é uma preocupação central. No Canadá, os **princípios de soberania de dados das Primeiras Nações** afirmam que as comunidades indígenas são proprietárias de seus dados, controlam como eles são coletados e usados, têm acesso a eles e os possuem fisicamente. Para a MT, isso significa que os dados de treinamento derivados de textos em línguas indígenas, os corpora de avaliação construídos a partir do conhecimento da comunidade e os modelos de tradução treinados em recursos mantidos pela comunidade estão todos sob a governança da comunidade — e não sob a governança de qualquer instituição de pesquisa ou empresa de tecnologia que tenha construído o modelo.

Isso tem implicações técnicas diretas. Um sistema de MT construído com dados da comunidade não pode simplesmente ter seu código aberto (open-sourced) no sentido convencional se a comunidade não tiver consentido com isso. Os benchmarks de avaliação não podem ser publicados se os dados de teste incluírem material culturalmente sensível. Um "modelo de propriedade da comunidade" não é uma contradição — é um requisito de design. Qualquer esforço sério em MT de baixos recursos para línguas indígenas deve aspirar à soberania por padrão — projetado para a propriedade e o controle comunitários dos dados linguísticos — e não como uma reflexão tardia.

Essas não são meramente notas de rodapé éticas — elas moldam prioridades de pesquisa, decisões de financiamento e arquiteturas técnicas. "Construir melhor TM" é inseparável de questões sobre quem se beneficia, quem decide e cujo conhecimento linguístico é valorizado.

---

## Apêndice A: Artigos-Chave

Uma lista de leitura cronológica dos artigos que definiram a trajetória do campo. Cada entrada inclui uma breve nota sobre por que importa.

| Ano | Artigo | Autores | Significância |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Estabeleceu a métrica de avaliação de TM dominante por duas décadas |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Demonstrou tradução codificador-decodificador neural |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Introduziu o mecanismo de atenção |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Trouxe TM neural para escala de produção |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Introduziu tokenização BPE para TM |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Introduziu backtranslation para aumento de dados |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Introduziu a arquitetura Transformer |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: representações cross-linguais para 100 idiomas |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: muitos-para-muitos sem pivotagem em inglês |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Métrica de avaliação neural com alta correlação humana |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | NLLB Team (Meta) | Modelo de TM de 200 idiomas + benchmark FLORES-200 |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | Fine-tuning de LLM para tradução SOTA com dados pequenos |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Pipeline de tradução completo em um único LLM |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Detecção de erro fino em avaliação de TM |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | Avaliação de TM adaptada para idiomas africanos |

---

## Apêndice B: Conferências e Comunidades

### Conferências Principais

O ecossistema de conferências de NLP/MT segue um ritmo anual. A tabela abaixo lista os principais eventos, seguidos pelas datas das edições recentes.

| Conferência | Nome Completo | Frequência | Notas |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Anual | O principal local competitivo do campo; tarefas compartilhadas definem benchmarks |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Anual | A conferência de ponta de NLP |
| **EMNLP** | Empirical Methods in NLP | Anual | Conferência de segundo nível; tipicamente hospeda WMT |
| **NAACL** | North American Chapter of the ACL | Anual (alterna com ACL) | Conferência regional principal |
| **EACL** | European Chapter of the ACL | Bienal | Conferência regional europeia |
| **COLING** | Intl. Conf. on Computational Linguistics | Bienal | Foi mesclada com LREC para 2024; agora separada novamente |
| **LREC** | Language Resources & Evaluation Conference | Bienal | Foco em dados, recursos e avaliação |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Anual | Foco em tradução de fala |

#### Edições Recentes

*Apenas datas — propositalmente. Uma coluna de "status" dizendo **Próximos** está errada no
dia em que o evento começa, e esta página não pode saber a data de hoje. Compare as datas
abaixo com o calendário você mesmo; os anais de qualquer evento já realizado estão
na [ACL Anthology](https://aclanthology.org).*

| Evento | Datas | Local |
|---|---|---|
| **COLING 2025** | 19–24 de jan. de 2025 | Abu Dhabi, Emirados Árabes Unidos |
| **EACL 2026** | 24–29 de mar. de 2026 | Rabat, Marrocos |
| **LREC 2026** | 11–16 de mai. de 2026 | Palma de Maiorca, Espanha |
| **ACL 2026** | 2–7 de jul. de 2026 | San Diego, EUA |
| **AmericasNLP 2026** | 3–4 de jul. de 2026 (co-localizado com a ACL) | San Diego, EUA |

*ACL 2025 (Viena), EMNLP 2025 (Suzhou), WMT 2025 (Suzhou), IWSLT 2025 (Viena) e PACLIC 39 (Hanói) todos ocorreram em 2025. Seus anais estão disponíveis na [ACL Anthology](https://aclanthology.org).*

#### Tarefas Compartilhadas WMT 2025

As tarefas compartilhadas WMT são o mais próximo que o campo de TM tem de uma competição pública. A edição de 2025 inclui:

- **General Machine Translation** — a tarefa de ponta
- **Automated Translation Evaluation Systems** — métricas unificadas e estimativa de qualidade
- **Low-Resource Indic Language Translation**
- **Creole Language Translation**
- **Terminology Shared Task**
- **Model Compression** — tornando modelos de TM menores e mais rápidos
- **Open Language Data** — melhorando dados de treinamento abertos
- **Multilingual Instruction Shared Task (MIST)**
- **Limited Resources Slavic LLMs**

### Workshops Especializados

| Workshop | Foco | Edição Mais Recente Conhecida | Co-localizado Com |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Línguas indígenas das Américas | 3–4 de jul. de 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP para línguas africanas | 31 de jul. de 2025 (ACL 2025, Viena) | ACL / ICLR |
| **LoResMT** | MT de baixos recursos | Normalmente anual nas conferências *ACL | Vários |
| **SIGTYP** | ACL SIG em Tipologia Linguística | Workshop anual | ACL |

### Recursos Comunitários-Chave

- **[machinetranslate.org](https://machinetranslate.org)** — Base de conhecimento de código aberto orientada por comunidade sobre tecnologia de TM. Executada pela Machine Translate Foundation (sem fins lucrativos, Zug, Suíça, fundada 2021). Cobre abordagens, APIs, modelos, suporte de idioma e notícias da indústria. Licenciado CC BY-SA 4.0. Um excelente ponto de partida para qualquer tópico neste relatório.

- **[ACL Anthology](https://aclanthology.org)** — O arquivo de acesso aberto definitivo de artigos de pesquisa NLP/CL. Cada artigo em ACL, EMNLP, NAACL, EACL, WMT e locais relacionados está livremente disponível aqui.

---

## Apêndice C: Ferramentas, Conjuntos de Dados e Recursos Práticos

Este apêndice cobre as ferramentas concretas e fontes de dados que importam no trabalho de TM hoje. É escrito para pessoas que sabem seu caminho em torno de um terminal, mas podem não conhecer o ecossistema de TM.

### Frameworks de Treinamento

Estes são os pacotes de software usados para *treinar* modelos de TM neural do zero (ou fazer fine-tuning em existentes). Você usaria estes se estivesse construindo seu próprio modelo de tradução em vez de usar um existente via uma API.

| Framework | Desenvolvedor | Linguagem | Notas |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Edinburgh | C++ | O treinador de TM de código aberto mais rápido — pode treinar um modelo 3–5× mais rápido do que alternativas baseadas em PyTorch. Escrito em C++ puro com dependências mínimas. Alimenta Microsoft Translator. Cada modelo OpusMT (veja abaixo) foi treinado com ele. Nomeado após Marian Rejewski, o matemático polonês que ajudou a quebrar Enigma. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | Kit de ferramentas de pesquisa de trabalho pesado da Meta — usado para construir M2M-100, NLLB-200 e a maioria do trabalho de TM publicado da Meta. Altamente modular: você pode trocar arquiteturas, funções de perda e processamento de dados. A escolha padrão para pesquisadores reproduzindo ou estendendo trabalho da Meta. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | O ponto de entrada mais acessível para treinar modelos de TM personalizados. Originado como um projeto de pesquisa de Harvard, agora mantido por SYSTRAN (uma empresa de TM comercial). Inclui CTranslate2 para implantação (veja abaixo). Boa documentação para iniciantes. |

**Quando você usaria estes?** Se você tem dados paralelos (mesmo alguns milhares de pares de sentenças) e quer treinar ou fazer fine-tuning em um modelo de tradução dedicado para um par de idiomas específico. Você NÃO usaria estes para tradução baseada em LLM (prompting GPT/Claude/Gemini), que não requer treinamento — apenas chamadas de API.

### Inferência e Implantação

Essas ferramentas executam *modelos já treinados* para produzir traduções. Pense nos frameworks de treinamento acima como "a oficina onde o carro é construído" e estes como "a chave de ignição que inicia o carro."

| Ferramenta | O Que Faz | Quando Usar |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Um motor C++ que executa modelos Transformer em alta velocidade com baixa memória. Suporta quantização INT8/INT4 (encolhendo modelos para 1/4 de seu tamanho com perda de qualidade mínima). Executa em CPU ou GPU sem precisar de PyTorch instalado. Suporta NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Quando você quer auto-hospedar um modelo de tradução em um servidor ou laptop sem um cluster de GPU. O padrão para implantação de produção de modelos de TM de código aberto. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Biblioteca Python que carrega e executa modelos com algumas linhas de código: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Fornece ~1.500 modelos OpusMT bilíngues pré-treinados mais NLLB-200, mBART, mT5 e M2M-100. | Quando você quer o caminho mais rápido de "quero traduzir algo" para código funcionando. Duas linhas de Python e você está traduzindo. Throughput menor do que CTranslate2, mas muito mais fácil de configurar. |

### Famílias de Modelos Pré-Treinados

Estes são modelos de tradução *já treinados* que você pode baixar e usar imediatamente. Sem treinamento necessário — apenas carregue e traduza.

| Família de Modelos | Idiomas | Desenvolvedor | O Que É | Onde Encontrar |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1.000+ pares | Universidade de Helsinque (Jörg Tiedemann) | A maior coleção de modelos de tradução bilíngues de código aberto. Cada modelo manipula um par de idiomas (por exemplo, `opus-mt-en-fr` para inglês→francês). Treinado em dados OPUS usando Marian NMT, convertido para formato PyTorch para Hugging Face. A qualidade varia — excelente para pares bem-recursos, marginal para baixo recurso. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 idiomas | Meta | Um único modelo multilíngue que traduz entre qualquer um dos 200 idiomas. Disponível em variantes de 600M, 1.3B e 3.3B parâmetros. A versão 600M executa em um laptop; a versão 3.3B precisa de uma GPU decente. A qualidade varia enormemente — forte para recurso médio, frequentemente pobre para verdadeiro baixo recurso. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 idiomas | Meta | O predecessor de NLLB-200 — primeiro modelo a traduzir diretamente entre pares não-ingleses (por exemplo, bengali↔suaíli) sem rotear através do inglês. Historicamente importante; em grande parte superado por NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 idiomas | Unbabel | Não apenas um tradutor — manipula o pipeline de tradução completo (correção, NER, pós-edição, estimativa de qualidade) em um único LLM. Fine-tuned de LLaMA. A partir de 2025, Tower v2 (70B) supera GPT-4o e DeepL em vários benchmarks. | Hugging Face |
| **ALMA / X-ALMA** | 50 idiomas | Johns Hopkins University | Modelos baseados em LLaMA fine-tuned especificamente para tradução usando otimização de preferência (ensinando o modelo quais traduções humanos preferem). As versões 7B e 13B igualam qualidade GPT-4 em pares de alto recurso. X-ALMA estende para 50 idiomas com módulos adaptadores específicos de idioma. | Hugging Face |

### Fontes de Dados Paralelos

Dados paralelos são o combustível para treinar modelos de TM: coleções de sentenças em dois idiomas que são traduções uma da outra, alinhadas linha por linha. Sem dados paralelos, você não pode treinar um modelo de TM convencional. (Tradução baseada em LLM contorna isso — você pode fazer prompt de GPT para traduzir sem dados paralelos — mas modelos dedicados ainda precisam.)

| Conjunto de Dados | Escala | O Que É | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ pares de sentenças, 1.000+ idiomas | O recurso único mais importante para dados de TM. Uma meta-coleção que agrega dezenas de sub-corpora (veja abaixo) em um portal pesquisável. Criado e mantido por Jörg Tiedemann na Universidade de Helsinque. Se você está procurando dados paralelos em qualquer idioma, OPUS é onde você começa. Acessível via portal web, pacote Python `opustools` e Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M palavras/idioma, 21 idiomas da UE | Procedimentos do Parlamento Europeu — discursos de políticos traduzidos para todos os idiomas oficiais da UE. Criado por Philipp Koehn. Historicamente fundamental (o conjunto de dados que tornou pesquisa de SMT possível), mas limitado a idiomas da UE e registro parlamentar. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Bilhões de pares, 29+ pares de idiomas | Projeto financiado pela UE que rastreia a web para encontrar texto paralelo naturalmente ocorrente (sites bilíngues, páginas traduzidas). Muito mais ruidoso do que corpora curados, mas vastamente maior. Lançou o pipeline de rastreamento **Bitextor** de código aberto, que qualquer um pode usar para minerar seus próprios dados paralelos da web. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M pares de URL, 137 direções emparelhadas com inglês | Documentos paralelos minerados da web de Common Crawl (Meta/JHU). Especialmente útil para idiomas de recurso baixo a médio que não aparecem em corpora curados. A qualidade é menor do que Europarl, mas cobertura é muito mais ampla. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M sentenças paralelas, 1.620 pares | Sentenças paralelas automaticamente mineradas de Wikipedia usando incorporações multilíngues LASER (Meta). Útil porque Wikipedia existe em muitos idiomas — mas o alinhamento é automático (não verificado por humano), então alguns pares são ruidosos ou errados. | GitHub (repo LASER) |
| **[Tatoeba](https://tatoeba.org)** | 500+ idiomas | Uma coleção mantida por comunidade de sentenças de exemplo e suas traduções, contribuídas por voluntários em todo o mundo. Sentenças individuais, não documentos. O **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** associado (Helsinki-NLP) fornece divisões de trem/teste limpas para milhares de pares de idiomas — usado para treinar os modelos OpusMT. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 idiomas | Um benchmark de avaliação padronizado (NÃO dados de treinamento). Sentenças traduzidas profissionalmente usadas para comparar sistemas em pé de igualdade. Criado por Meta ao lado de NLLB-200. Se você quer comparar seu sistema contra baselines publicados, este é o conjunto de teste a usar. | Hugging Face |

### Sub-Corpora Chave dentro de OPUS

OPUS agrega muitos corpora paralelos independentes. Ao procurar dados em um idioma específico, essas sub-coleções valem a pena verificar:

- **OpenSubtitles** — Legendas de filme e TV. Volume massivo, mas ruidoso — legendas são frequentemente simplificadas, informais e podem conter erros de transcrição.
- **JW300** — Publicações das Testemunhas de Jeová, cobrindo ~300 idiomas. A cobertura de idioma mais ampla de qualquer corpus único, mas fortemente enviesada em domínio em relação a conteúdo religioso e eticamente contestada (veja Parte 4).
- **Bible** — Traduções bíblicas em 700+ idiomas. Domínio mais estreito de todos (texto religioso antigo), mas para muitos idiomas, o único texto paralelo que existe.
- **Tanzil** — Traduções do Alcorão. Útil para dados emparelhados com árabe.
- **GNOME / KDE** — Strings de localização de software ("Arquivo → Salvar", "Tem certeza de que deseja deletar?"). Útil para domínio técnico/UI, mas muito formulaico.
- **EMEA** — Documentos da Agência Europeia de Medicamentos. Útil para tradução de domínio biomédico.

---

## Apêndice D: Glossário

**Mecanismo de atenção**: Um componente de rede neural que permite ao modelo focar dinamicamente em diferentes partes da entrada ao produzir cada parte da saída. Introduzido por Bahdanau et al. (2014) para TM; generalizado no Transformer (2017).

**Backtranslation**: Uma técnica de aumento de dados onde texto monolíngue de idioma de destino é traduzido de volta para o idioma de origem por um sistema de TM preliminar, criando dados paralelos sintéticos para treinamento.

**BLEU**: Bilingual Evaluation Understudy. Uma métrica de avaliação de TM automática baseada em sobreposição de precisão de n-grama com traduções de referência.

**BPE (Byte Pair Encoding)**: Um algoritmo de tokenização de subpalavra que iterativamente mescla os pares de caracteres mais frequentes para construir um vocabulário. Usado em praticamente todos os sistemas de TM neural e LLM modernos.

**COMET**: Uma métrica de avaliação de TM neural que usa incorporações cross-linguais para prever julgamentos de qualidade humana, operando em origem + hipótese + referência.

**Maldição da multilingualidade**: O fenômeno onde adicionar mais idiomas a um modelo multilíngue dilui qualidade por idioma devido à capacidade de modelo fixa.

**Codificador–decodificador**: Uma arquitetura neural onde um codificador processa a sequência de entrada em representações e um decodificador gera a sequência de saída a partir dessas representações.

**FLORES-200**: Um benchmark de avaliação de TM padronizado cobrindo 200 idiomas, criado por Meta ao lado de NLLB-200.

**FST (Transdutor de Estados Finitos)**: Um dispositivo computacional que mapeia entre sequências de símbolo de entrada e saída usando estados e transições. Usado em morfologia computacional para analisar e gerar formas de palavra.

**Alucinação**: Em TM, a produção de saída fluente que é não relacionada ou infiel ao texto de origem. Particularmente comum em configurações de baixo recurso.

**Idioma de alto recurso**: Um idioma com texto digital abundante e dados de tradução paralela (tipicamente >10M pares de sentenças com inglês). Exemplos: francês, alemão, chinês, espanhol.

**LLM (Large Language Model)**: Um modelo de linguagem neural com bilhões de parâmetros, treinado em vastos corpora de texto para prever o próximo token. Exemplos: GPT-4, Gemini, LLaMA, Claude.

**Idioma de baixo recurso (LRL)**: Um idioma com texto digital limitado e dados paralelos (<1M pares de sentenças). A grande maioria dos idiomas do mundo cai nessa categoria.

**MQM (Métricas de Qualidade Multidimensional)**: Um framework de avaliação humana onde tradutores profissionais anotam intervalos de erro específicos em traduções, classificados por tipo e severidade.

**TM Neural (NMT)**: TM usando redes neurais, em oposição a abordagens estatísticas (SMT) ou baseadas em regras (RBMT).

**Dados paralelos / corpus paralelo**: Uma coleção de textos em dois idiomas que são traduções um do outro, alinhados no nível de sentença. O recurso de treinamento primário para TM.

**Idioma polissintético**: Um idioma no qual palavras são compostas de muitos morfemas, frequentemente codificando informação que exigiria uma cláusula completa em idiomas analíticos como inglês. Exemplos: Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Um tokenizador de subpalavra independente de idioma e destokenizador que implementa BPE e segmentação de modelo de linguagem unigrama. Amplamente usado em NLP multilíngue.

**Transformer**: A arquitetura neural dominante para NLP desde 2017, baseada inteiramente em mecanismos de auto-atenção. Introduzido em "Attention Is All You Need" (Vaswani et al., 2017).

**Transferência cross-lingual zero-shot**: Aplicar um modelo treinado em um idioma (tipicamente inglês) a outro idioma sem dados de treinamento de idioma de destino, confiando em representações multilíngues compartilhadas.

---

*Este relatório foi compilado em junho de 2026. O campo de TM se move rapidamente; capacidades de modelo específicas e resultados de benchmark devem ser verificados contra fontes atuais. Para os desenvolvimentos mais recentes, consulte [machinetranslate.org](https://machinetranslate.org), a [ACL Anthology](https://aclanthology.org) e anais da tarefa compartilhada WMT mais recente.*



## Aonde isso leva neste site

A lacuna que este briefing descreve — centenas de línguas sem nenhuma tradução
medida — é o que o restante deste site foi construído para preencher. O
argumento de como fazer isso ([O que é o Champollion](/docs/what-is-champollion)), a
economia de construir um conjunto de avaliação em vez de um corpus de treinamento
([Quem se beneficia — pesquisadores](/docs/network/who-benefits#researchers)) e
o estado do que realmente foi medido até agora
([Limitações Honestas](/docs/network/honest-limitations)) são as três
próximas leituras naturais.
