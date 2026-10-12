---
sidebar_position: 3
title: "Como o Trabalho é Financiado"
---

# Como o Trabalho É Financiado

> **Resumo Executivo.** O Champollion é um projeto de pesquisa não comercial —
> com código-fonte disponível e gratuito para uso não comercial, com sua ferramenta de
> avaliação e registros em código aberto — e hoje é **totalmente autofinanciado por seu
> fundador**. Sem subvenções,
> sem patrocinadores, sem nenhuma instituição por trás — por enquanto: agora [convidamos
> ativamente patrocinadores](/get-involved#sponsors). Qualquer patrocínio seria
> **100% repassado**: financiaria a construção de corpora, ferramentas e trabalho
> comunitário a valores publicados, com prestação de contas pública — nada disso iria para o Champollion. Nenhum
> valor foi recebido e nenhum fundo é mantido hoje.
> Nada aqui é monetizado: não há API paga, tarifação por uso, divisão de receita
> e nenhuma reivindicação da plataforma sobre qualquer coisa que pertença a uma comunidade. Esta página explica
> claramente de onde vem o dinheiro agora, o que o financiamento cobriria e como
> entrar em contato conosco se você quiser mudar a primeira parte.

O Champollion é um conjunto de ferramentas de pesquisa e desenvolvimento em tradução automática —
com código-fonte disponível e gratuito para uso não comercial. A CLI, o servidor MCP
e a suíte de treinamento de modelos (nmt-forge) são PolyForm Noncommercial 1.0.0;
a ferramenta de avaliação é de código aberto sob a AGPL-3.0-or-later; os registros
de dados são de código aberto sob a Apache-2.0. [Quem pode usar isto](/docs/getting-started/who-may-use-this)
explica o que cada licença cobre, em termos simples. Não há produto
comercial por trás deles — e nenhum financiamento por trás deles até o momento.

## De onde vem o dinheiro hoje

**Uma pessoa.** Tudo o que foi construído até agora — o harness, a CLI, o
índice de idiomas, as especificações de benchmark, o site — foi auto-financiado
pelo fundador do projeto. Dizemos isso claramente por duas razões:

1. **Honestidade sobre escala.** Um projeto auto-financiado ainda não pode pagar
   pela construção de corpus e validação de falantes que as especificações
   custam. As taxas publicadas são compromissos sobre *como* o dinheiro se move
   quando existe, não evidência de que já está se movendo.
2. **É um convite aberto.** A infraestrutura está construída e os custos
   unitários são publicados. O que falta é o financiamento para executá-la. Se
   você financia tecnologia de linguagem — como agência de concessão, fundação,
   departamento ou indivíduo — **queremos ouvir você**: abra uma issue no
   [GitHub](https://github.com/gamedaysuits/Champollion) ou entre em contato
   via [champollion.dev](https://champollion.dev).

## O que o financiamento compra

Os custos já estão especificados, então um financiador pode comprar coisas
concretas e delimitadas:

- **Um engajamento de corpus para um idioma** — $2.500–6.000 em remuneração
  de falantes ($50–65 CAD/hora, valores publicados) constrói um corpus de
  benchmark que permanece como propriedade de quem o constrói. Consulte
  [Como os falantes são pagos](/docs/network/perspectives/how-speakers-get-paid).
- **Uma rodada de validação de métricas** — $1.475–1.920 paga três falantes bilíngues
  para comparar as métricas automatizadas com o julgamento humano.
- **Um prêmio patrocinado** — financiar uma meta específica (por exemplo,
  inglês → cree das planícies confiável). Os fundos de premiação seriam mantidos e concedidos
  pelo anfitrião do concurso, nos termos da comunidade — nunca pelo Champollion; nenhum
  prêmio foi financiado ainda.
  Consulte a [Especificação do prêmio](/docs/network/specifications/prizes).
- **Créditos de computação e API** — reunidos para executar a fila pública de benchmarks.

Uma vez financiada, isso tornaria a Rede um mecanismo de distribuição de recursos para
o trabalho com dados de idiomas: o dinheiro entra, e sai trabalho remunerado para as
pessoas que constroem os corpora — e elas mantêm a propriedade do que constroem.

## Para onde o dinheiro vai

Assim que houver algum — nenhum fundo é mantido hoje:

- **Para construtores e validadores de corpus, em taxas publicadas.** O
  pagamento não transfere propriedade: um construtor é pago pelo trabalho *e*
  permanece como guardião do corpus.
- **Para vencedores de prêmios, através de trusts comunitários.** Quando um
  prêmio patrocinado é reivindicado, o trust paga o desenvolvedor; o método é
  transferido para a comunidade sob os termos desse prêmio (veja
  [Propriedade & Termos](/docs/network/sovereignty/ownership-transfer)).
- **Para infraestrutura** — hospedagem, execução de avaliações e manutenção.
- **Contabilizado publicamente.** Engajamentos patrocinados são registrados
  abertamente — o que foi financiado, em qual taxa publicada e o que foi
  entregue — para que um patrocinador (e todos os outros) possa auditar que a
  promessa de pass-through foi mantida.

## O que Champollion fica com

**Nada.** Não há divisão de receita, sem percentual de infraestrutura e sem
reivindicação sobre ativos comunitários. Se uma comunidade implanta um método
que possui — em seus próprios servidores, através de seus próprios canais,
comercialmente ou não — tudo o que ela ganha é seu. Corpus registrados na
Network permanecem propriedade do guardião completamente, antes, durante e
depois de qualquer avaliação.

Se oportunidades comerciais surgirem em torno deste trabalho, estamos abertos
para essa conversa — mas qualquer arranjo assim seria negociado naquele momento,
com os guardiões cujos dados ou métodos estão envolvidos, nos seus termos. Nada
é pré-comprometido nestes documentos, e nenhum documento aqui deve ser lido
como reservando uma parte de nada para a plataforma.

## Para financiadores

A questão de sustentabilidade para tecnologia de linguagem é geralmente "o que
acontece quando a bolsa termina?" Para um projeto não-comercial, a resposta
honesta é: os *ativos* sobrevivem ao financiamento, porque são propriedade das
pessoas que podem mantê-los.

| Modelo tradicional | Modelo de guardiania |
|---|---|
| Bolsa financia pesquisa | Bolsa financia pesquisa |
| Artigo publicado | Corpus construído, métodos medidos |
| Bolsa termina, ferramenta abandonada | Comunidade possui o corpus e qualquer método transferido completamente |
| Comunidade não recebe nada | Falantes foram pagos por cada hora; os ativos ficam em casa |

Resultados mensuráveis para um financiador:

- Corpus construídos e registrados, sob controle do guardião
- Horas de falante pagas entregues a comunidades de linguagem
- Métodos medidos e (onde os termos de um prêmio dizem assim) transferidos para
  propriedade comunitária
- Pares de idiomas cobertos por benchmarks públicos confiáveis

Veja a [Especificação de Benchmark](/docs/network/specifications/benchmark), §10
para modelos de custo detalhados.

## Veja Também

- [Propriedade & Termos](/docs/network/sovereignty/ownership-transfer) — termos por idioma e o modelo de transferência
- [Guardiania de Dados](/docs/network/sovereignty/data-sovereignty) — a posição que este modelo implementa
- [Como os Falantes São Pagos](/docs/network/perspectives/how-speakers-get-paid) — taxas publicadas
