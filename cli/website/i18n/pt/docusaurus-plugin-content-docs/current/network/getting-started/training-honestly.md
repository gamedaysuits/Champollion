---
sidebar_position: 2
title: "Treinar um Modelo com Honestidade (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Treinar um Modelo com Honestidade (nmt-forge)

**A versão em 30 segundos:** a maioria das "melhorias" em MT para idiomas de
baixos recursos desmorona em uma reavaliação — o conjunto de teste vazou para
o treinamento, o conjunto de teste escolheu o checkpoint, ou o ganho foi apenas
ruído sem barras de erro. O **nmt-forge** é um pacote de treinamento que torna
esses erros estruturalmente difíceis: seus fluxos normais fazem a coisa certa,
e os fluxos errados recusam a execução com uma mensagem que informa *o que*
aconteceu, *por que* isso corrompe os resultados e a *correção* exata. Ele treina;
o [harness de avaliação](/docs/network/specifications/harness) pontua. Cada barreira
de proteção nele automatiza a prevenção de um erro que realmente cometemos,
medimos e documentamos enquanto construíamos a tradução para Plains Cree. Ele é
instalado com `python3 -m pip install 'nmt-forge[hf]'`, e seu modelo padrão
treina na CPU de um laptop.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

Essa é toda a personalidade da suite em uma recusa.

## A história de cinco minutos

Aqui está a falha de que a suite nasceu. Um livro didático Cree mapeia muitos exercícios em inglês para um alvo: *"Feed him"* e *"Feed her"* traduzem ambos para `asam`. Uma divisão aleatória padrão colocou uma cópia no treinamento e sua gêmea no conjunto de teste — então o modelo tinha literalmente visto 17 de 54 respostas de "teste", e essas linhas pontuaram 83 chrF++ contra 44 para as limpas. Tudo a jusante (o modelo "campeão", os achados construídos sobre ele) teve que ser descartado.

o divisor do nmt-forge torna isso impossível **por construção**: pares que compartilham uma fonte *ou* um alvo são agrupados, grupos inteiros caem de um lado, e uma verificação de zero sobreposição é executada após cada corte:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Se o seu conjunto de teste já for um arquivo separado e registrado — um conjunto
verificado por professores que você mantém privado —, o `--test 0` separa
apenas train e dev.)

Todas as outras barreiras têm a mesma estrutura — um erro real, eliminado de
forma automatizada. Juntas, elas formam os **guardrails de treinamento**: leia-as
antes de fazer a divisão dos dados (`nmt-forge init` e `nmt-forge status` apontam para
cá nessa etapa; agentes recebem as mesmas regras, com o erro medido por trás de
cada uma, a partir da ferramenta MCP `get_training_guardrails`).

| barreira | o erro que ela elimina |
|---|---|
| **split-guard** | respostas de teste escondidas no treinamento por meio de origens/destinos compartilhados |
| **dev-fence** | o conjunto de teste escolhendo o seu checkpoint (o treinamento se recusa a iniciar sem um conjunto de dev registrado) |
| **leak-audit** | treinamento com texto de avaliação — um prompt idêntico (mesmo com uma tradução diferente), uma resposta idêntica ou quase duplicada, ou o arquivo inteiro. Ele também informa o que *mantém* de propósito e por quê: variações de template que trocam uma palavra (*"I see the dog"* / *"I see the cat"*) são prática, não a resposta, e são relatadas, não removidas — a menos que toda linha de teste tenha uma, caso em que o `--clean-to … --drop-test-twins` remove as duplicatas de treino de um conjunto de teste fixo. Determinístico: mesmo corpus, mesmo resultado |
| **funnel-audit** | perda silenciosa no pipeline (certa vez, um único caractere ortográfico excluiu 1.375 verbos de dicionário, de forma invisível, durante semanas) |
| **convention-lint** | treinamento com convenções ortográficas misturadas (o modelo passa a misturá-las no meio da frase) |
| **coverage-map** | um milhão de pares sintéticos sem imperativos, sem perguntas, sem posse — volume escondendo lacunas estruturais |
| **sample-strata** | dois tipos de templates monopolizando metade do sinal de treinamento |
| **ci-scoring** | pontuações sem barras de erro (cada número é exibido com seu IC bootstrap de 95% — não há saída de pontuação isolada) |
| **schedule-sanity** | early stopping interrompendo uma execução rica em dados sintéticos na metade de uma época: com 97% de dados sintéticos e um conjunto de dev *real* honesto, a perda de dev atinge o mínimo cedo e sobe — isso é o modelo se ajustando à massa sintética, não convergência. O limite mínimo de parada é derivado da sua composição automaticamente, e cada intervenção se explica pela trajetória da perda de dev. Esse erro foi descoberto *graças a* um protocolo rigoroso — configurações honestas trazem bugs reais à tona |
| **eval-ledger** | uso adaptativo invisível de dados de avaliação (cada leitura é registrada em log; conjuntos selados são de uso único) |
| **preregister** | pós-dições disfarçadas de predições (sem pré-registro → sem pontuação de teste, sem tabela de comparação; um único formato de predições, um array JSON — o `nmt-forge prereg template` gera um para edição) |
| **score caveats** | citar uma pontuação que o harness de avaliação qualificou com ressalvas — uma *saída quase constante* (uma entre poucas frases retornada para muitas entradas diferentes: as saídas não acompanham as entradas), saídas muito mais longas ou curtas que as referências, cópias da fonte. O forge não calcula nada disso; ele repassa cada ressalva que o harness registrou, nas próprias palavras do harness, ao lado da pontuação — no resumo de exportação, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` e `lint` — e nunca oferece uma pontuação com ressalva como "o número a ser citado" sem a devida advertência |

## Qualquer idioma, qualquer ativo — comece pelo cartão

O nmt-forge é uma ferramenta única para todos os ~8.700 idiomas no índice do
Champollion, e ele começa consultando o índice para saber o que um idioma
realmente possui:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

As marcas `?` são a ferramenta sendo honesta: ausência em um cartão significa **desconhecido**, nunca "este idioma não tem nada". Cada idioma sobe a mesma **escada de ativos** — (1) apenas texto paralelo já obtém o loop de treinamento guardado completo; (2) texto monolíngue adiciona retrotradução; (3) um dicionário mais uma gramática publicada torna um pacote de template citado digno de construção; (4) um analisador morfológico desbloqueia síntese verificada; (5) um árbitro LYSS coloca a métrica própria do idioma na pontuação e seleção de checkpoint. Um cartão rico (Cree das Planícies) conecta os degraus 4–5 automaticamente — conjuntos de avaliação chegam sinalizados `NEVER TRAIN ON THIS`, e as pistas de plugin do árbitro vêm prontas para colar.

O `nmt-forge init <code>` então estrutura o scaffolding de um projeto a partir do card:
um workspace, uma configuração inicial e um sumário `NEXT_STEPS.md` escrito para
você *e seu agente* com a ordem exata dos comandos. Ele funciona a partir de um
simples `pip install` — os cards são lidos de um diretório que você indicar,
de um checkout local ou do índice público de cards (em cache para uso offline) —
e um idioma que ainda não tenha card também recebe um projeto (`--no-card --name "<name>"`),
com cada fato do card registrado como desconhecido em vez de inventado.

## De um laptop a um modelo servido

O fluxo honesto não precisa de GPU. O `init` grava um dos três presets de
modelo na configuração, com valores numéricos explícitos:

| preset | requisitos | o que esperar |
|---|---|---|
| `cpu-tiny` (padrão) — um transformer pequeno treinado do zero, vocabulário aprendido apenas com as linhas de treinamento | CPU de um laptop, sem downloads | fraco por design: em 1 a 2 mil pares, chrF++ por volta de 5–30 — reflete as frases e padrões dos seus dados, não tradução geral |
| `cpu-finetune --base <hf-id>` — um modelo Marian/opus-mt pré-treinado pequeno que você indicar, para um par relacionado | uma CPU, download de ~300 MB | geralmente melhor que o `cpu-tiny` quando existe um par relacionado — meça os resultados |
| `nllb-600m` — NLLB-200 distilled 600M com LoRA | uma GPU | o ponto de partida mais robusto |

O `cpu-tiny` existe para tornar *todo* o fluxo real desde o primeiro dia —
a barreira de contenção, as auditorias, o teste pré-registrado, um modelo que
a CLI pode chamar — para que, mais tarde, um modelo melhor entre no mesmo
projeto e seja medido da mesma forma. Após o treinamento, dois comandos
concluem o trabalho:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

O `export` avalia o conjunto de teste uma única vez (exige pré-registro,
intervalos de confiança de 95%; o `--prereg <id>` indica o pré-registro gravado
para este modelo com o `nmt-forge prereg new <id>` — havendo dois modelos para um mesmo
conjunto de teste, cada um avaliado pelo seu próprio, a exportação se recusa a
adivinhar), grava o resultado como um relatório de mt-eval legível por
`mt-eval compare` e empacota um modelo autocontido com um manifesto de plugin do
champollion e um `DEPLOY.md`. O `serve` implementa o contrato
api-method do champollion e um endpoint compatível com OpenAI, permitindo que
o `champollion sync --method local` traduza com ele; ele escuta apenas em localhost, a menos que
você forneça um token. Todos os comandos aceitam `--json` para agentes
(um único documento JSON no stdout; recusas como `{"error": {…, "why", "fix"}}`, código de
saída 2). O passo a passo completo está em
[Treine seu primeiro modelo](/docs/network/getting-started/train-your-first-model);
assim que tiver algo que valha a pena testar,
[Envie um método](/docs/network/getting-started/submit-a-method) transforma isso
em uma entrada na Network.

## Dados sintéticos que você pode defender

Para idiomas com analisadores morfológicos (FSTs), forge fabrica dados de treinamento através de **pacotes de idioma** — e impõe uma *lei de emissão* que nenhum pacote pode optar por não seguir: cada palavra gerada deve fazer uma volta completa através do analisador (gerar → analisar → mesma análise), cada template cita a gramática publicada que transcreve, cada filtro de plausibilidade é nomeado e contado, e cada linha é marcada `synthetic: true`. Essa marca é estruturante: o registro **se recusa a aceitar linhas sintéticas em conjuntos de teste**. Testes são apenas dados reais.

forge em si não envia pacotes de idioma — é uma ferramenta de propósito geral. Os pacotes vivem com seus idiomas e se conectam por caminho de módulo ou ponto de entrada (o pacote Cree das Planícies vive no projeto crk-translate):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Analisadores e dicionários permanecem separados, ferramentas buscadas pelo usuário sob suas próprias licenças — nunca agrupadas, nunca redistribuídas.

## O árbitro do seu idioma, no loop

Os padrões de avaliação LYSS (linters por idioma que sabem, digamos, que duas ortografias Cree diferem apenas por uma convenção de vogal longa documentada) se conectam em cada superfície de pontuação — e na seleção de checkpoint, então o modelo que vence é aquele que o *árbitro do idioma* prefere, não apenas chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Cada número de plugin obtém um intervalo de confiança; um árbitro cujos pré-requisitos estão faltando relata *indisponível* em vez de uma pontuação fabricada.

O mesmo é verdadeiro para a **pilha de métrica completa do harness** — nmt-forge fala tudo que o [harness de avaliação](/docs/network/specifications/harness) fala, incluindo as métricas neurais (COMET, COMET-QE, MetricX), com inferência executada uma vez e intervalos de confiança inicializados a partir de pontuações por entrada em cache. Antes de você selecionar checkpoints em qualquer métrica automática, `discover` mostra a [confiabilidade medida](/docs/network/specifications/metric-reliability) de cada métrica para sua família de idiomas — para Inuktitut, BLEU mal rastreia o julgamento humano (r=0.16) enquanto COMET faz (r=0.86); para a maioria das famílias de baixo recurso a resposta honesta é *não medida*. A ferramenta diz qual número acreditar antes de você otimizar em relação a ele.

## Onde aprofundar

- **Novo no vocabulário?** [Treinamento de MT em linguagem
  simples](/docs/network/context/mt-training-concepts) define cada termo —
  dados de treinamento vs. avaliação, perda vs. decodificação, vazamento, chrF++,
  retrotradução, o platô — com um exemplo prático, escrito para quem não tem
  conhecimento prévio.
- **Pronto para construir?** [Então você quer treinar seu próprio
  modelo](/docs/network/tutorials/train-your-own-model) é o passo a passo
  voltado para agentes: escolha um idioma → reúna dados → sintetize → divida
  → treine → avalie → itere → sirva e envie, demonstrando como cada guardrail
  intercepta seu respectivo erro. [Construa MT para seu
  idioma](/docs/build-mt-for-your-language) contextualiza o treinamento na
  jornada completa — descobrindo o que existe, avaliando as opções, fazendo o
  deploy.
- **Treine e envie:** um modelo treinado com honestidade torna-se uma entrada
  na Network via [Envie um método](/docs/network/getting-started/submit-a-method).
- **As barras de erro:** [Testes de significância
  estatística](/docs/network/specifications/significance) apresenta os cálculos
  matemáticos que o forge aplica por padrão.
- **Em qual métrica confiar:** consulte [Confiabilidade de
  métricas](/docs/network/specifications/metric-reliability) antes de
  selecionar checkpoints com base em qualquer métrica automática.
- **Todos os comandos e flags:** a [Referência de comandos do
  forge](/docs/network/getting-started/forge-command-reference), gerada a partir
  da própria ferramenta.
- **A taxonomia de falhas** — cada erro, um exemplo concreto e a barreira
  que o intercepta — é fornecida junto com o código-fonte do nmt-forge. Agentes
  recebem o mesmo conjunto de regras da ferramenta `get_training_guardrails` do servidor
  MCP (`topic` opcional), e cada recusa inclui seu próprio o
  quê/por quê/correção.
