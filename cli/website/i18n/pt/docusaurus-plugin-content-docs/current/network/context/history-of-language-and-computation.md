---
sidebar_position: 1
title: "De Pāṇini aos Transformers"
---

# De Pāṇini aos Transformers: Linguagem, Computação e o Trabalho Inacabado da Tradução

**Uma História das Ideias por Trás do champollion**

---

> *"Quando olho para um artigo em russo, digo: 'Isto realmente foi escrito em inglês, mas foi codificado em alguns símbolos estranhos. Vou agora proceder a decodificar.'"*
> — Warren Weaver, 1949

---

## Introdução

O sonho de uma máquina que pudesse traduzir entre línguas humanas é mais antigo que o próprio computador. É, em certo sentido, *o* problema original da inteligência artificial—mais antigo que programas que jogam xadrez, mais antigo que sistemas especialistas, mais antigo que redes neurais. Esse desejo é frequentemente enquadrado através de parábolas europeias como a Torre de Babel, que posiciona a diversidade linguística como um castigo ou um problema a ser resolvido, contornando a realidade de que as sociedades indígenas pré-contato há muito navegam uma diversidade linguística impressionante através de sofisticadas línguas comerciais (como o Jargão Chinook) e sistemas de sinais (como a Língua de Sinais dos Índios das Planícies) sem buscar uma homogeneização universal.

Mas a história que leva a este momento—a um mundo onde grandes modelos de linguagem podem traduzir francês passável mas alucinam disparates em Cree—não é uma linha reta. É uma trança de pelo menos quatro fios distintos: o estudo formal da linguagem, a teoria matemática da computação, a revolução estatística no aprendizado de máquina, e uma história mais sombria que explica *por que* as línguas mais necessitadas de tecnologia são precisamente aquelas para as quais ela não existe. Esse quarto fio é a história da supressão linguística colonial e do genocídio cultural—a destruição deliberada e sistemática de línguas indígenas em todos os continentes onde potências europeias estabeleceram domínio. Sem compreender essa história, o problema técnico parece um acidente de escassez de dados. Não é um acidente.

Este artigo traça todos os quatro fios desde suas origens até sua convergência no presente. É, admitidamente, um tanto Whiggista—conta a história como se sempre estivesse levando aqui. A história, é claro, não sabia para onde estava indo. Mas os fios são reais, as conexões são genuínas, e compreendê-las é essencial para entender por que projetos como champollion existem, por que são construídos da forma como são, e por que importam agora.

---

## I. A Gramática de Tudo: De Pāṇini a Chomsky

### A Primeira Gramática Formal (c. século IV a.C.)

A história começa não em uma universidade europeia, mas na Índia antiga, com um estudioso chamado Pāṇini. Por volta do século IV a.C., Pāṇini compôs o *Aṣṭādhyāyī*—uma gramática do sânscrito compreendendo aproximadamente 4.000 regras. Esta não era uma gramática no sentido solto e pedagógico. Era uma gramática *gerativa*: um conjunto finito de regras capaz, em princípio, de produzir todo enunciado válido na língua.

O sistema de Pāṇini usava o que agora reconheceríamos como regras de reescrita formais, com variáveis, recursão e aplicação ordenada. O linguista Paul Kiparsky argumentou que o *Aṣṭādhyāyī* é "a gramática gerativa mais completa de qualquer língua já escrita" (Kiparsky, 1993). O cientista da computação Gerard Huet mostrou que as regras de Pāṇini podem ser modeladas como um transdutor de estados finitos—o mesmo formalismo computacional que, vinte e cinco séculos depois, se tornaria central para a análise morfológica de línguas polissintéticas.

Pāṇini não sabia que estava fazendo ciência da computação. Mas estava.

### A Pedra de Roseta e o Nascimento da Linguística Comparativa (1799)

Durante a maior parte da história registrada, o estudo da linguagem era principalmente o estudo de *uma própria* língua—ou, no máximo, o estudo de uma língua sagrada ou clássica para fins litúrgicos. A revolução intelectual que criou a linguística moderna começou com uma pedra.

A Pedra de Roseta, descoberta pelos soldados de Napoleão em 1799, trazia o mesmo decreto em três escritas: hieroglíficos egípcios, escrita demótica e grego antigo. A decifração dos hieroglíficos por Jean-François Champollion em 1822 foi mais que um triunfo arqueológico. Demonstrou um princípio que se tornaria fundamental: que as línguas podiam ser compreendidas *através uma da outra*. A tradução não era meramente uma habilidade prática; era um método de investigação científica.

### William Jones e a Hipótese Indo-Europeia (1786)

Mesmo antes de Champollion, o filólogo britânico Sir William Jones havia proferido sua famosa palestra para a Sociedade Asiática de Bengala em 1786, observando que o sânscrito tinha com o grego e o latim "uma afinidade mais forte, tanto nas raízes dos verbos quanto nas formas da gramática, do que poderia ter sido produzida por acaso." Jones propôs que todos os três descendiam de um ancestral comum "que, talvez, não exista mais."

Este foi o nascimento da linguística histórica e comparativa. Estabeleceu que as línguas não eram entidades isoladas e estáticas, mas membros de famílias—relacionadas por descendência, moldadas pelo tempo, sujeitas a leis regulares de mudança. Foi, em seu caminho, uma teoria evolutiva décadas antes de Darwin.

### As Árvores de Linguagem de August Schleicher (1861)

Foi August Schleicher, um linguista alemão, quem tornou a conexão darwiniana explícita. Em 1861—apenas dois anos após *A Origem das Espécies*—Schleicher publicou seu modelo *Stammbaum* (árvore genealógica) das línguas indo-europeias. Seus diagramas parecem quase indistinguíveis das árvores filogenéticas em biologia. As línguas, como as espécies, se ramificavam, divergiam e ocasionalmente se extinguiam.

As árvores de Schleicher eram uma simplificação (as línguas também *convergem* através do contato, empréstimo e crioulização), mas o modelo se mostrou enormemente produtivo. Estabeleceu o princípio de que a diversidade linguística não era ruído aleatório, mas dados estruturados, amenáveis à análise sistemática. E colocou, implicitamente, uma questão que permanece central para nosso projeto: o que acontece com os ramos que estão morrendo?

### Ferdinand de Saussure e a Arquitetura da Linguagem (1916)

A próxima revolução veio de Ferdinand de Saussure, cujo *Cours de linguistique générale* (publicado postumamente em 1916 a partir de notas de alunos) estabeleceu a linguística estrutural. Saussure traçou uma distinção nítida entre *langue* (o sistema abstrato de uma língua) e *parole* (a fala real). Argumentou que os signos linguísticos eram *arbitrários*—a palavra "árvore" não tem conexão inerente com árvores—e que o significado surgia de *diferenças* dentro de um sistema, não de qualquer conteúdo positivo.

O diagrama-chave de Saussure—o oval dividido entre *signifié* (significado, o conceito) e *signifiant* (significante, a imagem sonora), ligados por setas mostrando sua relação inseparável—se tornou uma das imagens mais reproduzidas nas humanidades. Estabeleceu o princípio de que uma língua é um *sistema de sistemas*, onde cada elemento deriva seu valor de suas relações com todos os outros.

Isto tinha implicações profundas para a tradução. Se o significado é relacional e sistêmico, então a tradução não é uma questão de trocar palavras. Requer compreender toda a arquitetura de uma língua. Duas línguas podem dividir o mundo de formas fundamentalmente diferentes—uma percepção que seria desenvolvida (e às vezes exagerada) por Edward Sapir e Benjamin Lee Whorf.

### Sapir, Bloomfield e o Estudo de Línguas Indígenas

Na América do Norte, o início do século XX trouxe uma tradição diferente de trabalho de campo linguístico. Edward Sapir e Leonard Bloomfield trabalharam extensivamente com línguas indígenas—Sapir com Navajo, Nootka e muitas outras; Bloomfield com Menomini e outras línguas algonquianas. Eles encontraram estruturas linguísticas radicalmente diferentes de qualquer coisa na família indo-europeia.

Sapir, em particular, desenvolveu um marco tipológico que classificava as línguas ao longo de vários eixos, incluindo a distinção crítica entre línguas *analíticas* (como o inglês, onde as palavras tendem a ser curtas e o significado é carregado pela ordem das palavras) e línguas *polissintéticas* (como Cree, onde uma única palavra pode codificar o que o inglês expressaria como uma sentença inteira). Uma única forma verbal em Cree pode incorporar o sujeito, objeto, tempo, aspecto, evidencialidade e vários elementos modificadores em uma única palavra morfologicamente complexa.

Este trabalho estabeleceu dois fatos que permanecem centrais para nosso projeto. Primeiro: as línguas do mundo são muito mais diversas estruturalmente do que qualquer modelo eurocêntrico sugeriria. Segundo: muitas dessas línguas já estavam em perigo. No entanto, enquanto os primeiros linguistas estruturais documentavam essa complexidade, frequentemente participavam de "antropologia de salvação"—um modelo acadêmico extrativista que tratava os povos indígenas meramente como "informantes" para construir carreiras acadêmicas ocidentais. Essa abordagem separou as línguas de suas raízes epistemológicas, abrindo caminho para tratar a linguagem como dados desencarnados e extraíveis, em vez de sistemas vivos e relacionais.

### A Revolução de Chomsky (1957)

Em 1957, um linguista do MIT de 28 anos chamado Noam Chomsky publicou *Syntactic Structures*, um livro fino que detonou como uma bomba no campo. Chomsky argumentou que o objetivo da linguística deveria ser descobrir a *gramática gerativa* de uma língua—um conjunto finito de regras que pudesse produzir todas e apenas as sentenças gramaticais dessa língua.

Mais provocativamente, Chomsky propôs a *hierarquia de Chomsky*: uma classificação de gramáticas formais por seu poder computacional. A hierarquia tem quatro níveis:

- **Tipo 3 (Regular)**: Reconhecido por autômatos finitos. Padrões simples.
- **Tipo 2 (Livre de Contexto)**: Reconhecido por autômatos com pilha. Estruturas recursivas como parênteses aninhados.
- **Tipo 1 (Sensível ao Contexto)**: Reconhecido por autômatos linearmente limitados. Dependências mais complexas.
- **Tipo 0 (Recursivamente Enumerável)**: Reconhecido por máquinas de Turing. Qualquer coisa computável.

Chomsky argumentou que as línguas naturais requeriam pelo menos gramáticas livres de contexto, e possivelmente mais. Esta era uma ponte direta entre linguística e a teoria matemática da computação. As mesmas ferramentas formais que Alan Turing havia desenvolvido para raciocinar sobre os limites da computação agora podiam ser aplicadas à linguagem humana.

Chomsky também propôs a ideia de *Gramática Universal*—que a capacidade para a linguagem é inata, que todas as línguas humanas compartilham propriedades estruturais profundas, e que a diversidade de formas de superfície mascara uma unidade subjacente. Isto permanece controverso (muitos tipologistas e funcionalistas discordam), mas as ferramentas formais que Chomsky introduziu—regras de estrutura de frase, gramáticas transformacionais, a hierarquia em si—se tornaram a fundação da linguística computacional.

---

## II. O Sonho da Tradução Universal

### A Máquina de Pensar de Ramon Llull (1305)

O sonho de mecanizar o pensamento—e com ele, o sonho de tradução mecânica—é notavelmente antigo. Ramon Llull, um místico catalão do século XIII, projetou a *Ars Magna*: um sistema de discos concêntricos rotativos inscritos com conceitos fundamentais, cujas combinações eram destinadas a gerar todas as verdades possíveis. As rodas de Llull eram, em certo sentido, a primeira máquina de lógica combinatória. Leibniz mais tarde citou Llull como inspiração.

### Athanasius Kircher e a Polygraphia Nova (1663)

Athanasius Kircher, o grande polímata jesuíta, publicou *Polygraphia Nova et Universalis* em 1663—um sistema de "escrita universal" destinado a permitir comunicação através de barreiras linguísticas. O sistema de Kircher atribuía números a conceitos, que poderiam então ser decodificados em qualquer língua com a tabela apropriada. Era, em essência, uma interlíngua—uma representação de significado independente de língua.

O sistema não funcionava muito bem. Mas a *ideia* persistiu: que entre quaisquer duas línguas existe um espaço conceitual comum, e que a tradução é uma questão de mapeamento através dele. Esta hipótese de interlíngua não era apenas um experimento científico falho; era uma extensão epistemológica do controle colonial, incapaz de mapear ontologias divergentes. O filósofo W.V.O. Quine mais tarde formalizaria esse fracasso com seu conceito de *indeterminação da tradução* (1960), argumentando que a tradução radical é inerentemente indeterminada. O mapeamento universal e livre de contexto entre sistemas linguísticos fundamentalmente divergentes é uma impossibilidade filosófica, não apenas um obstáculo de engenharia.

### John Wilkins e a Linguagem Filosófica (1668)

Apenas cinco anos após Kircher, o filósofo natural inglês John Wilkins publicou *An Essay towards a Real Character, and a Philosophical Language*—uma tentativa de criar uma língua cuja estrutura *espelhasse perfeitamente a estrutura da realidade*. Cada conceito seria classificado em uma grande taxonomia, e seu nome codificaria sua posição nessa taxonomia.

O projeto de Wilkins falhou (a realidade se mostrou resistente à classificação arrumada), mas antecipou algo importante: a ideia de que a linguagem poderia ser *engenheirada*, que a relação entre palavras e significados poderia ser tornada sistemática e explícita. Isto é, em um sentido profundo, o que linguistas computacionais fazem quando constroem ontologias e grafos de conhecimento.

### Leibniz e a Characteristica Universalis

Gottfried Wilhelm Leibniz, que independentemente inventou cálculo e projetou uma calculadora mecânica, sonhava com uma *characteristica universalis*—uma linguagem formal universal em que todo o conhecimento humano pudesse ser expresso—e um *calculus ratiocinator*—uma máquina que pudesse raciocinar nessa linguagem. "Se controvérsias surgissem," Leibniz escreveu, "não haveria mais necessidade de disputa entre dois filósofos do que entre dois contadores. Pois bastaria que pegassem seus lápis nas mãos, se sentassem em suas lousas, e dissessem um ao outro: Vamos calcular."

Leibniz também inventou aritmética binária—o sistema numérico que, séculos depois, se tornaria a linguagem dos computadores digitais. Seu artigo de 1703 *Explication de l'Arithmétique Binaire* mostrou que qualquer número poderia ser representado usando apenas 0 e 1. Ele viu isto como um reflexo da criação divina (algo do nada), mas se provaria ser a fundação de toda computação digital.

### O Memorando de Warren Weaver (1949)

A era moderna da tradução automática começa com um memorando. Em julho de 1949, o matemático e administrador científico americano Warren Weaver escreveu para Norbert Wiener, propondo que os novos computadores eletrônicos pudessem ser aplicados ao problema da tradução. Seu memorando continha a passagem notável citada na abertura deste artigo: a ideia de que um texto russo é "realmente escrito em inglês, mas... codificado em alguns símbolos estranhos."

A metáfora de Weaver foi extraída da criptoanálise de tempos de guerra—a ideia de que a tradução era fundamentalmente um problema de *decodificação*. Isto não era meramente uma analogia. As mesmas ferramentas estatísticas e teórico-informacionais que haviam sido desenvolvidas para quebrar cifras inimigas poderiam, Weaver sugeriu, ser aplicáveis ao problema da tradução.

O memorando era extremamente otimista, mas lançou um programa de pesquisa. Dentro de cinco anos, a primeira demonstração de tradução automática ocorreria.

---

## III. A Maquinaria do Pensamento: Computação e Informação

### George Boole e a Álgebra da Lógica (1854)

Em 1854, George Boole publicou *An Investigation of the Laws of Thought*—uma obra que reduzia o raciocínio lógico a operações algébricas. Boole mostrou que as proposições da lógica podiam ser manipuladas usando as mesmas regras da álgebra, com AND correspondendo a multiplicação, OR a adição, e NOT a complemento.

A álgebra booleana parecia uma curiosidade matemática na época. Se tornaria o princípio operacional de cada circuito digital já construído.

### Charles Babbage e Ada Lovelace (1837–1843)

Charles Babbage projetou (mas nunca completou) a Analytical Engine—um computador mecânico, movido a vapor, de propósito geral. Diferentemente de seu anterior Difference Engine (uma calculadora especializada), a Analytical Engine tinha uma memória ("the Store"), uma unidade de processamento ("the Mill"), ramificação condicional e looping. Era, em princípio, Turing-completa.

Ada Lovelace, trabalhando a partir de uma descrição da Engine, escreveu um conjunto de notas detalhadas que incluía o que é amplamente considerado o primeiro programa de computador publicado: um algoritmo para computar números de Bernoulli (Nota G, 1843). Mas a contribuição mais profunda de Lovelace foi conceitual. Ela viu que a Engine poderia manipular *símbolos*, não apenas números. "A Analytical Engine tece padrões algébricos," ela escreveu, "assim como o tear de Jacquard tece flores e folhas." A implicação—que a computação poderia ser aplicada a qualquer domínio com uma estrutura formal, incluindo linguagem—era presciente.

### Alan Turing e a Máquina Universal (1936)

Em 1936, Alan Turing publicou "On Computable Numbers, with an Application to the Entscheidungsproblem"—um artigo que simultaneamente definiu computação, provou seus limites e inventou o computador moderno (em forma abstrata).

A percepção-chave de Turing era a *máquina universal*: uma única máquina que, dadas as instruções corretas codificadas em sua fita, poderia simular *qualquer outra* máquina. Isto estabeleceu que não havia diferença essencial entre hardware e software, entre a máquina e o programa. Um único dispositivo, adequadamente programado, poderia computar qualquer coisa que fosse computável.

O trabalho de Turing também estabeleceu os limites da computação (o problema da parada) e lançou as bases para sua exploração posterior da inteligência de máquina. Seu artigo de 1950 "Computing Machinery and Intelligence," que propôs o famoso Teste de Turing, enquadrou a questão da inteligência de máquina explicitamente em termos de *linguagem*: uma máquina é inteligente se, através de conversação, não pode ser distinguida de um humano.

### Claude Shannon e a Teoria da Informação (1948)

Em 1948, Claude Shannon publicou "A Mathematical Theory of Communication" no *Bell System Technical Journal*—um artigo que fundou o campo da teoria da informação. Shannon mostrou que a comunicação poderia ser modelada como um sistema: uma *fonte de informação* gera uma *mensagem*, que um *transmissor* codifica em um *sinal*, que passa através de um *canal* (sujeito a *ruído*), que um *receptor* decodifica de volta em uma mensagem para um *destino*.

A contribuição-chave de Shannon era o conceito de *entropia*—uma medida da incerteza ou conteúdo de informação de uma mensagem. Ele provou que para qualquer canal com um dado nível de ruído, existe uma taxa máxima na qual a informação pode ser transmitida confiável (a capacidade do canal), e que essa taxa pode ser alcançada com codificação suficientemente inteligente.

A conexão com a tradução é profunda. O próprio Shannon, em um artigo de 1951, usou a teoria da informação para analisar a estrutura estatística do inglês. Ele mostrou que o texto em inglês é altamente redundante—que um falante nativo, dada uma sequência de letras, pode prever a próxima letra com alta precisão. Essa redundância é o que torna a comunicação robusta contra ruído, mas também significa que o *conteúdo de informação* da linguagem é muito menor do que a contagem bruta de símbolos sugeriria.

Warren Weaver imediatamente viu a conexão: se a tradução é decodificação, e se a estrutura estatística da linguagem pode ser modelada, então a tradução é um problema teórico-informacional. Esta percepção levaria décadas para dar frutos, mas quando o fez, transformou o campo.

### Von Neumann e o Computador de Programa Armazenado (1945)

O relatório de 1945 de John von Neumann sobre o EDVAC (Electronic Discrete Variable Automatic Computer) descrevia o que agora chamamos de *arquitetura de von Neumann*: um computador com um único armazenamento de memória para dados e instruções, uma unidade central de processamento e mecanismos de entrada/saída. Esta arquitetura—dados e programas compartilhando a mesma memória, processados sequencialmente por uma CPU—permanece o design fundamental de quase todo computador em uso hoje.

A arquitetura de von Neumann tornou o software prático. Os programas podiam ser armazenados, modificados e até gerados por outros programas. Esta era a precondição tecnológica para tudo que se seguiu: compiladores, sistemas operacionais e eventualmente os frameworks de redes neurais que alimentam a tradução automática neural moderna.

---

## IV. Tradução Automática: O Primeiro Problema de IA

### O Experimento Georgetown-IBM e a Guerra Fria (1954)

Em 7 de janeiro de 1954, pesquisadores da Universidade de Georgetown e IBM demonstraram o primeiro sistema público de tradução automática. O sistema traduzia 60 sentenças russas para o inglês usando um vocabulário de 250 palavras e seis regras de gramática. As sentenças foram cuidadosamente selecionadas para estar dentro das capacidades do sistema, mas a demonstração gerou enorme entusiasmo.

O *New York Times* reportou que o experimento prenunciava um futuro onde "um tradutor eletrônico de botão" tornaria toda a literatura científica do mundo instantaneamente acessível. No entanto, este otimismo público mascarava a realidade material do financiamento e propósito do projeto. O experimento Georgetown-IBM—e o campo de tradução automática inicial em geral—não era impulsionado por um desejo utópico de comunicação universal. Era financiado pelo aparato militar e de inteligência dos Estados Unidos (incluindo a CIA e DARPA) como um imperativo urgente da Guerra Fria para vigiar e interceptar textos científicos e militares soviéticos.

A visão da linguagem como um "código a ser quebrado" (como Weaver colocou) era intrinsecamente ligada à vigilância militarizada. Os pesquisadores predisseram que a tradução automática seria um problema resolvido dentro de cinco anos. Eles estavam errados por mais de meio século.

### O Relatório ALPAC e o Primeiro Inverno de IA (1966)

Em 1966, o Automatic Language Processing Advisory Committee (ALPAC), convocado pelo governo dos EUA, emitiu um relatório devastador. Após revisar uma década de pesquisa em TA, ALPAC concluiu que a tradução automática era mais lenta, menos precisa e mais cara que a tradução humana, e recomendou que o financiamento fosse redirecionado para pesquisa básica em linguística computacional.

O relatório ALPAC efetivamente matou o financiamento de pesquisa em TA nos Estados Unidos por mais de uma década. Foi o primeiro "inverno de IA"—um padrão que se repetiria: promessas extravagantes, resultados modestos, desilusão, colapso de financiamento.

Mas o relatório também continha uma percepção mais profunda. A tradução automática havia falhado, em parte, porque a linguagem era mais difícil do que qualquer um havia esperado. A abordagem baseada em regras—escrever regras de gramática explícitas para analisar e gerar sentenças—funcionava para casos simples, mas quebrava catastroficamente em texto real. A linguagem era muito ambígua, muito dependente de contexto, muito *viva* para que regras rígidas a capturassem.

### TA Baseada em Regras e Transferência (1970s–1980s)

A pesquisa continuou, mais silenciosamente, através dos anos 1970 e 1980. Sistemas como SYSTRAN (que alimentava os primeiros serviços de tradução da Comissão Europeia) usavam dicionários grandes feitos à mão e regras de transferência para mapear entre pares de línguas. Esses sistemas podiam produzir traduções aproximadas úteis para domínios restritos, mas requeriam enorme esforço de engenharia para cada par de línguas, e raramente lidavam graciosamente com texto irrestrito.

O problema fundamental era claro: a linguagem não é uma cifra. Você não pode traduzir procurando palavras em um dicionário e reorganizando-as de acordo com regras gramaticais, porque o significado depende do contexto, do conhecimento do mundo, da intenção do falante, de toda a história de uma conversa. A abordagem de interlíngua—traduzir através de uma representação abstrata e independente de língua—era teoricamente elegante, mas praticamente impossível. Ninguém conseguia definir a interlíngua.

### A Revolução Estatística (1990s)

O avanço veio não de melhores regras, mas de melhores dados. No final dos anos 1980 e início dos anos 1990, pesquisadores na IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra e Robert Mercer) desenvolveram uma série de modelos estatísticos para tradução automática—os famosos Modelos IBM 1 a 5.

A percepção-chave era a velha ideia de Weaver, finalmente tornada rigorosa: tradução como decodificação. Dada uma sentença estrangeira *f*, encontre a sentença em inglês *e* que maximize P(e|f). Pelo teorema de Bayes, isto é equivalente a maximizar P(f|e) × P(e)—um *modelo de tradução* (quão provável é esta sentença estrangeira dada esta em inglês?) vezes um *modelo de linguagem* (quão provável é esta sentença em inglês por si só?).

Os modelos IBM aprendiam essas probabilidades de grandes *corpora paralelos*—coleções de textos que existiam em ambas as línguas (como os Hansards parlamentares canadenses, que eram publicados em inglês e francês). Nenhuma regra feita à mão era necessária. O sistema aprendia a traduzir observando milhões de exemplos de tradução humana.

A TA estatística funcionava dramaticamente melhor que a TA baseada em regras para línguas com dados paralelos abundantes. Também introduziu um pedaço crítico de infraestrutura: a **pontuação BLEU** (Papineni et al., 2002), uma métrica para avaliar automaticamente a qualidade da tradução comparando a saída da máquina com traduções de referência humana. BLEU tornou possível medir o progresso quantitativamente e executar experimentos em larga escala.

Mas a TA estatística tinha uma suposição fatal embutida: ela requerida *corpora paralelos*. Para os principais pares de línguas do mundo—inglês-francês, inglês-chinês, inglês-espanhol—dados paralelos eram abundantes. Para a vasta maioria das 7.000 línguas do mundo, simplesmente não existiam.

### A Revolução Neural: Seq2Seq, Atenção, Transformers (2014–2017)

A próxima transformação veio com aprendizado profundo. Em 2014, Ilya Sutskever, Oriol Vinyals e Quoc Le demonstraram modelos *sequence-to-sequence* (seq2seq) para TA: redes neurais que podiam ler uma sentença inteira em uma língua e gerar uma tradução em outra, sem qualquer alinhamento explícito ou tabelas de frases.

Em 2015, Dzmitry Bahdanau, Kyunghyun Cho e Yoshua Bengio introduziram o *mecanismo de atenção*—permitindo ao decodificador "olhar para trás" para diferentes partes da sentença de origem enquanto gerava cada palavra da tradução. Isto melhorou dramaticamente o desempenho em sentenças longas.

E em 2017, Vaswani et al. no Google publicaram "Attention Is All You Need," introduzindo a arquitetura *Transformer*. O Transformer dispensou a recorrência inteiramente, processando sequências inteiras em paralelo usando auto-atenção. Era mais rápido de treinar, mais fácil de escalar e produzia traduções melhores que qualquer coisa que havia vindo antes.

Os Transformers levaram diretamente aos grandes modelos de linguagem (LLMs) dos anos 2020: GPT, BERT, PaLM, LLaMA e seus descendentes. Esses modelos, treinados em vastas quantidades de texto da internet, podem traduzir entre centenas de pares de línguas com fluidez notável.

Mas "fluidez notável" não é o mesmo que "precisão confiável." E para as línguas de baixo recurso do mundo, a situação é muito pior do que parece.

---

## V. A Outra História: Linguagem, Poder e Genocídio Cultural

As quatro seções anteriores contam a história das ideias—de gramáticos, matemáticos e engenheiros construindo em direção à tradução automática. Mas há outra história, correndo em paralelo, que explica *por que* as línguas mais necessitadas de tecnologia de tradução são precisamente aquelas para as quais ela não existe. Esta não é uma história sobre escassez de dados como um fato neutro. É uma história sobre destruição deliberada.

A razão pela qual Plains Cree não tem suporte de tradução automática não é principalmente porque Cree é uma língua difícil para computadores (embora seja). É porque, por mais de um século, os governos do Canadá e dos Estados Unidos executaram programas sistemáticos para erradicar línguas indígenas das bocas das crianças. A "escassez de dados" que torna a TA de baixo recurso tão difícil é, em grande parte, a *consequência a jusante do genocídio cultural*. Qualquer conta honesta de por que essas línguas precisam de tecnologia deve lidar com por que foram levadas à beira da extinção em primeiro lugar.

### Antes do Contato: Um Continente de Línguas

A diversidade linguística das Américas pré-contato era impressionante. No momento do contato europeu, apenas a América do Norte era lar de um estimado 300 a 600 línguas distintas, organizadas em dezenas de famílias linguísticas não relacionadas—mais diversidade genética que em toda a Europa. A América do Sul pode ter tido 1.500 ou mais (Campbell, 1997). A Austrália tinha mais de 250 línguas. As Ilhas do Pacífico, a África subsaariana e o continente do Sudeste Asiático eram similarmente diversas.

Estas não eram línguas "primitivas" ou "simples." Muitas das línguas estruturalmente mais complexas já documentadas são indígenas. A morfologia polissintética das línguas algonquianas (incluindo Cree, Ojibwe e Blackfoot), os sistemas tonais do Navajo, a marcação de evidencialidade elaborada do Quechua, as consoantes clicadas das línguas Khoisan—estas representam a gama completa do que a linguagem humana pode ser. Elas codificam sistemas sofisticados de conhecimento sobre parentesco, ecologia, lei, espiritualidade e história. Cada língua é uma biblioteca—um registro irreplacível da forma de uma comunidade de compreender e organizar o mundo.

Edward Sapir reconheceu isto claramente. Escrevendo em 1921, ele observou que "quando se trata de forma linguística, Platão caminha com o porqueiro macedônico, Confúcio com o selvagem caçador de cabeças de Assam." As línguas dos povos indígenas não eram menores. Eram diferentes—e suas diferenças continham conhecimento que nenhuma outra língua possuía.

### A Mecânica da Morte de Línguas

As línguas não morrem de causas naturais. Elas morrem quando as condições para sua transmissão são interrompidas—quando as crianças param de aprendê-las, quando os falantes são punidos por usá-las, quando os incentivos sociais e econômicos mudam de forma que falar a língua dominante se torna uma condição de sobrevivência.

Esta interrupção pode acontecer gradualmente, através de pressão econômica e demográfica. Mas em todo o mundo colonial, era esmagadoramente *deliberada*. A supressão de línguas indígenas não era um efeito colateral da colonização. Era um objetivo de política declarado.

### Canadá: O Sistema de Escolas Residenciais (1831–1996)

No Canadá, o sistema de Escolas Residenciais Indígenas operou por mais de 160 anos, com o objetivo explícito de eliminar línguas e culturas indígenas. Um estimado 150.000 crianças das Primeiras Nações, Métis e Inuit foram removidas de suas famílias e comunidades e colocadas em escolas de internato financiadas pelo governo e operadas por igrejas.

A política central foi articulada com clareza arrepiante por Duncan Campbell Scott, o Vice-Superintendente Geral de Assuntos Indígenas, em 1920: "Quero me livrar do problema indígena... Nosso objetivo é continuar até que não haja um único indígena no Canadá que não tenha sido absorvido pelo corpo político e não haja questão indígena e nenhum Departamento Indígena."

O mecanismo era a linguagem. As crianças eram proibidas de falar suas línguas maternas. As punições por falar uma língua indígena variavam de surras a confinamento solitário a ter agulhas empurradas através de suas línguas. As crianças chegavam falando Cree, Ojibwe, Inuktitut, Dene, Haida ou qualquer uma de dezenas de outras línguas. Eram punidas até pararem.

A Comissão de Verdade e Reconciliação do Canadá (2015) documentou a natureza sistemática deste assalto. Seu relatório final concluiu que o sistema de escolas residenciais constituía *genocídio cultural*—a destruição das estruturas e práticas que permitem a um grupo continuar como um grupo. A linguagem era o alvo principal. Sem linguagem, a cerimônia é interrompida, a história oral é quebrada, os sistemas de parentesco se tornam ininteligíveis, e a transmissão intergeracional de conhecimento cessa.

A última escola residencial operada federalmente no Canadá fechou em 1996. Muitos dos Anciãos que são os últimos falantes fluentes de suas línguas hoje são sobreviventes de escolas residenciais. Sua fluência não é meramente um recurso linguístico. É um ato de resistência.

### Os Estados Unidos: Escolas de Internato Indígenas (1860s–1960s)

Os Estados Unidos operavam um sistema paralelo. O Capitão Richard Henry Pratt, fundador da Carlisle Indian Industrial School em 1879, cunhou a frase que definiu a era: "Mate o indígena, salve o homem." Mais de 350 escolas de internato financiadas pelo governo operaram nos Estados Unidos, com políticas quase idênticas às do Canadá. As crianças indígenas eram proibidas de falar suas línguas, forçadas a adotar nomes em inglês e sujeitas a apagamento cultural sistemático.

Um relatório de 2022 do Departamento do Interior dos EUA identificou mais de 400 escolas de internato indígenas federais em 37 estados, documentando as mortes de pelo menos 500 crianças no sistema—um número que o relatório reconheceu era quase certamente uma subestimação significativa. A investigação descobriu que o sistema foi projetado não apenas para educar, mas para "assimilação cultural de crianças indígenas através da realocação forçada de suas famílias e comunidades."

As consequências linguísticas foram catastróficas. Das aproximadamente 300 línguas indígenas faladas no território que se tornou os Estados Unidos, mais da metade agora estão extintas. Das que sobrevivem, a maioria tem menos de 1.000 falantes fluentes, e muitas têm menos de 10. O Endangered Languages Project classifica a maioria das línguas nativas americanas sobreviventes como "severamente" ou "criticamente" ameaçadas.

### Austrália: As Gerações Roubadas (1910–1970)

Na Austrália, políticas governamentais entre 1910 e 1970 removeram forçadamente crianças aborígenes e das Ilhas do Estreito de Torres de suas famílias. Essas crianças—conhecidas como as Gerações Roubadas—foram colocadas em missões, reservas e famílias brancas adotivas. O objetivo explícito era assimilação: eliminar a identidade aborígene dentro de algumas gerações.

As línguas aborígenes foram suprimidas em missões e instituições governamentais. As crianças que falavam suas línguas eram punidas. O relatório Bringing Them Home (1997), produzido pela Comissão Australiana de Direitos Humanos, documentou a natureza sistemática dessas remoções e seus efeitos devastadores na linguagem, cultura e família.

Das estimadas 250 línguas aborígenes australianas faladas no momento do contato europeu, menos de 20 estão sendo transmitidas para crianças hoje (Marmion et al., 2014). Mais de 100 estão completamente extintas. As línguas restantes sobrevivem em grande parte através dos esforços de falantes idosos trabalhando com linguistas e organizações comunitárias em uma corrida contra o tempo.

### Escandinávia: As Línguas Sámi

A supressão de línguas indígenas não se limitava a estados coloniais de assentamento no hemisfério sul. Na Noruega, Suécia e Finlândia, crianças Sámi foram sujeitas a sistemas de escolas de internato (*internatskoler*) de meados do século XIX até os anos 1960. As línguas Sámi foram banidas nas escolas; as crianças eram punidas por falar. A política de "Norwegianização" (*fornorskingspolitikk*) da Noruega explicitamente visava eliminar a língua Sámi e substituí-la pelo norueguês.

Das nove línguas Sámi sobreviventes, várias têm menos de 500 falantes. Ume Sámi tem aproximadamente 20. Pite Sámi tem menos de 30. As línguas sobrevivem em parte por causa de programas de revitalização que começaram nos anos 1970, incluindo o estabelecimento de escolas de língua Sámi e mídia—programas que chegaram bem a tempo para alguns dialetos e muito tarde para outros.

### Aotearoa Nova Zelândia: Te Reo Māori

A língua Māori (te reo Māori) era a língua majoritária de Aotearoa até meados do século XX. As políticas de educação colonial britânica, começando nos anos 1860, progressivamente marginalizaram te reo nas escolas. Pelos anos 1970, menos de 20% dos Māori eram falantes fluentes, e a língua estava em risco de extinção dentro de uma geração.

A resposta Māori foi um dos primeiros e mais bem-sucedidos movimentos de revitalização de língua do mundo. Kōhanga reo (ninhos de linguagem) para crianças em idade pré-escolar, estabelecidos em 1982, imergiam bebês e crianças pequenas em te reo desde o nascimento. Kura kaupapa Māori (escolas de médio Māori) seguiram. Esses programas, juntamente com a Lei da Língua Māori de 1987 (que tornou te reo uma língua oficial), estabilizaram a língua—embora falantes fluentes ainda constituam uma minoria da população Māori.

A Nova Zelândia também produziu um dos marcos mais importantes para governança de dados indígenas: *Te Mana Raraunga*, a Rede de Soberania de Dados Māori. Este marco afirma que dados Māori—incluindo dados linguísticos—é um taonga (tesouro) sujeito aos direitos e responsabilidades de kaitiakitanga (guardiania). Informou diretamente o desenvolvimento dos princípios CARE para governança de dados indígenas e é uma referência fundacional para os mecanismos de soberania de dados em champollion.

### O Padrão: Linguagem como Alvo do Poder Colonial

Os detalhes geográficos e culturais diferem, mas o padrão é notavelmente consistente. Em todo o Canadá, Estados Unidos, Austrália, Escandinávia e Nova Zelândia—e em muitos outros lugares, de Taiwan a Sibéria aos Andes—estados coloniais e pós-coloniais identificaram línguas indígenas como obstáculos à assimilação e as visaram para eliminação. As ferramentas eram similares em todos os lugares: remover crianças de suas famílias, proibir o uso de línguas indígenas, punir transgressões e recompensar a adoção da língua colonial.

Isto não foi uma nota de rodapé histórica. A última escola residencial no Canadá fechou em *1996*. A última escola de internato indígena nos Estados Unidos fechou nos *anos 1960*. Muitas das pessoas que sobreviveram a esses sistemas ainda estão vivas. O trauma é intergeracional. E o dano linguístico é contínuo: línguas que perderam uma geração de falantes na era das escolas residenciais agora estão perdendo seus últimos Anciãos fluentes.

### De Genocídio Cultural para "Escassez de Dados"

Esta história é diretamente relevante para o problema técnico da tradução automática. Quando cientistas da computação descrevem uma língua como "de baixo recurso," eles tipicamente significam: há poucos textos digitais, poucos corpora paralelos, poucos dicionários e poucos conjuntos de dados anotados. O enquadramento é neutro, como se a escassez de dados fosse um ato da natureza, como um deserto com pouca chuva.

Não é. A "escassez de dados" das línguas indígenas é a *consequência a jusante* das políticas de supressão linguística. As línguas que foram proibidas nas escolas produziram menos textos escritos. As línguas cujos falantes foram punidos por falar desenvolveram menos usos institucionais. As línguas que perderam uma geração de transmissão produziram menos falantes bilíngues que pudessem criar corpora paralelos.

O pipeline de genocídio cultural para escassez de dados é direto:

1. **Supressão** → Crianças punidas por falar a língua
2. **Transmissão interrompida** → Menos crianças aprendem a língua
3. **Base de falantes reduzida** → Menos adultos a usam na vida diária
4. **Uso institucional reduzido** → Menos documentos escritos, menos textos digitais
5. **Escassez de dados** → Modelos de ML não têm nada para treinar
6. **Sem suporte de TA** → A língua é invisível para a tecnologia
7. **Declínio acelerado** → A tecnologia reforça a marginalização que a política começou

Este pipeline significa que qualquer projeto de tecnologia trabalhando com línguas indígenas herda um contexto político e moral, quer o reconheça ou não. Um sistema de tradução automática que trata dados de língua Cree como material bruto a ser ingerido por modelos é, por mais inadvertidamente, continuando a dinâmica extrativista que começou com escolas residenciais. Os dados foram tornados escassos pela violência. Os falantes que criaram os dados que existem o fizeram contra probabilidades enormes. Qualquer sistema que use esses dados sem o controle significativo da comunidade está agravando o dano original.

### A Cumplicidade das Ciências e da Ideologia Ocidental

É crítico reconhecer que a ciência e a tecnologia não foram espectadores inocentes para este projeto colonial; foram participantes ativos. A ideologia do "Iluminismo" que buscava categorizar, quantificar e padronizar o mundo frequentemente tratava povos indígenas e suas línguas meramente como sujeitos de pesquisa ou curiosidades para uma "antropologia de salvação." Esta prática extrativista trancou conhecimento em universidades ocidentais enquanto fazia pouco para parar a maquinaria política destruindo essas comunidades.

Este projeto está em contraste marcante com metodologias como o estudo de sífilis de Tuskegee ou antropologia linguística extrativista, que tratam pessoas BIPOC como sujeitos experimentais ou provedores passivos de dados brutos. Não estamos aqui para experimentar em povos indígenas, extrair seu conhecimento ou forçar uma ideologia ocidental culturalmente monolítica sobre eles. Nosso objetivo é facilitar suas *próprias* formas de conhecimento e seus *próprios* padrões de valor. Fornecemos a infraestrutura; as comunidades linguísticas constroem os conjuntos de teste, definem as métricas e mantêm o envolvimento. Sem seu envolvimento, nada disto funciona.

### Por Que Esta História Molda Nosso Design

É por isto que o modelo de governança do champollion não é um recurso—é a fundação. Cada decisão de design importante no projeto é uma *resposta direta* à história descrita acima. O objetivo é soberania de dados: apoiar comunidades na sustentação, revitalização e governança de suas línguas vivas inteiramente em seus próprios termos.

**Por que os dados de teste são criptografados e mantidos por trusts comunitários.** Porque dados linguísticos indígenas foram extraídos, publicados e explorados sem consentimento por mais de um século. A linguística missionária, como os esforços do Summer Institute of Linguistics (SIL), historicamente monopolizou corpora paralelos indígenas sob um marco extrativista e assimilacionista. Além disso, diferentemente de muitos projetos modernos de PNL que dependem fortemente de Bíblias traduzidas como seu corpus paralelo primário para línguas de baixo recurso, explicitamente não usamos Bíblias traduzidas como corpus. O conjunto de teste criptografado, com chaves mantidas apenas pela organização de governança da comunidade, é um mecanismo técnico que torna *arquiteturalmente impossível* repetir padrões extrativistas.

**Por que usamos execução em sandbox em vez de conjuntos de teste abertos.** Porque uma vez que dados linguísticos são publicados abertamente, a comunidade perde o controle sobre eles permanentemente. Os benchmarks de ML convencionais publicam seus conjuntos de teste—qualquer um pode baixá-los, treinar neles ou usá-los para qualquer propósito. Esta raspagem de dados de IA moderna representa uma nova forma de "colonialismo de dados" e "encerramento digital." Para comunidades cujas línguas foram quase erradicadas pela força, perder o controle sobre seus recursos linguísticos restantes não é um inconveniente menor. É uma continuação direta da desapropriação territorial histórica. A execução em sandbox garante que os dados da comunidade nunca saiam de sua infraestrutura.

**Por que a propriedade do método é transferida para a comunidade.** Porque a história de "ajudar" comunidades indígenas é, esmagadoramente, uma história de pessoas de fora construindo coisas *sobre* povos indígenas em vez de *para* ou *com* eles. Artigos acadêmicos são publicados, bolsas são coletadas, carreiras são avançadas—e a comunidade fica sem nada. O mecanismo de transferência de propriedade garante que quando um engenheiro de ML constrói um método de tradução funcionando para Plains Cree, a comunidade Plains Cree *possui esse método*. O engenheiro mantém crédito e atribuição. A comunidade mantém o ativo.

**Por que qualquer coisa que um método de propriedade comunitária ganha pertence inteiramente à comunidade.** Porque a revitalização de língua é cara, e as comunidades fazendo o trabalho mais difícil—os Anciãos ensinando, os pais enviando crianças para escolas de imersão, os ativistas executando ninhos de linguagem—são cronicamente subfinanciados. Além disso, a própria infraestrutura de IA que usamos (por exemplo, centros de dados, mineração de minerais, uso de água) exerce um custo material desproporcional em terras indígenas globalmente. Champollion é um projeto não comercial e não tem reivindicação sobre qualquer um deles: se um método de tradução Cree alguma vez gera valor, esse valor deve financiar programas de língua Cree. A tecnologia deve ser uma ferramenta que serve comunidades, não um mecanismo que extrai valor delas.

**Por que dizemos "aspirante à soberania" em vez de reivindicar conformidade.** Os marcos indígenas de soberania de dados foram desenvolvidos por povos específicos para contextos específicos — os princípios de soberania de dados das First Nations no Canadá, CARE (Collective Benefit, Authority to Control, Responsibility, Ethics), Te Mana Raraunga (Māori Data Sovereignty) e os princípios FAIR abordam essas preocupações a partir de diferentes posições culturais e legais. Não afirmamos implementar nenhum deles em sua totalidade; essa determinação pertence às comunidades que os articularam. Dizemos que nosso design é *aspirante à soberania* — construído para que as comunidades *possam* exercer propriedade, controle, acesso e posse de seus dados e das tecnologias derivadas deles. A arquitetura busca a soberania; se ela alcança a soberania, cabe às comunidades decidir. Tratamos isso como um trabalho inacabado, acolhemos objeções e agiremos sobre elas.

**Por que a plataforma faz benchmark de *métodos*, não *modelos*.** Porque comunidades de língua indígena não devem ser dependentes de qualquer modelo de uma única corporação. A arquitetura aberta de um "método" significa que a solução nem precisa ser um LLM custoso e pesado em materiais. Poderia ser um sistema altamente eficiente baseado em regras, hospedado pela comunidade, rodando em hardware de computação tradicional. Se o melhor método de tradução para Cree usa Gemini do Google hoje, a comunidade deveria ser capaz de mudar para uma alternativa de código aberto ou determinística amanhã sem reconstruir tudo. O benchmark em nível de método garante que o ativo da comunidade é uma *receita*, não uma dependência.

**Por que a comunidade deve construir esta infraestrutura agora.** O paradoxo de alavancar IA enquanto critica sua extração material é resolvido por uma realidade estratégica dura: se este problema não for resolvido pela comunidade em seus próprios termos soberanos, será inevitavelmente "resolvido" por outros em termos extrativistas. Mesmo que uma corporação massiva eventualmente construa um modelo de tradução para uma dada língua indígena, a comunidade requer sua própria infraestrutura de benchmark independente e em sandbox para verificar *quando* e *se* eles realmente tiveram sucesso de acordo com padrões comunitários—e para garantir que a comunidade capture o valor desse sucesso.

Isto não é política aparafusada na tecnologia. É tecnologia projetada por pessoas que entendem a história.

---

## VI. O Momento Atual: 6.800 Línguas Deixadas para Trás

### A Escala do Problema

Dos cerca de 7.000 idiomas vivos falados na Terra hoje, apenas cerca de 550 possuem tradução automática de algum tipo — e pouco mais de 200 são atendidos por um serviço comercial implantado ([como contamos](/docs/network/context/coverage-counting)). O restante é invisível para a tecnologia — não por serem menos dignos, mas porque as abordagens estatísticas e neurais que dominam a tradução automática moderna são fundamentalmente *ávidas por dados*. Elas exigem milhões de frases paralelas para aprender. Para a maioria dos idiomas do mundo, essas frases não existem.

As línguas mais afetadas são precisamente aquelas mais ameaçadas: línguas indígenas, línguas minoritárias, tradições orais com registros escritos limitados. São línguas cujos falantes são frequentemente idosos, cujas comunidades são pequenas, cujo poder político é mínimo. São as línguas que mais precisam de suporte tecnológico para preservação e revitalização—e são as línguas para as quais a tecnologia existente é menos útil.

### O Desafio Polissintético

O problema não é meramente um de escassez de dados. Muitas das línguas mais ameaçadas do mundo são *polissintéticas*—elas têm sistemas morfológicos de complexidade extraordinária que fundamentalmente quebram as suposições do PNL padrão.

Considere Plains Cree (nêhiyawêwin), uma língua algonquiana falada nas pradarias canadenses. Um único verbo Cree pode codificar informação que o inglês espalharia através de uma cláusula inteira: o sujeito, o objeto, o tempo, o aspecto, a evidencialidade, a modalidade e várias outras categorias gramaticais, tudo empacotado em uma única palavra através de um sistema de prefixos, sufixos e modificações internas.

Isto cria vários problemas para abordagens de TA padrão:

1. **Falha de tokenização.** Tokenizadores de subpalavra como BPE (Byte Pair Encoding), projetados para línguas analíticas como o inglês, destroem palavras polissintéticas em fragmentos sem sentido. A estrutura morfológica é destruída antes do modelo sequer vê-la. BPE não é neutro; representa uma epistemologia puramente empiricista e de nível de superfície que fundamentalmente entra em conflito com as hierarquias morfológicas profundas e baseadas em regras inerentes às línguas polissintéticas. É um viés arquitetural que ativamente desmancha morfologia estrutural.

2. **Explosão combinatória.** Uma língua polissintética pode ter milhões de formas de palavras possíveis para uma única raiz verbal. Nenhum corpus de treinamento, por maior que seja, pode conter mais que uma fração minúscula delas. Modelos neurais não têm forma de *generalizar* para formas não vistas.

3. **Alucinação.** Grandes modelos de linguagem, quando pedidos para traduzir para línguas polissintéticas, frequentemente geram formas morfologicamente inválidas—palavras que nenhum falante nativo jamais produziria. O modelo aprendeu padrões estatísticos de dados limitados, mas não tem compreensão das regras morfológicas da língua.

### Transdutores de Estados Finitos: A Ponte

Há, no entanto, uma tecnologia que *faz* lidar bem com complexidade morfológica: o **Transdutor de Estados Finitos** (FST). Um FST é um dispositivo computacional formal que mapeia entre uma string de entrada e uma string de saída através de uma série de transições de estado. Para análise morfológica, um FST pode mapear uma forma de palavra de superfície para sua estrutura morfológica subjacente (e vice-versa), lidando com a complexidade combinatória completa da morfologia da língua.

Os FSTs são os descendentes diretos das regras de reescrita de Pāṇini. São as gramáticas Tipo 3 (regulares) de Chomsky em forma computacional. São a encarnação viva da conexão entre linguística formal e computação.

Ao emparelhar FSTs com LLMs, `champollion` executa uma síntese filosófica crucial: reconcilia a tradição estrutural *racionalista* (regras) com o paradigma estatístico *empiricista* (probabilidade) para contrariar os vieses famintos por dados e majoritários da IA moderna.

Para línguas polissintéticas, os FSTs podem fornecer algo que modelos neurais não podem: *verificação determinística*. Dada uma forma de palavra, um FST pode dizer definitivamente se é uma forma válida na língua—não probabilisticamente, não "isto parece certo," mas *sim* ou *não*. Esta é a resposta para a consulta central que assombra a TA neural para línguas de baixo recurso: *Como você verifica que uma palavra gerada é real sem um humano no loop?*

A resposta técnica é: você usa a gramática formal. Você usa as mesmas ferramentas que Pāṇini inventou vinte e cinco séculos atrás, codificadas no formalismo computacional que Turing e Chomsky tornaram rigoroso.

No entanto, devemos reconhecer que este poder determinístico carrega seus próprios riscos. Impor uma validação "sim" ou "não" em uma língua oral e fluida arrisca impor uma Ideologia de Língua Padrão rígida. Quando um FST dita o que é "correto," pode inadvertidamente recapitular a própria normalidade colonial que foi projetada para evitar—achatando variação dialetal, punindo code-switching e impondo uma gramática singular e normalizada em uma comunidade diversa. Porque os FSTs representam apenas uma métrica de correção formal, seu empiricismo rígido deve ser temperado. É precisamente por isto que a comunidade deve segurar a caneta. A comunidade define o padrão, constrói as regras e define o que a máquina aceita como válido, engenheirizando FSTs que abrem espaço para fluidez oral e dialetos regionais. A gramática formal não é uma verdade universal entregue por cientistas da computação; é uma infraestrutura operada pelos próprios falantes.

### champollion: Onde os Fios Convergem

É aqui que o projeto champollion entra na história. Ele se senta no ponto exato de convergência de todos os fios que traçamos:

- **De Pāṇini**: O princípio de que a linguagem pode ser descrita por regras formais e gerativas.
- **De Schleicher e Sapir**: A compreensão de que as línguas do mundo são diversas, estruturadas e frequentemente ameaçadas.
- **Das escolas residenciais e seu legado**: A compreensão de que "escassez de dados" não é um fato técnico neutro, mas a consequência de supressão linguística deliberada—e que qualquer tecnologia tocando essas línguas deve ser construída com soberania na fundação.
- **De Chomsky**: A hierarquia formal de gramáticas que conecta linguística a computação.
- **De Shannon**: O marco matemático para compreender comunicação, ruído e sinal.
- **De Turing e von Neumann**: As máquinas universais que podem executar qualquer função computável.
- **De Weaver e os Modelos IBM**: A percepção de que a tradução pode ser tratada como um problema estatístico.
- **Da revolução Transformer**: Os poderosos modelos neurais que podem traduzir—mas apenas quando têm dados suficientes.
- **Da tradição FST**: As ferramentas formais que podem lidar com complexidade morfológica onde modelos neurais falham.
- **Dos marcos indígenas de soberania de dados — CARE, Te Mana Raraunga e seus pares**: Os marcos de governança que garantem que a tecnologia serve comunidades em vez de extrair delas.

Champollion é uma plataforma projetada para direcionar a energia competitiva da comunidade de aprendizado de máquina para línguas que o mercado abandonou. Fornece uma infraestrutura de benchmark onde qualquer um pode submeter um método de tradução—neural, baseado em regras, híbrido ou novel—e tê-lo avaliado contra padrões rigorosos. Crucialmente, usa validação baseada em FST para garantir que formas geradas sejam morfologicamente válidas, e depende de verificação de falante nativo como a verdade fundamental última.

A plataforma incorpora vários princípios que esta história torna claro:

**Nenhuma abordagem única é suficiente.** A história da TA é uma história de mudanças de paradigma—de regras para estatística para redes neurais. Cada novo paradigma resolveu problemas que o anterior não conseguia, mas cada um também tinha pontos cegos. Para línguas polissintéticas de baixo recurso, a resposta é quase certamente *híbrida*: fluidez neural constrangida por correção formal.

**A soberania de dados não é opcional — é uma resposta estrutural a danos históricos.** Como a Seção V documenta em detalhes, os idiomas indígenas não são meramente "escassos em dados" por acidente. Eles foram tornados escassos por políticas deliberadas. O design aspirante à soberania do projeto — garantindo que os dados do idioma permaneçam sob o controle das comunidades indígenas, que as chaves de descriptografia sejam mantidas por entidades de custódia da comunidade, que a propriedade do algoritmo seja transferida para os falantes — não é uma reflexão tardia. É uma resposta direta a séculos de práticas extrativistas, desde a documentação por pessoas de fora na era das escolas residenciais até a raspagem de conjuntos de dados nos dias modernos.

Uma versão anterior deste parágrafo dizia que a arquitetura torna a repetição desses padrões *tecnicamente impossível*. Isso foi uma afirmação exagerada e foi retirada. Os mecanismos são reais e específicos — um corpus é criptografado no próprio dispositivo do detentor antes que qualquer coisa saia dele, a descriptografia exige que vários custodiantes atuem juntos em vez de uma única parte, e o conteúdo do corpus é buscado em sua fonte em vez de ser hospedado aqui — mas "impossível" não é uma propriedade que qualquer um deles possa carregar. Softwares têm bugs, operadores cometem erros, e uma parte determinada com funções adequadas suficientes é um risco residual que nenhum design remove. A afirmação honesta é que os caminhos fáceis estão fechados e os difíceis deixam evidências. O que este projeto pode prometer é mecanismo e divulgação, não impossibilidade.

**O jogo longo é revitalização.** A tradução é o *campo de prova*, mas o prêmio real é revitalização de língua através do ensino. As gramáticas formais e modelos morfológicos construídos para tradução automática são precisamente as fundações técnicas necessárias para aprendizado de língua assistido por máquina. Se podemos construir um FST que valida formas verbais Cree para um sistema de tradução, também podemos usar esse FST para ajudar um aluno a aprender a conjugar verbos Cree.

### Por Que Este Momento

Estamos vivendo em um momento único na história da tecnologia de linguagem. Vários fatores convergiram:

1. **Ferramentas de código aberto são maduras.** Os toolkits FST (como HFST e Foma), os frameworks de TA neural (como OpenNMT e Fairseq) e a infraestrutura de avaliação agora podem ser montados por um pequeno time com custo mínimo.

2. **A organização comunitária está acelerando.** Comunidades de língua indígena estão cada vez mais sofisticadas em seu uso de tecnologia e sua afirmação de soberania de dados. Organizações como a iniciativa First Voices, o Canadian Indigenous Languages Technology Project e numerosos esforços liderados pela comunidade estão construindo a infraestrutura humana que a tecnologia sozinha não pode fornecer.

3. **As capacidades de IA atingiram um limiar.** Grandes modelos de linguagem, embora insuficientes por si só para TA de baixo recurso, podem servir como componentes poderosos em sistemas híbridos—gerando traduções candidatas que são então verificadas e constrangidas por métodos formais.

4. **O custo desabou.** O que teria requerido um laboratório governamental em 1954 ou uma corporação importante em 2000 agora pode ser feito com créditos de computação em nuvem e software de código aberto. O gargalo não é mais tecnologia ou dinheiro. É *vontade*.

A questão não é se a tecnologia pode ser construída. Pode. A questão é se será construída *corretamente*—com a governança certa, os incentivos certos e o respeito certo pelas comunidades que se destina a servir.

Essa é a questão que este projeto existe para responder.

---

## Referências

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

*Este documento faz parte da documentação do projeto champollion. É lançado sob a mesma licença do projeto em si.*


## Aonde isso leva neste site

A história termina onde este projeto começa: a maioria dos idiomas vivos ainda
fora da tecnologia. [O que é o Champollion](/docs/what-is-champollion)
apresenta o plano em cinco minutos, e
[como a cobertura é contada](/docs/network/context/coverage-counting) mostra
exatamente onde a linha de hoje se encontra.
