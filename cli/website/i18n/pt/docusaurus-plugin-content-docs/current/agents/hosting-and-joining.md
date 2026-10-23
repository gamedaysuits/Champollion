---
title: "Hospedar um teste selado e participar de um projeto"
slug: /agents/hosting-and-joining
description: "Duas formas de entrar além de construir: hospedar um teste selado com mt-eval contest e mt-eval node (funciona, ainda não está nos trilhos e as pessoas custodiantes escolhidas pela organização guardam as partes da chave) e participar de um projeto registrado com mt-eval project — cada comando, o que ele envia para onde e o que nunca mostra."
---

# Hospedar um teste selado e participar de um projeto

Duas vias ao lado dos trilhos de compilação. Ambas são comandos `mt-eval` comuns; nenhuma é uma etapa que o `champollion next` nomeia.

## Hospedar um teste selado

**Status honesto.**

- Funciona: preparar um conjunto selado, uma cerimônia de chaves, executar envios em um nó desconectado da rede, vereditos e classificação são todos comandos com testes.
- **Ainda não está nos trilhos.** `champollion new --kind task` é recusado; a única jornada é a do idioma. Espere um passo a passo manual mais longo e siga o [roteiro de execução do concurso](/docs/network/sovereignty/run-a-sovereign-contest).
- **As partes da chave ficam com os custodiantes indicados pelo organizador.** Nada no código os nomeia ou os avalia. Nenhum custodiante comunitário de chave foi indicado para qualquer teste.
- **O Champollion não retém nenhuma parte da chave e nenhuma chave privada.** A cerimônia é executada na máquina do organizador, e o registro envia apenas identificadores, digests e o limiar classificatório — nunca uma chave, uma parte ou as frases.

**Observação.** A hospedagem decide o que acontece com as frases das pessoas e quem pode desbloqueá-las. Cada etapa abaixo é decisão do organizador; execute cada uma apenas quando solicitarem.

### O que é criado

O `mt-eval contest prepare` divide o corpus do organizador:

| Flag | Conjunto | Quem visualiza |
|---|---|---|
| `--dev-size` (obrigatório) | O classificador: fonte e referências | Público, liberado de `<out>/public/` |
| `--secret-size` | O teste selado contra o qual o concurso está registrado | Ninguém: selado em `<out>/local/` |
| `--sealed-holdout-size` (precisa de `--secret-size`) | Uma segunda divisão selada, pontuada mas retida até o encerramento | Ninguém |

`--seed`, `--qualifier-threshold` (acima de 0) e `--license` são obrigatórios — nenhuma licença é presumida. `--custodian-group` e `--threshold-pubkey` são obrigatórios (a chave com a qual os conjuntos selados são criptografados). O texto em claro de cada conjunto selado é excluído após a selagem; o `<out>/local/manifest.json` armazena a receita e nunca sai da máquina. A selagem executa o `champollion network seal-corpus seal`, portanto a CLI do `champollion` deve estar instalada.

### Custódia

**Custódia por limiar (M de N).** No nó desconectado da rede:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

O `init` gera a chave, a divide com o esquema de Shamir e a zera em uma única chamada; ele grava o `ceremony.json` (o registro público) e um arquivo de parte por custodiante. `--set` deve ser o id do conjunto secreto e `--group` o `--custodian-group` que o prepare usará — o prepare não os verifica, e uma divergência só é encontrada quando uma execução é recusada. Passe ao prepare o registro da cerimônia: `--threshold-pubkey <ceremony>/ceremony.json`.

**Bloqueio.** Um conjunto selado é descriptografado apenas por `mt-eval node run-method <id> --offline --share … --share …` com pelo menos M partes de custodiantes distintos cujos IDs correspondam ao conjunto. A custódia por limiar é executada apenas nesta via offline.

**Chave única.** O `champollion network seal-corpus keygen --out <dir>` cria um par de chaves; quem tiver o arquivo de chave pode descriptografar sozinho. É o que a via de nó conectado utiliza.

### O passo a passo do organizador (custódia por limiar)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

O `node init --from-contest` define a custódia por limiar quando o conjunto foi selado com uma chave de cerimônia. Os participantes se qualificam no conjunto público de desenvolvimento (`mt-eval contest qualify`) and submit methods or models (`mt-eval contest submit-method`, `mt-eval contest submit-model`, ambos com um caminho `--offline --bundle-out`). O [guia do nó](/docs/network/sovereignty/sovereign-eval-node) contém todos os comandos de nós.

### O que precisa de conexão e de quem

| Funciona offline | Precisa de login | Precisa da chave de serviço do banco de dados |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (com `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, todo `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, `submit-*` online, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` sem `--no-register` ou `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, `node run-method` online, `node relay`, e `contest close` quando os resultados foram retidos |

A chave de serviço pertence a quem opera o banco de dados. Um organizador externo executa esses comandos em um banco de dados próprio (`MT_EVAL_SUPABASE_URL` e suas chaves) ou se restringe à via offline — cujas pontuações são verificáveis a partir de seus manifestos assinados, mas não entram no quadro público. **Observação.** Nunca defina `MT_EVAL_ALLOW_PROD`: isso suspende a recusa das ferramentas de gravar no banco de dados de produção padrão, e essa não é uma decisão de um agente.

## Participar de um projeto

Um **projeto registrado** é um projeto de idioma que seu proprietário listou para que outros possam ajudar com arquivos: frases, listas de palavras ou métodos (tempo de revisão e processamento computacional ainda não são oferecidos). Os comandos `mt-eval project` abaixo comunicam-se com o banco de dados do projeto (`MT_EVAL_SUPABASE_URL`). Todo subcomando, exceto `list` (anônimo) e `review` (do operador), faz login (uma sessão em cache, `MT_EVAL_REFRESH_TOKEN` ou um login interativo com GitHub ou Google); a conta é o e-mail usado no login.

**As regras.**

- **Revisado antes da listagem.** Um novo projeto começa como `pending_review`; ele só é listado após revisão. Um proprietário pode encerrar um projeto, sem nunca listá-lo.
- **O proprietário é identificado como escolher** (`--owner-name`). O registro do projeto não contém e-mail; a conta do proprietário é mantida separada, legível apenas por ele.
- **Nenhum e-mail na listagem.** `project list` é anônimo e mostra nomes e contagens; `project offers` exibe os colaboradores pelo nome que forneceram (`--as`). A conta do proprietário ainda pode ler o e-mail da conta do colaborador no registro da oferta, e a nota de consentimento registra ambas as contas.
- **As ofertas ficam registradas para ambos.** Aceitar cria uma nota de consentimento informando quem a enviou e quem a autorizou.
- **Nada do conteúdo de um arquivo é exibido.** Apenas nomes, contagens e estados.

### Proprietário

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` lê o par de `champollion.project.json` (e o propósito, a menos que `--purpose`); opcionais: `--slug`, `--domain`, `--register`, `--about`. No máximo 5 registros por conta a cada 24 horas.
- `ask` `--kind` é `sentences`, `word-list` ou `method`; as solicitações aparecem apenas enquanto o projeto estiver listado.
- `accept` baixa o arquivo, **verifica seu sha256** (recusado em caso de divergência), grava `inbox/offer-<offer id>-<file name>` e `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`, `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), e depois marca a oferta como aceita. O arquivo então entra como qualquer outro — `champollion data add inbox/<file>` — e os termos de seus detentores são solicitados.
- **Observação.** As `--terms` do colaborador estão na nota de consentimento. As respostas que você registrar com `champollion data mark` não devem flexibilizá-las.

### Colaborador

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` envia um arquivo não vazio de no máximo 50 MB para o armazenamento privado do projeto, com seu sha256, apenas para um projeto listado. No máximo 24 ofertas por colaborador a cada 24 horas.
- Uma oferta muda de estado apenas uma vez: `offered` → `accepted`, `declined` ou `withdrawn`.
- **Observação.** Retirar ou recusar altera o estado da oferta; isso não exclui o arquivo enviado do armazenamento. Avise isso antes que um colaborador ofereça algo que possa querer de volta.
- **Bloqueio.** `offer` lê o sidecar do arquivo antes de enviar qualquer coisa. Ele recusa um arquivo `local-only`, um conjunto `sealed` e um arquivo cujo `speakers_agreed` seja `not-yet` ou `some-said-no`; um sidecar ilegível interrompe a oferta. Não há como ignorar isso: cabe aos detentores alterar a marcação. Um termo `training: not-allowed` é adicionado aos termos da oferta, para que o proprietário o veja.
- **Observação.** Uma oferta envia o arquivo do computador do colaborador para o armazenamento do banco de dados do projeto. Pergunte ao colaborador e nunca ofereça um arquivo por ele.

`mt-eval project review` pertence ao operador do banco de dados (usa a chave de serviço). Não é um comando para agentes.

## Aprofunde-se

- [Hospedar um teste selado](/docs/host-a-sealed-test) e [Participar de um projeto](/docs/join-a-project) — as versões para pessoas.
- [Realizar um concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) e [o nó de avaliação soberano](/docs/network/sovereignty/sovereign-eval-node).
- [Transferência de titularidade](/docs/network/sovereignty/ownership-transfer) e [modelos de termos](/docs/network/sovereignty/terms-templates).
- [Regras de dados e transmissão](/docs/agents/data-rules) — conjuntos selados e arquivos apenas locais.
- [Referência do `mt-eval`](/docs/reference/mt-eval).
