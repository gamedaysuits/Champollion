---
sidebar_position: 3
title: "Do Benchmark ao Uso Diário: O Caminho da Pós-Edição"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Como um método de tradução avaliado em benchmark se torna um fluxo de trabalho de tradução comunitária: rascunho automático, pós-edição por falante fluente, texto publicado — com limites de qualidade honestos em cada etapa."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Do Benchmark ao Uso Diário: O Caminho da Pós-Edição

> **A versão resumida.** Uma pontuação no placar não é um produto. O caminho entre "este método atinge chrF++ 47,5" e "o conselho da comunidade publica documentos no idioma toda semana" passa por exatamente um fluxo de trabalho: a máquina gera um rascunho, um falante fluente o corrige e apenas o texto corrigido é publicado. Cada limiar de qualidade em nossas especificações é calibrado para esse fluxo de trabalho — não para a geração automática sem supervisão, algo que não endossamos para nenhum idioma nesta plataforma.

Às vezes as pessoas perguntam quando um método de tradução será "bom o suficiente para apenas usar". Para as línguas que esta Rede serve, essa pergunta tem uma armadilha. A resposta honesta é que o patamar que vale a pena buscar não é "bom o suficiente para publicar sem revisão" — é **"bom o suficiente para que revisar um rascunho seja melhor que traduzir do zero."** Esse patamar é muito mais baixo, é mensurável, e ultrapassá-lo muda o que um escritório de tradução comunitária pode produzir em uma semana.

---

## O fluxo de trabalho, de ponta a ponta

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Três coisas a notar:

1. **A máquina nunca publica.** A unidade de saída é um rascunho. A passagem de correção do falante não é garantia de qualidade colada no final — é o fluxo de trabalho.
2. **O tempo do falante é o recurso sendo otimizado.** Um método é melhor que outro método exatamente na medida em que deixa menos para o falante corrigir. Pesquisa sobre pós-edição para línguas bem-dotadas de recursos consistentemente encontra ser mais rápido que traduzir do zero em qualidade MT moderada (Plitt & Masselot 2010; Green, Heer & Manning 2013, ambos citados com links em [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)). Se isso se mantém para línguas polissintéticas é precisamente o que o benchmark existe para descobrir — tratamos como uma hipótese a verificar por língua, não uma suposição.
3. **O ciclo de feedback é de propriedade da comunidade.** Cada documento corrigido é potencial dado de treinamento e coaching — e pertence à comunidade, para alimentar de volta (ou não) em seus próprios termos sob as regras de [data sovereignty](/docs/network/sovereignty/data-sovereignty). O mecanismo de feedback é um objetivo de design da plataforma, ainda não um recurso construído; veja [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) para como correções e proveniência devem funcionar.

## O que uma pontuação no placar pode e não pode dizer a você

O placar classifica os métodos da mesma forma que a área de tradução automática: por **chrF++** em nível de corpus (0–100) com seu intervalo de confiança de 95% e assinatura do sacreBLEU, acompanhado por BLEU, spBLEU, TER e COMET, com diagnósticos como aceitação por FST relatados separadamente ([Especificação de Pontuação](/docs/network/specifications/scoring#how-runs-are-scored)). Se um método é melhor que outro no mesmo conjunto de avaliação, isso é decidido por um teste de significância pareado, e não comparando dois números a olho ([Testes de Significância](/docs/network/specifications/significance)).

O que isso diz a uma comunidade: quais métodos produzem resultados mais próximos de traduções de referência confiáveis e se a diferença entre dois métodos é real. O que não pode dizer a você: se vale a pena gastar o tempo de um falante com um rascunho. O mesmo número de chrF++ significa coisas diferentes para diferentes idiomas e conjuntos de avaliação, portanto nenhuma pontuação automática aqui carrega um rótulo de qualidade. A Rede costumava mapear um índice composto ponderado em níveis nomeados ("funcional", "implantável", …); esses rótulos foram descontinuados, em parte porque um sistema que repetia uma única frase válida para qualquer entrada recebia o rótulo "funcional" ([por que o índice composto foi descontinuado](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Duas regras de honestidade estrutural decorrem disso, a partir da [Especificação do Benchmark §7](/docs/network/specifications/benchmark#7-human-validation):

- **Uma pontuação é uma indicação para revisão humana, não um veredito.** Um chrF++ forte faz com que valha a pena pilotar um método com falantes; isso não significa que ele esteja pronto.
- **Apenas a revisão da comunidade determina se um método está pronto para um fluxo de trabalho de pós-edição.** Uma amostra estratificada de suas saídas é enviada a falantes bilíngues, que avaliam cada tradução como *rejeitar / compreensão geral / aceitável / excelente*. A organização de governança — e não o placar — decide se o método avança.

Para efeito de comparação, as condições do [Founder's Prize](/docs/network/specifications/prizes) (um piso de chrF++, ≥99% de palavras morfologicamente válidas como critério de corte, ≥70% avaliadas pelos falantes como aceitáveis ou superiores) descrevem um método cujos erros restantes são *erros de linguagem real* — flexão incorreta, e não palavras inventadas. É assim que se parece "um rascunho que vale o tempo de um falante" em números, e o veredito dos falantes é a condição determinante.

## De um método vencedor para um escritório funcionando

Suponha que um método ultrapasse esses portões. Os passos restantes são organizacionais, e são especificados em vez de improvisados:

1. **A propriedade é transferida.** O código do método se torna propriedade da organização de governança da comunidade — o desenvolvedor mantém direitos de atribuição e publicação ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **O método se torna um serviço — o serviço da comunidade.** É empacotado como um plugin que a organização de governança pode executar em sua própria infraestrutura, controlando acesso e usos permitidos ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Se a comunidade escolher oferecê-lo comercialmente, esse é seu negócio em todos os sentidos — Champollion não toma nenhuma parte ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Tradutores o conectam ao seu dia.** Um escritório de tradução aponta seu fluxo de trabalho de documento existente para a API do método: texto fonte entra, rascunho sai, pós-edita, publica. O texto publicado carrega o nome e autoridade do tradutor — a máquina é uma ferramenta na sua mesa, como um dicionário.

## Onde isso está hoje

Falando claramente: o caminho completo está especificado de ponta a ponta e parcialmente construído. A estrutura de avaliação, as métricas, as fichas de execução e o placar público já existem; o sandbox de avaliação está construído, mas só foi testado com um método simplificado; um corpus de desenvolvimento de Plains Cree existe upstream; um prêmio foi proposto, mas nenhum está aberto; a plataforma de implantação existe. A interface de revisão comunitária e o loop de feedback de texto corrigido estão especificados, mas ainda não estão operacionais — as especificações os indicam como planejados, e nós também. Nenhum método completou ainda toda a jornada do benchmark ao uso diário pela comunidade. Essa jornada é a própria definição de sucesso do projeto, e é exatamente por isso que não vamos reivindicá-la antes da hora.

---

## O que isso significa para você

:::info[Se você é membro de uma comunidade]
Uma pontuação alta no placar nunca significa que uma máquina publicará no seu idioma sem supervisão — significa que um gerador de rascunhos pode estar pronto para passar por um *teste* com seus tradutores, nos seus termos, tendo seus falantes como juízes (remunerados — veja [Como os Falantes São Remunerados](/docs/network/perspectives/how-speakers-get-paid)). Se a sua comunidade mantém um escritório de tradução, a pergunta relevante a nos trazer é: "como seria um projeto piloto e quem revisa a saída?"
:::

:::info[Se você é pesquisador]
A abordagem baseada em pós-edição muda o que vale a pena medir: o tempo até obter um texto aceitável com um falante no processo, e não apenas o chrF++. As métricas da Rede servem como aproximações disso ([Especificação de Pontuação §1](/docs/network/specifications/scoring)), e estudos de pós-edição por idioma para línguas morfologicamente complexas representam uma lacuna aberta na pesquisa que esta infraestrutura foi projetada para apoiar.
:::

:::info[Se você é um desenvolvedor]
Otimize para o editor, não para a métrica. Um método que produz palavras reais com inflexões ocasionalmente erradas é corrigível em segundos por um falante; um método que alucina formas plausíveis envenena todo o fluxo de trabalho — é por isso que a validade morfológica é tão rigorosamente controlada aqui. Comece em [Enviar um Método](/docs/network/getting-started/submit-a-method) e leia a [Interface de Método](/docs/network/specifications/methods) para saber o que você eventualmente entregará se vencer.
:::

## Veja também

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — por que o portão humano é o ponto, não uma limitação
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — o que acontece quando o texto publicado está errado mesmo assim
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — o portão de validação humana, formalmente
