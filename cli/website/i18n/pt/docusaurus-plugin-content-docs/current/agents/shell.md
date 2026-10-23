---
title: "Controlando os trilhos pelo shell"
slug: /agents/shell
description: "Cada etapa dos trilhos como um comando comum: instalar, iniciar um projeto, trazer dados, registrar seus termos, treinar e testar um modelo com o nmt-forge, executar as rodadas de melhoria, traduzir e servir com o mt-eval — além do modo offline, das variáveis de ambiente que as ferramentas leem e dos códigos de saída."
---

# Conduzindo os trilhos pelo shell

Cada etapa nos trilhos é um comando comum. Um agente sem MCP — ou uma
pessoa em um terminal — percorre os mesmos trilhos com três programas:
`champollion`, `nmt-forge` e `mt-eval`. A ordem nunca precisa ser
decorada: `champollion next` indica a próxima etapa, com seu modo e o
comando exato, lidos a partir dos arquivos do projeto.

As regras são as mesmas de quando se usa MCP. Uma etapa `confirm` só roda depois que a
pessoa diz sim; as respostas de uma etapa `ask_user` pertencem a ela
([o contrato](/docs/agents/contract)).

## Instalação

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Aviso.** Ambos baixam pacotes: modo `confirm` — pergunte primeiro. Se `uv
--version` falhar, a pessoa instala o uv a partir de https://docs.astral.sh/uv/;
um agente não baixa instaladores. O treinamento também precisa do extra de treinamento
do forge (PyTorch e Hugging Face transformers, várias centenas de MB). O forge indica
isso quando estiver faltando (estado `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

Os trilhos precisam do `nmt-forge` 0.3.0 ou mais recente; uma versão mais antiga é indicada com seu
comando de atualização (`uv tool install --upgrade --python 3.12 nmt-forge`).

## O loop

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` na saída legível para humanos é o modo: `run it` (`auto`), `pergunte primeiro, depois
execute` (`confirm`), `pergunte à pessoa que detém os dados — nunca responda por
ela` (`ask_user`), `aguarde, depois pergunte novamente` (`wait`), `uma pessoa faz isso`
(`human_only`). Execute o comando indicado e pergunte novamente. Sair dos
trilhos não tem problema — execute qualquer comando avançado, depois `champollion next`: a próxima etapa
é lida a partir dos arquivos.

## Início

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Os idiomas são códigos ou nomes, resolvidos por meio das fichas de idioma. Uma variedade
sem código recebe um código de uso privado (`qaa`–`qtz`) e o nome que seu povo
dá (`--target-name`, `--source-name`). **Aviso.** Confirme o sentido da tradução antes
que o projeto seja criado: `--dry` resolve ambos os idiomas e não grava
nada. Passe cada idioma exatamente como a pessoa o nomeou.

## Reunir e registrar os termos

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` lê `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, tabelas do Word `.docx`,
dicionários Toolbox e LIFT, ELAN `.eaf` e USFM
(`--usfm-source`). Ele grava `<stem>.tsv` e seu sidecar, deixa o original
intacto e exibe contagens, colunas e os números das linhas identificados pela verificação
das linhas (cópias, repetições, comprimentos incomuns, linhas invertidas ou deslocadas — nada
é removido) — nunca frases. Quando não consegue identificar qual coluna (ou camada ELAN,
por número, ou idioma LIFT) é qual, ele recusa e pergunta; pergunte à
pessoa. `--replace` lê o mesmo original novamente com outras colunas, mantendo
as respostas dos detentores; `--name <stem>` adiciona outro arquivo com outro nome.
Consulte as [regras de dados](/docs/agents/data-rules#what-tools-print-and-never-print).

Em seguida, os termos, um arquivo por vez, a partir das respostas da pessoa:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

`--local-only` ou `--may-leave` é obrigatório em um arquivo que ainda não seja somente local.
A etapa de termos da jornada pergunta sobre cada arquivo em `data/parallel/`,
`data/lexicon/`, `data/grammar/` e `data/monolingual/` até que tanto a resposta
sobre treinamento quanto `--speakers-agreed` sejam registradas. Todo valor pertence aos
detentores — consulte as [regras de dados](/docs/agents/data-rules) para saber o que cada um faz e
o que o comando recusa.

## Proteger o conjunto de teste

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Construir e testar um modelo

A jornada indica estes em ordem (com seus `{placeholders}` preenchidos a partir do
projeto):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` escolhe o modelo mais forte que este computador pode treinar em horas, pela memória dele ([treinamento](/docs/agents/training#models)). Com uma ficha do idioma, `--no-card --name` fica de fora.
- `data combine` é executado apenas quando `data/parallel/` contém mais de um arquivo. Ele mantém os termos mais rigorosos dos arquivos que combina e recusa arquivos cujos detentores ainda não responderam — se um modelo pode aprender com ele e se todas as pessoas cujas palavras estão nele concordaram.
- `prereg new` é uma etapa `ask_user`: `--expect` e `--rationale` são as palavras das pessoas, exatamente como elas disseram, escritas antes que exista qualquer pontuação. A pergunta não sugere nenhum número, e você também não.
- O tamanho de dev que a jornada preenche (`dev_n`) é um décimo dos pares selecionados, no mínimo 50 e no máximo 500; com menos de 200 pares, é um quarto deles, para que o treinamento fique com a maior parte — e isso fica abaixo de 50. Portanto: 40 frases de dev a partir de 160 pares, 50 de 200 a 500 pares, 160 de 1.600, 500 de 5.000 ou mais. Abaixo de 50, nenhuma rodada pode ser avaliada no conjunto de dev ([medição](/docs/agents/measurement#comparing-two-models)). `--near-dupe 0.6` mantém cópias quase idênticas de um lado só; `--max-group` é metade do tamanho de dev, arredondada para baixo, mais um.
- `floor` se aplica apenas quando `data/lexicon/` contém uma lista de palavras.

A partir daqui, o próprio orientador do forge indica cada etapa. `champollion next` a repassa;
`nmt-forge status` a diz diretamente:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

O treinamento é `confirm` (consome processamento, de minutos a horas); enquanto uma execução desvinculada treina, a etapa é `wait`. `nmt-forge run` recusa uma execução que o disco não comporta antes que ela comece (`[disk-room]`), informando o espaço livre, sua estimativa e o que `nmt-forge tidy` liberaria; `nmt-forge tidy --yes` o libera, e `--skip-disk-check` em `run` inicia mesmo assim, registrado na execução. Essas duas decisões cabem à pessoa, não a você ([treinamento](/docs/agents/training#disk-space)). A exportação pontua o modelo uma vez no conjunto de teste, em relação à previsão. Escolher entre várias exportações cabe à pessoa (`nmt-forge choose <model folder>`). Após uma pontuação no conjunto de teste, as pessoas avaliam a previsão delas:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` quando ela não se confirmou; `--prediction` é o número da previsão,
1 para um único `--expect`; `--by` indica quem a avaliou, conforme informado.) Consulte
[treinamento](/docs/agents/training) para ver todos os comandos e recusas do forge.

## As rodadas de aprimoramento

Depois que um modelo é disponibilizado para serviço, as rodadas começam:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: enquanto o conjunto de desenvolvimento (prática) tiver menos de 200 frases, algumas linhas não terão rascunho — uma em cada duas enquanto tiver menos de 50, uma em cada quatro a partir de 50 — e o falante as escreve. O `improve marks` as escreve em `data/dev/` e o `improve prepare` as adiciona ao conjunto de desenvolvimento (`nmt-forge grow-dev`), nunca ao treinamento. Ele também executa `nmt-forge draft-newer`. Quando há outro modelo — o mais novo treinado quando não estiver em uso (não colocado em uso após sua rodada: poucas frases para avaliar, nenhuma mudança mensurável ou pior) ou, após uma promoção, o modelo que o modelo em uso substituiu —, esse modelo gera o rascunho de metade aleatória das linhas com rascunho, sem identificação, e a chave fica ao lado da planilha (`sheet-key.json`). O `improve marks` então conta cada modelo separadamente — a comparação cega que, após uma promoção, é a verificação de que o relatório precisa antes de considerar um aumento como progresso real ([medição](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, a partir da rodada 2: uma linha para cada 10 frases novas (arredondado para baixo) é um rascunho que o falante marcou como `Y` ou `N` em uma planilha anterior, de volta sem identificação em um lugar aleatório. A primeira linha da planilha diz que algumas linhas retornam de propósito, nunca quais; o `sheet-key.json` as lista (`repeat_rows`). O comando exibe quantas retornaram, *"(quais não estão marcadas)"*, e que elas levam *"cerca de 10 segundos por linha, nunca mais usadas em treinamento"*.
- `improve marks` avalia uma linha exibida novamente apenas em relação à marcação anterior do falante — nunca na parcela da rodada, nos pares de treinamento ou na comparação cega —, grava `repeats` em `marks.json` e exibe *"Linhas exibidas novamente: o falante marcou A de J da mesma forma que antes (P%) — W antes erradas agora certas, R antes certas agora erradas. Não contabilizadas na parcela desta rodada e nunca mais usadas em treinamento."*
- `improve marks`, quando o outro modelo for o mais novo e o falante tiver avaliado pelo menos um rascunho de cada um, registra as contagens com forge (apenas contagens, nunca uma frase):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Quando a pessoa falante tiver marcado o modelo mais novo como correto com uma frequência claramente maior, ele exibe *"o forge registrou: ele oferece colocar o modelo mais novo em uso (as pessoas dizem sim primeiro)"*; quando o forge não estiver instalado ou recusar, ele informa que as marcações não foram registradas, e o motivo.
- `improve prepare` termina com `nmt-forge round-plan`: a rodada continua a partir do modelo em uso (4 passagens por todas as frases até o momento) ou treina desde o início, e informa o motivo ([treinamento](/docs/agents/training#the-improve-rounds)).

O Forge então avalia o novo modelo em relação ao que está em uso
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`), e oferece colocá-lo em uso (`confirm`) apenas se ele for mensuravelmente
melhor — ou, onde o veredito teve poucos dados para dizer (menos de 50 frases de dev)
ou nenhuma mudança mensurável, assim que as notas cegas do falante claramente o
preferirem. Um veredito por si só não coloca nada em uso: apenas o sim das pessoas (o
`nmt-forge export` e `nmt-forge choose` dessa etapa) faz isso. Os novos pares de `improve marks` recebem seus próprios termos primeiro — a
jornada pergunta. Como repassar o relatório: [coaching](/docs/agents/coaching).

## Traduzir e servir com mt-eval

`nmt-forge export` dentro de um projeto grava `deploy/<name>.json` (deployment/1).
O mesmo arquivo mede, traduz e serve:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Aviso.** `mt-eval run` em um arquivo de teste não precisa de pré-registro — ele apenas
  registra a leitura. Pontue o conjunto de teste por meio de `nmt-forge export` (ou depois que a
  previsão for registrada), nunca antes.
- `--gates gates/<chain>.json` adiciona uma cadeia de gates a `run`, `translate` ou
  `serve` (sem `--deployment`); `run` e `test` recusam uma cadeia que faça
  fallback. Consulte [métodos e gates](/docs/agents/methods) e
  [servindo modelos](/docs/agents/serving).

## Fora dos trilhos: o que existe para um idioma

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Verificar e atualizar os arquivos

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Offline

`CHAMPOLLION_OFFLINE=1` impede que a CLI do `champollion` acesse a rede:
as fichas de idioma vêm apenas do conjunto empacotado e do cache local (uma
ficha de cauda longa não é buscada), a atualização diária do cache de fichas é ignorada e
`register-corpus` não compara o hash de um arquivo com o catálogo público
(ele registra a comparação como não realizada). Isso não altera o que um método
envia: um método que chama um provedor ainda precisa da rede, e as
regras de transmissão continuam se aplicando.

`MT_EVAL_NO_REMOTE_REGISTRY=1` impede que o `mt-eval` busque seu registro de datasets
na web (para uma máquina isolada da rede).

O que precisa de rede nos trilhos de qualquer forma: instalar as ferramentas, o
extra de treinamento e o primeiro download de um modelo pré-treinado (`byt5-small` ou
`byt5-small-lowmem`, cerca de 1,2 GB; `cpu-tiny` não baixa nada).

## Variáveis de ambiente

Lidas pelo código, para uma pessoa operadora. As chaves de API do provedor são necessárias apenas para
métodos que chamam um provedor, nunca no caminho padrão dos trilhos.

| Variável | Lida por | Efeito |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | Servidor MCP | `rails` (padrão) ou `full` |
| `CHAMPOLLION_CLI_BIN` | Servidor MCP | O ponto de entrada do `champollion` a ser executado |
| `NMT_FORGE_BIN` | `champollion`, servidor MCP | O executável do `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, servidor MCP | Onde procurar por `nmt-forge` e `uv` após `PATH` (padrão `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: sem rede para fichas ou consultas ao catálogo |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | O cache de fichas por usuário (padrão `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Com que frequência o cache de fichas é verificado em busca de atualizações (padrão 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Fixa o preset escolhido por `auto` (deve ser o nome de um preset) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Porta padrão (8378 sem ela) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | O token bearer; obrigatório fora de loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: sem painel de treinamento ao vivo |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | O token bearer (nunca um valor de linha de comando) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | O token bearer para o próprio servidor da CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: sem busca no registro |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Onde os caminhos dos datasets registrados são resolvidos primeiro |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | A chave do provedor de modelo hospedado padrão |

## Saída para programas

| Ferramenta | Saída para máquina | Códigos de saída |
|---|---|---|
| `champollion` | `--json` nos comandos dos trilhos (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 recusado · 2 erro de uso |
| `nmt-forge` | `--json` em cada subcomando: um documento JSON no stdout, todo o restante no stderr | 0 ok · 2 recusado (`{"error": …}`) |
| `mt-eval` | `--json` e `--non-interactive` em cada subcomando | 0 ok · diferente de zero recusado |

Formatos de recusa: [o modelo dos trilhos](/docs/agents/rails-model#refusal-shapes).

## Aprofunde-se

- [A referência de comandos do `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) e
  [`mt-eval`](/docs/reference/mt-eval).
- [O modelo dos trilhos](/docs/agents/rails-model) — a jornada e `next --json`.
- [Conduzindo os trilhos por MCP](/docs/agents/mcp) — as mesmas etapas organizadas em seis ferramentas.
- [Treinamento com nmt-forge](/docs/agents/training) e
  [regras de dados](/docs/agents/data-rules).
