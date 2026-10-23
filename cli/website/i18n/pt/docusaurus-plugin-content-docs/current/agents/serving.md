---
title: "Disponibilização e implantação"
slug: /agents/serving
description: "Coloque um modelo avaliado para funcionar: o arquivo deployment/1 gerado pelo nmt-forge export, mt-eval translate e serve, nmt-forge serve e sua página de testes, o contrato service-api/1 /translate, champollion connect e champollion sync conduzido por um agente — com o que uma saída somente local pode e não pode fazer."
---

# Serviço e implantação

**Uma implantação é o pipeline de medição aplicado apenas à entrada de origem.** Um
arquivo deployment/1 define o método, seu modelo, seus gates e o par. O
mesmo arquivo é testado em um conjunto de teste, executado sobre um arquivo e servido, para que o que
foi medido seja o que vai para produção. Esta página é a parte do agente de
[Coloque para funcionar](/docs/put-it-to-work).

Em toda parte: um modelo que aprendeu com frases marcadas como local-only pode repeti-las,
então **sua saída também é local-only**. Todas as ferramentas abaixo mantêm essa saída
neste computador, a menos que os detentores dos dados tenham concordado com o contrário, e
`--holders-agreed-by` registra quem concordou. **Aviso.** Passe essa flag apenas com
o nome que a pessoa lhe deu, depois que ela disser que os detentores concordaram.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Obrigatório: `id`,
`pair` (`source`, `target`, opcional `target_script`), `method` (`method`,
opcional `model`). Opcional: `gates` (um arquivo gate-chain/1) e `serve`
(`host`, padrão `127.0.0.1`; `port`). Os caminhos são relativos à raiz do projeto,
onde os trilhos executam comandos. Ele não indica pontuações.

**Quem escreve.** `nmt-forge export`, quando a exportação fica dentro de um projeto
de trilhos (um `champollion.project.json` acima dele), grava
`deploy/<name>.json` — `<name>` é `--name` em kebab-case, caso contrário
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

Ele não grava nenhum (e informa `no deployment file: …`) quando a exportação estiver fora de
um projeto de trilhos, quando o modelo foi selecionado sob um hook de decodificação (apenas
`nmt-forge serve` executa os hooks do forge), quando a configuração não indicar nenhum par, quando o
documento não passar na validação ou quando `deploy/<name>.json` já implantar
outro modelo (nunca substituído).

**Quem lê.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Travas.** Com `--deployment`, `run` e `translate` recusam `--method`,
`-m`/`--model`, `--gates` e `--target-script` (*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*); `serve` também recusa `--pair`. Uma entrada em outro par é recusada
(`deployment <id> translates from <src>; this input is in <x>`). Uma
implantação cuja cadeia de gates recorre a fallback pode ser traduzida e servida, mas não
medida: `mt-eval run` recusa uma cadeia que recorre a fallback
([métodos e gates](/docs/agents/methods#gate-chains)).

## O que uma exportação contém

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` grava:

| Caminho | O que é |
|---|---|
| `<dir>/model/` | A pasta a implantar: pesos e tokenizador, `forge-model.json` (no que foi treinado, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, tipo `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (porta 8378 a menos que `--port`), `card.commercial_ready: false`, `evidence` com o chrF++ do conjunto de teste, seu intervalo e n |
| `<dir>/evaluation/` | A evidência do conjunto de teste. Nunca copie com o modelo |
| `<dir>/input-words.json` | As palavras do lado de entrada das frases de treino, uma de cada, ordenadas (`words`, `english`, `sentences`, `from` e `notes` informando um arquivo de treino que não pôde ser lido como a execução leu). Ao lado de `model/`, nunca dentro dele: são palavras dos dados das pessoas. Gravado quando a exportação inclui o modelo e seus arquivos de treino estão neste computador; caso contrário, o resumo da exportação informa `input_words.written: false` com `why`. `nmt-forge serve` o lê para listar as palavras que o modelo nunca viu ([abaixo](#words-the-model-never-saw)) |
| `<dir>/README.md` | O que a exportação é |

## `mt-eval translate`

O pipeline sobre um arquivo, sem pontuação. `--out` aceita `.jsonl` (uma linha por
segmento: `id`, `source`, `output`, `error` e, com gates, `gates`,
`shipped_from`, `fallback`) ou `.tsv` (origem, tab, saída). Sem `--out`,
ele grava `<run id>.translations.jsonl` na pasta de saída (`-o`). A
saída carrega os termos da entrada — e os do modelo — em um sidecar set/1.

**Trava.** Quando a saída do método é local-only (ou a do fallback da sua cadeia
de gates é), um destino fora do projeto é recusado antes que qualquer coisa
seja traduzida: *"refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project"*. Com o acordo, o sidecar registra
`holders_agreed: {by, date}`; o arquivo continua local-only para todas as ferramentas.

`--json` imprime `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` e `output_gates`. Código de saída 1 quando todas as linhas falharem. `--publish`
é recusado: não há pontuação.

## `mt-eval serve`

| | |
|---|---|
| Endereço padrão | `127.0.0.1:8379` (`--host`, `--port` ou o bloco `serve` da implantação) |
| O que ele serve | Apenas um método que executa neste processo: `lexicon`, `local-model` ou um plugin cujo method.json declare `dependency_class` `S` ou `O`. Um LLM ou um motor hospedado é recusado |
| Token | `MT_EVAL_SERVE_TOKEN`, apenas a partir do ambiente. Obrigatório para escutar em qualquer endereço que não seja `127.0.0.1`, `::1` ou `localhost`; quando definido, é exigido em cada `POST` (loopback também). `GET /health` nunca precisa dele |
| Limites | Corpo de 1.000.000 bytes, 500 chaves, 20.000 caracteres por string — ultrapassar qualquer um resulta em `413` |
| Gates | `--gates <chain>` (ou o `gates` da implantação). O plugin de cada gate deve avaliar sem referências, ou não iniciará. Um fallback é permitido aqui e deve ser executado neste processo |

**Trava — fora do loopback.** Sem um token: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"*. Com saída
local-only e sem acordo: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"*. A saída é local-only quando o sidecar de um dicionário disser isso (ou
não puder ser lido), ou quando o `forge-model.json` da pasta de um modelo registrar termos
de treino local-only ou não registrar nenhum; ela é relatada como desconhecida (`null`) para um
plugin ou uma pasta de modelo sem `forge-model.json`.

`/health` responde a `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (neste processo — nada é enviado para lugar nenhum), `scored`
(nada), `output_gates` e `gates` (id da cadeia, fingerprint, gates, fallback),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (o repositório) e `version`.

Com gates, um segmento recusado retorna como seu gate definir: `drop` — a chave
sob `errors`; `keep-source` — a origem; `flag` — a saída, a chave
indicada em `meta.gates.flagged`; `fallback` — a tradução do fallback se os
gates a aceitarem. Sem gates, ele não verifica nada do que retorna.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Endereço padrão | `127.0.0.1`, porta `NMT_FORGE_SERVE_PORT` ou 8378 |
| Token | `--token` ou `NMT_FORGE_SERVE_TOKEN`; obrigatório fora do loopback. `--detach` obtém apenas do ambiente |
| Rotas | `GET /` — uma página de teste para a pessoa (sem token; solicita um quando houver um definido); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (compatível com OpenAI); `GET /v1/models` |
| `--detach` | Retorna assim que `/health` responder; interrompido se não responder em até 120 s. Recusado quando a porta já responder |
| `--no-hook` | Servir sem o hook de decodificação da execução (indicado em `/health` e em `meta`) |
| `--allow-locale` | Aceitar também estes códigos de localidade (repetível) |
| `--device` | `auto` (padrão) ou `cpu`. Com `auto`, um servidor iniciado enquanto um job de treino do mesmo projeto executa usa a CPU em vez de compartilhar a GPU, e `/health` informa isso (`device_note`) |
| Limites | Corpo de 1.000.000 bytes, 500 chaves, 20.000 caracteres por string, 5.000 unidades de trabalho do modelo por requisição — ultrapassar qualquer um resulta em `413`. O modelo é consultado com 32 partes por vez, de modo que uma frase de outra requisição espera por um lote, nunca por uma requisição inteira. Uma requisição que ainda estiver em execução após 600 s é recusada por inteiro — `503`, *"send fewer pieces at a time"* — nunca respondida parcialmente |
| Decodificação | Busca em feixe (beam search) com o `num_beams` da exportação quando a exportação registrar `beams_applied` (como o modelo foi medido); gulosa (greedy) para uma exportação mais antiga. O texto enviado é normalizado para NFC, assim como os dados de treino |

**Trava.** Fora do loopback, um modelo cuja saída seja local-only — treinado em
frases local-only, ou sem registro do que aprendeu — é recusado
sem `--holders-agreed-by`. `/health` relata `pair`, `accepts`,
`decode_hook`, `run`, os relatórios de dev e test, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` e `output_gates`. Cada resposta de `/translate` de um
modelo local-only traz `meta.output_local_only: true`, e cada
resposta de `/v1/chat/completions` traz `meta.output_local_only` (true ou false).
Quando os limites de comprimento cortam algo em uma requisição, o `meta.cut` conta as
frases cortadas na entrada (`inputs`) e as traduções que pararam no
limite (`outputs`) ([treino](/docs/agents/training#the-guarded-loop)).

**Aviso.** A página de teste é para a pessoa. `try_translation` (MCP) a envia
para lá no caso de um modelo local-only; nunca chame `/translate` você mesmo para ler a
saída dele ([contrato](/docs/agents/contract) §1).

### Palavras que o modelo nunca viu

Uma frase contendo uma palavra que o modelo nunca viu no treino tem grande probabilidade de ser
traduzida incorretamente, por mais fluida que pareça. Na língua de teste inventada, uma
frase retida com uma palavra de conteúdo que o modelo não tinha visto foi traduzida
corretamente 0 vezes em 358 (ByT5-small com 1.600, 6.400 e 25.600 pares de treino),
e saiu confiantemente errada — fluida, cada palavra em uma forma real, mas com o sentido
errado — em 32%, 55% e 83% das vezes: quanto melhor o modelo, mais
convincente é o palpite. Por isso, o servidor lista essas palavras.

- **`/health`** informa se é possível: `unseen_words_check` é `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** adiciona, apenas quando uma requisição contiver essas palavras,
  `meta.unseen_words` (chave → as palavras do texto dessa chave que o modelo nunca
  viu, uma vez cada, em ordem) e `meta.unseen_note`. **`/v1/chat/completions`**
  adiciona o mesmo, indexado pelo que foi solicitado: `SEG_<id>` por segmento no modo
  bloco, `page` para uma página, as próprias chaves do objeto JSON, ou `text`.
- **Sem registro, informado em cada resposta.** O servidor lê `input-words.json`
  da pasta acima da pasta do modelo que ele serve. Não havendo nenhum lá — um
  export made before 2026-10-13, one made without its training files on this
  computador, ou uma pasta de modelo copiada para longe de sua exportação — o
  `meta.unseen_check` de cada resposta informa que não pode verificar e o porquê. Sirva o modelo a partir da sua
  export, or export it again.
- **A página de teste** marca a linha: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

Uma palavra é uma sequência de letras em qualquer sistema de escrita (apóstrofos internos mantidos),
em minúsculas, em NFC. Quando o lado de entrada for o inglês, uma terminação comum em inglês
conta como vista em qualquer um dos sentidos (`walk` vista → `walked` conta; `walked`
vista → `walk` conta).

## service-api/1 — o contrato de `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json`, aderente a
`shared/test-fixtures/framework/service-api-vectors.json` (executado contra
`mt-eval serve` e `nmt-forge serve`).

- **Requisição** `POST /translate`: `keys` (chave → string de origem; obrigatório),
  opcional `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` para texto de documento), `instructions` (chave → nota; enviado apenas a um
  servidor declarado para segui-las, `accepts_instructions`). Um campo que o servidor
  não usa é ignorado, nunca recusado.
- **Resposta:** `200` `{translations, meta}` — `meta` é obrigatório; `207` adiciona
  `errors` (chave → `{message}`). Os erros são `{error: {message}}`: `400` uma
  requisição que não pode aceitar, `401` um token ausente ou incorreto, `404` uma rota
  desconhecida, `413` grande demais, `500` o método falhou — nunca uma resposta parcial.
  (`nmt-forge serve` também responde `503` para uma requisição além do limite de 600 s.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false ou null), `cost_usd`; os servidores podem adicionar campos.
- **`GET /health`** exige `status` (`ok`), `pair`, `output_gates` e
  `output_local_only`; opcional `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **A regra:** um servidor cujo `/health` informe `output_local_only: true` coloca
  `output_local_only: true` no `meta` de cada resposta, e o cliente grava
  essa saída somente onde os detentores dos dados concordaram.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Ele localiza o `method.json` (o arquivo indicado, ou `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` na
pasta), o instala no `.champollion/methods/` do app e aponta
cada um de seus pares (`<inputLocale>:<target>`) para ele como `methodPlugin`, mantendo
o restante do par. A pasta do app precisa de `champollion.config.json`, e o
método deve traduzir a partir do `inputLocale` do app.

**Trava.** Um modelo cuja saída seja local-only — conhecida a partir de seu
`forge-model.json` (um ausente conta) ou a partir do `/health` de seu serviço —
é recusado sem `--holders-agreed-by`: o que ele grava nos arquivos de localidade
do app é publicado junto com o app. Com ela, cada par registra
`holdersAgreed: {by, date, method, what}`. Ele emite um aviso, sem falhar, quando
nada responder no endpoint (`nmt-forge serve <dir> --detach` o inicia)
ou quando `/health` não seguir o service-api/1. `--json` imprime `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, conduzido por um agente

`sync` traduz os arquivos de localidade de um app ou site com os métodos indicados em seu
`champollion.config.json`. Ele não faz perguntas interativas.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

A **saída de `--json`** é um objeto JSON por linha. No stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` com
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` e mais; um teste simulado (dry run) adiciona `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) e `maxCost`. No stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` e
`error`.

| Saída | Significado |
|---|---|
| 0 | Sem erros |
| 1 | Um nome `--redo` ou `--force-keys` não correspondeu a nenhuma chave; falhas sem nada processado; um erro |
| 2 | `--max-cost` interrompeu a execução antes de qualquer chamada (ou a estimativa era desconhecida); ou parcial: algo falhou, chaves foram retidas, formas de plural estão ausentes ou verify encontrou erros |

Um teste simulado (dry run) não envia nem grava nada, não executa verificação e sai com código 0, a menos que uma
chave indicada não corresponda a nada ou ocorra um erro. A verificação é executada após um sync real,
a menos que `--no-verify`.

**Trava — respostas local-only.** Para um método `api`, um lote cujo
`meta.output_local_only` seja `true` não é gravado a menos que o
`holdersAgreed` do par indique esse método; `sync` informa isso uma vez e indica a
chamada `champollion connect … --holders-agreed-by`. Essas chaves permanecem
sem tradução (ou vão para o fallback do par).

**Trava — o método `local`.** O método `local` (um endpoint compatível com
OpenAI) consulta o `/health` do servidor uma vez. Quando ele informa
`output_local_only: true` — como o `nmt-forge serve` faz para um modelo treinado em
frases local-only —, nada desse servidor é gravado, a menos que o
`holdersAgreed` do par indique `local`: *"the model at … says what it writes is
local-only … nothing from it was written"*, seguido pela chamada
`champollion connect <the model> --holders-agreed-by "<who agreed>"`. Um
servidor cujo `/health` não responder ou não informar `true` (um servidor Ollama ou
LM Studio, por exemplo) é usado como antes.

**Aviso.** Conecte um modelo do forge com `champollion connect` (a rota
`api`): ele lê o próprio registro do modelo sobre o que ele aprendeu e registra
o acordo dos detentores no par sob o método que ele instala.

**Palavras que o modelo nunca viu.** Quando um servidor do forge listar chaves em
`meta.unseen_words`, os métodos `local` e `api` emitem um aviso com as chaves —
nunca com o texto ou com as palavras: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"* (e então *"and <n> more"*).
As traduções ainda são gravadas; o aviso é como as pessoas ficam sabendo quais
devem revisar ([coaching](/docs/agents/coaching)).

**Aviso.** Repasse cada linha de `warn`. Textos traduzidos por máquina são rascunhos
até que um falante os revise; nunca os chame de corretos.

## `champollion serve`

Um servidor diferente: ele serve a pilha de tradução configurada do próprio **projeto do app**
(método, coaching, memória de tradução, quality gate) para
outros projetos. Padrões `127.0.0.1`, porta 1822. Ele exige um token de portador (bearer token)
mesmo em loopback (`--token` ou `CHAMPOLLION_SERVE_TOKEN`, no mínimo 12
caracteres), a menos que `--no-auth`, o qual é aceito apenas em uma vinculação (bind) de loopback.
`--emit-manifest` grava um manifesto method/1 do tipo `service` para os consumidores.
Seu `/health` é `{ok, service, version}`, não o documento de saúde de service-api/1,
portanto `champollion connect` relata problemas de saúde para ele.

## Aprofunde-se

- [Coloque para funcionar](/docs/put-it-to-work) — a versão para as pessoas.
- [Métodos e gates](/docs/agents/methods) — method/1 e gate-chain/1.
- [Regras de dados e transmissão](/docs/agents/data-rules) — local-only e
  `holders_agreed`.
- [O modelo dos trilhos](/docs/agents/rails-model) — o pipeline único.
- [Referência de `mt-eval`](/docs/reference/mt-eval) e
  [referência de `nmt-forge`](/docs/network/getting-started/forge-command-reference).
- Tradução de apps e sites: [CI/CD](/docs/guides/ci-cd),
  [solução de problemas](/docs/guides/troubleshooting).
