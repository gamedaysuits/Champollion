# Guias de Integração

Configuração passo a passo do champollion com frameworks populares.

---

## Configuração de Chave de API

Antes de integrar com qualquer framework, você precisa de uma chave de API de tradução. Champollion suporta dois provedores:

### Opção A: OpenRouter (recomendado)

[OpenRouter](https://openrouter.ai) fornece uma API unificada para 200+ modelos LLM. Camada gratuita disponível.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Melhor para: projetos com muito conteúdo, tradução de Markdown e projetos que precisam de proteção de conteúdo (blocos de código, shortcodes, variáveis de interpolação).

### Opção B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Melhor para: pares de strings chave-valor de alto volume (194 idiomas). **Não recomendado** para conteúdo em Markdown — o Google Translate não reconhece blocos de código, shortcodes ou variáveis de interpolação.

Para usar Google Translate explicitamente:

```bash
champollion sync --method google-translate
```

> **Dica**: Se apenas `GOOGLE_TRANSLATE_API_KEY` estiver definido (sem chave OpenRouter), champollion muda automaticamente para Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Estrutura do projeto

Hugo usa `i18n/` para traduções de strings e `content/` para conteúdo de página:

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### Configuração

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Crie `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### Detalhes da tradução de conteúdo

**Front matter**: Suporta delimitadores YAML (`---`) e TOML (`+++`). Traduz `title`, `description`, `summary`, `subtitle`, `caption` e `linkTitle` por padrão. Todos os outros campos (data, draft, tags, weight, slug, etc.) são preservados. Personalize com `translatableFields` na sua configuração.

**Proteção de blocos**: Blocos de código, shortcodes Hugo (`{{< >}}`, `{{% %}}`), código inline e HTML bruto são automaticamente protegidos usando placeholders sentinela Unicode. Eles passam intactos.

**Convenção de nome de arquivo**: Segue o padrão de tradução por nome de arquivo do Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (remove sufixo de origem)

**Pular existentes**: Arquivos traduzidos existentes nunca são sobrescritos. Delete um arquivo de destino para forçar re-tradução.

### Formas plurais

Locales TOML e YAML suportam formas plurais CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Representadas internamente como `items.one` e `items.other` para diff, depois re-serializadas para o formato seccionado correto na escrita.

---

## next-intl (JSON)

### Estrutura do projeto

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### Configuração

```bash
npm install --save-dev champollion
```

Crie `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": ["fr", "de", "ja", "es", "ko", "zh", "pt", "ar"]
}
```

```bash
npx champollion sync
```

Cria `messages/fr.json`, `messages/ja.json`, etc. — totalmente traduzidos, preservando sua estrutura de chaves aninhadas. next-intl os detecta automaticamente.

### Fluxo de trabalho de desenvolvimento

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next (JSON)

### Estrutura de arquivo plano (recomendado)

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### Estrutura de diretório aninhado

Se você usar a estrutura `{locale}/{namespace}.json`, crie um script de sincronização para achatar → traduzir → desachatar. Veja a [documentação do react-i18next](https://react.i18next.com/) para detalhes.
