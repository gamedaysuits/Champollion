---
sidebar_position: 0
title: "Então Você Quer Treinar Seu Próprio Modelo"
description: "Um guia completo orientado por agente para treinar um modelo de tradução com poucos recursos usando nmt-forge — você direciona um agente de codificação, e os guardrails capturam automaticamente os erros amadores."
related:
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

Este é um guia completo para treinar um modelo de tradução automática para uma
língua com poucos recursos — de "eu falo essa língua e há praticamente nenhum dado"
até um modelo que você pode honestamente relatar e enviar para a [Rede](/docs/network/).
É escrito para iniciantes e assume a forma moderna de fazer esse trabalho:
**você dirige um agente de codificação** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, ou similar), e o agente executa as ferramentas.

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

- **Um agente de codificação** com acesso a terminal e sistema de arquivos. Esse é o condutor.
- **Algumas sentenças traduzidas reais** para seu par de línguas — até algumas
  centenas de pares feitos por humanos é um começo viável. Livros didáticos bilíngues, arquivos comunitários, registros públicos traduzidos, material educacional. Qualidade sobre
  quantidade.
- **Opcional mas poderoso:** texto monolíngue em sua língua alvo, um
  dicionário bilíngue, uma gramática de referência publicada, e um
  analisador morfológico (FST). Você **não** precisa de todos esses para começar — a ferramenta diz
  exatamente quais estão presentes e quais desbloqueiam quais capacidades.
- **Computação:** as proteções, divisão, síntese, auditoria e pontuação rodam
  em um laptop. Apenas a etapa real de treinamento do modelo quer uma GPU (e um modelo
  pequeno com LoRA cabe em hardware modesto).

> 🗣️ **Diga ao seu agente:** *"Instale nmt-forge do pacote `forge/` do monorepo Champollion
> e confirme que o comando `nmt-forge` funciona. Vamos
> treinar um modelo de tradução English → <your language\>, honestamente."*

Seu agente pode chamar a ferramenta `get_training_guardrails` do servidor MCP Champollion
para carregar o conjunto completo de regras — as dez proteções e o erro que cada uma elimina —
em seu próprio contexto antes de escrever qualquer comando. Se você está dirigindo um agente,
peça que faça isso primeiro.

---

## Passo 1 — Escolha uma língua e veja o que realmente existe

Todo projeto começa perguntando ao índice o que a língua *tem*, honestamente.

> 🗣️ **Diga ao seu agente:** *"Execute `nmt-forge discover` para o código ISO 639-3 da minha língua alvo
> e resuma que dados existem e o que está faltando."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **O que a ferramenta faz.** Ela lê o **card** Champollion da língua — a
fonte única de verdade sobre o que se sabe sobre essa língua — e relata os
scripts, analisadores morfológicos, dicionários, corpora e conjuntos de avaliação que
registra, depois coloca a língua na **escada de ativos**:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Como ler o resultado.** As marcas `✓` são o que você pode fazer agora; as marcas `?`
são degraus esperando por um ativo. Crucialmente, **ausência em um card significa
*desconhecido*, nunca "essa língua não tem nada."** Um card esparso é um convite
para adicionar o que você sabe, não um beco sem saída — e até um card vazio te dá o
loop de treinamento completo e protegido no degrau 1. Um card rico (como Plains Cree) conecta os
degraus superiores automaticamente: seus conjuntos de avaliação chegam marcados **NUNCA TREINE NISSO**, e
seu árbitro específico da língua vem pronto para conectar.

Depois estruture um projeto:

> 🗣️ **Diga ao seu agente:** *"Estruture um projeto com `nmt-forge init` para este
> par de línguas e leia-me o `NEXT_STEPS.md` que ele gera."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Isso cria um espaço de trabalho (um diretório `.forge/` que toda proteção
consulta), uma **configuração inicial**, e um `NEXT_STEPS.md` escrito para *você
e seu agente* — a ordem de comando, a escada de ativos para sua língua, e
os inegociáveis. É o mapa para tudo abaixo.

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

:::tip[Sem analisador? Use retrotradução em vez disso]
Se você não pode sintetizar a partir de regras mas tem **monolíngue** texto em língua alvo,
peça ao seu agente para executar a **retrotradução**: `nmt-forge
backtranslate` traduz automaticamente seu texto monolíngue *para* English e emparelha
cada resultado com a sentença alvo **real**. O lado alvo permanece autêntico.
A ferramenta **audita vazamento do texto monolíngue primeiro** — porque esse texto pode
secretamente *ser* seus dados de avaliação. Veja o
[Cookbook de Retrotradução](/docs/network/tutorials/back-translation).
:::

---

## Passo 4 — Divida seus dados reais com segurança

Agora pegue seus pares **reais** e divida-os em train / dev / test. É aqui que o erro
mais destruidor de resultados em MT com poucos recursos se esconde, e onde
a proteção ganha seu valor.

> 🗣️ **Diga ao seu agente:** *"Divida o corpus real em um conjunto de teste e dev com
> `nmt-forge split`, disjunto por grupo, e registre-os. Use uma seed fixa para que
> seja reproduzível."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **O que a ferramenta faz — a proteção de divisão.** Ela faz **divisão disjunta por grupo**:
cada par compartilhando uma fonte *ou* um alvo é amarrado em um grupo,
e cada grupo inteiro cai inteiramente em um lado. Depois **verifica zero
sobreposição** e recusa continuar se alguma existir.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Isso elimina o vazamento **"Feed him" / "Feed her"**: um livro didático mapeia ambos os
exercícios English para uma palavra alvo (`asam`); uma divisão aleatória ingênua coloca uma cópia em train
e seu gêmeo em test, então o modelo "passa" por memória. Em um projeto real 17
de 54 linhas de teste vazaram dessa forma e pontuaram 83 vs 44 para linhas limpas — e cada
descoberta construída sobre esse número foi nula. `--register textbook` registra os conjuntos dev e
test (como `textbook-dev` e `textbook-test`) no espaço de trabalho para que cada
comando posterior saiba que são *conjuntos de avaliação que você nunca deve treinar*.

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

Um arquivo de configuração descreve a execução inteira; um comando a executa,
reproduzivelmente.

> 🗣️ **Diga ao seu agente:** *"Preencha a configuração de treinamento — aponte `dev` para nosso
> conjunto dev registrado, liste as lanes de dados ouro e sintético, escolha um modelo base pequeno
> com LoRA — depois execute `nmt-forge run` e observe os diagnósticos de agendamento."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **O que a ferramenta faz — quatro proteções de uma vez.**

- **Auditoria de vazamento antes do treinamento.** *Cada* lane — ouro, sintético, e qualquer
  texto retrotraduzido — é rastreado contra *cada* conjunto de avaliação registrado. Hits exatos, hits
  quase-duplicados (refraseados), e correspondências de arquivo inteiro em um conjunto de teste são
  fatais. Nada treina até que a mistura esteja limpa.
- **Cerca de dev.** O treinamento **recusa começar sem um conjunto dev registrado**, e
  só vai selecionar checkpoints nesse conjunto dev — nunca no conjunto de teste.
  (Até faz verificação de conteúdo das linhas dev contra os conjuntos de teste, para pegar o
  truque `cp test.jsonl dev.jsonl`.) A seleção de checkpoint pode usar dev **loss** ou
  uma métrica de **geração** dev — decodifique o conjunto dev e pontue a saída real,
  o sinal mais honesto.
- **Sanidade de agendamento.** Se sua mistura é pesada em sintético, a ferramenta *deriva* um
  piso de parada do tamanho de sua mistura e mantém o treinamento através do
  **platô** — a fase onde o modelo terminou o aprendizado sintético fácil e
  ainda não transferiu para qualidade real. Isso previne a
  "morte de meia época", onde parada antecipada ingênua sai em um vigésimo do
  plano. Cada intervenção imprime a trajetória de dev-loss e a razão, em
  linguagem natural.
- **Matemática de exposição + sintético marcado.** Dados ouro são upweighted (repetidos) para que
  os poucos dados reais não sejam afogados; o manifesto escreve o **exposição efetiva
  por sentença única** para que um A/B permaneça justo. Fontes sintéticas carregam uma
  tag; ouro permanece sem tag para que ancore o estilo de saída.

👀 **Como ler o resultado.** A execução imprime um **relatório dev com intervalos de confiança**
— não há saída de pontuação nua:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Se você vê uma mensagem `schedule-sanity` explicando que *manteve* o treinamento além de uma
parada prematura, essa é a proteção de platô funcionando — bom. A execução também escreve um
**manifesto**: hash de configuração, hashes de arquivo de dados, seeds, e o agendamento derivado, para que
a execução inteira seja reproduzível.

---

## Passo 6 — Avalie honestamente

Você tem um modelo. Antes de pontuá-lo no conjunto de teste, você escreve o que
espera — *primeiro*.

> 🗣️ **Diga ao seu agente:** *"Escreva um pré-registro para a pontuação do conjunto de teste —
> nossa métrica prevista, direção e margem — depois decodifique o conjunto de teste e
> pontue-o."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **O que a ferramenta faz — as proteções anti-storytelling.**

- **Pré-registro.** Pontuar um conjunto de **teste** registrado requer um
  pré-registro escrito *antes* do primeiro olhar. Sem ele, a tabela de comparação
  simplesmente **recusa renderizar**:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  Esta é a proteção contra disfarçar pós-dições ("é claro que melhorou em
  histórias orais") como predições. Escrever as suposições que *falham* é o que
  torna as que têm sucesso confiáveis.
- **Intervalos de confiança, sempre.** Cada pontuação renderiza com seu IC bootstrap de 95%;
  não há saída sem IC. Um bump `+0.5` cujos intervalos se sobrepõem não é uma
  vitória.
- **O ledger de avaliação.** Cada leitura de cada conjunto de avaliação é registrada (append-only,
  à prova de adulteração). Pergunte `nmt-forge ledger show --set textbook-test` como "gasto" um
  conjunto está. Conjuntos **Sealed** são one-shot — pontuados uma vez, depois fechados.

👀 **Como ler o resultado.** Leia o número **com seu intervalo e por registro**, e verifique
**qual métrica acreditar** antes de comemorar:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
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

> 🗣️ **Diga ao seu agente:** *"Mude uma coisa — adicione um tipo de template / mais
> dados retrotraduzidos / um modelo base diferente — retreine, e A/B contra a
> execução anterior no conjunto dev, com significância."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
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

1. **Mais cobertura** em síntese — adicione os fenômenos gramaticais faltantes que o
   relatório de cobertura sinalizou.
2. **Retrotradução** — transforme texto alvo monolíngue em mais pares de treinamento.
3. **Um modelo base maior ou mais adequado**, ou ajuste de rank/hiperparâmetro de LoRA.
4. **Currículo** — pré-treine em sintético, depois fine-tune nos pares reais.

---

## Passo 8 — Leve para a Rede

Um modelo honestamente treinado é exatamente o que a [Rede Champollion](/docs/network/)
foi construída para receber.

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

1. **Descubra** o que a língua tem (`discover`, `init`) — ausência é desconhecido, não zero.
2. **Aponte para** um analisador + dicionário se existirem (degraus 3–4), respeitando suas licenças.
3. **Sintetize** dados de treinamento verificados, citados, com cobertura verificada (`synth`) — ou **retrotraduz** texto monolíngue.
4. **Divida** dados reais disjuntos por grupo e registre os conjuntos de avaliação (`split`).
5. **Treine** uma configuração, cercada por dev, auditada por vazamento, ciente de platô (`run`).
6. **Avalie** com predições escritas primeiro, ICs sempre, a métrica certa (`prereg`, `score`).
7. **Itere** com A/Bs testados por significância (`compare`).
8. **Envie** para a Rede — onde trabalho honesto é o ponto.

Você nunca teve que memorizar as dez formas que resultados de MT com poucos recursos dão errado. A
ferramenta tornou o caminho honesto o padrão e recusou os atalhos com uma
explicação. Essa é a ideia toda: **as proteções pegam os erros amadores
para que você possa focar na língua.**

## Continue

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — cada termo aqui, definido com um exemplo.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — as dez proteções em uma página, cada uma com sua história medida.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) e [**Back-Translation**](/docs/network/tutorials/back-translation) — cookbooks mais profundos em técnicas específicas.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — construindo os dados reais em que tudo mais se apoia.
