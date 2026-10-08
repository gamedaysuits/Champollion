---
sidebar_position: 5
title: "A Lacuna de Cobertura: Como a Estimamos"
description: "Como o Champollion justifica o número de “mais de um bilhão de pessoas” — o método, as duas decisões de julgamento por trás dele e por que o site relata deliberadamente um piso conservador. Correções e debates são bem-vindos."
---

# A Lacuna de Cobertura: Como a Estimamos

> **Resumo executivo.** A página inicial do Champollion diz que *mais de um bilhão* de pessoas vivas hoje não têm acesso à tradução automática para sua primeira língua. Esta página mostra a aritmética por trás dessa frase, nomeia as duas decisões de julgamento que alteram o número e explica por que publicamos um piso conservador em vez do total bruto maior. O Champollion é um índice, não uma autoridade — cada número aqui pode ser derivado da build pública, e correções são bem-vindas.

## A pergunta que realmente estamos fazendo

Não "quantas línguas não têm tradução automática (MT)", mas **quantas pessoas não têm acesso à tradução automática para sua primeira língua.** A primeira língua (L1) de uma pessoa é aquela em que ela pensa e na qual mais gostaria de ler as notícias. O bilinguismo não remove ninguém dessa contagem: um bilíngue quéchua-espanhol cuja primeira língua é o quéchua ainda não consegue ler uma página da web *em quéchua*. Portanto, a população-alvo é: todos cuja L1 é uma das línguas vivas que nenhum mecanismo de tradução automática dedicado atende.

## Como esse número é calculado

Dois ingredientes, ambos no repositório:

1. **Quais línguas vivas têm tradução automática.** A build faz a interseção da união das listas de idiomas de nove mecanismos rastreados (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, cada lista citada e datada) com as línguas *vivas individuais* da ISO 639-3 (`isoType: 'L'`) em `data/tc-index.json`. Resultado: **552 línguas vivas cobertas, 6.525 não cobertas**, de um total de **7.077** línguas vivas (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Quantas pessoas falam as não cobertas.** Para cada língua viva não coberta, pegamos seu `speakerCount` (extraído das estimativas citadas no cartão do idioma) e somamos. A build emite isso como `stats.coverageGap`. A soma bruta de todas as 6.525 línguas não cobertas é de cerca de **2,9 bilhões** (`uncoveredSpeakerSumRaw` ≈ 2.974.871.273).

Esses 2,9 bilhões são um **valor máximo aproximado**, e dizemos isso claramente.

### Por que a soma bruta não é exata

`speakerCount` mistura falantes de primeira língua (L1) e totais (L1+L2) dependendo do que cada fonte relata, e uma pessoa multilíngue pode ser contada em mais de um idioma. A evidência: somar `speakerCount` em *todas* as 7.082 línguas vivas resulta em aproximadamente **10,8 bilhões** — mais do que as ~8,1 bilhões de pessoas vivas (Perspectivas da População Mundial da ONU). Um censo L1 exato não pode exceder a população mundial; este excede, o que prova que o campo não é puramente L1.

## Duas decisões de julgamento (cada uma altera o número)

**(a) Apenas L1 vs. contagens totais.** Restringir aos falantes de primeira língua diminuiria a estimativa — falantes de L2 são, por definição, pessoas que *têm* outro idioma. Mas os números de L1 por idioma não estão uniformemente disponíveis nas fontes que citamos, então não podemos aplicar uma regra de apenas L1 em todos os lugares sem inventar números. Usar a contagem mista empurra a estimativa *para cima*.

**(b) As 777 línguas não cobertas sem contagem relatada.** Das 6.525 línguas vivas não cobertas, **5.748 possuem um número de falantes e 777 não** (`uncoveredWithCount` / `uncoveredNoCount`). Deixar as 777 de lado — que é o que a soma bruta faz — *subestima* o total, porque essas são línguas reais com falantes reais (não medidos), a maioria delas pequenas e ameaçadas de extinção.

Portanto, os dois erros apontam em direções opostas: a mistura L1/L2 infla, e a cauda de 777 línguas desinfla.

## Por que relatamos um piso de "mais de um bilhão"

O intervalo plausível vai de um piso próximo a **1 bilhão** até o valor bruto de **~2,9 bilhões**. Mesmo após descontar fortemente a dupla contagem de L2 *e* deixar de lado toda a cauda não medida de 777 línguas, a população de primeira língua das línguas não cobertas permanece confortavelmente acima de um bilhão. Em vez de destacar o número maior e mais impreciso, o site relata a extremidade conservadora. "Mais de um bilhão" é a afirmação que temos mais confiança de que sobrevive ao escrutínio.

## O que poderia mudar isso

Uma estimativa mais precisa precisa de **números de falantes de L1 por idioma, cada um com uma citação**, para que possamos somar a L1 diretamente em vez da mistura L1/L2, e possamos colocar uma estimativa defensável nas 777 línguas atualmente não contadas. À medida que os mecanismos adicionam idiomas, o número 552 sobe e a lacuna diminui; à medida que os cartões ganham contagens com fontes melhores, a soma se ajusta. Esta é uma **estimativa contínua**, recalculada a cada build — não um fato fixo.

## Correções e debates são bem-vindos

Se você tiver dados melhores, achar que uma decisão aqui está errada ou puder fornecer fontes para as 777 ausentes, avise-nos. Esse é o objetivo. Abra uma issue em [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) ou envie um e-mail para [info@champollion.dev](mailto:info@champollion.dev).

---

## Fontes

- **Cobertura** — `cli/shared/catalogue/method-coverage.json` (nove mecanismos, cada lista citada e datada) ∩ línguas vivas individuais da ISO 639-3 em `cli/website/data/tc-index.json`; exibido como `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Derivado do Champollion.
- **Somas de falantes** — `speakerCount` em `tc-index.json` linhas (do `speakerEstimates` citado em cada cartão de idioma), somado pela build em `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Derivado do Champollion; mistura L1/L2 por fonte.
- **População mundial** — aproximadamente 8,1 bilhões (Nações Unidas, *Perspectivas da População Mundial*), usado apenas como um limite de sanidade nas somas de falantes.

## Aonde isso leva neste site

Esses números representam o tamanho do problema. A resposta do site para isso começa
em [O que é o Champollion](/docs/what-is-champollion); a metodologia por trás
da divisão coberta/não coberta está em
[como a cobertura é contada](/docs/network/context/coverage-counting), e as
línguas no lado errado da linha — classificadas por quem poderia mais
plausivelmente construir um conjunto de avaliação a seguir — são publicadas na
[lista de desejos de corpus](https://champollion.dev/corpus-wishlist.json).
