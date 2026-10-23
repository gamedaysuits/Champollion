---
title: "Regras de dados e transmissão"
slug: /agents/data-rules
description: "As regras que cada ferramenta do Champollion aplica aos dados das pessoas: o sidecar set/1 campo por campo, o local-only e seu padrão provisório, o treinamento não permitido, falantes e detentores que concordaram, o que cada ferramenta exibe e nunca exibe, os quatro modos de transmissão, os níveis de registro e as saídas do modelo como derivados."
---

# Regras de dados e transmissão

As pessoas que detêm os dados linguísticos decidem como eles são usados. Os
trilhos registram suas decisões ao lado de cada arquivo, e cada ferramenta
obedece ao que está escrito — com a posse e o controle comunitário dos dados
linguísticos como regra de design, não uma configuração. Esta página é o
conjunto de regras, com exatidão: o que cada campo faz, o que as ferramentas
recusam e as partes que somente você pode guardar.

## O sidecar (set/1)

Ao lado de qualquer arquivo de dados, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Chaves desconhecidas são recusadas; observações
ficam sob `x-`. Um sidecar escrito antes do set/1 (sem `$schema`) é lido como set/0
e permanece válido (`champollion upgrade` o reescreve).

| Campo | Valores | Efeito |
|---|---|---|
| `transmission` | `local-only` (o único valor) | Apenas um modelo neste computador pode ver o texto; toda ferramenta se recusa a enviá-lo para qualquer lugar (`mt-eval project offer` incluído) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | Para que serve o arquivo. `test` e `sealed` nunca são usados para treinamento |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | O que ele contém |
| `pair` | `{source, target}` | A direção em que suas colunas seguem, nos códigos dos cartões |
| `fields` | `{source, target}` | Qual coluna ou campo JSON contém qual lado |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: nenhum modelo pode ser treinado com ele |
| `terms.owner` | texto | Quem o detém, nas palavras do detentor |
| `terms.speakers` | texto | De quem são as palavras que ele contém, nas palavras do detentor |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Se as pessoas de quem são essas palavras concordaram |
| `terms.consent_record` | caminho | A nota de consentimento, relativa à pasta do arquivo |
| `holders_agreed` | `{by, date}` | Quem entre os detentores concordou que uma saída somente local pode ficar onde está (não afrouxa nada) |
| `derived_from` | caminho | O arquivo protegido a partir do qual este foi gerado; suas marcações foram trazidas para cá |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Gravado por `champollion network register-corpus`; um arquivo alterado (outro sha256) não recebe mais o ID do cartão |
| `written_by` | texto | O comando que o gravou |

**Bloqueio.** Um sidecar apenas torna um arquivo mais rigoroso: ele nunca
afrouxa o que um envelope de corpus ou uma entrada de registro diz.

## Somente local e o padrão provisório

`champollion data add` marca o arquivo que grava como somente local quando o
`defaults.transmission` do projeto é `local-only` (o que o `champollion new` grava), e
sempre para `--into test`. Essa marcação é a proteção da ferramenta até que os
detentores respondam, sinalizada como `"x-transmission-default": true`.

- A primeira resposta dos detentores decide. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` torna-o deles (o
  sinalizador é removido).
- **Nota.** A ferramenta não tem como saber quem executou o comando. Remova
  uma marcação provisória apenas com a resposta dos próprios detentores.
- **Bloqueio.** Uma marcação somente local feita pelos detentores não pode
  ser removida por nenhum comando: *"este arquivo está marcado como somente local,
  e um sidecar só fica mais rigoroso. Se ele pode sair deste computador é uma
  decisão dos seus detentores — se eles concordarem, edite o sidecar manualmente."*
- **Bloqueio.** `data mark` em um arquivo ainda não marcado como somente
  local precisa de `--local-only` ou `--may-leave`: *"se o texto deste arquivo
  pode ser enviado para um serviço de IA externo é uma decisão dos seus
  detentores, portanto nunca é presumido"*.

O que somente local significa em cada ferramenta:

| Onde | O que acontece |
|---|---|
| Qualquer avaliação (`mt-eval run`, pontuação do forge) | A política é resolvida para `sealed` (nível `local-only`): apenas um endpoint loopback, o próprio adaptador em processo do harness (`local-model`) ou um método externo executado com `--attest-local-transport` podem ver o texto |
| Saída no terminal e `--json` | Suas frases são retidas; números de linha, IDs, contagens e pontuações são exibidos em vez disso, com uma linha explicando o motivo |
| Arquivos extraídos dele | Divisões, cópias limpas, hipóteses e registros de execução mantêm o texto (ficam nas pastas da pessoa) e carregam a marcação em um sidecar próprio |
| Um modelo treinado com ele | Sua saída também é somente local (`forge-model.json` `trained_on.terms`; não registrado conta como somente local): `try_translation` retorna apenas a página do modelo, `champollion connect`, `mt-eval serve` fora de loopback e `mt-eval translate` fora do projeto precisam de `--holders-agreed-by`, e `sync` retém suas respostas, tanto pelo método `api` quanto pelo `local` ([disponibilização](/docs/agents/serving)) |
| Um arquivo de coaching ou dicionário | Um arquivo de coaching com um sidecar leva sua política para o prompt; as saídas de uma execução de léxico são retidas quando seu dicionário é somente local |

**Nota.** `--attest-local-transport` declara o endpoint de um método como local. Passe-o
apenas quando tiver verificado que o endpoint está nesta máquina: um endereço de
loopback pode ser um proxy que encaminha para qualquer lugar.

## Treinamento

- **Bloqueio.** O nmt-forge se recusa a treinar em um arquivo cujo sidecar
  indique `terms.training: not-allowed`; um sidecar ilegível conta como restrição,
  nunca como ausência dela.
- **Bloqueio.** O `champollion data combine` nunca junta um arquivo não permitido: ele
  o move, junto com seu sidecar, para `data/not-for-training/`. Ele recusa um
  arquivo cujos detentores ainda não responderam — sem `terms.training` ou
  sem `terms.speakers_agreed` (*"ninguém disse ainda se todos de quem constam
  palavras concordaram — o champollion perguntará às pessoas a seguir; combine depois"*) —
  e o arquivo combinado carrega os termos mais rigorosos entre os arquivos (somente local
  se um for, não permitido se um for, com todos os proprietários nomeados).
- **Bloqueio.** A etapa de termos da jornada só considera um arquivo em
  `data/parallel/`, `data/lexicon/`, `data/grammar/` ou `data/monolingual/` como respondido
  quando o sidecar contém tanto `terms.training` quanto `terms.speakers_agreed` (e a
  resposta sobre treinamento é a dos detentores, não a cautela da ferramenta
  descrita abaixo); até lá, ela pergunta novamente, e os trilhos não avançam.
- **Nota.** O nmt-forge lê `terms.training`, não `speakers_agreed`. Com um único
  arquivo de pares não há combinação, portanto apenas a etapa de termos aguarda
  essa resposta: nunca treine um arquivo cuja resposta dos falantes esteja ausente.
- **Bloqueio.** Um arquivo `test` ou `sealed` nunca é usado para
  treinamento: `--training allowed` é recusado para ele, e atribuir a ele outra
  função também é recusado.
- **Bloqueio.** `not-allowed` não pode se tornar `allowed` por comando
  (*"Se seus detentores concordarem com o treinamento, edite o sidecar manualmente"*) —
  com uma exceção abaixo.
- Escrituras (USFM) chegam com `terms.training: not-allowed` marcado por cautela da
  ferramenta (`"x-training-default": true`); a resposta dos detentores a substitui.

## De quem são as palavras e quem concordou

`--speakers` registra de quem são as palavras que o arquivo contém; `--speakers-agreed`
se elas concordaram.

| `speakers_agreed` | Efeito |
|---|---|
| `yes` | Treinamento conforme os detentores definiram |
| `not-yet` | O treinamento é forçado para `not-allowed` até que todos concordem; o arquivo aparece em `waiting_for_agreement` |
| `some-said-no` | Nenhum modelo pode aprender com o arquivo, nunca: *"remova as palavras deles para outro arquivo e marque o restante"* |
| (sem resposta) | A etapa de termos continua perguntando, e `data combine` recusa o arquivo (acima) |

**O único afrouxamento que um comando faz:** `not-yet` → `yes` junto com
`--training allowed`. Um arquivo que o `combine` havia separado retorna então para
`data/parallel/` na próxima combinação.

**Nota.** Faça a pergunta `waiting_for_agreement` uma vez por sessão, com gentileza, e
responda-a apenas com a confirmação da pessoa de que todos concordaram.

**`--holders-agreed-by "<who>"`** nomeia uma pessoa entre os detentores dos dados que
concordou que uma saída somente local pode ir para algum lugar específico: nos
arquivos de localidade de um aplicativo (`champollion connect`, registrado como
`holdersAgreed` do par), em um endereço alcançado por outras máquinas
(`mt-eval serve`, `nmt-forge serve`, informado em `/health`) ou em um
arquivo fora do projeto (`mt-eval translate`, registrado como `holders_agreed` do sidecar).
Não afrouxa mais nada: a saída permanece somente local para todas as ferramentas.
**Nota.** Passe apenas o nome que a pessoa forneceu a você.

## O que as ferramentas exibem e o que nunca exibem

| Ferramenta | Exibe | Nunca exibe |
|---|---|---|
| `champollion data add` | Contagens, colunas (letra, taxa de preenchimento, comprimento médio, proporção de letras latinas), uma célula de cabeçalho apenas quando nomeia um dos idiomas do par, camadas ELAN por número e os números de linha identificados pela verificação de linhas | Uma frase; qualquer outra célula de cabeçalho (seu tamanho em vez disso); o ID de uma camada ELAN |
| `champollion data mark`, `combine`, `next`, `validate` | Campos, contagens, estados | O texto de um arquivo de dados — elas nunca o abrem |
| `champollion improve …` | Contagens e porcentagens | As frases das planilhas |
| `champollion sync` (os métodos `local` e `api`) | As chaves cujo texto contém palavras que um modelo forge nunca viu no treinamento, a partir do `meta.unseen_words` do servidor | O texto ou as próprias palavras |
| `nmt-forge`, `mt-eval` | Para um corpus somente local, selado ou com consentimento necessário: IDs, números de linha, contagens, pontuações; `[sentence withheld]` dentro de mensagens de erro | Suas frases, em saída legível por humanos ou em `--json` |
| Ferramentas MCP dos trilhos | O que a CLI exibe, abreviado | Frases; a saída de um modelo somente local |

**Nota.** `--show-text` (nmt-forge; `mt-eval compare`) exibe frases retidas. Ele
serve para uma pessoa em seu próprio terminal, nunca para um agente — o que
você lê vai para o seu provedor de modelo.

**Nota.** Nenhuma ferramenta pode impedir você de abrir um arquivo. Nunca abra,
exiba, resuma ou cole os arquivos de dados, frases de teste, listas de palavras ou
planilhas das pessoas — nem o `input-words.json` de uma exportação: ele lista as palavras
de suas frases de treinamento e fica ao lado da pasta do modelo, nunca dentro dela
([disponibilização](/docs/agents/serving#what-an-export-holds)).

**A verificação de linhas.** Ao importar um arquivo (pares, um conjunto de testes
ou uma lista de palavras), o `data add` verifica suas linhas em relação às duas
próprias colunas do arquivo — sem dicionário, nada removido. Ele conta e indica
pelo número da linha:

- cópias: a tradução é a mesma frase de origem (um nome ou empréstimo linguístico
  não tem problema; caso contrário, a tradução está ausente);
- repetições de um par anterior;
- traduções muito mais longas ou curtas do que a proporção habitual do arquivo
  (cortadas ou duas frases em uma única célula);
- linhas que parecem invertidas: a origem soa como as traduções do arquivo, e
  vice-versa;
- sequências de linhas que parecem deslocadas em uma linha: suas traduções se
  ajustam melhor à linha seguinte ou anterior — números, pontos de interrogação e
  comprimentos se alinham a uma linha de distância, assim como as palavras: o
  grau em que as palavras de origem de uma linha encontram correspondências entre
  as palavras de uma tradução, pela frequência com que ambas ocorrem juntas no
  restante do mesmo arquivo (palavras mais raras têm maior peso; a própria linha é
  deixada de fora). Isso detecta um deslocamento em um arquivo de frases com modelo
  pré-definido, cujos comprimentos parecem todos iguais; não acrescenta nada quando
  as palavras do arquivo dizem pouco.

Ele exibe até 12 números de linha por tipo (até 6 sequências para linhas
deslocadas em uma) — em uma planilha, a linha no próprio arquivo da pessoa, contando
o cabeçalho — e registra as contagens em `x-import.quality` do sidecar. Verificações
de comprimento, inversão e deslocamento exigem pelo menos 20 pares; uma lista de
palavras (`--into lexicon`) recebe apenas verificações de cópias e repetições.
**Nota.** Repasse os números das linhas: as pessoas examinam essas linhas em seu
próprio arquivo e decidem. Nunca abra o arquivo para verificar por conta própria.

**Arquivos ELAN.** Quando o `data add` não consegue identificar qual camada
é qual (um lado não especificado por sinalizador, sem exatamente uma camada registrada
em seu idioma), ele recusa e lista as camadas por número, na ordem do arquivo:
`tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` para uma camada que faz referência a outra.
Passe os números como `--source-col` e `--target-col` (`champollion data add <file> --source-col <number> --target-col <number>`);
o sidecar registra os números (`x-import.elan_tiers`). Um número ou ID que não
corresponda a nenhuma camada é recusado (`no such tier — … Name a tier by its number`), assim como uma camada
cujo idioma registrado não seja o daquele lado. Duas camadas só são emparelhadas
quando uma faz referência à outra ou quando compartilham intervalos de tempo —
nunca por adivinhação. **Nota.** O ID de uma camada é o que o criador do arquivo
digitou e muitas vezes é o nome de uma pessoa, portanto o `data add` nunca o exibe.
A pessoa pode digitar o ID exato por conta própria; você passa o número.
Arquivos LIFT são combinados por seus códigos de idioma, arquivos Toolbox por seus
marcadores MDF (`\ge` e `\xe` são inglês pelo padrão).

## Modos de transmissão

Toda avaliação resolve seu corpus para um modo antes que qualquer coisa seja enviada
(`arena/mt_eval_harness/transmission_policy.py`), e o registra no log de execução:

| Modo | Quando | Modelos remotos |
|---|---|---|
| `cleared` | Uma licença liberada para redistribuição | Permitidos |
| `no-train` | Uma licença Creative Commons padrão não comercial ou sem derivações; ou um corpus não registrado que não declara licença | Apenas por canais que não treinam com as entradas: OpenRouter fixado em `data_collection: deny`, APIs diretas de fornecedores ou local. Uma garantia de não treinamento, não de não retenção |
| `consent-required` | Uma licença modificada, sob medida ou não informada (`LicenseRef-*`) | Recusados até que a entrada do conjunto de dados registre uma concessão de `transmission_consent` (`granted_by`, `date`, `scope`, `evidence`); local continua funcionando |
| `sealed` | Um segmento reservado ou padrão-ouro, um conjunto em quarentena ou uma marcação de somente local feita por um guardião | Recusados, sem possibilidade de sobreposição |

- **Bloqueio.** O texto de um corpus `consent-required` ou `sealed` também é
  retido no terminal.
- Um método externo (um plugin) em um corpus `no-train` gera um aviso, não
  uma recusa: o harness não consegue ver o canal do plugin. Em corpora `consent-required`
  e `sealed`, ele é recusado, a menos que `--attest-local-transport`.
- **Bloqueio.** O provedor local conta como local apenas quando seu endpoint for
  um endereço de loopback (`localhost`, `127.0.0.1`, `::1`, um socket unix) —
  nunca por causa de seu nome.
- **Nota.** Nunca registre uma concessão `transmission_consent` e nunca interprete uma
  licença em nome do detentor dos direitos. A concessão é registrada pelo guardião
  do conjunto de dados assim que o detentor dos direitos a autoriza.
- **Nota.** `--allow-data-collection` remove a fixação de não treinamento apenas para um
  corpus não registrado que não declare licença; ele declara que quem chama detém
  os direitos. Passe-o apenas quando a pessoa confirmar que detém os direitos.

## Níveis de registro

Registrar um corpus é opcional: os trilhos nunca exigem isso. Ele grava um
cartão de metadados para que o corpus possa ser nomeado, comparado e, se os
detentores quiserem, listado. `champollion network register-corpus` é interativo no terminal e
passível de automação via scripts com sinalizadores (`--tier`, `--data`, `--license`, `--name`, …).
**Nota.** O nível, assim como qualquer termo, é uma decisão dos detentores.

| Nível | O cartão | O texto | O que recusa |
|---|---|---|---|
| `local-only` (padrão) | Gravado ao lado do arquivo `--data` (ou `--out`, ou aqui), nunca na pasta compartilhada de cartões | Nunca sai deste computador; o sidecar recebe `transmission: local-only` | — |
| `private` | Metadados com `quarantine: true`; a partir de uma instalação npm, permanece local, e sua listagem é uma solicitação separada (`champollion network submit --type dataset`) | Nunca é enviado; sem marcação de transmissão — sua licença decide o modo | — |
| `public` | Metadados mais um apontador para buscar da origem (`--repo-url`, `--builder`) | Nunca é hospedado: é buscado em sua fonte de origem | Uma licença não comercial, sem derivações, restrita ou não confirmada (*"Em vez disso, registre como privado ou somente local."*); `--data` |
| `sealed` | Metadados com `quarantine: true` e um bloco selado (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Existe apenas texto cifrado, gravado em `<id>.sealed.json` ou `--seal-out` | Um arquivo que seja uma cópia exata de bytes de um corpus público; `--data` |

Em todos os níveis, nada é enviado no registro (`--json` indica
`uploadedContent: false`). A única chamada de rede, a partir de uma instalação npm,
compara o sha256 do arquivo com o do catálogo público neste computador (o hash
nunca sai); com `CHAMPOLLION_OFFLINE=1`, o cartão informa que a comparação não foi
feita. Com `--data`, o sidecar registra `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` e `registeredAt`. **Bloqueio.** Um ID
registrado nunca é gerado novamente: registrar o arquivo de novo sob outro ID é recusado,
e um arquivo alterado (outro sha256) não recebe mais o ID ou a nota do cartão.

## Saídas são derivados

A saída de um modelo sobre frases restritas é um derivado delas, e uma
avaliação gera essas saídas em escala. As ferramentas tratam as saídas da mesma
forma que tratam suas entradas:

- Para qualquer corpus que não seja `cleared`, a execução registra e exibe
  um aviso: suas predições são derivados gerados por máquina a partir de frases
  restritas, que não devem ser distribuídos.
- Onde o texto for retido (somente local, selado, consentimento necessário),
  todo arquivo gerado a partir dele — logs de execução, relatórios, comparações,
  entradas de cache, saída de `mt-eval translate`, lados divididos do forge, corpora
  limpos e hipóteses — recebe um sidecar set/1 trazendo a marcação (`derived_from`,
  `written_by`). Um corpus `no-train` recebe o aviso, mas nenhum sidecar.
- Um modelo treinado com texto somente local grava saídas somente locais (acima).
- `mt-eval publish` nunca envia as frases de um corpus somente local, mesmo com
  `--publish-entries`, e publica um prompt treinado apenas como seu hash, por padrão,
  para tal corpus. Para outros corpora, o prompt é publicado a menos que
  `--redact-coaching`.

**Nota.** A publicação é uma decisão das pessoas, tomada em suas próprias
palavras, com a prévia (`--dry-run`) exibida a elas primeiro. Nunca publique,
cole ou envie as saídas de uma execução em nome delas.

## Aprofunde-se

- [O contrato de operação](/docs/agents/contract) §1 e §3.
- [Suas palavras, suas regras](/docs/your-words-your-rules) — a versão das pessoas.
- [Registro de corpora](/docs/network/sovereignty/registering-corpora) — os
  níveis, com todos os sinalizadores.
- [Disponibilização e implantação](/docs/agents/serving) — saídas somente locais na
  prática.
- [Soberania de dados, em palavras simples](/docs/learn/data-sovereignty).
