---
sidebar_position: 0
title: "Treinamento de MT em Linguagem Simples"
description: "Um glossário sem pré-requisitos do vocabulário necessário para treinar um modelo de tradução — cada termo definido com um exemplo prático, escrito para pessoas que direcionam um agente de codificação."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# Treinamento de MT em Linguagem Simples

Treinar um modelo de tradução automática (MT) tem seu próprio vocabulário, e a maioria dele nunca é explicada para iniciantes — assume-se que você já sabe. Esta página não assume nada. Cada termo abaixo é definido em palavras simples e vinculado a um exemplo concreto, para que quando você leia o [passo a passo de treinamento](/docs/network/tutorials/train-your-own-model) ou veja seu agente de codificação executar um comando, você saiba o que as palavras significam e, mais importante, **quais delas escondem os erros que silenciosamente arruinam os resultados.**

:::info[Para quem é isto]
Você não precisa escrever Python. A forma esperada de fazer este trabalho agora é **dirigir um agente de codificação** — Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, ou similar — que executa as ferramentas para você. Seu trabalho é entender os conceitos bem o suficiente para dar boas instruções e ler os resultados com honestidade. É exatamente para isso que esta página serve. Quando mencionamos uma ferramenta, nos referimos ao [**nmt-forge**](/docs/network/getting-started/training-honestly), o conjunto de treinamento em que essas ideias estão incorporadas; as palavras, porém, são de todo o campo, não apenas nossas.
:::

Um exemplo em execução une a página. Suponha que você queira construir um modelo que traduz **inglês → uma língua de baixo recurso** — chame-a de sua *língua alvo* — para a qual quase nenhum texto traduzido existe. Tudo abaixo é uma parte desse projeto.

---

## 1. As duas pilhas: dados de treinamento e dados de avaliação

**Dados paralelos** são textos emparelhados com sua tradução — o mesmo significado em duas línguas, alinhados sentença por sentença.

> `The children are playing.` → `awâsisak mêtawêwak.`

Um modelo aprende estudando milhares de tais pares. Mas você deve manter os pares em **duas pilhas que nunca se tocam**:

- **Dados de treinamento** — os pares que o modelo *é permitido estudar*. Ele lê esses repetidamente e se ajusta para reproduzi-los.
- **Dados de avaliação** (ou **dados de eval**) — pares que o modelo *nunca é permitido ver durante o treinamento*. Você esconde as traduções, pede ao modelo para traduzir o lado da fonte do zero, e compara sua resposta com a verdade oculta. Esta é a única medida honesta de se ele aprendeu a *traduzir* em vez de *memorizar*.

:::tip[A versão de uma sentença de tudo nesta página]
Um teste só significa algo se o modelo nunca viu as respostas. Quase todo erro abaixo é uma forma diferente de as respostas vazarem da pilha de eval para a pilha de treinamento sem ninguém notar.
:::

### Dados paralelos reais versus sintéticos

- **Dados paralelos reais (ou *gold*)** são feitos por humanos: um livro didático bilíngue, registros governamentais traduzidos por pessoas, histórias arquivadas pela comunidade. São confiáveis, mas para a maioria das línguas, escassos de forma dolorosa — frequentemente apenas algumas centenas de pares de sentenças.
- **Dados paralelos sintéticos** são *fabricados* por um programa em vez de escritos por uma pessoa. Quando você tem apenas 400 pares reais, não pode treinar um modelo utilizável — então você gera centenas de milhares de pares extras a partir de regras (mais sobre como em [§7](#7-manufacturing-data-when-you-dont-have-enough)).

A relação importa enormemente:

> **Exemplo trabalhado.** Um projeto tem 435 pares reais inglês→Cree e fabrica ~1.000.000 sintéticos. O modelo treina na grande pilha sintética *mais* os poucos pares reais. Dados sintéticos compram cobertura; dados reais ancoram o modelo em como a língua é realmente usada. Todo o ofício é (a) fazer a pilha sintética cobrir o máximo possível da língua, e (b) medir apenas em texto real que o modelo nunca tocou.

:::danger[Nunca teste em dados sintéticos]
Um conjunto de avaliação deve ser **apenas dados reais**. Se você testar em sentenças fabricadas, está medindo se o modelo corresponde ao seu *gerador* — não se ele consegue traduzir. Um bom conjunto de treinamento se recusa a registrar linhas sintéticas como um conjunto de teste.
:::

---

## 2. Divisão: train, dev e test

Você começa com uma pilha de pares reais e a **divide** em três papéis.

| Divisão | Também chamado de | Para que serve | O modelo vê isso no treinamento? |
|---|---|---|---|
| **train** | conjunto de treinamento | Os pares que o modelo estuda | Sim |
| **dev** | conjunto de validação, held-in | Decidir *quando parar* e *qual versão é melhor* | Não (apenas *pontuado*, nunca estudado) |
| **test** | held-out, conjunto de avaliação | A nota final honesta | **Nunca** |

Duas ideias se escondem nessa tabela:

- **Held-out** apenas significa "separado e mantido longe do treinamento." Um conjunto de teste é mantido separado propositalmente.
- O **conjunto de dev** é o filho do meio inteligente. O modelo nunca o *estuda*, mas você *espia* como o modelo se sai nele durante o treinamento para tomar decisões — como um exame prático que diz se você deve continuar estudando, sem ser o exame real. Usar o conjunto de dev dessa forma é legítimo; usar o conjunto de *test* dessa forma é trapaça (veja [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Conjuntos selados e re-divisões

- Um **conjunto selado** é um conjunto de teste que pode ser pontuado **exatamente uma vez**. No momento em que você vê sua pontuação nele, está "gasto" — porque uma vez que você sabe o número, toda decisão posterior que você toma é sutilmente moldada por ele. Conjuntos selados são como competições e comunidades mantêm uma nota final verdadeiramente final.
- Uma **re-divisão** é quando você reconstrói a divisão train/dev/test do zero — geralmente porque você descobriu que a divisão antiga estava contaminada. Você não pode corrigir uma divisão com vazamento deletando algumas linhas; você reagrupa tudo e corta novamente ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) explica por quê).

---

## 3. O que o "treinamento" realmente faz: perda e suas duas faces

Treinamento é um loop. O modelo faz uma previsão, vê o quão errado estava, e ajusta seus números internos para estar um pouco menos errado na próxima vez — milhões de vezes.

**Perda** é o número único que mede "quão errado." Menor é melhor. Mas há *duas* perdas, e confundi-las é uma armadilha clássica:

- **Perda de treinamento** — quão errado o modelo está nos pares que está estudando ativamente. Isso quase sempre continua caindo, porque o modelo pode, no limite, simplesmente *memorizar* os pares de treinamento.
- **Perda de dev** (perda de validação) — quão errado o modelo está no conjunto de dev retido que *não* está estudando. Este é o sinal honesto. Quando a perda de dev para de melhorar enquanto a perda de treinamento continua caindo, o modelo parou de *aprender a língua* e começou a *memorizar o conjunto de treinamento*.

> **Exemplo trabalhado.** Depois de um tempo você vê perda de treinamento em 0,8 e caindo, mas perda de dev presa em 1,9 e subindo *para cima*. Essa lacuna é o indicador: o modelo está ficando melhor em recitar seus pares de treinamento e não melhor — até pior — em traduzir qualquer coisa nova.

### Perda é um proxy. Decodificação é a coisa real.

Aqui está uma sutileza que engana quase todos. Perda mede se o modelo atribui alta probabilidade à próxima palavra correta *quando a resposta correta já está na sua frente*. Isso **não** é o mesmo que o modelo realmente produzir uma boa tradução por conta própria.

- **Decodificação** (também *geração* ou *inferência*) é o modelo **realmente traduzindo**: dado apenas a sentença de origem, ele emite uma sentença alvo palavra por palavra, sem nada para se apoiar.
- **Perda** é um *proxy* barato computado durante o treinamento. Correlaciona com qualidade, mas imperfeitamente.

> **Exemplo trabalhado.** Dois checkpoints têm perda de dev quase idêntica, mas quando você *decodifica* as sentenças de dev e pontua as traduções reais, uma é claramente mais fluente. Perda não conseguiu ver essa diferença; decodificação conseguiu. É por isso que a seleção séria de checkpoint decodifica o conjunto de dev e pontua a saída real, em vez de confiar apenas em perda.

:::note["A perda de dev rastreia qualidade?" é uma questão aberta, não folclore]
Você ouvirá afirmações confiantes de que "perda de eval mente." Trate isso como **indeterminado**, não provado — muito desse folclore veio de experimentos contaminados. A posição honesta: perda de dev é um sinal útil e barato; uma métrica de **geração de dev** (decodificar, depois pontuar) é uma mais direta. Prefira a direta para decisões finais, e não repita "perda mente" como um fato.
:::

---

## 4. Contaminação e vazamento: o erro que come resultados

**Contaminação** (ou **vazamento**) significa que respostas de eval secretamente terminaram na pilha de treinamento. O modelo então "acerta o teste" por memória, sua pontuação parece ótima, e o resultado é inútil. Esta é a forma mais comum de resultados de MT de baixo recurso se tornarem falsos — e a coisa mais importante que toda esta página está avisando você.

A forma clássica e sorrateira é um **par mínimo com alvo compartilhado**:

> **Exemplo trabalhado — "Feed him" / "Feed her".** Um livro didático de língua mapeia muitos exercícios diferentes em inglês para **uma** palavra alvo. *"Feed him"* e *"Feed her"* ambos traduzem para a mesma forma, `asam`. Uma divisão aleatória ingênua coloca *"Feed him"* → `asam` em **treinamento** e *"Feed her"* → `asam` no **conjunto de teste**. A resposta alvo, `asam`, agora está em ambas as pilhas. O modelo memorizou `asam` do treinamento e "acerta" no teste — mas não aprendeu nada. Em um projeto real, 17 de 54 linhas de "teste" vazaram dessa forma, e essas linhas pontuaram **83** na métrica de qualidade versus **44** para linhas limpas. Cada descoberta construída sobre esse número teve que ser descartada.

Vazamento tem várias faces, e uma **auditoria de vazamento** adequada verifica todas elas:

- **Sobreposição exata** — a mesma origem *ou* o mesmo alvo aparece em ambos os lados (o exemplo acima).
- **Sobreposição de quase-duplicata** — não idêntica, mas uma versão *reformulada* de uma sentença de teste fica em treinamento. Documentos do mesmo domínio compartilham paráfrases; correspondência exata perde essas, então auditorias também medem similaridade de sobreposição de palavras.
- **Sobreposição de arquivo inteiro** — alguém acidentalmente treinou em uma cópia do próprio arquivo de teste. (Isso realmente acontece: uma colheita de "treinamento" se mostrou *ser* o livro didático gold, 489 de 489 linhas correspondendo.)

### Divisão disjunta por grupo — a solução

Você não pode corrigir vazamento deletando as linhas ofensivas uma por uma; o padrão apenas reaparece. A solução é **divisão disjunta por grupo**: antes de dividir, amarre cada par que compartilha uma origem *ou* um alvo em um **grupo**, depois envie cada *grupo inteiro* para exatamente um lado. Agora `asam` e tudo que o compartilha vive inteiramente em train *ou* inteiramente em test — nunca ambos. Após o corte, você **verifica sobreposição zero** e se recusa a prosseguir se alguma permanecer.

:::tip[Isto é o que "o split-guard" faz por você]
Quando seu agente executa o divisor, ele faz divisão disjunta por grupo por padrão e verifica sobreposição zero automaticamente. Você não precisa se lembrar da armadilha "Feed him / Feed her" — a ferramenta torna cometê-la difícil, e se você contorná-la, ela se recusa com uma mensagem nomeando a solução.
:::

---

## 5. Overfitting, parada antecipada e o platô

**Overfitting** é o que acontece quando um modelo continua estudando além do ponto de aprendizado e começa a *memorizar*. Sua perda de treinamento parece maravilhosa; sua qualidade real de tradução piora. A lacuna de perda de [§3](#3-what-training-actually-does-loss-and-its-two-faces) é como você a detecta.

**Parada antecipada** é a defesa: observe o sinal de dev, e quando ele para de melhorar por um número definido de verificações (sua **paciência**), pare o treinamento e mantenha a versão anterior melhor — o melhor **checkpoint** (um instantâneo salvo do modelo no meio do treinamento). Parada antecipada previne computação desperdiçada e overfitting ao mesmo tempo.

Mas parada antecipada tem um modo de falha famoso quando você treina principalmente em dados sintéticos — o **platô de transferência sintético→real**:

> **Exemplo trabalhado — a morte de meio-epoch.** Um modelo treina em uma mistura que é 97,5% sintética e é julgado em um conjunto de dev *real* de 42 sentenças. No início, o modelo rapidamente fica bom na massa sintética, então a perda de dev nas sentenças reais cai rápido, toca fundo por volta do passo 8.000 — depois flutua *para cima*. Parada antecipada ingênua vê "perda de dev subiu por 6 verificações seguidas" e declara vitória no epoch 0,52, um vigésimo do treinamento planejado. Mas o modelo não estava pronto; havia apenas terminado o aprendizado sintético *fácil* e ainda não havia começado a lenta **transferência** para qualidade de linguagem real. Foi parado no platô, antes do retorno.

A lição: com uma mistura pesada em sintético, um *cedo* dip-and-rise em perda de dev é **esperado**, não convergência. A regra de parada tem que ser inteligente o suficiente para manter o treinamento através do platô — um piso derivado do tamanho de sua mistura, não um número mágico que você deveria saber.

:::note[Configurações honestas expõem bugs reais]
Esse bug de platô foi invisível por meses — porque execuções anteriores (ilegitimamente) usaram o conjunto de *teste* como seu conjunto de dev, o que o escondeu. A primeira execução *limpa* é o que o expôs. Este é o tema recorrente: fazer isso honestamente não apenas o mantém veraz, torna problemas reais visíveis.
:::

---

## 6. Medindo qualidade: métricas, baterias, registros

Quando o modelo *decodifica* uma sentença de teste, como você pontua sua resposta contra a tradução de referência?

### Métricas de crédito parcial: chrF++ e BLEU

Uma tradução raramente é exatamente a referência palavra por palavra, mas pode ser perfeitamente boa. Então MT usa **métricas de crédito parcial** que recompensam *sobreposição* em vez de exigir uma correspondência exata:

- **chrF++** pontua sobreposição de **sequências de caracteres** (mais algumas sequências de palavras) entre a saída do modelo e a referência. Porque funciona no nível de caractere, dá crédito parcial por acertar uma palavra *quase* certa — a raiz correta com um final errado ainda ganha algo. Isso a torna bem adequada para línguas morfologicamente ricas, onde uma raiz toma muitas formas. Maior é melhor; geralmente é relatada em uma escala 0–100.
- **BLEU** é o padrão mais antigo. Pontua sobreposição de **chunks de palavra inteira** (n-gramas). Ainda é amplamente relatado, mas é duro em línguas onde palavras têm muitas formas flexionadas, porque um quase-erro em um final conta como um erro completo.

> **Exemplo trabalhado.** Referência: `awâsisak mêtawêwak`. Saída do modelo:
> `awâsisak mêtawêw` (raiz correta, sílaba final errada). BLEU vê a segunda palavra como simplesmente errada. chrF++ vê que a maioria dos caracteres corresponde e concede crédito parcial. Mesma saída, pontuação muito diferente — é por isso que a métrica que você escolhe muda a história.

:::tip[Qual métrica acreditar é uma questão medida]
Nem toda métrica rastreia julgamento humano igualmente para cada língua. Para algumas famílias BLEU mal correlaciona com o que humanos pensam; para outras uma métrica neural sofisticada é a não confiável. Antes de otimizar em direção a *qualquer* métrica, verifique a evidência de [Confiabilidade de Métrica](/docs/network/specifications/metric-reliability) para sua família de línguas — e se a resposta honesta é "não medida," diga isso em vez de confiar em um número.
:::

### Métricas neurais: COMET, MetricX

Além de sobreposição de caractere/palavra, **métricas neurais** (COMET, COMET-QE, MetricX) usam um modelo treinado para *julgar* traduções mais como um humano faria. Podem ser muito mais confiáveis — mas apenas para línguas que foram treinadas para julgar, o que exclui a maioria das de baixo recurso. Elas também funcionam dependentemente de direção: **MetricX** é **menor-é-melhor**, o oposto de chrF++ — um detalhe que vale a pena saber antes de comparar números.

### Barras de erro: nunca confie em um número

Um único score sem incerteza é uma armadilha. Em conjuntos de teste pequenos, diferenças são frequentemente apenas ruído.

> **Exemplo trabalhado.** "O modelo melhorou de 16,7 para 18,1 no conjunto de histórias orais" soa como progresso — até você notar que o conjunto tem 37 sentenças. Com tão poucos dados, uma oscilação de ±3 pontos é pura chance. O relatório honesto é `17.4 [15.1, 19.8] 95% CI`: o número, mais o **intervalo de confiança (CI)**
> — o intervalo em que o valor verdadeiro plausivelmente cai. Se os intervalos de dois modelos se sobrepõem muito, você não pode afirmar que um é melhor.

Boas ferramentas se recusam a imprimir uma pontuação sem seu CI, e usam um [teste de significância](/docs/network/specifications/significance) antes de declarar uma vitória A-bate-B.

### Baterias e registros

Linguagem real não é uma coisa plana. Um **registro** (ou **domínio**) é um *tipo* de linguagem: conversa casual, um exercício de livro didático, um artigo de notícia, uma história oral, prosa governamental formal. Um modelo pode ser ótimo em um e pobre em outro.

Uma **bateria** é um conjunto de avaliação deliberadamente dividido em vários registros, pontuado **separadamente**, para que uma média única não possa esconder uma fraqueza.

> **Exemplo trabalhado.** Um modelo pontua 46 no geral — respeitável. Mas o detalhamento da bateria mostra 58 em exercícios de livro didático e 22 em histórias orais. A média estava mascarando um fracasso quase total em fala natural. Apenas a bateria por registro o revelou.

---

## 7. Fabricando dados quando você não tem o suficiente

Quando pares reais são escassos, você fabrica sintéticos. Duas técnicas dominam, e ambas vivem ou morrem em uma palavra: **verificação**.

### FSTs e analisadores morfológicos

Um **analisador morfológico** é uma ferramenta que conhece a gramática de palavras de uma língua: como raízes se combinam com prefixos e sufixos para fazer palavras válidas. Muitos são construídos como **FSTs** — *transdutores de estado finito*, uma tecnologia precisa e baseada em regras (não uma rede neural) que pode funcionar em duas direções:

- **analisar**: dada uma palavra, quebrá-la em raiz + tags gramaticais
  (`nipâw` → "dormir, terceira pessoa singular").
- **gerar**: dada uma raiz + tags, soletrar a forma correta da palavra
  (`sleep + 3sg` → `nipâw`).

Para uma língua polissintética — onde uma única palavra pode carregar o que o inglês precisa de uma sentença inteira — um FST é ouro: pode soletrar *qualquer* forma válida de *qualquer* raiz conhecida, que é exatamente a matéria-prima para fabricar dados de treinamento.

### Verificação de ida e volta — a regra que torna dados sintéticos confiáveis

Fabricar dados é perigoso: um gerador pode silenciosamente emitir absurdos. A disciplina que previne isso é a **lei de ida e volta**: cada palavra fabricada deve sobreviver a *gerar → analisar → mesma análise que você começou*. Se você pedir ao FST para soletrar uma forma e depois alimentar esse soletro de volta e não obter suas tags retornadas, a palavra é descartada. Nada que falhe na ida e volta é jamais permitido nos dados de treinamento.

> **Exemplo trabalhado — o vazamento de um caractere.** Um dicionário soletrou um som com a letra `ý`; o analisador esperava `y` simples. Porque ninguém reconciliou os dois soletros na fronteira, *1.375 verbos* foram silenciosamente julgados "desconhecidos" e descartados da geração — por semanas, invisível. A solução é um **canonicalizador**: uma função que normaliza soletro para uma convenção única *em todo lugar* dois componentes se encontram, mais uma **auditoria de funil** que conta quantos itens sobrevivem cada estágio de pipeline para que uma queda silenciosa de 1.375 itens nunca possa se esconder novamente.

### Cobertura, não apenas volume

Um milhão de sentenças fabricadas soam abrangentes. Não são, se forem um milhão de variações das mesmas poucas formas.

> **Exemplo trabalhado.** Um corpus sintético de 1.000.000 pares se mostrou conter **nenhum imperativo** ("Vote!"), **nenhuma pergunta-wh** ("who/where/when"), **nenhuma posse** ("meu cachorro"), e **nenhuma forma inversa** ("ela me vê" — gramática central em muitas línguas). O analisador podia gerar todos eles; os templates apenas nunca perguntaram. Volume escondeu um buraco estrutural.

A defesa é uma **lista de verificação de cobertura** transcrita de uma gramática publicada: os fenômenos gramaticais necessários, cada um citado, para que a construção falhe se um necessário tiver zero exemplos. E um **limite por tipo** impede que qualquer forma de template domine — em um corpus, duas formas eram 54% dos dados, então metade da "experiência" do modelo era dois padrões de sentença.

### Backtranslation

**Backtranslation** é a outra grande técnica sintética, e é inteligente. Se você tem texto simples, *não traduzido* em sua língua alvo (um corpus **monolíngue** — muito mais fácil de encontrar que texto paralelo), você pode:

1. pegar um modelo *reverso* (alvo → inglês),
2. traduzir automaticamente seu texto alvo monolíngue *para* inglês,
3. emparelhar cada sentença inglês-máquina com a sentença alvo **real** que você começou, e
4. treinar seu modelo direto (inglês → alvo) nesses pares.

O lado alvo é linguagem genuína; apenas o lado inglês é sintético — geralmente um bom negócio.

> **Exemplo trabalhado.** Você tem 50.000 sentenças reais em sua língua alvo mas apenas 400 pares paralelos. Backtraduz os 50.000 para inglês aproximado, e você transformou texto monolíngue em 50.000 pares de treinamento cujo lado *alvo* é autêntico.

:::danger[Auditoria de vazamento em seu texto monolíngue também]
Backtranslation parece seguro porque "é apenas texto monolíngue" — mas esse texto pode *ser* seus dados de eval disfarçados. Em um projeto a auditoria de vazamento pegou uma colheita monolíngue que correspondia exatamente ao conjunto de teste gold. Audite **cada** entrada contra **cada** conjunto de eval, sintético e monolíngue incluído — não apenas seu corpus paralelo óbvio.
:::

### Marcando dados sintéticos

Uma última prática: **marque** fontes sintéticas com um marcador (como `<synth>` ou `<bt>`) e deixe dados reais (gold) sem marcar. Isso deixa o modelo dizer "material de prática" de "a coisa real," para que os dados autênticos ancorem seu estilo de saída; no tempo de tradução você não adiciona a marca, e o modelo se apoia no que aprendeu de gold. (Veja o [Livro de receitas de Back-Translation](/docs/network/tutorials/back-translation) para esta técnica em profundidade.)

---

## 8. Como as peças se conectam

Leia de cima para baixo, este é um fluxo de trabalho:

1. Reúna **dados paralelos reais** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — geralmente muito pouco.
2. **Divida** disjunto por grupo em train / dev / test ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Fabrique** dados sintéticos para preencher a lacuna — verificados de ida e volta, verificados de cobertura, auditados de vazamento ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Treine** na mistura, observando **perda de dev / geração de dev** para evitar **overfitting** e sobreviver ao **platô** ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Decodifique** a **bateria de teste** retida e pontue-a com **métricas de crédito parcial + intervalos de confiança**, por **registro** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Faça tudo isso sem jamais deixar respostas de eval tocarem treinamento ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — a regra que as outras cinco servem.

Cada regra aqui corresponde a um erro real, medido, que um projeto real cometeu e documentou. Você não precisa memorizá-las: o conjunto de treinamento mecaniza cada uma para que o caminho honesto seja o padrão e os caminhos desonestos se recusem com uma explicação. Este é o assunto da próxima página.

## Dirigindo seu agente com este vocabulário

Porque você estará trabalhando através de um agente de codificação, o retorno prático desta página é que você agora pode dar — e verificar — instruções como estas:

- *"Divida o corpus disjunto por grupo e verifique sobreposição zero antes de treinar."*
- *"Corte um conjunto de dev do lado de treinamento; nunca selecione checkpoints no conjunto de teste."*
- *"Auditoria de vazamento em cada entrada contra cada conjunto de eval, incluindo dados sintéticos e monolíngues."*
- *"Relate chrF++ com intervalos de confiança de 95%, divididos por registro."*
- *"Verifique confiabilidade de métrica para esta família de línguas antes de otimizarmos em direção a qualquer pontuação."*

Se seu agente tem o servidor Champollion MCP disponível, ele pode chamar
`get_training_guardrails` para puxar essas regras — e o erro que cada uma mata — diretamente em seu contexto antes de escrever um único comando.

**Próximo:** coloque em prática em
[**Então Você Quer Treinar Seu Próprio Modelo**](/docs/network/tutorials/train-your-own-model),
o passo a passo — ou leia
[**Treine um Modelo Honestamente**](/docs/network/getting-started/training-honestly)
para como o conjunto transforma cada conceito aqui em um guardrail automático.

Se termos como *tokenizer* ainda estão pouco claros, o guia básico do zero é [Tokenizers](/docs/learn/tokenizers) — leia-o uma vez e tudo acima ficará mais fácil.
