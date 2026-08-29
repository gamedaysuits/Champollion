---
sidebar_position: 3
title: "Site Hugo Multilíngue"
description: "Cookbook: configure um site Hugo multilíngue completo com champollion gerenciando tanto a tradução de arquivos de strings quanto de conteúdo Markdown."
related:
  - label: "Content Translation"
    to: /docs/guides/content-translation
    kind: guide
    note: "Markdown and long-form content, not just strings"
  - label: "Framework Integration"
    to: /docs/guides/framework-integration
    kind: guide
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale the same setup to thirty locales"
---

# Cookbook: Site Multilíngue Hugo

Configure o sistema multilíngue do Hugo com champollion tratando tanto arquivos de strings JSON quanto tradução de conteúdo Markdown. Isso cobre o fluxo completo desde a configuração do projeto até a implantação em produção.

**O que você vai construir:** Um site Hugo com inglês, francês e japonês — traduções de strings via arquivos de locale, traduções de conteúdo via processamento Markdown.

---

## Estrutura do Projeto

Champollion usa o modo de tradução **baseado em nome de arquivo** do Hugo. Arquivos traduzidos são colocados no mesmo diretório do arquivo de origem, com um sufixo de idioma adicionado ao nome do arquivo (ex: `about.fr.md`):

```
my-hugo-site/
├── content/
│   └── en/
│       ├── _index.md
│       ├── _index.fr.md           ← champollion generates
│       ├── _index.ja.md           ← champollion generates
│       ├── about.md
│       ├── about.fr.md            ← champollion generates
│       ├── about.ja.md            ← champollion generates
│       └── blog/
│           ├── first-post.md
│           ├── first-post.fr.md   ← champollion generates
│           └── first-post.ja.md   ← champollion generates
├── i18n/
│   ├── en.json
│   ├── fr.json                    ← champollion generates
│   └── ja.json                    ← champollion generates
└── hugo.toml
```

:::note[Modos i18n do Hugo]
Hugo suporta duas estratégias de tradução: **baseada em nome de arquivo** (`about.fr.md` ao lado de `about.md`) e **baseada em diretório** (árvores `content/fr/about.md` separadas). Champollion usa tradução baseada em nome de arquivo porque sua função `getTargetContentPath()` gera caminhos de destino anexando um sufixo de idioma ao nome do arquivo de origem. Certifique-se de que seu `hugo.toml` está configurado para tradução baseada em nome de arquivo ao usar champollion.
:::

## Passo 1: Configurar Hugo

```toml title="hugo.toml"
defaultContentLanguage = 'en'

[languages]
  [languages.en]
    languageName = 'English'
    weight = 1
  [languages.fr]
    languageName = 'Français'
    weight = 2
  [languages.ja]
    languageName = '日本語'
    weight = 3
```

## Passo 2: Configurar Champollion

Champollion precisa de duas coisas configuradas: o caminho do arquivo de locale (para strings JSON) e o diretório de conteúdo (para Markdown).

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "method": "llm" },
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" }
  },
  "languages": {
    "fr": { "name": "French", "register": "Formal (vous-form)" },
    "ja": { "name": "Japanese", "register": "Polite/formal" }
  }
}
```

## Passo 3: Criar Conteúdo de Origem

### Traduções de Strings (i18n/)

```json title="i18n/en.json"
{
  "nav": {
    "home": "Home",
    "about": "About",
    "blog": "Blog",
    "contact": "Contact"
  },
  "footer": {
    "copyright": "© 2026 My Company. All rights reserved.",
    "privacy": "Privacy Policy"
  }
}
```

### Conteúdo Markdown (content/en/)

```markdown title="content/en/about.md"
---
title: "About Us"
description: "Learn more about our team and mission"
date: 2026-01-15
---

We build software that helps businesses communicate across languages.

Our platform supports **real-time translation** for over 30 languages,
with specialized support for low-resource languages.

## Our Mission

Language should never be a barrier to understanding.

## The Team

{{< team-grid >}}
```

## Passo 4: Executar a Sincronização

```bash
npx champollion sync
```

Champollion processa ambos os tipos:

1. **Arquivos de strings** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Arquivos de conteúdo** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Detalhes da Tradução de Conteúdo

Ao traduzir Markdown, champollion automaticamente:

- **Protege** blocos de código, shortcodes (`{{< ... >}}`), código inline e HTML
- **Traduz** campos de front matter (`title`, `description`, `summary`)
- **Preserva** todos os outros campos de front matter (`date`, `draft`, `weight`, `tags`)
- **Restaura** blocos protegidos após a tradução

O shortcode Hugo `{{< team-grid >}}` passa sem tradução.

## Passo 5: Verificar

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Navegue até `localhost:1313/fr/` e `localhost:1313/ja/` para revisar o conteúdo traduzido.

## Passo 6: Seletor de Idioma Hugo

Adicione um seletor de idioma ao seu layout Hugo:

```html title="layouts/partials/language-switcher.html"
<nav class="language-switcher">
  {{ range $.Site.Home.AllTranslations }}
    <a href="{{ .Permalink }}"
       {{ if eq .Lang $.Site.Language.Lang }}class="active"{{ end }}>
      {{ .Language.LanguageName }}
    </a>
  {{ end }}
</nav>
```

## Mantendo o Conteúdo Sincronizado

Quando você atualiza conteúdo em inglês, execute a sincronização novamente. Champollion apenas retraduz arquivos que foram alterados:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

O arquivo de lock rastreia hashes de conteúdo por arquivo, então páginas estáveis não são retraduzidas.

## Veja Também

- **[Guia de Tradução de Conteúdo](/docs/guides/content-translation)** — Mergulho profundo em proteção, front matter e casos extremos
- **[Integração com Frameworks](/docs/guides/framework-integration)** — Configurações Next.js e React
- **[Guia CI/CD](/docs/guides/ci-cd)** — Automatize sincronizações em push para `content/en/`
- **[Métodos de Tradução](/docs/guides/translation-methods)** — Compare estratégias de tradução LLM, TM e híbrida
- **[Idiomas Suportados](/docs/reference/supported-languages)** — Lista completa de locales suportados e códigos de idioma
