---
title: "Referência"
slug: /reference
description: "Todos os detalhes técnicos em um só mapa: os comandos, os formatos de arquivo, as especificações, os limites técnicos, a hospedagem de um teste selado, a tabela de classificação, a tradução de aplicativos e sites, o Atlas e a infraestrutura de rede."
---

# Referência

O registro técnico completo, para desenvolvedores, pesquisadores e agentes de IA.
As [páginas para pessoas](/docs/) contam a mesma história em palavras simples, e
[o manual dos agentes](/docs/agents) explica como um agente o opera; cada página
abaixo apresenta tudo com total precisão.

## Comandos

- [`champollion`](/docs/reference/cli) — cada comando e flag da ferramenta do
  projeto e do tradutor de apps e sites.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — cada
  comando da suíte de treinamento de modelos, gerado a partir do seu analisador.
- [`mt-eval`](/docs/reference/mt-eval) — cada comando do harness de
  avaliação, gerado a partir do seu analisador.
- [O servidor MCP](/docs/network/getting-started/mcp-server) — ambos os perfis,
  cada ferramenta e cada argumento.

## Formatos

- [Formatos do framework](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 e service-api/1, a partir de seus esquemas.
- [Ficha de execução](/docs/network/specifications/run-card) — o que uma execução
  pontuada registra e publica.
- [Dados de coaching](/docs/concepts/coaching-data) — as notas gramaticais e listas
  de palavras fornecidas a um método de LLM.
- [Especificação de plugins](/docs/reference/plugin-spec) — o manifesto de plugin de
  método (`method.json`) com o qual um método de tradução é distribuído.
- [Ficha de idioma](/docs/reference/language-card-spec) — o esquema de uma ficha
  no Atlas.

## Especificações

- [Pontuação](/docs/network/specifications/scoring) — scoring standard/1: o
  chrF++ principal do corpus com seu intervalo de bootstrap de 95%, as métricas padrão
  ao lado dele e os diagnósticos mantidos à parte.
- [Significância](/docs/network/specifications/significance) — testes pareados
  e quando uma execução é melhor do que outra.
- [Interface de método](/docs/network/specifications/methods) — o que é um método,
  suas classes e dependências.
- [Confiabilidade das métricas](/docs/network/specifications/metric-reliability) —
  em qual métrica confiar para cada tipo de idioma, a partir de julgamentos humanos.
- [Benchmark](/docs/network/specifications/benchmark) — o protocolo que toda
  execução válida segue.
- [Harness](/docs/network/specifications/harness) — como o `mt-eval` executa,
  pontua e publica.
- [Validação por falantes](/docs/network/specifications/speaker-validation) — a
  revisão humana que as pontuações automáticas substituem.

## Limites técnicos

- [Limites técnicos](/docs/network/honest-limitations) — o que não se afirma:
  níveis de confiança autodeclarados, nenhuma revisão por falantes ainda, custódia de
  testes selados e nenhuma confiança por sentença.

## Hospedar um teste selado

- [Realizar um concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest)
  — o guia prático ponta a ponta para um conjunto de teste que nunca sai da máquina do host.
- [Nó de avaliação soberano](/docs/network/sovereignty/sovereign-eval-node) — a
  máquina de pontuação: hardware, air gap e cerimônia de chaves.
- [Registro de corpora](/docs/network/sovereignty/registering-corpora) —
  níveis de exposição e faixas de licença para um corpus sob sua posse.
- [Propriedade e termos](/docs/network/sovereignty/ownership-transfer) e
  [Modelos de termos](/docs/network/sovereignty/terms-templates) — o que uma submissão
  cede, declarado antes de qualquer pessoa participar.
- [Prêmios](/docs/network/specifications/prizes) — o que um prêmio exige, caso um
  patrocinador abra um.

## Tabela de classificação e publicação

- [Tabela de classificação e publicação](/docs/reference/leaderboard) — o que é a tabela,
  os dois tipos de benchmark e o que uma execução publicada traz.
- [Regras de submissão](/docs/network/leaderboard/rules) — o que é aceito,
  o que é desclassificado e os níveis de verificação.
- [Conjuntos de dados de avaliação](/docs/network/leaderboard/datasets) — os conjuntos
  de dados registrados e suas faixas de licença.
- [Submeter um método](/docs/network/getting-started/submit-a-method) — executar o
  harness e publicar uma ficha de execução.
- [Contribuir com computação](/docs/network/getting-started/contributing-compute) —
  executar itens da fila pública com sua própria chave.
- [FAQ](/docs/network/getting-started/faq) — métricas, modelos, FSTs e
  desclassificação.

## Tradução de apps e sites

- [Tradução de apps e sites](/docs/intro) — o que o `champollion sync` faz e
  um guia para cada página sobre ele: início rápido, instalação, configuração,
  frameworks, CI/CD, métodos, conteúdo, memória de tradução, o quality gate,
  segurança, scripts, tradutores e solução de problemas.

## O Atlas

- [O Atlas](/docs/atlas) — o que é o índice de idiomas e de onde vêm seus fatos.
- [Especificação da ficha de idioma](/docs/reference/language-card-spec) e o
  [procedimento de citação](/docs/reference/language-card-citation-procedure) —
  cada campo e como cada um é citado.
- [O que conta como um idioma](/docs/network/context/what-counts-as-a-language)
  — as respostas que o índice fornece e os motivos.
- [Submeter ao índice](/docs/network/getting-started/submit-to-the-index) e
  [Relatar erros](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — propondo uma entrada ou correção.

## Infraestrutura da rede

- [Construção da fila](/docs/network/specifications/queue-construction) e
  [por que a fila é construída dessa forma](/docs/network/perspectives/why-the-queue)
  — como a fila pública de trabalho classifica o que medir a seguir.
- [Força de conexão](/docs/network/specifications/connection-strength) —
  o que um arco no mapa da rede diz sobre um par e a escala de força
  que foi descontinuada.
- [Contribuir com computação](/docs/network/getting-started/contributing-compute) —
  executando a fila.
