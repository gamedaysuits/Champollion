---
title: "Treinamento com o nmt-forge"
slug: /agents/training
description: "Como o nmt-forge treina e testa um modelo nos trilhos: as predefinições de modelo e o que o --model auto escolhe por memória, o loop protegido comando por comando, limites de decodificação e de comprimento, tarefas em segundo plano e a fila de um treinamento por vez, espaço em disco (checkpoints mantidos, a verificação de disco, tidy), exportar e servir, as rodadas de aprimoramento (o veredito da rodada, o veredito do/a falante) e a oferta de modelo mais forte, dados sintéticos, uma tabela verificada de sintoma → causa → correção e a taxonomia de falhas."
---

# Treinamento com nmt-forge

O `nmt-forge` treina um modelo com os pares do povo, dentro de salvaguardas: ele
recusa o que corromperia um resultado, e cada recusa informa o quê, o porquê e a
correção. Ele não implementa nenhuma métrica própria — cada pontuação vem do
mecanismo de avaliação (`mt-eval`), o mesmo código que pontua tudo o mais.

Nos trilhos, você raramente digita estes comandos: o `champollion next` os indica e,
a partir da etapa `forge`, retransmite o próprio orientador do forge
(`nmt-forge status`). Esta página explica o que essas etapas fazem.

## Modelos

O `nmt-forge init --model <preset>` grava uma predefinição em `config.json` como
números explícitos (com hash integrado à identidade de cada execução: uma versão posterior do forge
nunca altera as execuções de um projeto existente). O `nmt-forge use-model <preset>`
alterna o projeto.

| Predefinição | O que é | Requisitos | O que o forge diz para esperar |
|---|---|---|---|
| `cpu-tiny` | Um transformer pequeno treinado do zero com os pares, com um vocabulário de 4.000 partes aprendido a partir das linhas de treinamento | Apenas CPU · sem download | "em ~1–2 mil pares: chrF++ em torno de 5–30 (o limite superior apenas para dados fortemente baseados em modelos) — frases memorizadas e os modelos dos seus dados, não tradução geral" |
| `byt5-small` | O ByT5-small do Google (300M de parâmetros, lê bytes — sem vocabulário para ajustar), com ajuste fino | Download de ~1,2 GB · Apple silicon ou GPU CUDA recomendada | "nos testes do próprio forge, ele aprendeu muito mais com os mesmos pares do que o cpu-tiny — ainda assim, meça-o contra o seu modelo em uso no seu conjunto de desenvolvimento" |
| `byt5-small-lowmem` | O mesmo modelo, taxa de aprendizado e limites de tamanho, configurado para um computador com 8–15 GB de memória: Adafactor, gradient checkpointing e lotes de 4 pares acumulados 4 vezes (os mesmos 16 pares por etapa) — menos memória por etapa, mais tempo. Ainda não medido em um computador de 8 GB | como `byt5-small` | como `byt5-small` |
| `cpu-finetune` | Um modelo Marian/opus-mt pré-treinado pequeno, com ajuste fino em CPU. Você especifica a base (`--base`); ela nunca é adivinhada | Apenas CPU · download de ~300 MB | "depende do grau de parentesco do idioma de destino da base — meça-o contra o cpu-tiny no seu conjunto de desenvolvimento" |
| `nllb-600m` | NLLB-200 destilado de 600M com LoRA | Uma GPU CUDA (8 GB+) · download de ~2,5 GB | "o mais forte dos três quando o NLLB cobre um idioma relacionado; ainda assim, meça-o — nunca presuma" |

Cada predefinição treina com o extra de treinamento do forge (`nmt-forge[hf]`), com seed 42.
Nenhuma predefinição define um orçamento de tempo: esse número pertence ao povo.

- **Sem `--model`**, o `init` grava `cpu-tiny`.
- **`--model auto`** (o que os trilhos passam) lê a memória da GPU na qual o forge
  pode treinar — em um Mac com Apple silicon, a memória do computador (compartilhada
  com a GPU); com `nvidia-smi` no `PATH`, a da maior placa NVIDIA:
  16 GB ou mais (ou memória que ele não consegue ler) → `byt5-small`; 8–15 GB →
  `byt5-small-lowmem`; abaixo de 8 GB → `cpu-tiny`. Sem nenhuma das duas GPUs, `cpu-tiny`.
  O motivo, junto com a memória encontrada, é exibido (`chosen: …`) e retornado
  como `model_choice` em `--json`. Ele não testa se a GPU funciona.
  `NMT_FORGE_AUTO_PRESET` o substitui (deve especificar uma predefinição).
- **O modelo mais forte que as rodadas oferecem** vai apenas para um projeto cujo modelo
  em uso seja `cpu-tiny`: `byt5-small-lowmem` onde `--model auto` o escolheria,
  caso contrário `byt5-small` — também em um computador onde `auto` escolheria
  `cpu-tiny`; o `why` da oferta especifica do que ele precisa.

**Nota.** Nunca descreva a expectativa de uma predefinição como uma promessa. Meça no
conjunto de desenvolvimento.

## O ciclo com salvaguardas

Cada comando aceita `--json`; `--workspace <dir>` (o padrão é `.forge`) vai
antes do subcomando. O forge recusa flags abreviadas.

| Etapa | Comando | O que faz | O que recusa |
|---|---|---|---|
| Oficina | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Grava `.forge/`, `config.json`, `NEXT_STEPS.md` | Um `--pair` ilegível; `cpu-finetune` sem `--base` |
| Conjunto de teste | `nmt-forge registry add project-test <file> --role test` | Fixa o sha256 do arquivo; inicia seu registro de leitura | Linhas sintéticas em um conjunto de teste ou selado; um nome já registrado com outro conteúdo (a menos que `--allow-rotate`) |
| Triagem | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Faz a triagem de cada par em relação a cada conjunto de dev, de teste e selado registrado; grava uma cópia limpa | Sobrescrever um arquivo em uso (a menos que `--overwrite`); um resultado sem nenhum dado de treino restante |
| Predição | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Grava a predição das pessoas antes de qualquer pontuação | Um id existente; gravar após qualquer leitura de pontuação do conjunto, pelo forge ou `mt-eval` (a menos que `--allow-after-reads`, registrado no livro-razão) |
| Conjunto de dev | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Uma divisão de dev disjunta por grupos, registrada como `project-dev`. O `<n>` dos trilhos: um em cada dez pares triados, pelo menos 50, no máximo 500 — um quarto deles abaixo de 200 pares ([shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` mantém cópias próximas (sobreposição de palavras ≥ 0,6) em um só lado, o limiar aplicado pela triagem de cada rodada posterior; os trilhos definem `--max-group` como metade do tamanho de dev mais um, para que um arquivo gerado a partir de templates ainda se divida | Um lado com mais de 1,5× o solicitado, ou o treino mantendo menos da metade das linhas |
| Piso | `nmt-forge floor <word lists>` | Traduz o conjunto de dev palavra por palavra a partir do dicionário e o avalia da mesma forma que a pontuação de dev de uma execução | Nenhum conjunto de dev registrado |
| Checagem | `nmt-forge preflight run --config config.json` | Executa todas as verificações que a execução encontrará, com correções; sai com código 2 se alguma falhar | — |
| Treinar | `nmt-forge run config.json --detach` | Treina, escolhe o checkpoint no dev, remove os outros checkpoints da execução ([espaço em disco](#disk-space)), grava `.forge/runs/<run name>-<8 hex>/` com `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Uma execução que já existe (mesma configuração, arquivos de treino e conjunto de dev); um disco sem espaço para ela (`disk-room`, antes que qualquer coisa seja gravada; `--skip-disk-check` substitui); uma execução em andamento; linhas de treino que vazam para um conjunto de teste ou selado; linhas de dev no treino; dados marcados como do-not-train ou em quarentena; `terms.training: not-allowed`; dados sintéticos acima do limite; um limite de decodificação curto demais para as referências; chaves de configuração desconhecidas |
| Pontuação de teste | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Avalia o conjunto de teste uma vez, em relação à predição; empacota o modelo, com `input-words.json` ao lado de sua pasta — as palavras nas quais ele foi treinado, para que um servidor possa apontar as que nunca viu ([serviço](/docs/agents/serving#what-an-export-holds)) | Nenhum pré-registro, ou vários e nenhum `--prereg`; um conjunto selado já utilizado; um `--out` não vazio sem `--force` |
| Escolher | `nmt-forge choose <export>/model` | Registra a escolha de modelo feita pelas pessoas | Uma pasta que não seja uma exportação registrada com um modelo |
| Servir | `nmt-forge serve <export>/model --detach` | Disponibiliza o modelo neste computador ([serviço](/docs/agents/serving#nmt-forge-serve)) | Fora do loopback sem um token, ou um modelo somente local sem `--holders-agreed-by` |

Tudo o que importa é gravado no livro-razão encadeado por hash
(`.forge/ledger.jsonl`): registros, leituras com sua finalidade, previsões,
pontuações, usos de conjuntos selados, substituições, vereditos de auditoria, o piso, exportações,
escolhas, disponibilizações e inícios e términos de tarefas. O manifesto de execução é o registro de uma
execução.

**Validações preliminares:** configuração (exibe o hash completo da configuração), correspondência do workspace, nenhuma
execução em andamento, barreira de desenvolvimento, dados de treinamento, backend instalado, plugins de
seleção, quase-gêmeos de teste e quase-gêmeos de desenvolvimento (avisos), auditoria de vazamento, combinação de
treinamento, margem de geração, consistência do cronograma.

**Decodificação.** A decodificação final de desenvolvimento, a leitura de teste (`export`), um modelo em uso
traduzindo o conjunto de desenvolvimento novamente e o modelo disponibilizado utilizam busca em feixe (beam search) com
`decode.num_beams` (4, a menos que `config.json` indique o contrário); a seleção de
checkpoints, que classifica vários checkpoints, decodifica de forma gulosa (greedy). Uma exportação
registra `beams_applied`, e o `nmt-forge serve` decodifica da mesma forma como o modelo foi
medido: uma exportação mais antiga sem isso é disponibilizada de forma gulosa.

**Limites de tamanho.** Um modelo aprende a partir de no máximo `model.max_src` tokens de uma
frase de origem e `model.max_tgt` de sua tradução, lê no máximo
`model.max_src` quando traduz e grava no máximo
`decode.max_new_tokens` (`byt5-small`: 320 bytes cada — cerca de 320 letras em
escrita latina, cerca de 100 em silábico; `cpu-tiny`: 256 partes na entrada, 384 na saída).
Nada é cortado silenciosamente: o treinamento conta os pares que ultrapassam qualquer um dos limites antes
de cortá-los, e a decodificação final de desenvolvimento conta frases cortadas na entrada e
traduções que pararam no limite máximo. Ambos vão para o manifesto de execução
(`length_limits`), e o `status` avisa, com a correção: divida frases longas ou
aumente `model.max_src` e `model.max_tgt` (e `decode.max_new_tokens`) em
`config.json` — o treinamento então levará mais tempo.

**Nota.** O `nmt-forge run` em si não exige uma previsão; os trilhos a pedem
primeiro. Não treine antes que a etapa de previsão esteja concluída.

**Nota.** O `export` é a etapa que lê o conjunto de teste. Executá-la é um
marco importante, com a previsão do povo já registrada — nunca uma verificação de
rotina.

## Tarefas em segundo plano

`run --detach` e `serve --detach` iniciam uma tarefa supervisionada e retornam.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- Estados: `running`, `finished`, `refused`, `crashed`, `stalled`,
  `deadline`, `interrupted`, `lost`. `lost` é uma tarefa cujo supervisor terminou
  sem registro — inclusive após uma reinicialização, quando o número do seu processo agora
  pertence a outro processo.
- **Um treinamento de cada vez neste computador.** As tarefas de treinamento entram em fila
  para toda a máquina, por ordem de chegada (`~/.nmt-forge/machine/train-queue`),
  em todos os projetos. Uma tarefa enfileirada permanece como `running`, com `queued_behind`
  (a tarefa pela qual ela espera) em `nmt-forge jobs --json`; `status` é `training`
  e informa atrás de quem ela está esperando, e ela inicia sozinha. Uma interrupção enquanto ela
  espera a encerra sem ter sido iniciada (`interrupted`); uma espera de 24 horas a encerra
  (`deadline`).
- **Limites** (tarefas de treinamento): nenhum sinal de vida por 15 minutos na inicialização
  (`--startup-minutes`); nenhum progresso pelo tempo que for maior entre 10 minutos e 30 vezes
  o tempo médio por etapa (`--stall-minutes`); um prazo de `--deadline-hours`,
  ou então o orçamento de tempo da configuração × 1,25, ou 24 horas. Uma tarefa que ultrapassa um limite é
  interrompida e registrada.
- **Interrupção**: a execução para em sua próxima etapa; o supervisor escala para
  finalizar após 60 s e força o encerramento (kill) 10 s depois.
- **A validação de tempo de relógio** (backends do Hugging Face): após o aquecimento, o forge cronometra
  as etapas, projeta a execução e recusa uma que não caiba no orçamento
  (`wall-clock budget exceeded: …`). Sem um orçamento definido, o limite é um teto de
  24 horas.
- Enquanto uma tarefa de treinamento é executada, `status` fica como `training` e a etapa dos trilhos é
  `wait`. Uma tarefa que falhou gera um aviso em todos os status posteriores.
- **Retomada.** Quando a última tarefa de treinamento terminou em `lost`, `crashed`, `stalled`
  ou `deadline` após salvar um checkpoint, o `status` indica `nmt-forge preflight
  run --config config.json && nmt-forge run config.json --resume --detach`:
  uma nova execução que começa a partir do último checkpoint da execução interrompida (seus
  pesos, um otimizador novo, as épocas restantes), e cujo manifesto informa
  de onde ela foi retomada (`resumed_from`). Ela nunca é oferecida após uma interrupção
  manual.
- Tarefas desanexadas (detached) funcionam apenas em sistemas POSIX (macOS, Linux).

## Espaço em disco

O treinamento grava checkpoints: até `model.save_total_limit` deles de uma vez
(4, a menos que `config.json` diga o contrário), cerca de 1,4 GB cada para o ByT5-small.
Antes dessas regras, cada rodada de aprimoramento de um projeto ByT5-small mantinha cerca de
5,6 GB, nada removia o modelo de uma rodada anterior e um disco cheio interrompia a
execução durante o salvamento. O GB do Forge equivale a 1024³ bytes.

- **Uma execução finalizada mantém apenas o checkpoint selecionado.** Todas as outras
  pastas `checkpoint-*` da execução são removidas assim que o checkpoint é escolhido:
  nada mais as lê (`export` copia o selecionado; a próxima rodada
  começa a partir do modelo em uso). O manifesto registra `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` no bloco
  `model` de `config.json` mantém todos eles. Qualquer outro valor é recusado quando a configuração
  é lida, antes de qualquer treinamento (`ConfigError`; aqui para o valor `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Bloqueio.** Uma execução que o disco não comporta é recusada antes que qualquer coisa seja gravada
  (guarda `disk-room`); uma execução desconectada é recusada imediatamente, antes que seu trabalho
  comece. A estimativa: o tamanho de um checkpoint — o checkpoint mantido de
  uma execução anterior da mesma base neste espaço de trabalho, caso contrário os próprios arquivos
  de pesos da base (uma pasta local ou o cache do Hugging Face) — multiplicado
  por `model.save_total_limit`, mais 1 GB para concluir; nunca menos de 2 GB. A
  recusa exibe
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  — ou, quando nenhum tamanho é conhecido, *"(pelo menos essa quantidade deve permanecer livre
  qualquer que seja o modelo)"* — depois
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  e uma `fix` que cita o que `nmt-forge tidy` pode liberar aqui (quando puder
  liberar algo), mover outros arquivos para fora do disco e `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (com ou sem `--detach`) inicia
  mesmo assim. O `disk_room` do manifesto registra a verificação — `free_bytes`,
  `checkpoint_bytes` (`null` quando desconhecido), `checkpoints_at_once`,
  `need_bytes` — ou `{"skipped": "--skip-disk-check"}`. **Nota.** A
  estimativa pode estar errada; ignorar ou não a verificação é uma decisão da pessoa.
- **`nmt-forge tidy`** lista os pesos de modelo de rodadas anteriores que nada
  utiliza — cada execução com seu tamanho, o total, o espaço livre — e não remove
  nada. `nmt-forge tidy --yes` os remove. Ele nunca remove o modelo em
  uso, a execução mais recente ou o modelo que o modelo em uso substituiu (a planilha
  de revisão cega gera rascunhos com ele); a linha `Kept:` da saída cita cada um, acompanhado
  do motivo. Uma execução limpa mantém seu registro — manifesto, traduções de dev, relatório —
  e seu manifesto recebe `model_removed` (`at`, `by`, `bytes`, `why`); o
  ledger recebe uma entrada `tidy` (`runs`, `bytes`). Uma execução limpa solicitada
  a traduzir (`compare-runs` retraduzindo o conjunto dev com ela) é recusada:
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Nota.** `--yes` exclui arquivos: mostre a lista à pessoa e execute-o apenas
  com a confirmação dela.
- **`status` avisa** — uma linha em `warnings`, transmitida pelos trilhos — quando o
  disco que contém o espaço de trabalho tem menos de 10 GB livres, ou quando a limpeza pode liberar 5 GB
  ou mais: *"este computador tem X GB livres; os modelos de N rodada(s) anterior(es)
  que nada utiliza ocupam Y GB — `nmt-forge tidy` lista-os,
  `nmt-forge tidy --yes` libera o espaço (o modelo em uso, o mais recente e
  o que ele substituiu são mantidos)"* (a parte após o ponto e vírgula apenas quando
  a limpeza puder liberar algo).

## As rodadas de aprimoramento

Assim que um modelo está em uso, cada rodada treina uma nova execução com mais dados usando o
mesmo conjunto de desenvolvimento.

**Como uma rodada treina.** O `champollion improve prepare` executa `nmt-forge
round-plan --config config.json`, which rewrites `config.json` de uma de duas
maneiras e grava o plano no livro-razão (`round-plan`):

- **Continuando a partir do modelo em uso** (`init_from` sua pasta de modelo): 4 passagens
  (épocas) sobre todas as frases até o momento — as antigas evitam que ele se
  esqueça — com metade da taxa de aprendizado. Muito mais curto do que treinar desde
  o início. As configurações completas aguardam em `config.json` sob `model_full`.
- **Desde o início**, com as configurações completas restauradas, quando nenhum modelo estiver em
  uso ainda; quando o modelo tiver sido alterado (`use-model`, que também remove
  `model_full`); para o `cpu-tiny`, cujo vocabulário vem das frases de
  treinamento (ele treina em minutos); para um modelo com adaptador (LoRA); e a cada
  4 rodadas, para que muitas continuações curtas não sofram desvio (drift).

`prepare` imprime o plano e seu motivo, e registra `training` (`mode`,
`epochs`) em `improve/round-<k>/prepared.json`. De qualquer forma, a nova execução é
avaliada em relação ao modelo em uso nas mesmas frases de dev. Em seguida (1, 3 e
4 são estados indicados pelo orientador do forge; 2 é registrado pelos trilhos):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — os dois modelos, emparelhados
   frase a frase no conjunto dev. Com menos de 50 frases de dev, o
   veredito é **too-few**, quaisquer que sejam as pontuações: *"frases de dev insuficientes
   para avaliar: abaixo de 50, uma diferença não se distingue do acaso com confiabilidade, qualquer
   que seja o seu tamanho"*. A partir de 50: **better** somente quando o p do teste pareado < 0,05
   **e** o intervalo de 95% da diferença estiver acima de zero; **worse** quando
   p < 0,05 e estiver abaixo de zero; caso contrário, **no-change**. Cada veredito indica
   a menor diferença que o seu conjunto dev mostra de forma confiável. O conjunto de teste nunca
   é lido. Recusado (`improve-loop`) para execuções em conjuntos dev diferentes, uma execução
   sem traduções de dev salvas ou um conjunto dev alterado desde a nova execução.
2. **O veredito do falante**, nos casos em que o conjunto dev não conseguiu decidir. O modelo de uma
   rodada que não foi colocado em uso rascunha metade das linhas rascunhadas da
   próxima planilha de revisão, às cegas (`draft-newer`, abaixo), e `champollion improve
   marks` registra as contagens do falante com o forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   O Forge só atua sobre isso após um veredito **too-few** ou **no-change**. Um
   teste de duas proporções agrupadas, bicaudal a 5% (|z| > 1,96), fornece `clear`:
   `newer`, `in-use` ou `neither`; a entrada `improve-speaker` do ledger guarda
   os nomes das duas execuções, as quatro contagens, `z` e `clear` — apenas contagens. Ele
   recusa contagens abaixo de 0, mais corretas do que julgadas, e um modelo sem nenhum
   rascunho julgado. Seu texto: *"Avaliando às cegas na mesma visita, o falante
   marcou o modelo mais recente como correto em A de B frases novas (P%) e o modelo
   em uso em C de D (Q%)"*, seguido de *"o modelo mais recente é claramente melhor nestas
   frases — o forge oferece colocá-lo em uso"*, *"o modelo em uso é
   claramente melhor nestas frases — ele permanece"* ou *"nenhuma diferença clara
   nestas frases — o modelo em uso permanece"*.
3. **`improve-promote`** (`confirm`), em caso de **better** — ou de **too-few** ou
   **no-change** quando o mais recente `speaker-verdict` nessa execução indicar
   `clear: newer` (nunca em **worse**). É uma oferta: um veredito por si só não coloca
   nada em uso. Com a confirmação das pessoas, ele exporta a nova execução sem ler
   o conjunto de teste (`--no-eval`), registra-a como escolhida (`choose`), interrompe o
   servidor em execução e serve o novo modelo na mesma porta. Apenas esse
   `export` e `choose` contam como colocar um modelo em uso: até lá, o
   relatório da rodada exibe *"mensuravelmente melhor: não colocado em uso — as pessoas
   não o escolheram"*, e seu progresso, projeção e verificação de sobreajuste deixam o
   modelo de fora. Com as avaliações do falante, seu `why` adiciona as contagens deles e *"uma
   diferença clara: o modelo mais recente é melhor nas frases de que a família
   precisa"*. Na próxima planilha, metade das linhas rascunhadas vem do modelo que ele
   substituiu, de modo que o falante verifica a promoção às cegas (abaixo).
4. Caso contrário, o modelo em uso permanece e a próxima rodada começa — a menos que os
   dois últimos vereditos de rodada desde a última alteração de modelo sejam ambos
   **no-change** ou **worse**, com `cpu-tiny` em uso. A última alteração de
   modelo é a entrada mais recente de `model-change` (uma troca de predefinição ou um `not-now`) ou
   `choose` no ledger — qualquer modelo que as pessoas tenham colocado em uso, incluindo
   uma promoção baseada nas avaliações do falante. Uma rodada **too-few** não é uma
   rodada julgada: quando qualquer uma das duas últimas for too-few, não há oferta.
   Em seguida, **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (ou
   `not-now`), a predefinição `byt5-small` ou `byt5-small-lowmem`
   ([modelos](#models)). O espaço de resposta é `try_it`. `yes` reescreve o
   modelo da configuração (mantendo o orçamento de tempo das pessoas) e o próximo passo o treina;
   `not-now` não altera nada. Ambos são gravados no ledger
   (`model-change`), e a oferta só retorna após mais duas rodadas desse tipo.
   Via MCP, "agora não" aqui é a resposta `try_it: "not-now"`;
   `declined: true` é recusado nesta etapa
   ([MCP](/docs/agents/mcp#not-now)). Seu `why` nunca diz que mais frases não
   estão ajudando: quando o conjunto dev for pequeno demais para ver o ganho de uma rodada, *"pequenos
   ganhos podem estar ocultos"*; caso contrário, as rodadas trouxeram *"nenhuma alteração que as frases
   de dev possam identificar (cerca de X pontos chrF++ ou mais): as rodadas podem estar
   adicionando menos do que isso, ou nada"* — perto do topo da curva, uma rodada
   adiciona cerca de meio ponto de chrF++, abaixo do que 200 frases de dev mostram.
   **Nota.** `--answer` tem como padrão `yes`: sempre passe a resposta das pessoas
   explicitamente.

Os trilhos conduzem o restante de uma rodada (`champollion improve …`): `nmt-forge
wishlist` gera a folha com o que mais ajudaria (40 prompts por padrão, com
pelo menos um quarto deixado aberto; as palavras nela que o modelo nunca viu solicitam duas ou
três frases cada, cada uma dizendo algo diferente — uma palavra vista apenas uma vez no
treino raramente é aprendida
([medição](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` detalha o chrF++ de dev por tipo
de frase, e `nmt-forge grow-dev` adiciona as frases de prática do falante ao
conjunto de dev sob o mesmo nome — nunca uma linha já presente no dev, nunca uma
cuja fonte esteja em um conjunto de teste ou selado. Um tipo de frase direciona a
lista de desejos somente quando sua pontuação fica claramente abaixo do restante
([medição](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (executado por `champollion improve sheet`) gera rascunhos para uma
metade aleatória das linhas da próxima folha de revisão com o outro modelo, sem identificação, para que o
falante avalie ambos os modelos às cegas
([medição](/docs/agents/measurement#the-speakers-marks)): o modelo treinado mais recente quando ele não for o que está em uso (sua rodada não foi colocada em
uso) ou, após uma promoção, o modelo que o atual substituiu. Seu `--json`
informa qual deles (`relation`: `newer` ou `replaced`, `null` quando não há outro
modelo e todas as linhas são do modelo em uso), com `other`, `in_use`, os
pares de treino por trás de cada um (`other_pairs`, `in_use_pairs`) e `n`; a
entrada `draft-newer` do livro-razão registra o mesmo. Como transmitir uma rodada:
[orientação](/docs/agents/coaching).

## Dados sintéticos e retrotradução

- O `nmt-forge synth <pack> --out <file>` executa o gerador de um pacote de idioma.
  O forge não inclui pacotes. Cada linha é verificada e recebe o carimbo `synthetic: true`.
- Um arquivo sintético é treinado como uma trilha identificada em `config.json`
  (`data.synthetic`, `{"path", "tag": "<synth>"}`). Acima de 15% de um mesmo tipo, a execução
  é recusada, a menos que a configuração especifique `mix.synthetic_sample`;
  o `nmt-forge sample --cap 0.15 --key kind` extrai uma amostra limitada.
- **A retrotradução não possui um comando.** Ela é uma função de biblioteca
  (`nmt_forge.training.backtranslation.backtranslate`): você fornece o
  modelo reverso; ele primeiro faz a triagem do texto monolíngue em relação a todos os conjuntos registrados
  e identifica sua saída como `<bt>`; a saída então treina como uma trilha sintética.
  Nenhum filtro de qualidade é executado sobre ela. `config.data.monolingual` é recusado.
- **Nota.** O texto monolíngue pertence aos dados do povo como qualquer outro: seus termos sidecar
  se aplicam, e um modelo reverso que seja um LLM hospedado o envia para um provedor
  ([regras de dados](/docs/agents/data-rules)).

## Sintoma → causa → correção

| Sintoma | Causa provável | Solução |
|---|---|---|
| `cpu-tiny` pontua entre 5 e 30 chrF++ no dev | É fraco por concepção: um livro de frases para expressões parecidas com seus dados de treino | Mais pares reais; em Apple Silicon ou uma GPU, `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem` onde a GPU tiver de 8 a 15 GB) |
| "Bom em modelos, ruim em texto real" | Regra R7 (platô de transferência): a perda no dev atingiu o mínimo antes do último checkpoint e subiu 5% ou mais. Ela é acionada em qualquer aumento desse tipo, não importa o que o chrF++ de dev tenha feito — interprete-a junto com as pontuações de dev | Mais pares reais. Exibido por `nmt-forge lint <run-manifest.json>`, não pela exportação |
| A pontuação parece boa demais | Cópias ou cópias aproximadas do teste no treino; ou a maioria das linhas de teste tem um par gêmeo no treino (R4-recall-not-translation, em metade ou mais) | `leak-audit --drop-test-twins` para obter um arquivo livre de gêmeos; relate as pontuações com e sem os gêmeos |
| Uma pequena diferença entre dois modelos | O intervalo é amplo (R5-low-power, intervalo com largura superior a 8 pontos) | `nmt-forge compare` (teste pareado); para rodadas, `compare-runs`. Aumente o conjunto de dev |
| Uma rodada informa "poucas frases de dev para discernir" (`too-few`) | O conjunto de dev contém menos de 50 frases: nenhuma comparação decide nessa faixa | Nada a corrigir: a próxima folha combina os rascunhos de ambos os modelos às cegas e as marcações do falante decidem; uma a cada duas linhas da folha é uma linha de prática até que o conjunto de dev contenha 50 |
| Uma rodada informa "nenhuma mudança mensurável" | O conjunto de dev é pequeno demais para perceber o ganho de uma rodada | Aumente-o a partir das frases de prática do falante (`grow-dev`, conduzido por `champollion improve prepare`) |
| Treinamento recusado: `[disk-room] this computer has … free` | O disco não tem espaço para os checkpoints da execução | `nmt-forge tidy` lista o que os modelos de rodadas anteriores liberariam; `nmt-forge tidy --yes` mediante a confirmação da pessoa; ou libere espaço em outro local. `--skip-disk-check` somente quando a pessoa decidir que a estimativa está incorreta |
| Uma execução não supera o piso do dicionário | O treino não aprendeu nada além do que a lista de palavras já fornece | Mais pares; verifique a cobertura do piso; comunique isso às pessoas |
| O conjunto de dev está saturado | O limite inferior do intervalo está em 99% do teto | Um conjunto de dev mais difícil; a pontuação não consegue subir mais |
| Recusado antes do treino | Consulte a linha "Treinar" acima; `preflight run` indica cada barreira reprovada e sua correção | Siga a correção. Um extra de treinamento ausente: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (ou `pip` no próprio Python do forge) |
| Interrompido pelo relógio | A execução estimada excede o tempo limite previsto (24 horas quando nenhum for definido) | Um modelo menor ou menos épocas, ou um limite de tempo definido pelas pessoas (`model.time_budget_hours`) |
| Uma tarefa em segundo plano falhou | `nmt-forge jobs` mostra `crashed`, `stalled`, `deadline`, `lost` ou `refused` | Leia seu `stderr.log` em `.forge/jobs/<name>/` e corrija-o; depois treine novamente, ou retome a partir do último checkpoint quando `status` indicar `--resume` |
| O treino aguarda e não inicia | Outro treinamento está em execução neste computador; este está na fila atrás dele (`queued_behind`) | Aguarde: ele iniciará sozinho. Não inicie outro |
| Frases longas saem cortadas | Os limites de extensão: `status` avisa com contagens (pares cortados no treino, frases de dev cortadas na entrada, traduções interrompidas no limite) | Divida frases longas; ou aumente `model.max_src`, `model.max_tgt` e `decode.max_new_tokens` (treino mais longo) |
| Palavras saem como pedaços desconhecidos (`cpu-tiny`) | O vocabulário é aprendido exclusivamente a partir das linhas de treino | Mais pares que utilizem essas palavras; ou `byt5-small`, que lê bytes |

## A taxonomia de falhas

O forge foi desenvolvido a partir de um catálogo de maneiras pelas quais um projeto de treinamento engana a si mesmo. Em
resumo — imposto significa que as ferramentas o recusam:

| Família | Falhas | No código |
|---|---|---|
| Vazamento | A resposta no conjunto de treinamento; quase-cópias; paráfrases que atravessam a divisão; modelos encadeados | Imposto (auditoria de vazamento, proteção de divisão). Variações irmãs de modelos são mantidas e contadas |
| Contaminação de dev/teste | Escolha de checkpoints no conjunto de teste; uso duplo de um conjunto selado; pontuação de teste sem previsão; previsão após leitura | Imposto (barreira de desenvolvimento, livro-razão de avaliação, pré-registro) |
| Tokenizador e ortografia | Um tokenizador que não consegue escrever a escrita do idioma; convenções ortográficas misturadas | Não verificado para tokenizadores; convenções misturadas geram avisos de lint, apenas quando a configuração as indica |
| Dados sintéticos | Domínio da combinação sintética; interrupção antecipada (early stopping) interrompendo uma execução com muitos dados sintéticos; colapso; retrotradução se alimentando dos próprios erros | O piso de interrupção antecipada é imposto; o restante são avisos de lint ou tags |
| Cobertura | Palavras ausentes para o registro de linguagem | Um aviso de lint, quando um plugin relata a cobertura |
| Medição | Um delta menor que seu intervalo; um único número opaco; cálculos de métricas fora do mecanismo | Imposto: cada pontuação traz seu intervalo e vem do mecanismo |
| Decodificação | Saída truncada; checkpoints escolhidos por perda em vez de saída | Imposto: margem de decodificação, seleção por métrica de geração; cortes de tamanho contados com alertas emitidos |
| Processo | Chaves de configuração desconhecidas; dados marcados como do-not-train; execuções descontroladas | Imposto |

Lacunas conhecidas, ainda sem código: cobertura do tokenizador, qualidade da retrotradução,
truncamento por registro, a proporção ouro/sintético, variação entre seeds.

## Saída para programas

O `--json` coloca exatamente um documento JSON na stdout. Uma recusa gera
`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}`
e saída com código 2 (`details` é adicionado para recusas de divisão e barreira de desenvolvimento). A saída com código 1 é uma
falha inesperada (crash). O `nmt-forge run` termina com `RUN EXIT <code>` (0, 1, 2 ou
130); o `run --detach` retorna 0 com o documento da tarefa. `nmt-forge status
--json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready",
"blockers", "warnings", "answers"}}`.

## Aprofunde-se

- [A referência de comandos do `nmt-forge`](/docs/network/getting-started/forge-command-reference)
  — todos os subcomandos e flags.
- [Regras de medição](/docs/agents/measurement) — o que as pontuações significam.
- [Seu primeiro tradutor](/docs/your-first-translator) e
  [Torne-o melhor](/docs/make-it-better) — as versões do povo.
- [Disponibilização e implantação](/docs/agents/serving) — o que uma exportação contém.
