---
sidebar_position: 9
title: "Executar um Concurso Soberano"
slug: /network/sovereignty/run-a-sovereign-contest
description: "O caminho autossuficiente e completo para uma comunidade ou organização executar um concurso de MT contra seu próprio corpus isolado e reservado — sem que Champollion nunca tenha acesso aos dados ou ao prêmio em dinheiro."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Executar um Concurso Soberano

> **Resumo Executivo.** Uma comunidade ou organização pode executar um concurso
> de avaliação — incluindo um prêmio patrocinado — contra um corpus de teste
> retido que **nunca sai de sua própria infraestrutura**. Você constrói o
> corpus, criptografa-o, hospeda-o e mantém as chaves; a Rede registra apenas
> um cartão de metadados sem conteúdo e um resumo de texto cifrado. Os métodos
> se qualificam em corpora públicos primeiro; cada execução contra seu conjunto
> selado requer autorização de seus curadores; apenas **pontuações** saem. Os
> fundos do prêmio são **mantidos pelo patrocinador** — por sua organização ou
> um fundo que você designar — e **Champollion nunca toca no dinheiro ou nos
> dados.** Esta página é o guia de execução completo e de autoatendimento.

:::warning[O que está disponível hoje vs. em desenvolvimento]
Tenha clareza antes de começar — este é um projeto de pesquisa em evolução e não comercial, e preferimos que você nos verifique a confiar em nós:

- ✅ **Ativo:** registro de corpus (cartões de metadados, fixação de hash,
  vias de exposição), o registro de conjuntos selados (digest + grupo de custodiantes + qualificador, sem
  conteúdo), o mecanismo de concurso com a via selada, a camada de dados de
  solicitação/concessão/auditoria de autorização (pendente → decisão M-de-N → concessão de uso único
  com tempo limite, log de auditoria append-only encadeado por hash) e emissão restrita a pontuações
  imposta na camada do banco de dados.
- ✅ **Ativo: o nó de pontuação do organizador.** Um comando divide seu corpus
  em um conjunto público de dev (o qualificador no qual os participantes pontuam a si mesmos) e um conjunto
  secreto selado contra o qual seu nó executa as submissões, e sela a metade secreta em
  repouso na SUA máquina (`mt-eval contest prepare`). O registro do(s) conjunto(s)
  selado(s), do qualificador e do concurso é **autoatendido a partir do seu próprio login** —
  `contest prepare --self-serve` ou `mt-eval contest register --manifest`
  para um concurso que você preparou anteriormente — com cada linha vinculada a uma identidade na
  camada do banco de dados; sem nenhum curador no fluxo e sem chave privilegiada (consulte a Etapa 4
  para os limites francos).
- ✅ **Ativo: as submissões são MÉTODOS, não traduções.** A entrada em um concurso é feita
  entregando ao seu nó algo que ele possa EXECUTAR. Um participante pontua a si mesmo no
  conjunto público de dev (`mt-eval contest qualify`) para obter um recibo e, em seguida, envia um modelo
  ou um método; seu nó reexecuta a pontuação desse recibo em sua própria cópia
  do conjunto de dev antes que qualquer custodiante precise aprovar algo, e nega
  em caso de divergência. O nó escolhe a via a partir da submissão:
  - **Via A — modelo declarativo (preferencial).** Um modelo neural padrão é
    DADO: `mt-eval contest submit-model` envia pesos safetensors + um
    tokenizador declarativo + uma configuração — **sem código, sem Dockerfile.** Seu nó
    valida se ele é livre de código (safetensors, não pickle; sem
    `trust_remote_code`/`auto_map`; apenas arquivos de dados) e executa os pesos em
    seu PRÓPRIO motor confiável (`transformers`, `trust_remote_code=False`, offline).
    A arquitetura é permissiva por padrão (qualquer uma que seu motor carregue nativamente); um
    host cuidadoso pode fixar uma lista de permissões. Nada não confiável é executado, então
    não há nada para isolar em sandbox. Publicado como `declarative-model`, com identidade de método
    **livre de código por construção**.
  - **Via B — pacote executável (fallback com sandbox).** Para métodos que SÃO código:
    `mt-eval contest submit-method` envia um Dockerfile + ponto de entrada (entrypoint). Depois que seu
    custodiante aprovar, o SEU nó o executa dentro de um contêiner isolado da rede
    (`--network=none` — a pilha de rede não existe internamente;
    raiz somente leitura, permissões reduzidas, ambiente higienizado), com
    verificações estáticas automatizadas primeiro e referências que nunca entram no contêiner.
    Publicado como `method-execution` com identidade **verificada por execução**.
  Em qualquer uma das vias: o hash do pacote é congelado na solicitação de autorização (o que
  é executado é comprovadamente o que foi proposto), e as pontuações são publicadas pelo mesmo
  caminho restrito a agregados. Para isolamento máximo, a máquina de pontuação pode ser um verdadeiro
  airgap: solicitações autorizadas e pacotes contendo apenas pontuações assinados com Ed25519 cruzam via
  mídia removível (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  o texto secreto nunca chega sequer à máquina conectada. O que essas vias
  NÃO incluem ainda: atestação de hardware do nó (a identidade é autorrelatada),
  mecanismos formais de disputa e — especificamente para a Via B — endurecimento mais profundo do contêiner
  além da pilha de rede removida (perfis seccomp, microVMs; este
  é um motivo para preferir a Via A). Consulte
  [Limitações Francas](/docs/network/honest-limitations).
- ✅ **A camada de promessas está ativa (07/09/2026).** Declarações de submissão
  (primária/contrastiva, trilhas), fases de submissão, resultados retidos
  (`hidden_until_close`) e o congelamento que torna suas promessas declaradas
  ineditáveis assim que existirem submissões são impostos no banco de dados no
  endpoint hospedado na rede. Um host federado obtém as mesmas regras aplicando a
  migração fornecida com o harness; em relação a um endpoint mais antigo, o harness
  recorre ao conjunto base e avisa sobre isso (`declarations_available: false`)
  em vez de fingir. Onde uma etapa abaixo diz *o banco de dados congela /
  retém*, isso é literal.
- 🔲 **Em desenvolvimento: assinatura por limiar (threshold signing).** Para um conjunto selado com
  `champollion seal-corpus`, a aprovação do custodiante M-de-N é *registrada* nas
  tabelas de autorização e auditoria, e a chave de selamento é uma representação de
  par de chaves único rotulado (`champollion seal-corpus keygen`). Um conjunto selado no
  nó offline (`mt-eval node seal`) usa a **cerimônia de chaves**
  incorporada do nó (`mt-eval node ceremony`): a chave do conjunto é dividida em M-de-N e
  remontada apenas na memória durante uma execução autorizada por quórum. Essa cerimônia
  nunca foi usada com um custodiante real, e suas partes (shares) são arquivos comuns
  na v1. Nenhum dos caminhos possui *assinatura* por limiar: a assinatura do pacote de pontuação
  em airgap é uma chave de nó única (`seal-corpus sign-keygen`).
- ❌ **Não existe, por projeto:** o Champollion hospedar seu corpus, manter suas
  chaves ou reter fundos de premiação. O pacote de um participante (seu próprio modelo ou código)
  transita pelo nosso armazenamento a caminho do seu nó; o conteúdo do seu corpus nunca passa por lá.
- ❌ **Removido em vez de mantido como armadilha.** `contest submit-hypotheses` (descontinuado em 06/09/2026) enviava
  traduções de um conjunto cego com fonte pública; `contest submit` (descontinuado em 06/09/2026) vinculava uma pontuação
  que você mesmo publicou. Nenhum dos dois
  é mais um caminho de entrada no concurso. Uma rodada cega com fonte pública sobrevive apenas
  como um diagnóstico opcional do organizador, e as pontuações autorrelatadas ainda pertencem
  ao placar aberto — que é um painel público indexado por corpus e par
  de idiomas, não um concurso.

Se uma etapa abaixo depender de algo na lista 🔲, a etapa diz isso.
:::

---

## A forma do acordo

| Quem | Mantém | Nunca mantém |
|-----|-------|-------------|
| **Você (comunidade/org)** | O corpus, as chaves de criptografia (via seus curadores), os fundos do prêmio, a decisão de premiação | — |
| **Champollion / a Rede** | Um cartão de metadados, um resumo de texto cifrado, o registro de autorização + auditoria, as pontuações publicadas | O conteúdo de seu corpus, suas chaves, seu dinheiro |
| **Desenvolvedores de métodos** | Seu método | Seus dados de teste — eles veem pontuações, nunca sentenças |

Tudo abaixo é a expansão mecânica dessa tabela.

---

## Pré-requisitos do organizador

Antes da Etapa 1, saiba o que executar o lado do nó realmente exige:

- **O harness com seu extra de nó:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 ou posterior; use
  `python3 -m pip`, que funciona em qualquer ambiente em que o harness seja executado —
  um `pip` avulso não está no `PATH` em todo ambiente virtual). O extra `[node]`
  adiciona a biblioteca `cryptography` usada por `mt-eval node keygen`,
  pela cerimônia de custodiantes e pela assinatura do manifesto de pontuações. Um
  `python3 -m pip install mt-eval-harness` simples não a possui, e esses comandos são interrompidos indicando
  essa instalação.
- **docker ou podman** — obrigatório para a via de execução de métodos. O nó
  detecta automaticamente o docker e, em seguida, o podman (`sandbox.runtime` em `node.json` é `null`
  por padrão; defina um deles lá para exigi-lo). Se nenhum estiver no `PATH`,
  `mt-eval node run-method` recusa com uma linha indicando ambos, antes de executar
  qualquer coisa, e a solicitação é mantida como estava para que você possa executá-la assim que um
  runtime for instalado. Não há **nenhum fallback**. O isolamento de contêiner com
  `--network=none` é a garantia estrutural essencial, de modo que nada roda sem um
  runtime de contêiner.
- **Node.js 20.11+ e a CLI npm `champollion`** — o harness não
  reimplementa a cifra de selamento. `champollion seal-corpus` (verbos: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) é a única
  implementação de cifra (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), e o nó do organizador
  faz chamadas de shell para ela.
- **Uma configuração de nó em `~/.mt-eval/node.json`.** Todo comando `mt-eval node`
  recusa-se a iniciar sem ela. `mt-eval node init` grava uma configuração inicial
  lá (`--print` apenas a exibe). Ela contém seu `node_id` autorrelatado
  (vinculado à impressão digital de cada solicitação) e um mapa `contests` apontando para seu
  conjunto de dev, seu conjunto selado (`secret_set_id` + `secret_artifact`), seu conjunto de
  retenção selado se você preparou um (`holdout_set_id` + `holdout_corpus`; exclua
  ambas as chaves se não preparou) e a porta de entrada do qualificador público (`qualifier` +
  `dev_corpus`, o limiar na escala de 0–100 do qualificador). Depois de executar
  `contest prepare` (Etapa 1), `mt-eval node init --from-contest ./mytask`
  grava a configuração inicial com os valores do concurso já preenchidos a partir de
  `./mytask/local/manifest.json` e lista o que resta para você preencher. O mapeamento
  que ele aplica (preencha manualmente se preferir):

  | `local/manifest.json` | `node.json` (em `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (ambos removidos quando não há conjunto de retenção) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (mesmos nomes) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: a cópia que `contest prepare` leu (`--test-suite <id>=<path>` ou uma que encontrou), quando ela está nesta máquina com os bytes fixados; caso contrário, você define `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` para um conjunto selado para um par de chaves (depois defina `secret_privkey`), `threshold-quorum` para uma cerimônia |
  | `registration.prize_terms` (registrado por `contest prepare` e `contest register`) | `prize_terms_sha256`: o SHA-256 dos termos, o hash que os participantes passam para `--accept-terms` (omitido quando o concurso não declara prêmio) |

  O id do concurso é o `--slug` que você forneceu a `contest prepare` (`mytask` no
  exemplo abaixo). O prepare o registra no manifesto, o registro cria
  o concurso sob ele, e esse é o id que os participantes passam para `contest qualify`
  e `submit-method`, portanto anuncie-o com a versão de dev; `--contest-id`
  o substitui. (Um manifesto gravado antes do id ser registrado mantém o id
  que o registro derivou de seu nome, `"My Task 2026"` → `my-task-2026`,
  pois é isso que seu concurso, recibos e configurações de nó já usam.) Nenhum
  manifesto conhece `node_id`, `cards_dir`, `signing_key` ou seu arquivo de chave privada,
  portanto estes permanecem como `<...>` para você preencher.
  `mt-eval node ledger verify` então verifica isso e informa o que verificou: ele
  carrega a configuração (custódia, todo o controle do qualificador, o par de retenção, o
  índice local de cartões), recusa o primeiro valor que ainda seja um espaço reservado `<...>`
  ou um arquivo declarado que não esteja nesta máquina, imprime os conjuntos e arquivos de cada
  concurso e só então reproduz a cadeia de hashes do livro-razão de autorização
  (zero entradas em um nó novo).
- **Um índice local de cartões de idiomas mantido pelo nó.** A pontuação especifica o par
  de idiomas da execução, e o nó nunca consulta um idioma pela rede.
  Aponte `cards_dir` em `node.json` para um diretório contendo um cartão para cada
  idioma que seu nó pontua (ou defina `MT_EVAL_CARDS_DIR`); um nó sem índice local
  recusa-se a iniciar em vez de buscar um pela rede. Nenhum dos pacotes
  instalados traz um diretório de cartões por idioma, portanto gere um em uma máquina
  conectada com a CLI `champollion`, um arquivo `<code>.json` por idioma
  do seu par:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Em seguida, defina `"cards_dir"` como o caminho absoluto desse diretório. Para um
  nó isolado (air-gapped), transporte-o no pacote offline
  (`mt-eval node bundle --out <dir> --include node-cards`); ele será colocado em
  `<dir>/artifacts/node-cards`, e `cards_dir` apontará para lá no nó.
- **Um login.** Não há uma etapa separada de criação de conta: o primeiro comando
  que precisa de uma identidade (por exemplo, `mt-eval contest prepare --self-serve` ou
  `mt-eval publish`) abre um login OAuth no navegador via **GitHub ou Google**
  (Supabase Auth). O e-mail dessa conta é a identidade à qual cada linha do registro é
  vinculada — use um que sua organização controle.
- **O controle de admissão (throttle).** As submissões dos participantes têm taxa limitada por
  autor em **5 a cada 24 horas por padrão** (anti-probing; definido por concurso
  com `--intake-daily-limit` no momento do prepare, ou como padrão de edição
  de tarefa compartilhada). Planeje o cronograma do seu concurso considerando isso.

**Uma ressalva franca sobre o registro autoatendido.** No **endpoint padrão
hospedado na rede**, o registro autoatendido (`contest prepare
--self-serve` / `contest register`) atualmente é bloqueado por uma
proteção de endpoint de produção: a CLI recusa com uma mensagem explícita em vez de gravar no
projeto de produção, aguardando uma decisão de política sobre a abertura desse acesso. Hosts
federados (seu próprio projeto Supabase) não são afetados. Se você encontrar essa proteção
no host padrão, esse é o estado atual das coisas, não uma
má configuração do seu lado — [abra uma issue](https://github.com/gamedaysuits/Champollion/issues)
e nós o guiaremos pelo processo de registro.

---

## Etapa 1 — Construir seu corpus de teste retido

Projete o corpus que você medirá e mantenha-o retido desde o primeiro dia:
nada nele deve ter sido publicado, postado ou compartilhado com um provedor de
modelo.

- Siga o [Corpus Design Framework](/docs/network/specifications/corpus-design)
  para estrutura de entrada, níveis de dificuldade e cobertura de registro, e o
  [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) para
  ferramentas.
- Tenha entradas verificadas por falantes fluentes antes de selar — o
  [Speaker Validation Protocol](/docs/network/specifications/speaker-validation)
  descreve uma estrutura de revisão que você pode reutilizar para QA de corpus,
  não apenas revisão de método.
- Decida o rótulo de **versão** do corpus agora (por exemplo, `v1`).
  As concessões de autorização são vinculadas a uma versão específica, então o
  versionamento faz parte do modelo de segurança, não da contabilidade.

### Como o corpus é dividido

Um único comando recebe seu corpus principal e produz cada nível, de forma determinística
a partir de uma semente que você escolhe e registra:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` é a pontuação que um método deve atingir no conjunto público de dev
antes que seu nó o execute no conjunto selado e no conjunto de retenção selado. Está
na **escala de qualificador de 0–100**: a pontuação do qualificador é o **chrF++ do corpus**
(sacreBLEU chrF, `word_order=2`) das saídas de dev contra as referências
liberadas de dev — a métrica principal do padrão de pontuação e o mesmo número que um
cartão `mt-eval run` destaca para as mesmas saídas. Nada mais é misturado
a ela; a correspondência exata (exact match) é exibida ao lado como diagnóstico e nunca barra. Seu
nó calcula o mesmo número quando reexecuta um método, de modo que o recibo de um
participante e a medição do seu nó sejam comparáveis.

Defina o limiar a partir de pontuações chrF++ que você mediu neste conjunto de dev (execute
`contest qualify` nas saídas de dev de uma linha de base), não a partir de pontuações em outros
conjuntos de avaliação: os níveis de chrF++ variam muito entre idiomas e corpora.
Um qualificador registrado antes do
[padrão de pontuação](/docs/network/specifications/scoring#how-runs-are-scored)
com o índice composto descontinuado como métrica ainda funciona: seu limiar é lido
na escala chrF++, e o qualify avisa isso a cada vez, portanto confirme o número ou
faça a rotação para um novo qualificador.

`--license` é obrigatório. Ele define a licença sob a qual o conjunto liberado de dev é oferecido,
e o mt-eval nunca escolhe uma por você. O arquivo liberado a transporta como
`dataset.license`, que é o que `mt-eval run`, `contest qualify` e
`publish` leem, de modo que as execuções de um participante são controladas pela sua licença. Use a própria concessão
do detentor dos direitos como um id SPDX. Com `CC-BY-4.0`, os participantes podem avaliar com qualquer serviço de modelo.
Com uma licença não comercial, como `CC-BY-NC-4.0`, modelos remotos são executados apenas
por canais sem treinamento. Com seus próprios termos (`LicenseRef-<name>`), a avaliação
remota é recusada até que a permissão do detentor dos direitos seja registrada, fazendo com que
os participantes usem modelos locais.

Os arquivos liberados também informam os outros termos do corpus principal, lidos a partir do
próprio cartão do corpus principal (o cartão de corpus que `champollion network register-corpus`
gravou, por meio de seu sidecar `<file>.champollion.json`) e de seu próprio envelope:
`dataset.do_not_train` e, quando o principal estiver marcado como apenas local,
`dataset.transmission: "local-only"` (os participantes poderão então executar o conjunto de dev apenas
com um modelo em sua própria máquina), com `dataset.terms_from` indicando de onde
cada um veio. Quando o cartão do principal não indicar um termo de treinamento, passe
`--do-not-train true` ou `false`; a flag pode restringir o termo do principal,
nunca flexibilizá-lo (`--do-not-train false` em um principal `doNotTrain: true` é
recusado). O prepare imprime esses termos e avisa quando o cartão do principal diz
que a redistribuição é proibida: liberar `public/` é redistribuição, portanto
não o libere até que o detentor dos direitos concorde.

| Divisão | Quem vê | Para que serve |
|---|---|---|
| **Conjunto público de dev** (`--dev-size`) | todos — fonte *e* referências são liberadas | o **qualificador**: os participantes pontuam a si mesmos nele antes de poderem submeter algo (Etapa 8) |
| **Conjunto selado** (`--secret-size`) | ninguém além do seu nó — fonte *e* referências permanecem criptografadas | o que uma submissão realmente pontua |
| **Conjunto de retenção selado** (`--sealed-holdout-size`, opcional) | ninguém além do seu nó | uma **segunda** divisão selada, pontuada na mesma execução, com suas pontuações retidas até que você encerre o concurso |
| *Conjunto cego* (`--blind-size`, padrão 0) | fonte liberada, referências retidas | uma rodada de diagnóstico opcional própria. **Não** é um caminho de entrada: entra-se em um concurso entregando um método, nunca fazendo upload de traduções |

As divisões são disjuntas e reproduzíveis: mesmo corpus, mesma semente, mesma divisão,
para sempre. A receita permanece em um manifesto local do organizador que nunca sai da
sua máquina.

**Sentenças repetidas ficam do mesmo lado.** A divisão é disjunta por grupos
(`group-disjoint/1`, registrada no bloco `split` do manifesto): linhas que compartilham
uma fonte ou uma referência, exatamente ou após normalizar maiúsculas/minúsculas, pontuação e
espaçamento, formam um grupo, e um grupo vai inteiro para uma única divisão. Portanto, nenhuma
linha selada repete uma linha do conjunto liberado de dev. Os grupos são embaralhados com sua
semente e alocados em dev, cego, secreto e retenção, nessa ordem; um principal sem
sentenças repetidas obtém exatamente a divisão que um embaralhamento linha por linha resulta. Se os grupos
inteiros não conseguirem preencher os tamanhos solicitados, o prepare recusa, informando o número
de linhas repetidas e a solução: remova as repetições (mantenha uma linha de cada grupo)
ou peça um total abaixo do tamanho do principal para que alguns grupos possam ser deixados de fora.

**`public/` pode ser liberado; os logs de execução vão para `runs/`.** O prepare grava um arquivo
marcador, `.champollion-releasable.json`, em `public/`. Logs de execução, relatórios e
caches de tradução nunca são gravados lá: `mt-eval run` recusa um
`--output-dir` ou `--cache-dir` dentro dele e aponta para `runs/` ao lado
(`<out>/runs/`), e o `run_benchmark` do servidor MCP coloca uma execução no
conjunto liberado de dev (a linha de base que você executa para definir o limiar) em `runs/`
automaticamente e informa isso. Um concurso preparado antes de o marcador existir é
reconhecido por sua estrutura (`public/` ao lado de `local/manifest.json`).

**Por que um conjunto de retenção.** Um único conjunto selado ainda pode ser alvo de ajustes (tuning) ao longo de um
concurso longo — cada submissão funciona como uma sondagem, e sondagens suficientes vazam um pouco de informação. Uma segunda
divisão que é pontuada na mesma execução autorizada, mas cujos números ninguém vê
até o encerramento, oferece uma leitura limpa no final: se a posição de um sistema mudar entre
os dois, você descobre o quanto foi ajuste fino e o quanto foi capacidade real de
tradução. Ambos os conjuntos são cobertos por **uma** única autorização, portanto não custam
cerimônias extras aos seus custodiantes.

**Suítes de teste de terceiros.** `--test-suite` define um corpus de diagnóstico público —
de outra pessoa, com hash fixado e disponível publicamente para download — no qual cada submissão também
é executada. Esses números são **relatados e nunca ranqueados**: eles existem para que
o leitor possa ver se uma pontuação alta no conjunto selado também se sustenta em um conjunto que o seu
concurso não concebeu. O Champollion recusa uma suíte que esteja em quarentena,
sem hash fixado, que não seja para o seu par de idiomas ou que seja uma de suas próprias divisões.

**Uma linha selada que já é pública não está selada.** `contest prepare`
compara seu conjunto selado e o conjunto de retenção selado com tudo que for público: o conjunto de
dev liberado (a divisão disjunta por grupos acima mantém isso em zero), a
liberação da fonte cega, se houver, e cada suíte de teste declarada. Ele compara
exatamente e após normalizar maiúsculas/minúsculas, pontuação e espaçamento (a mesma
comparação pela qual a divisão agrupa), depois imprime cada sobreposição com uma contagem (por
exemplo, "30 de 30 linhas também aparecem na suíte de testes...") e registra as contagens
em `local/manifest.json`. Para uma suíte de terceiros, ele avisa em vez de
recusar: a suíte é um texto público de outra pessoa, e você decide se
remove essas linhas do principal ou descarta a suíte, preparando tudo novamente. Para verificar uma suíte, o prepare precisa de suas
sentenças. Ele usa uma cópia que já esteja em sua máquina e nunca faz download
durante a preparação. Indique sua cópia com `--test-suite <id>=<path>`; seu
sha256 deve corresponder ao fixado no registro. Se nenhuma cópia for encontrada, o aviso dirá
que a suíte **não foi verificada**, nunca que ela estava limpa. O manifesto registra
o caminho de cada cópia lida pelo prepare, para que `node init --from-contest` possa apontar
seu nó para ela.

Seu conjunto de retenção e as suítes declaradas tornam-se promessas: assim que a primeira submissão chega,
o concurso os congela, impedindo a adição ou remoção de uma suíte de teste no meio do concurso.

## Etapa 2 — Criptografe-o e hospede-o em SUA infraestrutura

Criptografe o corpus em repouso (qualquer esquema AEAD moderno — por exemplo,
`age`/x25519 ou AES-256-GCM) e hospede o **texto cifrado** em algum
lugar que você controle. Champollion nunca recebe o texto simples *ou* o texto
cifrado.

Publique exatamente um artefato: o **resumo SHA-256 do blob de texto cifrado**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

O resumo é público; os dados não são. Qualquer pessoa pode depois verificar que
o blob avaliado é idêntico em bytes ao blob que você selou — integridade sem
posse. Esta é a mesma disciplina de hash-em-vez-de-cópia que o
[registro de corpus ordinário](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Etapa 3 — Registre o cartão de metadados

Registre o corpus através da
[pista de registro](/docs/network/sovereignty/registering-corpora) padrão e
fail-private: um cartão com `language_pair`, `license`, `attribution` e
`do_not_train` — **sem sentenças**. Escolha a pista de exposição **privada**; o
registro de conjunto selado na próxima etapa é o que o torna elegível para
concurso.

## Etapa 4 — Registre-o como um conjunto selado

Um conjunto selado é uma entrada de registro sem conteúdo que coloca três
coisas no registro público:

| Campo | O que o compromete |
|-------|------------------------|
| `ciphertext_digest` | Os bytes exatos que contam como "o corpus" |
| `custodian_group_id` | Um id opaco para o grupo que controla o acesso (nunca um nome público de org/nação antes do consentimento) |
| `current_qualifier_id` | A rodada pública que um método deve limpar antes que uma execução selada possa ser proposta |

O registro é **autoatendimento, a partir de seu próprio login** — nenhum curador
no processo e nenhuma chave privilegiada:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

O manifesto fica na sua máquina — o registro envia apenas os
ids, digests e limiares sem conteúdo. Você pode ler exatamente o que ele envia antes
que qualquer coisa saia: `contest prepare --no-register` imprime o plano de registro,
cada linha que `contest register` gravará, em ordem — o id de cada conjunto selado e
o SHA-256 do seu texto cifrado (com a quantidade de linhas que permanecem seladas na sua máquina),
o grupo de custodiantes, o id do qualificador e o limiar, a linha do concurso com suas
promessas registradas, as colunas de política e qualquer retenção, suítes de teste e termos
de premiação mesclados aos metadados do concurso. O plano é construído pelo mesmo código
que envia as linhas, portanto não pode descrever algo diferente do que é enviado.
Cada linha do registro é **vinculada a uma identidade**: o
banco de dados registra a conta conectada que a cadastrou e congela essa
vinculação contra edições posteriores, e um qualificador só pode controlar um conjunto selado que a
**mesma** identidade registrou. Conjuntos selados nascem em quarentena (nunca podem
embasar um concurso comum nem ranquear no placar público), qualificadores são
criados em estado seguro e o registro tem taxa limitada — tudo imposto por
triggers de banco de dados abaixo de qualquer cliente, incluindo o nosso. O próprio registro pode
ser lido publicamente, para que você possa verificar se sua entrada reflete exatamente o que você selou —
e nada mais.

**Limites francos.** A porta autoatendida é apenas para registro (apenas inserção na
camada do banco de dados). **A rotação de qualificadores e a desativação de conjuntos selados continuam
sendo mediadas por curadores** — abra uma issue ou entre em contato com o projeto pelo
[GitHub](https://github.com/gamedaysuits/Champollion/issues). E a execução do nó de pontuação do organizador
nas etapas posteriores (avanços de ciclo de vida, concessões de autorização, operações
de auditoria) é uma via separada, com credenciais de serviço no seu próprio nó —
o autoatendimento para no registro público.

## Etapa 5 — Escolha curadores e a regra M-de-N

Escolha as pessoas ou instituições que devem aprovar conjuntamente cada
avaliação contra seu corpus, e o limite (por exemplo, **3 de 5**). Os curadores
devem ser responsáveis perante sua comunidade, não perante Champollion — veja
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) e
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer) para como os
termos por comunidade são definidos.

**Espaço de transparência:** a *assinatura* por limiar (uma concessão que literalmente não pode ser emitida
sem M assinaturas) está **em desenvolvimento**. A cerimônia de chaves do nó offline
(`mt-eval node ceremony`, Shamir M-de-N) foi implementada, mas ainda não foi utilizada
com um custodiante real. Fora isso, a regra M-de-N é imposta como um processo registrado:
cada solicitação de acesso
entra em uma fila **pendente**, as decisões dos custodiantes são registradas, uma concessão é emitida
apenas para uma solicitação autorizada, e cada concessão é de **uso único, com tempo limite e
vinculada a uma impressão digital específica de (método, versão do corpus, nó de avaliação)**,
e cada evento — incluindo tentativas bloqueadas — vai para um **log de auditoria somente de adição (append-only),
encadeado por hash e legível publicamente**. O banco de dados recusa transições de estado ilegais
abaixo de qualquer cliente e chave. O que ele ainda não pode impedir é um
comprometimento do próprio operador da plataforma — é isso que a assinatura por limiar
elimina, e até que ela seja lançada você deve tratar "Champollion não possui nenhuma parte de chave"
como a meta de arquitetura a ser alcançada, não como uma propriedade que você possa verificar hoje.

## Etapa 6 — Definir o prêmio e declarar seus termos

Um prêmio é opcional. **Um concurso sem termos de premiação declarados simplesmente não tem
prêmio** — esse é o padrão, e não é um concurso inferior por isso.

Se for oferecer um, decida e publique junto com o concurso:

- **Valor e moeda.**
- **Patrocinador** — quem está fornecendo os recursos.
- **Onde os recursos ficam** — a conta da sua organização ou um fundo comunitário
  que você indicar. **O Champollion nunca retém, custodia em escrow ou intermedeia fundos de premiação.**
  Publicar a identidade do custodiante antecipadamente é o que confere credibilidade ao prêmio;
  consulte a [nota de risco de inadimplência do patrocinador](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  nos modelos de termos.
- **Condições de corte** — a pontuação mínima que um método deve atingir, redigida
  de acordo com a [Especificação de Prêmios](/docs/network/specifications/prizes): um limiar
  de chrF++, quaisquer critérios diagnósticos desejados (como uma aceitação mínima por FST —
  uma condição que uma submissão deve atender, nunca a pontuação em si), requisitos
  de validação por falantes, reprodutibilidade. Torne as condições de concessão
  verificáveis a partir das pontuações publicadas, para que ninguém precise confiar na sua
  palavra (ou na nossa) sobre se o patamar foi atingido.
- **Os termos do prêmio** — o que acontece com a submissão em si.

### O termo de premiação fica a seu critério

A execução é fixa: em um concurso soberano, o participante entrega a você um modelo ou um
método e o seu nó o executa. O que acontece com ele *depois* disso é uma escolha sua,
e trata-se de uma de três opções:

| O termo | O que você está dizendo aos participantes |
|---|---|
| `pass_to_holders` — *transferir aos detentores* | O método passa para vocês, os detentores do benchmark soberano. Vocês o pontuam e o mantêm, independentemente de quem vencer. |
| `retain_ip` — *manter PI* | O participante mantém a propriedade. Vocês pontuam a submissão e mantêm, no máximo, uma cópia selada para fins de auditoria. |
| `release_open` — *liberar como código aberto* | O participante mantém a propriedade, mas deve publicar o método sob uma licença aberta. Essa liberação é a condição do prêmio. |

O detalhamento decorre do termo escolhido, de modo que não há matriz a ser preenchida: o que você
guarda (`retention`), se algum direito é transferido (`rights`), para que você pode usá-lo
(`host_use`) e se o participante precisa publicar (`release`) são todos
**derivados** da opção que você selecionou. Duas das opções permitem restringir um
campo:

- sob `retain_ip`, `--prize-retention delete_after_scoring` destrói o artefato depois que ele foi pontuado (o padrão mantém uma cópia selada para auditoria);
- sob `release_open`, `--prize-release-timing` altera a liberação para `required_before_scores` ou `required_after_prize` (o padrão é `required_before_prize`), e `--prize-release-license` define a licença em vez de aceitar qualquer uma aprovada pela OSI (`any_osi`).

A tabela derivada completa e como cada opção é verificada antes de um pagamento estão na
[Especificação de Prêmios §2.1, condição 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Qualquer que seja a sua escolha, o termo é exibido para você em linguagem simples com
um **SHA-256** antes que qualquer coisa seja gravada. Esse hash é o token de aceitação:
o participante passa `--accept-terms <hash>`, o aceite é empacotado no
bundle dele e coberto pelo hash de seu conteúdo, e seu nó recusa um pacote que
tenha aceitado qualquer outra coisa. O termo é congelado no momento em que seu concurso recebe sua primeira
submissão, para que ninguém seja obrigado a cumprir termos que nunca leu.

O aspecto financeiro é deliberadamente mantido *fora* do termo: o valor, a moeda e o
patrocinador são informações do concurso, e uma cláusula sobre quem detém o método é
um tipo de declaração diferente de uma cláusula sobre quanto está sendo pago.

## Etapa 7 — Crie o concurso

Concursos sobre conjuntos selados usam a **pista selada** explícita. A
elegibilidade é fail-closed: o concurso é recusado a menos que seu registro de
conjunto selado exista e esteja ativo — e criar o concurso não concede a
**ninguém** qualquer acesso ao corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Duas dessas flags são fixas ou congeladas pelo banco de dados, independentemente do que você faça
depois, e outras três são **promessas**:

- `--use-context` faz parte da identidade do concurso: torna-se fixo no momento
  em que o concurso é registrado e nunca pode ser alterado (crie um novo concurso
  em vez disso). O padrão é `non-commercial`.
- `--primary-metric` (padrão `chrf_plus_plus`), a métrica que o ranqueamento utiliza,
  é congelada assim que o concurso tem sua primeira submissão. Um novo concurso que mencione o
  `composite` descontinuado é recusado com a justificativa; concursos registrados antes do
  [padrão de pontuação](/docs/network/specifications/scoring#how-runs-are-scored)
  continuam funcionando.
- `--visibility` (padrão `public`), `--description` e a informação de se a admissão está
  aberta não são congelados.

As três promessas são congeladas no momento em que seu concurso tem sua primeira submissão:

- `--prize-disposition` / `--prize-terms` — o termo da Etapa 6. Omita ambos e
  o concurso não terá prêmio.
- `--results-visibility hidden_until_close` — cada pontuação que seu nó medir
  será **retida** até que você encerre o concurso, para que ninguém faça tuning contra o
  conjunto selado a partir de seus próprios resultados. Esse é o padrão; o exemplo o declara
  para que a promessa fique visível em suas próprias anotações. Passe
  `--results-visibility immediate` se preferir um painel em tempo real, com cada
  cartão publicado assim que seu nó o concluir.
- `--anonymize-until-close` — os participantes aparecem sob pseudônimos estáveis no seu
  ranqueamento enquanto o concurso estiver aberto. (Esta é a sua visualização de ranqueamento; isso não
  anonimiza um cartão depois que ele for publicado no painel aberto.)

As mesmas três flags estão disponíveis em `contest prepare` e `contest register`,
que é onde a maioria dos organizadores as definirá, já que esses caminhos criam o
concurso para você. Com `contest prepare --no-register`, as flags de registro
que você passa (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, as flags de prêmio, `--visibility`, `--use-context`,
`--closed-intake`) são registradas em `local/manifest.json`, e
`contest register --manifest` as aplica a menos que você passe suas próprias flags,
informando quando uma delas substitui um valor registrado. O prepare imprime cada um
desses termos com seu valor, quer você o tenha fornecido ou seja o padrão, e
quando ele deixa de poder ser alterado, antes de qualquer coisa ser registrada. Seu
`--help` informa cada padrão.

*(O valor `--corpus` é seu `sealed_set_id` registrado. A pista selada é
selecionada **automaticamente** a partir do registro de conjunto selado — sem
sinalizador extra; um conjunto selado nunca pode apoiar um concurso ordinário e
um dataset ordinário em quarentena nunca pode apoiar qualquer concurso. Ambas
as regras são aplicadas no banco de dados, sob cada cliente. Se você registrou
na Etapa 4 com `contest register` ou `prepare --self-serve`, a linha de concurso **já
existe** — pule esta etapa; `contest create` à mão é apenas para montar um
concurso a partir de um conjunto selado já registrado.)*

## Etapa 8 — Métodos se qualificam em público primeiro

Os desenvolvedores constroem e pontuam seus métodos no **conjunto público de dev** que você liberou
na Etapa 1. O `current_qualifier_id` do seu conjunto selado indica essa rodada, e um
método deve atingir seu limiar antes que uma execução selada possa sequer ser solicitada. Isso
elimina a pressão de probing sobre o seu corpus: ninguém pode tentar mirar no conjunto selado
até demonstrar desempenho real em aberto.

O próprio participante o executa, offline, em um único comando:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

O id do qualificador e o limiar são os dois dados que a pontuação precisa que
você forneça; portanto, publique ambos junto com o lançamento do conjunto de dev. Para um concurso criado com `contest
prepare`, o id do qualificador é o próprio id do corpus de dev (seu
`dataset.corpus_id`), e o prepare grava o limiar na descrição do corpus de
dev. Sem as duas flags `--offline-…`, o qualify as lê diretamente do
banco de dados do concurso. Isso funciona apenas quando o concurso está registrado no
endpoint para o qual o participante está apontando. Quando não estiver lá ou o banco de dados
não puder ser acessado, o qualify é interrompido e exibe o comando offline acima, preenchido
com os próprios argumentos do participante.

`--dev` recebe as traduções do participante para o conjunto de dev, uma por linha na
ordem do corpus, como JSON indexado pelo id da entrada, ou como o log de execução gerado por `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`). Um log de execução é lido por
id de entrada e verificado para garantir que seja uma execução nesse mesmo corpus de dev; um log com
entradas com erro é recusado, pois cada entrada precisa ser pontuada. O resumo informa então
que as saídas foram geradas pelo harness nessa execução e repontuadas a partir de seu arquivo
(com o custo dessa execução), nunca que foram feitas fora do harness; apenas
um arquivo simples de hipóteses é descrito dessa maneira.

**A aprovação ainda não é uma submissão.** Após o veredito, o qualify informa o que
já consegue antecipar sobre a submissão. Para a execução de um plugin de método cuja pasta
esteja na máquina, ele executa a mesma análise estática que `submit-method` e o seu nó
fazem (bibliotecas de rede, ferramentas de rede de shell, caminhos proibidos do sistema de arquivos) e
mostra tudo o que seria recusado, como um plugin que importa `urllib`
para chamar um servidor de modelo. Para a execução do próprio caminho de LLM do harness (um modelo
acessado por meio de um provedor), ele avisa que não há método apto a ser submetido como está:
o nó executa uma submissão sem rede, portanto o modelo precisa viajar dentro dela
(consulte *Inclua no pacote todos os modelos que seu método chama* abaixo). Caso contrário, a linha de aprovação
informa as verificações que ainda virão no momento da submissão. Nada disso altera
o veredito ou o recibo.

Ele imprime a pontuação do qualificador (o critério de corte) e o limiar lado a lado,
ambos na escala de 0–100 de qualificador chrF++, e depois o detalhe da pontuação: chrF++
do corpus com sua assinatura sacreBLEU, as outras métricas padrão ao lado
(nunca combinadas), correspondência exata como diagnóstico que nunca barra e quaisquer
ressalvas sobre a pontuação. O qualify não publica nada. Um sistema cujas saídas
de dev sejam em grande parte cópias de seu texto-fonte é recusado, qualquer que seja sua pontuação:
quando metade ou mais delas forem o próprio texto-fonte (ignorando maiúsculas/minúsculas, acentos e pontuação,
e excluindo linhas cuja referência seja o próprio texto-fonte, como
nomes próprios), o participante não está traduzindo. A mesma regra o recusa novamente quando
o seu nó o reexecuta. Isso grava um **recibo do qualificador** na
máquina dele, sem o qual `submit-model` e `submit-method` se recusam a montar uma
submissão. Os recibos são mantidos por concurso e por sistema (`--system`),
de modo que um participante que qualifique dois sistemas mantém ambos; requalificar o mesmo
sistema mantém o recibo anterior ao lado. `submit-method` e
`submit-model` usam o recibo de `--system` (padrão: o de `--name`,
caso contrário, o único recibo do concurso) e recusam, listando as opções, quando isso for
ambíguo. O recibo é
autorrelatado por construção — logo, não é ele que serve de critério de corte. Antes que qualquer concessão seja
reivindicada, **seu nó reexecuta o método submetido no mesmo conjunto de dev** e
compara sua própria medição com a reivindicação; um recibo que superestime o método
é negado aí, trazendo os valores reivindicado vs. medido na justificativa da negação.

**Um recibo informa a execução da qual se originou.** Quando `--dev` for um log de execução (ou seu
`_report.json`), o recibo registra a execução e o modelo executado: para
`mt-eval run --method local-model -m <model>`, o id e a revisão do
Hugging Face, ou o diretório do modelo com um SHA-256 de seus arquivos. Um
log de execução `local-model` que não identifique nenhum modelo é recusado — compilações anteriores da 0.2.0
não passavam `-m` para aquele motor, que então executava um modelo alternativo inglês→espanhol
em seu lugar. `submit-model` verifica então se os pesos que ele empacota estão
entre os arquivos indicados no recibo e recusa, apontando ambos os hashes, caso
não estejam. Um recibo pontuado a partir de um arquivo simples de hipóteses não indica nenhum modelo; a
reexecução feita pelo nó é a verificação correspondente.

**Uma discrepância entre o recibo e o nó é sinalizada.** Ambos os números são
calculados da mesma forma — o mesmo avaliador, o mesmo conjunto de dev e, para um modelo,
a mesma regra de comprimento de decodificação —, de modo que os mesmos pesos resultam em uma diferença menor que uma fração
de ponto. Quando o número do nó e o do recibo divergirem em mais de **2,0
pontos** na escala de 0–100 do qualificador, o nó informa isso após sua
reexecução; um nó em airgap também registra a discrepância com sua verificação em seu
livro-razão local e a exibe novamente para o custodiante em `node approve
--offline`. Trata-se de um alerta, nunca de uma recusa:
o número obtido pelo próprio nó é o que serve de critério de corte. (O limite de 2,0 é uma escolha deliberadamente
conservadora que alerta facilmente; é um valor de política que o organizador
pode querer ajustar.)

### Os participantes podem ensaiar tudo antes de submeter

Ninguém deveria descobrir que seu pacote estava malformado por meio de uma rejeição dias
depois. `mt-eval contest validate` executa, na máquina do participante e sem nenhuma
rede, exatamente o que seu nó executa primeiro:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

Ele imprime uma tabela de constatações e sai com código diferente de zero se algo for recusado
(`--json` para ferramentas). Indique-o aos participantes em sua chamada de participação:
custa apenas um comando para eles e poupa recusas a você.

`validate` não grava nada. Ele repontua a saída de dev sem gravar um
recibo e, em seguida, valida um recibo:

- **Um pacote pronto** (o `.tar.gz` gerado por um comando de submissão) traz o
  recibo com o qual foi empacotado, e essa cópia é a que o seu nó lê. Assim,
  o validate confere o ensaio em relação a essa cópia. Ele também localiza o recibo
  na máquina do participante do qual a cópia veio e indica o seu sistema, qualquer
  que seja o nome do método do pacote. Ele avisa quando `--system` indica um
  recibo diferente e quando o participante qualificou esse sistema novamente desde
  o empacotamento (o pacote ainda carrega o recibo mais antigo). Sem
  flags `--offline-…`, o id do qualificador e o limiar também são extraídos dessa
  cópia, o que significa que são os valores fornecidos pelo participante a `contest qualify`.
  A constatação informa isso.
- **Um diretório-fonte** empacotado para a verificação com `--manifest`: o validate
  usa o recibo que `submit-method` e `submit-model` incorporarão, localizado da
  mesma forma que eles localizam: `--system`, senão o recibo nomeado como o método
  do pacote, senão o único recibo do concurso.

Ele avisa quando esse recibo cobrir saídas de dev diferentes, outro arquivo de dev ou
outro qualificador. Também avisa quando não houver recibo. Recibos são gerados
apenas por `contest qualify`.

É um ensaio, e ele deixa isso claro. Seu nó ainda construirá a imagem sem
rede, executará o contêiner e reexecutará o qualificador por conta própria. Um validate limpo
significa apenas que nada *já conhecido* está incorreto — não que a execução pontuará com sucesso.

:::note[Participantes: em qual endpoint seu concurso está hospedado?]
Um concurso **hospedado na rede** não precisa de configuração de endpoint — o endpoint padrão fornecido
com o harness traz os mecanismos de concurso (a porta de entrada do qualificador, propostas
de método, autorização), e `mt-eval contest submit-model` /
`submit-method` comunicam-se com ele diretamente. Você precisa do harness na versão **0.2.0 ou posterior**
(`mt-eval --version`); versões anteriores não possuem `qualify`, `validate`, `rank` e
`close`. Concursos hospedados na rede abrem apenas quando um organizador é registrado
pelo fluxo descrito na ressalva acima, portanto a maioria dos concursos hoje é
**federada**.

Um contest **federated** — o organizador executa a maquinaria em seu próprio
projeto Supabase, então envios nunca transitam o nosso — publica seu endpoint
com os materiais do contest. Exporte-o antes de enviar:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Se o harness está apontado para um endpoint que não tem a maquinaria de contest
(digamos, um host federated sem uma migração), o comando para com
*"a contest lane ainda não está disponível neste endpoint Supabase"* e informa
qual endpoint estava sendo usado. (Organizadores federated: publiquem estes dois
valores junto com seu lançamento de corpus, `--node-id`, e `--corpus-version`.)
:::

## Etapa 9 — Execuções seladas: solicitar, autorizar, executar, pontuações saem

Para cada submissão:

1. Uma **solicitação** é aberta contra o seu conjunto selado — ela entra em `pending` e
   carrega uma impressão digital imutável de (hash do pacote, id do corpus, versão
   do corpus, `scores-only`, medição do nó de avaliação).
2. Seu nó executa suas **próprias verificações estáticas** no pacote. Para uma submissão de código
   (Via B), ele verifica em seguida se pode executá-la: se um runtime de contêiner está
   presente e se a memória RAM, o disco temporário e o tempo de execução declarados pelo pacote cabem
   nos limites do seu `sandbox`. Uma não conformidade aqui não é um veredito sobre o método. A
   recusa lista cada incompatibilidade ("8 GB de RAM solicitados, este nó permite 4 GB
   (sandbox.max_ram_gb)"), nada é executado ou rejeitado, e a solicitação permanece
   como estava. Você pode aumentar o limite em `node.json` e reexecutar
   `mt-eval node run-method <id>` sem nova submissão. Ou o participante pode
   reempacotar com as flags indicadas na recusa (por exemplo, `--ram-gb 4`);
   os requisitos fazem parte do hash do pacote, portanto isso gera uma nova solicitação.
   Em seguida, o nó **reexecuta a reivindicação do qualificador do participante** em sua própria
   cópia do conjunto público de dev. O recibo deles é uma alegação; isto é a
   medição real. Uma divergência é
   negada aqui — antes que qualquer custodiante seja solicitado a aprovar algo e antes
   que o conjunto selado seja aberto —, e a negação indica o que foi reivindicado, o que foi
   medido e qual era a barra de corte. Um pacote que tenha aceitado termos de premiação diferentes
   daqueles declarados pelo seu concurso é recusado no mesmo ponto.
3. Seus **custodiantes decidem** (M-de-N). A aprovação gera uma **concessão**: de uso único,
   com expiração, válida apenas para aquela impressão digital exata.
4. A avaliação é executada no sandbox isolado da rede no **seu** nó
   (`mt-eval node run-method`): um contêiner sem pilha de rede, com as referências
   mantidas fora dele — ou, para isolamento máximo, em uma máquina verdadeiramente em airgap, com
   pacotes assinados contendo apenas pontuações cruzando por mídia removível (consulte a caixa de status
   acima para o que está ou não coberto). Um nó isolado (dark node) não faz upload de nada: você
   transporta seu pacote de pontuação assinado e publica o cartão de execução a partir de uma máquina
   conectada (`mt-eval node relay`). Seu conjunto de retenção selado e quaisquer suítes de teste de terceiros declaradas
   são executados dentro da **mesma** execução autorizada, sem demandar cerimônia extra
   dos seus custodiantes.
5. **Apenas pontuações saem.** A regra de emissão `scores-only` é fixada na
   camada do banco de dados; textos por entrada do seu corpus nunca são publicados.
6. Se o seu concurso prometeu `hidden_until_close`, a pontuação ainda não é publicada:
   ela é **retida** como um resultado diferido visível apenas para você, e
   `contest close` publica todos os cartões retidos antes de congelar o
   ranqueamento. Um resultado retido nunca é um resultado perdido.
7. Cada etapa — solicitação, votos, concessão, uso e qualquer tentativa bloqueada — é
   anexada ao log de auditoria público encadeado por hash que você (e qualquer pessoa) pode reproduzir.

## Submetendo um método (para participantes) — duas vias

A maioria das submissões de NMT não é exótica: um transformer padrão ajustado (fine-tuned) e seus
pesos. Para esses casos, existe uma **via preferencial, livre de código** — e um fallback em
sandbox para métodos que realmente consistem em código.

### Via A — modelo declarativo (preferencial para NMT padrão)

Se o seu método for um modelo neural padrão, você o submete como **dados** — os
pesos, o tokenizador e a configuração — e o organizador o executa em seu próprio motor de
inferência confiável. **Sem Dockerfile, sem código, sem sandbox.** Como nada do que você
submete é executado, a verificação de segurança do organizador é uma validação de formato decidível,
em vez de tentar provar que um código arbitrário é seguro — uma garantia estritamente mais forte
para você e para o corpus.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Um modelo treinado com o NMT Forge.** `nmt-forge export` grava a
pasta implantável `export/model/`. Além dos pesos, da configuração e do tokenizador,
ela contém `forge-model.json` (as pontuações desse modelo no seu conjunto de testes privado
e caminhos locais), `DEPLOY.md` e `champollion-plugin/`, nenhum dos quais
faz parte de uma submissão. `submit-model` empacota apenas os arquivos que a biblioteca transformers lê
(pesos, `config.json`, `generation_config.json`, os arquivos do tokenizador) e
informa tudo o que deixou de fora, de modo que esses três ficam de fora por si só.
A Seção 6 desse `DEPLOY.md` lista os arquivos que compõem a submissão, a
arquitetura de `config.json` e a contagem de parâmetros lida no cabeçalho
do arquivo de pesos, com o comando exato. Para enviar exatamente os arquivos que você
inspecionou, copie-os para uma pasta própria e passe-a como
`--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Qual contagem de parâmetros.** A Via A verifica `--parameter-count` em relação ao
arquivo de pesos. Ela soma os tamanhos dos tensores no cabeçalho do `safetensors` e
recusa uma declaração com diferença superior a 1%. Esse é o valor armazenado pelo arquivo, e ele pode
diferir de uma contagem feita no torch. Um peso compartilhado (tied) é armazenado apenas uma vez. Uma
tabela que o modelo reconstrói ao carregar, como posições sinusoidais, pode nem
ser salva. A recusa imprime a contagem do arquivo; declare esse número.

As regras que seu pacote deve cumprir (validadas localmente antes do upload e novamente
pelo nó do organizador):

- **Os pesos são `safetensors`, nunca pickle.** Um arquivo PyTorch `.bin`/`.pt`/`.ckpt`
  é um pickle — código arbitrário ao carregar — e é recusado. Exporte para
  `model.safetensors` (`safetensors` / `transformers` fazem isso nativamente).
- **Uma arquitetura que o motor do organizador carregue nativamente.** O `architectures` de `config.json`
  pode ser qualquer arquitetura implementada pelo `transformers` do host
  (Marian, NLLB/M2M100, mBART, T5, Pegasus e muitas outras) — os hosts são
  **permissivos por padrão**, porque com o `trust_remote_code=False` a segurança
  vem do formato livre de código, não do nome da arquitetura (uma arquitetura
  não suportada simplesmente falha ao carregar, sem executar nada). Um host cauteloso pode
  publicar uma lista de permissões. Nada de `auto_map` ou `trust_remote_code` — eles reintroduzem
  código personalizado sorrateiramente e são sempre recusados.
- **Um tokenizador declarativo** (`tokenizer.json` ou um `sentencepiece` `.model` +
  vocabulário) e **apenas arquivos de dados** — nada de `.py`/scripts/binários no pacote.

**O que `submit-model` empacota.** Os arquivos de dados na raiz de `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): os
pesos, configuração, tokenizador e configuração de geração. Todo o resto — um
`README.md` ou `DEPLOY.md`, uma subpasta, um checkpoint pickle ao lado dos
safetensors — é deixado de fora, e o comando lista o que foi omitido. Dessa forma, a
pasta `model/` gerada por `nmt-forge export` pode ser submetida como está: seus `DEPLOY.md`
e `champollion-plugin/` ficam para trás. `contest validate` empacota da mesma maneira
e relata os arquivos deixados de fora como uma constatação de INFO. A verificação do seu nó
permanece inalterada: um pacote que contenha um arquivo que não seja de dados ainda será recusado lá.

**Qual o comprimento máximo das saídas.** Seu nó decodifica sempre com um comprimento explícito,
sem exceção: o `max_new_tokens` ou `max_length` declarado pelo modelo (seu
`generation_config.json`), ou até `max(64, 4 × source tokens)` novos tokens
por sentença, limitado pelas posições do decodificador. `mt-eval run --method
local-model` decodifica pela mesma regra, garantindo que o recibo do participante e a
reexecução do seu nó concordem. `submit-model` imprime o comprimento que será aplicado
e o grava no manifesto (`model.decodeLength`); o nó registra o
comprimento aplicado nos fatos de execução da rodada (`execution.generation`).
Sem um comprimento explícito, a biblioteca transformers interrompe a decodificação por volta de 20
tokens, e todas as submissões seriam avaliadas sobre saídas truncadas.

O organizador o executa com `trust_remote_code=False`, offline, e apenas pontuações
saem — publicadas como `declarative-model`, com identidade de método **livre de código por
construção**. (Pesos de múltiplos gigabytes: use `--bundle-out` para a via de sneakernet,
da mesma forma que abaixo.)

### Via B — pacote executável (sandbox, para métodos com código)

Se o seu método realmente for código — um pipeline, um híbrido orientado por LLM, um decodificador
customizado —, ele não pode ser executado declarativamente, precisando passar pelo sandbox
isolado da rede. Esta é a via assumidamente mais frágil (ela contém código não confiável
em vez de se recusar a executá-lo), portanto use a Via A sempre que seu método for um
modelo padrão.

**Inclua no pacote todos os modelos que seu método chama.** O nó executa sua submissão totalmente
sem rede; portanto, um método que chama uma API de modelo hospedado (um híbrido orientado por LLM
que consulta um LLM na nuvem, um serviço de MT) não receberá resposta e não pontuará
nada. Um híbrido orientado por LLM só se qualifica se contiver seu LLM dentro do pacote:
pesos abertos sob `/method`, executados no mesmo processo ou por um servidor local iniciado pelo seu
entrypoint. O mesmo vale para qualquer dicionário, FST ou outros dados que seu
método leia em tempo de execução. (A [especificação de métodos](/docs/network/specifications/methods#method-validity-and-dependency-classes)
chama um método que depende de LLM hospedado de classe de dependência A1; o gateway que
permitiria a execução deste em sandbox não foi implementado.)

**O contrato do pacote executável é stdin/stdout.** Dentro do contêiner, o
nó do organizador executa exatamente:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

As sentenças de origem chegam uma por linha no stdin; você escreve uma tradução por
linha no stdout. O contêiner não possui pilha de rede (`--network=none`), tem uma
raiz somente leitura e um `/tmp` gravável.

**Para onde vão seus arquivos.** Tudo o que estiver na pasta que você passar como `--method-dir`
é empacotado sob `method/` no pacote e montado **como somente leitura em `/method`**
em tempo de execução, incluindo os pesos, de forma que nada precisa ser copiado para a imagem. Organize
a estrutura desta forma:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` é o caminho do script dentro de `--method-dir`. Seu caminho no pacote,
`method/translate.py`, também é aceito. Se um nome puder se referir a dois arquivos
diferentes, o comando recusa e indica ambos; se o arquivo estiver ausente, ele lista
todos os caminhos em que procurou.

**Um wrapper mínimo de Hugging Face transformers:**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**O Dockerfile deve ser construído sem rede.** O organizador constrói sua imagem com `--network=none` — o teste de construção air-gap *é* a construção — então toda dependência deve ser **vendorizada no bundle** (um `pip install` que alcança PyPI falha na construção, e a varredura estática de pré-voo sinaliza chamadas de rede antes de qualquer coisa ser enviada). Envie wheels dentro do seu diretório de método e instale a partir deles:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**O que toda submissão deve conter.** Estes itens são obrigatórios, e o comando
é interrompido antes de qualquer etapa de rede se algum deles estiver faltando:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id` e `--agree`;
- um **recibo de `mt-eval contest qualify` com aprovação** para este concurso e este
  sistema (Etapa 8; `--system` o identifica quando você tiver qualificado mais de um);
- duas declarações, registradas como suas afirmações: `--track constrained` ou
  `--track unconstrained` (não há padrão) e `--parameter-count`;
- para um método com pesos treinados (`--parameter-count` maior que 0): também
  `--weights-license <SPDX id or LicenseRef-…>` e um entre `--weights-public`
  ou `--weights-private`;
- para um método **sem pesos treinados** (baseado em regras, um dicionário, um FST):
  `--parameter-count 0` e nenhuma flag de pesos. A submissão registra a
  licença e a abertura dos pesos como não aplicáveis, em vez de exigir uma licença inventada
  por você;
- para um método que **faz prompting em um LLM** (não treina nada, apenas escreve
  prompts): a contagem é a soma dos parâmetros de todos os modelos executados pelo pacote,
  incluindo o LLM, embora você não o tenha treinado. Obtenha esse valor do cartão do modelo do LLM
  ou do cabeçalho de seus pesos e passe a licença do LLM como
  `--weights-license` com `--weights-public` quando seus pesos puderem ser baixados abertamente.
  `--parameter-count 0` descreveria o sistema incorretamente: 0 significa que o
  método não executa modelo algum. Um método que chama um LLM hospedado não pode entrar
  em um concurso selado de forma alguma: o nó não tem rede, e o gateway que
  viabilizaria essas chamadas não foi construído (consulte *Inclua no pacote todos os modelos que seu método
  chama* acima). `contest qualify` já avisa isso quando as saídas que ele
  pontua vieram por meio de um provedor;
- com `--track constrained`: `--training-data-file`, uma lista em texto simples dos
  dados nos quais você treinou (um método não treinado em nada declara isso no arquivo);
- se o concurso declarar termos de premiação: `--accept-terms <hash>` (execute uma vez
  sem ele e os termos serão exibidos com o hash que deve ser passado de volta); se ele
  exigir descrições: `--description-file`.

**Os recursos declarados pelo seu método.** O pacote especifica a RAM, o disco
temporário e o tempo de relógio de que necessita, e o nó do organizador recusa pacotes que
peçam mais do que os limites de `sandbox` configurados. Os padrões são os limites definidos no
modelo de nó gerado por `mt-eval node init`: `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, sem GPU. Um pacote montado com os valores padrão,
portanto, roda em um nó configurado com os padrões do modelo. Se o seu
método precisar de mais, informe com essas flags (e `--gpu`) e verifique se o
nó do organizador permite. Os organizadores que alterarem os limites devem publicá-los
junto ao concurso. Se o nó recusar, a mensagem indicará cada valor
e o que o nó permite.

Envie com:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

O nó do organizador reexecuta seu método em sua própria cópia do conjunto público de dev
antes que qualquer custodiante seja solicitado a aprovar a execução. `--agree` confirma
a concordância com os termos de submissão do método.

**Pesos de vários gigabytes ou sem conexão: use a via sneakernet.** O caminho de admissão
hospedado envia seu arquivo tarball por meio de um **único POST** para o armazenamento do host
do concurso, ficando sujeito ao limite de upload daquele armazenamento — adequado para código
e modelos pequenos, mas não para checkpoints de vários gigabytes. O contrato do pacote em si
permite artefatos muito maiores (tarballs de até 100 GB, imagens construídas de até
150 GB). `--offline` empacota a submissão e grava um diretório de intercâmbio
sem usar a rede. Sem conexão, não há linha de concurso para ler;
portanto, ele também precisa dos valores publicados pelo organizador: `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` e
`--offline-threshold` (o limiar na escala de 0–100 do qualificador). Um método baseado em regras
sem pesos, empacotado offline:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

O diretório de troca viaja para o organizador por mídia removível (ou qualquer canal em que vocês dois confiem); eles o ingerem com `mt-eval node import-bundle`. O SHA-256 do bundle é congelado na requisição de autorização de qualquer forma, então o que é executado é comprovadamente o que você propôs.

**Organizadores: uma proposta offline aguarda por um custodiante, assim como uma online — e o nó a verifica primeiro, na ordem da Etapa 9.** Ela chega como uma
solicitação *pendente*, e o nó em airgap registra tanto suas próprias verificações quanto
a decisão do custodiante localmente, sem banco de dados e sem chave de serviço:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

O primeiro `node run-method --offline` em uma proposta pendente não abre nada
selado. Ele reexecuta o qualificador do participante no conjunto público de dev (o
`qualifier` + `dev_corpus` declarado pelo seu `node.json`; `node init
--from-contest` preenche ambos) e, para uma submissão de código, verifica se um runtime
de contêiner está presente e se a RAM, o disco temporário e o tempo de execução declarados
pelo pacote cabem nos limites de `sandbox`. A aprovação é registrada no
livro-razão local encadeado por hash do nó. Uma reprovação no qualificador é recusada no ato, registrada como
negação do nó e devolvida como uma recusa assinada: nenhum custodiante é consultado.
Um nó incapaz de executar a submissão (falta de runtime, limite insuficiente) recusa como
problema do nó e não registra nada, mantendo a solicitação como estava.

`node approve --offline` recusa-se a prosseguir até que essa verificação com aprovação esteja no livro-razão
para a impressão digital e o pacote exatos desta solicitação, e seu erro indica o
comando a ser executado primeiro. Ele grava então um voto e a autorização no
mesmo livro-razão (o mesmo usado na cerimônia de cotas dos custodiantes) e um registro de decisão
assinado com a `signing_key` do nó, citando a verificação sobre a qual foi concedido. O
segundo `node run-method --offline` verifica todos os três itens antes que qualquer conteúdo selado
seja executado (o livro-razão valida, mostra esta solicitação autorizada sob a
impressão digital importada, e o registro assinado valida e cita esta
solicitação), de modo que uma proposta pendente nunca é executada apenas pela vontade do operador. Em seguida,
ele reexecuta a checagem de runtime e o qualificador antes que o conjunto selado seja aberto.
Uma negação é registrada da mesma forma e enviada de volta ao participante como uma recusa
assinada; um custodiante pode negar a qualquer momento, tendo havido verificação prévia ou não.
Solicitações que já chegam autorizadas — uma exportação por relay (autorizada no
banco de dados do concurso) ou `node stage-request` (o organizador de homologação é a própria
autorização) — não precisam de uma segunda decisão.

**Organizadores: pré-carregue imagens base em máquinas airgap.** Como a construção de imagem é executada com `--network=none`, a imagem base `FROM` do Dockerfile já deve estar no armazenamento de imagens local da máquina. Em uma máquina conectada, `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; leve `base.tar` com o bundle; na máquina airgap, `docker load -i base.tar` antes de executar `mt-eval node run-method`. Concorde sobre a(s) imagem(ns) base com participantes em seus materiais de contest publicados.

## Etapa 10 — Ranqueamento, encerramento, exportação

Resultados contendo apenas pontuações são publicados no [placar](/docs/network/leaderboard/rules)
como qualquer outra execução, identificados como avaliações de conjunto selado. O ranqueamento
do próprio concurso cabe a você estruturar, congelar e publicar:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

O que `rank` faz, para que você possa explicitar em suas regras: as entradas são ranqueadas pela
**métrica primária registrada** do concurso (`--primary-metric` no momento da criação; chrF++
por padrão), seguida por chrF++ → BLEU → COMET → submissão mais antiga. O ranqueamento é
**restrito a verificadas por padrão** — os cartões de execução publicados pelo nó — e contabiliza
eventuais cartões autorrelatados que tenham sido ocultados. Cada par adjacente traz um veredito de empate
rotulado: um teste pareado de significância por segmento onde houver dados por segmento,
caso contrário **sobreposição de intervalo de confiança de 95%**, caso contrário igualdade pontual.
**Um concurso selado nunca publica linhas por segmento** (apenas agregados, por
projeto), portanto seu teste pareado roda no seu nó. Antes de encerrar, execute
`mt-eval node verdicts --contest <id> --out verdicts.json` no nó; ele
grava apenas vereditos assinados (por par: p-valor, diferença de pontuação, intervalo,
contagem de segmentos — sem texto). Depois, encerre com `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>`. Sem vereditos, os empates decorrem da sobreposição
de IC. De qualquer forma, a saída identifica a evidência utilizada, e sistemas empatados
compartilham a mesma colocação (`1, 1, 3`).

`close` é irreversível. Ele ranqueia pela métrica registrada, recusa a operação
enquanto houver submissões ainda sendo pontuadas (a menos que você force a execução), exibe
a tabela, pede confirmação e, em seguida, congela o ranqueamento no registro do concurso. `export`
retorna esse resultado congelado na íntegra, em JSON ou CSV, para sua publicação em relatórios ou
páginas de resultados. Cartões pontuados em qualquer outro conjunto (um conjunto T2 totalmente secreto, um cartão avulso
do conjunto de dev) são listados separadamente e nunca são misturados ao ranqueamento principal.

### Decidindo quando os resultados são exibidos

Duas promessas que você faz na criação e não pode alterar discretamente depois — o
banco de dados congela ambas no momento em que seu concurso recebe uma submissão:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` é a flag que efetivamente oculta uma
pontuação.** Com ela, cada cartão pontuado pelo seu nó é retido em vez de
publicado: o método foi executado normalmente, a autorização foi consumida e o
cartão foi montado, validado e armazenado na íntegra — ele simplesmente não aparece no
painel. `contest close` publica cada cartão retido **primeiro**, para então construir e
congelar o ranqueamento, garantindo que nada seja perdido e que o resultado congelado ranqueie tudo
o que você possui. Isso ocorre mesmo em um encerramento forçado: forçar diz respeito a ranquear tarefas
ainda em andamento, nunca a reter uma pontuação devida pelo seu concurso. O snapshot
congelado detalha exatamente quais resultados foram publicados pelo encerramento.

Estar retido é um **estado registrado, não uma execução perdida**: o cartão retido não pode
ser editado, e o ponteiro que indica onde ele foi publicado é gravado uma única vez e
nunca reapontado — ambos os comportamentos são garantidos no banco de dados, abaixo de qualquer cliente. Enquanto
o concurso estiver aberto, `rank` informa quantos resultados estão retidos, garantindo que
um ranqueamento provisório nunca pareça completo quando não estiver.

**`--anonymize-until-close` tem um alcance menor, e vale a pena ser preciso sobre
o que ele faz.** Ele substitui os nomes dos participantes por pseudônimos determinísticos nos *seus*
artefatos de ranqueamento — a tabela `rank`, seu JSON, o CSV — enquanto o concurso estiver
aberto, e `close` revela os nomes reais. Ele **não** anonimiza o placar
público: um cartão já publicado exibe o nome de autoria declarado pela
submissão. Se você deseja impedir que os participantes vejam os resultados uns dos outros antes do
final, a opção correta é `--results-visibility hidden_until_close`; esta flag não
a substitui.

Se um método cumprir as condições de limiar publicadas por você na Etapa 6 —
incluindo a [validação por falantes](/docs/network/specifications/speaker-validation),
que é uma validação da sua comunidade, não automatizada —, **você** (ou seu fundo)
concede o prêmio, de acordo com seus próprios termos divulgados. O papel do Champollion termina na
medição.

---

## O que você mantém, para sempre

- **O corpus.** Ele nunca saiu de sua infraestrutura. Leve o texto cifrado
  offline e o conjunto selado simplesmente para de ser executável.
- **As chaves.** O acesso morre quando seus curadores param de concedê-lo.
- **O dinheiro.** Ele nunca esteve em outro lugar.
- **O registro.** O resumo da cabeça do log de auditoria é publicável, então o
  histórico de quem executou o quê contra seu corpus não pode ser reescrito
  silenciosamente — por ninguém, incluindo nós.

Para linguagem de termos que você pode adaptar — propriedade, licenciamento
apenas de pontuações e um tour explícito das maneiras que um concurso pode ser
atacado — veja [Terms Templates](/docs/network/sovereignty/terms-templates).
