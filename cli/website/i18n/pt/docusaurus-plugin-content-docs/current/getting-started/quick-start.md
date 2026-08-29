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

## 1. Configure Seus Arquivos de Locale

Crie um arquivo de localidade de origem. O Champollion suporta JSON, TOML, YAML e mais — veja a [referência da CLI](/docs/reference/cli) para a lista completa:

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
```

Obtenha uma chave Gemini gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenha uma chave OpenRouter em [openrouter.ai](https://openrouter.ai).

## 3. Execute Sync

```bash
npx champollion sync
```

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

A chave inalterada (`hero.subtitle`) é servida a partir do cache de **Memória de Tradução** do champollion — sem chamada de API, sem custo. O cache é construído automaticamente durante cada sincronização e armazenado em `.champollion/tm.json`.

## Opcional: Crie um Arquivo de Configuração

Para mais controle, gere um arquivo de configuração:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

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
  "model": "google/gemini-2.5-flash"
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
