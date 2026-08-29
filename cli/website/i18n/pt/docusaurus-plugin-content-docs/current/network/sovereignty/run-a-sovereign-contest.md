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

- ✅ **Ao vivo:** registro de corpus (cartões de metadados, fixação de hash, faixas de exposição), o registro de conjunto selado (digest + grupo de custodiantes + qualificador, sem conteúdo), a mecânica do concurso com a faixa selada, a camada de dados de solicitação/concessão/auditoria de autorização (pendente → decisão M-de-N → concessão de uso único com limite de tempo, log de auditoria encadeado por hash apenas para anexação) e emissão apenas de pontuações aplicada na camada de banco de dados.
- ✅ **Ao vivo: o nó de pontuação do organizador + faixa de hipóteses.** Um comando divide seu corpus em um conjunto de desenvolvimento público (o qualificador), um conjunto de teste cego (fonte liberada, referências seladas em repouso na SUA máquina) e, opcionalmente, um conjunto totalmente secreto (`mt-eval contest prepare`). O registro do(s) conjunto(s) selado(s), qualificador e concurso é **self-service a partir do seu próprio login** — `contest prepare --self-serve`, ou `mt-eval contest register --manifest` para um concurso que você preparou anteriormente — com cada linha vinculada à identidade na camada de banco de dados; sem curador no circuito e sem chave privilegiada (veja o Passo 4 para os limites honestos). Os participantes enviam suas traduções com `mt-eval contest submit-hypotheses` (a CLI auto-pontua o conjunto de desenvolvimento localmente e recusa uploads abaixo do seu limite); SEU nó auto-hospedado (`mt-eval node serve`) re-pontua a evidência de desenvolvimento por si mesmo, controla o acesso no qualificador, autoriza de acordo com o modelo do seu concurso (`per-submission` — um custodiante aprova cada pontuação — ou `blanket` / `open`), pontua o conjunto cego contra referências que nunca saem da sua máquina e publica cartões de execução **apenas com agregados**. O que esta faixa NÃO prova: que o método nomeado produziu as hipóteses (a identidade do método é reivindicada pelo participante e rotulada como tal em cada cartão de execução), e não pode impedir que um adversário determinado extraia o sinal de referência através de muitos envios distintos — limites de taxa, desduplicação idêntica por byte e a cadeia de auditoria retardam isso; a faixa de execução de método abaixo é a verdadeira resposta.
- ✅ **Ao vivo: duas faixas de método de conjunto secreto.** Participantes com um registro publicado na faixa de hipóteses podem propor seu método contra o seu conjunto secreto. O nó escolhe a faixa a partir do envio:
  - **Faixa A — modelo declarativo (preferencial).** Um modelo neural padrão é DADOS: `mt-eval contest submit-model` envia pesos safetensors + um tokenizador declarativo + uma configuração — **sem código, sem Dockerfile.** Seu nó valida que ele é livre de código (safetensors não pickle; sem `trust_remote_code`/`auto_map`; apenas arquivos de dados) e executa os pesos em seu PRÓPRIO motor confiável (`transformers`, `trust_remote_code=False`, offline). A arquitetura é permissiva por padrão (qualquer uma que seu motor carregue nativamente); um host cuidadoso pode fixar uma lista de permissões (allowlist). Nada não confiável é executado, então não há nada para colocar em sandbox. `declarative-model` publicado, identidade do método **livre de código por construção**.
  - **Faixa B — pacote executável (fallback de sandbox).** Para métodos que SÃO código: `mt-eval contest submit-method` envia um Dockerfile + entrypoint. Após a aprovação do seu custodiante, SEU nó o executa dentro de um contêiner isolado da rede (`--network=none` — a pilha de rede não existe lá dentro; root somente leitura, capacidades removidas, ambiente sanitizado), com verificações estáticas automatizadas primeiro e referências nunca entrando no contêiner. `method-execution` publicado com identidade **verificada por execução**.
  Em qualquer uma das faixas: o hash do pacote é congelado na solicitação de autorização (o que é executado é comprovadamente o que foi proposto), e as pontuações são publicadas através do mesmo caminho apenas de agregados. Para isolamento máximo, a máquina de pontuação pode ser um verdadeiro airgap: solicitações autorizadas e pacotes apenas de pontuações assinados por Ed25519 cruzam por mídia removível (`mt-eval node relay` / `import-bundle` / `export-scores`) — o texto secreto nunca chega nem mesmo à máquina conectada. O que essas faixas NÃO incluem ainda: atestado de hardware do nó (a identidade é auto-relatada), maquinário formal de disputas e — para a Faixa B especificamente — endurecimento mais profundo do contêiner além da pilha de rede removida (perfis seccomp, microVMs; esta é uma razão para preferir a Faixa A). Veja [Limitações Honestas](/docs/network/honest-limitations).
- 🔲 **Em desenvolvimento: assinatura de limite (threshold signing).** A aprovação de custodiante M-de-N é *registrada* nas tabelas de autorização e auditoria hoje; as ferramentas criptográficas de chave de limite que tornam uma concessão impossível de ser cunhada sem M partes ainda não foram construídas — a chave de selagem atual é um substituto de par de chaves único rotulado (`champollion seal-corpus keygen`), e a assinatura do pacote de pontuação airgap é uma chave de nó única (`seal-corpus sign-keygen`), não uma cerimônia de administradores (stewards).
- ❌ **Não é uma funcionalidade, por design:** O Champollion hospedar seu corpus, guardar suas chaves ou guardar fundos de prêmios. As hipóteses dos participantes (suas próprias traduções) transitam pelo nosso armazenamento; o conteúdo do seu corpus nunca o faz.

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

- **docker ou podman** — obrigatório para a faixa de execução de métodos. O nó detecta automaticamente docker, depois podman; se nenhum estiver presente, ele recusa com clareza. Não há **fallback** — o isolamento de contêiner com `--network=none` é a garantia estrutural, então nada é executado sem um runtime de contêiner.
- **Node.js 20.11+ e a CLI npm `champollion`** — o harness não reimplementa a cifra de selagem. `champollion seal-corpus` (verbos: `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`) é a única implementação de cifra (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), e o nó do organizador a executa.
- **Uma configuração de nó em `~/.mt-eval/node.json`.** Todo comando `mt-eval node` recusa iniciar sem uma — execute qualquer um deles uma vez e a mensagem de erro nomeia o caminho da configuração e onde o template reside (ele vem na fonte do harness, em `mt_eval_harness/contest_node.py`). A configuração carrega seu `node_id` auto-relatado (vinculado a cada impressão digital de requisição) e um mapa `contests` apontando para suas referências de desenvolvimento e artefatos selados.
- **Um sign-in.** Não há uma etapa separada de criação de conta: o primeiro comando que precisa de uma identidade (por exemplo, `mt-eval contest prepare --self-serve` ou `mt-eval publish`) abre um sign-in OAuth via navegador com **GitHub ou Google** (Supabase Auth). O email dessa conta é a identidade à qual toda linha do registro está vinculada — use um que sua organização controle.
- **O acelerador de intake.** Os envios de participantes são limitados por taxa por remetente a **5 por 24 horas por padrão** (anti-probing; definido por contest com `--intake-daily-limit` no tempo de preparação, ou como padrão de edição de tarefa compartilhada). Orçamente sua linha do tempo de contest em torno disso.

**Uma ressalva honesta sobre registro de autoatendimento.** No **endpoint padrão hospedado em rede**, o registro de autoatendimento (`contest prepare --self-serve` / `contest register`) atualmente para em uma guarda de endpoint de produção: a CLI recusa com uma mensagem explícita em vez de escrever no projeto de produção, pendente uma decisão de política sobre abrir essa porta. Hosts federados (seu próprio projeto Supabase) não são afetados. Se você atingir a guarda no host padrão, esse é o estado atual do mundo, não uma configuração incorreta da sua parte — [abra uma issue](https://github.com/gamedaysuits) e nós orientaremos o registro.

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

O manifesto permanece em sua máquina — o registro envia apenas os ids, resumos e
limites sem conteúdo. Cada linha de registro é **vinculada à identidade**: o
banco de dados registra a conta conectada que a registrou e congela essa
vinculação contra edições posteriores, e um qualificador pode apenas controlar
um conjunto selado que a **mesma** identidade registrou. Os conjuntos selados
nascem em quarentena (nunca podem apoiar um concurso ordinário ou classificar
no leaderboard público), os qualificadores nascem em um estado seguro, e o
registro é limitado por taxa — tudo aplicado por gatilhos de banco de dados
sob cada cliente, incluindo o nosso. O próprio registro é publicamente legível,
então você pode verificar que sua entrada diz exatamente o que você selou — e
nada mais.

**Limites honestos.** A porta de autoatendimento é apenas registro (apenas
inserção na camada de banco de dados). **A rotação de qualificador e a
aposentadoria de conjunto selado permanecem mediadas por curador** — abra uma
issue ou entre em contato com o projeto via
[GitHub](https://github.com/gamedaysuits). E executar o nó de pontuação do
organizador nas etapas posteriores (avanços de ciclo de vida, concessões de
autorização, operações de auditoria) é uma pista separada com credencial de
serviço em seu próprio nó — o autoatendimento para no registro público.

## Etapa 5 — Escolha curadores e a regra M-de-N

Escolha as pessoas ou instituições que devem aprovar conjuntamente cada
avaliação contra seu corpus, e o limite (por exemplo, **3 de 5**). Os curadores
devem ser responsáveis perante sua comunidade, não perante Champollion — veja
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) e
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer) para como os
termos por comunidade são definidos.

**Caixa de honestidade:** a ferramenta de *criptografia* de limite (compartilhas
de chave de modo que uma concessão literalmente não possa ser cunhada sem M
assinaturas) está **em desenvolvimento**. Hoje, a regra M-de-N é aplicada como
processo registrado: cada solicitação de acesso entra em uma fila **pendente**,
as decisões do curador são registradas, uma concessão é cunhada apenas para uma
solicitação autorizada, cada concessão é **única, com limite de tempo e
vinculada a um fingerprint específico (método, versão de corpus, nó de
avaliação)**, e cada evento — incluindo tentativas bloqueadas — chega a um
**log de auditoria apenas para anexação, encadeado por hash e publicamente
legível**. O banco de dados recusa transições de estado ilegais sob cada cliente
e chave. O que não pode recusar ainda é um comprometimento do próprio operador
da plataforma — é isso que a assinatura de limite fecha, e até que seja
lançado você deve tratar "Champollion mantém zero compartilhas de chave" como o
objetivo de design sendo construído, não uma propriedade que você pode verificar
hoje.

## Etapa 6 — Defina o prêmio

Decida e publique com o concurso:

- **Valor e moeda.**
- **Patrocinador** — quem está colocando o dinheiro.
- **Onde os fundos ficam** — a conta de sua organização ou um fundo comunitário
  que você designar. **Champollion nunca mantém, caução ou roteia fundos de
  prêmios.** Publicar a identidade do detentor antecipadamente é o que torna o
  prêmio credível; veja a [nota de risco padrão do patrocinador](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  nos modelos de termos.
- **Condições de limite** — a barra de pontuação que um método deve limpar,
  escrita de acordo com a [Prize Specification](/docs/network/specifications/prizes):
  limites de métrica, requisitos de validação de falante, reprodutibilidade.
  Torne as condições de premiação verificáveis a partir das pontuações
  publicadas, para que ninguém tenha que confiar em você (ou em nós) sobre se a
  barra foi ultrapassada.

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
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(O valor `--corpus` é seu `sealed_set_id` registrado. A pista selada é
selecionada **automaticamente** a partir do registro de conjunto selado — sem
sinalizador extra; um conjunto selado nunca pode apoiar um concurso ordinário e
um dataset ordinário em quarentena nunca pode apoiar qualquer concurso. Ambas
as regras são aplicadas no banco de dados, sob cada cliente. Se você registrou
na Etapa 4 com `contest register` ou `prepare --self-serve`, a linha de concurso **já
existe** — pule esta etapa; `contest create` à mão é apenas para montar um
concurso a partir de um conjunto selado já registrado.)*

## Etapa 8 — Métodos se qualificam em público primeiro

Os desenvolvedores constroem e pontuam seus métodos em corpora **públicos** para
seu par de idiomas — o caminho normal de
[submit-a-method](/docs/network/getting-started/submit-a-method). O
`current_qualifier_id` de seu conjunto selado nomeia a rodada pública que um método
deve limpar antes que uma execução selada possa ser solicitada. Isso mantém a
pressão de sondagem longe de seu corpus: ninguém consegue mirar no conjunto
selado até mostrar desempenho real em aberto.

:::note[Participantes: em qual endpoint seu contest reside?]
Um contest **hospedado em rede** não precisa de configuração — o endpoint padrão que o harness vem com carrega a maquinaria de contest (intake de hipóteses, a porta do qualificador, propostas de método), e `mt-eval contest submit-hypotheses` / `submit-method` funcionam fora da caixa.

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

Para cada método qualificado:

1. Uma **solicitação** é apresentada contra seu conjunto selado — ela entra em
   `pending` e carrega um fingerprint imutável de (hash de tarball de
   método, id de corpus, versão de corpus, `scores-only`, medição de nó de
   avaliação).
2. Seus **curadores decidem** (M-de-N). A aprovação cunha uma **concessão**:
   única, expirando, válida apenas para esse fingerprint exato.
3. A avaliação é executada no sandbox isolado de rede em **seu** nó
   (`mt-eval node run-method`): verificações estáticas automatizadas, um contêiner sem
   pilha de rede, referências mantidas fora dele — ou, para isolamento máximo,
   em uma máquina verdadeira de airgap com pacotes apenas de pontuações
   assinados cruzando por mídia removível (veja a caixa de status acima para o
   que é e não é coberto).
4. **Apenas pontuações saem.** A regra de emissão `scores-only` é fixada na
   camada de banco de dados; texto por entrada de seu corpus nunca é publicado.
5. Cada etapa — solicitação, votos, concessão, uso e qualquer tentativa
   bloqueada — é anexada ao log de auditoria público e encadeado por hash que
   você (e qualquer pessoa) pode reproduzir.

## Enviando um método (para participantes) — duas faixas

A maioria das entradas de NMT não é exótica: um transformer padrão com fine-tuning e seus pesos. Para esses, há uma **faixa preferencial, livre de código** — e um fallback de sandbox para métodos que genuinamente são código.

### Faixa A — modelo declarativo (preferencial para NMT padrão)

Se o seu método for um modelo neural padrão, você o envia como **dados** — os pesos, o tokenizador e a configuração — e o organizador o executa em seu próprio motor de inferência confiável. **Sem Dockerfile, sem código, sem sandbox.** Como nada do que você envia é executado, a verificação de segurança do organizador é uma validação de formato decidível em vez de tentar provar que um código arbitrário é seguro — uma garantia estritamente mais forte para você e para o corpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

As regras que seu pacote deve satisfazer (validadas localmente antes do upload e novamente pelo nó do organizador):

- **Os pesos são `safetensors`, nunca pickle.** Um `.bin`/`.pt`/`.ckpt` do PyTorch é um pickle — código arbitrário no carregamento — e é recusado. Exporte para `model.safetensors` (`safetensors` / `transformers` fazem isso nativamente).
- **Uma arquitetura que o motor do organizador carrega nativamente.** O `architectures` do `config.json` pode ser qualquer arquitetura que o `transformers` do host implemente (Marian, NLLB/M2M100, mBART, T5, Pegasus e muitas outras) — os hosts são **permissivos por padrão**, porque com `trust_remote_code=False` a segurança vem do formato livre de código, não do nome da arquitetura (uma arquitetura não suportada simplesmente falha ao carregar, não executando nada). Um host cuidadoso pode publicar uma lista de permissões (allowlist). Sem `auto_map`, sem `trust_remote_code` — eles contrabandeiam código personalizado de volta e são sempre recusados.
- **Um tokenizador declarativo** (`tokenizer.json` ou um `.model` do `sentencepiece` + vocabulário), e **apenas arquivos de dados** — sem `.py`/scripts/binários no pacote.

O organizador o executa com `trust_remote_code=False`, offline, e apenas as pontuações saem — publicadas como `declarative-model`, identidade do método **livre de código por construção**. (Pesos de vários GB: use `--bundle-out` para a faixa sneakernet, o mesmo que abaixo.)

### Faixa B — pacote executável (o sandbox, para métodos de código)

Se o seu método for genuinamente código — um pipeline, um híbrido treinado por LLM, um decodificador personalizado — ele não pode ser executado declarativamente, então ele passa pelo sandbox isolado da rede. Esta é a faixa honestamente mais fraca (ela contém código não confiável em vez de se recusar a executá-lo), portanto, use a Faixa A sempre que seu método for um modelo padrão.

**O contrato do runnable-bundle é stdin/stdout.** Seu bundle declara um entrypoint (por exemplo, `method/translate.py`). Dentro do contêiner, o nó do organizador executa exatamente:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Sentenças de origem chegam uma por linha em stdin; você escreve uma tradução por linha em stdout. Tudo o que você passou como `--method-dir` é empacotado sob `method/` no bundle e montado **somente leitura em `/method`** em tempo de execução — pesos incluídos, sem necessidade de copiar para a imagem. O contêiner não tem pilha de rede (`--network=none`), raiz somente leitura e `/tmp` gravável.

**Um wrapper mínimo de Hugging Face transformers:**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Envie com:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(Você precisa de um registro de faixa de hipóteses publicado para o contest primeiro — porta T1 da Etapa 9 — e `--agree` reconhece os termos de envio de método.)

**Pesos multi-GB: use a faixa sneakernet.** O caminho de intake hospedado carrega seu tarball como um **único POST** para o armazenamento do host do contest, então é limitado pelo limite de upload de armazenamento desse host — bom para código e modelos pequenos, não para checkpoints multi-GB. O contrato do bundle em si permite artefatos muito maiores (tarballs até 100 GB, imagens construídas até 150 GB). Para pesos grandes, pule o upload hospedado:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

O diretório de troca viaja para o organizador por mídia removível (ou qualquer canal em que vocês dois confiem); eles o ingerem com `mt-eval node import-bundle`. O SHA-256 do bundle é congelado na requisição de autorização de qualquer forma, então o que é executado é comprovadamente o que você propôs.

**Organizadores: pré-carregue imagens base em máquinas airgap.** Como a construção de imagem é executada com `--network=none`, a imagem base `FROM` do Dockerfile já deve estar no armazenamento de imagens local da máquina. Em uma máquina conectada, `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; leve `base.tar` com o bundle; na máquina airgap, `docker load -i base.tar` antes de executar `mt-eval node run-method`. Concorde sobre a(s) imagem(ns) base com participantes em seus materiais de contest publicados.

## Etapa 10 — Publique pontuações, conceda de acordo com seu limite publicado

Resultados apenas de pontuações são publicados no
[leaderboard](/docs/network/leaderboard/rules) como qualquer outra execução,
marcados como avaliações de conjunto selado. Se um método limpar as condições
de limite que você publicou na Etapa 6 — incluindo
[validação de falante](/docs/network/specifications/speaker-validation), que é
a porta de sua comunidade, não uma automatizada — **você** (ou seu fundo)
concede o prêmio, de acordo com seus próprios termos publicados. O papel de
Champollion termina na medição.

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
