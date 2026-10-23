---
id: how-this-site-is-translated
title: "Como este site é traduzido"
description: "Cada idioma neste site é traduzido automaticamente pelo próprio Champollion — a mesma CLI que esta documentação descreve. Nós usamos nossa própria ferramenta."
---

# Como este site é traduzido

Cada localidade deste site, exceto o inglês — as que estão na tabela abaixo — é
**traduzida automaticamente pelo próprio Champollion** — a mesma CLI que esta documentação
descreve (`npx champollion sync`). Nós usamos nossa própria ferramenta.

No momento, cada par de idiomas usa um único modelo:
**`google/gemini-3.8-flash`** — o padrão da própria CLI — com temperatura 0,
traduzindo com as orientações de registro e terminologia para cada idioma
descritas abaixo. (Até 2026-10-06, o site usava
`google/gemini-3.1-pro-preview`.) Escolhemos um modelo deliberadamente como um
padrão honesto enquanto reconstruímos nossa seleção de modelos baseada em benchmarks (veja
abaixo) — portanto, esta é uma escolha simples e documentada, e não um resultado que estejamos
tentando fazer parecer algo que não é.

Duas coisas que você deve saber como leitor:

1. **Estas páginas são traduções automáticas.** Elas são produzidas com o
   registro e as diretrizes de terminologia descritos abaixo, mas nenhum humano revisou
   cada frase. Se algo parecer errado, a versão em inglês é a
   oficial — e adoraríamos receber uma correção.
2. **O modelo é um padrão hoje, escolhido por benchmark amanhã.**
   O design do Champollion é escolher o modelo de tradução *para cada par
   de idiomas* por benchmark — pontuar cada candidato em um corpus de desenvolvimento e
   traduzir aquele locale com o método de maior pontuação (empates estatísticos
   são desempatados pelo custo). Estamos executando novamente essa seleção através da nossa própria
   validação de integridade antes de fixar os vencedores por par aqui. **Até que essas execuções
   sejam publicadas no [Network leaderboard](/leaderboard), esta página não
   reivindicará uma proveniência de benchmark que não possa mostrar a você.**

## Proveniência por locale

| Localidade | Idioma | Método | Modelo | Registro | Última sincronização |
|------------|--------|--------|--------|----------|----------------------|
| fr | Français | llm | `google/gemini-3.8-flash` | *vous* formal | 2026-10-12 |
| de | Deutsch | llm | `google/gemini-3.8-flash` | Sie-Form | 2026-10-12 |
| nl | Nederlands | llm | `google/gemini-3.8-flash` | u-vorm | 2026-10-12 |
| fil | Filipino | llm | `google/gemini-3.8-flash` | formal | 2026-10-12 |
| es | Español | llm | `google/gemini-3.8-flash` | latino-americano neutro | 2026-10-12 |
| zh | 简体中文 | llm | `google/gemini-3.8-flash` | técnico profissional | 2026-10-12 |
| ja | 日本語 | llm | `google/gemini-3.8-flash` | です/ます (polido) | 2026-10-12 |
| ko | 한국어 | llm | `google/gemini-3.8-flash` | 해요체 (polido) | 2026-10-12 |
| pt | Português | llm | `google/gemini-3.8-flash` | profissional | 2026-10-12 |
| th | ไทย | llm | `google/gemini-3.8-flash` | profissional neutro | 2026-10-12 |
| vi | Tiếng Việt | llm | `google/gemini-3.8-flash` | forma *bạn* neutra | 2026-10-12 |
| ar | العربية | llm | `google/gemini-3.8-flash` | MSA, profissional | 2026-10-12 |

## A seleção por benchmark que estamos reconstruindo

O método pretendido — e a forma como a configuração é estruturada para funcionar — é
a seleção de modelos por par orientada pela nossa própria avaliação: pontuar cada
modelo candidato no corpus de desenvolvimento do par, escolher o modelo com o
maior chrF++ e, quando um teste de significância pareado não puder separar dois
candidatos, escolher o mais barato. O ciclo completo está
documentado para qualquer pessoa que queira reproduzi-lo.

Nós **não** estamos publicando pontuações ou um "vencedor do benchmark" por
idioma nesta página hoje, porque a varredura de seleção que embasaria
esses números está sendo executada novamente pelo gate de integridade do harness primeiro.
Quando estiver concluída, as execuções estarão no leaderboard público, esta tabela
conterá o modelo vencedor de cada par acompanhado de sua execução citada, e a configuração do site
voltará a fixar os vencedores por par. Até lá: um padrão honesto.

A Network pontua as execuções da maneira padrão: chrF++ em nível de corpus com seu
intervalo de confiança bootstrap de 95% e assinatura sacreBLEU, outras métricas
padrão ao lado e diagnósticos relatados separadamente
([Como as execuções são pontuadas](/docs/network/specifications/scoring#how-runs-are-scored)).
As pontuações só são comparáveis **dentro de um mesmo par de idiomas e conjunto de avaliação**,
nunca entre pares — diferenças de sistema de escrita e de corpus tornam a comparação entre pares
sem sentido.

## Registro e tom

Cada idioma é traduzido com um registro explícito escolhido a partir dos
cartões de idioma do Champollion, para que a formalidade seja consistente em todo o site:

- **Français** — vouvoiement (*vous* formal)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — formal, com termos técnicos padrão
- **Español** — espanhol latino-americano neutro
- **简体中文** — registro técnico profissional
- **日本語** — です/ます (forma educada)
- **한국어** — 해요체 (educado)
- **Português** — registro profissional
- **ไทย** — profissional neutro
- **Tiếng Việt** — forma *bạn* neutra
- **العربية** — Árabe Padrão Moderno (MSA), registro profissional

## O que não é traduzido automaticamente

Blocos de código, comandos da CLI, chaves de configuração, nomes de pacotes, URLs e
nomes próprios são protegidos durante a tradução e permanecem em inglês de
forma intencional.

## Encontrou um erro de tradução?

Abra uma issue ou PR — a fonte de cada página traduzida é o original
em inglês. As correções em uma página traduzida são preservadas em sincronizações futuras, desde
que a fonte em inglês daquela página não seja alterada (a sincronização retraduz uma
página apenas quando sua fonte em inglês muda).

*Esta página é traduzida automaticamente pelo método descrito acima — ela
descreve sua própria tradução.*
