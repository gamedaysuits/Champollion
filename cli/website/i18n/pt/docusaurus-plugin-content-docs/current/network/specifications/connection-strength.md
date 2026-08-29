---
sidebar_position: 7
title: "Força da Conexão (cchrF++)"
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
uma pergunta: **qual é a qualidade da melhor tradução medida entre eles —
honestamente?**

A parte honesta é mais difícil do que parece. Esta página explica, em
linguagem clara, o número por trás da cor.

## O problema: pontuações brutas não são zero no zero

A maioria das nossas pontuações é **chrF++** (F-score de n-gramas de caracteres, [Popović
2017](https://aclanthology.org/W17-4770/)) — mede quanto os caracteres e palavras de uma
tradução se sobrepõem com uma tradução de referência, de 0 a 100.

Mas *texto aleatório não é zero*. Todo sistema de escrita oferece alguma sobreposição "de graça": uma ortografia com poucos caracteres distintos, ou palavras longas previsíveis, pontua visivelmente acima de zero mesmo quando a "tradução" é sem sentido. Essa sobreposição gratuita — o **piso de chance** — difere por idioma. Em nossas medições varia de cerca de 1,6 (escrita chinesa) para mais de 13 (alguns idiomas com escrita latina e árabe). Um chrF++ bruto de 14 é ruído próximo ao aleatório em um idioma e um sinal real em outro — então chrF++ bruto **não é comparável entre idiomas**, e um mapa colorido por ele favoreceria silenciosamente alguns sistemas de escrita.

## A solução: subtrair o piso

**chrF++ corrigido por chance (cchrF++)** redimensiona a pontuação para que 0 signifique "não melhor que chance" *naquele idioma* e 1 signifique perfeito:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Os pisos são medidos, não assumidos: para cada idioma executamos uma
estimativa Monte-Carlo — milhares de linhas de base aleatórias da mesma ortografia pontuadas contra referências reais — usando apenas texto monolíngue disponível publicamente (FLORES-200 dev, obtido da fonte, nunca redistribuído). A tabela de pisos atualmente cobre 196 idiomas e é um artefato derivado de Champollion
(`champollion-derived` proveniência; regenerado por
`cli/website/scripts/build-cchrf-floors.mjs`).

Duas regras conservadoras mantêm a correção honesta:

- **Um par é corrigido apenas quando AMBOS os lados têm um piso medido.** Se
  um estiver faltando, o arco aparece em ardósia neutra — *medido, piso
  desconhecido* — e nunca segue a rampa de cores.
- **O par usa o MAIOR dos dois pisos.** A correção pode
  subestimar a força, nunca inflacioná-la.

## Onde cchrF++ se situa na hierarquia

cchrF++ é nossa melhor medida de força *automática* — não é o topo da
hierarquia. Do mais ao menos confiável:

1. **Verificação humana** — falantes fluentes julgando a saída ([validação de falantes](/docs/network/specifications/speaker-validation)). Nada automático a supera.
2. **Anotação de especialista no estilo MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — o
   protocolo que WMT usa para seus julgamentos ouro; caro, raro, muito bom.
3. **cchrF++** — corrigido por chance, comparável entre idiomas, barato de
   computar em qualquer lugar.
4. **chrF++ bruto / BLEU / métricas neurais** — útil dentro de um conjunto de dados;
   veja [Confiabilidade de Métrica](/docs/network/specifications/metric-reliability)
   para ver como cada um pode rastrear mal o julgamento humano no seu par.

Conforme resultados verificados por humanos e de qualidade MQM entram no quadro, eles têm
precedência sobre pontuações automáticas para o mesmo par.

## Como o mapa desenha isso

Cada canal visual carrega exatamente um significado:

| Canal | Significado |
|---------|---------|
| **Cor** | banda cchrF++ — cinco passos, vermelho para verde suave: *próximo ao piso* (&lt; 0,15), *fraco* (0,15–0,35), *em desenvolvimento* (0,35–0,55), *utilizável* (0,55–0,75), *forte* (≥ 0,75) |
| **Ardósia neutra** | medido, mas o piso de chance é desconhecido para pelo menos um lado — nunca colocado na rampa de cores |
| **Tracejado + atenuado** | provisório: o conjunto de testes está abaixo do [piso de significância](/docs/network/specifications/significance) (n &lt; 100), onde lacunas de pontuação dentro de ~5 chrF++ são ruído |
| **Largura** | repete a banda de cores (redundância de acessibilidade, não uma segunda variável) |

Apenas pares **medidos** seguem a rampa de força. Pares registrados — enfileirados
para medição mas ainda não pontuados — aparecem como fios finos de cor plana desbotada cuja cor diz apenas *como o par é alcançável hoje*
(API comercial · modelo de código aberto · fronteira, sem provedor), nunca quão
bem algo se traduz. Os dois vocabulários são deliberadamente disjuntos:
fios planos atenuados = alcançabilidade, a rampa vermelho→verde = força medida.
A pontuação subjacente de um arco é a melhor execução medida para esse par no
quadro público, atualizada automaticamente conforme novas execuções chegam.

## A letra miúda

- Pisos são propriedades de métrica × ortografia estimadas apenas a partir de texto monolíngue;
  nenhum conteúdo de corpus paralelo está envolvido ou armazenado.
- cchrF++ diz a você que uma tradução supera o acaso e por quanto — **não**
  valida significado, registro ou adequação cultural. Esses permanecem sendo julgamentos humanos ([limitações honestas](/docs/network/honest-limitations)).
- A metodologia de piso de chance é pesquisa de Champollion; o atlas de pisos e
  a correção são publicados aqui precisamente para que possam ser verificados e
  questionados.
