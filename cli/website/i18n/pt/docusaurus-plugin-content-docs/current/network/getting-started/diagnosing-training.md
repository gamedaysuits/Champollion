---
sidebar_position: 4
title: "Diagnosticando uma Execução de Treinamento"
description: "Resolução de problemas orientada por sintomas para treinamento de MT com poucos recursos — comece pelo que você está vendo, encontre a causa provável e a alavanca de ajuste que a corrige."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
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

Seu modelo foi treinado. Os números não são o que você esperava. Esta página começa a partir
**do que você está vendo** e guia você até a causa provável e a ferramenta do forge que
a corrige. A maioria delas é automatizada — o `nmt-forge export` (e sua versão apenas de
pontuação, `nmt-forge evaluate`) anexa uma seção de **Diagnóstico e Recomendações**
que indica o achado e a alavanca de ação; este guia é a versão em linguagem simples,
além das poucas coisas sobre as quais o forge só consegue *alertar* (marcadas como ⚠ **fique atento a isso**).

Diga ao seu agente: *"Execute `nmt-forge lint <battery-manifest.json> --json` e aja de acordo com
o achado de maior gravidade."* Após uma exportação, o manifesto da bateria é
`export/evaluation/battery-hyps-battery.json`. Em seguida, compare o que ele relata com as
seções abaixo.

---

## "A pontuação do modelo padrão está baixa"

Você treinou com o preset padrão `cpu-tiny` e a pontuação de teste está em algum ponto
entre 5 e 30 chrF++.

**O que está acontecendo:** é exatamente isso que esse preset faz. Ele é um transformer pequeno
treinado do zero apenas com seus pares; portanto, com 1 a 2 mil pares, ele aprende
as frases e os padrões de sentenças dos seus dados, e não o idioma em geral — o
topo dessa faixa só aparece quando os dados seguem muitos templates. O papel dele é
tornar todo o ciclo real (dev isolado, dados auditados, teste pré-registrado, um modelo
que a CLI possa chamar), não ser o modelo que você coloca em produção.

**Correção:** mude uma coisa de cada vez e meça no conjunto dev, em ordem aproximada de
retorno:

1. **Mais pares reais.** Nesse tamanho, dados superam qualquer configuração.
2. **Um ponto de partida pré-treinado.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` faz o ajuste fino de um modelo Marian/opus-mt pequeno e pré-treinado em uma CPU — escolha
   um para um par de idiomas *relacionado* e compare-o com `cpu-tiny` em dev
   em vez de presumir que ele vai ganhar. `--model nllb-600m` é o ponto de partida mais forte
   e precisa de uma GPU.
3. **Mais dados a partir do que você já tem** — retrotradução de texto monolíngue ou
   síntese verificada se o seu idioma tiver um analisador (consulte
   [Então você quer treinar seu próprio modelo](/docs/network/tutorials/train-your-own-model)).

⚠ **fique atento a isso:** uma pontuação alta do `cpu-tiny` merece desconfiança antes
de comemoração — consulte ["A pontuação parece boa demais"](#the-score-looks-too-good).

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

1. **Vazamento.** `nmt-forge leak-audit <corpus>` — alguma sentença de teste foi parar no
   treinamento? Ele descarta linhas cujo prompt seja idêntico a um prompt de teste (mesmo com
   uma tradução diferente), linhas cuja resposta seja idêntica a uma resposta de teste
   e linhas que contenham, sejam um fragmento de ou sejam ≥90% idênticas a uma resposta
   de teste. O `nmt-forge run` recusa linhas de treinamento que vazem para um conjunto de teste
   registrado ou conjunto lacrado, portanto isso importa principalmente para dados ou um pipeline fora
   do forge — ou um conjunto de teste que você nunca registrou.
2. **Seleção de checkpoint.** O checkpoint foi escolhido em um **conjunto dev isolado**,
   e não no conjunto de teste? O forge se recusa a treinar sem um conjunto dev exatamente para evitar
   isso, mas um pipeline criado manualmente não fará isso.
3. **Otimismo por quase-gêmeos.** `R4-optimism-bound`: se a pontuação da bateria "completa"
   estiver vários pontos acima da pontuação "estrita" (strict), a diferença é o otimismo
   por sentenças irmãs de exercícios. O `leak-audit` *mantém* variações de templates de propósito (*"I see the
   dog"* no treinamento, *"I see the cat"* no conjunto de teste) e lista as linhas de teste
   que têm uma variação correspondente; com `eval.near_dupe_corpus` definido para o seu arquivo de treinamento (a
   configuração inicial faz isso), o relatório pontua as linhas de teste *sem* uma
   variação separadamente, marcadas como "(strict)". **Cite o número strict** para qualquer
   afirmação de generalização. Se *todas* as linhas de teste tiverem uma variação (`R4-recall-not-translation`:
   o subconjunto estrito está vazio, logo a pontuação mede a memorização de frases de
   treinamento) e o conjunto de teste for fixo, grave um corpus livre de gêmeos em seu próprio
   arquivo com `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` e treine um segundo modelo sem gêmeos com ele (o leak-audit
   não sobrescreverá o arquivo em que o primeiro modelo foi treinado) — ou obtenha sentenças de teste
   escritas de forma independente dos templates de treinamento.
4. **As saídas não acompanham as entradas.** `R9-harness-score-caveat`: o
   relatório do mt-eval indica que a pontuação tem ressalvas — mais frequentemente uma **saída
   quase constante**: muitas sentenças de teste diferentes geraram as mesmas poucas saídas (um
   modelo hospitalar respondeu a 150 sentenças diferentes com 9 saídas; ainda assim,
   obteve chrF++ 48, porque uma frase comum compartilha muitos caracteres com
   muitas referências). O modelo livre de gêmeos é o suspeito habitual: com seus
   templates de treinamento removidos, um modelo pequeno pode recorrer às suas sentenças mais
   frequentes. O forge repassa a ressalva nas próprias palavras do harness —
   no resumo da exportação, `DEPLOY.md`, `status`, `report`, `compare` e
   `lint` — e nunca chama essa pontuação de "o número a ser citado" sem ela.
   Leia algumas das saídas (`<export>/evaluation/battery-hyps.jsonl`, na
   máquina que contém o conjunto de teste) antes de relatar a pontuação como
   qualidade de tradução; mais pares de treinamento reais e variados são a alavanca de ação.

---

## "O treinamento parou quase imediatamente"

A execução terminou após algumas centenas de passos; o modelo mal viu seus dados.

**O que está acontecendo:** a parada antecipada confundiu o oscilação esperada de dev pesada em sintético com convergência.

**Comportamento do forge:** isso é *evitado* por padrão — o `nmt-forge run` deduz um
**limite mínimo** de parada a partir do seu mix e suprime paradas precoces abaixo dele, registrando o
motivo nas linhas `[schedule-sanity]`. A frequência com que o conjunto dev é avaliado também é
derivada do tamanho da execução, para que uma execução pequena não fique sem avaliação. Se
você observar uma parada que não esperava, leia essas linhas; o manifesto de execução registra
exatamente o que aconteceu e o porquê. (Uma execução que simplesmente atingiu sua última etapa planejada
é relatada como concluída, não como uma parada precoce.)

---

## "A execução foi recusada antes de realmente começar"

**O que está acontecendo:** um gate disparou — o que é mais barato do que uma execução que falha
horas depois de iniciada. Os mais comuns:

- **O extra de treinamento está ausente** — `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` com a correção,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **Nenhum conjunto dev ou o conjunto errado** — a barreira de dev recusa uma execução cujo
  `data.dev` não seja um conjunto registrado com o papel `dev`. Separe um com
  `nmt-forge split … --register project`.
- **Vazamento** — um arquivo de treinamento compartilha prompts ou respostas com um conjunto
  de teste registrado ou conjunto lacrado. Limpe-o com `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` e aponte a configuração para o arquivo limpo.
- **Tempo de execução (Wall-clock)** — nos primeiros minutos, o forge mede a velocidade de treinamento e
  recusa uma execução cuja projeção exceda `model.time_budget_hours`. Em uma CPU, isso
  geralmente significa que o preset precisa de uma GPU (`nllb-600m`) ou que o mix é muito maior
  do que você pretendia. A mensagem indica as alavancas: um mix menor, sequências
  mais curtas ou um orçamento maior caso você realmente aceite a espera.

**Correção:** execute `nmt-forge preflight run --config config.json` antes de cada execução;
ele lista todos os gates, ✓/✗, com a correção para cada ✗.

---

## "Uma métrica que eu queria está simplesmente… faltando no relatório"

O relatório é honesto mas em branco em um eixo (COMET, uma verificação de validade FST).

**Descoberta forge:** `R6-referee-unavailable` — a faixa é nomeada como indisponível
com o motivo. **Alavanca: REFEREE.**

**Correção:** instale/configure o referee indicado e recalcule a pontuação. Quando o
language card declara o referee, a mensagem do forge indica o comando de instalação
(`mt-eval setup --lang <code>`). As pontuações que você tem ainda são honestas — elas só estão
cegas nesse eixo específico até que o referee esteja presente.

---

## "O modelo emite `<unk>` ou caracteres distorcidos"

Especialmente em um script silábico ou latino estendido.

**Depende do preset.**

- **`cpu-tiny`** aprende seu próprio vocabulário a partir das suas linhas de treinamento, de modo que cada
  caractere presente no treinamento é coberto. `<unk>` aqui significa que a entrada
  contém um caractere que nunca apareceu no treinamento — uma letra ou
  diacrítico raro, ou uma forma Unicode diferente dele (o texto é normalizado para NFC, portanto
  acentos compostos e decompostos contam como a mesma coisa). Verifique se os seus dados de treinamento
  e de teste utilizam a mesma ortografia.
- **`cpu-finetune` e `nllb-600m`** usam o tokenizador do modelo base pré-treinado.

⚠ **fique atento a isso — ainda não automatizado (bases pré-treinadas).** O
**tokenizador do modelo base pode não representar a escrita de destino**. O forge ainda não audita
a cobertura do tokenizador antes do treinamento. Verifique o tokenizador do seu modelo base com
amostras da sua escrita de destino; prefira uma base cujo vocabulário cubra a escrita
(muitos idiomas de baixos recursos são cobertos por bases da família NLLB) ou estenda o
tokenizador antes do treinamento.

---

## Quando forge recusou e você não entende por quê

Uma recusa sempre declara **o que** aconteceu, **por que** corrompe resultados, e o
**conserto**. Se ainda estiver pouco claro:

- `nmt-forge status` — onde você está e o próximo comando individual.
- `nmt-forge preflight <command>` — cada gate que esse comando vai atingir, ✓/✗, com
  a correção para cada ✗, para que você resolva todos de uma vez em vez de um por um
  (para `run`, `evaluate` e `export`, adicione `--config config.json`).
- Adicione `--json` a qualquer comando quando um agente estiver lendo o resultado: a recusa
  então chega como um único objeto JSON — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — com código de saída 2.

Uma recusa não é um erro em sua configuração — é a ferramenta capturando um erro antes
de chegar aos seus resultados. Esse é todo o design.
