---
sidebar_position: 2
title: "Treinar um Modelo com Honestidade (nmt-forge)"
related:
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

**A versão de 30 segundos:** a maioria das "melhorias" em MT de baixo recurso morre no re-exame — o conjunto de teste vazou para o treinamento, o conjunto de teste escolheu o checkpoint, ou o ganho foi ruído sem barras de erro. **nmt-forge** é uma suite de treinamento que torna esses erros estruturalmente difíceis: seus caminhos normais fazem a coisa certa, e os caminhos errados se recusam com uma mensagem que diz *o que* aconteceu, *por que* corrompe resultados, e o *conserto* exato. Ela treina; o [harness de avaliação](/docs/network/specifications/harness) pontua. Cada guarda nela mecaniza um erro que realmente cometemos, medimos e documentamos ao construir a tradução para Cree das Planícies.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

Essa é toda a personalidade da suite em uma recusa.

## A história de cinco minutos

Aqui está a falha de que a suite nasceu. Um livro didático Cree mapeia muitos exercícios em inglês para um alvo: *"Feed him"* e *"Feed her"* traduzem ambos para `asam`. Uma divisão aleatória padrão colocou uma cópia no treinamento e sua gêmea no conjunto de teste — então o modelo tinha literalmente visto 17 de 54 respostas de "teste", e essas linhas pontuaram 83 chrF++ contra 44 para as limpas. Tudo a jusante (o modelo "campeão", os achados construídos sobre ele) teve que ser descartado.

o divisor do nmt-forge torna isso impossível **por construção**: pares que compartilham uma fonte *ou* um alvo são agrupados, grupos inteiros caem de um lado, e uma verificação de zero sobreposição é executada após cada corte:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Cada outra guarda tem a mesma forma — um erro real, mecanizado:

| guarda | o erro que elimina |
|---|---|
| **split-guard** | respostas de teste escondidas no treinamento via fontes/alvos compartilhados |
| **dev-fence** | o conjunto de teste escolhendo seu checkpoint (o treinamento se recusa a começar sem um conjunto dev registrado) |
| **leak-audit** | treinamento em texto de avaliação — exato, reformulado (Jaccard), ou o arquivo inteiro |
| **funnel-audit** | atrito silencioso do pipeline (um caractere de ortografia uma vez deletou 1.375 verbos de dicionário, invisível, por semanas) |
| **convention-lint** | treinamento em convenções de ortografia mistas (o modelo então as mistura no meio da sentença) |
| **coverage-map** | um milhão de pares sintéticos sem imperativos, sem perguntas, sem posse — volume escondendo lacunas estruturais |
| **sample-strata** | dois tipos de template monopolizando metade do sinal de treinamento |
| **ci-scoring** | pontuações sem barras de erro (cada número é renderizado com seu IC bootstrap de 95% — não há saída de pontuação nua) |
| **schedule-sanity** | parada antecipada matando uma execução pesada em sintético na metade de uma época: com 97% de dados sintéticos e um conjunto dev *real* honesto, a perda dev atinge o fundo cedo e sobe — isso é o modelo se ajustando à massa sintética, não convergência. O piso de parada é derivado de sua mistura automaticamente, e cada intervenção se explica com a trajetória de perda dev. Este foi encontrado *por* um protocolo limpo — configurações honestas expõem bugs reais |
| **eval-ledger** | uso adaptativo invisível de dados de avaliação (cada leitura é registrada; conjuntos selados são de uma única tentativa) |
| **preregister** | pós-dições disfarçadas de predições (sem pré-registro → sem tabela de comparação) |

## Qualquer idioma, qualquer ativo — comece pelo cartão

O nmt-forge é uma única ferramenta para todos os ~8.700 idiomas no índice do Champollion, e
ele começa perguntando ao índice o que um idioma realmente possui:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

As marcas `?` são a ferramenta sendo honesta: ausência em um cartão significa **desconhecido**, nunca "este idioma não tem nada". Cada idioma sobe a mesma **escada de ativos** — (1) apenas texto paralelo já obtém o loop de treinamento guardado completo; (2) texto monolíngue adiciona retrotradução; (3) um dicionário mais uma gramática publicada torna um pacote de template citado digno de construção; (4) um analisador morfológico desbloqueia síntese verificada; (5) um árbitro LYSS coloca a métrica própria do idioma na pontuação e seleção de checkpoint. Um cartão rico (Cree das Planícies) conecta os degraus 4–5 automaticamente — conjuntos de avaliação chegam sinalizados `NEVER TRAIN ON THIS`, e as pistas de plugin do árbitro vêm prontas para colar.

`nmt-forge init <code>` então estrutura um projeto a partir do cartão: um espaço de trabalho, uma configuração inicial, e um resumo `NEXT_STEPS.md` escrito para você *e seu agente* — terminando em [Enviar um Método](/docs/network/getting-started/submit-a-method) uma vez que você tenha algo digno de teste.

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

- **Novo no vocabulário?** [Treinamento de MT em Linguagem Simples](/docs/network/context/mt-training-concepts) define cada termo — dados de treinamento vs. avaliação, perda vs. decodificação, vazamento, chrF++, retrotradução, o platô — com um exemplo trabalhado, escrito para zero conhecimento prévio.
- **Pronto para construir?** [Então Você Quer Treinar Seu Próprio Modelo](/docs/network/tutorials/train-your-own-model) é o passo a passo orientado por agente: escolha um idioma → reúna dados → sintetize → divida → treine → avalie → itere → envie, com cada proteção mostrada capturando seu erro.
- **Treine, depois envie:** um modelo treinado honestamente se torna uma entrada de Rede via [Enviar um Método](/docs/network/getting-started/submit-a-method).
- **As barras de erro:** [Teste de Significância Estatística](/docs/network/specifications/significance) é a matemática que forge aplica por padrão.
- **Qual métrica confiar:** verifique [Confiabilidade de Métrica](/docs/network/specifications/metric-reliability) antes de selecionar checkpoints em qualquer métrica automática.
- **O design completo** — a história medida de cada guarda, a interface do pacote, os padrões do loop de treinamento — vive com o código no repositório (`forge/DESIGN.md`).
