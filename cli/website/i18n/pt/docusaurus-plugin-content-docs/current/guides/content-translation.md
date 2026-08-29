---
sidebar_position: 5
title: "Tradução de Conteúdo"
---

# Tradução de Conteúdo Hugo Markdown

Champollion traduz arquivos Hugo Markdown — tanto campos de front matter quanto conteúdo do corpo — com proteção total de blocos de código, shortcodes e elementos estruturados.

## Configuração

Configure `contentDir` em seu config para ativar a tradução de conteúdo Markdown:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## O Que É Traduzido

### Front Matter

Ambos os delimitadores YAML (`---`) e TOML (`+++`) são suportados. Por padrão, estes campos são traduzidos:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Todos os outros campos (`date`, `draft`, `tags`, `weight`, `slug`, etc.) são preservados como estão. Personalize com `translatableFields` em seu config.

### Conteúdo do Corpo

O corpo completo do Markdown é traduzido com proteção de blocos — elementos estruturados são protegidos usando placeholders sentinela Unicode antes da tradução e restaurados depois.

## Proteção de Blocos

Estes elementos passam pela tradução intocados:

| Elemento | Exemplo | Proteção |
|---------|---------|-----------|
| Blocos de código | ``````` ```js ... ``` ``````` | Bloco totalmente protegido |
| Código inline | `` `variable` `` | Protegido |
| Shortcodes Hugo | `{{< figure >}}`, `{{% note %}}` | Bloco totalmente protegido |
| HTML bruto | `<div>`, `<table>` | Protegido |
| Links (URLs) | `[text](https://...)` | URL preservada, texto traduzido |
| Interpolação | `{{ .Count }}` | Protegido |

## Convenção de Nomes de Arquivo

Segue o padrão de tradução por nome de arquivo do Hugo:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Comportamento de Pulo

Arquivos traduzidos existentes **nunca são sobrescritos**. Se `my-post.fr.md` já existe, é pulado. Delete o arquivo de destino para forçar uma re-tradução.

## Métodos Apenas Markdown

:::warning[Google Translate e Markdown]
Google Translate **não tem consciência** de blocos de código, shortcodes ou variáveis de interpolação. Ele corromperá conteúdo Markdown estruturado. Use métodos LLM (`llm` ou `llm-coached`) para tradução de conteúdo — eles protegem explicitamente elementos estruturados.
:::

Quando a tradução de conteúdo volta do Google Translate para um método LLM, champollion registra um aviso explicando o motivo.
