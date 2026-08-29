---
id: how-this-site-is-translated
title: "Como este site é traduzido"
description: "Cada idioma neste site é traduzido automaticamente pelo próprio Champollion — a mesma CLI que esta documentação descreve. Nós usamos nossa própria ferramenta."
---

# Como este site é traduzido

Este site está disponível em 13 idiomas. Todos os locales, exceto o inglês, são
**traduzidos automaticamente pelo próprio Champollion** — a mesma CLI que esta documentação
descreve (`npx champollion sync`). Nós usamos nossa própria ferramenta.

No momento, cada par de idiomas usa um único modelo:
**`google/gemini-3.1-pro-preview`**, traduzindo com o registro
e as diretrizes de terminologia por idioma descritos abaixo. Escolhemos um modelo
deliberadamente como um padrão honesto enquanto reconstruímos nossa seleção de modelos
baseada em benchmarks (veja abaixo) — portanto, esta é uma escolha simples e documentada, não um
resultado que estamos disfarçando de algo que não é.

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

| Locale | Idioma | Método | Modelo | Registro | Última sincronização |
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | *vous* formal | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | formal | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | latino-americano neutro | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | técnico profissional | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (educado) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (educado) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | profissional | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | profissional neutro | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | forma *bạn* neutra | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | MSA, profissional | 2026-07-18 |

## A seleção por benchmark que estamos reconstruindo

O método pretendido — e como a configuração está estruturada para funcionar — é
a seleção de modelo por par, orientada por nossa própria avaliação: pontuar cada
modelo candidato no corpus de desenvolvimento do par, pegar a maior
pontuação composta e desempatar empates estatísticos pelo custo. O ciclo completo está
documentado para qualquer pessoa que queira reproduzi-lo.

Nós **não** estamos publicando pontuações compostas ou um "vencedor do benchmark" por
idioma nesta página hoje, porque a varredura de seleção que embasaria
esses números está sendo executada novamente através da validação de integridade do harness primeiro.
Quando for concluída, as execuções estarão no leaderboard público, esta tabela
trará o modelo vencedor de cada par com sua execução citada, e a configuração do site
fixará novamente os vencedores por par. Até lá: um padrão honesto.

A *pontuação composta* (composite score) é a métrica de qualidade combinada da Network (chrF++, correspondência
exata e plugins de métricas carregados, verificados por bootstrap-CI). As pontuações são comparáveis apenas
**dentro de um par de idiomas**, nunca entre pares — diferenças de script e
corpus tornam a comparação entre pares sem sentido.

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
