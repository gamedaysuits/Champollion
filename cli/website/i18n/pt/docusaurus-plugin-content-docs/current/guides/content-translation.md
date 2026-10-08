---
sidebar_position: 5
title: "Tradução de Conteúdo"
---

# Tradução de conteúdo (Markdown)

O Champollion traduz arquivos Markdown e MDX, tanto os campos de front matter quanto o corpo. Blocos de código, shortcodes e outros elementos estruturados são protegidos contra tradução.

Os arquivos ficam em um **diretório de conteúdo** (`contentDir`). Pode ser qualquer pasta com Markdown: a pasta `content/` de um site Hugo ou uma pasta de newsletters dentro de um app Next.js. Um site Docusaurus (um com `docusaurus.config.js`) é diferente: seus diretórios `docs/` e `blog/` são traduzidos em pastas `i18n/<locale>/` sem um `contentDir`. Consulte [Integração com frameworks](/docs/guides/framework-integration).

## Configuração

Defina `contentDir` na sua configuração ou passe `--content-dir` na linha de comando:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

No início de uma execução, o sync informa a pasta e diz para onde as traduções irão:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Em um site Hugo, ele também indica a evidência que encontrou, por exemplo `Detected framework: Hugo (hugo.toml)`. O Hugo é considerado detectado quando existe um arquivo `hugo.toml`/`.yaml`/`.yml`/`.json`, a pasta `config/_default/` do Hugo, um `config.toml` ou `config.yaml` com uma configuração exclusiva do Hugo, como `baseURL`, uma pasta `archetypes/` ou uma pasta `layouts/` de templates do Hugo. Sendo Hugo ou não, os arquivos são traduzidos e nomeados da mesma forma.

## Para onde vão as traduções

Cada tradução é gravada **ao lado do seu arquivo de origem**, com a localidade de destino adicionada antes da extensão. Esta é a convenção de tradução por nome de arquivo do Hugo:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

As subpastas também são pesquisadas, e cada tradução permanece na pasta do seu arquivo de origem. O seu app seleciona o arquivo para uma localidade por esse nome. Uma página Next.js, por exemplo, lê `newsletters/2026-10.crk.md` para Plains Cree.

**Quais arquivos contam como fontes.** Todo arquivo `.md` e `.mdx` na pasta é uma fonte, a menos que seu nome termine em `.<code>.md` (ou `.mdx`) e `<code>` se pareça com um código de idioma. Um código de idioma aqui corresponde a duas ou três letras minúsculas, opcionalmente seguidas por uma escrita como `-Hant` e/ou uma região como `-BR` ou `-419`. Esses arquivos são considerados traduções e ignorados. Um sufixo de idioma de origem (`launch.en.md`) ainda conta como fonte. Uma pegadinha: um arquivo de origem com um nome como `guide.faq.md` também termina com um sufixo de duas a três letras, sendo interpretado como uma tradução para "faq" e não traduzido. Renomeie-o, por exemplo, para `guide-faq.md`.

## O Que É Traduzido

### Front Matter

Ambos os delimitadores YAML (`---`) e TOML (`+++`) são suportados. Por padrão, estes campos são traduzidos:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Todos os outros campos (`date`, `draft`, `tags`, `weight`, `slug`, etc.) são copiados da origem exatamente como estão. Você pode alterar essa lista com `translatableFields` na sua configuração.

### Conteúdo do Corpo

Por padrão, o corpo é dividido em parágrafos e outros blocos de nível superior, e cada bloco é traduzido. Os elementos estruturados são protegidos por placeholders antes da tradução e restaurados depois. Com `contentSegmentation: "page"`, o corpo é traduzido como uma parte única.

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

## Quando um arquivo é traduzido novamente

O sync registra uma impressão digital (SHA-256) de cada arquivo de origem em `.champollion-content.lock`. Faça commit desse arquivo junto com as suas traduções.

- **Origem inalterada:** a tradução não é modificada.
- **Origem alterada:** o arquivo é atualizado. Parágrafos cujo texto em inglês não mudou vêm da [Memória de Tradução](/docs/concepts/translation-memory) sem custo, então você paga apenas pelos parágrafos que foram alterados.
- **Um arquivo de tradução sem entrada no lock** (um que você escreveu manualmente) é mantido como está e registrado como seu. A exceção é um arquivo que ainda contém marcadores `[EN] ` gravados por uma versão do CLI anterior a 0.5.0, o qual é traduzido novamente.
- **Um bloco recusado pelo quality gate, mesmo após nova tentativa com o motivo informado,** mantém o texto de origem, sem nenhum marcador na página. A entrada do lock da página exibe `pending:<hash>`, e a recusa é registrada em `.champollion-content.lock`. Execuções posteriores do sync não enviam esse bloco para o mesmo modelo novamente, de modo que ele não é cobrado outra vez. `status` e `verify` listam a página. Solicite novamente com `--redo files:<page>`, adicione um método `fallback` ou escreva o parágrafo você mesmo (ele será mantido). Um campo de front matter recusado mantém o texto de origem da mesma forma, e o restante da página é gravado. Consulte [Blocos de Markdown e campos de front matter recusados](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Para traduzir um arquivo novamente de forma intencional, especifique o nome dele. O caminho é o exibido pelo sync, relativo ao diretório de conteúdo:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Revisão e edição de traduções {#reviewing-and-editing-translations}

Um revisor pode corrigir o Markdown traduzido diretamente no arquivo de tradução. O Champollion mantém essas correções quando a origem for alterada posteriormente.

1. Execute `champollion sync` e faça commit das traduções junto com `.champollion-content.lock`.
2. O revisor abre o arquivo traduzido, por exemplo `newsletters/2026-10.crk.md`, e faz as edições. Ele pode alterar qualquer parágrafo ou um campo de front matter traduzido, como `title` ou `description`.
3. O revisor faz commit do arquivo. Nenhum comando é necessário para "aceitar" as edições.

O que acontece com as edições no próximo `champollion sync`:

| Situação | O que o sync faz |
|---|---|
| A origem não mudou | Nada. A tradução é mantida exatamente como o revisor a deixou. |
| A origem mudou em **outros** parágrafos | Os parágrafos e campos do revisor são **mantidos palavra por palavra** e os parágrafos alterados são traduzidos. A execução indica isso, por exemplo `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. O texto do revisor continua preservado a cada sync posterior. |
| O parágrafo de origem que o revisor editou **também** mudou | Esse parágrafo é traduzido novamente, pois a versão do revisor traduz um texto em inglês que não existe mais. A execução exibe um aviso com a redação do revisor, para que ela possa ser reaplicada se ainda for adequada. |
| O revisor adicionou, removeu ou mesclou parágrafos, ou o par utiliza `contentSegmentation: "page"` | As edições não podem ser associadas parágrafo por parágrafo. Quando a origem muda, o arquivo é **mantido exatamente como está**, e todo sync emite um aviso e o lista até que a situação seja resolvida. Atualize-o manualmente (o próximo sync considerará o arquivo editado como atual) ou substitua-o pela tradução automática usando `--redo files:<path>`. |

Edições em blocos de código, espaços em branco entre parágrafos e campos de front matter que não são traduzidos (`date`, `tags` e assim por diante) não são mantidas quando o arquivo é regravado. Essas partes sempre vêm da origem.

**Substituindo as edições deliberadamente.** As edições só são substituídas quando você especifica o arquivo. `--redo files:2026-10.md` restaura a tradução automática em cache. `--redo files:2026-10.md --fresh` (ou `--retranslate 2026-10.md`) traduz novamente do zero. Uma execução que reprocessa todo o conteúdo sem especificar arquivos (`--redo content`, `--force-content`) mantém as edições.

**Como as edições são reconhecidas.** Cada vez que o sync grava uma tradução, ele também registra em `.champollion-content.lock` uma impressão digital curta de cada parágrafo gravado. Um parágrafo no disco que não coincida mais foi alterado por uma pessoa. Se o arquivo lock for perdido, as edições não poderão ser reconhecidas, portanto, mantenha-o no controle de versão. Uma tradução gerada por uma versão mais antiga do Champollion é registrada no próximo sync. Se as suas edições nela forem diferentes do que a Memória de Tradução contém, elas serão reconhecidas como suas.

O texto do revisor nunca é armazenado na Memória de Tradução como saída gerada por máquina.

:::note[O XLIFF abrange apenas arquivos de strings]
`champollion xliff export` repassa os **arquivos de strings** (chaves e valores) do seu app para a ferramenta CAT de um tradutor. Consulte [Trabalhando com tradutores profissionais](/docs/guides/professional-translators). Ainda não há suporte para exportação XLIFF de conteúdo Markdown, portanto, o Markdown traduzido é revisado diretamente nos próprios arquivos, como descrito acima.
:::

## Métodos Apenas Markdown

:::warning[Google Translate e Markdown]
O Google Translate **não reconhece** blocos de código, shortcodes ou variáveis de interpolação. Ele corromperá o conteúdo estruturado em Markdown. Use métodos baseados em LLM (`llm` ou `llm-coached`) para tradução de conteúdo, pois eles protegem explicitamente os elementos estruturados.
:::

Quando a tradução de conteúdo volta do Google Translate para um método LLM, champollion registra um aviso explicando o motivo.
