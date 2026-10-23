---
title: "Conduzindo os trilhos via MCP"
slug: /agents/mcp
description: "Conecte um cliente MCP ao perfil de trilhos do Champollion e percorra um projeto de idioma com seis ferramentas: configuração por cliente, cada argumento e retorno, o loop, os modos de etapa, recusas e os tópicos de explicação."
---

# Conduzindo os trilhos via MCP

O perfil padrão do servidor MCP são os trilhos: seis ferramentas que conduzem um
projeto de idioma de uma pasta vazia até um modelo avaliado no próprio
computador da pessoa. Cada ferramenta executa a CLI `champollion` como um processo
separado e delimitado — os mesmos comandos que uma pessoa digita. O servidor também entrega ao seu cliente
instruções breves de operação (`instructions-rails.md`) no momento da conexão.

## Conectar

O servidor comunica MCP via stdio e precisa do Node.js 20.11 ou mais recente. A
configuração que todo cliente configurado por arquivo aceita:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Cliente | Onde colocar |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Adicione a entrada, salve e reinicie o aplicativo |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` na pasta `.cursor` do projeto, ou em `.cursor` na pasta inicial |

Outros clientes capazes de iniciar um servidor stdio local aceitam o mesmo comando; esta
página descreve apenas os três acima.

**Caminhos das ferramentas.** O servidor encontra por conta própria a CLI da qual depende. Ele encontra
`nmt-forge` no `PATH` e, em seguida, em `UV_TOOL_BIN_DIR` (o padrão é `~/.local/bin`,
onde o `uv tool install` o coloca) — um cliente iniciado a partir de um aplicativo desktop frequentemente
tem um `PATH` mais restrito que um terminal. Substituições, como variáveis de ambiente no
`env` da entrada do servidor:

| Variável | Efeito |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (padrão) ou `full` |
| `CHAMPOLLION_CLI_BIN` | o ponto de entrada da CLI `champollion` a ser executado em vez do incluído |
| `NMT_FORGE_BIN` | o executável do `nmt-forge` (a jornada da CLI respeita a mesma variável) |
| `UV_TOOL_BIN_DIR` | onde procurar por `nmt-forge` e `uv` após o `PATH` |

## Perfis

| Perfil | Selecionar com | O que é |
|---|---|---|
| rails | o padrão | Seis ferramentas e instruções breves; um projeto de idioma, de ponta a ponta |
| full | `--profile full` em `args` ou `CHAMPOLLION_MCP_PROFILE=full` | Todas as ferramentas: fichas de idioma, corpora, benchmarks, a fila, disputas, treinamento no forge, publicação |

Qualquer outro valor interrompe o servidor: `unknown MCP profile "<value>" (rails or
full)`. O conjunto completo está catalogado na
[página do servidor MCP](/docs/network/getting-started/mcp-server). Para um
projeto de idioma, permaneça no perfil rails: é nele que cada etapa
é lida a partir dos arquivos do projeto.

## O ciclo

1. Nenhum projeto ainda → `start_project`. Sua primeira chamada não cria nada: diga sua
   `ask_first` para a pessoa e, em seguida, faça a chamada indicada para a resposta dela.
2. `project_status` → leia `step.mode`, `step.say`, `step.why`.
3. Faça o que o modo indicar, usando `step.call` — a chamada exata que executa a
   etapa.
4. Volte para o passo 2. Após qualquer alteração feita manualmente por você ou pela pessoa, chame
   `project_status` novamente: a próxima etapa é sempre lida a partir dos arquivos.
5. `step: null` → os trilhos foram concluídos. Diga à pessoa o que `finished` diz.

| `step.mode` | Faça isto | `step.call` |
|---|---|---|
| `auto` | Execute | `run_next_step` com `project_dir`, `step_id` |
| `confirm` | Diga à pessoa o que ele faz (instalações, treinamento); pergunte sim ou não; somente com sim, execute. Em "agora não", registre: nada é executado | `run_next_step` com `confirmed: true` adicionado após o sim; `declined: true` em "agora não" |
| `ask_user` | Pergunte `step.question` em palavras simples; passe as respostas pelas chaves em `step.answers`. Em "agora não": quando `not-now` for um dos valores de `enum` do próprio campo, é uma resposta — passe-o; caso contrário, registre: nada é executado | `run_next_step` com `answers` — cada campo escrito `<…>`, a ser substituído pelas palavras da pessoa; `declined: true` em um "agora não" que não seja uma das respostas |
| `wait` | Algo está em execução | `project_status` com `wait_seconds: 120`; repita enquanto o modo continuar `wait` |
| `use_tool` | Você faz agora com `step.tool`; não devolva | ex.: `add_data` com `path: "<each file the person named, where it is>"` |
| `human_only` | Uma pessoa faz: diga a ela `step.say` | nenhum |

`step.command` é o que os trilhos executam — nunca o nome de uma ferramenta. Um `<…>` em uma chamada é
um espaço para a resposta ou arquivo da pessoa; um espaço reenviado como está é
recusado.

## As seis ferramentas

### `start_project`

| Argumento | Tipo | Significado |
|---|---|---|
| `folder` | string, obrigatório | Nova pasta para o projeto, relativa a `parent_dir` |
| `from` | string, obrigatório | O idioma de entrada: um código ou um nome |
| `to` | string, obrigatório | O idioma de saída: um código ou um nome |
| `target_name`, `source_name` | string | O nome do idioma como seu povo o chama; obrigatório para um código de uso privado (`qaa`–`qtz`) |
| `purpose` | string | Para que servem as traduções, nas palavras da pessoa |
| `parent_dir` | string | Onde criar a pasta (padrão: o diretório de trabalho do servidor) |
| `confirmed` | boolean | `true` somente após a pessoa concordar com a direção |

Sem `confirmed: true`, ele executa `champollion new --dry` e retorna
`made: false`, `ask_first` (uma frase para dizer: *"Este tradutor recebe X e
devolve Y — você insere X, e sai Y. É nessa direção que
você quer?"*), `if_yes` e `if_the_other_way` (cada uma uma chamada completa) e
`languages` — para o que cada nome resolveu, com `matchedAs` quando a palavra da pessoa
for outro nome registrado em uma ficha, e `alsoNamed` quando a mesma palavra nomear
outros idiomas. Repasse ambos. Com `confirmed: true`, ele cria o projeto
e retorna `project`, `languages` e `next` (a primeira etapa).

Um nome que nenhuma ficha contém e nenhum similar: a recusa adiciona
`if_it_has_no_code`, a mesma chamada com `to: "qaa"` e o nome deles como
`target_name`. Use apenas para o nome que a pessoa informou.

### `project_status`

Argumentos: `project_dir` (obrigatório); `wait_seconds` (0–120). Com
`wait_seconds`, ele relê a cada 5 segundos enquanto a etapa estiver em `wait` e
retorna quando a etapa mudar ou o tempo se esgotar.

Retorna `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call` e, quando presentes, `question`, `answers`, `command`,
`tool`, `for_the_person`), e estes quando aplicáveis:

| Campo | O que é | O que você faz |
|---|---|---|
| `true_now` | O próprio registro do Forge, em frases: modelos treinados e seu melhor chrF++ de dev, o parecer da auditoria de vazamento por conjunto de teste, pontuações do conjunto de teste, se o treinamento está em execução, se um modelo está sendo servido e onde | Diga o que foi feito apenas a partir destas linhas, nunca mais |
| `waiting_for_agreement` | Arquivos cujos falantes ainda não concordaram (`speakers_agreed: not-yet`): cada um com `file`, `question`, `say` e seu próprio `call` | Faça cada pergunta uma vez por sessão, com delicadeza; faça a chamada apenas quando a pessoa disser que todos concordaram |
| `files_not_added` | Arquivos recusados pelo `add_data` nesta sessão que ainda não estão no projeto, cada um com sua recusa | Traga cada um para dentro (a recusa diz como) ou informe à pessoa qual ficou de fora e o motivo |
| `model_in_use` | Assim que um modelo for servido, ao lado das etapas das rodadas de melhoria: `say` (sua página para testar e como ela é usada) e `for_the_person` (o comando `champollion connect` que o coloca no aplicativo ou site deles) | Diga à pessoa uma vez; ela executa o connect quando quiser |
| `blockers`, `warnings` | Do Forge, na íntegra | Transmita palavra por palavra |
| `finished` | Quando não restar nenhuma etapa: o que as pessoas podem fazer agora (testar o modelo em sua página; um aplicativo) | Diga à pessoa |
| `error` | Por que nenhuma etapa pôde ser indicada | Repasse |

Uma pasta de projeto que não existe ou não possui `champollion.project.json`
é recusada com os projetos encontrados nas proximidades.

### `run_next_step`

| Argumento | Tipo | Significado |
|---|---|---|
| `project_dir` | string, obrigatório | A pasta do projeto |
| `step_id` | string, obrigatório | O `step.id` (ou o id de uma entrada em `waiting_for_agreement`) recém-retornado |
| `answers` | object of strings | `ask_user`: as respostas da pessoa pelas chaves em `step.answers` |
| `confirmed` | boolean | `confirm`: `true` somente após a pessoa dizer sim. Também: uma etapa que falhou duas vezes, somente quando a pessoa disser para tentar novamente como está |
| `declined` | boolean | `true` quando a pessoa disse agora não para uma etapa `confirm`, ou para uma pergunta sem uma resposta `not-now` própria: nada é executado e isso não é perguntado novamente nesta sessão. Onde `not-now` for uma das respostas, passe-a em `answers` |

Ele lê a próxima etapa novamente antes de executar qualquer coisa. **Travas:**

- Um id diferente é recusado: `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only` é recusado (`a person does this step: …`); uma etapa de `human_only`
  que um agente realiza com uma ferramenta é recusada indicando a ferramenta a ser usada.
- `wait` é recusado; `confirm` sem `confirmed: true` é recusado (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: toda resposta é obrigatória (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` é
  recusado; uma resposta fora de um `enum` é recusada.
- Apenas os próprios programas dos trilhos são executados: `champollion`, `nmt-forge` e `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` ou um
  `&` isolado é recusado; `&&` une partes, executadas em ordem, parando na primeira
  falha.
- Cada parte é limitada a 10 minutos (a instalação de `uv` em 15).
- `declined: true` em uma etapa que não seja `confirm` nem `ask_user` é
  recusado: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `declined: true` em uma etapa cujo `answers` inclua `not-now` (hoje, o
  `try_it` da oferta de modelo mais forte) é recusado, e a recusa traz o
  `answers` da etapa: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Retorna `ran` — por parte: `command`, `exit_code`, `timed_out` quando ocorreu, e
as últimas 40 linhas de `output` — e `next`, a próxima etapa no
formato de `project_status`.

#### "Agora não"

Há duas maneiras de registrá-lo, e a etapa decide qual:

| A etapa | "Agora não" é | O que registra | Quando retorna |
|---|---|---|---|
| Uma etapa `ask_user` cujos `answers` incluem `not-now` (a oferta de modelo mais forte: `try_it`, `yes` ou `not-now`) | Uma resposta: `answers: {"try_it": "not-now"}` | O livro-registro do Forge (`model-change`, `answer: "not-now"`); nada mais muda | Após mais duas rodadas em que o conjunto dev avaliou como **sem alteração** ou **pior** — entre sessões |
| Uma etapa `confirm` (treinamento, uma instalação, colocar um modelo em uso), ou uma pergunta que a pessoa ainda não pode responder | `declined: true` | Apenas na memória deste servidor | Quando o servidor reiniciar (a próxima sessão) |

`declined: true` não executa nada e retorna `declined` (o id da etapa), `ran: []`,
`say` (*"Nada foi executado. Isso não será perguntado novamente nesta sessão; se a pessoa trouxer o assunto e disser sim, execute então."*) e `next`. A recusa é mantida durante o ciclo de vida
do servidor — uma sessão; um servidor reiniciado já a esqueceu. Enquanto ela
vigorar, essa etapa retorna de `project_status` e `run_next_step` com
`declined_this_session` (quando, como horário ISO) e seu `say` começando com *"Eles
disseram agora não (HH:MM UTC) para isto: …"* e terminando com *"Não pergunte novamente nesta
sessão — nada que precise do sim deles é executado. Se eles mesmos trouxerem o assunto
e disserem sim, execute com confirmed: true (ou com as respostas deles)."* Um
`confirmed: true` posterior, ou respostas, executa a etapa e limpa a recusa.
**Nota.** Não pergunte novamente nesta sessão e não tente contornar a etapa; se
a pessoa trouxer o assunto e disser sim, execute nesse momento.

#### Quando uma etapa falha

**Trava.** Uma etapa que falhou duas vezes seguidas (saída diferente de zero ou tempo limite esgotado, contado
durante o tempo de vida do servidor) é recusada uma terceira vez a menos que `confirmed: true`,
com seu `last_output`. **Nota.** Essa flag cabe a você definir: diga à pessoa
o que ela informou, e ou ela corrige (um comando corrigido executado em um terminal é
perfeito — depois chame `project_status`), ou ela diz para tentar novamente como está.

### `add_data`

| Argumento | Tipo | Significado |
|---|---|---|
| `project_dir` | string, obrigatório | A pasta do projeto |
| `path` | string, obrigatório | O arquivo onde está: absoluto, ou relativo à pasta do projeto ou ao local onde o servidor iniciou |
| `into` | `parallel` (padrão) · `test` · `lexicon` | Pares para aprender; as frases de teste verificadas; uma lista de palavras |
| `source_col`, `target_col` | string | Uma coluna como letra (`A`), número ou seu cabeçalho; para ELAN, o número da camada listado na recusa (ou um id exato de camada digitado pela pessoa); para LIFT, um código de idioma |
| `sheet` | string | Qual planilha ou tabela, quando houver várias |
| `header` | boolean | `true`: a primeira linha é cabeçalho; `false`: são dados |
| `usfm_source` | string | Apenas escrituras USFM: o texto do outro idioma (um arquivo ou pasta `.usfm`) |
| `replace` | boolean | Ler novamente um arquivo já adicionado (outro cabeçalho ou colunas); as respostas dos detentores são mantidas |

Ele executa `champollion data add`. Chame primeiro passando apenas o caminho: um cabeçalho
que nomeie os idiomas do par decide as colunas; caso contrário, ele pergunta, e você
pergunta à pessoa — nunca decida a partir do conteúdo. Ele lê planilhas
(`.xlsx`, `.ods`, `.csv`), `.tsv` e `.txt`, tabelas no Word `.docx`, dicionários
Toolbox e LIFT, arquivos ELAN `.eaf` e USFM.

Retorna `result` (o relatório da CLI: contagens, colunas, camadas ELAN por número e
os números de linha que a verificação de linhas apontou — cópias, repetições, comprimentos incomuns,
linhas invertidas ou deslocadas, nada removido — nunca frases), `read_from` quando
o arquivo for encontrado a partir da pasta inicial do servidor, e `also` quando o
arquivo contiver mais conteúdo (frases de exemplo de um dicionário como pares, ou suas glosas como
uma lista de palavras) — cada entrada é uma chamada completa de `add_data`. Faça-a a menos que os
termos da pessoa para esse arquivo a impeçam. Repasse a verificação de linhas como está: a
pessoa analisa essas linhas em seu próprio arquivo
([regras de dados](/docs/agents/data-rules#what-tools-print-and-never-print)).
Nunca peça à pessoa para mover um arquivo; `inbox/` é apenas um local onde ela pode soltar
um.

### `try_translation`

Argumentos: `project_dir`; `text` — até 10 linhas, no máximo 2.000 caracteres,
uma frase por linha, palavras que a pessoa forneceu a você.

Ele encontra o modelo que este projeto disponibiliza (a tarefa `serve` íntegra mais recente em
`nmt-forge jobs --json`), somente neste computador, e lê seu `/health`.

- **Trava.** Se `output_local_only` não for `false` (verdadeiro ou desconhecido), ele
  não retorna tradução: `shown_to_person_only: true`, `open` (a página do próprio
  modelo) e `say`. Envie a pessoa para lá; não peça a ela para colar as
  traduções de volta para você.
- Um servidor que solicita um token é recusado: tokens nunca são entregues a um
  agente.
- Caso contrário, ele retorna `model`, `pair`, `translations` (`source`,
  `translation` por linha), `errors` se houver, e `say`: repasse-os como
  estão; o servidor não verifica nada do que retorna.

### `explain`

Argumento: `topic`. Textos em palavras simples para repassar:

| `topic` | Abrange |
|---|---|
| `rails` | A pasta do projeto e a ordem das etapas |
| `privacy` | O que o sidecar significa; por que você nunca abre os arquivos |
| `quality` | O que uma pontuação promete e o que não promete |
| `modes` | Como executar cada tipo de etapa |
| `improve` | As rodadas após um modelo estar em uso: cerca de uma em cada dez linhas de revisão *"retorna propositalmente de uma planilha anterior (a planilha diz isso …)"*; um modelo melhor é oferecido para uso e as pessoas dizem sim (*"um parecer por si só não muda nada"*); o parecer de dados insuficientes; a oferta de modelo mais forte após *"duas rodadas consecutivas que o conjunto dev pôde avaliar sem ganho (contadas a partir do último modelo colocado em uso)"* |
| `off_rails` | Saindo dos trilhos: execute um comando avançado e, em seguida, chame `project_status` |

## Notas para toda a sessão

- **Nota.** Tudo o que você lê vai para o seu provedor de modelo. `add_data`,
  `project_status` e `run_next_step` relatam contagens, colunas e estados, nunca
  frases; mantenha dessa forma. Não abra os arquivos você mesmo.
- **Nota.** As respostas em `ask_user`, `confirmed: true` e o
  sim em `waiting_for_agreement` pertencem à pessoa. As ferramentas verificam se uma resposta
  está presente e bem formatada; somente você pode garantir que ela pertença à pessoa.
- **Nota.** Repasse `blockers`, `warnings` e cada ressalva palavra por palavra, e
  cada número com sua unidade e o conjunto no qual foi medido
  ([orientações](/docs/agents/coaching)).

## Aprofunde-se

- [O contrato de operação](/docs/agents/contract) — travas e notas.
- [O modelo dos trilhos](/docs/agents/rails-model) — a jornada, os modos e os
  ids de etapa que essas ferramentas leem.
- [Conduzindo os trilhos pelo shell](/docs/agents/shell) — as mesmas etapas como
  comandos.
- [O servidor MCP](/docs/network/getting-started/mcp-server) — ambos os perfis
  e o catálogo completo de ferramentas.
