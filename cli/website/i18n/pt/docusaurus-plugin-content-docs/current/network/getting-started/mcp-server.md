---
title: "Servidor MCP — a porta voltada para agentes"
sidebar_label: "Servidor MCP"
description: "Conecte um agente de IA ao Champollion pelo Model Context Protocol. Dois perfis: o perfil rails (o padrão) conduz um projeto de idioma com seis ferramentas; --profile full disponibiliza 34 ferramentas para consultar idiomas, navegar pela fila de benchmarks e pelo registro de corpora, executar avaliações, treinar e exportar modelos e traduzir — além de indicar exatamente quais delas precisam de mais do que um npx install."
---

# Servidor MCP — a porta de entrada para agentes

O `champollion-mcp-server` expõe o Champollion para agentes de IA via [Model
Context Protocol](https://modelcontextprotocol.io), através de stdio. Ele possui dois
perfis:

| Perfil | Inicie com | O que disponibiliza | Feito para |
|---|---|---|---|
| **rails** (o padrão) | `npx -y champollion-mcp-server` | seis ferramentas: `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | conduzir um projeto de idioma desde uma pasta vazia até um modelo avaliado no próprio computador da pessoa, um passo de cada vez |
| **full** | `npx -y champollion-mcp-server --profile full` (ou `CHAMPOLLION_MCP_PROFILE=full`) | 34 ferramentas, 3 recursos e 4 prompts | descoberta, benchmarking, treinamento passo a passo, tradução e a rede |

Se você estiver ajudando alguém a criar um tradutor para o seu idioma, use o
perfil rails; como conduzi-lo está em [Conduzindo os trilhos via
MCP](/docs/agents/mcp), e as regras sob as quais você opera estão no [contrato
operacional](/docs/agents/contract).

Tudo aqui também pode ser acessado via HTTP simples — consulte [Endpoints legíveis por
máquina](#machine-readable-endpoints) — mas o servidor MCP é a única superfície
que permite que um agente *aja* (traduza, execute um benchmark, treine um modelo) em vez de
apenas ler.

## Instalação

```bash
npx -y champollion-mcp-server
```

Em seguida, registre-o no seu cliente. Para o Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para clientes configurados por arquivo (Claude Desktop, Cursor, Antigravity), adicione:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

Para o perfil full, adicione `"--profile", "full"` após o nome do pacote em
`args`, ou finalize o comando `claude mcp add` com `--profile full`.

## O perfil rails (o padrão)

As seis ferramentas conduzem um projeto de idioma desde uma pasta vazia até um
modelo avaliado no próprio computador da pessoa. Cada etapa indica exatamente qual ferramenta chamar,
e toda pergunta que apenas a pessoa pode responder (quem detém um arquivo, se um
modelo pode aprender com ele, se seu texto pode sair do computador, o que ela
espera, se o resultado é bom o suficiente) é devolvida a ela. As ferramentas
informam contagens e colunas, nunca frases. Cada ferramenta aciona a linha de comando
`champollion` como um processo separado e delimitado — os mesmos comandos que uma pessoa
digita. Este perfil foi feito para agentes pequenos, com instruções curtas.

| Ferramenta | Argumentos | O que faz |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | Cria um projeto (`champollion new`). A primeira chamada não cria nada e retorna `ask_first`: repita a direção de volta para a pessoa e, em seguida, faça a chamada fornecida para a resposta dela |
| `project_status` | `project_dir`, `wait_seconds?` (até 120) | A próxima etapa, lida a partir dos arquivos (`champollion next --json`): seu modo, o que dizer, o motivo e a chamada exata para executá-la |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | Executa a etapa que `project_status` acabou de indicar. Uma etapa `confirm` precisa de `confirmed: true` após a pessoa confirmar; uma etapa `ask_user` precisa das próprias respostas da pessoa; etapas `human_only` e `wait` são recusadas com instruções do que fazer em vez disso |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` ou `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | Importa um arquivo onde ele estiver — uma planilha, uma tabela do Word, um dicionário Toolbox ou LIFT, um arquivo ELAN ou escrituras em USFM (`champollion data add`) — e informa contagens e colunas, nunca frases |
| `try_translation` | `project_dir`, `text` (até 10 linhas) | Traduz algumas das frases da pessoa com o modelo disponibilizado pelo projeto. Para um modelo que aprendeu a partir de frases apenas locais, retorna o endereço da própria página do modelo, nunca o texto |
| `explain` | `topic`: `rails`, `privacy`, `quality`, `modes`, `improve` ou `off_rails` | Explicações em linguagem simples para repassar |

## O perfil full

Tudo abaixo descreve o **perfil full** — todas as ferramentas para descoberta,
benchmarking e a rede:

```bash
npx -y champollion-mcp-server --profile full
```

## Leia isto antes de confiar nisso

**No perfil full, quatorze das 34 ferramentas funcionam a partir de uma instalação básica de `npx`, e `translate` funciona
assim que tiver um motor. As outras dezenove precisam de pacotes Python que o pacote npm
não inclui e não pode incluir.** Elas não falham silenciosamente — cada uma retorna um
erro acionável indicando o que está faltando —, mas você deve conhecer a estrutura antes
de se planejar em torno dela.

| Ferramentas | Funcionam após `npx`? | Do que mais precisam |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Sim** — somente leitura, servidas a partir de endpoints públicos | nada |
| `translate` | **Sim**, com um motor | uma chave de API para o motor escolhido — ou nenhuma, com o método `local` e um servidor de modelo na sua própria máquina |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Não | o harness de avaliação — `pipx install mt-eval-harness` |
| as quinze ferramentas `forge_*` | Não | NMT Forge 0.2.0 ou posterior — `python3 -m pip install nmt-forge` (adicione `'nmt-forge[hf]'` para treinar e servir). Ele já traz o harness de avaliação junto e localiza os cartões de idioma por conta própria; não é necessário clonar |

Não é necessário clonar o repositório para nada disso.

## O que as ferramentas fazem

**Explorar e estimar os custos do trabalho.** `list_queue` e `get_queue_item` percorrem a fila
aberta de benchmarks — a lista classificada de medições que mais aprimorariam o
mapa. `estimate_cost` calcula o custo de um conjunto de execuções antes de você gastar qualquer valor.

**Consultar informações.** `search_languages` pesquisa os cartões de idioma por nome,
código, família ou região, tolerando erros de digitação. Cada resultado também indica onde
o idioma é falado (países, um ponto no mapa, macroárea) e seus outros
nomes — apenas os fatos para os quais o cartão cita uma fonte, cada um acompanhado dessa fonte, para que
idiomas com nomes semelhantes possam ser diferenciados. Uma localização sem fonte
nunca é exibida; a linha indica isso e, em vez disso, fornece o link para o registro do idioma no Glottolog.
Os cartões preenchidos a partir das tabelas de cartões publicadas do champollion.dev (em uma
instalação npm, todos os idiomas fora do conjunto principal integrado) ainda não possuem
fontes por campo — elas virão na próxima atualização das tabelas —, portanto essas
linhas contêm o link do Glottolog em vez de uma localização. `language_overview` é o
ponto de partida em uma página para construir para um idioma: o que existe, o que pode
executar e as próximas etapas. `get_language` retorna o cartão citado completo.
`list_corpora` lista os corpora de avaliação registrados para um par de idiomas ou família de benchmark — apenas metadados (tamanho,
licença, grau de contaminação e se o harness pode buscá-lo, precisa de um
token de acesso ou o mantém em quarentena); o conteúdo do corpus nunca é retornado,
e um par cujos corpora estejam todos em quarentena indica isso em vez de parecer
não suportado. `get_results` e `get_run_card` leem execuções pontuadas
da tabela de classificação pública. `get_metric_reliability` responde à pergunta que a maioria dos
agentes erra — *em qual métrica devo confiar para este idioma de destino* —
a partir de correlações com julgamentos humanos por família linguística. `list_contests`
e `get_contest` mostram competições e seus termos declarados; participar de uma é uma
etapa na CLI autorizada por um humano, nunca uma ferramenta.

**Agir.** `translate` processa o texto através do pipeline testado, com Memória de
Tradução (repetições não custam nada) e um quality gate determinístico. Cada resposta
indica o motor que realmente executou, com seu modelo e endpoint quando houver.
`run_benchmark` inicia uma avaliação e retorna um **job id imediatamente**,
porque execuções reais duram mais que qualquer timeout de cliente; você consulta `get_run_status` com
esse ID. Um job sobrevive ao reinício do servidor: a execução continua e
consultar o mesmo ID depois ainda retorna seu status e resultados. Nada
é publicado a menos que você passe `publish: true`; o plano então indica o que se tornaria
público — cada linha com o texto de sua frase, ou apenas as pontuações; o prompt, ou apenas
seu hash; e onde — e uma publicação real precisa de `publish_ack` nas palavras
exatas fornecidas pelo plano, garantindo que o usuário as tenha visto primeiro. Uma execução feita sem isso
pode ser publicada posteriormente, sob o mesmo controle. `preview_publish` é somente leitura:
mostra a prévia de publicação do próprio harness, as palavras exatas e a chamada exata de
`publish_report` que a publicaria, não podendo publicar. Ela
traz a anotação MCP `readOnlyHint: true`, para que um host de agente que pergunte
antes de cada gravação possa autorizá-la por conta própria. `publish_report` realiza a gravação
(com as anotações `destructiveHint` e `openWorldHint`), e `scores_only`
oculta o texto da frase. Cada plano também começa com o
status de `EVAL PACK:` do idioma de destino — `missing` (com o comando que
o instala), `ready` ou `none needed` — e informa a licença do corpus e seu
termo `do_not_train`, porque a execução passa `--yes`. A ausência de um FST (o
analisador ou seu runtime pyhfst) nunca interrompe a execução: ela prossegue, e o cartão
da execução marca a aceitação de FST como não computada. Qualquer outra parte ausente interrompe a execução
antes de traduzir. `skip_fst` e `skip_eval_standard` calculam a pontuação sem essas
partes, e o cartão da execução marca o que foi omitido. O plano também informa se o
COMET será computado (o harness o calcula sempre que `unbabel-comet` estiver
instalado; `comet: true` faz a execução exigi-lo), e `metricx` e `fuse`
solicitam o MetricX-24 opcional do harness e o comparador no estilo FUSE. Para cada
um, o plano informa, a partir do harness, se está instalado, o que instalar
e o que ele baixa. Uma execução confirmada que solicite uma métrica que o harness
não consiga computar é recusada em vez de ser executada sem ela. As linhas `Results:`
e `Cache:` do plano indicam onde o log de execução, o relatório e o cache de tradução são salvos.
Um arquivo de teste dentro de uma pasta que `mt-eval contest prepare` marca como liberável
(o `public/` de uma competição) é executado na pasta `runs/` da competição, para que
nada do que uma execução grava seja divulgado junto com ele. Um modelo na sua própria
máquina (um servidor local ou `method: "local-model"`, que o harness executa
no próprio processo e não requer atestação) é informado como `$0 API cost (runs on
this machine)`.

**Treinar sem se enganar.** `get_training_guardrails` retorna as regras
extraídas de falhas reais e medidas. As quinze ferramentas `forge_*` executam o
[NMT Forge](/docs/agents/training) um passo protegido
por vez — `forge_status` primeiro e após cada etapa (ele indica o próximo
comando e a ferramenta que o executa), `forge_preflight` para verificar quais restrições um
comando encontrará antes de recusar, `forge_prereg_template` e `forge_prereg`
para registrar previsões antes que qualquer pontuação de teste exista (e antes de qualquer
benchmark no conjunto de teste: uma leitura de pontuação bloqueia um pré-registro posterior),
`forge_export` para pontuar o conjunto de teste uma única vez e empacotar o modelo treinado,
`forge_compare` para realizar teste A/B entre dois modelos com a ressalva de quase-gêmeos de cada um ao lado
do vencedor, e
`forge_prereg_verdict` para registrar o próprio veredito do usuário sobre uma previsão que o forge
não consegue julgar (uma faixa de texto livre) — exibido como um veredito humano, nunca como um
computado. `forge_status` lista todas as execuções treinadas com sua pontuação de dev e
indica quando um conjunto de dev está saturado (uma pontuação de dev perfeita sem nada para
a seleção de checkpoints diferenciar). Quando o harness de avaliação insere uma ressalva
em uma pontuação de teste (por exemplo, uma saída quase constante: um punhado de saídas
fornecidas para cada frase de origem), `forge_export`, `forge_status`,
`forge_compare` e `forge_lint` a trazem nas palavras do próprio harness, e uma ressalva
importante aparece primeiro na próxima etapa: a pontuação nunca é citada sem
ela. Uma recusa é retornada
com o que deu errado, por que isso importa e a solução. Duas etapas duram mais do que qualquer chamada
de ferramenta e são executadas em um terminal: o treinamento (`nmt-forge run`) e a disponibilização do
modelo exportado (`nmt-forge serve`, que o coloca atrás de um endpoint local que o
`translate` e a CLI podem usar).

### Argumentos

`name` é obrigatório e `name?` é opcional. Toda ferramenta que aceita um
idioma também o aceita como `language`: "`code` ou `language`" significa que qualquer um
dos nomes funciona, e você passa um deles. Os nomes originais continuam funcionando.

| Ferramenta | Argumentos |
|---|---|
| `search_languages` | `query` ou `language`, `limit?` |
| `language_overview` | `code` ou `language`, `source?` |
| `get_language` | `code` ou `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (pelo menos um destes três), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` ou `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | nenhum |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` ou `priority?` (um deles) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (um msgctxt do gettext: um para todo texto, ou um por texto), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | um modo: `budget?` ou `top?` (fila), `item_id?` ou `corpus?` com `model?` (com `method_dir`, o modelo que o plugin carrega), `method?` ou `method_dir?` (um diretório de plugin de método; `local-model` precisa de `model` — não tem padrão), `allow_model_pair_mismatch?` (`local-model`: executa um modelo de par OPUS-MT que nomeia outro par, como uma linha de base de idioma relacionado), `attest_local_transport?` (um motor de MT ou um plugin; nunca necessário para `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (execuções com LLM: a escrita ISO 15924 na qual a saída deve ser escrita, como `Cans` ou `Latn`; o plano indica quando o cartão do idioma de destino lista mais de uma), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` e `skip_eval_standard?` (execuções de item e corpus: pontuam sem o FST ou as métricas padrão de avaliação, marcadas como não computadas), `comet?` (exige COMET: a execução é recusada enquanto ele não estiver instalado), `metricx?` com `metricx_model?` e `fuse?` (execuções de item e corpus: o MetricX-24 opcional do harness e o comparador no estilo FUSE, recusados enquanto não estiverem instalados); depois `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (com uma publicação real: as palavras exatas que o plano exibe), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (o `*_report.json` de uma execução concluída), `scores_only?`, `redact_coaching?`, `anonymous?` (somente leitura: sem `confirm`, não pode publicar) |
| `publish_report` | `report` (o `*_report.json` de uma execução concluída), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (as palavras exatas que a prévia exibe) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (o comando a verificar), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` ou `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` ou `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (padrão `data/split`, o caminho que o config.json de `forge_init` lê), `dev?`, `register?` (um prefixo de nome, ou `true` para `project`), `allow_rotate?`, `near_dupe?` (um limiar de Jaccard como 0.6, quando o forge recomenda o desmembramento de quase-duplicatas), `max_group?` (com `near_dupe`: o maior grupo de quase-duplicatas), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (com seu próprio `clean_to`, por exemplo `corpus.notwins.jsonl` — nunca o arquivo de todos os dados), `companion_config?` (com `drop_test_twins`: para onde vai a configuração do modelo sem gêmeos; padrão `config-notwins.json`), `overwrite?` (substitui um arquivo `clean_to` que uma configuração, execução, divisão ou outra auditoria usa — recusado sem isso), `full_indices?` (todas as listas de números de linhas na íntegra; por padrão, listas longas retornam como `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (fixar em uma execução), `allow_after_reads?` (apenas para previsões registradas antes das leituras pontuadas do conjunto), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (seu número ou seu próprio ID), `verdict` (`held` ou `missed`), `by` (quem julgou), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (o manifesto de execução de cada modelo: seus dados de treinamento são verificados quanto a quase-gêmeos), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Por exemplo, `get_metric_reliability { "language": "crk" }` e
`get_metric_reliability { "target": "crk" }` fazem a mesma pergunta.

### Traduzindo com um modelo implantado

`nmt-forge serve` exibe dois endereços para o modelo que disponibiliza. Aponte
`translate` para qualquer um deles:

| Argumento | Use com | Exemplo |
|---|---|---|
| `base_url` | `method: "local"` — um servidor compatível com OpenAI (também `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — o contrato de API do champollion | `http://127.0.0.1:8378/translate` |
| `model` | apenas motores de LLM; recusado para APIs de tradução automática, que não possuem | `llama3.1` |
| `project_dir` | qualquer método — use a Memória de Tradução desse projeto | `~/my-app` |

Um servidor na sua própria máquina não precisa de chave. Um endpoint `api` remoto lê sua
chave de `CHAMPOLLION_API_KEY` no ambiente do servidor. A ferramenta recusa
um argumento que não reconhece, pelo nome, em vez de ignorá-lo, evitando que um argumento
digitado incorretamente envie silenciosamente seu texto para um modelo diferente.

### Onde o servidor armazena seu estado

Tudo fica em `~/.champollion-mcp/` (defina `CHAMPOLLION_MCP_HOME` para
movê-lo):

- **A Memória de Tradução de `translate`** é seu próprio arquivo,
  `.champollion/tm.json` nessa pasta. Ele é separado do `.champollion/tm.json`
  de qualquer projeto. Passe `project_dir` para usar o arquivo de um projeto,
  aquele que `champollion sync` usa por lá.
- **Jobs de `run_benchmark`** são registrados em `jobs.json`, que mantém os
  50 mais recentes. Cada job possui uma pasta em `jobs/` com sua saída e, para um
  item de fila ou corpus registrado, os resultados do harness. Uma execução em um arquivo
  de teste sob sua posse grava seus resultados e cache ao lado desse arquivo, em
  `results/` — exceto um arquivo em uma pasta que `mt-eval contest prepare`
  marca como liberável, cuja execução grava na pasta `runs/` da competição. Cada
  execução desse tipo recebe sua própria pasta `mcp-run-<id>/` lá, e `get_run_status`
  exibe o comando `mt-eval compare` sobre todas elas
  (`results/mcp-run-*/*_report.json`).
  Execuções de fila gravam seus relatórios em `eval/logs/harness/queue/` sob a
  pasta de trabalho do servidor, como o harness sempre faz.

:::note[Os gastos são delimitados por design]
`run_benchmark` **recusa uma execução de fila sem limites.** Você deve passar exatamente um
limite — `budget`, `top` ou um `item_id` específico. Não existe uma chamada para "apenas executar a
fila", pois um agente que não compreenda a fila poderia, de outro modo,
gastar sem limites.
:::

## Versão do protocolo

O transporte é **apenas stdio** — um processo de servidor por agente.

A [revisão de 28/07/2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/) do MCP
tornou o protocolo sem estado (stateless) por padrão, descontinuando o handshake `initialize` e
o cabeçalho `Mcp-Session-Id`. Este servidor não é afetado em seu design: não utiliza nenhuma
das funcionalidades descontinuadas (Roots, Sampling, Logging), nunca usou o transporte legado
HTTP+SSE e já segue as novas diretrizes para estado entre chamadas —
`run_benchmark` gera um identificador explícito de job que o modelo retorna, em vez
de depender de uma sessão de transporte.

Ele **não** foi atualizado para a nova revisão, pois nenhum SDK em TypeScript
publicado ainda oferece suporte a ela. Consulte o [README do
servidor](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para
ver o posicionamento completo.

## Endpoints legíveis por máquina

Nenhum cliente MCP é necessário para estes:

| Endpoint | O que é |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | A [porta de entrada para agentes](/for-agents), em Markdown puro |
| [`/llms.txt`](https://champollion.dev/llms.txt) | O índice curado deste site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Todas as páginas indexadas, em linha |
| [`/queue.json`](https://champollion.dev/queue.json) | A fila completa de benchmarks |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Principais itens da fila |
| [`/registry.json`](https://champollion.dev/registry.json) | O registro de corpora |
| [`/mesh.json`](https://champollion.dev/mesh.json) | O grafo de idiomas medidos |

## Próximos passos

- [Conduzindo os trilhos via MCP](/docs/agents/mcp) — o perfil rails, passo a passo
- [O contrato operacional](/docs/agents/contract) — as regras sob as quais um agente opera
- [Guia do Agente — construção e benchmarking](/docs/agents/measurement)
- [Guia do Agente — traduzindo com a CLI](/docs/agents/serving)
- [Enviar um Método](/docs/network/getting-started/submit-a-method)
