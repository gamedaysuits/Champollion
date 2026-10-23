---
sidebar_position: 3
title: "CI/CD"
---

# Integração com CI/CD

Automatize traduções no seu pipeline de build.

A CLI do champollion tem código disponível sob a [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): livre para usar, alterar e compartilhar para fins não comerciais. Usá-la para fins comerciais não é coberto por esta licença ([quem pode usar](/docs/getting-started/who-may-use-this)).

## GitHub Actions: mantenha as traduções sincronizadas

Um workflow completo: traduza o que mudou, verifique o resultado e faça commit de volta. Ele funciona para qualquer projeto — com Node ou não (Django, Flutter, Hugo).

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
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.6 verify --strict
```

**Por que o workflow é estruturado desta forma.** O `actions/cache` por si só salva o
cache apenas quando todo o job tem sucesso, e `sync` sai com `2`
sempre que alguma chave é recusada — então uma execução parcial costumava pular
tanto o commit quanto o salvamento do cache, e a execução seguinte pagava pelas
mesmas traduções novamente. Aqui o cache é restaurado e salvo em duas etapas
(`actions/cache/restore` e, depois, `actions/cache/save` com `if: always()`), a etapa de sincronização registra
seu código de saída em vez de falhar em `2`, os arquivos traduzidos recebem commit
e só então o job falha — em sua própria etapa, antes de `verify`, de modo que a etapa
com falha indique o motivo (uma parada por `--max-cost` ou chaves que a sincronização não
conseguiu traduzir) em vez de `verify` apontar uma chave ausente. A última etapa é
`verify --strict`: o `verify` simples sai com 0 em avisos (uma forma plural extra ou
ausente entre eles), e `--strict` faz o job falhar com eles. Uma chave que o quality gate
recusou é lembrada: a próxima execução não a envia ao mesmo modelo novamente (isso cobraria
pela mesma resposta) — o log de sincronização indica a chave e o comando `--redo keys:`
para tentar de novo.

**Uma cópia de cache por alteração, não por execução.** A etapa de restauração
traz de volta o cache mais recente da branch (sua chave exata, `…-newest`,
nunca é salva, então `restore-keys` escolhe o mais recente). A etapa de salvamento
indexa o cache pelo hash dos seus próprios arquivos (`hashFiles('.champollion/**')`): uma execução
que traduziu algo — mesmo uma execução parcial ou uma cujo push falhou — alterou
o cache, portanto recebe uma nova chave e é salva; uma execução que não adicionou
nada (nada para traduzir, tudo vindo do cache, uma parada por `--max-cost`) mantém
a chave restaurada, de modo que o salvamento é pulado e nenhuma nova cópia é
armazenada. Indexar pelo ID da execução salvaria uma cópia completa a cada
execução; indexar pelos arquivos de lock e de origem restauraria uma cópia mais
antiga por correspondência exata após uma execução cujo push foi rejeitado, porque
o lock com commit nunca recebeu as alterações daquela execução.

Em um projeto Node, você pode adicionar `champollion` como dependência de desenvolvimento e
chamar `npx champollion sync` em vez disso; o `champollion@0.6` fixado acima funciona em qualquer
repositório e nunca seleciona uma versão diferente de surpresa. O job precisa
então instalá-lo: em um runner limpo, `npx champollion` sem nada instalado busca a
versão mais recente, não a que seu arquivo de lock fixa. E a instalação grava
`node_modules/`, para o qual `git add --all` faz commit a menos que seu `.gitignore` o
liste (aquele criado por `champollion init` lista apenas `.champollion/`), portanto prepare (stage)
os arquivos de localidade e o lock pelo nome, como faz o workflow do Django abaixo:

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
registram de qual texto de origem cada tradução foi gerada. É assim que a
próxima execução sabe que uma string mudou. Um runner que nunca os vê não consegue
diferenciar uma string editada de uma intocada. **Não faça commit de `.champollion/`** —
esse é o cache por máquina; `champollion init` o adiciona ao `.gitignore`.

**`--max-cost`** interrompe uma execução antes que ela gaste mais do que o esperado;
defina-o com o valor que as alterações de um dia comum custam para você. Quando ele
interrompe uma execução, nada foi traduzido ou gravado e o sync sai com o código `2`:
não há nada para commitar, e a etapa "Stop when the sync was partial" falha o job,
informando isso. Um método sem preço publicado (um endpoint auto-hospedado em outra máquina)
não pode ser estimado, portanto `--max-cost` interrompe sempre que houver algo para
traduzir — deixe-o desativado nesses casos. Um modelo servido no próprio runner
(`local` em `localhost`/`127.0.0.1`) é precificado a um custo de API de $0.

**Apenas pushes que alteram uma string de origem iniciam o job.** O filtro `paths:`
lista seus arquivos de localidade de origem e `champollion.config.json`: um push que altera apenas
código, ou apenas traduções e arquivos de lock, não tem nada para traduzir, portanto
não inicia nenhum job. Edite os dois caminhos de localidade para os arquivos definidos
na sua configuração (`messages/en.json`, `lib/l10n/app_en.arb`, …); adicione sua pasta `contentDir`
quando a sincronização também traduzir Markdown. **Run workflow** (o gatilho `workflow_dispatch`)
ainda permite executá-lo manualmente.

**O próprio commit do job nunca o inicia novamente** — e o filtro `paths:` não é o
que impede isso. A etapa de commit faz o push com o `GITHUB_TOKEN` do workflow, e um push
feito com `GITHUB_TOKEN` nunca dispara a execução de um workflow (regra do próprio GitHub,
para que um workflow não possa iniciar a si mesmo). É por isso que o workflow do Django
abaixo pode monitorar `locale/**`, que cada commit do bot altera. Se fizer push com um
token de acesso pessoal (PAT) ou com um token do GitHub App (para iniciar outros workflows
a partir do commit do bot, por exemplo), esse push iniciará este workflow novamente; nesse
caso, o filtro `paths:` é quem decide. O filtro acima deixa de fora os arquivos traduzidos
e os arquivos de lock, portanto o commit do bot não inicia nenhuma execução. O `locale/**` do
filtro do Django inclui os catálogos nos quais o bot faz commit, portanto cada um de seus
commits inicia mais uma execução — que não encontra nada para traduzir e não faz commit de
nada. Com esse tipo de token, restrinja-o ao catálogo de origem (`locale/en/**`) e adicione
idiomas pela configuração.

**A chave do provedor é necessária em toda execução iniciada**, mesmo quando não há nada
para traduzir: o sync verifica se o método pode ser executado antes de olhar o que mudou.
Uma execução iniciada manualmente sem alterações na origem ainda falha sem o secret `OPENROUTER_API_KEY`
(ou a chave do seu método). O `local` não precisa de chave, mas um runner não tem servidor
de modelo: um projeto que traduz com `local` na máquina de desenvolvimento define um método
hospedado no CI (`--method` / `--model` — a linha comentada `SYNC_FLAGS` no workflow
acima). Para verificar se o secret chega à etapa, sem traduzir nada, `sync --dry` avisa quando a
execução real pararia e indica a variável ausente (ele ainda sai com 0 — um dry run é uma prévia).
Ele verifica se a variável está **definida**, não se a chave **funciona**: nada é enviado, portanto
qualquer valor não vazio passa — inclusive um valor provisório. Uma chave incorreta ou revogada
aparece na primeira requisição de uma execução real (o erro informa a resposta do provedor, como HTTP 401).
Para fazer o job falhar devido a uma chave ausente antes de executar qualquer coisa, adicione
[a verificação antes do sync](#check-before-sync).

**O cache é mantido por método.** Uma tradução é armazenada em cache sob o método, o registro
e o arquivo de coaching que a geraram (um modelo diferente do mesmo método a reutiliza — transferência
de modelo). Uma pessoa desenvolvedora que traduz com `local` e o CI que traduz com um modelo
hospedado, portanto, nunca compartilham entradas de cache — e o cache do CI já é próprio de qualquer
forma (`.champollion/` não recebe commit). Isso não significa que o CI retraduz o projeto: o que já
está nos arquivos de localidade, com seu arquivo de lock commitado, é considerado concluído. O CI paga
ao modelo hospedado pelas strings novas ou alteradas desde o último commit — incluindo qualquer uma
traduzida localmente por um desenvolvedor, mas sem commit — e nada pelo restante. Retraduzir o projeto
inteiro com o modelo hospedado (`--redo all`) cobra por cada string uma única vez.

**Em um agendamento** em vez de no push: substitua o bloco `on:` por `schedule: [{ cron: '0 6 * * *' }]`.

### Verificação antes do sync: faça o job falhar com antecedência {#check-before-sync}

Um dry run sai com `0` independentemente do que encontrar — é uma prévia —, portanto
`sync --dry --max-cost 5` avisa que a execução real pararia no limite e ainda assim passa como etapa
do CI. Para fazer um job falhar quando a execução real pararia (uma chave ausente ou `--max-cost`),
leia o resumo de `sync --dry --json`. Essa saída consiste em um objeto JSON por linha (NDJSON), cada um com
um `level` — linhas `info`, `ok` e `event` no stdout, linhas `warn` e
`error` no stderr — e a última linha no stdout é o resumo, `{"level": "summary", "command": "sync", …}`.
Selecione-o pelo nível. **Execute-o com as mesmas flags do sync**: sem elas, ele verifica o método definido
na configuração, portanto, para um projeto cuja configuração indica `local`, ele verificaria o
método local — não o modelo hospedado que o job executa — e passaria em um runner sem chave. Como uma etapa
no workflow acima, antes de "Sync translations", ele lê as mesmas `SYNC_FLAGS`:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

Ou em um shell, com as flags explicitadas — as mesmas da linha do sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` é `false` quando uma chave necessária para o método está ausente (não definida
ou vazia — não quando está incorreta), quer haja algo para traduzir ou não: um método hospedado nunca está
pronto sem a sua chave. `maxCost.wouldStop` (presente com `--max-cost`) é `true` quando a execução real
pararia no limite. `jq -e` sai com 1 em qualquer um dos casos, e a etapa imprime o motivo no log do job —
por exemplo `A real sync would exit 1: it would stop before translating: No OpenRouter API key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost would stop it before any API call (Estimated translation cost exceeds the --max-cost cap: estimate ~$7.1200, cap $5.0000)`.
Quando a sincronização não consegue rodar de forma alguma (uma configuração corrompida), a etapa imprime o
`error` do resumo em vez disso. A etapa não envia stderr para `/dev/null`, portanto os avisos também
permanecem no log. O `realRun.exitCode` do resumo indica com o que a execução real sairia, até onde uma prévia
consegue prever: `1` quando a verificação prévia (preflight) a interromperia, `2` quando
`--max-cost` a interromperia ou quando terminaria parcial — chaves retidas ou mensagens plurais no disco sem
uma forma usada pelo idioma (`realRun.reasons` indica qual). Uma recusa pelo quality gate, que apenas a execução
real detecta, ainda pode transformar um `0` em `2`. Para fazer a verificação falhar
também em uma execução parcial prevista, coloque `.realRun.exitCode == 0` no lugar de `.preflight.ready and (.maxCost.wouldStop | not)`.

### Uma branch main protegida: proponha um pull request

O workflow acima faz push das traduções diretamente para a `main`. Se a `main` for
protegida (exigência de revisões ou status checks), esse push será rejeitado — depois que a sincronização
já foi executada, portanto as traduções já foram pagas. Elas não serão pagas novamente: o cache é salvo
antes da etapa de commit, mesmo quando uma etapa falha, de modo que reexecutar o job ou o próximo push
(cada um restaura o cache mais recente da branch, por meio de `restore-keys`) as obtém do cache. Os
arquivos de lock nunca chegaram à `main`, então a próxima execução encontra as mesmas strings
alteradas e as grava novamente — a partir do cache, sem custo.

Em uma `main` protegida, faça commit em uma branch de propriedade do bot e abra (ou atualize) um
pull request. Mantenha o workflow acima e altere duas coisas: as permissões e a etapa de commit.

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
proteção de branch ou com uma regra que permita ao GitHub Actions contorná-la. Abra um pull request quando a
`main` estiver protegida ou quando uma pessoa — falante do idioma — deva ler as traduções antes de
entrarem em produção.

- A branch pertence ao bot. Até que o pull request seja mesclado, os arquivos de lock da `main` não
  contêm essas traduções, portanto cada execução propõe o conjunto completo novamente — a partir do cache, de
  modo que apenas as strings alteradas desde então são cobradas. Edições enviadas para essa branch são
  substituídas na próxima execução: revise no pull request, mescle e, em seguida, edite na `main` (uma
  nova execução em lote posterior preserva a edição feita por uma pessoa).
- O repositório precisa permitir que o Actions abra pull requests: Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".
- Um pull request aberto com o `GITHUB_TOKEN` do workflow não inicia nenhum outro workflow, de modo que as
  verificações de status obrigatórias nunca são executadas nele. Se a `main` as exigir, abra-o com um
  token do GitHub App ou um token de granularidade fina mantido como secret (`GH_TOKEN: ${{ secrets.<name> }}`), ou use uma action
  como a `peter-evans/create-pull-request`, que faz o commit, atualiza a branch e edita o pull request aberto para você (passe
  o token da mesma forma).

### gettext (Django, Babel) e Flutter

O sync traduz os catálogos existentes; ele não extrai strings do seu código. Um projeto Django atualiza os
catálogos antes da etapa de sincronização, verifica se eles compilam depois dela e faz commit apenas dos
catálogos.

Tanto `makemessages` quanto `compilemessages` importam suas configurações, portanto o job define o que eles
precisam, de uma vez só, para todas as etapas: qualquer variável que seu módulo de configurações leia na
importação (`SECRET_KEY`, `DATABASE_URL`, …). Nenhum dos comandos acessa o banco de dados, então um
valor provisório é suficiente para eles. `DJANGO_SETTINGS_MODULE` fica comentado: o `manage.py` gerado por
`startproject` já o define, e um valor definido no job sobrepõe esse — um nome de módulo incorreto quebra
o `makemessages`. Defina-o apenas quando o seu `manage.py` não o fizer.

Seu filtro `paths:` é diferente do workflow acima: as strings de origem ficam no seu código Python
e templates, e o `makemessages` as extrai no job, de modo que uma alteração no código pode trazer uma nova
string. Restrinja os padrões aos seus apps (`myapp/**.py`) se todo push alterar código Python. Ele também
monitora `locale/**`: um novo idioma surge como uma nova pasta de catálogo (`makemessages -l <code>`). O próprio
commit do bot altera esses catálogos, mas não inicia nenhuma execução, porque o push é feito com
`GITHUB_TOKEN` (veja **O próprio commit do job nunca o inicia novamente** acima — e o que restringir caso
faça push com outro token).

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
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.6 verify --strict
```

`--all` atualiza todos os catálogos existentes; adicione um idioma com `makemessages -l <code>` uma vez
(ou `champollion init --langs <code>`). `makemessages` é executado uma vez por domínio: `django` para Python e templates,
`djangojs` (`-d djangojs`) para JavaScript. O sync traduz o catálogo de cada domínio que encontrar.
A última etapa executa `verify --strict`. Uma entrada plural em russo cuja tradução não contenha a forma
`few` ou `many` é gravada com a forma `other` e marcada como `# champollion:`. Toda
sincronização sai com `2` enquanto tal entrada estiver em um catálogo — aquela que a grava e todas
as seguintes, como ocorre com uma chave retida — e seu resumo indica a entrada e o comando para tentar novamente;
a linha de verificação pós-sync diz então que a execução está incompleta em vez de `[OK]`. Assim, a
etapa "Stop when the sync was partial" falha o job após o commit até que as formas sejam gravadas. De forma
isolada, isso é um aviso: o `verify` comum sai com 0 para isso, enquanto `--strict` falha. O
`audit` conta essas mesmas entradas como incompletas.

`compilemessages` executa `msgfmt --check-format`, que também verifica se cada `%(name)s` mantém seu tipo — mas
apenas em entradas marcadas com a flag `#, python-format`. O `makemessages` adiciona essa flag às entradas que
extrai com um placeholder `%`; um catálogo criado manualmente pode não tê-la, e suas entradas não
são verificadas nesse caso. O `champollion verify` compara os placeholders de printf de cada entrada (nome e
letra de tipo) independentemente de suas flags, e o sync mantém as flags da entrada de origem em cada entrada
que traduz. A etapa de commit adiciona `*.po` e `.champollion.lock` à stage pelo nome (e o registro de
edições substituídas quando houver); se o seu projeto rastreia seus arquivos `.mo`, adicione `'*.mo'`
a ele. As etapas de cache, o código de saída registrado e o `git pull --rebase` estão ali pelos mesmos motivos descritos
no workflow acima. Babel: `pybabel extract` + `pybabel update --no-wrap` antes do sync, `pybabel compile` depois dele.

O Flutter não precisa de nenhuma etapa extra neste job: o sync grava os arquivos `app_<locale>.arb`, e o
`flutter gen-l10n` (ou `flutter build`, que o executa) é a etapa de build do seu próprio aplicativo, na qual ele
os converte em Dart.

#### Formas plurais que um modelo omitiu {#plural-gaps}

Uma entrada marcada não é uma tradução, portanto o sync não a deixa sob responsabilidade apenas de uma pessoa:

- **Outro método ou modelo tenta novamente sozinho.** Um sync cuja configuração (método, modelo, registro, coaching)
  ainda não tiver respondido a essa entrada a enviará novamente ao modelo — não ao cache, que mantém a resposta
  incompleta. Assim, quando o modelo local de um desenvolvedor tiver omitido as formas, o modelo hospedado do job
  (`SYNC_FLAGS`) solicitará essas formas na próxima execução, e a estimativa incluirá o custo. O lock
  (`.champollion.lock`, sob `gaps`) registra cada configuração que respondeu sem as formas, para que uma
  execução local e uma do CI nunca fiquem alternando cobranças pela mesma resposta incompleta.
- **`sync --redo gaps` solicita novamente todas essas entradas**, independentemente de quem as omitiu — nos workflows
  acima, marque `redo_gaps` em **Run workflow**. Adicione `--model` a `SYNC_FLAGS` para usar um
  modelo mais robusto.
- **Se a nova resposta também não trouxer as formas, a entrada continua marcada** e a execução sai com `2`,
  como antes. Nesse caso, escreva as formas manualmente e remova a linha `# champollion:`.

Um dry run (`sync --dry`) lista as entradas que solicitaria novamente e estima o custo delas; seu resumo em
`--json` conta as que não seriam solicitadas (`totalPluralGaps`) e informa que a execução real sairia com
`2` por causa delas (`realRun.exitCode`).

## Outros métodos

Os trechos abaixo mostram a chave necessária para cada método e seu comando `sync`. Use-os **dentro** da
etapa "Sync translations" do workflow acima: troque seu `env`, insira as flags mostradas (`--method openai`, …)
na linha `SYNC_FLAGS` do workflow — para que a verificação de dry run execute o mesmo método — e mantenha o
restante da etapa (`id: sync` e as linhas que registram o código de saída), garantindo que uma execução
parcial ainda faça commit do que foi traduzido e salve o cache.

## Método Google Translate

Se estiver usando o método integrado do Google Translate em vez do OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Provedores diretos de LLM

Se estiver usando os métodos `openai`, `anthropic` ou `gemini` diretamente:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.6 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.6 sync --method deepl
```

## API de tradução remota

Se estiver usando um endpoint de tradução remota (por exemplo, um serviço de tradução hospedado):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Uma barreira (gate) antes do deploy

Para interromper o build com falha quando qualquer localidade estiver incompleta ou danificada, sem traduzir
nada, execute as verificações isoladamente.

:::warning[Execute o gate após a sincronização, não antes dela]
Se a tradução for executada apenas após o merge (como no workflow acima), um pull request que adiciona uma
string ainda não terá a tradução para ela, e `audit`/`verify` farão cada um desses PRs falhar.
Execute o gate onde as traduções já existem: na `main` após o job de sync (`needs: sync` ou
`on: workflow_run` do workflow de sync). Um gatilho `push` não é disparado nos commits do próprio bot
de sincronização — eles são enviados com `GITHUB_TOKEN`, que não inicia nenhum workflow (veja acima). Em pull
requests, execute apenas `lint` ou execute o job de sync primeiro na branch do PR.
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
      - run: npx --yes champollion@0.6 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.6 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.6 verify --strict
```

| Verificação | Comando | Falha quando |
|---|---|---|
| **Lint** | `lint` | O código-fonte contém strings que não estão em um arquivo de localidade — ou não encontrou arquivos de origem para verificar (ele lista as pastas onde procurou; aponte para outro local com `--src <dir>`) |
| **Audit** | `audit` | Uma chave está ausente, vazia ou ainda é um fallback `[EN]` — ou uma tradução está **desatualizada**: gerada a partir de um texto de origem mais antigo que o atual (uma edição na origem cuja retradução falhou) — ou uma mensagem plural não contém uma forma que o idioma usa para contagens comuns (em russo, `few`/`many`; as entradas com as quais `verify --strict` falha), indicando o comando para tentar novamente |
| **Verify** | `verify` | Uma tradução danificou um placeholder, plural do ICU, marcação (uma tag aberta, fechada ou aninhada de modo diferente) ou script — ou uma chave está ausente — ou um mesmo texto substitui várias strings de origem diferentes (um modelo repetindo uma frase memorizada) — ou não encontrou nada para verificar (o arquivo de origem ou a pasta de localidades não está onde a configuração aponta) |
| **Verify, strict** | `verify --strict` | Qualquer um dos itens acima, ou qualquer aviso |

`verify` sai com `1` em caso de erro e com `0` caso contrário. Avisos são
impressos, mas não fazem o job falhar: repetição da origem (source echo), duas localidades com texto idêntico,
uma tradução desatualizada, uma tradução que descartou o `?` ou `!` de fechamento da
origem (alguns idiomas marcam perguntas com uma partícula) e os avisos de plural abaixo. Um mesmo texto gerado
para várias strings de origem diferentes é um erro: duas strings de várias palavras claramente distintas respondidas
com o mesmo texto de quatro ou mais palavras, ou três ou mais nos outros casos. Isso é contabilizado nos valores
de chave, em cada variação de plural e nas páginas Markdown da localidade, pela regra com a qual o gate do
`sync` o recusa. `verify --strict` transforma qualquer aviso em falha. Use-o quando, por exemplo, formas
plurais em russo omitidas pelo modelo devam bloquear o deploy. Traduções desatualizadas são um aviso no
`verify` (a estrutura está intacta) e uma falha no `audit` (o gate de integridade/completude),
que imprime o comando para retraduzi-las.

As ocorrências de plural dependem de como o formato armazena os plurais:

| Formato | Erro (`verify` sai com 1) | Aviso (falha apenas com `--strict`) |
|---|---|---|
| Chaves com sufixo do i18next (`count_one`, `count_other`, …) | Uma forma que a localidade precisa está ausente (em francês, `count_many`): é uma chave ausente. | Uma chave para uma forma que a localidade não possui (em francês ou espanhol, `count_two`). `verify` imprime o comando que remove exatamente essas chaves, `sync --prune plural-extras`; o sync nunca as exclui sem ele. |
| Mensagens ICU (`{count, plural, …}` no next-intl, ARB, i18next ICU) | A estrutura do plural está danificada (uma variável, palavra-chave ou seletor traduzido, um `#` perdido). | Uma variação que a localidade usa para contagens comuns está ausente (em russo, `few`, `many`). Uma forma ausente usada apenas para números grandes (em francês, `many`, para 1.000.000) não é reportada. |
| gettext (`msgid_plural`) | Uma entrada sem tradução (vazia ou `fuzzy`): é uma chave ausente. | Formas `msgstr[]` que repetem a forma `other` quando o idioma possui uma forma própria para contagens comuns (marcadas com o comentário `# champollion:`). Mais linhas `msgstr[]` do que o `nplurals` do catálogo. As formas plurais são contadas pelo próprio cabeçalho `Plural-Forms` do catálogo. |

Uma forma do i18next traduzida a partir do texto de outra forma pode conter exatamente o texto daquela forma
(em francês, `count_many` igual a `count_other`). O francês pode escrever os dois da mesma maneira, portanto
isso nunca é um aviso. Quando o sync solicita uma forma ao modelo, ele registra isso no `.champollion.lock`, com uma
impressão digital (fingerprint) da resposta. `verify` lê apenas esse registro, portanto cada clone de um
commit obtém o mesmo resultado. O cache do seu laptop e um runner limpo do CI não entram em conflito. Um valor
sem registro (escrito manualmente, por outra ferramenta, por um mecanismo de tradução automática que não aceita
indicação da forma ou por uma versão mais antiga) recebe uma linha informativa com o comando para solicitar
novamente. `--strict` não falha por causa disso.
O verify checa a estrutura, não o significado: passar no teste indica que as chaves, placeholders, plurais,
marcação e escrita (script) estão intactos, não que o texto expressa a mensagem correta.

---

## Veja também

- [Referência da CLI](/docs/reference/cli) — referência completa de comandos
- [Como o Sync funciona](/docs/concepts/how-sync-works) — entenda a sincronização incremental
- [Memória de tradução](/docs/concepts/translation-memory) — cache e economia de custos
- [Métodos de tradução](/docs/guides/translation-methods) — seleção de método por par de idiomas
- [Quality Gate](/docs/concepts/quality-gate) — o que acontece quando traduções falham
- [Configuração](/docs/getting-started/configuration) — referência de configuração
