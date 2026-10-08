---
sidebar_position: 2
title: "Início Rápido"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Início Rápido

Traduza seu primeiro arquivo de locale em 60 segundos.

A CLI é gratuita para uso não comercial sob a
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); o uso comercial não é coberto
por essa licença. Uma escola, um hospital ou clínica pública, uma instituição de caridade ou um projeto pessoal estão cobertos; a vitrine de uma loja
não está. [Quem pode usar](/docs/getting-started/who-may-use-this) detalha isso por completo.

## 1. Configure Seus Arquivos de Locale

Crie um arquivo de locale de origem. O Champollion suporta JSON, TOML, YAML e muito mais — consulte a [referência da CLI](/docs/reference/cli) para a lista completa:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Defina Sua Chave de API

Escolha um provedor e defina a chave:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Obtenha uma chave gratuita do Gemini em [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenha uma chave do OpenRouter em [openrouter.ai](https://openrouter.ai). Para a opção C, informe o modelo ao configurar o projeto: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (ou execute `sync --method local --model llama3.1`).

## 3. Execute Sync

```bash
npx champollion sync
```

:::note[Digitado por você ou executado por um script?]
Os comandos nesta página são aqueles que você digita: `npx champollion` executa a cópia instalada no seu projeto ou aquela que o npx busca — a versão mais recente na primeira vez e, depois, essa cópia em cache. Um comando executado por um script — CI, um script no `package.json`, um hook do git — deve especificar sua versão, `npx --yes champollion@0.5 sync`, para que uma nova versão nunca altere o que a build executa (e `--yes` evita que o npx pare para perguntar). O [guia de CI](/docs/guides/ci-cd) e as [páginas de frameworks](/docs/integrations/frameworks) fixam a versão dessa forma.
:::

:::tip[Usando Gemini?]
Se você escolheu a Opção B (Gemini), adicione `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion irá:
1. Detectar automaticamente `locales/en.json` como a origem
2. Encontrar (ou solicitar) idiomas de destino
3. Traduzir todas as chaves
4. Escrever `locales/fr.json`, `locales/ja.json`, etc.
5. Criar `.champollion.lock` para rastrear o que foi traduzido

## 4. Verifique os Resultados

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## O Que Acontece Depois?

Quando você altera uma string de origem, champollion detecta a mudança por meio do rastreamento de hash SHA-256 e retraduz apenas essa chave na próxima sincronização:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

A chave inalterada (`hero.subtitle`) é **ignorada**: sua tradução já está em `locales/fr.json`, portanto ela não é enviada para nenhum lugar e nem mesmo consultada — sem chamada, sem custo e sem ser contabilizada no número de itens "servidos do cache" da execução.

A **Memória de Tradução** (`.champollion/tm.json`, gerada automaticamente durante cada sincronização) serve para textos que *estão* na fila: uma string que você reverteu, a mesma frase em outro arquivo, uma retradução completa do locale (`sync --redo all`). Esses textos são servidos do cache gratuitamente, e a linha de execução informa quantos foram (`… 0 key(s) sent to the model, 12 served from the cache (free)`). O cache é mantido por método, registro e coaching — individualmente para o par e para seu fallback. Após trocar de método (por exemplo, `local` → `llm`) ou alterar o texto de um arquivo de coaching (no par, em seu idioma ou em seu fallback), nada é reutilizado e a execução explica o motivo; mudar apenas o modelo reutiliza traduções anteriores. Uma alteração não retraduz nada por conta própria: `sync` indica a retradução e seu custo.

## Opcional: Crie um Arquivo de Configuração

Para mais controle, gere um arquivo de configuração:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` e `--model` escolhem o método de tradução e o modelo (`npx champollion init --help` lista os métodos); o init exibe quais deles a configuração usa.

O assistente guiado o orienta através das **predefinições de registro** de cada idioma — instruções de tom/formalidade pré-construídas ajustadas ao seu sistema linguístico. O francês tem predefinições T-V (vouvoiement vs tutoiement), o coreano tem níveis de fala (해요체 vs 합쇼체 vs 해체), o japonês tem opções de keigo (です/ます vs 丁寧語).

Ou crie uma configuração manualmente com chaves de predefinição:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

Execute `npx champollion init` para navegar pelas predefinições disponíveis para cada idioma.

## Opcional: Modo Watch

Traduza automaticamente quando seu arquivo de origem mudar:

```bash
npx champollion watch
```

## Próximos Passos

- **[Configuração](/docs/getting-started/configuration)** — Referência completa de configuração
- **[Métodos de Tradução](/docs/guides/translation-methods)** — Escolha o método certo para cada par
- **[Memória de Tradução](/docs/concepts/translation-memory)** — Como o cache economiza dinheiro em re-execuções
- **[Trabalhando com Tradutores Profissionais](/docs/guides/professional-translators)** — Exporte XLIFF para revisão humana
- **[Integração com Framework](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatize traduções em seu pipeline
- **[Solução de Problemas](/docs/guides/troubleshooting)** — Problemas comuns e soluções
