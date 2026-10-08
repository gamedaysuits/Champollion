---
sidebar_position: 8
title: "Registrando Corpora e Exposure Lanes"
slug: /network/sovereignty/registering-corpora
description: "Registre um corpus de avaliação sem abrir mão dele. Os quatro níveis de exposição — apenas local, privado, público e selado —, as trilhas de licença que os acompanham e como o fetch-from-source mantém o conteúdo do corpus fora do nosso alcance."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Registrando Corpora & Exposure Lanes

> **Resumo executivo.** Você pode registrar um corpus de avaliação na Network para
> que os métodos possam ser avaliados em benchmarks com ele **sem nos entregar os dados**. Cada
> corpus é registrado como um *card de metadados* fixado por sha, não conteúdo — as
> frases reais são buscadas de sua fonte no momento da avaliação. Ao registrar,
> você faz duas escolhas independentes: um **nível de exposição** — quanto sai da sua
> máquina (`local-only`, `private`, `public` ou `sealed`, onde o corpus é
> criptografado no seu dispositivo sob uma chave de custodiante M-de-N) — e uma **faixa
> de licença**, que rege para o que o corpus pode ser usado (público, apenas pesquisa
> não comercial ou privado). Esse é o mecanismo que permite a uma comunidade tornar
> sua língua *mensurável* sem torná-la *extraível*.

A avaliação de tradução automática geralmente exige o oposto da soberania de dados:
"envie seu conjunto de teste para que possamos fazer score contra ele." Isso é inaceitável para
corpora de línguas indígenas e outras comunidades, onde os dados são propriedade
das pessoas de quem vêm. A Network foi construída para que você nunca precise fazer esse
compromisso.

---

## 1. Registro é metadados, não conteúdo {#1-registration-is-metadata-not-content}

Um corpus registrado é um **cartão**: um pequeno registro JSON descrevendo *onde* o
corpus está e *o que é*, com um hash de conteúdo para que os bytes exatos possam ser
verificados — mas **sem sentenças**. Um cartão contém:

| Campo | O que é |
|-------|-----------|
| `url` | Onde o corpus é buscado (o arquivo upstream que você controla) |
| `sha256` | Hash de conteúdo do arquivo fixado — prova que ninguém trocou os dados |
| `license` | Identificador SPDX (ou `LicenseRef-…` para uma licença personalizada) |
| `language_pair` | Origem → alvo, ex. `eng-crk` |
| `do_not_train` | Sempre definido — dados de avaliação nunca devem ser treinados |
| `attribution` | O crédito do construtor/linguista mostrado em todos os lugares onde o corpus aparece |

No momento da avaliação, o harness **busca da fonte**, verifica o `sha256`,
e faz score contra as referências recém-buscadas. A Network nunca armazena, hospeda,
ou redistribui o conteúdo do corpus. Se você tirar o arquivo upstream do ar,
o corpus simplesmente deixa de ser executável — o controle permanece com você. Esta é a
mesma disciplina de buscar-da-fonte aplicada a todo o catálogo (veja
[Evaluation Datasets](/docs/network/leaderboard/datasets)).

:::info[Por que um hash em vez de uma cópia]
Um hash de conteúdo permite que uma pontuação auto-relatada seja **verificada novamente** contra o corpus real e não modificado sem que nunca o possuamos. Uma execução cujos números não se reproduzem contra a fonte fixada pelo hash é rejeitada. Verificabilidade e não-posse não estão em tensão aqui — o hash é o que torna ambas possíveis.
:::

---

## 2. Duas escolhas distintas

O registro faz duas perguntas independentes, e vale a pena mantê-las
separadas porque elas protegem coisas diferentes:

1. **O que sai da sua máquina** — o *nível de exposição*.
2. **Para que seu corpus pode ser usado** — a *faixa de licença*.

Um corpus pode ser selado e não comercial, ou público e liberado comercialmente, ou
qualquer outra combinação. Um não implica o outro.

### 2a. Níveis de exposição — o que sai da sua máquina

Quatro níveis, definidos em `cli/lib/corpus-registration.mjs`. **O conteúdo em texto puro do corpus
nunca é enviado (uploaded) em nenhum deles** — isso não é uma configuração de política, é
verdade em todos os níveis. O registro sempre adota por padrão o mais privado.

| Nível | Registrado? | O que recebemos | Card rastreado |
|---|:---:|---|:---:|
| **Privado / somente local** | ❌ | Nada. O card e o texto permanecem na sua máquina. **O padrão.** | ❌ |
| **Registrar privadamente** | ✅ | Apenas metadados — um conjunto retido (held-out) secreto no estilo WMT. Você mantém a custódia; os resultados podem ser publicados sem expor os dados. | ✅ |
| **Registrar publicamente** | ✅ | Metadados + um ponteiro para busca na fonte (fetch-from-source). Seu texto é buscado do upstream sob demanda, nunca hospedado aqui. Requer uma licença autorizada para redistribuição. | ✅ |
| **Selado** | ✅ | Um card sem conteúdo. O texto criptografado permanece com você. | ✅ |

#### Mantenha um conjunto de testes longe de qualquer serviço externo de IA

Não fazer upload do seu texto é uma garantia. Não *enviá-lo* para a API de um modelo
enquanto você avalia é outra, e isso importa ainda mais para um conjunto de testes que
contém linguagem sensível. Marque o arquivo como somente local colocando um pequeno arquivo
ao lado dele, nomeado com o mesmo nome dele mais `.champollion.json`:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Isso funciona para qualquer formato de corpus (TSV, JSONL, pares em texto puro, JSON). A
partir de então, o `mt-eval run` trata o corpus como selado:
- com um provedor remoto (OpenRouter, OpenAI, Anthropic, Gemini), a execução é
  **recusada antes que qualquer texto seja enviado** e antes que qualquer chave de API seja solicitada;
- com `--provider local` apontado para um modelo nesta máquina (um endereço de
  loopback como `http://localhost:11434/v1`), a execução prossegue;
- com `--method local-model -m <model>` (um modelo NLLB, OPUS-MT ou MADLAD que
  o harness carrega em seu próprio processo; `-m` é obrigatório), a execução prossegue:
  nenhuma frase sai da
  máquina, e baixar os pesos transfere arquivos do modelo, nunca o seu texto;
- com um mecanismo de MT ou um plugin de método (`--method <plugin dir>`), a execução é
  recusada a menos que você ateste que o transporte dele é totalmente local
  (`--attest-local-transport`, registrado no log de execução): o harness não consegue
  ver para onde um plugin ou serviço envia texto;
- as métricas de avaliação próprias do idioma provenientes do card do idioma **não
  são carregadas**. Elas vêm de pacotes separados que podem consultar palavras em um
  serviço externo, como um dicionário online. A execução é pontuada sem
  elas, e o card da execução informa que elas foram retidas e o motivo;
- `mt-eval publish` retém as frases e, por padrão, substitui um prompt de
  orientação (coaching) ou personalizado pelo seu sha256, para que exemplos de prompt extraídos de
  suas próprias frases também permaneçam nesta máquina. Alguns metadados sobre o corpus
  tornam-se públicos com a pontuação: seu id, versão, par de idiomas, tamanho, o
  sha256 do arquivo, sua licença e atribuição, seu grau de contaminação, o fato de
  estar marcado como somente local e os nomes dos seus segmentos. Para um id que não seja um
  conjunto de dados registrado, a publicação também cria uma linha `datasets` pública com
  o mesmo id, par, tamanho e sha256, além de seu domínio, nomes de segmentos e
  faixa de dificuldade. A prévia de `--dry-run` lista isso para sua execução, ao lado
  do que permanece aqui: cada frase, o arquivo e seu caminho. Outras pessoas verão então uma
  pontuação em um conjunto de testes que não podem abrir. Ele é avaliado internamente (self-benchmarked), ninguém mais
  pode executá-lo novamente, e o sha256 permite apenas a quem possui o mesmo arquivo
  confirmar que se trata daquele arquivo;
- o que as ferramentas imprimem omite as frases, porque um agente de IA lendo
  o terminal repassa o que lê para o seu provedor de modelo. `mt-eval compare`
  mostra os IDs de entrada e pontuações em vez das frases, e uma mensagem de erro
  que citaria uma frase é exibida com ela removida. `--show-text` as imprime, para
  uma pessoa no terminal. Os arquivos gravados na sua pasta de resultados mantêm o
  texto, e cada um carrega a marca do corpus: todo log de execução, relatório,
  arquivo de comparação e painel que o harness gera a partir do corpus recebe seu
  próprio `.champollion.json` com os mesmos termos mais `derived_from`. A próxima
  ferramenta, ou uma execução posterior nesse arquivo, o tratará como protegido também. O
  terminal lista o nome de cada arquivo que contém o texto;
- o cache de tradução mantém as entradas deste corpus separadas: sob
  `<cache-dir>/protected/<namespace>/` (por padrão
  `eval/cache/harness/protected/…`), em um namespace indexado pelas configurações
  da execução, pelo sha256 do corpus e por seus termos, de modo que uma entrada só seja
  retornada para uma execução neste mesmo corpus — nunca para uma execução em outro ou em um
  corpus não marcado. Cada arquivo de cache ali carrega a mesma marca
  `.champollion.json`. (Entradas em cache antes de essa proteção existir ficam no cache
  comum sem marcação; exclua `eval/cache/harness/` uma vez para limpá-las.)

A marca só pode tornar um corpus mais restritivo. Nenhuma licença e nenhuma
flag `--allow-data-collection` pode flexibilizá-la. Se o arquivo marcador estiver
ilegível, a execução é interrompida em vez de ignorá-lo.

**Selado (Sealed) é a garantia mais forte que o sistema oferece.** Seu corpus é
criptografado **no seu dispositivo**, com a chave do grupo de custodiantes, e o texto criptografado
permanece na sua máquina ou no seu nó de avaliação. O Champollion recebe apenas o
card sem conteúdo. No nó offline, a chave é dividida de forma que são necessários
**M de N** custodiantes juntos para autorizar uma execução; essa cerimônia foi construída, mas
ainda não foi usada com custodiantes reais. Os conjuntos selados são catalogados, mas postos em quarentena, e são pareados com
um corpus *qualificador* público que um método deve superar antes que uma execução selada possa
sequer ser proposta. Consulte [Executar uma competição soberana](/docs/network/sovereignty/run-a-sovereign-contest) e o [Nó de avaliação soberano](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Faixas de licença — para que o corpus pode ser usado

Separadamente, a licença rege onde os resultados podem aparecer.

#### Pública

Um corpus com licença aberta (ex. CC0, CC-BY) cujas referências podem aparecer em
superfícies públicas e cujas execuções podem rankear no leaderboard público. O conteúdo ainda é
buscado-da-fonte — "public" governa *exposição de referências e rankings*, não
hospedagem. A maioria do catálogo (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) está nesta lane.

#### Apenas pesquisa não comercial

Um corpus sob uma licença não-comercial (ex. CC BY-NC-SA, ou uma licença
personalizada de comunidade/ONG como a `LicenseRef-TWB-Gamayun` dos kits Gamayun). Pode
ser **comparado para pesquisa** — métodos rodam nele, scores são computados —
mas é **excluído de todos os caminhos comerciais, prêmios e API.** A elegibilidade é
**baseada em uso**, não em corpus:

- a **lane comercial é rigorosa** — qualquer coisa não claramente licenciada comercialmente é
  excluída;
- a **lane de pesquisa é leniente** — corpora não-comerciais são bem-vindos;
- **quarentena sempre vence** — um corpus marcado como um subconjunto impróprio (ou
  de outra forma barrado) nunca pode rankear em *nenhuma* lane, independentemente da licença.

É assim que uma comunidade pode deixar seu corpus impulsionar o progresso da pesquisa enquanto o mantém
fora de qualquer produto.

#### Privada

Um corpus registrado para **suas próprias execuções com score**, onde as referências nunca são
publicadas. Você mantém a fonte; você executa a avaliação; você decide o que, se
algo, é alguma vez mostrado. Um corpus privado pode ser tornado público ou não-comercial
depois — a exposição apenas *se afrouxa* por uma decisão explícita e controlada pelo proprietário, nunca
silenciosamente.

| Faixa de licença | Permite benchmark | Referências exibidas publicamente | Pode ranquear no painel público | Na trilha comercial / de prêmio / API |
|------|:---:|:---:|:---:|:---:|
| **Pública** | ✅ | ✅ | ✅ | ✅ (se a licença permitir) |
| **Apenas pesquisa não comercial** | ✅ | depende da licença | apenas faixa de pesquisa | ❌ |
| **Privada** | ✅ (suas execuções) | ❌ | ❌ | ❌ |

:::note[A lane comercial é um guardrail, não um negócio]
Champollion em si é não-comercial — não há API paga ou produto por trás de nada disso. A lane comercial/prêmio existe como um guardrail *prospectivo*: registra, mecanicamente, quais corpora poderiam legalmente aparecer em um contexto de prêmio ou comercial, para que nenhum uso futuro — por qualquer pessoa — possa ultrapassar uma licença ou os termos de um curador.
:::

---

## 3. Garantias de soberania

O registro é projetado em torno da [posição de data stewardship](/docs/network/sovereignty/data-sovereignty).
Concretamente:

- **A possessão permanece com a fonte.** Mantemos um hash e uma URL, não os dados.
- **O controle é do proprietário.** A lane é escolha do proprietário, e a exposição apenas
  se afrouxa por uma decisão explícita. Tirar o arquivo upstream do ar revoga a executabilidade.
- **Não-comercial significa não-comercial.** Corpora NC são mecanicamente excluídos
  de lanes comerciais, prêmios e API — não por promessa, por gate.
- **Subconjuntos impróprios nunca podem rankear.** Quarentena sobrescreve licença, então um corpus
  barrado de rankear permanece barrado em todos os lugares.
- **Atribuição é obrigatória.** O crédito do construtor/linguista viaja com o cartão
  para todas as superfícies onde o corpus aparece.

Para como os termos por língua são definidos — incluindo transferência de propriedade de método para
prêmios patrocinados — veja [Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

---

## 4. Como registrar

O schema do cartão de corpus e as ferramentas de build/verificação são documentados em
[Corpus Design Framework](/docs/network/specifications/corpus-design) e no
[Corpus Creation cookbook](/docs/network/tutorials/corpus-creation). Em resumo:

1. Hospede o arquivo do corpus em algum lugar que você controla (ele fica lá — nunca é
   copiado para a Network).
2. Escreva um cartão: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Escolha a exposure lane (public / non-commercial / private).
4. Registre o cartão. Métodos agora podem ser comparados contra o corpus
   buscado-da-fonte, sob as regras da lane.

Você nunca envia as sentenças. Você pode parar a qualquer momento.

### O ID do card

O `champollion register-corpus` grava o card para você e atribui a ele um ID no
formato `eval-<source>-<target>-<name>[-<role>]-v1`:

- **name** vem de `--name`: "Ward phrases" torna-se `ward-phrases`. O
  publicador só é usado quando o nome não tem caracteres a–z ou 0–9, por
  exemplo, um nome escrito apenas em silábicos.
- **role** indica para que serve o conjunto: `--role test`, `--role dev` ou
  `--role train`. Ele só aparece no ID quando você o informa. A ferramenta nunca
  adivinha uma função (role), portanto, um conjunto de testes retido (held-out) só é chamado de conjunto de testes se você
  especificar.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Isso registra `eval-eng-xyz-ward-phrases-test-v1`. Para escolher você mesmo o
ID, passe `--id eval-…`; ele será usado exatamente como fornecido.

### Qual ID de licença para um conjunto de teste privado

`--license` registra os termos que as pessoas proprietárias dos dados realmente concedem. Não
é um placeholder, e a ferramenta não escolhe um para você. Pergunte a elas
primeiro (as famílias, os médicos/clínicos, o gestor de dados da comunidade) e, em seguida, escolha
o ID que reflete o que elas disseram:

| O que os proprietários concedem | `--license` |
|---|---|
| Eles já publicam o texto sob uma licença padrão | seu ID SPDX, por exemplo `CC-BY-NC-4.0` |
| Usar apenas para pontuar sistemas: nunca treinar com ele, nunca redistribuí-lo, nenhuma pontuação paga | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| O mesmo, mas a pontuação para usuários pagantes é permitida | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Nenhuma concessão além do uso próprio: todos os direitos reservados | `proprietary` (`LicenseRef-Proprietary`) |
| Termos próprios que nenhum desses contempla | `LicenseRef-<a name for their terms>`, digitado no estado em que se encontra, com os termos registrados onde o gestor os mantém |

Cada ID `LicenseRef-…` na tabela (as duas concessões de avaliação e
`proprietary` incluídos) é uma concessão sob medida: o Champollion nunca a lê em
nome dos proprietários. A avaliação remota com ele é recusada até que o gestor
registre sua permissão, portanto, apenas modelos na sua própria máquina são testados
com ele. Se você estiver em dúvida, a escolha mais conservadora que ainda permite
medir é `community-eval-grant-nc`; anote-o como provisório e
peça para o gestor confirmá-lo ou indicar o correto.

A licença não altera para onde as frases vão. Um conjunto somente local (o
marcador `.champollion.json`, ou `--tier local-only`) permanece na sua máquina,
independentemente do que sua licença diga: o marcador recusa qualquer modelo remoto, e uma
licença nunca pode flexibilizá-lo. A licença rege o que outras pessoas podem fazer com
o conjunto se ele for compartilhado algum dia, e em quais faixas de avaliação ele pode entrar. Quando um arquivo
tiver sido registrado com `--data`, seu ID será gravado no
arquivo `.champollion.json` ao lado dele e nunca mudará. Registrar esse arquivo
novamente interrompe a operação e solicita que você informe o ID com `--id`.

Para um conjunto de testes contra o qual um modelo pode ser treinado (`--role test`, ou um
conjunto somente local ou privado sem role), o comando exibe as
etapas do nmt-forge que devem ocorrer antes da primeira pontuação do conjunto: registrá-lo,
filtrar seu corpus de treinamento contra ele e registrar suas previsões.
A baseline `mt-eval run` vem depois delas. Um benchmark é uma leitura de pontuação,
e o nmt-forge recusa previsões gravadas após uma leitura.

O `mt-eval run --corpus <that file>` encontra o card por meio do mesmo
arquivo `.champollion.json`. O ID do conjunto de dados da execução é o ID do card, portanto, toda execução
no conjunto traz o mesmo nome, e o nome do arquivo permanece na execução como seu
caminho de corpus. O grau de contaminação do card é informado conforme o card o declara.
Ambos se aplicam apenas enquanto o arquivo for aquele que você registrou: se ele tiver
sido alterado desde então, a execução informará isso e não usará nenhum dos dois.

Um card `local-only`, `private` ou `sealed` indica que seu texto não foi publicado
(`Contamination: NONE`), portanto o registro primeiro compara o arquivo que você passa
com `--data` (ou `--seal-input`) com os corpora públicos. Um checkout
do repositório o compara com os cards de corpora que ele contém. Uma instalação via npm, que
não inclui cards de corpora, o compara com o catálogo público de corpora: a CLI
baixa os IDs e checksums dos corpora públicos e os compara na sua
máquina, para que o checksum do seu arquivo nunca saia dela. Quando o arquivo for byte a
byte um corpus público (mesmo sha256), o registro para e indica o nome daquele corpus.
Registre-o como público, use frases genuinamente privadas ou mantenha o
nível e declare a exposição com `--contamination` (o card registra então
que o texto é público). Um conjunto selado de texto público é recusado: ele não
testaria nada.

Quando nenhuma comparação puder ser feita (você está offline ou o catálogo não pode
ser acessado), o card é classificado como `Contamination: UNCHECKED`, e não `NONE`, a menos
que você mesmo defina uma classificação com `--contamination`. Registre novamente online para
compará-lo. `mt-eval` trata um corpus `UNCHECKED` como qualquer corpus que
não seja classificado como `LOW`: suas pontuações vão para a faixa exclusiva para comparação relativa. A
verificação compara arquivos inteiros, portanto, um conjunto público que foi editado ou reformatado não
é reconhecido; `mt-eval contest prepare` compara linhas.
