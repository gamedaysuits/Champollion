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
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Início Rápido

Traduza seu primeiro arquivo de idioma em 60 segundos.

A CLI é gratuita para uso não comercial sob a
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); o uso comercial não é coberto
por essa licença. Uma escola, um hospital ou clínica pública, uma instituição de caridade ou um projeto pessoal estão cobertos; a vitrine de uma loja
não está. A página [Quem pode usar isto](/docs/getting-started/who-may-use-this) explica tudo em detalhes.

## 1. Configure seus arquivos de idioma

Crie um arquivo de idioma de origem. O Champollion suporta JSON, TOML, YAML e muito mais — consulte a [referência da CLI](/docs/reference/cli) para ver a lista completa:

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

## 2. Defina sua chave de API

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

Obtenha uma chave gratuita do Gemini em [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenha uma chave do OpenRouter em [openrouter.ai](https://openrouter.ai). Para a opção C, dê um nome ao seu modelo ao configurar o projeto: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (ou execute `sync --method local --model llama3.1`).

## 3. Execute a sincronização

```bash
npx champollion sync
```

:::note[Digitado por você ou executado por um script?]
Os comandos nesta página são aqueles que você digita: `npx champollion` executa a cópia que seu projeto instalou ou a que o npx busca — a versão mais recente na primeira vez e, depois, essa cópia em cache. Um comando que um script executa para você — CI, um script do `package.json`, um gancho do git — deve indicar sua versão, `npx --yes champollion@0.6 sync`, para que uma nova versão nunca altere o que a compilação executa (e `--yes` impede o npx de parar para perguntar). O [guia de CI](/docs/guides/ci-cd) e as [páginas de frameworks](/docs/integrations/frameworks) fixam a versão dessa forma.
:::

:::tip[Usando o Gemini?]
Se você escolheu a Opção B (Gemini), adicione `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

O Champollion irá:
1. Detectar automaticamente `locales/en.json` como a origem
2. Encontrar (ou solicitar) os idiomas de destino
3. Traduzir todas as chaves
4. Gravar `locales/fr.json`, `locales/ja.json`, etc.
5. Criar `.champollion.lock` para acompanhar o que já foi traduzido

## 4. Verifique os resultados

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

## O que acontece em seguida?

Quando você altera uma string de origem, o champollion detecta a alteração por meio do rastreamento de hash SHA-256 e retraduz apenas essa chave na próxima sincronização:

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

A chave inalterada (`hero.subtitle`) é **ignorada**: sua tradução já está em `locales/fr.json`, portanto, ela não é enviada para lugar nenhum e nem sequer consultada — sem chamada, sem custo e sem ser contabilizada no número de itens "servidos do cache" da execução.

A **Memória de Tradução** (`.champollion/tm.json`, criada automaticamente a cada sincronização) serve para o texto que *está* na fila: uma string que você reverteu para o valor anterior, a mesma frase em outro arquivo, uma retradução completa do idioma (`sync --redo all`). Esses textos são servidos do cache gratuitamente, e a linha de execução mostra quantos foram (`… 0 key(s) sent to the model, 12 served from the cache (free)`). O cache é mantido por método, registro e instrução (coaching) — tanto para o par quanto para sua alternativa (fallback). Após trocar de método (por exemplo, `local` → `llm`) ou alterar o texto de um arquivo de instrução (no par, em seu idioma ou em seu fallback), nada é reutilizado e a execução explica o motivo; já a troca apenas do modelo reutiliza traduções anteriores. Uma alteração por si só não retraduz nada: `sync` indica a retradução e seu custo.

## Opcional: Criar um arquivo de configuração

Para ter mais controle, gere um arquivo de configuração:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` e `--model` escolhem o método e o modelo de tradução (`npx champollion init --help` lista os métodos); o init mostra quais deles a configuração utiliza.

O assistente guiado orienta você nas **predefinições de registro** de cada idioma — instruções predefinidas de tom/formalidade ajustadas ao seu sistema linguístico. O francês possui predefinições T-V (vouvoiement vs. tutoiement), o coreano possui níveis de fala (해요체 vs. 합쇼체 vs. 해체), o japonês possui opções de keigo (です/ます vs. 丁寧語).

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

## Opcional: Modo de monitoramento (Watch Mode)

Traduza automaticamente quando o arquivo de origem for alterado:

```bash
npx champollion watch
```

## Próximos passos

- **[Configuração](/docs/getting-started/configuration)** — Referência completa de configuração
- **[Métodos de tradução](/docs/guides/translation-methods)** — Escolha o método certo para cada par
- **[Memória de tradução](/docs/concepts/translation-memory)** — Como o cache economiza seu dinheiro em novas execuções
- **[Trabalhando com tradutores profissionais](/docs/guides/professional-translators)** — Exporte XLIFF para revisão humana
- **[Integração com frameworks](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatize traduções no seu pipeline
- **[Solução de problemas](/docs/guides/troubleshooting)** — Problemas comuns e soluções
