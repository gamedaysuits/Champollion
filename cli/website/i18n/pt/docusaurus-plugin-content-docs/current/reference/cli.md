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

Os comandos que constroem a tradução automática para um idioma — os trilhos — funcionam
em uma pasta de projeto criada por `champollion new`:

```
champollion new <folder>      Start a project: --from <language> --to <language> (--dry says the direction back first)
champollion next              THE next step, from the project's files (--json for agents)
champollion data add <file>   Bring in a spreadsheet, .csv/.tsv, Word table, dictionary or ELAN file
champollion data mark <file>  Record what a data file's holders decided
champollion data combine      Join the pair files into the one training reads
champollion improve <step>    Make a model in use better, round by round (time, wishlist, sheet, marks, prepare, report, status)
champollion validate          Check a project's files against the schemas every tool shares
champollion upgrade           Rewrite older framework files in the current formats (--dry first)
champollion connect <model>   Put a served model into an app or website project (--app <folder>)
```

Os comandos que traduzem os arquivos de um aplicativo ou site:

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion serve             Serve this project's translation stack over HTTP (the api method's contract)
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
champollion models check      Check every default model against the providers' live lists (free)
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
--temperature <n>       LLM temperature (0.0–2.0, default: 0 — deterministic; the one default for translating and evaluating)
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

## new

Inicia um projeto de tradução automática nos trilhos: uma pasta com um lugar para tudo.

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry   # say the direction back; writes nothing
champollion new family --from English --to qaa --target-name "Our language"
champollion new school-crk --from eng --to "Plains Cree" --purpose "school newsletter"
```

Ele grava:

- `champollion.project.json` — as decisões do projeto ([project/1](/docs/reference/formats#project1)): seu par, sua finalidade e os padrões atribuídos a novos dados (`local-only`; pontuações de treinamento e compartilhamento: `ask`).
- As pastas `data/parallel/`, `data/test/`, `data/lexicon/`, `data/grammar/`, `data/monolingual/`, `consent/` e `inbox/`.
- `README.md` (o que vai onde), `.gitignore` (mantém `data/` fora de qualquer repositório enviado), `NEXT.md` (o próximo passo) e `AGENTS.md` — as regras que um agente de IA trabalhando na pasta segue, o [contrato operacional](/docs/agents/contract). Um `.gitignore` ou `AGENTS.md` existente nunca é sobrescrito.

Idiomas são códigos ou nomes, resolvidos por meio dos cartões de idioma. Um nome que um cartão registra para seu idioma sob outro nome é informado de volta com sua fonte (`"Blackfoot" is another name for this language … Siksika (bla)`); um nome que vários idiomas compartilham é recusado junto com as opções, nunca escolhido automaticamente. Um código de uso privado (`qaa`–`qtz`) para uma variedade sem código precisa do nome que o seu povo usa (`--target-name`, `--source-name`). Apenas projetos `language` estão nos trilhos até o momento. Uma pasta que já é um projeto ou que já contém arquivos é recusada.

| Opção | Efeito |
|--------|--------|
| `--from <language>` | Idioma de origem (código ou nome) |
| `--to <language>` | Idioma de destino (código ou nome) |
| `--name <text>` | Nome do projeto (padrão: `<source> → <target>`) |
| `--purpose <text>` | Para que servem as traduções, em suas palavras |
| `--target-name <text>` | O nome do idioma de destino como o seu povo o chama (obrigatório para `qaa`–`qtz`) |
| `--source-name <text>` | O nome do idioma de origem (para uma origem de uso privado) |
| `--dry` | Informar em qual direção traduziria (`… goes in, … comes out`) e não gravar nada |
| `--json` | O arquivo do projeto, os idiomas conforme resolvidos e o primeiro passo, como JSON |

---

## next

A única pergunta dos trilhos: o que fazemos agora?

```bash
champollion next                  # in the project folder
champollion next family --json    # for an agent
champollion next --write          # also rewrite NEXT.md
```

Ele lê os arquivos do projeto (nunca o texto de um arquivo de dados), percorre a sua trajetória e exibe o único próximo passo: o que dizer à pessoa, o motivo, o comando exato quando houver um e como o passo deve ser dado:

| Modo | Como |
|------|-----|
| `auto` | Um agente pode executar o comando |
| `confirm` | Executar apenas depois que a pessoa disser sim (instalações, gastos, treinamento) |
| `ask_user` | As pessoas que detêm os dados respondem; nunca responda por elas |
| `wait` | Algo está em execução; pergunte novamente mais tarde |
| `human_only` | Apenas uma pessoa pode fazer isso (reunir frases, escolher um modelo) |

Para as etapas de treinamento, ele repassa o próprio orientador do nmt-forge (`nmt-forge status`, limitado a 60 segundos). É somente leitura: não grava nada a menos que `--write` seja usado (então ele reescreve `NEXT.md`).

| Opção | Efeito |
|--------|--------|
| `--json` | O passo como JSON (para agentes) |
| `--write` | Também reescrever `NEXT.md` |

---

## data

Traz os arquivos mantidos por uma comunidade para o projeto, registra o que seus detentores decidiram e une os arquivos de pares no arquivo único lido pelo treinamento. Execute-o dentro de um projeto.

### data add

```bash
champollion data add inbox/grandpa.xlsx
champollion data add inbox/list.txt --source-col A --target-col B
champollion data add inbox/checked.docx --into test
```

Converte um arquivo mantido pela comunidade no formato que todas as ferramentas leem: uma planilha (`.xlsx`, `.ods`, `.csv`), um `.tsv` ou `.txt`, uma tabela em um `.docx` do Word ou um dicionário Toolbox/MDF ou LIFT (FieldWorks/FLEx) — suas glosas se tornam uma lista de palavras com `--into lexicon`, e suas frases de exemplo se tornam pares. Um arquivo ELAN (`.eaf`) fornece pares a partir de duas camadas vinculadas pelo ELAN, associadas pelos idiomas indicados ou pelos IDs de camada `--source-col`/`--target-col`. Textos sagrados em USFM entram somente mediante solicitação: `--usfm-source` indica o texto no outro idioma, e versículos com o mesmo número em ambos se tornam pares; como a tradução de textos sagrados costuma estar sob direitos autorais de uma editora, nenhum modelo aprende com ela até que seus detentores autorizem.

As colunas vêm de uma linha de cabeçalho que identifica os idiomas, ou de `--source-col` e `--target-col`. Ele nunca faz suposições com base nas frases e nunca exibe nenhuma: as colunas são descritas por preenchimento e sistema de escrita. Ele grava `data/parallel/<name>.tsv` (ou `data/test/`, ou uma lista de palavras em `data/lexicon/`) com um arquivo auxiliar (sidecar) registrando sua origem; o padrão apenas-local do projeto se aplica até que os detentores dos dados decidam. O arquivo original nunca é alterado.

| Opção | Efeito |
|--------|--------|
| `--into <parallel\|test\|lexicon>` | Para onde vão os pares (padrão `parallel`; `lexicon` = uma lista de palavras) |
| `--source-col <col>` | A coluna de origem: uma letra, um número ou seu cabeçalho (um ID de camada do ELAN para `.eaf`; um código de idioma para LIFT) |
| `--target-col <col>` | A coluna de destino |
| `--sheet <name\|n>` | Qual planilha ou tabela, quando houver várias |
| `--header` / `--no-header` | Se a primeira linha é um cabeçalho |
| `--usfm-source <file\|folder>` | Textos sagrados em USFM: o texto no outro idioma, emparelhado versículo por versículo |
| `--name <stem>` | O nome do arquivo gravado |

### data mark

```bash
champollion data mark data/parallel/pairs.tsv --owner "the family" --training allowed --local-only
champollion data mark data/test/checked.tsv --role test --local-only
```

Registra o que as pessoas que detêm um arquivo de dados decidiram, no sidecar ao lado dele (`<file>.champollion.json`, [set/1](/docs/reference/formats#set1)) que o mt-eval, o nmt-forge e o servidor MCP respeitam. Um arquivo que ainda não seja apenas-local precisa de `--local-only` ou `--may-leave`: saber se o seu texto pode ser enviado para um serviço externo de IA é uma decisão de seus detentores, portanto nunca é presumida.

Um sidecar só pode se tornar mais restrito: apenas-local não pode se tornar pode-sair, o treinamento `not-allowed` não pode se tornar `allowed`, e um conjunto de teste ou selado mantém sua função e nunca é usado para treinamento. As exceções são a primeira resposta dos detentores à cautela da própria ferramenta: a marcação apenas-local que `data add` aplicou a partir do padrão do projeto (o primeiro `--may-leave` a remove), o `not-allowed` aplicado a textos sagrados e `--speakers-agreed yes --training allowed` assim que as pessoas que tinham `not-yet` concordarem. Qualquer outra flexibilização deve ser feita manualmente pelos próprios detentores dos dados.

| Opção | Efeito |
|--------|--------|
| `--local-only` | Apenas um modelo neste computador pode ver o texto |
| `--may-leave` | Os detentores permitem que o texto seja enviado a serviços externos |
| `--training <allowed\|not-allowed>` | Se um modelo pode aprender com ele |
| `--role <role>` | `train`, `dev`, `test`, `sealed`, `input` ou `resource` |
| `--kind <kind>` | `parallel`, `monolingual`, `lexicon`, `grammar` ou `glossary` |
| `--owner <text>` | Quem detém os dados, em suas próprias palavras |
| `--speakers <text>` | De quem são as palavras contidas no arquivo — quem as disse ou escreveu |
| `--speakers-agreed <yes\|not-yet\|some-said-no>` | Se eles concordaram; `not-yet` e `some-said-no` mantêm fora do treinamento |
| `--consent-record <path>` | A nota registrando quem concordou com o quê |
| `--json` | Exibir o sidecar gravado como JSON |

### data combine

```bash
champollion data combine
champollion data combine --name all-pairs
```

Une todos os arquivos de pares em `data/parallel/` no arquivo único que o treinamento lê, descartando repetições exatas. Seu sidecar mantém os termos mais restritos entre os arquivos (apenas-local se algum for; todos os detentores nomeados). Os originais são movidos para `data/combined-from/`; nada é excluído. Um arquivo cujos detentores disseram que nenhum modelo pode aprender com ele não é unido: ele é movido para `data/not-for-training/`, mantido e nunca usado para aprendizado. `--name <stem>` dá nome ao arquivo resultante da união.

---

## improve

Aprimora um modelo em uso, rodada a rodada, com cada rodada avaliada no conjunto de prática (dev). Execute-o dentro de um projeto; `champollion next` informa qual passo vem a seguir.

```bash
champollion improve time --per-week "two evenings" --total "until the spring"
champollion improve wishlist --prompts 30
champollion improve sheet
champollion improve marks
champollion improve prepare
champollion improve report
champollion improve status --json
```

Uma rodada: as pessoas escrevem frases que desejam traduzir, uma por linha, em `improve/round-<k>/to-translate.txt`; o modelo em uso gera rascunhos delas em uma planilha; a pessoa falante marca cada rascunho com Y (certo), N (errado — e escreve como se diz) ou ? (em dúvida); os rascunhos confirmados e as correções se tornam novos pares de treinamento; o arquivo de treinamento é filtrado e o modelo treina novamente. O forge compara então o novo modelo com aquele em uso nas mesmas frases de dev, e só o coloca em uso se for comprovadamente melhor. Uma rodada é numerada pelos vereditos do forge até o momento, e seus arquivos ficam em `improve/round-<k>/`. Na tela: contagens e palavras simples, nunca uma frase — as planilhas contêm as frases, na pasta do projeto.

| Subcomando | O que faz |
|------------|-----------|
| `time` | Registra quanto tempo a pessoa falante pode dedicar, por semana e no total, exatamente como ela disse (`improve/time.json`); cada rodada é planejada com base nisso |
| `wishlist` | Uma folha imprimível com o que escrever em seguida (`improve/round-<k>/wishlist.md`): palavras que o modelo nunca viu, os tipos de frases que ele erra em dev, sugestões abertas (`nmt-forge wishlist`) |
| `sheet` | O modelo hospedado neste computador rascunha as frases da rodada em `review.csv` para a pessoa falante marcar; enquanto o conjunto de prática (dev) for pequeno, uma em cada quatro linhas fica sem rascunho — a pessoa falante a escreve, ampliando o conjunto de prática |
| `marks` | Lê as marcações da pessoa falante: quantos rascunhos estavam certos (com um intervalo de 95%), os rascunhos confirmados e as correções como novos pares de treinamento (adicionados como `data add` adiciona um arquivo), as linhas de prática como `data/dev/` |
| `prepare` | O arquivo de treinamento desta rodada (`data/split/train-r<k>.jsonl`), verificado contra o conjunto de teste com as frases de dev reservadas; o conjunto de prática ampliado (`nmt-forge grow-dev`); `config.json` apontado para ele |
| `report` | O relatório da rodada (`improve/round-<k>/report.json`): progresso, cada número com sua unidade; verificações de que os ganhos são reais; uma projeção; o que fazer a seguir |
| `status` | As rodadas até o momento: as marcações da pessoa falante e o veredito do forge para cada uma |

| Opção | Efeito |
|--------|--------|
| `--per-week <text>` | `time`: quanto tempo a pessoa falante pode dedicar por semana, em suas palavras (obrigatório) |
| `--total <text>` | `time`: quanto tempo a pessoa falante pode dedicar no total, em suas palavras (obrigatório) |
| `--prompts <n>` | `wishlist`: quantas sugestões a folha contém (padrão 40, cerca de uma sessão) |
| `--json` | `report`, `status`: exibir como JSON |

---

## validate

```bash
champollion validate                  # the current folder
champollion validate family --json    # one project, machine-readable
```

Verifica os arquivos de um projeto em relação aos esquemas do framework ([Formatos](/docs/reference/formats)) que mt-eval e nmt-forge também leem: `champollion.project.json`, todo sidecar de dados (`<file>.champollion.json`) na pasta, todo `method.json` (em sua raiz, em `methods/*/` e `.champollion/methods/*/`), suas cadeias de portões (`gates/*.json`) e suas implantações (`deploy/*.json`). Ele abre apenas esses pequenos arquivos JSON, nunca um arquivo de dados. Um sidecar gravado antes do set/1 ainda é válido; uma chave que o set/1 recusaria é relatada como um aviso.

Códigos de saída: 0 válido (avisos permitidos), 1 documento inválido, 2 erro de uso. `--json` exibe o relatório completo.

---

## upgrade

```bash
champollion upgrade --dry         # say what would change; write nothing
champollion upgrade family
```

Reescreve os arquivos de framework mais antigos de um projeto no formato que todas as ferramentas agora compartilham, sem perder nada. Um sidecar de dados gravado antes do set/1 torna-se set/1: todos os valores são mantidos, e uma chave desconhecida pelo set/1 é movida para `x-<key>`. Um sidecar inválido é deixado para uma pessoa corrigir (`champollion validate` informa o que está errado). Um `method.json` gravado antes do method/1 é listado e mantido como está — sua estrutura antiga ainda contém configurações que as ferramentas leem. Nada é excluído. `--json` exibe o relatório.

---

## connect

```bash
champollion connect ../family/export/model --app .
champollion connect ../family/export --app ../school-site --holders-agreed-by "Grandpa"
```

Insere um modelo disponibilizado em um projeto de aplicativo ou site, para que `sync` traduza com ele. O modelo é uma exportação do forge (sua pasta ou sua pasta `model/`) ou qualquer `method.json`. Ele é instalado no `.champollion/methods/` do aplicativo, e os pares do aplicativo apontam para ele (`"methodPlugin"`); qualquer fallback ou registro que o par já possua é mantido.

Um modelo que aprendeu com frases marcadas como apenas-local (ou cujo treinamento não foi registrado), ou um serviço cujo `/health` indica que sua saída é apenas-local, pode repeti-las — e os arquivos de localização de um aplicativo são publicados junto com ele. Ele só é conectado com `--holders-agreed-by`: quem dentre os detentores dos dados concordou, registrado no par (`"holdersAgreed"`, indicando o método). Pergunte a eles; nunca responda por eles. `sync` submete uma resposta apenas-local à mesma regra: sem o acordo, nada proveniente dele é gravado.

| Opção | Efeito |
|--------|--------|
| `--app <folder>` | O projeto do aplicativo ou site (padrão: esta pasta) |
| `--holders-agreed-by <who>` | Para um modelo apenas-local: quem dentre os detentores dos dados concordou |
| `--json` | Exibir o que foi conectado como JSON |

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

## card

`champollion network card <code>` (também funciona como `champollion card`). Exibe o que o índice sabe sobre um idioma: identificação, classificação, estimativas de falantes, grau de ameaça, tipologia, disponibilidade de corpus, recursos linguísticos, conjuntos de dados de avaliação, prontidão do pipeline, suporte a métodos e fontes de dados. Onde as fontes divergem (nomes, famílias, contagem de falantes, grau de ameaça, …), cada valor é exibido com sua respectiva fonte e nenhum é escolhido como padrão. Uma seção para a qual o cartão não possui dados informa "not recorded on this card": ausência significa desconhecido, não "nenhum". Nomes alternativos (aliases) são resolvidos (`fr` → `fra`).

```bash
champollion network card crk           # Plains Cree
champollion network card cmn --json    # the raw card JSON
```

| Opção | Efeito |
|--------|--------|
| `--json` | O JSON bruto do cartão em vez da exibição formatada |

---

## recommend

`champollion network recommend <src> <tgt>` (também funciona como `champollion recommend`). Orientações sobre métodos para um par origem→destino: cada mecanismo utilizável com sua disponibilidade em tempo real (há uma chave de API presente? uma via de licença?), os modelos abertos cujos próprios cartões declaram o idioma de destino e que `local-model` pode carregar (executáveis, sem evidências publicadas — uma reivindicação a ser avaliada em benchmark, não uma medição), as evidências publicadas indexadas para o par (citadas, nunca reproduzidas; apenas comparação relativa) e quais modelos com evidências são executáveis aqui. Se não houver evidências, isso será informado. A via comercial é rigorosa: um método sem uma licença pronta para uso comercial é excluído com o motivo.

```bash
champollion network recommend eng yor
champollion network recommend eng-yor --use commercial
```

| Opção | Efeito |
|--------|--------|
| `--pair <pair>` | O par como um valor único em vez de dois códigos: `"eng>yor"` (use aspas no `>`), `eng-yor` ou `eng:yor` |
| `--use <lane>` | Via de licença: `non-commercial` (padrão) ou `commercial` (estrita) |
| `--json` | Payload legível por máquina |

---

## register-corpus

`champollion network register-corpus` (também funciona como `champollion register-corpus`). Registra um corpus de avaliação com sua licença e nível de exposição — `local-only` (o padrão: nada registrado ou enviado), `private` (apenas metadados), `public` (um cartão de metadados e um indicador para obter da fonte) ou `sealed` (criptografado no seu dispositivo; apenas um cartão sem conteúdo sai dele). O Champollion nunca envia ou hospeda texto de corpus, em nenhum nível: um arquivo informado com `--data` é lido apenas nesta máquina, para contagem e verificação de checksum, e recebe um sidecar para que `mt-eval run` aplique sua licença. Para um conjunto de teste, exibe as etapas do nmt-forge que devem ocorrer antes da sua primeira pontuação. Interativo em terminal; automatizável por script com opções e `--yes`.

```bash
champollion network register-corpus --list
champollion network register-corpus --yes --name "Holdout" --pair "eng>crk" --license cc-by-nc-4.0 --tier private --role test --size 500 --domain educational
```

Todas as opções, com a regra de ID do cartão: `champollion network register-corpus --help`.

---

## seal-corpus

`champollion network seal-corpus <keygen|seal|open|sign-keygen|sign|verify>` (também funciona como `champollion seal-corpus`). A criptografia em torno do nível de exposição selado (X25519-ECDH → HKDF-SHA256 → AES-256-GCM): `keygen` cria um par de chaves provisório individual (não é uma chave de grupo M-de-N — quem possuir o arquivo de chave privada pode descriptografar sozinho), `seal` criptografa um corpus nesta máquina, `open` descriptografa um artefato selado em um contexto de avaliação controlado e `sign-keygen` / `sign` / `verify` assinam pacotes de pontuação para o transporte isolado (air-gapped) (chave de assinatura de nó individual). O nó organizador do `mt-eval` executa comandos aqui via shell em vez de reimplementar a cifra.

```bash
champollion network seal-corpus keygen --out ~/.contest-keys
```

Todas as opções: `champollion network seal-corpus --help`.

---

## submit

`champollion network submit` (também funciona como `champollion submit`). Propõe uma entrada para o índice por meio de um processo sujeito a revisão: ele reúne os campos para um dos seis tipos de envio (`dataset`, `resource`, `method`, `human-service`, `external-result`, `card-correction`) e exibe uma URL de issue do GitHub pré-preenchida, que uma pessoa mantenedora revisa de acordo com as regras de licença e soberania. Nada é aprovado automaticamente, e ele nunca grava em um registro ou banco de dados.

```bash
champollion network submit --list
champollion network submit --yes --type dataset --attest --field dataset-name="GlobalVoices eng-amh" --field pairs=eng-amh --field license=CC-BY-4.0 --field source-url=https://globalvoices.org
```

Todas as opções: `champollion network submit --help`.

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

---

## serve

Disponibiliza a própria pilha de tradução deste projeto (método, registros, coaching, Memória de Tradução, quality gate) via HTTP, seguindo o contrato que o método `api` consome, permitindo que outro projeto Champollion aponte `"method": "api"` para ele. As requisições passam pelo pipeline utilizado por `sync`: acertos na Memória de Tradução são entregues gratuitamente a partir do cache, e falhas no quality gate retornam como erros por chave, nunca como saída degradada.

Ele se vincula a `127.0.0.1` por padrão: qualquer pessoa que consiga acessar a porta pode consumir seu orçamento de API upstream, portanto expô-lo é uma decisão explícita (`--bind 0.0.0.0`) e requer um token de portador (bearer token). `--no-auth` é aceito apenas com uma vinculação em loopback.

```bash
champollion serve --token my-strong-secret --max-session-cost 5
champollion serve --no-auth --bind 127.0.0.1     # this machine only, no token
champollion serve --emit-manifest --endpoint https://translate.example.org
```

| Opção | Efeito |
|--------|--------|
| `--port <n>` | Porta de escuta (padrão: 1822; 0 = uma porta livre aleatória) |
| `--bind <addr>` | Endereço de vinculação (padrão: `127.0.0.1`; `--bind 0.0.0.0` expõe o servidor e requer um token) |
| `--token <secret>` | Token de portador (bearer token) enviado pelos consumidores (padrão: `CHAMPOLLION_SERVE_TOKEN` do ambiente ou `.env.local`; pelo menos 12 caracteres) |
| `--no-auth` | Sem autenticação — recusado a menos que a vinculação seja em loopback |
| `--rate-limit <n>` | Requisições por minuto por IP do cliente (padrão: 120; 0 desativa) |
| `--max-body-bytes <n>` | Limite de tamanho do corpo da requisição em bytes (padrão: 1000000) |
| `--max-cost-per-request <usd>` | Recusar uma requisição cujo custo estimado de upstream exceda este valor (preço desconhecido também recusa) |
| `--max-session-cost <usd>` | Teto de gasto estimado para este processo do servidor; requisições além dele são recusadas (402) |
| `--name <kebab-case>` | Nome do método disponibilizado (padrão: a partir do diretório do projeto) |
| `--pair <src:tgt>` | Disponibilizar apenas estes pares configurados, separados por vírgula |
| `--emit-manifest` | Gravar o `method.json` instalado por um consumidor e sair (sem iniciar o servidor) |
| `--endpoint <url>` | O endpoint acessível pelo consumidor para `--emit-manifest` (padrão: `http://127.0.0.1:<port>/translate`) |
| `--out <path>` | Onde `--emit-manifest` grava (padrão: `./<name>/method.json`) |

---

## models

```bash
champollion models --method gemini      # list Gemini models
champollion models --method openai --json
champollion models check                # every default model against the providers' live lists (free)
```

Lista os modelos oferecidos pela API de um provedor (somente leitura; a configuração não é alterada). `champollion models check` verifica cada modelo padrão (`shared/model-defaults.json`) em relação às listas ativas dos provedores e encerra com código 1 se algum tiver saído do ar; endpoints de listagem não são cobrados.

| Opção | Efeito |
|--------|--------|
| `--method <name>` | Provedor a consultar: `gemini`, `openai` ou `anthropic` (obrigatório, exceto para `check`) |
| `--json` | JSON legível por máquina (um documento) |

---

## doctor

```bash
champollion doctor                  # every check
champollion doctor cards            # language card diagnostics
champollion doctor fst crk          # the Plains Cree FST
champollion doctor --json
```

Uma verificação de integridade da instalação: cartões de idioma, configuração do projeto, instalações de FST, chaves de API e dependências de métodos. Executa todas as verificações por padrão; um subcomando executa uma específica.

| Subcomando | Verificações |
|------------|--------------|
| `cards` | Se os cartões de idioma carregam corretamente; estatísticas de cobertura |
| `config` | O arquivo de configuração do projeto e como seus códigos de idioma são resolvidos |
| `fst [code]` | Instalação de FST (todos ou um idioma específico) |
| `methods` | Chaves de API (se cada uma está definida; uma chave do OpenRouter também é enviada ao endpoint gratuito de chave do OpenRouter, que rejeita chaves inválidas), acessibilidade do servidor, pacotes Python |

`--json` exibe um documento com o resultado de cada verificação.

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
