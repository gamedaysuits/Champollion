---
sidebar_position: 1
slug: /intro
title: "Introdução"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Um framework de internacionalização totalmente customizável. Um comando traduz seus arquivos de locale. Uma configuração controla cada método, modelo e par de idiomas. E se os métodos integrados não forem suficientes — construa o seu próprio, teste se funciona e implante.

```bash
npx champollion sync
```

O champollion detecta automaticamente seus arquivos de locale, formato e idiomas de destino. Ele traduz o que está faltando, pula o que já foi feito, verifica cada resultado em busca de saídas corrompidas e grava uma saída limpa. Esse é o ponto de partida.

:::info[Parte de algo maior]

Esta CLI é a ponta de implantação do **Champollion** — uma infraestrutura que
mede a tradução automática para idiomas que ninguém mais mede e
publica o que descobre. O lado da medição cria conjuntos de testes de avaliação e
um mapa público de quem consegue traduzir o quê, com que qualidade e em quais tipos de texto;
a CLI é onde um método comprovado se torna algo que você pode realmente executar.

Uma regra molda tudo: dados linguísticos são tratados como dados biológicos, de modo que as
pessoas que fornecem um corpus detêm as chaves dele e de tudo o que for medido
com base nele. A visão completa — o que existe, quais são as regras, onde você
se encaixa — está em [O que é o Champollion](/docs/what-is-champollion), e o
lado da medição fica em [a Rede](/docs/network/).

:::

---

## Por Que Não Apenas Programar Você Mesmo?

Você poderia escrever um loop rápido que chama Google Translate em cada chave. A maioria dos desenvolvedores faz — leva cerca de 30 linhas. Aqui é onde quebra:

- **Sem detecção de alterações.** Atualize uma string em inglês — a tradução fica desatualizada para sempre. O champollion rastreia cada valor de origem com hashes SHA-256 e retraduz apenas o que mudou.
- **Sem agrupamento em lotes.** Uma chamada de API por chave significa 200 chaves = 200 viagens de ida e volta (round trips). O champollion agrupa em lotes de forma inteligente (configurável, padrão de 80 chaves/lote para LLMs, 128 para o Google).
- **Sem cache.** Toda sincronização retraduz tudo. A Memória de Tradução do champollion armazena traduções em cache por texto de origem + locale + método — reexecutar a sincronização após alterar uma única chave só traduz essa chave, não o arquivo inteiro.
- **Sem barreira de qualidade.** A tradução automática alucina, repete a origem em eco ou gera saídas no sistema de escrita errado. O champollion verifica cada tradução antes de gravá-la — saídas vazias, ecos da origem, loops de repetição, inflação de extensão, conteúdo excluído e sistemas de escrita incorretos são capturados e rejeitados. A barreira detecta saídas corrompidas, não significados incorretos.
- **Sem reconhecimento de formato.** Preso a JSON? O champollion lida com JSON, TOML, YAML e Markdown do Hugo (frontmatter + corpo) com detecção automática.
- **Sem controle de método.** Cada par de idiomas recebe o mesmo método. O champollion permite usar o Google Translate para francês, um LLM para japonês e um pipeline personalizado hospedado pela comunidade para cree — no mesmo arquivo de configuração.

champollion é a versão de produção desse script.

---

## O Que O Torna Diferente

### Cada método é um plugin

O método de tradução é **configurável por par de idiomas**. Misture Google Translate, LLMs, prompts treinados e APIs customizadas no mesmo projeto:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

O francês fica com o Google Translate (rápido, barato). O japonês fica com um LLM premium (com nuances). O cree das planícies fica com um LLM instruído com as regras gramaticais e o dicionário que você fornecer. O mesmo comando `sync`. A mesma barreira de qualidade. A mesma CLI.

### Veja o que funciona

Acha que seu método pode traduzir inglês para espanhol? Turco para azerbaijano? Inglês para Cree?

**Construa e teste.** O [harness de avaliação](/docs/network/specifications/harness) complementar faz benchmark de qualquer método de tradução com pontuação reproduzível e com impressão digital. O [placar](/leaderboard) registra cada execução publicada, para que todos possam ver o que funciona.

O harness de avaliação e a CLI de produção compartilham a mesma interface de plugin. Um método que pontua bem no harness pode ser usado em produção — se a comunidade cujo idioma ele serve der consentimento. Para idiomas indígenas e de baixo recurso, esse consentimento importa. Veja [Soberania de Dados](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

Mesmo plugin. Conecte e teste.

### O kit de ferramentas completo

champollion não é apenas `sync`. É um pipeline i18n completo:

| Comando | O Que Faz |
|---------|-------------|
| `sync` | Traduz chaves faltantes e obsoletas (com verificação pós-sincronização) |
| `watch` | Sincronização automática quando seu arquivo de origem muda |
| `lint` | Verifica código-fonte para strings codificadas |
| `wrap` | Envolve automaticamente strings codificadas em chamadas `t()` |
| `audit` | Lista todos os marcadores de fallback `[EN]` de execuções anteriores |
| `verify` | Verifica se as traduções estão presentes e corretas (porta de CI) |
| `integrity` | Detecta corrupção de placeholder, problemas de codificação e completude de plural ICU |
| `seo` | Gera tags hreflang, sitemaps e schema JSON-LD |
| `status` | Mostra configuração de par, plugins e pontuações de benchmark |
| `provenance` | Audita licenciamento de recursos de tradução |
| `plugin` | Instala, remove e lista plugins de método |
| `fonts` | Baixa fontes web para conversores de script PUA |
| `tm` | Gerencia cache de Memória de Tradução (estatísticas, limpeza, por locale) |
| `xliff` | Exporta/importa XLIFF 1.2 para revisão de tradutor profissional |

Quatro destes — `lint`, `sync`, `verify`, `audit` — formam um pipeline de CI que detecta strings codificadas, as traduz, verifica a correção e falha a compilação se algum locale estiver incompleto.

---

## A Rede

O [Ranking de Métodos](/leaderboard) é o placar — em tempo real, público e aberto para envios. Cada envio recebe a impressão digital de um commit do Git, é vinculado à versão de um conjunto de dados específico e avaliado pelo mesmo harness. Qualquer pessoa pode enviar.

**O que você pode construir?** O harness recebe JSON. Plugins recebem JSON. Qualquer método que produza JSON pode ser testado:

| Abordagem | Exemplo |
|----------|---------|
| **LLM Treinado** | Injete regras gramaticais e dicionários no prompt de um modelo de fronteira |
| **Modelo Fine-tuned** | Treine um modelo aberto em texto paralelo — apenas não nos dados de avaliação |
| **Pipeline com Gate FST** | LLM gera → transdutor de estado finito valida morfologia → tenta novamente |
| **Modelos Encadeados** | Modelo A esboça → Modelo B pós-edita → Modelo C pontua |
| **Dicionário + LLM** | Force termos conhecidos de um dicionário, deixe o LLM lidar com o resto |
| **Evolutivo** | Gere candidatos, pontue-os, mute os melhores, repita |
| **Tradução Parcial** | Traduza uma amostra manualmente, prove que seu LLM corresponde, auto-traduza o resto |

Fine-tune modelos. Implante algoritmos evolutivos. Teste respostas de alunos em exames de idioma. Construa tabelas de consulta. Encadeie três modelos juntos. Contanto que seu método produza JSON, o harness o pontua e o framework o executa.

:::danger[A única regra]
**Não treine nos dados de avaliação.** Métodos expostos ao conjunto de dados de benchmark serão desqualificados. Fine-tune no que quiser. Apenas não no conjunto de testes.
:::

Este é um convite aberto. Se você trabalha com um idioma de baixo recurso — como pesquisador, membro da comunidade, estudante ou apenas alguém que se importa — construa um método, execute o harness e fortaleça a rede para todos. O problema não está resolvido. A infraestrutura está aqui e é aberta.

**[→ Veja o placar](/leaderboard)**

---

## Próximos Passos

**Começando:**
- [Instalação](/docs/getting-started/installation) — Configure em 2 minutos
- [Início Rápido](/docs/getting-started/quick-start) — Execute sua primeira sincronização
- [Idiomas Suportados](/docs/reference/supported-languages) — O que está disponível pronto para uso

**Personalizando sua configuração:**
- [Métodos de Tradução](/docs/guides/translation-methods) — Escolha o método certo por par
- [Memória de Tradução](/docs/concepts/translation-memory) — Como o cache economiza seu dinheiro
- [Configuração](/docs/getting-started/configuration) — Referência de configuração completa
- [Site Multilíngue Hugo](/docs/tutorials/hugo-multilingual-site) — Tradução de conteúdo Markdown

**Para se aprofundar:**
- [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) — Fluxo de trabalho de exportação/importação XLIFF
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — Princípios indígenas de soberania de dados: posse e controle comunitário dos dados linguísticos
- [Apoiar um Idioma de Baixos Recursos](/docs/network/community/low-resource-languages) — O desafio que deu início a tudo
- [Cookbook: Pipeline com Barreira FST](/docs/network/tutorials/fst-gated-pipeline) — Crie um pipeline de decomposição
- [Avaliação de MT](/docs/network/leaderboard/rules) — Como funcionam o harness e o ranking
- [Ranking de Métodos](/leaderboard) — Pontuações e envios em tempo real
