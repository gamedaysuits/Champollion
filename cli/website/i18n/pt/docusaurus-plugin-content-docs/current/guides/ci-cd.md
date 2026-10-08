---
sidebar_position: 3
title: "CI/CD"
---

# Integração CI/CD

Automatize traduções em seu pipeline de build.

A CLI do champollion está disponível sob a [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): gratuita para usar, modificar e compartilhar para fins não comerciais. Usá-la para fins comerciais não é coberto por esta licença ([quem pode usar](/docs/getting-started/who-may-use-this)).

## GitHub Actions: mantenha as traduções sincronizadas

Um workflow completo: traduza o que mudou, verifique o resultado e faça commit
de volta. Funciona para qualquer projeto — seja Node ou não (Django, Flutter, Hugo).

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  push:
    branches: [main]
    # Run only when something sync reads changed: the SOURCE locale files
    # (edit these to the files your config's "localesDir"/"localesPattern"
    # names) and the config. A push that changes neither has nothing to
    # translate, so it starts no job and needs no key.
    paths:
      - 'locales/en.json'       # one file per language
      - 'locales/en/**'         # or one folder per language (i18next: public/locales/en/**)
      - 'champollion.config.json'
  # Run workflow (by hand). The box asks again for plural forms a model
  # left out (--redo gaps; see "Plural forms a model left out" below).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write          # lets the job push the translated files back

# One sync at a time per branch: two quick pushes would otherwise race to
# commit the same files. Queued, not cancelled — a cancelled run may have
# translated (and paid for) work it never committed.
concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

# The flags of every `champollion sync` in this job — the sync step below,
# and the dry-run check further down this page, read this one line, so the
# check tests the method this job runs. The config's method runs as it is.
# A runner has no model server: if your config says "local" (a model on
# your machine), name a hosted model here instead, for these runs only
# (the config file is not changed):
#   SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
env:
  SYNC_FLAGS: --max-cost 5

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24   # a current LTS; champollion needs Node 20.11 or newer
      # The Translation Memory is a per-machine cache, so a fresh runner
      # starts empty. Restoring it means text translated before is served
      # free instead of billed again. No cache is saved under this exact
      # key: restore-keys brings back the branch's newest one.
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # Exit 2 = partial: some keys were translated, some were not (refused
        # by the quality gate, held back, a plural form the model left out, or
        # --max-cost stopped the run). What WAS translated is committed below,
        # then the job fails with the reason. Any other non-zero code stops here.
        #
        # $SYNC_FLAGS: the job's flags (env: above). The redo_gaps box of
        # "Run workflow" adds --redo gaps.
        run: |
          set +e
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      # Saved even when a step failed: the translations this run paid for
      # stay cached, so the next run does not pay for them again. The key is
      # a hash of the cache's own files, so a run that added nothing to it
      # has the key it restored and skips the save (no new copy). Skipped too
      # when there is no cache folder (a push with nothing to translate on a
      # fresh runner creates none; saving it would log a path warning).
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The translated files AND the lock files (.champollion.lock,
          # .champollion-content.lock), whatever your locale folders are called
          # — and .champollion-replaced-edits.jsonl when a sync wrote one.
          # .champollion/ (the cache) is in .gitignore — `champollion init` adds it.
          # (gettext: build steps write .mo files — stage only the catalogs; see below.)
          git add --all
          git diff --staged --quiet || git commit -m "chore: sync translations"
          # Someone may have pushed while this job ran: put this commit on
          # top of theirs, so the push does not fail (and waste the spend).
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a warning fails the job too. Plain verify passes on warnings
      # — an extra or missing plural form, a source echo, an out-of-date
      # translation — so they would ship with a green build.
      - name: Check every locale is complete and intact
        run: npx --yes champollion@0.5 verify --strict
```

**Por que o workflow é estruturado desta forma.** `actions/cache` por si só salva o
cache apenas quando o job inteiro é bem-sucedido, e `sync` sai com `2` sempre que qualquer chave
é recusada — portanto, uma execução parcial costumava pular tanto o commit quanto o salvamento do cache,
e a próxima execução pagava pelas mesmas traduções novamente. Aqui o cache é
restaurado e salvo em duas etapas (`actions/cache/restore`, depois
`actions/cache/save` com `if: always()`), a etapa de sincronização registra seu código de saída
em vez de falhar em `2`, os arquivos traduzidos recebem commit e só então
o job falha — em sua própria etapa, antes de `verify`, para que a etapa com falha informe
o motivo (uma parada por `--max-cost` ou chaves que a sincronização não conseguiu traduzir) em vez de
`verify` apontando uma chave ausente. A última etapa é `verify --strict`: o
`verify` padrão sai com 0 em avisos (uma forma plural extra ou ausente entre eles), e
`--strict` falha o job nesses casos. Uma chave recusada pelo quality gate é lembrada: a próxima execução
não a envia para o mesmo modelo novamente (isso cobraria pela mesma resposta) —
o log de sincronização indica o nome dela e o comando `--redo keys:` para solicitar novamente.

**Uma cópia de cache por alteração, não por execução.** A etapa de restauração traz de volta o
cache mais recente da branch (sua chave exata, `…-newest`, nunca é salva, então
`restore-keys` seleciona a mais recente). A etapa de salvamento indexa o cache em um
hash dos seus próprios arquivos (`hashFiles('.champollion/**')`): uma execução que traduziu
algo — mesmo uma execução parcial ou uma cujo push falhou — alterou o cache,
então ela recebe uma nova chave e é salva; uma execução que não adicionou nada (nada a
traduzir, tudo vindo do cache, uma parada por `--max-cost`) mantém a chave que
restaurou, então o salvamento é ignorado e nenhuma nova cópia é armazenada. Indexar pelo id da
execução salvava uma cópia completa a cada execução; indexar pelos arquivos de lock e de origem
restauraria uma cópia mais antiga por correspondência exata após uma execução cujo push foi rejeitado,
porque o lock commitado nunca recebeu as alterações daquela execução.

Em um projeto Node, você pode adicionar `champollion` como uma dependência de desenvolvimento e chamar
`npx champollion sync`; o `champollion@0.5` fixado acima funciona em qualquer
repositório e nunca seleciona uma versão diferente de surpresa. O job deve,
então, instalá-lo: em um runner novo, `npx champollion` sem nada instalado
busca a versão mais recente, não a que seu lockfile fixa. E a instalação
grava `node_modules/`, que `git add --all` inclui no commit a menos que seu `.gitignore`
o liste (o que `champollion init` cria lista apenas `.champollion/`), então
adicione os arquivos de locale e o lock à staging area por nome, como o workflow do Django abaixo faz:

```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"
# … checkout and setup-node as above; then install the version your
# package-lock.json pins:
      - run: npm ci
# … the cache restore as above. In "Sync translations" and in the last step,
# the installed CLI replaces the pinned one (SYNC_FLAGS as above):
#   npx champollion sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
#   npx champollion verify --strict
# … the cache save as above; then:
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The locale files and the lock file only: not node_modules/ (npm ci
          # just wrote it) and not .champollion/ (the cache). Name your locale
          # folder (messages, public/locales, …); when sync translates Markdown
          # too, add the folders it writes and .champollion-content.lock.
          git add -- locales .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
```

**Faça commit dos arquivos de lock.** `.champollion.lock` e `.champollion-content.lock`
registram a partir de qual texto de origem cada tradução foi feita. É assim que a
próxima execução sabe que uma string mudou. Um runner que nunca os vê não consegue diferenciar uma
string editada de uma intocada. **Não faça commit de `.champollion/`** — ele é
o cache por máquina; `champollion init` o adiciona ao `.gitignore`.

**`--max-cost`** interrompe uma execução antes que ela gaste mais do que o esperado; defina-o para
o custo das alterações de um dia normal. Quando ele interrompe uma execução, nada foi
traduzido ou gravado e o sync sai com o código `2`: não há nada para commitar,
e a etapa "Stop when the sync was partial" falha o job, informando isso. Um método sem preço publicado (um
endpoint auto-hospedado em outra máquina) não pode ser estimado, então `--max-cost` para
sempre que houver algo para traduzir — deixe-o desativado nesses casos. Um modelo
servido no próprio runner (`local` em `localhost`/`127.0.0.1`) tem preço
de $0 de custo de API.

**Apenas pushes que alteram uma string de origem iniciam o job.** O filtro
`paths:` lista seus arquivos de locale de origem e `champollion.config.json`: um push
que altera apenas código, ou apenas traduções e arquivos de lock, não tem nada
para traduzir e, portanto, não inicia nenhum job. Edite os dois caminhos de locale para os arquivos que sua
configuração especifica (`messages/en.json`, `lib/l10n/app_en.arb`, …); adicione sua
pasta `contentDir` quando o sync também traduzir Markdown. **Run workflow** (o
gatilho `workflow_dispatch`) ainda permite executá-lo manualmente.

**O próprio commit do job nunca o inicia novamente** — e o filtro `paths:`
não é o que impede isso. A etapa de commit faz o push com o `GITHUB_TOKEN` do workflow,
e um push feito com `GITHUB_TOKEN` nunca aciona a execução de um workflow (regra do
GitHub, para que um workflow não possa iniciar a si mesmo). É por isso que o workflow do Django
abaixo pode monitorar `locale/**`, que cada um dos commits do bot altera.
Faça o push com um personal access token ou um token de GitHub App (para iniciar
outros workflows a partir do commit do bot, por exemplo) e esse push iniciará este
workflow novamente; nesse caso, o filtro `paths:` é quem decide. O filtro acima
deixa de fora os arquivos traduzidos e os arquivos de lock, portanto o commit do bot
não inicia nenhuma execução. O `locale/**` do filtro do Django inclui os catálogos que o bot
commita, de modo que cada um de seus commits inicia mais uma execução — que não encontra nada para
traduzir e não commita nada. Com um token desse tipo, restrinja-o ao catálogo
de origem (`locale/en/**`) e adicione idiomas pela configuração.

**A chave do provedor é necessária em todas as execuções iniciadas**, mesmo quando nada
precisa ser traduzido: o sync verifica se o método pode ser executado antes de analisar o que
mudou. Uma execução iniciada manualmente sem alterações no código-fonte ainda falhará sem o
secret `OPENROUTER_API_KEY` (ou a chave do seu método). O `local` não precisa de chave, mas
um runner não tem um servidor de modelos: um projeto que traduz com `local` na
máquina de um desenvolvedor especifica um método hospedado no CI (`--method` / `--model` — a
linha `SYNC_FLAGS` comentada no workflow acima). Para verificar se o secret
chega à etapa, sem traduzir nada, `sync --dry` avisa quando a
execução real pararia e indica o nome da variável ausente (ele ainda sai com 0 — um dry
run é apenas uma prévia). Ele verifica se a variável está **definida**, não se a chave
**funciona**: ele não envia nada, então qualquer valor não vazio passa — inclusive um placeholder.
Uma chave incorreta ou revogada se manifesta na primeira requisição de uma execução real (o erro
exibe a resposta do provedor, como HTTP 401). Para falhar o job por chave ausente
antes que qualquer coisa seja executada, adicione [a verificação antes da sincronização](#check-before-sync).

**O cache é mantido por método.** Uma tradução é armazenada em cache sob o método,
registro e arquivo de coaching que a gerou (um modelo diferente do mesmo
método o reutiliza — model carry-over). Portanto, um desenvolvedor que traduz com `local`
e o CI que traduz com um modelo hospedado nunca compartilham entradas de cache —
e o cache do CI é isolado de qualquer forma (`.champollion/` não é commitado). Isso não
significa que o CI retraduz o projeto: o que já está nos arquivos de locale,
com seu arquivo de lock commitado, conta como concluído. O CI paga ao modelo hospedado pelas
strings que são novas ou foram alteradas desde o último commit — incluindo quaisquer strings que um
desenvolvedor tenha traduzido localmente mas não tenha commitado — e nada pelo restante.
Retraduzir o projeto inteiro com o modelo hospedado (`--redo all`) fatura
cada string uma vez.

**Em um agendamento** em vez de push: substitua o bloco `on:` por
`schedule: [{ cron: '0 6 * * *' }]`.

### Verificação antes da sincronização: falhe o job antecipadamente {#check-before-sync}

Um dry run sai com `0` independentemente do que encontrar — é uma prévia — portanto `sync --dry
--max-cost 5` avisa que a execução real pararia no limite e ainda assim passa
como uma etapa de CI. Para falhar um job quando a execução real pararia (uma chave ausente ou
`--max-cost`), leia o resumo de `sync --dry --json`. Essa saída consiste em
um objeto JSON por linha (NDJSON), cada um com um `level` — linhas `info`, `ok` e
`event` no stdout, linhas `warn` e `error` no stderr — e a última
linha do stdout é o resumo, `{"level": "summary", "command": "sync", …}`.
Selecione-a pelo seu nível. **Execute com as mesmas flags do sync**: sem
elas, ele verifica o método especificado na configuração; logo, em um projeto cuja configuração
define `local`, ele verificaria o método local — não o modelo hospedado que o job
executa — e passaria em um runner sem chave. Como uma etapa no workflow acima,
antes de "Sync translations", ele lê o mesmo `SYNC_FLAGS`:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

Ou em um shell, com as flags explicitadas — as mesmas da linha de sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` é `false` quando uma chave necessária para o método está ausente (não definida ou
vazia — não quando está incorreta), quer haja algo para traduzir ou não: um
método hospedado nunca está pronto sem sua chave. `maxCost.wouldStop` (presente com
`--max-cost`) é `true` quando a execução real pararia no limite de custo. `jq -e` sai com
1 em qualquer um dos casos, e a etapa imprime o motivo no log do job — por exemplo
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Quando o sync não pode ser executado de
forma alguma (uma configuração corrompida), a etapa imprime o `error` do resumo. A etapa
não envia o stderr para `/dev/null`, portanto os avisos também permanecem no log. O
`realRun.exitCode` do resumo informa com qual código a execução real sairia,
tanto quanto uma prévia pode prever: `1` quando o preflight a interromperia, `2`
quando `--max-cost` o faria, ou quando terminaria parcial — chaves retidas ou
mensagens plurais em disco sem uma forma que o idioma utiliza (`realRun.reasons`
informa quais). Uma recusa pelo quality gate, que apenas a execução real detecta, ainda
pode transformar um `0` em um `2`. Para falhar a verificação também em uma execução parcial prevista,
coloque `.realRun.exitCode == 0` no lugar de `.preflight.ready and (.maxCost.wouldStop | not)`.

### Uma branch main protegida: proponha um pull request

O workflow acima envia as traduções diretamente para a `main`. Se a `main` estiver
protegida (revisões ou status checks obrigatórios), esse push é rejeitado — após
a execução do sync, portanto as traduções já foram pagas. Elas não são pagas
novamente: o cache é salvo antes da etapa de commit, mesmo quando uma etapa falha,
portanto reexecutar o job ou o próximo push (cada um restaura o cache mais recente
da branch, por meio de `restore-keys`) as obtém do cache. Os
arquivos de lock nunca chegaram à `main`, então a próxima execução encontra as mesmas strings
alteradas e as grava novamente — a partir do cache, sem custo.

Em uma `main` protegida, faça commit em uma branch pertencente ao bot e abra (ou atualize) um
pull request. Mantenha o workflow acima e altere duas coisas: as
permissões e a etapa de commit.

```yaml title=".github/workflows/i18n-sync.yml (pull request)"
permissions:
  contents: write          # pushes the bot's branch
  pull-requests: write     # opens the pull request

# … checkout, setup-node, cache restore, "Sync translations" and the cache
# save as above; then, in place of "Commit updated translations":
      - name: Open or update the translations pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          branch=champollion/translations
          git switch -C "$branch"
          # Django: stage the catalogs and the lock by name, as in the
          # Django workflow below, instead of --all.
          git add --all
          if git diff --staged --quiet; then
            echo "Nothing to propose: the translations on $GITHUB_REF_NAME are up to date."
            exit 0
          fi
          git commit -m "chore: sync translations"
          # The branch is rebuilt from the latest $GITHUB_REF_NAME on every
          # run, so a force-push replaces the last proposal.
          git push --force origin "$branch"
          if [ -z "$(gh pr list --head "$branch" --base "$GITHUB_REF_NAME" --state open --json number --jq '.[].number')" ]; then
            gh pr create --head "$branch" --base "$GITHUB_REF_NAME" \
              --title "chore: sync translations" \
              --body "Translations and lock files from champollion sync (run $GITHUB_RUN_ID). Merge them together."
          fi
# "Stop when the sync was partial" and the verify --strict step stay as they
# are, after this one.
```

**Quando usar cada um.** Faça push para a `main` quando o workflow tiver permissão para isso: sem
proteção de branch ou com uma regra que permita ao GitHub Actions ignorá-la. Abra um pull
request quando a `main` estiver protegida, ou quando uma pessoa — falante do idioma
— deva revisar as traduções antes de entrarem em produção.

- A branch pertence ao bot. Até que o pull request seja mesclado, os arquivos de lock da
  `main` não contêm essas traduções, então toda execução propõe o conjunto inteiro
  novamente — a partir do cache, portanto apenas as strings alteradas desde então são faturadas. Edições
  enviadas para essa branch são substituídas pela próxima execução: revise no pull
  request, mescle e então edite na `main` (uma reformulação em lote posterior preserva a
  edição humana).
- O repositório deve permitir que o Actions abra pull requests: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Um pull request aberto com o `GITHUB_TOKEN` do workflow não inicia nenhum outro
  workflow, portanto os status checks obrigatórios nunca são executados nele. Se a `main` os
  exigir, abra-o com um token de GitHub App ou um fine-grained token mantido como
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), ou use uma action como
  `peter-evans/create-pull-request`, que commita, atualiza a branch e
  edita o pull request aberto para você (passe o token para ela da mesma forma).

### gettext (Django, Babel) e Flutter

O sync traduz os catálogos existentes; ele não extrai strings do
seu código. Um projeto Django atualiza os catálogos antes da etapa de sync,
verifica se eles compilam depois dela e commita apenas os catálogos.

`makemessages` e `compilemessages` importam suas configurações, portanto o job
define o que eles precisam, uma vez, para todas as etapas: qualquer variável que seu módulo de settings
lê na importação (`SECRET_KEY`, `DATABASE_URL`, …). Nenhum dos comandos acessa o
banco de dados, então um valor placeholder é suficiente para elas. `DJANGO_SETTINGS_MODULE`
fica comentado: o `manage.py` gerado por `startproject` o define
automaticamente, e um valor definido no job sobrescreve esse — um nome de módulo errado
quebra o `makemessages`. Defina-o apenas quando seu `manage.py` não o fizer.

Seu filtro `paths:` difere do workflow acima: as strings de origem residem no
seu código Python e templates, e o `makemessages` as extrai no job, logo
uma alteração de código pode introduzir uma nova string. Restrinja os padrões aos seus apps
(`myapp/**.py`) se todo push mexer em Python. Ele também monitora `locale/**`:
um novo idioma chega como uma nova pasta de catálogo (`makemessages -l <code>`). O
próprio commit do bot altera esses catálogos, mas não inicia nenhuma execução, pois é
enviado com `GITHUB_TOKEN` (veja **O próprio commit do job nunca o inicia novamente**
acima — e o que restringir ao fazer push com outro token).

```yaml title=".github/workflows/i18n-sync.yml (Django)"
name: Sync translations
on:
  push:
    branches: [main]
    # makemessages finds new strings in your code and templates, so a code
    # change can bring a string to translate: watch those, the catalogs
    # and the config. A push that touches none of them starts no job.
    paths:
      - '**.py'
      - '**.html'
      - '**.txt'                # templates for emails and the like
      - '**.js'                 # djangojs strings; drop it if you have none
      - 'locale/**'
      - 'champollion.config.json'
  # Run workflow (by hand): the box asks again for plural forms a model left
  # out — Russian few/many marked "# champollion:" (--redo gaps).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    # For every step: makemessages and compilemessages both import your
    # settings, so set what your settings read at import (see above).
    # Placeholders are enough: neither command uses the database.
    env:
      # DJANGO_SETTINGS_MODULE: myproject.settings   # only if your manage.py does not set it
      SECRET_KEY: makemessages-only
      # The flags of every `champollion sync` in this job (the dry-run check
      # above reads them too). A runner has no model server: if your config
      # uses "local" (a model on your machine), a hosted method runs here,
      # for these runs only — the config file is not changed.
      SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      # A fresh runner's package index is empty: update it first, or the
      # install fails. gettext brings msgmerge and msgfmt, used below.
      - run: sudo apt-get update && sudo apt-get install -y gettext
      - run: python -m pip install -r requirements.txt   # the Python setup-python just installed
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Extract new strings into the catalogs
        # --no-wrap: champollion writes each msgstr on one line; without it
        # msgmerge re-wraps those lines at 79 columns on the next run, and
        # every sync commits whitespace-only changes. The second line
        # refreshes the JavaScript catalogs (djangojs.po); drop it if your
        # project has none.
        run: |
          python manage.py makemessages --all --no-wrap
          python manage.py makemessages --all --no-wrap -d djangojs
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # $SYNC_FLAGS: the job's flags (env: above); the redo_gaps box of
        # "Run workflow" adds --redo gaps. Exit 2 (partial) is recorded, not
        # fatal: what was translated is committed, then the job fails.
        run: |
          set +e
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Check the catalogs compile (placeholder types included)
        run: python manage.py compilemessages
      - name: Commit updated catalogs
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The catalogs and the lock file only: not the .mo files
          # compilemessages just wrote, and not .champollion/ (the cache).
          git add -- '*.po' .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          # makemessages (msgmerge) writes a new POT-Creation-Date into every
          # catalog on each run: commit only when something else changed
          # (git diff -I needs git 2.30 or newer; GitHub's runners have it).
          if git diff --staged --quiet -I '^"POT-Creation-Date:'; then
            echo "Nothing to commit: only the catalogs' POT-Creation-Date changed."
          else
            git commit -m "chore: sync translations"
            git pull --rebase origin "$GITHUB_REF_NAME"
            git push origin "HEAD:$GITHUB_REF_NAME"
          fi
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a plural entry where the model left out a form the
      # language uses for everyday counts (Russian few/many) is a warning,
      # and plain verify passes on warnings. Strict fails on it, so wrong
      # plurals never ship with a green build.
      - name: Check every catalog is complete and intact
        run: npx --yes champollion@0.5 verify --strict
```

`--all` atualiza todos os catálogos existentes; adicione um idioma com
`makemessages -l <code>` uma vez (ou `champollion init --langs <code>`).
`makemessages` é executado uma vez por domínio: `django` para Python e templates,
`djangojs` (`-d djangojs`) para JavaScript. O sync traduz o catálogo de cada domínio
que encontrar. A última etapa executa `verify --strict`. Uma entrada de plural em russo
cuja tradução não contenha a forma `few` ou `many` é gravada com a forma `other`
e marcada como `# champollion:`. Todo sync sai com `2` enquanto tal entrada estiver
em um catálogo — tanto a execução que a gravou quanto todas as seguintes, como ocorre com uma chave
retida — e seu resumo indica o nome da entrada e o comando para solicitar novamente; a
linha de verificação pós-sync informa, então, que a execução está incompleta em vez de `[OK]`.
Assim, a etapa "Stop when the sync was partial" falha o job após o commit
até que as formas sejam gravadas. Isoladamente, isso é um aviso: o `verify` padrão
sai com 0 nesses casos, enquanto `--strict` falha. `audit` contabiliza essas mesmas entradas como
incompletas.

`compilemessages` executa `msgfmt --check-format`, que também verifica se cada
`%(name)s` mantém seu tipo — mas apenas em entradas sinalizadas com `#, python-format`.
`makemessages` adiciona essa flag às entradas que extrai com um placeholder
`%`; um catálogo criado manualmente pode não tê-la, e suas entradas não são
verificadas nesse caso. O `champollion
verify` compara os placeholders printf de cada entrada (nome e letra de tipo)
quaisquer que sejam suas flags, e o sync preserva as flags da entrada de origem em cada entrada que
traduz. A etapa de commit adiciona `*.po` e
`.champollion.lock` à staging area por nome (e o registro de edições substituídas quando houver
um); se o seu projeto rastreia seus arquivos `.mo`, adicione `'*.mo'` a ele. As
etapas de cache, o código de saída registrado e o `git pull --rebase` estão presentes pelos
mesmos motivos do workflow acima. Babel: `pybabel extract` + `pybabel update --no-wrap` antes
do sync, `pybabel compile` depois dele.

O Flutter não precisa de nenhuma etapa extra neste job: o sync grava os arquivos
`app_<locale>.arb`, e `flutter gen-l10n` (ou `flutter build`, que o executa) é a
etapa de build do seu próprio aplicativo, na qual eles são transformados em Dart.

#### Formas plurais omitidas por um modelo {#plural-gaps}

Uma entrada marcada não é uma tradução, então o sync não a deixa sob responsabilidade exclusiva
de uma pessoa:

- **Outro método ou modelo solicita novamente de forma automática.** Um sync cuja configuração
  (método, modelo, registro, coaching) ainda não respondeu a essa entrada a envia
  para o modelo novamente — e não para o cache, que armazena a resposta
  incompleta. Portanto, quando o modelo local de um desenvolvedor omitir as formas, o modelo hospedado
  do job (`SYNC_FLAGS`) as solicitará na próxima execução, e a estimativa
  calculará o custo. O lock (`.champollion.lock`, sob `gaps`) registra cada configuração
  que respondeu sem as formas, de modo que uma execução local e uma execução de CI nunca se
  alternem pagando pela mesma resposta incompleta.
- **`sync --redo gaps` solicita novamente todas essas entradas**, independentemente de quem as omitiu — nos
  workflows acima, marque `redo_gaps` em **Run workflow**. Adicione `--model` a
  `SYNC_FLAGS` para usar um modelo mais robusto.
- **Se a nova resposta também não contiver as formas, a entrada continuará marcada** e a
  execução sairá com `2`, como antes. Nesse caso, escreva as formas manualmente e exclua a
  linha `# champollion:`.

Um dry run (`sync --dry`) lista as entradas que solicitaria novamente e calcula
seu preço; seu resumo `--json` contabiliza as que ele não solicitaria (`totalPluralGaps`)
e informa que a execução real sairia com `2` por causa delas (`realRun.exitCode`).

## Outros métodos

Os trechos abaixo mostram a chave necessária para cada método e seu comando `sync`.
Use-os **dentro** da etapa "Sync translations" do workflow acima: substitua
seu `env`, coloque as flags exibidas (`--method openai`, …) na linha
`SYNC_FLAGS` do workflow — para que a verificação de dry-run execute o mesmo método — e mantenha o
restante da etapa (`id: sync` e as linhas que gravam o código de saída), para que uma
execução parcial ainda commite o que traduziu e salve o cache.

## Método Google Translate

Se estiver usando o método Google Translate integrado em vez de OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Provedores LLM Diretos

Se estiver usando `openai`, `anthropic`, ou `gemini` métodos diretamente:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.5 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.5 sync --method deepl
```

## API de Tradução Remota

Se estiver usando um endpoint de tradução remoto (por exemplo, um serviço de tradução hospedado):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Um gate antes de fazer o deploy

Para falhar um build quando qualquer locale estiver incompleto ou danificado, sem traduzir
nada, execute as verificações de forma independente.

:::warning[Execute o gate após a sincronização, não antes dela]
Se a tradução for executada apenas após o merge (o workflow acima), um pull request que
adiciona uma string ainda não terá tradução para ela, e `audit`/`verify` falharão em todos
os PRs desse tipo. Execute o gate onde as traduções já existem: na `main` após
o job de sync (`needs: sync` ou `on: workflow_run` do workflow de sync). O
gatilho `push` não é disparado nos próprios commits do bot de sincronização — eles são enviados
com `GITHUB_TOKEN`, que não inicia nenhum workflow (veja acima). Em pull requests,
execute apenas `lint` ou execute o job de sync na branch do PR primeiro.
:::

```yaml
jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      # 1. Hardcoded strings that never reached a locale file (web projects)
      - run: npx --yes champollion@0.5 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.5 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.5 verify --strict
```

| Verificação | Comando | Falha quando |
|-------|---------|------------|
| **Lint** | `lint` | O código-fonte contém strings que não estão em um arquivo de locale — ou não encontrou arquivos de origem para verificar (ele informa as pastas pesquisadas; aponte para outro local com `--src <dir>`) |
| **Audit** | `audit` | Uma chave está ausente, vazia ou ainda é um fallback de `[EN]` — ou uma tradução está **desatualizada**: feita a partir de um texto de origem mais antigo que o atual (uma edição de origem cuja retradução falhou) — ou uma mensagem plural carece de uma forma que o idioma usa para contagens cotidianas (`few`/`many` em russo; as entradas nas quais `verify --strict` falha), indicando o comando para solicitar novamente |
| **Verify** | `verify` | Uma tradução danificou um placeholder, plural ICU, marcação (uma tag aberta, fechada ou aninhada de forma diferente) ou script — ou uma chave está ausente — ou um mesmo texto substitui várias strings de origem diferentes (um modelo repetindo uma frase memorizada) — ou não encontrou nada para verificar (o arquivo de origem ou a pasta de locales não está onde a configuração indica) |
| **Verify, estrito** | `verify --strict` | Qualquer uma das condições acima ou qualquer aviso |

`verify` sai com `1` em caso de qualquer erro e com `0` caso contrário. Avisos são exibidos, mas
não falham o job: um eco da origem, dois locales com texto idêntico, uma
tradução desatualizada, uma tradução que removeu o `?` ou `!` de fechamento da
origem (alguns idiomas marcam uma pergunta com uma partícula em vez disso)
e os avisos de plural abaixo. Um mesmo texto gerado para várias strings de origem
diferentes é considerado erro: duas strings de várias palavras claramente distintas respondidas com
o mesmo texto de quatro ou mais palavras, ou três ou mais palavras nos demais casos. Isso é contabilizado
entre valores de chaves, cada ramificação de plural e as páginas Markdown do locale, pela
regra com a qual o gate do `sync` a recusa. `verify --strict` transforma qualquer aviso em
falha. Use-o quando, por exemplo, formas plurais em russo omitidas pelo modelo devam
bloquear um deploy. Traduções desatualizadas são tratadas como aviso no `verify` (a
estrutura está intacta) e como falha no `audit` (o gate de integridade/completude), que
exibe o comando para retraduzi-las.

Os apontamentos de plural dependem de como o formato armazena plurais:

| Formato | Erro (`verify` sai com 1) | Aviso (falha apenas com `--strict`) |
|--------|--------------------------|--------------------------------------|
| Chaves sufixadas do i18next (`count_one`, `count_other`, …) | Uma forma necessária para o locale está ausente (`count_many` em francês): é uma chave ausente. | Uma chave para uma forma que o locale não possui (`count_two` em francês ou espanhol). `verify` imprime o comando que remove exatamente essas chaves, `sync --prune plural-extras`; o sync nunca as exclui sem isso. |
| Mensagens ICU (`{count, plural, …}` no next-intl, ARB, i18next ICU) | A estrutura de plural está danificada (uma variável, palavra-chave ou seletor traduzido, um `#` perdido). | Uma ramificação usada pelo locale para contagens cotidianas está ausente (`few`, `many` em russo). Uma forma ausente usada apenas para números grandes (`many` em francês, para 1 000 000) não é reportada. |
| gettext (`msgid_plural`) | Uma entrada sem tradução (vazia ou `fuzzy`): é uma chave ausente. | Formas `msgstr[]` que repetem a forma `other` onde o idioma possui sua própria forma para contagens cotidianas (marcadas com um comentário `# champollion:`). Mais linhas `msgstr[]` do que o `nplurals` do catálogo. As formas plurais são contabilizadas pelo próprio cabeçalho `Plural-Forms` do catálogo. |

Uma forma do i18next traduzida a partir do texto de outra forma pode conter exatamente o texto
dessa forma (`count_many` em francês igual a `count_other`). O francês pode escrever as
duas da mesma maneira, portanto isso nunca é um aviso. Quando o sync solicita uma forma ao modelo, ele
registra isso em `.champollion.lock`, com uma impressão digital (fingerprint) da resposta. O `verify`
lê apenas esse registro, de modo que cada clone de um commit obtém o mesmo resultado. O
cache do seu notebook e um novo runner de CI não divergem. Um valor sem registro
(escrito manualmente, por outra ferramenta, por um mecanismo de tradução automática ao qual não
é possível informar a forma, ou por uma versão mais antiga) recebe uma linha informativa com o comando
para solicitar novamente. `--strict` não falha nesse caso.
O verify valida a estrutura, não o significado: passar no teste indica que as chaves, placeholders,
plurais, marcações e scripts estão intactos, não que o texto está correto quanto ao sentido.

---

## Veja Também

- [Referência CLI](/docs/reference/cli) — referência completa de comandos
- [Como Sync Funciona](/docs/concepts/how-sync-works) — entendendo sincronização incremental
- [Memória de Tradução](/docs/concepts/translation-memory) — cache e economia de custos
- [Métodos de Tradução](/docs/guides/translation-methods) — seleção de método por par
- [Quality Gate](/docs/concepts/quality-gate) — o que acontece quando traduções falham
- [Configuração](/docs/getting-started/configuration) — referência de configuração
