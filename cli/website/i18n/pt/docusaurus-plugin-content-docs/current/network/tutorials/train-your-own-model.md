---
sidebar_position: 0
title: "Então Você Quer Treinar Seu Próprio Modelo"
description: "Um passo a passo completo e orientado a agentes sobre o treinamento de um modelo de tradução de baixos recursos com o nmt-forge — do python3 -m pip install até um modelo servido para a CLI do champollion. Você direciona um agente de código; os guardrails capturam os erros de principiante automaticamente."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Então Você Quer Treinar Seu Próprio Modelo

Este é um passo a passo completo sobre como treinar um modelo de tradução automática para um idioma de baixos recursos — desde "eu falo este idioma e quase não há dados" até um modelo que você pode relatar com honestidade, disponibilizar para o seu próprio aplicativo por meio da CLI do Champollion e enviar para a [Rede](/docs/network/). O treinamento é uma etapa de uma jornada mais longa (encontrar o que existe, avaliar as opções, construir algo melhor, comprová-lo, implantá-lo); [Construa TA para seu idioma](/docs/build-mt-for-your-language) é a visão geral de tudo isso. Ele foi escrito para iniciantes e assume a forma moderna de fazer esse trabalho: **você direciona um agente de codificação** (Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity ou similar), e o agente executa as ferramentas.

Então cada passo abaixo tem a mesma forma:

- 🗣️ **Diga ao seu agente** — o que pedir, em linguagem natural.
- 🛠️ **O que a ferramenta faz** — o que [nmt-forge](/docs/network/getting-started/training-honestly)
  executa em seu nome, e a **proteção** que evita o erro clássico
  antes que ele possa custar caro.
- 👀 **Como ler o resultado** — como "bom" se parece e do que se preocupar.

:::info[Primeiro, o vocabulário]
Se termos como *dev set*, *decoding*, *chrF++*, *leakage*, ou *round-trip
verification* ainda não são segunda natureza, leia
[**MT Training in Plain Language**](/docs/network/context/mt-training-concepts)
primeiro — define cada palavra usada aqui com um exemplo prático. Esta página
vai se apoiar em todas elas.
:::

:::note[Honestidade é o recurso, não o atrito]
A ferramenta é opinativa de propósito. Suas proteções mecanizam erros reais e medidos
que um projeto real cometeu — então o caminho honesto é o padrão, e os
atalhos desonestos **recusam com uma mensagem que nomeia a correção**. Onde você vê
uma recusa neste guia, é a ferramenta fazendo seu trabalho. Você quer isso.
:::

---

## O que você precisa antes de começar

- **Um agente de codificação** com acesso ao terminal e ao sistema de arquivos. Esse é o condutor.
- **Algumas frases traduzidas reais** para o seu par de idiomas — mesmo algumas centenas de pares feitos por humanos já são um ponto de partida viável. Livros didáticos bilíngues, arquivos comunitários, registros públicos traduzidos, material educacional. Qualidade acima de quantidade.
- **Opcional, mas poderoso:** texto monolíngue no seu idioma de destino, um dicionário bilíngue, uma gramática de referência publicada e um analisador morfológico (FST). Você **não** precisa de tudo isso para começar — a ferramenta informa exatamente quais estão presentes e quais desbloqueiam quais recursos.
- **Computação:** um laptop. Os guardrails, a divisão, a síntese, a auditoria e a pontuação rodam todos em uma CPU, assim como o treinamento do modelo padrão (um pequeno transformer treinado do zero). Uma GPU só importa se você escolher o preset maior (`nllb-600m`) — veja a [Etapa 5](#step-5--train).

> 🗣️ **Diga ao seu agente:** *"Instale o nmt-forge com o extra de treinamento (`python3 -m pip install 'nmt-forge[hf]'`) e confirme que o comando `nmt-forge` é executado. Vamos treinar um modelo de tradução de inglês → \<your language\>, com honestidade."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

O extra `[hf]` é a pilha de treinamento (torch, transformers, accelerate, tokenizers, sentencepiece, peft); wheels somente para CPU funcionam perfeitamente. Nada mais é necessário — nenhum clone do repositório do Champollion. Cada comando aceita `--json` (um documento JSON no stdout; uma recusa retorna como `{"error": {…, "why", "fix"}}` with exit code 2), and `nmt-forge status` indica o próximo comando a qualquer momento.

Seu agente pode chamar a ferramenta `get_training_guardrails` do servidor MCP do Champollion (sem argumentos; `topic` opcional) para carregar o conjunto completo de regras — os dez guardrails e o erro que cada um elimina — em seu próprio contexto antes de escrever qualquer comando. Se você estiver guiando um agente, peça que ele faça isso primeiro.

---

## Passo 1 — Escolha uma língua e veja o que realmente existe

Todo projeto começa perguntando ao índice o que a língua *tem*, honestamente.

> 🗣️ **Diga ao seu agente:** *"Execute `nmt-forge discover` para o código ISO 639-3 da minha língua alvo
> e resuma que dados existem e o que está faltando."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **O que a ferramenta faz.** Ela lê o **card** do Champollion para o idioma — a fonte única da verdade sobre o que se sabe sobre esse idioma — e relata os sistemas de escrita, analisadores morfológicos, dicionários, corpora e conjuntos de dados de avaliação que registra, posicionando em seguida o idioma na **escada de recursos**. (Os cards vêm de um diretório especificado por você com `--cards-dir`, de um checkout local ou `node_modules/champollion`, ou do índice público de cards — armazenado em cache, para funcionar offline após a primeira busca. Offline e sem cache, exporte o card com `champollion network card <code> --json` para um diretório e passe `--cards-dir`.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Como ler o resultado.** As marcações `✓` indicam o que você pode fazer agora; as marcações `?` são degraus à espera de um recurso. Fundamentalmente, **a ausência em um card significa *desconhecido*, nunca "este idioma não tem nada".** Um card esparso é um convite para adicionar o que você sabe, não um beco sem saída — e até mesmo um card básico garante o ciclo completo de treinamento protegido no degrau 1. Um card rico (como o de Cree das Planícies) conecta os degraus superiores automaticamente: seus conjuntos de avaliação chegam marcados com **NUNCA TREINE NISTO**, e seu árbitro específico do idioma já vem pronto para ser integrado. O degrau 5 só é marcado quando o pacote desse árbitro estiver instalado aqui; caso contrário, é exibido ✗ *UNAVAILABLE* com o comando de instalação — e o árbitro nunca é carregado para um conjunto de teste exclusivamente local ou selado, porque ele pode consultar palavras em um serviço externo.

Depois estruture um projeto:

> 🗣️ **Diga ao seu agente:** *"Estruture um projeto com `nmt-forge init` para este
> par de línguas e leia-me o `NEXT_STEPS.md` que ele gera."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Isso cria um workspace (um diretório `.forge/` que todo guardrail consulta), uma **configuração inicial** e um resumo em `NEXT_STEPS.md` escrito para *você e seu agente* — a ordem dos comandos, a escada de recursos para o seu idioma e os itens inegociáveis. É o mapa para tudo o que vem a seguir. Os caminhos da configuração são relativos, portanto execute o forge de dentro do diretório do projeto.

`init` também escolhe o **modelo** que você treinará (`--model`, registrado como números explícitos em `config.json`): `cpu-tiny` por padrão, `cpu-finetune --base <hf-id>`, or `nllb-600m`. A [Etapa 5](#step-5--train) explica a escolha. Se o seu idioma ainda não tiver um card, o `nmt-forge init <code> --no-card --name "<name>"` ainda assim estruturará o projeto — cada fato do card é registrado como desconhecido, nada é inventado.

---

## Passo 2 — Aponte para um analisador e dicionário (se você os tiver)

Este passo é sobre **degraus 3–4** da escada. Se sua língua não tem
analisador, pule para [Passo 4](#step-4--split-your-real-data-safely) — você vai treinar
apenas em dados reais (e retrotraduzidos), que é um caminho completamente legítimo.

Se um analisador e dicionário *realmente* existem, eles desbloqueiam a capacidade de
*fabricar* dados de treinamento verificados — a maior alavanca para uma língua
com pouco texto paralelo.

> 🗣️ **Diga ao seu agente:** *"O card lista um analisador morfológico e um
> dicionário para essa língua. Busque-os conforme as instruções de instalação no card,
> aponte o pacote de língua para eles via variáveis de ambiente documentadas, e
> confirme que o analisador faz round-trip de algumas palavras conhecidas."*

🛠️ **O que a ferramenta faz — e um limite que ela não vai cruzar.** Analisadores (FSTs)
e dicionários são **ferramentas separadas buscadas pelo usuário sob suas próprias licenças**.
O conjunto **nunca agrupa ou redistribui** — aponta você para onde vêm
e qual é sua licença, e você os busca. Isso não é burocracia: muitos recursos de língua
carregam restrições reais de permissão e soberania, e a ferramenta as respeita por construção.

O tecido conectivo é um **pacote de língua**: um pequeno plugin que adapta *seu*
analisador, dicionário, regras de ortografia e templates de sentenças citadas em gramática para
o mecanismo. O conjunto **não** envia pacotes — pacotes vivem com suas
línguas (o pacote Plains Cree, por exemplo, vive em seu próprio projeto e
conecta por caminho de módulo).

👀 **Como ler o resultado.** Você quer que o analisador faça **round-trip**: soletra uma
forma, alimenta a soletração de volta, obtém as mesmas tags gramaticais. Se não fizer, o
**canonicalizador** do pacote — a única função que normaliza soletração onde
dois componentes se encontram — provavelmente precisa de uma regra. Acertar isso importa: um
único caractere não reconciliado (`ý` vs `y`) uma vez silenciosamente deletou 1.375 verbos
de um pipeline de geração por semanas. A **auditoria de funil** da ferramenta conta
sobreviventes em cada estágio precisamente para que uma queda silenciosa assim não possa se esconder.

---

## Passo 3 — Sintetize dados de treinamento a partir de regras gramaticais

Com um analisador + dicionário + um pacote de templates citados em gramática, você pode
fabricar centenas de milhares de pares verificados.

> 🗣️ **Diga ao seu agente:** *"Gere dados de treinamento sintético com
> `nmt-forge synth` usando nosso pacote de língua, depois me mostre o relatório de cobertura."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **O que a ferramenta faz — a lei de emissão.** Cada linha que chega à saída
deve satisfazer regras que nenhum pacote pode optar por não seguir:

- **Round-trip verificado** — cada palavra gerada passa em *gerar → analisar →
  mesma análise*, ou a linha é descartada. Nenhuma forma não verificada é jamais emitida.
- **Citado em gramática** — cada tipo de template cita a gramática publicada que
  transcreve. Templates não citados não existem; o código recusa carregá-los.
- **Cobertura verificada** — templates são contabilizados contra uma lista de verificação de
  fenômenos gramaticais necessários (imperativos, perguntas, possessão, formas inversas…). Se um
  fenômeno *necessário* tem zero exemplos, a compilação falha. Esta
  é a proteção contra a armadilha "um milhão de sentenças, todas as mesmas poucas formas"
  — volume que esconde buracos estruturais.
- **Proveniência marcada** — cada linha sintética é marcada `synthetic: true`.
  Essa marca é estrutural: o registro **recusará** registrar
  linhas sintéticas como um conjunto de teste. Testes são apenas dados reais.

👀 **Como ler o resultado.** Olhe o relatório de cobertura para **itens necessários com cobertura zero**
(um fenômeno gramatical que seus templates nunca produziram) e para a
**distribuição de tipo** — se duas formas de template dominam, o limite por tipo do amostrador
(padrão 15%) vai rebalanceá-las para que nenhum padrão único se torne metade da
experiência do modelo.

:::tip[Sem analisador? Em vez disso, use retrotradução]
Se você não puder fazer a síntese a partir de regras, mas tiver texto **monolíngue** no idioma de destino, peça ao seu agente para usar a trilha de **retrotradução**: ela traduz automaticamente o seu texto monolíngue *para* o inglês com um modelo reverso fornecido por você e emparelha cada resultado com a frase de destino **real**. O lado de destino permanece autêntico. Trata-se de uma chamada de biblioteca Python (`nmt_forge.training.backtranslation.backtranslate`), não de um subcomando da CLI: seu agente escreve um script curto para executá-la e adiciona o arquivo de saída com tags às trilhas de `data.synthetic` da configuração. A chamada **audita vazamentos no texto monolíngue primeiro** — porque esse texto pode, secretamente, *ser* seus dados de avaliação. Consulte o [guia prático de retrotradução](/docs/network/tutorials/back-translation).
:::

---

## Passo 4 — Divida seus dados reais com segurança

Agora pegue seus pares **reais** e reserve as frases pelas quais você avaliará tudo. É aqui que se esconde o erro mais devastador para os resultados em TA de baixos recursos, e onde o guardrail mostra seu verdadeiro valor.

Seus arquivos podem ser `.tsv` (origem, um TAB e depois a tradução, um par por linha; linhas que começam com `# ` são comentários) ou `.jsonl` (`{"source": …, "target": …}` por linha).

**Se você já tiver um conjunto de teste** — verificado por professores, verificado por profissionais de enfermagem, privado — mantenha-o em um arquivo separado, registre-o, faça a triagem do corpus em relação a ele e extraia apenas os conjuntos de treino e dev:

> 🗣️ **Diga ao seu agente:** *"Registre nosso conjunto de teste, faça a auditoria de vazamento do corpus em relação a ele e, em seguida, divida o corpus limpo em treino e dev com `nmt-forge split`, com grupos disjuntos e com uma semente fixa."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Se você não tiver**, extraia o conjunto de teste a partir do corpus na mesma etapa:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **O que a ferramenta faz — a proteção de divisão (split-guard).** Ela realiza a **divisão com grupos disjuntos**: cada par que compartilha uma origem *ou* um destino é vinculado a um único grupo, e cada grupo completo fica inteiramente de um único lado. Em seguida, ela **verifica a sobreposição zero** e se recusa a continuar caso haja alguma:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Isso elimina o **vazamento de "Feed him" / "Feed her"**: um livro didático mapeia ambos os exercícios em inglês para uma única palavra de destino (`asam`); uma divisão aleatória ingênua coloca uma cópia no treino e sua gêmea no teste, de modo que o modelo "passa" por pura memorização. Em um projeto real, 17 de 54 linhas de teste vazaram dessa forma e obtiveram uma pontuação de 83 contra 44 das linhas limpas — invalidando qualquer conclusão construída sobre esse número. O `--register project` registra o conjunto de dev (e o de teste, quando extraído) como `project-dev` / `project-test` — os nomes para os quais a configuração inicial já aponta — para que todos os comandos posteriores saibam que eles são *conjuntos de avaliação nos quais você nunca deve treinar*. Quando um conjunto de teste já estiver registrado, o `split` também faz a triagem imediata dos novos arquivos de treino e dev em relação a ele.

🛠️ **E a auditoria de vazamento.** O `leak-audit` faz a triagem das linhas em relação a todos os conjuntos de avaliação registrados e informa, com exemplos do seu próprio corpus, o que ele **descartaria** — uma linha cuja origem é idêntica a um prompt de teste (mesmo que sua tradução seja diferente), uma linha cujo destino é idêntico a uma resposta de teste e uma linha cujo destino é quase uma duplicata de uma resposta de teste (ela contém a resposta, é um fragmento dela ou é pelo menos 90% idêntica com acentos normalizados) — e o que ele **mantém de propósito**: *irmãos de template* que compartilham uma estrutura de frase, mas trocam uma palavra (*"I see the dog"* / *"I see the cat"*), e prompts quase duplicados com uma resposta diferente. As linhas de teste que possuem um irmão de template no treino são listadas e — como a configuração inicial define `eval.near_dupe_corpus` para o seu arquivo de treino — o relatório final pontua separadamente as linhas de teste *sem* um irmão, como uma pontuação "(strict)", tornando visível o otimismo que os irmãos adicionam. Quando a maioria das linhas de teste possui um irmão e o conjunto de teste é fixo, o `--clean-to <file> --drop-test-twins` também remove esses pares idênticos de treino (ele relata o subconjunto estrito antes e depois, e se recusa a esvaziar o treino). Forneça a ele um arquivo próprio (`corpus.notwins.jsonl`): ele é o corpus do modelo sem pares idênticos, ao lado do corpus com todos os dados, e a auditoria de vazamento se recusa a sobrescrever um arquivo que uma configuração, uma execução ou uma divisão já esteja lendo. O resultado é determinístico, e o texto do próprio arquivo de teste nunca é exibido.

👀 **Como ler o resultado.** Você quer ver a linha **verified: 0 shared**. Se em vez disso
você receber um `SplitLeakageError`, não delete linhas manualmente — isso apenas
reshuffla o problema. Re-execute a divisão disjunta por grupo; essa é a correção, e a
mensagem de erro diz isso.

:::danger[Nunca treine em um benchmark]
Se você puxar um conjunto de dados de avaliação do registro compartilhado (`nmt-forge registry
add-harness`), a ferramenta o marca e o trata como fora dos limites para treinamento —
**cada** benchmark do registro é marcado *do-not-train*. Fine-tune em tudo que
você legitimamente pode; apenas nunca no conjunto de teste. Esta é
[a única regra](/docs/network/leaderboard/rules) de toda a Rede.
:::

---

## Passo 5 — Treine

Um único arquivo de configuração descreve toda a execução; um único comando a executa, de forma reproduzível. O `nmt-forge init` já o escreveu.

> 🗣️ **Diga ao seu agente:** *"Leia `config.json`, adicione nossa trilha sintética se tivermos criado uma, execute `nmt-forge preflight run --config config.json`, corrija qualquer coisa que ele apontar, depois execute `nmt-forge run config.json` e acompanhe o diagnóstico do cronograma."*

Um trecho da configuração inicial, com o modelo padrão `cpu-tiny` e uma trilha sintética adicionada:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Qual modelo?** Escolha-o ao executar `init` (`--model`); cada número vai para `config.json`:

| preset | o que é | requisitos | expectativa honesta |
|---|---|---|---|
| `cpu-tiny` (padrão) | um transformer pequeno (~6M de parâmetros) treinado do zero; seu vocabulário é aprendido exclusivamente a partir das suas linhas de **treino** | a CPU de um laptop, nenhum download | fraco: em 1–2 mil pares, chrF++ em torno de 5–30 (o limite superior apenas para dados com muitos templates) — frases e padrões dos seus dados, não tradução geral |
| `cpu-finetune --base <hf-id>` | faz o ajuste fino (fine-tuning) de um modelo Marian/opus-mt pequeno e pré-treinado especificado por você — escolha um para um par de idiomas *relacionado* | uma CPU, download de ~300 MB | geralmente melhor que o `cpu-tiny` quando existe um par relacionado — meça no dev, não presuma |
| `nllb-600m` | NLLB-200 distilled 600M com LoRA | uma GPU, download de ~2,5 GB | o ponto de partida mais forte; em uma CPU, a verificação de tempo de execução real o recusará em minutos |

O objetivo do `cpu-tiny` não é a sua pontuação. Ele torna **todo** o ciclo real — o isolamento, as auditorias, o teste pré-registrado, um modelo que a CLI pode chamar — para que um modelo melhor no futuro possa ser inserido no mesmo projeto e avaliado da mesma forma.

`preflight` lista cada etapa de validação pela qual a execução passará, ✓ ou ✗, com a solução para cada ✗ — incluindo se o extra de treinamento está instalado (`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **O que a ferramenta faz — quatro proteções de uma vez.**

- **Auditoria de vazamento antes do treinamento.** *Toda* trilha — gold, sintética e qualquer texto retrotraduzido — é verificada em relação a *todos* os conjuntos de teste registrados e selados. Vazamento de resposta (prompts ou respostas idênticos, respostas quase duplicadas) e correspondências de arquivos inteiros são fatais; irmãos de template são mantidos e relatados (`--drop-test-twins` os remove para um conjunto de teste fixo). Nada é treinado até que a combinação esteja limpa.
- **Isolamento de dev (Dev-fence).** O treinamento **se recusa a iniciar sem um conjunto de dev registrado**, e só selecionará checkpoints com base nesse conjunto de dev — nunca no conjunto de teste. (Ele até mesmo verifica o conteúdo das linhas de dev em relação aos conjuntos de teste, para detectar o truque do `cp test.jsonl dev.jsonl`.) A seleção de checkpoints pode usar o **loss** de dev ou uma **métrica de geração** de dev — decodificando o conjunto de dev e pontuando a saída real, que é o sinal mais honesto (a configuração inicial usa chrF++ na saída de dev decodificada).
- **Sanidade do cronograma (Schedule-sanity).** Se a sua combinação tiver muito conteúdo sintético, a ferramenta *deduz* um limite mínimo de parada a partir do tamanho da combinação e mantém o treinamento durante o **platô** — a fase em que o modelo concluiu o aprendizado sintético fácil e ainda não transferiu isso para a qualidade real. Isso evita a "morte na metade da época", na qual uma parada antecipada ingênua é acionada em um vigésimo do planejado. A frequência com que o conjunto de dev é avaliado também é deduzida a partir do tamanho da execução, garantindo que uma execução pequena ainda seja avaliada. Cada intervenção imprime a trajetória do dev-loss e o motivo, em linguagem simples.
- **Cálculo de exposição + sintético com tags.** Os dados gold recebem maior peso (são repetidos) para que o pouco dado real não seja diluído; o manifesto registra a **exposição efetiva por frase única** para que um teste A/B permaneça justo. Fontes sintéticas recebem uma tag; os dados gold permanecem sem tag para ancorar o estilo da saída.

O treinamento é a única etapa que demora um pouco. Seu agente deve executá-lo em segundo plano com a saída direcionada para um arquivo de log e monitorar as linhas relevantes (`refused`, `Error`, `wall-clock`, `RUN EXIT`) em vez de fazer consultas contínuas (polling). Um painel em tempo real com as curvas de loss e um botão de parada se abre para **você** (em `http://127.0.0.1:8377` quando essa porta estiver livre). Nos primeiros minutos, o forge mede a velocidade de treinamento e imprime uma projeção de tempo de execução real, primeiro uma estimativa inicial e depois uma em regime estável. O `init` não define nenhum orçamento de tempo, porque um orçamento é um número seu, não inventado pela ferramenta. Leia a projeção, decida quanto tempo você aceita esperar e adicione `"time_budget_hours": <hours>` a `config.json` sob `model`. A partir daí, o forge recusará qualquer execução que não possa terminar dentro desse prazo, fazendo com que uma execução mal dimensionada falhe rapidamente. Até que você defina um, apenas o teto de segurança do forge se aplica: ele interrompe execuções que levariam dias, e cada projeção o exibe como "no budget set; … ceiling", não como um orçamento escolhido por alguém.

👀 **Como ler o resultado.** A execução imprime um **relatório de dev com intervalos de confiança** — não há saída com pontuação isolada — e depois o próximo comando (os números abaixo são ilustrativos):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Se você vê uma mensagem `schedule-sanity` explicando que *manteve* o treinamento além de uma
parada prematura, essa é a proteção de platô funcionando — bom. A execução também escreve um
**manifesto**: hash de configuração, hashes de arquivo de dados, seeds, e o agendamento derivado, para que
a execução inteira seja reproduzível.

---

## Passo 6 — Avalie honestamente

Você tem um modelo. Antes de pontuá-lo no conjunto de teste, você escreve o que
espera — *primeiro*.

> 🗣️ **Diga ao seu agente:** *"Escreva um pré-registro para a pontuação do conjunto de teste — nossa métrica prevista, direção e margem, com uma justificativa de uma linha — e depois exporte a execução, o que pontua o conjunto de teste uma única vez."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` indica o pré-registro que avalia este modelo. Havendo um no conjunto de teste, a exportação o encontra sozinha; com um segundo modelo e seu próprio pré-registro no mesmo conjunto de teste, a exportação se recusa a adivinhar, portanto especifique cada um.

(O pré-registro pode acontecer a qualquer momento antes da primeira pontuação de teste — o `nmt-forge status` o solicita antes do treinamento.)

🛠️ **O que a ferramenta faz — as proteções anti-storytelling.**

- **Pré-registro.** Pontuar um conjunto de **teste** registrado exige um pré-registro redigido *antes* da primeira visualização. Um arquivo de previsões é um array JSON: cada previsão especifica uma métrica e uma justificativa, além de uma direção em relação a uma linha de base (verificada automaticamente por `nmt-forge prereg check`) ou uma expectativa em texto livre que uma pessoa verifica. O template não editado, Markdown e prosa são recusados, com a indicação do formato e da correção necessária. Sem um pré-registro, a pontuação simplesmente **se recusa a continuar**:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  Esta é a proteção contra disfarçar pós-dições ("claro que melhorou em histórias orais") de previsões. Registrar os palpites que *falham* é o que torna confiáveis aqueles que têm sucesso.
- **Intervalos de confiança, sempre.** Toda pontuação é renderizada com seu IC bootstrap de 95%; não existe saída sem IC. Um ganho de `+0.5` cujos intervalos se sobrepõem não é uma vitória.
- **O registro de avaliação (eval-ledger).** Cada leitura de cada conjunto de avaliação é registrada em log (somente anexação, protegido contra adulteração). Pergunte a `nmt-forge ledger show --set project-test` o quanto um conjunto já foi "gasto". Conjuntos **selados** são de uso único — pontuados uma vez e depois fechados (um segundo `export` recusa; `--no-eval` empacota sem repontuar).

O `export` decodifica o conjunto de teste com o checkpoint selecionado no dev, o pontua e anexa uma seção de **Diagnóstico e recomendações** em linguagem simples. Ele também salva o resultado como um **relatório mt-eval** (`export/evaluation/`), de modo que o `mt-eval compare` posiciona seu modelo ao lado de qualquer outro método medido com o harness no mesmo conjunto de teste, e empacota o próprio modelo (Etapa 8) em `export/model/`, que não contém nenhuma frase de teste. O `export/evaluation/` contém suas frases de teste: nunca o copie junto com o modelo e mantenha-o com o conjunto de teste. O `nmt-forge evaluate <run-manifest>` é a parte exclusiva de pontuação, para quando você não quiser um pacote.

👀 **Como ler o resultado.** Leia o número **com seu intervalo e por registro linguístico**, observe a pontuação "(strict)" se os seus dados de treino compartilharem templates de frases com o conjunto de teste e verifique **em qual métrica confiar** antes de comemorar. Para pontuar o arquivo de saída de outro sistema no mesmo conjunto registrado, com mais métricas:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` mostra a **confiabilidade medida** de cada métrica para sua
família de línguas (das meta-avaliações WMT). Para algumas famílias uma métrica como
BLEU mal rastreia julgamento humano enquanto COMET faz; para muitas famílias
com poucos recursos a resposta honesta é *não medida* — nesse caso, julgamento de falante nativo,
não qualquer número automático, é o sinal real. Veja
[Confiabilidade de Métrica](/docs/network/specifications/metric-reliability).

:::tip[O árbitro próprio da sua língua]
Se sua língua tem um padrão de avaliação LYSS (um linter que sabe, digamos, que duas
soletras diferem apenas por uma convenção de vogal longa documentada), conecte-o com
`--plugin` e ele pontua ao lado de chrF++ — e pode até *selecionar* checkpoints,
para que o modelo que vence seja aquele que o árbitro próprio da língua prefere. Cada
número de plugin também recebe um intervalo de confiança.
:::

---

## Passo 7 — Itere

Agora você melhora — e cada melhoria é medida da mesma forma honesta.

> 🗣️ **Diga ao seu agente:** *"Altere uma única coisa — adicione um tipo de template / mais dados retrotraduzidos / um preset de modelo diferente —, treine novamente e faça um teste A/B em relação à execução anterior no conjunto de dev, com significância estatística."*

Cada execução já imprime sua pontuação de dev com um intervalo de confiança. Para um teste pareado, decodifique o conjunto de dev com cada execução — `nmt-forge evaluate <run-manifest> --config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` é uma cópia da sua configuração cujo `eval.battery` é `project-dev` — e então:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **O que a ferramenta faz.** `compare` executa um **teste de significância pareado**, não
apenas uma subtração, para que "B bate A" seja uma afirmação que as estatísticas suportam — não
ruído. Itere no conjunto **dev** (é para isso que ele serve); mantenha o conjunto **test**
para verificações infrequentes e pré-registradas; mantenha qualquer conjunto **sealed**
para o final.

👀 **Como ler o resultado.** Uma melhoria real limpa seu intervalo de confiança
*e* o teste de significância. Se não fizer, você aprendeu algo mesmo — que
essa alavanca é mais fraca do que esperava, o que vale a pena saber. As proteções de platô/cobertura/
vazamento significam que os números que você está comparando são confiáveis, para que você possa
realmente acreditar em seu próprio loop de iteração.

Alavancas comuns a seguir, aproximadamente em ordem de retorno para uma língua com falta de dados:

1. **Mais pares reais** — em poucas milhares de frases, cada par real adicional conta mais do que qualquer configuração.
2. **Maior cobertura** na síntese — adicione os fenômenos gramaticais ausentes apontados pelo relatório de cobertura.
3. **Retrotradução** — transforme texto monolíngue de destino em mais pares de treinamento.
4. **Um ponto de partida mais forte** — `cpu-finetune` com um modelo base para um par relacionado, ou `nllb-600m` em uma GPU — medido contra `cpu-tiny` no mesmo conjunto de dev.
5. **Currículo** — faça o pré-treinamento com dados sintéticos e, em seguida, o ajuste fino nos pares reais.

---

## Etapa 8 — Coloque-o em prática e leve-o para a Rede

Um modelo treinado com honestidade é algo que você pode usar hoje mesmo, e exatamente o que a [Champollion Network](/docs/network/) foi criada para receber.

**Use você mesmo.** O `export` já empacotou o modelo: um diretório autocontido para o modelo, `forge-model.json` (o que ele é e como foi medido), um manifesto de plugin do Champollion (`method.json`) e o `DEPLOY.md` com os comandos exatos.

> 🗣️ **Diga ao seu agente:** *"Sirva o modelo exportado e use-o para traduzir as strings do nosso aplicativo com a CLI do Champollion."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

O `serve` atende ao contrato de **método de API** do Champollion (`POST /translate`) e a um `/v1/chat/completions` **compatível com OpenAI** — este segundo é o que o `--method local` usa; o `DEPLOY.md` contém o trecho de `champollion.config.json` para o primeiro. Ele escuta apenas em `127.0.0.1`; expô-lo em uma rede requer um token (`--token` ou `NMT_FORGE_SERVE_TOKEN`). Um modelo de NMT traduz texto e ignora instruções, portanto prompts de tom, arquivos de orientação e glossários que a CLI envia para métodos baseados em LLM não têm efeito sobre ele — e sua saída necessita da revisão de um falante fluente antes de chegar aos leitores.

**Leve-o para a Rede.**

> 🗣️ **Diga ao seu agente:** *"Empacote este modelo como um método e envie-o para o
> leaderboard para nosso par de línguas."*

- **[Envie um Método](/docs/network/getting-started/submit-a-method)** transforma
  seu modelo em uma entrada de Rede, pontuada em corpora de referência pública e
  atribuída a você.
- Porque sua avaliação foi limpa — disjunta por grupo, cercada por dev, auditada por vazamento, com IC, pré-registrada — seu
  envio sobrevive ao escrutínio que afunda a maioria das afirmações de MT com poucos recursos. A arquitetura anti-gaming
  (conjuntos de teste secretos de propriedade comunitária, verificações de reprodutibilidade, validação de falante nativo) não é um
  obstáculo para um modelo construído dessa forma; é um carimbo de credibilidade.
- Se um **prêmio** está aberto para sua língua, um método em pé, melhor que baseline,
  construído honestamente é exatamente o que um pool patrocinado recompensa. E quando um
  método funciona para uma língua indígena, **a propriedade pode transferir para a
  comunidade** — você o constrói aqui e eles o implantam, em seus termos. Veja a
  [Especificação de Prêmio](/docs/network/specifications/prizes) e
  [Transferência de Propriedade](/docs/network/sovereignty/ownership-transfer).

---

## O arco inteiro, em um fôlego

1. **Descubra** o que o idioma tem (`discover`, `init`) — ausência é desconhecido, não zero.
2. **Aponte para** um analisador + dicionário se eles existirem (degraus 3–4), respeitando suas licenças.
3. **Sintetize** dados de treinamento verificados, citados e com cobertura checada (`synth`) — ou **faça a retrotradução** de texto monolíngue.
4. **Divida** os dados reais com grupos disjuntos, faça a triagem contra o seu conjunto de teste e registre os conjuntos de avaliação (`registry add`, `leak-audit`, `split`).
5. **Treine** uma única configuração — em uma CPU por padrão — com isolamento de dev, auditoria de vazamento e atenção ao platô (`preflight`, `run`).
6. **Avalie** com previsões redigidas antes, intervalos de confiança sempre e a métrica correta (`prereg`, `export`).
7. **Itere** com testes A/B com significância estatística testada (`compare`).
8. **Use** o modelo por meio da CLI (`serve`) e **envie-o** para a Rede — onde o trabalho honesto é o propósito principal.

Você nunca teve que memorizar as dez formas que resultados de MT com poucos recursos dão errado. A
ferramenta tornou o caminho honesto o padrão e recusou os atalhos com uma
explicação. Essa é a ideia toda: **as proteções pegam os erros amadores
para que você possa focar na língua.**

## Continue

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — cada termo aqui, definido com um exemplo.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — as dez proteções em uma página, cada uma com sua história medida.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) e [**Back-Translation**](/docs/network/tutorials/back-translation) — cookbooks mais profundos em técnicas específicas.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — construindo os dados reais em que tudo mais se apoia.
