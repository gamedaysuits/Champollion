---
sidebar_position: 3
title: "Treine seu primeiro modelo (com seu agente)"
description: "Um passo a passo para treinar um modelo de MT de baixos recursos orientando um agente de programação — instale, proteja seu conjunto de testes, treine na CPU de um notebook, avalie uma vez e sirva o modelo para a CLI do champollion. O que você diz, o que o forge faz e como é uma recusa."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Treine Seu Primeiro Modelo (com seu agente)

Você não precisa saber como treinar um modelo de tradução automática neural. Você
precisa ser capaz de **dizer a um agente de código o que você quer** — Claude, ou um
modelo da classe Sonnet/Flash, ou qualquer agente que possa executar comandos shell. **nmt-forge**
foi construído para que o agente possa acioná-lo *mecanicamente*: a cada passo a ferramenta diz
ao agente exatamente o que fazer a seguir, e recusa — alto e claro, com uma correção — quando
um passo corromperia seus resultados.

Esta página apresenta o ciclo completo, de `pip install` a um modelo que a CLI
do champollion pode chamar. Cada etapa é descrita como **o que você diz ao seu agente**, **o que o forge
faz**, **como é uma recusa** (para que nenhum de vocês entre em pânico quando uma ocorrer —
uma recusa indica que a ferramenta está funcionando) e, ao final, **como ler o relatório**. Esta
é a parte de forge das etapas 2 e 4 de [Criar MT para o seu
idioma](/docs/build-mt-for-your-language), que aborda o que vem antes
(descobrir o que existe), no meio (avaliar as opções existentes) e depois
(publicar, combinar métodos).

**A ordem importa.** Registre seu conjunto de teste, faça a triagem dos seus dados de treinamento
em relação a ele e anote suas predições (Etapas 1–3) **antes de qualquer coisa ser
avaliada no conjunto de teste** — incluindo as linhas de base que a etapa 3 do guia
mede com `mt-eval run`. Um benchmark é uma leitura de pontuação: o forge a contabiliza
e recusa uma predição registrada após isso. Depois faça o split e treine (Etapa 4).

:::tip A regra de ouro para o seu agente
Diga a ele: *"Sempre execute `nmt-forge status --json` primeiro e após cada etapa.
Faça o que seu `next_command` indicar."* Esse único hábito transforma o forge em um
guia passo a passo. Todo comando do forge aceita `--json`: exatamente um documento JSON no
stdout, e uma recusa retorna como `{"error": {…, "why", "fix"}}` com código de
saída 2. Se o seu agente se conecta via MCP, o mesmo ciclo é a ferramenta `forge_status`
(`{ "project_dir": "<dir>" }`) — consulte o [Guia do Agente](/docs/network/getting-started/agent-guide).
:::

---

## Etapa 0 — Instale e aponte seu agente para o seu idioma

**Você diz:** *"Instale o nmt-forge com seu extra de treinamento. Quero treinar um
modelo Inglês→[seu idioma]. Comece descobrindo o que o forge sabe sobre ele.
O código ISO 639-3 é `crk`"* (use o código do seu idioma).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

O extra `[hf]` adiciona as bibliotecas de treinamento (torch, transformers, accelerate,
tokenizers, sentencepiece, peft). Wheels apenas para CPU são suficientes para o modelo
padrão. Apenas `python3 -m pip install nmt-forge` fornece as proteções, divisões (splits), auditorias e
avaliações sem o treinamento.

**O forge faz:** `nmt-forge discover crk` lê a ficha (card) do idioma — escritas,
dicionários, analisadores morfológicos, corpora existentes e conjuntos de avaliação (com quaisquer
sinalizações de `do_not_train` / quarentena), além de métricas árbitro por idioma. Você não
precisa de uma cópia do repositório Champollion: as fichas são encontradas em um diretório que
você indicar (`--cards-dir`), em um checkout local ou `node_modules/champollion`, ou no
índice público de fichas (em cache, funcionando offline depois). O forge então posiciona
seu idioma na **escada de ativos**: (1) texto paralelo → treinamento protegido;
(2) + monolíngue → retrotradução marcada; (3) + dicionário/gramática → dados sintéticos
citados; (4) + analisador → síntese verificada por round-trip; (5) + métrica árbitro → a
própria métrica do idioma na pontuação e seleção de checkpoints.

**Um campo em branco significa DESCONHECIDO, nunca zero.** Um cartão esparso não significa "este idioma não tem nada" — pode ser que o recurso simplesmente não esteja registrado ainda. Você sempre pode trazer seu próprio corpus paralelo.

Depois: *"Faça o scaffold do projeto."*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Isso cria um workspace (`.forge/`), um `config.json` inicial e um
briefing `NEXT_STEPS.md` com a ordem exata dos comandos. **Execute todos os comandos
seguintes de dentro do diretório do projeto** — os caminhos da configuração são relativos a ele.

A configuração inicial usa o preset de modelo **`cpu-tiny`**, a menos que você escolha outro:

| `--model` | O que é | Requisitos | Expectativa |
|---|---|---|---|
| `cpu-tiny` (padrão) | um pequeno transformer (~6M de parâmetros) treinado do zero em seus pares; seu vocabulário é aprendido apenas a partir das suas linhas de treino | CPU, sem downloads | fraco: em 1–2 mil pares, chrF++ por volta de 5–30 (o topo apenas para dados altamente padronizados em templates). Ele aprende as frases e padrões dos seus dados, não o idioma em geral |
| `cpu-finetune --base <hf-id>` | faz o fine-tuning de um pequeno modelo Marian/opus-mt pré-treinado que você indicar (escolha um para um par de idiomas *relacionado*) | CPU, download de ~300 MB | geralmente melhor que `cpu-tiny` quando existe um par relacionado — meça no seu conjunto de dev, não deduza |
| `nllb-600m` | NLLB-200 destilado 600M com LoRA | GPU, download de ~2.5 GB | o ponto de partida mais robusto; a verificação de tempo de execução do forge recusa em CPU dentro de minutos |

O preset é registrado como números explícitos em `config.json` → `model`, portanto
nada fica oculto e alterar um número cria uma nova execução com hash separado.

**Sem ficha para o seu idioma?** `nmt-forge init <code> --no-card --name "<name>"`
ainda faz o scaffold do projeto; tudo o que uma ficha informaria é registrado como
desconhecido, e nada é inventado.

---

## Etapa 1 — Reserve seu conjunto de teste e registre-o {#step-1--set-your-test-set-aside-then-split}

**Você diz:** *"Aqui está meu corpus paralelo e, separadamente, o conjunto de teste
verificado por professores. Mantenha o conjunto de teste fora do treinamento e registre-o antes que
qualquer coisa seja pontuada nele."*

Os arquivos podem ser `.tsv` (origem, um TAB e depois a tradução, um par por linha;
linhas começando com `# ` são comentários) ou `.jsonl` (`{"source": …, "target": …}`
por linha). Se o conjunto de teste for privado, marque-o como somente local **antes** que
qualquer coisa o leia — incluindo o seu agente:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
Assim, o forge nunca exibirá suas frases.

**O forge faz — se você tem seu próprio conjunto de teste** (o caso habitual para uma escola ou
clínica):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

O registro inicia o **registro de leituras** do arquivo (`<file>.reads.jsonl`): a partir de agora,
toda pontuação deste arquivo — pelo forge, ou por `mt-eval run` / `mt-eval compare`
— é contabilizada. É por isso que o registro vem primeiro: uma execução de benchmark feita
antes dele é listada no registro, mas não contabilizada.

**Se você não tiver um conjunto de teste separado**, extraia um do corpus em vez disso —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` em uma única etapa
(a Etapa 4 explica o split) — e passe para a Etapa 3.

`nmt-forge status` indica agora a próxima etapa: as predições (Etapa 3), antes
de qualquer benchmark — faça a triagem do seu corpus primeiro (Etapa 2).

---

## Passo 2 — Verifique vazamentos

**Você diz:** *"Antes de treinarmos, verifique o corpus contra o conjunto de teste e me
diga o que você descartaria e por quê."*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**O forge faz:** ele faz a triagem de cada linha em relação a cada conjunto dev/teste/selado
registrado. O mesmo corpus e os mesmos conjuntos registrados
sempre produzem o mesmo resultado. Ele explica o que iria **descartar**:

- **Prompt idêntico** — a frase de origem da linha é igual à origem de uma linha de teste
  (ignorando maiúsculas/minúsculas, pontuação e espaçamento). Descartada **mesmo quando a tradução
  da linha é diferente**: o modelo ainda teria praticado exatamente no mesmo
  prompt de teste.
- **Resposta idêntica** — o destino da linha é igual a uma referência de teste.
- **Resposta quase duplicada** — o destino da linha compartilha pelo menos 60% de suas palavras
  com uma resposta de teste (com acentos unificados, então variantes ortográficas contam) **e** ou
  contém a resposta inteira, é um fragmento dela ou é pelo menos 90% idêntico.
  O modelo receberia a maior parte da resposta.

…e o que ele **mantém de propósito**, informado mas nunca removido:

- **Irmãos de template** — a linha compartilha uma estrutura de frase com uma resposta de teste,
  mas troca uma palavra em cada sentido (*"I see the dog"* / *"I see the cat"*). O modelo
  ainda precisa produzir a palavra que nunca viu nessa estrutura. Corpora escolares e
  livros didáticos baseados em templates estão cheios disso. O forge lista as linhas de teste que têm
  um irmão no treinamento; como a configuração inicial define
  `eval.near_dupe_corpus`, o relatório final mostra uma pontuação **"(strict)"** nas
  linhas sem correspondente ao lado da pontuação completa.
- **Prompt similar, resposta diferente** — a origem é uma quase duplicata (não uma cópia
  idêntica) de uma origem de teste, mas a tradução é diferente: um
  contraste mínimo legítimo, não um vazamento.

Aqui está o relatório para um corpus de exemplo de 12 linhas analisado contra um conjunto de teste de 3 linhas
(resumido; as frases de exemplo são em inglês com destino semelhante ao francês):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

A linha 3 tem uma tradução *diferente* da linha de teste e ainda assim é descartada:
seu prompt é o mesmo prompt do teste.

Os exemplos citam as linhas do **seu corpus** pelo número da linha; o texto do arquivo de teste em si
nunca é impresso, e uma linha que correspondeu a um conjunto **selado** é exibida apenas
pelo número da linha. (Quando uma linha do corpus é idêntica a uma linha de teste, ou a contém, citar
a linha do corpus exibe também essa frase de teste — passe `--no-examples` se a
saída for compartilhada.)

`--clean-to pairs.clean.jsonl` grava as linhas restantes, além de um registro de auditoria
sem conteúdo ao lado delas (`pairs.clean.audit.json`). Faça a triagem do corpus
**antes** de fazer o split (a Etapa 4 divide o arquivo limpo). Não faça uma nova triagem de todo o
corpus depois de extrair um conjunto de dev dele — as linhas de dev corresponderiam a si mesmas
e seriam descartadas. Faça a triagem de quaisquer dados *adicionais* (coleta da web, texto monolíngue)
da mesma forma antes de adicioná-los ao treinamento.

**A triagem não consome seu conjunto de teste.** O leak-audit lê o conjunto de teste para
comparar linhas, e o forge registra isso como uma leitura de *auditoria*, nunca de pontuação:
isso não interfere nas predições que você registrará na Etapa 3.

**Leia o veredito primeiro** (a linha `VERDICT:`; com `--json`, a chave `verdict`).
Se ele indicar que a maioria das linhas de teste tem uma quase-gêmea em seu corpus, um modelo
treinado com todos os dados medirá a memorização de frases de treino em vez de
tradução. Com um conjunto de teste fixo (revisado por professores ou enfermeiros), você geralmente treinará
**dois modelos**: um com todos os dados — normalmente o mais útil
para deploy — e outro livre de gêmeos, cuja pontuação indica como a abordagem lida com novas
frases. O corpus livre de gêmeos é gerado a partir de `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Ele remove as linhas de treino que são quase-gêmeas de linhas de teste, relata o
subconjunto estrito antes e depois, recusa se isso não deixar nada para treinar
— e salva a configuração do modelo livre de gêmeos ao lado da sua,
**`config-notwins.json`**: a mesma configuração com seu próprio `run_name` e com
`data.gold` / `eval.near_dupe_corpus` apontando para o arquivo sem gêmeos
(`--companion-config <file>` indica outro arquivo; um arquivo existente nunca é
sobrescrito). Ele exibe o comando que o treina. Até que o conjunto de dev seja
registrado (Etapa 4), ele sugere extraí-lo primeiro e executar esta auditoria novamente, para que as
linhas de dev também saiam do arquivo livre de gêmeos. O `nmt-forge status` mantém o veredito —
e, em seguida, o modelo livre de gêmeos não treinado — em seus avisos até que você tome uma ação.

**Como é uma recusa:** você não precisa se lembrar de executá-la — o `nmt-forge
run` audita cada arquivo de treinamento contra seus conjuntos de teste e selados e recusa em caso de
vazamento: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0
identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12
template sibling(s) … which are KEPT"*. Solução: `nmt-forge leak-audit <file>
--clean-to <file.clean.jsonl>` e treine com o arquivo limpo.

---

## Passo 3 — Preveja antes de olhar

**Você diz:** *"Registre o que esperamos que cada modelo pontue no conjunto de teste —
antes de medirmos qualquer coisa nele."*

**O forge faz:** um pré-registro por modelo que você planeja treinar, nomeado conforme
o modelo:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Um arquivo de predições é um array JSON de predições. Cada uma indica uma métrica e uma
justificativa de uma frase, mais uma direção em relação a uma linha de base
(`"direction": "increase", "baseline_score": 0, "margin": 5`) — verificada
automaticamente depois — ou uma expectativa em texto livre (`"expect": "between 10 and
30"`) para uma pessoa checar. Você (ou seu agente, explicitamente) confirma isso
**antes** que qualquer pontuação de teste exista — **e antes de qualquer benchmark de um modelo
existente no conjunto de teste**: as linhas de base na etapa 3 de [Criar MT para o seu
idioma](/docs/build-mt-for-your-language#3-measure-the-options) vêm
*depois* desta etapa. Quando você exporta, `--prereg <id>` diz qual predição
avalia qual modelo. Ou fixe uma predição na configuração do seu modelo agora:
`--config-hash <hash>` em `prereg new`, com o hash completo
que `nmt-forge preflight run --config config-notwins.json` imprime. Qualquer edição posterior
dessa configuração (um limite de tempo, por exemplo) altera o hash e remove a fixação, portanto
especificar o pré-registro na exportação é o caminho mais simples.

**Como é uma recusa:** quatro casos que você pode encontrar aqui.

- O modelo não editado é recusado: seus marcadores `REPLACE` não preveem
  nada. Escreva sua própria expectativa e justificativa.
- Um arquivo em Markdown ou prosa é recusado, exibindo o formato correto e o comando de modelo.
  Há apenas um formato aceito: o array JSON.
- Um pré-registro criado após o conjunto de teste já ter sido pontuado é recusado:
  *"[preregister] eval set 'project-test' was already read for scoring … before
  this preregistration"*. Um benchmark conta como leitura. `--allow-after-reads` existe apenas
  para predições que foram de fato registradas antes dessas leituras (no papel,
  por exemplo); isso fica gravado, e todo relatório, exportação, `DEPLOY.md` e
  `nmt-forge status` mostrarão que as predições vieram após N leituras de pontuação.
- Pontuar um conjunto de teste sem pré-registro é recusado: *"[preregister] no
  preregistration for eval set 'project-test' … why: results looked at without
  written-down expectations become post-hoc stories"*. É isso que separa um
  resultado real de narrativas criadas após o fato.

:::info Por que isto parece trabalho extra
É o trabalho. Cada proteção aqui é um erro que enganou pesquisadores reais.
A ferramenta torna o caminho honesto o caminho fácil e o caminho desonesto aquele que
o para.
:::

Agora meça as opções existentes no conjunto de teste — etapa 3 de [Criar MT para
o seu idioma](/docs/build-mt-for-your-language#3-measure-the-options) — e
retorne para treinar.

---

## Etapa 4 — Divida, valide os gates e treine {#step-4--check-the-gates-then-train}

**Você diz:** *"Divida o corpus limpo em treino e dev. A execução de treinamento
passará em todas as verificações? Se sim, treine."*

**O forge faz — a divisão (split):**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` extrai apenas treino e dev, porque seu conjunto de teste já existe como
um arquivo registrado próprio (com um conjunto de teste extraído, a Etapa 1 já fez a divisão).
`--register project` registra `project-dev` no workspace — o nome para o qual
a configuração inicial já aponta.

A divisão é **disjunta por grupos (group-disjoint)**: quaisquer dois pares de frases que compartilhem uma origem *ou*
um destino caem no **mesmo** lado. Essa é a maneira mais comum pela qual
as pontuações em idiomas com poucos recursos são infladas — um livro didático mapeia vários exercícios em inglês para uma
palavra de destino, uma divisão aleatória ingênua joga uma cópia no treino e sua gêmea no teste,
e o modelo apenas "traduz" respostas que memorizou. A saída detalha o que aconteceu:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Com um conjunto de teste já registrado, o `split` também faz a triagem imediata dos novos arquivos de treino e dev
em relação a ele e avisa se alguma linha seria recusada mais tarde.

**Corpora baseados em templates (livros de frases, exercícios).** O `--near-dupe 0.6` também mantém
*quase*-duplicatas — frases construídas na mesma estrutura — do mesmo lado, para que uma linha de dev
ou teste nunca tenha um gêmeo de template no treino. Em um
corpus altamente baseado em templates, as estruturas podem se encadear em um grupo gigante (*"Does your arm hurt?"* ~
*"Does your leg hurt?"* ~ *"Your leg looks swollen"* …), e um grupo só pode
ir para um lado por inteiro. Quando isso deixaria um lado com muito mais linhas do que o solicitado
— mais de **1.5×** o pedido — ou deixaria o treinamento com menos da metade do
que a solicitação reservaria, o `split` recusa e não grava nada: *"[split-guard]
split refused — nothing was written: the carve does not match the request (dev:
asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the
773 rows the request leaves it)"*, seguido pelo motivo (o encadeamento, com o
tamanho do maior grupo) e as abordagens viáveis: um limiar mais alto, um limite no
tamanho do grupo (`--near-dupe 0.6 --max-group 51` — links de quase-duplicatas além do
limite permanecem sem corte, e o split os contabiliza), os gêmeos de um conjunto de teste fixo descartados
com `leak-audit --drop-test-twins`, ou frases de dev/teste elaboradas
independentemente do material de treino. O forge verifica o encadeamento por conta própria: em
tal corpus, sua recomendação de quase-gêmeos (aqui, no preflight e no DEPLOY.md da exportação)
não recomenda `--near-dupe 0.6`.

**Como é uma recusa:** se você fornecer ao forge uma divisão feita manualmente,
o `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` recusa quando há
sobreposição entre os lados — *"[split-guard] 3 shared canonical source keys and 1 shared target
keys between 'train' and 'test'"* — indicando a solução: faça uma nova extração com `split`; não
apague as linhas conflitantes manualmente.

**Dois modelos?** Agora que o conjunto de dev está registrado, execute a auditoria livre de gêmeos
da Etapa 2 novamente (as linhas de dev também saem do arquivo sem gêmeos); o comando
`config-notwins.json` treina o segundo modelo abaixo.

**O forge faz — os gates:** `nmt-forge preflight run --config config.json` lista cada gate
pelo qual a execução passará, ✓ ou ✗, cada ✗ com sua respectiva solução — incluindo se o
extra de treinamento está instalado:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Quando estiver tudo verde: `nmt-forge run config.json` (e, para o modelo livre de gêmeos,
`nmt-forge preflight run --config config-notwins.json && nmt-forge run
config-notwins.json`).

Com o preset padrão `cpu-tiny`, isso roda na CPU de um notebook comum — sem GPU,
sem downloads. O treinamento ainda é a única etapa que **não** é uma chamada de ferramenta
instantânea, portanto seu agente deve executá-la em segundo plano direcionando a saída para um arquivo
de log, monitorando apenas as linhas relevantes (`refused`, `Error`,
`wall-clock`, `RUN EXIT`) em vez de fazer polling contínuo. Um painel em tempo real com as curvas de perda
e um botão de parada abre para **você** (em `http://127.0.0.1:8377` quando essa
porta estiver livre) — ele é seu, não do agente. No início da
execução, o forge mede a velocidade e recusa — em minutos, não dias — uma execução que
não conseguirá terminar dentro do `model.time_budget_hours` da configuração.

As linhas `[schedule-sanity]` mostram o **piso** de parada antecipada (early-stopping) que o forge derivou
da sua composição de dados, para que uma execução com muitos dados sintéticos não seja interrompida com meia época quando
a perda no conjunto de dev real oscilar (um modo de falha real — consulte
[Diagnosticando uma Execução de Treinamento](/docs/network/getting-started/diagnosing-training)).

Quando termina, o forge terá **selecionado um checkpoint no conjunto de dev isolado** (nunca
no conjunto de teste), gravado um `run-manifest.json` e exibido as pontuações de dev —
sempre com seus intervalos de confiança de 95% — seguidas pelo próximo comando.

---

## Etapa 5 — Avalie uma vez e empacote

**Você diz:** *"Avalie o modelo no conjunto de teste e empacote-o para que possamos
usá-lo."*

**O forge faz:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Um comando:

- decodifica seu conjunto de teste com o checkpoint selecionado na execução e o avalia —
  recusado sem o pré-registro, registrado no histórico do workspace, com intervalos de
  confiança de 95% em cada métrica e uma seção em linguagem clara de **Diagnóstico e
  Recomendações**;
- grava o resultado como um **relatório mt-eval** em `export/evaluation/`, permitindo que
  `mt-eval compare` compare este modelo com qualquer outro que você tenha avaliado com o
  harness (por exemplo, os modelos hospedados na etapa 3 de
  [Criar MT para o seu idioma](/docs/build-mt-for-your-language#3-measure-the-options));
- empacota um **modelo autossuficiente** em `export/model/` (pesos e tokenizador,
  sem estado de treinamento), `forge-model.json` (o que ele é e como foi avaliado), um
  manifesto de plugin do champollion e `DEPLOY.md` com os comandos exatos.
  A pasta `export/model/` não contém nenhuma frase de teste; ela é a única pasta que você implanta.

**A pontuação** é o destaque do harness: chrF++ do corpus com seu intervalo de
confiança de 95%, exibido da mesma forma em qualquer lugar onde o forge o mostra — por
exemplo `chrF++ 31.2 [28.4, 34.0]` — acompanhado de sua assinatura sacreBLEU nos registros
completos (`forge-model.json`, o resumo da exportação, `DEPLOY.md`). BLEU, spBLEU e
TER são exibidos ao lado, nunca mesclados com ele; correspondência exata e as outras
faixas da bateria são diagnósticos. Nenhuma superfície do forge imprime uma métrica composta ou um
rótulo de qualidade: cabe aos falantes do idioma avaliar o valor
real da saída.

**Ressalvas sobre a pontuação a acompanham sempre.** O relatório mt-eval registra
tudo o que restringe o significado da pontuação — por exemplo, uma *saída quase constante*
(o modelo gerou uma entre poucas frases para muitas entradas
diferentes, o que significa que as saídas não acompanham as entradas), saídas muito mais longas ou
mais curtas que as referências, ou cópias da origem. `export` repassa cada
uma dessas ressalvas nas próprias palavras do harness: em seu resumo
(`score_caveats`), em `forge-model.json` e em `DEPLOY.md` logo abaixo da
pontuação. `status`, `report`, `compare` e `lint` indicam o mesmo. Uma pontuação que
carrega uma ressalva nunca é apresentada isoladamente como "o número oficial" sem ela.

Se algo falhar, nenhuma exportação incompleta é deixada para trás. Dois cuidados:
`export/evaluation/` contém suas frases de teste — nunca o copie junto com o
modelo; mantenha-o com o conjunto de teste. (Quando o conjunto de teste é marcado como privado, todo
arquivo nele recebe a mesma marcação.) E um conjunto de teste
**selado** é de uso único: exportar consome o conjunto, e uma segunda exportação
é recusada a menos que você passe `--no-eval` (empacotar o modelo sem reavaliar).

`nmt-forge evaluate <run-manifest>` é a parte de avaliação isolada de `export`, caso
você queira os números sem o empacotamento (`--harness-out DIR` grava o relatório
mt-eval).

**Dois modelos em um mesmo conjunto de teste** (por exemplo, um treinado com todos os dados e outro com
`--drop-test-twins`): assim que o workspace contiver uma segunda execução, a linha `NEXT`
e `nmt-forge status` dessa execução nomearão uma pasta por execução (`--out export-<run>/`).
A ordem não importa: qualquer que seja o modelo exportado por último, o `DEPLOY.md` do modelo
com todos os dados passará a citar a pontuação do modelo sem gêmeos. Com dois
pré-registros em um conjunto de teste, `nmt-forge status` e `nmt-forge report`
indicam qual se aplica a qual execução (ou informam que `--prereg <id>` deve decidir —
export the twin-free model with `--prereg notwins`). `nmt-forge compare`
faz o teste A/B dos dois no conjunto de teste e informa, por modelo, quantas linhas de teste têm
uma quase-gêmea em seus dados de treinamento: uma vitória por memorização é reportada como tal. Ele recebe
as hipóteses de cada modelo — `<export>/evaluation/battery-hyps.jsonl`, chamado de
`hypotheses` no resumo da exportação — e repassa as ressalvas de pontuação que o mt-eval
registrou para essa exportação. A pontuação livre de gêmeos só deve ser citada para frases novas
juntamente com qualquer ressalva associada: se a saída do modelo sem gêmeos
for quase constante, sua pontuação não serve como evidência de que ele traduz frases
novas, e `DEPLOY.md` alerta sobre isso logo ao lado do número.

**Leituras feitas pelo harness contam.** Quando o forge registra um conjunto de teste, ele cria um
pequeno log de leituras ao lado do arquivo (`<file>.reads.jsonl`), e `mt-eval run` /
`mt-eval compare` adicionam uma linha sem conteúdo (id da execução, finalidade, o
sha256 do arquivo, timestamp) cada vez que pontuam esse arquivo. O forge lê esse log: um
pré-registro feito após essa leitura é recusado como pós-dição (a menos que
se use `--allow-after-reads`, fato que todo relatório divulgará) — motivo pelo qual a Etapa 3
vem antes das linhas de base — um conjunto selado lido por `mt-eval` é considerado consumido, `status` e
`ledger show --set` contabilizam as leituras, e `DEPLOY.md` informa quando a pontuação
exportada não foi obtida em uma primeira análise.

### Como ler o relatório battery-lint

O relatório é uma tabela de pontuações **por registro** (livro didático, governamental, história
oral, …) — ou um único grupo, `all`, quando suas linhas de teste não especificam um
registro — cada uma com seu intervalo de confiança, seguida pelo diagnóstico. O
diagnóstico aponta seus **registros mais fracos** e, para cada um, a causa mais provável e a
**alavanca** a ser acionada a seguir:

| Se o diagnóstico diz… | Significa que… | A alavanca |
|---|---|---|
| `R1-vocabulary-gap` | o registro pontua baixo **e** as saídas estão incompletas; faltam palavras ao modelo | **VOCABULÁRIO** — expanda o léxico, depois revise o funil |
| `R2-structure-gap` | as palavras são conhecidas, mas as *estruturas* das frases não | **ESTRUTURA** — adicione as construções que faltam (templates/compositor) |
| `R3-mixed-convention` | as saídas misturam grafias | **ORTOGRAFIA** — normalize o corpus para uma convenção única, retreine |
| `R4-optimism-bound` | a pontuação "completa" está inflada por linhas de teste quase-gêmeas | **MEDIÇÃO** — cite a pontuação restrita (strict) para generalização |
| `R5-low-power` | o intervalo de confiança é amplo | **MEDIÇÃO** — não tome decisões com base em deltas menores que o IC; amplie o conjunto de teste |
| `R7-transfer-plateau` | ótimo em dados sintéticos, estagnado em texto real | **DADOS REAIS** — retrotraduza dados monolíngues ou obtenha frases paralelas reais |
| `R9-harness-score-caveat` | o relatório mt-eval impõe ressalvas à pontuação (por exemplo, saída quase constante); `high` quando o mt-eval classifica como grave | **MEDIÇÃO** — cite a pontuação apenas com a ressalva e leia algumas saídas antes de chamar isso de qualidade de tradução |

Cada constatação apresenta a evidência que a disparou. Para os apontamentos de `--json` em que seu
agente pode atuar programaticamente: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Etapa 6 — Disponibilize o modelo para a CLI do champollion

**Você diz:** *"Disponibilize o modelo exportado via servidor e traduza as strings do nosso
app com ele."*

**O forge faz:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` responde de duas maneiras: o contrato do **método de api** do champollion
(`POST /translate`) e um endpoint `/v1/chat/completions` **compatível com OpenAI**, que
é com o que o `champollion sync --method local` se comunica. `export/model/DEPLOY.md` contém o
trecho de `champollion.config.json` para o método `api` (o que ele recomenda)
e para o manifesto de plugin. O servidor escuta apenas em `127.0.0.1`; para expô-lo
em uma rede você precisa fornecer um token (`--token`, ou
`NMT_FORGE_SERVE_TOKEN`), pois qualquer pessoa que alcance a porta poderá usar seu
modelo. A CLI não precisa de chave para o servidor local (loopback); um servidor iniciado com
token precisa do mesmo valor em `CHAMPOLLION_API_KEY`.

Com dois modelos exportados, a escolha de qual implantar é sua:
`nmt-forge choose export-<run>/model` registra isso, e `nmt-forge status`
então identifica esse modelo. Iniciar o servidor com um modelo para testá-lo é registrado como atendido, não como uma
escolha definitiva. Para submeter o modelo a um sovereign contest em vez disso, `DEPLOY.md` §6
lista os arquivos que formam uma submissão declarativa (Lane A) e o comando exato
`mt-eval contest submit-model`.

Tenha clareza sobre o que está implantando: um modelo de NMT traduz texto; ele **não**
segue instruções, portanto as diretrizes de tom, arquivos de coaching e glossários que a
CLI envia para métodos baseados em LLM são ignorados. Além disso, a tradução automática de um idioma
com poucos recursos requer a revisão de um falante fluente antes de chegar aos leitores.

---

## O que você acabou de fazer

Você treinou um modelo em cuja pontuação pode realmente confiar: sem vazamento de respostas, um
checkpoint selecionado sem espiar o conjunto de teste, margens de erro em todos os números,
predições registradas antes dos resultados, um diagnóstico que indica a próxima alavanca
em vez de deixá-lo no escuro — e um modelo empacotado que a CLI pode chamar
e que se compara diretamente com todos os outros métodos que você avaliou. Esse é o ponto
central — **o resultado honesto é o padrão, e não foi necessária nenhuma especialização em MT
(ou GPU) para chegar lá.**

Se os números desapontarem (e vão desapontar, da primeira vez — o modelo padrão é
fraco por concepção), consulte
[Diagnosticando uma Execução de Treinamento](/docs/network/getting-started/diagnosing-training) —
o guia é estruturado a partir dos sintomas, feito sob medida para esse momento.
