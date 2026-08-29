---
sidebar_position: 3
title: "Medindo o Imensurável"
---

# Medindo o Imensurável: O Problema de Avaliação em Tradução Automática

**Uma pesquisa sobre como o campo mede a qualidade da tradução, onde falha, e o que LYSS (Linguistically-informed Yield & Structural Scoring) oferece como alternativa**

---

> *"Métricas automáticas são uma mentira conveniente. Elas nos dão um número, e o número nos permite escrever um artigo, e o artigo nos permite reivindicar progresso. Se o progresso realmente aconteceu é uma questão separada."*
> — Adaptado de um sentimento recorrente nos WMT Metrics Shared Tasks

---

## Introdução

A tradução automática tem um problema de medição.

O campo passou duas décadas construindo sistemas cada vez mais sofisticados — de tabelas de frases a mecanismos de atenção a modelos de linguagem com trilhões de parâmetros — e durante todo esse arco, lutou com uma questão deceptivamente simples: *como você sabe se uma tradução é boa?*

Essa questão não é acadêmica. A métrica que você escolhe determina qual sistema "vence". Determina o que é financiado, o que é publicado, o que é implantado e — para os idiomas que mais precisam de TA — se as traduções de uma comunidade são julgadas como fracassos quando, na verdade, estão corretas.

A história da avaliação de TA é, em miniatura, uma história dos valores do campo. O domínio do BLEU por quase duas décadas revela uma preferência por medição barata, rápida e agnóstica em relação ao idioma em vez de avaliação informada linguisticamente. O surgimento de métricas neurais como COMET reflete a sofisticação crescente do campo — e sua dependência contínua de dados de treinamento centrados no inglês. A ausência quase total de avaliação ciente de morfologia reflete um campo que, até recentemente, foi construído por e para falantes de idiomas europeus analíticos.

Este artigo traça a evolução da avaliação de TA de BLEU até o presente, identifica onde as abordagens existentes falham sistematicamente para idiomas morfologicamente complexos e de baixo recurso, e examina como uma alternativa linguisticamente fundamentada poderia parecer. É um complemento aos outros documentos de contexto do projeto — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (que traça a história intelectual da linguagem e computação) e o [*Field Briefing*](./mt-field-briefing.md) (que pesquisa o cenário atual de TA). Onde esses documentos perguntam "como chegamos aqui?" e "o que existe?", este pergunta: "como sabemos se algo disso funciona?"

---

## Parte 1: A Era de Correspondência de Strings (2002–2015)

### BLEU e o Nascimento da Avaliação Automática



A era moderna da avaliação de TA começa com um único artigo: "BLEU: a Method for Automatic Evaluation of Machine Translation" de Kishore Papineni, Salim Roukos, Todd Ward e Wei-Jing Zhu, publicado na ACL 2002. BLEU (Bilingual Evaluation Understudy) mede quanto as sequências de palavras (n-gramas) de uma tradução automática se sobrepõem com uma ou mais traduções de referência humana. Inclui uma penalidade de brevidade para evitar que sistemas enganem a pontuação com saídas curtas, e calcula uma média geométrica de precisões de n-gramas nas ordens 1 a 4.

BLEU tornou-se a moeda do campo por uma razão simples: era rápido, barato, reproduzível e independente de idioma. Antes do BLEU, avaliar um sistema de TA exigia avaliação humana cara e lenta. BLEU oferecia um número que podia ser calculado em milissegundos, comparado entre artigos e usado para classificar sistemas em tarefas compartilhadas. Em poucos anos, era essencialmente obrigatório — um artigo sem pontuações BLEU era impublicável.

Mas BLEU tem falhas profundas e bem documentadas que o campo passou duas décadas tentando contornar:

**Sem compreensão semântica.** BLEU é pura correspondência de superfície. "The cat sat on the mat" marca zero contra uma referência de "the feline rested on the rug." Cada palavra é um sinônimo correto; o significado é idêntico; a pontuação é zero.

**Cegueira morfológica.** Para idiomas aglutinantes e polissintéticos, a correspondência rigorosa no nível de palavra falha catastroficamente. Um verbo Cree conjugado corretamente que difere por um morfema da referência marca zero — mesmo que a diferença seja uma partícula gramaticalmente opcional ou uma ordem de palavras igualmente válida.

**Discriminação fraca no nível de sentença.** BLEU foi projetado como uma métrica no nível de corpus. No nível de sentença, é barulhento e pouco confiável — mas é rotineiramente aplicado a sentenças individuais.

**Viés de referência única.** BLEU assume que há *uma* tradução correta (ou um pequeno conjunto de referências). Para idiomas com ordem de palavras livre, vocabulários ricos em sinônimos ou ambiguidades sistemáticas (como o "nós" inclusivo/exclusivo do Cree), pode haver dezenas de traduções igualmente corretas, e BLEU penaliza todas exceto a que coincide com a referência.

**Correlação fraca com julgamento humano.** Meta-análises — notavelmente Reiter (2018, *Computational Linguistics*) — mostraram que a correlação do BLEU com avaliações de qualidade humana é frequentemente fraca, particularmente para sistemas de alta qualidade e para idiomas distantes do inglês.

Essas falhas eram conhecidas quase desde o início. Mas BLEU persistiu porque as alternativas eram piores — não em precisão, mas em conveniência. O campo otimizou para a métrica que podia calcular, não a métrica que precisava.

### NIST (Doddington, 2002)

A métrica NIST, publicada no mesmo ano que BLEU por George Doddington no HLT 2002, modificou a fórmula BLEU de duas maneiras. Primeiro, ponderou n-gramas por seu **conteúdo informativo** — n-gramas raros receberam peso maior que os comuns, com a intuição de que traduzir corretamente uma frase incomum é mais informativo que traduzir corretamente "of the." Segundo, usou uma **média aritmética** em vez da média geométrica do BLEU, produzindo pontuações mais estáveis que não colapsavam para zero quando qualquer ordem de n-grama única não tinha correspondências. NIST foi usado extensivamente nos programas de avaliação DARPA TIDES e NIST OpenMT, mas nunca alcançou o domínio do BLEU na comunidade de pesquisa mais ampla. Apesar de suas melhorias, compartilhava a limitação fundamental do BLEU: correspondência de string no nível de superfície sem conceito de significado.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) foi uma tentativa inicial de abordar a rigidez do BLEU. Onde BLEU realiza correspondência exata de palavras, METEOR introduziu três inovações:

1. **Stemming**: Palavras são reduzidas aos seus radicais antes da comparação, dando crédito parcial para variantes morfológicas (por exemplo, "running" corresponde a "ran" após stemming).
2. **Correspondência de sinônimos**: Usando WordNet, METEOR reconhece que "car" e "automobile" são o mesmo conceito.
3. **Alinhamento de palavras**: Em vez de contar sobreposições de n-gramas, METEOR alinha explicitamente palavras entre a hipótese e a referência, depois calcula precisão e recall com uma penalidade de fragmentação.

METEOR consistentemente mostrou correlação mais alta com julgamentos humanos do que BLEU. Mas exigia recursos específicos do idioma (stemmers, bancos de dados de sinônimos) que limitavam sua aplicabilidade, e era mais lento de calcular. Para o inglês, era melhor. Para idiomas de baixo recurso, os stemmers e bancos de dados de sinônimos simplesmente não existiam.

### TER (Snover et al., 2006)

Translation Edit Rate mede o número mínimo de edições (inserções, exclusões, substituições e *deslocamentos de frases*) necessárias para transformar a hipótese na referência, normalizado pelo comprimento da referência. A operação de deslocamento de frase — mover uma sequência contígua de palavras para uma posição diferente — foi um reconhecimento direto de que a ordem das palavras não é fixa entre idiomas. A abordagem de distância de edição do TER é intuitiva (mede "quanto trabalho um editor pós-edição humano precisaria fazer?"), mas herda a mesma limitação fundamental: compara contra uma única referência e não tem conceito de significado.

### chrF e chrF++ (Popović, 2015; 2017)

A inovação de métrica mais importante entre BLEU e a era neural veio de Maja Popović. **chrF** (character F-score) mede sobreposição no nível de *caractere* em vez do nível de palavra, calculando precisão e recall de n-gramas de caracteres. **chrF++** adiciona unigramas e bigramas no nível de palavra de volta à mistura.

Por que isso importa para idiomas morfologicamente ricos: a correspondência no nível de caractere dá *crédito parcial* para morfemas compartilhados. As palavras Cree *nikî-nipâw* ("eu dormi") e *kikî-nipâw* ("você dormiu") compartilham a maioria de seus n-gramas de caracteres apesar de serem palavras diferentes. chrF daria crédito substancial; BLEU daria zero.

chrF++ tornou-se uma métrica secundária padrão nas tarefas compartilhadas do WMT, implementado em **sacreBLEU** (Post, 2018), e é amplamente reconhecido como superior ao BLEU para idiomas morfologicamente ricos. Mas permanece uma métrica de correspondência de string — melhor que BLEU, mas fundamentalmente limitado pela mesma suposição de que a qualidade da tradução pode ser medida pela sobreposição de forma de superfície.

---

## Parte 2: A Revolução de Métricas Neurais (2018–Presente)



### O Insight: Aprender a Pontuar

As métricas de correspondência de string da Parte 1 compartilham uma escolha de design fundamental: são fórmulas feitas à mão. Alguém decidiu que precisão de n-gramas, sobreposição de caracteres ou distância de edição era um bom proxy para qualidade de tradução, e então todos usaram essa fórmula por uma década.

A revolução de métricas neurais começou com uma pergunta diferente: *e se treinássemos um modelo para prever a qualidade da tradução, da mesma forma que treinamos modelos para traduzir?*

### BERTScore (Zhang et al., 2020)

BERTScore, publicado na ICLR 2020 por Tianyi Zhang e colegas de Cornell e MIT, foi a primeira métrica amplamente adotada a mover a avaliação de correspondência exata de string para similaridade semântica. O mecanismo é elegante: codifique tanto a hipótese quanto a referência através de um modelo Transformer pré-treinado (BERT, RoBERTa ou DeBERTa), calcule a similaridade de cosseno entre cada par de embeddings de token, e então use correspondência gulosa para calcular precisão (melhor correspondência de cada token de hipótese na referência), recall (melhor correspondência de cada token de referência na hipótese) e F1.

BERTScore lida naturalmente com sinônimos, paráfrases e variações de ordem de palavras — "the feline rested on the rug" obtém alta similaridade com "the cat sat on the mat" porque os embeddings contextuais capturam equivalência semântica. Com BERT multilíngue, estende-se para qualquer idioma que o modelo cobre.

Mas BERTScore não é *treinado* em julgamentos de qualidade humana. Usa embeddings pré-treinados como estão, o que significa que captura similaridade semântica geral em vez de aprender especificamente o que torna uma *tradução* boa. Essa distinção importa: uma sentença pode ser semanticamente similar a uma referência enquanto é uma tradução ruim (registro errado, negação omitida, qualificador alucinado). BERTScore também herda quaisquer vieses de idioma que existem no modelo subjacente — para idiomas sub-representados nos dados de treinamento do BERT, os embeddings podem não capturar distinções significativas.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), publicado na ACL 2020 por Thibault Sellam, Dipanjan Das e Ankur Parikh no Google, introduziu uma inovação chave: **pré-treinamento em perturbações sintéticas** antes do ajuste fino em julgamentos humanos. O insight era que ajustar fino um modelo de linguagem diretamente em pequenos conjuntos de dados de julgamento humano do WMT produzia uma métrica que era frágil — ela se ajustava demais aos padrões específicos nos dados de treinamento e falhava em entradas fora da distribuição.

A solução do BLEURT era uma receita de treinamento em duas fases. Na fase um, milhões de pares de sentenças sintéticas foram gerados através de descartes aleatórios de palavras, inserções, substituições e retrotradução. O modelo foi treinado para prever pontuações de métricas automáticas existentes (BLEU, ROUGE, BERTScore, implicação) para esses pares — aprendendo noções gerais de similaridade textual. Na fase dois, o modelo pré-treinado foi ajustado fino em avaliações de Direct Assessment do WMT. Esse "aquecimento" melhorou dramaticamente a robustez.

BLEURT-20 estendeu a abordagem para avaliação multilíngue usando o codificador RemBERT do Google. Mas BLEURT permanece apenas com referência — não usa o texto de origem, o que significa que não pode detectar alucinações que acontecem ser fluentes, e depende inteiramente da qualidade da referência.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) representa o estado da arte atual em avaliação automática de TA. Desenvolvido por Ricardo Rei e colegas na **Unbabel**, COMET usa um codificador multilíngue (XLM-RoBERTa) para incorporar três entradas — a sentença de origem, a hipótese de TA e a tradução de referência — e prediz uma pontuação de qualidade treinada em julgamentos de Direct Assessment humano.

COMET venceu ou ficou em primeiro lugar nas Tarefas Compartilhadas de Métricas do WMT de 2020 em diante. Sua correlação com julgamento humano é substancialmente maior que qualquer métrica de correspondência de string. Reconhece paráfrases, captura preservação de significado e lida com variação de sinônimos que BLEU perde inteiramente.

Mas COMET tem uma limitação crítica para nossos propósitos: é treinado em julgamentos humanos do WMT, que são esmagadoramente em idiomas europeus. Seu codificador multilíngue (XLM-R) foi treinado em dados CommonCrawl onde Plains Cree, North Sámi e a maioria dos idiomas indígenas estão essencialmente ausentes. Para esses idiomas, as representações internas do COMET são pouco confiáveis — pode produzir pontuações, mas essas pontuações não são fundamentadas em nenhuma compreensão real da estrutura do idioma.

### xCOMET (Guerreiro et al., 2024)

xCOMET, publicado em TACL 2024 por Nuno Guerreiro, Ricardo Rei e colegas na Unbabel e Instituto Superior Técnico, estendeu COMET de um pontuador de caixa preta para uma **ferramenta de diagnóstico**. A inovação chave é aprendizado multitarefa: ao lado da pontuação de qualidade no nível de sentença, xCOMET realiza **marcação de sequência no nível de subword** para identificar spans de erro específicos na tradução e classificá-los como menores, maiores ou críticos.

Isso preenche a lacuna entre pontuação automática e análise de erro estilo MQM. Em vez de apenas relatar "esta tradução marca 0,73," xCOMET pode apontar as palavras específicas que estão erradas e indicar o quão severamente. O treinamento usa uma abordagem de aprendizado de currículo: primeiro treinar em dados de Direct Assessment para regressão no nível de sentença, depois adicionar dados anotados com MQM com rótulos de span de erro para treinamento conjunto.

xCOMET alcançou desempenho de ponta em avaliação no nível de sentença, nível de sistema e nível de span simultaneamente. Funciona em modos com e sem referência. Mas requer dados anotados com MQM — que são caros de criar e existem esmagadoramente para pares de idiomas europeus.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, publicado na NAACL 2024 por Jiayi Wang, David Ifeoluwa Adelani e colegas na comunidade Masakhane, é a prova mais importante de que métricas neurais *devem* ser adaptadas para idiomas pouco atendidos — elas não generalizam fora da caixa.

O artigo primeiro demonstrou o problema: COMET padrão, treinado em dados WMT de idiomas europeus, mostrou correlação significativamente mais fraca com julgamentos humanos quando aplicado a 13 idiomas africanos (incluindo Amárico, Hausa, Igbo, Suaíli, Iorubá e Zulu). A correção exigiu duas mudanças. Primeiro, substituir XLM-R por **AfroXLM-R**, um codificador multilíngue especificamente treinado para representar melhor idiomas africanos. Segundo, criar **AfriMTE**, um novo conjunto de dados de avaliação humana com diretrizes MQM simplificadas projetadas para anotadores não-especialistas — porque encontrar tradutores bilíngues profissionais para esses idiomas é difícil.

AfriCOMET provou o conceito: uma métrica neural específica da família de idiomas pode superar dramaticamente a versão genérica. Mas também provou o custo: alguém teve que construir AfroXLM-R, coletar dados de julgamento humano para 13 idiomas e treinar um novo modelo. Para Plains Cree, nenhum codificador equivalente, conjunto de dados de julgamento humano ou métrica adaptada existe. O caminho AfriCOMET exigiria criar todos esses do zero — um esforço de vários anos envolvendo avaliação humana baseada em comunidade e provavelmente um codificador dedicado da família Algonquiana.

### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), publicado na EAMT 2023 por Tom Kocmi e Christian Federmann na Microsoft, fez uma pergunta radical: e se você simplesmente *perguntasse* ao GPT-4 se uma tradução era boa?

A abordagem é desarmadoramente simples. **GEMBA-DA** solicita ao LLM a origem e a hipótese e pede uma avaliação de qualidade em uma escala de 0–100. **GEMBA-MQM** fornece três exemplos anotados e pede ao LLM para identificar spans de erro específicos, classificá-los por tipo e severidade e produzir uma pontuação estilo MQM. Nenhum treinamento específico de métrica é necessário.

Os resultados foram impressionantes: no nível de sistema, GEMBA alcançou correlação competitiva ou de ponta com julgamentos humanos. As anotações de erro do GEMBA-MQM, embora não tão confiáveis quanto anotadores humanos, forneceram informações de diagnóstico interpretáveis sem nenhum treinamento especializado.

Mas GEMBA levanta preocupações sérias. Depende de modelos proprietários de código fechado cujo comportamento muda entre versões de API. Os resultados não são reproduzíveis no sentido estrito. É caro em escala (custos de API para avaliar um conjunto de testes WMT completo). E — criticamente para nossos propósitos — o conhecimento do LLM de idiomas de baixo recurso é incerto. GPT-4 pode ou não entender bem a morfologia do Plains Cree para avaliar traduções; não há como saber sem testar, e não há garantia de que o comportamento será consistente entre atualizações de modelo. O próprio Kocmi e Federmann aconselharam contra usar GEMBA para reivindicar melhorias em artigos acadêmicos devido à natureza de caixa preta da avaliação.

### MetricX e a Tarefa Compartilhada de Métricas do WMT 2024

**MetricX-24**, desenvolvido por Juraj Juraska, Daniel Deutsch, Mara Finkelstein e Markus Freitag no Google, venceu a Tarefa Compartilhada de Métricas do WMT 2024. Construído em **mT5** (Multilingual T5, um modelo codificador-decodificador em vez do codificador único XLM-R usado por COMET), MetricX segue um caminho arquitetônico diferente. Usa ajuste fino em dois estágios — primeiro em dados de Direct Assessment, depois em pontuações MQM — com **aumento de dados sintéticos** extensivo direcionado a modos de falha de métrica conhecidos (subtradução, traduções fluentes mas erradas, alucinações).

O artigo de descobertas do WMT 2024, intitulado **"Are LLMs Breaking MT Metrics?"**, perguntou se traduções geradas por LLM quebraram o ecossistema de métricas. A resposta foi um não qualificado: métricas neurais ajustadas (MetricX-24, variantes COMET) permaneceram eficazes, embora métricas baseadas em LLM (variantes GEMBA) mostrassem força surpreendente no nível de sistema. Descobertas chave:

- **Métricas cientes da origem** (usando origem + referência + hipótese) consistentemente superaram métricas apenas com referência
- **Modelos híbridos** que operam em modos com e sem referência de uma única arquitetura são a direção emergente
- A **lacuna de baixo recurso** persiste: todas as métricas têm desempenho pior em idiomas sub-representados, e a lacuna não está diminuindo
- **Métricas treinadas com MQM** (usando anotações de erro refinadas) consistentemente superam métricas treinadas com DA (usando pontuações escalares)

As implicações para avaliação de baixo recurso são claras: o campo está convergindo em métricas neurais grandes, treinadas e cientes da origem como o padrão ouro. Essas métricas exigem dados de treinamento substanciais, computação e — criticamente — dados de avaliação humana no idioma alvo. Para idiomas sem nenhum desses recursos, o pipeline de métrica de ponta simplesmente não se aplica.

### O Problema de Viés: Métricas Neurais e Idiomas de Baixo Recurso

A revolução de métricas neurais foi, esmagadoramente, um fenômeno de alto recurso. Cada métrica treinada nas seções anteriores foi treinada em dados de julgamento humano do WMT, que cobrem aproximadamente 20 pares de idiomas — todos envolvendo idiomas europeus, chinês ou japonês. Os codificadores subjacentes (XLM-R, mT5, InfoXLM) foram treinados em dados CommonCrawl onde a representação é proporcional à presença na web: o inglês domina, idiomas europeus são bem cobertos, e a vasta maioria dos 7.000+ idiomas do mundo está efetivamente ausente.

Para um idioma como Plains Cree, isso cria uma falha em cascata:

1. **Sem dados de treinamento**: Não há julgamentos humanos do WMT para traduções Cree, então nenhuma métrica foi treinada para avaliá-las.
2. **Sem cobertura de codificador**: O vocabulário do XLM-R foi construído em CommonCrawl, onde texto Cree é vanishingly raro. O tokenizador sobre-segmenta palavras Cree em fragmentos de byte arbitrários, e os embeddings contextuais para esses fragmentos são mal treinados.
3. **Sem validação**: Ninguém mediu se COMET, BLEURT ou MetricX produz pontuações significativas para Cree. Podem produzir *números*, mas não há evidência de que esses números se correlacionem com qualidade real de tradução.
4. **Sem caminho para melhoria**: A abordagem AfriCOMET — construir um codificador específico da família de idiomas, coletar dados de avaliação humana, treinar uma nova métrica — é um esforço de vários anos, multi-instituição. Para uma comunidade de idioma de 20.000 falantes, a infraestrutura de pesquisa para apoiar isso não existe atualmente.

O resultado é um paradoxo: os idiomas que mais urgentemente precisam de avaliação de TA (porque seus sistemas de TA são mais fracos e precisam de avaliação mais cuidadosa) são precisamente os idiomas onde as melhores ferramentas de avaliação são menos confiáveis. A resposta do campo foi recomendar chrF++ como uma alternativa "boa o suficiente" — e é melhor que BLEU — mas chrF++ ainda é uma métrica de correspondência de string que não pode detectar equivalência, não pode lidar com ordem de palavras livre e não tem conceito de validade morfológica.

---

## Parte 3: Além da Pontuação — Avaliação Diagnóstica e Linguística

### A Divisão Adequação/Fluência

Antes de métricas automáticas existirem, a avaliação humana de TA usava um framework com duas dimensões: **adequação** (a tradução transmite o significado da origem?) e **fluência** (a tradução é gramatical e natural no idioma alvo?). Essa distinção, codificada em avaliações iniciais de TA da DARPA e depois no NIST, reconheceu algo que métricas automáticas passariam duas décadas tentando recapturar: a qualidade da tradução não é unidimensional.

O framework adequação/fluência caiu em desuso quando Direct Assessment (uma pontuação escalar única) o substituiu no WMT. Mas o insight subjacente permanece crítico: uma tradução pode ser fluente mas errada (alucinação), ou desfluente mas correta (variante morfológica). Nenhuma pontuação única captura ambas.

### MQM: O Padrão Ouro (Lommel et al., 2014; Freitag et al., 2021)

**Multidimensional Quality Metrics (MQM)** substituiu Direct Assessment como avaliação humana primária do WMT de 2021 em diante. MQM usa tradutores profissionais que marcam spans de erro específicos, classificam-nos por tipo (tradução errada, omissão, adição, gramática, terminologia) e severidade (menor = 1 ponto, maior = 5 pontos, crítico = 25 pontos). Isso produz tanto uma pontuação de qualidade quanto informações de diagnóstico acionáveis.

MQM é a coisa mais próxima de uma metodologia de avaliação "correta" — diz não apenas *quão ruim* uma tradução é, mas *o que especificamente deu errado*. Mas exige tradutores bilíngues profissionais, que para a maioria dos idiomas de baixo recurso não existem em números suficientes para avaliação estatisticamente confiável.

### MorphEval: Avaliação Morfológica Contrastiva (Burlot & Yvon, 2017)

MorphEval é a arte anterior mais direta para avaliação de TA ciente de morfologia. Introduzido por Franck Burlot e François Yvon no WMT 2017 e estendido em 2018, MorphEval avalia *competência* morfológica usando **conjuntos de testes contrastivos**.

**Como funciona:** O conjunto de testes consiste em pares de sentenças no idioma de origem que diferem por exatamente um contraste morfológico — por exemplo, singular vs. plural, presente vs. passado, masculino vs. feminino. O sistema de TA traduz ambas as sentenças. Se o sistema transmite corretamente o contraste em suas traduções (por exemplo, produzindo um alvo plural quando a origem é plural e um alvo singular quando a origem é singular), o contraste é marcado como correto.

**Idiomas cobertos:** Inglês→Tcheco, Inglês→Letão (v1, WMT 2017); estendido para Inglês→Francês, Inglês→Alemão, Inglês→Finlandês, Turco→Inglês (v2, WMT 2018).

**Descobertas chave:** MorphEval revelou que até sistemas de TA neural de alto desempenho tinham falhas morfológicas sistemáticas — podiam produzir saída fluente enquanto acertavam tempo, número ou caso errado. Esses erros eram invisíveis para BLEU e até parcialmente invisíveis para COMET.

**Disponibilidade:** Código aberto no GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limitações:** MorphEval exige conjuntos de testes contrastivos elaborados por idioma alvo, projetados por linguistas que entendem os contrastes morfológicos desse idioma. Nenhum conjunto de testes existe para qualquer idioma polissintético. A metodologia testa *competência* (o sistema pode lidar com esse contraste?) em vez de *validade* (o sistema produziu palavras reais?) ou *equivalência* (essas duas traduções diferentes são ambas corretas?).

### CheckList: Testes Comportamentais para NLP (Ribeiro et al., ACL 2020)

**CheckList**, publicado na ACL 2020 por Marco Tulio Ribeiro e colegas (vencendo Melhor Artigo), importou uma ideia da engenharia de software para avaliação de NLP: **testes unitários**. Em vez de avaliar o desempenho agregado de um modelo em um benchmark, CheckList define uma matriz de **capacidades** (vocabulário, negação, entidades nomeadas, raciocínio temporal, correferência) cruzadas com **tipos de teste**:

- **Testes de Funcionalidade Mínima (MFT)**: Casos de teste simples e direcionados que qualquer modelo competente deveria passar.
- **Testes de Invariância (INV)**: Perturbações na entrada que *não* devem mudar a saída (por exemplo, mudar um nome não deveria mudar o sentimento).
- **Testes de Expectativa Direcional (DIR)**: Perturbações que *devem* mudar a saída de forma previsível.

Checklist foi originalmente projetado para análise de sentimento e NLI, mas o paradigma é diretamente aplicável a TA. Alguém poderia criar MFTs para fenômenos morfológicos ("o sistema produz a forma plural correta?"), testes INV para ordem de palavras livre ("reordenar as palavras Cree muda a tradução para inglês?"), e testes DIR para características morfológicas ("mudar a origem de passado para presente muda o tempo do alvo?").

O paradigma CheckList é particularmente relevante porque formaliza o que MorphEval faz intuitivamente: testar capacidades específicas em vez de medir pontuações agregadas. Nossas classes de variante do linter (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, etc.) são, em efeito, regras de invariância — definem perturbações que não devem mudar o veredicto de avaliação.

### Conjuntos de Desafio e Avaliação Direcionada

O paradigma mais amplo de **conjuntos de desafio** — conjuntos de testes elaborados direcionados a fenômenos linguísticos específicos — tornou-se uma metodologia de avaliação complementar estabelecida no WMT desde aproximadamente 2017.

**Isabelle, Cherry & Foster (2017)**, no NRC Canada, pioneirizaram a abordagem para TA com conjuntos de testes elaborados manualmente isolando divergências estruturais entre idiomas — casos onde tradução literal é provável estar incorreta. Seu trabalho de acompanhamento (Isabelle & Kuhn, 2018) construiu 506 sentenças francesas direcionadas a desafios de tradução específicos, fornecendo imagens refinadas de capacidades de sistema.

**LingEval97** (Sennrich, EACL 2017) criou 97.000 pares de tradução contrastivos Inglês→Alemão testando se modelos NMT atribuem probabilidade mais alta a traduções corretas versus pares com erros morfossintáticos introduzidos. Uma descoberta chave: modelos no nível de caractere exceliam em transliteração mas tinham desempenho pior em concordância morfossintática de longa distância.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) escalou a abordagem de conjunto de desafio dramaticamente: 36.476 exemplos abrangendo 146 pares de idiomas testando 68 fenômenos linguísticos distintos. ACES foi usado para meta-avaliar métricas submetidas à tarefa compartilhada de métricas do WMT — testando se *métricas* podiam detectar os contrastes, não apenas se *sistemas* podiam produzi-los. Estendido para **SPAN-ACES** com anotações de span de erro.

**MT-GenEval** (Currey et al., EMNLP 2022) e **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) direcionam especificamente a precisão de gênero. WinoMT é notável porque usa explicitamente **análise morfológica** no idioma alvo para verificar o gênero de ocupações traduzidas — um dos poucos casos onde um analisador morfológico é usado como parte de uma ferramenta de avaliação de TA.

**Hjerson** (Popović & Ney, 2011) é uma ferramenta de código aberto para classificação automática de erro de TA que usa **lemas e tags POS** para categorizar erros em cinco tipos: morfológico, reordenação, palavras faltantes, palavras extras e erros lexicais. Isso é talvez a arte anterior mais próxima ao nosso linter em espírito — usa análise linguística para fornecer categorias de erro de diagnóstico em vez de uma pontuação única.

O fio condutor: o campo reconheceu, repetidamente, que pontuações agregadas são insuficientes. Avaliação diagnóstica fornece a granularidade necessária para entender *por que* um sistema falha. Mas abordagens diagnósticas exigem expertise linguística por idioma, e essa expertise está concentrada em idiomas europeus.

### AmericasNLP: Avaliação nas Trincheiras

A série de workshops AmericasNLP (co-localizada com NAACL), focada em NLP para idiomas indígenas das Américas, fornece o ponto de comparação mais direto para nossos desafios de avaliação.

De 2021 a 2023, a tarefa compartilhada usou **chrF** como sua métrica de avaliação primária — escolhida por sua robustez em configurações de baixo recurso e sua correspondência no nível de caractere, que fornece crédito parcial para sobreposição morfológica. Os organizadores reconheceram as limitações do chrF mas não tinham alternativa melhor que funcionasse entre as tipologias diversas representadas (Quéchua, Guaraní, Aimará, Nahuatl, Rarámuri e outros).

Em 2025, AmericasNLP introduziu uma **Tarefa Compartilhada 3** dedicada especificamente ao desenvolvimento de métricas de avaliação de TA para idiomas indígenas — a primeira vez que o campo explicitamente reconheceu que métricas existentes são inadequadas para esses idiomas. A submissão vencedora, **FUSE** (Feature-Union Scorer), combinou embeddings de sentença multilíngues (LaBSE ajustado fino), similaridade lexical, similaridade fonética e correspondência de token fuzzy via regressão Ridge e Gradient Boosting. FUSE não usa analisadores morfológicos — a engenharia de características é agnóstica em relação ao idioma.

Essa é a lacuna que nosso trabalho ocupa. AmericasNLP identificou o problema (métricas padrão falham para idiomas indígenas) e começou a desenvolver alternativas (FUSE). Mas nenhuma das alternativas usa o conhecimento morfológico que FSTs fornecem. A comunidade AmericasNLP usa chrF++ porque é a melhor opção genérica disponível, enquanto a comunidade GiellaLT constrói ferramentas morfológicas sofisticadas que nunca são conectadas à avaliação de TA. As duas comunidades não convergiram.

---

## Parte 4: Avaliação Sem Referência e Estimativa de Qualidade

Alguns dos sinais de avaliação mais importantes em nosso harness não exigem traduções de referência. A verificação de validade do FST ("isso é uma palavra real?") precisa apenas da saída de TA. O detector de alucinação precisa da origem e hipótese. O detector de code-switching precisa apenas da hipótese e conhecimento do script do idioma alvo. Entender onde esses se encaixam no cenário mais amplo de avaliação sem referência é essencial para posicioná-los corretamente.

### O Paradigma de Estimativa de Qualidade

**Quality Estimation (QE)** é o subcampo de avaliação de TA preocupado com prever a qualidade da tradução *sem* traduções de referência. Tem sido uma tarefa compartilhada dedicada no WMT desde 2012, motivada pela necessidade prática de avaliar a qualidade de TA no tempo de implantação — quando você está traduzindo novo texto e não tem referência humana para comparar.

A tarefa QE evoluiu através de três gerações. **QE baseado em características** (2012–2016) extraiu características feitas à mão da origem e hipótese — perplexidade do modelo de linguagem, frequência de palavra, sobreposição de n-gramas com dados monolíngues — e treinou classificadores para prever qualidade. **QE neural** (2017–2021) substituiu características feitas à mão por representações aprendidas, tipicamente usando codificadores bilíngues. **QE atual** (2022–presente) é dominado por abordagens baseadas em COMET, particularmente **CometKiwi**.

### CometKiwi e COMET Sem Referência

**CometKiwi** (Rei et al., WMT 2022), a variante sem referência do COMET, usa InfoXLM para codificar a sentença de origem e hipótese de TA (sem referência) e prediz uma pontuação de qualidade. Alcançou resultados de ponta nas tarefas compartilhadas de QE do WMT 2022 e 2023.

A descoberta notável: CometKiwi sem referência se aproxima da correlação com julgamento humano alcançada por COMET com referência. Isso sugere que, para idiomas bem-recursos, o texto de origem contém quase tanta informação de avaliação quanto a tradução de referência. Mas a mesma ressalva se aplica: o codificador do CometKiwi tem representação mínima para idiomas de baixo recurso, então suas predições sem referência para Cree ou Sámi são pouco confiáveis.

É aqui que nossas métricas baseadas em FST oferecem algo genuinamente diferente. A verificação de validade do FST é um **sinal de qualidade determinístico e sem referência** que não exige modelo treinado e nenhum dado de julgamento humano. Se o FST diz que uma palavra não é uma palavra Cree válida, essa palavra não é uma palavra Cree válida — com a ressalva de rejeições falsas para empréstimos, neologismos e nomes próprios. Esse tipo de sinal de qualidade duro e baseado em regras não tem equivalente no ecossistema de QE neural.

### Detecção de Alucinação em TA

Alucinação em TA — saída fluente que é completamente não relacionada à origem — é um modo de falha sério, particularmente em configurações de baixo recurso onde modelos têm dados de treinamento insuficientes para aprender correspondências confiáveis origem-alvo.

O estado da arte acadêmica em detecção de alucinação usa várias abordagens:

- **Detecção baseada em embedding**: Comparando embeddings de origem e hipótese em um espaço compartilhado (LASER, LaBSE) e sinalizando casos onde a similaridade está abaixo de um limiar.
- **Detecção baseada em probabilidade**: Usando as próprias pontuações de confiança do modelo de TA — alucinações tendem a ter probabilidade de saída alta mas probabilidade condicionada à origem baixa.
- **Perturbação contrastiva**: Comparando a saída de TA para a origem real contra saída para uma origem perturbada ou não relacionada; se as saídas são suspeitosamente similares, o modelo está ignorando a origem.
- **LLM-as-judge**: Solicitando a um LLM para avaliar se a tradução é fiel à origem.

Nosso harness usa um **plugin de detecção heurística** que combina quatro sinais: inflação de comprimento (hipótese muito mais longa que o esperado), repetição (frases repetidas), incompatibilidade de entidade (entidades nomeadas na origem faltando na hipótese) e eco de origem (hipótese é muito similar ao texto de origem, sugerindo cópia não traduzida). Isso é nível de baseline comparado ao SOTA acadêmico — captura alucinações grosseiras mas perderá as sutis. Seu valor é como uma **tela barata, rápida e sem referência** que pode sinalizar as piores falhas sem exigir uma GPU ou uma chamada de API.

### Detecção de Code-Switching

Code-switching em saída de TA — onde o sistema produz palavras no idioma de origem em vez de traduzi-las — é um modo de falha distinto de alucinação. Tipicamente ocorre quando o modelo encontra uma palavra que não pode traduzir e volta a copiar a origem.

Nosso plugin de detecção de code-switching usa **análise de bloco Unicode** (detectando caracteres do script do idioma de origem no que deveria ser saída do idioma alvo) e **listas de palavras comuns** (identificando palavras de alta frequência do idioma de origem que aparecem não traduzidas). Para Cree, que usa tanto SRO (baseado em latim) quanto silábicos, isso exige algum cuidado — inglês e SRO compartilham o script latino, então análise de bloco Unicode sozinha é insuficiente.

A literatura acadêmica sobre detecção de code-switching em TA é escassa comparada à detecção de alucinação. A maioria do trabalho se concentra em code-switching em texto de *entrada* (falantes bilíngues misturando idiomas) em vez de em texto de *saída* (sistemas de TA falhando em traduzir). Nossa abordagem heurística é, ao nosso conhecimento, não significativamente atrás de qualquer estado da arte publicado para esse problema específico.

---

## Parte 5: A Lacuna Morfológica

### O Que Métricas Existentes Não Podem Ver

Esse é o argumento central deste artigo, e exige uma demonstração concreta.

Considere o par de sentenças Plains Cree:

| | Texto |
|--|------|
| **Origem (Inglês)** | "I saw the man" |
| **Referência (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hipótese A** | *nâpêw nikî-wâpamâw* |
| **Hipótese B** | *nikî-wâpamikow nâpêsis* |

**Hipótese A** é uma tradução perfeita — tem as mesmas palavras em ordem diferente, que é gramatical em Cree (ordem de palavras livre). **Hipótese B** diz "o menino foi visto por mim" — direção errada de ação (*-ikow* é inverso), referente errado (*nâpêsis* = "menino", não "homem").

| Métrica | Hipótese A (correta) | Hipótese B (errada) | Pode diferenciá-las? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Mal |
| chrF++ | ~65% | ~55% | Até certo ponto |
| COMET | Desconhecido (sem dados de treinamento Cree) | Desconhecido | Pouco confiável |
| **Aceitação FST** | 100% | 100% | Não (ambas são Cree válido) |
| **Linter** | EQUIVALENTE (WORD_ORDER) | MISS | **Sim** |
| **Validador semântico** | VÁLIDO | ERRADO | **Sim** |

O linter e validador semântico têm sucesso onde BLEU, chrF++ e COMET falham — não porque sejam "métricas melhores" em algum sentido universal, mas porque têm acesso a *conhecimento linguístico* que métricas de correspondência de string e neurais não têm. Sabem que Cree tem ordem de palavras livre. Sabem que *wâpamêw* e *wâpamikow* são lemas diferentes com estruturas de argumento diferentes. Sabem que *nâpêw* e *nâpêsis* são palavras diferentes.

Esse conhecimento vem do FST (que codifica a gramática morfológica), do dicionário bilíngue (que fornece glossas em inglês para cada lema) e das classes de variante definidas manualmente (que codificam regras de equivalência linguisticamente fundamentadas). Nenhum desse conhecimento está disponível para uma métrica que trata a tradução como uma string.

### Por Que o Campo Não Abordou Isso

A lacuna morfológica na avaliação de TA não é um mistério. O campo sabe que existe. As razões pelas quais persiste são estruturais:

1. **Viés de escala.** A comunidade de avaliação de TA otimiza para métricas que funcionam em todos os pares de idiomas do WMT. Métricas baseadas em FST funcionam para ~30 idiomas. COMET funciona para 100+. chrF++ funciona para todos os idiomas com um sistema de escrita. A comunidade recompensa universalidade sobre precisão.

2. **Silos de comunidade.** As pessoas que constroem FSTs (linguistas computacionais em UiT Tromsø, NRC Canada, University of Alberta) e as pessoas que constroem métricas de avaliação (pesquisadores de ML no Google, Unbabel, WMT) frequentam conferências diferentes, publicam em venues diferentes e operam sob estruturas de incentivo diferentes. A polinização cruzada que seria necessária para construir métricas de avaliação baseadas em FST não aconteceu — não porque foi tentada e falhou, mas porque as comunidades nunca convergiram.

3. **Ansiedade de cobertura.** FSTs têm problemas conhecidos de rejeição falsa: empréstimos, neologismos e nomes próprios podem ser rejeitados como inválidos mesmo quando são perfeitamente aceitáveis. Isso deixa pesquisadores nervosos sobre usar FSTs como métricas — uma rejeição falsa infla a taxa de erro. A preocupação é válida mas quantificável: medir a taxa de rejeição falsa em texto conhecido como bom é direto.

4. **Demanda insuficiente.** Muito poucas pessoas estão construindo TA para idiomas polissintéticos, e as que estão (ALT Lab, NRC, participantes AmericasNLP) tipicamente estão usando chrF++ porque é o que existe. Não houve um impulso concertado da comunidade de TA de baixo recurso por avaliação ciente de morfologia, em parte porque a comunidade é pequena e em parte porque construir tais métricas exige expertise tanto em engenharia de NLP quanto na morfologia do idioma alvo específico.

5. **A suposição de métrica neural.** A suposição prevalecente desde 2020 tem sido que métricas neurais eventualmente resolverão o problema morfológico através de representações aprendidas. Se você treinar COMET em dados suficientes de idiomas morfologicamente ricos, o argumento vai, ela aprenderá a lidar com variação morfológica implicitamente. Isso pode ser verdade para idiomas morfologicamente ricos de alto recurso (Finlandês, Turco, Tcheco). É improvável ser verdade para idiomas com representação efetivamente zero nos dados de treinamento.

---

## Parte 6: LYSS — Uma Alternativa Linguisticamente Fundamentada

### O Que champollion Construiu: LYSS (Linguistically-informed Yield & Structural Scoring)

O harness de avaliação do projeto champollion implementa um framework de pontuação composto chamado **LYSS** que combina métricas padrão (chrF++, correspondência exata) com quatro categorias de métricas linguisticamente informadas. O nome reflete o foco do framework: medir o *rendimento* (quanto significado sobrevive ao processo de tradução) através de *pontuação estrutural* (verificações determinísticas e linguisticamente fundamentadas em vez de embeddings aprendidos).

#### 1. Portão de Validade Morfológica (Métrica FST GiellaLT)

A métrica mais simples e amplamente aplicável: alimentar cada palavra da saída de TA através do analisador morfológico de estado finito GiellaLT para o idioma alvo. Se o FST pode analisar uma palavra (retorna pelo menos uma análise), a palavra é morfologicamente válida. Se não, a palavra não existe no idioma alvo — é uma palavra alucinada, um erro morfológico, um erro de digitação ou um empréstimo não no léxico.

**Saída:** `fst_validity_rate` (0,0–1,0, maior = melhor). Macro-média (média de taxas por entrada) e micro-média (palavras válidas totais / palavras totais).

**Dependências:** `pyhfst` (bindings Python de Helsinki Finite-State Technology), um arquivo analisador `.hfstol` compilado para o idioma alvo.

**Extensibilidade:** Funciona para qualquer idioma com um analisador FST GiellaLT — atualmente ~30+ idiomas, principalmente Sámi, Uralic e idiomas indígenas do Ártico.

**Relação com arte anterior:** MorphEval testa se um sistema pode lidar com contrastes específicos. A métrica FST testa se a saída do sistema consiste em palavras reais. Esses são complementares: MorphEval testa competência, a métrica FST testa validade.

#### 2. Classes de Equivalência Linguística (Linter CRK)

O linter aborda o que pode ser o modo de falha mais insidioso da avaliação baseada em referência: **penalizar traduções corretas que diferem da referência**.

O linter Plains Cree (844 linhas) implementa seis **classes de variante**, cada uma codificando uma regra de equivalência linguisticamente fundamentada:

- **WORD_ORDER**: Cree tem ordem de palavras pragmaticamente livre (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* e *nâpêw nikî-wâpamâw* significam a mesma coisa. O linter gera todas as permutações e verifica se a hipótese corresponde a qualquer uma.
- **ORTHOGRAPHIC**: A Ortografia Romana Padrão tem pontos de variação conhecidos — circunflexo vs. macron (*â* vs. *ā*), hifenização de preverbs (*nikî-nipâw* vs. *nikî nipâw* vs. *nikînipâw*). O linter normaliza esses.
- **OPTIONAL_PARTICLE**: Certas partículas de discurso (*mâka*, *êkwa*, *êwako*) podem estar presentes ou ausentes sem mudar a proposição central. O linter verifica se a hipótese corresponde à referência após remoção de partícula.
- **LEMMA_SYNONYM**: Alguns lemas Cree são intercambiáveis em contextos específicos. Isso usa uma lista de sinônimos curada (por exemplo, variantes dialetais) e, quando o FST está disponível, verifica se a hipótese e referência compartilham análises morfológicas.
- **PROGRESSIVE_AMBIGUITY**: Formas progressivas em inglês ("is walking") podem ser traduzidas para Cree usando construções diferentes. O linter reconhece essas como equivalentes.
- **INCLUSIVE_EXCLUSIVE**: Cree distingue "nós" inclusivo (*ki-* prefixo) de "nós" exclusivo (*ni-* prefixo) — uma distinção que o inglês colapsa em um único pronome. O linter reconhece que qualquer forma pode estar correta quando a origem em inglês é ambígua.

O linter produz três vereditos: **EXACT** (hipótese corresponde à referência), **EQUIVALENT** (hipótese difere mas é classificada como uma variante válida) ou **MISS** (nenhuma correspondência encontrada). No nível agregado, calcula um `equivalent_match_rate` — a proporção de traduções que são exatas ou equivalentes.

**Relação com arte anterior:** O paralelo mais próximo é **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), que codifica exponencialmente muitas traduções válidas como redes de paráfrase e mede distância de edição para a forma válida mais próxima. Nosso linter é conceitualmente similar — define um conjunto de traduções válidas para cada referência — mas usa regras de transformação definidas linguisticamente em vez de bancos de dados de paráfrase. HyTER foi projetado para inglês; ninguém construiu redes de paráfrase para Cree. Nossas regras de variante são, em efeito, uma aproximação compacta e baseada em regras do que HyTER faz com gráficos.

No framework CheckList, nossas classes de variante funcionam como **testes de invariância**: transformações que não devem mudar o veredicto de avaliação. A diferença é que testes CheckList são tipicamente aplicados ao *modelo*; nossas regras de variante são aplicadas à *métrica*.

#### 3. Validação Semântica Determinística (Métrica Semântica CRK)

O validador semântico (792 linhas) tenta algo mais ambicioso: **comparação de significado determinística** sem embeddings neurais. Opera em quatro estágios:

1. **Análise morfológica**: Tanto a hipótese quanto a referência são passadas pelo analisador CRK FST, que retorna o lema e os traços morfológicos para cada palavra.
2. **Resolução de glosas**: Cada lema é consultado via API do dicionário itwêwina — que disponibiliza Wolvengrey (2001) juntamente com os dicionários Maskwacîs e dos Anciãos de Alberta — para obter glosas em inglês.
3. **Extração de palavras de conteúdo**: Usando o pipeline em inglês do spaCy (`en_core_web_md`), as palavras funcionais são filtradas tanto das glosas em inglês quanto do texto de origem.
4. **Pontuação de sobreposição**: A sobreposição de palavras de conteúdo entre as glosas da hipótese e as glosas da referência determina o veredito semântico.

O validador produz vereditos categóricos: **EXACT_MATCH**, **VALID** (palavras diferentes mas mesmo significado), **GRAMMAR_ISSUES** (lemas corretos mas problemas de gramática no nível de sentença — concordância, animacidade, forma de verbo), **PARTIAL** (algum significado preservado), **INCOMPLETE** (significado parcialmente faltando), **WRONG** (significado diferente) ou **NO_OUTPUT**.

**Relação com arte anterior:** Isso é, em efeito, uma **aproximação determinística da computação de similaridade semântica do COMET**. Onde COMET usa embeddings multilíngues aprendidos para avaliar se duas sentenças significam a mesma coisa, nosso validador usa uma cadeia de lookups determinísticos: FST → dicionário → spaCy. A vantagem é transparência (cada passo é inspecionável e determinístico) e independência de dados de treinamento. A desvantagem é fragilidade: a qualidade da avaliação depende inteiramente da cobertura do FST e da completude do dicionário.

A abordagem é conceitualmente relacionada a **MEANT** (Lo & Wu, 2011; Lo, 2017), que usou marcação de papel semântico para avaliar se a estrutura "quem fez o quê para quem" foi preservada na tradução. Nossa abordagem é mais coarse-grained (sobreposição de palavras de conteúdo em vez de papéis semânticos) mas opera em um idioma onde nenhuma ferramenta SRL existe.

#### 4. Plugins de Detecção Comportamental (Alucinação, Code-Switching, Terminologia)

Três plugins adicionais fornecem **sinais de qualidade comportamental** que complementam as métricas morfológicas:

- **Detecção de alucinação** (259 linhas): Quatro sinais heurísticos ponderados e combinados — inflação de comprimento (40%), repetição (30%), incompatibilidade de entidade (20%), eco de origem (10%). Essas são telas baratas e sem referência que capturam fabricação grosseira.
- **Detecção de code-switching** (~280 linhas): Análise de bloco Unicode mais listas de palavras comuns para detectar tokens do idioma de origem não traduzidos. Produz um `code_switching_rate` (0,0–1,0).
- **Aderência de terminologia** (199 linhas): Verifica se termos de glossário especificados são traduzidos consistentemente. Retorna `terminology_adherence` (0,0–1,0) ou None se nenhum glossário está configurado.

Esses plugins são honestamente posicionados como **detectores heurísticos de nível baseline**, não SOTA. Seu valor é fornecer sinais baratos, rápidos e interpretáveis que podem ser calculados ao lado das métricas morfológicas mais sofisticadas. No framework de pontuação composto, carregam pesos baixos (0,05 cada).

### Limitações Honestas

Essa abordagem tem limitações significativas que devem ser reconhecidas antes de qualquer reivindicação de novidade ou utilidade:

1. **Taxa de rejeição falsa do FST.** O FST rejeitará palavras válidas que não estão em seu léxico — empréstimos, neologismos, nomes próprios, termos code-mixed. Isso infla a taxa de erro morfológico. A taxa de rejeição falsa não foi formalmente medida em um corpus representativo de texto Cree. Sem essa medição, a precisão da métrica de validade do FST é desconhecida.

2. **Cobertura do dicionário.** A qualidade do validador semântico depende inteiramente da cobertura do dicionário Wolvengrey. Palavras em Cree que não estão no dicionário não produzem glosas, o que o validador trata como uma lacuna de significado. O dicionário contém aproximadamente 18.000–22.000 entradas (as contagens variam por edição e método de contagem) — substancial, mas não exaustivo.

3. **Completude de classe de variante.** As seis classes de variante do linter foram projetadas com base em literatura linguística e observação de padrões de saída de TA. Pode haver classes de equivalência adicionais não capturadas — variações dialetais, diferenças de registro, sinônimos no nível de discurso. Nenhum processo formal garante completude.

4. **Nenhum estudo de correlação humana.** A lacuna mais crítica: ninguém mediu se os vereditos do linter (EXACT/EQUIVALENT/MISS) ou os vereditos do validador semântico se correlacionam com julgamentos humanos de qualidade de tradução. Métricas neurais passam anos estabelecendo correlação com avaliação humana (tarefas compartilhadas do WMT). Nossas métricas não têm tal validação.

5. **Especificidade de idioma.** As classes de variante, listas de sinônimos e regras de partícula opcional são específicas para Plains Cree. Portá-las para North Sámi, Inuktitut ou qualquer outro idioma exige linguistas que entendam a morfologia, flexibilidade de ordem de palavras e variação ortográfica desse idioma. O *framework* é portável; as *regras* não são.

6. **Lacunas de wiring de métrica.** A partir desta escrita, quatro das nove métricas no perfil de pontuação composto (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) têm wiring de plugin incompleto ou pouco claro no harness da arena. A pontuação composta é efetivamente calculada a partir de aproximadamente cinco métricas com pesos redistribuídos.

### O Que Seria Necessário para Validar Essa Abordagem

Para tornar isso publicável — em qualquer venue, em qualquer nível de seriedade acadêmica — os seguintes experimentos seriam necessários:

1. **Estudo de correlação com julgamento humano.** Coletar avaliações de qualidade humana para um conjunto de traduções Inglês→Cree (idealmente 200+ pares de sentenças avaliados por 3+ falantes bilíngues). Calcular correlações entre pontuações humanas e cada uma de nossas métricas. Esse é o validação mais importante. Sem isso, as métricas são artefatos de engenharia, não ferramentas de avaliação.

2. **Medição de taxa de rejeição falsa do FST.** Executar o analisador FST em um corpus de texto Cree conhecido como bom (por exemplo, textos Cree publicados, corpora paralelos validados) e medir que percentual de palavras válidas são rejeitadas. Isso quantifica a precisão da métrica de validade do FST.

3. **Validação de segundo idioma.** Portar a métrica de validade do FST para um segundo idioma GiellaLT (mais provavelmente North Sámi, que tem o analisador FST mais maduro no ecossistema GiellaLT). Demonstrar que a métrica produz resultados sensatos em saída de TA Sámi. Isso valida a reivindicação de extensibilidade.

4. **Comparação com COMET.** Executar COMET nos mesmos dados Cree e comparar suas pontuações com nossas métricas e com julgamentos humanos. Se COMET produz pontuações significativas para Cree (que duvidamos, mas não testamos), nossas métricas precisam superá-lo para ser útil. Se COMET produz ruído (que esperamos), isso valida a necessidade de nossa abordagem.

5. **Complemento de diagnóstico MorphEval.** Construir um pequeno (50–100 contrastes) conjunto de testes estilo MorphEval para Plains Cree direcionado aos recursos morfológicos mais distintivos do idioma (obviativo, inverso, conjuntivo/independente, inclusivo/exclusivo). Executar sistemas de TA contra ele e mostrar que a informação de diagnóstico é acionável.

6. **Auditoria de wiring e integração.** Corrigir as lacunas de wiring do perfil de pontuação identificadas no inventário de código. Garantir que todas as nove métricas compostas produzam valores e que a pontuação agregada seja calculada corretamente.

---

## Parte 7: Posicionamento e Trabalho Futuro

### Onde LYSS Se Situa no Cenário de Avaliação

Uma taxonomia de abordagens de avaliação de TA, posicionada honestamente:

| Dimensão | Métricas de string (BLEU, chrF++) | Métricas neurais (COMET, MetricX) | LLM-as-judge (GEMBA) | Diagnóstico (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Tipo de sinal | Sobreposição de superfície | Similaridade semântica aprendida | Julgamento aberto | Sondas de capacidade direcionada | Validade morfológica + equivalência baseada em regras |
| Dados de treinamento necessários | Nenhum | Julgamentos humanos (milhares) | LLM pré-treinado | Conjuntos de testes projetados por linguista | FST + dicionário + regras de variante |
| Aplicabilidade LRL | Universal mas fraco | Limitado por cobertura de codificador | Limitado por cobertura de LLM | Limitado por criação de conjunto de testes | Limitado por disponibilidade de FST (~30 idiomas) |
| Referência necessária | Sim | Sim (ou QE apenas com origem) | Opcional | Sim (contrastivo) | Sim (LYSS-eq/LYSS-sem) / Não (LYSS-fst) |
| Interpretabilidade | Baixa (um número) | Baixa (um número) | Alta (rationale em texto) | Alta (pass/fail por fenômeno) | Alta (vereditos + classes de variante) |

**LYSS não é**: uma substituição para COMET em idiomas bem-recursos, uma métrica universal ou a primeira avaliação ciente de morfologia.

**LYSS é**: um framework integrado que combina validação morfológica baseada em FST com métricas padrão para o caso específico de idiomas onde métricas neurais carecem de cobertura e ferramentas baseadas em regras (FSTs, dicionários) existem. Tem três componentes principais:
- **LYSS-fst** — Validade morfológica via FST (`fst_acceptance_rate`)
- **LYSS-eq** — Equivalência linguística via linter (`equivalent_match_rate`)
- **LYSS-sem** — Validação semântica determinística (`semantic_score`)

**LYSS estende**: O insight central de MorphEval (use ferramentas morfológicas para avaliação) de testes de competência diagnóstica para pontuação de qualidade contínua.

**LYSS complementa**: chrF++ (que dá crédito parcial para morfemas compartilhados mas não pode detectar equivalência), COMET (que opera em espaço semântico mas carece de dados de treinamento para LRL) e FUSE (que usa engenharia de características mas não analisadores morfológicos).

**A arte anterior mais próxima é**: Hjerson (classificação de erro linguístico) + HyTER (classes de equivalência via redes de paráfrase) + métrica de cobertura ingênua do Apertium (verificação de validade baseada em FST). A contribuição do LYSS não é qualquer técnica única mas a integração dessas ideias — particularmente validade baseada em FST e equivalência baseada em regras — em um harness de avaliação funcional para um idioma polissintético.

### Integrando MorphEval

A metodologia de conjunto de testes contrastivos do MorphEval e nossa abordagem de pontuação contínua são complementares:

- **MorphEval** responde: "Este sistema pode lidar com marcação de tempo? Concordância de número? Atribuição de caso?"
- **Nossa métrica FST** responde: "Este sistema produziu palavras reais?"
- **Nosso linter** responde: "Esta tradução é equivalente à referência apesar de diferenças de superfície?"
- **Nosso validador semântico** responde: "Esta tradução significa a coisa certa?"

MorphEval é código aberto. Criar um conjunto de testes Plains Cree exigiria um linguista para projetar pares contrastivos cobrindo contrastes morfológicos específicos do Cree (obviação, marcação inversa, ordem conjuntivo/independente, "nós" inclusivo/exclusivo, cadeias de preverb). Isso é trabalho substancial mas limitado — semanas, não meses — e forneceria capacidade de diagnóstico que nenhuma outra ferramenta de avaliação oferece para Cree.

### A Questão de Extensibilidade

Quais outros idiomas poderiam adotar essa abordagem? A restrição primária é disponibilidade de FST. A infraestrutura GiellaLT fornece analisadores morfológicos para 30+ idiomas, principalmente em três famílias:

- **Idiomas Sámi** (North Sámi, Lule Sámi, South Sámi, Skolt Sámi, Inari Sámi): FSTs maduros com cobertura ampla. North Sámi é o alvo mais imediatamente portável.
- **Idiomas Uralic** (Finlandês, Estoniano, Komi, Erzya, Moksha): Analisadores bem desenvolvidos, embora Finlandês e Estoniano possam não precisar de avaliação baseada em FST com urgência (têm mais cobertura de métrica neural).
- **Idiomas indígenas do Ártico** (Inuktitut via Uqailaut, Groenlândês): Analisadores existem mas cobertura varia.
- **Outros idiomas GiellaLT**: Faroês, Irlandês, Cornuês, Livoniano e outros com níveis variados de maturidade de FST.

Além do GiellaLT, a plataforma **Apertium** fornece analisadores morfológicos para aproximadamente 40+ pares de idiomas. O ecossistema **HFST** (Helsinki Finite-State Technology) é a infraestrutura compartilhada que tanto GiellaLT quanto Apertium usam, significando que qualquer analisador Apertium poderia em princípio ser conectado à mesma métrica de validade FST.

A restrição prática não é disponibilidade de FST mas **curação de classe de variante**. As regras de equivalência do linter exigem expertise linguística por idioma alvo. Para North Sámi, isso exigiria entender flexibilidade de ordem de palavras Sámi, convenções ortográficas e variação dialetal. Para Inuktitut, exigiria entender morfologia polissintética em um nível comparável ao que foi feito para Cree. A métrica de validade FST, porém, pode ser implantada imediatamente para qualquer idioma com um analisador GiellaLT — nenhum trabalho linguístico adicional necessário.

### Rumo a um Artigo

Uma publicação baseada neste trabalho se encaixaria mais naturalmente em um desses venues:

- **Tarefa Compartilhada de Métricas do WMT** (co-localizada com EMNLP): O venue mais direto. Exigiria implementar as métricas como uma submissão de tarefa compartilhada e avaliar em conjuntos de testes do WMT — que atualmente não incluem nenhum idioma polissintético. Poderia submeter como um artigo de "descobertas" ou participar do subtask de conjuntos de desafio.
- **LREC-COLING** (Language Resources and Evaluation Conference): Encaixe natural para um artigo de recurso/ferramenta descrevendo o framework de avaliação e os recursos linguísticos que usa (FSTs, dicionários, regras de variante).
- **ACL ou NAACL** (conferência principal): Exigiria o estudo de correlação humana e pelo menos um idioma adicional para atender ao padrão de uma conferência principal.
- **Workshop AmericasNLP**: O público mais receptivo para avaliação de TA de idiomas indígenas. Padrão de publicação mais baixo, mas alto impacto dentro da comunidade alvo.
- **ComputEL** (Computational Approaches to Endangered Languages): Venue focado para exatamente este tipo de trabalho.

Qualquer publicação exigiria co-autores com expertise em linguística Cree (para validar as classes de variante e interpretar resultados) e idealmente falantes bilíngues Cree (para fornecer as avaliações de qualidade humana para o estudo de correlação). Isso não é opcional — um artigo sobre avaliação de TA Cree escrito inteiramente por não-falantes de Cree seria, na melhor das hipóteses, incompleto, e na pior, uma continuação da dinâmica de pesquisa extrativista que o campo está tentando deixar para trás.

---

## Apêndice A: Matriz de Requisitos de Métrica

| Métrica | Referência necessária? | Origem necessária? | Modelo treinado? | Recursos específicos do idioma? | Funciona para LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Sim | Não | Não | Não | Mal |
| chrF++ | Sim | Não | Não | Não | Melhor que BLEU |
| METEOR | Sim | Não | Não | Stemmer + WordNet | Apenas se recursos existem |
| TER | Sim | Não | Não | Não | Mesmo que BLEU |
| BERTScore | Sim | Não | Sim (mBERT) | Não | Depende de cobertura de modelo |
| BLEURT | Sim | Não | Sim (treinado) | Não | Depende de dados de treinamento |
| COMET | Sim | Sim | Sim (XLM-R) | Não | Depende de cobertura XLM-R |
| CometKiwi | Não | Sim | Sim (XLM-R) | Não | Depende de cobertura XLM-R |
| GEMBA | Opcional | Sim | Sim (LLM) | Não | Depende de cobertura LLM |
| **Aceitação FST** | **Não** | **Não** | **Não** | **Sim (analisador FST)** | **Sim, se FST existe** |
| **Linter CRK** | **Sim** | **Não** | **Não** | **Sim (FST + regras de variante)** | **Sim, se recursos existem** |
| **Semântica CRK** | **Sim** | **Opcional** | **Não** | **Sim (FST + dicionário + spaCy)** | **Sim, se recursos existem** |
| Detecção de alucinação | Não | Sim | Não | Não | Sim |
| Detecção de code-switching | Opcional | Sim | Não | Mínimo | Sim |
| MorphEval | Sim (contrastivo) | Sim | Não | Sim (conjunto de testes + analisador) | Apenas se conjunto de testes existe |

## Apêndice B: Artigos Chave

| Citação | Venue | Relevância |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | A métrica que definiu o campo |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Correspondência de n-gramas ponderada por informação |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Stemming, sinônimos, alinhamento de palavras |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Distância de edição com deslocamentos de frase |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Classificação de erro Hjerson |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Classes de equivalência via redes de paráfrase |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | Tipologia de erro MQM |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Avaliação no nível de caractere |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Avaliação de n-gramas de caractere + palavra |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Conjuntos de testes morfológicos contrastivos |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | Pares contrastivos LingEval97 |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Testes de divergência estrutural direcionada |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | Padronização sacreBLEU |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Meta-análise de correlação BLEU com julgamento humano |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | Avaliação de gênero WinoMT |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Melhor Artigo) | Testes unitários baseados em capacidade para NLP |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Similaridade semântica baseada em embedding |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Métrica pré-treinada + ajustada fino |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Avaliação trilíngue multilíngue |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | Meta-avaliação baseada em MQM |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | NMT multilíngue como pontuador de paráfrase |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Precisão de gênero contrafactual |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 fenômenos, 146 pares de idiomas |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM-as-evaluator |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Detecção de erro em span |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Métricas neurais para idiomas africanos |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | Métrica vencedora baseada em mT5 |

## Apêndice C: Glossário de Termos de Avaliação

| Termo | Definição |
|------|-----------|
| **Adequação** | Se uma tradução transmite o significado da origem. |
| **Fluência** | Se uma tradução é gramatical e natural no idioma alvo. |
| **Direct Assessment (DA)** | Método de avaliação humana onde anotadores avaliam traduções em uma escala de 0–100. |
| **MQM** | Multidimensional Quality Metrics — avaliação humana baseada em span de erro com severidades tipadas. |
| **Quality Estimation (QE)** | Prever qualidade de tradução sem uma tradução de referência. |
| **FST** | Finite-State Transducer — um dispositivo computacional que codifica as regras morfológicas de um idioma. |
| **GiellaLT** | Infraestrutura para tecnologia de linguagem baseada em regras, principalmente para idiomas Sámi e outros do Ártico. |
| **HFST** | Helsinki Finite-State Technology — o framework de software subjacente ao GiellaLT e Apertium. |
| **SRO** | Standard Roman Orthography — o sistema de escrita baseado em latim para Plains Cree. |
| **Syllabics** | Canadian Aboriginal Syllabics — um sistema de escrita abugida usado para Cree e outros idiomas Algonquianos. |
| **Polissintético** | Um tipo de idioma onde uma única palavra pode codificar o equivalente de uma sentença inteira em inglês através de afixação extensiva. |
| **Obviação** | Uma categoria gramatical em idiomas Algonquianos que distingue entre dois referentes de terceira pessoa. |
| **Inverso** | Uma categoria semelhante a voz em idiomas Algonquianos marcando que o paciente supera o agente na hierarquia de animacidade. |
| **WMT** | Conference on Machine Translation — o venue primário para tarefas compartilhadas e avaliação de TA. |
| **Avaliação contrastiva** | Testar se um sistema pode distinguir entradas minimamente diferentes que exigem saídas diferentes. |
| **Conjunto de desafio** | Um conjunto de testes elaborado direcionado a fenômenos linguísticos específicos. |
| **Classe de equivalência** | Um conjunto de formas de superfície diferentes que representam o mesmo significado e devem receber a mesma pontuação de avaliação. |

## Aonde isso leva neste site

As próprias respostas do Champollion aos problemas catalogados aqui são a
[Especificação de Pontuação](/docs/network/specifications/scoring) (qual métrica
conta, e quando), a [Confiabilidade da Métrica](/docs/network/specifications/metric-reliability)
(em qual métrica confiar por idioma de destino) e o
[Framework de Design de Corpus](/docs/network/specifications/corpus-design)
(como um conjunto de testes ganha o direito de ser considerado confiável).
