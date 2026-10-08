---
sidebar_position: 1
title: "Regras de submissão"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# Avaliação de MT

> **Resumo executivo.** Esta página define os critérios de envio para o leaderboard, a pontuação (chrF++ como métrica principal, acompanhada pelas métricas padrão e diagnósticos), políticas contra manipulação (anti-gaming), níveis de verificação e o fluxo de trabalho de envio. Métodos que tenham sido expostos aos dados de avaliação são desqualificados.

champollion inclui um framework de avaliação de tradução automática projetado para **benchmarking reproduzível** de métodos de tradução — especialmente para idiomas de baixo recurso e indígenas onde benchmarks padrão de MT não existem e afirmações de qualidade são difíceis de verificar.

---

## O Leaderboard

O elemento central é o **[Method Leaderboard](https://champollion.dev/leaderboard)** — um placar público, em tempo real e **aberto para envios**, onde pesquisadores e membros da comunidade enviam e comparam métodos de tradução com avaliação reprodutível e identificada por fingerprint.

Cada submissão inclui:

- **Pipeline com fingerprint** — vinculado a um commit específico do Git e ao hash de configuração, para que os resultados possam ser rastreados até o código exato que os gerou
- **Dataset versionado** — com hash de conteúdo e versionado; as pontuações só são comparáveis dentro da mesma versão do dataset
- **Métricas padronizadas** — toda a pontuação é calculada pelo harness de avaliação compartilhado, eliminando diferenças de implementação
- **Níveis de confiança** — self-benchmarked, Champollion Verified ou Community Validated
- **Rastreamento de custos** — custo de API por envio, tornando transparentes as compensações entre custo e qualidade

O leaderboard classifica as execuções da mesma forma que a WMT, o FLORES-200 e as shared tasks da AmericasNLP relatam avaliações de TA: por **uma métrica padrão, chrF++**, exibida com seu intervalo de confiança de 95% e assinatura sacreBLEU — por exemplo `chrF++ 47.5 [45.9, 49.0]`. Todo o restante é exibido ao lado, nunca mesclado a ela:

| Métrica | Função | O que mede |
|---------|--------|------------|
| **chrF++** | **Métrica principal e de classificação** | F-score de n-gramas de caracteres em relação à referência (sacreBLEU, `word_order=2`). Lida melhor com morfologia rica do que métricas em nível de palavra |
| **BLEU, spBLEU, TER, COMET** | Métricas padrão, ao lado da métrica principal | As outras métricas que artigos de TA relatam; COMET quando tiver sido calculada, com seu id de modelo |
| **Exact Match** | Diagnóstico | Frequência com que a tradução é exatamente igual à referência |
| **FST Acceptance** | Diagnóstico | Para idiomas com transdutor de estados finitos: qual proporção de palavras de saída são formas válidas. Não compara com a fonte ou referência, portanto nunca é uma pontuação |
| **Equivalent Match** | Diagnóstico | Fração que corresponde à referência ou a uma variante aceitável (ordem das palavras, convenção ortográfica). Atualmente CRK; em generalização. |
| **Semantic Score** | Diagnóstico | Preservação de significado, por um validador determinístico. Atualmente CRK; em generalização. |
| **Score caveats** | Exibidos ao lado da métrica principal | Quando as saídas copiam o original, são muito mais curtas ou mais longas do que as referências, repetem uma única saída para várias entradas ou quando as linhas de teste têm duplicatas nos dados de treinamento |

Se uma execução é melhor do que outra é algo decidido por um teste de significância pareado no chrF++, e não pela ordem de dois números — intervalos sobrepostos são um aviso de que a ordem pode ser ruído ([Statistical Significance Testing](/docs/network/specifications/significance)); rankings de competições usam o teste para formar clusters de classificação. O chrF++ classifica sistemas apenas dentro do mesmo dataset, nunca entre idiomas. Nenhuma pontuação automática confere um selo de qualidade — somente a revisão humana por falantes certifica a qualidade. O índice composto ponderado e os níveis de qualidade usados anteriormente foram descontinuados; o composto de um cartão antigo é exibido, se houver, como "legacy composite (retired)".

:::info[Conjunto completo de métricas]
A [Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored) define como as execuções são pontuadas e o inventário completo de métricas (seis categorias: de superfície, estruturais, semânticas, comportamentais, de conformidade e comparadores relatados).
:::

**[→ Ver o leaderboard](https://champollion.dev/leaderboard)**

---

## Datasets Disponíveis

Os elementos nos quais uma execução pode ser pontuada são listados pelas ferramentas, portanto esta página não mantém uma
lista própria:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

A página [Evaluation Datasets](/docs/network/leaderboard/datasets) descreve
o catálogo, o formato do corpus, os níveis de dificuldade, as vias de licenciamento
e como criar o seu próprio. Três regras desse catálogo decidem o que pode
ser classificado:

- **Um corpus em quarentena nunca é classificado.** Ele é catalogado, mas nunca executável,
  e o banco de dados recusa qualquer pontuação enviada para ele. Os corpora de inglês→cree das planícies
  da EdTeKLA (`eval-eng-crk-edtekla-dev-v1` e
  `eval-eng-crk-edtekla-textbook`) estão em quarentena. Eles utilizam uma licença CC BY-NC-SA modificada,
  com escopo de soberania
  (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) e estão excluídos de qualquer
  leaderboard, premiação e via comercial.
- **Um corpus contaminado classifica apenas de forma relativa.** O FLORES+, e qualquer corpus
  classificado como `HIGH` ou `MEDIUM` para contaminação ou não classificado,
  recebe o selo de comparação exclusivamente relativa em seu cartão de execução (run card). Ele compara métodos executados
  nesse corpus e nunca é relatado como qualidade absoluta. Apenas um corpus
  classificado como `LOW` é classificado com base em qualidade absoluta.
- **As vias de licença são mantidas.** Um corpus não comercial fica fora de caminhos comerciais e
  de premiação. Um corpus sob uma concessão modificada, personalizada ou não declarada recusa
  a avaliação remota por API de modelos até que a permissão do detentor dos direitos seja
  registrada em sua entrada.

**Competições são executadas em conjuntos selados mantidos pelo anfitrião.** Uma competição não é pontuada em
nenhum desses corpora públicos. O anfitrião, seja uma comunidade ou organização, mantém
um conjunto de teste selado e reservado (held-out) em sua própria infraestrutura. Os participantes se qualificam no
conjunto de desenvolvimento público disponibilizado pelo anfitrião e, em seguida, entregam ao nó do anfitrião um modelo ou um
método para executar. Os custodiantes do anfitrião autorizam cada execução, e apenas as pontuações
são divulgadas. Consulte [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[NÃO TREINE com dados de avaliação]

**Estes datasets são apenas para avaliação.** Métodos treinados, fine-tuned, few-shot-prompted ou de outra forma expostos a dados de avaliação produzirão pontuações artificialmente inflacionadas e serão **desqualificados do leaderboard.**

Isto não é uma sugestão — é a regra mais importante de integridade de avaliação. Use corpora separados para treinamento. Conjuntos de avaliação devem permanecer invisíveis para seu modelo durante o desenvolvimento.

Se você está usando dados de coaching ou exemplos few-shot, eles devem vir de **fontes completamente separadas**. Se tiver dúvida, não inclua.
:::

:::warning[Não-determinismo de LLM]

Saídas de LLM são não-determinísticas. Pontuações representam medições em um ponto no tempo sob versões de modelo específicas e configurações de API. Provedores de modelo podem atualizar pesos, estratégias de decodificação ou filtros de segurança a qualquer momento, o que pode causar drift de pontuação entre execuções. O leaderboard registra o slug de modelo exato e timestamp para cada submissão.
:::

---

## O Que Faz um Bom Método

Nem todos os métodos são criados iguais. Aqui está o que separa trabalho rigoroso de pontuações inflacionadas.

### Características de um método forte

- **Separação limpa de dados de treinamento e avaliação** — seu método nunca viu o conjunto de avaliação durante desenvolvimento, tuning, engenharia de prompt ou seleção de exemplos few-shot
- **Reproduzível** — alguém pode clonar seu repo, executar o harness e obter as mesmas pontuações (dentro dos limites de não-determinismo de LLM)
- **Documentado** — seu [method card](/docs/network/specifications/methods) descreve o que seu método faz, quais ferramentas usa e quais são suas limitações
- **Honesto sobre escopo** — se seu método funciona apenas para um par de idiomas, diga; se degrada em certos padrões morfológicos, documente isso
- **Consciente da comunidade** — para idiomas indígenas, seu método respeita soberania de dados. Você consultou comunidades de linguagem ou usou apenas dados com licença aberta

### Sinais de alerta (o que é desqualificado)

| Sinal de Alerta | Por Que É um Problema |
|-----------------|----------------------|
| Treinamento em dados de avaliação | Derrota completamente o propósito da avaliação. Pontuações inflacionadas enganam todos. |
| Cherry-picking de resultados | Executar 10 vezes e enviar a melhor execução sem divulgar as outras |
| Pós-processamento não divulgado | Corrigir manualmente saídas antes de pontuar |
| Dados de coaching contaminados | Usar exemplos do conjunto de avaliação como prompts few-shot ou entradas de dicionário |
| Afirmar prontidão comercial sem proveniência | Se seu método usa dados CC BY-NC-SA, não está pronto comercialmente |

### Níveis de verificação

Os níveis de verificação descrevem **quem validou o resultado**. Eles não são selos de qualidade (os antigos níveis automáticos de qualidade foram [descontinuados](/docs/network/specifications/scoring#5-quality-tiers)).

| Nível | Significado | Como obter |
|-------|-------------|------------|
| **Self-benchmarked** | Você mesmo executou o harness e enviou os resultados | Publique seu run card com `mt-eval publish` |
| **Champollion Verified** | O projeto recalculou de forma independente a pontuação das suas saídas enviadas em relação ao corpus de referência fixado por SHA e reproduziu sua pontuação | O re-scorer é uma ferramenta dos mantenedores, executada manualmente em lote. Nada o agenda, portanto nenhum envio é repontuado na chegada (veja abaixo) |
| **Community Validated** | Falantes bilíngues do idioma de destino, qualificados sob o protocolo da própria comunidade, revisaram uma amostra estratificada da saída (≥30 entradas, ≥2 revisores) e ≥70% atenderam ao padrão da comunidade. Concedido apenas pelos testes da própria comunidade; o rebaixamento por auditoria pontual é simétrico | Envie o código do método para a organização de governança — eles o executam contra o conjunto padrão-ouro e submetem a saída à revisão da comunidade |

**A avaliação validada pela comunidade é uma via separada, e ainda não existem pontuações de avaliação humana:** o harness pode selecionar quais sistemas um orçamento fixo de revisão humana cobriria a partir da classificação congelada de uma competição fechada (apenas grupos de empate inteiros — um cluster nunca é dividido ao meio), mas não registra classificações, e nada no leaderboard hoje traz um julgamento humano.

**As posições no ranking são clusters, não uma ordem estrita.** Entradas vizinhas que o teste de significância não consegue separar compartilham uma posição e exibem uma *faixa* de classificação; em uma competição selada, onde a saída por segmento nunca sai da máquina do organizador, o teste pareado é executado nessa máquina e apenas seus vereditos assinados são divulgados; sem eles, os empates baseiam-se em evidências de intervalo de confiança ou igualdade pontual. O funcionamento disso e a fragilidade de cada degrau na escala de evidências estão descritos em [Statistical Significance Testing → Ranking clusters](/docs/network/specifications/significance#ranking-clusters).

### Como a verificação escala: auditoria ponderada por reputação

**Não reivindicamos proveniência.** Uma linha no leaderboard é produzida por um colaborador
executando o harness de *código aberto* em sua *própria* máquina. "Esta execução realmente passou
pelo harness" não é algo que um servidor possa verificar para computação
auto-hospedada — a chave de assinatura do harness está nas mãos do colaborador, de modo que uma
assinatura autentica uma *máquina, não a honestidade*. Em vez de fingir
o contrário, **aqui a validade é conquistada e autocorretiva**: uma linha é confiável
porque sua pontuação é **reproduzível** e porque o colaborador por trás dela
**arriscou uma reputação que uma fraude detectada destruiria.** A verificação é
executada em quatro camadas, sendo minuciosa onde for necessário e econômica onde for possível
— o projeto nunca precisa reexecutar o trabalho de todos.

- **L0 — recalcular a pontuação de tudo (gratuito, ~100%).** O re-scorer calcula novamente sua
  pontuação a partir das *suas próprias saídas enviadas* em relação ao **corpus de referência
  fixado por SHA** (não da sua cópia armazenada dele), com a mesma métrica usada pelo harness.
  Se a pontuação não se reproduzir a partir das saídas, ou se uma referência armazenada tiver sido
  alterada, a execução é **desqualificada** — isso por si só elimina pontuações digitadas ou editadas.
  Uma execução que se reproduz é promovida para **Champollion Verified** — o
  nível que uma classificação de competição usa por padrão e o único nível elegível para
  premiação. O recurso está pronto e tem baixo custo, mas é um **comando de mantenedor, executado
  manualmente**: nada o executa no momento do envio e nada o agenda. Até que isso
  mude, cada linha chega — e permanece — como self-benchmarked.
- **L1 — uma escala de reputação de colaboradores.** Cada colaborador (identificado pelo seu
  login) ganha reputação *apenas* sobrevivendo às verificações mais profundas abaixo — nunca
  apenas por volume, de modo que criar novas identidades não traz vantagem alguma. A reputação é
  **pública** e determina com que frequência a verificação de alto custo é acionada.
- **L2 — reexecutar uma *amostra* (a verificação de alto custo; apenas política, sem re-runner
  por enquanto).** Para um conjunto de desenvolvimento *público*, o L0 não consegue capturar um colaborador que
  simplesmente copia a referência como sua "tradução". Detectar isso exige
  reexecutar o modelo de verdade — computação real —, portanto faríamos isso em uma
  **amostra**, e não em todos. A **política de amostragem** está implementada e testada: uma
  execução é selecionada com uma probabilidade que aumenta com a **relevância** (uma execução que
  abre a primeira ponte para toda uma família linguística é *sempre* selecionada),
  aumenta com a **anomalia** (um salto bom demais para ser verdade sobre o melhor resultado anterior é
  *sempre* selecionado) e diminui com a **reputação** (um colaborador que foi
  aprovado em muitas auditorias passa por checagens pontuais raramente; um novato ou remetente anônimo
  é verificado a cada execução até conquistar confiança). Ser aprovado em uma auditoria L2
  aumenta a reputação. **O re-runner que essa política conduziria não existe**,
  portanto nenhuma auditoria L2 foi acionada até o momento: uma execução selecionada é registrada como *L2-pending*.
- **L3 — corroboração (verificação gratuita).** Quando dois colaboradores *independentes*
  executam o mesmo modelo no mesmo corpus e suas saídas repontuadas **concordam**,
  essa concordância *é* uma verificação — e aumenta a reputação de ambos. Uma
  **divergência** genuína sinaliza ambas as execuções para uma auditoria L2. A replicação é
  recompensada em vez de ser tratada como redundante.

**Uma fraude comprovada é catastrófica — como uma retratação.** Uma fraude
comprovada zera a reputação do colaborador, **re-audita todo o seu histórico
verificado** (cada uma de suas execuções verificadas é enviada novamente para
verificação) e é registrada **publicamente** no log de auditoria. É isso que torna
segura a amostragem leve: fraudar um dev set público pode até passar despercebido em uma execução, mas
o custo esperado — perder toda a confiança conquistada e ter todo o seu histórico
reexaminado — torna essa uma aposta ruim. Essas regras se aplicam às execuções dos próprios
mantenedores de forma simétrica.

**Por que contribuir ainda vale a pena.** Você sempre arca com a parte cara
(executar o seu método); o projeto arca apenas com a repontuação gratuita L0 para todos
mais uma reexecução L2 em uma *amostra decrescente* — alta para novatos e execuções de alta
relevância, baixa para colaboradores comprovados. O custo de verificação é *amortizado pela reputação
e compartilhado pela corroboração*, não sendo pago integralmente a cada vez.

---

## Como Enviar

1. **Construa seu método** — consulte [Building a Method](/docs/network/specifications/methods) para obter a especificação da interface do método
2. **Execute o harness** — consulte [Eval Harness](/docs/network/specifications/harness) para configuração e uso
3. **Gere um run card** — o harness produz um run card em JSON com suas pontuações, fingerprint e metadados
4. **Publique** — `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` faz o upload do run card para o leaderboard (pré-visualize com `--dry-run`)
5. **Apareça no leaderboard** — sua execução é listada como *self-benchmarked (unverified)*. O [Method Leaderboard](https://champollion.dev/leaderboard) lista e classifica todas as linhas que não sejam `disqualified`, incluindo as self-benchmarked e identificadas como tal; filtre por *Champollion Verified* para ver apenas resultados repontuados. O recálculo de pontuação L0 que promove uma execução para esse nível é um lote executado por mantenedores, e nada o agenda; assim, hoje todas as linhas no placar são reivindicações auto-relatadas. Apenas verificado (Verified-only) é o padrão para a classificação de uma **competição**, e é o único nível elegível para premiação

---

## Política de integridade: retratações, reexecuções, deslistagem, disputas

Escritas com antecedência para que a aplicação seja procedimento, e não drama. Estas regras
vinculam a todos de forma simétrica — incluindo as execuções dos próprios mantenedores.

**Sem retratações.** Uma execução publicada é um registro permanente. Não existe
mecanismo — para ninguém — de excluir uma pontuação porque ela é embaraçosa.
Cada linha de execução traz um carimbo de data/hora `submitted_at` gerado pelo servidor e uma
trilha de auditoria imutável; as próprias ações de moderação são registradas em log.

**Reexecuções são anexadas, nunca substituem.** Se você aprimorar seu método, publique uma nova
execução. A execução antiga permanece. A divulgação seletiva — testar privadamente muitas
variantes e publicar apenas a vencedora — é o que tornou outros leaderboards
vulneráveis a manipulação; um registro somente de adição (append-only) é a resposta estrutural. A desduplicação
por fingerprint impede o spam de reenvios idênticos em bytes; ela nunca reescreve
a história.

**A deslistagem é a execução de regras, com a regra identificada.** Uma execução é deslistada
(marcada como `disqualified`, visivelmente — não removida silenciosamente) apenas por causas
listadas: um dataset em quarentena ou subconjunto impróprio (aplicado por trigger
do banco de dados abaixo de qualquer cliente), divergência de checksum do corpus, pontuações
forjadas ou fora do intervalo, violações de proteção de conteúdo (content-guard) ou a retirada do registro
dos dados subjacentes por um administrador (steward). A deslistagem cita a regra e as
evidências. Novas causas são adicionadas aqui por edição datada antes de serem
aplicadas, nunca inventadas retroativamente para um caso específico.

### Sinalização de um resultado

*Adicionado em 07/09/2026.*

:::caution[Ainda não estamos aceitando sinalizações]

O sistema de sinalização está construído e o banco de dados está pronto para ele desde 07/09/2026 — mas o
formulário para registrar uma sinalização ainda não foi reimplantado com essa integração, de modo que *Flag this
result* ainda não consegue enviar. Ele falha em vez de aceitar uma sinalização silenciosamente.
Envie um e-mail para `info@champollion.dev` enquanto isso. Este aviso será removido no dia em
que o formulário for disponibilizado.

:::

**Qualquer pessoa pode sinalizar um resultado.** Expanda a linha correspondente no leaderboard e use *Flag
this result*: isso abre um formulário de mensagem já vinculado ao id dessa execução, e você
explica o que acredita estar errado e como sabe disso — um corpus contaminado, uma
métrica que não corresponde ao seu rótulo, um método com atribuição incorreta ou qualquer outra questão. Uma
sinalização precisa apresentar um motivo. Uma sinalização sem justificativa é um voto negativo (downvote), e este placar
não tem downvotes.

**Uma sinalização é uma mensagem privada, não um voto.** Ela chega aos mantenedores como um
ticket e não vai para nenhum outro lugar. Nenhuma contagem de sinalizações é exibida — nem na
linha, nem no run card, em lugar nenhum —, pois uma contagem visível seria em si
um incentivo à manipulação, e a posição de um resultado deve se basear em evidências e não em
quantas pessoas se opuseram. O envio de uma sinalização, por si só, não altera em nada
a linha.

**Uma sinalização acolhida se manifesta de exatamente uma forma:** o resultado é marcado como
`disqualified`, por uma causa já listada nesta página. Como em qualquer outra
deslistagem, uma nova causa é adicionada aqui **por edição datada antes de ser aplicada a
qualquer pessoa** — de modo que uma sinalização nunca pode produzir uma regra secreta ou retroativa. Se uma
sinalização não for acolhida, a linha permanece inalterada e, se você informou um endereço de contato, receberá
uma resposta de qualquer maneira.

**Níveis de confiança são rótulos, não edições.** Linhas `self-benchmarked` são alegações;
linhas `Champollion Verified` foram repontuadas de forma independente a partir das
saídas do remetente em relação ao corpus fixado por SHA; `Community Validated` é
concedido apenas pelos testes da própria comunidade. A verificação altera o nível de uma
linha — ela nunca altera as pontuações da linha.

**A reputação é pública e autocorretiva.** A reputação do colaborador e o
log de auditoria que registra cada recálculo de pontuação, reexecução por amostragem, corroboração e
penalização por fraude são públicos. A reputação não é um multiplicador de pontuação e nunca
interfere nos números de uma execução — ela apenas define a frequência com que as execuções de um colaborador
são reauditadas (consulte *auditoria ponderada por reputação* acima). Uma fraude comprovada é
registrada tão publicamente quanto uma retratação e reaudita todo o histórico
verificado do colaborador; as mesmas regras se aplicam às execuções dos próprios mantenedores.

**Disputas.** Abra uma issue com o id da execução e a alegação específica (pontuação
incorreta, dataset incorreto, regra mal aplicada). Os mantenedores reexecutam as
verificações determinísticas em público; o resultado e suas evidências são publicados na
issue. Se a disputa for sobre os dados ou a validação de uma comunidade, a
autoridade da própria comunidade decide e o placar implementa a decisão tomada.
Para competições com premiação, aplicam-se as mesmas regras, além das etapas de qualificação
e auditoria previamente publicadas da competição — os vencedores são auditados **antes** do pagamento, e uma
desqualificação cita a regra exatamente como qualquer outra deslistagem.

## Direções Futuras

- **Execuções de comparação de modelo abrangentes** — avaliação sistemática de modelos de fronteira (GPT-4o, Claude, Gemini, etc.) em idiomas champollion usando corpora de avaliação customizados (não benchmarks públicos)
- **Mais pares de idiomas** — Quechua, Inuktitut e outros idiomas de baixo recurso conforme datasets verificados pela comunidade ficarem disponíveis
- **Importação de dataset** — ferramentas para converter datasets de avaliação externos (WMT, Tatoeba, etc.) no formato de avaliação champollion
- **Re-execuções automatizadas** — detectando mudanças de versão de modelo e re-executando benchmarks para rastrear drift de pontuação

---

## Veja Também

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — pontuações em tempo real e envios
- **[Eval Harness](/docs/network/specifications/harness)** — como executar avaliações
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — formato do dataset e datasets disponíveis
- **[Building a Method](/docs/network/specifications/methods)** — especificação da interface de métodos
- **[Run Card Specification](/docs/network/specifications/run-card)** — o schema JSON do run card
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — protocolo de avaliação, formato de corpus e soberania
- **[Scoring Specification](/docs/network/specifications/scoring)** — SSOT para métricas e como as execuções são pontuadas
