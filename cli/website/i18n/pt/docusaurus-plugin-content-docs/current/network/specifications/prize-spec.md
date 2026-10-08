---
sidebar_position: 8
title: "Especificação do Prêmio"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Especificação de Prêmio

Um prêmio é a metade de incentivo do compromisso de priorizar a avaliação (eval-first). Uma comunidade ou grupo de pesquisa faz a curadoria de um conjunto de avaliação pequeno e selado — algumas centenas de pares, cada um verificado ([Parceria de Corpus](/docs/network/specifications/corpus-partnership) é esse fluxo de trabalho). Um patrocinador oferece um prêmio atrelado a uma pontuação-alvo nesse conjunto. A partir desse momento, o idioma se torna um desafio permanente: qualquer desenvolvedor de métodos no mundo pode tentar alcançá-lo, o placar de líderes (leaderboard) mede cada tentativa publicamente e a régua é definida pelo próprio gabarito da comunidade, e não por quem fala mais alto. Este documento especifica como esse prêmio funciona — condições de limiar, processo de reivindicação, classes de dependência e regras — para que a régua seja inequívoca e independente de método quando um prêmio for aberto.

Os prêmios são **financiados e mantidos pelos patrocinadores**: o dinheiro fica com a organização patrocinadora ou com um fundo fiduciário comunitário designado pelo patrocinador — **o Champollion nunca retém, custodia ou roteia fundos de prêmios.** Qualquer comunidade ou organização pode realizar uma disputa no caminho de autoatendimento em [Realizar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest), mantendo seu próprio corpus e seu próprio dinheiro.

> **Status: PROPOSTO — nenhum prêmio está aberto e nada aqui pode ser reivindicado ainda.**
> O que condiciona a *abertura* de um prêmio é o lado da medição: um corpus padrão-ouro consentido pela comunidade e a validação por revisão de falantes. Nenhum dos dois existe ainda. A sandbox de avaliação isolada (air-gapped) já é distribuída — veja a [Especificação do Benchmark §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy). Nenhuma pontuação neste site atingiu o limiar de um prêmio. Consulte [Limitações Honestas](/docs/network/honest-limitations). Referência de métricas: a [Especificação de Pontuação](/docs/network/specifications/scoring); protocolo: a [Especificação do Benchmark](/docs/network/specifications/benchmark).

> **A camada de garantias (promise layer) está ativa.** O congelamento que torna um termo de prêmio declarado inalterável assim que existem inscrições, e os resultados retidos (`hidden_until_close`), são aplicados no banco de dados no endpoint hospedado na rede desde 07/09/2026. Um host federado obtém as mesmas regras aplicando a migração distribuída com o harness; em um endpoint mais antigo, o harness faz fallback para o conjunto base e informa isso em vez de fingir o contrário. A regra de saída exclusiva de agregados no §3.2 sempre foi aplicada em todos os lugares.

---

## Quer ajudar a trazer um idioma para a rede?

Você não precisa esperar por um prêmio. As coisas de maior impacto que você pode fazer hoje:

- **Patrocine um prêmio de conquista em TA.** Financie um critério direcionado — por exemplo, um método confiável de Inglês → Plains Cree. Champollion coordena a medição; os fundos ficam com **você** (sua organização, ou um fundo comunitário que você designa) e são concedidos nos termos da comunidade (veja
> [Soberania de Dados](/docs/network/sovereignty/data-sovereignty)
> e o [Modelo Econômico](/docs/network/sovereignty/economic-model)). O caminho de autoatendimento de ponta a ponta está documentado em
> [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest);
> trazer um novo par de idiomas começa com uma
> [parceria de corpus](/docs/network/specifications/corpus-partnership).
- **Coordene uma doação de computação.** Reúna créditos de API / tokens para que a fila pública possa mapear mais pares e mostrar onde a tradução está — e não está — ainda confiável.
- **Apoie as iniciativas de código aberto em que construímos — *diretamente*.** Champollion é encanamento que une o trabalho aberto de outras pessoas; apoiá-*los* é apoiar este mapa (preferimos apontá-lo para a fonte do que receber crédito pelo trabalho deles):
  - [Tatoeba](https://tatoeba.org) — sentenças paralelas contribuídas pela comunidade
  - [Catálogo de Idiomas em Perigo (ELCat)](https://www.endangeredlanguages.com) — dados de perigo
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — catálogos de idiomas e tipologia
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — os transdutores morfológicos (FSTs)
  - [Masakhane](https://www.masakhane.io) — comunidade de TA para idiomas africanos
  - [OPUS](https://opus.nlpl.eu) — corpora paralelos abertos

> Para patrocinar um prêmio, organizar uma doação de computação ou discutir uma parceria, entre em contato com o projeto pelo [GitHub](https://github.com/gamedaysuits). Nenhum custodiante de chaves comunitárias foi nomeado ainda, e nenhuma nação ou organização é mencionada como parceira antes de ter consentido.

---

## 1. Filosofia

> **O acordo em uma linha: decifre um idioma, vença, sob os termos declarados pelo host.**
> O Champollion é intencionalmente uma operação de benchmarking de ML — a competição é a forma como pares difíceis são resolvidos. Convidamos pesquisadores de ML e qualquer criador capacitado a construir o melhor método para um par de idiomas difícil específico e ganhar o prêmio. O que acontece com o método depois disso é uma escolha publicada pelo **host**, não nossa e não um padrão: uma comunidade que deseja que um método vencedor seja entregue declara isso em seus termos, e uma que deseja apenas avaliar e excluir declara isso em vez disso (§1.3). A energia competitiva é real e está direcionada à missão — obter a tradução de todos os idiomas, sob termos definidos por seu povo — e não a subir em um placar de líderes por si só.

### 1.1 Prêmios Recompensam Avanços, Não Participação

O dinheiro do prêmio é liberado apenas quando um método demonstra alcançar um limite de capacidade definido. Não há prêmios de participação, prêmios para segundo lugar ou pagamentos de consolação. Se ninguém passar do critério, ninguém recebe pagamento. Isso é intencional — significa que patrocinadores pagam apenas por resultados que realmente funcionam.

### 1.2 Validação Comunitária É Inegociável

Métricas automatizadas são proxies (SCORING_SPEC §1.1). Um método pode pontuar bem em chrF++ e aceitação de FST enquanto produz saída que nenhum falante aceitaria. **Toda reclamação de prêmio requer validação comunitária** — falantes bilíngues devem confirmar que a saída é utilizável. Este é o portão de validação humana (BENCHMARK_SPEC §7).

### 1.3 O que acontece com um método vencedor é declarado, não presumido {#1-3-declared-terms}

Uma coisa é fixa, porque é isso que um concurso soberano *é*: a inscrição é entregue ao nó isolado (air-gapped) do próprio host, que a executa contra um conjunto selado na máquina do host. O que acontece com ela *depois* é uma escolha declarada do host, feita por concurso e publicada com ele — e é **uma escolha entre três**:

| O termo | O que significa para você |
|---|---|
| `pass_to_holders` — *passar aos detentores* | O método passa para os detentores soberanos do benchmark. Eles avaliam e o mantêm, independentemente de quem vencer. |
| `retain_ip` — *manter PI* | Você mantém a propriedade do seu método. O host o avalia e mantém, no máximo, uma cópia selada para auditoria. |
| `release_open` — *liberar em código aberto* | Você mantém a propriedade, mas deve publicar o método sob uma licença aberta. Essa liberação é a condição para o prêmio. |

Tudo o que decorre de um termo — se o artefato é mantido, se algum direito é transferido, para que o host pode usá-lo, quando uma liberação vence — é **derivado** da opção escolhida pelo host (§2.1, condição 7), e não uma caixa separada para o host marcar. O host escolhe o termo; os detalhes seguem essa escolha.

Duas consequências que valem a pena ser declaradas claramente:

- **Um concurso sem termos de prêmio declarados não tem prêmio.** Esse é o padrão. Não é um concurso menor, e nada sobre a inscrição é transferido.
- **Nada é implícito.** O termo declarado é submetido a um hash, exibido ao participante em linguagem clara e aceito por meio desse hash; a aceitação viaja dentro da inscrição e é coberta pelo hash de conteúdo dela, e o nó do host recusa uma inscrição que tenha aceitado qualquer outra coisa. O termo é então congelado no momento em que o concurso recebe sua primeira inscrição, para que ninguém seja submetido a termos que não pôde ler.

Quando um host escolhe `pass_to_holders`, o desenvolvedor ainda mantém a atribuição e os direitos de publicação, e o objetivo do arranjo é que o dinheiro do prêmio financie tecnologia que a comunidade linguística possa de fato usar. Esse é um bom motivo para um host comunitário escolher esse termo. É uma escolha, não uma regra.

### 1.4 Anti-Gaming

Os limites de prêmio são definidos contra **avaliação padrão-ouro** (conjunto de testes secreto, executado pela organização de governança em caixa de areia). Os desenvolvedores nunca veem os dados de teste. Isso é aplicado arquitetonicamente — não uma política que depende de honra. Veja BENCHMARK_SPEC §8.2.

### 1.5 Licenciamento de Corpus: Corpora Não-Comerciais Ficam Fora da Pista de Prêmio

Alguns corpora usados durante o desenvolvimento do método possuem licenças não comerciais — por exemplo, o corpus do livro didático de língua Cree da EdTeKLA possui a **CC BY-NC-SA modificada da EdTeKLA** (com escopo de soberania, não comercial; o livro didático original é CC BY-NC-ND 4.0). Esses corpora são **exclusivos para a trilha de pesquisa/desenvolvimento**:

1. **Os corpora padrão-ouro de prêmio não devem incorporar conteúdo de corpus licenciado em NC.** Os segmentos de teste padrão-ouro são originais encomendados pela comunidade (veja Estratégia de Parceria de Corpus) — criados por humanos para o prêmio, com direitos esclarecidos para avaliação e implantação comercial desde o início.
2. **Um método que reclama um prêmio não deve incorporar conteúdo de corpus licenciado em NC** (por exemplo, como dados de coaching, exemplos incorporados ou tabelas de consulta). O método transferido deve ser implantável pela organização de governança em qualquer termo que escolha — incluindo comercialmente, se a comunidade assim decidir (BENCHMARK_SPEC §8.3); conteúdo licenciado em NC dentro dele envenenaria essa liberdade.
3. **Os desenvolvedores podem usar livremente corpora licenciados em NC para desenvolver e auto-avaliar** — é para isso que a pista de desenvolvimento existe. A restrição se aplica ao que é enviado e ao que é implantado, não a como um desenvolvedor aprende.

### 1.6 Classes de Dependência Bloqueiam Elegibilidade de Prêmio

Toda avaliação de prêmio acontece em uma caixa de areia (§1.4), e métodos vencedores de prêmio são transferidos para a organização de governança (§1.3). Ambos os fatos impõem a mesma restrição: **tudo de que um método depende deve ser algo que o desenvolvedor tem o direito de colocar na caixa de areia e transmitir à comunidade.** Cada envio declara uma classe de dependência — definida na [especificação de Interface de Método](/docs/network/specifications/methods#method-validity-and-dependency-classes) — e a elegibilidade segue a classe:

| Classe de dependência | Elegível para prêmio? | Condições |
|------------------|----------------|------------|
| **S** — autossuficiente | ✅ Sim | Nenhuma além das condições de limite em §2 |
| **O** — aberta externa (por exemplo, FST AGPL espelhado no envio) | ✅ Sim | Artefatos fixados e inclusos no envio; licenças permitem transferência comunitária; termos copyleft preservados (a comunidade recebe os mesmos direitos que a licença concede a todos) |
| **A1** — inferência de LLM substituível | ⚠️ Condicional | Modelo declarado, fixado e substituível (deve executar contra um modelo de peso aberto hospedado pela comunidade); avaliação roteada através do gateway de LLM da caixa de areia (🔲 planejado — métodos A1 não podem produzir pontuações padrão-ouro até que o gateway esteja operacional); transferência transmite a receita completa (prompts, coaching, código), não o modelo |
| **A2** — API de serviço/dados externos não-substituível | ❌ Ainda não | Inelegível até que o detentor de direitos conceda permissões de inclusão em caixa de areia e transferência. Permitido no placar aberto com uma bandeira visível de "dependência externa" |
| **X** — conteúdo agrupado sem direitos | ❌ Nunca | Inadmissível em todas as pistas |

A classe de um método é a classe mais restritiva entre suas dependências declaradas. Dependências não declaradas de qualquer classe são desqualificantes (§5).

---

## 2. Pools de Prêmios Propostos (nenhum aberto ainda)

### 2.1 O Prêmio do Fundador — EN→Plains Cree (nêhiyawêwin)

| Campo | Valor |
|-------|-------|
| **Premiação total** | **$10.000 CAD** (proposto) |
| **Par de idiomas** | Inglês → Plains Cree (EN→CRK) |
| **Patrocinador pretendido** | Fundador do projeto Champollion — um compromisso pretendido, **nenhum fundo está retido em lugar algum ainda.** Quando comprometidos, os fundos ficariam com o patrocinador ou com um fundo fiduciário comunitário designado — nunca com o Champollion. |
| **Status** | **PROPOSTO — não aberto.** Não aceita submissões. |
| **Abertura** | Somente quando o corpus padrão-ouro e a validação por revisão de falantes existirem (nenhum dos dois existe ainda), a sandbox de avaliação tiver sido comprovada com modelos reais (até agora ela executou apenas um método de teste) e os fundos do patrocinador estiverem comprovadamente retidos conforme o §4.2. |
| **Expiração** | Sem expiração após aberto. |

#### Condições de Limite

Um método reclama o Prêmio do Fundador atendendo **TODAS** as seguintes condições simultaneamente:

| # | Condição | Métrica | Limiar | Justificativa |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Pontuação composta~~ — **descontinuada** | — | — | Esta condição (composta ≥ 0,80) foi descontinuada junto com a pontuação composta em 04/10/2026 ([Especificação de Pontuação §4](/docs/network/specifications/scoring#4-composite-score)). A condição de pontuação é apenas o chrF++ (condição 3); o número é mantido para que as outras condições preservem sua numeração. |
| 2 | **Aceitação por FST** (uma barreira de diagnóstico, não a pontuação) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Praticamente todas as palavras de saída devem ser formas morfologicamente válidas reconhecidas pelo FST da GiellaLT. A tolerância de 1% acomoda casos especiais (nomes próprios, neologismos, empréstimos linguísticos) que o FST pode legitimamente não cobrir. Esta é a barreira de qualidade definidora para MT polissintética — se o FST rejeitar mais de 1% das palavras, o método está produzindo formas que não existem no idioma. Todo o objetivo deste prêmio é viabilizar um sistema que não corrompa as palavras. |
| 3 | **chrF++** (a pontuação) | `chrf_plus_plus` (SCORING_SPEC §2.1), com sua assinatura sacreBLEU e IC de 95% | **≥ 55,0** | O chrF++ do corpus no conjunto selado deve atingir 55 na escala de 0 a 100 — a métrica principal padrão ([Especificação de Pontuação](/docs/network/specifications/scoring#how-runs-are-scored)). Ele compara cada saída com sua referência, de modo que um sistema não consegue atingi-lo usando palavras válidas que não traduzam a entrada. |
| 4 | **Validação comunitária** | Revisão humana (BENCHMARK_SPEC §7) | **≥ 70% "aceitável" ou "excelente"** | Uma amostra estratificada de saídas (≥30 entradas nos níveis de dificuldade de 2 a 5) é revisada por ≥2 falantes bilíngues de CRK. Pelo menos 70% das entradas revisadas devem receber a avaliação "aceitável" ou "excelente". |
| 5 | **Avaliação padrão-ouro** | Execução em sandbox (BENCHMARK_SPEC §8.2) | **Obrigatória** | Todas as métricas automatizadas devem ser calculadas em relação ao segmento de corpus `gold_standard`, executadas pela organização gestora em um ambiente de sandbox. Pontuações no conjunto de desenvolvimento não contam. |
| 6 | **Reprodutibilidade** | Correspondência de impressão digital (fingerprint) (BENCHMARK_SPEC §3.8) | **±2%** | A organização gestora deve ser capaz de reexecutar o método e alcançar pontuações dentro de ±2% do run card submetido. |
| 7 | **Os termos de prêmio declarados pelo concurso foram atendidos** | As verificações que esse termo exige (veja abaixo) | **Obrigatório** | Os prêmios existem apenas em concursos soberanos, onde sua inscrição é executada pelo nó isolado (air-gapped) do host em um conjunto selado. O que acontece com ela *depois* é uma de três opções declaradas, publicadas com o concurso antes da abertura das inscrições — e não uma condição única imposta por todos os concursos. |

#### Condição 7 em detalhes: o termo é uma escolha entre três

Todo concurso soberano funciona da mesma forma no momento da execução: você entrega seu método (pesos ou código) ao nó isolado (air-gapped) do host, e o nó calcula a pontuação dele no conjunto selado. Isso é o que significa "o host mediu", e não é ajustável.

O que acontece *depois* disso é escolha do host, declarada por concurso, e é uma entre três opções. O host a publica antes da abertura das inscrições; ela é **congelada** no momento em que o concurso recebe sua primeira inscrição, para que o termo que você leu seja exatamente o termo ao qual você está vinculado.

| O termo | O que significa para você |
|---|---|
| `pass_to_holders` — *passar aos detentores* | O método passa para os detentores soberanos do benchmark. Eles avaliam e o mantêm, independentemente de quem vencer. |
| `retain_ip` — *manter PI* | Você mantém a propriedade do seu método. O host o avalia e mantém, no máximo, uma cópia selada para auditoria. |
| `release_open` — *liberar em código aberto* | Você mantém a propriedade, mas deve publicar o método sob uma licença aberta. Essa liberação é a condição para o prêmio. |

**O que cada opção significa em detalhes.** Estas quatro dimensões — mais a licença associada a uma liberação obrigatória — são *derivadas* da opção: um host nunca escreve `rights` ou `host_use` manualmente, e nenhum concurso pode combiná-los arbitrariamente:

| Campo | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — o artefato sobrevive à avaliação? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — a propriedade é transferida? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — para que o host pode utilizá-lo? | `any` | `evaluation_only` | `any` (sob a licença aberta que você publicou) |
| `release` — **você** deve publicá-lo, e quando? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — sob qual licença você publica | — | — | `any_osi`, ou um identificador SPDX nomeado |

Duas das opções permitem que um host restrinja um campo, e isso é tudo:

- sob `retain_ip`, o host pode definir `retention` como `delete_after_scoring` — seu método é destruído assim que for avaliado;
- sob `release_open`, o host pode mover a liberação para `required_before_scores` (você publica antes que suas próprias pontuações sejam divulgadas) ou `required_after_prize` (você publica após o pagamento), e pode especificar a licença em vez de aceitar qualquer uma aprovada pela OSI.

Um `community_terms_url` — um link `https://` para os termos escritos do próprio host — pode acompanhar qualquer uma das três opções. No próprio concurso, a opção escolhida é registrada como seu `disposition`, e esse é o valor único do qual tudo acima é derivado.

Qualquer outra coisa é recusada quando o concurso é criado: uma opção não oferece um campo que ela não prevê, e um campo escrito manualmente onde deveria ser derivado é recusado pelo nome em vez de ser aceito silenciosamente.

**O que é verificado antes que um prêmio seja pago.** As verificações necessárias decorrem do termo; nenhum host as configura separadamente:

- **Entrega (Handover)** — sempre. O host detém o artefato exato que avaliou (o digest do método registrado pelo nó). Este item é medido.
- **Liberação (Release)** — sob `release_open`, quando a liberação vence antes da divulgação das pontuações ou antes do prêmio. O host registra a URL de liberação e o SHA-256 do artefato publicado; o registro é verificado e a URL nunca é acessada via rede, para que um resultado congelado nunca dependa da disponibilidade de terceiros. Uma liberação exigida *após* o prêmio é uma obrigação devida após o pagamento, portanto não é uma das verificações para o pagamento.
- **Cessão (Assignment)** — sob `pass_to_holders`, onde a propriedade é transferida. Uma cessão é um instrumento assinado fora desta plataforma; o host registra o instrumento e sua data, e a plataforma verifica se um registro existe. **Ela nunca verifica questões jurídicas.**

**Um concurso sem termos de prêmio declarados não tem prêmio.** Não há termo padrão e nenhum é presumido em nome de ninguém. Participar de um concurso que declare um termo significa aceitá-lo explicitamente, pelo seu hash, no momento da submissão — a aceitação é empacotada no seu bundle e faz parte do que o nó do host verifica.

> **Por que 99%+ de FST?** O problema central na tradução automática para línguas polissintéticas é a alucinação — os LLMs produzem sequências que *parecem* com o idioma de destino, mas são morfologicamente inválidas. Um método que produz 95% de saídas válidas ainda tem 5% de palavras inventadas — um ruído inaceitável para qualquer uso em produção. O limiar de 99%+ exige alucinação próxima de zero, ao mesmo tempo em que permite casos especiais raros (um nome próprio que o FST desconhece, um neologismo legítimo). Se um método não consegue atingir 99%+ de aceitação por FST, ele não resolveu o problema.
>
> **Por que chrF++ e FST juntos, e por que nenhum dos dois é suficiente isoladamente.** A aceitação por FST apenas indica que cada palavra existe; um sistema que repete uma única frase válida para cada entrada passará por ele com nota máxima. O chrF++ compara cada saída com sua referência, capturando esse tipo de falha. Nenhum número automático atesta a qualidade: o gate de validação comunitária (condição nº 4) é o que confirma se os falantes consideram a saída utilizável.

#### O Que Este Limite Significa na Prática

O que as condições estabelecem em conjunto:

- **Praticamente todas** as palavras de saída são palavras reais em Cree (o FST valida mais de 99% — praticamente zero formas inventadas)
- As saídas estão próximas das referências no conjunto selado (chrF++ ≥ 55)
- Falantes bilíngues, sob o protocolo da própria comunidade, avaliaram pelo menos 70% de uma amostra estratificada como aceitável ou melhor — a única condição que atesta a qualidade
- Os erros restantes são erros reais de idioma (flexão incorreta, obviação incorreta, incompatibilidades de animacidade) — não palavras inventadas

Este é um sistema que **não destrói o idioma.** Pode não ser perfeito, mas cada palavra que produz é uma palavra real. Esse é o critério mínimo para tradução automática respeitosa de um idioma polissintético.

---

## 3. Processo de Reclamação de Prêmio

### 3.1 Admissão e, em seguida, submissão

1. **Qualificação pública.** O desenvolvedor avalia o conjunto de desenvolvimento liberado do concurso com seu próprio sistema e guarda o comprovante (`mt-eval contest qualify`). O comprovante é autorrelatado por definição — é uma afirmação, e o host o verifica na etapa 4.

2. **Entrega da inscrição.** O ingresso em um concurso ocorre fornecendo ao nó do host algo que ele possa executar, em uma de duas trilhas:
   - um **modelo** — pesos em safetensors, um tokenizador declarativo e uma configuração, sem nenhum código (`mt-eval contest submit-model`); ou
   - um **método** — um Dockerfile e um entrypoint, com dependências integradas (vendored) para que compile e execute sem conexão à rede (`mt-eval contest submit-method`).

   Fazer upload de traduções de um conjunto de teste liberado e vincular uma pontuação que o próprio desenvolvedor publicou foram opções **descontinuadas como caminhos de inscrição no concurso em 06/09/2026**, tendo seus comandos removidos. Pontuações autorrelatadas ainda pertencem ao placar de líderes aberto, que é um painel público indexado por corpus e direção do par — não um concurso e não uma trilha de premiação.

3. **Declare, na própria inscrição:** a trilha (`constrained` — treinado apenas com os dados permitidos pelo host — ou `unconstrained`), a contagem de parâmetros, a licença dos pesos e se eles são públicos, os dados de treinamento a que a reivindicação restrita se refere, se esta é a inscrição principal da equipe ou uma de contraste e — quando o concurso exigir — uma descrição do sistema. O desenvolvedor também informa `--agree` para os termos de submissão do método e, quando o concurso declarar termos de prêmio, `--accept-terms <hash>` para eles.

### 3.2 Avaliação

1. O nó do host executa suas **verificações estáticas** no bundle, recusando qualquer coisa que necessite de acesso à rede e rejeitando uma inscrição que tenha aceitado termos de prêmio diferentes dos declarados por este concurso.
2. O nó **reexecuta o qualificador por conta própria**, em sua própria cópia do conjunto de desenvolvimento público, usando o mesmo executor de trilha e o mesmo avaliador. O comprovante do desenvolvedor era uma afirmação; esta é a medição. Qualquer não conformidade é rejeitada aqui — antes que qualquer custodiante seja solicitado a aprovar algo e antes que o conjunto selado seja aberto — detalhando o que foi alegado, o que foi medido e qual era a exigência mínima.
3. **Custodiantes autorizam** a execução selada (M-de-N, de acordo com o modelo de autorização do concurso). A concessão é de uso único, com tempo limitado e vinculada à impressão digital exata de (hash do bundle, corpus, versão do corpus, nó).
4. A inscrição é executada contra o corpus selado `gold_standard` dentro da sandbox isolada de rede na própria máquina do host, e as métricas automatizadas são calculadas (chrF++ com seu IC e assinatura, as outras métricas padrão e diagnósticos como aceitação por FST). Uma reserva (holdout) selada declarada e quaisquer suítes de teste de terceiros são executadas dentro da **mesma** execução autorizada.
5. **Apenas pontuações agregadas saem** — regra aplicada na camada de banco de dados, não por convenção. Se o concurso prometeu `hidden_until_close`, o card é retido até que o encerramento o publique.
6. Se os limiares automatizados forem atingidos (condições 2 e 3), o host prossegue para a revisão comunitária. Se não forem, o desenvolvedor recebe suas pontuações e nenhuma revisão comunitária é acionada.

### 3.3 Revisão Comunitária

1. Uma amostra estratificada de saídas (≥30 entradas, cobrindo níveis de dificuldade 2–5) é apresentada a falantes bilíngues
2. No mínimo 2 revisores independentes classificam cada entrada
3. Escala de classificação: **rejeitar** / **essência** / **aceitável** / **excelente**
4. Se ≥70% das entradas receberem "aceitável" ou "excelente" de ambos os revisores, a validação comunitária passa

### 3.4 Pagamento

A ordem é fixa: **etapas de validação declaradas verificadas → concurso encerrado → prêmio pago.** Quais etapas são essas depende dos termos declarados por *este* concurso (§2.1, condição 7) — mas, quaisquer que sejam, elas são verificadas antes do encerramento, e nada é pago a partir de uma classificação que ainda esteja em mudança.

Um organizador pode usar `close --force` para avançar mesmo com uma etapa não atendida. O encerramento então é concluído e a classificação congelada registra a elegibilidade daquela inscrição ao prêmio exatamente como foi calculada — não elegível, com a indicação da etapa que falhou. Um encerramento forçado é um concurso encerrado, nunca uma etapa aprovada.

1. Todas as 7 condições são atendidas
2. **Cada etapa exigida pelos termos de prêmio declarados pelo concurso é verificada** — sempre a entrega do artefato avaliado, mais uma liberação registrada e/ou uma cessão registrada quando esses termos as exigirem
3. O concurso é **encerrado** e sua classificação é congelada
4. A organização gestora confirma o resultado em relação à classificação congelada
5. O prêmio é pago em até 30 dias após a confirmação
6. Tudo o que os termos declarados estabelecem sobre propriedade entra em vigor conforme especificado nesses termos — para um concurso cujo `rights` seja `participant_retains_all`, nada é transferido
7. O resultado é publicado no placar de líderes com o nível de verificação "Validado pela Comunidade"

### 3.5 Múltiplos Envios

- O mesmo desenvolvedor/equipe pode enviar múltiplas vezes
- Cada envio é avaliado independentemente
- Se um método é melhorado e re-enviado, apenas o cartão de execução mais recente conta
- O prêmio é concedido ao **primeiro** método que passa por todos os limites — não é dividido

### 3.6 Envios de Equipe

- Equipes e pares de Anciãos-jovens são elegíveis
- A distribuição de prêmio dentro de uma equipe é responsabilidade da equipe
- Todos os membros da equipe devem assinar os termos de participação
- A atribuição no placar lista todos os membros da equipe

---

## 4. Pools de Prêmios Futuros {#4-future-prize-pools}

O Prêmio do Fundador é a semente. Pools de prêmios adicionais são financiados por patrocinadores. Cada novo pool de prêmio é documentado como uma nova subseção de §2 com seu próprio:

- Valor e moeda do prêmio
- Par de idiomas
- Atribuição do patrocinador
- Condições de limite (que podem diferir do Prêmio do Fundador)
- Data de expiração (se houver)
- Quaisquer condições especiais

### 4.1 Modelo de Prêmio de Patrocinador

Patrocinadores financiam pools de prêmios em qualquer valor. Níveis sugeridos:

| Nível | Valor | Limiar Sugerido |
|------|--------|---------------------|
| **Seed** | $5.000–$15.000 | Uma nota mínima de chrF++ no conjunto selado, publicada antes da abertura do concurso + validação comunitária |
| **Breakthrough** | $25.000–$50.000 | Uma nota mínima mais alta de chrF++ + validação comunitária |
| **Grand Prize** | $100.000+ | As condições do Breakthrough + cobertura de múltiplos registros + integração para implantação |

A referência é sempre o chrF++ (com sua assinatura, para que seja reprodutível); barreiras de diagnóstico como a aceitação por FST podem ser adicionadas como requisitos eliminatórios. Uma pontuação composta ou um nível de qualidade não pode ser usado como limiar de prêmio.

Os patrocinadores também podem financiar:
- **Recompensas por melhoria** — pagamento fixo para cada melhoria de 5 pontos no chrF++ em relação ao melhor resultado atual
- **Prêmios por registro** — premiações separadas para registros específicos (formal, cerimonial, educacional)
- **Prêmios por custo** — menor custo por entrada entre os métodos que superarem a nota de corte de chrF++ (o custo é informado ao lado da pontuação, nunca combinado com ela)

### 4.2 Onde os Fundos de Prêmio São Mantidos

Os fundos de prêmio são **mantidos por patrocinador**: ficam com a organização patrocinadora, ou com um fundo comunitário que o patrocinador designa — **nunca com Champollion**, que coordena medição e não toca em dinheiro. Um prêmio credível publica, antes de abrir: **quem mantém os fundos**, sob que arranjo (conta organizacional, fundo ou terceiro escrow da escolha do patrocinador), e o limite de prêmio — para que passar do critério seja verificável a partir de pontuações publicadas mais o veredicto de validação de falante da comunidade, e um padrão de pagamento seria visível publicamente como um. Nenhum fundo de prêmio está sendo mantido em lugar algum hoje. Se um prêmio expirasse sem ser reclamado, os fundos ficariam onde sempre estiveram — com o patrocinador — para serem redirecionados ou retirados a critério do patrocinador. A mecânica de autoatendimento, incluindo o risco de padrão do patrocinador e suas mitigações, está documentada em [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) e os [Modelos de Termos](/docs/network/sovereignty/terms-templates).

---

## 5. Desqualificação

Um envio é desqualificado se:

1. **Treinamento em dados de avaliação.** O método foi exposto a entradas do corpus `gold_standard` ou `held_out`. (Prevenido arquiteturalmente pela execução em sandbox — mas se forem encontradas evidências de contaminação, o resultado é anulado.)
2. **Não reprodutível.** A organização gestora não consegue reproduzir pontuações dentro da margem de ±2%.
3. **Dependências não declaradas ou inelegíveis.** O método exige acesso em tempo de execução a serviços externos além do que seu manifesto de dependências declara, ou sua classe de dependência efetiva é A2 ou X (§1.6). Inferência de LLM declarada de Classe A1 roteada através do gateway de avaliação é permitida; qualquer outra dependência de rede em tempo de execução — e qualquer dependência não declarada de qualquer classe — é desclassificante.
4. **Termos de participação não assinados.** Todos os membros da equipe devem concordar com os termos de submissão do método e — quando o concurso declarar termos de prêmio (§1.3) — com estes últimos, por hash.
5. **Tentativa de manipulação detectada.** A saída é otimizada para a métrica em vez da qualidade de tradução (identificada pela revisão comunitária e/ou pelas verificações antimanipulação conforme BENCHMARK_SPEC §9.3).

---

## 6. Relação com Outras Especificações

| Este Documento | Referências | Para |
|--------------|-----------|-----|
| §2 condições de limiar | SCORING_SPEC "Como as execuções são pontuadas" e §2.1–2.2 (métricas) | Definições e escala de métricas |
| §2 validação comunitária | BENCHMARK_SPEC §7 | Protocolo de revisão humana |
| §3 execução em sandbox | BENCHMARK_SPEC §8.2 | Mecanismo de soberania |
| §1.3 termos de prêmio declarados | BENCHMARK_SPEC §8.3 | O que o host pode fazer com uma submissão posteriormente |
| §1.6 classes de dependência | Especificação da Interface do Método; BENCHMARK_SPEC §8.6 | Definições de classe, termos de admissibilidade, política de rede da sandbox |
| §4 prêmios por custo | SCORING_SPEC §6.2 | Fórmulas de métricas de custo |

---

## 7. Sincronização Código–Especificação

### 7.1 Fonte Canônica

Este documento (`cli/website/docs/network/specifications/prize-spec.md`) é a fonte canônica para:
- Definições de pool de prêmio (§2)
- Condições de limite (§2.x)
- Processo de reclamação (§3)
- Regras de desqualificação (§5)

### 7.2 Requisitos de Implementação

Quando um fundo de premiação é ativado:
1. A interface do placar de líderes deve exibir prêmios ativos e suas condições de limiar
2. Os run cards que atenderem aos limiares automatizados (condições 2 e 3) devem ser sinalizados para revisão comunitária
3. Nenhum nível de qualidade é usado: o campo `quality_tier` é nulo em todo novo run card (padrão de pontuação/1)
4. A camada de **termos** de prêmio já é distribuída (`contest_prize_terms` — declaração, hash, aceitação e o gate de pagamento), e a pontuação em si permanece inalterada. O que um novo fundo de prêmios adiciona é a política de limiares do §2 e a exibição no placar de líderes descrita nos itens 1 e 2 acima

---

*Uma estrutura de premiação deve ser compatível com os termos de prêmio que o mesmo concurso declara (§1.3). Esses termos são a escolha do host em todas as dimensões — desde "avalie, delete, todos os direitos continuam com o participante" até "você entrega, nós avaliamos e retemos independentemente do resultado" — e são publicados, submetidos a hash e aceitos antes que qualquer pessoa participe. Um host comunitário que queira que um método vencedor se torne propriedade da comunidade pode declarar exatamente isso, e o prêmio então financia a criação de tecnologia que pertence à comunidade do idioma. Nada aqui presume isso em nome de nenhum host.*
