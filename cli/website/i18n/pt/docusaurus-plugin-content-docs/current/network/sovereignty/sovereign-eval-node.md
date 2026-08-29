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

:::info[O que está disponível hoje vs. o que está marcado como em andamento]
O software do nó organizador (preparação do concurso, recebimento de hipóteses, pontuação controlada por limite, o executor de métodos isolado da rede com seu import scan) **ships today** in `mt-eval` — see the
[guia de concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest).
A **cerimônia de chaves de limite (threshold key) e o fluxo de trabalho selado em repouso (sealed-at-rest) do §4 também estão disponíveis hoje**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, partes de quórum apresentadas em tempo de execução
(`node run-method --offline --share …`), um registro de autorização local encadeado por hash (`node ledger verify|head`), manifestos de pontuação assinados
(`node sign-manifest` / `node verify-manifest`) e as ferramentas de air-gap do §2–§3 (`node bundle`, `node manifest`, `node egress-check`). O
substituto de par de chaves único permanece apenas para concursos onde o organizador
detém as referências de forma integral — cada superfície indica qual via está em
uso. Dito de forma clara, o que a v1 **não** inclui: atestado remoto de hardware (TEE) não é reivindicado (§5), e a *assinatura* de limite no lado da plataforma (aprovações por telefone dos custodiantes contra infraestrutura hospedada) é um
trabalho futuro — em um nó soberano, a custódia é exercida apresentando fisicamente
M de N partes na máquina (§4). E para ser preciso sobre a
criptografia: trata-se do compartilhamento de segredos M-de-N de Shamir com a chave
**reconstruída na memória bloqueada do nó durante uma execução autorizada**
(e depois zerada) — *não* é computação multipartidária, e a chave existe
brevemente montada em sua máquina offline. Por fim, até que o
portão de consentimento da comunidade seja aberto, a via é executada **apenas contra dados
sintéticos**; corpora reais aguardam esse consentimento.
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

1. Instale um Linux LTS atual (Ubuntu/Debian) a partir de um instalador USB **com o cabo de rede desconectado**; ative a criptografia de disco completo na instalação.
2. Em uma máquina separada e online, crie o pacote offline —
   `mt-eval node bundle --out <dir>` wheels `mt-eval[node]` e suas
   dependências, copia quaisquer artefatos `--include` e grava um manifesto sha256
   sobre cada arquivo. Tudo o que o nó precisa atravessa no drive IN uma única vez.
3. Transfira o pacote no drive IN; verifique o sha256 de cada artefato
   em relação ao manifesto **no nó** antes de instalar
   (`mt-eval node bundle --verify <dir>`).
4. Crie o par de chaves de assinatura do nó (`mt-eval node keygen`) e registre
   sua metade pública — você a publicará para que qualquer pessoa possa verificar seus manifestos de pontuação (§5).
5. A partir de então, a máquina nunca mais vê uma rede — e uma execução selada pode
   ser feita para provar isso primeiro: `mt-eval node egress-check` (também imposto
   automaticamente com `assert_airgap` na configuração do nó) recusa quando uma
   rota, uma sondagem (probe) ou DNS mostra qualquer saída. As atualizações do sistema operacional são um evento deliberado,
   empacotado e verificado por hash — não um serviço em segundo plano.

## 3. Disciplina de transferência (todos os concursos, ambas as direções)

O air-gap é um *procedimento*, não um produto. O procedimento:

- **Drive IN** carrega: pacotes de métodos enviados, arquivos de hipóteses e
  seu manifesto. Antes de qualquer coisa ser executada, o nó verifica o hash de cada pacote
  em relação ao manifesto e a varredura de importação é executada (ele recusa métodos
  que importam bibliotecas de rede — isso já está disponível hoje).
- **Drive OUT** carrega: o manifesto de pontuação assinado — pontuações agregadas, os
  hashes de método/configuração aos quais pertencem, o cabeçalho do log de auditoria — e *nada
  mais*. As saídas por segmento permanecem no nó sob o controle do organizador;
  publicá-las é uma decisão separada e deliberada da comunidade.
- Uma direção por drive, sempre. Um drive que tocou no nó nunca
  é montado automaticamente em uma máquina online — monte-o `noexec,nodev` e copie
  o manifesto manualmente.
- `mt-eval node manifest write <drive> --direction in|out` faz o hash de cada
  arquivo no drive antes de uma travessia; `mt-eval node manifest verify`
  no lado receptor recusa qualquer coisa adicionada, alterada ou ausente.
- Registre cada travessia (data, drive, hash do manifesto) no log em papel ou
  no próprio nó. Ser entediante é o objetivo: o log é o que permite responder "alguma
  outra coisa já saiu?" com evidências.

## 4. Custódia de chaves (M-de-N, mantida pela comunidade)

O conjunto de testes selado é criptografado em repouso; a descriptografia requer um quórum de
partes da chave mantidas por custodiantes que **a comunidade escolhe** — um conselho de
Anciãos, uma autoridade linguística, um órgão educacional. A plataforma não detém nenhuma
parte; o Champollion não pode descriptografar um conjunto selado, e nenhum custodiante individual pode fazê-lo sozinho.

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

1. Anuncie o concurso; publique a chave pública do nó + o limite do conjunto de desenvolvimento (dev-set threshold).
2. Receba as submissões online (máquina comum), monte o manifesto IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Leve o drive IN até o nó; verifique os hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods.
4. Os custodiantes autorizam a execução apresentando um quórum de partes (§4 —
   `node run-method <id> --offline --share … --share …`); o conjunto selado é
   descriptografado apenas no executor. Sem quórum, sem execução — e a tentativa
   fica no registro.
5. Execute; pontuações computadas; saídas por segmento retidas no lado do nó.
6. Desmontagem (Teardown): texto simples de trabalho apagado; log de auditoria anexado; manifesto assinado.
7. Traga o drive OUT de volta; publique as pontuações + manifesto; qualquer pessoa verifica
   (`node verify-manifest`).
8. Registre a travessia; os drives permanecem dedicados; o nó permanece isolado (dark).
