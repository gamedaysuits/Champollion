---
sidebar_position: 4
title: "Microeval: Avaliação Específica por Idioma para Tradução Automática"
slug: '/network/context/microeval-methodology'
---

# Microeval: Métricas de Avaliação Específicas de Idioma para Tradução Automática

***Uma metodologia para construir métricas de avaliação adaptadas a idiomas individuais usando FSTs, dicionários e regras de equivalência curadas por linguistas — e por que o campo precisa disso***

---

> *"Os limites da minha linguagem significam os limites do meu mundo."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Introdução

A comunidade de avaliação de tradução automática passou duas décadas buscando métricas universais — medidas de qualidade de tradução que funcionem em todos os idiomas, todos os domínios, todas as tipologias. Essa busca produziu ferramentas notáveis: BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). Para os ~20 idiomas que dominam as tarefas compartilhadas do WMT, essas ferramentas funcionam.

Para os outros ~7.000 idiomas, não funcionam.

Este artigo argumenta que **a busca por métricas universais, quando aplicada a idiomas de baixo recurso e morfologicamente complexos, não é apenas incompleta — é o paradigma errado**. Propomos **microeval**: uma metodologia para construir métricas de avaliação adaptadas a idiomas individuais usando as melhores ferramentas linguísticas disponíveis — transdutores de estado finito, dicionários bilíngues, analisadores morfológicos e regras de equivalência curadas por linguistas.

Microeval não é uma métrica. É uma *prática* — um processo sistemático para construir infraestrutura de avaliação que codifica conhecimento específico do idioma. A prática produz métricas, que coletamos sob o nome de framework **LYSS** (Linguistically-informed Yield & Structural Scoring). Mas a contribuição é a metodologia, não qualquer métrica particular que ela produz.

Este documento é um complemento para:
- [Medindo o Imensurável](/docs/network/context/mt-evaluation-landscape) — a pesquisa do panorama de avaliação, que posiciona LYSS entre métricas existentes
- [A Especificação de Pontuação](/docs/network/specifications/scoring) — a especificação técnica para definições de métricas, pesos e pontuação composta
- [A Estratégia de Parceria de Corpus](/docs/network/specifications/corpus-partnership) — o fluxo de trabalho prático para estabelecer corpora de avaliação

Esses documentos descrevem *o que* é LYSS e *onde* se encaixa. Este aborda as questões mais profundas: *Por que* a avaliação específica do idioma é necessária? *Como* você a constrói para um novo idioma? E *quem* decide o que conta como "correto"?

---

## Parte 1: Por que as Métricas Universais Falham em Idiomas de Baixo Recurso

### 1.1 A Suposição de Universalidade

Toda métrica de avaliação de TA importante desde BLEU repousa em uma suposição implícita: que os *mecanismos* da qualidade de tradução são independentes de idioma, mesmo que os *parâmetros* difiram. BLEU conta sobreposição de n-gramas. chrF++ conta sobreposição de n-gramas de caracteres. COMET treina um modelo de regressão em julgamentos humanos. Todos assumem que a estrutura do sinal — o que torna uma tradução "boa" — pode ser capturada por um algoritmo agnóstico de idioma, possivelmente ajustado em dados específicos do idioma.

Para pares de idiomas europeus de alto recurso, essa suposição se sustenta bem o suficiente. As tarefas compartilhadas de métricas do WMT demonstram alta correlação humana para English↔German, English↔Czech, English↔Chinese. As métricas discordam em casos extremos, mas concordam na distribuição de qualidade.

Para idiomas polissintéticos como Plains Cree (nêhiyawêwin), a suposição se desintegra em múltiplos níveis:

**Opacidade morfológica.** Um único verbo Cree pode conter tanta informação quanto uma cláusula inteira em inglês. A palavra *nikî-wîcihâw* ("Eu o/a ajudei") codifica pessoa, número, animacidade, direção e tempo em uma única forma inflexionada. Uma métrica de n-gramas vê um token; um analisador morfológico vê seis morfemas. Métricas de superfície não conseguem distinguir entre um verbo corretamente inflexionado e uma alucinação com aparência plausível que viola concordância de animacidade — ambos são tokens únicos de comprimento de caractere similar.

**Ordem de palavras livre.** Cree tem ordem de palavras pragmaticamente livre (Wolfart, 1973, §3.2). As sentenças *atim niwâpamâw* e *niwâpamâw atim* ("Eu vejo o cachorro") são ambas gramaticalmente corretas — a escolha é pragmática, não sintática. Qualquer métrica que penalize divergência de ordem de palavras de uma tradução de referência gerará falsos negativos em cada um desses pares.

**Equivalência morfológica.** Cree tem múltiplas representações ortográficas válidas da mesma palavra (variantes SRO, alternâncias progressivas/comprimento de vogal). As traduções *nikî-atoskân* e *nikî-atoskên* podem ser equivalentes dialetalmente. Uma métrica de correspondência de string vê duas strings diferentes; um linguista vê a mesma palavra.

**Ausência de dados de treinamento.** Métricas neurais como COMET requerem dados de treinamento — julgamentos de qualidade humana em pares de tradução — para aprender o que "bom" significa. Para Cree, esses dados não existem. COMET ainda pode produzir pontuações (ele volta para seu codificador multilíngue), mas essas pontuações não foram validadas contra os julgamentos de qualidade de nenhum falante de Cree. São extrapolações de padrões de idiomas europeus, aplicadas a um idioma com estrutura fundamentalmente diferente.

### 1.2 O Paradoxo da Avaliação de Baixo Recurso

Isso cria um paradoxo:

> Os idiomas que mais precisam de tradução automática são precisamente os idiomas onde as melhores ferramentas de avaliação são menos confiáveis.

Se não conseguimos medir a qualidade de tradução para esses idiomas, não conseguimos:
- Comparar métodos de tradução objetivamente
- Detectar quando um modelo alucina nonsense com aparência plausível
- Rastrear se o campo está fazendo progresso
- Responsabilizar provedores de sistemas de TA por afirmações de qualidade

O resultado é uma **falha em cascata**: sem dados de treinamento → sem cobertura de codificador → sem avaliação validada → sem progresso mensurável → sem incentivo para investir → sem dados de treinamento.

Quebrar esse ciclo requer métodos de avaliação que não dependem dos recursos que não temos (dados de treinamento, julgamentos humanos em escala, codificadores neurais ajustados). Requer métodos que alavancam os recursos que *temos*.

### 1.3 O Que Temos

Para muitos idiomas de baixo recurso, décadas de trabalho de campo linguístico produziram ferramentas e recursos que a comunidade de avaliação de TA em grande parte ignorou:

| Recurso | O que fornece | Cobertura |
|----------|-----------------|----------|
| **Transdutores de Estados Finitos (FSTs)** | Análise morfológica completa — todas as formas de palavras válidas na língua | ~100+ línguas via GiellaLT, Apertium, NRC |
| **Dicionários bilíngues** | Mapeamentos de lema para glosa | Centenas de línguas (Wolvengrey 2001 para Cree: aproximadamente 18.000–22.000 entradas, dependendo da edição e do método de contagem) |
| **Analisadores morfológicos** | Etiquetagem de classes gramaticais, lematização, geração de paradigmas flexionais | Dezenas de línguas com cobertura variável |
| **Gramáticas descritivas** | Regras que regem a concordância, ordem das palavras, animacidade, obviação | Disponíveis para a maioria das línguas documentadas |
| **Conhecimento linguístico** | Membros da comunidade que podem identificar traduções corretas vs. incorretas | Existe por definição para todas as línguas vivas |

Esses recursos foram construídos por linguistas computacionais, linguistas de campo e comunidades de idiomas ao longo de décadas — frequentemente sem conexão com a comunidade de avaliação de TA. O FST para Plains Cree foi construído na Universidade de Alberta por Antti Arppe e colegas como uma ferramenta de documentação de idioma, não uma métrica de avaliação. A infraestrutura GiellaLT na UiT foi construída para tecnologia de idiomas minoritários, não para tarefas compartilhadas do WMT.

**Microeval é a prática de transformar esses recursos existentes em métricas de avaliação.**

---

## Parte 2: A Metodologia Microeval

### 2.1 Definição

**Microeval** é uma metodologia sistemática para construir métricas de avaliação de tradução automática adaptadas a um idioma específico, usando ferramentas e recursos linguísticos específicos do idioma. Um conjunto microeval:

1. **Codifica conhecimento específico do idioma** que não pode ser capturado por métricas agnósticas de idioma
2. **Usa infraestrutura linguística existente** (FSTs, dicionários, gramáticas) em vez de exigir novos dados de treinamento
3. **Produz pontuações determinísticas e interpretáveis** — cada pontuação pode ser rastreada até um julgamento linguístico específico
4. **É projetado por linguistas**, não apenas engenheiros — as classes de variantes, regras de equivalência e lógica de validação refletem expertise linguística
5. **Complementa em vez de substituir** métricas universais — microeval preenche as lacunas, não todo o espaço

### 2.2 A Arquitetura de Três Camadas

Um conjunto microeval completo opera em três níveis de análise, da superfície à semântica:

| Camada | Pergunta Respondida | Ferramenta Usada | Componente LYSS |
|--------|-------------------|------------------|-----------------|
| **Validade morfológica** | "Cada palavra é uma forma válida neste idioma?" | Transdutor de estado finito (FST) | LYSS-fst |
| **Equivalência linguística** | "Esta tradução é uma variante aceitável da referência?" | Linter determinístico com classes de variantes curadas por linguistas | LYSS-eq |
| **Fidelidade semântica** | "Esta tradução preserva o significado da fonte?" | Lematização FST + glossas de dicionário + sobreposição de palavras de conteúdo | LYSS-sem |

Essas camadas são **cumulativas, não alternativas**. Uma tradução deve passar por todas as três para ser considerada totalmente correta. Uma palavra alucinada falha na Camada 1. Uma variante dialetal que está correta mas difere da referência é capturada na Camada 2. Uma tradução que usa palavras válidas em uma ordem válida mas significa algo diferente é capturada na Camada 3.

### 2.3 Como Construir um Conjunto Microeval para um Novo Idioma

Esta seção descreve o processo passo a passo. Usamos Plains Cree (CRK) como o exemplo trabalhado e generalizamos onde possível.

#### Passo 1: Avaliar Recursos Disponíveis

Antes de construir qualquer coisa, faça um inventário do que existe:

| Recurso | Necessário para | Como Encontrar | Qualidade Mínima |
|---------|-----------------|-----------------|------------------|
| FST | Camada 1 (LYSS-fst) | Verifique catálogos GiellaLT, Apertium, NRC | Deve aceitar >90% de formas de palavras válidas em um corpus de teste |
| Dicionário bilíngue | Camada 3 (LYSS-sem) | Verifique projetos de documentação de idioma, Wiktionary, recursos comunitários | >5.000 entradas com mapeamentos de lema para glosa |
| Gramática descritiva | Camada 2 (LYSS-eq) | Gramáticas publicadas, teses, referências autorais da comunidade | Deve documentar paradigmas morfológicos principais |
| Falantes bilíngues | Todas as camadas (validação) | Contatos comunitários, programas de idiomas universitários | Mínimo 3 falantes para experimentos de validação |

**Se nenhum FST existir:** Pule a Camada 1. O conjunto opera apenas nas Camadas 2–3, ou volta para métricas universais (Perfil B na pontuação LYSS). Isso não é ideal, mas é melhor que nada.

**Se nenhum dicionário existir:** Pule a Camada 3 ou use uma versão reduzida com qualquer vocabulário disponível. Um dicionário de 500 entradas é menos útil que um de 18.000, mas ainda fornece sinal.

#### Passo 2: Configurar o Gate de Validade Morfológica (LYSS-fst)

Se um FST estiver disponível:

1. **Instale o FST** usando o binário do analisador do idioma (formato HFST `.hfstol` para GiellaLT)
2. **Execute um teste de cobertura** em um corpus representativo: qual percentual de tokens o FST reconhece?
3. **Construa uma lista de permissões** para lacunas esperadas do FST: empréstimos, nomes próprios, neologismos, abreviações
4. **Compute a taxa de rejeição falsa de linha de base** — o percentual de palavras válidas que o FST rejeita incorretamente
5. **Defina o limiar de pontuação** — abaixo de qual taxa de aceitação do FST sinalizamos uma tradução como morfologicamente suspeita?

A métrica-chave é `fst_acceptance_rate`: a fração de palavras de saída que o FST reconhece. Uma taxa de 0,85 significa 85% das palavras são morfologia Cree válida; 15% são empréstimos, inválidos ou lacunas de cobertura do FST.

**Decisão de design crítica:** O problema de rejeição falsa. Um FST treinado em linguagem literária formal rejeitará formas coloquiais válidas. Um FST com cobertura de paradigma incompleta rejeitará inflexões válidas mas raras. A lista de permissões mitiga isso, mas não consegue eliminá-lo. *É por isso que LYSS-fst sozinho não é suficiente* — deve ser combinado com as Camadas 2 e 3.

#### Passo 3: Projetar as Classes de Variantes (LYSS-eq)

Este é o passo mais exigente linguisticamente, e não pode ser automatizado. Um linguista com expertise no idioma alvo deve identificar:

**Que tipos de diferenças entre uma tradução candidata e uma tradução de referência devem ser considerados "aceitáveis"?**

Para Plains Cree, identificamos seis classes de variantes:

| Classe de Variante | Base Linguística | Exemplo |
|-------------------|-----------------|---------|
| `WORD_ORDER` | Ordem de palavras pragmaticamente livre (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | Variantes de ortografia SRO, alternância de comprimento de vogal | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Partículas de discurso gramaticalmente opcionais | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Sinônimos atestados em dicionário | *wâpamêw* ≡ *kanawâpamêw* (para "vê") |
| `PROGRESSIVE_AMBIGUITY` | Múltiplas formas progressivas válidas | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | Distinção de primeira pessoa plural não em inglês | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Essas classes são específicas do idioma.** Outro idioma teria classes diferentes — turco pode ter classes para variantes de harmonia vocálica, japonês para alternação de registro honorífico, inuktitut para variação de sufixo dialetal.

**O processo de design:**
1. Colete 100+ pares de tradução (fonte + referência + candidata)
2. Identifique todos os casos onde a candidata é diferente da referência mas um falante bilíngue consideraria correta
3. Categorize as diferenças — procure por padrões que se repetem em múltiplos pares
4. Formalize cada padrão como uma regra determinística (regex, operação de conjunto ou transdução FST)
5. Valide com 3+ falantes bilíngues: para cada classe de variante, eles concordam que é aceitável?
6. Itere: algumas classes precisarão de refinamento, outras precisarão ser divididas ou mescladas

#### Passo 4: Construir o Validador Semântico (LYSS-sem)

O validador semântico responde: "Esta tradução significa a mesma coisa que a referência?" Ele opera em quatro estágios:

1. **Lematize ambas as traduções** usando o FST (extraia formas raiz, remova inflexão)
2. **Mapeie lemas para glossas** usando o dicionário bilíngue (lema Cree → glosa em inglês)
3. **Compare os conjuntos de glossas** — as glossas da candidata se sobrepõem com as glossas da referência?
4. **Verifique restrições estruturais** — a candidata viola regras de gramática conhecidas (concordância de animacidade, forma de verbo, marcação de pessoa)?

O validador produz vereditos: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Cada veredito é determinístico e rastreável — você pode explicar *por que* uma tradução recebeu um veredito dado examinando qual estágio a sinalizou.

**Versão mínima viável:** Se você tem um FST e um dicionário, pode construir um validador semântico simplificado que apenas faz sobreposição de lema-glosa (estágios 1–3). O estágio 4 (verificação de gramática) requer mais engenharia linguística mas adiciona valor significativo para idiomas morfologicamente complexos.

#### Passo 5: Integrar com o Harness de Avaliação

O conjunto microeval é empacotado como um conjunto de plugins de métrica que se conectam ao harness de avaliação:

1. Cada métrica implementa o protocolo `MetricPlugin`: `compute(entry) → dict`, `aggregate(results) → dict`
2. O sistema de descoberta de plugin detecta automaticamente plugins específicos do idioma com base no código do idioma alvo
3. As pontuações são alimentadas para a função de pontuação composta, que combina métricas microeval com métricas universais usando perfis de peso específicos do idioma

### 2.4 Microeval Mínimo Viável

Nem todo idioma precisa de todas as três camadas imediatamente. Aqui está a configuração mínima útil em cada nível:

| Configuração | O Que Você Precisa | O Que Você Obtém | Tempo para Construir |
|-------------|------------------|-----------------|---------------------|
| **Apenas LYSS-fst** | FST + lista de permissões | Gate de validade morfológica — captura formas de palavras alucinadas | 1–2 semanas |
| **LYSS-fst + LYSS-eq** | FST + 3–6 classes de variantes + tempo de linguista | Gate de validade + detecção de equivalência — reduz falsos negativos | 4–8 semanas |
| **LYSS completo** | FST + classes de variantes + dicionário + validador semântico | Avaliação completa específica do idioma | 8–16 semanas |

A recomendação é começar com LYSS-fst (rápido, alto impacto, requer apenas um FST que provavelmente já existe) e adicionar camadas incrementalmente.

---

## Parte 3: O Problema de Rejeição Falsa

### 3.1 O Que É

Toda métrica microeval tem uma taxa de rejeição falsa: a probabilidade de que uma tradução correta seja pontuada como incorreta.

Para LYSS-fst, rejeição falsa ocorre quando:
- O FST não cobre uma forma de palavra válida (tabelas de paradigma incompletas)
- A tradução contém um empréstimo que o FST não reconhece
- A tradução usa um neologismo ou marca registrada
- A tradução usa uma forma dialetal não no léxico do FST
- A tradução contém um nome próprio não na lista de permissões

Para LYSS-eq, rejeição falsa ocorre quando:
- A tradução usa uma variante aceitável não coberta por nenhuma classe de variante
- Uma nova classe de variante é necessária mas ainda não foi identificada

Para LYSS-sem, rejeição falsa ocorre quando:
- Um lema não está no dicionário
- Uma tradução válida usa uma estratégia de paráfrase que não mapeia para o conjunto de lema da referência

### 3.2 Por Que Importa Mais Que Aceitação Falsa

Em avaliação, rejeição falsa é pior que aceitação falsa. Uma rejeição falsa significa que uma tradução *correta* é pontuada como *errada* — isso desencoraja construtores que estão fazendo bom trabalho, e mina a confiança na métrica. Uma aceitação falsa significa que uma tradução *errada* é pontuada como *correta* — isso é ruim, mas é capturado por outras métricas na composição.

Rejeição falsa se compõe: se LYSS-fst tem uma taxa de rejeição falsa de 10% por palavra, e uma sentença tem 5 palavras, a probabilidade de que pelo menos uma palavra seja falsamente rejeitada é ~41%. Isso significa que quase metade de todas as sentenças terão sua taxa de aceitação do FST reduzida por pelo menos uma palavra — não porque a tradução está errada, mas porque o FST é incompleto.

### 3.3 Estratégias de Mitigação

| Estratégia | Mecanismo | Efetividade |
|-----------|----------|-----------|
| **Listas de permissões** | Coloque na lista de permissões empréstimos conhecidos, nomes próprios, abreviações | Alta para lacunas conhecidas, zero para lacunas desconhecidas |
| **Correspondência fuzzy** | Aceite palavras dentro de distância de edição 1 de uma forma conhecida | Captura erros de digitação e variantes ortográficas menores |
| **Pontuação de confiança** | Pondere resultados do FST pela completude do paradigma | Requer metadados de cobertura de paradigma |
| **Limiares específicos de categoria** | Diferentes limiares para diferentes domínios (médico pode ter mais empréstimos) | Requer corpora marcados por domínio |
| **Listas de permissões mantidas pela comunidade** | Falantes enviam palavras que o FST deveria aceitar | Mais sustentável a longo prazo; requer infraestrutura de engajamento comunitário |

### 3.4 Medindo a Taxa

A taxa de rejeição falsa deve ser medida empiricamente, em um corpus representativo:

1. Pegue um corpus de 500+ sentenças Cree válidas conhecidas (livros didáticos, traduções revisadas)
2. Execute cada palavra através do FST
3. Para cada palavra que o FST rejeita, tenha um falante bilíngue classificá-la: palavra válida que o FST perdeu, ou genuinamente inválida?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Essa medição é um dos experimentos de validação necessários (Especificação de Pontuação §1.6).

---

## Parte 4: Quem Decide O Que É "Correto"?

### 4.1 A Dimensão Política da Avaliação

Métricas de avaliação não são instrumentos neutros. Toda métrica incorpora uma teoria do que "tradução correta" significa, e essa teoria tem consequências:

- Um FST construído a partir de Cree literário penalizará Cree coloquial. Esta é uma escolha *política* sobre qual registro do idioma é valorizado.
- Uma classe de variante que aceita uma forma dialetal mas não outra implicitamente padroniza o idioma. Padronização é um ato político com uma longa história colonial.
- Um validador semântico que requer sobreposição exata de lema penaliza paráfrase criativa — uma estratégia de tradução importante que tradutores hábeis usam deliberadamente.

Microeval torna essas escolhas *explícitas*. Toda classe de variante, toda entrada de lista de permissões, toda regra de equivalência semântica é uma decisão discreta, documentada, revisável. Isso é uma característica, não um bug: significa que a comunidade pode inspecionar, desafiar e modificar as regras que governam como seu idioma é avaliado.

### 4.2 Governança Comunitária de Regras de Avaliação

Para idiomas indígenas especificamente, decisões de avaliação devem ser governadas pela comunidade de idioma, não por pesquisadores ou engenheiros externos. Isso não é apenas um princípio ético (embora seja) — é um requisito de correção. Apenas falantes fluentes podem determinar se uma variante é aceitável.

O modelo de governança:

1. **Pesquisadores propõem** classes de variantes, entradas de lista de permissões e regras semânticas com base em análise linguística
2. **Falantes revisam** cada proposta e aprovam, rejeitam ou modificam
3. **Regras aprovadas** são confirmadas no codebase com atribuição de falante
4. **Regras disputadas** são sinalizadas para discussão comunitária — são excluídas da pontuação até serem resolvidas
5. **A comunidade pode revogar** qualquer regra a qualquer momento removendo-a do conjunto aprovado

Este modelo requer infraestrutura (o harness de avaliação, controle de versão, o protocolo de validação de falante) e relacionamentos (confiança entre pesquisadores e membros da comunidade). Construir essa infraestrutura é parte da metodologia microeval.

### 4.3 Variação Dialetal

A pergunta de governança mais difícil: quando dois dialetos de um idioma discordam sobre uma forma, qual é "correta"?

A resposta de microeval: **ambas são corretas.** Variantes dialetais são representadas como classes de variantes adicionais com tags de dialeto. A pontuação composta pode ser computada por dialeto ou entre dialetos, dependendo do que a avaliação está tentando medir.

Isso requer que o corpus seja marcado por dialeto e que as classes de variantes sejam dialeto-conscientes. Também requer que falantes de múltiplos dialetos participem da validação. O documento Estratégia de Parceria de Corpus aborda esses requisitos.

---

## Parte 5: Relação com Trabalho Anterior

### 5.1 O Que Microeval NÃO É

| Afirmação Que NÃO Estamos Fazendo | Por Que Não |
|----------------------------------|-----------|
| "Métricas universais são inúteis" | Elas fornecem linhas de base essenciais e comparabilidade entre idiomas. Microeval complementa, não substitui. |
| "Métricas neurais não conseguem funcionar para LRL" | Conseguem — com ajuste fino em dados específicos do idioma. Mas esses dados raramente existem. Microeval funciona *agora*. |
| "Avaliação baseada em FST é nova" | FSTs têm sido usados em PNL por décadas. A novidade é em implantá-los sistematicamente como métricas de avaliação de TA. |
| "LYSS é melhor que COMET" | Não sabemos — ainda não fizemos o estudo de correlação humana. Acreditamos que LYSS é mais *informativo* para idiomas polissintéticos, mas não conseguimos afirmar que é mais *preciso* até termos evidência. |

### 5.2 Trabalho Anterior Mais Próximo

| Trabalho | Relação com Microeval |
|---------|---------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Testes contrastivos para fenômenos morfológicos — complementar. MorphEval testa se sistemas *conseguem* produzir morfologia; LYSS testa se eles *fizeram*. |
| **CheckList** (Ribeiro et al., 2020) | Metodologia de teste comportamental para PNL — paradigma análogo. CheckList é uma metodologia; microeval também é uma metodologia, aplicada a avaliação em vez de teste. |
| **HyTER** (Dreyer & Marcu, 2012) | Redes de equivalência de significado — paralelo conceitual mais próximo a LYSS-eq. HyTER enumera paráfrases; LYSS-eq enumera variantes morfológicas. HyTER requer construção manual de rede por sentença; LYSS-eq as regras se aplicam em todo o corpus. |
| **Cobertura Apertium** | Usa cobertura FST como proxy para qualidade de saída de TA — antecipa diretamente LYSS-fst. Não é formalizado como métrica ou integrado em um framework de pontuação. |
| **FUSE** (AmericasNLP 2025) | Avaliação baseada em características para idiomas indígenas americanos — mais similar em espírito. FUSE propõe características linguísticas como dimensões de avaliação; LYSS implementa características específicas para idiomas específicos. Comparação frente a frente é necessária. |
| **AfriCOMET** (Wang & Adelani, 2024) | COMET ajustado fino para idiomas africanos — demonstra que métricas neurais *conseguem* ser adaptadas. Microeval é o complemento baseado em regras para idiomas onde dados de ajuste fino não existem. |

### 5.3 A Distinção-Chave

Todo trabalho anterior em avaliação consciente de morfologia ou:
1. **Propõe um framework geral** sem implementá-lo para idiomas específicos (FUSE, CheckList)
2. **Implementa para idiomas de alto recurso** onde dados de treinamento existem (MorphEval foca em pares europeus)
3. **Ajusta fino métricas neurais** o que requer os dados que não temos (AfriCOMET)

Microeval é especificamente projetado para o caso onde:
- Ferramentas linguísticas (FSTs, dicionários) existem
- Dados de treinamento para ajuste fino de métrica neural não existem
- A complexidade morfológica do idioma derrota métricas de superfície
- A avaliação deve ser operacional *agora*, não após uma campanha de coleta de dados

---

## Parte 6: Questões Abertas e Limitações Honestas

### 6.1 Questões Não Resolvidas

1. **As métricas LYSS se correlacionam com julgamentos de qualidade humana?** Não sabemos. O estudo de correlação humana necessário (200+ pares de sentença, 3+ falantes bilíngues) não foi conduzido. Até que tenha sido, as pontuações LYSS são estimativas de engenharia, não medições de qualidade validadas.

2. **Como as métricas LYSS se comportam conforme os idiomas mudam?** Idiomas vivos evoluem — novos empréstimos, dialetos em mudança, neologismos emergentes. FSTs e classes de variantes devem ser mantidos. Qual é o ônus de manutenção? Não sabemos.

3. **Qual é a qualidade mínima do FST para LYSS-fst útil?** Se um FST cobre apenas 60% do léxico, LYSS-fst ainda é útil, ou o ruído sobrepuja o sinal? Precisamos de evidência empírica.

4. **Microeval consegue funcionar para desafios não-morfológicos?** Idiomas com distinções tonais, consoantes de clique ou scripts logográficos apresentam desafios de avaliação que FSTs não abordam. Microeval pode não se aplicar — ou pode exigir ferramentas diferentes.

5. **Como lidamos com o problema de cold-start?** Construir um conjunto microeval requer expertise linguística. Para idiomas sem comunidade de linguística computacional ativa, quem faz o trabalho?

### 6.2 Limitações Honestas de LYSS

| Limitação | Severidade | Mitigação |
|-----------|-----------|----------|
| Sem dados de correlação humana | 🔴 Crítica | Experimento de validação necessário #1 |
| Taxa de rejeição falsa do FST não medida | 🔴 Crítica | Experimento de validação necessário #2 |
| Implementado apenas para um idioma (CRK) | 🟡 Significativa | Porta de segundo idioma (North Sámi) planejada |
| Classes de variantes podem estar incompletas | 🟡 Significativa | Revisão comunitária + adição contínua |
| Validador semântico requer spaCy | 🟡 Significativa | Dependência opcional; degradação graciosa |
| Cobertura de dicionário afeta qualidade de LYSS-sem | 🟡 Significativa | Requisitos de tamanho mínimo de dicionário documentados |
| Não consegue detectar fluência ou naturalidade | 🟡 Significativa | Requer avaliação humana ou métricas neurais |
| Requer expertise linguística para estender | 🟡 Significativa | Documentação de metodologia (este artigo) reduz barreira |

### 6.3 O Caminho Adiante

> *"Se nos concentrarmos apenas no que generaliza, inevitavelmente esqueceremos de onde não generaliza — e perderemos esses idiomas e todo seu conhecimento e sabedoria."*

Microeval não é uma solução para o problema de avaliação. É uma prática — uma disciplina de prestar atenção ao que torna cada idioma diferente, e codificar essa atenção em código funcional. A prática é laboriosa, específica do idioma e nunca termina. Mas produz algo que o paradigma de métrica universal não consegue: avaliação que fala o idioma que avalia.

---

## Apêndice A: Artigos-Chave

| Artigo | Ano | Contribuição | Relevância |
|--------|-----|-------------|-----------|
| Papineni et al., "BLEU" | 2002 | Métrica de n-grama fundacional | Métrica universal de linha de base |
| Popović, "chrF++" | 2017 | Métrica de n-grama de caractere | Melhor métrica de superfície para idiomas morfologicamente ricos |
| Rei et al., "COMET" | 2020 | Framework de avaliação neural | Métrica neural universal |
| Dreyer & Marcu, "HyTER" | 2012 | Semântica de equivalência de significado | Predecessor conceitual a LYSS-eq |
| Burlot & Yvon, "MorphEval" | 2017 | Avaliação morfológica | Teste morfológico contrastivo |
| Ribeiro et al., "CheckList" | 2020 | Teste comportamental para PNL | Paradigma metodológico |
| Sánchez-Cartagena & Toral, "MorphEval" | 2024 | Avaliação de capacidades morfológicas | Complemento diagnóstico mais próximo |
| Wang & Adelani, "AfriCOMET" | 2024 | Métrica neural adaptada para idiomas africanos | Demonstra a necessidade de avaliação específica do idioma |
| Lindén et al., "HFST" | 2011 | Framework de morfologia de estado finito | Infraestrutura para LYSS-fst |
| Wolfart, "Plains Cree" | 1973 | Gramática Cree definitiva | Autoridade linguística para microeval CRK |
| Wolvengrey, "Cree: Words" | 2001 | Dicionário Plains Cree | Recurso subjacente a LYSS-sem |
| Carroll et al., "CARE Principles" | 2020 | Governança de dados indígenas | Framework de governança para microeval |

## Apêndice B: Resumo de Componentes LYSS

| Componente | Nome da Métrica | O Que Mede | Recursos Necessários | Status de Implementação |
|-----------|-----------------|-----------|---------------------|----------------------|
| LYSS-fst | `fst_acceptance_rate` | Validade morfológica de palavras de saída | FST GiellaLT | ✅ Operacional (CRK) |
| LYSS-eq | `equivalent_match_rate` | Detecção de variante aceitável | Classes de variante curadas por linguistas | ✅ Operacional (CRK, 6 classes) |
| LYSS-sem | `semantic_score` | Preservação de significado via sobreposição de lema-glosa | FST + dicionário bilíngue + spaCy | ✅ Operacional (CRK, requer spaCy) |

## Apêndice C: Idiomas com Cobertura FST GiellaLT

Os seguintes idiomas têm FSTs disponíveis através de GiellaLT e são candidatos para integração LYSS-fst:

<!-- Esta lista deve ser preenchida com dados de cobertura GiellaLT reais. -->
<!-- Veja: https://github.com/giellalt -->

| Idioma | ISO 639-3 | Maturidade do FST | Viabilidade de LYSS-fst |
|--------|-----------|------------------|----------------------|
| Plains Cree | crk | Produção | ✅ Operacional |
| Northern Sámi | sme | Produção | 🟡 Planejado (primeira porta) |
| Southern Sámi | sma | Produção | 🟡 Candidato |
| Lule Sámi | smj | Produção | 🟡 Candidato |
| Inari Sámi | smn | Produção | 🟡 Candidato |
| Skolt Sámi | sms | Produção | 🟡 Candidato |
| Finnish | fin | Produção | 🟡 Candidato |
| Inuktitut | iku | Beta | 🟡 Necessita avaliação |
| Basque | eus | Beta | 🟡 Necessita avaliação |
| Welsh | cym | Beta | 🟡 Necessita avaliação |
