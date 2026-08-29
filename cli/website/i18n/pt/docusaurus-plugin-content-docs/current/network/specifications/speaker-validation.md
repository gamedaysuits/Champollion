---
sidebar_position: 8
title: "Protocolo de Validação de Locutor"
slug: '/network/specifications/speaker-validation'
---

# Protocolo de Validação por Falantes

> **Objetivo.** Este documento define exatamente o que precisamos de falantes bilíngues de Cree–Inglês para validar as métricas de avaliação LYSS. Sem essa validação, nossas pontuações automatizadas são estimativas de engenharia, não medições de qualidade comprovadas. Esta é a lacuna mais importante do projeto.
>
> **Público-alvo.** Parceiros da comunidade, potenciais colaboradores, avaliadores de financiamento e a equipe do projeto.


---

## 1. Por Que Precisamos de Falantes

O framework de avaliação LYSS (Linguistically-informed Yield & Structural Scoring) calcula pontuações de qualidade automatizadas para traduções de Inglês → Plains Cree. Ele usa três sinais principais:

- **LYSS-fst**: A saída contém palavras válidas em Cree? (verificado pelo transdutor de estados finitos GiellaLT)
- **LYSS-eq**: A saída é uma variante aceitável da tradução de referência? (verificado pelas classes de equivalência do linter)
- **LYSS-sem**: A saída preserva o significado da fonte? (verificado pelo validador semântico)

Essas métricas produzem números. **Não sabemos se esses números significam algo.** O FST pode rejeitar palavras válidas que não reconhece (empréstimos, neologismos, nomes próprios). O linter pode perder equivalências válidas ou aceitar inválidas. O validador semântico pode julgar mal o significado. Até que falantes bilíngues nos digam se nossas pontuações automatizadas correspondem ao seu julgamento humano da qualidade da tradução, estamos adivinhando.

Toda métrica de avaliação de MT importante (BLEU, COMET, chrF++) foi validada comparando pontuações automatizadas com milhares de avaliações de qualidade humana. Precisamos do mesmo — em escala menor, porque nossos recursos são limitados, mas com o mesmo rigor.

---

## 2. O Que Precisamos: Três Tarefas

### Tarefa A: Avaliação de Qualidade de Tradução (Principal — ~8 horas no total)

**O quê:** Avaliar 200 traduções de Inglês → Cree geradas por máquina em duas escalas.

**Quem:** 3+ falantes bilíngues de Plains Cree–Inglês com fluência de leitura em SRO (Standard Roman Orthography).

**Como funciona:**

1. Fornecemos uma planilha ou formulário web com 200 linhas. Cada linha tem:
   - A sentença fonte em Inglês
   - Uma tradução Cree gerada por máquina
   - (Opcionalmente) uma tradução Cree de referência para comparação

2. Para cada tradução, o falante avalia duas coisas:

   **Adequação** (ela diz a coisa certa?):
   | Pontuação | Rótulo | Significado |
   |-----------|--------|-------------|
   | 1 | Nenhuma | A tradução não tem nada a ver com a fonte |
   | 2 | Pouca | Algumas palavras correspondem, mas o significado geral está errado |
   | 3 | Muita | O significado central está lá, mas partes importantes estão faltando ou erradas |
   | 4 | Maior parte | Quase tudo está correto, pequenas lacunas de significado |
   | 5 | Tudo | A tradução transmite completamente o significado da fonte |

   **Fluência** (soa como Cree real?):
   | Pontuação | Rótulo | Significado |
   |-----------|--------|-------------|
   | 1 | Incompreensível | Isto não é Cree |
   | 2 | Disfluente | Palavras individuais podem ser Cree, mas a sentença está quebrada |
   | 3 | Não-nativa | Compreensível, mas claramente não como um falante de Cree diria |
   | 4 | Boa | Soa natural com pequenas estranhezas |
   | 5 | Impecável | Um falante de Cree poderia ter escrito isto |

3. Opcionalmente, o falante pode adicionar uma nota em texto livre explicando sua avaliação (por exemplo, "concordância animado/inanimado errada no verbo," "isto é dialeto th, mas avalio com base no dialeto y").

**Estimativa de tempo:** ~2,5 minutos por tradução × 200 traduções = ~8 horas. Pode ser dividido em múltiplas sessões (por exemplo, 4 × 2 horas ao longo de 2 semanas).

**Compensação:** $50–65 CAD/hora (correspondendo às taxas de compensação de falantes da BENCHMARK_SPEC §10.3). Total por falante: $400–520 CAD. Para 3 falantes: **$1.200–1.560 CAD**.

**O que fazemos com isso:** Calculamos a correlação entre nossas pontuações LYSS automatizadas e as avaliações dos falantes. Se LYSS-fst correlaciona com avaliações de fluência e LYSS-sem correlaciona com avaliações de adequação, as métricas são validadas. Se não, sabemos onde corrigi-las.

---

### Tarefa B: Validação de Equivalência do Linter (~2 horas)

**O quê:** Revisar 50 pares de traduções Cree que nosso linter classifica como "equivalentes" e nos dizer se realmente significam a mesma coisa.

**Quem:** 1–2 falantes bilíngues (podem ser os mesmos falantes da Tarefa A).

**Como funciona:**

1. Fornecemos 50 pares. Cada par tem:
   - A fonte em Inglês
   - Tradução A (a referência)
   - Tradução B (uma variante que nosso linter diz ser equivalente)
   - O motivo da equivalência (por exemplo, "permutação de ordem de palavras," "variante ortográfica," "partícula opcional removida")

2. Para cada par, o falante responde:
   - **Mesmo significado?** Sim / Não / Depende do contexto
   - **Ambas naturais?** Sim / A é melhor / B é melhor / Nenhuma é natural
   - **Notas** (texto livre opcional)

**Estimativa de tempo:** ~2 minutos por par × 50 pares = ~2 horas.

**Compensação:** $50–65 CAD/hora × 2 horas = **$100–130 CAD por falante**.

**O que fazemos com isso:** Calculamos a precisão de cada classe de equivalência. Se falantes dizem que 90% das equivalências de "ordem de palavras" são genuinamente equivalentes, essa classe é validada. Se dizem que 40% das equivalências de "sinônimo de lema" estão erradas, sabemos que precisamos corrigir ou remover essa classe.

---

### Tarefa C: Revisão de Rejeição Falsa do FST (~1,5 horas)

**O quê:** Revisar 100 palavras Cree que o analisador FST rejeita (diz que não são palavras válidas em Cree) e nos dizer se realmente são válidas.

**Quem:** 1 falante bilíngue com forte conhecimento de vocabulário Cree.

**Como funciona:**

1. Executamos o analisador FST em nosso corpus de desenvolvimento EdTeKLA de 436 entradas (`textbook_dev.json`) e coletamos cada palavra que ele rejeita.
2. Apresentamos até 100 palavras rejeitadas ao falante com o contexto da frase.
3. Para cada palavra, o falante responde:
   - **Esta é uma palavra válida em Cree?** Sim / Não / Não tenho certeza
   - **Se sim, de que tipo?** Palavra estabelecida / Empréstimo / Nome / Forma dialetal / Neologismo / Outro
   - **Notas** (opcional)

**Estimativa de tempo:** ~1 minuto por palavra × 100 palavras = ~1,5 horas.

**Compensação:** $50–65 CAD/hora × 1,5 horas = **$75–100 CAD**.

**O que fazemos com isso:** Calculamos a taxa de rejeição falsa do FST. Se o FST rejeita 50 palavras e falantes dizem que 30 delas são válidas, a taxa de rejeição falsa é 60% — inaceitavelmente alta, exigindo uma lista de exceções/empréstimos. Se falantes dizem que apenas 5 são válidas, a taxa de rejeição falsa é 10% — a métrica é confiável.

---

## 3. Compromisso Total do Falante

| Tarefa | Falantes Necessários | Horas por Falante | Custo por Falante | Custo Total |
|--------|---------------------|-------------------|------------------|------------|
| A: Avaliação de Qualidade | 3 | ~8 horas | $400–520 | $1.200–1.560 |
| B: Validação do Linter | 2 | ~2 horas | $100–130 | $200–260 |
| C: Revisão do FST | 1 | ~1,5 horas | $75–100 | $75–100 |
| **Total** | **3 falantes** | **~11,5 horas (máx. por falante)** | **$575–750 (máx.)** | **$1.475–1.920** |

Se os mesmos 3 falantes fizerem todas as tarefas: **~11,5 horas cada ao longo de 2–4 semanas, $575–750 cada**.

Um único falante fazendo apenas a Tarefa A se comprometeria com **~8 horas ao longo de 2 semanas por $400–520**.

---

## 4. Qualificações do Falante

**Obrigatório:**
- Bilíngue em Plains Cree e Inglês
- Fluência de leitura em SRO (Standard Roman Orthography)
- Confortável em avaliar traduções em uma escala estruturada

**Preferível:**
- Experiência com dialeto y (o dialeto usado em nosso corpus de referência do EDTeKLA)
- Experiência em ensino ou tradução (fornece julgamento de qualidade calibrado)
- Familiaridade com diferentes registros (formal, educacional, conversacional)

**Não obrigatório:**
- Conhecimento técnico ou de PNL (fornecemos todas as ferramentas e contexto)
- Habilidades computacionais (a interface de avaliação será uma planilha simples ou formulário web)
- Envolvimento anterior com o projeto Champollion

---

## 5. Governança de Dados {#5-data-governance}

Todas as contribuições dos falantes são regidas pelas políticas de dados do projeto, aspirantes à soberania:

- **Propriedade:** As avaliações de qualidade dos falantes permanecem sua contribuição intelectual. Eles são creditados pelo nome (ou anonimamente, por sua escolha) em qualquer publicação.
- **Controle:** Os falantes podem retirar suas avaliações a qualquer momento. A retirada remove seus dados de todas as análises.
- **Acesso:** Os dados de avaliação são armazenados em infraestrutura controlada pela organização de governança comunitária (quando estabelecida) ou na plataforma preferida do falante.
- **Posse:** Os dados de avaliação brutos nunca são publicados. Apenas estatísticas agregadas (correlações, concordância entre anotadores) aparecem em publicações.
- **Compensação:** Os falantes são pagos por seu tempo independentemente de usarmos suas avaliações. O pagamento não é contingente aos resultados.

---

## 6. O Que os Falantes Recebem {#6-what-speakers-get}

Além da compensação:

- **Co-autoria** em qualquer publicação usando suas avaliações (se desejado)
- **Reconhecimento** em toda a documentação do projeto
- **Acesso antecipado** às ferramentas de avaliação e resultados
- **Entrada** em como as métricas são usadas — se um falante diz "seu linter está errado sobre X," corrigimos o linter
- **Poder de veto** sobre publicação de resultados que consideram problemáticos

---

## 7. Como Começar {#7-how-to-get-started}

Se você é um falante bilíngue de Cree–Inglês interessado em participar, ou se conhece alguém que possa estar:

1. **Entre em contato conosco** em [email/contato do projeto] — sem compromisso, apenas uma conversa
2. **Explicamos as tarefas** em linguagem clara (sem jargão)
3. **Você escolhe quais tarefas** está interessado (A, B, C, ou qualquer combinação)
4. **Definimos um cronograma** que funcione para você (blocos de 2 horas, horário flexível)
5. **Você avalia traduções** via planilha ou formulário web — de qualquer lugar, no seu próprio tempo
6. **Pagamos prontamente** — dentro de 2 semanas após completar cada bloco de tarefas

---

## 8. O Que Acontece Depois

Com dados de validação de falantes, podemos:

1. **Publicar as correlações de métrica** — provando (ou refutando) que as pontuações LYSS refletem o julgamento humano
2. **Recalibrar as métricas** — ajustando pesos, limites e classes de equivalência com base no feedback dos falantes
3. **Corrigir o linter** — removendo equivalências falsas, adicionando as faltantes
4. **Corrigir a lista de permissões do FST** — adicionando palavras válidas que o FST rejeita incorretamente
5. **Enviar para um local acadêmico** — com falantes como co-autores, estabelecendo LYSS como uma métrica validada para avaliação de MT de linguagem polissintética

Sem validação de falantes, LYSS permanece uma ferramenta de engenharia. Com ela, LYSS se torna uma métrica cientificamente fundamentada. Essa é a diferença entre "construímos algo" e "provamos que funciona."


## Aonde isso leva neste site

A validação por falantes é uma etapa de um pipeline maior: o fluxo de trabalho
[Parceria de Corpus](/docs/network/specifications/corpus-partnership)
é onde essas tarefas se encaixam na construção de um corpus de avaliação, e
[Como os Falantes São Pagos](/docs/network/perspectives/how-speakers-get-paid)
é a versão em linguagem simples das taxas e termos acima.
