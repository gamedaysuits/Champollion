---
sidebar_position: 3
title: "Treine seu primeiro modelo (com seu agente)"
description: "Um passo a passo para treinar um modelo de MT com poucos recursos direcionando um agente de codificação — o que você diz, o que forge faz, como é uma recusa e como ler o diagnóstico."
related:
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

Esta página é o loop completo. Cada passo é escrito como **o que você diz ao seu
agente**, **o que forge faz**, **como é uma recusa** (para que nenhum de vocês entre em pânico quando uma acontecer — uma recusa é a ferramenta funcionando), e, no final, **como
ler o relatório**.

:::tip A única regra para seu agente
Diga a ele: *"Sempre execute `nmt-forge status --json` primeiro, e após cada passo.
Faça o que seu `next_command` disser."* Esse único hábito transforma forge em um
trilho guiado. Se seu agente se conectar via MCP, o mesmo loop é a
ferramenta `forge_status` — veja o [Guia do Agente](/docs/network/getting-started/agent-guide).
:::

---

## Passo 0 — Aponte seu agente para seu idioma

**Você diz:** *"Quero treinar um modelo English→[seu idioma]. Comece descobrindo o que forge sabe sobre ele. O código ISO 639-3 é `crk`"* (use o código do seu idioma).

**forge faz:** `nmt-forge discover crk` lê o cartão do idioma — scripts,
dicionários, analisadores morfológicos, corpora existentes e conjuntos de avaliação (com qualquer
`do_not_train` / flags de quarentena), e métricas de árbitro por idioma. Ele coloca
seu idioma na **escada de ativos**: (1) texto paralelo → treinamento protegido; (2) + monolíngue → retrotradução marcada; (3) + dicionário/gramática → dados sintéticos citados; (4) + analisador → síntese verificada por viagem de ida e volta; (5) + uma métrica de árbitro → a própria métrica do idioma na pontuação e seleção de checkpoint.

**Um campo em branco significa DESCONHECIDO, nunca zero.** Um cartão esparso não significa "este idioma não tem nada" — pode ser que o recurso simplesmente não esteja registrado ainda. Você sempre pode trazer seu próprio corpus paralelo.

Depois: *"Estruture o projeto."* → `nmt-forge init crk` escreve um espaço de trabalho, uma
configuração inicial, e um `NEXT_STEPS` resumido.

---

## Passo 1 — Crie uma divisão que não possa trapacear

**Você diz:** *"Aqui está meu corpus paralelo `corpus.jsonl`. Divida-o em
train/dev/test e registre os conjuntos dev e test."*

**forge faz:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. Ele faz uma divisão **disjunta por grupo**: qualquer
dois pares de sentenças que compartilhem uma fonte *ou* um alvo caem no **mesmo** lado.
Esta é a forma mais comum de pontuações de baixo recurso ficarem inflacionadas — um livro didático
mapeia muitos exercícios em inglês para uma palavra alvo, uma divisão aleatória ingênua coloca uma cópia
no train e seu gêmeo no test, e o modelo "traduz" respostas que memorizou.

**Como é uma recusa:** se você der a forge uma divisão que você mesmo fez e ela
não for disjunta, `verify-split` falha com as chaves compartilhadas nomeadas — *"essas linhas
compartilham um alvo canônico entre train e test."* Correção: deixe forge fazer a divisão.

---

## Passo 2 — Verifique vazamentos

**Você diz:** *"Antes de treinarmos, verifique o corpus de treinamento para vazamentos contra
os conjuntos de avaliação."*

**forge faz:** `nmt-forge leak-audit corpus.jsonl`. Ele verifica seu corpus
contra todos os conjuntos dev/test/selados registrados:

- **Exato ou quase-duplicado no lado alvo** (a resposta de referência está em seus
  dados de treinamento) → **fatal**. Este é vazamento de resposta.
- **Quase-duplicado no lado fonte com uma resposta *diferente*** → **informacional,
  mantido**. Mesmo prompt, tradução diferente é um par de contraste mínimo legítimo, não um vazamento — forge relata mas nunca deleta. (Esta distinção
  foi um bug real que pegamos ao usar a ferramenta: uma versão anterior marcava 44 linhas
  como fatais quando apenas 17 eram vazamentos genuínos.)

**Como é uma recusa:** *"linha 118: quase-duplicado no lado alvo do conjunto test
`mypair-test` (Jaccard 0.83) — vazamento de resposta."* Correção: seu agente executa
`nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` e treina nos
sobreviventes.

---

## Passo 3 — Preveja antes de olhar

**Você diz:** *"Escreva o que esperamos que o modelo faça, depois treinaremos."*

**forge faz:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. Você (ou seu agente, em voz alta) registra previsões falsificáveis —
qual métrica, qual direção, quão grande — **antes** de qualquer pontuação de teste existir.

**Como é uma recusa:** se seu agente tenta pontuar o conjunto de teste sem
pré-registro, `score` recusa: *"pontuar um conjunto de teste é recusado sem um
pré-registro que anteceda a primeira leitura de pontuação."* Isto é o que separa um
resultado de uma narrativa orientada por resultados. Correção: pré-registre primeiro.

:::info Por que isto parece trabalho extra
É o trabalho. Cada proteção aqui é um erro que enganou pesquisadores reais.
A ferramenta torna o caminho honesto o caminho fácil e o caminho desonesto aquele que
o para.
:::

---

## Passo 4 — Verifique os portões, depois treine

**Você diz:** *"A execução de treinamento passará em todas as suas verificações? Se sim, treine."*

**forge faz:** `nmt-forge preflight run` lista cada portão que a execução atingirá —
dev-fence presente, auditoria de vazamento limpa, piso de cronograma derivado, espaço de decodificação verificado — cada ✓ ou ✗ com uma correção. Quando tudo está verde:
`nmt-forge run config.json`.

O treinamento é o único passo que **não** é uma chamada de ferramenta instantânea — usa uma GPU e
leva minutos a horas. Seu agente a executa em um terminal e observa as
linhas `[schedule-sanity]`. forge deriva o piso de parada antecipada **floor** de sua
mistura de dados, então uma execução pesada em sintético não morre na metade de uma época quando a
perda real-dev oscila (um modo de falha real — veja
[Diagnosticando uma Execução de Treinamento](/docs/network/getting-started/diagnosing-training)).

Quando termina, forge **selecionou um checkpoint no conjunto dev cercado** (nunca
no conjunto de teste) e escreveu um `run-manifest.json`.

---

## Passo 5 — Feche o loop: avalie e diagnostique

**Você diz:** *"Pontue o modelo na bateria de testes e me diga o que melhorar."*

**forge faz:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. Isto **fecha o loop** em um comando: decodifica a bateria de testes com o checkpoint que a execução selecionou, pontua (com portão de pré-registro, com intervalos de confiança de 95% em cada número), e anexa uma seção **Diagnóstico &
Recomendações** em linguagem clara. (Antes deste comando existir, você tinha que criar um symlink do checkpoint e executar um decodificador manualmente — exatamente onde um novato se perdia.)

### Como ler o relatório battery-lint

O relatório é uma tabela de pontuações **por registro** (livro didático, governo, história oral, …), cada uma com seu intervalo de confiança, seguida pelo diagnóstico. O diagnóstico nomeia seus **registros mais fracos** e, para cada um, a causa mais provável e o **alavanca** a puxar a seguir:

| Se o diagnóstico disser… | Significa… | A alavanca |
|---|---|---|
| `R1-vocabulary-gap` | o registro pontua baixo **e** as saídas estão inacabadas; o modelo carece das palavras | **VOCABULÁRIO** — aumente o léxico, depois re-verifique o funil |
| `R2-structure-gap` | as palavras são conhecidas mas as *formas* de sentença não são | **ESTRUTURA** — adicione as construções faltantes (templates/compositor) |
| `R3-mixed-convention` | as saídas misturam ortografias | **ORTOGRAFIA** — normalize o corpus para uma convenção, retreine |
| `R4-optimism-bound` | a pontuação "completa" é inflacionada por linhas de avaliação quase-gêmeas | **MEDIÇÃO** — cite a pontuação estrita para generalização |
| `R5-low-power` | o intervalo de confiança é amplo | **MEDIÇÃO** — não aja em deltas menores que o IC; aumente o conjunto de avaliação |
| `R7-transfer-plateau` | ótimo em sintético, estagnado em texto real | **DADOS-REAIS** — retrotraduz dados monolíngues ou obtenha sentenças paralelas reais |

Cada descoberta carrega a evidência em que disparou. Para as descobertas `--json` em que seu
agente pode agir programaticamente: `nmt-forge lint <battery-manifest.json>`.

---

## O que você acabou de fazer

Você treinou um modelo cuja pontuação você pode realmente acreditar: sem respostas vazadas, um
checkpoint escolhido sem olhar para o conjunto de teste, barras de erro em cada número,
previsões escritas antes dos resultados, e um diagnóstico que nomeia a próxima alavanca
em vez de deixá-lo adivinhar. Esse é o ponto todo — **o resultado honesto
é o padrão, e não levou nenhuma experiência em MT para chegar lá.**

Quando os números decepcionam (vão, a primeira vez), vá para
[Diagnosticando uma Execução de Treinamento](/docs/network/getting-started/diagnosing-training) —
é orientado por sintomas, escrito para exatamente esse momento.
