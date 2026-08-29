---
title: "Como um tokenizer decide quais idiomas são baratos"
sidebar_label: "Tokenizers"
description: "Antes que um modelo de linguagem leia uma palavra, algo a divide em pedaços. Essa etapa é aprendida a partir de dados, otimiza a compressão em vez do significado e decide silenciosamente quais idiomas são caros para usar. Uma introdução para quem está começando do zero."
---

# Como um tokenizador decide quais idiomas são baratos

:::info[Para quem é isso]
Qualquer pessoa. Esta página não pressupõe conhecimento prévio em aprendizado de máquina nem
em linguística. Se você sabe o que é um modelo de linguagem — um software que recebe texto e
produz texto —, isso é o suficiente.
:::

Todo modelo de linguagem tem uma primeira etapa invisível. Antes de ler uma palavra, um
software corta essa palavra em fragmentos. Os fragmentos são o que o
modelo realmente vê.

Essa etapa é chamada de **tokenização**, e quase ninguém presta atenção nela. Vale a pena
observá-la, porque é o ponto em que alguns idiomas se tornam várias vezes
mais caros de usar do que outros — e a decisão é tomada antes mesmo de alguém
pensar em qualidade, justiça ou cobertura.

---

## 1. Um modelo não sabe ler

Uma rede neural faz aritmética com números. Ela não tem noção de letras ou
palavras. Portanto, o texto precisa se transformar em números primeiro.

Um **tokenizador** é o software que faz essa conversão e a reverte
no final. Ele transforma uma string em uma lista de números inteiros, com cada inteiro apontando
para uma linha em uma grande tabela de pesquisa.

Ele toma duas decisões:

**O vocabulário** — o inventário fixo de peças que o modelo tem permissão para ver.
Não palavras: *peças*. As mais comuns são palavras inteiras, mas materiais mais raros são
fragmentados. O inventário tem um tamanho fixo, escolhido com antecedência — muitas vezes dezenas de
milhares de entradas.

**A segmentação** — para qualquer string real, quais peças, em qual ordem. A
palavra *unbelievable* pode se tornar `un` + `believ` + `able`, ou uma única peça, ou
onze letras individuais. O resultado depende inteiramente do que está no
vocabulário.

> **Exemplo prático.** Se `believ` estiver no vocabulário, *unbelievable* custa
> três peças. Se não estiver, o tokenizador recorre a fragmentos cada vez
> menores até conseguir cobrir a palavra — possivelmente uma peça por letra. Mesma
> palavra, mesmo significado, três vezes mais peças ou onze vezes mais peças,
> dependendo de uma decisão tomada muito antes de você digitá-la.

---

## 2. O vocabulário é *aprendido*, e ele otimiza a coisa errada

Aqui está a parte que surpreende as pessoas.

O vocabulário não é projetado por um linguista. Ele é **aprendido a partir de uma pilha de
texto**, por um algoritmo cujo objetivo é a **compressão** — cobrir esse texto com o
menor número possível de peças.

O significado não tem nenhum papel. O algoritmo não faz ideia do que é uma palavra, o que é um prefixo
ou que um idioma existe. Ele conta o que ocorre junto com frequência e dá
às sequências frequentes sua própria entrada porque isso torna o texto mais curto.

A consequência segue de forma mecânica. As peças são alocadas a um idioma aproximadamente
na proporção de **quanto desse idioma estava na pilha**. Um idioma que
representou uma grande parcela recebe muitas peças dedicadas, e suas palavras saem inteiras
ou quase inteiras. Um idioma que quase não apareceu não recebe quase nenhuma peça
própria, e suas palavras são cobertas por quaisquer fragmentos genéricos que por acaso se encaixem.

Um idioma que não estava na pilha recebe **zero** peças dedicadas. Ele
ainda funciona — o tokenizador sempre encontrará *alguma* maneira de representar o texto,
porque pode recorrer a caracteres individuais ou bytes brutos. Apenas custa
muito mais caro dizer qualquer coisa.

:::note[Isso não é um bug]
Nada funcionou mal. O algoritmo de compressão fez exatamente o que lhe foi
pedido. O problema é que "tornar o texto de treinamento curto" foi aceito como um
substituto para "representar bem o idioma", e para idiomas ausentes desse texto o
substituto falha completamente.
:::

---

## 3. Fertilidade: o número que dá nome ao dano

**Fertilidade** é o número médio de tokens que uma palavra custa.

Para um idioma no qual o tokenizador foi amplamente treinado, a fertilidade é próxima de 1 —
a maioria das palavras é uma única peça. Para um idioma que ele nunca viu, a mesma medida pode
ser muitas vezes maior, porque cada palavra precisa ser montada a partir de fragmentos.

Esse único número se desdobra em quatro taxas separadas:

| Taxa | O que significa |
|---|---|
| **Custo** | A maioria dos modelos comerciais cobra por token. Mais tokens por palavra significa que a mesma frase custa mais dinheiro para ser traduzida, resumida ou gerada. |
| **Contexto** | Os modelos têm uma janela fixa. Alta fertilidade significa que menos do seu documento real cabe nela. |
| **Computação** | Sequências mais longas são mais lentas, em qualquer lugar, para sempre. |
| **Aprendizado** | A mais difícil. O significado agora está espalhado por muitos fragmentos de baixa informação, então o modelo tem um problema mais difícil para resolver — mesmo com dados idênticos. |

As três primeiras são injustas. A quarta é a que prejudica a qualidade.

**Isso é medido, não presumido.** Petrov, La Malfa, Torr e Bibi descobriram que
o mesmo texto, traduzido para diferentes idiomas, pode diferir no comprimento
tokenizado em **até 15 vezes**, e que a disparidade persiste em tokenizadores
construídos deliberadamente para uso multilíngue.

A descoberta deles complica a correção óbvia: modelos em nível de caractere e de byte
— a resposta intuitiva, "basta usar letras, então todos os idiomas são iguais" —
ainda mostraram **mais de 4 vezes** a diferença para alguns pares de idiomas. Recorrer
a unidades menores diminui a lacuna. Mas não a fecha.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Por que isso atinge alguns idiomas estruturalmente, não apenas estatisticamente

A sub-representação na pilha de treinamento é uma das causas. Há uma segunda, e
ela não desaparece adicionando dados.

Os idiomas diferem na quantidade de trabalho que uma única palavra realiza.

Em inglês, uma frase é composta principalmente por palavras separadas em sequência: *I saw them*. Três
palavras, três conceitos, espaço em branco entre elas. Os tokenizadores foram construídos por pessoas
que trabalham em idiomas que se comportam dessa maneira, e eles presumem isso — a maioria deles
literalmente trata um espaço como um limite de peça.

Outros idiomas constroem uma oração inteira em **uma palavra**, empilhando partes
significativas juntas. Os linguistas chamam esses idiomas de **polissintéticos**, e eles são
comuns entre os idiomas indígenas das Américas e de outros lugares.

> **Exemplo prático.** Em Cree das Planícies (nêhiyawêwin), *nikî-wâpamâwak* significa
> aproximadamente "Eu os vi". É uma palavra. Dentro dela há várias partes significativas:
> quem está agindo, que a ação está no passado, o próprio ato de ver e quem está
> sendo visto.
>
> Um falante de inglês usa quatro palavras para isso, e um tokenizador treinado em
> inglês provavelmente gastará quatro peças. Um tokenizador que nunca viu o Cree
> não tem entrada para nenhuma dessas partes, então ele tritura a palavra única em
> fragmentos que não respeitam nenhum dos limites que carregam o significado.

Duas coisas são quebradas de uma vez. A palavra custa muito mais peças do que deveria —
e as peças **cortam as unidades de significado**, então o modelo precisa
remontar uma estrutura que o tokenizador acabou de destruir.

Adicionar mais texto em Cree à pilha de treinamento melhora o primeiro problema. Isso ajuda
apenas parcialmente no segundo, porque o algoritmo ainda está otimizando a compressão,
e a compressão não sabe que um limite é significativo.

---

## 5. Da tokenização a uma resposta errada

A cadeia de "segmentação ruim" para "saída errada" é curta.

1. O tokenizador quebra uma palavra em limites que não carregam nenhum significado.
2. O modelo aprende associações mais fracas, porque o mesmo conceito aparece sob
   muitas grafias de fragmentos diferentes em vez de uma peça consistente.
3. Ao gerar, o modelo monta a saída fragmento por fragmento.
4. Fragmentos que são individualmente plausíveis podem se combinar em uma palavra que **não
   existe** no idioma.

Esse último passo é o que devemos ter em mente. Em um idioma onde as palavras são construídas a partir de
partes, um modelo pode produzir algo que parece bem formado para quem não
o fala — peças com aparência correta, montadas em uma palavra que nenhum falante
jamais diria.

A pontuação automática padrão muitas vezes não detectará isso, porque essas pontuações medem principalmente
a sobreposição com uma resposta de referência, e uma palavra errada feita de fragmentos com aparência correta
ainda pode se sobrepor.

:::danger[Por que isso importa além das pontuações de qualidade]
Uma saída que é fluente e errada é mais perigosa do que uma que está obviamente
quebrada. Um leitor que não fala o idioma não tem como saber. Isso é grande
parte do motivo pelo qual o Champollion insiste na validação por pessoas que falam o
idioma, e em verificações estruturais que perguntam "isso é uma palavra real?" em vez de
apenas "isso se assemelha à resposta esperada?"
:::

---

## 6. Quem decide, e por que esse é o verdadeiro ponto

Tudo o que foi dito acima decorre de uma escolha: **qual texto entrou na pilha com a qual o
tokenizador aprendeu.**

Quem faz essa escolha decide como cada idioma será cortado, quanto
custará para usá-lo e o quão duro o modelo terá que trabalhar para representá-lo. Essa
decisão é tomada uma vez, logo no início, geralmente por um pequeno grupo, e é efetivamente
permanente para a vida útil desse modelo — o tokenizador não é algo que você possa
ajustar depois.

Isso também quase nunca é discutido. Os debates sobre tecnologia de linguagem tendem a ser
sobre dados, tamanho do modelo e pontuações de qualidade. A etapa que decide se um
idioma é sequer representável fica abaixo de tudo isso e é tratada como
encanamento.

É por isso que esta página existe. Se uma comunidade deseja controle genuíno sobre como seu
idioma é tratado por máquinas, controlar os dados não é suficiente. A
pergunta *"quem decidiu como nossas palavras são cortadas em peças?"* tem uma resposta, e
para a maioria dos idiomas do mundo essa resposta atualmente é: outra pessoa, como um
efeito colateral da compressão de uma pilha de texto que mal continha o idioma.

---

## Para onde ir a seguir

- [O que é o Champollion](/docs/what-is-champollion) — o projeto ao qual esta página pertence e o que ele faz a respeito do que foi dito acima.
- [Como os modelos são treinados](/docs/network/context/mt-training-concepts) — o vocabulário para a etapa *após* a tokenização, com a mesma abordagem de começar do zero.
- [Limitações Honestas](/docs/network/honest-limitations) — o que este projeto **não** afirma.
- [Gestão de Dados](/docs/network/sovereignty/data-sovereignty) — quem detém as chaves de um corpus e o que isso significa na prática.
