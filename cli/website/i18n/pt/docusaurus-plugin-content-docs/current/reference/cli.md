---
sidebar_position: 1
title: "Referência da CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Referência da CLI

## Comandos

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

Os comandos que operam com o índice compartilhado e o leaderboard, em vez do seu
projeto, estão agrupados sob `champollion network`. Cada um também funciona sem o
prefixo:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Execute `champollion <command> --help` para obter ajuda detalhada sobre qualquer comando
(`champollion network` lista os comandos de rede).

## Opções Globais

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Como escrever um par de idiomas

Um par de projeto é escrito da forma como `champollion.config.json` o indexa: `en:fr`. `sync`, `verify` e `serve` também leem `en>fr` e `en-fr`, e `en-pt-BR` é comparado com os pares que você configurou. Os comandos de rede (`network register-corpus`, `leaderboard`, `recommend`, `submit`) escrevem um par como `eng>crk`, a forma que o leaderboard armazena e `mt-eval` utiliza, e leem `eng-crk` e `eng:crk` da mesma maneira. Usando apenas hífens, um par é composto por dois códigos de duas ou três letras (`eng-crk`). Um código com seu próprio hífen precisa de `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` é recusado, nunca adivinhado. Use aspas na forma `>` no shell: sem aspas, `--pair eng>crk` redireciona a saída para um arquivo chamado `crk`.

---

## init

Assistente de configuração interativa que cria `champollion.config.json`. Orienta você através da locale de origem, idiomas de destino, formato de arquivo e modelo de tradução.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**Opção `--content-dir`**: Uma pasta de arquivos Markdown/MDX para traduzir juntamente com seus arquivos de locale (escrito como `contentDir`). A pasta precisa existir; `init` é interrompido sem gravar nada se ela não existir.

**Um projeto com um arquivo local-only usa `local` por padrão**: O método padrão é `llm` (OpenRouter, um serviço hospedado). Quando um arquivo em qualquer lugar do projeto está marcado como local-only — um `<file>.champollion.json` ao lado dele com `"transmission": "local-only"`, como `champollion network register-corpus --data <file> --tier local-only` grava — `init` (e `--yes` também) adota por padrão o método `local`: um modelo servido nesta máquina (o padrão `http://localhost:11434/v1` do Ollama, ou o servidor que `LOCAL_API_BASE` nomeia). Ele informa o motivo, indicando o arquivo marcado, e como escolher deliberadamente um método hospedado: `champollion init --force --method llm --model <model>`. Um `--method` explícito sempre prevalece; `init` então anota o arquivo marcado ao lado do destino do texto.

**Executando `init` novamente (`--force`)**: Sem `--force`, `init` para se `champollion.config.json` já existir. Com ele, `init` parte desse arquivo e reescreve apenas o que as flags especificam: `--langs` define a lista de destinos (um idioma que já estiver lá mantém sua entrada — registro, escrita, nome), `--method` define o método padrão (e o modelo com ele, a menos que `--model` especifique um), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name` e `--method api` os pares que nomeia. Ele redetecta o layout de locales apenas quando o arquivo não encontra mais seus arquivos de origem (ou quando `--dir` aponta para outra pasta). Todas as outras configurações — `batchSize`, `pairs`, `glossary`, fallbacks, registros que você escolheu — permanecem como estavam. Ele imprime cada campo que alterou e os que manteve, e copia primeiro o arquivo anterior para `champollion.config.json.bak` (quando esse backup já contém um arquivo mais antigo, o próximo será `.bak.2`, `.bak.3` …; um backup mais antigo nunca é sobrescrito). Um arquivo que não seja um JSON válido não pode ser mantido: é feito um backup dele e um novo é gravado. Para alterar uma única configuração, edite-a no arquivo — `init` nunca precisa ser executado novamente para isso.

**Localizando seus arquivos de locale**: `init` procura pelo arquivo do idioma de origem antes de gravar qualquer coisa. Ele verifica primeiro a pasta comum do seu framework (next-intl `messages/`, i18next `public/locales/<lang>/` e depois `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), depois `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` e `src/i18n`, e imprime o que encontrou. Ele nunca grava um `localesDir` que não exista. Consulte [Layouts de arquivos de locale](/docs/getting-started/configuration#locale-layouts).

**Opção `--langs`**: Lista separada por vírgulas de códigos de idiomas de destino. Ignora a solicitação de idioma e aplica o preset de registro padrão de cada idioma — gravado na configuração, de modo que a escolha fique visível e editável: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (altere para outro preset ou para suas próprias palavras descrevendo o tom; um idioma sem presets é registrado como `{}`). Ele também cria os arquivos de destino vazios no seu layout (`fr.json`, ou `fr/common.json` para cada namespace). Combine com `--yes` para uma configuração totalmente não interativa.

**`--method api --endpoint <url>`**: Um servidor que implementa o contrato de API do champollion — por exemplo, um modelo treinado por você, servido pelo `nmt-forge serve`. `init` grava um par por destino, a mesma entrada do `DEPLOY.md` ao lado do modelo: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` indica se o endpoint segue instruções por chave (um modelo treinado com o nmt-forge não segue); sem ele, `init` obtém o valor do manifesto de um plugin instalado para o mesmo endpoint (`.champollion/methods/<name>/method.json`) ou o deixa indefinido. Ele requer `--langs` (o endpoint é configurado por par) e uma chave apenas para um endpoint fora desta máquina (`CHAMPOLLION_API_KEY`). Adicione manualmente um método `fallback` ao par, como mostra `DEPLOY.md`.

**Opção `--script`**: Alguns idiomas são escritos em mais de uma ortografia real — Cree das Planícies (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Silábico), Sérvio (`sr`: `Latn`, `Cyrl`). O Champollion não escolhe uma pela comunidade: `sync` recusa-se a traduzir esse idioma até que a configuração especifique uma. O assistente pergunta; com `--yes`, passe `--script crk=Cans` (vários: `--script crk=Cans,sr=Latn`; com um único idioma de destino, `--script Cans` é suficiente), o que grava `"languages": { "crk": { "script": "Cans" } }`. Sem isso, `init --yes` informa quais idiomas precisam de uma escolha, lista as opções e exibe a linha `"script"` para adicionar à entrada desse idioma na configuração.

**Opção `--name`**: Um código de uso privado (`qaa`–`qtz`, para uma variedade sem código confirmado) não possui ficha de idioma, portanto `init` informa isso em vez de pedir para você verificar a grafia. `--name qaa="Ayta (variety not yet confirmed)"` atribui a ele o nome de exibição que os prompts e relatórios usam, gravado como `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (vários: `--name "qaa=…;qab=…"`). Ao lado de cada registro, `init` também exibe as orientações de gênero que os prompts de LLM contêm para o idioma ([Orientações de gênero](/docs/getting-started/configuration#gender-guidance)).

**Presets de idioma**: Quando solicitado pelos idiomas de destino, você pode digitar nomes de presets:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Misture presets e códigos individuais: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Traduz chaves ausentes e obsoletas em todos os arquivos de locale. Executa verificação pós-sincronização por padrão.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Por padrão, `sync` carrega `.champollion/tm.json` e entrega traduções em cache para valores de origem inalterados. Trocar de modelo não descarta isso: o texto já traduzido com o modelo anterior é reutilizado sem custo, e a sincronização avisa isso antes da estimativa de custo. Para fazer com que o novo modelo os traduza: `--redo all --fresh-on-model-change` — ele envia as chaves que um modelo anterior traduziu, e o que o novo modelo já traduziu continua vindo do cache (isoladamente, `--fresh-on-model-change` afeta apenas as chaves que a execução traduziria de qualquer forma). Use `--no-tm` para ignorar o cache por completo (útil ao depurar a qualidade). Consulte [Translation Memory](/docs/concepts/translation-memory).

**Estimativa de custo e `--max-cost`**: A estimativa precifica apenas o que a execução irá faturar. Chaves, campos de front-matter e blocos Markdown já presentes na Translation Memory são precificados em $0, e a tabela mostra a economia gerada pelo cache. Um modelo servido nesta máquina (`local`, ou um endpoint `api` em `localhost`/`127.0.0.1`/`::1`) exibe `$0 (local)` — sem cobrança de API; seu hardware e energia não são contabilizados. `--max-cost` compara com esse valor. Acima do teto, ou sem estimativa (um método sem preço publicado, como `local` apontado para outra máquina), o sync é interrompido antes de qualquer chamada de API e encerra com `2`; nada é traduzido ou gravado. A linha final informa quantas chaves foram enviadas ao modelo e quantas vieram do cache.

Abaixo da tabela, uma linha informa a taxa na qual o valor foi precificado e de onde ela veio — para um modelo hospedado, o preço por 1 milhão de tokens de entrada e saída da lista pública de preços do OpenRouter, e quando foi lida (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); para um provedor direto (`openai`, `anthropic`, `gemini`), a mesma lista substitui o preço do próprio provedor, e quando a lista não pode ser lida (ou não possui preço para o modelo), usa-se uma cópia mantida no champollion, com a data em que foi verificada pela última vez e o motivo; DeepL, Google e Microsoft com base em seus preços públicos por caractere, com a respectiva data. É uma estimativa: a linha informa quantos tokens (ou caracteres) por chave são presumidos, e a cobrança depende dos comprimentos reais. Com `--json`, a estimativa traz os detalhes: `rate` de cada par e `rates` da execução (`inputPerMillion`, `outputPerMillion` ou `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` ou `verified`).

**Visualizando a requisição**: `sync --dry --show-prompt [key]` exibe a requisição exata que seria enviada ao método do par — as mensagens de sistema e de usuário (ou, para um endpoint `api`, o corpo da requisição), construídas pelo próprio código do método, com as chaves de API ocultadas — e não envia nada. Com uma chave (identificada conforme `--redo keys:` a nomeia: `verb␄Open`, `common::nav.home`; um msgid do gettext com vírgula pode ser informado por inteiro), ele mostra a requisição dessa chave, esteja ela na fila ou não. Quando uma execução real não enviaria nada para ela (por estar atualizada, servida do cache ou retida), ele informa isso e indica o comando `--redo keys:<key> --fresh` que a enviaria. Sem uma chave, mostra o primeiro lote que cada arquivo enviaria, ou informa que nada seria enviado. É assim que se verifica se um `msgctxt` do gettext, um comentário `#.` ou uma descrição ARB chega ao modelo. Motores de tradução automática (DeepL, Google…) recebem apenas o texto de origem; a prévia informa isso. Com `--json`, cada requisição é uma linha `{"level": "event", "event": "request", …}`.

**Dry runs**: `--dry` não traduz nada e não grava nada, mas verifica previamente o que a execução real verificaria: quando uma chave necessária para o método está ausente (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), ele avisa que a execução real seria interrompida e indica o nome da variável. Ele checa se a chave está configurada, não se ela funciona: nada é enviado, portanto um valor fictício passa no teste. Ele ainda sai com `0` — uma prévia nunca falha (consulte [códigos de saída](#sync-exit-codes)). O mesmo vale para `--max-cost`: um dry run não é interrompido no teto, mas quando a estimativa o ultrapassa (ou é desconhecida), ele avisa, uma vez ao final, que a execução real pararia ali e sairia com `2`. Com `--json`, cada linha é um objeto JSON com um `level` (`info`, `ok`, `event` no stdout; `warn`, `error` no stderr), e a última linha do stdout é o resumo, `{"level": "summary", "command": "sync", …}`, contendo `preflight: { ready, failures }`, com um teto `maxCost: { cap, estimatedCost, wouldStop, exitCode }` e `realRun: { exitCode, wouldStop, reasons }` — o código de saída com o qual a execução real terminaria, até onde uma prévia consegue identificar (consulte [códigos de saída](#sync-exit-codes)). Execute-o com as flags que a sincronização real utiliza (`--method`, `--model`): sem elas, ele verifica o método especificado na configuração. O código de saída de um dry run nunca falha uma etapa de CI, então seu aviso `--max-cost` explica como criar um gate: leia `maxCost.wouldStop` (ou `realRun.exitCode`) do resumo `--json` — por exemplo, `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. A [etapa de verificação do guia de CI](/docs/guides/ci-cd#check-before-sync) faz isso e, se falhar, exibe o motivo (`realRun.reasons`) em vez de apenas `false`. O `totalPluralGaps` do dry run conta as mensagens no plural em disco sem uma forma usada pelo idioma que a execução real não solicitaria novamente, e `verify` é `{ "ran": false }` (nada foi gravado, logo nada foi verificado).

**Traduzindo novamente**: `--redo` indica *o que* traduzir novamente e `--fresh` indica *se deve pagar por isso*. Sem `--fresh`, tudo o que o cache já contém é retornado sem custo (e ainda passa pelo quality gate); com ela, tudo o que está na fila é traduzido do zero e cobrado. As flags mais antigas (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) continuam funcionando e significam exatamente o que a tabela indica.

**Restringindo o escopo a arquivos**: `--files` limita a etapa de conteúdo aos arquivos correspondentes, e `--redo files:<glob> --fresh` força novas traduções para os arquivos correspondentes (o único gasto extra deliberado). Os padrões correspondem aos caminhos exibidos pelo sync (relativos a `contentDir`, `2026-10.md`) e ao mesmo caminho a partir da raiz do projeto (`newsletter/2026-10.md`): `*` permanece dentro de uma pasta e `**` cruza pastas. Ambas as flags podem ser repetidas. Um padrão que não corresponda a nenhum arquivo interrompe a execução antes que qualquer valor seja gasto. A etapa de chave-valor já é incremental e é executada normalmente.

**Falhas**: A falha de um arquivo de conteúdo não interrompe os demais. Os arquivos que tiveram êxito são registrados e suas traduções salvas em cache, e a execução termina com uma lista de arquivos que falharam e em que estado cada um ficou. Uma linha de arquivo nunca exibe `[OK]` quando chaves nele não foram traduzidas. O resumo de falhas informa, por chave, o que a próxima sincronização fará: solicita novamente (sem resposta utilizável), solicita mais uma vez (pendente de um redo) ou retém (recusada pelo quality gate). Blocos de Markdown e campos de front-matter recusados pelo gate são retidos da mesma forma, por página; `--redo files:<page>` ou `--redo content` solicita novamente ([Quality Gate](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). O código de saída é `0` (tudo certo), `2` (parcial: parte do trabalho concluída, algo falhou, foi retido ou não foi verificado, uma mensagem no plural foi gravada sem uma forma usada pelo idioma para contagens comuns — ou interrompido por `--max-cost` antes de gastar qualquer valor) ou `1` (nada teve êxito).

**Detecção de alterações**: o champollion armazena hashes SHA-256 em `.champollion.lock`. Quando os valores de origem mudam, a próxima sincronização retraduz automaticamente essas chaves. Faça o commit do arquivo de lock para que todos os desenvolvedores compartilhem a mesma linha de base. O lock também registra, por locale de destino, um fingerprint de cada valor gravado pelo sync (de modo que um valor editado manualmente seja reconhecido e preservado em redos em lote — [Editando traduções](/docs/guides/professional-translators#editing-key-value-files)), as chaves que um redo não conseguiu concluir (**pending**: a próxima sincronização as solicita mais uma vez) e as chaves que o quality gate recusou (**held back**: não são reenviadas para o mesmo modelo em uma sincronização comum — [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Edições manuais e redos**: `--redo all`, `--force` e a troca de modelo preservam valores que uma pessoa editou e indicam quais foram; `--redo keys:<key>` especificando uma chave a substitui; uma chave cujo texto de origem mudou é traduzida novamente. Uma edição substituída é exibida e anexada a `.champollion-replaced-edits.jsonl` (rastreado — faça commit dele junto com o lock).

**Chaves gettext com contexto**: uma chave é `msgctxt` + U+0004 + `msgid`. Os relatórios exibem o separador como `␄`, o qual `--redo keys:` e `--force-keys` aceitam de volta; para digitar um, escreva `\x04`: `--redo 'keys:django::verb\x04Open'` (aspas simples mantêm a barra invertida). Ambas as grafias funcionam. Os comandos de reparo exibem a forma `␄`, seguida por um comentário de shell que indica `\x04`.

**Uma chave especificada que não corresponde a nada**: `--redo keys:` / `--force-keys` com um nome inexistente nas chaves de origem (um erro de digitação ou um msgid que só existe com contexto) falha com código de saída 1. O erro lista as chaves mais próximas, incluindo todas as variantes de contexto desse msgid, em ambas as grafias. Se nenhum dos nomes corresponder, nada é executado. Se alguns corresponderem, esses são refeitos, e então a execução falha indicando os restantes.

**Uma chave especificada servida a partir do cache**: sem `--fresh`, um redo fornece o que o cache contém (reverificado, sem custo) e informa isso, acompanhado do comando `--fresh` que consulta o modelo novamente e do seu custo.

**Paralelismo**: Tanto a tradução de chaves JSON quanto a tradução de conteúdo são executadas em paralelo. Locales JSON são traduzidas simultaneamente (padrão: 200 locales concorrentes), com lotes dentro de cada locale também paralelizados (4 lotes concorrentes). A tradução de conteúdo (Markdown, MDX, posts de blog) é executada em um pool de itens de trabalho plano (padrão: 48 chamadas de API concorrentes). Substitua com `--json-concurrency`, `--content-concurrency` ou `--concurrency` (define ambos).

**Saída**: Sync exibe um banner de versão, detecção de formato/framework, estimativa de custo e barras de progresso por locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

As barras de progresso são atualizadas no próprio local após cada lote (~80 chaves). Use `--quiet` apenas para erros/avisos, ou `--json` para saída NDJSON legível por máquina. Ambos suprimem a barra de progresso e o banner. Com `--json`, um evento `cost` é emitido antes do gate `--max-cost`, um evento `file` chega para cada arquivo de conteúdo e locale, e um `summary` encerra cada execução.

### Códigos de saída {#sync-exit-codes}

| Código | Uma execução real | Um dry run (`--dry`) |
|------|------------|---------------------|
| `0` | Tudo o que estava na fila foi traduzido e verificado, ou nada estava na fila. | Foi executado — mesmo quando informa que a execução real seria interrompida. |
| `2` | Parcial: parte do trabalho foi feita, mas algo falhou, foi retido ou não foi verificado, ou uma mensagem no plural foi gravada sem uma forma usada pelo idioma para contagens comuns. Também: `--max-cost` interrompeu a execução antes que qualquer coisa fosse enviada. | Nunca. |
| `1` | Nada teve êxito ou a execução não pôde ser iniciada: uma chave necessária para o método está ausente, o servidor do modelo necessário não responde, uma chave especificada para redo não corresponde a nada, um padrão `--files` não corresponde a nenhum arquivo ou a configuração é inválida. | O dry run em si não pôde ser executado: uma chave especificada para redo não corresponde a nada, um padrão `--files` não corresponde a nenhum arquivo ou a configuração é inválida. |

Um dry run sai com `0` propositalmente: é a prévia que você executa antes de tomar uma decisão, e uma etapa de CI que apenas inspeciona não deve falhar. O que a execução real faria consta nas últimas linhas do dry run e no seu resumo `--json`: `preflight.ready: false` significa que a execução real pararia antes de traduzir e sairia com `1` (`preflight.failures` informa o motivo); `maxCost.wouldStop: true` significa que ela pararia no teto e sairia com `2` (`maxCost.exitCode: 2`); `maxCost.exitCode: 1`, junto com `maxCost.stopsEarlier`, significa que a validação prévia a interromperia antes da checagem do teto. `realRun.exitCode` reúne tudo isso com o que deixaria a execução real parcial: chaves retidas ou mensagens no plural em disco sem uma forma usada pelo idioma que ele não solicitaria novamente (`2`; `realRun.reasons` as nomeia, e a última linha do dry run informa isso). Uma recusa pelo quality gate ou uma verificação com falha, que apenas a execução real consegue identificar, ainda pode transformar um `0` previsto em um `2`. A [etapa de verificação do guia de CI](/docs/guides/ci-cd#check-before-sync) converte isso em uma etapa de CI com falha que exibe o motivo.

---

## watch

Sincronização automática quando o arquivo de locale de origem muda. Executa até ser interrompido com `Ctrl+C`.

```bash
champollion watch
```

---

## audit

O gate de completude. Lista todas as chaves que não foram traduzidas — ausentes, vazias ou ainda um fallback `[EN]` — e todas as traduções que estão **desatualizadas**: geradas a partir de um texto de origem mais antigo que o atual (conforme `.champollion.lock`; uma edição na origem cuja retradução falhou deixa exatamente isso). Cada lista de desatualizados termina com o comando que a retraduz. Sai com código 1 se alguma for encontrada — use como um gate de CI para falhar builds com traduções incompletas ou defasadas.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Relê todos os arquivos de locale do disco e verifica se as traduções estão realmente presentes e corretas. Esta é a mesma verificação que é executada automaticamente ao final de cada `sync` (a menos que `--no-verify` seja passado).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**O que ele verifica:**
- Paridade de chaves — todas as chaves de origem presentes em cada destino (para chaves plurais do i18next, as chaves das próprias formas de plural do CLDR do locale: o francês precisa de `count_many` também)
- Marcadores de fallback `[EN]` de execuções anteriores
- Traduções vazias
- Conformidade de escrita (script compliance) — um locale não latino não deve conter texto exclusivamente latino; as letras são classificadas pelo script Unicode, portanto caracteres latinos acentuados e de largura total (fullwidth) contam como latinos. Letras latinas de largura total são consideradas erro em qualquer locale fora da tipografia CJK
- Placeholders, com cada ocorrência nomeada pela sintaxe envolvida — estrutura do ICU MessageFormat (`ICU structure error`: um argumento `{name}`, uma palavra-chave ou seletor de plural/select traduzido, um `#` perdido), conversões do printf (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — um `%(name)s` perdido de um catálogo gettext é identificado como printf, não ICU), interpolação do i18next (`i18next {{…}} placeholder mismatch`: `{{name}}`, incluindo `{{name}}` escrito como `{name}`, que o i18next exibe literalmente) e chaves simples `{name}` fora de uma mensagem ICU (`{…} placeholder mismatch`)
- Marcação (markup) — por nome de tag, as mesmas tags de abertura, fechamento e fechamento automático da origem, aninhadas da mesma forma (um `</strong>` perdido é um erro)
- Problemas de codificação — marcadores BOM, caracteres invisíveis
- Ecos da origem (source echoes) — valores idênticos à origem (aviso)
- Formas plurais — uma mensagem de plural sem uma forma usada pelo idioma para contagens comuns (russo `few`/`many`), uma entrada gettext cujas formas apenas repetem `other` (o sync marca essas com um comentário `# champollion:`), uma chave i18next ou `msgstr[n]` para uma forma que o idioma não possui (avisos)
- Locales idênticos — dois locales de destino com o mesmo texto para a maioria das chaves: um deles provavelmente está no idioma do outro (aviso)
- Mesmo texto, origens diferentes — um mesmo texto registrado para várias strings de origem distintas (um modelo repetindo uma frase memorizada): duas strings com múltiplas palavras claramente diferentes respondidas com o mesmo texto de quatro ou mais palavras, ou três ou mais caso contrário; uma frase que uma sincronização anterior detectou o modelo repetindo conta mesmo se ocorrer uma única vez. Isso é contabilizado sobre os valores das chaves, cada ramificação de plural/select do ICU (as ramificações de um mesmo plural contam como uma única origem) e as páginas Markdown do locale (campos de front-matter e blocos; desconsiderando `# ` e pontuação final), pela mesma regra com que o gate de `sync` o recusa (erro)
- Desatualizado — uma tradução gerada a partir de um texto de origem mais antigo que o atual (aviso aqui; `audit` falha com isso)
- Ponto de interrogação ou exclamação ausente — a origem termina com `?` ou `!` e a tradução não termina com isso nem com o equivalente do sistema de escrita de destino (`？`, `؟`, grego `;`, …). Um aviso: alguns idiomas marcam uma pergunta com uma palavra ou partícula

Ele verifica a estrutura, não o significado: uma aprovação indica que as chaves, placeholders, plurais,
marcação e sistema de escrita estão intactos, não que o texto esteja semanticamente correto — peça a
um falante do idioma para revisar antes de confiar nele.

**Quais locales.** `verify` verifica todos os locales; `verify --pair en:fr` verifica
apenas o francês. Após `sync --pair en:fr`, a verificação pós-sincronização cobre os pares
que foram executados, nenhum outro. Uma verificação com escopo delimitado informa isso na sua linha final — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` essa linha traz
`checked` (os locales verificados) e `scope`.

**Cobertura de plurais.** O bloco de cada locale tem uma linha por tipo de plural presente em seus
arquivos — chaves com sufixo do i18next, mensagens de plural ICU, entradas
`msgid_plural` do gettext — informando as formas que o locale deve conter
(as categorias de plural do CLDR para ele; em um catálogo gettext, aquelas para as quais seu
`Plural-Forms` reserva um espaço) e se todos os plurais as possuem:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` nomeia os plurais que não têm uma forma. Uma forma usada apenas por números acima de 1000 ou
frações (o `many` em francês em uma mensagem ICU) é informada separadamente: a forma `other`
a substitui, o que não é considerado uma inconsistência. A linha é um resumo — uma
forma ausente também é apontada como inconsistência acima dela (uma chave ausente, um aviso de plural).

**`--json`** escreve um objeto JSON por linha. Cada locale recebe um registro no
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — com
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), seu `errors`,
`warnings` e `infos`, `placeholders` (cada apontamento com seu `syntax`: `icu`,
`printf`, `i18next`, `brace` ou `markup`) e `plurals` (por modalidade e tipo:
`categories`, `total`, `complete`, `incomplete`). Os apontamentos também são
linhas de `error`/`warn` no stderr, e a linha final mantém seu nível e
mensagem (`ok` no stdout quando a verificação passa, `error` no stderr quando
não passa) e traz as contagens de `errors` e `warnings`. Após um sync, os mesmos
registros aparecem antes do resumo do próprio sync. (Os registros de um projeto Docusaurus
não contêm `keys` ou `plurals`: suas strings de interface são verificadas arquivo por arquivo.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Código de saída:** `1` quando encontrar um erro — ou quando não puder verificar nada
(o arquivo de origem ou a pasta de locales não está onde a configuração indica;
a linha de erro informa o caminho e a configuração), `0` caso contrário. Avisos não o
fazem falhar, a menos que você passe `--strict`, que sai com `1` em qualquer aviso (um CI que
não pode entregar, por exemplo, plurais em russo sem suas formas `few`/`many`) e termina
com uma linha `[FAIL]`, nunca `[OK]`; `--warn-only` faz com que erros saiam com `0`
também. Um locale cuja contagem de chaves esteja divergente informa isso em vez de `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Verifica o código-fonte em busca de strings hardcoded voltadas ao usuário que devem usar chamadas de tradução i18n. Detecta automaticamente seu framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**O que detecta:**
- Strings hardcoded em texto JSX, `placeholder`, `alt`, `aria-label`, `title`
- Arquivos com conteúdo voltado ao usuário mas sem importação de framework i18n
- Chaves mortas — chaves de locale que nenhum arquivo de origem referencia
- Pontuação de cobertura — percentual de strings passando por i18n

**Exclusões**: Crie `.champollionignore` na raiz do seu projeto (padrões glob, como `.gitignore`).

**Nada para analisar é uma falha**: quando nenhum arquivo de origem coincide (as pastas padrão do framework — `src/`, `app/`, `pages/`, `components/` para projetos web — ou seu `--src`), o lint sai com `1` e indica as pastas e extensões pelas quais buscou. Um lint que não verificou nada não deve passar em um gate de CI; aponte-o para o seu código com `--src <dir>` ou `"lint": { "srcDir": "<dir>" }`.

---

## wrap

Envolve automaticamente strings hardcoded detectadas por `lint` em chamadas `t()`. Cria backups automáticos antes de modificar arquivos.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Gates de segurança:**
1. Verificação de limpeza do Git (pulada em dry-run)
2. Backup automático para `.champollion-backup/`
3. Visualização de diff antes de cada escrita de arquivo
4. Suporte `--undo` para restaurar do backup

---

## seo

Gera artefatos de SEO para sites multilíngues.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcomando | Saída |
|------------|--------|
| `hreflang` | Tags `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` multilíngue |
| `jsonld` | Schema JSON-LD WebSite de idioma |

---

## integrity

Detecta corrupção e desvio em arquivos de locale traduzidos.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**O que ele verifica:**
- Corrupção de placeholders (por exemplo, `{name}` presente na origem, mas ausente no destino)
- Problemas de codificação (mojibake, Unicode inválido)
- Cópias não traduzidas (valor de destino idêntico à origem) — chaves [`noTranslate`](/docs/getting-started/configuration#no-translate) são isentas, assim como repetições que a Translation Memory confirma como produzidas pelo pipeline e aprovadas pelo gate. O que continua sinalizado é exatamente o que `sync` colocaria de volta na fila — as duas ferramentas não entram em desacordo quanto a um arquivo íntegro
- Desvio de no-translate (uma chave `noTranslate` que *não* é idêntica à origem) — reportado com valores esperado/atual e caracteres invisíveis escapados; execute `champollion sync` para reparar
- PUA inesperado (pontos de código de Área de Uso Privado em um locale cuja [conversão de escrita](/docs/getting-started/configuration#script-conversion) está desativada — renderiza em branco sem uma fonte especial); execute `champollion repair-script` para reparar
- Valores esvaziados (um destino que é o seu texto de origem com as letras apagadas — dano causado por um pipeline anterior ao gate de preservação de conteúdo); retraduza com `sync --force-keys <key>` ou `sync --pair <pair> --force`
- Chaves órfãs (chaves no destino que não existem na origem)
- Completude das categorias de plural do ICU MessageFormat (por exemplo, o árabe precisa de 6 categorias) — pela mesma regra usada por `sync` e `verify`: uma forma ausente que contagens comuns utilizam (russo `few`/`many`) é um aviso; uma forma que apenas números acima de 1000 ou frações utilizam (francês `many`, usado para 1 000 000) é uma observação, visto que a forma `other` é usada nesse caso

---

## repair-script

Reverte a conversão de escrita que não deveria ter ocorrido: valores codificados em PUA (pIqaD, Tengwar, Kryptoniano) em locales cuja configuração indica que a conversão está desativada são restaurados para a romanização por meio da tabela reversa do próprio conversor.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Opção | Efeito |
|--------|--------|
| `--dry` | Visualizar os reparos sem gravar |
| `--locale <code>` | Reparar apenas um locale |
| `--json` | Saída JSON legível por máquina |
| `--warn-only` | Sair com 0 mesmo se restar PUA irreversível |

O pIqaD reverte com precisão exata. As reversões de Tengwar e Kryptoniano não conseguem recuperar letras maiúsculas (sinalizadas como case-lossy). A Translation Memory não requer reparo — ela armazena valores anteriores à conversão. Sai com 1 quando ainda resta PUA que nenhum conversor registrado pode reverter.

---

## tm

Gerencia o cache de Memória de Tradução (`.champollion/tm.json`). TM armazena traduções anteriores e as fornece em sincronizações subsequentes em vez de chamar a API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcomando | Saída |
|------------|--------|
| `stats` | Contagem de entradas, tamanho do arquivo, detalhamento por locale |
| `clear` | Deletar arquivo de cache (completo ou por locale) |

| Opção | Efeito |
|--------|--------|
| `--locale <code>` | Limpar apenas entradas de uma locale |
| `--yes` | Pular prompt de confirmação |

Veja [Memória de Tradução](/docs/concepts/translation-memory) para entender como TM funciona e quando limpá-la.

---

## xliff

Exporta e importa arquivos XLIFF 1.2 para revisão por tradutores profissionais. XLIFF é o formato de troca universal suportado por ferramentas CAT como memoQ, SDL Trados e Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcomando | Saída |
|------------|--------|
| `export` | Gera `.xliff` a partir de arquivos de locale de origem + destino |
| `import` | Mescla traduções `.xliff` revisadas em arquivos de locale |

| Opção | Efeito |
|--------|--------|
| `--locale <code>` | Locale de destino para exportação (obrigatório) |
| `--out <path>` | Caminho ou diretório de saída personalizado |
| `--dry` | Visualizar importação sem escrever |

Veja [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) para o fluxo de trabalho completo.

---

## status

Mostra a configuração de pares, plugins instalados e pontuações de benchmark.

Um par cuja configuração define `qualityTier` (`standard`, `high`, `research` ou
`verified`) a exibe pelo que ela realmente é: um rótulo escolhido por você, não uma
medição — o sync traduz da mesma forma independentemente do que ela diga, e `serve`
a divulga. Um par que não define nenhuma não exibe nada (`--json` ainda tem
`qualityTier`, com `qualityTierSet: false`).

```bash
champollion status
```

Após a troca de modelo, ele também informa se os arquivos de um locale misturam texto de mais
de um modelo (a partir da Translation Memory: qual modelo produziu cada valor
em disco), junto com o comando para fazer o modelo atual traduzir o que um
modelo anterior gerou — `sync --pair <pair> --redo all --fresh-on-model-change`.
Para um método que executa um modelo escolhido por você (`local`, `api`, `external`), ele
repete a nota sobre licença que o primeiro sync exibiu uma vez. Para um método
compatível com OpenAI (`local`, `openai`), ele mostra o endereço para onde as requisições são enviadas e a configuração
que o definiu: `LOCAL_API_BASE` no ambiente ou em `.env`, ou o padrão
(Ollama, `http://localhost:11434/v1`). Com `contentDir`, ele lista a pasta
de conteúdo ao lado dos arquivos de chave-valor, indicando quantas páginas de origem ela contém e,
por idioma, quantas traduções estão em dia, desatualizadas ou pendentes.
Pendente significa que ainda não há tradução, ou que partes recusadas pelo quality gate foram mantidas no idioma de origem (o lock de conteúdo marca `pending:<hash>`).
Abaixo de cada registro, ele exibe as orientações de gênero que os prompts de LLM contêm e de onde
elas vêm (o padrão do Champollion para o idioma, sua configuração ou desativado —
consulte [Orientações de gênero](/docs/getting-started/configuration#gender-guidance)).
Para um par com fallback, ele conta quantos valores nos arquivos foram gravados pelo fallback
e nomeia os primeiros.
`--json` traz o mesmo que `requestsGoTo` (em um par ou fallback com esse tipo de endpoint), `content`, `genderGuidance` e `fallback.valuesInFiles`.

---

## provenance

Audita licenciamento de recursos de tradução para todos os plugins instalados.

```bash
champollion provenance
```

---

## plugin

Gerencia plugins de método de tradução. Plugins são receitas de tradução pré-empacotadas instaladas em `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

Veja [Especificação de Plugin](/docs/reference/plugin-spec) para o formato de manifesto do plugin.

---

## leaderboard

`champollion network leaderboard` (também funciona como `champollion leaderboard`). Navegue, busque e instale métodos de tradução a partir do leaderboard da Network. Métodos instalados a partir do leaderboard vêm com pontuações de benchmark e o MethodConfig canônico completo — a configuração exata utilizada durante a avaliação.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Opção | Efeito |
|--------|--------|
| `--pair <pair>` | Filtrar por par de idiomas, conforme o leaderboard o registra: `"eng>fra"` (ISO 639-3; use aspas no `>`). `eng-fra` e `eng:fra` também funcionam, e um código de 2 letras é resolvido (`en` → `eng`) |
| `--install <rank>` | Instalar o método nessa posição (conforme listado) como um plugin |
| `--apply` | Após a instalação, adicionar automaticamente `methodPlugin` a `champollion.config.json` |

**Fluxo de trabalho `--apply`:** Quando você instala com `--apply`, champollion escreve o plugin de método em `.champollion/methods/` **e** corrige seu `champollion.config.json` para usá-lo para o par relevante. Este é o caminho mais rápido de "o que tem melhor pontuação?" para "estou usando em produção."

---

## fonts

Baixa e gerencia fontes web PUA para conversores de script de linguagem construída. Idiomas que usam caracteres de Área de Uso Privado (Klingon, Sindarin, Kryptoniano) precisam de fontes web personalizadas para renderizar seus scripts. Este comando as baixa de repositórios de código aberto verificados.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcomando | Saída |
|------------|--------|
| `list` | Mostra quais fontes PUA são necessárias e seu status de instalação |
| `install` | Baixa fontes para idiomas configurados |

| Opção | Efeito |
|--------|--------|
| `--dir <path>` | Substituir diretório de saída de fonte (auto-detectado do tipo de projeto) |
| `--css` | Gerar um snippet `conlang-fonts.css` junto com as fontes |
| `--config <path>` | Caminho para arquivo de config (usado para detectar quais idiomas precisam de fontes) |

**Auto-detecção:** O diretório de saída é inferido da sua estrutura de projeto:
- **Docusaurus** → `static/fonts/` ou `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Padrão** → `public/fonts/`

**Conversores Unicode nativos** (`crk` → Silábicos Cree, `sr` → Cirílico Sérvio) **não** requerem instalação de fonte.

Veja [Conlangs, Scripts & Ortografia](/docs/guides/conlangs-scripts-orthography) para detalhes completos de fontes PUA.

## Pipeline de Três Camadas

Use `lint`, `sync` e `audit` juntos para i18n à prova de falhas:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Camada | Comando | Quando | Propósito |
|-------|---------|------|---------|
| **Lint** | `lint` | Pré-commit | Bloquear commits com strings hardcoded |
| **Sync** | `sync` | Pós-commit / CI | Traduzir chaves ausentes e alteradas |
| **Verify** | `verify` | Pós-sync / CI | Confirmar que traduções estão presentes e corretas |
| **Audit** | `audit` | Etapa de build | Falhar deployment se alguma locale tiver marcadores `[EN]` |

---

## Veja Também

- [Configuração](/docs/getting-started/configuration) — referência de arquivo de config
- [Métodos de Tradução](/docs/guides/translation-methods) — seleção de método por par
- [Memória de Tradução](/docs/concepts/translation-memory) — cache e economia de custos
- [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) — fluxo de trabalho XLIFF
- [Especificação de Plugin](/docs/reference/plugin-spec) — formato de manifesto do plugin
- [Guia de CI/CD](/docs/guides/ci-cd) — automatizando comandos CLI em seu pipeline
- [Como Sync Funciona](/docs/concepts/how-sync-works) — entendendo o pipeline de sync
- [Quality Gate](/docs/concepts/quality-gate) — como traduções são validadas
