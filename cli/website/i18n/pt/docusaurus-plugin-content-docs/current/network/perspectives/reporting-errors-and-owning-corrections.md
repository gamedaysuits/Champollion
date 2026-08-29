---
sidebar_position: 4
title: "Relatando Erros e Responsabilidade pelas Correções"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Como um falante relata um fato incorreto ou uma tradução inadequada, quem decide o que acontece em seguida, como as correções carregam proveniência, e por que as comunidades têm poder de veto sobre seus dados linguísticos."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Relatando Erros e Assumindo Correções

> **Posicionamento.** Estar errado é inevitável para uma plataforma que publica fatos e avaliações sobre milhares de línguas. O que *não* é inevitável é quem é acreditado quando um erro é relatado, e quem assume a correção. Nossa resposta: o relato de um falante fluente supera nossa automação, toda correção carrega proveniência dizendo quem mudou o quê e por quê, e uma comunidade pode retirar ou vetar o uso de seus dados linguísticos — não como uma cortesia, mas como uma propriedade imposta pela arquitetura.

A maioria das plataformas de dados trata relatórios de erros como tickets de suporte: um usuário reclama, um mantenedor decide, o registro muda silenciosamente. Para dados de línguas indígenas esse modelo está de cabeça para baixo. A pessoa relatando o erro geralmente é mais autorizada que a plataforma — um falante nos dizendo que uma palavra está errada não é um "usuário", é a verdade fundamental corrigindo um proxy. O design abaixo segue de levar isso a sério.

---

## Dois tipos de erro, um princípio

A plataforma publica dois tipos de afirmações que podem estar erradas:

1. **Fatos sobre uma língua** — os cartões de língua que impulsionam a avaliação: dados de classificação, ortografia, características linguísticas, quais métricas se aplicam. Um cartão pode afirmar a estimativa errada de falantes, a relação dialetal errada, o status do sistema de escrita errado.
2. **Julgamentos sobre traduções** — uma tradução de referência em um corpus que um falante considera errada ou não natural; uma métrica automatizada que rejeita uma palavra válida ou aceita uma inválida; um badge "Deployable" em saídas que falantes não aceitariam.

O princípio cobrindo ambos, já vinculante na [Especificação de Pontuação](/docs/network/specifications/scoring) e [Especificação de Benchmark §7](/docs/network/specifications/benchmark#7-human-validation): **saídas automatizadas são proxies; falantes são a verdade fundamental.** O compromisso publicado no [Protocolo de Validação de Falantes §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) coloca de forma clara: se um falante diz que o linter está errado sobre algo, corrigimos o linter.

## Como um relato viaja

Aqui está o caminho que um relato percorre, com marcadores de status honestos — parte disso funciona hoje, parte é especificada e ainda não foi construída.

**Relatando uma tradução errada ou julgamento de métrica (funcionando hoje, por canal direto).** Um falante que vê uma tradução de referência errada, uma palavra falsamente rejeitada, ou um "equivalente" inaceitável pode relatá-lo através do rastreador de problemas do repositório público do projeto ou entrando em contato com o projeto diretamente. A versão estruturada disso — telas de classificação com opções *rejeitar / essência / aceitável / excelente* e notas de texto livre — é a interface de revisão comunitária, que é especificada na [Especificação de Benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation) mas ainda não está ativa. Até que esteja, os relatórios são tratados pessoa a pessoa, e as próprias tarefas de validação (pagas, revisão estruturada de falantes — veja [Como Falantes Ganham Dinheiro](/docs/network/perspectives/how-speakers-get-paid)) são o principal pipeline de correção.

**Relatando um fato errado em um cartão de língua (funcionando hoje, mesmos canais).** As correções de cartão seguem o mesmo caminho: relato, revisão, mudança versionada. Como os cartões impulsionam o comportamento de avaliação — quais métricas carregam, quais modelos são recomendados — uma correção de cartão pode mudar pontuações, então as correções são aplicadas como mudanças de dados registradas, nunca edições silenciosas.

**O que acontece depois — quem decide:**

- **Julgamentos linguísticos pertencem aos falantes dessa língua.** Se uma forma é válida, se duas fraseações são equivalentes, se um registro é apropriado — a plataforma implementa a resposta; ela não a fornece. Onde falantes discordam (dialetos, convenções ortográficas), a resposta é registrada como variação, não arbitrada por nós — os esquemas de corpus e linter suportam marcar variantes dialetais como alternativas aceitáveis em vez de forçar um vencedor.
- **Decisões sobre os dados de uma comunidade pertencem à sua organização de governança.** Para línguas com uma organização de governança, mudanças em corpora de avaliação, aceitação de correções em conjuntos de testes selados, e consequências de implantação passam por elas — isso é o controle comunitário dos dados linguísticos (veja [Soberania de Dados](/docs/network/sovereignty/data-sovereignty)) implementado como processo, não como cartaz.
- **Erros mecânicos são apenas corrigidos.** Um typo, um link quebrado, um campo mal analisado — relatado, corrigido, registrado. Nem tudo precisa de um conselho.

## Correções carregam proveniência

Uma correção que você não consegue rastrear é apenas uma opinião mais nova. Três regras de proveniência se aplicam a todo fato e toda correção:

1. **Todo fato nomeia sua fonte.** Cartões de língua e entradas de corpus registram de onde cada valor veio — um conjunto de dados publicado, uma contribuição comunitária, a revisão de um falante.
2. **Valores derivados são rotulados como nossos, não do upstream.** Quando a plataforma computa algo — um agregado, uma recodificação, um composto — é registrado como uma derivação de plataforma *do* upstream, nunca escrito sob o nome do upstream. Um conjunto de dados upstream nunca deve ser culpado por, ou creditado com, um número que não publicou.
3. **Correções se tornam parte do registro.** A correção de um falante é registrada como uma nova asserção atribuída (nomeada ou anônima, à escolha do falante — os mesmos termos que o trabalho de validação) que supera o valor antigo; o histórico do que mudou permanece auditável. As versões de corpus são manifestadas por hash ([Parceria de Corpus §4.4](/docs/network/specifications/corpus-partnership)), então um corpus corrigido é uma versão visivelmente nova, e todo cartão de execução registra exatamente qual versão foi pontuada — pontuações antigas permanecem interpretáveis, novas pontuações refletem a correção.

## O veto, concretamente

"Controle comunitário" é fácil de afirmar. Aqui está o que isso se concretiza na arquitetura publicada:

- **Falantes podem retirar suas contribuições.** Um falante pode retirar suas classificações a qualquer momento, e a retirada as remove de todas as análises ([Validação de Falantes §5](/docs/network/specifications/speaker-validation#5-data-governance)). Falantes também têm poder de veto sobre a publicação de resultados que consideram problemáticos.
- **Comunidades podem parar a avaliação inteiramente.** Conjuntos de testes selados são criptografados, com chaves mantidas de forma que a plataforma sozinha nunca possa reconstruí-los; uma comunidade pode revogar o acesso de avaliação recusando-se a participar da reconstrução de chaves ([Parceria de Corpus §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). "E se quisermos parar?" tem uma resposta especificada: os dados selados nunca são expostos, e a avaliação termina.
- **Nenhuma pontuação substitui uma decisão comunitária.** Um método que lidera o ranking ainda é implantado apenas se a organização de governança disser que sim ([Transferência de Propriedade](/docs/network/sovereignty/ownership-transfer)) — e uma comunidade que decide que MT não deve ser implantado para sua língua em absoluto está exercendo o sistema conforme projetado, não quebrando-o (veja [Tradução Não É Revitalização](/docs/network/perspectives/translation-is-not-revitalization)).

## O que ainda não construímos

No espírito do resto desta prateleira: a interface de revisão comunitária é planejada, não ativa. Organizações de governança não são estabelecidas para nenhuma das línguas atuais — a custódia comunitária para o benchmark Plains Cree está em confirmação, e não nomeamos custódios publicamente antes de terem consentido. Até que essas peças existam, as correções funcionam através de canais diretos e atribuíveis, e as especificações publicadas — não esta página — permanecem a descrição vinculante do processo. Onde esta página e uma especificação discordam, a especificação vence, e consideraríamos a discordância um bug que vale a pena relatar também.

---

## O que isso significa para você

:::info[Se você é um membro da comunidade]
Se algo sobre seu idioma nesta plataforma está errado — um fato, uma tradução, um rótulo — seu relatório é um testemunho da verdade no terreno, não uma reclamação a ser triada. Você decide se sua correção é creditada pelo nome; sua contribuição pode ser retirada posteriormente; e sua comunidade pode interromper o uso de seus dados completamente. Comece em [Para Comunidades de Linguagem](/docs/network/community/for-language-communities), ou simplesmente abra uma issue no repositório público.
:::

:::info[Se você é um pesquisador]
Correções aqui são dados com proveniência, não edições silenciosas: versões de corpus são hashadas, run cards fixam a versão exata contra a qual foram pontuadas, e valores derivados são rotulados como derivações. Se você construir sobre scores ou corpora da Network, cite a versão — e trate uma onda de correção conduzida por falantes como uma descoberta sobre a validade da métrica, porque é isso que é.
:::

:::info[Se você é um desenvolvedor]
A pontuação do seu método pode legitimamente mudar sem seu código mudar — uma palavra falsamente rejeitada é adicionada à lista de permissões, uma tradução de referência é corrigida, uma classe de variante é consertada. Projete para isso: fixe versões de corpus em seus run cards ([especificação de Run Card](/docs/network/specifications/run-card)), monitore changelogs de dataset, e trate correções de falantes como o sinal de erro mais confiável que você jamais receberá gratuitamente.
:::

## Veja também

- [Como Falantes Ganham Dinheiro](/docs/network/perspectives/how-speakers-get-paid) — a mesma autoridade de falante, no estágio de benchmark
- [Do Benchmark ao Uso Diário](/docs/network/perspectives/from-benchmark-to-daily-use) — onde correções encontram o fluxo de trabalho de publicação
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — princípios indígenas de soberania de dados, CARE e Te Mana Raraunga, os princípios por trás deste design
