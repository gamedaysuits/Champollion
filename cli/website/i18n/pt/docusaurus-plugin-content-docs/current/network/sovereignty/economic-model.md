---
sidebar_position: 3
title: "Como o Trabalho é Financiado"
---

# Como o Trabalho É Financiado

> **Resumo Executivo.** O Champollion é um projeto de pesquisa não comercial —
> com código-fonte disponível e gratuito para uso não comercial, seu framework de avaliação e
> registros em código aberto — e hoje é **totalmente autofinanciado por seu
> fundador**. Sem subsídios,
> sem patrocinadores, sem nenhuma instituição por trás — ainda: agora
> [convidamos ativamente patrocinadores](/get-involved#sponsors). Cada dólar de patrocínio é
> **100% repassado**: ele financia a construção de corpus, ferramentas e trabalho comunitário
> a taxas publicadas, contabilizadas publicamente — nada disso vai para o Champollion.
> Nada aqui é monetizado: não há API paga, nem medição, nem divisão de receitas,
> e nenhuma reivindicação da plataforma sobre qualquer coisa que uma comunidade possua. Esta página diz
> claramente de onde vem o dinheiro agora, o que o financiamento compraria e como
> entrar em contato conosco se você quiser mudar a primeira parte.

O Champollion é um ferramental de pesquisa e desenvolvimento de tradução automática —
com código-fonte disponível e gratuito para uso não comercial. A CLI é PolyForm
Noncommercial 1.0.0 (o uso comercial requer permissão), o framework de avaliação
é de código aberto AGPL-3.0, e os registros de dados são de código aberto
Apache-2.0. Não há nenhum produto comercial por trás deles — e também não há
nenhum financiamento por trás deles ainda.

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

- **Um engajamento de corpus para um idioma** — $2.500–6.000 em compensação
  para falantes ($50–65 CAD/hora, taxas publicadas) constrói um corpus de
  benchmark que permanece propriedade do construtor. Veja
  [Como os Falantes São Pagos](/docs/network/perspectives/how-speakers-get-paid).
- **Uma rodada de validação de métrica** — $1.475–1.920 paga três falantes
  bilíngues para verificar as métricas automatizadas contra o julgamento humano.
- **Um prêmio patrocinado** — financie uma meta direcionada (por exemplo,
  English → Plains Cree confiável). Os fundos do prêmio são mantidos e
  distribuídos por um trust governado pela comunidade, nos termos da comunidade
  — não por Champollion. Veja a [Especificação de Prêmio](/docs/network/specifications/prizes).
- **Créditos de computação e API** — agrupados para executar a fila de
  benchmark pública.

Na prática, isso torna a Network um mecanismo de distribuição de financiamento
para trabalho de dados de linguagem: dinheiro entra, trabalho pago para as
pessoas que constroem corpus sai — e elas mantêm o que constroem.

## Para onde o dinheiro vai

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
