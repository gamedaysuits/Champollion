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

champollion detecta automaticamente seus arquivos de locale, formato e idiomas de destino. Traduz o que está faltando, pula o que já está pronto, valida cada resultado e escreve uma saída limpa. Esse é o ponto de partida.

:::info[Parte de algo maior]

Esta CLI é a ponta de implantação do **Champollion** — uma infraestrutura que mede a tradução automática para idiomas que ninguém mais mede e publica o que descobre. A parte de medição constrói conjuntos de testes de avaliação e um mapa público de quem pode traduzir o quê, quão bem, em quais tipos de texto; a CLI é onde um método comprovado se torna algo que você pode realmente executar.

Uma regra molda tudo: dados linguísticos são tratados como dados biológicos, de modo que as pessoas que fornecem um corpus detêm as chaves dele e de qualquer coisa medida a partir dele. O panorama completo — o que existe, quais são as regras, onde você se encaixa — está em [O que é o Champollion](/docs/what-is-champollion), e a parte de medição fica em [a Rede](/docs/network/).

:::

---

## Por Que Não Apenas Programar Você Mesmo?

Você poderia escrever um loop rápido que chama Google Translate em cada chave. A maioria dos desenvolvedores faz — leva cerca de 30 linhas. Aqui é onde quebra:

- **Sem detecção de mudanças.** Atualize uma string em inglês — a tradução fica obsoleta para sempre. champollion rastreia cada valor de origem com hashes SHA-256 e retraduz apenas o que mudou.
- **Sem agrupamento.** Uma chamada de API por chave significa 200 chaves = 200 viagens de ida e volta. champollion agrupa de forma inteligente (configurável, padrão 80 chaves/lote para LLM, 128 para Google).
- **Sem cache.** Cada sincronização retraduz tudo. A Memória de Tradução do champollion armazena em cache traduções por texto de origem + locale + método — executar sincronização novamente após uma mudança de chave traduz apenas essa chave, não o arquivo inteiro.
- **Sem porta de qualidade.** A tradução automática alucina, ecoa a origem de volta ou produz no script errado. champollion valida cada tradução antes de escrevê-la — script errado, inflação de comprimento e ecos de origem são detectados e rejeitados.
- **Sem consciência de formato.** Codificado em JSON? champollion lida com JSON, TOML, YAML e Markdown Hugo (frontmatter + corpo) com detecção automática.
- **Sem controle de método.** Cada par recebe o mesmo método. champollion permite que você use Google Translate para francês, um LLM para japonês e um pipeline customizado hospedado pela comunidade para Cree — no mesmo arquivo de configuração.

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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Francês recebe Google Translate (rápido, barato). Japonês recebe um LLM premium (nuançado). Plains Cree recebe um plugin treinado com regras gramaticais, dicionários e validação morfológica. Mesmo comando `sync`. Mesma porta de qualidade. Mesma CLI.

### Veja o que funciona

Acha que seu método pode traduzir inglês para espanhol? Turco para azerbaijano? Inglês para Cree?

**Construa e teste.** O [harness de avaliação](/docs/network/specifications/harness) complementar faz benchmark de qualquer método de tradução com pontuação reproduzível e com impressão digital. O [placar](/leaderboard) registra cada execução publicada, para que todos possam ver o que funciona.

O harness de avaliação e a CLI de produção compartilham a mesma interface de plugin. Um método que pontua bem no harness pode ser usado em produção — se a comunidade cujo idioma ele serve der consentimento. Para idiomas indígenas e de baixo recurso, esse consentimento importa. Veja [Soberania de Dados](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

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

O [Placar de Métodos](/leaderboard) é o quadro de pontuação — em tempo real, público e aberto para envios. Cada envio recebe uma impressão digital vinculada a um commit do Git, é versionado para um conjunto de dados específico e pontuado pela mesma estrutura de testes. Qualquer pessoa pode enviar.

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

**Aprofundando:**
- [Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators) — Fluxo de trabalho de exportação/importação XLIFF
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — Princípios indígenas de soberania de dados, CARE e Soberania de Dados Māori
- [Apoie um Idioma de Baixos Recursos](/docs/network/community/low-resource-languages) — O desafio que deu início a tudo
- [Cookbook: Pipeline Controlado por FST](/docs/network/tutorials/fst-gated-pipeline) — Construa um pipeline de decomposição
- [Avaliação de Tradução Automática](/docs/network/leaderboard/rules) — Como a estrutura de testes e o placar funcionam
- [Placar de Métodos](/leaderboard) — Pontuações em tempo real e envios
