---
sidebar_position: 4
title: "Diagnosticando uma Execução de Treinamento"
description: "Resolução de problemas orientada por sintomas para treinamento de MT com poucos recursos — comece pelo que você está vendo, encontre a causa provável e a alavanca de ajuste que a corrige."
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Diagnosticando uma Execução de Treinamento

Seu modelo foi treinado. Os números não são o que você esperava. Esta página começa a partir do
**que você está vendo** e o guia até a causa provável e a ferramenta forge que
a corrige. A maioria delas é automatizada — `nmt-forge evaluate` acrescenta uma
seção **Diagnóstico & Recomendações** que nomeia a descoberta e a alavanca;
este guia é a versão em linguagem clara, mais as poucas coisas que forge só pode
*avisar* (marcadas com ⚠ **fique atento a isto**).

Diga ao seu agente: *"Execute `nmt-forge lint <battery-manifest.json> --json` e aja sobre
a descoberta de maior severidade."* Depois compare o que ele relata com as seções
abaixo.

---

## "Ótimo nos meus exemplos de livro didático, terrível em sentenças reais"

**A armadilha mais comum em recursos baixos.** Seus dados sintéticos/baseados em templates
têm pontuação excelente; texto real desmorona.

**O que está acontecendo:** um **platô de transferência**. Durante o treinamento, a perda no seu
conjunto de dev real chegou ao fundo cedo e depois subiu enquanto a perda de treinamento continuou
caindo — o modelo estava dominando a *massa* sintética, não aprendendo a
traduzir. Mais dados sintéticos **não** ajudarão.

**Descoberta forge:** `R7-transfer-plateau` (do histórico de agendamento do manifesto de execução).
**Alavanca: REAL-DATA.**

**Correção:** adicione texto real. Retrotraduzir dados monolíngues na língua-alvo
(`nmt_forge.training.backtranslation`), ou adquirir sentenças paralelas reais.
O volume de dados sintéticos não é a alavanca — a variedade de dados *reais* é.

⚠ **Fique atento a isto:** se sua mistura é ~99% sintética contra um pequeno conjunto de dev real,
você está em risco disto *antes* de vê-lo nas pontuações. Ainda não há lint de pré-voo
para uma proporção patológica — verifique as contagens de ouro/sintético do seu manifesto de mistura.

---

## "Um registro é muito pior que os outros"

Olhe a tabela por registro. Um único registro (digamos, governo ou legal) está
muito abaixo do resto.

**Duas causas diferentes — o diagnóstico as diferencia olhando para *cobertura*
e se as saídas estão *inacabadas*:**

- **O modelo não tem as palavras** (`R1-vocabulary-gap`: cobertura baixa **e** taxa alta
  de incompletude). **Alavanca: VOCABULARY.** Expanda o léxico (dicionário /
  colheita de atestação), depois execute `nmt-forge` contabilidade de funil para confirmar que as novas
  entradas realmente chegam ao corpus — uma incompatibilidade de ortografia de um caractere
  silenciosamente deletou milhares de palavras antes.
- **O modelo tem as palavras mas não as formas de sentença** (`R2-structure-gap`:
  cobertura OK, ainda inacabado). **Alavanca: STRUCTURE.** Execute o mapa de cobertura
  contra sua lista de verificação de gramática e adicione as construções faltantes
  (imperativos, perguntas-wh, possessão, inverso — o que seus templates nunca
  pediram).

---

## "As saídas misturam ortografias dentro de uma sentença"

O modelo escreve o mesmo som de duas maneiras, às vezes em uma sentença.

**O que está acontecendo:** seus alvos de treinamento ensinaram que as convenções são
intercambiáveis — o corpus continha o mesmo conteúdo em múltiplas
ortografias.

**Descoberta forge:** `R3-mixed-convention`. **Alavanca: ORTHOGRAPHY.**

**Correção:** `convention-lint` o corpus, normalize para **uma** convenção
canônica na fronteira dos dados, e retreine. Mantenha uma taxa de convenção mista em sua bateria
para que você possa vê-la cair.

---

## "Modelo B vence modelo A — mas apenas um pouco"

Você comparou dois modelos e um está à frente por uma fração de ponto.

**O que está acontecendo:** a diferença pode ser menor que o ruído. Em 80
sentenças, uma lacuna de 0,4 chrF++ é um cara ou coroa.

**Descoberta forge:** `R5-low-power` (o intervalo de confiança é mais amplo que o
delta). **Alavanca: MEASUREMENT.**

**Correção:** não aja em deltas menores que o IC. Expanda o conjunto de eval para esse
registro, ou use `nmt-forge compare` que relata um teste de significância
*pareado* em vez de dois intervalos sobrepostos. forge nunca renderiza uma pontuação nua — o
intervalo está sempre lá precisamente para que você possa ver isto.

⚠ **Fique atento a isto:** um resultado de uma **única seed** não carrega
banda de variância entre seeds. Um ganho que não sobrevive a re-seeding não é real.
Se uma decisão importa, execute novamente com 2–3 seeds.

---

## "A pontuação parece muito boa"

Suspeitosamente alta, especialmente cedo ou com poucos dados. Confie na suspeita.

**Verifique, em ordem:**

1. **Vazamento.** `nmt-forge leak-audit <corpus>` — uma resposta de teste acabou no
   treinamento? Acertos no lado-alvo são fatais por uma razão.
2. **Seleção de checkpoint.** O checkpoint foi escolhido em um **conjunto de dev cercado**,
   não no conjunto de teste? forge se recusa a treinar sem um conjunto de dev exatamente para evitar
   isto, mas um pipeline feito à mão não vai.
3. **Otimismo de quase-gêmeos.** `R4-optimism-bound`: se a pontuação da bateria "completa"
   está vários pontos acima da "rigorosa" (excluindo quase-duplicatas), a lacuna é
   otimismo de irmão de exercício. **Cite o número rigoroso** para qualquer
   afirmação de generalização.

---

## "O treinamento parou quase imediatamente"

A execução terminou após algumas centenas de passos; o modelo mal viu seus dados.

**O que está acontecendo:** a parada antecipada confundiu o oscilação esperada de dev pesada em sintético com convergência.

**Comportamento forge:** isto é *prevenido* por padrão — `nmt-forge run` deriva um
**piso** de parada de sua mistura e suprime paradas antecipadas abaixo dele, registrando o
motivo nas linhas `[schedule-sanity]`. Se você vir uma parada que não esperava,
leia essas linhas; o manifesto de execução registra exatamente o que aconteceu e por quê.

---

## "Uma métrica que eu queria está simplesmente… faltando no relatório"

O relatório é honesto mas em branco em um eixo (COMET, uma verificação de validade FST).

**Descoberta forge:** `R6-referee-unavailable` — a faixa é nomeada como indisponível
com o motivo. **Alavanca: REFEREE.**

**Correção:** instale/configure o árbitro nomeado e re-pontue. As pontuações que você tem
ainda são honestas — elas apenas estão cegas nesse eixo até que o árbitro esteja
presente.

---

## "O modelo emite `<unk>` ou caracteres distorcidos"

Especialmente em um script silábico ou latino estendido.

⚠ **Fique atento a isto — ainda não automatizado.** O tokenizador do modelo base pode **não
representar seu script-alvo**. forge ainda não audita a cobertura do tokenizador antes
do treinamento (é o item principal em nossa lista de lacunas). Verifique o tokenizador do seu modelo base
contra amostras do seu script-alvo; prefira uma base cuja vocabulário cobre o
script (muitas línguas de baixo recurso são cobertas por bases da família NLLB) ou estenda
o tokenizador antes do treinamento.

---

## Quando forge recusou e você não entende por quê

Uma recusa sempre declara **o que** aconteceu, **por que** corrompe resultados, e o
**conserto**. Se ainda estiver pouco claro:

- `nmt-forge status` — onde você está e o único próximo comando.
- `nmt-forge preflight <command>` — cada portão que esse comando vai atingir, ✓/✗, com
  o conserto para cada ✗, para que você resolva todos de uma vez em vez de um por um.

Uma recusa não é um erro em sua configuração — é a ferramenta capturando um erro antes
de chegar aos seus resultados. Esse é todo o design.
