---
title: "O modelo de trilhos"
slug: /agents/rails-model
description: "Como um projeto nos trilhos do Champollion é construído: a árvore do projeto, os seis formatos validados por esquema que todas as ferramentas leem, o pipeline único da entrada admitida à saída medida, a jornada como dados e a forma de cada recusa."
---

# O modelo dos rails

Um projeto nos rails é uma pasta de arquivos simples. Cada ferramenta — a CLI do `champollion`, o `nmt-forge`, o `mt-eval` e o servidor MCP — lê os mesmos arquivos nativamente, segundo os mesmos esquemas, com os mesmos vereditos. O próximo passo é sempre lido dos arquivos, nunca lembrado de memória. (Duas coisas ficam fora do projeto: o servidor MCP conta as falhas de um passo durante seu próprio tempo de vida, e o nmt-forge mantém uma fila de treinamento para toda a máquina em `~/.nmt-forge`.) Altere um arquivo manualmente, peça o próximo passo, e a resposta refletirá a mudança.

Esta página é o mapa. As regras de operação estão n[o contrato](/docs/agents/contract); as chamadas de ferramentas estão no [MCP](/docs/agents/mcp) e n[o shell](/docs/agents/shell).

## As ferramentas

| Ferramenta | Instalação | O que faz nos rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Inicia projetos, importa dados, registra seus termos, indica o próximo passo, executa as rodadas de melhoria, conecta um modelo a um aplicativo |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Treina, faz triagem, divide, registra previsões, pontua modelos no conjunto de teste e os exporta, disponibiliza-os para serviço; mantém o livro-razão |
| `mt-eval` | vem com o `nmt-forge` (o pacote `mt-eval-harness`) | Executa um método sobre um conjunto de teste, um arquivo ou uma requisição; aplica portões; calcula pontuações |
| `champollion-mcp-server` | npx | Controla a CLI do `champollion` como processos-filhos delimitados; o perfil dos rails conta com seis ferramentas |

Cada ferramenta roda como seu próprio processo. O servidor MCP executa os mesmos comandos que uma pessoa digita (seu `run_next_step` recusa qualquer programa que não seja `champollion`, `nmt-forge` e `uv tool install … nmt-forge`).

## A árvore do projeto

`champollion new <folder> --from <language> --to <language>` grava:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

Ele recusa uma pasta que já contenha um projeto (exit 1) ou qualquer arquivo não oculto (exit 1), e um `kind` diferente de `language`: projetos `task` e `service` ainda não estão nos rails. `--dry` resolve os idiomas e não grava nada.

Os passos adicionam o restante conforme são executados:

| Caminho | Escrito por | Contém |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — os termos do arquivo ao lado dele |
| `data/combined-from/` | `champollion data combine` | os originais que o combine uniu (movidos, nunca excluídos) |
| `data/not-for-training/` | `champollion data combine` | arquivos cujos detentores disseram que nenhum modelo pode aprender com eles |
| `.forge/` | `nmt-forge init` | a oficina: `eval-registry.json`, `ledger.jsonl`, pré-registros, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | a configuração de treino (um preset de modelo expandido em números explícitos) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | os pares de treino triados |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | o conjunto de dev; o arquivo de treino de cada rodada |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | frases que o falante escreveu para o conjunto de dev — role `dev`, apenas local, nunca usado em treino |
| `improve/time.json` | `champollion improve time` | o tempo do falante, em suas próprias palavras |
| `improve/round-<k>/` | as etapas do improve | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (quais linhas o outro modelo rascunhou — um mais novo que não está em uso ou aquele que uma promoção substituiu: números de linha, nomes de execuções, a relação e a contagem de pares de treino de cada modelo — e, a partir da rodada 2, `repeat_rows`: as linhas exibidas novamente, cada `row`, `from_round`, `from_row` e o `mark` anterior), `marks.json` (as contagens, a proporção correta com seu intervalo, `blind` e `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | um modelo exportado e seu method.json |
| `deploy/<name>.json` | `nmt-forge export` (dentro de um projeto rails) | deployment/1 — o que está implantado |
| `gates/*.json` | pessoas | gate-chain/1 — checagens entre a saída e o que é entregue |
| `methods/<id>/method.json` | pessoas | method/1 (também escrito por `nmt-forge export` em uma pasta de modelo, `mt-eval export` e `champollion serve --emit-manifest`) |

## Os formatos

Seis esquemas da framework residem em `shared/schemas/framework/`. Cada documento nomeia seu esquema em `$schema`. Chaves desconhecidas são recusadas; chaves personalizadas vão sob `x-`.

| Formato | `$schema` | Onde | O que é |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Apenas decisões: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | Termos de um arquivo de dados: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, campos de registro, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Um método: `id`, `name`, `kind` e a configuração correspondente ao tipo, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Portões `metric-threshold` ordenados e um `fallback` opcional |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Um método, seus portões, um par; host e porta `serve` opcionais |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | o contrato `/translate` | Documentos de requisição, resposta, erro e `/health` |

`project.defaults` — o que os dados adicionados ao projeto recebem quando ninguém diz o contrário. O `champollion new` grava `{"transmission": "local-only", "training": "ask", "share_scores": "ask"}`. The values: `transmission` `local-only` ou `ask`; `training` `allowed`, `not-allowed` ou `ask`; `share_scores` `never` ou `ask`. O valor `ask` faz as ferramentas pararem e perguntarem — os rails nunca inventam uma resposta.

Mais dois registros não são esquemas da framework, mas fazem parte do modelo:

- **O livro-razão do forge**, `.forge/ledger.jsonl`: somente adição e encadeado por hash
  (cada entrada inclui o hash da anterior; `nmt-forge ledger verify`
  falha em qualquer edição). Ele registra cadastros, cada leitura de um
  conjunto registrado, pré-cadastros, pontuações, usos de conjuntos lacrados, substituições,
  pareceres de auditoria de vazamento, o piso do dicionário, exportações, escolhas, disponibilizações, vereditos de rodada
  (`improve-compare`: `better`, `worse`, `no-change` ou `too-few` abaixo de 50
  frases de dev), como cada rodada treina (`round-plan`), os rascunhos do
  outro modelo para uma folha de revisão (`draft-newer`: nomes de execuções, `relation`, a contagem
  de pares de treino de cada modelo e uma contagem de rascunhos), o veredito cego do
  falante sobre um modelo mais novo (`improve-speaker`: nomes de execuções, quatro contagens, `z`,
  `clear`), alterações no modelo (`model-change`, incluindo um `not-now`) e o que
  `nmt-forge tidy` removeu (`tidy`: execuções e bytes). Contagens, hashes e
  caminhos — nunca uma frase. É uma escrituração com detecção
  de adulteração, não segurança criptográfica.
- **O cartão de execução**: o que `mt-eval run` registra para uma execução avaliada e o que um
  resultado publicado traz. Veja a [especificação do cartão de execução](/docs/network/specifications/run-card).

**Bloqueio.** `champollion validate [folder]` verifica o arquivo de projeto, cada sidecar, cada `method.json` (na raiz, em `methods/*/` e `.champollion/methods/*/`), `gates/*.json` e `deploy/*.json` em relação a esses esquemas. O harness lê os mesmos arquivos com os mesmos vereditos. Exit 0 = sem erros, 1 = um documento é inválido, 2 = erro de uso. Ele abre apenas esses arquivos JSON, nunca um arquivo de dados.

O `champollion upgrade [folder]` reescreve sidecars criados antes de set/1 (sem `$schema`) como set/1, mantendo todos os valores (uma chave desconhecida para set/1 vai para `x-<key>`). Ele não altera sidecars inválidos e lista um `method.json` antigo sem modificá-lo: todas as ferramentas continuam lendo-o, como method/0, com um aviso.

## O pipeline único

Toda forma como um método processa texto é um único pipeline no motor de avaliação:

1. **Admissão.** Os termos da entrada são lidos (o sidecar set/1, um envelope JSON, o registro no catálogo) e sua política de transmissão é resolvida e aplicada antes que qualquer coisa seja traduzida. Um canal não permitido pela política é recusado aqui (consulte as [regras de dados](/docs/agents/data-rules)).
2. **Método.** Um método traduz (tipos de method/1: `llm`, `llm-coached`, `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`, `human`).
3. **Portões.** Se uma cadeia de portões for especificada, cada segmento é avaliado; o primeiro portão que recusar decide o que será entregue (`drop`, `keep-source`, `flag`, `fallback`). Consulte [métodos e portões](/docs/agents/methods).
4. **Saídas.** O log da execução é gravado; arquivos extraídos de uma entrada marcada carregam seus termos em um sidecar ao lado deles.
5. **Métricas.** Apenas quando houver referências: a pontuação principal avalia o que foi entregue, e a pontuação sem portões fica ao lado dela. Consulte [medição](/docs/agents/measurement).

Os modos são o mesmo pipeline em entradas diferentes:

| Modo | Comando | Entrada | Métricas |
|---|---|---|---|
| Medir | `mt-eval run` (`mt-eval test` pontua novamente um log de execução) | um conjunto de teste ou dev | sim |
| Traduzir um arquivo | `mt-eval translate --out <file>` | somente texto-fonte | não |
| Servir | `mt-eval serve` | uma requisição por vez | não |

**Uma implantação é o pipeline de medição aplicado a uma entrada contendo apenas o texto-fonte.** Um único arquivo deployment/1 é testado (`mt-eval run --deployment`), executado sobre um arquivo (`mt-eval translate --deployment`) e servido (`mt-eval serve --deployment`), de modo que o que foi medido seja exatamente o que é entregue. Com `--deployment`, as flags definidas pelo arquivo (`--method`, `-m`/`--model`, `--gates`, `--target-script`) são recusadas. Uma implantação não define pontuações: um número medido é o resultado de uma execução, guardado junto a ela. Consulte [serviço](/docs/agents/serving).

## A jornada, como dados

A ordem do trabalho é um arquivo: `shared/journeys/language.json`. O avaliador, `cli/lib/framework/journey.js`, é o único leitor; o `champollion next`, o perfil dos rails do MCP e o `NEXT.md` fazem todos a mesma pergunta a ele. **O primeiro passo ainda não concluído é o próximo passo.** Ele lê apenas sidecars, o arquivo de projeto e o registro e livro-razão do forge — nunca o texto de um arquivo de dados — e não executa nada, exceto `nmt-forge --version` (com limite de 30 s) para a etapa de instalação e `nmt-forge status --json` (com limite de 60 s) assim que o trabalho chega ao treinamento.

**Estágios.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**Um passo** tem um `id`, um `stage`, um `mode`, palavras simples para orientar a pessoa (`say`) e por que isso importa (`why`), e geralmente um `command`. Campos opcionais:

| Campo | Significado |
|---|---|
| `done_when` | A verificação que indica que o passo foi concluído. Obrigatório (exceto em passos de delegação) |
| `when` | Uma verificação que deve ser verdadeira para o passo ser aplicável (o piso do dicionário só se aplica quando `data/lexicon/` contém um arquivo) |
| `question`, `answers` | A pergunta de um passo `ask_user` e os espaços para resposta: `{"enum": [...]}` ou `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | O que o próprio agente faz no passo de uma pessoa (importar os arquivos indicados com `add_data`) |
| `outdated` | Uma variante usada quando a verificação descobre que a ferramenta é antiga demais |
| `delegate` | `"nmt-forge"`: transfere o controle para o orientador do próprio forge |

Os valores `{placeholders}` em `say`, `question` e `command` são preenchidos a partir do arquivo de projeto e dos arquivos encontrados.

**As verificações** formam um conjunto fechado; o avaliador lança um erro diante de uma desconhecida: `project_valid`, `data_files`, `every_data_file_has_terms`, `protected_test_set`, `tool_on_path` (com `min_version`), `path_exists`, `forge_test_registered`, `single_file`, `forge_role_registered`, `forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`, `improve_prepared`, `forge_trained_on_current`.

**Modos:**

| Modo | Quem age | O que os rails permitem |
|---|---|---|
| `auto` | o agente | executar o comando |
| `confirm` | o agente, após autorização | instalações, treinamento, qualquer ação que gaste ou publique; executa somente após a confirmação da pessoa |
| `ask_user` | a pessoa responde | perguntar `question`; passar suas respostas pelas chaves em `answers`; nunca responder em seu lugar |
| `wait` | ninguém | há algo em execução; pergunte novamente mais tarde |
| `human_only` | uma pessoa | reunir frases, marcar rascunhos, escolher |
| `use_tool` | o agente, com sua própria ferramenta | apenas MCP: um passo `human_only` com o campo `agent` é mostrado como `use_tool` com `step.tool` |

**Delegação.** No passo `forge`, a jornada consulta `nmt-forge status --json` e adota o estado do forge como o passo. Os estados do forge mapeiam para modos: `training` → `wait`; `ready-to-train` e `needs-training-extra` → `confirm`; `missing-preregistration` → `ask_user`; `choose-export` → `human_only`; `improve-compare` → `auto`; `improve-promote` → `confirm`; `improve-stronger-model` → `ask_user`. Qualquer outro estado é `auto` quando o forge indica um comando, ou `human_only` quando não indica. O estado `serving` encerra o estágio build e inicia o estágio improve.

Dois tipos de passos vêm de fora da lista de passos:

- **Julgamento da previsão.** Após uma exportação pontuada no conjunto de teste, uma previsão escrita pelas pessoas em suas próprias palavras aguarda seu veredito: um passo `ask_user` com `answers` `verdict` (`held` ou `missed`) e `by` (quem a julgou), que executa `nmt-forge prereg verdict`.
- **À espera de consentimento.** Cada arquivo cujo sidecar diz `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting`, respondido pelo seu próprio id de passo assim que a pessoa tiver a resposta. Isso nunca atrasa o restante dos rails.

**O id do passo** é `<journey step id>:<8 hex characters>` — um hash do passo e de seu comando preenchido. Se o projeto mudar, o id muda, e um `run_next_step` com o id antigo é recusado (`the project changed since that step was named`).

**O que `champollion next --json` retorna:** `project`, `kind`, `stage` (`n`, `of`, `id`, `title`), `done` (ids dos passos), `step` (`id`, `mode`, `say`, `why` e, quando presentes, `command`, `question`, `answers`, `agent`, `agent_tool`, `file`, `source`), `now` (fatos do forge — o que é verdadeiro no momento), `waiting`, `forge` (`state`, `blockers`, `warnings`), `finished` (quando não resta nenhum passo) e `error`. Exit 1 quando houver um erro e nenhum passo.

## Formatos de recusa

Toda recusa informa o que aconteceu, e a maioria indica o motivo e a solução.

| Ferramenta | Saída humana | Saída de máquina | Exit |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, depois `  why: …` e `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` no stdout | 2 recusado |
| `champollion` | `[ERR] message` no stderr | `--json` onde o comando oferecer suporte | 1 recusado, 2 uso |
| Ferramentas rails do MCP | — | `{"refused": "<reason>", …}` com `isError: true`, além de nova tentativa quando houver (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` no erro do forge é a classe de exceção (`UsageError` para argumentos
inválidos — o forge prefere recusar flags abreviadas em vez de adivinhar). Os nomes
de proteções do forge incluem `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` e `disk-room` (uma
execução de treinamento que o disco não comporta). Quando um erro
citarias uma frase de um corpus retido, a frase aparece como
`[sentence withheld]` e o objeto adiciona `text_withheld`.

Transmita uma recusa em palavras simples e siga sua correção, ou peça novamente o próximo passo. Um passo que falhou duas vezes não é executado novamente até que a pessoa decida ([MCP](/docs/agents/mcp#when-a-step-fails)).

## Aprofunde-se

- [O contrato de operação](/docs/agents/contract) — as regras, bloqueios e notas.
- [Controlando os rails via MCP](/docs/agents/mcp) e [a partir do shell](/docs/agents/shell).
- [Regras de dados e transmissão](/docs/agents/data-rules) — set/1 na íntegra.
- [Métodos e portões](/docs/agents/methods) e [serviço](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [A especificação do run card](/docs/network/specifications/run-card) e a [especificação do harness](/docs/network/specifications/harness).
- [Referência de comandos do `mt-eval`](/docs/reference/mt-eval) e a [referência de comandos do `nmt-forge`](/docs/network/getting-started/forge-command-reference).
