---
sidebar_position: 7
title: "Intensidade da conexão"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Força da Conexão

Quando o mapa de rede desenha um arco entre dois idiomas, sua cor responde
a uma pergunta: **esse par foi realmente medido?**

Isso é deliberadamente menos do que o mapa costumava alegar. Até 04/09/2026, um arco
era colorido por uma escala gradual de força em cinco níveis — quão *boa* era a
melhor tradução, em uma escala corrigida pelo acaso. Essa escala gradual foi descontinuada. Esta página
explica o número por trás dela, por que removê-la foi a decisão mais honesta
e o que o mapa mostra agora.

## O problema: pontuações brutas não são zero no zero

A maioria das nossas pontuações é **chrF++** (F-score de n-gramas de caracteres, [Popović
2017](https://aclanthology.org/W17-4770/)) — mede quanto os caracteres e palavras de uma
tradução se sobrepõem com uma tradução de referência, de 0 a 100.

Mas *texto aleatório não é zero*. Todo sistema de escrita oferece alguma sobreposição "de graça": uma ortografia com poucos caracteres distintos, ou palavras longas previsíveis, pontua visivelmente acima de zero mesmo quando a "tradução" é sem sentido. Essa sobreposição gratuita — o **piso de chance** — difere por idioma. Em nossas medições varia de cerca de 1,6 (escrita chinesa) para mais de 13 (alguns idiomas com escrita latina e árabe). Um chrF++ bruto de 14 é ruído próximo ao aleatório em um idioma e um sinal real em outro — então chrF++ bruto **não é comparável entre idiomas**, e um mapa colorido por ele favoreceria silenciosamente alguns sistemas de escrita.

Esse problema é real, e é por isso que o mapa **não** classifica a força entre
diferentes idiomas. Não é um problema que resolvemos.

## A correção que criamos e por que ela não colore mais o mapa

O **chrF++ corrigido pelo acaso (cchrF++)** reescala uma pontuação para que 0 signifique "não
melhor que o acaso" *nesse idioma* e 1 signifique perfeito:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Os pisos são medidos, não presumidos: para cada idioma, executamos uma estimativa
de Monte Carlo — milhares de linhas de base aleatórias com a mesma ortografia pontuadas contra
referências reais — usando apenas texto monolíngue disponível publicamente (FLORES-200 dev,
obtido da fonte, nunca redistribuído). A tabela de pisos abrange 196
idiomas e é um artefato derivado do Champollion.

**O que essa correção genuinamente estabelece.** O piso de acaso existe, varia
em quase nove vezes entre sistemas de escrita e pode ser estimado a partir de texto
monolíngue sem nenhum rótulo humano de qualidade. Subtraí-lo comprovadamente remove
o componente de acaso de linhas de base triviais: uma trapaça de "copiar a fonte" que
obtém mais de 15 pontos brutos em finlandês cai para cerca de 2,5 e, na maioria dos idiomas, para exatamente
zero. O "acaso" removido são estatísticas de superfície, não significado residual.

**O que ela não estabelece.** Ela faz com que **0** signifique a mesma coisa em cada
idioma. Ela não faz com que **40** signifique a mesma coisa. Acima do piso, a
correção é um reescalonamento direto, e a evidência de que uma *qualidade* igual
resulte em pontuações corrigidas iguais entre diferentes idiomas é demonstrada apenas na
base do intervalo. Em comparação com conjuntos de avaliações humanas, ela ajuda onde os
pisos genuinamente diferem, não faz nada onde não diferem e, em um conjunto com
pisos uniformemente baixos, moveu a concordância com avaliadores humanos na direção *errada* — um
resultado que ainda não resolvemos.

Colorir um mapa público com uma escala de força em cinco níveis afirmava mais do que essa
evidência sustenta, exatamente nos idiomas de baixos recursos onde errar
é mais crítico. Portanto, a escala gradual foi descontinuada até que estudos adicionais esclareçam a questão.

Observe que colorir pelo chrF++ **bruto** nunca foi uma opção: pontuações brutas
não são comparáveis entre idiomas de forma alguma, o que foi o motivo de criarmos
a correção. Uma codificação binária é a alternativa honesta, não um
rebaixamento para algo inferior.

## Onde a medição se posiciona na hierarquia

Do mais confiável ao menos confiável:

1. **Verificação humana** — falantes fluentes avaliando o resultado ([validação
   por falantes](/docs/network/specifications/speaker-validation)). Nada
   automático a supera.
2. **Anotação de especialistas no estilo MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — o
   protocolo que o WMT usa para seus julgamentos de referência; caro, raro, excelente.
3. **Pontuações automáticas — apenas dentro de um mesmo par de idiomas.** chrF++ bruto, BLEU,
   COMET e os demais são úteis para comparar sistemas no *mesmo* par;
   consulte [Confiabilidade das Métricas](/docs/network/specifications/metric-reliability)
   para ver o quão mal cada uma pode acompanhar a avaliação humana no seu par.
4. **Força entre idiomas.** Não publicamos um ranking. Veja acima.

Conforme resultados verificados por humanos e de qualidade MQM entram no quadro, eles têm
precedência sobre pontuações automáticas para o mesmo par.

## Como o mapa desenha isso

Cada canal visual carrega exatamente um significado:

| Canal | Significado |
|-------|-------------|
| **Cor** | medido. Uma única cor, sem gradiente — o arco indica que uma execução pontuou esse par, e nada sobre o quão bem |
| **Tracejado + esmaecido** | provisório: o conjunto de testes está abaixo do [piso de significância](/docs/network/specifications/significance) (n &lt; 100), onde variações de pontuação dentro de ~5 chrF++ são ruído. Essa é uma propriedade do tamanho da amostra, independente de qualquer métrica |
| **Largura** | constante. Não há mais nada a codificar |

Apenas pares **medidos** desenham um arco medido. Pares registrados — na fila
para medição, mas ainda não pontuados — aparecem como linhas finas de cor sólida e
suave cuja cor indica apenas *como o par é alcançável hoje*
(API comercial · modelo de código aberto · frontier, sem provedor), nunca quão
bem algo traduz. Os dois vocabulários são deliberadamente separados:
traços suaves e sólidos = alcançabilidade, a cor única de medição = medido.
A pontuação subjacente de um arco é a melhor execução medida para esse par no
painel público, atualizada automaticamente à medida que novas execuções chegam, e é exibida como um
número dentro do par quando você abre o arco — nunca como uma classificação entre idiomas.

## A letra miúda

- Os pisos de acaso são propriedades métrica × ortografia estimadas apenas a partir
  de texto monolíngue; nenhum conteúdo de corpus paralelo é utilizado ou armazenado.
- O atlas de pisos e a correção continuam sendo pesquisas publicadas, e o código
  permanece no repositório em testes. Eles não estão conectados a nenhuma interface pública.
- **Ela corrige o piso, não o teto.** O quão alto uma tradução genuinamente
  boa pode pontuar ainda varia por idioma, e a correção não
  muda nada quanto a isso.
- **Não é uma defesa contra cópia de escrita compartilhada.** Uma saída que simplesmente
  copia o texto de origem ainda pode pontuar acima do acaso quando a origem e o destino compartilham
  um sistema de escrita.
- **Não pode reordenar sistemas dentro de um mesmo par de idiomas.** Acima do piso, a
  correção é um reescalonamento direto, de modo que as classificações dentro do par são idênticas
  antes e depois — seu único valor possível era entre pares distintos.
- Um arco medido informa que um par foi pontuado. Ele **não** valida
  significado, registro ou adequação cultural. Esses continuam sendo julgamentos humanos ([limitações
  honestas](/docs/network/honest-limitations)).
- A metodologia de piso de acaso é uma pesquisa do Champollion, publicada aqui
  justamente para que possa ser verificada e questionada.
