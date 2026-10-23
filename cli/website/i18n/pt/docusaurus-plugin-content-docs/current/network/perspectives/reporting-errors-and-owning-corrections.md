---
sidebar_position: 4
title: "Relatando Erros e Responsabilidade pelas Correções"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Como um falante relata um fato incorreto ou uma tradução inadequada, quem decide o que acontece em seguida, como as correções carregam proveniência, e por que as comunidades têm poder de veto sobre seus dados linguísticos."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Relatando Erros e Assumindo Correções

> **Posição.** Estar errado é inevitável para uma plataforma que publica fatos e avaliações sobre muitas línguas. O que *não* é inevitável é em quem se acredita quando um erro é relatado e quem é dono da correção. Nossa resposta: o relato de um falante fluente tem prioridade sobre nossa automação, cada correção carrega uma procedência indicando quem alterou o quê e por quê, e uma comunidade pode retirar ou vetar o uso dos dados de sua língua — não por cortesia, mas como uma propriedade aplicada pela arquitetura.

A maioria das plataformas de dados trata relatórios de erros como tickets de suporte: um usuário reclama, um mantenedor decide, o registro muda silenciosamente. Para dados de línguas indígenas esse modelo está de cabeça para baixo. A pessoa relatando o erro geralmente é mais autorizada que a plataforma — um falante nos dizendo que uma palavra está errada não é um "usuário", é a verdade fundamental corrigindo um proxy. O design abaixo segue de levar isso a sério.

---

## Dois tipos de erro, um princípio

A plataforma publica dois tipos de afirmações que podem estar erradas:

1. **Fatos sobre um idioma** — os cartões de idioma que orientam a avaliação: dados de classificação, ortografia, características linguísticas, quais métricas se aplicam. Um cartão pode informar uma estimativa incorreta de falantes, uma relação dialetal errada ou o status incorreto de um sistema de escrita.
2. **Julgamentos sobre traduções** — uma tradução de referência em um corpus que um falante considera incorreta ou não natural; uma métrica automatizada que rejeita uma palavra válida ou aceita uma inválida; uma pontuação automática alta em um resultado que os falantes não aceitariam.

O princípio cobrindo ambos, já vinculante na [Especificação de Pontuação](/docs/network/specifications/scoring) e [Especificação de Benchmark §7](/docs/network/specifications/benchmark#7-human-validation): **saídas automatizadas são proxies; falantes são a verdade fundamental.** O compromisso publicado no [Protocolo de Validação de Falantes §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) coloca de forma clara: se um falante diz que o linter está errado sobre algo, corrigimos o linter.

## Como um relato viaja

Aqui está o caminho que um relato percorre, com marcadores de status honestos — parte disso funciona hoje, parte é especificada e ainda não foi construída.

**Relatar uma tradução incorreta ou julgamento de métrica (em funcionamento hoje, por canal direto).** Um falante que veja uma tradução de referência errada, uma palavra incorretamente rejeitada ou um "equivalente" inaceitável pode relatar isso pelo rastreador de problemas (issue tracker) do repositório público do projeto ou entrando em contato diretamente com o projeto. A versão estruturada disso — telas de avaliação com opções de *rejeitar / sentido geral / aceitável / excelente* e notas em texto livre — é a interface de revisão da comunidade, que está especificada na [Especificação de Benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation), mas ainda não está ativa. Até lá, os relatos são tratados diretamente de pessoa para pessoa, e as próprias tarefas de validação (revisão estruturada e remunerada feita por falantes — consulte [Trabalhando com falantes](/docs/working-with-speakers)) são o principal fluxo de correções.

**Relatando um fato errado em um cartão de língua (funcionando hoje, mesmos canais).** As correções de cartão seguem o mesmo caminho: relato, revisão, mudança versionada. Como os cartões impulsionam o comportamento de avaliação — quais métricas carregam, quais modelos são recomendados — uma correção de cartão pode mudar pontuações, então as correções são aplicadas como mudanças de dados registradas, nunca edições silenciosas.

**O que acontece depois — quem decide:**

- **Decisões de julgamento linguístico pertencem aos falantes dessa língua.** Se uma forma é válida, se duas formulações são equivalentes, se um registro é apropriado — a plataforma implementa a resposta; ela não a fornece. Onde os falantes discordam (dialetos, convenções ortográficas), a resposta é registrada como variação, não arbitrada por nós — os esquemas de corpus e linter suportam a marcação de variantes dialetais como alternativas aceitáveis em vez de forçar um único vencedor.
- **Decisões sobre os dados de uma comunidade pertencem à sua organização de governança.** Para línguas com uma organização de governança, alterações nos corpora de avaliação, aceitação de correções em conjuntos de teste lacrados e consequências de implantação passam por ela — isso é o controle comunitário de dados linguísticos — consulte [Suas palavras, suas regras](/docs/your-words-your-rules) — implementado como processo, não como mero cartaz.
- **Erros mecânicos são simplesmente corrigidos.** Um erro de digitação, um link quebrado, um campo analisado incorretamente — relatado, corrigido, registrado. Nem tudo precisa de um conselho.

## Correções carregam proveniência

Uma correção que você não consegue rastrear é apenas uma opinião mais nova. Três regras de proveniência se aplicam a todo fato e toda correção:

1. **Todo fato indica sua fonte.** Cartões de língua e entradas de corpus registram de onde veio cada valor — um conjunto de dados publicado, uma contribuição da comunidade, a revisão de um falante.
2. **Valores derivados são rotulados como nossos, não da fonte original.** Quando a plataforma calcula algo — um agregado, uma recodificação, um composto —, isso é registrado como uma derivação da plataforma *a partir* da fonte original (upstream), nunca assinado sob o nome da fonte original. Um conjunto de dados original nunca deve ser culpado por, ou creditado com, um número que ele não publicou.
3. **Correções passam a fazer parte do registro.** A correção de um falante é registrada como uma nova afirmação atribuída (com identificação ou anônima, à escolha do falante — nos mesmos termos do trabalho de validação) que substitui o valor antigo; o histórico do que mudou permanece auditável. As versões de corpus têm manifesto por hash ([Registrando corpora](/docs/network/sovereignty/registering-corpora)), de modo que um corpus corrigido é visivelmente uma nova versão, e cada cartão de execução registra exatamente com qual versão foi pontuado — pontuações antigas continuam interpretáveis, pontuações novas refletem a correção.

## O veto, concretamente

"Controle comunitário" é fácil de afirmar. Aqui está o que isso se concretiza na arquitetura publicada:

- **Falantes podem retirar suas contribuições.** Um falante pode retirar suas avaliações a qualquer momento, e a retirada as remove de todas as análises ([Validação por Falantes §5](/docs/network/specifications/speaker-validation#5-data-governance)). Os falantes também têm poder de veto sobre a publicação de resultados que considerem problemáticos.
- **Comunidades podem interromper a avaliação por completo.** Conjuntos de teste lacrados são criptografados, e o Champollion não detém nenhuma parte das chaves, portanto a plataforma sozinha nunca poderá reconstruí-las. Hoje, as chaves de um conjunto lacrado ficam com os organizadores — custodiantes de chave da comunidade: nenhum nomeado ainda. Assim que os custodiantes nomeados por uma comunidade possuírem partes da chave de um conjunto, eles poderão interromper a avaliação recusando-se a participar da reconstrução da chave ([Registrando corpora](/docs/network/sovereignty/registering-corpora)). "E se quisermos parar?" tem uma resposta definida: os dados lacrados nunca são expostos, e a avaliação é encerrada.
- **Nenhuma pontuação se sobrepõe a uma decisão da comunidade.** Uma posição no painel de líderes não concede a ninguém permissão para implantar um método na língua de uma comunidade ([Transferência de Titularidade](/docs/network/sovereignty/ownership-transfer)) — e uma comunidade que decide que a MT não deve ser implantada de forma alguma para sua língua está usando o sistema exatamente como ele foi projetado, e não o quebrando (consulte [Tradução não é revitalização](/docs/network/perspectives/translation-is-not-revitalization)).

## O que ainda não construímos

No espírito do restante desta seção: a interface de revisão da comunidade está planejada, não ativa. Organizações de governança ainda não foram estabelecidas para nenhum dos idiomas atuais — nenhum custodiante comunitário foi nomeado para qualquer benchmark, incluindo Plains Cree, e não nomeamos custodiantes publicamente antes que eles tenham consentido. Até que essas partes existam, as correções passam por canais diretos e atribuíveis, e as especificações publicadas — e não esta página — permanecem como a descrição vinculativa do processo. Onde esta página e uma especificação divergirem, a especificação prevalece, e consideraríamos essa divergência um bug que também vale a pena relatar.

---

## O que isso significa para você

:::info[Se você for membro de uma comunidade]
Se algo sobre a sua língua nesta plataforma estiver errado — um fato, uma tradução, um rótulo —, o seu relato é um testemunho direto da verdade real, não uma queixa para entrar em triagem. Você decide se a sua correção recebe crédito nominal; a sua contribuição pode ser retirada mais tarde; e a sua comunidade pode interromper totalmente o uso dos seus dados. Comece em [Suas palavras, suas regras](/docs/your-words-your-rules), ou simplesmente abra uma issue no repositório público.
:::

:::info[Se você é um pesquisador]
Correções aqui são dados com proveniência, não edições silenciosas: versões de corpus são hashadas, run cards fixam a versão exata contra a qual foram pontuadas, e valores derivados são rotulados como derivações. Se você construir sobre scores ou corpora da Network, cite a versão — e trate uma onda de correção conduzida por falantes como uma descoberta sobre a validade da métrica, porque é isso que é.
:::

:::info[Se você é um desenvolvedor]
A pontuação do seu método pode legitimamente mudar sem seu código mudar — uma palavra falsamente rejeitada é adicionada à lista de permissões, uma tradução de referência é corrigida, uma classe de variante é consertada. Projete para isso: fixe versões de corpus em seus run cards ([especificação de Run Card](/docs/network/specifications/run-card)), monitore changelogs de dataset, e trate correções de falantes como o sinal de erro mais confiável que você jamais receberá gratuitamente.
:::

## Veja também

- [Trabalhando com falantes](/docs/working-with-speakers) — a mesma autoridade dos falantes, na etapa de benchmark
- [Coloque em prática](/docs/put-it-to-work) — onde as correções encontram o fluxo de publicação
- [Suas palavras, suas regras](/docs/your-words-your-rules) — quem decide o que acontece com os dados linguísticos, o que as ferramentas aplicam e o que nenhuma ferramenta pode impedir
