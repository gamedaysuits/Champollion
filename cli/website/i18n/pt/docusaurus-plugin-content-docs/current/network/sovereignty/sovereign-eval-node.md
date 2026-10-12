---
sidebar_position: 9
title: "Nó de Avaliação Soberano — Hardware e Operações Air-Gap"
description: "Hardware de referência, disciplina de air-gap e operações de custódia de chaves para executar um nó de avaliação controlado pela comunidade: o conjunto de testes secreto nunca sai da sua máquina; os métodos vêm até os dados."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Nó de Avaliação Soberano — Hardware e Operações Air-Gap

Um nó de avaliação soberano é uma máquina que **você** controla, que mantém um conjunto de testes secreto e avalia métodos de tradução em relação a ele. Os métodos viajam até os dados; os dados nunca viajam. Pontuações — e apenas pontuações — saem.

Esta página é a especificação prática: qual hardware comprar (ou reaproveitar), como configurá-lo e a disciplina operacional que torna "o conjunto de testes nunca saiu da máquina" um fato que você pode defender, em vez de uma promessa na qual você precisa confiar.

:::info[O que já está disponível hoje vs. o que está marcado como em andamento]
O software do nó do organizador **já está disponível hoje** em `mt-eval` — consulte o
[guia de concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest):
preparação e selagem de concursos, o gate do qualificador público **reexecutado
pelo próprio nó em cada submissão antes que qualquer custodiante seja solicitado
a aprovar algo**, pontuação com limite mínimo (threshold-gated) e o executor de
método isolado da rede com sua verificação de importações (import scan). O que um nó
aceita é um **modelo ou um método** — um artefato que ele possa executar. O envio
de traduções de um conjunto cego com fonte pública foi descontinuado como via de
entrada de concurso em 06/09/2026 e o verbo foi removido; uma rodada de fonte
pública sobrevive apenas como um diagnóstico opcional do organizador, e as pontuações
autorrelatadas pertencem ao placar aberto (open leaderboard), que é um painel público
indexado por corpus e direção do par, e não um concurso.
A **cerimônia de chaves por limiar e o fluxo de trabalho selado em repouso do §4 também
já estão disponíveis hoje**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, frações de quórum apresentadas em tempo de execução
(`node run-method --offline --share …`), um livro-razão local de autorização encadeado por hash
(`node ledger verify|head`), manifestos de pontuação assinados
(`node sign-manifest` / `node verify-manifest`) e as ferramentas de air-gap dos §2–§3
(`node bundle`, `node manifest`, `node egress-check`). Os pacotes de pontuação
são assinados **no nó, em Python** — o pacote offline não precisa do
runtime do Node.js — e o mesmo formato de assinatura desanexada é verificado
por qualquer uma das implementações. A **preparação de requisições (staging)** do
lado do organizador **também já está disponível**:
`mt-eval node stage-request` grava exatamente a requisição de troca que um relay online
geraria, a partir de um arquivo de pacote e sem nenhum banco de dados (para um
ensaio ou uma implantação que nunca se conecta), pré-validada da mesma forma que
a importação a validaria e vinculada ao ID do nó; as pontuações retornadas
são verificáveis por manifesto, mas não são publicadas via relay, pois não
existe registro de autorização para publicá-las. O
substituto de par de chaves único permanece apenas para concursos em que o organizador
detém as referências diretamente — todas as interfaces indicam qual lane está
em uso. Falando claramente, o que a v1 **não** inclui: atestação remota de
hardware (TEE) não é contemplada (§5), e a *assinatura* por limiar do lado da
plataforma (aprovações por telefone de custodiantes contra infraestrutura hospedada)
é um trabalho futuro — em um nó soberano, a custódia é exercida apresentando
fisicamente M de N frações na máquina (§4). E para ser preciso quanto à
criptografia: trata-se do compartilhamento de segredos Shamir M-de-N com a chave
**reconstruída na memória travada do nó durante uma execução autorizada**
(e depois zerada) — *não* é computação multipartidária, e a chave de fato existe
brevemente montada na sua máquina offline. Por fim, até que o gate de consentimento
da comunidade seja liberado, a lane é executada **apenas com dados sintéticos**;
corpora reais aguardam esse consentimento.
:::

## 1. Hardware de referência

O executor roda métodos autocontidos: decodificação NMT local, validação FST/morfologia e computação de métricas. Nenhuma chamada de nuvem acontece dentro do air-gap (métodos de API de LLM são exatamente a classe que um nó em air-gap recusa — veja as classes de métodos da [especificação de benchmark](/docs/network/specifications/benchmark)).

| Nível | Especificação | Suporta | Custo aproximado (2026) |
|---|---|---|---|
| **Mínimo** (funciona) | 4 núcleos x86_64 ou Apple/ARM, 16 GB de RAM, SSD de 500 GB | Avaliação de métricas + FST, decodificação em CPU de modelos NMT pequenos (lento, mas correto) | US$ 0 (um laptop reserva) – US$ 400 usado |
| **Recomendado** | 8 núcleos, 32 GB de RAM, NVMe de 1 TB, GPU NVIDIA ≥ 12 GB de VRAM (ex.: classe RTX 4070) | Decodificação NMT confortável para baterias de testes completas; avaliação paralela de métodos | ~US$ 900–1.600 (workstation de formato pequeno) |
| **Institucional** | 16 núcleos, 64–128 GB de RAM, NVMe de 2 TB, 24 GB+ de VRAM | Concursos com muitos métodos, baterias grandes, armazenamento de texto cifrado arquivado | ~US$ 2.500–4.000 |

Requisitos rigorosos em todos os níveis:

- **Sem rádios, ou rádios que você possa provar que estão desligados.** O ideal: um desktop sem placa Wi-Fi/Bluetooth. Aceitável: um laptop cuja placa de rede sem fio foi fisicamente removida ou desativada no firmware. "Modo avião" não é um air-gap.
- **Uma placa de rede (NIC) com fio que você possa deixar desconectada.** A ausência do cabo é o controle de rede mais auditável que existe.
- **Dois pendrives USB dedicados** (rotulados como IN e OUT — veja o §3) e, idealmente, uma máquina cujas outras portas você desative no firmware.
- **Criptografia de disco completo** (LUKS no Linux) para que um nó roubado seja inútil (um "tijolo"), e um nobreak (UPS) se a sua energia não for confiável — uma avaliação interrompida no meio da bateria é recuperável, mas por que arriscar descobrir.

## 2. Configuração de software (uma vez, ~uma hora)

1. Instale uma versão Linux LTS atual (Ubuntu/Debian) a partir de um instalador USB **com
   o cabo de rede desconectado**; ative a criptografia de disco completo na instalação.
2. Em uma máquina online separada com o harness instalado
   (`python3 -m pip install mt-eval-harness`, 0.2.0 ou posterior), gere o pacote offline.
   `mt-eval node bundle --out <dir>` faz quatro coisas:
   - gera wheels do harness instalado e de suas dependências (ou uma wheel específica,
     com `--wheel <file>`);
   - baixa as bibliotecas de criptografia de acordo com a lista fixada por hash incluída
     no harness;
   - copia quaisquer artefatos `--include`;
   - grava um manifesto sha256 de todos os arquivos.

   Inclua os **language cards** de cada idioma que o nó irá pontuar
   (`--include <cards-dir>`): o nó identifica o par de idiomas de uma execução a partir de um
   índice local de cards e nunca busca nenhum remotamente. Nenhum dos pacotes instalados
   fornece um diretório de cards por idioma; portanto, gere-o aqui com a CLI do `champollion`,
   um `<code>.json` por idioma (`champollion network card eng --json >
   node-cards/eng.json`, e em seguida faça o mesmo para o outro idioma), e passe
   `--include node-cards`. No nó, ele fica em
   `<dir>/artifacts/node-cards`; aponte `cards_dir` para lá. Tudo o que o nó precisa é transferido
   na unidade IN uma única vez. Faça a compilação na mesma versão do Python executada no nó
   (3.11 ou 3.12); a lista com versões fixadas recusará qualquer outra.
3. Transfira o pacote na unidade IN; verifique o sha256 de cada artefato
   em relação ao manifesto **no próprio nó** antes de instalar
   (`mt-eval node bundle --verify <dir>`). Em seguida, instale apenas a partir das
   wheels empacotadas:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   O extra `[node]` é a biblioteca `cryptography` de que o comando `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness`
   não a contenha.
4. Crie o par de chaves de assinatura do nó (`mt-eval node keygen`) e registre
   sua metade pública — você a publicará para que qualquer pessoa possa verificar seus
   manifestos de pontuação (§5).
   O nó também precisa do **Docker** (ou Podman), que executa cada método submetido
   em um contêiner sem rede; se nenhum deles estiver no `PATH`,
   `mt-eval node run-method` recusa em uma única linha citando ambos, e a
   requisição permanece executável. Ele também precisa de um arquivo de configuração de nó em
   `~/.mt-eval/node.json`. Esse arquivo especifica o nó, seu diretório de cards
   (`cards_dir` ou `MT_EVAL_CARDS_DIR`) e os concursos que ele atende.
   `mt-eval node init` grava uma configuração inicial com todas as chaves que um nó de avaliação
   lê, incluindo o gate do qualificador público (`qualifier` + `dev_corpus`,
   contra o qual o nó reexecuta cada método antes de abrir um conjunto selado)
   e os slots do holdout selado (`holdout_set_id` + `holdout_corpus`;
   remova-os caso o concurso não tenha holdout).
   `mt-eval node init --from-contest <out>` preenche os valores do concurso a partir
   do manifesto gerado por `contest prepare` (o mapeamento está no
   [guia de concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   O bloco `sandbox` é a política de recursos do nó (4 GB de RAM, 4 GB de espaço temporário/scratch,
   30 minutos por execução, sem GPU), e `contest submit-method` declara exatamente
   esses valores por padrão; portanto, publique seus limites com o concurso caso
   os altere.
   Uma configuração de nó que declare apenas metade desse gate é recusada na inicialização.
   `mt-eval node ledger verify` verifica o arquivo preenchido: ele recusa o
   primeiro valor residual `<...>` ou arquivo declarado que não esteja no nó,
   exibe o que verificou e, em seguida, reproduz a cadeia de hashes do livro-razão local. A
   máquina conectada que encaminha requisições ao nó também precisa da
   **chave service-role** do banco de dados (`MT_EVAL_SUPABASE_SERVICE_KEY`). Essa chave
   nunca é necessária no próprio nó isolado (air-gapped).
5. A partir de então, a máquina nunca entra em contato com uma rede — e uma execução
   selada pode ser feita para comprovar isso antes: `mt-eval node egress-check` (também aplicado
   automaticamente com `assert_airgap` na configuração do nó) recusa a operação quando
   uma rota, um teste (probe) ou DNS indicar qualquer saída para o exterior. Atualizações do SO são um evento
   deliberado, empacotado e verificado por hash — não um serviço em segundo plano.

## 3. Disciplina de transferência (todos os concursos, ambas as direções)

O air-gap é um *procedimento*, não um produto. O procedimento:

- A **unidade IN** transporta: os pacotes de modelos ou métodos submetidos e seu
  manifesto. Antes de qualquer execução, o nó verifica o hash de cada pacote
  em relação ao manifesto e executa a verificação de importações (ele recusa métodos
  que importam bibliotecas de rede — isso já está disponível hoje).
- A **unidade OUT** transporta: o manifesto de pontuação assinado — pontuações agregadas,
  os hashes de método/configuração aos quais pertencem, o topo do log de auditoria — e *nada
  mais*. Os resultados por segmento permanecem no nó sob o controle do organizador;
  publicá-los é uma decisão separada e deliberada da comunidade.
- Uma única direção por unidade, sempre. Uma unidade que esteve no nó nunca
  deve ser montada automaticamente em uma máquina online — monte-a com `noexec,nodev` e copie o
  manifesto manualmente.
- `mt-eval node manifest write <drive> --direction in|out` gera o hash de cada
  arquivo na unidade antes de cada transferência; `mt-eval node manifest verify`
  no lado receptor recusa qualquer item adicionado, alterado ou ausente.
- Registre cada transferência (data, unidade, hash do manifesto) no registro em papel ou
  no log interno do nó. A monotonia é o objetivo: o registro é o que permite responder "algo
  mais saiu da máquina?" com evidências.

## 4. Custódia de chaves (M-de-N, mantida pela comunidade)

O conjunto de teste selado é criptografado em repouso; a descriptografia exige um quórum de
frações de chave mantidas por custodiantes que **a comunidade escolhe** — um conselho de
Anciãos, uma autoridade linguística, um órgão de educação. O projeto concede à
plataforma zero frações, portanto o Champollion não conseguiria descriptografar um conjunto selado, e
nenhum custodiante sozinho conseguiria fazê-lo. A cerimônia abaixo ainda não
foi realizada com custodiantes reais.

A cerimônia (uma sessão offline; as ferramentas fornecidas a automatizam):
`mt-eval node ceremony init` gera a chave do conjunto no nó, divide-a
em N partes (quaisquer M reconstroem; menos que isso não revela nada — o compartilhamento é
baseado na teoria da informação) e zera a chave no mesmo instante; `ceremony share`
emite a parte de cada custodiante como um arquivo para um token, além de um
backup em papel imprimível; `ceremony verify` prova que as cópias distribuídas
se reconstroem — sem persistir nada; `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` criptografa o corpus para a chave pública da cerimônia: o nó armazena
o texto cifrado e um cartão de metadados sem conteúdo, nada mais. A partir de então,
executar uma avaliação significa que os custodiantes apresentam fisicamente M de N partes
(`node run-method --offline --share …`): a chave é reconstruída **apenas na
memória bloqueada do executor**, usada para aquela única execução vinculada à concessão,
e zerada — ela nunca mais toca o disco. Cada solicitação, voto, concessão e uso
é anexado a um registro local encadeado por hash (`node ledger verify`), e uma
tentativa sem quórum é recusada *e* registrada.

Uma frase honesta sobre o mecanismo: trata-se do compartilhamento de segredos de Shamir
com reconstrução na memória da máquina offline mantida pela comunidade —
não é computação multipartidária. Durante uma execução autorizada, a chave existe
brevemente, montada, no hardware que a comunidade controla fisicamente; as
propriedades que ela defende são *nenhuma chave permanente no disco*, *nenhuma execução sem a presença de um quórum* e *cada uso encadeado no registro inspecionável*.
A assinatura de limite no lado da plataforma, onde a chave nunca é montada em lugar nenhum,
continua sendo um trabalho futuro e é rotulada como tal onde quer que seja mencionada.

A rotação e a substituição de custodiantes executam a cerimônia novamente; a perda de mais de
N−M partes significa que o conjunto é selado novamente a partir da cópia de origem da comunidade —
a comunidade sempre retém seu próprio original em texto simples, porque a
[posse](/docs/network/sovereignty/data-sovereignty) nunca foi nossa para manter.

## 5. O que "atestado" significa aqui — e o que não significa

Cada avaliação produz um **manifesto de pontuação assinado**: a assinatura do nó
sobre as pontuações, os hashes do pacote de métodos, o checksum do corpus e o
cabeçalho do log de auditoria de apenas anexação (append-only). Qualquer pessoa que possua a chave
pública publicada do nó pode verificá-lo — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` — de que *este nó* produziu *estas pontuações*
para *estas entradas exatas*, e o log encadeado por hash torna detectáveis as edições silenciosas no histórico.

Isso é **atestado de software** — prova a integridade do registro e
é o que a v1 oferece. Isso **não** prova qual silício executou a rodada:
o atestado remoto de hardware (TEEs) é um trabalho futuro e deliberadamente não é
reivindicado. A declaração de segurança honesta para a v1: a disciplina do organizador
(§3) mais os manifestos assinados mais a custódia física da máquina pela comunidade
formam a âncora de confiança — que é exatamente onde um design que prioriza a soberania
quer que a confiança resida de qualquer maneira.

## 6. O ciclo de operação

1. Anuncie o concurso; publique a chave pública do nó + limite mínimo do dev-set.
2. Receba as submissões online (máquina comum), monte o manifesto IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Leve a unidade IN até o nó; verifique os hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   a proposta chega como *pendente*. O nó a verifica primeiro (`node run-method
   <id> --offline` reexecuta o qualificador do participante no dev set público
   e verifica um runtime de contêiner para uma submissão de código, não abre nada selado e
   registra a aprovação no livro-razão local). Em seguida, um custodiante registra a decisão
   no nó (`node approve <id> --offline --actor <custodian>`, recusada
   até que essa verificação tenha passado, ou `node deny … --offline --reason …`: um voto
   + autorização no livro-razão local e um registro assinado com a chave do nó;
   `node list --offline` mostra o que está aguardando). A execução selada (`node run-method
   --offline` novamente) recusa uma proposta pendente até que essa aprovação seja
   registrada e verificada.
4. Os custodiantes autorizam a execução apresentando um quórum de frações (§4 —
   `node run-method <id> --offline --share … --share …`); o conjunto selado é
   descriptografado apenas para dentro do executor. Sem quórum, sem execução — e a tentativa
   fica registrada no livro-razão.
5. Execução; pontuações calculadas; saídas por segmento retidas no nó.
6. Desmonte: texto puro de trabalho apagado; log de auditoria anexado; manifesto assinado.
7. Leve a unidade OUT de volta; publique as pontuações + manifesto; qualquer pessoa pode verificar
   (`node verify-manifest`).
8. Registre a transferência; as unidades permanecem dedicadas; o nó permanece desconectado.
