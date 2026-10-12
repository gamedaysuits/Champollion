---
title: "MCP Server — a porta de acesso para o agente"
sidebar_label: "MCP Server"
description: "Conecte um agente de IA ao Champollion via Model Context Protocol: 34 ferramentas para consultar idiomas, navegar pela fila de benchmark e pelo registro de corpus, executar avaliações, treinar e exportar modelos e traduzir — além de mostrar exatamente quais precisam de mais do que um npx install."
---

# Servidor MCP — a porta de entrada para agentes

O `champollion-mcp-server` expõe o Champollion a agentes de IA por meio do [Model
Context Protocol](https://modelcontextprotocol.io). Se você é um agente ou está
configurando um, esta é a porta de entrada: **34 ferramentas, 3 recursos e 4 prompts**
via stdio.

Tudo aqui também é acessível como HTTP simples — veja [Endpoints legíveis por máquina](#machine-readable-endpoints) — mas o servidor MCP é a única superfície que permite que um agente *aja* (traduza, execute um benchmark, treine um modelo) em vez de apenas ler.

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

## Leia isto antes de depender dele

**Quatorze das 34 ferramentas funcionam a partir de uma instalação básica do `npx`, e a `translate` funciona
assim que tiver um mecanismo configurado. As outras dezenove precisam de pacotes Python que o pacote npm
não inclui e não pode incluir.** Elas não falham silenciosamente — cada uma retorna um
erro acionável informando o que está faltando —, mas é bom conhecer a estrutura antes
de se planejar em torno dela.

| Ferramentas | Funcionam após `npx`? | Do que mais precisam |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Sim** — somente leitura, servidas a partir de endpoints públicos | nada |
| `translate` | **Sim**, com um mecanismo | uma chave de API para o mecanismo escolhido — ou nenhuma, com o método `local` e um servidor de modelos na sua própria máquina |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Não | o harness de avaliação — `pipx install mt-eval-harness` |
| as quinze ferramentas `forge_*` | Não | NMT Forge 0.2.0 ou posterior — `python3 -m pip install nmt-forge` (adicione `'nmt-forge[hf]'` para treinar e servir). Ele traz o harness de avaliação embutido e localiza language cards por conta própria; nenhum clone é necessário |

Nenhum clone do repositório é necessário para nada disso.

## O que as ferramentas fazem

**Navegar e orçar o trabalho.** `list_queue` e `get_queue_item` percorrem a fila de benchmarks abertos — a lista classificada de medições que mais melhorariam o mapa. `estimate_cost` precifica um conjunto de execuções antes de você gastar qualquer coisa.

**Consulte informações.** O `search_languages` pesquisa os language cards por nome,
código, família ou região, tolerando erros de digitação. Cada resultado também informa onde
o idioma é falado (países, um ponto no mapa, macroárea) e seus outros
nomes — apenas os fatos para os quais o card cita uma fonte, cada um acompanhado de sua fonte, permitindo
distinguir idiomas com nomes semelhantes. Uma localização sem fonte nunca
é exibida; a linha indica isso e inclui um link para o registro do idioma no Glottolog.
Os cards preenchidos a partir das tabelas de cards publicadas em champollion.dev (em uma
instalação via npm, qualquer idioma fora do conjunto principal integrado) ainda não possuem
fontes por campo — elas virão na próxima atualização das tabelas —, portanto essas
linhas trazem o link do Glottolog em vez de uma localização. O `language_overview` é o
ponto de partida em página única para desenvolver para um idioma: o que existe, o que pode
ser executado e os próximos passos. O `get_language` retorna o card completo com fontes citadas.
O `list_corpora` lista os corpora de avaliação
registrados para um par de idiomas ou família de benchmark — apenas metadados (tamanho,
licença, grau de contaminação e se o harness pode buscá-lo, precisa de um
token de acesso ou o mantém em quarentena); o conteúdo do corpus nunca é retornado,
e um par cujos corpora estejam todos em quarentena indica isso em vez de parecer
não suportado. O `get_results` e o `get_run_card` leem execuções pontuadas
do leaderboard público. O `get_metric_reliability` responde à pergunta que a maioria
dos agentes erra — *em qual métrica devo confiar para este idioma de destino?* —
a partir de correlações com julgamentos humanos por família linguística. O `list_contests`
e o `get_contest` mostram concursos e seus termos declarados; inscrever-se em um é uma
etapa de CLI autorizada por humanos, nunca uma ferramenta.

**Aja.** O `translate` executa o texto pelo pipeline testado, com Translation
Memory (repetições não custam nada) e um quality gate determinístico. Cada resposta
informa o mecanismo que realmente executou, acompanhado de seu modelo e endpoint, quando disponíveis.
O `run_benchmark` inicia uma avaliação e retorna um **job id imediatamente**,
pois execuções reais duram mais que qualquer timeout de cliente; você consulta o `get_run_status` periodicamente com
esse id. Um job sobrevive ao reinício do servidor: a execução continua e
consultar o mesmo id depois ainda retorna seu status e resultados. Nada
é publicado a menos que você passe `publish: true`; o plano então informa o que se tornaria
público — cada linha com seu texto de sentença ou apenas pontuações; o prompt ou apenas
seu hash; e onde —, e uma publicação real exige `publish_ack` nas palavras exatas
fornecidas pelo plano, garantindo que o usuário as tenha visto primeiro. Uma execução feita sem isso
pode ser publicada posteriormente, sob a mesma validação. O `preview_publish` é somente leitura:
ele exibe a própria prévia de publicação do harness, as palavras exatas e a chamada exata
de `publish_report` que faria a publicação, não sendo capaz de publicar. Ele
carrega a anotação MCP `readOnlyHint: true`, de modo que um host de agentes que solicita confirmação
antes de cada gravação possa autorizá-lo diretamente. O `publish_report` realiza a gravação
(anotado como `destructiveHint` e `openWorldHint`), e o `scores_only`
omite o texto da sentença. Todo plano também começa informando o
status de `EVAL PACK:` do idioma de destino — `missing` (com o comando que
o instala), `ready` ou `none needed` — e informa a licença do corpus e seu
termo `do_not_train`, já que a execução passa `--yes`. Um FST ausente (o
analisador ou seu runtime pyhfst) nunca interrompe a execução: ela prossegue, e o run
card indica a aceitação FST como não computada. Qualquer outra parte ausente interrompe a execução
antes da tradução. O `skip_fst` e o `skip_eval_standard` pontuam sem essas
partes, e o run card indica o que foi omitido. O plano também informa se o
COMET será calculado (o harness o calcula sempre que `unbabel-comet` estiver
instalado; `comet: true` torna-o obrigatório para a execução), e `metricx` e `fuse`
solicitam o MetricX-24 opcional do harness e o comparador no estilo FUSE. Para cada
um, o plano informa, com base no harness, se está instalado, o que instalar
e o que ele baixa. Uma execução confirmada que solicite uma métrica que o harness
não consiga calcular é recusada em vez de ser executada sem ela. As linhas `Results:`
e `Cache:` do plano indicam onde o log de execução, o relatório e o cache de tradução são salvos.
Um arquivo de teste dentro de uma pasta que o `mt-eval contest prepare` marca como liberável
(o `public/` de um concurso) é executado na pasta `runs/` do concurso, garantindo que
nada gravado por uma execução seja liberado junto com ele. Um modelo na sua própria
máquina (um servidor local ou `method: "local-model"`, que o harness executa
no mesmo processo e dispensa atestação) é reportado como `$0 API cost (runs on
this machine)`.

**Treine sem se enganar.** O `get_training_guardrails` retorna as regras
extraídas de falhas reais e medidas. As quinze ferramentas do `forge_*` executam o
[NMT Forge](/docs/network/getting-started/training-honestly) uma etapa protegida
por vez — `forge_status` primeiro e após cada etapa (ele indica o próximo
comando e a ferramenta que o executa), `forge_preflight` para ver quais verificações um
comando atingirá antes de recusar, `forge_prereg_template` e `forge_prereg`
para registrar previsões antes que qualquer pontuação de teste exista (e antes de qualquer
benchmark no conjunto de teste: uma leitura de pontuação bloqueia um pré-registro posterior),
`forge_export` para pontuar o conjunto de teste uma única vez e empacotar o modelo treinado,
`forge_compare` para fazer testes A/B entre dois modelos com a ressalva de quase-gêmeo de cada um ao lado
do vencedor, e
`forge_prereg_verdict` para registrar o veredito do próprio usuário sobre uma previsão que o forge
não consegue avaliar (um intervalo de texto livre) — exibido como um veredito humano, nunca como
computado. O `forge_status` lista cada execução treinada com sua pontuação de desenvolvimento e
informa quando um conjunto de desenvolvimento está saturado (uma pontuação de desenvolvimento perfeita, sem critérios
para a seleção de checkpoints escolher). Quando o harness de avaliação insere uma ressalva
em uma pontuação de teste (por exemplo, uma saída quase constante: um punhado de saídas
fornecidas para cada frase de origem), `forge_export`, `forge_status`,
`forge_compare` e `forge_lint` a exibem nas próprias palavras do harness, e uma
ressalva crítica vem primeiro na etapa seguinte: a pontuação nunca é citada sem
ela. Uma recusa é retornada
com o que deu errado, por que isso importa e a correção necessária. Duas etapas duram mais do que qualquer chamada
de ferramenta e são executadas no terminal: o treinamento (`nmt-forge run`) e a disponibilização do
modelo exportado (`nmt-forge serve`, que o coloca atrás de um endpoint local que
o `translate` e a CLI podem usar).

### Argumentos

`name` é obrigatório e `name?` é opcional. Qualquer ferramenta que aceite um único
idioma também o aceita como `language`: "`code` ou `language`" significa que qualquer um
dos nomes funciona, bastando passar um deles. Os nomes originais continuam funcionando.

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
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (um msgctxt gettext: um para todo o texto, ou um por texto), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | um modo: `budget?` ou `top?` (fila), `item_id?`, ou `corpus?` com `model?` (com `method_dir`, o modelo que o plugin carrega), `method?` ou `method_dir?` (um diretório de plugin de método; `local-model` precisa de `model` — não tem padrão), `allow_model_pair_mismatch?` (`local-model`: executa um modelo de par OPUS-MT que nomeia outro par, como uma baseline de idioma relacionado), `attest_local_transport?` (um mecanismo de MT ou um plugin; nunca necessário para `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (execuções com LLM: o script ISO 15924 no qual a saída deve ser escrita, como `Cans` ou `Latn`; o plano avisa quando o card de destino lista mais de um), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` e `skip_eval_standard?` (execuções de item e corpus: pontuam sem o FST ou as métricas padrão de avaliação, marcadas como não computadas), `comet?` (exige COMET: a execução é recusada enquanto ele não estiver instalado), `metricx?` com `metricx_model?`, e `fuse?` (execuções de item e corpus: o MetricX-24 opcional do harness e o comparador no estilo FUSE, recusados enquanto não estiverem instalados); depois `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (com publicação real: as palavras exatas impressas pelo plano), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (o `*_report.json` de uma execução concluída), `scores_only?`, `redact_coaching?`, `anonymous?` (somente leitura: sem `confirm`, não pode publicar) |
| `publish_report` | `report` (o `*_report.json` de uma execução concluída), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (as palavras exatas impressas pela prévia) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (o comando a verificar), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` ou `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` ou `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (padrão `data/split`, o caminho lido pelo config.json do `forge_init`), `dev?`, `register?` (um prefixo de nome, ou `true` para `project`), `allow_rotate?`, `near_dupe?` (um limiar de Jaccard como 0.6, quando o forge recomenda o recorte de quase-duplicatas), `max_group?` (com `near_dupe`: o maior grupo de quase-duplicatas), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (com seu próprio `clean_to`, por exemplo, `corpus.notwins.jsonl` — nunca o arquivo all-data), `companion_config?` (com `drop_test_twins`: onde vai a configuração do modelo livre de gêmeos; padrão `config-notwins.json`), `overwrite?` (substitui um arquivo `clean_to` usado por uma configuração, execução, divisão ou outra auditoria — recusado sem isso), `full_indices?` (todas as listas de números de linha completas; por padrão, listas longas retornam como `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (fixa a uma execução), `allow_after_reads?` (apenas para previsões registradas antes das leituras pontuadas do conjunto), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (seu número ou seu próprio id), `verdict` (`held` ou `missed`), `by` (quem julgou), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (o manifesto de execução de cada modelo: seus dados de treino são verificados quanto a quase-gêmeos), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Por exemplo, `get_metric_reliability { "language": "crk" }` e
`get_metric_reliability { "target": "crk" }` fazem a mesma pergunta.

### Traduzindo com um modelo implantado por você

O `nmt-forge serve` exibe dois endereços para o modelo que disponibiliza. Aponte
o `translate` para qualquer um deles:

| Argumento | Use com | Exemplo |
|---|---|---|
| `base_url` | `method: "local"` — um servidor compatível com OpenAI (também `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — o contrato de API do Champollion | `http://127.0.0.1:8378/translate` |
| `model` | apenas mecanismos de LLM; recusado para APIs de tradução automática, que não possuem nenhum | `llama3.1` |
| `project_dir` | qualquer método — usa a Translation Memory daquele projeto | `~/my-app` |

Um servidor na sua própria máquina não precisa de chave. Um endpoint remoto de `api` lê sua
chave de `CHAMPOLLION_API_KEY` nas variáveis de ambiente do servidor. A ferramenta recusa
um argumento desconhecido pelo nome, em vez de ignorá-lo, evitando que um argumento
com erro de digitação envie silenciosamente seu texto para um modelo diferente.

### Onde o servidor mantém seu estado

Tudo fica armazenado em `~/.champollion-mcp/` (defina `CHAMPOLLION_MCP_HOME` para alterá-lo de
lugar):

- A **Translation Memory do `translate`** tem seu próprio arquivo,
  `.champollion/tm.json` nessa pasta. Ela é separada do `.champollion/tm.json` de qualquer
  projeto. Passe `project_dir` para usar o arquivo de um projeto em vez disso,
  aquele que o `champollion sync` utiliza nele.
- Os **jobs do `run_benchmark`** são gravados em `jobs.json`, que mantém os
  50 mais recentes. Cada job possui uma pasta em `jobs/` com sua saída e, para um
  item de fila ou um corpus registrado, os resultados do harness. Uma execução em um arquivo
  de teste que você possua grava seus resultados e cache ao lado desse arquivo, em
  `results/` — exceto no caso de um arquivo em uma pasta marcada pelo `mt-eval contest prepare`
  como liberável, cuja execução grava na pasta `runs/` do concurso.
  Execuções da fila gravam seus relatórios em `eval/logs/harness/queue/` sob a pasta
  de trabalho do servidor, como o harness sempre faz.

:::note[Os gastos são limitados por design]
`run_benchmark` **recusa uma execução de fila ilimitada.** Você deve passar exatamente um limite — `budget`, `top` ou um `item_id` específico. Não há uma chamada "apenas execute a fila", porque um agente que entenda mal a fila poderia, de outra forma, gastar sem limites.
:::

## Versão do protocolo

O transporte é **apenas stdio** — um processo de servidor por agente.

A [revisão de 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) do MCP tornou o protocolo sem estado (stateless) por padrão, aposentando o handshake `initialize` e o cabeçalho `Mcp-Session-Id`. Este servidor não é afetado em seu design: ele não usa nenhuma das capacidades descontinuadas (Roots, Sampling, Logging), nunca usou o transporte legado HTTP+SSE e já segue as novas diretrizes para estado entre chamadas — `run_benchmark` cria um identificador de trabalho explícito que o modelo devolve, em vez de depender de uma sessão de transporte.

Ele **não** foi atualizado para a nova revisão, porque nenhum SDK TypeScript publicado fala essa versão ainda. Veja o [README do servidor](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para o posicionamento completo.

## Endpoints legíveis por máquina

Nenhum cliente MCP é necessário para estes:

| Endpoint | O que é |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | A [porta de entrada para agentes](/for-agents), como markdown bruto |
| [`/llms.txt`](https://champollion.dev/llms.txt) | O índice curado deste site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Todas as páginas indexadas, embutidas |
| [`/queue.json`](https://champollion.dev/queue.json) | A fila completa de benchmarks |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Os principais itens da fila |
| [`/registry.json`](https://champollion.dev/registry.json) | O registro do corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | O grafo de idiomas medidos |

## A seguir

- [Guia do Agente — construção e benchmarking](/docs/network/getting-started/agent-guide)
- [Guia do Agente — traduzindo com a CLI](/docs/guides/agent-guide)
- [Enviar um Método](/docs/network/getting-started/submit-a-method)
