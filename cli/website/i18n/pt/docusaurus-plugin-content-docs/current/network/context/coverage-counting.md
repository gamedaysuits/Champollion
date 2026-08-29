---
sidebar_position: 6
title: "Contagens de Cobertura: Como Contamos"
description: "Como o Champollion conta “idiomas com tradução automática” — os dois níveis (qualquer engine vs. serviço implantado), a SSOT de onde cada número exibido é lido e a disciplina de atualização. Correções são bem-vindas."
---

# Contagens de Cobertura: Como as Contamos

> **Resumo executivo.** Quando o site diz que **552 línguas vivas possuem alguma tradução automática** e **196 são atendidas por um serviço implantado**, essas são duas contagens diferentes e deliberadamente separadas. Esta página define ambos os níveis, nomeia a fonte única de verdade da qual cada número é lido no momento da compilação (build) e descreve como as listas são atualizadas. A cobertura é uma *alegação de existência*, nunca uma alegação de qualidade.

## Os dois níveis

**Nível 1 — qualquer motor de TA dedicado ("coberto").** Uma língua viva conta como coberta se aparecer na lista publicada de idiomas suportados de *qualquer* motor de tradução automática (TA) dedicado rastreado — serviços de API/consumidor implantados (Google Translate, Microsoft Translator, DeepL, LibreTranslate, …) **ou** modelos de pesquisa abertos (NLLB-200, OPUS-MT, M2M-100, MADLAD-400, …). Esta é a união que acende um ponto verde no mapa da rede.

**Nível 2 — serviço implantado ("atendido").** O corte mais rigoroso: o idioma está na lista de um motor que qualquer pessoa pode realmente *usar hoje* como consumidor ou serviço de API. Um checkpoint de pesquisa aberto que você teria que baixar, hospedar e servir por conta própria não conta aqui. Este é o número que responde: "um falante poderia traduzir uma página da web agora mesmo, sem trabalho de engenharia?"

Os dois níveis existem porque respondem a perguntas diferentes, e combiná-los superestima a cobertura mundial. Ambos são contados apenas sobre **línguas vivas individuais da ISO 639-3** (`isoType: 'L'`).

## De onde vêm os números (nada digitado manualmente)

Cada contagem exibida é uma **leitura em tempo de compilação** de SSOTs (fontes únicas de verdade) da máquina — nenhum número no site é digitado no texto e deixado para ficar desatualizado:

1. **As listas por motor** residem em `cli/shared/catalogue/method-coverage.json` —
   uma entrada por motor, importada *apenas como citação* da própria lista publicada de idiomas suportados daquele provedor, com sua `source_url` e uma data `asOf`. O Champollion não audita nem reproduz essas listas; elas são alegações dos próprios provedores.
2. **A compilação cruza** essas listas com o índice de línguas vivas e emite as contagens de nível nas estatísticas de compilação do site (`stats.coverage.dedicatedLiving` para o
   nível 1, `stats.coverage.serviceLiving` para o nível 2, sobre `stats.livingTotal`
   línguas vivas).
3. **As páginas renderizam as estatísticas**, e um gate de paridade pré-push falha a compilação se o texto e as estatísticas divergirem.

## "194 idiomas" e "187 idiomas" podem ambos ser verdadeiros

A lista de um provedor e uma contagem de *idiomas* não são o mesmo objeto, portanto, cada entrada na SSOT declara qual é o seu número:

- **`publisher-list-rows`** — o tamanho da própria lista publicada do provedor,
  exatamente como eles a publicam. A página do Google Cloud Translation lista **194** linhas
  para seu modelo NMT; esse é o número que este site atribui ao Google pelo nome.
- **`champollion-derived-enumeration`** — o *nosso* agrupamento dessa lista em idiomas
  base distintos da ISO 639-3. Essas mesmas 194 linhas do Google representam **187** idiomas,
  porque `zh-CN` e `zh-TW` são um idioma em dois scripts, assim como `pt-PT`
  e `pt-BR`, e assim por diante. Este número é nosso, nunca do provedor.
- **`publisher-stated-headline`** — um total que o provedor afirma sem nenhuma lista
  publicada por trás dele. Nada pode ser derivado disso.

A diferença entre os dois primeiros é aritmética, não uma discordância, e ocorre
em todos os provedores: Microsoft 135 linhas → 128 idiomas, LibreTranslate 49 →
47, as 200 variantes FLORES do NLLB-200 → 196. O mapa e as contagens de nível leem a
*lista enumerada*, nunca o título. Um gate pré-push falha a compilação se a
base declarada de uma entrada e sua lista se contradisserem.

Observe também que um provedor pode publicar várias listas. A página do Google contém uma
tabela separada para seu nível de Translation LLM (127 linhas em 16/08/2026) e
não declara nenhum total combinado — portanto, "quantos idiomas o Google suporta?"
não tem uma única resposta publicada, e este site não inventa uma.

## Cobertura alegada não é qualidade — e nem sempre é implantável

Um idioma na lista de um provedor significa que o provedor *alega suporte*, nada mais.
Duas notas de honestidade que o site aplica em todos os lugares onde essas contagens aparecem:

- **Cobertura ≠ qualidade.** Se as traduções são boas é uma questão separada e
  medida — esse é o objetivo principal da rede de benchmark. As alegações de qualidade
  ficam no placar de líderes (leaderboard), classificadas por (método, conjunto de dados, métrica); as alegações de cobertura
  ficam aqui.
- **Alegado ≠ implantável.** Modelos de pesquisa de grande abrangência podem alegar contagens de idiomas
  muito grandes, enquanto sua própria documentação relata qualidade utilizável para um
  subconjunto muito menor. Onde um provedor publica tal autoavaliação, o site mostra a
  contagem alegada *e* o próprio número de qualidade/implantável do provedor, cada um citado com base
  nos materiais do provedor.

## A disciplina de atualização

As listas de provedores mudam; as contagens devem acompanhar, mecanicamente:

- Cada entrada em `method-coverage.json` carrega sua própria data `asOf`, e o arquivo
  carrega um `asOf` de nível superior — a data da última varredura. As superfícies que mostram
  contagens de cobertura exibem ou vinculam essa data.
- Uma **varredura SOTA** (verificar novamente a lista publicada de cada provedor, adicionando motores recém-rastreados)
  é uma tarefa de manutenção periódica; a varredura atualiza a SSOT, e
  cada contagem no site acompanha na próxima compilação. Nada precisa ser "lembrado"
  no texto da página.
- Entre as varreduras, as contagens são exatamente tão recentes quanto suas datas `asOf` — e é por
  isso que essas datas fazem parte dos dados, não uma convenção de nota de rodapé.

## Correções e debates são bem-vindos

Se a lista de um provedor mudou, um idioma foi classificado incorretamente ou você acha que o limite de um nível
foi traçado de forma errada, avise-nos — abra uma issue em
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
ou envie um e-mail para [info@champollion.dev](mailto:info@champollion.dev).

---

## Fontes

- **Listas por motor** — `cli/shared/catalogue/method-coverage.json`: a própria
  lista publicada de idiomas suportados de cada motor (apenas como citação; `source_url` + `asOf` por entrada).
- **Conjunto de línguas vivas** — línguas vivas individuais da ISO 639-3 (`isoType: 'L'`)
  no índice de idiomas construído a partir dos cartões de idiomas citados.
- **Contagens de nível** — `stats.coverage.dedicatedLiving` (nível 1),
  `stats.coverage.serviceLiving` (nível 2), `stats.livingTotal` emitidos na compilação. Derivados do Champollion.
- **A estimativa populacional construída sobre essas contagens** — consulte
  [A Lacuna de Cobertura: Como a Estimamos](/docs/network/context/coverage-gap-estimate).
